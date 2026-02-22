# vim-mentor: 技術アーキテクチャ設計書

## 1. プラットフォーム選定

### 結論: Neovim専用 (Lua)

| 観点 | Vim (VimScript) | Neovim (Lua) | 判定 |
|------|-----------------|--------------|------|
| パフォーマンス | VimScriptは低速 | LuaJIT搭載で高速 | Neovim |
| API充実度 | 限定的 | `vim.api`, `vim.on_key()`, `vim.keymap.set()` 等が豊富 | Neovim |
| 非同期処理 | 困難 | `vim.schedule()`, `vim.loop` で容易 | Neovim |
| テストエコシステム | themis.vim のみ | busted, plenary, vusted 等多数 | Neovim |
| 型安全性 | なし | LuaCATS + lua-language-server | Neovim |
| コミュニティ | 縮小傾向 | 活発、プラグイン開発の主流 | Neovim |
| 参考プラグイン | vim-hardtime | hardtime.nvim (3.7k stars) | Neovim |

**理由:**

1. **`vim.on_key()` API** -- キー入力のグローバルインターセプトが可能。本プラグインの中核機能に必須。
2. **`vim.keymap.set()` API** -- モード別のキーマッピング制御がLuaで直接可能。
3. **LuaJIT** -- キー入力ごとに検出・判定処理が走るため、パフォーマンスが重要。
4. **hardtime.nvim** -- 同系統のプラグインがNeovim Luaで成功している実績。

**対象バージョン:** Neovim >= 0.10.0 (hardtime.nvim と同等)

---

## 2. キー入力の検出・インターセプト設計

### 2.1 検出対象の分類

```
非Vim操作 (検出・ブロック対象)
├── 矢印キー: <Up>, <Down>, <Left>, <Right>
├── マウス操作: <LeftMouse>, <RightMouse>, <ScrollWheelUp>, <ScrollWheelDown>
├── ページ移動: <PageUp>, <PageDown>, <Home>, <End>
├── Delete/Backspace (Normal mode): <Del>, <BS> (Normal mode時)
└── Insert mode での矢印キー移動

Vim操作 (提案する正解)
├── 基本移動: h, j, k, l
├── 単語移動: w, W, b, B, e, E, ge, gE
├── 行内移動: f, F, t, T, ;, , 0, ^, $
├── 画面移動: Ctrl-U, Ctrl-D, Ctrl-B, Ctrl-F
├── 検索移動: /, ?, n, N, *, #
├── ジャンプ: gg, G, {count}G, {count}j, {count}k
└── テキストオブジェクト: ci{, da", yiw, etc.
```

### 2.2 キーインターセプトの2段構成

**第1層: `vim.keymap.set()` による直接リマップ**

```lua
-- 矢印キーをインターセプトしてコールバックに転送
local modes = { 'n', 'v', 'x', 'o' }

vim.keymap.set(modes, '<Up>', function()
    require('vim-mentor.handler').on_blocked_key('<Up>', 'k')
end, { noremap = true, silent = true, desc = 'vim-mentor: blocked' })

vim.keymap.set(modes, '<Down>', function()
    require('vim-mentor.handler').on_blocked_key('<Down>', 'j')
end, { noremap = true, silent = true, desc = 'vim-mentor: blocked' })

-- マウスイベントの無効化
local mouse_events = {
    '<LeftMouse>', '<RightMouse>', '<MiddleMouse>',
    '<ScrollWheelUp>', '<ScrollWheelDown>',
    '<ScrollWheelLeft>', '<ScrollWheelRight>',
}
for _, event in ipairs(mouse_events) do
    vim.keymap.set(modes, event, function()
        require('vim-mentor.handler').on_blocked_mouse(event)
    end, { noremap = true, silent = true })
end
```

**第2層: `vim.on_key()` によるグローバル監視 (分析用)**

```lua
-- 学習進捗の分析用にすべてのキー入力を監視
vim.on_key(function(key, typed)
    -- バッファに記録して分析エンジンに送る
    require('vim-mentor.analyzer').record_key(key, typed)
end)
```

### 2.3 モード別の挙動制御

| モード | 矢印キー | マウス | 提案表示 |
|--------|-----------|--------|----------|
| Normal | ブロック + 提案 | ブロック + 提案 | フローティングウィンドウ |
| Visual | ブロック + 提案 | ブロック + 提案 | フローティングウィンドウ |
| Insert | 設定に依存 (デフォルトは許可) | ブロック + 提案 | バーチャルテキスト |
| Command | 許可 (ブロックしない) | 許可 | なし |
| Terminal | 許可 (ブロックしない) | 許可 | なし |

### 2.4 CursorMoved autocmd との連携

```lua
-- カーソル移動後に文脈を分析
vim.api.nvim_create_autocmd('CursorMoved', {
    group = vim.api.nvim_create_augroup('VimMentor', { clear = true }),
    callback = function()
        -- 直前のキー入力と移動距離を分析
        local ctx = require('vim-mentor.context').get_movement_context()
        require('vim-mentor.suggestion').evaluate(ctx)
    end,
})
```

---

## 3. アーキテクチャ設計

### 3.1 全体構成図

```
                        ┌─────────────────────────────────────────┐
                        │             plugin/vim-mentor.lua       │
                        │  (エントリポイント: コマンド・初期化)      │
                        └───────────────┬─────────────────────────┘
                                        │ require (遅延ロード)
                        ┌───────────────▼─────────────────────────┐
                        │        lua/vim-mentor/init.lua          │
                        │    (公開API: setup, enable, disable)     │
                        └───────────────┬─────────────────────────┘
                                        │
        ┌───────────────┬───────────────┼───────────────┬─────────────────┐
        │               │               │               │                 │
        ▼               ▼               ▼               ▼                 ▼
  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    ┌──────────────┐
  │ 入力層   │   │ 検出     │   │ 提案     │   │ UI層     │    │ 学習進捗     │
  │ input    │──▶│ detector │──▶│ suggest  │──▶│ ui       │    │ progress     │
  │          │   │          │   │          │   │          │    │              │
  │ keymap   │   │ analyze  │   │ rules    │   │ float    │    │ tracker      │
  │ on_key   │   │ context  │   │ hint_db  │   │ virtual  │    │ storage      │
  │ autocmd  │   │ pattern  │   │ score    │   │ notify   │    │ stats        │
  └──────────┘   └──────────┘   └──────────┘   └──────────┘    └──────────────┘
        │                                                              │
        │               ┌──────────────────────┐                       │
        └──────────────▶│    config            │◀──────────────────────┘
                        │ (設定・永続化管理)    │
                        └──────────────────────┘
```

