# File Display

> Choose the right method for viewing text file contents based on your purpose.

## What You Will Learn in This Chapter

- [ ] Use file display commands appropriately for each situation
- [ ] Master full-file display and concatenation with cat / bat
- [ ] Learn pager operations with less / more
- [ ] Master partial display and real-time monitoring with head / tail
- [ ] Leverage auxiliary display tools such as wc / diff / xxd
- [ ] Acquire practical file display patterns for real-world use


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. cat — Concatenate and Display Files

### 1.1 Basic Usage

```bash
# Basic syntax: cat [options] [file...]
# cat stands for "concatenate". Originally intended for joining multiple files

# Display full content of a file
cat file.txt                     # Display all content
cat /etc/hostname                # Check a system file
cat ~/.bashrc                    # Check shell configuration
cat /proc/cpuinfo                # Display CPU info (Linux)

# Concatenate and display multiple files
cat file1.txt file2.txt          # Concatenate and display two files
cat header.txt body.txt footer.txt  # Concatenate three files
cat *.log                        # Concatenate and display all log files

# Read from standard input
cat                              # Display standard input as-is (end with Ctrl+D)
cat -                            # Explicitly specify standard input
cat file1.txt - file2.txt        # Concatenate file1 → stdin → file2
```

### 1.2 Display Options

```bash
# -n: Add line numbers to all lines
cat -n file.txt                  # Display with line numbers
cat -n /etc/passwd               # Check line numbers in config file

# -b: Add line numbers to non-blank lines (-b is cleaner than -n)
cat -b file.txt                  # Blank lines get no number

# -s: Squeeze consecutive blank lines into one (squeeze)
cat -s file.txt                  # Compress consecutive blank lines

# -A: Show all special characters (equivalent to -vET)
cat -A file.txt                  # Show tabs (^I), end-of-line ($), and control characters
# → Very useful for checking line endings and debugging invisible characters

# -E: Append $ at the end of each line
cat -E file.txt                  # Trailing whitespace becomes visible

# -T: Display tabs as ^I
cat -T file.txt                  # Clearly distinguishes tabs from spaces

# -v: Show non-printing characters
cat -v file.txt                  # Display control characters in ^X notation

# Combined examples
cat -bns file.txt                # Squeeze blank lines + number non-blank lines
cat -An file.txt                 # Line numbers + show all special characters
```

### 1.3 File Operations with cat

```bash
# Create a file (redirection)
cat > newfile.txt                # Write stdin to file (overwrite)
# (end input with Ctrl+D)

cat >> existingfile.txt          # Append to a file

# Create a file using a here document
cat > config.conf << 'EOF'
server {
    listen 80;
    server_name example.com;
    root /var/www/html;
}
EOF

# Concatenate and save files
cat part1.csv part2.csv part3.csv > combined.csv
cat header.csv data.csv > report.csv

# Merging multiple files (avoiding duplicate header rows)
head -1 file1.csv > combined.csv
tail -n +2 file1.csv >> combined.csv
tail -n +2 file2.csv >> combined.csv
tail -n +2 file3.csv >> combined.csv

# Use in pipes
cat file.txt | grep "pattern"    # Pass to grep (though grep pattern file.txt is more efficient)
cat file.txt | sort | uniq       # Sort and remove duplicates
cat file.txt | tr 'a-z' 'A-Z'   # Convert to uppercase
```

### 1.4 cat Caveats and Alternatives

```bash
# UUOC (Useless Use of Cat) — avoid unnecessary use of cat
# In most cases, command file is more efficient than cat | command

# Bad examples (unnecessary cat)
cat file.txt | grep "error"      # Unnecessary cat
cat file.txt | wc -l             # Unnecessary cat
cat file.txt | sort              # Unnecessary cat

# Good examples (specify file directly)
grep "error" file.txt            # Efficient
wc -l file.txt                   # Efficient
sort file.txt                    # Efficient

# However, cat is justified when concatenating multiple files
cat *.log | grep "error"         # Legitimate use of cat
cat header.txt body.txt | mail   # Concatenate and pass along

# Be careful with huge files
# cat loads all content into memory, so be cautious with very large files
# For large files, use less or head/tail instead
# cat large_file.txt             # Can cause issues with files several GB in size
less large_file.txt              # Display page by page (memory-efficient)
```

---

## 2. bat — Modern Alternative to cat

### 2.1 Installation and Basics

```bash
# Installation
brew install bat                 # macOS
sudo apt install bat             # Ubuntu/Debian (may be named batcat)
sudo pacman -S bat               # Arch Linux
cargo install bat                # Rust (Cargo)

# On Ubuntu/Debian the command may be named batcat, so set an alias
alias bat='batcat'

# Features of bat
# - Syntax highlighting (300+ languages supported)
# - Git integration (marks for changed lines)
# - Automatic pager (uses less when output doesn't fit in terminal)
# - Automatic line numbering
# - Customizable themes
```

### 2.2 Basic Usage

