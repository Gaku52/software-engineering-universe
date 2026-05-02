# Applying Functional Programming Principles to Clean Code

> This chapter explains the core principles of functional programming — pure functions, side effect separation, higher-order functions, and pipelines — in the context of clean code, helping you write safer and more maintainable software.

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|--------|
| Clean Code Fundamentals | Naming conventions, function design, commenting | 00-naming-conventions.md |
| SOLID Principles | Single responsibility, open/closed, dependency inversion | 04-solid-principles.md |
| Testing Principles | Unit testing basics, test pyramid | [04-testing-principles.md](../01-practices/04-testing-principles.md) |
| Immutability | Immutable data structures and value objects | [00-immutability.md](./00-immutability.md) |
| Strategy Pattern | Swapping behavior | [../../../design-patterns-guide/docs/02-behavioral/01-strategy.md](../../../design-patterns-guide/docs/02-behavioral/01-strategy.md) |

---

## What You Will Learn

1. Understand the concepts of **pure functions and referential transparency** to design testable, predictable functions
2. Structure applications using **side effect separation and the Functional Core / Imperative Shell** pattern
3. Write highly reusable and composable code by leveraging **higher-order functions, currying, and partial application**
4. Implement **type-safe pipelines with Result/Either types** for declarative and safe data transformation and error handling
5. Integrate **functional principles with object-oriented programming and everyday development** to achieve a hybrid architecture

---

## 1. Core Concepts of Functional Programming

### 1.1 The Core Principles of Functional Programming

```
┌──────────────────────────────────────────────────────┐
│          The 5 Pillars of Functional Programming      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐                                    │
│  │ 1. Pure      │  Same input → always same output  │
│  │    Functions │  Does not modify external state   │
│  └──────────────┘                                    │
│           │                                          │
│  ┌──────────────┐                                    │
│  │ 2. Immuta-   │  Copy data instead of mutating    │
│  │    bility    │  Manage state changes explicitly  │
│  └──────────────┘                                    │
│           │                                          │
│  ┌──────────────┐                                    │
│  │ 3. Higher-   │  Take functions as arguments      │
│  │    Order Fns │  Return functions as values       │
│  └──────────────┘                                    │
│           │                                          │
│  ┌──────────────┐                                    │
│  │ 4. Composi-  │  Build large operations by        │
│  │    tion      │  combining small functions        │
│  └──────────────┘                                    │
│           │                                          │
│  ┌──────────────┐                                    │
│  │ 5. Declara-  │  Describe "what to do"            │
│  │    tive      │  Hide "how to do it"              │
│  └──────────────┘                                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 1.2 The Spectrum of Programming Paradigms

```
Think of how much functional style to adopt as a spectrum:

  Pure OOP ──────────── Hybrid ──────────── Pure FP
    │                      │                       │
    Java                TypeScript              Haskell
   (traditional)       Kotlin, Scala             Elm
                       Python, Rust              Erlang

  Real-world application development:
    │
    ├── No need to adopt pure FP wholesale
    ├── Pragmatic approach: "apply functional principles where they fit"
    └── Focus on areas where testability and predictability improve
```

### 1.3 Imperative vs. Declarative (Functional)

```
Imperative (How):                Declarative/Functional (What):
─────────────                   ─────────────────────

result = []                      result = (
for item in items:                 items
    if item.active:                  .filter(active)
        value = transform(item)      .map(transform)
        result.append(value)         .collect()
                                   )

Describe steps one by one       Describe a pipeline of transformations
Loop variables, conditionals,   Declarative, composable, easy to test
side effects
```

```typescript
// TypeScript: Practical comparison of imperative vs. declarative

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: Date;
}

// NG: Imperative — intermediate variables, loops, and conditionals scattered throughout
function summarizeImperative(transactions: Transaction[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (tx.type === "expense") {
      if (result[tx.category] === undefined) {
        result[tx.category] = 0;
      }
      result[tx.category] += tx.amount;
    }
  }
  // Convert to array for sorting
  const entries = Object.entries(result);
  entries.sort((a, b) => b[1] - a[1]);
  const sorted: Record<string, number> = {};
  for (const [key, value] of entries) {
    sorted[key] = value;
  }
  return sorted;
}

// OK: Declarative — a pipeline-style chain of transformations
function summarizeDeclarative(transactions: Transaction[]): Record<string, number> {
  return Object.fromEntries(
    Object.entries(
      transactions
        .filter(tx => tx.type === "expense")
        .reduce<Record<string, number>>((acc, tx) => ({
          ...acc,
          [tx.category]: (acc[tx.category] ?? 0) + tx.amount,
        }), {})
    ).sort(([, a], [, b]) => b - a)
  );
}
```

---

## 2. Pure Functions

### 2.1 Definition and Benefits of Pure Functions

```
Two conditions for a pure function:

  1. Always returns the same output for the same input (referential transparency)
  2. No side effects (does not modify external state)

┌────────────┐          ┌────────────────┐
│  Input A   │ ──────> │                │ ──────> Output X
└────────────┘          │  Pure fn f     │
                        │                │
  Input A (again) ────> │  f(A) = X      │ ──────> Output X (always the same)
                        │  (always same) │
                        └────────────────┘
                              │
                              │ No side effects:
                              │ · Does not modify global variables
                              │ · Does not write to files
                              │ · Does not update the DB
                              │ · Does not make network calls
                              │ · Does not mutate arguments
```

```
Benefits matrix of pure functions:

  Benefit            Description                               Impact
  ──────────────────────────────────────────────────────────────────
  Testability        Only test input/output, no mocks needed   ★★★★★
  Reasoning          Behavior determined solely by arguments   ★★★★★
  Concurrency safety No shared state, no locks needed          ★★★★☆
  Cacheable          Memoization is safe due to ref. transp.   ★★★★☆
  Refactoring        Safe to extract and compose functions     ★★★★☆
  Debuggability      Reproducibility is guaranteed            ★★★★☆
```

### 2.2 Examples of Pure Function Implementations

```python
# Pure functions vs. impure functions

# NG: Impure function (depends on / modifies external state)
tax_rate = 0.10  # global variable

def calculate_total_impure(price: float) -> float:
    """Impure: depends on external variable"""
    return price * (1 + tax_rate)  # result changes if tax_rate changes

total_items = []

def add_to_cart_impure(item: dict) -> None:
    """Impure: modifies external list"""
    total_items.append(item)  # side effect: modifies external state

# OK: Pure functions
def calculate_total_pure(price: float, tax_rate: float) -> float:
    """Pure: all dependencies are explicit as arguments"""
    return price * (1 + tax_rate)

def add_to_cart_pure(cart: tuple, item: dict) -> tuple:
    """Pure: returns a new cart (does not modify the original)"""
    return cart + (item,)