### 3.2 各モジュールの責務

#### (A) `plugin/vim-mentor.lua` -- エントリポイント

**責務:** Neovim起動時の最小限のコマンド登録のみ。`require()` は遅延実行。

```lua
-- plugin/vim-mentor.lua
-- ベストプラクティス: plugin/ は最小限に保つ

vim.api.nvim_create_user_command('VimMentor', function(opts)
    require('vim-mentor').command(opts.fargs)
end, {
    nargs = '*',
    complete = function(_, line)
        return require('vim-mentor').complete(line)
    end,
    desc = 'Vim Mentor: learn Vim motions',
})
```

#### (B) `lua/vim-mentor/init.lua` -- 公開API

**責務:** ユーザーが呼び出す公開インターフェース。setup, enable, disable, command。

```lua
---@class VimMentor
local M = {}

---@param opts? vim-mentor.Config
function M.setup(opts)
    local config = require('vim-mentor.config')
    config.setup(opts)

    if config.get().enabled then
        M.enable()
    end
end

function M.enable()
    require('vim-mentor.input').attach()
    require('vim-mentor.progress').load()
    vim.g.vim_mentor_enabled = true
end

function M.disable()
    require('vim-mentor.input').detach()
    vim.g.vim_mentor_enabled = false
end

---@param args string[]
function M.command(args)
    local subcmd = args[1] or 'toggle'
    if subcmd == 'enable' then M.enable()
    elseif subcmd == 'disable' then M.disable()
    elseif subcmd == 'toggle' then
        if vim.g.vim_mentor_enabled then M.disable() else M.enable() end
    elseif subcmd == 'report' then
        require('vim-mentor.progress').show_report()
    elseif subcmd == 'level' then
        require('vim-mentor.progress').show_level()
    end
end

return M
```

#### (C) `lua/vim-mentor/input.lua` -- 入力層

**責務:** キーマッピングの設定・解除、`vim.on_key()` の管理、autocmd の登録。

```lua
---@class vim-mentor.Input
local M = {}

local ns_id = nil  -- vim.on_key の namespace
local augroup = nil

function M.attach()
    local handler = require('vim-mentor.handler')
    local config = require('vim-mentor.config').get()

    -- 1. 矢印キーのリマップ
    for _, mapping in ipairs(config.blocked_keys) do
        for _, mode in ipairs(mapping.modes) do
            vim.keymap.set(mode, mapping.lhs, function()
                handler.on_blocked_key(mapping.lhs, mapping.suggestion)
            end, { noremap = true, silent = true, desc = 'vim-mentor: blocked' })
        end
    end

    -- 2. マウスイベントのリマップ
    if config.disable_mouse then
        for _, event in ipairs(config.mouse_events) do
            vim.keymap.set({'n', 'v', 'x'}, event, function()
                handler.on_blocked_mouse(event)
            end, { noremap = true, silent = true })
        end
    end

    -- 3. vim.on_key() でグローバル監視
    ns_id = vim.on_key(function(key, typed)
        handler.on_any_key(key, typed)
    end)

    -- 4. CursorMoved autocmd
    augroup = vim.api.nvim_create_augroup('VimMentor', { clear = true })
    vim.api.nvim_create_autocmd('CursorMoved', {
        group = augroup,
        callback = function()
            handler.on_cursor_moved()
        end,
    })
    vim.api.nvim_create_autocmd('CursorMovedI', {
        group = augroup,
        callback = function()
            handler.on_cursor_moved_insert()
        end,
    })
end

function M.detach()
    -- キーマップの解除
    -- vim.on_key の解除
    if ns_id then
        vim.on_key(nil, ns_id)
        ns_id = nil
    end
    -- autocmd の解除
    if augroup then
        vim.api.nvim_del_augroup_by_id(augroup)
        augroup = nil
    end
end

return M
```

#### (D) `lua/vim-mentor/handler.lua` -- イベントハンドラ

**責務:** 入力イベントの一次処理。検出エンジンと提案エンジンへの橋渡し。

```lua
---@class vim-mentor.Handler
local M = {}

local last_key = nil
local last_pos = nil

---ブロック対象キーが押された時の処理
---@param blocked_key string 押されたキー
---@param basic_suggestion string 基本的な代替コマンド
function M.on_blocked_key(blocked_key, basic_suggestion)
    local detector = require('vim-mentor.detector')
    local suggester = require('vim-mentor.suggestion')
    local ui = require('vim-mentor.ui')
    local progress = require('vim-mentor.progress')

    -- 文脈を分析して最適な提案を生成
    local context = detector.get_context()
    local suggestion = suggester.get_suggestion(blocked_key, context)

    -- UI に表示
    ui.show_suggestion(suggestion)

    -- 学習進捗を記録
    progress.record_event({
        type = 'blocked',
        key = blocked_key,
        suggestion = suggestion,
        timestamp = vim.loop.now(),
    })
end

---マウス操作がブロックされた時の処理
---@param event string マウスイベント名
function M.on_blocked_mouse(event)
    local ui = require('vim-mentor.ui')
    local progress = require('vim-mentor.progress')

    local suggestion = require('vim-mentor.suggestion').get_mouse_suggestion(event)
    ui.show_suggestion(suggestion)

    progress.record_event({
        type = 'mouse_blocked',
        key = event,
        suggestion = suggestion,
        timestamp = vim.loop.now(),
    })
end

---すべてのキー入力の監視 (分析用)
---@param key string
---@param typed string
function M.on_any_key(key, typed)
    last_key = key
    -- パターン検出エンジンに送信
    require('vim-mentor.detector').feed_key(key, typed)
end

---CursorMoved イベント
function M.on_cursor_moved()
    local current_pos = vim.api.nvim_win_get_cursor(0)
    if last_pos then
        local delta = {
            row = current_pos[1] - last_pos[1],
            col = current_pos[2] - last_pos[2],
        }
        require('vim-mentor.detector').analyze_movement(delta, last_key)
    end
    last_pos = current_pos
end

return M
```

