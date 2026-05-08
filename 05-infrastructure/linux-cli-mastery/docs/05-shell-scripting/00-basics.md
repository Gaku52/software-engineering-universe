# Shell Scripting Basics

> Shell scripting is the most direct way to automate CLI operations. It can be applied at every level, from everyday repetitive tasks to full-scale system administration.

## What You Will Learn in This Chapter

- [ ] Understand the basic syntax of shell scripts
- [ ] Use variables, conditionals, and loops
- [ ] Handle functions and script argument processing
- [ ] Master input/output, redirection, and heredocs
- [ ] Acquire debugging techniques
- [ ] Have script templates ready for practical use


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Script Basics

### 1.1 Shebang

The line beginning with `#!` written on the first line of a script is called the shebang. The OS reads this line and executes the script using the specified interpreter.

```bash
#!/bin/bash
# ↑ Shebang: specifies the interpreter to run this script

# How to run the script
chmod +x script.sh               # Grant execute permission
./script.sh                      # Run directly
bash script.sh                   # Run explicitly with bash
source script.sh                 # Run in the current shell (same as . script.sh)

# Types of shebangs
#!/bin/bash                      # bash
#!/bin/zsh                       # zsh
#!/usr/bin/env bash              # Find bash from PATH (recommended)
#!/usr/bin/env python3           # Python script
#!/usr/bin/env perl               # Perl script
#!/bin/sh                        # POSIX sh (when portability is top priority)
```

### 1.2 Difference Between `#!/bin/bash` and `#!/usr/bin/env bash`

```bash
# #!/bin/bash
#   → Directly specifies /bin/bash
#   → Does not work in environments where bash is not in /bin/ (some BSDs, NixOS, etc.)
#   → Slightly faster startup because the path is fixed

# #!/usr/bin/env bash
#   → Searches $PATH to find bash
#   → Higher portability across different environments (recommended)
#   → Works well with version managers like pyenv and rbenv

# How to check
which bash                       # Display the path to bash
type bash                        # Display the type of bash
bash --version                   # Check version
```

### 1.3 Differences Between Script Execution Methods

```bash
# Method 1: Direct execution (runs in a subshell)
chmod +x script.sh
./script.sh
# → A new process is launched
# → cd and export inside the script do not affect the calling shell

# Method 2: Run with bash command (subshell)
bash script.sh
# → No execute permission required
# → The shebang line is ignored

# Method 3: Run with source (runs in the current shell)
source script.sh
# or
. script.sh
# → Executed directly in the current shell
# → cd, export, and alias inside the script affect the current shell
# → Used for loading .bashrc and .zshrc

# Practical example: Script that sets environment variables
# --- env.sh ---
#!/bin/bash
export APP_ENV="production"
export APP_PORT="8080"
# --- end ---

# NG: Running in a subshell does not reflect changes in the current shell
./env.sh
echo $APP_ENV    # → (empty)

# OK: Running with source reflects changes
source env.sh
echo $APP_ENV    # → production
```

### 1.4 Script File Conventions

```bash
# File naming conventions
# - Add the .sh extension (not mandatory but recommended)
# - Executable scripts without extensions are also common (/usr/local/bin/mycommand)
# - Hyphen-separated: deploy-app.sh, run-tests.sh
# - Underscores are also acceptable: deploy_app.sh

# File structure (recommended template)
#!/usr/bin/env bash
#
# Script name: deploy.sh
# Description: Executes application deployment
# Author: Gaku
# Created: 2025-01-01
# Usage: ./deploy.sh [--env production|staging] [--branch main]
#

set -euo pipefail

# Constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Main processing
main() {
    echo "Starting $SCRIPT_NAME..."
    # Write processing here
}

main "$@"
```

### 1.5 How to Write Comments

```bash
# Line comment (from # to end of line)
echo "Hello"  # Inline comment

# Multi-line comment (technique using heredoc)
: <<'COMMENT'
This part is not executed
Can be used as a multi-line comment
However, there are indentation constraints
COMMENT

# Documentation comment convention
#######################################
# Executes a database backup
# Globals:
#   DB_HOST
#   DB_NAME
# Arguments:
#   $1 - Output directory
# Returns:
#   0 - Success
#   1 - Failure
#######################################
backup_database() {
    local output_dir="$1"
    # ...
}
```

---

## 2. Variables

### 2.1 Variable Basics

```bash
# Variable assignment (no spaces before or after =)
name="Gaku"                      # String
count=42                         # Number
path="/var/log"                  # Path
empty=""                         # Empty string

# Common mistakes
# name = "Gaku"                  # NG: Space causes it to be interpreted as a command
# name ="Gaku"                   # NG: Same as above
# name= "Gaku"                   # NG: Same as above

# Variable reference
echo "$name"                     # Gaku
echo "${name}_suffix"            # Gaku_suffix (when a delimiter is needed)
echo "Hello, $name!"             # Hello, Gaku!
echo "${name}san"                # Gakusan (use {} when characters follow immediately)

# Quote differences
echo "Hello, $name"              # → Hello, Gaku (variable expansion occurs)
echo 'Hello, $name'              # → Hello, $name (literal)
echo Hello, $name                # → Hello, Gaku (no quotes: word splitting occurs)

# Importance of quotes
file="my file.txt"
# cat $file                      # NG: Interpreted as 2 arguments "my" and "file.txt"
cat "$file"                      # OK: Treated as 1 argument "my file.txt"
# Rule: Always enclose variables in double quotes

# Command substitution
today=$(date +%Y-%m-%d)          # Recommended: $() form
files=`ls`                       # Old form: backticks (not recommended)
# $() can be nested
backup_name="backup_$(date +%Y%m%d)_$(hostname).tar.gz"

# Nesting example
inner_result=$(echo "The date is $(date +%Y-%m-%d)")
# Nesting with backticks is difficult: `echo "The date is \`date +%Y-%m-%d\`"`
```

### 2.2 Arithmetic Operations

