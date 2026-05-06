# Git Configuration

> A complete guide to building a professional Git environment — from initial setup to GPG signing, SSH keys, and diff/merge tool integration.

## What You Will Learn

1. Systematic `.gitconfig` configuration and practical alias building
2. Correct setup of GPG signing and SSH keys
3. diff/merge tool integration and credential helper management
4. Managing multiple accounts and leveraging Git hooks
5. Troubleshooting and performance optimization


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Terminal Setup](./01-terminal-setup.md)

---

## 1. Initial Git Setup

### 1.1 Basic Configuration

```bash
# User information
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Default branch name
git config --global init.defaultBranch main

# Editor setting
git config --global core.editor "code --wait"

# Line ending handling
# macOS/Linux
git config --global core.autocrlf input
# Windows
git config --global core.autocrlf true

# Display filenames with non-ASCII characters
git config --global core.quotepath false

# Color output
git config --global color.ui auto

# Pager setting (delta recommended)
git config --global core.pager "delta"

# Case sensitivity
git config --global core.ignorecase false

# Track symbolic links
git config --global core.symlinks true
```

### 1.2 Configuration File Hierarchy

```
Git configuration priority (highest to lowest):

┌─────────────────────────────────────────────┐
│  1. Local    (.git/config)                   │
│     → Repository-specific settings           │
│     → git config --local                     │
│     → e.g., project-specific user.email      │
├─────────────────────────────────────────────┤
│  2. Global   (~/.gitconfig)                  │
│     → User-wide settings                     │
│     → git config --global                    │
│     → e.g., personal aliases, editor config  │
├─────────────────────────────────────────────┤
│  3. System   (/etc/gitconfig)                │
│     → System-wide settings                   │
│     → git config --system                    │
│     → e.g., organization proxy settings      │
├─────────────────────────────────────────────┤
│  4. Portable (/path/to/.gitconfig)           │
│     → Specified via GIT_CONFIG_GLOBAL env var│
│     → Shared config from dotfiles repository │
└─────────────────────────────────────────────┘

* When the same key is set at multiple levels,
  the higher level (Local) takes precedence
```

### 1.3 Viewing and Managing Configuration

```bash
# List all settings (with source)
git config --list --show-origin

# Check the value of a specific key
git config user.email

# Check the source of a setting
git config --show-origin user.email

# Check the scope of settings
git config --show-scope --list

# Remove a setting
git config --global --unset user.signingkey

# Edit the config file directly
git config --global --edit

# Check conditional configurations
git config --list --show-origin | grep includeIf
```

---

## 2. Complete .gitconfig

### 2.1 Recommended Configuration

```ini
# ~/.gitconfig

[user]
    name = Your Name
    email = your.email@example.com
    signingkey = YOUR_GPG_KEY_ID

[core]
    editor = code --wait
    autocrlf = input
    quotepath = false
    pager = delta
    ignorecase = false
    whitespace = trailing-space,space-before-tab
    precomposeunicode = true
    fsmonitor = true
    untrackedcache = true
    symlinks = true
    # Performance improvement for large repositories
    # fsmonitor = true  # Git 2.37+ (Watchman or built-in)

[init]
    defaultBranch = main

[color]
    ui = auto

[color "branch"]
    current = yellow reverse
    local = yellow
    remote = green

[color "status"]
    added = green
    changed = yellow
    untracked = red

[push]
    default = current
    autoSetupRemote = true
    followTags = true
    # Git 2.40+: auto-setup new branches on push
    # useForceIfIncludes = true  # Enhanced version of force-with-lease

[pull]
    rebase = true

[fetch]
    prune = true
    prunetags = true
    # Parallel fetch (Git 2.36+)
    parallel = 0  # Auto-set to number of CPU cores
    writeCommitGraph = true

[merge]
    conflictstyle = zdiff3
    tool = vscode
    # Include log of target branch in merge commits
    log = 20

[mergetool]
    keepBackup = false
    prompt = false

[mergetool "vscode"]
    cmd = code --wait --merge $REMOTE $LOCAL $BASE $MERGED

[diff]
    tool = vscode
    colorMoved = default
    algorithm = histogram
    # Show diff for binary files
    # wordRegex = .  # Word-level diff
    renames = copies
    mnemonicPrefix = true
    submodule = log

[difftool "vscode"]
    cmd = code --wait --diff $LOCAL $REMOTE

[difftool]
    prompt = false

[rebase]
    autosquash = true
    autostash = true
    # Improve conflict detection during rebase
    updateRefs = true
    # instructionFormat = "%s [%an, %ar]"

[rerere]
    enabled = true
    # Auto-staging for rerere
    autoupdate = true

[commit]
    gpgsign = true
    verbose = true
    # Commit message template
    # template = ~/.gitmessage

[tag]
    gpgsign = true
    sort = version:refname

[interactive]
    diffFilter = delta --color-only

[delta]
    navigate = true
    light = false
    side-by-side = true
    line-numbers = true
    syntax-theme = Dracula
    file-style = bold yellow ul
    file-decoration-style = none
    hunk-header-decoration-style = cyan box ul
    minus-style = syntax "#3f0001"
    plus-style = syntax "#003800"
    line-numbers-minus-style = "#ff0000"
    line-numbers-plus-style = "#00ff00"
    map-styles = "bold purple => syntax #330033, bold cyan => syntax #003333"

[branch]
    sort = -committerdate
    # Automatically track remote when creating a new branch
    autoSetupMerge = always

[column]
    ui = auto

[help]
    autocorrect = prompt
    # autocorrect = 10  # Auto-correct after 1 second

[log]
    date = iso
    # abbrevCommit = true
    # follow = true  # Auto-track file renames

[status]
    showUntrackedFiles = all
    submoduleSummary = true
    # short = true  # Use short format by default

[stash]
    showPatch = true

[transfer]
    # Integrity check for Git objects
    fsckObjects = true

[receive]
    fsckObjects = true

[url "git@github.com:"]
    insteadOf = https://github.com/

# GitHub CLI integration
[credential "https://github.com"]
    helper = !/usr/bin/gh auth git-credential

# Git LFS
[filter "lfs"]
    clean = git-lfs clean -- %f
    smudge = git-lfs smudge -- %f
    process = git-lfs filter-process
    required = true
```

