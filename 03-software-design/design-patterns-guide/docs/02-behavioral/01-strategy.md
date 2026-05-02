# Strategy Pattern

> A behavioral pattern that defines a family of algorithms, **encapsulates** each one, and makes them interchangeable. Algorithms can be switched at runtime, preventing conditional branch explosion and adhering to the Open/Closed Principle.

---

## What You Will Learn

1. Understand the structure of the Strategy pattern and how to design OCP-compliant systems by eliminating conditional branches
2. Learn the relationship with DI (Dependency Injection), how to implement it with a functional approach, and how to combine it with the Registry pattern
3. Develop judgment criteria to avoid over-applying Strategy, and learn when to use Template Method or State patterns instead

---

## Prerequisites

Before reading this guide, it is recommended to understand the following concepts.

| Prerequisite | Description | Reference |
|---------|------|-----------|
| SOLID Principles (especially OCP) | The principle of being open for extension and closed for modification | [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) |
| Interfaces and Polymorphism | The concept of treating different implementations uniformly | [Clean Code](../../../clean-code-principles/docs/00-principles/) |
| Dependency Injection (DI) | The technique of injecting dependency objects from outside | [DI/IoC](../../../clean-code-principles/docs/01-practices/) |
| Functions (First-Class Objects) | The concept of treating functions as values, passing them as arguments or return values | [Functional Patterns](../03-functional/02-fp-patterns.md) |

---

## 1. What Is the Strategy Pattern?

### 1.1 The Problem It Solves

In software, there are many situations where multiple algorithms exist for the same type of processing.

- Pricing calculation: regular / premium / student / senior
- Sorting: by name / by date / by price / by relevance
- Authentication: password / OAuth / SAML / API key
- Compression: gzip / zstd / lz4 / brotli

When these are branched with `if/else` or `switch`, the conditional logic bloats every time an algorithm is added, requiring changes to existing code (an OCP violation).

```
BEFORE (bloated conditional branches):
function calculate(type, price) {
  if (type === "regular") return price;
  else if (type === "premium") return price * 0.9;
  else if (type === "student") return price * 0.7;
  else if (type === "senior") return price * 0.8;
  else if (type === "vip") return price * 0.6;    // addition 1
  else if (type === "family") return price * 0.75; // addition 2
  // ... this function must be modified for every new type -> OCP violation
}

AFTER (Strategy pattern):
strategies.get(type).calculate(price);
// new types only need to be registered -> OCP compliant
```

### 1.2 Intent of the Pattern

GoF definition:

> Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy lets the algorithm vary independently from clients that use it.

### 1.3 WHY: Why Is the Strategy Pattern Needed?

The fundamental reason is to **separate the selection of an algorithm from its execution**.

1. **Open/Closed Principle**: New algorithms can be added without modifying existing code
2. **Single Responsibility Principle**: Each algorithm exists as an independent class/function and can be tested individually
3. **Runtime switching**: Different algorithms can be dynamically switched within the same Context
4. **Testability**: Tests become easy by replacing Strategy with mocks/stubs

---

## 2. Structure of Strategy

### 2.1 Class Diagram

```
+-------------+       +-------------------+
|   Context   |------>|   Strategy        |
+-------------+       |   (interface)     |
| - strategy  |       +-------------------+
| + execute() |       | + execute(data)   |
+-------------+       +-------------------+
                              ^
                       _______|_______
                      |               |
               +------------+  +------------+
               | StrategyA  |  | StrategyB  |
               +------------+  +------------+
               | + execute() |  | + execute() |
               +------------+  +------------+
```

### 2.2 Roles of Each Component

| Component | Role | Responsibility |
|---------|------|------|
| Strategy (Interface) | Common contract for algorithms | Defines method signatures |
| ConcreteStrategy | Concrete algorithm implementation | Implements according to the Strategy interface |
| Context | The consumer of Strategy | Holds a reference to Strategy and delegates to it |
| Client | Assembles Context and Strategy | Injects a concrete Strategy into Context |

### 2.3 Processing Sequence

```
Client            Context              Strategy
  |                  |                     |
  |-- new Context(strategyA) -->|          |
  |                  |-- setStrategy(A) -->|
  |                  |                     |
  |-- execute() ---->|                     |
  |                  |-- execute(data) --->|  StrategyA
  |                  |<--- result ---------|
  |<-- result -------|                     |
  |                  |                     |
  |-- setStrategy(B)->|                    |
  |                  |                     |
  |-- execute() ---->|                     |
  |                  |-- execute(data) --->|  StrategyB
  |                  |<--- result ---------|
  |<-- result -------|                     |
```

---

## 3. Code Examples

### Code Example 1: Pricing Strategy (TypeScript)

