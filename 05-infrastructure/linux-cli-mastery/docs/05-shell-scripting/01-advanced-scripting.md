# Advanced Shell Scripting

> Error handling, logging, and parallel processing are essential for production-ready scripts.

## What You Will Learn

- [ ] Write robust error handling
- [ ] Use arrays and associative arrays effectively
- [ ] Implement parallel processing and template processing
- [ ] Write deploy, monitoring, and backup scripts ready for immediate production use
- [ ] Test, debug, and optimize shell scripts


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content in [Shell Scripting Basics](./00-basics.md)

---

## 1. Writing Robust Scripts

### 1.1 Defensive Settings

```bash
#!/usr/bin/env bash

# 防御的設定（スクリプト冒頭に必ず入れる）
set -euo pipefail

# set -e: コマンドが失敗したら即終了
# set -u: 未定義変数の参照でエラー
# set -o pipefail: パイプ中の失敗を検知

# デバッグ時
set -x                           # 実行コマンドを表示
# set -euxo pipefail            # 全部入り

# エラーハンドリング
trap 'echo "Error at line $LINENO (exit $?)" >&2' ERR

# クリーンアップ
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# エラー関数
die() {
    echo "ERROR: $*" >&2
    exit 1
}

# 使用例
[[ -f "$1" ]] || die "File not found: $1"
```

### 1.2 Combining Multiple Traps

```bash
#!/usr/bin/env bash
set -euo pipefail

# 複数のクリーンアップ処理を組み合わせるパターン
TMPDIR=""
LOCKFILE=""
PID_FILE=""

cleanup() {
    local exit_code=$?
    echo "Cleaning up (exit code: $exit_code)..."

    # 一時ディレクトリの削除
    if [[ -n "$TMPDIR" && -d "$TMPDIR" ]]; then
        rm -rf "$TMPDIR"
        echo "Removed temp dir: $TMPDIR"
    fi

    # ロックファイルの削除
    if [[ -n "$LOCKFILE" && -f "$LOCKFILE" ]]; then
        rm -f "$LOCKFILE"
        echo "Removed lock file: $LOCKFILE"
    fi

    # PIDファイルの削除
    if [[ -n "$PID_FILE" && -f "$PID_FILE" ]]; then
        rm -f "$PID_FILE"
        echo "Removed PID file: $PID_FILE"
    fi

    # 子プロセスの終了
    jobs -p | xargs -r kill 2>/dev/null || true

    exit "$exit_code"
}

trap cleanup EXIT
trap 'echo "Interrupted!" >&2; exit 130' INT TERM

# リソース作成
TMPDIR=$(mktemp -d)
LOCKFILE="/tmp/myapp.lock"
PID_FILE="/tmp/myapp.pid"

# ロックファイルの作成（排他制御）
if [[ -f "$LOCKFILE" ]]; then
    die "Another instance is running (lock: $LOCKFILE)"
fi
echo $$ > "$LOCKFILE"
echo $$ > "$PID_FILE"

# メイン処理...
```

### 1.3 Mutual Exclusion with Lock Files

```bash
#!/usr/bin/env bash
set -euo pipefail

LOCKFILE="/var/lock/myapp.lock"

# flock を使った排他制御（推奨）
exec 200>"$LOCKFILE"
if ! flock -n 200; then
    echo "Another instance is running." >&2
    exit 1
fi

# ロック取得成功後、終了時に自動解放

# タイムアウト付きロック取得
exec 200>"$LOCKFILE"
if ! flock -w 30 200; then
    echo "Timeout waiting for lock." >&2
    exit 1
fi

# flock を使わない場合のポータブルな実装
acquire_lock() {
    local lockfile="$1"
    local max_wait="${2:-60}"
    local wait=0

    while [[ -f "$lockfile" ]]; do
        local pid
        pid=$(cat "$lockfile" 2>/dev/null || true)
        # プロセスが存在しない場合、stale lock として削除
        if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
            echo "Removing stale lock (PID: $pid)"
            rm -f "$lockfile"
            break
        fi
        if (( wait >= max_wait )); then
            echo "Timeout waiting for lock" >&2
            return 1
        fi
        sleep 1
        (( wait++ ))
    done

    echo $$ > "$lockfile"
}

release_lock() {
    local lockfile="$1"
    rm -f "$lockfile"
}
```

### 1.4 Log Output

```bash
# カラー付きログ関数
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'  # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $(date '+%H:%M:%S') $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $*" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*" >&2; }
log_debug() { [[ "${DEBUG:-false}" == "true" ]] && echo -e "${CYAN}[DEBUG]${NC} $(date '+%H:%M:%S') $*"; }

log_info "Processing started"
log_warn "File size exceeds 100MB"
log_error "Connection failed"
DEBUG=true log_debug "Variable x = 42"

# ファイルとstdoutの両方にログ
exec > >(tee -a "$LOGFILE") 2>&1

# 高度なロギングシステム
LOG_LEVEL="${LOG_LEVEL:-INFO}"
LOG_FILE="${LOG_FILE:-/dev/null}"

declare -A LOG_LEVELS=( [DEBUG]=0 [INFO]=1 [WARN]=2 [ERROR]=3 [FATAL]=4 )

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local caller="${FUNCNAME[1]:-main}:${BASH_LINENO[0]:-0}"

    # レベルチェック
    if (( ${LOG_LEVELS[$level]:-0} < ${LOG_LEVELS[$LOG_LEVEL]:-0} )); then
        return
    fi

    local color="${NC}"
    case "$level" in
        DEBUG) color="${CYAN}" ;;
        INFO)  color="${GREEN}" ;;
        WARN)  color="${YELLOW}" ;;
        ERROR) color="${RED}" ;;
        FATAL) color="${MAGENTA}" ;;
    esac

    # コンソール出力（カラー付き）
    echo -e "${color}[$level]${NC} $timestamp [$caller] $message" >&2

    # ファイル出力（カラーなし）
    echo "[$level] $timestamp [$caller] $message" >> "$LOG_FILE"
}

# 使用例
log INFO "Application started"
log DEBUG "Processing file: $filename"
log ERROR "Failed to connect to database"
log FATAL "Unrecoverable error, shutting down"
```

### 1.5 Loading Configuration Files

