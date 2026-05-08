# Worktree/Submodule

> Learn how to manage multiple working directories with `git worktree` and integrate external repositories with `git submodule`, mastering efficient workflows for large-scale projects.

## What You Will Learn

1. **How git worktree works and how to use it** -- Techniques for checking out multiple branches simultaneously from a single repository
2. **git submodule internals and operation** -- Managing external repository dependencies and pinning versions
3. **Comparison with alternatives** -- When to use subtree merge, monorepos, and package managers
4. **Best practices for large-scale projects** -- CI/CD integration, team workflows, and troubleshooting


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Interactive Rebase](./00-interactive-rebase.md)

---

## 1. git worktree

### 1.1 What is a worktree?

A feature that allows you to **check out multiple branches into separate directories simultaneously** while sharing a single `.git` directory.

```bash
# Adding a worktree
$ git worktree add ../hotfix-v1 hotfix/v1.0.1
# → Checks out hotfix/v1.0.1 into the ../hotfix-v1 directory

# Add a worktree while creating a new branch
$ git worktree add -b feature/new-ui ../new-ui main
# → Creates feature/new-ui from main and checks it out into ../new-ui

# List worktrees
$ git worktree list
/home/user/project          abc1234 [main]
/home/user/hotfix-v1        def5678 [hotfix/v1.0.1]
/home/user/new-ui           789abcd [feature/new-ui]

# Verbose output (porcelain format)
$ git worktree list --porcelain
worktree /home/user/project
HEAD abc1234567890abcdef1234567890abcdef123456
branch refs/heads/main

worktree /home/user/hotfix-v1
HEAD def567890abcdef1234567890abcdef1234567890
branch refs/heads/hotfix/v1.0.1
```

```
┌──────────────────────────────────────────────────────┐
│  worktree directory structure                         │
│                                                      │
│  /home/user/                                         │
│  ├── project/              ← main worktree           │
│  │   ├── .git/             ← shared object DB        │
│  │   │   ├── objects/                                │
│  │   │   ├── refs/                                   │
│  │   │   ├── worktrees/                              │
│  │   │   │   ├── hotfix-v1/   ← worktree-specific   │
│  │   │   │   │   ├── HEAD                            │
│  │   │   │   │   ├── index                           │
│  │   │   │   │   └── gitdir                          │
│  │   │   │   └── new-ui/      ← worktree-specific   │
│  │   │   │       ├── HEAD                            │
│  │   │   │       ├── index                           │
│  │   │   │       └── gitdir                          │
│  │   │   └── ...                                     │
│  │   └── src/              ← working files for main  │
│  │                                                   │
│  ├── hotfix-v1/            ← linked worktree         │
│  │   ├── .git              ← text file (path)        │
│  │   └── src/              ← working files for hotfix│
│  │                                                   │
│  └── new-ui/               ← linked worktree         │
│      ├── .git              ← text file (path)        │
│      └── src/              ← working files for new-ui│
└──────────────────────────────────────────────────────┘
```

### 1.2 Managing worktrees

```bash
# Removing a worktree
$ git worktree remove ../hotfix-v1
# → Deletes the directory and removes it from .git/worktrees/

# Force removal when there are uncommitted changes
$ git worktree remove --force ../hotfix-v1

# Clean up after manually deleting a directory
$ rm -rf ../hotfix-v1
$ git worktree prune
# → Removes references to worktrees that no longer exist

# Lock a worktree (prevents automatic pruning)
$ git worktree lock ../new-ui --reason "long-term work in progress"
$ git worktree unlock ../new-ui

# Move a worktree
$ git worktree move ../new-ui ../new-ui-v2
# → Renames the directory (Git 2.17+)
```

### 1.3 Internal structure of worktrees

```bash
# Contents of the .git file in a linked worktree
$ cat ../hotfix-v1/.git
gitdir: /home/user/project/.git/worktrees/hotfix-v1

# Worktree info on the main repository side
$ cat /home/user/project/.git/worktrees/hotfix-v1/gitdir
/home/user/hotfix-v1/.git

# Worktree-specific HEAD
$ cat /home/user/project/.git/worktrees/hotfix-v1/HEAD
ref: refs/heads/hotfix/v1.0.1

# Worktree-specific index (staging info)
$ ls -la /home/user/project/.git/worktrees/hotfix-v1/index
```

