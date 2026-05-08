# Shell Configuration

> Customizing your shell configuration can dramatically improve productivity. Growing your configuration files is equivalent to building the ultimate development environment tailored specifically for you.

## What You Will Learn

- [ ] Understand the role of .bashrc / .zshrc
- [ ] Know the loading order of configuration files
- [ ] Configure aliases and environment variables
- [ ] Automate complex tasks with shell functions
- [ ] Know how to customize the prompt
- [ ] Make full use of completion features
- [ ] Optimize history management
- [ ] Install and configure modern shell tools
- [ ] Know how to sync configuration across multiple machines
- [ ] Learn troubleshooting techniques


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Terminal and Shell Basics](./00-terminal-basics.md)

---

## 1. Configuration File Loading Order

To properly manage shell configuration, it is essential to understand when and in what order configuration files are loaded.

### 1.1 bash Configuration Files

```
bash loading order:

■ Login shell (when terminal starts, SSH connection):
  /etc/profile
  → ~/.bash_profile  (if it exists)
  → ~/.bash_login    (if .bash_profile does not exist)
  → ~/.profile       (if neither of the above exist)

■ Non-login shell (new terminal tab, when running bash command):
  ~/.bashrc

■ On logout:
  ~/.bash_logout

Important points:
  - .bashrc is not automatically read in a login shell
  - Common workaround: source .bashrc from within .bash_profile
```

```bash
# ~/.bash_profile recommended configuration
# Allows login shells to use .bashrc settings too

# Load .bashrc if it exists
if [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi

# Login shell-specific settings (environment variables, etc.)
export PATH="$HOME/.local/bin:$PATH"
export EDITOR="vim"
export VISUAL="vim"
export LANG="ja_JP.UTF-8"
export LC_ALL="ja_JP.UTF-8"
```

### 1.2 zsh Configuration Files

```
zsh loading order (executed in numbered order):

■ Always read:
  1. /etc/zshenv
  2. ~/.zshenv

■ For login shells (additionally read):
  3. /etc/zprofile
  4. ~/.zprofile

■ For interactive shells (additionally read):
  5. /etc/zshrc
  6. ~/.zshrc

■ For login shells (additionally read):
  7. /etc/zlogin
  8. ~/.zlogin

■ On logout:
  ~/.zlogout
  /etc/zlogout

Practical usage guide:
  ~/.zshenv    → Environment variables (PATH, EDITOR)
                 * Note: read even in non-interactive shells
  ~/.zprofile  → Login shell-specific processing
  ~/.zshrc     → Aliases, functions, completion settings, prompt settings
                 * The place where most settings are written
  ~/.zlogin    → Login-time display messages, etc.
  ~/.zlogout   → Cleanup on logout
```

### 1.3 Configuration File Usage Guide

```bash
# ============================================
# ~/.zshenv — Environment variables (always read)
# ============================================
# Note: This file is read by all zsh processes,
#       so do not write commands that produce output

export EDITOR="vim"
export VISUAL="vim"
export PAGER="less"
export LANG="ja_JP.UTF-8"

# XDG Base Directory
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_STATE_HOME="$HOME/.local/state"

# PATH configuration
typeset -U path  # Automatically remove duplicates (zsh-specific feature)
path=(
    "$HOME/.local/bin"
    "$HOME/.cargo/bin"
    "$HOME/go/bin"
    "/usr/local/bin"
    $path
)
export PATH
```

```bash
# ============================================
# ~/.zshrc — Interactive shell settings
# ============================================
# Write aliases, functions, completion, prompt, etc. here

# === Aliases ===
alias ll='ls -lah'
alias la='ls -A'
# ... (see detailed sections below)

# === Completion settings ===
autoload -Uz compinit && compinit
# ... (see below)

# === History settings ===
HISTSIZE=100000
SAVEHIST=100000
# ... (see below)
```

### 1.4 Debugging the Loading Order

```bash
# How to check which files are being read

# Method 1: Add echo to the top of each config file
# Add to ~/.zshenv:
echo "Loading .zshenv"

# Add to ~/.zshrc:
echo "Loading .zshrc"

# Method 2: zsh startup trace
zsh -x 2>&1 | head -50

# Method 3: zsh file loading trace
# Enable SOURCE_TRACE
zsh -o SOURCE_TRACE

# Method 4: bash debug mode
bash -x --login 2>&1 | head -50

# How to apply configuration changes
source ~/.zshrc            # Apply to current shell (reload)
exec zsh                   # Restart shell (cleaner)
exec bash                  # For bash

# Measure time taken to load configuration files
time zsh -i -c exit        # zsh startup time
time bash -i -c exit       # bash startup time

# Profiling configuration files (zsh)
# Add to the top of ~/.zshrc:
zmodload zsh/zprof
# Add to the bottom of ~/.zshrc:
zprof

# This allows you to visualize which processes take the most time
```

---

## 2. Environment Variables

### 2.1 Basic Environment Variables

```bash
# ============================================
# Basic environment variable settings
# ============================================

# Default editor
export EDITOR="vim"                    # CUI editor
export VISUAL="code"                   # GUI editor (used for git commit, etc.)

# Locale settings
export LANG="ja_JP.UTF-8"            # Japanese UTF-8
export LC_ALL="ja_JP.UTF-8"          # Locale for all categories
export LC_COLLATE="C"                 # Sort order follows ASCII (affects ls, etc.)

# Pager settings
export PAGER="less"
export LESS="-iMRSX"
# -i: Case-insensitive search with lowercase
# -M: Detailed prompt display
# -R: Interpret ANSI color codes
# -S: Do not wrap long lines
# -X: Do not clear screen on exit

# Colored display for man pages
export LESS_TERMCAP_mb=$'\e[1;31m'     # Blink start
export LESS_TERMCAP_md=$'\e[1;36m'     # Bold start (cyan)
export LESS_TERMCAP_me=$'\e[0m'        # Blink/bold end
export LESS_TERMCAP_so=$'\e[01;33m'    # Status line start (yellow)
export LESS_TERMCAP_se=$'\e[0m'        # Status line end
export LESS_TERMCAP_us=$'\e[1;32m'     # Underline start (green)
export LESS_TERMCAP_ue=$'\e[0m'        # Underline end

# History related
export HISTTIMEFORMAT="%F %T "         # Add timestamps to history (bash)

# GPG settings (used for git signing, etc.)
export GPG_TTY=$(tty)
```

### 2.2 Managing PATH

```bash
# ============================================
# Managing PATH
# ============================================

# Basic PATH addition
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/bin:$PATH"

# Language/framework-specific PATH

# Homebrew (macOS)
eval "$(/opt/homebrew/bin/brew shellenv)"  # Apple Silicon Mac
# eval "$(/usr/local/bin/brew shellenv)"   # Intel Mac

# Node.js (nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && source "$NVM_DIR/bash_completion"

# Node.js (fnm) — faster alternative to nvm
eval "$(fnm env --use-on-cd)"

# Python (pyenv)
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

# Ruby (rbenv)
eval "$(rbenv init -)"

# Go
export GOPATH="$HOME/go"
export PATH="$GOPATH/bin:$PATH"

# Rust
source "$HOME/.cargo/env"

# Java (jenv)
export PATH="$HOME/.jenv/bin:$PATH"
eval "$(jenv init -)"

# Deno
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"

# Deduplication of PATH (zsh-specific)
typeset -U path

# Check PATH contents
echo $PATH | tr ':' '\n'              # Display PATH one line at a time
echo $PATH | tr ':' '\n' | nl        # Display with numbers

# Check location of a specific command
which python3                          # Path to command
type python3                           # More detailed information
where python3                          # All candidates (zsh)
```

