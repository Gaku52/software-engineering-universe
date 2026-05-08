# Directory Navigation and Listing

> Navigating the filesystem is the most fundamental CLI skill. Mastering this thoroughly forms the foundation for all command-line operations.

## What You Will Learn

- [ ] Navigate directories and display listings with confidence
- [ ] Understand the difference between absolute and relative paths
- [ ] Fully grasp the major options of ls
- [ ] Leverage the directory stack (pushd/popd)
- [ ] Practice high-speed navigation with zoxide and fzf
- [ ] Understand the structure of the filesystem
- [ ] Check and analyze disk usage
- [ ] Use modern alternative tools (eza, tree, ncdu)


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Directory Operation Basics

### 1.1 cd (Change Directory)

```bash
# ============================================
# cd の基本操作
# ============================================

pwd                          # 現在のディレクトリを表示（Print Working Directory）
cd /path/to/dir              # 絶対パスで移動
cd relative/path             # 相対パスで移動
cd ~                         # ホームディレクトリに移動（cd だけでも同じ）
cd                           # ホームディレクトリに移動（引数なし）
cd -                         # 前のディレクトリに戻る（トグル動作）
cd ..                        # 1つ上のディレクトリ（親ディレクトリ）
cd ../..                     # 2つ上のディレクトリ
cd ../../..                  # 3つ上のディレクトリ
cd ~username                 # 指定ユーザーのホームディレクトリ

# 実践的な使い方
cd ~/projects/myapp          # プロジェクトディレクトリに移動
cd /var/log                  # ログディレクトリに移動
cd /etc                      # 設定ファイルディレクトリに移動
cd /tmp                      # 一時ファイルディレクトリに移動
cd /usr/local/bin            # ローカルバイナリディレクトリに移動

# CDPATH: cd のサーチパス
# CDPATH に設定したディレクトリ以下のサブディレクトリに直接移動可能
export CDPATH=".:$HOME:$HOME/projects:$HOME/Documents"
# これにより、どこからでも以下が可能:
cd myapp                     # ~/projects/myapp に移動
cd Documents                 # ~/Documents に移動

# cd の終了コード
cd /existing/dir && echo "移動成功"
cd /nonexistent && echo "これは表示されない"  # エラー: 終了コード1

# cd とコマンドの組み合わせ
cd /var/log && ls -la        # 移動後にls実行
(cd /tmp && make)            # サブシェルで移動（元に戻る）
```

### 1.2 cd Shortcuts and Efficiency

```bash
# ============================================
# zsh の cd 拡張機能
# ============================================

# AUTO_CD: ディレクトリ名だけで cd（setopt AUTO_CD が必要）
setopt AUTO_CD
/tmp                         # cd /tmp と同じ
..                           # cd .. と同じ
~                            # cd ~ と同じ

# AUTO_PUSHD: cd するたびに自動でpushd
setopt AUTO_PUSHD
setopt PUSHD_IGNORE_DUPS     # 重複をスタックに入れない
setopt PUSHD_SILENT           # pushd/popd のメッセージを抑制

# cd のスペル訂正（zsh）
setopt CORRECT
# cd /tpm → zsh: correct '/tpm' to '/tmp' [nyae]?

# ディレクトリの補完強化
setopt COMPLETE_IN_WORD       # カーソル位置で補完
setopt ALWAYS_TO_END          # 補完後にカーソルを末尾に

# ハッシュドディレクトリ（zsh）
hash -d projects=~/projects
hash -d docs=~/Documents
hash -d dl=~/Downloads
# 使い方: cd ~projects, cd ~docs, cd ~dl

# bash のエイリアスによる高速移動
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias -- -='cd -'

# よく使うディレクトリへのブックマーク
alias cdp='cd ~/projects'
alias cdw='cd ~/work'
alias cdl='cd /var/log'
alias cdc='cd ~/.config'
alias cdt='cd /tmp'
```

### 1.3 Directory Stack (pushd/popd)

```bash
# ============================================
# ディレクトリスタックの活用
# ============================================

# pushd: 現在のディレクトリをスタックに保存して移動
pushd /var/log               # /var/log に移動（元の場所をスタックに保存）
pushd /etc                   # /etc に移動（/var/log をスタックに保存）
pushd /tmp                   # /tmp に移動（/etc をスタックに保存）

# dirs: スタックの内容を表示
dirs                         # スタック全体を表示（左が現在地）
dirs -v                      # 番号付きで表示（一番使う）
# 出力例:
# 0  /tmp
# 1  /etc
# 2  /var/log
# 3  /home/user

# popd: スタックから取り出して戻る
popd                         # スタックの先頭に戻る（/etc に移動）
popd                         # さらに戻る（/var/log に移動）
popd                         # さらに戻る（/home/user に移動）

# スタック番号で移動
dirs -v                      # 番号を確認
pushd +2                     # スタックの2番目に移動
pushd +0                     # スタックのローテーション

# スタックから特定の要素を削除
popd +2                      # 2番目のエントリを削除

# 実践的なワークフロー
# 例: 複数のプロジェクトディレクトリ間を行き来する
pushd ~/projects/frontend
pushd ~/projects/backend
pushd ~/projects/infra
dirs -v
# 0  ~/projects/infra
# 1  ~/projects/backend
# 2  ~/projects/frontend
# pushd +1 で backend に切り替え
# pushd +2 で frontend に切り替え

# スタックのクリア
dirs -c                      # スタックを全クリア
```

### 1.4 zoxide (Smart cd)

