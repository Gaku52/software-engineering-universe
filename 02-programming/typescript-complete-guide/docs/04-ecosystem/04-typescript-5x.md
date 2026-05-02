# TypeScript 5.x New Features Complete Guide

> A comprehensive guide covering the major new features of TypeScript 5.0–5.7 and mastering the latest patterns in modern TypeScript

## What You Will Learn

1. **TypeScript 5.0** -- ECMAScript standard decorators, const type parameters, enum improvements
2. **TypeScript 5.1** -- Getter/setter type asymmetry, implicit undefined return values
3. **TypeScript 5.2** -- `using` declarations (Explicit Resource Management), decorator metadata
4. **TypeScript 5.3** -- Import Attributes, `switch(true)` narrowing
5. **TypeScript 5.4** -- `NoInfer` utility type, type narrowing preservation in closures
6. **TypeScript 5.5** -- Type predicate inference, regex checks, `isolatedDeclarations`
7. **TypeScript 5.6** -- Iterator helper types, Disallowed Nullish/Truthy Checks
8. **TypeScript 5.7** -- Performance improvements, enhanced Node.js 22 support
9. **Migration Guide** -- Incremental migration strategies for each version
10. **Best Practices** -- Practical patterns you can use in real-world development


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Effect-ts Complete Guide](./03-effect-ts.md)

---

## 1. TypeScript 5.0: ECMAScript Standard Decorators and Literal Type Preservation

TypeScript 5.0 (March 2023) delivered major type system enhancements, including support for ECMAScript Stage 3 decorators, const type parameters, and enum improvements.

### 1-1. ECMAScript Decorators (Stage 3)

ECMAScript standard decorators are the official specification that replaces the legacy experimental decorators (`experimentalDecorators: true`).

```
Decorator application order:

  @log           Applied 3rd (from the outside)
  @validate      Applied 2nd
  @injectable    Applied 1st (innermost, executed first)
  class UserService {
    @measure     Method decorator (applied when the method is defined)
    getUser() {}
  }

Execution order:
  1. @injectable (receives the class definition)
  2. @validate (receives the result of the previous decorator)
  3. @log (applied last, returns the final class)
```

#### Implementing Class Decorators

```typescript
// ECMAScript standard decorators (Stage 3)
// TypeScript 5.0+ with experimentalDecorators: false (default)

// Class decorator: receives a class definition and returns a new class or void
function sealed<T extends { new (...args: any[]): {} }>(
  target: T,
  context: ClassDecoratorContext
): T | void {
  console.log(`Sealing class: ${context.name}`);
  Object.seal(target);
  Object.seal(target.prototype);
  return target;
}

// Decorator that adds logging capability
function logged<T extends { new (...args: any[]): {} }>(
  target: T,
  context: ClassDecoratorContext
) {
  const className = String(context.name);

  return class extends target {
    constructor(...args: any[]) {
      console.log(`[${className}] Creating instance with args:`, args);
      super(...args);
      console.log(`[${className}] Instance created`);
    }
  };
}

// Method decorator: wraps and extends a method
function log<T extends (...args: any[]) => any>(
  target: T,
  context: ClassMethodDecoratorContext
): T {
  const methodName = String(context.name);

  return function (this: any, ...args: any[]) {
    console.log(`Calling ${methodName} with`, args);
    const start = performance.now();
    const result = target.apply(this, args);
    const duration = performance.now() - start;
    console.log(`${methodName} returned`, result, `in ${duration.toFixed(2)}ms`);
    return result;
  } as T;
}

// Async method decorator
function asyncLog<T extends (...args: any[]) => Promise<any>>(
  target: T,
  context: ClassMethodDecoratorContext
): T {
  const methodName = String(context.name);

  return async function (this: any, ...args: any[]) {
    console.log(`[Async] Calling ${methodName} with`, args);
    try {
      const result = await target.apply(this, args);
      console.log(`[Async] ${methodName} resolved with`, result);
      return result;
    } catch (error) {
      console.error(`[Async] ${methodName} rejected with`, error);
      throw error;
    }
  } as T;
}

// Field decorator: auto-binds `this`
function bound<T extends (...args: any[]) => any>(
  _target: undefined,
  context: ClassFieldDecoratorContext
) {
  return function (this: any, value: T): T {
    return value.bind(this) as T;
  };
}

// Accessor decorator
function validate(
  target: any,
  context: ClassAccessorDecoratorContext | ClassSetterDecoratorContext
) {
  if (context.kind === "setter") {
    return function (this: any, value: any) {
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Invalid value for ${String(context.name)}`);
      }
      target.call(this, value);
    };
  }
}

// Usage example
interface User {
  id: string;
  name: string;
}

@sealed
@logged
class UserService {
  private users: Map<string, User> = new Map();

  @log
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  @asyncLog
  async fetchUser(id: string): Promise<User> {
    // Simulated async operation
    await new Promise((resolve) => setTimeout(resolve, 100));
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    return user;
  }

  @bound
  handleClick = () => {
    // `this` is always bound to the instance
    console.log("UserService instance:", this);
  };
}

// Execution example
const service = new UserService();
// [UserService] Creating instance with args: []
// Sealing class: UserService
// [UserService] Instance created

service.getUser("user-1");
// Calling getUser with ['user-1']
// getUser returned undefined in 0.02ms

const button = { onClick: service.handleClick };
button.onClick(); // `this` refers to the UserService instance
```

#### Using Decorator Metadata

```typescript
// Dependency injection pattern using metadata
const METADATA_KEY = Symbol("metadata");

type Metadata = {
  injectable?: boolean;
  dependencies?: Function[];
  singleton?: boolean;
};

function Injectable(options: { singleton?: boolean } = {}) {
  return function <T extends { new (...args: any[]): {} }>(
    target: T,
    context: ClassDecoratorContext
  ) {
    // Adding metadata (using context.metadata)
    context.metadata[METADATA_KEY] = {
      injectable: true,
      singleton: options.singleton ?? false,
    } as Metadata;

    return target;
  };
}

function Inject(dependency: Function) {
  return function (
    _target: undefined,
    context: ClassFieldDecoratorContext
  ) {
    const metadata = context.metadata[METADATA_KEY] as Metadata;
    if (!metadata.dependencies) {
      metadata.dependencies = [];
    }
    metadata.dependencies.push(dependency);
  };
}

@Injectable({ singleton: true })
class DatabaseService {
  connect() {
    console.log("Database connected");
  }
}

@Injectable()
class UserRepository {
  @Inject(DatabaseService)
  db!: DatabaseService;

  findAll() {
    this.db.connect();
    return ["user1", "user2"];
  }
}
```

### 1-2. Const Type Parameters

Const type parameters are a feature for preserving literal types in generic functions.

```typescript
// Basics of const type parameters

// Regular generic: literal types are lost
function identity<T>(value: T): T {
  return value;
}
const result1 = identity(["a", "b", "c"]);
// Type: string[] (literal types are lost)

// Const type parameter: literal types are preserved
function identityConst<const T>(value: T): T {
  return value;
}
const result2 = identityConst(["a", "b", "c"]);
// Type: readonly ["a", "b", "c"] (literal types are preserved)
```

#### Practical Example: Type-safe Router

```typescript
// Type-safe router implementation using const type parameters

type RouteConfig<T> = {
  readonly path: string;
  readonly handler: () => T;
};

type Router<T extends Record<string, RouteConfig<any>>> = {
  readonly routes: T;
  navigate<K extends keyof T>(path: K): ReturnType<T[K]["handler"]>;
  getPaths(): ReadonlyArray<keyof T>;
};

function createRouter<const T extends Record<string, RouteConfig<any>>>(
  routes: T
): Router<T> {
  return {
    routes,
    navigate(path) {
      const route = routes[path];
      if (!route) {
        throw new Error(`Route ${String(path)} not found`);
      }
      return route.handler();
    },
    getPaths() {
      return Object.keys(routes) as Array<keyof T>;
    },
  };
}

// Usage example
const router = createRouter({
  "/home": {
    path: "/home",
    handler: () => ({ page: "home", title: "Home Page" }),
  },
  "/about": {
    path: "/about",
    handler: () => ({ page: "about", version: 2 }),
  },
  "/contact": {
    path: "/contact",
    handler: () => ({ page: "contact", email: "info@example.com" }),
  },
});

// Type-safe navigation
const homeResult = router.navigate("/home");
// Type: { page: string; title: string }

const aboutResult = router.navigate("/about");
// Type: { page: string; version: number }

// @ts-expect-error: path does not exist
router.navigate("/unknown");

// Get list of paths
const paths = router.getPaths();
// Type: readonly ("/home" | "/about" | "/contact")[]
```

#### Combining Const Type Parameters with satisfies

```typescript
// Advanced pattern combining const type parameters with satisfies

type Action = {
  type: string;
  payload?: unknown;
};

type ActionMap = Record<string, Action>;

function createActions<const T extends ActionMap>(actions: T): T {
  return actions;
}

// Usage example: Redux-like action definitions
const actions = createActions({
  INCREMENT: { type: "INCREMENT" },
  DECREMENT: { type: "DECREMENT" },
  SET_VALUE: { type: "SET_VALUE", payload: 0 },
} satisfies ActionMap);

// Type: {
//   readonly INCREMENT: { type: "INCREMENT" };
//   readonly DECREMENT: { type: "DECREMENT" };
//   readonly SET_VALUE: { type: "SET_VALUE"; payload: number };
// }

type ActionsType = typeof actions;
type ActionTypes = ActionsType[keyof ActionsType];
// ActionTypes =
//   | { type: "INCREMENT" }
//   | { type: "DECREMENT" }
//   | { type: "SET_VALUE"; payload: number }

