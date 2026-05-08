# bisect/blame

> Explains how to use `git bisect` for binary search to identify bug-introducing commits and `git blame` to trace code changes, dramatically improving debugging efficiency in large projects.

## What You'll Learn in This Chapter

1. **git bisect binary search algorithm** — How to use manual and automated bisect, and efficient bug identification procedures
2. **Advanced git blame usage** — Line-by-line change tracking, code movement detection, and ignore-revs
3. **Combined bisect and blame strategy** — Practical debugging workflows
4. **pickaxe and log -L** — Searching by change content and tracking line range history
5. **Efficiency techniques for large projects** — first-parent, path restriction, and automation patterns


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding the content of [Worktree/Submodule](./01-worktree-submodule.md)

---

## 1. git bisect — Identify Bugs with Binary Search

### 1.1 The Principle of Binary Search

```
┌────────────────────────────────────────────────────┐
│  Binary Search Principle                           │
│                                                    │
│  Finding the bug-introducing commit among 1000     │
│  commits:                                          │
│                                                    │
│  Linear search: up to 1000 tests in the worst case │
│  Binary search: up to ceil(log2(1000)) = 10 tests  │
│                                                    │
│  good                              bad             │
│  v                                  v              │
│  o---o---o---o---o---o---o---o---o---o              │
│  1                                  1000           │
│                                                    │
│  Step 1: Test commit 500 → bad                     │
│  good              bad                             │
│  v                  v                              │
│  o---o---o---o---o---o                             │
│  1                  500                            │
│                                                    │
│  Step 2: Test commit 250 → good                    │
│           good     bad                             │
│            v        v                              │
│  o---o---o---o---o---o                             │
│          250       500                             │
│                                                    │
│  ... Identified in 10 steps                        │
└────────────────────────────────────────────────────┘
```

### 1.2 bisect Complexity

The maximum number of tests for bisect can be calculated as `ceil(log2(n))`. Concrete benchmarks are as follows.

| Commits   | Max tests | Notes                          |
|-----------|-----------|--------------------------------|
| 10        | 4         | Small feature branch           |
| 100       | 7         | Mid-scale project              |
| 1,000     | 10        | Large project                  |
| 10,000    | 14        | Very long history              |
| 100,000   | 17        | Linux kernel scale             |
| 1,000,000 | 20        | Super-large monorepo           |

As you can see, even as the number of commits grows, the required number of tests only increases logarithmically. Even with 1 million commits, the cause can be identified in just 20 tests.

### 1.3 Manual bisect

```bash
# 1. Start bisect
$ git bisect start

# 2. Mark current HEAD (has bug) as bad
$ git bisect bad

# 3. Mark a known-good commit as good
$ git bisect good v1.0.0
# Bisecting: 512 revisions left to test after this (roughly 9 steps)
# [abc123...] feat: some commit message

# 4. Test and mark the result (repeat)
$ npm test
# Test fails
$ git bisect bad
# Bisecting: 256 revisions left to test after this (roughly 8 steps)

$ npm test
# Test passes
$ git bisect good
# Bisecting: 128 revisions left to test after this (roughly 7 steps)

# ... repeat ...

# 5. The causing commit is identified
# abc123def456789abcdef is the first bad commit
# commit abc123def456789abcdef
# Author: Developer <dev@example.com>
# Date:   Mon Feb 10 15:30:00 2025 +0900
#
#     feat: add caching layer

# 6. End bisect (returns to original HEAD)
$ git bisect reset
```

### 1.4 Checking bisect Status

```bash
# Check the current state of bisect
$ git bisect log
# git bisect start
# # bad: [abc123...] feat: latest
# git bisect bad abc123...
# # good: [def456...] v1.0.0
# git bisect good def456...
# # bad: [789abc...] feat: caching
# git bisect bad 789abc...

# Remaining commit count and estimated steps
$ git bisect visualize
# → Visualize commits in the bisect range using gitk etc.

# List commits in the bisect range
$ git bisect visualize --oneline
# → Display remaining commit list in text format

# Check current bisect position
$ git log --oneline -1
```

### 1.5 Automated bisect

```bash
# Specify a test script for automatic execution
$ git bisect start HEAD v1.0.0
$ git bisect run npm test
# → Automatically runs tests; exit code 0=good, non-0=bad

# Automated bisect with a custom script
$ git bisect run ./test-specific-bug.sh

# Example test-specific-bug.sh:
#!/bin/bash
npm run build 2>/dev/null || exit 125  # Skip if build fails
node -e "
  const result = require('./dist/auth').validate('test@example.com');
  process.exit(result ? 0 : 1);
"
```

**Meaning of exit codes**:

