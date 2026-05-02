# Functor and Applicative

> Understand the abstractions of map and ap, and achieve type-safe function application and composition over values in context

## What You Will Learn in This Chapter

1. **The essence and laws of functors** — Transforming values in context via map, the meaning of functor laws (identity law and composition law) and how to verify them
2. **Theory and practice of applicatives** — Applying functions to multiple contextualized values, error-accumulating validation, and parallel computation
3. **The full picture of the type class hierarchy** — The relationship of Functor < Applicative < Monad, the capabilities and limits of each level, and criteria for choosing them in practice
4. **Connection to category theory** — An intuitive understanding of category-theoretic concepts in programming, and why this abstraction is useful

---

## Prerequisites

Before reading this guide, it is recommended that you have the following knowledge.

| Prerequisite | Reference |
|---|---|
| Basic type system in TypeScript/Rust | [02-programming category](../../../../02-programming/) |
| Generics and interfaces | [02-programming category](../../../../02-programming/) |
| Higher-order functions (map, filter, reduce) | [Functional Patterns](./02-fp-patterns.md) |
| Monad basics (flatMap/bind) | [Monad](./00-monad.md) |
| Clean code principles | clean-code-principles |

---

## 1. The Essence of Functors

### 1.1 What Is a Functor — Understanding from WHY

In programming, values exist wrapped in various "contexts."

```
Examples of contexts
===========================

A value that "might not exist"        → Maybe / Option
A value that "might be an error"      → Result / Either
A value that "might be multiple"      → Array / List
A value that "might arrive in future" → Promise / Future
A value that "might have side effects"→ IO
A value that "might depend on env"    → Reader

Problem: We want to apply the same transformation logic
         to values inside these contexts
         → Functors solve this
```

**WHY**: Why do we need functors?

With a naive approach, you need to write separate transformation code for each context.

```typescript
// Without context
const doubled = value * 2;

// Maybe context — null check required
if (maybeValue !== null) {
  const doubled = maybeValue * 2;
}

// Array context — loop required
const doubled = [];
for (const v of array) {
  doubled.push(v * 2);
}

// Promise context — callback required
promise.then(value => value * 2);
```

All of these follow the same pattern of "applying a function to the value inside." Functors abstract this pattern with a unified interface called `map`.

```
Functor = a type that has map
===========================

Ordinary function application:
  f : A -> B
  f(a)  -->  b

Function application with a functor:
  F[A].map(f)  -->  F[B]

  Maybe[3].map(x => x * 2)  -->  Maybe[6]
  [1,2,3].map(x => x * 2)   -->  [2,4,6]
  Promise[data].then(parse)  -->  Promise[parsed]

In other words:
  "Transform only the content while keeping the context"
  This is the essence of a functor
```

### 1.2 Functor Laws — Why Laws Matter

To call itself a functor, the `map` method must satisfy two laws. A `map` that violates the laws causes unpredictable behavior and undermines the safety of refactoring.

```
Functor Laws:
  1. Identity Law:
     fa.map(id) === fa
     "Mapping with the identity function changes nothing"

  2. Composition Law:
     fa.map(f).map(g) === fa.map(x => g(f(x)))
     "Mapping twice is the same as mapping once with the composed function"

Why laws matter:
  - Identity law: You can safely remove map(id) during refactoring
  - Composition law: You can optimize performance by merging a chain of maps into one
  - Both: Make code behavior predictable (equational reasoning)
```

### 1.3 Functor Diagram

```
┌─────────────────────────────────────────────────────┐
│  How a Functor Works                                 │
│                                                     │
│  Ordinary function:                                  │
│    f: A → B                                         │
│    3  ──f(×2)──▶  6                                 │
│                                                     │
│  Functor map:                                        │
│    map(f): F[A] → F[B]                              │
│                                                     │
│    ┌─────┐              ┌─────┐                     │
│    │Maybe│              │Maybe│                     │
│    │  3  │──map(×2)──▶  │  6  │                     │
│    └─────┘              └─────┘                     │
│                                                     │
│    ┌─────────┐              ┌───────────┐           │
│    │ Array   │              │  Array    │           │
│    │ [1,2,3] │──map(×2)──▶  │ [2,4,6]  │           │
│    └─────────┘              └───────────┘           │
│                                                     │
│    ┌─────────┐              ┌───────────┐           │
│    │ Nothing │──map(×2)──▶  │  Nothing  │           │
│    └─────────┘              └───────────┘           │
│    (the context is preserved)                        │
│                                                     │
│  Key points:                                         │
│  - The shape of the box (context) does not change   │
│  - Only the contents are transformed                │
│  - Nothing is left unchanged (safely skipped)       │
└─────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────┐
│  Functor Laws Diagram                                │
│                                                     │
│  Identity law: map(id) = id                          │
│                                                     │
│  ┌──────┐  map(id)  ┌──────┐                        │
│  │ F[3] │──────────▶│ F[3] │  nothing changes        │
│  └──────┘           └──────┘                        │
│                                                     │
│  Composition law: map(g).map(f) = map(g∘f)           │
│                                                     │
│  Method 1 (map twice):                               │
│  ┌──────┐  map(f)  ┌──────┐  map(g)  ┌──────┐      │
│  │ F[3] │────────▶│ F[6] │────────▶│ F[7] │      │
│  └──────┘          └──────┘          └──────┘      │
│                                                     │
│  Method 2 (compose then map once):                   │
│  ┌──────┐  map(g∘f) ┌──────┐                        │
│  │ F[3] │──────────▶│ F[7] │  same result            │
│  └──────┘           └──────┘                        │
│                                                     │
│  → Can be used for performance optimization          │
└─────────────────────────────────────────────────────┘
```

### Code Example 1: Complete Maybe Functor Implementation in TypeScript

```typescript
// === Complete implementation of the Maybe functor ===

class Maybe<T> {
  private constructor(private readonly value: T | null | undefined) {}

  static of<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  static nothing<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  static fromNullable<T>(value: T | null | undefined): Maybe<T> {
    return value == null ? Maybe.nothing<T>() : Maybe.of(value);
  }

  isNothing(): boolean {
    return this.value == null;
  }

  isJust(): boolean {
    return this.value != null;
  }

  // The core of a functor: map
  map<U>(fn: (value: T) => U): Maybe<U> {
    if (this.value == null) return Maybe.nothing<U>();
    return Maybe.of(fn(this.value));
  }

  getOrElse(defaultValue: T): T {
    return this.value == null ? defaultValue : this.value;
  }

  get(): T {
    if (this.value == null) throw new Error("Cannot get value of Nothing");
    return this.value;
  }

  toString(): string {
    return this.isNothing() ? "Nothing" : `Just(${this.value})`;
  }
}

// --- Usage examples ---

// Array is a functor
const nums = [1, 2, 3];
const doubled = nums.map(x => x * 2);       // [2, 4, 6]
const strings = nums.map(x => x.toString()); // ["1", "2", "3"]

// Promise is a functor
const data = fetch("/api/users")
  .then(res => res.json())    // map
  .then(users => users[0]);   // map

// Maybe is a functor
Maybe.of(5)
  .map(x => x * 2)    // Maybe(10)
  .map(x => x + 1);   // Maybe(11)

Maybe.nothing<number>()
  .map(x => x * 2)    // Nothing (skipped)
  .map(x => x + 1);   // Nothing (skipped)

// --- Verification of functor laws ---

// Identity function
const id = <T>(x: T): T => x;

// 1. Identity law: fa.map(id) === fa
const fa = Maybe.of(42);
const result1 = fa.map(id);
console.log(fa.toString());       // Just(42)
console.log(result1.toString());  // Just(42) ← same

const nothing = Maybe.nothing<number>();
const result2 = nothing.map(id);
console.log(nothing.toString());  // Nothing
console.log(result2.toString()); // Nothing ← same

// 2. Composition law: fa.map(f).map(g) === fa.map(x => g(f(x)))
const f = (x: number) => x * 2;
const g = (x: number) => x + 1;

const left  = fa.map(f).map(g);
const right = fa.map(x => g(f(x)));
console.log(left.toString());  // Just(85)
console.log(right.toString()); // Just(85) ← same
```