```typescript
// pricing-strategy.ts — Basic form of the Strategy pattern
interface PricingStrategy {
  readonly name: string;
  calculate(basePrice: number): number;
  getDescription(): string;
}

class RegularPricing implements PricingStrategy {
  readonly name = "regular";
  calculate(basePrice: number): number {
    return basePrice;
  }
  getDescription(): string {
    return "Regular price (no discount)";
  }
}

class PremiumPricing implements PricingStrategy {
  readonly name = "premium";
  calculate(basePrice: number): number {
    return Math.round(basePrice * 0.9); // 10% discount
  }
  getDescription(): string {
    return "Premium member price (10% OFF)";
  }
}

class StudentPricing implements PricingStrategy {
  readonly name = "student";
  calculate(basePrice: number): number {
    return Math.round(basePrice * 0.7); // 30% discount
  }
  getDescription(): string {
    return "Student price (30% OFF)";
  }
}

class SeniorPricing implements PricingStrategy {
  readonly name = "senior";
  calculate(basePrice: number): number {
    return Math.round(basePrice * 0.8); // 20% discount
  }
  getDescription(): string {
    return "Senior price (20% OFF)";
  }
}

// Context: Shopping cart
class ShoppingCart {
  private items: { name: string; price: number; quantity: number }[] = [];
  private pricingStrategy: PricingStrategy;

  constructor(pricingStrategy: PricingStrategy = new RegularPricing()) {
    this.pricingStrategy = pricingStrategy;
  }

  setPricingStrategy(strategy: PricingStrategy): void {
    this.pricingStrategy = strategy;
    console.log(`Pricing changed to: ${strategy.getDescription()}`);
  }

  addItem(name: string, price: number, quantity: number = 1): void {
    this.items.push({ name, price, quantity });
  }

  checkout(): { subtotal: number; discount: number; total: number; strategy: string } {
    const subtotal = this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total = this.pricingStrategy.calculate(subtotal);
    return {
      subtotal,
      discount: subtotal - total,
      total,
      strategy: this.pricingStrategy.name,
    };
  }
}

// --- Usage: switch strategy at runtime ---
const cart = new ShoppingCart();
cart.addItem("TypeScript Book", 3000);
cart.addItem("Design Patterns Book", 4000);

console.log(cart.checkout());
// { subtotal: 7000, discount: 0, total: 7000, strategy: "regular" }

cart.setPricingStrategy(new StudentPricing());
// "Pricing changed to: Student price (30% OFF)"

console.log(cart.checkout());
// { subtotal: 7000, discount: 2100, total: 4900, strategy: "student" }

cart.setPricingStrategy(new PremiumPricing());
console.log(cart.checkout());
// { subtotal: 7000, discount: 700, total: 6300, strategy: "premium" }
```

### Code Example 2: Functional Strategy (TypeScript)

```typescript
// functional-strategy.ts — Implementing Strategy with functions instead of classes
interface User {
  name: string;
  age: number;
  email: string;
  createdAt: Date;
  score: number;
}

// Define Strategy as a function type
type SortStrategy<T> = (a: T, b: T) => number;

const byName: SortStrategy<User> = (a, b) =>
  a.name.localeCompare(b.name);

const byAge: SortStrategy<User> = (a, b) =>
  a.age - b.age;

const byCreatedDesc: SortStrategy<User> = (a, b) =>
  b.createdAt.getTime() - a.createdAt.getTime();

const byScore: SortStrategy<User> = (a, b) =>
  b.score - a.score;

// Composition: combine multiple sort criteria
function composeStrategies<T>(...strategies: SortStrategy<T>[]): SortStrategy<T> {
  return (a, b) => {
    for (const strategy of strategies) {
      const result = strategy(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

// Reversal: sort in descending order
function reverse<T>(strategy: SortStrategy<T>): SortStrategy<T> {
  return (a, b) => -strategy(a, b);
}

// Context function
function sortUsers(users: User[], strategy: SortStrategy<User>): User[] {
  return [...users].sort(strategy);
}

// --- Usage ---
const users: User[] = [
  { name: "Charlie", age: 30, email: "c@test.com", createdAt: new Date("2024-01"), score: 85 },
  { name: "Alice", age: 25, email: "a@test.com", createdAt: new Date("2024-03"), score: 92 },
  { name: "Bob", age: 30, email: "b@test.com", createdAt: new Date("2024-02"), score: 88 },
];

// Single sort
console.log(sortUsers(users, byName).map(u => u.name));
// ["Alice", "Bob", "Charlie"]

console.log(sortUsers(users, byScore).map(u => u.name));
// ["Alice", "Bob", "Charlie"]

// Composed sort: by age -> by name (when age is equal)
const byAgeThenName = composeStrategies(byAge, byName);
console.log(sortUsers(users, byAgeThenName).map(u => u.name));
// ["Alice", "Bob", "Charlie"]

// Reversed: reverse alphabetical by name
console.log(sortUsers(users, reverse(byName)).map(u => u.name));
// ["Charlie", "Bob", "Alice"]
```

