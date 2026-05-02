# Monad

> Understand monad patterns such as Maybe/Either, IO, and Promise to build composable data flows while controlling side effects

## What You Will Learn

1. **The essence of monads** --- Why chaining computations via bind (flatMap) and transforming values within a context is necessary
2. **Practical monads** --- Concrete implementations and usage of Maybe/Option, Either/Result, Promise/Future, IO, List, and Reader
3. **Monad laws** --- The meaning and verification of the three laws (left identity, right identity, associativity)
4. **Railway-oriented programming** --- Designing error-handling pipelines using Either/Result
5. **Monad composition** --- Monad transformers, do-notation, and their relationship with async/await

---

## Prerequisites

| Topic | Required Level | Reference |
|---|---|---|
| TypeScript generics | Defining generics for classes and functions | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/generics.html) |
| Higher-order functions | Understanding map, filter, reduce | [Functional Patterns](./02-fp-patterns.md) |
| Promise/async-await | Basics of asynchronous processing | [MDN Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) |
| Algebraic data types | Union types, discriminated unions | [TypeScript Union Types](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) |
| Functor concept | Meaning of map | [Functor and Applicative](./01-functor-applicative.md) |

---

## WHY --- Why Are Monads Necessary?

### Problem: Explosion of Side Effects and Branches

In real programs, every operation comes with a context: "this might fail," "this value might not exist," or "this might be asynchronous." Handling these naively leads to an explosion of null checks, error handling, and nested callbacks.

```
Problem: Chaining computations with context
====================================

[Naive implementation --- explosion of nesting]

  getUser(id) ──→ null check ──→ getAddress(user) ──→ null check ──→ getCity(addr)
                    |                                      |
                    v                                      v
                  return default                        return default

  fetchUser(id) ──→ try/catch ──→ fetchOrders(user) ──→ try/catch ──→ process(orders)
                      |                                    |
                      v                                    v
                    handleError                          handleError

  // Nesting hell
  if (user != null) {
    if (user.address != null) {
      if (user.address.city != null) {
        // Finally, the actual logic
      }
    }
  }

[Solution with monads --- flat composition]

  Maybe.of(user)
    .flatMap(u => Maybe.fromNullable(u.address))
    .flatMap(a => Maybe.fromNullable(a.city))
    .getOrElse("Unknown")

  // Each step automatically skips if "failed"
  // No nesting. Linear. Composable.
```

### Solution: Composable Computation Within a Context

A monad is an abstraction that provides **composable chains of computation** over **values with context**.

- **Maybe/Option**: The context of "a value might not exist." Skip if null
- **Either/Result**: The context of "this might fail." Skip if there is an error
- **Promise/Future**: The context of "not yet complete." Execute next after completion
- **IO**: The context of "has side effects." Defer execution and compose
- **List/Array**: The context of "multiple values." Apply to each element and flatten
- **Reader**: The context of "depends on an environment." Thread dependencies implicitly

All monads share the same interface (`unit` + `bind`) and follow the same laws. This uniformity allows computations from different contexts to be handled with the same pattern.

---

## Definition of a Monad

From Philip Wadler (1992) "Monads for functional programming":

> A monad is a triple (M, unit, bind) where M is a type constructor, unit lifts a value into the monadic context, and bind sequences computations within the context.

```
Components of a Monad
==================

  Type constructor M:
    Converts a normal type T into a "contextual type" M<T>

  unit (return, of, pure):
    T  --->  M<T>
    Places a value into the context. No side effects.

  bind (flatMap, >>=, then, and_then):
    M<T>  --->  (T -> M<U>)  --->  M<U>
    Extracts the value from the context, passes it to the next computation, and flattens the result.

  * Difference from map:
    map  : M<T> -> (T ->   U ) -> M<U>    (transforms the value)
    bind : M<T> -> (T -> M<U>) -> M<U>    (transforms the context)

  map can be defined in terms of bind + unit:
    m.map(f) === m.bind(x => unit(f(x)))

Monad Laws
=======================

  1. Left Identity:
     unit(a).bind(f) === f(a)
     "bind after putting a value into context" = "pass directly to the function"

  2. Right Identity:
     m.bind(unit) === m
     "extract the value from context and put it back with unit" = "do nothing"

  3. Associativity:
     m.bind(f).bind(g) === m.bind(x => f(x).bind(g))
     "bind left to right" = "bind with nesting"

  Diagram:
    value a  --[unit]--> M<a>  --[bind(f)]--> M<b>  --[bind(g)]--> M<c>

  These laws guarantee that monads behave consistently
  regardless of the order of composition.
```

---

## Code Example 1: Maybe/Option Monad --- Full Implementation

```typescript
// =============================================================
// Maybe Monad: Chaining null-safe computations
// =============================================================

class Maybe<T> {
  private constructor(private readonly value: T | null) {}

  // --- unit (return, of) ---
  static of<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  static nothing<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  static fromNullable<T>(value: T | null | undefined): Maybe<T> {
    return value == null ? Maybe.nothing() : Maybe.of(value);
  }

  // --- map (Functor) ---
  map<U>(fn: (value: T) => U): Maybe<U> {
    return this.value == null ? Maybe.nothing() : Maybe.of(fn(this.value));
  }

  // --- bind (flatMap) ---
  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    return this.value == null ? Maybe.nothing() : fn(this.value);
  }

  // --- apply (Applicative) ---
  apply<U>(maybeFn: Maybe<(value: T) => U>): Maybe<U> {
    return maybeFn.flatMap(fn => this.map(fn));
  }

  // --- Utilities ---
  getOrElse(defaultValue: T): T {
    return this.value ?? defaultValue;
  }

  getOrThrow(message: string): T {
    if (this.value == null) throw new Error(message);
    return this.value;
  }

  filter(predicate: (value: T) => boolean): Maybe<T> {
    if (this.value == null) return Maybe.nothing();
    return predicate(this.value) ? this : Maybe.nothing();
  }

  isNothing(): boolean {
    return this.value == null;
  }

  isJust(): boolean {
    return this.value != null;
  }

  // Pattern matching
  match<U>(patterns: { just: (value: T) => U; nothing: () => U }): U {
    return this.value != null ? patterns.just(this.value) : patterns.nothing();
  }

  // For debugging (insert side effect while maintaining the chain)
  tap(fn: (value: T) => void): Maybe<T> {
    if (this.value != null) fn(this.value);
    return this;
  }

  toString(): string {
    return this.value != null ? `Just(${this.value})` : "Nothing";
  }
}

// =============================================================
// Verification of Monad Laws
// =============================================================
const f = (x: number) => Maybe.of(x * 2);
const g = (x: number) => (x > 0 ? Maybe.of(x + 1) : Maybe.nothing<number>());

// Left Identity: unit(a).bind(f) === f(a)
console.log(Maybe.of(5).flatMap(f).toString());  // Just(10)
console.log(f(5).toString());                     // Just(10)

// Right Identity: m.bind(unit) === m
console.log(Maybe.of(5).flatMap(Maybe.of).toString());  // Just(5)
console.log(Maybe.of(5).toString());                     // Just(5)

// Associativity: m.bind(f).bind(g) === m.bind(x => f(x).bind(g))
const m = Maybe.of(3);
console.log(m.flatMap(f).flatMap(g).toString());              // Just(7)
console.log(m.flatMap(x => f(x).flatMap(g)).toString());      // Just(7)

// =============================================================
// Practical usage: Safe traversal of nested objects
// =============================================================
interface Company {
  name: string;
  ceo?: {
    name: string;
    address?: {
      city?: string;
      country?: string;
    };
  };
}

function getCeoCity(company: Company | null): string {
  return Maybe.fromNullable(company)
    .flatMap(c => Maybe.fromNullable(c.ceo))
    .flatMap(ceo => Maybe.fromNullable(ceo.address))
    .flatMap(addr => Maybe.fromNullable(addr.city))
    .getOrElse("Unknown");
}

// Tests
const company1: Company = {
  name: "Acme",
  ceo: { name: "Alice", address: { city: "Tokyo", country: "JP" } }
};
const company2: Company = { name: "Beta" };
const company3: Company = { name: "Gamma", ceo: { name: "Bob" } };

console.log(getCeoCity(company1));  // "Tokyo"
console.log(getCeoCity(company2));  // "Unknown" (no ceo)
console.log(getCeoCity(company3));  // "Unknown" (no address)
console.log(getCeoCity(null));      // "Unknown" (no company)

// =============================================================
// Maybe + Array: Safe search
// =============================================================
function findFirst<T>(
  items: T[],
  predicate: (item: T) => boolean
): Maybe<T> {
  const found = items.find(predicate);
  return Maybe.fromNullable(found);
}

interface Product {
  id: number;
  name: string;
  discount?: number;
}

const products: Product[] = [
  { id: 1, name: "Widget", discount: 0.1 },
  { id: 2, name: "Gadget" },
  { id: 3, name: "Doohickey", discount: 0.25 },
];

// Safely calculate the discounted price
function getDiscountedPrice(
  products: Product[],
  productId: number,
  basePrice: number
): Maybe<number> {
  return findFirst(products, p => p.id === productId)
    .flatMap(product => Maybe.fromNullable(product.discount))
    .map(discount => basePrice * (1 - discount));
}

console.log(getDiscountedPrice(products, 1, 100).toString());  // Just(90)
console.log(getDiscountedPrice(products, 2, 100).toString());  // Nothing (no discount)
console.log(getDiscountedPrice(products, 9, 100).toString());  // Nothing (no product)
```

