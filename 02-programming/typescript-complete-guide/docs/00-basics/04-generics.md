# Generics

> Use type parameters to write reusable and type-safe code. Understand constraints, conditional types, and how type inference works.

## What You Will Learn in This Chapter

1. **Generics Basics** -- Type parameters, type argument inference, generic functions/classes/interfaces
2. **Type Constraints** -- Constraining type parameters with `extends`, multiple constraints
3. **Applied Generics** -- Combining with conditional types, default type parameters, type inference (`infer`)
4. **Practical Patterns** -- Repository, Result type, Builder, type-safe events, factory pattern
5. **Advanced Generics** -- Recursive types, distributive conditional types, variadic tuples


## Prerequisites

To get the most out of this guide, the following knowledge is helpful:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the contents of [Union and Intersection Types](./03-union-intersection.md)

---

## 1. Generics Basics

Generics is TypeScript's mechanism for "parameterizing types." Instead of specifying concrete types when defining functions or classes, you use type parameters, and the actual type is determined when called. This allows the same logic to be reused for different types while maintaining type safety.

### Why Are Generics Needed?

Without generics, you only have two choices:

```typescript
// Option 1: Define a function for each type (code duplication)
function identityString(value: string): string { return value; }
function identityNumber(value: number): number { return value; }
function identityBoolean(value: boolean): boolean { return value; }
// ... functions multiply as types increase

// Option 2: Use any (loss of type safety)
function identityAny(value: any): any { return value; }
const result = identityAny("hello"); // type of result is any -> type information is lost

// Solution with generics: both reusability and type safety
function identity<T>(value: T): T { return value; }
const result = identity("hello"); // type of result is string
```

### Code Example 1: Generic Function

```typescript
// A generic function using type parameter T
function identity<T>(value: T): T {
  return value;
}

// Explicit type argument specification
const str = identity<string>("hello");  // type: string
const num = identity<number>(42);       // type: number

// Type argument inference (often unnecessary to specify explicitly)
const inferred = identity("hello");     // type: string (inferred)
```

### How the Type Inference Engine Works

```
  Call: identity("hello")
                |
                v
  Type inference engine:
    1. T is inferred from the argument type
    2. The type of "hello" is string
    3. Therefore T = string
                |
                v
  Instantiation: identity<string>(value: string): string
                |
                v
  Result type: string

  ────────────────────────────────

  Call: identity<number>(42)
                |
                v
  Type parameter is explicitly specified
    T = number (explicit)
                |
                v
  Argument check: 42 is number -> OK
                |
                v
  Result type: number
```

### Code Example 1b: Generics with Arrow Functions

```typescript
// Standard arrow function
const identity = <T>(value: T): T => value;

// Workarounds in .tsx files (to avoid confusion with JSX tags)
const identity1 = <T,>(value: T): T => value;           // trailing comma
const identity2 = <T extends unknown>(value: T): T => value; // extends

// Multiple type parameters
const pair = <A, B>(a: A, b: B): [A, B] => [a, b];

// With constraint
const getLength = <T extends { length: number }>(value: T): number => value.length;
```

### Code Example 2: Practical Generic Functions

```typescript
// Returns the first element of an array
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

first([1, 2, 3]);       // type: number | undefined
first(["a", "b"]);      // type: string | undefined

// Create a pair
function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}

const p = pair("name", 42);  // type: [string, number]

// Get a value by key from an object
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 30 };
const name = getProperty(user, "name");  // type: string
const age = getProperty(user, "age");    // type: number
// getProperty(user, "email");            // error: "email" is not in keyof User
```

### Code Example 2b: Even More Practical Generic Functions

```typescript
// Group an array
function groupBy<T, K extends string | number>(
  items: T[],
  getKey: (item: T) => K,
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = getKey(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

interface Product {
  name: string;
  category: string;
  price: number;
}

const products: Product[] = [
  { name: "Apple", category: "fruit", price: 100 },
  { name: "Banana", category: "fruit", price: 80 },
  { name: "Carrot", category: "vegetable", price: 120 },
];

const grouped = groupBy(products, (p) => p.category);
// type: Record<string, Product[]>
// { fruit: [...], vegetable: [...] }

// Get unique elements from an array
function unique<T>(items: T[], getKey?: (item: T) => unknown): T[] {
  if (!getKey) {
    return [...new Set(items)];
  }
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Promise retry
async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; delayMs: number },
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= options.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < options.maxRetries) {
        await new Promise((r) => setTimeout(r, options.delayMs));
      }
    }
  }
  throw lastError;
}

// Type-safe memoization
function memoize<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  const cache = new Map<string, R>();
  return (...args: Args): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

const memoizedFetch = memoize(async (url: string) => {
  const res = await fetch(url);
  return res.json();
});
```