```bash
# Display a file (with syntax highlighting)
bat file.py                      # Python file (auto language detection)
bat main.go                      # Go file
bat index.html                   # HTML file
bat config.yaml                  # YAML file
bat Dockerfile                   # Dockerfile

# Explicitly specify language
bat -l json file.txt             # Highlight as JSON
bat -l sql query.txt             # Highlight as SQL
bat -l markdown README           # Highlight as Markdown

# Multiple files
bat file1.py file2.py            # Display multiple files (with headers)
bat src/*.rs                     # Display all Rust files
```

### 2.3 Display Customization

```bash
# List and change themes
bat --list-themes                # List available themes
bat --theme="Dracula" file.py    # Specify a theme
bat --theme="Monokai Extended" file.py
bat --theme="Nord" file.py

# Set default theme via environment variable
export BAT_THEME="Dracula"

# Display style (--style)
bat --style=full file.py         # Show all elements (default)
bat --style=numbers file.py      # Line numbers only
bat --style=plain file.py        # Plain text (highlighting only)
bat --style=grid file.py         # With grid lines
bat --style=header file.py       # Header only
bat --style=changes file.py      # Git change markers only
bat --style=numbers,changes file.py  # Line numbers + Git changes

# Specify line range (-r / --range)
bat -r 10:20 file.py             # Show only lines 10–20
bat -r :50 file.py               # First 50 lines
bat -r 100: file.py              # Line 100 onwards
bat -r 10:20 -r 30:40 file.py    # Multiple ranges

# Disable pager
bat --paging=never file.py       # No pager (behaves like cat)
bat -p file.py                   # Plain output (default when piping)

# Line wrapping
bat --wrap=auto file.py          # Auto wrap
bat --wrap=never file.py         # No wrapping
```

### 2.4 Advanced bat Usage

```bash
# Use in pipes (display with syntax highlighting)
curl -s https://example.com/api | bat -l json       # Highlight API response
docker inspect container_id | bat -l json            # Highlight Docker info
kubectl get pod -o yaml | bat -l yaml                # Highlight K8s resources
git diff | bat                                        # Highlight Git diff

# Show diff (combined with batdiff / delta)
bat --diff file1.txt file2.txt   # Show highlighted diff

# Highlighted man pages (add to ~/.bashrc)
export MANPAGER="sh -c 'col -bx | bat -l man -p'"
# → man command output will be syntax highlighted

# List supported languages
bat --list-languages             # List of supported languages

# Custom language mappings
bat --map-syntax "*.conf:INI" file.conf    # Highlight .conf as INI
bat --map-syntax ".env:Dotenv" .env        # Highlight .env

# Alias setup in .bashrc / .zshrc
alias cat='bat --paging=never'   # Replace cat with bat
alias catp='bat --style=plain'   # For plain display
alias catl='bat --style=numbers' # For display with line numbers
```

---

## 3. less — Pager (Viewing Large Files)

### 3.1 Basic Operations

```bash
# Basic: less [options] [file]
# less comes from "less is more". An improved version of more with bidirectional scrolling
# Does not load the entire file into memory, so it is fast even for huge files

less file.txt                    # Display file page by page
less +F logfile.log              # Start in tail -f mode
less +/pattern file.txt          # Open with pattern already searched
less +100 file.txt               # Start display from line 100
less -N file.txt                 # Display with line numbers
less -S file.txt                 # Do not wrap long lines (horizontal scrolling enabled)
less -R file.txt                 # Interpret ANSI color codes
```

### 3.2 Key Bindings Inside less (Complete Reference)

```
=== Navigation ===
j / ↓ / Enter      Scroll down one line
k / ↑              Scroll up one line
Space / f / PgDn   Scroll down one page
b / PgUp           Scroll up one page
d                  Scroll down half a page
u                  Scroll up half a page
g / Home           Move to the beginning of file
G / End            Move to the end of file
50g                Move to line 50 (specify line number)
50%                Move to 50% position in the file

=== Search ===
/pattern           Forward search (downward)
?pattern           Backward search (upward)
n                  Move to next match
N                  Move to previous match
&pattern           Show only lines matching pattern (filtering)
&                  Clear filter

=== Regex in Search ===
/error             Search for lines containing "error"
/^ERROR            Lines starting with "ERROR"
/error|warning     "error" or "warning"
/[0-9]{3}          Three consecutive digits

=== Marks ===
ma                 Set mark 'a' at current position
'a                 Jump to mark 'a'
''                 Return to previous position

=== Display Control ===
-N                 Toggle line number display
-S                 Toggle long line wrapping
-i                 Toggle case-insensitive search
-R                 Toggle ANSI color interpretation
=                  Show current file info (line count, percentage, etc.)
v                  Edit file in $VISUAL / $EDITOR

=== File Operations ===
:e filename        Open another file
:n                 Next file (when multiple files are specified)
:p                 Previous file (when multiple files are specified)

=== Other ===
F                  tail -f mode (real-time monitoring of file end; Ctrl+C to cancel)
q                  Quit
h                  Show help
```

### 3.3 Practical Patterns with less

