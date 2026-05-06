# Project Standards

> Learn standardization techniques for maintaining consistent coding conventions and development environments across the entire team, leveraging common configuration files such as EditorConfig, .npmrc, and .nvmrc.

## What You Will Learn

1. **Cross-editor formatting unification with EditorConfig** -- Understand configurations that standardize tabs/spaces, line endings, and character encoding independently of the editor
2. **Runtime unification with .npmrc / .nvmrc / .node-version** -- Learn how to align Node.js versions and package manager behavior across the team
3. **Integrated configuration of Linter / Formatter / Git Hooks** -- Build a quality gate combining ESLint, Prettier, husky, and lint-staged
4. **Applying standards to multi-language projects** -- Learn unified configuration techniques for projects mixing multiple languages such as Python, Go, and Rust
5. **Dual defense through CI/CD integration** -- Build a system that automatically enforces quality standards by linking local hooks with CI pipelines


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Overview of Project Standardization

```
+------------------------------------------------------------------+
|             Project Standardization Layers                        |
+------------------------------------------------------------------+
|                                                                  |
|  [Layer 1] Editor Settings                                       |
|    .editorconfig        -- Tab width, line endings, encoding     |
|    .vscode/settings.json -- VS Code-specific settings            |
|    .idea/               -- JetBrains-specific settings           |
|                                                                  |
|  [Layer 2] Runtime Settings                                      |
|    .nvmrc / .node-version -- Pin Node.js version                 |
|    .npmrc               -- Package manager settings              |
|    .tool-versions       -- asdf general (Ruby, Python, etc.)     |
|    .python-version      -- Pin Python version                    |
|    rust-toolchain.toml  -- Pin Rust toolchain                    |
|                                                                  |
|  [Layer 3] Code Quality                                          |
|    eslint.config.js     -- Lint rules                            |
|    .prettierrc          -- Format rules                          |
|    biome.json           -- Biome integrated settings             |
|    tsconfig.json        -- TypeScript settings                   |
|    pyproject.toml       -- Python Lint/Format (ruff, black)      |
|    .golangci.yml        -- Go Lint settings                      |
|                                                                  |
|  [Layer 4] Git Workflow                                          |
|    .husky/              -- Git hooks                             |
|    .lintstagedrc        -- Auto-fix staged files                 |
|    .commitlintrc        -- Commit message conventions            |
|    .gitattributes       -- Line endings & binary detection       |
|    .gitignore           -- Definition of untracked files         |
|                                                                  |
|  [Layer 5] CI/CD Pipeline                                        |
|    .github/workflows/   -- GitHub Actions workflows              |
|    .gitlab-ci.yml       -- GitLab CI settings                    |
|    Dockerfile           -- Container build settings              |
|    docker-compose.yml   -- Local service configuration           |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.1 Benefits and Introduction Cost of Standardization

| Aspect | Without Standardization | With Standardization |
|--------|------------------------|----------------------|
| New member environment setup | 1-2 days | 5-15 minutes |
| Style comments in code review | Occurs every time | Unnecessary with auto-fix |
| Unexpected CI errors | Frequent | Prevented in advance |
| Version mismatch bugs | Hard to reproduce | Detected via engines |
| Commit message quality | Inconsistent | Follows Conventional Commits |
| Introduction cost | -- | 2-4 hours initially |
| Maintenance cost | -- | ~30 minutes per month |

### 1.2 Phased Introduction Strategy

When introducing standardization into an existing project, it is safer to proceed in stages rather than applying everything at once.

```
+------------------------------------------------------------------+
|              Phased Standardization Roadmap                       |
+------------------------------------------------------------------+
|                                                                  |
|  Phase 1 (Day 1): Foundation                                     |
|    ✓ .editorconfig                                               |
|    ✓ .gitattributes                                              |
|    ✓ .gitignore                                                  |
|    ✓ .nvmrc / .node-version                                     |
|                                                                  |
|  Phase 2 (Week 1): Code Quality                                  |
|    ✓ ESLint / Biome settings                                     |
|    ✓ Prettier / Formatter settings                               |
|    ✓ .npmrc settings                                             |
|    ✓ VS Code shared settings                                     |
|                                                                  |
|  Phase 3 (Week 2): Git Workflow                                  |
|    ✓ husky + lint-staged                                         |
|    ✓ commitlint                                                  |
|    ✓ PR template                                                 |
|                                                                  |
|  Phase 4 (Week 3): CI/CD Integration                             |
|    ✓ Quality checks via GitHub Actions / GitLab CI               |
|    ✓ Automated testing                                           |
|    ✓ Automated deployment                                        |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 2. EditorConfig