### Code Example 3: Validation Strategy (TypeScript)

```typescript
// validation-strategy.ts — Form validation
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface ValidationStrategy {
  validate(value: string): ValidationResult;
  readonly fieldName: string;
}

class EmailValidation implements ValidationStrategy {
  readonly fieldName = "email";

  validate(value: string): ValidationResult {
    const errors: string[] = [];
    if (!value) errors.push("Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push("Invalid email format");
    }
    return { valid: errors.length === 0, errors };
  }
}

class PasswordValidation implements ValidationStrategy {
  readonly fieldName = "password";

  constructor(
    private options: {
      minLength?: number;
      requireUppercase?: boolean;
      requireDigit?: boolean;
      requireSpecial?: boolean;
    } = {}
  ) {}

  validate(value: string): ValidationResult {
    const errors: string[] = [];
    const { minLength = 8, requireUppercase = true, requireDigit = true, requireSpecial = false } = this.options;

    if (value.length < minLength) errors.push(`Minimum ${minLength} characters`);
    if (requireUppercase && !/[A-Z]/.test(value)) errors.push("Need uppercase letter");
    if (requireDigit && !/[0-9]/.test(value)) errors.push("Need digit");
    if (requireSpecial && !/[!@#$%^&*]/.test(value)) errors.push("Need special character");

    return { valid: errors.length === 0, errors };
  }
}

class PhoneValidation implements ValidationStrategy {
  readonly fieldName = "phone";

  constructor(private country: 'JP' | 'US' = 'JP') {}

  validate(value: string): ValidationResult {
    const errors: string[] = [];
    const patterns = {
      JP: /^0\d{1,4}-?\d{1,4}-?\d{4}$/,
      US: /^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
    };

    if (!value) errors.push("Phone number is required");
    else if (!patterns[this.country].test(value)) {
      errors.push(`Invalid ${this.country} phone number format`);
    }

    return { valid: errors.length === 0, errors };
  }
}

// Context: form field
class FormField {
  private strategies: ValidationStrategy[] = [];

  constructor(
    private name: string,
    ...strategies: ValidationStrategy[]
  ) {
    this.strategies = strategies;
  }

  validate(value: string): ValidationResult {
    const allErrors: string[] = [];
    for (const strategy of this.strategies) {
      const result = strategy.validate(value);
      allErrors.push(...result.errors);
    }
    return { valid: allErrors.length === 0, errors: allErrors };
  }
}

// --- Usage ---
const emailField = new FormField("email", new EmailValidation());
console.log(emailField.validate("test@example.com"));
// { valid: true, errors: [] }

console.log(emailField.validate("invalid-email"));
// { valid: false, errors: ["Invalid email format"] }

const passwordField = new FormField(
  "password",
  new PasswordValidation({ minLength: 10, requireSpecial: true })
);
console.log(passwordField.validate("short"));
// { valid: false, errors: ["Minimum 10 characters", "Need uppercase letter", "Need digit", "Need special character"] }

console.log(passwordField.validate("MyP@ssw0rd!!"));
// { valid: true, errors: [] }
```

### Code Example 4: Python — Protocol-Based Strategy

```python
# compression_strategy.py — Strategy using Python Protocol
from typing import Protocol
import gzip
import time


class CompressionStrategy(Protocol):
    """Protocol (interface) for compression strategies"""
    @property
    def name(self) -> str: ...
    def compress(self, data: bytes) -> bytes: ...
    def decompress(self, data: bytes) -> bytes: ...


class GzipCompression:
    name = "gzip"

    def compress(self, data: bytes) -> bytes:
        return gzip.compress(data)

    def decompress(self, data: bytes) -> bytes:
        return gzip.decompress(data)


class NoCompression:
    name = "none"

    def compress(self, data: bytes) -> bytes:
        return data

    def decompress(self, data: bytes) -> bytes:
        return data


class FileProcessor:
    """Context: file processor"""
    def __init__(self, compression: CompressionStrategy):
        self._compression = compression

    def set_compression(self, compression: CompressionStrategy) -> None:
        self._compression = compression
        print(f"Compression changed to: {compression.name}")

    def save(self, data: bytes, path: str) -> dict:
        start = time.time()
        compressed = self._compression.compress(data)
        elapsed = time.time() - start

        with open(path, "wb") as f:
            f.write(compressed)

        ratio = len(compressed) / len(data) * 100
        return {
            "original_size": len(data),
            "compressed_size": len(compressed),
            "ratio": f"{ratio:.1f}%",
            "time_ms": f"{elapsed * 1000:.2f}",
            "algorithm": self._compression.name,
        }

    def load(self, path: str) -> bytes:
        with open(path, "rb") as f:
            compressed = f.read()
        return self._compression.decompress(compressed)


# --- Usage ---
data = b"Hello " * 1000  # 6000 bytes of repeated data

processor = FileProcessor(GzipCompression())
result = processor.save(data, "/tmp/data.gz")
print(result)
# {"original_size": 6000, "compressed_size": ~40, "ratio": "0.7%", ...}

processor.set_compression(NoCompression())
result = processor.save(data, "/tmp/data.raw")
print(result)
# {"original_size": 6000, "compressed_size": 6000, "ratio": "100.0%", ...}
```