---

## 2. Various Forms of Generics

### Code Example 3: Generic Interfaces and Classes

```typescript
// Generic interface
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

// Generic class
class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private items: Map<string, T> = new Map();

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) ?? null;
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.items.values());
  }

  async save(entity: T): Promise<T> {
    this.items.set(entity.id, entity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

// Usage
interface User {
  id: string;
  name: string;
}

const userRepo = new InMemoryRepository<User>();
await userRepo.save({ id: "1", name: "Alice" });
const user = await userRepo.findById("1");  // type: User | null
```

### Code Example 3b: Advanced Generic Class Patterns

```typescript
// --- Pattern 1: Type-safe stack ---
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  get size(): number {
    return this.items.length;
  }

  // Iterator support
  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = this.items.length - 1; i >= 0; i--) {
      yield this.items[i];
    }
  }
}

const numberStack = new Stack<number>();
numberStack.push(1);
numberStack.push(2);
numberStack.pop(); // type: number | undefined

// --- Pattern 2: Type-safe LinkedList ---
class LinkedListNode<T> {
  constructor(
    public value: T,
    public next: LinkedListNode<T> | null = null,
  ) {}
}

class LinkedList<T> {
  private head: LinkedListNode<T> | null = null;
  private _size = 0;

  prepend(value: T): void {
    this.head = new LinkedListNode(value, this.head);
    this._size++;
  }

  find(predicate: (value: T) => boolean): T | undefined {
    let current = this.head;
    while (current) {
      if (predicate(current.value)) return current.value;
      current = current.next;
    }
    return undefined;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  get size(): number {
    return this._size;
  }
}

// --- Pattern 3: Observable / EventEmitter ---
class TypedObservable<T> {
  private observers: ((value: T) => void)[] = [];

  subscribe(observer: (value: T) => void): () => void {
    this.observers.push(observer);
    // Returns an unsubscribe function
    return () => {
      this.observers = this.observers.filter((o) => o !== observer);
    };
  }

  notify(value: T): void {
    for (const observer of this.observers) {
      observer(value);
    }
  }
}

const priceUpdates = new TypedObservable<{ symbol: string; price: number }>();
const unsub = priceUpdates.subscribe((data) => {
  // data: { symbol: string; price: number }
  console.log(`${data.symbol}: $${data.price}`);
});

priceUpdates.notify({ symbol: "AAPL", price: 150.5 });
unsub(); // Unsubscribe
```

### Code Example 4: Generic Type Aliases

```typescript
// Result type for async operations
type AsyncResult<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

// API response
type ApiResponse<T> = {
  status: number;
  data: T;
  timestamp: string;
};

// Paginated response
type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

// Usage
type UserListResponse = ApiResponse<Paginated<User>>;
```

### Code Example 4b: Advanced Type Alias Patterns

```typescript
// --- Pattern 1: Result type (Railway-oriented programming) ---
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

// Usage: chained validation
function validateAge(age: number): Result<number, string> {
  if (age < 0 || age > 150) return err("Invalid age");
  return ok(age);
}

function validateName(name: string): Result<string, string> {
  if (name.length === 0) return err("Name is required");
  if (name.length > 100) return err("Name is too long");
  return ok(name.trim());
}

// --- Pattern 2: DeepPartial ---
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

interface AppConfig {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
  cache: {
    enabled: boolean;
    ttlSeconds: number;
  };
}

// Override only some nested properties
function mergeConfig(
  base: AppConfig,
  overrides: DeepPartial<AppConfig>,
): AppConfig {
  // deep merge implementation
  return { ...base, ...overrides } as AppConfig;
}

// --- Pattern 3: DeepReadonly ---
type DeepReadonly<T> = T extends Function
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

const config: DeepReadonly<AppConfig> = {
  database: {
    host: "localhost",
    port: 5432,
    credentials: { username: "admin", password: "secret" },
  },
  cache: { enabled: true, ttlSeconds: 3600 },
};

// config.database.host = "other"; // error: readonly
// config.cache.enabled = false;   // error: readonly

// --- Pattern 4: Nullable<T> ---
type Nullable<T> = { [K in keyof T]: T[K] | null };

interface UserForm {
  name: string;
  email: string;
  bio: string;
}

type NullableUserForm = Nullable<UserForm>;
// { name: string | null; email: string | null; bio: string | null }
```

### Where Generics Apply

```
+------------------+---------------------------+---------------------+
| Location         | Syntax                    | Example             |
+------------------+---------------------------+---------------------+
| Function         | function fn<T>(x: T): T   | identity<T>         |
| Arrow function   | const fn = <T>(x: T): T   | <T>(x: T) => T      |
| Interface        | interface I<T> { ... }    | Repository<T>       |
| Class            | class C<T> { ... }        | Stack<T>            |
| Type alias       | type T<U> = { ... }       | Result<T>           |
| Method           | method<T>(x: T): T        | Array#map           |
+------------------+---------------------------+---------------------+
```

