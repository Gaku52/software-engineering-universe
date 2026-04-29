# Functions and Object Types

> Comprehensive coverage of function signatures, overloads, and the proper use of interfaces vs type aliases in TypeScript.

## What You'll Learn in This Chapter

1. **Typing functions** -- parameter types, return types, optional parameters, default values, rest parameters, and overloads
2. **interface** -- defining object structures and using them as contracts between classes and modules
3. **type alias** -- flexible type definitions and how to choose between type aliases and interfaces
4. **Structural typing** -- TypeScript's unique mechanism for determining type compatibility
5. **Advanced function patterns** -- generic functions, the this type, constructor types, and callback patterns
6. **Advanced object type patterns** -- index signatures, Record, and Mapped Types


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Type Basics](./01-type-basics.md)

---

## 1. Typing Functions

### Code Example 1: Basic Function Types

```typescript
// Function declaration
function add(a: number, b: number): number {
  return a + b;
}

// Arrow function
const multiply = (a: number, b: number): number => a * b;

// Variable with a function type
const divide: (a: number, b: number) => number = (a, b) => a / b;

// Defining a function type with a type alias
type MathOp = (a: number, b: number) => number;
const subtract: MathOp = (a, b) => a - b;
```

### Function Type Notation in Detail

```typescript
// ===== Variations of function declarations =====

// 1. function declaration (hoisted)
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// 2. Function expression
const greetExpr = function (name: string): string {
  return `Hello, ${name}!`;
};

// 3. Arrow function (does not bind `this`)
const greetArrow = (name: string): string => `Hello, ${name}!`;

// 4. Generic function
function identity<T>(value: T): T {
  return value;
}

// 5. Generic arrow function (use `extends` to avoid conflicts with TSX)
const identityArrow = <T extends unknown>(value: T): T => value;

// ===== Ways to define function types =====

// Method 1: Type alias
type Formatter = (input: string) => string;

// Method 2: interface (call signature)
interface FormatterInterface {
  (input: string): string;
}

// Method 3: interface (method signature)
interface StringUtils {
  format(input: string): string;
  trim(input: string): string;
}

// Method 4: Method inside an object literal
type Logger = {
  log(message: string): void;
  error(message: string, error?: Error): void;
  warn(message: string): void;
};

// ===== Composite types: function with properties =====
// A type that is callable but also has properties
interface CreateElement {
  (tag: string): HTMLElement;
  defaultNamespace: string;
  supportedTags: string[];
}

// Implementation example
const createElement: CreateElement = Object.assign(
  (tag: string) => document.createElement(tag),
  {
    defaultNamespace: "http://www.w3.org/1999/xhtml",
    supportedTags: ["div", "span", "p", "a"],
  }
);

createElement("div"); // HTMLElement
createElement.defaultNamespace; // string
```

### Code Example 2: Optional Parameters and Default Values

```typescript
// Optional parameter (?)
function greet(name: string, greeting?: string): string {
  return `${greeting ?? "Hello"}, ${name}!`;
}
greet("Alice");           // "Hello, Alice!"
greet("Alice", "Hi");     // "Hi, Alice!"

// Default value
function createUser(name: string, role: string = "viewer"): { name: string; role: string } {
  return { name, role };
}
createUser("Bob");              // { name: "Bob", role: "viewer" }
createUser("Bob", "admin");     // { name: "Bob", role: "admin" }

// Rest parameters
function sum(...numbers: number[]): number {
  return numbers.reduce((total, n) => total + n, 0);
}
sum(1, 2, 3, 4, 5); // 15
```

### Detailed Patterns for Optional Parameters

```typescript
// Difference between optional parameters and default values
function example1(x: number, y?: number): number {
  // Type of y is number | undefined
  return x + (y ?? 0);
}

function example2(x: number, y: number = 0): number {
  // Type of y is number (because of the default value)
  return x + y;
}

// Differences in how they are called
example1(1);           // OK: y is undefined
example1(1, undefined); // OK: y is undefined
example1(1, 2);        // OK: y is 2

example2(1);           // OK: y is 0
example2(1, undefined); // OK: y is 0 (default value is used even when undefined is passed)
example2(1, 2);        // OK: y is 2

// Optional parameters must be placed at the end
// function bad(x?: number, y: number) {} // Error
function good(y: number, x?: number) {} // OK

// Default values can be used on parameters that aren't last
function createRange(start: number = 0, end: number, step: number = 1): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
}
createRange(undefined, 5);     // [0, 1, 2, 3, 4] (start = 0)
createRange(2, 10, 3);         // [2, 5, 8]

// Detailed typing of rest parameters
function createLogger(prefix: string, ...tags: string[]): void {
  console.log(`[${prefix}]`, ...tags.map(t => `#${t}`));
}
createLogger("APP", "info", "startup"); // [APP] #info #startup

// Tuple-typed rest parameters
function query(sql: string, ...params: [string, ...number[]]): void {
  console.log(sql, params);
}
query("SELECT * FROM users WHERE name = ? AND age > ?", "Alice", 30);