### 2.2 Commit Message Template

```bash
# Create the template file
cat << 'EOF' > ~/.gitmessage

# <type>(<scope>): <subject>
#
# <body>
#
# <footer>
#
# ─── Type ───────────────────────────
# feat:     New feature
# fix:      Bug fix
# docs:     Documentation changes
# style:    Code style changes (no functional impact)
# refactor: Refactoring
# perf:     Performance improvements
# test:     Add or update tests
# build:    Build system changes
# ci:       CI configuration changes
# chore:    Other changes
# revert:   Revert a commit
#
# ─── Rules ──────────────────────────
# Subject: max 50 chars, imperative mood, no period
# Body: wrap at 72 chars, explain what and why
# Footer: Breaking Changes, issue references
#
# ─── Example ────────────────────────
# feat(auth): add JWT token refresh mechanism
#
# Implement automatic token refresh when the access
# token expires. The refresh token is stored securely
# in an HTTP-only cookie.
#
# Closes #123
# BREAKING CHANGE: API now requires Authorization header
EOF

# Enable the template
git config --global commit.template ~/.gitmessage
```

---

## 3. Aliases

### 3.1 Practical Alias Collection

```ini
# [alias] section in ~/.gitconfig

[alias]
    # ─── Shorthand for basic operations ───
    s = status
    a = add
    aa = add --all
    ap = add --patch
    c = commit
    cm = commit -m
    ca = commit --amend
    can = commit --amend --no-edit
    co = checkout
    sw = switch
    sc = switch -c
    br = branch
    d = diff
    ds = diff --staged
    dw = diff --word-diff
    p = push
    pf = push --force-with-lease
    pl = pull
    f = fetch --all --prune
    m = merge
    rb = rebase
    rbi = rebase -i
    cp = cherry-pick
    st = stash
    stp = stash pop
    stl = stash list

    # ─── Log display ───
    lg = log --oneline --graph --decorate --all -20
    ll = log --pretty=format:'%C(yellow)%h%C(reset) %C(green)(%cr)%C(reset) %s %C(bold blue)<%an>%C(reset)%C(red)%d%C(reset)' --abbrev-commit -20
    hist = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --all
    lp = log --patch -5
    ls = log --stat --oneline -10

    # ─── File change tracking ───
    filelog = log --follow -p --
    blame-line = "!f() { git log -L $1,$1:$2; }; f"
    contributors = shortlog --summary --numbered --email

    # ─── Useful commands ───
    # Amend the last commit (keep message)
    amend = commit --amend --no-edit

    # Unstage changes
    unstage = restore --staged

    # Undo the last commit (keep changes)
    undo = reset --soft HEAD~1

    # Temporarily stash changes
    stash-all = stash push --include-untracked -m

    # Update branch to latest
    sync = !git fetch --all --prune && git pull --rebase

    # Delete merged branches
    cleanup = !git branch --merged | grep -v '\\*\\|main\\|master\\|develop' | xargs -n 1 git branch -d

    # Delete merged remote branches too
    cleanup-remote = !git fetch --prune && git branch -r --merged origin/main | grep -v 'main\\|develop' | sed 's/origin\\///' | xargs -n 1 git push origin --delete

    # File change history
    history = log --follow -p --

    # Today's commits
    today = log --since='midnight' --oneline --author='Your Name'

    # This week's commits
    week = log --since='1 week ago' --oneline --author='Your Name'

    # WIP commit
    wip = !git add -A && git commit -m 'WIP: work in progress [skip ci]'

    # Undo WIP
    unwip = !git log -1 --format='%s' | grep -q 'WIP' && git reset HEAD~1

    # Initial commit (empty)
    init-commit = !git init && git commit --allow-empty -m 'chore: initial commit'

    # Copy branch name
    branch-name = rev-parse --abbrev-ref HEAD

    # List recent branches
    recent = branch --sort=-committerdate --format='%(committerdate:relative)\t%(refname:short)\t%(subject)' -20

    # Diff statistics
    stat = diff --stat

    # List changed files between commits
    changed = diff --name-only

    # List conflicted files
    conflicts = diff --name-only --diff-filter=U

    # Show Git root directory
    root = rev-parse --show-toplevel

    # Fixup commit (for autosquash)
    fixup = "!f() { git commit --fixup=$1; }; f"

    # List tags (by version)
    tags = tag -l --sort=-version:refname

    # Show remote URL
    remote-url = remote get-url origin

    # Compare branches (how many commits apart)
    ahead = "!f() { git rev-list --count HEAD..${1:-origin/main}; }; f"
    behind = "!f() { git rev-list --count ${1:-origin/main}..HEAD; }; f"

    # Interactive add (patch mode)
    patch = add --patch

    # Discard all changes (use with caution)
    nuke = !git reset --hard HEAD && git clean -fd

    # Update local main to latest
    update-main = !git checkout main && git pull && git checkout -

    # PR: show all commits on current branch
    pr-log = "!git log --oneline $(git merge-base HEAD main)..HEAD"

    # PR: show all changed files on current branch
    pr-files = "!git diff --name-only $(git merge-base HEAD main)..HEAD"

    # PR: show diff statistics for current branch
    pr-stat = "!git diff --stat $(git merge-base HEAD main)..HEAD"
```

