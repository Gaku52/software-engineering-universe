# Pattern Search (grep / ripgrep)

> grep is the most important filtering tool for "extracting lines you need from text."

## What You Will Learn

- [ ] Master the key options of grep
- [ ] Perform searches using regular expressions
- [ ] Use ripgrep (rg) for fast recursive searches
- [ ] Know when to use grep-family tools (egrep, fgrep, ag, ack)
- [ ] Learn search patterns commonly used in real-world work


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [File Display](./00-cat-less-head-tail.md)

---

## 1. grep Basics

### 1.1 Basic Syntax and Behavior

```bash
# Basic syntax: grep [options] pattern [file...]
#
# grep matches the pattern against each line of input,
# and prints matching lines to standard output.
# Patterns are interpreted as Basic Regular Expressions (BRE) by default.

# Basic string search
grep "error" logfile.txt            # Show lines containing "error"
grep "warning" logfile.txt          # Show lines containing "warning"
grep "fatal" logfile.txt            # Show lines containing "fatal"

# Without a file argument, reads from standard input
echo "hello world" | grep "world"   # Lines containing "world"
ps aux | grep nginx                 # Search via pipe
cat /etc/passwd | grep "root"       # Search for root in /etc/passwd

# Searching multiple files
grep "error" *.log                  # Search all .log files
grep "TODO" src/*.py                # Search Python files for TODO
grep "import" lib/*.js              # Search JS files for import
```

### 1.2 Key Options (Output Control)

```bash
# -i: Ignore case
grep -i "error" logfile.txt         # Matches Error, ERROR, error, etc.
grep -i "warning" logfile.txt       # Also matches Warning, WARNING, etc.

# -n: Show line numbers
grep -n "error" logfile.txt         # Output like "42:error occurred"
grep -n "TODO" src/*.py             # filename:line_number:matched_line

# -c: Count matching lines
grep -c "error" logfile.txt         # Show match count as a number
grep -c "error" *.log               # Match count per file

# -l: Show only matching file names (not file contents)
grep -l "error" *.log               # Names of log files containing error
grep -rl "TODO" src/                # Recursively find file names containing TODO
grep -rL "test" src/                # File names NOT containing test (-L is the inverse of -l)

# -v: Invert match (show lines that do NOT match)
grep -v "debug" logfile.txt         # Lines not containing debug
grep -v "^#" config.conf            # Lines that are not comments
grep -v "^$" file.txt               # Lines that are not empty

# -w: Whole-word match
grep -w "error" logfile.txt         # Exact match for "error" ("errors" does not match)
grep -w "log" file.txt              # Matches "log" (not "logging")
grep -w "main" *.py                 # Search for the word "main"

# -x: Match entire line
grep -x "hello" file.txt            # Only lines where the entire line is "hello"

# -o: Show only the matched part (not the full line)
grep -o "error[a-z]*" logfile.txt   # Extract words starting with "error"
grep -oP "\d+\.\d+\.\d+\.\d+" access.log  # Extract IP addresses

# -q: Suppress output (exit code only, for scripts)
if grep -q "error" logfile.txt; then
    echo "Error found"
fi
```

### 1.3 Context Display (-A / -B / -C)

```bash
# -A N: Show N lines After the match
grep -A 3 "error" logfile.txt       # Matched line + 3 lines after
grep -A 5 "Exception" app.log       # Exception line + 5 lines of stack trace

# -B N: Show N lines Before the match
grep -B 2 "error" logfile.txt       # 2 lines before + matched line
grep -B 5 "FATAL" app.log           # Review context before the error

# -C N: Show N lines of Context before and after the match
grep -C 2 "error" logfile.txt       # 2 lines before + matched line + 2 lines after
grep -C 3 "segfault" /var/log/kern.log  # 3 lines around the segfault

# Context display separator
# When there are multiple matches, they are separated by "--"
grep -C 1 "error" logfile.txt
# → "--" is displayed between match blocks

# Change the group separator
grep --group-separator="===" -C 2 "error" logfile.txt
```

### 1.4 Recursive Search (-r / -R)

```bash
# -r: Recursively search directories
grep -r "TODO" ./src/               # Recursive search under src/
grep -r "import os" ./              # Search the current directory and below
grep -rn "console.log" ./src/       # Recursive search with line numbers

# -R: Same as -r, but follows symbolic links
grep -R "pattern" /etc/             # Also searches symlink targets

# --include: Search only specific file patterns
grep -rn --include="*.py" "import" ./src/     # Only .py files
grep -rn --include="*.{js,ts}" "fetch" ./src/ # Only .js and .ts
grep -rn --include="*.go" "func main" ./      # Only .go files

# --exclude: Exclude specific file patterns
grep -rn --exclude="*.min.js" "function" ./   # Exclude minified JS
grep -rn --exclude="*.pyc" "import" ./        # Exclude .pyc files

# --exclude-dir: Exclude specific directories
grep -rn --exclude-dir=node_modules "require" ./       # Exclude node_modules
grep -rn --exclude-dir=.git "TODO" ./                  # Exclude .git
grep -rn --exclude-dir={node_modules,.git,dist} "pattern" ./  # Exclude multiple

# Common recursive search patterns in real-world use
grep -rn --include="*.py" --exclude-dir={__pycache__,.git,venv} "TODO\|FIXME\|HACK" ./
grep -rn --include="*.{js,ts,jsx,tsx}" --exclude-dir={node_modules,.next,dist} "console.log" ./
```

