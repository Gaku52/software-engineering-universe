# TypeScript Build Tools Complete Guide

> Compare tsc, esbuild, SWC, and Vite to build the optimal build pipeline for your project

## What You Will Learn

1. **Characteristics of each build tool** -- Design philosophy, speed, and feature differences between tsc, esbuild, SWC, and Vite
2. **Build pipeline design** -- Separating type checking from transpilation, development/production configuration patterns
3. **Migration and tuning** -- Speeding up builds in existing projects and migration steps between tools
4. **Build strategies in monorepos** -- Integration with Turborepo and Nx, leveraging caching
5. **Library builds and packaging** -- tsup, unbuild, ESM/CJS dual output


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content of [tsconfig.json Complete Guide](./00-tsconfig.md)

---

## 1. Build Tools Overview

### 1-1. Two Roles of TypeScript Builds

```
Separation of TypeScript builds:

  .ts files
       |
  +----+----+
  |         |
  v         v
Type check  Transpile
(tsc)       (esbuild / SWC / Vite)
  |         |
  v         v
Error report  .js files
  |         |
  +----+----+
       |
       v
  Deployable code

  Key point: Type checking and transpilation can be separated
  Use tsc only for type checking (--noEmit),
  and generate JS with a fast transpiler — this is the modern best practice
```

### 1-2. Speed Comparison (Reference for 100k-line projects)

```
Build speed comparison (relative values):

  tsc        ████████████████████████████████████  30s
  webpack+ts ████████████████████████████          25s
  Rollup+ts  ████████████████████                  18s
  Vite (dev) ██                                     2s (HMR)
  esbuild    █                                      0.5s
  SWC        █                                      0.4s

  * tsc includes type checking; others exclude it (transpile only)
  * esbuild and SWC are pure transpile speeds without type checking

Total time for type checking + transpilation:
  tsc only        ████████████████████████████████████  30s
  tsc + esbuild   ████████████████  + █                 15.5s
  tsc + SWC       ████████████████  + █                 15.4s
  tsc + Vite      ████████████████  + ██                17s

  → tsc type-check time stays the same, but
    delegating transpilation to fast tools
    dramatically speeds up dev server startup and HMR
```

### 1-3. Tool Selection Flowchart

```
Build tool selection guide:

  Q1: Frontend app?
  ├── Yes → Use Vite
  │         ├── React → @vitejs/plugin-react-swc
  │         ├── Vue → @vitejs/plugin-vue
  │         └── Svelte → @sveltejs/vite-plugin-svelte
  └── No
      Q2: npm library?
      ├── Yes → tsup (esbuild-based) or unbuild
      └── No
          Q3: Node.js backend?
          ├── Yes
          │   ├── Development → tsx (esbuild-based)
          │   └── Production → bundle with esbuild
          └── No
              Q4: Monorepo?
              ├── Yes → Turborepo + tools for each package
              └── → Choose a tool suited to the project
```

---

## 2. tsc (TypeScript Compiler)

### 2-1. Basic Commands

```typescript
// package.json scripts
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "build:project": "tsc --build",
    "build:clean": "tsc --build --clean"
  }
}

// Main tsc flags
// tsc                    → Build according to tsconfig.json
// tsc --noEmit           → Type check only (no file output)
// tsc --watch            → Watch for file changes and rebuild
// tsc --build            → Incremental build including project references
// tsc --declaration      → Generate .d.ts files
// tsc --project tsconfig.test.json → Use the specified config file
// tsc --extendedDiagnostics → Output performance diagnostic information
// tsc --generateTrace ./trace → Generate performance trace
```

### 2-2. Incremental Builds

```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  }
}
// Saves previous build info to .tsbuildinfo,
// and recompiles only changed files
// → Dramatically speeds up builds from the second run onward
```

```
Effect of incremental builds (measured example):

  First run:     30.2s (all files)
  Second run:     4.1s (no changes, cache validation only)
  Third run:      6.8s (10 files changed)
  After clean:   30.5s (no cache)

  → 70-85% speedup from the second run onward

  Contents of .tsbuildinfo file:
  - Hash of each file
  - Dependency graph
  - Snapshot of compiler options
  - Signatures of output files
```

### 2-3. Patterns for Using tsc with Other Tools

