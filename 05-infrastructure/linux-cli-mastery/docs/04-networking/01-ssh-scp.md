# Remote Connections (SSH, SCP, rsync)

> SSH is the foundation of remote server operations. It enables secure connections, file transfers, and tunneling.

## What You Will Learn

- [ ] Connect securely to remote servers using SSH
- [ ] Generate and manage SSH keys
- [ ] Transfer files with SCP / rsync
- [ ] Leverage SSH tunneling
- [ ] Configure the SSH config file efficiently
- [ ] Understand sshd security settings
- [ ] Use multi-hop SSH and jump hosts
- [ ] Troubleshoot SSH-related issues


## Prerequisites

Having the following knowledge before reading this guide will help you understand the content:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Network Tools (curl, wget)](./00-curl-wget.md)

---

## 1. SSH Basics

### 1.1 What is SSH

SSH (Secure Shell) is a protocol that establishes a secure communication channel over a network. Through encrypted communication, it provides the following capabilities:

- **Remote shell access**: Safely operate the command line of a remote server
- **File transfer**: Encrypted file transfer via SCP, SFTP, and rsync
- **Port forwarding**: Secure network relay through SSH tunnels
- **X11 forwarding**: Display remote GUI applications locally

```bash
# Check SSH version
ssh -V
# OpenSSH_9.6p1, LibreSSL 3.3.6

# How the SSH protocol works (simplified)
# 1. Establish TCP connection (default: port 22)
# 2. Exchange SSH protocol version
# 3. Negotiate key exchange algorithm
# 4. Server authentication (verify host key)
# 5. User authentication (public key, password, etc.)
# 6. Establish encrypted communication channel
```

### 1.2 Basic Connection

```bash
# Basic: ssh [options] [user@]host

# ===== Connection methods =====

# Connect with a specific user
ssh user@server.example.com

# Connect with the current username
ssh server.example.com

# Specify a port
ssh -p 2222 user@server.com

# Explicitly specify a private key
ssh -i ~/.ssh/my_key user@server.com

# Connect via IPv6 address
ssh user@"[2001:db8::1]"

# Skip host key check on connection (for automation on first connect)
ssh -o StrictHostKeyChecking=no user@server.com
# Note: Security risk. Not recommended outside of automation scripts

# Check the host key fingerprint in advance
ssh-keyscan server.example.com 2>/dev/null | ssh-keygen -l -f -
```

### 1.3 Executing Remote Commands

```bash
# Execute a command on the remote host and disconnect
ssh user@server.com command

# Single command
ssh user@server "ls -la /var/log"
ssh user@server "df -h && free -m"
ssh user@server 'cat /etc/nginx/nginx.conf'

# Run multiple commands
ssh user@server "uname -a; uptime; who"
ssh user@server "cd /var/log && tail -100 syslog"

# Commands using pipes
ssh user@server "ps aux | grep nginx | grep -v grep"

# Commands with sudo (-t: force pseudo-terminal allocation)
ssh -t user@server "sudo systemctl restart nginx"

# Run complex scripts using a here document
ssh user@server bash <<'EOF'
echo "=== System Info ==="
uname -a
echo ""
echo "=== Disk Usage ==="
df -h
echo ""
echo "=== Memory ==="
free -m
echo ""
echo "=== Top Processes ==="
ps aux --sort=-%cpu | head -5
EOF

# Receive the exit code from the remote command
ssh user@server "test -f /var/run/app.pid"
echo "Exit code: $?"  # 0=file exists, 1=does not exist

# Run the same command on multiple servers
for server in web1 web2 web3; do
    echo "=== $server ==="
    ssh "$server" "uptime"
done

# Parallel execution (xargs)
echo -e "web1\nweb2\nweb3" | xargs -P 3 -I {} ssh {} "uptime"

# Parallel execution (GNU parallel)
parallel ssh {} "uptime" ::: web1 web2 web3
```

### 1.4 SSH Connection Options

```bash
# Verbose debug output (essential for investigating connection issues)
ssh -v user@server    # Level 1 (basic debug information)
ssh -vv user@server   # Level 2 (more detailed)
ssh -vvv user@server  # Level 3 (maximum detail)

# Enable compression (useful on slow connections)
ssh -C user@server

# X11 forwarding (display remote GUI apps locally)
ssh -X user@server    # X11 forwarding
ssh -Y user@server    # Trusted X11 forwarding (less secure)

# Connection keepalive
ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=3 user@server

# Connection timeout
ssh -o ConnectTimeout=10 user@server

# Batch mode (do not prompt for password)
ssh -o BatchMode=yes user@server "uptime"

# Change escape character (default is ~)
ssh -e '%' user@server

# Escape commands within an SSH session (default: ~)
# ~.   → Force disconnect
# ~^Z  → Move SSH to background
# ~~   → Send the ~ character
# ~?   → Show list of escape commands
# ~#   → List forwarded connections
# ~C   → Open command line (for adding dynamic forwarding, etc.)
```

---

## 2. Managing SSH Keys

### 2.1 Generating Key Pairs

```bash
# ===== Choosing a key algorithm =====

# Ed25519 (recommended): fast, secure, short key
ssh-keygen -t ed25519 -C "gaku@example.com"
# Keys generated:
# ~/.ssh/id_ed25519      ← Private key (never share this)
# ~/.ssh/id_ed25519.pub  ← Public key (register on the server)

# Ed25519-SK (for FIDO2/U2F hardware keys)
ssh-keygen -t ed25519-sk -C "gaku@example.com"

# RSA 4096bit: for legacy environments (compatibility with older systems)
ssh-keygen -t rsa -b 4096 -C "gaku@example.com"

# ECDSA: elliptic curve cryptography (NIST curves)
ssh-keygen -t ecdsa -b 521 -C "gaku@example.com"

# ===== Key generation options =====

# Generate with a specified filename
ssh-keygen -t ed25519 -f ~/.ssh/project_key -C "project@example.com"

# Generate without a passphrase (for automation)
ssh-keygen -t ed25519 -f ~/.ssh/automation_key -N "" -C "automation"

# Change the passphrase
ssh-keygen -p -f ~/.ssh/id_ed25519

# Check the key fingerprint
ssh-keygen -l -f ~/.ssh/id_ed25519.pub
# 256 SHA256:AbCdEfGhIj... gaku@example.com (ED25519)

# Visual fingerprint (random art) of the key
ssh-keygen -lv -f ~/.ssh/id_ed25519.pub

# Check the public key content
cat ~/.ssh/id_ed25519.pub
# ssh-ed25519 AAAA... gaku@example.com

# Regenerate a public key from a private key
ssh-keygen -y -f ~/.ssh/id_ed25519 > ~/.ssh/id_ed25519.pub
```

### 2.2 Comparing Key Algorithms

