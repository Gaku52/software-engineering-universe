# Sorting and Aggregation (sort, uniq, cut, wc)

> These commands are used as "building blocks" combined in pipelines.
> They form the foundation of text processing and are indispensable tools for log analysis, data aggregation, and report generation.

## What You Will Learn

- [ ] Master all sort options to sort text
- [ ] Use uniq for deduplication, counting, and filtering
- [ ] Use cut to extract columns and fields
- [ ] Use wc to count lines, words, bytes, and characters
- [ ] Use tr to convert, delete, and squeeze characters
- [ ] Use paste, join, and comm to merge and compare multiple files
- [ ] Build practical pipelines that combine these tools

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Text Processing Languages (awk)](./03-awk.md)

---

## 1. sort — Sorting Text

### 1.1 Basic Sorting

```bash
# Alphabetical (lexicographic) sort
sort file.txt

# Numeric sort (-n)
sort -n numbers.txt
# Example: "1", "2", "10" are correctly ordered as 1, 2, 10
# Without -n, the result is "1", "10", "2" (lexicographic order)

# Reverse sort (-r)
sort -r file.txt                 # Reverse alphabetical
sort -rn numbers.txt             # Largest numbers first

# Sort with deduplication (-u)
sort -u file.txt                 # Sort + remove duplicate lines

# Stable sort (--stable)
sort --stable file.txt
# Preserves the original order of lines with the same key

# Case-insensitive sort (-f / --ignore-case)
sort -f file.txt

# Sort ignoring leading blanks (-b)
sort -b file.txt
```

### 1.2 Key-Based Sorting (-k option)

```bash
# Basic syntax: -k FIELD[.CHAR][,FIELD[.CHAR]][OPTS]

# Sort by column 2 (space/tab delimited)
sort -k2 file.txt

# Numeric sort by column 2
sort -k2,2n file.txt
# Meaning of -k2,2n: compare the range from column 2 to column 2 numerically

# Reverse numeric sort by column 3
sort -k3,3rn file.txt

# Multiple keys (primary: column 2 numerically, secondary: column 1 lexicographically)
sort -k2,2n -k1,1 file.txt

# Sort starting at the 3rd character of column 2
sort -k2.3 file.txt

# Example: sort /etc/passwd by UID
sort -t':' -k3,3n /etc/passwd

# Example: sort ls -l output by file size
ls -l | sort -k5,5n

# Example: sort CSV by column 2, then column 3 descending on ties
sort -t',' -k2,2 -k3,3rn data.csv
```

### 1.3 Specifying a Delimiter (-t option)

```bash
# Default delimiter: whitespace (space or tab)

# CSV (comma-delimited)
sort -t',' -k3 data.csv           # Sort by column 3
sort -t',' -k2,2n data.csv        # Numeric sort by column 2

# TSV (tab-delimited)
sort -t$'\t' -k2 data.tsv

# Colon-delimited (/etc/passwd format)
sort -t':' -k3,3n /etc/passwd     # Sort by UID

# Pipe-delimited
sort -t'|' -k2 data.txt

# Semicolon-delimited
sort -t';' -k3 log.csv
```

### 1.4 Special Sorting

```bash
# Sort by human-readable size (-h)
# Sorts notations like 1K, 5M, 2G
du -sh /* 2>/dev/null | sort -h
du -sh /var/log/* 2>/dev/null | sort -rh | head -10

# Version number sort (-V)
echo -e "1.2.3\n1.10.1\n1.2.10\n1.1.0" | sort -V
# Result: 1.1.0, 1.2.3, 1.2.10, 1.10.1

# Sort by month name (-M)
echo -e "Mar\nJan\nDec\nFeb" | sort -M
# Result: Jan, Feb, Mar, Dec

# Random order (-R)
sort -R file.txt                  # Random shuffle
shuf file.txt                     # Equivalent (GNU coreutils)

# Null-terminated (-z / --zero-terminated)
find . -name "*.txt" -print0 | sort -z | xargs -0 ls -la
```

### 1.5 Performance and Large Files

```bash
# Specify temporary directory (-T)
sort -T /tmp/sort_workspace large_file.txt
# Useful when the default /tmp does not have enough free space

# Parallel sort (--parallel=N)
sort --parallel=4 large_file.txt
# Leverage CPU cores for faster sorting

# Specify memory buffer size (-S)
sort -S 2G large_file.txt
# Use up to 2GB of memory (speeds up large files)

# Merge already-sorted files (-m)
sort -m sorted1.txt sorted2.txt sorted3.txt
# Efficiently merges files that are already sorted

# Check if sorted (-c / -C)
sort -c file.txt                  # Print error if not sorted
sort -C file.txt                  # Exit code 1 if not sorted (no output)
if sort -C file.txt; then
    echo "File is sorted"
else
    echo "File is not sorted"
fi

# Specify output file (-o)
sort -o sorted.txt file.txt       # Safe even if input and output share the same name
# Note: sort file.txt > file.txt will erase the content!
```

### 1.6 Practical Option Combinations for sort

```bash
# Show top 10 directories by human-readable size in descending order
du -sh /var/log/* 2>/dev/null | sort -rh | head -10

# Count by response code in access log (sorting part)
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# Count users per shell in /etc/passwd
awk -F: '{print $7}' /etc/passwd | sort | uniq -c | sort -rn

# Top processes by memory usage (ps + sort)
ps aux --sort=-%mem | head -20

# Multi-key sort for CSV (primary: department, secondary: revenue descending)
sort -t',' -k1,1 -k3,3rn sales.csv

# Sort IP addresses (using version sort)
sort -t. -k1,1n -k2,2n -k3,3n -k4,4n ip_list.txt
# Or
sort -V ip_list.txt

# Sort by date (when YYYY-MM-DD format is at the start)
sort -k1,1 dated_log.txt

# Sort timestamped logs
sort -t' ' -k1,1 -k2,2 timestamped.log
```