```bash
# ============================================
# zoxide の導入と活用
# ============================================

# インストール
brew install zoxide          # macOS
sudo apt install zoxide      # Ubuntu/Debian（新しいバージョン）
# curl -sS https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | bash

# シェルに設定を追加
eval "$(zoxide init zsh)"    # ~/.zshrc に追加
# eval "$(zoxide init bash)" # bash の場合

# 基本的な使い方
z projects                   # 過去の訪問履歴から最適な "projects" ディレクトリに移動
z proj                       # 部分一致でも移動可能
z my app                     # 複数キーワード（"my" と "app" を含むパス）
z -                          # 前のディレクトリに戻る
zi                           # インタラクティブ選択（fzf連携）

# zoxide のスコアリング
# - 頻繁にアクセスするディレクトリほどスコアが高い
# - 最近アクセスしたディレクトリほどスコアが高い
# - 存在しないディレクトリは自動的にデータベースから削除

# データベース管理
zoxide query                 # データベースの内容を表示
zoxide query --list          # パスのみ表示
zoxide query -s              # スコア付きで表示
zoxide query -s projects     # "projects" を含むエントリのスコア
zoxide add /path/to/dir      # パスを手動追加
zoxide remove /path/to/dir   # パスを手動削除
zoxide edit                  # データベースをエディタで編集

# zoxide + fzf の連携
zi                           # fzf でインタラクティブに選択
# Ctrl+R のように、候補一覧から選んで移動できる

# cd の完全な置き換え
# ~/.zshrc に追加（cdコマンドをzoxideで置き換え）
# alias cd='z'

# 実践シナリオ
# 1日の作業の中で何度もプロジェクトディレクトリを行き来する場合
z frontend                   # ~/projects/mycompany/frontend に一発移動
z api                        # ~/work/services/api に一発移動
z infra terraform            # ~/infra/terraform/environments に移動
# → 手動でフルパスを入力する必要がない
```

### 1.5 Directory Navigation with fzf

```bash
# ============================================
# fzf によるインタラクティブナビゲーション
# ============================================

# Alt+C: ディレクトリを検索して移動（fzfのデフォルトバインド）
# 設定:
export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git'
export FZF_ALT_C_OPTS='--preview "eza --tree --level=2 --icons {} 2>/dev/null || tree -L 2 {}"'

# カスタム関数: fzf でディレクトリを検索してcd
fcd() {
    local dir
    dir=$(fd --type d --hidden --follow --exclude .git 2>/dev/null | \
        fzf --height 60% --preview 'ls -la {}' --preview-window=right:50%)
    [ -n "$dir" ] && cd "$dir"
}

# 特定のプロジェクトディレクトリに限定した検索
proj() {
    local dir
    dir=$(fd --type d --max-depth 2 . ~/projects ~/work 2>/dev/null | \
        fzf --height 40% --reverse --preview 'ls -la {}')
    [ -n "$dir" ] && cd "$dir"
}

# 最近アクセスしたディレクトリをfzfで選択（zoxide + fzf）
recent() {
    local dir
    dir=$(zoxide query --list | fzf --height 40% --reverse --preview 'ls -la {}')
    [ -n "$dir" ] && cd "$dir"
}

# Git リポジトリのルートに移動
cdgit() {
    local gitroot
    gitroot=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -n "$gitroot" ]; then
        cd "$gitroot"
    else
        echo "Not in a git repository"
    fi
}
alias gr='cdgit'

# Git リポジトリ一覧からfzfで選択して移動
repos() {
    local repo
    repo=$(fd -H -t d .git ~/projects ~/work 2>/dev/null | \
        sed 's|/\.git$||' | \
        fzf --height 40% --reverse --preview 'git -C {} log --oneline -5')
    [ -n "$repo" ] && cd "$repo"
}
```

---

## 2. File Listing (ls)

### 2.1 Basic ls Options

```bash
# ============================================
# ls の主要オプション完全ガイド
# ============================================

# 基本表示
ls                           # ファイル一覧（名前のみ）
ls /path/to/dir              # 指定ディレクトリの一覧
ls file1 file2               # 指定ファイルの情報

# 詳細表示
ls -l                        # 長い形式（パーミッション、サイズ等）
ls -la                       # 隠しファイル含む（. から始まるファイル）
ls -lA                       # . と .. を除く隠しファイル
ls -lh                       # サイズを人間可読形式（KB, MB, GB）
ls -lah                      # 最もよく使う組み合わせ

# 出力例:
# drwxr-xr-x  5 user group  160 Feb 16 10:30 Documents
# -rw-r--r--  1 user group 4.0K Feb 16 09:15 README.md
# lrwxr-xr-x  1 user group   20 Jan  5 14:20 link -> /path/to/target
#
# 各カラムの意味:
# d rwx r-x r-x    パーミッション（タイプ + owner + group + other）
# 5                 ハードリンク数
# user              所有者
# group             グループ
# 160               ファイルサイズ（バイト、-h で人間可読に）
# Feb 16 10:30      最終更新日時
# Documents         ファイル/ディレクトリ名

# ソートオプション
ls -lt                       # 更新日時順（新しい順）
ls -ltr                      # 更新日時順（古い順）
ls -lS                       # ファイルサイズ順（大きい順）
ls -lSr                      # ファイルサイズ順（小さい順）
ls -lX                       # 拡張子順（Linuxのみ）
ls -lU                       # ディレクトリ内の順序（ソートなし）
ls -lv                       # バージョン番号順（file1, file2, file10の正しい順序）

# フィルタリング
ls -d */                     # ディレクトリのみ表示
ls -d .*/                    # 隠しディレクトリのみ表示
ls *.md                      # .md ファイルのみ
ls -d .*                     # 隠しファイルのみ（. と .. 含む）

# 表示形式
ls -1                        # 1行1ファイル（スクリプトで有用）
ls -m                        # カンマ区切り
ls -R                        # 再帰的に表示
ls -F                        # タイプ表示（/ ディレクトリ, * 実行可能, @ リンク）
ls --color=auto              # カラー表示（Linux）
ls -G                        # カラー表示（macOS）

# 再帰表示
ls -R                        # サブディレクトリ内も全て表示
ls -R | head -50             # 最初の50行だけ表示

# inode表示
ls -i                        # inode番号を表示
ls -li                       # 詳細表示 + inode番号

# タイムスタンプの種類
ls -l                        # mtime（最終更新日時、デフォルト）
ls -lc                       # ctime（メタデータ変更日時）
ls -lu                       # atime（最終アクセス日時）
ls -l --time=birth           # 作成日時（Linux、対応FS限定）

# タイムスタンプの表示形式
ls -l --time-style=long-iso  # ISO 8601形式（2026-02-16 10:30）
ls -l --time-style=full-iso  # フルISO形式
ls -l --time-style="+%Y-%m-%d %H:%M"  # カスタム形式
```