```
┌──────────────────────────────────────────────────────┐
│  What is shared between worktrees / what is not      │
│                                                      │
│  Shared:                                             │
│  ├── .git/objects/     ← all objects                 │
│  ├── .git/refs/        ← all branches and tags       │
│  ├── .git/config       ← repository config           │
│  ├── .git/hooks/       ← hook scripts                │
│  └── .git/info/        ← excludes, etc.              │
│                                                      │
│  Not shared (worktree-specific):                     │
│  ├── HEAD              ← current branch              │
│  ├── index             ← staging state               │
│  ├── MERGE_HEAD        ← in-progress merge state     │
│  ├── REBASE_HEAD       ← in-progress rebase state    │
│  └── working directory ← actual files                │
└──────────────────────────────────────────────────────┘
```

### 1.4 Worktree usage patterns

```bash
# Pattern 1: Work on something else while reviewing a PR
$ git worktree add ../review-pr-42 origin/feature/pr-42
$ cd ../review-pr-42
$ npm install && npm test
$ cd ../project
# → Review without dirtying the main working directory

# Pattern 2: Run builds in parallel
$ git worktree add ../build-release release/v2.0
$ cd ../build-release && npm run build &
$ cd ../project && npm run dev
# → Run a release build and dev server simultaneously

# Pattern 3: Compare behavior across multiple versions
$ git worktree add ../v1 v1.0.0
$ git worktree add ../v2 v2.0.0
# → Verify behavior side by side for two versions

# Pattern 4: Urgent hotfix
$ git worktree add -b hotfix/critical ../hotfix main
$ cd ../hotfix
# ... fix work ...
$ git commit -m "fix: critical security issue"
$ git push origin hotfix/critical
$ cd ../project
$ git worktree remove ../hotfix
# → Complete the hotfix without interrupting main development

# Pattern 5: Edit documentation simultaneously
$ git worktree add ../docs-edit docs/main
$ cd ../docs-edit
# → Work in a dedicated documentation worktree
# → Unaffected by npm install, etc. in the main development worktree

# Pattern 6: Clean build for CI
$ git worktree add --detach ../ci-build HEAD
$ cd ../ci-build
$ npm ci && npm run build && npm test
$ cd ../project
$ git worktree remove ../ci-build
# → Run build and tests in a clean state
```

### 1.5 Branch operations within a worktree

```bash
# Branch operations inside a worktree
$ cd ../hotfix-v1
$ git branch                    # Show all branches (shared across all worktrees)
$ git fetch origin              # Fetch (reflected in all worktrees)
$ git stash                     # Stash changes in this worktree

# Cases where checkout is not allowed in a worktree
$ git worktree add ../test main
# fatal: 'main' is already checked out at '/home/user/project'
# → The same branch cannot be checked out in multiple worktrees

# Workaround: Reference the same commit using a detached HEAD
$ git worktree add --detach ../test HEAD
# → Check out the commit directly rather than a branch
```

### 1.6 Worktree constraints and caveats

| Constraint | Description |
|---|---|
| Duplicate checkout of the same branch | The same branch cannot be checked out in multiple worktrees |
| Bare repositories | Worktrees can be added but there is no main worktree |
| Submodules | Submodules must be initialized per worktree |
| GC | Shares .git/objects with the main worktree |
| node_modules | npm install is required per worktree |
| IDE settings | .idea and .vscode settings are required per worktree |

```bash
# Example: Initializing submodules in a worktree
$ git worktree add ../review origin/feature/review
$ cd ../review
$ git submodule update --init --recursive
# → Submodule initialization is required per worktree

# Example: Installing dependencies in a worktree
$ git worktree add ../test-branch test-branch
$ cd ../test-branch
$ npm install
# → node_modules are independent per worktree
```

### 1.7 Automating worktree workflows with scripts

```bash
#!/bin/bash
# review-pr.sh - Automatically create a worktree for PR review
set -euo pipefail

PR_NUMBER=$1
BRANCH="origin/pr/${PR_NUMBER}"
WORKTREE_DIR="../review-pr-${PR_NUMBER}"

# Fetch latest from remote
git fetch origin

# Create the worktree
git worktree add "$WORKTREE_DIR" "$BRANCH"

# Install dependencies and run tests
cd "$WORKTREE_DIR"
if [ -f package.json ]; then
    npm install
    npm test
fi

echo "Review worktree created at: $WORKTREE_DIR"
echo "To clean up: git worktree remove $WORKTREE_DIR"
```

