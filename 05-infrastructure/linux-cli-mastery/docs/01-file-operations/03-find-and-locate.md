# File Search

> "Where was that file again?" — with find and fd, you'll always find it.

## What You'll Learn in This Chapter

- [ ] Master the main usage patterns of find
- [ ] Use fd (modern alternative) effectively
- [ ] Understand database-based search with locate / mlocate
- [ ] Distinguish between which / whereis / type for command lookup
- [ ] Acquire commonly used file search patterns in real-world work


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [Permissions and Ownership](./02-permissions.md)

---

## 1. find — The Standard File Search Tool

### 1.1 Basic Syntax

```bash
# Basic syntax: find [search start path] [conditions] [actions]
#
# find recursively traverses the directory tree starting from the specified path,
# and outputs files/directories that match the conditions.
# If path is omitted, . (current directory) is used.

# Display all files and directories
find .

# Search starting from a specific directory
find /var/log
find /home/user/projects

# Specify multiple starting directories
find /etc /usr/local/etc -name "*.conf"
```

### 1.2 Search by Name (-name / -iname / -path / -regex)

```bash
# -name: filename pattern matching (shell glob)
find . -name "*.md"               # recursively search for .md files
find . -name "*.txt"              # recursively search for .txt files
find . -name "Makefile"           # search for Makefile
find . -name "*.log"              # search for log files
find . -name "config.*"           # search for config.xxx

# -iname: case-insensitive pattern matching
find . -iname "readme*"           # matches README, readme, Readme, etc.
find . -iname "*.jpg"             # matches .jpg, .JPG, .Jpg, etc.
find . -iname "license*"          # matches LICENSE, license, License, etc.

# -path: pattern matching against the full path
find . -path "*/src/*.js"         # .js files inside src directory
find . -path "*/test/*"           # all files under test directory
find . -path "*/.git/*" -prune -o -name "*.py" -print  # exclude .git, search .py

# -regex: match full path with regular expression
find . -regex ".*\.\(js\|ts\|jsx\|tsx\)"   # JS/TS related files
find . -regextype posix-extended -regex ".*\.(jpg|jpeg|png|gif)"  # image files
find . -regex ".*/[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}.*"  # paths containing date pattern

# Note on wildcards
# Always quote patterns to prevent the shell from glob-expanding them first
find . -name "*.log"              # correct
# find . -name *.log              # dangerous: shell may expand it
```

### 1.3 Filtering by Type (-type)

```bash
# Use -type to specify the kind of entry to search for
find . -type f                    # regular files only
find . -type d                    # directories only
find . -type l                    # symbolic links only
find . -type b                    # block devices
find . -type c                    # character devices
find . -type p                    # named pipes (FIFO)
find . -type s                    # sockets

# Examples combining type with other conditions
find . -type f -name "*.conf"     # configuration files (files only)
find . -type d -name "test*"      # directories starting with test
find . -type l -name "*.so"       # symbolic links for .so files

# List directories (useful for checking project structure)
find . -maxdepth 2 -type d | sort
```

### 1.4 Filtering by Size (-size)

```bash
# -size [+-]N[cwbkMG]
# +N: greater than N, -N: less than N, N: exactly N
# c: bytes, w: words (2B), b: blocks (512B), k: KB, M: MB, G: GB

find . -size +100M                # files 100MB or larger
find . -size +1G                  # files 1GB or larger
find . -size -1k                  # files smaller than 1KB
find . -size 0                    # zero-byte files
find . -empty                     # empty files/directories

# Filter by size range
find . -size +10M -size -100M     # files between 10MB and 100MB
find . -size +1k -size -10k       # files between 1KB and 10KB

# Real-world example: find large files consuming disk space
find / -type f -size +500M 2>/dev/null | head -20
find /var -type f -size +100M -exec ls -lh {} \; 2>/dev/null

# Find empty directories (for cleanup)
find . -type d -empty
find . -type d -empty -delete     # delete empty directories
```

### 1.5 Filtering by Time (-mtime / -atime / -ctime / -newer)

