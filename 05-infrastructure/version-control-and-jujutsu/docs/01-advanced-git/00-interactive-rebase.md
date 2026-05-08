# Interactive Rebase

> Techniques and operational rules for mastering `git rebase -i` to safely clean up commit history (squash, fixup, reword, edit, drop).

## What You Will Learn

1. **Basic Interactive Rebase Operations** -- How each command works (pick, squash, fixup, reword, edit, drop) and when to use each
2. **Safe Commit History Rewriting** -- Efficient workflows with autosquash, fixup commits, and `--update-refs`
3. **Recovery from Problems** -- Handling conflicts during rebase, `--abort`, and rescue via reflog
4. **Advanced Rebase Techniques** -- `--rebase-merges`, the `exec` command, and stacked branch workflows
5. **Team Rebase Guidelines** -- Safe force-push rules and history cleanup flow before review


## Prerequisites

Before reading this guide, the following background knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Interactive Rebase Basics

### 1.1 How to Launch

```bash
# Target the last N commits
$ git rebase -i HEAD~5

# Target all commits after a specific commit
$ git rebase -i abc123

# Target everything from the root commit
$ git rebase -i --root

# Target from the divergence point with the upstream branch
$ git rebase -i main

# Explicitly specify the upstream..HEAD range
$ git rebase -i --onto main feature-base feature-branch
```

### 1.2 Editor Configuration

The editor opened during rebase is controlled by Git settings.

```bash
# Configure the editor
$ git config --global core.editor "vim"
$ git config --global core.editor "code --wait"
$ git config --global core.editor "nano"

# Can also be specified via environment variable (priority: GIT_SEQUENCE_EDITOR > GIT_EDITOR > core.editor)
$ export GIT_SEQUENCE_EDITOR="vim"

# Use a different editor only when editing the todo list
$ GIT_SEQUENCE_EDITOR="code --wait" git rebase -i HEAD~5
# → todo list is edited in VS Code, reword message editing uses vim etc.
```

### 1.3 Todo List Structure

```bash
$ git rebase -i HEAD~4
# The editor opens showing a todo list like this:

pick a1b2c3d feat: basic user authentication implementation
pick d4e5f6a fix: fix password validation
pick b7c8d9e feat: implement login screen UI
pick e0f1a2b fix: typo in login form

# Rebase abc123..e0f1a2b onto abc123 (4 commands)
#
# Commands:
# p, pick   = use commit as-is
# r, reword = use commit, but edit the message
# e, edit   = use commit, but stop for modification
# s, squash = merge into previous commit (messages combined)
# f, fixup  = like squash, but discard this commit's message
# x, exec   = run a shell command
# b, break  = stop here (resume later with git rebase --continue)
# d, drop   = remove the commit
# l, label  = label the current HEAD
# t, reset  = reset HEAD to a label
# m, merge  = create a merge commit
```

```
┌─────────────────────────────────────────────────────┐
│  Todo list execution order                           │
│                                                     │
│  * Applied top to bottom (oldest → newest)          │
│                                                     │
│  pick a1b2c3d  ──→ applied 1st                      │
│  pick d4e5f6a  ──→ applied 2nd                      │
│  pick b7c8d9e  ──→ applied 3rd                      │
│  pick e0f1a2b  ──→ applied 4th                      │
│                                                     │
│  Swapping lines = changing commit order              │
│  Deleting a line = deleting a commit (same as drop)  │
└─────────────────────────────────────────────────────┘
```

### 1.4 Internal Rebase Behavior

Rebase executes the following steps internally. Understanding this makes it easier to handle problems when they arise.

```
┌──────────────────────────────────────────────────────┐
│  Internal rebase flow                                 │
│                                                      │
│  1. Save current HEAD to ORIG_HEAD                   │
│  2. Move HEAD to onto (rebase target)                │
│  3. Process the todo list from top to bottom         │
│     ├── pick: apply via cherry-pick                  │
│     ├── squash/fixup: merge into previous commit     │
│     ├── reword: edit message after cherry-pick       │
│     ├── edit: stop after cherry-pick                 │
│     └── drop: skip (do nothing)                      │
│  4. Update branch pointer when all done              │
│                                                      │
│  * Stops if a conflict occurs at any step            │
│  * State (todo list, etc.) is saved in .git/rebase-merge/ │
└──────────────────────────────────────────────────────┘
```

```bash
# Check the internal state during rebase
$ ls .git/rebase-merge/
git-rebase-todo       # remaining todo list
done                  # completed commands
head-name             # branch name at rebase start
onto                  # target commit for rebase
orig-head             # HEAD at rebase start
interactive           # flag for interactive mode
```

---

## 2. Detailed Command Reference

### 2.1 squash -- Merge Commits (with Message Editing)

