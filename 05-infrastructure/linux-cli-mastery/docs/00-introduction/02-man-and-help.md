# Using Manuals and Help

> The man page is the "encyclopedia of the Unix world." When you're unsure how to use a command, make it a habit to look it up with man first. The ability to find answers on your own will prepare you for any unknown command.

## What You Will Learn

- [ ] Fully master how to read man pages
- [ ] Understand the section structure of man pages
- [ ] Know when to use each type of help
- [ ] Learn how to navigate info pages
- [ ] Make use of modern help tools like tldr and cheat.sh
- [ ] Understand the difference between built-in and external commands
- [ ] Know how to effectively use online resources
- [ ] Create your own man pages and help documentation


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [Shell Configuration](./01-shell-config.md)

---

## 1. Overview of Ways to Get Help

In Linux/Unix environments, there are multiple ways to look up how to use commands. It is important to choose the best method for the situation.

### 1.1 List of Help Methods and When to Use Each

```
Comparison of help methods:

┌──────────────┬──────────────────┬───────────────────┬──────────────┐
│ Method       │ Amount of Info   │ Best For           │ Target       │
├──────────────┼──────────────────┼───────────────────┼──────────────┤
│ --help       │ Low~Medium       │ Checking options   │ External CMD │
│ man          │ High (thorough)  │ Detailed specs     │ General      │
│ info         │ High (structured)│ GNU tool details   │ GNU tools    │
│ help         │ Medium           │ Shell builtins     │ bash builtin │
│ tldr         │ Low (examples)   │ Quick usage check  │ Common CMDs  │
│ cheat.sh     │ Low~Med (example)│ Check with network │ Common CMDs  │
│ type/which   │ Minimal          │ Find command loc.  │ General      │
│ apropos      │ Search results   │ Unknown cmd name   │ man DB       │
│ whatis       │ 1-line summary   │ Command overview   │ man DB       │
└──────────────┴──────────────────┴───────────────────┴──────────────┘
```

### 1.2 The --help Option (Quickest)

```bash
# Nearly all external commands support this
ls --help              # Quick help for ls
grep --help            # Quick help for grep
curl --help            # Quick help for curl (by category)
curl --help all        # Full help for curl
git --help             # List of git subcommands
git commit --help      # Detailed help for git commit (may open man page)

# -h may be a short form of --help
docker -h
python3 -h
pip3 -h

# Some commands use -help (single hyphen)
java -help
javac -help

# View help output with a pager (when output is long)
git --help | less
docker --help | less

# Search help output for a specific option
ls --help | grep -i "sort"        # Search for sort-related options
curl --help all | grep -i "proxy" # Search for proxy-related options

# Save help output to a file
git commit --help > /tmp/git-commit-help.txt
```

### 1.3 Help for Built-in Commands

```bash
# bash/zsh built-in commands may not have man pages
# For bash: use the help command
help                    # List all built-in commands
help cd                 # Detailed help for cd
help test               # Detailed help for test
help [                  # Detailed help for [ (test)
help for                # Syntax for for loops
help if                 # Syntax for if statements
help while              # Syntax for while loops
help case               # Syntax for case statements
help read               # Detailed help for read
help export             # Detailed help for export
help declare            # Detailed help for declare
help set                # Detailed help for set
help shopt              # Detailed help for shopt
help trap               # Detailed help for trap
help pushd              # Detailed help for pushd
help popd               # Detailed help for popd

# For zsh: use run-help
# Add the following to ~/.zshrc:
autoload -Uz run-help
unalias run-help 2>/dev/null
alias help=run-help

# This enables help cd or ESC+h to show help
# Man pages for zsh built-in commands
man zshbuiltins         # All zsh built-in commands
man zshoptions          # List of zsh options
man zshexpn             # zsh expansions (parameter expansion, etc.)
man zshmisc             # Other zsh features
man zshzle              # zsh line editor
man zshcompwid          # zsh completion widgets
man zshcompsys          # zsh completion system
man zshparam            # zsh parameters (variables)

# How to check the type of a command
type cd                 # cd is a shell builtin
type ls                 # ls is /bin/ls (external command)
type ll                 # ll is an alias for ls -lah
type mkcd               # mkcd is a shell function
type if                 # if is a reserved word

# Detailed check in bash
type -a python3         # Show all candidates for python3
type -t cd              # builtin (show type only)
type -t ls              # file
type -t ll              # alias

# which command
which python3           # /usr/bin/python3
which -a python3        # Show all candidates

# where command (zsh only)
where python3           # Show all candidates in PATH

# command -v (for POSIX scripts)
command -v cd           # cd (just the name for builtins)
command -v ls           # /bin/ls (path for external commands)
command -v ll           # alias ll='ls -lah' (for aliases)

# Use in scripts to check if a command exists
if command -v git &>/dev/null; then
    echo "git is installed"
else
    echo "git is not installed"
fi
```

---

## 2. Man Pages in Detail

### 2.1 Man Page Sections

