-- vim-mentor/health.lua
-- :checkhealth integration for vim-mentor
-- Validates environment, dependencies, and plugin status

local M = {}

--- Run all health checks for the vim-mentor plugin.
function M.check()
  vim.health.start("vim-mentor")

  -- Check Neovim version
  M.check_neovim_version()

  -- Check vim.on_key availability
  M.check_on_key()

  -- Check data directory
  M.check_data_directory()

  -- Check plugin status
  M.check_plugin_status()
end

--- Verify Neovim version is >= 0.10.0
function M.check_neovim_version()
  local version = vim.version()
  local major = version.major
  local minor = version.minor

  if major > 0 or (major == 0 and minor >= 10) then
    vim.health.ok(
      string.format("Neovim version %d.%d.%d (>= 0.10.0)", major, minor, version.patch)
    )
  else
    vim.health.error(
      string.format(
        "Neovim version %d.%d.%d is too old. Requires >= 0.10.0",
        major, minor, version.patch
      ),
      { "Update Neovim to version 0.10.0 or later" }
    )
  end
end

--- Check that vim.on_key() is available (needed for hjkl repeat detection)
function M.check_on_key()
  if vim.on_key then
    vim.health.ok("vim.on_key() is available")
  else
    vim.health.warn(
      "vim.on_key() is not available",
      { "hjkl repeat detection will not work", "Update Neovim to 0.10.0+" }
    )
  end
end

--- Check that the data directory is writable
function M.check_data_directory()
  local ok_config, config = pcall(require, "vim-mentor.config")
  local data_path
  if ok_config then
    data_path = config.get().data_path
  else
    data_path = vim.fn.stdpath("data") .. "/vim-mentor/progress.json"
  end

  local dir = vim.fn.fnamemodify(data_path, ":h")

  -- Check if directory exists or can be created
  if vim.fn.isdirectory(dir) == 1 then
    -- Check if writable
    local test_file = dir .. "/.vim-mentor-health-check"
    local f = io.open(test_file, "w")
    if f then
      f:close()
      os.remove(test_file)
      vim.health.ok("Data directory is writable: " .. dir)
    else
      vim.health.error(
        "Data directory is not writable: " .. dir,
        { "Check file permissions for: " .. dir }
      )
    end
  else
    -- Try to create
    local ok_mkdir = pcall(vim.fn.mkdir, dir, "p")
    if ok_mkdir and vim.fn.isdirectory(dir) == 1 then
      vim.health.ok("Data directory created: " .. dir)
    else
      vim.health.error(
        "Cannot create data directory: " .. dir,
        { "Manually create the directory: mkdir -p " .. dir }
      )
    end
  end

  vim.health.info("Data file path: " .. data_path)
end

--- Report current plugin status
function M.check_plugin_status()
  local ok_init, init = pcall(require, "vim-mentor")
  if not ok_init then
    vim.health.info("Plugin module not loaded yet (this is normal before setup)")
    return
  end

  if init.is_enabled and init.is_enabled() then
    vim.health.ok("Plugin is enabled and active")
  else
    vim.health.info("Plugin is loaded but not currently enabled")
  end

  -- Check config
  local ok_config, config = pcall(require, "vim-mentor.config")
  if ok_config then
    local cfg = config.get()
    local level_names = { "Gentle", "Moderate", "Strict", "Master" }
    local level = cfg.teaching_mode or 1
    vim.health.info(
      string.format("Teaching mode: %d (%s)", level, level_names[level] or "Unknown")
    )
    vim.health.info("Auto-advance: " .. tostring(cfg.auto_advance))

    -- Report blocked keys
    local blocked = {}
    for key, enabled in pairs(cfg.blocked_keys) do
      if enabled then
        table.insert(blocked, key)
      end
    end
    vim.health.info("Blocked keys: " .. table.concat(blocked, ", "))

    -- Report excluded filetypes
    vim.health.info(
      "Excluded filetypes: " .. table.concat(cfg.excluded_filetypes, ", ")
    )
  end
end

return M