```bash
# Before: 4 small commits
pick a1b2c3d feat: create authentication skeleton
squash d4e5f6a feat: implement password hashing
squash b7c8d9e feat: add login endpoint
squash e0f1a2b feat: implement authentication middleware

# → The editor opens showing all 4 commit messages
# → Edit and save the merged message
```

Example of the message editing screen during squash:

```
# This is a combination of 4 commits.
# This is the 1st commit message:

feat: create authentication skeleton

- create auth.js scaffold
- configure routing

# This is the commit message #2:

feat: implement password hashing

- introduce bcrypt
- add hash/verify functions

# This is the commit message #3:

feat: add login endpoint

# This is the commit message #4:

feat: implement authentication middleware

# ↑ Edit these to create a combined message like:

feat: implement user authentication

- create authentication logic skeleton
- password hashing with bcrypt
- login endpoint (/api/login)
- JWT authentication middleware
```

```
Before:                        After:
a1b2c3d feat: skeleton         xyz789 feat: implement user authentication
d4e5f6a feat: hashing            (4 commits merged into 1)
b7c8d9e feat: endpoint
e0f1a2b feat: middleware
```

### 2.2 fixup -- Merge Commits (Discard Message)

```bash
pick a1b2c3d feat: implement user authentication
fixup d4e5f6a fix: fix tests
fixup b7c8d9e fix: fix lint errors

# → The contents of d4e5f6a and b7c8d9e are merged into a1b2c3d,
#   but only a1b2c3d's commit message is retained
```

#### fixup -C Option (Git 2.32+)

```bash
# fixup -C: fixup but use the "fixup commit's" message
pick a1b2c3d feat: authentication (placeholder message)
fixup -C d4e5f6a feat: fully implement user authentication

# → Changes are merged, but d4e5f6a's message is used
# → Useful when you want to improve the message later

# fixup -c: same as fixup -C but also opens editor for message editing
pick a1b2c3d feat: authentication (draft)
fixup -c d4e5f6a feat: improved message
# → Editor opens, allowing editing based on d4e5f6a's message
```

### 2.3 reword -- Change Message Only

```bash
reword a1b2c3d feat: auht functon   # typo!
pick d4e5f6a fix: bug fix

# → Editor opens allowing you to edit only a1b2c3d's message
# → File contents are not changed
```

#### Practical Use Cases for reword

```bash
# Use case 1: Fix Conventional Commits
reword a1b2c3d update: login screen   # ← invalid type
# → Fix to "feat: implement login screen UI"

# Use case 2: Add ticket number
reword d4e5f6a fix: fix memory leak
# → Fix to "fix(JIRA-1234): fix memory leak"

# Use case 3: Batch fix multiple commit messages
reword a1b2c3d feat: feature A
reword d4e5f6a feat: feature B
reword b7c8d9e feat: feature C
# → Edit the 3 commit messages one by one
```

### 2.4 edit -- Stop to Modify a Commit

```bash
pick a1b2c3d feat: authentication
edit d4e5f6a feat: API implementation    # ← stops here
pick b7c8d9e feat: UI implementation

# After running rebase, stops at d4e5f6a
$ vim src/api.js              # modify file
$ git add src/api.js
$ git commit --amend          # amend the commit
$ git rebase --continue       # resume rebase
```

#### Inserting Additional Commits with edit

```bash
# After stopping with edit, you can also insert new commits
$ git rebase -i HEAD~3

pick a1b2c3d feat: authentication
edit d4e5f6a feat: API implementation
pick b7c8d9e feat: UI implementation

# After stopping at d4e5f6a:
$ vim src/middleware.js
$ git add src/middleware.js
$ git commit -m "feat: add middleware"   # insert new commit
$ git rebase --continue
# → Result: a1b2c3d → d4e5f6a → [new commit] → b7c8d9e
```

### 2.5 exec -- Run Shell Commands

```bash
pick a1b2c3d feat: authentication
exec npm test                  # run tests
pick d4e5f6a feat: API implementation
exec npm test                  # run tests

# → Runs tests after each commit, stops if they fail
# → Ensures tests pass at every commit
```

#### Advanced exec Patterns

```bash
# Auto-insert exec after every commit (--exec option)
$ git rebase -i --exec "npm test" main
# → "exec npm test" is automatically inserted after each commit

# Run multiple commands
$ git rebase -i --exec "npm run build && npm test" main

# Verify build, tests, and lint all pass at each commit
pick a1b2c3d feat: authentication
exec npm run build && npm test && npm run lint
pick d4e5f6a feat: API implementation
exec npm run build && npm test && npm run lint

# When exec fails:
# → rebase stops
# → Fix and run git rebase --continue, or
# → git rebase --abort to cancel everything
```

### 2.6 break -- Pause

