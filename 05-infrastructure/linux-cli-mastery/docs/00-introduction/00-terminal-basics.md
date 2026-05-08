# Terminal and Shell Basics

> A terminal is "a window for interacting with your computer via text," while a shell is "an interpreter that parses and executes commands." Accurately understanding these two concepts is the first step toward efficiently mastering Linux/Unix command-line operations.

## What You Will Learn in This Chapter

- [ ] Accurately explain the differences between terminal, shell, and console
- [ ] Understand the history of shells and the characteristics of various shell types
- [ ] Understand the basic structure of commands and how they are executed
- [ ] Use input/output, redirects, and pipes effectively
- [ ] Operate the shell efficiently using keyboard shortcuts
- [ ] Understand environment variables and the internal workings of the shell
- [ ] Select and configure a terminal emulator


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Core Concepts — Understanding Terminal, Shell, and Console Accurately

### 1.1 Terminal (Terminal Emulator)

```
What is a terminal:
  A program (GUI application) that handles text input and output
  A software recreation of physical terminals (VT100, VT220, etc.)

  Historical background:
  1960s-70s: Physical terminals connected to mainframes (teletype, TTY)
  1980s:     Video terminals (VT100, etc.) emerged
  1990s-:    "Terminal emulators" running on GUIs became mainstream

  Representative terminal emulators:
  ┌────────────────────┬────────────────────────────────────┐
  │ Emulator           │ Features                           │
  ├────────────────────┼────────────────────────────────────┤
  │ iTerm2             │ macOS. Split panes, search, autocomplete │
  │ Alacritty          │ GPU rendering. Fast. Written in Rust │
  │ Warp               │ AI integration. Modern UI. macOS/Linux │
  │ Windows Terminal   │ Official Windows. Tabs, split panes │
  │ GNOME Terminal     │ GNOME default. Stable              │
  │ Konsole            │ KDE default. Feature-rich          │
  │ kitty              │ GPU rendering. Image display support │
  │ WezTerm            │ Written in Rust. Cross-platform    │
  │ Hyper              │ Electron-based. Extensible via web tech │
  │ Terminator         │ Focused on split panes. Written in Python │
  └────────────────────┴────────────────────────────────────┘

  Legacy of TTY (Teletypewriter):
  $ tty                    # Display the current terminal device
  /dev/pts/0               # Virtual terminal (pseudo-terminal slave)
  /dev/tty1                # Virtual console

  $ who                    # Logged-in users and their terminals
  gaku     pts/0        2026-02-15 10:00 (192.168.1.100)
  gaku     tty1         2026-02-15 09:00

  pts = pseudo-terminal slave (via SSH, terminal emulator)
  tty = virtual console (equivalent to physical terminal)
```

### 1.2 Shell

```
What is a shell:
  A program that interprets and executes commands (command-line interpreter)
  The "shell" sitting between the user and the kernel

  Roles of the shell:
  1. Parsing the command line
  2. Variable expansion and command substitution
  3. Setting up redirects and pipes
  4. Executing programs (fork + exec)
  5. Job control
  6. Script execution (functionality as a programming language)

  Shell history:
  ┌──────┬───────────────────────┬──────────────────────────────────┐
  │ Year │ Shell                 │ Features                         │
  ├──────┼───────────────────────┼──────────────────────────────────┤
  │ 1971 │ Thompson Shell        │ The first Unix shell             │
  │ 1977 │ Bourne Shell (sh)     │ Scripting language features. POSIX foundation │
  │ 1978 │ C Shell (csh)         │ C-like syntax. BSD lineage       │
  │ 1983 │ Korn Shell (ksh)      │ sh-compatible + csh conveniences │
  │ 1989 │ Bash                  │ GNU version of sh. Linux standard │
  │ 1990 │ Zsh                   │ The most powerful interactive shell │
  │ 2005 │ Fish                  │ User-friendly design             │
  │ 2019 │ Nushell               │ Structured data processing. Written in Rust │
  │ 2021 │ Oil Shell             │ bash-compatible + modern syntax  │
  └──────┴───────────────────────┴──────────────────────────────────┘

  Check the current shell:
  $ echo $SHELL             # Login shell (set in /etc/passwd)
  /bin/zsh

  $ echo $0                 # Currently running shell
  -zsh

  $ cat /etc/shells         # List of available shells
  /bin/sh
  /bin/bash
  /bin/zsh
  /usr/bin/fish

  Changing the shell:
  $ chsh -s /bin/zsh        # Change login shell to zsh
  $ exec bash               # Switch to another shell for the current session only
```

### 1.3 Console

```
What is a console:
  A combination of a physical keyboard and screen, or its virtual equivalent
  A terminal for directly operating a server in a server room

  Virtual consoles (Linux):
  Ctrl+Alt+F1   → tty1 (GUI runs here on many distributions)
  Ctrl+Alt+F2   → tty2 (text console)
  ...
  Ctrl+Alt+F6   → tty6 (text console)

  Use cases:
  - Emergency operations when the GUI is frozen
  - Direct server access (data center)
  - Installer operations
  - Debugging during kernel panic

  Serial console:
  - Connection via physical serial port (RS-232)
  - Essential for server management when the network is down
  - Remote consoles via BMC/IPMI/iLO/iDRAC follow the same concept
```

### 1.4 Relationship Between the Three

```
Relationship diagram:

  ┌─────────────────────────────────────────────────┐
  │            Terminal Emulator                     │
  │  (iTerm2 / Alacritty / Windows Terminal)        │
  │                                                 │
  │  ┌─────────────────────────────────────────┐    │
  │  │              Shell (zsh/bash)           │    │
  │  │                                         │    │
  │  │  $ ls -la /home/user                    │    │
  │  │  total 48                               │    │
  │  │  drwxr-xr-x 12 user user 4096 ...      │    │
  │  │                                         │    │
  │  │  ┌─────────────────────────────────┐    │    │
  │  │  │  External Commands / Programs   │    │    │
  │  │  │  (ls, grep, git, python...)     │    │    │
  │  │  └─────────────────────────────────┘    │    │
  │  │                                         │    │
  │  └─────────────────────────────────────────┘    │
  │                                                 │
  └─────────────────────────────────────────────────┘
                         │
                         ↓
  ┌─────────────────────────────────────────────────┐
  │              Kernel (Linux Kernel)               │
  │     System calls → Hardware control             │
  └─────────────────────────────────────────────────┘

  Processing flow:
  1. User inputs keystrokes into the terminal
  2. The terminal passes input to the shell
  3. The shell parses the command
  4. The shell creates a process with fork()
  5. The child process runs the command via exec()
  6. The command's output is returned through the shell to the terminal
  7. The terminal renders the output on screen
```

---

## 2. Basic Command Structure

### 2.1 General Command Syntax

```bash
# Basic command structure
$ command [options] [arguments]

# Concrete example
$ ls -la /home/user
#  │   │   └── argument (target directory)
#  │   └── options (-l: long format, -a: include hidden files)
#  └── command

# Option formats
# Short form (single character): one hyphen
$ ls -l
$ ls -a
$ ls -la                    # Short options can be combined
$ ls -l -a                  # Same as above, separated

# Long form (word): two hyphens
$ ls --long
$ ls --all
$ ls --all --long           # Long options cannot be combined

# Options that take a value
$ grep -n "pattern" file    # Short form (space-separated)
$ grep -n"pattern" file     # Short form (no space, possible with some commands)
$ grep --line-number=5 file # Long form (connected with =)

# Meaning of -- (end-of-options marker)
$ rm -- -dangerous-file     # Treat a hyphen-prefixed filename as an argument
$ grep -- "-pattern" file   # Search for a pattern starting with a hyphen
```

### 2.2 Types of Commands and Precedence

```bash
# Use the type command to check the kind of a command
$ type cd
cd is a shell builtin

$ type ls
ls is aliased to 'ls --color=auto'

$ type grep
grep is /usr/bin/grep

$ type -a echo              # Show all commands with the same name
echo is a shell builtin
echo is /usr/bin/echo
echo is /bin/echo

# Command execution precedence (highest to lowest):
# 1. Aliases (alias)
# 2. Functions (function)
# 3. Built-in commands (builtin)
# 4. Hash table cache
# 5. External commands on PATH

# Force a specific type to run
$ \ls                       # Run the external ls command, ignoring aliases
$ command ls                # Ignore aliases and functions
$ builtin echo "hello"     # Force use of the built-in version
$ /usr/bin/echo "hello"    # Specify the external command directly by full path

# Check paths with which / whereis
$ which python3             # First matching path
/usr/bin/python3

$ which -a python3          # All matching paths
/usr/bin/python3
/usr/local/bin/python3

$ whereis python3           # Binary + manual + source
python3: /usr/bin/python3 /usr/lib/python3 /usr/share/man/man1/python3.1.gz
```

