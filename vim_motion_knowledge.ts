// =============================================================================
// vim_motion_knowledge.ts
// Vim Motion Knowledge Base for "Non-Vim Operation Detection" Module
// =============================================================================

// -----------------------------------------------------------------------------
// 1. Type Definitions
// -----------------------------------------------------------------------------

/** Vim command difficulty / learning level */
export type VimLevel = 1 | 2 | 3 | 4;

/** Category of the non-Vim operation detected */
export type NonVimOperationType =
  | "arrow_key_vertical"
  | "arrow_key_horizontal"
  | "home_end"
  | "page_updown"
  | "mouse_click"
  | "ctrl_arrow"
  | "search_dialog"
  | "ctrl_backspace"
  | "ctrl_delete"
  | "mouse_scroll"
  | "mouse_selection"
  | "tab_switching";

/** Context that affects which Vim command should be suggested */
export interface MotionContext {
  /** How many times the same key was pressed consecutively */
  repeatCount: number;
  /** Target line number (if known) */
  targetLine?: number;
  /** Current line number */
  currentLine?: number;
  /** Whether the user is trying to reach beginning/end of file */
  isFileEdge?: "top" | "bottom";
  /** Whether there's a specific character or word being targeted */
  targetPattern?: string;
  /** Current Vim mode */
  currentMode: "normal" | "insert" | "visual" | "command";
}

/** A single Vim command suggestion */
export interface VimSuggestion {
  /** The Vim command string */
  command: string;
  /** Human-readable description */
  description: string;
  /** Learning level required */
  level: VimLevel;
  /** Usage example */
  example: string;
  /** Why this command is better than the non-Vim operation */
  whyBetter: string;
}

/** Mapping entry: non-Vim operation -> array of Vim suggestions (ordered by priority) */
export interface OperationMapping {
  nonVimOperation: NonVimOperationType;
  displayName: string;
  detectionMethod: string;
  suggestions: VimSuggestion[];
  contextualSuggestions: ContextualSuggestion[];
}

/** Context-dependent suggestion that activates under certain conditions */
export interface ContextualSuggestion {
  condition: string;
  conditionCheck: (ctx: MotionContext) => boolean;
  suggestion: VimSuggestion;
}

// -----------------------------------------------------------------------------
// 2. Non-Vim Operation -> Vim Command Mapping (Complete Table)
// -----------------------------------------------------------------------------