```json
// Pattern 1: tsc (type checking) + esbuild (transpilation)
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js",
    "prebuild": "npm run typecheck"
  }
}

// Pattern 2: tsc (type definition generation) + esbuild (JS generation)
{
  "scripts": {
    "build:types": "tsc --emitDeclarationOnly --declaration --declarationMap",
    "build:js": "esbuild src/index.ts --bundle --outfile=dist/index.js",
    "build": "npm run build:types && npm run build:js"
  }
}

// Pattern 3: Parallel execution (using concurrently)
{
  "scripts": {
    "dev": "concurrently \"tsc --noEmit --watch\" \"tsx watch src/index.ts\"",
    "build": "concurrently \"tsc --noEmit\" \"esbuild src/index.ts --bundle --outfile=dist/index.js\""
  }
}
```

### 2-4. tsc --build (Project Reference Build)

```bash
# Building in a monorepo
tsc --build                    # Build all packages
tsc --build packages/shared    # Only shared and its dependencies
tsc --build --watch            # Watch mode
tsc --build --verbose          # Verbose output
tsc --build --dry              # Dry run
tsc --build --clean            # Delete build artifacts
tsc --build --force            # Build everything ignoring cache
```

```
How tsc --build works:

  1. Analyze dependency graph
     shared → frontend (depends on shared)
           → backend (depends on shared)
           → e2e (depends on frontend, backend)

  2. Determine order via topological sort
     shared → [frontend, backend] → e2e

  3. Build each package in order
     - Check cache via .tsbuildinfo
     - Skip if no changes
     - Rebuild if changed

  4. Determine rebuilds for downstream packages
     - shared changed → rebuild frontend, backend, e2e
     - Only frontend changed → rebuild only frontend, e2e
```

---

## 3. esbuild

### 3-1. Basic Setup

```typescript
// esbuild.config.ts
import * as esbuild from "esbuild";

// Simple build
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: true,
  minify: process.env.NODE_ENV === "production",
});

// Multiple entry points
await esbuild.build({
  entryPoints: ["src/index.ts", "src/worker.ts"],
  bundle: true,
  outdir: "dist",
  splitting: true,  // Code splitting (ESM only)
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["pg", "redis"], // Packages to exclude from bundling
});

// Browser-targeted build
await esbuild.build({
  entryPoints: ["src/app.ts"],
  bundle: true,
  outfile: "dist/app.js",
  platform: "browser",
  target: ["chrome100", "firefox100", "safari16"],
  format: "esm",
  sourcemap: true,
  minify: true,
  // Bundle CSS as well
  loader: {
    ".png": "file",
    ".svg": "dataurl",
    ".css": "css",
  },
  // Embed environment variables
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env.VITE_API_URL": '"https://api.example.com"',
  },
});
```

### 3-2. esbuild Plugins

```typescript
import * as esbuild from "esbuild";
import { readFile } from "fs/promises";

// Creating a custom plugin
const envPlugin: esbuild.Plugin = {
  name: "env-plugin",
  setup(build) {
    // Load .env file and convert to definitions
    build.onResolve({ filter: /^env$/ }, (args) => ({
      path: args.path,
      namespace: "env-ns",
    }));

    build.onLoad({ filter: /.*/, namespace: "env-ns" }, async () => {
      const envFile = await readFile(".env", "utf-8");
      const env: Record<string, string> = {};
      for (const line of envFile.split("\n")) {
        const [key, ...valueParts] = line.split("=");
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join("=").trim();
        }
      }
      return {
        contents: JSON.stringify(env),
        loader: "json",
      };
    });
  },
};

// Rebuild notification plugin
const notifyPlugin: esbuild.Plugin = {
  name: "notify-plugin",
  setup(build) {
    let start: number;

    build.onStart(() => {
      start = Date.now();
      console.log("Build started...");
    });

    build.onEnd((result) => {
      const elapsed = Date.now() - start;
      if (result.errors.length > 0) {
        console.error(`Build failed in ${elapsed}ms with ${result.errors.length} errors`);
      } else {
        console.log(`Build completed in ${elapsed}ms`);
        if (result.warnings.length > 0) {
          console.warn(`  ${result.warnings.length} warnings`);
        }
      }
    });
  },
};

// Plugin to auto-detect external Node.js packages
const nodeExternalsPlugin: esbuild.Plugin = {
  name: "node-externals",
  setup(build) {
    // Mark all node_modules packages as external
    build.onResolve({ filter: /^[^./]/ }, (args) => ({
      path: args.path,
      external: true,
    }));
  },
};

// Using plugins
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  format: "esm",
  plugins: [envPlugin, notifyPlugin, nodeExternalsPlugin],
});
```