---

## 2. uniq — Processing Duplicate Lines

### 2.1 Basic Operations

```bash
# Important: uniq only processes "consecutive" duplicate lines
# → Always use together with sort

# Basic deduplication
sort file.txt | uniq

# Count duplicates (-c)
sort file.txt | uniq -c
# Example output:
#       3 apple
#       1 banana
#       5 cherry

# Show only duplicate lines (-d)
sort file.txt | uniq -d

# Show only unique lines (-u)
sort file.txt | uniq -u

# Show all duplicate lines (-D)
sort file.txt | uniq -D
# -d shows one representative line per duplicate group; -D shows all duplicate lines
```

### 2.2 Customizing Comparison

```bash
# Ignore the first N fields (-f N)
sort file.txt | uniq -f 1        # Compare ignoring the first field
# Fields are delimited by spaces/tabs

# Ignore the first N characters (-s N)
sort file.txt | uniq -s 5        # Compare ignoring the first 5 characters

# Compare only the first N characters (-w N)
sort file.txt | uniq -w 10       # Compare only the first 10 characters

# Case-insensitive comparison (-i)
sort -f file.txt | uniq -i

# Combination example: detect duplicate lines ignoring leading timestamps
sort -k2 log.txt | uniq -f 1 -c | sort -rn
```

### 2.3 Classic Pattern: Frequency Ranking

```bash
# Sort by frequency, highest first (most commonly used pattern)
sort file.txt | uniq -c | sort -rn

# Practical example: IP address frequency ranking in access log
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -20

# Practical example: error message frequency ranking
grep "ERROR" app.log | awk -F'ERROR' '{print $2}' | sort | uniq -c | sort -rn | head -10

# Practical example: command history usage frequency
history | awk '{print $2}' | sort | uniq -c | sort -rn | head -20

# Practical example: HTTP status code aggregation
awk '{print $9}' access.log | sort | uniq -c | sort -rn
# Example output:
#   45231 200
#    3421 301
#    1205 404
#     342 500

# Practical example: file extension aggregation
find . -type f -name "*.*" | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -15

# Practical example: shell types and user counts in /etc/passwd
awk -F: '{print $7}' /etc/passwd | sort | uniq -c | sort -rn

# Practical example: Git commit author aggregation
git log --format='%an' | sort | uniq -c | sort -rn

# Practical example: check for duplicate source port numbers
ss -tn | awk '{print $4}' | rev | cut -d: -f1 | rev | sort | uniq -c | sort -rn | head -10
```

---

## 3. cut — Extracting Columns

### 3.1 Field-Based Extraction (-f / -d)

```bash
# Basic syntax: cut -d'delimiter' -f'field number' file

# Get column 2 of a CSV
cut -d',' -f2 data.csv

# Columns 1 and 3 of colon-delimited data
cut -d':' -f1,3 /etc/passwd

# Columns 1-3 of tab-delimited data (default)
cut -f1-3 data.tsv

# Get all columns from column 3 onward
cut -d',' -f3- data.csv

# Get up to column 4
cut -d',' -f-4 data.csv

# Get all columns except column 2 (--complement)
cut -d',' -f2 --complement data.csv

# Pipe-delimited
echo "a|b|c|d" | cut -d'|' -f2,4
# Output: b|d

# Space-delimited
echo "hello world foo bar" | cut -d' ' -f2
# Output: world

# Change output delimiter (--output-delimiter)
cut -d':' -f1,3,7 /etc/passwd --output-delimiter=','
# Example output: root,0,/bin/bash
```

### 3.2 Character-Based Extraction (-c)

```bash
# Get characters 1-10
cut -c1-10 file.txt

# Only character 5
cut -c5 file.txt

# Characters 1, 5, and 10
cut -c1,5,10 file.txt

# From character 20 onward
cut -c20- file.txt

# First 50 characters (truncate long lines)
cut -c-50 file.txt

# Practical example: parsing fixed-width format
# Such as the Japanese bank data format (Zengin)
cut -c1-2 fixedwidth.dat       # Record type
cut -c3-6 fixedwidth.dat       # Bank code
cut -c7-9 fixedwidth.dat       # Branch code
```

### 3.3 Byte-Based Extraction (-b)

```bash
# Byte-based (caution needed in multibyte character environments)
cut -b1-10 file.txt

# Difference between character-based and byte-based
echo "日本語テスト" | cut -c1-3   # "日本語" (character-based)
echo "日本語テスト" | cut -b1-9   # "日本語" (3 bytes per character in UTF-8)
```

### 3.4 Limitations of cut and Alternatives

```bash
# Limitations of cut:
# 1. Cannot treat consecutive delimiters as one
# 2. Regular expressions are not supported
# 3. Cannot handle complex field processing

# Problem with consecutive spaces
echo "a  b  c" | cut -d' ' -f2
# Output: "" (empty string) ← treats up to the second space as one field

# Solution 1: compress consecutive spaces with tr -s
echo "a  b  c" | tr -s ' ' | cut -d' ' -f2
# Output: b

# Solution 2: use awk (recommended)
echo "a  b  c" | awk '{print $2}'
# Output: b

# Solution 3: use read
echo "a  b  c" | while read a b c; do echo "$b"; done
# Output: b

# Use awk for complex field processing
# Example: get the last field
echo "a,b,c,d" | awk -F',' '{print $NF}'
# Output: d (with cut, you need to know the number of fields in advance)
```

