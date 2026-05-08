# Jujutsu Advanced

> Master Jujutsu's revset (revision set expressions), template language, and advanced Git integration settings to handle complex repository operations and efficient workflows.

## What You Will Learn in This Chapter

1. **revset query language** — Flexible syntax for selecting and filtering revisions
2. **Template language** — Customizing log output and commit display
3. **Advanced Git integration** — Detailed operation of fetch, push, and colocated repos
4. **Advanced workflows** — Practical use of stacked PRs, absorb, split, and parallelize
5. **Operation Log** — Tracking operation history with undo/redo
6. **Advanced configuration** — Detailed settings for revset-aliases, templates, and difftool


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding of the content in [Jujutsu Workflow](./01-jujutsu-workflow.md)

---

## 1. revset — Revision Selection Queries

### 1.1 Basic Syntax

revset is a query language for expressing sets of commits (revisions), and can be used with almost all commands such as `jj log -r`, `jj rebase`, `jj diff`, etc.

```bash
# Single revision
$ jj log -r @                    # working copy
$ jj log -r @-                   # parent of working copy
$ jj log -r @--                  # grandparent of working copy
$ jj log -r @---                 # 3 generations back
$ jj log -r rlvkpntz             # specify by change ID
$ jj log -r abc12345             # specify by commit ID
$ jj log -r main                 # specify by bookmark name
$ jj log -r main@origin          # remote bookmark
$ jj log -r 'v1.0.0'             # specify by tag

# Range specification
$ jj log -r 'main..@'            # commits between main and @
$ jj log -r 'main..'             # descendants of main (not including main itself)
$ jj log -r '..main'             # ancestors of main (including main itself)
$ jj log -r 'root()..main'       # all commits from root to main

# Parent/child references
$ jj log -r '@-'                 # first parent of @
$ jj log -r '@+'                 # child of @ (error if multiple)
```

```
┌─────────────────────────────────────────────────────┐
│  revset basic syntax diagram                        │
│                                                     │
│     root()                                          │
│       │                                             │
│       ○  A                                         │
│       │                                             │
│       ○  B  = main                                 │
│      / \                                            │
│     ○   ○  C, D                                   │
│     │   │                                           │
│     ○   ○  E, F                                   │
│      \ /                                            │
│       ○  G = @-                                    │
│       │                                             │
│       ◆  H = @ (working copy)                     │
│                                                     │
│  @     = H                                         │
│  @-    = G                                         │
│  @--   = E, F (may be multiple)                    │
│  main..@ = C, D, E, F, G, H (descendants of main that are ancestors of @) │
│  ..main  = root(), A, B (ancestors of main)        │
└─────────────────────────────────────────────────────┘
```

### 1.2 Set Operations

```bash
# Union
$ jj log -r 'branch-a | branch-b'

# Intersection
$ jj log -r 'mine() & main..'

# Difference
$ jj log -r 'all() ~ merges()'
# → all commits excluding merge commits

# Complement (negation)
$ jj log -r '~empty()'
# → non-empty commits

# Control precedence with parentheses
$ jj log -r '(mine() | author("bob")) & (main..)'
# → commits by me or Bob that are descendants of main
```

```
┌─────────────────────────────────────────────────────┐
│  revset set operations diagram                      │
│                                                     │
│   A = {1, 2, 3, 4, 5}     B = {3, 4, 5, 6, 7}     │
│                                                     │
│   A | B  = {1, 2, 3, 4, 5, 6, 7}  (union)          │
│   A & B  = {3, 4, 5}              (intersection)   │
│   A ~ B  = {1, 2}                 (difference)     │
│   ~A     = everything ~ A         (complement)     │
│                                                     │
│  Example: my commits not in main                   │
│  mine() & (main..)                                  │
│  = {my commits} ∩ {descendants of main}             │
│                                                     │
│  Precedence (highest first):                        │
│  1. () — parentheses                               │
│  2. :: — DAG range                                 │
│  3. ~ — complement (unary)                         │
│  4. & — intersection                               │
│  5. | — union                                      │
│  6. ~ — difference (binary)                        │
└─────────────────────────────────────────────────────┘
```

### 1.3 Functional revset

```bash
# Ancestors / descendants
$ jj log -r 'ancestors(main, 5)'     # up to 5 generations before main
$ jj log -r 'ancestors(main)'        # all ancestors of main
$ jj log -r 'descendants(@)'         # all descendants of @
$ jj log -r 'parents(@)'             # parents of @
$ jj log -r 'children(main)'         # direct children of main
$ jj log -r 'roots(visible_heads()..@)' # root commits of the range
$ jj log -r 'heads(all())'           # all heads (leaf commits)
$ jj log -r 'root()'                 # root commit

# Filtering
$ jj log -r 'author("gaku")'        # filter by author
$ jj log -r 'author_date(after:"2024-01-01")' # filter by date
$ jj log -r 'committer_date(before:"2024-06-01")' # committer date
$ jj log -r 'description("feat:")'  # filter by message
$ jj log -r 'description(regex:"^(feat|fix):")'  # regex
$ jj log -r 'empty()'               # empty commits
$ jj log -r 'merges()'              # merge commits
$ jj log -r 'mine()'                # my commits
$ jj log -r 'conflict()'            # commits with conflicts
$ jj log -r 'file("src/auth.js")'   # commits that modified a specific file
$ jj log -r 'file("src/")'          # file changes within a directory
$ jj log -r 'file(glob:"*.rs")'     # specify files with glob pattern
$ jj log -r 'present(feature-x)'    # only if exists (avoids error)
$ jj log -r 'latest(mine(), 5)'     # latest 5 of my commits

# Bookmark-related
$ jj log -r 'bookmarks()'           # commits with bookmarks
$ jj log -r 'bookmarks("feature-")' # pattern matching
$ jj log -r 'remote_bookmarks()'    # remote bookmarks
$ jj log -r 'remote_bookmarks(remote="origin")' # specific remote
$ jj log -r 'tags()'                # tagged commits
$ jj log -r 'trunk()'               # trunk (main/master)
$ jj log -r 'visible_heads()'       # visible heads
```

### 1.4 DAG Operation Functions