```bash
# -mtime: last modification time of contents
# -atime: last access time
# -ctime: last metadata change time (permission changes, etc.)
# Unit is "days". +N means more than N days ago, -N means within N days

find . -mtime -7                  # files modified within the last 7 days
find . -mtime +30                 # files modified more than 30 days ago
find . -mtime 0                   # files modified today (within 24 hours)
find . -atime -1                  # files accessed within the last 1 day
find . -ctime -3                  # files with metadata changed within 3 days

# -mmin / -amin / -cmin: specify in minutes
find . -mmin -30                  # files modified within the last 30 minutes
find . -mmin +60                  # files modified more than 60 minutes ago
find . -mmin -5                   # modified within 5 minutes (useful for debugging)

# -newer: find files newer than a reference file
find . -newer reference.txt       # files newer than reference.txt
find . -newer /tmp/timestamp      # files newer than a timestamp file

# Real-world example: detect changed files using a timestamp file
touch -t 202601010000 /tmp/since_newyear   # create reference timestamp
find . -newer /tmp/since_newyear -type f    # files changed since that time

# Search by date range (using -newerXY, GNU find)
# -newermt: specify modification time as string
find . -newermt "2026-01-01" ! -newermt "2026-02-01" -type f
# → files modified in January 2026

# Clean up old files
find /tmp -type f -mtime +7 -delete         # delete temp files older than 7 days
find /var/log -name "*.gz" -mtime +90 -delete  # delete compressed logs older than 90 days
```

### 1.6 Filtering by Permission and Ownership

```bash
# -perm: search by permission
find . -perm 644                  # files with exactly 644
find . -perm -644                 # files with at least 644 bits set
find . -perm /111                 # files with any execute bit set
find . -perm -u+x                # files where user has execute permission
find . -perm /o+w                 # files where others have write permission

# Security check: detect files with dangerous permissions
find / -perm -4000 -type f 2>/dev/null   # files with SUID bit set
find / -perm -2000 -type f 2>/dev/null   # files with SGID bit set
find / -perm /o+w -type f 2>/dev/null    # world-writable files
find /home -perm 777 -type f             # files with overly permissive rights

# -user / -group: search by owner or group
find . -user root                 # files owned by root
find . -user nobody               # files owned by nobody
find . -group www-data            # files in the www-data group
find . -nouser                    # files with no existing owner
find . -nogroup                   # files with no existing group

# Real-world example: list files belonging to a specific user
find /home/developer -user developer -type f | wc -l   # count files
find /var/www -not -user www-data -type f              # files not owned by www-data
```

### 1.7 Logical Operators and Combining Conditions

```bash
# AND (implicit / -a)
find . -name "*.log" -size +10M   # log files larger than 10MB (implicit AND)
find . -name "*.log" -a -size +10M  # explicit AND (same meaning)

# OR (-o)
find . \( -name "*.js" -o -name "*.ts" \)        # .js or .ts
find . \( -name "*.jpg" -o -name "*.png" -o -name "*.gif" \)  # image files
find . -type f \( -name "*.log" -o -name "*.tmp" \) -mtime +30  # old logs/tmp

# NOT (! / -not)
find . -type f ! -name "*.md"     # files that are not .md
find . -not -name "*.pyc"         # files that are not .pyc
find . ! -empty                   # non-empty files
find . -type f ! -user root       # files not owned by root

# Complex condition combinations
# Control precedence with parentheses \( \) (escaping required)
find . -type f \( -name "*.js" -o -name "*.ts" \) ! -path "*/node_modules/*"
# → JS/TS files excluding node_modules

find . -type f \( -name "*.py" -o -name "*.rb" \) -size +1k -mtime -30
# → Python/Ruby files larger than 1KB modified within the last 30 days

# Exclusion with -prune (efficient directory skipping)
find . -path "./.git" -prune -o -type f -print   # exclude .git
find . -name "node_modules" -prune -o -name "*.js" -print  # exclude node_modules
find . \( -name ".git" -o -name "node_modules" -o -name "__pycache__" \) -prune -o -type f -print
# → exclude .git, node_modules, and __pycache__ all at once
```

### 1.8 Actions (-exec / -execdir / -ok / -delete / -print)

```bash
# -print: default action (display path)
find . -name "*.md" -print        # explicit -print (can be omitted)

# -print0: output with NULL separator (combine with xargs -0)
find . -name "*.txt" -print0 | xargs -0 wc -l   # handles filenames with spaces

# -printf: custom format output (GNU find)
find . -type f -printf "%s %p\n"            # size and path
find . -type f -printf "%T+ %p\n" | sort    # sort by modification time
find . -type f -printf "%u %g %m %p\n"      # owner, group, permission, path

# -delete: delete matched files (use with care!)
find . -name "*.tmp" -delete      # delete .tmp files
find . -type d -empty -delete     # delete empty directories
find /tmp -mtime +7 -delete       # delete temp files older than 7 days

# -exec: run a command for each file
find . -name "*.sh" -exec chmod +x {} \;        # add execute permission to shell scripts
find . -name "*.log" -exec gzip {} \;           # compress log files
find . -name "*.bak" -exec rm {} \;             # delete backup files
find . -name "*.py" -exec grep -l "import os" {} \;  # Python files importing os

# -exec terminators
# \;  runs the command once per file (slow)
# +   passes all files at once (fast, equivalent to xargs)
find . -name "*.txt" -exec wc -l {} +           # pass all to wc at once (fast)
find . -name "*.js" -exec grep -l "console.log" {} +   # bulk grep

# -execdir: run in the directory containing the file (improved security)
find . -name "*.sh" -execdir chmod +x {} \;

# -ok: prompt for confirmation before executing (interactive)
find . -name "*.tmp" -ok rm {} \;   # confirm each deletion

# Combining with xargs (equivalent to -exec + but more flexible)
find . -name "*.py" | xargs grep "TODO"              # for filenames without spaces
find . -name "*.py" -print0 | xargs -0 grep "TODO"   # space-safe version
find . -name "*.css" -print0 | xargs -0 -I{} cp {} /backup/   # copy individually
find . -name "*.log" -print0 | xargs -0 -P 4 gzip    # compress with 4-way parallelism
```

