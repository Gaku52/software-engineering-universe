# CLI Productivity

> Optimize tools and configuration to maximize working speed in the CLI.

## What You'll Learn

- [ ] Speed up operations with modern tools like fzf and zoxide
- [ ] Shorten commands with aliases and functions
- [ ] Optimize CLI workflows
- [ ] Configure shell completion to minimize typing
- [ ] Process text quickly at the CLI
- [ ] Choose and configure a terminal emulator


## Prerequisites

Before reading this guide, the following knowledge will help you understand it better:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Terminal Multiplexers (tmux, screen)](./00-tmux-screen.md)

---

## 1. Modern CLI Tools

### 1.1 fzf (Fuzzy Finder)

```bash
# ── Installation ──
# macOS
brew install fzf
$(brew --prefix)/opt/fzf/install      # Set up key bindings and completion

# Ubuntu/Debian
sudo apt install fzf
# Or install the latest version from Git
git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf
~/.fzf/install

# ── Basic Usage ──
fzf                              # Search files in the current directory
vim $(fzf)                       # Open selected file in vim
cat $(fzf)                       # Display contents of selected file

# ── Key Bindings (after shell integration) ──
# Ctrl+R    — Fuzzy search command history
# Ctrl+T    — Fuzzy search file paths and insert
# Alt+C     — Fuzzy search directories and cd

# ── Combine with pipes ──
ps aux | fzf                     # Search processes
git log --oneline | fzf          # Search commits
docker ps | fzf                  # Search containers
kubectl get pods | fzf           # Search pods
env | fzf                        # Search environment variables
history | fzf                    # Search history

# ── Preview feature ──
# Preview file contents (using bat)
fzf --preview 'bat --color=always --line-range :100 {}'

# Preview file contents (using head)
fzf --preview 'head -50 {}'

# Preview directory contents
fd -t d | fzf --preview 'eza -la --git {}'

# Preview Git log
git log --oneline | fzf --preview 'git show --color=always {1}'

# ── Multiple selection ──
# Tab to select multiple, Enter to confirm
fzf --multi                      # Multi-select mode (also -m)
vim $(fzf -m)                    # Select multiple files and open in vim
rm $(fzf -m)                     # Select multiple files and delete

# ── Layout and options ──
fzf --height 40%                 # Display at 40% of screen
fzf --layout=reverse             # Display top to bottom
fzf --border                     # Show border
fzf --header "Select a file"     # Header text
fzf --prompt ">> "               # Customize prompt

# ── fzf default settings ──
# Add to ~/.zshrc:
export FZF_DEFAULT_OPTS="
  --height 60%
  --layout=reverse
  --border rounded
  --preview-window right:50%
  --bind 'ctrl-/:toggle-preview'
  --bind 'ctrl-a:select-all'
  --bind 'ctrl-d:deselect-all'
  --color=bg+:#313244,bg:#1e1e2e,spinner:#f5e0dc,hl:#f38ba8
  --color=fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc
  --color=marker:#f5e0dc,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8
"

# Use fd for Ctrl+T (faster)
export FZF_CTRL_T_COMMAND="fd --type f --hidden --follow --exclude .git"
export FZF_CTRL_T_OPTS="--preview 'bat --color=always --line-range :100 {}'"

# Use fd for Alt+C
export FZF_ALT_C_COMMAND="fd --type d --hidden --follow --exclude .git"
export FZF_ALT_C_OPTS="--preview 'eza -la --git {}'"

# Options for Ctrl+R
export FZF_CTRL_R_OPTS="
  --preview 'echo {}'
  --preview-window up:3:hidden:wrap
  --bind 'ctrl-/:toggle-preview'
"
```

### 1.2 Practical fzf Usage Patterns

```bash
# ── Git integration functions ──

# Select branch and checkout
fco() {
    local branch
    branch=$(git branch -a | sed 's/^..//' | sed 's#remotes/origin/##' | sort -u |
        fzf --height 40% --preview 'git log --oneline -20 {}')
    [ -n "$branch" ] && git checkout "$branch"
}

# Select commit hash (for git show / cherry-pick etc.)
fcommit() {
    local commit
    commit=$(git log --oneline --all --graph --decorate |
        fzf --ansi --no-sort --preview 'echo {} | grep -o "[a-f0-9]\{7,\}" | head -1 | xargs git show --color=always' |
        grep -o "[a-f0-9]\{7,\}" | head -1)
    [ -n "$commit" ] && echo "$commit"
}

# Interactively select files to stage
fga() {
    local files
    files=$(git diff --name-only |
        fzf --multi --preview 'git diff --color=always {}')
    [ -n "$files" ] && echo "$files" | xargs git add
}

# Interactively select a stash and apply it
fstash() {
    local stash
    stash=$(git stash list |
        fzf --preview 'echo {} | cut -d: -f1 | xargs git stash show -p --color=always' |
        cut -d: -f1)
    [ -n "$stash" ] && git stash apply "$stash"
}

# ── Docker integration ──

# Select a container and enter its shell
dexec() {
    local container
    container=$(docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' |
        fzf --height 40% | awk '{print $1}')
    [ -n "$container" ] && docker exec -it "$container" "${1:-bash}"
}

# Select a container and display its logs
dlogs() {
    local container
    container=$(docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' |
        fzf --height 40% | awk '{print $1}')
    [ -n "$container" ] && docker logs -f "$container"
}

# Select an image and remove it
drmi() {
    local images
    images=$(docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}' |
        fzf --multi --height 40% | awk '{print $1}')
    [ -n "$images" ] && echo "$images" | xargs docker rmi
}

# ── Process management ──

# Select a process and kill it
fkill() {
    local pid
    pid=$(ps aux | fzf --header-lines=1 --height 40% | awk '{print $2}')
    [ -n "$pid" ] && echo "Killing PID $pid" && kill "${1:--9}" "$pid"
}

# ── SSH connections ──

# Interactively select an SSH host
fssh() {
    local host
    host=$(awk '/^Host / && !/\*/ {print $2}' ~/.ssh/config |
        fzf --height 30% --header "SSH to:")
    [ -n "$host" ] && ssh "$host"
}

# ── File browser ──

# Interactive file browsing (directory navigation + preview)
fbrowse() {
    while true; do
        local selection
        selection=$(ls -1ap | fzf --header "$(pwd)" \
            --preview '[[ -d {} ]] && eza -la {} || bat --color=always {}' \
            --expect=ctrl-o,ctrl-h)
        local key=$(echo "$selection" | head -1)
        local file=$(echo "$selection" | tail -1)
        [ -z "$file" ] && break
        if [ "$key" = "ctrl-h" ]; then
            cd ..
        elif [ -d "$file" ]; then
            cd "$file"
        else
            ${EDITOR:-vim} "$file"
            break
        fi
    done
}
```

### 1.3 zoxide (Smart Directory Navigation)

