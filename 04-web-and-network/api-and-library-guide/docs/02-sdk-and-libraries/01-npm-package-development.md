# npm Package Development

> Everything you need to know for developing npm packages, from design to publishing. Systematically master all knowledge for professional package development: package.json design, ESM/CJS dual packages, TypeScript configuration, build pipeline, monorepo management, semantic versioning, and publishing workflows.

## What You Will Learn in This Chapter

- [ ] Understand package.json design principles and the details of the exports field
- [ ] Build ESM/CJS dual-package build configuration
- [ ] Grasp type definition generation and publishing patterns in TypeScript
- [ ] Correctly apply semantic versioning decision criteria
- [ ] Practice multi-package management strategies in a monorepo
- [ ] Build an automated publishing workflow integrated with CI/CD
- [ ] Utilize metrics to measure and improve package quality

---

## Prerequisites

- Basic SDK design principles → See: [SDK Design](./00-sdk-design.md)
- Understanding of Node.js module systems (CommonJS/ESM)
- Basic TypeScript type definitions → See: TypeScript Complete Guide

---

## 1. Overview of npm Package Development

Developing an npm package is not simply a matter of writing code and running npm publish. You need to properly manage the entire lifecycle: package design, build, testing, versioning, publishing, and maintenance.

```
npm Package Development Lifecycle:

  +----------+     +----------+     +----------+     +----------+
  |  Design  | --> |  Impl.   | --> |  Build   | --> |  Test    |
  | package  |     | src/     |     | tsup/    |     | vitest/  |
  | .json    |     | TypeScript|    | rollup   |     | jest     |
  +----------+     +----------+     +----------+     +----------+
       ^                                                   |
       |                                                   v
  +----------+     +----------+     +----------+     +----------+
  | Maintain | <-- | Monitor  | <-- | Publish  | <-- | Version  |
  | issue/   |     | download |     | npm      |     | semver   |
  | PR resp. |     | stats    |     | publish  |     |          |
  +----------+     +----------+     +----------+     +----------+

  Estimated time per phase (for a medium-sized package):
    Design:         Hours to days
    Implementation: Days to weeks
    Build setup:    Hours
    Testing:        Ongoing
    Versioning:     Recorded per PR
    Publishing:     Minutes with automation
    Maintenance:    Ongoing
```

### 1.1 Basic Concepts of the npm Registry

The npm registry is the world's largest software registry, with over 2 million packages registered. Here are the fundamental concepts a package publisher should understand.

```
npm Registry Structure:

  +---------------------------+
  |     npm Registry          |
  |  (registry.npmjs.org)     |
  +---------------------------+
  |                           |
  |  Scoped Packages          |
  |  @scope/package-name      |
  |  e.g.: @example/sdk       |
  |                           |
  |  Unscoped Packages        |
  |  package-name             |
  |  e.g.: express            |
  |                           |
  |  Tags (dist-tags):        |
  |    latest  → stable       |
  |    next    → upcoming     |
  |    beta    → beta         |
  |    canary  → canary       |
  |                           |
  +---------------------------+

  Package naming conventions:
    - Up to 214 characters
    - Lowercase only (no uppercase)
    - Hyphens, dots, underscores allowed
    - Scope: @org/name format
    - Beware of similarity to existing package names
      (typosquatting prevention)
```

### 1.2 Package Types and Design Decisions

Before developing a package, clearly define its type and intended usage.

| Package Type | Characteristics | Examples | Dependency Policy |
|-------------|----------------|---------|-------------------|
| Library | General-purpose function collection | lodash, date-fns | Zero dependencies is ideal |
| SDK | API client | @aws-sdk/client-s3 | Minimal dependencies |
| CLI tool | Command-line tool | eslint, prettier | Necessary dependencies allowed |
| Framework | Application foundation | express, fastify | Plugin design |
| Plugin | Extension of existing tools | eslint-plugin-xxx | peerDependencies |
| Type definitions | TypeScript types only | @types/xxx | Zero dependencies |
| Utility | Small helpers | is-odd, left-pad | Zero dependencies |
| Monorepo package | Collection of packages | @babel/xxx | Internal dependencies only |

---

## 2. Complete package.json Design Guide

package.json is the heart of an npm package, defining all information including metadata, dependencies, entry points, scripts, and publishing settings.

### 2.1 Full-spec package.json

```json
{
  "name": "@example/sdk",
  "version": "1.0.0",
  "description": "Official SDK for Example API - Type-safe, zero-dependency client",
  "license": "MIT",
  "author": {
    "name": "Example Team",
    "email": "sdk@example.com",
    "url": "https://example.com"
  },
  "contributors": [
    { "name": "Alice", "email": "alice@example.com" }
  ],

  "type": "module",

  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./users": {
      "import": {
        "types": "./dist/users/index.d.ts",
        "default": "./dist/users/index.js"
      },
      "require": {
        "types": "./dist/users/index.d.cts",
        "default": "./dist/users/index.cjs"
      }
    },
    "./billing": {
      "import": {
        "types": "./dist/billing/index.d.ts",
        "default": "./dist/billing/index.js"
      },
      "require": {
        "types": "./dist/billing/index.d.cts",
        "default": "./dist/billing/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },

  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",

  "typesVersions": {
    "*": {
      "users": ["./dist/users/index.d.ts"],
      "billing": ["./dist/billing/index.d.ts"]
    }
  },

  "files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"],

  "engines": { "node": ">=18.0.0" },
  "os": ["!win32"],
  "cpu": ["x64", "arm64"],

  "sideEffects": false,

  "keywords": ["api", "sdk", "example", "typescript", "rest-client"],
  "repository": {
    "type": "git",
    "url": "https://github.com/example/sdk",
    "directory": "packages/sdk"
  },
  "homepage": "https://example.com/docs/sdk",
  "bugs": {
    "url": "https://github.com/example/sdk/issues",
    "email": "bugs@example.com"
  },
  "funding": {
    "type": "github",
    "url": "https://github.com/sponsors/example"
  },

  "scripts": {
    "build": "tsup",
    "build:watch": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write 'src/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts'",
    "prepublishOnly": "npm run build && npm run test && npm run typecheck",
    "release": "changeset publish",
    "size": "size-limit",
    "clean": "rm -rf dist",
    "prepack": "clean-pkg-json"
  },

  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0",
    "@changesets/cli": "^2.27.0",
    "eslint": "^9.0.0",
    "prettier": "^3.2.0",
    "@size-limit/preset-small-lib": "^11.0.0",
    "size-limit": "^11.0.0",
    "clean-pkg-json": "^1.2.0"
  },

  "peerDependencies": {},
  "peerDependenciesMeta": {},
  "dependencies": {},
  "overrides": {},
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  },
  "size-limit": [
    {
      "path": "dist/index.js",
      "limit": "10 KB"
    }
  ]
}
```

### 2.2 Detailed Explanation of the exports Field

The `exports` field was introduced in Node.js 12.7.0 and is the most important setting for strictly controlling a package's entry points.

```
exports condition resolution flow:

  import { Client } from '@example/sdk'
       |
       v
  Look up exports["."]
       |
       +-- Loading with ESM (import statement)?
       |     |
       |     +-- Matches "import" condition
       |           |
       |           +-- TypeScript? → refer to "types"
       |           |     → ./dist/index.d.ts
       |           |
       |           +-- Runtime → refer to "default"
       |                 → ./dist/index.js
       |
       +-- Loading with CJS (require)?
             |
             +-- Matches "require" condition
                   |
                   +-- TypeScript? → refer to "types"
                   |     → ./dist/index.d.cts
                   |
                   +-- Runtime → refer to "default"
                         → ./dist/index.cjs

  Condition priority order (evaluated top to bottom):
    1. "types"     → TypeScript type resolution
    2. "import"    → ESM environment
    3. "require"   → CJS environment
    4. "node"      → Node.js environment
    5. "browser"   → Browser environment
    6. "default"   → Fallback

  Important: "types" must always be placed first in each condition block
```

#### Subpath Exports Patterns

```json
{
  "exports": {
    ".": "./dist/index.js",

    "./utils": "./dist/utils/index.js",
    "./utils/*": "./dist/utils/*.js",

    "./internal/*": null,

    "./package.json": "./package.json"
  }
}
```