### 3-3. Development Server

```typescript
// esbuild watch + serve
const ctx = await esbuild.context({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outdir: "dist",
  platform: "node",
  format: "esm",
  sourcemap: true,
  plugins: [
    {
      name: "rebuild-notify",
      setup(build) {
        build.onEnd((result) => {
          console.log(
            `Build finished: ${result.errors.length} errors`
          );
        });
      },
    },
  ],
});

await ctx.watch(); // Watch for file changes and auto-rebuild

// Development server for frontend
const serveCtx = await esbuild.context({
  entryPoints: ["src/app.ts"],
  bundle: true,
  outdir: "public/dist",
  platform: "browser",
  format: "esm",
  sourcemap: true,
});

// Start the development server
const { host, port } = await serveCtx.serve({
  servedir: "public",
  port: 3000,
});
console.log(`Dev server running at http://${host}:${port}`);
```

### 3-4. esbuild Limitations

```
TypeScript features not supported by esbuild:

  1. Type checking
     → Run tsc --noEmit separately

  2. const enum (cross-file inlining)
     → Work around with isolatedModules: true
     → Treated as a regular enum

  3. Decorators (experimentalDecorators)
     → ECMAScript standard decorators (Stage 3) are supported
     → Legacy TypeScript decorators have partial support via --loader=ts

  4. Declaration file (.d.ts) generation
     → Use tsc --emitDeclarationOnly together

  5. Some tsconfig options
     → emitDecoratorMetadata: not supported
     → paths: limited support (can be handled with a plugin)

  Solution: Use esbuild only for JS generation,
            leave all type-related work to tsc
```

### 3-5. package.json Configuration

```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm",
    "build:prod": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --minify --sourcemap",
    "dev": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --watch",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 4. SWC

### 4-1. Basic Setup

```json
// .swcrc
{
  "$schema": "https://swc.rs/schema.json",
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": false,
      "decorators": true,
      "dynamicImport": true
    },
    "target": "es2022",
    "transform": {
      "decoratorVersion": "2022-03"
    },
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "module": {
    "type": "es6",
    "strict": true,
    "noInterop": false
  },
  "sourceMaps": true,
  "minify": false
}
```

```json
// package.json
{
  "scripts": {
    "build": "swc src -d dist --strip-leading-paths",
    "build:watch": "swc src -d dist --strip-leading-paths --watch",
    "dev": "swc src -d dist --strip-leading-paths --watch",
    "typecheck": "tsc --noEmit"
  }
}
```

### 4-2. SWC + Node.js Execution

```json
// Run .ts files directly with @swc-node/register
{
  "scripts": {
    "start": "node --import @swc-node/register/esm src/index.ts",
    "dev": "node --import @swc-node/register/esm --watch src/index.ts"
  }
}
```

### 4-3. SWC Minification

```json
// Add minify settings to .swcrc
{
  "jsc": {
    "parser": { "syntax": "typescript" },
    "target": "es2022",
    "minify": {
      "compress": {
        "dead_code": true,
        "drop_console": true,
        "drop_debugger": true,
        "passes": 2,
        "unused": true
      },
      "mangle": {
        "toplevel": true,
        "keep_classnames": false,
        "keep_fnames": false
      }
    }
  },
  "minify": true
}
```

### 4-4. Detailed Comparison: SWC vs esbuild

```
Differences between SWC and esbuild:

  SWC (written in Rust):
  ├── Transpile only (bundling is experimental via swcpack)
  ├── Full decorator support (including emitDecoratorMetadata)
  ├── Embedded in Next.js / Parcel
  ├── Plugin system (Wasm / Rust)
  └── Minification support

  esbuild (written in Go):
  ├── Transpile + bundle
  ├── Built-in HTTP server
  ├── Tree-shaking support
  ├── Code splitting support
  └── Plugin system (JavaScript)

  Selection criteria:
  - Bundling needed → esbuild
  - NestJS / Angular (legacy decorators) → SWC
  - Next.js → SWC (built-in)
  - General-purpose transpilation → either
```