```bash
# Arithmetic operations
result=$((3 + 5))                # → 8
count=$((count + 1))             # Increment
echo $((10 / 3))                 # → 3 (integer division)
echo $((10 % 3))                 # → 1 (remainder)
echo $((2 ** 10))                # → 1024 (exponentiation)

# Compound assignment operators
(( count += 5 ))                 # count = count + 5
(( count -= 3 ))                 # count = count - 3
(( count *= 2 ))                 # count = count * 2
(( count /= 4 ))                 # count = count / 4
(( count ++ ))                   # count = count + 1
(( count -- ))                   # count = count - 1

# Complex calculations
width=640
height=480
area=$(( width * height ))
echo "Area: $area pixels"       # → Area: 307200 pixels

# Hexadecimal and octal
echo $(( 0xFF ))                 # → 255 (hexadecimal)
echo $(( 077 ))                  # → 63 (octal)
echo $(( 2#1010 ))               # → 10 (binary)

# Decimal calculations (using bc)
echo "scale=2; 10 / 3" | bc      # → 3.33
pi=$(echo "scale=10; 4*a(1)" | bc -l)  # → 3.1415926535
result=$(echo "1.5 + 2.3" | bc)  # → 3.8

# Calculations with awk (more powerful)
awk 'BEGIN { printf "%.2f\n", 10/3 }'  # → 3.33
awk 'BEGIN { printf "%.4f\n", sqrt(2) }'  # → 1.4142
```

### 2.3 Special Variables

```bash
# Script argument related
echo $0                          # Script name
echo $1                          # First argument
echo $2                          # Second argument
echo ${10}                       # Tenth argument (two or more digits require {})
echo $#                          # Number of arguments
echo $@                          # All arguments (expanded individually)
echo $*                          # All arguments (as one string)

# Difference between $@ and $* (important)
# When the script is run as ./test.sh "hello world" foo bar:
# "$@" → "hello world" "foo" "bar" (expanded as 3 arguments)
# "$*" → "hello world foo bar" (expanded as one string)

# Practical: Use "$@" when passing arguments to other commands
wrapper() {
    echo "Calling command with args: $@"
    some_command "$@"  # Pass arguments correctly
}

# Status and process related
echo $?                          # Exit status of the last command (0=success)
echo $$                          # Current process ID
echo $!                          # PID of the last background process
echo $-                          # Current shell options
echo $_                          # Last argument of the previous command

# Using exit status
ls /nonexistent 2>/dev/null
if [[ $? -ne 0 ]]; then
    echo "Directory does not exist"
fi

# More concise way
if ls /nonexistent 2>/dev/null; then
    echo "Exists"
else
    echo "Does not exist"
fi

# Using PID
long_process &
bg_pid=$!
echo "Background process: PID=$bg_pid"
wait $bg_pid
echo "Process completed: exit status=$?"
```

### 2.4 Environment Variables

```bash
# Setting environment variables
export MY_VAR="value"            # Passed to child processes
MY_VAR="value"                   # Current shell only (not passed to child processes)

# Commonly used environment variables
echo "$HOME"                     # Home directory (/home/gaku)
echo "$USER"                     # Username (gaku)
echo "$PATH"                     # Command search path
echo "$PWD"                      # Current directory
echo "$OLDPWD"                   # Previous directory (used by cd -)
echo "$SHELL"                    # Login shell (/bin/bash, etc.)
echo "$HOSTNAME"                 # Hostname
echo "$LANG"                     # Locale (ja_JP.UTF-8, etc.)
echo "$TERM"                     # Terminal type
echo "$EDITOR"                   # Default editor
echo "$RANDOM"                   # Random integer from 0-32767
echo "$SECONDS"                  # Seconds since shell started
echo "$LINENO"                   # Current line number
echo "$BASH_VERSION"             # Bash version

# List all environment variables
env                              # Display all environment variables
printenv                         # Same
printenv PATH                    # Display a specific environment variable

# One-time environment variable setting
MY_VAR=value command             # Set MY_VAR only during command execution
LANG=C sort file.txt             # Run sort with C locale
DEBUG=1 ./myapp.sh               # Run in debug mode

# Deleting environment variables
unset MY_VAR                     # Delete variable
```

### 2.5 String Operations

```bash
str="Hello, World!"

# Length
echo ${#str}                     # → 13

# Substring
echo ${str:0:5}                  # → Hello (5 characters from position 0)
echo ${str:7}                    # → World! (from position 7 to end)
echo ${str: -6}                  # → orld! (6 characters from end; space required)
echo ${str:(-6):3}               # → orl (3 characters from 6th character from end)

# Replacement
echo ${str/World/Bash}           # → Hello, Bash! (first one)
echo ${str//l/L}                 # → HeLLo, WorLd! (replace all)
echo ${str/#Hello/Hi}            # → Hi, World! (replace prefix match only)
echo ${str/%\!/\?}               # → Hello, World? (replace suffix match only)

# Deletion (pattern removal)
filename="archive.tar.gz"
echo ${filename%.gz}             # → archive.tar (shortest match from end)
echo ${filename%%.*}             # → archive (longest match from end)
echo ${filename#*.}              # → tar.gz (shortest match from start)
echo ${filename##*.}             # → gz (longest match from start)

# Practical: Separating filename and directory
filepath="/home/user/documents/report.pdf"
echo ${filepath##*/}             # → report.pdf (equivalent to basename)
echo ${filepath%/*}              # → /home/user/documents (equivalent to dirname)

# Getting and changing extension
file="photo.jpg"
ext="${file##*.}"                 # → jpg
name="${file%.*}"                 # → photo
new_file="${name}.png"            # → photo.png

# Uppercase/lowercase conversion (Bash 4+)
str="Hello World"
echo "${str^^}"                  # → HELLO WORLD (all uppercase)
echo "${str,,}"                  # → hello world (all lowercase)
echo "${str^}"                   # → Hello World (first character uppercase only)
echo "${str,}"                   # → hello World (first character lowercase only)

# Default values
echo ${undefined:-"default"}     # Display "default" if undefined (does not assign)
echo ${undefined:="default"}     # Assign and display "default" if undefined
echo ${undefined:+"set"}         # Display "set" if defined, empty if undefined
echo ${undefined:?"error msg"}   # Display error message and exit if undefined

# Practical: Using default values
LOG_DIR="${LOG_DIR:-/var/log/myapp}"
PORT="${PORT:-8080}"
ENV="${ENV:-development}"
echo "Starting on port $PORT in $ENV mode"

# Indirect variable reference
var_name="PATH"
echo "${!var_name}"              # → Display the contents of $PATH
# env | grep "^${var_name}="    # Equivalent processing
```