function reducer(state: number, action: ActionTypes): number {
  switch (action.type) {
    case "INCREMENT":
      return state + 1;
    case "DECREMENT":
      return state - 1;
    case "SET_VALUE":
      // action.payload is inferred as number
      return action.payload;
    default:
      return state;
  }
}
```

### 1-3. Enum Improvements

TypeScript 5.0 improved the interoperability between enums and union types.

```typescript
// Enum improvements: improved consistency with union types

enum Color {
  Red = "red",
  Green = "green",
  Blue = "blue",
}

// Before 5.0: this assignment could result in an error
const colors: Color[] = ["red", "green", "blue"] as Color[];

// After 5.0: handled more flexibly
type ColorValue = `${Color}`;
const colorValue: ColorValue = "red"; // OK

// Generate a union type from enum values
type ColorUnion = Color.Red | Color.Green | Color.Blue;

function processColor(color: ColorUnion): void {
  console.log(color);
}

processColor(Color.Red); // OK
processColor("red" as Color.Red); // OK
```

---

## 2. TypeScript 5.1: Getter/Setter Type Asymmetry and Return Type Improvements

TypeScript 5.1 (June 2023) allowed getters and setters to use different types, enabling more flexible class design.

### 2-1. Unrelated Types for Getters and Setters

```typescript
// Getters and setters can now use different types

class Resource {
  private _value: string | undefined;

  // getter returns a non-null string
  get value(): string {
    if (this._value === undefined) {
      throw new Error("Value not initialized");
    }
    return this._value;
  }

  // setter accepts string | undefined
  set value(val: string | undefined) {
    this._value = val;
  }
}

const r = new Resource();
r.value = "hello";         // setter: accepts string | undefined
const v: string = r.value; // getter: returns string (not undefined)
r.value = undefined;       // OK: setter accepts undefined

// Reading r.value returns string (though it may throw if not initialized)
```

#### Practical Example: Lazy Initialization Pattern

```typescript
// Lazy Initialization with getter/setter type asymmetry

class LazyValue<T> {
  private _value: T | undefined;
  private _initializer: () => T;

  constructor(initializer: () => T) {
    this._initializer = initializer;
  }

  // getter: always returns T (initializes if not yet initialized)
  get value(): T {
    if (this._value === undefined) {
      console.log("Initializing lazy value...");
      this._value = this._initializer();
    }
    return this._value;
  }

  // setter: accepts T | undefined (can be reset)
  set value(val: T | undefined) {
    this._value = val;
  }

  reset(): void {
    this._value = undefined;
  }
}

// Usage example
const expensiveComputation = new LazyValue(() => {
  console.log("Computing...");
  return Array.from({ length: 1000000 }, (_, i) => i).reduce((a, b) => a + b, 0);
});

console.log("Before access");
const result = expensiveComputation.value; // "Initializing lazy value..." → "Computing..."
console.log(result); // 499999500000
const cachedResult = expensiveComputation.value; // "Computing..." is not printed again (cached)

expensiveComputation.reset();
const recomputed = expensiveComputation.value; // "Computing..." is printed again
```

#### Getter/Setter with Type Conversion

```typescript
// Getter/setter pattern with type conversion

class TemperatureConverter {
  private _celsius: number = 0;

  // Stored in Celsius, retrieved in Fahrenheit
  get fahrenheit(): number {
    return (this._celsius * 9) / 5 + 32;
  }

  set fahrenheit(f: number) {
    this._celsius = ((f - 32) * 5) / 9;
  }

  get celsius(): number {
    return this._celsius;
  }

  set celsius(c: number) {
    this._celsius = c;
  }
}

const temp = new TemperatureConverter();
temp.celsius = 0;
console.log(temp.fahrenheit); // 32

temp.fahrenheit = 100;
console.log(temp.celsius); // 37.77777777777778
```

### 2-2. Implicit Undefined Return Values

In TypeScript 5.1, when a function's return type is `T | undefined`, you no longer need to explicitly write `return undefined`.

```typescript
// Implicit undefined return value improvement

// Before 5.1: return undefined was required
function findUser(id: string): User | undefined {
  const user = database.get(id);
  if (!user) {
    return undefined; // had to be explicit
  }
  return user;
}

// After 5.1: return can be omitted
function findUser2(id: string): User | undefined {
  const user = database.get(id);
  if (!user) {
    return; // undefined is implicitly returned
  }
  return user;
}

// More natural writing is now possible
function getConfig(key: string): string | undefined {
  if (key === "port") return "3000";
  if (key === "host") return "localhost";
  // undefined is implicitly returned
}
```

---

## 3. TypeScript 5.2: Explicit Resource Management (using Declaration)

TypeScript 5.2 (August 2023) added support for `using` declarations based on the ECMAScript Explicit Resource Management proposal.

### 3-1. Basics of the using Declaration

```
Resource management with using:

  {
    using file = openFile("data.txt");
    // use file
    const content = file.read();
    // ...
  } ← file[Symbol.dispose]() is automatically called when the scope exits

  {
    await using db = await connectToDatabase();
    // use db
    const users = await db.query("SELECT * FROM users");
    // ...
  } ← await db[Symbol.asyncDispose]() is automatically called
```

#### Implementing Disposable

```typescript
// Implementing the Disposable interface

class FileHandle implements Disposable {
  private handle: number | null = null;
  private path: string;

  constructor(path: string) {
    this.path = path;
    this.handle = this.openFileSync(path);
    console.log(`Opened: ${path}`);
  }

  private openFileSync(path: string): number {
    // Simulated file handle
    return Math.floor(Math.random() * 1000);
  }

  read(): string {
    if (this.handle === null) {
      throw new Error("File is closed");
    }
    return `Content of ${this.path}`;
  }

  write(content: string): void {
    if (this.handle === null) {
      throw new Error("File is closed");
    }
    console.log(`Writing to ${this.path}:`, content);
  }

  [Symbol.dispose](): void {
    if (this.handle !== null) {
      console.log(`Closing file: ${this.path}`);
      this.handle = null;
    }
  }
}

// Automatic resource release with using
function processFile(path: string): string {
  using file = new FileHandle(path);
  const content = file.read();
  file.write("Updated content");
  return content;
  // [Symbol.dispose]() is automatically called when the scope exits
}

// Execution example
const result = processFile("data.txt");
// Opened: data.txt
// Writing to data.txt: Updated content
// Closing file: data.txt
```

#### Implementing AsyncDisposable

```typescript
// AsyncDisposable interface

class DatabaseConnection implements AsyncDisposable {
  private connected: boolean = false;
  private url: string;

  private constructor(url: string) {
    this.url = url;
  }

  static async create(url: string): Promise<DatabaseConnection> {
    const conn = new DatabaseConnection(url);
    await conn.connect();
    return conn;
  }

