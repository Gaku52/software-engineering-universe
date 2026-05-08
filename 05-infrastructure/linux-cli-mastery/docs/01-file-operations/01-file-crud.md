# Creating, Copying, Moving, and Deleting Files

> File operations are the most frequently used CLI skills. Building safe operation habits and preventing accidents before they happen is of utmost importance.

## What You Will Learn in This Chapter

- [ ] Perform basic file and directory operations
- [ ] Master wildcards (globs)
- [ ] Develop safe file operation habits
- [ ] Understand advanced file synchronization with rsync
- [ ] Understand links (hard links and symbolic links)
- [ ] View and compare file contents
- [ ] Perform batch renaming and batch processing
- [ ] Know how to troubleshoot common issues


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Having completed [Directory Navigation and Listing](./00-navigation.md)

---

## 1. Creating Files

### 1.1 The touch Command

```bash
# ============================================
# touch — ファイル作成とタイムスタンプ更新
# ============================================

# 空ファイルの作成（最も基本的な使い方）
touch file.txt                  # 空ファイル作成
touch file1.txt file2.txt file3.txt  # 複数ファイルを一度に作成
touch {a,b,c}.txt               # ブレース展開で一括作成
touch file{1..10}.txt           # file1.txt 〜 file10.txt を一括作成
touch {2024..2026}-{01..12}-report.csv  # 年月パターンで作成

# 既存ファイルのタイムスタンプ更新
touch existing-file.txt         # 現在の日時に更新

# タイムスタンプの指定
touch -t 202602161030 file.txt  # 2026/02/16 10:30 に設定
touch -t 202601010000 file.txt  # 2026/01/01 00:00 に設定
touch -d "2026-02-16 10:30:00" file.txt  # 日付文字列で指定（GNU）
touch -d "yesterday" file.txt   # 昨日の日付に設定
touch -d "2 days ago" file.txt  # 2日前に設定

# 参照ファイルと同じタイムスタンプに設定
touch -r reference.txt target.txt  # reference.txt と同じ日時にする

# 特定のタイムスタンプのみ変更
touch -a file.txt               # atime（アクセス日時）のみ更新
touch -m file.txt               # mtime（更新日時）のみ更新

# ファイルが存在しない場合は作成しない
touch -c nonexistent.txt        # ファイルが無ければ何もしない

# 実務的な活用
# 1. ロックファイルの作成
touch /tmp/myapp.lock

# 2. 設定ファイルのテンプレート作成
touch .env .env.example .gitignore README.md

# 3. ビルドシステムのタイムスタンプ操作
touch -r src/main.c build/output  # ソースと同じ日時にする
```

### 1.2 Creating Text Files

```bash
# ============================================
# テキストファイルの作成方法
# ============================================

# echo コマンド
echo "Hello, World!" > file.txt         # 上書き作成（>）
echo "Additional line" >> file.txt      # 追記（>>）
echo -e "Line 1\nLine 2\nLine 3" > file.txt  # 改行を含む

# printf コマンド（echo より制御しやすい）
printf "Name: %s\nAge: %d\n" "Taro" 30 > profile.txt
printf "%s\n" "line1" "line2" "line3" > file.txt

# cat とヒアドキュメント
cat > config.txt << 'EOF'
# 設定ファイル
database_host=localhost
database_port=5432
database_name=myapp
EOF

# ヒアドキュメント（変数展開あり）
DB_HOST="localhost"
cat > config.txt << EOF
database_host=${DB_HOST}
database_port=5432
EOF

# ヒアドキュメント（変数展開なし — シングルクォートで囲む）
cat > script.sh << 'SCRIPT'
#!/bin/bash
echo "Hello, $USER!"
echo "Today is $(date)"
SCRIPT

# tee コマンド（標準出力とファイルの両方に書き込み）
echo "Hello" | tee file.txt              # 画面にも表示してファイルにも書き込み
echo "World" | tee -a file.txt           # 追記モード
echo "secret" | sudo tee /etc/config     # sudo でのファイル書き込み

# /dev/null への書き込み（出力を捨てる）
command > /dev/null 2>&1                  # 標準出力と標準エラーを破棄
```

### 1.3 Creating Directories

```bash
# ============================================
# mkdir — ディレクトリ作成
# ============================================

# 基本操作
mkdir dirname                   # ディレクトリ作成
mkdir dir1 dir2 dir3            # 複数ディレクトリを一度に作成

# ネストしたディレクトリを一気に作成（-p: parents）
mkdir -p path/to/nested/dir     # 中間ディレクトリも自動作成
mkdir -p project/{src,tests,docs,config}  # プロジェクト構造を一括作成
mkdir -p project/src/{components,pages,utils,styles}  # ネストした構造

# パーミッションを指定して作成
mkdir -m 700 secret_dir         # rwx------
mkdir -m 755 public_dir         # rwxr-xr-x

# 詳細表示
mkdir -v dirname                # 作成したことを表示
mkdir -pv path/to/nested        # 中間ディレクトリの作成も表示

# プロジェクト構造の一括作成
mkdir -p myproject/{src/{main,test}/{java,resources},docs,config,scripts,build}

# 日付ベースのディレクトリ作成
mkdir -p "backup/$(date +%Y/%m/%d)"  # backup/2026/02/16

# テンポラリディレクトリの作成
mktemp -d                       # /tmp/tmp.XXXXXXXXXX を作成
mktemp -d /tmp/myapp-XXXXXX     # パターン指定
TMPDIR=$(mktemp -d)             # 変数に格納して使う
# 使い終わったら削除
rm -rf "$TMPDIR"
```

---

## 2. Copying Files

### 2.1 The cp Command

