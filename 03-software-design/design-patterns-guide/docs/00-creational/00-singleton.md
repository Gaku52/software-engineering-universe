# Singleton Pattern

> A creational pattern that guarantees **only one** instance exists throughout the entire application and provides a global access point to that instance.

---

## What You Will Learn in This Chapter

1. The purpose and structure of the Singleton pattern, and the design intent (WHY) behind restricting an instance to exactly one
2. The internal mechanics and usage differences of thread-safe implementations (Eager Init / DCL / Holder / Enum / Module Scope)
3. Alternative approaches to Singleton using DI (Dependency Injection) and how to ensure testability
4. Global state problems caused by Singleton overuse and how to identify appropriate use cases
5. Implementation patterns and edge cases in each language (TypeScript / Java / Python / Go / Kotlin)

---

## Prerequisites

The following knowledge is recommended before working through this guide.

| Topic | Required Level | Reference |
|---------|-----------|-----------|
| Object-oriented basics (classes, instances, constructors) | Required | OOP Basics |
| SOLID principles (especially SRP, DIP) | Recommended | [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) |
| Multithreading / concurrency basics | Recommended | Concurrency |
| ES Module mechanics (JavaScript/TypeScript) | Recommended | [MDN Modules](https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Modules) |
| DI (Dependency Injection) concepts | Helpful | [DIP](../../../clean-code-principles/docs/00-principles/01-solid.md) |

---

## 1. What Is the Singleton Pattern — Core Understanding

### 1.1 Pattern Definition

The Singleton pattern is classified under "Creational Patterns" among the 23 design patterns defined by the GoF (Gang of Four). Its intent is as follows:

> **Ensure that a class has only one instance, and provide a global access point to it.**

This definition contains two independent responsibilities:

1. **Limiting the number of instances**: The class itself controls its own instance creation
2. **Global access**: The instance can be accessed from anywhere in the application

### 1.2 Why Singleton Is Necessary (WHY)

The fundamental problem that the Singleton pattern solves is **"guaranteeing consistency of shared resources."**

```
[Problem Scenario]

Thread A                        Thread B
    |                               |
    v                               v
new DatabasePool()              new DatabasePool()
    |                               |
    v                               v
Reserves 10 connections         Reserves 10 connections
    |                               |
    v                               v
Total 20 connections → Exceeds database limit → Error!

[Solution with Singleton]

Thread A                        Thread B
    |                               |
    v                               v
DatabasePool.getInstance()      DatabasePool.getInstance()
    |                               |
    +--------> Same instance   <----+
               |
               v
           10 connections (reserved only once)
```

Specific cases where Singleton is needed:

1. **Database connection pool**: Creating multiple pools makes the connection count uncontrollable
2. **Logger**: Multiple logger instances writing to the same file causes data races
3. **Configuration object**: Different instances holding different config values causes inconsistent application behavior
4. **Cache**: Multiple cache instances result in duplicate data storage and loss of consistency
5. **Hardware access**: Resources that physically exist only once, such as printer spoolers or GPU contexts

### 1.3 Cases Where Singleton Should Not Be Used

Conversely, Singleton should be avoided in the following cases:

- **Stateless utilities**: If there is no state, static methods are sufficient
- **Sharing business logic**: Making domain services Singleton makes testing difficult
- **"It's convenient"**: Using it as a substitute for global variables is an abandonment of design

---

## 2. Singleton Structure

### 2.1 UML Class Diagram

```
+---------------------------+
|       Singleton           |
+---------------------------+
| - instance: Singleton     |  ← class variable (static)
| - data: any               |  ← instance variable
+---------------------------+
| - constructor()           |  ← private: prevents external new
| + getInstance(): Singleton|  ← the sole access point
| + getData(): any          |
| + setData(d: any): void   |
+---------------------------+
        |
        | instance is created only once
        v
  +------------------+
  | <<instance>>     |
  | Singleton        |
  | data: "some val" |
  +------------------+
```

### 2.2 Sequence Diagram

```
Client A          Singleton Class          Client B
   |                    |                      |
   |  getInstance()     |                      |
   |------------------->|                      |
   |                    |                      |
   |  instance == null  |                      |
   |  → new Singleton() |                      |
   |  → stored in instance                     |
   |                    |                      |
   |  <--- instance ----|                      |
   |                    |                      |
   |                    |   getInstance()      |
   |                    |<---------------------|
   |                    |                      |
   |                    |   instance != null   |
   |                    |   → return existing  |
   |                    |                      |
   |                    |--- instance -------->|
   |                    |                      |

   * Client A and Client B receive the same instance
```

### 2.3 Internal Operation in Detail

Understanding the Singleton pattern's internal operation step by step:

```
Step 1: First access
┌─────────────────────────────────────┐
│ Singleton class                      │
│                                     │
│  static instance: null  ← not yet created │
│                                     │
│  getInstance() {                    │
│    if (instance == null) {  ← true  │
│      instance = new Singleton()     │
│      ↑ private constructor called   │
│    }                                │
│    return instance  ← newly created │
│  }                                  │
└─────────────────────────────────────┘

Step 2: Second and subsequent accesses
┌─────────────────────────────────────┐
│ Singleton class                      │
│                                     │
│  static instance: [Object] ← existing │
│                                     │
│  getInstance() {                    │
│    if (instance == null) { ← false  │
│      // skipped                     │
│    }                                │
│    return instance  ← return existing │
│  }                                  │
└─────────────────────────────────────┘
```

---

## 3. Detailed Explanation of Each Implementation Approach

### Code Example 1: Classic Singleton (TypeScript)

The most basic implementation. Works correctly in single-threaded environments (JavaScript/TypeScript).

```typescript
class Singleton {
  private static instance: Singleton | null = null;
  private value: number;

  // private constructor prevents external new
  private constructor(value: number) {
    this.value = value;
    console.log("Singleton: constructor executed (only once)");
  }

  static getInstance(): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton(42);
    }
    return Singleton.instance;
  }

  getValue(): number {
    return this.value;
  }

  setValue(value: number): void {
    this.value = value;
  }
}

// Usage example
const a = Singleton.getInstance();
const b = Singleton.getInstance();

console.log(a === b);         // true — same instance
console.log(a.getValue());    // 42

a.setValue(100);
console.log(b.getValue());    // 100 — reflected because it's the same instance
```