---

## 4. wc — Counting

### 4.1 Basic Counting

```bash
# Line count (-l)
wc -l file.txt
# Example output: 42 file.txt

# Word count (-w)
wc -w file.txt
# Example output: 350 file.txt

# Byte count (-c)
wc -c file.txt
# Example output: 2048 file.txt

# Character count (-m)
wc -m file.txt
# -c and -m may differ in multibyte character environments

# Length of longest line (-L)
wc -L file.txt
# Example output: 120 file.txt

# Show all
wc file.txt
# Example output:  42  350 2048 file.txt
#                 lines words bytes filename

# Multiple files
wc -l *.txt
# Shows line count per file + total
```

### 4.2 Combining with Pipes

```bash
# Count files
find . -name "*.py" | wc -l
find . -type f | wc -l

# Count processes
ps aux | grep nginx | grep -v grep | wc -l
# pgrep is smarter
pgrep -c nginx

# Count changed files in Git
git diff --name-only | wc -l
git status --porcelain | wc -l

# Count error lines in log
grep -c "ERROR" app.log            # grep -c gives the same result
grep "ERROR" app.log | wc -l      # Same result via pipe

# Count files in a directory
ls -1 /var/log/ | wc -l

# Count empty lines
grep -c "^$" file.txt

# Count non-empty lines
grep -c "." file.txt

# Count code lines (excluding blank lines and comments)
grep -v "^$" code.py | grep -v "^#" | wc -l

# Practical example: line count statistics for source code
find . -name "*.py" -exec wc -l {} + | tail -1
# Show total line count only

# Practical example: files sorted by line count in descending order
find . -name "*.py" -exec wc -l {} + | sort -rn | head -20
```

### 4.3 Advanced Counting Patterns

```bash
# Count occurrences of a specific character
tr -cd ',' < data.csv | wc -c
# Count the number of commas in a CSV

# Check field count per line (CSV integrity check)
awk -F',' '{print NF}' data.csv | sort | uniq -c
# Normal if all lines have the same field count

# Count word occurrences
tr -s '[:space:]' '\n' < file.txt | grep -cw "error"
# Number of occurrences of the word "error"

# Count unique lines
sort -u file.txt | wc -l

# Count duplicate lines
sort file.txt | uniq -d | wc -l

# Count NULL bytes in a binary file
tr -cd '\0' < binary_file | wc -c
```

---

## 5. tr — Character Conversion and Deletion

### 5.1 Character Conversion

```bash
# Lowercase → uppercase
echo "hello world" | tr 'a-z' 'A-Z'
# Output: HELLO WORLD

# Uppercase → lowercase
echo "HELLO WORLD" | tr 'A-Z' 'a-z'
# Output: hello world

# Using POSIX character classes
echo "Hello World" | tr '[:upper:]' '[:lower:]'
echo "hello world" | tr '[:lower:]' '[:upper:]'

# Replace specific characters
echo "2024-01-15" | tr '-' '/'
# Output: 2024/01/15

echo "a:b:c" | tr ':' '\n'
# Output:
# a
# b
# c

# Convert tabs to spaces
tr '\t' ' ' < file.txt

# Replace digits with asterisks
echo "Password: 12345" | tr '0-9' '*'
# Output: Password: *****

# ROT13 encoding (simple)
echo "Hello World" | tr 'A-Za-z' 'N-ZA-Mn-za-m'
# Output: Uryyb Jbeyq (applying the same transformation again restores the original)
```

### 5.2 Character Deletion (-d)

```bash
# Delete carriage returns (CR) (Windows → Unix conversion)
tr -d '\r' < windows.txt > unix.txt

# Delete digits
echo "abc123def456" | tr -d '0-9'
# Output: abcdef

# Delete spaces
echo "  h e l l o  " | tr -d ' '
# Output: hello

# Delete specific characters
echo "Hello, World!" | tr -d ',!'
# Output: Hello World

# Delete alphabetic characters
echo "abc123!@#def" | tr -d '[:alpha:]'
# Output: 123!@#

# Delete using complement (-cd): delete everything EXCEPT the specified characters
echo "abc123!@#def" | tr -cd '[:alpha:]'
# Output: abcdef

echo "phone: 03-1234-5678" | tr -cd '0-9'
# Output: 0312345678

# Delete non-printable characters
tr -cd '[:print:]' < binary_mixed.txt
```

### 5.3 Character Squeezing (-s / --squeeze-repeats)

```bash
# Squeeze consecutive spaces into one
echo "a   b    c" | tr -s ' '
# Output: a b c

# Squeeze consecutive newlines into one (remove blank lines)
tr -s '\n' < file.txt

# Squeeze consecutive spaces and tabs into a single space
tr -s '[:blank:]' ' ' < file.txt

# Combine conversion and squeezing
echo "  hello    world  " | tr -s ' '
# Output: " hello world "

# Practical example: normalize a whitespace-separated table
ps aux | tr -s ' ' | cut -d' ' -f1-5
```

### 5.4 Practical tr Patterns

```bash
# Convert CSV to TSV
tr ',' '\t' < data.csv > data.tsv

# Convert TSV to CSV
tr '\t' ',' < data.tsv > data.csv

# Password generation (random string)
tr -dc 'A-Za-z0-9!@#$%' < /dev/urandom | head -c 20
echo  # add newline

# Alphanumeric-only random string
tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32
echo

# Convert each line of a file into a comma-separated single line
tr '\n' ',' < file.txt | sed 's/,$/\n/'

# Text normalization (useful for preprocessing)
cat raw_text.txt | tr 'A-Z' 'a-z' | tr -s '[:space:]' '\n' | tr -d '[:punct:]' | sort | uniq -c | sort -rn

# Visualize control characters
cat -v file.txt                   # Shows ^M (CR) etc.
# Remove control characters
tr -d '[:cntrl:]' < file.txt | tr -cd '[:print:]\n'
```

