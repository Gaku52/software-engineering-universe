# Decorator Pattern

> A structural pattern for **dynamically** adding new functionality to objects. It uses composition instead of subclassing to enable flexible combinations of features.

---

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| Object-Oriented Programming | Basic | OOP Basics |
| Interfaces and Abstract Classes | Basic | Interface Design |
| Composition and Delegation | Understanding | Composition Over Inheritance |
| Open/Closed Principle (OCP) | Understanding | SOLID |
| TypeScript / Python decorator syntax | Basic | Language-specific guides |

---

## What You Will Learn

1. The **purpose** of the Decorator pattern and why composition is used instead of inheritance for feature extension
2. The mechanism and execution order of **decorator chaining (stacking)**
3. The relationship between the GoF Decorator pattern and language-built-in decorator syntax (TypeScript/Python)
4. Practical usage patterns such as HTTP clients, stream processing, and React HOCs
5. Anti-patterns such as excessive decorator stacking and dependencies on methods outside the interface

---

## Why the Decorator Pattern Is Needed (WHY)

### Problem: Class Explosion When Adding Features via Inheritance

If you represent every combination of features using inheritance, the number of classes grows exponentially.

```
[When adding features via inheritance — class explosion]

                     DataSource
                    /    |     \
            FileDS    EncryptedDS   CompressedDS
           /    \        |
    EncryptedFileDS  CompressedFileDS
          |
  CompressedEncryptedFileDS

All combinations of 3 features → 2^3 = 8 classes needed
With N features, 2^N classes are needed!

[When adding features via Decorator — linear]

  DataSource (interface)
      △
      |
  FileDataSource (concrete)
      △
      |
  DataSourceDecorator (abstract)
      △
      |─── EncryptionDecorator
      |─── CompressionDecorator
      |─── LoggingDecorator

3 features → 3+1 = 4 classes cover all combinations
With N features, only N+1 classes are needed!
```

### The Essence of Decorator: Feature Composition via Nesting

```
Client call:
  source.write("Hello")

Runtime object structure:
┌───────────────────────────┐
│    LoggingDecorator       │  ← Logging output
│  ┌───────────────────┐    │
│  │ CompressionDeco   │    │  ← Compression
│  │  ┌─────────────┐  │    │
│  │  │ EncryptDeco │  │    │  ← Encryption
│  │  │  ┌───────┐  │  │    │
│  │  │  │FileDS │  │  │    │  ← Actual processing
│  │  │  └───────┘  │  │    │
│  │  └─────────────┘  │    │
│  └───────────────────┘    │
└───────────────────────────┘

Execution order for write("Hello"):
  Logging.write()
    → Compression.write()
      → Encryption.write()
        → FileDS.write()  ← Actual file write
```

This pattern enables:
- **Open/Closed Principle (OCP)**: Add features without modifying existing code
- **Single Responsibility Principle (SRP)**: Each decorator has only one responsibility
- **Runtime flexibility**: Feature combinations and ordering can be changed at runtime
- **Testability**: Each decorator can be tested independently

---

## 1. Decorator Structure

### Class Diagram

```
+------------------+
|    Component     |
|   (interface)    |
+------------------+
| + operation()    |
+------------------+
      △        △
      |        |
+----------+  +--------------------+
| Concrete |  | BaseDecorator      |
| Component|  +--------------------+
+----------+  | - wrapped:         |
              |   Component        |
              | + operation() {    |
              |   wrapped          |
              |   .operation()    }|
              +--------------------+
                       △
               ________|________
              |                 |
       +-------------+  +-------------+
       | DecoratorA  |  | DecoratorB  |
       +-------------+  +-------------+
       | + operation |  | + operation |
       |  {          |  |  {          |
       |   // pre    |  |   // pre    |
       |   super     |  |   super     |
       |   .operation|  |   .operation|
       |   // post   |  |   // post   |
       |  }          |  |  }          |
       +-------------+  +-------------+
```

### Sequence Diagram

```
Client    DecoratorA      DecoratorB      ConcreteComponent
  |           |                |                |
  |--op()---->|                |                |
  |           |--pre-process A |                |
  |           |--op()--------->|                |
  |           |                |--pre-process B |
  |           |                |--op()--------->|
  |           |                |                |--actual processing
  |           |                |                |
  |           |                |<--result-------|
  |           |                |--post-process B|
  |           |<--result-------|                |
  |           |--post-process A|                |
  |<--result--|                |                |
```

### Building a Decorator Chain

```
// Approach 1: Nested constructors
const source = new LoggingDecorator(
  new CompressionDecorator(
    new EncryptionDecorator(
      new FileDataSource("data.txt")
    )
  )
);

// Approach 2: Combining with the Builder pattern
const source = DataSourceBuilder
  .from(new FileDataSource("data.txt"))
  .withEncryption()
  .withCompression()
  .withLogging()
  .build();

// Approach 3: Function pipeline
const source = pipe(
  new FileDataSource("data.txt"),
  withEncryption,
  withCompression,
  withLogging
);
```

---

## 2. Code Examples

### Code Example 1: Data Source Decorator (Basic Form)