### 1.5 Multiple Pattern Search

```bash
# -e: OR search with multiple patterns
grep -e "error" -e "warning" logfile.txt        # error OR warning
grep -e "fatal" -e "critical" -e "error" app.log  # Three patterns

# -f: Load patterns from a file
cat > patterns.txt << 'EOF'
error
warning
fatal
EOF
grep -f patterns.txt logfile.txt    # Search using patterns from file

# AND search via pipe
grep "error" logfile.txt | grep "database"    # error AND database
grep "error" logfile.txt | grep -v "timeout"  # error AND NOT timeout

# OR search with regular expressions (-E = Extended Regular Expressions)
grep -E "error|warning|fatal" logfile.txt     # OR search
grep -E "(error|warning)" logfile.txt         # With grouping

# Alternative AND search (using awk)
awk '/error/ && /database/' logfile.txt       # Lines containing both error AND database
```

---

## 2. Using Regular Expressions

### 2.1 Basic Regular Expressions (BRE) and Extended Regular Expressions (ERE)

```bash
# grep uses Basic Regular Expressions (BRE) by default
# Use -E option (or egrep) for Extended Regular Expressions (ERE)
# Use -P option for Perl Compatible Regular Expressions (PCRE) (GNU grep only)

# Difference between BRE and ERE:
# BRE: +, ?, |, (), {} are literals. Use \+, \?, \|, \(\), \{\} as metacharacters
# ERE: +, ?, |, (), {} are metacharacters. No escaping needed

# BRE examples
grep "error\|warning" logfile.txt              # OR (BRE)
grep "ab\{2,4\}" file.txt                      # b appears 2-4 times after a (BRE)
grep "\(abc\)\{2\}" file.txt                   # "abc" repeated twice (BRE)

# ERE examples (-E / egrep)
grep -E "error|warning" logfile.txt            # OR (ERE, no escaping needed)
grep -E "ab{2,4}" file.txt                     # b appears 2-4 times after a (ERE)
grep -E "(abc){2}" file.txt                    # "abc" repeated twice (ERE)
```

### 2.2 Regular Expression Metacharacter Reference

```bash
# === Anchors ===
grep "^Error" logfile.txt            # Line starts with "Error"
grep "done$" logfile.txt             # Line ends with "done"
grep "^$" file.txt                   # Empty lines
grep -E "^\s*$" file.txt             # Lines with only whitespace (including empty lines)

# === Character classes ===
grep "[abc]" file.txt                # Any of a, b, c
grep "[a-z]" file.txt                # Lowercase letters
grep "[A-Z]" file.txt                # Uppercase letters
grep "[0-9]" file.txt                # Digits
grep "[^0-9]" file.txt               # Non-digits

# === Quantifiers ===
grep -E "ab?" file.txt               # 0 or 1 b after a
grep -E "ab+" file.txt               # 1 or more b after a
grep -E "ab*" file.txt               # 0 or more b after a
grep -E "ab{3}" file.txt             # Exactly 3 b's after a
grep -E "ab{2,5}" file.txt           # 2 to 5 b's after a
grep -E "ab{3,}" file.txt            # 3 or more b's after a

# === Wildcards ===
grep "a.b" file.txt                  # Any single character between a and b
grep "a.*b" file.txt                 # Any string between a and b

# === Grouping and back-references ===
grep -E "(abc){2}" file.txt          # Matches "abcabc"
grep -E "(error|warn)" logfile.txt   # "error" or "warn"
grep "\(.*\)\1" file.txt             # Repeated string (back-reference, BRE)

# === Word boundaries ===
grep "\berror\b" logfile.txt         # Word "error" (\b = word boundary)
grep "\<error\>" logfile.txt         # Same (\< = word start, \> = word end)
grep -w "error" logfile.txt          # -w option (equivalent)
```

### 2.3 Perl Compatible Regular Expressions (PCRE)

```bash
# -P option (GNU grep only. Not supported on macOS grep)
# On macOS, use brew install grep for ggrep, or use ripgrep

# \d: Digit (equivalent to [0-9])
grep -P "\d{4}-\d{2}-\d{2}" logfile.txt        # Date pattern (YYYY-MM-DD)

# \w: Alphanumeric and underscore (equivalent to [a-zA-Z0-9_])
grep -P "\w+@\w+\.\w+" file.txt                # Simple email address match

# \s: Whitespace character
grep -P "status:\s+\d{3}" access.log           # Status code

# Lookahead / Lookbehind
grep -P "(?<=price: )\d+" file.txt             # Digits after "price: " (lookbehind)
grep -P "\d+(?= yen)" file.txt                 # Digits before " yen" (lookahead)
grep -P "(?<!no )error" logfile.txt            # "error" not preceded by "no " (negative lookbehind)
grep -P "error(?! ignored)" logfile.txt        # "error" not followed by " ignored" (negative lookahead)

# Named capture groups
grep -oP "(?P<ip>\d+\.\d+\.\d+\.\d+)" access.log  # Extract IP addresses

# Non-greedy match
grep -oP '".*?"' file.txt                       # Shortest quoted text
grep -oP '<.*?>' file.html                      # HTML tags (shortest match)
```

