# Getting Started -- Vim未経験者のための完全ガイド

このガイドは、Vimを一度も触ったことがない方が vim-mentor を導入し、Vimの操作を学び始めるまでに必要な知識を網羅しています。

---

## 目次

1. [Vimとは何か](#1-vimとは何か)
2. [なぜVimの操作を学ぶのか](#2-なぜvimの操作を学ぶのか)
3. [Neovimのインストール](#3-neovimのインストール)
4. [Neovimの基本操作（最低限の生存スキル）](#4-neovimの基本操作最低限の生存スキル)
5. [vim-mentorのインストール](#5-vim-mentorのインストール)
6. [vim-mentorの使い方](#6-vim-mentorの使い方)
7. [Vimの「モード」を理解する](#7-vimのモードを理解する)
8. [最初に覚えるべきキー操作](#8-最初に覚えるべきキー操作)
9. [vim-mentorが教えてくれること](#9-vim-mentorが教えてくれること)
10. [学習のコツ](#10-学習のコツ)
11. [VS Codeユーザーの場合](#11-vs-codeユーザーの場合)
12. [トラブルシューティング](#12-トラブルシューティング)
13. [次のステップ](#13-次のステップ)

---

## 1. Vimとは何か

Vim（ヴィム）は、1991年に登場したテキストエディタです。ターミナル（黒い画面）の中で動作し、**キーボードだけで全ての操作を完結**できるように設計されています。

Neovim（ネオヴィム）は、Vimの近代的なフォーク（派生版）で、Luaによるプラグインシステム、より優れたAPI、非同期処理などの機能が追加されています。vim-mentorはNeovim上で動作します。

### 普通のエディタとの最大の違い

一般的なエディタ（VS Code、Sublime Text、メモ帳など）では、キーボードを打つと即座に文字が入力されます。

Vimでは「**モード**」という概念があり、同じキーを押しても今いるモードによって動作が変わります。

```
一般的なエディタ:  j を押す → 「j」という文字が入力される
Vimのノーマルモード: j を押す → カーソルが1行下に移動する
Vimのインサートモード: j を押す → 「j」という文字が入力される
```

最初は戸惑いますが、これがVimの最大の強みです。文字入力と編集操作を同じキーボードの同じ位置で行えるため、手をキーボードから離す必要がなくなります。

---

## 2. なぜVimの操作を学ぶのか

### メリット

- **速度**: マウスに手を伸ばす時間がゼロになります。キーボードのホームポジションから手を離さずに全ての編集操作が可能です
- **効率**: `d3w`（3単語削除）のように、操作を組み合わせて複雑な編集を少ないキーストロークで実行できます
- **ユビキタス**: SSH先のサーバー、Docker コンテナ内、どんな環境でもVimは使えます。VS CodeやIDEが使えない場面でも困りません
- **持続性**: 30年以上変わらないキーバインドです。一度覚えれば一生使えます
- **汎用性**: VS Code (vim拡張)、IntelliJ (IdeaVim)、ブラウザ (Vimium) など、多くのツールでVimキーバインドが利用可能です

### vim-mentorのアプローチ

従来のVim学習は「vimtutor（チュートリアル）を一通りやってから実戦」という方式でしたが、vim-mentorは**実際のコーディング中にリアルタイムで教える**というアプローチを取ります。矢印キーを押すと「代わりに `j` を使いましょう」と教えてくれるため、普段の作業をしながら自然にVimの操作を身につけられます。

---

## 3. Neovimのインストール

### macOS

```bash
# Homebrew（推奨）
brew install neovim

# 確認
nvim --version
```

### Ubuntu / Debian

```bash
# apt（バージョンが古い場合があります）
sudo apt update
sudo apt install neovim

# 最新版が必要な場合（AppImage）
curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.appimage
chmod u+x nvim-linux-x86_64.appimage
sudo mv nvim-linux-x86_64.appimage /usr/local/bin/nvim
```

### Windows

```powershell
# winget
winget install Neovim.Neovim

# scoop
scoop install neovim
```

### バージョン確認

vim-mentorにはNeovim 0.10.0以上が必要です。

```bash
nvim --version
# NVIM v0.10.x と表示されればOK
```

---

## 4. Neovimの基本操作（最低限の生存スキル）

vim-mentorを導入する前に、最低限「Neovimを開いて、閉じられる」状態になりましょう。

### Neovimを起動する

```bash
# ファイルを指定して開く
nvim myfile.txt

# 何も指定せず開く
nvim
```

### 最重要: Neovimを終了する方法

Neovimを初めて開くと「どうやって閉じるの？」となります。以下を覚えてください。

```
1. Escキーを押す（ノーマルモードに戻る）
2. :q と入力してEnter（終了）
```

うまくいかない場合の対処法：

| 状況 | 入力するコマンド |
|------|----------------|
| 保存せず終了したい | `:q!` + Enter |
| 保存して終了したい | `:wq` + Enter |
| 何かおかしくなった | まず `Esc` を何回か押す |
| 本当に困った | `Esc` → `:qa!` + Enter（全て強制終了） |

### ファイルを保存する

```
Esc を押す → :w と入力 → Enter
```

### 文字を入力する

Neovimを開いた直後は**ノーマルモード**です。文字を入力するには、`i` キーを押して**インサートモード**に入ります。

```
1. i を押す（画面下部に -- INSERT -- と表示される）
2. 普通に文字を入力する
3. 終わったら Esc を押してノーマルモードに戻る
```

**この3つの操作（起動・終了・文字入力）ができれば、vim-mentorの導入に進めます。**

---

## 5. vim-mentorのインストール

Neovimのプラグインマネージャーを使ってインストールします。まだプラグインマネージャーを入れていない場合は、lazy.nvimを使うのが最も簡単です。

### Step 1: Neovimの設定ファイルを作成する

Neovimの設定ファイルは以下の場所にあります：

| OS | パス |
|----|------|
| macOS / Linux | `~/.config/nvim/init.lua` |
| Windows | `%LOCALAPPDATA%\nvim\init.lua` |

ディレクトリが存在しない場合は作成してください：

```bash
# macOS / Linux
mkdir -p ~/.config/nvim
```

### Step 2: lazy.nvim（プラグインマネージャー）のセットアップ

`~/.config/nvim/init.lua` を以下の内容で作成します。既に設定がある方は、適宜読み替えてください。

```lua
-- lazy.nvim のブートストラップ（自動インストール）
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.uv.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- 基本設定（任意ですが推奨）
vim.opt.number = true         -- 行番号を表示
vim.opt.relativenumber = true  -- 相対行番号（Vimモーションの学習に便利）
vim.opt.mouse = "a"           -- マウスを有効化（vim-mentorがマウス操作を検出するため）

-- プラグインの定義
require("lazy").setup({
  -- vim-mentor: Vim操作ティーチングプラグイン
  {
    "hashiiiii/vim-mentor",
    event = "VeryLazy",
    opts = {
      -- 最初は Gentle（ヒントのみ、操作はブロックしない）から始める
      teaching_mode = 1,
    },
  },
})
```

### Step 3: インストール実行

Neovimを起動すると、lazy.nvimが自動的にプラグインをダウンロードします。

```bash
nvim
```

初回起動時にインストール画面が表示されます。完了したら `q` で閉じてください。

### Step 4: 動作確認

Neovimでファイルを開き、矢印キーを押してみてください。

```bash
nvim test.txt
```

矢印キーの `↓` を押すと、「Use: `j` (move down one line)」というヒントが表示されるはずです。これが vim-mentor の基本動作です。

---

## 6. vim-mentorの使い方

### ティーチングモードの選択

最初は **Gentle（モード1）** から始めることを強く推奨します。

| モード | 名前 | 動作 | 推奨タイミング |
|--------|------|------|---------------|
| 1 | Gentle | ヒントを表示するが、操作はそのまま通す | **最初の1-2週間** |
| 2 | Moderate | ヒントを表示し、1秒遅延してから操作を実行 | 基本操作に慣れてきたら |
| 3 | Strict | 正しいVimコマンドを入力するまでブロック | hjklが自然に出るようになったら |
| 4 | Master | 最小限のヒントで完全ブロック | 上級者向け |

モードの変更：

```
:VimMentor mode 1    " Gentleモードに変更
:VimMentor mode 2    " Moderateモードに変更
```

### 学習レベル

vim-mentorは段階的に検出対象を増やしていきます。最初は矢印キーだけを検出し、上達するにつれてHome/End、Page Up/Down、マウス操作なども検出するようになります。

レベルは正しい操作を重ねると自動的に上がります（`auto_advance = true` の場合）。

### 便利なコマンド

```vim
:VimMentor enable     " 有効化
:VimMentor disable    " 一時的に無効化（集中したい作業のとき）
:VimMentor toggle     " ON/OFF切り替え
:VimMentor level 2    " 学習レベルを手動設定
:VimMentor report     " 学習ダッシュボードを開く
:VimMentor status     " 現在の状態を確認
```

---

## 7. Vimの「モード」を理解する

Vimを使う上で最も重要な概念が**モード**です。

### 4つの主要モード

```
                    i, a, o
            ┌──────────────────┐
            │                  ▼
    ┌───────────┐      ┌───────────┐
    │  Normal   │      │  Insert   │
    │  (通常)   │      │  (入力)   │
    └───────────┘      └───────────┘
            ▲                  │
            │       Esc        │
            └──────────────────┘
            │
            │ v, V, Ctrl-v
            ▼
    ┌───────────┐
    │  Visual   │
    │  (選択)   │
    └───────────┘
            │
            │ Esc
            └──→ Normalに戻る

    ┌───────────┐
    │  Command  │  ← Normalモードで : を押すと入る
    │  (命令)   │  → Enter で実行後、Normalに戻る
    └───────────┘
```

### 各モードの役割

**Normal モード（通常モード）**

Neovim起動直後のモードです。**このモードにいる時間が最も長くなるのが理想です。**

- カーソル移動（`h`, `j`, `k`, `l`）
- テキストの削除（`d`）、コピー（`y`）、貼り付け（`p`）
- 元に戻す（`u`）、やり直す（`Ctrl-r`）
- 他のモードへの切り替え

**Insert モード（入力モード）**

文字を入力するモードです。普通のエディタと同じ感覚で文字を打てます。

入り方はいくつかあります：

| キー | 動作 |
|------|------|
| `i` | カーソルの前に挿入 (insert) |
| `a` | カーソルの後に挿入 (append) |
| `o` | 現在行の下に新しい行を作って挿入 (open) |
| `O` | 現在行の上に新しい行を作って挿入 |
| `I` | 行頭に挿入 |
| `A` | 行末に挿入 (Append) |

**抜け方は常に `Esc` キーです。**

**Visual モード（選択モード）**

テキストを選択するモードです。マウスドラッグの代わりです。

| キー | 動作 |
|------|------|
| `v` | 文字単位の選択 |
| `V` | 行単位の選択 |
| `Ctrl-v` | 矩形（ブロック）選択 |

**Command モード（コマンドモード）**

Normalモードで `:` を押すと入ります。ファイルの保存（`:w`）や終了（`:q`）などを行います。

### モードの見分け方

画面の左下に現在のモードが表示されます：

```
-- INSERT --       → インサートモード
-- VISUAL --       → ビジュアルモード
-- VISUAL LINE --  → 行単位ビジュアルモード
(何も表示なし)      → ノーマルモード
```

### 黄金ルール

> **迷ったら `Esc` を押す。** ノーマルモードに戻れば、そこからやり直せます。

---

## 8. 最初に覚えるべきキー操作

### Week 1: 生存に必要な操作

| 操作 | キー | 覚え方 |
|------|------|--------|
| 左に移動 | `h` | hjklの一番左 |
| 下に移動 | `j` | jは下にフックがある（↓） |
| 上に移動 | `k` | kは上に突き出ている（↑） |
| 右に移動 | `l` | hjklの一番右 |
| ファイル先頭へ | `gg` | "go go" で先頭へ |
| ファイル末尾へ | `G` | 大文字G = Grand finale |
| インサートモードへ | `i` | insert |
| ノーマルモードへ戻る | `Esc` | Escape |
| 保存 | `:w` + Enter | write |
| 終了 | `:q` + Enter | quit |
| 元に戻す | `u` | undo |

**vim-mentorのLevel 1はこれらの操作を教えます。** 矢印キーを押すたびに `h/j/k/l` を使うよう促されます。

### Week 2-3: 効率的な移動

| 操作 | キー | 覚え方 |
|------|------|--------|
| 次の単語へ | `w` | word |
| 前の単語へ | `b` | back |
| 単語の末尾へ | `e` | end |
| 行頭へ | `0` | 0番目の列 |
| 行頭（非空白）へ | `^` | 正規表現の行頭 |
| 行末へ | `$` | 正規表現の行末 |
| N行下へ | `5j` | 数字 + 方向 |
| N行目へジャンプ | `42G` | 42行目へGo |

**vim-mentorのLevel 2はこれらを教えます。** Home/Endキーを押すと `0/^/$` を、Ctrl+矢印を押すと `w/b` を提案します。

### Week 4+: 検索とスクロール

| 操作 | キー | 覚え方 |
|------|------|--------|
| 前方検索 | `/pattern` + Enter | |
| 後方検索 | `?pattern` + Enter | |
| 次の検索結果 | `n` | next |
| 前の検索結果 | `N` | reverse Next |
| 半ページ下スクロール | `Ctrl-d` | down |
| 半ページ上スクロール | `Ctrl-u` | up |
| 画面の上端へ | `H` | High |
| 画面の中央へ | `M` | Middle |
| 画面の下端へ | `L` | Low |

---

## 9. vim-mentorが教えてくれること

### 検出される「非Vim操作」

vim-mentorは以下の操作を検出し、対応するVimコマンドを教えてくれます：

| あなたの操作 | vim-mentorの提案 | 学習レベル |
|-------------|-----------------|-----------|
| ↑ ↓ ← → 矢印キー | `h` `j` `k` `l` | Level 1 |
| ↓を3回以上連打 | `3j`（カウント付き移動） | Level 2 |
| ↓でファイル末尾付近へ | `G`（ファイル末尾へジャンプ） | Level 1 |
| Home / End キー | `0` / `^` / `$` | Level 2 |
| Page Up / Page Down | `Ctrl-u` / `Ctrl-d` | Level 2 |
| Ctrl + ← → | `b` / `w`（単語移動） | Level 2 |
| マウスクリック | `/{pattern}`, `{line}G` | Level 3 |
| マウススクロール | `Ctrl-e` / `Ctrl-y` | Level 3 |
| `j` を4回以上連打 | `4j`（カウント付き移動） | Level 2 |

### ヒントの表示例

矢印キーの↓を押した場合：

```
┌─ Vim Mentor ──────────────────────┐
│ ✗ Detected: Arrow Key (Down)      │
│ ✓ Use: j  (move down one line)    │
│   Press the correct key to skip.  │
└───────────────────────────────────┘
```

さらに、コード行の末尾にもインラインヒントが表示されます：

```
function hello()        ← Use 'j' instead of ↓
```

### 正解したときのフィードバック

正しいVimコマンドを使うと：

- カーソル行が一瞬緑色にフラッシュします
- ステータスラインに連続正解数（ストリーク）が表示されます
- 5, 10, 25, 50, 100回連続正解で祝賀メッセージが表示されます

---

## 10. 学習のコツ

### 推奨する学習ステップ

```
Day 1-3:   Gentleモードで普段通り作業。ヒントを眺めるだけでOK
Day 4-7:   意識的に h/j/k/l を使ってみる。矢印キーはまだ使ってもOK
Week 2:    Moderateモードに切り替え。矢印キーに1秒の遅延が入る
Week 3:    w/b/e を使い始める。Home/End の代わりに 0/^/$ を試す
Week 4:    Strictモードに挑戦。正しいキーを打たないと進めない
Month 2+:  検索（/）やスクロール（Ctrl-d/u）を覚える
```

### やってはいけないこと

- **一度に全部覚えようとしない**: Level 1 の `hjkl` だけで1-2週間過ごすのが正解です
- **ストレスを感じたらモードを下げる**: `:VimMentor mode 1` でいつでもGentleに戻れます
- **作業を止めてまで練習しない**: vim-mentorは実作業中にリアルタイムで教えるツールです。別途練習の時間を取る必要はありません

### 相対行番号を有効にする

`relativenumber` を有効にすると、現在行からの相対的な行数が表示されます。`5j`（5行下に移動）のようなカウント付き移動が格段にやりやすくなります。

```lua
-- init.lua に追加
vim.opt.relativenumber = true
```

表示例：

```
  3  function hello()
  2    local x = 1
  1    local y = 2
  7  ← カーソルがある行（実際の行番号が表示される）
  1    print(x + y)
  2  end
  3
```

この状態で `3k` と打てば `function hello()` の行に移動できます。

---

## 11. VS Codeユーザーの場合

Neovimを使わず、VS Codeで同じ学習体験を得ることもできます。

### インストール

```bash
cd vscode-vim-mentor
npm install
npm run compile
```

その後、VS Codeで「Extensions: Install from VSIX」を使うか、開発モードで実行します。

### 使い方

VS Code上での操作は Neovim 版と同じコンセプトです：

- 矢印キーを押すと「`j` を使いましょう」とヒントが表示される
- ティーチングモードに応じて操作がブロックされる
- ステータスバーに学習レベルとストリークが表示される

コマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）から以下のコマンドが利用可能です：

- `Vim Mentor: Enable` / `Disable` / `Toggle`
- `Vim Mentor: Set Learning Level`
- `Vim Mentor: Set Teaching Mode`
- `Vim Mentor: Open Dashboard`

**注意**: VS Code版はVimキーバインドの「知識」を教えますが、実際にVimモードで編集するわけではありません。VS Code上でVimモードを使いたい場合は、別途 [VSCodeVim](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim) 拡張と併用してください。

---

## 12. トラブルシューティング

### vim-mentorが動作しない

```vim
" プラグインの状態を確認
:VimMentor status

" ヘルスチェックを実行
:checkhealth vim-mentor
```

### ヒントが表示されない

- `:VimMentor enable` で有効になっているか確認
- 現在のファイルタイプが除外リストに入っていないか確認（`:set filetype?` で確認）

### 操作がブロックされて困る

```vim
" 一時的に無効化
:VimMentor disable

" またはGentleモードに変更
:VimMentor mode 1
```

### Neovimの終了方法がわからなくなった

1. `Esc` を何度か押す
2. `:qa!` と入力して Enter

これで必ず終了できます。

### 学習データをリセットしたい

```vim
:VimMentor reset
```

---

## 13. 次のステップ

vim-mentorで基本操作に慣れたら、以下のリソースでさらに深く学べます。

### Neovim内蔵のチュートリアル

```bash
# ターミナルで実行
nvim +Tutor
```

30分ほどの対話型チュートリアルで、Vimの基本操作を体系的に学べます。

### 覚えると便利な操作（vim-mentorの先へ）

| 操作 | キー | 説明 |
|------|------|------|
| 1行削除 | `dd` | delete + delete |
| 1行コピー | `yy` | yank + yank |
| 貼り付け | `p` | paste |
| 単語削除 | `dw` | delete + word |
| 単語変更 | `cw` | change + word |
| 行末まで削除 | `D` | Delete to end |
| 括弧内を変更 | `ci(` | change inside ( |
| クォート内をコピー | `yi"` | yank inside " |
| インデント | `>>` / `<<` | |
| 繰り返し | `.` | 直前の操作を繰り返す |

### Vimの「文法」

Vimのコマンドは **動詞 + 数量 + 名詞** の構造を持っています：

```
d    2    w       → 2単語を削除する
動詞  数量  名詞     (delete 2 words)

c    i    "       → クォートの中を変更する
動詞  前置詞 名詞    (change inside quotes)

y    3    j       → 下3行をコピーする
動詞  数量  名詞    (yank 3 lines down)
```

この「文法」を理解すると、新しいコマンドを覚えるのが格段に楽になります。動詞（`d`, `c`, `y`）と名詞（`w`, `j`, `i"`, `a(`）の組み合わせで、膨大な操作が可能になります。

### おすすめリソース

- [Vim Adventures](https://vim-adventures.com/) -- ゲーム形式でVim操作を学ぶ
- [OpenVim](https://www.openvim.com/) -- ブラウザ上のインタラクティブチュートリアル
- `:help` -- Neovim内蔵のヘルプ（英語ですが最も正確な情報源です）
