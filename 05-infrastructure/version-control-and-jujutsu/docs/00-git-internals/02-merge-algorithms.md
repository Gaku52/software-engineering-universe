# Merge Algorithms

> An explanation of Git's merge strategies (3-way merge, recursive, ort) and the internal workings of rebase, covering the principles of conflict resolution and criteria for choosing a merge strategy.

## What You Will Learn in This Chapter

1. **Principles of 3-way merge** — The fundamental algorithm for merging using a common ancestor
2. **Differences and use cases for Git merge strategies** (recursive, ort, octopus, ours)
3. **Internal workings of rebase** — Rebase as a chain of cherry-picks, and a comparison with merge
4. **Conflict resolution in detail** — Stage numbers, markers, rerere, and manual resolution patterns
5. **Rename detection and diff algorithms** — Detection logic that affects merge quality


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content of [Refs & Branches](./01-refs-and-branches.md)

---

## 1. 2-way merge vs 3-way merge

### 1.1 Limitations of 2-way merge

```
File states:
  Branch A:  Line 1 / Line 2-modified / Line 3
  Branch B:  Line 1 / Line 2          / Line 3-modified

2-way merge (comparing only A and B):
  → Line 2 differs. Which is correct? Cannot determine.
  → Line 3 differs. Which is correct? Cannot determine.
  → All differences become conflicts.
```

A 2-way merge is an algorithm that simply "directly compares two versions." When a difference is found, it cannot determine which version represents an "intentional change" versus the "original," so it reports all differences as conflicts. This is extremely cumbersome for users and is not practical.

Actual patch tools (`diff` + `patch`) or editor merge features may only be able to perform this 2-way comparison. In that case, developers must manually judge every difference.

### 1.2 Principles of 3-way merge

```
Common ancestor (Base): Line 1 / Line 2          / Line 3
Branch A:               Line 1 / Line 2-modified / Line 3
Branch B:               Line 1 / Line 2          / Line 3-modified

3-way merge (comparing Base + A + B):
  Line 1: A=Base, B=Base → No change      → "Line 1"
  Line 2: A≠Base, B=Base → A changed     → "Line 2-modified"
  Line 3: A=Base, B≠Base → B changed     → "Line 3-modified"

Result: Line 1 / Line 2-modified / Line 3-modified
  → No conflict!
```

```
┌─────────────────────────────────────────────────────┐
│           3-way merge Algorithm                     │
│                                                     │
│           Base (common ancestor)                    │
│           /          \                              │
│          /            \                             │
│    Branch A        Branch B                         │
│          \            /                             │
│           \          /                              │
│        3-way merge decision                         │
│                                                     │
│  For each line:                                     │
│  ┌──────────┬──────────┬───────────────────────┐    │
│  │ A=Base?  │ B=Base?  │ Result                │    │
│  ├──────────┼──────────┼───────────────────────┤    │
│  │ Yes      │ Yes      │ Base (no change)      │    │
│  │ No       │ Yes      │ Adopt A               │    │
│  │ Yes      │ No       │ Adopt B               │    │
│  │ No       │ No       │ Adopt if A=B,         │    │
│  │          │          │ conflict if A≠B       │    │
│  └──────────┴──────────┴───────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 1.3 Detailed Decision Logic for 3-way merge

In a 3-way merge, the file is split into lines (hunks), and the diff from the common ancestor is calculated for each line. The details of the decision logic are as follows.

```
┌───────────────────────────────────────────────────────┐
│  Detailed Decision Flow for 3-way merge               │
│                                                       │
│  Input: Three files — Base, Ours (A), Theirs (B)      │
│                                                       │
│  Step 1: diff(Base, A) → generate patchA              │
│  Step 2: diff(Base, B) → generate patchB              │
│                                                       │
│  Step 3: Classify each hunk in patchA and patchB      │
│                                                       │
│  Case 1: hunk exists only in patchA                   │
│    → Adopt A's change                                 │
│                                                       │
│  Case 2: hunk exists only in patchB                   │
│    → Adopt B's change                                 │
│                                                       │
│  Case 3: same hunk exists in both patchA and patchB   │
│    3a: Changes are identical → adopt one (dup change) │
│    3b: Changes differ but line ranges don't overlap   │
│        → adopt both                                   │
│    3c: Changes differ and line ranges overlap         │
│        → conflict                                     │
│                                                       │
│  Case 4: line exists in neither patch                 │
│    → Keep Base content as-is                          │
└───────────────────────────────────────────────────────┘
```

### 1.4 3-way merge for Non-Text Lines

The 3-way merge is fundamentally based on line-by-line comparison, but special handling is required in the following cases.

```bash
# For binary files
$ git merge feature
# warning: Cannot merge binary files: assets/logo.png
# → Binary files cannot be split into lines, so they are always treated as conflicts
# → Manually select either ours/theirs

# Resolving binary conflicts
$ git checkout --ours assets/logo.png     # adopt our side
$ git checkout --theirs assets/logo.png   # adopt their side
$ git add assets/logo.png

# Custom merge driver configuration
$ cat .gitattributes
*.psd merge=binary        # treat as binary (always conflict)
*.lock merge=ours         # always adopt our side (lock files)
*.pbxproj merge=union     # combine both changes (Xcode project)
```

```bash
# Defining merge drivers
$ git config merge.union.driver "union-merge %O %A %B"
$ git config merge.custom.driver "custom-merge-tool %O %A %B %P"
# %O = common ancestor (base)
# %A = our side (ours)
# %B = their side (theirs)
# %P = file path
```

---

## 2. Identifying the Common Ancestor (merge base)

### 2.1 Basic merge base

```bash
# Identify the common ancestor of two branches
$ git merge-base main feature/auth
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0

