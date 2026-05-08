# Stream Editor (sed)

> sed is a powerful pipeline transformer that "converts text line by line."

## What You Will Learn

- [ ] Perform basic substitution, deletion, and insertion with sed
- [ ] Use regular expressions for advanced substitutions
- [ ] Master address specifications (line ranges, pattern ranges)
- [ ] Combine multiple commands and use script files
- [ ] Know practical sed patterns for real-world use
- [ ] Understand the differences between GNU sed and BSD sed


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content of [Pattern Search (grep / ripgrep)](./01-grep-ripgrep.md)

---

## 1. sed Basics

### 1.1 Basic Syntax and Operating Principles

```bash
# Basic syntax: sed [options] 'command' [file...]
#
# How sed works:
# 1. Read one line from input (stored in the pattern space)
# 2. Apply commands in order
# 3. Output the result
# 4. Move to the next line and return to 1
#
# sed outputs all lines by default (even if no changes are made)
# Use the -n option to suppress automatic output, and explicitly output with the p command

# Basic usage
sed 's/old/new/' file.txt           # Replace the first "old" with "new" on each line
echo "hello world" | sed 's/world/earth/'  # Input from a pipe

# Edit a file in place (-i option)
sed -i 's/old/new/g' file.txt       # Overwrite the file directly (GNU sed)
sed -i '' 's/old/new/g' file.txt    # macOS BSD sed (empty string backup extension)
sed -i.bak 's/old/new/g' file.txt   # Overwrite and create a backup
```

### 1.2 Differences Between GNU sed and BSD sed

```bash
# There are syntax differences between macOS (BSD sed) and Linux (GNU sed)

# -i option (in-place editing)
sed -i 's/old/new/g' file.txt       # GNU sed: backup extension is optional
sed -i '' 's/old/new/g' file.txt    # BSD sed: backup extension is required (can be empty)
sed -i.bak 's/old/new/g' file.txt   # Works on both (creates a backup)

# Handling newlines
sed 's/$/\n/' file.txt              # GNU sed: \n is expanded to a newline
sed 's/$/\'$'\n''/' file.txt        # BSD sed: specify a newline with $'\n'

# -E option (extended regular expressions)
sed -E 's/(foo|bar)/baz/g' file.txt # Works on both (-E is common)
# GNU sed also accepts -r (alias for -E)
sed -r 's/(foo|bar)/baz/g' file.txt # GNU sed only

# Portable writing style:
# - Always specify a backup extension: sed -i.bak
# - Use -E (instead of -r)
# - Use $'\n' syntax for newlines
# - Or install gsed (GNU sed) on macOS: brew install gnu-sed
```

---

## 2. The Substitution Command (s)

### 2.1 Basic Substitution

```bash
# Basic syntax: s/pattern/replacement/flags
# Default: replaces only the first match on each line

sed 's/old/new/' file.txt           # Replace the first old with new on each line
sed 's/old/new/g' file.txt          # Replace all old with new (g = global)
sed 's/old/new/2' file.txt          # Replace the 2nd old on each line
sed 's/old/new/3g' file.txt         # Replace the 3rd and subsequent old on each line

# Case-insensitive substitution
sed 's/old/new/gi' file.txt         # Replace all, case-insensitive (GNU sed)
sed 's/old/new/gI' file.txt         # I flag (alternative notation in GNU sed)

# Check substitution results (-n + p flag)
sed -n 's/old/new/p' file.txt       # Show only lines where a substitution occurred
sed -n 's/old/new/gp' file.txt      # Show only lines where all substitutions occurred
```

### 2.2 Changing the Delimiter

```bash
# The default delimiter is /, but any character can be used
# Useful when handling URLs or file paths

# Use | as delimiter
sed 's|http://old.com|https://new.com|g' file.txt
sed 's|/usr/local/bin|/opt/bin|g' file.txt

# Use # as delimiter
sed 's#old/path#new/path#g' file.txt
sed 's#/var/log/old#/var/log/new#g' file.txt

# Use , as delimiter
sed 's,foo,bar,g' file.txt

# Use @ as delimiter
sed 's@pattern@replacement@g' file.txt

# Tips for choosing a delimiter:
# Choose a character that does not appear in the pattern or replacement
# URLs → use | or #
# File paths → use | or #
# Regular expressions → use @ or ,
```

### 2.3 Substitution with Regular Expressions

```bash
# Basic Regular Expressions (BRE) - default
sed 's/^/  /' file.txt               # Add 2 spaces to the start of each line
sed 's/$/;/' file.txt                # Add a semicolon to the end of each line
sed 's/^[ \t]*//' file.txt           # Remove leading whitespace (left trim)
sed 's/[ \t]*$//' file.txt           # Remove trailing whitespace (right trim)
sed 's/^[ \t]*//;s/[ \t]*$//' file.txt  # Remove whitespace from both ends (full trim)

# Extended Regular Expressions (ERE) - -E option
sed -E 's/[0-9]+/NUM/g' file.txt     # Replace number sequences with NUM
sed -E 's/(error|warning)/[\1]/g' file.txt  # Surround error/warning with brackets
sed -E 's/^(#.*)$//' file.txt        # Replace comment lines with blank lines

# Character classes
sed 's/[aeiou]/*/g' file.txt         # Replace vowels with asterisks

# Wildcards
sed 's/error.*/ERROR FOUND/' file.txt  # Replace everything from "error" onward
sed 's/".*//' file.txt                 # Delete everything from the first " onward
```

### 2.4 Backreferences (Capture Groups)