| exit code       | Meaning                                       |
|-----------------|-----------------------------------------------|
| 0               | good (no bug in this commit)                  |
| 1-124, 126, 127 | bad (bug present in this commit)              |
| 125             | skip (this commit cannot be tested)           |
| 128+            | abort bisect                                  |

### 1.6 Collection of Automated bisect Script Patterns

```bash
# Pattern 1: Run only specific test cases
#!/bin/bash
# bisect-specific-test.sh
npm run build 2>/dev/null || exit 125
npm test -- --testPathPattern="auth.test" --bail 2>/dev/null
exit $?
```

```bash
# Pattern 2: Detect compile errors
#!/bin/bash
# bisect-compile.sh
make clean 2>/dev/null
make 2>/dev/null
exit $?
# → Identify commits where compilation fails
```

```bash
# Pattern 3: Detect performance regressions
#!/bin/bash
# bisect-performance.sh
npm run build 2>/dev/null || exit 125
RESULT=$(node -e "
  const start = Date.now();
  require('./dist/app').processData(testData);
  const elapsed = Date.now() - start;
  console.log(elapsed);
")
# bad if it takes more than 500ms
if [ "$RESULT" -gt 500 ]; then
  exit 1
else
  exit 0
fi
```

```bash
# Pattern 4: Check if a specific string exists
#!/bin/bash
# bisect-string-check.sh
# Check if a specific string is present in a specific file
grep -q "deprecated_function" src/auth.js
if [ $? -eq 0 ]; then
  exit 1  # deprecated_function exists → bad
else
  exit 0  # does not exist → good
fi
```

```bash
# Pattern 5: Test with Docker environment setup
#!/bin/bash
# bisect-docker.sh
docker build -t bisect-test . 2>/dev/null || exit 125
docker run --rm bisect-test npm test 2>/dev/null
EXIT_CODE=$?
docker rmi bisect-test 2>/dev/null
exit $EXIT_CODE
```

### 1.7 Advanced bisect Usage

```bash
# Limit bisect to specific paths
$ git bisect start -- src/auth/ tests/auth/
# → Only target commits that changed files in the specified paths

# Customize terminology (for old/new usage)
$ git bisect start --term-old=slow --term-new=fast
$ git bisect slow v1.0.0
$ git bisect fast HEAD
# → Can also be used to identify performance improvement commits

# Save and replay bisect log
$ git bisect log > bisect-log.txt
$ git bisect replay bisect-log.txt

# Skip a specific commit
$ git bisect skip
# → Skip commits that cannot be built

# Skip a range
$ git bisect skip abc123..def456
# → Skip all commits in the specified range

# Bisect first-parent only (Git 2.29+)
$ git bisect start --first-parent HEAD v1.0.0
# → Only follow the first parent of merge commits
# → Skip commits in feature branches
# → Enables binary search at the merge unit level
```

### 1.8 bisect and DAG (Merge History)

```
┌────────────────────────────────────────────────────────┐
│  bisect with Merge History                             │
│                                                        │
│  Linear history:                                       │
│  o---o---o---o---o---o---o---o---o---o                  │
│  good                              bad                 │
│  → Simple binary search                                │
│                                                        │
│  History with merges:                                  │
│  o---o---o---M---o---M---o---M---o                      │
│       \     / \     / \     /                          │
│        o---o   o---o   o---o                           │
│  good                         bad                      │
│                                                        │
│  → bisect performs binary search on the DAG            │
│  → Merge commits themselves are also test targets      │
│  → Can restrict to first parent with --first-parent    │
│                                                        │
│  --first-parent behavior:                              │
│  o---o---o---M---o---M---o---M---o                      │
│  ↑   ↑   ↑   ↑   ↑   ↑   ↑   ↑   ↑                  │
│  Only these commits are targeted                       │
│  → Identify "which merge introduced the bug"           │
└────────────────────────────────────────────────────────┘
```

---

## 2. git blame — Line-by-Line Change Tracking

### 2.1 Basic Usage

```bash
# Blame the entire file
$ git blame src/auth.js
a1b2c3d4 (Gaku    2025-01-15 10:30:00 +0900  1) const bcrypt = require('bcrypt');
d4e5f6a7 (Tanaka  2025-02-01 14:20:00 +0900  2) const jwt = require('jsonwebtoken');
a1b2c3d4 (Gaku    2025-01-15 10:30:00 +0900  3)
b7c8d9e0 (Suzuki  2025-02-10 09:15:00 +0900  4) async function login(email, password) {
d4e5f6a7 (Tanaka  2025-02-01 14:20:00 +0900  5)   const user = await User.findByEmail(email);

# Specify a line range
$ git blame -L 10,20 src/auth.js
$ git blame -L '/function login/,/^}/' src/auth.js  # Specify range with regex

# Verbose output (also shows the first line of the commit message)
$ git blame --show-description src/auth.js
```