The important thing in designing subpath exports is to prevent direct access to internal modules. By explicitly specifying null as `"./internal/*": null`, imports like `@example/sdk/internal/secret` will result in an error.

### 2.3 Using Dependency Fields Correctly

```
Dependency field decision flowchart:

  This module is...
       |
       +-- Required at runtime?
       |     |
       |     +-- Bundle it in? → dependencies
       |     |
       |     +-- Provided by user? → peerDependencies
       |           |
       |           +-- Works without it? → peerDependenciesMeta
       |                               { "optional": true }
       |
       +-- Only for build/test? → devDependencies
       |
       +-- Distributed bundled? → bundleDependencies
       |
       +-- Alternative package? → optionalDependencies
```

| Field | Purpose | At npm install time | Examples |
|-------|---------|--------------------|---------| 
| dependencies | Required at runtime | Installed | zod, jose |
| devDependencies | Development only | Not installed for users | vitest, tsup, eslint |
| peerDependencies | Provided by user | Auto-installed in npm 7+ | react, vue |
| peerDependenciesMeta | peerDep detailed config | optional settings, etc. | - |
| optionalDependencies | Use if available | Continue on failure | fsevents |
| bundleDependencies | Bundled together | Included in tarball | - |
| overrides | Force version | Override transitive deps | Security fixes |

### 2.4 Best Practices for the scripts Field

npm scripts are the core of automation in package development. Properly utilize lifecycle scripts and custom scripts.

```
npm lifecycle script execution order:

  When running npm publish:
    prepublishOnly → prepare → prepack → postpack → publish → postpublish

  When running npm install (as a dependency):
    preinstall → install → postinstall → prepare

  When running npm test:
    pretest → test → posttest

  Recommended lifecycle scripts:
    "prepare":        Build (auto-runs after git clone)
    "prepublishOnly": Test + type check + build
    "prepack":        package.json cleanup

  Scripts to avoid:
    "postinstall":    Security risk (arbitrary code execution)
    "preinstall":     Same risk
```

---

## 3. Building ESM/CJS Dual Packages

### 3.1 Why Are Dual Packages Necessary?

Node.js has two module systems coexisting: ESM (ECMAScript Modules) and CJS (CommonJS). Even as of 2025, many projects still use CJS environments, and package authors need to provide both formats.

```
History and current state of the Node.js module system:

  2009  Node.js born → CJS (require/module.exports)
  2015  ES2015 spec → ESM spec finalized (import/export)
  2017  Node.js 8   → ESM experimental support (--experimental-modules)
  2019  Node.js 12  → exports field introduced
  2020  Node.js 14  → ESM stable support
  2021  Node.js 16  → package.json "type": "module"
  2023  Node.js 20  → require(esm) experimental support
  2024  Node.js 22  → require(esm) stabilization begins

  Current ecosystem state:
    ESM only:   New frameworks (Nuxt 3, SvelteKit, etc.)
    CJS only:   Legacy projects, some tools
    Dual:       Most widely-used packages
    → Dual support is recommended for package authors
```

### 3.2 Build Configuration with tsup

tsup is an esbuild-based fast bundler and the optimal tool for building ESM/CJS dual packages.

```typescript
// tsup.config.ts - basic configuration
import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: [
    'src/index.ts',
    'src/users/index.ts',
    'src/billing/index.ts',
  ],

  // Output formats
  format: ['esm', 'cjs'],

  // Generate type definition files
  dts: true,

  // Code splitting (only effective for ESM)
  splitting: true,

  // Source maps
  sourcemap: true,

  // Clean dist before build
  clean: true,

  // Minify settings (SDKs should not be minified)
  minify: false,

  // Target environment
  target: 'es2022',

  // Output directory
  outDir: 'dist',

  // External dependencies (not bundled)
  external: [],

  // Banner (license header, etc.)
  banner: {
    js: '/* @example/sdk - MIT License */',
  },

  // Shims (CJS compatibility for import.meta.url, etc.)
  shims: true,

  // Environment variable definitions
  define: {
    'process.env.SDK_VERSION': JSON.stringify('1.0.0'),
  },

  // Post-build hook
  onSuccess: 'echo "Build completed successfully"',
});
```

```typescript
// tsup.config.ts - advanced configuration (per-environment builds)
import { defineConfig } from 'tsup';

export default defineConfig([
  // Node.js build
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    platform: 'node',
    target: 'node18',
    outDir: 'dist',
    clean: true,
    splitting: true,
    sourcemap: true,
    external: ['ws'],
  },
  // Browser build
  {
    entry: ['src/index.browser.ts'],
    format: ['esm'],
    dts: true,
    platform: 'browser',
    target: 'es2022',
    outDir: 'dist/browser',
    globalName: 'ExampleSDK',
    minify: true,
    sourcemap: true,
    noExternal: [/.*/],  // Bundle all dependencies
  },
]);
```

### 3.3 Build Tool Comparison

| Aspect | tsup | rollup | esbuild | tsc | unbuild |
|--------|------|--------|---------|-----|---------|
| Build speed | Very fast | Average | Fastest | Slow | Fast |
| ESM+CJS output | 1 command | Requires plugins | Config needed | Build separately | 1 command |
| Type generation | Built-in | Requires plugin | Not supported | Built-in | Built-in |
| Tree-shaking | Good | Best | Good | None | Good |
| Config simplicity | Very simple | Complex | Simple | Moderate | Simple |
| Plugins | esbuild-compatible | Rich | Limited | None | rollup-compatible |
| Use case | SDK/Library | Large-scale library | Speed-focused | Type checking | Monorepo |
| Recommendation | High (general) | High (large-scale) | Medium | Low (for builds) | High (monorepo) |

### 3.4 Dual Package Hazard

When providing both ESM and CJS, be careful of the "Dual Package Hazard," where the same package gets loaded as both ESM and CJS, creating two singleton instances.

```
Dual Package Hazard occurrence pattern:

  App (ESM)
    |
    +-- import { Client } from '@example/sdk'
    |     → loads dist/index.js (ESM version)
    |     → creates a Client instance
    |
    +-- require('@example/sdk') (via CJS dependency)
          → loads dist/index.cjs (CJS version)
          → a different Client class is loaded
          → instanceof check fails!

  Countermeasures:
    1. Stateless design (recommended)
       → Don't hold global state
       → Duck typing instead of instanceof

    2. Make the CJS version a wrapper for the ESM version
       // dist/index.cjs
       module.exports = require('./index.js');
       → But this requires dynamic import

    3. Set "type": "module" in package.json,
       and provide an explicit wrapper for CJS users
```

---

## 4. TypeScript Configuration in Detail

### 4.1 tsconfig.json for Package Development

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],

    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "outDir": "dist",
    "rootDir": "src",

    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,

    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### 4.2 Key TypeScript Compiler Options Explained

```
moduleResolution selection guide:

  "bundler" (recommended when using tsup/rollup)
    → Resolves .ts files with import './foo'
    → Correctly interprets the exports field
    → Extension-less imports are allowed

  "node16" / "nodenext" (recommended when using tsc directly)
    → Fully conforms to Node.js module resolution
    → .js extension is required
    → Correctly interprets the exports field

  "node" (not recommended)
    → Legacy resolution method
    → May ignore the exports field

  verbatimModuleSyntax: true (recommended)
    → Explicit import type { Foo } is required
    → Correctly distinguishes type-only imports
    → Ensures unnecessary imports are removed at build time
```

### 4.3 Type Definition File Quality Management

Type definition quality directly affects the user experience of a package. For TypeScript users, type definitions are the documentation itself.

```typescript
// src/types.ts - example of careful type definitions

/**
 * SDK client configuration options.
 *
 * @example
 * ```typescript
 * const client = new ExampleClient({
 *   apiKey: 'sk-xxx',
 *   baseURL: 'https://api.example.com',
 *   timeout: 30_000,
 * });
 * ```
 */
export interface ClientOptions {
  /**
   * API key. Can also be read from the `EXAMPLE_API_KEY` environment variable.
   * @see https://example.com/docs/authentication
   */
  apiKey: string;

  /**
   * API base URL. Defaults to `https://api.example.com/v1`.
   * @default "https://api.example.com/v1"
   */
  baseURL?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Maximum number of retries. Set to 0 to disable retries.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Custom fetch function. Used for mock injection in tests.
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Custom headers. Applied to all requests.
   */
  defaultHeaders?: Record<string, string>;
}