```bash
#!/bin/bash
# cleanup-worktrees.sh - Bulk-delete unnecessary worktrees
set -euo pipefail

echo "Current worktrees:"
git worktree list

# Detect worktrees for merged branches
git worktree list --porcelain | while read -r line; do
    if [[ "$line" == "branch refs/heads/"* ]]; then
        branch="${line#branch refs/heads/}"
        if git branch --merged main | grep -q "$branch" && [ "$branch" != "main" ]; then
            echo "Removing merged worktree for branch: $branch"
            worktree_path=$(git worktree list | grep "$branch" | awk '{print $1}')
            git worktree remove "$worktree_path" 2>/dev/null || true
        fi
    fi
done

# Clean up references to non-existent worktrees
git worktree prune
echo "Cleanup complete."
```

---

## 2. git submodule

### 2.1 Submodule basics

```bash
# Adding a submodule
$ git submodule add https://github.com/lib/utils.git vendor/utils
# → A .gitmodules file is created
# → The repository is cloned into vendor/utils/
# → A specific commit SHA-1 is recorded in the index

# Contents of .gitmodules
$ cat .gitmodules
[submodule "vendor/utils"]
    path = vendor/utils
    url = https://github.com/lib/utils.git
```

```
┌─────────────────────────────────────────────────────┐
│  How submodules work                                 │
│                                                     │
│  Parent repository tree object:                     │
│  100644 blob abc123  .gitmodules                    │
│  100644 blob def456  README.md                      │
│  160000 commit 789abc vendor/utils  ← references a commit! │
│         ^^^^^^                                      │
│         mode 160000 = submodule                     │
│                                                     │
│  → The parent repo records a specific commit of vendor/utils│
│  → The vendor/utils/ directory is an independent repository │
│  → .gitmodules holds the URL-to-path mapping        │
└─────────────────────────────────────────────────────┘
```

### 2.2 Initializing and cloning submodules

```bash
# Clone and also fetch submodules
$ git clone --recurse-submodules https://github.com/user/project.git

# Initialize submodules after cloning
$ git submodule init
$ git submodule update
# Or all at once
$ git submodule update --init --recursive

# Check the status of all submodules
$ git submodule status
 789abcdef1234567890abcdef1234567890abcdef vendor/utils (v2.3.0)
+fedcba9876543210fedcba9876543210fedcba98 vendor/auth (heads/main)
-0123456789abcdef0123456789abcdef01234567 vendor/ui
```

**Meaning of status markers**:

| Marker | Meaning |
|---|---|
| (space) | Checked out at the recorded commit |
| `+` | Checked out at a different commit than recorded |
| `-` | Not initialized |
| `U` | Merge conflict in progress |

### 2.3 Updating submodules

```bash
# Align to the commit recorded in the parent repository
$ git submodule update
# → Results in a detached HEAD state

# Fetch latest from remote and update submodules
$ git submodule update --remote
# → Updates to the latest commit of the branch set in .gitmodules (default: main)
# → Also updates the parent repository's index

# Update only a specific submodule
$ git submodule update --remote vendor/utils
$ git add vendor/utils
$ git commit -m "chore: update vendor/utils to latest"

# Update with a specified merge strategy
$ git submodule update --remote --merge
# → Merges remote changes into the current branch

$ git submodule update --remote --rebase
# → Rebases current work on top of the latest remote
```

```
┌────────────────────────────────────────────────────┐
│  submodule update flow                              │
│                                                    │
│  git submodule update (without --remote):          │
│  1. Read the recorded commit from the parent repo  │
│  2. Check out the submodule at that commit         │
│  → Always results in the "pinned version"          │
│                                                    │
│  git submodule update --remote:                    │
│  1. Fetch from the submodule's remote              │
│  2. Get the latest commit of the configured branch │
│  3. Check out the submodule at that commit         │
│  4. Update the parent repository's index          │
│  → Follows the "latest version"                    │
│                                                    │
│  git submodule update --remote --merge:            │
│  1. Fetch from remote                              │
│  2. Merge into the current branch                  │
│  → Useful when doing branch work inside a submodule│
└────────────────────────────────────────────────────┘
```

### 2.4 Developing inside a submodule

```bash
# Working inside a submodule
$ cd vendor/utils
$ git checkout main               # Switch from detached HEAD to a branch
$ vim src/index.js                # Make changes
$ git add . && git commit -m "fix: bug in utils"
$ git push origin main            # Push to the submodule's remote

# Go back to the parent repository and update the recorded commit
$ cd ../..
$ git add vendor/utils
$ git commit -m "chore: update vendor/utils submodule"
```

### 2.5 Pinning a submodule to a specific version