### 2.4 Commonly Used Regex Pattern Library

```bash
# --- Date / Time ---
grep -E "^[0-9]{4}-[0-9]{2}-[0-9]{2}" logfile.txt         # YYYY-MM-DD format
grep -E "[0-9]{2}:[0-9]{2}:[0-9]{2}" logfile.txt           # HH:MM:SS format
grep -P "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}" logfile.txt # ISO 8601 format

# --- IP Addresses ---
grep -E "\b[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b" access.log
grep -oP "\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b" access.log  # Extract IPs

# --- Email Addresses ---
grep -E "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" file.txt

# --- URLs ---
grep -E "https?://[a-zA-Z0-9./?&=%-]+" file.txt
grep -oP "https?://[^\s\"'>]+" file.html                     # Extract URLs

# --- HTTP Status Codes ---
grep -E "HTTP/[0-9.]+ [0-9]{3}" access.log
grep -E "\s(4[0-9]{2}|5[0-9]{2})\s" access.log              # 4xx/5xx errors

# --- JSON Key Search ---
grep -oP '"name"\s*:\s*"[^"]*"' data.json
grep -oP '"version"\s*:\s*"[^"]*"' package.json

# --- Programming ---
grep -E "^(def|class) " *.py                                 # Python function/class definitions
grep -E "^(function|const|let|var) " *.js                    # JS function/variable definitions
grep -E "^func " *.go                                        # Go function definitions
grep -E "^(pub )?fn " *.rs                                   # Rust function definitions
```

---

## 3. Advanced grep Usage

### 3.1 grep + Pipe Real-World Patterns

```bash
# Process search (technique to exclude grep itself)
ps aux | grep "[n]ginx"             # Exclude grep itself ([n] trick)
ps aux | grep nginx | grep -v grep  # Exclude with grep -v (traditional method)
pgrep -la nginx                     # Use pgrep (recommended)

# Search command history
history | grep "git push"           # Git push history
history | grep "docker" | tail -20  # Last 20 Docker-related entries

# Package search
dpkg -l | grep "python"             # Installed Python packages
pip list | grep "django"            # Django-related packages
npm list | grep "react"             # React-related packages

# Network information search
netstat -tlnp | grep ":80"          # Processes using port 80
ss -tlnp | grep ":443"              # Processes using port 443
ip addr | grep "inet "              # Check IP addresses

# Docker-related
docker ps | grep -i running         # Running containers
docker images | grep "<none>"       # Unnamed images (dangling)
docker logs container 2>&1 | grep "ERROR"  # Search container logs for errors

# Git-related
git log --oneline | grep "fix"      # Commits containing "fix"
git diff | grep "^+"                # Only added lines
git branch -a | grep "feature"      # List of feature branches
```

### 3.2 Customizing grep Output

```bash
# --color: Highlight matched parts in color
grep --color=always "error" logfile.txt   # Always use color
grep --color=auto "error" logfile.txt     # Color only for terminal output (default)
grep --color=never "error" logfile.txt    # Disable color

# Preserve color through a pipe
grep --color=always "error" logfile.txt | less -R

# -H / -h: Control filename display
grep -H "pattern" file.txt          # Always show filename
grep -h "pattern" *.txt             # Hide filename

# -Z: Use NULL character as filename separator (combine with xargs -0)
grep -rlZ "pattern" . | xargs -0 sed -i 's/pattern/replacement/g'

# --label: Specify label for standard input
cat file.txt | grep --label="STDIN" -H "pattern"

# -m N: Stop after first N matches
grep -m 5 "error" large_logfile.txt      # First 5 matches only
grep -m 1 "pattern" file.txt             # First match only (existence check)

# Combining count and filename
grep -rc "TODO" ./src/ | grep -v ":0$" | sort -t: -k2 -rn
# → Show files containing TODO in descending order of count
```

### 3.3 Special grep Options

```bash
# -F: Search as fixed string (disables regex, faster)
grep -F "error.log" file.txt         # Search for dot as literal
grep -F "[ERROR]" logfile.txt        # Search for brackets as literals
grep -F "$HOME" script.sh            # Search for $HOME as literal

# fgrep is equivalent to grep -F
fgrep "pattern" file.txt             # Fixed string search

# -z: Treat NULL character as line separator (a form of multiline search)
grep -Pzo "function.*?\n.*?return" *.js   # From function definition to return

# --binary-files: How to handle binary files
grep --binary-files=text "pattern" binary_file   # Search binary as text
grep -a "pattern" binary_file                     # Same as -a

# -T: Align output with tabs
grep -Tn "pattern" file.txt          # Display with tab-aligned positions
```

### 3.4 Bulk Operations with grep + xargs

```bash
# Bulk operations on files from search results
grep -rl "old_function" ./src/ | xargs sed -i 's/old_function/new_function/g'
# → Find files containing old_function and replace in bulk

# Open search result files in editor
grep -rl "TODO" ./src/ | xargs code
# → Open files containing TODO in VS Code

# List search results
grep -rl "deprecated" ./src/ | xargs ls -la
# → Detailed info on files containing "deprecated"

# Safe bulk operations with NULL separator (handles filenames with spaces)
grep -rlZ "pattern" . | xargs -0 wc -l
grep -rlZ "old" . | xargs -0 sed -i 's/old/new/g'
```

