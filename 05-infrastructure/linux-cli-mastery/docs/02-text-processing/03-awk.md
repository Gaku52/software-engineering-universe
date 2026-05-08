# Text Processing Language (awk)

> awk is a mini programming language for "processing structured text column by column."

## What You Will Learn

- [ ] Understand the basic syntax of awk
- [ ] Perform field manipulation and aggregation
- [ ] Use built-in variables and functions effectively
- [ ] Apply conditionals, loops, and arrays
- [ ] Learn log analysis and data transformation patterns for real-world use
- [ ] Understand the extended features of gawk (GNU awk)


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Stream Editor (sed)](./02-sed.md)

---

## 1. awk Basics

### 1.1 Basic Syntax and Operating Principles

```bash
# Basic syntax: awk 'pattern { action }' [file...]
#
# How awk works:
# 1. Read input one line at a time (records)
# 2. Split records into fields (columns)
# 3. Execute action on records matching the pattern
# 4. Advance to the next line and go back to 1
#
# Special patterns:
# BEGIN { ... }  Executed once before input processing
# END { ... }    Executed once after input processing
# (no pattern)   Execute action on every line
# (no action)    Print matched lines (equivalent to print $0)

# Basic usage
awk '{print}' file.txt                # Print all lines (equivalent to cat)
awk '{print $0}' file.txt             # Same as above ($0 = entire line)
awk '{print $1}' file.txt             # Print the 1st column
awk '{print $1, $3}' file.txt         # Print the 1st and 3rd columns

# Input from pipe
echo "hello world" | awk '{print $2}' # → world
ps aux | awk '{print $1, $11}'        # Process owner and command
ls -la | awk '{print $5, $9}'         # File size and name
```

### 1.2 Field (Column) Basics

```bash
# Default delimiter is consecutive whitespace (spaces/tabs)
# $0: entire line
# $1: 1st field (column)
# $2: 2nd field
# $NF: last field
# $(NF-1): second-to-last field

awk '{print $1}' file.txt              # Print column 1
awk '{print $2}' file.txt              # Print column 2
awk '{print $NF}' file.txt             # Print last column
awk '{print $(NF-1)}' file.txt         # Print second-to-last column
awk '{print NR, $0}' file.txt          # Print line number + entire line
awk '{print NR": "$0}' file.txt        # Line number: line content

# Field arithmetic
awk '{print $1, $2, $1+$2}' data.txt   # Column 1, column 2, sum
awk '{print $1, $2*100}' data.txt      # Multiply column 2 by 100

# Field concatenation
awk '{print $1 "-" $2}' file.txt       # Concatenate with hyphen
awk '{print $1 "," $2 "," $3}' file.txt  # Concatenate with commas

# Check number of fields
awk '{print NF}' file.txt              # Number of fields per line
awk 'NF > 0' file.txt                  # Print non-empty lines (field count > 0)
awk 'NF == 5' file.txt                 # Only lines with exactly 5 columns
```

### 1.3 Specifying Delimiters (-F / FS)

```bash
# Use the -F option to specify the input field delimiter
awk -F',' '{print $2}' data.csv        # 2nd column of CSV
awk -F':' '{print $1}' /etc/passwd     # List of usernames
awk -F'\t' '{print $1}' data.tsv       # 1st column of TSV
awk -F'|' '{print $2}' data.txt        # Pipe-delimited
awk -F'/' '{print $NF}' paths.txt      # Last component of a path

# Regular expression as delimiter
awk -F'[,;]' '{print $2}' file.txt     # Comma or semicolon
awk -F'[=:]' '{print $1, $2}' config.txt   # Split on = or :

# Set FS in BEGIN block
awk 'BEGIN{FS=","} {print $2}' data.csv
awk 'BEGIN{FS=":"} {print $1, $NF}' /etc/passwd

# Specify output delimiter (OFS)
awk -F',' 'BEGIN{OFS="\t"} {print $1, $2, $3}' data.csv
# → Convert CSV to TSV

awk -F':' 'BEGIN{OFS=","} {print $1, $3, $6}' /etc/passwd
# → Output username, UID, home directory as CSV

# Multi-character delimiters
awk -F'::' '{print $2}' file.txt       # Split on ::
awk -F' -> ' '{print $2}' file.txt     # Split on " -> "
```

---

## 2. Pattern Matching

### 2.1 Filtering with Conditional Expressions

```bash
# Comparison operators
awk '$3 > 100' data.txt                # Lines where column 3 > 100
awk '$3 >= 100' data.txt               # Lines where column 3 >= 100
awk '$3 < 50' data.txt                 # Lines where column 3 < 50
awk '$3 == 100' data.txt               # Lines where column 3 == 100
awk '$3 != 0' data.txt                 # Lines where column 3 != 0
awk '$1 == "admin"' users.txt          # Lines where column 1 is "admin"
awk '$1 != "root"' /etc/passwd         # Lines where column 1 is not "root"

# String comparison
awk '$1 > "M"' file.txt                # Column 1 is after M (lexicographic order)
awk '$2 == ""' file.txt                # Lines where column 2 is empty

# Selection by line number
awk 'NR >= 10 && NR <= 20' file.txt    # Lines 10 to 20
awk 'NR == 1' file.txt                 # First line only
awk 'NR > 1' file.txt                  # From line 2 onwards (skip header)
awk 'NR % 2 == 0' file.txt             # Even lines only
awk 'NR % 2 == 1' file.txt             # Odd lines only

# Logical operators
awk '$3 > 50 && $3 < 100' data.txt     # 50 < column 3 < 100
awk '$1 == "error" || $1 == "fatal"' log.txt  # error OR fatal
awk '!($3 > 100)' data.txt             # Column 3 <= 100 (NOT)
```

