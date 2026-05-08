# Jujutsu Workflow

> Master practical development workflows leveraging Jujutsu's changeset management and automatic rebase capabilities, enabling flexible commit operations that are difficult to achieve with Git.

## What You Will Learn

1. **Changeset operations** — Flexible commit editing with jj squash, jj split, and jj move
2. **How automatic rebase works** — Child commits are automatically rebased when a parent commit changes
3. **Practical branchless development** — Efficient development flow using bookmarks (formerly branches)
4. **Managing concurrent work** — Techniques for advancing multiple tasks simultaneously
5. **Commit cleanup and optimization** — Workflows for tidying commit history before review


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Jujutsu Introduction](./00-jujutsu-introduction.md)

---

## 1. Basic Changeset Operations

### 1.1 jj new — Creating a New Commit

```bash
# Create a new commit on top of the current working copy
$ jj new
# → The current changes are finalized and a new empty working copy commit is created

# Create a new commit on top of a specific commit
$ jj new qpvuntsm
# → Creates a new working copy commit as a child of qpvuntsm
# → The commit that was previously at the working copy position is automatically moved up

# Create a merge commit (specify multiple parents)
$ jj new commit-a commit-b
# → Creates a merge commit with both commit-a and commit-b as parents

# Create a new commit with a message
$ jj new -m "feat: foundation for new feature"
# → Creates a new commit and sets the message at the same time

# Insert after a specific revision
$ jj new --after aaa --before bbb
# → Inserts a new commit between aaa and bbb
```

```
┌─────────────────────────────────────────────────────┐
│  How jj new works                                    │
│                                                     │
│  Before:                                            │
│  @  rlvkpntz  feat: auth feature  ← working copy   │
│  ○  qpvuntsm  feat: initial setup                   │
│  ◆  zzzzzzzz  root()                                │
│                                                     │
│  $ jj new                                           │
│                                                     │
│  After:                                             │
│  @  xtkvpqwm  (empty) (no description)  ← new wc   │
│  ○  rlvkpntz  feat: auth feature  ← finalized       │
│  ○  qpvuntsm  feat: initial setup                   │
│  ◆  zzzzzzzz  root()                                │
│                                                     │
│  $ jj new qpvuntsm                                  │
│                                                     │
│  After:                                             │
│  ○  rlvkpntz  feat: auth feature  ← auto-rebased   │
│  @  newcommit (empty)         ← inserted commit     │
│  ○  qpvuntsm  feat: initial setup                   │
│  ◆  zzzzzzzz  root()                                │
└─────────────────────────────────────────────────────┘
```

### 1.2 jj edit — Set a Past Commit as the Editing Position

```bash
# Make a past commit the working copy
$ jj edit qpvuntsm
# → qpvuntsm becomes the working copy and can be directly edited
# → Commits above it are automatically rebased

$ vim src/config.js  # Directly edit the qpvuntsm commit
# → Child commits are automatically rebased

# Specify by change ID (recommended)
$ jj edit rlvkpntz
# → Use change ID rather than commit ID so it remains trackable after rebase

# Specify by bookmark name
$ jj edit feature-auth
# → Make the commit pointed to by the bookmark the working copy
```

```
┌────────────────────────────────────────────────────┐
│  How jj edit works                                  │
│                                                    │
│  Before:                                           │
│  @  rlvkpntz  feat: auth feature                   │
│  ○  qpvuntsm  feat: initial setup                  │
│                                                    │
│  $ jj edit qpvuntsm                                │
│                                                    │
│  After:                                            │
│  ○  rlvkpntz  feat: auth feature  ← auto-rebase   │
│  @  qpvuntsm  feat: initial setup  ← directly editable │
│                                                    │
│  When you edit a file:                             │
│  ○  rlvkpntz' feat: auth feature  ← auto-rebased! │
│  @  qpvuntsm' feat: initial setup  ← modified      │
│                                                    │
│  Important: edit does not create a new commit       │
│  unlike jj new. It directly edits the existing     │
│  commit.                                           │
└────────────────────────────────────────────────────┘
```

### 1.3 jj squash — Merging Changes

```bash
# Merge working copy changes into the parent commit
$ jj squash
# → All working copy changes are moved to the parent commit
# → The working copy becomes empty

# Set a message at the same time
$ jj squash -m "feat: completed auth feature"
# → Sets a message on the merged commit

# Merge only specific files into the parent commit
$ jj squash --keep src/auth.js
# → Only src/auth.js changes are moved to the parent; others remain in the working copy

# Squash into a specific commit
$ jj squash --from rlvkpntz --into qpvuntsm
# → Merges changes from rlvkpntz into qpvuntsm

# Partial squash by specifying paths
$ jj squash src/auth.js src/middleware.js
# → Only the specified files' changes are moved to the parent

# Interactively select what to squash
$ jj squash -i
# → Opens the diff-editor to select which changes to squash
```