# When multiple common ancestors exist (criss-cross merge)
$ git merge-base --all main feature/auth
a1b2c3d4...
f5e6d7c8...
```

```
Simple case:
       o---o---o  feature
      /
 o---o---o---o  main
      ^
      merge base (one)

criss-cross merge (multiple common ancestors):
       o---A---o  feature
      / \ / \
 o---o   X   o---?
      \ / \ /
       o---B---o  main
           ^
      merge base is both A and B
```

### 2.2 Algorithm for Computing the merge base

Computing the merge base reduces to the LCA (Lowest Common Ancestor) problem on a DAG (Directed Acyclic Graph).

```
┌────────────────────────────────────────────────────────┐
│  LCA (Lowest Common Ancestor) Computation              │
│                                                        │
│  Git DAG:                                              │
│      A---B---C---D  main                               │
│       \         /                                      │
│        E---F---G    feature                            │
│                                                        │
│  Compute LCA(D, G):                                    │
│  1. Ancestor set of D: {D, C, B, A, G, F, E}          │
│  2. Ancestor set of G: {G, F, E, A}                    │
│  3. Common ancestors: {A, G, F, E} ∩ {D, C, B, A, G, F, E} │
│  4. The "lowest" (most recent) common ancestor = A     │
│                                                        │
│  Implementation: BFS from both sides simultaneously,   │
│  find the first convergence point                      │
└────────────────────────────────────────────────────────┘
```

```bash
# Detailed verification of the merge base
$ git merge-base --is-ancestor A B
# exit 0: A is an ancestor of B
# exit 1: A is not an ancestor of B

# Detecting the fork-point (reflog-based)
$ git merge-base --fork-point main feature
# → Detects the exact point where feature diverged from main
# → Uses reflog, so it handles cases where main has been rebased

# merge base for octopus merge
$ git merge-base --octopus branch-a branch-b branch-c
# → Computes the common ancestor of 3 branches
```

### 2.3 Details of criss-cross merge

A criss-cross merge is a complex history pattern where multiple common ancestors exist.

```
criss-cross merge occurrence pattern:

Step 1: Initial state
  A---B  main
   \
    C  feature

Step 2: Merge feature into main (M1)
  A---B---M1  main
   \     /
    C---+     feature

Step 3: Merge main into feature (M2)
  A---B---M1  main
   \     / \
    C---+---M2  feature

Step 4: Both branches advance independently
  A---B---M1---D  main
   \     / \
    C---+---M2---E  feature

Step 5: Want to merge main and feature
  merge-base(D, E) = {M1, M2} ← Two common ancestors!

Resolution (recursive/ort strategy):
  1. Virtually merge M1 and M2 to create V (virtual common ancestor)
  2. Execute 3-way merge using V
```

---

## 3. Git Merge Strategies

### 3.1 List and Comparison of Strategies

| Strategy   | Target     | Handling of Common Ancestor        | Use Case                        |
|------------|------------|------------------------------------|---------------------------------|
| `ort`      | 2 branches | Build virtual common ancestor recursively | Default (Git 2.34+)        |
| `recursive`| 2 branches | Build virtual common ancestor recursively | Old default (Git 2.33 and earlier) |
| `resolve`  | 2 branches | Use only one                       | Simple cases                    |
| `octopus`  | 3+ branches| Common ancestor for each pair      | Batch merge of multiple branches|
| `ours`     | N branches | Not used                           | Force-adopt our side            |
| `subtree`  | 2 branches | Subtree-aware                      | Subproject integration          |

### 3.2 The ort Strategy (Ostensibly Recursive's Twin)

The default since Git 2.34. A complete rewrite of `recursive`.

```bash
# Explicit use of ort strategy
$ git merge -s ort feature/auth

# Options for ort strategy
$ git merge -X ours feature/auth      # prioritize our side on conflict
$ git merge -X theirs feature/auth    # prioritize their side on conflict
$ git merge -X patience feature/auth  # use patience diff algorithm
```

**Advantages of ort over recursive**:

| Item              | recursive            | ort                    |
|-------------------|----------------------|------------------------|
| Performance       | O(n^2) in some cases | Always O(n log n)      |
| Temporary files   | Uses working directory | Completes in memory  |
| Rename detection  | Can be slow          | Faster                 |
| Clean implementation | Complex due to history | Redesigned from scratch |
| Parallelism       | Not supported        | Partially parallelizable |
| Memory usage      | Heavy disk I/O       | Efficient in memory    |

```bash
# Example showing ort's performance improvement (large repository)
# Benchmark on Linux kernel repository (reference values)
# recursive: 25.3 seconds
# ort:        4.1 seconds  (approx. 6x faster)

# Confirming that ort does not use the working directory
$ git merge -s ort feature/auth
# → Working directory files are not temporarily modified during the merge
# → Safe for other processes to reference files simultaneously
```

### 3.3 Recursive Merging in the recursive Strategy

When multiple common ancestors exist in a criss-cross merge:

```
Steps:
1. Discover multiple common ancestors (A, B)
2. (Recursively) merge A and B to create virtual common ancestor V
3. Execute a normal 3-way merge using V as the base

       o---A---o---o  feature
      / \ / \       \
 o---o   X   o      merge
      \ / \ /       /
       o---B---o---o  main

 1. merge-base(feature, main) = {A, B}
 2. V = merge(A, B)    ← recursive merge
 3. result = 3-way-merge(V, feature, main)