### 2.1 Basic Configuration

```ini
# .editorconfig
# https://editorconfig.org

root = true

# Common to all files
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

# Python
[*.py]
indent_size = 4

# Go
[*.go]
indent_style = tab
indent_size = 4

# Rust
[*.rs]
indent_size = 4

# Java / Kotlin
[*.{java,kt,kts}]
indent_size = 4

# C# / .NET
[*.{cs,csx}]
indent_size = 4

# Makefile (tabs required)
[Makefile]
indent_style = tab

# Markdown (trailing spaces are meaningful)
[*.md]
trim_trailing_whitespace = false

# YAML
[*.{yml,yaml}]
indent_size = 2

# JSON
[*.json]
indent_size = 2

# TOML
[*.toml]
indent_size = 2

# Shell scripts
[*.sh]
end_of_line = lf
indent_size = 2

# Docker
[Dockerfile*]
indent_size = 4

# Terraform / HCL
[*.{tf,tfvars,hcl}]
indent_size = 2

# XML / SVG
[*.{xml,svg}]
indent_size = 2
```

### 2.2 EditorConfig Support Status

| Editor | Native Support | Plugin |
|--------|---------------|--------|
| VS Code | Plugin required | EditorConfig for VS Code |
| JetBrains (IntelliJ, etc.) | Built-in | Not required |
| Vim / Neovim | Plugin required | editorconfig-vim |
| Sublime Text | Plugin required | EditorConfig |
| Emacs | Plugin required | editorconfig-emacs |
| GitHub Web | Built-in | Not required |
| Zed | Built-in | Not required |
| Cursor | Plugin required | EditorConfig for VS Code |

### 2.3 Advanced EditorConfig Patterns

```ini
# .editorconfig (extended for large-scale projects)

root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2
max_line_length = 120

# Protocol Buffers
[*.proto]
indent_size = 2

# GraphQL
[*.{graphql,gql}]
indent_size = 2

# Environment variable files
[.env*]
insert_final_newline = true

# Batch files / PowerShell
[*.{bat,cmd}]
end_of_line = crlf
[*.ps1]
end_of_line = crlf
charset = utf-8-bom

# License files
[LICENSE*]
insert_final_newline = true
trim_trailing_whitespace = true

# Gemfile / Rakefile (Ruby)
[{Gemfile,Rakefile,*.rb}]
indent_size = 2

# PHP
[*.php]
indent_size = 4

# Solution files
[*.sln]
end_of_line = crlf

# csproj (Microsoft XML format)
[*.{csproj,vbproj,vcxproj,proj}]
indent_size = 2
end_of_line = crlf
```

### 2.4 Verifying EditorConfig

Having a script to verify that EditorConfig settings are being applied correctly makes troubleshooting easier.

```bash
#!/bin/bash
# scripts/check-editorconfig.sh
# Verify EditorConfig application status

set -euo pipefail

ERRORS=0

# UTF-8 BOM check
echo "=== UTF-8 BOM Check ==="
BOM_FILES=$(find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.json" \) \
  -exec grep -Pl '\xEF\xBB\xBF' {} \; 2>/dev/null || true)
if [ -n "$BOM_FILES" ]; then
  echo "FAIL: Files with BOM found:"
  echo "$BOM_FILES"
  ((ERRORS++))
else
  echo "PASS: No files with BOM"
fi

# Final newline check
echo ""
echo "=== Final Newline Check ==="
MISSING_NEWLINE=$(find . -type f \( -name "*.ts" -o -name "*.js" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sh -c '[ -s "$1" ] && [ "$(tail -c1 "$1" | xxd -p)" != "0a" ] && echo "$1"' _ {} \; 2>/dev/null || true)
if [ -n "$MISSING_NEWLINE" ]; then
  echo "WARN: Files missing final newline:"
  echo "$MISSING_NEWLINE"
else
  echo "PASS: All files have final newline"
fi

# CRLF check (in environments where LF is correct)
echo ""
echo "=== Line Ending Check ==="
CRLF_FILES=$(find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.json" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec grep -Prl '\r\n' {} \; 2>/dev/null || true)
if [ -n "$CRLF_FILES" ]; then
  echo "WARN: Files with CRLF detected:"
  echo "$CRLF_FILES"
else
  echo "PASS: No CRLF files"
fi

echo ""
echo "=== Result: ${ERRORS} errors ==="
exit $ERRORS
```

---

## 3. Node.js Version Management

### 3.1 .nvmrc

```
# .nvmrc
20.11.0
```

### 3.2 .node-version (fnm / nodenv / volta compatible)

```
# .node-version
20.11.0
```