### 2.6 Array Basics (Overview)

```bash
# Indexed array basics (details in 01-advanced-scripting.md)
fruits=("apple" "banana" "cherry")
echo "${fruits[0]}"              # → apple
echo "${fruits[@]}"              # → all elements
echo "${#fruits[@]}"             # → 3 (number of elements)

# Append
fruits+=("date")

# Loop
for fruit in "${fruits[@]}"; do
    echo "$fruit"
done

# Store command output in an array
mapfile -t lines < /etc/hosts    # Each line of a file into an array
IFS=$'\n' read -d '' -ra output <<< "$(ls -1)"  # Command output into an array
```

---

## 3. Conditionals

### 3.1 Basics of if Statements

```bash
# Basic if statement syntax
if [ "$name" = "Gaku" ]; then
    echo "Welcome, Gaku!"
elif [ "$name" = "admin" ]; then
    echo "Welcome, admin!"
else
    echo "Who are you?"
fi

# [[ ]] form (bash extension, recommended)
if [[ "$name" == "Gaku" ]]; then
    echo "Match!"
fi

# Difference between [ ] and [[ ]]
# [ ] (test command)
#   - POSIX compliant (usable in sh)
#   - Use = for string comparison
#   - Use -a, -o for logical operations
#   - Variables must be quoted because word splitting occurs
#
# [[ ]] (bash extension)
#   - Usable in bash/zsh (not in sh)
#   - Use == for string comparison
#   - Use &&, || for logical operations
#   - No word splitting (safe)
#   - Supports pattern matching and regular expressions
#   - Recommended: Use [[ ]] unless you have a specific reason not to

# One-line conditionals (useful for short cases)
[[ -f "$file" ]] && echo "File exists"
[[ -f "$file" ]] || echo "File not found"
[[ -d "$dir" ]] && cd "$dir" || echo "Directory not found"
```

### 3.2 String Comparison

```bash
# String comparison operators
[[ "$a" == "$b" ]]               # Equal
[[ "$a" != "$b" ]]               # Not equal
[[ -z "$str" ]]                  # Empty string (zero length)
[[ -n "$str" ]]                  # Not empty (non-zero length)
[[ "$str" =~ ^[0-9]+$ ]]        # Regular expression match
[[ "$str" == pattern* ]]         # Glob pattern match (* is a wildcard)

# String comparison (lexicographic order)
[[ "$a" < "$b" ]]                # a comes first lexicographically
[[ "$a" > "$b" ]]                # a comes after lexicographically

# Details of regular expression matching
input="2025-01-15"
if [[ "$input" =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})$ ]]; then
    echo "Year:  ${BASH_REMATCH[0]}"   # → 2025-01-15 (whole match)
    echo "Year:  ${BASH_REMATCH[1]}"   # → 2025
    echo "Month: ${BASH_REMATCH[2]}"   # → 01
    echo "Day:   ${BASH_REMATCH[3]}"   # → 15
fi

# Pattern matching examples
filename="report_2025.csv"
if [[ "$filename" == *.csv ]]; then
    echo "CSV file"
fi
if [[ "$filename" == report_* ]]; then
    echo "Report file"
fi

# Practical: Empty string check
validate_input() {
    local input="$1"
    if [[ -z "$input" ]]; then
        echo "Error: Input is empty" >&2
        return 1
    fi
    echo "Input: $input"
}
```

### 3.3 Numeric Comparison

```bash
# Numeric comparison operators (used inside [[ ]])
[[ $a -eq $b ]]                  # Equal
[[ $a -ne $b ]]                  # Not equal
[[ $a -lt $b ]]                  # Less than
[[ $a -gt $b ]]                  # Greater than
[[ $a -le $b ]]                  # Less than or equal
[[ $a -ge $b ]]                  # Greater than or equal

# (( )) form (dedicated to numeric operations; more intuitive)
if (( count > 10 )); then
    echo "Too many"
fi
if (( age >= 18 && age <= 65 )); then
    echo "Working age"
fi
if (( score == 100 )); then
    echo "Perfect!"
fi

# Notes on (( ))
# - Cannot be used for string comparison
# - $ before variable name can be omitted: (( count > 10 )) and (( $count > 10 )) are the same
# - 0 is false, non-zero is true: (( 0 )) → false, (( 1 )) → true
# - Undefined variables are treated as 0
```

### 3.4 File Tests

```bash
# File existence and type
[[ -f "$file" ]]                 # Regular file exists
[[ -d "$dir" ]]                  # Directory exists
[[ -e "$path" ]]                 # Exists (any type)
[[ -L "$path" ]]                 # Symbolic link
[[ -p "$path" ]]                 # Named pipe (FIFO)
[[ -S "$path" ]]                 # Socket
[[ -b "$path" ]]                 # Block device
[[ -c "$path" ]]                 # Character device

# File attributes
[[ -r "$file" ]]                 # Readable
[[ -w "$file" ]]                 # Writable
[[ -x "$file" ]]                 # Executable
[[ -s "$file" ]]                 # Size is not 0
[[ -O "$file" ]]                 # Current user is the owner
[[ -G "$file" ]]                 # Current group is the owning group

# File comparison
[[ "$file1" -nt "$file2" ]]     # file1 is newer than file2
[[ "$file1" -ot "$file2" ]]     # file1 is older than file2
[[ "$file1" -ef "$file2" ]]     # Same inode (same file or hard link)

# Practical: Processing with file existence check
config_file="/etc/myapp/config.yml"
if [[ ! -f "$config_file" ]]; then
    echo "Error: Config file not found: $config_file" >&2
    exit 1
fi
if [[ ! -r "$config_file" ]]; then
    echo "Error: Cannot read config file: $config_file" >&2
    exit 1
fi
echo "Loading config from $config_file..."

# Create directory (only if it does not exist)
log_dir="/var/log/myapp"
if [[ ! -d "$log_dir" ]]; then
    mkdir -p "$log_dir"
    echo "Created log directory: $log_dir"
fi
```

### 3.5 Logical Operations