```bash
# Pin a submodule to a specific tag
$ cd vendor/utils
$ git fetch --tags
$ git checkout v2.3.0
$ cd ../..
$ git add vendor/utils
$ git commit -m "chore: pin vendor/utils to v2.3.0"

# Pin to a specific commit
$ cd vendor/utils
$ git checkout abc123def456
$ cd ../..
$ git add vendor/utils
$ git commit -m "chore: pin vendor/utils to known-good commit"

# Configure to follow the HEAD of a branch
$ git config -f .gitmodules submodule.vendor/utils.branch develop
$ git submodule update --remote vendor/utils
```

### 2.6 Removing a submodule

```bash
# Completely remove a submodule (3 steps required)
$ git submodule deinit -f vendor/utils   # 1. Deactivate configuration
$ git rm -f vendor/utils                  # 2. Remove from files and index
$ rm -rf .git/modules/vendor/utils        # 3. Delete the cache
$ git commit -m "chore: remove vendor/utils submodule"
```

```
┌──────────────────────────────────────────────────────┐
│  Files/directories affected when removing a submodule│
│                                                      │
│  1. .gitmodules             ← submodule configuration│
│  2. .git/config             ← local configuration    │
│  3. .git/modules/<path>/   ← cached repository       │
│  4. <path>/                ← actual files            │
│  5. index                  ← mode 160000 entry       │
│                                                      │
│  git submodule deinit: removes 2                     │
│  git rm:              removes 1, 4, 5                │
│  rm -rf:              removes 3 (manual)             │
└──────────────────────────────────────────────────────┘
```

### 2.7 Changing submodule URL and path

```bash
# Changing the URL
$ git config -f .gitmodules submodule.vendor/utils.url git@github.com:org/utils.git
$ git submodule sync
$ git submodule update --init

# Changing the path (moving a submodule)
$ git mv vendor/utils lib/utils
# → The path in .gitmodules is also updated automatically (Git 2.17+)
$ git commit -m "chore: move vendor/utils to lib/utils"

# Bulk URL rewrite (HTTPS → SSH)
$ git config --global url."git@github.com:".insteadOf "https://github.com/"
# → All HTTPS URLs are converted to SSH
```

---

## 3. Comparison with subtree merge

```bash
# Integrating an external repository with subtree add
$ git subtree add --prefix=vendor/utils \
    https://github.com/lib/utils.git main --squash

# Updating a subtree
$ git subtree pull --prefix=vendor/utils \
    https://github.com/lib/utils.git main --squash

# Pushing changes from the subtree back upstream
$ git subtree push --prefix=vendor/utils \
    https://github.com/lib/utils.git develop
```

| Item | submodule | subtree |
|---|---|---|
| Repository structure | Independent repository separate from the parent | Integrated into the parent repository |
| Cloning | Requires `--recurse-submodules` | Completes with a normal clone |
| Version management | Strictly pinned by commit SHA-1 | Managed by merge commits |
| Ease of updates | `submodule update` | `subtree pull` |
| .gitmodules management | Required | Not required |
| History independence | Completely isolated | Mixed into parent history |
| CI handling | Requires additional steps | No special handling needed |
| Recommended use | Large external libraries | Small shared code |
| Contributing upstream | Push directly inside the submodule | Extract with `subtree push` |
| Disk usage | Separate clone | Included in the parent repository |

### 3.1 Detailed usage of subtree

```bash
# subtree add (initial addition)
$ git subtree add --prefix=lib/shared \
    git@github.com:org/shared-lib.git main --squash
# → Places external repository content under lib/shared/
# → --squash condenses the external repository history into a single commit

# subtree pull (update)
$ git subtree pull --prefix=lib/shared \
    git@github.com:org/shared-lib.git main --squash
# → Pull in the latest changes

# subtree push (contribute upstream)
$ git subtree push --prefix=lib/shared \
    git@github.com:org/shared-lib.git feature/my-fix
# → Push changes to lib/shared/ to a branch in the external repository

# subtree split (extract history)
$ git subtree split --prefix=lib/shared --branch=shared-only
# → Extract only the history related to lib/shared/ and create a branch
```

### 3.2 Comparison with monorepos

