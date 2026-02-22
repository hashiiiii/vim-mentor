-- vim-mentor/init.lua
-- Public API and main entry point
-- Coordinates all modules: config, input, storage, UI

local M = {}

local enabled = false

--- Set up the vim-mentor plugin with user options.
---@param opts table|nil User configuration options
function M.setup(opts)
  opts = opts or {}

  -- 1. Initialize config
  local config = require("vim-mentor.config")
  local cfg = config.setup(opts)

  -- 2. Initialize storage
  local storage = require("vim-mentor.storage")
  storage.setup(cfg)

  -- 3. Initialize UI (passing the ui sub-config)
  local ui = require("vim-mentor.ui")
  ui.setup(cfg.ui)

  -- 4. Set up input keymaps
  local input = require("vim-mentor.input")
  input.setup(cfg)
  enabled = true

  -- 5. Register user commands
  M.register_commands()

  -- 6. Save data on Vim exit
  vim.api.nvim_create_autocmd("VimLeavePre", {
    group = vim.api.nvim_create_augroup("VimMentorAutoSave", { clear = true }),
    callback = function()
      storage.force_save()
    end,
    desc = "Vim Mentor: save progress data on exit",
  })
end

--- Register all :VimMentor commands.
function M.register_commands()
  vim.api.nvim_create_user_command("VimMentor", function(args)
    local subcommand = args.fargs[1] or "toggle"
    M.handle_command(subcommand, args.fargs)
  end, {
    nargs = "*",
    complete = function(_, line)
      local subcmds = {
        "enable",
        "disable",
        "toggle",
        "level",
        "mode",
        "report",
        "reset",
        "status",
      }
      -- If a subcommand is already typed, provide sub-completions
      local parts = vim.split(line, "%s+")
      if #parts <= 2 then
        return subcmds
      end
      -- Level/mode completions
      if parts[2] == "level" or parts[2] == "mode" then
        return { "1", "2", "3", "4" }
      end
      return {}
    end,
    desc = "Vim Mentor: teaching mode for Vim operations",
  })

  -- Benchmark command
  vim.api.nvim_create_user_command("VimMentorBenchmark", function()
    M.benchmark()
  end, {
    desc = "Vim Mentor: run detection benchmark",
  })
end

--- Handle a :VimMentor subcommand.
---@param subcommand string The subcommand name
---@param args string[] All arguments
function M.handle_command(subcommand, args)
  if subcommand == "enable" then
    M.enable()
  elseif subcommand == "disable" then
    M.disable()
  elseif subcommand == "toggle" then
    M.toggle()
  elseif subcommand == "level" or subcommand == "mode" then
    local level = tonumber(args[2])
    if level and level >= 1 and level <= 4 then
      M.set_level(level)
    else
      vim.notify(
        "Vim Mentor: level must be 1-4 (1=Gentle, 2=Moderate, 3=Strict, 4=Master)",
        vim.log.levels.WARN
      )
    end
  elseif subcommand == "report" then
    M.report()
  elseif subcommand == "reset" then
    M.reset()
  elseif subcommand == "status" then
    M.status()
  else
    vim.notify(
      "Vim Mentor: unknown command '" .. subcommand .. "'. "
        .. "Available: enable, disable, toggle, level, mode, report, reset, status",
      vim.log.levels.WARN
    )
  end
end

--- Enable the plugin (set up input detection).
function M.enable()
  if enabled then
    vim.notify("Vim Mentor: already enabled", vim.log.levels.INFO)
    return
  end

  local config = require("vim-mentor.config")
  local cfg = config.get()
  local input = require("vim-mentor.input")
  input.setup(cfg)
  enabled = true
  vim.notify("Vim Mentor: enabled", vim.log.levels.INFO)
end

--- Disable the plugin (remove input detection).
function M.disable()
  if not enabled then
    vim.notify("Vim Mentor: already disabled", vim.log.levels.INFO)
    return
  end

  local input = require("vim-mentor.input")
  input.teardown()
  enabled = false
  vim.notify("Vim Mentor: disabled", vim.log.levels.INFO)
end