### 3.2 Alias Output Examples

```
Example output of git lg:

  * a1b2c3d (HEAD -> feature/auth, origin/feature/auth) Add JWT middleware
  * d4e5f6g Add login endpoint
  * g7h8i9j Add user model
  | * j0k1l2m (origin/feature/ui) Update dashboard layout
  | * m3n4o5p Add sidebar component
  |/
  * p6q7r8s (origin/main, main) Release v1.2.0
  * s9t0u1v Fix database connection pool
  * v2w3x4y Add health check endpoint

Example output of git recent:

  2 hours ago     feature/auth      Add JWT middleware
  5 hours ago     feature/ui        Update dashboard layout
  1 day ago       fix/db-pool       Fix connection pool leak
  3 days ago      main              Release v1.2.0
  1 week ago      feature/search    Add full-text search

Example output of git pr-stat:

  src/middleware/auth.ts   | 45 ++++++++++++
  src/routes/login.ts      | 32 +++++++++
  src/models/user.ts       | 28 +++++++++
  tests/auth.test.ts       | 67 ++++++++++++++++
  4 files changed, 172 insertions(+)
```

---

## 4. SSH Key Setup

### 4.1 Generating an Ed25519 Key

```bash
# Generate an SSH key (Ed25519 recommended)
ssh-keygen -t ed25519 -C "your.email@example.com"

# Key storage location (default: ~/.ssh/id_ed25519)
# Set a passphrase (do not leave it empty)

# Register the key with SSH agent
eval "$(ssh-agent -s)"

# macOS: save to Keychain
ssh-add --apple-use-keychain ~/.ssh/id_ed25519

# Linux
ssh-add ~/.ssh/id_ed25519

# Copy public key and register it on GitHub
cat ~/.ssh/id_ed25519.pub | pbcopy  # macOS
cat ~/.ssh/id_ed25519.pub | xclip -selection clipboard  # Linux
# GitHub → Settings → SSH and GPG keys → New SSH key

# ─── Key type comparison ───
# Ed25519:  Recommended. Fast, secure, small key size
# RSA 4096: Legacy compatibility. Required for connecting to older systems
# ECDSA:    Not recommended. Suspected NSA involvement
```

### 4.2 SSH Config

```bash
# ~/.ssh/config

# ─── GitHub (personal) ───
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    AddKeysToAgent yes
    UseKeychain yes  # macOS only
    IdentitiesOnly yes

# ─── GitHub (work account) ───
Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    AddKeysToAgent yes
    IdentitiesOnly yes

# ─── GitLab ───
Host gitlab.com
    HostName gitlab.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    PreferredAuthentications publickey

# ─── Bitbucket ───
Host bitbucket.org
    HostName bitbucket.org
    User git
    IdentityFile ~/.ssh/id_ed25519

# ─── Company Git server ───
Host git.company.com
    HostName git.company.com
    User git
    Port 2222
    IdentityFile ~/.ssh/id_ed25519_work
    ProxyCommand ssh -q -W %h:%p bastion.company.com

# ─── Via bastion host ───
Host bastion.company.com
    HostName bastion.company.com
    User your-username
    IdentityFile ~/.ssh/id_ed25519_work

# ─── Common settings for all hosts ───
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
    AddKeysToAgent yes
    Compression yes

# Usage:
# git clone git@github.com:personal/repo.git       # Personal
# git clone git@github-work:company/repo.git       # Work
# git clone git@gitlab.com:team/repo.git            # GitLab
```

### 4.3 SSH Key Security Best Practices