#### (E) `lua/vim-mentor/detector.lua` -- 検出エンジン

**責務:** キーシーケンスのパターンマッチング、非効率操作の検出。

```lua
---@class vim-mentor.Detector
local M = {}

local key_buffer = {}      -- 直近のキー入力バッファ
local BUFFER_SIZE = 20     -- 保持するキー数

---キー入力をバッファに追加
---@param key string
---@param typed string
function M.feed_key(key, typed)
    table.insert(key_buffer, {
        key = key,
        typed = typed,
        time = vim.loop.now(),
        mode = vim.api.nvim_get_mode().mode,
    })
    -- バッファサイズを超えたら古いものを削除
    if #key_buffer > BUFFER_SIZE then
        table.remove(key_buffer, 1)
    end

    -- パターンマッチングを実行
    M._check_patterns()
end

---現在のコンテキスト情報を取得
---@return vim-mentor.Context
function M.get_context()
    local cursor = vim.api.nvim_win_get_cursor(0)
    local line = vim.api.nvim_get_current_line()
    local buf_lines = vim.api.nvim_buf_line_count(0)

    return {
        cursor_row = cursor[1],
        cursor_col = cursor[2],
        current_line = line,
        line_length = #line,
        total_lines = buf_lines,
        mode = vim.api.nvim_get_mode().mode,
        filetype = vim.bo.filetype,
        key_history = key_buffer,
    }
end

---カーソル移動量を分析
---@param delta {row: number, col: number}
---@param trigger_key string|nil
function M.analyze_movement(delta, trigger_key)
    -- hjkl の連打検出 (例: jjjjj -> 5j を提案)
    local repeat_count = M._count_repeated_key(trigger_key)
    if repeat_count >= 3 then
        local suggestion = require('vim-mentor.suggestion')
        suggestion.suggest_count_prefix(trigger_key, repeat_count)
    end
end

---同一キーの連打回数をカウント
---@param key string|nil
---@return number
function M._count_repeated_key(key)
    if not key then return 0 end
    local count = 0
    for i = #key_buffer, 1, -1 do
        if key_buffer[i].key == key then
            count = count + 1
        else
            break
        end
    end
    return count
end

---非効率パターンの検出
function M._check_patterns()
    local rules = require('vim-mentor.rules')
    local sequence = M._get_recent_sequence()
    for _, rule in ipairs(rules.get_all()) do
        local match = rule.pattern:match(sequence)
        if match then
            local ui = require('vim-mentor.ui')
            ui.show_hint({
                message = rule.hint,
                better_command = rule.better,
                severity = rule.severity,
            })
        end
    end
end

return M
```

#### (F) `lua/vim-mentor/suggestion.lua` -- コマンド提案エンジン

**責務:** 文脈に基づいた最適なVimコマンドの提案生成。

```lua
---@class vim-mentor.Suggestion
local M = {}

---@alias vim-mentor.SuggestionResult { message: string, command: string, severity: 'info'|'warn'|'error' }

-- 矢印キー -> Vimコマンドの基本マッピング
local BASIC_SUGGESTIONS = {
    ['<Up>']    = { command = 'k', message = 'Use `k` to move up' },
    ['<Down>']  = { command = 'j', message = 'Use `j` to move down' },
    ['<Left>']  = { command = 'h', message = 'Use `h` to move left' },
    ['<Right>'] = { command = 'l', message = 'Use `l` to move right' },
    ['<PageUp>']   = { command = '<C-b>', message = 'Use `Ctrl-B` to page up' },
    ['<PageDown>'] = { command = '<C-f>', message = 'Use `Ctrl-F` to page down' },
    ['<Home>']  = { command = '0 or ^', message = 'Use `0` (line start) or `^` (first non-blank)' },
    ['<End>']   = { command = '$', message = 'Use `$` to move to end of line' },
}

---ブロックされたキーに対する提案を生成
---@param blocked_key string
---@param context vim-mentor.Context
---@return vim-mentor.SuggestionResult
function M.get_suggestion(blocked_key, context)
    local basic = BASIC_SUGGESTIONS[blocked_key]
    if not basic then
        return { message = 'Use Vim motions', command = '', severity = 'info' }
    end

    -- 文脈に応じた高度な提案
    local advanced = M._get_advanced_suggestion(blocked_key, context)
    if advanced then
        return advanced
    end

    return {
        message = basic.message,
        command = basic.command,
        severity = 'warn',
    }
end

---文脈に基づく高度な提案
---@param blocked_key string
---@param context vim-mentor.Context
---@return vim-mentor.SuggestionResult|nil
function M._get_advanced_suggestion(blocked_key, context)
    local level = require('vim-mentor.progress').get_level()

    -- レベル2以上: 単語単位の移動を提案
    if level >= 2 and (blocked_key == '<Right>' or blocked_key == '<Left>') then
        -- 次の単語境界までの距離を計算
        local line = context.current_line
        local col = context.cursor_col
        if blocked_key == '<Right>' then
            local next_word = line:find('%s%S', col + 1)
            if next_word and (next_word - col) > 3 then
                return {
                    message = 'Use `w` to jump to the next word',
                    command = 'w',
                    severity = 'info',
                }
            end
        end
    end

    -- レベル3以上: 検索ベースの移動を提案
    if level >= 3 then
        -- f/F/t/T の提案ロジック
    end

    return nil
end

---マウス操作に対する提案
---@param event string
---@return vim-mentor.SuggestionResult
function M.get_mouse_suggestion(event)
    local suggestions = {
        ['<ScrollWheelUp>']   = { message = 'Use `Ctrl-U` or `Ctrl-B` to scroll up', command = '<C-u>' },
        ['<ScrollWheelDown>'] = { message = 'Use `Ctrl-D` or `Ctrl-F` to scroll down', command = '<C-d>' },
        ['<LeftMouse>']       = { message = 'Use `/search` or `{count}G` to jump to a position', command = '/' },
        ['<RightMouse>']      = { message = 'Use Vim commands instead of mouse context menu', command = '' },
    }
    local s = suggestions[event] or { message = 'Avoid using the mouse', command = '' }
    return {
        message = s.message,
        command = s.command,
        severity = 'warn',
    }
end

---hjkl連打に対する count prefix 提案
---@param key string
---@param count number
function M.suggest_count_prefix(key, count)
    local ui = require('vim-mentor.ui')
    ui.show_hint({
        message = string.format('Use `%d%s` instead of pressing `%s` %d times', count, key, key, count),
        better_command = count .. key,
        severity = 'info',
    })
end

return M
```