### 2.2 Filtering with Regular Expressions

```bash
# ~ : regex match
# !~ : regex non-match

awk '/error/' logfile.txt              # Lines containing "error" (equivalent to grep)
awk '/^#/' config.txt                  # Lines starting with #
awk '/error|warning/' logfile.txt      # Lines containing "error" or "warning"
awk '!/^#/' config.txt                 # Lines not starting with #
awk '/^$/' file.txt                    # Empty lines only
awk '!/^$/' file.txt                   # Non-empty lines

# Regular expressions on fields
awk '$1 ~ /^[0-9]+$/' file.txt         # Lines where column 1 is all digits
awk '$2 ~ /error/' logfile.txt         # Lines where column 2 contains "error"
awk '$NF !~ /\.log$/' file.txt         # Lines where last column doesn't end in .log
awk '$3 ~ /^[A-Z]/' file.txt           # Lines where column 3 starts with uppercase

# Range patterns (start/end pattern, similar to sed)
awk '/BEGIN/,/END/' file.txt           # Lines in range BEGIN to END
awk '/^<body>/,/^<\/body>/' file.html  # Range from <body> to </body>
awk 'NR==5,NR==10' file.txt            # Lines 5 to 10

# POSIX character classes
```

---

## 3. Built-in Variables

### 3.1 Key Built-in Variables

```bash
# === Record / Field Related ===
# $0     : Entire current line
# $1~$N  : Nth field
# NR     : Current line number (across all files)
# NF     : Number of fields in the current line
# FNR    : Line number within the current file
# FILENAME: Name of the file currently being processed

# === Delimiter Related ===
# FS     : Input field separator (default: whitespace)
# OFS    : Output field separator (default: space)
# RS     : Input record separator (default: newline)
# ORS    : Output record separator (default: newline)

# === Other ===
# OFMT   : Output format for numbers (default: "%.6g")
# RSTART : Start position of match() result
# RLENGTH: Length of match() result
# ARGC   : Number of command-line arguments
# ARGV   : Array of command-line arguments

# Usage examples
awk '{print NR, NF, $0}' file.txt      # Line number, field count, line content
awk 'END{print NR}' file.txt           # Total number of lines
awk 'END{print NR " lines"}' file.txt  # Total lines with label

# Difference between NR and FNR with multiple files
awk '{print FILENAME, FNR, NR, $0}' file1.txt file2.txt
# FILENAME: file name
# FNR: line number within the file (reset per file)
# NR: cumulative line number (not reset)

# Detect file switches
awk 'FNR==1{print "=== " FILENAME " ==="}; {print}' *.txt
```

### 3.2 Customizing Delimiters

```bash
# Change the output delimiter
awk 'BEGIN{OFS=","} {print $1, $2, $3}' file.txt
# → Output with comma separation

awk 'BEGIN{OFS="\t"} {print $1, $2}' file.txt
# → Output with tab separation

# OFS is applied when a field is reassigned
awk -F',' 'BEGIN{OFS="|"} {$1=$1; print}' data.csv
# → Convert CSV to pipe-delimited

# Change record separator (paragraph mode)
awk 'BEGIN{RS=""} {print NR, $0}' file.txt
# → Process in paragraph units separated by blank lines

# Multi-character record separator (gawk)
awk 'BEGIN{RS="---\n"} {print NR": "$0}' file.txt
# → Process in blocks separated by ---

# Change output record separator
awk 'BEGIN{ORS="\n\n"} {print}' file.txt
# → Insert a blank line after each line

# CSV → TSV conversion
awk -F',' 'BEGIN{OFS="\t"} {$1=$1; print}' data.csv > data.tsv

# TSV → CSV conversion
awk -F'\t' 'BEGIN{OFS=","} {$1=$1; print}' data.tsv > data.csv
```

---

## 4. Aggregation and Calculation

### 4.1 Sum, Average, Max, Min

```bash
# Sum
awk '{sum += $2} END {print "Sum:", sum}' data.txt
awk -F',' '{sum += $3} END {print sum}' data.csv

# Average
awk '{sum += $2; n++} END {print "Average:", sum/n}' data.txt
awk '{sum += $2} END {print "Average:", sum/NR}' data.txt  # Using NR

# Maximum value
awk 'BEGIN{max=-999999} $2>max{max=$2} END{print "Max:", max}' data.txt
awk 'NR==1{max=$2} $2>max{max=$2} END{print max}' data.txt

# Minimum value
awk 'BEGIN{min=999999} $2<min{min=$2} END{print "Min:", min}' data.txt
awk 'NR==1{min=$2} $2<min{min=$2} END{print min}' data.txt

# Sum, average, max, and min all at once
awk 'NR==1{min=max=$2}
     {sum+=$2; if($2>max)max=$2; if($2<min)min=$2}
     END{printf "Sum: %d\nAverage: %.2f\nMax: %d\nMin: %d\n", sum, sum/NR, max, min}' data.txt

# Conditional sum
awk '$1=="sales" {sum += $3} END {print sum}' data.txt
# → Sum column 3 for rows where column 1 is "sales"

# Cumulative sum
awk '{sum += $1; print sum}' data.txt
# → Display cumulative sum for each line

# Moving average (last N items)
awk '{a[NR%5]=$1; s=0; for(i in a)s+=a[i]; print s/(NR<5?NR:5)}' data.txt
```

### 4.2 Counting and Frequency Analysis