### 2.2 Understanding ls Output

```
How to fully read the output of ls -la:

total 48                              <- Total block size
drwxr-xr-x  12 user group 384 Feb 16 10:30 .
drwxr-xr-x   5 user group 160 Feb 16 09:00 ..
-rw-r--r--   1 user group  35 Feb 16 10:30 .gitignore
drwxr-xr-x   8 user group 256 Feb 16 10:30 .git
-rw-r--r--   1 user group 1.2K Feb 16 10:25 Makefile
-rw-r--r--   1 user group 4.0K Feb 16 10:20 README.md
drwxr-xr-x   5 user group 160 Feb 16 10:15 src
lrwxr-xr-x   1 user group   3 Feb 16 10:10 link -> src

File type (first character):
  -  Regular file
  d  Directory
  l  Symbolic link
  c  Character device (/dev/null, etc.)
  b  Block device (/dev/sda, etc.)
  p  Named pipe (FIFO)
  s  Socket

Color display meanings (typical configuration):
  Blue      Directory
  Green     Executable file
  Cyan      Symbolic link
  Red       Broken symbolic link / archive file
  Yellow    Device file
  Magenta   Image / video file
  White     Regular file
```

### 2.3 Practical ls Usage

```bash
# ============================================
# 実務でよく使う ls コマンドパターン
# ============================================

# 大きなファイルを見つける
ls -lhS | head -20                   # サイズの大きい順でトップ20

# 最近更新されたファイルを見つける
ls -lt | head -20                    # 最近更新された順でトップ20
ls -ltr                              # 古い順（最新が一番下）

# 特定の拡張子のファイルだけ表示
ls -la *.{js,ts}                     # JavaScript/TypeScript
ls -la *.{jpg,png,gif,svg}           # 画像ファイル
ls -la *.{yml,yaml}                  # YAML ファイル
ls -la *.{log,err}                   # ログファイル

# ファイル数をカウント
ls -1 | wc -l                        # ファイル数
ls -1A | wc -l                       # 隠しファイル含む
ls -1d */ 2>/dev/null | wc -l        # ディレクトリ数

# ディレクトリのみ表示
ls -d */                             # ディレクトリ名一覧
ls -ld */                            # ディレクトリの詳細

# パーミッションで絞り込み（find との組み合わせ）
ls -la | grep "^d"                   # ディレクトリのみ
ls -la | grep "^-"                   # ファイルのみ
ls -la | grep "^l"                   # シンボリックリンクのみ
ls -la | grep "^-..x"               # 実行可能ファイル

# ファイルを見やすく表示
ls -la --group-directories-first     # ディレクトリを先に表示（Linux）
ls -la | sort -k 5 -n               # サイズ順でソート（5番目のカラム）
ls -la | sort -k 6,7                 # 日付順でソート（6,7番目のカラム）

# 特定のパターンの除外
ls -I "*.bak" -I "*.tmp"            # .bak と .tmp を除外（Linux）
ls | grep -v "\.bak$"               # .bak を除外（パイプ版）

# 再帰的なファイル一覧（フルパス）
ls -R                                # 再帰的に全ファイルを表示
find . -name "*.md" -type f          # .md ファイルをフルパスで表示
```

### 2.4 ls Alias Configuration

```bash
# ============================================
# 推奨する ls のエイリアス設定
# ============================================

# macOS の場合（BSDのls）
alias ls='ls -G'                     # カラー表示
alias ll='ls -lah'                   # 詳細表示（最もよく使う）
alias la='ls -A'                     # 隠しファイル含む
alias lt='ls -lahtr'                 # 更新日時順（新しいのが下）
alias lS='ls -lahSr'                # サイズ順（大きいのが下）
alias l.='ls -d .*'                  # 隠しファイルのみ
alias ld='ls -d */'                  # ディレクトリのみ

# Linux の場合（GNUのls）
alias ls='ls --color=auto --group-directories-first'
alias ll='ls -lah'
alias la='ls -A'
alias lt='ls -lahtr'
alias lS='ls -lahSr'
alias l.='ls -d .*'
alias ld='ls -d */'
alias lx='ls -lXB'                  # 拡張子順

# eza（モダンなls代替）がある場合
if command -v eza &>/dev/null; then
    alias ls='eza --color=auto --icons'
    alias ll='eza -lah --icons --git'
    alias la='eza -a --icons'
    alias lt='eza -la --sort=modified --icons'
    alias lS='eza -la --sort=size --icons'
    alias l.='eza -d .* --icons'
    alias ld='eza -D --icons'
    alias tree='eza --tree --icons'
    alias ltree='eza --tree --icons --long'
fi
```

