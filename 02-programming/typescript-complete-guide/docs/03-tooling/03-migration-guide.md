# JavaScript to TypeScript Migration Guide

> A practical roadmap and migration techniques for incrementally introducing TypeScript into existing JS projects

## What You Will Learn

1. **Incremental migration strategy** -- Steps to safely introduce TypeScript file by file, without a full rewrite
2. **Gradual tsconfig strictness** -- Managing the configuration chain from `allowJs` to reaching `strict: true`
3. **Common migration patterns** -- Techniques for filling in type definitions, eliminating `any`, and introducing third-party types
4. **Migration strategy for large projects** -- A practical approach for projects with 10,000+ lines
5. **Maintaining quality after migration** -- Integrating type checking in CI/CD and standardizing TypeScript across the team


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [TypeScript Testing Complete Guide](./02-testing-typescript.md)

---

## 1. Migration Roadmap

### 1-1. Overall Flow

```
5 Phases of Incremental Migration:

Phase 1: Preparation   Phase 2: Coexistence   Phase 3: Conversion
+---------------+    +---------------+    +---------------+
| Introduce     |    | .js + .ts     |    | Convert main  |
| tsconfig      |    | coexist       |    | files to .ts  |
| allowJs: true |    | checkJs: true |    | Remove any    |
| strict: false |    |               |    |               |
+---------------+    +---------------+    +---------------+
       |                    |                    |
       v                    v                    v
Phase 4: Strictness    Phase 5: Complete
+---------------+    +---------------+
| strict: true  |    | All files .ts |
| Enable each   |    | Type check    |
| option one by |    | in CI         |
| one           |    | Remove JSDoc  |
+---------------+    +---------------+

Estimated duration:
  ~1,000 lines:     1-2 days
  ~10,000 lines:    1-2 weeks
  ~100,000 lines:   1-3 months
  ~1,000,000 lines: 3-12 months
```

### 1-2. Phase 1 -- Preparation

```bash
# Install TypeScript and related tools
npm install -D typescript @types/node

# Also install framework types
npm install -D @types/express @types/cors @types/lodash

# Generate tsconfig.json
npx tsc --init
```

```json
// Phase 1 tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "checkJs": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"]
}
```

```json
// Add scripts to package.json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch"
  }
}
```

### 1-3. Phase 2 -- JS and TS Coexistence

```typescript
// Add types to existing JS files with JSDoc (before converting the file)
// src/utils.js

/**
 * @param {string} name
 * @param {number} age
 * @returns {{ name: string, age: number, id: string }}
 */
function createUser(name, age) {
  return {
    name,
    age,
    id: Math.random().toString(36).slice(2),
  };
}

/**
 * @typedef {Object} Config
 * @property {string} apiUrl
 * @property {number} timeout
 * @property {boolean} [debug]
 */

/**
 * @param {Config} config
 * @returns {void}
 */
function initApp(config) {
  // ...
}

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => boolean} predicate
 * @returns {T | undefined}
 */
function findItem(items, predicate) {
  return items.find(predicate);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isString(value) {
  return typeof value === "string";
}

module.exports = { createUser, initApp, findItem, isString };
```

```json
// Update Phase 2 tsconfig.json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,  // Type-check JS files too
    "strict": false,
    // Show JSDoc type check errors gradually
    "noImplicitAny": false
  }
}
```

```
JSDoc type annotation reference:

  Primitive types:
  @param {string} name           -- string
  @param {number} age            -- number
  @param {boolean} active        -- boolean
  @param {Date} createdAt        -- Date
  @param {any} data              -- any
  @param {unknown} input         -- unknown

  Composite types:
  @param {string | number} id    -- union type
  @param {string[]} tags         -- array
  @param {{ name: string }} user -- object
  @param {?string} name          -- nullable
  @param {string} [name]         -- optional

  Generics:
  @template T
  @param {T} value
  @returns {T}

  Type definitions:
  @typedef {Object} User
  @property {string} name
  @property {number} age

  Type guards:
  @param {unknown} value
  @returns {value is string}
```

