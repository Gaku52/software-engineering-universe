# Builder Pattern

> A creational pattern that **incrementally** separates the construction process of complex objects, enabling the same construction procedure to create different representations.

---

## What You Will Learn in This Chapter

1. The essential purpose of the Builder pattern and the design intent (WHY) behind "incremental construction"
2. The Fluent API, Step Builder, and Director variations and when to use each
3. A fundamental solution to the Telescoping Constructor problem and safe construction of immutable objects
4. Implementation patterns and best practices in each language (TypeScript / Python / Java / Go / Kotlin)
5. Decision criteria and trade-offs for avoiding over-application of the Builder pattern

---

## Prerequisites

It is recommended that you have prior knowledge of the following topics before working through this guide.

| Topic | Required Level | Reference |
|---------|-----------|-----------|
| Object-oriented basics (classes, interfaces, method chaining) | Required | OOP Basics |
| Factory pattern | Recommended | [Factory](./01-factory.md) |
| Concept of Immutability | Recommended | [Immutability](../../../clean-code-principles/docs/03-practices-advanced/00-immutability.md) |
| TypeScript type system (generics, conditional types) | Nice to have | TypeScript Documentation |
| Function design (parameter design) | Nice to have | [Function Design](../../../clean-code-principles/docs/01-practices/01-functions.md) |

---

## 1. The Essence of the Builder Pattern -- Why Incremental Construction Is Necessary

### 1.1 The Problem It Solves: Telescoping Constructor

As the number of attributes on an object grows in software development, a "**Telescoping Constructor**" problem arises, where the constructor ends up with an enormous number of parameters.

```typescript
// Problem: when arguments grow, it's impossible to tell what each one is
//                  name    email      age  role   notify  theme   lang  tz
new User("Taro", "t@x.com", 30, "admin", true, "dark", "ja", "Asia/Tokyo");
//                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                  From the 6th argument onward, a reader cannot tell what they represent

// A further problem: when there are optional arguments
new User("Taro", "t@x.com", 30, undefined, true, undefined, "ja");
//                                ^^^^^^^^         ^^^^^^^^
//                                it is unclear what was omitted
```

**WHY -- Why is this a serious problem?**

```
1. Destruction of readability
   new User("Taro", "t@x.com", 30, "admin", true, "dark")
   → Is the 3rd argument age? An ID? A score? You must look up the class definition every time you read the code.

2. Argument order mistakes (silent bugs)
   new Config(8080, 3000)  ← which comes first, port or timeout?
   → Since both are the same type (number), the compiler cannot catch this.

3. Lack of expressiveness for optional arguments
   new User("Taro", "t@x.com", undefined, undefined, true, undefined, "ja")
   → A chain of undefined values is hard to read and a breeding ground for bugs.

4. Difficulty maintaining invariants
   When a constructor has many arguments, validation logic becomes complex.
```

### 1.2 The Solution with Builder

```typescript
// With a Builder, the code is self-documenting
const user = User.builder()
  .setName("Taro")
  .setEmail("t@x.com")
  .setAge(30)
  .setRole("admin")
  .enableNotifications(true)
  .setTheme("dark")
  .setLanguage("ja")
  .setTimezone("Asia/Tokyo")
  .build();

// Benefits:
// 1. The meaning of each value is clear (self-documenting)
// 2. No dependency on argument order
// 3. Optional values simply omitted, with defaults applied
// 4. Validation can be centralized in build()
```

### 1.3 Definition of the Builder Pattern

The GoF definition:

> **Separate the construction of a complex object from its representation, allowing the same construction process to create different representations.**

This definition carries two intentions:

1. **Separation of construction and representation**: Separate the assembly procedure (HOW) from the final form (WHAT)
2. **Different results from the same process**: Use the same steps to produce different outputs such as HTML, Markdown, or PDF

---

## 2. Structure of the Builder

### 2.1 UML Class Diagram

```
+------------+       +-----------------+
|  Director  |------>|  Builder        |
+------------+       |  (interface)    |
| + construct|       +-----------------+
+------------+       | + setPartA()    |
                     | + setPartB()    |
                     | + setPartC()    |
                     | + build(): Product
                     +-----------------+
                             ^
                      +------+------+
                      |             |
              +-----------+  +-----------+
              |ConcreteB1 |  |ConcreteB2 |
              +-----------+  +-----------+
              | - product |  | - product |
              | + build() |  | + build() |
              +-----------+  +-----------+
                    |              |
                    v              v
              +-----------+  +-----------+
              | ProductA  |  | ProductB  |
              +-----------+  +-----------+
```

### 2.2 Sequence Diagram

```
Client         Director         Builder          Product
  |               |                |                |
  | construct()   |                |                |
  |-------------->|                |                |
  |               | setPartA()    |                |
  |               |--------------->|                |
  |               | setPartB()    |                |
  |               |--------------->|                |
  |               | setPartC()    |                |
  |               |--------------->|                |
  |               |                |                |
  |               | build()       |                |
  |               |--------------->| new Product() |
  |               |                |--------------->|
  |               |                |                |
  |               |<-- product ---|                |
  |<-- product ---|                |                |
```

### 2.3 Internal Operation of the Fluent Builder