---

## Code Example 2: Either/Result Monad --- Railway-Oriented Programming

```typescript
// =============================================================
// Either Monad: Type-safe error handling
// =============================================================

type Either<L, R> =
  | { readonly tag: "Left"; readonly value: L }
  | { readonly tag: "Right"; readonly value: R };

// --- Constructors ---
const Left = <L, R = never>(value: L): Either<L, R> => ({
  tag: "Left",
  value,
});
const Right = <R, L = never>(value: R): Either<L, R> => ({
  tag: "Right",
  value,
});

// --- Monad operations (functional style) ---
const EitherM = {
  // unit
  of<R>(value: R): Either<never, R> {
    return Right(value);
  },

  // map (Functor)
  map<L, R, U>(either: Either<L, R>, fn: (r: R) => U): Either<L, U> {
    return either.tag === "Right" ? Right(fn(either.value)) : either;
  },

  // bind (flatMap)
  flatMap<L, R, U>(
    either: Either<L, R>,
    fn: (r: R) => Either<L, U>
  ): Either<L, U> {
    return either.tag === "Right" ? fn(either.value) : either;
  },

  // mapLeft: transform the error side
  mapLeft<L, R, U>(either: Either<L, R>, fn: (l: L) => U): Either<U, R> {
    return either.tag === "Left" ? Left(fn(either.value)) : either;
  },

  // bimap: transform both sides
  bimap<L, R, U, V>(
    either: Either<L, R>,
    leftFn: (l: L) => U,
    rightFn: (r: R) => V
  ): Either<U, V> {
    return either.tag === "Left"
      ? Left(leftFn(either.value))
      : Right(rightFn(either.value));
  },

  // fold (pattern matching)
  fold<L, R, U>(
    either: Either<L, R>,
    onLeft: (l: L) => U,
    onRight: (r: R) => U
  ): U {
    return either.tag === "Left"
      ? onLeft(either.value)
      : onRight(either.value);
  },

  // tryCatch: convert exceptions to Either
  tryCatch<R>(fn: () => R): Either<Error, R> {
    try {
      return Right(fn());
    } catch (e) {
      return Left(e instanceof Error ? e : new Error(String(e)));
    }
  },

  // fromNullable: convert null/undefined to Left
  fromNullable<L, R>(
    value: R | null | undefined,
    error: L
  ): Either<L, R> {
    return value == null ? Left(error) : Right(value);
  },

  // Combine multiple Eithers (succeeds only if all are Right)
  sequence<L, R>(eithers: Either<L, R>[]): Either<L, R[]> {
    const results: R[] = [];
    for (const either of eithers) {
      if (either.tag === "Left") return either;
      results.push(either.value);
    }
    return Right(results);
  },
};

// =============================================================
// Railway-oriented programming: Validation pipeline
// =============================================================

// Structured error type
interface ValidationError {
  field: string;
  message: string;
  code: string;
}

const vError = (
  field: string,
  message: string,
  code: string
): ValidationError => ({ field, message, code });

// Each validation function returns an Either
function validateEmail(
  email: string
): Either<ValidationError, string> {
  if (!email.includes("@")) {
    return Left(vError("email", "Must contain @", "INVALID_EMAIL"));
  }
  if (email.length < 5) {
    return Left(vError("email", "Too short", "EMAIL_TOO_SHORT"));
  }
  return Right(email.toLowerCase().trim());
}

function validatePassword(
  password: string
): Either<ValidationError, string> {
  if (password.length < 8) {
    return Left(vError("password", "Min 8 chars", "PASSWORD_TOO_SHORT"));
  }
  if (!/[A-Z]/.test(password)) {
    return Left(vError("password", "Need uppercase", "PASSWORD_NO_UPPER"));
  }
  if (!/[0-9]/.test(password)) {
    return Left(vError("password", "Need digit", "PASSWORD_NO_DIGIT"));
  }
  return Right(password);
}

function validateAge(age: number): Either<ValidationError, number> {
  if (!Number.isInteger(age)) {
    return Left(vError("age", "Must be integer", "AGE_NOT_INTEGER"));
  }
  if (age < 13 || age > 120) {
    return Left(vError("age", "Must be 13-120", "AGE_OUT_OF_RANGE"));
  }
  return Right(age);
}

function validateUsername(
  name: string
): Either<ValidationError, string> {
  if (name.length < 3) {
    return Left(vError("username", "Min 3 chars", "USERNAME_TOO_SHORT"));
  }
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return Left(vError("username", "Alphanumeric only", "USERNAME_INVALID"));
  }
  return Right(name);
}

// --- Railway: stop at first error ---
interface RegistrationInput {
  username: string;
  email: string;
  password: string;
  age: number;
}

interface ValidatedUser {
  username: string;
  email: string;
  password: string;
  age: number;
}

function validateRegistration(
  input: RegistrationInput
): Either<ValidationError, ValidatedUser> {
  // The entire pipeline becomes Left when any step returns Left
  const username = validateUsername(input.username);
  const email = EitherM.flatMap(username, () => validateEmail(input.email));
  const password = EitherM.flatMap(email, () => validatePassword(input.password));
  const age = EitherM.flatMap(password, () => validateAge(input.age));

  return EitherM.map(age, () => ({
    username: input.username,
    email: input.email.toLowerCase().trim(),
    password: input.password,
    age: input.age,
  }));
}

// Tests
const good = validateRegistration({
  username: "alice",
  email: "alice@example.com",
  password: "Secret123",
  age: 25,
});
console.log(good);
// { tag: "Right", value: { username: "alice", email: "alice@example.com", ... } }

const bad = validateRegistration({
  username: "al",
  email: "alice@example.com",
  password: "Secret123",
  age: 25,
});
console.log(bad);
// { tag: "Left", value: { field: "username", message: "Min 3 chars", code: "USERNAME_TOO_SHORT" } }

// --- Railway: collect all errors (Validation monad) ---
function validateAllErrors(
  input: RegistrationInput
): Either<ValidationError[], ValidatedUser> {
  const results = [
    EitherM.mapLeft(validateUsername(input.username), e => [e]),
    EitherM.mapLeft(validateEmail(input.email), e => [e]),
    EitherM.mapLeft(validatePassword(input.password), e => [e]),
    EitherM.mapLeft(validateAge(input.age), e => [e]),
  ];

  const errors: ValidationError[] = [];
  for (const result of results) {
    if (result.tag === "Left") {
      errors.push(...result.value);
    }
  }

  if (errors.length > 0) return Left(errors);

  return Right({
    username: input.username,
    email: input.email.toLowerCase().trim(),
    password: input.password,
    age: input.age,
  });
}

const allBad = validateAllErrors({
  username: "al",
  email: "bad",
  password: "weak",
  age: 5,
});
console.log(allBad);
// { tag: "Left", value: [
//   { field: "username", message: "Min 3 chars", ... },
//   { field: "email", message: "Must contain @", ... },
//   { field: "password", message: "Min 8 chars", ... },
//   { field: "age", message: "Must be 13-120", ... }
// ] }
```

---

## Code Example 3: Result Monad --- TypeScript Type-Safe Implementation

