// =============================================================================
// config.ts
// Configuration management using VS Code's configuration API.
// Reads user settings and provides typed access throughout the extension.
// =============================================================================

import * as vscode from "vscode";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export type TeachingMode = 1 | 2 | 3 | 4;
export type LearningLevel = 1 | 2 | 3 | 4 | 5;

export const TEACHING_MODE_NAMES: Record<TeachingMode, string> = {
  1: "Gentle",
  2: "Moderate",
  3: "Strict",
  4: "Master",
};

export const LEARNING_LEVEL_NAMES: Record<LearningLevel, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export interface BlockedKeysConfig {
  arrowKeys: boolean;
  mouse: boolean;
  pageKeys: boolean;
  homeEnd: boolean;
  ctrlArrow: boolean;
}

export interface VimMentorConfig {
  teachingMode: TeachingMode;
  learningLevel: LearningLevel;
  autoAdvance: boolean;
  advanceThreshold: number;
  blockedKeys: BlockedKeysConfig;
  excludedLanguages: string[];
}

// -----------------------------------------------------------------------------
// Configuration Reader
// -----------------------------------------------------------------------------

/**
 * Read the current Vim Mentor configuration from VS Code settings.
 */
export function getConfig(): VimMentorConfig {
  const cfg = vscode.workspace.getConfiguration("vim-mentor");

  return {
    teachingMode: (cfg.get<number>("teachingMode") ?? 2) as TeachingMode,
    learningLevel: (cfg.get<number>("learningLevel") ?? 1) as LearningLevel,
    autoAdvance: cfg.get<boolean>("autoAdvance") ?? true,
    advanceThreshold: cfg.get<number>("advanceThreshold") ?? 50,
    blockedKeys: {
      arrowKeys: cfg.get<boolean>("blockedKeys.arrowKeys") ?? true,
      mouse: cfg.get<boolean>("blockedKeys.mouse") ?? false,
      pageKeys: cfg.get<boolean>("blockedKeys.pageKeys") ?? true,
      homeEnd: cfg.get<boolean>("blockedKeys.homeEnd") ?? true,
      ctrlArrow: cfg.get<boolean>("blockedKeys.ctrlArrow") ?? true,
    },
    excludedLanguages: cfg.get<string[]>("excludedLanguages") ?? [],
  };
}

/**
 * Update a specific configuration value.
 */
export async function updateConfig<K extends keyof VimMentorConfig>(
  key: K,
  value: VimMentorConfig[K]
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("vim-mentor");
  await cfg.update(key, value, vscode.ConfigurationTarget.Global);
}

/**
 * Check if the active editor's language is in the excluded list.
 */
export function isExcludedLanguage(): boolean {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return false;
  }
  const languageId = editor.document.languageId;
  const config = getConfig();
  return config.excludedLanguages.includes(languageId);
}

/**
 * Sync the VS Code context variables used by `when` clauses in keybindings.
 * Called on activation and whenever relevant config changes.
 */
export function syncContextKeys(): void {
  const config = getConfig();
  vscode.commands.executeCommand(
    "setContext",
    "vim-mentor.blockArrowKeys",
    config.blockedKeys.arrowKeys
  );
  vscode.commands.executeCommand(
    "setContext",
    "vim-mentor.blockPageKeys",
    config.blockedKeys.pageKeys
  );
  vscode.commands.executeCommand(
    "setContext",
    "vim-mentor.blockHomeEnd",
    config.blockedKeys.homeEnd
  );
  vscode.commands.executeCommand(
    "setContext",
    "vim-mentor.blockCtrlArrow",
    config.blockedKeys.ctrlArrow
  );
}
