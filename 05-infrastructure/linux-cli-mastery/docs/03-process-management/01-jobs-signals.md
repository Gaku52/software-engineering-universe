# Job Control and Signals

> Shell job control and signals are the fundamental techniques for managing process lifecycles.
> These are essential concepts that underpin background processing, inter-process communication, and robust script writing.

## What You Will Learn

- [ ] Control foreground/background jobs
- [ ] Understand the types and usage of signals
- [ ] Use nohup / disown to keep processes running after session disconnect
- [ ] Set signal handlers with trap to write robust scripts
- [ ] Control parallel processing and timeouts with wait / timeout
- [ ] Understand the concepts of process groups and sessions


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Process Monitoring (ps, top, htop)](./00-ps-top-htop.md)

---

## 1. Job Control

### 1.1 Foreground and Background

```bash
# Foreground execution (default)
# → The terminal is blocked; no input is accepted until the command completes
sleep 100                        # Foreground execution

# Background execution (append & at the end)
# → The terminal is free; other commands can be run
sleep 100 &                      # Background execution
# [1] 12345                      ← Job number and PID are displayed

# Multiple background jobs
sleep 60 &                       # [1] 12345
sleep 120 &                      # [2] 12346
find / -name "*.log" > /tmp/logs.txt 2>/dev/null &  # [3] 12347

# stdout/stderr of background jobs
# Output from background jobs is mixed into the terminal output
# → Redirecting is best practice
long_task > output.log 2>&1 &    # Redirect output to a file

# Run in background and record PID
long_task &
PID=$!                           # $! = PID of the most recent background process
echo "Started with PID: $PID"
```

### 1.2 Listing Jobs and Checking Status

```bash
# List jobs
jobs                             # List jobs in the current shell
jobs -l                          # List with PIDs
jobs -r                          # Running jobs only
jobs -s                          # Stopped jobs only
jobs -p                          # Show PIDs only

# Example output:
# [1]+  Running    sleep 100 &
# [2]-  Stopped    vim file.txt
# [3]   Running    find / -name "*.log" > /tmp/logs.txt 2>/dev/null &
#  ↑ ↑   ↑
# Job number  Status
#    + = Current job (the last job operated on / started)
#    - = Previous job

# Job states:
# Running:    Executing (in background)
# Stopped:    Paused (stopped with Ctrl+Z)
# Done:       Completed (notified at next prompt)
# Terminated: Killed by signal
# Killed:     Forcefully terminated by SIGKILL
# Exit N:     Exited with code N
```

### 1.3 Switching Jobs

```bash
# Ctrl+Z: Pause a foreground job (sends SIGTSTP)
vim file.txt                     # Editing in vim
# Ctrl+Z                        # vim is paused (becomes Stopped)
# [1]+  Stopped    vim file.txt

# fg: Bring a job to the foreground
fg                               # Current job (the one marked with +)
fg %1                            # Bring job number 1 to foreground
fg %vim                          # Specify a job starting with vim
fg %?file                        # Specify a job containing "file"

# bg: Resume a stopped job in the background
bg                               # Resume current job in background
bg %2                            # Resume job number 2 in background

# Typical workflow
vim file.txt                     # Editing in vim
# Ctrl+Z                        # Pause
make build                       # Run build
fg                               # Return to vim

# Typical workflow 2: Move a foreground job to background
long_running_command              # Accidentally started in foreground
# Ctrl+Z                        # Pause
bg                               # Resume in background
# The terminal is now available

# Typical workflow 3: Switch between multiple editors
vim file1.txt                    # Edit
# Ctrl+Z
vim file2.txt                    # Edit another file
# Ctrl+Z
jobs                             # Check jobs
fg %1                            # Return to file1
```

### 1.4 Job Specification Syntax

```bash
# How to specify jobs
%1                               # Job number 1
%2                               # Job number 2
%%                               # Current job (same as %+)
%+                               # Current job (the last one operated on)
%-                               # Previous job (one before the current)
%string                          # Job whose command starts with string
%?string                         # Job whose command contains string

# Examples
fg %vim                          # Bring the job starting with vim to foreground
bg %2                            # Resume job 2 in background
kill %?sleep                     # Kill the job containing sleep
kill %%                          # Kill the current job
kill %1 %2 %3                   # Kill multiple jobs
wait %1                          # Wait for job 1 to complete

# Note: Job numbers are independent per shell
# Jobs in other terminals/shells are not accessible
# → Use the kill command with PIDs in that case
```

### 1.5 Caveats for Background Jobs

```bash
# Caveat 1: Output from background jobs mixes into the terminal
long_task &
# → Output may interrupt the prompt
# Solution: Redirect output
long_task > /tmp/output.log 2>&1 &

# Caveat 2: Input for background jobs
# A background job that requests terminal input will be stopped automatically
cat &                            # Automatically stopped while waiting for input
# [1]+  Stopped    cat

# Caveat 3: SIGHUP is sent to background jobs when the shell exits
# → Use nohup or disown (described later)

# Caveat 4: bash huponexit option
shopt -s huponexit               # Send SIGHUP to all jobs on shell exit (default: OFF)
shopt -u huponexit               # Do not send SIGHUP

# Caveat 5: Background jobs in scripts
#!/bin/bash
task1 &
task2 &
wait                             # Wait for all background jobs to complete
echo "All tasks completed"
# Forgetting wait causes the script to exit before jobs complete
```