```text
┌──────────────┬────────────┬──────────────┬───────────────┬──────────────────┐
│ Algorithm    │ Key length │ Security     │ Speed         │ Notes            │
├──────────────┼────────────┼──────────────┼───────────────┼──────────────────┤
│ Ed25519      │ 256bit     │ ◎ Very high  │ ◎ Very fast   │ Current standard │
│ Ed25519-SK   │ 256bit     │ ◎ HW key req │ ◎             │ FIDO2 support    │
│ ECDSA        │ 256-521bit │ ○ High       │ ○ Fast        │ NIST curves      │
│ RSA          │ 2048-4096  │ ○ High(4096) │ △ Slightly slow│ Legacy compat   │
│ DSA          │ 1024bit    │ × Deprecated │ ○ Fast        │ Removed in OpenSSH 7.0│
└──────────────┴────────────┴──────────────┴───────────────┴──────────────────┘

Recommended: Ed25519 > ECDSA > RSA 4096 > RSA 2048
```

### 2.3 Registering a Public Key

```bash
# Method 1: ssh-copy-id (easiest)
ssh-copy-id user@server.com
ssh-copy-id -i ~/.ssh/specific_key.pub user@server.com
ssh-copy-id -p 2222 user@server.com

# Method 2: Copy manually
cat ~/.ssh/id_ed25519.pub | ssh user@server "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

# Method 3: Paste from clipboard (macOS)
pbcopy < ~/.ssh/id_ed25519.pub
# Paste into ~/.ssh/authorized_keys on the server

# Method 4: Retrieve public key from GitHub/GitLab
curl -s https://github.com/username.keys >> ~/.ssh/authorized_keys
curl -s https://gitlab.com/username.keys >> ~/.ssh/authorized_keys

# Check registered public keys (on the server)
cat ~/.ssh/authorized_keys

# Adding restrictions to specific keys (inside authorized_keys)
# Command restriction: allow only a specific command
# command="rsync --server --sender -logDtprze.iLsfxCIvu . /data",no-pty,no-port-forwarding ssh-ed25519 AAAA...
# IP address restriction
# from="192.168.1.0/24" ssh-ed25519 AAAA...
# Combining multiple restrictions
# from="10.0.0.0/8",command="/usr/local/bin/backup.sh",no-pty,no-port-forwarding ssh-ed25519 AAAA...
```

### 2.4 Key Management with ssh-agent

```bash
# ssh-agent: keeps passphrases for passphrase-protected keys in memory
# → No need to enter the passphrase every time

# Start the agent
eval "$(ssh-agent -s)"
# Agent pid 12345

# Add a key to the agent
ssh-add ~/.ssh/id_ed25519        # Default key
ssh-add ~/.ssh/project_key       # Specific key

# List registered keys
ssh-add -l                       # Show fingerprints
ssh-add -L                       # Show full public keys

# Remove all keys
ssh-add -D

# Remove a specific key
ssh-add -d ~/.ssh/id_ed25519

# Register with an expiration time (improved security)
ssh-add -t 3600 ~/.ssh/id_ed25519    # Auto-delete after 1 hour
ssh-add -t 28800 ~/.ssh/id_ed25519   # 8 hours (working hours only)

# macOS: Integrate with Keychain
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
# → Keys are automatically loaded on login

# macOS: Set in ~/.ssh/config (for persistence)
# Host *
#     UseKeychain yes
#     AddKeysToAgent yes
#     IdentityFile ~/.ssh/id_ed25519

# Agent forwarding (used for authentication through a jump host)
ssh -A user@bastion
# When connecting to an internal server from the bastion, your local key can be used
# Note: Security risk. Use only with trusted servers

# Check agent forwarding
echo "$SSH_AUTH_SOCK"
ssh-add -l  # Run on the bastion server → local keys are visible

# Stop the agent
ssh-agent -k
```

### 2.5 SSH Key Security

```bash
# ===== Permissions (important) =====
chmod 700 ~/.ssh                 # Directory
chmod 600 ~/.ssh/id_ed25519      # Private key
chmod 644 ~/.ssh/id_ed25519.pub  # Public key
chmod 600 ~/.ssh/authorized_keys # Authorized keys list
chmod 600 ~/.ssh/config          # Config file
chmod 600 ~/.ssh/known_hosts     # Known hosts

# SSH will reject a key if permissions are incorrect
# Error example: "Permissions 0644 for '/home/user/.ssh/id_ed25519' are too open."

# Script to fix all permissions at once
fix_ssh_permissions() {
    local ssh_dir="$HOME/.ssh"

    chmod 700 "$ssh_dir"
    chmod 600 "$ssh_dir"/id_* 2>/dev/null
    chmod 644 "$ssh_dir"/*.pub 2>/dev/null
    chmod 600 "$ssh_dir"/authorized_keys 2>/dev/null
    chmod 600 "$ssh_dir"/config 2>/dev/null
    chmod 600 "$ssh_dir"/known_hosts 2>/dev/null

    echo "SSH permissions fixed"
    ls -la "$ssh_dir"
}

# ===== Managing known_hosts =====

# Hash host keys (to prevent IP address leakage)
ssh-keygen -H -f ~/.ssh/known_hosts

# Remove a specific host's key (when the host key has changed)
ssh-keygen -R server.example.com
ssh-keygen -R "[server.example.com]:2222"  # When a port is specified

# Pre-add a host key
ssh-keyscan -H server.example.com >> ~/.ssh/known_hosts 2>/dev/null
ssh-keyscan -p 2222 -H server.example.com >> ~/.ssh/known_hosts 2>/dev/null

# ===== Key rotation =====

# 1. Generate a new key
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_new -C "gaku@example.com (rotated $(date +%Y%m%d))"

# 2. Add the new public key to the server
ssh-copy-id -i ~/.ssh/id_ed25519_new.pub user@server

# 3. Test connection with the new key
ssh -i ~/.ssh/id_ed25519_new user@server "echo 'New key works'"

# 4. Remove the old key (from authorized_keys on the server)
ssh user@server "sed -i '/OLD_KEY_COMMENT/d' ~/.ssh/authorized_keys"

# 5. Replace the local key
mv ~/.ssh/id_ed25519 ~/.ssh/id_ed25519_old
mv ~/.ssh/id_ed25519_new ~/.ssh/id_ed25519
mv ~/.ssh/id_ed25519_new.pub ~/.ssh/id_ed25519.pub
```

---

## 3. SSH Config File (~/.ssh/config)

### 3.1 Basic Configuration

```bash
# Manage connection settings with ~/.ssh/config
# Long commands can be shortened to aliases

# Basic host definition
# ssh production → ssh -p 2222 -i ~/.ssh/prod_key deploy@prod.example.com
Host production
    HostName prod.example.com
    User deploy
    Port 2222
    IdentityFile ~/.ssh/prod_key

Host staging
    HostName staging.example.com
    User deploy
    IdentityFile ~/.ssh/staging_key

# Wildcard
Host *.example.com
    User gaku
    IdentityFile ~/.ssh/id_ed25519
```

### 3.2 Jump Host Configuration