```

```bash
# Recursion depth limit for recursive strategy
# By default there is no limit on recursion depth (not a practical concern)
# Theoretically cannot loop infinitely (ancestors are always finite in a DAG)

# If a conflict occurs while creating the virtual common ancestor with recursive
# → Creates the virtual common ancestor in a state containing conflict markers
# → May affect the conflict resolution result of the final merge
```

### 3.4 The resolve Strategy

```bash
# resolve strategy: when multiple common ancestors exist, select only one
$ git merge -s resolve feature/auth

# Use cases:
# - There are cases where recursive/ort causes a conflict but resolve succeeds
# - When you want to use a specific common ancestor in a criss-cross merge situation
# - Very rarely used for debugging purposes
```

### 3.5 The octopus Strategy

```bash
# Simultaneously merge 3 or more branches
$ git merge feature/a feature/b feature/c
# → octopus strategy is automatically selected

# Constraints of the octopus strategy
# - If a conflict occurs, the process is automatically aborted
# - Manual conflict resolution is not possible
# - If conflicts are expected, merge individually
```

```
┌────────────────────────────────────────────────────┐
│  octopus merge behavior                            │
│                                                    │
│  Input: main, feature/a, feature/b, feature/c     │
│                                                    │
│  Step 1: merge main + feature/a → intermediate 1  │
│  Step 2: merge intermediate 1 + feature/b → inter 2│
│  Step 3: merge intermediate 2 + feature/c → final │
│                                                    │
│  Conflict at any step → abort everything           │
│                                                    │
│  Resulting commit:                                 │
│      feature/a  feature/b  feature/c               │
│           \         |         /                    │
│            \        |        /                     │
│             o───────o───────o                      │
│                     |                              │
│                   merge                            │
│                     |                              │
│                   main                             │
│  → Merge commit with 3 parents                    │
└────────────────────────────────────────────────────┘
```

### 3.6 The ours Strategy (ours as a Merge Strategy)

```bash
# -s ours: ours as a strategy (completely ignores the other side's changes)
$ git merge -s ours feature/deprecated
# → Keeps the content of our side (HEAD) as-is
# → None of the changes from feature/deprecated are reflected
# → However, it is recorded in history as merged

# Main use cases:
# 1. Close out the history of an unnecessary branch
# 2. Skip unwanted changes from a release branch
# 3. Intentionally reject changes from a specific branch

# Important: -s ours and -X ours are completely different
$ git merge -s ours feature    # strategy: ignore all of their changes
$ git merge -X ours feature    # option: prefer our side only on conflict
```

### 3.7 The subtree Strategy

```bash
# subtree strategy: subproject integration
$ git merge -s subtree library-repo/main

# Example: integrate code from another repository into a subdirectory
$ git remote add library-repo https://github.com/example/lib.git
$ git fetch library-repo
$ git merge -s subtree --allow-unrelated-histories library-repo/main

# How the subtree strategy works:
# 1. Auto-detects if the other side's file tree corresponds to a subdirectory on our side
# 2. Adjusts path mappings, then executes a 3-way merge
# 3. Also used internally by the git-subtree command
```

### 3.8 fast-forward Merge

```bash
# When fast-forward is possible
#   main:    A---B
#   feature: A---B---C---D

$ git checkout main
$ git merge feature
# → Just moves main's pointer to D (no new commit created)

# Force --no-ff (no fast-forward)
$ git merge --no-ff feature
# → Always creates a merge commit

# fast-forward only (error if not possible)
$ git merge --ff-only feature
```

```
┌──────────────────────────────────────────┐
│  fast-forward merge                      │
│                                          │
│  Before:                                 │
│  main ──→ A ── B                         │
│                  \                        │
│                   C ── D ←── feature      │
│                                          │
│  After (--ff):                           │
│  main ──────────────→ D ←── feature      │
│  (commit history: A-B-C-D)               │
│                                          │
│  After (--no-ff):                        │
│  main ──→ A ── B ──────── M             │
│                  \        /              │
│                   C ── D ←── feature     │
│  (M is the merge commit)                 │
└──────────────────────────────────────────┘
```

```bash
# Recommended team setting: force --no-ff
$ git config merge.ff false
# → A merge commit is created for every merge
# → Makes it clear from history "when" something was merged

# For personal branches: use --ff-only with the rebase + ff-only workflow
$ git config pull.ff only
# → Error if pull cannot fast-forward (prompts a rebase)
```

---

## 4. Internal Workings of Conflict Resolution

### 4.1 Stage Numbers in the Staging Area

During a conflict, three versions of the same file are stored in the index.

```bash
# Check the index in a conflicted state
$ git ls-files -u
100644 abc123... 1	src/auth.js    # Stage 1: common ancestor (base)
100644 def456... 2	src/auth.js    # Stage 2: our side (ours / HEAD)
100644 789abc... 3	src/auth.js    # Stage 3: their side (theirs / MERGE_HEAD)

# Check the content of each stage
$ git show :1:src/auth.js    # base
$ git show :2:src/auth.js    # ours
$ git show :3:src/auth.js    # theirs