### 1.9 Depth Limits and Search Order

```bash
# -maxdepth: limit the maximum search depth
find . -maxdepth 1 -type f        # files in current directory only (no recursion)
find . -maxdepth 2 -type d        # directories up to 2 levels deep
find . -maxdepth 3 -name "*.md"   # .md files up to 3 levels deep

# -mindepth: specify the minimum search depth
find . -mindepth 2 -name "*.py"   # .py files at depth 2 or deeper (skip direct children)
find . -mindepth 1 -maxdepth 1 -type d  # direct subdirectories only (equivalent to ls -d */)

# -depth: depth-first (process directory contents before the directory itself)
find . -depth -name "*.tmp" -delete  # delete depth-first (handles non-empty dirs)

# -mount / -xdev: do not cross filesystem boundaries
find / -mount -name "*.conf" -type f  # search only the root filesystem
```

### 1.10 Real-World find Patterns

```bash
# --- Project Management ---

# List all source files in a project
find ./src -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" ! -path "*/.next/*" | sort

# Count files per directory in a project
find . -type f ! -path "*/.git/*" | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20

# Top 20 most recently modified files
find . -type f ! -path "*/.git/*" -printf "%T@ %T+ %p\n" | sort -rn | head -20

# Detect duplicate files (MD5 hash-based)
find . -type f -exec md5sum {} + | sort | uniq -w 32 -d

# --- Disk Management ---

# Show largest files sorted by size
find . -type f -exec ls -lS {} + | head -20

# Top 10 directories by disk usage
find . -maxdepth 3 -type d -exec du -sh {} + 2>/dev/null | sort -rh | head -10

# Find large old files (archival candidates)
find /data -type f -size +100M -mtime +365 -ls

# --- Log Management ---

# Show only today's log files
find /var/log -type f -mtime 0 -name "*.log"

# Log rotation: delete old compressed logs
find /var/log -name "*.gz" -mtime +180 -delete

# Find log files containing errors
find /var/log -name "*.log" -mtime -1 -exec grep -l "ERROR" {} +

# --- Development Environment ---

# List all test files
find . -type f \( -name "*_test.go" -o -name "*_test.py" -o -name "*.test.js" -o -name "*.spec.ts" \)

# Bulk delete __pycache__
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# Bulk delete .DS_Store
find . -name ".DS_Store" -delete

# Check size of node_modules
find . -type d -name "node_modules" -exec du -sh {} + 2>/dev/null

# List Go dependency packages
find $GOPATH/pkg -type d -maxdepth 4

# --- Security ---

# Detect world-writable files
find /var/www -type f -perm /o+w -ls

# Audit SUID/SGID files
find / -type f \( -perm -4000 -o -perm -2000 \) -exec ls -la {} \; 2>/dev/null

# Detect files with no owner
find / -nouser -o -nogroup 2>/dev/null

# Recently modified configuration files (tamper detection)
find /etc -type f -mmin -60 -ls

# --- Backup ---

# Generate file list for rsync
find /data -type f -newer /tmp/last_backup -print0 > /tmp/backup_list.txt

# Create tar archive
find ./project -type f -name "*.py" -print0 | tar czf python_files.tar.gz --null -T -

# Incremental backup
find /home -type f -mtime -1 -print0 | cpio -0 -pdm /backup/daily/
```

### 1.11 find Performance Optimization