// Type safety of spread arguments
function add3(a: number, b: number, c: number): number {
  return a + b + c;
}
const args = [1, 2, 3] as const; // readonly [1, 2, 3]
add3(...args); // OK (`as const` is required; otherwise inferred as number[], which doesn't match 3 args)
```

### Code Example 3: Function Overloads

```typescript
// Overload signatures
function createElement(tag: "div"): HTMLDivElement;
function createElement(tag: "span"): HTMLSpanElement;
function createElement(tag: "input"): HTMLInputElement;
// Implementation signature
function createElement(tag: string): HTMLElement {
  return document.createElement(tag);
}

const div = createElement("div");     // Type: HTMLDivElement
const span = createElement("span");   // Type: HTMLSpanElement
const input = createElement("input"); // Type: HTMLInputElement
```

### Detailed Overload Patterns

```typescript
// Pattern 1: Overload by number of arguments
function padding(all: number): string;
function padding(vertical: number, horizontal: number): string;
function padding(top: number, right: number, bottom: number, left: number): string;
function padding(a: number, b?: number, c?: number, d?: number): string {
  if (b === undefined) {
    return `${a}px`;
  }
  if (c === undefined) {
    return `${a}px ${b}px`;
  }
  return `${a}px ${b}px ${c}px ${d}px`;
}

padding(10);           // "10px"
padding(10, 20);       // "10px 20px"
padding(10, 20, 30, 40); // "10px 20px 30px 40px"

// Pattern 2: Overload by argument type
function parseInput(input: string): string[];
function parseInput(input: number): number[];
function parseInput(input: string | number): (string | number)[] {
  if (typeof input === "string") {
    return input.split(",");
  }
  return [input];
}

const strResult = parseInput("a,b,c"); // string[]
const numResult = parseInput(42);       // number[]

// Pattern 3: Overload by return type
function fetchData(url: string, format: "json"): Promise<object>;
function fetchData(url: string, format: "text"): Promise<string>;
function fetchData(url: string, format: "blob"): Promise<Blob>;
function fetchData(url: string, format: string): Promise<unknown> {
  return fetch(url).then(response => {
    switch (format) {
      case "json": return response.json();
      case "text": return response.text();
      case "blob": return response.blob();
      default: return response.text();
    }
  });
}

// Pattern 4: Using generics as an alternative to overloads
// Using conditional types instead of overloads
type ParseResult<T> = T extends string ? string[] : T extends number ? number[] : never;

function parseInputGeneric<T extends string | number>(input: T): ParseResult<T> {
  if (typeof input === "string") {
    return input.split(",") as ParseResult<T>;
  }
  return [input] as ParseResult<T>;
}

// Pattern 5: Method overloads
class EventEmitter {
  on(event: "click", handler: (x: number, y: number) => void): void;
  on(event: "keypress", handler: (key: string) => void): void;
  on(event: "scroll", handler: (position: number) => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void {
    // Implementation
  }
}

const emitter = new EventEmitter();
emitter.on("click", (x, y) => {
  // Inferred as x: number, y: number
  console.log(x, y);
});
emitter.on("keypress", (key) => {
  // Inferred as key: string
  console.log(key);
});
```

### Controlling the `this` Type

```typescript
// `this` parameter (not an actual argument; it specifies the type of `this`)
interface User {
  name: string;
  greet(this: User): string;
}

const user: User = {
  name: "Alice",
  greet() {
    return `Hello, I'm ${this.name}`;
  },
};

user.greet(); // OK
// const greetFn = user.greet;
// greetFn(); // Error: type of `this` is not User

// `this` type in a class
class Builder {
  private items: string[] = [];

  add(item: string): this {
    this.items.push(item);
    return this; // Returning `this` enables method chaining
  }

  build(): string[] {
    return [...this.items];
  }
}

class EnhancedBuilder extends Builder {
  private prefix: string = "";

  setPrefix(prefix: string): this {
    this.prefix = prefix;
    return this;
  }
}

// Method chaining works in a type-safe manner
const result = new EnhancedBuilder()
  .setPrefix("item-")  // Returns EnhancedBuilder
  .add("one")           // Returns EnhancedBuilder (not Builder)
  .add("two")
  .build();

// `this` type guards
class FileReader {
  private content: string | null = null;
  private loaded: boolean = false;

  isLoaded(): this is FileReader & { content: string } {
    return this.loaded && this.content !== null;
  }

  load(path: string): void {
    this.content = "file content";
    this.loaded = true;
  }