```
┌──────────────────────────────────────────────────────┐
│  Four approaches to dependency management            │
│                                                      │
│  1. submodule                                        │
│     References independent repositories. Easy to pin versions. │
│     Use case: external libraries, large dependencies │
│                                                      │
│  2. subtree                                          │
│     Integrates code directly. Easy to clone.        │
│     Use case: small shared libraries                 │
│                                                      │
│  3. Monorepo                                         │
│     All code in a single repository.                │
│     Use case: tightly coupled projects within an org │
│     Tools: Nx, Turborepo, Bazel                     │
│                                                      │
│  4. Package manager                                  │
│     Version management with npm, pip, gem, etc.     │
│     Use case: public libraries, clear API boundaries │
│                                                      │
│  Decision criteria:                                  │
│  - High change frequency → monorepo or submodule    │
│  - Stable API → package manager                     │
│  - Cloning simplicity matters → subtree             │
│  - Strict version control → submodule               │
└──────────────────────────────────────────────────────┘
```

---

## 4. foreach -- Bulk operations

```bash
# Run the same command in all submodules
$ git submodule foreach 'git fetch origin && git checkout main && git pull'

# Include nested submodules
$ git submodule foreach --recursive 'git clean -fdx'

# Conditional execution
$ git submodule foreach '
  if [ -f package.json ]; then
    npm install
  fi
'

# Use submodule name or path
$ git submodule foreach 'echo "Processing: $name at $sm_path (toplevel: $toplevel)"'
# $name:     submodule name (section name in .gitmodules)
# $sm_path:  submodule path
# $toplevel: top-level directory of the parent repository
# $sha1:     current commit SHA-1 of the submodule
# $displaypath: display path

# Status summary of all submodules
$ git submodule foreach 'echo "$sm_path: $(git describe --always --dirty)"'

# Check if any submodule has uncommitted changes
$ git submodule foreach 'git status --porcelain | grep -q . && echo "$sm_path has changes" || echo "$sm_path is clean"'
```

### 4.1 Practical foreach scripts

```bash
#!/bin/bash
# update-all-submodules.sh - Safely update all submodules
set -euo pipefail

echo "=== Fetching all submodules ==="
git submodule foreach 'git fetch origin 2>/dev/null'

echo ""
echo "=== Status before update ==="
git submodule status

echo ""
echo "=== Updating to remote HEAD ==="
git submodule update --remote

echo ""
echo "=== Status after update ==="
git submodule status

# Commit if there are changes
if ! git diff --cached --quiet; then
    echo ""
    echo "=== Committing submodule updates ==="
    git add -A
    git commit -m "chore: update all submodules to latest"
else
    echo ""
    echo "All submodules are up to date."
fi
```

---

## 5. Practical .gitmodules configuration

```bash
# Specify a branch (used with update --remote)
$ git config -f .gitmodules submodule.vendor/utils.branch develop

# Shallow clone (for faster operations)
$ git config -f .gitmodules submodule.vendor/utils.shallow true

# URL rewrite (for private repositories)
$ git config url."git@github.com:".insteadOf "https://github.com/"

# Fetch configuration for a specific submodule
$ git config -f .gitmodules submodule.vendor/utils.fetchRecurseSubmodules false

# Set the update strategy
$ git config -f .gitmodules submodule.vendor/utils.update merge
# → Use merge on update (default is checkout)

# Final form of .gitmodules
$ cat .gitmodules
[submodule "vendor/utils"]
    path = vendor/utils
    url = https://github.com/lib/utils.git
    branch = develop
    shallow = true
[submodule "vendor/auth"]
    path = vendor/auth
    url = git@github.com:org/auth-lib.git
    branch = main
    update = merge
[submodule "vendor/ui"]
    path = vendor/ui
    url = https://github.com/org/ui-components.git
    branch = stable
    shallow = true
    fetchRecurseSubmodules = false
```

### 5.1 List of .gitmodules configuration options

| Option | Description | Default |
|---|---|---|
| `path` | Path where the submodule is placed | (required) |
| `url` | Repository URL | (required) |
| `branch` | Branch to follow on `--remote` updates | (remote HEAD) |
| `update` | Update strategy (checkout/merge/rebase/none) | checkout |
| `shallow` | Use shallow clone | false |
| `fetchRecurseSubmodules` | Recursively fetch submodules on fetch | (depends on config) |
| `ignore` | Ignore level in status/diff (dirty/untracked/all/none) | none |

---

## 6. Operating submodules in CI/CD environments

### 6.1 GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout with submodules
        uses: actions/checkout@v4
        with:
          submodules: recursive    # Recursively clone submodules
          token: ${{ secrets.PAT_TOKEN }}  # For private submodules

      # shallow submodule (for faster operations)
      # - name: Checkout with shallow submodules
      #   uses: actions/checkout@v4
      #   with:
      #     submodules: recursive
      #     fetch-depth: 1         # shallow clone

      - name: Build
        run: npm run build

      - name: Test
        run: npm test