```bash
# 1. Specify -type early (type check on directory entries is low cost)
find . -type f -name "*.log"      # good: type first
# find . -name "*.log" -type f    # works the same but putting type first is conventional

# 2. Use -prune to skip unnecessary directories
find . -path "./.git" -prune -o -type f -name "*.py" -print
# → completely skips .git for better performance

# 3. Use -exec + (faster than \;)
find . -name "*.txt" -exec wc -l {} +     # good: batch execution
# find . -name "*.txt" -exec wc -l {} \;  # slow: one file at a time

# 4. Use -maxdepth to limit search scope
find . -maxdepth 3 -name "*.conf"   # limit to 3 levels

# 5. Suppress standard error (ignore permission errors)
find / -name "*.conf" 2>/dev/null
find / -name "*.conf" 2>&1 | grep -v "Permission denied"

# 6. Parallel processing (xargs -P)
find . -name "*.png" -print0 | xargs -0 -P $(nproc) optipng -o7
# → optimize images in parallel using all CPU cores

# 7. Save find results to a file for reuse
find /data -type f -name "*.csv" > /tmp/csv_files.txt
while IFS= read -r file; do
    process_csv "$file"
done < /tmp/csv_files.txt
```

---

## 2. fd — A Modern Alternative Tool

### 2.1 Installation and Overview

```bash
# Installation
brew install fd                   # macOS
sudo apt install fd-find          # Ubuntu/Debian (command is fdfind)
sudo pacman -S fd                 # Arch Linux
cargo install fd-find             # Rust (Cargo)

# On Ubuntu/Debian the command is called fdfind, so set an alias
alias fd='fdfind'
# or add to ~/.bashrc

# Features of fd
# - Automatically respects .gitignore (disable with --no-ignore)
# - Color output by default
# - Regular expressions by default (switch to glob with -g)
# - Unicode support
# - More concise syntax than find
# - Faster due to parallel execution
```

### 2.2 Basic Usage

```bash
# Basic syntax: fd [pattern] [search path]

# No pattern: show all files
fd                                # all files (respects .gitignore)

# String pattern (partial match, regex)
fd readme                         # files/directories containing "readme"
fd "\.md$"                        # regex: files ending with .md
fd "^test"                        # files starting with test
fd "[0-9]{4}"                     # files containing 4-digit numbers
fd "config\.(json|yaml|toml)"     # config files (multiple extensions)

# -g: glob pattern (similar to find's -name)
fd -g "*.md"                      # search for .md files using glob
fd -g "Makefile"                  # exact match
fd -g "*.{js,ts,jsx,tsx}"         # multiple extensions

# Specify search path
fd "\.py$" /home/user/projects    # search under a specific directory
fd "\.rs$" src/                   # Rust files under src/
```

### 2.3 Key Options

```bash
# Search by extension (-e / --extension)
fd -e md                          # .md files
fd -e py                          # .py files
fd -e jpg -e png -e gif           # image files (multiple extensions)
fd -e rs -e toml                  # Rust project related files

# Filter by type (-t / --type)
fd -t f                           # files only (file)
fd -t d                           # directories only (directory)
fd -t l                           # symbolic links only (symlink)
fd -t x                           # executable files only (executable)
fd -t e                           # empty files/directories (empty)

# Hidden files (-H / --hidden)
fd -H                             # include hidden files (.gitignore still respected)
fd -H "\.env"                     # search for .env files

# Ignore .gitignore (-I / --no-ignore)
fd -I                             # ignore .gitignore
fd -HI                            # hidden files + ignore .gitignore (equivalent to find)

# Case sensitivity control
fd -s "README"                    # case-sensitive (-s / --case-sensitive)
fd -i "readme"                    # case-insensitive (-i / --ignore-case)
# Default: smart case — case-insensitive if pattern is all lowercase

# Depth limits
fd -d 1                           # 1 level only (--max-depth)
fd -d 3                           # up to 3 levels
fd --min-depth 2                  # depth 2 or deeper

# Exclude patterns (-E / --exclude)
fd -E node_modules                # exclude node_modules
fd -E "*.min.js"                  # exclude minified JS
fd -E ".git" -E "target"          # exclude multiple directories

# Size filter (-S / --size)
fd -S +1m                         # 1MB or larger
fd -S -10k                        # 10KB or smaller
fd -S +100k -S -1m               # between 100KB and 1MB

# Time filter
fd --changed-within 1h            # changed within 1 hour
fd --changed-within 2d            # changed within 2 days
fd --changed-before 1w            # changed more than 1 week ago
fd --changed-within "2026-01-01"  # changed since the specified date

# Owner filter
fd --owner root                   # files owned by root
fd --owner ":www-data"            # files in the www-data group
```

### 2.4 Executing Actions (-x / -X)