# Meaning of stage numbers
# Stage 0: Normal file (no conflict)
# Stage 1: Base (common ancestor)
# Stage 2: Ours (HEAD side)
# Stage 3: Theirs (MERGE_HEAD side)
```

```
┌───────────────────────────────────────────────────────┐
│  Index state during a conflict                        │
│                                                       │
│  Normal:                                              │
│  ┌────────┬──────────┬──────────────┐                │
│  │ Stage  │ SHA-1    │ Filename     │                │
│  ├────────┼──────────┼──────────────┤                │
│  │ 0      │ abc123.. │ src/auth.js  │                │
│  │ 0      │ def456.. │ src/utils.js │                │
│  └────────┴──────────┴──────────────┘                │
│                                                       │
│  During conflict:                                     │
│  ┌────────┬──────────┬──────────────┐                │
│  │ Stage  │ SHA-1    │ Filename     │                │
│  ├────────┼──────────┼──────────────┤                │
│  │ 1      │ 111aaa.. │ src/auth.js  │ ← base        │
│  │ 2      │ 222bbb.. │ src/auth.js  │ ← ours        │
│  │ 3      │ 333ccc.. │ src/auth.js  │ ← theirs      │
│  │ 0      │ def456.. │ src/utils.js │ ← normal      │
│  └────────┴──────────┴──────────────┘                │
│                                                       │
│  After git add src/auth.js:                           │
│  Stages 1, 2, 3 are removed; resolved version        │
│  is stored in Stage 0                                 │
└───────────────────────────────────────────────────────┘
```

### 4.2 Conflict Markers

```javascript
// Contents of a file with a conflict
function authenticate(user) {
<<<<<<< HEAD
  return bcrypt.compare(user.password, hash);
||||||| abc123 (when merge.conflictStyle = zdiff3)
  return checkPassword(user.password);
=======
  return argon2.verify(hash, user.password);
>>>>>>> feature/auth
}
```

```bash
# Configure conflict style
$ git config merge.conflictStyle zdiff3
# zdiff3: base (common ancestor) content is also shown → easier to judge

# Available conflict styles
# merge: Default. Shows only ours/theirs
# diff3: Shows base + ours + theirs
# zdiff3: Improved version of diff3. Omits common parts between base and ours/theirs (Git 2.35+)
```

```
┌────────────────────────────────────────────────────────┐
│  Comparison of conflict styles                         │
│                                                        │
│  merge (default):                                      │
│  <<<<<<< HEAD                                          │
│    return bcrypt.compare(user.password, hash);         │
│  =======                                               │
│    return argon2.verify(hash, user.password);          │
│  >>>>>>> feature/auth                                  │
│  → Base is not visible, making it hard to judge        │
│    "what was changed"                                  │
│                                                        │
│  diff3:                                                │
│  <<<<<<< HEAD                                          │
│    return bcrypt.compare(user.password, hash);         │
│  ||||||| merged common ancestors                       │
│    return checkPassword(user.password);                │
│  =======                                               │
│    return argon2.verify(hash, user.password);          │
│  >>>>>>> feature/auth                                  │
│  → Base is visible, so the intent of the change is     │
│    clear                                               │
│                                                        │
│  zdiff3 (recommended):                                 │
│  <<<<<<< HEAD                                          │
│    return bcrypt.compare(user.password, hash);         │
│  ||||||| abc123                                        │
│    return checkPassword(user.password);                │
│  =======                                               │
│    return argon2.verify(hash, user.password);          │
│  >>>>>>> feature/auth                                  │
│  → Same as diff3, but omits common lines for           │
│    better readability                                  │
└────────────────────────────────────────────────────────┘
```

### 4.3 rerere (Reuse Recorded Resolution)

```bash
# Enable rerere
$ git config rerere.enabled true

# How it works:
# 1. Conflict occurs → record the conflict pattern
# 2. Resolve manually → save the resolution in .git/rr-cache/
# 3. Same conflict recurs → automatically apply the previous resolution

# Check recorded resolutions
$ git rerere status
$ git rerere diff

# Manually manage the rerere cache
$ git rerere forget <pathspec>       # delete records for a specific file
$ git rerere gc                       # delete old records
```

```bash
# Concrete usage scenario for rerere

# Scenario: the same conflict occurs every time you rebase the feature branch onto main

# 1st time: resolve manually
$ git rebase main
# CONFLICT! src/config.js
$ vim src/config.js       # resolve manually
$ git add src/config.js
$ git rebase --continue
# → rerere records the resolution pattern

# 2nd time and beyond: resolved automatically
$ git rebase main
# CONFLICT! src/config.js
# Resolved 'src/config.js' using previous resolution.
$ git add src/config.js    # confirm rerere's resolution and add
$ git rebase --continue

# Contents of the rerere cache
$ ls .git/rr-cache/
abc123def456.../
├── preimage    # conflict state (with markers)
└── postimage   # state after resolution
```

### 4.4 Best Practices for Conflict Resolution

```bash
# Check conflicts
$ git diff --name-only --diff-filter=U
# → List of files with conflicts

# Count conflict locations in each file
$ grep -c "<<<<<<< HEAD" src/auth.js
3

# Batch-resolve with ours/theirs
$ git checkout --ours src/auth.js      # batch-resolve with our side
$ git checkout --theirs src/auth.js    # batch-resolve with their side
$ git add src/auth.js

# Interactive resolution using merge-tool
$ git mergetool
# → Launches the configured merge tool (vimdiff, meld, kdiff3, etc.)