  getContent(): string {
    if (this.isLoaded()) {
      return this.content; // Safely accessed as string
    }
    throw new Error("File not loaded");
  }
}
```

### Comparison of Function Type Notations

```
  Function declaration   Arrow function type    call signature
+---------------+  +------------------+  +---------------------+
| function      |  | (a: T, b: U)     |  | interface Fn {      |
|   fn(a: T):U  |  |   => R           |  |   (a: T, b: U): R  |
+---------------+  +------------------+  +---------------------+

  Method signature        Constructor signature
+---------------------+  +-----------------------+
| interface Obj {     |  | interface Ctor {      |
|   method(a: T): R   |  |   new (a: T): Obj     |
| }                   |  | }                     |
+---------------------+  +-----------------------+
```

### Callback Function Type Patterns

```typescript
// ===== Defining callback function types =====

// Simple callbacks
type SimpleCallback = () => void;
type ErrorCallback = (error: Error | null) => void;
type DataCallback<T> = (error: Error | null, data: T) => void;

// Node.js-style callback
type NodeCallback<T> = (error: NodeJS.ErrnoException | null, result: T) => void;

function readFile(
  path: string,
  callback: DataCallback<string>
): void {
  try {
    const content = "file content";
    callback(null, content);
  } catch (err) {
    callback(err instanceof Error ? err : new Error(String(err)), "" as never);
  }
}

// Promise-returning function type
type AsyncFunction<T, R> = (input: T) => Promise<R>;

// Middleware pattern
type Middleware<T> = (
  context: T,
  next: () => Promise<void>
) => Promise<void>;

// Express-style middleware
interface Request {
  path: string;
  method: string;
  body: unknown;
}
interface Response {
  status(code: number): Response;
  json(data: unknown): void;
}
type NextFunction = () => void;

type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// Event listener types
type EventListener<T = Event> = (event: T) => void;

// Higher-order function types
type Predicate<T> = (value: T) => boolean;
type Mapper<T, U> = (value: T, index: number) => U;
type Reducer<T, U> = (accumulator: U, value: T, index: number) => U;
type Comparator<T> = (a: T, b: T) => number;

// Higher-order function implementation
function pipe<T>(...fns: ((value: T) => T)[]): (value: T) => T {
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value);
}

const processString = pipe<string>(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/\s+/g, "-"),
);

processString("  Hello World  "); // "hello-world"
```

### Async Function Types

```typescript
// Typing async/await
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

// Promise utility types
type PromiseType<T> = T extends Promise<infer U> ? U : T;
type Unwrapped = PromiseType<Promise<string>>; // string

// Awaited type (TypeScript 4.5+)
type AwaitedResult = Awaited<Promise<Promise<string>>>; // string (resolves nested Promises too)

// Async generator
async function* generateNumbers(count: number): AsyncGenerator<number> {
  for (let i = 0; i < count; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    yield i;
  }
}

// Consuming an async iterator
async function processNumbers(): Promise<void> {
  for await (const num of generateNumbers(5)) {
    console.log(num); // 0, 1, 2, 3, 4
  }
}

// Type-safe retry function
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && shouldRetry(error)) {
        await new Promise(resolve =>
          setTimeout(resolve, delay * Math.pow(backoff, attempt))
        );
      }
    }
  }

  throw lastError;
}

// Usage example
const user = await withRetry(
  () => fetchUser(1),
  {
    maxRetries: 3,
    delay: 500,
    shouldRetry: (err) => {
      if (err instanceof Error && err.message.includes("HTTP 404")) {
        return false; // Do not retry on 404
      }
      return true;
    },
  }
);
```

---

## 2. interface

### Code Example 4: Defining and Using Interfaces

```typescript
// Basic interface
interface User {
  readonly id: number;     // Read-only
  name: string;            // Required property
  email: string;           // Required property
  age?: number;            // Optional property
}

// Index signature
interface Dictionary {
  [key: string]: string;
}

// Interface with functions
interface Formatter {
  format(value: unknown): string;
  readonly prefix: string;
}

// Interface inheritance
interface Employee extends User {
  department: string;
  salary: number;
}

// Multiple inheritance
interface Manager extends Employee {
  reports: Employee[];
}

const manager: Manager = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  department: "Engineering",
  salary: 120000,
  reports: [],
};
```

### Advanced Interface Patterns

```typescript
// ===== Inheriting multiple interfaces =====
interface Serializable {
  serialize(): string;
}

interface Printable {
  print(): void;
}

interface Loggable {
  log(level: "info" | "warn" | "error"): void;
}

// Inherit multiple interfaces simultaneously
interface Document extends Serializable, Printable, Loggable {
  title: string;
  content: string;
}

// ===== Generic interfaces =====
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

// Use Repository with a concrete type
class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> {
    // Fetch from database
    return null;
  }

  async findAll(filter?: Partial<User>): Promise<User[]> {
    return [];
  }

  async create(data: Omit<User, "id">): Promise<User> {
    return { id: crypto.randomUUID(), ...data };
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return { id, name: "", email: "", ...data };
  }

  async delete(id: string): Promise<boolean> {
    return true;
  }
}

// ===== Constructor signatures =====
interface Constructable<T> {
  new (...args: unknown[]): T;
}

function createInstance<T>(Ctor: Constructable<T>): T {
  return new Ctor();
}

class MyService {
  constructor() {
    console.log("Service created");
  }
}

const service = createInstance(MyService); // MyService

// ===== Hybrid interface (function + properties) =====
interface JQuery {
  (selector: string): JQuery;
  ajax(settings: object): Promise<unknown>;
  version: string;
}

