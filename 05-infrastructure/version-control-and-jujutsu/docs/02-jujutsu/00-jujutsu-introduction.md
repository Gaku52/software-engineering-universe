# Introduction to Jujutsu

> Understand the design philosophy of Jujutsu (jj), the next-generation version control system, its fundamental differences from Git, and master the basic operations.

## What You Will Learn

1. **Jujutsu's Design Philosophy** — What was redesigned to solve Git's shortcomings
2. **Fundamental Differences from Git** — working copy = commit, automatic rebasing, first-class conflict support
3. **Basic Operations** — jj init, jj new, jj describe, jj log, jj diff
4. **Initial Setup and Customization** — From installation to configuration for comfortable daily use
5. **Jujutsu's Internal Architecture** — Operation Log, storage backend, and the snapshotting mechanism


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What Is Jujutsu?

Jujutsu (jj) is a version control system developed by Martin von Zweigbergk at Google. It **uses Git's object storage internally while fundamentally redesigning the UI and operation model**.

```
┌─────────────────────────────────────────────────────┐
│  Jujutsu Architecture                               │
│                                                     │
│  ┌───────────────────────┐                          │
│  │  User Interface       │  ← jj commands           │
│  │  (Jujutsu model)      │                          │
│  └───────────┬───────────┘                          │
│              │                                      │
│  ┌───────────▼───────────┐                          │
│  │  Operation Log        │  ← Records all operations│
│  │  (undo/redo support)  │                          │
│  └───────────┬───────────┘                          │
│              │                                      │
│  ┌───────────▼───────────┐                          │
│  │  Backend Storage      │  ← Git-compatible        │
│  │  (Git objects/refs)   │                          │
│  └───────────────────────┘                          │
│                                                     │
│  → Use jj directly in a git clone repository        │
│  → Changes made with jj can be git pushed           │
└─────────────────────────────────────────────────────┘
```

### 1.1 Problems Jujutsu Solves

| Git Problem                                 | Jujutsu Solution                              |
|---------------------------------------------|-----------------------------------------------|
| Staging area is complex                     | The working copy itself is a commit           |
| Losing changes in detached HEAD             | All changes are auto-tracked, never lost      |
| Conflict hell during rebase                 | Conflicts are recorded in commits, resolvable later |
| Branch management is cumbersome             | Anonymous branches (branchless development)   |
| Hard to undo (relying on reflog)            | Operation Log for undo/redo of all operations |
| Must understand the index                   | No index (staging) required                   |
| Complex rebase -i operations                | Intuitive operations like squash, split, edit |
| Managing stashes is tedious                 | Everything is a commit, no stash needed       |
| Working tree pollution when switching branches | working copy = commit keeps state always clear |

### 1.2 Background of Jujutsu's Development

Jujutsu emerged from the following background.

1. **Google's Internal VCS Experience**: Google uses proprietary VCS systems like Piper and CitC internally, which cultivated workflows different from Git. Martin von Zweigbergk was also involved in Mercurial development and was exploring ways to improve Git's operation model.

2. **Lessons from Mercurial**: Provides Mercurial's excellent features — such as the changeset concept, revset language, and evolve extension — in a Git-compatible form. The revset query language was one of Mercurial's most advanced features.

3. **Importance of Git Compatibility**: For a new VCS to gain adoption, compatibility with the existing Git ecosystem is essential. Jujutsu achieves seamless integration with GitHub, GitLab, and others by using Git's object storage directly.

4. **Modern CLI Design**: Git is based on 2005-era design thinking, and its command set has inconsistencies (e.g., the overloaded meaning of `git checkout`). Jujutsu follows modern CLI design best practices, with each command having a single responsibility.

```
┌─────────────────────────────────────────────────────┐
│  VCS and Tools That Influenced Jujutsu              │
│                                                     │
│  Mercurial (hg)                                     │
│  ├── revset query language                          │
│  ├── changeset concept                              │
│  ├── evolve extension (obsmarkers)                  │
│  └── template language                              │
│                                                     │
│  Google Piper / CitC                                │
│  ├── working copy = pending change                  │
│  ├── code review integration                        │
│  └── experience operating large-scale monorepos     │
│                                                     │
│  Git                                                │
│  ├── object storage (blob, tree, commit)            │
│  ├── commit management via DAG (directed acyclic graph) │
│  └── remote integration (fetch, push)               │
│                                                     │
│  → Next-generation VCS integrating these strengths = Jujutsu │
└─────────────────────────────────────────────────────┘
```

### 1.3 Jujutsu's Design Principles

Jujutsu is based on the following design principles.

1. **First-class conflicts**: Conflicts are treated not as errors but as a normal state that can be recorded in a commit
2. **Automatic rebasing**: Changes to a parent commit automatically propagate to child commits
3. **Immutable change IDs**: The logical identity of a commit is preserved even after rebasing
4. **Operation undo**: All operations are recorded and can be safely undone
5. **No staging required**: The state of the working copy is directly reflected in commits
6. **Anonymous branches**: A flexible design that allows development without branch names