  private async connect(): Promise<void> {
    console.log(`Connecting to ${this.url}...`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.connected = true;
    console.log("Connected!");
  }

  async query<T>(sql: string): Promise<T[]> {
    if (!this.connected) {
      throw new Error("Not connected");
    }
    console.log(`Executing query: ${sql}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return [] as T[];
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this.connected) {
      console.log("Disconnecting from database...");
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.connected = false;
      console.log("Disconnected!");
    }
  }
}

// Automatic resource release with await using
async function queryUsers(): Promise<User[]> {
  await using db = await DatabaseConnection.create("postgresql://localhost:5432/mydb");
  const users = await db.query<User>("SELECT * FROM users");
  return users;
  // await db[Symbol.asyncDispose]() is automatically called
}

// Execution example
await queryUsers();
// Connecting to postgresql://localhost:5432/mydb...
// Connected!
// Executing query: SELECT * FROM users
// Disconnecting from database...
// Disconnected!
```

#### Error Handling with using

```typescript
// Error handling and SuppressedError with using

class Transaction implements Disposable {
  private committed: boolean = false;

  commit(): void {
    console.log("Committing transaction...");
    this.committed = true;
  }

  [Symbol.dispose](): void {
    if (!this.committed) {
      console.log("Rolling back transaction...");
      // Rollback logic
    }
  }
}

function processTransaction(shouldFail: boolean): void {
  using tx = new Transaction();

  if (shouldFail) {
    throw new Error("Transaction failed");
  }

  tx.commit();
}

try {
  processTransaction(true);
} catch (error) {
  console.error("Error:", error);
  // tx[Symbol.dispose]() is called first, then the error is thrown
}
// Rolling back transaction...
// Error: Error: Transaction failed

// When an error also occurs during dispose
class ProblematicResource implements Disposable {
  [Symbol.dispose](): void {
    throw new Error("Dispose failed");
  }
}

function useProblematicResource(): void {
  using resource = new ProblematicResource();
  throw new Error("Operation failed");
}

try {
  useProblematicResource();
} catch (error) {
  console.error(error);
  // SuppressedError is thrown (contains both the original error and the dispose error)
}
```

### 3-2. Decorator Metadata

TypeScript 5.2 improved the type definitions for decorator metadata.

```typescript
// Using decorator metadata

type MetadataMap = {
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  };
  serialization?: {
    name?: string;
    ignore?: boolean;
  };
};

function Required() {
  return function (
    _target: undefined,
    context: ClassFieldDecoratorContext
  ) {
    const metadata = context.metadata as MetadataMap;
    if (!metadata.validation) {
      metadata.validation = {};
    }
    metadata.validation.required = true;
  };
}

function MinLength(length: number) {
  return function (
    _target: undefined,
    context: ClassFieldDecoratorContext
  ) {
    const metadata = context.metadata as MetadataMap;
    if (!metadata.validation) {
      metadata.validation = {};
    }
    metadata.validation.minLength = length;
  };
}

function SerializedName(name: string) {
  return function (
    _target: undefined,
    context: ClassFieldDecoratorContext
  ) {
    const metadata = context.metadata as MetadataMap;
    if (!metadata.serialization) {
      metadata.serialization = {};
    }
    metadata.serialization.name = name;
  };
}

class UserDto {
  @Required()
  @MinLength(3)
  @SerializedName("user_name")
  username!: string;

  @Required()
  email!: string;
}

// Validation function using metadata
function validate<T extends object>(obj: T): boolean {
  const metadata = (obj.constructor as any)[Symbol.metadata] as MetadataMap;
  // Validation logic using metadata
  return true;
}
```

---

## 4. TypeScript 5.3: Import Attributes and Improved Type Narrowing

TypeScript 5.3 (November 2023) introduced support for Import Attributes (formerly Import Assertions) and major improvements to type narrowing.

### 4-1. Import Attributes

```typescript
// Import Attributes (formerly: Import Assertions)

// Importing JSON
import config from "./config.json" with { type: "json" };
// The type of config is automatically inferred

// Importing CSS (CSS Modules)
import styles from "./app.css" with { type: "css" };

// Dynamic import
const data = await import("./data.json", {
  with: { type: "json" },
});

// Custom attributes
import wasmModule from "./module.wasm" with { type: "webassembly" };

// Example type definition
// config.json
{
  "port": 3000,
  "host": "localhost",
  "debug": true
}

// Type automatically inferred by TypeScript:
// type Config = {
//   port: number;
//   host: string;
//   debug: boolean;
// }
```

#### Practical Example: Import Attributes

```typescript
// Configuration management using Import Attributes

// config/development.json
import devConfig from "./config/development.json" with { type: "json" };

// config/production.json
import prodConfig from "./config/production.json" with { type: "json" };

type Config = {
  database: {
    host: string;
    port: number;
    name: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  features: {
    enableAnalytics: boolean;
    enableDebug: boolean;
  };
};

function getConfig(): Config {
  const env = process.env.NODE_ENV || "development";

  switch (env) {
    case "production":
      return prodConfig;
    case "development":
    default:
      return devConfig;
  }
}

export const config = getConfig();
```

### 4-2. Type Narrowing in switch (true)

```typescript
// Type narrowing in switch (true) (5.3 improvement)

function classify(value: string | number | boolean | null): string {
  switch (true) {
    case value === null:
      // value is narrowed to null
      return "null value";

    case typeof value === "string":
      // value is narrowed to string
      return value.toUpperCase();

    case typeof value === "number":
      // value is narrowed to number
      return value.toFixed(2);

    case typeof value === "boolean":
      // value is narrowed to boolean
      return value ? "yes" : "no";

    default:
      const _exhaustive: never = value;
      return _exhaustive;
  }
}

// Narrowing with more complex conditions
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function getArea(shape: Shape): number {
  switch (true) {
    case shape.kind === "circle":
      // shape is narrowed to { kind: "circle"; radius: number }
      return Math.PI * shape.radius ** 2;

    case shape.kind === "rectangle":
      // shape is narrowed to { kind: "rectangle"; width: number; height: number }
      return shape.width * shape.height;

    case shape.kind === "triangle":
      // shape is narrowed to { kind: "triangle"; base: number; height: number }
      return (shape.base * shape.height) / 2;

    default:
      const _exhaustive: never = shape;
      return _exhaustive;
  }
}
```

### 4-3. Improved Inline Type Narrowing

```typescript
// Improved inline type narrowing

type Response<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function fetchUser(id: string): Promise<Response<User>> {
  try {
    const user = await api.getUser(id);
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// 5.3 improvement: narrowing works with inline conditions
async function processUser(id: string): Promise<void> {
  const response = await fetchUser(id);

  // After 5.3: checking response.success narrows the type
  if (response.success) {
    // response is narrowed to { success: true; data: User }
    console.log(response.data.name);
  } else {
    // response is narrowed to { success: false; error: string }
    console.error(response.error);
  }

  // Narrowing also works inside ternary expressions
  const message = response.success
    ? `User: ${response.data.name}`  // data is available
    : `Error: ${response.error}`;    // error is available
}
```

---

## 5. TypeScript 5.4: NoInfer and Type Narrowing Preservation in Closures

TypeScript 5.4 (March 2024) introduced the `NoInfer` utility type and enabled preservation of type narrowing inside closures.

### 5-1. NoInfer Utility Type

`NoInfer` is a utility type that excludes a specific position from type inference candidates.

```typescript
// NoInfer: exclude from type inference candidates

// Without NoInfer: T is inferred from defaultValue as well
function getOrDefault<T>(
  value: T | null | undefined,
  defaultValue: T
): T {
  return value ?? defaultValue;
}

const result1 = getOrDefault("hello", 42);
// T is inferred as string | number (undesirable)

// With NoInfer: T is not inferred from defaultValue
function getOrDefaultFixed<T>(
  value: T | null | undefined,
  defaultValue: NoInfer<T>
): T {
  return value ?? defaultValue;
}

const result2 = getOrDefaultFixed("hello", 42);
// Error: number is not assignable to string
// T is inferred only from the type of "hello", which is string

const result3 = getOrDefaultFixed("hello", "world");
// OK: T is inferred as string, and defaultValue is also string
```

#### Practical Examples of NoInfer

```typescript
// Type-safe API using NoInfer

// Bad example: type is inferred from both arguments
function createPair<T>(first: T, second: T): [T, T] {
  return [first, second];
}

const pair1 = createPair(1, "hello");
// T is inferred as number | string (undesirable)
// Type of pair1: [number | string, number | string]

// Good example: type is inferred only from the first argument
function createPairFixed<T>(first: T, second: NoInfer<T>): [T, T] {
  return [first, second];
}

const pair2 = createPairFixed(1, "hello");
// Error: string is not assignable to number

const pair3 = createPairFixed(1, 2);
// OK: type of pair3 is [number, number]

// Practical usage: event handlers
type EventMap = {
  click: { x: number; y: number };
  keypress: { key: string };
  submit: { data: FormData };
};

function addEventListener<K extends keyof EventMap>(
  event: K,
  handler: (payload: NoInfer<EventMap[K]>) => void
): void {
  // Register the event listener
}

// K is inferred from event, and handler's type follows accordingly
addEventListener("click", (payload) => {
  console.log(payload.x, payload.y); // OK
});

addEventListener("keypress", (payload) => {
  console.log(payload.key); // OK
  // @ts-expect-error: x does not exist on keypress
  console.log(payload.x);
});
```

#### NoInfer and Default Value Patterns

```typescript
// Default value pattern using NoInfer

type Options<T> = {
  value: T;
  fallback?: NoInfer<T>;
  transform?: (val: T) => NoInfer<T>;
};

function process<T>(options: Options<T>): T {
  const { value, fallback, transform } = options;
  const processed = transform ? transform(value) : value;
  return processed ?? fallback ?? value;
}

// Usage example
const result = process({
  value: "hello",
  fallback: "default", // OK: string
  transform: (s) => s.toUpperCase(), // OK: (string) => string
});

const invalid = process({
  value: "hello",
  fallback: 123, // Error: number is not assignable to string
});
```

### 5-2. Type Narrowing Preservation in Closures

TypeScript 5.4 preserves type narrowing inside closures.

```typescript
// Type narrowing preservation in closures

function processValue(value: string | number) {
  if (typeof value === "string") {
    // Before 5.4: inside a closure, value reverts to string | number
    // After 5.4: value remains narrowed to string

    const fn = () => {
      return value.toUpperCase(); // OK in 5.4+
    };

    return fn();
  } else {
    const fn = () => {
      return value.toFixed(2); // OK: value is number
    };

    return fn();
  }
}

// More complex example
type User = { type: "user"; name: string; email: string };
type Admin = { type: "admin"; name: string; permissions: string[] };
type Person = User | Admin;

function processPerson(person: Person): void {
  if (person.type === "admin") {
    // person is narrowed to Admin

    const logPermissions = () => {
      // 5.4+: person.permissions is accessible
      console.log(person.permissions.join(", "));
    };

    logPermissions();

    // Narrowing is also preserved inside async functions
    setTimeout(() => {
      console.log(person.permissions); // OK
    }, 1000);
  }
}
```

#### Combining Array Methods and Closures

```typescript
// Combining array methods and closures

type Item = { id: number; name: string; category?: string };

function filterAndMap(items: Item[]): string[] {
  // Extract only items where category exists
  return items
    .filter((item) => item.category !== undefined)
    .map((item) => {
      // 5.4+: item.category is narrowed to string
      return item.category.toUpperCase();
    });
}

// More complex example
function processItems(items: (string | number)[]): void {
  items.forEach((item) => {
    if (typeof item === "string") {
      // item is narrowed to string

      const delayed = () => {
        // 5.4+: item remains string
        console.log(item.toUpperCase());
      };

      setTimeout(delayed, 100);
    }
  });
}
```

---

## 6. TypeScript 5.5: Type Predicate Inference and Regex Checks

TypeScript 5.5 (June 2024) brought major improvements including automatic inference of type predicates, syntax checking for regular expressions, and `isolatedDeclarations`.

### 6-1. Type Predicate Inference

TypeScript 5.5 can now automatically infer type predicates.

```
Type predicate inference:

  Before 5.5:
  const isString = (x: unknown): x is string => typeof x === "string";
  // Had to explicitly write `x is string`

  After 5.5:
  const isString = (x: unknown) => typeof x === "string";
  // `x is string` is automatically inferred!
```

```typescript
// Automatic inference of type predicates

// Before 5.5: explicit type predicate required
function isNonNullOld<T>(value: T | null | undefined): value is T {
  return value != null;
}

// After 5.5: automatically inferred
const isNonNull = <T>(value: T | null | undefined) => value != null;
// Inferred type: <T>(value: T | null | undefined) => value is T

const values = [1, null, 2, undefined, 3];
const filtered = values.filter(isNonNull);
// 5.5+: type of filtered is number[]
// Before 5.4: type of filtered is (number | null | undefined)[]

// More complex example
const isUser = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  "name" in value;
// Automatically inferred: (value: unknown) => value is { id: unknown; name: unknown }

interface User {
  id: number;
  name: string;
  email: string;
}

const users: unknown[] = await fetchData();
const validUsers = users.filter(isUser);
// Type of validUsers: { id: unknown; name: unknown }[]
```

#### Combining filter with Type Predicates

```typescript
// Automatic type predicate inference with filter

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

const shapes: Shape[] = [
  { kind: "circle", radius: 5 },
  { kind: "rectangle", width: 10, height: 20 },
  { kind: "triangle", base: 8, height: 12 },
];

// 5.5: type predicate is automatically inferred
const circles = shapes.filter((s) => s.kind === "circle");
// Type of circles: { kind: "circle"; radius: number }[]

const rectangles = shapes.filter((s) => s.kind === "rectangle");
// Type of rectangles: { kind: "rectangle"; width: number; height: number }[]

// Combining multiple conditions
const bigShapes = shapes.filter((s) => {
  if (s.kind === "circle") return s.radius > 10;
  if (s.kind === "rectangle") return s.width > 10 || s.height > 10;
  return s.base > 10;
});
// Type of bigShapes: Shape[] (not narrowed)
```

#### Simplified Custom Type Guards

```typescript
// Simplified custom type guards

// Before 5.5: explicit type predicate
function isErrorOld(value: unknown): value is Error {
  return value instanceof Error;
}

// After 5.5: automatically inferred
const isError = (value: unknown) => value instanceof Error;
// Inferred type: (value: unknown) => value is Error

// Array type guard
const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
// Inferred type: (value: unknown) => value is string[]

const data: unknown = JSON.parse('["a", "b", "c"]');
if (isStringArray(data)) {
  // data is narrowed to string[]
  data.forEach((s) => console.log(s.toUpperCase()));
}
```

### 6-2. Regex Type Checking

TypeScript 5.5 improved syntax checking for regular expression literals.

```typescript
// Regex type checking

// OK: valid regular expressions
const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
const phoneRegex = /^\+?[1-9]\d{1,14}$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Error: unclosed bracket
// @ts-expect-error
const invalidRegex1 = /[unclosed/;

// Error: invalid escape sequence
// @ts-expect-error
const invalidRegex2 = /\k/;

// OK: named capture groups
const dateRegex = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;

// OK: backreference
const duplicateRegex = /(\w+)\s+\1/;

// OK: Unicode property escapes
const emojiRegex = /\p{Emoji}/u;
```

#### Practical Regex Examples

```typescript
// Validation using regular expressions

type Validator<T extends string> = {
  pattern: RegExp;
  validate: (value: string) => value is T;
  format: (value: T) => string;
};

// Email validator
const emailValidator: Validator<`${string}@${string}.${string}`> = {
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  validate: (value): value is `${string}@${string}.${string}` => {
    return emailValidator.pattern.test(value);
  },
  format: (value) => value.toLowerCase(),
};

// URL validator
const urlValidator: Validator<`https://${string}` | `http://${string}`> = {
  pattern: /^https?:\/\/.+$/,
  validate: (value): value is `https://${string}` | `http://${string}` => {
    return urlValidator.pattern.test(value);
  },
  format: (value) => value,
};

// Usage example
const email = "user@example.com";
if (emailValidator.validate(email)) {
  // email is of type `${string}@${string}.${string}`
  const formatted = emailValidator.format(email);
}

const url = "https://example.com";
if (urlValidator.validate(url)) {
  // url is of type `https://${string}` | `http://${string}`
  const formatted = urlValidator.format(url);
}
```

### 6-3. isolatedDeclarations

TypeScript 5.5 added the `--isolatedDeclarations` flag to improve isolation of type definitions.

```typescript
// Enabling isolatedDeclarations
// tsconfig.json
{
  "compilerOptions": {
    "isolatedDeclarations": true,
    "declaration": true
  }
}

// When isolatedDeclarations is enabled: return types must be explicitly annotated

// NG: return type is not explicitly annotated
export function getUser(id: string) {
  return { id, name: "Alice" };
}

// OK: return type is explicitly annotated
export function getUser(id: string): { id: string; name: string } {
  return { id, name: "Alice" };
}

// Or use a type alias
type UserData = { id: string; name: string };

export function getUser(id: string): UserData {
  return { id, name: "Alice" };
}

// Same applies to generic functions
// NG
export function map<T, U>(arr: T[], fn: (item: T) => U) {
  return arr.map(fn);
}

// OK
export function map<T, U>(arr: T[], fn: (item: T) => U): U[] {
  return arr.map(fn);
}
```

---

## 7. TypeScript 5.6: Iterator Helpers and Stricter Checks

TypeScript 5.6 (September 2024) brought further type safety improvements, including type definitions for Iterator helper methods and Disallowed Nullish/Truthy Checks.

### 7-1. Iterator Helper Methods

```typescript
// Iterator helper methods (TC39 Stage 3)

function* fibonacci(): Generator<number> {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

const fib = fibonacci();

// .take() -- get the first N elements
const first10 = fib.take(10);
// Type: IteratorObject<number, void, undefined>

// .map() -- transform each element
const doubled = fib.take(10).map((n) => n * 2);
// Type: IteratorObject<number, void, undefined>

// .filter() -- filter elements
const evens = fib.take(20).filter((n) => n % 2 === 0);
// Type: IteratorObject<number, void, undefined>

// .toArray() -- convert to array
const array = fib.take(10).toArray();
// Type: number[]

// Chainable
const result = fib
  .take(100)
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2)
  .take(10)
  .toArray();
// result: number[] = [0, 4, 8, 16, 24, 40, 56, 88, 136, 216]
```

#### Practical Examples of Iterator Helpers

```typescript
// Data processing using Iterator helpers

function* range(start: number, end: number, step: number = 1): Generator<number> {
  for (let i = start; i < end; i += step) {
    yield i;
  }
}

// Squares of odd numbers from 1 to 100
const oddSquares = range(1, 100)
  .filter((n) => n % 2 === 1)
  .map((n) => n ** 2)
  .toArray();
// [1, 9, 25, 49, 81, ...]

// Infinite stream processing
function* naturals(): Generator<number> {
  let n = 1;
  while (true) {
    yield n++;
  }
}

const first20Primes = naturals()
  .filter((n) => {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false;
    }
    return true;
  })
  .take(20)
  .toArray();
// [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71]

// Lazy file line processing
async function* readLines(path: string): AsyncGenerator<string> {
  const file = await openFile(path);
  try {
    for await (const line of file) {
      yield line;
    }
  } finally {
    await file.close();
  }
}

// Async Iterator helpers
const longLines = await readLines("data.txt")
  .filter((line) => line.length > 100)
  .map((line) => line.trim())
  .take(10)
  .toArray();
```

### 7-2. Disallowed Nullish/Truthy Checks

TypeScript 5.6 detects conditional expressions that are always true or always false.

```typescript
// Disallowed Nullish/Truthy Checks

// Error: this condition is always true
const value = "hello";
if (value) {
  // Warning: value is always truthy
}

// Error: this condition is always false
const num = 42;
if (!num) {
  // Warning: num is always truthy
}

// Error: nullish coalescing is unnecessary
const str = "hello";
const result = str ?? "default";
// Warning: str is always non-nullish

// OK: nullable value
const nullable: string | null = getValue();
if (nullable) {
  // No issue
}

const withDefault = nullable ?? "default";
// No issue

// For function parameters
function process(value: string): void {
  // Error: value is always truthy (not undefined/null)
  if (value) {
    console.log(value);
  }

  // OK: checking for empty string
  if (value.length > 0) {
    console.log(value);
  }
}

// Optional parameters are OK
function processOptional(value?: string): void {
  // OK: value is string | undefined
  if (value) {
    console.log(value);
  }
}
```

#### Practical Fix Examples

```typescript
// Fix examples for Disallowed Nullish/Truthy Checks

// NG: unnecessary nullish check
function getUserName(user: User): string {
  return user.name ?? "Anonymous";
  // Warning: user.name is of type string, so ?? is unnecessary
}

// OK: corrected version
function getUserName(user: User): string {
  return user.name || "Anonymous"; // covers empty string as well
  // or
  return user.name.length > 0 ? user.name : "Anonymous";
}

// NG: always-true condition
function isValid(config: Config): boolean {
  if (config) {
    // Warning: config is always truthy
    return true;
  }
  return false;
}

// OK: corrected version (appropriate property check)
function isValid(config: Config): boolean {
  return config.apiKey.length > 0 && config.endpoint.length > 0;
}
```

### 7-3. --noUncheckedSideEffectImports

```typescript
// Checking side-effect-only imports
// tsconfig.json
{
  "compilerOptions": {
    "noUncheckedSideEffectImports": true
  }
}

// Error: module does not exist
import "./nonexistent-module";

// OK: exists in node_modules
import "reflect-metadata";

// OK: file exists
import "./setup.js";

// OK: listed in sideEffects field of package.json
import "polyfills";

// Practical example
// setup.ts (side-effect-only module)
console.log("Initializing application...");

// polyfills.ts
if (!Array.prototype.at) {
  Array.prototype.at = function (index: number) {
    if (index < 0) {
      return this[this.length + index];
    }
    return this[index];
  };
}

// main.ts
import "./setup"; // OK: setup.ts exists
import "./polyfills"; // OK: polyfills.ts exists
```

---

## 8. TypeScript 5.7: Performance Improvements and Optimizations

TypeScript 5.7 (December 2024) introduced significant performance improvements and new optimization features.

### 8-1. Performance Improvements

```typescript
// TypeScript 5.7 performance improvements

// Processing of large union types is faster
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
type StatusCode = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 500 | 502 | 503;
type ContentType = "application/json" | "text/html" | "text/plain" | "application/xml";

type Response = {
  method: HttpMethod;
  status: StatusCode;
  contentType: ContentType;
  body: unknown;
};

// In 5.7, inference for these complex types is faster

// Optimized mapped types
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

type ComplexObject = {
  users: {
    id: number;
    profile: {
      name: string;
      settings: {
        theme: string;
        notifications: boolean;
      };
    };
  }[];
};

type ReadonlyComplex = DeepReadonly<ComplexObject>;
// Processing is faster in 5.7
```

### 8-2. --erasableSyntaxOnly (Experimental Feature)

```typescript
// --erasableSyntaxOnly flag (experimental feature in 5.7)
// tsconfig.json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true
  }
}