# Configure merge tool
$ git config merge.tool vimdiff
$ git config mergetool.vimdiff.layout "LOCAL,BASE,REMOTE / MERGED"
$ git config mergetool.keepBackup false
# keepBackup=false: do not create .orig files
```

```bash
# Aborting and resuming a merge
$ git merge --abort         # fully abort the merge (return to pre-merge state)
$ git merge --quit          # abort the merge (keep working directory changes)
$ git merge --continue      # continue the merge after resolving conflicts

# Conflicts during rebase
$ git rebase --abort        # fully abort the rebase
$ git rebase --skip         # skip the current commit and continue
$ git rebase --continue     # continue the rebase after resolving conflicts
```

### 4.5 Complex Conflict Resolution Patterns

```bash
# Pattern 1: incorporate changes from both sides (manual merge)
# Before:
# <<<<<<< HEAD
#   validateEmail(email);
#   validatePassword(password);
# =======
#   validateEmail(email);
#   sanitizeInput(email);
# >>>>>>> feature/security

# After: (adopt both changes)
#   validateEmail(email);
#   validatePassword(password);
#   sanitizeInput(email);

# Pattern 2: structural conflict (function order changed)
# → Can sometimes be improved by changing the diff algorithm
$ git merge -X diff-algorithm=histogram feature
$ git merge -X diff-algorithm=patience feature

# Pattern 3: efficiently resolve a large number of conflicts
# List and count conflicting files
$ git diff --name-only --diff-filter=U | wc -l
42

# Batch resolution based on pattern
$ git diff --name-only --diff-filter=U | xargs -I{} git checkout --theirs {}
$ git diff --name-only --diff-filter=U | xargs git add
# → resolve everything with theirs (assuming content will be reviewed later)
```

---

## 5. Internal Workings of Rebase

### 5.1 How Rebase Works

```bash
$ git checkout feature
$ git rebase main
```

```
Before:
     C---D---E  feature (HEAD)
    /
A---B---F---G  main

Internal rebase steps:
1. Identify common ancestor B of feature and main
2. Get the patch for each commit (C, D, E) in B..feature
3. Apply patches sequentially on top of main (G) (cherry-pick)
4. Update the feature ref to the last commit

After:
                C'---D'---E'  feature (HEAD)
               /
A---B---F---G  main

* C', D', E' are new commit objects (different SHA-1)
* Original C, D, E are reachable from reflog (kept until GC)
```

### 5.2 Internal Implementation of Rebase (a Chain of cherry-picks)

```bash
# The internal behavior of rebase is equivalent to the following cherry-picks
$ git checkout main                # move to main
$ git cherry-pick C               # apply C → C'
$ git cherry-pick D               # apply D → D'
$ git cherry-pick E               # apply E → E'
$ git branch -f feature HEAD      # update feature
$ git checkout feature             # move to feature

# However, the actual rebase:
# 1. Runs in a detached HEAD state
# 2. Saves the HEAD before rebase to ORIG_HEAD
# 3. Saves state in .git/rebase-merge/ or .git/rebase-apply/
# 4. Updates the ref after all cherry-picks are complete
```

```
┌───────────────────────────────────────────────────────┐
│  .git directory state during rebase                   │
│                                                       │
│  .git/rebase-merge/                                   │
│  ├── head-name     ← "refs/heads/feature"             │
│  ├── onto          ← commit SHA-1 of rebase target    │
│  ├── orig-head     ← HEAD SHA-1 before rebase         │
│  ├── msgnum        ← currently processing commit #    │
│  ├── end           ← total number of commits to process│
│  ├── interactive   ← flag for interactive mode        │
│  └── done          ← list of processed commands       │
│                                                       │
│  These files are used to manage the state for         │
│  rebase interruption and resumption                   │
│  rebase --abort deletes this directory                │
└───────────────────────────────────────────────────────┘
```

### 5.3 Differences Between rebase and cherry-pick

```bash
# cherry-pick: apply a specific commit to the current branch
$ git cherry-pick abc123
# → Applies the change (diff) from abc123 to the current HEAD
# → A new commit is created (inheriting the message of the original commit)
# → The same change exists as separate commits in both source and destination

# rebase: move the entire branch
$ git rebase main
# → Internally a chain of cherry-picks, but the branch ref is also updated
# → The only reference to the original commits is the reflog
```

```bash
# Detailed options for cherry-pick
$ git cherry-pick abc123 --no-commit
# → Applies the change but does not create a commit (only reflects in working directory)

$ git cherry-pick abc123..def456
# → cherry-pick multiple commits using a range

$ git cherry-pick -x abc123
# → Appends "(cherry picked from commit abc123)" to the commit message
# → Useful for tracking

$ git cherry-pick -m 1 MERGE_COMMIT
# → cherry-pick a merge commit (-m 1 uses the first parent as the base)
```

### 5.4 rebase vs merge

```bash
# merge: preserves history, creates a merge commit
$ git checkout main
$ git merge feature

# rebase: linearizes history, no merge commit
$ git checkout feature
$ git rebase main
$ git checkout main
$ git merge feature  # fast-forward
```

| Item                    | merge                          | rebase                         |
|-------------------------|--------------------------------|--------------------------------|
| History shape           | Branches and merges remain     | Becomes linear                 |
| Commit identity         | Preserves original SHA-1       | SHA-1 changes                  |
| Conflict resolution     | Only once                      | Can occur for each commit      |
| Public branches         | Safe                           | Dangerous (requires push --force) |
| bisect suitability      | Merge commits can get in the way | Linear history eases bisection |
| Undoability             | Can be undone with git revert  | Requires restoration from reflog |
| Traceability            | Merge commit serves as milestone | History can be flat and hard to follow |

### 5.5 rebase --onto

```bash
# --onto: more flexible specification of rebase target
$ git rebase --onto NEW_BASE OLD_BASE BRANCH