---

## 2. Installation and Initial Setup

### 2.1 Installation on Each Platform

```bash
# macOS (Homebrew)
$ brew install jj

# macOS (MacPorts)
$ sudo port install jujutsu

# Linux (cargo)
$ cargo install --locked jujutsu-cli

# Linux (Arch Linux)
$ pacman -S jujutsu

# Linux (Nix)
$ nix-env -iA nixpkgs.jujutsu

# Linux (Ubuntu/Debian - snap)
$ snap install jj-vcs

# Windows (Scoop)
$ scoop install jujutsu

# Windows (Chocolatey)
$ choco install jujutsu

# Windows (winget)
$ winget install martinvonz.jj

# Build from source
$ git clone https://github.com/martinvonz/jj.git
$ cd jj
$ cargo build --release
$ cp target/release/jj ~/.local/bin/

# Verify version
$ jj version
jj 0.25.0
```

### 2.2 Initial Setup

```bash
# Username and email address (required)
$ jj config set --user user.name "Gaku"
$ jj config set --user user.email "gaku@example.com"

# Editor configuration
$ jj config set --user ui.editor "vim"
# For VS Code
$ jj config set --user ui.editor "code --wait"
# For Emacs
$ jj config set --user ui.editor "emacs -nw"

# Diff editor configuration (used with split, squash)
$ jj config set --user ui.diff-editor "meld"
# For difftastic
$ jj config set --user ui.diff.tool "difft"

# Pager configuration
$ jj config set --user ui.pager "less -FRX"
# For delta
$ jj config set --user ui.pager "delta"

# Default command (command run when jj is executed without arguments)
$ jj config set --user ui.default-command "log"

# Check configuration
$ jj config list
$ jj config list --user    # User-level settings only

# Check configuration file path
$ jj config path --user
# → ~/.jjconfig.toml
```

### 2.3 Editing the Configuration File Directly

```toml
# Full overview of ~/.jjconfig.toml

[user]
name = "Gaku"
email = "gaku@example.com"

[ui]
editor = "vim"
diff-editor = "meld"
merge-editor = "meld"
pager = "less -FRX"
default-command = "log"
# Control color output
color = "auto"  # "always", "never", "auto"
# Whether to use a pager
paginate = "auto"  # "auto", "never"

[git]
# Bookmark name prefix when pushing
push-bookmark-prefix = "gaku/push-"
# Automatically import Git tags when fetching
auto-local-bookmark = false

[aliases]
# Aliases for frequently used commands
l = ["log", "-r", "ancestors(heads(all()), 10)"]
ll = ["log", "--no-graph"]
d = ["diff"]
ds = ["diff", "--stat"]
s = ["status"]
n = ["new"]
c = ["commit"]
desc = ["describe"]
```

### 2.4 Shell Completion Setup

```bash
# Bash
$ jj util completion bash > ~/.local/share/bash-completion/completions/jj
# Or
$ echo 'source <(jj util completion bash)' >> ~/.bashrc

# Zsh
$ jj util completion zsh > ~/.zfunc/_jj
# Add the following to .zshrc:
# fpath=(~/.zfunc $fpath)
# autoload -Uz compinit && compinit

# Fish
$ jj util completion fish > ~/.config/fish/completions/jj.fish

# PowerShell
$ jj util completion powershell | Out-File -FilePath $PROFILE -Append
```

### 2.5 Integration with difftastic

difftastic is a syntax-aware diff tool with official Jujutsu integration support.

```bash
# Install difftastic
$ brew install difftastic   # macOS
$ cargo install difftastic  # cargo

# Configuration in jjconfig.toml
# [ui]
# diff.tool = ["difft", "--color=always", "$left", "$right"]

# Temporary use from the command line
$ jj diff --tool difft
$ jj log -p --tool difft
```

---

## 3. Core Concept: working copy = commit

### 3.1 The Biggest Difference from Git

```
┌─────────────────────────────────────────────────────┐
│  Git Mental Model                                   │
│                                                     │
│  Working Directory → Staging Area → Repository     │
│    (untracked)       (git add)      (git commit)    │
│                                                     │
│  You need to be aware of 3 areas                    │
│                                                     │
│  Common mistakes:                                   │
│  - Forgetting git add leads to an empty commit      │
│  - Partial adds lead to incomplete commit contents  │
│  - git add -A accidentally includes unwanted files  │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Jujutsu Mental Model                               │
│                                                     │
│  Working Copy = Latest Commit (always auto-recorded)│
│                                                     │
│  Edit a file → automatically reflected in working copy commit │
│  "jj new" → start a new empty commit               │
│                                                     │
│  No staging area exists                             │
│                                                     │
│  Benefits:                                          │
│  - No need to worry about forgetting git add        │
│  - Changes are always recorded in a commit          │
│  - No stash needed (everything is a commit)         │
│  - Partial change selection is possible later with jj split │
└─────────────────────────────────────────────────────┘
```

