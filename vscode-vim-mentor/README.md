# Vim Mentor - VS Code Extension

Learn Vim keybindings while coding. Vim Mentor detects non-Vim operations (arrow keys, mouse clicks, Home/End, PageUp/PageDown, Ctrl+Arrow) and teaches the correct Vim commands.

**This extension works independently of any Vim extension.** It is designed for people using VS Code's normal editing mode who want to learn Vim keybindings.

## Features

- **Arrow Key Detection**: Intercepts arrow key usage and suggests hjkl alternatives
- **Home/End Detection**: Suggests 0, ^, $ alternatives
- **PageUp/PageDown Detection**: Suggests Ctrl-d, Ctrl-u, Ctrl-f, Ctrl-b alternatives
- **Ctrl+Arrow Detection**: Suggests w, b, e, W, B alternatives
- **Mouse Click Detection**: Suggests keyboard-based navigation alternatives
- **Contextual Suggestions**: Suggests {count}j/k for repeated presses, gg/G near file edges, word motions for repeated horizontal movement
- **4 Teaching Modes**: Gentle (hint only), Moderate (hint + delay), Strict (block until correct), Master (minimal UI + block)
- **5 Learning Levels**: Progressive introduction of Vim commands from basic hjkl to advanced motions
- **Streak Tracking**: Tracks consecutive correct Vim usage with milestone celebrations
- **Dashboard**: Webview-based dashboard showing learning statistics
- **Auto-Advance**: Automatically increases learning level based on progress

## Installation

### From Source

```bash
cd vscode-vim-mentor
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

### From VSIX

```bash
cd vscode-vim-mentor
npm install
npm run compile
npx @vscode/vsce package
code --install-extension vim-mentor-0.1.0.vsix
```

## Usage

The extension activates automatically when VS Code starts. You will see a status bar item on the right showing your current level and streak.

### Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "Vim Mentor":

| Command | Description |
|---------|-------------|
| `Vim Mentor: Enable` | Enable detection |
| `Vim Mentor: Disable` | Disable detection |
| `Vim Mentor: Toggle` | Toggle detection on/off |
| `Vim Mentor: Set Learning Level` | Choose level 1-5 |
| `Vim Mentor: Set Teaching Mode` | Choose Gentle/Moderate/Strict/Master |
| `Vim Mentor: Open Dashboard` | View learning statistics |
| `Vim Mentor: Reset Progress` | Clear all progress data |

### Teaching Modes

| Mode | Behavior |
|------|----------|
| **Gentle (1)** | Shows a hint message and virtual text. The original action proceeds normally. |
| **Moderate (2)** | Shows a hint and delays the original action by 1 second. |
| **Strict (3)** | Blocks the action. You must type the correct Vim command to proceed. |
| **Master (4)** | Blocks with minimal UI. Only virtual text hint is shown before the input box. |

### Learning Levels

| Level | Focus | Commands Taught |
|-------|-------|-----------------|
| **1: Beginner** | Basic movement | h, j, k, l, gg, G |
| **2: Elementary** | Words and lines | w, b, e, 0, ^, $, {count}j/k |
| **3: Intermediate** | Search and scroll | /, ?, n, N, Ctrl-d/u, H/M/L |
| **4: Advanced** | Precision | f/t, marks, gd, Ctrl-o/i |
| **5: Expert** | Full mastery | All motions and composability |

## Configuration

All settings are under `vim-mentor.*` in VS Code settings:

```json
{
  "vim-mentor.teachingMode": 2,
  "vim-mentor.learningLevel": 1,
  "vim-mentor.autoAdvance": true,
  "vim-mentor.advanceThreshold": 50,
  "vim-mentor.blockedKeys.arrowKeys": true,
  "vim-mentor.blockedKeys.mouse": false,
  "vim-mentor.blockedKeys.pageKeys": true,
  "vim-mentor.blockedKeys.homeEnd": true,
  "vim-mentor.blockedKeys.ctrlArrow": true,
  "vim-mentor.excludedLanguages": []
}
```

### Excluding Languages

To disable Vim Mentor for specific file types:

```json
{
  "vim-mentor.excludedLanguages": ["markdown", "plaintext", "json"]
}
```

## Architecture

```
src/
  extension.ts   - Main entry point, command registration, lifecycle
  config.ts      - Configuration management via VS Code settings API
  rules.ts       - Non-Vim operation -> Vim suggestion mappings
  detector.ts    - Detection layer: keybinding intercepts + mouse tracking
  suggestion.ts  - Suggestion generation and formatting
  ui.ts          - UI layer: virtual text, status bar, blocking input
  feedback.ts    - Success feedback: flash, streak, milestones
  storage.ts     - Persistence via globalState
  dashboard.ts   - Webview-based statistics dashboard
```

## How It Works

1. **Keybinding Interception**: The extension registers keybindings in `package.json` with `when` clauses that activate only when Vim Mentor is enabled. When you press an arrow key, the keybinding routes to an intercept command instead of the default editor command.

2. **Mouse Detection**: Uses `onDidChangeTextEditorSelection` with `TextEditorSelectionChangeKind.Mouse` to detect when the cursor was repositioned via mouse click.

3. **Suggestion Engine**: The detection event is matched against rules that consider the operation type, repeat count, cursor position, and user learning level to produce the most relevant Vim command suggestion.

4. **Teaching Mode Behavior**: Based on the configured teaching mode, the UI either shows a non-blocking hint, delays the action, or blocks until the user types the correct Vim command.

## License

Same license as the parent vim-mentor project.
