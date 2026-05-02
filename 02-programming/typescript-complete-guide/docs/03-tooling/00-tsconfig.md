# tsconfig.json Complete Guide

> Understand the full picture of TypeScript compiler options and choose the optimal configuration for your project

## What You Will Learn

1. **tsconfig.json structure** -- File layout, inheritance via extends, and how project references work
2. **Key compiler options** -- All options and recommended settings for strict, module, target, and path categories
3. **Use-case-specific configurations** -- Optimal setups for frontend, backend, libraries, and monorepos
4. **Performance tuning** -- Techniques for faster builds in large-scale projects
5. **Troubleshooting** -- Common configuration mistakes and how to fix them


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Basic Structure of tsconfig.json

### 1-1. File Layout

```
Main sections of tsconfig.json:

+------------------------------------------+
| {                                        |
|   "compilerOptions": {                   |
|     // Compiler behavior settings        |
|   },                                     |
|   "include": [...],  // Compilation targets   |
|   "exclude": [...],  // Exclusion patterns    |
|   "extends": "...",  // Inherit base config   |
|   "references": [...] // Project references   |
|   "files": [...],    // Explicit file list    |
|   "watchOptions": {} // Watch settings        |
| }                                        |
+------------------------------------------+
```

```typescript
// Basic tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 1-2. Details of include / exclude / files

```typescript
// include: specify targets using glob patterns
{
  "include": [
    "src/**/*",        // All files under src
    "src/**/*.ts",     // Only .ts files (explicit)
    "src/**/*.tsx",    // Include .tsx files
    "types/**/*.d.ts"  // Type definition files
  ]
}

// exclude: remove from what was specified in include
// Note: exclude defaults to excluding node_modules, bower_components, jspm_packages, and outDir
{
  "exclude": [
    "node_modules",      // Excluded by default, but explicit is recommended
    "dist",              // Build output directory
    "**/*.test.ts",      // Test files
    "**/*.spec.ts",      // Spec files
    "**/__tests__/**",   // Test directories
    "coverage",          // Coverage output directory
    "scripts"            // Build scripts, etc.
  ]
}

// files: directly specify individual files (glob patterns not supported)
// Use when you only want to compile a small number of specific files
{
  "files": [
    "src/index.ts",
    "src/global.d.ts"
  ]
}
```

```
Priority order of include / exclude / files:

  files > include > exclude

  1. Files specified in files cannot be excluded by exclude
  2. When include and exclude conflict, exclude takes priority
  3. When files is specified, only files are compiled
     (when used with include, both sets are combined)
```

### 1-3. Inheritance via extends

```
extends chain:

  @tsconfig/node20/tsconfig.json   (community base)
       |
       v
  tsconfig.base.json               (project-wide common)
       |
   +---+---+---+
   |       |   |
   v       v   v
  tsconfig.json   tsconfig.test.json   tsconfig.build.json
  (for app)       (for tests)          (for builds)
```

```json
// tsconfig.base.json -- common settings
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}

// tsconfig.json -- for app (inherit + override)
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"]
}

// tsconfig.test.json -- for tests
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "types": ["vitest/globals"],
    "noEmit": true
  },
  "include": ["src/**/*", "tests/**/*"]
}

