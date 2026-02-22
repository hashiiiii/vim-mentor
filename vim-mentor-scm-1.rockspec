rockspec_format = "3.0"
package = "vim-mentor"
version = "scm-1"

source = {
  url = "git+https://github.com/vim-mentor/vim-mentor",
}

description = {
  summary = "A real-time Vim operation teaching plugin for Neovim",
  detailed = [[
    vim-mentor detects non-Vim operations (arrow keys, mouse, etc.)
    during actual coding and teaches correct Vim commands through
    contextual suggestions, blocking, and gamification.
  ]],
  labels = { "neovim", "vim", "learning", "education", "plugin" },
  homepage = "https://github.com/vim-mentor/vim-mentor",
  license = "MIT",
}

dependencies = {
  "lua >= 5.1",
}

build = {
  type = "builtin",
}