```bash
# ── Installation ──
brew install zoxide              # macOS
curl -sS https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | bash

# Add to shell initialization
eval "$(zoxide init zsh)"        # .zshrc
eval "$(zoxide init bash)"       # .bashrc
eval "$(zoxide init fish)"       # config.fish

# ── Basic usage ──
z project                        # Jump to a frequently visited directory containing "project"
z doc                            # Jump to a directory containing "doc"
z foo bar                        # Jump to a path containing both "foo" and "bar"
zi                               # Interactive selection with fzf integration

# ── How it works ──
# zoxide hooks the cd command and records visited directories
# Calculates a score based on visit frequency and last access time
# When using z, selects the directory with the highest score

# ── Data management ──
zoxide query                     # List recorded directories
zoxide query --list              # List with scores
zoxide query -s project          # Score of entries containing "project"
zoxide add /path/to/dir          # Manually add a path
zoxide remove /path/to/dir       # Remove a path

# ── Full replacement for cd ──
# Add to .zshrc to fully replace cd with zoxide:
alias cd='z'

# ── Customizing __zoxide_zi ──
export _ZO_FZF_OPTS="
  --height 40%
  --layout=reverse
  --preview 'eza -la --git {2..}'
  --preview-window right:40%
"
```

### 1.4 bat (cat replacement)

```bash
# ── Installation ──
brew install bat                 # macOS
sudo apt install bat             # Ubuntu (may be named batcat)

# ── Basic usage ──
bat file.py                      # Syntax highlighting + line numbers
bat -l json data.txt             # Explicitly specify language
bat --diff file1 file2           # Show diff
bat -A file.txt                  # Show control characters
bat --line-range 10:20 file.py   # Show only lines 10-20
bat -p file.py                   # Plain mode (no line numbers)

# ── Themes ──
bat --list-themes                # List available themes
export BAT_THEME="Catppuccin Mocha"   # Set theme

# Preview themes
bat --list-themes | fzf --preview="bat --theme={} --color=always /path/to/sample.py"

# ── Configuration file ──
# ~/.config/bat/config
# --theme="Catppuccin Mocha"
# --style="numbers,changes,header,grid"
# --italic-text=always
# --map-syntax "*.conf:INI"
# --map-syntax ".ignore:Git Ignore"

# ── Integration with other tools ──
# Colorized man pages
export MANPAGER="sh -c 'col -bx | bat -l man -p'"
export MANROFFOPT="-c"

# Colorize help output
alias bathelp='bat --plain --language=help'
help() {
    "$@" --help 2>&1 | bathelp
}

# Display git diff with bat (delta is recommended, but bat works too)
git diff | bat -l diff
```

### 1.5 eza (ls replacement)

```bash
# ── Installation ──
brew install eza                 # macOS
cargo install eza                # From Rust

# ── Basic usage ──
eza                              # Color output
eza -la                          # Detailed view (including hidden files)
eza -la --git                    # Show Git status
eza --tree --level=2             # Tree view (2 levels)
eza --tree --level=3 --git-ignore # Tree view (respecting .gitignore)
eza --icons                      # Show icons
eza -la --group                  # Show group
eza -la --header                 # With header row
eza -la --time-style=long-iso    # ISO format timestamps
eza -la --sort=modified          # Sort by modification time
eza -la --sort=size              # Sort by size
eza -la --sort=extension         # Sort by extension
eza -la --reverse                # Reverse order
eza --only-dirs                  # Directories only
eza --only-files                 # Files only

# ── Filtering ──
eza -la --ignore-glob="*.pyc|__pycache__|node_modules"
eza -la --git-ignore             # Filter based on .gitignore

# ── Recommended alias settings ──
alias ls='eza --icons'
alias ll='eza -la --icons --git --header'
alias lt='eza --tree --level=2 --icons'
alias lta='eza --tree --level=3 --icons --git-ignore'
alias lm='eza -la --sort=modified --icons'
alias lS='eza -la --sort=size --icons --reverse'
```

### 1.6 fd (find replacement)

```bash
# ── Installation ──
brew install fd                  # macOS
sudo apt install fd-find         # Ubuntu (named fdfind)

# ── Basic usage ──
fd pattern                       # Pattern search by filename
fd -e py                         # Only .py files
fd -e py -e js                   # .py and .js files
fd -t d                          # Directories only
fd -t f                          # Files only
fd -t l                          # Symbolic links only
fd -t x                          # Executables only
fd -H pattern                    # Include hidden files
fd -I pattern                    # Ignore .gitignore
fd -g '*.py'                     # Glob pattern (not regex)
fd -F 'exact_name'               # Exact match
fd --max-depth 2 pattern         # Depth limit

# ── Execute commands ──
fd pattern --exec wc -l          # Count lines of found files
fd -e py --exec python -c "import py_compile; py_compile.compile('{}')"
fd -e py --exec-batch wc -l      # Batch execution (faster)
fd -e log --changed-within 1d    # Logs changed within the last 1 day
fd -e tmp --changed-before 7d --exec rm  # Delete tmp files older than 7 days

# ── Exclusion patterns ──
fd -E node_modules -E .git pattern
fd --ignore-file .fdignore pattern  # Use .fdignore file

# ── Practical examples ──
# Find large files
fd -t f --exec-batch ls -lhS | sort -rh -k5 | head -20

# Find files with TODO comments
fd -e py --exec grep -l "TODO" {}

# Find empty directories
fd -t d --exec sh -c '[ -z "$(ls -A {})" ] && echo {}'
```

### 1.7 ripgrep (grep replacement)

```bash
# ── Installation ──
brew install ripgrep             # macOS
sudo apt install ripgrep         # Ubuntu

# ── Basic usage ──
rg pattern                       # Recursive search (respects .gitignore)
rg -i pattern                    # Case-insensitive
rg -w pattern                    # Word boundary match
rg -F 'literal string'           # Literal search, not regex
rg -v pattern                    # Lines not matching pattern
rg -c pattern                    # Count matches
rg -l pattern                    # Show filenames only
rg -n pattern                    # Show line numbers (default)

# ── File type filtering ──
rg -t py pattern                 # Python files only
rg -t js -t ts pattern           # JavaScript + TypeScript
rg -T html pattern               # Exclude HTML files
rg --type-list                   # List available types

# ── Context display ──
rg -A 3 pattern                  # 3 lines after match
rg -B 3 pattern                  # 3 lines before match
rg -C 3 pattern                  # 3 lines before and after match

# ── Advanced search ──
rg 'fn\s+\w+\(' -t rust         # Rust function definitions
rg 'class\s+\w+' -t py          # Python class definitions
rg 'TODO|FIXME|HACK' -t py -t js # Multiple patterns
rg -U 'def\s+\w+.*\n\s+"""'     # Multiline match
rg --json pattern | jq           # JSON output

# ── Replacement (preview) ──
rg 'old_name' --replace 'new_name'  # Preview replacement (does not modify files)
# For actual replacement, combine with sed or sd
rg -l 'old_name' | xargs sed -i 's/old_name/new_name/g'

# ── Configuration file ──
# ~/.config/ripgrep/config (specify with RIPGREP_CONFIG_PATH)
export RIPGREP_CONFIG_PATH="$HOME/.config/ripgrep/config"
# --smart-case
# --hidden
# --glob=!.git
# --glob=!node_modules
# --colors=line:fg:yellow
# --colors=match:fg:red
# --colors=match:style:bold
```

### 1.8 Other Modern Tools

