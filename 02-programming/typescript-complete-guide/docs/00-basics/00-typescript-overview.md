# TypeScript Overview

> A statically typed language designed as a complete superset of JavaScript. Its type system dramatically improves code safety, maintainability, and developer experience.

## What You Will Learn in This Chapter

1. **What TypeScript is** -- Its relationship with JavaScript, the meaning of being a superset, and how compilation works
2. **The value the type system brings** -- Early bug detection, refactoring safety, and IDE assistance
3. **History and ecosystem** -- The background of its birth, version evolution, and major toolchains
4. **Project structure and configuration** -- Details of tsconfig.json, module systems, and build configuration
5. **Adoption strategies in practice** -- New projects, migration of existing projects, and incremental adoption
6. **TypeScript's internals** -- How the compiler works, the type inference engine, and type erasure
7. **Performance and optimization** -- Improving compile speed, project references, and incremental builds


## Prerequisites

Before reading this guide, the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What Is TypeScript

### A Superset of JavaScript

TypeScript is an open-source language released by Microsoft in 2012. All valid JavaScript code is also valid as TypeScript. TypeScript adds **static typing** on top of that.

The concept of being a "superset" is extremely important. It is similar to the relationship between C and C++, but with TypeScript, the difference is that it is converted to JavaScript after compilation. In other words, TypeScript's type information does not exist at runtime at all. This is called "Type Erasure".

```
+------------------------------------------+
|            TypeScript                     |
|  +------------------------------------+  |
|  |          JavaScript                |  |
|  |  +------------------------------+  |  |
|  |  |     ECMAScript Spec          |  |  |
|  |  +------------------------------+  |  |
|  +------------------------------------+  |
|  + Type Annotations                     |  |
|  + Interfaces                           |  |
|  + Generics                             |  |
|  + Enums                                |  |
|  + Other type features                  |  |
+------------------------------------------+
```

### Practical Meaning of Being a Superset

Being a superset brings the following practical benefits.

```typescript
// 1. You can rename existing JavaScript files directly to .ts
// rename: utils.js -> utils.ts
// You can fix the locations where type errors appear incrementally

// 2. JavaScript libraries can be used as-is
import _ from "lodash"; // JavaScript library
// Installing @types/lodash also enables type completion

// 3. Gradual typing via JSDoc comments is also possible
/**
 * @param {string} name
 * @returns {string}
 */
function greetJS(name) {
  return `Hello, ${name}!`;
}
// The TypeScript compiler also recognizes type information from JSDoc
```

### Code Example 1: JavaScript That Is Already TypeScript

```typescript
// This is valid JavaScript and at the same time valid TypeScript
const greet = (name) => `Hello, ${name}!`;
console.log(greet("World"));
```

### Code Example 2: Adding Type Annotations

```typescript
// Adding type annotations lets you leverage the power of TypeScript
const greet = (name: string): string => `Hello, ${name}!`;

// Compile error: Argument of type 'number' is not assignable to parameter of type 'string'
// greet(42);

console.log(greet("World")); // OK
```

### Compilation Flow

```
  TypeScript source code (.ts / .tsx)
         |
         v
  +-------------------+
  | TypeScript        |
  | compiler (tsc)    |
  +-------------------+
         |
    +----+----+
    |         |
    v         v
 JavaScript  Type error
 (.js)       reports
```

### Details of the Compilation Process

The internal processing of the TypeScript compiler (tsc) is divided into several phases.

```
  Source code (.ts)
       |
       v
  +-------------+
  | Scanner     |  Text -> Token stream
  +-------------+
       |
       v
  +-------------+
  | Parser      |  Token stream -> AST (Abstract Syntax Tree)
  +-------------+
       |
       v
  +-------------+
  | Binder      |  AST -> Symbol table construction
  +-------------+
       |
       v
  +-------------+
  | Checker     |  Type checking (the heaviest processing)
  +-------------+
       |
       v
  +-------------+
  | Emitter     |  AST -> JavaScript output
  +-------------+
       |
       v
  JavaScript (.js) + Declaration files (.d.ts) + Source maps (.js.map)
```

```typescript
// Concrete examples of what each phase of the compiler does

// Scanner: parses text and generates a token stream
// "const x: number = 42;" -> [const, x, :, number, =, 42, ;]

// Parser: builds an AST from the token stream
// VariableStatement
//   |- VariableDeclaration
//       |- Identifier: x
//       |- TypeAnnotation: NumberKeyword
//       |- Initializer: NumericLiteral(42)

// Binder: builds the symbol table
// Symbol "x" -> { type: number, flags: const, declarations: [...] }

// Checker: performs type checking
// The type of x (number) and the initial value (42: number) are compatible -> OK

// Emitter: outputs JavaScript
// "const x = 42;" (type annotations are removed)
```

### Code Example 3: Running the Compiler

```bash
# Install the TypeScript compiler
npm install -g typescript

# Compile
tsc hello.ts        # -> generates hello.js

# Compile (type-check only, no output)
tsc --noEmit hello.ts

# Generate declaration files
tsc --declaration hello.ts  # -> also generates hello.d.ts

# Generate source maps
tsc --sourceMap hello.ts    # -> also generates hello.js.map

# Watch mode (monitor file changes and auto-compile)
tsc --watch

# Compile to a specific target version
tsc --target ES2020 hello.ts

# Compile multiple files
tsc src/**/*.ts --outDir dist/
```

### Concrete Example of Type Erasure

```typescript
// TypeScript source
interface User {
  id: number;
  name: string;
}

function getUser(id: number): User {
  return { id, name: "Alice" };
}

const user: User = getUser(1);
console.log(user.name);
```

```javascript
// Compiled JavaScript (type information is completely erased)
"use strict";
function getUser(id) {
  return { id, name: "Alice" };
}
const user = getUser(1);
console.log(user.name);

// interface User has completely disappeared
// The argument types and return type of the function are also gone
// The variable's type annotation is also gone
```

### TypeScript Syntax That Is Not Erased

Some TypeScript-specific syntax remains as JavaScript code even after compilation.

```typescript
// 1. enum is converted into a JavaScript object
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}
// v After compilation
// var Direction;
// (function (Direction) {
//     Direction["Up"] = "UP";
//     Direction["Down"] = "DOWN";
//     Direction["Left"] = "LEFT";
//     Direction["Right"] = "RIGHT";
// })(Direction || (Direction = {}));

// 2. const enum is inlined
const enum StatusCode {
  OK = 200,
  NotFound = 404,
  ServerError = 500,
}
const code = StatusCode.OK;
// v After compilation
// const code = 200; // The value is embedded directly

// 3. namespace is converted to an IIFE
namespace MathUtils {
  export function add(a: number, b: number): number {
    return a + b;
  }
}
// v After compilation
// var MathUtils;
// (function (MathUtils) {
//     function add(a, b) { return a + b; }
//     MathUtils.add = add;
// })(MathUtils || (MathUtils = {}));

// 4. Decorators (experimentalDecorators) are converted into helper functions
// 5. Parameter properties are converted into constructor assignments
class Point {
  constructor(
    public x: number,
    public y: number
  ) {}
}
// v After compilation
// class Point {
//     constructor(x, y) {
//         this.x = x;
//         this.y = y;
//     }
// }
```

