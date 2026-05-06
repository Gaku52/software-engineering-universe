# Monorepo Setup

> A practical guide to building monorepos using Turborepo, Nx, and pnpm workspaces. Maximize development efficiency with build caching and task orchestration.

## What You Will Learn

1. Monorepo benefits, design patterns, and how to choose the right tools
2. Building a monorepo environment with pnpm workspaces + Turborepo
3. Accelerating CI with build caching and remote caching
4. Advanced Nx features (affected analysis, code generation, plugin ecosystem)
5. Shared package design patterns and versioning strategies
6. Operational know-how and troubleshooting for large-scale monorepos


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Package Managers](./01-package-managers.md)

---

## 1. What is a Monorepo?

### 1.1 Monorepo vs Polyrepo

| Aspect | Monorepo | Polyrepo |
|--------|----------|----------|
| Number of repositories | 1 | One per package |
| Code sharing | Easy | Requires npm publish |
| Dependency management | Centralized | Managed individually |
| CI/CD | Global optimization possible | Configured per repo |
| Code review | Cross-cutting changes in 1 PR | Multiple PRs required |
| Scalability | Requires tooling support | Scales naturally |
| Initial setup cost | High | Low |
| Refactoring | Can update all packages at once | Each repo handled separately |
| Version management | Can be managed uniformly | Independent per repo |
| Testing | Integration tests are easier | Cross-service tests are difficult |

### 1.2 When a Monorepo is a Good Fit

```
Monorepo adoption decision flowchart:

  Check project characteristics:

  Q1: Do you frequently share code between packages?
      │
      ├── Yes → Suits monorepo
      │
      └── No ─→ Q2: Does the team operate on the same release cycle?
                    │
                    ├── Yes → Suits monorepo
                    │
                    └── No ─→ Q3: Are cross-cutting refactors frequent?
                                  │
                                  ├── Yes → Suits monorepo
                                  │
                                  └── No ─→ Polyrepo is more appropriate

  Cases where monorepo is especially effective:
  ┌─────────────────────────────────────────────┐
  │ - Frontend + backend + shared libraries     │
  │ - Micro-frontend architecture               │
  │ - Design system + consuming applications   │
  │ - Unified management of internal tools     │
  │ - Need to share type definitions/validation│
  └─────────────────────────────────────────────┘

  Cases where polyrepo is more appropriate:
  ┌─────────────────────────────────────────────┐
  │ - Completely independent services           │
  │ - Different teams/organizations as owners  │
  │ - Mixed languages and runtimes             │
  │ - Developing public npm packages           │
  │ - Need independent deployment cycles       │
  └─────────────────────────────────────────────┘
```

### 1.3 Monorepo Structure

```
Typical monorepo structure:

my-monorepo/
├── package.json              # Root (workspace definition)
├── pnpm-workspace.yaml       # pnpm workspace config
├── turbo.json                # Turborepo config
├── .npmrc                    # pnpm config
├── .node-version             # Node.js version pin
├── .gitignore                # Git ignore config
├── tsconfig.json             # Root TypeScript config
│
├── apps/                     # Application layer
│   ├── web/                  # Next.js frontend
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app/          # App Router
│   │       ├── components/   # Page-specific components
│   │       └── lib/          # Utilities
│   ├── api/                  # Express / Hono backend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── routes/
│   │       ├── middleware/
│   │       └── index.ts
│   ├── admin/                # Admin panel (separate Next.js)
│   │   ├── package.json
│   │   └── src/
│   └── mobile/               # React Native
│       ├── package.json
│       └── src/
│
├── packages/                 # Shared package layer
│   ├── ui/                   # Shared UI components
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── components/
│   │       │   ├── Button.tsx
│   │       │   ├── Input.tsx
│   │       │   └── Modal.tsx
│   │       └── index.ts
│   ├── config/               # Shared config (ESLint, TS)
│   │   ├── package.json
│   │   ├── eslint/
│   │   ├── tsconfig/
│   │   └── tailwind/
│   ├── utils/                # Shared utilities
│   │   ├── package.json
│   │   └── src/
│   │       ├── date.ts
│   │       ├── format.ts
│   │       └── validate.ts
│   ├── types/                # Shared type definitions
│   │   ├── package.json
│   │   └── src/
│   │       ├── api.ts
│   │       ├── database.ts
│   │       └── user.ts
│   ├── database/             # DB client (Prisma/Drizzle)
│   │   ├── package.json
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── client.ts
│   │       └── index.ts
│   └── auth/                 # Shared auth logic
│       ├── package.json
│       └── src/
│
└── tooling/                  # Build tool config
    ├── eslint/
    │   └── package.json
    ├── typescript/
    │   └── package.json
    └── tailwind/
        └── package.json
```