# Easy to test
assert calculate_total_pure(1000, 0.10) == 1100.0
assert calculate_total_pure(1000, 0.08) == 1080.0
# → The same result is guaranteed no matter how many times it's run
```

### 2.3 Four Patterns for Refactoring Impure Functions to Pure

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

# === Pattern 1: Inject dependencies as arguments ===

# NG: Depends on current time (non-deterministic)
def is_business_hours_impure() -> bool:
    now = datetime.now()
    return 9 <= now.hour < 18

# OK: Inject time as an argument
def is_business_hours(current_hour: int) -> bool:
    return 9 <= current_hour < 18

# Easy to test
assert is_business_hours(10) == True
assert is_business_hours(20) == False


# === Pattern 2: Convert side effects to return values ===

# NG: Log output (side effect)
import logging

def process_order_impure(order_id: str, amount: int) -> int:
    if amount <= 0:
        logging.error(f"Invalid amount for order {order_id}")
        raise ValueError("Invalid amount")
    tax = int(amount * 0.1)
    logging.info(f"Order {order_id}: amount={amount}, tax={tax}")
    return amount + tax

# OK: Separate the result and log messages, return both
@dataclass(frozen=True)
class ProcessResult:
    total: int
    log_messages: tuple[str, ...]

def process_order_pure(order_id: str, amount: int) -> ProcessResult:
    if amount <= 0:
        return ProcessResult(total=0, log_messages=(
            f"ERROR: Invalid amount for order {order_id}",
        ))
    tax = int(amount * 0.1)
    return ProcessResult(
        total=amount + tax,
        log_messages=(f"INFO: Order {order_id}: amount={amount}, tax={tax}",),
    )

# Easy to test: no need to mock log output
result = process_order_pure("ORD-001", 1000)
assert result.total == 1100
assert "amount=1000" in result.log_messages[0]


# === Pattern 3: Replace state mutation with returning new state ===

# NG: Modifies an object's internal state
class BankAccountMutable:
    def __init__(self, balance: int):
        self.balance = balance

    def withdraw(self, amount: int) -> None:
        self.balance -= amount  # side effect: state mutation

# OK: Returns new state
@dataclass(frozen=True)
class BankAccount:
    balance: int

    def withdraw(self, amount: int) -> "BankAccount":
        return BankAccount(balance=self.balance - amount)

account = BankAccount(balance=10000)
new_account = account.withdraw(3000)
assert account.balance == 10000      # original is unchanged
assert new_account.balance == 7000


# === Pattern 4: Replace callbacks with higher-order functions ===

# NG: Notifies a global event bus
event_bus = []  # global state

def complete_task_impure(task_id: str) -> None:
    event_bus.append({"type": "task_completed", "task_id": task_id})

# OK: Include the events to be published in the return value
@dataclass(frozen=True)
class DomainEvent:
    event_type: str
    payload: dict

def complete_task_pure(task_id: str) -> tuple[str, list[DomainEvent]]:
    """Returns the result of task completion along with domain events"""
    return (
        "completed",
        [DomainEvent(event_type="task_completed", payload={"task_id": task_id})],
    )

status, events = complete_task_pure("TASK-42")
assert status == "completed"
assert events[0].event_type == "task_completed"
```

### 2.4 Leveraging Referential Transparency

```typescript
// Referential transparency: replacing a function call with its result does not change meaning

// Pure function: referentially transparent
function add(a: number, b: number): number {
  return a + b;
}

// add(2, 3) is always 5, so any occurrence of add(2, 3) can be replaced with 5
const x = add(2, 3) * add(2, 3);
const y = 5 * 5;  // completely equivalent

// === What referential transparency enables ===

// 1. Memoization (caching)
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Speed up expensive computations with memoization
const expensiveCalc = memoize((n: number): number => {
  console.log(`Computing for ${n}...`);
  return Array.from({ length: n }, (_, i) => i + 1)
    .reduce((sum, x) => sum + x, 0);
});

expensiveCalc(1000); // Computing for 1000... → 500500
expensiveCalc(1000); // Returned immediately from cache → 500500

// 2. Lazy evaluation (compute only when needed)
// 3. Parallel execution (independent of order)
// 4. Test independence (no setup required)
// 5. Equational reasoning (mathematically prove code correctness)
```

### 2.5 Practical Applications of Memoization

```typescript
// Using memoization in React

// useMemo: memoize a referentially transparent computation
function ExpenseReport({ transactions }: { transactions: Transaction[] }) {
  // Not recomputed unless transactions changes
  const summary = useMemo(() =>
    transactions
      .filter(tx => tx.type === "expense")
      .reduce<Record<string, number>>((acc, tx) => ({
        ...acc,
        [tx.category]: (acc[tx.category] ?? 0) + tx.amount,
      }), {}),
    [transactions]
  );

  // useCallback: memoize the function itself (prevents child component re-renders)
  const handleCategoryClick = useCallback(
    (category: string) => {
      console.log(`Selected: ${category}`);
    },
    [] // no dependencies → the same function reference is preserved
  );

  return (
    <div>
      {Object.entries(summary).map(([category, amount]) => (
        <CategoryRow
          key={category}
          name={category}
          amount={amount}
          onClick={handleCategoryClick}
        />
      ))}
    </div>
  );
}
```

```python
# Python: Memoization using functools.lru_cache

from functools import lru_cache

# Recursive Fibonacci — exponential complexity without memoization
@lru_cache(maxsize=256)
def fibonacci(n: int) -> int:
    """Fibonacci optimized to O(n) with memoization"""
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# Why memoization is safe: fibonacci is a pure function
assert fibonacci(50) == 12586269025  # computed instantly

# Check cache status
print(fibonacci.cache_info())
# CacheInfo(hits=48, misses=51, maxsize=256, currsize=51)
```

---

## 3. Side Effect Separation

### 3.1 Pure Core and Impure Shell (Functional Core / Imperative Shell)

```
┌──────────────────────────────────────────────┐
│           Functional Core / Imperative Shell  │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────┐         │
│  │     Imperative Shell (impure)  │         │
│  │  ┌──────────────────────┐     │         │
│  │  │                      │     │         │
│  │  │   Functional Core    │     │         │
│  │  │   (pure)             │     │         │
│  │  │                      │     │         │
│  │  │  · Business logic    │     │         │
│  │  │  · Data transforms   │     │         │
│  │  │  · Validation        │     │         │
│  │  │  · Calculations      │     │         │
│  │  │                      │     │         │
│  │  └──────────────────────┘     │         │
│  │                                │         │
│  │  · DB read/write               │         │
│  │  · File I/O                    │         │
│  │  · HTTP communication          │         │
│  │  · Log output                  │         │
│  │  · Time retrieval              │         │
│  └────────────────────────────────┘         │
│                                              │
│  Pure center → easy to test, predictable    │
│  Impure shell → consolidates I/O, kept thin │
│                                              │
└──────────────────────────────────────────────┘
```

```
FC/IS pattern responsibility separation flow:

  HTTP Request
      │
      ▼
  ┌─────────────────────────┐
  │ Controller (Shell)       │  Parse request
  │  ├ parse request         │
  │  ├ read from DB          │  ← side effect: DB read
  │  └ call core logic ──────┼──────┐
  └─────────────────────────┘      │
                                    ▼
                            ┌───────────────────┐
                            │ Core (pure)        │
                            │  ├ validate        │
                            │  ├ calculate       │  no side effects
                            │  ├ transform       │  easy to test
                            │  └ return result ──┼──────┐
                            └───────────────────┘      │
                                    ▲                   ▼
  ┌─────────────────────────┐      │      ┌─────────────────┐
  │ Repository (Shell)       │      │      │ Controller      │
  │  ├ save to DB            │ ◄────┘      │  ├ save result  │
  │  └ send notification     │             │  └ return resp  │
  └─────────────────────────┘             └─────────────────┘
```

### 3.2 Implementation Example: Order Processing System