#### (G) `lua/vim-mentor/rules.lua` -- 提案ルールデータベース

**責務:** 非効率パターンとその改善提案のルール定義。ユーザー拡張可能。

```lua
---@class vim-mentor.Rules
local M = {}

---@class vim-mentor.Rule
---@field pattern string Luaパターン
---@field hint string 表示メッセージ
---@field better string 推奨コマンド
---@field severity 'info'|'warn'|'error'
---@field level number この提案が有効になる学習レベル

local DEFAULT_RULES = {
    -- レベル1: 基本移動
    {
        pattern = 'ddi',   -- dd の後に i
        hint = 'Use `S` or `cc` to change the entire line',
        better = 'S',
        severity = 'info',
        level = 1,
    },
    {
        pattern = 'x+i',   -- x の後に i
        hint = 'Use `s` to delete character and enter insert mode',
        better = 's',
        severity = 'info',
        level = 1,
    },
    -- レベル2: 単語操作
    {
        pattern = 'dwi',
        hint = 'Use `cw` to change a word',
        better = 'cw',
        severity = 'info',
        level = 2,
    },
    -- レベル3: テキストオブジェクト
    {
        pattern = 'di.i',
        hint = 'Use `ci` + text object to change inside',
        better = 'ci{object}',
        severity = 'info',
        level = 3,
    },
}

---@return vim-mentor.Rule[]
function M.get_all()
    local config = require('vim-mentor.config').get()
    local level = require('vim-mentor.progress').get_level()

    local rules = {}
    -- デフォルトルール (現在のレベル以下)
    for _, rule in ipairs(DEFAULT_RULES) do
        if rule.level <= level then
            table.insert(rules, rule)
        end
    end
    -- ユーザー定義ルール
    for _, rule in ipairs(config.custom_rules or {}) do
        table.insert(rules, rule)
    end
    return rules
end

return M
```

#### (H) `lua/vim-mentor/ui.lua` -- UI層

**責務:** フローティングウィンドウ、バーチャルテキスト、通知の表示。

```lua
---@class vim-mentor.UI
local M = {}

local float_win = nil
local float_buf = nil
local ns = vim.api.nvim_create_namespace('vim-mentor')

---提案をフローティングウィンドウで表示
---@param suggestion vim-mentor.SuggestionResult
function M.show_suggestion(suggestion)
    local config = require('vim-mentor.config').get()

    if config.ui.style == 'float' then
        M._show_float(suggestion)
    elseif config.ui.style == 'virtual' then
        M._show_virtual_text(suggestion)
    elseif config.ui.style == 'notify' then
        vim.notify(suggestion.message, vim.log.levels.WARN, { title = 'vim-mentor' })
    end

    -- 自動非表示タイマー
    vim.defer_fn(function()
        M.hide()
    end, config.ui.timeout)
end

---フローティングウィンドウ表示
---@param suggestion vim-mentor.SuggestionResult
function M._show_float(suggestion)
    -- 既存のウィンドウがあれば閉じる
    M.hide()

    local lines = { suggestion.message }
    if suggestion.command ~= '' then
        table.insert(lines, '')
        table.insert(lines, '  -> ' .. suggestion.command)
    end

    float_buf = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_buf_set_lines(float_buf, 0, -1, false, lines)

    local width = 0
    for _, line in ipairs(lines) do
        width = math.max(width, #line)
    end

    float_win = vim.api.nvim_open_win(float_buf, false, {
        relative = 'cursor',
        row = 1,
        col = 0,
        width = width + 2,
        height = #lines,
        style = 'minimal',
        border = 'rounded',
        focusable = false,
    })

    -- ハイライト設定
    vim.api.nvim_win_set_option(float_win, 'winhl', 'Normal:VimMentorFloat,FloatBorder:VimMentorBorder')
end

---バーチャルテキスト表示
---@param suggestion vim-mentor.SuggestionResult
function M._show_virtual_text(suggestion)
    vim.api.nvim_buf_clear_namespace(0, ns, 0, -1)
    local row = vim.api.nvim_win_get_cursor(0)[1] - 1
    vim.api.nvim_buf_set_extmark(0, ns, row, 0, {
        virt_text = { { suggestion.message, 'VimMentorHint' } },
        virt_text_pos = 'eol',
    })
end

---ヒント表示 (パターン検出時)
---@param hint { message: string, better_command: string, severity: string }
function M.show_hint(hint)
    M.show_suggestion({
        message = hint.message,
        command = hint.better_command,
        severity = hint.severity,
    })
end

---表示をクリア
function M.hide()
    if float_win and vim.api.nvim_win_is_valid(float_win) then
        vim.api.nvim_win_close(float_win, true)
        float_win = nil
    end
    if float_buf and vim.api.nvim_buf_is_valid(float_buf) then
        vim.api.nvim_buf_delete(float_buf, { force = true })
        float_buf = nil
    end
    vim.api.nvim_buf_clear_namespace(0, ns, 0, -1)
end

return M
```