```bash
# ─── Check key permissions ───
ls -la ~/.ssh/
# Correct permissions:
# drwx------  ~/.ssh/          (700)
# -rw-------  id_ed25519       (600)
# -rw-r--r--  id_ed25519.pub   (644)
# -rw-------  config           (600)

# Fix permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/config

# ─── Verify key fingerprint ───
ssh-keygen -lf ~/.ssh/id_ed25519.pub
# 256 SHA256:xxxxx your.email@example.com (ED25519)

# ─── Managing multiple keys ───
# Check keys registered with ssh-add
ssh-add -l

# Remove a specific key
ssh-add -d ~/.ssh/id_ed25519_old

# Remove all keys
ssh-add -D

# ─── Key rotation ───
# 1. Generate a new key
ssh-keygen -t ed25519 -C "your.email@example.com" -f ~/.ssh/id_ed25519_new
# 2. Add the new public key to GitHub
# 3. Update SSH config
# 4. Test
ssh -T git@github.com
# 5. Remove the old public key from GitHub
# 6. Delete the old key files
```

### 4.4 Connection Testing

```bash
# GitHub
ssh -T git@github.com
# Hi username! You've successfully authenticated, but GitHub
# does not provide shell access.

# GitLab
ssh -T git@gitlab.com
# Welcome to GitLab, @username!

# Verbose debug
ssh -vT git@github.com
# Inspect the authentication process in debug output

# Test work account
ssh -T git@github-work
```

---

## 5. GPG Signing

### 5.1 Generating and Configuring a GPG Key

```bash
# Generate a GPG key
gpg --full-generate-key
# Type: RSA and RSA (default)
# Key length: 4096
# Expiry: 2y (recommended)
# Name and email: enter the same as your Git config

# Check the key ID
gpg --list-secret-keys --keyid-format=long
# sec   rsa4096/3AA5C34371567BD2 2024-01-01 [SC] [expires: 2026-01-01]
#       ABCDEF1234567890ABCDEF1234567890ABCDEF12
# uid                 [ultimate] Your Name <your.email@example.com>
# ssb   rsa4096/42B317FD4BA89E7A 2024-01-01 [E] [expires: 2026-01-01]

# Key ID: 3AA5C34371567BD2

# Configure Git
git config --global user.signingkey 3AA5C34371567BD2
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Export public key and register it on GitHub
gpg --armor --export 3AA5C34371567BD2 | pbcopy
# GitHub → Settings → SSH and GPG keys → New GPG key

# macOS: use pinentry-mac for GUI passphrase entry
brew install pinentry-mac
echo "pinentry-program $(which pinentry-mac)" >> ~/.gnupg/gpg-agent.conf
gpgconf --kill gpg-agent

# ─── GPG Agent configuration ───
# ~/.gnupg/gpg-agent.conf
cat << 'EOF' > ~/.gnupg/gpg-agent.conf
# Cache duration (seconds)
default-cache-ttl 28800      # 8 hours
max-cache-ttl 86400           # 24 hours
# macOS
pinentry-program /opt/homebrew/bin/pinentry-mac
# Linux (GUI)
# pinentry-program /usr/bin/pinentry-gnome3
# Linux (CUI)
# pinentry-program /usr/bin/pinentry-tty
EOF

# Restart GPG agent
gpgconf --kill gpg-agent
gpg-agent --daemon
```

### 5.2 SSH Key Signing (Alternative to GPG)

```bash
# Git 2.34+ supports signing with SSH keys
# An alternative when GPG setup is too cumbersome

# Configure SSH key signing
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true

# Public key list used for signature verification
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers

# ~/.ssh/allowed_signers
# Mapping of email addresses to public keys
cat << 'EOF' > ~/.ssh/allowed_signers
your.email@example.com ssh-ed25519 AAAA... your.email@example.com
colleague@example.com ssh-ed25519 BBBB... colleague@example.com
EOF

# Verify signatures
git log --show-signature -1
git verify-commit HEAD
git verify-tag v1.0.0

# GPG vs SSH signing comparison:
# GPG: Industry standard, GitHub "Verified" badge support, complex setup
# SSH: Easy setup, requires Git 2.34+, supported by GitHub
```

### 5.3 Signature Verification Flow

```
Flow for GPG-signed commits:

  Developer environment             GitHub
  ┌──────────────────┐          ┌──────────────────┐
  │ git commit       │          │                  │
  │      │           │          │  Public key      │
  │      ▼           │          │  already         │
  │ Sign with        │   push   │  registered      │
  │ GPG/SSH private  │ ───────→ │      │           │
  │ key              │          │      ▼           │
  │      │           │          │  Verify          │
  │      ▼           │          │  signature with  │
  │ Signed           │          │  public key      │
  │ commit           │          │      │           │
  │ complete         │          │      ▼           │
  │                  │          │  ✅ Verified     │
  └──────────────────┘          └──────────────────┘

  When Vigilant Mode is enabled:
  ┌──────────────────┐
  │ Unsigned commit   │ → ⚠️ Unverified
  │ Signed (valid)    │ → ✅ Verified
  │ Signed (invalid)  │ → ❌ Invalid
  └──────────────────┘
```

