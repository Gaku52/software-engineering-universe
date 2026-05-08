# Process Monitoring (ps, top, htop)

> Understanding the state of processes is the first step in troubleshooting.
> Server load analysis, memory leak detection, identifying abnormal processes — it all starts with process monitoring.

## What You Will Learn in This Chapter

- [ ] Retrieve and filter process lists with ps
- [ ] Perform real-time monitoring with top / htop
- [ ] Read and interpret process states and resource usage
- [ ] Search for processes and understand their structure with pgrep / pstree
- [ ] Retrieve process information from the /proc filesystem
- [ ] Create monitoring scripts for automation


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. ps — Process Snapshot

### 1.1 Basic Usage

```bash
# ps is a command that takes a "snapshot" of processes at a given moment
# There are two syntax formats: BSD style and UNIX (System V) style

# BSD style (no dash)
ps aux                          # Show all processes
ps axjf                         # Tree view (process hierarchy)

# UNIX style (with dash)
ps -ef                          # Show all processes
ps -eF                          # All processes in extended format

# Differences:
# ps aux → USER, PID, %CPU, %MEM, VSZ, RSS, TTY, STAT, START, TIME, COMMAND
# ps -ef → UID, PID, PPID, C, STIME, TTY, TIME, CMD

# Only your own processes
ps u                            # Processes associated with the current user's terminal
ps ux                           # All processes of the current user

# Processes of a specific user
ps -u gaku                      # Processes of user gaku
ps -u root                      # Processes of root
ps -U gaku                      # Search by real UID
ps -u gaku -f                   # Full format
```

### 1.2 Detailed Column Descriptions

```bash
# Example output of ps aux:
# USER   PID  %CPU %MEM    VSZ   RSS TTY  STAT START   TIME COMMAND
# root     1   0.0  0.1 169344 13256 ?    Ss   Jan01   0:15 /sbin/init
# gaku  1234   5.2  2.3 524288 37120 pts/0 Sl+  14:30  0:42 node server.js

# Details of each column:
# USER:    Effective user of the process
# PID:     Process ID (unique identifier)
# %CPU:    CPU usage rate (average over the lifetime of the process)
# %MEM:    Physical memory usage rate
# VSZ:     Virtual memory size (KB) — total memory space accessible by the process
# RSS:     Resident Set Size (KB) — the size actually present in physical memory
# TTY:     Controlling terminal (? = daemon, pts/N = pseudo-terminal)
# STAT:    Process state (see details below)
# START:   Start time (time if within 24 hours, otherwise date)
# TIME:    Cumulative CPU time (total time the process actually used the CPU)
# COMMAND: Executed command

# Difference between VSZ and RSS:
#   VSZ (Virtual Size): includes mmap'd files, shared libraries, and unused allocated memory
#   RSS (Resident Set Size): size of pages actually present in physical memory
#   Typically VSZ >> RSS (large VSZ is often not harmful)
#   Processes with large RSS are the actual memory consumers

# Example output of ps -ef:
# UID        PID  PPID  C STIME TTY          TIME CMD
# root         1     0  0 Jan01 ?        00:00:15 /sbin/init

# PPID: Parent process ID (the process that spawned this process)
# C:    CPU utilization (short-term value)
# STIME: Start time
```

### 1.3 Complete Guide to STAT (Process States)

```bash
# The STAT field consists of a single-character base state + additional flags

# === Base state (1st character) ===
# R: Running     — Running or in the CPU run queue
# S: Sleeping    — Interruptible sleep (waiting for I/O completion or signal)
# D: Disk sleep  — Uninterruptible sleep (waiting for I/O)
#                  → Cannot be killed even with kill -9! Caused by disk or NFS issues
# Z: Zombie      — Terminated but parent has not called wait()
#                  → Caused by a bug in the parent process. Killing the parent will remove it
# T: Stopped     — Stopped by a signal (SIGSTOP/SIGTSTP)
# t: Tracing     — Being traced by a debugger (strace, etc.)
# I: Idle        — Kernel idle thread (Linux 4.14+)
# X: Dead        — Never displayed (a brief moment during exit processing)

# === Additional flags (2nd character onward) ===
# s: Session leader (login shell, etc.)
# l: Multi-threaded
# +: Member of the foreground process group
# <: High priority (negative nice value)
# N: Low priority (positive nice value)
# L: Has pages locked in memory
# W: Swapped out (not used since Linux 2.6)

# Common STAT combinations and their meanings:
# Ss   → Sleeping session leader (sshd, init, etc.)
# Ssl  → Sleeping session leader, multi-threaded (systemd, etc.)
# R+   → Running foreground process
# S+   → Sleeping foreground process (vim, less, etc.)
# Sl   → Sleeping multi-threaded process (Java, Node.js, etc.)
# S<   → Sleeping with high priority
# SN   → Sleeping with low priority
# Z+   → Zombie foreground process
# D+   → Foreground process waiting for I/O

# Filter by state using STAT
ps aux | awk '$8 ~ /Z/'          # Zombie processes only
ps aux | awk '$8 ~ /D/'          # I/O-waiting processes only (sign of disk issues)
ps aux | awk '$8 ~ /R/'          # Running processes only
ps aux | awk '$8 ~ /T/'          # Stopped processes only
```

### 1.4 Custom Output (-o / --format)

