-- plugin/vim-mentor.lua
-- Minimal entry point for lazy loading
-- Registers the VimMentor command for deferred setup

-- Guard against double loading
if vim.g.loaded_vim_mentor then
  return
end
vim.g.loaded_vim_mentor = true

-- Register the VimMentor command (triggers lazy loading of the plugin)
vim.api.nvim_create_user_command("VimMentor", function(args)
  -- Load the plugin if not already loaded
  local ok, vim_mentor = pcall(require, "vim-mentor")
  if not ok then
    vim.notify("Vim Mentor: failed to load plugin module", vim.log.levels.ERROR)
    return
  end

  -- If setup has not been called yet, run it with defaults
  if not vim_mentor.is_enabled() then
    vim_mentor.setup()
  end

  -- Forward the command to the plugin handler
  local subcommand = args.fargs[1] or "toggle"
  vim_mentor.handle_command(subcommand, args.fargs)
end, {
  nargs = "*",
  complete = function()
    return {
      "enable",
      "disable",
      "toggle",
      "level",
      "mode",
      "report",
      "reset",
      "status",
    }
  end,
  desc = "Vim Mentor: teaching mode for Vim operations",
})