```typescript
// === Component Interface ===
interface DataSource {
  read(): string;
  write(data: string): void;
}

// === ConcreteComponent ===
class FileDataSource implements DataSource {
  private content = "";

  constructor(private filename: string) {}

  read(): string {
    console.log(`  [File] Reading from ${this.filename}`);
    return this.content;
  }

  write(data: string): void {
    console.log(`  [File] Writing to ${this.filename}: "${data}"`);
    this.content = data;
  }
}

// === BaseDecorator (optional: common delegation logic) ===
abstract class DataSourceDecorator implements DataSource {
  constructor(protected wrapped: DataSource) {}

  read(): string {
    return this.wrapped.read();
  }

  write(data: string): void {
    this.wrapped.write(data);
  }
}

// === ConcreteDecorator 1: Encryption ===
class EncryptionDecorator extends DataSourceDecorator {
  read(): string {
    const data = super.read();
    const decrypted = this.decrypt(data);
    console.log(`  [Encrypt] Decrypted: "${data}" → "${decrypted}"`);
    return decrypted;
  }

  write(data: string): void {
    const encrypted = this.encrypt(data);
    console.log(`  [Encrypt] Encrypted: "${data}" → "${encrypted}"`);
    super.write(encrypted);
  }

  private encrypt(data: string): string {
    return Buffer.from(data).toString("base64");
  }

  private decrypt(data: string): string {
    return Buffer.from(data, "base64").toString("utf-8");
  }
}

// === ConcreteDecorator 2: Compression ===
class CompressionDecorator extends DataSourceDecorator {
  read(): string {
    const data = super.read();
    const decompressed = this.decompress(data);
    console.log(`  [Compress] Decompressed`);
    return decompressed;
  }

  write(data: string): void {
    const compressed = this.compress(data);
    console.log(`  [Compress] Compressed: ${data.length} → ${compressed.length} chars`);
    super.write(compressed);
  }

  private compress(data: string): string {
    return `compressed(${data})`;
  }

  private decompress(data: string): string {
    return data.replace(/^compressed\(/, "").replace(/\)$/, "");
  }
}

// === ConcreteDecorator 3: Logging ===
class LoggingDecorator extends DataSourceDecorator {
  read(): string {
    console.log("[LOG] read() called");
    const start = Date.now();
    const result = super.read();
    console.log(`[LOG] read() completed in ${Date.now() - start}ms`);
    return result;
  }

  write(data: string): void {
    console.log(`[LOG] write("${data}") called`);
    const start = Date.now();
    super.write(data);
    console.log(`[LOG] write() completed in ${Date.now() - start}ms`);
  }
}

// === Usage: Stacking decorators ===
const source: DataSource = new LoggingDecorator(
  new CompressionDecorator(
    new EncryptionDecorator(
      new FileDataSource("secret.txt")
    )
  )
);

source.write("Hello, World!");
// [LOG] write("Hello, World!") called
//   [Compress] Compressed: 13 → 29 chars
//   [Encrypt] Encrypted: "compressed(Hello, World!)" → "Y29tcHJlc3NlZ..."
//   [File] Writing to secret.txt: "Y29tcHJlc3NlZ..."
// [LOG] write() completed in 1ms

const data = source.read();
// [LOG] read() called
//   [File] Reading from secret.txt
//   [Encrypt] Decrypted: ...
//   [Compress] Decompressed
// [LOG] read() completed in 0ms
```

---

### Code Example 2: HTTP Client Decorator

```typescript
// === Component ===
interface HttpClient {
  request(url: string, options?: RequestInit): Promise<Response>;
}

class FetchClient implements HttpClient {
  async request(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, options);
  }
}

// === Decorator 1: Retry ===
class RetryDecorator implements HttpClient {
  constructor(
    private client: HttpClient,
    private maxRetries = 3,
    private baseDelay = 1000
  ) {}

  async request(url: string, options?: RequestInit): Promise<Response> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.request(url, options);
        if (response.ok || response.status < 500) return response;
        throw new Error(`Server error: ${response.status}`);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          console.log(`Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }
}

// === Decorator 2: Timeout ===
class TimeoutDecorator implements HttpClient {
  constructor(private client: HttpClient, private timeoutMs = 5000) {}

  async request(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.client.request(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

// === Decorator 3: Logging ===
class LoggingHttpDecorator implements HttpClient {
  constructor(private client: HttpClient) {}

  async request(url: string, options?: RequestInit): Promise<Response> {
    const method = options?.method ?? "GET";
    console.log(`→ ${method} ${url}`);
    const start = Date.now();

    try {
      const response = await this.client.request(url, options);
      console.log(`← ${response.status} (${Date.now() - start}ms)`);
      return response;
    } catch (error) {
      console.log(`✗ ERROR (${Date.now() - start}ms): ${error}`);
      throw error;
    }
  }
}

// === Decorator 4: Add auth header ===
class AuthDecorator implements HttpClient {
  constructor(
    private client: HttpClient,
    private getToken: () => Promise<string>
  ) {}

  async request(url: string, options?: RequestInit): Promise<Response> {
    const token = await this.getToken();
    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return this.client.request(url, { ...options, headers });
  }
}

// === Decorator 5: Circuit Breaker ===
class CircuitBreakerDecorator implements HttpClient {
  private failures = 0;
  private lastFailure = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private client: HttpClient,
    private threshold = 5,
    private resetTimeout = 30000
  ) {}

  async request(url: string, options?: RequestInit): Promise<Response> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const response = await this.client.request(url, options);
      this.onSuccess();
      return response;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "open";
      console.log("Circuit breaker OPENED");
    }
  }
}

// === Assembly ===
const httpClient: HttpClient = new LoggingHttpDecorator(
  new CircuitBreakerDecorator(
    new RetryDecorator(
      new TimeoutDecorator(
        new AuthDecorator(
          new FetchClient(),
          async () => "token-xxx"
        ),
        5000
      ),
      3
    )
  )
);