---

## 4. ripgrep (rg) — A Modern High-Speed Search Tool

### 4.1 Installation and Overview

```bash
# Installation
brew install ripgrep               # macOS
sudo apt install ripgrep           # Ubuntu/Debian
sudo pacman -S ripgrep             # Arch Linux
cargo install ripgrep              # Rust (Cargo)

# ripgrep features
# - Recursive search by default
# - Automatically respects .gitignore
# - Unicode support
# - Color output by default
# - Fast search via parallel processing
# - Automatic line numbers
# - Rich file type filters
```

### 4.2 Basic Usage

```bash
# Basic syntax: rg [options] pattern [path]
rg "pattern"                       # Recursive search in current directory
rg "pattern" src/                  # Search in src/ directory
rg "pattern" file.txt              # Search a specific file

# Case control
rg -i "error"                      # Ignore case
rg -s "Error"                      # Case sensitive (disable smart case)
# Default: smart case (case-insensitive if pattern is all lowercase)

# Line and column numbers
rg -n "pattern"                    # Show line numbers (enabled by default)
rg --column "pattern"              # Also show column numbers

# Context display
rg -A 3 "error"                    # 3 lines after matched line
rg -B 2 "error"                    # 2 lines before matched line
rg -C 2 "error"                    # 2 lines before and after matched line
```

### 4.3 File Type Filters

```bash
# -t: Filter by file type
rg "pattern" -t py                 # Python files only
rg "pattern" -t js                 # JavaScript files only
rg "pattern" -t go                 # Go files only
rg "pattern" -t rust               # Rust files only
rg "pattern" -t java               # Java files only
rg "pattern" -t cpp                # C++ files only
rg "pattern" -t html               # HTML files only
rg "pattern" -t css                # CSS files only
rg "pattern" -t yaml               # YAML files only
rg "pattern" -t json               # JSON files only
rg "pattern" -t md                 # Markdown files only
rg "pattern" -t sh                 # Shell scripts only
rg "pattern" -t sql                # SQL files only
rg "pattern" -t docker             # Dockerfiles only
rg "pattern" -t make               # Makefiles only

# -T: Exclude a file type
rg "pattern" -T js                 # Exclude JavaScript
rg "pattern" -T test               # Exclude test files

# -g: Filter with glob pattern
rg "pattern" -g "*.{js,ts}"        # .js and .ts files
rg "pattern" -g "!*.min.js"        # Exclude .min.js
rg "pattern" -g "src/**"           # Only under src/ directory
rg "pattern" -g "!test/**"         # Exclude test/

# List predefined types
rg --type-list                     # Show all file types and their extensions
rg --type-list | grep "python"     # Check Python type definition

# Define custom types
rg --type-add "web:*.{html,css,js}" -t web "pattern"   # Search with custom type
```

### 4.4 Output Control

```bash
# -l: Show only matching filenames
rg "pattern" -l                    # Only filenames with matches

# --files-without-match: Show filenames that do NOT match
rg "pattern" --files-without-match

# -c: Count matches per file
rg "TODO|FIXME" -c                 # Count of TODO/FIXME per file

# --count-matches: Total match count (occurrences, not lines)
rg "pattern" --count-matches

# -o: Show only the matched portion
rg -o "\d+\.\d+\.\d+" file.txt    # Extract version numbers

# --json: Output in JSON format (for tool integration)
rg "pattern" --json                # Output search results in JSON

# --vimgrep: Output in Vim quickfix format
rg "pattern" --vimgrep             # file:line:col:matched_line

# --no-heading: Show filename on each line instead of as a group header
rg --no-heading "pattern"

# --heading: Show filename as a group header (default)
rg --heading "pattern"

# -U: Multiline match
rg -U "function.*\n.*return" -t js  # Pattern spanning multiple lines

# -M: Limit maximum characters per matched line
rg -M 200 "pattern"                # Truncate matched lines over 200 chars

# --trim: Remove leading whitespace from matched lines
rg --trim "pattern"
```

### 4.5 Hidden Files and .gitignore

```bash
# Default behavior
# - Respects .gitignore
# - Excludes hidden files (.xxx)
# - Excludes binary files

# --hidden: Include hidden files
rg "pattern" --hidden              # Include .env, .config, etc.
rg "API_KEY" --hidden              # Search inside .env files

# --no-ignore: Ignore .gitignore
rg "pattern" --no-ignore           # Also search .gitignore targets
rg "pattern" -u                    # Short form of --no-ignore

# -uu: Hidden files + ignore .gitignore
rg "pattern" -uu                   # Equivalent to --hidden --no-ignore

# -uuu: Also search binary files
rg "pattern" -uuu                  # All files (equivalent to find + grep)

# --no-ignore-vcs: Only ignore VCS ignore files (.gitignore, etc.)
rg "pattern" --no-ignore-vcs

# Add a specific ignore file
rg "pattern" --ignore-file .customignore
```

### 4.6 rg Replacement Feature