### 2.3 Command Chaining and Control Operators

```bash
# Semicolon: sequential execution (runs regardless of the previous command's success)
$ mkdir test; cd test; touch file.txt

# && (AND): run the next command only if the previous succeeded
$ mkdir project && cd project && git init
# If mkdir fails, cd is not executed

# || (OR): run the next command only if the previous failed
$ cd /nonexistent || echo "Directory not found"

# Combined pattern
$ make && make test || echo "Build or test failed"

# Grouping
$ { command1; command2; }         # Run in the current shell
$ (command1; command2)            # Run in a subshell

# Practical usage examples
# Sequential commands like a deploy script
$ git pull && npm install && npm run build && echo "Deploy ready" || echo "Error occurred"

# Temporarily change directory in a subshell
$ (cd /tmp && wget https://example.com/file.tar.gz && tar xzf file.tar.gz)
# Automatically returns to the original directory

# Exit status of multiple commands
$ echo $?                    # Exit status of the previous command
0                            # 0 = success, 1-255 = failure

# PIPESTATUS (bash) / pipestatus (zsh) for pipeline stage statuses
$ false | true | false
$ echo ${PIPESTATUS[@]}      # bash
1 0 1
$ echo ${pipestatus[@]}      # zsh
1 0 1
```

### 2.4 Basic Command Reference

```bash
# === Information ===
$ pwd                         # Current directory (Print Working Directory)
/home/gaku/projects

$ ls                          # List files
$ ls -la                      # Long format + hidden files
$ ls -lah                     # Human-readable sizes
$ ls -lt                      # Sorted by modification time
$ ls -lS                      # Sorted by size
$ ls -R                       # Recursive listing

$ echo "Hello, World!"        # Print a string
$ echo -e "Line1\nLine2"      # Interpret escape sequences
$ echo -n "no newline"        # No trailing newline

$ date                        # Display date and time
Sun Feb 15 10:30:00 JST 2026
$ date +"%Y-%m-%d %H:%M:%S"   # Formatted output
2026-02-15 10:30:00
$ date -u                     # Display in UTC
$ date -d "2 days ago"        # Relative date (GNU date)

$ whoami                      # Current username
gaku

$ id                          # UID, GID, group memberships
uid=1000(gaku) gid=1000(gaku) groups=1000(gaku),27(sudo),998(docker)

$ hostname                    # Hostname
dev-server

$ uname -a                    # Kernel information
Linux dev-server 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux

$ uptime                      # Uptime and load average
10:30:00 up 45 days, 3:22, 2 users, load average: 0.15, 0.10, 0.05

$ cat /etc/os-release         # Distribution information
NAME="Ubuntu"
VERSION="22.04.3 LTS (Jammy Jellyfish)"

# === File Operations (Basic) ===
$ cd /path/to/dir             # Change directory
$ cd ~                        # Return to home (same as cd alone)
$ cd -                        # Return to the previous directory
$ cd ..                       # Move to the parent directory
$ cd ../..                    # Move two levels up

$ touch newfile.txt           # Create an empty file / update timestamp
$ mkdir newdir                # Create a directory
$ mkdir -p a/b/c              # Create intermediate directories as needed

$ cp file1 file2              # Copy a file
$ cp -r dir1 dir2             # Copy a directory
$ mv file1 file2              # Move / rename
$ rm file                     # Delete a file
$ rm -r dir                   # Delete a directory (recursive)
$ rm -rf dir                  # Force recursive deletion (use with caution)

# === Help ===
$ command --help              # Brief help
$ man command                 # Manual page
$ info command                # GNU info documentation
$ apropos keyword             # Search for commands by keyword
$ whatis command              # One-line description of a command
```

---

## 3. Input/Output and Redirects

### 3.1 File Descriptors and Standard Streams

```
Unix/Linux I/O model:
  All I/O is performed through "file descriptors (fd)"

  Standard streams:
  ┌────────┬──────┬────────────────┬─────────────────────┐
  │ Name   │ fd   │ Default        │ Purpose             │
  ├────────┼──────┼────────────────┼─────────────────────┤
  │ stdin  │ 0    │ Keyboard       │ Input to programs   │
  │ stdout │ 1    │ Screen         │ Normal output       │
  │ stderr │ 2    │ Screen         │ Error messages      │
  └────────┴──────┴────────────────┴─────────────────────┘

  fd 3 and above can be used freely by programs

  ┌──────────┐     stdin(0)     ┌──────────┐     stdout(1)    ┌─────────┐
  │ Keyboard ├────────────────→│  Process  ├────────────────→│ Screen  │
  └──────────┘                  │  (bash)   ├────────────────→│         │
                               └──────────┘     stderr(2)    └─────────┘
```

### 3.2 Output Redirection

```bash
# Write stdout to a file (overwrite)
$ echo "Hello" > output.txt
$ ls -la > filelist.txt

# Append stdout to a file
$ echo "World" >> output.txt
$ date >> logfile.txt

# Write stderr to a file
$ ls /nonexistent 2> error.log

# Write stdout and stderr to separate files
$ command > stdout.log 2> stderr.log

# Write stdout and stderr to the same file
$ command &> combined.log          # bash 4+
$ command > combined.log 2>&1      # POSIX-compatible (order matters!)
# Note: 2>&1 > file does not work as intended

# Merge stderr into stdout (useful for piping)
$ command 2>&1 | grep "Error"

# Discard output
$ command > /dev/null              # Discard stdout
$ command 2> /dev/null             # Discard stderr
$ command &> /dev/null             # Discard both

# Practical example: output control in a cron job
# Successful logs to file, errors trigger email notification
$ /usr/local/bin/backup.sh > /var/log/backup.log 2> /var/log/backup-error.log

# Practical example: show only errors from a noisy command
$ find / -name "*.conf" 2>/dev/null          # Hide "Permission denied"
$ docker build . 2>&1 | tee build.log        # Display on screen + save log
```

### 3.3 Input Redirection

```bash
# Read stdin from a file
$ wc -l < /etc/passwd                # Count lines in a file
$ sort < unsorted.txt > sorted.txt   # Sort and write to another file

# Here document (pass multiple lines of text as stdin)
$ cat <<EOF
Hello, $(whoami)!
Today is $(date +%Y-%m-%d).
Current directory: $(pwd)
EOF

# Here document with variable expansion suppressed
$ cat <<'EOF'
Variables are not expanded: $HOME
Command substitution is also disabled: $(whoami)
EOF

# Creating a file with a here document (common in practice)
$ cat <<'EOF' > /etc/nginx/conf.d/app.conf
server {
    listen 80;
    server_name app.example.com;
    location / {
        proxy_pass http://localhost:3000;
    }
}
EOF

# Here string (pass a single line as stdin)
$ wc -w <<< "Hello World"           # Word count → 2
$ grep "pattern" <<< "$variable"     # Search the contents of a variable

# Practical example: running SQL queries
$ mysql -u root -p database <<EOF
SELECT COUNT(*) FROM users WHERE created_at > '2026-01-01';
SELECT name, email FROM users ORDER BY created_at DESC LIMIT 10;
EOF

# Practical example: running commands on a remote server via SSH
$ ssh webserver <<'EOF'
cd /var/log
tail -100 nginx/error.log
df -h
free -h
EOF
```

### 3.4 Pipes

