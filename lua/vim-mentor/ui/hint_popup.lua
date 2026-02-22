-- vim-mentor/ui/hint_popup.lua
-- Primary UI: Floating window hint display
-- Inspired by which-key.nvim (contextual popup) and trouble.nvim (structured diagnostics)

local M = {}

local config = {}
local state = {
  win_id = nil,
  buf_id = nil,
  timer = nil,
  current_hint = nil,
}

-- ============================================================
-- Highlight Group Definitions
-- ============================================================
local function setup_highlights()
  -- Base groups (user can override in their colorscheme)
  local highlights = {
    -- Window chrome
    VimMentorBorder = { link = "FloatBorder" },
    VimMentorFloat = { link = "NormalFloat" },
    VimMentorTitle = { fg = "#ff9e64", bold = true },

    -- Content elements
    VimMentorDetected = { fg = "#f7768e", italic = true }, -- Red: what you did wrong
    VimMentorCommand = { fg = "#7aa2f7", bold = true }, -- Blue: the Vim command
    VimMentorKey = { fg = "#e0af68", bold = true }, -- Yellow: key to press
    VimMentorDesc = { fg = "#a9b1d6" }, -- Grey: description text
    VimMentorSuccess = { fg = "#9ece6a", bold = true }, -- Green: success feedback
    VimMentorStreak = { fg = "#bb9af7", bold = true }, -- Purple: streak counter

    -- Virtual text
    VimMentorVirtualText = { fg = "#565f89", italic = true },

    -- Level indicators
    VimMentorLevel1 = { fg = "#9ece6a" }, -- Green: gentle
    VimMentorLevel2 = { fg = "#e0af68" }, -- Yellow: moderate
    VimMentorLevel3 = { fg = "#ff9e64" }, -- Orange: strict
    VimMentorLevel4 = { fg = "#f7768e" }, -- Red: master
  }

  for name, hl in pairs(highlights) do
    -- Only set if user hasn't already defined it
    if vim.fn.hlexists(name) == 0 or vim.tbl_isempty(vim.api.nvim_get_hl(0, { name = name })) then
      vim.api.nvim_set_hl(0, name, hl)
    end
  end
end

-- ============================================================
-- Window Layout Calculation
-- ============================================================

--- Calculate the floating window dimensions and position
---@param hint table The hint data to display
---@return table Window configuration for nvim_open_win
local function calculate_layout(hint)
  local lines = M.format_hint(hint)
  local max_line_width = 0
  for _, line in ipairs(lines) do
    local text_len = vim.fn.strdisplaywidth(line.text or "")
    if text_len > max_line_width then
      max_line_width = text_len
    end
  end

  local fc = config.floating
  local width
  if fc.width == "auto" then
    width = math.max(fc.min_width, math.min(max_line_width + 4, fc.max_width))
  else
    width = fc.width
  end
  local height = #lines + 2 -- +2 for top/bottom padding

  local win_config = {
    relative = fc.relative,
    width = width,
    height = height,
    border = fc.border,
    style = "minimal",
    focusable = false,
    zindex = 100,
  }

  if fc.relative == "cursor" then
    win_config.row = fc.row_offset
    win_config.col = fc.col_offset
    win_config.anchor = fc.anchor
  else
    -- Center in editor
    local editor_width = vim.o.columns
    local editor_height = vim.o.lines
    win_config.row = math.floor((editor_height - height) / 2)
    win_config.col = math.floor((editor_width - width) / 2)
  end

  return win_config
end

-- ============================================================
-- Hint Formatting (content layout within the popup)
-- ============================================================