```
┌────────────────────────────────────────────────────┐
│  jj squash operation patterns                       │
│                                                    │
│  Pattern 1: Merge all changes into parent           │
│  Before:              After:                       │
│  @  B (changes)       @  B (empty)                 │
│  ○  A                 ○  A' (A + B's changes)      │
│                                                    │
│  Pattern 2: Merge only specific files               │
│  Before:              After:                       │
│  @  B (a.js, b.js)    @  B' (b.js only)            │
│  ○  A                 ○  A' (A + a.js changes)     │
│                                                    │
│  Pattern 3: Merge between arbitrary commits         │
│  Before:              After:                       │
│  ○  C                 ○  C' (auto-rebased)          │
│  ○  B (target)        ○  B' (empty, abandoned)      │
│  ○  A (dest)          ○  A' (A + B's changes)      │
│                                                    │
│  $ jj squash --from B --into A                     │
└────────────────────────────────────────────────────┘
```

### 1.4 jj split — Splitting a Commit

```bash
# Interactively split working copy changes
$ jj split
# → Editor opens to select changes for the first commit
# → The remainder becomes a new commit

# Split by file
$ jj split src/auth.js src/middleware.js
# → Changes to the specified files go into the first commit
# → Changes to the remaining files go into the next commit

# Split a past commit
$ jj split -r rlvkpntz
# → Interactively splits rlvkpntz
# → Child commits are automatically rebased

# Split using a path pattern
$ jj split "src/**/*.test.js"
# → Test file changes go into the first commit
# → Everything else goes into the next commit
```

```
┌────────────────────────────────────────────────────┐
│  How jj split works                                 │
│                                                    │
│  Before:                                           │
│  @  rlvkpntz  feat: auth+UI                        │
│  │  (changes to auth.js, middleware.js, Login.jsx)  │
│  ○  qpvuntsm  ...                                  │
│                                                    │
│  $ jj split src/auth.js src/middleware.js           │
│                                                    │
│  After:                                            │
│  @  nwmqklop  (working copy, Login.jsx changes)    │
│  ○  rlvkpntz  feat: auth+UI                        │
│  │  (auth.js, middleware.js changes only)           │
│  ○  qpvuntsm  ...                                  │
│                                                    │
│  After splitting, update each commit's message:    │
│  $ jj describe -r rlvkpntz -m "feat: auth logic"  │
│  $ jj describe -m "feat: login UI"                 │
└────────────────────────────────────────────────────┘
```

### 1.5 jj move — Moving Changes (Deprecated, Use squash Instead)

```bash
# Note: jj move is an older command replaced by jj squash --from --into
# Kept for compatibility, but using squash is recommended

# Old: jj move --from A --to B
# New: jj squash --from A --into B

# Example (replaced with squash)
$ jj squash --from rlvkpntz --into qpvuntsm
# → Moves changes from rlvkpntz to qpvuntsm
```

### 1.6 jj diffedit — Directly Edit Commit Contents with a Diff Editor

```bash
# Edit working copy changes with the diff editor
$ jj diffedit
# → Opens the diff-editor to add or remove changes

# Edit a past commit with the diff editor
$ jj diffedit -r rlvkpntz
# → Directly edit the contents of rlvkpntz in the diff editor
# → Child commits are automatically rebased

# Edit only specific files
$ jj diffedit -r rlvkpntz src/auth.js
```

---

## 2. Automatic Rebase

### 2.1 How Automatic Rebase Works

One of Jujutsu's most powerful features. **When a parent commit changes, child commits and beyond are automatically rebased**.

```bash
# Three commits stacked
$ jj log
@  ccc  feat: UI implementation
○  bbb  feat: API endpoint
○  aaa  feat: initial setup
◆  root()

# Directly edit an intermediate commit
$ jj edit bbb
$ vim src/api.js
$ jj new  # Finalize the edit and move to a new working copy

# → ccc is automatically rebased!
$ jj log
@  ddd  (empty)
○  ccc' feat: UI implementation    ← auto-rebased (SHA changed)
○  bbb' feat: API endpoint         ← edited
○  aaa  feat: initial setup
◆  root()
```

```
┌─────────────────────────────────────────────────────┐
│  Automatic rebase diagram                            │
│                                                     │
│  Doing the same thing in Git:                        │
│  1. Use git rebase -i to set the target commit to edit │
│  2. Make the modification                            │
│  3. git commit --amend                              │
│  4. git rebase --continue                           │
│  5. Resolve conflicts at each commit if any         │
│  → 5 steps + conflict resolution                    │
│                                                     │
│  Doing the same thing in Jujutsu:                   │
│  1. jj edit bbb                                     │
│  2. Make the modification                            │
│  → 2 steps, automatic rebase                        │
│  → Conflicts are recorded in commits (can resolve later) │
└─────────────────────────────────────────────────────┘
```