```bash
pick a1b2c3d feat: authentication
break                          # ← pause here
pick d4e5f6a feat: API implementation
pick b7c8d9e feat: UI implementation

# After pausing at break, you can work freely
$ git log --oneline -3         # check current state
$ git diff HEAD~1              # check diff from previous commit
$ git rebase --continue        # resume after checking
```

### 2.7 drop -- Delete a Commit

```bash
pick a1b2c3d feat: authentication
drop d4e5f6a WIP: temporary save      # ← delete this commit
pick b7c8d9e feat: API implementation

# * Same effect as deleting the line from the todo list
# * drop is safer than deleting the line as it explicitly shows intent
```

### 2.8 label / reset / merge -- Rebuilding Merge Structure

```bash
# Commands that appear when using --rebase-merges
label onto

# Branch: feature-a
reset onto
pick a1b2c3d feat: feature A
label feature-a

# Branch: feature-b
reset onto
pick d4e5f6a feat: feature B
label feature-b

# Merge
reset feature-a
merge -C e0f1a2b feature-b  # recreate the merge commit
```

---

## 3. Autosquash Workflow

### 3.1 fixup! and squash! Commits

```bash
# Normal development flow
$ git commit -m "feat: user authentication"   # a1b2c3d

# When a fix is needed later
$ git commit --fixup=a1b2c3d           # fixup! feat: user authentication
# or
$ git commit --squash=a1b2c3d          # squash! feat: user authentication

# Rebase with autosquash
$ git rebase -i --autosquash main
# → fixup!/squash! commits are automatically moved below their target commit
```

```
┌─────────────────────────────────────────────────────┐
│  autosquash automatic reordering                     │
│                                                     │
│  Commit history:                                     │
│  1. a1b2c3d feat: user authentication               │
│  2. d4e5f6a feat: API implementation                │
│  3. b7c8d9e fixup! feat: user authentication        │
│  4. e0f1a2b feat: UI implementation                 │
│                                                     │
│  Todo list after git rebase -i --autosquash:        │
│  pick   a1b2c3d feat: user authentication           │
│  fixup  b7c8d9e fixup! feat: user authentication ← moved! │
│  pick   d4e5f6a feat: API implementation            │
│  pick   e0f1a2b feat: UI implementation             │
└─────────────────────────────────────────────────────┘
```

### 3.2 Enabling autosquash by Default

```bash
# Enable autosquash globally
$ git config --global rebase.autosquash true

# Disable autosquash for a specific run
$ git rebase -i --no-autosquash main
```

### 3.3 --fixup=amend: and --fixup=reword: (Git 2.32+)

```bash
# --fixup=amend: change code and message at the same time
$ git commit --fixup=amend:a1b2c3d
# → Creates a commit named "amend! feat: user authentication"
# → During autosquash, merges code changes and opens message editor

# --fixup=reword: change message only (no code changes)
$ git commit --allow-empty --fixup=reword:a1b2c3d
# → During autosquash, opens message editor (no code changes)
```

### 3.4 Practice: The Full fixup Workflow

```bash
# Step 1: Implement feature and commit
$ git commit -m "feat: user profile screen"

# Step 2: Receive code review feedback
# "Validation is insufficient" → fix it
$ vim src/profile.js
$ git add src/profile.js
$ git log --oneline -5  # check SHA-1 of target commit
# a1b2c3d feat: user profile screen
$ git commit --fixup=a1b2c3d

# Step 3: More feedback
# "Please add error handling" → fix it
$ vim src/profile.js
$ git add src/profile.js
$ git commit --fixup=a1b2c3d

# Step 4: Review complete, clean up commits
$ git rebase -i --autosquash main
# → fixup! commits are automatically placed right below a1b2c3d
# → Save and close the editor to merge the 3 commits into 1

# Step 5: Update PR with force-push
$ git push --force-with-lease origin feature/profile
```

---

## 4. --update-refs (Git 2.38+)

When multiple branches are stacked, rebase can update all refs simultaneously.

```bash
# Stacked branch layout
# main → feature/base → feature/api → feature/ui

$ git rebase -i --update-refs main
# → refs for feature/base and feature/api are also automatically updated
```

```
┌────────────────────────────────────────────────────┐
│  Without --update-refs                              │
│                                                    │
│  Before rebase:                                    │
│  main ── A ── B(feature/base) ── C ── D(feature/api)│
│                                                    │
│  After rebase (feature/api only):                  │
│  main ── A ── B(feature/base) ── C ── D            │
│            \                                       │
│             B'── C'── D'(feature/api)              │
│  → feature/base remains at the old position!        │
│                                                    │
├────────────────────────────────────────────────────┤
│  With --update-refs                                 │
│                                                    │
│  After rebase:                                     │
│  main ── A ── B'(feature/base) ── C'── D'(feature/api)│
│  → All refs are correctly updated                   │
└────────────────────────────────────────────────────┘
```