```
The core of the Fluent Builder:
Each setter returns `this`, enabling method chaining.

HttpRequest.builder("POST", "/api")  ← creates a Builder
  .setHeader("Content-Type", "json") ← returns this → allows the next method call
  .setBody('{"name": "Taro"}')       ← returns this → allows the next method call
  .setTimeout(5000)                  ← returns this → allows the next method call
  .build()                           ← creates and returns the Product

Internal state changes:
┌────────────────────────────────────┐
│ Builder internals                   │
│                                    │
│ Step 1: method = "POST"            │
│         url = "/api"               │
│         headers = {}               │
│         body = undefined           │
│         timeout = 30000 (default)  │
│                                    │
│ Step 2: headers = {"Content-Type": "json"} │
│                                    │
│ Step 3: body = '{"name": "Taro"}' │
│                                    │
│ Step 4: timeout = 5000             │
│                                    │
│ Step 5 (build): → new HttpRequest  │
│   Copy all fields to Product       │
│   Run validation                   │
│   Product is immutable (readonly)  │
└────────────────────────────────────┘
```

---

## 3. Code Examples

### Code Example 1: Fluent Builder (TypeScript)

The most common Builder implementation, overwhelmingly used in real-world practice.

```typescript
class HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeout: number;
  readonly retries: number;

  private constructor(builder: HttpRequestBuilder) {
    this.method  = builder.method;
    this.url     = builder.url;
    this.headers = Object.freeze({ ...builder.headers });
    this.body    = builder.body;
    this.timeout = builder.timeout;
    this.retries = builder.retries;
  }

  static builder(method: string, url: string): HttpRequestBuilder {
    return new HttpRequestBuilder(method, url);
  }

  toString(): string {
    return `${this.method} ${this.url} (timeout=${this.timeout}ms, retries=${this.retries})`;
  }
}

class HttpRequestBuilder {
  method: string;
  url: string;
  headers: Record<string, string> = {};
  body?: string;
  timeout: number = 30_000;
  retries: number = 3;

  constructor(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;  // Returning this enables method chaining
  }

  setBody(body: string): this {
    this.body = body;
    return this;
  }

  setTimeout(ms: number): this {
    if (ms <= 0) throw new Error("Timeout must be positive");
    this.timeout = ms;
    return this;
  }

  setRetries(count: number): this {
    if (count < 0) throw new Error("Retries must be non-negative");
    this.retries = count;
    return this;
  }

  build(): HttpRequest {
    // Validation
    if (!this.method) throw new Error("Method is required");
    if (!this.url) throw new Error("URL is required");

    return new (HttpRequest as any)(this);
  }
}

// Usage
const req = HttpRequest.builder("POST", "/api/users")
  .setHeader("Content-Type", "application/json")
  .setHeader("Authorization", "Bearer token123")
  .setBody(JSON.stringify({ name: "Taro", age: 30 }))
  .setTimeout(5000)
  .setRetries(2)
  .build();

console.log(req.toString());
// POST /api/users (timeout=5000ms, retries=2)
console.log(req.headers);
// { "Content-Type": "application/json", "Authorization": "Bearer token123" }
```

### Code Example 2: Director Pattern

The Director encapsulates the construction procedure and makes it reusable.

```typescript
interface QueryBuilder {
  select(columns: string): this;
  from(table: string): this;
  where(condition: string): this;
  orderBy(column: string, direction: "ASC" | "DESC"): this;
  limit(count: number): this;
  offset(count: number): this;
  build(): string;
}

class SQLQueryBuilder implements QueryBuilder {
  private parts = {
    select: "",
    from: "",
    where: [] as string[],
    orderBy: "",
    limit: 0,
    offset: 0,
  };

  select(columns: string): this {
    this.parts.select = columns;
    return this;
  }
  from(table: string): this {
    this.parts.from = table;
    return this;
  }
  where(condition: string): this {
    this.parts.where.push(condition);
    return this;
  }
  orderBy(column: string, direction: "ASC" | "DESC"): this {
    this.parts.orderBy = `${column} ${direction}`;
    return this;
  }
  limit(count: number): this {
    this.parts.limit = count;
    return this;
  }
  offset(count: number): this {
    this.parts.offset = count;
    return this;
  }

  build(): string {
    let sql = `SELECT ${this.parts.select} FROM ${this.parts.from}`;
    if (this.parts.where.length > 0) {
      sql += ` WHERE ${this.parts.where.join(" AND ")}`;
    }
    if (this.parts.orderBy) sql += ` ORDER BY ${this.parts.orderBy}`;
    if (this.parts.limit) sql += ` LIMIT ${this.parts.limit}`;
    if (this.parts.offset) sql += ` OFFSET ${this.parts.offset}`;
    return sql;
  }
}

// Director: encapsulates construction procedures for reuse
class QueryDirector {
  buildPaginatedQuery(builder: QueryBuilder, table: string, page: number, size: number): string {
    return builder
      .select("*")
      .from(table)
      .where("active = true")
      .orderBy("created_at", "DESC")
      .limit(size)
      .offset((page - 1) * size)
      .build();
  }

  buildCountQuery(builder: QueryBuilder, table: string): string {
    return builder
      .select("COUNT(*) as total")
      .from(table)
      .where("active = true")
      .build();
  }

  buildSearchQuery(builder: QueryBuilder, table: string, keyword: string): string {
    return builder
      .select("id, name, description")
      .from(table)
      .where(`name LIKE '%${keyword}%'`)
      .where("active = true")
      .orderBy("name", "ASC")
      .limit(50)
      .build();
  }
}

// Usage
const director = new QueryDirector();

const listQuery = director.buildPaginatedQuery(new SQLQueryBuilder(), "users", 2, 20);
console.log(listQuery);
// SELECT * FROM users WHERE active = true ORDER BY created_at DESC LIMIT 20 OFFSET 20

const countQuery = director.buildCountQuery(new SQLQueryBuilder(), "users");
console.log(countQuery);
// SELECT COUNT(*) as total FROM users WHERE active = true
```

### Code Example 3: Building Immutable Objects