```

### 6.2 GitLab CI

```yaml
# .gitlab-ci.yml
variables:
  GIT_SUBMODULE_STRATEGY: recursive   # Recursively fetch submodules
  GIT_SUBMODULE_DEPTH: 1              # shallow clone

build:
  script:
    - npm install
    - npm run build

# For private submodules:
# Set CI_JOB_TOKEN in Settings > CI/CD > Variables
# Change URLs in .gitmodules to relative paths:
# [submodule "lib/shared"]
#     path = lib/shared
#     url = ../../group/shared-lib.git
```

### 6.3 Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any
    stages {
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    extensions: [
                        [$class: 'SubmoduleOption',
                         disableSubmodules: false,
                         parentCredentials: true,
                         recursiveSubmodules: true,
                         reference: '',
                         trackingSubmodules: false]
                    ],
                    userRemoteConfigs: [[
                        url: 'https://github.com/org/project.git',
                        credentialsId: 'github-credentials'
                    ]]
                ])
            }
        }
        stage('Build') {
            steps {
                sh 'npm install && npm run build'
            }
        }
    }
}
```

---

## 7. Troubleshooting

### 7.1 Common submodule errors and solutions

```bash
# Error 1: "fatal: reference is not a tree: <sha1>"
# Cause: The commit referenced by the parent repository does not exist on the submodule's remote
$ cd vendor/utils
$ git fetch origin
$ git log --oneline --all | head -5
# → Verify whether the referenced commit exists
# Solution: The submodule developer may have forgotten to push

# Error 2: "fatal: No url found for submodule path 'vendor/utils'"
# Cause: .gitmodules has an entry but git submodule init has not been run
$ git submodule init
$ git submodule update

# Error 3: Submodule ends up in detached HEAD state
# Cause: git submodule update defaults to checkout (detached HEAD)
$ cd vendor/utils
$ git checkout main   # Switch to a branch
# Or change the update strategy to merge
$ git config -f .gitmodules submodule.vendor/utils.update merge

# Error 4: "Submodule path 'vendor/utils' already exists in the index"
# Cause: Attempting to re-add after an incomplete removal
$ git rm -f vendor/utils
$ rm -rf .git/modules/vendor/utils
$ git submodule add <url> vendor/utils

# Error 5: Nested submodules are not initialized
$ git submodule update --init --recursive
# Forgetting --recursive leaves nested submodules uninitialized
```

### 7.2 Worktree troubleshooting

```bash
# Error 1: "fatal: '<branch>' is already checked out"
# Solution: A branch in use by another worktree cannot be used
$ git worktree list  # Check which worktree is using that branch
# → Either remove that worktree or use a different branch name

# Error 2: A worktree is broken (referenced path not found)
$ git worktree repair
# → Repairs broken worktree links (Git 2.30+)

# Error 3: The worktree's .git file is corrupted
$ cat ../hotfix-v1/.git
# → Verify the "gitdir: ..." contents
# → Manually fix the path if it is incorrect

# Error 4: Links broke after moving a worktree
$ git worktree repair ../new-location
# → Repair the link with the new location path
```

---

## 8. Anti-patterns

### Anti-pattern 1: Forgetting to push submodule updates

```bash
# BAD: Pushing the parent repository without pushing the submodule change
$ cd vendor/utils
$ git commit -m "fix: critical bug"
# Forgot to push vendor/utils to its remote
$ cd ../..
$ git add vendor/utils
$ git commit -m "update submodule"
$ git push origin main
# → Other members will get an error when running submodule update because the commit does not exist

# GOOD: Always push the submodule side first
$ cd vendor/utils && git push origin main
$ cd ../.. && git add vendor/utils && git commit && git push
# Or automatically check before pushing
$ git push --recurse-submodules=check origin main
$ git push --recurse-submodules=on-demand origin main  # auto-push
```

**Why**: The parent repository only records the submodule's commit SHA-1. If that commit does not exist on the remote, other developers cannot check it out.

### Anti-pattern 2: Hard-coding absolute worktree paths in scripts

```bash
# BAD: Hard-coded absolute path
BUILD_DIR="/home/user/build-release"
git worktree add "$BUILD_DIR" release/v2.0

# GOOD: Use relative paths or variables
PROJECT_ROOT=$(git rev-parse --show-toplevel)
BUILD_DIR="${PROJECT_ROOT}/../build-release"
git worktree add "$BUILD_DIR" release/v2.0
```

**Why**: Directory structures differ between developers. Resolve paths dynamically using relative paths or git commands.