### 1.4 Dependency Graph

```
Inter-package dependencies:

  apps/web ──→ packages/ui ──→ packages/types
     │              │
     │              └──→ packages/utils
     │
     └──→ packages/utils ──→ packages/types
     │
     └──→ packages/types
     │
     └──→ packages/database ──→ packages/types
     │
     └──→ packages/auth ──→ packages/database
                           ──→ packages/types

  apps/api ──→ packages/utils ──→ packages/types
     │
     └──→ packages/types
     │
     └──→ packages/database ──→ packages/types
     │
     └──→ packages/auth

  apps/admin ──→ packages/ui ──→ packages/types
     │                          ──→ packages/utils
     └──→ packages/auth

  Build order (resolved automatically by Turborepo):
  1. packages/types     (no dependencies)
  2. packages/utils     (depends on types)
  3. packages/database  (depends on types)
  4. packages/ui        (depends on types, utils)
  5. packages/auth      (depends on database, types)
  6. apps/web, apps/api, apps/admin (can run in parallel)

  Key principles:
  - Dependencies between packages are one-directional only (no cycles)
  - apps → packages references are allowed
  - packages → apps references are forbidden
  - packages must maintain a DAG (directed acyclic graph)
```

---

## 2. pnpm Workspaces

### 2.1 Basic Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

```ini
# .npmrc (pnpm behavior settings)
# Strict dependency resolution (prevents phantom dependencies)
strict-peer-dependencies=false
# Hoisting control
shamefully-hoist=false
# Prevent automatic lockfile updates
frozen-lockfile=false
# Link protocol
link-workspace-packages=true
# Package import method (hardlink is fastest)
package-import-method=hardlink
# Parallel install count
network-concurrency=16
```

```jsonc
// Root package.json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@9.1.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "clean": "turbo clean",
    "typecheck": "turbo typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\"",
    "db:migrate": "pnpm --filter @repo/database migrate",
    "db:seed": "pnpm --filter @repo/database seed",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "turbo build --filter='./packages/*' && changeset publish"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.2.0",
    "@changesets/cli": "^2.27.0"
  }
}
```

### 2.2 Referencing Internal Packages

```jsonc
// packages/types/package.json
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./api": {
      "types": "./src/api.ts",
      "default": "./src/api.ts"
    },
    "./database": {
      "types": "./src/database.ts",
      "default": "./src/database.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}

// packages/ui/package.json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./button": "./src/components/Button.tsx",
    "./input": "./src/components/Input.tsx",
    "./modal": "./src/components/Modal.tsx"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/types": "workspace:*",
    "@repo/utils": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0"
  },
  "peerDependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  }
}

// packages/utils/package.json
{
  "name": "@repo/utils",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./date": "./src/date.ts",
    "./format": "./src/format.ts",
    "./validate": "./src/validate.ts"
  },
  "dependencies": {
    "@repo/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}

// apps/web/package.json
{
  "name": "@repo/web",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/utils": "workspace:*",
    "@repo/types": "workspace:*",
    "@repo/auth": "workspace:*",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "typescript": "^5.4.0"
  }
}
```

### 2.3 pnpm Commands

```bash
# ─── Add dependency to all packages (root) ───
pnpm add -Dw turbo prettier

# ─── Add dependency to a specific package ───
pnpm --filter @repo/web add next
pnpm --filter @repo/api add express
pnpm --filter @repo/ui add -D tsup

# ─── Filter execution ───
pnpm --filter @repo/web dev           # dev for web only
pnpm --filter "./apps/*" build        # build all under apps/
pnpm --filter @repo/ui... build       # build ui and its dependencies
pnpm --filter ...@repo/web build      # build all dependents of web
pnpm --filter "@repo/*" lint          # lint all @repo scopes

# ─── Only changed packages ───
pnpm --filter "...[origin/main]" build  # packages changed since main

# ─── Operations on all packages ───
pnpm -r exec -- rm -rf node_modules dist .next  # clean all
pnpm install                                     # reinstall
pnpm -r list --depth 0                           # list dependencies for all packages

# ─── Workspace info ───
pnpm ls -r --json                     # all package info (JSON)
pnpm why react                        # where react is used
```