```bash
# -x / --exec: run a command for each file
fd -e txt -x wc -l                # line count for each .txt file
fd -e sh -x chmod +x              # add execute permission to shell scripts
fd -e bak -x rm                   # delete .bak files
fd -e png -x optipng              # optimize PNG

# Placeholders
# {}   full path
# {/}  filename only (no directory)
# {//} directory part only
# {.}  path without extension
# {/.} filename without extension
fd -e jpg -x convert {} {.}.png   # convert JPG to PNG
fd -e md -x echo "File: {/}, Dir: {//}"  # filename and directory

# -X / --exec-batch: pass all results to one command at once (equivalent to find -exec +)
fd -e py -X wc -l                 # count lines across all .py files at once
fd -e js -X eslint                # lint all JS files at once

# Parallel execution (-j / --threads)
fd -e png -x optipng -j 4         # parallel processing with 4 threads
fd -e mp4 -x ffmpeg -i {} {.}.webm -j 2  # convert videos with 2-way parallelism
```

### 2.5 Real-World fd Patterns

```bash
# Count total lines across all source files in a project
fd -e py -X wc -l | tail -1

# Bulk rename files with a specific pattern
fd -e txt -x mv {} {.}.md        # .txt → .md

# Search for Docker-related files
fd -g "Dockerfile*" -g "docker-compose*" -g ".dockerignore"

# List recently modified files with timestamps
fd -t f --changed-within 1d -x ls -la

# List source files excluding test files
fd -e py -E "*_test.py" -E "test_*" -E "conftest.py"

# Bulk search for configuration files
fd -e yaml -e yml -e json -e toml -e ini -e conf

# Search among files not tracked by Git
fd -I -t f "\.log$"              # search for log files ignoring .gitignore
```

### 2.6 Comparison Table: find vs fd

```
┌─────────────────┬────────────────────────┬────────────────────────┐
│ Feature         │ find                   │ fd                     │
├─────────────────┼────────────────────────┼────────────────────────┤
│ Default behavior│ Show all files         │ Respects .gitignore    │
│ Pattern         │ Shell glob (-name)     │ Regex (default)        │
│ Case sensitivity│ Sensitive (-iname off) │ Smart case             │
│ Output          │ Monochrome             │ Color                  │
│ Speed           │ Standard               │ Fast (parallel)        │
│ Syntax          │ Verbose (-name, -type) │ Concise                │
│ Availability    │ Bundled                │ Requires install       │
│ Scripts         │ POSIX compatible       │ Non-standard           │
│ Hidden files    │ Included               │ Excluded by default    │
│ -exec equivalent│ -exec {} \; / +        │ -x / -X                │
│ Depth limit     │ -maxdepth / -mindepth  │ -d / --min-depth       │
│ Size            │ -size +10M             │ -S +10m                │
└─────────────────┴────────────────────────┴────────────────────────┘

Usage guide:
- Everyday searches → fd (simple and fast)
- Shell scripts / CI → find (POSIX compatible, bundled)
- Complex conditions → find (rich logical operators)
- Respecting .gitignore → fd (supported by default)
```

---

## 3. locate / mlocate / plocate — Fast Database-Based Search

### 3.1 Overview and Installation

```bash
# locate uses a filesystem database for fast searching.
# While find/fd scan the disk in real time,
# locate queries a pre-built database and is therefore much faster.

# Installation
sudo apt install mlocate          # Ubuntu/Debian (mlocate)
sudo apt install plocate          # Ubuntu 22.04+ (plocate, faster)
sudo yum install mlocate          # CentOS/RHEL
brew install findutils            # macOS (available as glocate)

# Initial database build
sudo updatedb                     # build/update the database
# Automatically updated daily via cron (usually /etc/cron.daily/mlocate)
```

### 3.2 Basic Usage

```bash
# Basic: locate [pattern]
locate filename                   # search the database by path name
locate "*.conf"                   # wildcard
locate -i "readme"                # case-insensitive
locate -n 10 "*.log"             # limit results to 10
locate -c "*.py"                 # count matches
locate -b "filename"              # search only the basename (filename part)
locate -r "\.py$"                 # search with regular expression

# Check database stats
locate -S                         # display database statistics
# → shows number of files, directories, database size, etc.

# Manually update the database
sudo updatedb                     # full update
# updatedb configuration: /etc/updatedb.conf
# PRUNEPATHS: paths to exclude (/tmp, /proc, etc.)
# PRUNEFS: filesystems to exclude (nfs, tmpfs, etc.)
```

### 3.3 Limitations and Usage Guidelines for locate

```bash
# Limitations of locate:
# 1. If the database is outdated, recently created files won't be found
#    → run sudo updatedb to manually update, or use find/fd
# 2. May not respect permissions (depends on configuration)
# 3. Deleted files may still appear in results

# Usage guidelines:
# - Want to find a file quickly by name alone → locate
# - Need to search the current state reliably → find / fd
# - Need conditions like size or time → find / fd
# - Searching config files on a server → locate (fast and convenient)

# Real-world example: combining locate + grep
locate "nginx.conf" | grep -v backup   # exclude backups
locate -b "settings.py" | head -5       # quickly find Django settings files
```

