// =============================================================================
// ui.ts
// UI layer for VS Code:
//   - InformationMessage for hints (Gentle mode)
//   - Inline decoration (virtual text) using TextEditorDecorationType
//   - StatusBarItem for streak/level display
//   - QuickInput for blocking mode (Strict/Master)
// =============================================================================

import * as vscode from "vscode";
import {
  type TeachingMode,
  type LearningLevel,
  getConfig,
  TEACHING_MODE_NAMES,
  LEARNING_LEVEL_NAMES,
} from "./config";
import type { SuggestionResult } from "./suggestion";
import { formatMessage, formatShort, resetRepeatTracker } from "./suggestion";
import * as feedback from "./feedback";

// -----------------------------------------------------------------------------
// Virtual Text Decoration
// -----------------------------------------------------------------------------

const virtualTextDecoration = vscode.window.createTextEditorDecorationType({
  after: {
    color: new vscode.ThemeColor("editorCodeLens.foreground"),
    fontStyle: "italic",
    margin: "0 0 0 2em",
  },
});

let currentVirtualTextEditor: vscode.TextEditor | undefined;

/**
 * Show a virtual text hint at the end of the current line.
 */
function showVirtualText(
  editor: vscode.TextEditor,
  suggestion: SuggestionResult
): void {
  clearVirtualText();

  const line = editor.selection.active.line;
  const range = new vscode.Range(line, 0, line, 0);

  const text = formatShort(suggestion);

  editor.setDecorations(virtualTextDecoration, [
    {
      range,
      renderOptions: {
        after: {
          contentText: `  ${text}`,
        },
      },
    },
  ]);

  currentVirtualTextEditor = editor;
}

/**
 * Clear all virtual text decorations.
 */
function clearVirtualText(): void {
  if (currentVirtualTextEditor) {
    currentVirtualTextEditor.setDecorations(virtualTextDecoration, []);
    currentVirtualTextEditor = undefined;
  }
}

// Auto-clear virtual text when cursor moves
let cursorMoveDisposable: vscode.Disposable | undefined;

function setupCursorMoveListener(): vscode.Disposable {
  if (cursorMoveDisposable) {
    return cursorMoveDisposable;
  }
  cursorMoveDisposable = vscode.window.onDidChangeTextEditorSelection(() => {
    // Clear virtual text on any cursor movement after showing a hint
    clearVirtualText();
  });
  return cursorMoveDisposable;
}

// -----------------------------------------------------------------------------
// Status Bar
// -----------------------------------------------------------------------------

let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Create and show the status bar item.
 */
export function createStatusBar(): vscode.StatusBarItem {
  if (statusBarItem) {
    return statusBarItem;
  }

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "vim-mentor.dashboard";
  updateStatusBar();
  statusBarItem.show();

  return statusBarItem;
}

/**
 * Update the status bar with current level and streak info.
 */
export function updateStatusBar(): void {
  if (!statusBarItem) {
    return;
  }

  const config = getConfig();
  const streak = feedback.getStreak();
  const levelName =
    LEARNING_LEVEL_NAMES[config.learningLevel] ?? "Unknown";
  const modeName =
    TEACHING_MODE_NAMES[config.teachingMode] ?? "Unknown";

  let text = `$(book) Lv.${config.learningLevel}:${levelName}`;
  if (streak > 0) {
    text += ` $(flame)${streak}`;
  }

  statusBarItem.text = text;
  statusBarItem.tooltip = `Vim Mentor - Teaching Mode: ${modeName}\nClick to open dashboard`;
}

// -----------------------------------------------------------------------------
// Blocking Mode UI (Strict / Master)
// -----------------------------------------------------------------------------

/**
 * Show a blocking input box that requires the user to type the correct
 * Vim command before the editor action proceeds.
 *
 * Returns true if the user entered the correct command, false if they
 * dismissed the input.
 */
async function showBlockingInput(
  suggestion: SuggestionResult
): Promise<boolean> {
  const correctCommand = suggestion.primary.command;
  // Extract the first key/command token for matching
  // e.g., "{count}j" -> "j", "Ctrl-u" -> "ctrl-u", "w" -> "w"
  const acceptableInputs = parseAcceptableInputs(correctCommand);

  const result = await vscode.window.showInputBox({
    prompt: `Vim Mentor: Instead of ${suggestion.detectedName}, type the correct Vim command`,
    placeHolder: correctCommand,
    title: `Vim Mentor - Type: ${correctCommand}`,
    validateInput: (value) => {
      const normalized = value.trim().toLowerCase();
      if (normalized.length === 0) {
        return `Type the correct Vim command: ${correctCommand}`;
      }
      if (!acceptableInputs.some((a) => a === normalized)) {
        return `Not quite. The correct command is: ${correctCommand}`;
      }
      return null; // Valid
    },
  });

  if (result !== undefined) {
    const normalized = result.trim().toLowerCase();
    if (acceptableInputs.some((a) => a === normalized)) {
      return true;
    }
  }
  return false;
}

