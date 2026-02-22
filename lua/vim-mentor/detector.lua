-- vim-mentor/detector.lua
-- Detection engine
-- Analyzes key input and determines if it is a non-Vim operation

local M = {}

-- Ring buffer for tracking key sequences (for pattern detection)
local key_history = {}
local history_size = 50
local history_index = 0

-- State for tracking consecutive same-key presses
local last_key = nil
local repeat_count = 0
local repeat_timer = nil
local REPEAT_WINDOW_MS = 800 -- Reset repeat counter after this many ms of inactivity

-- Mapping of raw keys to detection types
local arrow_key_map = {
  ["<Up>"] = "arrow_up",
  ["<Down>"] = "arrow_down",
  ["<Left>"] = "arrow_left",
  ["<Right>"] = "arrow_right",
}

local special_key_map = {
  ["<Home>"] = "home",
  ["<End>"] = "end_key",
  ["<PageUp>"] = "page_up",
  ["<PageDown>"] = "page_down",
}

local mouse_key_map = {
  ["<LeftMouse>"] = "mouse_click",
  ["<ScrollWheelUp>"] = "mouse_scroll_up",
  ["<ScrollWheelDown>"] = "mouse_scroll_down",
}

local ctrl_arrow_map = {
  ["<C-Left>"] = "ctrl_left",
  ["<C-Right>"] = "ctrl_right",
  ["<C-Up>"] = "ctrl_up",
  ["<C-Down>"] = "ctrl_down",
}

-- hjkl keys for repeat detection
local hjkl_repeat_map = {
  j = "hjkl_repeat_j",
  k = "hjkl_repeat_k",
  h = "hjkl_repeat_h",
  l = "hjkl_repeat_l",
}

--- Add a key to the history ring buffer.
---@param key string The key that was pressed
---@param mode string The current Vim mode
local function record_key(key, mode)
  history_index = (history_index % history_size) + 1
  key_history[history_index] = {
    key = key,
    mode = mode,
    time = vim.uv.hrtime(),
  }
end

--- Update the repeat counter for consecutive same-key presses.
---@param key string The key that was pressed
local function update_repeat(key)
  if key == last_key then
    repeat_count = repeat_count + 1
  else
    last_key = key
    repeat_count = 1
  end

  -- Reset repeat counter after a pause
  if repeat_timer then
    repeat_timer:stop()
  end
  repeat_timer = vim.defer_fn(function()
    last_key = nil
    repeat_count = 0
  end, REPEAT_WINDOW_MS)
end

--- Build a context table for the current state.
---@return table context
local function build_context()
  local cursor_pos = { 1, 0 }
  local ok, pos = pcall(vim.api.nvim_win_get_cursor, 0)
  if ok then
    cursor_pos = pos
  end

  local mode = vim.fn.mode()
  local total_lines = vim.api.nvim_buf_line_count(0)

  return {
    repeat_count = repeat_count,
    cursor_pos = cursor_pos,
    mode = mode,
    total_lines = total_lines,
    line = cursor_pos[1],
    col = cursor_pos[2],
  }
end

--- Detect whether a key press is a non-Vim operation.
--- Called from keymaps installed by input.lua for blocked keys.
---@param key string The key notation (e.g. "<Down>", "<Home>")
---@param mode string The Vim mode when the key was pressed
---@return table|nil detection Detection result or nil if not a non-Vim operation
function M.detect(key, mode)
  record_key(key, mode)
  update_repeat(key)

  local detection_type = nil

  -- Check arrow keys
  if arrow_key_map[key] then
    detection_type = arrow_key_map[key]
  -- Check special keys (Home, End, PageUp, PageDown)
  elseif special_key_map[key] then
    detection_type = special_key_map[key]
  -- Check mouse keys
  elseif mouse_key_map[key] then
    detection_type = mouse_key_map[key]
  -- Check Ctrl+Arrow keys
  elseif ctrl_arrow_map[key] then
    detection_type = ctrl_arrow_map[key]
  end

  if not detection_type then
    return nil
  end

  local context = build_context()

  return {
    type = detection_type,
    key = key,
    context = context,
  }
end

--- Check if an hjkl key has been pressed too many times in a row.
--- Called from vim.on_key() callback for pattern detection.
---@param key string The raw key character (h, j, k, or l)
---@param threshold number The number of repeats before triggering detection
---@return table|nil detection Detection result if threshold exceeded, nil otherwise
function M.check_hjkl_repeat(key, threshold)
  -- Only track hjkl in normal mode
  local mode = vim.fn.mode()
  if mode ~= "n" then
    return nil
  end

  record_key(key, mode)
  update_repeat(key)

  if repeat_count < threshold then
    return nil
  end

  local detection_type = hjkl_repeat_map[key]
  if not detection_type then
    return nil
  end

  local context = build_context()

  -- Only trigger once at the threshold, not every press after
  if repeat_count == threshold then
    return {
      type = detection_type,
      key = key,
      context = context,
    }
  end

  return nil
end

--- Reset all internal state.
function M.reset()
  key_history = {}
  history_index = 0
  last_key = nil
  repeat_count = 0
  if repeat_timer then
    repeat_timer:stop()
    repeat_timer = nil
  end
end

return M