---

## 3. Type Constraints

Type constraints are a mechanism for specifying conditions that a generic type parameter must satisfy. Using the `extends` keyword, you impose the constraint that "T must be a subtype of this type."

### Code Example 5: Constraints with `extends`

```typescript
// T is constrained to types that have { length: number }
function logLength<T extends { length: number }>(value: T): T {
  console.log(`Length: ${value.length}`);
  return value;
}

logLength("hello");       // OK: string has length
logLength([1, 2, 3]);     // OK: number[] has length
logLength({ length: 10 }); // OK
// logLength(42);          // error: number does not have length

// Constraint via keyof
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

const user = { id: 1, name: "Alice", email: "alice@test.com", age: 30 };
const picked = pick(user, ["name", "email"]);
// type: { name: string; email: string }
```

### Code Example 5b: Practical Constraint Patterns

```typescript
// --- Pattern 1: Constrain to a Comparable type ---
interface Comparable<T> {
  compareTo(other: T): number;
}

function max<T extends Comparable<T>>(a: T, b: T): T {
  return a.compareTo(b) >= 0 ? a : b;
}

class Money implements Comparable<Money> {
  constructor(public readonly amount: number, public readonly currency: string) {}

  compareTo(other: Money): number {
    if (this.currency !== other.currency) {
      throw new Error("Cannot compare different currencies");
    }
    return this.amount - other.amount;
  }
}

const a = new Money(100, "USD");
const b = new Money(200, "USD");
const result = max(a, b); // type: Money

// --- Pattern 2: Constructor constraint ---
type Constructor<T = unknown> = new (...args: any[]) => T;

function createInstance<T>(ctor: Constructor<T>, ...args: any[]): T {
  return new ctor(...args);
}

class UserEntity {
  constructor(public name: string, public email: string) {}
}

const user2 = createInstance(UserEntity, "Alice", "alice@test.com");
// type: UserEntity

// --- Pattern 3: Record constraint ---
function mergeObjects<
  T extends Record<string, unknown>,
  U extends Record<string, unknown>,
>(a: T, b: U): T & U {
  return { ...a, ...b };
}

const merged = mergeObjects(
  { name: "Alice", age: 30 },
  { email: "alice@test.com", active: true },
);
// type: { name: string; age: number } & { email: string; active: boolean }

// --- Pattern 4: Recursive constraint ---
interface TreeNode<T extends TreeNode<T>> {
  parent: T | null;
  children: T[];
}

class DOMElement implements TreeNode<DOMElement> {
  parent: DOMElement | null = null;
  children: DOMElement[] = [];
  tag: string;

  constructor(tag: string) {
    this.tag = tag;
  }

  appendChild(child: DOMElement): void {
    child.parent = this;
    this.children.push(child);
  }
}
```

### Code Example 6: Multiple Type Parameters and Constraints

```typescript
// Merge function
function merge<
  T extends Record<string, unknown>,
  U extends Record<string, unknown>
>(target: T, source: U): T & U {
  return { ...target, ...source };
}

const merged = merge(
  { name: "Alice" },
  { age: 30 }
);
// type: { name: string } & { age: number }

// Default type parameter
interface FetchOptions<T = unknown> {
  url: string;
  method?: "GET" | "POST";
  body?: T;
}

// If T is not specified, it becomes unknown
const opts: FetchOptions = { url: "/api/users" };
const opts2: FetchOptions<{ name: string }> = {
  url: "/api/users",
  method: "POST",
  body: { name: "Alice" },
};
```

### Code Example 6b: Defaults for Conditional Type Parameters

```typescript
// Using default type parameters
type Container<T = string> = {
  value: T;
  toString(): string;
};

// Omitting T gives string
const c1: Container = { value: "hello", toString: () => "hello" };
// Specifying T
const c2: Container<number> = { value: 42, toString: () => "42" };

// Multiple default type parameters
type ApiCall<
  TResponse = unknown,
  TError = Error,
  TParams = Record<string, string>,
> = {
  execute(params: TParams): Promise<TResponse>;
  onError(handler: (error: TError) => void): void;
};

// Specifying only some (in order from the start)
type SimpleCall = ApiCall<{ data: string }>;
// TResponse = { data: string }, TError = Error, TParams = Record<string, string>

type FullCall = ApiCall<User[], string, { page: number }>;
// All specified
```

### Constraint Hierarchy Diagram

