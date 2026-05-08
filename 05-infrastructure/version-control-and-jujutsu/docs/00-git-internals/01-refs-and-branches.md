# Refs and Branches

> A deep dive into Git's ref (reference) mechanism, covering the internal representation of HEAD, branches, tags, and reflog, as well as a proper understanding of detached HEAD state and how to recover from it.

## What You Will Learn

1. **Ref types and internal representation** — How branches, tags, and remote-tracking branches are managed on the filesystem
2. **How HEAD works and detached HEAD** — The operating principles of symbolic references and how to use them safely
3. **History recovery with reflog** — Techniques for tracking and rescuing lost commits
4. **packed-refs and reference resolution** — Optimization for large numbers of refs and resolution priority
5. **Internal representation of tags** — Differences between lightweight tags and annotated tags
6. **Branch operation patterns** — Understanding the internal behavior behind various branch operations encountered in practice


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Git Object Model](./00-git-object-model.md)

---

## 1. What Is a Ref?

A ref is a **pointer to a SHA-1 hash**, stored as a text file under `.git/refs/`. In Git's object model (blob, tree, commit, tag), all objects are uniquely identified by their SHA-1 (or SHA-256) hash, but memorizing 40-character hashes directly is difficult for humans. A ref is the mechanism that gives these hashes **human-readable names**.

### 1.1 Refs on the Filesystem

```
.git/
├── HEAD                          ← symbolic reference
├── ORIG_HEAD                     ← HEAD position before merge/rebase/reset
├── MERGE_HEAD                    ← the other side's HEAD during a merge
├── FETCH_HEAD                    ← temporary reference holding fetch results
├── CHERRY_PICK_HEAD              ← reference during a cherry-pick
├── REVERT_HEAD                   ← reference during a revert
├── refs/
│   ├── heads/                    ← local branches
│   │   ├── main                  ← "main" branch
│   │   ├── develop               ← "develop" branch
│   │   └── feature/auth          ← "feature/auth" branch
│   ├── tags/                     ← tags
│   │   ├── v1.0.0
│   │   └── v2.0.0
│   ├── remotes/                  ← remote-tracking branches
│   │   ├── origin/
│   │   │   ├── main
│   │   │   ├── develop
│   │   │   └── feature/auth
│   │   └── upstream/
│   │       └── main
│   ├── stash                     ← latest stash entry
│   └── notes/                    ← git notes references
│       └── commits
├── packed-refs                   ← packed refs (optimized)
└── logs/                         ← reflog
    ├── HEAD
    └── refs/
        ├── heads/
        │   ├── main
        │   └── feature/auth
        └── remotes/
            └── origin/
                └── main
```

### 1.2 Inspecting a Ref Directly

```bash
# Inspect a branch ref directly
$ cat .git/refs/heads/main
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

# Inspect HEAD directly (symbolic reference)
$ cat .git/HEAD
ref: refs/heads/main

# Convert a ref to SHA-1 with git rev-parse
$ git rev-parse main
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

$ git rev-parse HEAD
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

# Check the object type that a ref points to
$ git cat-file -t refs/heads/main
commit

# List all refs
$ git for-each-ref --format='%(refname) %(objecttype) %(objectname:short)' refs/
refs/heads/develop commit a1b2c3d
refs/heads/feature/auth commit f5e6d7c
refs/heads/main commit a1b2c3d
refs/remotes/origin/main commit a1b2c3d
refs/tags/v1.0.0 tag 1234567
refs/tags/v2.0.0 commit 89abcde
```

### 1.3 Ref Name Resolution Rules

Git resolves abbreviated ref names in the following order. Understanding this order lets you predict behavior when a branch and a tag have the same name.

```
Resolution order for git rev-parse <name>:

1. Try <name> as-is (e.g., HEAD, ORIG_HEAD)
2. refs/<name>
3. refs/tags/<name>
4. refs/heads/<name>
5. refs/remotes/<name>
6. refs/remotes/<name>/HEAD
```

```bash
# Problem when a branch and tag share the same name
$ git branch v1.0.0       # Create branch "v1.0.0"
$ git checkout v1.0.0     # Tag? Branch? → A warning is shown

warning: refname 'v1.0.0' is ambiguous.

# How to specify explicitly
$ git checkout refs/heads/v1.0.0    # Specify the branch
$ git checkout refs/tags/v1.0.0     # Specify the tag (detached HEAD)

# Explicit resolution with rev-parse
$ git rev-parse refs/heads/v1.0.0   # SHA-1 of the branch
$ git rev-parse refs/tags/v1.0.0    # SHA-1 of the tag
```

### 1.4 Special Refs

Git has special refs that are automatically set during certain operations.

| Ref name            | When it is set              | Purpose                                          |
|---------------------|-----------------------------|--------------------------------------------------|
| `HEAD`              | Always                      | Current checkout position                        |
| `ORIG_HEAD`         | After merge/rebase/reset    | HEAD position before the operation (for undoing) |
| `MERGE_HEAD`        | During a merge              | HEAD of the branch being merged in               |
| `FETCH_HEAD`        | After a fetch               | Result of the most recent fetch                  |
| `CHERRY_PICK_HEAD`  | During cherry-pick          | The commit being cherry-picked                   |
| `REVERT_HEAD`       | During revert               | The commit being reverted                        |
| `BISECT_HEAD`       | During bisect               | Current bisect checkpoint                        |

```bash
# Undoing an operation using ORIG_HEAD
$ git merge feature/auth
# To undo the merge:
$ git reset --hard ORIG_HEAD

# Inspecting FETCH_HEAD
$ git fetch origin
$ cat .git/FETCH_HEAD
a1b2c3d4e5f6... branch 'main' of https://github.com/user/repo

# MERGE_HEAD only exists during a merge
$ git merge feature/auth
# While a conflict is in progress:
$ cat .git/MERGE_HEAD
f5e6d7c8b9a0e1f2d3c4b5a6d7e8f9a0b1c2d3e4
# The file is deleted after the merge completes
```

---

## 2. How HEAD Works

HEAD is the most important ref in Git; it indicates the **current checkout position**. It is normally a symbolic reference to a branch, but it can also point directly to a specific commit (detached HEAD).