---

## 5. Vite

### 5-1. Basic Configuration

```
Vite development/production flow:

  Development (dev):
  +----------+     +---------+     +----------+
  | .ts files |  →  | esbuild |  →  | Browser  |
  | (source)  |     | (transform)|  | (ESM)    |
  +----------+     +---------+     +----------+
       ↑ HMR (updates in milliseconds)

  Production (build):
  +----------+     +---------+     +----------+
  | .ts files |  →  | Rollup  |  →  | Bundle   |
  | (source)  |     | + SWC   |     | (optimized)|
  +----------+     +---------+     +----------+

  Vite 6.x and later:
  +----------+     +---------+     +----------+
  | .ts files |  →  | Rolldown|  →  | Bundle   |
  | (source)  |     | (Rust)  |     | (fast)   |
  +----------+     +---------+     +----------+
```

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc"; // SWC-based React plugin

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
    // Rollup options
    rollupOptions: {
      output: {
        // Manual chunk splitting
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
        },
        // Chunk filename format
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    // Chunk size warning threshold
    chunkSizeWarningLimit: 500,
    // CSS code splitting
    cssCodeSplit: true,
  },
  resolve: {
    alias: {
      "@": "/src",
      "@components": "/src/components",
      "@hooks": "/src/hooks",
      "@utils": "/src/utils",
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    // Proxy configuration
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  // Environment variable prefix
  envPrefix: "VITE_",
});
```

### 5-2. Vite Plugins

```typescript
// Commonly used Vite plugins
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import checker from "vite-plugin-checker";
import { compression } from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    // React (SWC-based, fast)
    react(),

    // Automatically resolve paths from tsconfig.json
    tsconfigPaths(),

    // Real-time type checking + ESLint during development
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
      },
    }),

    // Gzip / Brotli compression
    compression({
      algorithm: "gzip",
      threshold: 1024,
    }),
    compression({
      algorithm: "brotliCompress",
      threshold: 1024,
    }),

    // Visualize bundle size
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
```

### 5-3. Library Mode

```typescript
// vite.config.ts -- Building as a library
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: true,           // Bundle type definitions into one file
      insertTypesEntry: true,      // Automatically set types in package.json
      tsconfigPath: "./tsconfig.build.json",
    }),
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "MyLib",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      // Do not bundle peer dependencies
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    // Generate source maps
    sourcemap: true,
    // Do not minify (for libraries)
    minify: false,
  },
});
```

### 5-4. SSR / Backend

```typescript
// vite.config.ts -- Node.js backend
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: true,
    target: "node20",
    outDir: "dist",
    rollupOptions: {
      input: "src/server.ts",
      output: {
        format: "esm",
        entryFileNames: "server.js",
      },
    },
  },
  ssr: {
    noExternal: true, // Bundle all dependencies
    // noExternal: ["specific-pkg"], // Bundle only specific ones
  },
});

// Example SSR configuration with Vite + Express
// vite.config.ts
export default defineConfig({
  build: {
    ssr: true,
    rollupOptions: {
      input: {
        server: "src/server.ts",
        entry: "src/entry-server.tsx",
      },
    },
  },
});
```

### 5-5. Environment Variable Management

```typescript
// .env file loading order:
// .env                # Always loaded
// .env.local          # Always loaded (recommend adding to .gitignore)
// .env.[mode]         # Loaded for the specified mode
// .env.[mode].local   # Loaded for the specified mode (recommend adding to .gitignore)

// .env
VITE_API_URL=https://api.example.com
VITE_APP_TITLE=My App

// .env.development
VITE_API_URL=http://localhost:8080
VITE_DEBUG=true

// .env.production
VITE_API_URL=https://api.production.com
VITE_DEBUG=false

// src/vite-env.d.ts -- Type definitions
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_DEBUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Usage example
const apiUrl = import.meta.env.VITE_API_URL; // type: string
const isDev = import.meta.env.DEV;            // type: boolean
const isProd = import.meta.env.PROD;          // type: boolean
const mode = import.meta.env.MODE;            // type: string
```

---

## 6. tsx -- TypeScript Execute

### 6-1. Basic Usage

```bash
# Install
npm install -D tsx

# Run TypeScript files directly
npx tsx src/index.ts

# Watch mode
npx tsx watch src/index.ts

