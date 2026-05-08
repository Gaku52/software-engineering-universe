# systemd and Service Management

> systemd is the core of modern Linux systems. It provides unified management for starting, stopping, and monitoring services.

## What You Will Learn

- [ ] Manage services with systemctl
- [ ] Check logs with journalctl
- [ ] Create custom service unit files
- [ ] Set up periodic execution with timer units
- [ ] Configure systemd security and resource limits
- [ ] Understand troubleshooting techniques


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. systemctl — Service Management

### 1.1 Basic Operations

```bash
# Service operations
sudo systemctl start nginx       # Start
sudo systemctl stop nginx        # Stop
sudo systemctl restart nginx     # Restart
sudo systemctl reload nginx      # Reload configuration (keep process running)
sudo systemctl status nginx      # Check status

# Auto-start management
sudo systemctl enable nginx      # Enable auto-start at OS boot
sudo systemctl disable nginx     # Disable auto-start
sudo systemctl enable --now nginx  # Enable + start immediately
sudo systemctl is-enabled nginx  # Check auto-start status
sudo systemctl is-active nginx   # Check if running

# Service listing
systemctl list-units --type=service              # Running services
systemctl list-units --type=service --all         # All services
systemctl list-units --type=service --failed      # Failed services
systemctl list-unit-files --type=service          # All unit files

# Dependencies
systemctl list-dependencies nginx
systemctl list-dependencies --reverse nginx       # Reverse (who depends on nginx)
```

### 1.2 Reading the status Output

```
● nginx.service - A high performance web server
     Loaded: loaded (/lib/systemd/system/nginx.service; enabled; preset: enabled)
     Active: active (running) since Mon 2025-01-01 00:00:00 JST; 30 days ago
       Docs: man:nginx(8)
   Main PID: 1234 (nginx)
      Tasks: 5 (limit: 4096)
     Memory: 12.5M
        CPU: 1min 23.456s
     CGroup: /system.slice/nginx.service
             ├─1234 "nginx: master process /usr/sbin/nginx"
             ├─1235 "nginx: worker process"

# Active states:
# active (running)  → Running normally
# active (exited)   → Execution complete (one-shot type)
# inactive (dead)   → Stopped
# failed            → Failed to start
# activating        → Starting up
```

### 1.3 Detailed Explanation of status Fields

```bash
# Reading the Loaded line
# loaded (/lib/systemd/system/nginx.service; enabled; preset: enabled)
#   ↑ Path to unit file                    ↑ enabled/disabled  ↑ preset

# The unit file path tells you where the configuration lives:
# /lib/systemd/system/   → Provided by package (default)
# /etc/systemd/system/   → Customized by administrator (takes priority)
# /run/systemd/system/   → Runtime-generated (deleted on reboot)

# Reading the Active line
# active (running) since Mon 2025-01-01 00:00:00 JST; 30 days ago
# ↑ State           ↑ Start date/time                  ↑ Elapsed time

# Tasks: Number of processes (threads)
# Memory: Memory usage
# CPU: Cumulative CPU time used
# CGroup: Process tree within the control group
```

### 1.4 Masking and Unmasking Services

```bash
# Mask: Completely prohibit service startup (cannot be enabled or started)
sudo systemctl mask nginx
# A symbolic link to /dev/null is created

# Check mask status
systemctl is-enabled nginx       # Displays "masked"

# Unmask: Remove the mask
sudo systemctl unmask nginx

# List masked services
systemctl list-unit-files --state=masked

# Use cases for masking:
# - When conflicting with another service (e.g., iptables and firewalld)
# - When you want to prevent accidental startup
# - When you want to completely disable a service temporarily
```

### 1.5 Detailed Service Information

```bash
# Display unit file contents
systemctl cat nginx              # Show unit file contents
systemctl show nginx             # Show all properties
systemctl show nginx --property=MainPID   # Specific property
systemctl show nginx --property=ActiveState,SubState

# Check unit file location
systemctl show nginx --property=FragmentPath
# FragmentPath=/lib/systemd/system/nginx.service

# Edit unit file
sudo systemctl edit nginx        # Create an override file
# /etc/systemd/system/nginx.service.d/override.conf is created

sudo systemctl edit --full nginx # Edit the entire unit file
# A copy is created at /etc/systemd/system/nginx.service

# Review changes
systemd-delta                    # List overridden units
systemd-delta --type=overridden  # Show only overrides
```

---

## 2. journalctl — Log Management

### 2.1 Basic Log Display

```bash
# All logs
journalctl                       # All system logs
journalctl -f                    # Real-time monitoring (equivalent to tail -f)
journalctl -n 50                 # Latest 50 lines
journalctl --no-pager            # Display without pager

# By service
journalctl -u nginx              # nginx logs
journalctl -u nginx -f           # nginx real-time logs
journalctl -u nginx --since today  # Today's logs
journalctl -u nginx -n 100      # Latest 100 lines from nginx

# Multiple services
journalctl -u nginx -u php-fpm   # nginx and php-fpm logs
```