```bash
# Enable by default
$ git config --global rebase.updateRefs true
```

### 4.1 Practical Stacked Branch Workflow

```bash
# Step 1: Branch for base feature
$ git checkout -b feature/auth main
# ... implement ...
$ git commit -m "feat: authentication foundation"

# Step 2: Stack API feature on top of authentication
$ git checkout -b feature/api feature/auth
# ... implement ...
$ git commit -m "feat: API implementation"

# Step 3: Stack UI feature on top of API
$ git checkout -b feature/ui feature/api
# ... implement ...
$ git commit -m "feat: UI implementation"

# Step 4: Rebase because main has advanced
$ git checkout feature/ui
$ git rebase -i --update-refs main
# → Pointers for feature/auth and feature/api are also automatically updated

# Step 5: Each branch PR shows correct diff
$ git log --oneline main..feature/auth    # auth only
$ git log --oneline feature/auth..feature/api  # API only
$ git log --oneline feature/api..feature/ui    # UI only
```

### 4.2 update-ref in the Todo List

When using `--update-refs`, `update-ref` commands are automatically inserted into the todo list.

```bash
pick a1b2c3d feat: authentication foundation
update-ref refs/heads/feature/auth    # ← update branch pointer here
pick d4e5f6a feat: API implementation
update-ref refs/heads/feature/api     # ← update branch pointer here
pick b7c8d9e feat: UI implementation

# Deleting an update-ref line means that branch won't be updated
# You can also move the update-ref position
```

---

## 5. Preserving Merge Structure with --rebase-merges

### 5.1 Basic Usage

```bash
# Rebase a range that includes merge commits
$ git rebase -i --rebase-merges main

# Example todo list:
label onto

# Branch: feature-auth
reset onto
pick a1b2c3d feat: authentication foundation
pick d4e5f6a feat: login screen
label feature-auth

# Branch: feature-api
reset onto
pick b7c8d9e feat: API foundation
pick e0f1a2b feat: endpoints
label feature-api

reset feature-auth
merge -C f2a3b4c feature-api  # merge feature-api
pick 1234567 feat: integration tests
```

### 5.2 Editing the Merge Structure

```bash
# Change merge strategy
reset feature-auth
merge -C f2a3b4c feature-api   # normal merge

# ↓ Explicitly specify --no-ff
reset feature-auth
merge -C f2a3b4c --no-ff feature-api

# Change the merge commit message
reset feature-auth
merge -c f2a3b4c feature-api   # -c (lowercase) opens message editor
```

### 5.3 The Deprecated Predecessor of --rebase-merges

```bash
# Old option (deprecated, removed in Git 2.22)
$ git rebase -i --preserve-merges main  # ← do not use

# New option (Git 2.18+, recommended)
$ git rebase -i --rebase-merges main
```

---

## 6. Practical Workflow Examples

### 6.1 Cleaning Up Commits for a PR

```bash
# Messy commit history during development
$ git log --oneline main..HEAD
e0f1a2b fix: lint
b7c8d9e wip
d4e5f6a fix: typo
a1b2c3d feat: user registration
9876543 feat: email sending
1234567 feat: validation

# Todo list to clean up
$ git rebase -i main

pick 1234567 feat: validation
pick 9876543 feat: email sending
pick a1b2c3d feat: user registration
fixup d4e5f6a fix: typo            # merge typo fix into user registration
fixup b7c8d9e wip                  # merge wip into user registration too
fixup e0f1a2b fix: lint            # merge lint fix into user registration too

# Result: 3 clean commits
# 1234567' feat: validation
# 9876543' feat: email sending
# xxxxxxx  feat: user registration (includes typo/wip/lint fixes)
```

### 6.2 Splitting a Commit

```bash
# Split one large commit into multiple commits
$ git rebase -i HEAD~3

edit a1b2c3d feat: auth and UI (want to split)
pick d4e5f6a feat: tests

# After stopping at a1b2c3d:
$ git reset HEAD~1                    # undo commit (keep changes)
$ git add src/auth.js src/middleware.js
$ git commit -m "feat: authentication logic"
$ git add src/components/Login.jsx
$ git commit -m "feat: login UI"
$ git rebase --continue
```

### 6.3 Reordering Commits

```bash
# Just swap lines in the todo list
$ git rebase -i HEAD~4

# Before:
pick a1b2c3d feat: add tests
pick d4e5f6a feat: implementation
pick b7c8d9e feat: type definitions

# After (move tests to the end):
pick d4e5f6a feat: implementation
pick b7c8d9e feat: type definitions
pick a1b2c3d feat: add tests

# * Reordering is a common cause of conflicts
# * Safest to do between commits with no dependencies
```

### 6.4 Distributing Commits Across Multiple PRs

