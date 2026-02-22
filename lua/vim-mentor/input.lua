-- vim-mentor/input.lua
-- Input layer
-- Sets up keymaps and vim.on_key() callback for non-Vim operation detection

local M = {}

local handler = require("vim-mentor.handler")

-- Track installed keymaps for teardown
local installed_maps = {}

-- Track the vim.on_key namespace id
local on_key_ns = nil

-- Vim equivalents for blocked keys
local vim_equivalents = {
  ["<Up>"] = "k",
  ["<Down>"] = "j",
  ["<Left>"] = "h",
  ["<Right>"] = "l",
  ["<Home>"] = "0",
  ["<End>"] = "$",
  ["<PageUp>"] = "<C-u>",
  ["<PageDown>"] = "<C-d>",
  ["<LeftMouse>"] = nil, -- Mouse has no simple equivalent
  ["<ScrollWheelUp>"] = "<C-y>",
  ["<ScrollWheelDown>"] = "<C-e>",
  ["<C-Left>"] = "b",
  ["<C-Right>"] = "w",
  ["<C-Up>"] = "{",
  ["<C-Down>"] = "}",
}

--- Install a keymap for a blocked key in the specified modes.
---@param key string The key to map
---@param modes string[] The modes to install in
local function install_keymap(key, modes)
  local vim_equiv = vim_equivalents[key]
  for _, mode in ipairs(modes) do
    vim.keymap.set(mode, key, function()
      handler.on_blocked_key(key, vim_equiv)
    end, {
      desc = "Vim Mentor: detect " .. key,
      silent = true,
    })
    table.insert(installed_maps, { mode = mode, lhs = key })
  end
end

--- Set up all keymaps and callbacks based on configuration.
---@param config table The plugin configuration
function M.setup(config)
  local blocked = config.blocked_keys
  local modes = { "n", "v", "x" }

  -- Arrow keys
  if blocked.arrow_keys then
    install_keymap("<Up>", modes)
    install_keymap("<Down>", modes)
    install_keymap("<Left>", modes)
    install_keymap("<Right>", modes)
  end

  -- Home / End
  if blocked.home_end then
    install_keymap("<Home>", modes)
    install_keymap("<End>", modes)
  end

  -- Page Up / Page Down
  if blocked.page_keys then
    install_keymap("<PageUp>", modes)
    install_keymap("<PageDown>", modes)
  end

  -- Mouse
  if blocked.mouse then
    install_keymap("<LeftMouse>", { "n" })
    install_keymap("<ScrollWheelUp>", { "n" })
    install_keymap("<ScrollWheelDown>", { "n" })
  end

  -- Ctrl + Arrow keys
  if blocked.ctrl_arrow then
    install_keymap("<C-Left>", modes)
    install_keymap("<C-Right>", modes)
    install_keymap("<C-Up>", modes)
    install_keymap("<C-Down>", modes)
  end

  -- hjkl repeat detection via vim.on_key()
  if blocked.hjkl_repeat then
    on_key_ns = vim.on_key(function(raw_key)
      -- Convert the raw byte to a readable key
      local key = vim.fn.keytrans(raw_key)
      -- Only process single-character hjkl keys
      if key == "h" or key == "j" or key == "k" or key == "l" then
        -- Schedule to avoid issues with fast event context
        vim.schedule(function()
          handler.on_key_pattern(key)
        end)
      end
    end)
  end
end

--- Remove all installed keymaps and vim.on_key callbacks.
function M.teardown()
  -- Remove keymaps
  for _, map in ipairs(installed_maps) do
    pcall(vim.keymap.del, map.mode, map.lhs)
  end
  installed_maps = {}

  -- Remove vim.on_key callback
  if on_key_ns then
    pcall(vim.on_key, nil, on_key_ns)
    on_key_ns = nil
  end
end

return M