// ===== Mapped Types-style interface (limited) =====
interface StringMap {
  [key: string]: string;
}

interface NumberMap {
  [key: string]: number;
}

// ===== readonly index signature =====
interface ReadonlyStringMap {
  readonly [key: string]: string;
}
```

### Code Example 5: Interface Merging (Declaration Merging)

```typescript
// Interfaces with the same name are automatically merged
interface Window {
  myCustomProperty: string;
}

// This adds myCustomProperty to the global Window
// Useful for extending types from libraries

interface Config {
  host: string;
  port: number;
}

interface Config {
  debug: boolean;      // Merged
}

// Resulting type: { host: string; port: number; debug: boolean }
const config: Config = {
  host: "localhost",
  port: 3000,
  debug: true,
};
```

### Practical Patterns for Declaration Merging

```typescript
// Pattern 1: Extending types from third-party libraries
// Add custom properties to Express's Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        role: string;
      };
      requestId: string;
    }
  }
}

// Pattern 2: Typing environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "staging" | "production";
      PORT: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
    }
  }
}

// Now process.env.PORT is recognized as a string
const port = parseInt(process.env.PORT, 10);

// Pattern 3: Extending the Window object
declare global {
  interface Window {
    __APP_CONFIG__: {
      apiBaseUrl: string;
      featureFlags: Record<string, boolean>;
    };
    analytics: {
      track(event: string, properties?: Record<string, unknown>): void;
    };
  }
}

// Pattern 4: Module augmentation
// Add types to existing libraries like date-fns
declare module "express-session" {
  interface SessionData {
    userId: string;
    loginAt: Date;
  }
}

// Pattern 5: Merging with a namespace
interface Color {
  r: number;
  g: number;
  b: number;
}

namespace Color {
  export function fromHex(hex: string): Color {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) throw new Error("Invalid hex color");
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  export const Red: Color = { r: 255, g: 0, b: 0 };
  export const Green: Color = { r: 0, g: 255, b: 0 };
  export const Blue: Color = { r: 0, g: 0, b: 255 };
}

// Usable as both an interface and a namespace
const color: Color = Color.fromHex("#ff0000");
const red: Color = Color.Red;
```

---

## 3. type alias

### Code Example 6: The Flexibility of type alias

```typescript
// Object type
type Point = {
  x: number;
  y: number;
};

// Union type
type Result<T> = { success: true; data: T } | { success: false; error: Error };

// Function type
type EventHandler = (event: Event) => void;

// Tuple type
type Coordinate = [number, number];

// Mapped type
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// Conditional type
type NonNullable<T> = T extends null | undefined ? never : T;

// Template literal types
type HttpMethod = `${"GET" | "POST" | "PUT" | "DELETE"}`;
type Endpoint = `/${string}`;
type ApiRoute = `${HttpMethod} ${Endpoint}`;
```

### Advanced Patterns with type alias

```typescript
// ===== Leveraging conditional types =====
type IsString<T> = T extends string ? true : false;
type A = IsString<"hello">; // true
type B = IsString<42>;      // false

// Extracting types via conditional types
type ExtractArrayType<T> = T extends (infer U)[] ? U : never;
type Elem = ExtractArrayType<string[]>; // string

// Extract the inner type of a Promise
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type Result = UnwrapPromise<Promise<string>>; // string

// Extract function parameter and return types
type ParamTypes<T> = T extends (...args: infer P) => unknown ? P : never;
type ReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;

type Params = ParamTypes<(a: string, b: number) => void>; // [a: string, b: number]
type Ret = ReturnType<(a: string) => boolean>; // boolean

// ===== Mapped Types =====
type Optional<T> = { [K in keyof T]?: T[K] };
type Required<T> = { [K in keyof T]-?: T[K] };
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// Key Remapping (TypeScript 4.1+)
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }

type PersonSetters = Setters<Person>;
// { setName: (value: string) => void; setAge: (value: number) => void }

// ===== Combining utility types =====
// Auto-generate CRUD types for API responses
type CreateInput<T> = Omit<T, "id" | "createdAt" | "updatedAt">;
type UpdateInput<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;
type ListResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