```bash
# ============================================
# cp — ファイル・ディレクトリのコピー
# ============================================

# 基本操作
cp source.txt dest.txt          # ファイルコピー
cp source.txt /path/to/dir/     # ディレクトリにコピー（同名）
cp source.txt /path/to/dir/new_name.txt  # 新しい名前でコピー

# ディレクトリのコピー
cp -r source_dir/ dest_dir/     # 再帰的にコピー（-r: recursive）
cp -R source_dir/ dest_dir/     # -r と同じ（大文字R）

# 重要なオプション
cp -i source.txt dest.txt       # 上書き前に確認（interactive）
cp -n source.txt dest.txt       # 上書きしない（no-clobber）
cp -f source.txt dest.txt       # 強制上書き（force）
cp -v source.txt dest.txt       # 操作内容を表示（verbose）

# メタデータの保持
cp -p source.txt dest.txt       # パーミッション・タイムスタンプを保持
cp -a source/ dest/             # アーカイブモード（-dR --preserve=all と同等）
                                 # パーミッション、所有者、タイムスタンプ、
                                 # シンボリックリンク、拡張属性を全て保持

# バックアップ付きコピー（GNU拡張）
cp --backup=numbered file.txt dest/     # file.txt.~1~, file.txt.~2~ ...
cp --backup=simple file.txt dest/       # file.txt~ (チルダ付き)
cp -b file.txt dest/                    # デフォルトのバックアップ

# 更新されたファイルのみコピー
cp -u source.txt dest.txt       # dest が古い場合のみコピー

# スパースファイルの効率的なコピー
cp --sparse=auto large-file dest/  # スパース領域を保持

# 複数ファイルのコピー
cp file1.txt file2.txt file3.txt /dest/dir/
cp *.txt /dest/dir/             # ワイルドカードで一括コピー
cp -t /dest/dir/ file1 file2    # -t でターゲットを先に指定

# シンボリックリンクの扱い
cp -L symlink.txt dest/         # リンク先の実体をコピー（デフォルト）
cp -d symlink.txt dest/         # シンボリックリンクとしてコピー
cp -P symlink.txt dest/         # -d と同じ（POSIX）

# 進捗表示付きコピー（大きなファイル）
# cp 自体に進捗表示機能はないため、代替手段を使う
pv source.iso > dest.iso         # pv (pipe viewer) を使う
rsync -avh --progress source dest  # rsync の進捗表示

# 実践的な使い方
cp -av /etc/nginx/ /backup/nginx-$(date +%Y%m%d)/  # 日付付きバックアップ
cp -rp /home/user/project/ /backup/project/          # プロジェクトの完全バックアップ
```

### 2.2 cp Caveats

```bash
# ============================================
# cp の注意すべきポイント
# ============================================

# 注意1: ディレクトリコピーのトレイリングスラッシュ
# 結果が異なる場合がある
cp -r source dest              # source → dest/source にコピーされる場合がある
cp -r source/ dest/            # source の中身を dest にコピー

# 注意2: シンボリックリンクの扱い
# デフォルトではリンク先の実体がコピーされる
cp symlink.txt copy.txt        # リンク先のファイルがコピーされる
cp -d symlink.txt copy.txt     # シンボリックリンクとしてコピーされる

# 注意3: 特殊ファイルのコピー
# /dev, /proc 配下のファイルは通常の cp ではコピーできない

# 注意4: SELinux / ACL の扱い
cp --preserve=all source dest  # SELinux コンテキスト、ACL も保持

# 注意5: クロスファイルシステムのコピー
# 異なるファイルシステム間でのコピーではinode番号が変わる
# ハードリンクの関係は保持されない

# 安全なコピーの習慣
# 1. 常に -i をつける（エイリアスとして設定推奨）
alias cp='cp -i'

# 2. 大量コピー前にドライランを行う（rsync -n）
rsync -avhn source/ dest/      # -n でドライラン

# 3. 重要なファイルはバックアップ付きでコピー
cp --backup=numbered important.conf /etc/
```

---

## 3. Moving and Renaming Files

### 3.1 The mv Command

```bash
# ============================================
# mv — ファイルの移動・リネーム
# ============================================

# リネーム
mv old_name.txt new_name.txt    # ファイルのリネーム
mv old_dir/ new_dir/            # ディレクトリのリネーム

# 移動
mv file.txt /path/to/dir/      # ファイルを移動
mv file.txt /path/to/dir/new_name.txt  # 移動 + リネーム
mv dir1/ /path/to/dir2/        # ディレクトリを移動

# 重要なオプション
mv -i source dest               # 上書き前に確認（interactive）
mv -n source dest               # 上書きしない（no-clobber）
mv -f source dest               # 強制移動（force）
mv -v source dest               # 操作内容を表示（verbose）

# バックアップ付き移動（GNU拡張）
mv --backup=numbered file.txt dest/
mv -b file.txt dest/            # デフォルトのバックアップ

# 更新されたファイルのみ移動
mv -u source.txt dest.txt       # dest が古い場合のみ移動

# 複数ファイルの移動
mv file1.txt file2.txt file3.txt /dest/dir/
mv *.log /var/log/archive/      # ログファイルを一括移動
mv -t /dest/dir/ file1 file2    # -t でターゲットを先に指定

# mv の特性
# - 同一ファイルシステム内では瞬時（inode のリネームのみ）
# - 異なるファイルシステム間ではコピー+削除（時間がかかる）

# 安全な mv の習慣
alias mv='mv -i'               # 上書き確認をデフォルトに
```

### 3.2 Batch Renaming