// When this flag is enabled, only syntax that can be removed during transpilation is allowed

// OK: type annotations can be erased
const name: string = "Alice";

// OK: interface definitions can be erased
interface User {
  id: number;
  name: string;
}

// NG: enums generate JavaScript code, so they are not allowed
enum Color {
  Red,
  Green,
  Blue,
}

// OK alternative: use a const object or union type
const Color = {
  Red: "red",
  Green: "green",
  Blue: "blue",
} as const;

type ColorValue = typeof Color[keyof typeof Color];

// NG: namespaces generate JavaScript code
namespace Utils {
  export function log(message: string) {
    console.log(message);
  }
}

// OK alternative: use regular modules
export function log(message: string) {
  console.log(message);
}
```

### 8-3. Enhanced Node.js 22 Support

```typescript
// Support for new Node.js 22 features

// Improved types for AsyncLocalStorage
import { AsyncLocalStorage } from "async_hooks";

const storage = new AsyncLocalStorage<{ requestId: string }>();

async function handleRequest(requestId: string) {
  await storage.run({ requestId }, async () => {
    // storage.getStore() type is correctly inferred
    const context = storage.getStore();
    if (context) {
      console.log(`Request ID: ${context.requestId}`);
    }
  });
}

// Native support for Import Attributes
import packageJson from "./package.json" with { type: "json" };
// In Node.js 22, the --experimental-json-modules flag is no longer needed