export const OPERATION_MAPPINGS: OperationMapping[] = [
  // =========================================================================
  // Arrow Key Vertical (Up/Down)
  // =========================================================================
  {
    nonVimOperation: "arrow_key_vertical",
    displayName: "Arrow Key (Up/Down)",
    detectionMethod:
      "Detect <Up>/<Down> key events in normal/visual mode. " +
      "In terminal Vim, these produce escape sequences (e.g., \\e[A, \\e[B). " +
      "Can be intercepted via noremap <Up>/<Down> mappings.",
    suggestions: [
      {
        command: "j / k",
        description: "Basic line movement: j = down, k = up",
        level: 1,
        example: "Press 'j' to move one line down, 'k' to move one line up",
        whyBetter:
          "Fingers stay on home row. No need to move hand to arrow key area.",
      },
      {
        command: "gj / gk",
        description:
          "Move by display lines (useful for wrapped lines)",
        level: 2,
        example:
          "When a long line wraps, 'gj' moves to the next visual line within the same logical line",
        whyBetter:
          "More intuitive behavior on wrapped lines than arrow keys, which also move by display line.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Repeated press (3+ times in same direction)",
        conditionCheck: (ctx) => ctx.repeatCount >= 3,
        suggestion: {
          command: "{count}j / {count}k",
          description: "Use a count prefix for multi-line jumps",
          level: 2,
          example:
            "'5j' moves 5 lines down. Enable 'set relativenumber' to see line offsets.",
          whyBetter:
            "One keystroke combo instead of pressing arrow key multiple times. " +
            "Use ':set relativenumber' to see exact counts at a glance.",
        },
      },
      {
        condition: "Moving to a specific known line number",
        conditionCheck: (ctx) => ctx.targetLine !== undefined,
        suggestion: {
          command: "{line}G or :{line}",
          description: "Jump directly to a specific line number",
          level: 2,
          example: "'42G' or ':42<Enter>' to jump to line 42",
          whyBetter:
            "Instant jump regardless of distance. No counting required.",
        },
      },
      {
        condition: "Moving to file top or bottom",
        conditionCheck: (ctx) => ctx.isFileEdge !== undefined,
        suggestion: {
          command: "gg / G",
          description: "Jump to first line (gg) or last line (G) of file",
          level: 1,
          example: "'gg' = file top, 'G' = file bottom",
          whyBetter:
            "Instant jump to file edges regardless of file size.",
        },
      },
      {
        condition: "Moving to visible screen position (top/middle/bottom)",
        conditionCheck: (_ctx) => true, // Always suggest as advanced option
        suggestion: {
          command: "H / M / L",
          description:
            "Jump to High (top), Middle, or Low (bottom) of visible screen",
          level: 3,
          example: "'H' = screen top, 'M' = screen middle, 'L' = screen bottom",
          whyBetter:
            "Jump within visible area without counting lines.",
        },
      },
      {
        condition: "Paragraph-level navigation",
        conditionCheck: (_ctx) => true,
        suggestion: {
          command: "{ / }",
          description:
            "Jump to previous/next empty line (paragraph boundary)",
          level: 3,
          example:
            "'}' jumps to the next blank line. Great for code with function separators.",
          whyBetter:
            "Semantic movement by code blocks rather than fixed line counts.",
        },
      },
    ],
  },

  // =========================================================================
  // Arrow Key Horizontal (Left/Right)
  // =========================================================================
  {
    nonVimOperation: "arrow_key_horizontal",
    displayName: "Arrow Key (Left/Right)",
    detectionMethod:
      "Detect <Left>/<Right> key events. " +
      "Escape sequences: \\e[D (left), \\e[C (right). " +
      "Intercepted via noremap <Left>/<Right> mappings.",
    suggestions: [
      {
        command: "h / l",
        description: "Basic character movement: h = left, l = right",
        level: 1,
        example: "'h' moves one character left, 'l' moves one character right",
        whyBetter:
          "Home row keys. Character-level movement stays precise.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Repeated horizontal press (moving through words)",
        conditionCheck: (ctx) => ctx.repeatCount >= 4,
        suggestion: {
          command: "w / b / e",
          description:
            "Word-level movement: w = next word start, b = previous word start, e = word end",
          level: 2,
          example:
            "'w' jumps forward one word, 'b' jumps back one word, 'e' to end of word",
          whyBetter:
            "Moving by words is much faster than moving character by character.",
        },
      },
      {
        condition: "Trying to reach a specific character on the line",
        conditionCheck: (ctx) => ctx.targetPattern !== undefined,
        suggestion: {
          command: "f{char} / F{char} / t{char} / T{char}",
          description:
            "Jump to (f/F) or until (t/T) a specific character on the current line",
          level: 4,
          example:
            "'f(' jumps to the next '(' on this line. " +
            "';' repeats the search forward, ',' repeats backward.",
          whyBetter:
            "Pinpoint precision. One jump instead of multiple character movements.",
        },
      },
    ],
  },

  // =========================================================================
  // Home / End Keys
  // =========================================================================
  {
    nonVimOperation: "home_end",
    displayName: "Home / End Key",
    detectionMethod:
      "Detect <Home>/<End> key events. " +
      "Vim notation: <Home> and <End>. " +
      "Can be mapped: noremap <Home> / noremap <End>.",
    suggestions: [
      {
        command: "0",
        description: "Move to column 0 (absolute beginning of line)",
        level: 2,
        example: "'0' moves to the very first column of the line",
        whyBetter:
          "Single home-row keystroke. No need to reach for the Home key.",
      },
      {
        command: "^",
        description:
          "Move to first non-blank character of line (smart home)",
        level: 2,
        example:
          "On '    function foo()', '^' jumps to 'f', not the leading spaces",
        whyBetter:
          "Usually more useful than '0' for indented code. " +
          "Most editors' Home key behavior actually matches '^'.",
      },
      {
        command: "$",
        description: "Move to end of line",
        level: 2,
        example: "'$' moves to the last character on the current line",
        whyBetter:
          "Single keystroke. Stays on home row. Replaces End key.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "In insert mode, wanting to jump to line start/end",
        conditionCheck: (ctx) => ctx.currentMode === "insert",
        suggestion: {
          command: "<Esc>^ or <Esc>A",
          description:
            "Exit insert mode, jump to line start (^) or append at end (A)",
          level: 2,
          example:
            "Press Esc then '^' to go to first non-blank, or 'I' to insert at line start. " +
            "'A' appends at line end.",
          whyBetter:
            "Embraces modal editing. I = insert at line start, A = append at line end.",
        },
      },
    ],
  },

  // =========================================================================
  // Page Up / Page Down
  // =========================================================================
  {
    nonVimOperation: "page_updown",
    displayName: "Page Up / Page Down",
    detectionMethod:
      "Detect <PageUp>/<PageDown> key events. " +
      "Vim notation: <PageUp>, <PageDown>. " +
      "Can be mapped via noremap.",
    suggestions: [
      {
        command: "Ctrl-d / Ctrl-u",
        description: "Scroll half page down (Ctrl-d) / half page up (Ctrl-u)",
        level: 3,
        example:
          "Ctrl-d scrolls down half a screen. Keeps more context visible than full-page scroll.",
        whyBetter:
          "Half-page scroll keeps context. Easier to track position than full-page jump.",
      },
      {
        command: "Ctrl-f / Ctrl-b",
        description:
          "Scroll full page forward (Ctrl-f) / full page backward (Ctrl-b)",
        level: 3,
        example: "Ctrl-f = full page down, Ctrl-b = full page up",
        whyBetter:
          "Exact equivalent of PageUp/Down but with home-row accessible chords.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Scrolling while keeping cursor on same relative screen position",
        conditionCheck: (_ctx) => true,
        suggestion: {
          command: "Ctrl-e / Ctrl-y",
          description:
            "Scroll screen one line down (Ctrl-e) / one line up (Ctrl-y) without moving cursor",
          level: 3,
          example:
            "Ctrl-e scrolls viewport down one line. Cursor stays where it is.",
          whyBetter:
            "Fine-grained scrolling control not available with PageUp/Down.",
        },
      },
      {
        condition: "Centering current line on screen",
        conditionCheck: (_ctx) => true,
        suggestion: {
          command: "zz / zt / zb",
          description:
            "Center current line (zz), move to top (zt), or bottom (zb) of screen",
          level: 3,
          example:
            "'zz' centers the current line in the viewport. Great after a search jump.",
          whyBetter:
            "Precise viewport control. No equivalent with traditional Page keys.",
        },
      },
    ],
  },

  // =========================================================================
  // Mouse Click (Cursor Positioning)
  // =========================================================================
  {
    nonVimOperation: "mouse_click",
    displayName: "Mouse Click (Cursor Movement)",
    detectionMethod:
      "Detect <LeftMouse> events. Requires 'set mouse=a' to be enabled. " +
      "Can intercept via: noremap <LeftMouse> or autocmd. " +
      "Mouse events produce Xterm escape sequences when mouse tracking is enabled. " +
      "NOTE: Detection depends on terminal emulator supporting mouse protocol (xterm, SGR).",
    suggestions: [
      {
        command: "/{pattern}",
        description: "Search for text at target location",
        level: 3,
        example:
          "'/functionName' jumps to 'functionName'. Press 'n' for next match, 'N' for previous.",
        whyBetter:
          "Precise semantic targeting. Works across entire file, not just visible area.",
      },
      {
        command: "* / #",
        description:
          "Search for word under cursor forward (*) or backward (#)",
        level: 3,
        example:
          "Place cursor on 'myVar', press '*' to find next occurrence of 'myVar'",
        whyBetter:
          "Instantly search for the current word without typing it.",
      },
      {
        command: "{line}G then f{char}",
        description: "Combine line jump with in-line character find",
        level: 4,
        example:
          "'42Gfi' jumps to line 42, then finds the first 'i' on that line",
        whyBetter:
          "Two-step precision targeting replaces imprecise mouse click.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Clicking on a visible line on screen",
        conditionCheck: (_ctx) => true,
        suggestion: {
          command: "H/M/L + {count}j/k + f{char}",
          description:
            "Jump to screen area, fine-tune with line count, then find character",
          level: 4,
          example:
            "'L5kfa' = go to screen bottom, up 5 lines, find 'a'",
          whyBetter:
            "Composable movement that becomes faster than mouse with practice.",
        },
      },
      {
        condition: "Clicking to jump to a function/class definition",
        conditionCheck: (_ctx) => true,
        suggestion: {
          command: "gd / gD / Ctrl-]",
          description:
            "Go to local definition (gd), global definition (gD), or tag (Ctrl-])",
          level: 4,
          example:
            "Cursor on 'myFunction', press 'gd' to jump to its definition",
          whyBetter:
            "Semantic navigation. Understands code structure, not just screen position.",
        },
      },
    ],
  },

  // =========================================================================
  // Ctrl + Arrow Keys (Word Movement)
  // =========================================================================
  {
    nonVimOperation: "ctrl_arrow",
    displayName: "Ctrl + Arrow Keys (Word Jump)",
    detectionMethod:
      "Detect <C-Left>/<C-Right> key events. " +
      "Terminal escape sequences vary by emulator. " +
      "Common: \\e[1;5D (Ctrl-Left), \\e[1;5C (Ctrl-Right). " +
      "Can be mapped: noremap <C-Left> / noremap <C-Right>.",
    suggestions: [
      {
        command: "w / b",
        description:
          "Word movement: w = next word start, b = previous word start",
        level: 2,
        example: "'w' advances to the start of the next word, 'b' goes back",
        whyBetter:
          "Simpler keys. Also composable with operators (dw = delete word).",
      },
      {
        command: "W / B",
        description:
          "WORD movement (whitespace-delimited): W = next WORD, B = previous WORD",
        level: 2,
        example:
          "On 'foo-bar.baz', 'w' stops at '-' and '.', but 'W' jumps past the entire 'foo-bar.baz'",
        whyBetter:
          "WORD motion treats punctuated tokens as single units. " +
          "Ctrl-Arrow behavior varies by editor; W/B is consistent.",
      },
      {
        command: "e / E",
        description:
          "Move to end of word (e) / end of WORD (E)",
        level: 2,
        example:
          "'e' moves to last character of current/next word",
        whyBetter:
          "Useful when you need the cursor at the end, not start, of a word. " +
          "No Ctrl-Arrow equivalent for this.",
      },
    ],
    contextualSuggestions: [],
  },

  // =========================================================================
  // Search Dialog (Ctrl+F etc.)
  // =========================================================================
  {
    nonVimOperation: "search_dialog",
    displayName: "Search Dialog (Ctrl+F / Ctrl+H)",
    detectionMethod:
      "Ctrl+F in normal mode. In terminal Vim, Ctrl-F is bound to 'scroll full page forward' " +
      "by default, so accidental Ctrl-F triggers a page scroll. " +
      "Detection: if user re-maps <C-f> to search or expects a dialog, intercept it. " +
      "Some GUI Vims (gvim, MacVim) may show a dialog.",
    suggestions: [
      {
        command: "/",
        description: "Forward search from current position",
        level: 3,
        example:
          "Type '/' then the search pattern, press Enter. 'n' = next, 'N' = previous.",
        whyBetter:
          "Integrated into modal workflow. Search becomes a motion (e.g., d/foo = delete to 'foo').",
      },
      {
        command: "?",
        description: "Backward search from current position",
        level: 3,
        example: "'?error' searches backward for 'error'",
        whyBetter:
          "Bidirectional search without needing 'search direction' buttons.",
      },
      {
        command: "* / #",
        description: "Search word under cursor forward (*) / backward (#)",
        level: 3,
        example: "Cursor on 'TODO', press '*' to find next 'TODO'",
        whyBetter: "Zero-typing search for the current word.",
      },
      {
        command: ":s/ and :%s/",
        description: "Substitute (replace) within line or entire file",
        level: 4,
        example:
          "':%s/old/new/g' replaces all 'old' with 'new' in the file. " +
          "Add 'c' flag for confirmation: ':%s/old/new/gc'",
        whyBetter:
          "Combines search and replace in one command. Supports regex.",
      },
    ],
    contextualSuggestions: [
      {
        condition: "Incremental search is preferred",
        conditionCheck: (_ctx) => true,
        suggestion: {
          command: "/ with 'set incsearch'",
          description:
            "Enable incremental search to highlight matches as you type",
          level: 3,
          example:
            "Add 'set incsearch' and 'set hlsearch' to vimrc for live highlighting",
          whyBetter:
            "Same incremental feedback as modern search dialogs, " +
            "but stays in the editing flow.",
        },
      },
    ],
  },

  // =========================================================================
  // Mouse Scroll
  // =========================================================================
  {
    nonVimOperation: "mouse_scroll",
    displayName: "Mouse Scroll Wheel",
    detectionMethod:
      "Detect <ScrollWheelUp>/<ScrollWheelDown> events. " +
      "Requires 'set mouse=a'. " +
      "Can map: noremap <ScrollWheelUp> / noremap <ScrollWheelDown>.",
    suggestions: [
      {
        command: "Ctrl-e / Ctrl-y",
        description: "Scroll viewport one line at a time",
        level: 3,
        example: "Ctrl-e = scroll down, Ctrl-y = scroll up (viewport only)",
        whyBetter:
          "Precise single-line scrolling without leaving the keyboard.",
      },
      {
        command: "Ctrl-d / Ctrl-u",
        description: "Scroll half page down/up",
        level: 3,
        example: "Ctrl-d = half page down, Ctrl-u = half page up",
        whyBetter: "Faster scrolling than scroll wheel for large movements.",
      },
    ],
    contextualSuggestions: [],
  },

  // =========================================================================
  // Mouse Selection (Drag to Select)
  // =========================================================================
  {
    nonVimOperation: "mouse_selection",
    displayName: "Mouse Drag Selection",
    detectionMethod:
      "Detect <LeftDrag> events in mouse-enabled Vim. " +
      "When mouse is enabled, drag creates visual selection. " +
      "Intercept via mapping or by monitoring visual mode entry via mouse.",
    suggestions: [
      {
        command: "v / V / Ctrl-v",
        description:
          "Visual mode: v = character-wise, V = line-wise, Ctrl-v = block-wise",
        level: 2,
        example:
          "'v' starts selection, use motions to extend, then operate (d/y/c)",
        whyBetter:
          "Composable with all Vim motions. Block selection (Ctrl-v) has no mouse equivalent.",
      },
      {
        command: "viw / vi( / vi\" etc.",
        description: "Select inside text objects",
        level: 3,
        example:
          "'viw' selects the current word, 'vi\"' selects inside quotes",
        whyBetter:
          "Semantic selection. Much faster and more precise than mouse drag.",
      },
    ],
    contextualSuggestions: [],
  },
];