# Run as ESM
npx tsx --esm src/index.ts

# REPL
npx tsx
```

```json
// package.json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts",
    "script": "tsx scripts/seed.ts"
  }
}
```

### 6-2. tsx vs ts-node vs node --loader

```
Comparison of TypeScript execution runners:

  tsx (esbuild-based):
  ├── Startup time: Very fast
  ├── Type checking: None
  ├── ESM support: Yes
  ├── tsconfig paths: Resolved automatically
  └── Configuration: Almost none required

  ts-node (tsc-based):
  ├── Startup time: Slow
  ├── Type checking: Yes (none in swc mode)
  ├── ESM support: Requires configuration
  ├── tsconfig paths: Requires tsconfig-paths
  └── Configuration: Extensive

  node --experimental-strip-types (Node.js 23+):
  ├── Startup time: Fastest
  ├── Type checking: None
  ├── ESM support: Yes
  ├── tsconfig paths: Not supported
  └── Configuration: None required
  └── Note: enum, namespace, etc. are not supported

  node --import @swc-node/register/esm:
  ├── Startup time: Fast
  ├── Type checking: None
  ├── ESM support: Yes
  ├── tsconfig paths: Requires configuration
  └── Configuration: Minimal
```

---

## 7. tsup / unbuild -- Library Builders

### 7-1. tsup Configuration

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  // Entry points
  entry: ["src/index.ts", "src/utils/index.ts"],

  // Output formats (ESM + CJS)
  format: ["esm", "cjs"],

  // Generate type definition files
  dts: true,

  // Source maps
  sourcemap: true,

  // Clean build
  clean: true,

  // External packages (do not bundle)
  external: ["react", "react-dom"],

  // Tree-shaking
  treeshake: true,

  // TypeScript target
  target: "es2020",

  // Output directory
  outDir: "dist",

  // Code splitting
  splitting: true,

  // Minify
  minify: false,
});
```

```json
// package.json (dual ESM/CJS package)
{
  "name": "my-lib",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
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
    "./utils": {
      "import": {
        "types": "./dist/utils/index.d.ts",
        "default": "./dist/utils/index.js"
      },
      "require": {
        "types": "./dist/utils/index.d.cts",
        "default": "./dist/utils/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  }
}
```

### 7-2. unbuild Configuration

```typescript
// build.config.ts
import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index"],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  // Auto-detect externals
  externals: ["react"],
});
```

### 7-3. tsup vs unbuild Comparison

```
Library builder comparison:

  tsup:
  ├── Engine: esbuild
  ├── Speed: Very fast
  ├── Configuration: Simple
  ├── DTS: esbuild + tsc (hybrid)
  ├── Tree-shaking: esbuild
  └── Recommended for: small to medium libraries

  unbuild:
  ├── Engine: Rollup
  ├── Speed: Fast
  ├── Configuration: Simple
  ├── DTS: rollup-plugin-dts
  ├── Tree-shaking: Rollup (high quality)
  └── Recommended for: Nuxt ecosystem

  Vite lib mode:
  ├── Engine: Rollup
  ├── Speed: Fast
  ├── Configuration: Requires Vite knowledge
  ├── DTS: vite-plugin-dts
  ├── Tree-shaking: Rollup (high quality)
  └── Recommended for: Libraries in Vite projects

  tsc:
  ├── Engine: TypeScript Compiler
  ├── Speed: Slow
  ├── Configuration: tsconfig.json
  ├── DTS: Native (most accurate)
  ├── Tree-shaking: None
  └── Recommended for: When accuracy of type definitions is paramount
```

---

## 8. Build Strategies in Monorepos

### 8-1. Turborepo

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

```bash
# Building with Turborepo
turbo build           # Build all packages (with cache)
turbo build --filter=web  # Only the web package
turbo build --force   # Ignore cache
turbo dev             # Dev server for all packages

# Remote cache (share cache across team members)
turbo login
turbo link
turbo build  # Use remote cache
```

### 8-2. Example Monorepo Package Structure

```
monorepo/
├── apps/
│   ├── web/               (Next.js)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/               (Node.js + esbuild)
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── shared/            (built with tsup)
│   │   ├── package.json
│   │   ├── tsup.config.ts
│   │   └── tsconfig.json
│   ├── ui/                (Vite lib mode)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   └── config-ts/         (shared tsconfig)
│       ├── base.json
│       ├── nextjs.json
│       ├── node.json
│       └── library.json
├── turbo.json
├── package.json
└── tsconfig.json
```