```bash
# Use \( \) for grouping and \1, \2, ... for reference (BRE)
# Use ( ) for grouping and \1, \2, ... for reference (ERE: -E option)

# Basic backreferences
sed 's/\(.*\)=\(.*\)/\2=\1/' file.txt          # key=value → value=key
sed -E 's/(.*):(.*)=(.*)/\1: \2 -> \3/' file.txt  # Reformat

# Swapping numbers
sed -E 's/([0-9]+)-([0-9]+)/\2-\1/' file.txt    # 12-34 → 34-12

# Filename conversion
echo "photo_2026.jpg" | sed -E 's/(.*)_([0-9]+)\.(.*)/\1-\2.\3/'
# → photo-2026.jpg

# HTML tag conversion
sed -E 's/<b>(.*)<\/b>/<strong>\1<\/strong>/g' file.html
# → Convert <b>text</b> to <strong>text</strong>

# CSV column manipulation
sed -E 's/^([^,]*),([^,]*),(.*)$/\2,\1,\3/' data.csv
# → Swap the 1st and 2nd columns

# Date format conversion
sed -E 's/([0-9]{2})\/([0-9]{2})\/([0-9]{4})/\3-\1-\2/g' file.txt
# → MM/DD/YYYY → YYYY-MM-DD

# Detect duplicate words
sed -En 's/\b(\w+)\s+\1\b/[\1 \1]/gp' file.txt
# → Surround consecutive identical words with brackets and display

# & refers to the entire matched string
sed 's/[0-9]\+/(&)/g' file.txt       # Surround numbers with parentheses
sed 's/.*/[ & ]/' file.txt           # Surround each line with brackets
sed 's/[A-Z][a-z]*/(&)/g' file.txt   # Surround capitalized words with parentheses
```

### 2.5 Upper/Lowercase Conversion (GNU sed)

```bash
# \U: Convert following characters to uppercase
# \L: Convert following characters to lowercase
# \u: Convert the next single character to uppercase
# \l: Convert the next single character to lowercase
# \E: End the conversion

sed 's/[a-z]*/\U&/' file.txt        # Convert the first word of each line to uppercase
sed 's/.*/\U&/' file.txt             # Convert all lines to uppercase
sed 's/.*/\L&/' file.txt             # Convert all lines to lowercase
sed -E 's/\b(\w)/\u\1/g' file.txt   # Capitalize the first letter of each word (Title Case)
sed -E 's/^(\w)/\u\1/' file.txt     # Capitalize the first character of each line

# Variable name style conversion (snake_case → camelCase)
echo "my_variable_name" | sed -E 's/_(.)/\U\1/g'
# → myVariableName

# camelCase → snake_case
echo "myVariableName" | sed -E 's/([A-Z])/_\L\1/g'
# → my_variable_name
```

---

## 3. The Line Deletion Command (d)

### 3.1 Basic Line Deletion

```bash
# d command: Delete (do not output) matched lines

# Deletion by line number
sed '5d' file.txt                   # Delete line 5
sed '1d' file.txt                   # Delete line 1 (first line)
sed '$d' file.txt                   # Delete the last line
sed '1,3d' file.txt                 # Delete lines 1 through 3
sed '1,5d' file.txt                 # Delete lines 1 through 5
sed '10,$d' file.txt                # Delete all lines from line 10 onward

# Deletion by pattern
sed '/pattern/d' file.txt           # Delete lines matching a pattern
sed '/^$/d' file.txt                # Delete blank lines
sed '/^#/d' file.txt                # Delete comment lines (lines starting with #)
sed '/^;/d' file.txt                # Delete comment lines (lines starting with ;)
sed '/^\/\//d' file.txt             # Delete comment lines (lines starting with //)

# Negation (!)
sed '/pattern/!d' file.txt          # Delete lines that do NOT match the pattern (grep-like)
sed '/^#/!d' file.txt               # Delete non-comment lines (show only comments)

# Range deletion
sed '/BEGIN/,/END/d' file.txt       # Delete lines from BEGIN to END
sed '1,/^---$/d' file.txt           # Delete lines from line 1 to ---
```

### 3.2 Practical Line Deletion Patterns

```bash
# Remove comments and blank lines from a config file (show only active settings)
sed '/^#/d; /^$/d; /^;/d' config.ini
sed -E '/^(#|;|$)/d' config.ini     # Same meaning (extended regular expressions)

# Remove headers
sed '1d' data.csv                    # Remove the CSV header row
sed '1,2d' data.csv                  # Remove the first 2 lines

# Remove footers
sed '$d' file.txt                    # Remove the last line
sed 'N; $!P; $!D; $d' file.txt      # Remove the last N lines (complex but possible)

# Remove HTML tags
sed 's/<[^>]*>//g' file.html         # Remove all HTML tags
sed -E 's/<(script|style)[^>]*>.*<\/(script|style)>//g' file.html  # Remove script/style

# Remove specific sections
sed '/<!--.*-->/d' file.html         # Delete HTML comments
sed '/^import/d' file.py             # Delete all import lines
sed '/console\.log/d' file.js        # Delete console.log lines

# Collapse consecutive blank lines into one
sed '/^$/N;/^\n$/d' file.txt
# Or
cat -s file.txt                      # Using cat -s is simpler
```

---

## 4. The Print Command (p)

### 4.1 Displaying Specific Lines

```bash
# Combine the -n option with the p command to display specific lines
# -n: Suppress automatic output
# p: Explicitly output the pattern space

sed -n '5p' file.txt                # Display only line 5
sed -n '1p' file.txt                # Display only line 1
sed -n '$p' file.txt                # Display only the last line
sed -n '10,20p' file.txt            # Display lines 10 through 20
sed -n '1,5p' file.txt              # Display lines 1 through 5
sed -n '100,$p' file.txt            # Display all lines from line 100 onward

# Display by pattern match
sed -n '/error/p' file.txt          # Display lines containing error (grep-like)
sed -n '/^import/p' file.py         # Display lines starting with import
sed -n '/BEGIN/,/END/p' file.txt    # Display the range from BEGIN to END

# Step specification (GNU sed)
sed -n '1~2p' file.txt              # Odd lines only (every 2 lines starting from line 1)
sed -n '2~2p' file.txt              # Even lines only (every 2 lines starting from line 2)
sed -n '0~3p' file.txt              # Every 3rd line
sed -n '1~5p' file.txt              # Lines 1, 6, 11, 16, ...
```

### 4.2 Displaying Line Numbers

```bash
# = command: Display line numbers
sed -n '/error/=' file.txt           # Line numbers of lines containing error
sed '=' file.txt                     # Display line numbers for all lines

# Display file with line numbers
sed '=' file.txt | sed 'N; s/\n/\t/'   # Concatenate line numbers with tab
# → Output equivalent to cat -n

# Line numbers for specific patterns
sed -n '/TODO/{=;p}' file.txt        # Display line numbers and content of lines with TODO
```