// tsconfig.build.json -- for builds only (excluding tests)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"]
}
```

### 1-4. Using Community Bases

```bash
# Install community-provided recommended configurations
npm install -D @tsconfig/node20
npm install -D @tsconfig/strictest
npm install -D @tsconfig/vite-react
```

```json
// Example using @tsconfig/node20
{
  "extends": "@tsconfig/node20/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}

// Using @tsconfig/strictest for maximum strictness
{
  "extends": "@tsconfig/strictest/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

```
Options enabled by @tsconfig/strictest:
  - strict: true
  - noUncheckedIndexedAccess: true
  - noImplicitOverride: true
  - noPropertyAccessFromIndexSignature: true
  - noFallthroughCasesInSwitch: true
  - exactOptionalPropertyTypes: true
  - forceConsistentCasingInFileNames: true
  - verbatimModuleSyntax: true
  - isolatedModules: true
```

### 1-5. watchOptions Configuration

```json
{
  "watchOptions": {
    // Method for watching files
    "watchFile": "useFsEvents",
    // Method for watching directories
    "watchDirectory": "useFsEvents",
    // Fallback polling interval (ms)
    "fallbackPolling": "dynamicPriority",
    // Wait time for simultaneous changes
    "synchronousWatchDirectory": false,
    // Exclude from watching
    "excludeDirectories": ["**/node_modules", "dist"],
    // Additional file watch targets
    "excludeFiles": []
  }
}
```

```
watchFile options:
  useFsEvents       -- Most efficient on macOS / Windows (default)
  fixedPollingInterval -- Poll at fixed intervals
  priorityPollingInterval -- Poll based on change frequency
  dynamicPriorityPolling -- Dynamically adjust polling interval
  useFsEventsOnParentDirectory -- Use events from parent directory

Recommendations:
  macOS/Windows → useFsEvents (default)
  Linux → useFsEvents (when inotify is available)
  NFS/Docker → fixedPollingInterval (for network filesystem)
```

---

## 2. strict Options

### 2-1. Breakdown of the strict Flag

```
strict: true enables all of the following flags:

+----------------------------------+-----------------------------------------+
| Option                           | Effect                                  |
+----------------------------------+-----------------------------------------+
| strictNullChecks                 | null / undefined checks                 |
| strictFunctionTypes              | Strict function type checks (contravariance) |
| strictBindCallApply              | Type checks for bind, call, apply       |
| strictPropertyInitialization     | Class property initialization checks    |
| noImplicitAny                    | Disallow implicit any                   |
| noImplicitThis                   | Disallow implicit this                  |
| alwaysStrict                     | Emit "use strict"                       |
| useUnknownInCatchVariables       | Make catch variables unknown type       |
+----------------------------------+-----------------------------------------+
```

```typescript
// Effect of strictNullChecks: true
function getUser(id: string): User | null {
  // ...
  return null;
}

const user = getUser("1");
// user.name;  // Error: Object is possibly 'null'
if (user) {
  user.name; // OK: after null check
}

// Combining with Optional Chaining
const name = user?.name; // Type: string | undefined
const upper = user?.name?.toUpperCase() ?? "Unknown";

// Non-null Assertion (use with care)
const forcedName = user!.name; // Type: string (ignores possibility of null)
// ↑ Will crash at runtime if null, so only use when certain

// Effect of strictFunctionTypes: true (contravariance check)
type Handler = (event: MouseEvent) => void;
const handler: Handler = (event: Event) => {}; // Error: contravariance
// MouseEvent is a subtype of Event, but Handler requires MouseEvent
// Using an Event handler as a MouseEvent handler may lack
// access to MouseEvent-specific properties

// Practical example of strictFunctionTypes
interface Animal {
  name: string;
}
interface Dog extends Animal {
  breed: string;
}

type Comparer<T> = (a: T, b: T) => number;
const animalComparer: Comparer<Animal> = (a, b) => a.name.localeCompare(b.name);
// const dogComparer: Comparer<Dog> = animalComparer; // Error with strict: true

// Effect of strictBindCallApply: true
function greet(name: string, age: number): string {
  return `Hello ${name}, age ${age}`;
}
greet.call(undefined, "Alice", 30);       // OK
// greet.call(undefined, "Alice", "thirty"); // Error: string not assignable to number
greet.bind(undefined, "Alice")(30);       // OK: partial application
// greet.bind(undefined, "Alice")("thirty"); // Error

// Effect of strictPropertyInitialization: true
class User {
  name: string;        // Error: not initialized
  email: string = "";  // OK: has initial value
  age?: number;        // OK: optional
  id!: string;         // OK: definite assignment assertion

  constructor(name: string) {
    this.name = name;  // OK: initialized in constructor
  }
}

// Effect of noImplicitAny: true
function processData(data) {} // Error: Parameter 'data' implicitly has an 'any' type
function processData(data: unknown) {} // OK: type explicitly specified

// Effect of useUnknownInCatchVariables: true
try {
  throw new Error("boom");
} catch (error) {
  // Type of error is unknown (when true)
  // Type of error is any (when false)
  if (error instanceof Error) {
    console.log(error.message); // OK: narrowed to Error type
  }
}
```

### 2-2. Additional Strictness Options (not included in strict)

```typescript
// noUncheckedIndexedAccess: true (highly recommended)
// Adds undefined to array and object index access types
const arr: string[] = ["a", "b", "c"];
const item = arr[5]; // Type: string | undefined (when true)
                      // Type: string (when false)

// Safe usage pattern
if (item !== undefined) {
  console.log(item.toUpperCase()); // OK: after undefined check
}

// for...of and forEach are not affected
for (const item of arr) {
  console.log(item.toUpperCase()); // OK: item is string
}

// Also applies to Record type index access
const dict: Record<string, number> = { a: 1, b: 2 };
const value = dict["unknown"]; // Type: number | undefined
// This ensures safe access for dictionary types

// exactOptionalPropertyTypes: true
// Distinguishes between explicit undefined assignment and omission
interface Config {
  debug?: boolean;
}
const config1: Config = {};                        // OK: debug omitted
const config2: Config = { debug: true };           // OK
const config3: Config = { debug: undefined };      // Error!
// To explicitly assign undefined, write debug?: boolean | undefined

// Why this distinction matters:
// The result of Object.hasOwn(config, "debug") differs
// Omitted: false, Assigned undefined: true

// noPropertyAccessFromIndexSignature: true
// Disallow dot access to index signatures
interface Dict {
  [key: string]: string;
  knownKey: string;
}
declare const dict: Dict;
dict.knownKey;      // OK: known property
dict.unknownKey;    // Error: use dict["unknownKey"] instead
dict["unknownKey"]; // OK: bracket access enforced

// noImplicitOverride: true
// Make overrides explicit
class Base {
  greet() { return "hello"; }
}

class Derived extends Base {
  greet() { return "hi"; } // Error: override keyword required
  override greet() { return "hi"; } // OK
}

// noFallthroughCasesInSwitch: true
// Disallow switch fallthrough
function process(status: string) {
  switch (status) {
    case "active":
      console.log("Active");
      // Error: no break (fallthrough)
    case "inactive":
      console.log("Inactive");
      break;
  }
}

// allowUnreachableCode: false
// Make unreachable code an error
function example(x: number) {
  return x;
  console.log("unreachable"); // Error: Unreachable code detected
}

// allowUnusedLabels: false
// Make unused labels an error
function search(matrix: number[][]) {
  loop: // Error: unused label
  for (const row of matrix) {
    for (const cell of row) {
      if (cell === 0) break;
    }
  }
}
```

### 2-3. Incremental Approach to Strictification

```json
// Step 1: Minimal strict options (when migrating existing projects)
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": true
  }
}

// Step 2: Add null checks
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// Step 3: Stricter function types
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true
  }
}

// Step 4: Enable all strict options
{
  "compilerOptions": {
    "strict": true
  }
}

// Step 5: Additional strictness
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## 3. module / moduleResolution

### 3-1. module Option

```
module option and output format:

  TypeScript source       module          output
  +-----------+         +-----------+    +-----------+
  | import x  |  -----> | ESNext    | -> | import x  |
  | from "y"  |         +-----------+    | from "y"  |
  +-----------+         +-----------+    +-----------+
                        | CommonJS  | -> | const x = |
                        +-----------+    | require() |
                        +-----------+    +-----------+
                        | NodeNext  | -> | ESM or CJS|
                        +-----------+    | (auto-detect) |
                        +-----------+    +-----------+
                        | Preserve  | -> | as-is     |
                        +-----------+    | preserved |
```

```json
// Frontend (using a bundler)
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}

// Node.js backend (ESM)
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}