---

## 2. The Value Brought by the Type System

### Code Example 4: Types Prevent Bugs

```typescript
// JavaScript (you don't notice until runtime)
function calculateArea(width, height) {
  return width * height;
}
calculateArea("10", 20); // "1020" -- unintended string concatenation

// TypeScript (detected at compile time)
function calculateArea(width: number, height: number): number {
  return width * height;
}
// calculateArea("10", 20); // Compile error!
calculateArea(10, 20); // 200 -- correct result
```

### Detailed Patterns of Bug Prevention via Types

```typescript
// Pattern 1: Preventing access to null/undefined
function getLength(str: string | null): number {
  // str.length; // Error: Object is possibly 'null'
  if (str === null) return 0;
  return str.length; // OK: safe after the null check
}

// Pattern 2: Preventing access to non-existent properties
interface Config {
  host: string;
  port: number;
}

function createConnection(config: Config) {
  // config.hostname; // Error: Property 'hostname' does not exist
  return `${config.host}:${config.port}`; // OK
}

// Pattern 3: Type safety for array operations
const numbers: number[] = [1, 2, 3];
// numbers.push("4"); // Error: Argument of type 'string' is not assignable
numbers.push(4); // OK

// Pattern 4: Exhaustiveness checking in switch statements
type Shape = "circle" | "square" | "triangle";

function getArea(shape: Shape, size: number): number {
  switch (shape) {
    case "circle":
      return Math.PI * size * size;
    case "square":
      return size * size;
    case "triangle":
      return (Math.sqrt(3) / 4) * size * size;
    // If "triangle" is forgotten, the compiler warns
    // (when exhaustive check is enabled)
  }
}

// Pattern 5: Type checking the return value of a function
function divide(a: number, b: number): number {
  if (b === 0) {
    // return "Error"; // Error: Type 'string' is not assignable to type 'number'
    throw new Error("Division by zero");
  }
  return a / b;
}

// Pattern 6: Preventing implicit type conversions
const value: number = 42;
// const result: string = value; // Error: Type 'number' is not assignable to type 'string'
const result: string = String(value); // OK: explicit conversion
```

### Code Example 5: IDE Auto-Completion

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

function displayUser(user: User) {
  // The moment you type "user.", id, name, email, and createdAt appear as candidates
  console.log(`${user.name} <${user.email}>`);
}
```

### Details of IDE Support

TypeScript's type information enables advanced development support in IDEs (VSCode, WebStorm, etc.) such as the following.

```typescript
// 1. Auto-completion (IntelliSense)
interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// Just typing "response." displays data, status, headers, pagination as candidates
// Typing "response.pagination." displays page, perPage, total, totalPages
// Even deeply nested properties are completed accurately

// 2. Signature help (display of function argument information)
function createUser(
  name: string,
  email: string,
  options?: {
    role?: "admin" | "user" | "guest";
    active?: boolean;
    metadata?: Record<string, unknown>;
  }
): User {
  // ...
  return {} as User;
}
// The moment you type "createUser(", the type information of the three arguments is shown
// The structure of the third argument's object is also shown

// 3. Quick info (type information shown on hover)
const users = [
  { id: 1, name: "Alice", age: 30 },
  { id: 2, name: "Bob", age: 25 },
];
// Hovering on users displays { id: number; name: string; age: number; }[]

const names = users.map(u => u.name);
// Hovering on names displays string[]

const eldest = users.reduce((prev, curr) =>
  prev.age > curr.age ? prev : curr
);
// Hovering on eldest displays { id: number; name: string; age: number }

// 4. Inline error display
const config = {
  host: "localhost",
  port: 3000,
};
// config.port = "8080"; // Red squiggly error: Type 'string' is not assignable to type 'number'

// 5. Refactoring support
// - Bulk rename of symbols (F2 key)
// - Extract function
// - Auto-extract interface
// - Auto-add and organize import statements

// 6. Code navigation
// - Go to definition (F12)
// - Find references (Shift+F12)
// - Go to implementation (Ctrl+F12)
// - Go to type definition
```

### Comparison of the Benefits of the Type System

| Aspect | JavaScript (untyped) | TypeScript (typed) |
|--------|----------------------|--------------------|
| Bug detection timing | Runtime (including production) | Compile time (during development) |
| Refactoring | Manually verify all locations | Compiler auto-detects affected scope |
| IDE completion | Guess-based (inaccurate) | Type-information-based (accurate) |
| Documentation | Written in comments (easy to become stale) | Types serve as living documentation |
| Team development | Depends on verbal communication and docs | Types act as contracts |
| Learning cost | Low | Slightly high (worth the investment) |
| Debugging time | Long (many type-related bugs) | Short (type errors resolved during development) |
| Code review | Type intent confirmed verbally | Types make intent explicit |
| New member onboarding | Read code and infer types | Types serve as an entry guide |

### Code Example 6: Refactoring Safety

```typescript
// Scenario of a large-scale refactor
// Before: the price field is in yen
interface Product {
  id: number;
  name: string;
  price: number; // in yen
}

function formatPrice(product: Product): string {
  return `\u00A5${product.price.toLocaleString()}`;
}

function calculateTotal(products: Product[]): number {
  return products.reduce((sum, p) => sum + p.price, 0);
}

function applyDiscount(product: Product, rate: number): number {
  return product.price * (1 - rate);
}

// After: rename price to priceInCents (changed to sub-yen units)
interface Product {
  id: number;
  name: string;
  priceInCents: number; // in sub-yen units
}

// The TypeScript compiler reports errors at all of these locations:
// - product.price inside formatPrice
// - p.price inside calculateTotal
// - product.price inside applyDiscount
// -> Missed updates can never happen

// Furthermore, the impact of the type change can be reviewed as a list of errors
// Visually shown as red squiggles in the IDE
```

### The Effect of TypeScript in Large-Scale Projects

```typescript
// Example of how types provide safety in real projects

// API response type definition
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    requestId: string;
    timestamp: number;
  };
}

// User-related type definitions
interface User {
  id: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    bio?: string;
  };
  settings: {
    theme: "light" | "dark" | "system";
    language: "ja" | "en" | "zh";
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}