```bash
# ============================================
# 一括リネームのテクニック
# ============================================

# rename コマンド（Perl版）
# Ubuntu/Debian: apt install rename
# macOS: brew install rename

# 基本的な使い方（Perl正規表現）
rename 's/\.txt$/\.md/' *.txt                 # .txt → .md
rename 's/old/new/' *.txt                     # ファイル名の old → new
rename 'y/A-Z/a-z/' *.JPG                    # 大文字 → 小文字
rename 's/^/prefix_/' *.txt                   # プレフィックス追加
rename 's/$/.bak/' *.conf                     # サフィックス追加
rename 's/\s/_/g' *                           # スペース → アンダースコア
rename 's/[^a-zA-Z0-9._-]/_/g' *             # 特殊文字を置換

# ドライラン（実行前の確認）
rename -n 's/\.txt$/\.md/' *.txt              # -n で実行せずに結果を表示

# mmv コマンド（マスムーブ）
# brew install mmv
mmv "*.txt" "#1.md"                           # .txt → .md
mmv "*.JPG" "#1.jpg"                          # .JPG → .jpg
mmv "chapter*" "ch*"                          # chapter → ch

# bash のループによるリネーム
for f in *.txt; do
    mv "$f" "${f%.txt}.md"                    # .txt → .md
done

for f in *.JPG; do
    mv "$f" "${f,,}"                          # 大文字 → 小文字（bash 4+）
done

# 連番リネーム
i=1
for f in *.jpg; do
    mv "$f" "photo_$(printf '%03d' $i).jpg"   # photo_001.jpg, photo_002.jpg, ...
    ((i++))
done

# zsh のzmv（zsh限定、強力なリネームツール）
autoload -Uz zmv

zmv '(*).txt' '$1.md'                         # .txt → .md
zmv '(*).JPG' '${1:l}.jpg'                   # 大文字 → 小文字 + .JPG → .jpg
zmv '(*)_(*)' '$2_$1'                         # パーツの入れ替え
zmv -n '(*).txt' '$1.md'                      # ドライラン

# 日付をファイル名に追加
for f in *.log; do
    date=$(stat -f "%Sm" -t "%Y%m%d" "$f" 2>/dev/null || stat -c "%y" "$f" 2>/dev/null | cut -d' ' -f1 | tr -d '-')
    mv "$f" "${date}_${f}"
done
```

---

## 4. Deleting Files

### 4.1 The rm Command

```bash
# ============================================
# rm — ファイル・ディレクトリの削除
# ============================================

# 基本操作
rm file.txt                     # ファイル削除
rm file1.txt file2.txt file3.txt  # 複数ファイル削除

# ディレクトリの削除
rm -r directory/                # ディレクトリを再帰的に削除
rm -rf directory/               # 確認なしで強制削除
rmdir empty_dir                 # 空ディレクトリのみ削除（安全）

# 重要なオプション
rm -i file.txt                  # 削除前に確認（interactive）
rm -I *.txt                     # 3個以上 or 再帰削除時に1回確認（GNU）
rm -v file.txt                  # 削除内容を表示（verbose）
rm -d empty_dir                 # 空ディレクトリの削除（rmdir相当）

# ワイルドカードでの削除
rm *.tmp                        # .tmp ファイルを全削除
rm *.log                        # .log ファイルを全削除
rm -r __pycache__/              # Python キャッシュ削除

# 特殊なファイル名の削除
rm -- -filename.txt             # ハイフンで始まるファイル（-- でオプション終了）
rm ./-filename.txt              # パス指定でも可能
rm $'\x00file'                  # NULL文字を含むファイル名

# ============================================
# 危険なコマンド（絶対に注意！）
# ============================================
# rm -rf /                ← システム全体を削除（最悪のコマンド）
# rm -rf /*               ← 同上
# rm -rf ~                ← ホームディレクトリ全削除
# rm -rf *                ← カレントディレクトリの全ファイル削除
# rm -rf .                ← 一部のシステムで動作する（危険）
# rm -rf "$UNDEFINED"/*   ← 変数が未定義だと rm -rf /* になる！

# ============================================
# 安全対策
# ============================================

# 1. エイリアスで確認付きにする
alias rm='rm -i'

# 2. rm の代わりに trash を使う
# brew install trash-cli    # macOS
# sudo apt install trash-cli  # Ubuntu
trash file.txt                  # ゴミ箱に移動（復元可能）
trash-list                      # ゴミ箱の内容一覧
trash-restore                   # ゴミ箱から復元
trash-empty                     # ゴミ箱を空にする

# 3. 削除前に確認する習慣
ls *.tmp                        # まず対象を確認
rm *.tmp                        # 確認後に削除

# 4. 変数を使う前にチェック
if [ -n "$DIR" ]; then
    rm -rf "$DIR"
fi

# 5. --preserve-root（GNU rm のデフォルト）
rm -rf --preserve-root /        # / の削除を拒否（デフォルトで有効）
rm -rf --no-preserve-root /     # 保護を無効化（絶対に使わない）

# 6. safe-rm をインストール
# 重要なディレクトリの削除を防ぐラッパー
# apt install safe-rm
```

### 4.2 Conditional Deletion with find