```bash
# ── delta — syntax highlighting for git diff ──
brew install git-delta
# Add to ~/.gitconfig:
# [core]
#     pager = delta
# [interactive]
#     diffFilter = delta --color-only
# [delta]
#     navigate = true
#     side-by-side = true
#     line-numbers = true
#     syntax-theme = Catppuccin Mocha

# ── sd — sed replacement (more intuitive substitution) ──
brew install sd
sd 'old_pattern' 'new_pattern' file.txt     # Replace in file
sd -F 'literal' 'replacement' file.txt      # Literal replacement
fd -e py | xargs sd 'old_func' 'new_func'   # Replace across multiple files

# ── dust — du replacement (disk usage visualization) ──
brew install dust
dust                             # Disk usage of current directory
dust -d 2                        # Up to depth 2
dust -r                          # Reverse order (smallest first)

# ── procs — ps replacement ──
brew install procs
procs                            # Colorized process list
procs --tree                     # Tree view
procs --watch                    # Real-time updates
procs nginx                      # Show only nginx-related processes

# ── bottom (btm) — top replacement ──
brew install bottom
btm                              # Interactive system monitor

# ── hyperfine — benchmarking tool ──
brew install hyperfine
hyperfine 'fd -e py'             # Benchmark a command
hyperfine 'fd -e py' 'find . -name "*.py"'  # Compare two commands
hyperfine --warmup 3 'npm run build'  # 3 warmup runs

# ── tokei — code line counter ──
brew install tokei
tokei                            # Code statistics for a repository
tokei -t Python,Rust             # Specify languages

# ── jq — JSON processor ──
brew install jq
echo '{"name":"Alice","age":30}' | jq '.'        # Pretty print
echo '{"name":"Alice","age":30}' | jq '.name'     # Extract field
curl -s api.example.com/data | jq '.items[] | {id, name}'  # Extract from array elements

# ── yq — YAML processor (jq for YAML) ──
brew install yq
yq '.services' docker-compose.yml     # Extract field from YAML
yq -i '.version = "3"' config.yml     # Edit YAML in-place

# ── tldr — simplified man pages ──
brew install tldr
tldr tar                         # Examples for tar
tldr curl                        # Examples for curl

# ── glow — Markdown rendering in terminal ──
brew install glow
glow README.md                   # Render Markdown with formatting
glow -p README.md                # Display with pager

# ── difftastic — structural diff ──
brew install difftastic
difft file1.py file2.py          # AST-based diff
# Integrate with git:
# [diff]
#     external = difft
```

---

## 2. Shell Configuration Optimization

### 2.1 Aliases

```bash
# ~/.zshrc (or ~/.bashrc)

# ── Navigation ──
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias -- -='cd -'                # Return to previous directory

# ── ls → eza ──
alias ls='eza --icons'
alias ll='eza -la --icons --git --header'
alias la='eza -la --icons'
alias lt='eza --tree --level=2 --icons'
alias lta='eza --tree --level=3 --icons --git-ignore'
alias lm='eza -la --sort=modified --icons'

# ── cat → bat ──
alias cat='bat --paging=never'
alias catp='bat --plain'         # Plain mode

# ── grep → ripgrep ──
alias grep='rg'

# ── Safe operations ──
alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'
alias mkdir='mkdir -p'

# ── Git shortcuts ──
alias g='git'
alias gs='git status -sb'
alias ga='git add'
alias gaa='git add -A'
alias gc='git commit'
alias gcm='git commit -m'
alias gca='git commit --amend'
alias gp='git push'
alias gpl='git pull --rebase'
alias gl='git log --oneline -20'
alias glg='git log --graph --oneline --decorate --all'
alias gd='git diff'
alias gds='git diff --staged'
alias gco='git checkout'
alias gcb='git checkout -b'
alias gb='git branch'
alias gba='git branch -a'
alias gst='git stash'
alias gstp='git stash pop'
alias gcp='git cherry-pick'
alias grb='git rebase'
alias grbi='git rebase -i'

# ── Docker ──
alias d='docker'
alias dc='docker compose'
alias dcu='docker compose up -d'
alias dcd='docker compose down'
alias dcl='docker compose logs -f'
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
alias dpsa='docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
alias dimg='docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"'
alias dprune='docker system prune -af'

# ── Kubernetes ──
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgd='kubectl get deployments'
alias kga='kubectl get all'
alias kaf='kubectl apply -f'
alias kdf='kubectl delete -f'
alias klog='kubectl logs -f'
alias kexec='kubectl exec -it'
alias kctx='kubectl config use-context'
alias kns='kubectl config set-context --current --namespace'

# ── Network ──
alias myip='curl -s ifconfig.me'
alias localip="ipconfig getifaddr en0"
alias ports='netstat -tulanp'
alias listen='lsof -i -P | grep LISTEN'

# ── System ──
alias df='df -h'
alias du='du -h'
alias free='free -h 2>/dev/null || vm_stat'
alias top='btm 2>/dev/null || htop 2>/dev/null || top'

# ── Miscellaneous ──
alias path='echo $PATH | tr ":" "\n" | nl'
alias now='date +"%Y-%m-%d %H:%M:%S"'
alias week='date +%V'
alias cls='clear'
alias h='history'
alias j='jobs -l'
```

### 2.2 Useful Functions

```bash
# ── Create directory + move into it ──
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# ── Show size of file/directory ──
sizeof() {
    du -sh "$@" 2>/dev/null | sort -rh
}

# ── Show the process using a port ──
port() {
    lsof -i :"$1"
}

# ── Alarm after a specified number of seconds ──
timer() {
    local seconds="${1:-60}"
    echo "Timer: ${seconds}s"
    sleep "$seconds" && printf '\a' && echo "Time's up!"
}

# ── Pretty-print JSON ──
json() {
    if [ -t 0 ]; then
        cat "$@" | jq '.'
    else
        jq '.'
    fi
}

# ── Weather ──
weather() {
    curl -s "wttr.in/${1:-Tokyo}?format=3"
}

# ── extract: auto-detect and extract archives ──
extract() {
    if [ -f "$1" ]; then
        case "$1" in
            *.tar.bz2) tar xjf "$1"    ;;
            *.tar.gz)  tar xzf "$1"    ;;
            *.tar.xz)  tar xJf "$1"    ;;
            *.tar.zst) tar --zstd -xf "$1" ;;
            *.bz2)     bunzip2 "$1"    ;;
            *.gz)      gunzip "$1"     ;;
            *.tar)     tar xf "$1"     ;;
            *.tbz2)    tar xjf "$1"    ;;
            *.tgz)     tar xzf "$1"    ;;
            *.zip)     unzip "$1"      ;;
            *.Z)       uncompress "$1" ;;
            *.7z)      7z x "$1"       ;;
            *.rar)     unrar x "$1"    ;;
            *)         echo "Cannot extract '$1'" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}

# ── backup: create a backup of a file ──
backup() {
    cp -a "$1" "$1.bak.$(date +%Y%m%d_%H%M%S)"
}

# ── retry: retry a command a specified number of times ──
retry() {
    local max_attempts="${1:-3}"
    local delay="${2:-5}"
    shift 2
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        echo "Attempt $attempt/$max_attempts: $*"
        if "$@"; then
            echo "Success on attempt $attempt"
            return 0
        fi
        echo "Failed. Waiting ${delay}s..."
        sleep "$delay"
        attempt=$((attempt + 1))
    done
    echo "All $max_attempts attempts failed"
    return 1
}

# ── note: quick note ──
note() {
    local note_dir="$HOME/notes"
    mkdir -p "$note_dir"
    if [ $# -eq 0 ]; then
        ${EDITOR:-vim} "$note_dir/$(date +%Y-%m-%d).md"
    else
        echo "$(date +%H:%M) $*" >> "$note_dir/$(date +%Y-%m-%d).md"
        echo "Note added."
    fi
}

# ── serve: serve current directory via HTTP server ──
serve() {
    local port="${1:-8000}"
    echo "Serving on http://localhost:$port"
    python3 -m http.server "$port"
}

# ── cheat: display a command cheat sheet ──
cheat() {
    curl -s "cheat.sh/$1"
}

# ── calc: command-line calculator ──
calc() {
    python3 -c "from math import *; print($*)"
}

# ── colors: test 256-color display ──
colors() {
    for i in {0..255}; do
        printf "\x1b[38;5;${i}m%3d " "$i"
        if (( (i + 1) % 16 == 0 )); then
            printf "\n"
        fi
    done
    printf "\x1b[0m\n"
}

# ── up: move up N levels ──
up() {
    local count="${1:-1}"
    local path=""
    for i in $(seq 1 "$count"); do
        path="../$path"
    done
    cd "$path" || return
}

# ── tre: shorthand for eza --tree (Git-aware, with depth) ──
tre() {
    eza --tree --level="${1:-2}" --icons --git-ignore --git
}

# ── urlencode / urldecode ──
urlencode() {
    python3 -c "import urllib.parse; print(urllib.parse.quote('$*'))"
}
urldecode() {
    python3 -c "import urllib.parse; print(urllib.parse.unquote('$*'))"
}

# ── base64 encode/decode ──
b64e() { echo -n "$*" | base64; }
b64d() { echo "$*" | base64 --decode; }

# ── whatismyip: detailed IP information ──
whatismyip() {
    curl -s "https://ipinfo.io" | jq '.'
}
```