### 2.2 blame Output Format

```bash
# Porcelain format (for script processing)
$ git blame --porcelain src/auth.js
# Output:
# a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0 1 1 3
# author Gaku
# author-mail <gaku@example.com>
# author-time 1705282200
# author-tz +0900
# committer Gaku
# committer-mail <gaku@example.com>
# committer-time 1705282200
# committer-tz +0900
# summary feat: initial auth module
# filename src/auth.js
# 	const bcrypt = require('bcrypt');

# line-porcelain format (complete commit info per line)
$ git blame --line-porcelain src/auth.js

# Minimal output
$ git blame -s src/auth.js
# → Omit author name and date; show only SHA-1 and line number

# Also show email address
$ git blame -e src/auth.js
```

### 2.3 Detecting Code Movement and Copying

```bash
# -M: Detect code movement within the same file
$ git blame -M src/auth.js
# → Show the original commit for lines moved within the same file

# -C: Detect code movement across files
$ git blame -C src/auth.js
# → Show the original commit for lines copied from another file

# -C -C: Broader copy detection (within the same commit)
$ git blame -C -C src/auth.js

# -C -C -C: Copy detection across all commits
$ git blame -C -C -C src/auth.js
```

```
┌────────────────────────────────────────────────────┐
│  Levels of the -C option                           │
│                                                    │
│  -C (once):                                        │
│    Detect copies from files changed in the same   │
│    commit                                          │
│                                                    │
│  -C -C (twice):                                    │
│    Detect copies at file creation time in any     │
│    commit                                          │
│                                                    │
│  -C -C -C (three times):                           │
│    Full copy detection across all commits          │
│    (slowest but most thorough)                     │
│                                                    │
│  Processing time: -C < -C -C < -C -C -C            │
│  Detection scope: -C < -C -C < -C -C -C            │
└────────────────────────────────────────────────────┘
```

### 2.4 Setting Thresholds for -M and -C

```bash
# Default threshold for -M is 20 characters
# Change the minimum character count to consider as a move
$ git blame -M40 src/auth.js
# → Detect 40+ consecutive identical characters as a move

# Default threshold for -C is also 40 characters
$ git blame -C40 src/auth.js
# → Detect copies of 40+ characters

# Making the threshold smaller:
# - Detects more moves/copies
# - Increases false positives (parts detected as copies when they aren't)
# - Increases processing time
```

### 2.5 ignore-revs — Excluding Formatting Changes

```bash
# Exclude commits with large-scale code formatting changes
$ git blame --ignore-rev abc123def456
$ git blame --ignore-revs-file .git-blame-ignore-revs

# Create the .git-blame-ignore-revs file
$ cat .git-blame-ignore-revs
# Full file format from Prettier introduction
abc123def456789abcdef1234567890abcdef1234

# ESLint auto-fix
def456789abcdef1234567890abcdef1234567890

# Tab-to-space conversion
789abcdef1234567890abcdef1234567890abcdef

# Configure git to load automatically
$ git config blame.ignoreRevsFile .git-blame-ignore-revs

# Also automatically recognized on GitHub (place at repository root)
```

```
┌────────────────────────────────────────────────────────┐
│  How --ignore-revs works                               │
│                                                        │
│  Normal blame:                                         │
│  Line 15: abc123 (Prettier) → "  const x = 1;"        │
│  → The Prettier commit is shown as the last change     │
│                                                        │
│  --ignore-revs abc123:                                 │
│  Line 15: def456 (Gaku) → "  const x = 1;"            │
│  → Ignores Prettier and shows the substantive commit   │
│                                                        │
│  Behavior:                                             │
│  1. Check the state before abc123's changes            │
│  2. Check the state after abc123's changes             │
│  3. Even if the line content changed, "pass through"  │
│     abc123                                             │
│  4. Show the commit before abc123 as the "last change" │
│                                                        │
│  Note: May not track accurately if lines were added   │
│  or deleted                                            │
└────────────────────────────────────────────────────────┘
```

### 2.6 Going Back in Time with blame

```bash
# blame at a specific commit point
$ git blame abc123 -- src/auth.js

# Track the commit before a specific line was changed
$ git log -p -L 15,25:src/auth.js
# → Show the full change history for the specified line range (log-based tracking)

# Trace the change history of a specific line one step at a time
$ git blame src/auth.js     # → Discover commit X in the latest blame
$ git blame X~1 -- src/auth.js  # → Discover commit Y in the blame before X
$ git blame Y~1 -- src/auth.js  # → Check changes before Y

# Show only changes since a specific date
$ git blame --since="2025-01-01" src/auth.js
# → Show blame only for lines changed since 2025-01-01
# → Lines changed before that are shown with a ^ prefix like ^abc123
```

### 2.7 Visualization Tools for blame