```bash
# ===== ProxyJump (recommended: OpenSSH 7.3+) =====

# Connect to an internal server through a jump host
Host bastion
    HostName bastion.example.com
    User admin
    IdentityFile ~/.ssh/bastion_key

Host internal-server
    HostName 192.168.1.100
    User admin
    ProxyJump bastion

# Multi-hop jump host (bastion1 → bastion2 → target)
Host target
    HostName 10.0.1.50
    User admin
    ProxyJump bastion1,bastion2

# Connectable with just: ssh internal-server

# ===== ProxyCommand (legacy: for older OpenSSH) =====

Host internal-legacy
    HostName 192.168.1.100
    User admin
    ProxyCommand ssh -W %h:%p bastion

# ===== Specifying a jump host on the command line =====

# -J option (command-line version of ProxyJump)
ssh -J bastion.example.com user@10.0.1.100
ssh -J user1@bastion1:22,user2@bastion2:22 user3@target
```

### 3.3 Advanced Configuration

```bash
# ===== Per-environment configuration =====

# Development environment
Host dev-*
    User developer
    IdentityFile ~/.ssh/dev_key
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel ERROR

# Production environment (strict settings)
Host prod-*
    User deploy
    IdentityFile ~/.ssh/prod_key
    StrictHostKeyChecking yes
    PasswordAuthentication no
    ForwardAgent no

# AWS EC2 instances
Host ec2-*
    User ec2-user
    IdentityFile ~/.ssh/aws_key.pem
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null

# GitHub (using different keys)
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_ed25519

Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_work_ed25519

# ===== Connection optimization =====

# Connection multiplexing (ControlMaster)
# Subsequent connections to the same host become instant
Host *
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 600
    # ControlMaster auto: make the first connection the master
    # ControlPath: location of the socket file
    # ControlPersist 600: keep master connection for 600 seconds

# The socket directory must be created
# mkdir -p ~/.ssh/sockets

# Manual multiplexing management
# ssh -O check hostname   → Check master connection
# ssh -O stop hostname    → Stop master connection
# ssh -O exit hostname    → Exit master connection

# ===== Global settings for all hosts =====
Host *
    ServerAliveInterval 60       # Send keepalive every 60 seconds
    ServerAliveCountMax 3        # Disconnect after 3 failures
    AddKeysToAgent yes           # Automatically add keys to agent
    IdentitiesOnly yes           # Use only specified keys
    HashKnownHosts yes           # Hash known_hosts
    Compression yes              # Enable compression
    TCPKeepAlive yes             # TCP-level keepalive
```

### 3.4 Config File Load Order

```bash
# SSH config priority (higher is higher priority)
# 1. Command-line options (ssh -p 2222 ...)
# 2. User config (~/.ssh/config)
# 3. System config (/etc/ssh/ssh_config)

# Priority within the config file
# - Settings from the first matching Host block are used
# - Host * should be written last (as a fallback)

# Check config (display the actual settings values used)
ssh -G hostname
ssh -G hostname | grep -i proxyj

# Use Include to manage config across multiple files
# Write at the top of ~/.ssh/config:
Include config.d/*

# ~/.ssh/config.d/work
Host work-*
    User developer
    IdentityFile ~/.ssh/work_key

# ~/.ssh/config.d/personal
Host personal-*
    User gaku
    IdentityFile ~/.ssh/personal_key
```

---

## 4. File Transfer (SCP, rsync)

### 4.1 SCP

```bash
# scp: file copy over SSH
# Note: OpenSSH 9.0 and later uses the sftp protocol internally
# Fine for simple copies, but rsync is more feature-rich

# ===== Local → Remote =====
scp file.txt user@server:/home/user/
scp -r ./dir user@server:/home/user/       # Directory (recursive)
scp -P 2222 file.txt user@server:/tmp/     # Port specification (-P uppercase!)
scp -i ~/.ssh/key file.txt user@server:/tmp/  # Specify key

# Multiple files
scp file1.txt file2.txt file3.txt user@server:/home/user/
scp *.log user@server:/var/log/backup/

# ===== Remote → Local =====
scp user@server:/var/log/app.log ./
scp -r user@server:/home/user/dir ./

# ===== Remote → Remote =====
scp user@server1:/file user@server2:/file

# ===== Options =====
scp -C file.txt user@server:/tmp/       # Compressed transfer
scp -l 5000 file.txt user@server:/tmp/  # Bandwidth limit (Kbit/s)
scp -p file.txt user@server:/tmp/       # Preserve timestamps
scp -q file.txt user@server:/tmp/       # Suppress progress
scp -v file.txt user@server:/tmp/       # Debug output

# SCP limitations:
# - No delta transfer (always transfers all data)
# - Cannot resume interrupted transfers
# - Cannot specify exclusion patterns
# - Limited symlink handling
# → Use rsync when these features are needed
```

### 4.2 rsync (Recommended)

```bash
# rsync: delta transfer (fast, resumable, flexible)

# ===== Basic syntax =====
# rsync [options] source destination

# ===== Local → Remote =====
rsync -avz ./project/ user@server:/home/user/project/
# -a: archive mode (equivalent to -rlptgoD)
#   -r: recursive
#   -l: preserve symlinks
#   -p: preserve permissions
#   -t: preserve timestamps
#   -g: preserve group
#   -o: preserve owner
#   -D: preserve device and special files
# -v: verbose output
# -z: compressed transfer

# ===== Remote → Local =====
rsync -avz user@server:/var/log/ ./logs/

# ===== Specifying port and key =====
rsync -avz -e "ssh -p 2222 -i ~/.ssh/key" ./project/ user@server:/app/

# ===== Important: meaning of the trailing slash =====
rsync -avz ./dir  user@server:/dest/   # → transferred as /dest/dir/
rsync -avz ./dir/ user@server:/dest/   # → transferred as contents of /dest/
# Trailing / means "contents of the directory"
# Without / means "the directory itself"

# ===== Exclusion patterns =====
rsync -avz --exclude='.git' --exclude='node_modules' ./project/ user@server:/app/
rsync -avz --exclude='*.log' --exclude='*.tmp' ./data/ user@server:/data/

# Exclude using a pattern file
rsync -avz --exclude-from='.rsyncignore' ./project/ user@server:/app/

# Example .rsyncignore:
# .git/
# node_modules/
# *.log
# *.tmp
# .env
# .DS_Store
# __pycache__/
# *.pyc

# Combining exclusions and inclusions
rsync -avz --include='*.py' --exclude='*' ./src/ user@server:/src/
# Transfer only Python files

# ===== Dry run (check without executing) =====
rsync -avzn ./project/ user@server:/app/   # -n: dry run
rsync -avz --dry-run ./project/ user@server:/app/  # same as above

# ===== Delete sync =====
# Delete files from the destination that no longer exist in the source
rsync -avz --delete ./project/ user@server:/app/

# Confirm before deleting (dry run + delete)
rsync -avzn --delete ./project/ user@server:/app/

# Do not restrict deletions to excluded files
rsync -avz --delete --delete-excluded ./project/ user@server:/app/

# ===== Bandwidth limit =====
rsync -avz --bwlimit=5000 ./large/ user@server:/backup/  # 5MB/s
rsync -avz --bwlimit=1m ./large/ user@server:/backup/    # 1MB/s

# ===== Progress display =====
rsync -avz --progress ./large/ user@server:/backup/
rsync -avz --info=progress2 ./large/ user@server:/backup/  # Overall progress

# ===== Checksum verification =====
rsync -avzc ./project/ user@server:/app/
# -c: determine delta by checksum instead of timestamp (slower but reliable)

# ===== Partial transfer (resume) =====
rsync -avz --partial --partial-dir=.rsync-partial ./large/ user@server:/backup/
# Keeps partially transferred files on interruption → resumes from where it left off

# -P is shorthand for --partial --progress
rsync -avzP ./large/ user@server:/backup/

# ===== Backup feature =====
# Create a backup of files that would be overwritten
rsync -avz --backup --backup-dir=../backup/$(date +%Y%m%d) \
    ./project/ user@server:/app/

# ===== Generational backup using hard links =====
rsync -avz --link-dest=../backup-prev \
    user@server:/var/www/ ./backup-$(date +%Y%m%d)/
# --link-dest: hard-link files identical to the previous backup to save space
```