```python
# Functional Core: pure business logic
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class OrderItem:
    product_id: str
    name: str
    price: int
    quantity: int

@dataclass(frozen=True)
class Order:
    items: tuple[OrderItem, ...]
    discount_rate: float = 0.0

# --- Pure functions (Functional Core) ---

def calculate_subtotal(order: Order) -> int:
    """Calculate subtotal (pure)"""
    return sum(item.price * item.quantity for item in order.items)

def apply_discount(subtotal: int, discount_rate: float) -> int:
    """Apply discount (pure)"""
    return int(subtotal * (1 - discount_rate))

def calculate_tax(amount: int, tax_rate: float) -> int:
    """Calculate tax amount (pure)"""
    return int(amount * tax_rate)

def calculate_total(order: Order, tax_rate: float) -> dict:
    """Calculate total (pure — all logic composed from functions)"""
    subtotal = calculate_subtotal(order)
    discounted = apply_discount(subtotal, order.discount_rate)
    tax = calculate_tax(discounted, tax_rate)
    return {
        "subtotal": subtotal,
        "discount": subtotal - discounted,
        "tax": tax,
        "total": discounted + tax,
    }

def validate_order(order: Order) -> list[str]:
    """Order validation (pure — returns list of errors)"""
    errors = []
    if not order.items:
        errors.append("No items in order")
    for item in order.items:
        if item.quantity <= 0:
            errors.append(f"{item.name}: quantity must be at least 1")
        if item.price < 0:
            errors.append(f"{item.name}: invalid price")
    if not (0.0 <= order.discount_rate <= 1.0):
        errors.append("Discount rate must be between 0 and 1")
    return errors

# --- Imperative Shell: I/O and side effects ---

class OrderService:
    """Impure shell: responsible for I/O"""

    def __init__(self, db, payment_gateway, notifier):
        self.db = db
        self.payment = payment_gateway
        self.notifier = notifier

    def process_order(self, order: Order) -> dict:
        """Order processing (impure — calls I/O)"""
        # 1. Pure validation
        errors = validate_order(order)
        if errors:
            return {"status": "error", "errors": errors}

        # 2. Pure calculation
        totals = calculate_total(order, tax_rate=0.10)

        # 3. Impure processing (I/O)
        payment_result = self.payment.charge(totals["total"])
        if not payment_result.success:
            return {"status": "payment_failed"}

        order_id = self.db.save_order(order, totals)
        self.notifier.send_confirmation(order_id)

        return {"status": "success", "order_id": order_id, **totals}

# Test: pure parts can be tested easily without mocks
def test_calculate_total():
    order = Order(
        items=(
            OrderItem("p1", "Product A", 1000, 2),
            OrderItem("p2", "Product B", 500, 3),
        ),
        discount_rate=0.1,
    )
    result = calculate_total(order, tax_rate=0.10)
    assert result["subtotal"] == 3500
    assert result["discount"] == 350
    assert result["total"] == 3465  # (3500-350) * 1.10
```

### 3.3 Functional Core / Imperative Shell in TypeScript

```typescript
// === Functional Core ===

// Immutable type definitions
interface UserRegistration {
  readonly email: string;
  readonly password: string;
  readonly name: string;
}

interface ValidatedUser {
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly normalizedEmail: string;
}

type ValidationError = { field: string; message: string };

// Pure function: validation
function validateRegistration(
  input: UserRegistration
): Result<UserRegistration, ValidationError[]> {
  const errors: ValidationError[] = [];

  if (!input.email.includes("@")) {
    errors.push({ field: "email", message: "Please enter a valid email address" });
  }
  if (input.password.length < 8) {
    errors.push({ field: "password", message: "Password must be at least 8 characters" });
  }
  if (input.name.trim().length === 0) {
    errors.push({ field: "name", message: "Please enter your name" });
  }

  return errors.length > 0 ? Err(errors) : Ok(input);
}

// Pure function: data transformation (hashPassword treated as a pure cryptographic hash)
function prepareUser(
  input: UserRegistration,
  hashedPassword: string
): ValidatedUser {
  return {
    email: input.email,
    passwordHash: hashedPassword,
    name: input.name.trim(),
    normalizedEmail: input.email.toLowerCase(),
  };
}

// === Imperative Shell ===

class UserRegistrationService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly mailer: EmailService,
  ) {}

  async register(input: UserRegistration): Promise<Result<string, string>> {
    // 1. Pure: validation
    const validated = validateRegistration(input);
    if (!validated.ok) {
      return Err(validated.error.map(e => e.message).join(", "));
    }

    // 2. Impure: duplicate check (DB read)
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      return Err("This email address is already registered");
    }

    // 3. Impure: password hashing
    const hashed = await this.hasher.hash(input.password);

    // 4. Pure: build user data
    const user = prepareUser(input, hashed);

    // 5. Impure: DB save + email send
    const userId = await this.userRepo.save(user);
    await this.mailer.sendWelcome(user.normalizedEmail, user.name);

    return Ok(userId);
  }
}
```

---

## 4. Higher-Order Functions

### 4.1 Basic Patterns of Higher-Order Functions

```typescript
// Higher-order functions: take functions as arguments OR return functions

// 1. Take a function as an argument
function filter<T>(items: T[], predicate: (item: T) => boolean): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (predicate(item)) result.push(item);
  }
  return result;
}

// 2. Return a function (currying)
function createMultiplier(factor: number): (n: number) => number {
  return (n: number) => n * factor;
}

const double = createMultiplier(2);
const triple = createMultiplier(3);
console.log(double(5));  // 10
console.log(triple(5));  // 15

// 3. Take a function and return a function (function decorator)
function withLogging<T extends (...args: any[]) => any>(
  fn: T,
  label: string
): T {
  return ((...args: any[]) => {
    console.log(`[${label}] called:`, args);
    const result = fn(...args);
    console.log(`[${label}] result:`, result);
    return result;
  }) as T;
}

const add = (a: number, b: number) => a + b;
const loggedAdd = withLogging(add, "add");
loggedAdd(2, 3);
// [add] called: [2, 3]
// [add] result: 5

// 4. Partial application
function partial<T extends (...args: any[]) => any>(
  fn: T,
  ...presetArgs: any[]
): (...remainingArgs: any[]) => ReturnType<T> {
  return (...remainingArgs) => fn(...presetArgs, ...remainingArgs);
}

const addTen = partial(add, 10);
console.log(addTen(5));  // 15
```

### 4.2 Difference Between Currying and Partial Application

```typescript
// Currying: converts a multi-argument function into a chain of single-argument functions
// Partial application: fixes some arguments of a multi-argument function to create a new function

// === Currying ===
function curry<A, B, C>(fn: (a: A, b: B) => C): (a: A) => (b: B) => C {
  return (a: A) => (b: B) => fn(a, b);
}

const curriedAdd = curry((a: number, b: number) => a + b);
const add5 = curriedAdd(5);   // (b: number) => number
console.log(add5(3));          // 8
console.log(add5(10));         // 15

// General-purpose currying function
function autoCurry(fn: Function) {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...moreArgs: any[]) => curried(...args, ...moreArgs);
  };
}

// Practical example: log formatter
const formatLog = autoCurry(
  (level: string, module: string, message: string) =>
    `[${level}] [${module}] ${message}`
);

const errorLog = formatLog("ERROR");          // fix level
const dbError = errorLog("Database");          // fix module too
console.log(dbError("Connection timeout"));    // [ERROR] [Database] Connection timeout
console.log(formatLog("INFO", "API", "Request received")); // all args at once also works
```

### 4.3 Practical Higher-Order Function Patterns