#### (I) `lua/vim-mentor/progress.lua` -- 学習進捗管理

**責務:** 学習レベルの管理、統計の記録、永続化。

```lua
---@class vim-mentor.Progress
local M = {}

---@class vim-mentor.ProgressData
---@field level number 現在の学習レベル (1-5)
---@field total_blocked number ブロックされた操作の総数
---@field total_correct number 正しいVim操作の総数
---@field streak number 連続正解数
---@field best_streak number 最高連続正解数
---@field events vim-mentor.Event[] 直近のイベント
---@field daily_stats table<string, vim-mentor.DailyStat> 日別統計

local data = nil  -- ProgressData

-- レベル定義
local LEVELS = {
    { name = 'Beginner',     threshold = 0,    description = 'Learn h/j/k/l basics' },
    { name = 'Novice',       threshold = 50,   description = 'Word motions (w/b/e)' },
    { name = 'Intermediate', threshold = 150,  description = 'Search & find (f/t//?)' },
    { name = 'Advanced',     threshold = 300,  description = 'Text objects & operators' },
    { name = 'Expert',       threshold = 500,  description = 'Advanced composition' },
}

---学習レベルを取得
---@return number
function M.get_level()
    M._ensure_loaded()
    return data.level
end

---イベントを記録
---@param event vim-mentor.Event
function M.record_event(event)
    M._ensure_loaded()
    table.insert(data.events, event)
    data.total_blocked = data.total_blocked + 1
    data.streak = 0  -- ブロックされたのでリセット

    -- 日別統計更新
    local today = os.date('%Y-%m-%d')
    if not data.daily_stats[today] then
        data.daily_stats[today] = { blocked = 0, correct = 0 }
    end
    data.daily_stats[today].blocked = data.daily_stats[today].blocked + 1

    -- 定期的に保存
    M._auto_save()
end

---正しい操作を記録
function M.record_correct()
    M._ensure_loaded()
    data.total_correct = data.total_correct + 1
    data.streak = data.streak + 1
    data.best_streak = math.max(data.best_streak, data.streak)

    -- レベルアップ判定
    M._check_level_up()
    M._auto_save()
end

---データのロード
function M.load()
    local storage = require('vim-mentor.storage')
    data = storage.load()
end

---レポート表示
function M.show_report()
    M._ensure_loaded()
    local ui = require('vim-mentor.ui')
    -- レポートウィンドウを表示
    -- (省略: 統計情報の整形と表示)
end

function M._ensure_loaded()
    if not data then
        M.load()
    end
end

function M._check_level_up()
    local new_level = 1
    for i, level_def in ipairs(LEVELS) do
        if data.total_correct >= level_def.threshold then
            new_level = i
        end
    end
    if new_level > data.level then
        data.level = new_level
        vim.notify(
            string.format('Level Up! You are now %s (Level %d)', LEVELS[new_level].name, new_level),
            vim.log.levels.INFO,
            { title = 'vim-mentor' }
        )
    end
end

return M
```

#### (J) `lua/vim-mentor/storage.lua` -- 永続化

**責務:** 学習進捗データのJSON読み書き。

```lua
---@class vim-mentor.Storage
local M = {}

local DEFAULT_DATA = {
    level = 1,
    total_blocked = 0,
    total_correct = 0,
    streak = 0,
    best_streak = 0,
    events = {},
    daily_stats = {},
}

---データファイルのパスを取得
---@return string
function M.get_data_path()
    local config = require('vim-mentor.config').get()
    if config.storage.path then
        return config.storage.path
    end
    -- XDG準拠: ~/.local/share/nvim/vim-mentor/
    local data_dir = vim.fn.stdpath('data') .. '/vim-mentor'
    vim.fn.mkdir(data_dir, 'p')
    return data_dir .. '/progress.json'
end

---データをロード
---@return vim-mentor.ProgressData
function M.load()
    local path = M.get_data_path()
    local file = io.open(path, 'r')
    if not file then
        return vim.deepcopy(DEFAULT_DATA)
    end

    local content = file:read('*a')
    file:close()

    local ok, decoded = pcall(vim.json.decode, content)
    if not ok then
        vim.notify('vim-mentor: Failed to load progress data', vim.log.levels.WARN)
        return vim.deepcopy(DEFAULT_DATA)
    end

    return vim.tbl_deep_extend('force', vim.deepcopy(DEFAULT_DATA), decoded)
end

---データを保存
---@param data vim-mentor.ProgressData
function M.save(data)
    local path = M.get_data_path()
    local encoded = vim.json.encode(data)

    local file = io.open(path, 'w')
    if not file then
        vim.notify('vim-mentor: Failed to save progress data', vim.log.levels.ERROR)
        return
    end

    file:write(encoded)
    file:close()
end

return M
```

#### (K) `lua/vim-mentor/config.lua` -- 設定管理

**責務:** デフォルト設定の定義、ユーザー設定とのマージ。