```bash
# ============================================
# find + rm で条件に基づく削除
# ============================================

# 古いファイルの削除
find /var/log -name "*.log" -mtime +30 -delete           # 30日以上前のログ
find /tmp -mtime +7 -delete                               # 7日以上前のtmpファイル
find . -name "*.bak" -mtime +90 -delete                   # 90日以上前のバックアップ

# サイズベースの削除
find . -type f -size +100M -delete                        # 100MB以上のファイル
find . -type f -size 0 -delete                            # 空ファイル

# 特定パターンの削除
find . -name "*.pyc" -delete                              # Python コンパイル済みファイル
find . -name "__pycache__" -type d -exec rm -rf {} +      # Python キャッシュ
find . -name ".DS_Store" -delete                          # macOS のメタデータ
find . -name "Thumbs.db" -delete                          # Windows のサムネイル
find . -name "*.swp" -delete                              # Vim のスワップファイル
find . -name "*~" -delete                                 # バックアップファイル
find . -name "node_modules" -type d -prune -exec rm -rf {} +  # node_modules

# 安全な削除（-exec で確認）
find . -name "*.tmp" -exec rm -i {} \;                    # 1つずつ確認
find . -name "*.tmp" -ok rm {} \;                         # -ok は常に確認

# ドライラン（削除対象の確認のみ）
find . -name "*.tmp" -print                               # 対象ファイルを表示
find . -name "*.tmp" -ls                                  # 詳細情報付きで表示
find /tmp -mtime +7 -ls                                   # 古いファイルの確認

# 確認後に削除するワークフロー
find . -name "*.tmp" -print > /tmp/delete_list.txt        # リストを作成
cat /tmp/delete_list.txt                                   # 内容を確認
xargs rm -v < /tmp/delete_list.txt                        # 確認後に削除
```

---

## 5. Wildcards (Globs)

### 5.1 Basic Wildcards

```bash
# ============================================
# ワイルドカードパターンの完全ガイド
# ============================================

# 基本パターン
*              # 任意の文字列（0文字以上）
?              # 任意の1文字
[abc]          # a, b, c のいずれか1文字
[a-z]          # a〜z の範囲の1文字
[A-Z]          # A〜Z の範囲の1文字
[0-9]          # 0〜9 の範囲の1文字
[!abc]         # a, b, c 以外の1文字（否定）
[^abc]         # 同上（一部のシェルで）
{foo,bar}      # foo または bar（ブレース展開 — グロブではなくシェルの機能）

# 使用例
ls *.md                         # 全 .md ファイル
ls *.{js,ts}                    # .js と .ts ファイル
ls image?.png                   # image1.png, image2.png 等
ls file[1-3].txt                # file1.txt, file2.txt, file3.txt
ls file[!0-9].txt               # file の後に数字以外が来るファイル
ls [A-Z]*.txt                   # 大文字で始まる .txt ファイル
ls data_202[0-6]*.csv           # data_2020 〜 data_2026 のCSV

# ブレース展開の活用
cp {main,test}.py /tmp/         # main.py と test.py をコピー
mkdir -p project/{src,tests,docs}  # 3ディレクトリ一括作成
mv file.{txt,bak}              # file.txt → file.bak にリネーム
echo {1..10}                    # 1 2 3 4 5 6 7 8 9 10
echo {01..10}                   # 01 02 03 04 05 06 07 08 09 10
echo {a..z}                     # a b c ... z
echo file{A,B,C}_{1..3}.txt    # fileA_1.txt fileA_2.txt ... fileC_3.txt

# ブレース展開とグロブの組み合わせ
ls src/**/*.{js,ts,jsx,tsx}     # src 以下の全JS/TSファイル
cp config/*.{yml,yaml,json} /backup/  # 設定ファイルをバックアップ
```

### 5.2 Advanced Glob Patterns

```bash
# ============================================
# 拡張グロブ（Extended Globbing）
# ============================================

# bash の拡張グロブを有効にする
shopt -s extglob

# パターン
*(pattern)     # 0回以上の繰り返し
+(pattern)     # 1回以上の繰り返し
?(pattern)     # 0回または1回
@(pattern)     # ちょうど1回
!(pattern)     # パターン以外

# 使用例
ls !(*.txt)                     # .txt 以外のファイル
ls !(*.bak|*.tmp)               # .bak と .tmp 以外
rm !(important.txt)             # important.txt 以外を削除
cp !(node_modules)/* /backup/   # node_modules 以外をコピー
ls @(*.jpg|*.png|*.gif)         # 画像ファイルのみ

# ============================================
# zsh のグロブ修飾子（Glob Qualifiers）
# ============================================

# zsh は標準で強力なグロブ機能を持つ
ls *.txt(.)                     # 通常のファイルのみ
ls *(/)                         # ディレクトリのみ
ls *(@)                         # シンボリックリンクのみ
ls *(*)                         # 実行可能ファイルのみ
ls *(m-7)                       # 7日以内に更新されたファイル
ls *(m+30)                      # 30日以上前に更新されたファイル
ls *(Lk+100)                    # 100KB以上のファイル
ls *(Lm+10)                     # 10MB以上のファイル
ls *(om)                        # 更新日時順（新しい順）
ls *(Om)                        # 更新日時順（古い順）
ls *(oL)                        # サイズ順（小さい順）
ls *(OL)                        # サイズ順（大きい順）
ls *(.om[1,5])                  # 最近更新されたファイルのトップ5
ls *(u:root:)                   # root が所有者のファイル

# 再帰グロブ（**）
ls **/*.md                      # サブディレクトリ含む全 .md ファイル
ls **/*.{js,ts}                 # サブディレクトリ含む全 JS/TS ファイル

# bash の再帰グロブを有効にする
shopt -s globstar               # bash 4+ で ** を有効化
ls **/*.md                      # zsh と同様に動作

# NULL グロブ（マッチしない場合にエラーにしない）
setopt NULL_GLOB                # zsh: マッチなしの場合は空に展開
shopt -s nullglob               # bash: マッチなしの場合は空に展開

# ドットファイルもグロブに含める
setopt GLOB_DOTS                # zsh: .* もマッチ
shopt -s dotglob                # bash: .* もマッチ
```

---

## 6. Advanced File Synchronization with rsync

### 6.1 rsync Basics