### 2.4 pnpm Dependency Resolution Mechanism

```
pnpm store structure (content-addressable storage):

  ~/.pnpm-store/                         # Global store
  └── v3/
      └── files/
          └── {hash}/                    # Unique hash-based key
              ├── node_modules/
              │   └── react/
              │       ├── index.js
              │       └── package.json
              └── ...

  Inside the project:
  node_modules/
  ├── .pnpm/                            # Flat storage of actual files
  │   ├── react@18.3.0/
  │   │   └── node_modules/
  │   │       └── react/  → hard link to store
  │   ├── next@14.2.0/
  │   │   └── node_modules/
  │   │       ├── next/   → hard link to store
  │   │       └── react/  → symlink to .pnpm/react@18.3.0
  │   └── ...
  ├── react  → .pnpm/react@18.3.0/node_modules/react (symlink)
  └── next   → .pnpm/next@14.2.0/node_modules/next (symlink)

  Benefits:
  1. Significant reduction in disk usage (hard links mean only one copy)
  2. Prevention of phantom dependencies (undeclared packages are invisible)
  3. Same package versions shared across workspace packages
  4. Faster installs (instant linking if already downloaded)
```

### 2.5 Pinning Package Manager Version with Corepack

```bash
# Enable Corepack
corepack enable

# Pin the package manager version
corepack use pnpm@9.1.0

# This adds the following to package.json:
# "packageManager": "pnpm@9.1.0"

# Attempting to install with a different pnpm version results in an error:
# This project is configured to use pnpm@9.1.0.
# Please install the correct version.
```

```jsonc
// .node-version (Node.js version pin)
// Referenced by fnm / nvm / volta
// 20.12.0
```

---

## 3. Turborepo

### 3.1 Configuration

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "**/.env.*local",
    ".env"
  ],
  "globalEnv": [
    "CI",
    "NODE_ENV"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json", "package.json"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "env": ["NODE_ENV", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "eslint.config.*", "biome.json"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tests/**", "vitest.config.*", "__tests__/**"],
      "outputs": ["coverage/**"],
      "env": ["DATABASE_URL", "TEST_DATABASE_URL"]
    },
    "test:watch": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    },
    "clean": {
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json", "tsconfig.*.json"],
      "outputs": []
    },
    "db:migrate": {
      "cache": false,
      "env": ["DATABASE_URL"]
    },
    "db:seed": {
      "cache": false,
      "dependsOn": ["db:migrate"]
    }
  }
}
```

### 3.2 Turborepo Caching Mechanism

```
Turborepo cache flow:

  When turbo build runs:

  ┌──────────────────────────────────────┐
  │  1. Compute task hash                │
  │     Inputs: source files             │
  │             environment variables    │
  │             dependency hashes        │
  │             turbo.json settings      │
  │             lockfile contents        │
  │                                      │
  │  2. Check cache                      │
  │     .turbo/cache/{hash}/             │
  │                                      │
  │  ┌─── Cache HIT ────┐                │
  │  │ Restore outputs   │                │
  │  │ (dist/, .next/)   │                │
  │  │ → Skip build      │                │
  │  │ → Done in ms      │                │
  │  └──────────────────┘                │
  │                                      │
  │  ┌─── Cache MISS ───┐                │
  │  │ Run build         │                │
  │  │ Cache outputs     │                │
  │  │ → HIT next time   │                │
  │  └──────────────────┘                │
  └──────────────────────────────────────┘

  Hash computation details:
  ┌─────────────────────────────────────────────┐
  │ hash = SHA256(                               │
  │   source file contents,                      │
  │   turbo.json inputs config,                  │
  │   environment variable values (listed in env)│
  │   dependency build hashes (^build),          │
  │   relevant lockfile sections,                │
  │   .env files (globalDependencies),           │
  │ )                                            │
  │                                              │
  │ Change detected: any of the above differs → MISS │
  │ No change: all identical → HIT              │
  └─────────────────────────────────────────────┘