### 3.2 The Difference Between a Change and a Commit

```
┌────────────────────────────────────────────────────┐
│  Jujutsu Terminology                               │
│                                                    │
│  change:  A logical unit of change (identified by change ID) │
│           The change ID does not change after rebase │
│           Displayed as 8 lowercase letters (e.g.: rlvkpntz) │
│                                                    │
│  commit:  A snapshot at a specific point in time  │
│           The commit ID (SHA-1) changes when content changes │
│           Displayed in hexadecimal (e.g.: abc12345) │
│                                                    │
│  Example:                                          │
│  If change "rlvkpntz" has commit abc12345          │
│  After rebasing, the commit becomes def67890 but   │
│  the change ID remains "rlvkpntz"                  │
│                                                    │
│  → Tracking by change ID keeps the reference stable after rebase │
│                                                    │
│  Key Differences:                                  │
│  ┌──────────────┬──────────────┬──────────────┐    │
│  │              │ change ID    │ commit ID    │    │
│  ├──────────────┼──────────────┼──────────────┤    │
│  │ After rebase │ Unchanged    │ Changes      │    │
│  │ After amend  │ Unchanged    │ Changes      │    │
│  │ Format       │ lowercase    │ hexadecimal  │    │
│  │ Purpose      │ Tracking     │ Git-compat   │    │
│  │ Uniqueness   │ Within repo  │ Global       │    │
│  └──────────────┴──────────────┴──────────────┘    │
└────────────────────────────────────────────────────┘
```

### 3.3 How Snapshotting Works

Jujutsu's "working copy = commit" is realized through a mechanism called snapshotting.

```
┌─────────────────────────────────────────────────────┐
│  Snapshotting Operation Flow                        │
│                                                     │
│  1. User edits a file                               │
│     → Not yet reflected in the commit at this point │
│                                                     │
│  2. A jj command is executed (jj status, jj log, jj diff, etc.) │
│     → Before the command runs, a snapshot of the   │
│       working copy is automatically taken           │
│     → File system changes are reflected in the commit │
│                                                     │
│  3. Snapshot optimization                           │
│     → Watchman integration checks only changed files │
│     → Operates quickly even in large repositories  │
│                                                     │
│  In other words:                                    │
│  - A new commit is NOT created every time you       │
│    save a file with Ctrl+S                          │
│  - Changes are reflected "in bulk" when a jj command runs │
│  - Performance impact is minimal                   │
└─────────────────────────────────────────────────────┘
```

```bash
# Observing snapshotting
$ echo "Hello" > hello.txt
$ echo "World" > world.txt

# At this point, not yet reflected in the commit (filesystem only)

# Running jj status triggers a snapshot
$ jj status
Working copy changes:
A hello.txt
A world.txt

# From this point, all jj command output reflects the latest file state
```

### 3.4 Speed Improvement with watchman Integration

```bash
# Install watchman
$ brew install watchman   # macOS
$ sudo apt install watchman  # Ubuntu

# Enable watchman in jj configuration
$ jj config set --user core.fsmonitor "watchman"

# When watchman is enabled:
# - Continuously monitors file system changes
# - Only checks changed files during snapshotting
# - Completes in hundreds of milliseconds even for large repos (100k+ files)
```

---

## 4. Basic Operations

### 4.1 Initializing a Repository

```bash
# Create a new repository
$ jj git init my-project
$ cd my-project

# Use jj with an existing Git repository (co-located)
$ cd existing-git-repo
$ jj git init --colocate
# → A .jj/ directory is created and coexists with the existing .git/

# Clone a remote repository
$ jj git clone https://github.com/user/repo.git
$ jj git clone git@github.com:user/repo.git  # SSH

# Clone a specific branch only
$ jj git clone --branch main https://github.com/user/repo.git

# Clone co-located (recommended)
$ jj git clone --colocate https://github.com/user/repo.git
```

```
┌─────────────────────────────────────────────────────┐
│  Guidelines for Choosing an Initialization Pattern  │
│                                                     │
│  1. New project:                                    │
│     $ jj git init my-project                        │
│     → Both .jj/ and .git/ are created              │
│                                                     │
│  2. Add to existing Git repository:                 │
│     $ jj git init --colocate                        │
│     → Only .jj/ is added, .git/ remains as-is      │
│     → git commands can still be used               │
│                                                     │
│  3. Clone from remote:                              │
│     $ jj git clone --colocate URL                   │
│     → Start co-located (git can also be used)      │
│                                                     │
│  Recommendation: Always start co-located            │
│  → No trouble if you need git commands later       │
│  → No issues even if team members use git          │
└─────────────────────────────────────────────────────┘
```

