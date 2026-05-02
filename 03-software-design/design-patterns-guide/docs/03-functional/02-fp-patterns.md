# Functional Patterns

> Master practical functional programming patterns such as currying, pipelines, and lenses to write composable and maintainable code

## What You Will Learn in This Chapter

1. **Fundamentals of Function Composition** — How currying, partial application, and point-free style work, and when to use each
2. **Pipeline Patterns** — Data transformation chains, middleware composition, Railway Oriented Programming
3. **Immutable Data Manipulation** — Lenses, Prisms, structural sharing, and comparison with Immer
4. **Memoization and Optimization** — Computation caching, transducers, lazy evaluation
5. **Practical Applications** — Functional patterns in React/Redux, improving testability

---

## Prerequisites

Before reading this guide, it is recommended that you have the following knowledge.

| Prerequisite | Reference |
|---|---|
| TypeScript basics (generics, type inference) | [02-programming category](../../../../02-programming/) |
| Higher-order function concepts (map, filter, reduce) | JavaScript/TypeScript basics |
| Basic concept of Immutability | Clean code principles |
| Basics of Functors and Monads | [Functor & Applicative](./01-functor-applicative.md), [Monad](./00-monad.md) |

---

## 1. Currying and Partial Application

### 1.1 What Is Currying — Understanding the WHY

```
Currying and Partial Application
==================================

Regular function:
  add(a, b) = a + b
  add(3, 5)  --> 8

Currying:
  add = a => b => a + b
  add(3)     --> b => 3 + b   (partially applied function)
  add(3)(5)  --> 8

Partial Application:
  add3 = add(3)    // fix one argument
  add3(5)  --> 8
  add3(10) --> 13

Benefit: Makes function reuse and composition easier
```

**WHY**: Why do we need currying?

Currying may appear to be unnecessary complexity at first glance, but it provides three important benefits:

1. **Function reuse**: Fix some arguments to create specialized functions
2. **Function composition**: Easier to compose as a chain of single-argument functions
3. **Lazy evaluation**: Delay computation until all arguments are provided

```
┌────────────────────────────────────────────────────────┐
│  How Currying Works                                    │
│                                                        │
│  Regular function: f(a, b, c) → result                 │
│  Pass all arguments at once                            │
│                                                        │
│  Currying: f(a) → g(b) → h(c) → result                │
│  Pass one argument at a time, each returns the next fn │
│                                                        │
│  multiply(2)(5)                                        │
│       │    │                                           │
│       │    └─ Final argument → result 10               │
│       └─ First argument → returns function (b => 2 * b)│
│                                                        │
│  const double = multiply(2)  ← Reusable via partial app│
│  const triple = multiply(3)  ← Another specialized fn  │
│                                                        │
│  double(5)  → 10                                       │
│  double(7)  → 14                                       │
│  triple(5)  → 15                                       │
└────────────────────────────────────────────────────────┘
```

### Code Example 1: Implementing and Using Currying

```typescript
// === General-purpose currying functions ===

// Curry for 2 arguments
function curry<A, B, C>(fn: (a: A, b: B) => C): (a: A) => (b: B) => C {
  return (a: A) => (b: B) => fn(a, b);
}

// Curry for 3 arguments
function curry3<A, B, C, D>(
  fn: (a: A, b: B, c: C) => D
): (a: A) => (b: B) => (c: C) => D {
  return (a: A) => (b: B) => (c: C) => fn(a, b, c);
}

// Curry for arbitrary arguments (leveraging JavaScript's dynamic features)
function curryN(fn: (...args: any[]) => any): (...args: any[]) => any {
  const arity = fn.length;
  return function curried(...args: any[]): any {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...moreArgs: any[]) => curried(...args, ...moreArgs);
  };
}

// === Practical Example 1: Numeric computation ===
const multiply = curry((a: number, b: number) => a * b);
const double = multiply(2);
const triple = multiply(3);

console.log(double(5));  // 10
console.log(triple(5));  // 15
console.log(double(7));  // 14

// === Practical Example 2: String processing ===
const prefix = curry((pre: string, str: string) => `${pre}${str}`);
const addHttps = prefix("https://");
const addApiPrefix = prefix("/api/v1");

console.log(addHttps("example.com"));   // "https://example.com"
console.log(addApiPrefix("/users"));     // "/api/v1/users"

// === Practical Example 3: Partial application of filters ===
const filterBy = curry3(
  <T>(key: keyof T, value: T[keyof T], items: T[]) =>
    items.filter(item => item[key] === value)
);

interface Order {
  id: number;
  status: string;
  amount: number;
}

const filterByStatus = filterBy<Order>("status");
const getActiveOrders = filterByStatus("active");
const getPendingOrders = filterByStatus("pending");

const orders: Order[] = [
  { id: 1, status: "active", amount: 100 },
  { id: 2, status: "pending", amount: 200 },
  { id: 3, status: "active", amount: 150 },
];

console.log(getActiveOrders(orders));
// [{ id: 1, status: "active", amount: 100 }, { id: 3, status: "active", amount: 150 }]
console.log(getPendingOrders(orders));
// [{ id: 2, status: "pending", amount: 200 }]
```

### Code Example 2: Partial Application in Rust

```rust
// In Rust, partial application is achieved using closures

fn main() {
    // Partial application via closures
    let multiply = |a: i32| move |b: i32| a * b;
    let double = multiply(2);
    let triple = multiply(3);

    println!("double(5) = {}", double(5));  // 10
    println!("triple(5) = {}", triple(5));  // 15

    // Practical example: string formatting
    let format_price = |currency: &str| {
        let currency = currency.to_string();
        move |amount: f64| format!("{}{:.2}", currency, amount)
    };

    let format_usd = format_price("$");
    let format_yen = format_price("¥");

    println!("{}", format_usd(19.99));  // $19.99
    println!("{}", format_yen(2000.0)); // ¥2000.00

    // Practical example: generating validation functions
    let min_length = |min: usize| {
        move |s: &str| -> Result<&str, String> {
            if s.len() >= min {
                Ok(s)
            } else {
                Err(format!("Must be at least {} characters (currently {} characters)", min, s.len()))
            }
        }
    };

    let validate_username = min_length(3);
    let validate_password = min_length(8);

    println!("{:?}", validate_username("ab"));      // Err("Must be at least 3 characters (currently 2 characters)")
    println!("{:?}", validate_username("alice"));    // Ok("alice")
    println!("{:?}", validate_password("pass"));     // Err("Must be at least 8 characters (currently 4 characters)")
    println!("{:?}", validate_password("password123")); // Ok("password123")
}
```