### 2.3 Project-Specific Environment Variables

```bash
# ============================================
# Managing project-specific environment variables
# ============================================

# Directory-level environment variable management using direnv
# brew install direnv
eval "$(direnv hook zsh)"    # Add to ~/.zshrc

# Create .envrc in project root
# Example .envrc:
export DATABASE_URL="postgresql://localhost/myapp_dev"
export REDIS_URL="redis://localhost:6379"
export API_KEY="dev-api-key-12345"
export NODE_ENV="development"
export AWS_PROFILE="myproject-dev"

# Automatic language version switching with layout feature
layout python3              # Automatically create and activate Python venv
layout ruby                 # Automatically switch Ruby version
layout node                 # Automatically switch Node.js version

# How to use direnv
direnv allow                # Trust .envrc (required on first use or after changes)
direnv deny                 # Deny .envrc
direnv edit                 # Edit .envrc (auto allow on save)

# Environment variables are automatically set when entering a directory,
# and automatically unset when leaving

# Security for .envrc
# - .envrc is not executed until direnv allow is run
# - When managing with git, separate sensitive information into .env.local
# - Load .env.local inside .envrc:
dotenv_if_exists .env.local
```

---

## 3. Aliases

### 3.1 Basic Aliases

```bash
# ============================================
# Improving basic commands
# ============================================

# ls variants
alias ls='ls --color=auto'         # Color display (Linux)
alias ls='ls -G'                   # Color display (macOS)
alias ll='ls -lah'                 # Detailed display
alias la='ls -A'                   # Including hidden files
alias lt='ls -lahtr'               # Newest modification time first
alias lS='ls -lahS'                # Sort by size

# When modern alternative tools are available
if command -v eza &>/dev/null; then
    alias ls='eza --color=auto --icons'
    alias ll='eza -lah --icons --git'
    alias la='eza -a --icons'
    alias lt='eza -la --sort=modified --icons'
    alias tree='eza --tree --icons'
fi

if command -v bat &>/dev/null; then
    alias cat='bat --paging=never'
    alias catp='bat --plain'        # Plain mode
fi

if command -v fd &>/dev/null; then
    alias find='fd'
fi

# Directory navigation
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias -- -='cd -'                   # Go back to previous directory

# mkdir always creates nested directories
alias mkdir='mkdir -pv'

# grep with color display
alias grep='grep --color=auto'
alias egrep='egrep --color=auto'
alias fgrep='fgrep --color=auto'

# Safety guards for dangerous commands
alias rm='rm -i'                   # Delete with confirmation
alias cp='cp -i'                   # Copy with confirmation
alias mv='mv -i'                   # Move with confirmation
alias ln='ln -i'                   # Link with confirmation

# To disable safety guards
# \rm file.txt                     # Backslash ignores alias
# command rm file.txt              # Execute directly with command
```

### 3.2 Git Aliases

```bash
# ============================================
# Git aliases
# ============================================

# Basic operations
alias g='git'
alias gs='git status'
alias ga='git add'
alias gaa='git add --all'
alias gc='git commit'
alias gcm='git commit -m'
alias gca='git commit --amend'
alias gcan='git commit --amend --no-edit'
alias gp='git push'
alias gpf='git push --force-with-lease'   # Safe force push
alias gpl='git pull'
alias gplr='git pull --rebase'

# Branch operations
alias gb='git branch'
alias gba='git branch -a'
alias gbd='git branch -d'
alias gbD='git branch -D'
alias gco='git checkout'
alias gcb='git checkout -b'
alias gsw='git switch'
alias gswc='git switch -c'

# Diffs and logs
alias gd='git diff'
alias gds='git diff --staged'
alias gdn='git diff --name-only'
alias gl='git log --oneline --graph --decorate -20'
alias gla='git log --oneline --graph --decorate --all'
alias glp='git log --pretty=format:"%C(yellow)%h%C(reset) %C(green)(%cr)%C(reset) %s %C(blue)<%an>%C(reset)" --abbrev-commit'

# Stash
alias gst='git stash'
alias gstl='git stash list'
alias gstp='git stash pop'
alias gsta='git stash apply'
alias gstd='git stash drop'

# Remote
alias gf='git fetch --all --prune'
alias grb='git rebase'
alias grbc='git rebase --continue'
alias grba='git rebase --abort'

# Reset
alias grs='git reset --soft HEAD~1'      # Undo last commit (keep changes)
alias grh='git reset --hard HEAD~1'       # Completely undo last commit

# cherry-pick
alias gcp='git cherry-pick'
alias gcpc='git cherry-pick --continue'
alias gcpa='git cherry-pick --abort'

# Cleanup
alias gclean='git clean -fd'
alias gprune='git remote prune origin'
```

### 3.3 Docker Aliases

```bash
# ============================================
# Docker aliases
# ============================================

alias d='docker'
alias dc='docker compose'
alias dcu='docker compose up -d'
alias dcd='docker compose down'
alias dcr='docker compose restart'
alias dcl='docker compose logs -f'
alias dce='docker compose exec'
alias dcb='docker compose build --no-cache'

alias dps='docker ps'
alias dpsa='docker ps -a'
alias di='docker images'
alias drm='docker rm'
alias drmi='docker rmi'
alias dex='docker exec -it'
alias dlogs='docker logs -f'

# Docker cleanup
alias dprune='docker system prune -af'
alias dvprune='docker volume prune -f'
alias diprune='docker image prune -af'
```

### 3.4 Kubernetes Aliases

```bash
# ============================================
# Kubernetes aliases
# ============================================

alias k='kubectl'
alias kgp='kubectl get pods'
alias kgs='kubectl get services'
alias kgd='kubectl get deployments'
alias kgn='kubectl get nodes'
alias kga='kubectl get all'
alias kaf='kubectl apply -f'
alias kdf='kubectl delete -f'
alias kdp='kubectl describe pod'
alias kds='kubectl describe service'
alias kdd='kubectl describe deployment'
alias kl='kubectl logs -f'
alias kex='kubectl exec -it'
alias kctx='kubectl config use-context'
alias kns='kubectl config set-context --current --namespace'

# If kubectx / kubens are installed
# alias kctx='kubectx'
# alias kns='kubens'
```

### 3.5 Other Practical Aliases