---

## 6. Credential Helper

### 6.1 Platform-Specific Configuration

```bash
# macOS (Keychain)
git config --global credential.helper osxkeychain

# Windows (Credential Manager)
git config --global credential.helper manager

# Linux (libsecret)
sudo apt install libsecret-1-0 libsecret-1-dev
sudo make --directory=/usr/share/doc/git/contrib/credential/libsecret
git config --global credential.helper /usr/share/doc/git/contrib/credential/libsecret/git-credential-libsecret

# Linux (GNOME Keyring)
git config --global credential.helper /usr/lib/git-core/git-credential-libsecret

# GitHub CLI (recommended: works on all platforms)
gh auth login
gh auth setup-git
git config --global credential.helper '!gh auth git-credential'

# Cache (temporary, suitable for servers)
git config --global credential.helper 'cache --timeout=3600'
```

### 6.2 Authentication Method Comparison

| Method | Security | Convenience | Recommendation | Notes |
|--------|----------|-------------|----------------|-------|
| SSH key | High | High | Most recommended | Passphrase + Agent |
| gh auth (CLI) | High | High | Recommended | OAuth-based |
| SSH signing | High | High | Recommended | Git 2.34+ |
| Personal Access Token | Medium | Medium | Acceptable | Must limit scope |
| Fine-grained PAT | High | Medium | Recommended | Per-repository restrictions |
| Password auth | Low | - | Deprecated | Retired August 2021 |

### 6.3 Managing Personal Access Tokens

```bash
# Steps to create a Fine-grained Personal Access Token:
# 1. GitHub → Settings → Developer settings
# 2. Personal access tokens → Fine-grained tokens
# 3. Generate new token
# 4. Settings:
#    - Token name: state the purpose (e.g., "CI/CD pipeline")
#    - Expiration: max 90 days recommended
#    - Repository access: Only select repositories
#    - Permissions: principle of least privilege
#      - Contents: Read-only (clone only)
#      - Contents: Read and write (if push is needed)
#      - Pull requests: Read and write (for PR operations)

# Storing tokens (macOS)
# Automatically saved to Keychain Access

# Refreshing tokens
# Re-authenticate when expired:
gh auth refresh
# Or: delete the old entry from Credential Manager
```

---

## 7. diff / merge Tools

### 7.1 delta Configuration

```bash
# Install delta
brew install git-delta  # macOS
sudo apt install git-delta  # Ubuntu

# Configure in ~/.gitconfig (see the [delta] section above)

# Usage
git diff              # delta is applied automatically
git log -p            # patch display also rendered beautifully with delta
git show HEAD         # commit details also supported by delta
git stash show -p     # stash diffs displayed via delta
git blame file.ts     # blame also supported by delta

# Switching delta display modes
# Side-by-side (default setting)
git diff
# Unified view (temporary override)
git -c delta.side-by-side=false diff
# Without line numbers
git -c delta.line-numbers=false diff
```

### 7.2 Customizing delta Themes

```ini
# [delta] section in ~/.gitconfig (detailed version)

[delta]
    navigate = true
    light = false
    side-by-side = true
    line-numbers = true
    syntax-theme = Catppuccin Mocha

    # File header
    file-style = bold yellow ul
    file-decoration-style = none
    file-added-label = [+]
    file-modified-label = [~]
    file-removed-label = [-]
    file-renamed-label = [→]

    # Hunk header
    hunk-header-decoration-style = cyan box ul
    hunk-header-style = file line-number syntax

    # Diff display
    minus-style = syntax "#3B1219"
    minus-emph-style = syntax "#6F1223"
    plus-style = syntax "#1A2B1A"
    plus-emph-style = syntax "#2B4B2B"

    # Line numbers
    line-numbers-minus-style = "#F38BA8"
    line-numbers-plus-style = "#A6E3A1"
    line-numbers-zero-style = "#585B70"
    line-numbers-left-format = "{nm:>4} "
    line-numbers-right-format = "{np:>4} │ "

    # blame
    blame-palette = "#1e1e2e #181825 #11111b #313244 #45475a"
    blame-format = "{author:<18} {commit:<8} {timestamp:<16}"

    # merge conflict
    merge-conflict-begin-symbol = ▼
    merge-conflict-end-symbol = ▲
    merge-conflict-ours-diff-header-style = yellow bold
    merge-conflict-theirs-diff-header-style = cyan bold

    # Inline diff (word-level)
    inline-hint-style = syntax
```

### 7.3 Setting VS Code as diff/merge Tool