---

## 6. paste — Horizontal File Merging

### 6.1 Basic Operations

```bash
# Merge two files side by side (tab-delimited)
paste file1.txt file2.txt
# Each line of file1 and each line of file2 are joined with a tab

# Specify a delimiter
paste -d',' file1.txt file2.txt  # Comma-delimited
paste -d':' file1.txt file2.txt  # Colon-delimited

# Merge three or more files
paste names.txt ages.txt cities.txt

# Arrange input horizontally (-s / --serial)
paste -s file.txt
# Converts all lines of a file into a single tab-delimited line

# Specify delimiter and join into one line
paste -sd',' file.txt
# Example output: line1,line2,line3,line4
```

### 6.2 paste Usage Patterns

```bash
# Sum a numeric file (combined with bc)
paste -sd+ numbers.txt | bc
# Joins as 1+2+3+4+5, then calculates with bc

# Sum a specific column in CSV
cut -d',' -f3 data.csv | tail -n +2 | paste -sd+ | bc

# Format standard input into N columns
seq 12 | paste - - -
# Output:
# 1     2     3
# 4     5     6
# 7     8     9
# 10    11    12

seq 12 | paste -d',' - - - -
# Output:
# 1,2,3,4
# 5,6,7,8
# 9,10,11,12

# Merge output of two commands side by side
paste <(seq 5) <(seq 5 | awk '{print $1*$1}')
# Output:
# 1     1
# 2     4
# 3     9
# 4     16
# 5     25
```

---

## 7. join — Relational File Joining

### 7.1 Basic Operations

```bash
# Prerequisite: both files must be sorted on the join key

# file1.txt:
# 001 Alice
# 002 Bob
# 003 Charlie

# file2.txt:
# 001 Engineering
# 002 Marketing
# 003 Design

# Default join (join on the first field)
join file1.txt file2.txt
# Output:
# 001 Alice Engineering
# 002 Bob Marketing
# 003 Charlie Design

# Specify join fields
join -1 2 -2 1 file_a.txt file_b.txt
# -1 2: use column 2 of file_a as the key
# -2 1: use column 1 of file_b as the key

# Specify delimiter
join -t',' file1.csv file2.csv

# Specify output format
join -o 1.1,1.2,2.2 file1.txt file2.txt
# Output column 1 of file1, column 2 of file1, column 2 of file2

# Include non-matching lines (outer join)
join -a 1 file1.txt file2.txt    # Include non-matching lines from file1 (LEFT JOIN)
join -a 2 file1.txt file2.txt    # Include non-matching lines from file2 (RIGHT JOIN)
join -a 1 -a 2 file1.txt file2.txt  # Include both (FULL OUTER JOIN)

# Specify a value for missing fields
join -a 1 -e "N/A" -o auto file1.txt file2.txt
```

---

## 8. comm — Comparing Sorted Files

### 8.1 Basic Operations

```bash
# Compare two sorted files and output 3 columns
comm file1_sorted.txt file2_sorted.txt
# Column 1: lines only in file1
# Column 2: lines only in file2
# Column 3: lines in both files

# Hide specific columns
comm -12 file1.txt file2.txt     # Common lines only (show only column 3)
comm -23 file1.txt file2.txt     # Lines only in file1
comm -13 file1.txt file2.txt     # Lines only in file2

# Practical example: differences in installed packages between two servers
comm -23 <(ssh server1 "dpkg -l | awk '{print \$2}'" | sort) \
         <(ssh server2 "dpkg -l | awk '{print \$2}'" | sort)
# Packages installed only on server1

# Practical example: compare file lists of two directories
comm -3 <(ls dir1/ | sort) <(ls dir2/ | sort)

# Practical example: differences in process lists between yesterday and today
comm -13 <(sort yesterday_processes.txt) <(sort today_processes.txt)
# Processes that appeared today for the first time
```

---

## 9. Combination Patterns (Practical Recipe Collection)

### 9.1 Log Analysis

```bash
# Top 10 IP addresses in access log
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10

# Access count by hour
awk '{print $4}' access.log | cut -c2-14 | cut -d: -f1-2 | sort | uniq -c | sort -rn
# [15/Jan/2024:10:30:00 → 15/Jan/2024:10 → group by hour

# HTTP status code aggregation
awk '{print $9}' access.log | sort | uniq -c | sort -rn
# Example output:
#   45231 200
#    3421 301
#    1205 404
#     342 500

# Top 10 error response URLs
awk '$9 >= 400 {print $7}' access.log | sort | uniq -c | sort -rn | head -10

# User-Agent aggregation
awk -F'"' '{print $6}' access.log | sort | uniq -c | sort -rn | head -10

# Number of requests in a specific time range
grep "15/Jan/2024:1[0-2]:" access.log | wc -l

# Total response size
awk '{sum += $10} END {print sum}' access.log
# Can also be done with awk alone, but also possible with cut + paste + bc:
awk '{print $10}' access.log | paste -sd+ | bc

# Requests per minute (aggregation by minute)
awk '{print $4}' access.log | cut -c2-18 | sort | uniq -c | sort -rn | head -20
```

### 9.2 System Administration