### 2.2 Filtering by Time

```bash
# Time specification
journalctl --since "2025-01-01"
journalctl --since "2025-01-01" --until "2025-01-02"
journalctl --since "1 hour ago"
journalctl --since "30 minutes ago"
journalctl --since "yesterday"
journalctl --since "2025-01-01 09:00:00" --until "2025-01-01 18:00:00"

# Relative time formats
journalctl --since "-2h"         # From 2 hours ago
journalctl --since "-7d"         # From 7 days ago
journalctl --since "today"       # From midnight today
journalctl --since "yesterday" --until "today"  # Yesterday's logs
```

### 2.3 Priority (Severity) Filter

```bash
# Priority filter
journalctl -p err                # Error and above
journalctl -p warning            # Warning and above
journalctl -p crit               # Critical and above
journalctl -p info               # Info and above

# Priority levels (in order):
# 0: emerg   → System is unusable
# 1: alert   → Action must be taken immediately
# 2: crit    → Critical condition
# 3: err     → Error condition
# 4: warning → Warning condition
# 5: notice  → Normal but significant condition
# 6: info    → Informational message
# 7: debug   → Debug message

# Range specification
journalctl -p err..crit          # From error to critical

# Only errors from a specific service
journalctl -u nginx -p err --since "1 hour ago"
```

### 2.4 Logs by Boot

```bash
# By boot
journalctl -b                    # Current boot
journalctl -b -1                 # Previous boot
journalctl -b -2                 # Two boots ago
journalctl --list-boots          # List of boots

# Specify a boot ID
journalctl -b abc123def          # Specify boot ID

# Check errors from the previous boot (useful for failure investigation)
journalctl -b -1 -p err
journalctl -b -1 -u nginx       # nginx logs from the previous boot
```

### 2.5 Output Formats

```bash
# Output formats
journalctl -o json               # JSON format
journalctl -o json-pretty        # Formatted JSON
journalctl -o short-iso          # ISO timestamp format
journalctl -o short-precise      # Microsecond precision
journalctl -o verbose            # Show all fields
journalctl -o cat                # Message only (no timestamp)
journalctl -o export             # Binary export format

# Process JSON output with jq
journalctl -u nginx -o json --since "1 hour ago" | \
    jq -r 'select(.PRIORITY == "3") | .MESSAGE'

# Field specification
journalctl -u nginx --output-fields=MESSAGE,PRIORITY

# List distinct values for a field
journalctl -F _SYSTEMD_UNIT     # List of unit names
journalctl -F _COMM              # List of command names
journalctl -F PRIORITY           # List of priorities used
```

### 2.6 Disk Usage and Log Management

```bash
# Disk usage
journalctl --disk-usage          # Log disk usage

# Compress/reduce logs
sudo journalctl --vacuum-size=500M  # Reduce to 500MB
sudo journalctl --vacuum-time=30d   # Delete logs older than 30 days
sudo journalctl --vacuum-files=5    # Reduce to 5 files

# Persistent log configuration (/etc/systemd/journald.conf)
# [Journal]
# Storage=persistent            # Persist logs (saved in /var/log/journal/)
# SystemMaxUse=1G               # Max 1GB
# SystemMaxFileSize=100M        # Max 100MB per file
# MaxRetentionSec=1month        # Maximum retention period
# MaxFileSec=1week              # File rotation interval
# Compress=yes                  # Enable compression
# RateLimitIntervalSec=30s      # Rate limiting interval
# RateLimitBurst=10000          # Rate limiting burst

# Apply configuration changes
sudo systemctl restart systemd-journald

# Log forwarding configuration
# ForwardToSyslog=yes           # Forward to syslog
# ForwardToConsole=no           # Forward to console
# ForwardToWall=yes             # Forward wall messages
```

### 2.7 Kernel Logs and Other Filters

```bash
# Kernel logs
journalctl -k                    # Kernel messages (equivalent to dmesg)
journalctl -k -p err             # Kernel error messages
journalctl -k --since "1 hour ago"

# Filter by PID
journalctl _PID=1234

# Filter by UID
journalctl _UID=1000

# Filter by executable
journalctl _COMM=sshd            # sshd logs
journalctl _EXE=/usr/sbin/sshd   # Specify by path

# Filter by hostname (when receiving network logs)
journalctl _HOSTNAME=webserver01

# Combined filter
journalctl _SYSTEMD_UNIT=sshd.service _PID=1234

# Exclusion patterns (combine with grep)
journalctl -u nginx --no-pager | grep -v "GET /health"
```

---

## 3. Creating Unit Files

### 3.1 Unit File Locations and Priority

```bash
# Unit file locations (in order of priority)
# /etc/systemd/system/          ← Custom services (highest priority)
# /run/systemd/system/          ← Runtime-generated (deleted on reboot)
# /lib/systemd/system/          ← Package-installed (default)
# /usr/lib/systemd/system/      ← Distribution-provided

# Unit file types
# .service   → Service (most common)
# .timer     → Timer (cron alternative)
# .socket    → Socket activation
# .mount     → Mount point
# .target    → Target (grouping)
# .path      → Path monitoring
# .device    → Device
# .swap      → Swap
# .slice     → Resource management group
# .scope     → Grouping of external processes
```

