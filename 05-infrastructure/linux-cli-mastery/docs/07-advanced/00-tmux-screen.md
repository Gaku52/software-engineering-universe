# Terminal Multiplexers (tmux, screen)

> tmux manages multiple sessions, windows, and panes within a single terminal. Work continues even after an SSH disconnection.

## What You Will Learn

- [ ] Operate tmux sessions, windows, and panes
- [ ] Keep processes running after SSH disconnection
- [ ] Customize tmux to boost productivity
- [ ] Auto-build work environments with tmux scripts
- [ ] Use tmux plugins
- [ ] Understand basic screen operations (for legacy environments)


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Core Concepts of tmux

### 1.1 Understanding the Structure

```
tmux structure:

  Server (background process)
  └── Session (unit of work; persists after SSH disconnection)
      ├── Window 0 (like a tab)
      │   ├── Pane 0 (each region of a split screen)
      │   └── Pane 1
      └── Window 1
          └── Pane 0

Prefix key: Ctrl+b (default)
  → All tmux commands are entered after pressing Ctrl+b
```

### 1.2 When tmux Is Needed

```bash
# Situations where tmux is useful:
# 1. Server work over SSH → processes continue even after disconnection
# 2. Managing multiple terminals on one screen → split view
# 3. Pair programming → session sharing
# 4. Managing long-running jobs → detach/attach
# 5. Bulk setup of development environments → scripting

# Installing tmux
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux

# RHEL/Fedora
sudo dnf install tmux

# Check version
tmux -V
```

---

## 2. Session Management

### 2.1 Basic Session Operations

```bash
# Session operations
tmux                             # Create a new session
tmux new -s work                 # Named session
tmux new -s work -d              # Create in the background
tmux new -s work -n editor       # Specify the first window name
tmux ls                          # List sessions
tmux list-sessions               # Same (full command)
tmux attach -t work              # Attach to a session
tmux attach -t 0                 # Attach by number
tmux attach                      # Attach to the last session
tmux kill-session -t work        # Delete a session
tmux kill-session -a             # Delete all sessions except the current one
tmux kill-session -a -t work     # Delete all sessions except work
tmux kill-server                 # Delete all sessions

# Check if a session exists
tmux has-session -t work 2>/dev/null && echo "exists" || echo "not found"
```

### 2.2 Key Bindings Within a Session

```bash
# Operations inside a session (Ctrl+b + key)
# Ctrl+b d    → Detach (leave the session; processes continue)
# Ctrl+b s    → Session list / switch (tree view)
# Ctrl+b $    → Rename session
# Ctrl+b (    → Previous session
# Ctrl+b )    → Next session
# Ctrl+b L    → Switch to the last active session
```

### 2.3 Session Management Best Practices

```bash
# Create a session per project
tmux new -s frontend -d
tmux new -s backend -d
tmux new -s database -d

# Moving between sessions
# Press Ctrl+b s to display the session list, then select
# Or switch sequentially with Ctrl+b ( / )

# Session management pattern on an SSH server
# On connect: attach to an existing session, or create a new one
tmux attach -t main 2>/dev/null || tmux new -s main

# Set as an alias
alias ta='tmux attach -t main 2>/dev/null || tmux new -s main'
```

---

## 3. Window Operations

### 3.1 Basic Operations

```bash
# Windows (equivalent to tabs)
# Ctrl+b c    → Create a new window
# Ctrl+b ,    → Rename window
# Ctrl+b w    → Window list (with preview)
# Ctrl+b n    → Next window
# Ctrl+b p    → Previous window
# Ctrl+b 0-9  → Switch window by number
# Ctrl+b &    → Close window (with confirmation)
# Ctrl+b f    → Search windows
# Ctrl+b l    → Switch to the last active window
```

### 3.2 Window Operations from the Command Line

```bash
# Operations from the command line
tmux new-window                  # New window
tmux new-window -n logs          # Named window
tmux new-window -t work:         # Add a window to a specific session
tmux select-window -t 2          # Go to window 2
tmux select-window -t work:logs  # Specify by session:window name
tmux rename-window editor        # Rename window

# Swap windows
tmux swap-window -s 0 -t 1       # Swap windows 0 and 1
tmux move-window -s work:1 -t dev:  # Move window between sessions

# Run a command in a window
tmux new-window -n editor "vim ."
tmux new-window -n server "npm run dev"
```

### 3.3 Window Layout Management

```bash
# Window display in the status bar
# [0] editor* [1] server [2] logs
# * marks the current window
# - marks the previous window

# Auto-renaming windows
# By default, the running command name becomes the window name
# To disable:
# set-option -g allow-rename off
```

---

## 4. Pane Operations (Split Screen)

### 4.1 Basic Pane Operations

```bash
# Splitting panes
# Ctrl+b %    → Split left/right (vertical split)
# Ctrl+b "    → Split top/bottom (horizontal split)

# Moving between panes
# Ctrl+b ←↑→↓  → Move to pane with arrow keys
# Ctrl+b o      → Next pane
# Ctrl+b ;      → Previous pane
# Ctrl+b q      → Show pane numbers (press a number to navigate)

# Resizing panes
# Ctrl+b Ctrl+←↑→↓  → Resize in the arrow direction
# Ctrl+b z            → Zoom pane (toggle fullscreen)

# Pane layouts
# Ctrl+b Space        → Cycle layouts (even split, etc.)
# Ctrl+b {            → Move pane forward
# Ctrl+b }            → Move pane backward

# Closing a pane
# Ctrl+b x            → Close the current pane (with confirmation)
# exit or Ctrl+d       → Exit the shell and close the pane

# Promote pane to a window
# Ctrl+b !            → Move the current pane to a new window
```

### 4.2 Pane Operations from the Command Line