---

## 4. which / whereis / type — Locating Commands

### 4.1 which

```bash
# which: display the path to an executable (searches PATH)
which python                      # /usr/bin/python
which -a python                   # show all python entries on PATH
which node                        # /usr/local/bin/node
which gcc                         # check path of the compiler

# Real-world examples
which python3 && python3 --version   # if Python3 exists, show version
if which docker > /dev/null 2>&1; then
    echo "Docker is installed"
fi
```

### 4.2 whereis

```bash
# whereis: find binary, source, and manual page locations
whereis python                    # binary, manual, etc.
whereis -b python                 # binary only
whereis -m python                 # manual only
whereis -s python                 # source only
whereis ls grep awk               # look up multiple commands at once
```

### 4.3 type

```bash
# type: show the type of a command (bash built-in)
type ls                           # ls is an alias / function / external command
type cd                           # cd is a shell builtin
type ll                           # ll is aliased to `ls -la`
type -a python                    # show all matching entries
type -t ls                        # show type only (alias, builtin, function, file)

# Real-world examples: inspect command identity
type -a grep                      # check if grep is an alias or external command
type -a python python3 pip pip3   # check Python environment
```

---

## 5. Advanced File Search Techniques

### 5.1 Interactive Search with fzf

```bash
# fzf: fuzzy finder (interactive narrowing search)
# brew install fzf

# Basic usage
find . -type f | fzf              # interactively select from all files
fd -t f | fzf                     # combine fd + fzf

# fzf + editor
vim $(fzf)                        # open the file selected in fzf with vim
code $(fd -e py | fzf -m)         # select multiple files and open in VS Code

# fzf + preview
fd -t f | fzf --preview 'bat --color=always {}'   # with preview
fd -t f | fzf --preview 'head -50 {}'              # preview with head

# fzf + kill (search processes and kill)
ps aux | fzf | awk '{print $2}' | xargs kill

# fzf + git
git log --oneline | fzf --preview 'git show {1}'   # select a commit
git branch | fzf | xargs git checkout               # switch branches

# Key bindings to add to .bashrc / .zshrc
export FZF_DEFAULT_COMMAND='fd -t f --hidden --exclude .git'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
# Ctrl+T: file search, Ctrl+R: command history, Alt+C: navigate to directory
```

### 5.2 Visualizing Directory Structure with tree

```bash
# tree: display directory structure in tree format
# brew install tree

tree                              # show tree of current directory
tree -L 2                         # display up to 2 levels
tree -d                           # directories only
tree -a                           # include hidden files
tree -I "node_modules|.git"       # exclude specific directories
tree -P "*.py"                    # Python files only
tree --prune                      # hide empty directories
tree -s                           # show file sizes
tree -D                           # show modification times
tree -h                           # human-readable sizes
tree -f                           # show full paths
tree --du                         # show total size of directories

# Real-world example: document project structure
tree -L 3 -I "node_modules|.git|__pycache__|.next" > project_structure.txt
```

### 5.3 File Search Automation Scripts

```bash
#!/bin/bash
# find_large_files.sh - search for files above a specified size and generate a report

set -euo pipefail

SEARCH_DIR="${1:-.}"
MIN_SIZE="${2:-100M}"
OUTPUT_FILE="/tmp/large_files_report_$(date +%Y%m%d_%H%M%S).txt"

echo "=== Large File Report ===" > "$OUTPUT_FILE"
echo "Search directory: $SEARCH_DIR" >> "$OUTPUT_FILE"
echo "Minimum size: $MIN_SIZE" >> "$OUTPUT_FILE"
echo "Run time: $(date)" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"

find "$SEARCH_DIR" -type f -size +"$MIN_SIZE" -printf "%s\t%p\n" 2>/dev/null \
  | sort -rn \
  | while IFS=$'\t' read -r size path; do
      hr_size=$(numfmt --to=iec "$size" 2>/dev/null || echo "${size}B")
      echo "$hr_size  $path"
    done >> "$OUTPUT_FILE"

total=$(grep -c "^" "$OUTPUT_FILE" 2>/dev/null || echo "0")
echo "---" >> "$OUTPUT_FILE"
echo "Total: $((total - 5)) files" >> "$OUTPUT_FILE"

echo "Report output: $OUTPUT_FILE"
cat "$OUTPUT_FILE"
```