---

## 5. Insert, Append, and Change Commands (i / a / c)

### 5.1 Inserting Lines (i) and Appending Lines (a)

```bash
# i command: Insert before the specified line
sed '1i\#!/bin/bash' script.sh       # Insert a shebang line before line 1
sed '3i\New line' file.txt           # Insert before line 3
sed '/^import/i\# imports:' file.py  # Insert a comment before import lines

# a command: Append after the specified line
sed '1a\# This is a comment' file.txt  # Append a comment after line 1
sed '$a\# End of file' file.txt     # Append after the last line
sed '/^import/a\import os' file.py   # Append after import lines

# Multi-line insertion in GNU sed
sed '1i\line1\nline2\nline3' file.txt   # Insert multiple lines
sed '/pattern/a\line1\nline2' file.txt   # Append multiple lines after a pattern

# Multi-line insertion in BSD sed (macOS)
sed '1i\
line1\
line2\
line3' file.txt

# c command: Replace lines (change the entire line)
sed '5c\This line has been replaced' file.txt   # Replace line 5
sed '/old_line/c\new_line' file.txt              # Replace lines matching a pattern
sed '/^#.*deprecated/c\# This feature is removed' file.txt
```

### 5.2 Practical Insert and Append Patterns

```bash
# Add a file header
sed '1i\# -*- coding: utf-8 -*-' script.py

# Add a license header
sed '1i\/*\n * Copyright 2026\n * MIT License\n */' file.js

# Add HTML header/footer
sed '1i\<html><body>' file.txt
sed '$a\</body></html>' file.txt

# Add a header row to CSV
sed '1i\name,age,email' data.csv

# Add an entry to a config file
sed '/^\[database\]/a\host = localhost' config.ini
# → Add host immediately after the [database] section

# Append a block after a specific line
sed '/^def main/a\    logger.info("main() started")' script.py
```

---

## 6. Address Specification (Line Selection)

### 6.1 Types of Addresses

```bash
# In sed, "addresses" control which lines a command is applied to

# Line number addresses
sed '5s/old/new/' file.txt           # Replace only on line 5
sed '1s/old/new/' file.txt           # Only on line 1
sed '$s/old/new/' file.txt           # Only on the last line

# Line range addresses
sed '1,5s/old/new/g' file.txt        # Replace only on lines 1 through 5
sed '10,20s/old/new/g' file.txt      # Only on lines 10 through 20
sed '10,$s/old/new/g' file.txt       # From line 10 onward
sed '1,/^---$/s/old/new/g' file.txt  # From line 1 to the --- line

# Pattern addresses
sed '/error/s/old/new/' file.txt     # Replace on lines containing error
sed '/^#/s/old/new/' file.txt        # Replace on comment lines
sed '/^$/!s/old/new/' file.txt       # Replace on non-blank lines (! = negation)

# Pattern range addresses
sed '/BEGIN/,/END/s/old/new/g' file.txt   # Replace within the BEGIN to END range
sed '/^<div/,/^<\/div>/s/old/new/g' file.html  # Replace inside <div>...</div>

# Step addresses (GNU sed)
sed '0~2s/old/new/g' file.txt        # Replace on even lines
sed '1~2s/old/new/g' file.txt        # Replace on odd lines

# Negation addresses (!)
sed '1!s/old/new/g' file.txt         # Replace on all lines except line 1
sed '/^#/!s/old/new/g' file.txt      # Replace on non-comment lines
sed '1,5!d' file.txt                 # Delete all lines except 1 through 5 (= show only 1-5)
```

### 6.2 Examples of Combined Addresses

```bash
# Convert only the header section (lines 1-5) to uppercase
sed '1,5s/.*/\U&/' file.txt

# Replace, excluding comment lines
sed '/^#/!s/foo/bar/g' config.conf

# Edit only within a specific section
sed '/^\[production\]/,/^\[/s/debug = true/debug = false/' config.ini
# → Change debug to false within the [production] section

# Edit only within a specific function
sed '/^def process/,/^def /s/print(/logger.info(/g' script.py
# → Change print to logger.info within the process function

# Process only the first matched line (GNU sed's 0, address)
sed '0,/pattern/s/pattern/replacement/' file.txt
# → Replace only the first pattern (leave the rest as-is)
```

---

## 7. Multiple Commands and Scripts

### 7.1 Executing Multiple Commands

```bash
# -e option: Specify multiple commands
sed -e 's/foo/bar/g' -e 's/baz/qux/g' file.txt
sed -e '1d' -e 's/old/new/g' file.txt
sed -e '/^#/d' -e '/^$/d' -e 's/  */ /g' file.txt

# Semicolon separator: Specify multiple commands in one argument
sed 's/foo/bar/g; s/baz/qux/g' file.txt
sed '/^#/d; /^$/d; s/  */ /g' file.txt

# Grouping with braces: Apply multiple commands to a specific address
sed '/error/{s/old/new/g; s/foo/bar/g}' file.txt
# → Execute 2 substitutions on lines containing error

sed '1,5{/^#/d; s/old/new/g}' file.txt
# → Delete comment lines in lines 1-5, and replace in the remaining lines
```

### 7.2 sed Script Files

```bash
# -f option: Load commands from a script file
sed -f commands.sed file.txt

# Example script file (commands.sed)
cat > commands.sed << 'EOF'
# Delete comment lines
/^#/d

# Delete blank lines
/^$/d

# Remove leading and trailing whitespace

# Replace foo with bar
s/foo/bar/g

# Convert error to [ERROR]
s/error/[ERROR]/gi
EOF

sed -f commands.sed logfile.txt

# Collecting complex processing in a script file improves readability
```

### 7.3 Using the Hold Space

```bash
# sed has two buffers:
# - Pattern space: the line currently being processed
# - Hold space: a buffer for temporary storage
#
# Related commands:
# h: Copy the pattern space to the hold space
# H: Append the pattern space to the hold space (concatenated with a newline)
# g: Copy the hold space to the pattern space
# G: Append the hold space to the pattern space
# x: Exchange the pattern space and the hold space

# Display a file in reverse order (equivalent to tac)
sed -n '1!G;h;$p' file.txt

# Combine 2 lines into 1 line
sed 'N;s/\n/ /' file.txt

# Swap even and odd lines
sed -n 'h;n;p;x;p' file.txt

# Display each line twice
sed 'p' file.txt

# Insert a line number after blank lines
sed '/^$/a\---' file.txt
```

