# Vim-Mentor パフォーマンスチューニング仕様書

## 1. パフォーマンス要件サマリー

| 指標 | 目標値 | 限界値 | 根拠 |
|------|--------|--------|------|
| キー入力から判定完了まで | < 5ms | < 16ms (1フレーム@60fps) | 体感遅延の閾値 |
| UI描画（floating window更新） | < 8ms | < 16ms | 画面更新1フレーム以内 |
| プラグインロード時メモリ | < 2MB | < 5MB | 一般的なプラグインの許容範囲 |
| 長時間セッション時メモリ増加 | < 10MB/時間 | < 50MB/時間 | 8時間セッション基準 |
| 学習データ保存（非同期） | < 1ms (UIスレッドブロック) | < 5ms | ユーザー操作を阻害しない |
| プラグイン起動時間への影響 | < 3ms | < 10ms | startuptime基準 |

---

## 2. 入力遅延 (Input Latency)

### 2.1 遅延バジェット

キー入力から画面フィードバックまでの全体バジェットを以下のように配分する。

```
キー入力 → [Neovim内部処理 ~1ms]
         → [autocmdディスパッチ ~0.5ms]
         → [vim-mentor判定ロジック ~2ms] ← ここが制御可能な領域
         → [UI更新指示 ~0.5ms]
         → [floating window描画 ~3ms]
         → 画面表示
         ────────────────────────────
         合計目標: < 8ms (余裕をもって16ms以内)
```

### 2.2 キーマッピングのオーバーヘッド最小化

```lua
-- [悪い例] すべてのキーを個別にマップ
-- 100個以上のマッピングはNeovimの内部テーブル検索コストが増大する
for _, key in ipairs(all_keys) do
  vim.keymap.set('n', key, function() process(key) end)
end

-- [良い例] InsertCharPre autocmdで一括処理
-- マッピングテーブルの肥大化を避け、autocmd1つで全入力を捕捉
vim.api.nvim_create_autocmd('InsertCharPre', {
  group = vim.api.nvim_create_augroup('VimMentor', { clear = true }),
  callback = function()
    local char = vim.v.char
    -- ガード節: 学習モードでなければ即座にreturn
    if not State.is_active() then return end
    -- 軽量な判定のみ実行（重い処理はdeferする）
    Detector.on_char(char)
  end,
})
```

### 2.3 高速タイピング時のバッファリング戦略

```lua
-- スロットリング付きの入力処理
-- 連続入力時は中間結果をバッファに蓄積し、一定間隔でまとめて判定する
local InputBuffer = {
  _queue = {},
  _timer = nil,
  _THROTTLE_MS = 50,  -- 50ms間隔で処理（20回/秒）
  _MAX_QUEUE = 32,    -- キューの最大長（これを超えたら強制処理）
}

function InputBuffer.push(char)
  table.insert(InputBuffer._queue, {
    char = char,
    time = vim.uv.hrtime(),  -- ナノ秒精度のタイムスタンプ
  })

  -- キューが最大長に達したら即座に処理
  if #InputBuffer._queue >= InputBuffer._MAX_QUEUE then
    InputBuffer.flush()
    return
  end

  -- タイマーをリセット（デバウンス）
  if InputBuffer._timer then
    InputBuffer._timer:stop()
  end
  InputBuffer._timer = vim.defer_fn(function()
    InputBuffer.flush()
  end, InputBuffer._THROTTLE_MS)
end

function InputBuffer.flush()
  if #InputBuffer._queue == 0 then return end
  local batch = InputBuffer._queue
  InputBuffer._queue = {}
  -- バッチ処理: キューに溜まった入力をまとめて判定
  Analyzer.process_batch(batch)
end
```

### 2.4 オーバーヘッド測定方法

```lua
-- プラグイン内蔵のマイクロベンチマーク
local Benchmark = {}

function Benchmark.measure_input_latency(iterations)
  iterations = iterations or 1000
  local times = {}

  for i = 1, iterations do
    local start = vim.uv.hrtime()
    -- 実際の判定ロジックをシミュレート
    Detector.on_char('j')
    local elapsed = (vim.uv.hrtime() - start) / 1e6  -- ナノ秒→ミリ秒
    table.insert(times, elapsed)
  end

  table.sort(times)
  return {
    min = times[1],
    max = times[#times],
    median = times[math.floor(#times / 2)],
    p95 = times[math.floor(#times * 0.95)],
    p99 = times[math.floor(#times * 0.99)],
    avg = vim.iter(times):fold(0, function(a, b) return a + b end) / #times,
  }
end

-- ユーザーコマンドとして公開
-- :VimMentorBenchmark で実行可能
vim.api.nvim_create_user_command('VimMentorBenchmark', function()
  local result = Benchmark.measure_input_latency(1000)
  vim.notify(string.format(
    'Input Latency (1000 iterations):\n'
    .. '  min: %.3fms\n'
    .. '  median: %.3fms\n'
    .. '  p95: %.3fms\n'
    .. '  p99: %.3fms\n'
    .. '  max: %.3fms',
    result.min, result.median, result.p95, result.p99, result.max
  ), vim.log.levels.INFO)
end, {})
```

---

## 3. メモリ使用量

### 3.1 メモリフットプリント設計