### 2.3 Zsh-Specific Configuration

```bash
# ── Zsh option settings ──
setopt AUTO_CD               # cd by directory name alone
setopt AUTO_PUSHD            # Automatically pushd on cd
setopt PUSHD_IGNORE_DUPS     # Ignore duplicates in pushd
setopt PUSHD_MINUS           # Swap the meaning of + and -
setopt CORRECT               # Spell check commands
setopt CORRECT_ALL           # Spell check arguments too
setopt NO_BEEP               # Disable beep
setopt INTERACTIVE_COMMENTS  # Allow comments
setopt EXTENDED_GLOB         # Extended glob (#, ~, ^ etc.)
setopt NULL_GLOB             # No error when glob has no matches

# ── History settings ──
HISTFILE=~/.zsh_history
HISTSIZE=100000
SAVEHIST=100000
setopt HIST_IGNORE_ALL_DUPS  # Ignore duplicates
setopt HIST_IGNORE_SPACE     # Don't record commands starting with a space
setopt HIST_REDUCE_BLANKS    # Remove excess whitespace
setopt SHARE_HISTORY         # Share history across multiple sessions
setopt APPEND_HISTORY        # Append to history
setopt INC_APPEND_HISTORY    # Append immediately after command execution
setopt HIST_VERIFY           # Expand !! instead of immediately executing

# ── Completion settings ──
autoload -Uz compinit
compinit

# Improve completion display
zstyle ':completion:*' menu select                   # Menu selection
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'  # Match uppercase with lowercase
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}" # Color display
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'
zstyle ':completion:*:warnings' format '%F{red}-- no matches found --%f'
zstyle ':completion:*' group-name ''                 # Grouping
zstyle ':completion:*' squeeze-slashes true           # Collapse // to /

# Completion cache
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "$HOME/.zcompcache"

# ── Key bindings (vi mode recommended) ──
bindkey -v                       # Set to vi mode
export KEYTIMEOUT=1              # Speed up mode switching

# Keep useful key bindings even in vi mode
bindkey '^R' history-incremental-search-backward
bindkey '^A' beginning-of-line
bindkey '^E' end-of-line
bindkey '^W' backward-kill-word
bindkey '^K' kill-line
bindkey '^U' kill-whole-line

# ── Zsh plugin manager ──
# zinit (recommended)
# bash -c "$(curl --fail --show-error --silent --location \
#   https://raw.githubusercontent.com/zdharma-continuum/zinit/HEAD/scripts/install.sh)"

# Load plugins with zinit
# zinit light zsh-users/zsh-autosuggestions
# zinit light zsh-users/zsh-syntax-highlighting
# zinit light zsh-users/zsh-completions
```

---

## 3. Starship Prompt

### 3.1 Basic Configuration

```bash
# ── Installation ──
brew install starship            # macOS
curl -sS https://starship.rs/install.sh | sh   # Linux

# Add to .zshrc
eval "$(starship init zsh)"

# Add to .bashrc
eval "$(starship init bash)"
```

### 3.2 Configuration File (~/.config/starship.toml)

```toml
# ~/.config/starship.toml

# ── Overall prompt ──
# Prompt display format
format = """
$username\
$hostname\
$directory\
$git_branch\
$git_status\
$nodejs\
$python\
$rust\
$golang\
$docker_context\
$kubernetes\
$aws\
$cmd_duration\
$line_break\
$character"""

# Right prompt
right_format = "$time"

# ── Character (prompt symbol) ──
[character]
success_symbol = ">"
error_symbol = ">"
vimcmd_symbol = "<"

# ── Directory ──
[directory]
truncation_length = 3
truncate_to_repo = true
style = "bold cyan"
format = "$path$read_only "
read_only = " (RO)"

# ── Git branch ──
[git_branch]
format = "$symbol$branch(:$remote_branch) "
symbol = " "
style = "bold purple"

# ── Git status ──
[git_status]
format = '([\[$all_status$ahead_behind\]]($style) )'
conflicted = "="
ahead = "^${count}"
behind = "v${count}"
diverged = "^${ahead_count}v${behind_count}"
untracked = "?${count}"
stashed = "$${count}"
modified = "!${count}"
staged = "+${count}"
renamed = "~${count}"
deleted = "-${count}"
style = "bold red"

# ── Languages and runtimes ──
[nodejs]
format = "$symbol($version) "
symbol = " "
detect_files = ["package.json", ".node-version"]

[python]
format = "$symbol$pyenv_prefix($version)( \\($virtualenv\\)) "
symbol = " "

[rust]
format = "$symbol($version) "
symbol = " "

[golang]
format = "$symbol($version) "
symbol = " "

# ── Docker ──
[docker_context]
format = "$symbol$context "
symbol = " "
only_with_files = true

# ── Kubernetes ──
[kubernetes]
disabled = false
format = "$symbol$context(/$namespace) "
symbol = "K8s "
style = "bold blue"

# ── AWS ──
[aws]
format = "$symbol($profile)(\\($region\\)) "
symbol = " "
style = "bold yellow"

# ── Command execution time ──
[cmd_duration]
min_time = 3000
format = "took $duration "
style = "bold yellow"

# ── Time (right prompt) ──
[time]
disabled = false
format = "$time"
time_format = "%H:%M"
style = "dimmed white"

# ── Hostname (show only when connected via SSH) ──
[hostname]
ssh_only = true
format = "@$hostname "
style = "bold green"

# ── Username (show only as root) ──
[username]
show_always = false
format = "$user "
style_root = "bold red"
```