---

## 2. Signals

### 2.1 Signal Basics

```bash
# What is a signal: An asynchronous notification mechanism from the kernel to a process
# A mechanism for controlling processes (termination, stop, resume, etc.)

# List signals
kill -l                          # List all signals (by name)
kill -l 15                       # Signal number → name (TERM)
kill -l TERM                     # Signal name → number (15)

# Signal delivery:
# 1. User sends a signal (kill command, Ctrl+C, etc.)
# 2. Kernel delivers the signal to the process
# 3. Process handles the signal:
#    a. Execute default action (terminate, stop, etc.)
#    b. Execute custom handler (set with trap)
#    c. Ignore the signal (only for some signals)
#    ※ SIGKILL and SIGSTOP cannot be caught or ignored
```

### 2.2 Key Signals in Detail

```bash
# ┌────────┬───────────┬──────────────────┬─────────────────────────────────┐
# │ Number │ Name      │ Default Action   │ Purpose / Description           │
# ├────────┼───────────┼──────────────────┼─────────────────────────────────┤
# │  1     │ SIGHUP    │ Terminate        │ Hang up / Reload configuration  │
# │  2     │ SIGINT    │ Terminate        │ Ctrl+C (interrupt)              │
# │  3     │ SIGQUIT   │ Core dump+term   │ Ctrl+\ (quit for debugging)     │
# │  6     │ SIGABRT   │ Core dump+term   │ Called by abort()               │
# │  9     │ SIGKILL   │ Force terminate  │ Uncatchable (last resort)       │
# │ 11     │ SIGSEGV   │ Core dump+term   │ Segmentation fault              │
# │ 13     │ SIGPIPE   │ Terminate        │ Write to broken pipe            │
# │ 14     │ SIGALRM   │ Terminate        │ alarm() timer expiry            │
# │ 15     │ SIGTERM   │ Terminate        │ Graceful termination (kill default) │
# │ 17     │ SIGCHLD   │ Ignore           │ Child process state change      │
# │ 18     │ SIGCONT   │ Resume           │ Resume a stopped process        │
# │ 19     │ SIGSTOP   │ Stop             │ Uncatchable pause               │
# │ 20     │ SIGTSTP   │ Stop             │ Ctrl+Z (terminal stop)          │
# │ 21     │ SIGTTIN   │ Stop             │ Background process reads input  │
# │ 22     │ SIGTTOU   │ Stop             │ Background process writes output│
# │ 28     │ SIGWINCH  │ Ignore           │ Terminal window resize          │
# │ 10     │ SIGUSR1   │ Terminate        │ User-defined signal 1           │
# │ 12     │ SIGUSR2   │ Terminate        │ User-defined signal 2           │
# └────────┴───────────┴──────────────────┴─────────────────────────────────┘

# Note: Signal numbers may differ depending on OS/architecture
# → Using names in scripts is safer (kill -TERM, kill -HUP)

# Special properties of SIGKILL (9) and SIGSTOP (19):
# - Cannot be caught (trap)
# - Cannot be ignored
# - Cannot be blocked
# → Handled directly by the kernel
```

### 2.3 Sending Signals

```bash
# kill command (misleading name — it sends any signal to a process)
kill 1234                        # SIGTERM (default)
kill -15 1234                    # SIGTERM (by number)
kill -TERM 1234                  # SIGTERM (by name)
kill -s TERM 1234                # SIGTERM (-s option)

kill -9 1234                     # SIGKILL (force terminate)
kill -KILL 1234                  # SIGKILL (by name)

kill -HUP 1234                   # SIGHUP (reload configuration)
kill -USR1 1234                  # SIGUSR1 (user-defined)
kill -USR2 1234                  # SIGUSR2 (user-defined)

kill -CONT 1234                  # SIGCONT (resume a stopped process)
kill -STOP 1234                  # SIGSTOP (force stop)

kill -0 1234                     # No signal sent (check if process exists)
if kill -0 1234 2>/dev/null; then
    echo "PID 1234 exists"
else
    echo "PID 1234 does not exist"
fi

# Send to multiple processes
kill 1234 5678 9012              # Send to multiple PIDs
kill -TERM 1234 5678             # Send TERM to multiple PIDs

# killall — send signal by process name
killall nginx                    # Send TERM to all processes named nginx
killall -9 nginx                 # Force kill all nginx processes
killall -u gaku python           # Kill python processes owned by user gaku
killall -i nginx                 # Interactive confirmation prompt (one by one)
killall -v nginx                 # Verbose output
killall -w nginx                 # Wait until all processes terminate
killall -e "python3 server.py"   # Exact match
killall -s HUP nginx             # Specify signal
killall -o 1h nginx              # Processes started more than 1 hour ago
killall -y 30m nginx             # Processes started within 30 minutes

# pkill — send signal with flexible pattern matching
pkill nginx                      # Send TERM to processes matching nginx
pkill -9 nginx                   # Force kill
pkill -f "python server.py"      # Match against the full command line
pkill -u root nginx              # Specify user
pkill -u root -HUP nginx         # User + signal
pkill -P 1234                    # Send TERM to children of parent PID 1234
pkill -t pts/0                   # Send TERM to processes on terminal pts/0
pkill -g 1234                    # Send TERM to process group 1234
pkill -x nginx                   # Exact match
pkill --signal HUP nginx         # Specify signal (long option form)
pkill -c nginx                   # Display count of matched processes
pkill -e nginx                   # Display killed processes

# Send signal to an entire process group
kill -TERM -1234                 # Prepend minus to PID → process group
kill -- -1234                    # Use -- to distinguish negative numbers
```