```bash
# Show only specific columns (-o / --format)
ps -eo pid,ppid,user,%cpu,%mem,stat,cmd --sort=-%cpu | head -20

# Commonly used custom formats
ps -eo pid,ppid,user,%cpu,%mem,rss,vsz,stat,etime,cmd --sort=-%mem | head -20

# Available format keywords (major ones)
# pid     Process ID
# ppid    Parent process ID
# pgid    Process group ID
# sid     Session ID
# uid     User ID
# user    Username
# gid     Group ID
# group   Group name
# %cpu    CPU usage rate
# %mem    Memory usage rate
# rss     Resident memory size (KB)
# vsz     Virtual memory size (KB)
# sz      Number of physical pages
# stat    Process state
# state   Process state (1 character)
# pri     Priority
# ni      Nice value
# tty     Controlling terminal
# time    Cumulative CPU time
# etime   Elapsed time (time since process start)
# etimes  Elapsed time (in seconds)
# cmd     Command (without arguments)
# args    Command (with arguments)
# comm    Command name only
# wchan   Kernel function name (where it is waiting)
# lstart  Start time (detailed format)
# nlwp    Number of threads

# Details of a specific process
ps -p 1234 -o pid,ppid,%cpu,%mem,rss,etime,lstart,cmd
# etime:  elapsed time (DD-HH:MM:SS format)
# lstart: start time (Wed Jan 15 14:30:00 2024 format)

# Custom headers
ps -eo pid=PID,user=USER,%cpu=CPU,%mem=MEM,cmd=COMMAND --sort=-%cpu | head -10

# No headers
ps -eo pid,%cpu,%mem,cmd --sort=-%cpu --no-headers | head -10

# Thread display
ps -eLo pid,tid,user,%cpu,%mem,cmd | head -20
# -L: Display threads on individual lines
# tid: Thread ID

# Process nice value and scheduling info
ps -eo pid,ni,pri,cls,cmd --sort=-ni | head -20
# ni:  nice value (-20 to 19, lower = higher priority)
# pri: kernel internal priority
# cls: scheduling class (TS=timeshare, FF=FIFO, RR=round-robin)
```

### 1.5 Sort Options

```bash
# Sort specification (--sort)
ps aux --sort=-%cpu                 # Highest CPU usage first (descending)
ps aux --sort=-%mem                 # Highest memory usage first
ps aux --sort=-rss                  # Largest resident memory first
ps aux --sort=-vsz                  # Largest virtual memory first
ps aux --sort=start_time            # Oldest start time first
ps aux --sort=-start_time           # Newest start time first
ps aux --sort=pid                   # By PID (ascending)
ps aux --sort=-etime               # Longest elapsed time first

# Multi-key sort
ps aux --sort=-%cpu,-%mem           # By CPU, then memory for ties

# Filter by specific command
ps -C nginx                         # Search by command name
ps -C nginx -o pid,%cpu,%mem,cmd    # With format specification
ps -C nginx,node,python -o pid,cmd  # Multiple command names
```

### 1.6 Combining with Pipes

```bash
# Search for nginx processes (grep pattern)
ps aux | grep nginx | grep -v grep
# grep -v grep: exclude grep itself

# pgrep is smarter (recommended)
pgrep -la nginx                  # PID + full command line
pgrep -l nginx                   # PID + process name
pgrep -u root -l                 # List of root processes
pgrep -c nginx                   # Count number of processes
pgrep -f "node.*server"          # Regex match against full command line
pgrep -P 1234                    # Child processes of parent PID 1234
pgrep -n nginx                   # PID of newest nginx process
pgrep -o nginx                   # PID of oldest nginx process
pgrep -x nginx                   # Exact match (prevents partial matches)

# pidof (get PIDs by exact match)
pidof nginx                      # All PIDs (space-separated)
pidof -s nginx                   # Get only one

# Parent-child process relationships
pstree -p                        # Tree with PIDs
pstree -p 1234                   # Descendants of a specific process
pstree -u                        # Show UID changes
pstree -a                        # Also show command line arguments
pstree -h                        # Highlight current process
pstree -H 1234                   # Highlight specified PID
pstree -s 1234                   # Show ancestors of specified PID
pstree -c                        # Do not collapse identical processes
pstree -g                        # Show process group IDs

# Practical pattern: process tree of a specific service
pstree -p $(pgrep -o nginx)      # Tree starting from nginx master process
```

---

## 2. top — Real-Time Monitoring

### 2.1 Detailed Screen Layout

```bash
top                              # Basic launch

# top screen layout (5 sections)
# ┌──────────────────────────────────────────────────────────┐
# │ top - 14:30:00 up 30 days, 2:15, 3 users, load avg: ... │ ← (1) Summary line
# │ Tasks: 256 total, 1 running, 254 sleeping, 1 stopped    │ ← (2) Tasks line
# │ %Cpu(s): 3.2 us, 1.1 sy, 0.0 ni, 95.5 id, 0.1 wa...   │ ← (3) CPU line
# │ MiB Mem:  16384.0 total,  8192.0 free,  4096.0 used..  │ ← (4) Memory line
# │ MiB Swap:  8192.0 total,  8192.0 free,     0.0 used..  │ ← (5) Swap line
# ├──────────────────────────────────────────────────────────┤
# │  PID USER  PR  NI    VIRT    RES    SHR S  %CPU  %MEM.. │ ← Process list
# └──────────────────────────────────────────────────────────┘
```

### 2.2 How to Read the Summary Lines