```python
# Python: practical higher-order functions

from functools import wraps, reduce
from typing import TypeVar, Callable, Any
import time

T = TypeVar("T")

# 1. Retry decorator (takes a function and returns a function)
def retry(max_attempts: int = 3, delay: float = 1.0):
    """Higher-order function that adds retry logic to a function"""
    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_error = None
            for attempt in range(max_attempts):
                try:
                    return fn(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_attempts - 1:
                        time.sleep(delay * (2 ** attempt))  # exponential backoff
            raise last_error
        return wrapper
    return decorator

@retry(max_attempts=3, delay=0.5)
def fetch_data(url: str) -> dict:
    # actual HTTP request
    pass

# 2. Pipeline composition
def pipe(*functions: Callable) -> Callable:
    """Compose multiple functions from left to right"""
    def pipeline(value):
        return reduce(lambda acc, fn: fn(acc), functions, value)
    return pipeline

# Usage example
process_text = pipe(
    str.strip,              # trim leading/trailing whitespace
    str.lower,              # convert to lowercase
    lambda s: s.replace(" ", "_"),  # replace spaces with underscores
    lambda s: s[:50],       # limit to 50 characters
)

result = process_text("  Hello World Example  ")
# → "hello_world_example"

# 3. Validator composition
def compose_validators(*validators):
    """Compose multiple validators"""
    def validate(value):
        errors = []
        for validator in validators:
            error = validator(value)
            if error:
                errors.append(error)
        return errors if errors else None
    return validate

def min_length(n):
    def validator(s):
        if len(s) < n:
            return f"Must be at least {n} characters"
    return validator

def max_length(n):
    def validator(s):
        if len(s) > n:
            return f"Must be {n} characters or fewer"
    return validator

def matches_pattern(pattern, message):
    import re
    def validator(s):
        if not re.match(pattern, s):
            return message
    return validator

# Composing validators
validate_username = compose_validators(
    min_length(3),
    max_length(20),
    matches_pattern(r"^[a-zA-Z0-9_]+$", "Only alphanumeric characters and underscores allowed"),
)

errors = validate_username("ab")  # ["Must be at least 3 characters"]
errors = validate_username("valid_user")  # None

# 4. Timing decorator (performance measurement)
def timed(fn: Callable[..., T]) -> Callable[..., T]:
    """Higher-order function that measures a function's execution time"""
    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        start = time.perf_counter()
        result = fn(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{fn.__name__}: {elapsed:.4f}s")
        return result
    return wrapper

@timed
def heavy_computation(n: int) -> int:
    return sum(i * i for i in range(n))

heavy_computation(1_000_000)  # heavy_computation: 0.0823s
```

---

## 5. Functional Data Transformation Pipelines

### 5.1 Pipeline Design

```
Data transformation pipeline:

  Input data ──> [Transform 1] ──> [Transform 2] ──> [Transform 3] ──> Output data

  Example: processing a user list

  users ──> filter(active) ──> map(toDTO) ──> sort(byName) ──> take(10)

  Each step:
  · Pure function (no side effects)
  · Type-safe (input type → output type is clear)
  · Testable (each step can be tested independently)
  · Composable (steps can be added or removed easily)
```

### 5.2 Type-Safe Pipelines in TypeScript

```typescript
// Type-safe pipeline

// Pipe function (with type inference)
function pipe<A>(value: A): A;
function pipe<A, B>(value: A, fn1: (a: A) => B): B;
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
function pipe<A, B, C, D>(
  value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D
): D;
function pipe(value: any, ...fns: Function[]): any {
  return fns.reduce((acc, fn) => fn(acc), value);
}

// Data transformation functions
interface User {
  id: string;
  name: string;
  age: number;
  active: boolean;
  department: string;
}

interface UserDTO {
  id: string;
  displayName: string;
  department: string;
}

const filterActive = (users: User[]): User[] =>
  users.filter(u => u.active);

const filterByDepartment = (dept: string) =>
  (users: User[]): User[] =>
    users.filter(u => u.department === dept);

const toDTO = (users: User[]): UserDTO[] =>
  users.map(u => ({
    id: u.id,
    displayName: `${u.name} (${u.age})`,
    department: u.department,
  }));

const sortByName = (users: UserDTO[]): UserDTO[] =>
  [...users].sort((a, b) => a.displayName.localeCompare(b.displayName));

const take = (n: number) =>
  <T>(items: T[]): T[] => items.slice(0, n);

// Build and execute the pipeline
const result = pipe(
  users,
  filterActive,
  filterByDepartment("engineering"),
  toDTO,
  sortByName,
  take(10),
);
// Type-safe: result type is UserDTO[]
```

### 5.3 Lazy Evaluation Pipelines in Python

```python
# Lazy evaluation pipeline using generators
from typing import TypeVar, Callable, Iterator, Iterable
from itertools import islice

T = TypeVar("T")
U = TypeVar("U")

class LazyPipeline:
    """Lazy evaluation pipeline: does not compute until finally consumed"""

    def __init__(self, source: Iterable):
        self._source = source

    def filter(self, predicate: Callable) -> "LazyPipeline":
        """Pass only elements that match the condition (lazy)"""
        return LazyPipeline(x for x in self._source if predicate(x))

    def map(self, transform: Callable) -> "LazyPipeline":
        """Transform each element (lazy)"""
        return LazyPipeline(transform(x) for x in self._source)

    def flat_map(self, transform: Callable) -> "LazyPipeline":
        """Transform each element and flatten (lazy)"""
        return LazyPipeline(
            item
            for x in self._source
            for item in transform(x)
        )

    def take(self, n: int) -> "LazyPipeline":
        """Take only the first n elements (lazy)"""
        return LazyPipeline(islice(self._source, n))

    def collect(self) -> list:
        """Execute the pipeline and collect results into a list"""
        return list(self._source)

    def reduce(self, fn: Callable, initial=None):
        """Execute the pipeline by folding"""
        from functools import reduce as _reduce
        if initial is not None:
            return _reduce(fn, self._source, initial)
        return _reduce(fn, self._source)


# Usage example: retrieve the latest errors from 1 million log entries
import json
from dataclasses import dataclass

@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    level: str
    message: str
    service: str

def parse_log_line(line: str) -> LogEntry:
    data = json.loads(line)
    return LogEntry(**data)

# Lazy evaluation: stops as soon as the first 5 entries are found, even with 1 million lines
def get_recent_errors(log_lines: Iterable[str], service: str, limit: int = 5):
    return (
        LazyPipeline(log_lines)
        .map(parse_log_line)
        .filter(lambda entry: entry.level == "ERROR")
        .filter(lambda entry: entry.service == service)
        .take(limit)
        .collect()
    )

# Memory efficient: does not load the entire file into memory
# with open("app.log") as f:
#     errors = get_recent_errors(f, service="payment", limit=5)
```

### 5.4 Rust Iterator Pipelines

```rust
// Rust: pipelines with zero-cost abstractions
// Compiled to loops at compile time, so equivalent performance to hand-written for loops

#[derive(Debug, Clone)]
struct SalesRecord {
    product: String,
    region: String,
    amount: f64,
    quantity: u32,
}

fn top_products_by_region(records: &[SalesRecord], region: &str, top_n: usize) -> Vec<(String, f64)> {
    let mut product_totals: std::collections::HashMap<&str, f64> =
        records.iter()
            .filter(|r| r.region == region)
            .fold(std::collections::HashMap::new(), |mut acc, r| {
                *acc.entry(r.product.as_str()).or_insert(0.0) += r.amount;
                acc
            });

    let mut sorted: Vec<(String, f64)> = product_totals
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect();

    sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    sorted.into_iter().take(top_n).collect()
}

// Usage example
// let top = top_products_by_region(&sales_data, "Tokyo", 5);
// → [("Product A", 150000.0), ("Product B", 120000.0), ...]
```

---

## 6. Functional Error Handling

### 6.1 Result/Either Types

```typescript
// Result type: error handling without exceptions

type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helper functions
function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Method chaining on Result
function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? Ok(fn(result.value)) : result;
}

function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

// mapError: transform the error type
function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return result.ok ? result : Err(fn(result.error));
}
```

### 6.2 Practical Chaining with the Result Type

