# Vim Mentor - UI Design Specification

## 1. 設計思想

### 1.1 基本原則

このUIは「Linter的な指摘 + インタラクティブ教育」を融合した設計である。
既存のNeovimエコシステムで実証済みの4つのUIパターンを基盤とし、
学習目的に最適化した独自のインタラクションフローを構築する。

**参考プラグインと採用パターン:**

| プラグイン | 採用する設計要素 |
|---|---|
| which-key.nvim | カーソル近傍でのコンテキスト表示、キー入力待ちUI |
| trouble.nvim | 構造化された診断情報の表示レイアウト |
| nvim-notify | 非同期通知、マイルストーン表示、vim.notify統合 |
| noice.nvim | メッセージルーティング、複数表示先への同時出力 |
| hardtime.nvim | キー入力ブロック、ヒント表示、レポート機能 |

### 1.2 既存プラグインとの差別化

hardtime.nvim はキー入力の制限と簡易ヒント表示に特化している。
vim-mentor はそこから一歩進み、以下を実現する:

- **段階的ティーチング**: 4段階のレベルで厳しさを自動調整
- **構造化ヒント**: 単なるテキストでなく、検出内容・推奨コマンド・説明を構造化表示
- **ポジティブ強化**: ストリーク追跡、マイルストーン祝賀、成功フラッシュ
- **学習ダッシュボード**: コマンド別習熟度の可視化

---

## 2. UI コンポーネント構成

### 2.1 アーキテクチャ概要

```
┌─────────────────────────────────────────────────────┐
│                    ui/init.lua                       │
│              (設定管理・モジュール統合)                │
├────────────┬────────────┬──────────┬────────────────┤
│ hint_popup │ statusline │ feedback │   progress     │
│   .lua     │   .lua     │  .lua    │    .lua        │
├────────────┴────────────┴──────────┴────────────────┤
│               ui/interaction.lua                     │
│           (インタラクションコントローラ)               │
│         レベル判定 → 表示 → 入力待ち → フィードバック   │
└─────────────────────────────────────────────────────┘
```

### 2.2 表示モード選択: "combo" 方式

単一の表示方法に依存せず、**3つの表示レイヤーを同時使用**する
"combo" モードをデフォルトとする。

```
┌── Editor ──────────────────────────────────────────────┐
│                                                        │
│  function hello()          ┌─────────────────────────┐ │
│    local x = 1             │   Vim Mentor [Lv2]      │ │
│    local y = 2  █          │  ─────────────────────── │ │
│    return x + y            │  Detected: Arrow (Right) │ │
│  end                       │                          │ │
│                            │   Use:  l  (move right) │ │
│                            │                          │ │
│                            │  Press key, or <Esc>     │ │
│                            └─────────────────────────┘ │
│                                                        │
│    local y = 2   Use: l (move right) ← virtual text  │
│                                                        │
├────────────────────────────────────────────────────────┤
│  NORMAL │  2:Moderate  5  Blocked: use Vim motion   │
│         │  ← statusline component →                    │
└────────────────────────────────────────────────────────┘
```

**Layer 1 - Floating Window (主要):**
カーソル近傍にポップアップ表示。which-key.nvim と同じ
「コンテキストに応じた即座のヘルプ」パターン。

**Layer 2 - Virtual Text (補助):**
trouble.nvim / tiny-inline-diagnostic.nvim と同じ
「コード行末にインライン情報を表示」パターン。
Floating Window を閉じた後も視覚的リマインダーとして残る。

**Layer 3 - Statusline (常時):**
trouble.nvim の lualine 統合と同じパターン。
現在のレベル、ストリーク、ブロック状態を常時表示。

---

## 3. Floating Window 詳細設計

### 3.1 レイアウト構造

```
┌─ Vim Mentor ─────────────────────────┐
│                                       │
│   Vim Mentor  [Level 2: Moderate]    │
│  ─────────────────────────────────── │
│  Detected: Arrow key (Right)         │  ← 赤色: 何が検出されたか
│                                       │
│   Use:  l  (move right)             │  ← 黄色: 推奨キー
│   Vim:  :normal l                    │  ← 青色: Vimコマンド（参考）
│                                       │
│  Press the correct key, or <Esc>     │  ← 行動指示
│                                       │
└───────────────────────────────────────┘
```

### 3.2 位置制御

- **デフォルト**: カーソルの左上に表示 (`anchor = "SW"`)
  - カーソルの先（右側・下側）のコードを隠さない
  - which-key.nvim と同じ「入力位置の近くに出す」原則

- **画面端の処理**: カーソルが画面上部にある場合は下方に表示を切り替え
  - nvim_open_win の relative="cursor" が自動的に処理

- **画面右端の処理**: 幅が足りない場合は左方向にずらす