```bash
# View log files (with color support)
less -R /var/log/syslog          # Preserve color output
journalctl | less -R             # View systemd journal

# Efficiently browse large files
less -N large_file.csv           # Browse CSV with line numbers
less -S wide_file.csv            # Browse wide CSV without wrapping

# Browse multiple files sequentially
less file1.txt file2.txt file3.txt   # Switch with :n and :p

# Input from pipe
ps aux | less                    # View process list in pager
find / -name "*.conf" 2>/dev/null | less  # View search results in pager
docker logs container_name | less -R       # View Docker logs
kubectl logs pod_name | less -R            # View K8s logs

# View compressed files (auto-decompress)
zless file.gz                    # View gzip file directly
bzless file.bz2                  # View bzip2 file directly
xzless file.xz                   # View xz file directly

# Set preprocessor with LESSOPEN / LESSCLOSE
# Add to ~/.bashrc to enable viewing various file formats in less
export LESSOPEN="| /usr/bin/lesspipe %s"
export LESSCLOSE="/usr/bin/lesspipe %s %s"

# Set default less options via environment variable
export LESS="-R -N -S --mouse"
# -R: Interpret ANSI colors
# -N: Show line numbers
# -S: No line wrapping
# --mouse: Mouse scroll support

# Set less as the default pager
export PAGER='less'
export MANPAGER='less -R'
```

### 3.4 more (Legacy Pager)

```bash
# more: The predecessor of less. Forward scrolling only
more file.txt                    # Display page by page
more -d file.txt                 # Show help message
more -10 file.txt                # Display 10 lines at a time
more +/pattern file.txt          # Start display from pattern match position

# more is POSIX standard, but less is generally used in practice
# On many systems, more is aliased to less
```

---

## 4. head — Display the Beginning of a File

### 4.1 Basic Usage

```bash
# Basic: head [options] [file...]
# Default is the first 10 lines

head file.txt                    # Show first 10 lines
head -n 20 file.txt              # Show first 20 lines
head -n 5 file.txt               # Show first 5 lines
head -1 file.txt                 # Show first line only (handy for checking header row)

# Specify by byte count
head -c 100 file.txt             # Show first 100 bytes
head -c 1K file.txt              # Show first 1 KB
head -c 1M file.txt              # Show first 1 MB

# Display all but the last N lines/bytes
head -n -5 file.txt              # Show everything except last 5 lines
head -c -100 file.txt            # Show everything except last 100 bytes

# Multiple files
head file1.txt file2.txt         # First 10 lines of each file with headers
head -n 5 *.csv                  # First 5 lines of all CSV files
head -q -n 3 *.txt               # First 3 lines without headers (-q = quiet)
```

### 4.2 Practical Uses of head

```bash
# Check headers of CSV/TSV files
head -1 data.csv                 # Confirm column names
head -1 data.csv | tr ',' '\n'  # Display column names vertically

# Check file format
head -c 16 file.bin | xxd        # Check magic bytes of a binary file
head -3 script.sh                # Check shebang line

# Check the beginning of log files
head -20 /var/log/syslog         # First 20 lines of a log

# Use in pipes
ls -la | head -5                 # First 5 entries of directory listing
ps aux --sort=-%mem | head -11   # Top 10 processes by memory (header + 10 lines)
du -sh * | sort -rh | head -10   # Top 10 disk usage

# Get random lines (head + shuf / sort -R)
shuf -n 5 file.txt               # Get 5 random lines
sort -R file.txt | head -5       # Get 5 random lines (alternative method)

# Process only the beginning of a large file
head -n 1000 huge_file.csv > sample.csv   # Extract sample data
head -n 1000000 access.log | awk '{print $1}' | sort | uniq -c | sort -rn  # Analyze first 1M lines
```

---

## 5. tail — Display the End of a File

### 5.1 Basic Usage

```bash
# Basic: tail [options] [file...]
# Default is the last 10 lines

tail file.txt                    # Show last 10 lines
tail -n 20 file.txt              # Show last 20 lines
tail -n 5 file.txt               # Show last 5 lines
tail -1 file.txt                 # Show last line only

# Specify by byte count
tail -c 100 file.txt             # Show last 100 bytes
tail -c 1K file.txt              # Show last 1 KB

# Skip the first N lines/bytes
tail -n +2 file.txt              # Show from line 2 onwards (skip header)
tail -n +11 file.txt             # Show from line 11 onwards
tail -c +100 file.txt            # Show from byte 100 onwards

# Multiple files
tail file1.txt file2.txt         # Last 10 lines of each file
tail -q -n 5 *.log               # Last 5 lines of each file without headers
```

### 5.2 tail -f / -F — Real-Time Log Monitoring