```lua
-- 学習データのメモリ効率的な構造設計
-- 原則: 必要なデータのみメモリに保持し、詳細データはディスクに退避

-- [悪い例] 全履歴をメモリに保持
-- local history = {}  -- セッション中に無限に成長する

-- [良い例] リングバッファで直近N件のみ保持
local RingBuffer = {}
RingBuffer.__index = RingBuffer

function RingBuffer.new(capacity)
  return setmetatable({
    _buf = {},
    _capacity = capacity,
    _head = 0,
    _count = 0,
  }, RingBuffer)
end

function RingBuffer:push(item)
  self._head = (self._head % self._capacity) + 1
  self._buf[self._head] = item
  if self._count < self._capacity then
    self._count = self._count + 1
  end
end

function RingBuffer:to_list()
  local result = {}
  local start = self._count < self._capacity and 1 or (self._head % self._capacity) + 1
  for i = 0, self._count - 1 do
    local idx = ((start - 1 + i) % self._capacity) + 1
    table.insert(result, self._buf[idx])
  end
  return result
end

-- 使用例: 直近1000件の操作のみ保持
local recent_operations = RingBuffer.new(1000)
```

### 3.2 学習データのメモリ管理

```lua
-- 階層化メモリ管理
-- L1: ホットデータ（現在のセッション統計） → メモリ常駐
-- L2: ウォームデータ（直近の操作履歴）     → リングバッファ
-- L3: コールドデータ（累積統計）           → ディスク（必要時のみロード）

local MemoryManager = {
  -- L1: 常にメモリに保持（軽量）
  session = {
    start_time = nil,
    total_keystrokes = 0,
    patterns_detected = 0,
    current_score = 0,
  },

  -- L2: リングバッファ（上限あり）
  recent_history = RingBuffer.new(1000),

  -- L3: ディスクへの参照のみ
  persistent_path = nil,  -- ファイルパスのみ保持

  -- メモリ使用量の監視
  _last_gc_count = 0,
}

function MemoryManager.get_lua_memory_kb()
  return collectgarbage('count')
end

function MemoryManager.check_and_gc()
  local current = collectgarbage('count')
  -- 前回のGC以降に5MB以上増加した場合にGCを実行
  if current - MemoryManager._last_gc_count > 5120 then
    collectgarbage('collect')
    MemoryManager._last_gc_count = collectgarbage('count')
  end
end
```

### 3.3 メモリリーク防止策

```lua
-- 1. autocmdのクリーンアップ
-- プラグイン無効化時に確実にリソースを解放する
local augroup = vim.api.nvim_create_augroup('VimMentor', { clear = true })

local function cleanup()
  -- augroupを削除（関連する全autocmdを一括削除）
  vim.api.nvim_del_augroup_by_name('VimMentor')

  -- タイマーの停止
  if InputBuffer._timer then
    InputBuffer._timer:stop()
    InputBuffer._timer:close()
    InputBuffer._timer = nil
  end

  -- バッファ参照の解放
  InputBuffer._queue = {}

  -- 明示的なGCトリガー
  collectgarbage('collect')
end

-- VimLeave時のクリーンアップ
vim.api.nvim_create_autocmd('VimLeavePre', {
  group = augroup,
  callback = cleanup,
})

-- 2. 循環参照の回避
-- [悪い例] 相互参照でGCされない
-- local a = {}; local b = { ref = a }; a.ref = b

-- [良い例] 弱参照テーブルの活用
local weak_cache = setmetatable({}, { __mode = 'v' })
-- 値への弱参照: 他に参照がなければGCで回収される

-- 3. 定期的なメモリ監視（開発時のみ有効化）
local function setup_memory_monitor()
  if not vim.g.vim_mentor_debug then return end

  vim.fn.timer_start(60000, function()  -- 60秒ごと
    local mem_kb = collectgarbage('count')
    if mem_kb > 10240 then  -- 10MB超過で警告
      vim.notify(
        string.format('[vim-mentor] Lua memory: %.1f MB', mem_kb / 1024),
        vim.log.levels.WARN
      )
    end
  end, { ['repeat'] = -1 })
end
```

---

## 4. UI描画パフォーマンス

### 4.1 Floating Window管理