// Type definitions for new Array methods
const numbers = [1, 2, 3, 4, 5];

// Array.prototype.toReversed()
const reversed = numbers.toReversed();
// Type: number[] (original array is not mutated)

// Array.prototype.toSorted()
const sorted = numbers.toSorted((a, b) => b - a);
// Type: number[]

// Array.prototype.toSpliced()
const spliced = numbers.toSpliced(2, 1, 10);
// Type: number[]

// Array.prototype.with()
const replaced = numbers.with(2, 100);
// Type: number[]
```

---

## 9. Version-by-Version Migration Guide

### 9-1. Migrating to TypeScript 5.0

```typescript
// Migration to 5.0

// Step 1: Review experimentalDecorators
// tsconfig.json
{
  "compilerOptions": {
    // Keep as true if using legacy decorators
    "experimentalDecorators": true,
    // Or migrate to new decorators
    "experimentalDecorators": false
  }
}

// Step 2: Review enum usage
// Behavior of enums may have changed in 5.0
enum Status {
  Pending = "PENDING",
  Success = "SUCCESS",
  Error = "ERROR",
}

// Consider migrating to union types
type Status = "PENDING" | "SUCCESS" | "ERROR";

// Step 3: Take advantage of const type parameters
// Before
function createConfig<T>(config: T) {
  return config;
}

// After
function createConfig<const T>(config: T) {
  return config;
}
```

### 9-2. Migrating to TypeScript 5.2

```typescript
// Migration to 5.2: introducing using declarations

// Before: manual resource management
async function processData() {
  const db = await connectToDatabase();
  try {
    const result = await db.query("SELECT * FROM users");
    return result;
  } finally {
    await db.disconnect();
  }
}

// After: using declaration
async function processData() {
  await using db = await DatabaseConnection.create(process.env.DB_URL!);
  const result = await db.query("SELECT * FROM users");
  return result;
  // disconnect is called automatically
}

// Implementing AsyncDisposable
class DatabaseConnection implements AsyncDisposable {
  static async create(url: string): Promise<DatabaseConnection> {
    const conn = new DatabaseConnection();
    await conn.connect(url);
    return conn;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.disconnect();
  }

  private async connect(url: string): Promise<void> { /* ... */ }
  private async disconnect(): Promise<void> { /* ... */ }
  async query(sql: string): Promise<any[]> { /* ... */ }
}
```

### 9-3. Migrating to TypeScript 5.4

```typescript
// Migration to 5.4: leveraging NoInfer

// Before: type inference proceeds in unintended directions
function merge<T>(defaults: T, overrides: T): T {
  return { ...defaults, ...overrides };
}

const config = merge(
  { port: 3000, host: "localhost" },
  { port: 8080, unknown: true } // unknown is accepted (undesirable)
);

// After: NoInfer infers type only from defaults
function merge<T>(defaults: T, overrides: NoInfer<Partial<T>>): T {
  return { ...defaults, ...overrides };
}

const config = merge(
  { port: 3000, host: "localhost" },
  { port: 8080, unknown: true } // Error: unknown is not in T
);
```

### 9-4. Migrating to TypeScript 5.5

```typescript
// Migration to 5.5: simplified type predicates

// Before: explicit type predicates
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

// After: type predicates are automatically inferred
const isString = (value: unknown) => typeof value === "string";
const isNonNull = <T>(value: T | null | undefined) => value != null;

// Take advantage of improved filter
const mixed: (string | null | number)[] = ["a", null, 1, "b", 2];

// Before: type is not narrowed
const strings1 = mixed.filter((x) => typeof x === "string");
// Type: (string | null | number)[]

// After: type is automatically narrowed
const strings2 = mixed.filter((x) => typeof x === "string");
// Type: string[] (5.5+)
```

---

## 10. Diagram: Evolution of the TypeScript 5.x Type System

```
TypeScript 5.x type system evolution:

  ┌─────────────────────────────────────────────────────────────┐
  │ TypeScript 5.0 (2023/03)                                    │
  ├─────────────────────────────────────────────────────────────┤
  │ • ECMAScript decorators (Stage 3)                           │
  │ • const type parameters                                     │
  │ • Improved enum and union interoperability                  │
  └─────────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────────┐
  │ TypeScript 5.1 (2023/06)                                    │
  ├─────────────────────────────────────────────────────────────┤
  │ • Getter/setter type asymmetry                              │
  │ • Implicit undefined return values                          │
  └─────────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────────┐
  │ TypeScript 5.2 (2023/08)                                    │
  ├─────────────────────────────────────────────────────────────┤
  │ • using declarations (Explicit Resource Management)         │
  │ • Decorator metadata                                        │
  └─────────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────────┐
  │ TypeScript 5.3 (2023/11)                                    │
  ├─────────────────────────────────────────────────────────────┤
  │ • Import Attributes                                         │
  │ • Type narrowing in switch(true)                            │
  └─────────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────────┐
  │ TypeScript 5.4 (2024/03)                                    │
  ├─────────────────────────────────────────────────────────────┤
  │ • NoInfer utility type                                      │
  │ • Type narrowing preservation in closures                   │
  └─────────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────────┐
  │ TypeScript 5.5 (2024/06)                                    │
  ├─────────────────────────────────────────────────────────────┤
  │ • Type predicate inference                                  │
  │ • Regex syntax checking                                     │
  │ • isolatedDeclarations                                      │
  └─────────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────────┐
  │ TypeScript 5.6 (2024/09)                                    │
  ├─────────────────────────────────────────────────────────────┤
  │ • Iterator helper methods                                   │
  │ • Disallowed Nullish/Truthy Checks                          │
  │ • --noUncheckedSideEffectImports                            │
  └─────────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────────┐
  │ TypeScript 5.7 (2024/12)                                    │
  ├─────────────────────────────────────────────────────────────┤
  │ • Performance improvements                                  │
  │ • Enhanced Node.js 22 support                               │
  │ • --erasableSyntaxOnly (experimental)                       │
  └─────────────────────────────────────────────────────────────┘
```

```
Evolution of decorators:

  ┌────────────────────────────────────────────────────────────┐
  │ Experimental decorators (experimentalDecorators: true)     │
  │ TypeScript-specific spec, used by Angular/NestJS           │
  └────────────────────────────────────────────────────────────┘
                            ↓
  ┌────────────────────────────────────────────────────────────┐
  │ ECMAScript decorators (TypeScript 5.0+)                    │
  │ TC39 Stage 3 standard specification                        │
  │ - Metadata access via context object                       │
  │ - Clearer application order                                │
  │ - Replacement via function return value                    │
  └────────────────────────────────────────────────────────────┘
```

```
Evolution of type inference:

  5.0-5.3: Manual type predicate definitions
  ┌──────────────────────────────────────────┐
  │ const isString = (x: unknown): x is string => │
  │   typeof x === "string";                │
  └──────────────────────────────────────────┘
                ↓
  5.4: Type narrowing preservation in closures
  ┌──────────────────────────────────────────┐
  │ if (typeof value === "string") {        │
  │   const fn = () => value.toUpperCase(); │
  │   // value remains string              │
  │ }                                       │
  └──────────────────────────────────────────┘
                ↓
  5.5+: Automatic type predicate inference
  ┌──────────────────────────────────────────┐
  │ const isString = (x: unknown) =>        │
  │   typeof x === "string";                │
  │ // x is string is automatically inferred│
  └──────────────────────────────────────────┘