// API client
async function fetchUser(id: string): Promise<ApiResponse<User>> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// Callers can access the data in a type-safe way
async function displayUserProfile(userId: string): Promise<void> {
  const result = await fetchUser(userId);

  if (result.success) {
    // result.data is recognized as the User type
    const { profile, settings } = result.data;
    console.log(`${profile.firstName} ${profile.lastName}`);
    console.log(`Theme: ${settings.theme}`);
    console.log(`Language: ${settings.language}`);

    // settings.notifications.email is recognized as boolean
    if (settings.notifications.email) {
      console.log("Email notifications are enabled");
    }
  } else {
    // We can access result.error
    console.error(`Error: ${result.error?.message}`);
  }
}
```

---

## 3. History and Ecosystem

### TypeScript History Timeline

```
2012  v0.8   Initial release (Microsoft)
  |          Led by Anders Hejlsberg (designer of C#)
  |
2013  v0.9   Introduction of generics
  |
2014  v1.0   Stable release
  |          Angular 2 adopts TypeScript (a major turning point)
  |
2015  v1.5   ES2015 module support, decorators (experimental)
  |
2016  v2.0   Non-nullable types, Tagged Unions, readonly
  |   v2.1   keyof, Mapped Types, Lookup Types
  |
2017  v2.3   --strict flag introduced
  |   v2.4   String enums
  |
2018  v3.0   Project References, unknown type
  |   v3.1   Mapped types on tuples and arrays
  |
2019  v3.7   Optional Chaining (?.), Nullish Coalescing (??)
  |   v3.8   Type-Only Imports/Exports
  |
2020  v4.0   Variadic Tuple Types, Labeled Tuples
  |   v4.1   Template Literal Types, Key Remapping
  |
2021  v4.5   Awaited type, enhanced ESM support
  |   v4.7   Node.js ESM support, instantiation expressions
  |
2022  v4.9   satisfies operator
  |
2023  v5.0   Decorators (Stage 3), const type parameters
  |   v5.2   using declaration, decorator metadata
  |
2024  v5.4   NoInfer, Object.groupBy types
  |   v5.5   Type predicate inference, regex checks
  |   v5.6   --noUncheckedSideEffectImports
  |
2025  v5.7   --erasableSyntaxOnly, latest features
  |          Node.js supports direct execution via --experimental-strip-types
```

### Details of Notable Features in Each Version

```typescript
// TypeScript 2.0: Non-nullable types
// Enabling strictNullChecks strictly type-checks null/undefined
let name: string;
// name = null;  // Error (when strictNullChecks is enabled)
let nullableName: string | null = null; // OK

// TypeScript 2.1: keyof and Mapped Types
interface Person {
  name: string;
  age: number;
}
type PersonKeys = keyof Person; // "name" | "age"
type ReadonlyPerson = { readonly [K in keyof Person]: Person[K] };

// TypeScript 3.0: unknown type
// A safer alternative to any -- "accepts anything but requires checking before use"
function processValue(value: unknown): string {
  // value.toString(); // Error: Object is of type 'unknown'
  if (typeof value === "string") {
    return value.toUpperCase(); // OK: narrowed to string
  }
  return String(value);
}

// TypeScript 3.7: Optional Chaining
interface Company {
  name: string;
  address?: {
    street: string;
    city: string;
    country?: string;
  };
}
function getCountry(company: Company): string | undefined {
  return company.address?.country; // safe even if address is undefined
}

// TypeScript 4.1: Template Literal Types
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";
type Endpoint = "/users" | "/posts" | "/comments";
type Route = `${HTTPMethod} ${Endpoint}`;
// 24 combinations: "GET /users" | "GET /posts" | ... | "DELETE /comments"

// TypeScript 4.9: satisfies operator
// Type-checks while keeping the inferred type
const palette = {
  red: [255, 0, 0],
  green: "#00FF00",
  blue: [0, 0, 255],
} satisfies Record<string, string | number[]>;

// palette.red is inferred as number[] (not Record<string, string | number[]>)
const redValue = palette.red[0]; // number (without satisfies it would be string | number)

// TypeScript 5.0: const type parameters
function createRoute<const T extends readonly string[]>(routes: T): T {
  return routes;
}
const routes = createRoute(["home", "about", "contact"]);
// routes has type readonly ["home", "about", "contact"] (no need for "as const")

// TypeScript 5.2: using declaration (Explicit Resource Management)
class FileHandle {
  [Symbol.dispose]() {
    console.log("File closed");
  }
}
function processFile() {
  using file = new FileHandle();
  // Code that uses file
  // Once the scope is exited, [Symbol.dispose]() is called automatically
}
```

### Ecosystem Overview

| Category | Major Tools | Role |
|----------|-------------|------|
| Compiler | tsc | Type checking + transpilation |
| Bundler | esbuild, SWC, Vite | Fast builds |
| Linter | typescript-eslint | Code quality checks |
| Formatter | Prettier, dprint | Code formatting |
| Testing | Vitest, Jest | Type-safe testing |
| Schema | Zod, io-ts, Valibot | Runtime validation |
| ORM | Prisma, Drizzle, Kysely | Type-safe database operations |
| API | tRPC, GraphQL Code Generator | Type-safe API communication |
| Frameworks | Next.js, Remix, Astro, Hono | Full-stack development |
| Runtimes | Node.js, Deno, Bun | TypeScript execution environments |
| Monorepo | Turborepo, Nx | Large-scale project management |

### Detailed Explanation of the Ecosystem

```typescript
// ===== Zod: runtime validation =====
import { z } from "zod";

// Schema definition = type definition + validation
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  role: z.enum(["admin", "user", "guest"]),
});

// Auto-generate the type from the schema
type User = z.infer<typeof UserSchema>;
// -> { id: string; name: string; email: string; age: number; role: "admin" | "user" | "guest" }

// Validate at runtime
function createUser(input: unknown): User {
  return UserSchema.parse(input); // Throws on invalid data
}

// ===== Prisma: type-safe database operations =====
// Use types auto-generated from schema.prisma
// const user = await prisma.user.findUnique({
//   where: { id: "..." },
//   select: {
//     name: true,
//     email: true,
//     posts: {
//       select: { title: true },
//     },
//   },
// });
// Type of user: { name: string; email: string; posts: { title: string }[] } | null

// ===== tRPC: type-safe API communication =====
// Server-side type definitions auto-propagate to the client
// When the API schema changes, compile errors appear on the client side
// -> Completely prevents type mismatches between frontend and backend

// ===== Vitest: type-safe testing =====
import { describe, it, expect } from "vitest";