```typescript
// =============================================================
// Result<T, E>: Rust-style type-safe error handling
// =============================================================

class Result<T, E> {
  private constructor(
    private readonly _ok: boolean,
    private readonly _value: T | undefined,
    private readonly _error: E | undefined
  ) {}

  static ok<T, E = never>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static err<E, T = never>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  static fromTryCatch<T>(fn: () => T): Result<T, Error> {
    try {
      return Result.ok(fn());
    } catch (e) {
      return Result.err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  static async fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
    try {
      return Result.ok(await promise);
    } catch (e) {
      return Result.err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  isOk(): boolean {
    return this._ok;
  }

  isErr(): boolean {
    return !this._ok;
  }

  // --- Functor ---
  map<U>(fn: (value: T) => U): Result<U, E> {
    return this._ok
      ? Result.ok(fn(this._value as T))
      : Result.err(this._error as E);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return this._ok
      ? Result.ok(this._value as T)
      : Result.err(fn(this._error as E));
  }

  // --- Monad ---
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this._ok
      ? fn(this._value as T)
      : Result.err(this._error as E);
  }

  // --- Value extraction ---
  unwrap(): T {
    if (!this._ok) throw new Error("Called unwrap on Err");
    return this._value as T;
  }

  unwrapOr(defaultValue: T): T {
    return this._ok ? (this._value as T) : defaultValue;
  }

  unwrapOrElse(fn: (error: E) => T): T {
    return this._ok ? (this._value as T) : fn(this._error as E);
  }

  unwrapErr(): E {
    if (this._ok) throw new Error("Called unwrapErr on Ok");
    return this._error as E;
  }

  // --- Pattern matching ---
  match<U>(patterns: { ok: (value: T) => U; err: (error: E) => U }): U {
    return this._ok
      ? patterns.ok(this._value as T)
      : patterns.err(this._error as E);
  }

  // --- Composition ---
  and<U>(other: Result<U, E>): Result<U, E> {
    return this._ok ? other : Result.err(this._error as E);
  }

  or(other: Result<T, E>): Result<T, E> {
    return this._ok ? this : other;
  }

  // --- Conversion ---
  toMaybe(): Maybe<T> {
    return this._ok ? Maybe.of(this._value as T) : Maybe.nothing();
  }

  toString(): string {
    return this._ok
      ? `Ok(${JSON.stringify(this._value)})`
      : `Err(${JSON.stringify(this._error)})`;
  }
}

// =============================================================
// Practical example: JSON parse -> validation -> business logic
// =============================================================

interface Config {
  host: string;
  port: number;
  maxRetries: number;
}

function parseJson(raw: string): Result<unknown, string> {
  return Result.fromTryCatch(() => JSON.parse(raw))
    .mapErr(e => `JSON parse error: ${e.message}`);
}

function validateConfig(data: unknown): Result<Config, string> {
  if (typeof data !== "object" || data === null) {
    return Result.err("Config must be an object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.host !== "string") {
    return Result.err("host must be a string");
  }
  if (typeof obj.port !== "number" || obj.port < 1 || obj.port > 65535) {
    return Result.err("port must be 1-65535");
  }
  if (typeof obj.maxRetries !== "number" || obj.maxRetries < 0) {
    return Result.err("maxRetries must be non-negative");
  }
  return Result.ok({
    host: obj.host as string,
    port: obj.port as number,
    maxRetries: obj.maxRetries as number,
  });
}

function normalizeConfig(config: Config): Result<Config, string> {
  if (config.host === "localhost") {
    return Result.ok({ ...config, host: "127.0.0.1" });
  }
  if (config.host.length === 0) {
    return Result.err("host cannot be empty");
  }
  return Result.ok(config);
}

// Chaining flatMap = railway-oriented pipeline
function loadConfig(raw: string): Result<Config, string> {
  return parseJson(raw)
    .flatMap(validateConfig)
    .flatMap(normalizeConfig);
}

// Tests
console.log(loadConfig('{"host":"localhost","port":8080,"maxRetries":3}').toString());
// Ok({"host":"127.0.0.1","port":8080,"maxRetries":3})

console.log(loadConfig('{"host":"","port":8080,"maxRetries":3}').toString());
// Err("host cannot be empty")

console.log(loadConfig("not json").toString());
// Err("JSON parse error: ...")

console.log(loadConfig('{"host":"example.com","port":99999,"maxRetries":3}').toString());
// Err("port must be 1-65535")
```

---

## Code Example 4: IO Monad and Promise

```typescript
// =============================================================
// IO Monad: Deferred execution and composition of side effects
// =============================================================

// IO treats "computations with side effects" as values
// Side effects do not occur until execution (preserving referential transparency)
class IO<T> {
  constructor(private readonly effect: () => T) {}

  // --- unit ---
  static of<T>(value: T): IO<T> {
    return new IO(() => value);
  }

  // --- Functor ---
  map<U>(fn: (value: T) => U): IO<U> {
    return new IO(() => fn(this.effect()));
  }

  // --- Monad ---
  flatMap<U>(fn: (value: T) => IO<U>): IO<U> {
    return new IO(() => fn(this.effect()).run());
  }

  // Execute the side effect
  run(): T {
    return this.effect();
  }

  // Run two IOs sequentially
  andThen<U>(next: IO<U>): IO<U> {
    return this.flatMap(() => next);
  }

  // For debugging
  tap(fn: (value: T) => void): IO<T> {
    return new IO(() => {
      const result = this.effect();
      fn(result);
      return result;
    });
  }
}

// --- IO utilities ---
const ConsoleIO = {
  log(message: string): IO<void> {
    return new IO(() => console.log(message));
  },
  readLine(prompt: string): IO<string> {
    // Actual readline implementation is omitted
    return new IO(() => {
      console.log(prompt);
      return "simulated-input";
    });
  },
  currentTime(): IO<Date> {
    return new IO(() => new Date());
  },
  randomInt(min: number, max: number): IO<number> {
    return new IO(() => Math.floor(Math.random() * (max - min + 1)) + min);
  },
};

// =============================================================
// IO composition: Describe an entire program purely
// =============================================================

// This program definition itself is pure (no side effects)
const greetProgram: IO<void> = ConsoleIO.currentTime()
  .map(date => date.toISOString())
  .flatMap(time =>
    ConsoleIO.log(`[${time}] Hello!`)
      .andThen(ConsoleIO.log(`[${time}] Welcome to IO Monad`))
  );

// Nothing happens until run() is called
// greetProgram.run();  // Side effects only occur at execution time

// =============================================================
// Comparison: IO vs direct side effects
// =============================================================

// [NG] Direct side effects --- hard to test
function greetDirect(): void {
  const time = new Date().toISOString();  // side effect: current time
  console.log(`[${time}] Hello!`);        // side effect: console output
  console.log(`[${time}] Welcome`);       // side effect: console output
}

// [OK] IO monad --- testable
function greetIO(
  getTime: () => IO<Date>,
  log: (msg: string) => IO<void>
): IO<void> {
  return getTime()
    .map(date => date.toISOString())
    .flatMap(time =>
      log(`[${time}] Hello!`)
        .andThen(log(`[${time}] Welcome`))
    );
}

// During testing: inject mock IOs
const logs: string[] = [];
const mockGetTime = () => IO.of(new Date("2025-01-01T00:00:00Z"));
const mockLog = (msg: string) => new IO(() => { logs.push(msg); });

greetIO(mockGetTime, mockLog).run();
console.log(logs);
// ["[2025-01-01T00:00:00.000Z] Hello!", "[2025-01-01T00:00:00.000Z] Welcome"]

// =============================================================
// Promise = asynchronous IO monad
// async/await = syntactic sugar for do-notation
// =============================================================

// Monadic nature of Promise
// then = flatMap (bind)
// Promise.resolve = unit

// [Monadic style (then chain)]
function fetchUserOrdersChain(userId: string): Promise<OrderSummary> {
  return fetchUser(userId)                                // Promise<User>
    .then(user => fetchOrders(user.id))                   // flatMap: User -> Promise<Order[]>
    .then(orders => orders.filter(o => o.active))         // map: Order[] -> Order[]
    .then(orders => ({
      userId,
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, o) => sum + o.amount, 0),
    }));
}

// [do-notation style (async/await)]
async function fetchUserOrdersAwait(userId: string): Promise<OrderSummary> {
  const user = await fetchUser(userId);                    // bind
  const orders = await fetchOrders(user.id);               // bind
  const activeOrders = orders.filter(o => o.active);       // pure computation

  return {                                                 // unit (return)
    userId,
    totalOrders: activeOrders.length,
    totalAmount: activeOrders.reduce((sum, o) => sum + o.amount, 0),
  };
}

// Type definitions (for the code above)
interface OrderSummary {
  userId: string;
  totalOrders: number;
  totalAmount: number;
}

declare function fetchUser(id: string): Promise<{ id: string; name: string }>;
declare function fetchOrders(userId: string): Promise<Array<{ active: boolean; amount: number }>>;
```

---

## Code Example 5: List Monad and Reader Monad