### 1.2 Difference Between Currying and Partial Application

```
┌────────────────────────────────────────────────────────┐
│  Currying vs Partial Application                       │
│                                                        │
│  ■ Currying:                                           │
│    f(a, b, c) → f(a)(b)(c)                             │
│    Transforms a function to accept one argument at a   │
│    time; changes the shape of the original function    │
│                                                        │
│  ■ Partial Application:                                │
│    f(a, b, c) → g(b, c)   [a is fixed]                 │
│    Creates a new function with some arguments fixed;   │
│    passes some arguments upfront when calling the      │
│    original function                                   │
│                                                        │
│  ■ Relationship:                                       │
│    Passing one argument to a curried function          │
│    = a form of partial application                     │
│                                                        │
│  ■ Practical difference:                               │
│    Currying: useful in function composition pipelines  │
│    Partial application: useful for injecting config    │
└────────────────────────────────────────────────────────┘
```

```typescript
// Partial application (without currying)
function partial<A, B, C>(fn: (a: A, b: B) => C, a: A): (b: B) => C {
  return (b: B) => fn(a, b);
}

// Partial application via bind (JavaScript standard)
function greet(greeting: string, name: string): string {
  return `${greeting}, ${name}!`;
}
const sayHello = greet.bind(null, "Hello");
const sayHi = greet.bind(null, "Hi");

console.log(sayHello("Taro"));  // "Hello, Taro!"
console.log(sayHi("Hanako"));   // "Hi, Hanako!"
```

---

## 2. Pipeline Patterns

### 2.1 What Is a Pipeline — Understanding the WHY

```
The Pipeline Concept
=====================

Data --> [Transform1] --> [Transform2] --> [Transform3] --> Result

Unix pipe:
  cat file | grep "error" | sort | uniq -c

Function pipeline:
  pipe(getData, filter(isActive), map(toDTO), sortBy('name'))

WHY: Why pipelines?
  1. Declarative: describe "what to do" in order
  2. Composable: each step is independent and swappable
  3. Testable: each transformation function can be tested in isolation
  4. Readable: data flows left→right (top→bottom) naturally
```

```
┌────────────────────────────────────────────────────────┐
│  pipe vs compose                                       │
│                                                        │
│  pipe:    f → g → h   (left to right, data flow order) │
│  compose: h ∘ g ∘ f   (right to left, mathematical)    │
│                                                        │
│  pipe(f, g, h)(x)    = h(g(f(x)))                     │
│  compose(h, g, f)(x) = h(g(f(x)))                     │
│                                                        │
│  In practice, pipe is more readable (natural data flow)│
│  compose is used in mathematical discussions           │
└────────────────────────────────────────────────────────┘
```

### Code Example 3: Type-Safe Pipeline Function

```typescript
// === Type-safe pipe function (with overloads) ===

function pipe<A, B>(a: A, ab: (a: A) => B): B;
function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
function pipe<A, B, C, D>(
  a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D
): D;
function pipe<A, B, C, D, E>(
  a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D, de: (d: D) => E
): E;
function pipe(initial: unknown, ...fns: Function[]): unknown {
  return fns.reduce((acc, fn) => fn(acc), initial);
}

// === Lazy pipeline (returns a function) ===

function pipeWith<A, B>(ab: (a: A) => B): (a: A) => B;
function pipeWith<A, B, C>(
  ab: (a: A) => B, bc: (b: B) => C
): (a: A) => C;
function pipeWith<A, B, C, D>(
  ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D
): (a: A) => D;
function pipeWith(...fns: Function[]): Function {
  return (initial: unknown) => fns.reduce((acc, fn) => fn(acc), initial);
}

// compose: right to left
function compose<A, B, C>(
  bc: (b: B) => C, ab: (a: A) => B
): (a: A) => C {
  return (a: A) => bc(ab(a));
}

// === Practical example: user data transformation pipeline ===

interface RawUser {
  first_name: string;
  last_name: string;
  age: number;
  status: string;
  email: string;
}

interface ProcessedUser {
  fullName: string;
  age: number;
  email: string;
}

// Define each step as an independent pure function
const filterActive = (users: RawUser[]) =>
  users.filter(u => u.status === "active");

const filterAdults = (users: RawUser[]) =>
  users.filter(u => u.age >= 18);

const toProcessedUser = (users: RawUser[]): ProcessedUser[] =>
  users.map(u => ({
    fullName: `${u.first_name} ${u.last_name}`,
    age: u.age,
    email: u.email.toLowerCase(),
  }));

const sortByName = (users: ProcessedUser[]) =>
  [...users].sort((a, b) => a.fullName.localeCompare(b.fullName));

// Compose as a pipeline
const processUsers = pipeWith(
  filterActive,
  filterAdults,
  toProcessedUser,
  sortByName,
);

// Usage
const rawUsers: RawUser[] = [
  { first_name: "Taro", last_name: "Yamada", age: 25, status: "active", email: "TARO@example.com" },
  { first_name: "Hanako", last_name: "Suzuki", age: 16, status: "active", email: "hanako@example.com" },
  { first_name: "Jiro", last_name: "Tanaka", age: 30, status: "inactive", email: "jiro@example.com" },
  { first_name: "Akiko", last_name: "Sato", age: 22, status: "active", email: "Akiko@Example.COM" },
];

const result = processUsers(rawUsers);
console.log(result);
// [
//   { fullName: "Akiko Sato", age: 22, email: "akiko@example.com" },
//   { fullName: "Taro Yamada", age: 25, email: "taro@example.com" },
// ]
```

