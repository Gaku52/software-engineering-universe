# Git Hooks

> This guide explains how Git Hooks work and their lifecycle, and how to automate development workflows by combining hooks such as pre-commit, commit-msg, and pre-push with husky and lint-staged.

## What You Will Learn

1. **Types and Lifecycle of Git Hooks** — Trigger timing and use cases for client-side and server-side hooks
2. **Automation with husky + lint-staged** — Setting up and configuring modern hook management tools
3. **Practical Hook Design Patterns** — CI/CD integration, team sharing, and performance optimization
4. **Server-Side Hook Details** — Implementing pre-receive/update/post-receive and applying policies
5. **Alternative Tools (lefthook, pre-commit framework)** — Options beyond husky and when to use each
6. **Monorepo Support and Performance Optimization** — Hook operation strategies for large-scale projects


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content of [bisect/blame](./02-bisect-blame.md)

---

## 1. Git Hooks Basics

### 1.1 Hook Storage Location

```bash
# Default hooks directory
$ ls .git/hooks/
applypatch-msg.sample     pre-commit.sample
commit-msg.sample         pre-merge-commit.sample
fsmonitor-watchman.sample pre-push.sample
post-update.sample        pre-rebase.sample
pre-applypatch.sample     prepare-commit-msg.sample
pre-auto-gc.sample        update.sample

# Remove "sample" and make it executable to enable the hook
$ cp .git/hooks/pre-commit.sample .git/hooks/pre-commit
$ chmod +x .git/hooks/pre-commit

# Change the hooks directory location
$ git config core.hooksPath .githooks
# → Uses .githooks/ inside the project as the hooks directory

# Set a global hooks directory
$ git config --global core.hooksPath ~/.git-hooks
# → Use common hooks across all repositories

# Check the current hooksPath
$ git config --get core.hooksPath
# → .husky (when using husky)
```

### 1.2 Hook Execution Environment

```bash
# Environment variables when a hook is executed
$ cat .git/hooks/pre-commit
#!/bin/sh

# Current working directory (repository root)
echo "PWD: $PWD"

# GIT_DIR: path to the .git directory
echo "GIT_DIR: $GIT_DIR"

# GIT_WORK_TREE: path to the work tree
echo "GIT_WORK_TREE: $GIT_WORK_TREE"

# GIT_INDEX_FILE: path to the index file
echo "GIT_INDEX_FILE: $GIT_INDEX_FILE"

# GIT_AUTHOR_NAME/EMAIL: commit author information
echo "Author: $GIT_AUTHOR_NAME <$GIT_AUTHOR_EMAIL>"

# The shell used to execute the hook is determined by the shebang
# #!/bin/sh — POSIX sh
# #!/bin/bash — Bash
# #!/usr/bin/env python3 — Python
# #!/usr/bin/env node — Node.js
```

```
┌──────────────────────────────────────────────────────┐
│  Hook Execution Environment                          │
│                                                      │
│  Working directory: repository root                  │
│  PATH: the normal PATH is used                       │
│  stdin: varies by hook (pre-push receives ref info)  │
│  Arguments: varies by hook                           │
│                                                      │
│  Notes:                                              │
│  - Hooks run in a non-interactive shell              │
│  - ~/.bashrc is NOT loaded                           │
│  - If shell initialization (e.g. nvm) is needed,    │
│    load it explicitly                                │
│                                                      │
│  #!/bin/sh                                           │
│  export NVM_DIR="$HOME/.nvm"                         │
│  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"    │
│  npx lint-staged                                     │
└──────────────────────────────────────────────────────┘
```

### 1.3 Hook Lifecycle

```
┌─────────────────────────────────────────────────────┐
│  git commit Hook Lifecycle                          │
│                                                     │
│  git commit runs                                    │
│       │                                             │
│       ▼                                             │
│  [pre-commit]  ← lint, format, tests                │
│       │ exit 0 continues / non-0 aborts             │
│       ▼                                             │
│  [prepare-commit-msg]  ← message template           │
│       │                                             │
│       ▼                                             │
│  Edit message in editor                             │
│       │                                             │
│       ▼                                             │
│  [commit-msg]  ← validate message                   │
│       │ exit 0 continues / non-0 aborts             │
│       ▼                                             │
│  Commit created                                     │
│       │                                             │
│       ▼                                             │
│  [post-commit]  ← notifications, logging            │
│                                                     │
├─────────────────────────────────────────────────────┤
│  git push Hook Lifecycle                            │
│                                                     │
│  git push runs                                      │
│       │                                             │
│       ▼                                             │
│  [pre-push]  ← run tests, check branch name        │
│       │ exit 0 continues / non-0 aborts             │
│       ▼                                             │
│  Send to remote                                     │
│       │                                             │
│       ▼ (server-side)                               │
│  [pre-receive]  ← policy check                      │
│  [update]       ← per-branch check                 │
│  [post-receive] ← trigger CI/CD, send notification │
├─────────────────────────────────────────────────────┤
│  git merge Hook Lifecycle                           │
│                                                     │
│  git merge runs                                     │
│       │                                             │
│       ▼                                             │
│  [pre-merge-commit]  ← pre-merge check (Git 2.24+) │
│       │ exit 0 continues / non-0 aborts             │
│       ▼                                             │
│  [prepare-commit-msg]  ← prepare merge message     │
│       │                                             │
│       ▼                                             │
│  [commit-msg]  ← validate merge message            │
│       │                                             │
│       ▼                                             │
│  Merge commit created                               │
│       │                                             │
│       ▼                                             │
│  [post-merge]  ← update dependencies, build        │
├─────────────────────────────────────────────────────┤
│  git rebase Hook Lifecycle                          │
│                                                     │
│  git rebase runs                                    │
│       │                                             │
│       ▼                                             │
│  [pre-rebase]  ← decide whether to allow rebase    │
│       │ exit 0 continues / non-0 aborts             │
│       ▼                                             │
│  Applying each commit:                              │
│    [pre-commit] → [commit-msg] → [post-commit]     │
│       │                                             │
│       ▼                                             │
│  [post-rewrite]  ← after amend/rebase completes    │
│       argument: "amend" or "rebase"                 │
│       stdin: old-sha new-sha pairs (one per line)  │
└─────────────────────────────────────────────────────┘
```

### 1.4 Client-Side Hook List

| Hook                   | Timing                        | Use Case                        | Arguments |
|------------------------|-------------------------------|---------------------------------|-----------|
| `pre-commit`           | Before commit                 | lint, format, tests             | None |
| `prepare-commit-msg`   | Before message editing        | Insert template                 | message file path, source, SHA |
| `commit-msg`           | After message editing         | Validate message format         | message file path |
| `post-commit`          | After commit                  | Notifications                   | None |
| `pre-rebase`           | Before rebase                 | Decide whether to allow rebase  | upstream, branch |
| `post-rewrite`         | After amend/rebase            | Execute related processing      | "amend" or "rebase" |
| `pre-push`             | Before push                   | Tests, branch protection        | remote name, remote URL |
| `post-checkout`        | After checkout                | Update dependencies             | prev HEAD, new HEAD, branch flag |
| `post-merge`           | After merge                   | Update dependencies             | squash flag |
| `pre-auto-gc`          | Before GC                     | Control GC                      | None |
| `pre-merge-commit`     | Before merge commit (2.24+)   | Pre-merge check                 | None |
| `reference-transaction`| On ref update (2.28+)         | Track ref changes               | "prepared"/"committed"/"aborted" |
| `fsmonitor-watchman`   | File change monitoring        | Performance improvement         | version, last-update-token |

### 1.5 Server-Side Hook List

| Hook              | Timing                | Use Case                            | Arguments/stdin |
|-------------------|-----------------------|-------------------------------------|-----------------|
| `pre-receive`     | Before receiving push | Batch check of all refs             | stdin: old-sha new-sha refname |
| `update`          | Before each ref update| Apply per-branch policy             | refname old-sha new-sha |
| `post-receive`    | After receiving push  | Trigger CI/CD, chat notifications   | stdin: old-sha new-sha refname |
| `post-update`     | After ref update      | Run `git update-server-info`, etc.  | List of updated ref names |

---

## 2. Creating Hooks Manually

### 2.1 pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Run lint on staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx)$')

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

echo "Running ESLint on staged files..."
npx eslint $STAGED_FILES
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
  echo "ESLint failed. Commit aborted."
  exit 1
fi

echo "ESLint passed."
exit 0
```

### 2.2 Advanced pre-commit Hook (Partial Stage Support)

```bash
#!/bin/sh
# .git/hooks/pre-commit
# pre-commit that correctly handles partially staged files

set -e

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Export only staged content to a temporary directory
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Check out staged content
git checkout-index --prefix="$TMPDIR/" -a

