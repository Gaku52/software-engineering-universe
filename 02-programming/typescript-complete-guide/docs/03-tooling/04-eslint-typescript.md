# ESLint + TypeScript Complete Guide

> Use typescript-eslint to leverage type information for advanced static analysis and maintain TypeScript code quality

## What You Will Learn

1. **Setting up typescript-eslint** -- Configuration using Flat Config format, parser integration, and recommended rule sets
2. **Type-aware rules** -- Use `@typescript-eslint` type-checked rules to detect issues that tsc cannot find
3. **Per-project configuration** -- Optimal lint configurations for monorepos, React, Node.js, and libraries
4. **Performance optimization** -- Speedup techniques using TIMING, caching, and parallel execution
5. **Creating custom rules** -- Implementing custom rules using AST manipulation and type information access
6. **Comparison with alternatives** -- Feature and performance comparison with Biome and oxlint, and migration considerations


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [JavaScript to TypeScript Migration Guide](./03-migration-guide.md)

---

## Table of Contents

1. [ESLint + TypeScript Architecture](#1-eslint--typescript-architecture)
2. [Setup and Basic Configuration](#2-setup-and-basic-configuration)
3. [Comparing and Selecting Recommended Rule Sets](#3-comparing-and-selecting-recommended-rule-sets)
4. [Deep Dive into Type-Aware Rules](#4-deep-dive-into-type-aware-rules)
5. [Creating Custom Rules](#5-creating-custom-rules)
6. [Prettier Integration and Conflict Resolution](#6-prettier-integration-and-conflict-resolution)
7. [Per-Project Configuration Patterns](#7-per-project-configuration-patterns)
8. [Sharing Configuration in Monorepos](#8-sharing-configuration-in-monorepos)
9. [CI/CD Pipeline Integration](#9-cicd-pipeline-integration)
10. [Performance Tuning](#10-performance-tuning)
11. [Comparison with Biome/oxlint and Migration](#11-comparison-with-biomeoxlint-and-migration)
12. [Exercises](#12-exercises)
13. [FAQ](#13-faq)
14. [References](#14-references)

---

## 1. ESLint + TypeScript Architecture

### 1-1. Overall Structure

ESLint was originally a JavaScript-only linter, but the typescript-eslint project enables TypeScript support. This integration consists of three components.

```
ESLint + TypeScript Processing Flow:

  .ts file
       |
       v
  +--------------------------+
  | @typescript-eslint/parser|  Converts TSC AST to ESLint format
  +--------------------------+
       |
       v
  +--------------------------+
  | ESLint Rule Engine       |  Applies rules
  |  - @eslint/js            |  (JS standard rules)
  |  - @typescript-eslint    |  (TS-specific rules)
  |  - Type-aware rules      |  (TSC type checker integration)
  +--------------------------+
       |
       v
  Error / Warning Report
```

### 1-2. Core Components of typescript-eslint

typescript-eslint is composed of the following key packages.

```
typescript-eslint Ecosystem:

┌─────────────────────────────────────────┐
│ typescript-eslint (umbrella package)    │  ← Meta package
└─────────────────────────────────────────┘
              |
              v
    ┌─────────────────────┐
    │ @typescript-eslint/ │
    └─────────────────────┘
              |
    ┌─────────┴──────────────────┐
    |                             |
    v                             v
┌─────────┐                 ┌─────────┐
│ parser  │                 │ plugin  │
└─────────┘                 └─────────┘
    |                             |
    |                             v
    |                    ┌──────────────────┐
    |                    │ eslint-plugin    │
    |                    │ (rule collection) │
    |                    └──────────────────┘
    |                             |
    v                             v
┌──────────────────┐      ┌────────────────┐
│ TypeScript       │<---->│ Type Checker   │
│ Compiler API     │      │ (type info)    │
└──────────────────┘      └────────────────┘
```

#### @typescript-eslint/parser

A parser that converts TypeScript code into an AST (Abstract Syntax Tree) that ESLint can understand. It converts the TypeScript Compiler's AST into ESTree-compatible format.

```typescript
// Role of the parser

// TypeScript code
const greeting: string = "Hello";

// TypeScript Compiler AST (TSC)
{
  kind: SyntaxKind.VariableDeclaration,
  name: { text: "greeting" },
  type: { kind: SyntaxKind.StringKeyword }
}

// ESTree format (format that ESLint understands)
{
  type: "VariableDeclaration",
  declarations: [{
    id: { type: "Identifier", name: "greeting" },
    typeAnnotation: { type: "TSStringKeyword" }
  }]
}
```

#### @typescript-eslint/eslint-plugin

A plugin that provides TypeScript-specific rule collections. It includes over 300 rules, many of which leverage type information.

```typescript
// Examples of rules provided by the plugin
{
  rules: {
    "@typescript-eslint/no-explicit-any": "error",           // Prohibit any
    "@typescript-eslint/no-floating-promises": "error",      // Detect unhandled Promises
    "@typescript-eslint/switch-exhaustiveness-check": "error" // switch exhaustiveness
  }
}
```

#### typescript-eslint (umbrella package)

A meta package introduced in v8 that integrates parser and plugin for easy use.

```typescript
// Recommended installation from v8 onwards
npm install -D eslint typescript-eslint

// Before v7 (legacy)
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### 1-3. Type Information Utilization Mechanism

The greatest feature of typescript-eslint is providing rules that use type information by integrating with the TypeScript Compiler's type checker.

```
How type-aware rules work:

  1. Load tsconfig.json
       |
       v
  2. Initialize TypeScript Compiler's type checker
       |
       v
  3. Retrieve type information for each file
       |
       v
  4. Rules access type information
       |
       v
  5. Execute type-based validation
```

```typescript
// Example of a type-aware rule

// Internal workings image of the no-floating-promises rule
function checkNode(node: TSESTree.Node) {
  // 1. Get type information for the node
  const type = checker.getTypeAtLocation(node);

  // 2. Check if it is a Promise type
  if (isPromiseType(type)) {
    // 3. Check if await or .catch() is present
    if (!isHandled(node)) {
      context.report({
        node,
        messageId: "floatingPromise"
      });
    }
  }
}
```

This type-aware rule can find problems that ordinary static analysis cannot detect.

```typescript
// Problems detectable by type-aware rules

// Problem 1: Unhandled Promise
async function fetchData() {
  fetch("/api/data"); // <- no-floating-promises warns here
}

// Problem 2: Type-unsafe operation
function process(value: unknown) {
  value.method(); // <- no-unsafe-call warns here
}

// Problem 3: Misuse of async function
[1, 2, 3].forEach(async (n) => { // <- no-misused-promises warns here
  await processNumber(n);
});
```

### 1-4. Flat Config Architecture

Flat Config, introduced in ESLint v9, is a new configuration format that replaces the traditional `.eslintrc.*` format.

```
Legacy Config vs Flat Config:

Legacy (.eslintrc.json)          Flat (eslint.config.ts)
┌───────────────────┐            ┌───────────────────┐
│ .eslintrc.json    │            │ eslint.config.ts  │
│ .eslintignore     │            │   (ignores: [])   │
│ extends chain     │    →       │   spread configs  │
│ plugin loading    │            │   explicit import │
│ env/globals       │            │   languageOptions │
└───────────────────┘            └───────────────────┘

  Complex                           Simple
  Implicit                          Explicit
  Opaque config merging             Array merging
```

Benefits of Flat Config:

1. **Can be written in TypeScript** - Type-safe configuration
2. **Explicit imports** - Clear dependencies
3. **Simple merging** - Merged with array spread operator
4. **Single file** - No need for `.eslintignore`

```typescript
// Structure of Flat Config
export default [
  // Each element is a ConfigObject
  {
    files: ["**/*.ts"],           // Target files
    languageOptions: { /* ... */ }, // Parser settings
    plugins: { /* ... */ },       // Plugins
    rules: { /* ... */ }          // Rules
  },
  {
    ignores: ["dist/**"]          // Exclude patterns
  }
];
```

---

## 2. Setup and Basic Configuration

### 2-1. Installation

```bash
# Minimal configuration
npm install -D eslint typescript-eslint

# Configuration including Prettier integration
npm install -D eslint typescript-eslint eslint-config-prettier

# React project
npm install -D eslint typescript-eslint \
  eslint-plugin-react-hooks eslint-plugin-react-refresh

# Node.js project
npm install -D eslint typescript-eslint \
  eslint-plugin-node eslint-plugin-security
```

### 2-2. Basic Configuration File

```typescript
// eslint.config.ts (minimal configuration)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended
);
```

```typescript
// eslint.config.ts (configuration using type information)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

```typescript
// eslint.config.ts (full-featured configuration)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  // 1. Basic rules
  eslint.configs.recommended,

  // 2. TypeScript rules (strict + stylistic)
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // 3. Parser configuration
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 4. Custom rules
  {
    rules: {
      // async-related
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],

      // Type safety
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // Imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixable: "code" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",

      // Unused variables
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // switch exhaustiveness
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },

  // 5. Relaxed rules for test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },

  // 6. Exclude patterns
  {
    ignores: [
      "dist/",
      "build/",
      "coverage/",
      "node_modules/",
      "**/*.js",
      "**/*.mjs",
    ],
  },

  // 7. Prettier integration
  prettierConfig
);
```

### 2-3. package.json Script Configuration

```json
{
  "scripts": {
    // Basic
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",

    // Run type check and lint simultaneously
    "check": "tsc --noEmit && eslint src/",

    // Parallel execution (using npm-run-all)
    "check:parallel": "run-p typecheck lint",
    "typecheck": "tsc --noEmit",

    // With timing info (for performance investigation)
    "lint:timing": "TIMING=1 eslint src/",

    // Clear cache
    "lint:clean": "eslint src/ --cache --cache-location .eslintcache",

    // Changed files only
    "lint:changed": "eslint $(git diff --name-only --diff-filter=d HEAD -- '*.ts' '*.tsx')",

    // For CI (treat warnings as errors)
    "lint:ci": "eslint src/ --max-warnings 0"
  },
  "devDependencies": {
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "npm-run-all2": "^6.0.0"
  }
}
```

### 2-4. IDE Integration

#### VS Code Settings

```json
// .vscode/settings.json
{
  // ESLint extension settings
  "eslint.enable": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],

  // Enable Flat Config
  "eslint.useFlatConfig": true,

  // Auto-fix on save
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },

  // Prettier integration
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },

  // ESLint working directory
  "eslint.workingDirectories": [
    { "mode": "auto" }
  ],

  // Performance settings
  "eslint.lintTask.options": "--cache",

  // For debugging
  "eslint.trace.server": "off" // Change to "verbose" when troubleshooting
}
```

```json
// .vscode/extensions.json (recommended extensions)
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode"
  ]
}
```

#### WebStorm / IntelliJ IDEA Settings

```
Settings > Languages & Frameworks > JavaScript > Code Quality Tools > ESLint

1. [x] Automatic ESLint configuration
2. Run eslint --fix on save: [x]
3. Configuration file: eslint.config.ts
```

### 2-5. Git Hook Integration

```bash
# Install husky + lint-staged
npm install -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npm run lint-staged
```

---

## 3. Comparing and Selecting Recommended Rule Sets

### 3-1. Hierarchy of Rule Sets

typescript-eslint provides multiple rule sets, allowing you to incrementally increase strictness.

```
Rule set hierarchy:

  recommended
       |
       +-- Basic bug detection
       +-- No type information required
       +-- Number of rules: ~50
       |
       v
  recommendedTypeChecked
       |
       +-- Includes recommended
       +-- Adds type-aware rules
       +-- Number of rules: ~70
       |
       v
  strictTypeChecked
       |
       +-- Includes recommendedTypeChecked
       +-- Adds stricter rules
       +-- Number of rules: ~90
       |
       v
  strictTypeChecked + stylisticTypeChecked
       |
       +-- Includes strict
       +-- Adds code style consistency rules
       +-- Number of rules: ~110
```

### 3-2. recommended

Enables only basic bug detection rules. No type information required.

```typescript
// eslint.config.ts
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended
);
```

Key rules included:

- `@typescript-eslint/no-explicit-any` - Warns about use of any
- `@typescript-eslint/no-unused-vars` - Detects unused variables
- `@typescript-eslint/no-array-constructor` - Detects misuse of Array constructor
- `@typescript-eslint/ban-ts-comment` - Restricts use of @ts-ignore

Advantages:
- Fast (no type information needed)
- Easy to set up
- Easy to introduce into existing projects

Disadvantages:
- Cannot perform advanced checks using type information
- Cannot detect Promise misuse and similar issues

### 3-3. recommendedTypeChecked

Adds rules that use type information.

```typescript
// eslint.config.ts
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

Key rules added:

- `@typescript-eslint/no-floating-promises` - Detects unhandled Promises
- `@typescript-eslint/no-misused-promises` - Detects misuse of async functions
- `@typescript-eslint/await-thenable` - Detects await on non-Promise values
- `@typescript-eslint/no-unnecessary-condition` - Detects unnecessary conditional branches

Advantages:
- Finds problems that tsc cannot detect
- Prevents bugs in asynchronous processing
- Greatly improves type safety

Disadvantages:
- Slower execution due to type checking
- Requires tsconfig.json configuration

### 3-4. strictTypeChecked

A stricter rule set.

```typescript
// eslint.config.ts
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

Key rules added:

- `@typescript-eslint/no-confusing-void-expression` - Detects misuse of void expressions
- `@typescript-eslint/no-unnecessary-boolean-literal-compare` - Detects unnecessary boolean comparisons
- `@typescript-eslint/prefer-reduce-type-parameter` - Recommends using type parameters in reduce
- `@typescript-eslint/restrict-template-expressions` - Type restrictions in template strings

Advantages:
- Highest level of type safety
- Improved code consistency
- Ideal for library development

Disadvantages:
- Difficult to apply to existing code
- Some rules may be too strict

### 3-5. stylisticTypeChecked

Adds code style consistency rules.

```typescript
// eslint.config.ts
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

Key rules added:

- `@typescript-eslint/consistent-type-definitions` - Enforces consistency between type and interface
- `@typescript-eslint/consistent-type-imports` - Enforces use of import type
- `@typescript-eslint/prefer-function-type` - Enforces consistent function types
- `@typescript-eslint/array-type` - Enforces consistent array type notation

### 3-6. Rule Set Comparison Table

| Rule Set | Number of Rules | Type Info | Speed | Strictness | Recommended Use Case |
|-------------|---------|--------|------|--------|-----------|
| recommended | ~50 | Not required | Fastest | Low | Initial introduction, legacy code |
| recommendedTypeChecked | ~70 | Required | Slow | Medium | General projects |
| strictTypeChecked | ~90 | Required | Slow | High | Libraries, high quality requirements |
| strict + stylistic | ~110 | Required | Slow | Highest | Team development, OSS |

### 3-7. Recommended Rule Sets by Project Type

```typescript
// New projects: strictTypeChecked + stylisticTypeChecked
export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked
);

// Existing projects: start from recommendedTypeChecked
export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked
);

// Legacy code: recommended only
export default tseslint.config(
  ...tseslint.configs.recommended
);

// Libraries: strictTypeChecked + custom rules
export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  {
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
    },
  }
);
```

---

## 4. Deep Dive into Type-Aware Rules

Type-aware rules (type-checked rules) are the greatest feature of typescript-eslint. By integrating with the TypeScript Compiler's type checker, they can detect problems that ordinary static analysis cannot find.

### 4-1. no-floating-promises

Detects Promises left without await or .catch().

```typescript
// NG: Unhandled Promise
async function fetchData(): Promise<void> {
  const response = await fetch("/api/data");
  response.json(); // Warning: Promises must be awaited, end with a call to .catch, or end with a call to .then with a rejection handler
  // ↑ This Promise is not handled, and errors will be silently swallowed
}

// OK: use await
async function fetchData(): Promise<void> {
  const response = await fetch("/api/data");
  const data = await response.json();
  console.log(data);
}

// OK: handle errors with .catch()
async function fetchData(): Promise<void> {
  const response = await fetch("/api/data");
  response.json().catch((err) => {
    console.error("JSON parse error:", err);
  });
}

// OK: intentionally ignore with void operator
async function backgroundTask(): Promise<void> {
  void someAsyncOperation(); // execute in background
}

// NG: even if assigned to a variable, error if not awaited
async function fetchData(): Promise<void> {
  const promise = fetch("/api/data"); // Warning
  // promise is not awaited
}
```

Real-world example:

```typescript
// Problem: forgetting to close a database connection
class UserRepository {
  async save(user: User): Promise<void> {
    await db.insert(users).values(user);
    db.close(); // Warning: db.close() returns a Promise but is not awaited
  }
}

// Fix
class UserRepository {
  async save(user: User): Promise<void> {
    await db.insert(users).values(user);
    await db.close();
  }
}
```

### 4-2. no-misused-promises

Detects using Promises where they are not expected.

```typescript
// NG: async function as forEach callback
const items = [1, 2, 3];
items.forEach(async (item) => {
  // Warning: Promise returned in function argument where a void return was expected
  await processItem(item);
});
// forEach does not wait for the returned Promise, so errors are silently swallowed

// OK: sequential processing with for...of
for (const item of items) {
  await processItem(item);
}

// OK: parallel processing with Promise.all
await Promise.all(items.map((item) => processItem(item)));

// NG: Promise in a conditional expression
if (fetchUser(id)) { // Warning: Expected non-Promise value in a boolean conditional
  // A Promise is always truthy, so this condition is always true
}

// OK: await first, then evaluate condition
const user = await fetchUser(id);
if (user) {
  // ...
}

// NG: async function in addEventListener
button.addEventListener("click", async () => {
  // Warning: Promise-returning function provided to attribute where a void return was expected
  await handleClick();
});

// OK: with error handling
button.addEventListener("click", () => {
  handleClick().catch((err) => {
    console.error("Click handler error:", err);
  });
});
```

Real-world example:

```typescript
// Problem: misuse of Array.prototype.map
async function getUserNames(ids: string[]): Promise<string[]> {
  // NG: map does not wait for Promises
  const names = ids.map(async (id) => {
    const user = await fetchUser(id);
    return user.name;
  });
  return names; // Type error: returning Promise<string>[]
}

// Fix
async function getUserNames(ids: string[]): Promise<string[]> {
  const names = await Promise.all(
    ids.map(async (id) => {
      const user = await fetchUser(id);
      return user.name;
    })
  );
  return names;
}
```

### 4-3. await-thenable

Detects using await on values that do not need it.

```typescript
// NG: await on a non-Promise value
function getUser(id: string): User {
  return database[id];
}

async function main() {
  const user = await getUser("123"); // Warning: Unexpected await on a non-Promise value
}

// OK: only await functions that return Promises
async function getUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`).then((r) => r.json());
}

async function main() {
  const user = await getUser("123");
}

// NG: double await on already-awaited value
async function fetchData(): Promise<Data> {
  const response = await fetch("/api/data");
  const data = await await response.json(); // Warning: double await
  return data;
}
```

### 4-4. no-unnecessary-condition

Detects conditions that are always true or always false.

```typescript
// NG: condition that is always true
function process(value: string) {
  if (value !== undefined) { // Warning: Unnecessary conditional, value is always defined
    // value is of type string, so it can never be undefined
  }
}

// OK: conditional check for optional value
function process(value?: string) {
  if (value !== undefined) {
    // value is string | undefined, so this is appropriate
  }
}

// NG: condition that is always false
function check(num: number) {
  if (num === "123") { // Warning: This comparison appears to be unintentional
    // number and string can never be equal
  }
}

// NG: unnecessary null check
function greet(name: string) {
  return name ?? "Guest"; // Warning: Unnecessary nullish coalescing operator
  // name is of type string, so it can never be null/undefined
}

// OK: null check for optional value
function greet(name?: string) {
  return name ?? "Guest";
}
```

### 4-5. switch-exhaustiveness-check

Checks whether all cases of a union type are covered in a switch statement.

```typescript
// @typescript-eslint/switch-exhaustiveness-check: "error"

type Status = "active" | "inactive" | "pending" | "archived";

// NG: missing cases
function getLabel(status: Status): string {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "pending":
      return "Pending";
    // Warning: Switch is not exhaustive. Missing case: "archived"
  }
}

// OK: all cases covered
function getLabel(status: Status): string {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "pending":
      return "Pending";
    case "archived":
      return "Archived";
  }
}

// OK: covered with default
function getLabel(status: Status): string {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "pending":
      return "Pending";
    default:
      return "Other";
  }
}
```

Type-safe exhaustive check pattern:

```typescript
// Exhaustiveness check using the never type
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

function getLabel(status: Status): string {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "pending":
      return "Pending";
    default:
      // If a new value is added to Status, a type error occurs here
      return assertNever(status);
  }
}
```

### 4-6. no-unsafe-* Rule Group

Restricts operations on values of type any.

```typescript
// no-unsafe-assignment
function process(data: any) {
  const value: string = data; // Warning: Unsafe assignment of an any value
}

// no-unsafe-call
function execute(fn: any) {
  fn(); // Warning: Unsafe call of an any typed value
}

// no-unsafe-member-access
function getValue(obj: any) {
  return obj.value; // Warning: Unsafe member access .value on an any value
}

// no-unsafe-return
function getData(): string {
  const data: any = fetchData();
  return data; // Warning: Unsafe return of an any typed value
}

// OK: use type assertion or type guard
function process(data: unknown) {
  if (typeof data === "string") {
    const value: string = data;
  }
}

// OK: use a validation library like Zod
import { z } from "zod";

const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

function process(data: unknown) {
  const user = UserSchema.parse(data); // type-safe
  console.log(user.name);
}
```

### 4-7. prefer-nullish-coalescing

Detects cases where `??` should be used instead of `||`.

```typescript
// NG: using || treats 0 and '' as falsy
function getCount(count: number | undefined): number {
  return count || 0; // Warning: Prefer using nullish coalescing operator
  // Even if count is 0, 0 is returned (unintended behavior)
}

// OK: use ??
function getCount(count: number | undefined): number {
  return count ?? 0;
  // 0 is returned only when count is undefined
}

// Real-world example
interface Config {
  port?: number;
  debug?: boolean;
}

// NG: using || causes unintended behavior
function getConfig(config: Config) {
  const port = config.port || 3000; // Even if port: 0 is set, it becomes 3000
  const debug = config.debug || false; // Even if debug: false is set, it becomes false (looks correct but intent is unclear)
}

// OK: use ??
function getConfig(config: Config) {
  const port = config.port ?? 3000;
  const debug = config.debug ?? false;
}
```

### 4-8. Performance Impact of Type-Aware Rules

Type-aware rules significantly increase execution time due to type checking.

```
Benchmark (TypeScript project with 10,000 lines):

  recommended (without type information)
    └─ Execution time: 2.3 seconds

  recommendedTypeChecked (with type information)
    └─ Execution time: 12.8 seconds (5.6x)

  strictTypeChecked (with type information)
    └─ Execution time: 15.4 seconds (6.7x)
```

Ways to speed up:

```typescript
// 1. Use projectService (v8 onwards)
{
  languageOptions: {
    parserOptions: {
      projectService: true, // Faster than traditional project
      tsconfigRootDir: import.meta.dirname,
    },
  },
}

// 2. Enable caching
// package.json
{
  "scripts": {
    "lint": "eslint src/ --cache --cache-location .eslintcache"
  }
}

// 3. Lint only changed files
{
  "scripts": {
    "lint:changed": "eslint $(git diff --name-only --diff-filter=d HEAD -- '*.ts')"
  }
}
```

---

## 5. Creating Custom Rules

With typescript-eslint, you can create custom rules using AST manipulation and type information access.

### 5-1. Basic Rule Structure

```typescript
// my-rule.ts
import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rule/${name}`
);

export const myRule = createRule({
  name: "my-rule",
  meta: {
    type: "problem",
    docs: {
      description: "Rule description",
    },
    messages: {
      errorMessage: "Error message: {{value}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      // Visitor function for AST nodes
      Identifier(node) {
        if (node.name === "badName") {
          context.report({
            node,
            messageId: "errorMessage",
            data: {
              value: node.name,
            },
          });
        }
      },
    };
  },
});
```

### 5-2. Example: no-console-log Rule

A rule that prohibits console.log and requires use of logger instead.

```typescript
// rules/no-console-log.ts
import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rule/${name}`
);

export const noConsoleLog = createRule({
  name: "no-console-log",
  meta: {
    type: "suggestion",
    docs: {
      description: "Prohibit console.log and require use of logger.info",
    },
    messages: {
      useLogger: "Use logger.info instead of console.log",
    },
    fixable: "code",
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      MemberExpression(node: TSESTree.MemberExpression) {
        // Check for console.log
        if (
          node.object.type === "Identifier" &&
          node.object.name === "console" &&
          node.property.type === "Identifier" &&
          node.property.name === "log"
        ) {
          context.report({
            node,
            messageId: "useLogger",
            fix(fixer) {
              // Auto-fix: console.log → logger.info
              return fixer.replaceText(node, "logger.info");
            },
          });
        }
      },
    };
  },
});
```

### 5-3. Type-Aware Rule: no-untyped-fetch

A rule that prohibits using fetch return values without type assertions.

```typescript
// rules/no-untyped-fetch.ts
import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rule/${name}`
);

export const noUntypedFetch = createRule({
  name: "no-untyped-fetch",
  meta: {
    type: "problem",
    docs: {
      description: "fetch return values require type assertion or validation",
    },
    messages: {
      untypedFetch: "Handle fetch return values in a type-safe way (Zod, as, etc.)",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    return {
      AwaitExpression(node: TSESTree.AwaitExpression) {
        if (node.argument.type !== "CallExpression") return;

        const callee = node.argument.callee;
        if (callee.type !== "Identifier" || callee.name !== "fetch") return;

        // Check parent node
        const parent = node.parent;

        // Check if type assertion is present
        if (parent?.type === "TSAsExpression") return;

        // If variable declaration, check if type annotation is present
        if (
          parent?.type === "VariableDeclarator" &&
          parent.id.type === "Identifier" &&
          parent.id.typeAnnotation
        ) {
          return;
        }

        context.report({
          node,
          messageId: "untypedFetch",
        });
      },
    };
  },
});
```

Usage example:

```typescript
// NG: no type information
const response = await fetch("/api/users");

// OK: type assertion
const response = await fetch("/api/users") as Response<User[]>;

// OK: variable declaration with type annotation
const response: Response<User[]> = await fetch("/api/users");

// OK: Zod validation
const response = await fetch("/api/users");
const users = UserArraySchema.parse(await response.json());
```

### 5-4. Distributing as a Plugin

```typescript
// index.ts
import { noConsoleLog } from "./rules/no-console-log";
import { noUntypedFetch } from "./rules/no-untyped-fetch";

export default {
  rules: {
    "no-console-log": noConsoleLog,
    "no-untyped-fetch": noUntypedFetch,
  },
};
```

```typescript
// eslint.config.ts
import myPlugin from "./my-eslint-plugin";

export default [
  {
    plugins: {
      "my-plugin": myPlugin,
    },
    rules: {
      "my-plugin/no-console-log": "error",
      "my-plugin/no-untyped-fetch": "error",
    },
  },
];
```

### 5-5. Using AST Explorer

AST Explorer is useful when creating rules.

```
How to use AST Explorer:

1. Go to https://astexplorer.net/
2. Select Parser: @typescript-eslint/parser
3. Enter your code
4. Check the AST structure
5. Identify the node types to use in your rule
```

Example:

```typescript
// Code
const user = { name: "Alice" };

// AST (excerpt)
{
  type: "VariableDeclaration",
  declarations: [{
    type: "VariableDeclarator",
    id: { type: "Identifier", name: "user" },
    init: {
      type: "ObjectExpression",
      properties: [{
        type: "Property",
        key: { type: "Identifier", name: "name" },
        value: { type: "Literal", value: "Alice" }
      }]
    }
  }]
}
```

---

## 6. Prettier Integration and Conflict Resolution

### 6-1. Integration Basics

The basic division of responsibility is: ESLint for code quality rules, Prettier for code formatting.

```
ESLint vs Prettier:

ESLint
  ├─ Function: Code quality checks
  ├─ Examples: Unused variables, type errors, logic problems
  └─ Config: eslint.config.ts

Prettier
  ├─ Function: Code formatting
  ├─ Examples: Indentation, line breaks, semicolons
  └─ Config: .prettierrc
```

### 6-2. eslint-config-prettier

Disables ESLint formatting rules to avoid conflicts with Prettier.

```bash
npm install -D eslint-config-prettier
```

```typescript
// eslint.config.ts
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig, // place last to disable conflicting rules
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

### 6-3. Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

```
// .prettierignore
dist/
build/
coverage/
node_modules/
*.min.js
```

### 6-4. Execution Order

```json
// package.json
{
  "scripts": {
    // 1. Format with Prettier
    "format": "prettier --write 'src/**/*.{ts,tsx}'",

    // 2. Check with ESLint
    "lint": "eslint src/",

    // 3. Run together
    "check": "npm run format && npm run lint"
  }
}
```

VS Code integration:

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### 6-5. Rules That May Conflict

eslint-config-prettier disables the following rules:

```typescript
// Examples of rules that are disabled

// Indentation
"@typescript-eslint/indent": "off",

// Line breaks
"@typescript-eslint/comma-dangle": "off",

// Semicolons
"@typescript-eslint/semi": "off",

// Quotes
"@typescript-eslint/quotes": "off",

// Spaces
"@typescript-eslint/space-before-function-paren": "off",
```

When resolving conflicts manually:

```typescript
// eslint.config.ts
export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  {
    rules: {
      // Turn off rules that Prettier handles
      "@typescript-eslint/indent": "off",
      "@typescript-eslint/quotes": "off",
      "@typescript-eslint/semi": "off",
      "@typescript-eslint/comma-dangle": "off",

      // Keep quality rules enabled
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  }
);
```

### 6-6. Integration with dprint

dprint is a fast alternative to Prettier.

```bash
npm install -D dprint
```

```json
// dprint.json
{
  "typescript": {
    "semiColons": "prefer",
    "quoteStyle": "alwaysDouble",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "includes": ["**/*.{ts,tsx,js,jsx,json}"],
  "excludes": ["node_modules", "dist"]
}
```

```json
// package.json
{
  "scripts": {
    "format": "dprint fmt",
    "format:check": "dprint check"
  }
}
```

---

## 7. Per-Project Configuration Patterns

### 7-1. React Project

```typescript
// eslint.config.ts (React + TypeScript)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // React Refresh
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // React settings
      "react/react-in-jsx-scope": "off", // Not needed in React 17+
      "react/prop-types": "off", // Not needed when using TypeScript

      // Hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Accessibility
      ...jsxA11y.configs.recommended.rules,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  }
);
```

### 7-2. Next.js Project

```typescript
// eslint.config.ts (Next.js)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    // App Router server components
    files: ["app/**/*.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off", // Not needed for server components
    },
  }
);
```

### 7-3. Node.js / Express Project

```typescript
// eslint.config.ts (Node.js)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import nodePlugin from "eslint-plugin-node";
import securityPlugin from "eslint-plugin-security";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Node.js global variables
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        Buffer: "readonly",
      },
    },
  },
  {
    plugins: {
      node: nodePlugin,
      security: securityPlugin,
    },
    rules: {
      // Node.js rules
      "node/no-unsupported-features/es-syntax": "off", // Transpiled by TypeScript
      "node/no-missing-import": "off", // Defer to TypeScript resolution

      // Security rules
      ...securityPlugin.configs.recommended.rules,
      "security/detect-object-injection": "off", // Too many false positives

      // TypeScript specific
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  }
);
```

### 7-4. Library Project

```typescript
// eslint.config.ts (library)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      // All public APIs must have explicit types
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: true,
        },
      ],

      // Completely prohibit any
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // Consistent type definitions
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixable: "code" },
      ],

      // Naming conventions
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: {
            regex: "^I[A-Z]",
            match: false, // Prohibit I prefix
          },
        },
      ],
    },
  },
  {
    // Relax rules for test files
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  }
);
```

---

## 8. Sharing Configuration in Monorepos

### 8-1. Monorepo Structure Example

```
monorepo/
├── eslint.config.ts          ← Root config (shared rules)
├── packages/
│   ├── shared/
│   │   ├── eslint.config.ts  ← Library-specific rules
│   │   ├── src/
│   │   └── tsconfig.json
│   ├── web/
│   │   ├── eslint.config.ts  ← React-specific rules
│   │   ├── src/
│   │   └── tsconfig.json
│   └── api/
│       ├── eslint.config.ts  ← Node.js-specific rules
│       ├── src/
│       └── tsconfig.json
└── package.json
```

### 8-2. Root Configuration

```typescript
// eslint.config.ts (root)
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js", "*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Rules applied across the entire monorepo
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixable: "code" },
      ],
    },
  },
  prettierConfig,
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/*.js",
    ],
  }
);
```

### 8-3. Package-Specific Configuration

```typescript
// packages/shared/eslint.config.ts (library)
import rootConfig from "../../eslint.config.ts";

export default [
  ...rootConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      // Libraries are especially strict
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
    },
  },
];
```

```typescript
// packages/web/eslint.config.ts (React)
import rootConfig from "../../eslint.config.ts";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  ...rootConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
```

```typescript
// packages/api/eslint.config.ts (Node.js)
import rootConfig from "../../eslint.config.ts";
import nodePlugin from "eslint-plugin-node";

export default [
  ...rootConfig,
  {
    files: ["src/**/*.ts"],
    plugins: {
      node: nodePlugin,
    },
    rules: {
      // Node.js specific rules
      "node/no-unsupported-features/es-syntax": "off",
    },
  },
];
```

### 8-4. package.json Scripts

```json
// package.json (root)
{
  "scripts": {
    "lint": "npm run lint --workspaces --if-present",
    "lint:fix": "npm run lint:fix --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "workspaces": [
    "packages/*"
  ]
}
```

```json
// packages/web/package.json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit"
  }
}
```

### 8-5. Integration with Turborepo

```json
// turbo.json
{
  "pipeline": {
    "lint": {
      "cache": true,
      "outputs": []
    },
    "typecheck": {
      "cache": true,
      "outputs": []
    }
  }
}
```

```json
// package.json (root)
{
  "scripts": {
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  }
}
```

---

## 9. CI/CD Pipeline Integration

### 9-1. GitHub Actions

```yaml
# .github/workflows/lint.yml
name: Lint

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: ESLint
        run: npm run lint -- --max-warnings 0

      # Output ESLint results as PR comments
      - uses: reviewdog/action-eslint@v1
        if: always()
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          reporter: github-pr-review
          eslint_flags: "src/"
```

### 9-2. Lint Only Changed Files

```yaml
# .github/workflows/lint-changed.yml
name: Lint Changed Files

on:
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch full history

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - name: Get changed TypeScript files
        id: changed-files
        uses: tj-actions/changed-files@v42
        with:
          files: |
            **/*.ts
            **/*.tsx

      - name: Lint changed files
        if: steps.changed-files.outputs.any_changed == 'true'
        run: |
          echo "Changed files: ${{ steps.changed-files.outputs.all_changed_files }}"
          npx eslint ${{ steps.changed-files.outputs.all_changed_files }}
```

### 9-3. Leveraging Caching

```yaml
# .github/workflows/lint-with-cache.yml
name: Lint with Cache

on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      # Restore ESLint cache
      - name: Restore ESLint cache
        uses: actions/cache@v4
        with:
          path: .eslintcache
          key: eslint-${{ runner.os }}-${{ hashFiles('**/eslint.config.ts') }}

      - name: Lint
        run: npm run lint -- --cache --cache-location .eslintcache

      # Also leverage tsc cache
      - name: Restore tsc cache
        uses: actions/cache@v4
        with:
          path: .tsbuildinfo
          key: tsc-${{ runner.os }}-${{ hashFiles('**/tsconfig.json') }}

      - name: Type check
        run: npm run typecheck
```

### 9-4. Parallel Execution

```yaml
# .github/workflows/lint-parallel.yml
name: Lint (Parallel)

on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [shared, web, api] # Each package in the monorepo

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - name: Lint ${{ matrix.package }}
        run: npm run lint -w packages/${{ matrix.package }}
```

### 9-5. GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test

lint:
  stage: lint
  image: node:20
  cache:
    paths:
      - node_modules/
      - .eslintcache
  script:
    - npm ci
    - npm run lint -- --cache --cache-location .eslintcache --max-warnings 0
  artifacts:
    reports:
      junit: eslint-report.xml
```

### 9-6. Outputting Error Reports

```json
// package.json
{
  "scripts": {
    "lint:ci": "eslint src/ --format json --output-file eslint-report.json || true"
  }
}
```

```yaml
# .github/workflows/lint-report.yml
- name: Lint with JSON report
  run: npm run lint:ci

- name: Upload ESLint report
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: eslint-report
    path: eslint-report.json
```

---

## 10. Performance Tuning

### 10-1. Measuring Performance

```bash
# Measure execution time for each rule with the TIMING environment variable
TIMING=1 eslint src/

# Example output:
Rule                                    | Time (ms) | Relative
:---------------------------------------|----------:|--------:
@typescript-eslint/no-floating-promises |  2456.234 |    32.1%
@typescript-eslint/no-unsafe-assignment |  1234.567 |    16.1%
@typescript-eslint/no-misused-promises  |   987.654 |    12.9%
...
```

```json
// package.json
{
  "scripts": {
    "lint:timing": "TIMING=1 eslint src/"
  }
}
```

### 10-2. Leveraging projectService

projectService, introduced in v8, dramatically improves the performance of type-aware rules.

```typescript
// Traditional configuration (slow)
{
  languageOptions: {
    parserOptions: {
      project: "./tsconfig.json",
      tsconfigRootDir: import.meta.dirname,
    },
  },
}

// v8 configuration (fast)
{
  languageOptions: {
    parserOptions: {
      projectService: true, // Leverages TypeScript Language Service
      tsconfigRootDir: import.meta.dirname,
    },
  },
}
```

How projectService works:

```
Traditional project specification:
  1. Parse tsconfig.json
  2. Initialize TypeScript Compiler each time
  3. Analyze all files
  → Slow

projectService:
  1. Launch TypeScript Language Service
  2. Leverage incremental analysis
  3. Re-analyze only changed files
  → Fast (approximately 2-5x)
```

### 10-3. Leveraging Caching

```json
// package.json
{
  "scripts": {
    "lint": "eslint src/ --cache --cache-location .eslintcache",
    "lint:clean": "rm -rf .eslintcache && npm run lint"
  }
}
```

```
// .gitignore
.eslintcache
```

Effect of caching:

```
First run: 15.3 seconds
Second run (with cache): 1.2 seconds (12.8x faster)
```

### 10-4. Parallel Execution

```bash
# Use eslint-parallel
npm install -D eslint-parallel
```

```json
// package.json
{
  "scripts": {
    "lint": "eslint-parallel src/**/*.ts"
  }
}
```

Effect of parallel execution:

```
Single core: 15.3 seconds
4-core parallel: 4.8 seconds (3.2x faster)
8-core parallel: 3.1 seconds (4.9x faster)
```

### 10-5. Selective Rule Disabling

When performance is critical, disable specific rules.

```typescript
// eslint.config.ts
export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      // Particularly slow type-aware rules
      "@typescript-eslint/no-unnecessary-condition": "off", // slow
      "@typescript-eslint/strict-boolean-expressions": "off", // slow

      // Keep essential rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  }
);
```

### 10-6. Optimizing File Exclusions

```typescript
// eslint.config.ts
export default tseslint.config(
  // ...
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.min.js",
      "**/*.d.ts", // Exclude type definition files
      "**/generated/**", // Exclude auto-generated files
    ],
  }
);
```

### 10-7. CI Optimization

```yaml
# .github/workflows/lint.yml
jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      # 1. Shallow copy (no history needed)
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      # 2. Node.js cache
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      # 3. Dependency cache
      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

      # 4. ESLint cache
      - name: Cache ESLint
        uses: actions/cache@v4
        with:
          path: .eslintcache
          key: eslint-${{ runner.os }}-${{ hashFiles('**/eslint.config.ts') }}

      # 5. Parallel execution
      - name: Lint
        run: eslint-parallel src/**/*.ts --cache
```

### 10-8. Performance Benchmarks

```
Project size: 10,000 lines of TypeScript code

Configuration                            | Execution Time
-----------------------------------------|--------
recommended (without type info)          | 2.3 seconds
recommendedTypeChecked                   | 12.8 seconds
recommendedTypeChecked + projectService  | 6.4 seconds
+ caching                                | 0.8 seconds
+ parallel execution (4 cores)           | 2.1 seconds
+ changed files only                     | 0.3 seconds
```

---

## 11. Comparison with Biome/oxlint and Migration

### 11-1. Tool Comparison Table

| Feature | ESLint + typescript-eslint | Biome | oxlint |
|------|---------------------------|-------|--------|
| Supported languages | JS, TS, JSX, TSX | JS, TS, JSX, TSX, JSON | JS, TS, JSX, TSX |
| Number of rules | 300+ | 200+ | 350+ |
| Type-aware rules | Yes | No | No |
| Formatter | Prettier integration | Built-in | No |
| Speed | Slow | Fastest (25-100x) | Fastest (50-100x) |
| Ecosystem | Largest | Growing | Limited |
| Config file | eslint.config.ts | biome.json | .oxlintrc.json |
| Auto-fix | Yes | Yes | Yes (partial) |
| IDE integration | Excellent | Good | Limited |
| Plugins | Rich | Few | None |

### 11-2. Biome Features

Biome is a fast tool that replaces ESLint + Prettier.

```bash
# Installation
npm install -D @biomejs/biome
```

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.0.0/schema.json",
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "useConst": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "semicolons": "always",
      "quoteStyle": "double"
    }
  }
}
```

```json
// package.json
{
  "scripts": {
    "lint": "biome lint src/",
    "format": "biome format --write src/",
    "check": "biome check --write src/" // lint + format
  }
}
```

Advantages of Biome:

1. **Overwhelming speed** - Rust implementation, 25-100x faster than ESLint
2. **All-in-one** - Integrated lint + format
3. **Excellent defaults** - Usable with minimal configuration
4. **JSON support** - Can also format package.json and similar files

Disadvantages of Biome:

1. **No type-aware rules** - Cannot use no-floating-promises, etc.
2. **No plugins** - Cannot use React Hooks and other plugins
3. **Small ecosystem** - Hard to create custom rules

### 11-3. oxlint Features

oxlint is part of the Oxc project and is an ultra-fast linter.

```bash
# Installation
npm install -D oxlint
```

```json
// .oxlintrc.json
{
  "rules": {
    "no-floating-promises": "warn",
    "no-explicit-any": "error"
  }
}
```

```json
// package.json
{
  "scripts": {
    "lint": "oxlint src/"
  }
}
```

Advantages of oxlint:

1. **Fastest** - Rust implementation, the fastest available
2. **ESLint-compatible** - Implements many ESLint rules
3. **Works without type information** - Fast

Disadvantages of oxlint:

1. **No type-aware rules** - Cannot use the main features of typescript-eslint
2. **Under development** - Not yet stable
3. **No plugins** - Limited extensibility

### 11-4. Migration Decision Flowchart

```
Should you migrate from ESLint?

┌─────────────────────────────┐
│ Do you need type-aware rules?│
│ (no-floating-promises, etc.) │
└─────────────────────────────┘
          │
    ┌─────┴─────┐
    │           │
   Yes         No
    │           │
    v           v
┌─────┐   ┌────────────┐
│ESLint│   │ Biome/oxlint│
│Stay  │   │ Consider   │
└─────┘   └────────────┘
              │
              v
    ┌──────────────────┐
    │ Do you need       │
    │ React Hooks or   │
    │ other plugins?   │
    └──────────────────┘
              │
        ┌─────┴─────┐
        │           │
       Yes         No
        │           │
        v           v
    ┌─────┐   ┌──────┐
    │ESLint│   │ Biome│
    │Stay  │   │Recommend│
    └─────┘   └──────┘
```

### 11-5. Hybrid Configuration

It is also possible to use ESLint only for type-aware rules and Biome for everything else.

```json
// package.json
{
  "scripts": {
    "lint:biome": "biome check --write src/",
    "lint:eslint": "eslint src/ --cache",
    "lint": "npm run lint:biome && npm run lint:eslint"
  }
}
```

```typescript
// eslint.config.ts (type-aware rules only)
import tseslint from "typescript-eslint";

export default tseslint.config({
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    // Enable only type-aware rules
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-unnecessary-condition": "error",

    // Disable rules covered by Biome
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
});
```

```json
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  },
  "formatter": {
    "enabled": true
  }
}
```

### 11-6. Migration Case Studies

```
Project A (Next.js app)
  Before: ESLint + Prettier
    └─ lint time: 45 seconds
  After: Biome
    └─ check time: 2 seconds (22.5x faster)
  Trade-off: Lost React Hooks exhaustive-deps

Project B (Node.js API)
  Before: ESLint + typescript-eslint
    └─ lint time: 28 seconds
  After: ESLint (projectService) + Biome
    └─ lint time: 8 seconds (3.5x faster)
  Trade-off: None (type-aware rules continue with ESLint)

Project C (library)
  Before: ESLint + typescript-eslint (strict)
    └─ lint time: 12 seconds
  After: Stayed with ESLint
  Reason: Type-aware rules required, migration benefit small
```

---

## 12. Exercises

### Exercise 1: Basic Level

**Task**: Introduce ESLint to a new TypeScript project.

Requirements:
1. Install typescript-eslint
2. Create a configuration file in Flat Config format
3. Use recommendedTypeChecked
4. Allow any in test files

<details>
<summary>Example solution</summary>

```bash
# 1. Install
npm install -D eslint typescript-eslint

# 2. Create configuration file
touch eslint.config.ts
```

```typescript
// eslint.config.ts
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  }
);
```

```json
// package.json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  }
}
```

</details>

### Exercise 2: Intermediate Level

**Task**: Introduce ESLint + Prettier to a React project and integrate with VS Code.

Requirements:
1. ESLint + typescript-eslint + React plugins
2. Prettier integration
3. Auto-fix on save in VS Code
4. Git hooks (husky + lint-staged)

<details>
<summary>Example solution</summary>

```bash
# 1. Install packages
npm install -D eslint typescript-eslint \
  eslint-plugin-react-hooks eslint-plugin-react-refresh \
  eslint-config-prettier prettier \
  husky lint-staged

# 2. Set up husky
npx husky init
```

```typescript
// eslint.config.ts
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  prettierConfig,
  {
    ignores: ["dist/", "node_modules/"],
  }
);
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

```json
// package.json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write 'src/**/*.{ts,tsx}'"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npm run lint-staged
```

</details>

### Exercise 3: Advanced Level

**Task**: Create a custom rule `no-unhandled-fetch`.

Requirements:
1. Warn when a fetch call is not wrapped in try-catch
2. Use type information to check the Response type
3. Auto-fix is not required

<details>
<summary>Example solution</summary>

```typescript
// rules/no-unhandled-fetch.ts
import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rule/${name}`
);

export const noUnhandledFetch = createRule({
  name: "no-unhandled-fetch",
  meta: {
    type: "problem",
    docs: {
      description: "fetch must be called with try-catch error handling",
    },
    messages: {
      noTryCatch: "Call fetch inside a try-catch block",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function isInTryCatch(node: TSESTree.Node): boolean {
      let current = node.parent;
      while (current) {
        if (current.type === "TryStatement") {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        // Check for fetch calls
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "fetch"
        ) {
          // Check if inside try-catch
          if (!isInTryCatch(node)) {
            context.report({
              node,
              messageId: "noTryCatch",
            });
          }
        }
      },
    };
  },
});
```

```typescript
// index.ts
import { noUnhandledFetch } from "./rules/no-unhandled-fetch";

export default {
  rules: {
    "no-unhandled-fetch": noUnhandledFetch,
  },
};
```

```typescript
// eslint.config.ts
import myPlugin from "./my-eslint-plugin";

export default [
  {
    plugins: {
      "my-plugin": myPlugin,
    },
    rules: {
      "my-plugin/no-unhandled-fetch": "error",
    },
  },
];
```

```typescript
// Test
// NG: no try-catch
async function getData() {
  const response = await fetch("/api/data"); // Warning
}

// OK: with try-catch
async function getData() {
  try {
    const response = await fetch("/api/data");
    return await response.json();
  } catch (error) {
    console.error("Fetch error:", error);
  }
}
```

</details>

---

## 13. Edge Case Analysis

### Edge Case 1: Dynamic Import and Type Information

```typescript
// Problem: Cannot retrieve type information for dynamic imports

// NG: Type-aware rules may not analyze dynamic imports
async function loadModule(name: string) {
  const module = await import(`./modules/${name}`);
  // no-unsafe-member-access may produce false positives
  return module.default;
}

// Solution 1: Explicit type assertion
interface Module {
  default: SomeType;
}

async function loadModule(name: string) {
  const module = await import(`./modules/${name}`) as Module;
  return module.default;
}

// Solution 2: Partially disable the rule
async function loadModule(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const module = await import(`./modules/${name}`);
  return module.default;
}
```

### Edge Case 2: Generic Functions and Type Inference

```typescript
// Problem: Incomplete type information in generic functions

// NG: no-unnecessary-condition may produce false positives
function process<T>(value: T | null): T {
  if (value === null) { // May produce a warning
    throw new Error("Value is null");
  }
  return value;
}

// Solution: Use a type guard
function process<T>(value: T | null): T {
  if (!isNotNull(value)) {
    throw new Error("Value is null");
  }
  return value;
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
```

---

## 14. Anti-Patterns

### Anti-Pattern 1: Overusing eslint-disable

```typescript
// NG: disable without reason
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const data: any = response.body;

// NG: disable entire file
/* eslint-disable @typescript-eslint/no-explicit-any */

// OK: provide a reason and minimize scope
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- TODO: add type definition in #456
const data: any = response.body;

// Even better: fix the root cause
import { z } from "zod";
const ResponseSchema = z.object({ /* ... */ });
const data = ResponseSchema.parse(response.body);
```

### Anti-Pattern 2: Disabling All Type-Aware Rules

```typescript
// NG: disable all type-aware rules citing performance
{
  rules: {
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-misused-promises": "off",
    "@typescript-eslint/await-thenable": "off",
  }
}

// OK: use projectService for speed and keep rules enabled
{
  languageOptions: {
    parserOptions: {
      projectService: true, // for speed
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
  }
}
```

---

## 15. FAQ

### Q1: Should I migrate to Biome?

**A**: It depends on your project's requirements.

- **When Biome is appropriate**:
  - Type-aware rules (no-floating-promises, etc.) are not needed
  - Plugins like React Hooks are not needed
  - Speed of lint + format is the top priority
  - New projects

- **When ESLint is appropriate**:
  - Type-aware rules are essential (lots of async processing)
  - React Hooks exhaustive-deps is needed
  - Heavy use of custom rules or plugins
  - Existing large-scale projects

**Recommendation**: If type-aware rules are needed, use ESLint. If not, consider Biome.

### Q2: Which should I use, Flat Config or Legacy Config?

**A**: Use Flat Config (`eslint.config.ts`).

Reasons:
1. ESLint v9 and later use Flat Config as the default
2. Legacy Config (`.eslintrc.*`) is scheduled for removal in ESLint v10
3. typescript-eslint v8 also recommends Flat Config
4. Can write type-safe configuration in TypeScript
5. Simple config merging (array spread)

Use Legacy Config only for compatibility with existing projects.

### Q3: What should I do when CI execution is slow?

**A**: Implement the following optimizations.

1. **Use projectService** (v8 onwards)
```typescript
{
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
}
```

2. **Enable caching**
```json
{
  "scripts": {
    "lint": "eslint src/ --cache --cache-location .eslintcache"
  }
}
```

3. **Lint only changed files**
```bash
eslint $(git diff --name-only --diff-filter=d HEAD -- '*.ts' '*.tsx')
```

4. **Parallel execution**
```bash
npm install -D eslint-parallel
eslint-parallel src/**/*.ts
```

5. **Leverage CI caching**
```yaml
- uses: actions/cache@v4
  with:
    path: .eslintcache
    key: eslint-${{ hashFiles('**/eslint.config.ts') }}
```

Combining these can reduce execution time by 80-90%.

### Q4: How do I share rules in a monorepo?

**A**: Export the root configuration and import it in each package.

```typescript
// root/eslint.config.ts
export default tseslint.config(/* shared rules */);

// packages/web/eslint.config.ts
import rootConfig from "../../eslint.config.ts";

export default [
  ...rootConfig,
  { /* web-specific rules */ }
];
```

See "[Sharing Configuration in Monorepos](#8-sharing-configuration-in-monorepos)" for details.

### Q5: How do I create a custom rule?

**A**: Use `ESLintUtils.RuleCreator` from `@typescript-eslint/utils`.

Basic structure:

```typescript
import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/rule/${name}`
);

export const myRule = createRule({
  name: "my-rule",
  meta: { /* metadata */ },
  defaultOptions: [],
  create(context) {
    return {
      // Visitor for AST nodes
      Identifier(node) {
        // Rule logic
      },
    };
  },
});
```

See "[Creating Custom Rules](#5-creating-custom-rules)" for details.

### Q6: How do I allow any in test files?

**A**: Specify test files with the files pattern and disable the rule.

```typescript
// eslint.config.ts
export default tseslint.config(
  // ...
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  }
);
```

### Q7: How do I enable switch exhaustiveness checking?

**A**: Enable the `@typescript-eslint/switch-exhaustiveness-check` rule.

```typescript
{
  rules: {
    "@typescript-eslint/switch-exhaustiveness-check": "error"
  }
}
```

This produces a warning for switch statements that do not cover all cases of a union type.

See "[switch-exhaustiveness-check](#4-5-switch-exhaustiveness-check)" for details.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 16. Summary Table

| Concept | Key Points |
|------|------|
| typescript-eslint | TypeScript-specific ESLint parser + plugin |
| Flat Config | `eslint.config.ts` format, standard from ESLint v9 onwards |
| Type-aware rules | Advanced detection integrated with TypeScript Compiler's type checker |
| projectService | Dramatically improves performance of type-aware rules (v8 onwards) |
| no-floating-promises | Detects unhandled Promises |
| no-misused-promises | Detects Promise usage where not expected |
| switch-exhaustiveness-check | Checks exhaustiveness of switch statements |
| Prettier integration | Use eslint-config-prettier to disable conflicting rules |
| consistent-type-imports | Enforces consistent use of `import type` |
| Biome | Fast alternative to ESLint + Prettier (no type-aware rules) |
| oxlint | Ultra-fast linter (no type-aware rules, under development) |
| Custom rules | Can create custom rules with ESLintUtils.RuleCreator |

---

## 17. Next Guides to Read

- **[tsconfig.json](./00-tsconfig.md)** -- TypeScript compiler settings that integrate with ESLint
- **[Testing](./02-testing-typescript.md)** -- Lint rule configuration for test files
- **[Build Tools](./01-build-tools.md)** -- Integrating lint into the build pipeline
- **Type System** -- Fundamentals of the TypeScript type system

---

## 18. References

1. **typescript-eslint** -- The tooling that enables ESLint and Prettier to support TypeScript
   https://typescript-eslint.io/
   Official documentation. Rich in rule listings, configuration examples, and migration guides.

2. **ESLint Flat Config**
   https://eslint.org/docs/latest/use/configure/configuration-files
   Official documentation for the new ESLint v9 configuration format.

3. **Biome** -- One toolchain for your web project
   https://biomejs.dev/
   Fast alternative to ESLint + Prettier. Rust implementation boasting overwhelming speed.

4. **Oxc** -- The JavaScript Oxidation Compiler
   https://oxc-project.github.io/
   Next-generation JavaScript toolchain. Includes oxlint.

5. **AST Explorer**
   https://astexplorer.net/
   Tool for visualizing TypeScript AST structure. Useful when creating custom rules.

6. **typescript-eslint Performance**
   https://typescript-eslint.io/linting/troubleshooting/performance-troubleshooting
   Official guide for performance tuning.

7. **ESLint Rules Reference**
   https://eslint.org/docs/latest/rules/
   List of ESLint built-in rules.

8. **Prettier Documentation**
   https://prettier.io/docs/en/
   Official Prettier documentation. Details on configuration options.

---

## Appendix: Cheat Sheet

### Basic Configuration

```typescript
// Minimal configuration
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended
);
```

### Enabling Type-Aware Rules

```typescript
export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

### Commonly Used Rules

```typescript
{
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    "@typescript-eslint/switch-exhaustiveness-check": "error",
  }
}
```

### package.json Scripts

```json
{
  "scripts": {
    "lint": "eslint src/ --cache",
    "lint:fix": "eslint src/ --fix",
    "lint:timing": "TIMING=1 eslint src/",
    "check": "tsc --noEmit && eslint src/"
  }
}
```

### VS Code Settings

```json
{
  "eslint.useFlatConfig": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```