---

## 9. Optimal Pipeline Design

### 9-1. Frontend (React / Vue)

```
Recommended pipeline:

  Development:   Vite dev server (transpiled with esbuild)
  Type checking: tsc --noEmit (background or CI)
  Production build: Vite build (Rollup + minify)
  Testing:       Vitest (shares configuration with Vite)
  Lint:          ESLint + Prettier

  package.json:
  {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
```

### 9-2. Node.js Backend

```
Recommended pipeline:

  Development:   tsx (esbuild-based ts-node alternative)
  Type checking: tsc --noEmit
  Production build: esbuild (bundle + minify)
  Testing:       Vitest
  Lint:          ESLint

  package.json:
  {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit && esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --minify",
    "start": "node dist/index.js",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  }
```

### 9-3. npm Library

```
Recommended pipeline:

  Development:   run tests with tsx
  Type checking: tsc --noEmit
  Build:         tsup (esbuild-based, outputs both ESM + CJS)
  Type defs:     tsup --dts (uses tsc internally)
  Testing:       Vitest
  Publishing:    npm publish (build in prepublishOnly)

  package.json:
  {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "prepublishOnly": "npm run build && npm run typecheck"
  }
```

### 9-4. Full Stack (Next.js + tRPC)

```
Recommended pipeline:

  Framework:    Next.js (built-in SWC)
  API:          tRPC (shared types)
  DB:           Prisma (type generation)
  Validation:   zod
  Testing:      Vitest + Playwright

  package.json:
  {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "typecheck": "tsc --noEmit",
    "postinstall": "prisma generate"
  }
```

---

## Comparison Tables

### Comprehensive Build Tool Comparison

| Characteristic | tsc | esbuild | SWC | Vite | tsup |
|----------------|-----|---------|-----|------|------|
| Language | TypeScript | Go | Rust | JS (esbuild/Rollup) | JS (esbuild) |
| Type checking | Yes | No | No | No | No |
| Transpile speed | Slow | Fastest class | Fastest class | Fast (esbuild) | Fast (esbuild) |
| Bundling | No | Yes | Experimental | Yes (Rollup) | Yes |
| Tree-shaking | No | Yes | No | Yes | Yes |
| HMR | No | Basic | No | Excellent | No |
| Plugins | No | Yes | Yes | Rich | esbuild-compatible |
| Ease of configuration | Medium | High | Medium | High | Highest |
| .d.ts generation | Native | No | No | Plugin | Yes |
| CSS bundling | No | Yes | No | Yes | No |
| Code splitting | No | Yes (ESM) | No | Yes | Yes |

### Recommended Tools by Use Case

| Use case | Recommended | Reason |
|----------|-------------|--------|
| React / Vue SPA | Vite | HMR, rich plugins |
| Next.js | (built-in SWC) | Framework integration |
| Node.js API | esbuild / tsx | Fast, simple |
| npm library | tsup (esbuild) | ESM/CJS dual output, DTS generation |
| Monorepo | Turborepo + Vite/esbuild | Cache, parallel builds |
| Deno | (built-in) | No configuration needed |
| Bun | (built-in) | No configuration, fastest |
| Cloudflare Workers | wrangler (esbuild) | Edge-optimized |
| Electron | Vite + electron-builder | HMR + packaging |

### Performance Metrics (Measured Reference Values)

| Tool | 1,000 files | 5,000 files | 10,000 files |
|------|-------------|-------------|--------------|
| tsc (first run) | 3s | 12s | 30s |
| tsc (incremental) | 0.5s | 2s | 5s |
| esbuild (bundle) | 0.1s | 0.3s | 0.5s |
| SWC (transpile) | 0.08s | 0.25s | 0.4s |
| Vite (dev startup) | 0.5s | 1.5s | 3s |
| tsup | 0.3s | 0.8s | 1.5s |

---

## Anti-patterns

### AP-1: Using tsc for Both Transpilation and Bundling

```json
// Bad: Trying to do everything with tsc alone
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
// Problems:
// - No bundling (files are scattered)
// - No tree-shaking
// - Path resolution can break (paths)
// - Slow builds
// - Requires direct imports from node_modules

// Good: Separate type checking and building
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js",
    "prebuild": "npm run typecheck"
  }
}
```