```
(1) Summary line:
top - 14:30:00 up 30 days, 2:15, 3 users, load average: 1.50, 2.00, 1.80
      ↑          ↑                ↑         ↑      ↑      ↑     ↑
      current    uptime           users     1-min  5-min  15-min average

(2) Tasks line:
Tasks: 256 total, 1 running, 254 sleeping, 0 stopped, 1 zombie
       ↑          ↑           ↑             ↑          ↑
       total      running     sleeping      stopped    zombie
       ※ If zombie > 0, investigate the parent process

(3) CPU line:
%Cpu(s):  3.2 us,  1.1 sy,  0.0 ni, 95.5 id,  0.1 wa,  0.0 hi,  0.1 si,  0.0 st
          ↑        ↑        ↑        ↑         ↑        ↑        ↑        ↑
          user     system   nice     idle      iowait   hw-irq   sw-irq   steal

Meaning of each value:
  us (user):     User-space processes (no nice value change)
  sy (system):   Kernel-space processing
  ni (nice):     User processes with modified nice values
  id (idle):     Idle (doing nothing)
  wa (iowait):   Waiting for I/O completion ← indicator of disk bottleneck
  hi (hardware): Hardware interrupt handling
  si (software): Software interrupt handling (network processing, etc.)
  st (steal):    Time stolen by the host in a virtualized environment ← important in cloud

Patterns to watch for:
  High wa → Disk I/O is a bottleneck (consider SSD, I/O scheduler tuning)
  High sy → Heavy kernel processing (excess context switches, many syscalls)
  High st → VM CPU resource shortage (consider changing instance type)
  High us → Application consuming CPU (identify cause via profiling)

(4) Memory line:
MiB Mem:  16384.0 total,   2048.0 free,   8192.0 used,   6144.0 buff/cache
                            ↑              ↑               ↑
                            completely     used by         buffer/cache
                            free           processes

  ※ Linux aggressively uses memory for caching, so low free is not necessarily a problem
  ※ Actual free ≈ free + most of buff/cache
  ※ "avail Mem" (available memory) is a more accurate measure of free space

(5) Swap line:
MiB Swap:  8192.0 total,   8192.0 free,      0.0 used.    10240.0 avail Mem
                                               ↑            ↑
                                               swap used    available memory

  ※ If Swap used > 0 keeps increasing → sign of memory shortage
  ※ If avail Mem is below 10% of physical memory → consider adding more memory
```

### 2.3 Process List Columns

```bash
# Columns in the process list:
#  PID  USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
#  1234 gaku      20   0  524288  37120  15360 S   5.2   2.3   0:42.50 node

# PID:     Process ID
# USER:    Owner
# PR:      Kernel internal priority (rt = real-time)
# NI:      Nice value (-20 to 19)
# VIRT:    Virtual memory (equivalent to VSZ)
# RES:     Resident memory (equivalent to RSS)
# SHR:     Shared memory (libraries, etc.)
# S:       State (R/S/D/Z/T)
# %CPU:    CPU usage rate (value during the most recent update interval)
# %MEM:    Physical memory usage rate
# TIME+:   Cumulative CPU time (in 1/100 second units)
# COMMAND: Command name

# Difference between top and ps %CPU:
#   top: instantaneous CPU usage during the most recent update interval (default 3 seconds)
#   ps:  average CPU usage over the entire lifetime of the process
#   → top reflects real-time load more accurately
```

### 2.4 Interactive Keys in top

```bash
# Keys available while top is running (ones worth memorizing)

# === Sorting ===
# P:  Sort by CPU usage (default)
# M:  Sort by memory usage
# T:  Sort by cumulative CPU time
# N:  Sort by PID
# R:  Reverse the current sort order

# === Display Toggles ===
# 1:  Toggle per-core / aggregate CPU display (essential for multi-core check)
# c:  Toggle between command name / full command line
# H:  Toggle thread display on/off
# V:  Tree view (parent-child process relationships)
# e:  Cycle memory units (KB→MB→GB→TB→PB)
# E:  Cycle memory units in summary lines
# m:  Toggle memory line display format (numeric/bar)
# t:  Toggle tasks/CPU line display format
# l:  Toggle load average line on/off
# 0:  Toggle display of zero values

# === Filtering ===
# u:  Filter by user (type username)
# o:  Add filter condition (e.g., %CPU>10, COMMAND=nginx)
# O:  Add filter condition (case-insensitive)
# =:  Clear filters

# === Actions ===
# k:  Kill a process (enter PID and signal)
# r:  Change nice value of a process (renice)
# d:  Change update interval (enter seconds)
# s:  Change update interval (same as above)

# === Settings ===
# f:  Select and reorder display columns
# W:  Save current settings to ~/.toprc
# q:  Quit

# Filter examples:
# Press o and enter the following:
#   %CPU>5.0          → Only processes using more than 5% CPU
#   COMMAND=java       → Only processes containing "java"
#   %MEM>10.0          → More than 10% memory
#   USER=gaku          → Only user gaku
#   !COMMAND=kworker   → Exclude kworker
```

### 2.5 top Command-Line Options

```bash
# Batch mode (for scripts)
top -bn1                         # Output once and exit
top -bn1 | head -20              # Top 20 lines only
top -bn1 -o %MEM | head -20     # Output once sorted by memory

# Specify update interval
top -d 1                         # Update every 1 second
top -d 0.5                       # Every 0.5 seconds

# Show only specific user's processes
top -u gaku
top -u root

# Monitor only specific PIDs
top -p 1234                      # One process
top -p 1234,5678,9012            # Multiple processes

# Thread display
top -H                           # Display threads individually
top -H -p 1234                   # Monitor threads of a specific process

# Secure mode
top -s                           # Disable kill, renice, and similar operations

# Batch mode usage examples
# Record top 10 CPU consumers
top -bn1 -o %CPU | head -17 > /tmp/cpu_snapshot_$(date +%H%M%S).txt

# Record every 5 seconds, 10 times (50 seconds of trend)
top -bn10 -d 5 -o %CPU | head -17 > /tmp/cpu_trend.txt

# Record CPU usage trend of a specific process
while true; do
    echo "$(date +%H:%M:%S) $(top -bn1 -p 1234 | tail -1 | awk '{print $9, $10}')"
    sleep 5
done >> /tmp/process_cpu_trend.log
```

### 2.6 Deep Understanding of Load Average