// -----------------------------------------------------------------------------
// 3. Learning Progression (4 Levels)
// -----------------------------------------------------------------------------

export interface LearningLevel {
  level: VimLevel;
  name: string;
  description: string;
  estimatedDays: string;
  motionCommands: LearningCommand[];
  practiceGoals: string[];
  antiPatterns: string[];
}

export interface LearningCommand {
  command: string;
  description: string;
  mnemonic: string;
}

export const LEARNING_LEVELS: LearningLevel[] = [
  // =========================================================================
  // LEVEL 1: Basic Movement (Survival)
  // =========================================================================
  {
    level: 1,
    name: "Basic Movement (Survival)",
    description:
      "The absolute essentials for navigating in Vim. " +
      "Goal: replace arrow keys entirely with hjkl. " +
      "Master these before moving to Level 2.",
    estimatedDays: "3-7 days",
    motionCommands: [
      { command: "h", description: "Move left", mnemonic: "Leftmost key in hjkl" },
      { command: "j", description: "Move down", mnemonic: "j looks like a down arrow (hook goes down)" },
      { command: "k", description: "Move up", mnemonic: "k points up (ascender goes up)" },
      { command: "l", description: "Move right", mnemonic: "Rightmost key in hjkl" },
      { command: "gg", description: "Go to first line", mnemonic: "go-go to the top" },
      { command: "G", description: "Go to last line", mnemonic: "capital G = Grand finale (end)" },
    ],
    practiceGoals: [
      "Navigate a file using only hjkl (disable arrow keys)",
      "Move to file start with gg and file end with G",
      "Complete vimtutor Lesson 1 in under 5 minutes",
    ],
    antiPatterns: [
      "Using arrow keys for any movement",
      "Holding j/k to scroll long distances (use gg/G or line numbers instead)",
    ],
  },

  // =========================================================================
  // LEVEL 2: Word and Line Movement
  // =========================================================================
  {
    level: 2,
    name: "Word and Line Movement",
    description:
      "Move by meaningful text units instead of single characters/lines. " +
      "Introduces the concept of counts and word-level navigation. " +
      "Goal: never press h/l more than 2-3 times in a row.",
    estimatedDays: "7-14 days",
    motionCommands: [
      { command: "w", description: "Next word start", mnemonic: "w = word" },
      { command: "b", description: "Previous word start", mnemonic: "b = back" },
      { command: "e", description: "Word end", mnemonic: "e = end" },
      { command: "W", description: "Next WORD start (whitespace-delimited)", mnemonic: "capital W = big Word" },
      { command: "B", description: "Previous WORD start", mnemonic: "capital B = big Back" },
      { command: "E", description: "WORD end", mnemonic: "capital E = big End" },
      { command: "0", description: "Line beginning (column 0)", mnemonic: "0 = zero-th column" },
      { command: "^", description: "First non-blank character", mnemonic: "^ = caret regex (start of content)" },
      { command: "$", description: "Line end", mnemonic: "$ = dollar regex (end of line)" },
      { command: "{count}j/k", description: "Jump multiple lines", mnemonic: "Number + direction (e.g., 5j)" },
      { command: "{line}G", description: "Go to specific line", mnemonic: "42G = Go to line 42" },
    ],
    practiceGoals: [
      "Navigate source code using w/b instead of repeated h/l",
      "Use 0/^/$ to jump to line boundaries",
      "Use counts for multi-line jumps (e.g., 10j)",
      "Enable 'set relativenumber' and practice counted movements",
      "Combine operators with word motions (dw, cw, yw)",
    ],
    antiPatterns: [
      "Pressing h or l more than 3 times in a row",
      "Pressing j or k more than 3 times without using a count",
      "Using Home/End keys instead of 0/^/$",
      "Using Ctrl+Arrow instead of w/b",
    ],
  },

  // =========================================================================
  // LEVEL 3: Search, Screen, and Scroll Movement
  // =========================================================================
  {
    level: 3,
    name: "Search, Screen, and Scroll",
    description:
      "Navigate across the visible screen and entire file with search and scroll commands. " +
      "Introduces visual mode selection as an alternative to mouse drag. " +
      "Goal: never use Page Up/Down, mouse scroll, or Ctrl+F.",
    estimatedDays: "14-28 days",
    motionCommands: [
      { command: "/pattern", description: "Search forward", mnemonic: "/ = looking forward (slash leans forward)" },
      { command: "?pattern", description: "Search backward", mnemonic: "? = questioning backward" },
      { command: "n", description: "Next search match", mnemonic: "n = next" },
      { command: "N", description: "Previous search match", mnemonic: "N = reverse Next" },
      { command: "*", description: "Search word under cursor forward", mnemonic: "* = star / highlight current word" },
      { command: "#", description: "Search word under cursor backward", mnemonic: "# = reverse star" },
      { command: "H", description: "Cursor to screen top", mnemonic: "H = High" },
      { command: "M", description: "Cursor to screen middle", mnemonic: "M = Middle" },
      { command: "L", description: "Cursor to screen bottom", mnemonic: "L = Low" },
      { command: "Ctrl-d", description: "Scroll half page down", mnemonic: "d = down" },
      { command: "Ctrl-u", description: "Scroll half page up", mnemonic: "u = up" },
      { command: "Ctrl-f", description: "Scroll full page forward", mnemonic: "f = forward" },
      { command: "Ctrl-b", description: "Scroll full page backward", mnemonic: "b = backward" },
      { command: "Ctrl-e", description: "Scroll viewport down one line", mnemonic: "e = extra line down" },
      { command: "Ctrl-y", description: "Scroll viewport up one line", mnemonic: "(no strong mnemonic, paired with Ctrl-e)" },
      { command: "zz", description: "Center current line on screen", mnemonic: "zz = zoom to center" },
      { command: "{", description: "Previous paragraph (blank line)", mnemonic: "{ = opening brace / go back" },
      { command: "}", description: "Next paragraph (blank line)", mnemonic: "} = closing brace / go forward" },
      { command: "%", description: "Jump to matching bracket", mnemonic: "% = match (paired symbols)" },
    ],
    practiceGoals: [
      "Search for identifiers using / and * instead of mouse-clicking",
      "Use H/M/L to quickly position within visible screen",
      "Replace Page Up/Down with Ctrl-d/Ctrl-u for all scrolling",
      "Navigate code blocks using { and }",
      "Jump between matching brackets with %",
      "Use visual mode (v/V/Ctrl-v) instead of mouse drag for selection",
    ],
    antiPatterns: [
      "Using Page Up/Down keys",
      "Using mouse scroll wheel",
      "Using Ctrl+F to open a search dialog",
      "Mouse-clicking to position cursor",
      "Mouse-dragging to select text",
    ],
  },

  // =========================================================================
  // LEVEL 4: Advanced Precision Movement
  // =========================================================================
  {
    level: 4,
    name: "Advanced Precision Movement",
    description:
      "Precision character targeting, marks for bookmarking locations, " +
      "jump lists for history navigation, and text object awareness. " +
      "Goal: reach any position in a file within 3-4 keystrokes.",
    estimatedDays: "28+ days (ongoing mastery)",
    motionCommands: [
      { command: "f{char}", description: "Jump to next {char} on line", mnemonic: "f = find" },
      { command: "F{char}", description: "Jump to previous {char} on line", mnemonic: "F = Find backward" },
      { command: "t{char}", description: "Jump to just before next {char}", mnemonic: "t = till / until" },
      { command: "T{char}", description: "Jump to just after previous {char}", mnemonic: "T = Till backward" },
      { command: ";", description: "Repeat last f/F/t/T forward", mnemonic: "; = semicolon continues" },
      { command: ",", description: "Repeat last f/F/t/T backward", mnemonic: ", = comma reverses" },
      { command: "m{a-z}", description: "Set local mark", mnemonic: "m = mark" },
      { command: "'{a-z}", description: "Jump to mark (line)", mnemonic: "' = apostrophe to mark line" },
      { command: "`{a-z}", description: "Jump to mark (exact position)", mnemonic: "` = backtick to exact position" },
      { command: "m{A-Z}", description: "Set global mark (cross-file)", mnemonic: "Capital = global / persistent" },
      { command: "Ctrl-o", description: "Jump to previous location in jump list", mnemonic: "o = older" },
      { command: "Ctrl-i", description: "Jump to next location in jump list", mnemonic: "i = inner / forward in history" },
      { command: "gd", description: "Go to local definition", mnemonic: "gd = go to definition" },
      { command: "gD", description: "Go to global definition", mnemonic: "gD = go to global Definition" },
      { command: "]]", description: "Next section/function start", mnemonic: "]] = forward to next section" },
      { command: "[[", description: "Previous section/function start", mnemonic: "[[ = backward to previous section" },
      { command: "gi", description: "Go to last insert position and enter insert mode", mnemonic: "gi = go to insert" },
      { command: "g;", description: "Go to previous change position", mnemonic: "g; = go to older change" },
      { command: "g,", description: "Go to next change position", mnemonic: "g, = go to newer change" },
    ],
    practiceGoals: [
      "Use f/t for all intra-line character targeting",
      "Set marks for frequently visited locations in large files",
      "Navigate using Ctrl-o/Ctrl-i for jump history",
      "Combine text objects with operators (ci\", da(, yiw etc.)",
      "Use gd to jump to definitions instead of searching",
      "Navigate function boundaries with [[ and ]]",
      "Use g; to return to last edit location",
    ],
    antiPatterns: [
      "Using mouse to click on specific characters",
      "Repeatedly pressing w/b to reach a visible character (use f/t instead)",
      "Searching (/) for a character that is visible on the current line (use f instead)",
      "Manually scrolling to find where you last edited (use g; or `. instead)",
    ],
  },
];