### 2.2 Cascading Automatic Rebase

```bash
# All child commits are also automatically rebased when there are multiple
$ jj log --no-graph
aaa  feat: foundation
├── bbb  feat: auth
│   └── ccc  feat: auth tests
└── ddd  feat: UI
    └── eee  feat: UI tests

# Editing aaa automatically rebases bbb, ccc, ddd, and eee
$ jj edit aaa
$ vim src/base.js
# → All 5 child commits are rebased on top of the new aaa'
```

### 2.3 Automatic Rebase and Conflicts

```bash
# When a conflict occurs during automatic rebase
$ jj edit aaa
$ vim src/shared.js   # Edit a file that is also changed in bbb

$ jj log
○  ccc' feat: auth tests
○  bbb' feat: auth          conflict    ← conflict occurred
○  aaa' feat: foundation    ← edited

# The conflict is recorded, but the rebase is complete
# Move to bbb' and resolve the conflict
$ jj edit bbb'
$ vim src/shared.js   # Resolve the conflict markers

# After resolving the conflict, ccc' is also automatically rebased
$ jj log
○  ccc'' feat: auth tests    ← re-rebased
○  bbb'' feat: auth           ← conflict resolved
○  aaa'  feat: foundation
```

### 2.4 Cases Where Automatic Rebase Does Not Occur

```
┌────────────────────────────────────────────────────┐
│  Cases where automatic rebase does not occur        │
│                                                    │
│  1. Children of immutable commits are not          │
│     automatically rebased                          │
│     → Commits before trunk() or tags()             │
│                                                    │
│  2. Children of abandoned commits are connected    │
│     to the parent's parent                         │
│     → "Reconnection" rather than rebase            │
│                                                    │
│  3. Working copies of other workspaces are not     │
│     affected                                       │
│     → Workspaces are independent                   │
│                                                    │
│  4. With jj rebase -r (single commit)              │
│     → Only the specified commit is moved;          │
│       children remain at their original position   │
│     → Different behavior from -s (subtree)         │
└────────────────────────────────────────────────────┘
```

---

## 3. Bookmarks (Formerly Branches)

### 3.1 Bookmark Basics

```bash
# Create a bookmark (equivalent to Git branch)
$ jj bookmark create feature-auth -r @
# → Sets the "feature-auth" bookmark on the current working copy commit

# List bookmarks
$ jj bookmark list
feature-auth: rlvkpntz abc12345
main: qpvuntsm def67890

# Show all bookmarks (including remote)
$ jj bookmark list --all
feature-auth: rlvkpntz abc12345
main: qpvuntsm def67890
main@origin: qpvuntsm def67890

# Move a bookmark
$ jj bookmark set feature-auth -r @

# Delete a bookmark
$ jj bookmark delete feature-auth

# Track a remote bookmark
$ jj bookmark track main@origin

# Rename a bookmark
$ jj bookmark rename old-name new-name

# Stop tracking a bookmark
$ jj bookmark untrack feature@origin
```

### 3.2 Branchless Development Workflow

```bash
# In Jujutsu, you can develop without naming branches
$ jj new main          # Create a new commit on top of main
$ vim src/feature.js
$ jj describe -m "feat: prototype of new feature"

# When you want to work on something else
$ jj new main          # Create another commit on top of main
$ vim src/hotfix.js
$ jj describe -m "fix: urgent bug fix"

# Check the log
$ jj log
○  xxx  fix: urgent bug fix
│ ○  yyy  feat: prototype of new feature
├─┘
◆  main  ...
```

```
┌────────────────────────────────────────────────────┐
│  Advantages of branchless development               │
│                                                    │
│  Git:                                              │
│  $ git checkout -b feature/auth   # create branch  │
│  $ ... work ...                                    │
│  $ git checkout -b hotfix/bug     # another branch │
│  $ ... work ...                                    │
│  $ git checkout feature/auth      # switch back    │
│  → Branch switching is cumbersome                  │
│  → stash required if there are uncommitted changes │
│                                                    │
│  Jujutsu:                                          │
│  $ jj new main                    # new commit     │
│  $ ... work ...                                    │
│  $ jj new main                    # another commit │
│  $ ... work ...                                    │
│  $ jj edit <change-id>            # move anywhere  │
│  → No stash needed since everything is a commit    │
│  → No branch name management required              │
│  → Only set bookmarks when pushing                 │
└────────────────────────────────────────────────────┘
```

### 3.3 Bookmarks and Push