```bash
# diff tool
git config --global diff.tool vscode
git config --global difftool.vscode.cmd 'code --wait --diff $LOCAL $REMOTE'
git config --global difftool.prompt false

# merge tool
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait --merge $REMOTE $LOCAL $BASE $MERGED'
git config --global mergetool.keepBackup false
git config --global mergetool.prompt false

# Usage
git difftool                 # Show diff in VS Code
git difftool --dir-diff      # Show directory-level diff
git mergetool                # Resolve conflicts in VS Code

# Using IntelliJ IDEA
git config --global diff.tool intellij
git config --global difftool.intellij.cmd 'idea diff $LOCAL $REMOTE'
git config --global merge.tool intellij
git config --global mergetool.intellij.cmd 'idea merge $LOCAL $REMOTE $BASE $MERGED'
```

### 7.4 Conflict Resolution Flow

```
Conflict display in zdiff3 format:

<<<<<<< HEAD (current branch)
  const timeout = 5000;
||||||| parent of abc1234 (common ancestor)
  const timeout = 3000;
=======
  const timeout = 10000;
>>>>>>> feature/update-config (incoming branch)

Advantages of zdiff3:
  - Shows the common ancestor (|||||||)
  - Makes it clear "what changed from what"
  - More readable than standard diff3

Steps to resolve a conflict:
  1. Open VS Code with git mergetool
  2. Compare changes in the 3-way merge view
  3. Choose "Accept Current", "Accept Incoming", or "Accept Both"
  4. Edit manually if needed
  5. Save and close the editor
  6. git add <resolved-file>
  7. git merge --continue (or git rebase --continue)

When rerere is enabled:
  - Previously resolved patterns are recorded
  - The same conflict is automatically resolved next time
  - Check records with git rerere status
```

---

## 8. Global .gitignore

### 8.1 Configuration

```bash
# Set up a global gitignore
git config --global core.excludesfile ~/.gitignore_global

# ~/.gitignore_global
cat << 'EOF' > ~/.gitignore_global
# ─── OS ───
.DS_Store
.DS_Store?
._*
Thumbs.db
Desktop.ini
ehthumbs.db
$RECYCLE.BIN/

# ─── Editor / IDE ───
*.swp
*.swo
*~
.idea/
*.iml
.vscode/.history
.vscode/settings.json
*.code-workspace
.fleet/
*.sublime-project
*.sublime-workspace
.vs/

# ─── Environment variables ───
.env
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local

# ─── Build / Cache ───
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# ─── Runtime ───
*.pid
*.seed
*.pid.lock

# ─── Other ───
.direnv/
.envrc
.tool-versions
.mise.local.toml
.claude/
.cursorrules
*.bak
*.backup
*.orig
EOF
```

### 8.2 Project-Specific .gitignore

```bash
# Generate using gitignore.io
curl -sL "https://www.toptal.com/developers/gitignore/api/node,react,typescript,vscode,macos" > .gitignore

# Generate with gh CLI
gh api /gitignore/templates/Node -q .source >> .gitignore

# Templates by language/framework
# https://github.com/github/gitignore
```

---

## 9. Managing Multiple Accounts

### 9.1 Directory-Based Switching with includeIf

```ini
# ~/.gitconfig
[user]
    name = Personal Name
    email = personal@example.com
    signingkey = PERSONAL_GPG_KEY_ID

# Work directory
[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work

# For OSS projects
[includeIf "gitdir:~/oss/"]
    path = ~/.gitconfig-oss

# Specific repository
[includeIf "gitdir:~/work/secret-project/"]
    path = ~/.gitconfig-secret

# Remote URL-based switching (Git 2.36+)
[includeIf "hasconfig:remote.*.url:git@github-work:**"]
    path = ~/.gitconfig-work
```

```ini
# ~/.gitconfig-work
[user]
    name = Work Name
    email = work@company.com
    signingkey = WORK_GPG_KEY_ID

[core]
    sshCommand = ssh -i ~/.ssh/id_ed25519_work

# Company proxy settings
[http]
    proxy = http://proxy.company.com:8080

[url "git@github-work:"]
    insteadOf = git@github.com:company/
```

### 9.2 Configuration Check Script

```bash
#!/bin/bash
# ~/bin/git-check-config.sh
# Check Git configuration for the current directory

echo "=== Git Configuration Check ==="
echo ""
echo "User:"
echo "  Name:  $(git config user.name)"
echo "  Email: $(git config user.email)"
echo ""
echo "Signing:"
echo "  Key:    $(git config user.signingkey)"
echo "  GPG:    $(git config commit.gpgsign)"
echo ""
echo "Remote:"
echo "  URL:    $(git remote get-url origin 2>/dev/null || echo 'N/A')"
echo ""
echo "SSH:"
echo "  Command: $(git config core.sshCommand || echo 'default')"
echo ""
echo "Config source:"
git config --show-origin user.email
```

---

## 10. Git Hooks

### 10.1 Client-Side Hooks