### 3.2 Basic Service Unit

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application Server
Documentation=https://example.com/docs
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
Environment=NODE_ENV=production
EnvironmentFile=/opt/myapp/.env
ExecStart=/usr/bin/node /opt/myapp/server.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/myapp/data

[Install]
WantedBy=multi-user.target
```

### 3.3 Type Values and Details

```bash
# Type values and when to use each:

# simple (default):
#   The ExecStart process is the main process
#   Considered "started" as soon as the process begins
#   Use for: Node.js, Python, Go servers, etc.

# exec (systemd 240+):
#   Similar to simple, but startup is complete when the ExecStart binary executes
#   More precise timing than simple

# forking:
#   Processes that daemonize (fork and parent exits)
#   Use with PIDFile
#   Use for: Apache httpd, traditional UNIX daemons

# oneshot:
#   Runs once and exits
#   Combine with RemainAfterExit=yes to stay active after exit
#   Use for: Setup scripts, firewall configuration

# notify:
#   Process signals readiness via sd_notify()
#   Use with NotifyAccess=main
#   Use for: systemd-aware applications

# dbus:
#   Startup complete when the D-Bus bus name is acquired
#   Use with BusName=
#   Use for: D-Bus-enabled services

# idle:
#   Same as simple, but delays execution until all jobs complete
#   Use for: Post-login setup tasks
```

### 3.4 Restart Values and Details

```bash
# Restart values:
# no:          Do not restart (default)
# on-success:  Restart only on clean exit (exit code 0)
# on-failure:  Restart only on abnormal exit (most common)
# on-abnormal: Restart on signal/timeout/watchdog
# on-watchdog: Restart only on watchdog timeout
# on-abort:    Restart only on abnormal exit via signal
# always:      Always restart (even if stopped manually)

# Restart-related settings
# RestartSec=5            → Wait time before restart (seconds)
# RestartSteps=5          → Gradually increase wait time (systemd 254+)
# RestartMaxDelaySec=120  → Maximum wait time
# StartLimitIntervalSec=300  → Limit number of starts within this period
# StartLimitBurst=5       → Maximum start count within the above period

# Practical restart configuration example
# [Service]
# Restart=on-failure
# RestartSec=5
# StartLimitIntervalSec=300
# StartLimitBurst=5
# → Attempts to restart up to 5 times in 5 minutes. Enters failed state if exceeded.
```

### 3.5 Real-World Service Examples

```ini
# === Python (Gunicorn) Web Application ===
# /etc/systemd/system/gunicorn.service
[Unit]
Description=Gunicorn WSGI Server
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/opt/webapp
Environment=PYTHONPATH=/opt/webapp
ExecStart=/opt/webapp/venv/bin/gunicorn \
    --workers 4 \
    --bind unix:/run/gunicorn.sock \
    --access-logfile - \
    --error-logfile - \
    wsgi:application
ExecReload=/bin/kill -s HUP $MAINPID
Restart=on-failure
RestartSec=5
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target

# === Java (Spring Boot) Application ===
# /etc/systemd/system/spring-app.service
[Unit]
Description=Spring Boot Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=spring
Group=spring
WorkingDirectory=/opt/spring-app
Environment=JAVA_OPTS="-Xmx512m -Xms256m"
Environment=SPRING_PROFILES_ACTIVE=production
ExecStart=/usr/bin/java $JAVA_OPTS -jar /opt/spring-app/app.jar
SuccessExitStatus=143
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target

# === Go Binary ===
# /etc/systemd/system/goapp.service
[Unit]
Description=Go Application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=goapp
Group=goapp
ExecStart=/opt/goapp/server
Restart=always
RestartSec=3
LimitNOFILE=65536
Environment=GOMAXPROCS=4

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/goapp/data
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target

# === Forking Daemon (Apache httpd) ===
# /etc/systemd/system/httpd-custom.service
[Unit]
Description=Custom Apache HTTP Server
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
PIDFile=/run/httpd/httpd.pid
ExecStartPre=/usr/sbin/apachectl configtest
ExecStart=/usr/sbin/apachectl start
ExecReload=/usr/sbin/apachectl graceful
ExecStop=/usr/sbin/apachectl graceful-stop
Restart=on-failure

[Install]
WantedBy=multi-user.target

# === One-Shot Type (Initialization Script) ===
# /etc/systemd/system/app-init.service
[Unit]
Description=Application Initialization
Before=myapp.service
ConditionPathExists=!/opt/myapp/.initialized

[Service]
Type=oneshot
User=myapp
ExecStart=/opt/myapp/scripts/init.sh
ExecStartPost=/usr/bin/touch /opt/myapp/.initialized
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

### 3.6 Applying Unit File Changes

