# Package Managers

> A practical guide covering the configuration, operation, and selection of major package managers including npm / pnpm / yarn, pip / poetry / uv, cargo, and Homebrew.

## What You Will Learn

1. Characteristics and selection criteria for Node.js ecosystem package managers (npm / pnpm / yarn)
2. Package management approaches for Python (pip / poetry / uv) and Rust (cargo)
3. System tool management with Homebrew and how to unify team environments
4. Package manager version unification with Corepack
5. Security measures and defense against supply chain attacks
6. Package management in monorepo environments


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Version Managers](./00-version-managers.md)

---

## 1. Node.js Package Managers

### 1.1 Comparison Table

| Feature | npm | pnpm | yarn (berry/v4) |
|---------|-----|------|-----------------|
| Bundled | Included with Node.js | Separate install | Separate install |
| Disk efficiency | Low (copies per project) | High (content-addressed) | Medium (minimal with PnP) |
| Install speed | Average | Fast | Fast |
| Lock file | package-lock.json | pnpm-lock.yaml | yarn.lock |
| Workspaces | Yes | Yes (excellent) | Yes |
| Phantom Dependencies | Yes | No (strict) | No (PnP) |
| Learning cost | Low | Low | Medium (PnP) |
| node_modules structure | Flat | Symlinks | PnP / node_modules |
| Offline install | Partial | Yes | Yes (Zero-Installs) |
| Patch feature | No | Yes (pnpm patch) | Yes (yarn patch) |

### 1.2 npm Configuration

```bash
# ─── Initial setup ───
npm config set init-author-name "Your Name"
npm config set init-author-email "your@email.com"
npm config set init-license "MIT"
npm config set save-exact true        # Pin versions

# ─── .npmrc (project root) ───
cat << 'EOF' > .npmrc
engine-strict=true
save-exact=true
package-lock=true
fund=false
audit-level=moderate
EOF

# ─── Basic operations ───
npm init -y                           # Initialize
npm install express                   # Add dependency
npm install -D typescript             # Add dev dependency
npm ci                                # Strict install from lock file (for CI)
npm audit                             # Vulnerability check
npm outdated                          # Show upgradable packages
npm update                            # Update patch/minor versions
```

### 1.2.1 Advanced npm Configuration

```bash
# ─── Full .npmrc options ───
cat << 'EOF' > .npmrc
# Version management
save-exact=true                       # Exact versions without ^ or ~
save-prefix=""                        # Empty version prefix

# Security
engine-strict=true                    # Strictly validate engines field
audit-level=moderate                  # Minimum level for npm audit
ignore-scripts=false                  # Control postinstall scripts

# Performance
package-lock=true                     # Always generate lock file
prefer-offline=true                   # Prefer offline cache
fund=false                            # Hide funding messages
update-notifier=false                 # Disable npm update notifications

# Registry settings
registry=https://registry.npmjs.org/
# Private registry (scoped)
@mycompany:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}

# Proxy settings (corporate environments)
# proxy=http://proxy.example.com:8080
# https-proxy=http://proxy.example.com:8080
# no-proxy=localhost,127.0.0.1

# Log settings
loglevel=warn
EOF

# ─── engines field in package.json ───
# Configure together with the version manager
{
  "engines": {
    "node": ">=20.0.0 <21",
    "npm": ">=10.0.0"
  },
  "engineStrict": true
}
```

### 1.2.2 Leveraging npm Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "validate": "npm run lint && npm run typecheck && npm run test",
    "prepare": "husky",
    "precommit": "lint-staged",
    "clean": "rm -rf node_modules .next out",
    "clean:install": "npm run clean && npm ci"
  }
}
```

```bash
# ─── Running npm scripts ───
npm run dev                           # Run a scripts command
npm run build -- --debug              # Pass extra arguments (after --)
npm run validate                      # Run a composite script

# ─── npm lifecycle scripts ───
# preinstall  → install → postinstall
# prepublish  → prepare → postpublish
# preversion  → version → postversion

# ─── Run local packages with npx ───
npx eslint .                          # Run eslint from devDependencies
npx -y create-next-app@latest         # Temporarily run an uninstalled package
npx --package=typescript tsc --init   # Run a command from a specific package
```

### 1.2.3 npm Security Features

```bash
# ─── Vulnerability auditing ───
npm audit                             # Show vulnerability report
npm audit --json                      # Output in JSON format
npm audit fix                         # Auto-fix (safe updates)
npm audit fix --force                 # Fix including breaking changes (caution)
npm audit signatures                  # Verify package signatures

# ─── provenance (proof of origin) ───
# Available in npm v9.5+
# Attach SLSA provenance when publishing packages from CI/CD
npm publish --provenance

# ─── Force-update vulnerable versions with overrides ───
# Add to package.json
{
  "overrides": {
    "lodash": "4.17.21",
    "minimist": ">=1.2.6",
    "json5": ">=2.2.2"
  }
}

# ─── Check lock file diff (during code review) ───
# Key points to check in package-lock.json changes:
# 1. New dependencies added (intentional?)
# 2. integrity hash changes (tamper detection)
# 3. resolved URL changes (registry tamper detection)
```

### 1.3 pnpm Configuration

```bash
# ─── Installation ───
# corepack (bundled with Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate

# Or install directly
npm install -g pnpm

# Homebrew
brew install pnpm

# ─── .npmrc (pnpm compatible) ───
cat << 'EOF' > .npmrc
shamefully-hoist=false
strict-peer-dependencies=true
auto-install-peers=true
EOF

# ─── Basic operations ───
pnpm install                          # Install dependencies
pnpm add express                      # Add dependency
pnpm add -D typescript                # Add dev dependency
pnpm remove lodash                    # Remove dependency
pnpm up --latest                      # Update all packages to latest
pnpm store prune                      # Remove unnecessary cache
pnpm why lodash                       # Show why this dependency exists
pnpm list --depth=0                   # List direct dependencies
```

### 1.3.1 pnpm Detailed Configuration

```yaml
# Configurable in .pnpmrc or .npmrc
# Recommended settings:

# ─── Strict mode ───
# shamefully-hoist=false               # Prevent phantom dependencies (default)
# strict-peer-dependencies=true        # Treat peer dependency mismatches as errors
# auto-install-peers=true              # Auto-install peer dependencies