```bash
# ============================================
# Network
# ============================================
alias myip='curl -s ifconfig.me'
alias localip='ipconfig getifaddr en0'    # macOS
alias ports='netstat -tulanp'              # Ports in use
alias ports='lsof -i -P -n | grep LISTEN' # macOS

# ============================================
# System information
# ============================================
alias df='df -h'                     # Disk usage (human-readable)
alias du='du -h'                     # Directory size
alias free='free -h'                 # Memory usage (Linux)
alias top='htop'                     # Use htop if available
alias psg='ps aux | grep -v grep | grep'  # Process search

# ============================================
# File operations
# ============================================
alias tarx='tar -xvf'               # Extract
alias tarc='tar -czvf'              # Compress
alias dush='du -sh * | sort -rh'    # Display directories sorted by size
alias count='find . -type f | wc -l'  # Count files

# ============================================
# Development
# ============================================
alias py='python3'
alias pip='pip3'
alias serve='python3 -m http.server 8000'  # Simple HTTP server
alias json='python3 -m json.tool'          # JSON formatting

# ============================================
# Clipboard (macOS)
# ============================================
alias pbp='pbpaste'
alias pbc='pbcopy'
alias copy='pbcopy'
alias paste='pbpaste'

# ============================================
# Timestamps
# ============================================
alias now='date +"%Y-%m-%d %H:%M:%S"'
alias timestamp='date +%s'
alias week='date +%V'
```

### 3.6 Global Aliases (zsh only)

```bash
# ============================================
# Global aliases (expanded even in the middle of a command)
# ============================================

# Pipe abbreviations
alias -g G='| grep'
alias -g L='| less'
alias -g H='| head'
alias -g T='| tail'
alias -g S='| sort'
alias -g U='| uniq'
alias -g W='| wc -l'
alias -g C='| pbcopy'          # macOS clipboard
alias -g J='| jq .'           # JSON formatting
alias -g N='> /dev/null 2>&1' # Discard output

# Usage examples:
# ps aux G nginx           → ps aux | grep nginx
# cat file.txt L           → cat file.txt | less
# ls -la S                 → ls -la | sort
# curl api.example.com J   → curl api.example.com | jq .

# Suffix aliases (automatically select command by file extension)
alias -s md='code'             # Open .md files with code
alias -s json='code'           # Open .json files with code
alias -s py='python3'          # Execute .py files with python3
alias -s sh='bash'             # Execute .sh files with bash
alias -s txt='less'            # Display .txt files with less
alias -s log='less'            # Display .log files with less

# Usage examples:
# README.md                → code README.md
# script.py                → python3 script.py
```

---

## 4. Shell Functions

### 4.1 Basic Shell Functions

```bash
# ============================================
# Create directory and move into it
# ============================================
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# ============================================
# Create a backup of a file
# ============================================
bak() {
    local file="$1"
    if [ -z "$file" ]; then
        echo "Usage: bak <file>"
        return 1
    fi
    cp -a "$file" "${file}.bak.$(date +%Y%m%d_%H%M%S)"
    echo "Backed up: ${file}.bak.$(date +%Y%m%d_%H%M%S)"
}

# ============================================
# Extract archives (auto-detect format)
# ============================================
extract() {
    if [ -f "$1" ]; then
        case "$1" in
            *.tar.bz2)   tar xjf "$1"    ;;
            *.tar.gz)    tar xzf "$1"    ;;
            *.tar.xz)    tar xJf "$1"    ;;
            *.tar.zst)   tar --zstd -xf "$1" ;;
            *.bz2)       bunzip2 "$1"    ;;
            *.rar)       unrar x "$1"    ;;
            *.gz)        gunzip "$1"     ;;
            *.tar)       tar xf "$1"     ;;
            *.tbz2)      tar xjf "$1"    ;;
            *.tgz)       tar xzf "$1"    ;;
            *.zip)       unzip "$1"      ;;
            *.Z)         uncompress "$1" ;;
            *.7z)        7z x "$1"       ;;
            *.xz)        unxz "$1"       ;;
            *.zst)       unzstd "$1"     ;;
            *)           echo "'$1' cannot be extracted via extract()" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}

# ============================================
# Check what is running on a specified port
# ============================================
port() {
    lsof -i :"$1"
}

# ============================================
# Kill the process on a specific port
# ============================================
killport() {
    local port="$1"
    if [ -z "$port" ]; then
        echo "Usage: killport <port>"
        return 1
    fi
    local pid=$(lsof -ti :"$port")
    if [ -n "$pid" ]; then
        echo "Killing process $pid on port $port"
        kill -9 "$pid"
    else
        echo "No process found on port $port"
    fi
}

# ============================================
# Display directory size in a readable format
# ============================================
dirsize() {
    du -sh "${1:-.}"/* 2>/dev/null | sort -rh | head -20
}

# ============================================
# Useful Git-related functions
# ============================================

# Create a new branch and push it
gnew() {
    git checkout -b "$1" && git push -u origin "$1"
}

# Add all and commit with a message
gac() {
    git add --all && git commit -m "$*"
}

# Search recent commit log with fzf and checkout
gshow() {
    local commit
    commit=$(git log --oneline --graph --decorate --all | fzf --preview 'git show {2}' | awk '{print $2}')
    [ -n "$commit" ] && git show "$commit"
}

# Select a branch with fzf and switch to it
fbr() {
    local branch
    branch=$(git branch -a | sed 's/^\*//' | sed 's/^ *//' | fzf --preview 'git log --oneline --graph -20 {}')
    [ -n "$branch" ] && git checkout "$branch"
}

# ============================================
# Search functions using fzf
# ============================================

# Search for files with fzf and open in editor
fe() {
    local file
    file=$(fzf --preview 'bat --color=always --line-range :100 {}' --preview-window=right:60%)
    [ -n "$file" ] && ${EDITOR:-vim} "$file"
}

# Search for directories with fzf and cd
fcd() {
    local dir
    dir=$(find . -type d -not -path '*/\.*' 2>/dev/null | fzf --preview 'ls -la {}')
    [ -n "$dir" ] && cd "$dir"
}

# Search command history with fzf
fh() {
    local cmd
    cmd=$(history | sort -rn | awk '{$1=""; print $0}' | sed 's/^ //' | sort -u | fzf)
    [ -n "$cmd" ] && eval "$cmd"
}

# Search processes with fzf and kill
fkill() {
    local pid
    pid=$(ps aux | sed 1d | fzf -m --header='Select process to kill' | awk '{print $2}')
    [ -n "$pid" ] && echo "$pid" | xargs kill -9
}

# ============================================
# Network-related
# ============================================

# Check HTTP status code
httpstatus() {
    curl -o /dev/null -s -w "%{http_code}\n" "$1"
}

# Check SSL certificate expiry
sslexpiry() {
    echo | openssl s_client -connect "$1":443 -servername "$1" 2>/dev/null | openssl x509 -noout -enddate
}

# Display DNS information in a readable format
dns() {
    echo "--- A Record ---"
    dig +short "$1" A
    echo "--- AAAA Record ---"
    dig +short "$1" AAAA
    echo "--- MX Record ---"
    dig +short "$1" MX
    echo "--- NS Record ---"
    dig +short "$1" NS
    echo "--- TXT Record ---"
    dig +short "$1" TXT
}

# ============================================
# Calculation functions
# ============================================
calc() {
    echo "scale=4; $*" | bc -l
}

# Display file size in human-readable format
fsize() {
    if [ -f "$1" ]; then
        ls -lh "$1" | awk '{print $5, $9}'
    else
        echo "File not found: $1"
    fi
}

# ============================================
# Development-related
# ============================================

# Initialize a Node.js project
node-init() {
    mkdir -p "$1" && cd "$1"
    npm init -y
    echo "node_modules/" > .gitignore
    echo "dist/" >> .gitignore
    echo ".env" >> .gitignore
    git init
    echo "Project '$1' initialized"
}

# Enter a Docker container
denter() {
    docker exec -it "$1" /bin/sh -c "if command -v bash > /dev/null; then bash; else sh; fi"
}

# ============================================
# Text processing
# ============================================

# Base64 encode/decode a string
b64e() { echo -n "$1" | base64; }
b64d() { echo -n "$1" | base64 --decode; echo; }

# URL encode/decode
urlencode() { python3 -c "import urllib.parse; print(urllib.parse.quote('$1'))"; }
urldecode() { python3 -c "import urllib.parse; print(urllib.parse.unquote('$1'))"; }

# Generate a UUID
uuid() { python3 -c "import uuid; print(uuid.uuid4())"; }

# Generate a random password
genpass() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -d '/+=' | cut -c1-"$length"
}
```