```
load average: 1.50, 2.00, 1.80
              ↑     ↑     ↑
              1min  5min  15min

Meaning: "Exponential moving average of processes in Running (R) + run queue (R) + I/O wait (D)"

Important: Linux load average also includes processes waiting for I/O (D state)
  → This differs from other UNIX systems (FreeBSD, etc.)
  → In I/O-heavy environments, load can be high even when CPU has headroom

Guidelines (compare against number of CPU cores):
  Check core count:
    nproc                         # Number of cores
    lscpu | grep "^CPU(s):"      # Details
    cat /proc/cpuinfo | grep processor | wc -l  # Logical core count

  For a 4-core machine:
    load avg < 4.0  → Normal (headroom available)
    load avg ≈ 4.0  → Running at full capacity
    load avg > 4.0  → Overloaded (processes queued for CPU)
    load avg > 8.0  → Severely overloaded (possible response delays)
    load avg > 16.0 → Critical (service impact likely)

  Trend analysis of load avg:
    1min > 5min > 15min  → Load is rising (caution)
    1min < 5min < 15min  → Load is falling (improving)
    1min ≈ 5min ≈ 15min  → Stable state

  Investigation steps when load is high:
    1. Check the CPU line (us, sy, wa, st) in top
       - High wa → Disk I/O is the cause
       - High us → Application is the cause
       - High sy → Kernel processing is the cause
       - High st → Virtualization resource shortage
    2. ps aux --sort=-%cpu | head -10  to identify CPU-consuming processes
    3. iostat -x 1  to check disk I/O
    4. vmstat 1     to check overall system state
```

---

## 3. htop — Modern Process Monitor

### 3.1 Installation and Launch

```bash
# Installation
# macOS:
brew install htop

# Ubuntu/Debian:
sudo apt install htop

# CentOS/RHEL:
sudo yum install htop
# or
sudo dnf install htop

# Arch Linux:
sudo pacman -S htop

# Basic launch
htop
```

### 3.2 Screen Layout

```bash
# htop screen layout
# ┌──────────────────────────────────────────────┐
# │ CPU[||||||||||||       35%]  Tasks: 142, 1 run│  ← CPU meter
# │ CPU[|||              12%]   Load: 1.50 2.00  │  ← Per-core display
# │ CPU[||||||           25%]   Uptime: 30 days  │
# │ CPU[|                 5%]                    │
# │ Mem[|||||||||||||||  4.2G/16.0G]             │  ← Memory meter
# │ Swp[                 0K/8.0G]               │  ← Swap meter
# ├──────────────────────────────────────────────┤
# │  PID USER    PRI  NI  VIRT  RES  SHR S CPU% │  ← Process list
# │  1234 gaku    20   0  512M  36M  15M S  5.2 │     Color display
# │  5678 root    20   0  256M  18M  12M S  2.1 │     Tree view supported
# │  ...                                         │     Mouse operation supported
# ├──────────────────────────────────────────────┤
# │ F1Help F2Setup F3Search F4Filter F5Tree F6So │  ← Function keys
# │ F7Nice- F8Nice+ F9Kill F10Quit              │
# └──────────────────────────────────────────────┘

# CPU meter color meanings (default)
#   Green:  User processes (normal load)
#   Red:    Kernel processes (system load)
#   Blue:   Low-priority processes (high nice value)
#   Cyan:   Virtualization steal time
#   Yellow: I/O wait time

# Memory meter color meanings
#   Green:  Used memory
#   Blue:   Buffers
#   Yellow: Cache
```

### 3.3 htop Operation Keys

```bash
# === Basic Operations ===
# F1 / h:     Help screen
# F2 / S:     Settings screen (change meters, colors, display columns, etc.)
# F3 / /:     Incremental search
# F4 / \:     Filter (filter displayed processes by string)
# F5 / t:     Toggle tree view on/off
# F6 / >:     Select sort column
# F7 / ]:     Decrease nice value (increase priority)
# F8 / [:     Increase nice value (decrease priority)
# F9 / k:     Send signal (kill process)
# F10 / q:    Quit

# === Display Operations ===
# Space:      Mark a process (multi-select)
# c:          Tag marked processes
# U:          Clear all marks
# u:          Filter by user
# H:          Show/hide user threads
# K:          Show/hide kernel threads
# p:          Show full path of process
# m:          Toggle memory sort
# T:          Sort by CPU time

# === Advanced Operations ===
# l:          List files opened by the process (lsof)
# s:          Trace system calls of the process (strace)
# e:          Show environment variables of the process
# w:          Check process via /proc/PID/wchan
# i:          Show I/O information of the process
# M:          Show library mappings (memory map)

# === Difference Between Search and Filter ===
# F3 (Search): Move cursor to process by name (press F3 again to find next)
# F4 (Filter): Show only matching processes (hide others)
# → Filter is easier to read
```

### 3.4 htop Command-Line Options

```bash
# User filter
htop -u gaku                     # Only processes of user gaku

# Specific PIDs only
htop -p 1234,5678                # Show only specified PIDs

# Start in tree mode
htop -t                          # Tree view as default

# Update interval (unit: 1/10 second)
htop -d 10                       # 1-second interval (10 × 0.1s)
htop -d 50                       # 5-second interval

# Start with specified sort column
htop --sort-key=PERCENT_CPU      # Sort by CPU usage
htop --sort-key=PERCENT_MEM      # Sort by memory usage
htop --sort-key=M_RESIDENT       # Sort by RSS

# Monochrome display
htop -C                          # No color

# Specify delay count
htop --delay=20                  # 2-second interval
```

### 3.5 htop Settings (F2)

```bash
# Open settings screen with F2

# Meters (meter settings)
# Add, remove, and rearrange meters displayed in the header
# Available meters:
#   - CPU usage (overall/per-core)
#   - Memory usage
#   - Swap usage
#   - Task count
#   - Load average
#   - Uptime
#   - Battery
#   - Hostname
#   - Clock
#   - Disk I/O
#   - Network I/O

# Display options
# - Tree view
# - Shadow display
# - Count display
# - How to display process path

# Colors (color scheme)
# - Default
# - Monochrome
# - Black on White
# - Light Terminal
# - MC

# Columns (display column settings)
# Add, remove, and reorder columns in the process list
# Settings are saved in ~/.config/htop/htoprc
```