```lua
local FloatingUI = {
  _win = nil,   -- ウィンドウハンドル（再利用）
  _buf = nil,   -- バッファハンドル（再利用）
  _last_content = nil,  -- 前回の表示内容（差分検出用）
  _debounce_timer = nil,
  _DEBOUNCE_MS = 100,   -- UI更新のデバウンス間隔
}

-- バッファとウィンドウの再利用（生成コストの回避）
function FloatingUI.get_or_create_buf()
  if FloatingUI._buf and vim.api.nvim_buf_is_valid(FloatingUI._buf) then
    return FloatingUI._buf
  end
  FloatingUI._buf = vim.api.nvim_create_buf(false, true)
  vim.bo[FloatingUI._buf].bufhidden = 'hide'
  vim.bo[FloatingUI._buf].buftype = 'nofile'
  return FloatingUI._buf
end

function FloatingUI.show(content, opts)
  opts = opts or {}
  local buf = FloatingUI.get_or_create_buf()

  -- 差分検出: 内容が同じなら再描画しない
  local content_hash = vim.fn.sha256(table.concat(content, '\n'))
  if content_hash == FloatingUI._last_content then
    return  -- 不要な再描画をスキップ
  end
  FloatingUI._last_content = content_hash

  -- バッファ内容を更新
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, content)

  -- ウィンドウが既に存在し有効なら設定のみ更新
  if FloatingUI._win and vim.api.nvim_win_is_valid(FloatingUI._win) then
    vim.api.nvim_win_set_config(FloatingUI._win, opts.win_config or {})
    return
  end

  -- 新規ウィンドウ作成
  local win_config = vim.tbl_extend('force', {
    relative = 'cursor',
    row = 1,
    col = 0,
    width = 40,
    height = #content,
    style = 'minimal',  -- 最小スタイルで描画コスト削減
    border = 'rounded',
    focusable = false,   -- フォーカスしない（操作を阻害しない）
    zindex = 50,
  }, opts.win_config or {})

  FloatingUI._win = vim.api.nvim_open_win(buf, false, win_config)

  -- パフォーマンス最適化オプション
  vim.wo[FloatingUI._win].foldenable = false
  vim.wo[FloatingUI._win].wrap = false
  vim.wo[FloatingUI._win].signcolumn = 'no'
  vim.wo[FloatingUI._win].number = false
  vim.wo[FloatingUI._win].relativenumber = false
  vim.wo[FloatingUI._win].cursorline = false
  vim.wo[FloatingUI._win].spell = false
end

function FloatingUI.hide()
  if FloatingUI._win and vim.api.nvim_win_is_valid(FloatingUI._win) then
    vim.api.nvim_win_hide(FloatingUI._win)
  end
  FloatingUI._win = nil
  FloatingUI._last_content = nil
end
```

### 4.2 デバウンスとスロットリング

```lua
-- 汎用デバウンス関数
-- Neovimコアへの vim.debounce() 追加提案(#33179)に先行した実装
local function debounce(fn, ms)
  local timer = vim.uv.new_timer()
  return function(...)
    local args = { ... }
    timer:stop()
    timer:start(ms, 0, vim.schedule_wrap(function()
      fn(unpack(args))
    end))
  end
end

-- 汎用スロットリング関数
local function throttle(fn, ms)
  local timer = vim.uv.new_timer()
  local running = false
  return function(...)
    if running then return end
    running = true
    local args = { ... }
    fn(unpack(args))
    timer:start(ms, 0, vim.schedule_wrap(function()
      running = false
    end))
  end
end

-- 適用例
-- UI更新はデバウンス（最後の入力から100ms後に1回だけ更新）
local update_ui_debounced = debounce(FloatingUI.show, 100)

-- 進捗カウンタの更新はスロットリング（最大10回/秒）
local update_progress_throttled = throttle(Progress.update, 100)
```

### 4.3 ちらつき防止

```lua
-- 方法1: nvim_win_hide + nvim_open_win ではなく、内容のみ差し替え
-- ウィンドウの破壊→再生成はちらつきの原因になる

-- 方法2: redrawの制御
local function batch_ui_update(updates)
  -- 複数のUI変更をまとめて実行し、再描画を1回に抑える
  vim.cmd('noautocmd')  -- 一時的にautocmdを抑制
  for _, update in ipairs(updates) do
    update()
  end
  vim.cmd('redraw')  -- 明示的に1回だけ再描画
end

-- 方法3: ダブルバッファリング的アプローチ
-- 表示用バッファと更新用バッファを分けて、更新完了後にswap
local DoubleBuffer = {
  _front = nil,  -- 現在表示中のバッファ
  _back = nil,   -- 更新中のバッファ
}

function DoubleBuffer.init()
  DoubleBuffer._front = vim.api.nvim_create_buf(false, true)
  DoubleBuffer._back = vim.api.nvim_create_buf(false, true)
end

function DoubleBuffer.update(content)
  -- バックバッファに書き込み
  vim.api.nvim_buf_set_lines(DoubleBuffer._back, 0, -1, false, content)
  -- swapしてウィンドウに割り当て
  DoubleBuffer._front, DoubleBuffer._back = DoubleBuffer._back, DoubleBuffer._front
  if FloatingUI._win and vim.api.nvim_win_is_valid(FloatingUI._win) then
    vim.api.nvim_win_set_buf(FloatingUI._win, DoubleBuffer._front)
  end
end
```

---

## 5. データ永続化

### 5.1 保存タイミング戦略

```
                 即時保存                バッチ保存           セッション終了時保存
               (毎操作)             (N回/一定時間ごと)          (VimLeavePre)
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ データ損失リスク  低い                 中程度                 高い           │
  │ I/Oコスト        非常に高い           中程度                 低い           │
  │ 遅延への影響     大きい               小さい                 なし           │
  │ 適用対象         クリティカルデータ    操作履歴               累積統計       │
  └──────────────────────────────────────────────────────────────────────────────┘

  [推奨] ハイブリッド戦略:
    - セッション統計       → セッション終了時に一括保存
    - 操作履歴（L2データ） → 5分ごとの定期バッチ保存
    - 重要マイルストーン   → 達成時に即時保存（非同期）
```

### 5.2 非同期ファイルI/O

