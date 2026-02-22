-- vim-mentor/ui/statusline.lua
-- Statusline component for Vim Mentor
-- Provides lualine-compatible components and raw statusline functions
-- Inspired by trouble.nvim's statusline integration

local M = {}

local config = {}

-- ============================================================
-- Statusline Component Functions
-- Each returns a string suitable for statusline display
-- ============================================================

--- Get the current learning level indicator
---@return string Formatted level string with icon
function M.level()
  if not config.statusline.enabled or not config.statusline.show_level then
    return ""
  end

  local level = config.levels.current
  local names = { "Gentle", "Moderate", "Strict", "Master" }
  local icon = config.statusline.icons.level

  return string.format("%s%d:%s", icon, level, names[level] or "?")
end

--- Get the current streak counter
---@return string Formatted streak string with icon
function M.streak()
  if not config.statusline.enabled or not config.statusline.show_streak then
    return ""
  end

  local feedback = require("vim-mentor.ui.feedback")
  local count = feedback.get_streak()
  local icon = config.statusline.icons.streak

  if count == 0 then
    return ""
  end

  return string.format("%s%d", icon, count)
end

--- Get the last hint summary (brief one-line version)
---@return string Short hint text
function M.last_hint()
  if not config.statusline.enabled or not config.statusline.show_last_hint then
    return ""
  end

  -- This will be populated by the hint detection system
  local hint_popup = require("vim-mentor.ui.hint_popup")
  if not hint_popup.is_visible() then
    return ""
  end

  local icon = config.statusline.icons.blocked
  return string.format("%sBlocked: use Vim motion", icon)
end

--- Get a combined statusline string
---@return string Full statusline component
function M.get()
  if not config.statusline.enabled then
    return ""
  end

  local parts = {}
  local level_str = M.level()
  local streak_str = M.streak()
  local hint_str = M.last_hint()

  if level_str ~= "" then
    table.insert(parts, level_str)
  end
  if streak_str ~= "" then
    table.insert(parts, streak_str)
  end
  if hint_str ~= "" then
    table.insert(parts, hint_str)
  end

  if #parts == 0 then
    return ""
  end

  return table.concat(parts, "  ")
end

-- ============================================================
-- lualine.nvim Integration
-- Usage in lualine config:
--   sections = {
--     lualine_x = {
--       { require("vim-mentor.ui.statusline").lualine },
--     },
--   }
-- ============================================================

--- Lualine-compatible component table
M.lualine = {
  function()
    return M.get()
  end,
  cond = function()
    return config.statusline.enabled
  end,
  color = function()
    local level = config.levels.current
    local colors = {
      { fg = "#9ece6a" }, -- Level 1: green
      { fg = "#e0af68" }, -- Level 2: yellow
      { fg = "#ff9e64" }, -- Level 3: orange
      { fg = "#f7768e" }, -- Level 4: red
    }
    return colors[level] or colors[1]
  end,
}

-- ============================================================
-- Setup
-- ============================================================

function M.setup(opts)
  config = opts
end

return M