---

## 4. Other Monitoring Tools

### 4.1 glances — Integrated System Monitor

```bash
# Installation
pip install glances
# or
brew install glances                # macOS
sudo apt install glances            # Ubuntu

# Basic launch
glances

# Features of glances:
# - Displays CPU + memory + disk + network + processes on one screen
# - Alert functionality (color changes when threshold is exceeded)
# - Web UI mode
# - API mode (retrieve data via RESTful API)
# - CSV/JSON export

# Web UI mode (monitor remotely from a browser)
glances -w                        # Connect at http://localhost:61208
glances -w --bind 0.0.0.0         # Listen on all interfaces

# Client/server mode
glances -s                        # Start as server
glances -c server-ip              # Connect as client

# CSV export
glances --export csv --export-csv-file /tmp/glances.csv

# JSON export
glances --stdout cpu.total,mem.percent,load
```

### 4.2 btop — Beautiful Resource Monitor

```bash
# Installation
brew install btop                 # macOS
sudo apt install btop             # Ubuntu 22.04+
sudo snap install btop            # Snap

# Basic launch
btop

# Features of btop:
# - Beautiful graphical display (graphs for CPU/memory/network/disk)
# - Mouse operation support
# - Themeable
# - Process filtering/sorting
# - Config file: ~/.config/btop/btop.conf
```

### 4.3 /proc Filesystem (Linux)

```bash
# /proc is a virtual filesystem provided by the kernel
# Provides access to detailed information about processes and the system

# === Per-process information (/proc/PID/) ===

# Detailed process information
cat /proc/1234/status
# Name:   nginx
# State:  S (sleeping)
# Tgid:   1234
# Pid:    1234
# PPid:   1
# VmPeak: 524288 kB    ← Peak virtual memory value
# VmSize: 524288 kB    ← Current virtual memory size
# VmRSS:  37120 kB     ← Resident memory size
# VmSwap: 0 kB         ← Swapped-out size
# Threads: 4           ← Number of threads

# Command line
cat /proc/1234/cmdline | tr '\0' ' '
# /usr/sbin/nginx -g daemon off;

# Environment variables
cat /proc/1234/environ | tr '\0' '\n'
# HOME=/root
# PATH=/usr/local/sbin:/usr/local/bin:...

# File descriptor list
ls -l /proc/1234/fd
# lrwx------ 1 root root 64 ... 0 -> /dev/null
# l-wx------ 1 root root 64 ... 1 -> /var/log/nginx/access.log
# l-wx------ 1 root root 64 ... 2 -> /var/log/nginx/error.log
# lrwx------ 1 root root 64 ... 3 -> socket:[12345]

# Number of file descriptors
ls /proc/1234/fd | wc -l

# Memory map
cat /proc/1234/maps | head -20
# Each line: start-end permissions offset device inode pathname

# Process resource limits
cat /proc/1234/limits
# Max open files      65536     65536     files

# Process I/O statistics
cat /proc/1234/io
# rchar:  bytes read
# wchar:  bytes written
# read_bytes:  actual disk reads
# write_bytes: actual disk writes

# Process cgroup information
cat /proc/1234/cgroup

# === System-wide information ===
cat /proc/loadavg                # Load average
cat /proc/meminfo                # Detailed memory information
cat /proc/cpuinfo                # CPU information
cat /proc/uptime                 # Uptime (in seconds)
cat /proc/version                # Kernel version
cat /proc/stat                   # CPU statistics
cat /proc/diskstats              # Disk I/O statistics
cat /proc/net/dev                # Network I/O statistics
```

### 4.4 lsof — Open Files/Sockets

```bash
# lsof (List Open Files): lists files opened by processes
# In Linux, "everything is a file" → sockets and pipes are also targets

# Files opened by a specific PID
lsof -p 1234

# Processes using a port
lsof -i :8080                    # Port 8080
lsof -i :80,443                  # Multiple ports
lsof -i TCP:3000                 # TCP port 3000
lsof -i UDP:53                   # UDP port 53
lsof -i TCP                      # All TCP connections
lsof -i -P -n                   # No name resolution (faster)

# Files opened by a user
lsof -u gaku
lsof -u gaku -c python           # User + command name

# Processes with files open in a directory
lsof +D /var/log                 # Files inside /var/log
lsof +d /var/log                 # /var/log top level only (no recursion)

# Deleted files still open (why disk space is not freed)
lsof +L1
# Solution: restart the process, or truncate /proc/PID/fd/N

# Check network connections
lsof -i -P -n | grep LISTEN     # List of listening ports
lsof -i -P -n | grep ESTABLISHED # List of established connections

# Processes with a specific file open
lsof /var/log/syslog             # Specific file

# Investigate NFS lock issues
lsof -N                          # Processes with NFS files open
```

### 4.5 vmstat / iostat / mpstat

```bash
# vmstat — Virtual memory statistics (system-wide overview)
vmstat 1 5                       # Display 5 times at 1-second intervals
# procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
#  r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
#  1  0      0 8192000 256000 4096000  0    0    10    20  500  800  3  1 95  1  0

# r: Number of processes waiting for CPU (overloaded if >= number of cores)
# b: Number of processes waiting for I/O (D state)
# si/so: Swap in/swap out (memory shortage if non-zero continuously)
# bi/bo: Disk I/O (blocks/sec)
# in: Interrupts/sec
# cs: Context switches/sec

# iostat — Disk I/O statistics
iostat -x 1 5                    # Extended stats, 5 times at 1-second intervals
# Device  r/s   w/s  rkB/s  wkB/s  await  %util
# sda     50.0  30.0 2000.0 1500.0  5.00  40.0

# %util: Disk utilization (bottleneck if close to 100%)
# await: Average I/O wait time (milliseconds)

# mpstat — Per-CPU statistics
mpstat -P ALL 1 5                # All CPUs, 5 times at 1-second intervals
# Check whether load is concentrated on a specific CPU core
```