// Execution order: Logging → CircuitBreaker → Retry → Timeout → Auth → Fetch
```

---

### Code Example 3: TypeScript TC39 Decorator Syntax (Stage 3)

```typescript
// TC39 Stage 3 Decorators (TypeScript 5+)
// Different from the GoF Decorator pattern, but shares the same motivation

// === Method decorator: Logging ===
function logged(
  target: any,
  context: ClassMethodDecoratorContext
) {
  const methodName = String(context.name);
  return function (this: any, ...args: any[]) {
    console.log(`→ ${methodName}(${args.map(a => JSON.stringify(a)).join(", ")})`);
    const result = target.call(this, ...args);
    console.log(`← ${methodName} = ${JSON.stringify(result)}`);
    return result;
  };
}

// === Method decorator: Performance measurement ===
function timed(
  target: any,
  context: ClassMethodDecoratorContext
) {
  const methodName = String(context.name);
  return function (this: any, ...args: any[]) {
    const start = performance.now();
    const result = target.call(this, ...args);
    const elapsed = performance.now() - start;
    console.log(`${methodName}: ${elapsed.toFixed(2)}ms`);
    return result;
  };
}

// === Method decorator: Memoization ===
function memoize(
  target: any,
  context: ClassMethodDecoratorContext
) {
  const cache = new Map<string, any>();
  return function (this: any, ...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = target.call(this, ...args);
    cache.set(key, result);
    return result;
  };
}

// === Method decorator: Validation ===
function validate(schema: Record<string, (v: any) => boolean>) {
  return function (
    target: any,
    context: ClassMethodDecoratorContext
  ) {
    return function (this: any, ...args: any[]) {
      // Validate if first argument is an object
      const input = args[0];
      if (typeof input === "object" && input !== null) {
        for (const [key, validator] of Object.entries(schema)) {
          if (!validator(input[key])) {
            throw new Error(`Validation failed for field "${key}"`);
          }
        }
      }
      return target.call(this, ...args);
    };
  };
}

// === Usage ===
class Calculator {
  @logged
  @timed
  add(a: number, b: number): number {
    return a + b;
  }

  @memoize
  fibonacci(n: number): number {
    if (n <= 1) return n;
    return this.fibonacci(n - 1) + this.fibonacci(n - 2);
  }
}

class UserService {
  @validate({
    name: (v: any) => typeof v === "string" && v.length > 0,
    age: (v: any) => typeof v === "number" && v >= 0,
  })
  createUser(data: { name: string; age: number }): void {
    console.log(`Created user: ${data.name}`);
  }
}
```

---

### Code Example 4: Python Decorators (Function Decorators + Class Decorators)

```python
import functools
import time
import logging
from typing import Callable, TypeVar, ParamSpec

P = ParamSpec("P")
R = TypeVar("R")

# === Function decorator: Retry ===
def retry(max_retries: int = 3, delay: float = 1.0, exceptions: tuple = (Exception,)):
    """Decorator that retries up to the specified number of times"""
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        wait = delay * (2 ** attempt)
                        logging.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                            f"after {wait}s: {e}"
                        )
                        time.sleep(wait)
            raise last_exception  # type: ignore
        return wrapper
    return decorator


# === Function decorator: Execution time measurement ===
def timed(func: Callable[P, R]) -> Callable[P, R]:
    """Decorator that measures execution time"""
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        logging.info(f"{func.__name__}: {elapsed:.4f}s")
        return result
    return wrapper


# === Function decorator: Cache with TTL ===
def cache_with_ttl(ttl_seconds: float = 60.0):
    """Cache decorator with TTL"""
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        _cache: dict[str, tuple[R, float]] = {}

        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            key = str((args, tuple(sorted(kwargs.items()))))
            if key in _cache:
                value, expiry = _cache[key]
                if time.time() < expiry:
                    return value
            result = func(*args, **kwargs)
            _cache[key] = (result, time.time() + ttl_seconds)
            return result
        return wrapper
    return decorator


# === Function decorator: Input validation ===
def validate_args(**validators: Callable):
    """Argument validation decorator"""
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            import inspect
            sig = inspect.signature(func)
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()

            for param_name, validator in validators.items():
                if param_name in bound.arguments:
                    value = bound.arguments[param_name]
                    if not validator(value):
                        raise ValueError(
                            f"Validation failed for '{param_name}': {value}"
                        )
            return func(*args, **kwargs)
        return wrapper
    return decorator


# === Usage ===
@retry(max_retries=3, delay=0.5, exceptions=(ConnectionError, TimeoutError))
@timed
def fetch_data(url: str) -> dict:
    """Fetch data from an external API"""
    import urllib.request
    response = urllib.request.urlopen(url)
    return {"status": response.status}


@cache_with_ttl(ttl_seconds=300)
def get_config(key: str) -> str:
    """Retrieve a configuration value (with cache)"""
    return f"value_for_{key}"


@validate_args(
    name=lambda v: isinstance(v, str) and len(v) > 0,
    age=lambda v: isinstance(v, int) and 0 <= v <= 150,
)
def create_user(name: str, age: int) -> dict:
    return {"name": name, "age": age}


# Class decorator: Singleton
def singleton(cls):
    """Class decorator that makes a class a singleton"""
    instances: dict = {}

    @functools.wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]

    return get_instance