### 3.3 engines Field in package.json

```jsonc
// package.json
{
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  },
  "packageManager": "pnpm@9.0.0",
  "volta": {
    "node": "20.11.0",
    "pnpm": "9.0.0"
  }
}
```

### 3.4 Version Manager Comparison

```
+------------------------------------------------------------------+
|          Node.js Version Manager Comparison                       |
+------------------------------------------------------------------+
| Tool    | Config File         | Auto Switch | Speed  | Languages |
|---------|---------------------|-------------|--------|-----------|
| nvm     | .nvmrc              | Hook        | Slow   | Node.js only |
| fnm     | .node-version       | Auto        | Fast   | Node.js only |
| volta   | package.json        | Auto        | Fast   | Node.js only |
| asdf    | .tool-versions      | Auto        | Medium | Multi-language |
| mise    | .tool-versions      | Auto        | Fast   | Multi-language |
| nodenv  | .node-version       | Auto        | Fast   | Node.js only |
+------------------------------------------------------------------+
```

### 3.5 fnm Detailed Configuration

fnm (Fast Node Manager) is a fast Node.js version manager written in Rust, recommended as an alternative to nvm.

```bash
# Install fnm
# macOS
brew install fnm

# Linux / macOS (curl)
curl -fsSL https://fnm.vercel.app/install | bash

# Windows (winget)
winget install Schniz.fnm

# Shell configuration (~/.zshrc or ~/.bashrc)
eval "$(fnm env --use-on-cd)"
# --use-on-cd: automatically reads .nvmrc / .node-version when changing directories

# Basic operations
fnm install 20.11.0        # Install
fnm use 20.11.0             # Switch
fnm default 20.11.0         # Set as default
fnm list                    # List installed versions
fnm list-remote             # List available versions
fnm current                 # Current version

# Install & use version from .nvmrc
fnm install
fnm use
```

### 3.6 Volta Detailed Configuration

Volta takes a unique approach to managing versions within package.json.

```bash
# Install Volta
curl https://get.volta.sh | bash

# Install & pin Node.js
volta install node@20.11.0
volta pin node@20.11.0      # Records in package.json

# Pin package manager
volta install pnpm@9.0.0
volta pin pnpm@9.0.0

# Install global tools
volta install typescript
volta install @biomejs/biome

# Automatically appended to package.json:
# {
#   "volta": {
#     "node": "20.11.0",
#     "pnpm": "9.0.0"
#   }
# }
```

### 3.7 Multi-language Version Management with mise (formerly rtx)

```toml
# .mise.toml (also supports legacy .tool-versions format)
[tools]
node = "20.11.0"
python = "3.12.1"
ruby = "3.3.0"
go = "1.22.0"
rust = "1.76.0"
java = "temurin-21.0.2+13.0.LTS"
terraform = "1.7.0"

[env]
NODE_ENV = "development"

[tasks.dev]
run = "npm run dev"
description = "Start development server"

[tasks.test]
run = "npm test"
description = "Run tests"
```

```bash
# Install mise
brew install mise

# Shell configuration
eval "$(mise activate zsh)"

# Install versions
mise install           # Install all tools listed in .mise.toml
mise use node@20.11.0  # Record version in .mise.toml

# Run tasks
mise run dev
mise run test
```

---

## 4. .npmrc Configuration

### 4.1 Project .npmrc

```ini
# .npmrc

# Strictly check engine versions
engine-strict=true

# Always generate package-lock.json
package-lock=true

# Install with exact versions (no ^ or ~)
save-exact=true

# npm audit level setting
audit-level=moderate

# Private registry (if using internal packages)
# @mycompany:registry=https://npm.mycompany.com/
# //npm.mycompany.com/:_authToken=${NPM_TOKEN}

# Auto-resolve peer dependencies
legacy-peer-deps=false
auto-install-peers=true

# Log level
loglevel=warn

# Block npm install when Node.js version doesn't match
# (used together with engines + engine-strict=true)
```

### 4.2 For pnpm (.npmrc + pnpm-workspace.yaml)

```ini
# .npmrc (for pnpm)
shamefully-hoist=false
strict-peer-dependencies=true
auto-install-peers=true
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'
```

### 4.3 yarn Configuration (.yarnrc.yml)

```yaml
# .yarnrc.yml (Yarn Berry / Yarn 4)
nodeLinker: node-modules  # When not using PnP
enableGlobalCache: false
checksumBehavior: update

# Private registry
npmScopes:
  mycompany:
    npmRegistryServer: "https://npm.mycompany.com/"
    npmAuthToken: "${NPM_TOKEN}"

# Plugins
plugins:
  - path: .yarn/plugins/@yarnpkg/plugin-interactive-tools.cjs
    spec: "@yarnpkg/plugin-interactive-tools"
  - path: .yarn/plugins/@yarnpkg/plugin-workspace-tools.cjs
    spec: "@yarnpkg/plugin-workspace-tools"
```