```bash
# Man pages are divided into 8 sections
# The same name may exist in multiple sections

# Section list:
# Section 1: User commands (general commands)
#   Examples: ls(1), grep(1), git(1), ssh(1), curl(1)
#
# Section 2: System calls (functions provided by the kernel)
#   Examples: open(2), read(2), write(2), fork(2), exec(2), mmap(2)
#
# Section 3: Library functions (C library functions, etc.)
#   Examples: printf(3), malloc(3), strlen(3), fopen(3), pthread_create(3)
#
# Section 4: Special files (device files, etc.)
#   Examples: null(4), zero(4), random(4), tty(4), console(4)
#
# Section 5: File formats and protocols
#   Examples: passwd(5), fstab(5), hosts(5), crontab(5), sudoers(5)
#
# Section 6: Games and screensavers
#   Examples: fortune(6), banner(6)
#
# Section 7: Miscellaneous conventions and standards
#   Examples: ascii(7), utf-8(7), regex(7), signal(7), ip(7), tcp(7)
#
# Section 8: System administration commands (root commands)
#   Examples: mount(8), iptables(8), systemctl(8), useradd(8), cron(8)

# Open man page with a specific section
man ls                  # Default: ls in section 1
man 5 passwd            # Section 5: /etc/passwd file format
man 2 open              # Section 2: open() system call
man 3 printf            # Section 3: printf() library function
man 7 regex             # Section 7: regular expression conventions
man 8 mount             # Section 8: mount command

# Check multiple sections with the same name
man -f passwd           # Show all sections for passwd
# Example output:
# passwd (1)           - change user password
# passwd (5)           - the password file

man -f printf
# Example output:
# printf (1)           - format and print data
# printf (3)           - formatted output conversion

# Alternative ways to specify a section
man passwd.5            # Section 5 (some systems)
man -s 5 passwd         # Section 5 (using -s option)
```

### 2.2 Structure of a Man Page

```
Typical man page structure:

┌─────────────────────────────────────────────────┐
│ NAME                                             │
│   Command name and a brief one-line description  │
│                                                  │
│ SYNOPSIS                                         │
│   Usage (syntax) of the command                  │
│   [ ] = optional, ... = repeatable              │
│   | = OR (one or the other)                      │
│   Bold = literal input, underline = replaceable  │
│                                                  │
│ DESCRIPTION                                      │
│   Detailed description of the command            │
│                                                  │
│ OPTIONS                                          │
│   List of options and their descriptions         │
│                                                  │
│ ARGUMENTS                                        │
│   Description of arguments                       │
│                                                  │
│ ENVIRONMENT                                      │
│   Relevant environment variables                 │
│                                                  │
│ FILES                                            │
│   Related files                                  │
│                                                  │
│ EXIT STATUS                                      │
│   Exit codes (0=success, non-0=error)            │
│                                                  │
│ EXAMPLES                                         │
│   Usage examples (not in every man page)         │
│                                                  │
│ DIAGNOSTICS                                      │
│   Description of error messages                  │
│                                                  │
│ NOTES / CAVEATS                                  │
│   Notes and caveats                              │
│                                                  │
│ BUGS                                             │
│   Known bugs                                     │
│                                                  │
│ SEE ALSO                                         │
│   Related commands and man pages                 │
│                                                  │
│ AUTHOR                                           │
│   Author information                             │
│                                                  │
│ COPYRIGHT                                        │
│   Copyright information                          │
└─────────────────────────────────────────────────┘
```

### 2.3 How to Read SYNOPSIS (Syntax)

```bash
# Understanding the notation in SYNOPSIS is very important

# Example 1: SYNOPSIS for ls
# ls [OPTION]... [FILE]...
#
# Breakdown:
# ls          → command name (required)
# [OPTION]    → options (optional = enclosed in [ ])
# ...         → multiple allowed
# [FILE]      → file name (optional)
# ...         → multiple allowed

# Example 2: SYNOPSIS for cp
# cp [OPTION]... [-T] SOURCE DEST
# cp [OPTION]... SOURCE... DIRECTORY
# cp [OPTION]... -t DIRECTORY SOURCE...
#
# There are 3 ways to use it:
# 1. cp source dest          (copy a file)
# 2. cp file1 file2 dir/     (copy multiple files to a directory)
# 3. cp -t dir/ file1 file2  (specify target first with -t)

# Example 3: SYNOPSIS for find
# find [-H] [-L] [-P] [-D debugopts] [-Olevel] [path...] [expression]
#
# [-H] [-L] [-P]  → symlink handling (optional, not mutually exclusive)
# [-D debugopts]   → debug options (optional)
# [-Olevel]        → optimization level (optional)
# [path...]        → search path (optional, multiple allowed)
# [expression]     → search condition (optional)

# Example 4: SYNOPSIS for git
# git [--version] [--help] [-C <path>] [-c <name>=<value>]
#     [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]
#     [-p|--paginate|-P|--no-pager] [--no-replace-objects] [--bare]
#     [--git-dir=<path>] [--work-tree=<path>] [--namespace=<name>]
#     <command> [<args>]
#
# <command>   → subcommand (required = enclosed in < >)
# [<args>]    → subcommand arguments (optional)
# |           → OR (choose one)
# [-p|--paginate]  → -p or --paginate

# Summary of notation:
# [ ]     → optional
# < >     → required argument (placeholder)
# ...     → repeatable (one or more)
# |       → OR (choice)
# Bold    → literal (string to type as-is)
# Underline → variable (value specified by the user)
```

### 2.4 Navigation Inside a Man Page

```bash
# man uses the less pager by default
# All less operations also work inside man

# === Basic Operations ===
# j / ↓      → scroll down one line
# k / ↑      → scroll up one line
# Space / f  → scroll down one page (forward)
# b          → scroll up one page (backward)
# d          → scroll down half a page
# u          → scroll up half a page
# g          → go to the top
# G          → go to the bottom
# q          → quit

# === Search ===
# /pattern   → forward search (search downward)
# ?pattern   → backward search (search upward)
# n          → move to next search result
# N          → move to previous search result
# &pattern   → show only lines matching pattern

# Practical search examples:
# /EXAMPLES   → jump to the EXAMPLES section
# /-r         → search for the -r option description
# /recursive  → search for lines containing "recursive"
# /-v\b       → precisely search for -v option (\b = word boundary)

# === Marks ===
# m + char   → set a mark at current position (e.g., ma)
# ' + char   → jump to marked position (e.g., 'a)

# === Screen Operations ===
# h          → show help screen (less's own help)
# =          → show file info (current position, line count, etc.)
# v          → open file in $EDITOR

# === Line Numbers ===
# -N         → toggle line number display
# 100g       → jump to line 100

# Practical tips:
# 1. After opening man, use /EXAMPLES to check usage examples
# 2. Use /OPTIONS to check the option list
# 3. Keep a man page open in another window to reference while working

# Adjust the width of the man page
MANWIDTH=80 man ls        # Display with 80-column width
export MANWIDTH=100       # Always display with 100-column width
```