### Code Example 4: Middleware Composition Pattern

```typescript
// === Express/Koa-style middleware composition ===

type Middleware<T> = (ctx: T, next: () => Promise<void>) => Promise<void>;

function composeMiddleware<T>(...middlewares: Middleware<T>[]): Middleware<T> {
  return (ctx: T, next: () => Promise<void>) => {
    let index = -1;
    function dispatch(i: number): Promise<void> {
      if (i <= index) return Promise.reject(new Error("next() called multiple times"));
      index = i;
      const fn = i === middlewares.length ? next : middlewares[i];
      return fn(ctx, () => dispatch(i + 1));
    }
    return dispatch(0);
  };
}

// Middleware definitions
interface Context {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  response?: unknown;
  startTime?: number;
  user?: { id: string; role: string };
}

const logger: Middleware<Context> = async (ctx, next) => {
  ctx.startTime = Date.now();
  console.log(`→ ${ctx.method} ${ctx.path}`);
  await next();
  console.log(`← ${ctx.method} ${ctx.path} - ${Date.now() - ctx.startTime}ms`);
};

const auth: Middleware<Context> = async (ctx, next) => {
  const token = ctx.headers.authorization;
  if (!token) throw new Error("Unauthorized: No token provided");
  // Token validation (simplified)
  ctx.user = { id: "user-1", role: "admin" };
  await next();
};

const errorHandler: Middleware<Context> = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.response = {
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

const handler: Middleware<Context> = async (ctx, next) => {
  ctx.response = { status: 200, data: { message: "Hello!" } };
  await next();
};

// Compose middleware
const app = composeMiddleware(errorHandler, logger, auth, handler);

// Usage
const ctx: Context = {
  method: "GET",
  path: "/api/users",
  headers: { authorization: "Bearer token123" },
};

await app(ctx, async () => {});
// → GET /api/users
// ← GET /api/users - 5ms
console.log(ctx.response); // { status: 200, data: { message: "Hello!" } }
```

### 2.2 Railway Oriented Programming

A pattern for incorporating error handling into pipelines.

```
┌────────────────────────────────────────────────────────┐
│  Railway Oriented Programming                          │
│                                                        │
│  Success track: ─────[Step1]─────[Step2]─────[Step3]──→│
│                 ╲           ╲           ╲               │
│  Failure track:  ─────────────────────────────────────→ │
│                                                        │
│  At each step:                                         │
│  - Success → continue on success track                 │
│  - Failure → switch to failure track (skip remaining)  │
│                                                        │
│  Achieved type-safely using Result<E, A>               │
└────────────────────────────────────────────────────────┘
```

### Code Example 5: Implementing Railway Oriented Programming

```typescript
// === Result type implementation ===

type Result<E, A> =
  | { tag: "Ok"; value: A }
  | { tag: "Err"; error: E };

const ok = <E, A>(value: A): Result<E, A> => ({ tag: "Ok", value });
const err = <E, A>(error: E): Result<E, A> => ({ tag: "Err", error });

// map: transform only on success (functor)
function mapR<E, A, B>(result: Result<E, A>, fn: (a: A) => B): Result<E, B> {
  return result.tag === "Ok" ? ok(fn(result.value)) : result;
}

// flatMap: execute next computation only on success (monad)
function flatMapR<E, A, B>(
  result: Result<E, A>,
  fn: (a: A) => Result<E, B>
): Result<E, B> {
  return result.tag === "Ok" ? fn(result.value) : result;
}

// mapError: transform the error
function mapError<E1, E2, A>(
  result: Result<E1, A>,
  fn: (e: E1) => E2
): Result<E2, A> {
  return result.tag === "Err" ? err(fn(result.error)) : result;
}

// === Railway pipeline ===
function railway<E, A, B>(
  ...fns: Array<(a: any) => Result<E, any>>
): (a: A) => Result<E, B> {
  return (a: A) => {
    let result: Result<E, any> = ok(a);
    for (const fn of fns) {
      if (result.tag === "Err") return result;
      result = fn(result.value);
    }
    return result;
  };
}

// === Practical example: user registration pipeline ===

interface RegistrationInput {
  username: string;
  email: string;
  password: string;
}

interface ValidatedInput {
  username: string;
  email: string;
  password: string;
}

interface HashedInput {
  username: string;
  email: string;
  passwordHash: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

type RegistrationError =
  | { type: "validation"; message: string }
  | { type: "duplicate"; field: string }
  | { type: "database"; message: string };

// Each step
function validateInput(input: RegistrationInput): Result<RegistrationError, ValidatedInput> {
  if (input.username.length < 3) {
    return err({ type: "validation", message: "Username must be at least 3 characters" });
  }
  if (!input.email.includes("@")) {
    return err({ type: "validation", message: "Invalid email address" });
  }
  if (input.password.length < 8) {
    return err({ type: "validation", message: "Password must be at least 8 characters" });
  }
  return ok(input);
}

function checkDuplicate(input: ValidatedInput): Result<RegistrationError, ValidatedInput> {
  // DB check (simplified)
  const existingUsers = ["admin", "root"];
  if (existingUsers.includes(input.username)) {
    return err({ type: "duplicate", field: "username" });
  }
  return ok(input);
}

function hashPassword(input: ValidatedInput): Result<RegistrationError, HashedInput> {
  try {
    return ok({
      username: input.username,
      email: input.email,
      passwordHash: `hashed_${input.password}`, // Use bcrypt in production
    });
  } catch {
    return err({ type: "database", message: "Failed to hash password" });
  }
}

function saveToDatabase(input: HashedInput): Result<RegistrationError, User> {
  try {
    return ok({
      id: `user_${Date.now()}`,
      ...input,
      createdAt: new Date(),
    });
  } catch {
    return err({ type: "database", message: "Failed to save" });
  }
}

// Railway pipeline
const registerUser = railway<RegistrationError, RegistrationInput, User>(
  validateInput,
  checkDuplicate,
  hashPassword,
  saveToDatabase,
);

// Usage examples
const result1 = registerUser({
  username: "taro",
  email: "taro@example.com",
  password: "secure123",
});
console.log(result1); // { tag: "Ok", value: { id: "user_...", ... } }

const result2 = registerUser({
  username: "ab",
  email: "bad",
  password: "short",
});
console.log(result2); // { tag: "Err", error: { type: "validation", message: "Username must be at least 3 characters" } }
```