```bash
# Basic pipe: connect the stdout of the left command to the stdin of the right
$ ls -la | less                      # View long output in a pager

# Building a pipeline (process step by step)
$ cat access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -10
#                  │                 │       │           │        │
#                  Extract IP        Sort    Count dups  Sort desc  Top 10

# Practical example: log analysis pipeline
# Top 10 URLs with 404 errors from an Apache access log
$ grep " 404 " access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -10

# Practical example: process monitoring
$ ps aux | grep "[n]ginx" | awk '{print $2, $11}'

# Practical example: directories with the most disk usage
$ du -sh /var/* 2>/dev/null | sort -rh | head -10

# tee command: send output to both screen and file
$ ls -la | tee filelist.txt              # Display on screen and save to file
$ make 2>&1 | tee build.log             # Save build logs
$ command | tee -a logfile.txt           # Append mode

# Named pipes (FIFO)
$ mkfifo /tmp/mypipe
# Terminal 1:
$ cat /tmp/mypipe
# Terminal 2:
$ echo "Hello via pipe" > /tmp/mypipe

# xargs: pass pipeline input as arguments
$ find . -name "*.log" | xargs rm        # Delete found files
$ find . -name "*.log" -print0 | xargs -0 rm   # Handle filenames with spaces
$ cat urls.txt | xargs -n1 curl -O       # Download files from a URL list
$ cat servers.txt | xargs -I{} ssh {} "uptime"  # Run on multiple servers
```

### 3.5 Command Substitution

```bash
# $() form (recommended)
$ echo "Today is $(date +%Y-%m-%d)"
Today is 2026-02-15

$ echo "There are $(ls | wc -l) files here"
There are 42 files here

# Backtick form (legacy, not recommended)
$ echo "Today is `date`"       # Hard to nest, so not recommended

# Nested example
$ echo "Kernel: $(uname -r), Uptime: $(uptime | awk '{print $3}')"

# Storing in a variable
$ current_branch=$(git branch --show-current)
$ file_count=$(find . -name "*.py" | wc -l)
$ latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "no tags")

# Practical example: date-stamped backup
$ tar czf "backup-$(date +%Y%m%d-%H%M%S).tar.gz" /var/www/html

# Practical example: dynamic filename
$ mv report.csv "report-$(hostname)-$(date +%Y%m%d).csv"

# Process substitution (bash, zsh)
# Treat <() as a temporary file
$ diff <(sort file1.txt) <(sort file2.txt)    # Compare after sorting
$ comm <(sort list1.txt) <(sort list2.txt)     # Show common/different entries

# Practical example: compare configuration on two servers
$ diff <(ssh server1 "cat /etc/nginx/nginx.conf") \
       <(ssh server2 "cat /etc/nginx/nginx.conf")

# Practical example: merge from multiple sources
$ sort -m <(sort file1.txt) <(sort file2.txt) <(sort file3.txt) > merged.txt
```

---

## 4. Keyboard Shortcuts

### 4.1 The Readline Library

```
Shell keyboard shortcuts are provided by the GNU Readline library
Many shortcuts are common between bash and zsh (zsh uses ZLE: Zsh Line Editor)

Readline configuration: ~/.inputrc
Check zsh key bindings: bindkey

Two modes:
  Emacs mode (default): Ctrl/Alt key-based
  Vi mode: vi modal operations

Checking/switching modes:
  $ set -o                   # List current options
  $ set -o emacs             # Switch to Emacs mode
  $ set -o vi                # Switch to Vi mode
```

### 4.2 Cursor Movement

```
Cursor movement in Emacs mode (default):

  ┌───────────────┬────────────────────────────────────┐
  │ Shortcut      │ Action                             │
  ├───────────────┼────────────────────────────────────┤
  │ Ctrl + A      │ Move to beginning of line          │
  │ Ctrl + E      │ Move to end of line                │
  │ Ctrl + F      │ Move forward one character (like →) │
  │ Ctrl + B      │ Move backward one character (like ←) │
  │ Alt + F       │ Move forward one word              │
  │ Alt + B       │ Move backward one word             │
  │ Ctrl + XX     │ Toggle between beginning of line and cursor │
  └───────────────┴────────────────────────────────────┘

  Practical tips:
  When you want to fix the command name at the beginning of a long command:
  → Press Ctrl+A to go to the beginning → fix it → press Ctrl+E to return to the end

  When you want to fix something in the middle of a path:
  → Alt+B to move back word by word is more efficient
```

### 4.3 Text Editing

```
Editing shortcuts:

  ┌───────────────┬────────────────────────────────────────┐
  │ Shortcut      │ Action                                 │
  ├───────────────┼────────────────────────────────────────┤
  │ Ctrl + U      │ Delete from cursor to beginning of line (kill ring) │
  │ Ctrl + K      │ Delete from cursor to end of line      │
  │ Ctrl + W      │ Delete one word before the cursor      │
  │ Alt + D       │ Delete one word after the cursor       │
  │ Ctrl + D      │ Delete character at cursor (like DEL)  │
  │ Ctrl + H      │ Delete character before cursor (like BS) │
  │ Ctrl + Y      │ Paste the most recently cut text       │
  │ Alt + Y       │ Paste the previous item from the kill ring │
  │ Ctrl + T      │ Swap the two characters before/after cursor │
  │ Alt + T       │ Swap the two words before/after cursor │
  │ Alt + U       │ Uppercase from cursor to end of word   │
  │ Alt + L       │ Lowercase from cursor to end of word   │
  │ Alt + C       │ Capitalize the character at cursor     │
  │ Ctrl + _      │ Undo (revert the last edit)            │
  └───────────────┴────────────────────────────────────────┘

  The kill ring concept:
  Text deleted with Ctrl+U, Ctrl+K, Ctrl+W, etc. is stored
  in the "kill ring"
  Ctrl+Y pastes the most recently cut content
  Alt+Y cycles through the kill ring

  Practical pattern:
  # Reusing part of a long command in a new command
  $ scp user@server:/path/to/long/filename.tar.gz .
  # ↑ Use Ctrl+W to delete the filename, type the new command, then Ctrl+Y to paste it back
```

### 4.4 History Operations

```
History shortcuts:

  ┌────────────────┬─────────────────────────────────────────┐
  │ Shortcut       │ Action                                  │
  ├────────────────┼─────────────────────────────────────────┤
  │ Ctrl + R       │ Reverse incremental history search      │
  │ Ctrl + S       │ Forward history search (requires stty -ixon) │
  │ Ctrl + P       │ Previous command (like ↑)               │
  │ Ctrl + N       │ Next command (like ↓)                   │
  │ Alt + .        │ Insert the last argument of the previous command │
  │ Ctrl + G       │ Cancel search                           │
  └────────────────┴─────────────────────────────────────────┘

  History expansion (event designators):
  !!               Re-run the entire previous command
  !$               Last argument of the previous command
  !^               First argument of the previous command
  !*               All arguments of the previous command
  !n               Command with history number n
  !-n              The command n entries back
  !string          The most recent command starting with string
  !?string         The most recent command containing string
  ^old^new         Replace old with new in the previous command and run it

  Commonly used patterns in practice:
  $ cat /etc/nginx/nginx.conf       # View a file
  $ sudo !!                          # Re-run with sudo after a permission error
  → sudo cat /etc/nginx/nginx.conf

  $ mkdir /var/www/newsite
  $ cd !$                            # Move into the created directory
  → cd /var/www/newsite

  $ vim /etc/nginx/sites-available/default
  $ cp !$ !$:r.bak                   # Copy the same file with a .bak extension
  → cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak

  $ ls file1.txt file2.txt file3.txt
  $ chmod 644 !*                     # Reuse all arguments
  → chmod 644 file1.txt file2.txt file3.txt

  History settings (.bashrc):
  export HISTSIZE=100000              # Number of history entries in memory
  export HISTFILESIZE=200000          # Number of history entries in file
  export HISTCONTROL=ignoreboth       # Ignore duplicates and lines starting with space
  export HISTTIMEFORMAT="%F %T "      # Add timestamps
  shopt -s histappend                 # Append instead of overwriting

  History commands:
  $ history                           # Show all history
  $ history 20                        # Show last 20 entries
  $ history | grep "docker"           # Search history for docker commands
  $ fc -l -20                         # Last 20 entries (numbered)
  $ fc -e vim 100 110                 # Edit and run history entries 100-110 in vim
```

### 4.5 Process Control