### 2.1 Normal HEAD (attached)

```
┌───────────────────────────────────────┐
│  .git/HEAD                            │
│  "ref: refs/heads/feature/auth"       │
│         │                             │
│         ▼                             │
│  .git/refs/heads/feature/auth         │
│  "c3d4e5f6..."                        │
│         │                             │
│         ▼                             │
│  commit c3d4e5f6...                   │
│    ├── tree ...                       │
│    ├── parent ...                     │
│    └── message: "Add login form"      │
└───────────────────────────────────────┘

When a new commit is made:
  1. A new commit object is created (parent = c3d4e5f6...)
  2. refs/heads/feature/auth is updated to the new commit's SHA-1
  3. HEAD continues to point to refs/heads/feature/auth
```

When HEAD is indirectly referencing a branch, running `git commit` causes the **branch pointer to advance automatically**. This is the normal behavior of Git and is the essence of how branches "grow."

```bash
# Commands for checking HEAD state
$ git symbolic-ref HEAD
refs/heads/feature/auth    # Returns branch name = attached

$ git rev-parse HEAD
c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2    # Returns SHA-1

$ git rev-parse --abbrev-ref HEAD
feature/auth    # Short branch name

# Branch position change before and after a commit
$ git rev-parse feature/auth
c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2

$ echo "new content" >> file.txt && git add file.txt && git commit -m "update"

$ git rev-parse feature/auth
d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3    # Updated to new SHA-1
```

### 2.2 Detached HEAD

A detached HEAD is a state in which HEAD points **directly to a specific commit** rather than to a branch.

```bash
# Common operations that result in a detached HEAD
$ git checkout a1b2c3d                # Checkout a specific commit
$ git checkout v1.0.0                 # Checkout a tag
$ git checkout origin/main            # Checkout a remote-tracking branch
$ git rebase --onto main feature HEAD~3  # Mid-rebase

# Checking HEAD state
$ cat .git/HEAD
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
# ← No "ref:" prefix = detached

$ git symbolic-ref HEAD
fatal: ref HEAD is not a symbolic ref
# ← symbolic-ref errors on a detached HEAD

$ git status
HEAD detached at a1b2c3d
# Git clearly shows the detached HEAD state
```

```
┌────────────────────────────────────────┐
│  Normal HEAD (attached)                │
│                                        │
│  HEAD ──→ refs/heads/main ──→ commit   │
│                                        │
├────────────────────────────────────────┤
│  Detached HEAD                         │
│                                        │
│  HEAD ──→ commit (direct reference)    │
│  refs/heads/main ──→ different commit  │
│                                        │
│  * Any new commits made in this state  │
│    do not belong to any branch         │
│    (and may be subject to GC)          │
└────────────────────────────────────────┘
```

### 2.3 Valid Use Cases for Detached HEAD

Detached HEAD is not necessarily a dangerous state. It is intentionally used in the following scenarios.

```bash
# Use case 1: Temporarily inspecting a past commit
$ git checkout v1.0.0
# Run tests to verify behavior of the old version
$ make test
# Return to the original branch when done
$ git checkout main

# Use case 2: Tag-based checkout in a CI/CD pipeline
# Tag-based builds in Jenkins/GitHub Actions, etc.
$ git checkout v2.1.0
$ docker build -t myapp:2.1.0 .

# Use case 3: Automatic checkout during bisect
$ git bisect start
$ git bisect bad HEAD
$ git bisect good v1.0.0
# → Git automatically checks out an intermediate commit in detached HEAD mode

# Use case 4: Temporary work in a worktree
$ git worktree add /tmp/hotfix v1.0.0
# → worktrees can be created in detached HEAD mode
```

### 2.4 Recovering from Detached HEAD

```bash
# Method 1: Create a new branch to save your work
$ git checkout -b rescue-branch
# → Creates a new branch at the current HEAD position and returns to attached state

# Method 2: Return to an existing branch
$ git checkout main
# → If commits were made while in detached HEAD,
#    they are recorded only in reflog (not on any branch)

# Method 3: Rescue a commit made while in detached HEAD
$ git reflog
# a1b2c3d HEAD@{0}: checkout: moving from main to a1b2c3d
# f5e6d7c HEAD@{1}: commit: important work in detached state
$ git branch rescue-branch f5e6d7c

# Method 4: The switch command (Git 2.23+)
$ git switch main              # Return to a branch
$ git switch -c new-branch     # Create a new branch and switch to it
$ git switch --detach v1.0.0   # Intentionally detach (explicit)

# Method 5: Rescue multiple commits made while in detached HEAD
$ git reflog
# abc1234 HEAD@{0}: commit: third fix
# def5678 HEAD@{1}: commit: second fix
# 789abcd HEAD@{2}: commit: first fix
# a1b2c3d HEAD@{3}: checkout: moving from main to a1b2c3d
$ git branch rescue-branch abc1234
# → All commits reachable from abc1234 (first/second/third fix) are protected
```

### 2.5 Low-Level HEAD Operations

Using the `git update-ref` command, you can manipulate refs at a low level. This is useful for understanding the processing that takes place behind ordinary Git commands.

```bash
# Change the branch that HEAD points to (similar to the internals of git checkout)
$ git symbolic-ref HEAD refs/heads/feature/auth

# Update a branch to a new commit (part of the internals of git commit)
$ git update-ref refs/heads/main a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

# update-ref performs safe ref updates:
# - Automatically creates a reflog entry
# - Uses a lock file (.lock) to protect against concurrent access
$ ls .git/refs/heads/main.lock
# → A temporary file that exists only while update-ref is running

# Deleting a ref
$ git update-ref -d refs/heads/old-branch
# → Deletes the refs/heads/old-branch file and records the deletion in reflog
```

---

## 3. Branch Operations and Internal Behavior

### 3.1 Internal Behavior of Branch Creation and Deletion