```typescript
interface UserConfig {
  readonly name: string;
  readonly email: string;
  readonly role: "admin" | "editor" | "viewer";
  readonly notifications: boolean;
  readonly language: string;
  readonly theme: "light" | "dark" | "system";
}

class UserConfigBuilder {
  private config: Partial<UserConfig> = {};

  setName(name: string): this {
    if (name.trim().length === 0) throw new Error("Name cannot be empty");
    this.config.name = name.trim();
    return this;
  }

  setEmail(email: string): this {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid email: ${email}`);
    }
    this.config.email = email.toLowerCase();
    return this;
  }

  setRole(role: "admin" | "editor" | "viewer"): this {
    this.config.role = role;
    return this;
  }

  enableNotifications(flag: boolean): this {
    this.config.notifications = flag;
    return this;
  }

  setLanguage(lang: string): this {
    this.config.language = lang;
    return this;
  }

  setTheme(theme: "light" | "dark" | "system"): this {
    this.config.theme = theme;
    return this;
  }

  build(): UserConfig {
    // Validate required fields
    if (!this.config.name) throw new Error("name is required");
    if (!this.config.email) throw new Error("email is required");

    // Apply defaults + guarantee immutability with Object.freeze
    return Object.freeze({
      name: this.config.name,
      email: this.config.email,
      role: this.config.role ?? "viewer",
      notifications: this.config.notifications ?? true,
      language: this.config.language ?? "en",
      theme: this.config.theme ?? "system",
    });
  }
}

// Usage
const config = new UserConfigBuilder()
  .setName("Taro")
  .setEmail("taro@example.com")
  .setRole("admin")
  .setTheme("dark")
  .build();

console.log(config);
// { name: "Taro", email: "taro@example.com", role: "admin",
//   notifications: true, language: "en", theme: "dark" }

// config.name = "Jiro"; // Error: Cannot assign to read only property
```

### Code Example 4: Step Builder (Type-safe guarantee of required fields)

An advanced pattern that enforces the setting order of required fields at compile time.

```typescript
// Step 1: name is required
interface NeedsName {
  setName(name: string): NeedsEmail;
}
// Step 2: email is required
interface NeedsEmail {
  setEmail(email: string): OptionalFields;
}
// Step 3: optional fields + build
interface OptionalFields {
  setAge(age: number): OptionalFields;
  setRole(role: string): OptionalFields;
  setLanguage(lang: string): OptionalFields;
  build(): Person;
}

interface Person {
  name: string;
  email: string;
  age?: number;
  role?: string;
  language?: string;
}

class PersonBuilder implements NeedsName, NeedsEmail, OptionalFields {
  private name!: string;
  private email!: string;
  private age?: number;
  private role?: string;
  private language?: string;

  static create(): NeedsName {
    return new PersonBuilder();
  }

  setName(name: string): NeedsEmail {
    this.name = name;
    return this;
  }

  setEmail(email: string): OptionalFields {
    this.email = email;
    return this;
  }

  setAge(age: number): OptionalFields {
    this.age = age;
    return this;
  }

  setRole(role: string): OptionalFields {
    this.role = role;
    return this;
  }

  setLanguage(lang: string): OptionalFields {
    this.language = lang;
    return this;
  }

  build(): Person {
    return {
      name: this.name,
      email: this.email,
      age: this.age,
      role: this.role,
      language: this.language,
    };
  }
}

// The order is enforced at compile time
const person = PersonBuilder.create()
  .setName("Taro")           // Returns NeedsEmail → only setEmail can be called next
  .setEmail("t@example.com") // Returns OptionalFields → optional fields and build become callable
  .setAge(30)
  .setRole("engineer")
  .build();

// Examples of compile errors:
// PersonBuilder.create().setAge(30)           // Error: setAge does not exist on NeedsName
// PersonBuilder.create().setName("A").build() // Error: build does not exist on NeedsEmail
```

**WHY -- When Step Builder is needed:**

```
The problem with a regular Fluent Builder:
  new UserBuilder()
    .setAge(30)          // forgot to set name
    .setRole("admin")    // forgot to set email
    .build()             // runtime error (caught by validation inside build)

With a Step Builder:
  PersonBuilder.create()
    .setAge(30)          // Compile error! setAge does not exist on NeedsName
    → The problem is caught before execution.
```

### Code Example 5: Python -- Builder with dataclass

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass(frozen=True)
class Pizza:
    """Immutable Pizza object"""
    size: str
    crust: str
    cheese: bool
    pepperoni: bool
    mushrooms: bool
    extra_toppings: tuple[str, ...]  # tuple guarantees immutability

    def description(self) -> str:
        toppings = []
        if self.cheese: toppings.append("Cheese")
        if self.pepperoni: toppings.append("Pepperoni")
        if self.mushrooms: toppings.append("Mushrooms")
        toppings.extend(self.extra_toppings)
        return f"{self.size} {self.crust} Pizza: {', '.join(toppings)}"

class PizzaBuilder:
    """Incremental construction of a Pizza"""
    def __init__(self, size: str):
        self._size = size
        self._crust = "Regular"
        self._cheese = False
        self._pepperoni = False
        self._mushrooms = False
        self._extra: list[str] = []

    def crust(self, crust: str) -> "PizzaBuilder":
        self._crust = crust
        return self

    def add_cheese(self) -> "PizzaBuilder":
        self._cheese = True
        return self

    def add_pepperoni(self) -> "PizzaBuilder":
        self._pepperoni = True
        return self

    def add_mushrooms(self) -> "PizzaBuilder":
        self._mushrooms = True
        return self

    def add_topping(self, topping: str) -> "PizzaBuilder":
        self._extra.append(topping)
        return self

    def build(self) -> Pizza:
        return Pizza(
            size=self._size,
            crust=self._crust,
            cheese=self._cheese,
            pepperoni=self._pepperoni,
            mushrooms=self._mushrooms,
            extra_toppings=tuple(self._extra),  # list → tuple for immutability
        )

# Usage
pizza = (PizzaBuilder("Large")
    .crust("Thin Crust")
    .add_cheese()
    .add_pepperoni()
    .add_topping("Olives")
    .add_topping("Basil")
    .build())

print(pizza.description())
# Large Thin Crust Pizza: Cheese, Pepperoni, Olives, Basil
```

