-- vim-mentor/handler.lua
-- Event handler
-- Bridge between input detection and UI interaction

local M = {}

local config = require("vim-mentor.config")
local detector = require("vim-mentor.detector")
local suggestion = require("vim-mentor.suggestion")

--- Called by input.lua when a blocked key is pressed.
--- Orchestrates the detection -> suggestion -> interaction flow.
---@param key string The blocked key that was pressed (e.g. "<Down>", "<Home>")
---@param vim_equivalent string|nil The Vim equivalent to execute (e.g. "j" for "<Down>")
function M.on_blocked_key(key, vim_equivalent)
  -- 1. Check if current filetype is excluded
  if config.is_excluded() then
    -- Execute the vim equivalent directly without intervention
    if vim_equivalent then
      local escaped = vim.api.nvim_replace_termcodes(vim_equivalent, true, false, true)
      vim.api.nvim_feedkeys(escaped, "n", false)
    end
    return
  end

  -- 2. Run the detector
  local mode = vim.fn.mode()
  local detection = detector.detect(key, mode)
  if not detection then
    -- Not recognized as a non-Vim operation, pass through
    if vim_equivalent then
      local escaped = vim.api.nvim_replace_termcodes(vim_equivalent, true, false, true)
      vim.api.nvim_feedkeys(escaped, "n", false)
    end
    return
  end

  -- 3. Get suggestion from the rules engine
  local hint = suggestion.suggest(detection)
  if not hint then
    -- No suggestion available, pass through
    if vim_equivalent then
      local escaped = vim.api.nvim_replace_termcodes(vim_equivalent, true, false, true)
      vim.api.nvim_feedkeys(escaped, "n", false)
    end
    return
  end

  -- 4. Determine behavior based on teaching level
  local cfg = config.get()
  local level = cfg.teaching_mode

  -- 5. Call the interaction controller
  local interaction = require("vim-mentor.ui.interaction")
  interaction.on_non_vim_detected(detection, hint)

  -- 6. In gentle mode (level 1), still execute the vim equivalent
  --    In moderate mode (level 2), execute after delay
  --    In strict/master mode (level 3-4), block entirely
  if level == 1 and vim_equivalent then
    local escaped = vim.api.nvim_replace_termcodes(vim_equivalent, true, false, true)
    vim.api.nvim_feedkeys(escaped, "n", false)
  elseif level == 2 and vim_equivalent then
    vim.defer_fn(function()
      local escaped = vim.api.nvim_replace_termcodes(vim_equivalent, true, false, true)
      vim.api.nvim_feedkeys(escaped, "n", false)
    end, 1000)
  end
  -- Level 3 and 4: action is blocked by interaction controller
end

--- Called by vim.on_key() callback for pattern detection (hjkl repeat).
--- Checks if an hjkl key has been pressed too many times consecutively.
---@param key string The raw key character
function M.on_key_pattern(key)
  -- Only check hjkl keys
  if key ~= "h" and key ~= "j" and key ~= "k" and key ~= "l" then
    return
  end

  -- Check if current filetype is excluded
  if config.is_excluded() then
    return
  end

  local cfg = config.get()

  -- Only detect if hjkl_repeat blocking is enabled
  if not cfg.blocked_keys.hjkl_repeat then
    return
  end

  local threshold = cfg.hjkl_repeat_threshold

  -- Run the repeat detector
  local detection = detector.check_hjkl_repeat(key, threshold)
  if not detection then
    return
  end

  -- Get suggestion
  local hint = suggestion.suggest(detection)
  if not hint then
    return
  end

  -- Call interaction controller
  local interaction = require("vim-mentor.ui.interaction")
  interaction.on_non_vim_detected(detection, hint)
end

return M