```typescript
// Practical example: validation chaining
type ValidationError = { field: string; message: string };

function validateAge(age: number): Result<number, ValidationError> {
  if (age < 0 || age > 150) {
    return Err({ field: "age", message: "Age must be between 0 and 150" });
  }
  return Ok(age);
}

function validateName(name: string): Result<string, ValidationError> {
  if (name.length < 1 || name.length > 50) {
    return Err({ field: "name", message: "Name must be between 1 and 50 characters" });
  }
  return Ok(name);
}

function validateEmail(email: string): Result<string, ValidationError> {
  if (!email.includes("@")) {
    return Err({ field: "email", message: "Please enter a valid email address" });
  }
  return Ok(email);
}

// Error handling in a pipeline
function createUser(
  name: string, age: number, email: string
): Result<User, ValidationError> {
  const nameResult = validateName(name);
  if (!nameResult.ok) return nameResult;

  const ageResult = validateAge(age);
  if (!ageResult.ok) return ageResult;

  const emailResult = validateEmail(email);
  if (!emailResult.ok) return emailResult;

  return Ok({
    id: generateId(),
    name: nameResult.value,
    age: ageResult.value,
    email: emailResult.value,
  });
}

// Pattern for collecting all errors (Validation Applicative)
function validateAll<T, E>(
  results: Result<T, E>[]
): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  return errors.length > 0 ? Err(errors) : Ok(values);
}

// Usage: return all validation errors at once
function createUserCollectErrors(
  name: string, age: number, email: string
): Result<User, ValidationError[]> {
  const allResults = validateAll([
    validateName(name) as Result<any, ValidationError>,
    validateAge(age) as Result<any, ValidationError>,
    validateEmail(email) as Result<any, ValidationError>,
  ]);

  if (!allResults.ok) return allResults;

  const [validName, validAge, validEmail] = allResults.value;
  return Ok({
    id: generateId(),
    name: validName,
    age: validAge,
    email: validEmail,
  });
}
```

### 6.3 Result Type in Python

```python
# Python: error handling without exceptions using the Result type
from dataclasses import dataclass
from typing import TypeVar, Generic, Union, Callable

T = TypeVar("T")
E = TypeVar("E")
U = TypeVar("U")

@dataclass(frozen=True)
class Ok(Generic[T]):
    value: T

    def is_ok(self) -> bool:
        return True

    def map(self, fn: Callable) -> "Result":
        return Ok(fn(self.value))

    def flat_map(self, fn: Callable) -> "Result":
        return fn(self.value)

    def unwrap_or(self, default) -> T:
        return self.value

@dataclass(frozen=True)
class Err(Generic[E]):
    error: E

    def is_ok(self) -> bool:
        return False

    def map(self, fn: Callable) -> "Result":
        return self  # error propagates as-is

    def flat_map(self, fn: Callable) -> "Result":
        return self

    def unwrap_or(self, default):
        return default

Result = Union[Ok[T], Err[E]]

# Practical example: validation chain for user registration
def validate_email(email: str) -> Result:
    if "@" not in email:
        return Err(f"Invalid email address: {email}")
    return Ok(email.lower())

def validate_password(password: str) -> Result:
    if len(password) < 8:
        return Err("Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        return Err("Password must contain at least one uppercase letter")
    return Ok(password)

def validate_age(age: int) -> Result:
    if age < 13:
        return Err("Users under 13 cannot register")
    if age > 150:
        return Err("Invalid age")
    return Ok(age)

# Chain: short-circuits on the first error
def register_user(email: str, password: str, age: int) -> Result:
    return (
        validate_email(email)
        .flat_map(lambda valid_email:
            validate_password(password)
            .flat_map(lambda valid_password:
                validate_age(age)
                .map(lambda valid_age: {
                    "email": valid_email,
                    "password_hash": hash(valid_password),
                    "age": valid_age,
                })
            )
        )
    )

# Tests
result = register_user("test@example.com", "SecurePass1", 25)
assert result.is_ok()
assert result.value["email"] == "test@example.com"

error_result = register_user("invalid", "short", 10)
assert not error_result.is_ok()
assert error_result.error == "Invalid email address: invalid"
```

### 6.4 When to Use Exceptions vs. Result Types

```
When to use exceptions:
  ├── Programmer mistakes (bugs): IndexError, NullPointerException
  ├── Unrecoverable errors: OutOfMemoryError, StackOverflowError
  └── Framework conventions: Django, Spring exception handling

When to use Result types:
  ├── Business logic failures: validation errors, insufficient permissions
  ├── Predictable failures: file not found, network timeout
  ├── Collecting multiple errors: form validation
  └── Explicit error types: forcing the caller to handle errors

Decision flowchart:
  Is the error predictable?
    ├── YES → Should the caller handle it?
    │          ├── YES → Result type
    │          └── NO  → Exception (catch higher up)
    └── NO  → Exception (bug, should be fixed)
```

---

## 7. Functional vs. Object-Oriented: Choosing the Right Tool

### 7.1 Comparison Table

| Aspect | Functional | Object-Oriented |
|------|--------|----------------|
| Data and behavior | Separated | Unified (encapsulation) |
| State management | Immutable data + transforms | Object internal state |
| Polymorphism | Pattern matching / higher-order functions | Subtype polymorphism |
| Abstraction | Function composition | Class inheritance / composition |
| Direction of extension | Easy to add new operations | Easy to add new types |
| Strengths | Data transformation, pipelines | State management, UI components |
| Testing | Verify input/output only | Setup + mocks |
| Concurrency | Safe due to immutability | Requires locks and synchronization |

### 7.2 The Expression Problem

```
Expression Problem (type vs. operation extension dilemma):

  OOP: easy to add new types, hard to add new operations
  ┌────────────┐
  │ Shape      │  Adding a new Shape (Triangle) → easy
  │  ├ Circle  │  Adding a new operation (area, perimeter)
  │  ├ Square  │  → requires modifying all Shape classes
  │  └ ???     │
  └────────────┘

  FP: easy to add new operations, hard to add new types
  ┌────────────┐
  │ area(s)    │  Adding a new operation (perimeter) → easy
  │ draw(s)    │  Adding a new type (Triangle)
  │ ???(s)     │  → requires modifying all functions
  └────────────┘

  Solution: Visitor pattern / Type Class / Protocol
  → See [../../design-patterns-guide/docs/02-behavioral/05-visitor.md]
```

### 7.3 Hybrid Approach

```
Recommended: Functional + OOP hybrid
───────────────────────────────────

  ┌─ Domain model: immutable data classes (FP)
  │
  ├─ Business logic: pure functions (FP)
  │
  ├─ Application layer: service classes + DI (OOP)
  │
  ├─ Infrastructure layer: repositories, external services (OOP)
  │
  └─ Data transformation: pipelines (FP)
```

```typescript
// Example of a hybrid architecture implementation

// ===== Domain layer: FP (immutable data + pure functions) =====
interface Product {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly stock: number;
}

interface CartItem {
  readonly product: Product;
  readonly quantity: number;
}

interface Cart {
  readonly items: readonly CartItem[];
  readonly appliedCoupon?: string;
}

// Pure functions: cart operations
const addToCart = (cart: Cart, product: Product, quantity: number): Cart => ({
  ...cart,
  items: [
    ...cart.items.filter(item => item.product.id !== product.id),
    {
      product,
      quantity: (cart.items.find(i => i.product.id === product.id)?.quantity ?? 0) + quantity,
    },
  ],
});

const removeFromCart = (cart: Cart, productId: string): Cart => ({
  ...cart,
  items: cart.items.filter(item => item.product.id !== productId),
});

const calculateCartTotal = (cart: Cart): number =>
  cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

const applyCoupon = (cart: Cart, couponCode: string, discountRate: number): Cart => ({
  ...cart,
  appliedCoupon: couponCode,
  items: cart.items.map(item => ({
    ...item,
    product: {
      ...item.product,
      price: Math.round(item.product.price * (1 - discountRate)),
    },
  })),
});

// Pure function: validation
const validateCart = (cart: Cart): string[] => {
  const errors: string[] = [];
  if (cart.items.length === 0) {
    errors.push("Cart is empty");
  }
  for (const item of cart.items) {
    if (item.quantity > item.product.stock) {
      errors.push(`${item.product.name}: insufficient stock (stock: ${item.product.stock})`);
    }
  }
  return errors;
};

// ===== Application layer: OOP (DI + side effect management) =====
class CheckoutService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly orderRepo: OrderRepository,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async checkout(cart: Cart): Promise<Result<string, string>> {
    // 1. Pure: validation
    const errors = validateCart(cart);
    if (errors.length > 0) {
      return Err(errors.join("; "));
    }

    // 2. Pure: total calculation
    const total = calculateCartTotal(cart);

    // 3. Impure: payment
    const paymentResult = await this.paymentGateway.charge(total);
    if (!paymentResult.ok) {
      return Err("Payment failed");
    }

    // 4. Impure: save order
    const orderId = await this.orderRepo.save(cart, total);
    return Ok(orderId);
  }
}
```

