-- vim-mentor/ui/progress.lua
-- Progress tracking and dashboard display
-- Provides :VimMentorDashboard command for viewing learning statistics

local M = {}

local config = {}

-- ============================================================
-- Data Persistence
-- ============================================================

--- Load progress data from disk
---@return table Progress data
function M.load()
  local path = config.progress.data_path
  local f = io.open(path, "r")
  if not f then
    return M.default_data()
  end
  local content = f:read("*a")
  f:close()

  local ok, data = pcall(vim.json.decode, content)
  if not ok then
    return M.default_data()
  end
  return data
end

--- Save progress data to disk
---@param data table Progress data
function M.save(data)
  local path = config.progress.data_path
  -- Ensure directory exists
  local dir = vim.fn.fnamemodify(path, ":h")
  vim.fn.mkdir(dir, "p")

  local f = io.open(path, "w")
  if not f then
    vim.notify("Vim Mentor: Failed to save progress", vim.log.levels.WARN)
    return
  end
  f:write(vim.json.encode(data))
  f:close()
end

--- Default progress data structure
---@return table
function M.default_data()
  return {
    -- Per-command statistics
    commands = {
      -- ["h"] = { correct = 0, prompted = 0, last_seen = nil },
    },
    -- Per-session history
    sessions = {},
    -- Current level
    level = 1,
    -- Lifetime totals
    lifetime = {
      correct = 0,
      incorrect = 0,
      best_streak = 0,
      total_sessions = 0,
    },
  }
end

-- ============================================================
-- Dashboard UI (floating window)
-- ============================================================

--- Open the progress dashboard
function M.open_dashboard()
  local data = M.load()
  local feedback = require("vim-mentor.ui.feedback")
  local session_stats = feedback.get_stats()

  local dc = config.progress.dashboard
  local width = dc.width
  local height = dc.height

  local buf = vim.api.nvim_create_buf(false, true)

  -- Build dashboard content
  local lines = M.render_dashboard(data, session_stats)

  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines.text)
  vim.api.nvim_buf_set_option(buf, "modifiable", false)
  vim.api.nvim_buf_set_option(buf, "bufhidden", "wipe")
  vim.api.nvim_buf_set_option(buf, "filetype", "vim-mentor-dashboard")

  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = math.min(height, #lines.text + 2),
    row = math.floor((vim.o.lines - height) / 2),
    col = math.floor((vim.o.columns - width) / 2),
    border = "rounded",
    title = " Vim Mentor - Learning Dashboard ",
    title_pos = "center",
    style = "minimal",
  })

  vim.api.nvim_win_set_option(win, "winblend", 5)

  -- Apply highlights
  local ns = vim.api.nvim_create_namespace("vim_mentor_dashboard")
  for _, hl in ipairs(lines.highlights) do
    vim.api.nvim_buf_add_highlight(buf, ns, hl.group, hl.line, hl.col_start, hl.col_end)
  end

  -- Close mappings
  local close = function()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end
  vim.keymap.set("n", "<Esc>", close, { buffer = buf, nowait = true })
  vim.keymap.set("n", "q", close, { buffer = buf, nowait = true })
end

--- Render dashboard content
---@param data table Persistent progress data
---@param session table Current session stats
---@return table { text: string[], highlights: table[] }
function M.render_dashboard(data, session)
  local text = {}
  local highlights = {}
  local line_nr = 0

  local function add(str, hl_group)
    table.insert(text, str)
    if hl_group then
      table.insert(highlights, {
        group = hl_group,
        line = line_nr,
        col_start = 0,
        col_end = -1,
      })
    end
    line_nr = line_nr + 1
  end

  local function add_separator()
    add(string.rep("─", 76), "VimMentorBorder")
  end

  -- Header
  add("")
  add("   LEARNING PROGRESS", "VimMentorTitle")
  add("")
  add_separator()

  -- Current Session
  add("")
  add("   Current Session", "VimMentorTitle")
  add("")
  add(string.format("     Correct:     %d", session.total_correct), "VimMentorSuccess")
  add(string.format("     Incorrect:   %d", session.total_incorrect), "VimMentorDetected")
  add(string.format("     Accuracy:    %d%%", session.accuracy))
  add(string.format("     Streak:      %d", session.streak), "VimMentorStreak")
  add("")
  add_separator()

  -- Lifetime Stats
  add("")
  add("   Lifetime Statistics", "VimMentorTitle")
  add("")
  local lt = data.lifetime
  add(string.format("     Total Correct:   %d", lt.correct), "VimMentorSuccess")
  add(string.format("     Total Incorrect: %d", lt.incorrect), "VimMentorDetected")
  add(string.format("     Best Streak:     %d", lt.best_streak), "VimMentorStreak")
  add(string.format("     Sessions:        %d", lt.total_sessions))
  add(string.format("     Current Level:   %d", data.level))
  add("")
  add_separator()

  -- Per-Command Breakdown (top 10 most practiced)
  add("")
  add("   Most Practiced Commands", "VimMentorTitle")
  add("")
  add("     Command    Correct  Prompted  Accuracy", "VimMentorDesc")
  add("     " .. string.rep("─", 45), "VimMentorBorder")

  -- Sort commands by total prompted (descending)
  local sorted = {}
  for cmd, stats in pairs(data.commands) do
    table.insert(sorted, { cmd = cmd, stats = stats })
  end
  table.sort(sorted, function(a, b)
    return (a.stats.prompted or 0) > (b.stats.prompted or 0)
  end)

  local shown = 0
  for _, entry in ipairs(sorted) do
    if shown >= 10 then break end
    local s = entry.stats
    local total = (s.correct or 0) + (s.prompted or 0)
    local acc = total > 0 and math.floor((s.correct or 0) / total * 100) or 0
    add(string.format(
      "     %-10s %7d  %8d     %3d%%",
      entry.cmd, s.correct or 0, s.prompted or 0, acc
    ))
    shown = shown + 1
  end

  if shown == 0 then
    add("     (no data yet)")
  end

  -- Progress Bar Visualization
  add("")
  add_separator()
  add("")
  add("   Level Progress", "VimMentorTitle")
  add("")
  local threshold = config.levels.advance_threshold
  local progress_count = lt.correct % threshold
  local bar_width = 40
  local filled = math.floor(progress_count / threshold * bar_width)
  local bar = string.rep("█", filled) .. string.rep("░", bar_width - filled)
  add(string.format("     [%s] %d/%d", bar, progress_count, threshold))
  add(string.format("     Level %d -> Level %d", data.level, math.min(data.level + 1, 4)))
  add("")

  -- Footer
  add("   Press q or <Esc> to close.", "VimMentorDesc")
  add("")

  return { text = text, highlights = highlights }
end

-- ============================================================
-- Setup
-- ============================================================

function M.setup(opts)
  config = opts

  -- Register command
  vim.api.nvim_create_user_command("VimMentorDashboard", function()
    M.open_dashboard()
  end, { desc = "Open Vim Mentor learning dashboard" })
end

return M