```typescript
// =============================================================
// List Monad: Non-deterministic computation
// flatMap = apply a function to each element and flatten
// =============================================================

// Array is actually a List monad
// Array.prototype.flatMap corresponds to bind

// Example: chess knight moves
type Position = [number, number];

function knightMoves([x, y]: Position): Position[] {
  const deltas: Position[] = [
    [2, 1], [2, -1], [-2, 1], [-2, -1],
    [1, 2], [1, -2], [-1, 2], [-1, -2],
  ];
  return deltas
    .map(([dx, dy]) => [x + dx, y + dy] as Position)
    .filter(([nx, ny]) => nx >= 1 && nx <= 8 && ny >= 1 && ny <= 8);
}

// All positions reachable in 3 moves (flatMap of List monad)
function knightReachableIn3(start: Position): Position[] {
  return [start]
    .flatMap(knightMoves)   // Move 1: all possible positions
    .flatMap(knightMoves)   // Move 2: all further possible positions
    .flatMap(knightMoves);  // Move 3: further
}

console.log(`Reachable from (1,1) in 3 moves: ${knightReachableIn3([1, 1]).length} positions`);

// flatMap as List Comprehension
// Haskell: [(x, y) | x <- [1..3], y <- [1..3], x /= y]
// Python:  [(x, y) for x in range(1,4) for y in range(1,4) if x != y]
const pairs = [1, 2, 3]
  .flatMap(x => [1, 2, 3]
  );
console.log(pairs); // [[1,2],[1,3],[2,1],[2,3],[3,1],[3,2]]

// =============================================================
// Reader Monad: Dependency injection
// =============================================================

// Reader<E, A> is a monad that wraps a function E -> A
// Threads environment E implicitly
class Reader<E, A> {
  constructor(public readonly run: (env: E) => A) {}

  static of<E, A>(value: A): Reader<E, A> {
    return new Reader(() => value);
  }

  // Retrieve the environment itself
  static ask<E>(): Reader<E, E> {
    return new Reader(env => env);
  }

  // Retrieve part of the environment
  static asks<E, A>(fn: (env: E) => A): Reader<E, A> {
    return new Reader(fn);
  }

  map<B>(fn: (a: A) => B): Reader<E, B> {
    return new Reader(env => fn(this.run(env)));
  }

  flatMap<B>(fn: (a: A) => Reader<E, B>): Reader<E, B> {
    return new Reader(env => fn(this.run(env)).run(env));
  }
}

// Practical example: threading config and DB connection
interface AppEnv {
  db: { query: (sql: string) => string[] };
  config: { maxResults: number; locale: string };
  logger: { info: (msg: string) => void };
}

const getUsers: Reader<AppEnv, string[]> =
  Reader.asks((env: AppEnv) => env.db.query("SELECT * FROM users"));

const getMaxResults: Reader<AppEnv, number> =
  Reader.asks((env: AppEnv) => env.config.maxResults);

const getLocale: Reader<AppEnv, string> =
  Reader.asks((env: AppEnv) => env.config.locale);

// Compose Readers with flatMap --- environment is threaded implicitly
const getUserReport: Reader<AppEnv, string> = getUsers
  .flatMap(users =>
    getMaxResults.flatMap(max =>
      getLocale.map(locale => {
        const limited = users.slice(0, max);
        return `[${locale}] Found ${limited.length} users (max: ${max})`;
      })
    )
  );

// Execution: inject the environment in one place
const env: AppEnv = {
  db: { query: () => ["Alice", "Bob", "Charlie", "Dave", "Eve"] },
  config: { maxResults: 3, locale: "ja-JP" },
  logger: { info: console.log },
};

console.log(getUserReport.run(env));
// "[ja-JP] Found 3 users (max: 3)"

// Testing: run with a mock environment
const testEnv: AppEnv = {
  db: { query: () => ["TestUser"] },
  config: { maxResults: 10, locale: "en-US" },
  logger: { info: () => {} },
};

console.log(getUserReport.run(testEnv));
// "[en-US] Found 1 users (max: 10)"
```

---

## Code Example 6: Monad Patterns in Python

```python
"""
Monad implementation in Python
=====================
Python's weak static typing means strict monad implementations
like those in Haskell or TypeScript are less common, but the same
concepts can be expressed with dataclass + Protocol.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import TypeVar, Generic, Callable, Optional, Union
from abc import ABC, abstractmethod

T = TypeVar("T")
U = TypeVar("U")
E = TypeVar("E")

# =============================================================
# Maybe monad
# =============================================================

class Maybe(ABC, Generic[T]):
    """Maybe monad: computation that might not have a value"""

    @staticmethod
    def of(value: T) -> "Just[T]":
        return Just(value)

    @staticmethod
    def nothing() -> "Nothing[T]":
        return Nothing()

    @staticmethod
    def from_optional(value: Optional[T]) -> "Maybe[T]":
        if value is None:
            return Nothing()
        return Just(value)

    @abstractmethod
    def map(self, fn: Callable[[T], U]) -> "Maybe[U]": ...

    @abstractmethod
    def flat_map(self, fn: Callable[[T], "Maybe[U]"]) -> "Maybe[U]": ...

    @abstractmethod
    def get_or_else(self, default: T) -> T: ...

    @abstractmethod
    def is_just(self) -> bool: ...


@dataclass(frozen=True)
class Just(Maybe[T]):
    _value: T

    def map(self, fn: Callable[[T], U]) -> Maybe[U]:
        return Just(fn(self._value))

    def flat_map(self, fn: Callable[[T], Maybe[U]]) -> Maybe[U]:
        return fn(self._value)

    def get_or_else(self, default: T) -> T:
        return self._value

    def is_just(self) -> bool:
        return True

    def __repr__(self) -> str:
        return f"Just({self._value!r})"


@dataclass(frozen=True)
class Nothing(Maybe[T]):
    def map(self, fn: Callable[[T], U]) -> Maybe[U]:
        return Nothing()

    def flat_map(self, fn: Callable[[T], Maybe[U]]) -> Maybe[U]:
        return Nothing()

    def get_or_else(self, default: T) -> T:
        return default

    def is_just(self) -> bool:
        return False

    def __repr__(self) -> str:
        return "Nothing()"


# Usage examples
def safe_div(a: float, b: float) -> Maybe[float]:
    if b == 0:
        return Nothing()
    return Just(a / b)

def safe_sqrt(x: float) -> Maybe[float]:
    if x < 0:
        return Nothing()
    return Just(x ** 0.5)

# Chaining flatMap
result = (
    safe_div(100, 4)          # Just(25.0)
    .flat_map(safe_sqrt)      # Just(5.0)
    .map(lambda x: x * 2)    # Just(10.0)
)
print(result)  # Just(10.0)

result_err = (
    safe_div(100, 0)          # Nothing()
    .flat_map(safe_sqrt)      # Nothing() (skipped)
    .map(lambda x: x * 2)    # Nothing() (skipped)
)
print(result_err)  # Nothing()


# =============================================================
# Result monad
# =============================================================

class Result(ABC, Generic[T, E]):
    """Result monad: computation that is either success or failure"""

    @staticmethod
    def ok(value: T) -> "Ok[T, E]":
        return Ok(value)

    @staticmethod
    def err(error: E) -> "Err[T, E]":
        return Err(error)

    @staticmethod
    def from_try(fn: Callable[[], T]) -> "Result[T, Exception]":
        try:
            return Ok(fn())
        except Exception as e:
            return Err(e)

    @abstractmethod
    def map(self, fn: Callable[[T], U]) -> "Result[U, E]": ...

    @abstractmethod
    def flat_map(self, fn: Callable[[T], "Result[U, E]"]) -> "Result[U, E]": ...

    @abstractmethod
    def map_err(self, fn: Callable[[E], object]) -> "Result[T, object]": ...

    @abstractmethod
    def unwrap_or(self, default: T) -> T: ...

    @abstractmethod
    def is_ok(self) -> bool: ...


@dataclass(frozen=True)
class Ok(Result[T, E]):
    _value: T

    def map(self, fn: Callable[[T], U]) -> Result[U, E]:
        return Ok(fn(self._value))

    def flat_map(self, fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
        return fn(self._value)

    def map_err(self, fn: Callable[[E], object]) -> Result[T, object]:
        return Ok(self._value)

    def unwrap_or(self, default: T) -> T:
        return self._value

    def is_ok(self) -> bool:
        return True

    def __repr__(self) -> str:
        return f"Ok({self._value!r})"


@dataclass(frozen=True)
class Err(Result[T, E]):
    _error: E

    def map(self, fn: Callable[[T], U]) -> Result[U, E]:
        return Err(self._error)

    def flat_map(self, fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
        return Err(self._error)

    def map_err(self, fn: Callable[[E], object]) -> Result[T, object]:
        return Err(fn(self._error))

    def unwrap_or(self, default: T) -> T:
        return default

    def is_ok(self) -> bool:
        return False

    def __repr__(self) -> str:
        return f"Err({self._error!r})"


# Practical example: file processing pipeline
import json

def read_file(path: str) -> Result[str, str]:
    try:
        with open(path) as f:
            return Ok(f.read())
    except FileNotFoundError:
        return Err(f"File not found: {path}")
    except PermissionError:
        return Err(f"Permission denied: {path}")

def parse_json(content: str) -> Result[dict, str]:
    try:
        return Ok(json.loads(content))
    except json.JSONDecodeError as e:
        return Err(f"JSON error: {e}")

def extract_field(data: dict, field: str) -> Result[object, str]:
    if field not in data:
        return Err(f"Missing field: {field}")
    return Ok(data[field])

# Railway-oriented pipeline
def get_config_value(path: str, field: str) -> Result[object, str]:
    return (
        read_file(path)
        .flat_map(parse_json)
        .flat_map(lambda data: extract_field(data, field))
    )

# Test
# result = get_config_value("config.json", "database_url")
# print(result)


# =============================================================
# Python-specific: context managers are also monadic
# =============================================================
from contextlib import contextmanager

@contextmanager
def managed_connection(url: str):
    """Context manager = a kind of Resource monad"""
    conn = f"Connection({url})"
    print(f"Opening {conn}")
    try:
        yield conn
    finally:
        print(f"Closing {conn}")

# with statement = syntactic sugar for do-notation
# with managed_connection("db://localhost") as conn:
#     print(f"Using {conn}")
```