### 4.4 .npmrc Security Settings

```ini
# .npmrc (security hardening)

# Restrict postinstall script execution
ignore-scripts=false

# Verify package provenance (origin)
# Available in npm v9.5+
audit=true
audit-level=moderate

# Verify package signatures (npm v9.8+)
# sign-git-tag=true

# Enforce 2FA (when publishing with npm publish)
# auth-type=web
```

### 4.5 Package Manager Comparison

```
+------------------------------------------------------------------+
|            Package Manager Comparison                             |
+------------------------------------------------------------------+
| Item            | npm     | pnpm     | yarn     | bun       |
|-----------------|---------|----------|----------|-----------|
| Disk usage      | High    | Low      | Medium   | Low       |
| Install speed   | Medium  | Fast     | Fast     | Fastest   |
| Lock file       | package-lock.json | pnpm-lock.yaml | yarn.lock | bun.lockb |
| Monorepo support| workspaces | workspaces | workspaces | workspaces |
| Strict deps     | Normal  | Strict   | Normal   | Normal    |
| Phantom Deps    | Yes     | No       | Yes      | Yes       |
| No Node.js      | No      | No       | No       | Yes (Bun) |
+------------------------------------------------------------------+
```

---

## 5. .gitattributes

### 5.1 Basic Configuration

```gitattributes
# .gitattributes

# Normalize line endings
* text=auto eol=lf

# Explicit text files
*.js    text eol=lf
*.ts    text eol=lf
*.jsx   text eol=lf
*.tsx   text eol=lf
*.json  text eol=lf
*.yml   text eol=lf
*.yaml  text eol=lf
*.md    text eol=lf
*.css   text eol=lf
*.html  text eol=lf
*.sh    text eol=lf
*.py    text eol=lf
*.go    text eol=lf
*.rs    text eol=lf
*.java  text eol=lf
*.kt    text eol=lf
*.rb    text eol=lf
*.php   text eol=lf
*.sql   text eol=lf
*.graphql text eol=lf
*.proto text eol=lf
*.toml  text eol=lf
*.ini   text eol=lf
*.cfg   text eol=lf
*.env   text eol=lf

# Windows batch files
*.bat   text eol=crlf
*.cmd   text eol=crlf
*.ps1   text eol=crlf

# Binary files
*.png   binary
*.jpg   binary
*.jpeg  binary
*.gif   binary
*.ico   binary
*.webp  binary
*.avif  binary
*.woff  binary
*.woff2 binary
*.ttf   binary
*.eot   binary
*.pdf   binary
*.zip   binary
*.tar.gz binary
*.mp4   binary
*.mp3   binary
*.wav   binary

# Lock files (prevent conflicts during merge)
package-lock.json merge=ours linguist-generated
pnpm-lock.yaml   merge=ours linguist-generated
yarn.lock        merge=ours linguist-generated

# Auto-generated files (hide from diff)
*.min.js linguist-generated
*.min.css linguist-generated
dist/** linguist-generated
```

### 5.2 Advanced .gitattributes Configuration

```gitattributes
# Git LFS (Large File Storage) settings
# Manage large binary files with LFS
*.psd filter=lfs diff=lfs merge=lfs -text
*.sketch filter=lfs diff=lfs merge=lfs -text
*.fig filter=lfs diff=lfs merge=lfs -text
*.ai filter=lfs diff=lfs merge=lfs -text
*.mov filter=lfs diff=lfs merge=lfs -text

# Customize diffs
# Make JSON diffs more readable
*.json diff=json

# Show CSS / SCSS diffs by function
*.css diff=css
*.scss diff=css

# Show Markdown diffs by heading
*.md diff=markdown

# Show Go diffs by function
*.go diff=golang

# Show Ruby diffs by method
*.rb diff=ruby
```

### 5.3 Standard .gitignore Template

```gitignore
# .gitignore

# === Dependencies ===
node_modules/
.pnpm-store/
vendor/
__pycache__/
*.pyc
.venv/
venv/

# === Build artifacts ===
dist/
build/
.next/
.nuxt/
.output/
out/
*.tsbuildinfo

# === Environment variables ===
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# === Editors ===
.idea/
*.swp
*.swo
*~
.project
.classpath
.settings/

# === OS ===
.DS_Store
Thumbs.db
Desktop.ini

# === Tests / Coverage ===
coverage/
.nyc_output/
*.lcov
test-results/
playwright-report/

# === Logs ===
*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# === Docker ===
docker-compose.override.yml

# === Terraform ===
*.tfstate
*.tfstate.backup
.terraform/

# === Other ===
.cache/
.temp/
.tmp/
*.bak
*.orig
```