### 2.5 Searching Man Pages

```bash
# ============================================
# Searching the man database
# ============================================

# apropos: search man pages by keyword
apropos "copy file"         # Search for man pages containing "copy file"
apropos -e passwd           # Search for exact match
apropos -s 1 network        # Search only in section 1
apropos "regular expression" # Man pages related to regular expressions
apropos -r "^git"           # Man pages starting with git

# man -k: equivalent to apropos
man -k "copy file"          # Same as apropos
man -k "^ls$"               # Exact match search for ls
man -k "disk usage"         # Commands related to disk usage
man -k "compress"           # Commands related to compression

# whatis: show a one-line description of a command
whatis ls                   # ls (1) - list directory contents
whatis passwd               # passwd (1) - change user password
                            # passwd (5) - the password file
whatis mount                # mount (8) - mount a filesystem
whatis printf               # printf (1) - format and print data
                            # printf (3) - formatted output conversion

# man -f: equivalent to whatis
man -f ls
man -f grep
man -f curl

# Update the man database (when search results are stale)
sudo mandb                  # Linux
sudo /usr/libexec/makewhatis  # macOS (older versions)

# Open a man page by specific path
man /usr/share/man/man1/ls.1.gz    # Open directly by path
man -l /path/to/custom.man         # Open a local man file

# Output man page as text
man ls | col -b > ls.txt           # Format and output as text
man ls | cat                       # Output as plain text

# Output man page as PDF (macOS)
man -t ls | open -f -a Preview     # Display in Preview
man -t ls > ls.ps                  # Output as PostScript file

# Convert man page to HTML
man -H ls                          # Display in browser (groff-compatible environments)

# Check the location of a man page
man -w ls                          # /usr/share/man/man1/ls.1.gz
man -wa ls                         # Show all candidate paths
```

---

## 3. Info Pages

### 3.1 Basics of info

```bash
# GNU tools (coreutils, bash, gawk, etc.) have
# info pages that are more detailed than man

# Displaying info pages
info coreutils           # info page for GNU coreutils
info bash                # info page for bash
info gawk                # info page for gawk
info grep                # info page for grep (more detailed than man)
info sed                 # info page for sed
info find                # info page for find
info tar                 # info page for tar
info make                # info page for make
info emacs               # info page for Emacs

# Open a specific node (section) directly
info coreutils 'ls invocation'
info bash 'Bash Builtins'
info bash 'Shell Expansions'
```

### 3.2 Navigation Inside an Info Page

```
How to navigate info:

Basic operations:
  Space      → next page
  Backspace  → previous page
  n          → next node (section)
  p          → previous node
  u          → parent node (one level up)
  t          → top node (beginning)
  l          → go back to previous position (like browser "Back")

Navigation:
  Tab        → move to next hyperlink
  Enter      → follow link
  [          → previous node
  ]          → next node
  m          → select menu item (move by entering name)
  f          → select link to follow
  d          → move to directory node (table of contents)

Search:
  s or /     → text search
  { / }      → previous/next search result

Quit:
  q          → quit

Making info easier to use:
  - pinfo command (improved info, supports color display)
  - info-mode inside Emacs (M-x info)
  - View in browser: convert to HTML with the info2html command
```

### 3.3 Choosing Between man and info

```
Comparison of man and info:

┌────────────────┬─────────────────────┬──────────────────────┐
│ Feature        │ man                 │ info                 │
├────────────────┼─────────────────────┼──────────────────────┤
│ Structure      │ Flat (1 file)       │ Hypertext            │
│ Navigation     │ Scroll only         │ Links between nodes  │
│ Detail level   │ Command overview    │ Includes tutorials   │
│ Target         │ Almost all commands │ Mainly GNU tools     │
│ Learning cost  │ Low                 │ Somewhat higher      │
│ Ease of use    │ Same as less        │ Unique key bindings  │
│ Update freq.   │ Bundled with pkg    │ Bundled with pkg     │
└────────────────┴─────────────────────┴──────────────────────┘

Practical guidance:
  - Check man first
  - Use info when man has little information, or when you need GNU tool details
  - In most cases, man is sufficient
```

---

## 4. tldr (Too Long; Didn't Read)

### 4.1 Overview and Installation of tldr

```bash
# tldr is a tool that displays only "usage examples" from man pages
# A collection of practical examples maintained by the community

# Installation
brew install tldr            # macOS (Homebrew)
npm install -g tldr          # Node.js
pip3 install tldr            # Python
sudo apt install tldr        # Ubuntu/Debian

# The database needs to be updated on first use
tldr --update

# Basic usage
tldr tar                     # Usage examples for tar
tldr curl                    # Usage examples for curl
tldr rsync                   # Usage examples for rsync
tldr find                    # Usage examples for find
tldr chmod                   # Usage examples for chmod
tldr ssh                     # Usage examples for ssh
tldr git-rebase              # Usage examples for git rebase
tldr docker-compose          # Usage examples for docker compose
tldr kubectl-get             # Usage examples for kubectl get

# Specify platform
tldr -p linux tar            # Linux version of tar
tldr -p osx pbcopy           # macOS-specific commands

# Update the database
tldr --update
```

### 4.2 Example tldr Output