# ─── Performance ───
# store-dir=~/.local/share/pnpm/store  # Store location (default)
# network-concurrency=16               # Simultaneous downloads
# prefer-offline=true                  # Prefer offline cache

# ─── Security ───
# ignore-scripts=true                  # Disable postinstall scripts
# side-effects-cache=true              # Enable build cache
```

```bash
# ─── Useful pnpm features ───

# Patch feature (apply patches to dependency packages)
pnpm patch express@4.18.2             # Create a temporary directory for patching
# → Edit files in the displayed directory
pnpm patch-commit <patch-dir>         # Commit the patch

# Result of patching:
# patches/express@4.18.2.patch is generated
# The following is added to package.json:
# {
#   "pnpm": {
#     "patchedDependencies": {
#       "express@4.18.2": "patches/express@4.18.2.patch"
#     }
#   }
# }

# ─── overrides (override dependency versions) ───
# Add to package.json
{
  "pnpm": {
    "overrides": {
      "lodash": "4.17.21",
      "glob": ">=10.0.0"
    }
  }
}

# ─── Catalog feature (version unification in monorepos) ───
# Define in pnpm-workspace.yaml
# catalog:
#   react: "^18.2.0"
#   typescript: "^5.4.0"
# → Can be referenced with the catalog: prefix within the workspace

# ─── pnpm deploy (deploy only dependencies) ───
pnpm deploy --filter=my-app /deploy/my-app
# → Expand only the dependencies needed for production to a separate directory
```

### 1.4 How pnpm Works

```
pnpm content-addressed storage:

  Traditional (npm):
  ┌──────────────┐  ┌──────────────┐
  │ Project A    │  │ Project B    │
  │ node_modules │  │ node_modules │
  │ ├── lodash/  │  │ ├── lodash/  │  Same package is
  │ │  (4.17.21) │  │ │  (4.17.21) │  duplicated per project
  │ └── express/ │  │ └── axios/   │  → Disk waste
  └──────────────┘  └──────────────┘

  pnpm:
  ~/.local/share/pnpm/store/
  ├── lodash@4.17.21/        ← Stored in one place
  └── express@4.18.2/

  Project A/node_modules/     Project B/node_modules/
  └── .pnpm/                  └── .pnpm/
      └── lodash@4.17.21         └── lodash@4.17.21
          → hard link                → hard link
            (no disk copy)             (no disk copy)

  Effect: 50-70% disk reduction, 2-3x faster installs

  Internal node_modules structure:
  ┌──────────────────────────────────────────────┐
  │ Project/node_modules/                         │
  │ ├── .pnpm/                                   │
  │ │   ├── express@4.18.2/                      │
  │ │   │   └── node_modules/                    │
  │ │   │       ├── express/ → hard link         │
  │ │   │       ├── accepts/ → hard link         │
  │ │   │       └── body-parser/ → hard link     │
  │ │   └── lodash@4.17.21/                      │
  │ │       └── node_modules/                    │
  │ │           └── lodash/ → hard link          │
  │ ├── express → .pnpm/express@4.18.2/...       │
  │ └── lodash → .pnpm/lodash@4.17.21/...       │
  └──────────────────────────────────────────────┘

  This means:
  - Cannot directly access express's internal dependencies (prevents phantom dependencies)
  - Each package can only reference its own dependencies (strict dependency resolution)
```

### 1.5 yarn (v4/berry) Configuration

```bash
# ─── Installation ───
corepack enable
corepack prepare yarn@stable --activate

# ─── Project initialization ───
yarn init -2                          # Create a yarn berry project
yarn set version stable               # Set to latest stable version

# ─── .yarnrc.yml ───
cat << 'EOF' > .yarnrc.yml
nodeLinker: node-modules               # When not using PnP
enableGlobalCache: true
nmHoistingLimits: workspaces
EOF

# ─── Basic operations ───
yarn install                          # Install dependencies
yarn add express                      # Add dependency
yarn add -D typescript                # Add dev dependency
yarn remove lodash                    # Remove dependency
yarn up --interactive                 # Interactive update
yarn why lodash                       # Check dependency relationships
yarn info express                     # Show package info
yarn dlx create-next-app              # npx equivalent (temporary execution)
```

### 1.5.1 yarn Plug'n'Play (PnP)

```yaml
# .yarnrc.yml - PnP mode configuration
nodeLinker: pnp                        # Enable PnP
pnpMode: loose                         # loose mode (compatibility-focused)
# pnpMode: strict                      # strict mode

# How PnP works:
# Does not create a node_modules directory
# Instead generates .pnp.cjs (or .pnp.loader.mjs)
# Overrides Node.js module resolution to reference packages directly

# PnP benefits:
# - Drastically reduced install time (no file copying)
# - Reduced disk usage
# - Complete prevention of phantom dependencies
# - Zero-Installs (commit .yarn/cache to speed up CI)