---

## 8. Practical Pattern Collection

### 8.1 Batch Replacement Within Files

```bash
# Replace in a single file
sed -i 's/http:/https:/g' file.html       # HTTP to HTTPS
sed -i 's/localhost/production.server.com/g' config.yml  # Change hostname
sed -i 's/v1\.0/v2.0/g' README.md         # Update version number
sed -i "s/Copyright 2025/Copyright 2026/g" *.py  # Update year

# Batch replacement across multiple files (find + sed)
find . -name "*.html" -exec sed -i 's/http:/https:/g' {} +
find . -name "*.py" -exec sed -i 's/old_module/new_module/g' {} +
find . -name "*.js" -exec sed -i 's/var /const /g' {} +

# Narrow down target files with grep, then sed (efficient)
grep -rl "old_function" ./src/ | xargs sed -i 's/old_function/new_function/g'
rg -l "deprecated_api" -t py | xargs sed -i 's/deprecated_api/new_api/g'

# Safe batch replacement (handles filenames with spaces)
find . -name "*.txt" -print0 | xargs -0 sed -i 's/old/new/g'
grep -rlZ "pattern" . | xargs -0 sed -i 's/pattern/replacement/g'
```

### 8.2 Editing Configuration Files

```bash
# Change the value of a specific key
sed -i 's/^port = .*/port = 8080/' config.ini
sed -i 's/^debug = .*/debug = false/' config.ini
sed -i 's/^log_level = .*/log_level = WARNING/' config.ini

# Change a key within a specific section
sed -i '/^\[production\]/,/^\[/{s/^host = .*/host = prod-db.example.com/}' config.ini

# Add a setting (append if the key does not exist)
grep -q "^new_setting" config.ini || sed -i '$a\new_setting = value' config.ini

# Comment out / uncomment settings
sed -i 's/^server_name/# server_name/' nginx.conf     # Comment out
sed -i 's/^# server_name/server_name/' nginx.conf      # Uncomment
sed -i '/^# *enable_feature/s/^# *//' config.ini       # Remove leading #

# Expand environment variables (substitution using variables)
DB_HOST="production-db.example.com"
sed -i "s/DB_HOST=.*/DB_HOST=$DB_HOST/" .env
# Note: Use double quotes to expand variables

# Expand variables in template files
sed -e "s/{{APP_NAME}}/$APP_NAME/g" \
    -e "s/{{DB_HOST}}/$DB_HOST/g" \
    -e "s/{{DB_PORT}}/$DB_PORT/g" \
    template.conf > output.conf
```

### 8.3 Processing Log Files

```bash
# Convert timestamps
sed -E 's/([0-9]{4})-([0-9]{2})-([0-9]{2})/\2\/\3\/\1/g' logfile.txt
# → YYYY-MM-DD to MM/DD/YYYY

# Mask IP addresses
sed -E 's/([0-9]+\.[0-9]+\.[0-9]+\.)[0-9]+/\1XXX/g' access.log
# → Mask the last octet

# Mask sensitive information
sed -E 's/(password[=:])\s*\S+/\1 ********/gi' config.log
sed -E 's/(api_key[=:])\s*\S+/\1 [REDACTED]/gi' app.log
sed -E 's/([0-9]{4})[0-9]{8}([0-9]{4})/\1********\2/g' transaction.log
# → Mask credit card numbers

# Highlight log levels
sed 's/ERROR/*** ERROR ***/g; s/FATAL/!!! FATAL !!!/g' logfile.txt

# Format JSON logs (simplified)
sed 's/,/,\n/g; s/{/{\n/g; s/}/\n}/g' json.log
```

### 8.4 Code Conversion Patterns

```bash
# Convert indentation (tabs → spaces)
sed 's/\t/    /g' file.py             # Tab to 4 spaces
sed -i 's/\t/  /g' file.yaml          # Tab to 2 spaces

# Convert indentation (spaces → tabs)
sed 's/    /\t/g' file.txt            # 4 spaces to tab

# Convert line endings
sed 's/\r$//' file.txt                # CRLF → LF (Windows → Unix)
sed 's/$/\r/' file.txt                # LF → CRLF (Unix → Windows)

# Simple Python 2 → Python 3 conversion
sed -i 's/print \(.*\)/print(\1)/' *.py         # print statement to print()
sed -i 's/raw_input/input/g' *.py                # raw_input → input
sed -i 's/xrange/range/g' *.py                   # xrange → range
sed -i "s/except \(.*\), \(.*\):/except \1 as \2:/" *.py  # except syntax

# Assist with sorting import statements
sed -n '/^import/p; /^from/p' file.py | sort

# Batch rename functions
sed -i 's/\bold_func\b/new_func/g' *.py
sed -i -E 's/\bold_class\b/NewClass/g' *.py

# Convert comment style
sed 's|//\(.*\)|/*\1 */|' file.c      # C++ comments to C comments
sed 's|/\*\(.*\)\*/|//\1|' file.c     # C comments to C++ comments
```

### 8.5 Text Formatting

```bash
# Add line numbers
sed '=' file.txt | sed 'N; s/\n/\t/'   # Line numbers with tab separator

# Surround each line with quotes
sed 's/.*/"&"/' file.txt               # Surround with double quotes
sed "s/.*/'&'/" file.txt               # Surround with single quotes

# Process a specific CSV column
sed -E 's/^([^,]*),([^,]*),/\1,"\2",/' data.csv  # Quote the 2nd column

# Convert to a bulleted list
sed 's/^/- /' file.txt                 # Add "- " to the start of each line
sed 's/^/  * /' file.txt               # Add "  * " to the start of each line

# Convert Markdown list styles
sed 's/^[0-9]*\. /- /' file.md         # Numbered list to bulleted list
sed 's/^- /1. /' file.md               # Bulleted list to numbered list

# Remove duplicate lines (sed version of sort | uniq)
sed '$!N; /^\(.*\)\n\1$/!P; D' file.txt  # Remove consecutive duplicate lines

# Concatenate files (with separator)
sed -e '$a\---' file1.txt file2.txt file3.txt  # Add --- at the end of each file

# Insert blank lines (add a blank line after each line)
sed 'G' file.txt                       # Insert a blank line after each line
sed 'G;G' file.txt                     # Insert 2 blank lines after each line

# Insert a blank line every N lines
sed '0~5 a\\' file.txt                 # Every 5 lines (GNU sed)
```