```bash
# Logical operations inside [[ ]]
[[ $a -gt 0 && $a -lt 100 ]]    # AND
[[ $a -eq 0 || $a -eq 1 ]]      # OR
[[ ! -f "$file" ]]               # NOT

# Combining multiple conditions
if [[ -f "$file" && -r "$file" && -s "$file" ]]; then
    echo "File exists, is readable, and is not empty"
fi

# Condition priority (grouping)
if [[ ( $a -gt 0 && $a -lt 10 ) || $a -eq 100 ]]; then
    echo "a is 1-9 or 100"
fi

# Logical operations on commands
command1 && command2             # Run command2 if command1 succeeds
command1 || command2             # Run command2 if command1 fails
command1 && command2 || command3 # command2 on success, command3 on failure

# Practical patterns
cd "$dir" && echo "Moved to $dir" || echo "Failed to move to $dir"
grep -q "pattern" "$file" && echo "Found" || echo "Not found"
```

### 3.6 case Statements

```bash
# Basic case statement
case "$1" in
    start)
        echo "Starting..."
        ;;
    stop)
        echo "Stopping..."
        ;;
    restart)
        echo "Restarting..."
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac

# Using pattern matching
case "$filename" in
    *.tar.gz|*.tgz)
        tar xzf "$filename"
        ;;
    *.tar.bz2)
        tar xjf "$filename"
        ;;
    *.zip)
        unzip "$filename"
        ;;
    *.gz)
        gunzip "$filename"
        ;;
    *.tar)
        tar xf "$filename"
        ;;
    *)
        echo "Unknown archive format: $filename"
        ;;
esac

# Advanced patterns in case
case "$input" in
    [0-9])
        echo "Single digit"
        ;;
    [0-9][0-9])
        echo "Two digits"
        ;;
    [a-zA-Z]*)
        echo "Starts with a letter"
        ;;
    "")
        echo "Empty string"
        ;;
    *)
        echo "Other"
        ;;
esac

# yes/no confirmation prompt
read -p "Continue? [y/N] " response
case "$response" in
    [yY]|[yY][eE][sS])
        echo "Proceeding..."
        ;;
    *)
        echo "Aborted."
        exit 0
        ;;
esac

# Bash 4+ case: ;& and ;;&
# ;; → Exit case when matched (normal behavior)
# ;& → Also execute the next pattern unconditionally (C-style fall-through)
# ;;& → Also check the next pattern and execute (continue checking)
case "$level" in
    critical)
        echo "Paging on-call"
        ;&  # fall-through
    error)
        echo "Sending alert email"
        ;&  # fall-through
    warning)
        echo "Logging to file"
        ;;
esac
```

### 3.7 Practical Conditional Patterns

```bash
# Pattern 1: Check if a command exists
if command -v docker &>/dev/null; then
    echo "Docker is installed"
else
    echo "Docker is not installed"
    exit 1
fi

# Pattern 2: OS detection
case "$(uname -s)" in
    Linux)
        echo "Running on Linux"
        PACKAGE_MANAGER="apt"
        ;;
    Darwin)
        echo "Running on macOS"
        PACKAGE_MANAGER="brew"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        echo "Running on Windows"
        ;;
    *)
        echo "Unknown OS"
        ;;
esac

# Pattern 3: Numeric range validation
validate_port() {
    local port="$1"
    if ! [[ "$port" =~ ^[0-9]+$ ]]; then
        echo "Error: Not a number: $port" >&2
        return 1
    fi
    if (( port < 1 || port > 65535 )); then
        echo "Error: Port must be 1-65535: $port" >&2
        return 1
    fi
    if (( port < 1024 )); then
        echo "Warning: Privileged port (requires root): $port" >&2
    fi
    return 0
}

# Pattern 4: Multi-condition validation
validate_config() {
    local errors=0

    if [[ -z "$DB_HOST" ]]; then
        echo "Error: DB_HOST is not set" >&2
        (( errors++ ))
    fi
    if [[ -z "$DB_NAME" ]]; then
        echo "Error: DB_NAME is not set" >&2
        (( errors++ ))
    fi
    if [[ -z "$DB_USER" ]]; then
        echo "Error: DB_USER is not set" >&2
        (( errors++ ))
    fi

    if (( errors > 0 )); then
        echo "Found $errors configuration error(s)" >&2
        return 1
    fi
    return 0
}
```

---

## 4. Loops

### 4.1 for Loops

```bash
# Basic for loop
for i in 1 2 3 4 5; do
    echo "Number: $i"
done

# C-style for
for ((i = 0; i < 10; i++)); do
    echo "Index: $i"
done

# Range specification (brace expansion)
for i in {1..10}; do             # 1 to 10
    echo "$i"
done
for i in {0..100..5}; do         # 0 to 100 in steps of 5
    echo "$i"
done
for letter in {a..z}; do         # a to z
    echo "$letter"
done

# seq command (when you need to specify a range with a variable)
max=10
for i in $(seq 1 "$max"); do
    echo "$i"
done
for i in $(seq 0 5 100); do     # 0 to 100 in steps of 5
    echo "$i"
done

# Loop over files
for file in *.txt; do
    echo "Processing: $file"
done

# Multiple patterns
for file in *.txt *.csv *.json; do
    echo "File: $file"
done

# Handling the case where no files match the pattern
shopt -s nullglob               # Expand to empty if no match
for file in *.txt; do
    echo "Processing: $file"
done
shopt -u nullglob               # Restore to default

# Loop over command output
for user in $(cut -d: -f1 /etc/passwd); do
    echo "User: $user"
done

# Array loop
servers=("web1" "web2" "web3" "db1")
for server in "${servers[@]}"; do
    echo "Checking: $server"
done

# Loop over arguments
for arg in "$@"; do
    echo "Argument: $arg"
done

# Loop with index
items=("apple" "banana" "cherry")
for i in "${!items[@]}"; do
    echo "$i: ${items[$i]}"
done
```

### 4.2 while Loops