### Code Example 5: Dynamic Strategy Selection (Registry Pattern)

```typescript
// strategy-registry.ts — Registry + Strategy
class StrategyRegistry<T> {
  private strategies = new Map<string, T>();
  private defaultKey: string | null = null;

  register(name: string, strategy: T, isDefault: boolean = false): this {
    this.strategies.set(name, strategy);
    if (isDefault) this.defaultKey = name;
    return this;
  }

  get(name: string): T {
    const strategy = this.strategies.get(name);
    if (strategy) return strategy;

    // Return the default strategy if one exists
    if (this.defaultKey) {
      return this.strategies.get(this.defaultKey)!;
    }

    throw new Error(`Strategy "${name}" not found. Available: ${this.getAvailableNames().join(', ')}`);
  }

  has(name: string): boolean {
    return this.strategies.has(name);
  }

  getAvailableNames(): string[] {
    return [...this.strategies.keys()];
  }
}

// --- Pricing Registry ---
const pricingRegistry = new StrategyRegistry<PricingStrategy>();
pricingRegistry
  .register("regular", new RegularPricing(), true) // default
  .register("premium", new PremiumPricing())
  .register("student", new StudentPricing())
  .register("senior", new SeniorPricing());

// Dynamically select from an API request
function handleCheckout(req: { membershipType: string; items: any[] }) {
  const strategy = pricingRegistry.get(req.membershipType);
  const cart = new ShoppingCart(strategy);
  // ...
}

// List of available strategies
console.log(pricingRegistry.getAvailableNames());
// ["regular", "premium", "student", "senior"]
```

### Code Example 6: HTTP Retry Strategy

```typescript
// retry-strategy.ts — Strategy for retry algorithms
interface RetryStrategy {
  readonly name: string;
  getDelay(attempt: number, baseDelay: number): number;
  shouldRetry(attempt: number, maxAttempts: number, error: Error): boolean;
}

class LinearRetry implements RetryStrategy {
  readonly name = "linear";
  getDelay(attempt: number, baseDelay: number): number {
    return baseDelay * attempt;
  }
  shouldRetry(attempt: number, maxAttempts: number): boolean {
    return attempt < maxAttempts;
  }
}

class ExponentialBackoff implements RetryStrategy {
  readonly name = "exponential";
  getDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt - 1);
  }
  shouldRetry(attempt: number, maxAttempts: number): boolean {
    return attempt < maxAttempts;
  }
}

class ExponentialWithJitter implements RetryStrategy {
  readonly name = "exponential-jitter";
  getDelay(attempt: number, baseDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * exponentialDelay;
    return Math.floor(jitter);
  }
  shouldRetry(attempt: number, maxAttempts: number, error: Error): boolean {
    // Do not retry on 4xx errors (client errors)
    if ('statusCode' in error && (error as any).statusCode >= 400 && (error as any).statusCode < 500) {
      return false;
    }
    return attempt < maxAttempts;
  }
}

// Context: HTTP client
class ResilientHttpClient {
  constructor(
    private retryStrategy: RetryStrategy,
    private maxAttempts: number = 3,
    private baseDelay: number = 1000
  ) {}

  async request(url: string, options?: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        throw Object.assign(new Error(`HTTP ${response.status}`), { statusCode: response.status });
      } catch (error) {
        lastError = error as Error;
        console.log(`[${this.retryStrategy.name}] Attempt ${attempt} failed: ${lastError.message}`);

        if (!this.retryStrategy.shouldRetry(attempt, this.maxAttempts, lastError)) {
          break;
        }

        const delay = this.retryStrategy.getDelay(attempt, this.baseDelay);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// --- Usage ---
// Development environment: linear retry (predictable)
const devClient = new ResilientHttpClient(new LinearRetry(), 3, 500);

// Production environment: exponential backoff + jitter (distribute server load)
const prodClient = new ResilientHttpClient(new ExponentialWithJitter(), 5, 1000);
```

### Code Example 7: Logging Strategy