```bash
# Cannot push without a bookmark
$ jj git push
# Nothing to push

# A bookmark is required to push
# Method 1: Explicitly create a bookmark and push
$ jj bookmark create feature-auth -r @
$ jj git push --bookmark feature-auth --allow-new

# Method 2: Auto-bookmark with the --change option
$ jj git push --change @
# → A bookmark name is automatically generated from the change ID
# → e.g., a branch name like "push-rlvkpntzqwop"

# Method 3: Push multiple bookmarks at once
$ jj git push --bookmark feature-auth --bookmark feature-ui

# Check push status of bookmarks
$ jj bookmark list --all
feature-auth: rlvkpntz abc12345
  @origin: rlvkpntz abc12345    ← synced with remote
feature-ui: qpvuntsm def67890
  @origin (behind): rlvkpntz old12345  ← local is ahead
```

### 3.4 Automatic Bookmark Updates

```bash
# When you edit a commit that has a bookmark set,
# the bookmark automatically tracks the new commit ID

$ jj log
@  rlvkpntz  feature-auth  feat: auth feature
○  main ...

$ jj edit rlvkpntz    # Edit the feature-auth commit
$ vim src/auth.js     # Modify the file

# The bookmark automatically tracks the new commit
$ jj bookmark list
feature-auth: rlvkpntz abc12345   ← change ID is the same
# → The commit ID changes, but the change ID does not
# → Bookmarks are tracked via the change ID
```

---

## 4. Reordering and Inserting Commits

### 4.1 jj rebase — Moving Commits

```bash
# Change the parent of a single commit (child commits remain at their original position)
$ jj rebase -r rlvkpntz -d main
# → Only rlvkpntz is moved to be a child of main
# → The original child commits of rlvkpntz are connected to rlvkpntz's parent

# Move a commit and all its descendants
$ jj rebase -s rlvkpntz -d main
# → Moves all commits from rlvkpntz onward to be on top of main

# Rebase using a range (up to the branch tip)
$ jj rebase -b feature-auth -d main
# → Moves commits up to the feature-auth bookmark on top of main

# Specify multiple parents (rebase involving merge commit creation)
$ jj rebase -r rlvkpntz -d main -d feature-other
# → rlvkpntz will have both main and feature-other as parents
```

```
┌────────────────────────────────────────────────────┐
│  Three modes of jj rebase                           │
│                                                    │
│  -r (revision): Move only a single commit          │
│  Before:          After:                           │
│  ○  C             ○  C' (connected to A)           │
│  ○  B             │ ○  B' (moved to child of main) │
│  ○  A             ○  A                             │
│  ◆  main          ◆  main                          │
│  $ jj rebase -r B -d main                          │
│                                                    │
│  -s (source): Move commit and its descendants      │
│  Before:          After:                           │
│  ○  C             ○  C' (child of B')              │
│  ○  B             ○  B' (moved to child of main)   │
│  ○  A             ○  A                             │
│  ◆  main          ◆  main                          │
│  $ jj rebase -s B -d main                          │
│                                                    │
│  -b (branch): Move from branch root to tip         │
│  Before:          After:                           │
│  ○  C             ○  C'                            │
│  ○  B             ○  B'                            │
│  ○  A             ○  A' (moved to child of main)   │
│  ◆  main          ◆  main                          │
│  $ jj rebase -b C -d main                          │
└────────────────────────────────────────────────────┘
```

### 4.2 Inserting Between Commits

```bash
# Insert a new commit between two existing commits
$ jj new --after aaa --before bbb
# → A new commit is inserted between aaa and bbb
# → bbb and beyond are automatically rebased

# Result:
# ○  bbb'  feat: API      ← auto-rebased
# ○  new   (working copy)  ← inserted new commit
# ○  aaa   feat: initial setup
```

```
┌────────────────────────────────────────────────────┐
│  Commit insertion diagram                           │
│                                                    │
│  Before:             After:                        │
│  ○  bbb             ○  bbb' (auto-rebased)         │
│  ○  aaa             @  new  (inserted)             │
│                      ○  aaa                        │
│                                                    │
│  Doing the same thing in Git:                      │
│  1. git rebase -i to set commits after aaa to edit │
│  2. Stop after aaa                                 │
│  3. Create a new commit                            │
│  4. git rebase --continue                          │
│  → Very tedious                                    │
└────────────────────────────────────────────────────┘
```

### 4.3 Reordering Commits

```bash
# Swap the order of two commits
# Before:
# ○  B  feat: UI
# ○  A  feat: auth

# Move A on top of B
$ jj rebase -r A -d B
# → A is moved on top of B

# After:
# ○  A' feat: auth
# ○  B  feat: UI

# More complex reordering (change order of 3 commits)
# Before: C → B → A → main
# Goal:   A → C → B → main

$ jj rebase -r A -d main     # First, move A directly above main
$ jj rebase -s B -d A        # Move B and onwards on top of A
# → Results in A → B → C → main
# Then
$ jj rebase -r C -d A        # Move C directly above A (insert before B)
# → Results in A → C' → B' → main
```