```bash
# Steps to apply changes
sudo systemctl daemon-reload     # Reload unit files
sudo systemctl restart myapp     # Restart service
sudo systemctl status myapp      # Check status
journalctl -u myapp -f           # Check logs

# Syntax check for unit files
systemd-analyze verify /etc/systemd/system/myapp.service

# Visualize unit file dependencies
systemd-analyze dot nginx.service | dot -Tsvg > nginx-deps.svg
```

---

## 4. Timer Units (cron Alternative)

### 4.1 Basic Timer

```ini
# /etc/systemd/system/backup.timer
[Unit]
Description=Daily backup timer

[Timer]
OnCalendar=daily
# OnCalendar=*-*-* 03:00:00     # Every day at 3am
# OnCalendar=Mon *-*-* 09:00:00 # Every Monday at 9am
Persistent=true                  # Run missed executions after boot

[Install]
WantedBy=timers.target

# /etc/systemd/system/backup.service
[Unit]
Description=Daily backup

[Service]
Type=oneshot
ExecStart=/opt/scripts/backup.sh
```

### 4.2 OnCalendar Format

```bash
# OnCalendar format patterns
# DayOfWeek Year-Month-Day Hour:Minute:Second

# Examples
OnCalendar=daily                     # Every day at 0:00
OnCalendar=weekly                    # Every Monday at 0:00
OnCalendar=monthly                   # First day of every month at 0:00
OnCalendar=yearly                    # January 1st every year at 0:00
OnCalendar=hourly                    # Every hour at minute 0

OnCalendar=*-*-* 03:00:00           # Every day at 3am
OnCalendar=Mon *-*-* 09:00:00       # Every Monday at 9am
OnCalendar=*-*-01 00:00:00          # First day of every month
OnCalendar=Mon,Fri *-*-* 08:30:00   # Monday and Friday at 8:30
OnCalendar=*-*-* *:00/15:00         # Every 15 minutes
OnCalendar=*-*-* 09..17:00:00       # Every hour from 9am to 5pm
OnCalendar=Sat,Sun *-*-* 10:00:00   # Saturday and Sunday at 10am

# Validate the format
systemd-analyze calendar "Mon *-*-* 09:00:00"
# Displays the next execution date/time

systemd-analyze calendar "*-*-* *:00/30:00"
# Displays execution times every 30 minutes

# Relative time timers
# [Timer]
# OnBootSec=5min                    # 5 minutes after boot
# OnUnitActiveSec=1h                # 1 hour after last run
# OnActiveSec=30s                   # 30 seconds after timer activation
# RandomizedDelaySec=5min           # Random delay (for load distribution)
# AccuracySec=1min                  # Accuracy (default 1 minute)
```

### 4.3 Managing Timers

```bash
# Timer management
sudo systemctl enable --now backup.timer
systemctl list-timers            # List timers
systemctl list-timers --all      # Include inactive timers

# Check timer status
systemctl status backup.timer    # Timer status
systemctl status backup.service  # Corresponding service status

# Manual execution (for testing)
sudo systemctl start backup.service  # Run directly, not via timer

# Check next execution time
systemctl list-timers backup.timer
```

### 4.4 Practical Timer Examples

```ini
# === Log Rotation (Every day at 2am) ===
# /etc/systemd/system/log-rotate.timer
[Unit]
Description=Daily log rotation

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=5min

[Install]
WantedBy=timers.target

# /etc/systemd/system/log-rotate.service
[Unit]
Description=Rotate application logs

[Service]
Type=oneshot
ExecStart=/opt/scripts/rotate-logs.sh
Nice=19
IOSchedulingClass=idle

# === SSL Certificate Renewal Check (Twice a day) ===
# /etc/systemd/system/certbot-renew.timer
[Unit]
Description=Certbot renewal timer

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target

# /etc/systemd/system/certbot-renew.service
[Unit]
Description=Certbot renewal
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet
ExecStartPost=/bin/systemctl reload nginx

# === Database Backup (Weekday nights) ===
# /etc/systemd/system/db-backup.timer
[Unit]
Description=Weekday database backup

[Timer]
OnCalendar=Mon..Fri *-*-* 01:30:00
Persistent=true

[Install]
WantedBy=timers.target

# === Disk Usage Check (Every 5 minutes) ===
# /etc/systemd/system/disk-check.timer
[Unit]
Description=Periodic disk usage check

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

---

## 5. Socket Activation

```ini
# Socket activation: Start the service only when a request arrives
# Effective for conserving resources

# /etc/systemd/system/myapp.socket
[Unit]
Description=My Application Socket

[Socket]
ListenStream=8080
# ListenStream=/run/myapp.sock   # For UNIX sockets
Accept=no
# Accept=yes: starts a service instance per connection

[Install]
WantedBy=sockets.target

# /etc/systemd/system/myapp.service
[Unit]
Description=My Application
Requires=myapp.socket

[Service]
Type=simple
ExecStart=/opt/myapp/server
# Socket is passed as file descriptor 3

[Install]
WantedBy=multi-user.target