```bash
# Simple count
awk '{count[$1]++} END {for (k in count) print k, count[k]}' access.log
# → Occurrence count per column 1 value (e.g., IP address)

# Count with sorting (awk + sort)
awk '{count[$1]++} END {for (k in count) print count[k], k}' access.log | sort -rn
# → In descending order by count

# Count unique values of a specific field
awk '{seen[$3]=1} END {print length(seen) " unique values"}' data.txt
# → Number of unique values in column 3

# List of unique values
awk '!seen[$1]++' file.txt             # Remove duplicates from column 1 (keep first occurrence)
awk '!seen[$0]++' file.txt             # Remove duplicate lines (equivalent to sort | uniq)

# Group aggregation
awk '{sum[$1] += $2; count[$1]++}
     END {for (k in sum) printf "%s: total=%d, avg=%.2f\n", k, sum[k], sum[k]/count[k]}' data.txt
# → Total and average per category in column 1

# Histogram-style output
awk '{count[$1]++}
     END {for (k in count) {
         printf "%-20s ", k
         for (i=0; i<count[k]; i++) printf "#"
         printf " (%d)\n", count[k]
     }}' data.txt

# Cross-tabulation (combination of two fields)
awk '{count[$1","$2]++}
     END {for (k in count) print k, count[k]}' data.txt | sort
```

### 4.3 Statistical Calculations

```bash
# Standard deviation
awk '{sum+=$1; sumsq+=$1*$1}
     END{mean=sum/NR; variance=sumsq/NR-mean*mean;
         printf "Mean: %.2f\nStdDev: %.2f\n", mean, sqrt(variance)}' data.txt

# Percentiles (simple version - sorted data)
sort -n data.txt | awk '{a[NR]=$1}
    END{print "25th:", a[int(NR*0.25)];
        print "50th:", a[int(NR*0.50)];
        print "75th:", a[int(NR*0.75)];
        print "90th:", a[int(NR*0.90)]}'

# Frequency distribution (bin width 10)
awk '{bin=int($1/10)*10; count[bin]++}
     END{for(b in count) printf "%3d-%3d: %d\n", b, b+9, count[b]}' data.txt | sort -n

# Percentage calculation
awk '{count[$1]++; total++}
     END{for(k in count) printf "%-15s %5d (%5.1f%%)\n", k, count[k], count[k]*100/total}' data.txt
```

---

## 5. Output Formatting

### 5.1 print and printf

```bash
# print: simple output (separated by OFS, terminated by ORS)
awk '{print $1, $2}' file.txt          # Output fields separated by OFS
awk '{print $1 $2}' file.txt           # Concatenate fields (no separator)
awk '{print $1 " - " $2}' file.txt     # Concatenate with string

# printf: C-style formatted output (newline not added automatically)
awk '{printf "%s\n", $1}' file.txt                    # String
awk '{printf "%d\n", $1}' file.txt                    # Integer
awk '{printf "%.2f\n", $1}' file.txt                  # 2 decimal places
awk '{printf "%10d\n", $1}' file.txt                  # Right-aligned 10 chars
awk '{printf "%-10s %5d\n", $1, $2}' file.txt         # Left-aligned 10 chars, right-aligned 5 chars
awk '{printf "%05d\n", $1}' file.txt                  # Zero-padded 5 digits
awk '{printf "%-20s %10.2f\n", $1, $2}' data.txt      # Tabular format

# printf format specifiers
# %s   : String
# %d   : Decimal integer
# %f   : Floating point
# %e   : Scientific notation
# %g   : Compact form of %f or %e
# %x   : Hexadecimal
# %o   : Octal
# %c   : Character (from ASCII value)
# %%   : Literal %
# %10s : Right-aligned 10 chars
# %-10s: Left-aligned 10 chars
# %05d : Zero-padded 5 digits
# %.2f : 2 decimal places

# Table-formatted output
awk 'BEGIN{printf "%-15s %10s %10s\n", "Name", "Score", "Grade";
           printf "%-15s %10s %10s\n", "----", "-----", "-----"}
     {printf "%-15s %10d %10s\n", $1, $2, $3}' scores.txt

# CSV-formatted output
awk '{printf "\"%s\",\"%s\",%d\n", $1, $2, $3}' data.txt

# Report with header
awk 'BEGIN{print "====== Report ======"}
     {printf "  %-20s: %s\n", $1, $2}
     END{print "==== End Report ===="}' data.txt
```

### 5.2 Output Redirection

```bash
# File output within awk
awk '{print $0 > "output.txt"}' input.txt          # Write to file
awk '{print $0 >> "output.txt"}' input.txt         # Append to file
awk '{print $0 | "sort"}' input.txt                # Pipe to command

# Split into files by condition
awk '{print > $1".txt"}' data.txt
# → Write each line to a file named after column 1

# Split into files by log level
awk '/ERROR/{print > "error.log"} /WARN/{print > "warn.log"} /INFO/{print > "info.log"}' app.log

# Closing files (when opening many files)
awk '{filename = $1".txt"; print >> filename; close(filename)}' data.txt
```

---

## 6. Conditionals and Loops

### 6.1 if-else Statements

```bash
# Basic if-else
awk '{
    if ($3 >= 90) grade = "A"
    else if ($3 >= 80) grade = "B"
    else if ($3 >= 70) grade = "C"
    else if ($3 >= 60) grade = "D"
    else grade = "F"
    print $1, $3, grade
}' scores.txt

# Ternary operator
awk '{print $1, ($2 > 0 ? "positive" : "non-positive")}' data.txt
awk '{status = ($3 >= 200 && $3 < 300) ? "OK" : "ERROR"; print $0, status}' access.log

# Conditional output
awk '{
    if ($1 == "ERROR") {
        printf "\033[31m%s\033[0m\n", $0   # Display in red
    } else if ($1 == "WARN") {
        printf "\033[33m%s\033[0m\n", $0   # Display in yellow
    } else {
        print $0
    }
}' logfile.txt
```

### 6.2 Loop Processing