interface Article {
  id: string;
  title: string;
  body: string;
  author: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

type CreateArticleInput = CreateInput<Article>;
// { title: string; body: string; author: string; tags: string[] }

type UpdateArticleInput = UpdateInput<Article>;
// { title?: string; body?: string; author?: string; tags?: string[] }

type ArticleListResponse = ListResponse<Article>;

// ===== Recursive types =====
type JSON =
  | string
  | number
  | boolean
  | null
  | JSON[]
  | { [key: string]: JSON };

// Deep readonly
type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

// Deep Partial
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// Type-safe path access
type Path<T, K extends keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? `${K}.${Path<T[K], keyof T[K]>}` | K
    : K
  : never;
```

### Comparison: interface vs type alias

| Feature | interface | type alias |
|------|-----------|------------|
| Object types | OK | OK |
| Union types | Not supported | OK |
| Intersection | Inherit via `extends` | Combine via `&` |
| Declaration Merging | OK (auto-merged when names match) | Not supported (duplicate error) |
| implements | OK | OK (some restrictions) |
| Conditional / Mapped types | Not supported | OK |
| Performance | Slightly faster (cached) | Complex types may be slower |
| Recommended use cases | Object structures, public APIs | Unions, complex type transformations |

### Decision Flow for Choosing Between Them

```
  You want to define a type
      |
      v
  Need a Union type?  ----Yes----> type alias
      |
      No
      |
      v
  Need a conditional/mapped type?  ----Yes----> type alias
      |
      No
      |
      v
  Need Declaration Merging?  ----Yes----> interface
      |
      No
      |
      v
  Defining the structure of an object?  ----Yes----> interface (recommended)
      |                                              or type (preference)
      No
      |
      v
  Use type alias
```

### Practical Style Guide

```typescript
// ===== Google TypeScript Style Guide's stance =====
// When something can be expressed by either interface or type, use interface

// Cases where interface is appropriate
interface UserService {
  getUser(id: string): Promise<User>;
  createUser(data: CreateUserInput): Promise<User>;
  updateUser(id: string, data: UpdateUserInput): Promise<User>;
  deleteUser(id: string): Promise<void>;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

// Cases where type is required
type UserId = string;
type UserRole = "admin" | "editor" | "viewer";
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
type Handler = (req: Request, res: Response) => Promise<void>;

// ===== Alternate style: always use type =====
// Some teams use type for everything for simplicity
type User = {
  id: string;
  name: string;
  email: string;
};

type UserService = {
  getUser(id: string): Promise<User>;
  createUser(data: CreateUserInput): Promise<User>;
};

// Either style works; consistency within the team is what matters
```

---

## 4. Structural Typing

### Code Example 7: Duck Typing

```typescript
interface Point {
  x: number;
  y: number;
}

// No need to explicitly implement the Point interface
const point = { x: 10, y: 20, z: 30 };

function printPoint(p: Point): void {
  console.log(`(${p.x}, ${p.y})`);
}

// `point` has x and y, so it's accepted as a Point
printPoint(point); // OK: as long as the structure matches

// Excess property check (only for direct object literals)
// printPoint({ x: 10, y: 20, z: 30 }); // Error: z does not exist on Point
```

### Structural Typing in Detail

```typescript
// ===== The basic principle of structural typing =====
// "If it has all the required properties, it can be treated as that type"

interface HasName {
  name: string;
}

interface HasAge {
  age: number;
}

interface Person extends HasName, HasAge {}

// Even completely unrelated objects work as long as the structure matches
const dog = {
  name: "Buddy",
  age: 5,
  breed: "Labrador", // Extra property
};

function greetPerson(person: Person): string {
  return `Hello, ${person.name}! You are ${person.age} years old.`;
}

greetPerson(dog); // OK: dog has both name and age

// ===== Excess Property Check =====
// Triggered only when assigning an object literal directly

// Error: passing an object literal directly
// greetPerson({ name: "Alice", age: 30, extra: true }); // Error

// OK: assign to a variable first, then pass it
const alice = { name: "Alice", age: 30, extra: true };
greetPerson(alice); // OK

// OK: passing via spread syntax
greetPerson({ ...alice }); // OK (it's an object literal but uses spread, so...)
// Actually this also produces an error. Strictly speaking, spread is also subject to Excess Property Check

// Ways to work around the Excess Property Check
// Method 1: Add an index signature
interface FlexiblePerson {
  name: string;
  age: number;
  [key: string]: unknown; // Allows arbitrary properties
}

// Method 2: Pass via a variable (described above)
// Method 3: Type assertion
greetPerson({ name: "Alice", age: 30, extra: true } as Person);

// ===== Structural compatibility of functions =====
type Handler = (event: MouseEvent) => void;

// A function with fewer parameters is compatible
const simpleHandler: Handler = () => {}; // OK: ignoring parameters
const eventHandler: Handler = (event) => {
  console.log(event.clientX);
}; // OK

// A function with more parameters is not compatible
// const badHandler: Handler = (event: MouseEvent, extra: string) => {}; // Error

// ===== Structural compatibility of classes =====
class Cat {
  name: string;
  constructor(name: string) { this.name = name; }
  meow(): void { console.log("Meow!"); }
}

class FakeCat {
  name: string;
  constructor(name: string) { this.name = name; }
  meow(): void { console.log("Fake meow!"); }
}

// FakeCat is compatible with Cat because the structure matches
const cat: Cat = new FakeCat("Kitty"); // OK

// Different rules apply when there are private/protected members
class RealCat {
  private id: number = 0;
  name: string;
  constructor(name: string) { this.name = name; }
}

class AnotherCat {
  private id: number = 0;
  name: string;
  constructor(name: string) { this.name = name; }
}

// Not compatible because the private members come from different declarations
// const realCat: RealCat = new AnotherCat("Kitty"); // Error
```

### Diagram of Structural Typing

```
  Nominal typing (Java, C#, etc.)        Structural typing (TypeScript)
+----------------------------+    +----------------------------+
| class Dog implements       |    | interface HasName {        |
|   Animal { ... }           |    |   name: string;            |
|                            |    | }                          |
| -> Dog is type-checked     |    |                            |
|   under the name Animal    |    | // Any object that has     |
+----------------------------+    | // { name: string } can    |
                                  | // be used as HasName      |
                                  +----------------------------+
```

---

## 5. Advanced Object Type Patterns

### Index Signatures in Detail

```typescript
// Basic index signature
interface StringMap {
  [key: string]: string;
}

// Coexistence of explicit properties and an index signature
interface Config {
  name: string;                  // Explicit property
  version: number;               // Explicit property
  [key: string]: string | number; // Index signature (must include the types of the properties above)
}

// `number` index signature
interface StringArray {
  [index: number]: string;
  length: number;
}

// Coexistence of string and number index signatures
interface MixedIndex {
  [key: string]: string | number;
  [index: number]: string; // The number index must be a subtype of the string index
}

// Record type (recommended over index signatures)
type UserRoles = Record<string, "admin" | "editor" | "viewer">;

const roles: UserRoles = {
  alice: "admin",
  bob: "editor",
  charlie: "viewer",
};

// Applications of Record
type HttpHeaders = Record<string, string | string[]>;
type QueryParams = Record<string, string | number | boolean>;
type Translations = Record<string, Record<string, string>>;

const translations: Translations = {
  en: { greeting: "Hello", farewell: "Goodbye" },
  ja: { greeting: "こんにちは", farewell: "さようなら" },
};
```

### `readonly` in Detail

```typescript
// ===== readonly properties =====
interface ImmutableUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
}

const user: ImmutableUser = {
  id: "1",
  name: "Alice",
  email: "alice@example.com",
  createdAt: new Date(),
};

// user.name = "Bob"; // Error: readonly properties cannot be modified

// ===== Readonly<T> utility type =====
interface MutableConfig {
  host: string;
  port: number;
  debug: boolean;
}

type FrozenConfig = Readonly<MutableConfig>;
// { readonly host: string; readonly port: number; readonly debug: boolean }

// ===== Limitations of readonly =====
// readonly is shallow: nested objects are still mutable
interface Settings {
  readonly theme: {
    primary: string;
    secondary: string;
  };
}

const settings: Settings = {
  theme: { primary: "#007bff", secondary: "#6c757d" },
};

// settings.theme = { primary: "#000", secondary: "#fff" }; // Error
settings.theme.primary = "#000"; // OK! (nested contents are still mutable)

// DeepReadonly to achieve deep immutability
type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

type DeepFrozenSettings = DeepReadonly<Settings>;
// All levels become readonly

// ===== Combining with const assertion =====
const CONFIG = {
  api: {
    baseUrl: "https://api.example.com",
    timeout: 5000,
    retries: 3,
  },
  features: {
    darkMode: true,
    notifications: false,
  },
} as const;
// All properties become readonly literal types
```

### Comprehensive Guide to Utility Types

```typescript
// TypeScript's built-in utility types

// ===== Object manipulation =====

// Partial<T>: makes every property optional
type PartialUser = Partial<User>;
// { id?: string; name?: string; email?: string }

// Required<T>: makes every property required
interface OptionalUser {
  id: string;
  name?: string;
  email?: string;
}
type RequiredUser = Required<OptionalUser>;
// { id: string; name: string; email: string }

// Pick<T, K>: keep only the specified properties
type UserName = Pick<User, "name" | "email">;
// { name: string; email: string }

// Omit<T, K>: exclude the specified properties
type UserWithoutId = Omit<User, "id">;
// { name: string; email: string }

// Record<K, V>: object with the specified key and value types
type StatusMessages = Record<"success" | "error" | "warning", string>;
// { success: string; error: string; warning: string }

// Readonly<T>: makes every property readonly
type ImmutableUser = Readonly<User>;

// ===== Union manipulation =====

// Exclude<T, U>: remove U from T
type NonString = Exclude<string | number | boolean, string>;
// number | boolean

// Extract<T, U>: extract the types in T assignable to U
type StringOrNumber = Extract<string | number | boolean, string | number>;
// string | number

// NonNullable<T>: remove null and undefined
type Defined = NonNullable<string | null | undefined>;
// string

// ===== Function manipulation =====

// Parameters<T>: get the parameter types as a tuple
type AddParams = Parameters<typeof add>;
// [a: number, b: number]

// ReturnType<T>: get the return type
type AddReturn = ReturnType<typeof add>;
// number

// ConstructorParameters<T>: parameters of the constructor
class MyClass {
  constructor(name: string, age: number) {}
}
type CtorParams = ConstructorParameters<typeof MyClass>;
// [name: string, age: number]

// InstanceType<T>: instance type of the constructor
type Instance = InstanceType<typeof MyClass>;
// MyClass

// ===== String manipulation =====
type Upper = Uppercase<"hello">;        // "HELLO"
type Lower = Lowercase<"HELLO">;        // "hello"
type Cap = Capitalize<"hello">;         // "Hello"
type Uncap = Uncapitalize<"Hello">;     // "hello"

// ===== Promise manipulation =====
type AwaitedType = Awaited<Promise<Promise<string>>>;
// string

// ===== Other =====
// ThisParameterType<T>: get the type of the `this` parameter
// OmitThisParameter<T>: function type without the `this` parameter
// ThisType<T>: marker type to specify the type of `this`

// NoInfer<T> (TypeScript 5.4+): suppress type inference
function createPair<T>(a: T, b: NoInfer<T>): [T, T] {
  return [a, b];
}
createPair("hello", "world"); // OK
// createPair("hello", 42);   // Error: T is inferred as string, and 42 is not assignable to string
```

---

## Anti-Patterns

### Anti-Pattern 1: Excessively Nested Type Definitions

```typescript
// BAD: deeply nested inline type definitions are hard to read
function processOrder(
  order: {
    items: {
      product: { id: number; name: string; price: number };
      quantity: number;
      options?: { gift: boolean; message?: string };
    }[];
    customer: { name: string; address: { street: string; city: string } };
  }
): void { /* ... */ }

// GOOD: split the types and give them names
interface Address {
  street: string;
  city: string;
}
interface Customer {
  name: string;
  address: Address;
}
interface Product {
  id: number;
  name: string;
  price: number;
}
interface OrderItem {
  product: Product;
  quantity: number;
  options?: { gift: boolean; message?: string };
}
interface Order {
  items: OrderItem[];
  customer: Customer;
}
function processOrder(order: Order): void { /* ... */ }
```

### Anti-Pattern 2: Unstructured Mixing of interface and type

```typescript
// BAD: using interface and type inconsistently in the same project
interface User { name: string; }
type Product = { name: string; };    // Why is only this one a type?
interface Order { items: string[]; }
type Invoice = { total: number; };   // Inconsistent

// GOOD: agree on a policy as a team and stick to it
// Example: use interface for object structures, and type for unions or complex types
interface User { name: string; }
interface Product { name: string; }
interface Order { items: string[]; }
type PaymentMethod = "credit" | "debit" | "cash"; // Union -> type
type Result<T> = Success<T> | Failure;             // Union -> type
```

### Anti-Pattern 3: Building Massive Interfaces

```typescript
// BAD: cramming everything into a single interface
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  avatar: string;
  bio: string;
  settings: {
    theme: string;
    language: string;
    notifications: boolean;
  };
  billing: {
    plan: string;
    card: string;
    expiry: string;
  };
  social: {
    twitter: string;
    github: string;
    linkedin: string;
  };
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  // ... and on it goes
}

// GOOD: split interfaces by responsibility
interface UserIdentity {
  id: string;
  name: string;
  email: string;
}

interface UserCredentials {
  password: string;
}

interface UserProfile {
  avatar: string;
  bio: string;
}

interface UserSettings {
  theme: "light" | "dark" | "system";
  language: string;
  notifications: boolean;
}

interface UserBilling {
  plan: "free" | "pro" | "enterprise";
  card: string;
  expiry: string;
}

interface UserSocial {
  twitter?: string;
  github?: string;
  linkedin?: string;
}

interface UserStats {
  posts: number;
  followers: number;
  following: number;
}

// Compose them as needed
interface User extends UserIdentity, UserProfile, UserSettings {
  billing: UserBilling;
  social: UserSocial;
  stats: UserStats;
}

// Use only the types needed for each use case
type PublicUser = UserIdentity & UserProfile & { stats: UserStats };
type AdminUser = User & UserCredentials;
```

### Anti-Pattern 4: Too Many Function Parameters

```typescript
// BAD: too many parameters make argument order easy to mistake
function createUser(
  name: string,
  email: string,
  age: number,
  role: string,
  department: string,
  isActive: boolean,
  createdBy: string
): User {
  // ...
}
// At the call site, it's unclear which argument is which
createUser("Alice", "alice@example.com", 30, "admin", "Engineering", true, "system");

// GOOD: use an options object
interface CreateUserOptions {
  name: string;
  email: string;
  age: number;
  role: "admin" | "editor" | "viewer";
  department: string;
  isActive?: boolean;  // Defaults to true
  createdBy?: string;  // Defaults to "system"
}

function createUser(options: CreateUserOptions): User {
  const { isActive = true, createdBy = "system", ...rest } = options;
  // ...
}

// Each field is clear at the call site
createUser({
  name: "Alice",
  email: "alice@example.com",
  age: 30,
  role: "admin",
  department: "Engineering",
});
```

### Anti-Pattern 5: Copy-Pasting Types

```typescript
// BAD: duplicating the same type across multiple files
// file: user-service.ts
interface User {
  id: string;
  name: string;
  email: string;
}

// file: user-controller.ts (copy-pasted definition)
interface User {
  id: string;
  name: string;
  email: string;
}

// GOOD: import from a shared types file
// file: types/user.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

// file: user-service.ts
import type { User } from "../types/user";

// file: user-controller.ts
import type { User } from "../types/user";

// Using `import type` makes it explicit that nothing is included at runtime
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Properly handle errors
- Include test code

```python
# Exercise 1: Template for basic implementation
class Exercise1:
    """Practice for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data-processing logic"""
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
        assert False, "An exception should have been raised"
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
    """Practice for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with a size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Look up by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Remove by key"""
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

    print(f"Inefficient version: {slow_time:.4f} seconds")
    print(f"Efficient version:   {fast_time:.6f} seconds")
    print(f"Speedup:             {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure the impact with benchmarks
---

## FAQ

### Q1: When should I use function overloads vs Union-typed parameters?

**A:** Use overloads when the return type changes based on the input type. If the return type stays the same, a Union-typed parameter is simpler.

```typescript
// Cases where a Union type is enough
function len(x: string | any[]): number { return x.length; }

// Cases that require overloads (return type varies)
function parse(input: string): string[];
function parse(input: string[]): string[][];
function parse(input: string | string[]) { /* ... */ }

// Cases solvable with generics (preferred over overloads)
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}
// string[] -> string | undefined
// number[] -> number | undefined
```

### Q2: What's the difference between `readonly` and `Readonly<T>`?

**A:** `readonly` is a per-property modifier, while `Readonly<T>` is a utility type that makes all of an object's properties readonly at once. Even with `Readonly<T>`, deeply nested parts of the object don't become readonly. When you need deep immutability, define a custom `DeepReadonly` type.

### Q3: What does the `{}` type represent?

**A:** `{}` represents "any value other than null and undefined". It is not the type of an empty object. To represent an empty object accurately, use `Record<string, never>`. Because `{}` unintentionally becomes very broad, you should avoid it.

```typescript
// {} accepts everything except null/undefined
const a: {} = "hello";     // OK
const b: {} = 42;          // OK
const c: {} = true;        // OK
const d: {} = { foo: 1 };  // OK
// const e: {} = null;     // Error
// const f: {} = undefined; // Error