// -----------------------------------------------------------------------------
// 4. Detection Difficulty Analysis
// -----------------------------------------------------------------------------

export interface DetectionChallenge {
  category: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "very_hard";
  technicalDetails: string;
  possibleApproach: string;
  limitations: string;
}

export const DETECTION_CHALLENGES: DetectionChallenge[] = [
  // =========================================================================
  // Easy to Detect
  // =========================================================================
  {
    category: "Arrow Keys in Normal Mode",
    description: "User presses arrow keys while in normal/visual mode",
    difficulty: "easy",
    technicalDetails:
      "Arrow keys produce well-defined key codes: <Up>, <Down>, <Left>, <Right>. " +
      "In terminal Vim, these are escape sequences (\\e[A/B/C/D). " +
      "Vim can intercept them with noremap.",
    possibleApproach:
      "Use noremap <Up>/<Down>/<Left>/<Right> to intercept and trigger advice. " +
      "Example: nnoremap <Down> :echo 'Use j instead'<CR>j " +
      "This both gives feedback and performs the action.",
    limitations:
      "In insert mode, arrow keys are commonly accepted even by Vim experts. " +
      "Over-aggressive blocking in insert mode may frustrate users.",
  },
  {
    category: "Home/End Keys",
    description: "User presses Home or End key",
    difficulty: "easy",
    technicalDetails:
      "Home and End are distinct key events: <Home>, <End>. " +
      "Reliable detection in all modes.",
    possibleApproach:
      "Map <Home> and <End> to show suggestions for 0/^/$ respectively. " +
      "nnoremap <Home> :echo 'Use 0 or ^ instead'<CR>0",
    limitations:
      "Some terminal emulators may not send these keys properly. " +
      "Verify with Ctrl-V followed by the key to check the escape sequence.",
  },
  {
    category: "Page Up/Down Keys",
    description: "User presses PageUp or PageDown",
    difficulty: "easy",
    technicalDetails:
      "Distinct key events: <PageUp>, <PageDown>. " +
      "Easy to intercept in all modes.",
    possibleApproach:
      "Map to Ctrl-u/Ctrl-d equivalents while showing educational message.",
    limitations: "Minimal. These are straightforward to detect and remap.",
  },

  // =========================================================================
  // Medium Difficulty
  // =========================================================================
  {
    category: "Ctrl+Arrow Keys (Word Jump)",
    description: "User uses Ctrl+Left/Right for word movement",
    difficulty: "medium",
    technicalDetails:
      "Escape sequences vary by terminal emulator: " +
      "xterm: \\e[1;5C / \\e[1;5D, " +
      "screen/tmux may alter sequences. " +
      "Vim notation: <C-Left>, <C-Right>.",
    possibleApproach:
      "Map <C-Left> and <C-Right> in .vimrc. " +
      "Test with Ctrl-V in insert mode to verify the actual sequence received.",
    limitations:
      "Terminal-dependent. Sequences differ across xterm, iTerm2, GNOME Terminal, " +
      "Windows Terminal, tmux, screen. May need multiple mappings. " +
      "Some terminals consume Ctrl-Arrow for their own tab/pane navigation.",
  },
  {
    category: "Mouse Click for Cursor Positioning",
    description: "User clicks with mouse to move cursor",
    difficulty: "medium",
    technicalDetails:
      "Requires 'set mouse=a' to enable mouse support in Vim. " +
      "Mouse events: <LeftMouse>, <LeftRelease>, <LeftDrag>. " +
      "Xterm mouse protocol sends coordinates encoded in escape sequences. " +
      "Need 'set ttymouse=sgr' for modern terminals (columns > 223).",
    possibleApproach:
      "Override <LeftMouse> mapping to track clicks and provide advice. " +
      "nnoremap <LeftMouse> <LeftMouse>:call ShowMotionAdvice()<CR> " +
      "Calculate distance from old position to new position to suggest " +
      "appropriate Vim command (e.g., {count}j, /pattern, f{char}).",
    limitations:
      "Mouse must be enabled in Vim for detection (set mouse=a). " +
      "If user has mouse disabled, clicks are handled by terminal, not Vim. " +
      "GUI Vim (gVim, MacVim) handles mouse differently from terminal Vim. " +
      "Cannot detect mouse clicks outside the Vim window.",
  },
  {
    category: "Mouse Scroll Wheel",
    description: "User scrolls with mouse wheel instead of Ctrl-d/Ctrl-u",
    difficulty: "medium",
    technicalDetails:
      "Events: <ScrollWheelUp>, <ScrollWheelDown>. " +
      "Also <ScrollWheelLeft>, <ScrollWheelRight> in some terminals. " +
      "Requires 'set mouse=a'.",
    possibleApproach:
      "Map scroll events to show suggestions while still scrolling. " +
      "Track frequency of scroll events to determine when to show advice.",
    limitations:
      "High-frequency events. Showing advice on every scroll would be annoying. " +
      "Need to debounce or only show periodically. " +
      "Many Vim experts still use scroll wheel occasionally.",
  },
  {
    category: "Repeated Single-Key Movement (hjkl Overuse)",
    description:
      "User presses j/k/h/l many times instead of using counts or better motions",
    difficulty: "medium",
    technicalDetails:
      "Need to track key press frequency and detect patterns like " +
      "'jjjjj' (5 consecutive j presses). " +
      "hardtime.nvim uses a timer-based approach: count repeated keys within a time window.",
    possibleApproach:
      "Maintain a counter for consecutive same-key presses. " +
      "After threshold (e.g., 3), show message suggesting count prefix. " +
      "Use a timer to reset counter if pause > 500ms. " +
      "Can use Vim's CursorMoved autocmd or key mapping with state.",
    limitations:
      "Tricky to distinguish intentional repeated movement from habitual overuse. " +
      "Threshold tuning is subjective (3 repeats? 5?). " +
      "In some situations, repeated j/k is actually appropriate (browsing/reading).",
  },

  // =========================================================================
  // Hard to Detect
  // =========================================================================
  {
    category: "Ctrl+F Search Dialog Expectation",
    description: "User presses Ctrl+F expecting a search dialog (not page forward)",
    difficulty: "hard",
    technicalDetails:
      "In terminal Vim, Ctrl-F is already mapped to 'scroll full page forward'. " +
      "User expecting a search dialog gets unexpected scrolling instead. " +
      "No reliable way to distinguish 'user wanted search' from 'user wanted scroll'.",
    possibleApproach:
      "Option 1: Remap Ctrl-F to / (search) to match user expectation, " +
      "then educate about / as native Vim search. " +
      "Option 2: Show contextual help when Ctrl-F is pressed: " +
      "'In Vim, use / to search forward. Ctrl-F scrolls a full page.'",
    limitations:
      "Remapping Ctrl-F breaks the native full-page scroll functionality. " +
      "Ambiguous intent: experienced Vim user pressing Ctrl-F wants scroll, " +
      "non-Vim user pressing Ctrl-F wants search. " +
      "Cannot detect intent, only the key press.",
  },
  {
    category: "Mouse Selection (Drag)",
    description: "User drags mouse to select text instead of using visual mode",
    difficulty: "hard",
    technicalDetails:
      "Requires 'set mouse=a'. Drag events: <LeftDrag>. " +
      "In terminal without mouse mode, drag selects terminal text (not Vim visual). " +
      "In GUI Vim, drag enters visual mode automatically.",
    possibleApproach:
      "In mouse-enabled mode, map <LeftDrag> to intercept and advise visual mode. " +
      "After visual selection via mouse, show operator suggestions (d, y, c, >).",
    limitations:
      "If mouse is not enabled in Vim, drag selection happens at terminal level " +
      "and is completely invisible to Vim. " +
      "With mouse enabled, drag auto-enters visual mode, making it hard to distinguish " +
      "from keyboard-initiated visual mode. " +
      "Terminal-level selection (shift+click) bypasses Vim entirely.",
  },
  {
    category: "Inefficient Motion Choice",
    description:
      "User uses a working but suboptimal Vim command " +
      "(e.g., /foo when foo is on the same line and f could be used)",
    difficulty: "hard",
    technicalDetails:
      "Requires analyzing the relationship between cursor start position, " +
      "target position, and the command used to get there. " +
      "Need to know the buffer content to suggest optimal alternatives.",
    possibleApproach:
      "Track cursor position before and after each motion. " +
      "After motion completes, analyze: " +
      "- If target was on same line, could f/t have been used? " +
      "- If target was N lines away, was {N}j/k used or was / used? " +
      "- If target was a matching bracket, was % available? " +
      "Use CursorMoved autocmd to track movements.",
    limitations:
      "Extremely complex to implement comprehensively. " +
      "Context-dependent: sometimes / is better even for same-line targets " +
      "(e.g., when the character appears multiple times). " +
      "Performance concerns with constant cursor tracking. " +
      "Risk of annoying users with 'better' suggestions that are subjective.",
  },

  // =========================================================================
  // Very Hard to Detect
  // =========================================================================
  {
    category: "External Application Interference",
    description:
      "User switches to another application (browser, file manager) " +
      "to find information that could be found within Vim",
    difficulty: "very_hard",
    technicalDetails:
      "Vim has no visibility into actions outside its process. " +
      "Cannot detect Alt-Tab, application switching, or external clipboard operations.",
    possibleApproach:
      "Track FocusLost/FocusGained autocmd events to detect when user leaves Vim. " +
      "After FocusGained, show tips about Vim's built-in capabilities " +
      "(e.g., :grep, :find, :terminal, netrw for file browsing). " +
      "This is a heuristic at best.",
    limitations:
      "FocusLost/FocusGained requires terminal support (not all terminals send these). " +
      "Cannot determine WHY the user left Vim. " +
      "May produce false positives (user legitimately needed another app).",
  },
  {
    category: "Insert Mode Overuse",
    description:
      "User stays in insert mode too long, using arrow keys / " +
      "backspace extensively instead of returning to normal mode",
    difficulty: "very_hard",
    technicalDetails:
      "Difficult to define 'too long' in insert mode. " +
      "Some insertions legitimately require long typing sessions. " +
      "Arrow keys in insert mode are somewhat accepted practice.",
    possibleApproach:
      "Track time spent in insert mode via InsertEnter/InsertLeave autocmds. " +
      "Track number of arrow key presses and backspaces within insert mode. " +
      "If arrow/backspace count exceeds threshold relative to character count, " +
      "suggest 'exit insert mode for navigation'.",
    limitations:
      "Very subjective threshold. " +
      "Some editing workflows genuinely require staying in insert mode. " +
      "Aggressive prompting to leave insert mode frustrates users. " +
      "Cannot track specific key presses within insert mode without complex mappings.",
  },
  {
    category: "Terminal-Level Operations Bypassing Vim",
    description:
      "User uses terminal's own copy/paste, selection, scrollback, " +
      "or Ctrl-C/Ctrl-V instead of Vim's y/p",
    difficulty: "very_hard",
    technicalDetails:
      "Terminal-level operations (Shift+Click selection, Cmd+C on macOS, " +
      "Ctrl+Shift+C on Linux) bypass Vim entirely. " +
      "Vim receives no events for these operations.",
    possibleApproach:
      "Detect clipboard changes via FocusGained + system clipboard check. " +
      "If system clipboard changed while Vim was focused, user may have used " +
      "terminal paste. Show tip about Vim's \"+p or Ctrl-R+ in insert mode.",
    limitations:
      "Cannot reliably detect terminal-level selection or copy. " +
      "System clipboard monitoring is OS-dependent and may require external tools. " +
      "Many legitimate reasons to use system clipboard.",
  },
];