```bash
# -f: Follow the end of a file in real time
tail -f /var/log/syslog          # Real-time monitoring of system log
tail -f /var/log/nginx/access.log   # Monitor Nginx access log
tail -f /var/log/nginx/error.log    # Monitor Nginx error log
tail -f app.log                     # Monitor application log

# -F: Follow log rotation (-f --retry equivalent)
tail -F /var/log/syslog          # Continue tracking after log rotation
# -f tracks by file descriptor, so it loses track if the file is replaced
# -F tracks by filename, so it reconnects automatically after rotation

# Show only new lines (do not show existing content)
tail -f -n 0 logfile             # Show only newly added lines
tail -f -n 0 /var/log/syslog    # Show only new log entries after monitoring starts

# Monitor multiple files simultaneously
tail -f /var/log/nginx/access.log /var/log/nginx/error.log
# → Displays both files with filename headers

# Real-time filtering with tail -f + grep
tail -f /var/log/syslog | grep "ERROR"           # Show errors only
tail -f /var/log/syslog | grep --line-buffered "ERROR"  # Disable buffering
tail -f /var/log/syslog | grep -i "error\|warning"      # Errors and warnings
tail -f access.log | grep "500\|502\|503"                # HTTP 5xx errors

# Real-time aggregation with tail -f + awk
tail -f access.log | awk '{print $9}' | sort | uniq -c   # Aggregate status codes
tail -f access.log | awk '$9 >= 500 {print}'             # Show only 5xx errors

# Output with timestamp using tail -f
tail -f app.log | while read line; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') $line"
done

# Stop monitoring
# Press Ctrl+C to exit tail -f
```

### 5.3 Practical Patterns with tail

```bash
# Check recent log entries
tail -100 /var/log/syslog        # Recent 100 lines of log
tail -n 50 /var/log/auth.log     # Recent 50 lines of auth log

# Skip CSV headers
tail -n +2 data.csv              # Data portion excluding header row
tail -n +2 data.csv | wc -l      # Count data rows (excluding header)

# Get a specific range of a file (combining head + tail)
head -n 20 file.txt | tail -n 5  # Display lines 16–20
sed -n '16,20p' file.txt         # Same result using sed

# Extract errors from the latest log entries
tail -1000 /var/log/app.log | grep "ERROR" | tail -20   # Last 20 errors in the most recent 1000 lines

# Post-deploy log monitoring pattern
tail -f /var/log/app.log &       # Start monitoring in background
deploy_command                    # Run deploy
# After checking the log
kill %1                          # Stop background tail

# Check diff from last check (new log entries since last check)
wc -l < /var/log/app.log > /tmp/log_lines   # Save current line count
# ... after some time ...
tail -n +$(cat /tmp/log_lines) /var/log/app.log  # New log entries since last time
```

---

## 6. multitail — Monitor Multiple Logs Simultaneously

```bash
# Installation
brew install multitail            # macOS
sudo apt install multitail        # Ubuntu/Debian

# Basic usage
multitail /var/log/syslog /var/log/auth.log    # Monitor 2 files simultaneously with split screen
multitail -s 2 /var/log/*.log                  # Monitor multiple logs in 2-column split

# Monitor with coloring
multitail -ci green /var/log/access.log -ci red /var/log/error.log

# Monitor with filter
multitail -e "ERROR" /var/log/app.log          # Show only lines containing ERROR

# Alternative: log monitoring with tmux / screen
# It is also common to split the screen in tmux and run tail -f in each pane
```

---

## 7. wc — Word Count

### 7.1 Basic Usage

```bash
# Basic: wc [options] [file...]
# Default displays three values: line count, word count, and byte count

wc file.txt                      # Lines  words  bytes  filename
wc -l file.txt                   # Line count only
wc -w file.txt                   # Word count only
wc -c file.txt                   # Byte count only
wc -m file.txt                   # Character count (multibyte-aware)
wc -L file.txt                   # Length of the longest line (in characters)

# Multiple files
wc -l *.py                       # Line count of each .py file + total
wc -l src/*.go                   # Line counts of Go source files

# Use in pipes
cat file.txt | wc -l             # Line count via pipe
ls -1 | wc -l                    # Number of files in directory
ps aux | wc -l                   # Number of processes
grep -c "error" file.txt         # Number of lines matching a pattern (grep -c is more efficient)
```

### 7.2 Practical Patterns with wc

```bash
# Count lines of source code
find . -name "*.py" -exec wc -l {} + | tail -1   # Total lines of Python code
find . -name "*.go" -exec wc -l {} + | sort -n    # Go files sorted by line count
find . \( -name "*.js" -o -name "*.ts" \) -exec wc -l {} + | sort -rn | head -20
# → Top 20 JS/TS files by line count

# Check file size
wc -c large_file.bin             # Check size by byte count
wc -c < file.txt                 # Output byte count only (no filename)

# Count files in a directory
find . -type f | wc -l           # Recursively count files
find . -maxdepth 1 -type f | wc -l  # Current directory only

# Count blank lines
grep -c "^$" file.txt            # Number of blank lines
grep -cv "^$" file.txt           # Number of non-blank lines

# Lines of code (excluding blank lines and comments)
grep -cv "^$\|^#\|^//" file.py   # Line count excluding blank and comment lines

# Aggregate line counts across multiple languages in a project
echo "=== Project Line Count Report ==="
for ext in py js ts go rs; do
    count=$(find . -name "*.$ext" -exec cat {} + 2>/dev/null | wc -l)
    echo "$ext: $count lines"
done
```

---

## 8. diff — Display File Differences

### 8.1 Basic Usage