```
Process control shortcuts:

  ┌───────────────┬──────────────────────────────────────────┐
  │ Shortcut      │ Action                                   │
  ├───────────────┼──────────────────────────────────────────┤
  │ Ctrl + C      │ Send SIGINT (interrupt foreground process) │
  │ Ctrl + Z      │ Send SIGTSTP (suspend → control with bg/fg) │
  │ Ctrl + D      │ Send EOF (end of input / exit shell)     │
  │ Ctrl + \      │ Send SIGQUIT (force quit with core dump) │
  │ Ctrl + S      │ Pause screen output (XOFF)               │
  │ Ctrl + Q      │ Resume screen output (XON)               │
  └───────────────┴──────────────────────────────────────────┘

  Usage guidelines:
  Ctrl+C: Normal interruption. Sufficient in most cases
  Ctrl+Z: Suspend and resume later with bg/fg
  Ctrl+\: Last resort when Ctrl+C doesn't work
  Ctrl+D: End input for commands like cat

  Practical patterns:
  # Move a long-running command to the background
  $ python train_model.py
  # (Press Ctrl+Z to suspend)
  [1]+  Stopped     python train_model.py
  $ bg                                # Resume in the background
  $ disown                            # Continue after the shell exits

  # When the screen is frozen (accidentally pressed Ctrl+S)
  # → Press Ctrl+Q to recover
```

### 4.6 Other Useful Shortcuts

```
Screen control:
  Ctrl + L          Clear screen (same as the clear command)

Tab completion:
  Tab               Complete command/filename
  Tab Tab           Show list of candidates
  Alt + ?           Show list of completion candidates

zsh-specific conveniences:
  Tab               Menu completion (cycle through candidates with Tab)
  Ctrl + X Ctrl + E Edit the command line in an editor
                    (opens $EDITOR; saves and closes to execute)

Example useful bindings (.zshrc):
  # Edit command line in editor with Ctrl+X Ctrl+E
  autoload -z edit-command-line
  zle -N edit-command-line
  bindkey "^X^E" edit-command-line

  # Alternative for Alt+. (when Alt is unavailable in macOS Terminal)
  bindkey '\e.' insert-last-word
```

---

## 5. Environment Variables and Shell Variables

### 5.1 Variable Basics

```bash
# Shell variables: valid only in the current shell process
$ myvar="Hello"
$ echo $myvar
Hello

# Environment variables: inherited by child processes
$ export MY_ENV_VAR="World"
$ bash -c 'echo $MY_ENV_VAR'   # Accessible from child processes
World

# Defining and referencing variables
$ name="gaku"
$ echo "Hello, $name"           # Expanded inside double quotes
Hello, gaku
$ echo 'Hello, $name'           # Not expanded inside single quotes
Hello, $name

# Explicitly marking variable name boundaries
$ echo "File: ${name}_report.txt"
File: gaku_report.txt

# Setting default values
$ echo ${UNDEFINED_VAR:-"default value"}   # Use default if undefined
default value
$ echo ${UNDEFINED_VAR:="default value"}   # Assign default if undefined
default value
$ echo ${REQUIRED_VAR:?"Error: required variable is undefined"}  # Error if undefined

# String operations
$ path="/home/gaku/documents/report.txt"
$ echo ${path##*/}              # Remove longest prefix match (get filename)
report.txt
$ echo ${path%/*}               # Remove shortest suffix match (get directory)
/home/gaku/documents
$ echo ${path%.txt}.pdf         # Change extension
/home/gaku/documents/report.pdf
$ echo ${path/gaku/user}        # Replace the first match
/home/user/documents/report.txt
$ echo ${path//\//|}            # Replace all matches
|home|gaku|documents|report.txt
$ echo ${#path}                 # String length
38
```

### 5.2 Important Environment Variables

```bash
# PATH: command search path (colon-separated)
$ echo $PATH
/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

# Adding to PATH (.bashrc / .zshrc)
$ export PATH="$HOME/.local/bin:$PATH"     # Prepend (higher priority)
$ export PATH="$PATH:/opt/tools/bin"       # Append

# HOME: home directory
$ echo $HOME
/home/gaku

# USER: username
$ echo $USER
gaku

# SHELL: login shell
$ echo $SHELL
/bin/zsh

# EDITOR / VISUAL: default editor
$ export EDITOR=vim
$ export VISUAL=vim

# LANG / LC_*: locale settings
$ echo $LANG
ja_JP.UTF-8
$ locale                        # Show all locale settings

# TERM: terminal type
$ echo $TERM
xterm-256color

# PS1: prompt string
# bash
$ export PS1="\u@\h:\w\$ "     # user@host:directory$
# zsh
$ export PROMPT='%n@%m:%~%# '

# Display all environment variables
$ env                           # Environment variables only
$ set                           # Shell variables + environment variables
$ printenv                      # Same as env
$ export -p                     # Exported variables
$ printenv PATH                 # A specific environment variable

# Remove an environment variable
$ unset MY_VAR                  # Delete the variable
```

### 5.3 Special Variables

```bash
# Special shell variables (frequently used in scripts)
$ echo $?                # Exit status of the previous command (0 = success)
$ echo $$                # PID of the current shell
$ echo $!                # PID of the last backgrounded process
$ echo $-                # Current shell option flags
$ echo $0                # Shell name or script name

# Used inside scripts
$ echo $#                # Number of arguments
$ echo $@                # All arguments (individually quoted)
$ echo $*                # All arguments (quoted as one)
$ echo $1 $2 $3          # Positional parameters (1st, 2nd, 3rd argument)

# Difference between $@ and $* (important)
# "$@" → "$1" "$2" "$3" (expanded as individual strings)
# "$*" → "$1 $2 $3"     (expanded as a single string)

# RANDOM: a random integer (0-32767)
$ echo $RANDOM
16384

# SECONDS: seconds elapsed since the shell started
$ echo $SECONDS
3600

# LINENO: current line number (inside a script)
$ echo $LINENO
42

# BASH_VERSION / ZSH_VERSION
$ echo $BASH_VERSION
5.1.16(1)-release
$ echo $ZSH_VERSION
5.9
```

---

## 6. Glob (Wildcard) Patterns

### 6.1 Basic Patterns

```bash
# * : any string (zero or more characters)
$ ls *.txt                  # Files ending in .txt
$ ls test*                  # Files starting with test
$ ls *report*               # Files containing report

# ? : any single character
$ ls file?.txt              # file1.txt, fileA.txt, etc.
$ ls ???.md                 # Filenames of exactly 3 characters + .md

# [] : character class (any one character in brackets)
$ ls file[123].txt          # file1.txt, file2.txt, file3.txt
$ ls file[a-z].txt          # filea.txt, fileb.txt, ...
$ ls file[!0-9].txt         # One non-digit character (negation)
$ ls file[^0-9].txt         # Same (bash)

# {} : brace expansion (shell expansion, not glob)
$ echo file{1,2,3}.txt      # file1.txt file2.txt file3.txt
$ echo {a..z}               # a b c ... z
$ echo {1..10}              # 1 2 3 ... 10
$ echo {01..10}             # 01 02 03 ... 10 (zero-padded)
$ echo {a..z..2}            # a c e g ... (step 2)
$ mkdir -p project/{src,test,docs}/{main,utils}  # Create directory tree

# Combined examples
$ cp *.{jpg,png,gif} /backup/images/
$ mv report-{2024,2025,2026}-*.csv archive/
```

### 6.2 Extended Glob (bash: shopt -s extglob / zsh: enabled by default)

```bash
# Enable extended glob in bash
$ shopt -s extglob

# ?(pattern) : match zero or one time
$ ls file?(s).txt            # file.txt, files.txt

# *(pattern) : match zero or more times
$ ls file*(s).txt            # file.txt, files.txt, filess.txt, ...

# +(pattern) : match one or more times
$ ls file+(s).txt            # files.txt, filess.txt, ...

# @(pattern1|pattern2) : match exactly one of
$ ls *.@(jpg|png|gif)        # .jpg, .png, or .gif
$ rm !(important)*.log       # Delete .log files not named important

# !(pattern) : match anything not matching the pattern
$ ls !(*.txt)                # Files other than .txt
$ rm !(README.md|LICENSE)    # Delete everything except README.md and LICENSE

# zsh extended glob (setopt EXTENDED_GLOB)
$ ls **/*.py                 # Recursively find Python files
$ ls **/*(.)                 # Regular files only (recursive)
$ ls **/*(/)                 # Directories only (recursive)
$ ls *(om[1,10])             # 10 most recently modified files
$ ls *(Lk+100)               # Files larger than 100KB
```

### 6.3 dotglob and nullglob