```lua
---@class vim-mentor.Config
---@field enabled boolean プラグイン有効/無効
---@field level_mode 'auto'|'manual' レベル管理方式
---@field blocked_keys vim-mentor.BlockedKey[] ブロック対象キー
---@field mouse_events string[] ブロック対象マウスイベント
---@field disable_mouse boolean マウスを無効化するか
---@field allowed_filetypes string[] ブロックを適用しないfiletype
---@field insert_mode_arrows boolean Insert modeで矢印キーを許可するか
---@field ui vim-mentor.UIConfig UI設定
---@field storage vim-mentor.StorageConfig 永続化設定
---@field custom_rules vim-mentor.Rule[] ユーザー定義ルール

---@class vim-mentor.UIConfig
---@field style 'float'|'virtual'|'notify' 表示スタイル
---@field timeout number 自動非表示までのミリ秒
---@field position 'cursor'|'top'|'bottom' フロート位置

---@class vim-mentor.StorageConfig
---@field path string|nil カスタム保存パス (nilならXDGデフォルト)
---@field auto_save boolean 自動保存の有効/無効
---@field save_interval number 自動保存間隔 (イベント数)

local M = {}

local DEFAULT_CONFIG = {
    enabled = true,
    level_mode = 'auto',

    blocked_keys = {
        { lhs = '<Up>',    suggestion = 'k',     modes = { 'n', 'v', 'x' } },
        { lhs = '<Down>',  suggestion = 'j',     modes = { 'n', 'v', 'x' } },
        { lhs = '<Left>',  suggestion = 'h',     modes = { 'n', 'v', 'x' } },
        { lhs = '<Right>', suggestion = 'l',     modes = { 'n', 'v', 'x' } },
        { lhs = '<PageUp>',   suggestion = '<C-b>', modes = { 'n', 'v' } },
        { lhs = '<PageDown>', suggestion = '<C-f>', modes = { 'n', 'v' } },
        { lhs = '<Home>',  suggestion = '0',     modes = { 'n', 'v' } },
        { lhs = '<End>',   suggestion = '$',     modes = { 'n', 'v' } },
    },

    mouse_events = {
        '<LeftMouse>', '<RightMouse>', '<MiddleMouse>',
        '<ScrollWheelUp>', '<ScrollWheelDown>',
        '<ScrollWheelLeft>', '<ScrollWheelRight>',
    },

    disable_mouse = true,

    allowed_filetypes = {
        'NvimTree', 'neo-tree', 'oil', 'TelescopePrompt',
        'lazy', 'mason', 'help', 'qf', 'fugitive',
    },

    insert_mode_arrows = true,  -- デフォルトはInsert modeで矢印許可

    ui = {
        style = 'float',
        timeout = 3000,
        position = 'cursor',
    },

    storage = {
        path = nil,
        auto_save = true,
        save_interval = 10,
    },

    custom_rules = {},
}

local current_config = nil

---@param opts? table
function M.setup(opts)
    current_config = vim.tbl_deep_extend('force', vim.deepcopy(DEFAULT_CONFIG), opts or {})
end

---@return vim-mentor.Config
function M.get()
    if not current_config then
        M.setup()
    end
    return current_config
end

return M
```

#### (L) `lua/vim-mentor/health.lua` -- ヘルスチェック

**責務:** `:checkhealth vim-mentor` で表示される診断情報。

```lua
local M = {}

function M.check()
    vim.health.start('vim-mentor')

    -- Neovim バージョンチェック
    if vim.fn.has('nvim-0.10') == 1 then
        vim.health.ok('Neovim >= 0.10.0')
    else
        vim.health.error('Neovim >= 0.10.0 is required')
    end

    -- プラグイン有効状態
    if vim.g.vim_mentor_enabled then
        vim.health.ok('Plugin is enabled')
    else
        vim.health.warn('Plugin is disabled')
    end

    -- 保存ディレクトリの確認
    local storage = require('vim-mentor.storage')
    local path = storage.get_data_path()
    local dir = vim.fn.fnamemodify(path, ':h')
    if vim.fn.isdirectory(dir) == 1 then
        vim.health.ok('Data directory exists: ' .. dir)
    else
        vim.health.warn('Data directory does not exist: ' .. dir)
    end

    -- 進捗データの確認
    local ok, data = pcall(storage.load)
    if ok then
        vim.health.ok(string.format('Progress data loaded (Level %d)', data.level))
    else
        vim.health.warn('Could not load progress data')
    end
end

return M
```

### 3.3 モジュール間通信フロー

```
ユーザーが <Down> を押す
    │
    ▼
[input.lua] vim.keymap.set のコールバック発火
    │
    ▼
[handler.lua] on_blocked_key('<Down>', 'j')
    │
    ├──▶ [detector.lua] get_context() -- 現在の文脈を取得
    │       │
    │       └── cursor位置, 行内容, モード, キー履歴
    │
    ├──▶ [suggestion.lua] get_suggestion('<Down>', context)
    │       │
    │       ├── BASIC_SUGGESTIONS からベース提案取得
    │       ├── progress.get_level() でレベル確認
    │       └── レベルに応じた高度な提案を生成
    │           (例: Level 3 → "Use `}` to jump to next paragraph")
    │
    ├──▶ [ui.lua] show_suggestion(suggestion)
    │       │
    │       └── フローティングウィンドウで表示
    │           3秒後に自動非表示
    │
    └──▶ [progress.lua] record_event(event)
            │
            ├── 統計カウンタ更新
            ├── 日別統計更新
            └── [storage.lua] auto_save (定期的にJSONへ書き出し)
```

---

## 4. 設定管理の詳細

### 4.1 ユーザー設定例

```lua
-- init.lua or lazy.nvim config
require('vim-mentor').setup({
    -- 学習レベル管理
    level_mode = 'auto',

    -- Insert modeでの矢印キー: 初心者は許可
    insert_mode_arrows = true,

    -- 特定キーのブロック解除
    blocked_keys = {
        -- デフォルトに追加
        { lhs = '<Del>', suggestion = 'x', modes = { 'n' } },
    },

    -- マウスは許可する場合
    disable_mouse = false,

    -- 特定のfiletypeでは無効化
    allowed_filetypes = {
        'NvimTree', 'neo-tree', 'TelescopePrompt',
        'lazy', 'mason', 'help',
    },

    -- UI設定
    ui = {
        style = 'float',      -- 'float' | 'virtual' | 'notify'
        timeout = 3000,        -- 表示時間 (ms)
    },

    -- 保存先カスタマイズ
    storage = {
        path = nil,            -- nil = ~/.local/share/nvim/vim-mentor/progress.json
        auto_save = true,
    },

    -- カスタムルール追加
    custom_rules = {
        {
            pattern = 'jjj',
            hint = 'Use relative jump like `3j` instead',
            better = '{count}j',
            severity = 'info',
            level = 1,
        },
    },
})
```

### 4.2 lazy.nvim での設定

