-- vim-mentor/rules.lua
-- Suggestion rules database
-- Maps non-Vim operations to Vim command suggestions
-- Ported from vim_motion_knowledge.ts

local M = {}

-- =============================================================================
-- Base Rules: detection_type -> suggestion
-- Each rule has: detected, keys, command, desc, extended_desc, related, level
-- =============================================================================

M.rules = {
  -- =========================================================================
  -- Arrow Keys - Vertical
  -- =========================================================================
  arrow_up = {
    detected = "Arrow Key (Up)",
    keys = "k",
    command = "k",
    desc = "move up one line",
    extended_desc = "The 'k' key moves the cursor up one line. "
      .. "Your fingers stay on the home row, eliminating the need to reach "
      .. "for the arrow key area. Mnemonic: k points up (ascender goes up).",
    related = {
      { keys = "gk", desc = "move up one display line (wrapped)" },
      { keys = "gg", desc = "jump to first line of file" },
      { keys = "{count}k", desc = "move up multiple lines (e.g. 5k)" },
    },
    level = 1,
  },

  arrow_down = {
    detected = "Arrow Key (Down)",
    keys = "j",
    command = "j",
    desc = "move down one line",
    extended_desc = "The 'j' key moves the cursor down one line. "
      .. "Your fingers stay on the home row. "
      .. "Mnemonic: j looks like a down arrow (hook goes down).",
    related = {
      { keys = "gj", desc = "move down one display line (wrapped)" },
      { keys = "G", desc = "jump to last line of file" },
      { keys = "{count}j", desc = "move down multiple lines (e.g. 5j)" },
    },
    level = 1,
  },

  -- =========================================================================
  -- Arrow Keys - Horizontal
  -- =========================================================================
  arrow_left = {
    detected = "Arrow Key (Left)",
    keys = "h",
    command = "h",
    desc = "move left one character",
    extended_desc = "The 'h' key moves the cursor left one character. "
      .. "It is the leftmost key in the hjkl cluster. "
      .. "For larger horizontal movements, consider w/b (word-level).",
    related = {
      { keys = "b", desc = "move to previous word start" },
      { keys = "B", desc = "move to previous WORD start" },
      { keys = "0", desc = "move to beginning of line" },
      { keys = "^", desc = "move to first non-blank character" },
    },
    level = 1,
  },

  arrow_right = {
    detected = "Arrow Key (Right)",
    keys = "l",
    command = "l",
    desc = "move right one character",
    extended_desc = "The 'l' key moves the cursor right one character. "
      .. "It is the rightmost key in the hjkl cluster. "
      .. "For larger horizontal movements, consider w/e (word-level).",
    related = {
      { keys = "w", desc = "move to next word start" },
      { keys = "e", desc = "move to end of current/next word" },
      { keys = "$", desc = "move to end of line" },
    },
    level = 1,
  },

  -- =========================================================================
  -- Home / End
  -- =========================================================================
  home = {
    detected = "Home Key",
    keys = "0",
    command = "0 or ^",
    desc = "move to beginning of line",
    extended_desc = "'0' moves to column 0 (absolute line start). "
      .. "'^' moves to the first non-blank character, which is usually what you want "
      .. "for indented code. Both are single home-row keystrokes.",
    related = {
      { keys = "^", desc = "first non-blank character of line" },
      { keys = "I", desc = "insert at first non-blank character" },
    },
    level = 2,
  },

  end_key = {
    detected = "End Key",
    keys = "$",
    command = "$",
    desc = "move to end of line",
    extended_desc = "'$' moves to the last character on the current line. "
      .. "Single keystroke that replaces the End key. "
      .. "In regex, $ also means 'end of line', making it easy to remember.",
    related = {
      { keys = "A", desc = "append at end of line (enter insert mode)" },
      { keys = "g_", desc = "move to last non-blank character" },
    },
    level = 2,
  },

  -- =========================================================================
  -- Page Up / Page Down
  -- =========================================================================
  page_up = {
    detected = "Page Up Key",
    keys = "<C-u>",
    command = "Ctrl-u",
    desc = "scroll half page up",
    extended_desc = "Ctrl-u scrolls up by half a screen. "
      .. "This keeps more context visible than a full-page jump. "
      .. "Ctrl-b scrolls a full page backward if you need larger jumps.",
    related = {
      { keys = "<C-b>", desc = "scroll full page backward" },
      { keys = "<C-y>", desc = "scroll viewport up one line" },
      { keys = "gg", desc = "jump to file beginning" },
    },
    level = 2,
  },

  page_down = {
    detected = "Page Down Key",
    keys = "<C-d>",
    command = "Ctrl-d",
    desc = "scroll half page down",
    extended_desc = "Ctrl-d scrolls down by half a screen. "
      .. "This keeps more context visible than a full-page jump. "
      .. "Ctrl-f scrolls a full page forward if you need larger jumps.",
    related = {
      { keys = "<C-f>", desc = "scroll full page forward" },
      { keys = "<C-e>", desc = "scroll viewport down one line" },
      { keys = "G", desc = "jump to file end" },
    },
    level = 2,
  },

  -- =========================================================================
  -- Mouse
  -- =========================================================================
  mouse_click = {
    detected = "Mouse Click",
    keys = "/{pattern}",
    command = "/{pattern} or {line}G",
    desc = "search for text or jump to line",
    extended_desc = "Instead of clicking with the mouse, use '/' to search for text "
      .. "at the target location. Press 'n' for next match, 'N' for previous. "
      .. "For a known line number, use '{line}G' (e.g. 42G) to jump directly.",
    related = {
      { keys = "*", desc = "search word under cursor forward" },
      { keys = "#", desc = "search word under cursor backward" },
      { keys = "{line}G", desc = "jump to specific line number" },
      { keys = "gd", desc = "go to local definition" },
    },
    level = 3,
  },

  mouse_scroll_up = {
    detected = "Mouse Scroll (Up)",
    keys = "<C-y>",
    command = "Ctrl-y",
    desc = "scroll viewport up one line",
    extended_desc = "Ctrl-y scrolls the viewport up one line without moving the cursor. "
      .. "For larger scrolling, use Ctrl-u (half page) or Ctrl-b (full page).",
    related = {
      { keys = "<C-u>", desc = "scroll half page up" },
      { keys = "<C-b>", desc = "scroll full page backward" },
      { keys = "zz", desc = "center current line on screen" },
    },
    level = 3,
  },

  mouse_scroll_down = {
    detected = "Mouse Scroll (Down)",
    keys = "<C-e>",
    command = "Ctrl-e",
    desc = "scroll viewport down one line",
    extended_desc = "Ctrl-e scrolls the viewport down one line without moving the cursor. "
      .. "For larger scrolling, use Ctrl-d (half page) or Ctrl-f (full page).",
    related = {
      { keys = "<C-d>", desc = "scroll half page down" },
      { keys = "<C-f>", desc = "scroll full page forward" },
      { keys = "zz", desc = "center current line on screen" },
    },
    level = 3,
  },

  -- =========================================================================
  -- Ctrl + Arrow Keys
  -- =========================================================================
  ctrl_left = {
    detected = "Ctrl + Left Arrow",
    keys = "b",
    command = "b",
    desc = "move to previous word start",
    extended_desc = "'b' moves the cursor to the start of the previous word. "
      .. "'B' moves by WORD (whitespace-delimited), skipping punctuation. "
      .. "Composable with operators: 'db' deletes backward one word.",
    related = {
      { keys = "B", desc = "move to previous WORD start (whitespace-delimited)" },
      { keys = "ge", desc = "move to end of previous word" },
    },
    level = 2,
  },

  ctrl_right = {
    detected = "Ctrl + Right Arrow",
    keys = "w",
    command = "w",
    desc = "move to next word start",
    extended_desc = "'w' moves the cursor to the start of the next word. "
      .. "'W' moves by WORD (whitespace-delimited), skipping punctuation. "
      .. "Composable with operators: 'dw' deletes to next word.",
    related = {
      { keys = "W", desc = "move to next WORD start (whitespace-delimited)" },
      { keys = "e", desc = "move to end of current/next word" },
      { keys = "E", desc = "move to end of current/next WORD" },
    },
    level = 2,
  },

  ctrl_up = {
    detected = "Ctrl + Up Arrow",
    keys = "{",
    command = "{",
    desc = "jump to previous paragraph",
    extended_desc = "'{' jumps to the previous empty line (paragraph boundary). "
      .. "Great for navigating between code blocks separated by blank lines.",
    related = {
      { keys = "[[", desc = "jump to previous section/function start" },
      { keys = "<C-u>", desc = "scroll half page up" },
    },
    level = 2,
  },

  ctrl_down = {
    detected = "Ctrl + Down Arrow",
    keys = "}",
    command = "}",
    desc = "jump to next paragraph",
    extended_desc = "'}' jumps to the next empty line (paragraph boundary). "
      .. "Great for navigating between code blocks separated by blank lines.",
    related = {
      { keys = "]]", desc = "jump to next section/function start" },
      { keys = "<C-d>", desc = "scroll half page down" },
    },
    level = 2,
  },

  -- =========================================================================
  -- hjkl Repeat Detection
  -- =========================================================================
  hjkl_repeat_j = {
    detected = "Repeated j (Down)",
    keys = "{count}j",
    command = "{count}j",
    desc = "use count prefix for multi-line jumps",
    extended_desc = "Instead of pressing j multiple times, use a count prefix. "
      .. "For example, '5j' moves 5 lines down in one command. "
      .. "Enable ':set relativenumber' to see line offsets at a glance.",
    related = {
      { keys = "<C-d>", desc = "scroll half page down" },
      { keys = "}", desc = "jump to next paragraph" },
      { keys = "{line}G", desc = "jump to specific line" },
    },
    level = 2,
  },

  hjkl_repeat_k = {
    detected = "Repeated k (Up)",
    keys = "{count}k",
    command = "{count}k",
    desc = "use count prefix for multi-line jumps",
    extended_desc = "Instead of pressing k multiple times, use a count prefix. "
      .. "For example, '5k' moves 5 lines up in one command. "
      .. "Enable ':set relativenumber' to see line offsets at a glance.",
    related = {
      { keys = "<C-u>", desc = "scroll half page up" },
      { keys = "{", desc = "jump to previous paragraph" },
      { keys = "{line}G", desc = "jump to specific line" },
    },
    level = 2,
  },

  hjkl_repeat_h = {
    detected = "Repeated h (Left)",
    keys = "b",
    command = "b or 0",
    desc = "move by word or to line start",
    extended_desc = "Instead of pressing h many times, use word motions. "
      .. "'b' moves to the previous word start, '0' moves to line start, "
      .. "'^' moves to the first non-blank character.",
    related = {
      { keys = "B", desc = "move to previous WORD start" },
      { keys = "F{char}", desc = "jump backward to a character on line" },
      { keys = "0", desc = "move to beginning of line" },
    },
    level = 2,
  },

  hjkl_repeat_l = {
    detected = "Repeated l (Right)",
    keys = "w",
    command = "w or $",
    desc = "move by word or to line end",
    extended_desc = "Instead of pressing l many times, use word motions. "
      .. "'w' moves to the next word start, 'e' moves to word end, "
      .. "'$' moves to end of line.",
    related = {
      { keys = "W", desc = "move to next WORD start" },
      { keys = "f{char}", desc = "jump forward to a character on line" },
      { keys = "$", desc = "move to end of line" },
    },
    level = 2,
  },
}