```bash
# Top 20 directories by disk usage
du -sh /var/* 2>/dev/null | sort -rh | head -20

# File count and total size by extension
find . -type f -name "*.*" | sed 's/.*\.//' | sort | uniq -c | sort -rn

# Top 10 recently updated files
find /var/log -type f -mmin -60 -exec ls -lt {} + 2>/dev/null | head -10

# Connection count by port
ss -tn state established | awk '{print $4}' | rev | cut -d: -f1 | rev | sort | uniq -c | sort -rn

# Process count by user
ps aux | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn

# Top 10 processes by memory usage (RSS-based)
ps aux --sort=-rss | head -11 | awk 'NR==1 || NR>1 {printf "%-10s %8s %8s %s\n", $1, $4, $6, $11}'

# Number of open files (by process)
lsof 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# TCP connection state aggregation
ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn
# Example output:
#   45 ESTABLISHED
#   12 TIME-WAIT
#    5 CLOSE-WAIT
#    3 LISTEN

# Count users per shell type in /etc/passwd
awk -F: '{print $7}' /etc/passwd | sort | uniq -c | sort -rn

# Number of crontab jobs (all users)
for user in $(cut -d: -f1 /etc/passwd); do
    count=$(sudo crontab -u "$user" -l 2>/dev/null | grep -v "^#" | grep -v "^$" | wc -l)
    [ "$count" -gt 0 ] && echo "$count $user"
done | sort -rn
```

### 9.3 Text Analysis

```bash
# Word frequency analysis
cat file.txt | tr -s '[:space:]' '\n' | tr 'A-Z' 'a-z' | tr -d '[:punct:]' | sort | uniq -c | sort -rn | head -20

# Distribution of line lengths
awk '{print length}' file.txt | sort -n | uniq -c
# Example output:
#    15 0    ← 15 blank lines
#    42 20   ← 42 lines with 20 characters
#   ...

# Aggregation of lines matching a specific pattern
grep -o '[A-Z][A-Z]*' file.txt | sort | uniq -c | sort -rn | head -10
# Frequency of all-uppercase words

# Check field count in CSV (data quality check)
awk -F',' '{print NF}' data.csv | sort | uniq -c
# Data is consistent if all lines have the same count

# Detect and report duplicate lines
sort data.txt | uniq -c | awk '$1 > 1 {print}'

# Common lines in two files
comm -12 <(sort file1.txt) <(sort file2.txt)

# Lines that differ between two files
comm -3 <(sort file1.txt) <(sort file2.txt)

# Blank lines vs. non-blank lines in a file
echo "Blank lines: $(grep -c '^$' file.txt)"
echo "Non-blank lines: $(grep -c '.' file.txt)"
echo "Total lines: $(wc -l < file.txt)"
```

### 9.4 Development and Code Analysis

```bash
# Line count statistics for source code
find . -name "*.py" -exec wc -l {} + | sort -rn | head -20

# Code line count by language
for ext in py js ts go rb java; do
    count=$(find . -name "*.${ext}" -exec cat {} + 2>/dev/null | wc -l)
    [ "$count" -gt 0 ] && echo "$count $ext"
done | sort -rn

# Aggregation of TODO/FIXME/HACK comments
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.py" . | awk -F: '{print $3}' | tr -s ' ' | sort | uniq -c | sort -rn

# Import frequency (Python)
grep "^import\|^from" *.py | awk '{print $2}' | sort | uniq -c | sort -rn

# Number of function definitions (Python)
grep -c "^def " *.py | sort -t: -k2,2rn

# Most common words in Git commit messages
git log --oneline | tr -s '[:space:]' '\n' | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn | head -20

# Change frequency per file (Git)
git log --name-only --format="" | sort | uniq -c | sort -rn | head -20

# Lines of code by author
git log --author="Gaku" --numstat --format="" | awk '{add+=$1; del+=$2} END {print "Added:", add, "Deleted:", del}'

# List of targets in Makefile
grep "^[a-zA-Z_-]*:" Makefile | cut -d: -f1 | sort

# Number of dependency packages in package.json
cat package.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
deps = len(data.get('dependencies', {}))
dev_deps = len(data.get('devDependencies', {}))
print(f'dependencies: {deps}')
print(f'devDependencies: {dev_deps}')
print(f'total: {deps + dev_deps}')
"
```

### 9.5 CSV / Data Processing

```bash
# Check CSV headers
head -1 data.csv | tr ',' '\n' | nl
# Display each column with a number

# Sum a specific column in CSV
cut -d',' -f3 data.csv | tail -n +2 | paste -sd+ | bc

# Average of a specific column in CSV
cut -d',' -f3 data.csv | tail -n +2 | awk '{sum+=$1; count++} END {print sum/count}'

# Unique values in a specific column of CSV
cut -d',' -f2 data.csv | tail -n +2 | sort -u

# Group and aggregate a specific column in CSV
cut -d',' -f2,5 data.csv | tail -n +2 | sort -t',' -k1,1 | awk -F',' '{
    if (prev != $1 && prev != "") {
        print prev, sum
        sum = 0
    }
    prev = $1
    sum += $2
} END {print prev, sum}'

# Row count in CSV (excluding header)
tail -n +2 data.csv | wc -l

# Number of columns in CSV
head -1 data.csv | tr ',' '\n' | wc -l

# Maximum and minimum values of a specific column in CSV
cut -d',' -f3 data.csv | tail -n +2 | sort -n | head -1  # Minimum
cut -d',' -f3 data.csv | tail -n +2 | sort -rn | head -1 # Maximum

# Join two CSVs by key
join -t',' <(sort -t',' -k1,1 users.csv) <(sort -t',' -k1,1 orders.csv)

# Generate SQL INSERT statements from CSV
tail -n +2 data.csv | awk -F',' '{
    printf "INSERT INTO table_name VALUES ('\''%s'\'', '\''%s'\'', %s);\n", $1, $2, $3
}'
```