```bash
# Split mixed changes in one branch into 2 PRs

# Step 1: Check current branch state
$ git log --oneline main..HEAD
e0f1a2b feat: profile screen UI
b7c8d9e feat: profile screen API
d4e5f6a feat: dashboard UI
a1b2c3d feat: dashboard API

# Step 2: Create branch for dashboard
$ git checkout -b feature/dashboard main
$ git cherry-pick a1b2c3d d4e5f6a

# Step 3: Create branch for profile
$ git checkout -b feature/profile main
$ git cherry-pick b7c8d9e e0f1a2b

# Step 4: Delete original branch
$ git branch -D feature/mixed
```

### 6.5 Verifying Tests Pass at Every Commit

```bash
# Confirm CI passes at all commits before submitting a PR
$ git rebase -i --exec "npm run build && npm test" main

# ↓ Auto-generated todo list
pick a1b2c3d feat: authentication
exec npm run build && npm test
pick d4e5f6a feat: API implementation
exec npm run build && npm test
pick b7c8d9e feat: UI implementation
exec npm run build && npm test

# If tests fail at any commit:
# → rebase stops
# → Fix with edit and then continue
```

### 6.6 Fixing Commits Containing Sensitive Information

```bash
# If you accidentally committed an API key
$ git rebase -i HEAD~5

edit a1b2c3d feat: add API integration    # ← commit containing API key
pick d4e5f6a feat: add tests

# After stopping at a1b2c3d:
$ vim .env                            # move API key to .env
$ vim src/api.js                      # modify to read from environment variable
$ echo ".env" >> .gitignore           # add to .gitignore
$ git add .gitignore src/api.js
$ git rm --cached .env 2>/dev/null    # remove .env from tracking
$ git commit --amend                  # amend the commit
$ git rebase --continue

# * If already pushed, even force-pushing may leave it in GitHub's cache
# * Always rotate (regenerate) a leaked API key
```

---

## 7. Conflict Resolution

### 7.1 Conflicts During Rebase

```bash
# When a conflict occurs
$ git rebase -i main
# CONFLICT (content): Merge conflict in src/auth.js
# error: could not apply d4e5f6a... feat: API implementation

# Check current state
$ git status
# interactive rebase in progress; onto abc123
# You are currently rebasing branch 'feature' on 'abc123'.
#   (fix conflicts and then run "git rebase --continue")
#   (use "git rebase --skip" to skip this patch)
#   (use "git rebase --abort" to cancel the rebase)
#
# Unmerged paths:
#   both modified:   src/auth.js

# Resolve the conflict
$ vim src/auth.js
# <<<<<<< HEAD
# ... content from rebase target ...
# =======
# ... content from the commit being applied ...
# >>>>>>> d4e5f6a (feat: API implementation)

# After resolving
$ git add src/auth.js
$ git rebase --continue
# → Moves on to processing the next commit
```

### 7.2 Options for Conflict Resolution

```bash
# Option 1: Resolve the conflict and continue
$ git add <resolved-files>
$ git rebase --continue

# Option 2: Skip this commit
$ git rebase --skip
# → This commit's changes will not be applied

# Option 3: Abort the entire rebase
$ git rebase --abort
# → Fully reverts to the state before rebase started

# Option 4: Accept one side's content for a specific file
$ git checkout --ours src/auth.js    # accept the rebase target (onto) content
$ git checkout --theirs src/auth.js  # accept the content from the commit being applied
$ git add src/auth.js
$ git rebase --continue
```

### 7.3 rerere -- Remembering Conflict Resolutions

```bash
# Enable rerere (reuse recorded resolution)
$ git config --global rerere.enabled true

# How it works:
# 1. Conflict occurs → resolution is recorded
# 2. Same conflict recurs → same resolution is applied automatically
# → No need to re-resolve the same conflict when redoing a rebase

# Check recorded resolutions
$ git rerere status
$ git rerere diff

# Clear records
$ git rerere forget <pathspec>
$ git rerere gc  # delete old records
```

```
┌──────────────────────────────────────────────────────┐
│  rerere operation flow                                │
│                                                      │
│  First rebase:                                       │
│  Conflict occurs → manually resolve → rerere records it │
│                                                      │
│  Second rebase (when redoing):                       │
│  Same conflict occurs → rerere auto-resolves it      │
│                                                      │
│  * Especially powerful in rebase → abort → fix → re-rebase cycles │
│  * Also effective when alternating between merge and rebase │
└──────────────────────────────────────────────────────┘
```

---

## 8. Recovery Techniques

### 8.1 rebase --abort

```bash
# If a problem occurs during rebase, you can abort at any time
$ git rebase --abort
# → Fully reverts to the state saved in ORIG_HEAD
# → Working directory, index, and HEAD are all restored
```

### 8.2 Rescue via reflog