```lua
-- vim.uv (libuv) を使った非同期書き込み
-- UIスレッドをブロックしない
local AsyncIO = {}

function AsyncIO.write_json(path, data, callback)
  local json_str = vim.json.encode(data)
  -- 非同期でファイルを開く
  vim.uv.fs_open(path, 'w', 438, function(err_open, fd)  -- 438 = 0666
    if err_open then
      vim.schedule(function()
        vim.notify('[vim-mentor] Write error: ' .. err_open, vim.log.levels.ERROR)
      end)
      return
    end
    -- 非同期でデータを書き込む
    vim.uv.fs_write(fd, json_str, 0, function(err_write, _)
      -- 非同期でファイルを閉じる
      vim.uv.fs_close(fd, function(err_close)
        if callback then
          vim.schedule(function()
            callback(err_write or err_close)
          end)
        end
      end)
    end)
  end)
end

function AsyncIO.read_json(path, callback)
  vim.uv.fs_stat(path, function(err_stat, stat)
    if err_stat or not stat then
      vim.schedule(function() callback(nil) end)
      return
    end
    vim.uv.fs_open(path, 'r', 438, function(err_open, fd)
      if err_open then
        vim.schedule(function() callback(nil) end)
        return
      end
      vim.uv.fs_read(fd, stat.size, 0, function(err_read, data)
        vim.uv.fs_close(fd, function()
          vim.schedule(function()
            if err_read or not data then
              callback(nil)
            else
              local ok, decoded = pcall(vim.json.decode, data)
              callback(ok and decoded or nil)
            end
          end)
        end)
      end)
    end)
  end)
end
```

### 5.3 バッチ保存スケジューラ

```lua
local PersistenceScheduler = {
  _dirty = false,          -- 未保存の変更があるか
  _timer = nil,
  _INTERVAL_MS = 300000,   -- 5分 = 300,000ms
  _data_dir = nil,
}

function PersistenceScheduler.init(data_dir)
  PersistenceScheduler._data_dir = data_dir

  -- 定期保存タイマー
  PersistenceScheduler._timer = vim.uv.new_timer()
  PersistenceScheduler._timer:start(
    PersistenceScheduler._INTERVAL_MS,
    PersistenceScheduler._INTERVAL_MS,
    vim.schedule_wrap(function()
      PersistenceScheduler.save_if_dirty()
    end)
  )

  -- セッション終了時の確実な保存（同期）
  vim.api.nvim_create_autocmd('VimLeavePre', {
    group = vim.api.nvim_create_augroup('VimMentorPersist', { clear = true }),
    callback = function()
      PersistenceScheduler.save_sync()
    end,
  })

  -- フォーカス喪失時にも保存（他アプリに切り替え時）
  vim.api.nvim_create_autocmd('FocusLost', {
    group = vim.api.nvim_create_augroup('VimMentorPersist', { clear = true }),
    callback = function()
      PersistenceScheduler.save_if_dirty()
    end,
  })
end

function PersistenceScheduler.mark_dirty()
  PersistenceScheduler._dirty = true
end

function PersistenceScheduler.save_if_dirty()
  if not PersistenceScheduler._dirty then return end
  PersistenceScheduler._dirty = false

  local data = MemoryManager.serialize()
  local path = PersistenceScheduler._data_dir .. '/progress.json'
  AsyncIO.write_json(path, data, function(err)
    if err then
      PersistenceScheduler._dirty = true  -- 保存失敗→再試行
      vim.notify('[vim-mentor] Save failed, will retry', vim.log.levels.WARN)
    end
  end)
end

function PersistenceScheduler.save_sync()
  -- VimLeavePre時は非同期だと完了前にプロセスが終了する可能性があるため同期書き込み
  local data = MemoryManager.serialize()
  local path = PersistenceScheduler._data_dir .. '/progress.json'
  local json_str = vim.json.encode(data)
  vim.fn.writefile({ json_str }, path)
end

function PersistenceScheduler.shutdown()
  if PersistenceScheduler._timer then
    PersistenceScheduler._timer:stop()
    PersistenceScheduler._timer:close()
    PersistenceScheduler._timer = nil
  end
end
```

---

## 6. VimScript vs Lua パフォーマンス比較

### 6.1 ベンチマーク結果（公開データに基づく）

```
┌──────────────────────────────────────────────────────────────────────┐
│ ベンチマーク: 300万回ループ（Sum計算）                                │
│                                                                      │
│  旧VimScript  ████████████████████████████████████████  5.018s       │
│  Python       ███                                       0.370s       │
│  Vim9         █                                         0.074s       │
│  Lua (plain)  █                                         0.079s       │
│  LuaJIT       ▏                                         0.004s       │
│                                                                      │
│ LuaJIT は旧VimScriptの約1,200倍、Vim9の約17倍高速                    │
│                                                                      │
│ ※ ただしVim API呼び出しが支配的な処理（indent計算等）では             │
│   Vim9がLuaJITと同等またはやや高速になるケースもある                  │
│                                                                      │
│ 出典: vim/vim#7903, sr.ht/~henriquehbr/lua-vs-vimscript             │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 vim-mentorにおける選択指針

| 処理カテゴリ | 推奨言語 | 理由 |
|-------------|---------|------|
| キー入力判定ロジック | **Lua** | 純粋な計算処理でLuaJITの恩恵が最大 |
| パターンマッチング | **Lua** | テーブル操作・文字列処理がLuaJITで高速 |
| UI描画 | **Lua** (nvim API) | `nvim_open_win`等のAPI呼び出しが直接可能 |
| ファイルI/O | **Lua** (vim.uv) | libuvの非同期I/Oを直接利用可能 |
| autocmd登録 | **Lua** (nvim API) | `nvim_create_autocmd`でコールバック関数を直接登録 |
| 既存Vimプラグインとの連携 | VimScript (薄いラッパー) | 互換性のためのインターフェースのみ |

### 6.3 autocmdのパフォーマンス影響

```lua
-- autocmdのコスト見積もり
--
-- [低コスト] BufEnter, BufLeave, WinEnter
--   → 頻度: 低（バッファ/ウィンドウ切替時のみ）
--   → ここで初期化/クリーンアップを行うのは安全
--
-- [中コスト] CursorMoved, CursorMovedI
--   → 頻度: 高（カーソル移動のたび）
--   → デバウンス必須、コールバックは最小限に
--
-- [高コスト] InsertCharPre
--   → 頻度: 非常に高（1文字入力のたび）
--   → 即座にreturnするガード節が必須
--   → 絶対にRPC（外部プロセス呼び出し）を行わない
--   → 重い処理はvim.defer_fnで遅延実行