# Run lint in the temporary directory (staged content only)
JS_FILES=$(echo "$STAGED_FILES" | grep -E '\.(js|ts|jsx|tsx)$' || true)
if [ -n "$JS_FILES" ]; then
  echo "Linting staged JavaScript/TypeScript files..."
  # Convert file paths to temporary directory paths
  LINT_FILES=""
  for file in $JS_FILES; do
    if [ -f "$TMPDIR/$file" ]; then
      LINT_FILES="$LINT_FILES $TMPDIR/$file"
    fi
  done

  if [ -n "$LINT_FILES" ]; then
    npx eslint --no-eslintrc --config .eslintrc.json $LINT_FILES
  fi
fi

# Check Python files
PY_FILES=$(echo "$STAGED_FILES" | grep -E '\.py$' || true)
if [ -n "$PY_FILES" ]; then
  echo "Linting staged Python files..."
  for file in $PY_FILES; do
    if [ -f "$TMPDIR/$file" ]; then
      python -m flake8 "$TMPDIR/$file"
    fi
  done
fi

echo "All checks passed."
exit 0
```

### 2.3 commit-msg Hook

```bash
#!/bin/sh
# .git/hooks/commit-msg

# Validate Conventional Commits format
COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,72}$"

if ! echo "$COMMIT_MSG" | head -1 | grep -qE "$PATTERN"; then
  echo "ERROR: Commit message does not follow Conventional Commits format."
  echo ""
  echo "Format: <type>(<scope>): <description>"
  echo "Example: feat(auth): add login feature"
  echo ""
  echo "type: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
  exit 1
fi

exit 0
```

### 2.4 prepare-commit-msg Hook

```bash
#!/bin/sh
# .git/hooks/prepare-commit-msg
# Automatically appends information from branch name to commit message

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2  # message, template, merge, squash, commit
SHA1=$3

# Skip if message was specified with -m
if [ "$COMMIT_SOURCE" = "message" ]; then
  exit 0
fi

# Skip for merge commits
if [ "$COMMIT_SOURCE" = "merge" ]; then
  exit 0
fi

# Extract ticket number from branch name
BRANCH_NAME=$(git symbolic-ref --short HEAD 2>/dev/null)
TICKET=$(echo "$BRANCH_NAME" | grep -oE '[A-Z]+-[0-9]+' || true)

if [ -n "$TICKET" ]; then
  # Append ticket number to end of message
  if ! grep -qF "$TICKET" "$COMMIT_MSG_FILE"; then
    echo "" >> "$COMMIT_MSG_FILE"
    echo "Refs: $TICKET" >> "$COMMIT_MSG_FILE"
  fi
fi

# Insert template (when no source = regular commit)
if [ -z "$COMMIT_SOURCE" ]; then
  TEMPLATE="

# --- Commit Message Guide ---
# feat: add new feature
# fix: bug fix
# docs: documentation changes
# style: code style changes (no behavioral impact)
# refactor: refactoring
# perf: performance improvement
# test: add or modify tests
# build: build system or dependency changes
# ci: CI/CD changes
# chore: other changes
#
# Format: <type>(<scope>): <description>
# Example: feat(auth): add login feature"
  echo "$TEMPLATE" >> "$COMMIT_MSG_FILE"
fi
```

### 2.5 pre-push Hook

```bash
#!/bin/sh
# .git/hooks/pre-push

# Prohibit direct push to main branch
REMOTE=$1
URL=$2

while read LOCAL_REF LOCAL_SHA REMOTE_REF REMOTE_SHA; do
  if echo "$REMOTE_REF" | grep -qE "refs/heads/(main|master)"; then
    echo "ERROR: Direct push to main/master is not allowed."
    echo "Please create a PR."
    exit 1
  fi
done

# Run tests before push
echo "Running tests before push..."
npm test
exit $?
```

### 2.6 post-checkout Hook

```bash
#!/bin/sh
# .git/hooks/post-checkout
# Automatically update dependencies when switching branches

PREV_HEAD=$1
NEW_HEAD=$2
BRANCH_CHECKOUT=$3  # 1 = branch switch, 0 = file checkout

# Skip for file checkouts
if [ "$BRANCH_CHECKOUT" = "0" ]; then
  exit 0
fi

# Skip if same commit
if [ "$PREV_HEAD" = "$NEW_HEAD" ]; then
  exit 0
fi

# Check if package.json changed
if git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q "package-lock.json"; then
  echo "package-lock.json changed. Running npm install..."
  npm install
fi

# Check if Gemfile changed
if git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q "Gemfile.lock"; then
  echo "Gemfile.lock changed. Running bundle install..."
  bundle install
fi

# Check if requirements.txt changed
if git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q "requirements.txt"; then
  echo "requirements.txt changed. Running pip install..."
  pip install -r requirements.txt
fi

# Check if migration files changed
if git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q "migrations/"; then
  echo "Migration files changed. You may need to run migrations."
  echo "  rails db:migrate     (Rails)"
  echo "  python manage.py migrate  (Django)"
fi

# Check if .env template changed
if git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q ".env.example"; then
  echo "⚠ .env.example has changed. Please review your .env file."
fi
```

### 2.7 post-merge Hook

```bash
#!/bin/sh
# .git/hooks/post-merge
# Automatically update dependencies after merge

SQUASH_MERGE=$1  # 1 = squash merge

# Check files changed in the most recent merge
CHANGED_FILES=$(git diff-tree --name-only -r ORIG_HEAD HEAD)

# Node.js dependencies
if echo "$CHANGED_FILES" | grep -q "package-lock.json\|yarn.lock\|pnpm-lock.yaml"; then
  echo "Dependencies changed. Installing..."
  if [ -f "pnpm-lock.yaml" ]; then
    pnpm install
  elif [ -f "yarn.lock" ]; then
    yarn install
  else
    npm install
  fi
fi

# Database migrations
if echo "$CHANGED_FILES" | grep -qE "db/migrate|migrations/"; then
  echo ""
  echo "================================================================"
  echo "  DATABASE MIGRATION DETECTED"
  echo "  New migration files have been added."
  echo "  Please run database migrations."
  echo "================================================================"
  echo ""
fi

# Submodule updates
if echo "$CHANGED_FILES" | grep -q ".gitmodules"; then
  echo "Submodules changed. Updating..."
  git submodule update --init --recursive
fi
```

### 2.8 pre-rebase Hook

```bash
#!/bin/sh
# .git/hooks/pre-rebase
# Prevent rebasing of protected branches

UPSTREAM=$1
BRANCH=${2:-$(git symbolic-ref --short HEAD)}

# List of protected branches
PROTECTED_BRANCHES="main master develop release"

for protected in $PROTECTED_BRANCHES; do
  if [ "$BRANCH" = "$protected" ]; then
    echo "ERROR: Rebasing '$protected' branch is not allowed."
    echo "Please use merge instead."
    exit 1
  fi
done