---

## 3. Immutable Data Manipulation (Lenses)

### 3.1 What Is a Lens — Understanding the WHY

```
Lens: Partial read/write of immutable data structures
======================================================

The problem with updating deeply nested objects:

[NG] Direct mutable update
  user.address.city = "Tokyo";
  → Side effects, difficult to test, unpredictable changes

[NG] Spread hell
  { ...user, address: { ...user.address, city: "Tokyo" } }
  → Gets uglier as nesting deepens

[OK] Declarative update with lenses
  set(addressCityLens, "Tokyo", user)
  → Composable, type-safe, declarative

Lens type:
  Lens<S, A>
    get: S -> A          (get a part from the whole)
    set: (A, S) -> S     (update a part and return new whole)
```

```
┌────────────────────────────────────────────────────────┐
│  How Lenses Work                                       │
│                                                        │
│  ┌──────────────────┐                                  │
│  │  User             │                                 │
│  │  ├─ name: "Taro"  │                                 │
│  │  └─ address       │ ← addressLens                   │
│  │     ├─ city: "Osaka"│ ← cityLens                   │
│  │     └─ zip: "530"  │                                │
│  └──────────────────┘                                  │
│                                                        │
│  userCityLens = composeLens(addressLens, cityLens)     │
│                                                        │
│  get: user → "Osaka"                                   │
│  set("Tokyo", user) → new User (city: "Tokyo")         │
│  over(toUpperCase, user) → new User (city: "OSAKA")    │
│                                                        │
│  Key points:                                           │
│  - Original user object is not changed (immutable)     │
│  - Lenses can be composed                              │
│  - Type-safe (TypeScript type inference works)         │
└────────────────────────────────────────────────────────┘
```

### Code Example 6: Complete Lens Implementation

```typescript
// === Lens type and basic operations ===

interface Lens<S, A> {
  get: (s: S) => A;
  set: (a: A, s: S) => S;
}

function lens<S, A>(
  get: (s: S) => A,
  set: (a: A, s: S) => S
): Lens<S, A> {
  return { get, set };
}

// Lens composition
function composeLens<S, A, B>(outer: Lens<S, A>, inner: Lens<A, B>): Lens<S, B> {
  return {
    get: (s: S) => inner.get(outer.get(s)),
    set: (b: B, s: S) => outer.set(inner.set(b, outer.get(s)), s),
  };
}

// over: apply a function through a lens
function over<S, A>(l: Lens<S, A>, fn: (a: A) => A, s: S): S {
  return l.set(fn(l.get(s)), s);
}

// view: get a value through a lens (alias for get)
function view<S, A>(l: Lens<S, A>, s: S): A {
  return l.get(s);
}

// set: set a value through a lens
function setL<S, A>(l: Lens<S, A>, a: A, s: S): S {
  return l.set(a, s);
}

// === Auto-generating property lenses ===
function prop<S, K extends keyof S>(key: K): Lens<S, S[K]> {
  return lens(
    (s: S) => s[key],
    (a: S[K], s: S) => ({ ...s, [key]: a })
  );
}

// === Usage examples ===

interface Address {
  city: string;
  zip: string;
  country: string;
}

interface User {
  name: string;
  age: number;
  address: Address;
}

// Property lenses
const addressLens = prop<User, "address">("address");
const cityLens = prop<Address, "city">("city");
const nameLens = prop<User, "name">("name");
const ageLens = prop<User, "age">("age");

// Lens composition
const userCityLens = composeLens(addressLens, cityLens);

const user: User = {
  name: "Taro",
  age: 30,
  address: { city: "Osaka", zip: "530-0001", country: "Japan" },
};

// get
console.log(view(userCityLens, user)); // "Osaka"

// set — immutable update
const updated = setL(userCityLens, "Tokyo", user);
console.log(updated);
// { name: "Taro", age: 30, address: { city: "Tokyo", zip: "530-0001", country: "Japan" } }
console.log(user.address.city); // "Osaka" — original object is unchanged!

// over — apply a function
const uppercased = over(userCityLens, c => c.toUpperCase(), user);
console.log(uppercased.address.city); // "OSAKA"

// Compose multiple updates
const birthday = (u: User): User => {
  const aged = over(ageLens, a => a + 1, u);
  return over(nameLens, n => `${n} (age ${aged.age})`, aged);
};

console.log(birthday(user));
// { name: "Taro (age 31)", age: 31, address: { ... } }
```

### 3.2 Lens vs Immer vs Spread Syntax

| Approach | Pros | Cons | Best For |
|---|---|---|---|
| **Spread syntax** | No extra library needed, intuitive | Verbose for deep nesting | Shallow nesting (1-2 levels) |
| **Immer** | Write like mutable code, structural sharing | Runtime cost | Moderate nesting, Redux |
| **Lens** | Composable, type-safe, reusable | Learning curve, initial setup | Deep nesting, frequent updates |

```typescript
// === Comparison of the three approaches ===

const user = {
  name: "Taro",
  address: {
    city: "Osaka",
    location: {
      lat: 34.69,
      lng: 135.50,
    },
  },
};

// 1. Spread syntax — hard to read
const updated1 = {
  ...user,
  address: {
    ...user.address,
    location: {
      ...user.address.location,
      lat: 35.68, // latitude of Tokyo
    },
  },
};

// 2. Immer — intuitive but with runtime cost
import { produce } from "immer";
const updated2 = produce(user, draft => {
  draft.address.location.lat = 35.68;
});

// 3. Lens — composable and reusable
const locationLens = composeLens(
  prop<typeof user, "address">("address"),
  composeLens(
    prop<typeof user.address, "location">("location"),
    prop<typeof user.address.location, "lat">("lat")
  )
);
const updated3 = setL(locationLens, 35.68, user);
```