### Code Example 6: Java -- Builder (Effective Java Style)

The style recommended by Joshua Bloch. The Builder is defined as a nested class.

```java
public class NutritionFacts {
    private final int servingSize;   // required
    private final int servings;      // required
    private final int calories;      // optional
    private final int fat;           // optional
    private final int sodium;        // optional
    private final int carbohydrate;  // optional

    public static class Builder {
        // Required parameters
        private final int servingSize;
        private final int servings;

        // Optional parameters (initialized to default values)
        private int calories = 0;
        private int fat = 0;
        private int sodium = 0;
        private int carbohydrate = 0;

        public Builder(int servingSize, int servings) {
            this.servingSize = servingSize;
            this.servings = servings;
        }

        public Builder calories(int val) {
            if (val < 0) throw new IllegalArgumentException("Calories must be non-negative");
            calories = val;
            return this;
        }

        public Builder fat(int val) { fat = val; return this; }
        public Builder sodium(int val) { sodium = val; return this; }
        public Builder carbohydrate(int val) { carbohydrate = val; return this; }

        public NutritionFacts build() {
            return new NutritionFacts(this);
        }
    }

    private NutritionFacts(Builder builder) {
        servingSize  = builder.servingSize;
        servings     = builder.servings;
        calories     = builder.calories;
        fat          = builder.fat;
        sodium       = builder.sodium;
        carbohydrate = builder.carbohydrate;
    }
}

// Usage
NutritionFacts cocaCola = new NutritionFacts.Builder(240, 8)
    .calories(100)
    .sodium(35)
    .carbohydrate(27)
    .build();
```

### Code Example 7: Go -- Functional Options Pattern

In Go, the Functional Options pattern is preferred over the Builder pattern.

```go
package main

import (
    "fmt"
    "time"
)

type Server struct {
    host         string
    port         int
    timeout      time.Duration
    maxConn      int
    enableTLS    bool
    certFile     string
}

// Option is a function type that modifies Server configuration
type Option func(*Server)

// Define each option as a function
func WithPort(port int) Option {
    return func(s *Server) {
        s.port = port
    }
}

func WithTimeout(d time.Duration) Option {
    return func(s *Server) {
        s.timeout = d
    }
}

func WithMaxConnections(max int) Option {
    return func(s *Server) {
        s.maxConn = max
    }
}

func WithTLS(certFile string) Option {
    return func(s *Server) {
        s.enableTLS = true
        s.certFile = certFile
    }
}

// Constructor: required arguments + variadic options
func NewServer(host string, opts ...Option) *Server {
    // Default values
    s := &Server{
        host:    host,
        port:    8080,
        timeout: 30 * time.Second,
        maxConn: 100,
    }

    // Apply options
    for _, opt := range opts {
        opt(s)
    }

    return s
}

func main() {
    // Default configuration
    s1 := NewServer("localhost")
    fmt.Printf("Server: %s:%d\n", s1.host, s1.port)
    // Server: localhost:8080

    // Custom configuration
    s2 := NewServer("api.example.com",
        WithPort(443),
        WithTimeout(10*time.Second),
        WithMaxConnections(1000),
        WithTLS("/etc/certs/server.pem"),
    )
    fmt.Printf("Server: %s:%d (TLS=%v)\n", s2.host, s2.port, s2.enableTLS)
    // Server: api.example.com:443 (TLS=true)
}
```

**WHY -- Why Functional Options are preferred in Go:**

```
1. Go does not have a culture of method chaining (convention is to return errors)
2. Zero values serve as useful defaults
3. Functions are first-class objects, so this approach is natural
4. Easy to change only specific options in tests
5. Options can be added while maintaining backward compatibility
```

### Code Example 8: Kotlin -- data class + copy

In Kotlin, the `copy` method of data classes covers many Builder use cases.

```kotlin
data class ServerConfig(
    val host: String,
    val port: Int = 8080,
    val timeout: Long = 30_000,
    val maxConnections: Int = 100,
    val enableTLS: Boolean = false,
    val certFile: String? = null,
)

// Kotlin default arguments + named arguments = no Builder needed
val config1 = ServerConfig(
    host = "localhost",
    port = 3000,
    enableTLS = true,
    certFile = "/etc/certs/server.pem",
)

// copy to change only some fields (a combination of Prototype + Builder)
val config2 = config1.copy(
    host = "api.example.com",
    port = 443,
)

println(config2)
// ServerConfig(host=api.example.com, port=443, timeout=30000,
//   maxConnections=100, enableTLS=true, certFile=/etc/certs/server.pem)
```

### Code Example 9: TypeScript -- Generic Builder

An advanced Builder that tracks the state of field settings at the type level.