---

## 6. VS Code Shared Settings

### 6.1 .vscode/settings.json

```jsonc
// .vscode/settings.json
{
  // Basic editor settings
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  // TypeScript
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,

  // File exclusions
  "files.exclude": {
    "**/.git": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  },

  // Search exclusions
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/*.min.js": true,
    "**/pnpm-lock.yaml": true
  },

  // Auto save
  "files.autoSave": "onFocusChange",

  // Auto-trim trailing whitespace
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "files.trimFinalNewlines": true,

  // Language-specific settings
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.wordWrap": "on",
    "files.trimTrailingWhitespace": false
  },
  "[yaml]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[css]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[html]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },

  // Tailwind CSS IntelliSense
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "\"'`.*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],

  // ESLint
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],

  // Testing
  "testing.automaticallyOpenPeekView": "never"
}
```

### 6.2 .vscode/extensions.json

```jsonc
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "editorconfig.editorconfig",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "github.copilot",
    "github.copilot-chat",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens",
    "eamodio.gitlens",
    "biomejs.biome"
  ],
  "unwantedRecommendations": [
    "hookyqr.beautify",
    "ms-vscode.vscode-typescript-tslint-plugin"
  ]
}
```

### 6.3 .vscode/launch.json (Debug Configuration)

```jsonc
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: Debug Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "name": "Vitest: Current File",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run", "${relativeFile}"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Vitest: Watch Mode",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["--watch"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### 6.4 .vscode/tasks.json (Task Configuration)

```jsonc
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "shell",
      "command": "make dev",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "test",
      "type": "shell",
      "command": "make test",
      "group": "test"
    },
    {
      "label": "lint",
      "type": "shell",
      "command": "make lint",
      "group": "test",
      "problemMatcher": ["$eslint-stylish"]
    },
    {
      "label": "typecheck",
      "type": "shell",
      "command": "make typecheck",
      "group": "build",
      "problemMatcher": ["$tsc"]
    }
  ]
}
```

---

## 7. Git Hooks (husky + lint-staged)

### 7.1 Setup

```bash
# Install husky and lint-staged
pnpm add -D husky lint-staged

# Initialize husky
pnpm exec husky init

# Create pre-commit hook
echo "npx lint-staged" > .husky/pre-commit
```

```jsonc
// package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,yml,yaml,md}": [
      "prettier --write"
    ],
    "*.css": [
      "prettier --write"
    ],
    "*.py": [
      "ruff check --fix",
      "ruff format"
    ],
    "*.go": [
      "gofmt -w",
      "go vet"
    ]
  }
}
```

### 7.2 husky Hooks

```bash
#!/bin/sh
# .husky/pre-commit
npx lint-staged
```

```bash
#!/bin/sh
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

```bash
#!/bin/sh
# .husky/pre-push
# Run tests and type checking before push
npm run typecheck
npm run test -- --run
```

### 7.3 Commitlint Configuration

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Format changes
        'refactor', // Refactoring
        'perf',     // Performance improvement
        'test',     // Tests
        'chore',    // Build & tools
        'ci',       // CI configuration
        'revert',   // Revert
        'build',    // Build system changes
        'deps',     // Dependency updates
      ],
    ],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [1, 'always', 100],
    'header-max-length': [2, 'always', 100],
    'scope-case': [2, 'always', 'lower-case'],
  },
};
```

### 7.4 Conventional Commits Operation Guide

```
+------------------------------------------------------------------+
|            Conventional Commits Format                            |
+------------------------------------------------------------------+
|                                                                  |
|  <type>(<scope>): <description>                                  |
|                                                                  |
|  [body]                                                          |
|                                                                  |
|  [footer]                                                        |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  Examples:                                                       |
|  feat(auth): add social login feature                            |
|  fix(api): fix N+1 problem in user search                        |
|  docs(readme): update setup instructions                         |
|  refactor(db): migrate query builder to Prisma                   |
|  perf(search): optimize full-text search index                   |
|  test(user): add E2E test for user registration                  |
|  ci(deploy): configure automated staging deployment              |
|  chore(deps): update TypeScript to 5.4                           |
|                                                                  |
|  BREAKING CHANGE:                                                |
|  feat(api)!: change response format to JSONAPI                   |
|  -> Use "!" or BREAKING CHANGE in footer to indicate             |
|     breaking changes                                             |
|                                                                  |
+------------------------------------------------------------------+
```

### 7.5 lefthook (husky alternative)

lefthook is a fast Git hook manager written in Go, gaining attention as an alternative to husky.

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx,js,jsx}"
      run: npx eslint --fix {staged_files} && git add {staged_files}
    format:
      glob: "*.{ts,tsx,js,jsx,json,yml,yaml,md,css}"
      run: npx prettier --write {staged_files} && git add {staged_files}
    typecheck:
      run: npx tsc --noEmit

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-push:
  commands:
    test:
      run: npx vitest run