### 4.2 Creating and Recording Changes

```bash
# Create/edit files (automatically reflected in the working copy commit)
$ echo "Hello" > hello.txt

# Check the current state
$ jj status
Working copy changes:
A hello.txt

# Add a description to the working copy commit
$ jj describe -m "feat: create hello.txt"

# Set a multi-line message
$ jj describe -m "feat: create hello.txt

Added the initial Hello message file.
This file will be the foundation of the project."

# Edit the description in an editor (omit -m)
$ jj describe
# → The configured editor opens to edit the commit message

# Start a new commit (finalize current changes and move to a new empty commit)
$ jj new
# → Current changes are finalized, and a new empty working copy commit is created on top

# Shortcut that does both describe and new at once
$ jj commit -m "feat: create hello.txt"
# → Equivalent to jj describe -m "..." && jj new

# Check the log
$ jj log
@  rlvkpntz gaku@example.com 2025-02-11 15:30:00 abc12345
│  (empty) (no description set)
○  qpvuntsm gaku@example.com 2025-02-11 15:25:00 def67890
│  feat: create hello.txt
○  zzzzzzzz root() 00000000
```

### 4.3 How to Read `jj log`

```
┌─────────────────────────────────────────────────────┐
│  jj log Output Format                              │
│                                                     │
│  @  rlvkpntz gaku@... 2025-02-11 abc12345          │
│  ^  ^^^^^^^^ ^^^^^^   ^^^^^^^^^^  ^^^^^^^^          │
│  │  │        │        │           │                 │
│  │  │        │        │           └── commit ID     │
│  │  │        │        └── timestamp                 │
│  │  │        └── author                             │
│  │  └── change ID (short form)                      │
│  └── @ = working copy (current position)            │
│                                                     │
│  Symbol meanings:                                   │
│  @  = working copy (currently being edited commit) │
│  ○  = regular commit                               │
│  ◆  = immutable commit                             │
│  ×  = has conflicts                                │
│                                                     │
│  Graph lines:                                       │
│  │  = linear parent-child relationship             │
│  ├─┘ = branch merge                                │
│  ├─┐ = branch split                               │
└─────────────────────────────────────────────────────┘
```

```bash
# Log display options

# Display without graph
$ jj log --no-graph

# Display a specific revision range
$ jj log -r 'main..'

# Display with patch (diff)
$ jj log -p

# Display with stat (changed file statistics)
$ jj log -s

# Display with a custom template
$ jj log -T 'change_id.short() ++ " " ++ description.first_line() ++ "\n"'

# Show only log related to a specific file
$ jj log -r 'file("src/auth.js")'

# Show only the last N entries
$ jj log -n 10
# Or using a revset
$ jj log -r 'ancestors(@, 10)'
```

### 4.4 Checking Diffs

```bash
# Check working copy changes
$ jj diff

# Check changes in a specific change
$ jj diff -r qpvuntsm

# Diff between two revisions
$ jj diff --from main --to @

# Check a summary in stat format
$ jj diff --stat

# Only a specific file
$ jj diff src/auth.js

# Summary format (list of added/modified/deleted files)
$ jj diff --summary

# Show diff using difftastic
$ jj diff --tool difft

# Show the contents of a specific revision in detail
$ jj show qpvuntsm
$ jj show @-
$ jj show main
```

### 4.5 Controlling File Tracking

```bash
# Same mechanism as .gitignore (Jujutsu reads .gitignore)
$ echo "node_modules/" >> .gitignore
$ echo "*.log" >> .gitignore
$ echo ".env" >> .gitignore

# Restore a specific file (undo working copy changes)
$ jj restore --from @- src/auth.js
# @- = parent commit of working copy

# Restore a file from a specific revision
$ jj restore --from main src/config.js

# Undo all changes
$ jj restore

# Restore only specific file patterns
$ jj restore "src/**/*.js"

# Check the file list
$ jj file list
$ jj file list -r main  # File list of a specific revision
```

### 4.6 File Operation Utilities

```bash
# Show the contents of a file from a specific revision
$ jj file show src/auth.js
$ jj file show -r main src/auth.js

# Track the change history of a specific file
$ jj log -r 'file("src/auth.js")'

# Handling file copy/rename
# Jujutsu automatically detects copies/renames
$ mv src/old.js src/new.js
$ jj status
# Working copy changes:
# R {src/old.js => src/new.js}

# Batch operations on multiple files
$ jj restore --from @- "src/*.js" "test/*.js"
```

---

## 5. First-Class Conflict Support

In Git, a rebase/merge is interrupted when a conflict occurs. In Jujutsu, **conflict state is recorded in the commit and can be resolved later**.