// Library (ESM output + type definitions)
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true
  }
}

// Node.js backend (CJS -- legacy)
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node"
  }
}
```

### 3-2. Differences in moduleResolution

| Value | Import resolution | Extensions | package.json exports | Use case |
|---|---|---|---|---|
| `bundler` | Bundler-compliant | Can omit | Supported | Vite, webpack |
| `NodeNext` | Node.js ESM-compliant | Required (.js) | Supported | Node.js |
| `node` (legacy) | CJS-compliant | Can omit | Not supported | Legacy |
| `node16` | Node.js 16-compliant | Required (.js) | Supported | Node.js 16 |
| `classic` | TypeScript-specific | Can omit | Not supported | Deprecated |

```typescript
// Behavior of moduleResolution: "bundler"
// Extensions can be omitted (assumes bundler will resolve)
import { utils } from "./utils";       // OK: finds ./utils.ts
import { config } from "./config";     // OK: finds ./config.ts
import { Button } from "@/components"; // OK: path aliases also supported

// Behavior of moduleResolution: "NodeNext"
// .js extension is required (per Node.js ESM spec)
import { utils } from "./utils.js";    // OK: specify post-compile extension
import { config } from "./config.js";  // OK
// import { utils } from "./utils";    // Error: extension required

// Relationship with package.json "type" field in NodeNext
// package.json "type": "module" → .ts files treated as ESM
// package.json "type": "commonjs" → .ts files treated as CJS
// .mts files → always ESM
// .cts files → always CJS
```

### 3-3. module: "Preserve" (TypeScript 5.4+)

```typescript
// module: "Preserve" keeps the input module syntax as-is
// Performs the same resolution as moduleResolution: "bundler"
// while outputting import/require exactly as written