# Check if we are trying to rebase commits already pushed to remote
REMOTE_BRANCH="origin/$BRANCH"
if git rev-parse --verify "$REMOTE_BRANCH" > /dev/null 2>&1; then
  LOCAL_ONLY=$(git log --oneline "$REMOTE_BRANCH..HEAD" | wc -l | tr -d ' ')
  TOTAL=$(git log --oneline "$UPSTREAM..HEAD" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TOTAL" -gt "$LOCAL_ONLY" ]; then
    echo "WARNING: Already-pushed commits are included in the rebase target."
    echo "A force push will be required. Continue?"
    # Automatically abort in non-interactive hook
    # Use exec < /dev/tty to make it interactive
    exit 1
  fi
fi

exit 0
```

---

## 3. husky — Modern Hook Management

### 3.1 Installing husky

```bash
# Install husky v9+
$ npm install --save-dev husky

# Initialize husky
$ npx husky init
# → .husky/ directory is created
# → "prepare": "husky" is added to package.json

# Project structure
.husky/
├── _/
│   ├── .gitignore
│   └── husky.sh
├── pre-commit       ← pre-commit hook
└── commit-msg       ← commit-msg hook
```

### 3.2 Creating husky Hooks

```bash
# Create pre-commit hook
$ echo "npx lint-staged" > .husky/pre-commit

# Create commit-msg hook
$ echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg

# Create pre-push hook
$ echo "npm test" > .husky/pre-push
```

```
┌────────────────────────────────────────────────────┐
│  How husky Works                                   │
│                                                    │
│  1. "prepare" script runs during npm install       │
│  2. husky sets core.hooksPath to .husky            │
│  3. .husky/pre-commit runs on git commit           │
│                                                    │
│  Contents of .husky/pre-commit:                    │
│  ┌────────────────────────────────┐                │
│  │ npx lint-staged               │                │
│  └────────────────────────────────┘                │
│                                                    │
│  * v9+ uses simple shell scripts                   │
│  * Team members auto-configure with npm install    │
└────────────────────────────────────────────────────┘
```

### 3.3 Differences Between husky Versions

```
┌────────────────────────────────────────────────────────────┐
│  husky Version Comparison                                  │
│                                                            │
│  v4 (legacy)                                               │
│  ┌──────────────────────────────────────┐                  │
│  │ package.json:                        │                  │
│  │ {                                    │                  │
│  │   "husky": {                         │                  │
│  │     "hooks": {                       │                  │
│  │       "pre-commit": "lint-staged"    │                  │
│  │     }                                │                  │
│  │   }                                  │                  │
│  │ }                                    │                  │
│  │ → Directly modifies .git/hooks/      │                  │
│  │ → husky.sh inside node_modules acts │                  │
│  │   as intermediary                    │                  │
│  └──────────────────────────────────────┘                  │
│                                                            │
│  v9+ (current)                                             │
│  ┌──────────────────────────────────────┐                  │
│  │ .husky/pre-commit:                   │                  │
│  │ npx lint-staged                      │                  │
│  │                                      │                  │
│  │ → Sets core.hooksPath = .husky       │                  │
│  │ → Simple shell scripts               │                  │
│  │ → Leverages native Git features      │                  │
│  └──────────────────────────────────────┘                  │
│                                                            │
│  Migration points:                                         │
│  - v4 → v9: Remove "husky" section from package.json      │
│  - Create individual files in .husky/ directory            │
│  - Add "prepare": "husky" to scripts                       │
│  - Change HUSKY_GIT_PARAMS → $1                            │
└────────────────────────────────────────────────────────────┘
```

### 3.4 Advanced husky Configuration

```bash
# .husky/pre-commit — conditional execution
#!/bin/sh

# Skip in CI environments
[ -n "$CI" ] && exit 0

# Skip during merge
[ -f ".git/MERGE_HEAD" ] && exit 0

# Skip during rebase
[ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ] && exit 0

# Run lint-staged
npx lint-staged
```

```bash
# .husky/pre-push — advanced pre-push
#!/bin/sh

REMOTE=$1
URL=$2

# Get branch name
BRANCH=$(git symbolic-ref --short HEAD)

# Prohibit direct push to main branch
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "ERROR: Direct push to $BRANCH is not allowed."
  echo "Please create a PR."
  exit 1
fi

# Check for WIP commits
WIP_COMMITS=$(git log --oneline @{u}..HEAD 2>/dev/null | grep -i "wip" || true)
if [ -n "$WIP_COMMITS" ]; then
  echo "WARNING: WIP commits are included:"
  echo "$WIP_COMMITS"
  echo ""
  echo "Please clean up WIP commits before pushing."
  echo "You can use git rebase -i to organize them."
  exit 1
fi

# Run tests (only for related files)
CHANGED_FILES=$(git diff --name-only @{u}..HEAD 2>/dev/null | grep -E '\.(js|ts|jsx|tsx)$' || true)
if [ -n "$CHANGED_FILES" ]; then
  echo "Running tests for changed files..."
  npx jest --bail --findRelatedTests $CHANGED_FILES
fi

exit 0
```

---

## 4. lint-staged — Process Only Staged Files

### 4.1 lint-staged Configuration

```bash
# Install
$ npm install --save-dev lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,scss}": [
      "stylelint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

```bash
# Or configure with .lintstagedrc.js
module.exports = {
  '*.{js,jsx,ts,tsx}': (filenames) => [
    `eslint --fix ${filenames.join(' ')}`,
    `prettier --write ${filenames.join(' ')}`,
    `jest --bail --findRelatedTests ${filenames.join(' ')}`,
  ],
};
```

### 4.2 lint-staged Execution Flow

```
┌─────────────────────────────────────────────────────┐
│  lint-staged Execution Flow                         │
│                                                     │
│  1. Get list of staged files                        │
│     git diff --cached --name-only --diff-filter=ACMR│
│                                                     │
│  2. Match commands based on file patterns           │
│     *.js → eslint --fix, prettier --write           │
│     *.css → stylelint --fix                         │
│                                                     │
│  3. Stash changes (for safety)                      │
│     → Temporarily hide unstaged changes             │
│                                                     │
│  4. Execute each command sequentially               │
│     eslint --fix src/auth.js src/utils.js           │
│     prettier --write src/auth.js src/utils.js       │
│                                                     │
│  5. Re-stage files modified by --fix               │
│     git add src/auth.js src/utils.js                │
│                                                     │
│  6. Restore stash                                   │
│                                                     │
│  7. exit 0 for success / non-0 aborts commit        │
└─────────────────────────────────────────────────────┘
```

### 4.3 Advanced lint-staged Configuration Patterns

```javascript
// .lintstagedrc.js — advanced configuration patterns

module.exports = {
  // Pattern 1: dynamically generate commands using function form
  '*.{js,jsx,ts,tsx}': (filenames) => {
    // Split into chunks if 100+ files
    const chunks = [];
    const chunkSize = 50;
    for (let i = 0; i < filenames.length; i += chunkSize) {
      chunks.push(filenames.slice(i, i + chunkSize));
    }
    return chunks.flatMap(chunk => [
      `eslint --fix ${chunk.join(' ')}`,
      `prettier --write ${chunk.join(' ')}`,
    ]);
  },

  // Pattern 2: separate handling for test directory files
  'src/**/*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  'tests/**/*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    'jest --bail --findRelatedTests',
  ],

  // Pattern 3: exclude specific files
  '!(*test).{js,ts}': [
    'eslint --fix',
  ],

  // Pattern 4: Python files
  '*.py': [
    'black',
    'isort',
    'flake8',
  ],

  // Pattern 5: Rust files
  '*.rs': [
    'rustfmt',
  ],

  // Pattern 6: Go files
  '*.go': (filenames) => {
    // Go is processed per package, not per individual file
    const dirs = [...new Set(filenames.map(f => {
      const parts = f.split('/');
      parts.pop();
      return parts.join('/') || '.';
    }))];
    return dirs.map(dir => `cd ${dir} && go vet ./...`);
  },

  // Pattern 7: image optimization
  '*.{png,jpg,jpeg,gif,svg}': [
    'imagemin-lint-staged',
  ],

  // Pattern 8: markdown spell check
  '*.md': [
    'markdownlint --fix',
    'cspell --no-must-find-files',
  ],
};
```

### 4.4 lint-staged Troubleshooting

```bash
# lint-staged debug mode
$ npx lint-staged --debug

# Common errors and solutions

# Error 1: "lint-staged prevented an empty git commit"
# → All errors were fixed by --fix, resulting in identical staged content
# → Add --allow-empty flag or fix the original code

# Error 2: "Skipping because of an error from a previous task"
# → A previous command failed
# → Fix eslint errors and recommit

# Error 3: stash-related errors
# → lint-staged stash operation conflicts
$ git stash list
# Delete unnecessary stash
$ git stash drop

# lint-staged --no-stash option (v13+)
# Mode without stash (faster when not using partial staging)
$ npx lint-staged --no-stash
```

---

## 5. commitlint — Validating Commit Messages

### 5.1 Basic Configuration

```bash
# Install
$ npm install --save-dev @commitlint/{cli,config-conventional}

# Configuration file
$ cat commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert'
    ]],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
```

| Rule                  | Description                             | Example               |
|-----------------------|-----------------------------------------|-----------------------|
| `type-enum`           | List of allowed types                   | feat, fix, docs, ...  |
| `type-case`           | Case for type                           | lower-case            |
| `subject-max-length`  | Maximum characters for title line       | 72                    |
| `body-max-line-length`| Maximum characters per body line        | 100                   |
| `header-max-length`   | Maximum characters for entire header    | 100                   |

### 5.2 Creating Custom Rules

```javascript
// commitlint.config.js — advanced custom configuration
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Level: 0 = disabled, 1 = warning, 2 = error
    // Applicable: 'always' or 'never'

    // type-related
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert',
      'wip',  // Allow WIP (checked separately in push hook)
    ]],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],

    // scope-related
    'scope-case': [2, 'always', 'lower-case'],
    'scope-enum': [1, 'always', [  // Warning only (flexible)
      'auth', 'api', 'ui', 'db', 'config', 'deps', 'ci',
    ]],

    // subject-related
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-max-length': [2, 'always', 72],
    'subject-full-stop': [2, 'never', '.'],

    // body-related
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],

    // footer-related
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],

    // header-related
    'header-max-length': [2, 'always', 100],
  },

  // Custom plugins
  plugins: [
    {
      rules: {
        // Require ticket number (custom rule)
        'ticket-reference': (parsed) => {
          const { footer, body } = parsed;
          const hasTicket = (footer && /[A-Z]+-\d+/.test(footer)) ||
                           (body && /[A-Z]+-\d+/.test(body));
          return [
            hasTicket,
            'Please include a ticket number (e.g. PROJ-123) in the commit message',
          ];
        },
      },
    },
  ],
};
```

### 5.3 commitlint CI Integration

```yaml
# .github/workflows/commitlint.yml
name: Commit Lint

on:
  pull_request:
    branches: [main, develop]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch full history

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
        env:
          HUSKY: 0

      - name: Lint commits
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
```

```bash
# Validate all commits in a PR locally
$ npx commitlint --from origin/main --to HEAD --verbose

# Validate only the last commit
$ npx commitlint --from HEAD~1

# Validate a message directly
$ echo "feat: add login feature" | npx commitlint
```