```bash
#!/usr/bin/env bash
set -euo pipefail

# デフォルト設定
readonly DEFAULT_CONFIG="/etc/myapp/config.conf"
readonly USER_CONFIG="$HOME/.myapp.conf"

# 設定のデフォルト値
APP_PORT=8080
APP_HOST="localhost"
APP_DEBUG=false
APP_LOG_LEVEL="INFO"
APP_MAX_RETRIES=3

# 設定ファイル読み込み関数
load_config() {
    local config_file="$1"

    if [[ ! -f "$config_file" ]]; then
        log_warn "Config file not found: $config_file"
        return 1
    fi

    # セキュリティチェック: 設定ファイルの権限確認
    local perms
    perms=$(stat -c '%a' "$config_file" 2>/dev/null || stat -f '%Lp' "$config_file")
    if [[ "$perms" != "600" && "$perms" != "640" && "$perms" != "644" ]]; then
        log_warn "Config file has loose permissions: $perms (recommend 600 or 640)"
    fi

    while IFS='=' read -r key value; do
        # コメントと空行をスキップ
        [[ "$key" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$key" ]] && continue

        # 前後の空白を削除
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)

        # クオートの除去
        value="${value#\"}"
        value="${value%\"}"
        value="${value#\'}"
        value="${value%\'}"

        # 変数として設定
        case "$key" in
            port)       APP_PORT="$value" ;;
            host)       APP_HOST="$value" ;;
            debug)      APP_DEBUG="$value" ;;
            log_level)  APP_LOG_LEVEL="$value" ;;
            max_retries) APP_MAX_RETRIES="$value" ;;
            *)          log_warn "Unknown config key: $key" ;;
        esac
    done < "$config_file"
}

# 設定の読み込み順序（後のファイルが優先）
[[ -f "$DEFAULT_CONFIG" ]] && load_config "$DEFAULT_CONFIG"
[[ -f "$USER_CONFIG" ]]    && load_config "$USER_CONFIG"

# 環境変数による上書き
APP_PORT="${MYAPP_PORT:-$APP_PORT}"
APP_HOST="${MYAPP_HOST:-$APP_HOST}"
```

---

## 2. Argument Handling

### 2.1 Basic Argument Handling

```bash
# 位置パラメータ
echo "Script: $0"
echo "First arg: $1"
echo "All args: $@"
echo "Arg count: $#"

# shift で引数をずらす
while [[ $# -gt 0 ]]; do
    echo "Processing: $1"
    shift
done
```

### 2.2 getopts (Short Options)

```bash
# getopts は POSIX 互換の引数パーサー
verbose=false
output=""
count=1

while getopts "hv:o:c:" opt; do
    case $opt in
        h) usage; exit 0 ;;
        v) verbose="$OPTARG" ;;
        o) output="$OPTARG" ;;
        c) count="$OPTARG" ;;
        ?) usage; exit 1 ;;
    esac
done
shift $((OPTIND - 1))  # オプション以外の引数にアクセス

# 残りの引数
echo "Remaining args: $@"
```

### 2.3 Long Options (Manual Parsing)

```bash
# 長いオプション対応の完全なパーサー
verbose=false
output=""
dry_run=false
files=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            usage; exit 0
            ;;
        --output|-o)
            [[ -z "${2:-}" ]] && die "Option $1 requires an argument"
            output="$2"; shift 2
            ;;
        --output=*)
            output="${1#*=}"; shift
            ;;
        --verbose|-v)
            verbose=true; shift
            ;;
        --dry-run|-n)
            dry_run=true; shift
            ;;
        --)
            shift; break
            ;;
        -*)
            die "Unknown option: $1"
            ;;
        *)
            files+=("$1"); shift
            ;;
    esac
done

# -- 以降の引数も files に追加
files+=("$@")

# 引数検証
if [[ ${#files[@]} -eq 0 ]]; then
    die "At least one file is required"
fi
```

### 2.4 Usage Function Template

```bash
# usage 関数のプロフェッショナルなテンプレート
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="1.0.0"

usage() {
    cat <<EOF
$SCRIPT_NAME v$SCRIPT_VERSION - File Conversion Tool

Usage: $SCRIPT_NAME [OPTIONS] FILE...

Description:
  Processes specified files and outputs conversion results.
  Supports batch processing of multiple files.

Options:
  -h, --help          Show this help
  -V, --version       Show version
  -o, --output DIR    Output directory (default: ./output)
  -v, --verbose       Show verbose output
  -n, --dry-run       Show what would be done without executing
  -c, --count N       Maximum number of files to process (default: unlimited)
  -f, --format FMT    Output format (json, csv, yaml)

Environment Variables:
  MYAPP_OUTPUT        Output directory (equivalent to --output)
  MYAPP_DEBUG         Debug mode (true/false)

Examples:
  $SCRIPT_NAME input.txt
  $SCRIPT_NAME -o /tmp --verbose *.csv
  $SCRIPT_NAME --format json --output results/ data/*.txt
  $SCRIPT_NAME -n --dry-run *.log

Exit Codes:
  0    Success
  1    General error
  2    Argument error
  130  Interrupted (Ctrl+C)

Report bugs to: https://github.com/example/myapp/issues
EOF
}

version() {
    echo "$SCRIPT_NAME v$SCRIPT_VERSION"
}
```

### 2.5 Subcommand Pattern

```bash
#!/usr/bin/env bash
set -euo pipefail

# Git や Docker のようなサブコマンドパターン
SCRIPT_NAME="$(basename "$0")"

cmd_init() {
    echo "Initializing..."
    # 初期化処理
}

cmd_build() {
    local target="${1:-all}"
    echo "Building target: $target"
    # ビルド処理
}

cmd_deploy() {
    local env="${1:-staging}"
    local force=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --force|-f) force=true; shift ;;
            *)          env="$1"; shift ;;
        esac
    done

    echo "Deploying to: $env (force: $force)"
    # デプロイ処理
}

cmd_help() {
    cat <<EOF
Usage: $SCRIPT_NAME <command> [options]

Commands:
  init              Initialize
  build [target]    Build (default: all)
  deploy [env]      Deploy (default: staging)
  help              Show this help

Run '$SCRIPT_NAME <command> --help' for more information on a command.
EOF
}

# Main dispatch
main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        init)    cmd_init "$@" ;;
        build)   cmd_build "$@" ;;
        deploy)  cmd_deploy "$@" ;;
        help|-h|--help) cmd_help ;;
        *)       die "Unknown command: $command" ;;
    esac
}

main "$@"
```

---

## 3. Arrays

### 3.1 Indexed Arrays

```bash
# 通常の配列（インデックス配列）
fruits=("apple" "banana" "cherry")

# アクセス
echo "${fruits[0]}"              # apple
echo "${fruits[1]}"              # banana
echo "${fruits[@]}"              # 全要素
echo "${#fruits[@]}"             # 要素数（3）

# 追加
fruits+=("date")
fruits+=("elderberry" "fig")

# ループ
for fruit in "${fruits[@]}"; do
    echo "Fruit: $fruit"
done

# インデックス付きループ
for i in "${!fruits[@]}"; do
    echo "$i: ${fruits[$i]}"
done

# スライス
echo "${fruits[@]:1:3}"          # index 1から3個

# 削除
unset 'fruits[2]'               # index 2 を削除

# 配列をコマンドの出力から作成
files=($(ls *.txt))
lines=($(cat file.txt))

# 安全な方法（スペース対応）
mapfile -t lines < file.txt
readarray -t lines < file.txt   # 同じ

# NUL区切りで安全に配列を作成
mapfile -t -d '' files < <(find . -name "*.txt" -print0)
```