---

## 5. Prompt Customization

### 5.1 bash Prompt

```bash
# ============================================
# bash prompt basics
# ============================================

# PS1 special characters
# \u: Username
# \h: Hostname (short)
# \H: Hostname (full)
# \w: Current directory (full path)
# \W: Current directory (basename only)
# \d: Date
# \t: Time (24-hour HH:MM:SS)
# \T: Time (12-hour HH:MM:SS)
# \@: Time (12-hour AM/PM)
# \n: Newline
# \$: # for root, $ for regular user
# \!: History number
# \#: Command number
# \[...\]: Wraps non-printing characters (excluded from prompt length calculation)

# Simple prompt
export PS1='\u@\h:\w\$ '

# Prompt with color
export PS1='\[\e[1;32m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
# Green username@hostname, blue directory

# Prompt with Git branch display
parse_git_branch() {
    git branch 2>/dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/ (\1)/'
}

parse_git_status() {
    local status=$(git status --porcelain 2>/dev/null)
    if [ -n "$status" ]; then
        echo "*"  # Uncommitted changes exist
    fi
}

export PS1='\[\e[1;32m\]\u\[\e[0m\]:\[\e[1;34m\]\w\[\e[0;33m\]$(parse_git_branch)$(parse_git_status)\[\e[0m\]\$ '

# Multi-line prompt (when there is a lot of information)
export PS1='\n\[\e[1;32m\]\u@\h\[\e[0m\] \[\e[1;34m\]\w\[\e[0;33m\]$(parse_git_branch)\[\e[0m\]\n\$ '

# PS2: Continuation line prompt
export PS2='> '

# PS4: Debug prompt (when using set -x)
export PS4='+ ${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
```

### 5.2 zsh Prompt

```bash
# ============================================
# zsh prompt basics
# ============================================

# zsh prompt variables
# %n: Username
# %m: Hostname (short)
# %M: Hostname (full)
# %~: Current directory (~ abbreviated)
# %/: Current directory (full path)
# %d: Date
# %T: Time (HH:MM)
# %*: Time (HH:MM:SS)
# %#: # for root, % for regular user
# %?: Exit code of the previous command
# %F{color}...%f: Foreground color
# %B...%b: Bold
# %U...%u: Underline

# Simple prompt
PROMPT='%n@%m:%~%# '

# Prompt with color
PROMPT='%F{green}%n%f@%F{blue}%m%f:%F{yellow}%~%f %# '

# Display Git information (vcs_info)
autoload -Uz vcs_info
precmd_vcs_info() { vcs_info }
precmd_functions+=( precmd_vcs_info )
setopt prompt_subst

zstyle ':vcs_info:*' enable git
zstyle ':vcs_info:*' formats ' %F{magenta}(%b)%f'
zstyle ':vcs_info:*' actionformats ' %F{magenta}(%b|%a)%f'
zstyle ':vcs_info:git:*' check-for-changes true
zstyle ':vcs_info:git:*' stagedstr '%F{green}+%f'
zstyle ':vcs_info:git:*' unstagedstr '%F{red}*%f'
zstyle ':vcs_info:git:*' formats ' %F{magenta}(%b%c%u)%f'

PROMPT='%F{green}%n%f:%F{blue}%~%f${vcs_info_msg_0_} %# '

# Right-side prompt (RPROMPT)
RPROMPT='%F{gray}%*%f'                   # Display time on the right
RPROMPT='%(?..%F{red}[%?]%f) %F{gray}%*%f'  # Also display exit code on error

# Hide RPROMPT when command is executed
setopt TRANSIENT_RPROMPT
```

### 5.3 Starship (Modern Prompt)

```bash
# ============================================
# Starship installation and configuration
# ============================================

# Installation
brew install starship            # macOS
# curl -sS https://starship.rs/install.sh | sh   # Linux

# Add settings to shell
# Add to ~/.zshrc:
eval "$(starship init zsh)"

# Add to ~/.bashrc:
eval "$(starship init bash)"

# Starship configuration file: ~/.config/starship.toml
```

```toml
# ~/.config/starship.toml

# Overall prompt format
format = """
$username\
$hostname\
$directory\
$git_branch\
$git_status\
$python\
$nodejs\
$rust\
$golang\
$docker_context\
$kubernetes\
$aws\
$line_break\
$character"""

# Directory settings
[directory]
truncation_length = 5
truncate_to_repo = true
style = "bold blue"
format = "$path$read_only "

# Git branch
[git_branch]
symbol = " "
style = "bold purple"
format = "on $symbol$branch "

# Git status
[git_status]
conflicted = "="
ahead = "⇡${count}"
behind = "⇣${count}"
diverged = "⇕⇡${ahead_count}⇣${behind_count}"
untracked = "?${count}"
stashed = "$${count}"
modified = "!${count}"
staged = "+${count}"
renamed = "»${count}"
deleted = "✘${count}"
format = '($all_status$ahead_behind )'

# Prompt character
[character]
success_symbol = "❯"
error_symbol = "❯"

# Python
[python]
symbol = " "
format = 'via [${symbol}${pyenv_prefix}(${version} )(\($virtualenv\) )]($style)'

# Node.js
[nodejs]
symbol = " "
format = "via $symbol($version )"

# Docker
[docker_context]
symbol = " "
format = "via $symbol$context "

# Kubernetes
[kubernetes]
disabled = false
symbol = "☸ "
format = '$symbol$context( \($namespace\)) '

# AWS
[aws]
symbol = " "
format = '$symbol($profile )(\($region\) )'

# Execution time
[cmd_duration]
min_time = 2_000          # Display for commands taking 2 seconds or more
format = "took $duration "
```

### 5.4 Oh My Zsh