```bash
# Basic: diff [options] file1 file2

diff file1.txt file2.txt         # Show diff in default format
diff -u file1.txt file2.txt      # Unified format (same as Git)
diff -c file1.txt file2.txt      # Context format (with surrounding context)
diff -y file1.txt file2.txt      # Side-by-side display
diff --color file1.txt file2.txt # Color display

# How to read unified format
# --- file1.txt (original file)
# +++ file2.txt (modified file)
# @@ -1,5 +1,6 @@ (line range of the change)
# - (deleted lines)
# + (added lines)
#   (unchanged lines)

# Options
diff -u -B file1.txt file2.txt   # Ignore blank line differences
diff -u -w file1.txt file2.txt   # Ignore all whitespace differences
diff -u -b file1.txt file2.txt   # Ignore changes in whitespace amount
diff -u -i file1.txt file2.txt   # Ignore case differences
diff -u --ignore-blank-lines file1.txt file2.txt  # Ignore addition/deletion of blank lines
```

### 8.2 Comparing Directories

```bash
# Recursive directory comparison
diff -r dir1/ dir2/              # Show diffs of all files
diff -rq dir1/ dir2/             # Show only list of differing files
diff -r --brief dir1/ dir2/      # Same as -rq

# Compare while excluding specific files
diff -r --exclude="*.pyc" dir1/ dir2/
diff -r --exclude=".git" dir1/ dir2/
diff -r --exclude="node_modules" dir1/ dir2/

# Generate and apply patch files
diff -u original.py modified.py > changes.patch  # Generate patch
patch original.py < changes.patch                 # Apply patch
patch -R original.py < changes.patch              # Revert patch

# Patch for an entire directory
diff -ruN dir1/ dir2/ > all_changes.patch
cd dir1/ && patch -p1 < all_changes.patch
```

### 8.3 Modern diff Tools

```bash
# colordiff: Add color to diff output
# brew install colordiff
colordiff -u file1.txt file2.txt

# delta: Beautiful Git-style diff display
# brew install git-delta
diff -u file1.txt file2.txt | delta

# icdiff: Inline comparison
# pip install icdiff
icdiff file1.txt file2.txt       # Side-by-side color diff

# vimdiff: Display and edit diffs in Vim
vimdiff file1.txt file2.txt      # Show diff in Vim

# Configure Git to use delta
# git config --global core.pager delta
# git config --global delta.side-by-side true
```

---

## 9. Other File Display Tools

### 9.1 xxd / hexdump — Display Binary Files

```bash
# xxd: Hex dump
xxd file.bin                     # Hex dump display
xxd -l 64 file.bin               # First 64 bytes only
xxd -s 0x100 file.bin            # Display from offset 0x100
xxd -c 8 file.bin                # 8 bytes per line (default is 16)
xxd -p file.bin                  # Plain hex output (no address or ASCII part)
xxd -b file.bin                  # Display in binary
xxd -r hex.txt > file.bin        # Convert hex text back to binary

# hexdump
hexdump -C file.bin              # Hex + ASCII display (most common)
hexdump -n 32 file.bin           # First 32 bytes
hexdump -s 256 file.bin          # Display from byte 256

# od (octal dump)
od -A x -t x1z file.bin         # Hex display (POSIX standard)
od -c file.bin                   # Display as characters

# Determine file type
file file.bin                    # Identify the type of a file
file -i file.txt                 # Show MIME type
file -b file.bin                 # Omit the filename
```

### 9.2 strings — Extract Text from Binaries

```bash
# strings: Extract readable text from binary files
strings binary_file              # Extract printable strings
strings -n 10 binary_file        # Only strings with 10 or more characters
strings -a binary_file           # Target the entire file
strings binary_file | grep "password"   # Search for password strings
strings binary_file | grep -i "version" # Search for version info
strings /usr/bin/python3 | grep -i copyright   # Copyright info

# Practical example: Extract info from a core dump
strings core.dump | grep "Error"
```

### 9.3 column — Format Text into Columns

```bash
# column: Format text into columns
column -t file.txt               # Align columns (space-delimited)
column -t -s ',' file.csv        # Display CSV with aligned columns
column -t -s ':' /etc/passwd     # Display /etc/passwd in a readable format
column -t -s $'\t' data.tsv      # Display TSV with aligned columns

# Format mount output
mount | column -t

# Practical example: Display CSV in a readable format
head -20 data.csv | column -t -s ','
```

### 9.4 nl — Add Line Numbers

```bash
# nl: Add line numbers (more flexible than cat -n)
nl file.txt                      # With line numbers (blank lines have no number)
nl -ba file.txt                  # Number all lines (including blank)
nl -w 4 file.txt                 # Use 4-digit width for line numbers
nl -s ': ' file.txt              # Use ': ' as separator
nl -n rz file.txt                # Zero-padded right-justified (001, 002, ...)
nl -v 0 file.txt                 # Start line numbers from 0
```

### 9.5 rev / tac — Reverse Display

```bash
# tac: Display file in reverse order (opposite of cat)
tac file.txt                     # Display from last line to first
tac access.log | head -20        # Get the 20 most recent log entries

# rev: Reverse the characters of each line
rev file.txt                     # Display each line from right to left
echo "hello" | rev               # "olleh"

# Practical example: Search from the latest log entry
tac /var/log/syslog | grep -m 1 "ERROR"   # Get the most recent ERROR entry
```

### 9.6 fold / fmt — Text Wrapping