```bash
# -r / --replace: Replace matched portion for display (does not modify files)
rg "old" -r "new"                  # Display "old" replaced with "new"
rg "foo(\d+)" -r "bar$1"          # Replacement using capture groups

# Actual file replacement uses sed
rg -l "old_name" -t py | xargs sed -i 's/old_name/new_name/g'

# Preview of replacement
rg "old_function" -r "new_function" --passthru
# → Shows non-matching lines as-is, matched lines show replacement
```

### 4.7 rg Real-World Pattern Library

```bash
# --- Code Search ---

# Search for TODO/FIXME/HACK in bulk
rg "TODO|FIXME|HACK|XXX" -t py -t js -t go

# Search for unused imports (Python)
rg "^import|^from .* import" -t py --no-heading

# Find leftover console.log (JavaScript)
rg "console\.(log|debug|info|warn|error)" -t js -t ts

# Search for debug statements (Python)
rg "(print\(|pdb\.set_trace|breakpoint\(\))" -t py

# Search for function definitions
rg "^(def|class) " -t py                    # Python
rg "^(export )?(function|const|class) " -t js  # JavaScript
rg "^func " -t go                            # Go
rg "^(pub )?fn " -t rust                     # Rust

# --- Log Analysis ---

# Count by HTTP status code
rg -o "HTTP/\d\.\d\" (\d{3})" -r '$1' access.log | sort | uniq -c | sort -rn

# Logs for a specific time period
rg "^2026-02-16 1[4-5]:" app.log

# Extract IP addresses from error logs
rg "ERROR" access.log | rg -o "\d+\.\d+\.\d+\.\d+" | sort -u

# --- Configuration Files ---

# Find where environment variables are used
rg "process\.env\." -t js -t ts
rg "os\.environ" -t py
rg "os\.Getenv" -t go

# Detect hardcoded credentials
rg -i "(password|secret|api.?key|token)\s*[:=]\s*[\"']" --hidden

# --- Project Management ---

# File line count statistics (rg + wc)
rg --files -t py | xargs wc -l | sort -n

# Search for used libraries
rg "^import " -t py --no-filename | sort -u    # Python import list
rg "require\(" -t js --no-filename -o | sort -u  # Node.js require list

# Find usage of a specific function
rg "deprecated_function\(" -t py --stats      # --stats also shows match statistics
```

### 4.8 rg Configuration File

```bash
# Write settings in ~/.ripgreprc
# Specify config file path with RIPGREP_CONFIG_PATH environment variable

# Example ~/.ripgreprc
cat > ~/.ripgreprc << 'EOF'
# Smart case by default
--smart-case

# Max columns
--max-columns=200

# Include hidden files
# --hidden

# Always exclude specific directories
--glob=!.git/
--glob=!node_modules/
--glob=!target/
--glob=!__pycache__/
--glob=!*.pyc

# Custom type definitions
--type-add=web:*.{html,css,js,ts}
EOF

# Specify config file path via environment variable (add to ~/.bashrc)
export RIPGREP_CONFIG_PATH="$HOME/.ripgreprc"
```

---

## 5. Other Search Tools

### 5.1 ag (The Silver Searcher)

```bash
# Installation
brew install the_silver_searcher    # macOS
sudo apt install silversearcher-ag  # Ubuntu/Debian

# Basic usage
ag "pattern"                        # Recursive search (respects .gitignore)
ag -i "pattern"                     # Case insensitive
ag "pattern" -G "\.py$"             # Python files only
ag -l "pattern"                     # Show matching filenames only
ag --stats "pattern"                # With statistics

# Comparison of rg and ag:
# ag: Modern grep before rg. Still used, but rg is faster
# rg: Developed as ag's successor. Outperforms ag in almost every way
```

### 5.2 ack

```bash
# Installation
brew install ack                    # macOS
sudo apt install ack               # Ubuntu/Debian

# Basic usage
ack "pattern"                       # Recursive search
ack "pattern" --python              # Python files only
ack "pattern" --type-set=web:ext:html,css,js  # Custom type
ack -f --python                     # List Python files

# ack was a pioneering grep alternative
# rg is now the most recommended tool
```

### 5.3 grep / rg / ag / ack Comparison

```
┌──────────┬────────────┬────────────┬────────────┬────────────┐
│ Feature  │ grep       │ rg         │ ag         │ ack        │
├──────────┼────────────┼────────────┼────────────┼────────────┤
│ Speed    │ Standard   │ Fastest    │ Fast       │ Medium     │
│.gitignore│ No support │ Supported  │ Supported  │ Supported  │
│ Color    │ --color    │ Default    │ Default    │ Default    │
│ Unicode  │ Limited    │ Full       │ Partial    │ Partial    │
│ PCRE     │ -P (GNU)   │ Default    │ Partial    │ Perl regex │
│Multiline │ Limited    │ -U         │ No support │ No support │
│ Bundled  │ Yes        │ Separate   │ Separate   │ Separate   │
│ Replace  │ No support │ -r (display)│ No support│ No support │
│ Parallel │ No support │ Supported  │ Supported  │ No support │
└──────────┴────────────┴────────────┴────────────┴────────────┘

Recommendation: Use rg first. Use POSIX-compatible grep in scripts.
```

---

## 6. Real-World Pattern Library (Advanced)