### 2.4 Correct Signal Usage (Graceful Termination)

```bash
# === Recommended gradual termination procedure ===

# Step 1: Request graceful termination (SIGTERM)
kill 1234                        # SIGTERM
# → The process gets a chance to run cleanup and exit

# Step 2: Wait a few seconds
sleep 5

# Step 3: If still alive, force kill (SIGKILL)
kill -0 1234 2>/dev/null && kill -9 1234

# One-liner version
kill 1234; sleep 5; kill -0 1234 2>/dev/null && kill -9 1234

# Script version (as a function)
graceful_kill() {
    local pid=$1
    local timeout=${2:-10}  # Default 10 seconds

    # Check if process exists
    if ! kill -0 "$pid" 2>/dev/null; then
        echo "PID $pid no longer exists"
        return 0
    fi

    # Send SIGTERM
    echo "Sending SIGTERM to PID $pid..."
    kill "$pid"

    # Wait up to timeout seconds
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "PID $pid terminated gracefully"
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    # If still alive, send SIGKILL
    echo "Timeout. Sending SIGKILL to PID $pid..."
    kill -9 "$pid"
    sleep 1

    if kill -0 "$pid" 2>/dev/null; then
        echo "Warning: PID $pid did not exit even with SIGKILL (may be in D state)"
        return 1
    fi

    echo "PID $pid forcefully terminated"
    return 0
}

# Usage
graceful_kill 1234
graceful_kill 1234 30    # 30-second timeout

# === Why not use kill -9 first? ===
#
# Problems with kill -9 (SIGKILL):
# 1. Cleanup routines are not executed
#    → Temporary files remain
#    → PID files remain
#    → Socket files remain
#
# 2. File buffers are not flushed
#    → Data in buffers is lost
#    → Last few lines of logs are lost
#    → Uncommitted database transactions are lost
#
# 3. Locks are not released
#    → File locks remain, causing deadlock on next startup
#    → Shared memory segments remain
#
# 4. Impact on child processes
#    → Child processes may become zombies
#    → Child process cleanup is not performed
#
# 5. trap handlers are not executed
#    → Script cleanup code is ignored
```

### 2.5 Keyboard Shortcuts and Signals

```bash
# Mapping of terminal keyboard shortcuts to signals
# Ctrl+C  → SIGINT  (2)   Interrupt (terminate process)
# Ctrl+\  → SIGQUIT (3)   Quit (with core dump)
# Ctrl+Z  → SIGTSTP (20)  Pause
# Ctrl+D  → EOF (not a signal; end of standard input)

# Check and change shortcuts
stty -a                          # Display all terminal settings
# intr = ^C; quit = ^\; erase = ^?; kill = ^U; eof = ^D;
# susp = ^Z; ...

# Change key bindings (temporarily)
stty intr ^X                     # Change SIGINT to Ctrl+X
stty susp ^Y                     # Change SIGTSTP to Ctrl+Y
stty intr ^C                     # Restore

# Disable Ctrl+C (inside a script you don't want Ctrl+C to stop)
stty -isig                       # Disable all signal keys
stty isig                        # Restore
```

### 2.6 Using SIGHUP

```bash
# Two uses of SIGHUP:
# 1. Notification when the terminal disconnects (original meaning: Hang Up)
# 2. Request daemons to reload configuration (conventional usage)

# Reload configuration files (without restarting the process)
kill -HUP $(pgrep -o nginx)      # Reload nginx configuration
kill -HUP $(cat /var/run/nginx.pid)  # From PID file
kill -HUP $(pgrep sshd | head -1) # Reload sshd configuration

# For services managed by systemd (recommended)
sudo systemctl reload nginx      # Reload nginx config
sudo systemctl reload sshd       # Reload sshd config
sudo systemctl reload postgresql # Reload PostgreSQL config

# Major daemons that support configuration reload via SIGHUP:
# nginx:     Graceful restart of worker processes
# Apache:    Reload configuration
# sshd:      Reload configuration
# rsyslog:   Reload configuration
# logrotate: Used during log rotation
# PostgreSQL: Reload postgresql.conf
# HAProxy:   Reload configuration

# What gets reloaded with SIGHUP (nginx example):
# - nginx.conf and included files
# - New worker processes start with the new configuration
# - Old worker processes finish handling current connections then exit
# - The master process does not restart
# → Configuration changes can be applied with zero downtime
```

---

## 3. Keeping Processes Running After Session Disconnect

### 3.1 nohup

```bash
# nohup: Run a command ignoring SIGHUP
# The process does not exit when the SSH connection drops

# Basic usage
nohup long_task.sh &             # Run in background
# Output is automatically redirected to nohup.out (current directory)
# Falls back to ~/nohup.out if nohup.out is not writable

# Explicitly specify output destination (recommended)
nohup long_task.sh > /var/log/task.log 2>&1 &
echo $!                          # Display PID

# Record PID
nohup long_task.sh > /tmp/task.log 2>&1 &
echo $! > /tmp/task.pid
# Check later: cat /tmp/task.pid

# How nohup works:
# 1. Sets SIGHUP to be ignored (SIG_IGN)
# 2. If stdout is a terminal, redirects to nohup.out
# 3. If stderr is a terminal, redirects to stdout
# 4. Execs the command

# How to verify nohup
cat /proc/$(cat /tmp/task.pid)/status | grep SigIgn
# SigIgn: 0000000000000001  ← SIGHUP(1) is being ignored
```