// tsconfig.json
{
  "compilerOptions": {
    "module": "Preserve",
    "moduleResolution": "bundler"
  }
}

// Input
import { foo } from "./foo";
const bar = require("./bar");

// Output (preserved as-is)
import { foo } from "./foo";
const bar = require("./bar");
// Configuration assumes the bundler handles final resolution
```

### 3-4. Integration with package.json exports Field

```json
// Library package.json
{
  "name": "my-lib",
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
    "./utils": {
      "import": {
        "types": "./dist/utils.d.ts",
        "default": "./dist/utils.js"
      }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

```
Resolution order of the exports field:

  import { x } from "my-lib"
       |
       v
  Check "exports" in package.json
       |
  +----+----+
  |         |
  ESM       CJS
  |         |
  "import"  "require"
  |         |
  types →   types →
  default   default
```

---

## 4. Path Aliases

### 4-1. Basic Configuration

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"],
      "@types/*": ["src/types/*"],
      "@lib/*": ["src/lib/*"],
      "@hooks/*": ["src/hooks/*"],
      "@services/*": ["src/services/*"],
      "@config": ["src/config/index.ts"]
    }
  }
}

// Usage examples
import { Button } from "@components/Button";
import { formatDate } from "@utils/date";
import type { User } from "@types/user";
import { api } from "@lib/api";
import { useAuth } from "@hooks/useAuth";
import { UserService } from "@services/UserService";
import { config } from "@config";

// Note: paths is for type-checking only. Runtime resolution requires
// separate bundler configuration (Vite: resolve.alias)
// or tsconfig-paths
```

### 4-2. Integration with Bundler Configuration

```typescript
// Vite: vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@utils": path.resolve(__dirname, "src/utils"),
    },
  },
});

// webpack: webpack.config.js
module.exports = {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
    },
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
};

// Jest: jest.config.ts
const config = {
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
  },
};

// Vitest: vitest.config.ts (automatically picks up from vite.config.ts)
// Vite's resolve.alias is used directly

// Direct Node.js execution: use tsconfig-paths
// node --import tsconfig-paths/register src/index.ts
```

### 4-3. Fallback with Multiple Candidate Paths

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // When multiple paths are specified, resolution is attempted in order
      "@shared/*": [
        "packages/shared/src/*",
        "packages/shared/dist/*"
      ],
      // Exact match without wildcard
      "config": [
        "src/config/production.ts",
        "src/config/default.ts"
      ]
    }
  }
}
```

---

## 5. Project References

### 5-1. Basic Structure

```
Project references in a monorepo:

  packages/
  +-- shared/           <- shared library
  |   +-- tsconfig.json (composite: true)
  |   +-- src/
  +-- frontend/         <- frontend
  |   +-- tsconfig.json (references: [shared])
  |   +-- src/
  +-- backend/          <- backend
  |   +-- tsconfig.json (references: [shared])
  |   +-- src/
  +-- e2e/              <- E2E tests
      +-- tsconfig.json (references: [frontend, backend])
      +-- tests/

  tsc --build builds in dependency order
  → shared → frontend & backend (parallel) → e2e
```

```json
// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  },
  "include": ["src/**/*"]
}

// packages/frontend/tsconfig.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx"
  },
  "references": [
    { "path": "../shared" }
  ],
  "include": ["src/**/*"]
}

// packages/backend/tsconfig.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  },
  "references": [
    { "path": "../shared" }
  ],
  "include": ["src/**/*"]
}

// Root tsconfig.json (solution file)
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/frontend" },
    { "path": "packages/backend" },
    { "path": "packages/e2e" }
  ]
}
```