```
  <T>                     No constraint (accepts all types)
    |
    v
  <T extends object>     Restricted to object types
    |
    v
  <T extends Record<string, unknown>>  Object with string keys
    |
    v
  <T extends { id: number }>   Restricted to types with id property
    |
    v
  <T extends User>        Restricted to types satisfying User
    |
    v
  <T extends Admin>       Restricted to types satisfying Admin (extends User)

  As constraints become stronger:
  - The range of accepted types narrows
  - More properties/methods become usable inside the type parameter
  - Type safety improves
```

---

## 4. Applied Generics

### Code Example 7: Conditional Types and Type Inference (`infer`)

```typescript
// Type that extracts the contents of a Promise
type Unwrap<T> = T extends Promise<infer U> ? U : T;

type A = Unwrap<Promise<string>>;  // string
type B = Unwrap<Promise<number>>;  // number
type C = Unwrap<string>;           // string (passes through if not a Promise)

// Recursively unwrap deeply nested Promises
type DeepUnwrap<T> = T extends Promise<infer U> ? DeepUnwrap<U> : T;

type D = DeepUnwrap<Promise<Promise<Promise<string>>>>; // string

// Extract the return type of a function (equivalent to ReturnType)
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type E = MyReturnType<() => string>;            // string
type F = MyReturnType<(x: number) => boolean>;  // boolean

// Extract the parameter types of a function (equivalent to Parameters)
type MyParameters<T> = T extends (...args: infer P) => any ? P : never;

type G = MyParameters<(a: string, b: number) => void>; // [string, number]

// Extract the element type of an array
type ElementOf<T> = T extends (infer U)[] ? U : never;

type H = ElementOf<string[]>;     // string
type I = ElementOf<number[]>;     // number
```

### Code Example 7b: Advanced Uses of `infer`

```typescript
// --- Extract a constructor's argument types ---
type ConstructorArgs<T> = T extends new (...args: infer A) => any ? A : never;

class UserEntity {
  constructor(public name: string, public age: number) {}
}

type UserArgs = ConstructorArgs<typeof UserEntity>; // [string, number]

// --- Extract only methods from an object type ---
type MethodsOf<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K];
};

interface UserService {
  name: string;
  getUser(id: string): Promise<User>;
  createUser(data: Omit<User, "id">): Promise<User>;
  maxRetries: number;
}

type UserServiceMethods = MethodsOf<UserService>;
// {
//   getUser: (id: string) => Promise<User>;
//   createUser: (data: Omit<User, "id">) => Promise<User>;
// }

// --- Inference from template literal types ---
type ParseRoute<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ParseRoute<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type RouteParams = ParseRoute<"/users/:userId/posts/:postId">;
// "userId" | "postId"

// --- Construct an async function type from a Promise type ---
type AsyncFunction<T extends (...args: any[]) => any> =
  ReturnType<T> extends Promise<any>
    ? T
    : (...args: Parameters<T>) => Promise<ReturnType<T>>;

function toAsync<T extends (...args: any[]) => any>(
  fn: T,
): AsyncFunction<T> {
  return (async (...args: Parameters<T>) => {
    return fn(...args);
  }) as AsyncFunction<T>;
}
```

### Code Example 8: Generics and Mapped Types

```typescript
// Make all properties optional and nullable
type NullablePartial<T> = {
  [K in keyof T]?: T[K] | null;
};

interface User {
  id: number;
  name: string;
  email: string;
}

type UpdateUserInput = NullablePartial<User>;
// { id?: number | null; name?: string | null; email?: string | null }

// Generate handler types from an event map
type EventMap = {
  click: { x: number; y: number };
  keypress: { key: string; code: number };
  scroll: { offset: number };
};

type EventHandlers<T> = {
  [K in keyof T as `on${Capitalize<string & K>}`]: (event: T[K]) => void;
};

type Handlers = EventHandlers<EventMap>;
// {
//   onClick: (event: { x: number; y: number }) => void;
//   onKeypress: (event: { key: string; code: number }) => void;
//   onScroll: (event: { offset: number }) => void;
// }
```

### Code Example 8b: Advanced Mapped Type Patterns