### 1-4. Phase 3 -- File Conversion

```
Conversion steps (per file):

  1. Rename .js → .ts
  2. Convert require → import
  3. Convert module.exports → export
  4. Fix type errors (temporarily allowing as any)
  5. Verify tests pass
  6. Commit

  Note: Committing one file at a time makes
  rollback easy if problems arise
```

### 1-5. Phase 4 -- Strictness

```json
// Enable gradually
// Step 1: Detect implicit any
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

// Step 4: Full strict
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
    "noFallthroughCasesInSwitch": true
  }
}
```

### 1-6. Phase 5 -- Completion and Quality Maintenance

```json
// Final tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    // Set allowJs to false (migration complete)
    "allowJs": false,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 2. File Conversion Techniques

### 2-1. Conversion Priority

```
Conversion priority (start from dependency leaves):

  Dependency graph:
  index.ts ──→ routes.js ──→ controllers.js ──→ services.js
                                   |                |
                                   v                v
                              models.js        utils.js ← start here
                                   |
                                   v
                              database.js

  Conversion order:
  1. utils.js → utils.ts      (no dependencies)
  2. models.js → models.ts    (depends only on utils)
  3. database.js → database.ts
  4. services.js → services.ts
  5. controllers.js → controllers.ts
  6. routes.js → routes.ts
  7. index.js → index.ts

  Rationale:
  - Starting from dependency leaves reduces cascading type errors
  - Type information propagates from already-converted files
  - Tests are more likely to pass incrementally
```

### 2-2. Basic Conversion Pattern

```typescript
// Before: src/user-service.js
const db = require("./database");

class UserService {
  constructor(database) {
    this.db = database;
  }

  async getUser(id) {
    const user = await this.db.query("SELECT * FROM users WHERE id = $1", [id]);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: new Date(user.created_at),
    };
  }

  async createUser(data) {
    return this.db.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
      [data.name, data.email]
    );
  }

  async getUsersByRole(role) {
    const users = await this.db.query(
      "SELECT * FROM users WHERE role = $1",
      [role]
    );
    return users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
    }));
  }
}

module.exports = { UserService };

// ─────────────────────────────────────────────

// After: src/user-service.ts
import { Database } from "./database";

// Define types first
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface CreateUserDto {
  name: string;
  email: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

type UserRole = "USER" | "ADMIN" | "MODERATOR";

class UserService {
  constructor(private readonly db: Database) {}

  async getUser(id: string): Promise<User | null> {
    const user = await this.db.query<UserRow>(
      "SELECT * FROM users WHERE id = $1",
      [id]
    );
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: new Date(user.created_at),
    };
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const row = await this.db.query<UserRow>(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
      [data.name, data.email]
    );
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: new Date(row.created_at),
    };
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    const users = await this.db.queryMany<UserRow>(
      "SELECT * FROM users WHERE role = $1",
      [role]
    );
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: new Date(u.created_at),
    }));
  }
}

export { UserService, type User, type CreateUserDto, type UserRole };
```

### 2-3. require → import Conversion

```typescript
// Before (CommonJS)
const express = require("express");
const { UserService } = require("./user-service");
const config = require("./config.json");
const path = require("path");
const fs = require("fs").promises;

// After (ESM)
import express from "express";
import { UserService } from "./user-service.js"; // Extension required for NodeNext
import config from "./config.json" with { type: "json" };
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

// ──────────────────────────────────────

// Before (module.exports)
module.exports = { UserService };
module.exports.default = app;

// After (export)
export { UserService };
export default app;

// ──────────────────────────────────────

// Before (conditional require)
let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

// After (dynamic import)
let sharp: typeof import("sharp") | null;
try {
  sharp = await import("sharp");
} catch {
  sharp = null;
}

// ──────────────────────────────────────

// Before (require.resolve)
const packagePath = require.resolve("my-package/package.json");