```bash
# Creating a branch = creating a file
$ git branch feature/new-ui
# → Writes HEAD's SHA-1 to .git/refs/heads/feature/new-ui
# → Creates a reflog entry in .git/logs/refs/heads/feature/new-ui

# Creating a branch from a specific commit
$ git branch feature/from-tag v1.0.0
# → Writes the SHA-1 that v1.0.0 points to

# Deleting a branch = deleting a file
$ git branch -d feature/new-ui
# → Deletes .git/refs/heads/feature/new-ui
#    (the commit object itself is not deleted)
#    Errors if not yet merged

# Force delete (does not check merge status)
$ git branch -D feature/new-ui
# → Equivalent to -d --force; deletes even if not merged

# Renaming a branch = renaming the file + updating reflog
$ git branch -m old-name new-name
# → refs/heads/old-name → refs/heads/new-name
# → logs/refs/heads/old-name → logs/refs/heads/new-name
# → Branch settings in config are also updated
```

### 3.2 Manually Reproducing Branch Internals

A Git branch is essentially nothing more than "a text file containing the SHA-1 of a commit object." To verify this fact, try manipulating a branch manually.

```bash
# Check the SHA-1 of the current HEAD
$ git rev-parse HEAD
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

# Manually create a branch (alternative to git branch)
$ echo "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0" > .git/refs/heads/manual-branch
# → manual-branch will appear in git branch -a

# However, the above does not create a reflog entry and is not recommended
# The correct low-level operation:
$ git update-ref refs/heads/manual-branch HEAD
# → A reflog entry is also created

# Manually move a branch (similar to the internals of git reset --hard)
$ git update-ref refs/heads/main f5e6d7c8b9a0e1f2d3c4b5a6d7e8f9a0b1c2d3e4
# → The main branch now points to a different commit

# Branch tracking configuration
$ git branch --set-upstream-to=origin/main main
# → The following is written to .git/config:
# [branch "main"]
#     remote = origin
#     merge = refs/heads/main
```

### 3.3 Branch Hierarchy (Namespacing)

Git branch names can include slashes (`/`), which are represented as directory hierarchies on the filesystem.

```bash
# Branch names containing slashes
$ git branch feature/auth/login
$ git branch feature/auth/signup
$ git branch feature/ui/dashboard

# Structure on the filesystem
$ find .git/refs/heads -type f
.git/refs/heads/main
.git/refs/heads/feature/auth/login
.git/refs/heads/feature/auth/signup
.git/refs/heads/feature/ui/dashboard

# Note: A branch named "feature/auth" cannot coexist with "feature/auth/login"
# → "feature/auth" would be a file, but "feature/auth/" needs to be a directory
$ git branch feature/auth
fatal: cannot lock ref 'refs/heads/feature/auth':
  'refs/heads/feature/auth/login' exists; cannot create 'refs/heads/feature/auth'

# Filtering the branch list
$ git branch --list 'feature/*'
  feature/auth/login
  feature/auth/signup
  feature/ui/dashboard

$ git branch --list 'feature/auth/*'
  feature/auth/login
  feature/auth/signup
```

### 3.4 Remote-Tracking Branches

```bash
# List remote-tracking branches
$ git branch -r
  origin/main
  origin/develop
  origin/feature/auth
  upstream/main

# All branches (local + remote-tracking)
$ git branch -a
  develop
  feature/auth
* main
  remotes/origin/develop
  remotes/origin/feature/auth
  remotes/origin/main
  remotes/upstream/main

# Behavior on fetch
$ git fetch origin
# → Updates refs/remotes/origin/*
# → Does not change local branches

# Rules for updating remote-tracking branches (refspec)
$ cat .git/config
[remote "origin"]
    url = https://github.com/user/repo.git
    fetch = +refs/heads/*:refs/remotes/origin/*

[remote "upstream"]
    url = https://github.com/upstream/repo.git
    fetch = +refs/heads/*:refs/remotes/upstream/*
```

```
┌─────────────────────────────────────────────────────┐
│                  refspec structure                   │
│                                                     │
│  +refs/heads/*:refs/remotes/origin/*                │
│  │    │              │                              │
│  │    │              └── local-side ref             │
│  │    └── remote-side ref                           │
│  └── "+" = force update even on non-fast-forward   │
│                                                     │
│  Example: when origin/main is updated               │
│  refs/heads/main (remote)                           │
│    → refs/remotes/origin/main (local)               │
└─────────────────────────────────────────────────────┘
```

### 3.5 Advanced Refspec Operations

```bash
# Fetch only a specific branch
$ git fetch origin main
# → Updates only refs/remotes/origin/main

# Fetch with a custom refspec
$ git fetch origin +refs/heads/release/*:refs/remotes/origin/release/*
# → Retrieves only branches starting with release/

# Push refspec
$ git push origin main:main
# → Pushes local main to remote main

$ git push origin feature/auth:refs/heads/feature/auth
# → Explicit refspec specification

# Delete a remote branch
$ git push origin --delete feature/old
# → Deletes the feature/old branch on the remote
# → Also deletes the local refs/remotes/origin/feature/old

# Alternative way to delete a remote branch using refspec
$ git push origin :feature/old
# → Push "nothing" to feature/old = delete

# Clean up stale remote-tracking branches
$ git remote prune origin
# → Deletes refs/remotes/origin/* that no longer exist on the remote

$ git fetch --prune origin
# → Runs prune at the same time as fetch (recommended setting)

# Configure automatic pruning
$ git config fetch.prune true
# → Prune runs automatically on every fetch
```

### 3.6 Setting and Using Upstream Branches

```bash
# Set the upstream branch
$ git branch --set-upstream-to=origin/main main
# or
$ git push -u origin feature/auth
# → Automatically sets the upstream branch when pushing

# Check upstream branches
$ git branch -vv
* feature/auth abc1234 [origin/feature/auth: ahead 2] latest commit
  main         def5678 [origin/main] synced commit
  develop      789abcd [origin/develop: behind 3] older commit

# Check differences from the upstream branch
$ git log @{upstream}..HEAD    # Commits in local but not in remote
$ git log HEAD..@{upstream}    # Commits in remote but not in local
$ git log @{upstream}...HEAD   # Differences in both directions (symmetric diff)

# Difference from @{push} (Git 2.5+)
$ git log @{push}..HEAD
# → Difference from the push target branch (useful in triangular workflows)
# Example: fetch from upstream, push to origin
```

---

## 4. Internal Representation of Tags

### 4.1 Lightweight Tags vs. Annotated Tags