```bash
# for loop
awk '{for (i=1; i<=NF; i++) print $i}' file.txt   # Print all fields one per line
awk '{for (i=NF; i>=1; i--) printf "%s ", $i; printf "\n"}' file.txt  # Fields in reverse order

# while loop
awk '{i=1; while(i<=NF) {print $i; i++}}' file.txt

# do-while loop
awk '{i=1; do {print $i; i++} while(i<=NF)}' file.txt

# for-in loop over arrays
awk '{count[$1]++} END {for (key in count) print key, count[key]}' data.txt

# Join fields (concatenate all fields from a certain column onwards)
awk '{result=""; for(i=3;i<=NF;i++) result=result" "$i; print $1, $2, result}' file.txt

# Reverse field order
awk '{for(i=NF;i>0;i--) printf "%s%s", $i, (i==1?"\n":OFS)}' file.txt

# Generate multiplication table
awk 'BEGIN{for(i=1;i<=9;i++){for(j=1;j<=9;j++)printf "%3d",i*j;print""}}'
```

---

## 7. Associative Arrays

### 7.1 Basic Array Operations

```bash
# All arrays in awk are associative arrays (hash maps)
# Indices are strings (numbers are also converted to strings)

# Basic counting
awk '{count[$1]++}
     END {for (k in count) print k, count[k]}' file.txt

# Check for array key existence
awk '{if ($1 in seen) print "duplicate:", $0; seen[$1]=1}' file.txt
# → Detect duplicate values in column 1

# Delete from array
awk '{count[$1]++}
     END {delete count["unwanted"]; for(k in count) print k, count[k]}' file.txt

# Multi-dimensional arrays (pseudo, by concatenating keys)
awk '{count[$1","$2]++}
     END {for (k in count) print k, count[k]}' data.txt

# gawk multi-dimensional arrays
# gawk '{count[$1][$2]++} ...'  # Available in gawk 4.0+

# Array sorting (gawk's asorti / asort)
awk '{count[$1]++}
     END {
         n = asorti(count, sorted)
         for (i=1; i<=n; i++) print sorted[i], count[sorted[i]]
     }' data.txt
```

### 7.2 Practical Patterns Using Arrays

```bash
# Joining two files (JOIN operation)
awk 'NR==FNR{a[$1]=$2; next} ($1 in a){print $0, a[$1]}' file1.txt file2.txt
# → Join file2.txt with file1.txt using column 1 as key

# Cross-check with master data
awk 'NR==FNR{master[$1]=1; next} !($1 in master){print "Not found:", $0}' master.txt data.txt
# → Detect data not present in master.txt

# Duplicate check
awk 'seen[$0]++ > 0 {print NR": "$0}' file.txt
# → Display duplicate lines and their line numbers

# Field value aggregation (GROUP BY-like operation)
awk -F',' '{
    key = $1
    values[key] = values[key] ? values[key] ", " $2 : $2
}
END {
    for (k in values) print k ": " values[k]
}' data.csv
# → Group by column 1, aggregate column 2 values as comma-separated

# Ranking (descending order)
awk '{count[$1]++}
     END{
         for(k in count) print count[k], k
     }' data.txt | sort -rn | awk '{printf "%2d. %-20s %d\n", NR, $2, $1}'

# Compare with previous line (calculate difference)
awk 'NR>1{print $0, $2-prev} {prev=$2}' data.txt
# → Display the difference from the previous line's column 2

# Reverse lookup (find key by value)
awk '{inv[$2]=$1} END{print inv["target_value"]}' data.txt
```

---

## 8. Built-in Functions

### 8.1 String Functions

```bash
# length(): string length
awk '{print length($0)}' file.txt          # Character count per line
awk 'length($0) > 80' file.txt             # Lines longer than 80 characters
awk '{print length($1), $1}' file.txt      # Length and value of column 1

# substr(): extract substring
awk '{print substr($1, 1, 3)}' file.txt    # First 3 characters of column 1
awk '{print substr($0, 10)}' file.txt      # From character 10 onwards
awk '{print substr($0, 5, 10)}' file.txt   # 10 characters starting at position 5

# index(): search in string (returns position, 0 if not found)
awk '{pos = index($0, "error"); if(pos) print NR, pos, $0}' file.txt

# split(): split string into array
awk '{n = split($1, arr, "-"); print arr[1], arr[2]}' file.txt
# → "2026-02-16" → "2026" "02"

awk '{n = split($0, arr, ","); for(i=1;i<=n;i++) print arr[i]}' csv_line.txt

# sub(): replace first match
awk '{sub(/error/, "ERROR"); print}' file.txt

# gsub(): replace all matches (global sub)
awk '{gsub(/error/, "ERROR"); print}' file.txt
awk '{gsub(/,/, "\t"); print}' data.csv    # Replace commas with tabs
awk '{n = gsub(/e/, "E"); print n, $0}' file.txt  # Get replacement count

# match(): regex match (sets RSTART, RLENGTH)
awk 'match($0, /[0-9]+/) {print substr($0, RSTART, RLENGTH)}' file.txt
# → Extract the first numeric sequence

# sprintf(): store formatted string in a variable
awk '{result = sprintf("%s: %.2f", $1, $2); print result}' data.txt

# tolower() / toupper(): case conversion
awk '{print tolower($0)}' file.txt         # Convert all to lowercase
awk '{print toupper($1)}' file.txt         # Convert column 1 to uppercase
awk '{$1=toupper($1); print}' file.txt     # Convert column 1 to uppercase and output
```

### 8.2 Numeric Functions