```bash
# VS Code GitLens extension
# → Show inline blame within the editor
# → Blame info for the cursor line is shown automatically

# blame on GitHub
# URL pattern: https://github.com/user/repo/blame/main/src/auth.js
# → Interactively check blame in a web browser
# → Follow commit links for each line to see details

# git gui blame
$ git gui blame src/auth.js
# → Show blame in a GUI (Git's standard GUI tool)

# tig (console UI tool)
$ tig blame src/auth.js
# → Interactively operate blame in the console
# → Press Enter to navigate to commit details
```

---

## 3. pickaxe and log — Searching by Change Content

### 3.1 Searching with -S (pickaxe)

```bash
# Find commits that added or removed a specific string
$ git log -S "bcrypt" --oneline
# → List commits where the occurrence count of "bcrypt" changed

# Search with a regex
$ git log -G "function\s+login" --oneline
# → List commits where a line matching the regex was changed

# Also show the diff
$ git log -S "bcrypt" -p -- src/auth.js
```

```
┌────────────────────────────────────────────────────┐
│  Difference between -S and -G                      │
│                                                    │
│  -S "text" (pickaxe):                              │
│    Find commits where the occurrence count of      │
│    "text" changed                                  │
│    → Detects additions and deletions (not moves)  │
│                                                    │
│  -G "regex":                                       │
│    Find commits where the diff matches regex       │
│    → Also detects moves and modifications          │
│      (broader scope)                               │
│                                                    │
│  Example: changing "x = 1" to "x = 2"             │
│    -S "x = 1" → Detected (occurrence count drops) │
│    -S "x = 2" → Detected (occurrence count rises) │
│    -G "x = " → Detected (matches diff)            │
│                                                    │
│  Example: line moved only (same content)           │
│    -S "function login" → Not detected (count unchanged) │
│    -G "function login" → Detected (appears in diff)│
└────────────────────────────────────────────────────┘
```

### 3.2 Advanced Options for -S

```bash
# Use regex with -S (combined with --pickaxe-regex)
$ git log -S "validate[A-Z]\w+" --pickaxe-regex --oneline
# → Matches patterns like validateEmail, validatePassword, etc.

# Search across all branches
$ git log --all -S "deprecated_function" --oneline
# → Search all commits on all branches

# Restrict to specific files
$ git log -S "bcrypt" -- src/auth/ lib/security/
# → Only target files in the specified paths

# Also show diff context
$ git log -S "bcrypt" -p --word-diff
# → Highlight changes at the word level
```

### 3.3 Tracking Line Ranges with log -L

```bash
# Change history for a specific line range
$ git log -L 10,20:src/auth.js
# → Show all commits that include changes to lines 10-20

# Change history for a function definition
$ git log -L ':function login:src/auth.js'
# → Track the full change history of the login function definition
# → Git auto-detects the start and end of the function

# Specify range with regex
$ git log -L '/^async function login/,/^}/':src/auth.js
# → Specify range with a pattern

# Combined with -p option for patch display
$ git log -L 10,20:src/auth.js -p
# → Show the specific diff for each commit
```

```
┌────────────────────────────────────────────────────────┐
│  How git log -L works                                  │
│                                                        │
│  git log -L 10,20:src/auth.js                          │
│                                                        │
│  Traverses commits from newest to oldest:              │
│                                                        │
│  commit C3 (newest):                                   │
│    10: const salt = 10;                                │
│    11: async function login(email, password) {         │
│    ...                                                 │
│    20: }                                               │
│    ← Line 11 was changed in C3 → Show it              │
│                                                        │
│  commit C2:                                            │
│    10: const salt = 10;                                │
│    11: function login(email, password) {               │
│    ...                                                 │
│    18: }                                               │
│    ← No change in C2 → Skip                           │
│    ← But track the correspondence of line numbers     │
│                                                        │
│  commit C1:                                            │
│    8: function login(email, password) {                │
│    ...                                                 │
│    15: }                                               │
│    ← Function was added in C1 → Show it               │
│    ← Tracks content even when line numbers shift      │
│                                                        │
│  → -L accounts for line number shifts (from additions │
│    /deletions in preceding lines) and accurately      │
│    tracks changes at the "same logical position"      │
└────────────────────────────────────────────────────────┘
```

---

## 4. Practical Debugging Workflow

### 4.1 Combining bisect + blame

```bash
# Step 1: Use bisect to identify the bug-introducing commit
$ git bisect start HEAD v1.0.0
$ git bisect run npm test
# → commit abc123 identified as the cause

# Step 2: Check the details of the causing commit
$ git show abc123 --stat
# → List of changed files

$ git show abc123 -p
# → Specific change contents

# Step 3: Use blame to check the history of related code
$ git blame -L '/function validate/,/^}/' src/auth.js
# → Who changed each line of the validate function and when

# Step 4: Use pickaxe to identify all related changes
$ git log -S "validate" --oneline -- src/auth.js
# → Full change history related to validate
```

