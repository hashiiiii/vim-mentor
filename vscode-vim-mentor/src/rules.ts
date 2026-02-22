// =============================================================================
// rules.ts
// Maps non-Vim operations to Vim command suggestions.
// Ported from the Neovim plugin's rule system and vim_motion_knowledge.ts.
// =============================================================================

import type { LearningLevel } from "./config";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export type NonVimOperationType =
  | "arrow_up"
  | "arrow_down"
  | "arrow_left"
  | "arrow_right"
  | "home"
  | "end"
  | "page_up"
  | "page_down"
  | "ctrl_left"
  | "ctrl_right"
  | "mouse_click";

export interface VimSuggestion {
  /** The Vim command string */
  command: string;
  /** Human-readable description */
  description: string;
  /** Minimum learning level to show this suggestion */
  level: LearningLevel;
  /** Why this is better than the non-Vim operation */
  whyBetter: string;
}

export interface DetectionContext {
  /** How many times the same key was pressed consecutively */
  repeatCount: number;
  /** Current line number (0-based) */
  currentLine: number;
  /** Total lines in the document */
  totalLines: number;
  /** Current column (0-based) */
  currentCol: number;
  /** Total columns in the current line */
  lineLength: number;
}

export interface Rule {
  /** The type of non-Vim operation this rule covers */
  operationType: NonVimOperationType;
  /** Human-readable name for the detected operation */
  displayName: string;
  /** The VS Code command to execute if we allow the action through */
  fallbackCommand: string;
  /** Base suggestions, always applicable */
  suggestions: VimSuggestion[];
  /** Context-dependent suggestions evaluated at detection time */
  contextualSuggestions: ContextualRule[];
}

export interface ContextualRule {
  /** Human-readable condition description */
  condition: string;
  /** Returns true if this contextual rule applies */
  check: (ctx: DetectionContext) => boolean;
  /** The suggestion to show when this rule matches */
  suggestion: VimSuggestion;
}

// -----------------------------------------------------------------------------
// Rule Definitions
// -----------------------------------------------------------------------------