```bash
# int(): get integer part (truncate)
awk '{print int($1)}' file.txt             # Truncate decimal
awk '{print int($1 + 0.5)}' file.txt       # Round to nearest integer

# sqrt(): square root
awk '{print sqrt($1)}' file.txt

# sin(), cos(), atan2(): trigonometric functions
awk 'BEGIN{print sin(3.14159/2)}'          # → 1
awk 'BEGIN{pi=atan2(0,-1); print pi}'      # → 3.14159

# exp(), log(): exponential and logarithm
awk 'BEGIN{print exp(1)}'                  # → 2.71828 (e)
awk 'BEGIN{print log(2.71828)}'            # → 1

# rand(), srand(): random numbers
awk 'BEGIN{srand(); for(i=1;i<=10;i++) print rand()}'
# → Generate 10 random numbers between 0 and 1

awk 'BEGIN{srand(); for(i=1;i<=10;i++) print int(rand()*100)+1}'
# → Generate 10 random integers between 1 and 100

# Random sampling (extract 10% of all lines)
awk 'BEGIN{srand()} rand() < 0.1' large_file.txt
```

### 8.3 Time Functions (gawk)

```bash
# systime(): current UNIX timestamp
gawk 'BEGIN{print systime()}'

# mktime(): timestamp from date string
gawk 'BEGIN{print mktime("2026 02 16 12 00 00")}'

# strftime(): date string from timestamp
gawk 'BEGIN{print strftime("%Y-%m-%d %H:%M:%S", systime())}'

# Date arithmetic
gawk 'BEGIN{
    now = systime()
    yesterday = now - 86400
    print "Today:", strftime("%Y-%m-%d", now)
    print "Yesterday:", strftime("%Y-%m-%d", yesterday)
}'

# Convert log timestamps
gawk '{
    timestamp = mktime(gensub(/[-:]/, " ", "g", $1 " " $2))
    print strftime("%s", timestamp), $0
}' logfile.txt
```

---

## 9. awk Scripts

### 9.1 awk Script Files

```bash
#!/usr/bin/awk -f
# analyze_log.awk - Log analysis script

BEGIN {
    FS = " "
    print "=== Log Analysis Report ==="
    print ""
}

# Count error lines
/ERROR/ {
    error_count++
    error_lines[error_count] = $0
}

# Count warning lines
/WARN/ {
    warn_count++
}

# Count IP addresses (when column 1 is an IP)
{
    ip_count[$1]++
    total++
}

END {
    print "Total lines: " total
    print "Errors: " error_count+0
    print "Warnings: " warn_count+0
    print ""

    print "=== Error Details ==="
    for (i = 1; i <= error_count && i <= 10; i++) {
        print "  " error_lines[i]
    }
    print ""

    print "=== Access Count by IP Address (Top 10) ==="
    # Sorting within awk is not possible, so use a pipe
    n = asorti(ip_count, sorted_ips)
    for (i = 1; i <= n; i++) {
        ip = sorted_ips[i]
        count_arr[ip_count[ip]] = count_arr[ip_count[ip]] ? count_arr[ip_count[ip]] "\n  " ip : ip
    }
}
```

```bash
# How to run
awk -f analyze_log.awk access.log
# or
chmod +x analyze_log.awk
./analyze_log.awk access.log
```

### 9.2 Examples of Complex Processing

```bash
#!/usr/bin/awk -f
# csv_report.awk - CSV report generation

BEGIN {
    FS = ","
    OFS = ","

    print "=== CSV Data Analysis Report ==="
}

# Process header row
NR == 1 {
    for (i = 1; i <= NF; i++) {
        headers[i] = $i
    }
    num_cols = NF
    next
}

# Process data rows
{
    for (i = 1; i <= NF; i++) {
        # Aggregate numeric fields
        if ($i ~ /^[0-9.]+$/) {
            sum[i] += $i
            count[i]++
            if (!(i in min) || $i < min[i]) min[i] = $i
            if (!(i in max) || $i > max[i]) max[i] = $i
        }
    }
    data_rows++
}

END {
    printf "\nData rows: %d\n", data_rows
    printf "Columns: %d\n\n", num_cols

    printf "%-20s %10s %10s %10s %10s\n", "Column", "Sum", "Avg", "Min", "Max"
    printf "%-20s %10s %10s %10s %10s\n", "------", "---", "---", "---", "---"

    for (i = 1; i <= num_cols; i++) {
        if (i in sum) {
            printf "%-20s %10.2f %10.2f %10.2f %10.2f\n",
                headers[i], sum[i], sum[i]/count[i], min[i], max[i]
        }
    }
}
```

---

## 10. Practical Pattern Collection

### 10.1 Apache/Nginx Access Log Analysis

```bash
# Aggregate by status code
awk '{count[$9]++} END {for (c in count) print c, count[c]}' access.log | sort -k2 -rn

# Top 20 IP addresses by access count
awk '{count[$1]++} END {for (ip in count) print count[ip], ip}' access.log | sort -rn | head -20

# Top 20 request URLs by access count
awk '{count[$7]++} END {for (url in count) print count[url], url}' access.log | sort -rn | head -20

# Aggregate by HTTP method
awk '{gsub(/"/, "", $6); count[$6]++} END {for (m in count) print m, count[m]}' access.log

# Request count by hour of day
awk '{split($4, a, ":"); hour=a[2]; count[hour]++}
     END {for (h in count) print h, count[h]}' access.log | sort

# Response time analysis (when last field is response time)
awk '{sum += $NF; count++; if($NF > max) max=$NF}
     END {printf "Avg: %.2fms, Max: %.2fms, Count: %d\n", sum/count, max, count}' access.log

# List URLs with 4xx/5xx errors
awk '$9 >= 400 {count[$7]++}
     END {for (url in count) print count[url], url}' access.log | sort -rn | head -20

# Aggregate bandwidth usage (when column 10 is byte count)
awk '{bytes[$1] += $10}
     END {for (ip in bytes) printf "%-20s %10.2f MB\n", ip, bytes[ip]/1048576}' access.log | sort -t'M' -k2 -rn | head -10

# Detect unauthorized access from specific IP (large number of requests in short time)
awk '{ip_time[$1","$4]++}
     END {for (k in ip_time) if (ip_time[k] > 100) print k, ip_time[k]}' access.log

# Detect slow queries (response time > 1 second)
awk '$NF > 1000 {print $4, $7, $NF"ms"}' access.log | head -20
```

