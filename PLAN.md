# vim-mentor: Vim操作ティーチングプラグイン プロダクトプラン

## 1. プロダクトビジョン

**vim-mentor** は、実際のコーディング作業中にリアルタイムでVimの正しい操作を教えるNeovimプラグインです。

ユーザーが矢印キー・マウス・Page Up/Down等の「非Vim操作」でカーソルを移動すると、Linterのように正しいVimコマンドを表示し、そのコマンドで操作し直さないと移動が完了しないティーチングモードを提供します。

### コアコンセプト: 「文脈認識型リアルタイム矯正」

既存ツールとの最大の差別化ポイントは以下の3つです:

1. **ブロック + 教育の融合** -- 操作をブロックするだけでなく、最適なVimコマンドを文脈に応じて提案
2. **段階的学習システム** -- 初心者から上級者まで、レベルに応じて検出・提案の厳しさが変化
3. **ポジティブ強化** -- 正しい操作をしたときの即時フィードバックとゲーミフィケーション要素

---

## 2. 競合分析サマリー

### 既存ツールのポジショニング

```
教育度 高
    |
    |   pathfinder.vim          ★ vim-mentor (目指す位置)
    |   (提案するが止めない)       (ブロック + 文脈に応じた提案
    |                            + 段階的学習 + ポジティブ強化)
    |   hardtime.nvim
    |   (ブロック + 基本ヒント)
    |
    |                            hardmode.vim
    |                            (完全ブロック、教育ゼロ)
    |
    |   bad-practices.nvim       vim-hardtime
    |   (警告のみ)               (制限のみ)
    |
教育度 低 ────────────────────────────── 侵入度 高
```

### 主要競合の課題（vim-mentorの差別化ポイント）

| 課題 | 該当ツール | vim-mentorの解決策 |
|------|-----------|-------------------|
| ブロックするだけで教えない | hardmode.vim, vim-hardtime | 文脈に応じた最適コマンドを提案 |
| 教えるが止めない | pathfinder.vim | ブロック + 提案の両立 |
| 文脈を理解しない | hardtime.nvim | カーソル移動量・モード・位置から最適解を算出 |
| 練習と実作業の乖離 | Vim Adventures, vim-be-good | 実際のコーディング中にリアルタイムで介入 |
| 段階的学習の欠如 | ほぼ全ツール | 5段階レベルシステム、自動レベルアップ |
| 進捗の可視化がない | ほぼ全ツール | ダッシュボード、ストリーク、統計 |

---

## 3. ターゲットプラットフォーム

- **Neovim >= 0.10.0 専用** (Lua実装)
- 従来のVimは非対応（`vim.on_key()`, Floating Window API等が必要なため）

### 選定理由

- `vim.on_key()`: 全キー入力のグローバルインターセプトが可能（プラグインの中核機能）
- `vim.keymap.set()`: モード別キーマッピングをLuaから制御可能
- LuaJIT: キー入力ごとの判定処理を高速実行（VimScriptの約1,200倍高速）
- Floating Window API: リッチなヒント表示UI
- 参考実装 hardtime.nvim (3.7k stars) が同アーキテクチャで成功

---

## 4. 機能設計

### 4.1 非Vim操作の検出と提案マッピング

| 非Vim操作 | 検出方法 | 基本提案 | コンテキスト依存提案 |
|-----------|---------|---------|-------------------|
| 矢印キー上下 | `noremap` インターセプト | `j` / `k` | 3回以上連打 → `{count}j/k`, ファイル端 → `gg`/`G` |
| 矢印キー左右 | `noremap` インターセプト | `h` / `l` | 単語境界付近 → `w`/`b`/`e`, 特定文字 → `f`/`t` |
| Home/End | `noremap` インターセプト | `0`/`^`/`$` | Insert mode → `I`/`A` |
| Page Up/Down | `noremap` インターセプト | `Ctrl-d`/`Ctrl-u` | 画面中央化 → `zz`/`zt`/`zb` |
| マウスクリック | `<LeftMouse>` マッピング | `/{pattern}`, `{line}G` | 定義ジャンプ → `gd`/`gD` |
| マウススクロール | `<ScrollWheelUp/Down>` | `Ctrl-e`/`Ctrl-y` | — |
| Ctrl+矢印 | `noremap` インターセプト | `w`/`b`/`W`/`B` | — |
| 検索ダイアログ(Ctrl+F等) | `noremap` インターセプト | `/`/`?`/`*`/`#` | — |
| hjkl連打 | `vim.on_key()` パターン検出 | `{count}j`, `Ctrl-d` | 移動距離に応じた最適提案 |