### 6.1 Log Analysis One-liners

```bash
# Top 20 IP addresses by access count in access log
grep -oP "^\d+\.\d+\.\d+\.\d+" access.log | sort | uniq -c | sort -rn | head -20

# HTTP status code distribution
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# List of 404 error URLs
grep " 404 " access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -20

# Request count for a specific time period
grep "16/Feb/2026:14:" access.log | wc -l

# Response time analysis (assuming last field is response time)
awk '{print $NF}' access.log | sort -n | tail -20    # Slow requests

# Calculate error rate
total=$(wc -l < access.log)
errors=$(grep -c " [45][0-9][0-9] " access.log)
echo "Error rate: $(echo "scale=2; $errors * 100 / $total" | bc)%"

# Real-time error monitoring (with color)
tail -f access.log | grep --color=always --line-buffered " [45][0-9][0-9] "
```

### 6.2 Security Audit Patterns

```bash
# Detect hardcoded credentials
rg -i "(password|passwd|pwd)\s*[:=]" --hidden -g "!*.{lock,sum}"
rg -i "api[_-]?key\s*[:=]\s*['\"]" --hidden
rg -i "secret\s*[:=]" --hidden -g "!*.{lock,sum}"
rg "-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----" --hidden

# Detect SQL injection vulnerabilities
rg "execute\(.*\+.*\)" -t py         # SQL via string concatenation
rg "query\(.*\$" -t js               # SQL via template literals
rg "f\".*SELECT.*{" -t py            # SQL via f-string

# Detect XSS vulnerabilities
rg "innerHTML\s*=" -t js -t ts
rg "dangerouslySetInnerHTML" -t js -t ts
rg "v-html=" -t html

# Detect use of unsafe functions
rg "eval\(" -t py -t js              # Use of eval
rg "exec\(" -t py                    # Use of exec
rg "pickle\.loads?" -t py            # Use of pickle
```

### 6.3 Code Review Support Patterns

```bash
# Detect leftover debug code
rg "console\.(log|debug)" -t js -t ts  # JS/TS debug output
rg "print\(" -t py -g "!test_*"        # Python print (exclude tests)
rg "debugger" -t js -t ts              # JS debug breakpoints
rg "binding\.pry" -t ruby              # Ruby debug
rg "fmt\.Print" -t go -g "!*_test.go"  # Go fmt.Print (exclude tests)

# TODO/FIXME summary
rg "TODO|FIXME|HACK|XXX|DEPRECATED" --stats -c | sort -t: -k2 -rn

# Detect long functions (line count based)
rg -U "^def \w+.*:\n(.*\n){50,}" -t py --no-heading -l
# → Files containing Python functions with 50+ lines

# Detect magic numbers
rg "(?<![\"'])\b\d{3,}\b(?![\"'])" -t py -g "!test_*" -g "!*constants*"
```

---

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

```bash
# Problem: Special characters are interpreted as part of the pattern
# Solution: Use -F (fixed string) or escape them
grep -F "[ERROR]" logfile.txt        # Search as fixed string with -F
grep "\[ERROR\]" logfile.txt         # Escape them
rg -F "[ERROR]" logfile.txt          # -F also works in rg

# Problem: Binary files are being matched
# Solution: Use -I option to ignore binaries
grep -rI "pattern" ./               # Ignore binary files
rg "pattern"                        # rg ignores binaries by default

# Problem: Output overwhelmed by too many matches
# Solution: Use -m, -l, or less
grep -m 10 "pattern" logfile.txt    # Stop after first 10 matches
grep -l "pattern" *.log             # Show only filenames
grep "pattern" logfile.txt | less   # Browse with pager

# Problem: -P (PCRE) not available on macOS grep
# Solution: Install GNU grep or use rg
brew install grep                    # Installed as ggrep
ggrep -P "\d+" file.txt             # GNU grep PCRE
rg "\d+" file.txt                   # Use rg (recommended)

# Problem: Cannot search Japanese in UTF-8 files
# Solution: Check/set locale
export LANG=en_US.UTF-8
grep "Japanese text" file.txt       # Works if UTF-8 is set correctly
rg "Japanese text" file.txt         # rg has full Unicode support

# Problem: grep -r is slow
# Solution: Use rg or specify --include/--exclude-dir
rg "pattern"                         # rg is dramatically faster
grep -rn --include="*.py" --exclude-dir=venv "pattern" ./  # Narrow down with grep
```

### 7.2 Performance Tips