```bash
# fold: Wrap lines at a specified width
fold -w 80 file.txt              # Wrap at 80 characters
fold -s -w 80 file.txt           # Do not break in the middle of words (-s = space)

# fmt: Format text
fmt -w 72 file.txt               # Format to 72-character width
fmt -s file.txt                  # Leave short lines as-is (only wrap long lines)
```

---

## 10. Practical Pattern Collection

### 10.1 Basic Log Analysis Patterns

```bash
# Check recent errors
tail -100 /var/log/app.log | grep -i "error"

# Check error frequency
grep -c "ERROR" /var/log/app.log

# Check the trend of errors over time
grep "ERROR" /var/log/app.log | awk '{print $1, $2}' | cut -d: -f1,2 | uniq -c

# Extract logs for a specific time period
sed -n '/2026-02-16 14:00/,/2026-02-16 15:00/p' /var/log/app.log

# Monitor errors in real time while also saving to a file
tail -f /var/log/app.log | tee -a /tmp/monitor.log | grep "ERROR"
```

### 10.2 CSV/TSV Data Inspection Patterns

```bash
# Check headers
head -1 data.csv

# Display a sample of data
head -5 data.csv | column -t -s ','

# Check row count (excluding header)
tail -n +2 data.csv | wc -l

# Check column count
head -1 data.csv | tr ',' '\n' | wc -l

# List values in a specific column
awk -F',' '{print $3}' data.csv | sort -u | head -20

# Data integrity check (verify all rows have the same column count)
awk -F',' '{print NF}' data.csv | sort -u
```

### 10.3 Configuration File Inspection Patterns

```bash
# Check config content excluding comments and blank lines
grep -v "^#\|^$\|^;" config.ini

# Count effective lines in a config file
grep -cv "^#\|^$\|^;" /etc/nginx/nginx.conf

# Check specific config values
grep "^listen" /etc/nginx/sites-enabled/*
grep "^port" /etc/redis/redis.conf

# Check diff between config files
diff -u /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
```

### 10.4 Performance Analysis Patterns

```bash
# Check system info from /proc (Linux)
cat /proc/meminfo                # Memory info
cat /proc/cpuinfo | head -30     # CPU info
cat /proc/loadavg                # Load average
cat /proc/uptime                 # Uptime

# Disk usage
df -h | head -10                 # Filesystem usage
du -sh /var/log/*  | sort -rh | head -10  # Size of log directories

# Network info
cat /proc/net/tcp | head -5      # TCP connection info
ss -tlnp | head -20              # Listening ports
```

---

## 2. Usage Selection Guide

```
Choose based on your purpose:

  View the entire file          → cat (small files) / bat (code) / less (large files)
  View only the start/end       → head / tail
  Real-time log monitoring      → tail -f / tail -F / multitail
  Count lines                   → wc -l
  Diff between two files        → diff -u / delta / icdiff
  Inspect binary files          → xxd / hexdump / file
  Display CSV in readable form  → column -t -s ','
  Display with line numbers     → cat -n / nl / bat
  Display in reverse order      → tac
  Extract strings from text     → strings

Recommended by file size:
  ~100 lines       → cat / bat
  100–1000 lines   → bat / less
  1000+ lines      → less (required)
  Several GB       → less -N (consider head/tail for partial display)
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also write test code

```python
# Exercise 1: Template for basic implementation
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("入力値がNoneです")
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

# Test
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Applied Patterns

Extend the basic implementation to add the following functionality.

```python
# Exercise 2: Applied patterns
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
        """Statistics information"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Test
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
    print("応用テスト全合格!")

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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Check the path and format of the config file |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check the running user's permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Verify hypotheses using log output or a debugger
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debug utility
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
    """Decorator that logs the input and output of a function"""
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
    """Data processing (target for debugging)"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O wait**: Review the status of disk and network I/O
4. **Check concurrent connections**: Review the state of the connection pool

| Issue type | Diagnostic tool | Solution |
|-----------|----------------|---------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Index, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Below are the criteria for making technology decisions.

| Criterion | When to prioritize | When you can compromise |
|----------|--------------------|------------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-first, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow          │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                   │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②             │
│                                                 │
│  ② Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + modular split │
│    └─ Daily / multiple times → Go to ③         │
│                                                 │
│  ③ Independence between teams?                  │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs. flexibility**
- A unified technology stack has a lower learning curve
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction offers better reusability but can make debugging harder
- Low abstraction is intuitive but tends to cause code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and issues"""
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

## Team Development Usage

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Naming conventions are consistent
- [ ] Error handling is appropriate
- [ ] Test coverage is sufficient
- [ ] No performance impact
- [ ] No security issues
- [ ] Documentation is up to date

### Knowledge Sharing Best Practices

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge sharing |
| ADR (design records) | As needed | Future members | Transparency of decisions |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Important design | Building consensus |

### Managing Technical Debt

```
Priority matrix:

        High impact
          │
    ┌─────┼─────┐
    │ Plan│ Act │
    │ ned │ im- │
    │     │ med │
    ├─────┼─────┤
    │ Log │ Next│
    │ only│ Spr │
    │     │ int │
    └─────┼─────┘
          │
        Low impact
    Low frequency  High frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk level | Countermeasure | Detection method |