### 3.2 disown

```bash
# disown: Detach a running job from the shell's job table
# Useful when you forgot to use nohup before running a command

# Basic usage
long_task.sh &                   # Start in background
disown %1                        # Detach job 1 from the shell
# → SIGHUP will no longer be sent when the shell exits

# Ignore only SIGHUP (job remains in the job list)
long_task.sh &
disown -h %1                     # Ignore only SIGHUP (still visible in jobs)

# Detach all jobs
disown -a                        # Detach all jobs

# Detach the last background job
long_task.sh &
disown                           # No argument = last job

# Typical workflow: handling a forgotten nohup
long_running_command              # Running in foreground
# Ctrl+Z                        # Pause
bg                               # Resume in background
disown %1                        # Detach from shell
# → The process continues even if the SSH connection drops

# Note: disown does not redirect output
# → If output goes to the terminal, closing it may send SIGPIPE
# → Redirect before disowning if possible
long_task.sh > /tmp/output.log 2>&1 &
disown %1
```

### 3.3 nohup vs disown Comparison

```bash
# ┌─────────────────┬──────────────────────────────────┬────────────────────────────────┐
# │ Feature         │ nohup                            │ disown                         │
# ├─────────────────┼──────────────────────────────────┼────────────────────────────────┤
# │ Timing          │ Specified before command runs    │ Can be applied after execution │
# │ SIGHUP          │ Ignored                          │ Prevents shell from sending it │
# │ Output          │ Auto-redirected to nohup.out     │ Not redirected                 │
# │ Job list        │ Shown normally                   │ Removed from list when detached│
# │ Reconnect       │ Not possible                     │ Not possible                   │
# │ Main use        │ Planned long-running tasks       │ Recovery when nohup is forgotten│
# └─────────────────┴──────────────────────────────────┴────────────────────────────────┘
```

### 3.4 setsid

```bash
# setsid: Run a command in a new session
# Completely detached from the terminal

setsid long_task.sh              # Run as new session leader
setsid -f long_task.sh           # Create new session after forking

# How setsid works:
# 1. Creates a child process with fork()
# 2. Calls setsid() in the child process
# 3. Creates a new session (no controlling terminal)
# 4. Execs the command
#
# Differences from nohup/disown:
# - Creates a completely new session (fully detached from terminal)
# - Behavior close to daemonization
# - Process group is also new
```

### 3.5 Comparison with tmux / screen

```
Comparison of methods to survive session disconnect:

┌────────────┬────────────────────────────────────────────┐
│ Method     │ Characteristics                            │
├────────────┼────────────────────────────────────────────┤
│ nohup      │ Simple. Output goes to nohup.out. Cannot reconnect      │
│ disown     │ Can be applied after execution. Cannot reconnect         │
│ setsid     │ Fully session-isolated. Cannot reconnect                 │
│ tmux       │ Session management. Can reconnect after disconnect ← Recommended │
│ screen     │ Equivalent to tmux. Older and highly compatible          │
│ systemd    │ Managed as a service. Supports logs and restart          │
└────────────┴────────────────────────────────────────────┘

Practical usage guide:
  Temporary command execution   → nohup (simplest)
  Forgot nohup                  → disown (rescue option)
  Interactive long-running work → tmux ← most recommended
  Daemon-like services          → systemd / supervisor
```

### 3.6 Session Management with tmux

```bash
# Basic tmux operations (in the context of job control)

# Create a session
tmux new -s work                 # Create a session named "work"

# Do work
# ... run long-running tasks ...

# Detach (session is preserved even after disconnect)
# Ctrl+b d                      # Detach

# Reconnect (possible even after reconnecting via SSH)
tmux attach -t work              # Reconnect to the "work" session
tmux a -t work                   # Short form

# List sessions
tmux ls                          # List sessions

# Terminate a session
tmux kill-session -t work        # Terminate the session

# Window operations
# Ctrl+b c                      # New window
# Ctrl+b n                      # Next window
# Ctrl+b p                      # Previous window
# Ctrl+b 0-9                    # Switch window by number
# Ctrl+b w                      # Window list

# Pane operations
# Ctrl+b %                      # Vertical split
# Ctrl+b "                      # Horizontal split
# Ctrl+b arrow keys             # Move between panes
# Ctrl+b z                      # Toggle pane zoom

# Using tmux in scripts
tmux new-session -d -s build 'make all && echo Done'
# Create a session in the background and run a command
# View results later with tmux a -t build
```

---

## 4. trap — Signal Handlers

### 4.1 Basic Syntax

```bash
# trap 'command' signal [signal...]

# Basic usage
trap 'echo "Received Ctrl+C"' INT

# Catch multiple signals
trap 'echo "Exiting"' INT TERM

# Ignore a signal
trap '' INT                      # Ignore SIGINT (Ctrl+C stops working)
trap '' HUP                      # Ignore SIGHUP

# Restore default behavior
trap - INT                       # Restore SIGINT to default
trap - HUP TERM                  # Reset multiple signals

# Display current trap settings
trap -p                          # All trap settings
trap -p INT                      # Settings for a specific signal
```