```bash
# Splitting from the command line
tmux split-window -h             # Horizontal (left/right) split
tmux split-window -v             # Vertical (top/bottom) split
tmux split-window -h -p 30       # Split with 30% on the right
tmux split-window -v -p 20       # Split with 20% on the bottom
tmux split-window -h -l 40       # Split with 40 columns on the right

# Split and run a command
tmux split-window -h "tail -f /var/log/syslog"
tmux split-window -v -p 30 "htop"

# Selecting a pane
tmux select-pane -t 0            # Select pane 0
tmux select-pane -L              # Move to left pane
tmux select-pane -R              # Move to right pane
tmux select-pane -U              # Move to pane above
tmux select-pane -D              # Move to pane below

# Resizing panes
tmux resize-pane -L 5            # 5 columns to the left
tmux resize-pane -R 5            # 5 columns to the right
tmux resize-pane -U 5            # 5 rows up
tmux resize-pane -D 5            # 5 rows down
tmux resize-pane -Z              # Toggle zoom

# Swapping panes
tmux swap-pane -s 0 -t 1         # Swap panes 0 and 1
tmux swap-pane -U                # Swap with the pane above
tmux swap-pane -D                # Swap with the pane below

# Moving panes between windows
tmux join-pane -s work:1 -t work:0   # Join pane from window 1 into window 0
tmux break-pane                       # Move current pane to a new window

# Specifying a layout
tmux select-layout even-horizontal   # Even horizontal split
tmux select-layout even-vertical     # Even vertical split
tmux select-layout main-horizontal   # Main (top) + sub (bottom row)
tmux select-layout main-vertical     # Main (left) + sub (right column)
tmux select-layout tiled             # Tiled (even grid)
```

### 4.3 Pane Synchronization (Simultaneous Input to All Panes)

```bash
# Simultaneous input to all panes (run the same command on multiple servers)
# Ctrl+b : → setw synchronize-panes on
# Ctrl+b : → setw synchronize-panes off

# Toggle with a key binding
# Add the following to .tmux.conf:
# bind S setw synchronize-panes

# Usage:
# 1. Connect via SSH in each pane
# 2. Turn sync ON with Ctrl+b S
# 3. Type a command (it applies to all panes)
# 4. Turn sync OFF with Ctrl+b S
```

---

## 5. Copy Mode

### 5.1 Basic Operations

```bash
# Copy mode (scrolling and text selection)
# Ctrl+b [    → Enter copy mode

# Operations in copy mode (vi-style):
# q           → Exit copy mode
# ↑↓←→ / hjkl → Move cursor
# Ctrl+u/d    → Page up/down
# Ctrl+b/f    → Page up/down (emacs-style)
# g / G       → Go to top / bottom
# /pattern    → Forward search
# ?pattern    → Backward search
# n / N       → Next / previous search result
# Space       → Start selection
# Enter       → Copy (end selection)
# w / b       → Move word by word
# 0 / $       → Beginning / end of line

# Ctrl+b ]    → Paste
```

### 5.2 vi Mode Settings and Advanced Operations

```bash
# Enable vi mode (~/.tmux.conf):
setw -g mode-keys vi

# Copy operations in vi mode
# Ctrl+b [     → Enter copy mode
# v            → Start selection (vi-style, requires configuration)
# y            → Yank (copy)
# Ctrl+b ]     → Paste

# Settings to add to tmux.conf (vi-style copy)
# bind-key -T copy-mode-vi v send-keys -X begin-selection
# bind-key -T copy-mode-vi y send-keys -X copy-selection-and-cancel
# bind-key -T copy-mode-vi r send-keys -X rectangle-toggle

# Integration with system clipboard (macOS)
# bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "pbcopy"
# bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"

# Integration with system clipboard (Linux / X11)
# bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "xclip -selection clipboard"

# Integration with system clipboard (Linux / Wayland)
# bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "wl-copy"
```

### 5.3 Copying with the Mouse

```bash
# When mouse mode is enabled:
# - Select a pane with the mouse
# - Resize panes with the mouse
# - Select text by mouse drag
# - Scroll with the mouse wheel

# set -g mouse on  # Add to ~/.tmux.conf

# Copy setting for text selected with the mouse
# macOS + iTerm2:
# Hold Option and drag for conventional selection

# Improved mouse copy setting inside tmux
# bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"
```

---

## 6. tmux Configuration (~/.tmux.conf)

### 6.1 Basic Configuration

```bash
# ~/.tmux.conf

# Change prefix key (Ctrl+a is popular)
unbind C-b
set -g prefix C-a
bind C-a send-prefix

# Mouse support
set -g mouse on

# vi-style key bindings
setw -g mode-keys vi

# Improved key bindings for pane splitting
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"
unbind '"'
unbind %

# Pane navigation (vim-style)
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R

# Pane resizing
bind -r H resize-pane -L 5
bind -r J resize-pane -D 5
bind -r K resize-pane -U 5
bind -r L resize-pane -R 5

# Start window numbering at 1
set -g base-index 1
setw -g pane-base-index 1

# Automatic window renumbering
set -g renumber-windows on

# 256-color support
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

# Status bar
set -g status-style 'bg=#333333 fg=#ffffff'
set -g status-left '#[fg=green]#S '
set -g status-right '#[fg=yellow]%Y-%m-%d %H:%M'
set -g status-left-length 30

# Reload configuration
bind r source-file ~/.tmux.conf \; display "Config reloaded!"

# History buffer size
set -g history-limit 50000

# Reduce escape time (for vim)
set -sg escape-time 0

# Key repeat time
set -g repeat-time 500

# Open new windows in the current path
bind c new-window -c "#{pane_current_path}"

# Window activity notifications
setw -g monitor-activity on
set -g visual-activity off
```

### 6.2 Appearance Customization