```

### 3.3 Remote Cache

```bash
# Vercel remote cache (free)
npx turbo login
npx turbo link

# Self-hosted cache server (ducktape, turborepo-remote-cache)
# Add to turbo.json:
# {
#   "remoteCache": {
#     "signature": true,
#     "enabled": true
#   }
# }

# Configure via environment variables
export TURBO_TOKEN=your-token
export TURBO_TEAM=your-team
export TURBO_API=https://your-cache-server.example.com
```

```
Effect of remote cache:

  Developer A: turbo build
  ├── packages/types  → build (5s) → cache saved ↑
  ├── packages/utils  → build (8s) → cache saved ↑
  ├── packages/ui     → build (12s) → cache saved ↑
  └── apps/web        → build (30s) → cache saved ↑
  Total: 55 seconds

  Developer B (same commit): turbo build
  ├── packages/types  → remote cache HIT (0.1s) ↓
  ├── packages/utils  → remote cache HIT (0.1s) ↓
  ├── packages/ui     → remote cache HIT (0.2s) ↓
  └── apps/web        → remote cache HIT (0.5s) ↓
  Total: 0.9 seconds (98% reduction)

  CI: turbo build
  ├── Developer already built → all HIT
  Total: under 1 second

  Monthly impact (5-person team, 10 builds/day):
  ┌────────────────────────────────────────────────────┐
  │ No cache: 55s × 10 runs × 5 people × 22 days = 1,683 min/month │
  │ With cache: mostly HIT → approx. 30 min/month                   │
  │ Reduction: approx. 98%                                          │
  └────────────────────────────────────────────────────┘
```

### 3.4 Advanced Turborepo Features

```bash
# ─── Visualize task graph ───
turbo build --graph              # Generate task dependency graph
turbo build --graph=graph.svg    # Output as SVG
turbo build --graph=graph.html   # Output as HTML

# ─── Dry run (see what would execute) ───
turbo build --dry-run
turbo build --dry-run=json       # Output as JSON

# ─── Filtering ───
turbo build --filter=@repo/web                # Specific package
turbo build --filter=@repo/web...             # web and its dependencies
turbo build --filter=...@repo/web             # packages that depend on web
turbo build --filter="[HEAD~1]"               # changed since last commit
turbo build --filter="[origin/main...HEAD]"   # changed since main

# ─── Concurrency control ───
turbo build --concurrency=50%    # Use half of CPUs
turbo build --concurrency=4      # Max 4 parallel
turbo build --concurrency=1      # Sequential (for debugging)

# ─── Cache operations ───
turbo build --force              # Ignore cache and rebuild
turbo build --no-cache           # Do not save to cache
turbo prune --scope=@repo/web    # Generate slim monorepo for web only
```

### 3.5 Deploy Optimization with turbo prune

```bash
# Exclude unnecessary packages during Docker builds
turbo prune --scope=@repo/web --docker

# The following structure is generated in out/:
# out/
# ├── json/                    # package.json only (for dependency resolution)
# │   ├── package.json
# │   ├── apps/web/package.json
# │   ├── packages/ui/package.json
# │   └── packages/types/package.json
# ├── full/                    # Full version including source code
# │   ├── apps/web/
# │   ├── packages/ui/
# │   └── packages/types/
# ├── pnpm-lock.yaml          # Lockfile with only required dependencies
# └── pnpm-workspace.yaml
```

```dockerfile
# Dockerfile (combined with turbo prune)
FROM node:20-slim AS base
RUN corepack enable

# Step 1: Extract only necessary packages with prune
FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune --scope=@repo/web --docker

# Step 2: Install dependencies (copy package.json only to leverage cache)
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# Step 3: Build
FROM base AS builder
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN turbo build --filter=@repo/web

# Step 4: Production image
FROM node:20-slim AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
CMD ["node", "apps/web/server.js"]
```

---

## 4. Nx

### 4.1 Basic Configuration

```bash
# ─── Create a new monorepo ───
npx create-nx-workspace@latest my-monorepo
# → Select package manager: pnpm
# → Select type: integrated / package-based