```bash
# If you realize a mistake after rebase is complete
$ git reflog
abc123 HEAD@{0}: rebase (finish): returning to refs/heads/feature
def456 HEAD@{1}: rebase (squash): feat: ...
789abc HEAD@{2}: rebase (start): checkout main
fedcba HEAD@{3}: commit: feat: ...    # ← last commit before rebase

# Restore to pre-rebase state
$ git reset --hard fedcba
# → Fully reverts to pre-rebase state
```

### 8.3 Using ORIG_HEAD

```bash
# Right after a rebase, you can easily go back with ORIG_HEAD
$ git rebase -i main
# ... rebase completes ...

# "Actually, I want to undo this"
$ git reset --hard ORIG_HEAD
# → Returns to HEAD before rebase started

# * ORIG_HEAD is automatically saved before destructive operations (rebase, merge, reset)
# * Be careful: it gets overwritten by the next destructive operation
```

### 8.4 Creating a Backup Branch

```bash
# The habit of creating a backup branch before rebasing
$ git branch backup/feature-before-rebase
$ git rebase -i main
# ... work ...

# If there are problems:
$ git reset --hard backup/feature-before-rebase
$ git branch -D backup/feature-before-rebase  # delete when no longer needed
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Rebasing Already-Pushed Commits

```bash
# BAD: Rebase commits already pushed to remote
$ git push origin feature
# ... rebase later ...
$ git rebase -i HEAD~5
$ git push --force origin feature
# → Other developers will be unable to pull

# GOOD: Use force-with-lease and confirm before pushing
$ git push --force-with-lease origin feature
# → Rejects if the remote has been updated unexpectedly

# Even safer: Only rebase commits not on the remote
$ git rebase -i origin/feature  # targets only commits not in origin
```

**Reason**: Rebase changes commit SHA-1s. Changing the SHA-1 of pushed commits affects all developers tracking that branch.

### Anti-Pattern 2: Rebasing a Range That Includes Merge Commits

```bash
# BAD: Process a range including merge commits with normal rebase
$ git rebase -i HEAD~10
# → Merge commits disappear, history becomes linear

# GOOD: Use --rebase-merges to preserve merge structure
$ git rebase -i --rebase-merges HEAD~10
# → label, reset, and merge commands are added to the todo list
```

**Reason**: Normal rebase skips or linearizes merge commits. Using `--rebase-merges` allows rebasing while preserving the branching and merging structure.

### Anti-Pattern 3: Rebasing a Large Number of Commits at Once

```bash
# BAD: Interactive rebase on 100+ commits at once
$ git rebase -i HEAD~150
# → Cascading conflicts spiral out of control

# GOOD: Rebase in stages
$ git rebase -i HEAD~20    # clean up the most recent 20 first
$ git rebase -i HEAD~20    # then the next 20
# → Process in small batches

# GOOD: Split into branches by feature, then rebase
$ git rebase -i feature/base  # only changes from the base branch
```

**Reason**: Rebasing many commits at once easily causes cascading conflicts. Processing in stages minimizes risk.

### Anti-Pattern 4: Squashing Another Person's Commits into Your Own

```bash
# BAD: Squash another developer's commits into your own
pick a1b2c3d feat: Tanaka's implementation
squash d4e5f6a feat: my fix
# → Tanaka's contribution disappears from history

# GOOD: Use Co-authored-by or keep them as separate commits
pick a1b2c3d feat: Tanaka's implementation
pick d4e5f6a feat: my fix
# → Both contributions remain in history
```

**Reason**: Especially in open source, it is important to accurately record each developer's contributions. Merging someone else's commits into your own is inappropriate.

---

## 10. Performance and Git Configuration

### 10.1 Settings to Speed Up Rebase

```bash
# Set the merge backend for rebase (Git 2.33+)
$ git config --global rebase.backend merge
# → Faster than the 'apply' backend with better rename detection

# Disable stat display during rebase (useful for large repositories)
$ git config --global rebase.stat false

# Enable autostash to eliminate manual stashing
$ git config --global rebase.autostash true
```

### 10.2 Recommended Git Configuration Summary

```bash
# Recommended settings related to rebase
$ git config --global rebase.autosquash true     # auto-reorder fixup!/squash! commits
$ git config --global rebase.updateRefs true     # auto-update stacked branches
$ git config --global rebase.autostash true      # auto-stash uncommitted changes
$ git config --global rerere.enabled true        # remember conflict resolutions
$ git config --global pull.rebase true           # rebase instead of merge on pull
$ git config --global fetch.prune true           # auto-delete removed branches on fetch
```

### 10.3 Alias Configuration

```bash
# Useful aliases for rebase
$ git config --global alias.ri "rebase -i"
$ git config --global alias.rc "rebase --continue"
$ git config --global alias.ra "rebase --abort"
$ git config --global alias.rs "rebase --skip"
$ git config --global alias.rim "rebase -i main"
$ git config --global alias.fixup "commit --fixup"