```bash
# Detailed status bar customization
set -g status-position bottom
set -g status-justify left
set -g status-interval 5

# Left side: session name
set -g status-left '#[fg=green,bold]#S #[fg=white]| '
set -g status-left-length 30

# Right side: date/time, hostname
set -g status-right '#[fg=cyan]#H #[fg=white]| #[fg=yellow]%Y-%m-%d #[fg=white]%H:%M '
set -g status-right-length 50

# Window list style
setw -g window-status-format '#[fg=white] #I:#W '
setw -g window-status-current-format '#[fg=black,bg=green,bold] #I:#W '

# Pane border style
set -g pane-border-style 'fg=#444444'
set -g pane-active-border-style 'fg=green'

# Message style
set -g message-style 'fg=white bg=black bold'

# Copy mode style
setw -g mode-style 'fg=black bg=yellow'

# Clock mode color
setw -g clock-mode-colour green
```

### 6.3 Advanced Key Binding Configuration

```bash
# Move panes with Alt + arrow keys (no prefix required)
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# Switch windows with Shift + arrow keys (no prefix required)
bind -n S-Left previous-window
bind -n S-Right next-window

# Toggle pane synchronization
bind S setw synchronize-panes

# Join and break panes
bind j join-pane -s !           # Join pane from the previous window
bind J break-pane               # Break pane into a new window

# Swap windows
bind -r < swap-window -t -1\; select-window -t -1
bind -r > swap-window -t +1\; select-window -t +1

# Command prompt
# Ctrl+b :    → Enter tmux commands directly
# Example: :new-window -n logs "tail -f /var/log/syslog"
# Example: :setw synchronize-panes on
# Example: :resize-pane -D 10

# Search windows within a session
# Ctrl+b f    → Search by window name
```

---

## 7. tmux Plugin Manager (TPM)

### 7.1 Installing and Using TPM

```bash
# Install TPM (Tmux Plugin Manager)
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# Add to ~/.tmux.conf
# Plugin list
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-sensible'

# TPM initialization (place at the end of .tmux.conf)
run '~/.tmux/plugins/tpm/tpm'

# Plugin operations
# Ctrl+b I     → Install plugins
# Ctrl+b U     → Update plugins
# Ctrl+b alt+u → Remove plugins (run after removing from the list)
```

### 7.2 Recommended Plugins

```bash
# tmux-resurrect: Save and restore sessions
set -g @plugin 'tmux-plugins/tmux-resurrect'
# Ctrl+b Ctrl+s → Save session
# Ctrl+b Ctrl+r → Restore session

# tmux-continuum: Auto-save and auto-restore
set -g @plugin 'tmux-plugins/tmux-continuum'
set -g @continuum-restore 'on'
set -g @continuum-save-interval '15'  # Auto-save every 15 minutes

# tmux-yank: System clipboard integration
set -g @plugin 'tmux-plugins/tmux-yank'

# tmux-open: Open URLs and files in copy mode
set -g @plugin 'tmux-plugins/tmux-open'
# After selecting in copy mode:
# o → Open with the default program
# Ctrl+o → Open in editor
# S → Search with a search engine

# tmux-fzf: Select sessions/windows/panes with fzf
set -g @plugin 'sainnhe/tmux-fzf'
# Ctrl+b F → fzf menu

# tmux-fingers: Select and copy URLs or paths on screen
set -g @plugin 'Morantron/tmux-fingers'
# Ctrl+b F → Highlight mode

# dracula theme
set -g @plugin 'dracula/tmux'
set -g @dracula-plugins "cpu-usage ram-usage time"
set -g @dracula-show-left-icon session

# catppuccin theme
set -g @plugin 'catppuccin/tmux'
set -g @catppuccin_flavour 'mocha'
```

### 7.3 Example of a Complete .tmux.conf

```bash
# ~/.tmux.conf - complete configuration example

# === Basic Settings ===
set -g prefix C-a
unbind C-b
bind C-a send-prefix

set -g mouse on
setw -g mode-keys vi
set -g base-index 1
setw -g pane-base-index 1
set -g renumber-windows on
set -g history-limit 50000
set -sg escape-time 0
set -g repeat-time 500
set -g focus-events on
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

# === Key Bindings ===
# Pane splitting
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"
unbind '"'
unbind %

# Pane navigation (vim-style)
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R

# Pane resizing
bind -r H resize-pane -L 5
bind -r J resize-pane -D 5
bind -r K resize-pane -U 5
bind -r L resize-pane -R 5

# Move panes with Alt + arrow keys
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# Switch windows with Shift + arrow keys
bind -n S-Left previous-window
bind -n S-Right next-window

# Open new windows in the current path
bind c new-window -c "#{pane_current_path}"

# Reload configuration
bind r source-file ~/.tmux.conf \; display "Reloaded!"

# Toggle pane synchronization
bind S setw synchronize-panes

# Swap windows
bind -r < swap-window -t -1\; select-window -t -1
bind -r > swap-window -t +1\; select-window -t +1

# === Copy Mode ===
bind-key -T copy-mode-vi v send-keys -X begin-selection
bind-key -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "pbcopy"
bind-key -T copy-mode-vi r send-keys -X rectangle-toggle

# === Appearance ===
set -g status-position bottom
set -g status-style 'bg=#1e1e2e fg=#cdd6f4'
set -g status-left '#[fg=#a6e3a1,bold] #S #[fg=#cdd6f4]| '
set -g status-left-length 30
set -g status-right '#[fg=#89b4fa]#H #[fg=#cdd6f4]| #[fg=#f9e2af]%Y-%m-%d %H:%M '
set -g status-right-length 50
setw -g window-status-format '#[fg=#6c7086] #I:#W '
setw -g window-status-current-format '#[fg=#1e1e2e,bg=#a6e3a1,bold] #I:#W '
set -g pane-border-style 'fg=#313244'
set -g pane-active-border-style 'fg=#a6e3a1'
set -g message-style 'fg=#cdd6f4 bg=#1e1e2e bold'

# === Plugins ===
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-sensible'
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'
set -g @plugin 'tmux-plugins/tmux-yank'

set -g @continuum-restore 'on'
set -g @continuum-save-interval '15'

# TPM initialization (place last)
run '~/.tmux/plugins/tpm/tpm'
```