### 4.2 Complete Flow for Bug Root Cause Investigation

```bash
# Scenario: The login feature is broken

# Phase 1: Identify when it broke
$ git bisect start HEAD v2.0.0 -- src/auth/
$ git bisect run ./test-login.sh
# → commit def456 is the first bad commit

# Phase 2: Check what changed
$ git show def456 --stat
# src/auth/login.js  | 15 ++++++-----
# src/auth/session.js | 8 ++++----
# 2 files changed, 11 insertions(+), 12 deletions(-)

$ git show def456 -p
# → Review the specific code changes

# Phase 3: Understand the context of the change
$ git log --oneline def456~5..def456
# → Context of surrounding commits

$ git blame -L '/function createSession/,/^}/' src/auth/session.js
# → Change history for session-related code

# Phase 4: Identify all related changes
$ git log -S "createSession" --oneline
# → All commits related to the createSession function

$ git log -G "session.*expire" --oneline -- src/auth/
# → Changes related to session expiration

# Phase 5: Determine the fix strategy
$ git diff def456~1 def456 -- src/auth/
# → The specific diff of the change that introduced the bug
# → Use this diff to decide on the fix approach
```

### 4.3 Investigating Performance Regressions

```bash
# Step 1: Identify when the performance degraded
$ git bisect start HEAD v2.0.0
$ git bisect run ./benchmark.sh
# Contents of benchmark.sh:
#!/bin/bash
npm run build 2>/dev/null || exit 125
TIME=$(node -e "
  const start = Date.now();
  require('./dist/app').processLargeDataset();
  console.log(Date.now() - start);
")
[ "$TIME" -lt 1000 ] && exit 0 || exit 1

# Step 2: Analyze the causing commit
$ git show <first-bad-commit> --stat
# → What files were changed

$ git diff <first-bad-commit>~1 <first-bad-commit>
# → Specific change content

# Step 3: Check the history of changed functions
$ git log -L ':function processData:src/data-processor.js'
# → Change history of the processData function
```

### 4.4 Tracking Deleted Code

```bash
# Step 1: Find the commit where a specific function was deleted
$ git log -S "function deprecatedAuth" --oneline
# abc123 feat: remove deprecated auth (← deletion)
# def456 feat: initial auth module    (← addition)

# Step 2: Check the version right before deletion
$ git show abc123~1:src/auth.js
# → The entire file before deletion

$ git blame abc123~1 -- src/auth.js
# → blame of the file just before deletion

# Step 3: Track related changes
$ git log -S "deprecatedAuth" -p
# → Show diffs for both the addition and deletion commits
```

---

## 5. git annotate and git log --follow

```bash
# annotate is an alias for blame (output format differs slightly)
$ git annotate src/auth.js

# blame that tracks file renames
$ git log --follow -p -- src/auth.js
# → Track change history even if the file was renamed

# Equivalent to --follow for blame
$ git log --follow --diff-filter=R -- src/auth.js
# → Detect renames and identify the old filename
$ git blame <commit with old filename> -- <old filename>
```

```
┌────────────────────────────────────────────────────────┐
│  Tracking blame through file renames                   │
│                                                        │
│  commit C1: src/authentication.js created              │
│  commit C2: src/authentication.js modified             │
│  commit C3: src/authentication.js → src/auth.js renamed│
│  commit C4: src/auth.js modified                       │
│                                                        │
│  git blame src/auth.js:                                │
│  → Shows only changes from C3, C4                      │
│  → C1, C2 information is not shown                     │
│                                                        │
│  git log --follow -p -- src/auth.js:                   │
│  → Shows all changes from C1 to C4 (tracks renames)   │
│                                                        │
│  To see blame before the rename:                       │
│  $ git log --follow --diff-filter=R -- src/auth.js     │
│  # → Find the rename commit C3                         │
│  $ git blame C3~1 -- src/authentication.js             │
│  # → blame of the file before rename                   │
└────────────────────────────────────────────────────────┘
```

---

## 6. git shortlog and Statistical Analysis

```bash
# Commit count by author
$ git shortlog -sn
    145  Gaku
     87  Tanaka
     53  Suzuki

# Author statistics for a specific period
$ git shortlog -sn --since="2025-01-01" --until="2025-03-01"

# Ranking of files by number of changes
$ git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20

# Lines changed by author
$ git log --author="Gaku" --numstat --pretty=format: | \
  awk '{added+=$1; deleted+=$2} END {print "Added:", added, "Deleted:", deleted}'

# Monthly commit count trend
$ git log --format="%ai" | cut -d'-' -f1,2 | uniq -c
```