```bash
# ============================================
# rsync — 高機能なファイル同期ツール
# ============================================

# インストール（通常プリインストール済み）
brew install rsync              # macOS（最新版）
sudo apt install rsync          # Ubuntu/Debian

# 基本的な使い方
rsync -avh source/ dest/        # ローカル同期
# -a: アーカイブモード（-rlptgoD と同等）
#     -r: 再帰的
#     -l: シンボリックリンクを保持
#     -p: パーミッションを保持
#     -t: タイムスタンプを保持
#     -g: グループを保持
#     -o: オーナーを保持
#     -D: デバイスファイルとスペシャルファイルを保持
# -v: 詳細表示
# -h: 人間可読なサイズ表示

# トレイリングスラッシュの重要性
rsync -avh source/ dest/        # source の中身を dest にコピー
rsync -avh source dest/         # source ディレクトリ自体を dest にコピー
# → rsync -avh source dest/ は dest/source/ を作成する

# ドライラン（実行前の確認）
rsync -avhn source/ dest/       # -n でドライラン（実行しない）
rsync -avh --dry-run source/ dest/  # 同上

# 進捗表示
rsync -avh --progress source/ dest/           # ファイルごとの進捗
rsync -avh --info=progress2 source/ dest/     # 全体の進捗（%表示）

# 削除オプション（ソースに無いファイルをdestから削除）
rsync -avh --delete source/ dest/             # destの余分なファイルを削除
rsync -avh --delete-before source/ dest/      # 転送前に削除
rsync -avh --delete-after source/ dest/       # 転送後に削除
rsync -avh --delete-excluded source/ dest/    # 除外されたファイルも削除
```

### 6.2 rsync Exclude Patterns

```bash
# ============================================
# rsync の除外/包含パターン
# ============================================

# 除外パターン
rsync -avh --exclude='*.log' source/ dest/
rsync -avh --exclude='node_modules' source/ dest/
rsync -avh --exclude='.git' --exclude='*.tmp' source/ dest/
rsync -avh --exclude='*.{log,tmp,bak}' source/ dest/

# 除外ファイルからの読み込み
rsync -avh --exclude-from='exclude-list.txt' source/ dest/

# exclude-list.txt の内容例:
# node_modules
# .git
# *.log
# *.tmp
# __pycache__
# .DS_Store
# dist/
# build/

# 包含パターン（除外の中から特定のものだけ含める）
rsync -avh --include='*.py' --exclude='*' source/ dest/  # .py ファイルのみ
rsync -avh --include='*/' --include='*.py' --exclude='*' source/ dest/  # ディレクトリ構造を保持

# フィルタールール
rsync -avh --filter='- *.log' --filter='- node_modules/' source/ dest/
rsync -avh -f '- *.log' -f '- .git/' source/ dest/
```

### 6.3 rsync Remote Synchronization

```bash
# ============================================
# rsync のリモート同期（SSH経由）
# ============================================

# ローカル → リモート
rsync -avh source/ user@host:/path/to/dest/
rsync -avh -e "ssh -p 2222" source/ user@host:/path/to/dest/  # ポート指定

# リモート → ローカル
rsync -avh user@host:/path/to/source/ dest/

# 帯域制限
rsync -avh --bwlimit=1000 source/ user@host:dest/  # 1000 KB/s に制限

# 圧縮転送
rsync -avhz source/ user@host:dest/                 # -z で圧縮

# 部分転送の再開（大きなファイルの転送時）
rsync -avh --partial source/ dest/                   # 中断したファイルを保持
rsync -avhP source/ dest/                            # -P = --partial --progress

# SSH鍵を指定
rsync -avh -e "ssh -i ~/.ssh/specific_key" source/ user@host:dest/

# ============================================
# 実践的な rsync 使用例
# ============================================

# プロジェクトのバックアップ
rsync -avh --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='*.log' \
    ~/projects/ /backup/projects/

# ウェブサーバーへのデプロイ
rsync -avhz --delete \
    --exclude='.env' \
    --exclude='.git' \
    dist/ user@server:/var/www/html/

# 設定ファイルの同期
rsync -avh \
    ~/.zshrc ~/.gitconfig ~/.vimrc \
    user@newmachine:~/

# 増分バックアップ（ハードリンクベース）
rsync -avh --delete \
    --link-dest=/backup/latest \
    source/ /backup/$(date +%Y%m%d)/
ln -sfn /backup/$(date +%Y%m%d) /backup/latest
```

---

## 7. Links (Hard Links and Symbolic Links)

### 7.1 Link Basics

```bash
# ============================================
# ハードリンクとシンボリックリンク
# ============================================

# ハードリンク（同じinode を指す別の名前）
ln original.txt hardlink.txt
# - 同じinode番号を持つ
# - 元ファイルを削除してもリンクからアクセス可能
# - 同じファイルシステム内のみ
# - ディレクトリには作成不可

# シンボリックリンク（ショートカット）
ln -s /path/to/original symlink
ln -s /path/to/dir dir_link
# - 別のinode番号を持つ
# - 元ファイルを削除するとリンク切れ（dangling link）
# - 異なるファイルシステムでもOK
# - ディレクトリにも作成可能

# リンクの確認
ls -la symlink                  # l で始まる = シンボリックリンク
ls -li file hardlink            # 同じinode番号 = ハードリンク
readlink symlink                # リンク先を表示
readlink -f symlink             # リンク先の絶対パス
stat file                       # inode情報の詳細

# リンクの更新
ln -sf /new/target symlink      # -f で既存リンクを上書き
ln -sfn /new/target dir_link    # -n でディレクトリリンクを上書き

# リンクの削除
rm symlink                      # シンボリックリンクの削除
unlink symlink                  # 同上（より明示的）
# 注意: rm symlink/  のように末尾にスラッシュを付けると
#        リンク先のディレクトリの中身が削除される可能性がある

# 壊れたシンボリックリンクの検出
find . -type l ! -exec test -e {} \; -print  # 壊れたリンクを検出
find . -xtype l                              # 壊れたリンクを検出（GNU find）

# 実践的な使用例
# 1. バージョン切り替え
ln -sf /opt/python-3.11/bin/python3 /usr/local/bin/python3
ln -sf /opt/node-20/bin/node /usr/local/bin/node

# 2. 設定ファイルの管理（dotfiles）
ln -sf ~/.dotfiles/zsh/.zshrc ~/.zshrc
ln -sf ~/.dotfiles/git/.gitconfig ~/.gitconfig

# 3. ログローテーション
ln -sf /var/log/app/app-$(date +%Y%m%d).log /var/log/app/current.log

# 4. ライブラリのバージョン管理
ln -sf libfoo.so.1.2.3 libfoo.so.1
ln -sf libfoo.so.1 libfoo.so
```