```typescript
// logging-strategy.ts — Strategy for log output destinations
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

interface LoggingStrategy {
  log(entry: LogEntry): void;
  flush?(): Promise<void>;
}

class ConsoleLogging implements LoggingStrategy {
  log(entry: LogEntry): void {
    const prefix = `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}]`;
    const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    console.log(`${prefix} ${entry.message}${ctx}`);
  }
}

class JsonFileLogging implements LoggingStrategy {
  private buffer: string[] = [];

  constructor(private filePath: string, private bufferSize: number = 10) {}

  log(entry: LogEntry): void {
    this.buffer.push(JSON.stringify(entry));
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const data = this.buffer.join('\n') + '\n';
    this.buffer = [];
    console.log(`[JsonFileLogging] Flushed ${data.split('\n').length - 1} entries to ${this.filePath}`);
  }
}

class MultiLogging implements LoggingStrategy {
  constructor(private strategies: LoggingStrategy[]) {}

  log(entry: LogEntry): void {
    this.strategies.forEach(s => s.log(entry));
  }

  async flush(): Promise<void> {
    await Promise.all(
      this.strategies
        .filter(s => s.flush)
        .map(s => s.flush!())
    );
  }
}

// Context: Logger
class Logger {
  constructor(private strategy: LoggingStrategy) {}

  setStrategy(strategy: LoggingStrategy): void {
    this.strategy = strategy;
  }

  private createEntry(level: LogEntry['level'], message: string, context?: Record<string, unknown>): LogEntry {
    return { level, message, timestamp: new Date(), context };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.strategy.log(this.createEntry('debug', message, context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.strategy.log(this.createEntry('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.strategy.log(this.createEntry('warn', message, context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.strategy.log(this.createEntry('error', message, context));
  }
}

// --- Usage ---
// Development environment: console only
const devLogger = new Logger(new ConsoleLogging());
devLogger.info("Server started", { port: 3000 });

// Production environment: console + JSON file
const prodLogger = new Logger(new MultiLogging([
  new ConsoleLogging(),
  new JsonFileLogging("/var/log/app.jsonl"),
]));
prodLogger.error("Database connection failed", { host: "db.example.com" });
```

---

## 4. Eliminating if/else

The most practical value of the Strategy pattern is the elimination of conditional branches.

```
BEFORE (bloated conditional branches):

  function calculate(type: string, price: number): number {
    if (type === "regular") return price;
    else if (type === "premium") return price * 0.9;
    else if (type === "student") return price * 0.7;
    else if (type === "senior") return price * 0.8;
    // ... this function must be changed for every new type -> OCP violation
  }

  Problems:
  1. Function grows bloated
  2. Combinatorial explosion of test cases
  3. Adding a new type requires modifying existing code

AFTER (Strategy pattern):

  // Each strategy is an independent class/function
  strategies.get(type).calculate(price);

  Benefits:
  1. Each strategy can be tested independently
  2. New strategies only need to be registered
  3. Existing code requires no changes

Decision flow:
  Are there 3 or more conditional branches? ----No----> if/else is sufficient
    |
   Yes
    |
  Are future additions expected? --No----> switch + enum for readability
    |
   Yes
    |
  Introduce the Strategy pattern
```

---

## 5. Comparison Tables

### Comparison Table 1: Strategy vs State vs Command vs Template Method

| Aspect | Strategy | State | Command | Template Method |
|------|:---:|:---:|:---:|:---:|
| Purpose | Algorithm exchange | State-dependent behavior | Encapsulation of operations | Define the skeleton of an algorithm |
| Switching timing | Decided by client | Auto-transition based on internal state | Saved in queue/history | At compile time |
| Relationship | has-a (delegation) | has-a (delegation) | has-a (delegation) | is-a (inheritance) |
| Flexibility | High (runtime switching) | Medium | High | Low (fixed by inheritance) |
| Undo | None | None | Supported | None |
| Typical count | Few to moderate | Finite number of states | Many commands | One skeleton |
| Testing | Easy to test individually | Test per state | Test per command | Test per subclass |

### Comparison Table 2: Class Strategy vs Function Strategy

| Aspect | Class-Based | Function-Based |
|------|:---:|:---:|
| State retention | Possible via fields | Possible via closures |
| Configuration parameters | Injected via constructor | Injected via higher-order functions |
| Testing | Instantiate and run | Call directly |
| Code volume | More (class, implements) | Less (function literals) |
| Type safety | High (interface enforced) | Medium (depends on type aliases) |
| DI framework compatibility | Easy to integrate | May be harder in some cases |
| Use cases | Complex strategies with state | Simple transforms, sorting |

### Comparison Table 3: Decision Criteria for Applying Strategy