```bash
# By default, * does not match hidden files (starting with .)
$ ls *                       # .bashrc etc. are not shown

# bash: enable dotglob
$ shopt -s dotglob
$ ls *                       # Includes hidden files

# zsh: enable GLOB_DOTS
$ setopt GLOB_DOTS

# nullglob: return an empty string when there are no matches
# bash
$ shopt -s nullglob
$ files=(*.xyz)              # Array is empty if there are no matches
$ echo ${#files[@]}          # 0

# zsh (errors by default; use NULL_GLOB to return empty)
$ setopt NULL_GLOB

# failglob (bash): error when there are no matches
$ shopt -s failglob
$ ls *.xyz                   # bash: no match: *.xyz
```

---

## 7. Selecting and Configuring a Terminal Emulator

### 7.1 Comparing Major Terminal Emulators

```
Detailed comparison:

┌────────────┬────────┬──────────┬───────────┬────────────────────────┐
│ Name       │ OS     │ Renderer │ Config    │ Key Features           │
├────────────┼────────┼──────────┼───────────┼────────────────────────┤
│ iTerm2     │ macOS  │ Metal    │ GUI/JSON  │ Split/profiles/search  │
│ Alacritty  │ All    │ OpenGL   │ TOML      │ Very fast/light/simple │
│ kitty      │ Lin/mac│ OpenGL   │ conf      │ Images/ligatures       │
│ WezTerm    │ All    │ OpenGL   │ Lua       │ Lua config/multiplexer │
│ Warp       │ mac/Lin│ GPU      │ YAML      │ AI integration/blocks  │
│ Win Term   │ Win    │ DirectX  │ JSON      │ MS official/tabs/split │
│ GNOME Term │ Linux  │ VTE      │ dconf     │ Stable/GNOME integrated│
│ Konsole    │ Linux  │ Qt       │ rc file   │ KDE/feature-rich       │
│ Terminator │ Linux  │ VTE      │ conf      │ Split pane specialist  │
│ foot       │ Linux  │ Wayland  │ ini       │ Wayland-only/ultralight│
│ Hyper      │ All    │ Electron │ JS        │ Extensible via web tech│
│ Rio        │ All    │ WGPU     │ TOML      │ Rust/WebGPU rendering  │
└────────────┴────────┴──────────┴───────────┴────────────────────────┘

Selection guidelines:
  Developer (macOS)       → iTerm2 or Warp or Alacritty
  Developer (Linux)       → Alacritty or kitty or WezTerm
  Windows                 → Windows Terminal + WSL2
  Lightweight/fast        → Alacritty or foot
  Heavy customization     → WezTerm (Lua) or kitty
  Beginners               → Warp (with AI assistance)
  Server administrators   → tmux/screen + preferred terminal
```

### 7.2 iTerm2 Configuration (macOS)

```
Key iTerm2 settings:

  Profile settings:
  Preferences > Profiles > General
  - Working Directory: Reuse previous session's directory

  Preferences > Profiles > Colors
  - Color Presets: Solarized Dark / Dracula / Tokyo Night, etc.

  Preferences > Profiles > Text
  - Font: JetBrains Mono Nerd Font / Hack Nerd Font
  - Font Size: 14
  - Use ligatures: ✓

  Key mappings:
  Preferences > Keys > Key Bindings
  - Alt+← → Send Escape Sequence: b (move one word back)
  - Alt+→ → Send Escape Sequence: f (move one word forward)
  - Alt+Delete → Send Hex Codes: 0x17 (delete one word)

  Useful features:
  Cmd+D              Vertical split
  Cmd+Shift+D        Horizontal split
  Cmd+T              New tab
  Cmd+Enter          Full screen
  Cmd+Shift+H        Paste history
  Cmd+;              Autocomplete (from past input)
  Cmd+F              Search (regex supported)
  Cmd+Opt+B          Show timestamps

  Shell Integration:
  iTerm2 > Install Shell Integration
  → Command start/end markers
  → Jump to output of previous commands (Cmd+Shift+↑/↓)
  → Markers for failed commands
```

### 7.3 Alacritty Configuration

```toml
# ~/.config/alacritty/alacritty.toml

[window]
padding = { x = 8, y = 8 }
decorations = "Full"
opacity = 0.95
startup_mode = "Windowed"

[scrolling]
history = 10000
multiplier = 3

[font]
normal = { family = "JetBrains Mono Nerd Font", style = "Regular" }
bold = { family = "JetBrains Mono Nerd Font", style = "Bold" }
italic = { family = "JetBrains Mono Nerd Font", style = "Italic" }
size = 14.0

[colors.primary]
background = "#1a1b26"
foreground = "#c0caf5"

[colors.normal]
black   = "#15161e"
red     = "#f7768e"
green   = "#9ece6a"
yellow  = "#e0af68"
blue    = "#7aa2f7"
magenta = "#bb9af7"
cyan    = "#7dcfff"
white   = "#a9b1d6"

[keyboard]
bindings = [
  { key = "V", mods = "Control|Shift", action = "Paste" },
  { key = "C", mods = "Control|Shift", action = "Copy" },
  { key = "N", mods = "Control|Shift", action = "SpawnNewInstance" },
]
```

### 7.4 Windows Terminal Configuration

```json
// Key settings in Windows Terminal settings.json
{
    "defaultProfile": "{GUID-of-WSL}",
    "copyOnSelect": true,
    "copyFormatting": "none",
    "profiles": {
        "defaults": {
            "font": {
                "face": "CaskaydiaCove Nerd Font",
                "size": 12
            },
            "colorScheme": "One Half Dark",
            "opacity": 90,
            "useAcrylic": true,
            "padding": "8"
        },
        "list": [
            {
                "name": "Ubuntu",
                "source": "Windows.Terminal.Wsl",
                "startingDirectory": "//wsl$/Ubuntu/home/gaku"
            }
        ]
    },
    "actions": [
        { "command": "splitPane", "keys": "alt+shift+d", "splitMode": "auto" },
        { "command": { "action": "splitPane", "split": "horizontal" }, "keys": "alt+shift+-" },
        { "command": { "action": "splitPane", "split": "vertical" }, "keys": "alt+shift+|" }
    ]
}
```

---

## 8. Shell Internals — How Commands Are Executed

### 8.1 Command Parsing Steps

```
The order in which the shell processes a command line:

  1. Tokenization
     Split the input line into words (tokens)
     → "ls -la /home" → ["ls", "-la", "/home"]

  2. Command identification
     Determine whether the first token is a command
     → Alias expansion → Function → Built-in → External command

  3. Expansion
     Perform expansions in the following order:
     a. Brace expansion:      {a,b,c} → a b c
     b. Tilde expansion:      ~ → /home/gaku
     c. Parameter expansion:  $HOME → /home/gaku
     d. Command substitution: $(date) → 2026-02-15
     e. Arithmetic expansion: $((1+2)) → 3
     f. Process substitution: <(sort file) → /dev/fd/63
     g. Word splitting:       Split expansion results by IFS (default: space/tab/newline)
     h. Pathname expansion:   *.txt → file1.txt file2.txt
     i. Quote removal:        Remove remaining quotes

  4. Redirect setup
     Set up redirects: >, <, |, 2>&1, etc.

  5. Command execution
     fork() → exec() to run the command as a child process
     Built-in commands are executed directly without fork()

How to inspect expansions:
  $ set -x                  # Debug mode (show expansion results)
  $ ls *.txt
  + ls file1.txt file2.txt  # The actual command after expansion
  $ set +x                  # Disable debug mode
```

### 8.2 The fork-exec Model

```
External command execution flow:

  Parent process (shell)          Child process
  ┌──────────────┐
  │ $ ls -la     │
  │              │
  │ fork() ──────┼──────→ ┌──────────────┐
  │              │         │ Shell copy    │
  │ wait()       │         │              │
  │  :           │         │ exec("ls")   │
  │  :           │         │ → becomes ls │
  │  :           │         │              │
  │  :           │         │ Execute/output │
  │  :           │         │              │
  │  :           │←─────── │ exit(0)      │
  │              │  status └──────────────┘
  │ $? = 0       │
  └──────────────┘

  Built-in commands (cd, echo, export, etc.):
  → Executed directly by the shell without fork()
  → Why cd is a built-in: it needs to change the parent process's working directory

  Subshell:
  $ (cd /tmp && ls)         # Executed in a subshell
  # The original shell's working directory is not changed

  $ var=hello
  $ echo "$var" | read response   # The right side of a pipe is a subshell (bash)
  $ echo "$response"              # Empty in bash
  # In zsh, lastpipe is enabled and the last command runs in the current shell
```