// After (import.meta.resolve)
const packagePath = import.meta.resolve("my-package/package.json");
```

### 2-4. Express Application Conversion Example

```typescript
// Before: app.js
const express = require("express");
const cors = require("cors");
const { UserService } = require("./services/user-service");
const { authMiddleware } = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/users", async (req, res) => {
  try {
    const users = await UserService.findAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const user = await UserService.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/users", authMiddleware, async (req, res) => {
  try {
    const user = await UserService.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

// ─────────────────────────────────────────────

// After: app.ts
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { UserService } from "./services/user-service";
import { authMiddleware } from "./middleware/auth";
import type { User, CreateUserDto } from "./types";

const app = express();
app.use(cors());
app.use(express.json());

// Error response type
interface ErrorResponse {
  error: string;
  details?: unknown;
}

// Typed request handlers
app.get("/users", async (_req: Request, res: Response<User[] | ErrorResponse>) => {
  try {
    const users = await UserService.findAll();
    res.json(users);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.get(
  "/users/:id",
  async (req: Request<{ id: string }>, res: Response<User | ErrorResponse>) => {
    try {
      const user = await UserService.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  }
);

app.post(
  "/users",
  authMiddleware,
  async (
    req: Request<unknown, unknown, CreateUserDto>,
    res: Response<User | ErrorResponse>
  ) => {
    try {
      const user = await UserService.create(req.body);
      res.status(201).json(user);
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && err.code === "VALIDATION_ERROR") {
        return res.status(400).json({ error: err.message });
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  }
);

export default app;
```

### 2-5. React Component Conversion

```typescript
// Before: UserCard.jsx
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

function UserCard({ user, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  const handleSave = () => {
    onEdit(user.id, { name });
    setIsEditing(false);
  };

  return (
    <div className="user-card">
      {isEditing ? (
        <input value={name} onChange={(e) => setName(e.target.value)} />
      ) : (
        <span>{user.name}</span>
      )}
      <span>{user.email}</span>
      <button onClick={() => setIsEditing(!isEditing)}>
        {isEditing ? "Cancel" : "Edit"}
      </button>
      {isEditing && <button onClick={handleSave}>Save</button>}
      <button onClick={() => onDelete(user.id)}>Delete</button>
    </div>
  );
}

UserCard.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default UserCard;

// ─────────────────────────────────────────────

// After: UserCard.tsx
import { useState, useEffect, type FC } from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserCardProps {
  user: User;
  onEdit: (id: string, data: { name: string }) => void;
  onDelete: (id: string) => void;
}

const UserCard: FC<UserCardProps> = ({ user, onEdit, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  const handleSave = () => {
    onEdit(user.id, { name });
    setIsEditing(false);
  };

  return (
    <div className="user-card">
      {isEditing ? (
        <input value={name} onChange={(e) => setName(e.target.value)} />
      ) : (
        <span>{user.name}</span>
      )}
      <span>{user.email}</span>
      <button onClick={() => setIsEditing(!isEditing)}>
        {isEditing ? "Cancel" : "Edit"}
      </button>
      {isEditing && <button onClick={handleSave}>Save</button>}
      <button onClick={() => onDelete(user.id)}>Delete</button>
    </div>
  );
};

export default UserCard;
// PropTypes are no longer needed → npm uninstall prop-types
```

---

## 3. Gradual Elimination of `any`

### 3-1. `any` Triage

```
Priority for eliminating any:

  +------------------+----------+-----------+-------------------+
  | Category         | Risk     | Action    | Estimated effort  |
  +------------------+----------+-----------+-------------------+
  | API responses    | High     | Use zod   | Medium            |
  | Function params  | High     | Define    | Small             |
  | Event handlers   | Medium   | Define    | Small             |
  | catch variables  | Medium   | unknown   | Small             |
  | JSON.parse result| Medium   | zod       | Medium            |
  | Third-party      | Low      | @types/*  | Small~Medium      |
  | Temporary TODOs  | Low      | Comment   | Future            |
  +------------------+----------+-----------+-------------------+
```

```typescript
// Step 1: Replace explicit any with unknown
// Before
function processData(data: any): any {
  return data.map((item: any) => item.name);
}

// After
function processData(data: unknown): string[] {
  if (!Array.isArray(data)) {
    throw new Error("Expected array");
  }
  return data.map((item: unknown) => {
    if (typeof item === "object" && item !== null && "name" in item) {
      return String((item as { name: unknown }).name);
    }
    throw new Error("Invalid item");
  });
}

// Step 2: Validate with zod
import { z } from "zod";

const ItemSchema = z.object({ name: z.string() });
const DataSchema = z.array(ItemSchema);

function processData(data: unknown): string[] {
  const parsed = DataSchema.parse(data);
  return parsed.map((item) => item.name);
}

// Step 3: Safe JSON.parse handling
// Before
function parseConfig(json: string): any {
  return JSON.parse(json);
}

// After
const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  port: z.number().int().positive(),
  debug: z.boolean().default(false),
});
type Config = z.infer<typeof ConfigSchema>;

function parseConfig(json: string): Config {
  const raw: unknown = JSON.parse(json);
  return ConfigSchema.parse(raw);
}
```

### 3-2. Introducing `@types/*`

```bash
# Search and install type definition packages
npm install -D @types/express @types/lodash @types/cors @types/compression

# Check if type definitions exist
npm info @types/some-package

# Install multiple packages at once
npm install -D @types/express @types/cors @types/morgan @types/cookie-parser
```

```typescript
// src/types/untyped-module.d.ts
// For third-party modules without type definitions

// Minimal type definitions (temporary, to be expanded incrementally)
declare module "untyped-lib" {
  export function doSomething(input: string): Promise<unknown>;
  export interface Config {
    apiKey: string;
    timeout?: number;
  }
}

// Gradually expand type definitions
declare module "legacy-lib" {
  export interface Options {
    format: "json" | "csv" | "xml";
    encoding?: BufferEncoding;
    strict?: boolean;
  }

  export function parse(input: string, options?: Options): Record<string, unknown>;
  export function stringify(data: Record<string, unknown>, options?: Options): string;

  export class Parser {
    constructor(options?: Options);
    parse(input: string): Record<string, unknown>;
    on(event: "data", handler: (chunk: unknown) => void): this;
    on(event: "error", handler: (error: Error) => void): this;
    on(event: "end", handler: () => void): this;
  }

  export default Parser;
}

// Type definitions for CSS / image modules (for Vite / webpack)
declare module "*.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.svg" {
  import type { FC, SVGProps } from "react";
  const component: FC<SVGProps<SVGSVGElement>>;
  export default component;
}

declare module "*.png" {
  const url: string;
  export default url;
}

// Global type augmentation
declare global {
  interface Window {
    __APP_CONFIG__: {
      apiUrl: string;
      version: string;
    };
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
      DATABASE_URL: string;
      API_KEY: string;
      PORT?: string;
    }
  }
}

export {}; // Required to be recognized as a module
```

### 3-3. Type-Safe Utilities Without `any`

```typescript
// Patterns for defining flexible types without using any

// 1. unknown + type guards
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

// 2. Generics for flexibility
function safeJsonParse<T>(json: string, schema: z.ZodType<T>): T | null {
  try {
    const raw: unknown = JSON.parse(json);
    return schema.parse(raw);
  } catch {
    return null;
  }
}

// 3. satisfies for object type checking
const routes = {
  home: "/",
  about: "/about",
  user: "/users/:id",
} satisfies Record<string, string>;

// 4. Record<string, unknown> for dynamic objects
function filterObject(
  obj: Record<string, unknown>,
  predicate: (key: string, value: unknown) => boolean
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key, value]) => predicate(key, value))
  );
}
```

---

## 4. Strictness Roadmap

### 4-1. noImplicitAny Handling Patterns

```typescript
// Error: Parameter 'x' implicitly has an 'any' type
// Pattern collection for handling this

// 1. Callback arguments
// Before
array.forEach(function (item) { /* ... */ });
// After
array.forEach(function (item: ItemType) { /* ... */ });
// Or use arrow function (when type inference works)
array.forEach((item) => { /* ... */ });

// 2. Dynamic object access
// Before
function getValue(obj, key) { return obj[key]; }
// After
function getValue<T extends Record<string, unknown>>(
  obj: T,
  key: keyof T
): T[keyof T] {
  return obj[key];
}

// 3. Event handlers
// Before
element.addEventListener("click", function (e) { /* ... */ });
// After (auto-inferred from DOM type definitions)
element.addEventListener("click", (e: MouseEvent) => { /* ... */ });

// 4. Destructuring
// Before
function processResponse({ data, status }) { /* ... */ }
// After
interface ApiResponse {
  data: unknown;
  status: number;
}
function processResponse({ data, status }: ApiResponse) { /* ... */ }

// 5. Function overloads
// Before
function format(value) {
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") return value.trim();
  return String(value);
}
// After
function format(value: number): string;
function format(value: string): string;
function format(value: unknown): string;
function format(value: unknown): string {
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") return value.trim();
  return String(value);
}

// 6. reduce accumulator
// Before
const total = items.reduce((sum, item) => sum + item.price, 0);
// After
const total = items.reduce<number>((sum, item) => sum + item.price, 0);
// Or rely on inference from the initial value
```

### 4-2. strictNullChecks Handling Patterns

```typescript
// Error: Object is possibly 'null'
// Pattern collection for handling this

// 1. Early return (Guard Clause)
function getUser(id: string): User | null {
  const user = findById(id);
  if (!user) return null; // or throw
  // user is User type from here on
  return user;
}

// 2. Optional Chaining + Nullish Coalescing
const name = user?.name ?? "Unknown";
const city = user?.address?.city ?? "N/A";

// 3. Non-null assertion (only when certain)
const element = document.getElementById("app")!;
// ↑ Do not use if element could be null

// 4. Type-safe Map / Set access
const map = new Map<string, User>();
const user = map.get("key"); // User | undefined
if (user) {
  console.log(user.name); // OK
}

// 5. Array find
const found = users.find((u) => u.id === targetId);
if (!found) {
  throw new Error(`User ${targetId} not found`);
}
// found is User type

// 6. Promise result
async function fetchUser(id: string): Promise<User | null> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) return null;
  return response.json() as Promise<User>;
}
```

---

## 5. Migration Strategy for Large Projects

### 5-1. Migration at Module Boundaries

```
In large projects, divide migration by module boundaries:

  +------------------+     +------------------+     +------------------+
  | Authentication   |     | User Management  |     | Order System     |
  | (TypeScript done)| --> | (In migration)   | --> | (JavaScript)     |
  +------------------+     +------------------+     +------------------+
         |                        |                        |
         v                        v                        v
  +------------------+     +------------------+     +------------------+
  | Type definition  |     | Partially typed  |     | Bridged with     |
  | files            |     | allowJs+checkJs  |     | .d.ts for future |
  | Fully type-safe  |     |                  |     | migration        |
  +------------------+     +------------------+     +------------------+

  Key points:
  1. Divide modules by domain
  2. Define .d.ts at inter-module interfaces
  3. Prioritize high-risk / high-change-frequency modules
  4. Always develop new features in TypeScript
```

### 5-2. Introducing an `any` Counter

```typescript
// scripts/count-any.ts -- Script to count occurrences of any
import { Project } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "./tsconfig.json",
});

let totalAny = 0;
const fileStats: { file: string; count: number }[] = [];

for (const sourceFile of project.getSourceFiles()) {
  const filePath = sourceFile.getFilePath();
  const text = sourceFile.getFullText();

  // Count explicit any
  const anyCount = (text.match(/:\s*any\b/g) || []).length;
  // Count as any
  const asAnyCount = (text.match(/as\s+any\b/g) || []).length;

  const total = anyCount + asAnyCount;
  if (total > 0) {
    fileStats.push({ file: filePath, count: total });
    totalAny += total;
  }
}

console.log(`Total any count: ${totalAny}`);
console.log("\nTop 10 files with most 'any':");
fileStats
  .sort((a, b) => b.count - a.count)
  .slice(0, 10)
  .forEach(({ file, count }) => {
    console.log(`  ${count} any: ${file}`);
  });
```

```json
// package.json
{
  "scripts": {
    "count-any": "tsx scripts/count-any.ts",
    "migration-status": "tsx scripts/migration-status.ts"
  }
}
```

### 5-3. Visualizing Migration Progress

```typescript
// scripts/migration-status.ts
import * as fs from "fs";
import * as path from "path";

function countFiles(dir: string): { js: number; ts: number; jsx: number; tsx: number } {
  const result = { js: 0, ts: 0, jsx: 0, tsx: 0 };

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walk(path.join(currentDir, entry.name));
      } else {
        const ext = path.extname(entry.name);
        if (ext === ".js") result.js++;
        if (ext === ".ts" && !entry.name.endsWith(".d.ts")) result.ts++;
        if (ext === ".jsx") result.jsx++;
        if (ext === ".tsx") result.tsx++;
      }
    }
  }

  walk(dir);
  return result;
}