---

## 3. eza (Modern ls Alternative)

### 3.1 eza Basics

```bash
# ============================================
# eza（旧 exa）の使い方
# ============================================

# インストール
brew install eza              # macOS
sudo apt install eza          # Ubuntu 24.04+
# cargo install eza           # Rust

# 基本的な使い方
eza                           # ファイル一覧（カラー表示）
eza -l                        # 長い形式
eza -la                       # 隠しファイル含む
eza -lah                      # ヘッダー付き
eza -1                        # 1行1ファイル

# eza の強力なオプション

# Git 連携
eza --git                     # Gitのステータスを表示
eza -la --git                 # 詳細表示 + Git ステータス
# 出力例:
# .M  -rw-r--r--  user  1.2k  Feb 16 10:30  modified-file.txt
# N   -rw-r--r--  user  500   Feb 16 10:20  new-file.txt
# Git ステータス: M=変更, N=新規, I=無視, -=追跡対象外

# アイコン表示（Nerd Font が必要）
eza --icons                   # ファイルタイプに応じたアイコン表示
eza -la --icons               # 詳細 + アイコン

# ツリー表示
eza --tree                    # ツリー形式で表示
eza --tree --level=2          # 深さ2まで
eza --tree --level=3 --icons  # 深さ3 + アイコン
eza --tree -I "node_modules|.git|__pycache__"  # 除外パターン

# ソート
eza --sort=name               # 名前順（デフォルト）
eza --sort=modified           # 更新日時順
eza --sort=size               # サイズ順
eza --sort=extension          # 拡張子順
eza --sort=type               # ファイルタイプ順
eza --sort=created            # 作成日時順
eza --sort=accessed           # アクセス日時順
eza --sort=none               # ソートなし
eza -r --sort=size            # 逆順

# フィルタリング
eza --only-dirs               # ディレクトリのみ
eza --only-files              # ファイルのみ
eza -I "*.bak|*.tmp"          # パターンで除外

# グループ化
eza --group-directories-first # ディレクトリを先に表示

# ヘッダーとカラム
eza -lh                       # ヘッダー行を表示
eza -l --no-user              # ユーザー名を非表示
eza -l --no-permissions       # パーミッションを非表示
eza -l --time-style=long-iso  # ISO形式の日時
eza -l --time-style=relative  # 相対時間（3 hours ago等）

# 組み合わせ例
eza -la --icons --git --group-directories-first --sort=modified
eza --tree --level=3 --icons -I "node_modules|.git|dist|build"
eza -la --icons --git --time-style=relative
```

---

## 4. tree Command

### 4.1 tree Basics

```bash
# ============================================
# tree コマンドの使い方
# ============================================

# インストール
brew install tree            # macOS
sudo apt install tree        # Ubuntu/Debian

# 基本的な使い方
tree                         # カレントディレクトリのツリー表示
tree /path/to/dir            # 指定ディレクトリ

# 深さの制限
tree -L 1                    # 1階層のみ
tree -L 2                    # 2階層まで
tree -L 3                    # 3階層まで

# フィルタリング
tree -I "node_modules"                    # node_modules を除外
tree -I "node_modules|.git|dist|build"    # 複数パターン除外
tree -P "*.md"                            # .md ファイルのみ表示
tree -P "*.py" --prune                    # .py があるディレクトリだけ表示

# 表示オプション
tree -a                      # 隠しファイル含む
tree -d                      # ディレクトリのみ
tree -f                      # フルパスを表示
tree -p                      # パーミッションを表示
tree -s                      # サイズを表示
tree -h                      # サイズを人間可読で表示
tree -u                      # ユーザー名を表示
tree -g                      # グループ名を表示
tree -D                      # 最終更新日時を表示
tree --du                    # ディレクトリのサイズ合計を表示
tree -C                      # カラー表示（デフォルトでONの場合が多い）
tree -n                      # カラーなし
tree --dirsfirst             # ディレクトリを先に表示

# ソート
tree --sort=name             # 名前順（デフォルト）
tree --sort=mtime            # 更新日時順
tree --sort=size             # サイズ順
tree -r                      # 逆順

# 出力形式
tree -J                      # JSON形式で出力
tree -X                      # XML形式で出力
tree -H .                    # HTML形式で出力（Webブラウザ用）
tree -H . -o tree.html       # HTMLファイルに出力

# ファイル数・ディレクトリ数の表示
tree                         # 最後の行に合計が表示される
# 3 directories, 12 files

# 実用的な使い方
tree -L 2 --dirsfirst -I "node_modules|.git"
tree -L 3 -P "*.py" --prune --dirsfirst
tree -d -L 2                 # ディレクトリ構造だけ2階層

# プロジェクト構造のドキュメント化
tree -L 3 --dirsfirst -I "node_modules|.git|dist|build|__pycache__" > project-structure.txt
```

### 4.2 Example Project Structure Display