---

## 5. Managing Concurrent Work

### 5.1 Advancing Multiple Tasks Simultaneously

```bash
# Task 1: Auth feature
$ jj new main
$ jj describe -m "feat: auth feature"
$ vim src/auth.js

# Task 2: UI on top of auth feature
$ jj new
$ jj describe -m "feat: login UI"
$ vim src/Login.jsx

# Task 3: Start separate work from main (independent of auth)
$ jj new main
$ jj describe -m "fix: performance improvement"
$ vim src/perf.js

# List all tasks
$ jj log -r 'heads(all())'

# Switch between tasks
$ jj edit rlvkpntz    # Go back to auth feature work
$ jj edit qpvuntsm    # Switch to performance improvement work
```

### 5.2 Converging Work (Merge)

```bash
# Merge two tasks
$ jj new feature-auth perf-fix
$ jj describe -m "merge: integrate auth and performance improvement"

# Or converge by rebasing a specific commit
$ jj rebase -r perf-fix -d feature-auth
```

### 5.3 Parallel Work Using Workspaces

```bash
# Workspaces allow handling a single repository in multiple directories
# Each workspace has an independent working copy

# Create a new workspace
$ jj workspace add ../my-project-hotfix
# → A new workspace is created at ../my-project-hotfix/
# → Shares the same repository but has an independent working copy

# List workspaces
$ jj workspace list
default: rlvkpntz abc12345
hotfix: qpvuntsm def67890

# Work in the hotfix workspace
$ cd ../my-project-hotfix
$ jj new main
$ vim src/fix.js
$ jj describe -m "fix: emergency fix"

# Return to the original workspace
$ cd ../my-project
$ jj log  # Changes from hotfix are also visible

# Delete a workspace
$ jj workspace forget hotfix
```

```
┌────────────────────────────────────────────────────┐
│  Advantages of workspaces                           │
│                                                    │
│  Similar to Git worktree, but differs in:          │
│                                                    │
│  1. Commits are automatically shared between       │
│     workspaces                                     │
│  2. Rebases in one workspace are reflected in      │
│     others                                         │
│  3. The Operation Log is shared across the entire  │
│     repository                                     │
│                                                    │
│  Typical use cases:                                │
│  - Main development work + hotfix work             │
│  - Separate directory for build verification       │
│  - Isolated environment for CI/CD                  │
└────────────────────────────────────────────────────┘
```

### 5.4 Patterns for Managing Independent Changes

```bash
# Pattern 1: Incremental development using feature flags
$ jj new main
$ jj describe -m "feat: feature flag foundation"
$ vim src/feature-flags.js
$ jj new
$ jj describe -m "feat: dark mode (with flag)"
$ vim src/dark-mode.js

# Pattern 2: Start next task while waiting for review
$ jj log
○  review-1  feat: auth feature  ← under review
◆  main

$ jj new review-1    # Stack on top of the commit under review
$ jj describe -m "feat: API based on auth"
$ vim src/api.js
# → When review-1 is merged and main is updated:
# → jj git fetch && jj rebase -d main@origin to update

# Pattern 3: Multiple independent fixes
$ jj new main -m "fix: header layout fix"
$ vim src/header.css

$ jj new main -m "fix: footer link fix"
$ vim src/footer.html

$ jj new main -m "docs: update README"
$ vim README.md

# Push each fix individually
$ jj git push --change rlvkpntz   # header fix
$ jj git push --change qpvuntsm   # footer fix
$ jj git push --change xtkvpqwm   # README update
```

---

## 6. abandon and restore

### 6.1 jj abandon — Discarding a Commit

```bash
# Discard a commit (content is deleted, child commits connect to parent)
$ jj abandon rlvkpntz
# → rlvkpntz is deleted, and child commits' parent is changed to rlvkpntz's parent

# Abandon multiple commits at once
$ jj abandon rlvkpntz qpvuntsm
# → Discard two commits simultaneously

# Abandon with a revset condition
$ jj abandon 'empty() & mine()'
# → Abandon all of your empty commits

# Abandon the working copy (discard changes)
$ jj abandon @
# → Discard all current working copy changes
# → A new empty working copy is created on top of the parent
```

### 6.2 jj restore — Restoring Files

```bash
# Undo an operation
$ jj undo
# → Completely undoes the previous jj command

# Restore a specific file
$ jj restore --from main src/config.js
# → Restores the contents of src/config.js from main to the working copy

# Restore multiple files from a specific revision
$ jj restore --from @- src/auth.js src/api.js
# → Restore two files from the parent commit

# Restore all files from a specific revision
$ jj restore --from main
# → Restores all working copy files to the state of main

# Restore using a path pattern
$ jj restore --from @- "src/**/*.test.js"
# → Restore only test files to the state of the parent commit
```