# Use case 1: move only part of a feature branch to another branch
# Before:
#     C---D---E  feature (HEAD)
#    /
# A---B---F  main
#        \
#         G---H  release

# Want to move only D, E from feature to release
$ git rebase --onto release C feature
# → D'---E' are created on top of release

# Use case 2: rebase while skipping already-merged commits
# Before:
#     C---D---E---F  feature
#    /       \
# A---B-------M  main (D is already merged)

# rebase feature onto main, excluding D
$ git rebase --onto main D feature
# → C'---E'---F' are created on top of main
```

```
┌────────────────────────────────────────────────────────┐
│  Diagram of rebase --onto behavior                     │
│                                                        │
│  git rebase --onto NEW_BASE OLD_BASE BRANCH            │
│                                                        │
│  1. Extract commits in the range OLD_BASE..BRANCH      │
│  2. cherry-pick onto NEW_BASE                          │
│  3. Update BRANCH ref                                  │
│                                                        │
│  Example: git rebase --onto release C feature          │
│                                                        │
│  Before:                                               │
│      C---D---E  feature                                │
│     /                                                  │
│  A---B---F  main                                       │
│         \                                              │
│          G---H  release                                │
│                                                        │
│  Extraction range: C..feature = {D, E}                 │
│  Apply to: release (H)                                 │
│                                                        │
│  After:                                                │
│      C  (orphaned)                                     │
│     /                                                  │
│  A---B---F  main                                       │
│         \                                              │
│          G---H  release                                │
│                \                                       │
│                 D'---E'  feature                        │
└────────────────────────────────────────────────────────┘
```

---

## 6. Diff Algorithms

Merge quality depends heavily on the diff algorithm. Git supports multiple diff algorithms.

### 6.1 Available Algorithms

```bash
# Specify the diff algorithm
$ git diff --diff-algorithm=myers      # default (Myers)
$ git diff --diff-algorithm=minimal    # minimal diff (slow but precise)
$ git diff --diff-algorithm=patience   # patience diff
$ git diff --diff-algorithm=histogram  # histogram diff

# Persistent configuration
$ git config diff.algorithm histogram
```

| Algorithm   | Characteristics                                        | Use Case                          |
|-------------|--------------------------------------------------------|-----------------------------------|
| `myers`     | Default, fast, LCS (Longest Common Subsequence)-based  | General purpose                   |
| `minimal`   | Guarantees minimal diff, slow                          | When precision of diff matters    |
| `patience`  | Calculates diff using unique lines as anchors          | When structural changes are frequent |
| `histogram` | Improved patience, handles repeated lines well         | Recommended (high quality in most cases) |

### 6.2 How patience diff Works

```
┌────────────────────────────────────────────────────────┐
│  patience diff Algorithm                               │
│                                                        │
│  1. Extract lines that are unique (appear only once)   │
│     in both files                                      │
│  2. Compute LCS of the unique lines                    │
│  3. Use the LCS as anchors to determine the "skeleton" │
│     of the diff                                        │
│  4. Process regions between anchors with Myers diff    │
│                                                        │
│  Benefits:                                             │
│  - Handles function moves and reordering well          │
│  - Not thrown off by blank lines or brace-only lines   │
│  - More likely to produce semantically correct diffs   │
│                                                        │
│  Example:                                              │
│  File A:              File B:                          │
│  function foo() {     function bar() {                 │
│    return 1;            return 42;                     │
│  }                    }                                │
│  function bar() {     function foo() {                 │
│    return 42;           return 1;                      │
│  }                    }                                │
│                                                        │
│  Myers: diff may shift at the "}" position             │
│  Patience: function names are unique, so they anchor   │
│  → Correctly detects "foo/bar order was swapped"       │
└────────────────────────────────────────────────────────┘
```

---

## 7. Rename Detection

```bash
# Git does not explicitly record renames
# During merges, renames are detected heuristically

# Set the threshold (similarity) for rename detection
$ git merge -X rename-threshold=50 feature
# → Detected as a rename if similarity is 50% or more

# Rename detection in diff
$ git diff --find-renames=50 HEAD~1
# rename src/old.js => src/new.js (85%)