### Code Example 2: Option/Result Functor in Rust

```rust
// In Rust, Option and Result are standard functors (types with map)

fn main() {
    // === Option is a functor ===
    let x: Option<i32> = Some(5);
    let y = x.map(|n| n * 2);        // Some(10)
    let z = x.map(|n| n.to_string()); // Some("5")

    let none: Option<i32> = None;
    let w = none.map(|n| n * 2);      // None — safely skipped

    println!("y = {:?}", y);  // y = Some(10)
    println!("z = {:?}", z);  // z = Some("5")
    println!("w = {:?}", w);  // w = None

    // === Result is a functor ===
    let ok: Result<i32, String> = Ok(42);
    let mapped = ok.map(|n| n * 2);   // Ok(84)

    let err: Result<i32, String> = Err("failed".to_string());
    let err_mapped = err.map(|n| n * 2);  // Err("failed") — error is preserved

    println!("mapped = {:?}", mapped);       // mapped = Ok(84)
    println!("err_mapped = {:?}", err_mapped); // err_mapped = Err("failed")

    // === Verification of functor laws ===
    // Identity law
    let id_fn = |x: i32| x;
    assert_eq!(Some(5).map(id_fn), Some(5));
    assert_eq!(None::<i32>.map(id_fn), None);

    // Composition law
    let f = |x: i32| x * 2;
    let g = |x: i32| x + 1;
    assert_eq!(Some(5).map(f).map(g), Some(5).map(|x| g(f(x))));
    // Some(11) == Some(11)

    // === Practical chaining ===
    let config = get_config_value("database.port")
        .map(|s| s.trim().to_string())
        .map(|s| s.parse::<u16>())
        .and_then(|r| r.ok());
    // Option<u16> — safe type conversion chain

    println!("config = {:?}", config);
}

fn get_config_value(key: &str) -> Option<String> {
    match key {
        "database.port" => Some("5432 ".to_string()),
        _ => None,
    }
}
```

### Code Example 3: Functor Type Class in Haskell

```haskell
-- In Haskell, Functor is defined as a type class
-- This is the theoretical origin of functors

class Functor f where
    fmap :: (a -> b) -> f a -> f b

-- Functor instance for Maybe
instance Functor Maybe where
    fmap _ Nothing  = Nothing
    fmap f (Just a) = Just (f a)

-- Functor instance for lists
instance Functor [] where
    fmap = map

-- Usage examples
example1 = fmap (*2) (Just 5)      -- Just 10
example2 = fmap (*2) Nothing       -- Nothing
example3 = fmap (*2) [1, 2, 3]     -- [2, 4, 6]

-- <$> is the infix notation for fmap
example4 = (*2) <$> Just 5         -- Just 10
example5 = show <$> [1, 2, 3]      -- ["1", "2", "3"]

-- Verification of functor laws
-- Identity law: fmap id x == x
prop_identity :: (Functor f, Eq (f a)) => f a -> Bool
prop_identity x = fmap id x == x

-- Composition law: fmap (g . f) x == (fmap g . fmap f) x
prop_composition :: (Functor f, Eq (f c)) =>
                    (b -> c) -> (a -> b) -> f a -> Bool
prop_composition g f x = fmap (g . f) x == (fmap g . fmap f) x
```

### 1.4 Examples of Everyday Functors

Here is a summary of the functors we use on a daily basis.

```typescript
// 1. Array — the most familiar functor
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(x => x * 2); // [2, 4, 6, 8, 10]

// 2. Promise — an asynchronous functor
// .then() is equivalent to map (strictly speaking, it is also monadic bind)
const userPromise = fetch("/api/user")
  .then(res => res.json())       // map
  .then(data => data.name);      // map

// 3. Convert DOM NodeList to Array and map
const elements = Array.from(document.querySelectorAll(".item"));
const texts = elements.map(el => el.textContent);

// 4. Map object — can be used functor-style via entries
const prices = new Map([["apple", 100], ["banana", 200]]);
const discounted = new Map(
  Array.from(prices.entries()).map(([k, v]) => [k, v * 0.9])
);

// 5. Generic function to map over a TypeScript Record type
function mapRecord<K extends string, A, B>(
  record: Record<K, A>,
  fn: (a: A) => B
): Record<K, B> {
  const result = {} as Record<K, B>;
  for (const key in record) {
    result[key] = fn(record[key]);
  }
  return result;
}

const inventory = { apple: 10, banana: 20, cherry: 5 };
const doubled2 = mapRecord(inventory, x => x * 2);
// { apple: 20, banana: 40, cherry: 10 }
```

### 1.5 Comparison with Non-Functors

By examining examples that do not satisfy the functor laws or where the semantics of `map` are incorrect, we deepen our understanding of functors.

```typescript
// === Set is not (strictly speaking) a functor ===
// Reason: map can remove duplicates, which does not preserve structure

const s = new Set([1, 2, 3]);
// Set has no map, so convert to Array first
const mapped = new Set(Array.from(s).map(x => x % 2));
// Set {1, 0} — the number of elements changed from 3 to 2!
// A functor should preserve structure, but Set can change structure (element count)

// === subscribe on EventEmitter/Observable is not map ===
// It has side effects and does not satisfy the functor laws
// However, Observable.pipe(map(...)) in RxJS
// satisfies the functor laws if implemented correctly

// === Counter-example: a bad map that violates the identity law ===
class BadContainer<T> {
  constructor(public value: T, public count: number = 0) {}

  map<U>(fn: (value: T) => U): BadContainer<U> {
    // Incrementing count — this is a side effect!
    return new BadContainer(fn(this.value), this.count + 1);
  }
}

const c = new BadContainer(5);
const c2 = c.map(x => x); // { value: 5, count: 1 }
// c and c2 differ in count → identity law violation!
```

---

## 2. The Essence of Applicatives

### 2.1 The Problem Applicatives Solve

```
Applicative = a functor that has ap
=====================================

Problem: map can only apply functions with a single argument

  add takes 2 arguments: add(a, b) = a + b
  Maybe[3].map(add) → Maybe[(b) => 3 + b]
  ↑ The function is trapped inside Maybe!
  We want to apply this Maybe[(b) => 3 + b] to Maybe[5]
  → Impossible with functor's map alone

Solution: Applicative's ap (apply)
  F[A → B].ap(F[A])  -->  F[B]

  Maybe[add].ap(Maybe[3]).ap(Maybe[5])  -->  Maybe[8]

  A function trapped in a context can be applied
  to a value trapped in a context!

Combining independent values:
  Functor:      transforms one value
  Applicative:  combines multiple independent values
  Monad:        computation dependent on the previous result
```

**WHY**: Why do we need applicatives?

Functor's `map` can only accept single-argument functions. In real programming, however, it is common to combine two or more values to produce a new value.

- Username + email address + age → User object
- Price + quantity → total amount
- Multiple API results → integrated response