### 3.3 Presets and Customization

```bash
# ── Apply presets ──
# Nerd Font Symbols
starship preset nerd-font-symbols -o ~/.config/starship.toml

# Bracketed Segments (bracket style)
starship preset bracketed-segments -o ~/.config/starship.toml

# Plain Text Symbols (works without Nerd Fonts)
starship preset plain-text-symbols -o ~/.config/starship.toml

# Tokyo Night
starship preset tokyo-night -o ~/.config/starship.toml

# ── Switch configuration per environment ──
# Switch config file with the STARSHIP_CONFIG environment variable
export STARSHIP_CONFIG=~/.config/starship/work.toml    # Work
export STARSHIP_CONFIG=~/.config/starship/personal.toml # Personal
```

---

## 4. Keyboard Shortcuts

### 4.1 Readline / Zsh Key Bindings

```bash
# ── Cursor movement ──
# Ctrl+A    → Beginning of line
# Ctrl+E    → End of line
# Ctrl+F    → Forward one character (same as →)
# Ctrl+B    → Backward one character (same as ←)
# Alt+F     → Forward one word
# Alt+B     → Backward one word

# ── Editing ──
# Ctrl+U    → Delete from cursor to beginning of line
# Ctrl+K    → Delete from cursor to end of line
# Ctrl+W    → Delete previous word
# Alt+D     → Delete next word
# Ctrl+Y    → Paste deleted content (yank)
# Ctrl+T    → Swap characters before and after cursor
# Alt+T     → Swap words before and after cursor
# Alt+U     → Convert word to uppercase
# Alt+L     → Convert word to lowercase
# Alt+C     → Capitalize first letter of word
# Ctrl+_    → Undo (revert last edit)

# ── History ──
# Ctrl+R    → Reverse history search (fzf integration recommended)
# Ctrl+S    → Forward history search
# Ctrl+P    → Previous command (same as ↑)
# Ctrl+N    → Next command (same as ↓)
# !!        → Re-run previous command
# !$        → Last argument of previous command
# !^        → First argument of previous command
# !:n       → Nth argument of previous command
# !:n-m     → Arguments n through m of previous command
# !*        → All arguments of previous command
# !cmd      → Run most recent command starting with "cmd"
# !?str     → Run most recent command containing "str"
# ^old^new  → Replace "old" with "new" in previous command and run

# ── Control ──
# Ctrl+C    → Interrupt current command
# Ctrl+Z    → Suspend current command (resume with bg/fg)
# Ctrl+D    → Send EOF (exit shell / end input)
# Ctrl+L    → Clear screen
# Ctrl+S    → Pause screen output
# Ctrl+Q    → Resume screen output
# Ctrl+\\   → Send SIGQUIT (exit with core dump)

# ── Zsh specific ──
# Tab Tab   → Show list of completion candidates
# Ctrl+X Ctrl+E → Edit command in editor ($EDITOR)
# Alt+H     → Show man page
# Alt+?     → Run which command
# Esc .     → Insert last argument of previous command
```

### 4.2 Custom Key Bindings

```bash
# Add to ~/.zshrc

# ── Custom bindings for fzf integration ──

# Ctrl+G for fuzzy Git branch switching
bindkey -s '^g' 'fco\n'

# Ctrl+O to open a file with fzf
fzf-open-file() {
    local file
    file=$(fzf --preview 'bat --color=always {}')
    if [ -n "$file" ]; then
        BUFFER="${EDITOR:-vim} $file"
        zle accept-line
    fi
    zle reset-prompt
}
zle -N fzf-open-file
bindkey '^o' fzf-open-file

# Alt+C to navigate to a directory (zoxide + fzf)
fzf-cd() {
    local dir
    dir=$(zoxide query -l | fzf --height 40% --preview 'eza -la {}')
    if [ -n "$dir" ]; then
        BUFFER="cd $dir"
        zle accept-line
    fi
    zle reset-prompt
}
zle -N fzf-cd
bindkey '\ec' fzf-cd

# ── Customize vi mode ──
# Customize vi mode display (change cursor shape)
function zle-keymap-select {
    case $KEYMAP in
        vicmd)      echo -ne '\e[1 q' ;;  # Block cursor (normal mode)
        viins|main) echo -ne '\e[5 q' ;;  # Line cursor (insert mode)
    esac
}
zle -N zle-keymap-select

function zle-line-init {
    echo -ne '\e[5 q'  # Initial state is insert mode
}
zle -N zle-line-init
```

---

## 5. Efficient Workflow Patterns

### 5.1 Setting Up a Project Work Environment

```bash
# ── Pattern 1: Project switching with tmux + fzf ──
# ~/.local/bin/dev-start
#!/bin/bash
SESSION="dev"
PROJECT="${1:-$(pwd)}"

# Attach to existing session if it exists
tmux has-session -t "$SESSION" 2>/dev/null && {
    tmux attach -t "$SESSION"
    exit 0
}

tmux new-session -d -s "$SESSION" -c "$PROJECT"
tmux send-keys "vim ." Enter
tmux split-window -v -p 30 -c "$PROJECT"
tmux send-keys "git status" Enter
tmux split-window -h -c "$PROJECT"
tmux select-pane -t 0
tmux attach -t "$SESSION"

# ── Pattern 2: Language-specific development environments ──

# Node.js project
dev-node() {
    local project="${1:-.}"
    tmux new-session -d -s "node" -c "$project" -n "code"
    tmux send-keys "nvim ." Enter
    tmux new-window -t "node" -n "dev" -c "$project"
    tmux send-keys "npm run dev" Enter
    tmux new-window -t "node" -n "test" -c "$project"
    tmux send-keys "npm run test:watch" Enter
    tmux new-window -t "node" -n "shell" -c "$project"
    tmux select-window -t "node:code"
    tmux attach -t "node"
}

# Python project
dev-python() {
    local project="${1:-.}"
    tmux new-session -d -s "python" -c "$project" -n "code"
    tmux send-keys "source .venv/bin/activate && nvim ." Enter
    tmux new-window -t "python" -n "repl" -c "$project"
    tmux send-keys "source .venv/bin/activate && ipython" Enter
    tmux new-window -t "python" -n "test" -c "$project"
    tmux send-keys "source .venv/bin/activate && pytest --watch" Enter
    tmux new-window -t "python" -n "shell" -c "$project"
    tmux send-keys "source .venv/bin/activate" Enter
    tmux select-window -t "python:code"
    tmux attach -t "python"
}
```

### 5.2 Monitoring and Automation