# Usage examples
$ git ri HEAD~5          # interactive rebase
$ git ri main            # rebase from main
$ git fixup abc123       # create fixup commit
$ git rc                 # continue rebase
$ git ra                 # abort rebase
```

---

## 11. Rebase Practices for Team Development

### 11.1 Rebase vs. Merge Strategy

```
┌──────────────────────────────────────────────────────┐
│  Rebase strategy                                     │
│  main ── A ── B ── C ── D ── E ── F                  │
│  → Linear, easy-to-read history                      │
│  → Clear causal relationships between commits        │
│  → Efficient bisect                                  │
│                                                      │
│  Merge strategy                                      │
│  main ── A ── B ──────── M1 ──────── M2              │
│            \           /     \      /                │
│             C ── D ──/       E ── F                  │
│  → Clear view of branch divergence and merges        │
│  → Context of changes is preserved                   │
│  → Conflict resolution happens only once             │
│                                                      │
│  Recommendation: rebase for individual work, merge for team integration │
└──────────────────────────────────────────────────────┘
```

### 11.2 Commit Cleanup Rules Before PR Merge

```bash
# Rules to agree on as a team:

# Rule 1: Clean up with squash or rebase before PR merge
# → Consolidate temporary commits like WIP, fixup, typo
# → Group into logically meaningful units

# Rule 2: Rules for force-push
# → Only force-push-with-lease is allowed
# → force-push to main/develop is prohibited
# → Notify reviewers when force-pushing after review

# Rule 3: Commit message format
# → Follow Conventional Commits
# → Be consistent with language (Japanese/English)
```

### 11.3 When to Use GitHub/GitLab Squash Merge vs. Manual Rebase

```bash
# GitHub "Squash and merge" button:
# → Combines all PR commits into one and merges into main
# → Individual commit history does not remain in main
# → PR title becomes the commit message

# Manual rebase locally + normal merge:
# → Clean up commits while keeping multiple commits in main
# → Can preserve multiple logically meaningful commits
# → Allows finer-grained control

# Decision criteria:
# - Small PR (1-2 commits): Squash Merge is sufficient
# - Large PR (multiple logical changes): Clean up with manual rebase, then normal merge
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

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
        """Main data processing logic"""
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
        assert False, "Should have raised an exception"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation to add the following features.

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
    assert ex.add("d", 4) == False  # size limit
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
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check the path and format of the config file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check executing user's permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanisms, transaction management |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
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
    """Decorator to log function inputs and outputs"""
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

### Diagnosing Performance Problems

Diagnostic steps when performance problems occur:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool state

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed users |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                    │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → go to ②               │
│                                                 │
│  ② Deployment frequency?                         │
│    ├─ Once a week or less → Monolith + modular split │
│    └─ Daily / multiple times → go to ③            │
│                                                 │
│  ③ Team independence?                             │
│    ├─ High → Microservices                        │
│    └─ Moderate → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A fast short-term approach can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

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
- Introduce monitoring early

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually renewing a system that has been in operation for over 10 years

**Approach:**
- Gradually migrate using the Strangler Fig pattern
- If no existing tests, first write Characterization Tests
- Coexist old and new systems via an API gateway
- Migrate data in stages

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
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
    sla_ms: int  # response time SLA
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

**Situation:** Systems where millisecond-level response times are required

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging async processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |
---

## 12. FAQ

### Q1. What should I do if conflicts during rebase spiral out of control?

**A1.** You can use `git rebase --abort` to **fully revert to the state before rebase started**. The working directory, index, and HEAD are all restored. Commits already processed mid-rebase are also rewound.

```bash
$ git rebase --abort    # revert everything
$ git reflog            # verify the original state just in case
```

### Q2. Can I undo a rebase after it completes if I realize I made a mistake?

**A2.** Yes, you can restore using reflog.

```bash
# Check where HEAD was before rebase using reflog
$ git reflog
abc123 HEAD@{0}: rebase (finish): returning to refs/heads/feature
def456 HEAD@{1}: rebase (squash): feat: ...
789abc HEAD@{2}: rebase (start): checkout main
fedcba HEAD@{3}: commit: feat: ...    # ← last commit before rebase

# Restore to pre-rebase state
$ git reset --hard fedcba
```

### Q3. What is the difference between `--autosquash` and `--autostash`?

**A3.** They are completely different features.

| Feature         | Description                                                   |
|-----------------|----------------------------------------------------------------|
| `--autosquash`  | Auto-reorders `fixup!`/`squash!` commits within the todo list |
| `--autostash`   | Auto-stashes uncommitted changes before rebase, pops after    |

```bash
# Rebase with uncommitted changes
$ git rebase -i --autostash main
# → Automatically: stash → rebase → stash pop
```