/**
 * Common type for paginated responses.
 * @typeParam T - Type of elements in the list
 */
export interface PaginatedResponse<T> {
  /** Array of data */
  data: T[];
  /** Whether the next page exists */
  hasMore: boolean;
  /** Cursor for fetching the next page */
  cursor?: string;
  /** Total count of results (if available) */
  totalCount?: number;
}

/**
 * Type for API error responses.
 */
export interface APIError {
  /** Error code (e.g., "NOT_FOUND", "RATE_LIMITED") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error information */
  details?: Record<string, unknown>;
  /** Request ID (used for support inquiries) */
  requestId?: string;
}
```

---

## 5. Zero-Dependency Design Principles and Practice

### 5.1 Why Aim for Zero Dependencies?

```
Relationship between dependency count and risk:

  0 deps:    Risk minimum ████
  1-3 deps:  Risk low     ████████
  4-10 deps: Risk medium  ████████████████
  10+ deps:  Risk high    ████████████████████████████

  Main risks:
    1. Supply chain attacks
       → A dependency package is taken over
       → The event-stream incident (2018) is a famous example
       → Impact scope is huge when transitive dependencies are included

    2. Version conflicts
       → Version clashes with user's other dependencies
       → Bloating of node_modules
       → Difficult to debug

    3. Maintenance burden
       → Responding to dependency updates
       → Keeping up with deprecations
       → Verifying license compatibility

    4. Bundle size increase
       → Dependencies that Tree-shaking can't eliminate
       → Affects users' application size
```

### 5.2 Alternatives Using Node.js Built-in APIs

```typescript
// Utility collection with zero dependencies

// --- UUID generation (no need for uuid package) ---
function generateId(): string {
  return crypto.randomUUID();
}

// --- Deep clone (no need for lodash.cloneDeep) ---
function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

// --- Query string (no need for qs package) ---
function buildQueryString(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

// --- Base64 encoding (no need for buffer package) ---
function toBase64(str: string): string {
  return btoa(str);
}

// --- SHA-256 hash (no need for crypto-js package) ---
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- Retry (no need for p-retry package) ---
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number } = {
    maxRetries: 3,
    baseDelay: 1000,
  },
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < options.maxRetries) {
        const delay = options.baseDelay * Math.pow(2, attempt);
        const jitter = delay * 0.1 * Math.random();
        await new Promise(r => setTimeout(r, delay + jitter));
      }
    }
  }
  throw lastError;
}

// --- fetch with timeout (no need for node-fetch, Node.js 18+) ---
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 30_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 5.3 Cases Where Dependencies Are Acceptable

| Category | Example Packages | Reason |
|---------|----------------|--------|
| Cryptography / Auth | jose, @noble/hashes | Security implementations should use expert code |
| Protocol Buffers | protobuf.js | Protocol spec implementation is complex |
| WebSocket (Node.js) | ws | Node.js built-in is insufficient |
| Compression | fflate | WASM implementation is important for performance |
| Validation | zod | Integration with type inference is complex |

---

## 6. Semantic Versioning in Detail

### 6.1 The 3 Numbers in SemVer

```
SemVer: MAJOR.MINOR.PATCH

  MAJOR (breaking changes): 1.0.0 → 2.0.0
    Examples:
    - Deletion or renaming of public methods
    - Argument type changes (string → number)
    - Adding required parameters
    - Changing default behavior
    - Raising minimum Node.js version
    - Changing exception types

  MINOR (backward-compatible feature additions): 1.0.0 → 1.1.0
    Examples:
    - Adding new methods/classes
    - Adding optional parameters
    - Adding new events
    - Adding new exports
    - Adding deprecation marking (@deprecated)

  PATCH (bug fixes): 1.0.0 → 1.0.1
    Examples:
    - Bug fixes
    - Performance improvements
    - Documentation fixes
    - Updating devDependencies
    - Internal refactoring (no external behavior change)

  Pre-release:
    1.0.0-alpha.1   → Early test version (API unstable)
    1.0.0-beta.1    → Feature-complete (fixing bugs)
    1.0.0-rc.1      → Release candidate (critical bugs only)
```

### 6.2 Gray Areas in Versioning Decisions

```
Hard-to-decide cases:

  Q: Made TypeScript types more strict (changed any to string)
  A: → MINOR (stricter types may break user code)
     → But if it's clearly a bug fix, PATCH

  Q: Changed an error message
  A: → PATCH (error messages are not public API)
     → But some users may be parsing with regex

  Q: Significantly improved performance
  A: → PATCH (no change in external behavior)
     → But MINOR if memory usage changes cause impact

  Q: Dropped support for Node.js 16
  A: → MAJOR (restricts user environments)

  Q: Added a new option with a default value set
  A: → MINOR (existing code works without changes)
     → But MAJOR if the default changes existing behavior
```

### 6.3 Version Management with Changesets

```bash
# Initial setup of Changesets
npx changeset init
# → .changeset/ directory is created

# Record a change (run per PR)
npx changeset
# Interactively:
#   1. Select the packages with changes
#   2. Select the type of change (major / minor / patch)
#   3. Write a description of the change

# Version bump + CHANGELOG update
npx changeset version
# → package.json version is updated
# → CHANGELOG.md is auto-generated

# Publish to npm
npx changeset publish
# → npm publish is executed
# → git tag is created
```

```
.changeset/ directory structure:

  .changeset/
  ├── config.json           ← Changesets configuration
  ├── README.md             ← Description
  ├── brave-fans-dance.md   ← Change record 1 (random name)
  └── shy-maps-grin.md      ← Change record 2

  Example change record file (brave-fans-dance.md):
  ---
  "@example/sdk": minor
  ---

  Added batch fetch method to the user management API.
  Up to 100 items can be fetched at once with `client.users.list()`.
```

---

## 7. Test Strategy

### 7.1 Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/types.ts',
        'src/**/index.ts',  // Files with re-exports only
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
```

### 7.2 HTTP Mock Testing with MSW

```typescript
// src/__tests__/client.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ExampleClient } from '../index';