### 3.3 スタイリング

カラースキーム非依存で動作するハイライトグループ設計:

| ハイライトグループ | 用途 | デフォルトリンク先 |
|---|---|---|
| `VimMentorBorder` | ウィンドウ枠線 | `FloatBorder` |
| `VimMentorFloat` | ウィンドウ背景 | `NormalFloat` |
| `VimMentorTitle` | タイトル文字 | 独自（オレンジ） |
| `VimMentorDetected` | 検出された誤操作 | 独自（赤） |
| `VimMentorCommand` | Vimコマンド表示 | 独自（青） |
| `VimMentorKey` | 押すべきキー | 独自（黄） |
| `VimMentorDesc` | 説明テキスト | 独自（グレー） |
| `VimMentorSuccess` | 成功フラッシュ | 独自（緑） |
| `VimMentorStreak` | ストリーク表示 | 独自（紫） |
| `VimMentorLevel1-4` | レベル色分け | 独自（緑→黄→橙→赤） |

nvim-notify と同じ原則: デフォルト色を持ちつつ、ユーザーが
自身のカラースキームで上書き可能にする。

---

## 4. インタラクションフロー詳細

### 4.1 4段階のティーチングレベル

```
Level 1: Gentle（初心者向け）
  操作検出 → ヒント表示 → 操作は通す → 5秒後にヒント消去
  目的: まず「Vimにはこういうコマンドがある」と知らせる

Level 2: Moderate（学習中）
  操作検出 → ヒント表示 → 1秒遅延後に操作実行 → <Esc>でスキップ可
  目的: 非Vim操作に「摩擦」を加え、Vimコマンドの使用を促す

Level 3: Strict（定着フェーズ）
  操作検出 → ヒント表示 → 操作ブロック → 正しいキー入力まで待機
  目的: Vimコマンドの使用を強制し、筋肉記憶を構築する

Level 4: Master（最終段階）
  操作検出 → Virtual Textのみ表示 → 操作ブロック → 正しいキー入力まで待機
  目的: ヒントなしで正しいコマンドを思い出す力をテストする
```

### 4.2 ブロック時のシーケンス図

```
User          Detection       Interaction      UI(Popup)      UI(Feedback)
 │                │                │                │               │
 │  Arrow Right   │                │                │               │
 │───────────────>│                │                │               │
 │                │ non_vim_detected               │               │
 │                │───────────────>│                │               │
 │                │                │  show(hint)    │               │
 │                │                │───────────────>│               │
 │                │                │  show_vtext    │               │
 │                │                │───────────────>│               │
 │                │                │                │               │
 │                │          [操作ブロック状態]       │               │
 │                │                │                │               │
 │  l (correct)   │                │                │               │
 │───────────────────────────────>│                │               │
 │                │                │  close()       │               │
 │                │                │───────────────>│               │
 │                │                │  record_success│               │
 │                │                │───────────────────────────────>│
 │                │                │                │  flash_success │
 │<──────────────────────────────────────────────────────────────── │
 │                │                │                │               │
 │  (cursor moves right by 'l')   │                │               │
```

### 4.3 エスカレーション

同じ操作で連続3回失敗した場合のエスカレーション:

1. **extended_help** (デフォルト): 詳細な説明を別のFloating Windowで表示
   - コマンドの仕組み
   - 関連コマンドの一覧
   - 失敗回数の通知

2. **lower_level**: 一時的にレベルを1段階下げる
   - Level 3 で詰まったら Level 2 に戻す
   - 成功後に元のレベルに復帰

3. **demo**: コマンドの使い方をステップバイステップで表示

### 4.4 タイムアウト設計

| レベル | タイムアウト | 動作 |
|---|---|---|
| Level 1 | 5000ms | ヒント自動消去、操作は通る |
| Level 2 | 5000ms | ヒント自動消去、操作は1秒遅延後に通る |
| Level 3 | なし | 正しい入力まで無期限で待機 |
| Level 4 | なし | 正しい入力まで無期限で待機 |

---

## 5. ポジティブ強化（フィードバック設計）

### 5.1 即時フィードバック

正しいVimコマンドを使用した場合:
- カーソル行が **緑色に300msフラッシュ**
- Floating Window がスムーズに閉じる

### 5.2 ストリーク追跡

連続して正しいVimコマンドを使い続けると:

```
 5回: "Nice start!"           vim.notify で通知
10回: "Getting better!"       vim.notify で通知
25回: "Impressive!"           vim.notify で通知
50回: "Vim Apprentice!"       vim.notify で通知
100回: "Vim Master!"           vim.notify で通知
```

nvim-notify がインストールされていればリッチな通知UIで表示。
なければ Neovim 標準の vim.notify で表示。

### 5.3 ゲーミフィケーション原則