@singleton
class DatabaseConnection:
    def __init__(self, url: str):
        self.url = url
        print(f"Connecting to {url}")
```

---

### Code Example 5: React Higher-Order Component (HOC) as Decorator

```typescript
import React, { ComponentType, useEffect, useState } from "react";

// === HOC 1: Adding loading state ===
function withLoading<P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P & { isLoading?: boolean }> {
  return function WithLoadingComponent(props: P & { isLoading?: boolean }) {
    const { isLoading, ...rest } = props;
    if (isLoading) {
      return <div className="spinner">Loading...</div>;
    }
    return <WrappedComponent {...(rest as P)} />;
  };
}

// === HOC 2: Auth guard ===
function withAuth<P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  return function WithAuthComponent(props: P) {
    const { user, isAuthenticated } = useAuth();
    if (!isAuthenticated) {
      return <Navigate to="/login" />;
    }
    return <WrappedComponent {...props} user={user} />;
  };
}

// === HOC 3: Error boundary ===
function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  FallbackComponent: ComponentType<{ error: Error }>
): ComponentType<P> {
  return class ErrorBoundaryWrapper extends React.Component<P, { error: Error | null }> {
    state = { error: null };

    static getDerivedStateFromError(error: Error) {
      return { error };
    }

    render() {
      if (this.state.error) {
        return <FallbackComponent error={this.state.error} />;
      }
      return <WrappedComponent {...this.props} />;
    }
  };
}

// === HOC 4: Performance tracking ===
function withPerformanceTracking<P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName: string
): ComponentType<P> {
  return function WithPerformanceTracking(props: P) {
    useEffect(() => {
      const start = performance.now();
      return () => {
        const elapsed = performance.now() - start;
        console.log(`${componentName} rendered for ${elapsed.toFixed(0)}ms`);
      };
    });
    return <WrappedComponent {...props} />;
  };
}

// === Stacking ===
const UserList: React.FC<{ users: User[] }> = ({ users }) => (
  <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
);

// Stacking decorators (applied from outer to inner)
const EnhancedUserList = withErrorBoundary(
  withAuth(
    withLoading(
      withPerformanceTracking(UserList, "UserList")
    )
  ),
  ErrorFallback
);

// In modern React, Hooks are mainstream, but
// HOCs remain valid for conditional rendering and Provider wrapping
```

---

### Code Example 6: Go — Middleware Pattern (Variant of Decorator)

```go
package main

import (
    "fmt"
    "log"
    "net/http"
    "time"
)

// === Middleware type (Go idiom for Decorator) ===
type Middleware func(http.Handler) http.Handler

// === Middleware 1: Logging ===
func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        log.Printf("→ %s %s", r.Method, r.URL.Path)
        next.ServeHTTP(w, r)
        log.Printf("← %s %s (%v)", r.Method, r.URL.Path, time.Since(start))
    })
}

// === Middleware 2: Authentication ===
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if token == "" {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}

// === Middleware 3: Recovery ===
func RecoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                log.Printf("Panic recovered: %v", err)
                http.Error(w, "Internal Server Error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}

// === Middleware chain ===
func Chain(handler http.Handler, middlewares ...Middleware) http.Handler {
    // Apply in reverse order (first specified middleware is outermost)
    for i := len(middlewares) - 1; i >= 0; i-- {
        handler = middlewaresi
    }
    return handler
}

// === Usage ===
func main() {
    handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintln(w, "Hello, World!")
    })

    // Stacking decorators
    enhanced := Chain(handler,
        RecoveryMiddleware,
        LoggingMiddleware,
        AuthMiddleware,
    )

    http.Handle("/api/", enhanced)
    http.ListenAndServe(":8080", nil)
}
```

---

### Code Example 7: Java — I/O Streams (Decorator in the Standard Library)

```java
import java.io.*;

// Java's I/O streams are a classic example of the Decorator pattern

public class JavaIODecoratorExample {

    // === Read Decorator chain ===
    public static void readExample() throws IOException {
        // InputStream hierarchy:
        //   BufferedInputStream(Decorator)
        //     → DataInputStream(Decorator)
        //       → FileInputStream(ConcreteComponent)

        try (DataInputStream dis = new DataInputStream(
                new BufferedInputStream(
                    new FileInputStream("data.bin")))) {
            int value = dis.readInt();
            String text = dis.readUTF();
            System.out.println(value + " " + text);
        }
    }

    // === Write Decorator chain ===
    public static void writeExample() throws IOException {
        // OutputStream hierarchy:
        //   BufferedOutputStream(Decorator)
        //     → GZIPOutputStream(Decorator)
        //       → FileOutputStream(ConcreteComponent)

        try (var out = new BufferedOutputStream(
                new java.util.zip.GZIPOutputStream(
                    new FileOutputStream("output.gz")))) {
            out.write("Hello, compressed world!".getBytes());
        }
    }

    // === Custom Decorator ===
    static class CountingInputStream extends FilterInputStream {
        private long bytesRead = 0;

        protected CountingInputStream(InputStream in) {
            super(in);
        }

        @Override
        public int read() throws IOException {
            int b = super.read();
            if (b != -1) bytesRead++;
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            int count = super.read(b, off, len);
            if (count > 0) bytesRead += count;
            return count;
        }

        public long getBytesRead() {
            return bytesRead;
        }
    }
}
```

---

### Code Example 8: Kotlin — Extension Functions and Decorator

```kotlin
// Implementing Decorator with Kotlin's delegation pattern