### 8.3 Exit Status

```bash
# Exit status conventions
# 0:     Success
# 1:     General error
# 2:     Misuse of shell built-in
# 126:   Command exists but is not executable
# 127:   Command not found
# 128+N: Terminated by signal N (e.g., 128+9=137 → SIGKILL)
# 130:   Terminated by Ctrl+C (SIGINT)
# 255:   Exit status out of range

# Practical use
$ grep -q "pattern" file
$ echo $?                    # 0: pattern found, 1: not found

# Conditional branching
$ if grep -q "error" /var/log/syslog; then
    echo "Errors were found"
    grep "error" /var/log/syslog | tail -5
  fi

# Test command
$ test -f /etc/passwd && echo "File exists"
$ [ -d /var/log ] && echo "Directory exists"
$ [[ -n "$variable" ]] && echo "Variable is not empty"

# Compound conditions
$ [[ -f config.yml && -r config.yml ]] && echo "Config file is readable"
$ [[ "$status" == "running" || "$status" == "started" ]] && echo "Running"
```

---

## 9. Quoting Rules

### 9.1 Single Quotes, Double Quotes, and Backticks

```bash
# Single quotes: suppress all expansion (literal string)
$ echo 'Hello, $USER! $(date)'
Hello, $USER! $(date)

# Double quotes: allow variable expansion and command substitution, suppress word splitting and glob
$ echo "Hello, $USER! $(date +%Y)"
Hello, gaku! 2026

# What is suppressed inside double quotes:
# - Word splitting (tokenizing by spaces)
# - Pathname expansion (* ? [] globs)
# What is expanded inside double quotes:
# - Variable expansion $var ${var}
# - Command substitution $(command)
# - Arithmetic expansion $((expression))
# - Some escape sequences

# Backticks (deprecated, use $() instead)
$ echo "Today is `date`"     # Hard to nest

# No quotes: all expansions + word splitting + glob expansion
$ echo Hello, $USER! *.txt
Hello, gaku! file1.txt file2.txt

# Escape characters
$ echo "She said \"Hello\""   # Double quote inside double quotes
$ echo 'It'\''s a test'       # Single quote inside single quotes
$ echo "Path: \$HOME"         # $ as a literal character
$ echo "Backslash: \\"        # The backslash itself

# $'...' form (ANSI-C Quoting)
$ echo $'Line1\nLine2\tTabbed'
Line1
Line2	Tabbed

# Practical quoting guidelines:
# Literal string              → single quotes
# Variable expansion needed   → double quotes
# Escape sequences needed     → $'...'
# No quotes                   → avoid in principle (risk of unintended expansion)

# Common mistakes
$ file="my document.txt"
$ cat $file                  # Split into "my" and "document.txt"!
$ cat "$file"                # Correct: passed as a single argument

# Notes on find
$ find . -name *.log         # The shell expands *.log first
$ find . -name "*.log"       # Correct: pass the pattern to find
$ find . -name '*.log'       # Also correct
```

### 9.2 Here Documents and Here Strings in Detail

```bash
# Here document variations

# 1. Normal (with variable expansion)
$ cat <<EOF
User: $USER
Home: $HOME
Date: $(date)
EOF

# 2. Quoted delimiter (no variable expansion)
$ cat <<'EOF'
User: $USER    ← displayed as-is
Home: $HOME    ← displayed as-is
EOF

# 3. With hyphen (strips leading tabs)
$ cat <<-EOF
	This line has a leading tab
	It will be stripped
	EOF

# 4. Here string (single line only)
$ grep "pattern" <<< "search in this string"
$ bc <<< "3.14 * 2"

# Practical pattern: dynamically generating config files
$ cat <<EOF > /tmp/config.ini
[database]
host=${DB_HOST:-localhost}
port=${DB_PORT:-5432}
name=${DB_NAME:-myapp}
user=${DB_USER:-admin}
EOF

# Practical pattern: running multiple commands on a remote server
$ ssh production-server <<'REMOTE'
cd /var/www/app
git pull origin main
docker compose down
docker compose up -d
docker compose logs --tail=20
REMOTE

# Practical pattern: inserting test data
$ psql -U postgres testdb <<SQL
INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com'),
  ('Charlie', 'charlie@example.com');
SQL
```

---

## 10. Aliases and Shell Functions

### 10.1 Aliases

```bash
# Defining aliases
$ alias ll='ls -lah'
$ alias la='ls -A'
$ alias ..='cd ..'
$ alias ...='cd ../..'

# Checking aliases
$ alias              # Show all aliases
$ alias ll           # Check a specific alias
$ type ll            # ll is aliased to 'ls -lah'

# Removing an alias
$ unalias ll

# Useful aliases for daily work
# --- Git ---
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline --graph --all'
alias gd='git diff'
alias gb='git branch'
alias gco='git checkout'
alias gpl='git pull'
alias gst='git stash'

# --- Docker ---
alias d='docker'
alias dc='docker compose'
alias dps='docker ps'
alias dpsa='docker ps -a'
alias dimg='docker images'
alias dexec='docker exec -it'
alias dlogs='docker logs -f'
alias dprune='docker system prune -af'

# --- Safety ---
alias rm='rm -i'               # Confirm before deletion
alias cp='cp -i'               # Confirm before overwriting
alias mv='mv -i'               # Confirm before overwriting

# --- Navigation ---
alias projects='cd ~/projects'
alias downloads='cd ~/Downloads'

# --- System ---
alias ports='ss -tlnp'         # Ports in use
alias meminfo='free -h'        # Memory information
alias diskinfo='df -h'         # Disk information
alias myip='curl -s ifconfig.me'  # Global IP address

# --- Misc ---
alias h='history'
alias c='clear'
alias e='$EDITOR'
alias reload='source ~/.zshrc'
alias path='echo $PATH | tr ":" "\n"'
alias now='date +"%Y-%m-%d %H:%M:%S"'
```

### 10.2 Shell Functions

```bash
# Defining functions (more flexible than aliases)
# Can take arguments, can span multiple lines

# Create a directory and cd into it simultaneously
mkcd() {
    mkdir -p "$1" && cd "$1"
}
$ mkcd new-project   # Create directory + cd

# Back up a file
backup() {
    local file="$1"
    if [[ -f "$file" ]]; then
        cp "$file" "${file}.bak.$(date +%Y%m%d-%H%M%S)"
        echo "Backed up: ${file}"
    else
        echo "Error: ${file} not found" >&2
        return 1
    fi
}

# Check which process is using a port
port() {
    lsof -i :"$1" 2>/dev/null || ss -tlnp | grep ":$1"
}
$ port 8080

# Create and switch to a Git branch
gcb() {
    git checkout -b "$1" && echo "Created and switched to branch: $1"
}

# Enter a Docker container
dsh() {
    docker exec -it "$1" /bin/sh -c 'if [ -x /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi'
}

# Top files by size in a directory
big() {
    local dir="${1:-.}"
    local count="${2:-10}"
    du -ah "$dir" 2>/dev/null | sort -rh | head -"$count"
}
$ big /var/log 20    # Top 20 largest files under /var/log

# Pretty-print JSON
jsonpp() {
    if [[ -f "$1" ]]; then
        python3 -m json.tool "$1"
    else
        echo "$1" | python3 -m json.tool
    fi
}

# Weather information
weather() {
    curl -s "wttr.in/${1:-Tokyo}?format=3"
}

# extract: auto-extract compressed files
extract() {
    if [[ -f "$1" ]]; then
        case "$1" in
            *.tar.bz2) tar xjf "$1"    ;;
            *.tar.gz)  tar xzf "$1"    ;;
            *.tar.xz)  tar xJf "$1"    ;;
            *.bz2)     bunzip2 "$1"    ;;
            *.gz)      gunzip "$1"     ;;
            *.tar)     tar xf "$1"     ;;
            *.tbz2)    tar xjf "$1"    ;;
            *.tgz)     tar xzf "$1"    ;;
            *.zip)     unzip "$1"      ;;
            *.Z)       uncompress "$1" ;;
            *.7z)      7z x "$1"       ;;
            *.rar)     unrar x "$1"    ;;
            *.xz)      xz -d "$1"     ;;
            *.zst)     zstd -d "$1"   ;;
            *)         echo "Unknown format: $1" ;;
        esac
    else
        echo "File not found: $1" >&2
        return 1
    fi
}
```