### AP-2: Manual Reload Without a Dev Server

```json
// Bad: Manually build then run each time
{
  "scripts": {
    "dev": "tsc && node dist/index.js"
  }
}

// Good: Auto-restart on file change
{
  "scripts": {
    "dev": "tsx watch src/index.ts"
  }
}
// Or
{
  "scripts": {
    "dev": "node --import @swc-node/register/esm --watch src/index.ts"
  }
}
```

### AP-3: Slowing Down CI by Including Type Checking in the Build

```json
// Bad: Running build and type check in series
{
  "scripts": {
    "build": "tsc --noEmit && esbuild src/index.ts --bundle --outfile=dist/index.js"
  }
}

// Good: Run in parallel in CI
// .github/workflows/ci.yml
// jobs:
//   typecheck:
//     run: npm run typecheck
//   build:
//     run: npm run build:js
//   lint:
//     run: npm run lint
//   test:
//     run: npm test
```

### AP-4: Deploying Without Checking Bundle Size

```typescript
// Bad: Deploy without bundle analysis
// → Unnecessary dependencies included, hurting performance

// Good: Regularly perform bundle analysis
// vite.config.ts
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
// After npm run build, review dist/stats.html
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
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

### Exercise 2: Advanced Patterns

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
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, transaction management |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Gradual verification**: Use log output or a debugger to verify hypotheses
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
    """Decorator to log function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
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

Steps to diagnose performance issues when they occur:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Review disk and network I/O status
4. **Check concurrent connections**: Review connection pool status

| Problem type | Diagnostic tool | Solution |
|--------------|-----------------|---------|
| CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the decision criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|-----------|-----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to 2                     │
│                                                 │
│  2. How often do you deploy?                    │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily / multiple times → Go to 3         │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs long-term cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has a high short-term cost and can delay the project

**2. Consistency vs flexibility**
- A unified technology stack has a low learning cost
- Adopting diverse technologies enables the right tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction offers high reusability, but can make debugging difficult
- Low abstraction is intuitive, but code duplication tends to occur

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

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
        md += f"## Background\n{self.context}\n\n"
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

## FAQ

### Q1: What is the difference between tsx and ts-node?

tsx is esbuild-based and starts up very fast. ts-node is tsc-based and can perform type checking, but is slow. tsx is recommended for running files during development. Perform type checking separately with `tsc --noEmit`. ts-node also has a `--swc` flag, but tsx is easier to set up and faster.

### Q2: Does esbuild support enums?

esbuild treats `const enum` as a regular `enum`. This is fine if you have `isolatedModules: true` set (because cross-file inlining of `const enum` is disabled). The same applies when using `verbatimModuleSyntax`. Regular `enum` is supported without issues.

### Q3: Can the production build behavior in Vite differ from development?

Yes. During development, Vite transpiles with esbuild and serves ESM directly, but in production it bundles with Rollup. Rare behavioral differences can occur. It is recommended to verify the production build locally with `vite preview`. Specific differences include CSS loading order, granularity of dynamic import splitting, and the timing of environment variable resolution.

### Q4: Can Node.js 23+ --experimental-strip-types replace tsx?

It can be a partial replacement. Node.js's native TypeScript support simply strips type annotations and does not support TypeScript-specific syntax such as enum, namespace, and decorators. It also does not resolve tsconfig.json paths. It can be used for running simple TypeScript files, but tsx is still recommended for complex projects.

### Q5: Is migrating between build tools difficult?

In many cases, migrating transpilers is relatively straightforward. Migrations such as esbuild to SWC or webpack to Vite mainly involve rewriting configuration files. However, migration costs are higher if you depend on custom plugins or special configurations. It is recommended to first try the new tool on a small project, then migrate incrementally.

---

## Summary Table

| Concept | Key point |
|---------|-----------|
| Separation principle | Use separate tools for type checking (tsc) and transpilation |
| esbuild | Written in Go, fastest, can bundle, no type checking |
| SWC | Written in Rust, fastest, built into Next.js, full decorator support |
| Vite | Dev = esbuild, Production = Rollup, excellent HMR |
| tsup | esbuild-based library builder, generates DTS |
| tsx | esbuild-based ts-node alternative, fast, no configuration needed |
| Turborepo | Build caching for monorepos, parallel execution |
| unbuild | Rollup-based library builder |

---

## 10. Docker Build Optimization

### 10-1. Multi-stage Builds

```dockerfile
# ---- Builder stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies (optimize caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---- Production stage ----
FROM node:20-slim AS production

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy only build artifacts
COPY --from=builder /app/dist ./dist