---

## 8. Practical tmux Patterns

### 8.1 Development Layout

```bash
# Pattern 1: Development layout
tmux new -s dev
# Pane split: editor (top, large) + terminal (bottom left) + logs (bottom right)
# Ctrl+b "    → Top/bottom split
# In the bottom pane: Ctrl+b % → Left/right split

# Manual steps:
# 1. tmux new -s dev
# 2. Ctrl+b " (top/bottom split)
# 3. Ctrl+b ↓ (move to bottom pane)
# 4. Ctrl+b % (left/right split)
# 5. Ctrl+b ↑ (move to top pane)
# 6. vim .  (open editor)
```

### 8.2 Auto-Building Layouts with Scripts

```bash
#!/bin/bash
# dev-session.sh - Auto-build a development session

SESSION="dev"
PROJECT_DIR="${1:-$(pwd)}"

# Attach if session already exists
tmux has-session -t "$SESSION" 2>/dev/null && {
    tmux attach -t "$SESSION"
    exit 0
}

# Create new session
tmux new-session -d -s "$SESSION" -n "editor" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION:editor" "vim ." Enter

# Server window
tmux new-window -t "$SESSION" -n "server" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION:server" "npm run dev" Enter

# Log window
tmux new-window -t "$SESSION" -n "logs" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION:logs" "tail -f /var/log/app.log" Enter

# Terminal window (for git operations, etc.)
tmux new-window -t "$SESSION" -n "terminal" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION:terminal" "git status" Enter

# Select the first window
tmux select-window -t "$SESSION:editor"

# Attach
tmux attach -t "$SESSION"
```

### 8.3 Session with Split Layout

```bash
#!/bin/bash
# monitor-session.sh - Session for server monitoring

SESSION="monitor"

tmux new-session -d -s "$SESSION" -n "dashboard"

# Main pane (top half): htop
tmux send-keys -t "$SESSION:dashboard" "htop" Enter

# Split the bottom half left/right
tmux split-window -v -p 40 -t "$SESSION:dashboard"
tmux send-keys "watch -n 5 'df -h'" Enter

tmux split-window -h -t "$SESSION:dashboard"
tmux send-keys "watch -n 5 'free -h'" Enter

# Network monitoring window
tmux new-window -t "$SESSION" -n "network"
tmux send-keys -t "$SESSION:network" "sudo iftop" Enter

# Log monitoring window
tmux new-window -t "$SESSION" -n "logs"
tmux split-window -h -t "$SESSION:logs"
tmux send-keys -t "$SESSION:logs.0" "journalctl -u nginx -f" Enter
tmux send-keys -t "$SESSION:logs.1" "journalctl -u postgresql -f" Enter

# Return to dashboard
tmux select-window -t "$SESSION:dashboard"
tmux select-pane -t 0

tmux attach -t "$SESSION"
```

### 8.4 Long-Running Jobs on an SSH Server

```bash
# Pattern 3: Long-running jobs on an SSH server
ssh server
tmux new -s backup
./run_backup.sh
# Ctrl+b d to detach → safe to disconnect SSH
# Later: ssh server → tmux attach -t backup

# Connecting to multiple servers simultaneously
#!/bin/bash
# multi-server.sh

SESSION="servers"
SERVERS=("web1" "web2" "web3" "db1")

tmux new-session -d -s "$SESSION"

for i in "${!SERVERS[@]}"; do
    server="${SERVERS[$i]}"
    if [[ $i -eq 0 ]]; then
        tmux rename-window -t "$SESSION:0" "$server"
    else
        tmux new-window -t "$SESSION" -n "$server"
    fi
    tmux send-keys -t "$SESSION:$server" "ssh $server" Enter
done

tmux select-window -t "$SESSION:0"
tmux attach -t "$SESSION"
```

### 8.5 Pair Programming

```bash
# Pattern 4: Pair programming
# User A (session creator):
tmux new -s pair

# User B (participant):
tmux attach -t pair
# Share the same session to work while viewing the same screen

# To join in read-only mode:
tmux attach -t pair -r

# To share with independent window sizes:
# User A:
tmux new -s pair
# User B:
tmux new -s pair-b -t pair
# This allows each user to have an independent window size
```

### 8.6 tmux Command Scripting

```bash
# Send a command to tmux
tmux send-keys -t dev:editor "echo hello" Enter

# Get information about the current session
tmux display-message -p '#S'          # Session name
tmux display-message -p '#W'          # Window name
tmux display-message -p '#P'          # Pane number
tmux display-message -p '#{pane_current_path}'  # Current path

# Capture the content of a pane
tmux capture-pane -t 0 -p             # Display content of pane 0
tmux capture-pane -t 0 -p -S -100     # Last 100 lines

# Save pane content to a file
tmux capture-pane -t 0 -p -S -1000 > /tmp/pane-output.txt

# Conditional command execution
if tmux has-session -t dev 2>/dev/null; then
    tmux send-keys -t dev:server "npm restart" Enter
fi
```

---

## 9. tmux Troubleshooting