```

---

## 8. ESLint (Flat Config) Configuration

### 8.1 eslint.config.js (ESLint v9+)

```javascript
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'build/**',
      '.next/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
    ],
  },

  // Base rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React rules
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // Import rules
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },

  // Custom rules
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
```

### 8.2 Prettier Configuration

```jsonc
// .prettierrc
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"],
  "overrides": [
    {
      "files": "*.md",
      "options": {
        "printWidth": 80,
        "proseWrap": "always"
      }
    }
  ]
}
```

```
# .prettierignore
dist/
build/
.next/
node_modules/
coverage/
pnpm-lock.yaml
package-lock.json
yarn.lock
*.min.js
*.min.css
```

### 8.3 Biome Configuration (ESLint + Prettier alternative)

```jsonc
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noBannedTypes": "error",
        "noExtraBooleanCast": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noConsoleLog": "warn"
      },
      "style": {
        "useConst": "error",
        "useTemplate": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  },
  "json": {
    "formatter": {
      "trailingCommas": "none"
    }
  },
  "files": {
    "ignore": [
      "dist/**",
      "build/**",
      ".next/**",
      "node_modules/**",
      "coverage/**"
    ]
  }
}
```

---

## 9. TypeScript Configuration

### 9.1 tsconfig.json (Common Base)

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    // Language settings
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",

    // Strict mode
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,

    // Output settings
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",

    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"]
    },

    // Imports
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    // Additional type check settings
    "skipLibCheck": true,
    "incremental": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

## 10. Project Standards File List

```
+------------------------------------------------------------------+
|           Files to Place in the Project Root                      |
+------------------------------------------------------------------+
| File                      | Purpose                  | Required  |
|--------------------------|--------------------------|-----------|
| .editorconfig            | Cross-editor formatting  | Required  |
| .gitattributes           | Git line endings/binary  | Required  |
| .gitignore               | Git exclusion rules      | Required  |
| .nvmrc / .node-version   | Pin Node.js version      | Recommended |
| .npmrc                   | npm/pnpm settings        | Recommended |
| .prettierrc              | Prettier rules           | Recommended |
| .prettierignore          | Prettier exclusions      | Recommended |
| eslint.config.js         | ESLint rules             | Recommended |
| biome.json               | Biome integrated config  | Alt. recommended |
| tsconfig.json            | TypeScript settings      | Required for TS |
| .vscode/settings.json    | VS Code shared settings  | Recommended |
| .vscode/extensions.json  | Recommended extensions   | Recommended |
| .vscode/launch.json      | Debug configuration      | Optional  |
| .husky/                  | Git hooks                | Recommended |
| commitlint.config.js     | Commit message rules     | Recommended |
| .mise.toml               | Multi-language versioning| Optional  |
| Makefile                 | Task runner              | Recommended |
| docker-compose.yml       | Local service config     | Recommended |
| renovate.json            | Auto dependency updates  | Recommended |
+------------------------------------------------------------------+
```

---

## 11. Automated Dependency Updates (Renovate / Dependabot)

### 11.1 Renovate Configuration

```jsonc
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":timezone(Asia/Tokyo)",
    ":semanticCommitTypeAll(chore)",
    "group:allNonMajor"
  ],
  "schedule": ["before 9am on Monday"],
  "labels": ["dependencies"],
  "automerge": true,
  "automergeType": "pr",
  "platformAutomerge": true,
  "packageRules": [
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["dependencies", "major"]
    },
    {
      "matchPackagePatterns": ["eslint", "prettier", "biome"],
      "groupName": "linting tools"
    },
    {
      "matchPackagePatterns": ["vitest", "playwright", "@testing-library"],
      "groupName": "testing tools"
    },
    {
      "matchUpdateTypes": ["patch", "minor"],
      "matchPackagePatterns": ["*"],
      "automerge": true
    }
  ],
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"]
  }
}
```

### 11.2 Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Tokyo"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    groups:
      development-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
      production-dependencies:
        dependency-type: "production"
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "ci"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "docker"
```

---

## 12. CI/CD Integration