-- 実装方針: コスト別にコールバックの重さを制限
local COST_BUDGET = {
  InsertCharPre = { max_us = 100 },   -- 0.1ms以内
  CursorMovedI  = { max_us = 500 },   -- 0.5ms以内
  CursorMoved   = { max_us = 1000 },  -- 1ms以内
  CursorHold    = { max_us = 50000 },  -- 50ms以内（待機中なので余裕あり）
}
```

### 6.4 Neovim Lua API 呼び出しコスト

```lua
-- API呼び出しコストの実測例（目安）
-- 環境: Apple M1, Neovim 0.10.x, LuaJIT 2.1
--
-- vim.api.nvim_get_current_line()   ~0.5us (マイクロ秒)
-- vim.api.nvim_buf_get_lines()      ~1-5us (行数依存)
-- vim.api.nvim_buf_set_lines()      ~2-10us
-- vim.api.nvim_open_win()           ~50-200us
-- vim.api.nvim_win_set_config()     ~10-30us
-- vim.fn.getline()                  ~1us (VimScript関数呼び出し)
-- vim.cmd('...')                     ~5-20us (Exコマンドパース込み)
--
-- 結論: nvim_* API は vim.fn.* や vim.cmd より一般に高速
-- ただし差は数マイクロ秒レベルであり、ボトルネックになることは稀
-- 本当のボトルネックはウィンドウ生成/破壊とバッファ内容の大量操作
```

---

## 7. プロファイリング手法

### 7.1 利用可能なツール一覧

```
┌────────────────────┬──────────────────────────────────┬─────────────────────┐
│ ツール              │ 用途                              │ 粒度                │
├────────────────────┼──────────────────────────────────┼─────────────────────┤
│ :profile           │ VimScriptの関数/行レベル          │ 行レベル             │
│                    │ プロファイリング                   │                     │
├────────────────────┼──────────────────────────────────┼─────────────────────┤
│ --startuptime      │ 起動時間の測定                     │ ファイルレベル       │
├────────────────────┼──────────────────────────────────┼─────────────────────┤
│ perfanno.nvim      │ perf/LuaJITプロファイラ統合        │ 行レベル             │
│                    │ flamegraph形式のデータ可視化       │ (コードアノテーション)│
├────────────────────┼──────────────────────────────────┼─────────────────────┤
│ profile.nvim       │ Lua関数のモンキーパッチ式          │ 関数レベル           │
│                    │ プロファイリング                   │ (トレース形式)       │
├────────────────────┼──────────────────────────────────┼─────────────────────┤
│ nvim-profiler      │ コマンドベースの簡易Luaプロファイラ │ 関数レベル           │
├────────────────────┼──────────────────────────────────┼─────────────────────┤
│ vim.uv.hrtime()    │ マイクロベンチマーク               │ ナノ秒精度           │
├────────────────────┼──────────────────────────────────┼─────────────────────┤
│ collectgarbage()   │ Luaメモリ使用量の測定              │ KB単位               │
└────────────────────┴──────────────────────────────────┴─────────────────────┘
```

### 7.2 プロファイリング実装

```lua
-- vim-mentor内蔵のプロファイリングモジュール
local Profiler = {
  _enabled = false,
  _entries = {},
  _start_times = {},
}

function Profiler.enable()
  Profiler._enabled = true
  Profiler._entries = {}
end

function Profiler.disable()
  Profiler._enabled = false
end

-- 処理区間の計測
function Profiler.start(label)
  if not Profiler._enabled then return end
  Profiler._start_times[label] = vim.uv.hrtime()
end

function Profiler.stop(label)
  if not Profiler._enabled then return end
  local start = Profiler._start_times[label]
  if not start then return end

  local elapsed_ns = vim.uv.hrtime() - start
  Profiler._start_times[label] = nil

  if not Profiler._entries[label] then
    Profiler._entries[label] = {
      count = 0,
      total_ns = 0,
      min_ns = math.huge,
      max_ns = 0,
    }
  end

  local entry = Profiler._entries[label]
  entry.count = entry.count + 1
  entry.total_ns = entry.total_ns + elapsed_ns
  entry.min_ns = math.min(entry.min_ns, elapsed_ns)
  entry.max_ns = math.max(entry.max_ns, elapsed_ns)
end