```bash
# プロジェクト構造の表示（一般的なWebアプリ）
tree -L 3 --dirsfirst -I "node_modules|.git|dist|build|.next"

# 出力例:
# .
# ├── src/
# │   ├── components/
# │   │   ├── Header.tsx
# │   │   ├── Footer.tsx
# │   │   └── Sidebar.tsx
# │   ├── pages/
# │   │   ├── index.tsx
# │   │   ├── about.tsx
# │   │   └── api/
# │   ├── styles/
# │   │   ├── globals.css
# │   │   └── Home.module.css
# │   └── utils/
# │       ├── api.ts
# │       └── helpers.ts
# ├── public/
# │   ├── favicon.ico
# │   └── images/
# ├── tests/
# │   ├── unit/
# │   └── e2e/
# ├── package.json
# ├── tsconfig.json
# ├── README.md
# └── .env.example
```

---

## 5. Path Fundamentals and Advanced Usage

### 5.1 Absolute Paths and Relative Paths

```
============================================
Types and Notation of Paths
============================================

■ Absolute Path
  A complete path starting from the root (/)
  Examples:
    /home/user/documents/file.txt
    /var/log/syslog
    /etc/nginx/nginx.conf
    /usr/local/bin/python3

  Characteristics:
    - Always refers to the same file (independent of current location)
    - Use when you need to reliably specify a file in scripts
    - Tends to be long

■ Relative Path
  Position relative to the current directory
  Examples:
    ./documents/file.txt     # documents in the current directory
    ../other/file.txt        # other directory one level up
    ../../config/app.yml     # config directory two levels up
    documents/file.txt       # ./ can be omitted

  Characteristics:
    - Depends on the current directory
    - Can be written more concisely
    - Convenient for referencing files within a project

■ Special Paths
  ~         → Home directory (/home/user)
  ~/        → Under the home directory
  .         → Current directory
  ..        → Parent directory (one level up)
  -         → Previous directory (cd only)
  /         → Root directory

■ Paths via Environment Variables
  $HOME     → Home directory (equivalent to ~)
  $PWD      → Current directory (same as pwd output)
  $OLDPWD   → Previous directory (destination of cd -)
  $TMPDIR   → Temporary directory (macOS: /var/folders/...)
  $PATH     → Command search path (colon-separated)
```

### 5.2 Path Manipulation Commands

```bash
# ============================================
# パスの操作と変換
# ============================================

# パスの取得
pwd                          # 現在のディレクトリ（物理パス）
pwd -L                       # 論理パス（シンボリックリンクを解決しない）
pwd -P                       # 物理パス（シンボリックリンクを解決する）

# パスの分解
basename /path/to/file.txt   # file.txt（ファイル名のみ）
basename /path/to/file.txt .txt  # file（拡張子を除去）
dirname /path/to/file.txt    # /path/to（ディレクトリ部分のみ）

# パスの正規化
realpath /path/with/../symlinks  # 正規化された絶対パス
realpath --relative-to=. /absolute/path  # 相対パスに変換
readlink -f /path/to/symlink    # シンボリックリンクの解決

# パスの存在確認
test -e /path/to/file        # ファイル/ディレクトリが存在するか
test -f /path/to/file        # 通常のファイルか
test -d /path/to/dir         # ディレクトリか
test -L /path/to/link        # シンボリックリンクか

# パスの結合（bash/zsh）
dir="/var/log"
file="syslog"
full_path="${dir}/${file}"    # /var/log/syslog

# パスの一括変換
# 相対パスから絶対パスに変換
readlink -f ./relative/path

# 全ての .txt ファイルの絶対パスを取得
find . -name "*.txt" -exec realpath {} \;

# パスに含まれるシンボリックリンクを解決
realpath /usr/bin/python3    # /usr/local/Cellar/python@3/3.x/bin/python3

# パスの正規化スクリプト（クロスプラットフォーム）
abspath() {
    if [ -d "$1" ]; then
        (cd "$1" && pwd)
    elif [ -f "$1" ]; then
        local dir=$(dirname "$1")
        local base=$(basename "$1")
        (cd "$dir" && echo "$(pwd)/$base")
    else
        echo "Path not found: $1" >&2
        return 1
    fi
}
```

### 5.3 Linux Filesystem Structure

```
============================================
Overview of FHS (Filesystem Hierarchy Standard)
============================================

/                   Root directory (starting point for all files)
├── bin/            Basic commands (ls, cp, mv, etc.)
├── sbin/           System administration commands (mount, fsck, etc.)
├── boot/           Bootloader, kernel images
├── dev/            Device files (/dev/null, /dev/sda, etc.)
├── etc/            Configuration files (system-wide settings)
│   ├── nginx/      Nginx configuration
│   ├── ssh/        SSH configuration
│   ├── passwd      User account information
│   ├── shadow      Password hashes (root-only read access)
│   ├── hosts       Static hostname table
│   ├── fstab       Filesystem mount table
│   └── crontab     cron schedule
├── home/           Home directories for regular users
│   └── user/
│       ├── .bashrc
│       ├── .ssh/
│       └── ...
├── lib/            Shared libraries
├── media/          Mount points for removable media
├── mnt/            Temporary mount points
├── opt/            Third-party software
├── proc/           Process information (virtual filesystem)
│   ├── cpuinfo     CPU information
│   ├── meminfo     Memory information
│   ├── uptime      Uptime
│   └── [PID]/      Per-process information
├── root/           Home directory for the root user
├── run/            Runtime variable data
├── srv/            Service data
├── sys/            Kernel and device information (virtual filesystem)
├── tmp/            Temporary files (may be deleted on reboot)
├── usr/            User applications
│   ├── bin/        General commands
│   ├── sbin/       Administration commands
│   ├── lib/        Libraries
│   ├── local/      Locally installed software
│   │   ├── bin/
│   │   ├── lib/
│   │   └── share/
│   ├── share/      Shared data (man pages, documentation, etc.)
│   └── include/    Header files
└── var/            Variable data
    ├── log/        Log files
    │   ├── syslog
    │   ├── auth.log
    │   └── nginx/
    ├── cache/      Cache data
    ├── lib/        Persistent application data
    ├── mail/       Mailboxes
    ├── run/        Runtime data (PID files, etc.)
    ├── spool/      Spool data (print queues, etc.)
    └── tmp/        Temporary files that persist across reboots

macOS-specific:
  /Applications      GUI applications
  /System            macOS system files
  /Library           System-wide libraries
  ~/Library          User-specific libraries
  /Volumes           Mounted volumes
  /private/etc       Symlink target of /etc
  /private/var       Symlink target of /var
  /private/tmp       Symlink target of /tmp
```