### 8.6 Data Conversion Patterns

```bash
# Simple conversion from JSON to CSV
sed -n 's/.*"name": "\(.*\)".*/\1/p' data.json
# → Extract the value of the name field from JSON

# Process key=value format
sed 's/\(.*\)=\(.*\)/export \1="\2"/' file.env  # Convert .env to export statements
sed 's/\(.*\)=\(.*\)/\1: \2/' file.env           # Convert to YAML format

# Generate SQL
sed "s/.*/INSERT INTO users (name) VALUES ('&');/" names.txt
# → Generate an INSERT statement from each line

# Generate shell commands
sed 's|.*|cp & /backup/&|' filelist.txt   # Generate copy commands
sed 's|.*|rm "&"|' filelist.txt            # Generate delete commands (for review)

# Generate URLs from hostnames
sed 's|.*|https://&/api/health|' hosts.txt
```

---

## 9. Advanced Techniques

### 9.1 Multi-line Processing

```bash
# N command: Append the next line to the pattern space (joined with \n)
# P command: Print the first line of the pattern space
# D command: Delete the first line of the pattern space

# Combine 2 lines into 1
sed 'N;s/\n/ /' file.txt

# Change the line following a specific pattern
sed '/^HEADER/{n;s/.*/MODIFIED/;}' file.txt
# → Change the line following HEADER to MODIFIED

# Delete lines between patterns
sed '/START/,/END/{/START/!{/END/!d}}' file.txt
# → Keep the START and END lines, but delete the lines in between

# Multi-line pattern matching
sed -n '/BEGIN/{:a;N;/END/!ba;p}' file.txt
# → Display the BEGIN...END block

# Remove consecutive duplicate lines
sed '$!N; /^\(.*\)\n\1$/!P; D' file.txt
```

### 9.2 Branches and Labels

```bash
# sed has a branching (conditional) feature
# :label  Define a label
# b label Jump to the label
# t label Jump if the preceding s command succeeded

# Replace only the first match (using b)
sed '/pattern/{s/pattern/replacement/;b};' file.txt

# Loop until a substitution succeeds
sed ':loop; s/  / /; t loop' file.txt
# → Reduce consecutive spaces to a single space (recursively)

# Conditional processing
sed '/^#/{s/#//;b end}; s/^/> /; :end' file.txt
# → Remove # from comment lines; add > to the start of all other lines

# Collapse all consecutive whitespace into a single space
sed -E ':a;s/  / /;ta' file.txt
```

### 9.3 Reading and Writing (r / w)

```bash
# r command: Read and insert the contents of a file
sed '/INSERT_HERE/r header.txt' file.txt
# → Insert the contents of header.txt after INSERT_HERE

# w command: Write matched lines to a file
sed -n '/error/w errors.log' file.txt
# → Write lines containing error to errors.log

sed -n '/WARN/w warnings.log; /ERROR/w errors.log' file.txt
# → Distribute logs by level

# Conditional file splitting
sed -n '/^[A-M]/w am.txt; /^[N-Z]/w nz.txt' names.txt
# → Split lines starting with A-M and N-Z into separate files
```

---

## 10. One-Liner Collection (Frequently Used in Practice)

### 10.1 Text Formatting

```bash
# Remove leading and trailing whitespace from each line

# Collapse consecutive whitespace into a single space

# Delete all blank lines
sed '/^$/d' file.txt

# Collapse consecutive blank lines into one
sed '/^$/N;/^\n$/d' file.txt

# Convert DOS line endings to Unix line endings
sed 's/\r$//' file.txt

# Add a comma at the end of each line (except the last)
sed '$!s/$/, /' file.txt

# Add a line at the start of a file
sed '1i\# This file is auto-generated' file.txt

# Add a line at the end of a file
sed '$a\# End of file' file.txt
```

### 10.2 Data Processing

```bash
# Extract a specific CSV column (simplified - does not handle commas inside quotes)
sed -E 's/^([^,]*),([^,]*),(.*)$/\1/' data.csv  # 1st column
sed -E 's/^([^,]*),([^,]*),(.*)$/\2/' data.csv  # 2nd column

# Extract only the value from key=value
sed 's/^[^=]*=//' config.ini

# Extract only the key from key=value
sed 's/=.*//' config.ini

# Insert text before and after a specific line
sed '/MARKER/i\--- Before ---' file.txt
sed '/MARKER/a\--- After ---' file.txt

# Merge odd and even lines
sed 'N;s/\n/,/' file.txt              # Replace newline with comma

# Extract a value from an XML tag (simplified)
sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p' file.xml

# Extract the domain part of an email address
sed -E 's/.*@//' emails.txt

# Extract a domain from a URL
sed -E 's|https?://([^/]+).*|\1|' urls.txt
```

### 10.3 File Operation Support

```bash
# Generate file rename commands
ls *.jpg | sed 's/\(.*\)\.jpg/mv "\1.jpg" "\1.png"/'
# → Generate commands like: mv "file1.jpg" "file1.png"
# After reviewing, execute with | sh

# Generate batch processing commands
ls *.csv | sed 's/.*/python process.py "&"/'
# → Generate: python process.py "file.csv"

# Assist in generating .gitignore
find . -name "*.pyc" -printf "%h\n" | sort -u | sed 's|^\./||;s|$|/*.pyc|'
```

---

## 11. Troubleshooting

### 11.1 Common Problems and Solutions