### 3.2 Advanced Array Operations

```bash
# 配列のフィルタリング
numbers=(1 2 3 4 5 6 7 8 9 10)
even=()
for n in "${numbers[@]}"; do
    (( n % 2 == 0 )) && even+=("$n")
done
echo "Even: ${even[@]}"          # 2 4 6 8 10

# 配列の結合
arr1=("a" "b" "c")
arr2=("d" "e" "f")
combined=("${arr1[@]}" "${arr2[@]}")
echo "${combined[@]}"            # a b c d e f

# 配列から要素を検索
contains() {
    local needle="$1"
    shift
    for item in "$@"; do
        [[ "$item" == "$needle" ]] && return 0
    done
    return 1
}

if contains "banana" "${fruits[@]}"; then
    echo "Found banana"
fi

# 配列のソート
sorted=($(printf '%s\n' "${fruits[@]}" | sort))

# 配列の重複排除
unique=($(printf '%s\n' "${fruits[@]}" | sort -u))

# 配列をカンマ区切り文字列に変換
IFS=','
csv_string="${fruits[*]}"
unset IFS
echo "$csv_string"               # apple,banana,cherry,...

# カンマ区切り文字列を配列に変換
IFS=',' read -ra items <<< "one,two,three"
echo "${items[@]}"               # one two three

# 配列の長さチェック
if [[ ${#fruits[@]} -eq 0 ]]; then
    echo "Array is empty"
fi

# 配列のコピー
copy=("${fruits[@]}")

# 配列のリバース
reverse=()
for (( i=${#fruits[@]}-1; i>=0; i-- )); do
    reverse+=("${fruits[$i]}")
done
```

### 3.3 Associative Arrays (Bash 4+)

```bash
declare -A colors
colors[red]="#FF0000"
colors[green]="#00FF00"
colors[blue]="#0000FF"

# 一括定義
declare -A config=(
    [host]="localhost"
    [port]="8080"
    [debug]="true"
)

# アクセス
echo "${config[host]}"           # localhost

# キー一覧
echo "${!config[@]}"             # host port debug

# ループ
for key in "${!config[@]}"; do
    echo "$key = ${config[$key]}"
done

# 存在チェック
if [[ -v config[host] ]]; then
    echo "host is set"
fi

# 連想配列を使った簡易データベース
declare -A user_db
user_db["alice:email"]="alice@example.com"
user_db["alice:role"]="admin"
user_db["alice:active"]="true"
user_db["bob:email"]="bob@example.com"
user_db["bob:role"]="user"
user_db["bob:active"]="false"

get_user_field() {
    local user="$1"
    local field="$2"
    echo "${user_db[$user:$field]:-}"
}

echo "Alice's email: $(get_user_field alice email)"
echo "Bob's role: $(get_user_field bob role)"

# 連想配列を使った設定マッピング
declare -A ENV_MAP=(
    [development]="dev.example.com"
    [staging]="staging.example.com"
    [production]="www.example.com"
)

deploy_target="${ENV_MAP[${DEPLOY_ENV:-development}]}"
echo "Deploying to: $deploy_target"

# 連想配列の要素数
echo "Config entries: ${#config[@]}"

# 連想配列の削除
unset 'config[debug]'
```

---

## 4. Advanced String Manipulation Techniques

```bash
# パラメータ展開による文字列操作

str="Hello, World!"

# 長さ
echo "${#str}"                    # 13

# 部分文字列
echo "${str:0:5}"                 # Hello
echo "${str:7}"                   # World!
echo "${str: -6}"                 # World!（末尾から）

# パターン削除
path="/home/user/documents/file.tar.gz"
echo "${path##*/}"                # file.tar.gz（最長前方一致削除）
echo "${path#*/}"                 # home/user/documents/file.tar.gz（最短前方一致削除）
echo "${path%%.*}"                # /home/user/documents/file（最長後方一致削除）
echo "${path%.*}"                 # /home/user/documents/file.tar（最短後方一致削除）

# ファイル名・ディレクトリ名の取得
filename="${path##*/}"            # file.tar.gz
dirname="${path%/*}"              # /home/user/documents
extension="${filename##*.}"       # gz
basename="${filename%%.*}"        # file

# 置換
echo "${str/World/Bash}"          # Hello, Bash!（最初の一致）
echo "${str//l/L}"                # HeLLo, WorLd!（全て置換）

# デフォルト値
echo "${UNDEFINED_VAR:-default}"  # 変数が未定義の場合のデフォルト
echo "${UNDEFINED_VAR:=default}"  # 未定義の場合、デフォルト値を代入

# 条件付きエラー
echo "${REQUIRED_VAR:?'This variable must be set'}"

# 大文字・小文字変換（Bash 4+）
str="Hello World"
echo "${str^^}"                   # HELLO WORLD（全て大文字）
echo "${str,,}"                   # hello world（全て小文字）
echo "${str^}"                    # Hello world（先頭のみ大文字）

# 間接参照
var_name="HOME"
echo "${!var_name}"               # /home/user（$HOME の値）

# 正規表現マッチング
if [[ "file_2025.log" =~ ^file_([0-9]{4})\.log$ ]]; then
    echo "Year: ${BASH_REMATCH[1]}"  # Year: 2025
fi

# 文字列の繰り返し
printf '=%.0s' {1..50}           # ===...=（50文字）
echo
printf '%0.s-' {1..30}           # ---...---（30文字）
echo
```

---

## 5. Parallel Processing

### 5.1 Background Jobs + wait

```bash
# 基本的な並列処理
process_file() {
    local file="$1"
    echo "Processing: $file"
    sleep 2  # 模擬処理
    echo "Done: $file"
}

for file in *.csv; do
    process_file "$file" &
done
wait
echo "All files processed"

# 並列数の制限
MAX_JOBS=4
for file in *.csv; do
    process_file "$file" &
    # 同時実行数を制限
    while (( $(jobs -r | wc -l) >= MAX_JOBS )); do
        sleep 0.1
    done
done
wait
```

### 5.2 Parallel Processing with Result Collection

