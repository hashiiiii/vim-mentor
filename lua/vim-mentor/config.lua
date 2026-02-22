-- vim-mentor/config.lua
-- Configuration management module
-- Merges user options with defaults, provides config access

local M = {}

--- @type table|nil
local current_config = nil

-- Default configuration
M.defaults = {
  -- Teaching mode: 1=Gentle, 2=Moderate, 3=Strict, 4=Master
  teaching_mode = 2,

  -- Automatically advance teaching level based on progress
  auto_advance = true,

  -- Number of correct inputs needed to advance to next level
  advance_threshold = 50,

  -- Which non-Vim keys to block/detect
  blocked_keys = {
    arrow_keys = true,
    mouse = true,
    page_keys = true,
    home_end = true,
    ctrl_arrow = true,
    hjkl_repeat = true,
  },

  -- Filetypes where vim-mentor should not activate
  excluded_filetypes = {
    "NvimTree",
    "TelescopePrompt",
    "lazy",
    "mason",
    "help",
    "qf",
    "fugitive",
    "neo-tree",
    "dashboard",
    "alpha",
    "notify",
    "packer",
    "toggleterm",
  },

  -- Threshold for detecting hjkl repeat abuse
  hjkl_repeat_threshold = 4,

  -- UI config (merged from ui/init.lua defaults at setup time)
  ui = {},

  -- Path for persistent progress data
  data_path = vim.fn.stdpath("data") .. "/vim-mentor/progress.json",
}

--- Deep merge two tables, with right side taking precedence.
--- Arrays (integer-indexed) are replaced entirely, not merged.
---@param base table The base/default table
---@param override table The override table
---@return table The merged result
local function deep_merge(base, override)
  local result = vim.tbl_deep_extend("force", base, override)
  return result
end

--- Initialize configuration by merging user options with defaults.
--- Also merges in the UI defaults from ui/init.lua.
---@param opts table|nil User configuration options
---@return table The merged configuration
function M.setup(opts)
  opts = opts or {}

  -- Start with our defaults
  local merged = vim.deepcopy(M.defaults)

  -- Merge in UI defaults from the ui module
  local ui_defaults = require("vim-mentor.ui").defaults
  merged.ui = vim.deepcopy(ui_defaults)

  -- Apply the teaching_mode to the UI levels
  merged.ui.levels.current = merged.teaching_mode
  merged.ui.levels.auto_advance = merged.auto_advance
  merged.ui.levels.advance_threshold = merged.advance_threshold

  -- Sync data_path into ui.progress.data_path
  merged.ui.progress.data_path = merged.data_path

  -- Now merge user options on top
  if opts.ui then
    merged.ui = deep_merge(merged.ui, opts.ui)
  end

  -- Merge top-level options (excluding ui, which was already handled)
  for key, value in pairs(opts) do
    if key ~= "ui" then
      if type(value) == "table" and type(merged[key]) == "table" then
        merged[key] = deep_merge(merged[key], value)
      else
        merged[key] = value
      end
    end
  end

  -- Ensure teaching_mode is reflected in UI levels
  merged.ui.levels.current = merged.teaching_mode
  merged.ui.levels.auto_advance = merged.auto_advance
  merged.ui.levels.advance_threshold = merged.advance_threshold
  merged.ui.progress.data_path = merged.data_path

  current_config = merged
  return merged
end

--- Get the current configuration.
--- Returns defaults if setup() has not been called yet.
---@return table The current configuration
function M.get()
  if not current_config then
    return M.defaults
  end
  return current_config
end

--- Check if the current buffer's filetype is in the excluded list.
---@return boolean True if the current filetype is excluded
function M.is_excluded()
  local cfg = M.get()
  local ft = vim.bo.filetype
  if not ft or ft == "" then
    return false
  end
  for _, excluded in ipairs(cfg.excluded_filetypes) do
    if ft == excluded then
      return true
    end
  end
  return false
end

return M