```bash
# 1. -F (fixed string search) is faster than regular expressions
grep -F "exact string" large_file.txt

# 2. -m for early termination
grep -m 1 "pattern" large_file.txt   # Stop after first match

# 3. Avoid unnecessary options
# -i (case insensitive) is slightly slower
# -E (extended regex) is unnecessary for simple patterns

# 4. Limit the search scope
grep -rn --include="*.py" "pattern" ./  # Limit to file type
grep "pattern" specific_file.txt         # Search a specific file only

# 5. rg is 2-10x faster than grep
# Use rg as the first choice for large codebases

# 6. Speed up with LC_ALL=C (for ASCII only)
LC_ALL=C grep "pattern" large_file.txt   # Skip locale processing
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

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
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

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
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | High Priority | Acceptable to Compromise |
|-----------|--------------|--------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, fast time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

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
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily/multiple times → Go to 3            │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A fast short-term approach may become technical debt in the long run
- Conversely, over-engineering has a high short-term cost and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and challenges"""
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

## Team Development

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Naming conventions are consistent
- [ ] Error handling is appropriate
- [ ] Test coverage is sufficient
- [ ] No performance impact
- [ ] No security issues
- [ ] Documentation is up to date

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Entire team | Horizontal knowledge sharing |
| ADR (design records) | As needed | Future members | Decision transparency |
| Retrospectives | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Key designs | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          |
    ┌─────┼─────┐
    │Plan │Act  │
    │ ned │ Now │
    │     │     │
    ├─────┼─────┤
    │Log  │Next │
    │Only │Sprint│
    │     │     │
    └─────┼─────┘
          |
        Low Impact
    Low Frequency  High Frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|---------------|------------|----------------|------------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Broken authentication | High | Multi-factor auth, session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, least privilege | Config scanning |
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
- [ ] CORS policy is configured correctly
- [ ] Vulnerability scanning of dependency packages is performed
- [ ] Error messages do not contain internal information
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Jumping to advanced topics without mastering the basics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Option / Tool | Meaning |
|---------------|---------|
| grep -i | Case insensitive |
| grep -r / -R | Recursive search |
| grep -n | Show line numbers |
| grep -l / -L | Matching / non-matching filenames |
| grep -v | Invert match |
| grep -w | Whole-word match |
| grep -E | Extended regular expressions |
| grep -F | Fixed string (disable regex) |
| grep -P | Perl compatible regular expressions |
| grep -o | Show only matched portion |
| grep -c | Count matching lines |
| grep -A/-B/-C N | Context before/after match |
| grep -q | Exit code only (no output) |
| grep --include | Narrow down target files |
| grep --exclude-dir | Exclude directories |
| rg (ripgrep) | Fast recursive search (respects .gitignore) |
| rg -t TYPE | File type filter |
| rg -g GLOB | Glob pattern filter |
| rg --hidden | Include hidden files |
| rg -U | Multiline match |

---

## 12. grep / rg Performance Tuning

### 12.1 Search Speed Optimization

```bash
# grep speed-up techniques

# 1. Fixed string search (-F) is faster than regex
grep -F "exact string" file.txt              # Skip regex parsing
grep -F "error" large_log.txt                # Best for simple string search
fgrep "pattern" file.txt                     # Alias for -F (deprecated but usable)

# 2. Speed up with locale settings
LC_ALL=C grep "pattern" file.txt             # C locale (assumes ASCII) is much faster
# → UTF-8 locale has overhead for character class processing
# → LC_ALL=C is effective for alphanumeric-only searches

# 3. Avoid unnecessary options
grep -c "pattern" file.txt                   # Use -c if you only need the count
grep -q "pattern" file.txt                   # Use -q for existence check (stops at first match)
grep -l "pattern" *.log                      # Use -l for filenames only (no full scan needed)
grep -m 1 "pattern" file.txt                 # Use -m 1 if you only need the first match

# 4. Buffering control
grep --line-buffered "pattern" file.txt      # Line buffering (real-time output)
# → Useful when used in pipelines

# 5. Parallel search
grep -r "pattern" /path --include="*.py" &   # Run in background
# Parallel search using GNU parallel
find . -name "*.log" | parallel -j4 grep -l "ERROR" {}

# ripgrep speed-up techniques
# rg is optimized by default, but can be tuned further

# Thread count control
rg -j 4 "pattern" /large/directory           # Search with 4 threads
rg -j 1 "pattern" file.txt                   # Single-threaded (for small files)

# Memory map control
rg --mmap "pattern" huge_file.txt            # Force use of memory map
rg --no-mmap "pattern" /nfs/share/           # Disable memory map (for NFS etc.)

# Skip binary files completely
rg --no-binary "pattern" /mixed/content/     # Completely skip binary files

# Specify encoding
rg -E shift-jis "pattern" legacy_file.txt   # Specify character encoding
rg -E euc-jp "keyword" old_data.txt
```

### 12.2 Search Strategy for Large Codebases

```bash
# Optimize searching across an entire project

# 1. Leverage .gitignore (rg respects it by default)
rg "TODO" .                                   # node_modules, .git etc. auto-excluded

# 2. Narrow down search targets
rg -t py "import" .                           # Python files only
rg -g "!tests/" "function" .                  # Exclude test directory
rg -g "*.{ts,tsx}" "useState" .               # TypeScript files only

# 3. Pre-filtering
# Register frequently used patterns as aliases
alias rgpy='rg -t py'
alias rgjs='rg -t js -t ts'
alias rgerr='rg -i "error|exception|fail"'
alias rgtodo='rg "TODO|FIXME|HACK|XXX"'

# 4. Cache search results (when executed frequently)
rg -l "pattern" > /tmp/matched_files.txt
cat /tmp/matched_files.txt | xargs rg "another_pattern"

# 5. Incremental search
# Interactive search combined with fzf
rg --line-number --no-heading "." | fzf --preview 'echo {} | cut -d: -f1-2 | xargs -I{} sh -c "head -n \$(echo {} | cut -d: -f2) \$(echo {} | cut -d: -f1) | tail -5"'