```bash
#!/usr/bin/env bash
set -euo pipefail

# 結果を一時ファイルに保存して収集するパターン
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

urls=(
    "https://api.example.com/users"
    "https://api.example.com/orders"
    "https://api.example.com/products"
    "https://api.example.com/inventory"
    "https://api.example.com/reports"
)

MAX_PARALLEL=3
count=0

for i in "${!urls[@]}"; do
    url="${urls[$i]}"
    (
        result=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "FAIL")
        echo "$url $result" > "$TMPDIR/result_$i"
    ) &

    (( count++ ))
    if (( count >= MAX_PARALLEL )); then
        wait -n  # 最初に完了したジョブを待つ（Bash 4.3+）
        (( count-- ))
    fi
done
wait

# 結果の集計
echo "=== Results ==="
success=0
fail=0
for f in "$TMPDIR"/result_*; do
    read -r url status < "$f"
    if [[ "$status" == "200" ]]; then
        echo "OK: $url"
        (( success++ ))
    else
        echo "FAIL: $url (status: $status)"
        (( fail++ ))
    fi
done
echo "Success: $success, Failed: $fail"
```

### 5.3 Parallel Control with Named Pipes (FIFO)

```bash
#!/usr/bin/env bash
set -euo pipefail

# FIFOを使ったセマフォ的並列制御
MAX_PARALLEL=4
FIFO="/tmp/parallel_fifo_$$"
mkfifo "$FIFO"
trap 'rm -f "$FIFO"' EXIT

# FIFOにトークンを投入
exec 3<>"$FIFO"
for (( i=0; i < MAX_PARALLEL; i++ )); do
    echo >&3
done

process_item() {
    local item="$1"
    echo "Start: $item (PID: $$)"
    sleep $((RANDOM % 5 + 1))  # 模擬処理
    echo "Done: $item"
}

items=("item1" "item2" "item3" "item4" "item5" "item6" "item7" "item8")

for item in "${items[@]}"; do
    read -u 3       # トークンを取得（空きがなければブロック）
    (
        process_item "$item"
        echo >&3    # トークンを返却
    ) &
done
wait

exec 3>&-   # FIFOを閉じる
```

### 5.4 xargs and GNU parallel

```bash
# xargs による並列処理
find . -name "*.jpg" -print0 | xargs -0 -P 4 -I {} convert {} {}.png
# -P 4: 4並列
# -0:   NUL区切り（ファイル名のスペース対応）
# -I {}: プレースホルダー

# xargs の高度な使い方
find . -name "*.log" -mtime +30 -print0 | xargs -0 -P 8 gzip
cat urls.txt | xargs -P 10 -I {} curl -sO {}
seq 100 | xargs -P 4 -I {} sh -c 'echo "Processing {}"; sleep 1'

# GNU parallel（より高機能）
# brew install parallel
parallel convert {} {.}.png ::: *.jpg
parallel -j 4 process_file ::: *.csv
cat urls.txt | parallel -j 8 curl -sO {}

# GNU parallel の高度な使い方
# プログレスバー表示
parallel --bar -j 4 gzip ::: *.log

# リトライ付き
parallel --retries 3 -j 4 curl -sO {} ::: $(cat urls.txt)

# 結果をログに保存
parallel --joblog /tmp/parallel.log -j 4 process {} ::: *.dat

# リモートサーバーで並列実行
parallel -S server1,server2,server3 -j 2 process {} ::: *.dat

# 入力をチャンクに分割
cat big_file.txt | parallel --pipe -j 4 wc -l

# 複数引数の組み合わせ
parallel echo {1} {2} ::: A B C ::: 1 2 3
# A 1, A 2, A 3, B 1, B 2, ...
```

---

## 6. Text Processing Patterns

### 6.1 CSV Processing

```bash
# 基本的なCSV読み込み
while IFS=',' read -r name age city; do
    echo "Name: $name, Age: $age, City: $city"
done < data.csv

# ヘッダーをスキップ
tail -n +2 data.csv | while IFS=',' read -r name age city; do
    echo "Name: $name, Age: $age, City: $city"
done

# クオート付きCSVの処理（簡易版）
parse_csv_line() {
    local line="$1"
    local -n result_ref="$2"
    local field=""
    local in_quotes=false

    result_ref=()

    for (( i=0; i<${#line}; i++ )); do
        local char="${line:$i:1}"
        if [[ "$char" == '"' ]]; then
            in_quotes=$([[ "$in_quotes" == false ]] && echo true || echo false)
        elif [[ "$char" == ',' && "$in_quotes" == false ]]; then
            result_ref+=("$field")
            field=""
        else
            field+="$char"
        fi
    done
    result_ref+=("$field")
}

# CSVから特定列を抽出
awk -F',' '{print $1, $3}' data.csv

# CSVの集計
awk -F',' 'NR>1 {sum+=$2; count++} END {print "Average:", sum/count}' data.csv
```

### 6.2 INI File Processing

```bash
# INI ファイル風の設定読み込み
parse_config() {
    local file="$1"
    while IFS='=' read -r key value; do
        # コメントと空行をスキップ
        [[ "$key" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$key" ]] && continue
        # 前後の空白を削除
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        export "CONFIG_$key=$value"
    done < "$file"
}

# セクション対応のINIパーサー
parse_ini() {
    local file="$1"
    local section=""

    while IFS= read -r line; do
        # 空行・コメントスキップ
        [[ -z "$line" || "$line" =~ ^[[:space:]]*[#\;] ]] && continue

        # セクション
        if [[ "$line" =~ ^\[([^\]]+)\] ]]; then
            section="${BASH_REMATCH[1]}"
            continue
        fi

        # キー=値
        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            local key value
            key=$(echo "${BASH_REMATCH[1]}" | xargs)
            value=$(echo "${BASH_REMATCH[2]}" | xargs)
            # セクション_キー=値 として export
            local var_name="INI_${section}_${key}"
            var_name="${var_name//[^a-zA-Z0-9_]/_}"
            export "$var_name=$value"
        fi
    done < "$file"
}

# 使用例
# parse_ini config.ini
# echo "$INI_database_host"
# echo "$INI_database_port"
```

### 6.3 Template Processing

```bash
# テンプレート処理（envsubst）
export APP_NAME="MyApp"
export APP_PORT="8080"
envsubst < template.conf > output.conf

# 特定の変数のみ置換
envsubst '${APP_NAME} ${APP_PORT}' < template.conf > output.conf

# テンプレート処理（sed）
sed -e "s/{{APP_NAME}}/$APP_NAME/g" \
    -e "s/{{APP_PORT}}/$APP_PORT/g" \
    template.conf > output.conf

# ヒアドキュメントをテンプレートとして使う
generate_nginx_config() {
    local server_name="$1"
    local port="$2"
    local root_dir="$3"

    cat <<EOF
server {
    listen 80;
    server_name $server_name;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /static/ {
        alias $root_dir/static/;
        expires 30d;
    }

    access_log /var/log/nginx/${server_name}_access.log;
    error_log /var/log/nginx/${server_name}_error.log;
}
EOF
}

generate_nginx_config "example.com" "3000" "/var/www/example" > /etc/nginx/sites-available/example
```