describe("User", () => {
  it("should create a valid user", () => {
    const user: User = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Alice",
      email: "alice@example.com",
      age: 30,
      role: "admin",
    };
    expect(user.name).toBe("Alice");
  });
});
```

### Code Example 7: Minimal TypeScript Project Setup

```bash
# Initialize the project
mkdir my-ts-project && cd my-ts-project
npm init -y
npm install typescript --save-dev
npx tsc --init

# Directory structure
# my-ts-project/
# +- src/
# |   +- index.ts
# +- dist/           # Compilation output
# +- tsconfig.json
# +- package.json
```

---

## 4. Project Structure and Configuration

### Details of tsconfig.json

tsconfig.json is the configuration file for a TypeScript project and controls the compiler's behavior. Below is a comprehensive explanation of settings frequently used in practice.

```jsonc
{
  "compilerOptions": {
    // ===== Type checking related =====
    "strict": true,                    // Enables all strict checks (recommended)
    // strict: true enables all of the following:
    // - strictNullChecks: strict null/undefined checking
    // - strictFunctionTypes: strict function type checking
    // - strictBindCallApply: strict bind/call/apply checking
    // - strictPropertyInitialization: class property initialization checking
    // - noImplicitAny: forbids implicit any
    // - noImplicitThis: forbids implicit this
    // - alwaysStrict: emits "use strict"
    // - useUnknownInCatchVariables: catch variables typed as unknown

    "noUncheckedIndexedAccess": true,  // Adds undefined to indexed access
    "noUnusedLocals": true,            // Errors on unused local variables
    "noUnusedParameters": true,        // Errors on unused parameters
    "noImplicitReturns": true,         // Errors on implicit returns
    "noFallthroughCasesInSwitch": true, // Errors on switch fallthrough
    "exactOptionalPropertyTypes": true, // Strict checking of optional properties
    "noPropertyAccessFromIndexSignature": true, // Forbid dot-access on index signatures

    // ===== Module related =====
    "module": "ESNext",                // Module system
    "moduleResolution": "bundler",     // Module resolution strategy (bundler recommended)
    "esModuleInterop": true,           // CommonJS/ESM interoperability
    "allowImportingTsExtensions": true, // Allow imports with .ts extension
    "resolveJsonModule": true,         // Allow importing JSON files
    "isolatedModules": true,           // Guarantee per-file transpilation

    // ===== Output related =====
    "target": "ES2022",                // Target JavaScript version
    "outDir": "./dist",                // Output directory
    "declaration": true,               // Emit .d.ts files
    "declarationMap": true,            // Emit source maps for .d.ts
    "sourceMap": true,                 // Emit source maps for .js
    "removeComments": false,           // Keep comments

    // ===== Path related =====
    "rootDir": "./src",                // Root directory for sources
    "baseUrl": "./src",                // Base for path resolution
    "paths": {                         // Path aliases
      "@/*": ["./*"],
      "@components/*": ["./components/*"],
      "@utils/*": ["./utils/*"],
      "@types/*": ["./types/*"]
    },

    // ===== Other =====
    "skipLibCheck": true,              // Skip type checking of .d.ts (speeds up builds)
    "forceConsistentCasingInFileNames": true, // Strict file name casing checks
    "lib": ["ES2022", "DOM", "DOM.Iterable"] // Library type definitions to use
  },

  "include": ["src/**/*"],             // Files to compile
  "exclude": [                         // Files to exclude
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

### Recommended tsconfig per Project Type

```jsonc
// ===== Node.js backend project =====
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

```jsonc
// ===== React frontend project =====
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true  // Vite/esbuild handles building, so tsc only type-checks
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```jsonc
// ===== Library project =====
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    // For libraries, set a lower target so they work in a wide range of environments
    "lib": ["ES2020"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Choosing a Module System

```typescript
// ===== CommonJS (the traditional Node.js module system) =====
// tsconfig: "module": "CommonJS"
const express = require("express");  // Use require
module.exports = { myFunction };     // Use module.exports

// ===== ESModules (the modern standard module system) =====
// tsconfig: "module": "ESNext" or "NodeNext"
import express from "express";       // Use import
export { myFunction };               // Use export

// ===== Choosing moduleResolution =====
// "node10" (= "node"): old Node.js style (deprecated)
// "node16" / "nodenext": Node.js 16+ ESM support
// "bundler": when using Vite, webpack, etc. (recommended)

// Behavioral differences depending on moduleResolution
// With "bundler":
import { utils } from "./utils";     // Extension may be omitted
import data from "./data.json";      // JSON import OK

// With "nodenext":
import { utils } from "./utils.js";  // Extension required (.ts -> .js)
import data from "./data.json" with { type: "json" }; // import assertions
```

### Directory Structure Patterns

```
# ===== Small project =====
my-app/
+- src/
|   +- index.ts          # Entry point
|   +- types.ts          # Type definitions
|   +- utils.ts          # Utilities
|   +- config.ts         # Configuration
+- tests/
|   +- index.test.ts
+- tsconfig.json
+- package.json
+- .gitignore

# ===== Medium project (split by feature) =====
my-app/
+- src/
|   +- index.ts
|   +- types/
|   |   +- index.ts
|   |   +- user.ts
|   |   +- product.ts
|   +- services/
|   |   +- user.service.ts
|   |   +- product.service.ts
|   +- repositories/
|   |   +- user.repository.ts
|   |   +- product.repository.ts
|   +- controllers/
|   |   +- user.controller.ts
|   |   +- product.controller.ts
|   +- middleware/
|   |   +- auth.ts
|   |   +- validation.ts
|   +- utils/
|       +- logger.ts
|       +- helpers.ts
+- tests/
|   +- services/
|   +- repositories/
|   +- controllers/
+- tsconfig.json
+- tsconfig.test.json    # Configuration for tests
+- package.json
+- .gitignore

# ===== Large project (monorepo) =====
my-monorepo/
+- packages/
|   +- shared/           # Shared type definitions and utilities
|   |   +- src/
|   |   +- tsconfig.json
|   |   +- package.json
|   +- api/              # Backend
|   |   +- src/
|   |   +- tsconfig.json
|   |   +- package.json
|   +- web/              # Frontend
|   |   +- src/
|   |   +- tsconfig.json
|   |   +- package.json
|   +- mobile/           # Mobile app
|       +- src/
|       +- tsconfig.json
|       +- package.json
+- tsconfig.base.json    # Common configuration
+- turbo.json            # Turborepo configuration
+- package.json
+- pnpm-workspace.yaml
```

---

## 5. Adoption Strategies in Practice

### Adoption in New Projects

```bash
# ===== Approach 1: manual setup =====
mkdir new-project && cd new-project
npm init -y
npm install typescript @types/node --save-dev
npx tsc --init

# Add scripts to package.json
# {
#   "scripts": {
#     "build": "tsc",
#     "dev": "tsc --watch",
#     "typecheck": "tsc --noEmit"
#   }
# }

# ===== Approach 2: framework scaffolding =====
# Next.js
npx create-next-app@latest --typescript

# Vite + React
npm create vite@latest my-app -- --template react-ts

# Hono (backend)
npm create hono@latest

# Astro
npm create astro@latest
```

### Incremental Migration from Existing JavaScript Projects

```typescript
// ===== Step 1: introduce TypeScript (minimal) =====
// Create tsconfig.json (start with permissive settings)
// {
//   "compilerOptions": {
//     "allowJs": true,          // Include .js files
//     "checkJs": false,         // Disable type checking of .js
//     "strict": false,          // Enable strict mode later
//     "noImplicitAny": false,   // Allow implicit any
//     "target": "ES2020",
//     "module": "ESNext",
//     "moduleResolution": "bundler",
//     "outDir": "./dist",
//     "esModuleInterop": true,
//     "skipLibCheck": true
//   },
//   "include": ["src/**/*"]
// }

// ===== Step 2: change files to .ts incrementally =====
// Start from leaf files with the fewest dependencies
// utils.js -> utils.ts
// constants.js -> constants.ts

// ===== Step 3: add type definitions =====
// First install @types packages
// npm install @types/express @types/lodash --save-dev

// ===== Step 4: enable strict mode incrementally =====
// 1. noImplicitAny: true   (forbid implicit any)
// 2. strictNullChecks: true (strict null/undefined checking)
// 3. strictFunctionTypes: true
// 4. strict: true           (enable all strict checks)

// ===== Step 5: convert remaining .js files =====
// Convert in priority order
// 1. Type definition files (types, interfaces)
// 2. Utility functions
// 3. Business logic
// 4. API layer
// 5. UI layer
```

### Practical Techniques for Migration

```typescript
// Technique 1: add types via JSDoc (type-check without changing to .ts)
// config: "checkJs": true, "allowJs": true

// utils.js
/**
 * @param {string} name
 * @param {number} age
 * @returns {{ name: string, age: number, greeting: string }}
 */
function createPerson(name, age) {
  return {
    name,
    age,
    greeting: `Hi, I'm ${name}`,
  };
}

// Technique 2: use temporary type assertions to keep migrating
// A stopgap for cases where complete typing is hard
const legacyConfig = getLegacyConfig() as any; // Temporarily any
// TODO: define the return type of getLegacyConfig

// Technique 3: type existing modules using declaration files
// legacy-module.d.ts
declare module "legacy-module" {
  export function doSomething(input: string): Promise<number>;
  export interface LegacyResult {
    status: "ok" | "error";
    data: unknown;
  }
}

// Technique 4: temporarily suppress known type errors with @ts-expect-error
// @ts-expect-error: Legacy code, will be fixed in #1234
const result = legacyFunction(untypedData);

// Technique 5: type-safe migration utilities
// Helpers that perform safe type conversions from unknown
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function assertNonNull<T>(value: T | null | undefined, message?: string): T {
  if (value === null || value === undefined) {
    throw new Error(message ?? "Unexpected null or undefined");
  }
  return value;
}
```

### Measuring the Impact of TypeScript Adoption

```typescript
// Metrics for measuring adoption impact

// 1. Change in bug detection rate
// - Before adoption: number of bugs found in production
// - After adoption: number of bugs found at compile time
// Generally, more than 80% of type-related bugs are detected at compile time

// 2. Change in development speed
// - Initial: speed drops 10-20% due to creating type definitions
// - Mid-term: speed recovers thanks to IDE support
// - Long-term: refactoring speed improves by 50-100%

// 3. Code review efficiency
// - Type intent becomes clear, cutting review time by 20-30%
// - Questions like "what type is this argument?" decrease drastically

// 4. New member onboarding time
// - Type definitions act as documentation, accelerating code understanding
// - Generally a 30-50% reduction in time is reported
```

---

## 6. TypeScript Internals

### How the Type Inference Engine Works

TypeScript's type inference is based on "Structural Typing".

```typescript
// Structural typing vs Nominal typing

// TypeScript uses structural typing (Duck Typing)
// Types with the same structure are compatible
interface Point {
  x: number;
  y: number;
}

interface Coordinate {
  x: number;
  y: number;
}

const point: Point = { x: 1, y: 2 };
const coord: Coordinate = point; // OK: compatible because the structure is the same

// Languages like Java and C# use nominal typing
// Even with the same structure, different type names are not compatible
// To emulate this in TypeScript, use branded types

// Branded types (emulation of Nominal Typing)
type USD = number & { __brand: "USD" };
type EUR = number & { __brand: "EUR" };

function createUSD(amount: number): USD {
  return amount as USD;
}

function createEUR(amount: number): EUR {
  return amount as EUR;
}

const dollars: USD = createUSD(100);
const euros: EUR = createEUR(85);
// const mixed: USD = euros; // Error: EUR cannot be assigned to USD
```

### Control Flow Analysis for Type Inference

```typescript
// TypeScript analyzes control flow to automatically narrow types

function processInput(input: string | number | null | undefined) {
  // At this point: string | number | null | undefined

  if (input === null || input === undefined) {
    return; // After this branch: string | number
  }

  // At this point: string | number (null | undefined excluded)

  if (typeof input === "string") {
    // Inside this branch: string
    console.log(input.toUpperCase()); // OK
  } else {
    // Inside this branch: number
    console.log(input.toFixed(2)); // OK
  }
}

// Type narrowing with instanceof
class Dog {
  bark() { console.log("Woof!"); }
}
class Cat {
  meow() { console.log("Meow!"); }
}

function makeSound(animal: Dog | Cat) {
  if (animal instanceof Dog) {
    animal.bark(); // OK: narrowed to Dog
  } else {
    animal.meow(); // OK: narrowed to Cat
  }
}

// Type narrowing using the in operator
interface Fish {
  swim: () => void;
}
interface Bird {
  fly: () => void;
}

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim(); // OK: narrowed to Fish
  } else {
    animal.fly(); // OK: narrowed to Bird
  }
}