When each of these values is wrapped in a context (Maybe, Result, Promise), a functor alone cannot handle the combination. Applicatives solve this problem.

### 2.2 Applicative Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Functor vs Applicative vs Monad                              │
│                                                              │
│  ■ Functor (map): transforms one value                        │
│                                                              │
│    F[A] ──map(f)──▶ F[B]                                    │
│                                                              │
│    Maybe[3] ──map(×2)──▶ Maybe[6]                           │
│                                                              │
│  ■ Applicative (ap): combines multiple independent values     │
│                                                              │
│    F[A→B→C]                                                  │
│      │                                                       │
│      ├── ap(F[A]) ──▶ F[B→C]                                │
│      │                    │                                   │
│      │                    ├── ap(F[B]) ──▶ F[C]              │
│      │                                                       │
│    Maybe[add] ── ap(Maybe[3]) ── ap(Maybe[5]) ──▶ Maybe[8]  │
│                                                              │
│  ■ Monad (bind/flatMap): chains dependent computations        │
│                                                              │
│    F[A] ──bind(A→F[B])──▶ F[B] ──bind(B→F[C])──▶ F[C]     │
│                                                              │
│    Maybe[userId]                                             │
│      │                                                       │
│      ├── bind(findUser) ──▶ Maybe[User]                     │
│      │                          │                             │
│      │                          ├── bind(getOrders)          │
│      │                          │     ──▶ Maybe[Orders]     │
│      │                                                       │
│    The previous result is needed for the next computation    │
└──────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────┐
│  Error Handling Comparison: Applicative vs Monad              │
│                                                              │
│  ■ Monad (Either/Result): stops at the first error            │
│                                                              │
│    validate(name)  ──Err──▶ stops here                       │
│    validate(email) ──────▶ not executed                      │
│    validate(age)   ──────▶ not executed                      │
│    Result: Err("name is invalid")                             │
│                                                              │
│  ■ Applicative (Validation): accumulates all errors           │
│                                                              │
│    validate(name)  ──Err1──┐                                 │
│    validate(email) ──Err2──┼──▶ combines all errors          │
│    validate(age)   ──Err3──┘                                 │
│    Result: Err(["name is invalid", "email is invalid",        │
│                 "age is invalid"])                            │
│                                                              │
│  → For form validation,                                       │
│    applicative is overwhelmingly more convenient             │
└──────────────────────────────────────────────────────────────┘
```

### Code Example 4: Complete Applicative Implementation (Maybe)

```typescript
// === Complete implementation of Maybe as Functor + Applicative + Monad ===

class Maybe<T> {
  private constructor(private readonly value: T | null | undefined) {}

  static of<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  static nothing<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  static fromNullable<T>(value: T | null | undefined): Maybe<T> {
    return value == null ? Maybe.nothing<T>() : Maybe.of(value);
  }

  isNothing(): boolean {
    return this.value == null;
  }

  // --- Functor ---
  map<U>(fn: (value: T) => U): Maybe<U> {
    if (this.value == null) return Maybe.nothing<U>();
    return Maybe.of(fn(this.value));
  }

  // --- Applicative ---
  // ap: apply a function wrapped in Maybe to a value wrapped in Maybe
  ap<U>(maybeFn: Maybe<(value: T) => U>): Maybe<U> {
    if (this.value == null || maybeFn.isNothing()) return Maybe.nothing<U>();
    return Maybe.of(maybeFn.get()(this.value));
  }

  // --- Monad ---
  flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    if (this.value == null) return Maybe.nothing<U>();
    return fn(this.value);
  }

  // --- Utilities ---
  getOrElse(defaultValue: T): T {
    return this.value == null ? defaultValue : this.value;
  }

  get(): T {
    if (this.value == null) throw new Error("Cannot get value of Nothing");
    return this.value;
  }

  toString(): string {
    return this.isNothing() ? "Nothing" : `Just(${this.value})`;
  }
}

// === liftA2, liftA3: lift multi-argument functions into the applicative ===

function liftA2<A, B, C>(
  fn: (a: A, b: B) => C,
  ma: Maybe<A>,
  mb: Maybe<B>
): Maybe<C> {
  // Curry and apply with ap
  return mb.ap(ma.map(a => (b: B) => fn(a, b)));
}

function liftA3<A, B, C, D>(
  fn: (a: A, b: B, c: C) => D,
  ma: Maybe<A>,
  mb: Maybe<B>,
  mc: Maybe<C>
): Maybe<D> {
  return mc.ap(mb.ap(ma.map(a => (b: B) => (c: C) => fn(a, b, c))));
}

// === Usage examples ===

// Combine two Maybe values
const price = Maybe.of(100);
const quantity = Maybe.of(3);
const total = liftA2((p, q) => p * q, price, quantity);
console.log(total.toString()); // Just(300)

// If either is Nothing, the result is also Nothing
const noPrice = Maybe.nothing<number>();
const noTotal = liftA2((p, q) => p * q, noPrice, quantity);
console.log(noTotal.toString()); // Nothing

// Combine three Maybe values to create a user object
interface User {
  name: string;
  email: string;
  age: number;
}

const createUser = (name: string, email: string, age: number): User => ({
  name,
  email,
  age,
});

const userName = Maybe.of("Taro");
const userEmail = Maybe.of("taro@example.com");
const userAge = Maybe.of(30);

const user = liftA3(createUser, userName, userEmail, userAge);
console.log(user.toString());
// Just({name: "Taro", email: "taro@example.com", age: 30})

// If even one is Nothing, the whole result is Nothing
const noEmail = Maybe.nothing<string>();
const noUser = liftA3(createUser, userName, noEmail, userAge);
console.log(noUser.toString()); // Nothing
```

### Code Example 5: Applicative Validation (Error Accumulation)

```typescript
// === Validation: the greatest advantage of applicatives ===
// With a monad (flatMap), computation stops at the first error,
// but with an applicative, all errors can be collected

type Validation<E, A> =
  | { tag: "Success"; value: A }
  | { tag: "Failure"; errors: E[] };

function success<E, A>(value: A): Validation<E, A> {
  return { tag: "Success", value };
}

function failure<E, A>(errors: E[]): Validation<E, A> {
  return { tag: "Failure", errors };
}

function failOne<E, A>(error: E): Validation<E, A> {
  return { tag: "Failure", errors: [error] };
}

// map (functor)
function mapV<E, A, B>(
  va: Validation<E, A>,
  fn: (a: A) => B
): Validation<E, B> {
  return va.tag === "Success" ? success(fn(va.value)) : va;
}

// ap (applicative) — accumulates errors
function apV<E, A, B>(
  vf: Validation<E, (a: A) => B>,
  va: Validation<E, A>
): Validation<E, B> {
  if (vf.tag === "Failure" && va.tag === "Failure") {
    return failure([...vf.errors, ...va.errors]);  // accumulates both errors!
  }
  if (vf.tag === "Failure") return failure(vf.errors);
  if (va.tag === "Failure") return failure(va.errors);
  return success(vf.value(va.value));
}

// liftA2V, liftA3V
function liftA2V<E, A, B, C>(
  fn: (a: A, b: B) => C,
  va: Validation<E, A>,
  vb: Validation<E, B>
): Validation<E, C> {
  return apV(mapV(va, (a: A) => (b: B) => fn(a, b)), vb);
}