### 4.3 Advanced rsync Usage

```bash
# ===== Filter rules =====
rsync -avz --filter='- .git/' --filter='- node_modules/' ./project/ user@server:/app/

# Merge file (.rsync-filter)
rsync -avz --filter=': .rsync-filter' ./project/ user@server:/app/

# ===== Copy between remotes (through your machine) =====
rsync -avz user@server1:/data/ user@server2:/data/
# Note: data is transferred through the local machine

# ===== Local sync (as a replacement for cp) =====
rsync -avz /source/ /destination/
# Faster than cp -a (only delta is transferred)

# ===== Real-time sync combined with inotifywait =====
# Requires inotify-tools on Linux
while inotifywait -r -e modify,create,delete ./project/; do
    rsync -avz --delete ./project/ user@server:/app/
done

# ===== rsync daemon mode =====
# Server side: /etc/rsyncd.conf
# [data]
#   path = /var/data
#   read only = false
#   auth users = rsyncuser
#   secrets file = /etc/rsyncd.secrets

# Client side
rsync -avz ./data/ rsyncuser@server::data/
rsync -avz rsyncuser@server::data/ ./data/

# ===== Show statistics =====
rsync -avz --stats ./project/ user@server:/app/
# Number of files: 1,234
# Total file size: 123,456,789 bytes
# Total transferred file size: 1,234,567 bytes
# Literal data: 1,200,000 bytes
# Matched data: 34,567 bytes
# Speedup is 100.00
```

### 4.4 sftp

```bash
# sftp: interactive file transfer (FTP-like interface)

# Connect
sftp user@server
sftp -P 2222 user@server          # Specify port
sftp -i ~/.ssh/key user@server    # Specify key

# sftp commands
# ===== Navigation =====
# ls            List remote files
# lls           List local files
# cd /var/log   Change remote directory
# lcd ~/tmp     Change local directory
# pwd           Show current remote directory
# lpwd          Show current local directory

# ===== File transfer =====
# get remote_file.txt              Download
# get remote_file.txt local.txt    Download with a new name
# get -r remote_dir/               Download a directory
# put local_file.txt               Upload
# put local_file.txt remote.txt    Upload with a new name
# put -r local_dir/                Upload a directory
# mget *.log                       Download with wildcard
# mput *.txt                       Upload with wildcard

# ===== File operations =====
# mkdir new_dir    Create directory
# rmdir old_dir    Remove directory
# rm file.txt      Delete file
# rename old new   Rename
# chmod 644 file   Change permissions
# chown uid file   Change owner

# ===== Other =====
# !command    Execute command locally
# df -h       Show remote disk usage
# quit        Exit (exit, bye also work)

# Batch mode (non-interactive)
sftp -b batch.txt user@server
# batch.txt:
# cd /var/log
# get *.log
# quit
```

---

## 5. SSH Tunneling (Port Forwarding)

### 5.1 Local Forwarding

```bash
# Local forwarding: access a remote service via a local port
# ssh -L [local-address:]local-port:remote-host:remote-port user@ssh-server

# Basic form
ssh -L 8080:localhost:80 user@server
# Local port 8080 → port 80 on the SSH server
# http://localhost:8080 in browser → connects to remote port 80

# Connect to a remote DB
ssh -L 5432:localhost:5432 user@server
# Local port 5432 → remote PostgreSQL
# Connect to remote DB with: psql -h localhost -p 5432

ssh -L 3306:localhost:3306 user@server
# Local port 3306 → remote MySQL

ssh -L 6379:localhost:6379 user@server
# Local port 6379 → remote Redis

# Connect to an internal server through a jump host
ssh -L 3306:internal-db:3306 user@bastion
# Local port 3306 → via bastion → internal-db:3306
# Connect MySQL Workbench to localhost:3306 → accesses internal DB

ssh -L 8443:internal-web:443 user@bastion
# Local port 8443 → via bastion → internal web server port 443

# Forwarding multiple ports simultaneously
ssh -L 5432:db-server:5432 -L 6379:redis-server:6379 -L 9200:es-server:9200 user@bastion

# Specifying a bind address
ssh -L 0.0.0.0:8080:localhost:80 user@server
# → Also accessible from other machines on the local network
# Note: Be aware of security risks

ssh -L 127.0.0.1:8080:localhost:80 user@server
# → Localhost only (default)
```

### 5.2 Remote Forwarding

```bash
# Remote forwarding: expose a local service via a remote port
# ssh -R [remote-address:]remote-port:local-host:local-port user@ssh-server

# Basic form
ssh -R 8080:localhost:3000 user@server
# Remote port 8080 → local port 3000
# Allows viewing an app under development from the remote side
# curl http://localhost:8080 on remote → connects to local port 3000

# Use cases:
# 1. Show an app under development to team members
ssh -R 8080:localhost:3000 user@shared-server

# 2. Expose a service behind NAT/firewall to the outside
ssh -R 0.0.0.0:9090:localhost:8080 user@public-server
# Note: Requires GatewayPorts yes in sshd_config

# 3. Testing webhooks (receive on local dev server)
ssh -R 8080:localhost:4000 user@server
# Set webhook URL to http://server:8080/

# Notes on remote forwarding:
# - By default, only binds to localhost on the remote side
# - GatewayPorts setting is needed for external access
# - sshd_config on the server: GatewayPorts yes
```

### 5.3 Dynamic Forwarding (SOCKS Proxy)

```bash
# Dynamic forwarding: use the SSH server as a SOCKS proxy
# ssh -D [local-address:]local-port user@ssh-server

ssh -D 1080 user@server
# Local port 1080 becomes a SOCKS proxy
# All traffic is routed through the SSH server

# Browser settings:
# SOCKS Host: localhost
# Port: 1080
# SOCKS Version: SOCKS5

# Use SOCKS proxy with curl
curl --socks5 localhost:1080 https://example.com
curl --socks5-hostname localhost:1080 https://example.com
# --socks5-hostname: DNS resolution also goes through the proxy (recommended)

# Git via SOCKS proxy
git -c "http.proxy=socks5://localhost:1080" clone https://github.com/user/repo

# Use cases:
# - Connect to services only accessible from a specific country
# - Access internal services from a company network
# - Encrypt traffic on public Wi-Fi
```