Git has two types of tags with different internal representations.

```bash
# Creating a lightweight tag
$ git tag v1.0.0-rc1
# → Stores the commit's SHA-1 directly in .git/refs/tags/v1.0.0-rc1
# → No tag object is created

$ cat .git/refs/tags/v1.0.0-rc1
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

$ git cat-file -t v1.0.0-rc1
commit    # ← Points directly to a commit object

# Creating an annotated tag
$ git tag -a v1.0.0 -m "Release version 1.0.0"
# → A tag object is created
# → The SHA-1 of the tag object is stored in .git/refs/tags/v1.0.0

$ git cat-file -t v1.0.0
tag       # ← Points to a tag object

$ git cat-file -p v1.0.0
object a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
type commit
tag v1.0.0
tagger Gaku <gaku@example.com> 1707600000 +0900

Release version 1.0.0
```

```
┌────────────────────────────────────────────────────┐
│  Lightweight tag                                    │
│                                                    │
│  refs/tags/v1.0.0-rc1 ──→ commit object            │
│  (SHA-1 stored directly)                           │
│                                                    │
├────────────────────────────────────────────────────┤
│  Annotated tag                                      │
│                                                    │
│  refs/tags/v1.0.0 ──→ tag object ──→ commit object │
│  (goes through a tag object)                       │
│                                                    │
│  Contents of the tag object:                       │
│  - object: SHA-1 of the target commit              │
│  - type: commit                                    │
│  - tag: tag name                                   │
│  - tagger: creator information                     │
│  - message: tag message                            │
│  - GPG signature (if signed)                      │
└────────────────────────────────────────────────────┘
```

### 4.2 Signed Tags

```bash
# Creating a GPG-signed tag
$ git tag -s v1.0.0 -m "Signed release v1.0.0"
# → The tag object includes a GPG signature

# Verifying the signature
$ git tag -v v1.0.0
object a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
type commit
tag v1.0.0
tagger Gaku <gaku@example.com> 1707600000 +0900

Signed release v1.0.0
gpg: Signature made Mon 12 Feb 2024 10:00:00 AM JST
gpg: Good signature from "Gaku <gaku@example.com>"

# SSH signing (Git 2.34+)
$ git config gpg.format ssh
$ git config user.signingKey ~/.ssh/id_ed25519.pub
$ git tag -s v2.0.0 -m "SSH signed release v2.0.0"
```

### 4.3 Pushing Tags

Tags are not sent to the remote by default when running `git push`. Explicit action is required.

```bash
# Push an individual tag
$ git push origin v1.0.0

# Push all tags
$ git push origin --tags
# → Pushes both lightweight and annotated tags

# Push only annotated tags (Git 2.4+)
$ git push origin --follow-tags
# → Selectively pushes only annotated tags

# Delete a tag from the remote
$ git push origin --delete v1.0.0
# or
$ git push origin :refs/tags/v1.0.0

# Re-fetch tags from the remote
$ git fetch origin --tags
# → Retrieves tags from the remote that do not exist locally
```

### 4.4 Tag "Peeling"

In packed-refs and for-each-ref output, the SHA-1 of the commit that an annotated tag ultimately points to is also recorded. This is called "peeling."

```bash
# Inspecting a peeled tag
$ git for-each-ref --format='%(refname) %(objectname:short) → %(objectname:short=,deref)' refs/tags/

# Directly obtain the SHA-1 of the peeled commit
$ git rev-parse v1.0.0^{}
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
# ^{} "peels" the tag object and returns the internal commit

# Peeled representation in packed-refs
$ cat .git/packed-refs
# pack-refs with: peeled fully-peeled sorted
f5e6d7c8b9a0e1f2d3c4b5a6d7e8f9a0b1c2d3e4 refs/tags/v1.0.0
^a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
# Lines starting with ^ are the peeled SHA-1 (the commit the tag points to)
```

---

## 5. Reflog — Recording Operation History

### 5.1 Reflog Basics

Reflog is a local-only mechanism that records the **history of changes to a ref**. It is not transferred during `git clone` or `git push`. It is the repository's local "operation journal" and serves as the last resort for recovery from mistakes.

```bash
# Display the reflog for HEAD
$ git reflog
a1b2c3d HEAD@{0}: commit: feat: add authentication
f5e6d7c HEAD@{1}: checkout: moving from feature to main
b8c9d0e HEAD@{2}: commit: fix: typo in README
1234567 HEAD@{3}: merge feature/auth: Fast-forward
89abcde HEAD@{4}: commit: refactor: extract utils
fedcba0 HEAD@{5}: rebase (finish): returning to refs/heads/main
fedcba0 HEAD@{6}: rebase (pick): update config
1111111 HEAD@{7}: rebase (start): checkout origin/main

# Reflog for a specific branch
$ git reflog show main
a1b2c3d main@{0}: commit: feat: add authentication
f5e6d7c main@{1}: merge feature/ui: Merge made by 'ort'
b8c9d0e main@{2}: commit: initial setup

# Accessing by date/time
$ git show main@{2.days.ago}
$ git show HEAD@{2024-02-01}
$ git show HEAD@{yesterday}
$ git show main@{1.week.ago}

# Detailed reflog display
$ git reflog --format='%C(auto)%h %gd %gs %ci'
a1b2c3d HEAD@{0} commit: feat: add authentication 2024-02-12 10:00:00 +0900
f5e6d7c HEAD@{1} checkout: moving from feature to main 2024-02-12 09:45:00 +0900

# Display diffs in reflog
$ git diff HEAD@{0} HEAD@{3}
# → Shows the diff from 3 operations ago
```

### 5.2 Reflog Storage Location and Format

```bash
# Inspect a reflog file
$ cat .git/logs/HEAD
# Each line: old-SHA-1 new-SHA-1 author timestamp operation

$ cat .git/logs/refs/heads/main
0000000... a1b2c3d... Gaku <gaku@example.com> 1707600000 +0900	commit (initial): first commit
a1b2c3d... f5e6d7c... Gaku <gaku@example.com> 1707603600 +0900	commit: second commit
f5e6d7c... b8c9d0e... Gaku <gaku@example.com> 1707607200 +0900	merge feature/auth: Merge made by 'ort'
```