---

## 11. Practical Exercises

### Exercise 1: [Basic] — Basic Commands and Redirects

```bash
# Task: Run the following commands in order and verify the results

# 1. Collect system information
$ {
    echo "=== System Information ==="
    echo "Date: $(date)"
    echo "User: $(whoami)"
    echo "Host: $(hostname)"
    echo "Kernel: $(uname -r)"
    echo "Shell: $SHELL ($0)"
    echo "Uptime: $(uptime)"
    echo ""
    echo "=== Disk Usage ==="
    df -h /
    echo ""
    echo "=== Memory ==="
    free -h 2>/dev/null || vm_stat 2>/dev/null
} > /tmp/sysinfo.txt

# 2. Verify the results
$ cat /tmp/sysinfo.txt

# 3. File operations
$ mkdir -p /tmp/exercise/{src,build,docs}
$ touch /tmp/exercise/src/main.{c,h}
$ touch /tmp/exercise/docs/README.md
$ ls -R /tmp/exercise/

# 4. Combining redirects and pipes
$ echo "Hello, World!" > /tmp/test.txt
$ echo "Second line" >> /tmp/test.txt
$ echo "Third line" >> /tmp/test.txt
$ cat /tmp/test.txt | wc -l                # Line count
$ cat /tmp/test.txt | wc -w                # Word count
$ cat /tmp/test.txt | tee /tmp/copy.txt    # Display on screen and create a copy
```

### Exercise 2: [Intermediate] — Building Pipelines

```bash
# Task: Build multiple pipelines

# 1. Extract user information from /etc/passwd
$ cat /etc/passwd | cut -d: -f1,3,7 | sort -t: -k2 -n | tail -10
# username:UID:shell sorted by UID descending, 10 entries

# 2. Format process information
$ ps aux | awk 'NR>1 {printf "%-15s %5s %5s %s\n", $1, $2, $3, $11}' | sort -k3 -rn | head -10
# Top 10 processes by CPU usage

# 3. File system analysis
$ find /tmp -type f -name "*.txt" 2>/dev/null | while read -r file; do
    size=$(wc -c < "$file")
    echo "$size $file"
  done | sort -rn | head -5
# Top 5 .txt files under /tmp by size

# 4. Using command substitution
$ echo "Branch: $(git branch --show-current 2>/dev/null || echo 'not a git repo')"
$ echo "Python: $(python3 --version 2>/dev/null || echo 'not installed')"
$ echo "Node: $(node --version 2>/dev/null || echo 'not installed')"
```

### Exercise 3: [Advanced] — Using Shortcuts and History

```
Perform the following operations using only the keyboard:

1. Cursor movement
   a. Type a long command: echo "This is a very long command with many arguments"
   b. Press Ctrl+A to move to the beginning of the line
   c. Press Ctrl+E to move to the end of the line
   d. Press Alt+B to move back one word at a time
   e. Press Alt+F to move forward one word at a time

2. Text editing
   a. Type a long command
   b. Press Ctrl+U to delete to the beginning of the line
   c. Type a new command
   d. Press Ctrl+Y to restore the deleted content

3. History operations
   a. Press Ctrl+R to search for "ssh"
   b. Use !! to re-run the previous command
   c. Use !$ to reuse the last argument of the previous command
   d. Use ^old^new to replace a string in the previous command

4. Process control
   a. Run sleep 60
   b. Press Ctrl+Z to suspend it
   c. Use bg to move it to the background
   d. Use jobs to verify
   e. Use fg to bring it back to the foreground
   f. Press Ctrl+C to interrupt it
```

### Exercise 4: [Practical] — Troubleshooting Exercise

```bash
# Task: Practical troubleshooting scenarios

# Scenario 1: Command not found
$ mycommand
# bash: mycommand: command not found

# Investigation steps:
$ which mycommand                    # Check the path
$ type mycommand                     # Check the command type
$ echo $PATH | tr ':' '\n'           # Inspect PATH
$ find / -name "mycommand" 2>/dev/null  # Search for the file
$ apt list --installed 2>/dev/null | grep mycommand  # Check packages

# Scenario 2: Permission denied
$ cat /var/log/syslog
# cat: /var/log/syslog: Permission denied

# Investigation steps:
$ ls -la /var/log/syslog             # Check permissions
$ id                                  # Check your own UID/GID
$ groups                              # Check group memberships
$ sudo cat /var/log/syslog           # Retry with sudo

# Scenario 3: Disk is full
$ df -h                               # Check disk usage
$ du -sh /var/* 2>/dev/null | sort -rh | head -10  # Largest directories
$ find /var/log -name "*.log" -size +100M          # Large log files
$ journalctl --disk-usage             # journald size
$ docker system df                     # Docker disk usage

# Scenario 4: High load investigation
$ uptime                              # Check load average
$ top -bn1 | head -20                # CPU/memory usage
$ ps aux --sort=-%cpu | head -10     # Top CPU consumers
$ ps aux --sort=-%mem | head -10     # Top memory consumers
$ iostat -x 1 3                       # I/O statistics
$ vmstat 1 5                          # System statistics
```

---

## 12. Best Practices and Tips

### 12.1 Safe Command Operations

```bash
# 1. Confirm before destructive commands
$ rm -rf /path/to/dir               # Dangerous!
$ rm -ri /path/to/dir               # Use -i to confirm each deletion
$ ls /path/to/dir                    # First verify with ls

# 2. Always use double quotes around variables
$ rm "$file"                         # Correct
$ rm $file                           # Problems with filenames containing spaces

# 3. Caution with wildcards in rm -rf
$ rm -rf /tmp/test/*                 # OK
$ rm -rf /tmp/test/ *                # Dangerous! Space turns it into "/ *"
$ rm -rf "$dir"/*                    # OK (variable is quoted)

# 4. Careful use of sudo
$ sudo !!                            # Re-run previous command with sudo (after confirming)
$ sudo -k                            # Clear sudo credentials cache

# 5. Verify with echo before executing (dry run pattern)
$ for f in *.log; do echo "rm $f"; done    # First check with echo
$ for f in *.log; do rm "$f"; done         # Execute when satisfied

# 6. Back up before important operations
$ cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.$(date +%Y%m%d)
$ tar czf backup-before-change.tar.gz /path/to/dir
```

### 12.2 Efficient Command-Line Work

```bash
# 1. Make full use of Tab completion
$ cd /e<Tab>/ng<Tab>/si<Tab>        # /etc/nginx/sites-available

# 2. Use brace expansion to streamline file operations
$ cp config.{yml,yml.bak}           # cp config.yml config.yml.bak
$ mv file.{txt,md}                  # mv file.txt file.md
$ touch test_{1..5}.txt             # test_1.txt ... test_5.txt

# 3. Make use of Ctrl+R (incremental search)
# → Press Ctrl+R, type "docker" to see
#   recent docker commands
# → Press Ctrl+R multiple times to search further back

# 4. Use Alt+. to reuse the previous command's argument repeatedly
$ ls /var/log/nginx/access.log
$ less <Alt+.>                      # less /var/log/nginx/access.log

# 5. Use xargs for repetitive processing
$ find . -name "*.tmp" -print0 | xargs -0 rm
$ cat urls.txt | xargs -P4 -I{} curl -sO {}    # Download 4 in parallel

# 6. Use watch to run a command periodically
$ watch -n 2 'docker ps'            # Check container status every 2 seconds
$ watch -d 'df -h'                  # Highlight differences

# 7. Record a session with script
$ script /tmp/session-$(date +%Y%m%d).log
$ # ... work ...
$ exit                               # Stop recording
```

### 12.3 Common Pitfalls