```bash
# Example: output of tldr tar

# tar
# Archiving utility.
# Often combined with a compression method, such as gzip or bzip2.
# More information: https://www.gnu.org/software/tar
#
# Create an archive and write it to a file:
#   tar cf target.tar file1 file2 file3
#
# Create a gzipped archive and write it to a file:
#   tar czf target.tar.gz file1 file2 file3
#
# Create a gzipped archive from a directory using relative paths:
#   tar czf target.tar.gz --directory=path/to/directory .
#
# Extract a (compressed) archive file into the current directory verbosely:
#   tar xvf source.tar[.gz|.bz2|.xz]
#
# Extract a (compressed) archive file into the target directory:
#   tar xf source.tar[.gz|.bz2|.xz] --directory=directory
#
# List the contents of a tar file verbosely:
#   tar tvf source.tar

# Compared to man pages:
# - man tar: hundreds of lines of option descriptions
# - tldr tar: only 6 practical usage examples
# → When you "just want to use this command right now," tldr is overwhelmingly faster
```

### 4.3 Alternatives and Supplements to tldr

```bash
# ============================================
# cheat.sh (cheatsheets accessible via curl)
# ============================================

# No installation needed, accessible via curl
curl cheat.sh/tar                    # Cheatsheet for tar
curl cheat.sh/curl                   # Cheatsheet for curl
curl cheat.sh/find                   # Cheatsheet for find
curl cheat.sh/git                    # Cheatsheet for git
curl cheat.sh/python/lambda          # How to use Python lambda
curl cheat.sh/go/goroutine           # How to use Go goroutines
curl cheat.sh/js/async               # How to use JavaScript async/await

# Search
curl cheat.sh/~keyword              # Search by keyword

# Define as a shell function
cheat() {
    curl -s "cheat.sh/$1"
}
# Usage: cheat tar, cheat curl, cheat python/list

# ============================================
# navi (interactive cheatsheet)
# ============================================

# Installation
brew install navi              # macOS
# cargo install navi           # Rust

# Usage
navi                           # Interactively search cheatsheets
navi --query "docker"          # Search for docker-related commands
navi --query "git branch"      # Search for git branch-related commands

# Bind to Ctrl+G (add to ~/.zshrc)
eval "$(navi widget zsh)"

# ============================================
# eg (example-centered help)
# ============================================

# Installation
pip3 install eg

# Usage
eg tar                         # Usage examples for tar
eg find                        # Usage examples for find
eg grep                        # Usage examples for grep

# ============================================
# bropages (community-driven usage examples)
# ============================================

# Installation
# gem install bropages

# Usage
# bro curl                     # Usage examples for curl
# bro tar                      # Usage examples for tar
```

---

## 5. Practical Help Usage Techniques

### 5.1 Efficient Information-Gathering Flow

```bash
# ============================================
# Recommended flow for looking up how to use a command
# ============================================

# Step 1: Check practical examples with tldr (fastest)
tldr rsync

# Step 2: Check option list with --help
rsync --help

# Step 3: Open man if more detail is needed
man rsync
# /EXAMPLES to jump to usage examples
# /-a to search for the -a option description

# Step 4: Check info for even more detailed information
info rsync

# Step 5: Use online resources if still unclear
# https://explainshell.com/ — breaks down and explains each part of a command
# https://www.man7.org/linux/man-pages/ — online man pages
# https://ss64.com/ — command reference
# Stack Overflow — answers to specific questions
```

### 5.2 Using explainshell.com

```bash
# explainshell.com is a web service that breaks down complex commands and explains each part

# Example: looking up the meaning of the following command
# find . -name "*.log" -mtime +30 -exec rm {} \;

# Go to explainshell.com in your browser,
# enter the command, and each part is explained:
#
# find        → command to search for files
# .           → search from the current directory
# -name       → match by file name
# "*.log"     → files ending in .log
# -mtime +30  → files modified more than 30 days ago
# -exec       → execute a command on each matched file
# rm {}       → delete the file ({} is replaced with the matched filename)
# \;          → indicates the end of -exec

# Function to open explainshell from the command line
explain() {
    local url="https://explainshell.com/explain?cmd="
    local encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$*'))")
    open "${url}${encoded}"    # macOS
    # xdg-open "${url}${encoded}"  # Linux
}

# Usage
# explain find . -name "*.log" -mtime +30 -exec rm {} \;
```

### 5.3 Techniques for Quickly Finding Specific Information

```bash
# ============================================
# Quickly extract only the information you need from man pages
# ============================================

# Technique 1: Filter with grep
man ls | grep -A 3 -- "-l"           # Description of -l option (3 lines)
man curl | grep -A 5 -- "--proxy"    # Description of --proxy
man find | grep -B 2 -A 5 "mtime"   # Description of mtime

# Technique 2: Search man page as text
man ls 2>/dev/null | col -b | grep -i "sort"

# Technique 3: Display only a specific section
man ls | sed -n '/^DESCRIPTION/,/^[A-Z]/p'  # Only the DESCRIPTION section

# Technique 4: Extract only the option list
man ls | grep "^\s*-"                # Show only option lines

# Technique 5: Check exit codes
man ls | sed -n '/^EXIT STATUS/,/^[A-Z]/p'
man grep | sed -n '/^EXIT STATUS/,/^[A-Z]/p'
# grep: 0=match found, 1=no match, 2=error

# Technique 6: Check related commands
man ls | sed -n '/^SEE ALSO/,/^[A-Z]/p'

# Technique 7: Check environment variables
man ls | sed -n '/^ENVIRONMENT/,/^[A-Z]/p'
man git | sed -n '/^ENVIRONMENT/,/^[A-Z]/p'
```

### 5.4 Comparing Multiple Man Pages