```typescript
// --- Pattern 1: Auto-generate getters/setters ---
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

interface UserProps {
  name: string;
  age: number;
  active: boolean;
}

type UserGetters = Getters<UserProps>;
// {
//   getName: () => string;
//   getAge: () => number;
//   getActive: () => boolean;
// }

type UserSetters = Setters<UserProps>;
// {
//   setName: (value: string) => void;
//   setAge: (value: number) => void;
//   setActive: (value: boolean) => void;
// }

// --- Pattern 2: Apply Readonly only to specific keys ---
type ReadonlyPick<T, K extends keyof T> = {
  readonly [P in K]: T[P];
} & {
  [P in Exclude<keyof T, K>]: T[P];
};

type UserWithReadonlyId = ReadonlyPick<User, "id">;
// { readonly id: number; name: string; email: string }

// --- Pattern 3: Conditional property transformation ---
type StringToNumber<T> = {
  [K in keyof T]: T[K] extends string ? number : T[K];
};

interface RawData {
  name: string;
  count: string;   // received as string
  active: boolean;
}

type ParsedData = StringToNumber<RawData>;
// { name: number; count: number; active: boolean }
// ^ name also becomes number. More precise control is needed:

type ParseNumericStrings<T, K extends keyof T> = {
  [P in keyof T]: P extends K
    ? T[P] extends string ? number : T[P]
    : T[P];
};

type BetterParsed = ParseNumericStrings<RawData, "count">;
// { name: string; count: number; active: boolean }

// --- Pattern 4: Filtering ---
type FilterByType<T, ValueType> = {
  [K in keyof T as T[K] extends ValueType ? K : never]: T[K];
};

interface Config {
  host: string;
  port: number;
  debug: boolean;
  maxConnections: number;
  name: string;
}

type StringConfigs = FilterByType<Config, string>;
// { host: string; name: string }

type NumberConfigs = FilterByType<Config, number>;
// { port: number; maxConnections: number }
```

---

## 5. Variadic Tuples and Advanced Generics

### Code Example 9: Variadic Tuple Types

Variadic tuple types, introduced in TypeScript 4.0, allow you to use spread syntax in tuple type parameters.

```typescript
// Basic variadic tuples
type Prepend<T, Tuple extends unknown[]> = [T, ...Tuple];
type Append<Tuple extends unknown[], T> = [...Tuple, T];

type A = Prepend<string, [number, boolean]>; // [string, number, boolean]
type B = Append<[number, boolean], string>;  // [number, boolean, string]

// Type that concatenates multiple arrays
type Concat<A extends unknown[], B extends unknown[]> = [...A, ...B];
type C = Concat<[1, 2], [3, 4]>; // [1, 2, 3, 4]

// Practical example: type-safe function composition
function compose<A extends unknown[], B, C>(
  f: (arg: B) => C,
  g: (...args: A) => B,
): (...args: A) => C {
  return (...args: A) => f(g(...args));
}

const toNumber = (s: string): number => parseInt(s, 10);
const add = (a: number, b: number): number => a + b;

const addStrings = compose(String, add);
// type: (a: number, b: number) => string
addStrings(1, 2); // "3"

// pipe function
function pipe<A, B>(value: A, fn1: (a: A) => B): B;
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
function pipe<A, B, C, D>(
  value: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
): D;
function pipe(value: unknown, ...fns: Function[]): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}

const result = pipe(
  " Hello, World! ",
  (s: string) => s.trim(),
  (s: string) => s.toLowerCase(),
  (s: string) => s.split(", "),
);
// type: string[]
// value: ["hello", "world!"]
```

### Code Example 10: Recursive Types

```typescript
// --- JSON type definition ---
type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonArray | JsonObject;

// --- Type for nested access by path ---
type PathOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${Prefix}${K}` | PathOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

interface AppState {
  user: {
    name: string;
    settings: {
      theme: "light" | "dark";
      notifications: boolean;
    };
  };
  cart: {
    items: string[];
    total: number;
  };
}

type StatePaths = PathOf<AppState>;
// "user" | "user.name" | "user.settings" | "user.settings.theme"
// | "user.settings.notifications" | "cart" | "cart.items" | "cart.total"

// --- Type-level arithmetic (type-safe counter) ---
type BuildTuple<N extends number, T extends unknown[] = []> =
  T["length"] extends N ? T : BuildTuple<N, [...T, unknown]>;

type Add<A extends number, B extends number> =
  [...BuildTuple<A>, ...BuildTuple<B>]["length"];

type Sum = Add<3, 4>; // 7
```

---

## Type Constraint Pattern Comparison

| Pattern | Syntax | Use case |
|---------|--------|----------|
| Upper bound | `<T extends U>` | Constrain T to a subtype of U |
| keyof constraint | `<K extends keyof T>` | Constrain K to keys of T |
| Multiple constraint | `<T extends A & B>` | Constrain T to types satisfying both A and B |
| Default type | `<T = DefaultType>` | Default when type argument is omitted |
| Conditional type | `T extends U ? X : Y` | Type-level conditional branching |
| Inference | `T extends X<infer U>` | Extract a type from a structure |
| Constructor | `<T extends new (...) => any>` | Constrain to class constructors |
| Function | `<T extends (...) => any>` | Constrain to function types |

---

## 6. Practical Pattern Collection

### Pattern 1: Type-safe API Client

```typescript
// Endpoint definitions
interface ApiEndpoints {
  "GET /users": {
    params: { page?: number; limit?: number };
    response: { users: User[]; total: number };
  };
  "GET /users/:id": {
    params: { id: string };
    response: User;
  };
  "POST /users": {
    body: { name: string; email: string };
    response: User;
  };
  "PUT /users/:id": {
    params: { id: string };
    body: Partial<User>;
    response: User;
  };
  "DELETE /users/:id": {
    params: { id: string };
    response: { success: boolean };
  };
}