-- ラッパー関数（関数全体の計測を簡潔に記述）
function Profiler.wrap(label, fn)
  return function(...)
    Profiler.start(label)
    local results = { fn(...) }
    Profiler.stop(label)
    return unpack(results)
  end
end

-- レポート出力
function Profiler.report()
  local lines = { 'vim-mentor Performance Report', string.rep('=', 60) }
  local sorted = {}
  for label, entry in pairs(Profiler._entries) do
    table.insert(sorted, { label = label, entry = entry })
  end
  table.sort(sorted, function(a, b)
    return a.entry.total_ns > b.entry.total_ns  -- 合計時間の降順
  end)

  for _, item in ipairs(sorted) do
    local e = item.entry
    local avg_us = (e.total_ns / e.count) / 1000
    table.insert(lines, string.format(
      '%-30s  calls: %6d  avg: %8.1fus  min: %8.1fus  max: %8.1fus  total: %8.1fms',
      item.label, e.count, avg_us,
      e.min_ns / 1000, e.max_ns / 1000,
      e.total_ns / 1e6
    ))
  end

  table.insert(lines, string.rep('=', 60))
  table.insert(lines, string.format('Lua memory: %.1f KB', collectgarbage('count')))

  return table.concat(lines, '\n')
end

-- ユーザーコマンド
vim.api.nvim_create_user_command('VimMentorProfileStart', function()
  Profiler.enable()
  vim.notify('[vim-mentor] Profiling started')
end, {})

vim.api.nvim_create_user_command('VimMentorProfileStop', function()
  Profiler.disable()
  vim.notify(Profiler.report())
end, {})
```

### 7.3 ベンチマーク自動化

```lua
-- CI/ローカルで実行可能な自動ベンチマークスイート
-- 実行方法: nvim --headless -c "luafile bench/run.lua" -c "qa!"