/**
 * Parse the correct command string into an array of acceptable user inputs.
 * For example, "j / k" -> ["j", "k"], "Ctrl-u" -> ["ctrl-u"], "w" -> ["w"].
 * "{count}j" -> ["j"], "0 or ^" -> ["0", "^"]
 */
function parseAcceptableInputs(command: string): string[] {
  const inputs: string[] = [];

  // Split by common separators: " / ", " or ", ", "
  const parts = command.split(/\s*(?:\/|or|,)\s*/);

  for (const part of parts) {
    // Remove {count} prefix, {char} suffix, etc.
    let cleaned = part
      .replace(/\{[^}]+\}/g, "")
      .trim()
      .toLowerCase();

    if (cleaned.length > 0) {
      inputs.push(cleaned);
    }
  }

  // Also add the full command lowered as acceptable
  const fullLowered = command.toLowerCase().replace(/\{[^}]+\}/g, "").trim();
  if (fullLowered.length > 0 && !inputs.includes(fullLowered)) {
    inputs.push(fullLowered);
  }

  return inputs;
}

// -----------------------------------------------------------------------------
// Delay Mode UI (Moderate)
// -----------------------------------------------------------------------------

/**
 * Show the suggestion with a delay before executing the fallback command.
 */
async function showWithDelay(
  editor: vscode.TextEditor,
  suggestion: SuggestionResult,
  delayMs: number
): Promise<void> {
  // Show the hint immediately
  showVirtualText(editor, suggestion);
  vscode.window.showInformationMessage(formatMessage(suggestion));

  // Delay before executing the fallback
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

  // Execute the original action after the delay
  if (suggestion.fallbackCommand) {
    await vscode.commands.executeCommand(suggestion.fallbackCommand);
  }

  // Clear virtual text
  clearVirtualText();
}

// -----------------------------------------------------------------------------
// Main UI Entry Point
// -----------------------------------------------------------------------------

/**
 * Handle a detected non-Vim operation by showing the appropriate UI
 * based on the current teaching mode.
 *
 * @param suggestion - The generated suggestion
 * @param teachingMode - Current teaching strictness level
 * @returns Whether the fallback (original) action should be executed
 */
export async function handleDetection(
  suggestion: SuggestionResult,
  teachingMode: TeachingMode
): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return true;
  }

  // Record the failure
  feedback.recordFailure(suggestion.primary.command);

  // Update status bar
  updateStatusBar();

  switch (teachingMode) {
    // ---- Level 1: Gentle - hint only, allow the action ----
    case 1: {
      showVirtualText(editor, suggestion);
      vscode.window.showInformationMessage(formatMessage(suggestion));
      return true; // Allow the fallback action
    }

    // ---- Level 2: Moderate - hint + delay ----
    case 2: {
      showVirtualText(editor, suggestion);
      vscode.window.showInformationMessage(formatMessage(suggestion));
      // Delay for 1 second before allowing the action
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      return true; // Allow after delay
    }

    // ---- Level 3: Strict - block until correct input ----
    case 3: {
      showVirtualText(editor, suggestion);
      const correct = await showBlockingInput(suggestion);
      clearVirtualText();
      if (correct) {
        feedback.recordSuccess(suggestion.primary.command);
        resetRepeatTracker();
        updateStatusBar();
      }
      // In strict mode, execute the fallback only if user got it right
      return correct;
    }

    // ---- Level 4: Master - minimal UI + block ----
    case 4: {
      // Only virtual text, no popup
      showVirtualText(editor, suggestion);
      const correct = await showBlockingInput(suggestion);
      clearVirtualText();
      if (correct) {
        feedback.recordSuccess(suggestion.primary.command);
        resetRepeatTracker();
        updateStatusBar();
      }
      return correct;
    }

    default:
      return true;
  }
}

// -----------------------------------------------------------------------------
// Disposal
// -----------------------------------------------------------------------------

const disposables: vscode.Disposable[] = [];

export function activate(): vscode.Disposable[] {
  disposables.push(setupCursorMoveListener());
  return disposables;
}

export function dispose(): void {
  clearVirtualText();
  virtualTextDecoration.dispose();
  statusBarItem?.dispose();
  cursorMoveDisposable?.dispose();
  for (const d of disposables) {
    d.dispose();
  }
}
