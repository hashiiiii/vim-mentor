-- vim-mentor/ui/init.lua
-- UI Module Entry Point
-- Coordinates all UI components for the Vim learning mentor

local M = {}

-- Sub-module lazy loading
local function require_sub(name)
  return require("vim-mentor.ui." .. name)
end

--- Setup all UI components with user configuration
---@param opts table User configuration options
function M.setup(opts)
  opts = opts or {}

  -- Merge with defaults
  M.config = vim.tbl_deep_extend("force", M.defaults, opts)

  -- Initialize sub-modules
  require_sub("hint_popup").setup(M.config)
  require_sub("statusline").setup(M.config)
  require_sub("progress").setup(M.config)
  require_sub("feedback").setup(M.config)
end

-- Default configuration
M.defaults = {
  -- ============================================================
  -- Display Mode: which UI element to use for showing hints
  -- Options: "floating" | "virtual_text" | "statusline" | "combo"
  -- ============================================================
  display_mode = "combo",

  -- ============================================================
  -- Floating Window (Primary Hint Display)
  -- ============================================================
  floating = {
    enabled = true,
    -- Position relative to cursor or editor
    -- "cursor" : appears near the cursor (like which-key)
    -- "editor" : appears at a fixed position (like nvim-notify)
    relative = "cursor",
    -- Anchor point when relative = "cursor"
    anchor = "SW",  -- South-West: popup appears above-right of cursor
    row_offset = -2,
    col_offset = 1,
    -- Window dimensions
    width = "auto",   -- "auto" or number
    max_width = 60,
    min_width = 30,
    -- Appearance
    border = "rounded",  -- "none"|"single"|"double"|"rounded"|"solid"|"shadow"
    -- Styling
    winblend = 10,       -- Transparency (0=opaque, 100=invisible)
    -- Highlight groups (user-overridable)
    highlights = {
      border     = "VimMentorBorder",
      background = "VimMentorFloat",
      title      = "VimMentorTitle",
      command    = "VimMentorCommand",
      key        = "VimMentorKey",
      desc       = "VimMentorDesc",
      detected   = "VimMentorDetected",
      success    = "VimMentorSuccess",
      streak     = "VimMentorStreak",
    },
    -- Auto-close after N milliseconds (0 = wait for correct input)
    timeout = 0,
    -- Animation (requires nvim 0.10+)
    animation = {
      enabled = true,
      style = "fade_in",  -- "fade_in" | "slide_down" | "none"
      duration = 150,      -- milliseconds
    },
  },

  -- ============================================================
  -- Virtual Text (Inline Diagnostics Style)
  -- ============================================================
  virtual_text = {
    enabled = true,
    -- Displayed on the line where the incorrect operation occurred
    prefix = " ",
    -- Highlight group
    hl_group = "VimMentorVirtualText",
    -- Position: "eol" (end of line) or "overlay" (at cursor column)
    position = "eol",
  },

  -- ============================================================
  -- Status Line Component
  -- ============================================================
  statusline = {
    enabled = true,
    -- Show current learning level
    show_level = true,
    -- Show streak counter
    show_streak = true,
    -- Show last hint summary
    show_last_hint = true,
    -- Icons (requires nerd font)
    icons = {
      blocked  = " ",
      hint     = " ",
      streak   = " ",
      level    = " ",
      success  = " ",
    },
  },

  -- ============================================================
  -- Severity / Teaching Levels
  -- ============================================================
  levels = {
    -- Level 1: Gentle - show hint, allow the non-Vim action
    -- Level 2: Moderate - show hint, delay the action by 1 second
    -- Level 3: Strict - show hint, block until correct Vim input
    -- Level 4: Master - block silently, expect you to know
    current = 1,
    auto_advance = true,      -- Automatically increase level based on progress
    advance_threshold = 50,   -- Correct inputs needed to advance
  },

  -- ============================================================
  -- Interaction / Blocking Behavior
  -- ============================================================
  interaction = {
    -- Allow skip with <Esc> (only in levels 1-2)
    allow_skip = true,
    -- Show "press <Esc> to skip" text
    show_skip_hint = true,
    -- Timeout in ms before auto-dismissing (0 = no timeout, level 3+ ignores this)
    timeout = 5000,
    -- Max consecutive failures before showing extended help
    escalation_threshold = 3,
    -- What happens on escalation
    escalation_action = "extended_help",  -- "extended_help" | "lower_level" | "demo"
  },

  -- ============================================================
  -- Positive Feedback
  -- ============================================================
  feedback = {
    enabled = true,
    -- Flash the correct command briefly on success
    success_flash = true,
    success_flash_duration = 300,  -- ms
    -- Streak tracking
    streak = {
      enabled = true,
      -- Milestones that trigger special feedback
      milestones = { 5, 10, 25, 50, 100 },
    },
    -- Sound feedback (requires 'sox' or system bell)
    sound = {
      enabled = false,
      on_success = "pop",
      on_milestone = "levelup",
    },
  },

  -- ============================================================
  -- Progress / Dashboard
  -- ============================================================
  progress = {
    -- Persistent storage for learning stats
    data_path = vim.fn.stdpath("data") .. "/vim-mentor/progress.json",
    -- Dashboard command (:VimMentorDashboard)
    dashboard = {
      enabled = true,
      width = 80,
      height = 30,
    },
  },
}

return M