```bash
# ============================================
# Oh My Zsh installation and configuration
# ============================================

# Installation
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Configuration in ~/.zshrc
export ZSH="$HOME/.oh-my-zsh"

# Theme settings
ZSH_THEME="robbyrussell"          # Default
# ZSH_THEME="agnoster"            # Popular theme
# ZSH_THEME="powerlevel10k/powerlevel10k"  # Feature-rich theme

# Plugin settings
plugins=(
    git                           # Git aliases and completion
    zsh-autosuggestions           # Suggestions while typing commands
    zsh-syntax-highlighting       # Syntax highlighting for commands
    docker                        # Docker completion
    docker-compose                # docker compose completion
    kubectl                       # kubectl completion
    aws                           # AWS CLI completion
    node                          # Node.js related
    npm                           # npm completion
    python                        # Python related
    pip                           # pip completion
    brew                          # Homebrew completion
    macos                         # macOS utilities
    fzf                           # fzf integration
    z                             # Fast directory navigation
    history-substring-search      # History substring search
    colored-man-pages             # Colored man pages
    extract                       # Extract various archives
    web-search                    # Web search from terminal
    copypath                      # Copy current path
    copybuffer                    # Copy current command line
    direnv                        # direnv integration
)

source $ZSH/oh-my-zsh.sh

# Installing additional plugins (Oh My Zsh custom plugins)
# git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM}/plugins/zsh-autosuggestions
# git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting
```

---

## 6. History Management

### 6.1 History Settings

```bash
# ============================================
# bash history settings
# ============================================
export HISTSIZE=100000               # Number of history entries in memory
export HISTFILESIZE=200000           # Number of history entries saved to file
export HISTFILE=~/.bash_history      # Path to history file
export HISTCONTROL=ignoreboth        # Ignore duplicates and lines starting with space
# ignoredups:   Ignore consecutive duplicates
# ignorespace:  Ignore commands starting with space
# ignoreboth:   Both of the above
# erasedups:    Remove duplicates from entire history

export HISTTIMEFORMAT="%F %T "       # With timestamps
export HISTIGNORE="ls:cd:pwd:exit:clear:history"  # Commands not recorded

shopt -s histappend                  # Append mode (do not overwrite)
shopt -s cmdhist                     # Save multi-line commands as one line

# Save history on each prompt display (supports multiple terminals)
PROMPT_COMMAND="history -a; history -c; history -r; $PROMPT_COMMAND"
```

```bash
# ============================================
# zsh history settings
# ============================================
HISTSIZE=100000                      # Number of history entries in memory
SAVEHIST=200000                      # Number of history entries saved to file
HISTFILE=~/.zsh_history              # Path to history file

# History options
setopt SHARE_HISTORY                 # Share history across multiple terminals
setopt HIST_IGNORE_DUPS              # Ignore consecutive duplicates
setopt HIST_IGNORE_ALL_DUPS          # Remove duplicates from entire history
setopt HIST_IGNORE_SPACE             # Ignore commands starting with space
setopt HIST_FIND_NO_DUPS             # Do not show duplicates when searching
setopt HIST_REDUCE_BLANKS            # Remove extra spaces
setopt HIST_VERIFY                   # Confirm before executing history expansion
setopt HIST_SAVE_NO_DUPS             # Remove duplicates when saving
setopt HIST_EXPIRE_DUPS_FIRST        # Delete duplicates first when over capacity
setopt INC_APPEND_HISTORY            # Save immediately after each command
setopt EXTENDED_HISTORY              # Record timestamps

# Pattern for commands to exclude from history
HISTORY_IGNORE="(ls|cd|pwd|exit|clear|history|bg|fg)"
```

### 6.2 History Usage Techniques

```bash
# ============================================
# Searching and reusing history
# ============================================

# Ctrl+R: Interactive reverse search (most frequently used)
# Start typing → show candidate → Ctrl+R for next candidate → Enter to execute

# History expansion
!!                    # Re-execute the previous command
!$                    # Last argument of the previous command
!^                    # First argument of the previous command
!*                    # All arguments of the previous command
!n                    # Command with history number n
!-n                   # Command n entries ago
!string               # Most recent command starting with string
!?string?             # Most recent command containing string

# Modifiers
!!:s/old/new          # Replace old→new in the previous command
^old^new              # Shorthand for the above

# Alt+. (Option+.): Insert the last argument of the previous command
# Press again to get the last argument of even earlier commands

# History management commands
history               # List history
history 20            # Last 20 entries
history -c            # Clear history (in memory)
history -w            # Write history to file
fc -l 1               # Show all history (zsh)
fc -l -20             # Last 20 entries (zsh)

# Advanced history search using fzf
# Ctrl+R is replaced by the fzf interface (when fzf is installed)
```

### 6.3 Preventing Sensitive Information from Being Recorded in History

```bash
# ============================================
# Security: Preventing sensitive information from being recorded in history
# ============================================

# Method 1: Add a space at the beginning of the command (when HIST_IGNORE_SPACE is enabled)
 export API_KEY="secret-key-12345"   # Leading space → not recorded in history

# Method 2: Load from an environment variable file
source ~/.env.secret

# Method 3: Use keychain/secret manager
# For macOS:
security find-generic-password -s "myapp" -w  # Retrieve from keychain

# Method 4: Exclude specific commands from history
HISTIGNORE="*secret*:*password*:*token*:*API_KEY*"

# History file permissions
chmod 600 ~/.zsh_history
chmod 600 ~/.bash_history
```

---

## 7. Completion Feature Configuration

### 7.1 zsh Completion Settings

```bash
# ============================================
# Detailed zsh completion settings
# ============================================

# Initialize the completion system
autoload -Uz compinit
compinit

# Completion cache (reduces startup time)
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "$XDG_CACHE_HOME/zsh/zcompcache"

# Case-insensitive completion
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|=*' 'l:|=* r:|=*'

# Enable completion menu
zstyle ':completion:*' menu select

# Group completion candidates
zstyle ':completion:*' group-name ''
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'
zstyle ':completion:*:corrections' format '%F{green}-- %d (errors: %e) --%f'
zstyle ':completion:*:messages' format '%F{purple}-- %d --%f'
zstyle ':completion:*:warnings' format '%F{red}-- no matches found --%f'

# Colored display of completion candidates
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

# Automatically add slash when completing directories
zstyle ':completion:*' squeeze-slashes true

# Show process names in kill command completion
zstyle ':completion:*:*:kill:*:processes' list-colors '=(#b) #([0-9]#)*=0=01;31'
zstyle ':completion:*:*:kill:*' menu yes select
zstyle ':completion:*:kill:*' force-list always

# Hostname completion for SSH/SCP
zstyle ':completion:*:ssh:*' hosts $(awk '/^Host / && !/\*/{print $2}' ~/.ssh/config 2>/dev/null)
zstyle ':completion:*:scp:*' hosts $(awk '/^Host / && !/\*/{print $2}' ~/.ssh/config 2>/dev/null)

# man page section completion
zstyle ':completion:*:manuals' separate-sections true
zstyle ':completion:*:manuals.(^1*)' insert-sections true

# Key bindings for completion
bindkey '^[[Z' reverse-menu-complete   # Shift+Tab for reverse completion
```

### 7.2 bash Completion Settings

```bash
# ============================================
# bash completion settings
# ============================================

# Load bash-completion package
if [ -f /etc/bash_completion ]; then
    source /etc/bash_completion
elif [ -f /usr/share/bash-completion/bash_completion ]; then
    source /usr/share/bash-completion/bash_completion
fi

# For macOS (Homebrew)
if [ -f "$(brew --prefix)/etc/bash_completion" ]; then
    source "$(brew --prefix)/etc/bash_completion"
fi

# Case-insensitive completion
bind "set completion-ignore-case on"

# Show completion candidates on partial match
bind "set show-all-if-ambiguous on"

# Show candidates with one Tab press
bind "set show-all-if-unmodified on"

# Color display
bind "set colored-stats on"

# Show file types during completion
bind "set visible-stats on"

# Display all completion candidates without paging
bind "set page-completions off"

# Add slash when completing symbolic links
bind "set mark-symlinked-directories on"
```