---

## 7. Efficiency for Large Projects

### 7.1 bisect Efficiency Strategies

```bash
# Strategy 1: Path restriction
$ git bisect start HEAD v1.0.0 -- src/auth/ tests/auth/
# → Only test commits with changes to the relevant paths

# Strategy 2: first-parent
$ git bisect start --first-parent HEAD v1.0.0
# → Only follow the first parent of merge commits
# → Skip feature branch commits

# Strategy 3: Automated bisect + skip
$ git bisect run ./smart-test.sh
# smart-test.sh:
#!/bin/bash
# Install dependencies (using cache)
npm ci --cache /tmp/npm-cache 2>/dev/null || exit 125
npm run build 2>/dev/null || exit 125
npm test -- --bail --testPathPattern="auth" 2>/dev/null
exit $?

# Strategy 4: Pre-narrowing the range
$ git log --oneline --first-parent v1.0.0..HEAD | wc -l
# 500 commits
$ git log --oneline --first-parent v1.0.0..HEAD -- src/auth/ | wc -l
# 30 commits → Significantly reduce test count with path restriction
```

### 7.2 blame Efficiency

```bash
# Speed up blame for large files
$ git blame --incremental src/auth.js
# → Output results incrementally (suitable for pipelines)

# Blame only specific lines (don't blame all lines)
$ git blame -L 100,120 src/auth.js
# → Process only the needed line range (fast)

# Exclude unnecessary commits with .git-blame-ignore-revs
# → Skip formatting change commits for faster processing

# Adjust diff.renameLimit
$ git config diff.renameLimit 10000
# → Balance rename detection accuracy and speed
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Manually Modifying Code During bisect

```bash
# NG: Modifying working directory files during bisect
$ git bisect start HEAD v1.0.0
$ vim src/auth.js         # ← Modify a file
$ git bisect good         # ← Report results tested with the modification
# → Results become inaccurate; wrong commit reported as the cause

# OK: Don't change code during bisect. Only run tests.
$ git bisect start HEAD v1.0.0
$ npm test                # Run tests only
$ git bisect bad          # Report results accurately
```

**Reason**: bisect assumes testing each commit "as-is." Adding manual modifications changes the test conditions and breaks the premise of binary search.

### Anti-Pattern 2: Blaming Someone Based Only on blame Results

```bash
# NG: The displayed commit in blame is not necessarily the bug cause
$ git blame src/auth.js
# Line 15: abc123 (Tanaka) ... ← Judging "Tanaka introduced the bug"
# → Tanaka actually only made a formatting change. The real cause is another commit.

# OK: Dig deeper with --ignore-revs-file and log -L
$ git blame --ignore-revs-file .git-blame-ignore-revs src/auth.js
$ git log -p -L 15,15:src/auth.js
# → Exclude formatting changes and track substantive change history
```

**Reason**: blame only shows "the commit that last changed that line." Whitespace adjustments, renames, and auto-formatting commits often appear instead of the real culprit.

### Anti-Pattern 3: Not Using exit 125 in bisect run Scripts

```bash
# NG: Report build errors as bad
#!/bin/bash
npm run build
npm test
exit $?
# → Build-broken commits are also reported as bad
# → Cannot distinguish from actual bug-introducing commits
# → bisect results become inaccurate

# OK: Exit with 125 (skip) for build errors
#!/bin/bash
npm run build 2>/dev/null || exit 125  # Skip if build fails
npm test
exit $?
# → Skip commits that can't be built
# → Accurately judge good/bad based only on test results
```

**Reason**: exit 125 is a special exit code to tell bisect "this commit cannot be tested." Commits where good/bad cannot be accurately determined due to build errors or test environment problems should be skipped.

### Anti-Pattern 4: Starting bisect with Too Wide a Range

```bash
# NG: Start bisect from the very first commit of the project
$ git bisect start HEAD $(git rev-list --max-parents=0 HEAD)
# → Thousands to tens of thousands of commits become targets
# → Test environment changes significantly over that range
# → Old commits may not even build

# OK: Narrow the range appropriately before starting
$ git log --oneline --since="2025-01-01" | tail -1
# def456 oldest commit
$ git bisect start HEAD def456
# → Limit bisect to recent changes

# Even better: Add path restriction
$ git bisect start HEAD def456 -- src/auth/
# → Only target changes to relevant files
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement error handling appropriately
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

# Test
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

Extend the basic implementation to add the following features.

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

# Test
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
| Initialization error | Configuration file issues | Check configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check execution user permissions, review configuration |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify the location of occurrence
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Stepwise verification**: Verify hypotheses using log output or a debugger
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
    """Decorator that logs input and output of a function"""
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

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check connection pool status