```bash
# connected(): get the connected set of revisions
$ jj log -r 'connected(bookmarks())'
# → includes all commits between bookmarks

# reachable(): reachable commits
$ jj log -r 'reachable(@, all())'

# fork_point(): divergence point
$ jj log -r 'fork_point(feature-a, feature-b)'
# → the divergence point of two branches

# shortest_common_ancestors(): shortest common ancestors
$ jj log -r 'heads(::feature-a & ::feature-b)'
# → most recent common ancestors of feature-a and feature-b
```

```
┌─────────────────────────────────────────────────────┐
│  DAG operations diagram                             │
│                                                     │
│          ○ feature-a                               │
│         /                                           │
│   ○───○───○ main                                  │
│         \                                           │
│          ○───○ feature-b                           │
│                                                     │
│  fork_point(feature-a, feature-b)                   │
│  = the commit where main diverges                   │
│                                                     │
│  connected(feature-a | feature-b)                   │
│  = all commits between feature-a and feature-b      │
│    (including commits on main)                      │
│                                                     │
│  ancestors(feature-a) & ancestors(feature-b)        │
│  = set of common ancestor commits                   │
└─────────────────────────────────────────────────────┘
```

### 1.5 Practical revset Query Examples

```bash
# List of changes for PR candidates (my commits not in main)
$ jj log -r 'mine() & (main..)'

# Commits that need conflict resolution
$ jj log -r 'conflict() & descendants(@)'

# Show only non-empty commits
$ jj log -r '(main..) ~ empty()'

# Latest 5 commits
$ jj log -r 'ancestors(@, 5)'

# Changes related to a specific file
$ jj log -r 'file("src/auth/")'

# My commits from this week
$ jj log -r 'mine() & committer_date(after:"1 week ago")'

# Bookmarked non-empty commits
$ jj log -r 'bookmarks() ~ empty()'

# Latest 10 commits by a specific author
$ jj log -r 'latest(author("alice"), 10)'

# Show parents of commits with merge conflicts
$ jj log -r 'parents(conflict())'

# Commits not yet pushed to remote
$ jj log -r 'mine() ~ ::remote_bookmarks()'

# Commits that deleted a specific file
$ jj log -r 'file("deleted-file.txt") & (main..)'

# Complex query combining multiple conditions
$ jj log -r '(mine() | author("bob")) & (main..) & ~empty() & ~merges()'
# → commits by me or Bob, not in main, non-empty, non-merge

# Heads of all diverging branches
$ jj log -r 'heads(all()) ~ trunk()'

# Root of each branch diverging from trunk
$ jj log -r 'roots(trunk()..heads(all()))'
```

### 1.6 revset Performance

```bash
# revset evaluation is lazy
# → computes only the needed parts without enumerating all commits

# Efficient revset
$ jj log -r 'ancestors(@, 20)'
# → traverses only 20 generations back from @ (fast)

# Inefficient revset (may be slow on large repos)
$ jj log -r 'all()'
# → enumerates all commits (slow on huge repos)

# Optimization techniques
# 1. Limit the range
$ jj log -r 'trunk()..@ & file("src/")'
# vs
$ jj log -r 'file("src/")'  # searches all history

# 2. Existence check with present()
$ jj log -r 'present(old-bookmark)'
# → does not error if it does not exist

# 3. Limit count with latest()
$ jj log -r 'latest(mine(), 10)'
# → retrieves only the latest 10
```

---

## 2. Template Language

### 2.1 Basic Syntax

```bash
# Display log with custom format
$ jj log -T 'change_id.short() ++ " " ++ description.first_line() ++ "\n"'
rlvkpntz feat: authentication feature
qpvuntsm feat: initial setup

# Conditional branching
$ jj log -T '
  if(conflict, "CONFLICT: ", "")
  ++ change_id.short()
  ++ " "
  ++ description.first_line()
  ++ "\n"
'

# Colored output
$ jj log -T '
  label("change_id", change_id.short())
  ++ " "
  ++ label(if(conflict, "conflict"), description.first_line())
  ++ "\n"
'

# Specify separator with separate()
$ jj log -T '
  separate(" ",
    change_id.short(),
    if(bookmarks, bookmarks),
    description.first_line(),
  ) ++ "\n"
'
# → empty elements are automatically skipped
```

### 2.2 Available Properties

| Property             | Description                             | Example                    |
|----------------------|-----------------------------------------|----------------------------|
| `change_id`          | change ID                               | `change_id.short()`        |
| `commit_id`          | commit ID (SHA-1)                       | `commit_id.short(8)`       |
| `description`        | commit message                          | `description.first_line()` |
| `author`             | author information                      | `author.name()`            |
| `committer`          | committer information                   | `committer.email()`        |
| `author.timestamp()` | author timestamp                        | `author.timestamp()`       |
| `working_copies`     | whether it is a working copy            | `self.working_copies()`    |
| `conflict`           | whether there are conflicts             | `if(conflict, "C", "")`    |
| `empty`              | whether it is an empty commit           | `if(empty, "(empty)", "")` |
| `bookmarks`          | bookmarks                               | `bookmarks`                |
| `tags`               | tags                                    | `tags`                     |
| `branches`           | branches (Git-compatible display)       | `branches`                 |
| `parents`            | parent commits                         | `parents`                  |
| `diff`               | change content                          | `diff.summary()`           |
| `root`               | whether it is the root commit           | `if(root, "ROOT", "")`     |
| `current_working_copy` | whether it is the current working copy | `current_working_copy`     |
| `divergent`          | whether it is divergent                 | `if(divergent, "D", "")`   |
| `hidden`             | whether the commit is hidden            | `hidden`                   |
| `immutable`          | whether it is immutable                 | `if(immutable, "I", "")`   |

### 2.3 Method Chaining

```bash
# String methods
$ jj log -T 'change_id.short(8) ++ "\n"'   # shorten to 8 characters
$ jj log -T 'change_id.shortest() ++ "\n"'  # shortest unique prefix
$ jj log -T 'description.first_line() ++ "\n"' # first line only
$ jj log -T 'description.lines() ++ "\n"'      # all lines (list)

# Timestamp methods
$ jj log -T 'author.timestamp().ago() ++ "\n"'  # relative time (3 hours ago)
$ jj log -T 'author.timestamp().format("%Y-%m-%d %H:%M") ++ "\n"' # formatted

# ID methods
$ jj log -T 'change_id.short() ++ "\n"'     # short ID
$ jj log -T 'change_id.shortest(4) ++ "\n"' # unique ID of at least 4 characters

# Conditional methods
$ jj log -T '
  change_id.short()
  ++ " "
  ++ if(
    description.first_line().len() > 50,
    description.first_line().substr(0, 50) ++ "...",
    description.first_line()
  )
  ++ "\n"
'
```

