// =============================================================================
// suggestion.ts
// Generates human-readable suggestion messages from rule matches.
// Bridges between the detection layer and the UI layer.
// =============================================================================

import type { LearningLevel, TeachingMode } from "./config";
import {
  type NonVimOperationType,
  type DetectionContext,
  type VimSuggestion,
  findRule,
  getBestSuggestion,
  getAllSuggestions,
} from "./rules";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface SuggestionResult {
  /** The type of non-Vim operation that was detected */
  operationType: NonVimOperationType;
  /** Human-readable name of what was detected (e.g., "Arrow Down") */
  detectedName: string;
  /** The primary suggestion to show */
  primary: VimSuggestion;
  /** All applicable suggestions (primary + alternatives) */
  all: VimSuggestion[];
  /** The VS Code command to execute if we allow the action through */
  fallbackCommand: string;
  /** How many consecutive times the same operation has been detected */
  repeatCount: number;
}

// -----------------------------------------------------------------------------
// Repeat Tracking
// -----------------------------------------------------------------------------

interface RepeatTracker {
  lastOperation: NonVimOperationType | null;
  count: number;
  lastTimestamp: number;
}

const tracker: RepeatTracker = {
  lastOperation: null,
  count: 0,
  lastTimestamp: 0,
};

/** Time window in ms to consider presses as "repeated" */
const REPEAT_WINDOW_MS = 2000;

/**
 * Track consecutive presses of the same operation type.
 * Returns the updated repeat count.
 */
function trackRepeat(operation: NonVimOperationType): number {
  const now = Date.now();
  if (
    tracker.lastOperation === operation &&
    now - tracker.lastTimestamp < REPEAT_WINDOW_MS
  ) {
    tracker.count++;
  } else {
    tracker.count = 1;
  }
  tracker.lastOperation = operation;
  tracker.lastTimestamp = now;
  return tracker.count;
}

/**
 * Reset the repeat tracker (called when a correct Vim command is used).
 */
export function resetRepeatTracker(): void {
  tracker.lastOperation = null;
  tracker.count = 0;
  tracker.lastTimestamp = 0;
}

// -----------------------------------------------------------------------------
// Suggestion Generation
// -----------------------------------------------------------------------------

/**
 * Generate a suggestion result for a detected non-Vim operation.
 *
 * @param operationType - The type of non-Vim operation detected
 * @param userLevel - The user's current learning level
 * @param editor - The active text editor (used to build context)
 * @returns A SuggestionResult, or undefined if no rule exists
 */
export function generateSuggestion(
  operationType: NonVimOperationType,
  userLevel: LearningLevel,
  editor: {
    selection: { active: { line: number; character: number } };
    document: { lineCount: number; lineAt: (line: number) => { text: string } };
  }
): SuggestionResult | undefined {
  const rule = findRule(operationType);
  if (!rule) {
    return undefined;
  }

  const repeatCount = trackRepeat(operationType);

  const currentLine = editor.selection.active.line;
  const currentCol = editor.selection.active.character;
  const lineText = editor.document.lineAt(currentLine).text;

  const context: DetectionContext = {
    repeatCount,
    currentLine,
    totalLines: editor.document.lineCount,
    currentCol,
    lineLength: lineText.length,
  };

  const primary = getBestSuggestion(operationType, context, userLevel);
  if (!primary) {
    return undefined;
  }

  const all = getAllSuggestions(operationType, context, userLevel);

  return {
    operationType,
    detectedName: rule.displayName,
    primary,
    all,
    fallbackCommand: rule.fallbackCommand,
    repeatCount,
  };
}

/**
 * Format a suggestion into a short one-line string for status bar or
 * inline display.
 */
export function formatShort(suggestion: SuggestionResult): string {
  return `Use: ${suggestion.primary.command} (${suggestion.primary.description})`;
}

/**
 * Format a suggestion into a detailed multi-line string for popups.
 */
export function formatDetailed(suggestion: SuggestionResult): string {
  const lines: string[] = [];

  lines.push(`Detected: ${suggestion.detectedName}`);
  lines.push("");
  lines.push(`Use: ${suggestion.primary.command}`);
  lines.push(`  ${suggestion.primary.description}`);

  if (suggestion.primary.whyBetter) {
    lines.push("");
    lines.push(`Why: ${suggestion.primary.whyBetter}`);
  }

  // Show alternatives if available
  if (suggestion.all.length > 1) {
    lines.push("");
    lines.push("Alternatives:");
    for (let i = 1; i < suggestion.all.length && i < 4; i++) {
      const alt = suggestion.all[i];
      lines.push(`  ${alt.command} - ${alt.description}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format a suggestion for display as a VS Code InformationMessage.
 */
export function formatMessage(suggestion: SuggestionResult): string {
  const cmd = suggestion.primary.command;
  const desc = suggestion.primary.description;
  return `Vim Mentor: Instead of ${suggestion.detectedName}, use "${cmd}" -- ${desc}`;
}