interface Logger {
    fun log(level: String, message: String)
    fun close()
}

class ConsoleLogger : Logger {
    override fun log(level: String, message: String) {
        println("[$level] $message")
    }
    override fun close() {}
}

// Delegation via Kotlin's by keyword
class TimestampLogger(private val inner: Logger) : Logger by inner {
    override fun log(level: String, message: String) {
        val timestamp = java.time.LocalDateTime.now()
        inner.log(level, "[$timestamp] $message")
    }
}

class FilterLogger(
    private val inner: Logger,
    private val minLevel: String
) : Logger by inner {
    private val levels = listOf("DEBUG", "INFO", "WARN", "ERROR")

    override fun log(level: String, message: String) {
        if (levels.indexOf(level) >= levels.indexOf(minLevel)) {
            inner.log(level, message)
        }
    }
}

// Stacking
fun main() {
    val logger: Logger = FilterLogger(
        TimestampLogger(ConsoleLogger()),
        "INFO"
    )

    logger.log("DEBUG", "This will be filtered")  // No output
    logger.log("INFO", "Application started")      // Output
    logger.log("ERROR", "Something went wrong")    // Output
}
```

---

### Code Example 9: Lightweight Decorator via Function Composition

```typescript
// Achieving decorators via function composition without classes

type AsyncFn<T> = (...args: any[]) => Promise<T>;

// === Decorator Factory functions ===
function withRetry<T>(fn: AsyncFn<T>, maxRetries = 3): AsyncFn<T> {
  return async (...args) => {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn(...args);
      } catch (e) {
        if (i === maxRetries) throw e;
        await new Promise(r => setTimeout(r, 1000 * 2 ** i));
      }
    }
    throw new Error("Unreachable");
  };
}

function withTimeout<T>(fn: AsyncFn<T>, ms: number): AsyncFn<T> {
  return (...args) =>
    Promise.race([
      fn(...args),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), ms)
      ),
    ]);
}

function withLogging<T>(fn: AsyncFn<T>, name: string): AsyncFn<T> {
  return async (...args) => {
    console.log(`→ ${name}(${args.join(", ")})`);
    try {
      const result = await fn(...args);
      console.log(`← ${name}: success`);
      return result;
    } catch (e) {
      console.log(`✗ ${name}: ${e}`);
      throw e;
    }
  };
}

// === pipe utility ===
function pipe<T>(
  fn: AsyncFn<T>,
  ...decorators: Array<(fn: AsyncFn<T>) => AsyncFn<T>>
): AsyncFn<T> {
  return decorators.reduce((acc, decorator) => decorator(acc), fn);
}

// === Usage ===
async function fetchUser(id: string): Promise<{ name: string }> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// Stacking decorators via function composition
const enhancedFetchUser = pipe(
  fetchUser,
  fn => withTimeout(fn, 5000),
  fn => withRetry(fn, 3),
  fn => withLogging(fn, "fetchUser"),
);

const user = await enhancedFetchUser("123");
```

---

### Code Example 10: Node.js Stream Transform (Practical Decorator)

```typescript
import { Transform, TransformCallback, Readable, pipeline } from "stream";
import { promisify } from "util";

const pipelineAsync = promisify(pipeline);

// === Transform 1: JSON parsing ===
class JsonParseTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    try {
      const parsed = JSON.parse(chunk.toString());
      this.push(parsed);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}

// === Transform 2: Filtering ===
class FilterTransform extends Transform {
  constructor(private predicate: (item: any) => boolean) {
    super({ objectMode: true });
  }

  _transform(chunk: any, _encoding: string, callback: TransformCallback): void {
    if (this.predicate(chunk)) {
      this.push(chunk);
    }
    callback();
  }
}

// === Transform 3: Mapping ===
class MapTransform extends Transform {
  constructor(private mapper: (item: any) => any) {
    super({ objectMode: true });
  }