UXゲーミフィケーション研究に基づく設計:

1. **即時性**: フィードバックは操作の直後に発生する（300ms以内）
2. **段階性**: レベルが上がるにつれ要求が厳しくなる（フロー状態の維持）
3. **マイルストーン**: 適度な間隔で達成感を提供（5, 10, 25, 50, 100）
4. **可視化**: ダッシュボードで長期的進捗を確認可能
5. **控えめさ**: 祝賀は短時間で消え、コーディング作業を邪魔しない

---

## 6. ダッシュボード（:VimMentorDashboard）

### 6.1 レイアウト

```
┌─ Vim Mentor - Learning Dashboard ──────────────────────────────────┐
│                                                                     │
│    LEARNING PROGRESS                                               │
│                                                                     │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│    Current Session                                                 │
│                                                                     │
│      Correct:     47                                               │
│      Incorrect:   12                                               │
│      Accuracy:    79%                                              │
│      Streak:      8                                                │
│                                                                     │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│    Lifetime Statistics                                             │
│                                                                     │
│      Total Correct:   1,247                                        │
│      Total Incorrect: 356                                          │
│      Best Streak:     42                                           │
│      Sessions:        23                                           │
│      Current Level:   3                                            │
│                                                                     │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│    Most Practiced Commands                                         │
│                                                                     │
│      Command    Correct  Prompted  Accuracy                        │
│      ─────────────────────────────────────────                     │
│      w              89        23      79%                          │
│      b              67        18      78%                          │
│      f              45        31      59%                          │
│      $              38        12      76%                          │
│      gg             29         8      78%                          │
│                                                                     │
│  ─────────────────────────────────────────────────────────────     │
│                                                                     │
│    Level Progress                                                  │
│                                                                     │
│      [████████████████████████░░░░░░░░░░░░░░░░] 47/50             │
│      Level 3 -> Level 4                                            │
│                                                                     │
│    Press q or <Esc> to close.                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 データ永続化

- JSON形式で `stdpath("data")/vim-mentor/progress.json` に保存
- セッション終了時に自動保存
- コマンド別の統計、セッション履歴、レベル進捗を記録

---

## 7. Statusline コンポーネント

### 7.1 表示内容

```
  2:Moderate   5   Blocked: use Vim motion
  ^             ^    ^
  │             │    └─ 最新のヒント概要
  │             └────── 現在のストリーク数
  └──────────────────── 現在のレベル
```

### 7.2 lualine 統合

```lua
-- ユーザーの lualine 設定例:
require("lualine").setup({
  sections = {
    lualine_x = {
      require("vim-mentor.ui.statusline").lualine,
    },
  },
})
```

---

## 8. 設定のカスタマイズ例

### 8.1 最小構成（デフォルト使用）

```lua
require("vim-mentor").setup()
```

### 8.2 厳格モード

```lua
require("vim-mentor").setup({
  display_mode = "combo",
  levels = {
    current = 3,
    auto_advance = false,
  },
  interaction = {
    allow_skip = false,
    timeout = 0,
  },
})
```

### 8.3 穏やかモード（初心者向け）

```lua
require("vim-mentor").setup({
  display_mode = "combo",
  levels = {
    current = 1,
    auto_advance = true,
    advance_threshold = 100,  -- ゆっくり進む
  },
  interaction = {
    allow_skip = true,
    timeout = 8000,  -- 長めのタイムアウト
    escalation_threshold = 5,  -- 寛容なエスカレーション
  },
  feedback = {
    streak = {
      milestones = { 3, 7, 15, 30, 50 },  -- 低めのマイルストーン
    },
  },
})
```

### 8.4 Virtual Text のみ（最小限UI）

```lua
require("vim-mentor").setup({
  display_mode = "virtual_text",
  floating = { enabled = false },
  statusline = { enabled = false },
})
```

---

## 9. 実装ファイル構成

```
lua/vim-mentor/ui/
  init.lua          -- 設定管理、モジュール統合、デフォルト値
  hint_popup.lua    -- Floating Window + Virtual Text 表示
  statusline.lua    -- Statusline コンポーネント (lualine互換)
  feedback.lua      -- 成功フラッシュ、ストリーク、マイルストーン
  progress.lua      -- データ永続化、ダッシュボードUI
  interaction.lua   -- インタラクションコントローラ（レベル判定・フロー制御）
```

---

## 10. 今後の拡張案

1. **Telescope 統合**: ヒント履歴の検索 (nvim-notify のパターン)
2. **which-key 連携**: which-key の表示に Vim Mentor の学習状況を統合
3. **マルチプレイヤー**: チーム内での学習進捗共有
4. **カスタムヒント**: ユーザー定義のコマンドマッピングにも対応
5. **Treesitter 連携**: コード構造を認識した高度なモーション提案