### 4.2 EXIT Trap (Most Important Pattern)

```bash
#!/bin/bash
# EXIT trap: Always executed when the script exits
# Called on both normal and abnormal exit (except SIGKILL)

# Pattern 1: Cleanup temporary files
TMPFILE=$(mktemp)
TMPDIR=$(mktemp -d)
trap 'rm -f "$TMPFILE"; rm -rf "$TMPDIR"; echo "Cleanup complete"' EXIT

echo "Temp file: $TMPFILE"
echo "Temp dir: $TMPDIR"
# ... processing ...
# Automatically cleaned up when the script exits

# Pattern 2: Lock file management
LOCKFILE="/tmp/myapp.lock"
if [ -f "$LOCKFILE" ]; then
    echo "Another instance is running (lock file: $LOCKFILE)" >&2
    exit 1
fi
trap 'rm -f "$LOCKFILE"' EXIT
echo $$ > "$LOCKFILE"
# ... processing ...

# Pattern 3: PID file management
PIDFILE="/var/run/myapp.pid"
trap 'rm -f "$PIDFILE"' EXIT
echo $$ > "$PIDFILE"

# Pattern 4: Service shutdown processing
trap 'echo "Shutting down..."; stop_service; echo "Done"' EXIT

# Pattern 5: SSH connection cleanup
trap 'ssh -O exit user@server 2>/dev/null' EXIT
ssh -M -S /tmp/ssh_mux_%h_%p_%r user@server
```

### 4.3 ERR Trap

```bash
#!/bin/bash
# ERR trap: Executed when a command returns a non-zero exit code
# Often used in combination with set -e

# Pattern 1: Display where the error occurred
trap 'echo "Error at line $LINENO command \"$BASH_COMMAND\" exit code $?" >&2' ERR

# Combined with set -e
set -e
trap 'echo "Error at line $LINENO: $BASH_COMMAND" >&2' ERR

# Pattern 2: Stack trace on error
trap 'echo "Error at ${BASH_SOURCE[0]}:${LINENO} in ${FUNCNAME[0]:-main}"' ERR

# Pattern 3: Detailed error handling
error_handler() {
    local exit_code=$?
    local line_no=$1
    local command=$2
    echo "=============================" >&2
    echo "Error occurred!" >&2
    echo "  Line number: $line_no" >&2
    echo "  Command: $command" >&2
    echo "  Exit code: $exit_code" >&2
    echo "  Script: ${BASH_SOURCE[1]}" >&2
    echo "=============================" >&2

    # Show call stack
    local i=0
    echo "Call stack:" >&2
    while caller $i; do
        ((i++))
    done 2>/dev/null >&2
}
trap 'error_handler $LINENO "$BASH_COMMAND"' ERR

# Note: ERR trap does not propagate to subshells (by default)
# Use set -E to propagate ERR trap to subshells
set -eE
trap 'echo "Error at line $LINENO" >&2' ERR
```

### 4.4 DEBUG Trap

```bash
#!/bin/bash
# DEBUG trap: Called before each command is executed

# Pattern 1: Trace executed commands (for debugging)
trap 'echo "DEBUG: $BASH_COMMAND (line $LINENO)"' DEBUG

echo "step 1"
echo "step 2"
# Output:
# DEBUG: echo "step 1" (line 5)
# step 1
# DEBUG: echo "step 2" (line 6)
# step 2

# Pattern 2: Measure execution time
LAST_TIME=$(date +%s%N)
trap '
    NOW=$(date +%s%N)
    ELAPSED=$(( (NOW - LAST_TIME) / 1000000 ))
    if [ $ELAPSED -gt 100 ]; then
        echo "SLOW: ${ELAPSED}ms - $BASH_COMMAND" >&2
    fi
    LAST_TIME=$NOW
' DEBUG
```

### 4.5 RETURN Trap

```bash
#!/bin/bash
# RETURN trap: Called when returning from a function or source

trap 'echo "Returned from function"' RETURN

my_function() {
    echo "Inside function"
    return 0
}

my_function
# Output:
# Inside function
# Returned from function
```

### 4.6 Practical trap Pattern Collection

```bash
#!/bin/bash
# === Robust Script Template ===

set -euo pipefail

# Global variables
SCRIPT_NAME=$(basename "$0")
TMPDIR=""
LOCKFILE=""
CLEANUP_DONE=false

# Cleanup function
cleanup() {
    if [ "$CLEANUP_DONE" = true ]; then
        return
    fi
    CLEANUP_DONE=true

    echo "[$SCRIPT_NAME] Cleaning up..."

    # Remove temporary directory
    if [ -n "$TMPDIR" ] && [ -d "$TMPDIR" ]; then
        rm -rf "$TMPDIR"
    fi

    # Remove lock file
    if [ -n "$LOCKFILE" ] && [ -f "$LOCKFILE" ]; then
        rm -f "$LOCKFILE"
    fi

    # Terminate background jobs
    jobs -p | xargs -r kill 2>/dev/null

    echo "[$SCRIPT_NAME] Cleanup complete"
}

# Error handler
error_handler() {
    local exit_code=$?
    local line_no=$1
    echo "[$SCRIPT_NAME] Error: line $line_no exit code $exit_code" >&2
    cleanup
    exit "$exit_code"
}

# Set traps
trap cleanup EXIT
trap 'error_handler $LINENO' ERR
trap 'echo "[$SCRIPT_NAME] Interrupt received"; exit 130' INT
trap 'echo "[$SCRIPT_NAME] Termination request received"; exit 143' TERM

# Initialization
TMPDIR=$(mktemp -d "/tmp/${SCRIPT_NAME}.XXXXXX")
LOCKFILE="/tmp/${SCRIPT_NAME}.lock"

if [ -f "$LOCKFILE" ]; then
    EXISTING_PID=$(cat "$LOCKFILE")
    if kill -0 "$EXISTING_PID" 2>/dev/null; then
        echo "Error: Another instance is running (PID: $EXISTING_PID)" >&2
        exit 1
    else
        echo "Warning: Removing stale lock file" >&2
        rm -f "$LOCKFILE"
    fi
fi
echo $$ > "$LOCKFILE"

# Main processing
echo "[$SCRIPT_NAME] Starting (PID: $$, TMPDIR: $TMPDIR)"
# ... main processing here ...
echo "[$SCRIPT_NAME] Completed successfully"
```