// User-defined type guards
interface ApiError {
  type: "error";
  code: number;
  message: string;
}

interface ApiSuccess<T> {
  type: "success";
  data: T;
}

type ApiResult<T> = ApiSuccess<T> | ApiError;

function isApiError<T>(result: ApiResult<T>): result is ApiError {
  return result.type === "error";
}

function handleResult<T>(result: ApiResult<T>): T {
  if (isApiError(result)) {
    // result is narrowed to ApiError
    throw new Error(`API Error ${result.code}: ${result.message}`);
  }
  // result is narrowed to ApiSuccess<T>
  return result.data;
}
```

### Type Compatibility Checks

```typescript
// Type compatibility rules in TypeScript

// 1. Excess property checks
interface Options {
  width: number;
  height: number;
}

// When directly assigning an object literal, excess properties are an error
// const opts: Options = { width: 100, height: 200, color: "red" }; // Error

// When assigning via a variable, excess properties are tolerated
const rawOpts = { width: 100, height: 200, color: "red" };
const opts: Options = rawOpts; // OK (excess properties are ignored)

// 2. Function compatibility
type Handler = (event: MouseEvent) => void;
type GeneralHandler = (event: Event) => void;

// Function parameters are contravariant
// A function that accepts wider-typed parameters cannot be assigned to one with narrower-typed parameters
// let handler: Handler = generalHandler; // Error when strictFunctionTypes is enabled