### 2.4 Advanced Template Usage

```bash
# diff.summary() — list of changed files
$ jj log -r @ -T 'diff.summary() ++ "\n"'
# M src/auth.ts
# A src/types.ts
# D src/old.ts

# diff.stat() — change statistics
$ jj log -r @ -T 'diff.stat(80) ++ "\n"'
# src/auth.ts  | 10 +++++-----
# src/types.ts |  5 +++++

# separate() — join with separator (empty elements are skipped)
$ jj log -T '
  separate(" | ",
    change_id.short(),
    author.name(),
    if(conflict, "CONFLICT"),
    if(empty, "empty"),
    bookmarks,
    description.first_line(),
  ) ++ "\n"
'
# rlvk | gaku | feature-auth | feat: authentication feature
# qpvu | gaku | empty | main | initial setup

# concat() — simple concatenation
$ jj log -T '
  concat(
    change_id.short(),
    " ",
    description.first_line(),
    "\n",
  )
'

# indent() — multiple lines with indentation
$ jj log -T '
  change_id.short() ++ "\n"
  ++ indent("  ", description)
  ++ "\n"
'

# label() — labels for colorization
$ jj log -T '
  label("change_id prefix", change_id.shortest())
  ++ label("change_id rest", change_id.short())
  ++ " "
  ++ label(if(conflict, "conflict"), description.first_line())
  ++ "\n"
'
```

### 2.5 Defining Templates in Configuration Files

```toml
# ~/.jjconfig.toml

[template-aliases]
# Customize log display
'format_short_change_id(id)' = 'id.shortest(4)'
'format_timestamp(ts)' = 'ts.ago()'
'format_author(author)' = 'author.name()'

# File change summary
'format_diff_summary()' = '''
  if(diff.summary(),
    "\n" ++ indent("  ", diff.summary()),
    ""
  )
'''

[templates]
# Customize default log display
log = '''
  label(if(current_working_copy, "wc"),
    separate(" ",
      format_short_change_id(change_id),
      if(bookmarks, label("bookmark", bookmarks)),
      if(tags, label("tag", tags)),
      if(conflict, label("conflict", "CONFLICT")),
      if(empty, label("empty", "(empty)")),
      if(divergent, label("divergent", "DIVERGENT")),
      if(immutable, label("immutable", "IMMUTABLE")),
      description.first_line(),
    )
  ) ++ "\n"
'''

# Template for show command
show = '''
  "Change ID: " ++ change_id ++ "\n"
  ++ "Commit ID: " ++ commit_id ++ "\n"
  ++ "Author:    " ++ author.name() ++ " <" ++ author.email() ++ ">\n"
  ++ "Date:      " ++ author.timestamp().format("%Y-%m-%d %H:%M:%S") ++ "\n"
  ++ if(bookmarks, "Bookmarks: " ++ bookmarks ++ "\n", "")
  ++ if(tags, "Tags:      " ++ tags ++ "\n", "")
  ++ "\n"
  ++ indent("    ", description)
  ++ "\n"
  ++ diff.stat(80)
  ++ "\n"
'''

# Template for op log
op_log = '''
  separate(" ",
    self.id().short(),
    self.description().first_line(),
    self.time().start().format("%Y-%m-%d %H:%M"),
  ) ++ "\n"
'''
```

### 2.6 Built-in Template Styles

```bash
# Built-in template styles
$ jj log --template builtin_log_oneline
# → single-line display

$ jj log --template builtin_log_compact
# → compact display (default)

$ jj log --template builtin_log_detailed
# → detailed display

# Check styles
$ jj config list templates
# → display currently configured templates
```

---

## 3. Git Integration

### 3.1 fetch / push

```bash
# Fetch from remote
$ jj git fetch
# → retrieves all branches from origin

# Fetch from a specific remote
$ jj git fetch --remote upstream

# Fetch only specific branches
$ jj git fetch --branch main
$ jj git fetch --branch 'feature-*'  # glob pattern

# Push to remote
$ jj git push
# → updates remote branches corresponding to local bookmarks

# Push only a specific bookmark
$ jj git push --bookmark feature-auth

# Push a new bookmark (creates a branch)
$ jj git push --bookmark feature-auth --allow-new
# → a new branch is created on the remote

# Push only changed bookmarks
$ jj git push --change @
# → auto-generates a bookmark name containing @'s change ID and pushes

# Dry run (does not actually push)
$ jj git push --dry-run
# → confirms what would be pushed

# Push all bookmarks
$ jj git push --all
# → pushes all local bookmarks

# Delete bookmarks from remote that were deleted locally
$ jj git push --deleted
```

```
┌─────────────────────────────────────────────────────┐
│  jj git push/fetch flow                             │
│                                                     │
│  jj git fetch:                                      │
│  ┌────────────┐      ┌────────────┐                │
│  │ Remote      │ ---> │ Local       │                │
│  │ refs/heads/ │      │ bookmarks   │                │
│  │ main        │      │ main@origin │                │
│  │ feature-x   │      │ feature-x   │                │
│  └────────────┘      │ @origin     │                │
│                      └────────────┘                │
│                                                     │
│  jj git push:                                       │
│  ┌────────────┐      ┌────────────┐                │
│  │ Local       │ ---> │ Remote      │                │
│  │ bookmarks   │      │ refs/heads/ │                │
│  │ feature-auth│      │ feature-auth│                │
│  └────────────┘      └────────────┘                │
│                                                     │
│  jj git push --change @:                            │
│  1. Auto-generates bookmark name from @'s change ID │
│  2. Creates a branch like push-rlvkpntz... on remote│
│  3. Enables PR creation on GitHub                   │
└─────────────────────────────────────────────────────┘
```

### 3.2 Operating co-located Repositories

```
┌─────────────────────────────────────────────────────┐
│  co-located repository structure                    │
│                                                     │
│  project/                                           │
│  ├── .git/          ← Git object store              │
│  ├── .jj/           ← Jujutsu metadata              │
│  │   ├── repo/                                      │
│  │   │   ├── store/                                 │
│  │   │   │   └── git_target  ← path to .git/       │
│  │   │   ├── op_store/       ← Operation Log        │
│  │   │   └── op_heads/                              │
│  │   └── working_copy/                              │
│  └── src/                                           │
│                                                     │
│  → both jj and git commands can be used             │
│  → jj automatically picks up git command results   │
│  → jj changes are also reflected in .git/           │
└─────────────────────────────────────────────────────┘
```