```bash
# === Problem: 256 colors not displayed ===
# Add to .tmux.conf:
# set -g default-terminal "tmux-256color"
# set -ag terminal-overrides ",xterm-256color:RGB"
# Also check the terminal emulator settings

# === Problem: Copy mode does not copy to system clipboard ===
# macOS: reattach-to-user-namespace required (old tmux)
# brew install reattach-to-user-namespace
# Not needed for newer tmux (2.6+); use the tmux-yank plugin

# === Problem: Colors look wrong in Neovim/Vim ===
# .tmux.conf:
# set -g default-terminal "tmux-256color"
# set -ag terminal-overrides ",xterm-256color:Tc"
# .vimrc:
# set termguicolors

# === Problem: Cannot select text with mouse mode ===
# When mouse mode is enabled, hold Shift while dragging
# iTerm2: hold Option while dragging

# === Problem: tmux does not start ===
tmux kill-server                 # Force-kill the server
rm -f /tmp/tmux-*/default        # Delete the socket file
tmux

# === Problem: Configuration changes are not applied ===
tmux source-file ~/.tmux.conf    # Reload configuration
# Or:
# Ctrl+b : → source-file ~/.tmux.conf

# === Debugging ===
tmux show-options -g             # List global options
tmux show-options -w             # List window options
tmux list-keys                   # List all key bindings
tmux list-commands               # List all commands
tmux info                        # Detailed tmux information
```

---

## 10. screen (For Legacy Environments)

### 10.1 Basic Operations

```bash
# screen is the predecessor to tmux. Just learn the minimum operations.

screen                           # New session
screen -S work                   # Named session
screen -ls                       # List sessions
screen -r work                   # Reattach
screen -d -r work                # Detach then reattach
screen -x work                   # Multi-attach (share with multiple users)
screen -X quit                   # End session

# Operations inside screen (Ctrl+a is the prefix)
# Ctrl+a d    → Detach
# Ctrl+a c    → New window
# Ctrl+a n    → Next window
# Ctrl+a p    → Previous window
# Ctrl+a "    → Window list
# Ctrl+a A    → Rename window
# Ctrl+a 0-9  → Switch window by number
# Ctrl+a |    → Vertical split
# Ctrl+a S    → Horizontal split
# Ctrl+a Tab  → Switch pane
# Ctrl+a X    → Close current pane
# Ctrl+a k    → Close window
# Ctrl+a [    → Copy mode
# Ctrl+a ]    → Paste
# Ctrl+a ?    → Help
```

### 10.2 screen Configuration (~/.screenrc)

```bash
# ~/.screenrc

# Scroll buffer
defscrollback 10000

# Status bar configuration
hardstatus alwayslastline
hardstatus string '%{= kG}[ %{G}%H %{g}][%{= kw}%?%-Lw%?%{r}(%{W}%n*%f%t%?(%u)%?%{r})%{w}%?%+Lw%?%?%= %{g}][%{B} %Y-%m-%d %{W}%c %{g}]'

# Visual bell
vbell on

# Encoding
defencoding utf-8
encoding utf-8

# Do not show startup message
startup_message off
```

### 10.3 Reasons to Use tmux Instead of screen

```bash
# Reasons to use tmux instead of screen:
# - Pane operations are more intuitive
# - Configuration is simpler and more readable
# - Actively developed
# - Plugin ecosystem (TPM)
# - Easier status bar customization
# - More flexible session management
# - Powerful copy mode
# - Easier scripting

# When screen is needed:
# - Old servers where tmux is not installed
# - Serial console connections (screen /dev/ttyUSB0 115200)
# - When minimal features are sufficient
```

---

## 11. Alternatives to tmux

```bash
# === Zellij ===
# A modern terminal multiplexer written in Rust
# https://zellij.dev/
# brew install zellij
# Features:
# - Intuitive UI by default
# - Key binding hints displayed at the bottom of the screen
# - WebAssembly plugin system
# - Configuration via layout files

# === byobu ===
# A wrapper for screen/tmux
# sudo apt install byobu
# Features:
# - Operate with function keys
# - Automatically uses tmux or screen as the backend
# - Automatically displays system information in the status bar

# === Wezterm ===
# A terminal emulator with built-in multiplexer functionality
# https://wezfurlong.org/wezterm/
# - GPU acceleration
# - Configure with Lua
# - Built-in multiplexer functionality
# - SSH integration

# === kitty ===
# GPU-accelerated terminal
# https://sw.kovidgoyal.net/kitty/
# - Tab and window split functionality
# - Screen splitting possible without tmux
# - Fast rendering
```

---

## 12. tmux Hooks and Event-Driven Automation

### 12.1 Hook Basics

```bash
# tmux hooks automatically run commands when events occur
# Configured with the set-hook command

# ── Available Main Hooks ──
# after-new-session      — After session creation
# after-new-window       — After window creation
# after-split-window     — After pane split
# after-kill-pane        — After pane closes
# after-select-window    — After window switch
# after-select-pane      — After pane switch
# after-resize-pane      — After pane resize
# after-copy-mode        — After copy mode ends
# client-attached        — When a client connects
# client-detached        — When a client disconnects
# client-resized         — When a client is resized
# session-closed         — When a session ends
# window-linked          — When a window is linked to a session
# window-renamed         — When a window is renamed
# pane-exited            — When the process in a pane exits
# pane-focus-in          — When a pane gains focus
# pane-focus-out         — When a pane loses focus

# ── Hook Configuration Examples ──

# Temporarily change the status bar color when a new window is created (notification effect)
set-hook -g after-new-window 'set -g status-style "bg=#2e7d32 fg=#ffffff"; run-shell "sleep 1"; set -g status-style "bg=#1e1e2e fg=#cdd6f4"'

# Automatically set window name after session creation
set-hook -g after-new-session 'rename-window "main"'

# Change pane border color on focus (highlight the active pane)
set-hook -g pane-focus-in 'select-pane -P "bg=#1a1b26"'
set-hook -g pane-focus-out 'select-pane -P "bg=default"'

# Log when a client connects
set-hook -g client-attached 'run-shell "echo $(date): attached >> ~/.tmux-access.log"'
set-hook -g client-detached 'run-shell "echo $(date): detached >> ~/.tmux-access.log"'
```