// Type-safe fetch function
type ExtractMethod<T extends string> = T extends `${infer M} ${string}` ? M : never;
type ExtractPath<T extends string> = T extends `${string} ${infer P}` ? P : never;

type HasBody<T> = T extends { body: infer B } ? B : never;
type HasParams<T> = T extends { params: infer P } ? P : Record<string, never>;
type GetResponse<T> = T extends { response: infer R } ? R : never;

async function apiCall<K extends keyof ApiEndpoints>(
  endpoint: K,
  options: Omit<ApiEndpoints[K], "response">,
): Promise<GetResponse<ApiEndpoints[K]>> {
  // implementation omitted
  return {} as any;
}

// Usage: type-safe API calls
const users = await apiCall("GET /users", { params: { page: 1, limit: 20 } });
// type: { users: User[]; total: number }

const user = await apiCall("POST /users", { body: { name: "Alice", email: "a@test.com" } });
// type: User
```

### Pattern 2: Type-safe DI Container

```typescript
class Token<T> {
  // Functions as a brand type
  private readonly _brand: T = undefined!;
  constructor(public readonly name: string) {}
}

class DIContainer {
  private bindings = new Map<Token<any>, () => any>();

  bind<T>(token: Token<T>, factory: () => T): void {
    this.bindings.set(token, factory);
  }

  resolve<T>(token: Token<T>): T {
    const factory = this.bindings.get(token);
    if (!factory) {
      throw new Error(`No binding for token: ${token.name}`);
    }
    return factory() as T;
  }
}

// Token definitions
const LoggerToken = new Token<ILogger>("Logger");
const UserRepoToken = new Token<IUserRepository>("UserRepo");

const container = new DIContainer();
container.bind(LoggerToken, () => new ConsoleLogger());
container.bind(UserRepoToken, () => new PostgresUserRepo());

const logger = container.resolve(LoggerToken); // type: ILogger
const repo = container.resolve(UserRepoToken); // type: IUserRepository
```

### Pattern 3: Type-safe Form Validation

```typescript
type ValidationRule<T> = {
  validate: (value: T) => boolean;
  message: string;
};

type FormSchema<T extends Record<string, unknown>> = {
  [K in keyof T]: ValidationRule<T[K]>[];
};

type FormErrors<T extends Record<string, unknown>> = {
  [K in keyof T]?: string[];
};

function validateForm<T extends Record<string, unknown>>(
  data: T,
  schema: FormSchema<T>,
): FormErrors<T> {
  const errors: FormErrors<T> = {};

  for (const key in schema) {
    const rules = schema[key];
    const value = data[key];
    const fieldErrors: string[] = [];

    for (const rule of rules) {
      if (!rule.validate(value)) {
        fieldErrors.push(rule.message);
      }
    }

    if (fieldErrors.length > 0) {
      errors[key] = fieldErrors;
    }
  }

  return errors;
}

// Usage
interface LoginForm {
  email: string;
  password: string;
}

const loginSchema: FormSchema<LoginForm> = {
  email: [
    { validate: (v) => v.length > 0, message: "Email is required" },
    { validate: (v) => v.includes("@"), message: "Please enter a valid email address" },
  ],
  password: [
    { validate: (v) => v.length >= 8, message: "Password must be at least 8 characters" },
    { validate: (v) => /[A-Z]/.test(v), message: "Must include an uppercase letter" },
  ],
};

const errors = validateForm(
  { email: "test", password: "abc" },
  loginSchema,
);
// errors.email?: string[] | undefined
// errors.password?: string[] | undefined
```

---

## Anti-patterns

### Anti-pattern 1: Unnecessary Generics

```typescript
// BAD: making it generic even though T is not used
function greet<T>(name: string): string {
  return `Hello, ${name}`;
}

// BAD: excessive generics (unnecessary because T is not returned)
function getLength<T extends { length: number }>(x: T): number {
  return x.length;
}
// GOOD: generics not needed
function getLength(x: { length: number }): number {
  return x.length;
}

// Criteria for when generics are needed:
// 1. When relating input and output types -> needed
//    function first<T>(arr: T[]): T | undefined
// 2. When relating types of multiple arguments -> needed
//    function merge<T>(a: T, b: Partial<T>): T
// 3. When not propagating input type info to output -> not needed
//    function getLength(x: { length: number }): number
```

### Anti-pattern 2: Bypassing Constraints with `any`

```typescript
// BAD: silencing constraint errors with any
function merge<T>(a: T, b: T): T {
  return { ...(a as any), ...(b as any) } as T;
}