# When to use grep/rg vs. IDE search
# - Simple string search: rg (fastest)
# - Syntax-aware search: IDE (AST-based)
# - Complex regex search: rg -P (PCRE2)
# - Interactive narrowing: rg | fzf
```

---

## 13. Comprehensive Recipes by Real-World Scenario

### 13.1 grep/rg for Incident Response

```bash
# Rapid log investigation during an outage

# 1. Find the first occurrence of an error
rg -m 1 "OutOfMemoryError" /var/log/app/*.log
grep -rn -m 1 "Connection refused" /var/log/

# 2. Check context around the error
rg -C 10 "FATAL" /var/log/app/app.log | head -50

# 3. Check error frequency over time
rg "ERROR" app.log | rg -o "^\d{4}-\d{2}-\d{2} \d{2}:" | sort | uniq -c

# 4. Extract logs for a specific time period
rg "^2024-01-15 1[4-6]:" app.log                # Logs from 14:00-16:59
grep "^2024-01-15 15:3[0-9]:" app.log            # Logs from 15:30-15:39

# 5. Search logs across multiple servers simultaneously
for host in web01 web02 web03; do
  echo "=== $host ==="
  ssh "$host" "rg 'ERROR' /var/log/app/app.log | tail -5"
done

# 6. Extract stack traces
rg -U "Exception.*\n(\s+at .*\n)+" app.log       # Multiline match
grep -A 20 "Exception" app.log | grep -B 1 "^$"  # Stack trace until empty line

# 7. Identify affected users
rg "ERROR.*user_id=(\w+)" -o -r '$1' app.log | sort -u

# 8. Analyze error occurrence patterns
rg -o "ERROR \[([^\]]+)\]" -r '$1' app.log | sort | uniq -c | sort -rn | head -20
```

### 13.2 grep/rg for Code Review

```bash
# Code quality checks

# 1. Detect hardcoded values
rg -n "localhost|127\.0\.0\.1|192\.168\." --type-not test src/
rg -n "password\s*=\s*[\"'][^\"']+[\"']" src/

# 2. Check for leftover debug code
rg -n "console\.(log|debug|warn)|print\(|debugger|binding\.pry" src/
rg -n "TODO|FIXME|HACK|XXX|TEMP" src/ --stats

# 3. Detect unused imports (simple version)
for import in $(rg -o "^import \{ (\w+)" -r '$1' src/index.ts); do
  count=$(rg -c "\b$import\b" src/index.ts)
  if [ "$count" -le 1 ]; then
    echo "Possibly unused: $import"
  fi
done

# 4. Extract API endpoint list
rg -n "(@(Get|Post|Put|Delete|Patch)Mapping|@RequestMapping)" --type java src/
rg -n "router\.(get|post|put|delete|patch)\(" --type js src/
rg -n "@app\.(route|get|post|put|delete)" --type py src/

# 5. Check for SQL injection possibilities
rg -n "execute\(.*\+.*\)|execute\(.*%s.*%|execute\(.*\{.*\}.*\.format" --type py src/
rg -n "query\(.*\+.*\)|query\(.*\$\{" --type js src/

# 6. Check exception handling
rg -n "except:|catch\s*\(" --type py --type java --type js src/ | rg -v "except Exception|catch \(Error"

# 7. Detect magic numbers
rg -n "(?<!=\s*)\b(0|1)\b(?!\s*[;,\)])" --type java src/ | rg -v "//|/\*|\*/"
```

### 13.3 grep/rg for Security Audits

```bash
# Comprehensive security scan

# 1. Check for leaked credentials
rg -in "(api[_-]?key|secret[_-]?key|access[_-]?token|private[_-]?key)\s*[=:]\s*[\"']?\w+" .
rg -in "BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY" .
rg -in "(password|passwd|pwd)\s*[=:]\s*[\"'][^\"']{4,}" .

# 2. Detect AWS credentials
rg "AKIA[0-9A-Z]{16}" .                         # AWS Access Key ID
rg "[0-9a-zA-Z/+]{40}" . | rg -v "test|example"  # AWS Secret Key (verify manually)

# 3. Detect weak cryptography usage
rg -in "md5|sha1(?!sum)|des[^ign]|rc4" --type py --type java --type js .
rg -in "eval\s*\(|exec\s*\(|system\s*\(" --type py --type rb .

# 4. Check CORS configuration
rg -in "Access-Control-Allow-Origin.*\*" .
rg -in "cors.*origin.*\*|allowAllOrigins" .

# 5. Check file permissions in config files
rg -in "chmod\s+777|chmod\s+666|umask\s+000" .

# 6. Check for missing input validation
rg -n "request\.(params|query|body)\.\w+" --type js . | rg -v "validate|sanitize|escape"
```

---

## Further Reading

---

## References
1. Barrett, D. "Efficient Linux at the Command Line." Ch.5, O'Reilly, 2022.
2. Friedl, J. "Mastering Regular Expressions." 3rd Ed, O'Reilly, 2006.
3. GNU Grep Manual. https://www.gnu.org/software/grep/manual/
4. ripgrep GitHub Repository. https://github.com/BurntSushi/ripgrep
5. ripgrep User Guide. https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md