-- =============================================================================
-- Contextual Rules: enhance base rules based on context
-- =============================================================================

local contextual_rules = {
  -- Arrow up/down with high repeat count
  arrow_up_repeat = {
    condition = function(context)
      return context.repeat_count and context.repeat_count >= 3
    end,
    suggestion = {
      detected = "Arrow Key (Up) - Repeated",
      keys = "{count}k",
      command = "{count}k",
      desc = "use count prefix for multi-line jumps",
      extended_desc = "Instead of pressing the up arrow repeatedly, use a count prefix "
        .. "with k. For example, '5k' moves 5 lines up. "
        .. "Enable ':set relativenumber' to see offsets.",
      related = {
        { keys = "<C-u>", desc = "scroll half page up" },
        { keys = "{", desc = "jump to previous paragraph" },
      },
      level = 2,
    },
  },

  arrow_down_repeat = {
    condition = function(context)
      return context.repeat_count and context.repeat_count >= 3
    end,
    suggestion = {
      detected = "Arrow Key (Down) - Repeated",
      keys = "{count}j",
      command = "{count}j",
      desc = "use count prefix for multi-line jumps",
      extended_desc = "Instead of pressing the down arrow repeatedly, use a count prefix "
        .. "with j. For example, '5j' moves 5 lines down. "
        .. "Enable ':set relativenumber' to see offsets.",
      related = {
        { keys = "<C-d>", desc = "scroll half page down" },
        { keys = "}", desc = "jump to next paragraph" },
      },
      level = 2,
    },
  },

  -- Arrow keys near file edge
  arrow_up_file_top = {
    condition = function(context)
      return context.cursor_pos and context.cursor_pos[1] <= 5
    end,
    suggestion = {
      detected = "Arrow Key (Up) - Near File Top",
      keys = "gg",
      command = "gg",
      desc = "jump to first line of file",
      extended_desc = "When you are near the top of the file, 'gg' jumps directly "
        .. "to the first line. No need to arrow up repeatedly.",
      related = {
        { keys = "1G", desc = "jump to line 1 (equivalent to gg)" },
      },
      level = 1,
    },
  },

  arrow_down_file_bottom = {
    condition = function(context)
      if not context.cursor_pos then
        return false
      end
      local total_lines = vim.api.nvim_buf_line_count(0)
      return (total_lines - context.cursor_pos[1]) <= 5
    end,
    suggestion = {
      detected = "Arrow Key (Down) - Near File Bottom",
      keys = "G",
      command = "G",
      desc = "jump to last line of file",
      extended_desc = "When you are near the bottom of the file, 'G' jumps directly "
        .. "to the last line. No need to arrow down repeatedly.",
      related = {
        { keys = "{line}G", desc = "jump to specific line number" },
      },
      level = 1,
    },
  },

  -- Horizontal arrow keys with high repeat count -> word motion
  arrow_left_repeat = {
    condition = function(context)
      return context.repeat_count and context.repeat_count >= 4
    end,
    suggestion = {
      detected = "Arrow Key (Left) - Repeated",
      keys = "b",
      command = "b",
      desc = "move to previous word start",
      extended_desc = "Moving character by character is slow. "
        .. "'b' jumps to the start of the previous word. "
        .. "'B' jumps by WORD (whitespace-delimited).",
      related = {
        { keys = "B", desc = "move to previous WORD start" },
        { keys = "0", desc = "move to beginning of line" },
        { keys = "^", desc = "first non-blank character" },
      },
      level = 2,
    },
  },

  arrow_right_repeat = {
    condition = function(context)
      return context.repeat_count and context.repeat_count >= 4
    end,
    suggestion = {
      detected = "Arrow Key (Right) - Repeated",
      keys = "w",
      command = "w",
      desc = "move to next word start",
      extended_desc = "Moving character by character is slow. "
        .. "'w' jumps to the start of the next word. "
        .. "'e' jumps to the end of the current/next word.",
      related = {
        { keys = "e", desc = "move to end of current/next word" },
        { keys = "W", desc = "move to next WORD start" },
        { keys = "$", desc = "move to end of line" },
      },
      level = 2,
    },
  },
}