```bash
#!/bin/bash
# find_duplicates.sh - detect duplicate files

set -euo pipefail

SEARCH_DIR="${1:-.}"
echo "=== Duplicate File Detection ==="
echo "Search directory: $SEARCH_DIR"
echo ""

# Group files by size, then compare by MD5
find "$SEARCH_DIR" -type f ! -empty -printf "%s %p\n" 2>/dev/null \
  | sort -n \
  | uniq -w 10 -D \
  | awk '{print $2}' \
  | xargs -d '\n' md5sum 2>/dev/null \
  | sort \
  | uniq -w 32 -D \
  | awk '{
      if (prev_hash == substr($0, 1, 32)) {
          print "  DUP: " $2
      } else {
          if (NR > 1) print ""
          print "ORIG: " $2
      }
      prev_hash = substr($0, 1, 32)
    }'
```

```bash
#!/bin/bash
# cleanup_project.sh - clean up unnecessary files in a project

set -euo pipefail

PROJECT_DIR="${1:-.}"
DRY_RUN="${2:-true}"  # dry run by default

echo "=== Project Cleanup ==="
echo "Target: $PROJECT_DIR"
echo "Dry run: $DRY_RUN"
echo ""

# Patterns to delete
PATTERNS=(
    "*.pyc"
    "__pycache__"
    ".DS_Store"
    "Thumbs.db"
    "*.swp"
    "*.swo"
    "*~"
    "*.bak"
    "*.orig"
)

total_size=0
total_count=0

for pattern in "${PATTERNS[@]}"; do
    files=$(find "$PROJECT_DIR" -name "$pattern" -not -path "*/.git/*" 2>/dev/null)
    if [ -n "$files" ]; then
        count=$(echo "$files" | wc -l)
        size=$(echo "$files" | xargs -I{} stat -f%z {} 2>/dev/null | awk '{s+=$1}END{print s+0}')
        total_count=$((total_count + count))
        total_size=$((total_size + size))

        echo "[$pattern] $count files ($((size / 1024)) KB)"

        if [ "$DRY_RUN" = "false" ]; then
            echo "$files" | xargs rm -rf
            echo "  → Deleted"
        fi
    fi
done

echo ""
echo "Total: $total_count files ($((total_size / 1024)) KB)"
if [ "$DRY_RUN" = "true" ]; then
    echo "* This is a dry run. To actually delete, pass false as the second argument."
fi
```

---

## 6. Troubleshooting

### 6.1 Common Errors in find and How to Handle Them

```bash
# Error: "Permission denied"
# Fix: suppress standard error
find / -name "*.conf" 2>/dev/null
find / -name "*.conf" 2>&1 | grep -v "Permission denied"

# Error: "Argument list too long" (too many files)
# Fix: use xargs
find . -name "*.log" -print0 | xargs -0 rm          # OK
# find . -name "*.log" -exec rm {} +                 # also OK
# rm $(find . -name "*.log")                         # NG: too many arguments

# Error: filenames contain spaces or special characters
# Fix: use -print0 and xargs -0
find . -name "*.txt" -print0 | xargs -0 grep "keyword"

# Error: -prune does not work as expected
# Fix: combine -prune with -o (OR)
find . -name ".git" -prune -o -type f -print        # correct
# find . -name ".git" -prune -type f -print          # incorrect

# Error: GNU find options not available on macOS
# Fix: install GNU find
# brew install findutils
# use gfind or add to PATH
# macOS find is BSD find and does not support -printf, etc.
gfind . -type f -printf "%T+ %p\n"                   # use GNU find

# Warning when -delete is used as the first condition
# Fix: always specify conditions before -delete
find . -name "*.tmp" -delete                          # correct
# find . -delete -name "*.tmp"                        # dangerous! may delete all files
```

### 6.2 Debugging Searches

```bash
# Techniques for verifying find behavior

# 1. Check with -print before using -delete / -exec
find . -name "*.tmp" -print            # check first
find . -name "*.tmp" -delete           # delete after confirming

# 2. Use -ok for interactive confirmation
find . -name "*.bak" -ok rm {} \;      # confirm one by one

# 3. Use echo to verify the command that will be run
find . -name "*.sh" -exec echo chmod +x {} \;   # does not actually execute

# 4. Check the count
find . -name "*.log" | wc -l           # check number of matches

# 5. Use fd's --list-file-types to see supported file types
fd --list-file-types                   # list file types recognized by fd
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Write test code as well

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
        """Retrieve processing results"""
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
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Applied Pattern

Extend the basic implementation to add the following features.

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
    assert ex.add("d", 4) == False  # size limit
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
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes criteria for making technology choices.

| Criterion | When to prioritize | When it can be compromised |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to 2                     │
│                                                 │
│  2. How frequent are deployments?               │
│    ├─ Once a week or less → Monolith + modules  │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. How independent are teams?                  │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A quick short-term solution can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs. flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is more intuitive but prone to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
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
- Focus on the minimum viable set of features
- Automated tests only for critical paths
- Introduce monitoring early

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally overhauling a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if existing tests are absent
- Coexist old and new systems via an API gateway
- Perform data migration incrementally

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Analyze current state, map dependencies | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries using Domain-Driven Design
- Assign ownership per team
- Manage shared libraries using Inner Source
- Design API-first to minimize inter-team dependencies

```python
# Define API contracts between teams
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
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
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