### Anti-pattern 3: Running submodules in unmanaged branch-following mode

```bash
# BAD: Always following the latest with --remote and integrating without tests
$ git submodule update --remote
$ git add -A && git commit -m "update submodules" && git push
# → Breaking changes may be automatically pulled in

# GOOD: Manage versions explicitly
$ cd vendor/utils
$ git fetch origin
$ git log --oneline origin/main..HEAD  # Review the diff
$ git checkout v2.4.0                   # Pin to a specific version
$ cd ../..
$ git add vendor/utils
$ git commit -m "chore: update vendor/utils to v2.4.0"
```

**Why**: Submodules are dependencies. Uncontrolled automatic updates can lead to bugs in production. It is preferable to manage them with tools such as Dependabot.

### Anti-pattern 4: Leaving a large number of worktrees abandoned

```bash
# BAD: Creating worktrees and leaving them untouched
$ git worktree add ../review-1 feature/a
$ git worktree add ../review-2 feature/b
$ git worktree add ../review-3 feature/c
# ... abandoned for several weeks ...
# → Disk space is consumed; branches can no longer be deleted

# GOOD: Clean up regularly
$ git worktree list
$ git worktree remove ../review-1
$ git worktree prune
```

**Why**: As long as a worktree exists, its branch cannot be deleted and working files continue to occupy disk space.

---

## 9. Advanced submodule operations

### 9.1 Displaying submodule diffs

```bash
# Show submodule changes as a summary
$ git diff --submodule=short
# → Shows commit changes in submodules

$ git diff --submodule=log
# → Shows a log list of changed commits in submodules

$ git diff --submodule=diff
# → Shows the actual diff inside submodules

# Set the default diff display format
$ git config --global diff.submodule log
```

### 9.2 Branch management for submodules

```bash
# Switch all submodules to a specific branch
$ git submodule foreach 'git checkout develop || true'

# Change all submodules from detached HEAD to a branch
$ git submodule foreach '
  branch=$(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main)
  git checkout $branch 2>/dev/null || git checkout -b $branch
'

# Show branches for all submodules in bulk
$ git submodule foreach 'echo "$sm_path: $(git branch --show-current || echo DETACHED)"'
```

### 9.3 Submodule security

```bash
# Verify that submodule URLs are safe with fsck
$ git config --global protocol.file.allow always
# → Explicitly allow the file protocol (since the security fix in Git 2.38.1+)

# Restrict submodule URL behavior
$ git config --global submodule.fetchJobs 4
# → Limit the number of parallel fetch jobs

# Validate URLs
$ git submodule foreach 'echo "$name: $(git remote get-url origin)"'
# → Bulk-check all submodule URLs
```


---

## Practical Exercises

### Exercise 1: Basic implementation

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
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced patterns

Extend the basic implementation to add the following functionality.

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