```bash
# Creating a co-located repo
$ git clone https://github.com/user/repo.git
$ cd repo
$ jj git init --colocate
# → .git/ remains as-is, .jj/ is added

# Or co-locate an existing git repository
$ cd existing-git-repo
$ jj git init --colocate

# Using git commands in a co-located repo
$ git status       # git commands still work
$ jj git import    # import git-side changes into jj (usually automatic)
$ jj git export    # reflect jj changes into git refs (usually automatic)

# After changes with git, reflecting in jj
$ git checkout -b new-branch
$ git commit -m "change from git"
$ jj git import    # import git changes into jj
$ jj log           # visible from jj as well

# Notes on co-located repos
# - git stash is not visible from jj
# - git rebase -i may cause inconsistency with jj's op log
# - Prefer jj-side operations (jj rebase, jj squash, etc.)
```

### 3.3 Remote Management

```bash
# Add a remote
$ jj git remote add upstream https://github.com/upstream/repo.git

# List remotes
$ jj git remote list
origin  https://github.com/user/repo.git
upstream https://github.com/upstream/repo.git

# Remove a remote
$ jj git remote remove upstream

# Rename a remote
$ jj git remote rename origin github

# Change remote URL
$ jj git remote set-url origin git@github.com:user/repo.git
```

### 3.4 Git Compatibility Details

```bash
# Correspondence between Git branches ↔ Jujutsu bookmarks
# Git: refs/heads/main → jj: main (local bookmark)
# Git: refs/remotes/origin/main → jj: main@origin (remote bookmark)
# Git: refs/tags/v1.0 → jj: v1.0 (tag)

# Check bookmark tracking status
$ jj bookmark list --all
feature-auth: rlvkpntz abc12345
  @origin: rlvkpntz abc12345 (tracked)
main: qpvuntsm def67890
  @origin: qpvuntsm def67890 (tracked)
old-branch (deleted)
  @origin: xxxxxxxx xxxxxxxx (tracked)

# Start tracking a remote bookmark
$ jj bookmark track feature-x@origin

# Stop tracking a remote bookmark
$ jj bookmark untrack feature-x@origin

# GIT_HEAD management
# In jj, the concept of HEAD differs from Git
# The parent of the working copy corresponds to Git's HEAD
$ jj log -r @-
# → this is the commit corresponding to Git's HEAD
```

```
┌─────────────────────────────────────────────────────┐
│  Correspondence between Git and Jujutsu concepts    │
│                                                     │
│  Git                    Jujutsu                     │
│  ────────────────────   ────────────────────        │
│  HEAD                   @ (working copy)            │
│  branch                 bookmark                    │
│  refs/remotes/origin/*  *@origin                    │
│  staging area (index)   none (auto-tracked)         │
│  stash                  create a new commit         │
│  detached HEAD          normal state (always detached-like) │
│  commit SHA             commit ID / change ID       │
│  none                   change ID (immutable identifier) │
│  none                   Operation Log               │
│  merge commit           merge commit (same)         │
│  none                   conflict materialization    │
│  none                   divergent changes           │
│                                                     │
│  Key differences:                                   │
│  - change ID is immutable after rebase              │
│  - commit ID changes after rebase                   │
│  - jj has no concept of staging                     │
│  - all file changes are automatically included in working copy │
└─────────────────────────────────────────────────────┘
```

---

## 4. Advanced Workflows

### 4.1 Stacked PRs

```bash
# Creating stacked changes
$ jj new main
$ vim src/types.ts
$ jj describe -m "feat: add type definitions"
$ jj bookmark create pr/types -r @

$ jj new
$ vim src/auth.ts
$ jj describe -m "feat: authentication logic"
$ jj bookmark create pr/auth -r @

$ jj new
$ vim src/api.ts
$ jj describe -m "feat: API endpoints"
$ jj bookmark create pr/api -r @

# Push each bookmark individually
$ jj git push --bookmark pr/types --allow-new
$ jj git push --bookmark pr/auth --allow-new
$ jj git push --bookmark pr/api --allow-new

# Fix a base change (update type definitions)
$ jj edit pr/types
$ vim src/types.ts
# → pr/auth and pr/api are automatically rebased!
# → just re-push each PR
$ jj git push --bookmark pr/types
$ jj git push --bookmark pr/auth
$ jj git push --bookmark pr/api
```

```
┌────────────────────────────────────────────────────┐
│  Stacked PR structure                               │
│                                                    │
│  ○  pr/api   feat: API endpoints                   │
│  ○  pr/auth  feat: authentication logic            │
│  ○  pr/types feat: add type definitions            │
│  ◆  main                                          │
│                                                    │
│  On GitHub:                                        │
│  PR #3: api   (base: pr/auth)                      │
│  PR #2: auth  (base: pr/types)                     │
│  PR #1: types (base: main)                         │
│                                                    │
│  Modify pr/types → pr/auth, pr/api auto-rebased    │
│  → update all 3 PRs with jj git push               │
│                                                    │
│  When PR #1 is merged:                             │
│  $ jj git fetch                                    │
│  $ jj rebase -s pr/auth -d main                    │
│  # → change base of PR #2 to main                 │
│  $ jj git push --bookmark pr/auth                  │
│  $ jj git push --bookmark pr/api                   │
└────────────────────────────────────────────────────┘
```

### 4.2 Automatic Bookmarks with `jj git push --change`

```bash
# Auto-generate bookmark from change ID and push
$ jj git push --change rlvkpntz
# → a bookmark like "push-rlvkpntzqwop" is automatically created
# → a branch is created on GitHub, enabling PR creation

# Customize the bookmark name prefix
$ jj config set --user git.push-bookmark-prefix "gaku/push-"
$ jj git push --change rlvkpntz
# → branch "gaku/push-rlvkpntzqwop" is created

# Push multiple changes at once
$ jj git push --change aaa --change bbb --change ccc
```

### 4.3 Parallel Development Workflow