// The correct way to represent an empty object
type EmptyObject = Record<string, never>;
const empty: EmptyObject = {};
// const notEmpty: EmptyObject = { key: "value" }; // Error

// The `object` type represents any non-primitive value
const g: object = { foo: 1 }; // OK
const h: object = [1, 2, 3];  // OK
// const i: object = "hello";  // Error (primitive)
// const j: object = 42;       // Error (primitive)
```

### Q4: What's the difference between interface inheritance (`extends`) and Intersection (`&`)?

**A:** They are functionally similar, but there are important differences.

```typescript
// extends: a property conflict is a compile error
interface A { x: number; }
// interface B extends A { x: string; } // Error: x types are incompatible

// Intersection (&): a property conflict becomes never
type A = { x: number; };
type B = { x: string; };
type C = A & B;
// The type of C.x is number & string = never (unusable)

// `extends` is preferred because it surfaces errors earlier
```

### Q5: What is a constructor type?

**A:** It's a type representing a function that can be called with `new`. It's useful for passing classes to factory functions and similar scenarios.

```typescript
interface Constructor<T> {
  new (...args: any[]): T;
}

function createInstance<T>(ctor: Constructor<T>): T {
  return new ctor();
}

class MyService {
  name = "service";
}

const instance = createInstance(MyService); // MyService
console.log(instance.name); // "service"