```bash
# ── Pattern 3: Monitoring dashboard ──
watch -n 5 'echo "=== Docker ===" && docker ps --format "table {{.Names}}\t{{.Status}}" && echo && echo "=== Disk ===" && df -h / && echo && echo "=== Memory ===" && free -h 2>/dev/null || vm_stat'

# ── Pattern 4: Watch file changes + auto-run ──
# Using entr (brew install entr)
# Auto-run tests when files change
fd -e py | entr -c pytest

# Auto-run build when files change
fd -e ts | entr -c npm run build

# Run command when specific files change
ls *.go | entr -r go run main.go

# Using watchexec (brew install watchexec)
watchexec -e py -- pytest
watchexec -e rs -- cargo test
watchexec -w src/ -- npm run build

# ── Pattern 5: Batch operation on multiple servers ──
servers=("web1" "web2" "web3")
for s in "${servers[@]}"; do
    echo "=== $s ==="
    ssh "$s" "systemctl status nginx --no-pager" &
done
wait

# ── Pattern 6: Consolidated log monitoring ──
# multitail — monitor multiple logs simultaneously
multitail /var/log/nginx/access.log /var/log/nginx/error.log

# Real-time filtering with tail + awk
tail -f /var/log/app.log | awk '/ERROR/{print "\033[31m" $0 "\033[0m"} /WARN/{print "\033[33m" $0 "\033[0m"}'
```

### 5.3 Work Logging and Measurement

```bash
# ── Pattern 7: Automatic work logging ──
# Record all terminal activity with the script command
script -q ~/logs/session_$(date +%Y%m%d_%H%M%S).log

# asciinema — more feature-rich recording
brew install asciinema
asciinema rec ~/recordings/demo.cast
asciinema play ~/recordings/demo.cast
# Upload to asciinema.org
asciinema upload ~/recordings/demo.cast

# ── Pattern 8: Measure command execution time ──
time npm run build               # Built-in time
/usr/bin/time -l npm run build   # macOS: detailed (memory usage etc.)
/usr/bin/time -v npm run build   # Linux: detailed

# hyperfine — statistical benchmarking
hyperfine 'npm run build'
hyperfine --warmup 3 --min-runs 10 'npm run build'
hyperfine 'fd -e py' 'find . -name "*.py"'  # Comparative benchmark
hyperfine --export-markdown bench.md 'cmd1' 'cmd2'  # Export as Markdown

# ── Pattern 9: Command completion notifications ──
# Notify on completion of long-running commands

# macOS notification
long_command; osascript -e 'display notification "Done!" with title "Terminal"'

# Linux notification (notify-send)
long_command; notify-send "Terminal" "Command completed"

# General-purpose function
notify() {
    "$@"
    local status=$?
    if command -v osascript &>/dev/null; then
        osascript -e "display notification \"Exit: $status\" with title \"$1 finished\""
    elif command -v notify-send &>/dev/null; then
        notify-send "$1 finished" "Exit: $status"
    fi
    return $status
}
# Usage: notify npm run build
```

---

## 6. dotfiles Management

### 6.1 Bare Repository Method

```bash
# Manage dotfiles with a Git bare repository
# Directly manages configuration files in $HOME without symbolic links

# ── Setup ──
git init --bare "$HOME/.dotfiles"
alias dot='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
dot config --local status.showUntrackedFiles no

# Add alias to .zshrc
echo "alias dot='git --git-dir=\$HOME/.dotfiles --work-tree=\$HOME'" >> ~/.zshrc

# ── Adding files ──
dot add ~/.zshrc
dot add ~/.tmux.conf
dot add ~/.config/starship.toml
dot add ~/.config/bat/config
dot add ~/.config/git/config
dot commit -m "Add dotfiles"

# ── Push to remote repository ──
dot remote add origin git@github.com:username/dotfiles.git
dot push -u origin main

# ── Restore on a new machine ──
git clone --bare git@github.com:username/dotfiles.git "$HOME/.dotfiles"
alias dot='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
dot checkout
dot config --local status.showUntrackedFiles no

# If checkout causes conflicts (existing files):
dot checkout 2>&1 | grep "already exists" | awk '{print $NF}' | xargs -I{} mv {} {}.bak
dot checkout
```

### 6.2 chezmoi (Recommended)

```bash
# chezmoi is a dedicated dotfiles management tool
# Supports templates, encryption, and machine-specific settings

# ── Installation ──
brew install chezmoi              # macOS
sh -c "$(curl -fsLS get.chezmoi.io)"  # Linux

# ── Initialization ──
chezmoi init
chezmoi init --apply git@github.com:username/dotfiles.git  # From existing repository

# ── Basic operations ──
chezmoi add ~/.zshrc             # Add file to managed set
chezmoi add ~/.tmux.conf
chezmoi add ~/.config/starship.toml
chezmoi add --encrypt ~/.ssh/config  # Add with encryption

chezmoi edit ~/.zshrc            # Edit a managed file
chezmoi diff                     # Check differences
chezmoi apply                    # Apply changes to $HOME
chezmoi update                   # Fetch from remote + apply

chezmoi cd                       # Move to dotfiles repository
chezmoi data                     # Show template data
chezmoi doctor                   # Check for configuration issues

# ── Template feature ──
# Generate different configurations per machine
# ~/.local/share/chezmoi/dot_zshrc.tmpl
# {{ if eq .chezmoi.os "darwin" }}
# export HOMEBREW_PREFIX="/opt/homebrew"
# {{ else if eq .chezmoi.os "linux" }}
# export HOMEBREW_PREFIX="/home/linuxbrew/.linuxbrew"
# {{ end }}
#
# {{ if eq .chezmoi.hostname "work-laptop" }}
# export HTTP_PROXY="http://proxy.corp.example.com:8080"
# {{ end }}

# ── Encryption ──
# Encrypt with age (simpler than GPG)
# ~/.config/chezmoi/chezmoi.toml
# [age]
#     identity = "~/.config/chezmoi/key.txt"
#     recipient = "age1..."

chezmoi add --encrypt ~/.ssh/config
chezmoi add --encrypt ~/.aws/credentials

# ── Git operations ──
chezmoi git add .
chezmoi git commit -- -m "Update dotfiles"
chezmoi git push
```

### 6.3 GNU Stow

```bash
# GNU Stow is a symlink farm manager
# Creates symbolic links from your dotfiles directory structure to $HOME

# ── Installation ──
brew install stow                # macOS
sudo apt install stow            # Ubuntu

# ── Directory structure ──
# ~/dotfiles/
# ├── zsh/
# │   └── .zshrc
# ├── tmux/
# │   └── .tmux.conf
# ├── git/
# │   └── .config/
# │       └── git/
# │           └── config
# ├── starship/
# │   └── .config/
# │       └── starship.toml
# └── nvim/
#     └── .config/
#         └── nvim/
#             └── init.lua

# ── Usage ──
cd ~/dotfiles

# Create symbolic links per package
stow zsh                         # ~/.zshrc → ~/dotfiles/zsh/.zshrc
stow tmux                        # ~/.tmux.conf → ~/dotfiles/tmux/.tmux.conf
stow git
stow starship
stow nvim

# Apply all packages at once
stow */

# Remove symbolic links
stow -D zsh

# Re-stow (update)
stow -R zsh

# Dry run (verify without executing)
stow -n zsh
```

---

## 7. Terminal Emulator Selection and Configuration

### 7.1 Modern Terminal Emulators