// MSW server setup
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ExampleClient', () => {
  const client = new ExampleClient({
    apiKey: 'test-key-xxx',
    baseURL: 'https://api.example.com/v1',
  });

  describe('users.get()', () => {
    it('can retrieve a user by specifying an ID', async () => {
      server.use(
        http.get('https://api.example.com/v1/users/123', ({ request }) => {
          // Verify authorization header
          expect(request.headers.get('Authorization')).toBe(
            'Bearer test-key-xxx',
          );
          return HttpResponse.json({
            id: '123',
            name: 'Tanaka Taro',
            email: 'taro@example.com',
            role: 'admin',
            createdAt: '2024-01-01T00:00:00Z',
          });
        }),
      );

      const user = await client.users.get('123');
      expect(user.id).toBe('123');
      expect(user.name).toBe('Tanaka Taro');
      expect(user.role).toBe('admin');
    });

    it('returns a 404 error for a non-existent user', async () => {
      server.use(
        http.get('https://api.example.com/v1/users/999', () => {
          return HttpResponse.json(
            {
              code: 'NOT_FOUND',
              message: 'User not found',
              requestId: 'req-abc-123',
            },
            { status: 404 },
          );
        }),
      );

      await expect(client.users.get('999')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('retries on 500 error', async () => {
      let attempts = 0;
      server.use(
        http.get('https://api.example.com/v1/users/123', () => {
          attempts++;
          if (attempts < 3) {
            return HttpResponse.json(
              { code: 'INTERNAL_ERROR', message: 'Server error' },
              { status: 500 },
            );
          }
          return HttpResponse.json({
            id: '123',
            name: 'Tanaka Taro',
          });
        }),
      );

      const user = await client.users.get('123');
      expect(user.name).toBe('Tanaka Taro');
      expect(attempts).toBe(3);
    });

    it('returns an appropriate error on timeout', async () => {
      server.use(
        http.get('https://api.example.com/v1/users/123', async () => {
          // Intentional delay
          await new Promise(resolve => setTimeout(resolve, 15_000));
          return HttpResponse.json({ id: '123' });
        }),
      );

      const timeoutClient = new ExampleClient({
        apiKey: 'test-key',
        timeout: 1000,
        maxRetries: 0,
      });

      await expect(timeoutClient.users.get('123')).rejects.toThrow(
        'Request timed out',
      );
    });
  });

  describe('users.list()', () => {
    it('can retrieve a paginated user list', async () => {
      server.use(
        http.get('https://api.example.com/v1/users', ({ request }) => {
          const url = new URL(request.url);
          const limit = url.searchParams.get('limit') ?? '20';
          const cursor = url.searchParams.get('cursor');

          return HttpResponse.json({
            data: [
              { id: '1', name: 'User 1' },
              { id: '2', name: 'User 2' },
            ],
            hasMore: cursor === null,
            cursor: cursor === null ? 'cursor-abc' : undefined,
          });
        }),
      );

      const page1 = await client.users.list({ limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await client.users.list({
        limit: 2,
        cursor: page1.cursor,
      });
      expect(page2.hasMore).toBe(false);
    });
  });
});
```

---

## 8. Publishing Workflow

### 8.1 Pre-publish Checklist

```
Pre-publish checklist (required):

  Code quality:
    [x] All tests pass (npm test)
    [x] Type check passes (npm run typecheck)
    [x] No lint errors (npm run lint)
    [x] Formatting is consistent (npm run format:check)

  Package configuration:
    [x] package.json version is correct
    [x] exports field is correctly configured
    [x] Unnecessary files are excluded via the files field
    [x] engines field is configured
    [x] license file is included

  Documentation:
    [x] README.md is up to date
    [x] CHANGELOG.md is updated
    [x] Type definitions have JSDoc comments

  Security:
    [x] .env file is not included
    [x] No API keys or secrets are included
    [x] No vulnerabilities from npm audit

  Verification:
    [x] Check contents with npm pack --dry-run
    [x] npm pack → extract tarball and verify
```

### 8.2 Pre-verification with npm pack

```bash
# Check included files
npm pack --dry-run

# Example output:
# npm notice Tarball Contents
# npm notice 1.2kB  package.json
# npm notice 4.5kB  README.md
# npm notice 1.1kB  LICENSE
# npm notice 12.3kB dist/index.js
# npm notice 11.8kB dist/index.cjs
# npm notice 8.4kB  dist/index.d.ts
# npm notice 8.2kB  dist/index.d.cts
# npm notice === Tarball Details ===
# npm notice name:          @example/sdk
# npm notice version:       1.0.0
# npm notice filename:      example-sdk-1.0.0.tgz
# npm notice package size:  15.2 kB
# npm notice unpacked size: 47.5 kB
# npm notice total files:   8

# Actually create the tarball and verify
npm pack
tar -xzf example-sdk-1.0.0.tgz
ls package/
# → dist/  LICENSE  package.json  README.md
```

### 8.3 Automated Publishing with GitHub Actions

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write  # npm provenance

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test

      - name: Type check
        run: npm run typecheck

      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: npx changeset publish
          version: npx changeset version
          commit: 'chore: release packages'
          title: 'chore: release packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 9. Monorepo Management Strategy

### 9.1 What Is a Monorepo?

A monorepo (Monorepo) is an approach to managing multiple packages in a single repository. For large-scale SDKs and frameworks, monorepos have become the de facto standard.

```
Example monorepo structure:

  my-sdk/
  ├── package.json              ← Root (private: true)
  ├── pnpm-workspace.yaml       ← Workspace definition
  ├── turbo.json                ← Turborepo configuration
  ├── .changeset/
  │   └── config.json           ← Changesets configuration
  ├── packages/
  │   ├── core/                 ← @my-sdk/core
  │   │   ├── package.json
  │   │   ├── src/
  │   │   ├── tsup.config.ts
  │   │   └── tsconfig.json
  │   ├── react/                ← @my-sdk/react
  │   │   ├── package.json      ← peerDep: react
  │   │   ├── src/
  │   │   └── tsconfig.json
  │   ├── vue/                  ← @my-sdk/vue
  │   │   ├── package.json      ← peerDep: vue
  │   │   ├── src/
  │   │   └── tsconfig.json
  │   └── cli/                  ← @my-sdk/cli
  │       ├── package.json
  │       ├── src/
  │       └── tsconfig.json
  ├── apps/
  │   ├── docs/                 ← Documentation site
  │   └── playground/           ← Demo app
  └── tooling/
      ├── eslint-config/        ← Shared ESLint config
      ├── tsconfig/             ← Shared TypeScript config
      └── prettier-config/      ← Shared Prettier config
```

### 9.2 Monorepo Tool Comparison

| Aspect | pnpm workspaces | npm workspaces | Turborepo | Nx | Lerna |
|--------|----------------|----------------|-----------|-----|-------|
| Package manager | pnpm | npm | npm/pnpm/yarn | npm/pnpm/yarn | npm/yarn |
| Task execution | None | None | Parallel + cache | Parallel + cache | Parallel |
| Build cache | None | None | Local + remote | Local + remote | None |
| Dependency graph | Basic | Basic | Auto-detect | Advanced | Basic |
| Config simplicity | Very simple | Very simple | Simple | Somewhat complex | Moderate |
| Learning cost | Low | Low | Low-medium | Medium-high | Low |
| Recommended use | Small-medium | Small | Medium-large | Large | Legacy |

### 9.3 pnpm + Turborepo Setup

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tooling/*'
```

```json
// Root package.json
{
  "name": "my-sdk-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "dev": "turbo dev",
    "clean": "turbo clean",
    "format": "prettier --write '**/*.{ts,tsx,json,md}'"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.2.0",
    "@changesets/cli": "^2.27.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsup.config.ts", "tsconfig.json"],
      "outputs": ["dist/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "vitest.config.ts"],
      "outputs": [],
      "cache": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "eslint.config.js"],
      "outputs": [],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"],
      "outputs": [],
      "cache": true
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 9.4 Cross-referencing Packages Within a Monorepo

```json
// packages/react/package.json
{
  "name": "@my-sdk/react",
  "version": "1.0.0",
  "dependencies": {
    "@my-sdk/core": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "react-dom": {
      "optional": true
    }
  }
}
```

```
Monorepo dependency graph:

  @my-sdk/react ──depends──> @my-sdk/core
       |                          |
       +──peer──> react           +──(zero deps)
       +──peer──> react-dom

  @my-sdk/vue ───depends──> @my-sdk/core
       |
       +──peer──> vue

  @my-sdk/cli ───depends──> @my-sdk/core
       |
       +──dep───> commander
       +──dep───> chalk

  Build order (auto-resolved by Turborepo):
    1. @my-sdk/core        (no dependencies)
    2. @my-sdk/react       (depends on core)
       @my-sdk/vue         (depends on core, can run in parallel)
       @my-sdk/cli         (depends on core, can run in parallel)

  "workspace:*" is replaced with the actual version at publish time:
    During development: "@my-sdk/core": "workspace:*"
    At publish time:    "@my-sdk/core": "^1.0.0"
```

### 9.5 Shared Configuration Management

```json
// tooling/tsconfig/base.json - shared TypeScript configuration
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  },
  "exclude": ["node_modules", "dist"]
}
```

```json
// packages/core/tsconfig.json - per-package TypeScript configuration
{
  "extends": "../../tooling/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

## 10. Package Size Optimization

### 10.1 Why Size Matters

Package size directly affects users' installation time, CI/CD execution time, and bundle size. Especially for packages used on the frontend, reducing bundle size is extremely important.

```
Package size measurement points:

  +-------------------+
  |   npm package     |
  +-------------------+
         |
         v
  1. Install Size
     → Total size downloaded at npm install
     → Includes transitive dependencies
     → Target: Under 1MB for SDKs

  2. Publish Size
     → Size of the tarball generated by npm pack
     → Controlled by the files field
     → Target: Under 100KB

  3. Bundle Size
     → Size when bundled with webpack/vite/etc.
     → Depends on Tree-shaking effectiveness
     → Target: Under 10KB after gzip (libraries)

  Measurement tools:
    npm pack --dry-run          → Publish size
    npx size-limit              → Bundle size
    https://bundlephobia.com    → Check online
    https://pkg-size.dev        → More detailed analysis
```

### 10.2 size-limit Configuration

```json
// Add to package.json
{
  "size-limit": [
    {
      "path": "dist/index.js",
      "import": "{ ExampleClient }",
      "limit": "10 KB"
    },
    {
      "path": "dist/users/index.js",
      "import": "{ UsersResource }",
      "limit": "3 KB"
    },
    {
      "path": "dist/index.js",
      "import": "*",
      "limit": "15 KB"
    }
  ]
}
```

```yaml
# .github/workflows/size.yml - measure size per PR
name: Size Check

on: [pull_request]

jobs:
  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          # Display size changes as PR comment
```

### 10.3 Tree-shaking Optimization

```typescript
// Bad: Re-exporting everything from a barrel file
// src/index.ts
export * from './users';
export * from './billing';
export * from './analytics';
export * from './utils';
// → With import { Users } from '@example/sdk',
//   billing, analytics, utils may also be bundled

// Good: Split with subpath exports
// Define individual entry points in package.json exports
// → import { Users } from '@example/sdk/users'
//   Only the users module is bundled

// Patterns that impede Tree-shaking:
// 1. Side-effectful assignment to class static properties
class Client {
  // Bad: has side effects
  static instances = new Map();  // Executed when module loads
}

// 2. Top-level side effects
console.log('SDK loaded');  // Side effect → cannot be Tree-shaken
const config = loadConfig(); // Function call → possible side effect

// 3. Using enum
enum Status { Active, Inactive }
// → Compiles to an IIFE → cannot be Tree-shaken

// Good alternative: const object + as const
const Status = {
  Active: 'active',
  Inactive: 'inactive',
} as const;
type Status = typeof Status[keyof typeof Status];
// → Pure object literal → can be Tree-shaken
```

---

## 11. Security and Quality Management

### 11.1 npm Provenance

npm provenance is a mechanism that cryptographically proves from which source code and in which CI environment a package was built.

```bash
# Publish with provenance
npm publish --provenance

# When automating with GitHub Actions:
# permissions requires id-token: write
# registry-url must be configured
```

```
How npm provenance works:

  Developer's code
       |
       v
  GitHub repository
       |
       v
  GitHub Actions (CI)
       |
       +-- Issues OIDC token
       |
       v
  npm publish --provenance
       |
       +-- Signs with Sigstore
       |
       v
  npm registry
       |
       +-- Package + signature + build info
       |
       v
  Users can verify:
    - Which repository's code it came from
    - Which commit it was built from
    - Which CI environment it ran in
    - Link to build logs
```

### 11.2 Security Checklist

```
Package security measures:

  During development:
    [x] Regularly run npm audit
    [x] Automatically update dependencies with dependabot / renovate
    [x] Monitor supply chain risks with Socket.dev
    [x] Set ignore-scripts=true in .npmrc

  At publish time:
    [x] Enable 2FA (npm login)
    [x] Enable provenance
    [x] Minimize npm token permissions
    [x] Restrict publish permissions with CODEOWNERS

  Package design:
    [x] Do not use eval() / Function()
    [x] Avoid dynamic require()
    [x] Sanitize user input
    [x] Protect against prototype pollution
    [x] Guard against ReDoS (Regular Expression Denial of Service)

  Recommended .npmrc settings:
    //registry.npmjs.org/:_authToken=${NPM_TOKEN}
    ignore-scripts=true
    audit=true
    fund=false
```

### 11.3 Automated Quality Measurement

```yaml
# .github/workflows/quality.yml
name: Quality

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build

      # Test coverage
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

      # Bundle size
      - run: npx size-limit

      # Type check
      - run: npm run typecheck

      # Lint
      - run: npm run lint

      # Security audit
      - run: npm audit --production

      # License check
      - run: npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC'
```

---

## 12. Anti-patterns and Countermeasures

### 12.1 Anti-pattern: Bloated Barrel Files

```typescript
// [Anti-pattern] Giant barrel file
// src/index.ts
export * from './users';
export * from './billing';
export * from './analytics';
export * from './notifications';
export * from './webhooks';
export * from './admin';
export * from './utils';
export * from './errors';
export * from './types';
export * from './constants';
// → All modules are aggregated at a single entry point
// → Tree-shaking becomes less effective
// → User's bundle size bloats
// → Risk of circular references increases
// → IDE auto-completion slows down

// [Solution] Split with subpath exports
// package.json
// {
//   "exports": {
//     ".":           "./dist/index.js",      ← Core only
//     "./users":     "./dist/users/index.js",
//     "./billing":   "./dist/billing/index.js",
//     "./analytics": "./dist/analytics/index.js"
//   }
// }

// src/index.ts - export core only
export { ExampleClient } from './client';
export type { ClientOptions, APIError } from './types';

// User side:
// import { ExampleClient } from '@example/sdk';
// import { UsersResource } from '@example/sdk/users';
// → Only the needed modules are bundled
```

### 12.2 Anti-pattern: Misuse of peerDependencies

```
[Anti-pattern] Putting peerDependencies into dependencies

  // Bad example: A React component library with React in dependencies
  {
    "name": "my-react-library",
    "dependencies": {
      "react": "^18.0.0"     // ← This is the problem
    }
  }

  Problems this causes:
    1. User's project already has a different version of React
    2. Two copies of React get installed in node_modules
    3. React's internal state is not shared, hooks break
    4. "Invalid hook call" error occurs

  node_modules/
  ├── react@18.3.0/          ← User's React
  ├── my-react-library/
  │   └── node_modules/
  │       └── react@18.2.0/  ← React bundled with library (separate instance)

  Correct fix:
  {
    "name": "my-react-library",
    "peerDependencies": {
      "react": "^18.0.0 || ^19.0.0"
    },
    "devDependencies": {
      "react": "^18.3.0"     ← For development and testing
    }
  }

  What should be in peerDependencies:
    - Framework core packages (react, vue, angular)
    - Plugin hosts (eslint, webpack, vite)
    - Libraries that need to be shared (require same instance)
```

### 12.3 Anti-pattern: Using .npmignore

```
[Anti-pattern] Managing excluded files with .npmignore

  Problems:
    - Priority between .gitignore and .npmignore is complex
    - Easy to forget updating .npmignore when adding new files
    - Source code or tests get inadvertently published
    - Managing "what to exclude" rather than "what to include"

  Correct approach: Use the files field in package.json
  {
    "files": [
      "dist",
      "README.md",
      "LICENSE",
      "CHANGELOG.md"
    ]
  }

  Benefits of files:
    - Whitelist approach (explicitly specify what to include)
    - New files cannot be accidentally published
    - package.json, README.md, LICENSE are automatically included
    - Easy to verify with npm pack --dry-run
```

---

## 13. Edge Case Analysis

### 13.1 Edge Case: ESM and CJS Interoperability

```typescript
// Edge case: requiring an ESM module from CJS

// When using an ESM-only package from a CJS project
// → require() cannot be used (ERR_REQUIRE_ESM error)

// Node.js 22 and later:
// require(esm) support is growing, but
// modules containing top-level await still cannot be required

// Workaround 1: Use dynamic import() (works in CJS too)
// cjs-consumer.cjs
async function main() {
  // Dynamic import() works in CJS
  const { ExampleClient } = await import('@example/sdk');
  const client = new ExampleClient({ apiKey: 'xxx' });
}
main();

// Workaround 2: Provide a CJS build from the package side (recommended)
// → Set format: ['esm', 'cjs'] in tsup

// Workaround 3: Provide a wrapper file
// dist/index.cjs
// const mod = await import('./index.js');
// module.exports = mod;
// → Requires top-level await, so Node.js 14+ only

// Note: handling of default exports differs
// ESM: export default class Client {}
// CJS: const { default: Client } = require('@example/sdk');
//      ← ".default" may be required
// → Named exports are recommended (avoid default exports)
```

### 13.2 Edge Case: Type Resolution Differences by TypeScript moduleResolution

```
TypeScript moduleResolution and package type resolution:

  How package types are resolved changes depending on
  the moduleResolution setting in the user's tsconfig.json:

  "node" (legacy):
    → Only references the "types" field of package.json
    → "types" inside the "exports" field is ignored
    → Subpath resolution via typesVersions is required

  "node16" / "nodenext":
    → References "types" inside the "exports" field
    → Resolves types based on conditions (import/require)
    → Distinguishes between .d.ts and .d.cts

  "bundler":
    → References "types" inside the "exports" field
    → Allows extension-less imports
    → Most flexible setting

  How to support all moduleResolution settings:

  {
    "types": "./dist/index.d.ts",
    "exports": {
      ".": {
        "import": {
          "types": "./dist/index.d.ts",
          "default": "./dist/index.js"
        },
        "require": {
          "types": "./dist/index.d.cts",
          "default": "./dist/index.cjs"
        }
      },
      "./users": {
        "import": {
          "types": "./dist/users/index.d.ts",
          "default": "./dist/users/index.js"
        },
        "require": {
          "types": "./dist/users/index.d.cts",
          "default": "./dist/users/index.cjs"
        }
      }
    },
    "typesVersions": {
      "*": {
        "users": ["./dist/users/index.d.ts"]
      }
    }
  }

  → Top-level "types": For legacy moduleResolution
  → "types" inside "exports": For node16/nodenext/bundler
  → "typesVersions": For compatibility with TypeScript 4.x and earlier
```

### 13.3 Edge Case: Undoing npm publish and Version Reuse

```
Rules and constraints of npm unpublish:

  72-hour rule:
    - Within 72 hours of publishing: unpublish is possible
    - After 72 hours: unpublish is not possible (need to contact support)

  Prohibition on version reuse:
    - Once-published version numbers cannot be reused even after unpublish
    - Example: publish 1.0.0 → unpublish → cannot re-publish as 1.0.0
    - → Must publish as 1.0.1

  Using deprecation:
    $ npm deprecate @example/sdk@1.0.0 "Security vulnerability. Please update to 2.0.0"
    → Package remains available
    → Warning message displayed during npm install
    → Deprecate all versions: npm deprecate @example/sdk "This package is deprecated"

  Safe releases using dist-tags:
    # Publish beta version with "beta" tag
    npm publish --tag beta
    # → Install with npm install @example/sdk@beta
    # → npm install @example/sdk still gets latest

    # Publish canary version with "canary" tag
    npm publish --tag canary
    # → For automated testing, used in daily automated builds
```

---

## 14. Practice Exercises

### 14.1 Exercise 1 (Beginner): Creating a Basic npm Package

An exercise to create a simple utility package and build/test it locally.

```
Exercise goals:
  - Configure basic fields in package.json
  - Run an ESM/CJS dual build with tsup
  - Write and run tests with vitest

Steps:

  1. Initialize the project
     $ mkdir my-utils && cd my-utils
     $ npm init -y
     $ npm install -D typescript tsup vitest

  2. Edit package.json (configure using the following as a reference)
```

```json
// Exercise 1: package.json
{
  "name": "@yourname/utils",
  "version": "0.1.0",
  "description": "A collection of utility functions",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "prepublishOnly": "npm run build && npm run test"
  }
}
```

```typescript
// Exercise 1: src/index.ts
/**
 * Capitalizes the first letter of a string.
 * @param str - The string to convert
 * @returns The string with the first letter capitalized
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Splits an array into chunks.
 * @param array - The array to split
 * @param size - Chunk size
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Chunk size must be greater than 0');
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Extracts only specified keys from an object.
 * @param obj - The source object
 * @param keys - Array of keys to extract
 * @returns The extracted object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
```

```typescript
// Exercise 1: src/index.test.ts
import { describe, it, expect } from 'vitest';
import { capitalize, chunk, pick } from './index';

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('stays the same if already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });
});

describe('chunk', () => {
  it('splits an array into chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('handles chunk size larger than array length', () => {
  });

  it('throws error for chunk size 0 or less', () => {
    expect(() => chunk([1], 0)).toThrow('Chunk size must be greater than 0');
  });
});

describe('pick', () => {
  it('extracts only specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('ignores non-existent keys', () => {
    const obj = { a: 1, b: 2 };
    expect(pick(obj, ['a', 'c' as keyof typeof obj])).toEqual({ a: 1 });
  });
});
```

```
Exercise 1 verification points:
  [x] npm run build succeeds
  [x] .js, .cjs, .d.ts, .d.cts are generated in dist/
  [x] npm run test all passes
  [x] Verify included files with npm pack --dry-run
```

### 14.2 Exercise 2 (Intermediate): Building an SDK with Subpath Exports

An exercise to design an API client SDK with subpath exports, creating a structure where Tree-shaking is effective.

```
Exercise goals:
  - Correctly configure subpath exports
  - Hide internal modules
  - Write tests using MSW

Directory structure:

  sdk-exercise/
  ├── package.json
  ├── tsup.config.ts
  ├── tsconfig.json
  ├── vitest.config.ts
  └── src/
      ├── index.ts           ← Main entry
      ├── client.ts          ← HTTP client
      ├── types.ts           ← Shared type definitions
      ├── errors.ts          ← Error classes
      ├── users/
      │   ├── index.ts       ← @example/sdk/users
      │   ├── types.ts
      │   └── __tests__/
      │       └── users.test.ts
      └── posts/
          ├── index.ts       ← @example/sdk/posts
          ├── types.ts
          └── __tests__/
              └── posts.test.ts
```

```typescript
// Exercise 2: src/client.ts
import type { ClientOptions } from './types';
import { APIError, TimeoutError } from './errors';

export class BaseClient {
  protected readonly baseURL: string;
  protected readonly apiKey: string;
  protected readonly timeout: number;
  protected readonly maxRetries: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL ?? 'https://api.example.com/v1';
    this.timeout = options.timeout ?? 30_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  protected async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const url = new URL(path, this.baseURL);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value);
      }
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.timeout,
      );

      try {
        const response = await this.fetchFn(url.toString(), {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            ...options.headers,
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const apiError = new APIError(
            errorBody.message ?? 'Unknown error',
            response.status,
            errorBody.code,
            errorBody.requestId,
          );

          // 5xx errors are retry targets
          if (response.status >= 500 && attempt < this.maxRetries) {
            lastError = apiError;
            const delay = 1000 * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }

          throw apiError;
        }

        return (await response.json()) as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof APIError) throw error;

        if ((error as Error).name === 'AbortError') {
          throw new TimeoutError(
            `Request timed out after ${this.timeout}ms`,
          );
        }

        lastError = error as Error;
        if (attempt < this.maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }
}
```

```typescript
// Exercise 2: src/errors.ts
export class APIError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    requestId?: string,
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends Error {
  readonly field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
```

```
Exercise 2 verification points:
  [x] import { ExampleClient } from '@example/sdk' works
  [x] import { UsersResource } from '@example/sdk/users' works
  [x] import { something } from '@example/sdk/internal' gives an error
  [x] All MSW-mocked tests pass
  [x] No unnecessary files included in npm pack --dry-run
```

### 14.3 Exercise 3 (Advanced): Multi-Package Management in a Monorepo

An exercise to build a monorepo with pnpm + Turborepo + Changesets, enabling coordinated development of multiple packages and automated releases.

```
Exercise goals:
  - Configure pnpm workspace
  - Manage build order with Turborepo
  - Manage versions and CHANGELOG with Changesets
  - Build an automated release pipeline with GitHub Actions

Steps:

  1. Initialize the monorepo
     $ mkdir my-sdk-mono && cd my-sdk-mono
     $ pnpm init
     $ pnpm add -Dw turbo @changesets/cli
     $ npx changeset init

  2. Define the workspace
     Create pnpm-workspace.yaml

  3. Create packages
     $ mkdir -p packages/core packages/react packages/cli
     $ cd packages/core && pnpm init
     $ cd packages/react && pnpm init
     $ cd packages/cli && pnpm init

  4. Set up dependencies
     packages/react/package.json:
       "dependencies": { "@my-sdk/core": "workspace:*" }

  5. Run build and tests
     $ pnpm turbo build
     $ pnpm turbo test

  6. Record a change
     $ pnpm changeset
     → @my-sdk/core: minor
     → "Added support for user list API"

  7. Version bump
     $ pnpm changeset version
     → @my-sdk/core: 0.1.0 → 0.2.0
     → @my-sdk/react: 0.1.0 → 0.1.1 (dependency update)

  Verification points:
  [x] pnpm turbo build correctly resolves dependency order
  [x] packages/react can reference packages/core
  [x] changeset version correctly updates versions for all packages
  [x] CHANGELOG.md is auto-generated for each package
  [x] workspace:* is replaced with the actual version at publish time
```

---

## 15. Package Maintenance Best Practices

### 15.1 How to Write a CHANGELOG

```markdown
<!-- CHANGELOG.md example -->
# @example/sdk

## 2.0.0

### Breaking Changes

- Removed `apiUrl` from `Client` constructor options.
  Use `baseURL` instead.
- Raised minimum Node.js version to 18.
- Changed return value of `users.delete()` from `void` to `{ deleted: boolean }`.

### Migration Guide

  // Before (v1)
  const client = new Client({ apiUrl: 'https://...' });

  // After (v2)
  const client = new Client({ baseURL: 'https://...' });

## 1.3.0

### Features

- Added filter options to `users.list()`.
- Added new `billing.invoices()` method.
- Added `requestId` field to responses.

### Bug Fixes

- Fixed issue where timeout was not reset on retry.
- Fixed error when pagination `cursor` is `null`.
```

### 15.2 Correct Deprecation Procedure

```typescript
// Step 1: Add @deprecated in JSDoc (MINOR release)
/**
 * Search for a user by name.
 * @deprecated Deprecated since v1.3.0. Use `users.list({ filter: { name } })` instead.
 * Scheduled for removal in v2.0.0.
 */
export function findUserByName(name: string): Promise<User> {
  // Runtime warning (Node.js environment)
  if (typeof process !== 'undefined') {
    process.emitWarning(
      'findUserByName() is deprecated. Use users.list({ filter: { name } }) instead.',
      'DeprecationWarning',
    );
  }
  // Keep existing implementation intact
  return this.users.list({ filter: { name } }).then(res => res.data[0]);
}

// Step 2: Document the deprecation in README and CHANGELOG
// Step 3: Remove in a MAJOR release after 1-2 MINOR versions
```

### 15.3 Regular Dependency Updates

```json
// renovate.json - Renovate Bot configuration
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    ":automergeMinor",
    ":automergeDigest"
  ],
  "labels": ["dependencies"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "matchCurrentVersion": "!/^0/",
      "automerge": true
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["dependencies", "breaking"]
    },
    {
      "matchPackageNames": ["typescript"],
      "automerge": false,
      "labels": ["dependencies", "typescript"]
    }
  ],
  "schedule": ["before 9am on monday"]
}
```

---

## 16. FAQ (Frequently Asked Questions)

### Q1: Is it okay to publish ESM only? Is CJS necessary?

```
A: As of 2025, providing a CJS build is still strongly recommended.

  Cases where ESM only is fine:
    - CLI tools (users don't import them)
    - Plugins specific to new frameworks
    - Internal packages (used only within a monorepo)
    - Targets only browsers

  Cases where CJS is needed:
    - Widely-used general-purpose libraries
    - SDKs / API clients
    - Things used from test frameworks
    - Projects using Jest (incomplete ESM support)

  Decision criteria:
    - More than 10% of users may use CJS → provide dual
    - With tsup, the additional cost is nearly zero
    → When in doubt, providing dual is safe
```

### Q2: I can't tell the difference between dependencies and devDependencies

```
A: Decide based on whether it's needed "after" npm install is run.

  Test:
    When npm install @example/sdk is run,
    does it work without that module?

    YES → devDependencies
    NO  → dependencies

  Specific examples:
    tsup       → devDependencies (only used at build time)
    vitest     → devDependencies (only used at test time)
    eslint     → devDependencies (only used at lint time)
    typescript → devDependencies (only used at compile time)
    zod        → dependencies (used for validation at runtime)
    jose       → dependencies (processes JWT at runtime)

  Note: when bundling with tsup
    → Dependency code is included in dist
    → In that case, may not need to be in dependencies
    → However, dependencies is correct if users Tree-shake

  peerDependencies:
    → When the same instance is needed in the user's project
    → Examples: react, vue, eslint
```

### Q3: Should I add a @scope to my package name?

```
A: It is strongly recommended to add a @scope to packages
   tied to an organization or brand.

  Benefits of adding @scope:
    1. Avoids name collisions
       → "utils" already exists, but "@yourorg/utils" can be reserved
    2. Package ownership is clear
    3. npm access control within an organization is easier
    4. Grouping of related packages
       → @my-sdk/core, @my-sdk/react, @my-sdk/vue

  Cases where @scope is not needed:
    - Already have a famous package name reserved
    - Small personal utility
    - Well-known project name

  Notes:
    - Scoped packages are private by default
    - npm publish --access public is needed to publish
    - Can also configure with publishConfig:
      "publishConfig": { "access": "public" }

  Creating an npm org:
    $ npm org create my-org
    → @my-org/* scope becomes available
```

### Q4: How long can I keep developing at version 0.x.x?

```
A: 0.x.x means "initial development stage" and declares that the API is unstable.
   Once users increase and the API stabilizes, you should move to 1.0.0 promptly.

  SemVer rules for 0.x.x:
    - 0.x.x can have breaking changes at any time
    - MINOR in 0.MINOR.PATCH may include breaking changes
    - Users cannot expect stability

  Timing to move to 1.0.0:
    - Being used in production
    - Primary APIs are finalized
    - Weekly download count exceeds a certain threshold
    - Documentation is in order

  Risks of not moving:
    - Users judge it as unstable and decline to adopt
    - Inadvertent breaking changes received via ^ version specifier
    - "dependencies": { "@example/sdk": "^0.5.0" }
      → If 0.6.0 has breaking changes, auto-updated
```

### Q5: What should I write in a package README?

```
A: README is the "face" of the package and the first document users see.
   The following structure is recommended.

  Recommended README structure:
    1. Package name + one-line description
    2. Badges (npm version, CI status, coverage, license)
    3. Installation instructions
    4. Quick start (minimal code example)
    5. Overview of major features
    6. Link to API reference
    7. Migration guide (when major version is bumped)
    8. Link to contributing guide
    9. License

  README display on npm:
    - Displayed on the npmjs.com package page
    - Markdown is rendered
    - Use absolute URLs for images
    - Some HTML tags are restricted
```

### Q6: How do I configure a CommonJS and ESM dual package?

```
A: Use the exports field in package.json to branch between "import" and "require"
   conditions, and run a dual build of ESM/CJS with tsup.

  Basic configuration pattern:

    // package.json
    {
      "type": "module",
      "exports": {
        ".": {
          "types": "./dist/index.d.ts",
          "import": "./dist/index.js",
          "require": "./dist/index.cjs"
        }
      },
      "main": "./dist/index.cjs",
      "module": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }

    // tsup.config.ts
    import { defineConfig } from 'tsup';

    export default defineConfig({
      entry: ['src/index.ts'],
      format: ['esm', 'cjs'],
      dts: true,
      clean: true,
      splitting: false,
      sourcemap: true,
    });

  Running the build:
    $ pnpm tsup
    → dist/index.js     (ESM)
    → dist/index.cjs    (CJS)
    → dist/index.d.ts   (type definitions)
    → dist/index.d.cts  (CJS type definitions, auto-generated)

  Avoiding Dual Package Hazard:
    - Risk of the same package being loaded twice as ESM/CJS
    - Compose only of stateless pure functions
    - Avoid the singleton pattern
    - Details → See: Node.js official "Dual Package Hazard"

  Condition priority:
    1. "types" → type definitions (must be placed first)
    2. "import" → ESM
    3. "require" → CJS
    4. "default" → fallback (usually not needed)
```

### Q7: What is the practical operation of npm package versioning (SemVer)?

```
A: Semantic Versioning (SemVer) consists of three numbers MAJOR.MINOR.PATCH,
   and the appropriate position is updated based on the content of the change.

  Versioning decision criteria:

    MAJOR (1.0.0 → 2.0.0):
      - Breaking Change
      - Examples: function signature changes, adding/removing required parameters
      - Changing the behavior of exported APIs
      - Raising minimum Node.js version
      - Changes that may break existing code

    MINOR (1.0.0 → 1.1.0):
      - Backward-compatible feature additions
      - Examples: exporting new functions, adding optional arguments
      - Expanding functionality without changing existing behavior
      - Minor updates to dependency packages (no breaking changes)

    PATCH (1.0.0 → 1.0.1):
      - Bug fixes only
      - Examples: fixing malfunctions, fixing type definition errors
      - Performance improvements (no behavior changes)
      - Documentation fixes
      - Patch updates to dependency packages

  Automated management with Changesets:

    $ npx changeset
    → Select type of change (major/minor/patch)
    → Write summary in .changeset/xxxxx.md
    → On PR merge, automatically update version & generate CHANGELOG

  Pre-release versions:
    - 1.0.0-beta.1, 1.0.0-rc.2, etc.
    - Publish with npm publish --tag beta
    - Not retrieved by normal npm install
    - Pre-release for test users

  Recommended version pinning:
    - ^ (Caret): Allow auto-update up to MINOR
      "dependencies": { "@example/sdk": "^1.2.3" }
      → Latest 1.x.x is auto-fetched
    - ~ (Tilde): Allow auto-update for PATCH only
      "dependencies": { "@example/sdk": "~1.2.3" }
      → Latest 1.2.x is auto-fetched
```

### Q8: How to test a package before publishing (npm link vs pack)?

```
A: npm link and npm pack are used for different purposes.
   npm pack is strongly recommended for production-close verification.

  How to use npm link:

    Package side:
      $ cd /path/to/my-package
      $ npm link

    Consumer side:
      $ cd /path/to/test-project
      $ npm link @example/my-package

    Benefits:
      - Changes are reflected in real time
      - Fast development cycle

    Drawbacks:
      - Symlinks are created, so behavior may differ from production
      - The "files" field of package.json is not verified
      - Unnecessary files may be included without noticing

  How to use npm pack (recommended):

    Package side:
      $ npm pack --dry-run
      → Check the list of files to be published (no actual tarball)

      $ npm pack
      → example-my-package-1.0.0.tgz is generated

    Consumer side:
      $ npm install /path/to/example-my-package-1.0.0.tgz

    Benefits:
      - Same behavior as a production npm install
      - Can verify that the "files" field is working correctly
      - Detect unnecessary file inclusion in advance
      - Can also check tarball size

    Drawbacks:
      - Need to re-pack on every change
      - Development cycle is somewhat slower

  Recommended workflow:

    During development:
      → npm link for fast iterative development

    Final verification before publishing:
      → npm pack to check package contents
      → npm pack --dry-run to verify included file list
      → npm install the generated .tgz in another project to test

  Verifying publishConfig:
    → npm pack also reflects publishConfig settings
    → Can verify that registry, access, etc. are configured correctly

  Pack testing in CI/CD:
    - Run npm pack in GitHub Actions
    - Save the generated tarball as an artifact
    - Alert on size increase
```

---

## 17. npm Package Quality Checklist

```
Quality check before publishing (all items must be cleared):

  Basic configuration:
    [ ] package.json name is correct
    [ ] version conforms to SemVer
    [ ] description is concise and clear
    [ ] license field is configured
    [ ] Node.js version specified in engines
    [ ] keywords are appropriately set
    [ ] repository, homepage, bugs are configured

  Module configuration:
    [ ] "type": "module" is configured
    [ ] exports field is correctly configured
    [ ] main, module, types fallbacks exist
    [ ] Subpath exports work as intended
    [ ] Direct access to internal modules is prevented

  Build:
    [ ] Both ESM and CJS are output
    [ ] Type definition files (.d.ts, .d.cts) are generated
    [ ] Source maps are generated
    [ ] Build artifacts are output to dist/
    [ ] sideEffects: false is configured

  Testing:
    [ ] Test coverage is 80% or more
    [ ] Edge case tests exist
    [ ] Error case tests exist
    [ ] Async processing tests exist

  Publish configuration:
    [ ] Published files restricted with files field
    [ ] Contents verified with npm pack --dry-run
    [ ] No .env or secrets included
    [ ] No unnecessary test files included
    [ ] 2FA is enabled
    [ ] provenance is configured

  Documentation:
    [ ] README.md is up to date
    [ ] CHANGELOG.md is updated
    [ ] Type definitions have JSDoc comments
    [ ] Code examples work
```

---

## Summary

| Concept | Key Points |
|---------|-----------|
| package.json | ESM/CJS support via exports, types placed at top of each condition |
| Build | tsup is optimal for SDK development, supports per-environment builds |
| Type definitions | Well-commented types with JSDoc improve user experience |
| Dependencies | Aim for zero dependencies, use Node.js built-in APIs as alternatives |
| Versioning | Systematic management with SemVer + Changesets |
| Testing | HTTP-level mock with MSW, 80% or more coverage |
| Monorepo | pnpm + Turborepo + Changesets is the modern standard setup |
| Publishing | Automated with GitHub Actions, provenance for reliability |
| Security | npm audit, 2FA, provenance, supply chain countermeasures |
| Maintenance | Dependency updates with Renovate, deprecation done gradually |

```
npm package development maturity model:

  Level 1 - Basic:
    [x] Can run npm publish
    [x] Configure basic fields in package.json
    [x] Works with ESM

  Level 2 - Standard:
    [x] ESM/CJS dual build
    [x] Provide TypeScript type definitions
    [x] Test coverage 80% or more
    [x] Build CI/CD pipeline
    [x] SemVer-compliant versioning

  Level 3 - Professional:
    [x] Subpath exports design
    [x] Systematic release management with Changesets
    [x] Bundle size monitoring with size-limit
    [x] npm provenance enabled
    [x] Comprehensive security measures

  Level 4 - Expert:
    [x] Multi-package management in monorepo
    [x] Countermeasures for Dual Package Hazard
    [x] Support for all moduleResolution settings
    [x] Automated dependency updates (Renovate/Dependabot)
    [x] Staged deprecation process
    [x] Community contribution acceptance setup
```

---

## FAQ

### Q1: Should I start with a monorepo or a single package?

Start with a single package and move to a monorepo when package boundaries become clear. Introducing a monorepo at an early stage often makes it difficult to decide how to split packages and introduces unnecessary complexity. Concrete split criteria include when adapters for different frameworks (such as @my-sdk/react, @my-sdk/vue) are needed, or when the responsibilities of core logic and utilities are clearly separated.

### Q2: How should package deprecation proceed?

A staged deprecation process is recommended. First, set a deprecation message with the `npm deprecate` command so users receive a warning during `npm install`. At the same time, document the migration guide to the successor package in the README and CHANGELOG. Allow at least 6 months between announcing deprecation and complete removal, and archive only after confirming that weekly downloads have sufficiently decreased.

### Q3: What are the minimum security measures I should take for a package?

The minimum measures to implement are the following four. (1) Enable npm 2FA (two-factor authentication) to prevent account hijacking. (2) Enable `npm provenance` to make the package's origin traceable back to the CI/CD pipeline. (3) Incorporate `npm audit` into CI to detect dependencies with known vulnerabilities. (4) Set `ignore-scripts=true` in `.npmrc` to prevent attacks via postinstall scripts. Additionally, it is desirable to configure automatic dependency updates with Renovate or Dependabot.

---

## What to Read Next
-> [API Documentation](./02-api-documentation.md)

---

## References

1. npm. "package.json documentation." docs.npmjs.com, 2024. -- Official reference for all package.json fields. The most accurate source for detailed specifications of the exports field and condition export priority.

2. Node.js. "Modules: Packages." nodejs.org/api/packages.html, 2024. -- Official spec for the Node.js module resolution algorithm. Contains official statements on ESM and CJS interoperability, exports field resolution order, and Dual Package Hazard.

3. tsup. "Bundle your TypeScript library with no config." github.com/egoist/tsup, 2024. -- Official tsup documentation. Covers configuration methods for ESM/CJS dual build, type definition generation, code splitting, and per-environment builds comprehensively.

4. Changesets. "A way to manage your versioning and changelogs." github.com/changesets/changesets, 2024. -- Official Changesets repository. Detailed explanation of monorepo-compatible version management, automatic CHANGELOG generation, and GitHub Actions integration configuration.

5. Turborepo. "High-performance build system for JavaScript and TypeScript codebases." turbo.build, 2024. -- Official Turborepo documentation. Explains monorepo task execution, build caching, and automatic dependency graph detection.

6. Semver. "Semantic Versioning 2.0.0." semver.org, 2024. -- Official semantic versioning spec. Defines MAJOR/MINOR/PATCH definitions, pre-release version rules, and version comparison algorithms.

7. npm. "npm provenance." docs.npmjs.com/generating-provenance-statements, 2024. -- Official npm provenance guide. Explains package signing and verification using Sigstore and GitHub Actions configuration methods.