```lua
{
    'username/vim-mentor.nvim',
    event = 'VeryLazy',  -- 遅延ロード
    opts = {
        -- 上記の設定項目
    },
    keys = {
        { '<leader>vm', '<cmd>VimMentor toggle<cr>', desc = 'Toggle Vim Mentor' },
        { '<leader>vr', '<cmd>VimMentor report<cr>', desc = 'Vim Mentor Report' },
    },
}
```

### 4.3 永続化の設計判断

| 方式 | 利点 | 欠点 | 判定 |
|------|------|------|------|
| JSON | シンプル、依存なし、人間が読める | 大量データに非効率 | **採用** |
| SQLite | 構造化クエリ可能 | 外部依存、過剰 | 不採用 |
| msgpack | 高速 | 人間が読めない | 不採用 |

**判断理由:** 学習進捗データは小規模 (数KB程度) であり、JSONで十分。`vim.json.encode/decode` がNeovim標準で利用可能なため外部依存も不要。

---

## 5. テスト戦略

### 5.1 テストフレームワーク選定

**採用: busted + nvim-busted-action**

| フレームワーク | 判定 | 理由 |
|---------------|------|------|
| busted (via luarocks) | **採用** | Lua標準のテストフレームワーク、エコシステム充実 |
| plenary.busted | 不採用 | plenary依存を避けたい、bustedのサブセットのみ |
| vusted | 候補 | bustedラッパー、セットアップ容易 |
| themis.vim | 不採用 | VimScript向け |

### 5.2 テストディレクトリ構造

```
spec/
├── unit/
│   ├── config_spec.lua          -- 設定マージのテスト
│   ├── suggestion_spec.lua      -- 提案エンジンのテスト
│   ├── rules_spec.lua           -- ルールマッチングのテスト
│   ├── detector_spec.lua        -- 検出エンジンのテスト
│   ├── storage_spec.lua         -- 永続化のテスト
│   └── progress_spec.lua        -- 学習進捗のテスト
├── functional/
│   ├── input_spec.lua           -- キーマッピングの統合テスト
│   ├── ui_spec.lua              -- UI表示の統合テスト
│   └── workflow_spec.lua        -- ユーザーワークフロー全体のテスト
└── helpers/
    └── init.lua                 -- テストヘルパー関数
```

### 5.3 テストコード例

```lua
-- spec/unit/suggestion_spec.lua
describe('vim-mentor.suggestion', function()
    local suggestion = require('vim-mentor.suggestion')

    describe('get_suggestion', function()
        it('should return basic suggestion for arrow keys', function()
            local context = {
                cursor_row = 1, cursor_col = 0,
                current_line = 'hello world',
                line_length = 11, total_lines = 100,
                mode = 'n', filetype = 'lua',
                key_history = {},
            }

            local result = suggestion.get_suggestion('<Down>', context)
            assert.is_not_nil(result)
            assert.equals('warn', result.severity)
            assert.is_truthy(result.message:find('j'))
        end)

        it('should suggest word motion at level 2', function()
            -- progress.get_level() をスタブ化
            local progress = require('vim-mentor.progress')
            stub(progress, 'get_level', function() return 2 end)

            local context = {
                cursor_row = 1, cursor_col = 0,
                current_line = 'hello world foo bar',
                line_length = 19, total_lines = 100,
                mode = 'n', filetype = 'lua',
                key_history = {},
            }

            local result = suggestion.get_suggestion('<Right>', context)
            assert.is_truthy(result.message:find('w'))

            progress.get_level:revert()
        end)
    end)

    describe('get_mouse_suggestion', function()
        it('should suggest Ctrl-D for scroll down', function()
            local result = suggestion.get_mouse_suggestion('<ScrollWheelDown>')
            assert.is_truthy(result.message:find('Ctrl'))
        end)
    end)
end)
```

```lua
-- spec/unit/config_spec.lua
describe('vim-mentor.config', function()
    local config = require('vim-mentor.config')

    before_each(function()
        -- 各テスト前にリセット
        package.loaded['vim-mentor.config'] = nil
        config = require('vim-mentor.config')
    end)

    it('should have sensible defaults', function()
        config.setup()
        local cfg = config.get()

        assert.is_true(cfg.enabled)
        assert.is_true(cfg.disable_mouse)
        assert.equals('float', cfg.ui.style)
        assert.equals(3000, cfg.ui.timeout)
    end)

    it('should merge user config with defaults', function()
        config.setup({
            disable_mouse = false,
            ui = { timeout = 5000 },
        })
        local cfg = config.get()

        assert.is_false(cfg.disable_mouse)
        assert.equals(5000, cfg.ui.timeout)
        assert.equals('float', cfg.ui.style)  -- デフォルト値が維持される
    end)

    it('should allow adding custom blocked keys', function()
        config.setup({
            blocked_keys = {
                { lhs = '<Del>', suggestion = 'x', modes = { 'n' } },
            },
        })
        local cfg = config.get()
        assert.is_truthy(#cfg.blocked_keys > 0)
    end)
end)
```

### 5.4 プロジェクト設定ファイル

```
-- .busted
return {
    _all = {
        lua = 'nlua',
    },
    unit = {
        ROOT = { 'spec/unit' },
    },
    functional = {
        ROOT = { 'spec/functional' },
    },
}
```

```
-- vim-mentor.nvim-scm-1.rockspec
rockspec_format = '3.0'
package = 'vim-mentor.nvim'
version = 'scm-1'

dependencies = {
    'lua >= 5.1',
}

test_dependencies = {
    'lua >= 5.1',
    'nlua',
    'busted',
}

source = {
    url = 'git://github.com/username/vim-mentor.nvim',
}

build = {
    type = 'builtin',
}
```