```bash
# ── iTerm2 (macOS) ──
# The most popular macOS terminal
# https://iterm2.com/
# Features:
# - Split panes
# - Hotkey window (call up anytime)
# - Shell integration (display command status)
# - Autocomplete
# - Triggers (execute actions on pattern match)
# - Profile switching

# Recommended iTerm2 settings:
# Preferences > General > Closing
#   → "Confirm closing multiple sessions" ON
# Preferences > Profiles > Keys
#   → "Natural Text Editing" preset (Option+arrow for word navigation)
# Preferences > Profiles > Terminal
#   → Scrollback lines: 10000
# Preferences > Profiles > Session
#   → "Status bar enabled" ON (displays CPU, memory, etc.)

# ── WezTerm ──
# GPU acceleration, Lua configuration, built-in multiplexer
# https://wezfurlong.org/wezterm/
# brew install --cask wezterm

# ~/.wezterm.lua
# local wezterm = require 'wezterm'
# return {
#   font = wezterm.font("JetBrains Mono"),
#   font_size = 14.0,
#   color_scheme = "Catppuccin Mocha",
#   enable_tab_bar = true,
#   window_background_opacity = 0.95,
#   keys = {
#     { key = "d", mods = "CMD", action = wezterm.action.SplitHorizontal },
#     { key = "d", mods = "CMD|SHIFT", action = wezterm.action.SplitVertical },
#   },
# }

# ── Alacritty ──
# GPU acceleration, fast, minimal features
# https://alacritty.org/
# brew install --cask alacritty

# ~/.config/alacritty/alacritty.toml
# [font]
# size = 14.0
# [font.normal]
# family = "JetBrains Mono"
# [window]
# opacity = 0.95
# [colors]
# # Catppuccin Mocha theme

# ── kitty ──
# GPU acceleration, image display support, tiling
# https://sw.kovidgoyal.net/kitty/
# brew install --cask kitty

# ~/.config/kitty/kitty.conf
# font_family JetBrains Mono
# font_size 14.0
# background_opacity 0.95
# enable_audio_bell no
# tab_bar_style powerline
# map cmd+d new_window_with_cwd
```

### 7.2 Fonts

```bash
# ── Nerd Fonts (programming fonts + icons) ──
# https://www.nerdfonts.com/

# Install via Homebrew
brew install --cask font-jetbrains-mono-nerd-font
brew install --cask font-fira-code-nerd-font
brew install --cask font-hack-nerd-font
brew install --cask font-meslo-lg-nerd-font
brew install --cask font-cascadia-code-nerd-font

# Popular fonts:
# - JetBrains Mono Nerd Font — well-balanced programming font
# - Fira Code Nerd Font — supports ligatures
# - Hack Nerd Font — prioritizes readability
# - MesloLGS NF — recommended for Powerlevel10k
# - CaskaydiaCove Nerd Font — popular in Windows Terminal

# Select these in the terminal font settings
# Required for icon display (eza --icons, Starship, etc.)
```

---

## 8. Speeding Up Text Processing

### 8.1 Pipeline Patterns

```bash
# ── Common pipeline patterns ──

# Extract error lines from log and count occurrences
rg "ERROR" /var/log/app.log | awk '{print $4}' | sort | uniq -c | sort -rn

# Aggregate a specific column in CSV
awk -F',' '{sum += $3} END {print sum}' data.csv

# Extract specific fields from a JSON array
jq '.[] | .name' data.json

# Remove duplicate lines (preserving order)
awk '!seen[$0]++' file.txt

# Show N lines before and after a pattern
rg -C 3 "pattern" file.txt

# Display file diff in a readable way
diff <(sort file1.txt) <(sort file2.txt) | bat -l diff

# ── Using xargs ──
# Process files in parallel
fd -e py | xargs -P 4 -I{} python -m py_compile {}

# NULL-delimited (safe when filenames contain spaces)
fd -0 -e py | xargs -0 wc -l

# Run with confirmation
fd -e tmp | xargs -p rm

# ── Process substitution ──
# Compare output of two commands
diff <(curl -s url1) <(curl -s url2)

# Merge and sort multiple logs
sort -m <(sort log1.txt) <(sort log2.txt) <(sort log3.txt)

# ── Using tee ──
# Save output to file while also displaying on screen
npm run build 2>&1 | tee build.log

# Output to multiple files simultaneously
echo "test" | tee file1.txt file2.txt file3.txt
```

### 8.2 One-Liner Collection

```bash
# ── File operations ──
# Find empty files
fd -t f --exec sh -c '[ ! -s {} ] && echo {}'

# Recently modified files (last 1 hour)
fd --changed-within 1h

# Bulk rename files
# file_001.txt → file-001.txt (rename command)
rename 's/_/-/g' *.txt

# Bulk change extensions
fd -e txt --exec mv {} {.}.md

# ── Text processing ──
# Add line numbers
nl -ba file.txt

# Extract specific lines (lines 10-20)
sed -n '10,20p' file.txt

# Reverse line order
tac file.txt

# Display a random line
shuf -n 1 file.txt

# Swap columns
awk '{print $2, $1}' file.txt

# Convert tab-delimited to comma-delimited
tr '\t' ',' < input.tsv > output.csv

# ── Network ──
# Kill process on a specific port
lsof -ti :3000 | xargs kill -9

# Show all listening ports
lsof -iTCP -sTCP:LISTEN -n -P

# DNS lookup
dig +short example.com

# Show HTTP response headers only
curl -sI https://example.com

# ── Git one-liners ──
# Commit count per author
git shortlog -sn --all

# Ranking of most-changed files
git log --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20

# Today's commits
git log --since="midnight" --oneline

# Branch list with last commit date
git branch -a --sort=-committerdate --format='%(committerdate:short) %(refname:short)'
```

---

## 9. Shell Script Snippet Collection

### 9.1 Automating Daily Tasks

```bash
# ── Project initialization ──
init-project() {
    local name="$1"
    local type="${2:-node}"

    mkdir -p "$name" && cd "$name" || return

    git init
    echo "node_modules/" > .gitignore
    echo ".env" >> .gitignore
    echo "*.log" >> .gitignore

    case "$type" in
        node)
            npm init -y
            echo "# $name" > README.md
            mkdir -p src tests
            ;;
        python)
            python3 -m venv .venv
            echo ".venv/" >> .gitignore
            echo "__pycache__/" >> .gitignore
            echo "# $name" > README.md
            mkdir -p src tests
            touch src/__init__.py tests/__init__.py
            cat > requirements.txt << 'REQS'
pytest>=7.0
black>=23.0
ruff>=0.1.0
REQS
            ;;
        rust)
            cargo init
            ;;
    esac

    git add -A
    git commit -m "Initial commit"
    echo "Project '$name' ($type) initialized!"
}

# ── Disk usage report ──
disk-report() {
    echo "=== Disk Usage Report ==="
    echo "Date: $(date)"
    echo ""
    echo "--- Top 10 directories ---"
    du -h --max-depth=1 "${1:-.}" 2>/dev/null | sort -rh | head -10
    echo ""
    echo "--- Large files (>100MB) ---"
    fd -t f --size +100m "${1:-.}" 2>/dev/null
    echo ""
    echo "--- Disk space ---"
    df -h "${1:-.}"
}

# ── Periodic backup ──
backup-dir() {
    local src="${1:?Source directory required}"
    local dst="${2:-$HOME/backups}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local name=$(basename "$src")
    local archive="$dst/${name}_${timestamp}.tar.gz"

    mkdir -p "$dst"
    tar czf "$archive" -C "$(dirname "$src")" "$name"
    echo "Backup created: $archive ($(du -h "$archive" | cut -f1))"

    # Delete backups older than 30 days
    find "$dst" -name "${name}_*.tar.gz" -mtime +30 -delete
    echo "Old backups cleaned up."
}

# ── Development environment health check ──
dev-check() {
    echo "=== Development Environment Check ==="
    echo ""

    local tools=(
        "git:git --version"
        "node:node --version"
        "npm:npm --version"
        "python3:python3 --version"
        "docker:docker --version"
        "kubectl:kubectl version --client --short 2>/dev/null"
        "fzf:fzf --version"
        "rg:rg --version | head -1"
        "fd:fd --version"
        "bat:bat --version | head -1"
        "eza:eza --version | head -1"
    )

    for item in "${tools[@]}"; do
        local name="${item%%:*}"
        local cmd="${item##*:}"
        if command -v "$name" &>/dev/null; then
            local version=$(eval "$cmd" 2>/dev/null)
            printf "  %-12s %s\n" "$name" "$version"
        else
            printf "  %-12s %s\n" "$name" "(not installed)"
        fi
    done
}
```