### Exercise 3: Performance optimization

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
    print(f"Speedup:      {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|---|---|---|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│          Architecture selection flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. How often do you deploy?                    │
│    ├─ Once a week or less → Monolith + modular split │
│    └─ Daily/multiple times → Go to 3            │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Analyzing Trade-offs

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A fast approach in the short term can become technical debt in the long term
- Conversely, over-engineering has a high short-term cost and can delay the project

**2. Consistency vs. flexibility**
- A unified technology stack has low learning costs
- Adopting diverse technologies allows fitting tools to jobs but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but tends to lead to code duplication

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
        md += "\n## Rejected alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-world Application Scenarios

### Scenario 1: MVP development at a startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Do not over-optimize (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a legacy system

**Situation:** Gradually renovating a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If there are no existing tests, write Characterization Tests first
- Keep old and new systems coexisting via an API gateway
- Perform data migration in stages

| Phase | Work | Estimated duration | Risk |
|---|---|---|---|
| 1. Investigation | Current state analysis, understanding dependencies | 2-4 weeks | Low |
| 2. Foundation | Build CI/CD, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a large team

**Situation:** 50 or more engineers working on the same product

**Approach:**
- Use domain-driven design to clarify boundaries
- Assign ownership per team
- Manage shared libraries using the Inner Source model
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

### Scenario 4: Performance-critical systems

**Situation:** A system that requires millisecond-level response times

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization technique | Effect | Implementation cost | Use case |
|---|---|---|---|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## 10. FAQ

### Q1. What is the difference between a worktree and git clone?

**A1.** A worktree **shares the object database**. A clone duplicates everything, so disk usage doubles. A worktree is ideal when you want to work on multiple branches of the same repository in parallel; a clone is appropriate when you need a completely independent working environment.

| Item | worktree | clone |
|---|---|---|
| .git/objects | Shared (linked) | Independent copy |
| Disk usage | Only adds working files | Full data duplication |
| Branch constraints | Same branch not allowed | No constraints |
| Fetch propagation | Immediately reflected in all worktrees | Required individually per clone |
| hooks | Shared | Independent |
| config | Shared | Independent |

### Q2. How do I change a submodule's URL?

**A2.** Follow these steps.

```bash
# 1. Edit .gitmodules
$ git config -f .gitmodules submodule.vendor/utils.url git@github.com:org/utils.git

# 2. Sync local configuration
$ git submodule sync

# 3. Re-initialize the submodule
$ git submodule update --init

# 4. Commit the changes
$ git add .gitmodules
$ git commit -m "chore: update submodule URL for vendor/utils"
```

### Q3. What are the key points when setting up CI for a repository that contains submodules?

**A3.** The following three points are important.

1. **Specify `--recurse-submodules` at clone time**, or run `git submodule update --init --recursive`
2. **Combining with shallow clone**: Get the minimum data with `git clone --depth=1 --recurse-submodules --shallow-submodules`
3. **Configure SSH keys or tokens**: Authentication is required to access private submodules. In GitHub Actions, set `persist-credentials: true` and appropriate token scopes

### Q4. What happens when git gc is run while worktrees are in use?

**A4.** GC runs against the main worktree's `.git/objects/`. Since linked worktree objects are stored in the same database, **objects referenced by all worktrees are protected**. However, if a worktree was manually deleted (with `rm -rf` instead of `git worktree remove`), objects referenced by that worktree may be collected by GC.

```bash
# Safe cleanup procedure
$ git worktree prune          # Delete broken worktree references
$ git gc --prune=now          # Delete unnecessary objects
```

### Q5. How do you use Git's sparse-checkout instead of submodules?

**A5.** Sparse-checkout is a feature for checking out only part of a monorepo, which is a different approach from submodules.

```bash
# sparse-checkout (Git 2.25+)
$ git clone --filter=blob:none --sparse https://github.com/org/monorepo.git
$ cd monorepo
$ git sparse-checkout set lib/utils lib/auth
# → Only lib/utils/ and lib/auth/ are checked out
# → Files in other directories are not downloaded

# Differences from submodules:
# - sparse-checkout: Get part of a single repository
# - submodule: Reference a separate repository
```

### Q6. Are nested submodules (submodules within submodules) recommended?

**A6.** It is technically possible, but **generally not recommended**. The following problems grow as nesting deepens.

- Forgetting `--recursive` results in only partial initialization
- The order of updates becomes complex
- CI/CD configuration becomes cumbersome
- Troubleshooting becomes difficult

As an alternative, consider placing all submodules flat directly under the parent repository.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Rather than theory alone, actually writing code and confirming its behavior deepens understanding.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Concept | Key point |
|---|---|
| worktree | Share .git to check out multiple branches simultaneously |
| linked worktree | References the main repository via a `.git` text file |
| worktree repair | Repair broken worktree links (Git 2.30+) |
| submodule | Records an external repository's commit SHA-1 in the parent repository's tree |
| .gitmodules | Mapping of submodule URL, path, and branch |
| submodule update | Check out the submodule at the commit recorded by the parent |
| submodule sync | Apply .gitmodules changes to local configuration |
| subtree | Alternative approach to integrate external code into the parent repository's history |
| --recurse-submodules | Automatically process submodules during clone/push/pull |
| sparse-checkout | Feature to check out only part of a monorepo |

---

## What to Read Next

- [Packfile/GC](../00-git-internals/03-packfile-gc.md) -- Relationship between worktrees and GC
- [Git Hooks](./03-hooks-automation.md) -- Automating submodule updates
- [Introduction to Jujutsu](../02-jujutsu/00-jujutsu-introduction.md) -- An alternative approach to submodules

---

## References

1. **Pro Git Book** -- "Git Tools - Submodules" https://git-scm.com/book/en/v2/Git-Tools-Submodules
2. **Git official documentation** -- `git-worktree`, `git-submodule` https://git-scm.com/docs
3. **GitHub Blog** -- "Working with submodules" https://github.blog/2016-02-01-working-with-submodules/
4. **Atlassian Git Tutorial** -- "Git subtree" https://www.atlassian.com/git/tutorials/git-subtree
5. **GitHub Docs** -- "About Git sparse-checkout" https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-sparse-checkout