### 12.2 Practical Hook Patterns

```bash
# ── Automatic Layout Adjustment ──
# Automatically optimize layout when the window is resized
set-hook -g client-resized 'run-shell "
    width=$(tmux display -p \"#{window_width}\")
    if [ \"$width\" -lt 120 ]; then
        tmux select-layout main-horizontal
    else
        tmux select-layout main-vertical
    fi
"'

# ── Auto-Cleanup When a Pane Closes ──
# Re-adjust layout when a non-last pane closes
set-hook -g after-kill-pane 'select-layout tiled'

# ── Custom Action on Window Switch ──
# Log the previous window name when switching windows
set-hook -g after-select-window 'run-shell "echo $(date +%H:%M:%S) $(tmux display -p \"#W\") >> /tmp/tmux-window-history.log"'

# ── Work Time Tracking ──
# Record session attach/detach times to visualize work hours
# Add to ~/.tmux.conf:
set-hook -g client-attached 'run-shell "
    echo \"START $(date +%Y-%m-%d_%H:%M:%S) $(tmux display -p '#S')\" >> ~/.tmux-timetrack.log
"'
set-hook -g client-detached 'run-shell "
    echo \"END   $(date +%Y-%m-%d_%H:%M:%S) $(tmux display -p '#S')\" >> ~/.tmux-timetrack.log
"'

# Script to aggregate work hours
# #!/bin/bash
# awk '/START/{start=$2} /END/{print $3, start, "→", $2}' ~/.tmux-timetrack.log
```

---

## 13. tmux Environment Variables and Format Strings

### 13.1 Managing Environment Variables

```bash
# tmux maintains independent environment variables per session
# Two-layer structure: global environment and session environment

# ── Global Environment Variables ──
tmux set-environment -g MY_VAR "global_value"
tmux show-environment -g MY_VAR

# ── Session Environment Variables ──
tmux set-environment MY_VAR "session_value"
tmux show-environment MY_VAR

# ── List Environment Variables ──
tmux show-environment -g              # List global
tmux show-environment                 # List session

# ── Delete Environment Variables ──
tmux set-environment -g -u MY_VAR     # Delete from global
tmux set-environment -u MY_VAR        # Delete from session

# ── Auto-Update Environment Variables ──
# Update SSH_AUTH_SOCK etc. when a new client connects
set -g update-environment "SSH_AUTH_SOCK SSH_CONNECTION DISPLAY XAUTHORITY"

# Configuration to maintain SSH Agent forwarding (important)
# ~/.tmux.conf:
set -g update-environment "SSH_AUTH_SOCK SSH_AGENT_PID"
# This ensures the SSH Agent socket is correctly updated
# when attaching to tmux via a new ssh connection

# Script to manually update SSH_AUTH_SOCK
# ~/.local/bin/fix-ssh-auth
#!/bin/bash
eval $(tmux show-env -s SSH_AUTH_SOCK 2>/dev/null)
```

### 13.2 Using Format Strings

```bash
# tmux format strings use the #{...} syntax
# Available in status bars, display-message, if-shell, and more

# ── Key Format Variables ──
# #{session_name}         — Session name
# #{window_index}         — Window number
# #{window_name}          — Window name
# #{pane_index}           — Pane number
# #{pane_current_path}    — Current directory of the pane
# #{pane_current_command} — Command running in the pane
# #{pane_pid}             — PID of the pane
# #{pane_width}           — Pane width
# #{pane_height}          — Pane height
# #{window_width}         — Window width
# #{window_height}        — Window height
# #{client_width}         — Client width
# #{client_height}        — Client height
# #{cursor_x}             — Cursor X position
# #{cursor_y}             — Cursor Y position
# #{pane_in_mode}         — Whether in copy mode (0 or 1)
# #{window_zoomed_flag}   — Whether zoomed (0 or 1)
# #{session_windows}      — Number of windows in the session
# #{window_panes}         — Number of panes in the window

# ── Conditional Branching ──
# #{?condition,true-value,false-value} format for conditionals
# Display zoom status
set -g status-right '#{?window_zoomed_flag,🔍 ZOOM ,}#H %H:%M'

# Change display during copy mode
set -g status-left '#{?pane_in_mode,COPY ,}#S '

# ── String Operations ──
# #{=N:variable}   — Truncate to N characters
# #{b:variable}    — basename
# #{d:variable}    — dirname

# Display directory name in status (basename only)
set -g window-status-format '#I:#{b:pane_current_path}'
set -g window-status-current-format '#I:#{b:pane_current_path}*'

# ── Using Formats with display-message ──
tmux display-message -p "Session: #S | Window: #W (#I) | Pane: #P"
tmux display-message -p "Size: #{pane_width}x#{pane_height}"
tmux display-message -p "Path: #{pane_current_path}"
tmux display-message -p "Command: #{pane_current_command} (PID: #{pane_pid})"

# ── Custom Formats with list-windows ──
tmux list-windows -F '#I: #W (#{window_panes} panes) [#{window_width}x#{window_height}]'
tmux list-panes -F '#P: #{pane_current_command} [#{pane_width}x#{pane_height}] #{pane_current_path}'
tmux list-sessions -F '#S: #{session_windows} windows (#{session_attached} attached)'
```

---

## 14. tmux Popups and Advanced Display

### 14.1 Popup Windows (tmux 3.2+)

