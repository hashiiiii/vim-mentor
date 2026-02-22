# vim-mentor

> Real-time Vim operation teaching plugin for Neovim & VS Code

vim-mentor detects non-Vim operations (arrow keys, mouse, Page Up/Down, etc.) during your actual coding workflow and teaches correct Vim commands through contextual suggestions, progressive blocking, and gamification.

## Features

- **Context-aware suggestions** -- Detects non-Vim operations and suggests the optimal Vim command based on cursor position, repeat count, and buffer context
- **4 teaching modes** -- From gentle hints to strict blocking, adjustable to your comfort level
- **5-level progressive learning** -- Starts with basic `hjkl` and gradually introduces advanced motions like `f/t`, text objects, and marks
- **Positive reinforcement** -- Success flashes, streak tracking, milestone celebrations, and a learning dashboard
- **Dual platform** -- Available as both a Neovim plugin (Lua) and a VS Code extension (TypeScript)

## Neovim Plugin

### Requirements

- Neovim >= 0.10.0

### Installation

<details>
<summary>lazy.nvim</summary>

```lua
{
  "hashiiiii/vim-mentor",
  event = "VeryLazy",
  opts = {
    teaching_mode = 2,  -- 1:Gentle, 2:Moderate, 3:Strict, 4:Master
  },
}
```

</details>

<details>
<summary>packer.nvim</summary>

```lua
use {
  "hashiiiii/vim-mentor",
  config = function()
    require("vim-mentor").setup()
  end,
}
```

</details>

### Configuration

```lua
require("vim-mentor").setup({
  -- Teaching mode: 1=Gentle, 2=Moderate, 3=Strict, 4=Master
  teaching_mode = 2,

  -- Auto-advance level after N correct inputs
  auto_advance = true,
  advance_threshold = 50,

  -- Which keys to detect/block
  blocked_keys = {
    arrow_keys = true,
    mouse = true,
    page_keys = true,
    home_end = true,
    ctrl_arrow = true,
    hjkl_repeat = true,
  },

  -- Filetypes to exclude
  excluded_filetypes = {
    "NvimTree", "TelescopePrompt", "lazy", "mason", "help",
  },
})
```

### Commands

| Command | Description |
|---------|-------------|
| `:VimMentor enable` | Enable the plugin |
| `:VimMentor disable` | Disable the plugin |
| `:VimMentor toggle` | Toggle enabled/disabled |
| `:VimMentor level [N]` | Show/set learning level (1-5) |
| `:VimMentor mode [N]` | Show/set teaching mode (1-4) |
| `:VimMentor report` | Show usage statistics |
| `:VimMentor reset` | Reset all learning data |
| `:VimMentorDashboard` | Open learning dashboard |

### Statusline Integration

```lua
-- lualine.nvim
sections = {
  lualine_x = {
    require("vim-mentor.ui.statusline").lualine,
  },
}
```

## VS Code Extension

The VS Code extension provides the same learning experience for VS Code users.

See [vscode-vim-mentor/README.md](vscode-vim-mentor/README.md) for installation and usage.

## Teaching Modes

| Mode | Name | Behavior |
|------|------|----------|
| 1 | Gentle | Show hint, allow the action |
| 2 | Moderate | Show hint, delay action by 1 second |
| 3 | Strict | Block until correct Vim input |
| 4 | Master | Block with minimal UI (virtual text only) |

## Learning Levels

| Level | Name | Detected Operations | Suggested Commands |
|-------|------|--------------------|--------------------|
| 1 | Beginner | Arrow keys | `h/j/k/l`, `gg/G` |
| 2 | Novice | + Home/End, PageUp/Down, Ctrl+Arrow | + `w/b/e`, `0/^/$`, `Ctrl-d/u` |
| 3 | Intermediate | + Mouse | + `/`, `*/#`, `H/M/L` |
| 4 | Advanced | + hjkl repeat | + `f/t`, text objects |
| 5 | Expert | + Inefficient motions | + marks, jump list |

## Architecture

```
[Key Input] --> [input.lua] --> [handler.lua]
                                     |
                            +--------+--------+
                            v                 v
                     [detector.lua]    [suggestion.lua]
                     Pattern match     Optimal command
                            |                 |
                            +--------+--------+
                                     v
                            [interaction.lua]
                            Level / block control
                                     |
                     +---------------+---------------+
                     v               v               v
               [hint_popup]    [feedback]      [statusline]
               Floating win    Flash/streak    Status display
                                     |
                                     v
                              [storage.lua]
                              JSON persistence
```

## Documentation

- [Getting Started Guide](docs/getting-started.md) -- Complete beginner's guide for those new to Vim
- [Architecture](docs/architecture.md) -- Technical architecture details
- [UI Design Spec](docs/ui-design-spec.md) -- UI design specification
- [Performance Tuning](docs/performance-tuning-spec.md) -- Performance tuning guide

## License

[MIT](LICENSE)