### 5.1 Basic Conflict Handling

```bash
# Rebase completes even when conflicts occur
$ jj rebase -d main
# Rebased 3 commits
# New conflicts in:
#   rlvkpntz abc12345

# Log with conflict state
$ jj log
@  rlvkpntz gaku@... 2025-02-11 abc12345 conflict
│  feat: auth feature                     ^^^^^^^^
│                                         conflict marker
○  ...

# Check for conflicts
$ jj status
Working copy changes:
C src/auth.js    ← C = conflict

# Edit the file to resolve the conflict
$ vim src/auth.js
# → Remove conflict markers through normal file editing
# → Automatically reflected in the working copy commit
# → The conflict marker disappears once the conflict is resolved
```

### 5.2 Conflict Marker Format

```
┌─────────────────────────────────────────────────────┐
│  Jujutsu Conflict Markers                           │
│                                                     │
│  Git format:                                        │
│  <<<<<<< HEAD                                       │
│  current changes                                    │
│  =======                                            │
│  incoming changes                                   │
│  >>>>>>> branch-name                                │
│                                                     │
│  Jujutsu format:                                    │
│  <<<<<<< Conflict 1 of 1                            │
│  %%%%%%% Changes from base to side #1               │
│  -old line from base                                │
│  +new line from side 1                              │
│  +++++++ Contents of side #2                        │
│  new line from side 2                               │
│  >>>>>>> Conflict 1 of 1 ends                       │
│                                                     │
│  Jujutsu markers include 3-way information,         │
│  making it clearer what was changed                 │
└─────────────────────────────────────────────────────┘
```

```bash
# Conflict checking and resolution flow
$ jj status
# C src/auth.js

# Check the content of the conflicted file
$ cat src/auth.js
# <<<<<<< Conflict 1 of 1
# %%%%%%% Changes from base to side #1
# -const AUTH_KEY = "old-key";
# +const AUTH_KEY = "new-key-from-branch-a";
# +++++++ Contents of side #2
# const AUTH_KEY = "new-key-from-branch-b";
# >>>>>>> Conflict 1 of 1 ends

# Edit in the editor to remove the conflict markers
$ vim src/auth.js
# Rewrite as: const AUTH_KEY = "new-key-from-branch-b";

# Confirm resolution
$ jj status
# Working copy changes:
# M src/auth.js    ← Changed from C(conflict) to M(modified)
```

### 5.3 Deferred Conflict Resolution

```bash
# You can continue working on top of a commit that has conflicts
$ jj log
@  rlvkpntz ... conflict
│  feat: auth feature
○  ...

# Ignore the conflict for now and start new work
$ jj new main
$ vim src/other-feature.js
$ jj describe -m "feat: another feature"

# Resolve the conflict later
$ jj edit rlvkpntz
$ vim src/auth.js   # Resolve the conflict
$ jj new            # Finalize the resolution

# List commits with conflicts
$ jj log -r 'conflict()'
```

```
┌────────────────────────────────────────────────────┐
│  Git vs Jujutsu: Conflict Handling                 │
│                                                    │
│  Git:                                              │
│  Conflict during rebase                            │
│    → rebase is interrupted                         │
│    → Must resolve immediately                      │
│    → --abort to redo everything, or --continue     │
│    → Painful when multiple commits have conflicts  │
│                                                    │
│  Jujutsu:                                          │
│  Conflict during rebase                            │
│    → rebase completes                              │
│    → Conflict state is recorded in the commit      │
│    → Can be resolved at any convenient time        │
│    → Other work can be done first                  │
│    → Conflicts across multiple commits can be resolved individually │
│    → Safe as long as you don't push conflicting commits │
└────────────────────────────────────────────────────┘
```

---

## 6. Operation Log — undo/redo for All Operations

### 6.1 Operation Log Basics

```bash
# Check the operation log
$ jj op log
@  abc12345 gaku@... 2025-02-11 15:30:00
│  new empty commit
○  def67890 gaku@... 2025-02-11 15:25:00
│  describe commit rlvkpntz
○  789abcde gaku@... 2025-02-11 15:20:00
│  snapshot working copy
○  fedcba98 gaku@... 2025-02-11 15:15:00
│  add workspace 'default'

# Undo the previous operation
$ jj undo
# → The effect of the previous jj command is completely undone

# Restore to a specific operation point
$ jj op restore def67890
```

### 6.2 Operation Log Usage Patterns

```bash
# Undo an incorrect rebase
$ jj rebase -d wrong-branch
# → Oops, rebased onto the wrong branch!
$ jj undo
# → Completely reverts to the state before the rebase

# Revive an abandoned commit
$ jj abandon rlvkpntz
# → Oops, abandoned the wrong commit!
$ jj undo
# → The commit is revived

# Check the log at a specific operation point
$ jj op log --no-graph
# → A list of all operations is displayed

# Check the diff between operations
$ jj op diff --from abc12345 --to def67890
# → Shows which commits changed between the two operations

# Detailed view of an operation
$ jj op show abc12345
```