---

## 4. Memoization and Optimization

### 4.1 Memoization — Understanding the WHY

**WHY**: Pure functions always return the same output for the same input, so you can cache and reuse computation results. This is the fundamental principle behind memoization.

```
┌────────────────────────────────────────────────────────┐
│  How Memoization Works                                 │
│                                                        │
│  First call:                                           │
│  fibonacci(10) → compute → result 55 → store in cache  │
│                                                        │
│  Subsequent calls:                                     │
│  fibonacci(10) → cache hit → result 55 (instant)      │
│                                                        │
│  Preconditions:                                        │
│  - Must be a pure function (no side effects)           │
│  - Must be referentially transparent (same in→same out)│
│  - Argument space must be finite or have frequent reuse│
│                                                        │
│  Caution:                                              │
│  - Trade-off with memory usage                         │
│  - Use LRU cache to limit memory                       │
│  - Be careful with key generation for object arguments │
└────────────────────────────────────────────────────────┘
```

### Code Example 7: Implementing Memoization

```typescript
// === General-purpose memoization function ===

function memoize<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  keyFn: (...args: Args) => string = (...args) => JSON.stringify(args)
): (...args: Args) => R {
  const cache = new Map<string, R>();

  const memoized = (...args: Args): R => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  // Add cache management methods
  (memoized as any).cache = cache;
  (memoized as any).clear = () => cache.clear();

  return memoized;
}

// === Memoization with LRU cache ===

function memoizeLRU<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  maxSize: number = 100,
  keyFn: (...args: Args) => string = (...args) => JSON.stringify(args)
): (...args: Args) => R {
  const cache = new Map<string, R>();

  return (...args: Args): R => {
    const key = keyFn(...args);
    if (cache.has(key)) {
      const value = cache.get(key)!;
      // LRU: move to end on access
      cache.delete(key);
      cache.set(key, value);
      return value;
    }
    const result = fn(...args);
    cache.set(key, result);
    if (cache.size > maxSize) {
      // Delete the oldest entry
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return result;
  };
}

// === Memoization with TTL (time-to-live) ===

function memoizeTTL<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  ttlMs: number = 60000 // default 1 minute
): (...args: Args) => R {
  const cache = new Map<string, { value: R; expiresAt: number }>();

  return (...args: Args): R => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, expiresAt: now + ttlMs });
    return result;
  };
}

// === Usage examples ===

// 1. Fibonacci sequence
const fibonacci = memoize((n: number): number =>
  n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2)
);

console.log(fibonacci(50)); // 12586269025 — computed instantly

// 2. Expensive data transformation
const processLargeDataset = memoizeLRU(
  (data: string[], threshold: number): string[] => {
    console.log("Computing...");
    return data.filter(d => d.length > threshold).sort();
  },
  50 // cache up to 50 entries
);

const data = ["apple", "banana", "cherry", "date"];
processLargeDataset(data, 4); // Computing... → ["apple", "banana", "cherry"]
processLargeDataset(data, 4); // cache hit → ["apple", "banana", "cherry"]

// 3. Caching API responses
const fetchUserCached = memoizeTTL(
  async (userId: string) => {
    const res = await fetch(`/api/users/${userId}`);
    return res.json();
  },
  30000 // cache for 30 seconds
);
```

### Code Example 8: Memoization in Rust

```rust
use std::collections::HashMap;

// Memoization in Rust (HashMap-based)
struct Memoize<F, K, V>
where
    F: Fn(K) -> V,
    K: std::hash::Hash + Eq + Clone,
    V: Clone,
{
    func: F,
    cache: HashMap<K, V>,
}

impl<F, K, V> Memoize<F, K, V>
where
    F: Fn(K) -> V,
    K: std::hash::Hash + Eq + Clone,
    V: Clone,
{
    fn new(func: F) -> Self {
        Memoize {
            func,
            cache: HashMap::new(),
        }
    }

    fn call(&mut self, key: K) -> V {
        if let Some(value) = self.cache.get(&key) {
            return value.clone();
        }
        let value = (self.func)(key.clone());
        self.cache.insert(key, value.clone());
        value
    }
}

fn main() {
    // Memoized fibonacci (using HashMap)
    let mut fib_cache: HashMap<u64, u64> = HashMap::new();

    fn fib(n: u64, cache: &mut HashMap<u64, u64>) -> u64 {
        if let Some(&result) = cache.get(&n) {
            return result;
        }
        let result = if n <= 1 { n } else { fib(n - 1, cache) + fib(n - 2, cache) };
        cache.insert(n, result);
        result
    }

    println!("fib(50) = {}", fib(50, &mut fib_cache));
    // fib(50) = 12586269025

    // Memoized string processing
    let mut processor = Memoize::new(|s: String| {
        println!("Processing: {}", s);
        s.chars().rev().collect::<String>()
    });

    println!("{}", processor.call("hello".to_string())); // Processing: hello → "olleh"
    println!("{}", processor.call("hello".to_string())); // cache hit → "olleh"
    println!("{}", processor.call("world".to_string())); // Processing: world → "dlrow"
}
```

### 4.2 Transducers