```bash
# ============================================
# Comparing similar commands
# ============================================

# cp vs rsync: which should you use for copying?
man cp | head -20                    # Check the overview of cp
man rsync | head -20                 # Check the overview of rsync

# find vs fd: comparing file search commands
man find | wc -l                     # Number of lines in find's man page (usually 500+)
man fd | wc -l                       # Number of lines in fd's man page (usually 100-200)

# grep vs rg (ripgrep): comparing text search
man grep | grep -c "^\s*-"          # Number of grep options
man rg | grep -c "^\s*-"            # Number of rg options

# Practical comparison technique
diff <(man cp 2>/dev/null | col -b) <(man rsync 2>/dev/null | col -b)

# Check whether a specific option exists
man tar | grep -q "\-\-zstd" && echo "zstd supported" || echo "zstd not supported"
```

---

## 6. Using Online Resources

### 6.1 Key Online Resources

```
Resources for checking man pages and help online:

■ Official man pages
  - https://www.man7.org/linux/man-pages/
    Official Linux man pages. Always available in the latest version.
  - https://man.openbsd.org/
    OpenBSD man pages. Useful as a POSIX compliance reference.

■ Explanation / Commentary
  - https://explainshell.com/
    Visually breaks down and explains each part of a command.
  - https://www.shellcheck.net/
    Shell script syntax checker (online version).

■ Cheatsheets / References
  - https://cheat.sh/
    Cheatsheets accessible via curl.
  - https://ss64.com/
    Command references for each OS (Linux, macOS, Windows).
  - https://devhints.io/
    Cheatsheets for various tools.

■ Q&A / Community
  - https://stackoverflow.com/
    Q&A for programming in general.
  - https://unix.stackexchange.com/
    Q&A focused on Unix/Linux.
  - https://askubuntu.com/
    Q&A focused on Ubuntu.
  - https://serverfault.com/
    Q&A focused on server administration.

■ Tutorials
  - https://linuxcommand.org/
    Comprehensive Linux command-line tutorial.
  - https://www.gnu.org/software/coreutils/manual/
    Complete manual for GNU coreutils.
  - https://tldp.org/
    Linux Documentation Project (collection of guides).
```

### 6.2 Accessing Online Resources from the Command Line

```bash
# ============================================
# Accessing online help from the terminal
# ============================================

# Use cheat.sh from the terminal
curl cheat.sh/tar
curl cheat.sh/find
curl cheat.sh/awk

# Define as a shell function
cheat() {
    curl -s "cheat.sh/$*" | less -R
}

# howdoi: answers programming questions
# pip3 install howdoi
howdoi "extract tar.gz in linux"
howdoi "find files larger than 100MB"
howdoi "python read csv file"

# Search StackOverflow from the terminal
# pip3 install so
# so "how to find large files in linux"

# Google search from the terminal
# Using the web-search plugin for Oh My Zsh:
# google "linux find command examples"
# stackoverflow "bash array loop"

# Or define a function
google() {
    local query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$*'))")
    open "https://www.google.com/search?q=${query}"    # macOS
    # xdg-open "https://www.google.com/search?q=${query}"  # Linux
}
```

---

## 7. Creating Custom Help

### 7.1 Creating Your Own Man Page

```bash
# ============================================
# Creating a custom man page
# ============================================

# Man pages are written using troff/groff macros
# The following is an example of a minimal man page

cat > /tmp/mycommand.1 << 'MANEOF'
.TH MYCOMMAND 1 "2026-02-16" "1.0" "User Commands"
.SH NAME
mycommand \- Description of your custom command
.SH SYNOPSIS
.B mycommand
[\fB\-v\fR]
[\fB\-o\fR \fIoutput\fR]
.IR input
.SH DESCRIPTION
.B mycommand
is a command that processes an input file and produces output.
.PP
Write a detailed description here.
Use .PP to separate paragraphs.
.SH OPTIONS
.TP
.BR \-v ", " \-\-verbose
Show verbose output.
.TP
.BR \-o ", " \-\-output " " \fIfile\fR
Specify the output file. Defaults to standard output.
.TP
.BR \-h ", " \-\-help
Show the help message and exit.
.SH EXAMPLES
.PP
Basic usage:
.RS
.nf
mycommand input.txt
.fi
.RE
.PP
Specify output file:
.RS
.nf
mycommand -o output.txt input.txt
.fi
.RE
.SH EXIT STATUS
.TP
.B 0
Success
.TP
.B 1
General error
.TP
.B 2
Usage error (invalid arguments)
.SH SEE ALSO
.BR grep (1),
.BR sed (1),
.BR awk (1)
.SH AUTHOR
Your Name
.SH BUGS
Report bugs at: https://github.com/user/repo/issues
MANEOF

# Display the created man page
man /tmp/mycommand.1

# Install to the system (optional)
sudo cp /tmp/mycommand.1 /usr/local/share/man/man1/
sudo mandb                           # Update database (Linux)
```

### 7.2 Project-Specific Help Systems

```bash
# ============================================
# Embedding README-based help in a project
# ============================================

# Adding a help target to Makefile (common approach)
# Makefile:

.PHONY: help
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build the project
	npm run build

test: ## Run tests
	npm test

deploy: ## Deploy to production
	./scripts/deploy.sh

lint: ## Run linter
	npm run lint

clean: ## Remove build artifacts
	rm -rf dist/ node_modules/

# Usage: running make help displays
# build                Build the project
# clean                Remove build artifacts
# deploy               Deploy to production
# lint                 Run linter
# test                 Run tests
```