**Situation:** Systems requiring millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Applicable When |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-bound processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound processing |

---

## Team Development Practices

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Naming conventions are consistent
- [ ] Error handling is appropriate
- [ ] Test coverage is sufficient
- [ ] No negative performance impact
- [ ] No security issues
- [ ] Documentation is updated

### Best Practices for Knowledge Sharing

| Method | Frequency | Audience | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Whole team | Horizontal knowledge sharing |
| ADR (design records) | Per decision | Future members | Transparency of decisions |
| Retrospectives | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Key design | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │ Plan│ Act │
    │ ned │ imm │
    │     │ edia│
    │     │ tely│
    ├─────┼─────┤
    │ Log │ Next│
    │ only│ Spr │
    │     │ int │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------|------------|------|---------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication failures | High | Multi-factor auth, strong session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, principle of least privilege | Config scanning |
| Insufficient logging | Medium | Structured logs, audit trails | Log analysis |

### Secure Coding Best Practices

```python
# Secure coding example
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """Security utilities"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate a cryptographically secure token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """Hash a password"""
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
        """Verify a password"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input value"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage example
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not output to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is configured appropriately
- [ ] Vulnerability scanning of dependencies has been performed
- [ ] Error messages do not contain internal information
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Tool | Features | Use Case | Speed |
|--------|------|------|------|
| find | Bundled, feature-rich, POSIX compatible | Complex condition searches, scripts | Medium |
| fd | Fast, concise, respects .gitignore | Everyday searches, development work | High |
| locate | Database search | Quick file name lookup | Fastest |
| which | PATH search | Check location of a command | Instant |
| whereis | Binary + man search | Check command-related files | Instant |
| type | bash built-in | Check type of a command | Instant |
| fzf | Fuzzy search | Interactive file selection | Instant |
| tree | Tree display | Visualize directory structure | Medium |

### Selection Flowchart

```
I want to find a file
  │
  ├─ Only know the filename → locate (fast)
  │
  ├─ Searching inside a development project
  │    ├─ Simple search → fd (respects .gitignore, concise)
  │    └─ Complex conditions → find (logical operators, -exec)
  │
  ├─ Searching the entire system
  │    ├─ Condition is name only → locate
  │    └─ Also need size/time/permissions → find
  │
  ├─ Location of a command → which / type
  │
  └─ Want to select interactively → find/fd | fzf
```

---

## 13. Advanced Security Uses of find

### 13.1 Filesystem Security Auditing

```bash
# Detect files with SUID/SGID bits set (privilege escalation risk)
find / -type f \( -perm -4000 -o -perm -2000 \) -ls 2>/dev/null

# Detect world-writable files
find / -type f -perm -0002 -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null

# Files with no owner (user or group has been deleted)
find / -nouser -o -nogroup 2>/dev/null | head -50

# Check recently modified config files (signs of intrusion)
find /etc -type f -mtime -1 -ls 2>/dev/null

# Detect hidden files (dot files, suspicious files)
find / -name ".*" -type f -not -path "/home/*" -not -path "/root/*" 2>/dev/null | head -50

# Recently created executable files
find /tmp /var/tmp /dev/shm -type f -executable -newer /etc/hostname 2>/dev/null

# Detect suspicious cron jobs
find /etc/cron* /var/spool/cron -type f -ls 2>/dev/null
find / -name "*.cron" -o -name "crontab" 2>/dev/null

# Detect oversized log files (DoS prevention)
find /var/log -type f -size +100M -exec ls -lh {} \; 2>/dev/null
```

---

## Further Reading

---

## References
1. Barrett, D. "Efficient Linux at the Command Line." Ch.4, O'Reilly, 2022.
2. Shotts, W. "The Linux Command Line." 2nd Ed, Ch.17-18, 2019.
3. GNU Findutils Manual. https://www.gnu.org/software/findutils/manual/
4. fd GitHub Repository. https://github.com/sharkdp/fd
5. fzf GitHub Repository. https://github.com/junegunn/fzf
6. mlocate / plocate Documentation. https://plocate.sesse.net/