```typescript
// === Transducers: composing transformations without intermediate arrays ===

// Problem: ordinary chaining creates an intermediate array at each step
const result1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  .filter(x => x % 2 === 0)  // [2, 4, 6, 8, 10] — intermediate array 1
  .map(x => x * 10)           // [20, 40, 60, 80, 100] — intermediate array 2
  .filter(x => x > 30);       // [40, 60, 80, 100] — intermediate array 3
// 3 array traversals, 3 intermediate arrays

// Solution: transducers compose transformations, processing in a single pass
type Reducer<A, B> = (acc: B, value: A) => B;
type Transducer<A, B> = <C>(reducer: Reducer<B, C>) => Reducer<A, C>;

function mapT<A, B>(fn: (a: A) => B): Transducer<A, B> {
  return <C>(reducer: Reducer<B, C>): Reducer<A, C> =>
    (acc, value) => reducer(acc, fn(value));
}

function filterT<A>(pred: (a: A) => boolean): Transducer<A, A> {
  return <C>(reducer: Reducer<A, C>): Reducer<A, C> =>
    (acc, value) => pred(value) ? reducer(acc, value) : acc;
}

function composeT<A, B, C>(
  t1: Transducer<A, B>,
  t2: Transducer<B, C>
): Transducer<A, C> {
  return <D>(reducer: Reducer<C, D>): Reducer<A, D> =>
    t1(t2(reducer));
}

function transduce<A, B, C>(
  transducer: Transducer<A, B>,
  reducer: Reducer<B, C>,
  initial: C,
  input: A[]
): C {
  const composed = transducer(reducer);
  return input.reduce(composed, initial);
}

// Usage example
const xform = composeT(
  filterT<number>(x => x % 2 === 0),
  composeT(
    mapT<number, number>(x => x * 10),
    filterT<number>(x => x > 30)
  )
);

const result2 = transduce(
  xform,
  (acc: number[], val: number) => [...acc, val],
  [],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
);

console.log(result2); // [40, 60, 80, 100]
// Single traversal, no intermediate arrays!
```

---

## 5. Functional Patterns in Practice

### 5.1 Functional Patterns in React/Redux

```typescript
// === React Hooks and functional patterns ===

// 1. useMemo — memoization
function ExpensiveComponent({ data, filter }: Props) {
  // Does not recompute unless data or filter changes
  const processed = useMemo(
    () => data.filter(filter).sort(compareFn).map(toDisplayItem),
    [data, filter]
  );

  return <List items={processed} />;
}

// 2. useReducer — functional model of state transitions
type Action =
  | { type: "ADD_ITEM"; payload: Item }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_ITEM"; payload: { id: string; changes: Partial<Item> } };

// Reducer is a pure function: (State, Action) → State
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.payload] };
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter(i => i.id !== action.payload),
      };
    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.payload.id ? { ...i, ...action.payload.changes } : i
        ),
      };
    default:
      return state;
  }
}

// 3. Custom hooks — function composition
function useFilteredSortedData<T>(
  data: T[],
  filterFn: (item: T) => boolean,
  sortFn: (a: T, b: T) => number,
) {
  return useMemo(() => {
    return pipe(
      data,
      (d: T[]) => d.filter(filterFn),
      (d: T[]) => [...d].sort(sortFn),
    );
  }, [data, filterFn, sortFn]);
}
```

### Code Example 9: Redux Toolkit and Functional Patterns

```typescript
// === Redux Toolkit (Immer-based) ===

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface TodoState {
  items: Todo[];
  filter: "all" | "active" | "completed";
}

const todoSlice = createSlice({
  name: "todos",
  initialState: { items: [], filter: "all" } as TodoState,
  reducers: {
    // Immer allows mutable-style writing while keeping updates immutable
    addTodo: (state, action: PayloadAction<string>) => {
      state.items.push({
        id: Date.now().toString(),
        text: action.payload,
        completed: false,
      });
    },
    toggleTodo: (state, action: PayloadAction<string>) => {
      const todo = state.items.find(t => t.id === action.payload);
      if (todo) todo.completed = !todo.completed;
    },
    setFilter: (state, action: PayloadAction<TodoState["filter"]>) => {
      state.filter = action.payload;
    },
  },
});

// Selector — derive data using pure functions
const selectFilteredTodos = (state: RootState): Todo[] => {
  const { items, filter } = state.todos;
  switch (filter) {
    case "active":
      return items.filter(t => !t.completed);
    case "completed":
      return items.filter(t => t.completed);
    default:
      return items;
  }
};

// Memoized selector (reselect pattern)
import { createSelector } from "@reduxjs/toolkit";

const selectTodos = (state: RootState) => state.todos.items;
const selectFilter = (state: RootState) => state.todos.filter;

const selectFilteredTodosMemoized = createSelector(
  [selectTodos, selectFilter],
  (todos, filter) => {
    switch (filter) {
      case "active": return todos.filter(t => !t.completed);
      case "completed": return todos.filter(t => t.completed);
      default: return todos;
    }
  }
);
```

### Code Example 10: Functional Programming with fp-ts

```typescript
// === fp-ts: a full-featured functional programming library for TypeScript ===

import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import * as A from "fp-ts/Array";
import * as TE from "fp-ts/TaskEither";

// 1. Using Option (Maybe)
const getUser = (id: string): O.Option<User> =>
  id === "1" ? O.some({ id: "1", name: "Taro", age: 30 }) : O.none;

const result1 = pipe(
  getUser("1"),
  O.map(u => u.name),
  O.map(n => n.toUpperCase()),
  O.getOrElse(() => "Unknown")
);
console.log(result1); // "TARO"

// 2. Using Either (Result)
const parseAge = (s: string): E.Either<string, number> => {
  const n = parseInt(s, 10);
  return isNaN(n) ? E.left("Invalid number") : E.right(n);
};

const validateAge = (age: number): E.Either<string, number> =>
  age >= 0 && age <= 150 ? E.right(age) : E.left("Age out of range");

const result2 = pipe(
  parseAge("25"),
  E.flatMap(validateAge),
  E.map(age => `Age: ${age}`),
  E.getOrElse(err => `Error: ${err}`)
);
console.log(result2); // "Age: 25"

// 3. Array operations
const users: User[] = [
  { id: "1", name: "Taro", age: 30 },
  { id: "2", name: "Hanako", age: 17 },
  { id: "3", name: "Jiro", age: 25 },
];

const adultNames = pipe(
  users,
  A.filter((u: User) => u.age >= 18),
  A.map((u: User) => u.name),
  A.sort({ compare: (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0, equals: (a, b) => a === b }),
);
console.log(adultNames); // ["Jiro", "Taro"]

// 4. TaskEither (async + error handling)
const fetchUser = (id: string): TE.TaskEither<Error, User> =>
  TE.tryCatch(
    () => fetch(`/api/users/${id}`).then(r => r.json()),
    (err) => new Error(`Failed to fetch user: ${err}`)
  );

const fetchOrders = (userId: string): TE.TaskEither<Error, Order[]> =>
  TE.tryCatch(
    () => fetch(`/api/orders?user=${userId}`).then(r => r.json()),
    (err) => new Error(`Failed to fetch orders: ${err}`)
  );

// Compose using a pipeline
const getUserWithOrders = (userId: string) =>
  pipe(
    fetchUser(userId),
    TE.flatMap(user =>
      pipe(
        fetchOrders(user.id),
        TE.map(orders => ({ user, orders }))
      )
    )
  );
```