const counts = countFiles("./src");
const total = counts.js + counts.ts + counts.jsx + counts.tsx;
const tsTotal = counts.ts + counts.tsx;
const jsTotal = counts.js + counts.jsx;
const percentage = ((tsTotal / total) * 100).toFixed(1);

console.log("=== Migration Status ===");
console.log(`TypeScript files: ${tsTotal} (${percentage}%)`);
console.log(`JavaScript files: ${jsTotal} (${(100 - Number(percentage)).toFixed(1)}%)`);
console.log(`  .ts:  ${counts.ts}`);
console.log(`  .tsx: ${counts.tsx}`);
console.log(`  .js:  ${counts.js}`);
console.log(`  .jsx: ${counts.jsx}`);
console.log(`Total:  ${total}`);
console.log(`\nProgress: [${"█".repeat(Math.floor(Number(percentage) / 5))}${"░".repeat(20 - Math.floor(Number(percentage) / 5))}] ${percentage}%`);
```

---

## 6. Common Migration Patterns

### 6-1. From Callback Hell to async/await

```typescript
// Before: callbacks (JavaScript)
function getUser(id, callback) {
  db.query("SELECT * FROM users WHERE id = ?", [id], (err, rows) => {
    if (err) return callback(err);
    if (rows.length === 0) return callback(new Error("Not found"));
    callback(null, rows[0]);
  });
}