---

## Code Example 7: Monad Composition and Monad Transformers

```typescript
// =============================================================
// Monad composition: Practical patterns for combining multiple monads
// =============================================================

// --- Base type definitions ---
type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// --- ResultT<Promise>: monad transformer for Promise + Result ---
// Makes "asynchronous computation that might fail" composable

class AsyncResult<T, E = Error> {
  constructor(private readonly promise: Promise<Result<T, E>>) {}

  // --- unit ---
  static of<T>(value: T): AsyncResult<T, never> {
    return new AsyncResult(Promise.resolve(Ok(value)));
  }

  static err<E>(error: E): AsyncResult<never, E> {
    return new AsyncResult(Promise.resolve(Err(error)));
  }

  // Safely wrap Promise<T>
  static fromPromise<T>(promise: Promise<T>): AsyncResult<T, Error> {
    return new AsyncResult(
      promise
        .then(value => Ok(value) as Result<T, Error>)
        .catch(e => Err(e instanceof Error ? e : new Error(String(e))))
    );
  }

  // --- Functor ---
  map<U>(fn: (value: T) => U): AsyncResult<U, E> {
    return new AsyncResult(
      this.promise.then(result =>
        result.ok ? Ok(fn(result.value)) : result
      )
    );
  }

  mapErr<F>(fn: (error: E) => F): AsyncResult<T, F> {
    return new AsyncResult(
      this.promise.then(result =>
        result.ok ? result : Err(fn(result.error))
      )
    );
  }

  // --- Monad ---
  flatMap<U>(fn: (value: T) => AsyncResult<U, E>): AsyncResult<U, E> {
    return new AsyncResult(
      this.promise.then(result =>
        result.ok ? fn(result.value).toPromise() : result
      )
    );
  }

  // --- Utilities ---
  async toPromise(): Promise<Result<T, E>> {
    return this.promise;
  }

  async unwrapOr(defaultValue: T): Promise<T> {
    const result = await this.promise;
    return result.ok ? result.value : defaultValue;
  }

  // With timeout
  withTimeout(ms: number): AsyncResult<T, E | Error> {
    const timeout = new Promise<Result<T, E | Error>>(resolve =>
      setTimeout(() => resolve(Err(new Error(`Timeout: ${ms}ms`))), ms)
    );
    return new AsyncResult(Promise.race([this.promise as Promise<Result<T, E | Error>>, timeout]));
  }

  // Retry
  retry(times: number, delayMs: number = 0): AsyncResult<T, E> {
    return new AsyncResult(
      this.promise.then(async result => {
        if (result.ok || times <= 0) return result;
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return this.retry(times - 1, delayMs).toPromise();
      })
    );
  }
}

// =============================================================
// Practical example: API client
// =============================================================

interface User {
  id: string;
  name: string;
  teamId: string;
}

interface Team {
  id: string;
  name: string;
  projectIds: string[];
}

interface Project {
  id: string;
  title: string;
  budget: number;
}

// API functions (each call is async + can fail)
function fetchUserById(id: string): AsyncResult<User, string> {
  return AsyncResult.fromPromise(
    fetch(`/api/users/${id}`).then(r => {
      if (!r.ok) throw new Error(`User not found: ${id}`);
      return r.json();
    })
  ).mapErr(e => `Failed to fetch user: ${e.message}`);
}

function fetchTeamById(id: string): AsyncResult<Team, string> {
  return AsyncResult.fromPromise(
    fetch(`/api/teams/${id}`).then(r => {
      if (!r.ok) throw new Error(`Team not found: ${id}`);
      return r.json();
    })
  ).mapErr(e => `Failed to fetch team: ${e.message}`);
}

function fetchProjectById(id: string): AsyncResult<Project, string> {
  return AsyncResult.fromPromise(
    fetch(`/api/projects/${id}`).then(r => {
      if (!r.ok) throw new Error(`Project not found: ${id}`);
      return r.json();
    })
  ).mapErr(e => `Failed to fetch project: ${e.message}`);
}

// Chain of flatMap: errors propagate automatically
async function getUserTeamBudget(userId: string): Promise<Result<number, string>> {
  return fetchUserById(userId)
    .flatMap(user => fetchTeamById(user.teamId))
    .flatMap(team => {
      if (team.projectIds.length === 0) {
        return AsyncResult.err("Team has no projects");
      }
      return fetchProjectById(team.projectIds[0]);
    })
    .map(project => project.budget)
    .withTimeout(5000)
    .mapErr(e => typeof e === "string" ? e : e.message)
    .toPromise();
}

// =============================================================
// do-notation style: generator-based composition
// =============================================================

// Pseudo-implementation of "do-notation" using generators
function* doResult<T>(): Generator<Result<any, any>, T, any> {
  // Inside the generator, yield "binds" a Result
  // The generator is interrupted when Left/Err is returned
  return undefined as T;
}

// Practical do-notation (runDo)
function runDo<T, E>(
  gen: () => Generator<Result<T, E>, T, T>
): Result<T, E> {
  const iterator = gen();
  let next = iterator.next();

  while (!next.done) {
    const result = next.value;
    if (!result.ok) {
      return result;  // Interrupt the generator on error
    }
    next = iterator.next(result.value);
  }

  return Ok(next.value);
}

// Usage with do-notation
function processOrder(orderId: string): Result<string, string> {
  return runDo(function* () {
    const parsed = yield parseOrderId(orderId);         // bind
    const order = yield findOrder(parsed);               // bind
    const validated = yield validateOrder(order);         // bind
    return `Processed: ${validated.id}`;                 // return
  });
}

// Dummy type declarations
declare function parseOrderId(id: string): Result<number, string>;
declare function findOrder(id: number): Result<{ id: number; total: number }, string>;
declare function validateOrder(order: { id: number; total: number }): Result<{ id: number; total: number }, string>;

// =============================================================
// MaybeT: Transformer for Maybe + Promise
// =============================================================

class MaybeAsync<T> {
  constructor(private readonly promise: Promise<Maybe<T>>) {}

  static of<T>(value: T): MaybeAsync<T> {
    return new MaybeAsync(Promise.resolve(Maybe.of(value)));
  }

  static nothing<T>(): MaybeAsync<T> {
    return new MaybeAsync(Promise.resolve(Maybe.nothing()));
  }

  static fromPromise<T>(promise: Promise<T | null | undefined>): MaybeAsync<T> {
    return new MaybeAsync(
      promise
        .then(v => Maybe.fromNullable(v))
        .catch(() => Maybe.nothing())
    );
  }

  map<U>(fn: (value: T) => U): MaybeAsync<U> {
    return new MaybeAsync(this.promise.then(m => m.map(fn)));
  }

  flatMap<U>(fn: (value: T) => MaybeAsync<U>): MaybeAsync<U> {
    return new MaybeAsync(
      this.promise.then(m =>
        m.match({
          just: value => fn(value).toPromise(),
          nothing: () => Promise.resolve(Maybe.nothing<U>()),
        })
      )
    );
  }

  async toPromise(): Promise<Maybe<T>> {
    return this.promise;
  }

  async getOrElse(defaultValue: T): Promise<T> {
    const m = await this.promise;
    return m.getOrElse(defaultValue);
  }
}

// Usage example: handling both async and null
async function findUserAvatar(userId: string): Promise<string> {
  return MaybeAsync.fromPromise(fetchUserMaybe(userId))
    .flatMap(user =>
      MaybeAsync.fromPromise(fetchProfileMaybe(user.profileId))
    )
    .map(profile => profile.avatarUrl)
    .getOrElse("/default-avatar.png");
}

declare function fetchUserMaybe(id: string): Promise<{ profileId: string } | null>;
declare function fetchProfileMaybe(id: string): Promise<{ avatarUrl: string } | null>;
```