### 5-2. Build Commands

```bash
# Build with project references (auto-builds in dependency order)
tsc --build

# Watch mode
tsc --build --watch

# Clean build
tsc --build --clean

# Check build progress with verbose
tsc --build --verbose

# Build only a specific package (including dependencies)
tsc --build packages/frontend

# Force parallel build (--build may automatically parallelize)
tsc --build --force

# Dry run (does not actually build)
tsc --build --dry
```

### 5-3. Constraints and Effects of composite

```
When composite: true is set:

  1. declaration: true is enforced
     → .d.ts files are always generated

  2. rootDir is automatically set to the directory
     of tsconfig.json (when not specified)

  3. All source files must match
     include/files patterns

  4. A .tsbuildinfo file is generated
     → Incremental builds become possible

  5. Referencing projects obtain type information
     via .d.ts (do not look at source directly)
```

---

## 6. Output-Related Options

### 6-1. declaration Options

```json
{
  "compilerOptions": {
    // Output type definition files (.d.ts)
    "declaration": true,

    // Output .d.ts.map files (for jumping to source)
    "declarationMap": true,

    // Output directory for type definitions (if different from outDir)
    "declarationDir": "./types",

    // Only output .d.ts, not .js
    "emitDeclarationOnly": true,

    // Output source maps
    "sourceMap": true,

    // Embed inline source maps in .js files
    "inlineSourceMap": false,

    // Embed source code itself in source maps
    "inlineSources": false
  }
}
```

### 6-2. Build Output Configuration

```json
{
  "compilerOptions": {
    // Output directory
    "outDir": "./dist",

    // Root directory of source (affects output structure)
    "rootDir": "./src",

    // Specify multiple root directories
    "rootDirs": ["src", "generated"],

    // Output to a single file (only when module: "system" or "amd")
    "outFile": "./dist/bundle.js",

    // Do not include BOM (Byte Order Mark) in output
    "emitBOM": false,

    // Do not emit files (type-check only)
    "noEmit": true,

    // Emit even when errors exist
    "noEmitOnError": true,

    // Use imported helper functions (reduces output size)
    "importHelpers": true,

    // Do not inline helper functions when downleveling
    "noEmitHelpers": false,

    // Line ending
    "newLine": "lf",

    // Do not include comments in output
    "removeComments": false,

    // Transpile each file independently
    "isolatedModules": true
  }
}
```

### 6-3. Importance of isolatedModules

```typescript
// Syntax disallowed when isolatedModules: true

// 1. Exporting const enums (cross-file inlining is not possible)
// NG:
export const enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// OK: use a regular enum
export enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// 2. Re-exporting types only
// NG:
import { User } from "./types";
export { User }; // Unclear whether User is a type or a value

// OK: explicitly use the type keyword
import type { User } from "./types";
export type { User };
// or
export { type User } from "./types";

// 3. Declaration-only files (no value exports)
// NG: this file has no value exports
declare const x: number;

// OK: export something as a value
export {};
declare const x: number;

// Why you should enable isolatedModules:
// Transpilers like esbuild, SWC, and Babel transform files individually,
// so using syntax that requires cross-file information will break the build
```

---

## 7. jsx Option

```
jsx option output:

  Input: <div>Hello</div>

  "jsx": "preserve"      → <div>Hello</div>        (.jsx)
  "jsx": "react"         → React.createElement(...) (.js)
  "jsx": "react-jsx"     → _jsx("div", ...)         (.js)
  "jsx": "react-jsxdev"  → _jsxDEV("div", ...)      (.js)
  "jsx": "react-native"  → <div>Hello</div>         (.js)
```

```json
// React 17+ (automatic JSX transform)
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}

// Preact
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}

// Solid.js (use preserve since Vite handles the transform)
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}

// Emotion CSS-in-JS
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@emotion/react"
  }
}
```

---

## 8. Performance Optimization

### 8-1. Incremental Builds

```json
{
  "compilerOptions": {
    // Enable incremental builds
    "incremental": true,
    // Storage location for build info file
    "tsBuildInfoFile": "./.tsbuildinfo"
  }
}
```