```typescript
// Track set fields at the type level
type BuilderState = {
  name: boolean;
  email: boolean;
};

class TypedBuilder<State extends BuilderState = { name: false; email: false }> {
  private data: Record<string, any> = {};

  setName(name: string): TypedBuilder<State & { name: true }> {
    this.data.name = name;
    return this as any;
  }

  setEmail(email: string): TypedBuilder<State & { email: true }> {
    this.data.email = email;
    return this as any;
  }

  setAge(age: number): TypedBuilder<State> {
    this.data.age = age;
    return this as any;
  }

  // build can only be called when both name and email are true
  build(this: TypedBuilder<{ name: true; email: true }>): Person {
    return this.data as Person;
  }
}

// OK: name and email are both set
const p1 = new TypedBuilder()
  .setName("Taro")
  .setEmail("t@example.com")
  .setAge(30)
  .build(); // OK

// Error: build cannot be called when name is false
// new TypedBuilder().setEmail("t@example.com").build();
```

### Code Example 10: Building Complex Domain Objects

```typescript
// A practical example: building an email
interface Email {
  readonly from: string;
  readonly to: string[];
  readonly cc: string[];
  readonly bcc: string[];
  readonly subject: string;
  readonly body: string;
  readonly isHtml: boolean;
  readonly attachments: ReadonlyArray<{ name: string; content: Buffer }>;
  readonly replyTo?: string;
  readonly priority: "low" | "normal" | "high";
}

class EmailBuilder {
  private from = "";
  private to: string[] = [];
  private cc: string[] = [];
  private bcc: string[] = [];
  private subject = "";
  private body = "";
  private isHtml = false;
  private attachments: { name: string; content: Buffer }[] = [];
  private replyTo?: string;
  private priority: "low" | "normal" | "high" = "normal";

  setFrom(from: string): this {
    this.from = from;
    return this;
  }

  addTo(...recipients: string[]): this {
    this.to.push(...recipients);
    return this;
  }

  addCc(...recipients: string[]): this {
    this.cc.push(...recipients);
    return this;
  }

  addBcc(...recipients: string[]): this {
    this.bcc.push(...recipients);
    return this;
  }

  setSubject(subject: string): this {
    this.subject = subject;
    return this;
  }

  setTextBody(body: string): this {
    this.body = body;
    this.isHtml = false;
    return this;
  }

  setHtmlBody(html: string): this {
    this.body = html;
    this.isHtml = true;
    return this;
  }

  addAttachment(name: string, content: Buffer): this {
    this.attachments.push({ name, content });
    return this;
  }

  setReplyTo(email: string): this {
    this.replyTo = email;
    return this;
  }

  setPriority(priority: "low" | "normal" | "high"): this {
    this.priority = priority;
    return this;
  }

  build(): Email {
    if (!this.from) throw new Error("From is required");
    if (this.to.length === 0) throw new Error("At least one recipient is required");
    if (!this.subject) throw new Error("Subject is required");
    if (!this.body) throw new Error("Body is required");

    return Object.freeze({
      from: this.from,
      to: [...this.to],
      cc: [...this.cc],
      bcc: [...this.bcc],
      subject: this.subject,
      body: this.body,
      isHtml: this.isHtml,
      attachments: Object.freeze([...this.attachments]),
      replyTo: this.replyTo,
      priority: this.priority,
    });
  }
}

// Usage
const email = new EmailBuilder()
  .setFrom("noreply@example.com")
  .addTo("user1@example.com", "user2@example.com")
  .addCc("manager@example.com")
  .setSubject("Weekly Report")
  .setHtmlBody("<h1>Weekly Report</h1><p>...</p>")
  .setPriority("high")
  .build();
```

---

## 4. Comparison Tables

### Comparison Table 1: Builder vs Constructor vs Object Literal

| Aspect | Constructor | Object Literal | Builder |
|------|:---:|:---:|:---:|
| Enforce required fields | Yes | Requires validation | Yes (Step Builder) |
| Readability (many args) | Low | Medium | High |
| Immutability guarantee | Possible | Difficult | Easy |
| Complex construction logic | Difficult | Difficult | Easy |
| Amount of code | Small | Small | Large |
| Centralized validation | Inside constructor | External | Inside build() |
| IDE support (autocomplete) | Good | Good | Excellent |
| When to use | 1-3 arguments | All optional | 4+ arguments |

### Comparison Table 2: Builder vs Factory

| Aspect | Builder | Factory |
|------|---------|---------|
| Purpose | Incremental construction | Type selection |
| What it returns | One complex object | Objects of various types |
| Method chaining | Common | Rare |
| Use case | Many optional arguments | Switching between variations |
| Construction flexibility | High (incrementally customizable) | Low (select from predefined types) |
| Combination | Factory can return a Builder | Builder can use a Factory |

### Comparison Table 3: Builder Alternatives by Language

| Language | Builder Alternative | When to Use |
|------|-------------|---------|
| TypeScript | Object literal + Partial<T> | Simple cases |
| Python | Keyword arguments + dataclass | Builder often unnecessary |
| Kotlin | Named arguments + copy() | Builder often unnecessary |
| Java | Effective Java Builder | Standard approach |
| Go | Functional Options | Go idiom |
| Rust | Builder derive macro | Reduces boilerplate |
| C# | Object Initializer | Builder often unnecessary |

---

## 5. Edge Cases and Caveats

### 5.1 Forgetting to Call build()

```typescript
// BAD: forgetting build() and accidentally using the Builder object
const config = new ConfigBuilder()
  .setHost("localhost")
  .setPort(8080);
  // forgot .build()! config is of type ConfigBuilder

server.start(config); // type error or runtime error
```

**Countermeasures:**

```typescript
// 1. Use TypeScript's type system to clearly distinguish Builder from Product
//    → server.start() only accepts ServerConfig type

// 2. Use Step Builder to force build() as the final step

// 3. Use an ESLint rule to warn on variable assignments of Builder type
```

### 5.2 Builder Reuse Problem