---

## Deep Dive 1: Monad Hierarchy --- Functor, Applicative, Monad

```
Type class hierarchy (Haskell's type class system)
=========================================

  Functor          map:    (a -> b)   -> F a -> F b
    |               "transform the value inside the box"
    v
  Applicative      apply:  F (a -> b) -> F a -> F b
    |               "apply a function inside a box to a value inside a box"
    v
  Monad            bind:   (a -> M b) -> M a -> M b
                    "extract the value from the box and pass it to a function that creates a new box"

Relationship: Functor < Applicative < Monad
  - Every monad is an applicative
  - Every applicative is a functor
  - Monads are the most powerful (can choose the next computation based on the previous result)

Difference between Applicative and Monad:
  Applicative: computation structure is static (determined in advance)
    liftA2 (+) (Just 3) (Just 5) --> Just 8
    All computations are executed independently

  Monad: computation structure is dynamic (depends on previous result)
    Just 3 >>= (\x -> if x > 0 then Just (x + 1) else Nothing)
    Can choose the next computation by looking at the result of the previous step

Correspondence in TypeScript:
  Functor     → Array.map, Promise.then (when returning a value)
  Applicative → Promise.all (run independent computations in parallel)
  Monad       → Array.flatMap, Promise.then (when returning a Promise)
```

| Abstraction | Operation | "What it can do" | TypeScript example |
|---|---|---|---|
| **Functor** | `map` | Transform the value in the box | `[1,2,3].map(x => x*2)` |
| **Applicative** | `apply` / `liftA2` | Combine independent boxes | `Promise.all([p1, p2])` |
| **Monad** | `flatMap` / `bind` | Choose the next computation based on the previous result | `promise.then(x => fetch(x.url))` |

**Decision guide**:

- If each computation is **independent**, **Applicative** is sufficient (can run in parallel)
- If you need to **choose** the next computation based on the **result** of the previous one, **Monad** is required

```typescript
// Applicative: independent computations → can run in parallel
const [user, products, settings] = await Promise.all([
  fetchUser(id),
  fetchProducts(),
  fetchSettings(),
]);

// Monad: dependent computations → sequential execution
const user = await fetchUser(id);              // 1. Fetch user
const team = await fetchTeam(user.teamId);     // 2. Fetch team (depends on user)
const projects = await fetchProjects(team.id); // 3. Fetch projects (depends on team)
```

---

## Deep Dive 2: Real-World Monad Patterns

### 2.1 Redux / useReducer: Realization of the State Monad

```typescript
// Redux's dispatch chain corresponds to the bind of the State monad
// state -> action -> newState

// React's useReducer: integrating the State monad into UI
type State = { count: number; history: number[] };
type Action =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment":
      return {
        count: state.count + 1,
        history: [...state.history, state.count],
      };
    case "decrement":
      return {
        count: state.count - 1,
        history: [...state.history, state.count],
      };
    case "reset":
      return { count: 0, history: [] };
  }
}

// Type of State monad:  State s a = s -> (a, s)
// Type of reducer:      State -> Action -> State
// Type of dispatch:     Action -> void (state is managed implicitly)
```

### 2.2 Express/Koa Middleware: Composition of Reader + Writer + IO Monads

```typescript
// Middleware is a monad composition of "environment (req/res) + logging + side effects"
// Reader: reads req/res context
// Writer: accumulates headers and logs
// IO: side effects like sending responses, DB access, etc.

// Koa's ctx.state is a composition of Reader + State
// next() corresponds to bind in the Continuation monad
```

### 2.3 RxJS Observable: Combined Monad of List + IO + Promise

```typescript
// Observable can be seen as a composition of the following monads:
// - List: multiple values (spread across the time axis)
// - IO: side effects (not executed until subscribe = lazy)
// - Promise: asynchronous (delayed in time)

// pipe = monad composition pipeline
// switchMap/mergeMap/concatMap = variations of flatMap
//   switchMap: cancel the previous subscription when a new value arrives
//   mergeMap:  execute concurrently
//   concatMap: execute sequentially (queue)
```

---

## Deep Dive 3: Rust's ? Operator --- The Best Syntactic Sugar for Monads

```rust
// Rust's ? operator is syntactic sugar for Result/Option's flatMap (and_then)
// It serves the same role as Haskell's do-notation and JavaScript's async/await

use std::fs;
use std::num::ParseIntError;

// --- Error type definition ---
#[derive(Debug)]
enum AppError {
    Io(std::io::Error),
    Parse(ParseIntError),
    Validation(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e)
    }
}

impl From<ParseIntError> for AppError {
    fn from(e: ParseIntError) -> Self {
        AppError::Parse(e)
    }
}

// --- Flat error handling using the ? operator ---
fn read_config(path: &str) -> Result<Config, AppError> {
    let content = fs::read_to_string(path)?;          // Automatically convert Io error
    let port: u16 = content.trim().parse()?;          // Automatically convert Parse error

    if port < 1024 {
        return Err(AppError::Validation(
            format!("Port {} is privileged", port)
        ));
    }

    Ok(Config { port })
}

// --- Equivalent code without the ? operator (manual expansion of flatMap) ---
fn read_config_verbose(path: &str) -> Result<Config, AppError> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => return Err(AppError::Io(e)),
    };

    let port: u16 = match content.trim().parse() {
        Ok(p) => p,
        Err(e) => return Err(AppError::Parse(e)),
    };

    if port < 1024 {
        return Err(AppError::Validation(
            format!("Port {} is privileged", port)
        ));
    }

    Ok(Config { port })
}

struct Config {
    port: u16,
}

// --- ? operator with Option ---
struct User {
    address: Option<Address>,
}

struct Address {
    city: Option<String>,
}

fn get_city(user: &Option<User>) -> Option<&str> {
    // ? returns early if None
    let user = user.as_ref()?;
    let address = user.address.as_ref()?;
    let city = address.city.as_deref()?;
    Some(city)
}

// --- and_then chain style ---
fn get_city_chain(user: &Option<User>) -> Option<&str> {
    user.as_ref()
        .and_then(|u| u.address.as_ref())
        .and_then(|a| a.city.as_deref())
}

// --- Combining Iterator + Result ---
fn parse_numbers(inputs: &[&str]) -> Result<Vec<i64>, ParseIntError> {
    inputs.iter()
        .map(|s| s.parse::<i64>())   // Iterator<Item = Result<i64, _>>
        .collect()                     // Automatically converted to Result<Vec<i64>, _>!
}

// collect() handles Iterator<Item = Result<T, E>> -> Result<Vec<T>, E>
// This is also a realization of monad's traverse/sequence
```

---

## Monad Comparison Table

### Overview of Major Monads

| Monad | Context | unit | bind behavior | Language counterpart |
|---|---|---|---|---|
| **Maybe/Option** | Presence of value | `Some(x)` | Skip if None | Rust: `Option`, TS: `?.`, Python: `Optional` |
| **Either/Result** | Success/failure | `Right(x)` / `Ok(x)` | Skip if Left/Err | Rust: `Result`, Go: `error`, TS: `Promise.catch` |
| **Promise/Future** | Asynchronous | `Promise.resolve(x)` | Execute next after completion | JS: `Promise`, Rust: `Future`, Python: `asyncio` |
| **IO** | Side effects | `IO.of(x)` | Defer execution and compose | Haskell: `IO`, Effect-TS: `Effect` |
| **List/Array** | Multiple values | `[x]` | Apply to each element and combine | JS: `Array.flatMap`, Python: list comprehension |
| **Reader** | Dependency injection | `Reader.of(x)` | Thread environment implicitly | DI containers, React Context |
| **Writer** | Log accumulation | `Writer.of(x)` | Propagate value + log | Middleware log accumulation |
| **State** | State management | `State.of(x)` | Thread state through computations | Redux, useReducer |

