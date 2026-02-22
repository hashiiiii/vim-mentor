// =============================================================================
// feedback.ts
// Success feedback system: flash decorations, streak tracking, milestones.
// =============================================================================

import * as vscode from "vscode";
import * as storage from "./storage";

// -----------------------------------------------------------------------------
// Decoration Types
// -----------------------------------------------------------------------------

const successFlashDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor(
    "editorInfo.background"
  ),
  isWholeLine: true,
});

// Fallback with explicit color if theme color not available
const successFlashDecorationFallback =
  vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(78, 154, 6, 0.15)",
    isWholeLine: true,
  });

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

interface FeedbackState {
  streak: number;
  totalCorrect: number;
  totalIncorrect: number;
  sessionStart: number;
}

const state: FeedbackState = {
  streak: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  sessionStart: Date.now(),
};

const MILESTONES = [5, 10, 25, 50, 100];

// -----------------------------------------------------------------------------
// Flash Effect
// -----------------------------------------------------------------------------

/**
 * Flash the current line green briefly to indicate success.
 */
export function flashSuccess(durationMs: number = 300): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const line = editor.selection.active.line;
  const range = new vscode.Range(line, 0, line, 0);

  editor.setDecorations(successFlashDecoration, [range]);

  setTimeout(() => {
    editor.setDecorations(successFlashDecoration, []);
  }, durationMs);
}

// -----------------------------------------------------------------------------
// Streak and Milestone Tracking
// -----------------------------------------------------------------------------

/**
 * Record a correct Vim command usage. Increments streak and triggers feedback.
 */
export function recordSuccess(command: string): void {
  state.streak++;
  state.totalCorrect++;

  // Flash
  flashSuccess();

  // Persist
  storage.recordCorrect(command);
  storage.updateBestStreak(state.streak);

  // Check milestones
  for (const milestone of MILESTONES) {
    if (state.streak === milestone) {
      showMilestone(milestone);
      break;
    }
  }
}

/**
 * Record a failed (non-Vim) operation. Resets streak.
 */
export function recordFailure(command: string): void {
  state.streak = 0;
  state.totalIncorrect++;

  storage.recordPrompted(command);
}

/**
 * Show a milestone celebration notification.
 */
function showMilestone(count: number): void {
  const messages: Record<number, { title: string; body: string }> = {
    5: {
      title: "Nice start!",
      body: "5 correct Vim commands in a row!",
    },
    10: {
      title: "Getting better!",
      body: "10 streak! You are learning fast.",
    },
    25: {
      title: "Impressive!",
      body: "25 streak! Vim is becoming natural.",
    },
    50: {
      title: "Vim Apprentice!",
      body: "50 streak! True muscle memory forming.",
    },
    100: {
      title: "Vim Master!",
      body: "100 streak! Nothing can stop you now.",
    },
  };

  const msg = messages[count] ?? {
    title: "Milestone!",
    body: `${count} correct commands in a row!`,
  };

  vscode.window.showInformationMessage(
    `Vim Mentor: ${msg.title} - ${msg.body}`
  );
}

// -----------------------------------------------------------------------------
// State Accessors
// -----------------------------------------------------------------------------

export function getStreak(): number {
  return state.streak;
}

export function getStats(): {
  streak: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;
} {
  const total = state.totalCorrect + state.totalIncorrect;
  return {
    streak: state.streak,
    totalCorrect: state.totalCorrect,
    totalIncorrect: state.totalIncorrect,
    accuracy: total > 0 ? Math.floor((state.totalCorrect / total) * 100) : 0,
  };
}

export function getSessionStart(): number {
  return state.sessionStart;
}

export function resetSession(): void {
  state.streak = 0;
  state.totalCorrect = 0;
  state.totalIncorrect = 0;
  state.sessionStart = Date.now();
}

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------

export function dispose(): void {
  successFlashDecoration.dispose();
  successFlashDecorationFallback.dispose();
}