# ─── Add to an existing repo ───
npx nx@latest init
```

```jsonc
// nx.json
{
  "$schema": "https://nx.dev/reference/nx-json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "cache": true
    },
    "test": {
      "inputs": ["default", "^production"],
      "cache": true
    },
    "lint": {
      "inputs": ["default", "{workspaceRoot}/.eslintrc.json"],
      "cache": true
    },
    "e2e": {
      "inputs": ["default", "^production"],
      "cache": true
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.*",
      "!{projectRoot}/**/*.test.*",
      "!{projectRoot}/test/**/*",
      "!{projectRoot}/.eslintrc.json"
    ],
    "sharedGlobals": [
      "{workspaceRoot}/tsconfig.base.json",
      "{workspaceRoot}/.eslintrc.json"
    ]
  },
  "defaultBase": "main",
  "plugins": [
    "@nx/next/plugin",
    "@nx/eslint/plugin",
    "@nx/vite/plugin"
  ]
}
```

### 4.2 Advanced Nx Features

```bash
# ─── Affected analysis ───
# Build/test only packages changed since the main branch
nx affected -t build
nx affected -t test
nx affected -t lint

# ─── Dependency graph visualization ───
nx graph                         # Interactive display in browser
nx graph --file=graph.json       # Output as JSON
nx affected:graph                # Highlight affected scope

# ─── Code generation (Generator) ───
nx generate @nx/react:component Button --project=ui
nx generate @nx/next:page about --project=web
nx generate @nx/node:application api

# ─── Migration ───
nx migrate latest                # Automatically update dependencies
nx migrate --run-migrations      # Run migration scripts

# ─── Task execution ───
nx run web:build                 # Single task
nx run-many -t build test lint   # Multiple tasks across all projects
nx run-many -t build --projects=web,api  # Specific projects only
```

### 4.3 Nx Cloud (Remote Cache)

```bash
# Connect to Nx Cloud
npx nx connect-to-nx-cloud

# Usage in CI
# Automatically added to nx.json:
# "nxCloud": "access-token-here"

# Distributed Task Execution (DTE)
# Distribute tasks across multiple machines in CI
# - Agent machines receive and execute tasks
# - Results saved to cache
# - Main machine aggregates results
```

### 4.4 Turborepo vs Nx Comparison

| Feature | Turborepo | Nx |
|---------|-----------|-----|
| Design philosophy | Simple and lightweight | Full-featured, integrated |
| Config files | turbo.json only | nx.json + project.json |
| Caching | Local + remote | Local + Nx Cloud |
| Dependency graph visualization | `turbo --graph` (static) | `nx graph` (interactive) |
| Code generation | None | `nx generate` (rich) |
| Affected analysis | `turbo --filter=[...]` | `nx affected` (high precision) |
| Plugins | None | Rich (React, Next, Node, etc.) |
| Distributed execution | None | Nx Cloud DTE |
| Migration | None | `nx migrate` (auto-update) |
| Learning curve | Low | Medium to high |
| Recommended scale | Small to medium (2–20 packages) | Medium to large (10–500+ packages) |
| Vercel integration | Native | Plugin |
| Performance | Rust-based (fast) | Node.js + Rust (task hashing) |

---

## 5. Shared Configuration Packages

### 5.1 Sharing TypeScript Configuration

```jsonc
// packages/config/tsconfig/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "verbatimModuleSyntax": true
  }
}

// packages/config/tsconfig/react.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}

// packages/config/tsconfig/nextjs.json
{
  "extends": "./react.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "incremental": true
  }
}

// packages/config/tsconfig/node.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"]
  }
}

