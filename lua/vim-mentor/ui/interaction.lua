-- vim-mentor/ui/interaction.lua
-- Interaction Controller
-- Manages the flow when a non-Vim operation is detected:
--   1. Block/delay the operation
--   2. Display the hint
--   3. Wait for correct input
--   4. Provide feedback on success
--   5. Escalate on repeated failure

local M = {}

local config = {}
local hint_popup = require("vim-mentor.ui.hint_popup")
local feedback = require("vim-mentor.ui.feedback")

local state = {
  -- Tracks consecutive failures for the same command
  failure_counts = {},
  -- Whether we are currently in "blocked" state awaiting correct input
  blocked = false,
  -- The hint we are currently enforcing
  active_hint = nil,
  -- Keymap overrides installed during blocking
  installed_maps = {},
}

-- ============================================================
-- Core Interaction Flow
-- ============================================================

--- Called when a non-Vim operation is detected
--- This is the main entry point from the detection module
---@param detection table {
---   type: string,        -- e.g., "arrow_key", "mouse", "page_up"
---   key: string,         -- The actual key pressed
---   context: table,      -- Cursor position, mode, etc.
--- }
---@param hint table {
---   detected: string,    -- Human-readable description of what was detected
---   keys: string,        -- The correct Vim key(s)
---   command: string,     -- The Vim command name
---   desc: string,        -- Short description
---   extended_desc: string, -- Longer explanation for escalation
---   related: table[],    -- Related commands
--- }
function M.on_non_vim_detected(detection, hint)
  local level = config.levels.current

  -- Track failure count for this specific detection
  local fail_key = detection.type .. ":" .. (detection.key or "")
  state.failure_counts[fail_key] = (state.failure_counts[fail_key] or 0) + 1
  hint.attempt_count = state.failure_counts[fail_key]
  hint.level = level

  -- Record the failure
  feedback.record_failure()

  -- ---- Level-based behavior ----
  if level == 1 then
    -- GENTLE: Show hint, allow the action to proceed
    M.show_hint_and_allow(hint)

  elseif level == 2 then
    -- MODERATE: Show hint, delay action by 1 second
    M.show_hint_and_delay(hint, 1000)

  elseif level == 3 then
    -- STRICT: Show hint, block until correct input
    M.block_and_wait(hint)

  elseif level == 4 then
    -- MASTER: Block silently (minimal hint)
    M.block_silent(hint)
  end

  -- ---- Escalation check ----
  if state.failure_counts[fail_key] >= config.interaction.escalation_threshold then
    M.escalate(hint, fail_key)
  end
end

--- Called when the user enters the correct Vim command
--- (after being prompted by a hint)
---@param command string The correct command that was entered
function M.on_correct_input(command)
  -- Clear the block
  state.blocked = false
  state.active_hint = nil

  -- Close UI elements
  hint_popup.close()
  hint_popup.clear_virtual_text()

  -- Remove installed keymaps
  M.cleanup_block_maps()

  -- Provide positive feedback
  feedback.record_success()

  -- Reset failure count for this command
  for key, _ in pairs(state.failure_counts) do
    if key:find(command, 1, true) then
      state.failure_counts[key] = 0
    end
  end
end

-- ============================================================
-- Level 1: Gentle - Show and Allow
-- ============================================================

--- Show the hint but allow the non-Vim action to proceed
---@param hint table
function M.show_hint_and_allow(hint)
  -- Show floating popup
  hint_popup.show(hint)

  -- Also show virtual text
  hint_popup.show_virtual_text(hint)

  -- The action is NOT blocked; it proceeds normally
  -- The hint auto-dismisses based on config.interaction.timeout
end

-- ============================================================
-- Level 2: Moderate - Show and Delay
-- ============================================================

--- Show the hint and delay the action by the specified duration
---@param hint table
---@param delay_ms number Delay in milliseconds
function M.show_hint_and_delay(hint, delay_ms)
  -- Show floating popup
  hint_popup.show(hint)
  hint_popup.show_virtual_text(hint)

  -- The detection module should delay applying the action.
  -- We signal this by returning a delay value.
  -- (In practice, the detection module checks M.get_delay())
  state.active_hint = hint
  state.delay_ms = delay_ms

  vim.defer_fn(function()
    if state.active_hint == hint then
      state.active_hint = nil
      state.delay_ms = nil
      hint_popup.close()
      hint_popup.clear_virtual_text()
    end
  end, delay_ms)