```bash
# ─── pre-commit hook ───
# .git/hooks/pre-commit (project-specific)
cat << 'HOOK' > .git/hooks/pre-commit
#!/bin/bash
# Lint & format check
echo "Running pre-commit checks..."

# Target only staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=d)

# Lint TypeScript/JavaScript
TS_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx|js|jsx)$')
if [ -n "$TS_FILES" ]; then
    echo "Linting TypeScript/JavaScript files..."
    npx eslint $TS_FILES --quiet
    if [ $? -ne 0 ]; then
        echo "❌ ESLint check failed"
        exit 1
    fi
fi

# Check for secrets
if git diff --cached --diff-filter=d | grep -iE '(password|secret|api_key|token)[\s]*=[\s]*["\x27][^"\x27]+'; then
    echo "❌ Possible secret detected in staged changes"
    echo "Please review and remove sensitive data"
    exit 1
fi

echo "✅ Pre-commit checks passed"
HOOK
chmod +x .git/hooks/pre-commit
```

### 10.2 Husky + lint-staged (Recommended)

```bash
# Set up Husky
npx husky init

# Install lint-staged
npm install -D lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ],
    "*.css": [
      "stylelint --fix",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged

# .husky/commit-msg
npx --no-install commitlint --edit $1

# .husky/pre-push
npm test
```

### 10.3 commitlint Configuration

```bash
# Install
npm install -D @commitlint/cli @commitlint/config-conventional

# commitlint.config.js
cat << 'EOF' > commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert'
    ]],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 100],
  },
};
EOF
```

---

## 11. Git LFS (Large File Storage)

### 11.1 Setup

```bash
# Install
brew install git-lfs
git lfs install

# Configure tracked file types
git lfs track "*.psd"
git lfs track "*.zip"
git lfs track "*.mp4"
git lfs track "*.woff2"
git lfs track "*.model"      # ML models
git lfs track "assets/**"    # Directory-level tracking

# .gitattributes is generated automatically
cat .gitattributes
# *.psd filter=lfs diff=lfs merge=lfs -text
# *.zip filter=lfs diff=lfs merge=lfs -text

# Always commit .gitattributes
git add .gitattributes
git commit -m "chore: configure Git LFS tracking"

# Check LFS status
git lfs status
git lfs ls-files          # List files managed by LFS
git lfs env               # LFS configuration info
```

---

## 12. Anti-Patterns

### 12.1 Not Setting a Passphrase on GPG / SSH Keys

```
❌ Anti-pattern: leaving the passphrase empty when running ssh-keygen

Problem:
  - If the private key is leaked, it can be immediately misused
  - Flagged in security audits
  - Violates team security policy

✅ Correct approach:
  - Always set a passphrase
  - Automate passphrase entry with SSH Agent + Keychain
  - Use ssh-add --apple-use-keychain to persist across sessions
  - Configure appropriate cache duration in GPG Agent
```

### 12.2 Using `git pull` Without Configuration

```
❌ Anti-pattern: running git pull without setting pull.rebase

Problem:
  - Creates a large number of unnecessary merge commits
  - Makes git log harder to read

  * abc (HEAD) Merge branch 'main' into feature
  |\
  | * def (main) Update README
  * | ghi Add feature
  |/
  * jkl Previous commit

✅ Correct approach:
  - git config --global pull.rebase true
  - Maintain a clean, linear history

  * abc (HEAD -> feature) Add feature
  * def (main) Update README
  * jkl Previous commit
```

### 12.3 Force Pushing to main/master

```
❌ Anti-pattern: git push --force origin main

Problem:
  - Other members' commits are lost
  - CI/CD pipelines break
  - Difficult to recover

✅ Correct approach:
  - Use --force-with-lease even on feature branches
  - Prohibit force pushes to main/master (GitHub Branch Protection)
  - GitHub → Settings → Branches → Branch protection rules
    ✅ Do not allow force pushes
    ✅ Require pull request reviews before merging
    ✅ Require status checks to pass before merging
```

### 12.4 Committing Large Binary Files Directly

```
❌ Anti-pattern: committing images, videos, or model files directly to Git

Problem:
  - Repository size balloons
  - clone / fetch becomes slow
  - Once committed, complete removal from history is difficult

✅ Correct approach:
  - Use Git LFS to manage large files
  - Define tracking rules in .gitattributes
  - Decide on a maximum file size (e.g., 1MB)
  - Add a size check with a pre-commit hook in CI
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

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
        """Main data processing logic"""
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

### Exercise 2: Advanced Pattern

Extend the basic implementation with the following features.

```python
# Exercise 2: Advanced pattern
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
    """Efficient search using a hashmap"""
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
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Verify the path and format of the config file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check executing user's permissions, review settings |
| Data inconsistency | Concurrent process conflict | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate incrementally**: Use log output or a debugger to test hypotheses
5. **Fix and run regression tests**: After fixing, also run tests for related areas

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
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
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

Steps to diagnose performance problems:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O wait**: Inspect disk and network I/O status
4. **Check concurrent connections**: Inspect connection pool status

| Problem type | Diagnostic tool | Solution |
|-------------|----------------|---------|
| CPU load | cProfile, py-spy | Improve algorithms, parallelize |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Here is a summary of criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-first, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → go to ②              │
│                                                 │
│  ② How often do you deploy?                     │
│    ├─ Weekly or less → Monolith + module split   │
│    └─ Daily / multiple times → go to ③          │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables the right tool for the job but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

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