--- Toggle the plugin on/off.
function M.toggle()
  if enabled then
    M.disable()
  else
    M.enable()
  end
end

--- Check if the plugin is currently enabled.
---@return boolean
function M.is_enabled()
  return enabled
end

--- Set the teaching level (1-4).
---@param level number The teaching level
function M.set_level(level)
  local config = require("vim-mentor.config")
  local cfg = config.get()
  cfg.teaching_mode = level
  cfg.ui.levels.current = level

  local level_names = { "Gentle", "Moderate", "Strict", "Master" }
  vim.notify(
    string.format("Vim Mentor: level set to %d (%s)", level, level_names[level]),
    vim.log.levels.INFO
  )
end

--- Open the progress dashboard.
function M.report()
  local ok, progress = pcall(require, "vim-mentor.ui.progress")
  if ok then
    progress.open_dashboard()
  else
    vim.notify("Vim Mentor: failed to open dashboard", vim.log.levels.ERROR)
  end
end

--- Reset all progress data.
function M.reset()
  vim.ui.input({ prompt = "Reset all Vim Mentor progress? (yes/no): " }, function(input)
    if input and input:lower() == "yes" then
      local storage = require("vim-mentor.storage")
      local default = {
        commands = {},
        sessions = {},
        level = 1,
        lifetime = {
          correct = 0,
          incorrect = 0,
          best_streak = 0,
          total_sessions = 0,
        },
      }
      storage.save(default, function(err)
        vim.schedule(function()
          if err then
            vim.notify("Vim Mentor: failed to reset progress", vim.log.levels.ERROR)
          else
            vim.notify("Vim Mentor: progress has been reset", vim.log.levels.INFO)
          end
        end)
      end)

      -- Reset session feedback
      local ok_fb, feedback = pcall(require, "vim-mentor.ui.feedback")
      if ok_fb then
        feedback.reset_session()
      end

      -- Reset detector state
      local ok_det, detector = pcall(require, "vim-mentor.detector")
      if ok_det then
        detector.reset()
      end
    end
  end)
end

--- Show current plugin status.
function M.status()
  local config = require("vim-mentor.config")
  local cfg = config.get()
  local level_names = { "Gentle", "Moderate", "Strict", "Master" }
  local level = cfg.teaching_mode

  local ok_fb, feedback = pcall(require, "vim-mentor.ui.feedback")
  local stats = ok_fb and feedback.get_stats() or { streak = 0, total_correct = 0, total_incorrect = 0, accuracy = 0 }

  local lines = {
    "Vim Mentor Status:",
    string.format("  Enabled:    %s", enabled and "yes" or "no"),
    string.format("  Level:      %d (%s)", level, level_names[level] or "?"),
    string.format("  Streak:     %d", stats.streak),
    string.format("  Correct:    %d", stats.total_correct),
    string.format("  Incorrect:  %d", stats.total_incorrect),
    string.format("  Accuracy:   %d%%", stats.accuracy),
  }
  vim.notify(table.concat(lines, "\n"), vim.log.levels.INFO)
end

--- Run a simple benchmark of the detection pipeline.
function M.benchmark()
  local detector = require("vim-mentor.detector")
  local suggestion = require("vim-mentor.suggestion")

  local iterations = 10000
  local test_keys = { "<Up>", "<Down>", "<Left>", "<Right>", "<Home>", "<End>" }

  local start = vim.uv.hrtime()

  for i = 1, iterations do
    local key = test_keys[(i % #test_keys) + 1]
    local detection = detector.detect(key, "n")
    if detection then
      suggestion.suggest(detection)
    end
  end

  local elapsed_ns = vim.uv.hrtime() - start
  local elapsed_ms = elapsed_ns / 1e6
  local per_op_us = (elapsed_ns / iterations) / 1e3

  vim.notify(
    string.format(
      "Vim Mentor Benchmark:\n"
        .. "  %d iterations in %.2f ms\n"
        .. "  %.2f us per detection+suggestion",
      iterations, elapsed_ms, per_op_us
    ),
    vim.log.levels.INFO
  )

  detector.reset()
end

return M