---

## 5. Practical Patterns

### 5.1 Investigating CPU Bottlenecks

```bash
# Step 1: Get the big picture
top -bn1 | head -5
# Check load average and the CPU line

# Step 2: Identify CPU-consuming processes
ps aux --sort=-%cpu | head -10
# or
top -bn1 -o %CPU | head -15

# Step 3: Detailed check of a specific process
ps -p 1234 -o pid,ppid,%cpu,%mem,etime,ni,stat,cmd
# etime: how long it has been running
# ni: nice value (priority)

# Step 4: Check at the thread level
ps -p 1234 -L -o pid,tid,%cpu,cmd | sort -k3 -rn | head -10
# Which thread is consuming CPU

# Step 5: Check system calls with strace (advanced)
strace -p 1234 -c -T             # Statistics of system calls
strace -p 1234 -e trace=write    # Only the write system call
```

### 5.2 Investigating Memory Leaks

```bash
# Pattern 1: Continuous monitoring of memory usage
watch -n 5 'ps -p 1234 -o pid,rss,vsz,%mem,etime'
# Display memory usage every 5 seconds
# RSS that keeps increasing over time → suspected memory leak

# Pattern 2: Record memory usage
while true; do
    echo "$(date +%Y-%m-%d_%H:%M:%S) $(ps -p 1234 -o rss=,vsz=,%mem= --no-headers)"
    sleep 60
done >> /tmp/memory_monitor_1234.log

# Pattern 3: Periodic recording of top memory processes
while true; do
    echo "=== $(date) ==="
    ps aux --sort=-rss | head -11
    echo ""
    sleep 300
done >> /tmp/memory_top_processes.log

# Pattern 4: Track system-wide memory usage over time
while true; do
    echo "$(date +%H:%M:%S) $(free -m | awk '/Mem:/ {printf "used:%sMB free:%sMB avail:%sMB", $3, $4, $7}')"
    sleep 10
done >> /tmp/system_memory.log

# Pattern 5: Detailed memory info from /proc
cat /proc/1234/status | grep -E "^Vm|^Rss|^Threads"
cat /proc/1234/smaps_rollup       # Summary of memory mappings

# Pattern 6: Check memory map with pmap
pmap -x 1234 | tail -5           # Memory map of the process
pmap -x 1234 | sort -k3 -rn | head -10  # Sorted by size
```

### 5.3 Handling Zombie Processes

```bash
# Find zombie processes
ps aux | awk '$8 ~ /Z/ {print}'
# or
ps -eo pid,ppid,stat,cmd | grep -E "Z"

# Check the number of zombies
ps aux | awk '$8 ~ /Z/' | wc -l

# Identify the parent process of zombies
ps -eo pid,ppid,stat,cmd | awk '$3 ~ /Z/ {print "Zombie PID:", $1, "Parent PID:", $2}'

# Check parent process information
ps -p <parent PID> -o pid,cmd,stat

# Solution 1: Send SIGCHLD to the parent process
kill -SIGCHLD <parent PID>

# Solution 2: Terminate the parent process
kill <parent PID>
# When the parent exits, zombies are adopted by init (PID 1) and automatically cleaned up

# Solution 3: For large numbers of zombies
# Aggregate parent PIDs of zombies
ps -eo ppid,stat | grep Z | awk '{print $1}' | sort | uniq -c | sort -rn

# Note: Zombie processes cannot be removed with kill -9 (they are already dead)
# Zombies only consume a process table entry (CPU/memory usage is near zero)
# A few zombies are not a problem, but if they keep growing it indicates a bug in the parent
```

### 5.4 Investigating Port Usage

```bash
# Identify the process using a port (multiple methods)

# lsof (common to macOS/Linux)
lsof -i :3000                    # Port 3000
lsof -i TCP:3000 -P -n           # TCP only, no name resolution

# ss (Linux, faster than netstat)
ss -tlnp | grep 3000             # TCP listen
ss -tunlp                        # Full list of TCP/UDP listeners
# -t: TCP  -u: UDP  -l: LISTEN  -n: numeric  -p: show process

# netstat (old method, for legacy environments)
netstat -tlnp | grep 3000

# fuser (directly identify the process using a port)
fuser 3000/tcp                   # PID of port 3000/TCP
fuser -v 3000/tcp                # Verbose output
fuser -k 3000/tcp                # Kill the process using port 3000/TCP
```

### 5.5 Comprehensive System Diagnostic Script