# PnP drawbacks:
# - Compatibility issues with some tools (requires additional setup)
# - Additional configuration needed for editor integration
```

```bash
# ─── Achieve Zero-Installs with PnP ───
# Add to .gitattributes (treat as binary)
cat << 'EOF' >> .gitattributes
.yarn/cache/** binary
.yarn/releases/** binary
.yarn/plugins/** binary
.pnp.* binary
EOF

# .gitignore
cat << 'EOF' >> .gitignore
.yarn/*
!.yarn/cache
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
EOF

# Zero-Installs effect:
# No yarn install needed after clone
# Install step in CI is unnecessary (saves several minutes)

# ─── PnP + VSCode integration ───
yarn dlx @yarnpkg/sdks vscode         # Install VSCode SDK
# → TypeScript SDK path is configured in .vscode/settings.json
```

### 1.5.2 yarn Workspace Features

```json
// package.json (root)
{
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

```bash
# ─── Workspace operations ───
yarn workspaces list                   # List workspaces
yarn workspace my-app add express      # Add dependency to a specific workspace
yarn workspace my-app run build        # Run script in a specific workspace

# ─── yarn constraints (dependency constraint rules) ───
# Define constraints in yarn.config.cjs
module.exports = {
  async constraints({ Yarn }) {
    // Enforce the same TypeScript version across all workspaces
    for (const dep of Yarn.dependencies({ ident: 'typescript' })) {
      dep.update('^5.4.0');
    }
    // Unify react version
    for (const dep of Yarn.dependencies({ ident: 'react' })) {
      dep.update('^18.2.0');
    }
  }
};

# yarn constraints            # Check constraints
# yarn constraints --fix      # Auto-fix
```

### 1.6 Node.js Package Manager Benchmarks

```
npm vs pnpm vs yarn benchmark comparison:

  Test environment: medium-sized project (approx. 200 dependencies)

  Clean install (with cache):
  ┌──────────┬──────────┬──────────┬──────────┐
  │          │   npm    │   pnpm   │   yarn   │
  ├──────────┼──────────┼──────────┼──────────┤
  │ Time     │  18.5s   │   6.2s   │   7.8s   │
  │ Disk     │  245MB   │   98MB   │  112MB   │
  └──────────┴──────────┴──────────┴──────────┘

  Install from lock file (npm ci equivalent):
  ┌──────────┬──────────┬──────────┬──────────┐
  │          │  npm ci  │ pnpm i   │ yarn i   │
  │          │          │ --frozen │          │
  ├──────────┼──────────┼──────────┼──────────┤
  │ Time     │  12.3s   │   4.8s   │   5.1s   │
  └──────────┴──────────┴──────────┴──────────┘

  Cumulative disk usage across 10 projects:
  ┌──────────┬──────────┬──────────┬──────────┐
  │          │   npm    │   pnpm   │   yarn   │
  ├──────────┼──────────┼──────────┼──────────┤
  │ Total    │  2.45GB  │  0.35GB  │  1.12GB  │
  │ Reduction│   -      │  -86%    │  -54%    │
  └──────────┴──────────┴──────────┴──────────┘

  pnpm's disk efficiency comes from content-addressed storage
  The same package version is stored only once and shared via hard links
```

---

## 2. Python Package Managers

### 2.1 Comparison Table

| Feature | pip + venv | Poetry | uv |
|---------|-----------|--------|-----|
| Speed | Slow | Average | Ultra-fast (10-100x) |
| Dependency resolution | Basic | Advanced | Advanced |
| Lock file | None (manual generation) | poetry.lock | uv.lock |
| Virtual environment | Manual creation | Automatic | Automatic |
| Build | setuptools | Built-in | Built-in |
| pyproject.toml | Partial support | Full support | Full support |
| Python version management | No | No | Yes |
| Script execution | No | poetry run | uv run |

### 2.2 uv (Recommended -- Next-Generation Package Manager)

```bash
# ─── Installation ───
curl -LsSf https://astral.sh/uv/install.sh | sh
# Or
brew install uv
# Via pip
pip install uv

# ─── Project initialization ───
uv init my-project
cd my-project

# ─── Dependency management ───
uv add requests                       # Add dependency
uv add --dev pytest ruff              # Add dev dependencies
uv add --optional docs sphinx         # Add optional dependency
uv remove requests                    # Remove dependency
uv lock                               # Generate lock file
uv sync                               # Sync from lock file

# ─── Script execution ───
uv run python main.py                 # Run inside virtual environment
uv run pytest                         # Run tests
uv run ruff check .                   # Run linter

# ─── Python version management (no pyenv needed) ───
uv python install 3.12                # Can also install Python itself
uv python pin 3.12                    # Pin to project
```

### 2.2.1 Advanced uv Usage

```bash
# ─── pip compatibility mode ───
# Use uv as a fast drop-in replacement for pip in existing projects
uv pip install -r requirements.txt    # 10-100x faster than pip
uv pip install flask                  # Individual package
uv pip compile requirements.in -o requirements.txt  # Generate lock file
uv pip sync requirements.txt          # Sync from lock file

# ─── uv virtual environment management ───
uv venv                               # Create .venv
uv venv --python 3.12                  # Create with a specific version
uv venv my-env                         # Named virtual environment
source .venv/bin/activate              # Activate (unnecessary if using uv run)

# ─── Tool execution (pipx alternative) ───
uv tool run ruff check .              # Temporarily install and run a tool
uv tool install ruff                   # Permanently install a tool
uv tool list                           # List installed tools
uvx ruff check .                       # Shortcut for uv tool run
```

```toml
# pyproject.toml - uv project configuration

[project]
name = "my-project"
version = "0.1.0"
description = "My project description"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "sqlalchemy>=2.0",
    "pydantic>=2.6",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "ruff>=0.3.0",
    "mypy>=1.8",
    "coverage>=7.4",
]
docs = [
    "sphinx>=7.2",
    "sphinx-rtd-theme>=2.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0",
    "ruff>=0.3.0",
    "mypy>=1.8",
]

[tool.uv.sources]
# Private registry
# my-internal-package = { index = "internal" }

# Directly from Git repository
# my-lib = { git = "https://github.com/org/my-lib.git", tag = "v1.0.0" }

# Local path (another package within a monorepo)
# shared-utils = { path = "../shared-utils" }

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### 2.2.2 uv Benchmarks

```
uv vs pip vs poetry install speed comparison:

  Test: Django project (approx. 80 dependencies)

  Cold install:
  ┌──────────────┬──────────┬──────────┬──────────┐
  │              │   pip    │  poetry  │    uv    │
  ├──────────────┼──────────┼──────────┼──────────┤
  │ Time         │  32.5s   │  28.1s   │   1.2s   │
  │ Speed ratio  │   1x     │   1.2x   │   27x    │
  └──────────────┴──────────┴──────────┴──────────┘

  Warm install (with cache):
  ┌──────────────┬──────────┬──────────┬──────────┐
  │              │   pip    │  poetry  │    uv    │
  ├──────────────┼──────────┼──────────┼──────────┤
  │ Time         │  15.8s   │  12.3s   │   0.3s   │
  │ Speed ratio  │   1x     │   1.3x   │   53x    │
  └──────────────┴──────────┴──────────┴──────────┘

  Dependency resolution:
  ┌──────────────┬──────────┬──────────┬──────────┐
  │              │   pip    │  poetry  │    uv    │
  ├──────────────┼──────────┼──────────┼──────────┤
  │ Time         │  8.2s    │  5.1s    │   0.4s   │
  └──────────────┴──────────┴──────────┴──────────┘

  Why uv is fast:
  - Implemented in Rust (pip is Python, Poetry is also Python)
  - Parallel download and extraction
  - Efficient dependency resolution algorithm (PubGrub)
  - Intelligent caching
```

### 2.3 Poetry

```bash
# ─── Installation ───
curl -sSL https://install.python-poetry.org | python3 -
# Or
pipx install poetry

# ─── Configuration ───
poetry config virtualenvs.in-project true   # Create .venv inside the project
poetry config virtualenvs.prefer-active-python true  # Prefer the active Python

# ─── Project initialization ───
poetry init                           # Interactive initialization
poetry new my-project                 # Create project template
poetry install                        # Install dependencies

# ─── Dependency management ───
poetry add requests                   # Add dependency
poetry add --group dev pytest         # Add dev dependency
poetry add --group docs sphinx        # Add docs dependency
poetry remove requests                # Remove dependency
poetry lock                           # Update lock file
poetry show --outdated                # Upgradable packages
poetry show --tree                    # Show dependency tree

# ─── Execution ───
poetry run python main.py
poetry shell                          # Activate virtual environment

# ─── Build & publish ───
poetry build                          # Build sdist + wheel
poetry publish                        # Publish to PyPI
poetry publish --build                # Build + publish at once
```

### 2.3.1 Poetry pyproject.toml

```toml
# pyproject.toml - Poetry format

[tool.poetry]
name = "my-project"
version = "0.1.0"
description = "My project description"
authors = ["Your Name <your@email.com>"]
readme = "README.md"
packages = [{include = "my_project"}]

[tool.poetry.dependencies]
python = "^3.12"
fastapi = "^0.110.0"
uvicorn = {version = "^0.27.0", extras = ["standard"]}
sqlalchemy = "^2.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0"
ruff = "^0.3.0"
mypy = "^1.8"

[tool.poetry.group.docs.dependencies]
sphinx = "^7.2"

[tool.poetry.scripts]
my-cli = "my_project.cli:main"

[tool.poetry.plugins."my_framework.plugins"]
my-plugin = "my_project.plugins:MyPlugin"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

### 2.4 pip + venv (Standard Library Only)

```bash
# ─── Create and activate virtual environment ───
python -m venv .venv
source .venv/bin/activate             # macOS/Linux
# .venv\Scripts\activate              # Windows

# ─── Dependency management ───
pip install flask                     # Install package
pip install -r requirements.txt       # Batch install
pip freeze > requirements.txt         # Output current dependencies

# ─── Ensure reproducibility with pip-compile ───
pip install pip-tools
# Write direct dependencies in requirements.in:
# flask
# sqlalchemy>=2.0
pip-compile requirements.in           # Generate lock file
pip-sync requirements.txt             # Sync from lock file

# ─── Separate dev and production dependencies ───
pip-compile requirements.in -o requirements.txt
pip-compile requirements-dev.in -o requirements-dev.txt
```

### 2.5 Python Package Manager Selection Flow

```
Python project package manager selection:

                    START
                      │
                      ▼
            New project? ─── No ──→ Continue with existing tool
                   │                     (consider migration cost)
                  Yes
                   │
                   ▼
            Speed top priority? ─── Yes ──→ uv
                   │                         (Rust-based, ultra-fast)
                  No
                   │
                   ▼
            Plugin ecosystem
            needed? ──── Yes ──→ Poetry
                   │               (mature ecosystem)
                  No
                   │
                   ▼
            Also want to manage
            Python versions? ──── Yes ──→ uv
                   │                       (no pyenv needed)
                  No
                   │
                   ▼
            Minimal dependencies
            preferred? ──── Yes ──→ pip + venv + pip-tools
                   │                  (standard library only)
                  No
                   │
                   ▼
              uv (recommended overall)
```

---

## 3. Rust Package Manager (Cargo)

### 3.1 Basic Operations

```bash
# ─── Create project ───
cargo new my-project                  # Binary project
cargo new --lib my-lib                # Library project
cargo init                            # Initialize in existing directory

# ─── Dependency management (Cargo.toml) ───
cargo add serde --features derive     # Add dependency
cargo add tokio -F full               # With feature flags
cargo add --dev mockall               # Dev dependency
cargo add --build bindgen             # Build dependency
cargo remove serde                    # Remove dependency

# ─── Build & run ───
cargo build                           # Debug build
cargo build --release                 # Release build
cargo run                             # Build + run
cargo run --release                   # Run in release mode
cargo test                            # Run tests
cargo test -- --nocapture             # Show test output
cargo clippy                          # Lint
cargo clippy -- -D warnings           # Treat warnings as errors
cargo fmt                             # Format
cargo fmt -- --check                  # Format check (for CI)
cargo doc --open                      # Generate docs + open in browser
cargo bench                           # Run benchmarks
```

### 3.2 Cargo.toml Configuration

```toml
[package]
name = "my-project"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"
authors = ["Your Name <your@email.com>"]
description = "My project description"
license = "MIT"
repository = "https://github.com/user/my-project"

[dependencies]
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
axum = "0.7"

[dev-dependencies]
mockall = "0.12"
tokio-test = "0.4"
criterion = { version = "0.5", features = ["html_reports"] }
insta = "1"                           # Snapshot testing

[build-dependencies]
# Dependencies used in build scripts

[profile.release]
lto = true                            # Link-Time Optimization
codegen-units = 1                     # Single code generation unit
strip = true                          # Strip debug info
panic = "abort"                       # Abort on panic
opt-level = 3                         # Maximum optimization

[profile.dev]
opt-level = 1                         # Some optimization even in debug builds
# debug = true                        # Debug info (enabled by default)

[profile.dev.package."*"]
opt-level = 2                         # Optimize debug builds of dependencies

# ─── Feature flags ───
[features]
default = ["json"]
json = ["serde_json"]
full = ["json", "yaml", "toml-support"]
yaml = ["serde_yaml"]
toml-support = ["toml"]

# ─── Workspace ───
[workspace]
members = [
    "crates/core",
    "crates/cli",
    "crates/server",
]
resolver = "2"

[workspace.dependencies]
# Shared dependency versions across the workspace
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
```

### 3.3 Useful Cargo Subcommands

```bash
# ─── Install additional tools with cargo-install ───
cargo install cargo-watch              # Watch file changes and auto-build
cargo install cargo-expand             # Show macro expansions
cargo install cargo-audit              # Vulnerability check
cargo install cargo-tarpaulin          # Code coverage
cargo install cargo-nextest            # Fast test runner
cargo install cargo-deny               # Dependency policy check
cargo install cargo-udeps              # Detect unused dependencies
cargo install cargo-bloat              # Binary size analysis

# ─── Usage ───
cargo watch -x test                    # Auto-run tests
cargo watch -x "run -- --port 8080"    # Auto-restart server
cargo expand                           # Show macro expansion results
cargo audit                            # Vulnerability report
cargo nextest run                      # Run tests in parallel
cargo tarpaulin --out html             # Generate coverage report
cargo udeps                            # Detect unused dependencies
cargo bloat --release                  # Analyze binary size

# ─── Enforce dependency policy with cargo-deny ───
cargo deny init                        # Generate deny.toml
cargo deny check                       # Policy check
```

```toml
# deny.toml - Dependency policy configuration
[licenses]
allow = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"]
deny = ["GPL-3.0"]

[bans]
multiple-versions = "warn"
deny = [
    { name = "openssl" },              # Use rustls instead
]

[advisories]
vulnerability = "deny"
unmaintained = "warn"

[sources]
unknown-registry = "deny"
unknown-git = "deny"
```

---

## 4. Homebrew (macOS / Linux)

### 4.1 Setup and Operations

```bash
# ─── Installation ───
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# ─── Basic operations ───
brew install ripgrep fd bat           # CLI tools
brew install --cask firefox           # GUI apps
brew update                           # Update Homebrew itself
brew upgrade                          # Update all packages
brew upgrade ripgrep                  # Update a specific package
brew cleanup                          # Remove old versions
brew cleanup --prune=7                # Remove cache older than 7 days
brew list                             # List installed packages
brew list --cask                      # List casks
brew doctor                           # Diagnose environment
brew info ripgrep                     # Package info
brew deps --tree ripgrep              # Dependency tree
brew leaves                           # List packages not depended on by others
brew autoremove                       # Auto-remove unnecessary dependencies

# ─── Unify team with Brewfile ───
brew bundle dump                      # Export current environment to Brewfile
brew bundle dump --force              # Overwrite existing Brewfile
brew bundle install                   # Install from Brewfile
brew bundle check                     # Check diff with Brewfile
brew bundle cleanup                   # Remove packages not in Brewfile
```

### 4.2 Brewfile

```ruby
# Brewfile
# Install all at once with: brew bundle install

# ─── Taps ───
tap "homebrew/bundle"
tap "homebrew/services"               # Service management

# ─── CLI tools ───
brew "git"
brew "gh"                             # GitHub CLI
brew "fnm"                            # Node.js version manager
brew "mise"                           # Multi-language version manager
brew "ripgrep"                        # Fast grep
brew "fd"                             # Fast find
brew "bat"                            # cat alternative
brew "eza"                            # ls alternative
brew "fzf"                            # Fuzzy finder
brew "zoxide"                         # cd alternative (learning-based)
brew "jq"                             # JSON parser
brew "yq"                             # YAML parser
brew "delta"                          # git diff viewer
brew "starship"                       # Prompt
brew "tmux"                           # Terminal multiplexer
brew "direnv"                         # Per-directory environment variables
brew "hyperfine"                      # Command benchmark
brew "tokei"                          # Line count tool
brew "dust"                           # du alternative
brew "bottom"                         # top alternative
brew "procs"                          # ps alternative
brew "httpie"                         # HTTP client
brew "wget"                           # Download tool
brew "tree"                           # Directory tree
brew "watch"                          # Periodic command execution

# ─── Development tools ───
brew "docker"                         # Containers
brew "docker-compose"                 # Container orchestration
brew "kubectl"                        # Kubernetes CLI
brew "helm"                           # Kubernetes package manager
brew "terraform"                      # IaC
brew "awscli"                         # AWS CLI
brew "uv"                             # Python package manager

# ─── Databases ───
brew "postgresql@16"                  # PostgreSQL
brew "redis"                          # Redis
brew "sqlite"                         # SQLite

# ─── GUI apps ───
cask "visual-studio-code"
cask "cursor"                         # AI editor
cask "iterm2"
cask "warp"                           # AI terminal
cask "docker"                         # Docker Desktop
cask "firefox"
cask "google-chrome"
cask "raycast"                        # Spotlight alternative
cask "1password"                      # Password manager
cask "figma"                          # Design tool
cask "notion"                         # Documentation
cask "slack"                          # Chat
cask "zoom"                           # Video conferencing
cask "obsidian"                       # Note-taking app

# ─── Fonts ───
cask "font-jetbrains-mono-nerd-font"
cask "font-fira-code-nerd-font"
cask "font-hack-nerd-font"

# ─── Mac App Store (mas) ───
# mas "Xcode", id: 497799835
# mas "Keynote", id: 409183694
```

### 4.3 Homebrew Service Management

```bash
# ─── Start/stop services ───
brew services start postgresql@16     # Start PostgreSQL
brew services stop postgresql@16      # Stop
brew services restart postgresql@16   # Restart
brew services list                    # List services
brew services info postgresql@16      # Service info

# ─── Auto-start at login ───
# brew services start automatically configures a LaunchAgent
# To disable manually:
brew services stop postgresql@16
```

### 4.4 Homebrew Troubleshooting

```bash
# ─── Common problems and solutions ───

# Problem: brew update fails
brew update-reset                     # Reset Homebrew repository

# Problem: Permission denied
sudo chown -R $(whoami) /opt/homebrew  # Apple Silicon Mac
sudo chown -R $(whoami) /usr/local     # Intel Mac

# Problem: cask installation blocked (Gatekeeper)
# Allow in System Preferences > Privacy & Security
# Or:
xattr -cr /Applications/SomeApp.app

# Problem: Want to use an older version
brew tap homebrew/cask-versions
brew install --cask firefox@esr       # ESR version

# Problem: High disk usage
brew cleanup --prune=0                # Remove all cache
du -sh $(brew --cache)                # Check cache size
```

---

## 5. Package Manager Selection Flow

```
Node.js project package manager selection:

                    START
                      │
                      ▼
              Monorepo? ─── Yes ──→ pnpm
                   │                  (best workspace support)
                  No
                   │
                   ▼
          Disk space a
          concern? ─── Yes ──→ pnpm
                   │              (content-addressed)
                  No
                   │
                   ▼
          Zero-Installs
          needed? ─── Yes ──→ yarn (PnP)
                   │            (faster CI)
                  No
                   │
                   ▼
          Team has no experience
          beyond npm? ─── Yes ──→ npm
                   │               (no additional learning)
                  No
                   │
                   ▼
              pnpm (recommended overall)
```

---

## 6. Version Unification with Corepack

```bash
# Corepack is bundled with Node.js 16.13+
corepack enable

# Specify in package.json
{
  "packageManager": "pnpm@9.1.0"
}

# When a team member runs npm install:
# → Notified with "This project is configured to use pnpm"
# → The correct version of pnpm is used automatically
```

```
Corepack operation flow:

  package.json
  "packageManager": "pnpm@9.1.0"
         │
         ▼
  ┌──────────────────────────────┐
  │  corepack                     │
  │  (proxy bundled with Node.js) │
  │                                │
  │  When running pnpm command:   │
  │  1. Check package.json        │
  │  2. Validate specified version│
  │  3. Auto-download if missing  │
  │  4. Run with correct version  │
  └──────────────────────────────┘
```

### 6.1 Corepack Detailed Configuration

```bash
# ─── Enable and configure Corepack ───
corepack enable                        # Enable Corepack
corepack enable pnpm                   # Enable only pnpm
corepack enable yarn                   # Enable only yarn

# ─── Prepare package managers ───
corepack prepare pnpm@9.1.0 --activate # Prepare a specific version
corepack prepare yarn@4.1.0 --activate

# ─── Add to package.json ───
# Not auto-configured by npm init, so add manually
{
  "packageManager": "pnpm@9.1.0+sha512.xxxxx"
}

# Specifying with hash enables integrity checks
# Auto-generated with: corepack use pnpm@9.1.0

# ─── Corepack in CI ───
# GitHub Actions
- uses: actions/setup-node@v4
  with:
    node-version-file: '.node-version'
- run: corepack enable
- run: pnpm install --frozen-lockfile

# ─── Corepack offline mode ───
# When restricting network access in CI
corepack prepare pnpm@9.1.0 --activate
corepack pack                          # Create bundle
# → Cache corepack.tgz in CI

# ─── Prevent use of wrong package manager ───
# Add to package.json:
{
  "scripts": {
    "preinstall": "npx only-allow pnpm"
  }
}
# → Running npm install or yarn install will produce an error
```

---

## 7. Security and Supply Chain Countermeasures

### 7.1 npm / pnpm Security Configuration

```bash
# ─── Regular vulnerability checks ───
npm audit                              # Vulnerability report
pnpm audit                             # pnpm version
yarn npm audit                         # yarn version

# ─── Security checks in CI ───
npm audit --audit-level=high           # Fail on high severity and above
npm audit --omit=dev                   # Check only production dependencies

# ─── Integration with Socket.dev ───
# A tool specialized in detecting supply chain attacks
npx socket-security audit              # Analysis by Socket.dev

# ─── npm provenance (proof of origin) ───
# Attach SLSA provenance when publishing from GitHub Actions
# npm publish --provenance

# ─── Validate lock files with lockfile-lint ───
npx lockfile-lint \
  --path pnpm-lock.yaml \
  --type pnpm \
  --allowed-hosts npm \
  --allowed-schemes "https:"
```

### 7.2 Defense Against Supply Chain Attacks

```
Supply chain attack vectors and countermeasures:

  1. Typosquatting
  ┌──────────────────────────────────────────────┐
  │ Attack: Publish a package with a similar name  │
  │   e.g.: lodash → lodahs, lod-ash              │
  │                                                │
  │ Countermeasures:                               │
  │   - Copy & paste package names                 │
  │   - Verify with npm info <package> before      │
  │     installing                                 │
  │   - Introduce detection tools like Socket.dev  │
  └──────────────────────────────────────────────┘

  2. Dependency Confusion
  ┌──────────────────────────────────────────────┐
  │ Attack: Publish a package with the same name  │
  │   as an internal package on the public        │
  │   registry                                    │
  │   → npm prioritizes the public registry       │
  │                                                │
  │ Countermeasures:                               │
  │   - Explicitly configure scopes and registries │
  │     in .npmrc                                  │
  │   @mycompany:registry=https://internal-npm/    │
  │   - Always use scopes in package names         │
  │   @mycompany/my-package                        │
  └──────────────────────────────────────────────┘

  3. Malicious postinstall scripts
  ┌──────────────────────────────────────────────┐
  │ Attack: Malicious code in postinstall script  │
  │   → Auto-executed during npm install          │
  │                                                │
  │ Countermeasures:                               │
  │   - .npmrc: ignore-scripts=true               │
  │   - Allow scripts only for trusted packages   │
  │   - Control with pnpm's onlyBuiltDependencies │
  └──────────────────────────────────────────────┘

  4. Compromised Maintainer
  ┌──────────────────────────────────────────────┐
  │ Attack: Maintainer account is hijacked        │
  │   → A malicious version is published to the   │
  │     legitimate package                        │
  │                                                │
  │ Countermeasures:                               │
  │   - Review lock file diffs                    │
  │   - Verify signatures with npm audit          │
  │     signatures                                │
  │   - Be cautious with auto-updates             │
  │     (Dependabot PRs require manual review)    │
  │   - Pin versions with save-exact=true         │
  └──────────────────────────────────────────────┘
```

### 7.3 Python Security Measures

```bash
# ─── pip-audit (vulnerability check) ───
pip install pip-audit
pip-audit                              # Check vulnerabilities in current environment
pip-audit -r requirements.txt          # Check requirements.txt

# ─── Vulnerability check with uv ───
# uv can be configured to automatically check vulnerabilities during dependency resolution

# ─── safety (Python vulnerability database) ───
pip install safety
safety check                           # Vulnerability check
safety check -r requirements.txt       # Specify a file

# ─── Hash verification ───
# Including hashes in requirements.txt detects tampering
pip install --require-hashes -r requirements.txt

# Auto-generate hashes with uv pip compile
uv pip compile requirements.in --generate-hashes -o requirements.txt
```

---

## 8. Package Management in Monorepos

### 8.1 pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
  - "tools/*"
```

```bash
# ─── Workspace operations ───
pnpm install                           # Install dependencies for all workspaces
pnpm add -D typescript -w              # Add dependency to root
pnpm add express --filter my-app       # Add dependency to a specific workspace
pnpm run build --filter my-app         # Build in a specific workspace
pnpm run build --filter "./packages/*" # Build with pattern matching
pnpm run test -r                       # Run tests in all workspaces (recursive)
pnpm run build --filter my-app...      # Build my-app and all its dependencies
pnpm run build --filter ...my-app      # Build everything that depends on my-app

# ─── Dependencies between workspaces ───
# packages/my-lib/package.json
{
  "name": "@myproject/my-lib",
  "version": "1.0.0"
}

# apps/my-app/package.json
{
  "dependencies": {
    "@myproject/my-lib": "workspace:*"  # Reference the latest version in workspace
  }
}

# ─── Catalog feature (version unification) ───
# pnpm-workspace.yaml
packages:
  - "packages/*"

catalog:
  react: "^18.2.0"
  react-dom: "^18.2.0"
  typescript: "^5.4.0"
  vitest: "^1.3.0"

# Use the catalog: prefix in each package
# packages/my-app/package.json
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  }
}
```

### 8.2 Combination with Turborepo

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

```bash
# ─── Basic Turborepo operations ───
npx turbo run build                    # Build all packages (dependency-ordered, with cache)
npx turbo run test --filter=my-app     # Test a specific package
npx turbo run lint test build          # Run multiple tasks in dependency order
npx turbo run build --dry-run          # Show execution plan (without running)
npx turbo run build --graph            # Show dependency graph
```

### 8.3 Combination with Nx

```bash
# ─── Initialize Nx ───
npx nx init                            # Add Nx to an existing project

# ─── Basic operations ───
npx nx build my-app                    # Build a specific project
npx nx run-many -t build               # Build all projects
npx nx affected -t test                # Test projects affected by changes
npx nx graph                           # Visualize dependency graph

# ─── Caching ───
# Nx caches build results and returns cached output when there are no changes
# Using remote cache (Nx Cloud) allows sharing across the team
```

---

## 9. Private Registries

### 9.1 npm Private Registry

```bash
# ─── GitHub Packages ───
# .npmrc
@mycompany:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

# ─── npm Enterprise / Artifactory ───
# .npmrc
@mycompany:registry=https://npm.mycompany.com/
//npm.mycompany.com/:_authToken=${NPM_TOKEN}
always-auth=true

# ─── Verdaccio (self-hosted) ───
# Start with Docker
docker run -d --name verdaccio -p 4873:4873 verdaccio/verdaccio

# .npmrc
registry=http://localhost:4873/
# Proxy settings (falls back to npmjs.org for absent packages)
```

### 9.2 Python Private Registry

```bash
# ─── pip configuration ───
pip install my-package --index-url https://pypi.mycompany.com/simple/
pip install my-package --extra-index-url https://pypi.mycompany.com/simple/

# ─── uv configuration ───
# pyproject.toml
[tool.uv]
index-url = "https://pypi.mycompany.com/simple/"
extra-index-url = ["https://pypi.org/simple/"]

# ─── Poetry configuration ───
poetry config repositories.mycompany https://pypi.mycompany.com/simple/
poetry config http-basic.mycompany username password
```

---

## 10. Anti-Patterns

### 10.1 Not Committing Lock Files

```
Anti-pattern: Adding lock files to .gitignore

  .gitignore:
    package-lock.json    # ← Bad
    pnpm-lock.yaml       # ← Bad

Problems:
  - Different versions installed across team members
  - Different dependency versions between CI and dev environments
  - Source of non-reproducible bugs

Correct approach:
  - Always commit lock files
  - Use npm ci / pnpm install --frozen-lockfile in CI
  - Security check by reviewing lock file diffs
```

### 10.2 Overusing Global Installs

```
Anti-pattern: Installing project tools with npm install -g

  npm install -g eslint typescript ts-node

Problems:
  - Version conflicts between projects
  - Different versions from team members
  - Cannot reproduce in CI

Correct approach:
  - Add to devDependencies and run with npx
  - npm install -D eslint typescript
  - npx eslint .  /  pnpm exec eslint .
  - Define in package.json scripts

Exceptions (cases where global install is appropriate):
  - Package managers themselves: pnpm, yarn
  - Cross-project tools: vercel, netlify-cli
  - Shell integration tools: nvm, fnm
```

### 10.3 Committing node_modules

```
Anti-pattern: Committing node_modules to the repository

Problems:
  - Repository size explodes (hundreds of MB to several GB)
  - clone / pull becomes extremely slow
  - Contains OS / architecture-dependent binaries
  - Lock files become meaningless

Correct approach:
  Add to .gitignore:
    node_modules/
    .venv/
    __pycache__/
    target/          # Rust

  Do a clean install every time in CI:
    npm ci / pnpm install --frozen-lockfile
```

### 10.4 Overly Wide Version Ranges

```
Anti-pattern: Specifying wildcards or too-wide ranges in dependencies

  {
    "dependencies": {
      "express": "*",              # Any version
      "lodash": ">=4.0.0",        # Anything 4.x or above
      "react": "^17 || ^18"       # Multiple major versions
    }
  }

Problems:
  - Without a lock file, a different version is installed every time
  - Risk of installing versions with breaking changes
  - Risk of installing versions with security vulnerabilities

Correct approach:
  {
    "dependencies": {
      "express": "4.18.2",         # Exact version (save-exact)
      "lodash": "^4.17.21",       # Allow patch/minor updates only
      "react": "^18.2.0"          # One major version
    }
  }
```

### 10.5 Mixing Multiple Lock Files

```
Anti-pattern: Multiple lock files in the same project

  my-project/
  ├── package-lock.json   # npm
  ├── pnpm-lock.yaml      # pnpm
  └── yarn.lock           # yarn

Problems:
  - Unclear which package manager to use
  - Different dependency versions between lock files
  - Unpredictable CI behavior

Correct approach:
  - Unify to one package manager
  - Remove unnecessary lock files and add to .gitignore
  - Explicitly state with the packageManager field in package.json
  - Enforce with "preinstall": "npx only-allow pnpm"
```

---

## 11. FAQ

### Q1: Between npm and pnpm, which should be introduced to a team?

**A:** pnpm is recommended for new projects. Reasons are as follows.
- 50-70% disk usage reduction
- 2-3x faster installs
- Strict dependency resolution (prevents phantom dependencies)
- Easy coexistence with npm via Corepack

For existing projects using npm, you can convert from `package-lock.json` to `pnpm-lock.yaml` with `pnpm import`.

### Q2: Can uv replace Poetry?

**A:** In most cases, yes. uv is 10-100x faster than Poetry and uses `pyproject.toml` as a common format. However, if you depend on Poetry's plugin ecosystem, a gradual migration is recommended. As of 2025, uv is maturing rapidly, and for new projects, uv is the first choice.

### Q3: Where should Brewfile be placed?

**A:** There are two patterns.
1. **dotfiles repository** -- For rebuilding personal development environments. Common toolset across all machines.
2. **Project repository** -- Describe only the tools all team members need. Call `brew bundle install` from `scripts/setup.sh`.

### Q4: When should pnpm's shamefully-hoist be used?

**A:** Basically, it should not be used. `shamefully-hoist=true` creates a flat node_modules like npm and allows phantom dependencies. However, it may be unavoidable in the following cases:
- When an old package does not correctly declare its dependencies
- When a specific framework such as React Native requires it
- During the initial stage of a gradual npm → pnpm migration

As an alternative, it is better to hoist only specific packages using `public-hoist-pattern`.

```
# .npmrc
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
```

### Q5: Should Cargo.lock be committed even for library projects?

**A:** Yes, committing Cargo.lock is recommended even for library projects (per a change in Rust's official guidelines). However, since library consumers use their own Cargo.lock, the library's Cargo.lock is only used for reproducibility during development.

### Q6: What is the difference between npm ci and npm install?

**A:** The main differences are as follows.

| | npm install | npm ci |
|---|---|---|
| Lock file | May be updated | Strictly followed (error on mismatch) |
| node_modules | Incremental update | Deleted and recreated |
| Speed | Fast (incremental only) | Slow (always clean) |
| Use case | Adding/updating during development | CI / clean install |

Always use `npm ci` in CI (or `pnpm install --frozen-lockfile` for pnpm). `npm install` is sufficient during development.

### Q7: For Python, should requirements.txt or pyproject.toml be used?

**A:** pyproject.toml is recommended for new projects. It is a format standardized in PEP 621, and all major tools including uv / Poetry / Flit / Hatch fully support it. requirements.txt should continue to be used in the following cases:
- Compatibility with legacy projects
- Integration with Docker's `pip install -r requirements.txt`
- When hash verification (`--require-hashes`) is needed

The most reproducible approach is to generate `requirements.txt` from `pyproject.toml` using uv or pip-compile.

### Q8: How should a package manager migration be approached?

**A:** A gradual approach is recommended.
1. **Research**: Confirm there are no compatibility issues with the current dependencies
2. **Verify on a branch**: Confirm that CI passes on a migration branch
3. **Convert lock file**: Convert the existing lock file using `pnpm import` etc.
4. **Notify the team**: Decide on a migration date and inform everyone
5. **Switch all at once**: Delete the old lock file after merging
6. **Configure Corepack**: Prevent use of the wrong package manager

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 12. Summary

| Ecosystem | Recommended tool | Lock file | Notes |
|-----------|-----------------|-----------|-------|
| Node.js | pnpm | pnpm-lock.yaml | Best disk efficiency |
| Node.js (simple) | npm | package-lock.json | No additional install needed |
| Node.js (Zero-Installs) | yarn (PnP) | yarn.lock | Faster CI |
| Python | uv | uv.lock | Ultra-fast, next-generation |
| Python (existing) | Poetry | poetry.lock | Mature ecosystem |
| Python (minimal) | pip + pip-tools | requirements.txt | Standard library only |
| Rust | Cargo | Cargo.lock | The one official option |
| macOS tools | Homebrew | Brewfile.lock.json | Unify team with Brewfile |

### 5 Principles of Package Management

```
1. Always commit lock files
   → Builds without reproducibility cannot be trusted

2. Perform clean installs in CI
   → npm ci / pnpm install --frozen-lockfile

3. Avoid global installs
   → devDependencies + npx / pnpm exec

4. Unify the entire team on one package manager
   → Enforce with Corepack + packageManager field

5. Update dependencies in a planned manner
   → Auto-PR with Renovate / Dependabot + human review
```

---

## What to Read Next

- [02-monorepo-setup.md](./02-monorepo-setup.md) -- Leveraging workspaces in monorepos
- [03-linter-formatter.md](./03-linter-formatter.md) -- Linter/Formatter configuration
- [00-version-managers.md](./00-version-managers.md) -- Runtime version management

---

## References

1. **pnpm Documentation** -- https://pnpm.io/ja/ -- Official pnpm documentation (Japanese).
2. **uv Documentation** -- https://docs.astral.sh/uv/ -- Official uv documentation. Includes pip comparison benchmarks.
3. **Corepack Documentation** -- https://nodejs.org/api/corepack.html -- Official Node.js Corepack explanation.
4. **Homebrew Bundle** -- https://github.com/Homebrew/homebrew-bundle -- Brewfile specification and usage.
5. **Yarn Berry** -- https://yarnpkg.com/ -- Official Yarn v4 documentation. Detailed PnP explanation.
6. **npm Documentation** -- https://docs.npmjs.com/ -- Official npm documentation. Explanation of security features.
7. **Cargo Book** -- https://doc.rust-lang.org/cargo/ -- Official Cargo documentation. Details on workspaces.
8. **Poetry Documentation** -- https://python-poetry.org/docs/ -- Official Poetry documentation.
9. **Turborepo** -- https://turbo.build/ -- Official Turborepo. Build system for monorepos.
10. **Socket.dev** -- https://socket.dev/ -- Supply chain security. npm package safety analysis.