// GOOD: apply appropriate constraints
function merge<T extends Record<string, unknown>>(a: T, b: Partial<T>): T {
  return { ...a, ...b };
}
```

### Anti-pattern 3: Unclear Type Parameter Names

```typescript
// BAD: meaning is unclear
function process<A, B, C, D>(a: A, b: B): C {
  // ...
}

// GOOD: use meaningful names
function transform<TInput, TOutput>(
  input: TInput,
  transformer: (item: TInput) => TOutput,
): TOutput {
  return transformer(input);
}

// Type parameter naming conventions:
// T, U, V         - generic types (1 to 3 parameters)
// TInput, TOutput - input/output relationship
// TKey, TValue    - key-value relationship
// TEntity, TDto   - domain objects
// K extends keyof T - object keys
// E               - error type or element type
// R               - return type
```

### Anti-pattern 4: Excessive Generic Nesting

```typescript
// BAD: hard-to-read nesting
type Complex<T> = Promise<Result<Array<Partial<Readonly<T>>>>>;

// GOOD: define intermediate types and build up gradually
type ReadonlyPartial<T> = Readonly<Partial<T>>;
type ResultList<T> = Result<ReadonlyPartial<T>[]>;
type AsyncResultList<T> = Promise<ResultList<T>>;
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured config file | Check the config file's path and format |
| Timeout | Network latency / resource shortage | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check the executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Verify step by step**: Verify hypotheses using log output and debuggers
5. **Fix and regression test**: After fixing, run tests on related areas

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
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"exception: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Problems

Steps to diagnose when performance issues arise:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O waits**: Examine disk and network I/O conditions
4. **Check the number of concurrent connections**: Examine connection pool state

| Problem type | Diagnostic tools | Countermeasures |
|--------------|------------------|-----------------|
| CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes criteria for making technology selections.

| Criterion | When to prioritize | When you can compromise |
|-----------|-------------------|-------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed users |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow           │
├─────────────────────────────────────────────────┤
│                                                 │
│  (1) Team size?                                 │
│    ├─ Small (1-5 people) -> Monolith            │
│    └─ Large (10+ people) -> (2)                 │
│                                                 │
│  (2) Deployment frequency?                      │
│    ├─ Once a week or less -> Monolith + modules │
│    └─ Daily / multiple times -> (3)             │
│                                                 │
│  (3) Inter-team independence?                   │
│    ├─ High -> Microservices                     │
│    └─ Medium -> Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze them from the following perspectives:

**1. Short-term vs. long-term cost**
- A method that is fast in the short term may become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs. flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction enables high reusability but can make debugging difficult
- Low abstraction is intuitive but tends to cause code duplication

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
        """Describe background and issues"""
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
            icon = "[+]" if c['type'] == 'positive' else "[!]"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## FAQ

### Q1: Are `<T>` and `<T extends unknown>` the same?

**A:** Yes, effectively the same. Since every type is a subtype of `unknown`, `<T>` and `<T extends unknown>` are equivalent. However, `<T extends object>` excludes null, undefined, and primitives.

### Q2: What are the conventions for generic type parameter names?

**A:** Common conventions:
- `T` (Type): a generic type
- `K` (Key): the type of a key
- `V` (Value): the type of a value
- `E` (Element / Error): an element or error type
- `R` (Return / Result): a return type

For more complex cases, descriptive names such as `TInput`, `TOutput` are also recommended.

### Q3: Don't generics in arrow functions clash with JSX?

**A:** In `.tsx` files, `<T>` may be misinterpreted as a JSX tag. As workarounds, use `<T,>` or `<T extends unknown>`.
```typescript
// Workarounds in .tsx files
const identity = <T,>(value: T): T => value;
const identity = <T extends unknown>(value: T): T => value;
```

### Q4: Do generics affect runtime?

**A:** No. Generics exist only at compile time and are completely erased after being converted to JavaScript (type erasure). There is zero impact on runtime performance.

### Q5: How do generics relate to covariance and contravariance?

**A:** The variance of TypeScript's type parameters is determined by their usage position:
- **Covariant**: output position (return type) -> compatible in the subtype direction
- **Contravariant**: input position (argument type) -> compatible in the supertype direction
- **Invariant**: used in both input and output -> exact match required

```typescript
// In TypeScript 4.7+ you can specify variance with in/out modifiers
interface Producer<out T> {  // T is covariant
  produce(): T;
}

interface Consumer<in T> {  // T is contravariant
  consume(value: T): void;
}

interface Processor<in out T> {  // T is invariant
  process(value: T): T;
}
```