### 9.2 Data Processing Utilities

```bash
# ── CSV processing ──

# Show CSV column names (header row)
csv-header() {
    head -1 "$1" | tr ',' '\n' | nl
}

# Extract a specific CSV column
csv-col() {
    local file="$1"
    local col="$2"
    awk -F',' -v c="$col" '{print $c}' "$file"
}

# Display CSV in formatted view
csv-view() {
    column -s',' -t < "$1" | less -S
}

# ── JSON processing ──

# Pretty-print JSON and display with bat
json-view() {
    if [ -f "$1" ]; then
        jq '.' "$1" | bat -l json
    else
        curl -s "$1" | jq '.' | bat -l json
    fi
}

# List key paths in JSON
json-paths() {
    jq -r 'paths(scalars) | map(tostring) | join(".")' "$1"
}

# ── Log analysis ──

# Count status codes in access log
log-status() {
    awk '{print $9}' "$1" | sort | uniq -c | sort -rn
}

# Top IPs in access log
log-top-ip() {
    awk '{print $1}' "$1" | sort | uniq -c | sort -rn | head -${2:-10}
}

# Pattern analysis of error logs
log-errors() {
    rg -c "ERROR|FATAL|CRITICAL" "$1"
    echo "---"
    rg "ERROR|FATAL|CRITICAL" "$1" | awk '{$1=$2=$3=""; print}' | sort | uniq -c | sort -rn | head -20
}
```

---

## 10. Productivity Settings per Environment

### 10.1 macOS-Specific Settings

```bash
# ── macOS default settings (change from CLI) ──

# Show hidden files in Finder
defaults write com.apple.finder AppleShowAllFiles -bool true

# Auto-hide Dock
defaults write com.apple.dock autohide -bool true

# Speed up key repeat
defaults write NSGlobalDomain KeyRepeat -int 1
defaults write NSGlobalDomain InitialKeyRepeat -int 10

# Screenshot save location
defaults write com.apple.screencapture location "$HOME/Screenshots"

# Don't create .DS_Store on network drives
defaults write com.apple.desktopservices DSDontWriteNetworkStores true

# ── macOS-specific commands ──
# Clipboard
echo "text" | pbcopy              # Copy to clipboard
pbpaste                           # Paste from clipboard
pbpaste | wc -l                   # Count lines in clipboard

# Notifications
osascript -e 'display notification "Hello" with title "Terminal"'

# Open files
open .                            # Open current directory in Finder
open -a "Visual Studio Code" .    # Open in VSCode
open https://example.com          # Open URL in browser

# Spotlight search
mdfind "query"                    # Spotlight search
mdfind -name "filename"           # Search by filename
mdfind -onlyin ~/projects "TODO"  # Search in specific directory

# Eject disk
diskutil eject /dev/disk2

# Wi-Fi
networksetup -getairportnetwork en0        # Connected Wi-Fi
networksetup -setairportpower en0 off      # Wi-Fi OFF
networksetup -setairportpower en0 on       # Wi-Fi ON
```

### 10.2 Improving Efficiency on Remote Servers

```bash
# ── SSH configuration optimization ──
# ~/.ssh/config

# Settings for all hosts
# Host *
#     ServerAliveInterval 60
#     ServerAliveCountMax 3
#     AddKeysToAgent yes
#     IdentityFile ~/.ssh/id_ed25519
#     Compression yes

# ── Aliases for frequently used servers ──
# Host web
#     HostName web.example.com
#     User deploy
#     Port 22
#     ForwardAgent yes

# Host db
#     HostName db.example.com
#     User admin
#     LocalForward 5432 localhost:5432

# ── Speeding up SSH connections ──
# Host *
#     ControlMaster auto
#     ControlPath ~/.ssh/sockets/%r@%h-%p
#     ControlPersist 600

mkdir -p ~/.ssh/sockets

# ── Useful scripts for remote work ──

# Check remote server status
server-check() {
    local host="$1"
    echo "=== $host ==="
    ssh "$host" '
        echo "Hostname: $(hostname)"
        echo "Uptime: $(uptime)"
        echo "Disk: $(df -h / | tail -1)"
        echo "Memory: $(free -h | grep Mem | awk "{print \$3\"/\"\$2}")"
        echo "Load: $(cat /proc/loadavg)"
        echo "Docker: $(docker ps -q 2>/dev/null | wc -l) containers"
    '
}

# Edit a remote file with a local editor
remote-edit() {
    local host="$1"
    local file="$2"
    local tmp="/tmp/remote-edit-$(basename "$file")"
    scp "$host:$file" "$tmp"
    ${EDITOR:-vim} "$tmp"
    scp "$tmp" "$host:$file"
    rm -f "$tmp"
}

# Run a remote command on all servers in parallel
parallel-ssh() {
    local cmd="$1"
    shift
    for host in "$@"; do
        echo "--- $host ---"
        ssh "$host" "$cmd" &
    done
    wait
}
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend fully understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Tool | Replaces | Improvements |
|------|----------|--------------|
| fzf | Manual search | Interactive fuzzy search |
| zoxide | cd | Smart navigation using visit history |
| bat | cat | Syntax highlighting |
| eza | ls | Color, Git, icons |
| fd | find | Fast and intuitive |
| ripgrep | grep | Fast, respects .gitignore |
| starship | PS1 | Information-rich prompt |
| delta | diff | Diff with syntax highlighting |
| sd | sed | Intuitive string substitution |
| dust | du | Disk usage visualization |
| procs | ps | Color display, tree view |
| bottom | top | Interactive monitor |
| hyperfine | time | Statistical benchmarking |
| tokei | cloc | Fast code line counting |
| glow | - | Terminal Markdown rendering |
| difftastic | diff | AST-based structural diff |

---

## What to Read Next

---

## References
1. Barrett, D. "Efficient Linux at the Command Line." O'Reilly, 2022.
2. "Modern Unix." github.com/ibraheemdev/modern-unix.
3. "The Art of Command Line." github.com/jlevy/the-art-of-command-line.
4. "Awesome Shell." github.com/alebcay/awesome-shell.
5. "fzf examples." github.com/junegunn/fzf/wiki/examples.
6. "Starship documentation." starship.rs/config/.