```bash
# The popup feature is available from tmux 3.2
# Run commands as a floating window

# ── Basic Popup ──
tmux popup                            # Open the default shell in a popup
tmux popup -w 80% -h 60%             # Specify size
tmux popup -E "htop"                  # Run a command (popup closes when it exits)
tmux popup -E -w 80% -h 80% "lazygit"   # Open lazygit as a popup

# ── Register as a Key Binding ──
# ~/.tmux.conf:

# Ctrl+b g opens lazygit as a popup
bind g popup -E -w 80% -h 80% -d "#{pane_current_path}" "lazygit"

# Ctrl+b f opens fzf file search → opens selected file in vim
bind f popup -E -w 60% -h 60% -d "#{pane_current_path}" \
    'file=$(fzf --preview "bat --color=always {}"); [ -n "$file" ] && tmux send-keys -t ! "vim $file" Enter'

# Ctrl+b j uses jq interactively (inside a popup)
bind j popup -E -w 80% -h 80% 'echo "{}" | jq -R "fromjson?" | less'

# Ctrl+b t opens a popup terminal (for quick operations)
bind t popup -E -w 60% -h 40% -d "#{pane_current_path}"

# Ctrl+b n opens a notepad in a popup
bind n popup -E -w 60% -h 60% "vim ~/notes/scratch.md"

# Ctrl+b G shows git status quickly
bind G popup -E -w 70% -h 50% -d "#{pane_current_path}" \
    "git status && echo '---' && git log --oneline -10; read -p 'Press Enter to close'"

# ── Popup Option Details ──
# -E        — Close popup when command exits
# -w WIDTH  — Width (number or percentage)
# -h HEIGHT — Height (number or percentage)
# -x X      — X position
# -y Y      — Y position
# -d DIR    — Working directory
# -b BORDER — Border style (rounded, double, heavy, simple, none)
# -s STYLE  — Border style (color, etc.)
# -S STYLE  — Style inside the popup
# -T TITLE  — Title

# Specifying border style
tmux popup -b rounded -s "fg=#a6e3a1" -T "Quick Terminal" -E -w 60% -h 50%
```

### 14.2 Menu System (tmux 3.0+)

```bash
# Display an interactive menu with tmux display-menu
# ~/.tmux.conf:

# Ctrl+b m shows a custom menu
bind m display-menu -T "#[align=centre]Actions" \
    "New Window"      w "new-window -c '#{pane_current_path}'" \
    "Kill Window"     x "kill-window" \
    "Horizontal Split" h "split-window -v -c '#{pane_current_path}'" \
    "Vertical Split"   v "split-window -h -c '#{pane_current_path}'" \
    "" \
    "Zoom Pane"       z "resize-pane -Z" \
    "Sync Panes"      s "setw synchronize-panes" \
    "" \
    "Choose Session"  S "choose-session" \
    "Choose Window"   W "choose-window" \
    "" \
    "Reload Config"   r "source-file ~/.tmux.conf; display 'Reloaded'" \
    "Edit Config"     e "popup -E -w 80% -h 80% 'vim ~/.tmux.conf'"

# Menu when right-clicking a pane
bind -n MouseDown3Pane display-menu -T "#[align=centre]Pane" -t = -x M -y M \
    "Split Horizontal" h "split-window -v -c '#{pane_current_path}'" \
    "Split Vertical"   v "split-window -h -c '#{pane_current_path}'" \
    "Close"           x "kill-pane" \
    "Zoom"            z "resize-pane -Z" \
    "Swap Up"         u "swap-pane -U" \
    "Swap Down"       d "swap-pane -D" \
    "" \
    "Copy Mode"       c "copy-mode"
```

---

## 15. Automating Session Management

### 15.1 The tmux-sessionizer Pattern

```bash
#!/bin/bash
# tmux-sessionizer — Select a project directory to create/switch a session
# An implementation based on the approach by ThePrimeagen

# Directories to search
SEARCH_DIRS=(
    "$HOME/projects"
    "$HOME/work"
    "$HOME/.dotfiles"
)

# Select a project with fzf
selected=$(find "${SEARCH_DIRS[@]}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | fzf \
    --preview 'eza -la --git --no-user --no-permissions {} 2>/dev/null || ls -la {}' \
    --preview-window right:50% \
    --header "Select project to open in tmux")

# Exit if nothing is selected
[ -z "$selected" ] && exit 0

# Create session name (directory name, dots replaced with underscores)
session_name=$(basename "$selected" | tr '.' '_')

# If tmux is not running
if ! tmux has-session 2>/dev/null; then
    tmux new-session -d -s "$session_name" -c "$selected"
    tmux attach -t "$session_name"
    exit 0
fi

# If the session already exists, attach/switch to it
if tmux has-session -t="$session_name" 2>/dev/null; then
    if [ -z "$TMUX" ]; then
        tmux attach -t "$session_name"
    else
        tmux switch-client -t "$session_name"
    fi
else
    # Create a new session
    if [ -z "$TMUX" ]; then
        tmux new-session -s "$session_name" -c "$selected"
    else
        tmux new-session -d -s "$session_name" -c "$selected"
        tmux switch-client -t "$session_name"
    fi
fi

# Register this script as a key binding:
# ~/.tmux.conf:
# bind C-f popup -E -w 80% -h 60% "~/.local/bin/tmux-sessionizer"
# Or to use outside of tmux:
# ~/.zshrc:
# bindkey -s '^f' '~/.local/bin/tmux-sessionizer\n'
```

### 15.2 Per-Project Session Configuration