// After: async/await (TypeScript)
async function getUser(id: string): Promise<User> {
  const rows = await db.query<UserRow[]>(
    "SELECT * FROM users WHERE id = ?",
    [id]
  );
  if (rows.length === 0) {
    throw new NotFoundError(`User ${id} not found`);
  }
  return mapUserRow(rows[0]);
}
```

### 6-2. Type Definitions for Configuration Objects

```typescript
// Before: dynamic configuration object
const config = {
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    name: process.env.DB_NAME || "myapp",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  server: {
    port: parseInt(process.env.PORT || "3000"),
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
    },
  },
};

// After: type-safe configuration with zod
import { z } from "zod";

const ConfigSchema = z.object({
  database: z.object({
    host: z.string().default("localhost"),
    port: z.coerce.number().int().positive().default(5432),
    name: z.string().default("myapp"),
    ssl: z.boolean().default(false),
  }),
  redis: z.object({
    url: z.string().url().default("redis://localhost:6379"),
  }),
  server: z.object({
    port: z.coerce.number().int().positive().default(3000),
    cors: z.object({
      origin: z.string().default("*"),
    }),
  }),
});

type Config = z.infer<typeof ConfigSchema>;

export const config: Config = ConfigSchema.parse({
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    name: process.env.DB_NAME,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  server: {
    port: process.env.PORT,
    cors: {
      origin: process.env.CORS_ORIGIN,
    },
  },
});
```

---

## Comparison Tables

### Migration Approach Comparison

| Approach | Duration | Risk | Team Impact | Recommended Project Size |
|-----------|------|--------|-----------|-------------------|
| Big Bang (convert all files at once) | Short | High | Large | Small (~50 files) |
| Incremental migration (file by file) | Long | Low | Small | Medium~Large |
| New features only in TS | Longest | Lowest | Smallest | Large (legacy) |
| Parallel on separate branch | Medium | Medium | Medium | Medium |
| Split at module boundaries | Medium~Long | Low | Small | Large (microservices) |

### Comparison of `any` Elimination Tools

| Tool | Purpose | Auto-fix | Accuracy |
|--------|------|---------|------|
| `tsc --strict` | Detect implicit any | No | High |
| `@typescript-eslint/no-explicit-any` | Detect explicit any | No | High |
| `ts-prune` | Detect unused exports | No | Medium |
| zod | Runtime type validation | Type inference | Highest |
| TypeStat | Auto-add types | Yes | Medium |
| ts-morph | Programmatic type manipulation | Yes | High |

---

## Anti-Patterns

### AP-1: Converting All Files at Once

```bash
# Bad: Rename all .js → .ts at once
find src -name "*.js" -exec bash -c 'mv "$0" "${0%.js}.ts"' {} \;
# → Hundreds of compile errors appear at once, becoming unmanageable