---

## 8. Viewing File Contents

### 8.1 File Viewing Commands

```bash
# ============================================
# ファイル内容の確認方法
# ============================================

# cat — ファイル全体を表示
cat file.txt                    # ファイル内容を表示
cat -n file.txt                 # 行番号付き
cat -b file.txt                 # 空行以外に行番号
cat -s file.txt                 # 連続する空行を1行に
cat -A file.txt                 # 制御文字と行末を表示
cat file1.txt file2.txt         # 複数ファイルを連結表示

# less — ページャ（最もよく使う）
less file.txt                   # ページャで表示
less -N file.txt                # 行番号付き
less +G file.txt                # ファイル末尾から表示
less +/pattern file.txt         # パターンを検索して表示
# less 内の操作: j/k(上下), /検索, n(次), q(終了)

# head — ファイルの先頭を表示
head file.txt                   # 最初の10行（デフォルト）
head -n 20 file.txt             # 最初の20行
head -n -5 file.txt             # 最後の5行を除いた全行
head -c 100 file.txt            # 最初の100バイト
head -1 *.csv                   # 各CSVファイルの1行目（ヘッダー確認）

# tail — ファイルの末尾を表示
tail file.txt                   # 最後の10行（デフォルト）
tail -n 20 file.txt             # 最後の20行
tail -n +5 file.txt             # 5行目から最後まで
tail -f file.txt                # リアルタイム監視（ログ監視に最適）
tail -F file.txt                # ファイルのローテーションに追従
tail -f /var/log/syslog         # ログのリアルタイム監視

# wc — ファイルの統計
wc file.txt                     # 行数 単語数 バイト数
wc -l file.txt                  # 行数のみ
wc -w file.txt                  # 単語数のみ
wc -c file.txt                  # バイト数のみ
wc -m file.txt                  # 文字数のみ
wc -l *.py                      # 各ファイルの行数

# file — ファイルの種類を判定
file document.pdf               # PDF document
file image.jpg                  # JPEG image data
file script.sh                  # Bourne-Again shell script
file binary                     # ELF 64-bit LSB executable
file -i file.txt                # MIME タイプを表示

# stat — ファイルの詳細情報
stat file.txt                   # inode、サイズ、タイムスタンプ等の詳細

# bat — cat の改良版（シンタックスハイライト付き）
# brew install bat
bat file.py                     # シンタックスハイライト付き表示
bat -n file.py                  # 行番号のみ（ヘッダーなし）
bat --plain file.py             # プレーン表示
bat -l python file              # 言語指定
bat --diff file.py              # Git差分のハイライト
```

### 8.2 Comparing Files

```bash
# ============================================
# ファイルの比較
# ============================================

# diff — ファイルの差分表示
diff file1.txt file2.txt        # 差分を表示
diff -u file1.txt file2.txt     # unified 形式（最もよく使う）
diff -y file1.txt file2.txt     # 左右並列表示
diff -w file1.txt file2.txt     # 空白の違いを無視
diff -i file1.txt file2.txt     # 大文字小文字を無視
diff -r dir1/ dir2/             # ディレクトリの再帰的比較
diff -rq dir1/ dir2/            # 差異のあるファイル名のみ表示
diff --color file1.txt file2.txt  # カラー表示

# colordiff（diff のカラー版）
# brew install colordiff
colordiff file1.txt file2.txt

# delta（Git diff の改良版）
diff -u file1.txt file2.txt | delta

# comm — ソート済みファイルの比較
sort file1.txt > sorted1.txt
sort file2.txt > sorted2.txt
comm sorted1.txt sorted2.txt
# 出力: 3カラム（file1のみ, file2のみ, 共通）
comm -12 sorted1.txt sorted2.txt  # 共通行のみ
comm -23 sorted1.txt sorted2.txt  # file1にのみ存在する行
comm -13 sorted1.txt sorted2.txt  # file2にのみ存在する行

# cmp — バイナリファイルの比較
cmp file1 file2                 # 最初に異なるバイト位置を表示
cmp -l file1 file2             # 全ての異なるバイトを表示

# md5sum/sha256sum — ファイルのハッシュ比較
md5sum file1.txt file2.txt      # MD5ハッシュ
sha256sum file1.txt file2.txt   # SHA-256ハッシュ
md5 file1.txt file2.txt         # macOS

# vimdiff — Vimでの並列比較
vimdiff file1.txt file2.txt     # Vimのdiffモード
```

---

## 9. Practice Exercises

### Exercise 1: [Beginner] — File Operation Basics