```bash
#!/bin/bash
# system_health_check.sh - System health check script

echo "=============================================="
echo "System Health Check: $(date)"
echo "Hostname: $(hostname)"
echo "=============================================="

echo ""
echo "--- Load Average ---"
uptime
CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1)
echo "CPU core count: $CORES"
LOAD1=$(cat /proc/loadavg 2>/dev/null | awk '{print $1}' || uptime | awk -F'[,:]' '{print $(NF-2)}' | tr -d ' ')
echo "Load/Core ratio: $(echo "$LOAD1 / $CORES" | bc -l 2>/dev/null | head -c 5)"

echo ""
echo "--- Memory Usage ---"
free -m 2>/dev/null || vm_stat 2>/dev/null
echo ""

echo "--- Disk Usage ---"
df -h | grep -vE "tmpfs|devtmpfs|overlay"
echo ""

echo "--- Top 5 CPU-Consuming Processes ---"
ps aux --sort=-%cpu | head -6 2>/dev/null || ps aux | sort -k3 -rn | head -6
echo ""

echo "--- Top 5 Memory-Consuming Processes ---"
ps aux --sort=-rss | head -6 2>/dev/null || ps aux | sort -k6 -rn | head -6
echo ""

echo "--- Zombie Processes ---"
ZOMBIES=$(ps aux 2>/dev/null | awk '$8 ~ /Z/' | wc -l)
echo "Zombie count: $ZOMBIES"
if [ "$ZOMBIES" -gt 0 ]; then
    ps aux | awk '$8 ~ /Z/ {print}'
fi

echo ""
echo "--- D-state (I/O-waiting) Processes ---"
DSTATE=$(ps aux 2>/dev/null | awk '$8 ~ /D/' | wc -l)
echo "D-state process count: $DSTATE"
if [ "$DSTATE" -gt 0 ]; then
    ps aux | awk '$8 ~ /D/ {print}'
fi

echo ""
echo "--- Listening Ports ---"
ss -tlnp 2>/dev/null | head -20 || lsof -i -P -n 2>/dev/null | grep LISTEN | head -20

echo ""
echo "--- ESTABLISHED Connection Count ---"
ss -tn state established 2>/dev/null | wc -l || netstat -tn 2>/dev/null | grep ESTABLISHED | wc -l

echo ""
echo "--- Disk I/O ---"
iostat -x 1 1 2>/dev/null | tail -10

echo ""
echo "--- Recent OOM Kills ---"
dmesg 2>/dev/null | grep -i "out of memory\|oom" | tail -5

echo ""
echo "=============================================="
echo "Check complete"
echo "=============================================="
```

### 5.6 Process Resource Monitoring Script

```bash
#!/bin/bash
# process_monitor.sh - Continuous monitoring of a specific process
# Usage: ./process_monitor.sh <PID> [interval seconds] [output file]

PID="${1:?Usage: $0 <PID> [interval seconds] [output file]}"
INTERVAL="${2:-10}"
OUTPUT="${3:-/tmp/process_monitor_${PID}.csv}"

if ! kill -0 "$PID" 2>/dev/null; then
    echo "Error: PID $PID does not exist" >&2
    exit 1
fi

PROCESS_NAME=$(ps -p "$PID" -o comm= 2>/dev/null)
echo "Monitoring started: PID=$PID ($PROCESS_NAME), interval=${INTERVAL}s"
echo "Output file: $OUTPUT"
echo "Press Ctrl+C to stop"
echo ""

# CSV header
echo "timestamp,pid,cpu_pct,mem_pct,rss_kb,vsz_kb,threads,fd_count,state" > "$OUTPUT"

trap 'echo ""; echo "Monitoring ended: $(wc -l < "$OUTPUT") records written"; exit 0' INT TERM

while kill -0 "$PID" 2>/dev/null; do
    TIMESTAMP=$(date +%Y-%m-%d_%H:%M:%S)

    # Get process info from ps
    PS_DATA=$(ps -p "$PID" -o %cpu=,%mem=,rss=,vsz=,nlwp=,stat= --no-headers 2>/dev/null)
    if [ -z "$PS_DATA" ]; then
        echo "Process $PID has exited"
        break
    fi

    CPU=$(echo "$PS_DATA" | awk '{print $1}')
    MEM=$(echo "$PS_DATA" | awk '{print $2}')
    RSS=$(echo "$PS_DATA" | awk '{print $3}')
    VSZ=$(echo "$PS_DATA" | awk '{print $4}')
    THREADS=$(echo "$PS_DATA" | awk '{print $5}')
    STATE=$(echo "$PS_DATA" | awk '{print $6}')

    # File descriptor count
    FD_COUNT=$(ls /proc/"$PID"/fd 2>/dev/null | wc -l)

    echo "$TIMESTAMP,$PID,$CPU,$MEM,$RSS,$VSZ,$THREADS,$FD_COUNT,$STATE" >> "$OUTPUT"

    # Also display a summary on screen
    printf "\r%s CPU:%s%% MEM:%s%% RSS:%sKB Threads:%s FDs:%s State:%s" \
        "$TIMESTAMP" "$CPU" "$MEM" "$RSS" "$THREADS" "$FD_COUNT" "$STATE"

    sleep "$INTERVAL"
done

echo ""
echo "Monitoring ended: $(wc -l < "$OUTPUT") records → $OUTPUT"
```

### 5.7 Monitoring Script with Alerts

```bash
#!/bin/bash
# alert_monitor.sh - Monitoring that alerts when thresholds are exceeded
# Usage: ./alert_monitor.sh

CPU_THRESHOLD=80     # CPU usage threshold (%)
MEM_THRESHOLD=90     # Memory usage threshold (%)
LOAD_THRESHOLD_RATIO=2  # Threshold for load average / core count
CHECK_INTERVAL=30    # Check interval (seconds)
LOG_FILE="/tmp/alert_monitor.log"

CORES=$(nproc 2>/dev/null || echo 4)
LOAD_THRESHOLD=$(echo "$CORES * $LOAD_THRESHOLD_RATIO" | bc)

log_alert() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $1"
    echo "$msg" | tee -a "$LOG_FILE"
}

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$LOG_FILE"
}

echo "Monitoring started (CPU>${CPU_THRESHOLD}%, MEM>${MEM_THRESHOLD}%, Load>${LOAD_THRESHOLD})"
echo "Log file: $LOG_FILE"

while true; do
    # CPU check
    CPU_HOGGERS=$(ps aux --sort=-%cpu --no-headers | awk -v thresh="$CPU_THRESHOLD" '$3 > thresh {print $2, $3"%", $11}')
    if [ -n "$CPU_HOGGERS" ]; then
        log_alert "CPU threshold exceeded:"
        echo "$CPU_HOGGERS" | while read -r line; do
            log_alert "  $line"
        done
    fi

    # Memory check
    MEM_USED_PCT=$(free 2>/dev/null | awk '/Mem:/ {printf "%.0f", $3/$2*100}')
    if [ -n "$MEM_USED_PCT" ] && [ "$MEM_USED_PCT" -gt "$MEM_THRESHOLD" ]; then
        log_alert "Memory usage: ${MEM_USED_PCT}%"
        ps aux --sort=-rss --no-headers | head -5 | while read -r line; do
            log_alert "  Top RSS: $(echo "$line" | awk '{print $2, $6"KB", $11}')"
        done
    fi

    # Load Average check
    LOAD1=$(cat /proc/loadavg 2>/dev/null | awk '{print $1}')
    if [ -n "$LOAD1" ]; then
        OVER=$(echo "$LOAD1 > $LOAD_THRESHOLD" | bc -l 2>/dev/null)
        if [ "$OVER" = "1" ]; then
            log_alert "Load Average: $LOAD1 (threshold: $LOAD_THRESHOLD)"
        fi
    fi

    # Zombie check
    ZOMBIE_COUNT=$(ps aux 2>/dev/null | awk '$8 ~ /Z/' | wc -l)
    if [ "$ZOMBIE_COUNT" -gt 5 ]; then
        log_alert "Zombie processes: ${ZOMBIE_COUNT}"
    fi

    log_info "Check complete (CPU:OK MEM:${MEM_USED_PCT:-?}% Load:${LOAD1:-?})"
    sleep "$CHECK_INTERVAL"
done
```