# Socket management
sudo systemctl enable --now myapp.socket
systemctl list-sockets           # List sockets
```

---

## 6. Path Units (File Monitoring)

```ini
# Path units: Monitor files or directories and start a service on changes

# /etc/systemd/system/deploy-watch.path
[Unit]
Description=Watch for deployment files

[Path]
PathExists=/var/deploy/trigger    # Start when file exists
# PathModified=/var/deploy/       # Start when directory is modified
# PathChanged=/var/deploy/        # Start when file changes (on close)
# DirectoryNotEmpty=/var/deploy/  # Start when directory is no longer empty
MakeDirectory=yes
Unit=deploy.service

[Install]
WantedBy=multi-user.target

# /etc/systemd/system/deploy.service
[Unit]
Description=Deploy triggered by file watch

[Service]
Type=oneshot
ExecStart=/opt/scripts/deploy.sh
ExecStartPost=/bin/rm -f /var/deploy/trigger

# Path unit management
sudo systemctl enable --now deploy-watch.path
systemctl list-paths              # List path units
```

---

## 7. systemd Security Settings

### 7.1 Security Directives

```ini
# Security hardening settings for services

[Service]
# === Filesystem Protection ===
ProtectSystem=strict           # Mount / as read-only
# ProtectSystem=full           # Mount /usr, /boot as read-only
# ProtectSystem=true           # Mount /usr as read-only
ProtectHome=true               # Make /home, /root, /run/user empty
# ProtectHome=read-only        # Make them read-only
# ProtectHome=tmpfs            # Overlay with tmpfs
PrivateTmp=true                # Use a dedicated /tmp
ReadWritePaths=/opt/myapp/data  # Writable paths
ReadOnlyPaths=/opt/myapp/config # Read-only paths
InaccessiblePaths=/var/secret   # Paths to make inaccessible
TemporaryFileSystem=/var:ro     # Overlay with tmpfs
BindPaths=/src:/dest            # Bind mount

# === Network Protection ===
PrivateNetwork=true            # Dedicated network namespace (loopback only)
# RestrictAddressFamilies=AF_INET AF_INET6  # Allowed address families
# IPAddressDeny=any             # Deny all IP addresses
# IPAddressAllow=192.168.0.0/16 # Allowed IP addresses

# === Process Protection ===
NoNewPrivileges=true           # Prohibit privilege escalation
PrivateUsers=true              # Dedicated user namespace
ProtectKernelTunables=true     # Prohibit writes to /proc, /sys
ProtectKernelModules=true      # Prohibit loading kernel modules
ProtectKernelLogs=true         # Prohibit access to kernel logs
ProtectControlGroups=true      # Prohibit cgroup changes
ProtectClock=true              # Prohibit system clock changes
ProtectHostname=true           # Prohibit hostname changes
LockPersonality=true           # Prohibit execution domain changes
RestrictRealtime=true          # Prohibit real-time scheduling
RestrictSUIDSGID=true          # Prohibit setting SUID/SGID bits
RestrictNamespaces=true        # Prohibit namespace creation

# === Capability Restrictions ===
CapabilityBoundingSet=CAP_NET_BIND_SERVICE  # Allow binding to ports below 1024
AmbientCapabilities=CAP_NET_BIND_SERVICE    # Allow low-port usage without root
# CapabilityBoundingSet=         # Disable all capabilities

# === System Call Restrictions ===
SystemCallFilter=@system-service  # System calls for system services
# SystemCallFilter=~@debug @mount @privileged  # Prohibit dangerous syscalls
SystemCallArchitectures=native    # Native architecture only
SystemCallErrorNumber=EPERM       # Error number when denied

# === Miscellaneous ===
UMask=0077                     # umask for file creation
MemoryDenyWriteExecute=true    # W^X (exclusive write and execute)
```

### 7.2 Checking the Security Score

```bash
# Check security score for a service
systemd-analyze security nginx.service

# Example output:
# → Overall exposure level for nginx.service: 6.5 MEDIUM
#   NAME                          DESCRIPTION                     EXPOSURE
# ✗ PrivateNetwork=               Service has access to host's network  0.5
# ✗ PrivateUsers=                 Service has access to other users     0.2
# ✓ NoNewPrivileges=              Service process may not gain new privileges 0.0
# ...

# Security scores for all services
systemd-analyze security

# Score guidelines:
# 0.0-2.0: SAFE (sufficient security)
# 2.0-4.0: OK (generally safe)
# 4.0-7.0: MEDIUM (room for improvement)
# 7.0-10.0: UNSAFE (security risk)
```

---

## 8. Resource Limits

### 8.1 Resource Limit Directives

```ini
# Resource limit settings for services

[Service]
# === Memory Limits ===
MemoryMax=512M                   # Memory usage ceiling (OOM kill if exceeded)
MemoryHigh=384M                  # Soft memory limit (reclaim pressure if exceeded)
MemorySwapMax=0                  # Prohibit swap usage
MemoryLow=128M                   # Memory protection (guaranteed minimum)