### 10.2 System Monitoring

```bash
# Top 10 processes by memory usage
ps aux | awk 'NR>1{print $4, $11}' | sort -rn | head -10

# Top 10 processes by CPU usage
ps aux | awk 'NR>1{print $3, $11}' | sort -rn | head -10

# Process count per user
ps aux | awk 'NR>1{count[$1]++} END{for(u in count) print count[u], u}' | sort -rn

# Disk usage warnings
df -h | awk 'NR>1{gsub(/%/,"",$5); if($5+0 > 80) printf "WARNING: %s is %s%% full\n", $6, $5}'

# Memory usage (from /proc/meminfo)
awk '/^(MemTotal|MemFree|MemAvailable|Buffers|Cached):/{
    gsub(/kB/,""); printf "%-15s %10.2f MB\n", $1, $2/1024
}' /proc/meminfo

# Network connection count by state
ss -tan | awk 'NR>1{count[$1]++} END{for(s in count) print s, count[s]}'

# Connection count by source IP address
ss -tan | awk 'NR>1{split($5,a,":"); if(a[1]!="*") count[a[1]]++}
               END{for(ip in count) print count[ip], ip}' | sort -rn | head -10

# CPU usage time-series monitoring (every 1 second)
# vmstat 1 | awk '{print strftime("%H:%M:%S"), 100-$15"%"}'
```

### 10.3 CSV/TSV Data Processing

```bash
# Count data rows excluding header in CSV
awk -F',' 'NR>1{count++} END{print count}' data.csv

# Filter by value in a specific column
awk -F',' '$3 > 1000' data.csv         # Column 3 > 1000

# Add a column (calculated column)
awk -F',' 'BEGIN{OFS=","} NR==1{print $0,"total"; next} {print $0, $2+$3+$4}' data.csv

# Remove a column (exclude column 3)
awk -F',' 'BEGIN{OFS=","} {$3=""; gsub(/,,/,","); print}' data.csv
# More robust approach:
awk -F',' 'BEGIN{OFS=","} {
    for(i=1;i<=NF;i++) if(i!=3) printf "%s%s", $i, (i<NF&&i+1!=3?OFS:"");
    print ""
}' data.csv

# Reorder columns
awk -F',' 'BEGIN{OFS=","} {print $3, $1, $2}' data.csv

# Check for NULL/empty values
awk -F',' '{for(i=1;i<=NF;i++) if($i=="") printf "Row %d, Col %d is empty\n", NR, i}' data.csv

# Handle CSV double-quotes properly (simple version)
awk -F'","' '{gsub(/^"|"$/, ""); print $2}' data.csv

# Data validation
awk -F',' 'NR>1{
    if ($2 !~ /^[0-9]+$/) print "Invalid number at row " NR ": " $2
    if ($3 == "") print "Empty field at row " NR ", col 3"
    if (NF != expected_cols) print "Wrong column count at row " NR ": " NF " (expected " expected_cols ")"
}' expected_cols=5 data.csv

# Pivot table (row to column conversion)
awk -F',' '{
    rows[$1] = 1
    cols[$2] = 1
    data[$1","$2] = $3
}
END {
    printf "%-15s", ""
    for (c in cols) printf "%15s", c
    print ""
    for (r in rows) {
        printf "%-15s", r
        for (c in cols) printf "%15s", data[r","c]+0
        print ""
    }
}' data.csv
```

### 10.4 Text Conversion

```bash
# JSON-like output (simple version)
awk -F',' 'NR==1{split($0,h); next}
    {printf "{\n"
     for(i=1;i<=NF;i++) printf "  \"%s\": \"%s\"%s\n", h[i], $i, (i<NF?",":"")
     printf "}\n"}' data.csv

# key=value to JSON conversion
awk -F'=' 'BEGIN{print "{"} {printf "  \"%s\": \"%s\"", $1, $2; if(NR>1) printf ","
    printf "\n"} END{print "}"}' config.ini

# Generate Markdown table
awk -F',' 'NR==1{
    printf "| "
    for(i=1;i<=NF;i++) printf "%s | ", $i
    printf "\n| "
    for(i=1;i<=NF;i++) printf "--- | "
    printf "\n"
    next
}
{
    printf "| "
    for(i=1;i<=NF;i++) printf "%s | ", $i
    printf "\n"
}' data.csv

# Generate SQL INSERT statements
awk -F',' 'NR>1{
    printf "INSERT INTO table_name VALUES ("
    for(i=1;i<=NF;i++) {
        if($i ~ /^[0-9]+$/) printf "%s", $i
        else printf "'\'%s\''", $i
        if(i<NF) printf ", "
    }
    printf ");\n"
}' data.csv

# Generate HTML table
awk -F',' 'BEGIN{print "<table>"}
    NR==1{print "  <tr>"; for(i=1;i<=NF;i++) print "    <th>"$i"</th>"; print "  </tr>"; next}
    {print "  <tr>"; for(i=1;i<=NF;i++) print "    <td>"$i"</td>"; print "  </tr>"}
    END{print "</table>"}' data.csv

# Process multi-line records (blank-line delimited)
awk 'BEGIN{RS=""; FS="\n"} {print $1, $2, $3}' records.txt
# → Merge multi-line records separated by blank lines into a single line
```