```bash
# ============================================
# Embedding help in a shell script
# ============================================

#!/bin/bash
# my-deploy.sh — deploy script

set -euo pipefail

VERSION="1.0.0"

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] <environment>

Deploy script - deploys the application to the specified environment.

Arguments:
  environment    Target deployment environment (staging|production)

Options:
  -b, --branch BRANCH    Branch to deploy (default: main)
  -d, --dry-run          Dry run (do not actually deploy)
  -f, --force            Deploy without confirmation
  -v, --verbose          Show detailed output
  -h, --help             Show this help message
  --version              Show version

Examples:
  $(basename "$0") staging                      # Deploy to staging
  $(basename "$0") -b feature/new production    # Deploy specific branch to production
  $(basename "$0") -d production                # Dry run
  $(basename "$0") -f -v production             # Force + verbose

Environment Variables:
  DEPLOY_TOKEN    Authentication token for deployment
  SLACK_WEBHOOK   Webhook URL for Slack notifications

Exit Codes:
  0    Success
  1    General error
  2    Argument error
  3    Authentication error

See Also:
  docs/deployment.md — detailed deployment guide
  docs/rollback.md   — rollback procedures

Version: ${VERSION}
EOF
}

# Option parsing
BRANCH="main"
DRY_RUN=false
FORCE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -b|--branch)  BRANCH="$2"; shift 2 ;;
        -d|--dry-run) DRY_RUN=true; shift ;;
        -f|--force)   FORCE=true; shift ;;
        -v|--verbose) VERBOSE=true; shift ;;
        -h|--help)    usage; exit 0 ;;
        --version)    echo "$(basename "$0") ${VERSION}"; exit 0 ;;
        -*)           echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
        *)            ENVIRONMENT="$1"; shift ;;
    esac
done

# Argument check
if [[ -z "${ENVIRONMENT:-}" ]]; then
    echo "Error: environment is required" >&2
    usage >&2
    exit 2
fi

echo "Deploying branch ${BRANCH} to ${ENVIRONMENT}..."
```

---

## 8. Shell Built-in Documentation

### 8.1 bash Special Variable Reference

```bash
# ============================================
# bash/zsh special variables (hard to find in help)
# ============================================

# Process-related
$$                # PID of the current shell
$!                # PID of the last background process
$?                # Exit code of the last executed command
$-                # Current shell options

# Argument-related (used inside scripts)
$0                # Script name
$1 ~ $9          # Positional parameters (arguments)
${10}             # 10th and beyond require { }
$#                # Number of arguments
$@                # All arguments (individually quoted)
$*                # All arguments (as one string)
"$@"              # Recommended: expand each argument individually quoted
"$*"              # Expand all arguments as one string

# Other
$_                # Last argument of the previous command
$PPID             # PID of the parent process
$RANDOM           # Random integer (0-32767)
$LINENO           # Current line number
$SECONDS          # Seconds elapsed since shell started
$BASH_VERSION     # bash version
$ZSH_VERSION      # zsh version

# How to check
man bash           # Full bash documentation
man bash | grep -A 3 "Special Parameters"
help                # List of bash built-in commands
```

### 8.2 bash Test Operator Reference

```bash
# ============================================
# Test operators (used with test / [ ] / [[ ]])
# ============================================

# File tests
[ -e file ]        # file exists
[ -f file ]        # regular file
[ -d file ]        # directory
[ -L file ]        # symbolic link
[ -r file ]        # readable
[ -w file ]        # writable
[ -x file ]        # executable
[ -s file ]        # size is non-zero
[ -p file ]        # named pipe
[ -S file ]        # socket
[ -b file ]        # block device
[ -c file ]        # character device
[ file1 -nt file2 ]  # file1 is newer than file2
[ file1 -ot file2 ]  # file1 is older than file2
[ file1 -ef file2 ]  # same inode (hard link)

# String tests
[ -z "$str" ]      # empty string
[ -n "$str" ]      # non-empty string
[ "$a" = "$b" ]    # equal
[ "$a" != "$b" ]   # not equal
[[ "$a" < "$b" ]]  # lexicographically less (inside [[ ]] only)
[[ "$a" > "$b" ]]  # lexicographically greater (inside [[ ]] only)
[[ "$a" =~ regex ]]  # regex match (inside [[ ]] only)
[[ "$a" == pattern ]]  # pattern match (inside [[ ]] only)

# Numeric tests
[ "$a" -eq "$b" ]  # equal
[ "$a" -ne "$b" ]  # not equal
[ "$a" -lt "$b" ]  # less than
[ "$a" -le "$b" ]  # less than or equal
[ "$a" -gt "$b" ]  # greater than
[ "$a" -ge "$b" ]  # greater than or equal

# Logical operators
[ condition1 ] && [ condition2 ]   # AND
[ condition1 ] || [ condition2 ]   # OR
[ ! condition ]                     # NOT
[[ condition1 && condition2 ]]     # AND (inside [[ ]])
[[ condition1 || condition2 ]]     # OR (inside [[ ]])

# How to check
help test          # bash help for the test command
man test           # man page for test
```

---

## 9. Practical Exercises

### Exercise 1: [Basic] -- Basic Man Page Operations

```bash
# Task: Find the following information from man pages

# 1. Option to sort by "largest file size" with ls
man ls
# → Search /sort → -S option

# 2. Option to display "lines that did NOT match" with grep
man grep
# → Search /invert → -v option

# 3. Expression to search for "files updated within 7 days" with find
man find
# → Search /mtime → -mtime -7

# 4. Option to "recursively change permissions" with chmod
man chmod
# → Search /recursive → -R option

# 5. Option to display "only HTTP headers" with curl
man curl
# → Search /header.*only → -I option

# Practice: Actually open each man page and find the information
```

### Exercise 2: [Intermediate] -- Information-Gathering Workflow