```bash
# Develop multiple independent changes in parallel
$ jj new main -m "feat: login screen"
$ jj new main -m "fix: performance improvement"
$ jj new main -m "docs: update README"

# Each task branches independently from main
# ○ feat: login screen
# │
# │ ○ fix: performance improvement
# │/
# │ ○ docs: update README
# │/
# ◆ main

# Switch between tasks
$ jj edit rlvkpntz  # switch to login screen commit

# Edit files (automatically reflected in working copy)
$ vim src/login.tsx
# → just save, no staging needed

# Switch to another task
$ jj edit qpvuntsm  # switch to performance improvement
$ vim src/core.ts
```

### 4.4 `jj split` — Splitting a Commit

```bash
# Split a commit interactively
$ jj split
# → editor opens, select files to include in the first commit
# → the rest goes into a new commit

# Separate only specific files
$ jj split --path src/auth.ts
# → only changes to src/auth.ts go into the first commit
# → remaining files go into a new commit

# Specify target commit with -r
$ jj split -r rlvkpntz
# → can split commits other than working copy

# Interactive split details
$ jj split -i
# → interactively select each hunk of the diff
# → equivalent to git add -p but as a commit split
```

```
┌────────────────────────────────────────────────────┐
│  jj split behavior                                  │
│                                                    │
│  Before:                                           │
│  @  commit-A: changes to auth.ts, api.ts, types.ts │
│  ○  main                                          │
│                                                    │
│  $ jj split --path types.ts                        │
│                                                    │
│  After:                                            │
│  @  commit-B: changes to auth.ts, api.ts           │
│  ○  commit-A': changes to types.ts only            │
│  ○  main                                          │
│                                                    │
│  → commit-A is split into a commit with only types.ts │
│  → remaining changes go into commit-B              │
└────────────────────────────────────────────────────┘
```

### 4.5 `jj parallelize` — Parallelizing Sequential Commits

```bash
# Convert sequential commits into parallel
$ jj parallelize rlvkpntz::@
# → converts commits without dependencies into parallel branches

# Before:
# @  commit-C: docs changes
# ○  commit-B: add tests
# ○  commit-A: add feature
# ○  main

# After:
# ○  commit-C: docs changes
# │ ○  commit-B: add tests
# │/
# │ ○  commit-A: add feature
# │/
# ○  main
# → each commit branches independently from main
# → can create individual PRs
```

---

## 5. Operation Log — Operation History

### 5.1 Operation Log Basics

```bash
# Display operation history
$ jj op log
@  abc123 gaku@host 2024-01-15 10:30 (1 minute ago)
│  describe commit rlvkpntzqwop
○  def456 gaku@host 2024-01-15 10:29 (2 minutes ago)
│  new empty commit
○  ghi789 gaku@host 2024-01-15 10:28 (3 minutes ago)
│  snapshot working copy
○  jkl012 gaku@host 2024-01-15 10:25 (6 minutes ago)
│  fetch from git remote(s) origin

# Show details of an operation
$ jj op show abc123
# → list of commits changed by the operation

# Diff between operations
$ jj op diff --from def456 --to abc123
# → what changed between the two operations
```

### 5.2 undo / restore

```bash
# Undo the previous operation
$ jj undo
# → returns to the previous state

# Return to a specific operation
$ jj op restore abc123
# → restores to the state at operation abc123

# Check operation log state before undoing
$ jj op log
# → identify the operation to return to
$ jj op restore jkl012
# → fully restore to the state at jkl012
```

```
┌─────────────────────────────────────────────────────┐
│  Operation Log concept                              │
│                                                     │
│  Differences from Git:                              │
│  Git:  reflog records only ref changes              │
│  jj:   Operation Log records all operations         │
│                                                     │
│  Examples of recorded operations:                   │
│  - new, commit, describe                            │
│  - rebase, squash, split                            │
│  - git fetch, git push                              │
│  - working copy snapshot                            │
│  - bookmark create, move, delete                    │
│                                                     │
│  Advantages:                                        │
│  - all operations can be undone                     │
│  - rebase can be undone in one step                 │
│  - git fetch can also be undone                     │
│  - can inspect diffs between operations             │
│  - merge concurrent operations                      │
│                                                     │
│  op1 ─── op2 ─── op3 ─── op4 (current)             │
│                   ↑                                 │
│            jj op restore op2                        │
│            → op4 is created, restored to op2 state │
│                                                     │
│  op1 ─ op2 ─ op3 ─ op4 ─ op5 (current = op2 state) │
└─────────────────────────────────────────────────────┘
```

### 5.3 Concurrent Operations

```bash
# When working simultaneously in two terminals
# Terminal 1: jj describe -m "feat: login"
# Terminal 2: jj new main

# jj automatically merges concurrent operations
# → branches and merges are recorded in the Operation Log

# Check with op log
$ jj op log
@    merge123 (merge of 2 operations)
├─ ○ describe commit
└─ ○ new empty commit
   ○ previous state

# When a conflict occurs
# → jj attempts automatic resolution
# → error message if unable to resolve
```

---

## 6. Configuration Customization

### 6.1 Complete Guide to ~/.jjconfig.toml

```toml
[user]
name = "Gaku"
email = "gaku@example.com"

[ui]
# Editor settings
editor = "vim"
# Diff editor (used with jj diff --tool)
diff-editor = "meld"
# Merge editor
merge-editor = "meld"
# Pager
pager = "less -FRX"
# Default command (when jj is run without arguments)
default-command = "log"
# Default log display revision
default-revset = 'ancestors(heads(all()), 10)'
# Enable color
color = "auto"  # auto, always, never
# Diff format
diff.format = "git"  # git, color-words, summary

[git]
# Bookmark name prefix when pushing
push-bookmark-prefix = "gaku/push-"
# Autotracking (automatically track new remote bookmarks)
auto-local-bookmark = false

# Define immutable commits (prohibit rebase/edit)
[revset-aliases]
'immutable_heads()' = 'trunk() | tags()'
# Custom revsets
'unpushed()' = 'mine() ~ ::remote_bookmarks()'
'pending_review()' = 'bookmarks() & mine() ~ empty()'
'stack()' = 'trunk()..@'
'needs_fix()' = 'conflict() & descendants(@)'
'wip()' = 'description(regex:"^wip")'
'recent()' = 'latest(mine(), 20)'

[aliases]
# Aliases for commonly used commands
l = ["log", "-r", "ancestors(heads(all()), 10)"]
ll = ["log", "-r", "all()"]
d = ["diff"]
s = ["status"]
n = ["new"]
c = ["commit"]
e = ["edit"]
desc = ["describe"]
sq = ["squash"]
rb = ["rebase"]
# Custom aliases
push-all = ["git", "push", "--all"]
sync = ["git", "fetch", "--all-remotes"]
wip-list = ["log", "-r", "description(regex:\"^wip\")"]

[colors]
# Custom color settings
"change_id" = "magenta"
"commit_id" = "blue"
"bookmarks" = "green bold"
"tags" = "cyan"
"conflict" = "red bold"
"empty" = "dim"
"working_copy" = "green bold"
"divergent" = "yellow bold"
"immutable" = "dim"
"description placeholder" = "yellow dim"

[merge-tools]
# Merge tool settings

# VS Code
[merge-tools.code]
program = "code"
merge-args = ["--wait", "--merge", "$left", "$right", "$base", "$output"]
diff-args = ["--wait", "--diff", "$left", "$right"]

# IntelliJ IDEA
[merge-tools.idea]
program = "idea"
merge-args = ["merge", "$left", "$right", "$base", "$output"]
diff-args = ["diff", "$left", "$right"]

# vimdiff
[merge-tools.vimdiff]
program = "vim"
merge-args = ["-d", "$left", "$right", "$base", "-c", "wincmd J"]

# difftastic (syntax-aware diff)
[merge-tools.difft]
program = "difft"
diff-args = ["--color=always", "$left", "$right"]

[diff]
# Default diff tool
tool = "difft"  # use difftastic
```