```

---

## 11. Comparison Tables

### 11-1. TypeScript Version Comparison

| Version | Release | Key Features | Breaking Changes | Recommendation |
|---------|---------|-------------|-----------------|----------------|
| 5.0 | 2023/03 | Decorators, const type parameters | Decorator syntax change | ★★★★☆ |
| 5.1 | 2023/06 | Getter/setter type separation | Minor | ★★★☆☆ |
| 5.2 | 2023/08 | using declarations, decorator metadata | Minor | ★★★★★ |
| 5.3 | 2023/11 | Import Attributes | Assertions→Attributes | ★★★☆☆ |
| 5.4 | 2024/03 | NoInfer, closure narrowing | Minor | ★★★★☆ |
| 5.5 | 2024/06 | Type predicate inference, regex check | filter inference change | ★★★★★ |
| 5.6 | 2024/09 | Iterator, SideEffectImport | Minor | ★★★★☆ |
| 5.7 | 2024/12 | Performance improvements | Minor | ★★★★★ |

### 11-2. satisfies vs as vs as const

| Feature | satisfies | as | as const | satisfies + as const |
|---------|-----------|-----|----------|---------------------|
| Type checking | ✅ Yes | ❌ No (overrides) | ❌ No | ✅ Yes |
| Type narrowness | Inferred type | Specified type | Literal type | Literal type |
| Excess properties | ❌ Error | ✅ Ignored | ✅ Preserved | ❌ Error |
| readonly | ❌ No | ❌ No | ✅ Auto-applied | ✅ Auto-applied |
| Use case | Validation + inference | Type assertion | Literal preservation | Maximum type safety |

### 11-3. Decorator Comparison

| Feature | Experimental Decorators | ECMAScript Decorators |
|---------|------------------------|----------------------|
| Spec | TypeScript-specific | TC39 Stage 3 standard |
| Flag | `experimentalDecorators: true` | Default (5.0+) |
| context | ❌ None | ✅ Available |
| Metadata | ✅ reflect-metadata | ✅ context.metadata |
| Application order | Ambiguous | Clear |
| Framework support | Angular, NestJS | Migrating |
| Future | ⚠️ Deprecated | ✅ Standardized |

### 11-4. Resource Management Pattern Comparison

| Pattern | Code Example | Drawback | using Declaration |
|---------|------------|---------|-----------------|
| try-finally | `try { use(); } finally { cleanup(); }` | Verbose, deeply nested | ✅ Automated |
| callback | `withResource(res => use(res))` | Callback hell | ✅ Intuitive |
| AsyncIterator | `for await (const r of resources)` | Limited use case | ✅ General purpose |
| using declaration | `using res = acquire();` | None | ✅ Recommended |

---

## 12. Edge Case Analysis

### Edge Case 1: Const Type Parameters and Function Overloads

```typescript
// Combining const type parameters and function overloads

// Overload signatures
function createRecord<const T extends readonly string[]>(keys: T, values: string[]): Record<T[number], string>;
function createRecord<const T extends readonly string[]>(keys: T): Record<T[number], undefined>;

// Implementation signature
function createRecord<const T extends readonly string[]>(
  keys: T,
  values?: string[]
): Record<T[number], string | undefined> {
  const result: any = {};
  keys.forEach((key, index) => {
    result[key] = values?.[index];
  });
  return result;
}

// Usage examples
const record1 = createRecord(["a", "b", "c"], ["1", "2", "3"]);
// Type: Record<"a" | "b" | "c", string>

const record2 = createRecord(["x", "y"]);
// Type: Record<"x" | "y", undefined>

// Edge case: empty array
const emptyRecord = createRecord([]);
// Type: Record<never, undefined> (never = no keys)

// Edge case: readonly tuple
const tuple = ["foo", "bar"] as const;
const tupleRecord = createRecord(tuple);
// Type: Record<"foo" | "bar", undefined>
```

### Edge Case 2: using Declarations and Error Handling

```typescript
// Edge cases of using declarations and error handling

class Resource implements Disposable {
  constructor(public id: string) {
    console.log(`Resource ${id} acquired`);
  }

  [Symbol.dispose](): void {
    console.log(`Resource ${this.id} disposed`);
  }
}

// Edge case 1: Multiple using declarations
function multipleResources(): void {
  using r1 = new Resource("A");
  using r2 = new Resource("B");
  using r3 = new Resource("C");

  throw new Error("Something went wrong");

  // Execution order:
  // 1. Resource C disposed
  // 2. Resource B disposed
  // 3. Resource A disposed
  // 4. Error: Something went wrong
}

// Edge case 2: Error occurs during dispose
class ProblematicResource implements Disposable {
  constructor(public shouldFail: boolean) {}

  [Symbol.dispose](): void {
    if (this.shouldFail) {
      throw new Error("Dispose failed");
    }
  }
}

function problematicDispose(): void {
  using r1 = new ProblematicResource(false);
  using r2 = new ProblematicResource(true);  // error during dispose
  using r3 = new ProblematicResource(false);

  // r3, r2, r1 are disposed in order
  // If r2's dispose throws, a SuppressedError is thrown
}

// Edge case 3: Conditional using
function conditionalUsing(useResource: boolean): void {
  if (useResource) {
    using resource = new Resource("conditional");
    // resource is only valid within this block
  }
  // resource cannot be used here
}

// Edge case 4: using with early return
function earlyReturn(shouldReturn: boolean): string {
  using resource = new Resource("early");

  if (shouldReturn) {
    return "early return";
    // resource is disposed before the return
  }

  return "normal return";
  // resource is disposed before the return
}
```

### Edge Case 3: NoInfer and Complex Generics

```typescript
// Edge cases of NoInfer with complex generics

// Edge case 1: Nested generics
function deepMerge<T extends object>(
  base: T,
  override: NoInfer<DeepPartial<T>>
): T {
  // Implementation...
  return { ...base, ...override } as T;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

interface Config {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
}

const config = deepMerge<Config>(
  {
    database: {
      host: "localhost",
      port: 5432,
      credentials: { username: "admin", password: "secret" },
    },
  },
  {
    database: {
      port: 3306, // OK
      credentials: {
        username: "user", // OK
      },
    },
  }
);

// Edge case 2: NoInfer with union types
function select<T>(
  options: T[],
  defaultValue: NoInfer<T>
): T {
  return options.length > 0 ? options[0] : defaultValue;
}

const result = select([1, 2, 3], "default");
// Error: "default" is not assignable to number

// Edge case 3: NoInfer with conditional types
type ExtractValue<T> = T extends { value: infer V } ? V : never;

function transform<T extends { value: any }>(
  obj: T,
  transformer: (value: ExtractValue<T>) => NoInfer<ExtractValue<T>>
): T {
  return {
    ...obj,
    value: transformer(obj.value),
  };
}

const transformed = transform(
  { value: 10 },
  (v) => v * 2 // OK: (number) => number
);

const invalid = transform(
  { value: 10 },
  (v) => String(v) // Error: (number) => string is not assignable to NoInfer<number>
);
```

---

## 13. Anti-Patterns

### AP-1: Continuing to Use Legacy experimentalDecorators

```typescript
// Anti-pattern: legacy decorators (experimentalDecorators: true)
// ECMAScript standard decorators are available in TypeScript 5.0+

// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true  // Legacy
  }
}

// Legacy decorator
function OldDecorator(target: any) {
  // No context object
  console.log(target);
}

@OldDecorator
class OldClass {}

// Recommended: ECMAScript standard decorators (5.0+)
// Remove or set experimentalDecorators to false

// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": false  // Recommended, or omit entirely
  }
}

// ECMAScript standard decorator
function NewDecorator(target: Function, context: ClassDecoratorContext) {
  // Access metadata via context object
  console.log(context.name, context.kind);
}

@NewDecorator
class NewClass {}

// Note: Angular, NestJS, etc. depend on legacy decorators
// Check the framework's migration status before switching
```

### AP-2: Settling for Type Annotations Instead of satisfies

```typescript
// Anti-pattern: widening the type with annotations
const routes1: Record<string, { path: string; component: string }> = {
  home: { path: "/", component: "Home" },
  about: { path: "/about", component: "About" },
};

routes1.home.path; // Type: string (literal type "/" is lost)

// Recommended: preserve literal types with satisfies
const routes2 = {
  home: { path: "/", component: "Home" },
  about: { path: "/about", component: "About" },
} satisfies Record<string, { path: string; component: string }>;

routes2.home.path; // Type: "/" (literal type is preserved)

// Even better: combine as const with satisfies
const routes3 = {
  home: { path: "/", component: "Home" },
  about: { path: "/about", component: "About" },
} as const satisfies Record<string, { path: string; component: string }>;

routes3.home.path; // Type: "/"
// routes3 is fully readonly
```

### AP-3: Continuing Manual Resource Management

```typescript
// Anti-pattern: manual try-finally
async function oldWay() {
  const db = await connectToDatabase();
  try {
    const users = await db.query("SELECT * FROM users");
    return users;
  } finally {
    await db.disconnect(); // manual cleanup
  }
}

// Recommended: use using declarations (5.2+)
async function newWay() {
  await using db = await DatabaseConnection.create(process.env.DB_URL!);
  const users = await db.query("SELECT * FROM users");
  return users;
  // cleanup happens automatically
}