---

## 10. Script Examples

### 10.1 Access Log Analysis Script

```bash
#!/bin/bash
# access_log_analyzer.sh - Comprehensive access log analysis
# Usage: ./access_log_analyzer.sh /var/log/nginx/access.log

LOG_FILE="${1:?Usage: $0 <logfile>}"

if [ ! -f "$LOG_FILE" ]; then
    echo "Error: File not found: $LOG_FILE" >&2
    exit 1
fi

TOTAL_REQUESTS=$(wc -l < "$LOG_FILE")

echo "================================================"
echo "Access Log Analysis Report"
echo "Target file: $LOG_FILE"
echo "Total requests: $TOTAL_REQUESTS"
echo "================================================"

echo ""
echo "--- Top 10 IP Addresses ---"
awk '{print $1}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -10

echo ""
echo "--- HTTP Status Code Summary ---"
awk '{print $9}' "$LOG_FILE" | sort | uniq -c | sort -rn

echo ""
echo "--- Request Method Summary ---"
awk '{print $6}' "$LOG_FILE" | tr -d '"' | sort | uniq -c | sort -rn

echo ""
echo "--- Top 20 Request URLs ---"
awk '{print $7}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -20

echo ""
echo "--- Access Count by Hour ---"
awk '{print $4}' "$LOG_FILE" | cut -c14-15 | sort | uniq -c | sort -k2,2n

echo ""
echo "--- Top 10 404 Error URLs ---"
awk '$9 == 404 {print $7}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -10

echo ""
echo "--- Top 10 500 Error URLs ---"
awk '$9 >= 500 {print $7}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -10

echo ""
echo "--- Top 10 User-Agents ---"
awk -F'"' '{print $6}' "$LOG_FILE" | sort | uniq -c | sort -rn | head -10

echo ""
echo "--- Response Size Statistics ---"
awk '{print $10}' "$LOG_FILE" | grep -E '^[0-9]+$' | sort -n | awk '
    BEGIN { count=0; sum=0 }
    {
        a[count++] = $1
        sum += $1
    }
    END {
        if (count > 0) {
            printf "Count: %d\n", count
            printf "Total: %d bytes (%.2f MB)\n", sum, sum/1048576
            printf "Average: %.0f bytes\n", sum/count
            printf "Min: %d bytes\n", a[0]
            printf "Max: %d bytes\n", a[count-1]
            printf "Median: %d bytes\n", a[int(count/2)]
        }
    }
'

echo ""
echo "================================================"
echo "Analysis complete"
echo "================================================"
```

### 10.2 CSV Data Quality Check Script

```bash
#!/bin/bash
# csv_quality_check.sh - CSV file data quality check
# Usage: ./csv_quality_check.sh data.csv

CSV_FILE="${1:?Usage: $0 <csv_file>}"
DELIMITER="${2:-,}"

if [ ! -f "$CSV_FILE" ]; then
    echo "Error: File not found: $CSV_FILE" >&2
    exit 1
fi

TOTAL_LINES=$(wc -l < "$CSV_FILE")
DATA_LINES=$((TOTAL_LINES - 1))
HEADER=$(head -1 "$CSV_FILE")
EXPECTED_FIELDS=$(echo "$HEADER" | tr "$DELIMITER" '\n' | wc -l)

echo "================================================"
echo "CSV Data Quality Check Report"
echo "File: $CSV_FILE"
echo "================================================"

echo ""
echo "--- Basic Information ---"
echo "Total lines: $TOTAL_LINES (including header)"
echo "Data lines: $DATA_LINES"
echo "Field count (expected): $EXPECTED_FIELDS"
echo "File size: $(wc -c < "$CSV_FILE") bytes"

echo ""
echo "--- Header ---"
echo "$HEADER" | tr "$DELIMITER" '\n' | nl

echo ""
echo "--- Field Count Check ---"
FIELD_CHECK=$(awk -F"$DELIMITER" '{print NF}' "$CSV_FILE" | sort | uniq -c | sort -rn)
echo "$FIELD_CHECK"
INCONSISTENT=$(echo "$FIELD_CHECK" | wc -l)
if [ "$INCONSISTENT" -eq 1 ]; then
    echo "Result: OK (field count matches across all lines)"
else
    echo "Warning: Some lines have inconsistent field counts"
    echo "Inconsistent lines (first 5):"
    awk -F"$DELIMITER" -v expected="$EXPECTED_FIELDS" 'NF != expected {print NR": "NF" fields - "$0}' "$CSV_FILE" | head -5
fi

echo ""
echo "--- Blank Line Check ---"
EMPTY_LINES=$(grep -c "^$" "$CSV_FILE")
echo "Blank lines: $EMPTY_LINES"

echo ""
echo "--- Duplicate Row Check ---"
DUPES=$(tail -n +2 "$CSV_FILE" | sort | uniq -d | wc -l)
echo "Duplicate rows: $DUPES"
if [ "$DUPES" -gt 0 ]; then
    echo "Sample duplicate rows (first 5):"
    tail -n +2 "$CSV_FILE" | sort | uniq -d | head -5
fi

echo ""
echo "--- Statistics per Field ---"
col_num=1
echo "$HEADER" | tr "$DELIMITER" '\n' | while read -r col_name; do
    echo ""
    echo "  Field $col_num: $col_name"
    VALUES=$(cut -d"$DELIMITER" -f"$col_num" "$CSV_FILE" | tail -n +2)
    TOTAL=$(echo "$VALUES" | wc -l)
    EMPTY=$(echo "$VALUES" | grep -c "^$")
    UNIQUE=$(echo "$VALUES" | sort -u | wc -l)
    echo "    Total: $TOTAL  Empty: $EMPTY  Unique: $UNIQUE"
    echo "    Top 5 values:"
    echo "$VALUES" | sort | uniq -c | sort -rn | head -5 | sed 's/^/      /'
    col_num=$((col_num + 1))
done

echo ""
echo "================================================"
echo "Check complete"
echo "================================================"
```