  _transform(chunk: any, _encoding: string, callback: TransformCallback): void {
    try {
      this.push(this.mapper(chunk));
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}

// === Transform 4: Batch aggregation ===
class BatchTransform extends Transform {
  private buffer: any[] = [];

  constructor(private batchSize: number) {
    super({ objectMode: true });
  }

  _transform(chunk: any, _encoding: string, callback: TransformCallback): void {
    this.buffer.push(chunk);
    if (this.buffer.length >= this.batchSize) {
      this.push([...this.buffer]);
      this.buffer = [];
    }
    callback();
  }

  _flush(callback: TransformCallback): void {
    if (this.buffer.length > 0) {
      this.push([...this.buffer]);
    }
    callback();
  }
}

// === Chaining decorators with a pipeline ===
async function processLogs(): Promise<void> {
  await pipelineAsync(
    Readable.from(logLines),           // Source
    new JsonParseTransform(),           // JSON parsing (Decorator 1)
    new FilterTransform(                // Filtering (Decorator 2)
      log => log.level === "error"
    ),
    new MapTransform(                   // Transformation (Decorator 3)
      log => ({ message: log.message, timestamp: log.ts })
    ),
    new BatchTransform(100),            // Batching (Decorator 4)
    createWriteStream("errors.jsonl")   // Output destination
  );
}
```

---

## 3. Comparison Tables

### Comparison Table 1: Decorator vs Inheritance

| Aspect | Decorator (Composition) | Inheritance |
|------|:---:|:---:|
| When features are added | **Runtime (dynamic)** | Compile time (static) |
| Combinations | **Freely stackable** | Class explosion |
| Modifying existing code | **Not required** | Subclass must be added |
| OCP compliance | **Yes** | Partial |
| SRP compliance | **Yes** (1 decorator = 1 responsibility) | Easily violated |
| Debugging | Stack traces are deep | **Intuitive** |
| Performance | Indirect call overhead | **Direct calls** |
| Type safety | **Guaranteed by interface** | Guaranteed by inheritance hierarchy |

### Comparison Table 2: GoF Decorator vs Language Decorator Syntax

| Aspect | GoF Decorator Pattern | TypeScript/Python Decorators |
|------|:---:|:---:|
| **Target** | Objects (instances) | Classes/methods/properties |
| **When applied** | **Runtime** (dynamic) | **Definition time** (static) |
| **Interface preservation** | **Explicitly guaranteed** | Implicit |
| **Stacking** | Nested constructors | `@` syntax stacking |
| **Primary use** | Feature wrapping | Metaprogramming, AOP |
| **State management** | Decorator can hold fields | Held via closure |
| **Testing** | Each testable individually | Testable per function |

### Comparison Table 3: Decorator vs Proxy vs Adapter

| Aspect | Decorator | Proxy | Adapter |
|------|:---:|:---:|:---:|
| **Purpose** | Feature **addition** | Access **control** | Interface **conversion** |
| **Interface** | **Same** | **Same** | **Converted** |
| **Stacking** | **Possible** | Usually 1 layer | Usually 1 layer |
| **RealSubject management** | Received from outside | **Managed internally** | Received from outside |
| **OCP** | **Compliant** | Compliant | Compliant |

---

## 4. Anti-Patterns

### Anti-Pattern 1: Excessive Decorator Stacking

```typescript
// NG: 5+ layers of decorators → hard to debug
const client = new MetricsDecorator(
  new CircuitBreakerDecorator(
    new RetryDecorator(
      new TimeoutDecorator(
        new LoggingDecorator(
          new AuthDecorator(
            new CacheDecorator(
              new FetchClient()
            )
          )
        )
      )
    )
  )
);
// 7 layers of nesting → very deep stack traces
```

```typescript
// OK: Declare configuration using middleware pattern or pipeline
const client = createHttpClient({
  middlewares: [
    metrics(),
    circuitBreaker({ threshold: 5 }),
    retry({ maxRetries: 3 }),
    timeout({ ms: 5000 }),
    logging(),
    auth({ tokenProvider }),
    cache({ ttl: 60000 }),
  ],
});
```

---

### Anti-Pattern 2: Decorator Depending on Methods Outside the Interface

```typescript
// NG: Accessing getFilename() by casting to a type not in the Component interface
class BadCachingDecorator implements DataSource {
  constructor(private wrapped: DataSource) {}

  read(): string {
    // Depends on concrete class → loses the benefits of the Decorator pattern
    const name = (this.wrapped as FileDataSource).getFilename();
    const cached = this.cache.get(name);
    if (cached) return cached;
    return this.wrapped.read();
  }

  write(data: string): void {
    this.wrapped.write(data);
  }
}
```

```typescript
// OK: Depend only on the Component interface
class GoodCachingDecorator implements DataSource {
  private cachedData: string | null = null;

  constructor(private wrapped: DataSource) {}

  read(): string {
    if (this.cachedData !== null) return this.cachedData;
    this.cachedData = this.wrapped.read();
    return this.cachedData;
  }

  write(data: string): void {
    this.cachedData = null; // Invalidate cache
    this.wrapped.write(data);
  }
}
```

---

### Anti-Pattern 3: Implicit Order Dependencies Between Decorators

```typescript
// NG: Wrong decorator order causes breakage
// Compressing after encryption yields poor compression efficiency

// Bad order (encrypt → compress: poor compression)
const bad = new CompressionDecorator(
  new EncryptionDecorator(new FileDataSource("data.txt"))
);

// Good order (compress → encrypt: better compression)
const good = new EncryptionDecorator(
  new CompressionDecorator(new FileDataSource("data.txt"))
);
```

```typescript
// OK: Control order with the Builder pattern and document it
class DataSourceBuilder {
  private decorators: Array<(ds: DataSource) => DataSource> = [];

  constructor(private base: DataSource) {}

  // Builder guarantees the order: compress → encrypt
  withCompressionAndEncryption(): this {
    this.decorators.push(ds => new CompressionDecorator(ds));
    this.decorators.push(ds => new EncryptionDecorator(ds));
    return this;
  }

  withLogging(): this {
    this.decorators.push(ds => new LoggingDecorator(ds));
    return this;
  }

  build(): DataSource {
    return this.decorators.reduce(
      (ds, decorator) => decorator(ds),
      this.base
    );
  }
}
```

---

## 5. Edge Cases and Caveats

### Edge Case 1: Exception Handling Inside a Decorator

```typescript
// Swallowing exceptions in a decorator makes debugging very difficult
class SafeDecorator implements DataSource {
  constructor(private wrapped: DataSource) {}

  read(): string {
    try {
      return this.wrapped.read();
    } catch (error) {
      // NG: Swallow the exception and return an empty string
      // return "";

      // OK: Log the error and re-throw
      console.error("Read failed:", error);
      throw error;
    }
  }

  write(data: string): void {
    this.wrapped.write(data);
  }
}
```

### Edge Case 2: Decorator Equality and Identity

```typescript
const base = new FileDataSource("data.txt");
const decorated = new LoggingDecorator(base);

// The decorator is a separate instance from the original object
console.log(decorated === base);           // false
console.log(decorated instanceof FileDataSource); // false

// Be careful when using as keys in Set or Map
const set = new Set<DataSource>();
set.add(base);
set.add(decorated);
console.log(set.size); // 2 (points to same base but different objects)
```

### Edge Case 3: Ordering Guarantees in Async Decorators

```typescript
// Be careful about the order of pre/post processing in async decorators
class AsyncLoggingDecorator implements AsyncDataSource {
  constructor(private wrapped: AsyncDataSource) {}

  async read(): Promise<string> {
    console.log("Before read");
    const result = await this.wrapped.read();
    console.log("After read"); // After await, so post-processing is guaranteed
    return result;
  }
}
```

---

## 6. Trade-off Analysis

```
[When to use] ✅
┌─────────────────────────────────────────────────┐
│ 1. Need free combinations of features            │
│    e.g., stream processing, HTTP middleware      │
│                                                  │
│ 2. Want to add features without changing         │
│    existing code                                 │
│    e.g., extending third-party libraries         │
│                                                  │
│ 3. Separation of cross-cutting concerns          │
│    e.g., logging, caching, auth, retry           │
│                                                  │
│ 4. Want to toggle features ON/OFF at runtime     │
│    e.g., feature flags, config-based switching   │
└─────────────────────────────────────────────────┘

[When not to use] ❌
┌─────────────────────────────────────────────────┐
│ 1. Feature combinations are fixed                │
│    → Inheritance or direct method addition       │
│      is simpler                                  │
│                                                  │
│ 2. Decorator order is critical and error-prone   │
│    → Need a mechanism to enforce order           │
│      (e.g., Builder)                             │
│                                                  │
│ 3. Performance is the top priority               │
│    → Indirect call overhead is a concern         │
│                                                  │
│ 4. Not all team members understand the pattern   │
│    → Readability may decrease                    │
└─────────────────────────────────────────────────┘
```

---

## 7. Exercises

### Exercise 1 (Basic): Text Transformation Decorator

Implement three decorators for the `TextProcessor` interface.

**Requirements**:
- `TextProcessor`: `process(text: string): string`
- `UpperCaseDecorator`: Convert all characters to uppercase
- `TrimDecorator`: Remove leading and trailing whitespace
- `CensorDecorator`: Replace specified words with `***`

```typescript
// Test
const processor: TextProcessor = new CensorDecorator(
  new TrimDecorator(
    new UpperCaseDecorator(
      new PlainTextProcessor()
    )
  ),
  ["bad", "ugly"]
);

console.log(processor.process("  Hello bad World  "));
// "HELLO *** WORLD"
```

**Expected output**: `HELLO *** WORLD`

<details>
<summary>Sample Solution</summary>

```typescript
interface TextProcessor {
  process(text: string): string;
}

class PlainTextProcessor implements TextProcessor {
  process(text: string): string { return text; }
}

class UpperCaseDecorator implements TextProcessor {
  constructor(private wrapped: TextProcessor) {}
  process(text: string): string {
    return this.wrapped.process(text).toUpperCase();
  }
}

class TrimDecorator implements TextProcessor {
  constructor(private wrapped: TextProcessor) {}
  process(text: string): string {
    return this.wrapped.process(text).trim();
  }
}

class CensorDecorator implements TextProcessor {
  constructor(private wrapped: TextProcessor, private words: string[]) {}
  process(text: string): string {
    let result = this.wrapped.process(text);
    for (const word of this.words) {
      result = result.replace(new RegExp(word, "gi"), "***");
    }
    return result;
  }
}

const processor: TextProcessor = new CensorDecorator(
  new TrimDecorator(
    new UpperCaseDecorator(new PlainTextProcessor())
  ),
  ["BAD", "UGLY"]
);
console.log(processor.process("  Hello bad World  ")); // "HELLO *** WORLD"
```
</details>

---

### Exercise 2 (Applied): HTTP Client Decorator Chain

Build a robust HTTP client by combining the following decorators.

**Requirements**:
- `HttpClient` interface: `get(url): Promise<Response>`
- `RetryDecorator`: Retry with exponential backoff
- `CacheDecorator`: Cache with TTL
- `LoggingDecorator`: Request/response logging
- Stack them in the appropriate order

<details>
<summary>Sample Solution</summary>

```typescript
interface HttpClient {
  get(url: string): Promise<{ status: number; body: string }>;
}

class SimpleClient implements HttpClient {
  async get(url: string) {
    return { status: 200, body: `Response from ${url}` };
  }
}

class RetryDecorator implements HttpClient {
  constructor(private client: HttpClient, private maxRetries = 3) {}
  async get(url: string) {
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        return await this.client.get(url);
      } catch (e) {
        if (i === this.maxRetries) throw e;
        await new Promise(r => setTimeout(r, 1000 * 2 ** i));
      }
    }
    throw new Error("Unreachable");
  }
}