function liftA3V<E, A, B, C, D>(
  fn: (a: A, b: B, c: C) => D,
  va: Validation<E, A>,
  vb: Validation<E, B>,
  vc: Validation<E, C>
): Validation<E, D> {
  return apV(apV(mapV(va, (a: A) => (b: B) => (c: C) => fn(a, b, c)), vb), vc);
}

// === Validation functions ===

interface ValidationError {
  field: string;
  message: string;
}

function validateName(name: string): Validation<ValidationError, string> {
  if (name.length === 0) {
    return failOne({ field: "name", message: "Name is required" });
  }
  if (name.length < 2) {
    return failOne({ field: "name", message: "Name must be at least 2 characters" });
  }
  if (name.length > 50) {
    return failOne({ field: "name", message: "Name must be 50 characters or less" });
  }
  return success(name);
}

function validateEmail(email: string): Validation<ValidationError, string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return failOne({ field: "email", message: "Please enter a valid email address" });
  }
  return success(email);
}

function validateAge(age: number): Validation<ValidationError, number> {
  if (!Number.isInteger(age)) {
    return failOne({ field: "age", message: "Age must be an integer" });
  }
  if (age < 0 || age > 150) {
    return failOne({ field: "age", message: "Age must be between 0 and 150" });
  }
  if (age < 18) {
    return failOne({ field: "age", message: "Must be 18 years or older" });
  }
  return success(age);
}

// === Validation for user registration form ===

interface UserRegistration {
  name: string;
  email: string;
  age: number;
}

function validateUserRegistration(input: {
  name: string;
  email: string;
  age: number;
}): Validation<ValidationError, UserRegistration> {
  const vName = validateName(input.name);
  const vEmail = validateEmail(input.email);
  const vAge = validateAge(input.age);

  return liftA3V(
    (name, email, age) => ({ name, email, age }),
    vName,
    vEmail,
    vAge
  );
}

// === Execution examples ===

// All fields are invalid → all errors are accumulated
const result1 = validateUserRegistration({
  name: "",
  email: "invalid",
  age: 10,
});
console.log(result1);
// {
//   tag: "Failure",
//   errors: [
//     { field: "name", message: "Name is required" },
//     { field: "email", message: "Please enter a valid email address" },
//     { field: "age", message: "Must be 18 years or older" }
//   ]
// }
// → With a monad, it would have stopped at "Name is required"!

// When all are valid
const result2 = validateUserRegistration({
  name: "Taro",
  email: "taro@example.com",
  age: 25,
});
console.log(result2);
// { tag: "Success", value: { name: "Taro", email: "taro@example.com", age: 25 } }
```

### Code Example 6: Promise.all Is an Applicative

```typescript
// === Promise.all is equivalent to the applicative's ap ===

// WHY: Independent async operations can be run in parallel
// → Significant speedup compared to sequential execution

// --- Applicative (Promise.all): run independent operations in parallel ---
async function getUserDashboard(userId: string) {
  // The 3 API calls are independent of each other
  const [user, orders, settings] = await Promise.all([
    fetchUser(userId),        // 200ms
    fetchOrders(userId),      // 300ms
    fetchSettings(userId),    // 150ms
  ]);
  // Total: max(200, 300, 150) = 300ms (parallel execution)

  return {
    userName: user.name,
    orderCount: orders.length,
    theme: settings.theme,
  };
}

// --- Monad (sequential async/await): run dependent operations sequentially ---
async function getOrderDetails(userId: string) {
  const user = await fetchUser(userId);                   // 200ms
  const orders = await fetchOrders(user.id);              // 300ms (depends on user)
  const details = await fetchOrderDetails(orders[0].id);  // 100ms (depends on orders)
  // Total: 200 + 300 + 100 = 600ms (sequential execution)

  return details;
}

// --- Promise.allSettled: get all results even if some fail ---
async function getUserDataSafe(userId: string) {
  const results = await Promise.allSettled([
    fetchUser(userId),
    fetchOrders(userId),
    fetchSettings(userId),
  ]);

  return results.map((r, i) => {
    if (r.status === "fulfilled") {
      return { success: true, data: r.value };
    } else {
      return { success: false, error: r.reason, index: i };
    }
  });
}

// --- Practical example: parallel batch API request processing ---
async function batchFetch<T>(
  urls: string[],
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url => fetch(url).then(r => r.json() as Promise<T>))
    );
    results.push(...batchResults);
  }
  return results;
}
```

### Code Example 7: Applicative-Style Operations in Rust

```rust
// Rust has no direct applicative syntax, but
// equivalent patterns can be achieved

fn main() {
    // === Option's zip: applicative-style combination ===
    let x: Option<i32> = Some(3);
    let y: Option<i32> = Some(5);
    let sum = x.zip(y).map(|(a, b)| a + b);
    println!("sum = {:?}", sum); // Some(8)

    let z: Option<i32> = None;
    let no_sum = x.zip(z).map(|(a, b)| a + b);
    println!("no_sum = {:?}", no_sum); // None

    // === Practical: parallel config parsing ===
    let config = parse_config("8080", "localhost", "mydb");
    println!("config = {:?}", config);
    // Some(ServerConfig { port: 8080, host: "localhost", db: "mydb" })

    // === Error-accumulating validation ===
    let result = validate_user_input("", "bad-email", -5);
    println!("validation = {:?}", result);
    // Err(["Name is required", "Invalid email address", "Age must be 0 or greater"])
}

#[derive(Debug)]
struct ServerConfig {
    port: u16,
    host: String,
    db: String,
}

fn parse_config(port_str: &str, host: &str, db: &str) -> Option<ServerConfig> {
    let port = port_str.parse::<u16>().ok()?;
    Some(ServerConfig {
        port,
        host: host.to_string(),
        db: db.to_string(),
    })
}

// Error-accumulating validation (applicative-style)
fn validate_user_input(
    name: &str,
    email: &str,
    age: i32,
) -> Result<(String, String, i32), Vec<String>> {
    let mut errors = Vec::new();

    if name.is_empty() {
        errors.push("Name is required".to_string());
    }
    if !email.contains('@') {
        errors.push("Invalid email address".to_string());
    }
    if age < 0 {
        errors.push("Age must be 0 or greater".to_string());
    }

    if errors.is_empty() {
        Ok((name.to_string(), email.to_string(), age))
    } else {
        Err(errors)
    }
}

// === Iterator zip: applicative-style operation ===
fn applicative_iterators() {
    let names = vec!["Alice", "Bob", "Charlie"];
    let ages = vec![30, 25, 35];
    let scores = vec![95, 87, 92];

    // Combine 3 iterators with zip
    let students: Vec<_> = names.iter()
        .zip(ages.iter())
        .zip(scores.iter())
        .map(|((name, age), score)| {
            format!("{}: age={}, score={}", name, age, score)
        })
        .collect();

    for s in &students {
        println!("{}", s);
    }
    // Alice: age=30, score=95
    // Bob: age=25, score=87
    // Charlie: age=35, score=92
}
```

---

## 3. The Type Class Hierarchy

### 3.1 The Relationship of Functor < Applicative < Monad

```
┌─────────────────────────────────────────────────────────────┐
│  Type class hierarchy (category-theoretic containment)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Monad                                              │   │
│  │  bind/flatMap: F[A] → (A → F[B]) → F[B]            │   │
│  │  chaining dependent computations                    │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Applicative                                │   │   │
│  │  │  ap:   F[A → B] → F[A] → F[B]              │   │   │
│  │  │  pure: A → F[A]                             │   │   │
│  │  │  combining independent values               │   │   │
│  │  │                                             │   │   │
│  │  │  ┌─────────────────────────────────────┐   │   │   │
│  │  │  │  Functor                            │   │   │   │
│  │  │  │  map/fmap: F[A] → (A → B) → F[B]   │   │   │   │
│  │  │  │  transforming one value              │   │   │   │
│  │  │  └─────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Important: every monad is an applicative, and              │
│             every applicative is a functor                   │
│                                                             │
│  But the reverse does not hold:                              │
│  - Validation is an applicative but not a monad              │
│    (error accumulation requires an applicative)              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Comparison Table for Choosing