```
┌───────────────────────────────────────────────────────────┐
│  Reflog entry format                                       │
│                                                           │
│  <old-SHA-1> <new-SHA-1> <name> <<email>> <UNIXtime> <TZ>\t<message>  │
│                                                           │
│  Example:                                                  │
│  a1b2c3d... f5e6d7c... Gaku <g@ex.com> 1707600000 +0900  │
│  \tcommit: add feature                                    │
│                                                           │
│  old-SHA-1 = 0000000... means the branch was newly created│
│  new-SHA-1 = 0000000... means the branch was deleted      │
└───────────────────────────────────────────────────────────┘
```

### 5.3 Reflog Expiry

| Category                   | Default expiry | Configuration key            |
|----------------------------|----------------|------------------------------|
| Reachable entries          | 90 days        | `gc.reflogExpire`            |
| Unreachable entries        | 30 days        | `gc.reflogExpireUnreachable` |

```bash
# Change reflog expiry
$ git config gc.reflogExpire "180 days"
$ git config gc.reflogExpireUnreachable "60 days"

# Per-ref individual settings
$ git config gc.main.reflogExpire "365 days"
# → Keeps the reflog for the main branch for 1 year

# Manually expire reflog entries
$ git reflog expire --expire=now --all
# → Immediately expires all reflog entries for all refs (dangerous!)

# Expire reflog for a specific ref only
$ git reflog expire --expire=30.days.ago refs/heads/feature/old

# Check with dry-run first
$ git reflog expire --expire=30.days.ago --dry-run --all
# → Shows what would be deleted without actually deleting it
```

### 5.4 Recovery Techniques Using Reflog

```bash
# Technique 1: Undoing a git reset --hard
$ git reset --hard HEAD~3    # Discard the last 3 commits
# "I want to undo that"
$ git reflog
# a1b2c3d HEAD@{0}: reset: moving to HEAD~3
# f5e6d7c HEAD@{1}: commit: important commit 3
# b8c9d0e HEAD@{2}: commit: important commit 2
# 1234567 HEAD@{3}: commit: important commit 1
$ git reset --hard HEAD@{1}
# → Restores to the state before the reset

# Technique 2: Restoring a deleted branch
$ git branch -D feature/important
# "I shouldn't have deleted that"
$ git reflog
# → Find the last commit SHA-1 that feature/important pointed to
$ git branch feature/important HEAD@{2}

# Technique 3: Undoing a failed rebase
$ git rebase main
# Too many conflicts to resolve
$ git rebase --abort    # If still in progress, --abort works

# To undo after the rebase has completed
$ git reflog
# → Find the HEAD position before the rebase started
$ git reset --hard HEAD@{5}    # Restore to pre-rebase state

# Technique 4: Retrieving a commit before an amend
$ git commit --amend -m "corrected message"
# "I want to keep the pre-amend commit too"
$ git reflog
# a1b2c3d HEAD@{0}: commit (amend): corrected message
# f5e6d7c HEAD@{1}: commit: original message
$ git branch backup-original f5e6d7c

# Technique 5: Restoring a dropped stash
$ git stash drop stash@{0}
# "I want to get back the dropped stash"
$ git fsck --no-reflogs | grep commit
# dangling commit f5e6d7c...
$ git stash apply f5e6d7c
```

### 5.5 Using Reflog with git fsck

Even after reflog entries expire, the objects themselves may still remain until GC is run. You can search for unreachable objects using `git fsck`.

```bash
# Find unreachable objects
$ git fsck --unreachable
unreachable commit a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
unreachable blob f5e6d7c8b9a0e1f2d3c4b5a6d7e8f9a0b1c2d3e4
unreachable tree 1234567890abcdef1234567890abcdef12345678

# Save unreachable commits to lost-found
$ git fsck --lost-found
# → SHA-1 files for commits are created in .git/lost-found/commit/
# → Other objects are saved in .git/lost-found/other/

# Check dangling objects (objects not referenced from anywhere)
$ git fsck --no-reflogs
# → Determines reachability ignoring reflog
# → Also shows objects protected only by reflog

# Inspect the content of a specific dangling commit
$ git log --oneline --graph a1b2c3d4
$ git show a1b2c3d4
```

---

## 6. packed-refs

When there are a large number of refs, Git aggregates them into `packed-refs` rather than individual files to improve performance.

### 6.1 Structure of packed-refs

```bash
# Contents of packed-refs
$ cat .git/packed-refs
# pack-refs with: peeled fully-peeled sorted
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0 refs/heads/main
b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3d4e5f6a7 refs/heads/develop
f5e6d7c8b9a0e1f2d3c4b5a6d7e8f9a0b1c2d3e4 refs/tags/v1.0.0
^a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
89abcdef0123456789abcdef0123456789abcdef refs/tags/v2.0.0
# ^ = peeled tag (SHA-1 of the commit pointed to by the tag object)
# Lines starting with # are comments

# Pack manually
$ git pack-refs --all
# → Consolidates all loose refs into packed-refs
# → Loose refs for active branches (current HEAD) may remain

# Pack only (without deleting loose refs)
$ git pack-refs --no-prune
```

### 6.2 Ref Resolution Priority and Behavior

```
┌─────────────────────────────────────────────────┐
│  Ref resolution priority                        │
│                                                 │
│  1. .git/refs/heads/<name>  (loose ref)         │
│  2. Matching line in .git/packed-refs           │
│                                                 │
│  → Loose refs take priority if they exist       │
│  → Branch updates are written to loose refs     │
│  → git gc / pack-refs consolidates into packed  │
│                                                 │
│  Update flow:                                   │
│  1. git commit → loose ref is updated           │
│  2. When the same ref exists in both loose and  │
│     packed → loose is the latest (packed is old)│
│  3. git gc → consolidates loose into packed     │
│     → loose file is deleted                     │
│  4. Next commit → a new loose ref is created    │
└─────────────────────────────────────────────────┘
```

### 6.3 Performance Impact of packed-refs