```bash
# Problem: The -i option differs between macOS and Linux
# Solution: Always specify a backup extension
sed -i.bak 's/old/new/g' file.txt    # Works on both
rm file.txt.bak                       # Delete the backup

# Problem: Escaping special characters (/, &, \)
# / can be changed by using a different delimiter, or escaped as \/
sed 's|/usr/bin|/opt/bin|g' file.txt  # Change delimiter to |
sed 's/\/usr\/bin/\/opt\/bin/g' file.txt  # Escaped (hard to read)

# & refers to the entire match in the replacement, use \& for a literal &
sed 's/AT/AT\&T/g' file.txt           # AT → AT&T

# \ is escaped as \\
sed 's/\\/\//g' file.txt              # Replace backslash with slash

# Problem: sed commands that include variables
# Solution: Use double quotes, and escape special characters
NEW_VALUE="production"
sed -i "s/environment=.*/environment=$NEW_VALUE/" config.ini

# When a variable contains /
NEW_PATH="/usr/local/bin"
sed -i "s|old_path|$NEW_PATH|g" config.ini    # Change delimiter to |

# Problem: Substitution involving newlines
# GNU sed
sed -i 's/pattern/line1\nline2/' file.txt
# BSD sed (macOS)
sed -i '' $'s/pattern/line1\\\nline2/' file.txt

# Problem: No substitution occurring (forgetting to escape)
# Special regex metacharacters must be escaped to be used as literals
sed 's/file\.txt/file.log/' file.txt   # . as a literal
sed 's/\[error\]/[warning]/' file.txt  # [] as a literal
sed 's/\$HOME/\/home\/user/' file.txt  # $ as a literal
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement error handling appropriately
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

# Test
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

### Exercise 2: Applied Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Applied patterns
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology selections.

| Criteria | Prioritize when | Can compromise when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. What is the deployment frequency?           │
│    ├─ Weekly or less → Monolith + module split  │
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

**1. Short-term vs. Long-term costs**
- A method that is fast in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay a project

**2. Consistency vs. Flexibility**
- A unified technology stack has a lower learning cost
- Adopting diverse technologies allows for the best tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction increases reusability but can make debugging difficult
- Low abstraction is intuitive but tends to lead to code duplication

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
        """Describe the background and challenges"""
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
        md += f"## Context\n{self.context}\n\n"
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

- [ ] Is the naming convention consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Is the documentation updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Audience | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (design records) | As needed | Future members | Transparency of decisions |
| Retrospectives | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Key designs | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │ Plan│ Act │
    │ ned │ imm.│
    │     │     │
    ├─────┼─────┤
    │ Just│ Next│
    │ log │ Spr.│
    │     │     │
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
| Authentication weaknesses | High | Multi-factor authentication, session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, least privilege principle | Configuration scan |
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
- [ ] Dependency vulnerability scanning has been performed
- [ ] Error messages do not contain internal information
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just from theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Command | Purpose | Example |
|---------|------|------|
| s/old/new/g | Substitution | sed 's/foo/bar/g' |
| /pattern/d | Delete a line | sed '/^#/d' |
| -n 'Np' | Display specific line | sed -n '10,20p' |
| -i | Overwrite file directly | sed -i 's/old/new/g' |
| Ni\text | Insert before line N | sed '1i\header' |
| Na\text | Append after line N | sed '$a\footer' |
| /pat/,/pat/ | Pattern range | sed '/BEGIN/,/END/d' |
| -E | Extended regex | sed -E 's/(a|b)/c/g' |
| -e | Multiple commands | sed -e 's/a/b/' -e 's/c/d/' |
| -f | Script file | sed -f script.sed |
| \1, \2 | Backreferences | sed -E 's/(.*)/[\1]/' |
| & | Reference entire match | sed 's/word/[&]/' |
| \U, \L | Upper/lowercase conversion | sed 's/.*/\U&/' |

---

## 13. Integration Patterns: sed with Other Tools

### 13.1 grep + sed Pipeline

```bash
# Use grep to narrow down targets, then sed to transform
# Extract error lines from a log file and format the timestamp
grep "ERROR" /var/log/app.log | sed -E 's/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})/\1\/\2\/\3 \4:\5:\6/'

# Extract non-comment lines from a config file and convert values
grep -v '^#' config.ini | sed 's/=/ → /'

# Transform only lines matching a specific pattern
grep -n "TODO" *.py | sed -E 's/^([^:]+):([0-9]+):/File: \1, Line: \2 → /'

# Convert grep results to CSV format
grep -rn "FIXME\|TODO\|HACK" src/ | sed -E 's/^([^:]+):([0-9]+):(.*)/"\1",\2,"\3"/'

# Generate count data from access logs by status code
grep "HTTP/1.1" access.log | sed -E 's/.*" ([0-9]{3}) .*/\1/' | sort | uniq -c | sort -rn
```

### 13.2 find + sed Combination

```bash
# Batch-change import paths in all Python files
find . -name "*.py" -exec sed -i 's/from old_module/from new_module/g' {} +

# Batch-change encoding declarations in HTML files
find . -name "*.html" -exec sed -i 's/charset=EUC-JP/charset=UTF-8/g' {} +

# Change settings while creating backup files
find /etc/nginx/sites-available/ -name "*.conf" \
  -exec sed -i.bak 's/listen 80/listen 8080/g' {} \;

# Show a list of modified files
find . -name "*.bak" -newer /tmp/timestamp -exec echo "Modified: {}" \;

# Remove sensitive information from log files over a certain size
find /var/log -name "*.log" -size +1M \
  -exec sed -i -E 's/[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}/XXXX-XXXX-XXXX-XXXX/g' {} +

# Target only files tracked by Git
git ls-files '*.js' | xargs sed -i 's/console\.log/logger.debug/g'
```

### 13.3 Dividing Roles Between sed + awk

```bash
# Preprocess with sed, then aggregate with awk
# Normalize timestamps in a log file, then aggregate by hour
sed -E 's/^.*\[([0-9]{2})\/[A-Z][a-z]+\/[0-9]{4}:([0-9]{2}):.*/\1 \2/' access.log \
  | awk '{count[$2]++} END {for (h in count) print h, count[h]}' | sort -n

# CSV preprocessing (sed) + calculation (awk)
sed 's/"//g; s/,/ /g' data.csv | awk '{sum += $3} END {print "Total:", sum}'

# Data cleansing with sed, report generation with awk
  | awk -F' ' '{
      category[$1] += $2
      count[$1]++
    }
    END {
      for (c in category)
        printf "%-20s avg=%.2f total=%d count=%d\n", c, category[c]/count[c], category[c], count[c]
    }'