```bash
# ~/.config/tmux/projects/web-project.sh
#!/bin/bash
# Session definition for a web development project

SESSION="web"
ROOT="$HOME/projects/my-web-app"

tmux_setup() {
    # Create session
    tmux new-session -d -s "$SESSION" -n "code" -c "$ROOT"

    # Code window (main workspace)
    tmux send-keys -t "$SESSION:code" "nvim ." Enter

    # Server window (front + back)
    tmux new-window -t "$SESSION" -n "server" -c "$ROOT"
    tmux split-window -h -t "$SESSION:server" -c "$ROOT"
    tmux send-keys -t "$SESSION:server.0" "cd frontend && npm run dev" Enter
    tmux send-keys -t "$SESSION:server.1" "cd backend && npm run dev" Enter

    # DB / cache window
    tmux new-window -t "$SESSION" -n "data" -c "$ROOT"
    tmux split-window -h -t "$SESSION:data" -c "$ROOT"
    tmux send-keys -t "$SESSION:data.0" "docker compose up db redis" Enter
    tmux send-keys -t "$SESSION:data.1" "lazydocker" Enter

    # Test window
    tmux new-window -t "$SESSION" -n "test" -c "$ROOT"
    tmux send-keys -t "$SESSION:test" "npm run test:watch" Enter

    # Git window
    tmux new-window -t "$SESSION" -n "git" -c "$ROOT"
    tmux send-keys -t "$SESSION:git" "lazygit" Enter

    # Return to code window
    tmux select-window -t "$SESSION:code"
}

# Attach if session already exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux attach -t "$SESSION"
else
    tmux_setup
    tmux attach -t "$SESSION"
fi
```

### 15.3 Auto-Save and Restore Sessions

```bash
# Auto-save with tmux-resurrect and tmux-continuum

# ── tmux-resurrect Configuration ──
# ~/.tmux.conf:
set -g @plugin 'tmux-plugins/tmux-resurrect'

# Extended save targets
set -g @resurrect-capture-pane-contents 'on'
set -g @resurrect-strategy-vim 'session'     # Also restore vim sessions
set -g @resurrect-strategy-nvim 'session'    # Also restore neovim sessions

# Restore additional programs
set -g @resurrect-processes 'ssh mosh "~rails s" "~rails c" "~mix phx.server"'

# Manual save: Ctrl+b Ctrl+s
# Manual restore: Ctrl+b Ctrl+r

# ── tmux-continuum Configuration ──
# ~/.tmux.conf:
set -g @plugin 'tmux-plugins/tmux-continuum'

set -g @continuum-restore 'on'          # Auto-restore when tmux starts
set -g @continuum-save-interval '10'    # Auto-save every 10 minutes
set -g @continuum-boot 'on'             # Auto-start tmux when system boots

# When using iTerm2 on macOS:
set -g @continuum-boot-options 'iterm'

# ── Save File Location ──
# Saved in ~/.tmux/resurrect/
ls -la ~/.tmux/resurrect/
# last → symbolic link to the latest save file
# tmux_resurrect_YYYYMMDDTHHMMSS.txt

# Manual backup
cp ~/.tmux/resurrect/last ~/.tmux/resurrect/backup-$(date +%Y%m%d).txt
```

### 15.4 Session Management with tmuxinator

```bash
# tmuxinator is a tool that manages session definitions with YAML
# gem install tmuxinator

# ── Create a Project ──
tmuxinator new myproject

# ── YAML Configuration File ──
# ~/.config/tmuxinator/myproject.yml
name: myproject
root: ~/projects/myproject
on_project_start: docker compose up -d
on_project_stop: docker compose down

windows:
  - editor:
      layout: main-vertical
      panes:
        - nvim .
        - git status
  - server:
      layout: even-horizontal
      panes:
        - npm run dev
        - npm run dev:api
  - logs:
      layout: even-vertical
      panes:
        - tail -f logs/app.log
        - tail -f logs/error.log
  - console:
      panes:
        - # empty shell

# ── tmuxinator Commands ──
tmuxinator start myproject       # Start session
tmuxinator stop myproject        # Stop session
tmuxinator list                  # List projects
tmuxinator edit myproject        # Edit configuration
tmuxinator delete myproject      # Delete project
tmuxinator copy myproject newprj # Duplicate project
tmuxinator doctor                # Check for configuration issues
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also create test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Applied Pattern

Extend the basic implementation to add the following functionality.

```python
# Exercise 2: Applied pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for applied patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured configuration file | Check the configuration file path and format |
| Timeout | Network delay / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify incrementally**: Use log output or a debugger to validate hypotheses
5. **Fix and run regression tests**: After fixing, also run tests for related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function input/output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debugging target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance problems:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O wait**: Check the state of disk and network I/O
4. **Check concurrent connections**: Check the state of connection pools

| Problem Type | Diagnostic Tool | Solution |
|-------------|----------------|----------|
| CPU load | cProfile, py-spy | Improve algorithm, parallelize |
| Memory leak | tracemalloc, objgraph | Release references properly |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexes, query optimization |
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not only through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Operation | tmux Key | Command |
|-----------|----------|---------|
| Create session | - | tmux new -s name |
| Detach | Ctrl+b d | - |
| Attach | - | tmux attach -t name |
| Horizontal split | Ctrl+b " | split-window -v |
| Vertical split | Ctrl+b % | split-window -h |
| Move pane | Ctrl+b arrow | select-pane -[LRUD] |
| Zoom pane | Ctrl+b z | resize-pane -Z |
| Create window | Ctrl+b c | new-window |
| Switch window | Ctrl+b 0-9 | select-window -t N |
| Copy mode | Ctrl+b [ | - |
| Window list | Ctrl+b w | - |
| Session list | Ctrl+b s | tmux ls |
| Reload config | Ctrl+b r | source-file ~/.tmux.conf |
| Enter command | Ctrl+b : | - |

---

## What to Read Next

---

## References
1. Hogan, B. "tmux 2: Productive Mouse-Free Development." Pragmatic Bookshelf, 2016.
2. "tmux Wiki." github.com/tmux/tmux/wiki.
3. "Awesome tmux." github.com/rothgar/awesome-tmux.
4. "tmux man page." man7.org/linux/man-pages/man1/tmux.1.html.
5. Barrett, D. "Efficient Linux at the Command Line." Ch.8, O'Reilly, 2022.