---

## 8. Anti-Patterns

### 8.1 Anti-Pattern: Hidden Side Effects

```python
# NG: looks pure but has side effects
def process_items(items: list[dict]) -> list[dict]:
    for item in items:
        item["processed"] = True  # mutates the argument list!
        item["timestamp"] = datetime.now()  # non-deterministic
    return items

# OK: pure function that returns a new list
def process_items(
    items: list[dict], current_time: datetime
) -> list[dict]:
    return [
        {**item, "processed": True, "timestamp": current_time}
        for item in items
    ]
```

**Problem**: A function that directly mutates its arguments destroys the caller's data. Non-deterministic operations like time retrieval should be injected as arguments.

**How to detect**: (1) Look for assignments to argument objects (`obj["key"] = ...`, `obj.attr = ...`). (2) Look for calls to non-deterministic functions like `datetime.now()`, `random()`, `uuid4()`. (3) Configure lint rules (`no-param-reassign`).

### 8.2 Anti-Pattern: Excessive Abstraction

```python
# NG: unreadable code from over-applying functional style
result = reduce(
    lambda acc, f: f(acc),
    [
        partial(filter, lambda x: x > 0),
        partial(map, lambda x: x ** 2),
        partial(sorted, key=lambda x: -x),
        list,
    ],
    data,
)

# OK: functional style prioritizing readability
positive_numbers = [x for x in data if x > 0]
squared = [x ** 2 for x in positive_numbers]
result = sorted(squared, reverse=True)

# Or use named functions to make intent clear
def keep_positive(nums): return [x for x in nums if x > 0]
def square_all(nums): return [x ** 2 for x in nums]
def sort_descending(nums): return sorted(nums, reverse=True)

result = sort_descending(square_all(keep_positive(data)))
```

**Problem**: Do not sacrifice readability by forcing functional patterns. Adapt to the team's level of understanding and use named functions to make intent clear.

**Decision criteria**: (1) Nested lambdas more than 2 levels deep → extract to named functions. (2) `reduce` body not immediately understandable → convert to explicit loops or comprehensions. (3) Code that more than half the team cannot read → simplify it.

### 8.3 Anti-Pattern: Excessive Monad Nesting

```typescript
// NG: triple nesting of Promise<Result<Option<T>>>
async function getUser(
  id: string
): Promise<Result<Option<User>, DatabaseError>> {
  // Callers are forced to unwrap 3 levels deep
  const result = await getUser("123");
  if (!result.ok) {
    // handle DatabaseError
  } else if (result.value === null) {
    // user not found
  } else {
    // finally access User
  }
}

// OK: unified at an appropriate level
type GetUserError =
  | { type: "not_found"; userId: string }
  | { type: "database_error"; message: string };

async function getUser(
  id: string
): Promise<Result<User, GetUserError>> {
  // Callers only need to check Result ok/error
  const result = await getUser("123");
  if (!result.ok) {
    switch (result.error.type) {
      case "not_found":
        return showNotFound();
      case "database_error":
        return showErrorPage();
    }
  }
  // access User immediately
}
```

**Problem**: When type nesting is too deep, the boilerplate burden outweighs the benefits of type safety. Choose an appropriate level of abstraction, such as merging `Option` and `Error` into a Union Type.

### 8.4 Anti-Pattern: Overusing map/filter (Ignoring Performance)

```typescript
// NG: traverses the same array multiple times (O(n) × 4)
const result = users
  .filter(u => u.active)
  .map(u => ({ ...u, name: u.name.toUpperCase() }))
  .filter(u => u.age >= 18)
  .map(u => u.name);

// OK: combine into a single traversal with reduce (for performance-critical cases)
const result = users.reduce<string[]>((acc, u) => {
  if (u.active && u.age >= 18) {
    acc.push(u.name.toUpperCase());
  }
  return acc;
}, []);

// Note: trade-off between readability and performance
// - Hundreds of items → chained version is fine
// - Tens of thousands of items, hot path → consider the reduce version
// - Always profile first before optimizing
```

**Problem**: Functional chains are declarative and readable, but with large datasets, intermediate array allocations can become a bottleneck. Lazy evaluation pipelines (Section 5.3) are also an option.

---

## 9. Exercises

### Exercise 1 (Basic): Sales Data Transformation Pipeline

**Task**: Process the following sales data with a functional pipeline to generate a monthly sales summary by category.

```python
# Input data
from dataclasses import dataclass
from datetime import date

@dataclass(frozen=True)
class Sale:
    product: str
    category: str
    amount: int
    sale_date: date

sales = [
    Sale("Product A", "electronics", 15000, date(2025, 3, 1)),
    Sale("Product B", "books", 2500, date(2025, 3, 5)),
    Sale("Product C", "electronics", 8000, date(2025, 3, 10)),
    Sale("Product D", "clothing", 5000, date(2025, 3, 15)),
    Sale("Product E", "electronics", 22000, date(2025, 3, 20)),
    Sale("Product F", "books", 1800, date(2025, 3, 25)),
    Sale("Product G", "clothing", 12000, date(2025, 4, 1)),
    Sale("Product H", "electronics", 9500, date(2025, 4, 5)),
]

# Requirements:
# 1. Extract only data from March 2025
# 2. Aggregate total amounts by category
# 3. Sort in descending order by amount
# 4. Return result as dict[str, int]
```

**Expected output**:

```python
{"electronics": 45000, "clothing": 5000, "books": 4300}
```

**Model answer**:

```python
from functools import reduce
from collections import defaultdict

# Defined as pure functions
def filter_by_month(sales: list[Sale], year: int, month: int) -> list[Sale]:
    return [s for s in sales if s.sale_date.year == year and s.sale_date.month == month]

def group_by_category(sales: list[Sale]) -> dict[str, int]:
    totals: dict[str, int] = {}
    for sale in sales:
        totals[sale.category] = totals.get(sale.category, 0) + sale.amount
    return totals

def sort_by_value_desc(data: dict[str, int]) -> dict[str, int]:
    return dict(sorted(data.items(), key=lambda x: -x[1]))

# Pipeline composition
def pipe(*functions):
    def pipeline(value):
        return reduce(lambda acc, fn: fn(acc), functions, value)
    return pipeline

monthly_summary = pipe(
    lambda s: filter_by_month(s, 2025, 3),
    group_by_category,
    sort_by_value_desc,
)

result = monthly_summary(sales)
assert result == {"electronics": 45000, "clothing": 5000, "books": 4300}
print(result)
# → {'electronics': 45000, 'clothing': 5000, 'books': 4300}
```

---

### Exercise 2 (Intermediate): Implement User Registration with Functional Core / Imperative Shell

**Task**: Implement a user registration system that satisfies the following requirements using the Functional Core / Imperative Shell pattern.