### 12.1 Quality Checks with GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run format:check

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
```

### 12.2 Branch Protection Rules

Configure GitHub branch protection rules to prevent merges when CI does not pass.

```
+------------------------------------------------------------------+
|           Recommended main Branch Protection Settings             |
+------------------------------------------------------------------+
|                                                                  |
|  ✓ Require a pull request before merging                         |
|    ✓ Require approvals: 1                                        |
|    ✓ Dismiss stale pull request approvals when new commits       |
|      are pushed                                                  |
|    ✓ Require review from Code Owners                             |
|                                                                  |
|  ✓ Require status checks to pass before merging                  |
|    ✓ Require branches to be up to date before merging            |
|    Required checks:                                              |
|      - lint                                                      |
|      - test                                                      |
|      - build                                                     |
|                                                                  |
|  ✓ Require signed commits                                        |
|  ✓ Require linear history                                        |
|  ✗ Allow force pushes (must be disabled)                         |
|  ✗ Allow deletions (must be disabled)                            |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Anti-patterns

### Anti-pattern 1: Committing Personal Settings to the Repository

```jsonc
// NG: adding personal preferences to .vscode/settings.json
{
  "editor.fontSize": 18,
  "editor.fontFamily": "JetBrains Mono",
  "workbench.colorTheme": "One Dark Pro",
  "terminal.integrated.shell.osx": "/bin/zsh"
}

// OK: only settings relevant to the team
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

**Problem**: Personal settings such as font size and theme are naturally different between team members, and committing them causes unnecessary conflicts. Manage personal settings in VS Code user settings and only commit Linter/Formatter-related settings to the repository.

### Anti-pattern 2: Operating Without the engines Field

```jsonc
// NG: no engines specified -> run with each person's version
{
  "name": "myapp",
  "version": "1.0.0"
}

// OK: enforce with engines + .nvmrc + engine-strict
// package.json
{
  "name": "myapp",
  "version": "1.0.0",
  "engines": {
    "node": ">=20.0.0 <21.0.0",
    "npm": ">=10.0.0"
  }
}
// .npmrc
// engine-strict=true
```

**Problem**: Node.js version mismatches often cause hard-to-reproduce bugs. In particular, syntax support for `Optional Chaining` and `import.meta` depends on the version. By making version mismatches explicit errors using `engines` + `engine-strict`, environment discrepancies can be detected early.

### Anti-pattern 3: Applying Linter Rules All at Once

```bash
# NG: apply strict rules all at once to an existing project
# -> hundreds to thousands of errors overwhelm the team
eslint . --max-warnings 0

# OK: introduce gradually
# Step 1: introduce at warn level (don't touch existing code)
# Step 2: apply strict rules only to new code
# Step 3: gradually fix existing code
# Step 4: promote to error level
```

**Problem**: Applying strict Linter rules all at once to a large existing codebase generates massive errors and halts development. Effective strategies include gradually reducing `--max-warnings` in ESLint, or bulk-inserting `eslint-disable` comments and then removing them incrementally.

### Anti-pattern 4: Copy-paste Propagation of Config Files

```
# NG: copy settings from another project as-is
# -> doesn't match the project's specific requirements

# OK: create shared config packages
# @mycompany/eslint-config
# @mycompany/prettier-config
# @mycompany/tsconfig
```

**Problem**: Copying config files between projects means updates to the original are not propagated. By publishing shared configs as npm packages and referencing them via `extends` in each project, a single update is reflected across all projects.

---

## FAQ

### Q1: Do you need both EditorConfig and Prettier?

**A**: Yes. They serve different roles. EditorConfig controls editor input behavior (tab width, line endings), while Prettier handles code formatting on save (bracket placement, semicolons, etc.). EditorConfig also applies to files Prettier doesn't support (Makefile, INI files, etc.) and is independent of editor type. Configuring both ensures consistency at both input time and save time.

### Q2: Are husky Git hooks automatically applied to all team members?

**A**: The `"prepare": "husky"` script in `package.json` automatically installs hooks when `npm install` is run. However, individuals can still skip hooks with the `--no-verify` flag, so running the same checks in CI/CD as a double defense is recommended. Also, with pnpm, `"prepare": "husky"` is not automatically executed, so the steps to run `pnpm exec husky` explicitly need to be documented.

### Q3: Does using Biome make ESLint + Prettier unnecessary?

**A**: In many cases, yes. Biome is a fast tool written in Rust that handles both linting and formatting with a single tool. It is 10-100x faster than the ESLint + Prettier combination. However, some functionality equivalent to certain ESLint plugins (such as eslint-plugin-react-hooks and advanced @typescript-eslint rules) may still be lacking. For new projects, consider Biome as the first candidate and supplement with ESLint only for missing rules.

### Q4: How should standardization work in a monorepo?

**A**: In a monorepo, the basic approach is to place common configs at the root and override them in each package.

```
monorepo/
  .editorconfig          # Common to all packages
  .prettierrc            # Common to all packages
  tsconfig.base.json     # Common TypeScript settings
  eslint.config.js       # Common ESLint settings
  packages/
    app/
      tsconfig.json      # extends: "../../tsconfig.base.json"
    api/
      tsconfig.json      # extends: "../../tsconfig.base.json"
    shared/
      tsconfig.json      # extends: "../../tsconfig.base.json"