# === CPU Limits ===
CPUQuota=50%                     # CPU usage ceiling (100% = 1 core)
CPUQuota=200%                    # 2 cores worth
CPUWeight=100                    # CPU share weight (default 100)
CPUAffinity=0 1                  # Specify CPU cores to use
AllowedCPUs=0-3                  # Allowed CPU range

# === IO Limits ===
IOWeight=100                     # IO share weight (1-10000)
IOReadBandwidthMax=/dev/sda 50M  # Read bandwidth limit
IOWriteBandwidthMax=/dev/sda 20M # Write bandwidth limit
IOReadIOPSMax=/dev/sda 3000      # Read IOPS limit
IOWriteIOPSMax=/dev/sda 1000     # Write IOPS limit

# === Process/Task Limits ===
TasksMax=100                     # Maximum number of tasks (processes/threads)
LimitNPROC=100                   # Process count limit
LimitNOFILE=65536                # File descriptor limit
LimitFSIZE=infinity              # File size limit
LimitCORE=0                      # Disable core dumps
# LimitCORE=infinity             # Enable core dumps

# === Timeouts ===
TimeoutStartSec=30               # Startup timeout
TimeoutStopSec=30                # Stop timeout
TimeoutAbortSec=30               # Abort timeout
RuntimeMaxSec=3600               # Maximum run time (1 hour)
WatchdogSec=30                   # Watchdog interval
```

### 8.2 Adding Resource Limits via Drop-ins

```bash
# Add resource limits to an existing service via a drop-in file
# /etc/systemd/system/nginx.service.d/limits.conf
[Service]
MemoryMax=512M
CPUQuota=50%
TasksMax=100

# Creation steps
sudo mkdir -p /etc/systemd/system/nginx.service.d/
sudo tee /etc/systemd/system/nginx.service.d/limits.conf <<'EOF'
[Service]
MemoryMax=512M
CPUQuota=50%
TasksMax=100
LimitNOFILE=65536
EOF

sudo systemctl daemon-reload
sudo systemctl restart nginx

# Verify the settings were applied
systemctl show nginx --property=MemoryMax,CPUQuota,TasksMax
```

### 8.3 Monitoring Resource Usage via cgroup

```bash
# Check resource usage
systemctl status nginx           # Shows Memory, CPU, Tasks

# Detailed resource information
systemd-cgtop                    # Resource usage by cgroup (top-like)
systemd-cgtop -m                 # Sort by memory
systemd-cgtop -c                 # Sort by CPU

# cgroup information for a specific service
cat /sys/fs/cgroup/system.slice/nginx.service/memory.current
cat /sys/fs/cgroup/system.slice/nginx.service/memory.max
cat /sys/fs/cgroup/system.slice/nginx.service/cpu.stat

# Resource display via systemctl
systemctl show nginx.service --property=MemoryCurrent
systemctl show nginx.service --property=CPUUsageNSec
```

---

## 9. Practical systemd Patterns

### 9.1 Investigating Service Startup Failures

```bash
# Pattern 1: Investigate a service startup failure
sudo systemctl status myapp      # First check status
journalctl -u myapp --since "10 minutes ago" --no-pager  # Recent logs
journalctl -u myapp -p err       # Errors only

# Common causes of startup failure and remedies:
# 1. Permission error → Check User/Group, verify file permissions
# 2. Port conflict → Check port usage with ss -tlnp
# 3. Dependency service not started → Check After/Requires
# 4. Configuration file error → Run configtest in ExecStartPre
# 5. Binary not found → Check path in ExecStart
# 6. SELinux/AppArmor → Check with ausearch -m AVC -ts recent
```

### 9.2 Bulk Management of Multiple Services

```bash
# Pattern 2: Bulk management of multiple services
for svc in nginx postgresql redis; do
    echo "=== $svc ==="
    systemctl is-active "$svc"
done

# Bulk restart
for svc in nginx postgresql redis; do
    sudo systemctl restart "$svc"
    echo "$svc: $(systemctl is-active "$svc")"
done

# One-liner status check
systemctl is-active nginx postgresql redis
```

### 9.3 Grouping Services with Targets

```ini
# Group services with a custom target
# /etc/systemd/system/webapp.target
[Unit]
Description=Web Application Stack
Requires=nginx.service postgresql.service redis.service myapp.service
After=nginx.service postgresql.service redis.service myapp.service

[Install]
WantedBy=multi-user.target

# Usage
sudo systemctl enable webapp.target
sudo systemctl start webapp.target   # Start all services
sudo systemctl stop webapp.target    # Stop all services
```

### 9.4 Boot Analysis

```bash
# Pattern 4: Checking boot order
systemd-analyze                  # Boot time
systemd-analyze blame            # Boot time per service
systemd-analyze critical-chain   # Critical path
systemd-analyze critical-chain nginx.service  # Critical path for a specific service

# Visualize boot time
systemd-analyze plot > boot.svg  # Output as SVG file

# Identify slow-starting services
systemd-analyze blame | head -20