---

## Functional Pattern Comparison Table

| Pattern | Purpose | TypeScript Implementation | Rust Implementation | Haskell |
|---|---|---|---|---|
| **Currying** | Reuse functions via partial application | arrow function / curry() | Closures | Default |
| **Pipeline** | Declarative description of data transformation | pipe() function | Method chaining | `$` / `|>` |
| **Lens** | Partial updates to immutable data | Manual / Ramda | None (managed via ownership) | lens package |
| **Memoization** | Cache computation results | Map / useMemo | HashMap | MVar / IORef |
| **Transducer** | Compose transformations without intermediate arrays | reduce-based | Iterator adapters | conduit |
| **Pattern matching** | Destructure and branch on data structures | Type guards / switch | match expression | case / pattern |
| **Railway** | Error handling pipeline | Result type | Result<T, E> | Either |

### Functional vs Imperative Comparison Table

| Aspect | Functional | Imperative |
|---|---|---|
| **State management** | Immutable data + return new values | Directly mutate mutable variables |
| **Control flow** | Recursion, higher-order functions, pipelines | Loops, conditionals |
| **Side effects** | Isolated and managed (IO monad, etc.) | Can occur anywhere |
| **Testability** | High (referential transparency, pure functions) | Low (state-dependent, requires mocks) |
| **Concurrency** | Safe (no shared state) | Dangerous (race conditions) |
| **Debugging** | Easy to trace values | Difficult to trace state |
| **Performance** | GC-dependent, improved with structural sharing | Fast via direct memory manipulation |
| **Learning curve** | High (many abstract concepts) | Low (intuitive) |

---

## Anti-Patterns

### 1. Excessive Point-Free Style

```typescript
// [NG] Omitting argument names too aggressively, severely hurting readability
const process = pipe(
  filter(propEq("active", true)),
  map(pick(["id", "name"])),
  sortBy(prop("name"))
);
// Hard to tell what is being processed
// Hard to debug which step caused an issue

// [OK] Use descriptive names to clarify intent
const getActiveUserNames = (users: User[]) =>
  users
    .filter(u => u.active)
    .map(u => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
// Argument names make it immediately clear what is being processed
```

### 2. Inappropriate Memoization

```typescript
// [NG] Memoizing a function with side effects
const badMemo = memoize((url: string) => {
  console.log(`Fetching: ${url}`);  // Side effect!
  return fetch(url).then(r => r.json());
});
// console.log won't run on the second call → incomplete logs

// [NG] Memoizing a function with a huge argument space
const badMemo2 = memoize((data: number[]) => {
  return data.reduce((a, b) => a + b, 0);
});
// Different arrays passed every time → cache never hits, only consumes memory

// [OK] Memoize pure functions + limit memory with LRU
const goodMemo = memoizeLRU(
  (n: number): number => {
    // Expensive computation (no side effects)
    return fibonacci(n);
  },
  1000 // up to 1000 entries
);
```

### 3. Unnecessary Immutability Enforcement

```typescript
// [NG] Creating a new array on every iteration (performance issue)
function buildLargeArray(n: number): number[] {
  let result: number[] = [];
  for (let i = 0; i < n; i++) {
    result = [...result, i]; // O(n) copy repeated n times = O(n²)
  }
  return result;
}

// [OK] Allow mutation within local scope, return the result as immutable
function buildLargeArrayGood(n: number): readonly number[] {
  const result: number[] = []; // mutable locally
  for (let i = 0; i < n; i++) {
    result.push(i); // O(1) push repeated n times = O(n)
  }
  return result; // return as immutable readonly
}
```

---

## Practice Exercises

### Exercise 1 (Beginner): Implement Currying and Pipelines

**Task**: Implement functions that satisfy the following requirements.

1. Implement `curry2` and `curry3`
2. Implement a `pipe` function (2–5 steps)
3. Compose curried functions in a pipeline to build a string transformation pipeline

```typescript
// TODO: implement curry2 and curry3

// TODO: implement pipe

// Test cases
const trim = (s: string) => s.trim();
const toLower = (s: string) => s.toLowerCase();
const addPrefix = curry2((prefix: string, s: string) => `${prefix}${s}`);

const normalizeEmail = pipe(trim, toLower, addPrefix("mailto:"));

console.log(normalizeEmail("  TARO@Example.COM  "));
// "mailto:taro@example.com"
```

**Expected output**:

```
normalizeEmail("  TARO@Example.COM  ") = "mailto:taro@example.com"
```

### Exercise 2 (Intermediate): Immutable Data Updates with Lenses

**Task**: Use the lens pattern to implement immutable updates for a nested data structure.

Requirements:
1. Implement `lens`, `composeLens`, `over`, and `prop`
2. Perform lens-based operations on the following data structure
3. Verify in tests that the original object has not been modified

```typescript
interface Company {
  name: string;
  ceo: {
    name: string;
    address: {
      city: string;
      country: string;
    };
  };
  employees: number;
}

// TODO: implement lenses

// Test cases
const company: Company = {
  name: "TechCorp",
  ceo: {
    name: "Taro Yamada",
    address: { city: "Tokyo", country: "Japan" },
  },
  employees: 500,
};

// Update the CEO's city
const updated = setL(ceoCityLens, "Osaka", company);
console.log(updated.ceo.address.city); // "Osaka"
console.log(company.ceo.address.city); // "Tokyo" ← original is unchanged
```

**Expected output**:

```
Updated: Osaka
Original: Tokyo (unchanged)
Uppercased via over: TOKYO
```

### Exercise 3 (Advanced): Implementing Railway Oriented Programming