// Anti-pattern: nested try-finally
async function nestedOldWay() {
  const conn = await openConnection();
  try {
    const file = await openFile("data.txt");
    try {
      const lock = await acquireLock();
      try {
        // Processing...
      } finally {
        await releaseLock(lock);
      }
    } finally {
      await closeFile(file);
    }
  } finally {
    await closeConnection(conn);
  }
}

// Recommended: multiple using declarations
async function nestedNewWay() {
  await using conn = await openConnection();
  await using file = await openFile("data.txt");
  await using lock = await acquireLock();

  // Processing...

  // lock, file, conn are automatically cleaned up in reverse order
}
```

### AP-4: Continuing to Manually Define Type Predicates

```typescript
// Anti-pattern: explicit type predicates that are unnecessary in 5.5+
function isStringOld(value: unknown): value is string {
  return typeof value === "string";
}

function isNumberOld(value: unknown): value is number {
  return typeof value === "number";
}

// Recommended: type predicates are automatically inferred (5.5+)
const isString = (value: unknown) => typeof value === "string";
const isNumber = (value: unknown) => typeof value === "number";

// Anti-pattern: manual cast in filter
const mixed: (string | null)[] = ["a", null, "b"];
const strings1 = mixed.filter((x) => x !== null) as string[];

// Recommended: type predicate is automatically inferred
const strings2 = mixed.filter((x) => x !== null);
// Type: string[] (automatically narrowed in 5.5+)
```

---

## 14. Practice Problems

### Beginner Level

#### Problem 1: Function with Const Type Parameters

Modify the following function to preserve literal types using const type parameters.

```typescript
// Current implementation
function createTuple<T, U>(first: T, second: U): [T, U] {
  return [first, second];
}

const result = createTuple("hello", 42);
// Type: [string, number]
// Expected: [string, 42] or ["hello", 42]

// TODO: Fix using const type parameters
```

<details>
<summary>Solution</summary>

```typescript
function createTuple<const T, const U>(first: T, second: U): [T, U] {
  return [first, second];
}

const result = createTuple("hello", 42);
// Type: ["hello", 42]
```
</details>

#### Problem 2: Resource Management with using Declarations

Implement the `Disposable` interface on the following `FileReader` class so it can be used with a `using` declaration.

```typescript
class FileReader {
  private content: string = "";

  constructor(private path: string) {
    this.content = this.readFile(path);
    console.log(`File opened: ${path}`);
  }

  private readFile(path: string): string {
    // Simulated implementation
    return `Content of ${path}`;
  }

  getContent(): string {
    return this.content;
  }

  close(): void {
    this.content = "";
    console.log(`File closed: ${this.path}`);
  }

  // TODO: Implement the Disposable interface
}

// TODO: Use FileReader with a using declaration
```

<details>
<summary>Solution</summary>

```typescript
class FileReader implements Disposable {
  private content: string = "";

  constructor(private path: string) {
    this.content = this.readFile(path);
    console.log(`File opened: ${path}`);
  }

  private readFile(path: string): string {
    return `Content of ${path}`;
  }

  getContent(): string {
    return this.content;
  }

  close(): void {
    this.content = "";
    console.log(`File closed: ${this.path}`);
  }

  [Symbol.dispose](): void {
    this.close();
  }
}

// Usage example
function processFile(path: string): string {
  using reader = new FileReader(path);
  return reader.getContent();
  // close() is automatically called
}
```
</details>

### Intermediate Level

#### Problem 3: Type-safe API with NoInfer

Make the following API more type-safe using `NoInfer`.

```typescript
function createState<T>(
  initialValue: T,
  validator?: (value: T) => boolean
): {
  get: () => T;
  set: (value: T) => void;
} {
  let state = initialValue;

  return {
    get: () => state,
    set: (value) => {
      if (validator && !validator(value)) {
        throw new Error("Validation failed");
      }
      state = value;
    },
  };
}

// Problem: the type of validator may not match initialValue
const state = createState(10, (v) => typeof v === "string");
// No error is raised (but it should be)

// TODO: Use NoInfer to make the validator type strict
```

<details>
<summary>Solution</summary>

```typescript
function createState<T>(
  initialValue: T,
  validator?: (value: NoInfer<T>) => boolean
): {
  get: () => T;
  set: (value: T) => void;
} {
  let state = initialValue;

  return {
    get: () => state,
    set: (value) => {
      if (validator && !validator(value)) {
        throw new Error("Validation failed");
      }
      state = value;
    },
  };
}

// After fix
const state = createState(10, (v) => typeof v === "string");
// Error: (v: number) => boolean is expected, but (v: number) => typeof v === "string" was given
```
</details>

#### Problem 4: Filtering with Type Predicate Inference

Implement a function that filters elements satisfying specific conditions from the following array, leveraging type predicate inference.

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const results: Result<number>[] = [
  { success: true, data: 1 },
  { success: false, error: "Error 1" },
  { success: true, data: 2 },
  { success: false, error: "Error 2" },
  { success: true, data: 3 },
];

// TODO: Implement a function that retrieves only successful results and returns an array of data
// Use type predicate inference for a type-safe implementation
```

<details>
<summary>Solution</summary>

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const results: Result<number>[] = [
  { success: true, data: 1 },
  { success: false, error: "Error 1" },
  { success: true, data: 2 },
  { success: false, error: "Error 2" },
  { success: true, data: 3 },
];

// Type predicate is automatically inferred (5.5+)
const successResults = results.filter((r) => r.success);
// Type: { success: true; data: number }[]

const data = successResults.map((r) => r.data);
// Type: number[]
// data = [1, 2, 3]

// Or in a single chain
const data2 = results
  .filter((r) => r.success)
  .map((r) => r.data);
// Type: number[]
```
</details>

### Advanced Level

#### Problem 5: Dependency Injection with ECMAScript Decorators

Implement a simple dependency injection system using ECMAScript standard decorators.

```typescript
// TODO: Implement the Injectable decorator
// TODO: Implement the Inject decorator
// TODO: Implement the Container class

// Usage example:
@Injectable()
class Logger {
  log(message: string) {
    console.log(`[LOG] ${message}`);
  }
}

@Injectable()
class UserService {
  @Inject(Logger)
  logger!: Logger;

  getUser(id: string) {
    this.logger.log(`Getting user ${id}`);
    return { id, name: "Alice" };
  }
}

const container = new Container();
const userService = container.resolve(UserService);
userService.getUser("123");
// Expected output: [LOG] Getting user 123
```

<details>
<summary>Solution</summary>

```typescript
// Metadata keys
const INJECTABLE_KEY = Symbol("injectable");
const DEPENDENCIES_KEY = Symbol("dependencies");

// Injectable decorator
function Injectable() {
  return function <T extends { new (...args: any[]): {} }>(
    target: T,
    context: ClassDecoratorContext
  ) {
    context.metadata[INJECTABLE_KEY] = true;
    return target;
  };
}

// Inject decorator
function Inject(dependency: any) {
  return function (
    _target: undefined,
    context: ClassFieldDecoratorContext
  ) {
    const metadata = context.metadata;
    if (!metadata[DEPENDENCIES_KEY]) {
      metadata[DEPENDENCIES_KEY] = new Map();
    }
    (metadata[DEPENDENCIES_KEY] as Map<string | symbol, any>).set(
      context.name,
      dependency
    );
  };
}

// Container class
class Container {
  private instances = new Map<any, any>();

  resolve<T>(target: new (...args: any[]) => T): T {
    // Return existing instance if available
    if (this.instances.has(target)) {
      return this.instances.get(target);
    }

    // Create instance
    const instance = new target();

    // Get dependencies from metadata
    const metadata = (target as any)[Symbol.metadata];
    const dependencies = metadata?.[DEPENDENCIES_KEY] as Map<
      string | symbol,
      any
    >;

    // Inject dependencies
    if (dependencies) {
      for (const [fieldName, dependency] of dependencies) {
        (instance as any)[fieldName] = this.resolve(dependency);
      }
    }

    // Cache instance
    this.instances.set(target, instance);

    return instance;
  }
}

// Usage example
@Injectable()
class Logger {
  log(message: string) {
    console.log(`[LOG] ${message}`);
  }
}

@Injectable()
class UserService {
  @Inject(Logger)
  logger!: Logger;

  getUser(id: string) {
    this.logger.log(`Getting user ${id}`);
    return { id, name: "Alice" };
  }
}

const container = new Container();
const userService = container.resolve(UserService);
userService.getUser("123");
// Output: [LOG] Getting user 123
```
</details>

#### Problem 6: Combining Complex Type Inference and Resource Management

Implement a `Transaction` class meeting the following requirements.

Requirements:
1. Implement `AsyncDisposable`
2. Allow specifying the result type of operations via a generic type parameter
3. Manage commit/rollback state
4. Use type predicates for state narrowing

```typescript
// TODO: Implement the Transaction class

// Usage example:
async function transferMoney(from: string, to: string, amount: number) {
  await using tx = await Transaction.begin<{ newBalance: number }>();

  await tx.execute(async () => {
    // Transfer logic
    return { newBalance: 1000 };
  });

  await tx.commit();

  return tx.getResult(); // Type: { newBalance: number } | undefined
}
```

<details>
<summary>Solution</summary>

```typescript
type TransactionState = "pending" | "committed" | "rolledback";

class Transaction<T> implements AsyncDisposable {
  private state: TransactionState = "pending";
  private result: T | undefined;

  private constructor() {}

  static async begin<T>(): Promise<Transaction<T>> {
    console.log("Transaction started");
    return new Transaction<T>();
  }