```typescript
// BAD: reusing the same Builder instance
const builder = new UserBuilder().setName("Taro").setEmail("t@example.com");

const user1 = builder.setRole("admin").build();
const user2 = builder.setRole("viewer").build();

// Is user2 admin or viewer? → depends on the Builder's internal state
// Since builder.setRole("admin") modified the builder,
// user2 may also end up as admin
```

**Countermeasures:**

```typescript
// Either reset the Builder after build(), or
// create a new Builder each time

// Option 1: reset on build()
build(): User {
  const user = new User(this);
  this.reset(); // reset internal state
  return user;
}

// Option 2: create a new Builder each time (recommended)
const user1 = User.builder().setName("Taro").setRole("admin").build();
const user2 = User.builder().setName("Taro").setRole("viewer").build();
```

### 5.3 Thread Safety

```
Sharing a Builder in a multithreaded environment causes problems:

Thread A: builder.setName("Taro")
Thread B: builder.setName("Jiro")   ← race condition!
Thread A: builder.build()            ← may return "Jiro"

Countermeasures:
1. Do not share Builders; create a new one per thread (recommended)
2. Synchronize Builder methods (not recommended: performance degradation)
3. Immutable Builder: each method returns a new Builder
```

---

## 6. Anti-patterns

### Anti-pattern 1: Forgetting to Call build()

```typescript
// NG: forgetting build() and accidentally using the Builder object
const config = new ConfigBuilder()
  .setHost("localhost")
  .setPort(8080);
  // forgot .build()!

server.start(config); // type error or runtime error
```

**Fix**: Use TypeScript's type system to clearly distinguish Builder from Product. Using a Step Builder makes this a compile error.

### Anti-pattern 2: Stuffing Business Logic into the Builder

```typescript
// NG: Builder takes on responsibilities beyond construction
class OrderBuilder {
  private items: CartItem[] = [];
  private coupon?: string;

  addItem(item: CartItem): this {
    this.items.push(item);
    return this;
  }

  setCoupon(code: string): this {
    this.coupon = code;
    return this;
  }

  build(): Order {
    const order = new Order(this.items);

    // NG: business logic
    if (this.coupon) {
      const discount = validateCoupon(this.coupon); // coupon validation
      order.applyDiscount(discount);                 // apply discount
    }
    order.calculateTax();       // tax calculation
    order.calculateShipping();  // shipping calculation
    sendNotification(order);    // send notification (side effect)

    return order;
  }
}
```

```typescript
// OK: Builder only constructs. Business logic is delegated to domain services.
class OrderBuilder {
  private items: CartItem[] = [];

  addItem(item: CartItem): this {
    this.items.push(item);
    return this;
  }

  build(): Order {
    if (this.items.length === 0) throw new Error("Order must have items");
    return new Order([...this.items]); // construction only
  }
}

// Business logic is delegated to a service
class OrderService {
  async processOrder(order: Order, couponCode?: string): Promise<Order> {
    if (couponCode) {
      const discount = await this.couponService.validate(couponCode);
      order.applyDiscount(discount);
    }
    order.tax = this.taxService.calculate(order);
    await this.notificationService.send(order);
    return order;
  }
}
```

### Anti-pattern 3: Using Builder for Simple Objects

```typescript
// NG: using a Builder for an object with only 2 fields
class PointBuilder {
  private x = 0;
  private y = 0;

  setX(x: number): this { this.x = x; return this; }
  setY(y: number): this { this.y = y; return this; }
  build(): Point { return new Point(this.x, this.y); }
}

// 20 lines of code is excessive for what this accomplishes
```

```typescript
// OK: a constructor is sufficient
class Point {
  constructor(public readonly x: number, public readonly y: number) {}
}

const p = new Point(10, 20);
```

**Decision criteria**: If there are fewer than 4 arguments and fewer than 2 optional arguments, a Builder is over-engineering.

---

## 7. Trade-off Analysis

```
Benefits                                   Drawbacks
+------------------------------+  +------------------------------+
| Self-documenting build code  |  | Large amount of boilerplate  |
| Safe construction of         |  | Increased number of classes  |
|   immutable objects          |  | Over-engineering for simple  |
| Centralized validation       |  |   cases                      |
| Order-independent field      |  | Risk of forgetting build()   |
|   setting                    |  | Need to keep Builder and     |
| Excellent IDE autocomplete   |  |   Product in sync            |
| Flexible construction        |  | Unnecessary in some          |
|   in tests                   |  |   languages (Kotlin, etc.)   |
+------------------------------+  +------------------------------+
```

---

## 8. Practice Exercises

### Exercise 1: Basic -- HTTP Response Builder

**Task**: Implement a Builder that constructs an HTTP response object.

**Requirements**:
- Configurable status code (required), headers, body, and Content-Type
- Fluent API (method chaining)
- Validation in build() (check that status code is in the range 100-599)
- The generated response is immutable

```typescript
// === Write your implementation here ===
```

**Expected output**:

```
const res = new HttpResponseBuilder(200)
  .setHeader("Content-Type", "application/json")
  .setHeader("Cache-Control", "no-cache")
  .setBody(JSON.stringify({ message: "OK" }))
  .build();

console.log(res.statusCode);  // 200
console.log(res.headers);     // { "Content-Type": "application/json", "Cache-Control": "no-cache" }
console.log(res.body);        // '{"message":"OK"}'
```

<details>
<summary>Reference Solution (click to expand)</summary>

