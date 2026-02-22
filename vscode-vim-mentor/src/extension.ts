// =============================================================================
// extension.ts
// Main entry point for the Vim Mentor VS Code extension.
// Registers commands, activates detection, and manages lifecycle.
//
// IMPORTANT: This extension works INDEPENDENTLY of any Vim extension.
// It teaches Vim keybindings to people using VS Code's normal editing mode.
// =============================================================================

import * as vscode from "vscode";
import {
  getConfig,
  syncContextKeys,
  updateConfig,
  TEACHING_MODE_NAMES,
  LEARNING_LEVEL_NAMES,
  type TeachingMode,
  type LearningLevel,
} from "./config";
import * as detector from "./detector";
import * as ui from "./ui";
import * as storage from "./storage";
import * as feedback from "./feedback";
import * as dashboard from "./dashboard";

// =============================================================================
// Activation
// =============================================================================

export function activate(context: vscode.ExtensionContext): void {
  // Initialize storage with extension's global state
  storage.init(context.globalState);

  // Set up context keys for keybinding `when` clauses
  syncContextKeys();

  // Register keybinding intercept commands (arrow keys, home/end, etc.)
  detector.registerInterceptCommands(context);

  // Create status bar
  const statusBarItem = ui.createStatusBar();
  context.subscriptions.push(statusBarItem);

  // Activate UI listeners
  const uiDisposables = ui.activate();
  for (const d of uiDisposables) {
    context.subscriptions.push(d);
  }

  // ---- Register user-facing commands ----

  // Enable
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.enable", () => {
      detector.enable();
      vscode.window.showInformationMessage("Vim Mentor: Enabled");
    })
  );

  // Disable
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.disable", () => {
      detector.disable();
      vscode.window.showInformationMessage("Vim Mentor: Disabled");
    })
  );

  // Toggle
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.toggle", () => {
      detector.toggle();
      const state = detector.isEnabled() ? "Enabled" : "Disabled";
      vscode.window.showInformationMessage(`Vim Mentor: ${state}`);
    })
  );

  // Set Learning Level
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.setLevel", async () => {
      const items: vscode.QuickPickItem[] = [
        {
          label: "Level 1: Beginner",
          description: "Basic hjkl movement, gg/G",
          detail: "Arrow keys -> hjkl, file top/bottom",
        },
        {
          label: "Level 2: Elementary",
          description: "Word motion, line boundaries, counts",
          detail: "w/b/e, 0/^/$, {count}j/k, Home/End alternatives",
        },
        {
          label: "Level 3: Intermediate",
          description: "Search, screen navigation, scrolling",
          detail: "/pattern, H/M/L, Ctrl-d/u, PageUp/Down alternatives",
        },
        {
          label: "Level 4: Advanced",
          description: "Precision movement, marks, jump lists",
          detail: "f/t, marks, Ctrl-o/i, text objects",
        },
        {
          label: "Level 5: Expert",
          description: "All motions, composability mastery",
          detail: "Full motion vocabulary, operator + motion combos",
        },
      ];

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "Select your learning level",
        title: "Vim Mentor: Set Learning Level",
      });

      if (picked) {
        const level = parseInt(picked.label.charAt(6), 10) as LearningLevel;
        await updateConfig("learningLevel", level);
        await storage.updateLevel(level);
        ui.updateStatusBar();
        vscode.window.showInformationMessage(
          `Vim Mentor: Learning level set to ${level} (${
            LEARNING_LEVEL_NAMES[level]
          })`
        );
      }
    })
  );

  // Set Teaching Mode
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.setMode", async () => {
      const items: vscode.QuickPickItem[] = [
        {
          label: "Mode 1: Gentle",
          description: "Show hint only, action proceeds normally",
          detail: "Best for absolute beginners. Non-intrusive.",
        },
        {
          label: "Mode 2: Moderate",
          description: "Show hint + delay action by 1 second",
          detail:
            "Gives you time to read the suggestion before action executes.",
        },
        {
          label: "Mode 3: Strict",
          description: "Block until you type the correct Vim command",
          detail: "Forces you to learn. Action only proceeds if you get it right.",
        },
        {
          label: "Mode 4: Master",
          description: "Minimal UI + block until correct",
          detail: "For advanced practice. Minimal visual feedback.",
        },
      ];

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "Select teaching mode",
        title: "Vim Mentor: Set Teaching Mode",
      });

      if (picked) {
        const mode = parseInt(picked.label.charAt(5), 10) as TeachingMode;
        await updateConfig("teachingMode", mode);
        ui.updateStatusBar();
        vscode.window.showInformationMessage(
          `Vim Mentor: Teaching mode set to ${TEACHING_MODE_NAMES[mode]}`
        );
      }
    })
  );

  // Dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.dashboard", () => {
      dashboard.openDashboard(context.extensionUri);
    })
  );

  // Reset Progress
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-mentor.reset", async () => {
      const confirm = await vscode.window.showWarningMessage(
        "Vim Mentor: Reset all progress data? This cannot be undone.",
        { modal: true },
        "Reset"
      );

      if (confirm === "Reset") {
        await storage.resetAll();
        feedback.resetSession();
        ui.updateStatusBar();
        vscode.window.showInformationMessage(
          "Vim Mentor: All progress has been reset."
        );
      }
    })
  );

  // ---- Configuration change listener ----
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("vim-mentor")) {
        syncContextKeys();
        detector.refresh();
        ui.updateStatusBar();
      }
    })
  );

  // ---- Auto-advance listener ----
  // Check periodically (or on each recording) whether to auto-advance
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("vim-mentor.learningLevel")) {
        ui.updateStatusBar();
      }
    })
  );

  // ---- Auto-enable on startup ----
  detector.enable();

  // ---- Save session on deactivation ----
  context.subscriptions.push({
    dispose: () => {
      const stats = feedback.getStats();
      const sessionStart = feedback.getSessionStart();
      const durationMinutes = Math.floor(
        (Date.now() - sessionStart) / 60000
      );

      if (stats.totalCorrect > 0 || stats.totalIncorrect > 0) {
        storage.saveSession({
          date: new Date().toISOString().split("T")[0],
          correct: stats.totalCorrect,
          incorrect: stats.totalIncorrect,
          bestStreak: stats.streak,
          durationMinutes,
        });
      }

      // Check auto-advance
      checkAutoAdvance();
    },
  });

  vscode.window.showInformationMessage(
    "Vim Mentor is active! Use arrow keys and get Vim suggestions."
  );
}

// =============================================================================
// Auto-Advance
// =============================================================================

async function checkAutoAdvance(): Promise<void> {
  const config = getConfig();
  if (!config.autoAdvance) {
    return;
  }

  const data = storage.load();
  const threshold = config.advanceThreshold;

  if (
    data.lifetime.correct >= threshold * config.learningLevel &&
    config.learningLevel < 5
  ) {
    const newLevel = (config.learningLevel + 1) as LearningLevel;
    await updateConfig("learningLevel", newLevel);
    await storage.updateLevel(newLevel);
    vscode.window.showInformationMessage(
      `Vim Mentor: Congratulations! You advanced to Level ${newLevel} (${
        LEARNING_LEVEL_NAMES[newLevel]
      })!`
    );
  }
}

// =============================================================================
// Deactivation
// =============================================================================

export function deactivate(): void {
  detector.dispose();
  ui.dispose();
  feedback.dispose();
  dashboard.dispose();
}