### 10.3 Text Statistics Report Script

```bash
#!/bin/bash
# text_stats.sh - Text file statistics report
# Usage: ./text_stats.sh document.txt

FILE="${1:?Usage: $0 <text_file>}"

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

echo "================================================"
echo "Text Statistics Report: $FILE"
echo "================================================"

echo ""
echo "--- Basic Counts ---"
echo "Lines:      $(wc -l < "$FILE")"
echo "Words:      $(wc -w < "$FILE")"
echo "Characters: $(wc -m < "$FILE")"
echo "Bytes:      $(wc -c < "$FILE")"
echo "Longest line: $(wc -L < "$FILE") characters"

echo ""
echo "--- Line Statistics ---"
echo "Blank lines:     $(grep -c '^$' "$FILE")"
echo "Non-blank lines: $(grep -c '.' "$FILE")"
echo "Line length distribution:"
awk '{print length}' "$FILE" | sort -n | awk '
    BEGIN { min=999999; max=0; sum=0; count=0 }
    {
        if ($1 < min) min = $1
        if ($1 > max) max = $1
        sum += $1
        count++
    }
    END {
        if (count > 0) {
            printf "  Shortest: %d characters\n", min
            printf "  Longest:  %d characters\n", max
            printf "  Average:  %.1f characters\n", sum/count
        }
    }
'

echo ""
echo "--- Top 20 Word Frequency ---"
tr -s '[:space:]' '\n' < "$FILE" | tr 'A-Z' 'a-z' | tr -d '[:punct:]' | sort | uniq -c | sort -rn | head -20

echo ""
echo "--- Character Type Statistics ---"
echo "Uppercase letters: $(tr -cd 'A-Z' < "$FILE" | wc -c)"
echo "Lowercase letters: $(tr -cd 'a-z' < "$FILE" | wc -c)"
echo "Digits:            $(tr -cd '0-9' < "$FILE" | wc -c)"
echo "Whitespace:        $(tr -cd ' \t' < "$FILE" | wc -c)"
echo "Punctuation:       $(tr -cd '[:punct:]' < "$FILE" | wc -c)"

echo ""
echo "================================================"
echo "Report complete"
echo "================================================"
```

---

## 11. Performance Tips

```bash
# Notes for large files

# 1. sort may consume a large amount of memory
# Specify temporary directory and memory explicitly
sort -T /tmp/sort_work -S 4G huge_file.txt

# 2. Skip locale processing with LC_ALL=C → faster sorting
LC_ALL=C sort file.txt
# Character sort order for non-ASCII changes, but it is dramatically faster

# 3. Optimizing pipeline chains
# Bad example (process all lines before head)
sort huge.log | uniq -c | sort -rn | head -10
# Good example (extract only the needed column first)
awk '{print $1}' huge.log | sort | uniq -c | sort -rn | head -10

# 4. wc -l is very fast (only counts newline characters)
# Best for checking line counts of huge files
wc -l huge_file.txt

# 5. cut is faster than awk (for simple field extraction)
cut -d',' -f2 data.csv              # Fast
awk -F',' '{print $2}' data.csv     # Slightly slower (awk startup cost)

# 6. sort -u is more efficient than sort | uniq
sort -u file.txt                    # Fast (1 pass)
sort file.txt | uniq                # Slightly slower (2 processes)

# 7. grep -c is more efficient than grep | wc -l
grep -c "pattern" file.txt          # Fast (counting only)
grep "pattern" file.txt | wc -l     # Slightly slower (pipe overhead)

# 8. Leveraging parallel processing
# If GNU parallel is installed
find /var/log -name "*.log" | parallel "grep -c ERROR {} | xargs -I{c} echo {} {c}"
```

---

## 12. Troubleshooting