// -----------------------------------------------------------------------------
// 5. Utility: Suggest Best Vim Command for a Given Situation
// -----------------------------------------------------------------------------

/**
 * Given a non-Vim operation type and context, returns the most appropriate
 * Vim command suggestions, ordered from most to least relevant.
 */
export function suggestVimCommand(
  operation: NonVimOperationType,
  context: MotionContext,
): VimSuggestion[] {
  const mapping = OPERATION_MAPPINGS.find(
    (m) => m.nonVimOperation === operation,
  );
  if (!mapping) return [];

  const results: VimSuggestion[] = [];

  // Check contextual suggestions first (higher priority)
  for (const cs of mapping.contextualSuggestions) {
    if (cs.conditionCheck(context)) {
      results.push(cs.suggestion);
    }
  }

  // Add base suggestions
  results.push(...mapping.suggestions);

  // Filter by user's learning level if needed (show current level + one above)
  // This can be extended to accept a user's current level parameter.

  return results;
}

/**
 * Returns the suggested learning level commands for a given level,
 * along with the anti-patterns to watch for.
 */
export function getLevelInfo(level: VimLevel): LearningLevel | undefined {
  return LEARNING_LEVELS.find((l) => l.level === level);
}

/**
 * Given a cursor movement (from position A to position B), suggest the
 * optimal Vim command. This is a simplified heuristic.
 */