```bash
# Comparison when there are a large number of branches/tags
# (Example: repository with 10,000 tags)

# With loose objects:
# → 10,000 files created under refs/tags/
# → Heavy inode consumption on the filesystem
# → ls-remote, branch -a, etc. become slow

# With packed-refs:
# → All tags stored in a single file
# → Filesystem load significantly reduced
# → Reference resolution also faster (sequential read vs random seek)

# Performance measurement
$ time git for-each-ref refs/tags/ | wc -l
# packed-refs: ~0.01s
# loose refs:  ~0.5s  (for 10,000 files)

# reftable format (Git 2.45+, experimental)
# → Further evolution of packed-refs
# → Binary format enabling fast lookups
# → JGit-originated format ported to C implementation
$ git config core.repositoryFormatVersion 1
$ git config extensions.refStorage reftable
# → Note: reftable is an experimental feature and carries compatibility risks
```

---

## 7. Symbolic References

A symbolic reference is a **ref that indirectly references another ref**. The most common example is HEAD, which normally points to a branch ref.

### 7.1 Basic Operations

```bash
# HEAD is the most common symbolic reference
$ git symbolic-ref HEAD
refs/heads/main

# Creating a custom symbolic reference
$ git symbolic-ref refs/custom/current refs/heads/feature/auth
# → refs/custom/current indirectly references feature/auth

# Errors when HEAD is detached
$ git symbolic-ref HEAD
fatal: ref HEAD is not a symbolic ref

# Safe check for symbolic reference (avoids the error)
$ git symbolic-ref --quiet HEAD && echo "attached" || echo "detached"
```

### 7.2 Practical Examples of Symbolic References

```bash
# Default branch of a remote (HEAD)
$ git remote show origin
# → Shows "HEAD branch: main"
# → This is because refs/remotes/origin/HEAD is a symbolic reference

$ cat .git/refs/remotes/origin/HEAD
ref: refs/remotes/origin/main

# Update origin/HEAD
$ git remote set-head origin develop
# → Changes refs/remotes/origin/HEAD to point to refs/remotes/origin/develop

# Auto-detect and set origin/HEAD
$ git remote set-head origin --auto
# → Queries the remote to automatically set the default branch

# HEAD in worktrees
# Main worktree: .git/HEAD
# Additional worktrees: .git/worktrees/<name>/HEAD
$ git worktree add ../feature-worktree feature/auth
$ cat .git/worktrees/feature-worktree/HEAD
ref: refs/heads/feature/auth
```

---

## 8. Branch Protection and Operation Patterns

### 8.1 Local Branch Protection

```bash
# Protection via receive.denyNonFastForwards (shared repositories)
$ git config receive.denyNonFastForwards true
# → Rejects all non-fast-forward pushes

# Deletion prevention via receive.denyDeletes
$ git config receive.denyDeletes true
# → Rejects push deletions of branches/tags

# Branch protection via pre-receive hook (server-side)
# .git/hooks/pre-receive:
#!/bin/bash
while read oldrev newrev refname; do
  if [ "$refname" = "refs/heads/main" ]; then
    # Reject direct pushes to the main branch
    echo "ERROR: Direct push to main is not allowed."
    echo "Please create a pull request instead."
    exit 1
  fi
done

# Per-ref control via update hook
# .git/hooks/update:
#!/bin/bash
refname="$1"
oldrev="$2"
newrev="$3"
if [ "$refname" = "refs/heads/main" ] && \
   [ "$(git merge-base $oldrev $newrev)" != "$oldrev" ]; then
    echo "ERROR: Non-fast-forward push to main is not allowed."
    exit 1
fi
```

### 8.2 Branch Cleanup and Housekeeping

```bash
# List merged branches
$ git branch --merged main
  feature/auth        # Merged into main
  feature/old-ui      # Merged into main
* main

# List unmerged branches
$ git branch --no-merged main
  feature/wip         # Work in progress

# Bulk delete merged branches
$ git branch --merged main | grep -v '^\*' | grep -v 'main' | xargs git branch -d

# Check for tracking branches deleted on remote but still present locally
$ git remote prune origin --dry-run
Pruning origin
 * [would prune] origin/feature/deleted-remote

# Branch list sorted by last commit date
$ git for-each-ref --sort=-committerdate --format='%(committerdate:short) %(refname:short)' refs/heads/
2024-02-12 main
2024-02-10 feature/auth
2024-01-15 feature/old
2023-11-20 feature/ancient

# Script to detect branches not updated in 3+ months
$ git for-each-ref --sort=committerdate --format='%(committerdate:unix) %(refname:short)' refs/heads/ | \
  while read timestamp branch; do
    if [ "$timestamp" -lt "$(date -d '3 months ago' +%s)" ]; then
      echo "Stale: $branch ($(date -d @$timestamp +%Y-%m-%d))"
    fi
  done
```

### 8.3 Branch Naming Conventions

Summarizing common branch naming patterns used in practice and their impact on internal behavior.

```
┌────────────────────────────────────────────────────────┐
│  Branch naming convention examples                     │
│                                                        │
│  Pattern           Example                  Purpose   │
│  ──────────────────────────────────────────────────── │
│  feature/<name>    feature/user-auth        New feature│
│  bugfix/<name>     bugfix/login-crash       Bug fix    │
│  hotfix/<name>     hotfix/security-patch    Emergency  │
│  release/<ver>     release/2.1.0            Release prep│
│  chore/<name>      chore/update-deps        Maintenance│
│  refactor/<name>   refactor/auth-module     Refactor   │
│                                                        │
│  Note: "feature" and "feature/x" cannot coexist       │
│  → Directory and file naming conflict                  │
│  → Decide on a convention and standardize it as a team │
└────────────────────────────────────────────────────────┘
```

```bash
# Characters not allowed in branch names
# - Spaces, ~, ^, :, ?, *, [, \
# - Names containing ".."
# - Names starting with "."
# - Names ending with "/"
# - Names ending with ".lock"
# - ASCII control characters

# Validating a branch name
$ git check-ref-format --branch "feature/valid-name"
feature/valid-name    # Valid

$ git check-ref-format --branch "feature/invalid..name"
fatal: 'feature/invalid..name' is not a valid branch name
```

---

## 9. Concurrent Access Control for Refs

### 9.1 Mutual Exclusion via Lock Files

Git uses lock files (with a `.lock` suffix) to control concurrent access when updating refs.