### 6.2 Advanced Use of revset-aliases

```toml
[revset-aliases]
# Basic filters
'unpushed()' = 'mine() ~ ::remote_bookmarks()'
'pending_review()' = 'bookmarks() & mine() ~ empty()'
'stack()' = 'trunk()..@'
'needs_fix()' = 'conflict() & descendants(@)'

# For team development
'team_changes()' = 'trunk().. ~ empty()'
'alice_changes()' = 'author("alice") & trunk()..'
'recent_merges()' = 'merges() & ancestors(@, 50)'

# For code review
'review_ready()' = 'bookmarks() ~ empty() ~ conflict() & mine()'
'stale_branches()' = 'bookmarks() & committer_date(before:"30 days ago")'

# For debugging
'touches_auth()' = 'file("src/auth/") & trunk()..'
'large_changes()' = 'file("**") & trunk()..'  # has file changes
'wip_commits()' = 'description(regex:"^(wip|WIP|fixup!|squash!)")'

# Extended immutable
'immutable_heads()' = 'trunk() | tags() | remote_bookmarks(remote="production")'
```

```bash
# Examples of using revset-aliases
$ jj log -r 'unpushed()'
# → my commits not yet pushed

$ jj log -r 'review_ready()'
# → commits ready for review

$ jj log -r 'stale_branches()'
# → branches not updated for 30 days or more

$ jj log -r 'wip_commits()'
# → list of WIP commits
```

### 6.3 Project-Local Configuration

```bash
# Project-specific settings (saved in .jj/repo/config.toml)
$ jj config set --repo revset-aliases.'immutable_heads()' 'trunk() | tags() | bookmarks("release-")'

# Project-specific aliases
$ jj config set --repo aliases.deploy '["git", "push", "--bookmark", "production"]'

# Check settings
$ jj config list --repo
# → show only project-local settings

$ jj config list
# → show all settings (user + repo)

# Check configuration source
$ jj config list --include-defaults
# → show including default values
```

---

## 7. Advanced Operations

### 7.1 `jj absorb` — Automatic Change Distribution

```bash
# Automatically distribute working copy changes to the original commit where each line was changed
$ jj absorb
# → analyzes which commit each line was last changed in
# → automatically distributes changes to the appropriate commit
# → commits affected and their descendants are automatically rebased

# Absorb only specific files
$ jj absorb --paths src/auth.ts

# Check with dry-run
$ jj absorb --dry-run
# → shows where changes would be distributed without actually making changes
```

```
┌────────────────────────────────────────────────────┐
│  jj absorb behavior                                 │
│                                                    │
│  Before:                                           │
│  @  working copy (fix auth.js L10, fix api.js L25) │
│  ○  commit-B  feat: API (created api.js L25)       │
│  ○  commit-A  feat: auth (created auth.js L10)     │
│                                                    │
│  $ jj absorb                                       │
│                                                    │
│  After:                                            │
│  @  working copy (empty)                           │
│  ○  commit-B' feat: API (absorbed api.js L25 fix)  │
│  ○  commit-A' feat: auth (absorbed auth.js L10 fix)│
│                                                    │
│  → each line's fix is automatically distributed to "the original commit" │
│  → equivalent functionality to git absorb / hg absorb │
│                                                    │
│  absorb determination logic:                       │
│  1. identify each changed line in working copy     │
│  2. identify which commit last changed each line (equivalent to blame) │
│  3. absorb the change into that commit             │
│  4. lines that cannot be determined remain in working copy │
└────────────────────────────────────────────────────┘
```

### 7.2 `jj duplicate` — Copying a Commit

```bash
# Duplicate a commit (same content with a different change ID)
$ jj duplicate rlvkpntz
# → a commit with the same changes but a new change ID is created

# Duplicate a range
$ jj duplicate main..feature-auth
# → duplicates all commits in main..feature-auth

# Duplicate then rebase onto another branch
$ jj duplicate rlvkpntz
$ jj rebase -r <new-change-id> -d another-branch

# Equivalent to cherry-pick
$ jj duplicate rlvkpntz -d main
# → duplicates the changes of rlvkpntz on top of main
```

### 7.3 `jj squash` — Merging Commits

```bash
# Merge @ into @-
$ jj squash
# → changes from @ are absorbed into @-
# → @ becomes empty and a new empty commit

# Merge a specific commit into its parent
$ jj squash -r rlvkpntz
# → changes from rlvkpntz are absorbed into its parent

# Merge with a specified message
$ jj squash -m "feat: complete authentication feature"

# Merge only specific files (partial squash)
$ jj squash --paths src/auth.ts
# → only changes to src/auth.ts are merged into parent
# → changes to other files remain as-is

# Interactive squash
$ jj squash -i
# → interactively select changes to merge
```

### 7.4 `jj move` — Moving Changes