### 6.3 Comparing Operation Log and Git reflog

```
┌─────────────────────────────────────────────────────┐
│  Operation Log vs Git reflog                        │
│                                                     │
│  Git reflog:                                        │
│  - Records only HEAD movement history               │
│  - Separate reflog per branch                       │
│  - Display: git reflog                              │
│  - Restore: git reset --hard HEAD@{n}               │
│  - Expiry: Deleted after 90 days by default         │
│                                                     │
│  Jujutsu Operation Log:                             │
│  - Records all jj operations                        │
│  - Records the entire state of the repository       │
│  - Display: jj op log                               │
│  - Restore: jj op restore <op-id>                   │
│  - Expiry: None (retained until explicitly gc'd)    │
│  - Undo: jj undo to cancel the previous operation  │
│                                                     │
│  → Operation Log is a superset of reflog            │
│  → All operations are recorded, enabling safe experimentation │
└─────────────────────────────────────────────────────┘
```

---

## 7. Jujutsu's Internal Architecture

### 7.1 Storage Backend

```
┌─────────────────────────────────────────────────────┐
│  Jujutsu Storage Structure                          │
│                                                     │
│  .jj/                                               │
│  ├── repo/                                          │
│  │   ├── store/                                     │
│  │   │   ├── git_target          ← Path to Git store│
│  │   │   ├── type                ← "git" (store type)│
│  │   │   └── extra/              ← Jujutsu-specific data │
│  │   │       ├── change_id_index ← change ID index  │
│  │   │       └── ...                                │
│  │   ├── op_store/               ← Operation Log    │
│  │   │   ├── operations/         ← Data for each operation │
│  │   │   └── views/              ← State at each operation point │
│  │   └── op_heads/               ← ID of the latest operation │
│  └── working_copy/               ← working copy     │
│      └── ...                        state management │
│                                                     │
│  .git/  (if co-located)                             │
│  ├── objects/                    ← blob, tree, commit│
│  ├── refs/                       ← branches, tags   │
│  └── ...                                            │
│                                                     │
│  → Jujutsu saves Git objects in .git/objects/       │
│  → .jj/ contains only Jujutsu-specific metadata    │
│  → So Git tools (gitk, git log, etc.) still work   │
└─────────────────────────────────────────────────────┘
```

### 7.2 Change ID Generation and Management

```bash
# change ID format
# - Composed of lowercase letters only (a-z)
# - Internally a 128-bit random value
# - Uses a short form when displayed (shortest unique prefix)

# Check change IDs
$ jj log -T 'change_id ++ "\n"'
# → rlvkpntzsqkxyrmpqvlwxpsmkowkzmkqtlqnovpv
# Displayed in short form as: rlvkpntz

# Referencing by change ID
$ jj show rlvkpntz
$ jj show rlvk       # A shorter prefix works if it's unique enough
$ jj diff -r rl      # Even shorter works if it's unique
```

### 7.3 How Immutable Commits Work

```bash
# Immutable commits = commits that cannot be targets of rebase, edit, squash, etc.
# By default, commits before trunk() (main/master) are immutable

# Check the immutable definition
$ jj config get revset-aliases.'immutable_heads()'
# → "trunk() | tags()"

# Change what is immutable (e.g.: main and release tags)
# Add to ~/.jjconfig.toml:
# [revset-aliases]
# 'immutable_heads()' = 'trunk() | tags() | remote_bookmarks()'

# Attempting to edit an immutable commit results in an error
$ jj edit main
# Error: Commit abc12345 is immutable
# Hint: Configure the set of immutable commits via `revset-aliases.immutable_heads()`

# Temporarily ignore immutable (not recommended, for emergencies only)
$ jj rebase -r main --ignore-immutable -d @
```

---

## 8. Everyday Operation Patterns

### 8.1 A Typical Development Cycle

```bash
# 1. Start work from the latest main
$ jj git fetch
$ jj new main@origin

# 2. Edit files
$ vim src/feature.js

# 3. Set a commit message
$ jj describe -m "feat: add user profile feature"

# 4. Continue editing (automatically reflected in the commit)
$ vim src/feature.test.js
$ vim src/types.ts

# 5. Start a new commit at a logical stopping point
$ jj new

# 6. Implement the next feature
$ vim src/another-feature.js
$ jj describe -m "feat: add notification feature"

# 7. Set bookmarks before pushing
$ jj bookmark create feature-profile -r @-  # Commit for profile feature
$ jj bookmark create feature-notify -r @    # Commit for notification feature

# 8. Push and create PRs
$ jj git push --bookmark feature-profile --allow-new
$ jj git push --bookmark feature-notify --allow-new
```