```typescript
interface HttpResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

class HttpResponseBuilder {
  private headers: Record<string, string> = {};
  private body?: string;

  constructor(private statusCode: number) {}

  setHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  setBody(body: string): this {
    this.body = body;
    return this;
  }

  setJsonBody(data: unknown): this {
    this.headers["Content-Type"] = "application/json";
    this.body = JSON.stringify(data);
    return this;
  }

  build(): HttpResponse {
    if (this.statusCode < 100 || this.statusCode > 599) {
      throw new Error(`Invalid status code: ${this.statusCode}`);
    }

    return Object.freeze({
      statusCode: this.statusCode,
      headers: Object.freeze({ ...this.headers }),
      body: this.body,
    });
  }
}
```

</details>

### Exercise 2: Applied -- SQL Query Builder with Director

**Task**: Implement a Builder for constructing SQL queries and a Director for commonly used query patterns.

**Requirements**:
- Support SELECT / FROM / WHERE / JOIN / ORDER BY / LIMIT / OFFSET
- Multiple WHERE conditions can be specified (joined with AND)
- Director has three construction patterns: "paginated list retrieval", "count retrieval", and "search"
- Parameter binding (SQL injection prevention)

```typescript
// === Write your implementation here ===
```

**Expected output**:

```
const director = new QueryDirector();

const listQuery = director.buildPaginatedList(new SQLBuilder(), "users", 2, 20);
console.log(listQuery.sql);
// SELECT * FROM users WHERE active = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
console.log(listQuery.params);
// [true, 20, 20]
```

<details>
<summary>Reference Solution (click to expand)</summary>

```typescript
interface Query {
  sql: string;
  params: any[];
}

class SQLBuilder {
  private selectClause = "*";
  private fromClause = "";
  private whereConditions: { condition: string; param?: any }[] = [];
  private joinClauses: string[] = [];
  private orderByClause = "";
  private limitValue?: number;
  private offsetValue?: number;
  private paramIndex = 1;

  select(columns: string): this {
    this.selectClause = columns;
    return this;
  }

  from(table: string): this {
    this.fromClause = table;
    return this;
  }

  where(condition: string, param?: any): this {
    const paramPlaceholder = param !== undefined ? `$${this.paramIndex++}` : "";
    this.whereConditions.push({
      condition: condition.replace("?", paramPlaceholder),
      param,
    });
    return this;
  }

  join(joinClause: string): this {
    this.joinClauses.push(joinClause);
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByClause = `${column} ${direction}`;
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  build(): Query {
    if (!this.fromClause) throw new Error("FROM clause is required");

    const params: any[] = [];
    let sql = `SELECT ${this.selectClause} FROM ${this.fromClause}`;

    for (const join of this.joinClauses) {
      sql += ` ${join}`;
    }

    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions.map(w => {
        if (w.param !== undefined) params.push(w.param);
        return w.condition;
      });
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    if (this.orderByClause) sql += ` ORDER BY ${this.orderByClause}`;

    if (this.limitValue !== undefined) {
      sql += ` LIMIT $${this.paramIndex++}`;
      params.push(this.limitValue);
    }
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET $${this.paramIndex++}`;
      params.push(this.offsetValue);
    }

    return { sql, params };
  }
}

class QueryDirector {
  buildPaginatedList(builder: SQLBuilder, table: string, page: number, size: number): Query {
    return builder
      .select("*")
      .from(table)
      .where("active = ?", true)
      .orderBy("created_at", "DESC")
      .limit(size)
      .offset((page - 1) * size)
      .build();
  }

  buildCount(builder: SQLBuilder, table: string): Query {
    return builder
      .select("COUNT(*) as total")
      .from(table)
      .where("active = ?", true)
      .build();
  }

  buildSearch(builder: SQLBuilder, table: string, keyword: string): Query {
    return builder
      .select("id, name, description")
      .from(table)
      .where("name ILIKE ?", `%${keyword}%`)
      .where("active = ?", true)
      .orderBy("name", "ASC")
      .limit(50)
      .build();
  }
}
```

</details>

### Exercise 3: Advanced -- Step Builder with Conditional Branching

**Task**: Design a Step Builder where required fields differ depending on the user type (individual / corporate).

**Requirements**:
- Individual user: name and email are required. age is optional.
- Corporate user: companyName, email, and registrationNumber are required.
- After selecting the type, only the relevant required fields are demanded (type-safe).
- build() can only be called once all required fields are set.

```typescript
// === Write your implementation here ===
```

**Expected output**:

```
// Individual user
const individual = UserBuilder.create()
  .asIndividual()            // → returns NeedsIndividualName
  .setName("Taro")           // → returns NeedsIndividualEmail
  .setEmail("taro@test.com") // → returns IndividualOptional
  .setAge(30)
  .build();

// Corporate user
const corporate = UserBuilder.create()
  .asCorporate()                       // → returns NeedsCorporateName
  .setCompanyName("Example Corp")      // → returns NeedsCorporateEmail
  .setEmail("info@example.com")        // → returns NeedsCorporateRegNum
  .setRegistrationNumber("1234567890") // → returns CorporateOptional
  .build();
```

<details>
<summary>Reference Solution (click to expand)</summary>

```typescript
// Type selection
interface SelectType {
  asIndividual(): NeedsIndividualName;
  asCorporate(): NeedsCorporateName;
}

// Steps for individual user
interface NeedsIndividualName {
  setName(name: string): NeedsIndividualEmail;
}
interface NeedsIndividualEmail {
  setEmail(email: string): IndividualOptional;
}
interface IndividualOptional {
  setAge(age: number): IndividualOptional;
  setPhone(phone: string): IndividualOptional;
  build(): User;
}

// Steps for corporate user
interface NeedsCorporateName {
  setCompanyName(name: string): NeedsCorporateEmail;
}
interface NeedsCorporateEmail {
  setEmail(email: string): NeedsCorporateRegNum;
}
interface NeedsCorporateRegNum {
  setRegistrationNumber(num: string): CorporateOptional;
}
interface CorporateOptional {
  setRepresentative(name: string): CorporateOptional;
  build(): User;
}