# Run directly with Node.js
CMD ["node", "dist/index.js"]
```

### 10-2. When Bundled with esbuild

```dockerfile
# Bundling with esbuild makes node_modules unnecessary
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --minify

# ---- Lightweight Production stage ----
FROM node:20-slim AS production
WORKDIR /app

# Copy only the bundled file (no node_modules needed)
COPY --from=builder /app/dist/index.js ./index.js

CMD ["node", "index.js"]
# → Image size is dramatically reduced
```

### 10-3. .dockerignore Configuration

```
# .dockerignore
node_modules
dist
.git
.github
*.md
.env*
.tsbuildinfo
coverage
.vscode
.idea
```

---

## 11. Debugging Build Performance

### 11-1. Analyzing tsc Performance

```bash
# Detailed diagnostic information
tsc --extendedDiagnostics --noEmit

# Sample output:
# Files:               1,234
# Lines of Library:    35,678
# Lines of Definitions: 89,012
# Lines of TypeScript:  67,890
# Nodes:               345,678
# Identifiers:         123,456
# Symbols:              67,890
# Types:                34,567
# Instantiations:      234,567  ← Slow if this is large
# Memory used:         456,789K
# Assignability cache size: 12,345
# Identity cache size:  1,234
# Subtype cache size:   2,345
# Strict subtype cache: 3,456
# I/O Read time:        0.12s
# Parse time:           1.23s
# ResolveModule time:   0.34s
# ResolveTypeRef time:  0.05s
# Bind time:            0.45s
# Check time:           5.67s   ← Usually the largest
# printTime time:       0.89s
# Emit time:            0.89s
# Total time:           8.36s

# How to deal with large Instantiations:
# 1. Simplify complex generic types
# 2. Reduce nesting of conditional types
# 3. Avoid recalculating types (cache with type aliases)
```

### 11-2. Techniques to Improve Type Performance

```typescript
// Bad: Deeply nested conditional types (Instantiations explode)
type DeepPick<T, K extends string> =
  K extends `${infer First}.${infer Rest}`
    ? First extends keyof T
      ? { [P in First]: DeepPick<T[First], Rest> }
      : never
    : K extends keyof T
      ? { [P in K]: T[P] }
      : never;

// Good: Define intermediate types with interface to cache them
interface CachedDeepPick<T, First extends keyof T, Rest extends string> {
  [P in First]: DeepPick<T[First], Rest>;
}

// Bad: Large union types (checking is O(n^2))
type AllEvents = Event1 | Event2 | ... | Event100;

// Good: Use a mapped type with a discriminated union
interface EventMap {
  event1: Event1;
  event2: Event2;
  // ...
}
type AllEvents = EventMap[keyof EventMap];
```

---


## Summary

This guide covered the following key points:

- Understanding basic concepts and principles
- Practical implementation patterns
- Best practices and things to watch out for
- How to apply them in real-world work

---

## Guides to Read Next

- [tsconfig.json](./00-tsconfig.md) -- TypeScript configuration that integrates with build tools
- [Testing](./02-testing-typescript.md) -- Vitest configuration and build tool integration
- [ESLint + TypeScript](./04-eslint-typescript.md) -- Integrating lint into the build pipeline

---

## References

1. **esbuild** -- An extremely fast bundler for the web
   https://esbuild.github.io/

2. **SWC** -- Rust-based platform for the Web
   https://swc.rs/

3. **Vite** -- Next Generation Frontend Tooling
   https://vitejs.dev/

4. **tsx** -- TypeScript Execute
   https://tsx.is/

5. **tsup** -- Bundle your TypeScript library with no config
   https://tsup.egoist.dev/

6. **Turborepo** -- High-performance build system for JavaScript and TypeScript codebases
   https://turbo.build/repo

7. **unbuild** -- A unified JavaScript build system
   https://github.com/unjs/unbuild