# Copy detection is also possible
$ git diff --find-copies --find-copies-harder HEAD~1
# copy src/template.js => src/new-page.js (72%)
```

```
┌──────────────────────────────────────────────────┐
│  How rename detection works                      │
│                                                  │
│  Base:    src/auth.js (content A)                │
│  Ours:    src/auth.js (content A') ← modified    │
│  Theirs:  lib/auth.js (content A)  ← file moved │
│                                                  │
│  Detection flow:                                 │
│  1. Detect src/auth.js deleted,                  │
│     lib/auth.js added in Base→Theirs             │
│  2. Calculate content similarity (A vs A: 100%)  │
│  3. Determine as rename                          │
│     "src/auth.js → lib/auth.js"                  │
│  4. Apply Ours' modifications to lib/auth.js     │
│                                                  │
│  Result: lib/auth.js (content A') ← move+modify │
└──────────────────────────────────────────────────┘
```

### 7.1 Performance of Rename Detection

```bash
# Limit setting for rename detection
$ git config merge.renameLimit 10000
# Default: 7000
# → Upper limit on the number of combinations of added+deleted files
# → If exceeded, rename detection is skipped

$ git config diff.renameLimit 10000
# Rename detection limit during diff

# Rename detection speedups in the ort strategy
# ort performs the following optimizations:
# 1. Directory rename detection (per directory rather than per file)
# 2. Caching results from previous merges
# 3. Skipping unnecessary similarity calculations
```

### 7.2 Directory Rename Detection

```bash
# The ort strategy also detects directory renames

# Example:
# Base: src/components/auth/login.js, src/components/auth/register.js
# Ours: src/modules/auth/login.js, src/modules/auth/register.js (directory moved)
# Theirs: src/components/auth/login.js, src/components/auth/register.js,
#          src/components/auth/forgot-password.js (new file added)

# Result with ort strategy:
# → Detects directory rename src/components/auth/ → src/modules/auth/
# → Theirs' new file is also placed at src/modules/auth/forgot-password.js
# → No need to manually move files
```

---

## 8. Advanced Merge Options

### 8.1 List of Merge Options (-X)

```bash
# Conflict resolution options
$ git merge -X ours feature         # prioritize our side on conflict
$ git merge -X theirs feature       # prioritize their side on conflict

# Whitespace handling
$ git merge -X ignore-space-change feature    # ignore changes in amount of whitespace
$ git merge -X ignore-all-space feature       # ignore all whitespace
$ git merge -X ignore-space-at-eol feature    # ignore trailing whitespace

# Rename
$ git merge -X rename-threshold=40 feature    # change rename detection threshold

# Diff algorithm
$ git merge -X diff-algorithm=histogram feature

# Subtree
$ git merge -X subtree=path/to/dir feature    # specify subtree path

# find-renames (fine-grained control of rename detection)
$ git merge -X find-renames=30 feature        # judge as rename at 30% match
```

### 8.2 --no-commit and --squash

```bash
# --no-commit: leave the merge result in the stage without committing
$ git merge --no-commit feature
# → Does not commit even if there is no conflict
# → You can review/edit the content and commit manually
$ git diff --staged   # check the merge result
$ git commit -m "merge: feature branch with modifications"

# --squash: combine the merge result into a single commit
$ git merge --squash feature
# → Applies all of feature's changes to the working directory and index
# → Recorded as a normal commit rather than a merge commit
# → Only HEAD is the parent (no reference to the feature branch)
$ git commit -m "feat: squash merge of feature branch"

# Note: --squash does not record the feature branch as "merged"
# → Trying to merge the same feature branch again will cause conflicts
# → The feature branch should be deleted after use
```

---

## 9. Anti-patterns

### Anti-pattern 1: Rebasing a Published Branch

```bash
# Bad: rebase a shared branch like main or develop
$ git checkout main
$ git rebase feature
$ git push --force origin main
# → History becomes inconsistent with other members' local main
# → Other members need to force reset --hard

# Good: only rebase your own personal feature branches
$ git checkout feature/my-work
$ git rebase main
$ git push --force-with-lease origin feature/my-work
# --force-with-lease: rejected if someone else pushed in the meantime
```

**Reason**: Rebase changes the SHA-1 of commits. When the SHA-1 of a shared branch changes, it creates an inconsistency with other developers' local histories, risking data loss.

### Anti-pattern 2: Misuse of the `ours` Merge Strategy

```bash
# Bad: use the "ours" strategy to completely ignore the other side's changes
$ git merge -s ours feature/important-fix
# → None of the changes in feature/important-fix are reflected
# → Looks merged in history, so re-merging is also not possible

# Good: only use when intentionally closing out history
$ git merge -s ours legacy/deprecated-feature
# → Used as a clear statement that "the content of this branch is not needed"
```

**Reason**: `-s ours` is a merge "strategy," and is completely different from `-X ours` (a merge "option") used during conflict. The former discards all changes from the other side.

### Anti-pattern 3: Resolving Conflicts Without Understanding Them

```bash
# Bad: batch-resolve without checking conflict contents
$ git checkout --theirs .
$ git add .
$ git commit
# → Your own changes could all be lost
# → Completing the merge without running tests

# Good: check and resolve each conflict individually
$ git diff --name-only --diff-filter=U    # list conflicting files
$ git show :1:src/auth.js > /tmp/base.js  # check the base version
$ git show :2:src/auth.js > /tmp/ours.js  # check the ours version
$ git show :3:src/auth.js > /tmp/theirs.js # check the theirs version
# → Compare the three versions and resolve appropriately
$ git mergetool src/auth.js               # resolve using merge tool
```

### Anti-pattern 4: Using the Default Merge Commit Message

```bash
# Bad: use the default merge message as-is
$ git merge feature
# "Merge branch 'feature' into main"  ← too little information

# Good: write a meaningful merge message
$ git merge --no-ff feature -m "merge: feature/auth - Add OAuth2 authentication

- Google/GitHub provider support
- Session management integration
- Maintains compatibility with existing password authentication

Closes #123"
```

### Anti-pattern 5: Pushing During an Ongoing Rebase

```bash
# Bad: push before rebase completes
$ git rebase main
# conflict occurs...
$ git push origin feature   # ← rebase is still in progress
# → An incomplete state remains on the remote

# Good: push after rebase is complete
$ git rebase main
# resolve conflicts...
$ git rebase --continue
# all commits applied
$ git push --force-with-lease origin feature
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Please implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also create test code

```python
# Exercise 1: basic implementation template
class Exercise1:
    """Exercise in basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("入力値がNoneです")
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
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Applied Patterns

Extend the basic implementation and add the following features.

```python
# Exercise 2: applied patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise in applied patterns"""

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
    print("応用テスト全合格!")

test_advanced()
```

### Exercise 3: Performance Optimization

Please improve the performance of the following code.

```python
# Exercise 3: performance optimization
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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose the appropriate data structure
- Measure the effect with benchmarks
---

## 10. FAQ

### Q1. Can I abort a merge if a conflict occurs?

**A1.** Yes, `git merge --abort` will fully restore you to the state before the merge. Conflicts during a rebase can be aborted with `git rebase --abort`. In either case, the working directory and index are restored to their pre-merge/pre-rebase state.

```bash
# Abort a merge
$ git merge --abort

# Abort a rebase
$ git rebase --abort

# Abort a cherry-pick
$ git cherry-pick --abort
```

### Q2. When is an octopus merge used?

**A2.** It is used when merging three or more branches simultaneously. A typical case is integrating multiple feature branches during release preparation. However, if a conflict occurs, the octopus merge is automatically aborted. If conflicts are expected, it is safer to merge individually.

```bash
$ git merge feature/a feature/b feature/c
# → octopus strategy is automatically selected
```

### Q3. How do I handle a conflict during rebase?

**A3.** Since rebase applies each commit sequentially, a conflict can occur for each commit.

```bash
# 1. Manually resolve the conflict
$ vim src/conflicted-file.js

# 2. Stage the resolved file
$ git add src/conflicted-file.js

# 3. Continue the rebase
$ git rebase --continue

# Or, skip this commit
$ git rebase --skip

# Or, abort the entire rebase
$ git rebase --abort
```

### Q4. What should I set for merge.conflictStyle?

**A4.** **zdiff3 is recommended** (Git 2.35 and later). The content of the common ancestor is shown, making it easier to understand "what was changed" and allowing more accurate conflict resolution.

```bash
$ git config --global merge.conflictStyle zdiff3
```

With diff3/zdiff3, the content of the common ancestor (base) is displayed within the conflict markers, separated by `|||||||`. This makes it immediately clear "what ours changed" and "what theirs changed."

### Q5. Should I use rebase or merge?

**A5.** It depends on team policy, but general guidelines are as follows.

| Situation                        | Recommendation          | Reason                                           |
|----------------------------------|-------------------------|--------------------------------------------------|
| Personal feature branch          | rebase                  | Linear history is easier to read                 |
| Shared branches (main, develop)  | merge                   | Does not affect other developers                 |
| Long-running branch tracking main| merge (or rebase)       | merge is safer if conflict frequency is high     |
| PR merge                         | --no-ff merge           | Merge point is clear                             |
| Integrating small fixes          | rebase + ff merge       | History stays clean                              |

### Q6. How do I undo a merge commit after the fact?

**A6.** You can undo it with `git revert -m 1 MERGE_COMMIT`. `-m 1` means "use the first parent (mainline) as the base."

```bash
# Undo a merge commit
$ git revert -m 1 abc123
# → A commit that cancels the changes introduced by the merge is created

# Note: to re-merge the reverted merge
# → Need to revert the revert
$ git revert def456  # def456 = the revert commit above
$ git merge feature  # re-merge becomes possible
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Rather than theory alone, writing actual code and verifying its behavior will deepen your understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Concept             | Key Points                                                          |
|---------------------|---------------------------------------------------------------------|
| 3-way merge         | Judges the source of changes per line using common ancestor; smarter than 2-way merge |
| merge base          | Most recent common ancestor of 2 branches; multiple can exist in criss-cross |
| ort strategy        | Default since Git 2.34; fast, stable rewrite of recursive          |
| fast-forward        | Moves only the branch pointer; `--no-ff` forces a merge commit     |
| conflict            | Index manages 3 versions via Stage 1/2/3                           |
| rebase              | Chain of cherry-picks; linearizes history; SHA-1 changes           |
| rerere              | Mechanism to record and reuse conflict resolutions                 |
| diff algorithm      | histogram recommended; patience is strong for structural changes   |
| rename detection    | Similarity-based heuristic; accelerated in ort strategy            |
| zdiff3              | Recommended conflict style; base display makes judgment easier     |
| --onto              | Flexible rebase target specification; enables partial commit moves |

---

## What to Read Next

- [Interactive Rebase](../01-advanced-git/00-interactive-rebase.md) — Practical use of squash, fixup, reword
- [Packfile/GC](./03-packfile-gc.md) — Object optimization after merging
- [bisect/blame](../01-advanced-git/02-bisect-blame.md) — Bug identification on merge history

---

## References

1. **Pro Git Book** — "Basic Branching and Merging" https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging
2. **Elijah Newren** — "Git's new default merge strategy: ort" https://github.blog/2021-08-16-highlights-from-git-2-33/#merge-ort
3. **Git Official Documentation** — `git-merge`, `git-rebase`, `git-rerere` https://git-scm.com/docs
4. **A Formal Investigation of Diff3** — Sanjeev Khanna, Keshav Kunal, Benjamin C. Pierce https://www.cis.upenn.edu/~bcpierce/papers/diff3-short.pdf
5. **Elijah Newren** — "Merge strategies in Git" https://git-scm.com/docs/merge-strategies
6. **Git Official Documentation** — `gitattributes` merge drivers https://git-scm.com/docs/gitattributes