### 6.3 jj backout — Reversing Changes

```bash
# Create a new commit that reverses the changes of a specific commit
$ jj backout -r rlvkpntz
# → Creates a new commit that reverses the changes of rlvkpntz
# → Equivalent to Git's git revert

# Specify where to place the reversal commit
$ jj backout -r rlvkpntz -d @
# → Creates the reversal commit as a child of the working copy
```

| Operation       | Description                                                       |
|-----------------|-------------------------------------------------------------------|
| `jj abandon`    | Delete a commit; child commits reconnect to the parent            |
| `jj undo`       | Completely undo the previous jj command                           |
| `jj restore`    | Restore specific revision/file contents to the working copy       |
| `jj op restore` | Restore the entire repository to a specific operation point       |
| `jj backout`    | Create a new commit that reverses a commit's changes (git revert) |

---

## 7. Practical Workflow Patterns

### 7.1 Stacked PR Workflow

```bash
# Review and merge PRs incrementally by stacking them

# Step 1: Foundational type definitions
$ jj new main
$ vim src/types.ts
$ jj describe -m "feat: add type definitions"
$ jj bookmark create pr/types -r @

# Step 2: Auth logic using the type definitions
$ jj new
$ vim src/auth.ts
$ jj describe -m "feat: auth logic"
$ jj bookmark create pr/auth -r @

# Step 3: API endpoint using auth
$ jj new
$ vim src/api.ts
$ jj describe -m "feat: API endpoint"
$ jj bookmark create pr/api -r @

# Push each bookmark
$ jj git push --bookmark pr/types --allow-new
$ jj git push --bookmark pr/auth --allow-new
$ jj git push --bookmark pr/api --allow-new

# Update the base change (update type definitions) → everything auto-rebases
$ jj edit pr/types
$ vim src/types.ts
$ jj new    # Finalize the modification
# → pr/auth and pr/api are automatically rebased!
# → Just re-push each PR
$ jj git push --bookmark pr/types
$ jj git push --bookmark pr/auth
$ jj git push --bookmark pr/api
```

### 7.2 Review Response Workflow

```bash
# Respond to review comments

# Directly edit the commit under review
$ jj edit pr/auth
$ vim src/auth.ts    # Make changes responding to review comments
$ jj new             # Finalize the modification

# Or add modifications as a new commit and squash later
$ jj new pr/auth
$ vim src/auth.ts
$ jj describe -m "fix: review response - add error handling"
$ jj squash          # Merge the fix into pr/auth

# Re-push
$ jj git push --bookmark pr/auth
```

### 7.3 Keeping Up with main

```bash
# Rebase when main is updated

# Fetch the latest from remote
$ jj git fetch

# Rebase current work onto the latest main
$ jj rebase -d main@origin

# Rebase the entire stack
$ jj rebase -s <stack-root> -d main@origin

# When a conflict occurs
$ jj log -r 'conflict()'
# → Check which commits have conflicts
$ jj edit <conflict-commit>
$ vim <conflicting-file>
$ jj new    # Finalize the resolution
```

### 7.4 Emergency Hotfix Workflow

```bash
# When an emergency hotfix is needed during development

# Record the current state of work (not needed; everything is already committed)
$ jj log  # Check current work

# Create a hotfix from main
$ jj new main@origin
$ vim src/critical-fix.js
$ jj describe -m "fix: fix security vulnerability"

# Push immediately
$ jj bookmark create hotfix -r @
$ jj git push --bookmark hotfix --allow-new

# Return to the original work
$ jj edit <original-change-id>
# → No stash needed; context switching is instant

# After the hotfix is merged, rebase your work
$ jj git fetch
$ jj rebase -d main@origin
```

### 7.5 Separating Refactoring from Features

```bash
# When you notice the need for refactoring during development

# Refactoring and features are mixed in the current work
$ jj log
@  feature-commit  feat: new feature (includes refactoring)
○  main

# Use split to separate refactoring from feature
$ jj split src/refactored-file.js
# → 1st commit: refactoring part
# → 2nd commit: feature part

# Update messages
$ jj describe -r @- -m "refactor: improve code structure"
$ jj describe -m "feat: implement new feature"

# You can also merge refactoring into main first
$ jj bookmark create pr/refactor -r @-
$ jj git push --bookmark pr/refactor --allow-new
```

### 7.6 Splitting Large Changes into Small Commits