| Characteristic | Functor (map) | Applicative (ap) | Monad (bind) |
|---|---|---|---|
| **Transform one value** | Possible | Possible | Possible |
| **Combine multiple values** | Not possible | Possible | Possible |
| **Error accumulation** | Not possible | Possible | Not possible (stops at first) |
| **Dependent computation** | Not possible | Not possible | Possible |
| **Parallel execution** | — | Possible | Not possible (sequential) |
| **Static analysis of computation** | Possible | Possible | Not possible (dynamic) |
| **Everyday example** | Array.map | Promise.all | async/await |
| **Haskell** | fmap / <$> | <*> | >>= / do |
| **TypeScript** | .map() | Promise.all() | .then() / await |
| **Rust** | .map() | .zip() | .and_then() / ? |

### 3.3 Criteria for Choosing Applicative vs Monad

```
┌─────────────────────────────────────────────────────────┐
│  Selection flowchart                                     │
│                                                         │
│  "Does computation B depend on the result of A?"         │
│        │                                                │
│        ├── YES → Monad (flatMap / bind / await)          │
│        │         e.g.: fetchUser → fetchOrders(user.id)  │
│        │                                                │
│        └── NO  → Applicative (ap / Promise.all)          │
│                  e.g.: fetchUser + fetchProducts + fetchAds│
│                                                         │
│  Additionally:                                           │
│  "Do you want to collect all errors?"                    │
│        │                                                │
│        ├── YES → Validation (applicative)                │
│        │         e.g.: form validation                   │
│        │                                                │
│        └── NO  → Either/Result (monad)                   │
│                  e.g.: abort on first error, early return│
│                                                         │
│  From a performance perspective:                         │
│  - Applicative allows parallel execution                 │
│  - Monad requires sequential execution (each step needs  │
│    the previous result)                                  │
│  - Prefer applicative when possible for better speed     │
└─────────────────────────────────────────────────────────┘
```

### Code Example 8: Practical Example Showing the Difference in Capability at Each Level

```typescript
// === Functor level: transforming one value ===

// Get display name from user ID
const displayName = Maybe.fromNullable(user)
  .map(u => u.firstName + " " + u.lastName)
  .map(name => name.trim())
  .map(name => name.toUpperCase());
// Maybe<string>: Just("TARO YAMADA") or Nothing

// === Applicative level: combining independent values ===

// Independently validate 3 form fields and combine
const validatedForm = liftA3V(
  (name, email, age) => ({ name, email, age }),
  validateName(formData.name),
  validateEmail(formData.email),
  validateAge(formData.age)
);
// Validation<Error[], FormData>
// Errors accumulate for all fields

// === Monad level: chaining dependent computations ===

// Fetch user → check permissions → fetch data
const result = Maybe.fromNullable(userId)
  .flatMap(id => findUser(id))           // Maybe<User>
  .flatMap(user => checkPermission(user)) // Maybe<Permission>
  .flatMap(perm => fetchData(perm));      // Maybe<Data>
// Each step depends on the result of the previous step

// === Examples of incorrect choices ===

// [NG] Writing independent operations with monad (unnecessarily sequential)
const user2 = await fetchUser(userId);      // 200ms
const products = await fetchProducts();      // 300ms (does not depend on user!)
const ads = await fetchAds();                // 100ms (does not depend on above!)
// Total: 600ms

// [OK] Write with applicative (parallel execution)
const [user3, products2, ads2] = await Promise.all([
  fetchUser(userId),    // 200ms
  fetchProducts(),      // 300ms
  fetchAds(),           // 100ms
]);
// Total: 300ms (2x faster!)
```

### 3.4 Everyday Correspondence Table

| Abstraction | Array | Promise | Option/Maybe | Result/Either | IO |
|---|---|---|---|---|---|
| **Functor (map)** | `.map()` | `.then()` | `.map()` | `.map()` | `.map()` |
| **Applicative** | `zip`/spread | `Promise.all()` | `liftA2` | `Validation` | `liftA2` |
| **Monad (bind)** | `.flatMap()` | `async/await` | `.flatMap()`/`?.` | `?` operator | `do` notation |

---

## 4. Connection to Category Theory — Intuitive Understanding

### 4.1 Category Theory for Programmers

```
┌──────────────────────────────────────────────────────────────┐
│  Correspondence between category theory concepts              │
│  and programming                                             │
│                                                              │
│  Category theory    Programming                              │
│  ──────────────     ─────────────                            │
│  Category           The world of types                       │
│  Object             Type (Int, String, User, ...)            │
│  Morphism           Function (A → B)                        │
│  Composition (∘)    Function composition (f ∘ g)(x) = f(g(x))│
│  Identity (id)      Identity function id(x) = x             │
│                                                              │
│  Functor            A "structure-preserving map" from        │
│                     one category to another                  │
│                     F: C → D                                 │
│                     - Objects to objects:  A → F[A]          │
│                     - Morphisms to morphisms: (A→B) → (F[A]→F[B])│
│                     This is map!                             │
│                                                              │
│  Natural            A "structure-preserving transformation"  │
│  Transformation     between functors                        │
│                     Maybe[A] → List[A]                       │
│                     e.g.: maybeToList(Just 5) = [5]          │
│                           maybeToList(Nothing) = []          │
│                                                              │
│  Monad              A monoid in the category of endofunctors │
│                     (join: F[F[A]] → F[A] and pure: A → F[A])│
│                     flatMap = join ∘ map                     │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Why Category Theory Is Useful

Practical value of knowing category theory:

1. **API design**: Designing a `map` that satisfies the functor laws lets users refactor with confidence
2. **Performance optimization**: The composition law allows merging a chain of `map` calls into a single `map`
3. **Understanding libraries**: The APIs of libraries like fp-ts, cats, and scalaz become intuitively understandable
4. **Pattern discovery**: Asking "can I implement map on this type?" leads to discovering new abstractions

---

## 5. Advanced Topics

### 5.1 Traversable — An Applicative Inside a Functor

```typescript
// Traversable: swap the order of contexts
// Problem: we have Array<Maybe<number>> but want Maybe<Array<number>>
// In other words, "if even one is Nothing, make the whole thing Nothing"

function sequence<A>(maybes: Maybe<A>[]): Maybe<A[]> {
  return maybes.reduce<Maybe<A[]>>(
    (acc, maybe) =>
      liftA2((arr, val) => [...arr, val], acc, maybe),
    Maybe.of([] as A[])
  );
}

// map then sequence (more efficient)
function traverse<A, B>(
  fn: (a: A) => Maybe<B>,
  arr: A[]
): Maybe<B[]> {
  return arr.reduce<Maybe<B[]>>(
    (acc, item) =>
      liftA2((arr, val) => [...arr, val], acc, fn(item)),
    Maybe.of([] as B[])
  );
}

// Usage examples
const ids = [1, 2, 3, 4, 5];

// Just([users]) if all users are found, Nothing if any one is not found
const allUsers = traverse(id => findUserById(id), ids);
// Maybe<User[]>