```bash
# Task: Look up how to use the unknown command "rsync" within 5 minutes

# Step 1: Check overview with whatis (10 seconds)
whatis rsync
# rsync (1) - a fast, versatile, remote (and local) file-copying tool

# Step 2: Check usage examples with tldr (30 seconds)
tldr rsync
# → Examples of basic copy, remote copy, and sync are shown

# Step 3: Check main options with --help (1 minute)
rsync --help | head -30
# → Overview of main options

# Step 4: Deep-dive into specific information in the man page (3 minutes)
man rsync
# /--exclude to check how to use exclude patterns
# /--delete to check the deletion option during sync
# /EXAMPLES to check practical examples

# Summary of results:
# rsync -avh source/ dest/           # Local copy
# rsync -avh source/ user@host:dest/ # Remote copy
# rsync -avh --delete source/ dest/  # Sync (delete unnecessary files)
# rsync -avhn source/ dest/          # Dry run (-n)
```

### Exercise 3: [Intermediate] -- Understanding Differences Between Commands

```bash
# Task: Use man pages to explain the differences between the following commands

# 1. cp vs rsync
# man cp | head -5
# man rsync | head -5
# cp: file copy (always copies all files)
# rsync: differential transfer (can transfer only changed files, supports remote)

# 2. find vs locate
# man find | head -5
# man locate | head -5
# find: traverses the filesystem in real time to search
# locate: searches from a pre-built database (fast but may not be current)

# 3. grep vs egrep vs fgrep
# Check DESCRIPTION in man grep
# grep: uses Basic Regular Expressions (BRE)
# egrep = grep -E: uses Extended Regular Expressions (ERE)
# fgrep = grep -F: fixed strings only (no regex, fastest)

# 4. kill vs killall vs pkill
# man kill | head -5
# man killall | head -5
# man pkill | head -5
# kill: send signal by PID
# killall: send signal by process name (full match)
# pkill: send signal by pattern match

# 5. cat vs less vs more
# man cat | head -5
# man less | head -5
# man more | head -5
# cat: output the entire file (no paging)
# less: pager (scroll back and forth, search supported)
# more: older pager (forward scroll only)
```

### Exercise 4: [Advanced] -- Creating a Script with a Help System

```bash
# Task: Create a backup script with help functionality
# Requirements:
# 1. Show usage with --help option
# 2. Show version with --version option
# 3. Argument checking with appropriate error messages
# 4. Proper setting of exit codes

cat > /tmp/backup.sh << 'SCRIPT_EOF'
#!/bin/bash
# backup.sh — simple backup script
#
# usage: backup.sh [OPTIONS] <source> <destination>
# See: backup.sh --help for details

set -euo pipefail

readonly VERSION="1.0.0"
readonly SCRIPT_NAME="$(basename "$0")"

# Color definitions
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly NC='\033[0m' # No Color

# Help message
usage() {
    cat << HELP
Usage: ${SCRIPT_NAME} [OPTIONS] <source> <destination>

Backs up the specified source directory.

Arguments:
  source          Source directory to back up
  destination     Destination directory for the backup

Options:
  -c, --compress     Compress the backup (tar.gz)
  -e, --exclude PAT  Exclude pattern (can be specified multiple times)
  -n, --dry-run      Dry run (do not actually copy)
  -v, --verbose      Verbose output
  -q, --quiet        Minimal output
  -h, --help         Show this help
  --version          Show version

Examples:
  ${SCRIPT_NAME} ~/Documents /backup/
  ${SCRIPT_NAME} -c ~/projects /backup/
  ${SCRIPT_NAME} -e "*.tmp" -e "node_modules" ~/src /backup/
  ${SCRIPT_NAME} -nv ~/data /backup/

Exit Codes:
  0  Success
  1  General error
  2  Argument error (invalid option, missing arguments)
  3  Source does not exist
  4  Cannot write to destination

Version: ${VERSION}
Report bugs: https://github.com/example/backup/issues
HELP
}

# Error message
error() {
    echo -e "${RED}Error: $*${NC}" >&2
}

# Info message
info() {
    if [[ "$QUIET" == false ]]; then
        echo -e "${GREEN}Info: $*${NC}"
    fi
}

# Warning message
warn() {
    echo -e "${YELLOW}Warning: $*${NC}" >&2
}

# Default values
COMPRESS=false
DRY_RUN=false
VERBOSE=false
QUIET=false
EXCLUDES=()

# Option parsing
while [[ $# -gt 0 ]]; do
    case "$1" in
        -c|--compress)  COMPRESS=true; shift ;;
        -e|--exclude)   EXCLUDES+=("$2"); shift 2 ;;
        -n|--dry-run)   DRY_RUN=true; shift ;;
        -v|--verbose)   VERBOSE=true; shift ;;
        -q|--quiet)     QUIET=true; shift ;;
        -h|--help)      usage; exit 0 ;;
        --version)      echo "${SCRIPT_NAME} ${VERSION}"; exit 0 ;;
        -*)             error "Unknown option: $1"; echo; usage >&2; exit 2 ;;
        *)              break ;;
    esac
done

# Argument check
if [[ $# -lt 2 ]]; then
    error "source and destination are required"
    echo "Try '${SCRIPT_NAME} --help' for more information." >&2
    exit 2
fi

SOURCE="$1"
DESTINATION="$2"

# Check if source exists
if [[ ! -d "$SOURCE" ]]; then
    error "Source directory not found: $SOURCE"
    exit 3
fi

# Run backup
info "Backing up: $SOURCE -> $DESTINATION"
info "Compress: $COMPRESS, Dry-run: $DRY_RUN"

if [[ "$DRY_RUN" == true ]]; then
    info "DRY RUN - no files will be copied"
fi

echo "Backup complete!"
SCRIPT_EOF

chmod +x /tmp/backup.sh

# Test
/tmp/backup.sh --help
/tmp/backup.sh --version
/tmp/backup.sh -nv ~/Documents /tmp/backup/
```