```bash
# Move changes from @ to another commit
$ jj move --to rlvkpntz
# → moves changes from @ to rlvkpntz

# Move only changes to specific files
$ jj move --to rlvkpntz --paths src/types.ts

# Move changes between two commits
$ jj move --from aaa --to bbb
# → moves changes from aaa to bbb

# Interactive move
$ jj move --to rlvkpntz -i
# → interactively select changes to move
```

### 7.5 `jj fix` — Automatic Formatting

```bash
# Configuration (~/.jjconfig.toml)
# [fix.tools.rustfmt]
# command = ["rustfmt", "--edition", "2021"]
# patterns = ["glob:*.rs"]
#
# [fix.tools.prettier]
# command = ["npx", "prettier", "--write"]
# patterns = ["glob:*.{js,ts,jsx,tsx}"]

# Format files in the current commit
$ jj fix

# Format commits in a range
$ jj fix -r 'trunk()..@'

# Only specific files
$ jj fix --paths src/
```

---

## 8. Conflict Management

### 8.1 Representing Conflicts

```bash
# In jj, conflicts are recorded as part of a commit
# → you can continue committing without resolving them

# Check commits with conflicts
$ jj log -r 'conflict()'

# Display conflict contents
$ jj diff -r <conflict-commit>

# List files containing conflicts
$ jj resolve --list
# → displays files with conflicts
```

```
┌─────────────────────────────────────────────────────┐
│  Jujutsu conflict management                        │
│                                                     │
│  Differences from Git:                              │
│  Git: conflict → cannot commit until resolved       │
│  jj:  conflict → recorded in commit, resolve later │
│                                                     │
│  ○  commit-C (conflict) ← has conflict              │
│  ○  commit-B             but can commit             │
│  ○  commit-A                                       │
│                                                     │
│  Conflict markers in files:                         │
│  <<<<<<< Conflict 1 of 1                            │
│  %%%%%%% Changes from base to side #1               │
│  -old line                                          │
│  +side 1 change                                     │
│  +++++++ Contents of side #2                        │
│  side 2 change                                      │
│  >>>>>>>                                            │
│                                                     │
│  Resolution methods:                                │
│  1. Directly edit the file and remove markers       │
│  2. Use a merge tool with jj resolve                │
│  3. Conflict resolved automatically upon saving     │
└─────────────────────────────────────────────────────┘
```

### 8.2 Resolving Conflicts

```bash
# Resolve with a merge tool
$ jj resolve
# → configured merge-editor is launched

# Resolve only specific files
$ jj resolve src/auth.ts

# Manual resolution (edit file directly)
$ vim src/auth.ts
# → remove conflict markers
# → conflict is automatically resolved upon saving
# → verify with jj status

# Accept one side's changes
$ jj resolve --tool ':builtin'
# → use the built-in merge tool

# Reset a conflict
$ jj restore --from @- --paths src/auth.ts
# → restore to parent commit's state
```

---

## 9. Anti-patterns

### Anti-pattern 1: Operating on commits one by one without using revsets

```bash
# NG: operating on multiple commits individually
$ jj rebase -r aaa -d main
$ jj rebase -r bbb -d main
$ jj rebase -r ccc -d main

# OK: batch operation with revset
$ jj rebase -s aaa -d main
# → all descendants of aaa are rebased on top of main

# Or
$ jj rebase -r 'author("gaku") & (trunk()..@)' -d main
# → batch rebase commits matching the condition
```

**Reason**: revsets are one of Jujutsu's greatest strengths. You can select commits with complex conditions and operate on them in bulk.

### Anti-pattern 2: Using git rebase directly in a co-located repo

```bash
# NG: using git's rebase directly in a co-located repo
$ git rebase -i main
# → may cause inconsistency with jj's operation log
# → may break the correspondence with jj's change IDs

# OK: use jj's rebase
$ jj rebase -s @ -d main
# → recorded in operation log, also undoable
```

**Reason**: In a co-located repo, both jj and git metadata must be kept consistent. Destructive operations on the git side contradict jj's Operation Log.

### Anti-pattern 3: Using jj checkout + fix + squash instead of jj edit

```bash
# NG: complex steps to modify an old commit
$ jj new rlvkpntz
$ vim src/auth.ts  # fix
$ jj squash        # merge into parent
$ jj new @--       # return to original position

# OK: directly modify with jj edit
$ jj edit rlvkpntz
$ vim src/auth.ts  # fix
# → automatically reflected in working copy
# → descendant commits are automatically rebased
```

**Reason**: `jj edit` switches the working copy to the specified commit, allowing direct modification. Automatic rebasing after modification also updates downstream commits automatically.

### Anti-pattern 4: Manually distributing changes without knowing absorb

```bash
# NG: manually distributing line fixes to original commits
$ jj split -i      # split interactively
# → manually determine which line corresponds to which commit
$ jj squash -r <split-commit> --to <target-commit>
# → move manually

# OK: auto-distribute with jj absorb
$ jj absorb
# → automatically determines which commit each line was last changed in
# → automatically distributes to the appropriate commit
```

**Reason**: `jj absorb` analyzes blame information at the line level and automatically distributes each fix to the appropriate commit. Eliminates the risk of error in manual operations and is dramatically faster.

### Anti-pattern 5: Taking backups instead of using the Operation Log

```bash
# NG: manually backing up
$ jj git push --bookmark backup-before-rebase
$ jj rebase -s @ -d main
# → if it fails, restore from backup branch...

# OK: undo with Operation Log
$ jj rebase -s @ -d main
# → if there is a problem
$ jj undo
# → fully restored to original state
# → can also return to any point in op log
```

**Reason**: Jujutsu's Operation Log records all operations and allows returning to any point in time. Manual backups are unnecessary.

---

## 10. FAQ

### Q1. Where can I check revset syntax if I forget it?

**A1.** Full documentation is displayed with `jj help revsets`.

```bash
$ jj help revsets
# → descriptions of all revset functions and operators are displayed

# Test a specific revset (check before running)
$ jj log -r 'mine() & (main..)' --no-graph -T 'change_id.short() ++ "\n"'
# → displays only the change IDs of matching revisions

# Check revset evaluation results
$ jj log -r 'trunk()..@' --no-graph -T 'change_id.short(8) ++ " " ++ description.first_line() ++ "\n"'
```

### Q2. How do I debug the template language?

**A2.** Template error messages are relatively clear and display available properties and methods.

