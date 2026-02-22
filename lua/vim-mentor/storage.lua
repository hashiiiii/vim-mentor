-- vim-mentor/storage.lua
-- Async data persistence using vim.uv (libuv)
-- Handles loading and saving progress data to JSON

local M = {}

local config_ref = nil
local current_data = nil
local save_timer = nil
local SAVE_INTERVAL_MS = 5 * 60 * 1000 -- 5 minutes

--- Default data structure for progress tracking.
---@return table
local function default_data()
  return {
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
end

--- Ensure the directory for the data file exists.
---@param path string The full file path
local function ensure_directory(path)
  local dir = vim.fn.fnamemodify(path, ":h")
  if vim.fn.isdirectory(dir) == 0 then
    vim.fn.mkdir(dir, "p")
  end
end

--- Asynchronously read a file using vim.uv.
---@param path string The file path to read
---@param callback function Called with (err, data) when complete
local function async_read(path, callback)
  vim.uv.fs_open(path, "r", 438, function(err_open, fd)
    if err_open or not fd then
      callback(err_open or "failed to open file", nil)
      return
    end

    vim.uv.fs_fstat(fd, function(err_stat, stat)
      if err_stat or not stat then
        vim.uv.fs_close(fd)
        callback(err_stat or "failed to stat file", nil)
        return
      end

      vim.uv.fs_read(fd, stat.size, 0, function(err_read, data)
        vim.uv.fs_close(fd)
        if err_read then
          callback(err_read, nil)
          return
        end
        callback(nil, data)
      end)
    end)
  end)
end

--- Asynchronously write data to a file using vim.uv.
---@param path string The file path to write
---@param content string The content to write
---@param callback function|nil Called with (err) when complete
local function async_write(path, content, callback)
  callback = callback or function() end

  vim.uv.fs_open(path, "w", 438, function(err_open, fd)
    if err_open or not fd then
      vim.schedule(function()
        callback(err_open or "failed to open file for writing")
      end)
      return
    end

    vim.uv.fs_write(fd, content, 0, function(err_write)
      vim.uv.fs_close(fd)
      vim.schedule(function()
        callback(err_write)
      end)
    end)
  end)
end

--- Initialize the storage module.
---@param config table The plugin configuration
function M.setup(config)
  config_ref = config
  -- Load data on setup
  M.load()
  -- Start the periodic save timer
  M.schedule_save()
end

--- Asynchronously load progress data from the JSON file.
--- Falls back to default data if the file does not exist or is invalid.
---@param callback function|nil Optional callback with (data)
function M.load(callback)
  local path = config_ref and config_ref.data_path
    or (vim.fn.stdpath("data") .. "/vim-mentor/progress.json")

  async_read(path, function(err, content)
    vim.schedule(function()
      if err or not content or content == "" then
        current_data = default_data()
      else
        local ok, decoded = pcall(vim.json.decode, content)
        if ok and type(decoded) == "table" then
          -- Merge with defaults to fill in any missing fields
          current_data = vim.tbl_deep_extend("keep", decoded, default_data())
        else
          current_data = default_data()
        end
      end

      if callback then
        callback(current_data)
      end
    end)
  end)
end

--- Asynchronously save data to the JSON file.
---@param data table|nil The data to save (uses current_data if nil)
---@param callback function|nil Optional callback with (err)
function M.save(data, callback)
  data = data or current_data
  if not data then
    if callback then callback(nil) end
    return
  end

  local path = config_ref and config_ref.data_path
    or (vim.fn.stdpath("data") .. "/vim-mentor/progress.json")

  ensure_directory(path)

  local ok, encoded = pcall(vim.json.encode, data)
  if not ok then
    vim.notify("Vim Mentor: Failed to encode progress data", vim.log.levels.WARN)
    if callback then callback("json encode error") end
    return
  end

  async_write(path, encoded, callback)
end

--- Update statistics for a specific command.
---@param command string The Vim command (e.g. "j", "w", "<C-d>")
---@param was_correct boolean Whether the user entered the correct command
function M.update_stats(command, was_correct)
  if not current_data then
    current_data = default_data()
  end

  -- Initialize command entry if it does not exist
  if not current_data.commands[command] then
    current_data.commands[command] = {
      correct = 0,
      prompted = 0,
      last_seen = nil,
    }
  end

  local cmd_stats = current_data.commands[command]
  cmd_stats.last_seen = os.time()

  if was_correct then
    cmd_stats.correct = cmd_stats.correct + 1
    current_data.lifetime.correct = current_data.lifetime.correct + 1
  else
    cmd_stats.prompted = cmd_stats.prompted + 1
    current_data.lifetime.incorrect = current_data.lifetime.incorrect + 1
  end

  -- Update best streak from the feedback module
  local ok, feedback = pcall(require, "vim-mentor.ui.feedback")
  if ok then
    local streak = feedback.get_streak()
    if streak > current_data.lifetime.best_streak then
      current_data.lifetime.best_streak = streak
    end
  end
end

--- Get the current progress data.
---@return table The current data (or default if not loaded yet)
function M.get_data()
  if not current_data then
    current_data = default_data()
  end
  return current_data
end

--- Schedule periodic saves using a debounced timer.
--- Saves every 5 minutes to avoid excessive disk I/O.
function M.schedule_save()
  if save_timer then
    save_timer:stop()
    save_timer:close()
  end

  save_timer = vim.uv.new_timer()
  if save_timer then
    save_timer:start(SAVE_INTERVAL_MS, SAVE_INTERVAL_MS, function()
      vim.schedule(function()
        M.save()
      end)
    end)
  end
end

--- Force an immediate save (used during shutdown).
function M.force_save()
  if not current_data then
    return
  end

  local path = config_ref and config_ref.data_path
    or (vim.fn.stdpath("data") .. "/vim-mentor/progress.json")

  ensure_directory(path)

  local ok, encoded = pcall(vim.json.encode, current_data)
  if not ok then
    return
  end

  -- Synchronous write for shutdown
  local f = io.open(path, "w")
  if f then
    f:write(encoded)
    f:close()
  end
end

--- Clean up timers (called on plugin disable/teardown).
function M.teardown()
  if save_timer then
    save_timer:stop()
    save_timer:close()
    save_timer = nil
  end

  -- Do a final save
  M.force_save()
end

return M