```bash
# Basic while loop
count=0
while [[ $count -lt 5 ]]; do
    echo "Count: $count"
    ((count++))
done

# Infinite loop
while true; do
    echo "Running..."
    sleep 1
    # Exit with break
done

# while using (( ))
n=1
while (( n <= 100 )); do
    echo "$n"
    (( n++ ))
done

# Read a file line by line (important pattern)
while IFS= read -r line; do
    echo "Line: $line"
done < input.txt

# Meaning of IFS= and -r
# IFS=  → Preserve leading and trailing whitespace
# -r    → Do not treat backslash as a special character
# This combination reads lines accurately

# Reading from a pipe (beware of subshells)
# NG: The right side of a pipe is a subshell, so variables are not preserved
count=0
cat file.txt | while read -r line; do
    ((count++))
done
echo "Count: $count"  # → 0 (variables inside the subshell are lost)

# OK: Use redirection
count=0
while read -r line; do
    ((count++))
done < file.txt
echo "Count: $count"  # → correct value

# OK: Use process substitution
count=0
while read -r line; do
    ((count++))
done < <(cat file.txt)
echo "Count: $count"  # → correct value

# Processing a CSV file
while IFS=',' read -r name age city; do
    echo "Name: $name, Age: $age, City: $city"
done < data.csv

# Processing /etc/passwd
while IFS=':' read -r user _ uid gid _ home shell; do
    echo "User: $user (UID: $uid, Home: $home)"
done < /etc/passwd

# Process command output line by line
while read -r pid user cpu mem command; do
    if (( $(echo "$cpu > 50" | bc -l) )); then
        echo "High CPU: $command ($cpu%)"
    fi
done < <(ps aux --no-headers)
```

### 4.3 until Loops

```bash
# until loop (repeats until condition becomes true)
until ping -c1 server.com &>/dev/null; do
    echo "Waiting for server..."
    sleep 5
done
echo "Server is up!"

# Wait for service to start
until curl -s http://localhost:8080/health > /dev/null 2>&1; do
    echo "Waiting for application to start..."
    sleep 2
done
echo "Application is ready!"

# Wait with timeout
timeout=60
elapsed=0
until docker ps | grep -q "my-container"; do
    if (( elapsed >= timeout )); then
        echo "Timeout: Container did not start within ${timeout}s"
        exit 1
    fi
    echo "Waiting for container... (${elapsed}s)"
    sleep 5
    (( elapsed += 5 ))
done
echo "Container is running!"
```

### 4.4 Loop Control

```bash
# break / continue
for i in {1..10}; do
    [[ $i -eq 3 ]] && continue   # Skip 3
    [[ $i -eq 8 ]] && break      # Exit at 8
    echo "$i"
done
# Output: 1 2 4 5 6 7

# break/continue in nested loops
for i in {1..3}; do
    for j in {1..3}; do
        if (( i == 2 && j == 2 )); then
            break 2              # Also break the outer loop (specify depth with a number)
        fi
        echo "$i,$j"
    done
done

# Specifying nesting depth with continue is also possible
for i in {1..3}; do
    for j in {1..3}; do
        if (( j == 2 )); then
            continue 2           # Go to the next iteration of the outer loop
        fi
        echo "$i,$j"
    done
done
```

### 4.5 Practical Loop Patterns

```bash
# Pattern 1: Retry processing
max_retries=5
retry_count=0
until some_command; do
    ((retry_count++))
    if (( retry_count >= max_retries )); then
        echo "Failed after $max_retries retries"
        exit 1
    fi
    echo "Retry $retry_count/$max_retries..."
    sleep $(( retry_count * 2 ))  # Exponential backoff
done

# Pattern 2: Bulk file processing (find + while)
find /var/log -name "*.log" -mtime +30 -print0 | while IFS= read -r -d '' file; do
    echo "Compressing: $file"
    gzip "$file"
done
# -print0 and -d '' handle spaces and newlines in filenames

# Pattern 3: Progress bar
total=100
for ((i = 1; i <= total; i++)); do
    percent=$(( i * 100 / total ))
    bar=$(printf '%*s' $(( percent / 2 )) '' | tr ' ' '#')
    printf "\r[%-50s] %d%%" "$bar" "$percent"
    sleep 0.05
done
echo ""

# Pattern 4: Menu display (select)
PS3="Select an option: "
select opt in "Start" "Stop" "Status" "Quit"; do
    case "$opt" in
        "Start")  echo "Starting..."; ;;
        "Stop")   echo "Stopping..."; ;;
        "Status") echo "Running"; ;;
        "Quit")   break; ;;
        *)        echo "Invalid option"; ;;
    esac
done

# Pattern 5: Recursive directory processing
process_dir() {
    local dir="$1"
    for item in "$dir"/*; do
        if [[ -d "$item" ]]; then
            process_dir "$item"     # Recursive call
        elif [[ -f "$item" ]]; then
            echo "File: $item"
        fi
    done
}
process_dir "/path/to/start"
```

---

## 5. Functions

### 5.1 Defining and Calling Functions

```bash
# Function definition (two ways)
greet() {
    local name="$1"              # local: function-local variable
    echo "Hello, $name!"
}

function greet2 {
    local name="$1"
    echo "Hi, $name!"
}

# Calling
greet "Gaku"                     # → Hello, Gaku!
greet2 "World"                   # → Hi, World!

# Function arguments
show_args() {
    echo "Function name: $FUNCNAME"
    echo "Argument count: $#"
    echo "First arg: $1"
    echo "Second arg: $2"
    echo "All args: $@"
}
show_args "hello" "world" "foo"
```

### 5.2 Return Values

```bash
# return sends an exit status (0=success, 1-255=failure)
is_even() {
    if (( $1 % 2 == 0 )); then
        return 0                 # Success (true)
    else
        return 1                 # Failure (false)
    fi
}

if is_even 4; then
    echo "4 is even"
fi

# Returning a value (via stdout)
get_timestamp() {
    date +%Y%m%d_%H%M%S
}
ts=$(get_timestamp)
echo "Timestamp: $ts"

# Returning multiple values
get_dimensions() {
    local file="$1"
    local width=$(identify -format "%w" "$file" 2>/dev/null)
    local height=$(identify -format "%h" "$file" 2>/dev/null)
    echo "$width $height"        # Output space-separated
}
read -r width height <<< "$(get_dimensions photo.jpg)"
echo "Width: $width, Height: $height"

# Returning an array (newline-separated)
list_users() {
    cut -d: -f1 /etc/passwd | sort
}
mapfile -t users < <(list_users)
echo "Total users: ${#users[@]}"

# Returning results via global variable (not recommended, but good to know)
calculate() {
    RESULT=$(( $1 + $2 ))        # Global variable
}
calculate 3 5
echo "Result: $RESULT"           # → 8
```

### 5.3 Local Variables and Scope