```
Effect of incremental builds:

  First build:
  src/ (100 files) → tsc → dist/ + .tsbuildinfo

  Subsequent builds (3 files changed):
  src/ (3 files changed) → tsc → only 3 files recompiled

  Benefits:
  - Subsequent builds are 50-80% faster in large projects
  - .tsbuildinfo acts as a cache
  - Caching .tsbuildinfo in CI is effective
```

### 8-2. Speeding Up Large Projects

```json
// Performance optimization settings
{
  "compilerOptions": {
    // Skip type checking of .d.ts files
    "skipLibCheck": true,

    // Incremental builds
    "incremental": true,

    // Do not emit files (when type-checking only)
    "noEmit": true,

    // Auto-detection of import type
    "verbatimModuleSyntax": true,
    // ↑ Replaces isolatedModules + preserveValueImports + importsNotUsedAsValues
    //   with a single option
  },
  // Minimize target files
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/__tests__/**"
  ]
}
```

```bash
# tsc performance diagnostics
tsc --extendedDiagnostics

# Example output:
# Files:           1234
# Lines:           89012
# Nodes:           345678
# Identifiers:     123456
# Symbols:         67890
# Types:           34567
# Instantiations:  234567
# Memory used:     456MB
# I/O Read:        0.12s
# Parse time:      1.23s
# Bind time:       0.45s
# Check time:      5.67s
# Emit time:       0.89s
# Total time:      8.36s

# Debug module resolution with traceResolution
tsc --traceResolution > trace.txt 2>&1

# Generate a performance profile with generateTrace
tsc --generateTrace ./trace-output
# Open trace.json in Chrome at chrome://tracing for analysis
```

### 8-3. CI/CD Optimization

```yaml
# TypeScript build optimization in GitHub Actions
name: TypeCheck
on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # Cache .tsbuildinfo
      - uses: actions/cache@v4
        with:
          path: .tsbuildinfo
          key: tsbuildinfo-${{ hashFiles('tsconfig.json') }}-${{ github.sha }}
          restore-keys: |
            tsbuildinfo-${{ hashFiles('tsconfig.json') }}-

      # Run type checking only
      - run: tsc --noEmit --incremental
```

---

## Recommended Configurations by Use Case

### Next.js (App Router)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Node.js API Server

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "incremental": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### React SPA (Vite)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "vite-env.d.ts"],
  "exclude": ["node_modules"]
}
```

### npm Library

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noImplicitOverride": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Cloudflare Workers / Edge Runtime

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Electron App

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Comparison Tables

### target Values and Corresponding ECMAScript Features

| target | Key features | Node.js | Browser |
|--------|---------|---------|---------|
| ES2018 | async iteration, rest/spread | 10+ | All modern |
| ES2019 | `Array.flat()`, `Object.fromEntries()` | 12+ | All modern |
| ES2020 | `?.`, `??`, BigInt, `import()` | 14+ | All modern |
| ES2021 | `&&=`, `\|\|=`, `??=`, WeakRef | 16+ | All modern |
| ES2022 | Top-level await, `.at()`, `cause`, `#private` | 18+ | All modern |
| ES2023 | Array `.findLast()`, hashbang | 20+ | Latest |
| ES2024 | `Object.groupBy()`, `Promise.withResolvers()` | 22+ | Latest |
| ESNext | Latest Stage 4 proposals | Latest | Latest |

### lib Value Selection Guide

| Environment | lib | Description |
|------|-----|------|
| Browser | `["dom", "dom.iterable", "esnext"]` | DOM API + latest JS |
| Node.js | `["esnext"]` | JS only (no DOM) |
| Web Worker | `["webworker", "esnext"]` | Worker API |
| Service Worker | `["webworker", "esnext"]` | SW API |
| Shared library | `["esnext"]` | Environment-agnostic |
| Deno | `["deno.ns", "esnext"]` | Deno namespace |

### Compiler Options by Category

| Category | Option | Default | Recommended |
|---------|-----------|----------|------|
| Strictness | strict | false | true |
| Strictness | noUncheckedIndexedAccess | false | true |
| Strictness | exactOptionalPropertyTypes | false | Consider |
| Module | module | - | Depends on environment |
| Module | moduleResolution | - | bundler or NodeNext |
| Module | verbatimModuleSyntax | false | true |
| Module | isolatedModules | false | true |
| Output | outDir | - | ./dist |
| Output | declaration | false | true for libraries |
| Output | sourceMap | false | true |
| Output | noEmit | false | true when using bundler |
| Compatibility | esModuleInterop | false | true |
| Compatibility | skipLibCheck | false | true |
| Compatibility | forceConsistentCasingInFileNames | false | true |
| Performance | incremental | false | true |