class CacheDecorator implements HttpClient {
  private cache = new Map<string, { data: any; expiry: number }>();
  constructor(private client: HttpClient, private ttl = 60000) {}
  async get(url: string) {
    const cached = this.cache.get(url);
    if (cached && cached.expiry > Date.now()) return cached.data;
    const result = await this.client.get(url);
    this.cache.set(url, { data: result, expiry: Date.now() + this.ttl });
    return result;
  }
}

class LoggingDecorator implements HttpClient {
  constructor(private client: HttpClient) {}
  async get(url: string) {
    console.log(`GET ${url}`);
    const start = Date.now();
    const result = await this.client.get(url);
    console.log(`${result.status} (${Date.now() - start}ms)`);
    return result;
  }
}

// Logging → Cache → Retry → SimpleClient
const client = new LoggingDecorator(
  new CacheDecorator(
    new RetryDecorator(new SimpleClient(), 3),
    60000
  )
);
```
</details>

---

### Exercise 3 (Advanced): Type-Safe Decorator Builder

Implement a Builder that can construct a stack of decorators in a type-safe manner.

**Requirements**:
- `DecoratorBuilder<T>` class
- `wrap(decorator)` method to add a decorator
- `build()` returns the final decorated object
- TypeScript type inference correctly infers the return type of `build()`

<details>
<summary>Sample Solution</summary>

```typescript
class DecoratorBuilder<T> {
  private decorators: Array<(target: T) => T> = [];