```
Requirements:
  1. Email: must contain @, 255 characters or fewer, normalize to lowercase
  2. Password: at least 8 characters, must include uppercase, lowercase, and digits
  3. Name: 1–50 characters, trim leading/trailing whitespace
  4. Age: 13–150

Functional Core:
  - All validation functions are pure
  - Validation results are returned as Result types
  - Collect and return all errors (do not stop at the first error)

Imperative Shell:
  - DB save (can be mocked)
  - Welcome email send (can be mocked)
```

**Expected output**:

```python
# Success case
result = register("Alice", "alice@example.com", "Passw0rd", 25)
# → Ok({"id": "usr-xxx", "email": "alice@example.com", "name": "Alice"})

# Error case (collect all errors)
result = register("", "invalid", "short", 10)
# → Err(["Please enter your name", "Invalid email address",
#         "Password must be at least 8 characters", "Users under 13 cannot register"])
```

**Model answer**:

```python
from dataclasses import dataclass, field
from typing import Union
import re
import uuid

# Result type
@dataclass(frozen=True)
class Ok:
    value: object
    def is_ok(self): return True

@dataclass(frozen=True)
class Err:
    errors: list[str]
    def is_ok(self): return False

Result = Union[Ok, Err]

# === Functional Core (pure functions) ===

def validate_name(name: str) -> list[str]:
    errors = []
    trimmed = name.strip()
    if len(trimmed) == 0:
        errors.append("Please enter your name")
    elif len(trimmed) > 50:
        errors.append("Name must be 50 characters or fewer")
    return errors

def validate_email(email: str) -> list[str]:
    errors = []
    if "@" not in email:
        errors.append("Invalid email address")
    elif len(email) > 255:
        errors.append("Email must be 255 characters or fewer")
    return errors

def validate_password(password: str) -> list[str]:
    errors = []
    if len(password) < 8:
        errors.append("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one digit")
    return errors

def validate_age(age: int) -> list[str]:
    errors = []
    if age < 13:
        errors.append("Users under 13 cannot register")
    elif age > 150:
        errors.append("Invalid age")
    return errors

def validate_all(name: str, email: str, password: str, age: int) -> Result:
    """Run all validations and collect all errors (pure function)"""
    all_errors = (
        validate_name(name)
        + validate_email(email)
        + validate_password(password)
        + validate_age(age)
    )
    if all_errors:
        return Err(all_errors)
    return Ok({
        "name": name.strip(),
        "email": email.lower(),
        "age": age,
    })

# === Imperative Shell ===

class UserService:
    def __init__(self, db, mailer):
        self.db = db
        self.mailer = mailer

    def register(self, name: str, email: str, password: str, age: int) -> Result:
        # 1. Pure: validation
        validation = validate_all(name, email, password, age)
        if not validation.is_ok():
            return validation

        user_data = validation.value

        # 2. Impure: DB save
        user_id = str(uuid.uuid4())
        self.db.save({"id": user_id, **user_data})

        # 3. Impure: send email
        self.mailer.send_welcome(user_data["email"], user_data["name"])

        return Ok({"id": user_id, **user_data})

# Tests: pure parts require no mocks
def test_validate_all_success():
    result = validate_all("Alice", "alice@example.com", "Passw0rd", 25)
    assert result.is_ok()
    assert result.value["email"] == "alice@example.com"

def test_validate_all_collects_all_errors():
    result = validate_all("", "invalid", "short", 10)
    assert not result.is_ok()
    assert len(result.errors) == 4  # all 4 errors are collected
    assert "Please enter your name" in result.errors
    assert "Invalid email address" in result.errors
    assert "Password must be at least 8 characters" in result.errors
    assert "Users under 13 cannot register" in result.errors

test_validate_all_success()
test_validate_all_collects_all_errors()
print("All tests passed!")
```

---

### Exercise 3 (Advanced): Implement an Order Processing Pipeline with the Result Type

**Task**: Implement the following order processing using a chain of Result types, handling error propagation through the pipeline.

```
Processing flow:
  1. Stock check   → InsufficientStock error if stock is inadequate
  2. Price calc    → InvalidTotal error if total is 0 or less
  3. Apply discount → calculate discounted amount
  4. Calculate tax  → return tax-inclusive amount

Every step returns a Result type and errors propagate throughout the chain
```

**Expected output**:

```python
# Success case
result = process_order(order, inventory)
# → Ok({"subtotal": 3500, "discount": 350, "tax": 315, "total": 3465})

# Insufficient stock
result = process_order(large_order, limited_inventory)
# → Err(OrderError("insufficient_stock", "Product A: insufficient stock (requested: 100, available: 5)"))
```

**Model answer**:

```python
from dataclasses import dataclass
from typing import Union

@dataclass(frozen=True)
class OrderError:
    error_type: str
    message: str

@dataclass(frozen=True)
class OkResult:
    value: dict
    def is_ok(self): return True
    def then(self, fn):
        return fn(self.value)

@dataclass(frozen=True)
class ErrResult:
    error: OrderError
    def is_ok(self): return False
    def then(self, fn):
        return self  # error propagates as-is

OrderResult = Union[OkResult, ErrResult]

@dataclass(frozen=True)
class OrderItem:
    product_id: str
    name: str
    price: int
    quantity: int

@dataclass(frozen=True)
class OrderRequest:
    items: tuple[OrderItem, ...]
    discount_rate: float = 0.0
    tax_rate: float = 0.10

# Pure functions for each step (returning Result)

def check_stock(order: OrderRequest, inventory: dict[str, int]) -> OrderResult:
    for item in order.items:
        available = inventory.get(item.product_id, 0)
        if item.quantity > available:
            return ErrResult(OrderError(
                "insufficient_stock",
                f"{item.name}: insufficient stock (requested: {item.quantity}, available: {available})"
            ))
    subtotal = sum(i.price * i.quantity for i in order.items)
    return OkResult({"items": order.items, "subtotal": subtotal,
                      "discount_rate": order.discount_rate, "tax_rate": order.tax_rate})

def validate_total(data: dict) -> OrderResult:
    if data["subtotal"] <= 0:
        return ErrResult(OrderError("invalid_total", "Total amount is 0 or less"))
    return OkResult(data)

def apply_discount(data: dict) -> OrderResult:
    subtotal = data["subtotal"]
    discount = int(subtotal * data["discount_rate"])
    discounted = subtotal - discount
    return OkResult({**data, "discount": discount, "discounted": discounted})

def apply_tax(data: dict) -> OrderResult:
    discounted = data["discounted"]
    tax = int(discounted * data["tax_rate"])
    total = discounted + tax
    return OkResult({
        "subtotal": data["subtotal"],
        "discount": data["discount"],
        "tax": tax,
        "total": total,
    })

# Execute the pipeline
def process_order(order: OrderRequest, inventory: dict[str, int]) -> OrderResult:
    return (
        check_stock(order, inventory)
        .then(validate_total)
        .then(apply_discount)
        .then(apply_tax)
    )

# Tests
order = OrderRequest(
    items=(
        OrderItem("p1", "Product A", 1000, 2),
        OrderItem("p2", "Product B", 500, 3),
    ),
    discount_rate=0.1,
    tax_rate=0.10,
)

inventory = {"p1": 10, "p2": 20}
result = process_order(order, inventory)
assert result.is_ok()
assert result.value["subtotal"] == 3500
assert result.value["discount"] == 350
assert result.value["tax"] == 315
assert result.value["total"] == 3465
print(f"OK: {result.value}")

# Insufficient stock test
limited_inventory = {"p1": 1, "p2": 20}
error_result = process_order(order, limited_inventory)
assert not error_result.is_ok()
assert error_result.error.error_type == "insufficient_stock"
print(f"Error: {error_result.error.message}")

print("All tests passed!")
# Output:
# OK: {'subtotal': 3500, 'discount': 350, 'tax': 315, 'total': 3465}
# Error: Product A: insufficient stock (requested: 2, available: 1)
# All tests passed!
```