```bash
# 1. Filenames with spaces
$ file="my document.txt"
$ cat $file              # → Split into "my" and "document.txt"
$ cat "$file"            # → Correctly treated as a single file

# 2. Undefined variables
$ echo $UNDEFINED        # Empty string (no error)
$ set -u                  # Treat undefined variable references as errors (recommended)
$ echo ${var:?"undefined"}  # Error message when undefined

# 3. Pipes and subshells (bash gotcha)
$ count=0
$ echo -e "a\nb\nc" | while read line; do
    count=$((count + 1))
  done
$ echo $count            # bash: 0 (right side of pipe is a subshell)
# Solution 1: process substitution
$ while read line; do
    count=$((count + 1))
  done < <(echo -e "a\nb\nc")
# Solution 2: lastpipe (bash 4.2+)
$ shopt -s lastpipe

# 4. for loops and IFS
$ for f in $(ls); do echo "$f"; done   # Problems with filenames containing spaces
$ for f in *; do echo "$f"; done       # Correct idiom

# 5. Difference between test and [[ ]]
$ [ "$a" == "$b" ]       # POSIX sh uses =
$ [[ "$a" == "$b" ]]     # bash/zsh can use ==
$ [[ "hello" =~ ^he ]]   # Regex match ([[ ]] only)
$ [[ -f file && -r file ]]  # Can use &&/|| ([ ] uses -a/-o)

# 6. Arithmetic evaluation
$ echo $((10 / 3))       # 3 (integer arithmetic only)
$ echo "scale=2; 10/3" | bc   # 3.33 (when floating point is needed)
$ awk 'BEGIN {printf "%.2f\n", 10/3}'  # 3.33 (also possible with awk)

# 7. Command substitution and newlines
$ files=$(ls)            # Trailing newlines are stripped
$ echo "$files"          # Newlines are preserved (double quotes)
$ echo $files            # Newlines are converted to spaces (no quotes)
```

---

## 13. FAQ

### Q1: Which should I use, bash or zsh?

macOS users are recommended to use zsh (the default). On Linux servers, bash is the reliable choice. zsh is largely a superset of bash and offers the following additional features:

```
Advantages of zsh over bash:
  - Powerful Tab completion (command options, argument completion)
  - Right prompt (RPROMPT)
  - Recursive glob (**/*.txt) usable by default
  - Spell correction suggestions
  - Glob qualifiers (*(om) for modification time order, etc.)
  - Arrays indexed from 1 (more intuitive)
  - Frameworks such as Oh My Zsh / Prezto
  - Floating-point arithmetic support

Strengths of bash:
  - Installed by default on almost all Linux distributions
  - Closer to POSIX sh behavior
  - Higher compatibility in server environments
  - More documentation (manuals, Stack Overflow, etc.)

Recommendations:
  Interactive shell      → zsh + Oh My Zsh
  Shell scripting        → #!/usr/bin/env bash (bash 4+)
  Portability focus      → #!/bin/sh (POSIX sh compatible)
```

### Q2: Why learn the CLI? Isn't a GUI sufficient?

```
Advantages of the CLI:

  1. Automation
     Automate repetitive tasks with scripts
     Schedule with cron/systemd timers
     A building block of CI/CD pipelines

  2. Remote operations
     Manage servers via SSH (no GUI needed)
     Usable even in bandwidth-constrained environments
     Batch operations across multiple servers

  3. Efficiency
     Faster than mouse operations (once you are accustomed)
     Express complex processing concisely with pipelines
     Batch-process large numbers of files at once

  4. Reproducibility
     Command history is preserved
     Procedures can be scripted and shared
     Easy to document

  5. Server environments
     Many servers have no GUI
     Container environments (Docker) are CLI-first
     Cloud instances default to SSH connections

  6. Debugging
     Searching and analyzing logs is overwhelmingly faster with the CLI
     Monitoring and controlling processes
     Network diagnostics

  7. The power of composition
     Unix philosophy: compose programs that "do one thing well"
     Freely chain existing commands with pipes
     New tools can be immediately incorporated into pipelines
```

### Q3: How should I configure fonts for my terminal?

```
Recommended fonts for programming:

  Nerd Font variants (with icons):
  - JetBrains Mono Nerd Font     ← Most popular among developers
  - Hack Nerd Font               ← Focused on readability
  - FiraCode Nerd Font           ← Supports ligatures
  - CaskaydiaCove Nerd Font      ← Made by Microsoft
  - MesloLGS NF                  ← Recommended for Oh My Zsh Powerlevel10k

  Japanese-compatible:
  - HackGen (Shiraigen)          ← Hack + Source Han Gothic
  - PlemolJP                     ← IBM Plex Mono + IBM Plex Sans JP
  - UDEV Gothic                  ← Monaspace + BIZ UDGothic
  - Cica                         ← Hack + Migu font

  Configuration tips:
  - Font size: 12-16pt (depending on screen size)
  - Line spacing: 1.2-1.5
  - Ligatures: enabling them makes != → ≠ and => → ⇒ more readable
  - Nerd Font: required for prompts like Starship and Powerlevel10k
```

### Q4: In what order are shell startup files loaded?

```
bash startup files:

  Login shell:
  1. /etc/profile
  2. ~/.bash_profile (if absent, ~/.bash_login → ~/.profile)

  Non-login shell (when a terminal emulator starts):
  1. ~/.bashrc

  Recommendation: put the following in ~/.bash_profile
  if [ -f ~/.bashrc ]; then source ~/.bashrc; fi

zsh startup files:

  Files are read in order from system-wide to personal:

  ┌──────────────┬─────────┬────────────┬──────────┐
  │ File         │ Login   │ Interactive│ Script   │
  ├──────────────┼─────────┼────────────┼──────────┤
  │ .zshenv      │ ✓       │ ✓          │ ✓        │
  │ .zprofile    │ ✓       │            │          │
  │ .zshrc       │ ✓       │ ✓          │          │
  │ .zlogin      │ ✓       │            │          │
  │ .zlogout     │ ✓ (exit)│            │          │
  └──────────────┴─────────┴────────────┴──────────┘

  Recommended placement:
  .zshenv   → Environment variables like PATH (needed in all contexts)
  .zshrc    → Aliases, functions, prompt, completion settings
  .zprofile → Settings needed only at login
```

### Q5: What is the difference between WSL2 and native Linux?

```
WSL2 (Windows Subsystem for Linux 2):
  Runs a real Linux kernel in a virtual machine on Windows

  Advantages:
  - Use Windows and Linux simultaneously
  - Mutual filesystem access (/mnt/c/)
  - Integration with Docker Desktop
  - Transparent development with VS Code Remote - WSL

  Limitations:
  - I/O performance (file operations between Windows and Linux)
  - systemd restrictions (can be enabled in WSL2 settings)
  - Network configuration complexity
  - USB device access restrictions

  Recommended settings:
  - Keep project files on the Linux filesystem
  - Avoid /mnt/c/ (slow)
  - Use Windows Terminal + WSL2 combination
  - Configure automount and network appropriately in wsl.conf
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend firmly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Concept | Key Points |
|------|---------|
| Terminal | Window for text I/O. iTerm2, Alacritty, Windows Terminal, etc. |
| Shell | Interprets and executes commands. bash (Linux default) / zsh (macOS default) |
| Command structure | `command [options] [arguments]`. Short/long options |
| Redirect | `>` `>>` `2>` `<` `&>` to change I/O destinations |
| Pipe | `\|` to chain commands. The heart of the Unix philosophy |
| Shortcuts | Ctrl+R (search), Ctrl+A/E (move), Ctrl+C (interrupt), Ctrl+Z (suspend) |
| Environment variables | PATH, HOME, SHELL, etc. Inherited by child processes via `export` |
| Glob | `*` `?` `[]` `{}` for file pattern matching |
| Quoting | Single (literal), double (with expansion) — know the difference |
| fork-exec | Shell command execution model. Commands run as child processes via exec |
| Aliases/Functions | Shorthand for frequently used commands. Functions are more flexible |

---

## What to Read Next

---

## References
1. Shotts, W. "The Linux Command Line." 2nd Ed, No Starch Press, 2019.
2. Robbins, A. & Beebe, N. "Classic Shell Scripting." O'Reilly Media, 2005.
3. Ramey, C. & Fox, B. "Bash Reference Manual." GNU Project, 2022.
4. Janssens, J. "Data Science at the Command Line." 2nd Ed, O'Reilly Media, 2021.
5. GNU Coreutils Manual. https://www.gnu.org/software/coreutils/manual/
6. Zsh Documentation. https://zsh.sourceforge.io/Doc/
7. The Open Group. "POSIX.1-2017 Shell & Utilities." IEEE Std 1003.1-2017.
8. Cooper, M. "Advanced Bash-Scripting Guide." The Linux Documentation Project.