---

## Anti-Patterns

### AP-1: Leaving strict: false as-is

```json
// NG: disable strict and abandon type safety
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false
  }
}
// any spreads everywhere, diminishing the value of using TypeScript
// Early bug detection is lost and refactoring safety is compromised

// OK: incrementally enable strict
{
  "compilerOptions": {
    "strict": true,
    // Temporarily relax individual flags during migration
    "strictPropertyInitialization": false
  }
}
```

### AP-2: Confusing skipLibCheck with Disabling All Type Checks

```json
// NG: Misunderstanding skipLibCheck as disabling all type checking
// skipLibCheck only skips checking .d.ts files
// It does not affect type checking of your own code

// OK: skipLibCheck: true is a recommended setting
// Avoids type conflicts between .d.ts files and improves build speed
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
// Especially useful when type conflicts occur between @types packages
// Type safety of your own code is maintained
```

### AP-3: Using moduleResolution: "node" in New Projects

```json
// NG: Using an outdated moduleResolution
{
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
// Does not support the "exports" field in package.json
// Cannot correctly resolve ESM

// OK: Use the latest setting for your use case
// When using a bundler:
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
// When running directly with Node.js:
{
  "compilerOptions": {
    "moduleResolution": "NodeNext"
  }
}
```

### AP-4: Setting paths Without Configuring the Bundler

```typescript
// Setting paths in tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"]
    }
  }
}

// NG: Forgetting to set Vite's resolve.alias
// → Type checking passes, but module not found at runtime

// OK: Always set the same alias in the bundler as well
// vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

### AP-5: Overly Broad include Scope

```json
// NG: Include the entire project
{
  "include": ["**/*"]
}
// All files except node_modules are scanned, degrading performance