### Q6: What should I keep in mind when specifying defaults for type parameters?

**A:** Default type parameters must be placed at the end (similar to default function arguments). Also, the default value must satisfy the constraint.

```typescript
// OK: default type satisfies the constraint
type Container<T extends object = Record<string, unknown>> = { data: T };

// Error: default type string does not satisfy the object constraint
// type Bad<T extends object = string> = { data: T };

// OK: default type parameter at the end
type Result<T, E = Error> = { value: T } | { error: E };

// Error: required parameter cannot follow a default type parameter
// type Bad<T = string, U> = { a: T; b: U };
```

---

## Summary

| Item | Content |
|------|---------|
| What generics are | A mechanism to parameterize types and write reusable, type-safe code |
| Type inference | In many cases, TypeScript automatically infers type arguments |
| Constraints (extends) | Specify conditions that a type parameter must satisfy |
| Default types | Set the default value used when a type argument is omitted |
| infer | Keyword used inside conditional types to extract a type |
| Where to apply | Functions, classes, interfaces, type aliases |
| Design guideline | Avoid unnecessary generics; use them when returning types |
| Variadic tuples | Compose tuple types with spread syntax |
| Recursive types | Express tree structures and path types with self-referencing type definitions |
| Variance | Specify type parameter variance with in/out modifiers |

---

## Exercises

### Exercise 1: A Generic Cache Class

Implement a generic `Cache<K, V>` class that satisfies the following specification.

- `get(key: K): V | undefined` -- get the value associated with the key
- `set(key: K, value: V, ttlMs?: number)` -- set a value (optionally specifying a TTL)
- `has(key: K): boolean` -- check whether a key exists
- `delete(key: K): boolean` -- delete a key
- Entries whose TTL has expired must automatically become invalid

```typescript
class Cache<K, V> {
  // Write your implementation here
}
```

### Exercise 2: A Type-safe EventEmitter

Implement a type-safe EventEmitter from the following event definitions. Type-checking should be enforced for the event names registered with `on` and emitted via `emit`, as well as for the payload types.

```typescript
type Events = {
  "user:login": { userId: string; timestamp: Date };
  "user:logout": { userId: string };
  "error": { code: number; message: string };
};

class TypedEmitter<E extends Record<string, unknown>> {
  // Implement on, emit, off, once
}
```

### Exercise 3: Implementing DeepPick

Implement a `DeepPick` type that extracts only the properties specified by dot-separated paths from a nested object type.

```typescript
interface User {
  id: string;
  name: string;
  address: {
    city: string;
    zip: string;
    country: {
      code: string;
      name: string;
    };
  };
}

type Result = DeepPick<User, "name" | "address.city" | "address.country.code">;
// {
//   name: string;
//   address: {
//     city: string;
//     country: {
//       code: string;
//     };
//   };
// }
```

### Exercise 4: Pipeline Function

Implement a `pipe` function that takes any number of transformation functions and applies them from left to right. Guarantee at the type level that the input type of each function matches the output type of the previous one.

```typescript
function pipe<A>(value: A): A;
function pipe<A, B>(value: A, fn1: (a: A) => B): B;
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
// ... add overloads

// Usage
const result = pipe(
  "  Hello, World!  ",
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.split(" "),
  (arr) => arr.length,
);
// result: number (= 2)
```

### Exercise 5: Type-safe State Management

Implement a generic state management class that satisfies the following specification.

- Receives an initial state to create the store
- `getState()` to get the current state
- `setState(updater: (state: T) => T)` to update the state
- `subscribe(listener: (state: T) => void)` to observe changes
- `select<U>(selector: (state: T) => U)` to get a partial state

```typescript
class Store<T extends Record<string, unknown>> {
  // Write your implementation here
}
```

---

## Recommended Next Reading

- [../01-advanced-types/00-conditional-types.md](../01-advanced-types/00-conditional-types.md) -- Conditional types (in detail)
- [../01-advanced-types/01-mapped-types.md](../01-advanced-types/01-mapped-types.md) -- Mapped types (in detail)
- [../02-patterns/00-error-handling.md](../02-patterns/00-error-handling.md) -- Practical use of the Result type

---

## References

1. **TypeScript Handbook: Generics** -- https://www.typescriptlang.org/docs/handbook/2/generics.html
2. **TypeScript Deep Dive: Generics** -- https://basarat.gitbook.io/typescript/type-system/generics
3. **Effective TypeScript, Item 26: Understand How Context Is Used in Type Inference** -- by Dan Vanderkam, O'Reilly
4. **Programming TypeScript** -- by Boris Cherny, O'Reilly. Chapter 4: Functions (Generics section)
5. **TypeScript 4.0: Variadic Tuple Types** -- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html
