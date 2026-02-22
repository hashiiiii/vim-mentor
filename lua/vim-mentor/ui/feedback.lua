-- vim-mentor/ui/feedback.lua
-- Positive reinforcement and success feedback system
-- Provides visual/auditory feedback when users correctly use Vim commands

local M = {}

local config = {}

local state = {
  streak = 0,
  total_correct = 0,
  total_incorrect = 0,
  session_start = nil,
}

local flash_ns = vim.api.nvim_create_namespace("vim_mentor_flash")
local streak_ns = vim.api.nvim_create_namespace("vim_mentor_streak")

-- ============================================================
-- Success Flash Effect
-- Briefly highlights the cursor line green on correct input
-- ============================================================

--- Flash the cursor line to indicate success
---@param duration number|nil Duration in ms (default from config)
function M.flash_success(duration)
  if not config.feedback.enabled or not config.feedback.success_flash then
    return
  end

  duration = duration or config.feedback.success_flash_duration

  local line = vim.api.nvim_win_get_cursor(0)[1] - 1
  vim.api.nvim_buf_set_extmark(0, flash_ns, line, 0, {
    line_hl_group = "VimMentorSuccess",
    end_line = line + 1,
    priority = 200,
  })

  vim.defer_fn(function()
    vim.api.nvim_buf_clear_namespace(0, flash_ns, 0, -1)
  end, duration)
end

-- ============================================================
-- Streak Management and Milestone Feedback
-- ============================================================

--- Record a correct Vim operation
function M.record_success()
  state.streak = state.streak + 1
  state.total_correct = state.total_correct + 1

  -- Flash feedback
  M.flash_success()

  -- Check milestones
  if config.feedback.streak.enabled then
    for _, milestone in ipairs(config.feedback.streak.milestones) do
      if state.streak == milestone then
        M.show_milestone(milestone)
        break
      end
    end
  end
end

--- Record a failed (non-Vim) operation
function M.record_failure()
  state.streak = 0
  state.total_incorrect = state.total_incorrect + 1
end

--- Show a milestone celebration popup
---@param count number The milestone number reached
function M.show_milestone(count)
  local messages = {
    [5]   = { title = "Nice start!",      body = "5 correct Vim commands in a row!" },
    [10]  = { title = "Getting better!",   body = "10 streak! You are learning fast." },
    [25]  = { title = "Impressive!",       body = "25 streak! Vim is becoming natural." },
    [50]  = { title = "Vim Apprentice!",   body = "50 streak! True muscle memory." },
    [100] = { title = "Vim Master!",       body = "100 streak! Nothing can stop you." },
  }

  local msg = messages[count] or {
    title = "Milestone!",
    body = string.format("%d correct commands in a row!", count),
  }

  -- Use vim.notify to show milestone (integrates with nvim-notify if available)
  vim.notify(
    string.format("%s\n%s", msg.title, msg.body),
    vim.log.levels.INFO,
    {
      title = "Vim Mentor",
      icon = config.statusline.icons.streak,
      timeout = 3000,
    }
  )
end

-- ============================================================
-- Extended Help (Escalation)
-- Shown after repeated failures on the same operation
-- ============================================================

--- Show extended help for a Vim command
---@param hint table The hint data with command details
function M.show_extended_help(hint)
  local buf = vim.api.nvim_create_buf(false, true)

  local lines = {
    " Extended Help ",
    string.rep("═", 50),
    "",
    string.format(" You have tried this %d times.", hint.attempt_count or 0),
    "",
    " Command:  " .. (hint.keys or "?"),
    " Action:   " .. (hint.desc or ""),
    "",
    " How it works:",
    "   " .. (hint.extended_desc or "No extended description available."),
    "",
    " Related commands:",
  }

  -- Add related commands if available
  if hint.related then
    for _, related in ipairs(hint.related) do
      table.insert(lines, string.format("   %s  -  %s", related.keys, related.desc))
    end
  else
    table.insert(lines, "   (none)")
  end

  table.insert(lines, "")
  table.insert(lines, " Press <Esc> or q to close.")

  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.api.nvim_buf_set_option(buf, "modifiable", false)
  vim.api.nvim_buf_set_option(buf, "bufhidden", "wipe")

  local width = 55
  local height = #lines
  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = math.floor((vim.o.lines - height) / 2),
    col = math.floor((vim.o.columns - width) / 2),
    border = "rounded",
    title = " Vim Mentor - Extended Help ",
    title_pos = "center",
    style = "minimal",
  })

  -- Highlight setup
  local ns = vim.api.nvim_create_namespace("vim_mentor_extended_help")
  vim.api.nvim_buf_add_highlight(buf, ns, "VimMentorTitle", 0, 0, -1)
  vim.api.nvim_buf_add_highlight(buf, ns, "VimMentorBorder", 1, 0, -1)
  vim.api.nvim_buf_add_highlight(buf, ns, "VimMentorDetected", 3, 0, -1)
  vim.api.nvim_buf_add_highlight(buf, ns, "VimMentorKey", 5, 12, -1)
  vim.api.nvim_buf_add_highlight(buf, ns, "VimMentorDesc", 6, 12, -1)

  -- Close mappings
  local close = function()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end
  vim.keymap.set("n", "<Esc>", close, { buffer = buf, nowait = true })
  vim.keymap.set("n", "q", close, { buffer = buf, nowait = true })
end

-- ============================================================
-- State Accessors (for statusline and progress)
-- ============================================================

function M.get_streak()
  return state.streak
end

function M.get_stats()
  return {
    streak = state.streak,
    total_correct = state.total_correct,
    total_incorrect = state.total_incorrect,
    accuracy = state.total_correct + state.total_incorrect > 0
      and math.floor(state.total_correct / (state.total_correct + state.total_incorrect) * 100)
      or 0,
  }
end

function M.reset_session()
  state.streak = 0
  state.total_correct = 0
  state.total_incorrect = 0
  state.session_start = os.time()
end

-- ============================================================
-- Setup
-- ============================================================

function M.setup(opts)
  config = opts
  state.session_start = os.time()
end

return M