### 6.4 JSON Processing (jq)

```bash
# jq を使ったJSON処理
data='{"name":"Alice","age":30,"skills":["bash","python","go"]}'

# フィールド取得
echo "$data" | jq '.name'           # "Alice"
echo "$data" | jq -r '.name'        # Alice（クオートなし）
echo "$data" | jq '.skills[0]'      # "bash"
echo "$data" | jq '.skills | length' # 3

# APIレスポンスの処理
curl -s "https://api.github.com/users/octocat" | jq '{
    name: .name,
    location: .location,
    repos: .public_repos,
    followers: .followers
}'

# 配列のフィルタリング
echo '[{"name":"a","active":true},{"name":"b","active":false}]' | \
    jq '[.[] | select(.active == true)]'

# 変換とマッピング
echo '[1,2,3,4,5]' | jq '[.[] | . * 2]'   # [2,4,6,8,10]

# CSVへの変換
echo '[{"name":"a","age":20},{"name":"b","age":30}]' | \
    jq -r '.[] | [.name, .age] | @csv'

# JSON配列の構築
files=(*.txt)
printf '%s\n' "${files[@]}" | jq -R . | jq -s .
```

---

## 7. Advanced Process Substitution and Redirection Techniques

```bash
# プロセス置換
# <(command) は command の出力をファイルのように扱う
diff <(sort file1.txt) <(sort file2.txt)

# 2つのコマンドの出力を比較
diff <(ssh server1 "cat /etc/nginx/nginx.conf") \
     <(ssh server2 "cat /etc/nginx/nginx.conf")

# 複数のログファイルをマージして時系列でソート
sort -m -t' ' -k1,2 <(cat access.log) <(cat error.log)

# 名前付きファイルディスクリプタ
exec 3>/tmp/output.log          # FD 3 を出力ファイルに
echo "Log message" >&3          # FD 3 に書き込み
exec 3>&-                       # FD 3 を閉じる

exec 4</tmp/input.txt           # FD 4 を入力ファイルに
read -r line <&4                # FD 4 から読み込み
exec 4<&-                       # FD 4 を閉じる

# 標準出力と標準エラーを別々のファイルに
command > stdout.log 2> stderr.log

# 標準エラーのみパイプ
command 2>&1 >/dev/null | grep "error"

# 標準出力と標準エラーの入れ替え
command 3>&1 1>&2 2>&3 3>&-

# tee で複数の出力先
command | tee file1.log | tee file2.log > file3.log

# ヒアストリング
grep "pattern" <<< "search in this string"

# 複数行のヒアドキュメント（変数展開あり）
cat <<EOF
Hello, $USER!
Current directory: $(pwd)
Date: $(date)
EOF

# 複数行のヒアドキュメント（変数展開なし）
cat <<'EOF'
This is literal text.
$USER will not be expanded.
$(commands) will not be executed.
EOF
```

---

## 8. Shell Script Testing and Debugging

### 8.1 Debugging Techniques

```bash
# set -x によるトレース
set -x   # トレース開始
echo "debug this section"
set +x   # トレース終了

# 特定のセクションだけデバッグ
debug_section() {
    set -x
    # デバッグしたい処理
    some_complex_function
    set +x
}

# PS4 でトレース出力をカスタマイズ
export PS4='+${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
# 出力例: +script.sh:42: process_file(): processing...

# BASH_XTRACEFD で別ファイルにトレース出力
exec 5>/tmp/trace.log
BASH_XTRACEFD=5
set -x
# 処理...
set +x
exec 5>&-

# 条件付きデバッグ
[[ "${DEBUG:-}" == "true" ]] && set -x

# caller コマンドでコールスタック表示
show_callstack() {
    local i=0
    echo "Call stack:"
    while caller $i; do
        (( i++ ))
    done
}

# assert 関数
assert() {
    local condition="$1"
    local message="${2:-Assertion failed}"
    if ! eval "$condition"; then
        echo "ASSERT FAILED: $message" >&2
        echo "  Condition: $condition" >&2
        echo "  Location: ${BASH_SOURCE[1]}:${BASH_LINENO[0]}" >&2
        exit 1
    fi
}

assert '[[ -f "/etc/hosts" ]]' "hosts file must exist"
assert '[[ $count -gt 0 ]]' "count must be positive"
```

### 8.2 Unit Testing for Shell Scripts

```bash
#!/usr/bin/env bash
# test_functions.sh - 簡易テストフレームワーク

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# テストヘルパー
assert_eq() {
    local expected="$1"
    local actual="$2"
    local message="${3:-}"
    (( TESTS_RUN++ ))

    if [[ "$expected" == "$actual" ]]; then
        (( TESTS_PASSED++ ))
        echo "  PASS: $message"
    else
        (( TESTS_FAILED++ ))
        echo "  FAIL: $message"
        echo "    Expected: $expected"
        echo "    Actual:   $actual"
    fi
}

assert_true() {
    local condition="$1"
    local message="${2:-}"
    (( TESTS_RUN++ ))

    if eval "$condition"; then
        (( TESTS_PASSED++ ))
        echo "  PASS: $message"
    else
        (( TESTS_FAILED++ ))
        echo "  FAIL: $message (condition: $condition)"
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-}"
    (( TESTS_RUN++ ))

    if [[ "$haystack" == *"$needle"* ]]; then
        (( TESTS_PASSED++ ))
        echo "  PASS: $message"
    else
        (( TESTS_FAILED++ ))
        echo "  FAIL: $message"
        echo "    '$haystack' does not contain '$needle'"
    fi
}

# テスト対象の関数を読み込み
source ./my_functions.sh

# テスト実行
echo "=== Testing string functions ==="
assert_eq "hello" "$(to_lower 'HELLO')" "to_lower converts to lowercase"
assert_eq "HELLO" "$(to_upper 'hello')" "to_upper converts to uppercase"
assert_eq "3" "$(word_count 'one two three')" "word_count counts words"

echo "=== Testing math functions ==="
assert_eq "15" "$(sum 5 10)" "sum adds two numbers"
assert_eq "50" "$(multiply 5 10)" "multiply multiplies two numbers"

# 結果サマリー
echo
echo "=== Test Summary ==="
echo "Total: $TESTS_RUN, Passed: $TESTS_PASSED, Failed: $TESTS_FAILED"

if (( TESTS_FAILED > 0 )); then
    exit 1
fi
```