// sequence usage example
const maybeNumbers: Maybe<number>[] = [
  Maybe.of(1),
  Maybe.of(2),
  Maybe.of(3),
];
const seqResult = sequence(maybeNumbers);
// Just([1, 2, 3])

const withNothing: Maybe<number>[] = [
  Maybe.of(1),
  Maybe.nothing(),
  Maybe.of(3),
];
const seqResult2 = sequence(withNothing);
// Nothing — if even one is Nothing, the whole is Nothing
```

### 5.2 Contravariant Functor

```typescript
// An ordinary functor maps on the "output" side (covariant)
// A contravariant functor maps on the "input" side (contravariant)

// Ordinary functor:      F[A] → (A → B) → F[B]
// Contravariant functor: F[A] → (B → A) → F[B]

// Example: a Comparator is a contravariant functor
interface Comparator<A> {
  compare: (a1: A, a2: A) => number;
}

// contramap: transform the input side
function contramap<A, B>(
  comp: Comparator<A>,
  fn: (b: B) => A
): Comparator<B> {
  return {
    compare: (b1, b2) => comp.compare(fn(b1), fn(b2)),
  };
}

// Number comparator
const numberComparator: Comparator<number> = {
  compare: (a, b) => a - b,
};

// Compare by string length (contravariant mapping)
const byLength = contramap(numberComparator, (s: string) => s.length);
// Comparator<string>

// Compare people by age (contravariant mapping)
interface Person {
  name: string;
  age: number;
}

const byAge = contramap(numberComparator, (p: Person) => p.age);
// Comparator<Person>

// Usage
const people: Person[] = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
  { name: "Charlie", age: 35 },
];

const sorted = [...people].sort(byAge.compare);
// [Bob(25), Alice(30), Charlie(35)]

// Contravariant functor laws:
// 1. Identity law: contramap(id) = id
// 2. Composition law: contramap(f).contramap(g) = contramap(g . f)
//    (Note: the order of composition is reversed compared to ordinary functors!)
```

### 5.3 Free Applicative Pattern

```typescript
// Free Applicative: build applicative operations as
// a data structure and interpret them later

// Declarative API request definition
type ApiRequest<A> =
  | { tag: "Pure"; value: A }
  | { tag: "Fetch"; url: string; parse: (data: unknown) => A }
  | { tag: "Ap"; fn: ApiRequest<(a: any) => A>; arg: ApiRequest<any> };

function pureReq<A>(value: A): ApiRequest<A> {
  return { tag: "Pure", value };
}

function fetchReq<A>(url: string, parse: (data: unknown) => A): ApiRequest<A> {
  return { tag: "Fetch", url, parse };
}

function apReq<A, B>(
  fn: ApiRequest<(a: A) => B>,
  arg: ApiRequest<A>
): ApiRequest<B> {
  return { tag: "Ap", fn, arg };
}

function mapReq<A, B>(req: ApiRequest<A>, fn: (a: A) => B): ApiRequest<B> {
  return apReq(pureReq(fn), req);
}

function liftA2Req<A, B, C>(
  fn: (a: A, b: B) => C,
  ra: ApiRequest<A>,
  rb: ApiRequest<B>
): ApiRequest<C> {
  return apReq(mapReq(ra, (a: A) => (b: B) => fn(a, b)), rb);
}

// Request declaration (not executed at this point)
const userReq = fetchReq("/api/user/1", (d: any) => d as User);
const ordersReq = fetchReq("/api/orders?user=1", (d: any) => d as Order[]);

const dashboardReq = liftA2Req(
  (user, orders) => ({ user, orders }),
  userReq,
  ordersReq
);

// === Interpreter 1: parallel execution ===
async function runParallel<A>(req: ApiRequest<A>): Promise<A> {
  if (req.tag === "Pure") return req.value;
  if (req.tag === "Fetch") {
    const res = await fetch(req.url);
    const data = await res.json();
    return req.parse(data);
  }
  // Ap: run function and argument in parallel
  const [fn, arg] = await Promise.all([
    runParallel(req.fn),
    runParallel(req.arg),
  ]);
  return fn(arg);
}

// === Interpreter 2: collect URLs (for testing or logging) ===
function collectUrls<A>(req: ApiRequest<A>): string[] {
  if (req.tag === "Pure") return [];
  if (req.tag === "Fetch") return [req.url];
  return [...collectUrls(req.fn), ...collectUrls(req.arg)];
}

// Usage examples
const urls = collectUrls(dashboardReq);
// ["/api/user/1", "/api/orders?user=1"]

const dashboard = await runParallel(dashboardReq);
// { user: ..., orders: [...] }
```

### 5.4 Applicative Patterns in React

```tsx
// === Parallel queries with React Query (TanStack Query) ===

function Dashboard({ userId }: { userId: string }) {
  // Run 3 queries in parallel (applicative)
  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
  });
  const ordersQuery = useQuery({
    queryKey: ["orders", userId],
    queryFn: () => fetchOrders(userId),
  });
  const settingsQuery = useQuery({
    queryKey: ["settings", userId],
    queryFn: () => fetchSettings(userId),
  });

  // Combine loading states of all queries
  if (userQuery.isLoading || ordersQuery.isLoading || settingsQuery.isLoading) {
    return <Loading />;
  }

  // Error accumulation (applicative-style)
  const errors = [userQuery.error, ordersQuery.error, settingsQuery.error]
    .filter(Boolean);
  if (errors.length > 0) {
    return <ErrorList errors={errors} />;
  }

  // Render only when all data is available
  return (
    <DashboardView
      user={userQuery.data!}
      orders={ordersQuery.data!}
      settings={settingsQuery.data!}
    />
  );
}

// === Form validation ===
function useFormValidation<T extends Record<string, unknown>>(
  validators: Record<keyof T, (value: unknown) => Validation<string, unknown>>
) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const validate = (formData: Record<string, unknown>): boolean => {
    const allErrors: Record<string, string[]> = {};
    let hasError = false;

    for (const [field, validator] of Object.entries(validators)) {
      const result = (validator as Function)(formData[field]);
      if (result.tag === "Failure") {
        allErrors[field] = result.errors;
        hasError = true;
      }
    }

    setErrors(allErrors);
    return !hasError;
  };

  return { validate, errors };
}
```

### 5.5 Type Class Hierarchy in Haskell

```haskell
-- In Haskell, Functor, Applicative, and Monad are
-- explicitly defined as type classes

-- === Functor ===
class Functor f where
    fmap :: (a -> b) -> f a -> f b

-- === Applicative ===
class Functor f => Applicative f where
    pure  :: a -> f a
    (<*>) :: f (a -> b) -> f a -> f b

-- === Monad ===
class Applicative m => Monad m where
    (>>=) :: m a -> (a -> m b) -> m b

-- === Usage examples ===

-- Functor
ex1 = fmap (+1) (Just 5)              -- Just 6
ex2 = fmap (+1) [1, 2, 3]             -- [2, 3, 4]

-- Applicative
ex3 = pure (+) <*> Just 3 <*> Just 5  -- Just 8
ex4 = pure (+) <*> Nothing <*> Just 5 -- Nothing

-- List applicative (Cartesian product = all combinations)
ex5 = pure (+) <*> [1, 2] <*> [10, 20]
-- [11, 21, 12, 22]

-- Creating a user in applicative style
data User = User String String Int deriving (Show)

mkUser :: String -> String -> Int -> User
mkUser = User