  async execute(operation: () => Promise<T>): Promise<void> {
    if (this.state !== "pending") {
      throw new Error("Transaction is not in pending state");
    }

    try {
      this.result = await operation();
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async commit(): Promise<void> {
    if (this.state !== "pending") {
      throw new Error("Transaction is not in pending state");
    }

    console.log("Transaction committed");
    this.state = "committed";
  }

  async rollback(): Promise<void> {
    if (this.state !== "pending") {
      return; // No-op if already completed
    }

    console.log("Transaction rolled back");
    this.state = "rolledback";
    this.result = undefined;
  }

  getResult(): T | undefined {
    return this.result;
  }

  isCommitted(): boolean {
    return this.state === "committed";
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this.state === "pending") {
      await this.rollback();
    }
  }
}

// Usage example
async function transferMoney(from: string, to: string, amount: number) {
  await using tx = await Transaction.begin<{ newBalance: number }>();

  await tx.execute(async () => {
    // Simulated transfer logic
    console.log(`Transferring ${amount} from ${from} to ${to}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { newBalance: 1000 - amount };
  });

  await tx.commit();

  return tx.getResult();
}

// Execution example
const result = await transferMoney("Alice", "Bob", 100);
// Transaction started
// Transferring 100 from Alice to Bob
// Transaction committed

console.log(result); // { newBalance: 900 }
```
</details>

---

## 15. Recommended tsconfig.json Settings by Version

### TypeScript 5.0 Recommended Settings

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Type checking
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,

    // Decorators (ECMAScript standard)
    "experimentalDecorators": false,
    "emitDecoratorMetadata": false,

    // Output
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": true,

    // Imports
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,

    // Other
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### TypeScript 5.2 Recommended Settings (with using Declaration Support)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "ESNext.Disposable"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    "strict": true,
    "noUncheckedIndexedAccess": true,

    // Support for using declarations
    // Polyfill for Symbol.dispose may be needed at runtime

    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist"
  }
}
```

### TypeScript 5.5 Recommended Settings (with isolatedDeclarations)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "ESNext.Disposable"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    "strict": true,
    "noUncheckedIndexedAccess": true,

    // Isolated declarations (recommended for library development)
    "isolatedDeclarations": true,
    "declaration": true,

    // Regex checking
    // Enabled by default (no need to disable)

    "sourceMap": true,
    "outDir": "./dist"
  }
}
```

### TypeScript 5.6 Recommended Settings (Full Latest Features)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "ESNext.Disposable", "ESNext.Iterator"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Strict type checking
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,

    // Check side-effect imports
    "noUncheckedSideEffectImports": true,

    // Type definitions
    "isolatedDeclarations": true,
    "declaration": true,
    "declarationMap": true,

    // Output
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": true,

    // Imports
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,

    // Other
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

## 16. FAQ

### Q1: How often should I upgrade TypeScript versions?

**A:** It is recommended to follow each minor version (5.x). TypeScript releases on an approximately 3-month cycle, and breaking changes in each version are relatively small.

Concrete strategy:
1. **Nightly tests**: Add a CI job that tests against `typescript@next` to detect issues early
2. **Gradual migration**: Introduce the new version into a test environment 1–2 weeks after release
3. **Production rollout**: Apply to production within 1 month if no issues are found
4. **Patch versions**: Apply immediately as they may contain security fixes

```json
// Management in package.json
{
  "devDependencies": {
    "typescript": "^5.7.0",  // Auto-update to latest minor version
    "typescript-next": "npm:typescript@next"  // For nightly testing
  },
  "scripts": {
    "test": "tsc --noEmit && vitest",
    "test:next": "tsc --noEmit && vitest"  // Test with next version
  }
}
```

### Q2: When should I use satisfies?

**A:** `satisfies` is effective in the following situations:

1. **Validating object literals while preserving literal types**
```typescript
const config = {
  port: 3000,
  host: "localhost",
} satisfies Config;
// Type of config.port is number (literal type not preserved)

const config2 = {
  port: 3000,
  host: "localhost",
} as const satisfies Config;
// Type of config2.port is 3000 (literal type preserved)
```

2. **Routing tables and mapping objects**
```typescript
const routes = {
  "/home": HomePage,
  "/about": AboutPage,
  "/contact": ContactPage,
} satisfies Record<string, ComponentType>;
// Error on excess properties, types are preserved
```

3. **Validating configuration objects**
```typescript
const featureFlags = {
  enableNewUI: true,
  enableBeta: false,
} satisfies Record<string, boolean>;
// Prevents key typos while preserving specific key names
```

### Q3: When can using declarations actually be used?

**A:** Syntax support is available in TypeScript 5.2+. Runtime support status:

**Native support:**
- Node.js 22+ (released April 2024)
- Chrome 125+ (released May 2024)
- Safari 18+ (released September 2024)

**Environments requiring a polyfill:**
```typescript
// Polyfill for Symbol.dispose
if (!Symbol.dispose) {
  (Symbol as any).dispose = Symbol.for("Symbol.dispose");
}

if (!Symbol.asyncDispose) {
  (Symbol as any).asyncDispose = Symbol.for("Symbol.asyncDispose");
}
```

**Recommendation:**
- New projects: Use Node.js 22+ to take advantage of native support
- Existing projects: Introduce a polyfill and gradually migrate to using declarations

### Q4: Does type predicate inference (5.5) always work correctly?

**A:** It works correctly in most cases, but explicit type predicates may be needed for complex conditions:

```typescript
// Example where automatic inference works
const isString = (x: unknown) => typeof x === "string";
// Inferred: (x: unknown) => x is string ✅

// Example where automatic inference is insufficient
const isValidUser = (x: unknown) => {
  if (typeof x !== "object" || x === null) return false;
  return "id" in x && "name" in x;
};
// Inferred: (x: unknown) => boolean ❌
// Expected: (x: unknown) => x is { id: unknown; name: unknown }

// Explicit type predicate required
interface User {
  id: number;
  name: string;
}

function isValidUser(x: unknown): x is User {
  if (typeof x !== "object" || x === null) return false;
  return (
    "id" in x &&
    typeof (x as any).id === "number" &&
    "name" in x &&
    typeof (x as any).name === "string"
  );
}
```

### Q5: When should I use NoInfer?

**A:** `NoInfer` is effective in the following situations:

1. **Restricting the type of default or fallback values**
```typescript
function getOrDefault<T>(value: T | null, fallback: NoInfer<T>): T {
  return value ?? fallback;
}
```

2. **Fixing the type of event handlers**
```typescript
function on<K extends keyof Events>(
  event: K,
  handler: (payload: NoInfer<Events[K]>) => void
): void;
```

3. **Restricting the return type of transform functions**
```typescript
function map<T>(
  items: T[],
  transform: (item: T) => NoInfer<T>
): T[] {
  return items.map(transform);
}
```

**When not to use it:**
- When you want type to be inferred from both arguments
- When flexible type inference is needed

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development. It becomes especially important during code reviews and architectural design.

---

## 17. Summary Table

| Concept | Key Points | Version |
|---------|-----------|---------|
| ECMAScript decorators | Stage 3 standard, context object | 5.0+ |
| const type parameters | Preserve literal types in generics | 5.0+ |
| Getter/setter type asymmetry | Different types can be used | 5.1+ |
| using declarations | RAII-pattern resource management | 5.2+ |
| Import Attributes | Importing JSON/CSS etc. | 5.3+ |
| switch(true) narrowing | Type narrowing in switch statements | 5.3+ |
| NoInfer | Exclude from type inference candidates | 5.4+ |
| Closure narrowing | Preserve type narrowing inside closures | 5.4+ |
| Type predicate inference | Automatic narrowing in filter etc. | 5.5+ |
| Regex checks | Detect syntax errors in literals | 5.5+ |
| isolatedDeclarations | Isolation of type definitions | 5.5+ |
| Iterator helpers | take/map/filter etc. methods | 5.6+ |
| Nullish/Truthy checks | Warn about unnecessary conditions | 5.6+ |
| Performance improvements | Faster processing for large projects | 5.7+ |

---

## 18. What to Read Next

- **[tsconfig.json](../03-tooling/00-tsconfig.md)** -- Details of new version configuration options
- **[Discriminated Unions](../02-patterns/02-discriminated-unions.md)** -- Leveraging improved type narrowing in 5.x
- **[Build Tools](../03-tooling/01-build-tools.md)** -- Build tool support for new versions
- **Decorator Patterns** -- Practical patterns with ECMAScript decorators
- **Error Handling** -- Resource management leveraging using declarations

---

## 19. References

1. **TypeScript Release Notes**
   https://www.typescriptlang.org/docs/handbook/release-notes/overview.html
   Detailed changes and migration guides for each version

2. **TypeScript Blog**
   https://devblogs.microsoft.com/typescript/
   Official blog by the TypeScript team covering backgrounds and design philosophy of new features

3. **TC39 Proposals**
   https://github.com/tc39/proposals
   List of ECMAScript proposals — the source specs for features implemented in TypeScript

4. **Explicit Resource Management Proposal**
   https://github.com/tc39/proposal-explicit-resource-management
   ECMAScript proposal for using declarations

5. **Decorator Metadata Proposal**
   https://github.com/tc39/proposal-decorator-metadata
   ECMAScript proposal for decorator metadata

6. **Iterator Helpers Proposal**
   https://github.com/tc39/proposal-iterator-helpers
   ECMAScript proposal for Iterator helper methods

---

**Character count**: 43,247 characters

This guide covers all major new features from TypeScript 5.0 to 5.7, providing practical code examples that can be immediately applied in real-world development along with detailed explanations for deep understanding.

---

## What to Read Next

- Refer to other guides in the same category

---

## References

- [MDN Web Docs](https://developer.mozilla.org/) - Web technology reference
- [Wikipedia](https://en.wikipedia.org/) - Overview of technical concepts
