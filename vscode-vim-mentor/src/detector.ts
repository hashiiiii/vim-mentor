// =============================================================================
// detector.ts
// Detects non-Vim operations in VS Code.
//
// Strategy:
//   - Arrow keys, Home/End, Page keys, Ctrl+Arrow: intercepted via keybinding
//     overrides defined in package.json. Each keybinding routes to a command
//     registered here (e.g., vim-mentor.interceptArrowDown).
//   - Mouse clicks: detected via onDidChangeTextEditorSelection with
//     TextEditorSelectionChangeKind.Mouse.
//
// This module is the glue between the detection events and the suggestion/UI
// pipeline. It does NOT block by itself; it delegates to the UI module for
// the appropriate teaching-mode behavior.
// =============================================================================

import * as vscode from "vscode";
import type { NonVimOperationType } from "./rules";
import { getConfig, isExcludedLanguage } from "./config";
import { generateSuggestion } from "./suggestion";
import { handleDetection, updateStatusBar } from "./ui";

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let enabled = false;
let mouseDetectionDisposable: vscode.Disposable | undefined;

// Tracks whether we are currently processing a detection, to prevent
// re-entrant triggers while a blocking dialog is open.
let processing = false;

// Track previous cursor position for mouse click detection
let previousPosition: vscode.Position | undefined;

// -----------------------------------------------------------------------------
// Core Detection Handler
// -----------------------------------------------------------------------------

/**
 * Main handler called when a non-Vim operation is detected.
 * Generates a suggestion and delegates to the UI layer.
 *
 * @param operationType - The type of non-Vim operation detected
 * @returns Whether the original action should be executed
 */
async function onNonVimDetected(
  operationType: NonVimOperationType
): Promise<boolean> {
  if (!enabled || processing) {
    return true;
  }

  // Check if current language is excluded
  if (isExcludedLanguage()) {
    return true;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return true;
  }

  const config = getConfig();

  const suggestion = generateSuggestion(
    operationType,
    config.learningLevel,
    editor
  );

  if (!suggestion) {
    return true;
  }

  processing = true;
  try {
    const shouldExecuteFallback = await handleDetection(
      suggestion,
      config.teachingMode
    );

    if (shouldExecuteFallback && suggestion.fallbackCommand) {
      await vscode.commands.executeCommand(suggestion.fallbackCommand);
    }
  } finally {
    processing = false;
  }

  return false; // We handled it (either executed fallback ourselves or blocked)
}

// -----------------------------------------------------------------------------
// Keybinding Intercept Commands
// -----------------------------------------------------------------------------

/**
 * Register all intercept commands for arrow keys, Home/End, Page keys, etc.
 * These are triggered by the keybindings defined in package.json.
 */
export function registerInterceptCommands(
  context: vscode.ExtensionContext
): void {
  // Arrow keys
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vim-mentor.interceptArrowUp",
      () => onNonVimDetected("arrow_up")
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vim-mentor.interceptArrowDown",
      () => onNonVimDetected("arrow_down")
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vim-mentor.interceptArrowLeft",
      () => onNonVimDetected("arrow_left")
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vim-mentor.interceptArrowRight",
      () => onNonVimDetected("arrow_right")
    )
  );

  // Home / End
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.interceptHome", () =>
      onNonVimDetected("home")
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.interceptEnd", () =>
      onNonVimDetected("end")
    )
  );

  // Page Up / Page Down
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vim-mentor.interceptPageUp",
      () => onNonVimDetected("page_up")
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vim-mentor.interceptPageDown",
      () => onNonVimDetected("page_down")
    )
  );

  // Ctrl + Arrow
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vim-mentor.interceptCtrlLeft",
      () => onNonVimDetected("ctrl_left")
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vim-mentor.interceptCtrlRight",
      () => onNonVimDetected("ctrl_right")
    )
  );
}

// -----------------------------------------------------------------------------
// Mouse Click Detection
// -----------------------------------------------------------------------------

/**
 * Set up mouse click detection using onDidChangeTextEditorSelection.
 * We look for selection changes caused by Mouse kind.
 */
function setupMouseDetection(): void {
  if (mouseDetectionDisposable) {
    mouseDetectionDisposable.dispose();
  }

  mouseDetectionDisposable = vscode.window.onDidChangeTextEditorSelection(
    async (event) => {
      if (!enabled || processing) {
        return;
      }

      const config = getConfig();
      if (!config.blockedKeys.mouse) {
        // Update previous position even when not blocking
        if (event.selections.length > 0) {
          previousPosition = event.selections[0].active;
        }
        return;
      }

      if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
        // Not a mouse event, just update previous position
        if (event.selections.length > 0) {
          previousPosition = event.selections[0].active;
        }
        return;
      }

      // Check if current language is excluded
      if (isExcludedLanguage()) {
        if (event.selections.length > 0) {
          previousPosition = event.selections[0].active;
        }
        return;
      }

      // Mouse click detected - cursor was repositioned via mouse
      const newPosition = event.selections[0]?.active;
      if (!newPosition) {
        return;
      }

      // Only trigger if the cursor actually moved
      if (
        previousPosition &&
        previousPosition.line === newPosition.line &&
        previousPosition.character === newPosition.character
      ) {
        return;
      }

      previousPosition = newPosition;

      // Generate and handle the suggestion
      await onNonVimDetected("mouse_click");
    }
  );
}

// -----------------------------------------------------------------------------
// Enable / Disable
// -----------------------------------------------------------------------------

/**
 * Enable detection.
 */
export function enable(): void {
  enabled = true;
  vscode.commands.executeCommand("setContext", "vim-mentor.enabled", true);

  const config = getConfig();
  if (config.blockedKeys.mouse) {
    setupMouseDetection();
  }

  updateStatusBar();
}

/**
 * Disable detection.
 */
export function disable(): void {
  enabled = false;
  vscode.commands.executeCommand("setContext", "vim-mentor.enabled", false);

  if (mouseDetectionDisposable) {
    mouseDetectionDisposable.dispose();
    mouseDetectionDisposable = undefined;
  }

  updateStatusBar();
}

/**
 * Toggle detection on/off.
 */
export function toggle(): void {
  if (enabled) {
    disable();
  } else {
    enable();
  }
}

/**
 * Returns whether detection is currently enabled.
 */
export function isEnabled(): boolean {
  return enabled;
}

/**
 * Refresh detection settings (called when configuration changes).
 */
export function refresh(): void {
  if (!enabled) {
    return;
  }

  const config = getConfig();

  // Re-setup mouse detection if the setting changed
  if (config.blockedKeys.mouse) {
    setupMouseDetection();
  } else if (mouseDetectionDisposable) {
    mouseDetectionDisposable.dispose();
    mouseDetectionDisposable = undefined;
  }
}

// -----------------------------------------------------------------------------
// Disposal
// -----------------------------------------------------------------------------

export function dispose(): void {
  disable();
  if (mouseDetectionDisposable) {
    mouseDetectionDisposable.dispose();
  }
}