// apps/web/tsconfig.json (consumer side)
{
  "extends": "@repo/config/tsconfig/nextjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 5.2 Sharing ESLint Configuration

```javascript
// packages/config/eslint/base.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // ─── Type safety ───
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // ─── Import order ───
      "import/order": ["error", {
        "groups": [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling", "index"],
        ],
        "newlines-between": "always",
        "alphabetize": { "order": "asc" },
      }],
      "import/no-duplicates": "error",

      // ─── Code quality ───
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
    },
  },
];

// packages/config/eslint/react.js
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import baseConfig from "./base.js";

export default [
  ...baseConfig,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
    },
    settings: {
      react: { version: "detect" },
    },
  },
];

// packages/config/eslint/next.js
import nextPlugin from "@next/eslint-plugin-next";
import reactConfig from "./react.js";

export default [
  ...reactConfig,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];

// apps/web/eslint.config.js (consumer side)
import nextConfig from "@repo/config/eslint/next.js";

export default [
  ...nextConfig,
  {
    ignores: [".next/", "dist/"],
  },
];
```

### 5.3 Sharing Tailwind CSS Configuration

```javascript
// packages/config/tailwind/base.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a5f",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [],
};

// apps/web/tailwind.config.js
import baseConfig from "@repo/config/tailwind/base.js";

/** @type {import('tailwindcss').Config} */
export default {
  ...baseConfig,
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};
```

### 5.4 Sharing Prettier Configuration

```jsonc
// packages/config/prettier/index.json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}

// apps/web/.prettierrc (consumer side)
// Reference "@repo/config/prettier" directly
// Add the following to package.json:
// "prettier": "@repo/config/prettier"
```

---

## 6. Versioning and Releases

### 6.1 Version Management with Changesets

```bash
# Setup
pnpm add -Dw @changesets/cli
pnpm changeset init

# Record a change
pnpm changeset
# → Select packages
# → Select version type (major / minor / patch)
# → Describe the change
```

```yaml
# .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@repo/web", "@repo/api"]
}
```

```
Changesets workflow:

  1. Developer implements changes
  2. Create a changeset with pnpm changeset
     → .changeset/random-name.md is generated

  3. Merge the PR

  4. CI runs pnpm changeset version
     → Updates version in package.json
     → Updates CHANGELOG.md
     → Deletes changeset files

  5. CI runs pnpm changeset publish
     → Publishes to npm (for non-private packages)

  Automation example (GitHub Actions + Changesets Bot):
  - On PR creation: Bot automatically creates a "Version Packages" PR
  - On merge: Automatically updates version + npm publish
```

### 6.2 Automated Release with GitHub Actions

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
          version: pnpm version-packages
          commit: "chore: release packages"
          title: "chore: release packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 7. CI/CD Configuration

### 7.1 GitHub Actions (Turborepo)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Required for turbo diff detection

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # Turborepo remote cache
      - name: Build, Lint, Test, Typecheck
        run: pnpm turbo build lint test typecheck
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}

  # PR only: check only changed packages
  affected:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Check affected packages
        run: |
          pnpm turbo build --filter="[origin/main...HEAD]" --dry-run=json \
            | jq '.tasks | map(.package) | unique'
```

### 7.2 GitHub Actions (Nx)

```yaml
# .github/workflows/ci-nx.yml
name: CI (Nx)
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      # Set SHAs (baseline for affected)
      - uses: nrwl/nx-set-shas@v4

      # Build/test only affected scope
      - run: npx nx affected -t build test lint typecheck
```

---

## 8. Anti-Patterns

### 8.1 Putting All Dependencies in the Root

```
❌ Anti-pattern: Consolidating all dependencies in root package.json

  package.json (root):
    "dependencies": {
      "react": "^18.3.0",
      "express": "^4.18.0",
      "next": "^14.2.0",
      ...all dependencies
    }

Problems:
  - It is unclear which package depends on what
  - Unnecessary dependencies get installed
  - Impact scope of version updates is unknown
  - All dependencies are installed during Docker builds
  - CI cache efficiency degrades

✅ Correct approach:
  - List only required dependencies in each package's package.json
  - Only tooling like turbo and prettier in the root
  - Rely on pnpm's strict dependency resolution
  - Consolidate common devDependencies in packages/config
```

### 8.2 Creating Circular Dependencies Between Packages

```
❌ Anti-pattern: Circular references between packages

  @repo/ui → @repo/utils → @repo/ui  (circular!)

Problems:
  - Build order cannot be determined
  - TypeScript type resolution loops infinitely
  - Turborepo/Nx caching breaks
  - Hot reload breaks

✅ Correct approach:
  - Extract shared parts into a separate package
  - @repo/ui → @repo/shared ← @repo/utils
  - Regularly check dependency graph with nx graph / turbo --graph
  - Automate circular dependency checks in CI:
    pnpm ls -r --json | node scripts/check-circular.js
```

### 8.3 Using Version Ranges for Internal Packages

```
❌ Anti-pattern: Using ^, ~ for workspace packages

  "dependencies": {
    "@repo/ui": "^1.0.0"    // ← Looks up npm registry
  }