```bash
# Without local, everything is global
bad_function() {
    x=100                        # Global!
}
bad_function
echo "$x"                        # → 100 (accessible outside the function)

# Confined to the function with local
good_function() {
    local x=100                  # Inside function only
}
good_function
echo "$x"                        # → (empty; not accessible)

# Practical: Always use local
process_file() {
    local file="$1"
    local content
    local line_count

    content=$(cat "$file")
    line_count=$(wc -l < "$file")

    echo "File: $file ($line_count lines)"
}

# nameref (Bash 4.3+) — pass by reference
set_value() {
    local -n ref=$1              # nameref: references the caller's variable
    ref="new value"
}
my_var="old value"
set_value my_var
echo "$my_var"                   # → new value
```

### 5.4 Functions with Error Handling

```bash
# Function with error handling
safe_cd() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        echo "Error: Directory '$dir' not found" >&2
        return 1
    fi
    cd "$dir" || return 1
}

# die function (when terminating the entire script)
die() {
    echo "FATAL: $*" >&2
    exit 1
}

# Usage example
safe_cd "/opt/myapp" || die "Cannot access application directory"

# Validation function
require_command() {
    local cmd="$1"
    if ! command -v "$cmd" &>/dev/null; then
        die "Required command not found: $cmd"
    fi
}
require_command "docker"
require_command "git"
require_command "jq"

# Safe wrapper for file operations
safe_rm() {
    local target="$1"
    # Reject dangerous paths
    case "$target" in
        /|/home|/usr|/var|/etc|/tmp)
            die "Refusing to delete critical directory: $target"
            ;;
    esac
    if [[ -e "$target" ]]; then
        rm -rf "$target"
        echo "Removed: $target"
    else
        echo "Warning: Does not exist: $target" >&2
    fi
}
```

### 5.5 Practical Function Patterns

```bash
# Pattern 1: Logging function group
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $*" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*" >&2; }
log_debug() { [[ "${DEBUG:-0}" == "1" ]] && echo -e "${BLUE}[DEBUG]${NC} $(date '+%H:%M:%S') $*"; }

# Pattern 2: Confirmation prompt
confirm() {
    local message="${1:-Continue?}"
    local default="${2:-n}"
    local prompt

    if [[ "$default" == "y" ]]; then
        prompt="$message [Y/n] "
    else
        prompt="$message [y/N] "
    fi

    read -p "$prompt" response
    response="${response:-$default}"

    [[ "$response" =~ ^[yY] ]]
}

# Usage example
if confirm "Delete all logs?"; then
    rm -rf /var/log/myapp/*
fi

# Pattern 3: Spinner display
spinner() {
    local pid=$1
    local spin='|/-\'
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r%s" "${spin:$((i++ % 4)):1}"
        sleep 0.1
    done
    printf "\r"
}

# Usage example
long_process &
spinner $!
wait $!

# Pattern 4: Function with timeout
wait_for_port() {
    local host="$1"
    local port="$2"
    local timeout="${3:-30}"
    local elapsed=0

    while ! nc -z "$host" "$port" 2>/dev/null; do
        if (( elapsed >= timeout )); then
            echo "Timeout waiting for $host:$port" >&2
            return 1
        fi
        sleep 1
        (( elapsed++ ))
    done
    echo "$host:$port is available"
    return 0
}

wait_for_port "localhost" 5432 60 || die "Database not available"
```

---

## 6. Input/Output

### 6.1 Reading Standard Input

```bash
# Basic reading
read -p "Enter your name: " name
read -sp "Enter password: " password    # -s: hidden input
echo ""                                  # Newline (-s does not output a newline)
read -t 10 -p "Quick! " answer          # -t: timeout (seconds)
read -r line                             # -r: do not treat backslash as special
read -n 1 -p "Press any key..." key     # -n: automatically confirm after specified characters

# Read multiple variables by splitting
echo "John 25 Tokyo" | read -r name age city
# ↑ Note: pipe creates a subshell

# Correct way
read -r name age city <<< "John 25 Tokyo"
echo "$name is $age years old from $city"

# Read as an array
read -ra words <<< "hello world foo bar"
echo "${words[0]}"               # → hello
echo "${words[2]}"               # → foo

# Input with default value
read -p "Port [8080]: " port
port="${port:-8080}"

# Input validation
while true; do
    read -p "Enter a number (1-100): " num
    if [[ "$num" =~ ^[0-9]+$ ]] && (( num >= 1 && num <= 100 )); then
        break
    fi
    echo "Invalid input. Please try again."
done
echo "You entered: $num"
```

### 6.2 Redirection

```bash
# Basic redirection
echo "hello" > file.txt          # Overwrite (clears and writes if file exists)
echo "world" >> file.txt         # Append
command 2> error.log             # Standard error to file
command > out.log 2>&1           # Both stdout and stderr to file
command &> both.log              # Same (bash shorthand)
command > /dev/null 2>&1         # Discard all output
command &>/dev/null              # Same (bash shorthand)

# File descriptors
# 0 = stdin (standard input)
# 1 = stdout (standard output)
# 2 = stderr (standard error)

# Show only standard error (discard standard output)
command > /dev/null              # Discard only stdout
command 2>/dev/null              # Discard only stderr

# Send stdout and stderr to separate files
command > stdout.log 2> stderr.log

# Swap stdout and stderr
command 3>&1 1>&2 2>&3           # Swap stdout ↔ stderr

# Additional file descriptors
exec 3> output.log               # Assign FD3 to output.log
echo "Log message" >&3           # Write to FD3
exec 3>&-                        # Close FD3

# Input redirection
command < input.txt              # Input from file
sort < unsorted.txt > sorted.txt # Redirect both input and output

# noclobber (prevent overwriting)
set -o noclobber                 # Prohibit overwriting with >
echo "test" > existing_file      # → Error
echo "test" >| existing_file     # >| forces overwrite
set +o noclobber                 # Disable

# tee command (output to both screen and file)
command | tee output.log         # Display on stdout and save to file
command | tee -a output.log      # Append mode
command 2>&1 | tee output.log    # Including stderr
```

### 6.3 Heredocs