### Syntactic Sugar by Language

| Concept | Haskell | Rust | TypeScript | Python |
|---|---|---|---|---|
| Maybe bind | `>>=` / `do` | `?` / `and_then()` | `?.` / `flatMap` | `or None` / `if x is not None` |
| Either bind | `>>=` / `do` | `?` / `and_then()` | `then` / `catch` | exceptions / `try/except` |
| do-notation | `do { x <- m; ... }` | `let x = m?;` | `const x = await m;` | `x = await m` |
| for comprehension | `[f x | x <- xs]` | `xs.iter().map(f)` | `xs.flatMap(f)` | `[f(x) for x in xs]` |
| type constraint | type class `Monad m =>` | trait `impl Monad` | interface | Protocol / ABC |

### Correspondence of Syntactic Sugar

| Monad operation | Haskell do-notation | Rust ? operator | JS async/await |
|---|---|---|---|
| bind | `x <- action` | `let x = action?;` | `const x = await action;` |
| return | `return x` | `Ok(x)` | `return x` |
| sequence | `action1 >> action2` | `action1?; action2?;` | `await a1; await a2;` |
| failure | `fail "msg"` | `Err(e)?` | `throw new Error()` |

---

## Anti-patterns

### 1. Overuse of Monads --- Ignoring Native Language Features

**Problem**: Applying custom Maybe/Either to everything increases unfamiliar library dependencies for the team. In TypeScript, Optional Chaining (`?.`) and Nullish Coalescing (`??`) are often sufficient.

```typescript
// =============================================================
// [NG] Unnecessarily complex with custom Maybe
// =============================================================
function getUserCityBad(user: User | null): string {
  return Maybe.fromNullable(user)
    .flatMap(u => Maybe.fromNullable(u.address))
    .flatMap(a => Maybe.fromNullable(a.city))
    .getOrElse("Unknown");
}

// =============================================================
// [OK] Native TypeScript features are sufficient
// =============================================================
function getUserCityGood(user: User | null): string {
  return user?.address?.city ?? "Unknown";
}

// =============================================================
// [OK] However, Maybe is effective when complex logic is involved
// =============================================================
function getDiscountedPrice(user: User | null): Maybe<number> {
  return Maybe.fromNullable(user)
    .flatMap(u => findMembership(u.id))        // DB lookup (nullable)
    .filter(m => m.isActive)                    // conditional filter
    .flatMap(m => calculateDiscount(m.tier))    // business logic (can fail)
    .map(discount => basePrice * (1 - discount));
}
// Optional chaining alone cannot express this branching

// Decision criteria:
// - Simple null check chain → use ?. and ??
// - Conditional branches + business logic + possibility of failure → use Maybe/Result
```

### 2. Careless Unwrapping --- Destroying Monad Safety

**Problem**: Careless use of `Option.unwrap()` or `Result.unwrap()` causes runtime panics/exceptions. The type safety provided by monads is completely undermined.

```rust
// =============================================================
// [NG] Abuse of unwrap
// =============================================================
fn process_bad(input: &str) -> String {
    let value = input.parse::<i32>().unwrap();     // panic!
    let item = find_item(value).unwrap();          // panic!
    let result = validate(item).unwrap();          // panic!
    format!("Done: {}", result)
}

// =============================================================
// [OK] Use alternatives to unwrap
// =============================================================

// Method 1: ? operator (recommended)
fn process_good(input: &str) -> Result<String, AppError> {
    let value = input.parse::<i32>()?;
    let item = find_item(value)?;
    let result = validate(item)?;
    Ok(format!("Done: {}", result))
}

// Method 2: Pattern matching
fn process_match(input: &str) -> String {
    match input.parse::<i32>() {
        Ok(value) => match find_item(value) {
            Some(item) => format!("Found: {}", item),
            None => "Not found".to_string(),
        },
        Err(e) => format!("Parse error: {}", e),
    }
}

// Method 3: unwrap_or / unwrap_or_else (when a default value is available)
fn process_default(input: &str) -> String {
    let value = input.parse::<i32>().unwrap_or(0);
    let item = find_item(value).unwrap_or_default();
    format!("Result: {}", item)
}

// Method 4: expect (better than unwrap, but avoid in production code)
// Can attach debug information, but still panics
fn process_expect(input: &str) -> i32 {
    input.parse::<i32>()
        .expect(&format!("Failed to parse '{}' as i32", input))
}
```

```typescript
// Same applies in TypeScript
// =============================================================
// [NG] Access without type guard
// =============================================================
const result = validateUser(input);
console.log(result.value.name);  // runtime error if result is Left/Err

// =============================================================
// [OK] Type-respecting access
// =============================================================
const result = validateUser(input);
if (result.tag === "Right") {
  console.log(result.value.name);  // type-safe
} else {
  console.error(result.value);     // error handling
}

// [OK] Pattern matching with fold/match
EitherM.fold(
  result,
  error => console.error(`Validation failed: ${error}`),
  user => console.log(`Welcome, ${user.name}`)
);
```

### 3. Mixing Monads --- Mixing Either with Exceptions

**Problem**: Randomly mixing Either/Result-based error handling with traditional try/catch makes error flow impossible to track.

```typescript
// =============================================================
// [NG] Mixing Either and exceptions
// =============================================================
function processBad(input: string): Either<string, Output> {
  const parsed = parseInput(input);  // returns Either
  if (parsed.tag === "Left") return parsed;

  // Suddenly throws here! The Either pipeline is broken
  const data = JSON.parse(parsed.value.raw);  // throws!

  const validated = validateData(data);  // returns Either
  if (validated.tag === "Left") return validated;

  return Right(transform(validated.value));
}

// Caller: even if you handle Either, you miss the JSON.parse exception

// =============================================================
// [OK] Unify the error handling strategy
// =============================================================

// Method 1: Unify everything as Either (recommended)
function processGood(input: string): Either<string, Output> {
  return flatMap(parseInput(input), parsed =>
    flatMap(EitherM.tryCatch(() => JSON.parse(parsed.raw))
      .mapLeft(e => `JSON error: ${e.message}`), data =>
        flatMap(validateData(data), validated =>
          Right(transform(validated))
        )
      )
  );
}

// Method 2: Convert at boundaries (integration points with external libraries)
function safeJsonParse(raw: string): Either<string, unknown> {
  return EitherM.tryCatch(() => JSON.parse(raw))
    .mapLeft(e => `JSON parse error: ${e.message}`);
}

function processAlsoGood(input: string): Either<string, Output> {
  const parsed = parseInput(input);
  const json = flatMap(parsed, p => safeJsonParse(p.raw));
  const validated = flatMap(json, validateData);
  return map(validated, transform);
}

// Principles:
// - Inside the project: unify with Either/Result
// - At external library boundaries: convert to Either with tryCatch
// - Never throw inside an Either pipeline

declare function parseInput(input: string): Either<string, { raw: string }>;
declare function validateData(data: unknown): Either<string, { valid: true }>;
declare function transform(data: { valid: true }): Output;
type Output = { result: string };
```

---

## Exercises

### Exercise 1: Using the Maybe Monad (Basic)

For the following type definitions, implement functions to safely access nested data using the Maybe monad.

```typescript
interface Department {
  name: string;
  manager?: {
    name: string;
    contact?: {
      email?: string;
      phone?: string;
    };
  };
}

// Please implement
function getManagerEmail(dept: Department | null): string {
  // Use Maybe to safely retrieve dept?.manager?.contact?.email
  // Return "N/A" if not found
}

function getManagerPhone(dept: Department | null): Maybe<string> {
  // Version that returns Maybe. Allows the caller to choose how to handle it
}
```

**Expected output**:
```
getManagerEmail({ name: "Engineering", manager: { name: "Alice", contact: { email: "alice@co.com" } } })
// => "alice@co.com"

getManagerEmail({ name: "Sales" })
// => "N/A"

getManagerEmail(null)
// => "N/A"

getManagerPhone({ name: "HR", manager: { name: "Bob", contact: { phone: "090-1234-5678" } } })
// => Just("090-1234-5678")

getManagerPhone({ name: "HR", manager: { name: "Bob" } })
// => Nothing()
```

### Exercise 2: Railway-Oriented Validation with Result (Intermediate)

Build a validation pipeline for user input using the Result monad.