**WHY — Why is the constructor private?**

Making the constructor private **prevents at compile time** external code from calling `new Singleton()`. Without this, developers could accidentally create multiple instances.

```typescript
// The danger without a private constructor
const s1 = new Singleton(1);  // direct creation → uncontrolled
const s2 = new Singleton(2);  // a second instance is created
```

### Code Example 2: Module Scope Singleton (TypeScript — Recommended)

In JavaScript/TypeScript, because ES Modules themselves are cached, an instance exported at module level effectively becomes a Singleton.

```typescript
// config.ts — the ES Module itself behaves as a Singleton
class AppConfig {
  readonly dbHost: string;
  readonly dbPort: number;
  readonly logLevel: string;
  readonly maxRetries: number;

  constructor() {
    // Reading from environment variables (executed only once)
    this.dbHost = process.env.DB_HOST ?? "localhost";
    this.dbPort = Number(process.env.DB_PORT ?? 5432);
    this.logLevel = process.env.LOG_LEVEL ?? "info";
    this.maxRetries = Number(process.env.MAX_RETRIES ?? 3);

    console.log("AppConfig: initialization complete");
  }

  get connectionString(): string {
    return `postgresql://${this.dbHost}:${this.dbPort}/mydb`;
  }
}

// Instantiated only once at module level
// All modules that import this receive the same instance
export const appConfig = new AppConfig();

// --- Usage ---
// import { appConfig } from './config';
// console.log(appConfig.connectionString);
```

**WHY — Why module scope is recommended:**

1. **Guaranteed by language spec**: The ECMAScript specification ensures modules are evaluated only once
2. **Minimal code**: No boilerplate like getInstance() is needed
3. **Intuitive**: Can be used just like a regular object
4. **Tree-shaking compatible**: Bundlers will exclude it if it's not used

```
Module evaluation mechanism:

First import { appConfig } from './config'
  → evaluates config.ts → executes new AppConfig() → saves to cache

Second import { appConfig } from './config'
  → retrieves from cache → same instance returned (no re-evaluation)

Third import { appConfig } from './config'
  → retrieves from cache → same instance returned (no re-evaluation)
```

### Code Example 3: Thread-Safe — Double-Checked Locking (Java)

In multithreaded environments, two threads calling `getInstance()` simultaneously may result in two instances being created. DCL (Double-Checked Locking) prevents this.

```java
public class Singleton {
    // volatile: guarantees memory visibility (prevents CPU cache issues)
    private static volatile Singleton instance;

    private Singleton() {
        // Heavy initialization (e.g., DB connection, config file loading)
        System.out.println("Singleton: initialization executed");
    }