```bash
# === Loop interruptible with Ctrl+C ===
#!/bin/bash

RUNNING=true
trap 'RUNNING=false; echo "Interrupt request received..."' INT

echo "Starting processing (Ctrl+C to interrupt)"
count=0
while $RUNNING && [ $count -lt 100 ]; do
    echo "Processing... ($count/100)"
    sleep 1
    count=$((count + 1))
done

if $RUNNING; then
    echo "All processing completed"
else
    echo "Processing interrupted ($count/100 completed)"
fi
```

```bash
# === Inter-process communication using SIGUSR1/SIGUSR2 ===
#!/bin/bash

# Worker script (worker.sh)
STATS_REQUESTS=0
PAUSED=false

# SIGUSR1 → Output statistics
trap 'echo "Stats: requests=$STATS_REQUESTS, paused=$PAUSED"' USR1

# SIGUSR2 → Toggle pause/resume
trap '
    if $PAUSED; then
        PAUSED=false
        echo "Resumed"
    else
        PAUSED=true
        echo "Paused"
    fi
' USR2

echo "Worker started (PID: $$)"
while true; do
    if ! $PAUSED; then
        # ... actual processing ...
        STATS_REQUESTS=$((STATS_REQUESTS + 1))
    fi
    sleep 1
done

# Controller side:
# kill -USR1 <PID>   # Show stats
# kill -USR2 <PID>   # Pause/resume
```

---

## 5. wait / timeout — Controlling Parallel Processing

### 5.1 wait — Waiting for Background Jobs to Complete

```bash
# Wait for all background jobs to complete
task1 &
task2 &
task3 &
wait                             # Block until all jobs finish
echo "All tasks completed"

# Wait for a specific PID
task1 &
PID1=$!
task2 &
PID2=$!

wait $PID1
echo "task1 completed (exit code: $?)"
wait $PID2
echo "task2 completed (exit code: $?)"

# Wait for a specific job
task1 &
wait %1
echo "Job 1 completed"

# Wait for any one to complete (bash 4.3+)
task1 &
PID1=$!
task2 &
PID2=$!
task3 &
PID3=$!

wait -n                          # Wait for the first job to finish
echo "First job completed (exit code: $?)"

# Get the PID of the completed job with wait -n (bash 5.1+)
wait -n -p DONE_PID $PID1 $PID2 $PID3
echo "PID $DONE_PID completed"
```

### 5.2 Parallel Processing Patterns

```bash
# Pattern 1: Simple parallel execution
#!/bin/bash
for file in *.csv; do
    process_file "$file" &
done
wait
echo "All files processed"

# Pattern 2: Parallel execution with concurrency limit
#!/bin/bash
MAX_PARALLEL=4
count=0

for file in *.csv; do
    process_file "$file" &
    count=$((count + 1))

    if [ $count -ge $MAX_PARALLEL ]; then
        wait -n              # Wait for one to complete
        count=$((count - 1))
    fi
done
wait                         # Wait for all remaining jobs

# Pattern 3: Collecting results
#!/bin/bash
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

PIDS=()
for i in $(seq 1 10); do
    (
        result=$(some_task "$i")
        echo "$result" > "$TMPDIR/result_$i"
    ) &
    PIDS+=($!)
done

# Wait for all and check for errors
ERRORS=0
for pid in "${PIDS[@]}"; do
    if ! wait "$pid"; then
        ERRORS=$((ERRORS + 1))
    fi
done

echo "Done: success=$((10 - ERRORS)), failed=$ERRORS"
cat "$TMPDIR"/result_* | sort

# Pattern 4: Parallel processing with xargs
find . -name "*.jpg" | xargs -P 4 -I {} convert {} -resize 800x600 resized_{}
# -P 4: 4-way parallelism

# Pattern 5: Parallel processing with GNU parallel
# When parallel is installed
find . -name "*.csv" | parallel -j 4 process_file {}
seq 100 | parallel -j 8 'curl -s "https://api.example.com/item/{}" > /tmp/item_{}.json'
```

### 5.3 timeout — Execution with a Timeout