```bash
# ============================================
# ファイルシステム構造の探索コマンド
# ============================================

# 重要なディレクトリを確認
ls /etc/                     # システム設定ファイル
ls /var/log/                 # ログファイル
ls /usr/local/bin/           # ローカルインストールされたコマンド
ls /tmp/                     # 一時ファイル

# システム情報の取得
cat /etc/os-release          # OS情報（Linux）
sw_vers                      # macOS バージョン
uname -a                     # カーネル情報
cat /proc/cpuinfo            # CPU情報（Linux）
cat /proc/meminfo            # メモリ情報（Linux）

# マウント情報
mount                        # マウント済みファイルシステム一覧
df -h                        # パーティションの使用状況
lsblk                        # ブロックデバイス一覧（Linux）
diskutil list                # ディスク一覧（macOS）

# ファイルシステムの種類を確認
df -T                        # ファイルシステムのタイプ表示（Linux）
mount | grep "^/"            # マウントされたデバイスのみ
```

---

## 6. Checking Disk Usage

### 6.1 du (Disk Usage)

```bash
# ============================================
# du コマンドの使い方
# ============================================

# 基本的な使い方
du                           # カレントディレクトリの使用量（サブディレクトリ含む）
du -h                        # 人間可読形式（KB, MB, GB）
du -s                        # 合計のみ表示（summary）
du -sh                       # 合計を人間可読で表示（最もよく使う）
du -sh *                     # 各ファイル/ディレクトリの使用量

# 深さの指定
du -h --max-depth=1          # 1階層のみ（Linux）
du -h -d 1                   # 1階層のみ（macOS/BSD）
du -h -d 2                   # 2階層まで

# ソートして表示
du -sh * | sort -rh          # サイズの大きい順（最もよく使う）
du -sh * | sort -rh | head -10  # トップ10

# 特定のファイルシステムのみ
du -shx                      # 同一ファイルシステムのみ（マウントポイントを跨がない）

# 除外パターン
du -sh --exclude="*.log" *   # .log ファイルを除外
du -sh --exclude=".git" *    # .git を除外
du -sh --exclude="node_modules" *  # node_modules を除外

# 隠しファイルを含む
du -sh .[^.]* *              # 隠しファイルも含めて表示

# 特定のディレクトリの使用量
du -sh ~/projects/           # プロジェクトディレクトリ全体
du -sh /var/log/             # ログディレクトリ全体
du -sh ~/.cache/             # キャッシュディレクトリ全体

# 大きなディレクトリを見つける
du -h -d 1 / 2>/dev/null | sort -rh | head -20  # システム全体のトップ20

# 特定サイズ以上のファイルを見つける
find . -type f -size +100M -exec ls -lh {} \;  # 100MB以上のファイル
find . -type f -size +1G -exec ls -lh {} \;    # 1GB以上のファイル
```

### 6.2 df (Disk Free)

```bash
# ============================================
# df コマンドの使い方
# ============================================

# 基本的な使い方
df                           # 全パーティションの使用状況
df -h                        # 人間可読形式（最もよく使う）
df -H                        # SI単位（1K=1000）
df -T                        # ファイルシステムのタイプも表示（Linux）

# 特定のパスの情報
df -h .                      # 現在のディレクトリが属するパーティション
df -h /home                  # /home パーティション
df -h /var                   # /var パーティション

# inode の使用状況
df -i                        # inode の使用状況
df -ih                       # inode の使用状況（人間可読）
# inode が枯渇すると、ディスク容量が余っていてもファイルが作成できなくなる

# 出力のカスタマイズ
df -h --output=source,fstype,size,used,avail,pcent,target  # 表示カラムを選択（Linux）

# 出力例:
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/sda1       50G   25G   23G  52% /
# /dev/sda2      200G  150G   40G  79% /home
# tmpfs           8.0G  1.2G  6.8G  15% /tmp
```

### 6.3 ncdu (Interactive Disk Usage Viewer)

```bash
# ============================================
# ncdu の使い方
# ============================================

# インストール
brew install ncdu            # macOS
sudo apt install ncdu        # Ubuntu/Debian

# 基本的な使い方
ncdu                         # カレントディレクトリを分析
ncdu /                       # システム全体を分析
ncdu /home                   # /home を分析
ncdu ~/projects              # プロジェクトディレクトリを分析

# オプション
ncdu -x                      # 同一ファイルシステムのみ
ncdu --exclude ".git"        # .git を除外
ncdu -e                      # エクスポートモード

# ncdu 内の操作
# ↑/↓ or k/j   → Move between items
# Enter or →    → Enter a directory
# ← or <       → Go back to the parent directory
# d             → Delete selected item (with confirmation)
# n             → Sort by name
# s             → Sort by size
# C             → Sort by item count
# M             → Sort by last modification time
# g             → Toggle graph display
# q             → Quit
# ?             → Help

# 結果をファイルに保存して後で閲覧
ncdu -o /tmp/ncdu-export.json ~/  # エクスポート
ncdu -f /tmp/ncdu-export.json     # インポートして閲覧
```