export function suggestOptimalMotion(
  fromLine: number,
  fromCol: number,
  toLine: number,
  toCol: number,
  totalLines: number,
): VimSuggestion {
  const lineDiff = toLine - fromLine;
  const colDiff = toCol - fromCol;

  // Same line movement
  if (lineDiff === 0) {
    if (toCol === 0) {
      return {
        command: "0",
        description: "Jump to line beginning",
        level: 2,
        example: "'0' moves to column 0",
        whyBetter: "Direct jump to line start.",
      };
    }
    if (Math.abs(colDiff) > 5) {
      return {
        command: "f{char} or w/b",
        description: "Use word motion or character find for large horizontal jumps",
        level: 2,
        example: "Use 'w' to move by words, or 'f)' to jump to a specific character",
        whyBetter: "Faster than repeated h/l presses.",
      };
    }
    return {
      command: `${Math.abs(colDiff)}${colDiff > 0 ? "l" : "h"}`,
      description: "Counted character movement",
      level: 1,
      example: `'${Math.abs(colDiff)}${colDiff > 0 ? "l" : "h"}' moves ${Math.abs(colDiff)} characters`,
      whyBetter: "Single command with count prefix.",
    };
  }

  // Moving to file edges
  if (toLine === 1) {
    return {
      command: "gg",
      description: "Jump to file beginning",
      level: 1,
      example: "'gg' goes to line 1",
      whyBetter: "Instant jump regardless of file size.",
    };
  }
  if (toLine === totalLines) {
    return {
      command: "G",
      description: "Jump to file end",
      level: 1,
      example: "'G' goes to last line",
      whyBetter: "Instant jump regardless of file size.",
    };
  }

  // Large vertical movement (> half screen, assume ~30 lines visible)
  if (Math.abs(lineDiff) > 30) {
    return {
      command: `${toLine}G`,
      description: `Jump directly to line ${toLine}`,
      level: 2,
      example: `'${toLine}G' or ':${toLine}' jumps to line ${toLine}`,
      whyBetter: "Direct line jump. No scrolling needed.",
    };
  }

  // Medium vertical movement
  if (Math.abs(lineDiff) > 1) {
    return {
      command: `${Math.abs(lineDiff)}${lineDiff > 0 ? "j" : "k"}`,
      description: `Counted line movement: ${Math.abs(lineDiff)} lines ${lineDiff > 0 ? "down" : "up"}`,
      level: 2,
      example: `'${Math.abs(lineDiff)}${lineDiff > 0 ? "j" : "k"}' moves ${Math.abs(lineDiff)} lines`,
      whyBetter: "Single command replaces multiple key presses.",
    };
  }

  // Single line movement
  return {
    command: lineDiff > 0 ? "j" : "k",
    description: "Single line movement",
    level: 1,
    example: `'${lineDiff > 0 ? "j" : "k"}' moves one line ${lineDiff > 0 ? "down" : "up"}`,
    whyBetter: "Basic home-row movement.",
  };
}