```bash
# Task: Perform the following operations

# 1. Create a working directory
mkdir -p /tmp/file-exercise && cd /tmp/file-exercise

# 2. Create test files
touch file{1..5}.txt
echo "Hello World" > hello.txt
cat > config.ini << 'EOF'
[database]
host=localhost
port=5432
EOF

# 3. Verify files
ls -la
cat config.ini
wc -l *.txt

# 4. Copy and move
cp hello.txt hello_backup.txt
mv file5.txt renamed.txt
mkdir -p backup && cp *.txt backup/

# 5. Delete
rm file3.txt
rm -r backup/

# 6. Clean up
cd ~ && rm -rf /tmp/file-exercise
```

### Exercise 2: [Intermediate] — Wildcards and Batch Operations

```bash
# Task: Use wildcards to efficiently manipulate files

# 1. Create test environment
mkdir -p /tmp/glob-exercise && cd /tmp/glob-exercise
touch report_{2024,2025,2026}_{Q1,Q2,Q3,Q4}.csv
touch image_{001..020}.jpg
touch document_{draft,final,review}.docx
mkdir -p archive

# 2. Operate using glob patterns
ls report_2025_*.csv             # 2025年のレポートのみ
ls image_{001..010}.jpg          # 最初の10枚
cp report_2024_*.csv archive/    # 2024年をアーカイブ
mv *.docx archive/               # 全ドキュメントをアーカイブ

# 3. Use brace expansion
mkdir -p project/{src/{main,test},docs,config}
touch project/src/main/{app,utils,config}.py
touch project/src/test/test_{app,utils,config}.py

# 4. Verify structure with tree
tree project/

# Clean up
cd ~ && rm -rf /tmp/glob-exercise
```

### Exercise 3: [Intermediate] — Backup with rsync

```bash
# Task: Create a backup script using rsync

#!/bin/bash
# backup.sh — rsync バックアップスクリプト

set -euo pipefail

SOURCE="$HOME/projects/"
DEST="/backup/projects/"
EXCLUDE_FILE="/tmp/rsync-exclude.txt"

# 除外ファイルの作成
cat > "$EXCLUDE_FILE" << 'EOF'
node_modules
.git
dist
build
*.log
*.tmp
__pycache__
.DS_Store
EOF

# ドライラン
echo "=== Dry Run ==="
rsync -avhn --delete --exclude-from="$EXCLUDE_FILE" "$SOURCE" "$DEST"

# 確認
read -p "Proceed with backup? [y/N] " answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
    echo "=== Executing Backup ==="
    rsync -avh --delete --exclude-from="$EXCLUDE_FILE" --info=progress2 "$SOURCE" "$DEST"
    echo "Backup complete!"
else
    echo "Backup cancelled."
fi

rm -f "$EXCLUDE_FILE"
```

### Exercise 4: [Advanced] — Batch Rename Script

```bash
# Task: Create a flexible batch rename script

#!/bin/bash
# batch-rename.sh — 一括リネームスクリプト

set -euo pipefail

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] PATTERN REPLACEMENT [DIRECTORY]

Batch rename files.

Options:
  -n, --dry-run    Dry run (do not execute rename)
  -r, --recursive  Rename recursively
  -i, --ignore-case Ignore case
  -v, --verbose    Verbose output
  -h, --help       Show help

Examples:
  $(basename "$0") .txt .md                     # .txt → .md
  $(basename "$0") -n "old" "new"               # Dry run
  $(basename "$0") -r "draft_" "" ~/documents   # Remove prefix
EOF
}

DRY_RUN=false
RECURSIVE=false
VERBOSE=false
IGNORE_CASE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--dry-run)    DRY_RUN=true; shift ;;
        -r|--recursive)  RECURSIVE=true; shift ;;
        -i|--ignore-case) IGNORE_CASE="I"; shift ;;
        -v|--verbose)    VERBOSE=true; shift ;;
        -h|--help)       usage; exit 0 ;;
        -*)              echo "Unknown option: $1" >&2; exit 1 ;;
        *)               break ;;
    esac
done

if [[ $# -lt 2 ]]; then
    usage >&2
    exit 1
fi

PATTERN="$1"
REPLACEMENT="$2"
DIRECTORY="${3:-.}"

count=0
find_opts=(-name "*${PATTERN}*")
if [[ "$RECURSIVE" == false ]]; then
    find_opts+=(-maxdepth 1)
fi

while IFS= read -r -d '' file; do
    dir=$(dirname "$file")
    base=$(basename "$file")
    newname="${base//${PATTERN}/${REPLACEMENT}}"

    if [[ "$base" != "$newname" ]]; then
        ((count++))
        if [[ "$DRY_RUN" == true ]]; then
            echo "[DRY RUN] $file → $dir/$newname"
        else
            mv -v "$file" "$dir/$newname"
        fi
    fi
done < <(find "$DIRECTORY" "${find_opts[@]}" -print0)

echo "Total: $count file(s) processed"
```

### Exercise 5: [Advanced] — Project Cleaner