### 8.3 Static Analysis with ShellCheck

```bash
# ShellCheck のインストール
# brew install shellcheck        # macOS
# apt install shellcheck         # Ubuntu

# 基本的な使い方
shellcheck myscript.sh

# 特定の警告を無視
shellcheck -e SC2086 myscript.sh  # SC2086: ダブルクオート忘れ

# スクリプト内で特定行を無視
# shellcheck disable=SC2086
echo $unquoted_var

# CI/CD での利用（GitHub Actions）
# .github/workflows/lint.yml
# jobs:
#   shellcheck:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - name: ShellCheck
#         uses: ludeeus/action-shellcheck@master

# よくある ShellCheck の警告と修正
# SC2086: Double quote to prevent globbing and word splitting
# 修正前: echo $var
# 修正後: echo "$var"

# SC2046: Quote this to prevent word splitting
# 修正前: file=$(find . -name "*.txt")
# 修正後: file="$(find . -name "*.txt")"

# SC2034: Variable appears unused
# 修正: export で明示するか、# shellcheck disable=SC2034

# SC2155: Declare and assign separately
# 修正前: local var=$(command)
# 修正後: local var; var=$(command)
```

---

## 9. Practical Script Examples

### 9.1 Deploy Script

```bash
#!/usr/bin/env bash
set -euo pipefail

# デプロイスクリプトの例
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly APP_NAME="myapp"
readonly DEPLOY_DIR="/var/www/$APP_NAME"
readonly BACKUP_DIR="/var/backups/$APP_NAME"
readonly LOG_FILE="/var/log/$APP_NAME/deploy.log"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ログ設定
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# クリーンアップ
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log "Deploy FAILED (exit: $exit_code). Rolling back..."
        rollback
    fi
}
trap cleanup EXIT

# ロールバック
rollback() {
    local latest_backup="$BACKUP_DIR/$(ls -t "$BACKUP_DIR" | head -1)"
    if [[ -d "$latest_backup" ]]; then
        log "Restoring from: $latest_backup"
        rsync -a --delete "$latest_backup/" "$DEPLOY_DIR/"
        log "Rollback completed"
    fi
}

# メイン処理
main() {
    log "=== Deploy started ==="

    # バックアップ
    log "Creating backup..."
    mkdir -p "$BACKUP_DIR/$TIMESTAMP"
    cp -a "$DEPLOY_DIR/." "$BACKUP_DIR/$TIMESTAMP/"

    # デプロイ
    log "Deploying..."
    rsync -avz --delete "$SCRIPT_DIR/dist/" "$DEPLOY_DIR/"

    # ヘルスチェック
    log "Health check..."
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/health")
    [[ "$status" -eq 200 ]] || die "Health check failed (status: $status)"

    log "=== Deploy completed ==="
}

main "$@"
```

### 9.2 Monitoring Script

```bash
#!/usr/bin/env bash
set -euo pipefail

# サーバー監視スクリプト
readonly ALERT_EMAIL="admin@example.com"
readonly CHECK_INTERVAL=60
readonly LOG_FILE="/var/log/monitor.log"

# 閾値設定
readonly CPU_THRESHOLD=90
readonly MEM_THRESHOLD=85
readonly DISK_THRESHOLD=90
readonly LOAD_THRESHOLD=$(nproc)  # CPUコア数

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

send_alert() {
    local subject="$1"
    local body="$2"
    echo "$body" | mail -s "[ALERT] $subject" "$ALERT_EMAIL" 2>/dev/null || \
        log "WARNING: Failed to send alert email"
}

check_cpu() {
    local cpu_usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2 + $4)}')
    if (( cpu_usage > CPU_THRESHOLD )); then
        log "ALERT: CPU usage at ${cpu_usage}% (threshold: ${CPU_THRESHOLD}%)"
        send_alert "High CPU Usage" "CPU usage: ${cpu_usage}% on $(hostname)"
    fi
}

check_memory() {
    local mem_usage
    mem_usage=$(free | awk '/Mem:/ {printf("%d", $3/$2 * 100)}')
    if (( mem_usage > MEM_THRESHOLD )); then
        log "ALERT: Memory usage at ${mem_usage}% (threshold: ${MEM_THRESHOLD}%)"
        send_alert "High Memory Usage" "Memory usage: ${mem_usage}% on $(hostname)"
    fi
}

check_disk() {
    while read -r usage mount; do
        local pct="${usage%\%}"
        if (( pct > DISK_THRESHOLD )); then
            log "ALERT: Disk usage at ${usage} on ${mount} (threshold: ${DISK_THRESHOLD}%)"
            send_alert "High Disk Usage" "Disk usage: ${usage} on ${mount} ($(hostname))"
        fi
    done < <(df -h --output=pcent,target | tail -n +2 | awk '{print $1, $2}')
}

check_services() {
    local services=("nginx" "postgresql" "redis-server")
    for svc in "${services[@]}"; do
        if ! systemctl is-active --quiet "$svc" 2>/dev/null; then
            log "ALERT: Service $svc is not running"
            send_alert "Service Down" "Service $svc is not running on $(hostname)"
            # 自動再起動を試みる
            sudo systemctl restart "$svc" 2>/dev/null && \
                log "INFO: Service $svc restarted successfully" || \
                log "ERROR: Failed to restart $svc"
        fi
    done
}

check_load() {
    local load_1m
    load_1m=$(awk '{printf "%d", $1}' /proc/loadavg)
    if (( load_1m > LOAD_THRESHOLD * 2 )); then
        log "ALERT: Load average at ${load_1m} (threshold: $((LOAD_THRESHOLD * 2)))"
        send_alert "High Load Average" "Load: $(cat /proc/loadavg) on $(hostname)"
    fi
}

check_connectivity() {
    local endpoints=(
        "https://www.google.com"
        "https://api.example.com/health"
    )
    for url in "${endpoints[@]}"; do
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "000")
        if [[ "$status" != "200" ]]; then
            log "ALERT: Connectivity check failed for $url (status: $status)"
            send_alert "Connectivity Issue" "Cannot reach $url (status: $status) from $(hostname)"
        fi
    done
}

# Main loop
main() {
    log "=== Monitor started ==="
    while true; do
        check_cpu
        check_memory
        check_disk
        check_services
        check_load
        check_connectivity
        sleep "$CHECK_INTERVAL"
    done
}

main "$@"
```

### 9.3 Backup Script