|--------------|-----------|----------------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication failures | High | Multi-factor auth, stronger session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, least privilege principle | Configuration scan |
| Insufficient logging | Medium | Structured logging, audit trail | Log analysis |

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
- [ ] Sensitive information is not written to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is properly configured
- [ ] Dependency package vulnerability scanning has been performed
- [ ] Error messages do not contain internal information

---

## Migration Guide

### Notes on Version Upgrades

| Version | Key changes | Migration work | Scope of impact |
|---------|------------|----------------|----------------|
| v1.x → v2.x | API design overhaul | Endpoint changes | All clients |
| v2.x → v3.x | Authentication method change | Token format update | Auth-related |
| v3.x → v4.x | Data model change | Run migration scripts | DB-related |

### Steps for Incremental Migration

```python
# Migration script template
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Callable

logger = logging.getLogger(__name__)

class MigrationRunner:
    """Incremental migration execution engine"""

    def __init__(self, migration_dir: str):
        self.migration_dir = Path(migration_dir)
        self.migrations: List[Dict] = []
        self.completed: List[str] = []

    def register(self, version: str, description: str,
                 up: Callable, down: Callable):
        """Register a migration"""
        self.migrations.append({
            'version': version,
            'description': description,
            'up': up,
            'down': down,
            'registered_at': datetime.now().isoformat()
        })

    def run_up(self, target_version: str = None):
        """Run migrations (upgrade)"""
        for migration in self.migrations:
            if migration['version'] in self.completed:
                continue
            logger.info(f"実行中: {migration['version']} - "
                       f"{migration['description']}")
            try:
                migration['up']()
                self.completed.append(migration['version'])
                logger.info(f"完了: {migration['version']}")
            except Exception as e:
                logger.error(f"失敗: {migration['version']}: {e}")
                raise
            if target_version and migration['version'] == target_version:
                break

    def run_down(self, target_version: str):
        """Roll back migrations"""
        for migration in reversed(self.migrations):
            if migration['version'] not in self.completed:
                continue
            if migration['version'] == target_version:
                break
            logger.info(f"ロールバック: {migration['version']}")
            migration['down']()
            self.completed.remove(migration['version'])

    def status(self) -> Dict:
        """Check migration status"""
        return {
            'total': len(self.migrations),
            'completed': len(self.completed),
            'pending': len(self.migrations) - len(self.completed),
            'versions': {
                m['version']: 'completed'
                if m['version'] in self.completed else 'pending'
                for m in self.migrations
            }
        }
```

### Rollback Plan

Always prepare a rollback plan for migration work:

1. **Back up data**: Take a full backup before migration
2. **Validate in a test environment**: Pre-validate in an environment equivalent to production
3. **Incremental rollout**: Deploy incrementally with a canary release
4. **Increased monitoring**: Shorten metrics monitoring intervals during migration
5. **Define clear criteria**: Pre-define the criteria for deciding to roll back
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but from actually writing code and confirming behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and moving on to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently used in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Command | Purpose | Features |
|---------|---------|---------|
| cat | Display entire file / concatenate | Standard, simple |
| bat | Display with syntax highlighting | Modern, Git integration |
| less | Paged display (for large files) | Bidirectional scrolling, search |
| more | Paged display (legacy) | Forward scrolling only |
| head | Display beginning of file | Fast, ideal for pipes |
| tail | Display end of file | Essential for log monitoring |
| tail -f/-F | Real-time log monitoring | Follows log rotation |
| wc | Lines / words / bytes | Essential for aggregation |
| diff | File diff | Also supports patch generation |
| xxd | Hex dump | Binary analysis |
| column | Formatted column display | Improves readability of CSV/TSV |
| nl | Add line numbers | More flexible than cat -n |
| tac | Reverse display | Search from latest log |
| strings | Extract text | Search for strings in binaries |

---

## 13. Security and Troubleshooting for File Display

### 13.1 Safe File Display

```bash
# Prevent accidental display of binary files
# Check the file type in advance with the file command
file suspicious_file.txt
# → If "ASCII text", it is a text file
# → If "data", "executable", "ELF", etc., it is binary

# Accidentally running cat on a binary file can corrupt the terminal
# Recovery in that case
reset                            # Reset the terminal
stty sane                        # Restore terminal settings to normal
echo -e "\033c"                  # Reset with ESC sequence

# Safe file display function
safe_cat() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Error: File not found: $file" >&2
    return 1
  fi
  local filetype=$(file -b "$file")
  case "$filetype" in
    *text*|*ASCII*|*UTF-8*|*empty*)
      cat "$file"
      ;;
    *)
      echo "Warning: Binary file detected ($filetype)" >&2
      echo "Use 'xxd $file | less' or 'strings $file' instead" >&2
      return 1
      ;;
  esac
}

# Viewing large files safely (prevent unintentional mass output)
safe_view() {
  local file="$1"
  local max_lines="${2:-1000}"
  local total_lines=$(wc -l < "$file")
  if [ "$total_lines" -gt "$max_lines" ]; then
    echo "Warning: File has $total_lines lines (showing first $max_lines)" >&2
    head -n "$max_lines" "$file"
    echo "... (truncated, $((total_lines - max_lines)) more lines)" >&2
  else
    cat "$file"
  fi
}

# Safe display of files containing sensitive information
# Mask passwords and tokens before displaying

# Safe display of environment variable files
cat .env | sed -E 's/^([^=]+=).+$/\1***/'
```