export const RULES: Rule[] = [
  // ===========================================================================
  // Arrow Up
  // ===========================================================================
  {
    operationType: "arrow_up",
    displayName: "Arrow Up",
    fallbackCommand: "cursorUp",
    suggestions: [
      {
        command: "k",
        description: "Move up one line",
        level: 1,
        whyBetter: "Home row key. No need to move your hand to the arrow area.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Repeated press (3+ times)",
        check: (ctx) => ctx.repeatCount >= 3,
        suggestion: {
          command: "{count}k",
          description:
            "Use a count prefix for multi-line jumps (e.g., 5k = up 5 lines)",
          level: 2,
          whyBetter:
            "One keystroke combo instead of pressing the arrow key multiple times.",
        },
      },
      {
        condition: "Near file top",
        check: (ctx) => ctx.currentLine <= 3,
        suggestion: {
          command: "gg",
          description: "Jump to the first line of the file",
          level: 1,
          whyBetter: "Instant jump to file top regardless of current position.",
        },
      },
    ],
  },

  // ===========================================================================
  // Arrow Down
  // ===========================================================================
  {
    operationType: "arrow_down",
    displayName: "Arrow Down",
    fallbackCommand: "cursorDown",
    suggestions: [
      {
        command: "j",
        description: "Move down one line",
        level: 1,
        whyBetter: "Home row key. j has a hook that points downward.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Repeated press (3+ times)",
        check: (ctx) => ctx.repeatCount >= 3,
        suggestion: {
          command: "{count}j",
          description:
            "Use a count prefix for multi-line jumps (e.g., 10j = down 10 lines)",
          level: 2,
          whyBetter:
            "One keystroke combo instead of pressing the arrow key multiple times.",
        },
      },
      {
        condition: "Near file bottom",
        check: (ctx) => ctx.totalLines - ctx.currentLine <= 3,
        suggestion: {
          command: "G",
          description: "Jump to the last line of the file",
          level: 1,
          whyBetter:
            "Instant jump to file bottom regardless of current position.",
        },
      },
    ],
  },

  // ===========================================================================
  // Arrow Left
  // ===========================================================================
  {
    operationType: "arrow_left",
    displayName: "Arrow Left",
    fallbackCommand: "cursorLeft",
    suggestions: [
      {
        command: "h",
        description: "Move left one character",
        level: 1,
        whyBetter: "Leftmost key in hjkl. Stays on the home row.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Repeated horizontal press (moving through words)",
        check: (ctx) => ctx.repeatCount >= 4,
        suggestion: {
          command: "b",
          description:
            "Move to the start of the previous word (b = back)",
          level: 2,
          whyBetter:
            "Moving by words is much faster than character-by-character.",
        },
      },
      {
        condition: "At or near line start",
        check: (ctx) => ctx.currentCol <= 1,
        suggestion: {
          command: "0 or ^",
          description:
            "0 = column 0, ^ = first non-blank character",
          level: 2,
          whyBetter: "Single keystroke to reach line beginning.",
        },
      },
    ],
  },

  // ===========================================================================
  // Arrow Right
  // ===========================================================================
  {
    operationType: "arrow_right",
    displayName: "Arrow Right",
    fallbackCommand: "cursorRight",
    suggestions: [
      {
        command: "l",
        description: "Move right one character",
        level: 1,
        whyBetter: "Rightmost key in hjkl. Stays on the home row.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Repeated horizontal press (moving through words)",
        check: (ctx) => ctx.repeatCount >= 4,
        suggestion: {
          command: "w",
          description:
            "Move to the start of the next word (w = word)",
          level: 2,
          whyBetter:
            "Moving by words is much faster than character-by-character.",
        },
      },
      {
        condition: "Near line end",
        check: (ctx) => ctx.lineLength - ctx.currentCol <= 2,
        suggestion: {
          command: "$",
          description: "Move to the end of the line",
          level: 2,
          whyBetter: "Single keystroke to reach line end.",
        },
      },
    ],
  },

  // ===========================================================================
  // Home Key
  // ===========================================================================
  {
    operationType: "home",
    displayName: "Home Key",
    fallbackCommand: "cursorHome",
    suggestions: [
      {
        command: "0",
        description: "Move to column 0 (absolute beginning of line)",
        level: 2,
        whyBetter:
          "Single home-row keystroke. No need to reach for the Home key.",
      },
      {
        command: "^",
        description:
          "Move to first non-blank character (smart home)",
        level: 2,
        whyBetter:
          "Usually more useful than 0 for indented code. Skips leading whitespace.",
      },
    ],
    contextualSuggestions: [],
  },

  // ===========================================================================
  // End Key
  // ===========================================================================
  {
    operationType: "end",
    displayName: "End Key",
    fallbackCommand: "cursorEnd",
    suggestions: [
      {
        command: "$",
        description: "Move to end of line",
        level: 2,
        whyBetter:
          "Single keystroke. Stays on home row. Replaces End key.",
      },
    ],
    contextualSuggestions: [],
  },

  // ===========================================================================
  // Page Up
  // ===========================================================================
  {
    operationType: "page_up",
    displayName: "Page Up",
    fallbackCommand: "cursorPageUp",
    suggestions: [
      {
        command: "Ctrl-u",
        description: "Scroll half page up",
        level: 3,
        whyBetter:
          "Half-page scroll keeps context. Easier to track position.",
      },
      {
        command: "Ctrl-b",
        description: "Scroll full page backward",
        level: 3,
        whyBetter: "Exact equivalent of PageUp with home-row accessible chord.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Scrolling to view surrounding code",
        check: () => true,
        suggestion: {
          command: "Ctrl-y",
          description:
            "Scroll viewport up one line without moving cursor",
          level: 3,
          whyBetter: "Fine-grained scrolling not available with PageUp.",
        },
      },
    ],
  },

  // ===========================================================================
  // Page Down
  // ===========================================================================
  {
    operationType: "page_down",
    displayName: "Page Down",
    fallbackCommand: "cursorPageDown",
    suggestions: [
      {
        command: "Ctrl-d",
        description: "Scroll half page down",
        level: 3,
        whyBetter:
          "Half-page scroll keeps context. Easier to track position.",
      },
      {
        command: "Ctrl-f",
        description: "Scroll full page forward",
        level: 3,
        whyBetter:
          "Exact equivalent of PageDown with home-row accessible chord.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Scrolling to view surrounding code",
        check: () => true,
        suggestion: {
          command: "Ctrl-e",
          description:
            "Scroll viewport down one line without moving cursor",
          level: 3,
          whyBetter: "Fine-grained scrolling not available with PageDown.",
        },
      },
    ],
  },

  // ===========================================================================
  // Ctrl + Left Arrow (word jump backward)
  // ===========================================================================
  {
    operationType: "ctrl_left",
    displayName: "Ctrl + Left Arrow",
    fallbackCommand: "cursorWordLeft",
    suggestions: [
      {
        command: "b",
        description:
          "Move to previous word start (b = back)",
        level: 2,
        whyBetter:
          "Simpler key. Also composable with operators (db = delete back one word).",
      },
      {
        command: "B",
        description:
          "Move to previous WORD start (whitespace-delimited)",
        level: 2,
        whyBetter:
          "WORD motion treats punctuated tokens as single units. Consistent behavior.",
      },
    ],
    contextualSuggestions: [],
  },

  // ===========================================================================
  // Ctrl + Right Arrow (word jump forward)
  // ===========================================================================
  {
    operationType: "ctrl_right",
    displayName: "Ctrl + Right Arrow",
    fallbackCommand: "cursorWordRight",
    suggestions: [
      {
        command: "w",
        description:
          "Move to next word start (w = word)",
        level: 2,
        whyBetter:
          "Simpler key. Also composable with operators (dw = delete word).",
      },
      {
        command: "W",
        description:
          "Move to next WORD start (whitespace-delimited)",
        level: 2,
        whyBetter:
          "WORD motion treats punctuated tokens as single units. Consistent behavior.",
      },
      {
        command: "e / E",
        description:
          "Move to end of word (e) or WORD (E)",
        level: 2,
        whyBetter:
          "Useful when you need cursor at the end, not start, of a word.",
      },
    ],
    contextualSuggestions: [],
  },

  // ===========================================================================
  // Mouse Click (cursor positioning)
  // ===========================================================================
  {
    operationType: "mouse_click",
    displayName: "Mouse Click",
    fallbackCommand: "",
    suggestions: [
      {
        command: "/{pattern}",
        description: "Search for text at target location",
        level: 3,
        whyBetter:
          "Precise semantic targeting. Works across entire file.",
      },
      {
        command: "{line}G",
        description: "Jump directly to a specific line number",
        level: 2,
        whyBetter:
          "Direct line jump. No need for mouse.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Click to jump to definition",
        check: () => true,
        suggestion: {
          command: "gd (in Vim) / F12 then learn gd",
          description:
            "Go to definition. Learn keyboard-based navigation.",
          level: 4,
          whyBetter:
            "Semantic navigation understands code, not just screen position.",
        },
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// Lookup Helpers
// -----------------------------------------------------------------------------

/**
 * Find the rule for a given non-Vim operation type.
 */
export function findRule(
  operationType: NonVimOperationType
): Rule | undefined {
  return RULES.find((r) => r.operationType === operationType);
}

/**
 * Get the best suggestion for a given operation, considering context and
 * the user's current learning level.
 */
export function getBestSuggestion(
  operationType: NonVimOperationType,
  context: DetectionContext,
  userLevel: LearningLevel
): VimSuggestion | undefined {
  const rule = findRule(operationType);
  if (!rule) {
    return undefined;
  }

  // Check contextual suggestions first (higher priority)
  for (const cr of rule.contextualSuggestions) {
    if (cr.check(context) && cr.suggestion.level <= userLevel) {
      return cr.suggestion;
    }
  }

  // Fall back to base suggestions, filter by level
  const eligible = rule.suggestions.filter((s) => s.level <= userLevel);
  return eligible.length > 0 ? eligible[0] : rule.suggestions[0];
}

/**
 * Get all applicable suggestions for a detection, ordered by relevance.
 */
export function getAllSuggestions(
  operationType: NonVimOperationType,
  context: DetectionContext,
  userLevel: LearningLevel
): VimSuggestion[] {
  const rule = findRule(operationType);
  if (!rule) {
    return [];
  }

  const results: VimSuggestion[] = [];

  // Contextual suggestions first
  for (const cr of rule.contextualSuggestions) {
    if (cr.check(context) && cr.suggestion.level <= userLevel) {
      results.push(cr.suggestion);
    }
  }

  // Base suggestions
  for (const s of rule.suggestions) {
    if (s.level <= userLevel) {
      results.push(s);
    }
  }

  // If nothing matched the level filter, include the primary suggestion anyway
  if (results.length === 0 && rule.suggestions.length > 0) {
    results.push(rule.suggestions[0]);
  }

  return results;
}