# Good: Convert one file at a time, run tests after each conversion
# 1. utils.js → utils.ts (fix type errors, run tests)
# 2. models.js → models.ts (fix type errors, run tests)
# 3. ... (pace of 3-5 files per day)
```

### AP-2: Silencing Errors with `as any`

```typescript
// Bad: Suppress type errors with as any
const result = someFunction(data as any) as any;

// Better: Temporarily allow with a TODO comment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = someFunction(data as any); // TODO: fix types in #123

// Best: Define the correct types
interface InputData {
  name: string;
  values: number[];
}
const result = someFunction(data as InputData);
```

### AP-3: Writing Too Many Type Definition Files

```typescript
// Bad: Write detailed .d.ts for every third-party module
// → Maintenance cost becomes enormous

// Good: Incremental approach
// Step 1: Minimal type definitions
declare module "old-lib" {
  export function process(data: unknown): unknown;
}

// Step 2: Flesh out types for frequently used functions only
declare module "old-lib" {
  export function process<T>(data: T): ProcessResult<T>;
  export interface ProcessResult<T> {
    data: T;
    metadata: Record<string, string>;
  }
}

// Step 3: Consider submitting a PR to DefinitelyTyped
```

### AP-4: Refactoring While Migrating

```
Bad:
  .js → .ts conversion + logic changes + refactoring

  → Too many changes make review difficult
  → Hard to identify the cause when bugs are introduced
  → Hard to tell what caused test failures