---

## 6. Server-Side Hook Details

### 6.1 pre-receive Hook

```bash
#!/bin/bash
# hooks/pre-receive — server-side global policy check

# Read ref information received from stdin
while read OLD_SHA NEW_SHA REFNAME; do
  echo "Checking: $REFNAME ($OLD_SHA -> $NEW_SHA)"

  # Deletion case (new_sha = 0000...)
  ZERO="0000000000000000000000000000000000000000"
  if [ "$NEW_SHA" = "$ZERO" ]; then
    # Prohibit deletion of protected branches
    if echo "$REFNAME" | grep -qE "refs/heads/(main|master|develop)"; then
      echo "ERROR: Deletion of protected branch '$REFNAME' is not allowed."
      exit 1
    fi
    continue
  fi

  # New branch case (old_sha = 0000...)
  if [ "$OLD_SHA" = "$ZERO" ]; then
    COMMITS=$(git rev-list "$NEW_SHA" --not --branches)
  else
    COMMITS=$(git rev-list "$OLD_SHA..$NEW_SHA")
  fi

  # Check each commit
  for COMMIT in $COMMITS; do
    # Validate commit message
    MSG=$(git log --format=%B -n 1 "$COMMIT")
    if ! echo "$MSG" | head -1 | grep -qE "^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)"; then
      echo "ERROR: Commit $COMMIT message does not follow Conventional Commits format."
      echo "  Message: $(echo "$MSG" | head -1)"
      exit 1
    fi

    # Check for large files
    MAX_SIZE=$((10 * 1024 * 1024))  # 10MB
    git diff-tree --no-commit-id -r "$COMMIT" | while read MODE_A MODE_B SHA_A SHA_B STATUS FILENAME; do
      if [ "$STATUS" = "D" ]; then
        continue  # Skip deleted files
      fi
      FILE_SIZE=$(git cat-file -s "$SHA_B" 2>/dev/null || echo 0)
      if [ "$FILE_SIZE" -gt "$MAX_SIZE" ]; then
        echo "ERROR: File '$FILENAME' exceeds ${MAX_SIZE} bytes (${FILE_SIZE} bytes)."
        echo "Consider using Git LFS."
        exit 1
      fi
    done
    if [ $? -ne 0 ]; then
      exit 1
    fi

    # Detect secrets
    git diff-tree --no-commit-id -r -p "$COMMIT" | grep -qE "(PRIVATE KEY|password\s*=\s*['\"]|AWS_SECRET|api_key\s*=)" && {
      echo "ERROR: Commit $COMMIT may contain sensitive information."
      exit 1
    }
  done
done

echo "All checks passed."
exit 0
```

### 6.2 update Hook

```bash
#!/bin/bash
# hooks/update — per-branch policy check

REFNAME=$1
OLD_SHA=$2
NEW_SHA=$3
ZERO="0000000000000000000000000000000000000000"

# Get branch name
BRANCH=$(echo "$REFNAME" | sed 's|refs/heads/||')

# Get the pushing user (environment-dependent)
USER=${GL_USERNAME:-${REMOTE_USER:-$(whoami)}}

echo "=== Update hook: $BRANCH by $USER ==="

# main branch protection policy
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  # Detect force push
  if [ "$OLD_SHA" != "$ZERO" ] && [ "$NEW_SHA" != "$ZERO" ]; then
    MERGE_BASE=$(git merge-base "$OLD_SHA" "$NEW_SHA" 2>/dev/null || echo "")
    if [ "$MERGE_BASE" != "$OLD_SHA" ]; then
      echo "ERROR: Force push to $BRANCH is not allowed."
      exit 1
    fi
  fi

  # Restrict push to admins only (ACL)
  ADMINS="alice bob charlie"
  IS_ADMIN=false
  for admin in $ADMINS; do
    if [ "$USER" = "$admin" ]; then
      IS_ADMIN=true
      break
    fi
  done

  if [ "$IS_ADMIN" = "false" ]; then
    echo "ERROR: Direct push to $BRANCH is only allowed for administrators."
    echo "Please create a PR."
    exit 1
  fi
fi

# Release branch protection
if echo "$BRANCH" | grep -qE "^release/"; then
  # Only allow hotfix (fix commits only)
  COMMITS=$(git rev-list "$OLD_SHA..$NEW_SHA" 2>/dev/null)
  for COMMIT in $COMMITS; do
    MSG=$(git log --format=%s -n 1 "$COMMIT")
    if ! echo "$MSG" | grep -qE "^(fix|hotfix|revert)"; then
      echo "ERROR: Only fix/hotfix/revert commits are allowed on release branches."
      echo "  Commit: $COMMIT"
      echo "  Message: $MSG"
      exit 1
    fi
  done
fi

# Tag protection
if echo "$REFNAME" | grep -q "refs/tags/"; then
  TAG=$(echo "$REFNAME" | sed 's|refs/tags/||')
  # Prohibit modifying existing tags
  if [ "$OLD_SHA" != "$ZERO" ]; then
    echo "ERROR: Modifying existing tag '$TAG' is not allowed."
    exit 1
  fi
  # Validate semantic versioning
  if ! echo "$TAG" | grep -qE "^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$"; then
    echo "ERROR: Tag '$TAG' does not follow semantic versioning format."
    echo "Format: v1.2.3 or v1.2.3-beta.1"
    exit 1
  fi
fi

exit 0
```

### 6.3 post-receive Hook

```bash
#!/bin/bash
# hooks/post-receive — automatic processing after receiving push

while read OLD_SHA NEW_SHA REFNAME; do
  BRANCH=$(echo "$REFNAME" | sed 's|refs/heads/||')
  ZERO="0000000000000000000000000000000000000000"

  # Skip for branch deletions
  if [ "$NEW_SHA" = "$ZERO" ]; then
    continue
  fi

  # Get commit info
  AUTHOR=$(git log --format='%an' -n 1 "$NEW_SHA")
  COMMIT_MSG=$(git log --format='%s' -n 1 "$NEW_SHA")

  if [ "$OLD_SHA" = "$ZERO" ]; then
    COMMIT_COUNT="new branch"
  else
    COMMIT_COUNT=$(git rev-list --count "$OLD_SHA..$NEW_SHA")
  fi

  # Slack notification (webhook)
  SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  PAYLOAD=$(cat <<EOF
{
  "channel": "#git-notifications",
  "username": "Git Bot",
  "text": ":git: *${AUTHOR}* pushed ${COMMIT_COUNT} commit(s) to *${BRANCH}*\n> ${COMMIT_MSG}",
  "icon_emoji": ":octocat:"
}
EOF
  )
  curl -s -X POST -H 'Content-type: application/json' \
    --data "$PAYLOAD" "$SLACK_WEBHOOK" > /dev/null 2>&1 &

  # Push to main → deploy
  if [ "$BRANCH" = "main" ]; then
    echo "Deploying to production..."
    /opt/deploy/production.sh "$NEW_SHA" &
  fi

  # Push to develop → staging deploy
  if [ "$BRANCH" = "develop" ]; then
    echo "Deploying to staging..."
    /opt/deploy/staging.sh "$NEW_SHA" &
  fi

  # Tag push → release processing
  if echo "$REFNAME" | grep -q "refs/tags/"; then
    TAG=$(echo "$REFNAME" | sed 's|refs/tags/||')
    echo "Creating release for tag: $TAG"
    /opt/release/create-release.sh "$TAG" "$NEW_SHA" &
  fi
done

exit 0
```

---

## 7. Complete Configuration Example

### 7.1 package.json

```json
{
  "name": "my-project",
  "scripts": {
    "prepare": "husky",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "test": "jest",
    "test:staged": "jest --bail --findRelatedTests"
  },
  "devDependencies": {
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

### 7.2 .husky/ Directory

```bash
# .husky/pre-commit
npx lint-staged

# .husky/commit-msg
npx --no -- commitlint --edit $1