# Debug boot
# Add systemd.log_level=debug to kernel parameters
```

### 9.5 User Services (No root Required)

```bash
# Pattern 5: User services (no root required)
mkdir -p ~/.config/systemd/user/

# Create ~/.config/systemd/user/myapp.service
cat > ~/.config/systemd/user/myapp.service <<'EOF'
[Unit]
Description=My User Application

[Service]
Type=simple
ExecStart=/home/user/bin/myapp
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

# Managing user services
systemctl --user daemon-reload
systemctl --user start myapp
systemctl --user enable myapp
systemctl --user status myapp
journalctl --user -u myapp

# Keep service running after logout (important)
sudo loginctl enable-linger $USER

# List user services
systemctl --user list-units --type=service
```

### 9.6 Running Temporary Services

```bash
# systemd-run: Run as a temporary service
# Instantly apply resource limits and log management

# Basic usage
sudo systemd-run --unit=temp-backup /opt/scripts/backup.sh

# With resource limits
sudo systemd-run --unit=temp-task \
    --property=MemoryMax=256M \
    --property=CPUQuota=50% \
    /opt/scripts/heavy-task.sh

# As a timer
sudo systemd-run --on-calendar="*-*-* 03:00:00" \
    --unit=temp-cleanup \
    /opt/scripts/cleanup.sh

# Run after a specified delay
sudo systemd-run --on-active="5m" \
    --unit=delayed-task \
    /opt/scripts/task.sh

# Run in user scope
systemd-run --user --scope --unit=my-build make -j4

# Check running temporary services
systemctl list-units --type=service 'run-*'
```

### 9.7 Conditional Service Dependencies

```ini
# Conditional startup settings
[Unit]
Description=My Conditional Service

# Conditions (service is skipped if false)
ConditionPathExists=/opt/myapp/config.yml     # File must exist
ConditionPathExists=!/opt/myapp/.disabled     # File must not exist
ConditionPathIsDirectory=/opt/myapp/data      # Directory must exist
ConditionFileIsExecutable=/opt/myapp/bin/app  # Must be executable
ConditionDirectoryNotEmpty=/opt/myapp/queue   # Directory must not be empty

# Environment conditions
ConditionVirtualization=!container            # Must not be in a container
ConditionKernelVersion=>=5.10                 # Kernel version condition
ConditionMemory=>=1G                          # Memory condition
ConditionCPUs=>=2                             # CPU count condition
ConditionEnvironment=ENABLE_MYAPP=true        # Environment variable condition

# Assertions (error if false)
AssertPathExists=/opt/myapp/config.yml        # Error if not present
```

---

## 10. Troubleshooting

### 10.1 Common Issues and Solutions

```bash
# === Issue 1: Service fails to start ===
# Steps:
sudo systemctl status myapp          # 1. Check status
journalctl -u myapp -n 50 --no-pager # 2. Check logs
systemd-analyze verify /etc/systemd/system/myapp.service  # 3. Syntax check
sudo -u myapp /opt/myapp/bin/app     # 4. Manual run test

# === Issue 2: Service restarts frequently ===
journalctl -u myapp --since "1 hour ago" | grep -E "Started|Stopped|Failed"
systemctl show myapp --property=NRestarts  # Restart count
# Check StartLimitBurst/StartLimitIntervalSec

# === Issue 3: Service takes too long to stop ===
# Check TimeoutStopSec
systemctl show myapp --property=TimeoutStopUSec
# Check KillMode (control-group, mixed, process, none)
# Check KillSignal (default SIGTERM)

# === Issue 4: Dependency service not started ===
systemctl list-dependencies myapp    # Check dependencies
systemctl list-dependencies --reverse myapp  # Check reverse dependencies

# === Issue 5: Unit file changes not reflected ===
sudo systemctl daemon-reload         # Always run this
systemctl cat myapp                  # Check current unit file
systemd-delta                        # Check overrides

# === Issue 6: Disk becoming full due to excessive logs ===
journalctl --disk-usage              # Check log size
sudo journalctl --vacuum-size=500M   # Reduce
# Set SystemMaxUse in /etc/systemd/journald.conf
```

### 10.2 Running in Debug Mode

```bash
# Run service in debug mode
sudo systemctl stop myapp

# Check environment variables
systemctl show myapp --property=Environment
systemctl show myapp --property=EnvironmentFiles

# Run ExecStart command manually
sudo -u myapp bash -c 'source /opt/myapp/.env && /opt/myapp/bin/app'

# Trace system calls with strace
sudo strace -f -p $(systemctl show myapp --property=MainPID --value)

# Enable debug logging
sudo systemctl set-environment SYSTEMD_LOG_LEVEL=debug
sudo systemctl restart myapp
journalctl -u myapp -f
# When done:
sudo systemctl unset-environment SYSTEMD_LOG_LEVEL
```

### 10.3 Useful systemd-Related Commands

```bash
# Check overall system state
systemctl is-system-running      # running, degraded, maintenance, etc.
systemctl --failed               # List failed units

