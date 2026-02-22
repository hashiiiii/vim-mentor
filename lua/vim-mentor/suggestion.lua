-- vim-mentor/suggestion.lua
-- Suggestion engine
-- Given a detection from detector.lua, generates the optimal Vim command suggestion

local M = {}

local rules = require("vim-mentor.rules")

--- Generate a hint suggestion for a detected non-Vim operation.
--- Takes a detection table from detector.lua and returns a hint table
--- suitable for interaction.on_non_vim_detected().
---
---@param detection table Detection from detector.lua:
---   { type = "arrow_key", key = "<Down>", context = { repeat_count, cursor_pos, mode, ... } }
---@return table|nil hint Hint table for the UI, or nil if no suggestion available:
---   { detected = string, keys = string, command = string,
---     desc = string, extended_desc = string, related = table[], level = number }
function M.suggest(detection)
  if not detection or not detection.type then
    return nil
  end

  local context = detection.context or {}
  local hint = rules.get_suggestion(detection.type, context)

  if not hint then
    return nil
  end

  -- If we have a repeat count in context, insert it into the suggestion display
  if context.repeat_count and context.repeat_count >= 3 then
    local count = context.repeat_count
    -- For count-based suggestions, substitute the actual count into {count}
    if hint.keys and hint.keys:find("{count}") then
      hint.keys = hint.keys:gsub("{count}", tostring(count))
    end
    if hint.command and hint.command:find("{count}") then
      hint.command = hint.command:gsub("{count}", tostring(count))
    end
  end

  return hint
end

return M