# .husky/pre-push
npm test
```

```
┌────────────────────────────────────────────────────┐
│  Complete Automation Flow                          │
│                                                    │
│  git commit -m "feat: add login"                   │
│       │                                            │
│       ▼                                            │
│  .husky/pre-commit                                 │
│       │                                            │
│       ▼                                            │
│  lint-staged                                       │
│    ├── eslint --fix (target: *.js, *.ts)          │
│    ├── prettier --write (target: all files)        │
│    └── re-stage modified files                     │
│       │                                            │
│       ▼                                            │
│  .husky/commit-msg                                 │
│    └── commitlint (validate "feat: add login")     │
│       │                                            │
│       ▼                                            │
│  Commit created                                    │
│                                                    │
│  git push                                          │
│       │                                            │
│       ▼                                            │
│  .husky/pre-push                                   │
│    └── npm test (run all tests)                    │
│       │                                            │
│       ▼                                            │
│  Sent to remote                                    │
└────────────────────────────────────────────────────┘
```

### 7.3 Complete TypeScript Project Configuration

```json
{
  "name": "typescript-project",
  "scripts": {
    "prepare": "husky",
    "lint": "eslint 'src/**/*.{ts,tsx}'",
    "format": "prettier --write 'src/**/*.{ts,tsx,json,css}'",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "vite build"
  },
  "devDependencies": {
    "husky": "^9.1.0",
    "lint-staged": "^15.2.0",
    "@commitlint/cli": "^19.3.0",
    "@commitlint/config-conventional": "^19.2.0",
    "eslint": "^9.5.0",
    "@typescript-eslint/eslint-plugin": "^7.14.0",
    "@typescript-eslint/parser": "^7.14.0",
    "prettier": "^3.3.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml,css}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit — for TypeScript
#!/bin/sh

# Run lint-staged
npx lint-staged

# Type check (entire project)
# * Type checking only staged files is not possible, so run against the whole project
echo "Running type check..."
npx tsc --noEmit
```

### 7.4 Python Project Configuration (using pre-commit framework)

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
      - id: detect-private-key

  - repo: https://github.com/psf/black
    rev: 24.4.2
    hooks:
      - id: black
        language_version: python3.12

  - repo: https://github.com/pycqa/isort
    rev: 5.13.2
    hooks:
      - id: isort
        args: ['--profile', 'black']

  - repo: https://github.com/pycqa/flake8
    rev: 7.1.0
    hooks:
      - id: flake8
        args: ['--max-line-length', '88']

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.10.0
    hooks:
      - id: mypy
        additional_dependencies:
          - types-requests
          - types-PyYAML

  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.9
    hooks:
      - id: bandit
        args: ['-c', 'pyproject.toml']

  - repo: local
    hooks:
      - id: pytest
        name: pytest
        entry: python -m pytest tests/ -x --tb=short
        language: system
        types: [python]
        pass_filenames: false
        always_run: true
        stages: [push]
```

```bash
# Installing and using the pre-commit framework
$ pip install pre-commit

# Install hooks
$ pre-commit install
$ pre-commit install --hook-type commit-msg
$ pre-commit install --hook-type pre-push

# Run manually against all files
$ pre-commit run --all-files

# Run only a specific hook
$ pre-commit run black --all-files

# Update hooks
$ pre-commit autoupdate

# Clear cache
$ pre-commit clean
```

---

## 8. Alternative Tools

### 8.1 lefthook

```yaml
# lefthook.yml — a fast hook manager written in Go

pre-commit:
  parallel: true  # Run commands in parallel
  commands:
    eslint:
      glob: "*.{js,jsx,ts,tsx}"
      run: npx eslint --fix {staged_files}
      stage_fixed: true  # Re-stage fixed files

    prettier:
      glob: "*.{js,jsx,ts,tsx,json,md,css,yml}"
      run: npx prettier --write {staged_files}
      stage_fixed: true

    stylelint:
      glob: "*.{css,scss}"
      run: npx stylelint --fix {staged_files}
      stage_fixed: true

    typecheck:
      glob: "*.{ts,tsx}"
      run: npx tsc --noEmit

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-push:
  parallel: true
  commands:
    test:
      run: npm test

    branch-check:
      run: |
        BRANCH=$(git symbolic-ref --short HEAD)
        if [ "$BRANCH" = "main" ]; then
          echo "ERROR: Direct push to main is not allowed"
          exit 1
        fi

post-checkout:
  commands:
    deps:
      run: |
        if git diff --name-only {1} {2} | grep -q "package-lock.json"; then
          npm install
        fi
```

```bash
# Install lefthook
$ npm install --save-dev lefthook
# or
$ brew install lefthook

# Install hooks
$ npx lefthook install

# Run a specific hook manually
$ npx lefthook run pre-commit

# Debug mode
$ LEFTHOOK_VERBOSE=1 npx lefthook run pre-commit
```

```
┌──────────────────────────────────────────────────────┐
│  husky vs lefthook Comparison                        │
│                                                      │
│  husky                                               │
│  + Simple configuration (shell scripts)              │
│  + Good compatibility with Node.js ecosystem         │
│  + Large community                                   │
│  - Parallel execution requires separate setup        │
│  - lint-staged needed for staged file processing     │
│                                                      │
│  lefthook                                            │
│  + Fast startup as a Go binary                       │
│  + Parallel execution is built-in                    │
│  + Staged file processing is built-in                │
│  + stage_fixed is built-in (re-staging)              │
│  + Easy to use for non-Node.js projects              │
│  - Smaller community than husky                      │
│                                                      │
│  Conclusion:                                         │
│  Node.js projects → husky + lint-staged              │
│  Multi-language/monorepos → lefthook                 │
│  Python projects → pre-commit framework              │
└──────────────────────────────────────────────────────┘
```

### 8.2 Tool Selection Guide

```
┌─────────────────────────────────────────────────────┐
│  Hook Management Tool Selection Flowchart           │
│                                                     │
│  What is the primary project language?              │
│       │                                             │
│       ├── Python → pre-commit framework             │
│       │   - .pre-commit-config.yaml                 │
│       │   - pip install pre-commit                  │
│       │                                             │
│       ├── JavaScript/TypeScript → husky             │
│       │   - npm install husky lint-staged           │
│       │   - Simple and proven                       │
│       │                                             │
│       ├── Go/Rust/multi-language → lefthook         │
│       │   - Fast, written in Go                     │
│       │   - Language-agnostic                       │
│       │                                             │
│       └── Monorepo (mixed languages)                │
│            ├── Turborepo → husky + turbo lint       │
│            └── Others → lefthook                    │
│                - Strong parallel execution           │
│                - Target can be narrowed with glob:  │
│                                                     │
│  Additional considerations:                         │
│  - CI/CD integration → GitHub Actions + lint config │
│  - Security focus → pre-receive (server-side)       │
│  - Large teams → core.hooksPath + shared config     │
└─────────────────────────────────────────────────────┘
```

---

## 9. Monorepo Support

### 9.1 lint-staged Configuration for Monorepos

```javascript
// .lintstagedrc.js — monorepo (Turborepo)
const path = require('path');

module.exports = {
  '*.{js,jsx,ts,tsx}': (filenames) => {
    // Classify files by package
    const packages = {};
    filenames.forEach(filename => {
      const relative = path.relative(process.cwd(), filename);
      const parts = relative.split(path.sep);
      let pkg = 'root';
      if (parts[0] === 'packages' && parts.length > 2) {
        pkg = parts[1];
      } else if (parts[0] === 'apps' && parts.length > 2) {
        pkg = `app-${parts[1]}`;
      }
      if (!packages[pkg]) packages[pkg] = [];
      packages[pkg].push(filename);
    });

    const commands = [];
    Object.entries(packages).forEach(([pkg, files]) => {
      const fileList = files.join(' ');
      commands.push(`eslint --fix ${fileList}`);
      commands.push(`prettier --write ${fileList}`);
    });
    return commands;
  },
};
```

### 9.2 lefthook Monorepo Configuration

```yaml
# lefthook.yml — monorepo configuration
pre-commit:
  parallel: true
  commands:
    # Per-package lint
    lint-web:
      root: "apps/web/"
      glob: "*.{ts,tsx}"
      run: npx eslint --fix {staged_files}
      stage_fixed: true

    lint-api:
      root: "apps/api/"
      glob: "*.ts"
      run: npx eslint --fix {staged_files}
      stage_fixed: true

    lint-shared:
      root: "packages/shared/"
      glob: "*.ts"
      run: npx eslint --fix {staged_files}
      stage_fixed: true

    # Global formatting
    format:
      glob: "*.{ts,tsx,js,jsx,json,md,css,yml}"
      run: npx prettier --write {staged_files}
      stage_fixed: true

    # Type check only affected packages
    typecheck-web:
      root: "apps/web/"
      glob: "*.{ts,tsx}"
      run: npx tsc --noEmit

    typecheck-api:
      root: "apps/api/"
      glob: "*.ts"
      run: npx tsc --noEmit

pre-push:
  commands:
    # Run tests only for affected packages
    test:
      run: npx turbo run test --filter='...[HEAD~1]'
```

### 9.3 Monorepo Performance Optimization

```bash
# .husky/pre-commit — fast processing using Turborepo
#!/bin/sh

# Identify packages from changed files
CHANGED_PACKAGES=$(npx turbo run lint --filter='...[HEAD]' --dry-run=json 2>/dev/null \
  | jq -r '.packages[]' 2>/dev/null || echo "")

if [ -z "$CHANGED_PACKAGES" ]; then
  echo "No packages affected. Skipping lint."
  exit 0
fi

echo "Affected packages: $CHANGED_PACKAGES"

# Process only changed files with lint-staged
npx lint-staged

# Type check only affected packages
npx turbo run typecheck --filter='...[HEAD]' --cache-dir=.turbo
```

---

## 10. Integration with GitHub Actions

### 10.1 Division of Responsibilities Between Hooks and CI

```
┌──────────────────────────────────────────────────────┐
│  Responsibilities of Hooks and CI/CD                 │
│                                                      │
│  Client-side hooks (immediate feedback)              │
│  ┌──────────────────────────────────────────┐        │
│  │ pre-commit:                              │        │
│  │   - lint (ESLint, Stylelint)             │        │
│  │   - format (Prettier)                    │        │
│  │   - ← should complete within seconds    │        │
│  │                                          │        │
│  │ commit-msg:                              │        │
│  │   - Conventional Commits validation      │        │
│  │   - ← completes instantly               │        │
│  │                                          │        │
│  │ pre-push:                                │        │
│  │   - Unit tests (fast ones)              │        │
│  │   - Branch name check                   │        │
│  │   - WIP commit check                    │        │
│  │   - ← should complete within 30s        │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  CI/CD (comprehensive quality checks)                │
│  ┌──────────────────────────────────────────┐        │
│  │ On PR creation:                          │        │
│  │   - Full test suite                      │        │
│  │   - E2E tests                            │        │
│  │   - Security scanning                    │        │
│  │   - Code coverage                        │        │
│  │   - Build verification                   │        │
│  │   - Performance benchmarks               │        │
│  │   - ← minutes are acceptable            │        │
│  │                                          │        │
│  │ On merge:                                │        │
│  │   - Deploy                               │        │
│  │   - Release notes generation             │        │
│  │   - Docker image build                   │        │
│  └──────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

### 10.2 Lint Workflow with GitHub Actions

```yaml
# .github/workflows/lint.yml
name: Lint & Test

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        env:
          HUSKY: 0  # Disable husky in CI environments

      - name: ESLint
        run: npx eslint 'src/**/*.{ts,tsx}' --format=compact

      - name: Prettier check
        run: npx prettier --check 'src/**/*.{ts,tsx,json,css}'

      - name: TypeScript
        run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
        env:
          HUSKY: 0

      - name: Test
        run: npx vitest run --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: coverage/lcov.info

  commitlint:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
        env:
          HUSKY: 0

      - name: Validate PR commits
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
```

---

## 11. Security and Hooks

### 11.1 Secret Detection Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit — secret detection

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Detect secrets using pattern matching
PATTERNS=(
  'PRIVATE KEY'
  'password\s*[:=]\s*["\x27][^"\x27]+'
  'AWS_SECRET_ACCESS_KEY'
  'AKIA[0-9A-Z]{16}'  # AWS Access Key ID
  'api[_-]?key\s*[:=]\s*["\x27][^"\x27]+'
  'secret\s*[:=]\s*["\x27][^"\x27]+'
  'token\s*[:=]\s*["\x27][^"\x27]+'
  'ghp_[a-zA-Z0-9]{36}'  # GitHub Personal Access Token
  'sk-[a-zA-Z0-9]{32,}'  # OpenAI API Key
)

FOUND_SECRETS=false
for file in $STAGED_FILES; do
  # Skip binary files
  if git diff --cached --diff-filter=ACM "$file" | grep -q "Binary files"; then
    continue
  fi

  DIFF=$(git diff --cached -p "$file")
  for pattern in "${PATTERNS[@]}"; do
    MATCHES=$(echo "$DIFF" | grep -n "^+" | grep -iE "$pattern" || true)
    if [ -n "$MATCHES" ]; then
      echo "WARNING: Possible secret detected: $file"
      echo "$MATCHES"
      echo ""
      FOUND_SECRETS=true
    fi
  done
done

if [ "$FOUND_SECRETS" = true ]; then
  echo "============================================"
  echo "  Secrets have been detected!"
  echo "  Move them to .env, or use git-secret/SOPS."
  echo "  If this is a false positive: git commit --no-verify"
  echo "============================================"
  exit 1
fi

exit 0
```

### 11.2 Integration with gitleaks

```bash
# Install gitleaks
$ brew install gitleaks

# Use gitleaks in pre-commit hook
# .husky/pre-commit
npx lint-staged
gitleaks protect --staged --verbose
```

```yaml
# .pre-commit-config.yaml (pre-commit framework)
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```

```toml
# .gitleaks.toml — custom gitleaks configuration
title = "Custom Gitleaks Config"

[allowlist]
  description = "Allow list"
  paths = [
    '''\.env\.example$''',
    '''test/fixtures/''',
    '''\.md$''',
  ]

  description = "Custom API Key"
  id = "custom-api-key"
  regex = '''my-api-key-[a-zA-Z0-9]{32}'''
  tags = ["api", "custom"]

  description = "Slack Webhook"
  id = "slack-webhook"
  regex = '''https://hooks\.slack\.com/services/[A-Z0-9]+/[A-Z0-9]+/[a-zA-Z0-9]+'''
  tags = ["slack"]
```

### 11.3 Security Risks of Hooks

```
┌──────────────────────────────────────────────────────┐
│  Git Hooks Security Considerations                   │
│                                                      │
│  Risk 1: Execution of malicious hooks                │
│  ┌──────────────────────────────────────────┐        │
│  │ Hooks in .git/hooks/ are NOT copied      │        │
│  │ on git clone (safe by design)            │        │
│  │                                          │        │
│  │ However:                                 │        │
│  │ - core.hooksPath pointing to an external │        │
│  │   directory can run arbitrary scripts    │        │
│  │ - husky's "prepare" script runs          │        │
│  │   automatically on npm install           │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  Risk 2: Bypassing hooks                             │
│  ┌──────────────────────────────────────────┐        │
│  │ git commit --no-verify                   │        │
│  │ git push --no-verify                     │        │
│  │ → Can be blocked with server-side hooks, │        │
│  │   but client-side hooks can be bypassed  │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  Countermeasures:                                    │
│  - Run critical checks in CI/CD (cannot be bypassed) │
│  - Configure Branch protection rules                 │
│  - Require reviews via CODEOWNERS                    │
│  - Use server-side hooks as the last line of defense │
│  - Use npm install --ignore-scripts appropriately    │
└──────────────────────────────────────────────────────┘
```

---

## 12. Performance Optimization

### 12.1 Measuring Hook Execution Time

```bash
#!/bin/sh
# .git/hooks/pre-commit — with performance measurement

START=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time() * 1e9))')

# Run lint-staged
npx lint-staged
RESULT=$?

END=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time() * 1e9))')
ELAPSED=$(( (END - START) / 1000000 ))  # Convert to milliseconds

echo "pre-commit hook completed in ${ELAPSED}ms"

# Warn if it took more than 5 seconds
if [ "$ELAPSED" -gt 5000 ]; then
  echo "WARNING: pre-commit hook took ${ELAPSED}ms."
  echo "Consider performance optimization."
fi

exit $RESULT
```

### 12.2 Speed-Up Techniques

```bash
# Technique 1: limit targets with lint-staged
# package.json
{
  "lint-staged": {
    "*.{js,ts}": [
      "eslint --fix --cache",  # leverage cache with --cache
      "prettier --write --cache"  # leverage cache with --cache
    ]
  }
}

# Technique 2: leverage eslint cache
# No additional settings in .eslintrc.json needed, just --cache flag

# Technique 3: run tests only for related files
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --cache",
      "vitest related --run"  # run only tests related to changed files
    ]
  }
}

# Technique 4: move type checking to pre-push
# Do not type check in pre-commit, run it in pre-push
# → faster commits
```

```
┌──────────────────────────────────────────────────────┐
│  Hook Performance Targets                            │
│                                                      │
│  pre-commit:                                         │
│    Target: within 3 seconds                         │
│    ┌──────────────────────────────────────┐          │
│    │ lint-staged (ESLint + Prettier)      │ ~2s     │
│    │ * Speed up with --cache flag         │          │
│    │ * Target only staged files           │          │
│    └──────────────────────────────────────┘          │
│                                                      │
│  commit-msg:                                         │
│    Target: within 1 second                          │
│    ┌──────────────────────────────────────┐          │
│    │ commitlint                           │ <1s     │
│    │ * Regex check only                   │          │
│    └──────────────────────────────────────┘          │
│                                                      │
│  pre-push:                                           │
│    Target: within 30 seconds                        │
│    ┌──────────────────────────────────────┐          │
│    │ Type check (tsc --noEmit)            │ ~5-10s  │
│    │ Unit tests (related tests only)      │ ~10-20s │
│    │ Branch check                         │ <1s     │
│    └──────────────────────────────────────┘          │
│                                                      │
│  CI/CD:                                              │
│    No limit (minutes acceptable)                     │
│    ┌──────────────────────────────────────┐          │
│    │ All tests, E2E, security scan        │ ~5-10m  │
│    └──────────────────────────────────────┘          │
└──────────────────────────────────────────────────────┘
```

### 12.3 Speed-Up via Parallel Execution

```yaml
# lefthook.yml — parallel execution configuration
pre-commit:
  parallel: true  # Run all commands in parallel
  commands:
    eslint:
      glob: "*.{js,jsx,ts,tsx}"
      run: npx eslint --fix --cache {staged_files}
      stage_fixed: true

    prettier:
      glob: "*.{js,jsx,ts,tsx,json,css,md,yml}"
      run: npx prettier --write --cache {staged_files}
      stage_fixed: true

    stylelint:
      glob: "*.{css,scss}"
      run: npx stylelint --fix --cache {staged_files}
      stage_fixed: true

  # scripts section (complex processing with shell scripts)
  scripts:
    "check-secrets.sh":
      runner: bash
```

```javascript
// .lintstagedrc.js — parallel execution (lint-staged v15+)
module.exports = {
  // In lint-staged v15, commands within the same glob run sequentially
  // Commands for different globs run in parallel
  '*.{ts,tsx}': [
    'eslint --fix --cache',
    'prettier --write --cache',
  ],
  // ↓ Runs in parallel with the above
  '*.css': [
    'stylelint --fix --cache',
  ],
  '*.md': [
    'markdownlint --fix',
  ],
};
```

---

## 13. Troubleshooting

### 13.1 Common Issues and Solutions

```bash
# Issue 1: husky hooks are not running
# Cause: core.hooksPath is not configured
$ git config --get core.hooksPath
# If empty, reinstall husky
$ npx husky install
# or
$ rm -rf node_modules && npm install

# Issue 2: No execution permission
$ ls -la .husky/pre-commit
# If -rw-r--r--
$ chmod +x .husky/pre-commit

# Issue 3: Node.js path not found
# Common with GUI Git clients (SourceTree, etc.)
# → Add path to the top of the hook
#!/bin/sh
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
npx lint-staged

# Issue 4: Problems with Windows + WSL
# npx inside WSL not called from Windows Git
# → Use Windows-native npm or
#    use Git for Windows

# Issue 5: husky not working with pnpm/yarn
# For pnpm
$ pnpm exec husky init
# Add to .npmrc:
# enable-pre-post-scripts=true

# For yarn (yarn 2+/berry)
$ yarn dlx husky init
# package.json:
# "packageManager": "yarn@4.0.0"

# Issue 6: Git version is old
# core.hooksPath requires Git 2.9+
$ git --version
# If below 2.9, upgrade is required
```

### 13.2 Debugging Techniques

```bash
# Debug hooks — run manually
$ sh -x .husky/pre-commit
# → -x displays command trace

# Debug lint-staged
$ npx lint-staged --debug 2>&1 | tee lint-staged-debug.log

# Debug husky
$ HUSKY_DEBUG=1 git commit -m "test"

# Debug Git hooks directly
$ GIT_TRACE=1 git commit -m "test"
# → Traces Git internals (including hook calls)

# Save hook output to log
# .husky/pre-commit
#!/bin/sh
exec > /tmp/pre-commit.log 2>&1
set -x
npx lint-staged

# Temporarily disable a specific hook
$ chmod -x .husky/pre-commit
# Re-enable
$ chmod +x .husky/pre-commit
```

### 13.3 Improving Error Messages

```bash
#!/bin/sh
# .husky/pre-commit — user-friendly error display

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${GREEN}Running pre-commit checks...${NC}"

# Run lint-staged
if ! npx lint-staged 2>&1; then
  echo ""
  echo "${RED}========================================${NC}"
  echo "${RED}  pre-commit check FAILED${NC}"
  echo "${RED}========================================${NC}"
  echo ""
  echo "${YELLOW}How to fix:${NC}"
  echo "  1. Review the error messages and fix them"
  echo "  2. After fixing: git add <file> && git commit"
  echo ""
  echo "${YELLOW}In an emergency (not recommended):${NC}"
  echo "  git commit --no-verify"
  echo ""
  exit 1
fi

echo "${GREEN}All checks passed!${NC}"
exit 0
```

---

## 14. Custom merge/diff Drivers

### 14.1 Custom merge Driver

```bash
# .gitattributes — apply custom drivers
*.lock merge=ours
package-lock.json merge=npm-merge-driver
*.pbxproj merge=union
CHANGELOG.md merge=union
```

```bash
# Register custom merge driver
$ git config merge.npm-merge-driver.driver "npx npm-merge-driver merge %A %O %B %P"
$ git config merge.npm-merge-driver.name "npm merge driver for package-lock.json"

# union merge driver (keep both changes)
$ git config merge.union.driver "git merge-file --union %A %O %B"
$ git config merge.union.name "union merge driver"
```

### 14.2 Custom diff Driver

```bash
# .gitattributes — custom diff drivers
*.png diff=exif
*.jpg diff=exif
*.pdf diff=pdf
*.xlsx diff=xlsx

# Image diff driver
$ git config diff.exif.textconv exiftool
# → Compare EXIF metadata of images with git diff

# PDF diff driver
$ git config diff.pdf.textconv "pdftotext -layout"
# → Compare text content of PDFs with git diff

# Excel diff driver
$ git config diff.xlsx.textconv "python3 -c 'import openpyxl,sys; wb=openpyxl.load_workbook(sys.argv[1]); [print(f\"{ws.title}: {[[c.value for c in r] for r in ws.iter_rows()]}\") for ws in wb]'"
```

### 14.3 clean/smudge Filters

```bash
# .gitattributes
*.config filter=config-vars
secrets.yml filter=vault

# Configure clean/smudge filters
# clean: work tree → repository (on commit)
# smudge: repository → work tree (on checkout)

# Replace environment variables with placeholders
$ git config filter.config-vars.clean 'sed "s|${DATABASE_URL}|__DATABASE_URL__|g"'
$ git config filter.config-vars.smudge 'sed "s|__DATABASE_URL__|${DATABASE_URL}|g"'

# Encrypt with git-crypt
$ git config filter.vault.clean 'git-crypt clean'
$ git config filter.vault.smudge 'git-crypt smudge'
$ git config diff.vault.textconv 'git-crypt diff'
```

```
┌──────────────────────────────────────────────────────┐
│  clean/smudge Filter Operation                       │
│                                                      │
│  git add (clean)                                     │
│  ┌────────────┐     ┌────────────┐     ┌──────────┐  │
│  │ Work tree  │ --> │  clean     │ --> │  Index   │  │
│  │ plaintext  │     │  filter    │     │ encrypted│  │
│  └────────────┘     └────────────┘     └──────────┘  │
│                                                      │
│  git checkout (smudge)                               │
│  ┌──────────┐     ┌────────────┐     ┌────────────┐  │
│  │Repository│ --> │  smudge    │ --> │ Work tree  │  │
│  │encrypted │     │  filter    │     │ plaintext  │  │
│  └──────────┘     └────────────┘     └────────────┘  │
│                                                      │
│  Use cases:                                          │
│  - Encrypt/decrypt secrets                           │
│  - Placeholder substitution for environment variables│
│  - File compression/decompression                    │
│  - Automatic code formatting                         │
└──────────────────────────────────────────────────────┘
```

---

## 15. Anti-patterns

### Anti-pattern 1: Running lint on all files in pre-commit hook

```bash
# BAD: target all files for lint
#!/bin/sh
npx eslint src/
# → Commit is blocked even by errors in files you didn't change
# → Execution time is too long for large projects

# GOOD: target only staged files (lint-staged)
#!/bin/sh
npx lint-staged
# → Only processes changed files quickly
```

**Reason**: Targeting all files causes commits to be blocked by errors in files you didn't change. lint-staged processes only staged files, preserving developer experience.

### Anti-pattern 2: Routinely bypassing hooks

```bash
# BAD: using --no-verify on a daily basis
$ git commit --no-verify -m "wip: commit for now"
$ git push --no-verify
# → Lint errors and test failures get mixed into the remote

# GOOD: if hooks are bothersome, improve the hooks themselves
# - Reduce execution time (limit targets with lint-staged)
# - Minimize tests (run only related tests)
# - Eliminate false positives (review rules)
```

**Reason**: Using `--no-verify` negates the purpose of hooks. If hooks are frequently bypassed, there is a problem with the hook design.

### Anti-pattern 3: Placing heavy tests in pre-commit

```bash
# BAD: run all tests in pre-commit
#!/bin/sh
npm test  # Full test suite → takes minutes
npx tsc --noEmit  # Type check → tens of seconds for entire project

# GOOD: place checks in stages
# pre-commit: lint + format (seconds)
# pre-push: related tests + type check (within 30s)
# CI: all tests + E2E + security (no limit)
```

**Reason**: If developers have to wait minutes on every commit, they start bypassing hooks. Hooks should provide quick feedback; heavy processing should be delegated to CI/CD.

### Anti-pattern 4: Requesting interactive input within hooks

```bash
# BAD: confirmation prompt inside hook
#!/bin/sh
read -p "Are you sure you want to commit? (y/n): " answer
if [ "$answer" != "y" ]; then
  exit 1
fi
# → Does not work in GUI clients or CI environments
# → Hangs in pipeline processing

# GOOD: checks are automatic, just display the result
#!/bin/sh
ISSUES=$(npx eslint --format compact src/)
if [ -n "$ISSUES" ]; then
  echo "$ISSUES"
  exit 1
fi
```

**Reason**: Hooks are often run in non-interactive environments. Depending on interactive input causes problems in GUI clients and CI environments.

### Anti-pattern 5: Not configuring server-side hooks

```bash
# BAD: rely only on client-side hooks
# → Can be bypassed with --no-verify
# → Unauthorized pushes from members who haven't installed hooks

# GOOD: use server-side hooks (or CI) as the last line of defense
# GitHub: Branch protection rules
#   - Require status checks to pass before merging
#   - Require pull request reviews
#   - Require linear history
# GitLab: Push rules
#   - Commit message pattern
#   - Branch name pattern
#   - File size limit
```

**Reason**: Client-side hooks are intended to improve developer experience and have no enforcement power. The final defense for quality should be implemented with server-side hooks or CI/CD.

### Anti-pattern 6: Unfriendly hook error messages

```bash
# BAD: cause of error is unclear
#!/bin/sh
npx eslint $FILES > /dev/null 2>&1
exit $?
# → Output completely suppressed, no way to know what is wrong

# GOOD: clearly show what the problem is and how to fix it
#!/bin/sh
echo "Running ESLint..."
RESULT=$(npx eslint --format stylish $FILES 2>&1)
if [ $? -ne 0 ]; then
  echo "$RESULT"
  echo ""
  echo "How to fix:"
  echo "  npx eslint --fix <file>  # auto fix"
  echo "  npx eslint <file>        # check errors"
  exit 1
fi
```

---

## 16. FAQ

### Q1. What to do when husky hooks are not running?

**A1.** Check in the following order.

```bash
# 1. Is husky correctly installed?
$ cat .git/config | grep hooksPath
# → should be core.hooksPath = .husky

# 2. Does the hook file have execution permission?
$ ls -la .husky/pre-commit
# → should be -rwxr-xr-x
$ chmod +x .husky/pre-commit

# 3. Is the prepare script configured?
$ cat package.json | grep prepare
# → should be "prepare": "husky"

# 4. Reinstall node_modules
$ rm -rf node_modules && npm install

# 5. Check Git version (2.9+ required)
$ git --version

# 6. Manually set core.hooksPath
$ git config core.hooksPath .husky
```

### Q2. How to disable husky hooks in CI/CD environments?

**A2.** In husky v9, you can disable it with the `HUSKY=0` environment variable.

```bash
# In the CI/CD pipeline
$ HUSKY=0 npm install
# or
$ npm install --ignore-scripts
```

```yaml
# GitHub Actions example
- name: Install dependencies
  run: npm ci
  env:
    HUSKY: 0
```

### Q3. How are server-side hooks managed?

**A3.** Server-side hooks (pre-receive, update, post-receive) are generally managed through the features of the Git hosting service.

- **GitHub**: Branch protection rules, GitHub Actions
- **GitLab**: Server hooks (admin only), CI/CD pipelines, Push rules
- **Bitbucket**: Repository hooks, Pipelines

For self-hosted Git servers, place them directly in `.git/hooks/` of the bare repository.

```bash
# Placing hooks on a self-hosted Git server
$ ssh git@server
$ cd /opt/git/myproject.git/hooks/
$ cat > pre-receive << 'EOF'
#!/bin/bash
# Policy check
while read old new ref; do
  # ... check logic
done
EOF
$ chmod +x pre-receive
```

### Q4. How to share hooks across the entire team?

**A4.** The following methods are available.

```bash
# Method 1: husky (recommended — Node.js projects)
# Hooks are automatically configured with npm install
$ npm install --save-dev husky
$ npx husky init

# Method 2: core.hooksPath (language-agnostic)
# Create a hooks directory inside the project
$ mkdir .githooks
$ cp .git/hooks/pre-commit .githooks/
$ git config core.hooksPath .githooks
# → Team members activate with the following command
$ git config core.hooksPath .githooks

# Method 3: Setup with Makefile
# Makefile
setup:
	git config core.hooksPath .githooks
	chmod +x .githooks/*

# Method 4: setup.sh script
#!/bin/sh
git config core.hooksPath .githooks
chmod +x .githooks/*
echo "Git hooks configured."
```

### Q5. How to exclude specific files from hook targets?

**A5.** Specify exclusion patterns in the lint-staged configuration.

```json
{
  "lint-staged": {
    "!(generated|vendor)/**/*.{js,ts}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

```javascript
// .lintstagedrc.js — more flexible exclusions
module.exports = {
  '*.{js,ts}': (filenames) => {
    const filtered = filenames.filter(f =>
      !f.includes('generated/') &&
      !f.includes('vendor/') &&
      !f.includes('.min.') &&
      !f.endsWith('.d.ts')
    );
    if (filtered.length === 0) return [];
    return [
      `eslint --fix ${filtered.join(' ')}`,
      `prettier --write ${filtered.join(' ')}`,
    ];
  },
};
```

### Q6. What to do when hooks don't work with Git GUI clients (SourceTree, VS Code, etc.)?

**A6.** PATH issues are the most common cause.

```bash
# GUI clients may not load shell initialization files
# → Paths to nvm, rbenv, etc. may not be available

# Solution 1: Set PATH at the top of the hook
#!/bin/sh
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/v20.0.0/bin:$PATH"
npx lint-staged

# Solution 2: Set PATH in ~/.huskyrc
# ~/.huskyrc (for husky v4)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Solution 3: VS Code settings
# settings.json
{
  "git.path": "/usr/local/bin/git",
  "terminal.integrated.env.osx": {
    "PATH": "/usr/local/bin:${env:PATH}"
  }
}
```

### Q7. What to do when the pre-commit hook doesn't work correctly with partial staging (git add -p)?

**A7.** lint-staged v13+ automatically handles partial staging correctly.

```bash
# lint-staged handles partial staging with the following steps:
# 1. Stash unstaged changes
# 2. Run lint only on staged content
# 3. Re-stage changes made by --fix
# 4. Restore stash

# For manual hooks, explicitly use stash:
#!/bin/sh
# Hide unstaged changes
git stash -q --keep-index --include-untracked

# Run lint
npx eslint $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts)$')
RESULT=$?

# Restore hidden changes
git stash pop -q

exit $RESULT
```

### Q8. Can the execution order of hooks be customized?

**A8.** Within the same type of hook, they run in the order written in the shell script. Use a dispatcher if you want multiple hook files.

```bash
#!/bin/sh
# .husky/pre-commit — dispatcher pattern

# Run hooks sequentially (abort if any fails)
HOOKS_DIR=".husky/pre-commit.d"

if [ -d "$HOOKS_DIR" ]; then
  for hook in "$HOOKS_DIR"/*; do
    if [ -x "$hook" ]; then
      echo "Running $(basename "$hook")..."
      "$hook"
      RESULT=$?
      if [ $RESULT -ne 0 ]; then
        echo "$(basename "$hook") failed with exit code $RESULT"
        exit $RESULT
      fi
    fi
  done
fi
```

```
# Directory structure
.husky/
├── pre-commit          ← dispatcher
├── pre-commit.d/
│   ├── 01-lint-staged  ← lint
│   ├── 02-typecheck    ← type check
│   └── 03-secrets      ← secret detection
├── commit-msg
└── pre-push
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## Summary

| Concept          | Key Points                                                              |
|------------------|-------------------------------------------------------------------------|
| Git Hooks        | Scripts that run automatically on specific Git operations               |
| pre-commit       | Runs before commit; ideal for automating lint/format                    |
| commit-msg       | Validates the format of commit messages                                 |
| pre-push         | Runs tests before push; protects main                                   |
| husky            | Git Hooks management tool; auto-configured with npm install             |
| lint-staged      | Runs lint/format targeting only staged files                            |
| commitlint       | Validates messages in Conventional Commits format                       |
| lefthook         | Fast hook manager written in Go; parallel execution is built-in         |
| pre-commit fw    | Python-based hook management framework; supports multiple languages     |
| server-side      | Enforce policies with pre-receive/update/post-receive                   |
| core.hooksPath   | Customize the location of the hooks directory                           |
| clean/smudge     | File transformation filters (encryption, placeholders, etc.)            |
| gitleaks         | Secret detection tool; can be integrated with hooks                     |

---

## Guides to Read Next

- [Interactive Rebase](./00-interactive-rebase.md) — Commit organization and hook integration
- [bisect/blame](./02-bisect-blame.md) — Tracking bugs that hooks couldn't detect
- [Jujutsu Workflow](../02-jujutsu/01-jujutsu-workflow.md) — Hook equivalents in Jujutsu

---

## References

1. **Pro Git Book** — "Customizing Git - Git Hooks" https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks
2. **husky official documentation** — https://typicode.github.io/husky/
3. **lint-staged official documentation** — https://github.com/lint-staged/lint-staged
4. **commitlint official documentation** — https://commitlint.js.org/
5. **lefthook official documentation** — https://github.com/evilmartians/lefthook
6. **pre-commit framework** — https://pre-commit.com/
7. **gitleaks** — https://github.com/gitleaks/gitleaks
8. **Git official documentation: githooks** — https://git-scm.com/docs/githooks