### 5.4 Background Tunnels

```bash
# Create a tunnel in the background
ssh -fNL 5432:localhost:5432 user@server
# -f: go to background
# -N: do not execute a command (tunnel only)

# Check the tunnel
ps aux | grep "ssh -fN"
lsof -i :5432

# Terminate the tunnel
kill $(pgrep -f "ssh -fNL 5432")

# autossh: tunnel with automatic reconnection (recommended)
# brew install autossh / apt install autossh
autossh -M 0 -fNL 5432:localhost:5432 user@server \
    -o "ServerAliveInterval 30" \
    -o "ServerAliveCountMax 3"
# -M 0: use SSH keepalive for connection monitoring
# Automatically reconnects when the connection is lost

# Persist the tunnel with systemd (Linux)
# /etc/systemd/system/ssh-tunnel-db.service
# [Unit]
# Description=SSH Tunnel to Database
# After=network.target
#
# [Service]
# User=deploy
# ExecStart=/usr/bin/autossh -M 0 -NL 5432:localhost:5432 user@server \
#     -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3" \
#     -o "ExitOnForwardFailure yes" -i /home/deploy/.ssh/tunnel_key
# Restart=always
# RestartSec=10
#
# [Install]
# WantedBy=multi-user.target
```

### 5.5 Tunneling Diagram

```text
=== Local Forwarding (-L) ===

[Local PC]                      [SSH Server]           [Target]
  localhost:8080 ──SSH encrypted──→ sshd ──plain──→ internal-db:3306
  (browser, etc.)                   (jump host)

  Command: ssh -L 8080:internal-db:3306 user@sshserver

=== Remote Forwarding (-R) ===

[Local PC]                      [SSH Server]
  localhost:3000 ←──SSH encrypted── sshd:8080
  (dev server)                      (externally accessible)

  Command: ssh -R 8080:localhost:3000 user@sshserver

=== Dynamic Forwarding (-D) ===

[Local PC]                      [SSH Server]           [Any Server]
  SOCKS5:1080 ──SSH encrypted──→ sshd ──plain──→ (anywhere)
  (browser, etc.)

  Command: ssh -D 1080 user@sshserver
```

---

## 6. SSH Server Configuration (sshd_config)

### 6.1 Security Hardening Settings

```bash
# Recommended settings for /etc/ssh/sshd_config

# ===== Basic settings =====
Port 22                        # Port number (recommended to change)
# Port 2222                    # When using a non-standard port
ListenAddress 0.0.0.0          # Listen on IPv4
ListenAddress ::               # Listen on IPv6

# ===== Authentication settings =====
PermitRootLogin no             # Prohibit root login (required)
PasswordAuthentication no      # Disable password authentication (key auth only)
PermitEmptyPasswords no        # Prohibit empty passwords
PubkeyAuthentication yes       # Enable public key authentication
AuthorizedKeysFile .ssh/authorized_keys  # Location of public key file

# ===== Security =====
MaxAuthTries 3                 # Limit authentication attempts
MaxSessions 5                  # Maximum number of sessions
LoginGraceTime 30              # Login grace period (seconds)
ClientAliveInterval 300        # Client liveness check interval
ClientAliveCountMax 2          # Maximum failed liveness checks

# ===== Protocol settings =====
Protocol 2                     # SSH2 only (SSH1 is deprecated)
X11Forwarding no               # Disable X11 forwarding
AllowTcpForwarding yes         # Allow TCP forwarding
GatewayPorts no                # Restrict remote forwarding bind
AllowAgentForwarding yes       # Allow agent forwarding

# ===== User/group restrictions =====
AllowUsers deploy admin        # Allowed users
# DenyUsers testuser           # Denied users
# AllowGroups sshusers         # Allowed groups
# DenyGroups noremote          # Denied groups

# ===== Logging =====
SyslogFacility AUTH
LogLevel VERBOSE               # Verbose logging (for auditing)

# ===== Other security settings =====
UsePAM yes                     # Use PAM authentication
PrintMotd no                   # Do not display login message
Banner /etc/ssh/banner.txt     # Display banner on connection
AcceptEnv LANG LC_*            # Restrict environment variable passing

# Apply configuration changes
sudo sshd -t                   # Test config file
sudo systemctl restart sshd    # Restart sshd
# Note: Always keep another terminal connected before restarting!
```

### 6.2 Additional Security Measures

```bash
# ===== Preventing unauthorized access with fail2ban =====
# sudo apt install fail2ban

# /etc/fail2ban/jail.local
# [sshd]
# enabled = true
# port = ssh
# filter = sshd
# logpath = /var/log/auth.log
# maxretry = 3
# bantime = 3600
# findtime = 600

# Check fail2ban status
sudo fail2ban-client status sshd

# ===== Firewall (ufw) =====
sudo ufw allow 22/tcp          # Allow SSH port
sudo ufw allow from 192.168.1.0/24 to any port 22  # Allow only specific network
sudo ufw enable

# ===== iptables =====
# Allow SSH only from specific IPs
sudo iptables -A INPUT -p tcp --dport 22 -s 192.168.1.0/24 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j DROP

# ===== Monitoring SSH logs =====
# Check authentication failures
sudo grep "Failed password" /var/log/auth.log | tail -20
sudo grep "Invalid user" /var/log/auth.log | tail -20

# Check successful authentications
sudo grep "Accepted" /var/log/auth.log | tail -20

# Real-time monitoring
sudo tail -f /var/log/auth.log | grep sshd

# ===== Two-factor authentication (Google Authenticator) =====
# sudo apt install libpam-google-authenticator
# google-authenticator  # Initial setup
# Add to /etc/pam.d/sshd:
# auth required pam_google_authenticator.so
# /etc/ssh/sshd_config:
# ChallengeResponseAuthentication yes
# AuthenticationMethods publickey,keyboard-interactive
```

---

## 7. Practical Patterns

### 7.1 Multi-hop SSH (via Jump Host)

```bash
# ===== Configuration in ~/.ssh/config =====
Host bastion
    HostName bastion.example.com
    User admin
    IdentityFile ~/.ssh/bastion_key

Host target
    HostName 10.0.1.100
    User admin
    ProxyJump bastion

# Connectable with just: ssh target

# ===== Multi-hop file transfer =====
# rsync via jump host
rsync -avz -e "ssh -J bastion" ./data/ admin@10.0.1.100:/data/

# scp via jump host
scp -o ProxyJump=bastion file.txt admin@10.0.1.100:/tmp/

# ===== Multi-hop tunneling =====
# Connect to the DB on internal-server via bastion
ssh -J bastion -L 5432:localhost:5432 admin@10.0.1.100
```