```bash
# Heredoc (with variable expansion)
cat <<EOF
Hello, $name!
Today is $(date).
Your home directory is $HOME
EOF

# Heredoc (without variable expansion)
cat <<'EOF'
$name is not expanded
$(date) is not expanded either
EOF

# Create a file with a heredoc
cat > /tmp/config.ini <<EOF
[database]
host=$DB_HOST
port=$DB_PORT
name=$DB_NAME
EOF

# Heredoc with indentation (<<- removes tabs)
if true; then
    cat <<-EOF
	Hello, $name!
	This is indented with tabs.
	EOF
fi
# Note: <<- only removes tabs; spaces are not removed

# Here string (single-line input)
grep "pattern" <<< "$variable"
read -r first rest <<< "hello world foo"
echo "$first"                    # → hello
echo "$rest"                     # → world foo

bc <<< "10 * 20 + 5"            # → 205

# Practical: Execute remote commands via SSH
ssh user@server <<'REMOTE'
cd /opt/myapp
git pull
npm install
pm2 restart all
REMOTE

# Practical: Execute SQL
mysql -u root -p"$DB_PASS" <<EOF
USE mydb;
SELECT COUNT(*) FROM users WHERE active = 1;
EOF
```

### 6.4 Pipes and Process Substitution

```bash
# Pipe (output of one command becomes input of the next)
ls -la | sort -k5 -n            # Sort by file size
cat access.log | grep "404" | wc -l  # Count 404 errors

# Named pipes (FIFO)
mkfifo /tmp/mypipe
command1 > /tmp/mypipe &
command2 < /tmp/mypipe
rm /tmp/mypipe

# Process substitution (replaces temporary files)
diff <(ls dir1) <(ls dir2)       # Compare contents of two directories
diff <(sort file1) <(sort file2) # Compare while sorting

# Practical: Compare output of two commands
diff <(ssh server1 "cat /etc/nginx/nginx.conf") \
     <(ssh server2 "cat /etc/nginx/nginx.conf")

# Multiple output destinations with process substitution
tee >(gzip > output.gz) >(wc -l > count.txt) < input.txt

# Pipe status (PIPESTATUS array)
false | true | false
echo "${PIPESTATUS[@]}"          # → 1 0 1 (exit status of each command)
```

---

## 7. Debugging

### 7.1 Debug Options

```bash
# set -x: Display executed commands (the most important debugging tool)
set -x
echo "hello"                     # + echo hello is displayed
set +x                          # End debug output

# Run the entire script in debug mode
bash -x script.sh

# Partial debugging
set -x
# Processing you want to debug
problematic_function
set +x

# set -v: Display commands when read (before expansion)
set -v
echo "$HOME"                     # echo "$HOME" is displayed (before expansion)
set +v

# Customize debug output with PS4
export PS4='+ ${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
set -x
# Example output: + script.sh:25: main(): echo hello

# Write debug output to a separate file with BASH_XTRACEFD
exec 4> /tmp/debug.log
export BASH_XTRACEFD=4
set -x
# Debug output is written to /tmp/debug.log
# stdout/stderr are displayed on screen as usual
```

### 7.2 Error Troubleshooting

```bash
# Common errors and how to handle them

# 1. "unexpected end of file"
#    → Forgot to close if, while, for, case
#    → Forgot to close a quote

# 2. "command not found"
#    → Check PATH: echo $PATH
#    → Check execute permission: ls -la script.sh
#    → Check shebang

# 3. "unbound variable"
#    → Referenced an undefined variable while using set -u
#    → Set a default value: ${var:-default}

# 4. "ambiguous redirect"
#    → When the variable is empty: > $file → > "" occurs
#    → Use quotes: > "$file"

# 5. "too many arguments"
#    → Unquoted variable inside [ ]
#    → Use [[ ]]

# Syntax check (check grammar without executing)
bash -n script.sh                # Detect only syntax errors

# ShellCheck (static analysis tool; highly recommended)
# brew install shellcheck
shellcheck script.sh             # Detect potential issues
shellcheck -s bash script.sh     # Specify bash dialect
shellcheck -e SC2086 script.sh   # Exclude specific warnings

# Typical issues detected by ShellCheck
# SC2086: Double quote to prevent globbing and word splitting
# SC2034: Variable appears unused
# SC2046: Quote this to prevent word splitting
# SC2016: Expressions don't expand in single quotes
```

### 7.3 Practical Debugging Techniques

```bash
# Show executing line with a trap
trap 'echo "DEBUG: Line $LINENO: $BASH_COMMAND"' DEBUG

# Function trace
func_trace() {
    echo "TRACE: ${FUNCNAME[1]}() called from line ${BASH_LINENO[0]}"
}

# Helper to check variable state
dump_vars() {
    echo "=== Variable Dump ==="
    echo "PWD=$PWD"
    echo "count=$count"
    echo "file=$file"
    echo "===================="
}

# Debug with timing information
debug_time() {
    echo "[$(date '+%H:%M:%S.%N')] $*" >&2
}

# Practical: Isolating the problem
# 1. First, syntax check with bash -n
# 2. Execution trace with bash -x
# 3. Static analysis with shellcheck
# 4. Add echo before and after the problematic part to check variable values
# 5. Partial debug with set -x / set +x
```

---

## 8. Practical Script Templates

### 8.1 Robust Script Template