**Task**: Implement the Result type and a Railway pipeline to build an order processing flow for an e-commerce site.

Requirements:
1. Implement the `Result<E, A>` type along with `ok`, `err`, and `flatMapR`
2. Implement the following processing steps as functions returning Result:
   - `validateOrder`: validate order contents
   - `checkStock`: check inventory
   - `calculatePrice`: calculate price (apply discounts)
   - `processPayment`: handle payment
   - `createShipment`: arrange shipping
3. Compose all steps using a railway pipeline
4. Verify that errors from each step propagate correctly

```typescript
// TODO: implement Result type and Railway pipeline

// Test cases
const result1 = processOrder({
  items: [{ productId: "p1", quantity: 2 }],
  paymentMethod: "credit_card",
  shippingAddress: "Tokyo",
});
// Expected: Ok({ orderId: "...", status: "shipped", ... })

const result2 = processOrder({
  items: [],
  paymentMethod: "credit_card",
  shippingAddress: "Tokyo",
});
// Expected: Err({ step: "validation", message: "Order contains no items" })
```

**Expected output**:

```
Test 1 (valid order):
  Ok: { orderId: "order_...", status: "shipped", total: 5000 }

Test 2 (empty order):
  Err: { step: "validation", message: "Order contains no items" }

Test 3 (out of stock):
  Err: { step: "stock", message: "Insufficient stock for product p99" }
```

---

## FAQ

### Q1: Is currying practical in JavaScript/TypeScript?

**A**: Partial application is very practical, but full currying can conflict with TypeScript's type inference in some cases. Practical approaches include:

- Use `curry` from `lodash/fp` or `ramda`
- Manual partial application with arrow functions: `const double = multiply(2);`
- TypeScript 5.x and later improved type inference for currying via const type parameters

The key is to "use partial application only where it's needed." There is no need to curry every function.

### Q2: Can I use the pipeline operator (`|>`)?

**A**: It is progressing as a TC39 proposal (Stage 2) for JavaScript, but as of 2026 it has not been standardized. Alternatives include:

1. `pipe()` utility functions (fp-ts, ramda, etc.)
2. Method chaining (Array.map().filter(), etc.)
3. Early adoption via Babel plugin (not recommended for production)

### Q3: Do I need Immutable.js or Immer?

**A**: It depends on the scale and complexity of your project:

- **Small scale (shallow nesting)**: Spread syntax is sufficient
- **Medium scale (using Redux)**: Immer is recommended (built into Redux Toolkit)
- **Large scale (deep nesting, frequent updates)**: Lens pattern or Immer
- **Immutable.js**: Efficient immutable data via structural sharing, but has conversion costs to/from plain JS

### Q4: Doesn't functional programming have poor performance?

**A**: In typical web applications, the performance difference is negligible. Immutable updates have object copy costs, but the following optimizations are possible:

- **Structural sharing**: Immer and Immutable.js share unchanged parts
- **Memoization**: Avoid recomputation for speed
- **Lazy evaluation**: Delay computation until needed
- **Transducers**: Reduce intermediate arrays

Performance only becomes a real concern for repeated processing of large data volumes or real-time processing scenarios.

### Q5: How do I introduce functional patterns incrementally?

**A**: Introducing them in the following order is effective:

1. **Immutability**: Use `const`, spread syntax, `Array.map/filter/reduce`
2. **Pure functions**: Consciously write functions without side effects
3. **Pipelines**: Describe data transformations as pipelines
4. **Result/Option**: Make null checks and error handling type-safe
5. **Lenses/Memoization**: Introduce advanced patterns as needed

There is no need to introduce everything at once.

### Q6: Can OOP and functional programming coexist?

**A**: Yes, many modern languages (TypeScript, Kotlin, Scala, Rust) support both paradigms. Practical guidelines:

- **Data transformation**: functional (map, filter, pipe)
- **State encapsulation**: OOP (classes, modules)
- **Side effect management**: functional (pure functions + isolating side effects)
- **Abstraction**: both (interfaces + higher-order functions)

---

## Summary

| Topic | Key Points |
|---|---|
| Currying | Transform a function to accept one argument at a time. Improves reusability via partial application |
| Partial application | Generate a new function with some arguments fixed. Useful for injecting configuration values |
| Pipeline | Describe data transformations declaratively. Improves readability and maintainability |
| compose | Function composition from right to left. Mathematical composition order |
| pipe | Function composition from left to right. Natural data flow |
| Railway | Error-handling pipeline using the Result type |
| Lens | Enable composable partial read/write of immutable data structures |
| Memoization | Cache results of pure functions. Avoid recomputation |
| Transducer | Compose transformations without intermediate arrays. Improves memory efficiency and speed |
| Middleware | Separation of cross-cutting concerns via function composition |
| Practical guideline | Balance with readability is key. Incremental adoption is best |

---

## Guides to Read Next

- [Monad](./00-monad.md) — A more advanced abstraction for function composition
- [Functor & Applicative](./01-functor-applicative.md) — Theoretical foundation of map and ap
- Clean Code Principles — Basics of writing readable code
- [Behavioral Patterns](../02-behavioral/) — Comparison with OOP patterns
- [Architectural Patterns](../04-architectural/) — Functional approaches in large-scale design

---

## References

1. **Eric Elliott**: [Composing Software](https://medium.com/javascript-scene/composing-software-an-introduction-27b72500d6ea) — A practical series on functional programming in JavaScript
2. **Brian Lonsdorf**: [Professor Frisby's Mostly Adequate Guide](https://mostly-adequate.gitbook.io/mostly-adequate-guide/) — An introductory guide to functional programming (JavaScript-based)
3. **Ramda Documentation**: [Ramda](https://ramdajs.com/) — A functional utility library for JavaScript. Rich in practical examples of currying and pipelines
4. **Giulio Canti**: [fp-ts](https://gcanti.github.io/fp-ts/) — A full-featured functional programming library for TypeScript
5. **Scott Wlaschin**: [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/) — A functional approach to error handling. Written in F# but the concepts are language-agnostic