  constructor(private base: T) {}

  static from<T>(base: T): DecoratorBuilder<T> {
    return new DecoratorBuilder(base);
  }

  wrap(decorator: (target: T) => T): this {
    this.decorators.push(decorator);
    return this;
  }

  build(): T {
    return this.decorators.reduce(
      (target, decorator) => decorator(target),
      this.base
    );
  }
}

// Usage
const source = DecoratorBuilder.from<DataSource>(new FileDataSource("data.txt"))
  .wrap(ds => new EncryptionDecorator(ds))
  .wrap(ds => new CompressionDecorator(ds))
  .wrap(ds => new LoggingDecorator(ds))
  .build();
```
</details>

---

## 8. FAQ

### Q1: What is the difference between Decorator and Proxy?

The structure is the same (delegation to a wrapped object), but **the intent differs**:
- **Decorator**: **Adds** functionality (logging, compression, encryption)
- **Proxy**: **Controls** access (lazy initialization, permission checks, caching)

In practice, the distinction can become blurry. Caching can be interpreted as either "adding functionality" or "controlling access."

### Q2: Is TypeScript's decorator syntax the same as the GoF Decorator pattern?

Strictly speaking, they are different. The GoF Decorator is an object-level composition pattern applied dynamically at runtime. TypeScript/Python decorator syntax is metaprogramming applied to class/method definitions statically at definition time. However, they share the common motivation of "extending existing behavior non-invasively."

### Q3: Now that React Hooks exist, are HOCs (Decorators) obsolete?

Hooks have replaced HOCs in many use cases, but HOCs remain effective in the following:
- **Conditional rendering**: Auth guards (redirect if unauthenticated)
- **Provider wrapping**: Providing contexts such as themes, internationalization
- **Error boundaries**: Requires class component lifecycle methods
- **Cross-cutting concerns**: Bulk application to multiple components

### Q4: How should I decide the stacking order of decorators?

General principles:
1. **Outermost**: Cross-cutting concerns (logging, metrics)
2. **Middle**: Resilience (retry, circuit breaker, timeout)
3. **Inner**: Business-related processing (authentication, validation)
4. **Innermost**: ConcreteComponent

### Q5: What is the relationship between the Decorator pattern and the middleware pattern?

The middleware pattern is a declarative variant of the Decorator pattern. Many web frameworks such as Express.js, Koa, and Go's net/http adopt the middleware pattern. The essence is the same, but middleware allows array-based configuration and makes dynamic addition and removal easier.

### Q6: Why are Java's I/O streams considered a classic example of the Decorator pattern?

Java's `java.io` package is the most well-known implementation of the GoF Decorator pattern:
- `InputStream`/`OutputStream` = Component
- `FileInputStream`/`FileOutputStream` = ConcreteComponent
- `FilterInputStream`/`FilterOutputStream` = BaseDecorator
- `BufferedInputStream`, `DataInputStream`, `GZIPInputStream` = ConcreteDecorator

It embodies both the benefit of freely combining features and the trade-off of deep nesting characteristic of the Decorator pattern.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world development?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Key Point |
|------|---------|
| **Purpose** | Add features dynamically (alternative to inheritance) |
| **Approach** | Wrapping via composition (has-a), maintaining the same interface |
| **Benefits** | Flexible combinations, OCP/SRP compliance, dynamic runtime configuration |
| **Drawbacks** | Difficult debugging with many layers, potential order dependencies |
| **GoF vs Language** | GoF = object level, TS/Python = method/class level |
| **Implementation variants** | Classes, function composition, HOC, middleware, Stream Transform |
| **Cautions** | Avoid excessive stacking, no out-of-interface dependencies, document ordering |

---

## Further Reading

- [Proxy Pattern](./03-proxy.md) — Access control (same structure as Decorator but different purpose)
- [Adapter Pattern](./00-adapter.md) — Interface conversion
- [Strategy Pattern](../02-behavioral/01-strategy.md) — Algorithm swapping
- [Composite Pattern](./04-composite.md) — Tree structures
- Composition Over Inheritance — Prefer composition over inheritance
- Chain of Responsibility — Processing chains

---

## References

1. Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
2. Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly Media. — Chapter 3: Decorator Pattern
3. TC39 Decorators Proposal. https://github.com/tc39/proposal-decorators
4. Python Documentation — Decorators. https://docs.python.org/3/glossary.html#term-decorator
5. Refactoring.Guru — Decorator. https://refactoring.guru/design-patterns/decorator
6. Martin, R. C. (2003). *Agile Software Development*. Prentice Hall. — OCP (Open-Closed Principle)