// 3. Covariant return values
interface Animal { name: string; }
interface Dog extends Animal { breed: string; }

type GetAnimal = () => Animal;
type GetDog = () => Dog;

const getDog: GetDog = () => ({ name: "Buddy", breed: "Labrador" });
const getAnimal: GetAnimal = getDog; // OK: Dog is a subtype of Animal
```

---

## 7. Performance and Optimization

### Improving Compile Speed

```jsonc
// Performance optimizations in tsconfig.json

{
  "compilerOptions": {
    // 1. skipLibCheck: skip type checking of .d.ts files
    "skipLibCheck": true,   // Can shorten build times by 30-50%

    // 2. incremental: incremental compilation
    "incremental": true,    // Differential builds via .tsbuildinfo file
    "tsBuildInfoFile": "./dist/.tsbuildinfo",

    // 3. isolatedModules: guarantee per-file transpilation
    "isolatedModules": true // Ensure compatibility with esbuild/SWC
  }
}
```

### Project References

```jsonc
// A mechanism to dramatically reduce build time in large projects

// tsconfig.json (root)
{
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/api" },
    { "path": "./packages/web" }
  ],
  "files": []  // Root does not compile any files
}

// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "composite": true,      // Required for project references
    "declaration": true,    // Emit .d.ts
    "declarationMap": true, // Enable jumping to source
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}

// packages/api/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist"
  },
  "references": [
    { "path": "../shared" }  // Dependency on the shared package
  ],
  "include": ["src/**/*"]
}
```

```bash
# Build using project references
tsc --build              # Build all packages (in dependency order)
tsc --build --watch      # Watch mode
tsc --build --clean      # Remove build artifacts
tsc --build --verbose    # Verbose log output
```

### Combining with Build Tools

```typescript
// ===== esbuild: ultra-fast bundler =====
// Does not perform TypeScript type checking; transpiles only
// 10-100x faster than tsc

// esbuild.config.ts
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  target: "node20",
  format: "esm",
});

// Run type checking separately with tsc --noEmit
// package.json:
// {
//   "scripts": {
//     "build": "esbuild src/index.ts --bundle --outdir=dist",
//     "typecheck": "tsc --noEmit",
//     "ci": "npm run typecheck && npm run build"
//   }
// }

// ===== SWC: a Rust-based fast transpiler =====
// Used internally by Next.js and Vite

// ===== Vite: dev server + build tool =====
// During development: transpile with esbuild (no type checking, fast HMR)
// Build time: bundle with Rollup + esbuild
// Type checking: run on a separate thread via vite-plugin-checker

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";

export default defineConfig({
  plugins: [
    react(),
    checker({
      typescript: true,  // Run TypeScript type checking on a separate thread
    }),
  ],
});
```

### Type Checking in CI/CD Pipelines

```yaml
# Example of type checking via GitHub Actions
# .github/workflows/typecheck.yml
name: TypeScript Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit  # Type-check only (no output)

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx eslint src/ --ext .ts,.tsx

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run
```

---

## 8. TypeScript Runtime Environments

### Running TypeScript on Node.js

```bash
# ===== Approach 1: ts-node (the traditional approach) =====
npm install ts-node --save-dev
npx ts-node src/index.ts

# ===== Approach 2: tsx (a fast alternative to ts-node) =====
npm install tsx --save-dev
npx tsx src/index.ts
npx tsx watch src/index.ts  # With watch mode

# ===== Approach 3: native TypeScript support in Node.js 22+ =====
# Run directly with the --experimental-strip-types flag
node --experimental-strip-types src/index.ts

# In Node.js 23+, --experimental-transform-types is also available
# It supports TypeScript-specific syntax such as enum and namespace
```

### Running TypeScript on Deno

```bash
# Deno supports TypeScript natively
# You can run .ts files directly with no configuration
deno run src/index.ts

# Run with permissions
deno run --allow-net --allow-read src/server.ts

# TypeScript compiler options can be set in deno.json
# {
#   "compilerOptions": {
#     "strict": true,
#     "lib": ["deno.window"]
#   }
# }
```

### Running TypeScript on Bun

```bash
# Bun supports TypeScript natively
# Very fast execution is possible
bun run src/index.ts

# Run tests
bun test

# Package install (5-10x faster than npm)
bun install
```

---

## Anti-Patterns

### Anti-Pattern 1: Overuse of any

```typescript
// BAD: using any nullifies all benefits of the type system
function processData(data: any): any {
  return data.map((item: any) => item.value);
}

// GOOD: define proper types
interface DataItem {
  value: string;
}
function processData(data: DataItem[]): string[] {
  return data.map((item) => item.value);
}

// BETTER: make it generic with generics
function processData<T, K extends keyof T>(data: T[], key: K): T[K][] {
  return data.map((item) => item[key]);
}
```

### Anti-Pattern 2: Using TypeScript as Just "JavaScript with a Renamed Extension"

```typescript
// BAD: only renamed to .ts and never wrote any types
// Setting strict: false in tsconfig.json
// -> No different from JavaScript, only the migration cost is paid

// GOOD: enable strict: true and add types incrementally
// tsconfig.json
{
  "compilerOptions": {
    "strict": true  // Enable all strict checks
  }
}
```

### Anti-Pattern 3: Excessively Complex Type Definitions

```typescript
// BAD: unreadable type definitions
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> extends infer U
      ? U extends never ? never : U : never }
  : T;

// GOOD: explain intent in comments and verify behavior with tests
/**
 * Recursively makes all properties of an object optional.
 * Used for partial updates of deeply nested structures.
 */
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

// Type tests (testing at the type level)
type _TestDeepPartial = DeepPartial<{
  a: { b: { c: string } };
}>;
// Expected: { a?: { b?: { c?: string } } }
```

### Anti-Pattern 4: Abuse of @ts-ignore

```typescript
// BAD: silently swallows the error
// @ts-ignore
const result = someFunction(invalidArg);