| Situation | Recommended Approach | Reason |
|------|-------------|------|
| 2 variations | Ternary/if-else | Strategy is over-engineering |
| 3–5 variations | switch/enum or Strategy | Decide based on expected future additions |
| 6+ variations | Strategy + Registry | Conditional branches become hard to manage |
| Runtime switching required | Strategy | Matches the primary purpose |
| Complex algorithm | Class Strategy | Encapsulates state and logic |
| Simple algorithm | Function Strategy | Lightweight and sufficient |

---

## 6. Anti-Patterns

### Anti-Pattern 1: Using Strategy Pattern for Only Two Strategies

```typescript
// BAD: Over-engineering (YAGNI violation)
interface GreetingStrategy {
  greet(name: string): string;
}
class FormalGreeting implements GreetingStrategy {
  greet(name: string) { return `Dear ${name}`; }
}
class CasualGreeting implements GreetingStrategy {
  greet(name: string) { return `Hi ${name}`; }
}

// An interface + 2 classes just for this is excessive
// A ternary operator is sufficient:

// OK: Write it simply
const greet = (name: string, formal: boolean) =>
  formal ? `Dear ${name}` : `Hi ${name}`;
```

**Improvement**: Introduce the Strategy pattern only when there are 3 or more variations, or when future additions are expected. Never forget the YAGNI (You Aren't Gonna Need It) principle.

### Anti-Pattern 2: Context Knows the Internals of Strategy

```typescript
// BAD: Context checks the concrete type of Strategy
class Context {
  execute(): void {
    if (this.strategy instanceof StrategyA) {
      // Pre-processing specific to StrategyA
      this.prepareForA();
    }
    if (this.strategy instanceof StrategyB) {
      // Pre-processing specific to StrategyB
      this.prepareForB();
    }
    this.strategy.execute();
  }
}
// Problem: Context must also change every time a Strategy is added -> OCP violation

// OK: Context depends only on the Strategy interface
class Context {
  execute(): void {
    // Pre-processing is encapsulated inside Strategy
    this.strategy.execute();
  }
}

// Strategy includes its own pre-processing
class StrategyA implements Strategy {
  execute(): void {
    this.prepare(); // Strategy-specific pre-processing
    this.doWork();  // Main processing
  }
}
```

### Anti-Pattern 3: Inappropriate Granularity of Strategy

```typescript
// BAD: A single Strategy has multiple unrelated responsibilities
interface AllInOneStrategy {
  calculatePrice(price: number): number;
  formatOutput(data: any): string;
  validateInput(input: string): boolean;
  sendNotification(message: string): void;
}
// Problem: Even if you only want to change pricing, you must implement all methods

// OK: Split Strategy by responsibility
interface PricingStrategy {
  calculate(price: number): number;
}

interface FormattingStrategy {
  format(data: any): string;
}

interface ValidationStrategy {
  validate(input: string): ValidationResult;
}

// Context uses only the Strategy it needs
class OrderService {
  constructor(
    private pricing: PricingStrategy,
    private formatting: FormattingStrategy,
  ) {}
}
```

### Anti-Pattern 4: Strategy Switching Is Not Thread-Safe

```typescript
// BAD: Strategy switching causes race conditions in multi-threaded environments
class PaymentProcessor {
  private strategy: PaymentStrategy;

  setStrategy(strategy: PaymentStrategy): void {
    this.strategy = strategy; // Thread B may read while Thread A is writing
  }

  process(order: Order): PaymentResult {
    return this.strategy.process(order); // Which Strategy is used is non-deterministic
  }
}

// OK: Pass Strategy as an argument, or use an immutable Context
class PaymentProcessor {
  // Option 1: Receive Strategy as an argument (stateless)
  process(order: Order, strategy: PaymentStrategy): PaymentResult {
    return strategy.process(order);
  }
}

// Option 2: Immutable Context (create a new instance when Strategy changes)
class PaymentProcessor {
  constructor(private readonly strategy: PaymentStrategy) {}

  withStrategy(strategy: PaymentStrategy): PaymentProcessor {
    return new PaymentProcessor(strategy);
  }

  process(order: Order): PaymentResult {
    return this.strategy.process(order);
  }
}
```

**Improvement**: In multi-threaded environments, ensure safety by (1) passing Strategy as an argument, (2) making Context immutable, or (3) using thread-local storage.

---

## 7. Practice Exercises

### Exercise 1: Basic — Text Transformation Strategy

**Task**: Implement text transformation using the Strategy pattern.

Requirements:
1. `TextTransformer` interface: `transform(text: string): string`
2. Concrete strategies: `UpperCase`, `LowerCase`, `CamelCase`, `SnakeCase`, `KebabCase`
3. `TextProcessor` Context: transforms text using a Strategy

**Test Cases**:

```typescript
const processor = new TextProcessor(new UpperCase());
console.log(processor.process("hello world")); // "HELLO WORLD"

processor.setStrategy(new CamelCase());
console.log(processor.process("hello world")); // "helloWorld"

processor.setStrategy(new SnakeCase());
console.log(processor.process("hello world")); // "hello_world"

processor.setStrategy(new KebabCase());
console.log(processor.process("hello world")); // "hello-world"
```

**Expected Output**: As shown in the comments above.

---

### Exercise 2: Applied — Dynamic Strategy Registry

**Task**: Implement a Strategy Registry and build a system that can dynamically select a Strategy from a configuration file or API parameters.

Requirements:
1. `StrategyRegistry<T>` class: registration and retrieval of strategies
2. Support for a default Strategy
3. Retrieve a list of available strategies
4. Add strategies at runtime (plugin support)
5. Implement a concrete example for Shipping (shipping cost calculation)

**Test Cases**:

```typescript
const registry = new StrategyRegistry<ShippingStrategy>();
registry
  .register("standard", new StandardShipping(), true)
  .register("express", new ExpressShipping())
  .register("same-day", new SameDayShipping());

console.log(registry.getAvailableNames());
// ["standard", "express", "same-day"]

const strategy = registry.get("express");
console.log(strategy.calculate(1000, 2.5)); // shipping cost calculation

// Unregistered name -> default strategy
const fallback = registry.get("unknown");
console.log(fallback === registry.get("standard")); // true
```

**Expected Output**: As shown in the comments above.

---

### Exercise 3: Advanced — Composable Strategy Pipeline

**Task**: Build a framework that combines multiple strategies and applies processing in a pipeline fashion.

Requirements:
1. `TransformPipeline<T>` class: chain multiple transformation strategies
2. `addStep(strategy)`: add a step to the pipeline
3. `execute(input)`: execute the pipeline sequentially
4. `addConditional(predicate, strategy)`: apply a strategy conditionally
5. Implement a concrete example with an image processing pipeline

**Test Cases**:

```typescript
interface ImageData {
  width: number;
  height: number;
  format: string;
  quality: number;
}

const pipeline = new TransformPipeline<ImageData>()
  .addStep(new ResizeStrategy(800, 600))
  .addConditional(
    img => img.format === 'png',
    new ConvertToJpeg()
  )
  .addStep(new CompressStrategy(85));

const result = pipeline.execute({
  width: 1920, height: 1080, format: 'png', quality: 100
});
console.log(result);
// { width: 800, height: 600, format: 'jpg', quality: 85 }
```

**Expected Output**: As shown in the comments above.


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check the path and format of the configuration file |
| Timeout | Network delay / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the executing user's permissions, review settings |
| Data inconsistency | Race conditions in concurrent processing | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Incremental verification**: Use log output or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, run tests for related areas as well

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
    """Decorator that logs the input and output of a function"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception raised: {func.__name__}: {e}")
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

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
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
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5 people) -> Monolith            │
│    └─ Large (10+ people) -> Go to 2             │
│                                                 │
│  2. How often do you deploy?                    │
│    ├─ Once a week or less -> Monolith + modules │
│    └─ Daily / multiple times -> Go to 3         │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High -> Microservices                     │
│    └─ Moderate -> Modular monolith              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Analyzing Trade-offs

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows using the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction offers high reusability but can make debugging difficult
- Low abstraction is intuitive but tends to lead to code duplication

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
        """Describe the background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
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
        md += f"## Background\n{self.context}\n\n"
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

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for critical paths
- Introduce monitoring early

**Lessons learned:**
- Don't strive for perfection (YAGNI principle)
- Gather user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually renewing a system that has been in operation for more than 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if no existing tests exist
- Coexist old and new systems via an API gateway
- Perform data migration in stages

| Phase | Work Content | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, mapping dependencies | 2–4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4–6 weeks | Low |
| 3. Migration start | Migrate peripheral features first | 3–6 months | Medium |
| 4. Core migration | Migrate core features | 6–12 months | High |
| 5. Completion | Decommission old system | 2–4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries using Inner Source
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** Systems where millisecond-level response times are required

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Asynchronous processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low–Medium | High | CPU-bound cases |
---

## 8. FAQ

### Q1: Is Strategy the same as DI?

DI (Dependency Injection) is a mechanism for injecting dependencies, while Strategy is a pattern for exchanging algorithms. DI can be used as a means to implement Strategy, but Strategy can be implemented without DI. Using a DI container (InversifyJS, tsyringe, etc.) allows strategies to be automatically injected from a configuration file, which is convenient but not required.

### Q2: In JavaScript, can Strategy be implemented simply by passing a function?

Yes. Callback functions are a lightweight implementation of the Strategy pattern. `Array.sort(compareFn)` is a typical example. However, classes are more appropriate for strategies that hold complex state or require parameter configuration. A practical rule of thumb: "if a single function is enough, no class is needed; use a class if it is needed for configuration or testing purposes."

### Q3: What is the difference between Strategy and Template Method?

Strategy exchanges the entire algorithm through delegation (has-a). Template Method overrides part of an algorithm through inheritance (is-a). Strategy is more flexible and is preferred in modern programming. The GoF themselves state "favor delegation over inheritance."

### Q4: When should I introduce Strategy?

Consider introducing it when the following conditions are met: (1) there are 3 or more variations of the same processing, (2) future additions of new variations are expected, (3) the algorithm needs to be switched at runtime, (4) you want to test algorithms individually. Conversely, if there are only 2 variations with no expected additions, if-else is sufficient.

### Q5: What is the relationship between Strategy and polymorphism?

The Strategy pattern is an application of polymorphism. Treating different implementations uniformly through a common interface is polymorphism itself. In OOP it is achieved with interfaces/abstract classes; in functional programming with function types (type aliases).

### Q6: How should tests for the Strategy pattern be written?

It is effective to write tests in three layers.

1. **Unit tests for each Strategy**: Verify input and expected output for each Strategy. Since strategies are independent classes/functions, they are easy to test without mocks.
2. **Tests for Context**: Inject a mock Strategy and verify that Context is calling Strategy correctly. Do not go into the implementation details of Strategy here.
3. **Integration tests**: Combine actual strategies with Context and verify end-to-end behavior.

```typescript
// 1. Unit test for Strategy
describe('ExpressShipping', () => {
  it('applies express shipping rate for packages under 5kg', () => {
    const strategy = new ExpressShipping();
    expect(strategy.calculate(1000, 3.0)).toBe(1800); // base rate + express surcharge
  });
});

// 2. Context test (using mock)
describe('ShippingCalculator', () => {
  it('delegates calculation to the configured Strategy', () => {
    const mockStrategy: ShippingStrategy = {
      calculate: jest.fn().mockReturnValue(500),
    };
    const calculator = new ShippingCalculator(mockStrategy);
    const result = calculator.calculateShipping(1000, 2.0);
    expect(mockStrategy.calculate).toHaveBeenCalledWith(1000, 2.0);
    expect(result).toBe(500);
  });
});

// 3. Integration test
describe('ShippingCalculator + StandardShipping', () => {
  it('calculates actual shipping costs correctly', () => {
    const calculator = new ShippingCalculator(new StandardShipping());
    expect(calculator.calculateShipping(1000, 2.0)).toBe(600);
  });
});
```

### Q7: How do you choose between Strategy and the Decorator pattern?

Strategy's purpose is "algorithm exchange," while Decorator's purpose is "adding/decorating functionality." With Strategy, one strategy is selected and executed at a given point in time, whereas Decorator stacks multiple wrappers to extend functionality.

Decision criteria:
- "Execute A **or** B" -> Strategy (exclusive selection)
- "Execute A **and also** B" -> Decorator (cumulative addition)

In practice, both are often combined; for example, wrapping a logging Strategy with a caching Decorator is an effective design.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## 9. Summary

| Item | Key Point |
|------|---------|
| Purpose | Encapsulate algorithms to make them interchangeable |
| OCP | Adding new strategies requires no changes to existing code |
| Implementation style | Class-based (with state) / Function-based (lightweight) |
| Registry | A supplementary pattern that balances dynamic selection and extensibility |
| Functional | Can be implemented simply by passing functions (e.g., Array.sort) |
| Decision criteria | Introduce when there are 3+ variations or future expansion is expected |
| Caution | Design Context so it does not know the concrete type of Strategy |
| Granularity | One responsibility per Strategy (adherence to ISP) |

---

## Guides to Read Next

- [Command Pattern](./02-command.md) -- Encapsulation of operations and Undo/Redo
- [State Pattern](./03-state.md) -- Managing state transitions
- [Observer Pattern](./00-observer.md) -- Event-driven design
- [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) -- Details on OCP
- [Functional Patterns](../03-functional/02-fp-patterns.md) -- Function composition and pipelines

---

## References

1. Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley. -- The original source for the Strategy pattern.
2. Freeman, E., Robson, E. (2020). *Head First Design Patterns* (2nd Edition). O'Reilly Media. -- Covers the Strategy pattern first and carefully explains its relationship with design principles.
3. Refactoring.Guru -- Strategy. https://refactoring.guru/design-patterns/strategy -- Illustrated guide with multi-language implementation examples.
4. Martin, R.C. (2003). *Agile Software Development: Principles, Patterns, and Practices*. Prentice Hall. -- The relationship between OCP and Strategy.
5. Fowler, M. (1999). *Refactoring: Improving the Design of Existing Code*. Addison-Wesley. -- The "Replace Conditional with Polymorphism" refactoring.