```bash
# Workflow for progressively splitting a large change into commits

# First put all changes in one commit
$ jj describe -m "feat: large feature addition (WIP)"

# Split by file
$ jj split src/types.ts
# → Changes to types.ts go into the 1st commit
$ jj describe -r @- -m "feat: add type definitions"

$ jj split src/auth.ts src/auth.test.ts
# → Auth-related changes go into the 1st commit
$ jj describe -r @- -m "feat: implement auth logic"

# Set the final message for the remaining changes
$ jj describe -m "feat: implement UI components"

# Result:
$ jj log
@  xxx  feat: implement UI components
○  yyy  feat: implement auth logic
○  zzz  feat: add type definitions
◆  main
```

---

## 8. Anti-patterns

### Anti-pattern 1: Continuously Putting All Changes in One Commit

```bash
# NG: Accumulate all changes in one commit without using jj new
$ vim src/auth.js
$ vim src/ui.js
$ vim src/api.js
$ jj describe -m "feat: everything included"
# → Becomes a huge single commit that is difficult to review

# OK: Separate commits by logical unit
$ vim src/auth.js
$ jj describe -m "feat: auth logic"
$ jj new
$ vim src/api.js
$ jj describe -m "feat: API endpoint"
$ jj new
$ vim src/ui.js
$ jj describe -m "feat: UI implementation"
```

**Reason**: In Jujutsu's working copy = commit model, you need to consciously use `jj new` to split changes. Partial selection equivalent to Git's `git add -p` is possible later with `jj split`.

### Anti-pattern 2: Confusing change IDs with commit IDs

```bash
# NG: Continue referencing revisions by commit ID (SHA-1)
$ jj rebase -r abc12345 -d main
# → After rebase, the SHA-1 changes and the previous ID may become invalid

# OK: Reference by change ID
$ jj rebase -r rlvkpntz -d main
# → The change ID does not change after rebase
```

**Reason**: The commit ID is a Git SHA-1 hash that depends on commit content, so it changes with rebase. The change ID is a Jujutsu-specific identifier that can be tracked even when content changes.

### Anti-pattern 3: Frequently Manually Moving Bookmarks

```bash
# NG: Manually move the bookmark every time you edit a commit
$ jj edit feature-auth
$ vim src/auth.js
$ jj new
$ jj bookmark set feature-auth -r ???  # Confused about where to set it

# OK: Set bookmarks just before push
$ jj edit rlvkpntz     # Reference by change ID
$ vim src/auth.js
$ jj new
$ jj bookmark set feature-auth -r rlvkpntz  # Set just before push
$ jj git push --bookmark feature-auth
```

**Reason**: Bookmarks are equivalent to Git branches and are mainly used for correspondence with remotes during push/fetch. Reference by change ID during daily development, and only manipulate bookmarks when a push is needed.

### Anti-pattern 4: Misusing jj edit and jj new

```bash
# NG: Using jj edit to start new work
$ jj edit main    # ← Immutable and cannot be edited; also not the intended action

# OK: Start new work with jj new
$ jj new main     # Create a new commit on top of main

# NG: Using jj new to modify a past commit
$ jj new rlvkpntz   # ← A new commit is created instead

# OK: Use jj edit to modify a past commit
$ jj edit rlvkpntz   # Directly edit that commit
```