```bash
#!/usr/bin/env bash
#
# Script name: template.sh
# Description: Template for a robust script
# Usage: ./template.sh [OPTIONS] ARG
#

set -euo pipefail

# Constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly VERSION="1.0.0"

# Default values
VERBOSE=false
DRY_RUN=false
OUTPUT_DIR="."

# Color definitions
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly NC='\033[0m'

# ── Logging functions ──
log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()       { log_error "$@"; exit 1; }

# ── Cleanup ──
TMPDIR=""
cleanup() {
    local exit_code=$?
    if [[ -n "$TMPDIR" && -d "$TMPDIR" ]]; then
        rm -rf "$TMPDIR"
    fi
    exit $exit_code
}
trap cleanup EXIT

# ── Help ──
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS] FILE...

Description:
  Write a description of this script here

Options:
  -h, --help         Show this help
  -V, --version      Show version
  -v, --verbose      Verbose output
  -n, --dry-run      Do not actually execute
  -o, --output DIR   Output directory (default: .)

Examples:
  $SCRIPT_NAME -v input.txt
  $SCRIPT_NAME --output /tmp -n *.csv
EOF
}

# ── Argument parsing ──
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)    usage; exit 0 ;;
            -V|--version) echo "$SCRIPT_NAME $VERSION"; exit 0 ;;
            -v|--verbose) VERBOSE=true; shift ;;
            -n|--dry-run) DRY_RUN=true; shift ;;
            -o|--output)  OUTPUT_DIR="$2"; shift 2 ;;
            --)           shift; break ;;
            -*)           die "Unknown option: $1" ;;
            *)            break ;;
        esac
    done

    # Remaining arguments
    FILES=("$@")

    # Validation
    if [[ ${#FILES[@]} -eq 0 ]]; then
        die "No input files specified. Use -h for help."
    fi
}

# ── Main processing ──
main() {
    parse_args "$@"

    # Temporary directory
    TMPDIR=$(mktemp -d)

    log_info "Processing ${#FILES[@]} file(s)..."

    for file in "${FILES[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_warn "File not found: $file"
            continue
        fi

        if [[ "$VERBOSE" == true ]]; then
            log_info "Processing: $file"
        fi

        if [[ "$DRY_RUN" == true ]]; then
            log_info "[DRY RUN] Would process: $file"
            continue
        fi

        # Write actual processing here
        process_file "$file"
    done

    log_info "Done!"
}

process_file() {
    local file="$1"
    # Processing implementation
    echo "Processing: $file"
}

main "$@"
```

### 8.2 Backup Script Example

```bash
#!/usr/bin/env bash
set -euo pipefail

# Configuration
readonly BACKUP_SOURCE="/home/user/data"
readonly BACKUP_DEST="/mnt/backup"
readonly MAX_BACKUPS=7
readonly DATE=$(date +%Y%m%d_%H%M%S)
readonly BACKUP_NAME="backup_${DATE}.tar.gz"
readonly LOG_FILE="/var/log/backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Check available disk space at backup destination
check_disk_space() {
    local available
    available=$(df -BM "$BACKUP_DEST" | awk 'NR==2 {print $4}' | tr -d 'M')
    local source_size
    source_size=$(du -sm "$BACKUP_SOURCE" | awk '{print $1}')

    if (( available < source_size * 2 )); then
        log "WARNING: Low disk space. Available: ${available}MB, Source: ${source_size}MB"
        return 1
    fi
}

# Delete old backups
cleanup_old_backups() {
    local count
    count=$(ls -1 "$BACKUP_DEST"/backup_*.tar.gz 2>/dev/null | wc -l)

    if (( count > MAX_BACKUPS )); then
        local to_delete=$(( count - MAX_BACKUPS ))
        ls -1t "$BACKUP_DEST"/backup_*.tar.gz | tail -n "$to_delete" | while read -r file; do
            log "Removing old backup: $file"
            rm -f "$file"
        done
    fi
}

# Main
main() {
    log "=== Backup started ==="

    check_disk_space || exit 1

    log "Creating backup: $BACKUP_NAME"
    tar czf "$BACKUP_DEST/$BACKUP_NAME" -C "$(dirname "$BACKUP_SOURCE")" "$(basename "$BACKUP_SOURCE")"

    local size
    size=$(du -sh "$BACKUP_DEST/$BACKUP_NAME" | awk '{print $1}')
    log "Backup created: $BACKUP_NAME ($size)"

    cleanup_old_backups

    log "=== Backup completed ==="
}

main "$@"
```

### 8.3 File Watch Script Example

```bash
#!/usr/bin/env bash
set -euo pipefail

# Detect file changes and execute processing
readonly WATCH_DIR="${1:-.}"
readonly INTERVAL="${2:-5}"

declare -A file_mtimes

get_mtime() {
    stat -c %Y "$1" 2>/dev/null || echo "0"
}

scan_files() {
    local changed=false
    for file in "$WATCH_DIR"/*; do
        [[ -f "$file" ]] || continue
        local current_mtime
        current_mtime=$(get_mtime "$file")
        local basename
        basename=$(basename "$file")

        if [[ -z "${file_mtimes[$basename]:-}" ]]; then
            file_mtimes[$basename]="$current_mtime"
            echo "[NEW] $basename"
            changed=true
        elif [[ "${file_mtimes[$basename]}" != "$current_mtime" ]]; then
            file_mtimes[$basename]="$current_mtime"
            echo "[MOD] $basename"
            changed=true
        fi
    done

    if [[ "$changed" == true ]]; then
        echo "[$(date '+%H:%M:%S')] Changes detected. Running build..."
        # Insert build commands here
    fi
}

echo "Watching $WATCH_DIR every ${INTERVAL}s..."
while true; do
    scan_files
    sleep "$INTERVAL"
done
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Syntax | Purpose | Example |
|--------|---------|---------|
| `$var` / `${var}` | Variable reference | `echo "$name"` |
| `$(command)` | Command substitution | `today=$(date)` |
| `$((expr))` | Arithmetic operation | `$((count + 1))` |
| `[[ cond ]]` | Condition test | `[[ -f "$file" ]]` |
| `(( expr ))` | Numeric condition | `(( count > 10 ))` |
| `for / while / until` | Loops | `for i in {1..10}; do` |
| `case` | Pattern-match branching | `case "$1" in ...` |
| `func() { ... }` | Function definition | `greet() { echo "Hi"; }` |
| `local var` | Function-local variable | `local name="$1"` |
| `set -euo pipefail` | Robustness settings | At the top of the script |
| `trap '...' SIGNAL` | Signal handler | `trap cleanup EXIT` |
| `> / >> / 2>` | Redirection | `cmd > file 2>&1` |
| `<<EOF` | Heredoc | Multi-line input |
| `<<<` | Here string | Single-line input |

---

## What to Read Next

---

## References
1. Shotts, W. "The Linux Command Line." 2nd Ed, Ch.24-36, 2019.
2. "Bash Reference Manual." GNU, 2024.
3. "Google Shell Style Guide." google.github.io/styleguide.
4. Cooper, M. "Advanced Bash-Scripting Guide." TLDP, 2014.
5. "ShellCheck Wiki." github.com/koalaman/shellcheck/wiki.
6. Robbins, A., Beebe, N. "Classic Shell Scripting." O'Reilly, 2005.
7. Taylor, D. "Wicked Cool Shell Scripts." 2nd Ed, No Starch Press, 2016.