-- bench/run.lua
local function run_benchmarks()
  local results = {}

  -- ベンチマーク1: 入力判定スループット
  do
    local chars = 'abcdefghijklmnopqrstuvwxyz'
    local N = 10000
    local start = vim.uv.hrtime()
    for i = 1, N do
      local c = chars:sub((i % #chars) + 1, (i % #chars) + 1)
      Detector.on_char(c)
    end
    local elapsed_ms = (vim.uv.hrtime() - start) / 1e6
    results.input_throughput = {
      total_ms = elapsed_ms,
      per_char_us = (elapsed_ms * 1000) / N,
      chars_per_sec = N / (elapsed_ms / 1000),
    }
  end

  -- ベンチマーク2: UI更新スループット
  do
    local N = 100
    local start = vim.uv.hrtime()
    for i = 1, N do
      FloatingUI.show({ 'Line ' .. i, 'Score: ' .. i * 10 })
    end
    local elapsed_ms = (vim.uv.hrtime() - start) / 1e6
    results.ui_update = {
      total_ms = elapsed_ms,
      per_update_ms = elapsed_ms / N,
    }
  end

  -- ベンチマーク3: データシリアライズ
  do
    local test_data = {
      session = { keystrokes = 50000, score = 85 },
      history = {},
    }
    for i = 1, 1000 do
      table.insert(test_data.history, {
        char = 'x', time = i * 1000, pattern = 'hjkl',
      })
    end
    local N = 100
    local start = vim.uv.hrtime()
    for _ = 1, N do
      vim.json.encode(test_data)
    end
    local elapsed_ms = (vim.uv.hrtime() - start) / 1e6
    results.serialization = {
      total_ms = elapsed_ms,
      per_encode_ms = elapsed_ms / N,
    }
  end

  -- ベンチマーク4: メモリ使用量
  collectgarbage('collect')
  results.memory_kb = collectgarbage('count')

  -- 結果をJSON出力（CI連携用）
  local json = vim.json.encode(results)
  local path = 'bench/results.json'
  vim.fn.writefile({ json }, path)
  print('Benchmark results written to ' .. path)
  print(json)

  -- パフォーマンス回帰チェック
  local thresholds = {
    input_per_char_us = 100,      -- 1文字あたり100us以下
    ui_per_update_ms = 5,         -- UI更新1回あたり5ms以下
    serialization_per_ms = 2,     -- エンコード1回あたり2ms以下
    memory_kb = 5120,             -- 5MB以下
  }

  local failed = false
  if results.input_throughput.per_char_us > thresholds.input_per_char_us then
    print('FAIL: Input latency too high: ' .. results.input_throughput.per_char_us .. 'us')
    failed = true
  end
  if results.ui_update.per_update_ms > thresholds.ui_per_update_ms then
    print('FAIL: UI update too slow: ' .. results.ui_update.per_update_ms .. 'ms')
    failed = true
  end
  if results.memory_kb > thresholds.memory_kb then
    print('FAIL: Memory too high: ' .. results.memory_kb .. ' KB')
    failed = true
  end

  if failed then
    vim.cmd('cquit 1')  -- 非ゼロ終了コード（CI失敗）
  end
end

run_benchmarks()
```

---

## 8. 最適化の優先度ランキング

### 8.1 影響度 x 発生頻度マトリクス

```
影響度(高)
  ^
  │  ┌─────────────────────────────┐
  │  │ P1: InsertCharPre           │   ← 最優先
  │  │     コールバック軽量化       │      毎キーストロークで発動
  │  │                             │      体感遅延に直結
  │  └─────────────────────────────┘
  │
  │  ┌─────────────────────────────┐
  │  │ P2: UI描画デバウンス        │   ← 高優先
  │  │     floating window再利用    │      視覚的品質に直結
  │  │     差分更新                 │      ちらつき = UX劣化
  │  └─────────────────────────────┘
  │
  │  ┌─────────────────────────────┐
  │  │ P3: データ保存の非同期化    │   ← 中優先
  │  │     vim.uv.fs_write         │      同期I/Oはフリーズの原因
  │  │     バッチ保存              │      だが頻度は低い
  │  └─────────────────────────────┘
  │
  │  ┌─────────────────────────────┐
  │  │ P4: メモリ管理              │   ← 中優先
  │  │     リングバッファ           │      長時間セッションで顕在化
  │  │     弱参照                   │      短時間なら問題なし
  │  └─────────────────────────────┘
  │
  │  ┌─────────────────────────────┐
  │  │ P5: 起動時間最適化          │   ← 低優先
  │  │     遅延ロード              │      1回のみの影響
  │  │     モジュール分割          │      体感3ms以下なら十分
  │  └─────────────────────────────┘
  │
  └──────────────────────────────────> 発生頻度(高)
```

### 8.2 各優先度の具体的な最適化手法

#### P1: 入力判定の軽量化（最優先）

```lua
-- 最適化手法一覧:
-- 1. ガード節による早期リターン
-- 2. テーブルルックアップ（O(1)）で判定（if-elseチェーンを避ける）
-- 3. 高頻度パスのインライン化
-- 4. 文字列連結の回避（table.concatを使う）
-- 5. グローバル変数へのアクセスをローカル変数にキャッシュ

-- 例: パターン検出器の最適化
local Detector = {}

-- ローカル化（グローバルテーブルの検索コストを排除）
local byte = string.byte
local sub = string.sub

-- ルックアップテーブル（O(1)判定）
local MOTION_CHARS = {}
for _, c in ipairs({ 'h', 'j', 'k', 'l', 'w', 'b', 'e', 'f', 't' }) do
  MOTION_CHARS[byte(c)] = true
end

function Detector.on_char(char)
  -- ガード節: 学習モード外なら即座にreturn（コスト: ~0.01us）
  if not Detector._active then return end

  -- テーブルルックアップ（コスト: ~0.05us）
  local b = byte(char)
  if not MOTION_CHARS[b] then return end

  -- ここに到達するのは対象キーのみ（全体の一部）
  Detector._process_motion(char)
end
```

#### P2: UI描画の最適化（高優先）

```lua
-- 最適化手法一覧:
-- 1. バッファ/ウィンドウの再利用（セクション4.1参照）
-- 2. 差分検出による不要な再描画の回避
-- 3. デバウンスによる更新頻度の制限
-- 4. style='minimal' でレンダリングオプションを最小化
-- 5. focusable=false でフォーカス管理コストを回避
-- 6. ウィンドウオプションの最適化（fold, wrap, sign等を無効化）
```

#### P3: データ永続化の最適化（中優先）

```lua
-- 最適化手法一覧:
-- 1. vim.uv.fs_write による非同期書き込み（セクション5.2参照）
-- 2. dirty flagによる不要な保存の回避
-- 3. ハイブリッド保存戦略（セクション5.1参照）
-- 4. VimLeavePre時のみ同期書き込み
-- 5. JSONエンコードの最適化（vim.json.encode使用）
```

#### P4: メモリ管理の最適化（中優先）

```lua
-- 最適化手法一覧:
-- 1. リングバッファによる履歴の上限管理
-- 2. 階層化メモリ管理（L1/L2/L3）
-- 3. 弱参照テーブルによるキャッシュ
-- 4. 定期的なcollectgarbage実行
-- 5. タイマー/autocmdのクリーンアップ
-- 6. FocusLost時のGCトリガー

vim.api.nvim_create_autocmd('FocusLost', {
  group = vim.api.nvim_create_augroup('VimMentorGC', { clear = true }),
  callback = function()
    collectgarbage('collect')
  end,
})
```

#### P5: 起動時間の最適化（低優先）

```lua
-- 最適化手法一覧:
-- 1. 遅延ロード（必要になるまでモジュールを読み込まない）
-- 2. require()のキャッシュ活用
-- 3. 不要なモジュールの除外

-- 遅延ロードパターン
local _ui = nil
local function get_ui()
  if not _ui then
    _ui = require('vim-mentor.ui')
  end
  return _ui
end

-- lazy.nvimでの遅延ロード設定例
-- return {
--   'user/vim-mentor',
--   cmd = { 'VimMentorStart', 'VimMentorStatus' },
--   keys = {
--     { '<leader>vm', '<cmd>VimMentorStart<cr>', desc = 'Start Vim Mentor' },
--   },
--   config = function()
--     require('vim-mentor').setup({})
--   end,
-- }
```

---

## 9. パフォーマンス監視ダッシュボード

```lua
-- :VimMentorPerfDash で表示するリアルタイム監視画面
local Dashboard = {}

function Dashboard.show()
  local lines = {}

  -- ヘッダー
  table.insert(lines, '  vim-mentor Performance Dashboard')
  table.insert(lines, '  ' .. string.rep('-', 50))
  table.insert(lines, '')

  -- メモリ
  local mem_kb = collectgarbage('count')
  local mem_indicator = mem_kb < 2048 and 'OK' or (mem_kb < 5120 and 'WARN' or 'CRIT')
  table.insert(lines, string.format('  Memory (Lua):  %.1f KB  [%s]', mem_kb, mem_indicator))

  -- セッション統計
  local session = MemoryManager.session
  if session and session.start_time then
    local uptime_sec = (vim.uv.hrtime() - session.start_time) / 1e9
    local uptime_min = uptime_sec / 60
    table.insert(lines, string.format('  Session:       %.0f min', uptime_min))
    table.insert(lines, string.format('  Keystrokes:    %d', session.total_keystrokes or 0))
    if uptime_sec > 0 then
      table.insert(lines, string.format('  Keys/sec:      %.1f',
        (session.total_keystrokes or 0) / uptime_sec))
    end
  end

  table.insert(lines, '')

  -- プロファイル結果（有効な場合）
  if Profiler._enabled or next(Profiler._entries) then
    table.insert(lines, '  Profiling Data:')
    for label, entry in pairs(Profiler._entries) do
      local avg_us = (entry.total_ns / entry.count) / 1000
      local status = avg_us < 100 and 'OK' or (avg_us < 1000 and 'WARN' or 'SLOW')
      table.insert(lines, string.format(
        '    %-25s avg: %7.1fus  [%s]', label, avg_us, status
      ))
    end
  end

  -- floating windowで表示
  FloatingUI.show(lines, {
    win_config = {
      relative = 'editor',
      row = 2,
      col = vim.o.columns - 56,
      width = 54,
      height = #lines,
    },
  })
end

vim.api.nvim_create_user_command('VimMentorPerfDash', Dashboard.show, {})
```

---

## 10. パフォーマンスチェックリスト（開発時参照用）

### コードレビュー時の確認項目

```
[ ] InsertCharPre コールバックにガード節があるか
[ ] InsertCharPre コールバック内で重い処理（I/O、RPC）を行っていないか
[ ] CursorMoved/CursorMovedI にデバウンスが適用されているか
[ ] floating windowのバッファ/ウィンドウを再利用しているか
[ ] 差分検出により不要なUI再描画を回避しているか
[ ] データ構造に上限（リングバッファ等）が設定されているか
[ ] テーブルが無限に成長するコードがないか
[ ] タイマーとautocmdがcleanup関数で解放されているか
[ ] ファイル書き込みが非同期で行われているか（VimLeavePreを除く）
[ ] グローバルテーブルへのアクセスがローカル変数にキャッシュされているか
[ ] require()が遅延ロードされているか（起動パスで不要なモジュール）
[ ] string.format()やテーブル連結がホットパスで使われていないか
```

### CI/CD統合

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmark
on: [push, pull_request]
jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rhysd/action-setup-vim@v1
        with:
          neovim: true
          version: stable
      - name: Run benchmarks
        run: |
          nvim --headless -u NONE \
            -c "set rtp+=." \
            -c "luafile bench/run.lua" \
            -c "qa!"
      - name: Check results
        run: |
          # bench/results.json のしきい値チェック
          python3 scripts/check_perf.py bench/results.json
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: bench/results.json
```

---

## 参考資料

- [Vim vs Neovim 2025: Performance Comparison](https://markaicode.com/vim-vs-neovim-2025-performance-plugin-comparison/)
- [lua-vs-vimscript ベンチマーク](https://sr.ht/~henriquehbr/lua-vs-vimscript/)
- [Vim9 script vs LuaJIT 議論 (vim/vim#7903)](https://github.com/vim/vim/issues/7903)
- [Speeding up Neovim (aliquote.org)](https://aliquote.org/post/speed-up-neovim/)
- [perfanno.nvim - LuaJITプロファイラ統合](https://github.com/t-troebst/perfanno.nvim)
- [profile.nvim - Luaプロファイラ](https://github.com/stevearc/profile.nvim)
- [nvim-profiler - 簡易Luaプロファイラ](https://github.com/wookayin/nvim-profiler)
- [Neovim libuv (vim.uv) ドキュメント](https://neovim.io/doc/user/luvref.html)
- [nvim-nio - 非同期I/Oライブラリ](https://github.com/nvim-neotest/nvim-nio)
- [Neovim autocmdドキュメント](https://neovim.io/doc/user/autocmd.html)
- [InsertCharPre パフォーマンス問題](https://github.com/neovim/node-client/issues/75)
- [CursorHold パフォーマンス問題](https://github.com/andymass/vim-matchup/issues/100)
- [better-escape.nvim - マッピング遅延回避](https://neovimcraft.com/plugin/max397574/better-escape.nvim/)
- [Neovim throttle/debounce実装](https://gist.github.com/runiq/31aa5c4bf00f8e0843cd267880117201)
- [vim.debounce() / vim.throttle() 提案 (#33179)](https://github.com/neovim/neovim/issues/33179)
- [Lua-VimScript bridge メモリリーク (#30283)](https://github.com/neovim/neovim/issues/30283)
- [非同期Lua in Neovim解説](https://dzx.fr/blog/async-lua-in-neovim/)
- [coc.nvim Floating Window System](https://deepwiki.com/neoclide/coc.nvim/5.1-floating-window-system)