    public static Singleton getInstance() {
        if (instance == null) {                  // 1st check (no lock — fast path)
            synchronized (Singleton.class) {     // acquire lock
                if (instance == null) {          // 2nd check (re-verify inside lock)
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

**WHY — Why is it "double" checked?**

```
[Without DCL (synchronized only)]

Thread A: getInstance() → enters synchronized block → waits
Thread B: getInstance() → enters synchronized block → waits
  ↑ lock acquisition overhead on every call (even after instance is created)

[With DCL]

Step 1: 1st check (no lock)
  instance != null → return immediately (fast path, 99.99% of cases)
  instance == null → proceed to Step 2

Step 2: synchronized block (acquire lock)
  Even if multiple threads reach here, only one can enter

Step 3: 2nd check (inside lock)
  If another thread already created it, this detects it and prevents duplicate creation
```

**WHY — Why is volatile necessary?**

`new Singleton()` internally executes in these 3 steps:

```
① Allocate memory
② Execute constructor (initialization)
③ Assign memory address to instance variable

Due to JVM instruction reordering, the execution order may become ①→③→②.

Thread A: completes ①→③ (② not yet done)
Thread B: 1st check sees instance != null → uses uninitialized object → bug!

volatile prohibits reordering and guarantees the order ①→②→③.
```

### Code Example 4: Bill Pugh Singleton (Java — Recommended)

Also known as the Holder pattern. The most elegant thread-safe implementation, leveraging the JVM's class loading mechanism.

```java
public class Singleton {
    private Singleton() {
        System.out.println("Singleton: initialization executed");
    }

    // Inner class is not loaded until it is first accessed
    private static class Holder {
        // static final guarantees JVM ensures exclusive initialization
        private static final Singleton INSTANCE = new Singleton();
    }

    public static Singleton getInstance() {
        return Holder.INSTANCE;  // Holder class is loaded on first call
    }
}
```

**WHY — Why is the Holder pattern recommended?**

1. **Lazy initialization**: The `Holder` class is not loaded until `getInstance()` is called for the first time
2. **Thread-safe**: JVM specification guarantees class initialization is done exclusively (JLS 12.4.2)
3. **Lock-free**: No impact on performance since synchronized is not used
4. **Simple code**: No volatile or synchronized needed

### Code Example 5: Enum Singleton (Java)

The best Singleton implementation in Java, recommended by Joshua Bloch (author of Effective Java).

```java
public enum Singleton {
    INSTANCE;

    private int value;

    public int getValue() {
        return value;
    }

    public void setValue(int value) {
        this.value = value;
    }

    public void doSomething() {
        System.out.println("Singleton operation with value: " + value);
    }
}

// Usage
Singleton.INSTANCE.setValue(42);
Singleton.INSTANCE.doSomething();
```

**WHY — Why is Enum the best option?**

1. **Thread-safe**: JVM guarantees enum initialization
2. **Serialization support**: No new instance is created on deserialization (automatic)
3. **Reflection attack prevention**: enum cannot be instantiated via `Constructor.newInstance()`
4. **Minimal code**: Almost zero boilerplate

```
Attacks that regular Singleton is vulnerable to:

1. Reflection attack
   Constructor<Singleton> c = Singleton.class.getDeclaredConstructor();
   c.setAccessible(true);
   Singleton s2 = c.newInstance();  // second instance created!
   → Enum throws IllegalArgumentException

2. Deserialization attack
   ObjectInputStream ois = new ObjectInputStream(...);
   Singleton s2 = (Singleton) ois.readObject();  // different instance!
   → Enum returns the same INSTANCE
```

### Code Example 6: Python — Metaclass Singleton

In Python, metaclasses can be used to customize the instance creation process of a class.

```python
import threading

class SingletonMeta(type):
    """Thread-safe Singleton metaclass"""
    _instances: dict = {}
    _lock: threading.Lock = threading.Lock()

    def __call__(cls, *args, **kwargs):
        # Double-Checked Locking pattern
        if cls not in cls._instances:
            with cls._lock:
                if cls not in cls._instances:
                    instance = super().__call__(*args, **kwargs)
                    cls._instances[cls] = instance
        return cls._instances[cls]

class Database(metaclass=SingletonMeta):
    def __init__(self):
        self.connection = "connected"
        print(f"Database: initialization executed (id={id(self)})")

    def query(self, sql: str) -> str:
        return f"Result of: {sql}"

# Usage
db1 = Database()  # "Database: initialization executed (id=...)"
db2 = Database()  # no output (returns existing instance)

print(db1 is db2)            # True
print(db1.query("SELECT 1")) # "Result of: SELECT 1"
```

**WHY — Why a metaclass?**

```
Python instance creation flow:

obj = MyClass(args)
  ↓
MyClass.__call__(args)     ← metaclass __call__ is invoked
  ↓
MyClass.__new__(cls)       ← memory allocation for object
  ↓
MyClass.__init__(self)     ← initialization
  ↓
return obj

By overriding SingletonMeta.__call__,
we can insert an instance existence check "before" __new__ and __init__.
```

### Code Example 7: Python — Decorator Singleton

A lighter-weight approach than metaclasses using a decorator.

```python
from functools import wraps

def singleton(cls):
    """Singleton decorator"""
    instances = {}

    @wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]

    return get_instance

@singleton
class Logger:
    def __init__(self):
        self.logs: list[str] = []
        print("Logger: initialization executed")

    def log(self, message: str):
        self.logs.append(message)
        print(f"[LOG] {message}")

# Usage
logger1 = Logger()  # "Logger: initialization executed"
logger2 = Logger()  # no output

logger1.log("Start")
print(logger2.logs)  # ["Start"] — same instance
```

### Code Example 8: Go — sync.Once

In Go, `sync.Once` is used to achieve goroutine-safe lazy initialization.

```go
package main

import (
    "fmt"
    "sync"
)

type singleton struct {
    value int
}

var (
    instance *singleton
    once     sync.Once
)

func GetInstance() *singleton {
    once.Do(func() {
        fmt.Println("Singleton: initialization executed")
        instance = &singleton{value: 42}
    })
    return instance
}

func main() {
    s1 := GetInstance() // "Singleton: initialization executed"
    s2 := GetInstance() // no output

    fmt.Println(s1 == s2)    // true
    fmt.Println(s1.value)    // 42
}
```

**WHY — Internal implementation of sync.Once:**

```go
// Internal implementation of sync.Once (simplified)
type Once struct {
    done uint32     // checked atomically (fast path)
    m    Mutex      // used only on first call
}

func (o *Once) Do(f func()) {
    if atomic.LoadUint32(&o.done) == 0 {  // fast path
        o.doSlow(f)
    }
}

func (o *Once) doSlow(f func()) {
    o.m.Lock()
    defer o.m.Unlock()
    if o.done == 0 {  // DCL
        defer atomic.StoreUint32(&o.done, 1)
        f()
    }
}
```

### Code Example 9: Kotlin — object Declaration

In Kotlin, the `object` keyword provides language-level support for Singleton.

```kotlin
object AppConfig {
    val dbHost: String = System.getenv("DB_HOST") ?: "localhost"
    val dbPort: Int = System.getenv("DB_PORT")?.toInt() ?: 5432

    fun connectionString(): String =
        "postgresql://$dbHost:$dbPort/mydb"

    init {
        println("AppConfig: initialization executed")
    }
}

// Usage
fun main() {
    println(AppConfig.connectionString())
    // AppConfig.connectionString() always returns the same result
}
```

**WHY — What does Kotlin's object do internally?**

```
Kotlin's object declaration is compiled to the following Java code at compile time:

public final class AppConfig {
    public static final AppConfig INSTANCE;

    static {
        AppConfig var0 = new AppConfig();
        INSTANCE = var0;
    }

    private AppConfig() { ... }
}

→ Eager Init pattern + private constructor is auto-generated
```

### Code Example 10: Singleton Lifetime via DI Container

In practice, delegating Singleton constraint management to a DI container is far superior to having the class manage it itself.

```typescript
// InversifyJS example
import { Container, injectable, inject } from "inversify";

// Interfaces
interface Logger {
  log(message: string): void;
}

interface Database {
  query(sql: string): Promise<any>;
}

const TYPES = {
  Logger: Symbol.for("Logger"),
  Database: Symbol.for("Database"),
};

// Implementation classes (unaware that they are Singletons)
@injectable()
class ConsoleLogger implements Logger {
  constructor() {
    console.log("ConsoleLogger: initialized");
  }

  log(message: string): void {
    console.log(`[LOG] ${message}`);
  }
}

@injectable()
class PostgresDatabase implements Database {
  constructor(@inject(TYPES.Logger) private logger: Logger) {
    this.logger.log("PostgresDatabase: initialized");
  }

  async query(sql: string): Promise<any> {
    this.logger.log(`Executing: ${sql}`);
    return [];
  }
}

// DI container controls lifetime
const container = new Container();

container
  .bind<Logger>(TYPES.Logger)
  .to(ConsoleLogger)
  .inSingletonScope();   // ← container guarantees one instance

container
  .bind<Database>(TYPES.Database)
  .to(PostgresDatabase)
  .inSingletonScope();

// Retrieve
const logger1 = container.get<Logger>(TYPES.Logger);
const logger2 = container.get<Logger>(TYPES.Logger);
console.log(logger1 === logger2); // true

// In tests, can be swapped with a mock
const testContainer = new Container();
testContainer.bind<Logger>(TYPES.Logger).toConstantValue({
  log: jest.fn(),
});
```

**WHY — Why DI containers are superior:**

```
Class-internal Singleton:
┌──────────────────────┐
│ class Database {     │
│   static instance    │  ← class manages lifetime
│   private constructor│  ← cannot mock in tests
│   static getInstance │  ← direct reference = tight coupling
│ }                    │
└──────────────────────┘

DI Container Singleton:
┌──────────────────────┐
│ interface Database { │  ← depends on interface
│   query(): ...       │
│ }                    │
│                      │
│ container.bind(...)  │  ← container manages lifetime
│   .inSingletonScope()│  ← scope change in one line
│                      │
│ In tests:            │
│   bind(...).to(Mock) │  ← easy mock substitution
└──────────────────────┘
```

---

## 4. Comparison of Thread-Safe Implementations

### 4.1 Overview of Implementation Strategies

```
┌──────────────────────────────────────────────────────────────┐
│          Thread-Safe Singleton Implementation Strategies       │
├──────────────┬───────────────────────────────────────────────┤
│  Eager Init  │  Created at class load (simplest)             │
│              │  static instance = new Singleton()            │
│              │  Pros: easy to implement, thread-safe         │
│              │  Cons: consumes memory even if unused         │
├──────────────┼───────────────────────────────────────────────┤
│  DCL         │  Double-Checked Locking                       │
│              │  volatile + synchronized                      │
│              │  Pros: lazy init + fast path                  │
│              │  Cons: complex impl, volatile understanding   │
├──────────────┼───────────────────────────────────────────────┤
│  Holder      │  Inner class lazy loading (Bill Pugh)         │
│              │  Pros: lazy + lock-free + simple              │
│              │  Cons: Java-specific idiom                    │
├──────────────┼───────────────────────────────────────────────┤
│  Enum        │  Guaranteed by JVM. Handles serialization     │
│              │  and reflection.                              │
│              │  Pros: complete protection, minimal code      │
│              │  Cons: no inheritance, Java-specific          │
├──────────────┼───────────────────────────────────────────────┤
│  sync.Once   │  Go standard library                         │
│              │  Pros: goroutine-safe, idiomatic              │
│              │  Cons: Go-specific                            │
├──────────────┼───────────────────────────────────────────────┤
│  Module      │  Leverages ES Module caching mechanism        │
│  Scope       │  Pros: guaranteed by language spec, minimal  │
│              │  Cons: JS/TS only, care needed on test reset  │
└──────────────┴───────────────────────────────────────────────┘
```

### 4.2 Performance Characteristics

```
Number of accesses vs. latency (conceptual diagram)

Latency
  ^
  |
  |  * Lazy (lock on every call)
  |  |
  |  |   * DCL (lock on first call only)
  |  |   |
  |  |   |  * Eager / Holder / Enum / Module
  |  |   |  |
  |--+---+--+-------------------------> Number of accesses
     1   2  3   4   5   ...  1000

  * DCL is equivalent to Eager/Holder speed from the second access onward
  * Synchronized every time always incurs lock acquisition cost
```

---

## 5. Comparison Tables

### Comparison Table 1: Singleton Implementation Methods

| Method | Lazy Init | Thread-Safe | Impl Complexity | Serialization | Reflection Defense | Rating |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Eager Init | No | Yes | Low | Needs handling | No | B |
| Lazy (no sync) | Yes | No | Low | Needs handling | No | D |
| DCL | Yes | Yes | Medium | Needs handling | No | B |
| Holder Pattern | Yes | Yes | Medium | Needs handling | No | A |
| Enum (Java) | No | Yes | Low | Automatic | Yes | S |
| sync.Once (Go) | Yes | Yes | Low | N/A | N/A | A |
| object (Kotlin) | No | Yes | Low | Needs handling | No | A |
| Module Scope (JS/TS) | Yes* | N/A | Low | N/A | N/A | S |

*Evaluated on first module import.

### Comparison Table 2: Singleton vs DI Container vs Global Variable

| Aspect | Class-internal Singleton | DI Container Singleton | Global Variable |
|------|:---:|:---:|:---:|
| Testability | Low | High | Worst |
| Coupling | High (direct ref) | Low (via interface) | Highest |
| Lifetime management | Class itself | Container | None |
| Global state | Exposed | Can be hidden | Fully exposed |
| Flexibility | Low | High | Low |
| Type safety | Yes | Yes | Language-dependent |
| IDE support | Good | Good | Limited |

### Comparison Table 3: Recommended Singleton Implementation by Language

| Language | Recommended Implementation | Reason |
|------|---------|------|
| Java | Enum Singleton | Complete protection, Effective Java recommended |
| Kotlin | object declaration | Native language support |
| TypeScript | Module scope export | Guaranteed by language spec, minimal code |
| Python | Metaclass or decorator | Flexible, Pythonic |
| Go | sync.Once | Standard library, idiomatic |
| C# | Lazy<T> | .NET standard, thread-safe |
| Rust | once_cell / std::sync::OnceLock | Integrated with ownership system |

---

## 6. Singleton and Related Patterns

### 6.1 Usage Map of Singleton

```
                    Singleton
                       |
        +--------------+--------------+
        |              |              |
   Logger         Config         Registry
   (logger)       (config)       (registry)
        |              |              |
        |              |              +--- Factory product
        |              |                   registration target
        |              +--- Use Builder to
        |                   construct complex config
        +--- Event aggregation
             point for Observer
```

### 6.2 Singleton Combined with Other Patterns

```typescript
// Singleton + Factory: Registry pattern
class PluginRegistry {
  private static instance: PluginRegistry;
  private plugins = new Map<string, () => Plugin>();

  private constructor() {}

  static getInstance(): PluginRegistry {
    if (!this.instance) {
      this.instance = new PluginRegistry();
    }
    return this.instance;
  }

  register(name: string, factory: () => Plugin): void {
    this.plugins.set(name, factory);
  }

  create(name: string): Plugin {
    const factory = this.plugins.get(name);
    if (!factory) throw new Error(`Unknown plugin: ${name}`);
    return factory();
  }
}

// Singleton + Observer: Event bus
class EventBus {
  private static instance: EventBus;
  private listeners = new Map<string, Set<Function>>();

  private constructor() {}

  static getInstance(): EventBus {
    if (!this.instance) {
      this.instance = new EventBus();
    }
    return this.instance;
  }

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(handler => handler(data));
  }
}
```

---

## 7. Real-World Application Examples

### 7.1 Node.js Module Cache (A Real Example of Singleton)

Node.js `require()` / `import` internally caches modules. This is a direct implementation of the Singleton pattern.

```
Internal behavior of require('express'):

Module._cache = {};  // global cache

Module._load(filename) {
  if (Module._cache[filename]) {
    return Module._cache[filename].exports;  // cache hit
  }

  const module = new Module(filename);
  Module._cache[filename] = module;  // save to cache
  module.load(filename);             // read and execute file
  return module.exports;
}
```

### 7.2 Database Connection Pool

```typescript
// Practical Singleton connection pool
import { Pool, PoolConfig } from 'pg';

class DatabasePool {
  private static pool: Pool | null = null;

  static getPool(): Pool {
    if (!DatabasePool.pool) {
      const config: PoolConfig = {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'myapp',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD,
        max: 20,                    // maximum connections
        idleTimeoutMillis: 30000,   // idle timeout
        connectionTimeoutMillis: 2000, // connection timeout
      };

      DatabasePool.pool = new Pool(config);

      // Error handling
      DatabasePool.pool.on('error', (err) => {
        console.error('Unexpected pool error:', err);
      });

      console.log('DatabasePool: initialized (max=20)');
    }
    return DatabasePool.pool;
  }

  // For tests: reset the pool
  static async reset(): Promise<void> {
    if (DatabasePool.pool) {
      await DatabasePool.pool.end();
      DatabasePool.pool = null;
    }
  }
}

// Usage
async function getUsers() {
  const pool = DatabasePool.getPool();
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
}
```

### 7.3 Configuration Management (Switching by Environment)

```typescript
// Managing environment-specific settings with Singleton
type Environment = 'development' | 'staging' | 'production';

interface AppSettings {
  readonly env: Environment;
  readonly apiBaseUrl: string;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly enableMetrics: boolean;
  readonly maxRetries: number;
}

const settings: Record<Environment, AppSettings> = {
  development: {
    env: 'development',
    apiBaseUrl: 'http://localhost:3000',
    logLevel: 'debug',
    enableMetrics: false,
    maxRetries: 1,
  },
  staging: {
    env: 'staging',
    apiBaseUrl: 'https://staging-api.example.com',
    logLevel: 'info',
    enableMetrics: true,
    maxRetries: 3,
  },
  production: {
    env: 'production',
    apiBaseUrl: 'https://api.example.com',
    logLevel: 'warn',
    enableMetrics: true,
    maxRetries: 5,
  },
};

const env = (process.env.NODE_ENV as Environment) ?? 'development';
export const appSettings: Readonly<AppSettings> = Object.freeze(settings[env]);
```

---

## 8. Edge Cases and Cautions

### 8.1 Singleton Broken by Serialization

```java
// Java: Example of Singleton being broken by deserialization
public class Singleton implements Serializable {
    private static final Singleton INSTANCE = new Singleton();

    private Singleton() {}

    public static Singleton getInstance() {
        return INSTANCE;
    }

    // Without this, a new instance is created during deserialization
    // readResolve() returns the existing instance as a defense
    private Object readResolve() {
        return INSTANCE;
    }
}
```

### 8.2 Singleton Broken by Reflection

```java
// Attack code
Constructor<Singleton> constructor = Singleton.class.getDeclaredConstructor();
constructor.setAccessible(true);
Singleton s2 = constructor.newInstance(); // bypasses private constructor!

// Defense: check inside the constructor
private Singleton() {
    if (INSTANCE != null) {
        throw new IllegalStateException("Singleton already initialized");
    }
}
```

### 8.3 Multiple Instances via Class Loaders

```
In Java EE / OSGi environments, different class loaders may load
the same class separately:

ClassLoader A → Singleton.class → instance A
ClassLoader B → Singleton.class → instance B

→ Two "Singletons" now exist!

Solutions:
- Place Singleton in the application's shared class loader
- Share the instance using JNDI
- Delegate to DI container scope management (recommended)
```

### 8.4 Issues in JavaScript Test Environments

```typescript
// Problem with module cache being reset in Jest

// config.ts
export const config = { value: "original" };

// test1.spec.ts
import { config } from './config';
config.value = "modified";  // modified during test

// test2.spec.ts
import { config } from './config';
console.log(config.value);  // "original" or "modified"?
// Depends on Jest's --isolateModules setting

// Solution: provide a reset mechanism per test
export function resetConfig(): void {
  Object.assign(config, defaultConfig);
}
```

### 8.5 The Singleton Trap in Microservices

```
Monolith:
┌─────────────────────────────────┐
│ Application                     │
│   Singleton.getInstance() ──→ one instance
│                                 │
│   Shared by all requests        │
└─────────────────────────────────┘

Microservices:
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Instance1│  │ Instance2│  │ Instance3│
│ Singleton│  │ Singleton│  │ Singleton│
│ (state A)│  │ (state B)│  │ (state C)│
└──────────┘  └──────────┘  └──────────┘
  ↑ An independent Singleton exists in each process
  ↑ State synchronization is needed → external store such as Redis is required

Lesson: Singleton = in-process Singleton; insufficient for distributed environments
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: God Singleton

```typescript
// NG: A "god" Singleton that holds everything
class AppState {
  private static instance: AppState;

  user: User | null = null;
  theme: string = "light";
  cart: CartItem[] = [];
  notifications: Notification[] = [];
  searchHistory: string[] = [];
  recentProducts: Product[] = [];
  // ... 50+ properties

  static getInstance(): AppState {
    if (!this.instance) this.instance = new AppState();
    return this.instance;
  }
}

// Usage: every module depends on AppState
function processOrder() {
  const state = AppState.getInstance();
  state.cart;           // cart feature depends on it
  state.user;           // user feature depends on it
  state.notifications;  // notification feature depends on it
}
```

**Problems**:
- Violates the Single Responsibility Principle (SRP)
- Every module depends on AppState, creating a massive scope of impact for changes
- Tests require initializing unnecessary properties

```typescript
// OK: Split by domain and manage with DI container
interface UserState {
  currentUser: User | null;
  login(credentials: Credentials): Promise<void>;
  logout(): void;
}

interface CartState {
  items: CartItem[];
  addItem(item: CartItem): void;
  removeItem(id: string): void;
}

interface NotificationState {
  notifications: Notification[];
  add(n: Notification): void;
  markRead(id: string): void;
}

// Manage each state independently
container.bind<UserState>(TYPES.UserState).to(UserStateImpl).inSingletonScope();
container.bind<CartState>(TYPES.CartState).to(CartStateImpl).inSingletonScope();
container.bind<NotificationState>(TYPES.NotificationState).to(NotificationStateImpl).inSingletonScope();
```

### Anti-Pattern 2: State Leaking Between Tests

```typescript
// NG: Singleton state leaks between tests
class Counter {
  private static instance: Counter;
  private count = 0;

  private constructor() {}

  static getInstance(): Counter {
    if (!this.instance) this.instance = new Counter();
    return this.instance;
  }

  increment(): void { this.count++; }
  getCount(): number { return this.count; }
}

// Test (NG)
describe("feature A", () => {
  it("increments counter", () => {
    Counter.getInstance().increment();
    Counter.getInstance().increment();
    expect(Counter.getInstance().getCount()).toBe(2); // Pass
  });
});

describe("feature B", () => {
  it("starts at zero", () => {
    // State from previous test remains!
    expect(Counter.getInstance().getCount()).toBe(0); // FAIL: 2
  });
});
```

```typescript
// OK: Provide a reset mechanism
class Counter {
  private static instance: Counter;
  private count = 0;

  private constructor() {}

  static getInstance(): Counter {
    if (!this.instance) this.instance = new Counter();
    return this.instance;
  }

  increment(): void { this.count++; }
  getCount(): number { return this.count; }

  // For testing (do not call in production code)
  static resetForTesting(): void {
    this.instance = undefined as any;
  }
}

// Test (OK)
beforeEach(() => {
  Counter.resetForTesting();
});
```

### Anti-Pattern 3: Side-Effect Initialization Inside Singleton

```typescript
// NG: Connecting to external resources in the constructor
class ApiClient {
  private static instance: ApiClient;
  private connection: WebSocket;

  private constructor() {
    // Starting WebSocket connection in constructor
    // → cannot control when getInstance() is called
    // → actual connection occurs during tests
    this.connection = new WebSocket("wss://api.example.com");
  }

  static getInstance(): ApiClient {
    if (!this.instance) this.instance = new ApiClient();
    return this.instance;
  }
}
```

```typescript
// OK: Separate the explicit initialization method
class ApiClient {
  private static instance: ApiClient;
  private connection: WebSocket | null = null;

  private constructor() {}

  static getInstance(): ApiClient {
    if (!this.instance) this.instance = new ApiClient();
    return this.instance;
  }

  async connect(url: string): Promise<void> {
    this.connection = new WebSocket(url);
    await this.waitForOpen();
  }

  private waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection!.onopen = () => resolve();
      this.connection!.onerror = (e) => reject(e);
    });
  }
}

// Usage: can control initialization timing
const client = ApiClient.getInstance();
await client.connect("wss://api.example.com");
```

---

## 10. Trade-off Analysis

### 10.1 Pros and Cons of Using Singleton

```
Pros                              Cons
+------------------------------+  +------------------------------+
| Can control instance count   |  | Tends to become global state |
| Good memory efficiency       |  | Testing is difficult (hard   |
| Guarantees shared resource   |  |   to mock)                   |
|   consistency                |  | Increases coupling           |
| Clear access point           |  | Concurrent processing needs  |
| Lazy initialization possible |  |   consideration              |
+------------------------------+  | Difficult to reset state     |
                                  +------------------------------+
```

### 10.2 Decision Flowchart

```
Is there a need to limit to a single instance?
│
├── No → Singleton not needed. Use a regular class or DI
│
└── Yes
    │
    ├── Can a DI container be used?
    │   ├── Yes → Use DI Singleton scope (recommended)
    │   └── No → Proceed to next question
    │
    ├── What language?
    │   ├── Java → Enum Singleton
    │   ├── Kotlin → object declaration
    │   ├── JS/TS → Module scope export
    │   ├── Python → Metaclass or decorator
    │   ├── Go → sync.Once
    │   └── Other → Holder or DCL
    │
    └── Confirm that mocking is possible during tests
        ├── Yes → Proceed with implementation
        └── No → Add a reset mechanism
```

---

## 11. Practice Exercises

### Exercise 1: Basic — Implementing a Logger Singleton

**Task**: Implement a logger shared across the entire application using the Singleton pattern.

**Requirements**:
- Support log levels (debug / info / warn / error)
- Attach timestamps to log messages
- Access via `getInstance()`
- Maintain log history and retrieve it via `getHistory()`

```typescript
// === Write your implementation here ===

// Hint: satisfy the following interface
interface ILogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  getHistory(): string[];
}
```

**Expected output**:

```
const logger1 = Logger.getInstance();
const logger2 = Logger.getInstance();

logger1.info("Application started");
logger2.warn("Memory usage high");
logger1.error("Connection failed");

console.log(logger1 === logger2);
// true

console.log(logger1.getHistory());
// [
//   "[2026-01-15T10:30:00.000Z] [INFO] Application started",
//   "[2026-01-15T10:30:00.100Z] [WARN] Memory usage high",
//   "[2026-01-15T10:30:00.200Z] [ERROR] Connection failed"
// ]
```

<details>
<summary>Model Answer (click to expand)</summary>

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger implements ILogger {
  private static instance: Logger | null = null;
  private history: string[] = [];
  private minLevel: LogLevel;

  private static readonly LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private constructor(minLevel: LogLevel = 'debug') {
    this.minLevel = minLevel;
  }

  static getInstance(minLevel?: LogLevel): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(minLevel);
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string): void {
    if (Logger.LEVELS[level] < Logger.LEVELS[this.minLevel]) return;

    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    this.history.push(entry);
    console.log(entry);
  }

  debug(message: string): void { this.log('debug', message); }
  info(message: string): void { this.log('info', message); }
  warn(message: string): void { this.log('warn', message); }
  error(message: string): void { this.log('error', message); }

  getHistory(): string[] {
    return [...this.history]; // return a copy (defensive copy)
  }

  // For testing
  static resetForTesting(): void {
    Logger.instance = null;
  }
}
```

</details>

### Exercise 2: Intermediate — Configuration Manager with Environment Switching

**Task**: Implement a Singleton that manages settings based on the environment (development / staging / production).

**Requirements**:
- Implement as a module scope Singleton
- Determine the environment from the `NODE_ENV` environment variable
- Retrieve config values in a type-safe manner
- Support dynamic overriding of config values
- Validate config values

```typescript
// === Write your implementation here ===

// Hint: satisfy the following interface
interface ConfigManager {
  get<T>(key: string): T;
  get<T>(key: string, defaultValue: T): T;
  set(key: string, value: unknown): void;
  getEnvironment(): string;
  toJSON(): Record<string, unknown>;
}
```

**Expected output**:

```
// NODE_ENV=development

console.log(configManager.getEnvironment());
// "development"

console.log(configManager.get<string>("apiBaseUrl"));
// "http://localhost:3000"

configManager.set("apiBaseUrl", "http://localhost:4000");
console.log(configManager.get<string>("apiBaseUrl"));
// "http://localhost:4000"

console.log(configManager.get<number>("maxRetries", 5));
// 5 (default value returned)
```

<details>
<summary>Model Answer (click to expand)</summary>

```typescript
type Environment = 'development' | 'staging' | 'production';

interface ConfigSchema {
  apiBaseUrl: string;
  logLevel: string;
  enableMetrics: boolean;
  maxRetries: number;
  dbHost: string;
  dbPort: number;
  [key: string]: unknown;
}

const defaults: Record<Environment, ConfigSchema> = {
  development: {
    apiBaseUrl: 'http://localhost:3000',
    logLevel: 'debug',
    enableMetrics: false,
    maxRetries: 1,
    dbHost: 'localhost',
    dbPort: 5432,
  },
  staging: {
    apiBaseUrl: 'https://staging-api.example.com',
    logLevel: 'info',
    enableMetrics: true,
    maxRetries: 3,
    dbHost: 'staging-db.example.com',
    dbPort: 5432,
  },
  production: {
    apiBaseUrl: 'https://api.example.com',
    logLevel: 'warn',
    enableMetrics: true,
    maxRetries: 5,
    dbHost: 'prod-db.example.com',
    dbPort: 5432,
  },
};

class ConfigManagerImpl implements ConfigManager {
  private env: Environment;
  private config: Record<string, unknown>;

  constructor() {
    this.env = (process.env.NODE_ENV as Environment) ?? 'development';
    if (!defaults[this.env]) {
      throw new Error(`Unknown environment: ${this.env}`);
    }
    this.config = { ...defaults[this.env] };
  }

  get<T>(key: string, defaultValue?: T): T {
    const value = this.config[key];
    if (value === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Config key not found: ${key}`);
    }
    return value as T;
  }

  set(key: string, value: unknown): void {
    this.config[key] = value;
  }

  getEnvironment(): string {
    return this.env;
  }

  toJSON(): Record<string, unknown> {
    return { ...this.config };
  }
}