### 8.2 Amending Past Commits

```bash
# You found a typo in the commit two steps back

# Method 1: Edit directly with jj edit
$ jj edit rlvkpntz           # Move to the commit you want to fix
$ vim src/feature.js          # Fix the file
$ jj new                     # Return to a new working copy
# → Commits in between are automatically rebased

# Method 2: Fix in working copy and use absorb to distribute
$ vim src/feature.js          # Fix in working copy
$ jj absorb                  # Automatically distribute fix to the original commit

# Method 3: Fix in working copy and use squash to merge
$ vim src/feature.js          # Fix in working copy
$ jj squash --into rlvkpntz  # Merge into a specific commit
```

### 8.3 Progressing Multiple Tasks Simultaneously

```bash
# An urgent bug fix comes in while developing the auth feature

# Current work state
$ jj log
@  xxx  feat: implementing auth feature
○  main ...

# Create a new commit for the urgent bugfix (branch off main)
$ jj new main
$ vim src/bugfix.js
$ jj describe -m "fix: fix login error"
$ jj bookmark create hotfix -r @
$ jj git push --bookmark hotfix --allow-new

# Return to the original work
$ jj edit xxx    # Return to the auth feature commit
# → No stash needed! Everything is saved as a commit
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Running git add before jj describe out of Git habit

```bash
# Bad: git add is not needed in Jujutsu
$ vim src/auth.js
$ git add src/auth.js        # ← Not needed!
$ jj describe -m "fix: auth"

# Good: Just editing the file reflects it automatically
$ vim src/auth.js
$ jj describe -m "fix: auth"
# → Automatically reflected in the working copy commit
```

**Reason**: Jujutsu has no staging area. File changes are automatically recorded in the working copy commit. Using `git add` in a co-located repository registers changes in Git's index, which is meaningless on the Jujutsu side and can cause confusion.

### Anti-Pattern 2: Forgetting jj new and continuing to append to the previous commit

```bash
# Bad: Continue working after describe without new
$ jj describe -m "feat: user auth"
$ vim src/api.js       # ← This change also goes into "feat: user auth"

# Good: Run jj new before a new logical change
$ jj describe -m "feat: user auth"
$ jj new               # ← Start a new commit
$ vim src/api.js       # → Recorded in the new commit
$ jj describe -m "feat: API endpoint"
```

**Reason**: In Jujutsu, the working copy is always equated with the latest commit. Without running `jj new`, all changes accumulate in a single commit. However, you can split it later with `jj split`, so it is not fatal.

### Anti-Pattern 3: Continuing to use commit IDs instead of change IDs

```bash
# Bad: Keep referencing by commit ID (SHA-1)
$ jj edit abc12345
$ vim src/fix.js
$ jj new
# → abc12345 no longer exists (the SHA changed after rebase)

# Good: Reference by change ID
$ jj edit rlvkpntz
$ vim src/fix.js
$ jj new
# → rlvkpntz remains unchanged even after rebase
```

**Reason**: A commit ID is Git's SHA-1 hash, calculated from the commit's content (tree, parents, message, etc.). When content changes due to rebase or amend, the commit ID also changes. In contrast, a change ID is Jujutsu's own identifier that does not depend on the commit content, enabling stable references.

### Anti-Pattern 4: Thinking jj undo is a silver bullet

```bash
# Note: jj undo only undoes the immediately previous "one" jj operation
$ jj rebase -d main
$ jj describe -m "new message"
$ jj undo
# → Only describe is undone (rebase is NOT undone)

# Use jj op restore to go back multiple operations
$ jj op log
# → Find the operation ID of the point you want to return to
$ jj op restore <op-id>
```

**Reason**: `jj undo` only undoes the one immediately previous operation. To undo multiple operations, use `jj op log` to find the desired operation point and restore it with `jj op restore`.


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

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

### Exercise 2: Advanced Pattern

Extend the basic implementation by adding the following features.

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
    print(f"Speedup factor: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Malformed configuration file | Check configuration file path and format |
| Timeout | Network delay / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check executing user permissions, review settings |
| Data inconsistency | Concurrent processing contention | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify step by step**: Use log output or a debugger to verify hypotheses
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

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with a profiling tool
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Check the status of disk or network I/O
4. **Check concurrent connection count**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Countermeasure |
|-------------|-----------------|----------------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Below is a summary of decision criteria for making technology choices.

| Decision Criteria | Prioritize When | Can Compromise When |
|------------------|-----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────────┐
│              Architecture Selection Flow             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. What is the team size?                          │
│    ├─ Small (1-5 people) → Monolith                 │
│    └─ Large (10+ people) → go to 2                  │
│                                                     │
│  2. What is the deployment frequency?               │
│    ├─ Weekly or less → Monolith + module split      │
│    └─ Daily / multiple times → go to 3              │
│                                                     │
│  3. How independent are the teams?                  │
│    ├─ High → Microservices                          │
│    └─ Moderate → Modular monolith                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction has high reusability, but can make debugging difficult
- Low abstraction is intuitive, but tends to lead to code duplication

```python
# Architecture decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

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