```

### 13.4 xargs + sed Batch Processing

```bash
# Receive a file list and process in bulk
cat file_list.txt | xargs -I{} sed -i 's/old_api/new_api/g' {}

# Speed up with parallel processing
cat file_list.txt | xargs -P4 -I{} sed -i 's/old_api/new_api/g' {}

# Identify target files with grep, then batch-change with sed
grep -rl "deprecated_function" src/ | xargs sed -i 's/deprecated_function/new_function/g'

# Preview before changing (dry-run approach)
grep -rl "deprecated_function" src/ | xargs -I{} sh -c 'echo "=== {} ==="; sed -n "s/deprecated_function/new_function/gp" {}'
```

---

## 14. sed Performance Tuning

### 14.1 Speed-up Techniques

```bash
# Skip unnecessary processing
# Use addresses to narrow down target lines (avoid full-file scans)
sed '1,100s/old/new/g' huge_file.txt          # Process only the first 100 lines
sed '/pattern/s/old/new/g' huge_file.txt       # Only lines matching a pattern

# Use -n + p to output only matched lines (suppress output of all lines)
sed -n '/ERROR/p' huge.log                     # Slower than grep, but can transform simultaneously

# Early exit (q command)
sed '100q' huge_file.txt                       # Exit after line 100 (equivalent to head -100)
sed '/FOUND/{ p; q; }' huge_file.txt           # Exit on the first match

# Using -f (script file) is more efficient than multiple -e options
# When there are many replacement rules
cat > rules.sed << 'RULES'
s/foo/bar/g
s/baz/qux/g
s/old/new/g
RULES
sed -f rules.sed input.txt

# Optimize regular expressions
# Avoid greedy matches like .*?
sed 's/[^,]*/REPLACED/' file.csv               # [^,]* is faster than .*

# GNU sed's --unbuffered option (real-time output)
tail -f app.log | sed --unbuffered 's/ERROR/*** ERROR ***/'
```

### 14.2 Strategies for Processing Large Numbers of Files

```bash
# Split a file and process in parallel
split -l 100000 huge_file.txt chunk_
for f in chunk_*; do
  sed -i 's/old/new/g' "$f" &
done
wait
cat chunk_* > result.txt
rm chunk_*

# Use GNU parallel
parallel --pipe sed 's/old/new/g' < huge_file.txt > result.txt

# Consider memory usage
# sed is memory-efficient because it processes one line at a time
# However, be careful when buffering multiple lines with N or H commands
# Do not accumulate all lines in the hold space for huge files

# Safe replacement using a tmpfile (instead of -i)
sed 's/old/new/g' input.txt > tmp_output.txt && mv tmp_output.txt input.txt

# Check whether a change was made
if sed 's/old/new/g' input.txt | diff -q input.txt - > /dev/null 2>&1; then
  echo "No changes needed"
else
  sed -i 's/old/new/g' input.txt
  echo "File updated"
fi
```

---

## 15. sed Security and Best Practices

### 15.1 Security Precautions

```bash
# Sanitizing input (when passing user input to sed)
# Dangerous: using user input directly in a sed pattern
user_input="malicious/e touch /tmp/pwned"
sed "s/$user_input/replacement/" file.txt      # Dangerous!

# Safe: escape special characters
sanitized=$(printf '%s\n' "$user_input" | sed 's/[&/\]/\\&/g')
sed "s/$sanitized/replacement/" file.txt

# A safer approach: using variables in sed
search="user.input"
replace="safe.output"
sed "s/$(printf '%s' "$search" | sed 's/[.[\*^$/]/\\&/g')/$(printf '%s' "$replace" | sed 's/[&/\]/\\&/g')/g" file.txt

# Masking passwords and tokens
sed -E 's/(password|token|secret|api_key)=.*/\1=***REDACTED***/gi' config.txt
sed -E 's/Bearer [A-Za-z0-9+\/=]+/Bearer ***REDACTED***/g' api.log

# Masking email addresses
sed -E 's/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/***@***.***/' data.txt

# Anonymizing IP addresses
sed -E 's/([0-9]{1,3}\.)[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/\1xxx.xxx.xxx/g' access.log
```

### 15.2 Best Practices

```bash
# 1. Always take a backup
sed -i.bak 's/old/new/g' important_file.txt
# Verify the backup after processing
diff important_file.txt important_file.txt.bak

# 2. Preview before making changes
sed 's/old/new/g' file.txt | head -20           # Check the first 20 lines
sed -n 's/old/new/gp' file.txt                   # Show only lines with changes
diff <(cat file.txt) <(sed 's/old/new/g' file.txt) # Check the diff

# 3. Process in stages
# For complex transformations, do not process all at once; use pipes to stage the work
cat input.txt \
  | sed 's/step1/result1/g' \
  | sed 's/step2/result2/g' \
  | sed 's/step3/result3/g' \
  > output.txt

# 4. Use a commented script file
cat > transform.sed << 'EOF'
# Normalize headers
1,5s/OLD_HEADER/NEW_HEADER/

# Remove blank lines

# Unify comment style (// → #)
s|//\(.*\)|#\1|

# Remove trailing whitespace
EOF
sed -f transform.sed input.txt > output.txt

# 5. Error handling
if ! sed -i 's/old/new/g' file.txt 2>/dev/null; then
  echo "Error: sed command failed" >&2
  exit 1
fi

# 6. Write portable code
# Compatible with both macOS and Linux
if sed --version 2>/dev/null | grep -q 'GNU'; then
  SED_I="sed -i"
else
  SED_I="sed -i ''"
fi
eval "$SED_I 's/old/new/g' file.txt"
```

---

## 16. Comprehensive sed Recipes by Real-World Scenario

### 16.1 Using sed in Web Application Development

```bash
# Replace placeholders in HTML templates
sed -e "s/{{APP_NAME}}/$APP_NAME/g" \
    -e "s/{{VERSION}}/$VERSION/g" \
    -e "s/{{BUILD_DATE}}/$(date +%Y-%m-%d)/g" \
    template.html > index.html