// Abstract classes cannot be assigned to Constructor
// Use this when you need to include abstract classes
type AbstractConstructor<T> = abstract new (...args: any[]) => T;
```

---

## Summary

| Topic | Description |
|------|------|
| Function types | Annotate parameter and return types explicitly. You can also rely on inference |
| Optional parameters | Use `?` to make them omittable. Default values can also be specified |
| Overloads | Use when the return type should vary based on the input |
| `this` type | Ensures type safety for method chains and contextual code |
| interface | Defines object structures. Supports inheritance and merging |
| type alias | Flexible type definitions. Essential for unions, conditional types, and mapped types |
| Structural typing | Compatibility is judged by structure, not by name |
| When to use which | Object structures -> interface; unions/complex types -> type |
| readonly | Shallow immutability. DeepReadonly is needed for deep immutability |
| Utility types | Manipulate types efficiently with Partial, Pick, Omit, Record, and so on |

---

## Recommended Next Reading

- [03-union-intersection.md](./03-union-intersection.md) -- Union and Intersection types
- [04-generics.md](./04-generics.md) -- Generics

---

## References

1. **TypeScript Handbook: More on Functions** -- https://www.typescriptlang.org/docs/handbook/2/functions.html
2. **TypeScript Handbook: Object Types** -- https://www.typescriptlang.org/docs/handbook/2/objects.html
3. **TypeScript Handbook: Type Manipulation** -- https://www.typescriptlang.org/docs/handbook/2/types-from-types.html
4. **Effective TypeScript, Item 13: Know the Differences Between type and interface** -- by Dan Vanderkam, O'Reilly
5. **TypeScript Deep Dive: Functions** -- https://basarat.gitbook.io/typescript/type-system/functions
6. **Google TypeScript Style Guide** -- https://google.github.io/styleguide/tsguide.html