type UserType = "individual" | "corporate";

interface User {
  type: UserType;
  name?: string;
  companyName?: string;
  email: string;
  age?: number;
  phone?: string;
  registrationNumber?: string;
  representative?: string;
}

class UserBuilder implements
  SelectType,
  NeedsIndividualName, NeedsIndividualEmail, IndividualOptional,
  NeedsCorporateName, NeedsCorporateEmail, NeedsCorporateRegNum, CorporateOptional
{
  private data: Partial<User> = {};

  static create(): SelectType {
    return new UserBuilder();
  }

  asIndividual(): NeedsIndividualName {
    this.data.type = "individual";
    return this;
  }

  asCorporate(): NeedsCorporateName {
    this.data.type = "corporate";
    return this;
  }

  setName(name: string): NeedsIndividualEmail {
    this.data.name = name;
    return this;
  }

  setCompanyName(name: string): NeedsCorporateEmail {
    this.data.companyName = name;
    return this;
  }

  setEmail(email: string): any {
    this.data.email = email;
    return this;
  }

  setRegistrationNumber(num: string): CorporateOptional {
    this.data.registrationNumber = num;
    return this;
  }

  setAge(age: number): IndividualOptional {
    this.data.age = age;
    return this;
  }

  setPhone(phone: string): IndividualOptional {
    this.data.phone = phone;
    return this;
  }

  setRepresentative(name: string): CorporateOptional {
    this.data.representative = name;
    return this;
  }

  build(): User {
    return Object.freeze(this.data) as User;
  }
}
```

</details>

---

## 9. FAQ

### Q1: From what level of complexity should I introduce a Builder?

As a guideline, consider introducing a Builder when a **constructor has 4 or more parameters** or **has 2 or more optional parameters**. If there are 2-3 parameters, a constructor is sufficient.

However, a Builder is worth considering even with fewer parameters in these cases:
- There are multiple parameters of the same type (risk of order mistakes)
- Construction requires multiple steps
- Reuse of the construction logic is needed (Director)

### Q2: Is auto-generation like Lombok's @Builder recommended?

Yes. Reducing boilerplate code directly improves productivity.

| Language/Tool | Auto-generation Method |
|------------|-------------|
| Java | Lombok @Builder |
| Kotlin | data class + copy |
| TypeScript | Semi-automatic with classes + generics |
| Python | dataclasses + Pydantic |
| Rust | derive_builder crate |

### Q3: What is the difference between Builder and Named Arguments (keyword arguments)?

Keyword arguments in Python and Kotlin provide many of the same benefits as a Builder. However, a Builder has advantages in the following cases:

| Aspect | Keyword Arguments | Builder |
|------|:---:|:---:|
| Incremental construction | No | Yes |
| Centralized validation | No | Yes (inside build()) |
| Reuse of construction logic | No | Yes (Director) |
| Immutability guarantee | Language-dependent | Explicitly controllable |
| Amount of code | Small | Large |

### Q4: Is a Director necessary?

In most real-world situations, a Fluent Builder without a Director is sufficient. A Director is effective when:

1. The same construction pattern is used in multiple places
2. The construction procedure itself expresses domain knowledge
3. Repeatedly constructing standardized objects in tests

### Q5: How do you choose between Builder and the Prototype pattern?

```
Builder: construct an object from scratch
  → Effective when there are many construction parameters

Prototype: copy an existing object and change some parts
  → Effective when a base object already exists

Kotlin's copy() combines both:
  val base = Config(host = "localhost", port = 8080, ...)
  val prod = base.copy(host = "api.example.com", port = 443)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics to jump into advanced topics. It is recommended to thoroughly understand the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Point |
|------|---------|
| Purpose | Incrementally construct complex objects |
| Core problem | Solving the Telescoping Constructor problem and safely constructing immutable objects |
| Fluent API | Improves readability with method chaining. The most common implementation. |
| Step Builder | Guarantees required fields in a type-safe way. Verified at compile time. |
| Director | Encapsulates construction procedures for reuse |
| Decision criteria | Consider when there are 4+ arguments or 2+ optional arguments |
| Language-specific recommendations | Java: Effective Java style / Go: Functional Options / Kotlin: data class |
| Most important caution | Do not put business logic in the Builder. Watch out for forgetting to call build(). |

---

## Next Guides to Read

- [Prototype Pattern](./03-prototype.md) -- Creation via cloning. Builder "constructs from scratch", Prototype "copies from an existing object"
- [Factory Pattern](./01-factory.md) -- The pattern where a Factory returns a Builder
- [Decorator Pattern](../01-structural/01-decorator.md) -- Dynamic feature addition. Decorating the result built by a Builder
- [Function Design](../../../clean-code-principles/docs/01-practices/01-functions.md) -- Best practices for parameter design
- [Immutability](../../../clean-code-principles/docs/03-practices-advanced/00-immutability.md) -- Design of immutable data structures

---

## References

1. Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley. -- The original source on the Builder pattern
2. Bloch, J. (2018). *Effective Java* (3rd ed.). Addison-Wesley. Item 2: Consider a builder when faced with many constructor parameters.
3. Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly Media.
4. Refactoring.Guru -- Builder. https://refactoring.guru/design-patterns/builder
5. Dave Cheney (2014). Functional options for friendly APIs. https://dave.cheney.net/2014/10/17/functional-options-for-friendly-apis
6. Martin, R.C. (2008). *Clean Code*. Prentice Hall. Chapter 3: Functions -- Minimize the number of arguments