```bash
#!/usr/bin/env bash
set -euo pipefail

# データベース + ファイルのバックアップスクリプト
readonly BACKUP_BASE="/var/backups"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly BACKUP_DIR="$BACKUP_BASE/$TIMESTAMP"
readonly RETENTION_DAYS=30
readonly LOG_FILE="/var/log/backup.log"

# データベース設定
readonly DB_HOST="localhost"
readonly DB_NAME="myapp"
readonly DB_USER="backup_user"

# S3設定（オプション）
readonly S3_BUCKET="${S3_BACKUP_BUCKET:-}"
readonly S3_PREFIX="backups/$(hostname)"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
die() { log "FATAL: $*"; exit 1; }

# バックアップディレクトリ作成
mkdir -p "$BACKUP_DIR"/{db,files,config}

# PostgreSQL バックアップ
backup_database() {
    log "Backing up database: $DB_NAME"
    pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" \
        | gzip > "$BACKUP_DIR/db/${DB_NAME}_${TIMESTAMP}.sql.gz"
    log "Database backup completed: $(du -sh "$BACKUP_DIR/db/" | cut -f1)"
}

# ファイルバックアップ
backup_files() {
    local dirs=("/var/www/myapp" "/opt/myapp/uploads")

    for dir in "${dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local name
            name=$(echo "$dir" | tr '/' '_' | sed 's/^_//')
            log "Backing up directory: $dir"
            tar czf "$BACKUP_DIR/files/${name}_${TIMESTAMP}.tar.gz" \
                -C "$(dirname "$dir")" "$(basename "$dir")"
        else
            log "WARNING: Directory not found: $dir"
        fi
    done
    log "File backup completed: $(du -sh "$BACKUP_DIR/files/" | cut -f1)"
}

# 設定ファイルバックアップ
backup_configs() {
    local configs=(
        "/etc/nginx"
        "/etc/postgresql"
        "/etc/myapp"
    )

    for config in "${configs[@]}"; do
        if [[ -d "$config" || -f "$config" ]]; then
            log "Backing up config: $config"
            cp -a "$config" "$BACKUP_DIR/config/"
        fi
    done
    log "Config backup completed"
}

# S3 アップロード
upload_to_s3() {
    if [[ -z "$S3_BUCKET" ]]; then
        log "S3 bucket not configured, skipping upload"
        return
    fi

    log "Uploading to S3: s3://$S3_BUCKET/$S3_PREFIX/"
    aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/$S3_PREFIX/$TIMESTAMP/" \
        --storage-class STANDARD_IA
    log "S3 upload completed"
}

# 古いバックアップの削除
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days"

    local deleted=0
    while IFS= read -r dir; do
        rm -rf "$dir"
        (( deleted++ ))
    done < <(find "$BACKUP_BASE" -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -not -path "$BACKUP_BASE")

    log "Deleted $deleted old backups"

    # S3の古いバックアップも削除
    if [[ -n "$S3_BUCKET" ]]; then
        local cutoff_date
        cutoff_date=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || \
                      date -v-${RETENTION_DAYS}d +%Y-%m-%d)
        aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" | while read -r line; do
            local date_str
            date_str=$(echo "$line" | awk '{print $1}')
            if [[ "$date_str" < "$cutoff_date" ]]; then
                local prefix
                prefix=$(echo "$line" | awk '{print $NF}')
                aws s3 rm "s3://$S3_BUCKET/$S3_PREFIX/$prefix" --recursive
                log "Deleted S3 backup: $prefix"
            fi
        done
    fi
}

# バックアップの検証
verify_backup() {
    log "Verifying backup integrity..."
    local errors=0

    # データベースバックアップの検証
    for f in "$BACKUP_DIR"/db/*.sql.gz; do
        if ! gzip -t "$f" 2>/dev/null; then
            log "ERROR: Corrupt backup file: $f"
            (( errors++ ))
        fi
    done

    # ファイルバックアップの検証
    for f in "$BACKUP_DIR"/files/*.tar.gz; do
        if ! tar tzf "$f" >/dev/null 2>&1; then
            log "ERROR: Corrupt backup file: $f"
            (( errors++ ))
        fi
    done

    if (( errors > 0 )); then
        die "Backup verification failed: $errors errors"
    fi

    log "Backup verification passed"
}

# チェックサム生成
generate_checksums() {
    log "Generating checksums..."
    find "$BACKUP_DIR" -type f -not -name "checksums.sha256" \
        -exec sha256sum {} \; > "$BACKUP_DIR/checksums.sha256"
    log "Checksums generated"
}

# メイン処理
main() {
    log "=== Backup started: $TIMESTAMP ==="

    backup_database
    backup_files
    backup_configs
    generate_checksums
    verify_backup
    upload_to_s3
    cleanup_old_backups

    local total_size
    total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "=== Backup completed: $total_size ==="
}

main "$@"
```

### 9.4 Log Analysis Script

```bash
#!/usr/bin/env bash
set -euo pipefail

# Nginx アクセスログ分析スクリプト
LOG_FILE="${1:-/var/log/nginx/access.log}"
OUTPUT_DIR="${2:-/tmp/log_analysis}"

[[ -f "$LOG_FILE" ]] || { echo "Log file not found: $LOG_FILE"; exit 1; }

mkdir -p "$OUTPUT_DIR"

echo "=== Nginx Access Log Analysis ==="
echo "File: $LOG_FILE"
echo "Lines: $(wc -l < "$LOG_FILE")"
echo

# Status code distribution
echo "--- Status Code Distribution ---"
awk '{print $9}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -20

echo

# Top accessed URLs
echo "--- Top 20 URLs ---"
awk '{print $7}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -20

echo

# Top accessing IPs
echo "--- Top 20 IPs ---"
awk '{print $1}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -20

echo

# Access count by hour
echo "--- Hourly Access Count ---"
awk '{print substr($4, 14, 2)}' "$LOG_FILE" | sort | uniq -c | awk '{printf "%s:00  %s requests\n", $2, $1}'

echo

# Error responses (4xx, 5xx)
echo "--- Error Responses ---"
awk '$9 >= 400 {print $9, $7}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -20

echo

# Response size statistics
echo "--- Response Size Statistics ---"
awk '{sum+=$10; count++} END {
    printf "Total: %.2f MB\n", sum/1024/1024
    printf "Average: %.2f KB\n", sum/count/1024
    printf "Requests: %d\n", count
}' "$LOG_FILE"

echo

# Slow requests (if response time is included in log)
echo "--- Slow Requests (if available) ---"
awk -F'"' '{
    split($3, a, " ")
    if (a[2]+0 > 1.0) {
        printf "%.2fs %s\n", a[2], $2
    }
}' "$LOG_FILE" 2>/dev/null | sort -rn | head -10

# CSV output
echo "Generating CSV reports..."
awk '{print $1}' "$LOG_FILE" | sort | uniq -c | sort -rn | \
    awk '{printf "%s,%s\n", $2, $1}' > "$OUTPUT_DIR/ip_counts.csv"

awk '{print $7}' "$LOG_FILE" | sort | uniq -c | sort -rn | \
    awk '{printf "%s,%s\n", $2, $1}' > "$OUTPUT_DIR/url_counts.csv"

echo "Reports saved to: $OUTPUT_DIR/"
```