```bash
# Task: Create a script to safely clean up unnecessary files from a development project

#!/bin/bash
# project-cleaner.sh — プロジェクトクリーナー

set -euo pipefail

TARGET="${1:-.}"
DRY_RUN=false
[[ "${2:-}" == "-n" ]] && DRY_RUN=true

echo "=== Project Cleaner ==="
echo "Target: $(realpath "$TARGET")"
[[ "$DRY_RUN" == true ]] && echo "Mode: DRY RUN"

# クリーンアップ対象の定義
declare -A TARGETS=(
    ["node_modules"]="find '$TARGET' -name 'node_modules' -type d -prune"
    ["__pycache__"]="find '$TARGET' -name '__pycache__' -type d"
    [".pyc files"]="find '$TARGET' -name '*.pyc' -type f"
    [".DS_Store"]="find '$TARGET' -name '.DS_Store' -type f"
    ["Thumbs.db"]="find '$TARGET' -name 'Thumbs.db' -type f"
    [".swp files"]="find '$TARGET' -name '*.swp' -type f"
    ["~ files"]="find '$TARGET' -name '*~' -type f"
)

total_saved=0

for name in "${!TARGETS[@]}"; do
    cmd="${TARGETS[$name]}"
    files=$(eval "$cmd" 2>/dev/null || true)

    if [[ -n "$files" ]]; then
        size=$(echo "$files" | xargs du -sh 2>/dev/null | tail -1 | awk '{print $1}')
        count=$(echo "$files" | wc -l | tr -d ' ')
        echo ""
        echo "--- $name ---"
        echo "  Found: $count item(s), Size: $size"

        if [[ "$DRY_RUN" == false ]]; then
            echo "$files" | xargs rm -rf
            echo "  Cleaned!"
        else
            echo "$files" | head -5
            [[ $count -gt 5 ]] && echo "  ... and $((count - 5)) more"
        fi
    fi
done

echo ""
echo "=== Cleanup Complete ==="
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured settings file | Check the settings file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the executing user's permissions, review configuration |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanisms, use transaction management |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify incrementally**: Use log output or a debugger to test each hypothesis
5. **Fix and run regression tests**: After fixing, also run tests for related areas

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

Steps for diagnosing performance problems when they occur:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Verify the presence or absence of memory leaks
3. **Check for I/O waits**: Examine the state of disk and network I/O
4. **Check concurrent connections**: Inspect the connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-------------|----------------|---------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When it can be deprioritized |
|----------|-------------------|------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

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

### Analyzing Trade-offs

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A quick short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has a lower learning curve
- Adopting diverse technologies enables the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging more difficult
- Low abstraction is more intuitive but prone to code duplication

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
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons Learned:**
- Don't seek perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally replacing a system that has been running for over 10 years

**Approach:**
- Migrate gradually using the Strangler Fig pattern
- If there are no existing tests, write Characterization Tests first
- Use an API gateway to coexist old and new systems
- Execute data migration in phases

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Analysis | Current state analysis, mapping dependencies | 2–4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4–6 weeks | Low |
| 3. Migration Start | Migrate peripheral features incrementally | 3–6 months | Medium |
| 4. Core Migration | Migrate core functionality | 6–12 months | High |
| 5. Completion | Decommission the old system | 2–4 weeks | Medium |

### Scenario 3: Development in a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries using Domain-Driven Design
- Assign ownership per team
- Manage shared libraries using an Inner Source model
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

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | Use Case |
|--------------------|--------|--------------------|---------  |
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low–Medium | High | CPU-bound cases |

---

## Applying These Skills in Team Development

### Code Review Checklist

Points to verify during code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security concerns?
- [ ] Has documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Audience | Effect |
|--------|-----------|----------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Whole team | Horizontal knowledge sharing |
| ADR (design records) | As needed | Future members | Transparency in decision-making |
| Retrospectives | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Key design sessions | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │ Plan│ Fix │
    │ it  │ now │
    │     │     │
    ├─────┼─────┤
    │ Log │ Next│
    │ only│Sprint│
    │     │     │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```

---

## Security Considerations

### Common Vulnerabilities and Mitigations

| Vulnerability | Risk Level | Mitigation | Detection Method |
|--------------|------------|-----------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor authentication, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, principle of least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logging, audit trails | Log analysis |

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

- [ ] All inputs are validated
- [ ] Sensitive information is not written to logs
- [ ] HTTPS is enforced
- [ ] CORS policies are properly configured
- [ ] Vulnerability scanning of dependency packages is performed
- [ ] Error messages do not expose internal information
---


## FAQ

### Q1: What is the most important point when learning this topic?

Accumulating hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## Summary

| Operation | Command | Key Options |
|-----------|---------|-------------|
| Create file | touch | -t (specify time), -r (reference) |
| Create text | echo >, cat << EOF | > (overwrite), >> (append) |
| Create directory | mkdir | -p (nested), -m (permissions) |
| Copy | cp | -r (recursive), -a (archive), -i (confirm) |
| Move/Rename | mv | -i (confirm), -n (no overwrite) |
| Delete | rm | -r (recursive), -i (confirm), trash recommended |
| Wildcards | *, ?, [], {} | extglob, globstar |
| Sync | rsync | -avh (basic), --delete, --exclude |
| Link | ln | -s (symbolic), -f (overwrite) |
| Compare | diff | -u (unified), -r (recursive) |

### Golden Rules for Safe File Operations

1. **Make rm -i the default** — always set it as an alias to prompt for confirmation
2. **Use trash instead of rm** — deletions that can be recovered
3. **Check for empty values before variable expansion** — prevent accidents like `rm -rf "$UNDEFINED"`
4. **Always do a dry run with rsync -n before executing** — prevent unexpected deletions
5. **Confirm wildcard targets with ls before using rm** — verify targets in advance
6. **Back up important files with cp --backup** — prevent overwrite accidents
7. **Use version control (git) before bulk operations** — always have a way to revert

---

## Guides to Read Next

---

## References
1. Shotts, W. "The Linux Command Line." 2nd Ed, Ch.4, No Starch Press, 2019.
2. Ward, B. "How Linux Works." 3rd Ed, Ch.2, No Starch Press, 2021.
3. rsync Official Manual: https://rsync.samba.org/documentation.html
4. GNU Coreutils Manual: https://www.gnu.org/software/coreutils/manual/
5. Powers, S. "Unix Power Tools." 3rd Ed, O'Reilly, 2002.