---

## 6. Command Comparison Table

```
┌──────────────┬──────────────┬─────────────┬──────────────────┐
│ Feature      │ ps           │ top         │ htop             │
├──────────────┼──────────────┼─────────────┼──────────────────┤
│ Updates      │ Snapshot     │ Real-time   │ Real-time        │
│ Display      │ Text         │ TUI         │ Color TUI        │
│ Sort         │ --sort option│ Interactive │ Interactive/mouse│
│ Filter       │ grep/awk     │ u/o keys    │ F4 key           │
│ Tree view    │ axjf / f     │ V key       │ F5 key           │
│ kill         │ Separate cmd │ k key       │ F9 key           │
│ Customize    │ -o option    │ f key       │ F2 settings      │
│ For scripts  │ Best         │ -bn1 works  │ Not suitable     │
│ Mouse        │ None         │ None        │ Supported        │
│ Threads      │ -L / -T      │ H key       │ H key            │
│ Install      │ Standard     │ Standard    │ Additional install│
└──────────────┴──────────────┴─────────────┴──────────────────┘

Usage guide:
  Scripts and automation          → ps (stable output, pipes well)
  Interactive troubleshooting     → htop (most user-friendly)
  Environments without htop       → top (available everywhere)
  Detailed investigation of a PID → ps -p PID -o ...
  Periodic server monitoring      → top -bn1 (cron + log recording)
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
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
        assert False, "Should have raised an exception"
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
        """Remove by key"""
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

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / resource shortage | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check running user's permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Use logging or a debugger to verify hypotheses
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
    """Decorator that logs function input/output"""
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
3. **Check I/O wait**: Examine the state of disk and network I/O
4. **Check concurrent connections**: Check the state of connection pools

| Issue type | Diagnostic tool | Countermeasure |
|------------|----------------|----------------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When it can be compromised |
|-----------|-------------------|--------------------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
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
│  ① Team size?                                   │
│    ├─ Small (1-5)  → Monolith                   │
│    └─ Large (10+)  → go to ②                    │
│                                                 │
│  ② Deployment frequency?                        │
│    ├─ Once a week or less → Monolith + modular  │
│    └─ Daily/multiple times → go to ③            │
│                                                 │
│  ③ Team independence?                           │
│    ├─ High   → Microservices                    │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster approach in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- Higher abstraction enables reuse, but can make debugging difficult
- Lower abstraction is intuitive, but tends to cause code duplication

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


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Command | Use | Commonly Used Options |
|---------|-----|-----------------------|
| ps aux | Process list (snapshot) | --sort, -o, -p, -u, -C |
| ps aux --sort=-%cpu | Sort by CPU usage | head -N for top N |
| pgrep -la name | Search by process name | -f (full command line), -c (count) |
| pstree -p | Process tree | -s (show ancestors), -a (show args) |
| top | Real-time monitoring (standard) | -bn1 (batch), -u (user), -p (PID) |
| htop | Real-time monitoring (feature-rich) | -t (tree), -u (user), -p (PID) |
| lsof -i :port | Identify process using a port | -P -n (faster) |
| vmstat 1 | System-wide statistics | Focus on r, b columns |

### Investigation Flowchart

```
Server is slow
  ├→ uptime: check load average
  │   ├→ load < core count → CPU has headroom → investigate app/network
  │   └→ load > core count → CPU bottleneck
  │       ├→ top: high us → ps --sort=-%cpu → optimize app
  │       ├→ top: high wa → iostat -x → improve disk I/O
  │       ├→ top: high sy → vmstat → excessive context switches
  │       └→ top: high st → scale up VM resources
  ├→ free -m: check memory
  │   ├→ avail > 10% → memory has headroom
  │   └→ avail < 10% → memory shortage
  │       └→ ps --sort=-rss → identify memory-consuming processes
  └→ df -h: check disk
      └→ usage > 90% → delete unused files or expand disk
```

---

## Further Reading

---

## References
1. Barrett, D. "Efficient Linux at the Command Line." Ch.8, O'Reilly, 2022.
2. Gregg, B. "Systems Performance: Enterprise and the Cloud." 2nd Ed, Addison-Wesley, 2020.
3. Evi Nemeth et al. "UNIX and Linux System Administration Handbook." 5th Ed, Addison-Wesley, 2017.
4. "proc(5) — Linux manual page." man7.org.
5. "htop — an interactive process viewer." htop.dev.