validUser = mkUser <$> validateName "Taro"
                   <*> validateEmail "taro@example.com"
                   <*> validateAge 25

-- Monad (do notation)
ex6 = do
    user  <- findUser userId
    perms <- checkPermissions user
    fetchData perms
```

---

## Anti-Patterns

### 1. Using Applicative Where Monad Should Be Used

```typescript
// [NG] Forcing applicative for operations where the result of one depends on another
// Problem: orders depends on user.id, but we try to run it in parallel

// fetchOrders needs user.id (the ID in the fetched result), not userId
const [user, orders] = await Promise.all([
  fetchUser(userId),
  fetchOrders(userId),  // should use user.id, but falling back to userId
]);

// [OK] Use monad (async/await) when there is a dependency
const user = await fetchUser(userId);
const orders = await fetchOrders(user.id);  // depends on user.id
const details = await fetchOrderDetails(orders[0].id);  // depends on orders

// Criterion: "Does the subsequent operation take the 'result' of the previous one as an argument?"
// YES → Monad (sequential), NO → Applicative (parallelizable)
```

### 2. A map Implementation That Violates the Functor Laws

```typescript
// [NG] Performing side effects inside map
class BadMaybe<T> {
  private value: T | null;

  map<U>(fn: (value: T) => U): BadMaybe<U> {
    console.log("mapping!");  // side effect!
    // Identity law: badMaybe.map(id) will print "mapping!"
    // → An observable side effect occurs even though only id was applied → identity law violation
    if (this.value == null) return BadMaybe.nothing();
    return BadMaybe.of(fn(this.value));
  }
}

// [OK] map is for pure transformation only; use a separate method for side effects
class GoodMaybe<T> {
  private value: T | null;

  map<U>(fn: (value: T) => U): GoodMaybe<U> {
    if (this.value == null) return GoodMaybe.nothing();
    return GoodMaybe.of(fn(this.value));
  }

  // Explicit method for side effects
  tap(fn: (value: T) => void): GoodMaybe<T> {
    if (this.value != null) fn(this.value);
    return this; // returns the original value
  }
}

// Usage example
GoodMaybe.of(42)
  .tap(x => console.log(`Value: ${x}`))  // side effects go in tap
  .map(x => x * 2);                       // map stays pure
```

### 3. Confusing Validation with Either/Result

```typescript
// [NG] Validation with Either (monad) → stops at the first error
function validateWithEither(input: FormData): Either<string, User> {
  const name = validateName(input.name);  // If Err, cannot proceed to next
  if (name.isLeft()) return name;         // only "name is too short" is returned

  const email = validateEmail(input.email); // may not be reached
  if (email.isLeft()) return email;

  const age = validateAge(input.age);       // may not be reached either
  if (age.isLeft()) return age;

  return Right(createUser(name.get(), email.get(), age.get()));
}
// → Users can only fix one error at a time (poor UX)

// [OK] Validation (applicative) → collects all errors
function validateWithApplicative(input: FormData): Validation<string[], User> {
  return liftA3V(
    createUser,
    validateName(input.name),    // all executed independently
    validateEmail(input.email),  // all executed independently
    validateAge(input.age)       // all executed independently
  );
  // ["name is too short", "invalid email address", "age is invalid"] are all returned
  // → Users can see all errors at once (good UX)
}
```

### 4. Over-Abstraction — YAGNI

```typescript
// [NG] Implementing a full type class hierarchy for a small project
// TypeScript's type system cannot express higher-kinded types well
interface Functor<F> {
  map<A, B>(fa: F, fn: (a: A) => B): F;  // the type parameter of F is lost
}
interface Applicative<F> extends Functor<F> {
  pure<A>(a: A): F;
  ap<A, B>(ff: F, fa: F): F;
}
// → Just complex with little practical benefit

// [OK] Implement only what is needed, simply
// Implement Maybe.map, Maybe.flatMap directly,
// and use type class concepts as design guidelines in your head

// If a proper type class hierarchy is truly needed, use the fp-ts library
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/function";

const result = pipe(
  O.some(5),
  O.map(x => x * 2),
  O.getOrElse(() => 0)
);
```

---

## Practical Exercises

### Exercise 1 (Basic): Implement a Maybe Functor and Verify the Functor Laws

**Task**: Implement `map` for the `Maybe` class below and verify the functor laws (identity law and composition law) with test code.

```typescript
class Maybe<T> {
  private constructor(private readonly value: T | null) {}

  static of<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  static nothing<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  isNothing(): boolean {
    return this.value === null;
  }

  // TODO: Implement map
  map<U>(fn: (value: T) => U): Maybe<U> {
    // implement here
  }

  getOrElse(defaultValue: T): T {
    return this.value === null ? defaultValue : this.value;
  }

  equals(other: Maybe<T>): boolean {
    if (this.isNothing() && other.isNothing()) return true;
    if (this.isNothing() || other.isNothing()) return false;
    return this.value === other.getOrElse(null as any);
  }
}

// TODO: Make all the following tests PASS
const id = <T>(x: T): T => x;
const f = (x: number) => x * 2;
const g = (x: number) => x + 1;

// Test 1: Identity law (Just)
console.assert(Maybe.of(42).map(id).equals(Maybe.of(42)));
// Test 2: Identity law (Nothing)
console.assert(Maybe.nothing<number>().map(id).equals(Maybe.nothing<number>()));
// Test 3: Composition law (Just)
console.assert(Maybe.of(5).map(f).map(g).equals(Maybe.of(5).map(x => g(f(x)))));
// Test 4: Composition law (Nothing)
console.assert(Maybe.nothing<number>().map(f).map(g).equals(Maybe.nothing<number>().map(x => g(f(x)))));
```

**Expected output**:

```
Identity law (Just): PASS — Just(42).map(id) === Just(42)
Identity law (Nothing): PASS — Nothing.map(id) === Nothing
Composition law (Just): PASS — Just(5).map(f).map(g) === Just(5).map(g∘f)
Composition law (Nothing): PASS — Nothing.map(f).map(g) === Nothing.map(g∘f)
All tests passed!
```

### Exercise 2 (Applied): Implement Applicative Validation

**Task**: Build an applicative validation system that satisfies the following requirements.

Requirements:
1. Implement the `Validation<E, A>` type (Success/Failure)
2. Implement `map` and `ap` (`ap` should accumulate errors)
3. Implement the following validation functions:
   - `validateUsername`: 3–20 characters, alphanumeric only
   - `validatePassword`: at least 8 characters, must contain at least one uppercase letter, one lowercase letter, and one digit
   - `validateConfirmPassword`: must match the password
4. Use `liftA3V` to combine all validations
5. Verify that all errors are accumulated when all fields are invalid

```typescript
// TODO: Implement Validation type, map, ap, liftA2V, liftA3V

// TODO: Implement validation functions

// Test cases
const result1 = validateRegistration({
  username: "ab",           // too short
  password: "weak",         // insufficient conditions
  confirmPassword: "wrong", // does not match
});
// Expected: Failure(["Username must be at least 3 characters...", "Password must be at least 8 characters...", ...])

const result2 = validateRegistration({
  username: "validuser",
  password: "Str0ngPass",
  confirmPassword: "Str0ngPass",
});
// Expected: Success({ username: "validuser", password: "Str0ngPass" })
```

**Expected output**:

```
Test 1 (all fields invalid):
  Failure:
    - Username must be between 3 and 20 characters
    - Password must be at least 8 characters
    - Password must contain an uppercase letter
    - Password must contain a digit
    - Passwords do not match