**Reason**: `jj new` creates a new commit, and `jj edit` makes an existing commit the working copy for direct editing. You need to use them correctly according to your purpose.


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Perform validation of input data
- Implement error handling appropriately
- Also create test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Input value validation"""
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

### Exercise 2: Applied Patterns

Extend the basic implementation to add the following functionality.

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

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All applied tests passed!")

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
- Be aware of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Check the path and format of the config file |
| Timeout | Network delay / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use log output or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
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
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check the state of the connection pool

| Problem type | Diagnostic tool | Solution |
|-------------|-----------------|---------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Here is a summary of criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|-----------|-------------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed users |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                    │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to ②               │
│                                                 │
│  ② Deployment frequency?                         │
│    ├─ Weekly or less → Monolith + module split   │
│    └─ Daily/multiple times → Go to ③             │
│                                                 │
│  ③ Independence between teams?                   │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A method that is fast in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies allows best-fit solutions but increases operational costs

**3. Level of abstraction**
- High abstraction has high reusability but can make debugging difficult
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
        """Describe the background and issue"""
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

## Real-world Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests for the critical path only
- Introduce monitoring early

**Lessons learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually revamp a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If there are no existing tests, write Characterization Tests first
- Use an API gateway to coexist old and new systems
- Perform data migration incrementally

| Phase | Tasks | Estimated duration | Risk |
|-------|-------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Retire the old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** More than 50 engineers developing the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Set ownership per team
- Manage shared libraries using Inner Source
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

**Situation:** A system requiring millisecond-level response times

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization method | Effect | Implementation cost | Application |
|--------------------|--------|---------------------|-------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Asynchronous processing | Medium | Medium | Processing with many I/O waits |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |
---

## 9. FAQ

### Q1. What is the difference between `jj new` and `jj commit`?

**A1.** `jj commit` is almost the same as `jj new`, but is a shortcut that **simultaneously inputs the commit message**.

```bash
# The following are equivalent operations
$ jj describe -m "feat: new feature" && jj new
$ jj commit -m "feat: new feature"
```

`jj commit` is a convenience command for those migrating from Git, and internally performs the same action as "describe then new".

### Q2. What happens when a conflict occurs during automatic rebase?

**A2.** Conflicts are recorded in the commit. **The rebase is not interrupted**. Commits with conflicts are shown with a `conflict` mark in `jj log`. You can move to that commit with `jj edit` and resolve the conflict by editing the file. You can also defer resolution if it's not urgent.

### Q3. What is the equivalent of stash in Jujutsu?

**A3.** Stash is **unnecessary** in Jujutsu. Since all changes are saved as commits, if you want to move to another task, do the following:

```bash
# Stash-equivalent operation in Jujutsu
$ jj new main       # Create a new commit on top of main and start working
# → Changes in the previous working copy remain as a finalized commit
# → When you want to go back, use jj edit <change-id> to return instantly
```

### Q4. How do you use jj squash and jj edit differently?

**A4.** Use them as follows:

```bash
# jj edit: When you want to directly modify a past commit
# → Directly changes the commit's content
# → Edit files to change that commit itself
$ jj edit rlvkpntz
$ vim src/auth.js    # Modify the commit's content
$ jj new

# jj squash: When you want to merge working copy changes into the parent commit
# → Consolidates current work into the immediately preceding commit
$ vim src/auth.js    # Work in the working copy
$ jj squash          # Merge changes into the parent commit

# jj squash --from --into: Merge between any two commits
$ jj squash --from bbb --into aaa
```

### Q5. What are workspaces? Are they the same as Git worktree?

**A5.** Workspaces are similar to Git worktree but are designed based on Jujutsu's model.

```bash
# Key differences with workspaces
# - Git worktree: each worktree has an independent branch
# - jj workspace: shares the entire repository state; each workspace has an independent working copy

# Creating a workspace
$ jj workspace add ../my-project-test
# → A new directory referencing the same repository is created

# Operations between workspaces
# Changes made in workspace-1 are also visible in jj log from workspace-2
```

### Q6. What is the difference between jj rebase -r, -s, and -b?

**A6.**

| Option | Target to move       | How child commits are handled             |
|--------|----------------------|-------------------------------------------|
| `-r`   | Specified commit only | Children connect to the specified commit's parent |
| `-s`   | Specified commit + all descendants | Descendants move together  |
| `-b`   | From root to specified commit | The entire range moves             |

```bash
# -r: Move only a single commit
$ jj rebase -r B -d main
# Only B moves to be a child of main. B's original children connect to B's parent

# -s: Move the entire subtree
$ jj rebase -s B -d main
# B and all its descendants move under main

# -b: From branch root to tip
$ jj rebase -b tip -d main
# All commits up to tip move under main
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Concept          | Key Point                                                        |
|------------------|------------------------------------------------------------------|
| jj new           | Start a new commit, finalize previous changes                    |
| jj edit          | Directly edit a past commit; children are auto-rebased           |
| jj squash        | Merge working copy changes into the parent commit                |
| jj split         | Split one commit into multiple                                   |
| jj rebase        | Change a commit's parent; children are auto-rebased              |
| jj diffedit      | Directly edit commit contents with a diff editor                 |
| Auto-rebase      | When a parent commit changes, child commits are automatically rebased |
| Bookmarks        | Equivalent to Git branches; required for push                    |
| jj abandon       | Discard a commit; child commits reconnect to the parent          |
| jj backout       | Reverse a commit's changes (equivalent to git revert)            |
| Workspaces       | Multiple working copies of the same repository                   |

---

## What to Read Next

- [Jujutsu Advanced](./02-jujutsu-advanced.md) — Advanced usage of revsets, templates, and Git integration
- [Git→Jujutsu Migration](./03-git-to-jujutsu.md) — Operation mapping table and migration guide
- [Jujutsu Introduction](./00-jujutsu-introduction.md) — Review of basic concepts

---

## References

1. **Jujutsu Official Documentation** — "Tutorial" https://martinvonz.github.io/jj/latest/tutorial/
2. **Jujutsu GitHub Repository** — "Working Copy" https://github.com/martinvonz/jj/blob/main/docs/working-copy.md
3. **Chris Krycho** — "jj init: Jujutsu tips and tricks" https://v5.chriskrycho.com/essays/jj-init/
4. **Austin Seipp** — "Stacked PRs with Jujutsu" https://austinseipp.com/posts/2024-07-10-jj-hierarchies
5. **Jujutsu Official Documentation** — "Workspaces" https://martinvonz.github.io/jj/latest/working-copy/#workspaces