--- Format a hint into displayable lines with highlight information
---@param hint table { detected: string, command: string, keys: string, desc: string, level: number }
---@return table[] Array of { text: string, highlights: table[] }
function M.format_hint(hint)
  local lines = {}
  local level = hint.level or config.levels.current

  -- ---- Line 1: Title bar ----
  -- Example: "  Vim Mentor  [Level 2: Moderate]"
  local level_names = { "Gentle", "Moderate", "Strict", "Master" }
  local level_hl = "VimMentorLevel" .. level
  table.insert(lines, {
    text = string.format("  Vim Mentor  [Level %d: %s]", level, level_names[level] or "?"),
    highlights = {
      { group = "VimMentorTitle", col_start = 0, col_end = 14 },
      { group = level_hl, col_start = 15, col_end = -1 },
    },
  })

  -- ---- Line 2: Separator ----
  table.insert(lines, {
    text = string.rep("─", 40),
    highlights = { { group = "VimMentorBorder", col_start = 0, col_end = -1 } },
  })

  -- ---- Line 3: What was detected ----
  -- Example: " Detected: Arrow key (Right)"
  table.insert(lines, {
    text = string.format(" Detected: %s", hint.detected or "unknown"),
    highlights = {
      { group = "VimMentorDesc", col_start = 0, col_end = 11 },
      { group = "VimMentorDetected", col_start = 11, col_end = -1 },
    },
  })

  -- ---- Line 4: Blank separator ----
  table.insert(lines, { text = "", highlights = {} })

  -- ---- Line 5: Recommended command ----
  -- Example: " Use:  l  (move right)"
  table.insert(lines, {
    text = string.format("  Use:  %s  (%s)", hint.keys or "?", hint.desc or ""),
    highlights = {
      { group = "VimMentorDesc", col_start = 0, col_end = 8 },
      { group = "VimMentorKey", col_start = 8, col_end = 8 + #(hint.keys or "?") },
      { group = "VimMentorDesc", col_start = 8 + #(hint.keys or "?"), col_end = -1 },
    },
  })

  -- ---- Line 6: Full command description (if available) ----
  if hint.command and hint.command ~= hint.keys then
    table.insert(lines, {
      text = string.format("  Vim:  :%s", hint.command),
      highlights = {
        { group = "VimMentorDesc", col_start = 0, col_end = 8 },
        { group = "VimMentorCommand", col_start = 8, col_end = -1 },
      },
    })
  end

  -- ---- Line 7: Blank separator ----
  table.insert(lines, { text = "", highlights = {} })

  -- ---- Line 8: Action instruction ----
  if level >= 3 then
    table.insert(lines, {
      text = " Type the correct command to continue.",
      highlights = { { group = "VimMentorDetected", col_start = 0, col_end = -1 } },
    })
  elseif config.interaction.allow_skip then
    table.insert(lines, {
      text = " Press the correct key, or <Esc> to skip.",
      highlights = { { group = "VimMentorDesc", col_start = 0, col_end = -1 } },
    })
  end

  return lines
end

-- ============================================================
-- Window Lifecycle
-- ============================================================

--- Show a hint popup for a detected non-Vim operation
---@param hint table The hint data
function M.show(hint)
  -- Close any existing popup first
  M.close()

  state.current_hint = hint
  local lines = M.format_hint(hint)
  local win_config = calculate_layout(hint)

  -- Create buffer
  state.buf_id = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_option(state.buf_id, "bufhidden", "wipe")
  vim.api.nvim_buf_set_option(state.buf_id, "filetype", "vim-mentor-hint")

  -- Fill buffer content
  local text_lines = {}
  for _, line in ipairs(lines) do
    table.insert(text_lines, line.text)
  end
  vim.api.nvim_buf_set_lines(state.buf_id, 0, -1, false, text_lines)

  -- Apply highlights
  local ns = vim.api.nvim_create_namespace("vim_mentor_hint")
  for i, line in ipairs(lines) do
    for _, hl in ipairs(line.highlights) do
      local col_end = hl.col_end
      if col_end == -1 then
        col_end = #line.text
      end
      vim.api.nvim_buf_add_highlight(state.buf_id, ns, hl.group, i - 1, hl.col_start, col_end)
    end
  end

  -- Set buffer to non-modifiable
  vim.api.nvim_buf_set_option(state.buf_id, "modifiable", false)

  -- Open the floating window
  win_config.title = " Vim Mentor "
  win_config.title_pos = "center"
  state.win_id = vim.api.nvim_open_win(state.buf_id, false, win_config)

  -- Window options
  vim.api.nvim_win_set_option(state.win_id, "winblend", config.floating.winblend)
  vim.api.nvim_win_set_option(
    state.win_id,
    "winhighlight",
    "Normal:" .. config.floating.highlights.background .. ",FloatBorder:" .. config.floating.highlights.border
  )

  -- Auto-close timer (if configured and level allows it)
  local timeout = config.interaction.timeout
  if hint.level and hint.level >= 3 then
    timeout = 0 -- No auto-close in strict/master mode
  end

  if timeout > 0 then
    state.timer = vim.defer_fn(function()
      M.close()
    end, timeout)
  end
end

--- Close the hint popup
function M.close()
  if state.timer then
    -- Cancel pending timer
    state.timer = nil
  end

  if state.win_id and vim.api.nvim_win_is_valid(state.win_id) then
    vim.api.nvim_win_close(state.win_id, true)
  end
  state.win_id = nil

  if state.buf_id and vim.api.nvim_buf_is_valid(state.buf_id) then
    vim.api.nvim_buf_delete(state.buf_id, { force = true })
  end
  state.buf_id = nil

  state.current_hint = nil
end

--- Check if a hint popup is currently visible
---@return boolean
function M.is_visible()
  return state.win_id ~= nil and vim.api.nvim_win_is_valid(state.win_id)
end

-- ============================================================
-- Virtual Text (secondary display)
-- ============================================================

local vt_ns = vim.api.nvim_create_namespace("vim_mentor_virtual_text")

--- Show a virtual text hint at the current cursor position
---@param hint table The hint data
function M.show_virtual_text(hint)
  M.clear_virtual_text()

  if not config.virtual_text.enabled then
    return
  end

  local line = vim.api.nvim_win_get_cursor(0)[1] - 1
  local text = string.format("%s Use: %s (%s)", config.virtual_text.prefix, hint.keys or "?", hint.desc or "")

  vim.api.nvim_buf_set_extmark(0, vt_ns, line, 0, {
    virt_text = { { text, config.virtual_text.hl_group } },
    virt_text_pos = config.virtual_text.position,
  })
end

--- Clear all virtual text hints
function M.clear_virtual_text()
  vim.api.nvim_buf_clear_namespace(0, vt_ns, 0, -1)
end

-- ============================================================
-- Setup
-- ============================================================

function M.setup(opts)
  config = opts
  setup_highlights()
end

return M