# Boot target management
systemctl get-default            # Current default target
sudo systemctl set-default multi-user.target    # Boot to CLI
sudo systemctl set-default graphical.target     # Boot to GUI

# Power management
sudo systemctl poweroff          # Shutdown
sudo systemctl reboot            # Reboot
sudo systemctl suspend           # Suspend
sudo systemctl hibernate         # Hibernate

# Runlevel compatibility
# Old runlevel → systemd target
# 0 → poweroff.target
# 1 → rescue.target
# 3 → multi-user.target
# 5 → graphical.target
# 6 → reboot.target

sudo systemctl isolate rescue.target  # Rescue mode
sudo systemctl isolate multi-user.target  # Multi-user mode

# Hostname management
hostnamectl                      # Hostname information
sudo hostnamectl set-hostname myserver

# Date/time management
timedatectl                      # Date/time information
sudo timedatectl set-timezone Asia/Tokyo
timedatectl list-timezones       # List timezones
sudo timedatectl set-ntp true    # Enable NTP sync

# Locale management
localectl                        # Locale information
sudo localectl set-locale LANG=ja_JP.UTF-8
```

---

## 11. systemd and Docker / Container Integration

```ini
# Example of managing a Docker container with systemd
# /etc/systemd/system/docker-myapp.service
[Unit]
Description=MyApp Docker Container
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10

# Remove existing container before starting
ExecStartPre=-/usr/bin/docker rm -f myapp
ExecStart=/usr/bin/docker run \
    --name myapp \
    --rm \
    -p 8080:8080 \
    -v /opt/myapp/data:/data \
    --env-file /opt/myapp/.env \
    myapp:latest

ExecStop=/usr/bin/docker stop myapp

[Install]
WantedBy=multi-user.target

# Integration with docker compose
# /etc/systemd/system/docker-compose-myapp.service
[Unit]
Description=MyApp Docker Compose Stack
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/myapp
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose up -d --force-recreate

[Install]
WantedBy=multi-user.target
```

---

## 12. systemd Network Management (networkd)

```bash
# systemd-networkd: Network configuration management
# /etc/systemd/network/20-wired.network
# [Match]
# Name=eth0
#
# [Network]
# DHCP=yes
# DNS=8.8.8.8
# DNS=8.8.4.4
#
# [DHCPv4]
# RouteMetric=100

# Static IP configuration
# /etc/systemd/network/20-static.network
# [Match]
# Name=eth0
#
# [Network]
# Address=192.168.1.100/24
# Gateway=192.168.1.1
# DNS=8.8.8.8

# networkd management
sudo systemctl enable --now systemd-networkd
networkctl list                  # List network interfaces
networkctl status                # Detailed status
networkctl status eth0           # Status of a specific interface

# systemd-resolved: DNS resolution
sudo systemctl enable --now systemd-resolved
resolvectl status                # Check DNS configuration
resolvectl query example.com     # DNS query
```


---

## Practical Exercises

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

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

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

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes decision criteria for technology selection.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|---------------------|
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
│  1. Team size?                                  │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. Deployment frequency?                       │
│    ├─ Weekly or less → Monolith + modular split │
│    └─ Daily/multiple times → Go to 3            │
│                                                 │
│  3. Inter-team independence?                    │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A fast short-term solution may become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has low learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- Higher abstraction increases reusability but can make debugging difficult
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
        """Describe background and problem"""
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
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring from an early stage

**Lessons learned:**
- Don't pursue perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally overhaul a system that has been running for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if existing tests are absent
- Coexist old and new systems via an API gateway
- Migrate data incrementally

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Use domain-driven design to clarify boundaries
- Assign ownership to each team
- Manage shared libraries with Inner Source
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
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

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|------------------------|--------|---------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just from theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and moving on to advanced topics. We recommend fully understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Command | Purpose |
|---------|---------|
| systemctl start/stop/restart | Service operations |
| systemctl enable/disable | Auto-start management |
| systemctl status | Check status |
| systemctl mask/unmask | Completely disable a service |
| systemctl edit | Customize via drop-in |
| journalctl -u service | Service logs |
| journalctl -f | Real-time logs |
| journalctl -p err | Priority filter |
| journalctl -b -1 | Logs from previous boot |
| systemctl daemon-reload | Reload units |
| systemd-analyze security | Security audit |
| systemd-analyze blame | Boot time analysis |
| systemd-cgtop | Resource usage monitor |
| systemd-run | Run a temporary service |

---

## What to Read Next

---

## References
1. "systemd System and Service Manager." systemd.io.
2. Barrett, D. "Efficient Linux at the Command Line." Ch.10, O'Reilly, 2022.
3. "systemd.exec — Execution environment configuration." freedesktop.org/software/systemd/man.
4. "systemd.service — Service unit configuration." freedesktop.org/software/systemd/man.
5. "Arch Wiki: systemd." wiki.archlinux.org/title/systemd.
6. Nemeth, E., et al. "UNIX and Linux System Administration Handbook." 5th Ed, Ch.2, Addison-Wesley, 2017.