// OK: Specify only the source directory
{
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Troubleshooting

### Common Errors and Solutions

```
Error: Cannot find module './utils' or its corresponding type declarations.

Cause: moduleResolution mismatch
Solution:
  1. For moduleResolution: "bundler"
     → Omitting extension is OK, check bundler configuration
  2. For moduleResolution: "NodeNext"
     → Add .js extension: import "./utils.js"
  3. Verify the file is included in the include pattern
```

```
Error: Type 'X' is not assignable to type 'Y'.
       Type 'undefined' is not assignable to type 'string'.

Cause: strictNullChecks is enabled
Solution:
  1. Add null/undefined check
     if (value !== undefined) { ... }
  2. Use optional chaining
     const name = user?.name ?? "default";
  3. Update type definition to allow undefined
     let name: string | undefined;
```

```
Error: 'X' is declared but its value is never read.

Cause: noUnusedLocals / noUnusedParameters is enabled
Solution:
  1. Prefix the variable name with _
     const _unused = someValue;
  2. Remove if truly unnecessary
  3. Adjust the option in tsconfig (not recommended)
```

```
Error: File 'X' is not listed within the file list of project 'Y'.
       Projects must list all files or use an 'include' pattern.

Cause: A file not included in include is referenced from a composite: true project
Solution:
  1. Fix the include pattern to cover the target file
  2. Add directly to files
  3. Check the referenced project's tsconfig
```

```
Error: Cannot use JSX unless the '--jsx' flag is provided.

Cause: jsx option is not set
Solution:
  {
    "compilerOptions": {
      "jsx": "react-jsx"  // React 17+
    }
  }
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

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
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

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

**Key Points:**
- Be mindful of algorithm complexity
- Choose the appropriate data structure
- Measure the effect with benchmarks
---

## FAQ

### Q1: Should I enable `verbatimModuleSyntax`?

Recommended for TypeScript 5.0 and later. This option clearly distinguishes `import type` from `import` and guarantees that type-only imports are not left in the runtime output. It is a superset that replaces parts of `isolatedModules` and `esModuleInterop`. Enabling it has the following effects:

- `import type { X }` is always removed from output
- Forces the `type` keyword on imports not used as values
- Improves compatibility with transpilers like esbuild and SWC
- Contributes to bundle size optimization

### Q2: When should I use `moduleResolution: "bundler"`?

Use it when using bundlers such as Vite, webpack, or esbuild. When running directly with Node.js, use `NodeNext`. `bundler` supports omitting extensions and implicit resolution of index files, matching bundler behavior. Specifically:

- Imports without extensions are allowed (`import "./utils"` is valid)
- Implicit resolution of `index.ts` is supported
- The `exports` field in `package.json` is correctly resolved
- ESM-specific syntax like `import.meta.url` is supported

### Q3: What is the difference between `composite` and `references`?

`composite: true` declares that a project can be referenced by other projects. `references` specifies the dependency projects. Both are needed when using `tsc --build` in a monorepo. Enabling `composite` enforces `declaration: true` and generates a `.tsbuildinfo` file.

### Q4: When should I use `noEmit: true` vs `emitDeclarationOnly: true`?

- `noEmit: true`: Does not output any files (type-check only). Use when the bundler generates JS and tsc is dedicated to type checking.
- `emitDeclarationOnly: true`: Only outputs `.d.ts` files. Use when generating JS with esbuild/SWC and generating type definitions with tsc.

### Q5: What is the relationship between `resolveJsonModule` and Import Attributes?

`resolveJsonModule: true` type-checks imports of `.json` files. TypeScript 5.3+ also supports Import Attributes (`import data from "./data.json" with { type: "json" }`). `resolveJsonModule` is a TypeScript-specific feature, while Import Attributes is an ECMAScript standard. Import Attributes will be recommended in the future, but both are valid at present.

### Q6: Should I enable `exactOptionalPropertyTypes`?

Recommended when you want to increase type strictness, but it may require many fixes in existing codebases. In particular, code that explicitly assigns `undefined` will error since `{ prop?: T }` and `{ prop?: T | undefined }` are distinguished. Consider enabling it in new projects.

### Q7: What should I do when tsc type checking is slow?

1. Skip `.d.ts` checking with `skipLibCheck: true`
2. Enable incremental builds with `incremental: true`
3. Identify bottlenecks with `tsc --extendedDiagnostics`
4. Minimize the scope of `include`
5. Split with project references to limit the impact of changes
6. Get a profile with `tsc --generateTrace` and identify code with many type instantiations

---

## Summary Table

| Concept | Key Points |
|------|------|
| strict | Always `true`. Temporarily relax with individual flags |
| target | Match the minimum version of the runtime environment |
| module | Bundler → ESNext, Node.js → NodeNext |
| moduleResolution | Bundler → bundler, Node.js → NodeNext |
| paths | For type checking only. Bundler config is also required at runtime |
| composite | Used for project references in monorepos |
| incremental | Essential for large projects. Also use cache in CI |
| verbatimModuleSyntax | Recommended for 5.0+. Ensures consistency of import type |
| isolatedModules | Required when using a bundler. File-by-file transpile compatibility |
| skipLibCheck | Recommended. Skips .d.ts checking to speed up builds |
| noUncheckedIndexedAccess | Recommended. Improves safety of array/dictionary access |

---


## Summary

This guide covered the following key points:

- Understanding basic concepts and principles
- Practical implementation patterns
- Best practices and things to watch out for
- How to apply these in real-world work

---

## Guides to Read Next

- [Build Tools](./01-build-tools.md) -- When to use tsc, esbuild, SWC, and Vite
- [ESLint + TypeScript](./04-eslint-typescript.md) -- Integration of compiler settings and linting
- [JS to TS Migration](./03-migration-guide.md) -- Incrementally tightening tsconfig strictness

---

## References

1. **TypeScript TSConfig Reference**
   https://www.typescriptlang.org/tsconfig

2. **@tsconfig/bases** -- Community-maintained tsconfig bases
   https://github.com/tsconfig/bases

3. **Matt Pocock - TSConfig Cheat Sheet**
   https://www.totaltypescript.com/tsconfig-cheat-sheet

4. **TypeScript Performance** -- Wiki on TypeScript Performance
   https://github.com/microsoft/TypeScript/wiki/Performance

5. **TypeScript Module Resolution**
   https://www.typescriptlang.org/docs/handbook/modules/reference.html