# CSS minification (simplified)
sed -E '
  s/\/\*[^*]*\*\///g          # Remove comments
  s/ *([{};:,]) */\1/g       # Remove whitespace around selectors
  /^$/d                       # Remove blank lines
' style.css > style.min.css

# Remove debug code from JavaScript for production
sed -E '/console\.(log|debug|warn|info|trace)\(/d; /debugger;/d' app.js > app.prod.js

# Expand environment variables into a config file
sed -E "
  s|\\\$\{DB_HOST\}|${DB_HOST:-localhost}|g
  s|\\\$\{DB_PORT\}|${DB_PORT:-5432}|g
  s|\\\$\{DB_NAME\}|${DB_NAME:-myapp}|g
  s|\\\$\{DB_USER\}|${DB_USER:-admin}|g
" config.template > config.production

# Batch-change URL protocol (http → https)
sed -E 's|http://([^"'"'"'[:space:]]+)|https://\1|g' page.html > page_secure.html
```

### 16.2 Using sed in Server Operations

```bash
# Batch-change port numbers in nginx config
  /etc/nginx/sites-available/default > /tmp/nginx_new.conf

# Generate Apache .htaccess
sed -n '
  /^RewriteRule/p
  /^RewriteCond/p
' .htaccess.template | sed '
  s/DOMAIN_NAME/example.com/g
  s/DOC_ROOT/\/var\/www\/html/g
' > .htaccess

# Batch-change times in crontab entries
crontab -l | sed -E 's/^([0-9]+) ([0-9]+)/\1 3/' | crontab -

# Format and filter syslog
sed -E '
  /^$/d                                  # Remove blank lines
  s/^([A-Z][a-z]{2} +[0-9]+ [0-9:]+) ([^ ]+) ([^:]+): (.*)/\1 | \2 | \3 | \4/
' /var/log/syslog | tail -50

# Extract SSL certificate information
openssl x509 -in cert.pem -text | sed -n '
  /Subject:/p
  /Issuer:/p
  /Not Before/p
  /Not After/p
  /DNS:/p
'

# Manage /etc/hosts
# Add a specific domain
sed -i '/^# Custom entries/a\192.168.1.100 myapp.local' /etc/hosts

# Temporarily comment out an entry
sed -i 's/^\(192\.168\.1\.100.*\)/#\1/' /etc/hosts

# Uncomment the entry
sed -i 's/^#\(192\.168\.1\.100.*\)/\1/' /etc/hosts
```

### 16.3 Data Transformation and ETL Processing

```bash
# Convert JSON Lines to CSV (simplified, when jq is unavailable)
sed -E '
  s/^\{//
  s/\}$//
  s/"[^"]+": *//g
  s/,/\t/g
  s/"//g
' data.jsonl > data.tsv

# Convert fixed-width records to CSV
# Name(20) Age(3) City(15)
sed -E 's/^(.{20})(.{3})(.{15})$/"\1","\2","\3"/' fixed_width.txt \
  | sed 's/  *"/"/g'  # Remove trailing whitespace within fields

# Convert XML tags
sed -E '
  s/<([a-z_]+)>([^<]*)<\/\1>/\1=\2/g    # Convert simple tags to key=value
  s/<[^>]+>//g                            # Remove remaining tags
' data.xml

# Date format conversion
# MM/DD/YYYY → YYYY-MM-DD
sed -E 's|([0-9]{2})/([0-9]{2})/([0-9]{4})|\3-\1-\2|g' dates.txt

# YYYY年MM月DD日 → YYYY-MM-DD
sed -E 's/([0-9]{4})年([0-9]{1,2})月([0-9]{1,2})日/\1-\2-\3/g' japanese_dates.txt

# Unify phone number format
sed -E 's/0([0-9]{1,4})-([0-9]{1,4})-([0-9]{4})/0\1\2\3/g' phones.txt  # Remove hyphens
sed -E 's/^0([0-9]{2})([0-9]{4})([0-9]{4})$/0\1-\2-\3/' phones.txt      # Add hyphens

# Preprocessing related to character encoding
# Remove BOM (Byte Order Mark)
sed -i '1s/^\xEF\xBB\xBF//' utf8_with_bom.txt
# Windows line endings (CRLF → LF)
sed -i 's/\r$//' windows_file.txt
# Remove ^M from DOS files
sed -i 's/\r//g' dos_file.txt
```

### 16.4 Using sed in CI/CD Pipelines

```bash
# Automatic version number update
# Update the version in package.json
sed -i -E 's/"version": "[0-9]+\.[0-9]+\.[0-9]+"/"version": "'"$NEW_VERSION"'"/' package.json

# Add an entry to CHANGELOG
sed -i "/^## \[Unreleased\]/a\\
\\
## [$NEW_VERSION] - $(date +%Y-%m-%d)\\
### Changed\\
- $CHANGE_DESCRIPTION" CHANGELOG.md

# Update the FROM image tag in a Dockerfile
sed -i "s|^FROM node:.*|FROM node:${NODE_VERSION}-alpine|" Dockerfile

# Update the image tag in a Kubernetes manifest
sed -i "s|image: myregistry/myapp:.*|image: myregistry/myapp:${GIT_SHA}|" k8s/deployment.yaml

# Format test results
sed -E '
  s/PASS/✅ PASS/g
  s/FAIL/❌ FAIL/g
  s/SKIP/⏭️  SKIP/g
  s/([0-9]+) passing/\1 tests passing/
  s/([0-9]+) failing/\1 tests FAILING/
' test_results.txt

# Embed build information
sed -e "s/@GIT_COMMIT@/$(git rev-parse --short HEAD)/" \
    -e "s/@BUILD_TIME@/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" \
    -e "s/@BRANCH@/$(git branch --show-current)/" \
    version.template > version.txt
```

---

## What to Read Next

---

## References
1. Robbins, A. "sed & awk." 2nd Ed, O'Reilly, 1997.
2. Barrett, D. "Efficient Linux at the Command Line." Ch.5, O'Reilly, 2022.
3. GNU sed Manual. https://www.gnu.org/software/sed/manual/
4. Grymoire sed Tutorial. https://www.grymoire.com/Unix/Sed.html
5. sed One-Liners Explained. https://catonmat.net/sed-one-liners-explained-part-one