### 7.2 Remote Server Monitoring

```bash
# Real-time monitoring of remote server logs
ssh user@server "tail -f /var/log/app.log"

# Monitor logs from multiple servers simultaneously (recommend using tmux/screen)
# tmux:
# Ctrl-b " → split pane
# In each pane: ssh user@web1 "tail -f /var/log/app.log"

# Retrieve remote system info in one command
ssh user@server bash <<'EOF'
echo "=== $(hostname) ==="
echo ""
echo "--- Uptime ---"
uptime
echo ""
echo "--- CPU ---"
top -bn1 | head -5
echo ""
echo "--- Memory ---"
free -h
echo ""
echo "--- Disk ---"
df -h | grep -v tmpfs
echo ""
echo "--- Network ---"
ss -tlnp
EOF

# Batch health check for multiple servers
#!/bin/bash
SERVERS=("web1" "web2" "web3" "db1" "db2")

for server in "${SERVERS[@]}"; do
    echo -n "$server: "
    if ssh -o ConnectTimeout=5 -o BatchMode=yes "$server" "uptime" 2>/dev/null; then
        :  # OK
    else
        echo "UNREACHABLE"
    fi
done
```

### 7.3 File Diff Comparison

```bash
# Compare file differences between remote and local
diff <(ssh user@server "cat /etc/nginx/nginx.conf") ./nginx.conf

# Colored diff
diff --color <(ssh user@server "cat /etc/nginx/nginx.conf") ./nginx.conf

# Compare with vimdiff
vimdiff <(ssh user@server "cat /etc/nginx/nginx.conf") ./nginx.conf

# Config diff between multiple servers
diff <(ssh web1 "cat /etc/nginx/nginx.conf") <(ssh web2 "cat /etc/nginx/nginx.conf")

# Diff of entire directory (rsync dry run)
rsync -avzn user@server:/etc/nginx/ ./nginx-local/ 2>&1 | head -50
```

### 7.4 Debugging SSH Connections

```bash
# Step-by-step debugging
ssh -v user@server    # Basic connection info
ssh -vv user@server   # Key trial order, etc.
ssh -vvv user@server  # Full detail (packet level)

# Debug output examples for common issues:

# Issue 1: Key not found
# debug1: Trying private key: /home/user/.ssh/id_rsa
# debug1: Trying private key: /home/user/.ssh/id_ecdsa
# debug1: Trying private key: /home/user/.ssh/id_ed25519
# debug1: No more authentication methods to try.
# → Fix: specify the correct key with -i or configure it in ~/.ssh/config

# Issue 2: Permission error
# @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
# @         WARNING: UNPROTECTED PRIVATE KEY FILE!          @
# @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
# → Fix: chmod 600 ~/.ssh/id_ed25519

# Issue 3: Host key changed
# @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
# @    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
# @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
# → Fix: ssh-keygen -R hostname (after confirming the change is legitimate)

# Issue 4: Connection refused
# ssh: connect to host server.com port 22: Connection refused
# → Check: whether sshd is running on the server
#   sudo systemctl status sshd
#   sudo ss -tlnp | grep 22

# Issue 5: Connection timed out
# ssh: connect to host server.com port 22: Connection timed out
# → Check: firewall, security groups, network routing

# Connection test (with timeout)
ssh -o ConnectTimeout=5 -o BatchMode=yes user@server "echo OK" 2>/dev/null
echo "Result: $?"
```

### 7.5 Regular Backups

```bash
#!/bin/bash
# remote_backup.sh - Regular backup script using rsync

# Settings
REMOTE_USER="deploy"
REMOTE_HOST="server.example.com"
REMOTE_DIR="/var/www/app/"
LOCAL_BACKUP_DIR="/backup/app"
RETENTION_DAYS=30
LOG_FILE="/var/log/backup.log"
SSH_KEY="/home/deploy/.ssh/backup_key"

# Date
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${LOCAL_BACKUP_DIR}/${DATE}"
LATEST_LINK="${LOCAL_BACKUP_DIR}/latest"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Start backup
log "Starting backup: ${REMOTE_HOST}:${REMOTE_DIR}"

# Create directory
mkdir -p "$BACKUP_DIR"

# Run rsync (incremental backup using hard links)
rsync -avz --delete \
    --link-dest="$LATEST_LINK" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='tmp/' \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}" \
    "$BACKUP_DIR/"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    # Update the latest symlink
    rm -f "$LATEST_LINK"
    ln -s "$BACKUP_DIR" "$LATEST_LINK"
    log "Backup successful: $BACKUP_DIR"

    # Backup size
    SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "Backup size: $SIZE"
else
    log "Backup failed: exit code $EXIT_CODE"
    rm -rf "$BACKUP_DIR"  # Remove failed backup
fi

# Delete old backups
log "Removing backups older than ${RETENTION_DAYS} days"
find "$LOCAL_BACKUP_DIR" -maxdepth 1 -type d -name "20*" \
    -mtime +${RETENTION_DAYS} -exec rm -rf {} \;

# List current backups
log "Current backup list:"
ls -la "$LOCAL_BACKUP_DIR" | tee -a "$LOG_FILE"

log "Backup process complete"
exit $EXIT_CODE
```

### 7.6 Automating New Server Initial Setup

```bash
#!/bin/bash
# server_setup.sh - Initial setup script for a new server

set -euo pipefail

SERVER="${1:?Usage: $0 user@server}"

echo "=== Server initial setup: $SERVER ==="

# 1. Register SSH key
echo "--- Registering SSH key ---"
ssh-copy-id -i ~/.ssh/id_ed25519.pub "$SERVER"

# 2. Install basic packages
echo "--- Installing basic packages ---"
ssh -t "$SERVER" bash <<'SETUP'
set -e

# Update packages
sudo apt update && sudo apt upgrade -y

# Basic tools
sudo apt install -y \
    vim htop tmux git curl wget \
    jq tree unzip \
    fail2ban ufw

# fail2ban configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw --force enable

# SSH security hardening
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

echo "=== Initial setup complete ==="
SETUP

echo "=== Server initial setup is complete ==="
echo "Connection test: ssh $SERVER"
```

### 7.7 Distributing and Executing Remote Scripts via SSH

```bash
# ===== Method 1: Execute directly via pipe =====
ssh user@server bash < local_script.sh

# With arguments
ssh user@server "bash -s arg1 arg2" < local_script.sh

# ===== Method 2: Here document =====
ssh user@server bash <<'EOF'
#!/bin/bash
echo "Running on: $(hostname)"
echo "Date: $(date)"
echo "Uptime: $(uptime)"
EOF

# ===== Method 3: scp + ssh =====
scp script.sh user@server:/tmp/
ssh user@server "chmod +x /tmp/script.sh && /tmp/script.sh && rm /tmp/script.sh"

# ===== Method 4: tar pipe (transfer multiple files + execute) =====
tar czf - scripts/ | ssh user@server "cd /tmp && tar xzf - && bash scripts/setup.sh"

# ===== Batch execution to multiple servers =====
deploy_to_all() {
    local script=$1
    shift
    local servers=("$@")

    for server in "${servers[@]}"; do
        echo "=== Deploying to $server ==="
        ssh "$server" bash < "$script" &
    done
    wait
    echo "=== All deployments complete ==="
}

deploy_to_all setup.sh web1 web2 web3
```