```bash
# How locking works
# 1. When updating refs/heads/main:
#    → Create .git/refs/heads/main.lock (acquire exclusive lock)
#    → Write the new SHA-1 to main.lock
#    → Atomically rename main.lock → main
#    → Release lock

# Error when a lock conflict occurs
$ git checkout feature/auth
error: Unable to create '/path/to/repo/.git/refs/heads/main.lock':
  File exists.
Another git process seems to be running in this repository.
If no other git process is running, remove the file manually.

# Force remove lock (only after confirming no other git process is running)
$ rm .git/refs/heads/main.lock

# index.lock uses the same mechanism
$ rm .git/index.lock    # Remove the index lock
```

### 9.2 Ref Updates via CAS (Compare-And-Swap)

```bash
# CAS operation with update-ref
$ git update-ref refs/heads/main <new-sha1> <expected-old-sha1>
# → Updates only if expected-old-sha1 matches the current SHA-1
# → Errors if they do not match (another process updated it first)

# CAS in push (--force-with-lease)
$ git push --force-with-lease origin main
# → Force pushes only if the remote's main has not changed since the last fetch
# → Reduces the risk of overwriting another developer's push

# force-with-lease with an explicit expected value
$ git push --force-with-lease=main:a1b2c3d origin main
# → Force pushes only if the remote's main is a1b2c3d
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Prolonged Work in Detached HEAD

```bash
# Bad: Continuing to work for days in a detached HEAD state
$ git checkout v1.0.0
# (detached HEAD)
$ ... several days of work ...
$ git commit -m "important changes"
# → Creates a commit that does not belong to any branch
# → May be lost to git gc

# Good: Always create a branch before starting work
$ git checkout v1.0.0
$ git checkout -b hotfix/v1.0.0-patch
$ ... work ...
$ git commit -m "important changes"
```

**Reason**: Commits created in detached HEAD become subject to GC as soon as they are no longer reachable from any ref. Once the reflog expiry (default 30 days) passes, they are permanently lost.

### Anti-Pattern 2: Using Reflog as a "Backup" Strategy

```bash
# Bad: "It's fine to do reset --hard because reflog has it"
$ git reset --hard HEAD~5
# → It stays in reflog, but expires in 30–90 days
# → The objects themselves may be deleted by git gc

# Good: Protect explicitly with a branch or tag
$ git tag backup/before-cleanup HEAD
$ git reset --hard HEAD~5
# → Not GC'd as long as the tag exists
```

**Reason**: Reflog is local-only and is not transferred during `git clone` or `git push`. The server side may not have a reflog at all.

### Anti-Pattern 3: Name Collision Between Branch and Tag

```bash
# Bad: Creating a branch with the same name as a tag
$ git tag release-v1.0
$ git branch release-v1.0
# → References become ambiguous; different commands may resolve differently
# → checkout produces a warning, but other commands silently pick one

# Good: Use naming conventions to clearly separate branch and tag namespaces
$ git tag v1.0.0                    # Tags: vX.Y.Z
$ git branch release/1.0.0         # Branches: release/X.Y.Z
```

**Reason**: Due to Git's ref resolution order (tags before branches), when refs with the same name exist, an unexpected ref may be selected.

### Anti-Pattern 4: Manually Editing packed-refs

```bash
# Bad: Editing the packed-refs file directly in a text editor
$ vim .git/packed-refs
# → Sort order may be broken or checksums may become inconsistent

# Good: Operate through Git commands
$ git update-ref refs/heads/main <new-sha1>
$ git pack-refs --all
```

**Reason**: The internal format consistency of packed-refs (sort order, position of peeled lines) is critical, and manual editing carries a high risk of corruption.

### Anti-Pattern 5: Force-Pushing All Branches at Once

```bash
# Bad: Force-pushing all branches at once
$ git push --force --all origin
# → Overwrites all branches on the remote
# → May erase other developers' work

# Good: Force-push only the necessary branch individually
$ git push --force-with-lease origin feature/my-branch
# → Safely force-push only your own branch
```

**Reason**: `--force --all` unconditionally overwrites all remote branches. In team development, it risks rolling back other members' pushes. Using `--force-with-lease` causes the push to be rejected if someone else has pushed in the meantime.

---

## 11. Real-World Scenarios

### Scenario 1: Finding Where a Branch Diverged

```bash
# Find the point where feature/auth diverged from main
$ git merge-base main feature/auth
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

# Count commits since the divergence
$ git rev-list --count main..feature/auth
5    # Commits in feature/auth that are not in main

$ git rev-list --count feature/auth..main
3    # Commits in main that are not in feature/auth

# Visualize the divergence with a graph
$ git log --oneline --graph main feature/auth
* abc1234 (feature/auth) latest feature commit
* def5678 add feature logic
* 789abcd start feature
| * fedcba0 (main) latest main commit
| * 1111111 fix bug
| * 2222222 update docs
|/
* a1b2c3d common ancestor (merge-base)
```

### Scenario 2: Syncing from Multiple Remotes

```bash
# In a forked repository, pull in changes from upstream
$ git remote add upstream https://github.com/original/repo.git
$ git fetch upstream
$ git checkout main
$ git merge upstream/main

# List ref status across multiple remotes
$ git for-each-ref --format='%(refname:short) %(upstream:short) %(upstream:track)' refs/heads/
main origin/main [ahead 0, behind 0]
feature/auth origin/feature/auth [ahead 2]
```

### Scenario 3: Using refs/notes

```bash
# Add a note to a commit
$ git notes add -m "This commit has performance implications" abc1234
# → The note object is stored under refs/notes/commits

# Display the note
$ git log --show-notes abc1234
commit abc1234...
    fix: update query
Notes:
    This commit has performance implications

# Push notes (must be specified explicitly)
$ git push origin refs/notes/commits
```

### Scenario 4: Replacing a Commit with replace refs

```bash
# When you want to fix a commit message without force-pushing
$ git replace abc1234 def5678
# → refs/replace/abc1234 is created
# → Access to abc1234 is transparently redirected to def5678

# Check the replacement
$ git replace -l
abc1234

# Delete the replacement
$ git replace -d abc1234