```typescript
interface OrderInput {
  productId: string;   // must be a numeric string
  quantity: string;    // must be an integer string from 1-100
  couponCode?: string; // if present, must start with "DISCOUNT-"
}

interface ValidatedOrder {
  productId: number;
  quantity: number;
  couponCode: string | null;
  discountRate: number;  // 0.1 if coupon exists, 0 otherwise
}

// Please implement each validation function
function validateProductId(raw: string): Result<number, string> { /* ... */ }
function validateQuantity(raw: string): Result<number, string> { /* ... */ }
function validateCoupon(code?: string): Result<string | null, string> { /* ... */ }

// Chain them in railway-oriented style
function validateOrder(input: OrderInput): Result<ValidatedOrder, string> { /* ... */ }
```

**Expected output**:
```
validateOrder({ productId: "42", quantity: "5" })
// => Ok({ productId: 42, quantity: 5, couponCode: null, discountRate: 0 })

validateOrder({ productId: "42", quantity: "5", couponCode: "DISCOUNT-SUMMER" })
// => Ok({ productId: 42, quantity: 5, couponCode: "DISCOUNT-SUMMER", discountRate: 0.1 })

validateOrder({ productId: "abc", quantity: "5" })
// => Err("productId must be a number")

validateOrder({ productId: "42", quantity: "200" })
// => Err("quantity must be 1-100")

validateOrder({ productId: "42", quantity: "5", couponCode: "INVALID" })
// => Err("coupon must start with DISCOUNT-")
```

### Exercise 3: AsyncResult Monad Transformer (Advanced)

Implement an API client based on `AsyncResult` that meets the following specifications.

```typescript
// Requirements:
// 1. Each API call returns AsyncResult<T, AppError>
// 2. Network errors, 404s, and validation errors are expressed as structured error types
// 3. Build a pipeline with flatMap
// 4. Support timeout (3 seconds) and retry (up to 2 times)
// 5. Return the final result as Result<T, AppError>

type AppError =
  | { type: "network"; message: string }
  | { type: "notFound"; resource: string; id: string }
  | { type: "validation"; errors: string[] };

// Please implement
class ApiClient {
  // Pipeline: fetch user → fetch team → fetch member list
  async getTeamMembers(userId: string): Promise<Result<TeamMember[], AppError>> {
    return fetchUser(userId)
      .flatMap(user => fetchTeam(user.teamId))
      .flatMap(team => fetchMembers(team.id))
      .withTimeout(3000)
      .retry(2, 500)
      .toPromise();
  }
}
```

**Expected output**:
```
// Success case
await client.getTeamMembers("user-1")
// => { ok: true, value: [{ id: "m1", name: "Alice" }, { id: "m2", name: "Bob" }] }

// User not found
await client.getTeamMembers("nonexistent")
// => { ok: false, error: { type: "notFound", resource: "user", id: "nonexistent" } }

// Timeout (after 3 seconds, 2 retries)
await client.getTeamMembers("slow-user")
// => { ok: false, error: { type: "network", message: "Timeout: 3000ms" } }
```

---

## FAQ

### Q1: Are monads useful in real-world development?

**A**: Yes. However, you do not need to be aware of the name "monad." The following are all real examples of the monad pattern.

| Everyday code | Its identity as a monad |
|---|---|
| `array.flatMap(fn)` | bind of the List monad |
| `promise.then(fn)` | bind of the IO monad |
| `async/await` | syntactic sugar for do-notation |
| `result?` (Rust) | bind of the Either monad |
| `user?.address?.city` | bind of the Maybe monad (partial) |
| `ctx.state` (Koa) | ask of the Reader monad |

The value of monads is in "giving a theoretical foundation to concepts you already use." Knowing the theory allows you to apply the same patterns to new contexts (e.g., asynchronous streams).

### Q2: Do I need to learn Haskell to understand monads?

**A**: No. The concept of monads is language-independent. You can fully understand them by practicing the `flatMap` / `and_then` patterns in TypeScript or Rust. While Haskell expresses monads most systematically through type classes, this is not necessary for practical understanding. In fact, starting from Haskell's abstract notation tends to create the misconception that "monads are difficult." It is more effective to start from concrete examples like "Promise's then is the bind of a monad."

### Q3: What are monad transformers?

**A**: They are a mechanism for stacking multiple monads. For example, `MaybeT (Either Error)` represents "a computation that might fail, with an additional possibility of None."

Practically, the following are familiar monad transformers.

| Combination | TypeScript representation | Use case |
|---|---|---|
| Promise + Result | `Promise<Result<T, E>>` | Async + error handling |
| Promise + Maybe | `Promise<T \| null>` | Async + optional value |
| Array + Maybe | `(T \| null)[]` → `T[]` (filter) | Collection + missing values |

The `AsyncResult` class in Code Example 7 is a TypeScript implementation of this concept.

### Q4: Which should I use: Either/Result or try/catch?

**A**: The most important thing is to unify the strategy within a project. Here are the decision criteria.

| Criterion | Either/Result is better | try/catch is better |
|---|---|---|
| Error type safety | Caller recognizes error types | Type information is lost (any/unknown) |
| Exhaustiveness check | Compile-time check with discriminated unions | Unknown until runtime |
| Performance | Only creates values | Cost of generating stack traces |
| Ecosystem | Mainstream in Rust, Haskell, Scala | Mainstream in Java, Python, JS/TS |
| Learning cost | Team needs to understand the concept | Familiar to most developers |
| Unrecoverable errors | Not suitable (OOM, stack overflow) | Appropriate (cleanup with finally) |

**Recommendation**: In TypeScript, a balanced approach is "use Result as function return values, and use tryCatch at external library boundaries to convert to Result."

### Q5: Why flatMap and not map?

**A**: `map` produces a nested `M<M<T>>`, but `flatMap` flattens it to `M<T>`. This is why "monads" are more powerful than "functors."

```typescript
// map produces double wrapping
const result: Maybe<Maybe<string>> =
  Maybe.of(user).map(u => Maybe.fromNullable(u.name));
// Maybe<Maybe<string>> ← hard to use!

// flatMap automatically flattens
const result: Maybe<string> =
  Maybe.of(user).flatMap(u => Maybe.fromNullable(u.name));
// Maybe<string> ← can be used directly

// Same with Promise
// then combines both map and flatMap, but internally auto-flattens
Promise.resolve(userId)
  .then(id => fetchUser(id))  // fetchUser returns a Promise
  // If .then were map: Promise<Promise<User>> (double wrapped)
  // Because .then is flatMap: Promise<User> (flat)
```

---

## Summary

| Item | Key Point |
|---|---|
| Essence of monads | Composition of contextual computation via `unit` and `bind (flatMap)` |
| Monad laws | Must satisfy three laws: left identity, right identity, associativity |
| Maybe/Option | Null safety. Chain computations that might not have a value. A generalization of `?.` |
| Either/Result | Type-safe error handling. Railway-oriented programming |
| Promise/Future | Asynchronous processing. `async/await` is syntactic sugar for do-notation |
| IO | Isolation of side effects. Clearly separate pure functions and side effects. Testability |
| List | Non-deterministic computation. Explore multiple possibilities with `flatMap` |
| Reader | Dependency injection. Thread environment implicitly |
| Monad transformers | Composition of multiple monads. `AsyncResult = Promise + Result` |
| Hierarchy | Functor < Applicative < Monad. Applicative is sufficient for independent computations |
| Practical guidelines | Prioritize native language features. Unify error strategy. Avoid unwrap |

---

## Guides to Read Next

- [Functor and Applicative](./01-functor-applicative.md) --- Abstractions that are prerequisites for monads. Understanding map and apply
- [Functional Patterns](./02-fp-patterns.md) --- Combining currying, pipelines, composition with monads
- [Strategy Pattern](../02-behavioral/01-strategy.md) --- Treating functions as values (the OOP version of higher-order functions)
- [Iterator Pattern](../02-behavioral/04-iterator.md) --- OOP implementation of the List monad. Relationship with lazy evaluation

---

## References

1. **Philip Wadler** (1992): [Monads for functional programming](https://homepages.inf.ed.ac.uk/wadler/papers/marktoberdorf/baastad.pdf) --- Paper that established the theoretical foundation of monads
2. **Bartosz Milewski**: [Category Theory for Programmers](https://bartoszmilewski.com/2014/10/28/category-theory-for-programmers-the-preface/) --- Theoretical explanation of category theory and monads
3. **Scott Wlaschin**: [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/) --- Practical explanation of the Either monad (railway-oriented programming)
4. **Rust by Example**: [Error Handling](https://doc.rust-lang.org/rust-by-example/error.html) --- Practical guide to the Result monad and the ? operator
5. **Giulio Canti**: [fp-ts](https://gcanti.github.io/fp-ts/) --- Functional programming library for TypeScript (monad implementation examples)