// BETTER: use @ts-expect-error and state the reason (you can detect when the error is resolved)
// @ts-expect-error: Legacy API requires string but we pass number. Fix in #1234
const result = someFunction(invalidArg);

// BEST: fix the type properly
const result = someFunction(validArg as ExpectedType);
```

### Anti-Pattern 5: Excessive Use of Type Assertions (as)

```typescript
// BAD: bypassing type checking with type assertions
const data = JSON.parse(response) as UserData;
// -> No compile error even if response has an invalid format

// GOOD: combine with runtime validation
import { z } from "zod";

const UserDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

type UserData = z.infer<typeof UserDataSchema>;

function parseUserData(response: string): UserData {
  const parsed = JSON.parse(response);
  return UserDataSchema.parse(parsed); // Type-checked at runtime as well
}
```

### Anti-Pattern 6: Duplicated Type Definitions

```typescript
// BAD: defining the same structure in multiple places
interface CreateUserRequest {
  name: string;
  email: string;
  age: number;
}

interface UpdateUserRequest {
  name: string;     // Duplicate!
  email: string;    // Duplicate!
  age: number;      // Duplicate!
}

// GOOD: derive with utility types
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  createdAt: Date;
  updatedAt: Date;
}

type CreateUserRequest = Omit<User, "id" | "createdAt" | "updatedAt">;
type UpdateUserRequest = Partial<CreateUserRequest>;
type UserResponse = Pick<User, "id" | "name" | "email">;
```

### Anti-Pattern 7: Improper Use of enum

```typescript
// BAD: numeric enums easily produce unintended behavior
enum Status {
  Active,   // 0
  Inactive, // 1
  Pending,  // 2
}
const status: Status = 999; // No error! (a pitfall of numeric enums)

// GOOD: use string enums
enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING",
}

// BETTER: use union types (in many cases this is recommended)
type Status = "active" | "inactive" | "pending";

// Union types are:
// - Tree-shakable
// - Produce simpler JavaScript output
// - Have more natural type inference
// - Easy to combine with as const

const STATUS = {
  Active: "active",
  Inactive: "inactive",
  Pending: "pending",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS];
// "active" | "inactive" | "pending"
```

---

## 9. TypeScript's Design Philosophy

### Goals (from the official Design Goals)

TypeScript's design is based on the following goals.

```
1. Detect structural mismatches in statically typed code
2. Provide structuring mechanisms for large programs
3. Impose no additional runtime overhead
4. Emit clean and idiomatic JavaScript
5. Use a consistent and fully erasable type system
6. Stay aligned with current and future ECMAScript proposals
7. Do not change JavaScript's runtime behavior (strictly separate the type world from the value world)
```

### Non-Goals

```
1. Do not pursue a sound type system (prioritize practicality)
2. Speeding up JavaScript programs is not a goal
3. Proving program correctness is not a goal
4. Providing TypeScript-specific runtime features (preserve the type-erasure principle)
```

```typescript
// Examples of not pursuing soundness
// TypeScript intentionally allows certain unsafe operations

// Example 1: array indexed access
const arr: string[] = ["a", "b", "c"];
const item: string = arr[10]; // Returns undefined but the type is string
// Improved by setting noUncheckedIndexedAccess: true

// Example 2: existence of any
// any is intentionally provided as an "escape hatch" for the type system

// Example 3: type assertion
const value = "hello" as unknown as number; // Allows arbitrary type conversion

// These design decisions prioritize practicality
// A 100% safe type system tends to be hard to use, and
// TypeScript balances practicality and safety
```

---

## 10. Common Development Patterns

### Type-Safe Loading of Environment Variables

```typescript
// Type definition for environment variables
interface EnvConfig {
  NODE_ENV: "development" | "staging" | "production";
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
}

// Loading and validation of environment variables
function loadEnvConfig(): EnvConfig {
  const requiredVars = [
    "NODE_ENV",
    "PORT",
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_SECRET",
  ] as const;

  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return {
    NODE_ENV: process.env.NODE_ENV as EnvConfig["NODE_ENV"],
    PORT: parseInt(process.env.PORT!, 10),
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    LOG_LEVEL: (process.env.LOG_LEVEL ?? "info") as EnvConfig["LOG_LEVEL"],
  };
}

// A more robust approach using Zod
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const env = envSchema.parse(process.env);
// env is fully type-safe and runtime-validated
```

### Error Handling Patterns

```typescript
// Result type pattern (error handling without exceptions)
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// Usage example
interface ValidationError {
  field: string;
  message: string;
}

function validateEmail(email: string): Result<string, ValidationError> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return err({ field: "email", message: "Invalid email format" });
  }
  return ok(email.toLowerCase().trim());
}

function validateAge(age: number): Result<number, ValidationError> {
  if (age < 0 || age > 150) {
    return err({ field: "age", message: "Age must be between 0 and 150" });
  }
  return ok(age);
}

// Chaining the Result type
function registerUser(email: string, age: number): Result<{ id: string }, ValidationError> {
  const emailResult = validateEmail(email);
  if (!emailResult.success) return emailResult;

  const ageResult = validateAge(age);
  if (!ageResult.success) return ageResult;

  return ok({ id: crypto.randomUUID() });
}
```

### Type-Safe Configuration Management

```typescript
// Type-safe management of application configuration
interface AppConfig {
  server: {
    host: string;
    port: number;
    cors: {
      origins: string[];
      methods: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
      credentials: boolean;
    };
  };
  database: {
    host: string;
    port: number;
    name: string;
    pool: {
      min: number;
      max: number;
      idleTimeoutMs: number;
    };
  };
  auth: {
    jwtSecret: string;
    tokenExpiresIn: string;
    refreshTokenExpiresIn: string;
    bcryptRounds: number;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "text";
    destination: "stdout" | "file";
  };
}