Test 2 (all fields valid):
  Success: { username: "validuser", password: "Str0ngPass" }
```

### Exercise 3 (Advanced): Declarative API Client Using Free Applicative

**Task**: Implement a declarative API client using the Free Applicative pattern.

Requirements:
1. Define the `ApiRequest<A>` type (three cases: Pure, Fetch, Ap)
2. Implement `map`, `ap`, and `liftA2`
3. Implement the following two interpreters:
   - `runParallel`: execute requests in parallel (using Promise.all)
   - `collectUrls`: collect all URLs without executing
4. Test with a mock server

```typescript
// TODO: Define ApiRequest<A> type

// TODO: Implement map, ap, liftA2

// TODO: Implement runParallel, collectUrls interpreters

// Test cases
const dashboardReq = liftA2Req(
  (user, orders) => ({ user, orders }),
  fetchReq<User>("/api/user/1", data => data as User),
  fetchReq<Order[]>("/api/orders?user=1", data => data as Order[]),
);

// Collect URLs (analyze without executing)
const urls = collectUrls(dashboardReq);
console.log(urls); // ["/api/user/1", "/api/orders?user=1"]

// Parallel execution
const result = await runParallel(dashboardReq);
console.log(result); // { user: {...}, orders: [...] }
```

**Expected output**:

```
Collected URLs:
  /api/user/1
  /api/orders?user=1

Parallel execution result:
  Request: GET /api/user/1 ... 200 OK (120ms)
  Request: GET /api/orders?user=1 ... 200 OK (85ms)
  Combined result: { user: { id: 1, name: "Taro" }, orders: [{ id: 101, ... }] }
```

---

## FAQ

### Q1: When should I use an applicative?

**A**: Use it when you want to "combine the results of multiple independent computations." Three typical cases:

1. **Form validation**: When you want to display all field errors at once. With a monad, computation stops at the first error, so you need an applicative (Validation type) to collect all errors
2. **Parallel API calls**: `Promise.all` is the quintessential example of an applicative for running independent async operations in parallel
3. **Parser combinators**: When combining the parsing of independent fields

### Q2: Can you briefly explain the difference between map and flatMap?

**A**: `map` "transforms the contents of a box and puts them back in a box," while `flatMap` "transforms the contents of a box, and if the result is a doubly-nested box, flattens it into a single box."

```typescript
// map: applies (A → B) to F[A] → F[B]
[1, 2].map(x => [x, x])     // [[1,1], [2,2]] — nested array

// flatMap: applies (A → F[B]) to F[A] → F[B] (flat + map)
[1, 2].flatMap(x => [x, x]) // [1, 1, 2, 2]   — flattened

// For Maybe
Maybe.of(5).map(x => Maybe.of(x * 2))     // Maybe(Maybe(10)) — double Maybe
Maybe.of(5).flatMap(x => Maybe.of(x * 2)) // Maybe(10)         — flattened
```

### Q3: Do I need to consciously think about Functor/Applicative/Monad when writing code?

**A**: You do not need to think about them explicitly. When you use `Array.map`, `Promise.all`, and `async/await`, you are already leveraging these patterns. Knowing the theory provides the following benefits:

- **Design decisions**: You can make accurate judgments like "can this operation be run in parallel? (→ applicative)" and "does it depend on the previous result? (→ monad)"
- **Understanding APIs**: The meaning of methods like `map`, `flatMap`, and `ap` in new libraries becomes intuitively clear
- **Bug prevention**: Being aware of the functor laws helps you avoid side effects inside `map`

### Q4: Can higher-kinded types (HKT) be used in TypeScript?

**A**: TypeScript's type system does not directly support higher-kinded types. The fp-ts library provides an emulation using branded types. For small projects, it is practical to implement `map`/`flatMap` directly on each type (Maybe, Either, Validation).

### Q5: What is the relationship between applicatives and parallel processing?

**A**: Applicative's `ap` guarantees at the type level that "there is no dependency between computations." No dependency means parallel execution is theoretically possible. `Promise.all` makes direct use of this property. However, applicative does not necessarily mean parallel execution; it merely conveys that "parallel execution is possible," and whether it is actually parallelized depends on the interpreter's implementation.

### Q6: Why can't Validation be a monad?

**A**: Monad's `bind/flatMap` "uses the result of the previous computation to determine the next computation," so in the case of an error, it has no choice but to short-circuit. Applicative's `ap`, on the other hand, "runs both computations independently and combines the results," so when both are errors, errors can be accumulated. This "error accumulation" and "monadic short-circuit evaluation" are fundamentally incompatible.

```haskell
-- Monad's bind depends on the previous result
-- In case of an error, there is no value to pass to the next computation, so it must stop
bind (Failure errs) f = Failure errs  -- cannot call f
bind (Success a)    f = f a

-- Applicative's ap can evaluate both independently
ap (Failure e1) (Failure e2) = Failure (e1 ++ e2)  -- combine both errors
```

---

## Summary

| Item | Key Points |
|---|---|
| Functor | Transform values in context with `map`. Array, Option, Promise, Result, etc. |
| Functor laws | Identity: `map(id) = id`, Composition: `map(f).map(g) = map(g . f)` |
| Applicative | Combine multiple independent values with `ap`. Enables error accumulation and parallel execution |
| Validation | A practical example of applicative. Can collect all errors, unlike monad |
| Monad | Chain dependent computations with `bind/flatMap`. Next computation based on previous result |
| Type class hierarchy | Functor < Applicative < Monad (containment relationship) |
| Selection criteria | Independent → Applicative (parallelizable), Dependent → Monad (sequential) |
| Promise.all | The quintessential applicative example. Parallel execution of independent async operations |
| Traversable | Swap context order with `sequence`/`traverse` |
| Contravariant functor | Maps on the "input" side. Comparator, Predicate, etc. |
| Relation to category theory | Functor is a "structure-preserving map." Laws guarantee safe refactoring |
| Practical guidelines | Choose the minimal abstraction (YAGNI). fp-ts is practical for TypeScript |

---

## Guides to Read Next

- [Monad](./00-monad.md) — Details and applications of flatMap/bind, do notation
- [Functional Patterns](./02-fp-patterns.md) — Integration with currying, pipelines, and lenses
- Clean code principles — Fundamental principles of function design
- [Behavioral Patterns](../02-behavioral/) — Comparison with OOP patterns
- [Architectural Patterns](../04-architectural/) — Functional approaches in large-scale design

---

## References

1. **Haskell Wiki**: [Typeclassopedia](https://wiki.haskell.org/Typeclassopedia) — A comprehensive guide to the type class hierarchy. Explains the relationship between Functor, Applicative, and Monad from a category-theoretic perspective
2. **Giulio Canti**: [fp-ts](https://gcanti.github.io/fp-ts/) — Functional programming library for TypeScript. The HKT emulation technique is worth studying
3. **Bartosz Milewski**: [Category Theory for Programmers](https://bartoszmilewski.com/2014/10/28/category-theory-for-programmers-the-preface/) — An introduction to category theory for programmers. Provides the mathematical background for understanding functors
4. **Conor McBride, Ross Paterson**: [Applicative Programming with Effects](http://www.staff.city.ac.uk/~ross/papers/Applicative.html) — The original paper on applicative functors. For those who want a deep understanding of the theoretical background
5. **Brian Lonsdorf**: [Professor Frisby's Mostly Adequate Guide](https://mostly-adequate.gitbook.io/mostly-adequate-guide/) — A practical introduction to functional programming in JavaScript