### 6.4 Handling Low Disk Space

```bash
# ============================================
# ディスク容量不足時の対処手順
# ============================================

# Step 1: Check current usage
df -h

# Step 2: Identify large directories
du -h -d 1 / 2>/dev/null | sort -rh | head -20

# Step 3: Check common disk consumers

# Log files
du -sh /var/log/
sudo find /var/log -name "*.gz" -delete          # 古い圧縮ログを削除
sudo journalctl --vacuum-size=500M                # systemd ログを500MBに制限

# Cache
du -sh ~/.cache/
rm -rf ~/.cache/pip                               # pip キャッシュ
rm -rf ~/.cache/yarn                              # yarn キャッシュ
rm -rf ~/.npm/_cacache                            # npm キャッシュ

# Docker
docker system df                                   # Docker のディスク使用量
docker system prune -af                            # 未使用の全リソースを削除
docker volume prune                                # 未使用ボリュームを削除

# Homebrew（macOS）
brew cleanup --prune=all                           # 古いバージョンを削除
du -sh $(brew --cache)                             # キャッシュサイズ確認
rm -rf $(brew --cache)                             # キャッシュを削除

# Temporary files
du -sh /tmp/
sudo rm -rf /tmp/large-temp-files/

# Search for large files
find / -type f -size +500M -exec ls -lh {} \; 2>/dev/null
find /home -type f -size +100M -exec ls -lh {} \; 2>/dev/null

# Remove node_modules (across all projects)
find ~/projects -name "node_modules" -type d -prune -exec du -sh {} \;
# After confirming, delete:
find ~/projects -name "node_modules" -type d -prune -exec rm -rf {} +

# Check .git directory sizes
find ~/projects -name ".git" -type d -exec du -sh {} \;
```

---

## 7. Practical Exercises

### Exercise 1: [Basic] — Directory Navigation Fundamentals

```bash
# Task: Perform the following operations

# 1. Move to the home directory
cd ~

# 2. Move to /tmp
cd /tmp

# 3. Return to the previous directory
cd -

# 4. Move to /var/log and check its contents
cd /var/log && ls -lt | head -10

# 5. Return to the home directory
cd

# 6. Create a directory and move into it
mkdir -p /tmp/exercise/subdir && cd /tmp/exercise/subdir

# 7. Check the current directory
pwd

# 8. Move two levels up
cd ../..
pwd
# Should be /tmp
```

### Exercise 2: [Intermediate] — Advanced ls Usage

```bash
# Task: Use the ls command to retrieve the following information

# 1. Detailed listing including hidden files in the home directory
ls -lah ~

# 2. Top 5 most recently updated files in /var/log
ls -lt /var/log/ | head -6

# 3. Count the number of files in /usr/bin
ls -1 /usr/bin/ | wc -l

# 4. Show only directories in the current directory with sizes
ls -ld */ 2>/dev/null

# 5. Show only symbolic links in /etc
ls -la /etc/ | grep "^l"

# 6. Top 10 largest files in the home directory
ls -lhS ~ | head -11
```

### Exercise 3: [Intermediate] — Using the Directory Stack

```bash
# Task: Use pushd/popd to efficiently move between multiple directories

# 1. Start from the home directory
cd ~

# 2. Push three directories onto the stack
pushd /var/log
pushd /etc
pushd /tmp

# 3. Check the contents of the stack
dirs -v

# 4. Move to /etc (a specific entry on the stack)
pushd +1

# 5. Verify the stack contents again
dirs -v

# 6. Return in order using popd
popd
popd
popd

# 7. Verify that you are back in the original directory
pwd
```

### Exercise 4: [Advanced] — Disk Usage Analysis

```bash
# Task: Analyze the disk usage of the system

# 1. Check usage of all partitions
df -h

# 2. Check the size of each directory directly under the home directory
du -sh ~/* 2>/dev/null | sort -rh | head -15

# 3. Also check sizes of hidden directories
du -sh ~/.[^.]* 2>/dev/null | sort -rh | head -10

# 4. Find files larger than 100MB
find ~ -type f -size +100M -exec ls -lh {} \; 2>/dev/null

# 5. Total size of node_modules directories
find ~/projects -name "node_modules" -type d -prune 2>/dev/null | \
    xargs du -sh 2>/dev/null | sort -rh

# 6. Total size of .git directories
find ~/projects -name ".git" -type d 2>/dev/null | \
    xargs du -sh 2>/dev/null | sort -rh | head -10
```

### Exercise 5: [Advanced] — Setting Up Efficient Navigation