### 10.5 File Comparison and Diff

```bash
# Common lines in two files
awk 'NR==FNR{a[$0]; next} $0 in a' file1.txt file2.txt

# Lines in file1 but not in file2
awk 'NR==FNR{a[$0]; next} !($0 in a)' file2.txt file1.txt

# Lines in file2 but not in file1
awk 'NR==FNR{a[$0]; next} !($0 in a)' file1.txt file2.txt

# Field-level comparison
awk -F',' 'NR==FNR{a[$1]=$2; next} ($1 in a) && a[$1]!=$2{
    print $1, "changed:", a[$1], "->", $2
}' old.csv new.csv

# Generate diff report
awk 'NR==FNR{old[$1]=$0; next}
     {
         if ($1 in old) {
             if (old[$1] != $0) print "MODIFIED:", $0
             delete old[$1]
         } else {
             print "ADDED:", $0
         }
     }
     END{for(k in old) print "DELETED:", old[k]}' old.txt new.txt
```

---

## 11. gawk Extensions

### 11.1 gawk-Specific Features

```bash
# gawk (GNU awk) adds many extensions to POSIX awk

# BEGINFILE / ENDFILE: executed before/after each file
gawk 'BEGINFILE{print "=== " FILENAME " ==="} {print}' *.txt

# nextfile: skip the rest of the current file
gawk '/ERROR/{print FILENAME; nextfile}' *.log
# → Print the name of the first file containing ERROR and move to the next

# @include: load external file
# Inside a gawk script:
# @include "functions.awk"

# Network communication (gawk network feature)
# gawk 'BEGIN{
#     service = "/inet/tcp/0/example.com/80"
#     print "GET / HTTP/1.0\r\nHost: example.com\r\n" |& service
#     service |& getline response
#     print response
#     close(service)
# }'

# Powerful regex matching (gensub)
gawk '{print gensub(/([0-9]+)/, "[\\1]", "g")}' file.txt
# → Wrap all numbers in square brackets

gawk '{print gensub(/(.)(.)/, "\\2\\1", "g")}' file.txt
# → Swap every 2 characters

# Multi-dimensional arrays
gawk '{sales[$1][$2] += $3}
      END{for(dept in sales) for(month in sales[dept])
          print dept, month, sales[dept][month]}' sales.txt

# Sort control (PROCINFO["sorted_in"])
gawk 'BEGIN{PROCINFO["sorted_in"]="@val_num_desc"}
      {count[$1]++}
      END{for(k in count) print k, count[k]}' data.txt
# → Output sorted in descending order by value
```

### 11.2 FPAT (Field Pattern)

```bash
# Correctly parse CSV (accounting for commas inside double-quotes)
gawk 'BEGIN{FPAT="([^,]*)|(\"[^\"]*\")"} {print $2}' data.csv
# → Correctly split "field1","field with, comma","field3"

# Example: correctly extract CSV fields with double-quotes
gawk 'BEGIN{FPAT="([^,]*)|(\"[^\"]*\")"}
      {for(i=1;i<=NF;i++) {
          gsub(/^"|"$/, "", $i)  # Remove quotes
          print i": "$i
      }}' data.csv
```

---

## 12. Troubleshooting

### 12.1 Common Problems and Solutions

```bash
# Problem: Fields are not split as expected
# Solution: Specify the correct delimiter with -F
awk -F',' '{print NF, $0}' data.csv    # Check column count
awk -F'\t' '{print NF, $0}' data.tsv   # Check tab-delimited

# Problem: Numeric comparison is being treated as string comparison
# Solution: Explicitly convert to number (+0)
awk '$3+0 > 100' data.txt              # Numerify with +0
awk '{if ($3+0 > 100) print}' data.txt

# Problem: Empty fields are not handled correctly
# Solution: Use FPAT or check field existence
awk -F',' '{if ($3 != "") print $3}' data.csv

# Problem: Out of memory with large files
# Solution: Avoid accumulating arrays, or delete periodically
awk '{count[$1]++; if(NR%1000000==0){for(k in count){print k,count[k]; delete count[k]}}}
     END{for(k in count) print k, count[k]}' huge_file.txt

# Problem: Differences between macOS default awk and gawk
# Solution: Install gawk
# brew install gawk
# Use gawk or limit syntax to POSIX-compatible constructs

# Problem: Processing Japanese (multibyte characters)
# Solution: Set locale
LC_ALL=en_US.UTF-8 awk '{print length($0)}' file.txt
# Or use gawk (better UTF-8 support)

# Debugging: check processing per line
awk '{print "DEBUG:", NR, NF, $0}' file.txt
awk '{for(i=1;i<=NF;i++) print "Field " i ": [" $i "]"}' file.txt
```

### 12.2 Performance Tips