### 7.3 Completion Settings for Various Tools

```bash
# ============================================
# Tool-specific completion settings
# ============================================

# Docker
if command -v docker &>/dev/null; then
    # Docker completion (zsh)
    # docker completion is usually enabled automatically
    # For manual setup:
    # mkdir -p ~/.zsh/completions
    # docker completion zsh > ~/.zsh/completions/_docker
    fpath=(~/.zsh/completions $fpath)
fi

# kubectl
if command -v kubectl &>/dev/null; then
    source <(kubectl completion zsh)      # zsh
    # source <(kubectl completion bash)   # bash
fi

# Helm
if command -v helm &>/dev/null; then
    source <(helm completion zsh)
fi

# AWS CLI
if command -v aws_completer &>/dev/null; then
    complete -C aws_completer aws         # bash
    # autoload bashcompinit; bashcompinit # To use bash completion in zsh
    # complete -C aws_completer aws
fi

# Terraform
if command -v terraform &>/dev/null; then
    complete -C terraform terraform       # bash
    autoload -U +X bashcompinit && bashcompinit
    complete -o nospace -C terraform terraform  # zsh
fi

# GitHub CLI
if command -v gh &>/dev/null; then
    eval "$(gh completion -s zsh)"
fi

# npm completion
if command -v npm &>/dev/null; then
    eval "$(npm completion)"
fi

# pip completion
if command -v pip3 &>/dev/null; then
    eval "$(pip3 completion --zsh)"       # zsh
    # eval "$(pip3 completion --bash)"    # bash
fi

# rustup and cargo completion
if command -v rustup &>/dev/null; then
    eval "$(rustup completions zsh)"
    eval "$(rustup completions zsh cargo)"
fi
```

---

## 8. Introducing Modern Shell Tools

### 8.1 List of Essential Tools

```bash
# ============================================
# Installing modern CLI tools (macOS)
# ============================================

# Package manager
brew install \
    fzf              # Fuzzy search (most important)
    zoxide           # Smart cd (z command)
    bat              # Improved cat (syntax highlighting)
    eza              # Improved ls (icons, Git integration)
    ripgrep          # Fast grep (rg)
    fd               # Fast find
    delta            # Improved diff (for Git diff)
    jq               # JSON processing
    yq               # YAML processing
    tldr             # Simplified man (example-focused)
    htop             # Improved top
    ncdu             # Disk usage visualization
    starship         # Modern prompt
    direnv           # Directory-level environment variables

# For Linux (Ubuntu/Debian)
sudo apt install -y \
    fzf zoxide bat exa ripgrep fd-find \
    jq delta htop ncdu direnv
```

### 8.2 fzf Configuration

```bash
# ============================================
# Detailed fzf configuration
# ============================================

# Configuration after installing fzf
# $(brew --prefix)/opt/fzf/install   # Run installation script

# Default options
export FZF_DEFAULT_OPTS='
    --height 60%
    --layout=reverse
    --border rounded
    --info inline
    --multi
    --preview-window=right:60%:wrap
    --bind "ctrl-a:select-all"
    --bind "ctrl-d:deselect-all"
    --bind "ctrl-t:toggle-all"
    --bind "ctrl-/:toggle-preview"
    --color=fg:#c0caf5,bg:#1a1b26,hl:#ff9e64
    --color=fg+:#c0caf5,bg+:#292e42,hl+:#ff9e64
    --color=info:#7aa2f7,prompt:#7dcfff,pointer:#ff007c
    --color=marker:#9ece6a,spinner:#9ece6a,header:#9ece6a
'

# Default search command
export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git'

# Ctrl+T: File search
export FZF_CTRL_T_COMMAND='fd --type f --hidden --follow --exclude .git'
export FZF_CTRL_T_OPTS='
    --preview "bat --color=always --line-range :100 {}"
    --bind "enter:become(${EDITOR:-vim} {+})"
'

# Alt+C: Search directories and cd
export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git'
export FZF_ALT_C_OPTS='
    --preview "eza --tree --level=2 --icons {}"
'

# Ctrl+R: Command history search
export FZF_CTRL_R_OPTS='
    --preview "echo {}"
    --preview-window=down:3:hidden:wrap
    --bind "ctrl-/:toggle-preview"
'

# Load fzf
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
```

### 8.3 zoxide Configuration

```bash
# ============================================
# zoxide configuration
# ============================================

# Initialization (add to ~/.zshrc)
eval "$(zoxide init zsh)"

# For bash
# eval "$(zoxide init bash)"

# Usage
z projects             # Navigate to the best-matching "projects" directory from visit history
z proj                 # Partial match also works
zi                     # Interactive selection (fzf integration)
z -                    # Go back to previous directory

# zoxide database operations
zoxide query           # Display database contents
zoxide query -l        # Display with scores
zoxide add /path       # Manually add a path
zoxide remove /path    # Manually remove a path
```

### 8.4 Improving Git Diff (delta)

```bash
# ============================================
# delta configuration (add to ~/.gitconfig)
# ============================================
```

```ini
# ~/.gitconfig
[core]
    pager = delta

[interactive]
    diffFilter = delta --color-only

[delta]
    navigate = true
    side-by-side = true
    line-numbers = true
    syntax-theme = Dracula
    plus-style = "syntax #003800"
    minus-style = "syntax #3f0001"
    plus-emph-style = "syntax #006000"
    minus-emph-style = "syntax #600000"

[merge]
    conflictstyle = diff3

[diff]
    colorMoved = default
```

---

## 9. Syncing and Version-Controlling Configuration

### 9.1 dotfiles Repository Structure

```bash
# ============================================
# Managing dotfiles
# ============================================

# Example dotfiles repository structure
# ~/.dotfiles/
# ├── zsh/
# │   ├── .zshrc
# │   ├── .zshenv
# │   └── .zprofile
# ├── bash/
# │   ├── .bashrc
# │   └── .bash_profile
# ├── git/
# │   ├── .gitconfig
# │   └── .gitignore_global
# ├── vim/
# │   └── .vimrc
# ├── config/
# │   ├── starship.toml
# │   └── ...
# ├── install.sh
# ├── Makefile
# └── README.md

# Set up with symbolic links
ln -sf ~/.dotfiles/zsh/.zshrc ~/.zshrc
ln -sf ~/.dotfiles/zsh/.zshenv ~/.zshenv
ln -sf ~/.dotfiles/git/.gitconfig ~/.gitconfig
ln -sf ~/.dotfiles/config/starship.toml ~/.config/starship.toml
```

### 9.2 Automated Setup Script