// Module scope Singleton
export const configManager: ConfigManager = new ConfigManagerImpl();
```

</details>

### Exercise 3: Advanced — DI Container-Compatible Singleton

**Task**: Design a testable Singleton service using a DI container (InversifyJS-style).

**Requirements**:
- Define the `ICacheService` interface
- Create a production implementation as `RedisCacheService`
- Create a test implementation as `InMemoryCacheService`
- Configure Singleton scope in the DI container
- Demonstrate mock substitution in test code

```typescript
// === Write your implementation here ===

// Hint: satisfy the following interface
interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}
```

**Expected output**:

```
// Production
const cache = container.get<ICacheService>(TYPES.Cache);
await cache.set("user:1", { name: "Taro" }, 3600);
const user = await cache.get("user:1");
console.log(user); // { name: "Taro" }

// Test
const testCache = testContainer.get<ICacheService>(TYPES.Cache);
await testCache.set("key", "value");
console.log(await testCache.get("key")); // "value"
await testCache.clear();
console.log(await testCache.get("key")); // null
```

<details>
<summary>Model Answer (click to expand)</summary>

```typescript
import { Container, injectable, inject } from "inversify";

const TYPES = {
  Cache: Symbol.for("ICacheService"),
  Logger: Symbol.for("ILogger"),
};