```bash
# 1. Avoid unnecessary output
awk '/pattern/' file.txt               # Good: output only matching lines
# awk '{if(/pattern/) print}' file.txt # Same but slightly more verbose

# 2. Use sub instead of gsub (when one replacement is enough)
awk '{sub(/old/, "new"); print}' file.txt

# 3. Minimize array usage with large files
# Prefer stream processing rather than storing all lines in an array

# 4. Regular expression caching
# awk automatically caches repeatedly-used regex patterns,
# but dynamic regex (using variables) is not cached

# 5. Divide responsibilities using pipes
# Rather than doing everything in one awk command,
# chain: grep for filtering → awk for formatting → sort for sorting
grep "ERROR" logfile.txt | awk '{print $1, $NF}' | sort | uniq -c | sort -rn
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
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
        assert False, "Exception should be raised"
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
        """Statistical information"""
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

The following summarizes criteria for making technology decisions.

| Criterion | When to Prioritize | When to Compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                   │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to ②                     │
│                                                 │
│  ② Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily/multiple times → Go to ③            │
│                                                 │
│  ③ Team independence?                           │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack reduces the learning curve
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability, but can make debugging harder
- Low abstraction is intuitive, but tends to lead to code duplication

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

- [ ] Is naming consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Is documentation updated?

### Knowledge Sharing Best Practices

| Method | Frequency | Audience | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge spread |
| ADR (design records) | Per decision | Future members | Decision transparency |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Key design | Building consensus |

### Technical Debt Management

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │ned  │imme-│
    │resp │diat-│
    │onse │ely  │
    ├─────┼─────┤
    │Log  │Next │
    │only │     │
    │     │Sprint│
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
| Broken authentication | High | Multi-factor auth, session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, least privilege | Configuration scan |
| Insufficient logging | Medium | Structured logs, audit trail | Log analysis |

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
- [ ] CORS policy is configured appropriately
- [ ] Vulnerability scans on dependency packages have been performed
- [ ] Error messages do not contain internal information
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Syntax | Use | Example |
|------|------|------|
| {print $N} | Print column N | awk '{print $1}' |
| -F',' | Specify delimiter | awk -F',' '{print $2}' |
| /pattern/ | Filter lines | awk '/error/' |
| $N > val | Conditional filter | awk '$3 > 100' |
| BEGIN {} | Pre-processing | awk 'BEGIN{FS=","}' |
| END {} | Post-processing (aggregation) | awk 'END{print NR}' |
| count[$1]++ | Count with associative array | Group aggregation |
| sum += $N | Calculate sum | awk '{s+=$2}END{print s}' |
| printf | Formatted output | printf "%.2f", val |
| NR | Line number | awk 'NR>1' |
| NF | Field count | awk '{print NF}' |
| length() | String length | awk 'length>80' |
| substr() | Substring | substr($1,1,3) |
| split() | Split string | split($1,a,"-") |
| sub/gsub | Replace | gsub(/old/,"new") |
| tolower/toupper | Case conversion | tolower($0) |
| NR==FNR | File join | JOIN of 2 files |

### When to Use awk vs sed vs grep

```
┌────────────────────────────┬──────────────┐
│ Task                       │ Best Tool    │
├────────────────────────────┼──────────────┤
│ Extract lines by pattern   │ grep / rg    │
│ Replace strings            │ sed          │
│ Delete/insert lines        │ sed          │
│ Extract columns (fields)   │ awk          │
│ Numeric calculation/agg.   │ awk          │
│ Group aggregation          │ awk          │
│ Formatted output           │ awk          │
│ Join two files             │ awk          │
│ Complex conditional logic  │ awk          │
│ Simple filtering           │ grep         │
│ Simple replacement         │ sed          │
└────────────────────────────┴──────────────┘
```

---

## 15. awk and Other Tool Integration Patterns

### 15.1 Building Pipelines in Practice

```bash
# Efficient combination of grep + awk
# Typical pattern: grep to narrow down, awk to aggregate
grep "ERROR" app.log | awk '{count[$5]++} END {for (k in count) print count[k], k}' | sort -rn

# Filesystem analysis with find + awk
find /var/log -type f -name "*.log" -printf "%s %p\n" | \
  awk '{total += $1; count++} END {printf "Files: %d, Total: %.2f MB, Avg: %.2f KB\n", count, total/1024/1024, total/count/1024}'

# Aggregate process memory usage with ps + awk
ps aux | awk 'NR>1 {mem[$11] += $6} END {for (p in mem) printf "%10d KB  %s\n", mem[p], p}' | sort -rn | head -20

# Aggregate container resources with docker stats + awk
docker stats --no-stream --format "{{.Name}} {{.MemUsage}} {{.CPUPerc}}" | \
  awk '{gsub(/MiB|%/, ""); print $1, $2, $NF}'

# Aggregate connection states with netstat + awk
netstat -an 2>/dev/null | awk '/^tcp/ {state[$6]++} END {for (s in state) printf "%-20s %d\n", s, state[s]}'

# Identify peak CPU usage periods with sar + awk
sar -u 2>/dev/null | awk 'NR>3 && $NF != "idle" && $NF+0 < 20 {print "High CPU at", $1, "idle:", $NF"%"}'
```

### 15.2 Using awk in Shell Scripts

```bash
# Assign awk output to shell variable
total=$(awk '{sum += $1} END {print sum}' data.txt)
echo "Total: $total"

# Conditional branching based on awk output
if awk '{sum += $1} END {exit (sum > 1000) ? 0 : 1}' data.txt; then
  echo "Sum exceeds 1000"
fi

# Execute commands generated by awk
awk '{printf "mv %s %s.bak\n", $0, $0}' file_list.txt | sh

# Reference shell variables in awk
threshold=100
awk -v t="$threshold" '$3 > t {print $0}' data.txt

# Retrieve multiple variables at once
read total count avg <<< $(awk '{sum+=$1; n++} END {printf "%d %d %.2f", sum, n, sum/n}' data.txt)
echo "Total: $total, Count: $count, Average: $avg"
```

---

## Further Reading

---

## References
1. Aho, A., Kernighan, B. & Weinberger, P. "The AWK Programming Language." 2nd Ed, 2023.
2. Robbins, A. "sed & awk." 2nd Ed, O'Reilly, 1997.
3. Robbins, A. "Effective awk Programming." 5th Ed, O'Reilly, 2024.
4. GNU Awk User's Guide. https://www.gnu.org/software/gawk/manual/
5. awk One-Liners Explained. https://catonmat.net/awk-one-liners-explained-part-one