## 13. FAQ

### Q1: How do I switch between company and personal Git accounts?

**A:** Use the `includeIf` directive. Repositories under `~/work/` automatically apply the work configuration; everything else uses the personal config. Separating SSH config as well lets you use `git@github-work:company/repo.git` style when cloning. See Section 9 for details.

### Q2: What is `rerere` and should I enable it?

**A:** REuse REcorded REsolution. It records the pattern of a resolved conflict and automatically applies the same resolution when the same conflict recurs. It is virtually essential in environments where feature branches are frequently rebased. Enable it with `git config --global rerere.enabled true`. Setting `rerere.autoupdate = true` automatically stages the auto-resolved files as well.

### Q3: Is commit signing necessary?

**A:** Optional for personal development, but strongly recommended for team development and open source. GitHub's "Verified" badge proves the authenticity of a commit. It is also used to confirm that GitHub Actions bot commits are not impersonations. Organizations can enforce signing as a requirement. If GPG is cumbersome, SSH key signing (Git 2.34+) is easy to set up and recommended.

### Q4: What is the difference between `git push --force` and `--force-with-lease`?

**A:** `--force` unconditionally overwrites the remote state and risks erasing other members' commits. `--force-with-lease` only force-pushes if the remote is in the same state as what you last saw — it is rejected if someone else has pushed in the meantime. After rebasing a feature branch, always use `--force-with-lease`. Force pushes to main/master should be prohibited via settings.

### Q5: What is histogram diff?

**A:** `diff.algorithm = histogram` is an improved version of patience diff that more intelligently detects code movement and structural changes. It tends to produce more "meaningful" diffs than the default Myers diff. It is particularly effective during refactoring involving many function additions, deletions, and moves. The performance impact is negligible.

### Q6: What is fsmonitor and should I enable it?

**A:** `core.fsmonitor = true` uses a daemon to monitor filesystem changes, dramatically improving the speed of `git status` and `git diff`. Repositories with more than 100,000 files can see tens of times speedup. Either the built-in FSMonitor (Git 2.37+) or Facebook's Watchman can be used. The effect is limited for small repositories, but there is virtually no downside to enabling it.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development tasks. It becomes especially important during code reviews and architecture design.

---

## 14. Summary

| Setting | Recommended value | Reason |
|---------|------------------|--------|
| `init.defaultBranch` | `main` | Industry standard |
| `pull.rebase` | `true` | Clean history |
| `fetch.prune` | `true` | Auto-clean deleted branches |
| `merge.conflictstyle` | `zdiff3` | Shows common ancestor |
| `commit.gpgsign` | `true` | Commit verification |
| `push.autoSetupRemote` | `true` | Reduces effort on first push |
| `rebase.autosquash` | `true` | Auto-organize fixup commits |
| `rebase.updateRefs` | `true` | Auto-update stacked PRs |
| `rerere.enabled` | `true` | Auto-resolve recurring conflicts |
| `diff.algorithm` | `histogram` | Smarter diff detection |
| `core.pager` | `delta` | Beautiful diff display |
| `core.fsmonitor` | `true` | Speed up large repositories |
| `branch.sort` | `-committerdate` | Show newest branches first |
| `tag.sort` | `version:refname` | Semantic version order |
| `help.autocorrect` | `prompt` | Suggest correction on typo |

---

## What to Read Next

- [03-ai-tools.md](./03-ai-tools.md) -- Setting up AI development tools
- [../03-team-setup/00-project-standards.md](../03-team-setup/00-project-standards.md) -- Team-wide Git conventions
- [../01-runtime-and-package/03-linter-formatter.md](../01-runtime-and-package/03-linter-formatter.md) -- pre-commit hook integration

---

## References

1. **Pro Git (2nd Edition)** -- https://git-scm.com/book/ja/v2 -- The most comprehensive free Git reference. Available in Japanese.
2. **GitHub SSH Documentation** -- https://docs.github.com/ja/authentication/connecting-to-github-with-ssh -- Official SSH setup guide.
3. **git-delta** -- https://github.com/dandavison/delta -- Official delta repository. Rich in configuration examples.
4. **gitconfig Best Practices** -- https://jvns.ca/blog/2024/02/16/popular-git-config-options/ -- Practical explanation by Julia Evans.
5. **Conventional Commits** -- https://www.conventionalcommits.org/ja/ -- Standard specification for commit message conventions. Available in Japanese.
6. **Git LFS Documentation** -- https://git-lfs.com/ -- Official Git LFS documentation.
7. **Husky** -- https://typicode.github.io/husky/ -- Git hooks management tool.
8. **GitHub Branch Protection** -- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-a-branch-protection-rule -- Branch protection rule configuration.
9. **SSH Key Signing (Git Blog)** -- https://github.blog/changelog/2022-08-23-ssh-commit-verification-now-supported/ -- Official announcement of SSH signing.
10. **Git Performance** -- https://git-scm.com/docs/git-maintenance -- Git maintenance and optimization commands.