---

## 8. Advanced SSH Usage

### 8.1 SSH over WebSocket / HTTP

```bash
# Workarounds when the SSH port is blocked by a firewall

# Method 1: SSH connection via HTTPS port
# Server side: also listen on sshd port 443
# Port 22
# Port 443

# Method 2: sslh (port multiplexer)
# Route SSH and HTTPS on the same port
# sudo apt install sslh

# Method 3: ProxyCommand with corkscrew (via HTTP proxy)
# brew install corkscrew
Host behind-proxy
    HostName server.example.com
    User admin
    ProxyCommand corkscrew proxy.company.com 8080 %h %p

# Method 4: Expose SSH tunnel with ngrok
# ngrok tcp 22
# → A URL like tcp://0.tcp.ngrok.io:12345 is generated
# ssh -p 12345 user@0.tcp.ngrok.io
```

### 8.2 SSH Certificate Authentication

```bash
# SSH certificates: centralized authentication without authorized_keys

# 1. Generate a CA key
ssh-keygen -t ed25519 -f ~/.ssh/ca_key -C "SSH CA Key"

# 2. Sign a user key (issue a certificate)
ssh-keygen -s ~/.ssh/ca_key \
    -I "gaku@example.com" \
    -n gaku,admin \
    -V +52w \
    ~/.ssh/id_ed25519.pub
# -s: CA private key
# -I: certificate identity
# -n: allowed principals (usernames)
# -V: validity period (+52w = 52 weeks)
# Result: ~/.ssh/id_ed25519-cert.pub is generated

# 3. Inspect the certificate
ssh-keygen -L -f ~/.ssh/id_ed25519-cert.pub

# 4. Server-side configuration (/etc/ssh/sshd_config)
# TrustedUserCAKeys /etc/ssh/ca_key.pub
# → Trust all keys signed by the CA

# Benefits:
# - No need to manage authorized_keys
# - Automatically expires with a time limit
# - Revocation via revoked_keys is possible
# - Easy key management in large-scale environments
```

### 8.3 Mosh (Mobile Shell)

```bash
# Mosh: SSH alternative (for mobile/unstable connections)
# brew install mosh / apt install mosh

# Connect
mosh user@server
mosh --ssh="ssh -p 2222" user@server

# Mosh features:
# - UDP-based (auto-reconnects after network interruption)
# - Roaming support (continues even if IP address changes)
# - Immediate local echo (low input latency)
# - Authenticates via SSH, then switches to UDP

# Limitations:
# - No port forwarding support
# - No X11 forwarding support
# - Limited scrollback history
# - Requires ports 60000-61000 UDP to be open
```

### 8.4 Integration with tmux / screen

```bash
# Using tmux to keep processes alive after SSH disconnection

# Create a new named session
ssh user@server -t "tmux new-session -s work"

# Reconnect to an existing session
ssh user@server -t "tmux attach-session -t work || tmux new-session -s work"

# Detach: Ctrl-b d (disconnect while keeping the session alive)
# Processes inside the tmux session continue even if SSH disconnects

# Set an alias in ~/.bashrc
# alias sshwork='ssh user@server -t "tmux attach-session -t work || tmux new-session -s work"'

# With screen
ssh user@server -t "screen -dR work"
```

---

## 9. Troubleshooting

### 9.1 Connection Issue Flowchart

```text
SSH connection failed
│
├─ "Connection refused"
│  ├─ sshd is not running → sudo systemctl start sshd
│  ├─ Wrong port → ssh -p PORT user@server
│  └─ Firewall → sudo ufw allow 22
│
├─ "Connection timed out"
│  ├─ Network unreachable → ping server
│  ├─ Firewall → check security groups
│  └─ Routing → traceroute server
│
├─ "Permission denied"
│  ├─ Key not registered → ssh-copy-id user@server
│  ├─ Incorrect permissions → chmod 600 ~/.ssh/id_ed25519
│  ├─ User does not exist → check on the server side
│  └─ Denied by sshd config → check AllowUsers/DenyUsers
│
├─ "Host key verification failed"
│  ├─ Host key changed → ssh-keygen -R hostname
│  └─ Possible MITM attack → confirm host key with administrator
│
├─ "Too many authentication failures"
│  ├─ Too many keys → ssh -o IdentitiesOnly=yes -i KEY user@server
│  └─ MaxAuthTries reached → contact administrator
│
└─ Disconnects immediately after connecting
   ├─ Shell not configured → check /etc/passwd
   ├─ /etc/nologin exists → remove the file
   └─ Disk full → df -h
```

### 9.2 Common Errors and Solutions

```bash
# ===== Error 1: WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! =====
# Cause: Server host key changed (reinstall, IP address change, etc.)
# Fix:
ssh-keygen -R server.example.com
ssh-keygen -R 192.168.1.100
# Note: Execute only after confirming there is no MITM attack!

# ===== Error 2: Permission denied (publickey) =====
# Cause: Public key authentication failed
# Diagnosis steps:
ssh -vvv user@server 2>&1 | grep -A5 "Trying\|Offering\|Authentication"
# Fix:
# 1. Confirm the key is correctly registered
ssh user@server "cat ~/.ssh/authorized_keys"
# 2. Check permissions
ssh user@server "ls -la ~/.ssh/ && ls -la ~/.ssh/authorized_keys"
# 3. Check local key permissions
ls -la ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519

# ===== Error 3: ssh_exchange_identification: Connection closed =====
# Cause: sshd rejected the connection
# Check:
# 1. /etc/hosts.allow, /etc/hosts.deny
# 2. MaxStartups setting (concurrent connection limit)
# 3. Blocked by fail2ban
sudo fail2ban-client status sshd
sudo fail2ban-client set sshd unbanip 192.168.1.100

# ===== Error 4: broken pipe / Write failed =====
# Cause: Connection was lost
# Fix (in ~/.ssh/config):
# Host *
#     ServerAliveInterval 60
#     ServerAliveCountMax 3
#     TCPKeepAlive yes

# ===== Error 5: Cannot connect from remote with Agent forwarding =====
# Check:
echo "$SSH_AUTH_SOCK"   # If empty, agent is not running
ssh-add -l              # Check if keys are loaded
# Fix:
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
ssh -A user@bastion     # Don't forget -A
```

### 9.3 Performance Tuning