end

-- ============================================================
-- Level 3: Strict - Block Until Correct
-- ============================================================

--- Block the action and wait for the correct Vim input
---@param hint table
function M.block_and_wait(hint)
  state.blocked = true
  state.active_hint = hint

  -- Show floating popup (no timeout)
  hint_popup.show(hint)
  hint_popup.show_virtual_text(hint)

  -- Install temporary keymaps that only accept:
  --   1. The correct Vim command
  --   2. <Esc> to skip (if allowed at this level -- not allowed at level 3+)
  M.install_block_maps(hint)
end

-- ============================================================
-- Level 4: Master - Block Silently
-- ============================================================

--- Block the action with minimal UI feedback
---@param hint table
function M.block_silent(hint)
  state.blocked = true
  state.active_hint = hint

  -- Only show virtual text (no floating popup)
  hint_popup.show_virtual_text(hint)

  -- Install blocking keymaps
  M.install_block_maps(hint)
end

-- ============================================================
-- Escalation
-- ============================================================

--- Handle escalation after repeated failures
---@param hint table
---@param fail_key string
function M.escalate(hint, fail_key)
  local action = config.interaction.escalation_action

  if action == "extended_help" then
    feedback.show_extended_help(hint)
  elseif action == "lower_level" then
    -- Temporarily lower the teaching level
    local original = config.levels.current
    config.levels.current = math.max(1, original - 1)
    vim.notify(
      string.format(
        "Vim Mentor: Temporarily lowering to Level %d for this command.",
        config.levels.current
      ),
      vim.log.levels.INFO,
      { title = "Vim Mentor" }
    )
  elseif action == "demo" then
    -- Show a brief animation of how the command works
    -- (placeholder -- would need terminal recording or step-by-step)
    vim.notify(
      string.format(
        "Vim Mentor: Try pressing '%s' -- %s",
        hint.keys or "?",
        hint.desc or ""
      ),
      vim.log.levels.INFO,
      { title = "Vim Mentor - Demo" }
    )
  end

  -- Reset the failure counter after escalation
  state.failure_counts[fail_key] = 0
end

-- ============================================================
-- Blocking Keymap Management
-- ============================================================

--- Install temporary keymaps that enforce correct input
---@param hint table
function M.install_block_maps(hint)
  M.cleanup_block_maps()

  local correct_keys = hint.keys or ""

  -- Map the correct key(s) to resolve the block
  if correct_keys ~= "" then
    vim.keymap.set("n", correct_keys, function()
      M.on_correct_input(correct_keys)
    end, { buffer = 0, nowait = true, desc = "Vim Mentor: correct input" })
    table.insert(state.installed_maps, { mode = "n", lhs = correct_keys })
  end

  -- Allow <Esc> to skip in levels 1-2
  if config.levels.current <= 2 and config.interaction.allow_skip then
    vim.keymap.set("n", "<Esc>", function()
      state.blocked = false
      state.active_hint = nil
      hint_popup.close()
      hint_popup.clear_virtual_text()
      M.cleanup_block_maps()
    end, { buffer = 0, nowait = true, desc = "Vim Mentor: skip hint" })
    table.insert(state.installed_maps, { mode = "n", lhs = "<Esc>" })
  end
end

--- Remove all temporarily installed keymaps
function M.cleanup_block_maps()
  for _, map in ipairs(state.installed_maps) do
    pcall(vim.keymap.del, map.mode, map.lhs, { buffer = 0 })
  end
  state.installed_maps = {}
end

-- ============================================================
-- State Queries
-- ============================================================

--- Check if the editor is currently blocked
---@return boolean
function M.is_blocked()
  return state.blocked
end

--- Get the current delay (for level 2)
---@return number|nil Delay in ms, or nil if not delayed
function M.get_delay()
  return state.delay_ms
end

-- ============================================================
-- Setup
-- ============================================================

function M.setup(opts)
  config = opts
end

return M