```bash
#!/bin/bash
# install.sh — Automated setup for dotfiles

set -euo pipefail

DOTFILES_DIR="$HOME/.dotfiles"

echo "=== Setting up dotfiles ==="

# Create symbolic links
create_symlink() {
    local src="$1"
    local dst="$2"

    if [ -e "$dst" ] && [ ! -L "$dst" ]; then
        echo "Backing up existing $dst to ${dst}.bak"
        mv "$dst" "${dst}.bak"
    fi

    ln -sf "$src" "$dst"
    echo "Linked: $src -> $dst"
}

# zsh
create_symlink "$DOTFILES_DIR/zsh/.zshrc" "$HOME/.zshrc"
create_symlink "$DOTFILES_DIR/zsh/.zshenv" "$HOME/.zshenv"

# git
create_symlink "$DOTFILES_DIR/git/.gitconfig" "$HOME/.gitconfig"
create_symlink "$DOTFILES_DIR/git/.gitignore_global" "$HOME/.gitignore_global"

# Starship
mkdir -p "$HOME/.config"
create_symlink "$DOTFILES_DIR/config/starship.toml" "$HOME/.config/starship.toml"

# For macOS: Install Homebrew packages
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "=== Installing Homebrew packages ==="
    if ! command -v brew &>/dev/null; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew bundle --file="$DOTFILES_DIR/Brewfile"
fi

echo "=== Setup complete ==="
```

### 9.3 Dependency Management with Brewfile

```ruby
# Brewfile — Homebrew package management
# Usage: brew bundle --file=Brewfile

# Taps
tap "homebrew/cask-fonts"

# CLI tools
brew "zsh"
brew "fzf"
brew "zoxide"
brew "bat"
brew "eza"
brew "ripgrep"
brew "fd"
brew "git-delta"
brew "jq"
brew "yq"
brew "tldr"
brew "htop"
brew "ncdu"
brew "starship"
brew "direnv"
brew "gh"
brew "gnupg"
brew "wget"
brew "tree"
brew "watch"
brew "tmux"

# Development tools
brew "node"
brew "python@3"
brew "go"
brew "rustup"

# GUI apps (Cask)
cask "visual-studio-code"
cask "iterm2"
cask "docker"
cask "rectangle"

# Fonts (Nerd Fonts)
cask "font-hack-nerd-font"
cask "font-fira-code-nerd-font"
cask "font-jetbrains-mono-nerd-font"
```

---

## 10. Troubleshooting

### 10.1 Common Problems and Solutions

```bash
# ============================================
# Shell configuration troubleshooting
# ============================================

# Problem 1: Changes are not reflected
# Cause: Configuration file not loaded, or written to the wrong file
source ~/.zshrc                    # Manually reload
exec zsh                           # Fully restart the shell
echo $SHELL                        # Check current default shell
cat /etc/shells                    # List available shells
chsh -s $(which zsh)               # Change default shell

# Problem 2: Command not found
which command_name                 # Check command location
echo $PATH                        # Check PATH contents
type command_name                  # Check command type
hash -r                            # Reset command hash table (bash)
rehash                             # Reset command hash table (zsh)

# Problem 3: Alias not working
alias                              # List defined aliases
type command_name                  # Check if command is an alias
unalias command_name               # Remove alias

# Problem 4: Shell startup is slow
time zsh -i -c exit                # Measure startup time
# Add zmodload zsh/zprof to the top of zshrc, and zprof to the bottom
# → Identify which processes are slow

# Common causes of slowness:
# - Loading nvm (switch to fnm if slow)
# - Duplicate compinit execution
# - Loading a large number of plugins
# - Processes that require network access

# Problem 5: Garbled characters
locale                             # Check locale settings
echo $LANG                        # Check LANG
# Solution: Add export LANG="ja_JP.UTF-8" to .zshrc

# Problem 6: Completion not working
rm -f ~/.zcompdump*                # Delete completion cache
autoload -Uz compinit && compinit  # Re-initialize completion system
```

### 10.2 Configuration File Best Practices

```bash
# ============================================
# Best practices for managing configuration files
# ============================================

# 1. Modularize configuration
# Load individual files from ~/.zshrc

# ~/.zshrc
for config_file in ~/.zsh/conf.d/*.zsh(N); do
    source "$config_file"
done

# ~/.zsh/conf.d/
# ├── 01-env.zsh          # Environment variables
# ├── 02-history.zsh       # History settings
# ├── 03-completion.zsh    # Completion settings
# ├── 04-aliases.zsh       # Aliases
# ├── 05-functions.zsh     # Functions
# ├── 06-keybindings.zsh   # Key bindings
# ├── 07-prompt.zsh        # Prompt
# ├── 08-tools.zsh         # Tool settings
# └── 99-local.zsh         # Machine-specific settings

# 2. Separate machine-specific settings
if [ -f ~/.zshrc.local ]; then
    source ~/.zshrc.local
fi

# 3. Add OS detection
case "$OSTYPE" in
    darwin*)
        # macOS-specific settings
        alias ls='ls -G'
        ;;
    linux*)
        # Linux-specific settings
        alias ls='ls --color=auto'
        ;;
esac

# 4. Add command existence checks
if command -v eza &>/dev/null; then
    alias ls='eza --icons'
fi

# 5. Back up before changing configuration
cp ~/.zshrc ~/.zshrc.bak.$(date +%Y%m%d)
```

---

## 11. Key Binding Configuration

### 11.1 zsh Key Bindings

```bash
# ============================================
# zsh key binding settings
# ============================================

# Emacs mode (default)
bindkey -e

# To use Vi mode
# bindkey -v
# export KEYTIMEOUT=1

# Basic key bindings
bindkey '^A' beginning-of-line       # Ctrl+A: Beginning of line
bindkey '^E' end-of-line             # Ctrl+E: End of line
bindkey '^K' kill-line               # Ctrl+K: Delete from cursor to end of line
bindkey '^U' backward-kill-line      # Ctrl+U: Delete from cursor to beginning of line
bindkey '^W' backward-kill-word      # Ctrl+W: Delete word backward
bindkey '^Y' yank                    # Ctrl+Y: Paste (from kill ring)
bindkey '^L' clear-screen            # Ctrl+L: Clear screen
bindkey '^R' history-incremental-search-backward  # Ctrl+R: Reverse history search

# Word movement
bindkey '^[b' backward-word          # Alt+B: Go to previous word
bindkey '^[f' forward-word           # Alt+F: Go to next word
bindkey '^[d' kill-word              # Alt+D: Delete word forward

# macOS Option key support
bindkey '\e[1;3D' backward-word      # Option+Left
bindkey '\e[1;3C' forward-word       # Option+Right

# Home/End keys
bindkey '^[[H' beginning-of-line     # Home
bindkey '^[[F' end-of-line           # End

# Delete key
bindkey '^[[3~' delete-char          # Delete

# Improved history search
bindkey '^P' up-line-or-search       # Ctrl+P: Upward history search
bindkey '^N' down-line-or-search     # Ctrl+N: Downward history search
bindkey '^[[A' up-line-or-search     # Up arrow
bindkey '^[[B' down-line-or-search   # Down arrow

# Partial match history search (search by string being typed)
autoload -Uz up-line-or-beginning-search down-line-or-beginning-search
zle -N up-line-or-beginning-search
zle -N down-line-or-beginning-search
bindkey '^[[A' up-line-or-beginning-search    # Up arrow
bindkey '^[[B' down-line-or-beginning-search  # Down arrow

# Custom widget: Add sudo to the beginning
sudo-command-line() {
    [[ -z $BUFFER ]] && zle up-history
    if [[ $BUFFER == sudo\ * ]]; then
        LBUFFER="${LBUFFER#sudo }"
    else
        LBUFFER="sudo $LBUFFER"
    fi
}
zle -N sudo-command-line
bindkey '^[s' sudo-command-line      # Alt+S: Toggle sudo

# Edit current command line in editor
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^X^E' edit-command-line     # Ctrl+X Ctrl+E: Edit in editor
```