// Interface definition (ICacheService as above)

// Production implementation
@injectable()
class RedisCacheService implements ICacheService {
  private client: any; // Redis client

  constructor(@inject(TYPES.Logger) private logger: ILogger) {
    this.logger.info("RedisCacheService: initialized");
    // this.client = createClient({ url: process.env.REDIS_URL });
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger.debug(`Cache GET: ${key}`);
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.logger.debug(`Cache SET: ${key}`);
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(key);
    return result > 0;
  }

  async clear(): Promise<void> {
    await this.client.flushdb();
  }
}

// Test implementation
@injectable()
class InMemoryCacheService implements ICacheService {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return JSON.parse(entry.value);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// Production container
const container = new Container();
container.bind<ICacheService>(TYPES.Cache)
  .to(RedisCacheService)
  .inSingletonScope();

// Test container
const testContainer = new Container();
testContainer.bind<ICacheService>(TYPES.Cache)
  .to(InMemoryCacheService)
  .inSingletonScope();

// Test example
describe("UserService", () => {
  let cache: ICacheService;

  beforeEach(() => {
    cache = testContainer.get<ICacheService>(TYPES.Cache);
  });

  afterEach(async () => {
    await cache.clear(); // prevent state leaks
  });

  it("should cache user data", async () => {
    await cache.set("user:1", { name: "Taro" }, 3600);
    const user = await cache.get("user:1");
    expect(user).toEqual({ name: "Taro" });
  });
});
```

</details>

---

## 12. FAQ

### Q1: When should Singleton be used?

Use it for **resources that are shared across the entire application and would cause inconsistency if multiple instances existed**, such as loggers, configuration objects, connection pools, and cache managers. However, if a DI container is available, it is preferable to configure Singleton scope there.

**Decision checklist:**

| Check item | If Yes, consider Singleton |
|-------------|----------------------|
| Would multiple instances cause a bug? | Yes → Strong justification |
| Is consistency of shared state necessary? | Yes → Justification |
| Is the initialization cost of the resource high? | Yes → Justification |
| Can a DI container not be used? | Yes → Implement Singleton manually |

### Q2: Why is Singleton sometimes called an "anti-pattern"?

Singleton itself is not an anti-pattern — **overuse** is. It tends to cause the following problems:

1. **Global state**: Accessible from anywhere, making state change tracking difficult
2. **Testing difficulty**: Hard to swap with mocks (especially class-internal Singleton)
3. **Increased coupling**: Direct dependency on concrete classes
4. **Concurrency complexity**: Exclusive control is needed for access to shared state
5. **Hidden dependencies**: Dependencies that don't appear in method signatures

```typescript
// Example of hidden dependencies
function processOrder(order: Order): void {
  // Dependencies on Database and Logger are invisible from the function signature
  const db = Database.getInstance();      // hidden dependency
  const logger = Logger.getInstance();    // hidden dependency

  db.save(order);
  logger.info(`Order ${order.id} processed`);
}

// Making them explicit with DI
function processOrder(
  order: Order,
  db: IDatabase,       // dependency is explicit
  logger: ILogger      // dependency is explicit
): void {
  db.save(order);
  logger.info(`Order ${order.id} processed`);
}
```

### Q3: Is an object exported from an ES Module a Singleton?

Yes. Node.js and major bundlers (webpack, Vite, esbuild) evaluate and cache modules only once. Therefore `export const x = new X()` is effectively a Singleton.

However, be aware of the following:

| Environment | Behavior |
|------|------|
| Node.js (CJS) | `require()` caches. However, different paths are treated as different modules |
| Node.js (ESM) | `import` caches |
| Jest | Module cache can be reset with `--isolateModules` |
| Webpack | Evaluated only once within the bundle |
| SSR (Next.js) | Shared between server requests (caution required) |

### Q4: What is the difference between Singleton and a static class?

```
Singleton:
- One instance exists
- Can implement interfaces (polymorphism)
- Can be managed by a DI container
- Lazy initialization is possible
- Can hold state

Static class:
- No instance exists
- Cannot implement interfaces
- Cannot be managed by a DI container
- Determined at class load time
- Stateless (recommended)
```

Choose Singleton when: interface conformance, DI support, or lazy initialization is needed
Choose static class when: stateless utilities (Math.max(), String.format(), etc.)

### Q5: Can Singleton be used in a microservice environment?

Yes, but understand that the "uniqueness" of Singleton is limited to within a process. When multiple service instances exist, an independent Singleton exists in each process.

```
Solutions:
1. Stateless Singleton: No problem if it holds no state (Logger, Config, etc.)
2. External store: Save state to Redis or DB, with Singleton serving as the access layer
3. Leader election: Use distributed locks (e.g., Redis SETNX) so only one instance processes
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in daily development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Item | Key Point |
|------|---------|
| Purpose | Limit to one instance and provide global access |
| Core problem | Guaranteeing consistency of shared resources |
| Pros | Centralized shared resource management, memory efficiency, lazy initialization |
| Cons | Global state, testing difficulty, increased coupling, concurrency complexity |
| Thread safety | Handled with volatile/synchronized, Holder, Enum, sync.Once, etc. |
| Java recommended | Enum Singleton (Effective Java recommended) |
| Kotlin recommended | object declaration |
| JS/TS recommended | Module scope export |
| Python recommended | Metaclass or decorator |
| Go recommended | sync.Once |
| Best alternative | DI container Singleton scope |
| Decision criterion | Use only when multiple instances would cause inconsistency |

---

## Guides to Read Next

- [Factory Method / Abstract Factory](./01-factory.md) -- Delegating and abstracting creation. Combining Singleton Registry with Factory
- [Builder Pattern](./02-builder.md) -- Constructing complex objects. Applied to building Singleton configurations
- [Prototype Pattern](./03-prototype.md) -- Creation by cloning. Contrast with Singleton
- [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) -- Single Responsibility Principle and Dependency Inversion Principle
- [Observer Pattern](../02-behavioral/00-observer.md) -- Combined with Event Bus Singleton
- [Facade Pattern](../01-structural/02-facade.md) -- Simplified interface provided by Singleton

---

## References

1. Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley. -- Original source of the Singleton pattern
2. Bloch, J. (2018). *Effective Java* (3rd ed.). Addison-Wesley. Item 3: Enforce the singleton property with a private constructor or an enum type.
3. Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly Media. Chapter 5: The Singleton Pattern.
4. Fowler, M. (2004). *Inversion of Control Containers and the Dependency Injection pattern*. martinfowler.com. https://martinfowler.com/articles/injection.html
5. Refactoring.Guru -- Singleton. https://refactoring.guru/design-patterns/singleton
6. Microsoft .NET Documentation -- Dependency injection guidelines. https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection-guidelines