// Merging default configuration with environment-specific configuration
const defaultConfig: AppConfig = {
  server: {
    host: "0.0.0.0",
    port: 3000,
    cors: {
      origins: ["http://localhost:3000"],
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
  },
  database: {
    host: "localhost",
    port: 5432,
    name: "myapp",
    pool: { min: 2, max: 10, idleTimeoutMs: 30000 },
  },
  auth: {
    jwtSecret: "change-me",
    tokenExpiresIn: "15m",
    refreshTokenExpiresIn: "7d",
    bcryptRounds: 12,
  },
  logging: {
    level: "info",
    format: "json",
    destination: "stdout",
  },
};

// Type-safe overrides via DeepPartial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function createConfig(overrides: DeepPartial<AppConfig>): AppConfig {
  // deep merge implementation
  return deepMerge(defaultConfig, overrides) as AppConfig;
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overrides: DeepPartial<T>
): T {
  const result = { ...base };
  for (const key in overrides) {
    const override = overrides[key];
    if (
      override !== undefined &&
      typeof override === "object" &&
      !Array.isArray(override) &&
      override !== null
    ) {
      (result as any)[key] = deepMerge(
        (base as any)[key] ?? {},
        override as any
      );
    } else if (override !== undefined) {
      (result as any)[key] = override;
    }
  }
  return result;
}
```

---

## FAQ

### Q1: Does TypeScript perform type checking at runtime?

**A:** No. All of TypeScript's type information is erased at compile time. At runtime it is just JavaScript. When you need runtime validation, use libraries such as Zod or io-ts in combination.

### Q2: Should I learn JavaScript before TypeScript?

**A:** Yes, it is recommended. TypeScript is built on top of JavaScript, so understanding the JavaScript fundamentals (functions, objects, prototypes, asynchronous handling) makes learning much smoother. That said, an approach of learning TypeScript from the start is becoming more common.

### Q3: What are the disadvantages of TypeScript?

**A:** The main disadvantages are as follows:
- **Learning cost**: you must learn the concepts of the type system
- **Build step**: compilation is required (though it can be sped up with tools such as esbuild)
- **Maintaining type definitions**: complex types incur maintenance cost
- **Third-party types**: some libraries have incomplete type definitions

That said, in mid-to-large-scale projects, the benefits far outweigh these costs.

### Q4: What is the difference between TypeScript and Flow?

**A:** Flow is a type checker developed by Meta (formerly Facebook), and like TypeScript it adds static typing to JavaScript. The main differences are as follows.

| Comparison | TypeScript | Flow |
|------------|-----------|------|
| Developer | Microsoft | Meta |
| Language vs tool | Language (its own compiler) | Tool (type checker only) |
| Ecosystem | Overwhelmingly large | Shrinking |
| IDE support | Standard in VSCode etc. | Limited |
| Sharing type definitions | DefinitelyTyped | Its own flow-typed |
| Community | Very active | Mostly internal to Meta |
| Adoption (2025) | De facto standard | The React codebase, etc. |

Today, TypeScript is effectively the standard, and choosing TypeScript for new projects is the norm.

### Q5: What are .d.ts files?

**A:** `.d.ts` files are "Declaration Files" that provide type information for JavaScript libraries.

```typescript
// math-lib.d.ts -- type declarations for the JavaScript library math-lib
declare module "math-lib" {
  export function add(a: number, b: number): number;
  export function multiply(a: number, b: number): number;

  export interface MathConfig {
    precision: number;
    rounding: "ceil" | "floor" | "round";
  }

  export class Calculator {
    constructor(config?: MathConfig);
    evaluate(expression: string): number;
  }
}

// Usage
import { add, Calculator } from "math-lib";
const result = add(1, 2); // number
const calc = new Calculator({ precision: 2, rounding: "round" });
```

### Q6: What is DefinitelyTyped?

**A:** DefinitelyTyped is a community repository on GitHub that gathers TypeScript type definitions. It is published on npm as `@types/xxx` packages.

```bash
# Install type definitions from DefinitelyTyped
npm install @types/express --save-dev
npm install @types/lodash --save-dev
npm install @types/react --save-dev
npm install @types/node --save-dev

# If the package itself ships type definitions, @types is unnecessary
# Examples: axios, zod, prisma, date-fns, etc.
```

### Q7: Should I set strict: true?

**A:** For new projects, you should always set `strict: true`. For migrating existing projects, enabling it incrementally is recommended. The individual flags that strict mode enables and their effects are as follows.

```typescript
// strictNullChecks: strict null/undefined checking
let name: string;
// name = null; // Error
let nullableName: string | null = null; // OK

// noImplicitAny: forbid implicit any
// function process(data) {} // Error: parameter 'data' implicitly has an 'any' type
function process(data: unknown) {} // OK

// strictFunctionTypes: contravariance check on function parameters
// strictBindCallApply: type checks for bind/call/apply
// strictPropertyInitialization: class property initialization checks

class User {
  // name: string; // Error: not initialized
  name: string = ""; // OK
  // or
  // name!: string; // Explicit assertion (not recommended but possible)
}
```

### Q8: What is Node.js native TypeScript support?

**A:** Starting from Node.js 22.6.0, the `--experimental-strip-types` flag was added, allowing direct execution of TypeScript files. This mechanism simply strips the TypeScript type annotations and runs the file as JavaScript.

```bash
# Node.js 22.6.0+
node --experimental-strip-types src/index.ts

# In Node.js 23.6.0+ it can run without the flag (enabled by default)
node src/index.ts

# Note: TypeScript-specific syntax such as enum, namespace, and parameter properties
# is not handled by strip-types
# --experimental-transform-types is required
```

---

## Summary

| Item | Content |
|------|---------|
| What TypeScript is | A superset of JavaScript and a language that adds static typing |
| Developer | Microsoft (released in 2012, open source) |
| Compilation | Converts .ts -> .js. Type information is erased at runtime |
| Main benefits | Early bug detection, IDE support, refactoring safety |
| Main costs | Learning curve, build step, type-definition maintenance |
| Ecosystem | Rich set of tools: tsc, esbuild, Vitest, Zod, Prisma, tRPC, etc. |
| strict mode | Recommended. Maximizes the benefits of type checking |
| Structural typing | Types with the same structure are compatible (Duck Typing) |
| Type erasure | Type information is completely removed at compile time |
| Runtimes | Node.js, Deno, and Bun support direct execution |
| Design philosophy | Balance practicality and safety, preserve JavaScript compatibility |
| Adoption strategy | New projects: strict:true; existing projects: incremental migration recommended |

---

## Recommended Next Guides

- [01-type-basics.md](./01-type-basics.md) -- Type fundamentals (primitives, literal types, arrays, tuples)
- [02-functions-and-objects.md](./02-functions-and-objects.md) -- Function and object types

---

## References

1. **TypeScript official documentation** -- https://www.typescriptlang.org/docs/
2. **TypeScript Deep Dive (Japanese version)** -- https://typescript-jp.gitbook.io/deep-dive/
3. **Programming TypeScript (Boris Cherny, O'Reilly)** -- A book that comprehensively covers the theory and practice of the type system
4. **TypeScript GitHub repository** -- https://github.com/microsoft/TypeScript
5. **TypeScript Design Goals** -- https://github.com/microsoft/TypeScript/wiki/TypeScript-Design-Goals
6. **DefinitelyTyped** -- https://github.com/DefinitelyTyped/DefinitelyTyped
7. **TypeScript Playground** -- https://www.typescriptlang.org/play
8. **Effective TypeScript (Dan Vanderkam, O'Reilly)** -- 62 best practices usable in real-world work