### Q4. When stopped at edit during rebase, which commit's state am I in?

**A4.** When stopped at edit, **that commit has already been applied**. This means HEAD points to the commit specified with edit. Either amend it with `git commit --amend` or add new commits and continue with `git rebase --continue`.

```bash
$ git rebase -i HEAD~3
# edit a1b2c3d feat: some implementation

# State after stopping:
$ git log --oneline -1
# a1b2c3d feat: some implementation    ← this commit is already applied
$ git status
# interactive rebase in progress
```

### Q5. How should I choose between squash and fixup?

**A5.** Use the following criteria to decide.

| Situation | Recommended Command | Reason |
|------|-------------|------|
| Want to combine multiple implementations into one commit | squash | Can merge and edit messages |
| Small fixes like typos or lint errors | fixup | Keeps the parent commit's message |
| Fixes after code review | fixup + autosquash | Auto-merges fix into original commit |
| Want to improve message later | fixup -C | Uses the fixup commit's message |

### Q6. How do you use `git rebase --onto`?

**A6.** `--onto` is an option to specify the "transplant destination" for commits, and takes 3 arguments.

```bash
# Syntax: git rebase --onto <new base> <old base> <branch>

# Use case 1: Switch branch base
# Before: main → feature-a → feature-b
# After:  main → feature-b (skipping feature-a)
$ git rebase --onto main feature-a feature-b

# Use case 2: Transplant only specific commits
# Transplant the latest 3 commits from feature branch to main
$ git rebase --onto main HEAD~3 feature

# Use case 3: Switch from an old base branch
# Change from develop → feature to main → feature
$ git rebase --onto main develop feature
```

```
┌──────────────────────────────────────────────────────┐
│  How --onto works                                     │
│                                                      │
│  Before:                                             │
│  main ── A ── B(feature-a) ── C ── D(feature-b)     │
│                                                      │
│  $ git rebase --onto main feature-a feature-b        │
│                                                      │
│  After:                                              │
│  main ── A ── C'── D'(feature-b)                     │
│            \                                         │
│             B(feature-a)                              │
│  → Commits after feature-a (C,D) are transplanted directly onto main │
└──────────────────────────────────────────────────────┘
```

### Q7. What is the difference between interactive rebase and non-interactive rebase?

**A7.** The underlying mechanism is the same, but the level of control differs.

```bash
# non-interactive rebase
$ git rebase main
# → Automatically picks all commits from main to HEAD
# → Completes without intervention except for conflicts

# interactive rebase
$ git rebase -i main
# → Todo list is shown, allowing individual processing of each commit
# → squash, fixup, reword, edit, drop, exec are available

# * autosquash applies to non-interactive too (depending on settings)
# * --exec can also be used with non-interactive
$ git rebase --exec "npm test" main
```

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners often make?

Jumping to advanced topics without mastering the basics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real work?

Knowledge of this topic is frequently used in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Concept        | Key Point                                                     |
|----------------|---------------------------------------------------------------|
| pick           | Use commit as-is                                              |
| squash         | Merge into previous commit, message can be edited             |
| fixup          | Merge into previous commit, keep previous commit's message    |
| fixup -C       | fixup but use the fixup commit's message (Git 2.32+)          |
| reword         | Change only the commit message                                |
| edit           | Stop at that commit, allows modification or splitting         |
| exec           | Run an arbitrary shell command                                |
| break          | Pause, resume with continue after checking                    |
| drop           | Explicitly delete a commit                                    |
| autosquash     | Auto-reorder with `fixup!`/`squash!` prefix                   |
| --update-refs  | Auto-update stacked branch refs (Git 2.38+)                   |
| --rebase-merges| Rebase while preserving merge structure                       |
| --onto         | Explicitly specify the transplant destination for commits     |
| rerere         | Remember and reuse conflict resolutions                       |
| ORIG_HEAD      | Automatically saves HEAD position before rebase               |

---

## What to Read Next

- [Merge Algorithms](../00-git-internals/02-merge-algorithms.md) -- The principles behind conflict resolution during rebase
- [bisect/blame](./02-bisect-blame.md) -- Bug identification with a clean history
- [Git Hooks](./03-hooks-automation.md) -- Hook integration during rebase

---

## References

1. **Pro Git Book** -- "Rewriting History" https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History
2. **Git Official Documentation** -- `git-rebase` https://git-scm.com/docs/git-rebase
3. **GitHub Blog** -- "Git Tips: `--update-refs`" https://github.blog/2022-10-03-highlights-from-git-2-38/#rebase-update-refs
4. **Git Release Notes 2.32** -- fixup amend/reword https://github.com/git/git/blob/master/Documentation/RelNotes/2.32.0.txt
5. **Git Release Notes 2.38** -- update-refs https://github.com/git/git/blob/master/Documentation/RelNotes/2.38.0.txt