```bash
# Task: Create an optimal navigation configuration for your environment

# Add the following to ~/.zshrc:

# 1. zoxide configuration
eval "$(zoxide init zsh)"

# 2. Directory navigation aliases
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'

# 3. Bookmarks for frequently used directories
hash -d p=~/projects
hash -d w=~/work
hash -d d=~/Documents
hash -d dl=~/Downloads

# 4. Directory navigation function with fzf
fcd() {
    local dir
    dir=$(fd --type d --hidden --follow --exclude .git . "${1:-.}" | \
        fzf --height 40% --reverse --preview 'ls -la {}')
    [ -n "$dir" ] && cd "$dir"
}

# 5. Fast navigation to Git repositories
repos() {
    local repo
    repo=$(fd -H -t d .git ~/projects ~/work 2>/dev/null | \
        sed 's|/\.git$||' | \
        fzf --height 40% --reverse --preview 'git -C {} log --oneline -5')
    [ -n "$repo" ] && cd "$repo"
}

# 6. AUTO_CD and completion settings
setopt AUTO_CD
setopt AUTO_PUSHD
setopt PUSHD_IGNORE_DUPS
setopt PUSHD_SILENT
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Check the path and format of the config file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the running user's permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify step by step**: Use log output or a debugger to validate hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# デバッグ用ユーティリティ
import logging
import traceback
from functools import wraps

# ロガーの設定
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """関数の入出力をログ出力するデコレータ"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """データ処理（デバッグ対象）"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance problems:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Examine disk and network I/O status
4. **Check concurrent connections**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Solution |
|-------------|-----------------|----------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When it can be compromised |
|----------|--------------------|---------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              アーキテクチャ選択フロー              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① チーム規模は？                                │
│    ├─ 小規模（1-5人）→ モノリス                   │
│    └─ 大規模（10人+）→ ②へ                       │
│                                                 │
│  ② デプロイ頻度は？                               │
│    ├─ 週1回以下 → モノリス + モジュール分割         │
│    └─ 毎日/複数回 → ③へ                          │
│                                                 │
│  ③ チーム間の独立性は？                            │
│    ├─ 高い → マイクロサービス                      │
│    └─ 中程度 → モジュラーモノリス                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach may become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables the right tool for the right job but increases operational costs

**3. Level of Abstraction**
- Higher abstraction improves reusability but can make debugging harder
- Lower abstraction is intuitive but tends to cause code duplication

```python
# 設計判断の記録テンプレート
class ArchitectureDecisionRecord:
    """ADR (Architecture Decision Record) の作成"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """背景と課題の記述"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """決定内容の記述"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """結果の追加"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """却下した代替案の追加"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Markdown形式で出力"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## 背景\n{self.context}\n\n"
        md += f"## 決定\n{self.decision}\n\n"
        md += "## 結果\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## 却下した代替案\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for critical paths
- Introduce monitoring early

**Lessons learned:**
- Don't strive for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Incrementally overhaul a system that has been running for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If there are no existing tests, create Characterization Tests first
- Coexist old and new systems via an API gateway
- Perform data migration in stages

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission the old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Use Domain-Driven Design to clarify boundaries
- Assign ownership per team
- Manage shared libraries via Inner Source
- Design API-first to minimize inter-team dependencies

```python
# チーム間のAPI契約定義
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """チーム間のAPI契約"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # レスポンスタイムSLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """SLA準拠の確認"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """OpenAPI形式で出力"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# 使用例
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** A system where millisecond-level response times are required

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|------------------------|--------|---------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Team Development Usage

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Is the naming convention consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Has the documentation been updated?

### Knowledge Sharing Best Practices

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Whole team | Horizontal knowledge sharing |
| ADR (design records) | As needed | Future members | Transparency of decisions |
| Retrospective | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Important designs | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          |
    +-----+-----+
    | Plan| Act |
    | ned | Now |
    +-----+-----+
    | Log | Next|
    | Only|Sprint|
    |     |     |
    +-----+-----+
          |
        Low Impact
    Low Frequency  High Frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------------|------------|----------------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor authentication, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, principle of least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logs, audit trail | Log analysis |

### Secure Coding Best Practices

```python
# セキュアコーディング例
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """セキュリティユーティリティ"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """暗号学的に安全なトークン生成"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """パスワードのハッシュ化"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """パスワードの検証"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """入力値のサニタイズ"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# 使用例
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not output to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is properly configured
- [ ] Vulnerability scanning of dependency packages has been performed
- [ ] Error messages do not contain internal information
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently applied in day-to-day development tasks. It becomes especially important during code reviews and architecture design.

---

## Summary

| Command | Use | Notes |
|---------|-----|-------|
| cd | Navigate directories | The most fundamental navigation method |
| pwd | Display current directory | -P for the physical path |
| ls -lah | Display detailed listing | The most commonly used combination |
| eza | Modern ls alternative | Git integration, icon display |
| tree | Tree display | -L to limit depth |
| pushd/popd | Directory stack | Moving between multiple directories |
| zoxide (z) | Smart navigation | Fast navigation based on visit history |
| du -sh | Disk usage | Check capacity per directory |
| df -h | Partition information | Check overall usage status |
| ncdu | Interactive analysis | Visualize disk usage |

### Keys to Efficient Navigation

1. **Install zoxide** -- Jump instantly to the optimal directory based on past visit history
2. **Combine with fzf** -- Search interactively even without remembering directory names
3. **Set up aliases and bookmarks** -- Create shortcuts for frequently visited directories
4. **Enable AUTO_CD** -- In zsh, navigate by directory name alone
5. **Use pushd/popd** -- Effective when frequently switching between multiple directories
6. **Use eza + tree for better file listings** -- Improve readability with Git integration and icon display
7. **Regularly check disk usage with ncdu** -- Discover unnecessary files and manage capacity

---

## What to Read Next

---

## References
1. Shotts, W. "The Linux Command Line." 2nd Ed, Ch.2-3, No Starch Press, 2019.
2. Ward, B. "How Linux Works." 3rd Ed, Ch.2, No Starch Press, 2021.
3. Filesystem Hierarchy Standard: https://refspecs.linuxfoundation.org/FHS_3.0/
4. zoxide official repository: https://github.com/ajeetdsouza/zoxide
5. eza official repository: https://github.com/eza-community/eza
6. fzf official repository: https://github.com/junegunn/fzf