## 10. FAQ

### Q1. Does Jujutsu completely replace Git?

**A1.** No. Jujutsu operates as an **upper layer on top of Git**. It uses Git's object storage internally, and is fully compatible with normal Git remotes via `jj git push` / `jj git fetch`. It is perfectly fine if other team members continue to use Git.

### Q2. How do I try Jujutsu in an existing Git repository?

**A2.** You can get started immediately with `jj git init --colocate`.

```bash
$ cd existing-git-repo
$ jj git init --colocate
# → .jj/ is created and coexists with the existing .git/
# → jj log displays the entire existing commit history
# → git commands can still be used as-is

# If you don't like it, just delete .jj/ to revert
$ rm -rf .jj
# → Returns completely to a Git-only state
```

### Q3. Is the Jujutsu working copy commit recorded on every save? Is the performance okay?

**A3.** Jujutsu uses a mechanism called "snapshotting" to reflect the state of the working copy into a commit when a jj command runs. A new commit is not created every time a file is saved. Snapshots are taken when commands like `jj status`, `jj log`, and `jj diff` are executed. Speed can also be improved with watchman integration.

### Q4. Can Jujutsu be used with a monorepo?

**A4.** Yes. Jujutsu provides fast snapshotting via watchman integration and operates at practical speeds even in large monorepos. Its use in large-scale repositories has also been validated through internal testing at Google.

### Q5. What editor/IDE integrations are available for Jujutsu?

**A5.** The integration status as of 2025 is as follows.

| Editor/IDE       | Integration Status                              |
|------------------|-------------------------------------------------|
| VS Code          | Git extension can be used with co-located       |
| IntelliJ IDEA    | Git integration can be used with co-located     |
| Vim/Neovim       | fugitive.vim works with co-located              |
| Emacs            | magit works with co-located                     |
| lazyjj           | Dedicated TUI tool for Jujutsu                  |
| jj-fzf           | fzf-based interactive tool                      |

By using a co-located repository, you can continue to leverage existing Git integrations in your editor/IDE.

### Q6. Can compatibility break between Jujutsu version upgrades?

**A6.** Jujutsu has not yet reached 1.0, and CLI changes can occur between minor versions. However, storage format compatibility is maintained, so existing repositories can continue to be used after upgrading `jj`. Important changes are announced in the CHANGELOG and migration guide.

### Q7. Can Jujutsu use submodules?

**A7.** Jujutsu currently provides partial support for Git submodules. In a co-located repository, you can use Git's submodule commands directly, but Jujutsu-native submodule management features are still under development.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend firmly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## Summary

| Concept                | Key Points                                                        |
|------------------------|-------------------------------------------------------------------|
| working copy = commit  | No staging; edits are immediately reflected in the commit         |
| change ID              | Stable identifier that does not change after rebase               |
| commit ID              | Git-compatible SHA-1; changes when content changes                |
| jj new                 | Start a new commit, finalizing previous changes                   |
| jj describe            | Set a message on the working copy commit                          |
| jj commit              | Shortcut for describe + new                                       |
| Conflict recording     | No rebase/merge interruption; conflict state saved in commit      |
| Operation Log          | Records all operations; undo/redo available                       |
| co-located repo        | .git/ and .jj/ coexist; both Git and Jujutsu can be used         |
| Snapshotting           | Working copy state is automatically reflected when a jj command runs |
| immutable commits      | Commits in trunk() or tags() cannot be rebased/edited            |

---

## What to Read Next

- [Jujutsu Workflow](./01-jujutsu-workflow.md) — Practicing changesets and automatic rebasing
- [Jujutsu Advanced](./02-jujutsu-advanced.md) — revsets, templates, and Git integration
- [Git to Jujutsu Migration](./03-git-to-jujutsu.md) — Operation mapping and migration steps

---

## References

1. **Jujutsu Official Documentation** — https://martinvonz.github.io/jj/
2. **Jujutsu GitHub Repository** — https://github.com/martinvonz/jj
3. **Martin von Zweigbergk** — "Jujutsu: A Git-compatible VCS" Google Tech Talk https://www.youtube.com/watch?v=bx_LGilOuE4
4. **Steve Klabnik** — "jj init" (Jujutsu introduction blog) https://steveklabnik.com/writing/jj-init
5. **Austin Seipp** — "jujutsu: A new VCS" https://austinseipp.com/posts/2024-07-10-jj-hierarchies
6. **Chris Krycho** — "jj init: Jujutsu tips and tricks" https://v5.chriskrycho.com/essays/jj-init/