---

## 12. Practical Exercises

### Exercise 1: [Beginner] — Create a Minimal .zshrc

```bash
# Requirements:
# 1. Set basic environment variables (EDITOR, LANG, PATH)
# 2. Define 5 or more useful aliases
# 3. Configure history settings appropriately
# 4. Enable completion

# Sample solution:
cat > ~/.zshrc.exercise1 << 'EOF'
# ========== Environment variables ==========
export EDITOR="vim"
export LANG="ja_JP.UTF-8"
export PATH="$HOME/.local/bin:$PATH"

# ========== Aliases ==========
alias ll='ls -lah'
alias la='ls -A'
alias ..='cd ..'
alias ...='cd ../..'
alias gs='git status'
alias gc='git commit'
alias gp='git push'

# ========== History settings ==========
HISTSIZE=50000
SAVEHIST=50000
HISTFILE=~/.zsh_history
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE

# ========== Completion ==========
autoload -Uz compinit && compinit
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'
zstyle ':completion:*' menu select
EOF
```

### Exercise 2: [Intermediate] — Create Functions Using fzf

```bash
# Requirements:
# 1. A function to search for files with fzf and open them in an editor
# 2. A function to switch Git branches with fzf
# 3. A function to select a process with fzf and kill it

# Sample solution:
cat > ~/.zshrc.exercise2 << 'FUNC_EOF'
# Search for files with fzf and open in editor
fopen() {
    local file
    file=$(fd --type f --hidden --exclude .git | fzf \
        --preview 'bat --color=always --line-range :100 {}' \
        --preview-window=right:60%)
    [ -n "$file" ] && ${EDITOR:-vim} "$file"
}

# Switch Git branches with fzf
fbranch() {
    local branch
    branch=$(git branch -a | sed 's/^\* //' | sed 's/^ *//' | \
        fzf --preview 'git log --oneline --graph -20 {}')
    if [ -n "$branch" ]; then
        branch=$(echo "$branch" | sed 's|remotes/origin/||')
        git checkout "$branch"
    fi
}

# Select a process with fzf and kill it
fkill() {
    local pids
    pids=$(ps aux | sed 1d | fzf -m --header='Select process to kill' | awk '{print $2}')
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9
        echo "Killed: $pids"
    fi
}
FUNC_EOF
```

### Exercise 3: [Advanced] — Complete Shell Environment Setup Script

```bash
# Requirements:
# 1. Detect OS (macOS/Linux) and install tools with appropriate package manager
# 2. Place dotfiles with symbolic links
# 3. Install zsh plugins
# 4. Run tests after setup is complete

# Framework for sample solution:
cat > ~/setup.sh << 'SETUP_EOF'
#!/bin/bash
set -euo pipefail

# OS detection
detect_os() {
    case "$OSTYPE" in
        darwin*) echo "macos" ;;
        linux*)  echo "linux" ;;
        *)       echo "unknown"; exit 1 ;;
    esac
}

OS=$(detect_os)
echo "Detected OS: $OS"

# Package installation
install_packages() {
    local packages=(fzf zoxide bat ripgrep fd jq starship direnv)

    if [ "$OS" = "macos" ]; then
        if ! command -v brew &>/dev/null; then
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install "${packages[@]}" eza git-delta
    elif [ "$OS" = "linux" ]; then
        sudo apt update
        sudo apt install -y "${packages[@]}"
    fi
}

# zsh plugins
install_zsh_plugins() {
    local ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"

    local plugins=(
        "https://github.com/zsh-users/zsh-autosuggestions"
        "https://github.com/zsh-users/zsh-syntax-highlighting"
        "https://github.com/zsh-users/zsh-completions"
    )

    for plugin_url in "${plugins[@]}"; do
        local plugin_name=$(basename "$plugin_url")
        local target_dir="$ZSH_CUSTOM/plugins/$plugin_name"
        if [ ! -d "$target_dir" ]; then
            git clone "$plugin_url" "$target_dir"
            echo "Installed: $plugin_name"
        else
            echo "Already installed: $plugin_name"
        fi
    done
}

# Tests
run_tests() {
    echo "=== Running tests ==="
    local failed=0

    for cmd in fzf zoxide bat rg fd jq starship direnv; do
        if command -v "$cmd" &>/dev/null; then
            echo "  [OK] $cmd"
        else
            echo "  [NG] $cmd not found"
            ((failed++))
        fi
    done

    if [ "$failed" -eq 0 ]; then
        echo "All tests passed!"
    else
        echo "$failed test(s) failed"
    fi
}

install_packages
install_zsh_plugins
run_tests
SETUP_EOF

chmod +x ~/setup.sh
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming how it works.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Setting | File | Purpose |
|---------|------|---------|
| Environment variables | .zshenv / .bash_profile | PATH, EDITOR, LANG, etc. |
| Aliases | .zshrc / .bashrc | Shorthand for commands |
| Functions | .zshrc / .bashrc | Automating complex commands |
| Prompt | .zshrc / .bashrc | Customizing display |
| History | .zshrc / .bashrc | History save/share settings |
| Completion | .zshrc / .bashrc | Enhancing Tab completion |
| Key bindings | .zshrc / .bashrc | Setting keyboard shortcuts |
| Tool settings | Each tool's config file | fzf, starship, delta, etc. |
| dotfiles management | ~/.dotfiles/ | Version control and sync |

### Best Practices Summary

1. **Modularize your configuration** -- Split into files by feature rather than one giant .zshrc
2. **Manage dotfiles with Git** -- Track configuration change history and sync across multiple machines
3. **Add OS detection and command existence checks** -- Write highly portable configurations
4. **Apply safeguards to dangerous commands** -- Aliases like rm -i, cp -i, etc.
5. **Periodically measure startup time** -- Be careful not to slow things down too much by adding plugins
6. **Do not write sensitive information directly in configuration files** -- Use direnv, keychain, and secret managers
7. **Actively adopt modern tools** -- Improve productivity with fzf, zoxide, bat, eza, ripgrep, fd

---

## What to Read Next

---

## References
1. Robbins, A. "bash Pocket Reference." 2nd Ed, O'Reilly, 2016.
2. Kiddle, O., Peek, J., Stephenson, P. "From Bash to Z Shell: Conquering the Command Line." Apress, 2004.
3. Janssens, J. "Data Science at the Command Line." 2nd Ed, O'Reilly, 2021.
4. Neil, D. "Practical Vim." 2nd Ed, Pragmatic Bookshelf, 2015.
5. Starship official documentation: https://starship.rs/
6. Oh My Zsh official repository: https://github.com/ohmyzsh/ohmyzsh
7. fzf official repository: https://github.com/junegunn/fzf
8. zoxide official repository: https://github.com/ajeetdsouza/zoxide