```bash
# timeout: Automatically terminate a command after a specified time

# Basic usage
timeout 60 long_command          # Timeout after 60 seconds (SIGTERM)
timeout 30s curl -s https://example.com  # Timeout after 30 seconds
timeout 5m make build            # Timeout after 5 minutes
timeout 2h rsync -avz src/ dst/  # Timeout after 2 hours

# Time units:
# s: seconds (default)
# m: minutes
# h: hours
# d: days

# Specify signal on timeout
timeout -s KILL 60 long_command  # Send SIGKILL after 60 seconds
timeout --signal=HUP 30 daemon  # Send SIGHUP after 30 seconds

# Staged timeout (-k option)
timeout -k 10 60 long_command
# Send SIGTERM after 60 seconds
# If still not terminated, send SIGKILL 10 seconds later

# Check exit code
timeout 5 sleep 10
echo $?                          # 124 = exited due to timeout
# Exit codes:
# 124: Timed out with SIGTERM
# 137: Timed out with SIGKILL (128 + 9)
# Other: The command's own exit code

# Determine if it timed out
timeout 5 some_command
EXIT_CODE=$?
if [ $EXIT_CODE -eq 124 ]; then
    echo "Timed out"
elif [ $EXIT_CODE -eq 0 ]; then
    echo "Completed successfully"
else
    echo "Exited with error (code: $EXIT_CODE)"
fi

# Run in foreground (--foreground)
timeout --foreground 60 interactive_command
# Used for interactive commands

# Practical example: API health check with timeout
timeout 5 curl -s -o /dev/null -w "%{http_code}" https://api.example.com/health
if [ $? -eq 124 ]; then
    echo "API response timeout"
fi

# Practical example: Wait for a file with timeout
timeout 60 bash -c 'while [ ! -f /tmp/ready.flag ]; do sleep 1; done'
if [ $? -eq 124 ]; then
    echo "File was not created (timeout)"
fi
```

---

## 6. Process Groups and Sessions

### 6.1 Understanding the Concepts

```bash
# Process hierarchy:
#
# Session (SID)
#   └─ Process Group (PGID)
#       └─ Process (PID)
#           └─ Thread (TID)
#
# Session: A collection of processes associated with a login
# Process Group: A collection of related processes (e.g., in a pipeline)
# Session Leader: The process that started the session (login shell)

# How to check
ps -eo pid,ppid,pgid,sid,tty,cmd | head -20

# Example: cat file | grep pattern | sort
# These 3 processes belong to the same process group
# → Ctrl+C sends SIGINT to all 3

# Information about the current process
echo "PID: $$"                   # Process ID
echo "PPID: $PPID"              # Parent process ID
ps -p $$ -o pid,ppid,pgid,sid   # Group and session info

# Check process group ID
ps -eo pid,pgid,cmd | grep nginx

# Send signal to a process group
kill -TERM -$(ps -o pgid= -p 1234 | tr -d ' ')
# Prepend minus to PGID to send signal to the entire group
```

### 6.2 Foreground/Background Process Groups

```bash
# A terminal has one foreground process group
# and zero or more background process groups

# Foreground process group:
# - Can receive input from the terminal
# - Receives Ctrl+C, Ctrl+Z signals
# - Only one per terminal

# Background process groups:
# - Cannot receive input from the terminal (stopped with SIGTTIN/SIGTTOU if attempted)
# - Do not receive Ctrl+C, Ctrl+Z signals
# - Multiple can exist

# fg/bg switches the foreground process group
```

---

## 7. Practical Pattern Collection

### 7.1 Handling a Runaway Process

```bash
# Display processes using more than 90% CPU
ps aux --sort=-%cpu | awk 'NR<=1 || $3>90'

# Confirm and then kill
kill $(ps aux --sort=-%cpu | awk 'NR==2 {print $2}')

# Kill all processes of a specific user (use with caution)
pkill -u problematic_user

# Gradually terminate a process
graceful_kill() {
    local pid=$1
    kill -TERM "$pid" 2>/dev/null || return 0
    for i in $(seq 1 10); do
        sleep 1
        kill -0 "$pid" 2>/dev/null || return 0
    done
    kill -KILL "$pid" 2>/dev/null
}
```

### 7.2 Terminating All Child Processes

```bash
# Kill all child processes of a parent PID
pkill -P 1234                    # Direct children only

# Kill all descendant processes (recursive)
kill_descendants() {
    local pid=$1
    local children=$(pgrep -P "$pid")
    for child in $children; do
        kill_descendants "$child"
    done
    kill -TERM "$pid" 2>/dev/null
}
kill_descendants 1234

# Kill the entire process group (simpler)
kill -TERM -1234                 # Kill all processes in PGID
```

### 7.3 Managing Background Tasks

```bash
# Wait for background tasks to complete and collect results
#!/bin/bash

declare -A TASK_PIDS

# Start tasks
for server in web1 web2 web3 db1 db2; do
    ssh "$server" "uptime" > "/tmp/uptime_${server}.txt" 2>&1 &
    TASK_PIDS[$server]=$!
done

# Collect results
FAILED=()
for server in "${!TASK_PIDS[@]}"; do
    pid=${TASK_PIDS[$server]}
    if wait "$pid"; then
        echo "OK: $server - $(cat /tmp/uptime_${server}.txt)"
    else
        echo "FAIL: $server"
        FAILED+=("$server")
    fi
done

if [ ${#FAILED[@]} -gt 0 ]; then
    echo "Failed servers: ${FAILED[*]}"
    exit 1
fi
```