### 4.2 学習レベルシステム（5段階）

| Level | 名称 | 正解蓄積閾値 | 検出対象 | 提案内容 |
|-------|------|------------|---------|---------|
| 1 | Beginner | 0 | 矢印キーのみ | `h`/`j`/`k`/`l`, `gg`/`G` |
| 2 | Novice | 50 | + Home/End, PageUp/Down | + `w`/`b`/`e`/`0`/`^`/`$`, `Ctrl-d/u` |
| 3 | Intermediate | 150 | + マウス, Ctrl+矢印 | + `/`/`?`/`n`/`N`/`*`/`#`, `H`/`M`/`L` |
| 4 | Advanced | 300 | + hjkl連打 | + `f`/`F`/`t`/`T`/`;`/`,`, テキストオブジェクト |
| 5 | Expert | 500 | + 非効率モーション全般 | + マーク, ジャンプリスト, オペレータ合成 |

### 4.3 4段階ティーチングモード

ブロックの厳しさをユーザーが選択可能:

| モード | 名称 | 動作 | タイムアウト | スキップ |
|--------|------|------|------------|---------|
| 1 | Gentle | ヒント表示のみ、操作は通す | 5秒 | 不要 |
| 2 | Moderate | ヒント表示 + 1秒遅延後に操作実行 | 5秒 | Esc可 |
| 3 | Strict | 正しいキー入力まで完全ブロック | なし | 不可 |
| 4 | Master | Virtual Textのみ + 完全ブロック | なし | 不可 |

---

## 5. UI設計: 3レイヤー "combo" 方式

### 設計哲学

noice.nvim が示した「情報を複数の表示先にルーティング」する方式を採用。which-key.nvim のカーソル近傍ポップアップ、trouble.nvim の構造化診断表示、nvim-notify の通知UIからベストプラクティスを統合。

### 3つの表示レイヤー

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Floating Window（主要表示）                  │
│   カーソル近傍に構造化ヒントをポップアップ表示           │
│   ┌─ Vim Mentor ──────────────────────┐              │
│   │ ✗ Detected: Arrow Key (↓)        │              │
│   │ ✓ Use: j  (move down one line)   │              │
│   │   Type 'j' to continue           │              │
│   └───────────────────────────────────┘              │
│                                                      │
│ Layer 2: Virtual Text（補助表示）                      │
│   コード行末にインラインヒントを表示                     │
│   some_code_here()  ← Use 'j' instead of ↓          │
│                                                      │
│ Layer 3: Statusline（常時表示）                        │
│   [Lv.2:Novice]  🔥5  ⛔Blocked: use Vim motion     │
│   レベル、ストリーク、状態を常時表示                     │
└─────────────────────────────────────────────────────┘
```

### ポジティブ強化

- **即時フィードバック**: 正しいVimコマンド使用時にカーソル行が300ms緑色フラッシュ
- **ストリーク**: 連続正解数をStatuslineに常時表示
- **マイルストーン通知**: 5/10/25/50/100回連続正解で`vim.notify`による祝賀メッセージ
- **ダッシュボード**: `:VimMentorDashboard`で学習統計を可視化（コマンド別正解率、レベル進捗バー等）

### エスカレーション

同じ操作で3回連続失敗した場合:
1. **extended_help**: 詳細説明 + 関連コマンド一覧をFloating Windowで表示
2. **lower_level**: 一時的にレベルを1段階下げる
3. **demo**: コマンドの使い方をステップバイステップ表示

---

## 6. 技術アーキテクチャ

### ディレクトリ構成

```
vim-mentor/
├── plugin/
│   └── vim-mentor.lua          # エントリポイント（最小限、遅延ロード）
├── lua/
│   └── vim-mentor/
│       ├── init.lua            # 公開API (setup, enable, disable)
│       ├── config.lua          # 設定管理・デフォルト値
│       ├── input.lua           # 入力層 (keymap, on_key, autocmd)
│       ├── handler.lua         # イベントハンドラ
│       ├── detector.lua        # 検出エンジン (パターンマッチ)
│       ├── suggestion.lua      # 提案エンジン (レベル対応)
│       ├── rules.lua           # 提案ルールDB (ユーザー拡張可)
│       ├── ui/
│       │   ├── init.lua        # UI設定統合
│       │   ├── hint_popup.lua  # Floating Window表示
│       │   ├── feedback.lua    # 成功フラッシュ・ストリーク
│       │   ├── statusline.lua  # Statusline (lualine互換)
│       │   ├── progress.lua    # ダッシュボードUI
│       │   └── interaction.lua # レベル判定・ブロック制御
│       ├── storage.lua         # 永続化 (JSON, XDG準拠)
│       └── health.lua          # :checkhealth 対応
├── doc/
│   └── vim-mentor.txt          # Vimdocヘルプ
├── spec/
│   ├── unit/                   # ユニットテスト
│   └── functional/             # 機能テスト
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI (lint, test, type-check)
│       └── benchmark.yml       # パフォーマンス回帰テスト
├── .busted                     # テスト設定
├── stylua.toml                 # フォーマッター設定
├── vim-mentor-scm-1.rockspec   # LuaRocksパッケージ
└── README.md
```

### データフロー

```
[キー入力] → [input.lua: keymap/on_key] → [handler.lua]
                                              │
                                    ┌─────────┴─────────┐
                                    ▼                   ▼
                            [detector.lua]      [suggestion.lua]
                            パターンマッチ       最適コマンド算出
                                    │                   │
                                    └─────────┬─────────┘
                                              ▼
                                    [interaction.lua]
                                    レベル判定・ブロック制御
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                        [hint_popup]    [feedback]      [statusline]
                        Floating Win    フラッシュ       ステータス
                                              │
                                              ▼
                                    [storage.lua]
                                    JSON永続化(非同期)