### 13.2 Checking and Converting Encodings

```bash
# Check file encoding
file -i document.txt              # MIME type and encoding
# → text/plain; charset=utf-8
# → text/plain; charset=iso-8859-1

# Determine encoding with nkf (for Japanese files)
nkf --guess document.txt
# → UTF-8 (LF)
# → Shift_JIS (CRLF)
# → EUC-JP (LF)

# Dealing with garbled text
# Display as UTF-8
cat document.txt | iconv -f SHIFT_JIS -t UTF-8
cat document.txt | nkf -w                      # Convert to UTF-8 and display

# Check line endings
cat -A document.txt | head -3     # If ^M is visible, it is CRLF (Windows format)
file document.txt                 # Check for "CRLF line terminators"
xxd document.txt | head -5        # 0d 0a is CRLF

# Convert line endings
cat document.txt | tr -d '\r' > unix_file.txt   # CRLF → LF
# Or
dos2unix document.txt             # dos2unix command
unix2dos document.txt             # LF → CRLF

# Check and remove BOM
xxd document.txt | head -1        # ef bb bf is UTF-8 BOM
head -c 3 document.txt | xxd      # Check the first 3 bytes
sed -i '1s/^\xEF\xBB\xBF//' document.txt  # Remove BOM
```

### 13.3 Performance Considerations

```bash
# Efficiently process a large number of files
# cat is optimal for concatenating small files
# Concatenating a large number of small files
cat part_*.txt > combined.txt                    # Fast
find . -name "part_*.txt" -exec cat {} + > combined.txt  # When there are too many

# Partial display of huge files (without reading the whole file)
head -n 100 huge_file.txt          # Read only the beginning (nearly O(1))
tail -n 100 huge_file.txt          # Read only the end
sed -n '1000,1100p' huge_file.txt  # Read only a specific range

# Optimizing wc
wc -l huge_file.txt                # For line count only, memory-efficient
wc -c huge_file.txt                # Byte count is even faster (may use seek)

# Streamlining pipelines
# Reduce unnecessary pipes (application of UUOC = Useless Use of Cat)
# Bad examples:
cat file.txt | wc -l                           # cat is redundant
cat file.txt | head -10                        # cat is redundant
# Good examples:
wc -l < file.txt                               # Use redirection
head -10 file.txt                              # Pass file as argument directly

# Optimizing disk I/O
# When reading the same file multiple times, leverage caching
lines=$(wc -l < file.txt)
first=$(head -1 file.txt)
last=$(tail -1 file.txt)
# ↓ Instead, process in a single pass with tee
tee >(wc -l > /tmp/count) >(head -1 > /tmp/first) >(tail -1 > /tmp/last) < file.txt > /dev/null
```

### 13.4 Advanced less Customization

```bash
# less environment variable settings
export LESS='-R -F -X -S -i -M'
# -R: Interpret ANSI colors
# -F: Auto-exit if content fits in one screen
# -X: Do not clear screen on exit
# -S: Do not wrap long lines
# -i: Ignore case in searches
# -M: Show detailed prompt

# Set a preprocessor with LESSOPEN / LESSCLOSE
# When lesspipe is available
eval "$(lesspipe)"
# → Enables viewing tar, gz, zip, pdf, image files, etc. directly in less

# Color settings for less
export LESS_TERMCAP_mb=$'\e[1;31m'     # Start blinking (red bold)
export LESS_TERMCAP_md=$'\e[1;36m'     # Start bold (cyan bold)
export LESS_TERMCAP_me=$'\e[0m'         # End mode
export LESS_TERMCAP_se=$'\e[0m'         # End standout
export LESS_TERMCAP_so=$'\e[1;44;33m'  # Start standout (blue bg, yellow text)
export LESS_TERMCAP_ue=$'\e[0m'         # End underline
export LESS_TERMCAP_us=$'\e[1;32m'     # Start underline (green bold)

# Display files by type in less
# Display Markdown files with formatting
mdless() {
  if command -v glow &>/dev/null; then
    glow "$1" | less -R
  elif command -v bat &>/dev/null; then
    bat --style=plain --paging=always "$1"
  else
    less "$1"
  fi
}

# Display JSON files with formatting
jless() {
  if command -v jq &>/dev/null; then
    jq -C '.' "$1" | less -R
  else
    python3 -m json.tool "$1" | less
  fi
}
```

---

## Further Reading

---

## References
1. Shotts, W. "The Linux Command Line." 2nd Ed, Ch.6, 2019.
2. Barrett, D. "Efficient Linux at the Command Line." Ch.3, O'Reilly, 2022.
3. bat GitHub Repository. https://github.com/sharkdp/bat
4. delta GitHub Repository. https://github.com/dandavison/delta
5. GNU Coreutils Manual. https://www.gnu.org/software/coreutils/manual/