```bash
# ===== Speeding up connections =====

# 1. Multiplex connections with ControlMaster
Host *
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 600

# 2. Specifying cipher algorithms (prioritize faster ones)
Host fast-server
    Ciphers aes128-gcm@openssh.com,aes256-gcm@openssh.com,chacha20-poly1305@openssh.com

# 3. Enabling/disabling compression
Host slow-network
    Compression yes       # Enable for slow connections

Host fast-network
    Compression no        # Disable for fast connections (save CPU)

# 4. Restricting AddressFamily (speed up with IPv4 only)
Host *
    AddressFamily inet    # Skip IPv6 resolution wait time

# ===== Speeding up rsync =====

# Adjust compression level
rsync -avz --compress-level=1 ./data/ user@server:/data/
# Level 1: fast (effective when CPU is the bottleneck)

# Lighter encryption (only on trusted networks)
rsync -avz -e "ssh -c aes128-gcm@openssh.com" ./data/ user@server:/data/

# Parallel rsync (for many small files)
find ./data -maxdepth 1 -type d | xargs -P 4 -I {} \
    rsync -avz {}/ user@server:/data/{}/
```

---

## 10. SSH Command Reference

### 10.1 Command Reference

```text
┌────────────────────┬─────────────────────────────────────────────────────┐
│ Command            │ Purpose                                             │
├────────────────────┼─────────────────────────────────────────────────────┤
│ ssh                │ Connect to a remote server                          │
│ ssh-keygen         │ Generate and manage SSH keys                        │
│ ssh-copy-id        │ Register public key on remote                       │
│ ssh-add            │ Add key to ssh-agent                                │
│ ssh-agent          │ Start and manage key agent                          │
│ ssh-keyscan        │ Retrieve public key from remote host                │
│ scp                │ File copy over SSH                                  │
│ sftp               │ Interactive file transfer                           │
│ rsync              │ Delta file synchronization                          │
│ sshd               │ SSH server daemon                                   │
│ sshd -t            │ Test sshd config file                               │
│ autossh            │ SSH connection with auto-reconnect                  │
│ mosh               │ SSH alternative for mobile                          │
│ ssh-audit          │ Security audit of SSH server                        │
└────────────────────┴─────────────────────────────────────────────────────┘
```

### 10.2 Key Options Reference

```text
===== ssh options =====
-p PORT        Specify port
-i KEY         Specify private key file
-l USER        Specify username (instead of user@host)
-v/-vv/-vvv    Debug output level
-C             Enable compression
-X/-Y          X11 forwarding
-A             Agent forwarding
-N             Do not execute a command (for tunneling)
-f             Run in background
-t             Force pseudo-terminal allocation
-L             Local port forwarding
-R             Remote port forwarding
-D             Dynamic forwarding (SOCKS proxy)
-J             ProxyJump (jump host)
-o OPTION      Specify config option
-W host:port   Forward stdio to remote

===== ssh-keygen options =====
-t TYPE        Key type (ed25519, rsa, ecdsa)
-b BITS        Number of bits (RSA: 4096 recommended)
-f FILE        Output filename
-C COMMENT     Comment
-N PASS        Passphrase
-p             Change passphrase
-l             Show fingerprint
-R HOST        Remove host from known_hosts
-y             Output public key from private key
-s CA_KEY      Sign certificate
-L             Show certificate info

===== rsync options =====
-a             Archive mode (-rlptgoD)
-v             Verbose output
-z             Compressed transfer
-n             Dry run
-P             --partial --progress
--delete       Delete files not in source
--exclude      Exclusion pattern
--include      Inclusion pattern
--exclude-from Read exclusion patterns from file
--link-dest    Hard-link-based incremental backup
--bwlimit      Bandwidth limit
--stats        Show statistics
-e "ssh ..."   Specify SSH options
```

---

## Summary

| Command | Purpose |
|---------|---------|
| ssh user@host | Remote connection |
| ssh -v user@host | Debug connection |
| ssh-keygen -t ed25519 | Generate key pair |
| ssh-copy-id user@host | Register public key |
| ssh-add key | Add key to agent |
| ~/.ssh/config | Manage connection settings |
| rsync -avz src dst | Delta file transfer |
| rsync -avzn src dst | Dry run |
| rsync --delete | Full sync |
| scp file user@host:/path | File copy |
| sftp user@host | Interactive file transfer |
| ssh -L local:host:remote | Local port forwarding |
| ssh -R remote:host:local | Remote port forwarding |
| ssh -D 1080 user@host | SOCKS proxy |
| ssh -J bastion target | Connect via jump host |
| autossh -M 0 -fNL ... | Auto-reconnect tunnel |

---

## Frequently Asked Questions (FAQ)

### Q1: Which should I use, Ed25519 or RSA?

Ed25519 is recommended for the following reasons:
- Shorter key (RSA 4096bit: ~750 characters vs Ed25519: ~68 characters)
- Faster signing and verification
- Higher security strength (equivalent to 128-bit vs RSA 4096's ~128-bit)
- Safer implementation (resistant to side-channel attacks)

However, Ed25519 is not available on older systems (OpenSSH < 6.5), so use RSA 4096bit in those cases.

### Q2: What is the difference between ssh-agent and Keychain?

ssh-agent is a temporary mechanism that holds passphrases in memory. It is cleared on logout. macOS Keychain is a system-level password manager that persists across reboots. By setting `UseKeychain yes` and `AddKeysToAgent yes` in ~/.ssh/config, you can integrate both.

### Q3: What should I do if my SSH connection frequently drops?

```bash
# Add the following to ~/.ssh/config
Host *
    ServerAliveInterval 60   # Send keepalive every 60 seconds
    ServerAliveCountMax 3    # Disconnect after 3 failures
    TCPKeepAlive yes         # TCP-level keepalive
```

If it remains unstable, consider using autossh or mosh.

### Q4: How do I rsync through a jump host?

```bash
# Use the ProxyJump option
rsync -avz -e "ssh -J bastion.example.com" ./data/ user@10.0.1.100:/data/

# Or configure in ~/.ssh/config
# Host internal
#     HostName 10.0.1.100
#     User admin
#     ProxyJump bastion
# Then:
rsync -avz ./data/ internal:/data/
```

### Q5: Is it safe to disable password authentication?

It is fine as long as key authentication is set up correctly. However, confirm the following in advance:

1. Connection has been tested with at least one key pair
2. Restart sshd while keeping a connection open in another terminal
3. Console access (VPS management console, etc.) is available

### Q6: When should I use scp vs rsync?

| Item | scp | rsync |
|------|-----|-------|
| Delta transfer | Not supported | Supported |
| Resume interrupted transfer | Not supported | Supported (--partial) |
| Exclusion patterns | Not supported | Supported |
| Bandwidth limit | Limited | Supported |
| Symlink handling | Limited | Full support |
| Delete sync | Not supported | Supported (--delete) |
| Recommendation | Simple copies | Recommended in general |

---

## What to Read Next

---

## References
1. Barrett, D. "SSH, The Secure Shell: The Definitive Guide." 2nd Ed, O'Reilly, 2005.
2. "OpenSSH Manual Pages." openssh.com.
3. Stahnke, M. "Pro OpenSSH." Apress, 2005.
4. "SSH Hardening Guides." mozilla.github.io/openssh.
5. "rsync man page." linux.die.net/man/1/rsync.