```

### キー入力検出の2段構成

**第1層: `vim.keymap.set()` による直接リマップ**

```lua
-- 矢印キー等を直接インターセプト
vim.keymap.set({'n','v','x'}, '<Down>', function()
  require('vim-mentor.handler').on_blocked_key('<Down>', 'j')
end, { noremap = true, silent = true })
```

**第2層: `vim.on_key()` によるグローバル監視**

```lua
-- hjkl連打等のパターン検出
vim.on_key(function(key)
  -- リングバッファにキーを記録
  -- vim.schedule() で非同期にパターンチェック
end)
```

---

## 7. パフォーマンス設計

### 定量目標

| 指標 | 目標値 | 限界値 | 備考 |
|------|--------|--------|------|
| キー判定レイテンシ | ≤ 2ms | ≤ 5ms | 16ms超で体感遅延 |
| UI描画 | ≤ 5ms | ≤ 16ms | Floating Window表示 |
| メモリ増分 | ≤ 2MB | ≤ 5MB | 長時間セッション含む |
| 起動時間増分 | ≤ 1ms | ≤ 3ms | 遅延ロードで最小化 |
| データ保存 | 非同期 | — | UIスレッド非ブロック |

### 主要最適化戦略

| 優先度 | 対象 | 手法 |
|--------|------|------|
| P1 | InsertCharPre コールバック | ガード句による早期return、最小限のテーブル操作のみ |
| P2 | UI描画 | デバウンス(100ms)、ウィンドウインスタンス再利用、差分検出 |
| P3 | データ保存 | `vim.uv.fs_*`による非同期I/O、バッチ保存(5分間隔) |
| P4 | メモリ管理 | リングバッファ(上限1000件)、弱参照テーブル、`FocusLost`時GC |
| P5 | 起動時間 | `plugin/`は最小限、`require()`遅延実行 |

### autocmdコストバジェット

| イベント | 発火頻度 | バジェット |
|---------|---------|-----------|
| InsertCharPre | 毎キーストローク | ≤ 0.1ms |
| CursorMovedI | Insert中の移動ごと | ≤ 0.5ms |
| CursorMoved | Normal中の移動ごと | ≤ 1ms |
| CursorHold | updatetime経過後 | ≤ 50ms |

---

## 8. テスト・CI戦略

### テストフレームワーク

- **busted** + **nvim-busted-action** (Neovim Lua APIにアクセス可能なテスト環境)
- Unit tests: 各モジュールのロジック単体テスト
- Functional tests: キーマッピング・UI統合テスト

### CI/CD

- **GitHub Actions**: Neovim stable + nightly のマトリクスビルド
- **StyLua**: コードフォーマット
- **selene**: 静的解析
- **lua-language-server**: LuaCATS型チェック
- **パフォーマンス回帰テスト**: ベンチマーク自動実行
- **リリース**: SemVer + luarocks-tag-release でLuaRocks公開

---

## 9. ユーザー設定例

```lua
-- lazy.nvim での設定例
{
  "vim-mentor/vim-mentor",
  event = "VeryLazy",
  opts = {
    -- ティーチングモード (1:Gentle, 2:Moderate, 3:Strict, 4:Master)
    teaching_mode = 2,

    -- 学習レベルの自動昇格
    auto_advance = true,
    advance_threshold = 50,  -- 正解50回でレベルアップ

    -- 検出対象のカスタマイズ
    blocked_keys = {
      arrow_keys = true,
      mouse = true,
      page_keys = true,
      home_end = true,
      ctrl_arrow = true,
      hjkl_repeat = true,  -- Level 4以降で有効
    },

    -- 除外設定
    excluded_filetypes = {
      "NvimTree", "TelescopePrompt", "lazy", "mason",
      "help", "qf", "fugitive",
    },

    -- UI設定
    ui = {
      hint_popup = true,      -- Floating Window
      virtual_text = true,    -- インラインヒント
      statusline = true,      -- Statusline表示
      success_flash = true,   -- 正解時フラッシュ
      streak = { enabled = true, milestones = {5,10,25,50,100} },
    },

    -- データ保存先
    data_path = vim.fn.stdpath("data") .. "/vim-mentor/progress.json",
  },
}
```

---

## 10. コマンド一覧

| コマンド | 説明 |
|---------|------|
| `:VimMentor enable` | プラグインを有効化 |
| `:VimMentor disable` | プラグインを無効化 |
| `:VimMentor toggle` | 有効/無効を切り替え |
| `:VimMentor level [N]` | 学習レベルを表示/設定 |
| `:VimMentor mode [N]` | ティーチングモードを表示/設定 |
| `:VimMentor report` | 使用統計レポートを表示 |
| `:VimMentorDashboard` | 学習ダッシュボードを開く |
| `:VimMentor reset` | 学習データをリセット |
| `:VimMentorBenchmark` | パフォーマンスベンチマーク実行 |

---

## 11. 開発ロードマップ

### Phase 1: MVP (最小実行可能プロダクト)
- [ ] プロジェクト基盤構築 (ディレクトリ構成, rockspec, CI)
- [ ] config.lua: 設定管理
- [ ] input.lua: 矢印キーのインターセプト
- [ ] handler.lua + detector.lua: 基本的な検出ロジック
- [ ] suggestion.lua + rules.lua: Level 1の提案ルール
- [ ] hint_popup.lua: Floating Windowでのヒント表示
- [ ] interaction.lua: Strict モードのブロック制御
- [ ] 基本的なユニットテスト

### Phase 2: 学習システム
- [ ] 5段階レベルシステムの実装
- [ ] 4段階ティーチングモードの実装
- [ ] feedback.lua: 成功フラッシュ・ストリーク
- [ ] storage.lua: JSON永続化
- [ ] progress.lua: ダッシュボードUI
- [ ] Level 2-3の提案ルール追加
- [ ] マウスイベントの検出・ブロック

### Phase 3: 高度な機能
- [ ] hjkl連打のパターン検出 (`vim.on_key()`)
- [ ] コンテキスト依存の最適コマンド提案
- [ ] Level 4-5の提案ルール追加
- [ ] statusline.lua: lualine互換コンポーネント
- [ ] エスカレーション機能 (extended_help, demo)
- [ ] health.lua: `:checkhealth` 対応
- [ ] Vimdocヘルプ作成

### Phase 4: 最適化・公開
- [ ] パフォーマンスプロファイリングと最適化
- [ ] デバウンス・スロットリングの調整
- [ ] メモリリーク対策
- [ ] CI/CDパイプライン完成
- [ ] README.md 作成
- [ ] LuaRocks公開

---

## 12. 既に作成済みのファイル

各スペシャリストが調査・設計の過程で以下のファイルを作成済みです:

### 設計ドキュメント
- `docs/architecture.md` -- 技術アーキテクチャ詳細設計書
- `docs/ui-design-spec.md` -- UI設計仕様書
- `docs/performance-tuning-spec.md` -- パフォーマンスチューニング仕様書

### プロトタイプコード (UI層)
- `lua/vim-mentor/ui/init.lua` -- UI設定管理・デフォルト値
- `lua/vim-mentor/ui/hint_popup.lua` -- Floating Window + Virtual Text
- `lua/vim-mentor/ui/feedback.lua` -- 成功フラッシュ・ストリーク・マイルストーン
- `lua/vim-mentor/ui/statusline.lua` -- Statusline (lualine互換)
- `lua/vim-mentor/ui/progress.lua` -- ダッシュボードUI・データ永続化
- `lua/vim-mentor/ui/interaction.lua` -- インタラクションコントローラ

### ナレッジベース
- `vim_motion_knowledge.ts` -- Vimモーションコマンド体系・検出ルール・学習レベル設計