Good:
  Step 1: .js → .ts (add types only, no logic changes)
  Step 2: Verify tests, commit
  Step 3: Refactoring (in a separate commit)
```

---

## Migration Checklist

```
Phase 1 Preparation:
  [ ] Install TypeScript
  [ ] Create tsconfig.json (allowJs: true, strict: false)
  [ ] Add tsc --noEmit to build pipeline
  [ ] Install @types/* packages
  [ ] Configure ESLint with typescript-eslint
  [ ] Run type checking in CI

Phase 2 Coexistence:
  [ ] Enable checkJs: true
  [ ] Add type annotations to main functions with JSDoc
  [ ] Create shared type definition files (types/)
  [ ] Create .d.ts for untyped third-party libraries
  [ ] Verify editor TypeScript configuration

Phase 3 Conversion:
  [ ] Start converting utility files to .ts
  [ ] Convert require → import
  [ ] Convert module.exports → export
  [ ] Replace any with concrete types
  [ ] Run tests and type check in CI
  [ ] Commit one file at a time

Phase 4 Strictness:
  [ ] noImplicitAny: true
  [ ] strictNullChecks: true
  [ ] strictFunctionTypes: true
  [ ] strict: true
  [ ] noUncheckedIndexedAccess: true

Phase 5 Complete:
  [ ] All files converted to .ts
  [ ] allowJs: false
  [ ] Remove checkJs
  [ ] Remove JSDoc type annotations
  [ ] Remove prop-types (React)
  [ ] Require strict build in CI
  [ ] Confirm any count is 0
  [ ] Create team TypeScript coding guidelines
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
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
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

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
        """Add item (with size limit)"""
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
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate incrementally**: Verify hypotheses using log output or a debugger
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debug utility
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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in {func.__name__}: {e}")
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

Steps for diagnosing performance issues:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O waits**: Examine disk and network I/O status
4. **Check concurrent connections**: Examine connection pool state

| Problem type | Diagnostic tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flowchart         │
├─────────────────────────────────────────────────┤
│                                                 │
│  (1) What is the team size?                     │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → go to (2)            │
│                                                 │
│  (2) How often do you deploy?                   │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily / multiple times → go to (3)        │
│                                                 │
│  (3) How independent are the teams?             │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A quick short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of Abstraction**
- Higher abstraction improves reusability but can make debugging harder
- Lower abstraction is more intuitive but prone to code duplication

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
        """Describe background and challenges"""
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
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## FAQ

### Q1: How long does migration take?

It depends on the scale. Around 1-2 weeks for ~10,000 lines, and 1-3 months for ~100,000 lines. The important thing is that you don't have to wait for a "complete migration" — you can already benefit from type checking at Phase 2 (coexistence). Migration is not a task with a definitive end, but a continuous process of improving type quality.

### Q2: Will existing tests continue to work?

Yes. With `allowJs: true`, existing .js files continue to work as-is. Even after converting files to .ts, tests will continue to work as long as the test runner supports TypeScript (Vitest, Jest + ts-jest, etc.).

### Q3: What should I do if team members don't know TypeScript?

Starting from Phase 2 (JSDoc type annotations) allows you to benefit from types without learning TypeScript syntax. At the same time, allocate learning time to study TypeScript basics, and adopt a policy of writing new features in TypeScript — proficiency will naturally develop. Pair programming is also effective for sharing knowledge.

### Q4: How should new feature development proceed during migration?

Develop new features in TypeScript from the start. Create new files as .ts and write them with `strict: true`. Bridge with existing JS files using JSDoc or .d.ts files. This maintains the standard that "new code is always type-safe."

### Q5: In a monorepo, which package should be migrated first?

1. Start with shared libraries (shared packages) -- type information propagates to other packages
2. Then the backend (where types matter most)
3. Finally the frontend (requires migrating PropTypes to TypeScript types)

---

## Summary Table

| Concept | Key Point |
|------|------|
| Incremental migration | Convert file by file, starting from dependency leaves |
| allowJs | Setting that enables JS and TS to coexist |
| checkJs | Enables type checking for JS files |
| JSDoc types | Add types with JSDoc before converting to .ts |
| Eliminating any | Gradually improve type safety with unknown + zod |
| Strictness | noImplicitAny → strictNullChecks → strict |
| Migration progress | Visualize .ts/.js ratio with a script |
| New features in TS | Write new code in TypeScript even during migration |

---


## Summary

This guide covered the following key points:

- Understanding fundamental concepts and principles
- Practical implementation patterns
- Best practices and pitfalls
- How to apply them in real-world work

---

## Guides to Read Next

- [tsconfig.json](./00-tsconfig.md) -- Recommended configuration details for each migration phase
- [ESLint + TypeScript](./04-eslint-typescript.md) -- Lint rule configuration during migration
- [Zod Validation](../04-ecosystem/00-zod-validation.md) -- A powerful tool for eliminating any

---

## References

1. **TypeScript - Migrating from JavaScript**
   https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html

2. **Total TypeScript - Migrating to TypeScript**
   https://www.totaltypescript.com/tutorials/migrating-to-typescript

3. **Airbnb's TypeScript Migration Story** -- Brie Bunge, JSConf 2019
   A practical report on large-scale JS→TS migration

4. **ts-morph** -- Programmatic manipulation of TypeScript code
   https://github.com/dsherret/ts-morph