Problems:
  - References the npm package instead of the local one
  - Build errors due to version mismatch
  - Network access occurs during pnpm install

✅ Correct approach:
  - Use the workspace: protocol
  "dependencies": {
    "@repo/ui": "workspace:*"   // Always references local
    "@repo/utils": "workspace:^" // Converts to ^ on publish
  }
```

### 8.4 Using a Single tsconfig.json for the Entire Monorepo

```
❌ Anti-pattern: One tsconfig.json covering all packages

  tsconfig.json (root):
    "include": ["apps/**/*", "packages/**/*"]

Problems:
  - Type checking spans all packages, making it extremely slow
  - Cannot customize settings per package
  - IDE IntelliSense becomes slow

✅ Correct approach:
  - Place tsconfig.json in each package
  - Manage shared config in packages/config/tsconfig/
  - Use references (Project References) for explicit referencing
```

### 8.5 Sharing a Test Database

```
❌ Anti-pattern: All apps share the same test DB

Problems:
  - Data conflicts during parallel tests
  - Test order dependencies
  - Flaky tests in CI

✅ Correct approach:
  - Independent test DB per package
  - Roll back with transactions per test
  - Start separate DB containers for testing with Docker Compose
```

---

## 9. Troubleshooting

### 9.1 Common Issues and Solutions

```
Issue: Many type errors appear after pnpm install

Cause: TypeScript Project References are not configured correctly
Solution:
  1. Add "composite": true to each package's tsconfig.json
  2. Add references to the dependent package's tsconfig.json
  3. Build dependency packages first with turbo build

---

Issue: Hot reload does not work with turbo dev

Cause: Changes in internal packages are not being detected
Solution:
  1. Verify that internal package exports point directly to source
     "exports": { ".": "./src/index.ts" }  // ✅ Direct source reference
     "exports": { ".": "./dist/index.js" } // ❌ References built output
  2. For Next.js, add transpilePackages to next.config.js
     transpilePackages: ["@repo/ui", "@repo/utils"]
  3. For Vite, add to optimizeDeps.include

---

Issue: Builds in CI are extremely slow

Cause: Cache is not being used
Solution:
  1. Verify TURBO_TOKEN / TURBO_TEAM are configured correctly
  2. Check that inputs / outputs in turbo.json are appropriate
  3. Check for unnecessary environment variables in env
     (cache is invalidated when environment variables change)
  4. Configure pnpm install cache (actions/cache)

---

Issue: Runtime errors due to phantom dependencies in node_modules

Cause: Using a package not declared in package.json
Solution:
  1. Set strict-peer-dependencies=true in .npmrc
  2. Confirm shamefully-hoist=false (true allows hoisted packages to be seen)
  3. Check each package's dependencies with pnpm ls --depth 0
  4. Explicitly add required dependencies to package.json
```

### 9.2 Performance Optimization Checklist

```
Monorepo performance optimization:

□ Is pnpm package-import-method set to hardlink?
□ Are turbo.json inputs sufficiently scoped?
□ Are there no unnecessary directories in outputs?
□ Is remote cache configured?
□ Is fetch-depth in CI minimized?
□ Are TypeScript composite and incremental enabled?
□ Is Next.js standalone output being used?
□ Are node_modules volume-mounted in Docker?
□ Are unnecessary devDependencies excluded from production builds?
□ Is ESLint type-checking integration (recommendedTypeChecked) enabled only in CI?
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

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
            raise ValueError("入力値がNoneです")
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
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Applied Patterns

Extend the basic implementation by adding the following features.

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
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## 10. FAQ

### Q1: Which should I choose, Turborepo or Nx?

**A:** Use the following criteria to decide.
- **Turborepo**: Fewer than 10 packages, goal is simple caching and task execution, want minimal configuration. Works well with the Vercel ecosystem (Next.js). Single execution speed is also fast due to Rust implementation.
- **Nx**: Large-scale projects with many packages, need code generation or affected analysis, want to leverage the plugin ecosystem. If distributed task execution (DTE) is required, Nx Cloud is the only option.

When in doubt, start with Turborepo and migrate to Nx as needed for lower risk. Migrating from Nx to Turborepo reduces configuration and is relatively straightforward, but migration cost is high if Nx-specific features like Generators are in use.

