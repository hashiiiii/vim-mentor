// =============================================================================
// storage.ts
// Persistence using VS Code's globalState and ExtensionContext.
// Stores learning progress, streak history, and per-command statistics.
// =============================================================================

import * as vscode from "vscode";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface CommandStats {
  correct: number;
  prompted: number;
  lastSeen: number | null;
}

export interface SessionRecord {
  date: string;
  correct: number;
  incorrect: number;
  bestStreak: number;
  durationMinutes: number;
}

export interface ProgressData {
  commands: Record<string, CommandStats>;
  sessions: SessionRecord[];
  level: number;
  lifetime: {
    correct: number;
    incorrect: number;
    bestStreak: number;
    totalSessions: number;
  };
}

// -----------------------------------------------------------------------------
// Storage Manager
// -----------------------------------------------------------------------------

const STORAGE_KEY = "vim-mentor.progress";

let globalState: vscode.Memento | undefined;

/**
 * Initialize the storage system with the extension's global state.
 */
export function init(state: vscode.Memento): void {
  globalState = state;
}

/**
 * Return the default (empty) progress data structure.
 */
export function defaultData(): ProgressData {
  return {
    commands: {},
    sessions: [],
    level: 1,
    lifetime: {
      correct: 0,
      incorrect: 0,
      bestStreak: 0,
      totalSessions: 0,
    },
  };
}

/**
 * Load progress data from VS Code's global state.
 */
export function load(): ProgressData {
  if (!globalState) {
    return defaultData();
  }
  const raw = globalState.get<ProgressData>(STORAGE_KEY);
  if (!raw) {
    return defaultData();
  }
  // Merge with defaults to handle schema evolution
  return {
    ...defaultData(),
    ...raw,
    lifetime: { ...defaultData().lifetime, ...(raw.lifetime ?? {}) },
  };
}

/**
 * Save progress data to VS Code's global state.
 */
export async function save(data: ProgressData): Promise<void> {
  if (!globalState) {
    return;
  }
  await globalState.update(STORAGE_KEY, data);
}

/**
 * Record a correct Vim command usage.
 */
export async function recordCorrect(command: string): Promise<void> {
  const data = load();

  // Update command stats
  if (!data.commands[command]) {
    data.commands[command] = { correct: 0, prompted: 0, lastSeen: null };
  }
  data.commands[command].correct++;
  data.commands[command].lastSeen = Date.now();

  // Update lifetime totals
  data.lifetime.correct++;

  await save(data);
}

/**
 * Record a non-Vim operation detection (user was prompted).
 */
export async function recordPrompted(command: string): Promise<void> {
  const data = load();

  if (!data.commands[command]) {
    data.commands[command] = { correct: 0, prompted: 0, lastSeen: null };
  }
  data.commands[command].prompted++;
  data.commands[command].lastSeen = Date.now();

  data.lifetime.incorrect++;

  await save(data);
}

/**
 * Update the best streak if the current streak exceeds it.
 */
export async function updateBestStreak(streak: number): Promise<void> {
  const data = load();
  if (streak > data.lifetime.bestStreak) {
    data.lifetime.bestStreak = streak;
    await save(data);
  }
}

/**
 * Save a completed session record.
 */
export async function saveSession(session: SessionRecord): Promise<void> {
  const data = load();
  data.sessions.push(session);
  data.lifetime.totalSessions++;
  // Keep only the last 100 sessions
  if (data.sessions.length > 100) {
    data.sessions = data.sessions.slice(-100);
  }
  await save(data);
}

/**
 * Update the stored learning level.
 */
export async function updateLevel(level: number): Promise<void> {
  const data = load();
  data.level = level;
  await save(data);
}

/**
 * Reset all progress data.
 */
export async function resetAll(): Promise<void> {
  await save(defaultData());
}