```bash
# Problem 1: sort results are not as expected
# Cause: locale settings
# Solution:
export LC_ALL=C
sort file.txt
# With C locale, sorting follows ASCII code order

# Problem 2: uniq does not detect duplicates
# Cause: uniq only processes "consecutive" duplicate lines
# Solution: always place sort before it
sort file.txt | uniq -c

# Problem 3: cut does not extract columns correctly
# Cause: consecutive delimiters
# Solution: compress consecutive delimiters with tr -s, or use awk
ps aux | tr -s ' ' | cut -d' ' -f4

# Problem 4: wc -l returns 0 (even though the file is not empty)
# Cause: the last line of the file has no newline
# Check:
tail -c 1 file.txt | xxd
# Solution: use awk
awk 'END {print NR}' file.txt

# Problem 5: numbers do not sort correctly with sort -n
# Cause: spaces or invisible characters before numbers
# Solution: preprocess with tr
tr -d '[:blank:]' < file.txt | sort -n

# Problem 6: cut -c does not work correctly with multibyte characters
# Cause: locale settings
# Solution:
export LC_ALL=ja_JP.UTF-8
cut -c1-5 japanese_text.txt

# Problem 7: sort gives "write failed: /tmp/sort...: No space left on device"
# Cause: insufficient free space in /tmp
# Solution: change the temporary directory
sort -T /home/user/tmp large_file.txt
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

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
        """Statistics information"""
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

The following summarizes criteria for making technology choices.

| Criterion | When to Prioritize | When to Compromise |
|-----------|-------------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                  │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. Deployment frequency?                       │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. Team independence?                          │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering increases short-term costs and causes project delays

**2. Consistency vs. Flexibility**
- A unified technology stack lowers learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of Abstraction**
- Higher abstraction improves reusability but can make debugging difficult
- Lower abstraction is intuitive but prone to code duplication

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

## Practical Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum required features
- Automated tests only for critical paths
- Introduce monitoring from early on

**Lessons Learned:**
- Don't over-optimize (YAGNI principle)
- Collect user feedback early
- Manage technical debt intentionally

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually renovate a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If no existing tests, create Characterization Tests first
- Coexist old and new systems with an API gateway
- Perform data migration in stages

| Phase | Work Content | Estimated Duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environments | 4-6 weeks | Low |
| 3. Migration start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission the old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Assign ownership per team
- Manage shared libraries using Inner Source model
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
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Verify SLA compliance"""
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

| Optimization Method | Effect | Implementation Cost | Use Case |
|--------------------|--------|---------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |

---

## Team Development Practices

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Is the documentation updated?

### Knowledge Sharing Best Practices

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Entire team | Horizontal knowledge sharing |
| ADR (design records) | As needed | Future members | Decision transparency |
| Retrospectives | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Key designs | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │and  │imme-│
    │addr │diat-│
    │ess  │ely  │
    ├─────┼─────┤
    │Log  │Next │
    │only │Sprint│
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
|--------------|------------|----------------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor authentication, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, principle of least privilege | Configuration scanning |
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
- [ ] Sensitive information is not output to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is properly configured
- [ ] Vulnerability scanning of dependency packages is performed
- [ ] Error messages do not contain internal information
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend fully understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently used in day-to-day development. It becomes especially important during code reviews and architecture design.

---

## Summary

| Command | Purpose | Commonly Used Options |
|---------|---------|----------------------|
| sort | Sort text | -n (numeric), -r (reverse), -k (key), -t (delimiter), -u (deduplicate), -h (human-readable) |
| uniq | Process duplicate lines | -c (count), -d (duplicates only), -u (unique only), -f (ignore fields) |
| cut | Extract columns | -d (delimiter), -f (fields), -c (character position), --complement (complement set) |
| wc | Count | -l (lines), -w (words), -c (bytes), -m (characters), -L (longest line) |
| tr | Convert/delete characters | -d (delete), -s (squeeze), -c (complement) |
| paste | Horizontal merge | -d (delimiter), -s (serialize) |
| join | Relational join | -t (delimiter), -1/-2 (key columns), -a (outer join) |
| comm | Compare sorted files | -1/-2/-3 (hide columns) |

### Standard Pipeline Patterns

```bash
# Frequency ranking
... | sort | uniq -c | sort -rn | head -N

# Extract column → sort → aggregate
cut -d',' -fN file.csv | sort | uniq -c | sort -rn

# Normalize text → word analysis
cat file.txt | tr 'A-Z' 'a-z' | tr -s '[:space:]' '\n' | sort | uniq -c | sort -rn

# Sum a CSV field
cut -d',' -fN file.csv | tail -n +2 | paste -sd+ | bc
```

---

## 13. Frequently Asked Questions (FAQ)

### Q1: What is the difference between sort, sort -u, and sort | uniq?

```bash
# sort -u: deduplicate while sorting (1 pass, fast)
sort -u file.txt

# sort | uniq: deduplicate in a separate process after sorting (2 passes)
sort file.txt | uniq

# Functional difference: counting features like uniq -c are not available with sort -u
# → Use sort | uniq -c when counting is needed
```

### Q2: How do I sort and deduplicate while ignoring case?

```bash
# Combine sort -f and uniq -i
sort -f file.txt | uniq -i -c | sort -rn

# Method using awk for preprocessing
awk '{print tolower($0)}' file.txt | sort | uniq -c | sort -rn
```

### Q3: How do I handle CSV columns that contain spaces?

```bash
# cut does not recognize quotation marks
# → Use Python's csv module or csvkit
pip install csvkit

# csvkit examples
csvcut -c 2 data.csv              # Correctly extract column 2
csvsort -c 3 data.csv             # Sort by column 3
csvgrep -c 2 -m "Tokyo" data.csv  # Rows where column 2 is "Tokyo"
csvstat data.csv                   # Statistics for all columns
```

### Q4: How do I completely eliminate locale influence in sort?

```bash
# Set the LC_ALL environment variable to C
LC_ALL=C sort file.txt

# Set persistently in a script
export LC_ALL=C
sort file.txt

# Change temporarily for a specific command only
LC_ALL=C sort file.txt
# Does not affect subsequent commands
```

### Q5: How do I merge sorted results from multiple files?

```bash
# If each file is already sorted
sort -m file1.txt file2.txt file3.txt > merged.txt

# If files are not sorted, use regular sort
sort file1.txt file2.txt file3.txt > merged.txt

# For a large number of files
find /var/log -name "*.log" -exec sort -m {} + > all_sorted.txt
```

---

## Further Reading

---

## References
1. Barrett, D. "Efficient Linux at the Command Line." Ch.5, O'Reilly, 2022.
2. Shotts, W. "The Linux Command Line." 2nd Ed, No Starch Press, 2019.
3. GNU Coreutils Manual. "sort, uniq, cut, wc, tr, paste, join, comm." gnu.org.
4. Kernighan, B. & Pike, R. "The UNIX Programming Environment." Prentice Hall, 1984.
5. Robbins, A. & Beebe, N. "Classic Shell Scripting." O'Reilly, 2005.