# Display the replaced commit
$ git log --no-replace-objects abc1234
# → Shows the original commit (ignoring the replacement)
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

### Exercise 2: Applied Pattern

Extend the basic implementation to add the following functionality.

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
- Measure the effect with benchmarks
---

## 12. FAQ

### Q1. Can a branch deleted with `git branch -d` be restored?

**A1.** Yes, it can be restored using reflog.

```bash
$ git reflog
# Find the commit SHA-1 that the deleted branch was pointing to
$ git branch recovered-branch <SHA-1>
```

However, this is only possible within the reflog expiry period. After expiry, you need to search for unreachable objects using `git fsck --lost-found`.

### Q2. What is the difference between HEAD and ORIG_HEAD?

**A2.** `HEAD` is a symbolic reference indicating the current checkout position. `ORIG_HEAD` is a special reference that records the **position of HEAD immediately before operations that significantly move it**, such as `merge`, `rebase`, and `reset`. It is used like `git reset --hard ORIG_HEAD` when you want to undo such operations.

### Q3. How does `refs/stash` work internally?

**A3.** `git stash` saves the working directory changes as commit objects, and `refs/stash` points to the latest stash entry. Past stash entries are retained as reflog entries (`stash@{0}`, `stash@{1}`, ...). Internally, they are composed of ordinary commit/tree/blob objects.

```bash
# Inspect the internal structure of stash
$ git cat-file -p refs/stash
tree d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3
parent a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
parent f5e6d7c8b9a0e1f2d3c4b5a6d7e8f9a0b1c2d3e4
author Gaku <gaku@example.com> 1707600000 +0900
committer Gaku <gaku@example.com> 1707600000 +0900

WIP on main: a1b2c3d commit message

# A stash commit has 2 (or 3, if --include-untracked) parents
# parent 1: the HEAD commit at the time of stash
# parent 2: a commit recording the state of the index
# parent 3: a commit for untracked files (when --include-untracked is used)
```

### Q4. How does the SHA-1 to SHA-256 migration affect refs?

**A4.** Since Git 2.29, experimental support has been added for using SHA-256 as the object hash. In a SHA-256 repository, the hashes stored in ref files are 64 characters long (instead of 40). However, interoperability between SHA-1 and SHA-256 repositories is limited, and migration in practice is still a future concern.

```bash
# Creating a SHA-256 repository (experimental)
$ git init --object-format=sha256 my-repo
$ cd my-repo
$ echo "test" | git hash-object --stdin
# → Returns a 64-character SHA-256 hash
```

### Q5. How can ref operations be monitored with hooks?

**A5.** Using the `reference-transaction` hook (Git 2.28+), all ref updates can be monitored.

```bash
# Example .git/hooks/reference-transaction
#!/bin/bash
# $1 = "prepared" | "committed" | "aborted"
while read oldvalue newvalue refname; do
  if [ "$1" = "committed" ]; then
    echo "Ref updated: $refname $oldvalue -> $newvalue" >> /tmp/git-ref-log.txt
  fi
done
```

### Q6. What is the relationship between git worktree and HEAD?

**A6.** Each worktree has its own HEAD. The main worktree uses `.git/HEAD`, and additional worktrees use `.git/worktrees/<name>/HEAD`. An important constraint is that **multiple worktrees cannot check out the same branch**.

```bash
# Adding a worktree
$ git worktree add ../feature-wt feature/auth
# → .git/worktrees/feature-wt/HEAD = "ref: refs/heads/feature/auth"

# Error when trying to check out the same branch
$ git worktree add ../another-wt feature/auth
fatal: 'feature/auth' is already checked out at '/path/to/feature-wt'

# List worktrees
$ git worktree list
/path/to/main      a1b2c3d [main]
/path/to/feature-wt f5e6d7c [feature/auth]
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend solidly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Concept                | Key Points                                                          |
|------------------------|---------------------------------------------------------------------|
| Ref                    | Pointer to a SHA-1 hash; stored as a text file under `.git/refs/`  |
| Branch                 | Stored in `refs/heads/<name>`; creation and deletion are file ops   |
| HEAD                   | Symbolic reference; normally an indirect reference to a branch      |
| Detached HEAD          | HEAD directly references a commit; dangerous without a branch       |
| Reflog                 | History of ref changes; local-only; expires in 30–90 days          |
| packed-refs            | Optimization for large numbers of refs; loose refs take priority    |
| Remote-tracking branch | `refs/remotes/<remote>/<branch>`; updated on fetch                 |
| Lightweight tag        | Ref pointing directly to a commit; no metadata                     |
| Annotated tag          | Goes through a tag object; stores author, message, and signature   |
| Symbolic reference     | Indirect reference to another ref; HEAD is the prime example       |
| Lock file              | `.lock` suffix; provides mutual exclusion for concurrent access     |
| ORIG_HEAD              | Records HEAD position before destructive operations; used to undo  |

---

## What to Read Next

- [Git Object Model](./00-git-object-model.md) — Fundamentals of blob/tree/commit/tag
- [Merge Algorithms](./02-merge-algorithms.md) — Internal workings of 3-way merge and ort
- [Packfile/GC](./03-packfile-gc.md) — Object compression and garbage collection
- [Interactive Rebase](../01-advanced-git/00-interactive-rebase.md) — HEAD rewriting operations

---

## References

1. **Pro Git Book** — Scott Chacon, Ben Straub "Git Internals - Git References" https://git-scm.com/book/en/v2/Git-Internals-Git-References
2. **Git Official Documentation** — `git-symbolic-ref`, `git-reflog`, `git-update-ref`, `git-for-each-ref` https://git-scm.com/docs
3. **GitHub Blog** — "Commits are snapshots, not diffs" https://github.blog/2020-12-17-commits-are-snapshots-not-diffs/
4. **Git Official Documentation** — `git-pack-refs`, `git-check-ref-format` https://git-scm.com/docs
5. **Derrick Stolee** — "Scaling monorepo maintenance" https://github.blog/2021-04-29-scaling-monorepo-maintenance/
6. **Git Reference Transaction Hook** — https://git-scm.com/docs/githooks#_reference_transaction
7. **reftable specification** — https://www.git-scm.com/docs/reftable