```

When using Turborepo or Nx, task caching and parallel execution can significantly reduce CI time.

### Q5: How do you create shared config packages?

**A**: Publishing as an npm package is the most effective way to distribute unified settings within an organization.

```bash
# @mycompany/eslint-config package
mkdir eslint-config && cd eslint-config
npm init --scope=@mycompany

# package.json
{
  "name": "@mycompany/eslint-config",
  "version": "1.0.0",
  "main": "index.js",
  "peerDependencies": {
    "eslint": ">=9.0.0",
    "typescript-eslint": ">=8.0.0"
  }
}

# Consumer's package.json
{
  "devDependencies": {
    "@mycompany/eslint-config": "^1.0.0"
  }
}

# Consumer's eslint.config.js
import mycompanyConfig from '@mycompany/eslint-config';
export default [...mycompanyConfig, /* project-specific rules */];
```

### Q6: Can the same strategy be used for Python or Go projects?

**A**: The basic idea is the same, but the tools differ.

- **Python**: Integrate ruff (Linter + Formatter) and mypy (type checking) settings in `pyproject.toml`. Pin version with `.python-version`. Manage hooks with the pre-commit framework.
- **Go**: Manage versions with `go.mod`. Configure golangci-lint with `.golangci.yml`. Format with `gofmt` / `goimports`.
- **Rust**: Pin version with `rust-toolchain.toml`. Configure Lint with `clippy.toml`. Configure formatting with `rustfmt.toml`.

---

## Summary

| Item | Key Points |
|------|-----------|
| EditorConfig | Unify tab width, line endings, and encoding across editors |
| .nvmrc | Pin Node.js version across the team. Also works with volta / fnm |
| .npmrc | `engine-strict=true` and `save-exact=true` are recommended |
| .gitattributes | Automatic line ending conversion and binary file detection |
| .gitignore | Explicit definition of files to exclude from tracking |
| VS Code settings | Only commit team-common settings. Exclude personal settings |
| Git Hooks | Auto Lint/Format before commit with husky + lint-staged |
| Commitlint | Ensure commit message quality with Conventional Commits |
| ESLint / Biome | Unify with Flat Config. Biome is a fast alternative |
| Prettier | Automatic code format unification |
| TypeScript | strict mode + noUncheckedIndexedAccess recommended |
| Renovate / Dependabot | Early handling of vulnerabilities via automated dependency updates |
| CI/CD integration | Run quality checks in both local hooks + CI/CD |
| Dual defense | Local hooks can be bypassed with `--no-verify`, so CI is the last line of defense |

## What to Read Next

- [Onboarding Automation](./01-onboarding-automation.md) -- Setup scripts and Makefile
- [Documentation Environment](./02-documentation-setup.md) -- VitePress / Docusaurus / ADR
- [Dev Container](../02-docker-dev/01-devcontainer.md) -- Unified development environment based on containers

## References

1. **EditorConfig Official** -- https://editorconfig.org/ -- EditorConfig specification and editor support status
2. **Conventional Commits** -- https://www.conventionalcommits.org/ja/ -- Commit message convention specification
3. **husky Official Documentation** -- https://typicode.github.io/husky/ -- Git hook management tool
4. **Biome Official** -- https://biomejs.dev/ -- Fast Linter/Formatter tool written in Rust
5. **ESLint v9 Flat Config** -- https://eslint.org/docs/latest/use/configure/configuration-files -- New ESLint configuration format
6. **Renovate Official Documentation** -- https://docs.renovatebot.com/ -- Automated dependency update tool
7. **typescript-eslint** -- https://typescript-eslint.io/ -- ESLint plugin for TypeScript
8. **fnm (Fast Node Manager)** -- https://github.com/Schniz/fnm -- Fast Node.js version manager written in Rust
9. **mise** -- https://mise.jdx.dev/ -- Multi-language version manager (formerly rtx)
10. **lefthook** -- https://github.com/evilmartians/lefthook -- Fast Git hook manager written in Go