### 7.4 Retry with Timeout

```bash
#!/bin/bash
# retry_with_timeout.sh - Retry with timeout

retry_command() {
    local max_retries=${1:-3}
    local timeout_sec=${2:-30}
    local retry_delay=${3:-5}
    shift 3

    local attempt=0
    while [ $attempt -lt $max_retries ]; do
        attempt=$((attempt + 1))
        echo "Attempt $attempt/$max_retries: $*"

        if timeout "$timeout_sec" "$@"; then
            echo "Success (attempt $attempt)"
            return 0
        fi

        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo "Timeout (${timeout_sec}s)"
        else
            echo "Failed (exit code: $exit_code)"
        fi

        if [ $attempt -lt $max_retries ]; then
            echo "Retrying in ${retry_delay}s..."
            sleep "$retry_delay"
        fi
    done

    echo "All $max_retries attempts failed"
    return 1
}

# Usage
retry_command 3 10 5 curl -s https://api.example.com/health
```

### 7.5 Daemonization Script

```bash
#!/bin/bash
# simple_daemon.sh - Simple daemonization script

PIDFILE="/var/run/myapp.pid"
LOGFILE="/var/log/myapp.log"

start() {
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "Already running (PID: $(cat "$PIDFILE"))"
        return 1
    fi

    echo "Starting..."
    nohup /usr/local/bin/myapp > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    echo "Started (PID: $(cat "$PIDFILE"))"
}

stop() {
    if [ ! -f "$PIDFILE" ]; then
        echo "No PID file found"
        return 1
    fi

    local pid=$(cat "$PIDFILE")
    if ! kill -0 "$pid" 2>/dev/null; then
        echo "Process does not exist (PID: $pid)"
        rm -f "$PIDFILE"
        return 1
    fi

    echo "Stopping (PID: $pid)..."
    kill "$pid"

    local timeout=30
    while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
        sleep 1
        timeout=$((timeout - 1))
    done

    if kill -0 "$pid" 2>/dev/null; then
        echo "Force stopping with SIGKILL..."
        kill -9 "$pid"
    fi

    rm -f "$PIDFILE"
    echo "Stopped"
}

status() {
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "Running (PID: $(cat "$PIDFILE"))"
    else
        echo "Stopped"
        [ -f "$PIDFILE" ] && rm -f "$PIDFILE"
    fi
}

restart() {
    stop
    sleep 2
    start
}

case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    status)  status ;;
    *)       echo "Usage: $0 {start|stop|restart|status}" ;;
esac
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

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

### Exercise 2: Applied Patterns

Extend the basic implementation and add the following features.

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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / resource shortage | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Stepwise verification**: Use logging or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, run tests for related areas as well

```python
# Debugging utilities
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
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in {func.__name__}: {e}")
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

Steps for diagnosing performance problems:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O wait**: Examine disk and network I/O conditions
4. **Check concurrent connections**: Inspect connection pool state

| Problem type | Diagnostic tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to deprioritize |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                        │
│    ├─ Small (1-5)  → Monolith                    │
│    └─ Large (10+)  → Go to ②                     │
│                                                 │
│  ② What is the deployment frequency?             │
│    ├─ Weekly or less → Monolith + module split   │
│    └─ Daily/multiple → Go to ③                   │
│                                                 │
│  ③ How independent are the teams?                │
│    ├─ High   → Microservices                     │
│    └─ Medium → Modular monolith                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering increases short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows for best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging harder
- Low abstraction is intuitive but tends to result in code duplication

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

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually modernizing a system that has been in operation for more than 10 years

**Approach:**
- Migrate gradually using the Strangler Fig pattern
- If there are no existing tests, create Characterization Tests first
- Coexist old and new systems via an API gateway
- Perform data migration in stages

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Begin migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries using Inner Source model
- Design API-first to minimize inter-team dependencies

```python
# Define API contract between teams
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

# Usage
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

**Situation:** A system that requires millisecond-level response times

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization technique | Effect | Implementation cost | Use case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Operation | Command | Notes |
|------|---------|------|
| Run in background | command & | PID obtained via $! |
| Pause | Ctrl+Z | Sends SIGTSTP |
| Bring to foreground | fg %N | |
| Resume in background | bg %N | |
| Request graceful termination | kill PID | SIGTERM (default) |
| Force kill (last resort) | kill -9 PID | SIGKILL (no cleanup) |
| Reload configuration | kill -HUP PID | SIGHUP |
| Kill by process name | pkill -f "pattern" | Supports regex |
| Continue after disconnect (before) | nohup command & | Output to nohup.out |
| Continue after disconnect (after) | disown %N | Removes from job list |
| Catch signal | trap 'handler' SIGNAL | EXIT is most important |
| Wait for all jobs | wait | Parallel processing in scripts |
| Execute with timeout | timeout 60 command | 124=timeout |

---

## What to Read Next

---

## References
1. Barrett, D. "Efficient Linux at the Command Line." Ch.8-9, O'Reilly, 2022.
2. Shotts, W. "The Linux Command Line." Ch.10-11, No Starch Press, 2019.
3. Cooper, M. "Advanced Bash-Scripting Guide." Ch.15 (Signals), tldp.org.
4. Kerrisk, M. "The Linux Programming Interface." Ch.20-22 (Signals), No Starch Press, 2010.
5. "signal(7) — Linux manual page." man7.org.