### Q2: What can I do if git clone is slow for a monorepo?

**A:** The following approaches are available.
1. Shallow clone with `git clone --depth 1`
2. Partial clone with `git clone --filter=blob:none` (file contents downloaded on demand)
3. Treeless clone with `git clone --filter=tree:0` (directory structure also lazy-loaded)
4. In GitHub Actions, specify the minimum necessary depth instead of `fetch-depth: 0`
5. If there are large files using Git LFS, use `git lfs install --skip-smudge`
6. For very large repos, use `git sparse-checkout` to check out only the required directories

```bash
# Example of sparse-checkout
git clone --filter=blob:none --sparse https://github.com/org/monorepo.git
cd monorepo
git sparse-checkout set apps/web packages/ui packages/types
```

### Q3: Should internal packages be built or referenced directly from source?

**A:** There are two approaches.

| Approach | Benefits | Drawbacks |
|----------|----------|-----------|
| **Build approach** (`tsc` → `dist/`) | Higher type safety, faster builds on the consumer side | Requires a build step, watch is complex |
| **Source reference approach** (direct `src/index.ts`) | No build needed, HMR is faster | Consumer must transpile |

For small to medium scale, the source reference approach is simpler. For large scale, the build approach gives more stable CI. A hybrid approach is also possible: source reference during development, bundle with `tsup` for CI/production builds.

### Q4: What is the difference between pnpm workspaces and yarn workspaces?

**A:** The main differences are as follows.
- **pnpm**: High disk efficiency with content-addressable storage, strict dependency resolution prevents phantom dependencies, fast installs via hard links.
- **yarn (v4 Berry)**: Zero-install possible with PnP (Plug'n'Play), plugin extension via `.yarnrc.yml`, run packages with `yarn dlx`.

As of 2025, pnpm is the de facto standard for monorepos. It is especially recommended in combination with Turborepo.

### Q5: How do I optimize Docker builds in a monorepo?

**A:** Using `turbo prune` is the best approach. This generates a slim monorepo containing only the specific application and its dependency packages. Use the `--docker` flag to separate `json/` (package.json only) and `full/` (including source) to maximize Docker `COPY` layer caching, separating the dependency install layer from the source copy layer.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Rather than just theory, your understanding deepens when you write actual code and verify how it works.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the core concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Component | Recommendation | Notes |
|-----------|---------------|-------|
| Package manager | pnpm | Optimal for workspaces, disk efficiency |
| Task runner (small to medium) | Turborepo | Simple and fast, Rust-based |
| Task runner (large scale) | Nx | Affected analysis, generators, DTE |
| Config sharing | `packages/config/` | ESLint, TS, Tailwind, Prettier |
| CI cache | Turborepo Remote Cache | Free tier available on Vercel |
| Package reference | `workspace:*` | Internal package management |
| Version pinning | Corepack | packageManager field |
| Versioning | Changesets | Version management for published packages |
| Deploy optimization | `turbo prune --docker` | Leverage Docker layer cache |
| Dependency graph monitoring | `turbo --graph` / `nx graph` | Early detection of circular dependencies |

---

## What to Read Next

- [01-package-managers.md](./01-package-managers.md) -- Package manager details
- [03-linter-formatter.md](./03-linter-formatter.md) -- Sharing Linter/Formatter config in a monorepo
- [../03-team-setup/00-project-standards.md](../03-team-setup/00-project-standards.md) -- Team standards configuration

---

## References

1. **Turborepo Handbook** -- https://turbo.build/repo/docs/handbook -- Official Turborepo handbook with design pattern explanations.
2. **Nx Documentation** -- https://nx.dev/getting-started/intro -- Official Nx introductory guide.
3. **pnpm Workspaces** -- https://pnpm.io/workspaces -- Official pnpm workspaces documentation.
4. **Monorepo Tools** -- https://monorepo.tools/ -- Monorepo tool comparison site with objective benchmarks.
5. **Changesets** -- https://github.com/changesets/changesets -- Versioning and changelog management tool for monorepos.
6. **turbo prune** -- https://turbo.build/repo/docs/reference/prune -- The prune feature for Docker build optimization.
7. **Nx Cloud** -- https://nx.app/ -- Nx remote cache and distributed task execution service.