| Problem type    | Diagnostic tool              | Solution                            |
|-----------------|------------------------------|-------------------------------------|
| CPU load        | cProfile, py-spy             | Algorithm improvements, parallelization |
| Memory leak     | tracemalloc, objgraph        | Properly release references         |
| I/O bottleneck  | strace, iostat               | Async I/O, caching                  |
| DB latency      | EXPLAIN, slow query log      | Indexing, query optimization        |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criteria        | Prioritize when                          | Can compromise when                      |
|-----------------|------------------------------------------|------------------------------------------|
| Performance     | Real-time processing, large-scale data   | Admin panels, batch processing           |
| Maintainability | Long-term operation, team development    | Prototypes, short-term projects          |
| Scalability     | Services expected to grow               | Internal tools, fixed user base          |
| Security        | Personal data, financial data           | Public data, internal use                |
| Dev speed       | MVP, time-to-market                     | Quality-focused, mission critical        |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① Team size?                                   │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily/multiple times → Go to ③            │
│                                                 │
│  ③ Team independence?                           │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs long-term cost**
- A faster short-term approach can become technical debt in the long term
- Conversely, over-engineering has a high short-term cost and can delay projects

**2. Consistency vs flexibility**
- A unified technology stack has low learning costs
- Adopting diverse technologies allows "right tool for the job" but increases operational costs

**3. Level of abstraction**
- High abstraction offers reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

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
        """Describe the decision content"""
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
- Focus on the minimum required features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't strive for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually renovating a system that has been running for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Write Characterization Tests first if no existing tests exist
- Use an API gateway to coexist new and old systems
- Migrate data in stages

| Phase       | Work content                              | Estimated duration | Risk   |
|-------------|-------------------------------------------|--------------------|--------|
| 1. Survey   | Current state analysis, mapping dependencies | 2-4 weeks        | Low    |
| 2. Foundation| Set up CI/CD, test environment           | 4-6 weeks          | Low    |
| 3. Migration begins | Migrate peripheral functions first | 3-6 months        | Medium |
| 4. Core migration | Migrate core functions              | 6-12 months        | High   |
| 5. Completion | Decommission old system              | 2-4 weeks          | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Use Domain-Driven Design to clarify boundaries
- Set ownership per team
- Manage shared libraries using Inner Source approach
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
        """Verify SLA compliance"""
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

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leverage asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization method    | Effect  | Implementation cost | Use case                         |
|------------------------|---------|---------------------|----------------------------------|
| In-memory cache        | High    | Low                 | Frequently accessed data         |
| CDN                    | High    | Low                 | Static content                   |
| Async processing       | Medium  | Medium              | I/O-heavy processing             |
| DB optimization        | High    | High                | When queries are slow            |
| Code optimization      | Low-Med | High                | CPU-bound processing             |

---

## Team Development Usage

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Is the naming convention consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Has documentation been updated?

### Best Practices for Knowledge Sharing

| Method              | Frequency     | Audience          | Effect                         |
|---------------------|---------------|-------------------|--------------------------------|
| Pair programming    | As needed     | Complex tasks     | Immediate feedback             |
| Tech talk           | Weekly        | Entire team       | Horizontal knowledge spread    |
| ADR (design record) | As needed     | Future members    | Transparency in decision-making|
| Retrospective       | Bi-weekly     | Entire team       | Continuous improvement         |
| Mob programming     | Monthly       | Key designs       | Consensus building             |

### Managing Technical Debt

```
Priority matrix:

        High impact
          │
    ┌─────┼─────┐
    │ Plan│ Act │
    │ ned │ imm.│
    │     │     │
    ├─────┼─────┤
    │ Log │ Next│
    │ only│Sprint│
    │     │     │
    └─────┼─────┘
          │
        Low impact
    Low frequency  High frequency
```
---

## 9. FAQ

### Q1. Can bisect handle merge commits correctly?

**A1.** Yes, bisect performs **binary search on a DAG (Directed Acyclic Graph)**, so it works correctly even with complex histories containing merge commits. However, if testing the merge commit itself is difficult, you can skip it with `git bisect skip`. Compared to a linear history, having many merges may slightly increase the number of steps.

Using the `--first-parent` option (Git 2.29+) only follows the first parent of merges, enabling binary search at the merge unit level.

### Q2. How do I track the history of a deleted line with blame?

**A2.** There is no direct method, but you can track it with the following approaches.

```bash
# Method 1: Use pickaxe to search for commits that added or deleted the string
$ git log -S "content of the deleted line" --all -p

# Method 2: Track change history for a specific line range with log -L
$ git log -p -L '15,20:src/auth.js'
# → Shows change history including lines that previously existed

# Method 3: blame at the commit before deletion
$ git blame <commit just before deletion>~1 -- src/auth.js

# Method 4: Find deleted files themselves with git log --diff-filter=D
$ git log --diff-filter=D --summary -- src/deprecated/
# → List of deleted files
```