```bash
# Example error message
$ jj log -T 'invalid_property'
# Error: Failed to parse template
# Caused by: "invalid_property" is not defined
# Hint: Available keywords: ...

# Building incrementally is safer
$ jj log -T 'change_id.short() ++ "\n"'    # start with basics
$ jj log -T 'change_id.short() ++ " " ++ description.first_line() ++ "\n"'

# Check available keywords and methods with help
$ jj help templates
```

### Q3. What should I do if I get a GitHub authentication error when running `jj git push`?

**A3.** Jujutsu uses libgit2 internally, so Git HTTPS credentials are required.

```bash
# Using SSH key (recommended)
$ jj git remote set-url origin git@github.com:user/repo.git

# HTTPS + credential helper
$ git config --global credential.helper osxkeychain  # macOS
$ git config --global credential.helper store         # Linux

# Using GitHub CLI token
$ gh auth setup-git
$ jj git push

# SSH key passphrase issues
# → use ssh-agent
$ eval "$(ssh-agent -s)"
$ ssh-add ~/.ssh/id_ed25519
$ jj git push
```

### Q4. What is a divergent change? How do I deal with it?

**A4.** It is a state where multiple commits with the same change ID exist.

```bash
# Causes of divergence
# - change IDs duplicated by jj duplicate
# - same commit modified in different ways during concurrent work

# Detect divergence
$ jj log -r 'divergent()'

# Resolution: discard one
$ jj abandon <change-id of the one to discard>

# Resolution: merge
$ jj new <divergent-1> <divergent-2>
# → create a new commit merging both changes
$ jj squash
# → merge into one of the parents
```

### Q5. What can I do with the immutable_heads setting?

**A5.** You can define commits you want to protect and prevent accidental operations.

```toml
# ~/.jjconfig.toml
[revset-aliases]
# Protect trunk (main/master) and tags
'immutable_heads()' = 'trunk() | tags()'

# Also protect release branches
'immutable_heads()' = 'trunk() | tags() | bookmarks("release-")'

# Protect commits already pushed to remote
'immutable_heads()' = 'trunk() | tags() | remote_bookmarks()'
```

```bash
# Trying to operate on an immutable commit results in an error
$ jj edit main
# Error: Commit abc123 is immutable

# Check immutable settings
$ jj log -r 'immutable()'
```

### Q6. How can I improve jj performance?

**A6.** Please check the following points.

```bash
# 1. Enable watchman (fast file change detection)
$ jj config set --user core.watchman.register-snapshot-trigger true

# 2. fsmonitor configuration
$ jj config set --user core.fsmonitor "watchman"

# 3. Clean up unnecessary commits
$ jj log -r 'empty() & mine()'
# → check empty commits
$ jj abandon 'empty() & mine() & ~@'
# → delete unnecessary empty commits

# 4. Clean up Operation Log (if there is a large amount of operation history)
# → automatically garbage collected, but
#    manually cleaning up old operations is also possible

# 5. revset optimization for large repos
# → limit depth with ancestors(@, N)
# → limit scope of file()
$ jj log -r 'ancestors(@, 50) & file("src/auth/")'
```

### Q7. What is the equivalent of cherry-pick in jj?

**A7.** Use `jj duplicate`.

```bash
# Equivalent to Git's cherry-pick
# git cherry-pick abc123

# In Jujutsu:
$ jj duplicate abc123
# → a commit with the same content but a new change ID is created

# Cherry-pick onto a specific branch
$ jj new main
$ jj restore --from abc123
$ jj describe -m "cherry-picked: original message"

# Or, duplicate then rebase
$ jj duplicate abc123
$ jj rebase -r <new-change-id> -d main
```

### Q8. What is the equivalent of git stash in jj?

**A8.** jj has no concept of stash, but equivalent operations can be done by creating a new commit.

```bash
# Git: git stash
# jj: since working copy changes are always included in commits,
#     just create a new commit

# Temporarily stash work
$ jj describe -m "wip: work in progress"
$ jj new main  # start different work on top of main

# Return to stashed work
$ jj edit <wip-commit-change-id>

# Can hold multiple "stashes" simultaneously
# → each task exists as an independent commit
# → list with jj log
$ jj log -r 'description(regex:"^wip:")'
```

---


## FAQ

### Q1: What is the most important point in learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional settings?

Knowledge of this topic is frequently applied in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Concept          | Key Points                                                           |
|------------------|----------------------------------------------------------------------|
| revset           | Query language for revision sets, flexible selection with set operations and functions |
| template         | Customization language for log output, property and method chaining  |
| jj git fetch     | Retrieve bookmarks and commits from remote                          |
| jj git push      | Reflect local bookmarks to remote branches                          |
| co-located repo  | .git/ and .jj/ coexist, both jj and git usable                     |
| jj absorb        | Automatically distribute working copy changes to original commits   |
| jj split         | Interactively split a commit by file or hunk                        |
| jj parallelize   | Convert sequential commits into parallel branches                   |
| jj fix           | Automatically apply configured formatters                           |
| Operation Log    | History of all operations, undo/restore always possible             |
| revset-aliases   | Name and reuse frequently used revset queries                       |
| immutable_heads  | Define commits where rebase/edit is prohibited                      |
| divergent        | State where multiple commits share the same change ID               |
| conflict         | Conflicts can be recorded in commits and resolved later             |

---

## Guides to Read Next

- [Git→Jujutsu Migration](./03-git-to-jujutsu.md) — Command mapping table and practical migration steps
- [Jujutsu Workflow](./01-jujutsu-workflow.md) — Review of basic workflow
- [Interactive Rebase](../01-advanced-git/00-interactive-rebase.md) — Comparison with Git-side rebase operations

---

## References

1. **Jujutsu Official Documentation** — "Revsets" https://martinvonz.github.io/jj/latest/revsets/
2. **Jujutsu Official Documentation** — "Templates" https://martinvonz.github.io/jj/latest/templates/
3. **Jujutsu Official Documentation** — "Git compatibility" https://martinvonz.github.io/jj/latest/git-compatibility/
4. **Jujutsu Official Documentation** — "Config" https://martinvonz.github.io/jj/latest/config/
5. **Jujutsu Official Documentation** — "Operation Log" https://martinvonz.github.io/jj/latest/operation-log/
6. **Austin Seipp** — "jujutsu: A new VCS" https://austinseipp.com/posts/2024-07-10-jj-hierarchies
7. **Steve Klabnik** — "jj init" https://steveklabnik.com/writing/jj-init/