---

## 10. FAQ

### Q1: Doesn't functional programming have poor performance?

**A**: It is true that creating new objects has a cost, but modern GCs are very fast at processing short-lived objects. Using structural sharing and lazy evaluation minimizes the performance impact. On the JVM, the JIT compiler optimizes through inlining and escape analysis. A practical approach is to use mutable data only at confirmed bottlenecks.

As a concrete example, Immutable.js's Map is about 2× slower for updates compared to a regular Object with 1 million entries, but structural sharing means change detection (`===` comparison) completes instantly in O(1). In scenarios like React's `shouldComponentUpdate`, immutable data can be faster overall.

### Q2: What is the relationship between React/Redux and functional programming?

**A**: React incorporates many functional principles: (1) components are pure functions from `props → JSX`, (2) Redux uses pure reducers `(state, action) → newState`, (3) immutable state updates with `useState`, and (4) memoization via `useMemo` based on referential transparency. Frontend developers naturally benefit from functional principles.

Furthermore, React 18+'s Concurrent Features assume referential transparency. The reason the UI stays consistent even when rendering is interrupted and resumed is that rendering functions are pure. The double-rendering in `StrictMode` is a mechanism for verifying purity.

### Q3: How do I introduce functional principles to a team?

**A**: A gradual adoption roadmap is recommended:

1. **Week 1-2**: Start with `map/filter/reduce` (replacing for loops)
2. **Week 3-4**: Share the concept of pure functions and build the habit of separating side effects in new code
3. **Month 2**: Introduce immutable data classes (`dataclass(frozen=True)`, `readonly`)
4. **Month 3**: Enforce immutability with lint rules (`no-param-reassign`, `prefer-const`)
5. **Month 4+**: Consider introducing Result types and pipelines

Rather than forcing a full Haskell-style approach, what matters is letting each step deliver tangible results: "tests became easier to write," "bugs decreased."

### Q4: Are tests for pure functions really mock-free?

**A**: Tests for pure functions require absolutely no mocks. You only need to pass input and verify the output. This is the greatest benefit of Functional Core / Imperative Shell. If 80% or more of business logic is written as pure functions, the majority of the test suite becomes simple input/output tests and overall test execution time is drastically reduced.

```python
# Pure function: no mocks needed
def test_calculate_total():
    order = Order(items=(OrderItem("p1", "A", 1000, 2),), discount_rate=0.1)
    result = calculate_total(order, tax_rate=0.1)
    assert result["total"] == 1980  # only check input → output

# Impure shell: mocks needed (but thin)
def test_order_service(mocker):
    mock_db = mocker.Mock()
    mock_payment = mocker.Mock(return_value=PaymentResult(success=True))
    service = OrderService(db=mock_db, payment=mock_payment, notifier=mocker.Mock())
    # ...
```

### Q5: How does functional programming relate to dependency injection (DI)?

**A**: In functional programming, DI is realized through "function arguments." You can also use OOP DI containers, but "function-level DI" via higher-order functions is also effective.

```typescript
// OOP-style DI
class OrderService {
  constructor(private repo: OrderRepository) {}
  getOrder(id: string) { return this.repo.find(id); }
}

// Functional DI: pass dependencies as arguments (higher-order functions)
const getOrder = (repo: OrderRepository) => (id: string) => repo.find(id);
const getOrderFromDB = getOrder(new PostgresOrderRepository());
const getOrderFromMock = getOrder(new MockOrderRepository());  // for testing
```

Using both approaches where appropriate is realistic. Service layers benefit from OOP DI; business logic benefits from argument injection for clarity.

### Q6: What is the relationship between event sourcing and functional programming?

**A**: Event sourcing is fundamentally a functional pattern. The current state is computed as "initial state + left fold (reduce/fold) over an event sequence."

```
state = reduce(apply_event, events, initial_state)

Events: [Created, ItemAdded, ItemAdded, Discounted, Confirmed]
        ↓ fold
State:  Order(items=2, discount=10%, status=confirmed)
```

Events are immutable (past events are never changed), and `apply_event` is a pure function (the same event sequence always reproduces the same state). This enables complete audit logs, point-in-time restoration, and easier debugging. See ../../system-design-guide/docs/02-architecture/ for details.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not through theory alone, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the core concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Category | Key Points |
|---------|---------|
| Pure functions | Same input → same output, no side effects. Easy to test and reason about |
| Referential transparency | Function calls can be replaced with their results. Foundation for memoization and parallelization |
| Side effect separation | Structured with Functional Core / Imperative Shell |
| Higher-order functions | Abstraction of behavior. Decorators, currying, partial application |
| Pipelines | Declaratively compose data transformations. Handles large data with lazy evaluation |
| Error handling | Safe error propagation with Result/Either types without exceptions |
| Immutability | Copy rather than mutate data. Safe for concurrency, easy to track changes |
| Hybrid | FP + OOP used where appropriate. Domain = FP, Infrastructure = OOP |
| Adoption strategy | Gradually: map/filter → pure functions → immutable data → pipelines |

```
Adoption maturity model:

  Level 0: Imperative only (for, while, state mutation)
      ↓
  Level 1: Using map/filter/reduce
      ↓
  Level 2: Consciously separating pure functions
      ↓
  Level 3: Functional Core / Imperative Shell
      ↓
  Level 4: Result types + pipeline composition
      ↓
  Level 5: Type-level programming, Phantom Types, etc.
```

---

## Further Reading

- [00-immutability.md](./00-immutability.md) — Immutability principles (details on immutable data structures and structural sharing)
- [01-composition-over-inheritance.md](./01-composition-over-inheritance.md) — Composition over inheritance (integration with Strategy and Decorator patterns)
- [03-api-design.md](./03-api-design.md) — API design (applying functional error handling to APIs)
- [../01-practices/04-testing-principles.md](../01-practices/04-testing-principles.md) — Testing principles (testing strategies for pure functions)
- ../../design-patterns-guide/docs/03-functional/ — Functional design patterns (Monad, Functor)
- [../../../design-patterns-guide/docs/02-behavioral/01-strategy.md](../../../design-patterns-guide/docs/02-behavioral/01-strategy.md) — Strategy pattern (comparison with higher-order functions)
- ../../system-design-guide/docs/00-fundamentals/ — System design fundamentals (overall picture of functional architecture)

---

## References

1. Michael Feathers, **"Functional Design"** — A practical guide to functional design
2. Eric Normand, **"Grokking Simplicity"** (Manning, 2021) — A practical introduction to functional programming
3. Gary Bernhardt, **"Functional Core, Imperative Shell"** — https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell
4. Martin Fowler, **"Collection Pipeline"** — https://martinfowler.com/articles/collection-pipeline/
5. Scott Wlaschin, **"Domain Modeling Made Functional"** (Pragmatic, 2018) — Functional domain-driven design
6. Enrico Buonanno, **"Functional Programming in C#"** (Manning, 2nd ed., 2022) — Practical functional programming
7. Brian Lonsdorf, **"Professor Frisby's Mostly Adequate Guide to Functional Programming"** — https://mostly-adequate.gitbook.io/mostly-adequate-guide/ — Free online FP guide
8. Rust by Example, **"Iterators"** — https://doc.rust-lang.org/rust-by-example/trait/iter.html — Rust iterator pipelines
9. Haskell Wiki, **"Functional programming"** — https://wiki.haskell.org/Functional_programming — Theoretical foundations of functional programming
10. Mark Seemann, **"From dependency injection to dependency rejection"** — https://blog.ploeh.dk/2017/01/27/from-dependency-injection-to-dependency-rejection/ — DI from a functional perspective