### Q3. Is there a way to improve efficiency when running bisect across thousands of commits?

**A3.** There are several strategies.

1. **Path restriction**: Use `git bisect start HEAD v1.0.0 -- src/auth/` to only target commits with changes to relevant paths
2. **Automated bisect**: Automatically run a test script with `git bisect run`
3. **Skip non-buildable commits**: Return exit 125 in test scripts
4. **first-parent only**: Use `git bisect start --first-parent` to only follow the first parent of merges (Git 2.29+)

```bash
$ git bisect start --first-parent HEAD v1.0.0 -- src/auth/
$ git bisect run ./test-auth-bug.sh
# → Narrow the scope and run automatically for fast identification
```

### Q4. When should I use blame's -M and -C?

**A4.** Use them in the following situations.

| Option    | Situation                                              | Example                                    |
|-----------|--------------------------------------------------------|--------------------------------------------|
| -M        | When code was moved within the same file              | Reordering functions                       |
| -C        | When you want to know the origin of code copied from another file | Splitting files during refactoring |
| -C -C     | Origin of code copied when a file was created         | Creating new files from templates          |
| -C -C -C  | Complete detection of copies across all history       | Complete tracing of code origin (slow)    |

### Q5. How does git log -L detect function boundaries?

**A5.** Git uses per-language function patterns defined in `.gitattributes`. Many languages are supported by default, but customization is also possible.

```bash
# Check the default function detection pattern
$ git config diff.javascript.xfuncname
# → Regular expression to detect JavaScript function definitions

# Set a custom pattern
$ cat .gitattributes
*.js diff=javascript
*.py diff=python
*.rs diff=rust

# Define function pattern for a custom language
$ git config diff.myLang.xfuncname "^\\s*(function|class|def)\\s+.*$"
```

### Q6. What to do when the bisect result is wrong (a false cause commit is reported)?

**A6.** The following are causes and solutions.

1. **Unstable (flaky) tests**: In the test script, run tests multiple times and use a majority vote
2. **Reporting build errors as bad**: Fix the script to return exit 125 on skip
3. **Environment dependency**: Initialize the environment within the test script (e.g., reinstall node_modules)
4. **Modified code during bisect**: Restart with `git bisect reset`

```bash
# Example of a stable test script
#!/bin/bash
npm ci 2>/dev/null || exit 125           # Ensure dependencies are installed
npm run build 2>/dev/null || exit 125     # Skip if build fails
# Run 3 tests; good if 2 or more pass
PASS=0
for i in 1 2 3; do
  npm test -- --bail --testPathPattern="login" 2>/dev/null && PASS=$((PASS+1))
done
[ "$PASS" -ge 2 ] && exit 0 || exit 1
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Rather than theory alone, writing and running actual code deepens understanding.

### Q2: What mistakes do beginners commonly make?

Jumping to advanced topics without mastering the basics. It is recommended to thoroughly understand the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Concept             | Key Point                                                          |
|---------------------|--------------------------------------------------------------------|
| git bisect          | Identify the bug-introducing commit in O(log n) via binary search  |
| bisect run          | Automated bisect with test scripts; judged by exit code            |
| exit 125            | Skip non-testable commits in bisect run                            |
| --first-parent      | Follow only the first parent of merges; bisect at merge unit level |
| git blame           | Show the last modifying commit, author, and date for each line     |
| blame -M -C         | Detect code moves/copies and show the original commit              |
| ignore-revs-file    | Exclude noise like formatting changes from blame                   |
| git log -S          | Find commits where the occurrence count of a string changed (pickaxe) |
| git log -G          | Find commits where the diff matches a regex                        |
| git log -L          | Track change history for a specific line range                     |
| --follow            | Show logs tracking file renames                                    |

---

## Guides to Read Next

- [Interactive Rebase](./00-interactive-rebase.md) — Fixing commits found with bisect
- [Git Hooks](./03-hooks-automation.md) — Integration with bisect test automation
- [Merge Algorithms](../00-git-internals/02-merge-algorithms.md) — bisect on merge history

---

## References

1. **Pro Git Book** — "Git Tools - Debugging with Git" https://git-scm.com/book/en/v2/Git-Tools-Debugging-with-Git
2. **Git Official Documentation** — `git-bisect`, `git-blame`, `git-log` https://git-scm.com/docs
3. **GitHub Docs** — "Using git blame to trace changes in a file" https://docs.github.com/en/repositories/working-with-files/using-files/viewing-a-file#viewing-the-line-by-line-revision-history-for-a-file
4. **Christian Couder** — "Fighting regressions with git bisect" https://git-scm.com/docs/git-bisect-lk2009