### 9.5 Interactive Menu System

```bash
#!/usr/bin/env bash
set -euo pipefail

# 対話型メニューの実装
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

print_header() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "╔══════════════════════════════════╗"
    echo "║     Server Management Tool       ║"
    echo "╚══════════════════════════════════╝"
    echo -e "${NC}"
}

print_menu() {
    echo -e "${BOLD}Select an option:${NC}"
    echo
    echo -e "  ${GREEN}1)${NC} System Information"
    echo -e "  ${GREEN}2)${NC} Service Management"
    echo -e "  ${GREEN}3)${NC} Log Viewer"
    echo -e "  ${GREEN}4)${NC} Disk Usage"
    echo -e "  ${GREEN}5)${NC} Network Status"
    echo -e "  ${GREEN}6)${NC} Backup Now"
    echo -e "  ${RED}q)${NC} Quit"
    echo
}

system_info() {
    echo -e "${BOLD}=== System Information ===${NC}"
    echo "Hostname: $(hostname)"
    echo "OS: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || uname -s)"
    echo "Kernel: $(uname -r)"
    echo "Uptime: $(uptime -p 2>/dev/null || uptime)"
    echo "CPU: $(nproc) cores"
    echo "Memory: $(free -h 2>/dev/null | awk '/Mem:/ {print $3 "/" $2}' || echo "N/A")"
    echo "Load: $(cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || echo "N/A")"
}

# select を使った簡易メニュー
select_menu() {
    PS3="Choose a service: "
    services=("nginx" "postgresql" "redis" "Back")

    select svc in "${services[@]}"; do
        case "$svc" in
            "Back") break ;;
            *)
                if [[ -n "$svc" ]]; then
                    echo "Status of $svc:"
                    systemctl status "$svc" --no-pager 2>/dev/null || echo "Service not found"
                fi
                ;;
        esac
    done
}

# Main loop
main() {
    while true; do
        print_header
        print_menu
        read -rp "Enter choice: " choice

        case "$choice" in
            1) system_info ;;
            2) select_menu ;;
            3) journalctl --since "1 hour ago" --no-pager | tail -50 ;;
            4) df -h ;;
            5) ss -tlnp 2>/dev/null || netstat -tlnp ;;
            6) echo "Starting backup..."; ./backup.sh ;;
            q|Q) echo "Goodbye!"; exit 0 ;;
            *) echo -e "${RED}Invalid option${NC}" ;;
        esac

        echo
        read -rp "Press Enter to continue..."
    done
}

main
```

---

## 10. Shell Script Best Practices

### 10.1 Coding Conventions

```bash
# Google Shell Style Guide に基づくベストプラクティス

# 1. ファイルの先頭には必ずシバンとset
#!/usr/bin/env bash
set -euo pipefail

# 2. 定数は readonly で宣言
readonly MAX_RETRIES=3
readonly CONFIG_DIR="/etc/myapp"

# 3. 関数名はスネークケース
process_file() {
    local file="$1"    # local で変数を宣言
    # ...
}

# 4. 変数は常にダブルクォート
echo "$variable"
cp "$source" "$destination"

# 5. [[ ]] を使う（[ ] ではなく）
if [[ -f "$file" ]]; then
    echo "exists"
fi

# 6. $() を使う（バッククォートではなく）
result=$(command)

# 7. メイン関数パターン
main() {
    parse_args "$@"
    validate_environment
    run_process
}
main "$@"

# 8. Comments explain "why", not "what"
# Bad: Delete the file
# Good: Remove temp file to avoid conflicts on next startup
rm -f "$TMPFILE"

# 9. エラーメッセージは stderr に出力
echo "Error: file not found" >&2

# 10. 戻り値は 0（成功）または 1-125（エラー）
# 126: コマンドが実行不可
# 127: コマンドが見つからない
# 128+n: シグナル n で終了
```

### 10.2 Performance Optimization

```bash
# 1. Minimize external command calls
# Bad: invoke external command for each line
while read -r line; do
    echo "$line" | grep "pattern"     # launches grep for every line
done < file.txt

# Good: process in bulk via pipe
grep "pattern" file.txt

# 2. Avoid subshells
# Bad: variable changes lost in subshell
cat file.txt | while read -r line; do
    count=$((count + 1))              # changes inside subshell don't propagate
done

# Good: use redirection instead
while read -r line; do
    count=$((count + 1))
done < file.txt

# 3. Use built-in commands
# Bad: external command
result=$(echo "$str" | tr '[:lower:]' '[:upper:]')

# Good: Bash built-in
result="${str^^}"

# 4. Batch processing with awk/sed
# Bad: multiple pipes
cat file | grep "error" | awk '{print $3}' | sort | uniq -c

# Good: single awk pass
awk '/error/ {count[$3]++} END {for (k in count) print count[k], k}' file | sort -rn

# 5. Use find + xargs for large numbers of files
# Bad: for loop
for f in $(find . -name "*.log"); do
    gzip "$f"
done

# Good: parallel processing with xargs
find . -name "*.log" -print0 | xargs -0 -P 4 gzip

# 6. Avoid unnecessary cat (UUOC: Useless Use of Cat)
# Bad:
cat file.txt | grep "pattern"

# Good:
grep "pattern" file.txt
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Technique | Use Case |
|-----------|----------|
| set -euo pipefail | Robust error handling |
| trap '...' EXIT | Guaranteed cleanup |
| getopts / while case | Argument parsing |
| declare -A | Associative arrays |
| xargs -P N | Parallel processing |
| mapfile -t | Convert file to array |
| envsubst | Template expansion |
| flock | Mutual exclusion (locking) |
| jq | JSON processing |
| ShellCheck | Static analysis |
| Process substitution <() | Treat command output as a file |

---

## Recommended Next Guides

---

## References
1. Shotts, W. "The Linux Command Line." 2nd Ed, Ch.24-36, 2019.
2. "Google Shell Style Guide." google.github.io/styleguide.
3. "ShellCheck Wiki." github.com/koalaman/shellcheck/wiki.
4. Cooper, M. "Advanced Bash-Scripting Guide." tldp.org.
5. Albing, C., Vossen, J.P., Newham, C. "bash Cookbook." 2nd Ed, O'Reilly, 2017.
6. "Bash Reference Manual." gnu.org/software/bash/manual.