### Exercise 5: [Advanced] -- Creating a Custom Help Function

```bash
# Task: Create a mechanism to quickly reference cheatsheets
# for commands you use often, directly from the terminal

# Save cheatsheets for each command in ~/.zsh/cheatsheets/
mkdir -p ~/.zsh/cheatsheets

# Example git cheatsheet
cat > ~/.zsh/cheatsheets/git << 'CHEAT_EOF'
=== Git Cheatsheet ===

Basic operations:
  git init                    Initialize a repository
  git clone <url>             Clone a repository
  git add <file>              Stage files
  git commit -m "msg"         Commit
  git push                    Push to remote
  git pull                    Pull from remote

Branches:
  git branch                  List branches
  git switch -c <name>        Create and switch to a new branch
  git switch <name>           Switch branch
  git merge <branch>          Merge
  git rebase <branch>         Rebase

Undoing changes:
  git reset --soft HEAD~1     Undo the last commit (keep changes)
  git reset --hard HEAD~1     Completely undo the last commit
  git restore <file>          Undo changes to a file
  git restore --staged <file> Unstage a file

Diffs:
  git diff                    Diff in working tree
  git diff --staged           Diff in staging
  git log --oneline -10       Last 10 log entries
CHEAT_EOF

# Example docker cheatsheet
cat > ~/.zsh/cheatsheets/docker << 'CHEAT_EOF'
=== Docker Cheatsheet ===

Container operations:
  docker run -it <image> bash     Start container and enter bash
  docker ps                       List running containers
  docker ps -a                    List all containers
  docker stop <container>         Stop a container
  docker rm <container>           Remove a container
  docker exec -it <c> bash        Run bash inside a container

Image operations:
  docker images                   List images
  docker build -t <tag> .         Build an image
  docker rmi <image>              Remove an image
  docker pull <image>             Pull an image

Docker Compose:
  docker compose up -d            Start in background
  docker compose down             Stop and remove
  docker compose logs -f          Follow logs
  docker compose exec <svc> bash  Run bash inside a service

Cleanup:
  docker system prune -af         Remove all unused resources
  docker volume prune             Remove unused volumes
CHEAT_EOF

# Function to display cheatsheets
cs() {
    local sheet="$HOME/.zsh/cheatsheets/$1"
    if [[ -f "$sheet" ]]; then
        bat --plain "$sheet" 2>/dev/null || cat "$sheet"
    elif [[ -z "$1" ]]; then
        echo "Available cheatsheets:"
        ls ~/.zsh/cheatsheets/
    else
        echo "Cheatsheet not found: $1"
        echo "Available: $(ls ~/.zsh/cheatsheets/ | tr '\n' ' ')"
        echo ""
        echo "Falling back to tldr..."
        tldr "$1"
    fi
}

# Usage:
# cs               → list available cheatsheets
# cs git           → show git cheatsheet
# cs docker        → show docker cheatsheet
# cs unknown       → fall back to tldr
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / resource shortage | Adjust timeout value, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check running user's permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Use log output or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Called: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O wait**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Issue Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When you can compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time to market | Quality-first, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                        │
│    ├─ Small (1-5)  → Monolith                    │
│    └─ Large (10+)  → Go to ②                    │
│                                                 │
│  ② How often do you deploy?                      │
│    ├─ Once a week or less → Monolith + modules   │
│    └─ Daily / multiple    → Go to ③              │
│                                                 │
│  ③ How independent are the teams?                │
│    ├─ High   → Microservices                     │
│    └─ Medium → Modular monolith                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Analyzing Trade-offs

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs long-term cost**
- A quick short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs flexibility**
- A unified technology stack lowers learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and the problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
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


## FAQ

### Q1: What is the most important point when learning this topic?

Accumulating hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Method | Use | Amount of Info | Speed |
|------|------|--------|------|
| --help | Quick lightweight help | Low~Medium | Fastest |
| man | Comprehensive manual | High | Fast |
| info | Detailed docs for GNU tools | High | Moderate |
| help | bash built-in commands | Medium | Fast |
| tldr | Practical usage examples | Low | Fast |
| cheat.sh | Online cheatsheets | Low~Medium | Network-dependent |
| apropos | Search when you don't know the command name | Search results | Fast |
| whatis | One-line description of a command | Minimal | Fastest |
| type/which | Command location and type | Minimal | Fastest |
| explainshell | Break down and explain complex commands | Medium | Network-dependent |

### Skills to Develop

1. **Fast man page navigation** -- /search, g/G movement, section jumping
2. **Reading SYNOPSIS** -- instantly understand the meaning of [ ], < >, ..., |
3. **Choosing the right help method** -- use tldr / man / info appropriately for the situation
4. **Understanding section numbers** -- open the correct man page when multiple exist with the same name
5. **Distinguishing built-in vs external commands** -- check with type and choose the right help method
6. **Using online resources** -- know the alternatives when local man is insufficient

---

## Further Reading

---

## References
1. Shotts, W. "The Linux Command Line." 2nd Ed, No Starch Press, 2019.
2. Powers, S., Peek, J., O'Reilly, T., Loukides, M. "Unix Power Tools." 3rd Ed, O'Reilly, 2002.
3. Kerrisk, M. "The Linux Programming Interface." No Starch Press, 2010.
4. GNU Coreutils Manual: https://www.gnu.org/software/coreutils/manual/
5. tldr-pages project: https://github.com/tldr-pages/tldr
6. cheat.sh project: https://github.com/chubin/cheat.sh
7. explainshell.com: https://explainshell.com/
8. man-pages project: https://www.man7.org/linux/man-pages/