### 5.5 CI/CD設計 (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        neovim-version: ['stable', 'nightly']
    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        uses: nvim-neorocks/nvim-busted-action@v1
        with:
          nvim-version: ${{ matrix.neovim-version }}

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lint with selene
        uses: NTBBloodbath/selene-action@v1.0.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          args: '--display-style=quiet ./lua'

      - name: Check formatting with StyLua
        uses: JohnnyMorganz/stylua-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          version: latest
          args: --check lua/

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Type check with lua-language-server
        uses: LuaLS/lua-language-server-action@v1
        with:
          version: latest
          args: --check lua/

  release:
    if: startsWith(github.ref, 'refs/tags/')
    needs: [test, lint, type-check]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Publish to LuaRocks
        uses: nvim-neorocks/luarocks-tag-release@v7
        env:
          LUAROCKS_API_KEY: ${{ secrets.LUAROCKS_API_KEY }}
```

---

## 6. ディレクトリ構成

```
vim-mentor.nvim/
├── .github/
│   └── workflows/
│       ├── test.yml                    # CI: テスト・Lint・型チェック
│       └── release.yml                 # CD: LuaRocks公開
│
├── doc/
│   └── vim-mentor.txt                  # Vim help形式のドキュメント
│
├── plugin/
│   └── vim-mentor.lua                  # エントリポイント (最小限)
│
├── lua/
│   └── vim-mentor/
│       ├── init.lua                    # 公開API (setup, enable, disable)
│       ├── config.lua                  # 設定管理・デフォルト値
│       ├── input.lua                   # 入力層 (keymap, on_key, autocmd)
│       ├── handler.lua                 # イベントハンドラ (橋渡し)
│       ├── detector.lua                # 検出エンジン (パターンマッチ)
│       ├── suggestion.lua              # 提案エンジン (代替コマンド生成)
│       ├── rules.lua                   # 提案ルールDB
│       ├── ui.lua                      # UI層 (float, virtual text, notify)
│       ├── progress.lua                # 学習進捗管理
│       ├── storage.lua                 # 永続化 (JSON読み書き)
│       └── health.lua                  # :checkhealth 対応
│
├── spec/
│   ├── unit/
│   │   ├── config_spec.lua             # 設定のテスト
│   │   ├── suggestion_spec.lua         # 提案エンジンのテスト
│   │   ├── rules_spec.lua              # ルールのテスト
│   │   ├── detector_spec.lua           # 検出エンジンのテスト
│   │   ├── storage_spec.lua            # 永続化のテスト
│   │   └── progress_spec.lua           # 進捗管理のテスト
│   ├── functional/
│   │   ├── input_spec.lua              # キー入力の統合テスト
│   │   ├── ui_spec.lua                 # UI表示の統合テスト
│   │   └── workflow_spec.lua           # E2Eワークフローテスト
│   └── helpers/
│       └── init.lua                    # テストヘルパー
│
├── .busted                             # bustedテスト設定
├── .editorconfig                       # エディタ設定
├── .gitignore                          # Git除外設定
├── .luarc.json                         # lua-language-server設定
├── selene.toml                         # selene Linter設定
├── vim.toml                            # selene用Vim API定義
├── stylua.toml                         # StyLua フォーマッタ設定
├── vim-mentor.nvim-scm-1.rockspec      # LuaRocks パッケージ定義
├── LICENSE                             # MITライセンス
└── README.md                           # プロジェクト説明
```

---

## 7. 学習レベルシステム設計

### 7.1 レベル定義

| Level | 名前 | 正解数閾値 | ブロック対象 | 提案内容 |
|-------|------|-----------|-------------|----------|
| 1 | Beginner | 0 | 矢印キー、マウス | h/j/k/l の基本 |
| 2 | Novice | 50 | + PageUp/Down, Home/End | w/b/e 単語移動 |
| 3 | Intermediate | 150 | + hjkl連打検出 | f/F/t/T 検索移動、/? |
| 4 | Advanced | 300 | + 非効率パターン検出 | テキストオブジェクト (ci{, da") |
| 5 | Expert | 500 | 全パターン | オペレータ+モーション合成 |

### 7.2 レベルアップの流れ

```
[ユーザーがVimコマンドを使用]
    │
    ▼
[progress.record_correct()]
    │
    ├── total_correct をインクリメント
    ├── streak をインクリメント
    │
    ▼
[_check_level_up()]
    │
    ├── total_correct >= LEVELS[next_level].threshold ?
    │   │
    │   ├── YES → レベルアップ通知 + 新ルールが有効化
    │   │         → detector が新パターンの検出を開始
    │   │         → suggestion が高度な提案を生成開始
    │   │
    │   └── NO → 継続
    │
    ▼
[storage.save()] → progress.json に永続化
```

---

## 8. パフォーマンス考慮事項

### 8.1 ボトルネック分析

| 処理 | 頻度 | 対策 |
|------|------|------|
| `vim.on_key()` コールバック | 全キー入力ごと | 最小限の処理のみ (バッファ追加) |
| `CursorMoved` autocmd | カーソル移動ごと | パターンチェックは debounce |
| パターンマッチング | キー入力ごと | バッファサイズを20に制限 |
| JSON保存 | N回イベントごと | 10イベントに1回の間欠保存 |
| フローティングウィンドウ | ブロック時のみ | 既存ウィンドウを再利用 |

### 8.2 設計上の対策

```lua
-- 1. vim.on_key() は最小限の処理
vim.on_key(function(key, typed)
    -- テーブル挿入のみ。重い処理はここでやらない
    key_buffer[#key_buffer + 1] = key
end)

-- 2. パターンチェックは vim.schedule() で非同期化
local check_scheduled = false
local function schedule_check()
    if check_scheduled then return end
    check_scheduled = true
    vim.schedule(function()
        check_scheduled = false
        -- パターンチェック実行
    end)
end

-- 3. フローティングウィンドウは使い回し
-- 毎回作り直すのではなく、既存のバッファ・ウィンドウを更新
```

---

## 9. 今後の拡張ポイント

1. **Telescope連携** -- `:VimMentor report` を Telescope UI で表示
2. **ゲーミフィケーション** -- バッジ、デイリーチャレンジ
3. **カスタムチュートリアル** -- インタラクティブな練習モード
4. **チーム共有** -- 進捗データのエクスポート/比較
5. **Which-key連携** -- which-key.nvim と連携したヒント表示