-- =============================================================================
-- Public API
-- =============================================================================

--- Get the base suggestion for a detection type.
---@param detection_type string The type of non-Vim operation detected
---@param context table|nil Optional context for contextual enhancements
---@return table|nil hint The suggestion hint table, or nil if no rule found
function M.get_suggestion(detection_type, context)
  -- First try contextual suggestions if context is provided
  if context then
    local contextual = M.get_contextual_suggestions(detection_type, context)
    if contextual then
      return contextual
    end
  end

  -- Fall back to base rule
  local rule = M.rules[detection_type]
  if not rule then
    return nil
  end

  return vim.deepcopy(rule)
end

--- Get enhanced contextual suggestion based on detection type and context.
---@param detection_type string The detection type
---@param context table Context with repeat_count, cursor_pos, mode, etc.
---@return table|nil hint Enhanced suggestion, or nil if no contextual rule matches
function M.get_contextual_suggestions(detection_type, context)
  -- Build possible contextual rule keys to check
  local checks = {}

  -- Check for repeat-based contextual rules
  if context.repeat_count and context.repeat_count >= 3 then
    table.insert(checks, detection_type .. "_repeat")
  end

  -- Check for file-edge contextual rules
  if context.cursor_pos then
    if detection_type == "arrow_up" then
      table.insert(checks, "arrow_up_file_top")
    elseif detection_type == "arrow_down" then
      table.insert(checks, "arrow_down_file_bottom")
    end
  end

  -- Evaluate contextual rules in order
  for _, key in ipairs(checks) do
    local rule = contextual_rules[key]
    if rule and rule.condition(context) then
      return vim.deepcopy(rule.suggestion)
    end
  end

  return nil
end

return M
