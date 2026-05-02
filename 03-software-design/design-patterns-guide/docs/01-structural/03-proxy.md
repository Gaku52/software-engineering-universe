# Proxy Pattern

> A structural pattern that provides a **surrogate object to control access** to another object, implementing cross-cutting concerns such as lazy initialization, access control, and caching.

---

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| Interfaces and polymorphism | Basic | TypeScript / Java / Python OOP |
| Dependency Injection (DI) | Basic | [Clean Architecture](../../../system-design-guide/docs/02-architecture/01-clean-architecture.md) |
| Asynchronous programming | Basic | Promise / async-await |
| Decorator pattern | Recommended | [Decorator Pattern](./01-decorator.md) |
| ES6 Proxy / Reflect | Recommended | MDN Web Docs |

---

## What You Will Learn in This Chapter

1. The "access control" problem that the Proxy pattern solves, and its 5 classifications (Virtual / Protection / Cache / Remote / Logging)
2. The relationship and essential differences between the GoF Proxy pattern and JavaScript ES6 Proxy
3. Clear criteria for choosing between Proxy and Decorator
4. Implementation patterns in 5 languages (TypeScript, Python, Java, Go, Kotlin)
5. Advanced techniques: Proxy chains, dynamic Proxy generation, and Smart References

---

## 1. Why Is Proxy Necessary? (WHY)

### 1.1 A World Without Proxy

When using an object, the following cross-cutting concerns arise.

```
┌──────────────────────────────────────────────────────────┐
│  Without Proxy: cross-cutting concerns scattered in client │
│                                                          │
│  Client A:                                               │
│    if (!user.isAdmin) throw "Access denied";  ← auth     │
│    const cached = cache.get(key);              ← cache   │
│    if (!cached) {                                        │
│      const data = service.getData();           ← business logic │
│      cache.set(key, data);                     ← cache   │
│    }                                                     │
│    logger.log("getData called");               ← log     │
│                                                          │
│  Client B:                                               │
│    if (!user.isAdmin) throw "Access denied";  ← same auth │
│    const cached = cache.get(key);              ← same    │
│    if (!cached) {                              cache      │
│      const data = service.getData();                     │
│      cache.set(key, data);                               │
│    }                                                     │
│    logger.log("getData called");               ← same log │
│                                                          │
│  Problems:                                               │
│  - Auth, cache, and log are duplicated across all clients │
│  - Business logic and cross-cutting concerns are mixed   │
│  - Cross-cutting concerns cannot be isolated in tests    │
│  - Adding a new concern requires modifying all clients   │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Real-World Analogy

Think of a **bank ATM**. The ATM is a proxy for the bank account (RealSubject).

- Identity verification (PIN) = **Protection Proxy**
- Balance caching (no DB query every time) = **Cache Proxy**
- Transaction recording (passbook entry) = **Logging Proxy**
- Connection to the remote banking system = **Remote Proxy**

Customers access their accounts through the ATM, and both the ATM and the account share the same "transaction" interface. The client (customer) can perform the same operations whether through the ATM or directly at the counter.

### 1.3 A World With Proxy

```
┌──────────────────────────────────────────────────────────┐
│  With Proxy: cross-cutting concerns consolidated in Proxy │
│                                                          │
│  Client A ──▶ Proxy.getData()                            │
│  Client B ──▶ Proxy.getData()                            │
│                    │                                     │
│                    ├── Auth check (Protection)           │
│                    ├── Cache lookup (Cache)              │
│                    ├── service.getData() (delegation)    │
│                    ├── Cache store (Cache)               │
│                    └── Log record (Logging)              │
│                                                          │
│  Benefits:                                               │
│  - Centralized management of cross-cutting concerns      │
│  - Clients focus only on the core logic                  │
│  - Proxy shares the same interface as RealSubject        │
│  - Proxy is transparent to the client                    │
└──────────────────────────────────────────────────────────┘
```

### 1.4 The Essence of the Proxy Pattern

The essence of Proxy is **"controlling access through a surrogate object with the same interface"**.

1. **Same interface**: Proxy and RealSubject implement the same interface
2. **Transparency**: Clients cannot distinguish between Proxy and RealSubject
3. **Access control**: Insert cross-cutting concerns such as lazy initialization, auth, caching, and logging
4. **Lifecycle management**: Proxy can manage the creation and destruction of RealSubject

> **The essential difference between Proxy and Decorator**: Proxy's purpose is "access control"; Decorator's purpose is "adding functionality". Proxy manages the lifecycle of RealSubject, while Decorator decorates an externally provided object.

---

## 2. Proxy Structure

### 2.1 Class Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      UML Class Diagram                   │
│                                                         │
│            ┌──────────────────┐                          │
│            │    <<interface>> │                          │
│            │     Subject     │                          │
│            │                 │                          │
│            │ + request()     │                          │
│            └────────┬────────┘                          │
│                     │ implements                        │
│              ┌──────┴──────┐                            │
│              │             │                            │
│  ┌───────────▼──────┐  ┌──▼──────────────┐             │
│  │      Proxy       │  │  RealSubject    │             │
│  │                  │  │                 │             │
│  │ - real: Subject  │──│ + request()     │             │
│  │ + request()      │  │                 │             │
│  │  {               │  └─────────────────┘             │
│  │   // pre-process │                                  │
│  │   real.request() │                                  │
│  │   // post-process│                                  │
│  │  }               │                                  │
│  └──────────────────┘                                  │
│                                                         │
│  ┌──────────┐                                          │
│  │  Client  │──────▶ Subject (Proxy or RealSubject)    │
│  └──────────┘                                          │
│                                                         │
│  Key points:                                            │
│  - Client depends only on the Subject interface         │
│  - Proxy holds a reference to RealSubject internally    │
│  - Proxy can manage the lifecycle of RealSubject        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Types and Classifications of Proxy

```
┌──────────────────────────────────────────────────────────┐
│                   Proxy Classification System             │
│                                                          │
│  ┌──────────────┬───────────────────────────────────┐   │
│  │ Virtual      │ Lazy initialization of heavy objects│  │
│  │ Proxy        │ e.g. images, DB connections, large data││
│  │              │ Purpose: performance optimization    │  │
│  ├──────────────┼───────────────────────────────────┤   │
│  │ Protection   │ Access permission checks           │   │
│  │ Proxy        │ e.g. RBAC, authentication/authz   │   │
│  │              │ Purpose: security                  │   │
│  ├──────────────┼───────────────────────────────────┤   │
│  │ Cache        │ Result caching (memoization)       │   │
│  │ Proxy        │ e.g. API responses, DB results     │   │
│  │              │ Purpose: performance optimization  │   │
│  ├──────────────┼───────────────────────────────────┤   │
│  │ Remote       │ Local proxy for a remote object    │   │
│  │ Proxy        │ e.g. RPC, gRPC, GraphQL stubs      │   │
│  │              │ Purpose: transparency in distributed systems│
│  ├──────────────┼───────────────────────────────────┤   │
│  │ Logging      │ Operation recording/audit/metrics  │   │
│  │ Proxy        │ e.g. method call tracing           │   │
│  │              │ Purpose: observability             │   │
│  ├──────────────┼───────────────────────────────────┤   │
│  │ Smart        │ Additional housekeeping processing │   │
│  │ Reference    │ e.g. reference counting, change notification│
│  │              │ Purpose: resource management       │   │
│  └──────────────┴───────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Sequence Diagram (Virtual Proxy)

```
┌─────────────────────────────────────────────────────────┐
│                Sequence Diagram: Virtual Proxy            │
│                                                         │
│  Client        Proxy          RealSubject               │
│    │             │                                      │
│    │ new Proxy() │                                      │
│    │────────────▶│  (RealSubject is not yet created)    │
│    │             │                                      │
│    │ request()   │                                      │
│    │────────────▶│                                      │
│    │             │ [real == null?]                       │
│    │             │── Yes ──▶ new RealSubject()           │
│    │             │           (created here for the first time) │
│    │             │                  │                    │
│    │             │ real.request()   │                    │
│    │             │─────────────────▶│                    │
│    │             │  result          │                    │
│    │             │◀─────────────────│                    │
│    │  result     │                  │                    │
│    │◀────────────│                  │                    │
│    │             │                                      │
│    │ request()   │  (2nd call: already created)         │
│    │────────────▶│                                      │
│    │             │ [real != null]                        │
│    │             │ real.request()   │                    │
│    │             │─────────────────▶│                    │
│    │             │  result          │                    │
│    │             │◀─────────────────│                    │
│    │  result     │                  │                    │
│    │◀────────────│                  │                    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Code Examples

### Code Example 1: Virtual Proxy -- Lazy Initialization (TypeScript)

```typescript
// === Subject Interface ===

interface Image {
  display(): void;
  getSize(): number;
  getFilename(): string;
}

// === RealSubject ===

class HighResImage implements Image {
  private data: Uint8Array;

  constructor(private filename: string) {
    // Heavy operation: read file (executed in constructor)
    console.log(`[HighResImage] Loading ${filename} from disk...`);
    console.log(`[HighResImage] Decoding image data...`);
    this.data = new Uint8Array(10_000_000); // 10MB buffer
    console.log(`[HighResImage] ${filename} loaded (${this.data.length} bytes)`);
  }

  display(): void {
    console.log(`[HighResImage] Displaying ${this.filename} (${this.data.length} bytes)`);
  }

  getSize(): number {
    return this.data.length;
  }

  getFilename(): string {
    return this.filename;
  }
}

// === Proxy ===

class ImageProxy implements Image {
  private real: HighResImage | null = null;

  constructor(private filename: string) {
    // Proxy creation is lightweight (no file loading)
    console.log(`[ImageProxy] Created proxy for ${filename}`);
  }

  private ensureLoaded(): HighResImage {
    if (!this.real) {
      console.log(`[ImageProxy] First access - loading real image...`);
      this.real = new HighResImage(this.filename);
    }
    return this.real;
  }

  display(): void {
    this.ensureLoaded().display();
  }

  getSize(): number {
    return this.ensureLoaded().getSize();
  }

  getFilename(): string {
    // The proxy already knows the filename, so no need to create RealSubject
    return this.filename;
  }
}

// === Usage Example ===

console.log("=== Creating image gallery ===");
const gallery: Image[] = [
  new ImageProxy("photo1.jpg"),
  new ImageProxy("photo2.jpg"),
  new ImageProxy("photo3.jpg"),
  new ImageProxy("photo4.jpg"),
  new ImageProxy("photo5.jpg"),
];
console.log(`Gallery has ${gallery.length} images`);
// Output: only 5 Proxies are created. Image data is not loaded yet.

console.log("\n=== User scrolls to image 2 ===");
gallery[1].display();
// Output: only photo2.jpg is loaded

console.log("\n=== User scrolls to image 2 again ===");
gallery[1].display();
// Output: already loaded, so displays immediately

console.log("\n=== Getting filename (no loading needed) ===");
console.log(gallery[3].getFilename());
// Output: photo4.jpg (can be returned without loading)
```

**Key point**: Of the 5 images, only the ones the user views are actually loaded. `getFilename()` is an example of a method that can return without triggering a load.

---

### Code Example 2: Protection Proxy -- RBAC Access Control (TypeScript)

```typescript
// === Subject Interface ===

interface AdminService {
  listUsers(): User[];
  deleteUser(userId: string): void;
  resetDatabase(): void;
  viewAuditLogs(): AuditEntry[];
}

interface User {
  id: string;
  name: string;
  role: "viewer" | "editor" | "admin" | "superadmin";
}

interface AuditEntry {
  action: string;
  userId: string;
  timestamp: Date;
}

// === RealSubject ===

class RealAdminService implements AdminService {
  listUsers(): User[] {
    console.log("[RealAdmin] Listing all users");
    return [
      { id: "1", name: "Alice", role: "admin" },
      { id: "2", name: "Bob", role: "viewer" },
    ];
  }

  deleteUser(userId: string): void {
    console.log(`[RealAdmin] User ${userId} deleted`);
  }

  resetDatabase(): void {
    console.log("[RealAdmin] Database has been reset");
  }

  viewAuditLogs(): AuditEntry[] {
    console.log("[RealAdmin] Fetching audit logs");
    return [{ action: "login", userId: "1", timestamp: new Date() }];
  }
}

// === Protection Proxy ===

type Role = User["role"];

// Declare the required roles per method
const REQUIRED_ROLES: Record<keyof AdminService, Role[]> = {
  listUsers: ["viewer", "editor", "admin", "superadmin"],
  deleteUser: ["admin", "superadmin"],
  resetDatabase: ["superadmin"],
  viewAuditLogs: ["admin", "superadmin"],
};

class AdminProxy implements AdminService {
  constructor(
    private real: AdminService,
    private currentUser: User,
  ) {
    console.log(`[AdminProxy] Created for user ${currentUser.name} (${currentUser.role})`);
  }

  private checkAccess(method: keyof AdminService): void {
    const allowedRoles = REQUIRED_ROLES[method];
    if (!allowedRoles.includes(this.currentUser.role)) {
      const msg = `Access denied: ${method} requires ${allowedRoles.join(" or ")}, ` +
        `but ${this.currentUser.name} has role "${this.currentUser.role}"`;
      console.log(`[AdminProxy] ${msg}`);
      throw new Error(msg);
    }
    console.log(`[AdminProxy] Access granted: ${this.currentUser.name} -> ${method}`);
  }

  listUsers(): User[] {
    this.checkAccess("listUsers");
    return this.real.listUsers();
  }

  deleteUser(userId: string): void {
    this.checkAccess("deleteUser");
    // Additional check: cannot delete yourself
    if (userId === this.currentUser.id) {
      throw new Error("Cannot delete yourself");
    }
    this.real.deleteUser(userId);
  }

  resetDatabase(): void {
    this.checkAccess("resetDatabase");
    this.real.resetDatabase();
  }

  viewAuditLogs(): AuditEntry[] {
    this.checkAccess("viewAuditLogs");
    return this.real.viewAuditLogs();
  }
}

// === Usage Example ===

const realService = new RealAdminService();

// Admin user
const admin: User = { id: "1", name: "Alice", role: "admin" };
const adminProxy = new AdminProxy(realService, admin);
adminProxy.listUsers();       // OK
adminProxy.deleteUser("2");   // OK
// adminProxy.resetDatabase(); // Error: requires superadmin

// Viewer user
const viewer: User = { id: "2", name: "Bob", role: "viewer" };
const viewerProxy = new AdminProxy(realService, viewer);
viewerProxy.listUsers();      // OK
// viewerProxy.deleteUser("1"); // Error: requires admin or superadmin
```

**Key point**: The `REQUIRED_ROLES` table declaratively defines the required role per method. When adding a new method, just add one row to the table.

---

### Code Example 3: Cache Proxy -- TTL + LRU Cache (TypeScript)

```typescript
// === Subject Interface ===

interface ApiClient {
  fetchUser(id: string): Promise<User>;
  fetchPosts(userId: string): Promise<Post[]>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
}

// === RealSubject ===

class RealApiClient implements ApiClient {
  async fetchUser(id: string): Promise<User> {
    console.log(`[API] GET /users/${id} (network request)`);
    // In practice, this would be an HTTP request
    await new Promise(r => setTimeout(r, 100));
    return { id, name: `User-${id}`, email: `user${id}@example.com` };
  }

  async fetchPosts(userId: string): Promise<Post[]> {
    console.log(`[API] GET /users/${userId}/posts (network request)`);
    await new Promise(r => setTimeout(r, 200));
    return [
      { id: "p1", title: "Hello", content: "World" },
    ];
  }
}

// === LRU Cache Implementation ===

class LRUCache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();

  constructor(
    private maxSize: number,
    private ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      console.log(`[Cache] EXPIRED: ${key}`);
      return undefined;
    }

    // LRU: move accessed entry to the end
    this.cache.delete(key);
    this.cache.set(key, entry);
    console.log(`[Cache] HIT: ${key}`);
    return entry.data;
  }

  set(key: string, data: T): void {
    // When capacity is exceeded, delete the oldest entry
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        console.log(`[Cache] EVICTED: ${oldestKey}`);
      }
    }

    this.cache.set(key, { data, expiry: Date.now() + this.ttlMs });
    console.log(`[Cache] STORED: ${key} (TTL: ${this.ttlMs}ms)`);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    console.log(`[Cache] INVALIDATED: ${key}`);
  }

  clear(): void {
    this.cache.clear();
    console.log(`[Cache] CLEARED`);
  }

  get size(): number {
    return this.cache.size;
  }
}

// === Cache Proxy ===

class CachingApiProxy implements ApiClient {
  private cache: LRUCache<unknown>;

  constructor(
    private real: ApiClient,
    maxSize = 100,
    ttlMs = 60_000,
  ) {
    this.cache = new LRUCache(maxSize, ttlMs);
  }

  async fetchUser(id: string): Promise<User> {
    const key = `user:${id}`;
    const cached = this.cache.get(key) as User | undefined;
    if (cached) return cached;

    const user = await this.real.fetchUser(id);
    this.cache.set(key, user);
    return user;
  }

  async fetchPosts(userId: string): Promise<Post[]> {
    const key = `posts:${userId}`;
    const cached = this.cache.get(key) as Post[] | undefined;
    if (cached) return cached;

    const posts = await this.real.fetchPosts(userId);
    this.cache.set(key, posts);
    return posts;
  }

  /** Manually invalidate the cache */
  invalidateUser(id: string): void {
    this.cache.invalidate(`user:${id}`);
  }
}

// === Usage Example ===

const api: ApiClient = new CachingApiProxy(new RealApiClient(), 50, 30_000);

// 1st call: no cache → network request
const user1 = await api.fetchUser("42");
// Output: [Cache] key not found
// Output: [API] GET /users/42 (network request)
// Output: [Cache] STORED: user:42

// 2nd call: cache hit → no network request
const user2 = await api.fetchUser("42");
// Output: [Cache] HIT: user:42
```

**Key point**: A cache Proxy combining LRU (Least Recently Used) and TTL (Time To Live). `invalidateUser` allows explicit cache invalidation.

---

### Code Example 4: ES6 Proxy -- Metaprogramming (TypeScript)

```typescript
// === Validation using ES6 Proxy ===

interface UserData {
  name: string;
  age: number;
  email: string;
}

type ValidationRule = {
  validate: (value: unknown) => boolean;
  message: string;
};

const RULES: Partial<Record<keyof UserData, ValidationRule[]>> = {
  name: [
    { validate: (v) => typeof v === "string", message: "name must be a string" },
    { validate: (v) => (v as string).length >= 2, message: "name must be at least 2 chars" },
    { validate: (v) => (v as string).length <= 50, message: "name must be at most 50 chars" },
  ],
  age: [
    { validate: (v) => typeof v === "number", message: "age must be a number" },
    { validate: (v) => Number.isInteger(v), message: "age must be an integer" },
    { validate: (v) => (v as number) >= 0, message: "age must be non-negative" },
    { validate: (v) => (v as number) <= 150, message: "age must be at most 150" },
  ],
  email: [
    { validate: (v) => typeof v === "string", message: "email must be a string" },
    { validate: (v) => (v as string).includes("@"), message: "email must contain @" },
    { validate: (v) => (v as string).includes("."), message: "email must contain ." },
  ],
};

function createValidatedUser(initial: UserData): UserData {
  return new Proxy(initial, {
    set(target, prop: string, value: unknown): boolean {
      const rules = RULES[prop as keyof UserData];
      if (rules) {
        for (const rule of rules) {
          if (!rule.validate(value)) {
            throw new Error(`Validation failed: ${rule.message} (got: ${value})`);
          }
        }
      }
      console.log(`[Proxy] Set ${prop} = ${value}`);
      (target as Record<string, unknown>)[prop] = value;
      return true;
    },

    get(target, prop: string): unknown {
      console.log(`[Proxy] Get ${prop}`);
      return (target as Record<string, unknown>)[prop];
    },

    deleteProperty(target, prop: string): boolean {
      throw new Error(`Cannot delete property: ${prop}`);
    },
  });
}

// === Usage Example ===

const user = createValidatedUser({ name: "Taro", age: 30, email: "taro@example.com" });

user.name = "Hanako";   // OK
user.age = 25;           // OK
// user.age = -1;        // Error: age must be non-negative
// user.email = "invalid"; // Error: email must contain @
// delete user.name;     // Error: Cannot delete property: name

console.log(user.name);  // "Hanako"
```

---

### Code Example 5: ES6 Proxy -- Reactive Change Detection (TypeScript)

```typescript
// === Vue.js-style reactive system ===

type Listener = () => void;

function reactive<T extends object>(target: T, onChange: Listener): T {
  const handler: ProxyHandler<T> = {
    set(obj: T, prop: string | symbol, value: unknown): boolean {
      const oldValue = (obj as Record<string | symbol, unknown>)[prop];
      if (oldValue !== value) {
        (obj as Record<string | symbol, unknown>)[prop] = value;
        console.log(`[Reactive] ${String(prop)}: ${String(oldValue)} -> ${String(value)}`);
        onChange();
      }
      return true;
    },

    get(obj: T, prop: string | symbol): unknown {
      const value = (obj as Record<string | symbol, unknown>)[prop];
      // Recursively make nested objects reactive as well
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return reactive(value as object, onChange);
      }
      return value;
    },
  };

  return new Proxy(target, handler);
}

// === Usage Example ===

interface AppState {
  count: number;
  user: {
    name: string;
    settings: {
      theme: string;
    };
  };
}

let renderCount = 0;
const state = reactive<AppState>(
  {
    count: 0,
    user: {
      name: "Taro",
      settings: { theme: "light" },
    },
  },
  () => {
    renderCount++;
    console.log(`[App] Re-render #${renderCount}`);
  },
);

state.count = 1;
// Output: [Reactive] count: 0 -> 1
// Output: [App] Re-render #1

state.user.name = "Hanako";
// Output: [Reactive] name: Taro -> Hanako
// Output: [App] Re-render #2

state.user.settings.theme = "dark";
// Output: [Reactive] theme: light -> dark
// Output: [App] Re-render #3

state.count = 1; // same value → no change → no re-render
```

**Key point**: Vue.js 3's reactive system is based on this ES6 Proxy design. It traps property access and recursively makes nested objects reactive.

---

### Code Example 6: Logging Proxy -- Automatic Method Call Tracing (TypeScript)

```typescript
// === Generic Logging Proxy factory ===

interface LogEntry {
  method: string;
  args: unknown[];
  result?: unknown;
  error?: string;
  durationMs: number;
  timestamp: Date;
}

function createLoggingProxy<T extends object>(
  target: T,
  options: {
    name?: string;
    logArgs?: boolean;
    logResult?: boolean;
    onLog?: (entry: LogEntry) => void;
  } = {},
): T {
  const {
    name = target.constructor.name,
    logArgs = true,
    logResult = false,
    onLog = (entry) => {
      const argsStr = logArgs ? `(${entry.args.map(a => JSON.stringify(a)).join(", ")})` : "(...)";
      const resultStr = logResult && entry.result !== undefined ? ` -> ${JSON.stringify(entry.result)}` : "";
      const errorStr = entry.error ? ` ERROR: ${entry.error}` : "";
      console.log(
        `[${name}] ${entry.method}${argsStr}${resultStr}${errorStr} [${entry.durationMs}ms]`
      );
    },
  } = options;

  return new Proxy(target, {
    get(obj, prop) {
      const value = (obj as Record<string | symbol, unknown>)[prop];
      if (typeof value !== "function") return value;

      return function (this: unknown, ...args: unknown[]) {
        const start = performance.now();
        const entry: LogEntry = {
          method: String(prop),
          args,
          durationMs: 0,
          timestamp: new Date(),
        };

        try {
          const result = (value as Function).apply(obj, args);

          // Detect Promise and trace async methods too
          if (result instanceof Promise) {
            return result
              .then((resolved: unknown) => {
                entry.result = resolved;
                entry.durationMs = Math.round(performance.now() - start);
                onLog(entry);
                return resolved;
              })
              .catch((err: Error) => {
                entry.error = err.message;
                entry.durationMs = Math.round(performance.now() - start);
                onLog(entry);
                throw err;
              });
          }

          entry.result = result;
          entry.durationMs = Math.round(performance.now() - start);
          onLog(entry);
          return result;
        } catch (err) {
          entry.error = (err as Error).message;
          entry.durationMs = Math.round(performance.now() - start);
          onLog(entry);
          throw err;
        }
      };
    },
  });
}

// === Usage Example ===

class UserRepository {
  findById(id: string): User | null {
    return { id, name: `User-${id}`, email: `${id}@example.com` };
  }

  async save(user: User): Promise<void> {
    await new Promise(r => setTimeout(r, 50));
  }

  delete(id: string): void {
    throw new Error("Not implemented");
  }
}

const repo = createLoggingProxy(new UserRepository(), {
  name: "UserRepo",
  logResult: true,
});

repo.findById("42");
// Output: [UserRepo] findById("42") -> {"id":"42","name":"User-42",...} [0ms]

await repo.save({ id: "1", name: "New", email: "new@example.com" });
// Output: [UserRepo] save({"id":"1",...}) [51ms]

try {
  repo.delete("1");
} catch (e) {
  // Output: [UserRepo] delete("1") ERROR: Not implemented [0ms]
}
```

**Key point**: Uses ES6 Proxy to automatically generate a logging Proxy for any object. Supports both synchronous and asynchronous methods, and measures execution time.

---

### Code Example 7: Python -- Dynamic Proxy (`__getattr__`)

```python
from abc import ABC, abstractmethod
import time
import functools
from typing import Any, Callable


# === Subject ===

class Database(ABC):
    @abstractmethod
    def query(self, sql: str) -> list[dict]: ...

    @abstractmethod
    def execute(self, sql: str) -> int: ...


class PostgresDatabase(Database):
    def query(self, sql: str) -> list[dict]:
        time.sleep(0.05)  # Simulate network latency
        print(f"[Postgres] Executing query: {sql}")
        return [{"id": 1, "name": "Taro"}]

    def execute(self, sql: str) -> int:
        time.sleep(0.05)
        print(f"[Postgres] Executing: {sql}")
        return 1  # affected rows


# === Logging Proxy ===

class LoggingProxy:
    """Generic Logging Proxy using __getattr__"""

    def __init__(self, target: Any, name: str = ""):
        self._target = target
        self._name = name or type(target).__name__

    def __getattr__(self, attr: str) -> Any:
        original = getattr(self._target, attr)

        if not callable(original):
            return original

        @functools.wraps(original)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            args_str = ", ".join(
                [repr(a) for a in args] +
                [f"{k}={v!r}" for k, v in kwargs.items()]
            )
            print(f"[{self._name}] {attr}({args_str})")

            start = time.perf_counter()
            try:
                result = original(*args, **kwargs)
                elapsed = (time.perf_counter() - start) * 1000
                print(f"[{self._name}] {attr} -> {result!r} [{elapsed:.1f}ms]")
                return result
            except Exception as e:
                elapsed = (time.perf_counter() - start) * 1000
                print(f"[{self._name}] {attr} ERROR: {e} [{elapsed:.1f}ms]")
                raise

        return wrapper


# === Cache Proxy ===

class CachingProxy:
    """Cache Proxy with TTL"""

    def __init__(self, target: Any, ttl: float = 60.0):
        self._target = target
        self._ttl = ttl
        self._cache: dict[str, tuple[Any, float]] = {}

    def __getattr__(self, attr: str) -> Any:
        original = getattr(self._target, attr)

        if not callable(original):
            return original

        @functools.wraps(original)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = f"{attr}:{args!r}:{kwargs!r}"

            # Cache check
            if key in self._cache:
                result, expiry = self._cache[key]
                if time.time() < expiry:
                    print(f"[Cache] HIT: {key[:50]}")
                    return result
                else:
                    del self._cache[key]
                    print(f"[Cache] EXPIRED: {key[:50]}")

            print(f"[Cache] MISS: {key[:50]}")
            result = original(*args, **kwargs)
            self._cache[key] = (result, time.time() + self._ttl)
            return result

        return wrapper


# === Proxy Chain ===

db: Database = PostgresDatabase()
db = CachingProxy(db, ttl=30.0)   # cache layer
db = LoggingProxy(db, "DB")        # logging layer

# 1st call: cache miss → DB access
result = db.query("SELECT * FROM users")
# Output:
# [DB] query('SELECT * FROM users')
# [Cache] MISS: query:('SELECT * FROM users',):{}
# [Postgres] Executing query: SELECT * FROM users
# [DB] query -> [{'id': 1, 'name': 'Taro'}] [52.3ms]

# 2nd call: cache hit
result = db.query("SELECT * FROM users")
# Output:
# [DB] query('SELECT * FROM users')
# [Cache] HIT: query:('SELECT * FROM users',):{}
# [DB] query -> [{'id': 1, 'name': 'Taro'}] [0.1ms]
```

**Key point**: Using Python's `__getattr__`, the GoF Proxy pattern can be implemented without interfaces. Chaining CachingProxy and LoggingProxy also enables Decorator-style composition.

---

### Code Example 8: Java -- Dynamic Proxy (java.lang.reflect.Proxy)

```java
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.*;

// === Subject Interface ===

interface UserService {
    User findById(String id);
    List<User> findAll();
    void delete(String id);
}

record User(String id, String name, String email) {}

// === RealSubject ===

class UserServiceImpl implements UserService {
    @Override
    public User findById(String id) {
        System.out.println("[UserService] findById: " + id);
        return new User(id, "User-" + id, id + "@example.com");
    }

    @Override
    public List<User> findAll() {
        System.out.println("[UserService] findAll");
        return List.of(
            new User("1", "Alice", "alice@example.com"),
            new User("2", "Bob", "bob@example.com")
        );
    }

    @Override
    public void delete(String id) {
        System.out.println("[UserService] delete: " + id);
    }
}

// === Dynamic Proxy (InvocationHandler) ===

class LoggingHandler implements InvocationHandler {
    private final Object target;

    LoggingHandler(Object target) {
        this.target = target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        String argsStr = args != null ? Arrays.toString(args) : "()";
        System.out.printf("[Log] %s.%s%s%n",
            target.getClass().getSimpleName(), method.getName(), argsStr);

        long start = System.nanoTime();
        try {
            Object result = method.invoke(target, args);
            long elapsed = (System.nanoTime() - start) / 1_000_000;
            System.out.printf("[Log] %s returned in %dms%n", method.getName(), elapsed);
            return result;
        } catch (Exception e) {
            long elapsed = (System.nanoTime() - start) / 1_000_000;
            System.out.printf("[Log] %s FAILED in %dms: %s%n",
                method.getName(), elapsed, e.getMessage());
            throw e.getCause();
        }
    }
}

class CachingHandler implements InvocationHandler {
    private final Object target;
    private final Map<String, Object> cache = new HashMap<>();

    CachingHandler(Object target) {
        this.target = target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // Do not cache void methods
        if (method.getReturnType() == void.class) {
            return method.invoke(target, args);
        }

        String key = method.getName() + ":" + Arrays.toString(args);
        if (cache.containsKey(key)) {
            System.out.println("[Cache] HIT: " + key);
            return cache.get(key);
        }

        System.out.println("[Cache] MISS: " + key);
        Object result = method.invoke(target, args);
        cache.put(key, result);
        return result;
    }
}

// === Dynamic Proxy Factory ===

class ProxyFactory {
    @SuppressWarnings("unchecked")
    static <T> T createLoggingProxy(T target, Class<T> iface) {
        return (T) Proxy.newProxyInstance(
            iface.getClassLoader(),
            new Class[]{iface},
            new LoggingHandler(target)
        );
    }

    @SuppressWarnings("unchecked")
    static <T> T createCachingProxy(T target, Class<T> iface) {
        return (T) Proxy.newProxyInstance(
            iface.getClassLoader(),
            new Class[]{iface},
            new CachingHandler(target)
        );
    }
}

// === Usage Example ===

public class Main {
    public static void main(String[] args) {
        UserService real = new UserServiceImpl();

        // Proxy chain: cache + logging
        UserService cached = ProxyFactory.createCachingProxy(real, UserService.class);
        UserService logged = ProxyFactory.createLoggingProxy(cached, UserService.class);

        logged.findById("42");
        // [Log] $Proxy.findById[42]
        // [Cache] MISS: findById:[42]
        // [UserService] findById: 42
        // [Log] findById returned in 1ms

        logged.findById("42");
        // [Log] $Proxy.findById[42]
        // [Cache] HIT: findById:[42]
        // [Log] findById returned in 0ms
    }
}
```

**Key point**: Java's `java.lang.reflect.Proxy` allows dynamic Proxy generation against interfaces. Spring AOP and Hibernate's lazy loading use the same mechanism.

---

### Code Example 9: Go -- Interface-Based Proxy

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

// === Subject Interface ===

type Storage interface {
    Get(ctx context.Context, key string) (string, error)
    Set(ctx context.Context, key string, value string) error
    Delete(ctx context.Context, key string) error
}

// === RealSubject ===

type RedisStorage struct {
    data map[string]string
    mu   sync.RWMutex
}

func NewRedisStorage() *RedisStorage {
    return &RedisStorage{data: make(map[string]string)}
}

func (r *RedisStorage) Get(ctx context.Context, key string) (string, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    time.Sleep(10 * time.Millisecond) // network latency
    val, ok := r.data[key]
    if !ok {
        return "", fmt.Errorf("key not found: %s", key)
    }
    fmt.Printf("[Redis] GET %s -> %s\n", key, val)
    return val, nil
}

func (r *RedisStorage) Set(ctx context.Context, key string, value string) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    time.Sleep(10 * time.Millisecond)
    r.data[key] = value
    fmt.Printf("[Redis] SET %s = %s\n", key, value)
    return nil
}

func (r *RedisStorage) Delete(ctx context.Context, key string) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    delete(r.data, key)
    fmt.Printf("[Redis] DEL %s\n", key)
    return nil
}

// === Logging Proxy ===

type LoggingStorage struct {
    inner Storage
}

func NewLoggingStorage(inner Storage) *LoggingStorage {
    return &LoggingStorage{inner: inner}
}

func (l *LoggingStorage) Get(ctx context.Context, key string) (string, error) {
    start := time.Now()
    val, err := l.inner.Get(ctx, key)
    elapsed := time.Since(start)
    if err != nil {
        fmt.Printf("[Log] GET %s ERROR: %v [%v]\n", key, err, elapsed)
    } else {
        fmt.Printf("[Log] GET %s -> %s [%v]\n", key, val, elapsed)
    }
    return val, err
}

func (l *LoggingStorage) Set(ctx context.Context, key string, value string) error {
    start := time.Now()
    err := l.inner.Set(ctx, key, value)
    elapsed := time.Since(start)
    fmt.Printf("[Log] SET %s = %s [%v]\n", key, value, elapsed)
    return err
}

func (l *LoggingStorage) Delete(ctx context.Context, key string) error {
    start := time.Now()
    err := l.inner.Delete(ctx, key)
    elapsed := time.Since(start)
    fmt.Printf("[Log] DEL %s [%v]\n", key, elapsed)
    return err
}

// === Circuit Breaker Proxy ===

type CircuitState int

const (
    Closed CircuitState = iota
    Open
    HalfOpen
)

type CircuitBreakerStorage struct {
    inner        Storage
    state        CircuitState
    failures     int
    threshold    int
    resetTimeout time.Duration
    lastFailure  time.Time
    mu           sync.Mutex
}

func NewCircuitBreakerStorage(inner Storage, threshold int, resetTimeout time.Duration) *CircuitBreakerStorage {
    return &CircuitBreakerStorage{
        inner:        inner,
        state:        Closed,
        threshold:    threshold,
        resetTimeout: resetTimeout,
    }
}

func (cb *CircuitBreakerStorage) canExecute() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()

    switch cb.state {
    case Closed:
        return true
    case Open:
        if time.Since(cb.lastFailure) > cb.resetTimeout {
            cb.state = HalfOpen
            fmt.Println("[CB] State: Open -> HalfOpen")
            return true
        }
        return false
    case HalfOpen:
        return true
    }
    return false
}

func (cb *CircuitBreakerStorage) recordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures = 0
    if cb.state == HalfOpen {
        cb.state = Closed
        fmt.Println("[CB] State: HalfOpen -> Closed")
    }
}

func (cb *CircuitBreakerStorage) recordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures++
    cb.lastFailure = time.Now()
    if cb.failures >= cb.threshold {
        cb.state = Open
        fmt.Printf("[CB] State: -> Open (failures: %d)\n", cb.failures)
    }
}

func (cb *CircuitBreakerStorage) Get(ctx context.Context, key string) (string, error) {
    if !cb.canExecute() {
        return "", fmt.Errorf("circuit breaker is OPEN")
    }
    val, err := cb.inner.Get(ctx, key)
    if err != nil {
        cb.recordFailure()
    } else {
        cb.recordSuccess()
    }
    return val, err
}

func (cb *CircuitBreakerStorage) Set(ctx context.Context, key string, value string) error {
    if !cb.canExecute() {
        return fmt.Errorf("circuit breaker is OPEN")
    }
    err := cb.inner.Set(ctx, key, value)
    if err != nil {
        cb.recordFailure()
    } else {
        cb.recordSuccess()
    }
    return err
}

func (cb *CircuitBreakerStorage) Delete(ctx context.Context, key string) error {
    if !cb.canExecute() {
        return fmt.Errorf("circuit breaker is OPEN")
    }
    err := cb.inner.Delete(ctx, key)
    if err != nil {
        cb.recordFailure()
    } else {
        cb.recordSuccess()
    }
    return err
}

// === Usage Example ===

func main() {
    ctx := context.Background()

    // Proxy chain: Redis -> CircuitBreaker -> Logging
    var storage Storage = NewRedisStorage()
    storage = NewCircuitBreakerStorage(storage, 3, 30*time.Second)
    storage = NewLoggingStorage(storage)

    storage.Set(ctx, "user:1", "Alice")
    storage.Get(ctx, "user:1")
}
```

**Key point**: Go's implicit interface implementation makes the Proxy pattern feel natural. The CircuitBreaker is implemented as a Proxy and chained with the Logging Proxy.

---

### Code Example 10: Kotlin -- Property Delegation as Proxy

```kotlin
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

// === Kotlin Property Delegation is the Proxy Pattern ===

class LoggedProperty<T>(
    private var value: T,
    private val name: String,
) : ReadWriteProperty<Any?, T> {

    override fun getValue(thisRef: Any?, property: KProperty<*>): T {
        println("[Log] Reading $name = $value")
        return value
    }

    override fun setValue(thisRef: Any?, property: KProperty<*>, value: T) {
        val old = this.value
        this.value = value
        println("[Log] Writing $name: $old -> $value")
    }
}

class ValidatedProperty<T>(
    private var value: T,
    private val validator: (T) -> Boolean,
    private val errorMessage: String,
) : ReadWriteProperty<Any?, T> {

    override fun getValue(thisRef: Any?, property: KProperty<*>): T = value

    override fun setValue(thisRef: Any?, property: KProperty<*>, value: T) {
        if (!validator(value)) {
            throw IllegalArgumentException("$errorMessage (got: $value)")
        }
        this.value = value
    }
}

// === LazyProxy: Virtual Proxy as Property Delegate ===

class LazyProxy<T>(
    private val factory: () -> T,
) : ReadWriteProperty<Any?, T> {
    private var instance: T? = null
    private var overridden = false
    private var overriddenValue: T? = null

    override fun getValue(thisRef: Any?, property: KProperty<*>): T {
        if (overridden) {
            @Suppress("UNCHECKED_CAST")
            return overriddenValue as T
        }
        if (instance == null) {
            println("[LazyProxy] Creating ${property.name}")
            instance = factory()
        }
        return instance!!
    }

    override fun setValue(thisRef: Any?, property: KProperty<*>, value: T) {
        overridden = true
        overriddenValue = value
    }
}

// === Usage Example ===

class UserProfile {
    var name: String by LoggedProperty("", "name")
    var age: Int by ValidatedProperty(0, { it in 0..150 }, "Age must be 0-150")
    var email: String by ValidatedProperty("", { "@" in it }, "Invalid email")

    // Lazy loading of a heavy resource
    var avatar: ByteArray by LazyProxy {
        println("[LazyProxy] Loading avatar from storage...")
        ByteArray(1_000_000) // 1MB
    }
}

fun main() {
    val profile = UserProfile()

    profile.name = "Taro"
    // [Log] Writing name:  -> Taro

    println(profile.name)
    // [Log] Reading name = Taro
    // Taro

    profile.age = 25  // OK
    // profile.age = -1 // IllegalArgumentException

    profile.email = "taro@example.com" // OK
    // profile.email = "invalid" // IllegalArgumentException

    // avatar is not loaded until accessed
    println("Profile created, avatar not loaded yet")
    val size = profile.avatar.size
    // [LazyProxy] Creating avatar
    // [LazyProxy] Loading avatar from storage...
    println("Avatar size: $size")
}
```

**Key point**: Kotlin's `by` keyword (Property Delegation) is native support for the Proxy pattern. `LoggedProperty`, `ValidatedProperty`, and `LazyProxy` all function as Proxies.

---

## 4. Comparison Tables

### Comparison Table 1: Proxy vs Decorator vs Adapter

| Aspect | Proxy | Decorator | Adapter |
|------|-------|-----------|---------|
| **Purpose** | Access control | Adding functionality | Interface conversion |
| **Interface** | Same | Same | Different |
| **Lifecycle management** | Yes (lazy creation, etc.) | No | No |
| **Client awareness** | Transparent | Transparent | Intentional |
| **Typical responsibilities** | Auth, caching, lazy loading | Logging, compression, encryption | API conversion |
| **RealSubject creation** | Can be managed by Proxy | Passed from outside | Passed from outside |
| **Structure** | 1:1 | N:1 (stack) | 1:1 |

### Comparison Table 2: Proxy Types and Use Cases

| Type | Use Case | Performance Impact | Complexity | Implementation Cost |
|------|-------------|:-:|:-:|:-:|
| **Virtual** | Lazy loading of heavy resources | Delay on first access only | Low | Low |
| **Protection** | RBAC / authentication guard | Minimal | Medium | Medium |
| **Cache** | Memoization of API/DB results | Significant improvement | High | High |
| **Remote** | RPC/gRPC calls | Network-dependent | High | High |
| **Logging** | Audit logs / metrics | Minimal | Low | Low |
| **Smart Ref** | Reference counting / change notification | Minimal | Medium | Medium |

### Comparison Table 3: GoF Proxy vs ES6 Proxy

| Aspect | GoF Proxy (class-based) | ES6 Proxy (metaprogramming) |
|------|--------------------------|-------------------------------|
| **Implementation** | Implements the same interface | Intercepts via handler object traps |
| **Target** | Method calls | Property access, assignment, deletion, enumeration, etc. |
| **Type safety** | High (interface-compliant) | Low (close to any) |
| **Trap targets** | Methods only | 13 types of traps (get, set, has, etc.) |
| **Use case** | Design patterns | Metaprogramming, reactive systems |
| **Performance** | Good | Overhead per property access |
| **Example** | `ImageProxy implements Image` | `new Proxy(target, handler)` |

---

## 5. Anti-Patterns

### Anti-Pattern 1: Tight Coupling Between Proxy and RealSubject

```typescript
// BAD: Proxy directly depends on a concrete class and instantiates it with new
class BadProxy {
  private real = new SpecificDatabaseService("localhost", 5432); // direct new

  query(sql: string): Result {
    console.log("Logging:", sql);
    return this.real.query(sql); // no interface
  }
}

// Problems:
// 1. Cannot swap out SpecificDatabaseService
// 2. Cannot replace with a mock in tests
// 3. Proxy must know the constructor arguments of RealSubject
```

```typescript
// GOOD: Depend via interface, inject with DI

interface DatabaseService {
  query(sql: string): Result;
}

class LoggingProxy implements DatabaseService {
  constructor(private real: DatabaseService) {} // DI

  query(sql: string): Result {
    console.log("Logging:", sql);
    return this.real.query(sql);
  }
}

// Testing
const mockDb: DatabaseService = { query: jest.fn() };
const proxy = new LoggingProxy(mockDb);
```

**Guideline**: If there is a `new RealSubject()` inside a Proxy, it is a warning sign of tight coupling (Virtual Proxy is an exception).

---

### Anti-Pattern 2: God Proxy (Multiple Responsibilities in One Proxy)

```typescript
// BAD: One Proxy handles cache + auth + logging + rate limiting
class GodProxy implements Service {
  private cache = new Map();
  private requestCount = 0;

  doSomething(args: unknown): Result {
    // Auth check
    if (!this.currentUser.isAdmin) throw new Error("Access denied");

    // Rate limiting
    this.requestCount++;
    if (this.requestCount > 100) throw new Error("Rate limited");

    // Caching
    const key = JSON.stringify(args);
    if (this.cache.has(key)) return this.cache.get(key);

    // Logging
    console.log(`[${new Date().toISOString()}] doSomething called`);

    // Execution
    const result = this.real.doSomething(args);
    this.cache.set(key, result);
    return result;
  }
}

// Problems:
// 1. SRP violation: 4 responsibilities mixed together
// 2. Hard to test (all responsibilities must be tested together)
// 3. Cannot change the combination of responsibilities
```

```typescript
// GOOD: Separate Proxies per responsibility, then chain them

class AuthProxy implements Service {
  constructor(private real: Service, private user: User) {}
  doSomething(args: unknown): Result {
    if (!this.user.isAdmin) throw new Error("Access denied");
    return this.real.doSomething(args);
  }
}

class RateLimitProxy implements Service {
  private count = 0;
  constructor(private real: Service, private limit: number) {}
  doSomething(args: unknown): Result {
    if (++this.count > this.limit) throw new Error("Rate limited");
    return this.real.doSomething(args);
  }
}

class CacheProxy implements Service {
  private cache = new Map();
  constructor(private real: Service) {}
  doSomething(args: unknown): Result {
    const key = JSON.stringify(args);
    if (this.cache.has(key)) return this.cache.get(key);
    const result = this.real.doSomething(args);
    this.cache.set(key, result);
    return result;
  }
}

class LogProxy implements Service {
  constructor(private real: Service) {}
  doSomething(args: unknown): Result {
    console.log(`[${new Date().toISOString()}] doSomething called`);
    return this.real.doSomething(args);
  }
}

// Chain: Auth -> RateLimit -> Cache -> Log -> Real
const service: Service =
  new AuthProxy(
    new RateLimitProxy(
      new CacheProxy(
        new LogProxy(realService),
      ),
      100,
    ),
    currentUser,
  );
```

**Guideline**: 1 Proxy = 1 responsibility. If there are multiple responsibilities, compose them with a chain.

---

### Anti-Pattern 3: Unnecessary Proxy (YAGNI Violation)

```typescript
// BAD: A Proxy that provides no added value
class UselessProxy implements Service {
  constructor(private real: Service) {}

  doSomething(args: unknown): Result {
    return this.real.doSomething(args); // pure delegation
  }
}

// Problems:
// 1. Only adds indirection complexity
// 2. Deeper stack traces during debugging
// 3. Performance overhead (minor but unnecessary)
```

**Guideline**: Before introducing a Proxy, clarify "what is being controlled." If there is nothing to control, a Proxy is unnecessary.

---

## 6. Edge Cases and Caveats

### 6.1 ES6 Proxy Performance

```typescript
// ES6 Proxy traps are called on every property access,
// so be careful when using them in hot paths

// BAD: ES6 Proxy inside a hot loop
const proxied = new Proxy(array, handler);
for (let i = 0; i < 1_000_000; i++) {
  proxied[i]; // get trap is called every iteration
}

// GOOD: Direct access in hot paths, Proxy only for external APIs
const raw = array;
for (let i = 0; i < 1_000_000; i++) {
  raw[i]; // direct access
}
```

### 6.2 Proxy Transparency and Debugging

```typescript
// ES6 Proxy is indistinguishable from RealSubject with typeof, instanceof
const target = { x: 1 };
const proxy = new Proxy(target, {});

console.log(typeof proxy);           // "object" (same as target)
console.log(proxy instanceof Object); // true
console.log(proxy === target);        // false (different reference)

// Adding metadata to indicate it is a Proxy helps during debugging
const debugProxy = new Proxy(target, {
  get(obj, prop) {
    if (prop === Symbol.for("isProxy")) return true;
    return Reflect.get(obj, prop);
  },
});
```

### 6.3 Cache Proxy Invalidation Strategies

```
┌──────────────────────────────────────────────────────────┐
│          Cache Invalidation Strategy Selection            │
│                                                          │
│  ┌─────────────┬─────────────────────────────────────┐  │
│  │ TTL         │ Automatically expires after a set time│ │
│  │             │ Simple but freshness is limited       │  │
│  ├─────────────┼─────────────────────────────────────┤  │
│  │ Event-based │ Explicitly invalidated on data change │ │
│  │             │ Accurate but complex to implement     │  │
│  ├─────────────┼─────────────────────────────────────┤  │
│  │ LRU         │ Evicts oldest entry when capacity full│ │
│  │             │ Effective for memory constraints      │  │
│  ├─────────────┼─────────────────────────────────────┤  │
│  │ Write-through│ Updates cache on every write        │  │
│  │             │ High consistency but slow writes      │  │
│  ├─────────────┼─────────────────────────────────────┤  │
│  │ Stale-while │ Returns stale value while             │  │
│  │ -revalidate │ updating in the background           │  │
│  │             │ High availability                    │  │
│  └─────────────┴─────────────────────────────────────┘  │
│                                                          │
│  Recommendation: Start with a simple TTL + LRU           │
│  combination, then add Event-based if needed.            │
└──────────────────────────────────────────────────────────┘
```

### 6.4 Thread-Safe Proxy

```typescript
// Not an issue in browsers, but cache Proxies in
// Node.js Worker Threads or multithreaded environments require locking

class ThreadSafeCacheProxy implements Service {
  private cache = new Map();
  private locks = new Map<string, Promise<void>>();

  async doSomething(key: string): Promise<Result> {
    // Prevent concurrent requests for the same key
    if (this.locks.has(key)) {
      await this.locks.get(key);
      const cached = this.cache.get(key);
      if (cached) return cached;
    }

    let resolve: () => void;
    this.locks.set(key, new Promise(r => { resolve = r; }));

    try {
      const result = await this.real.doSomething(key);
      this.cache.set(key, result);
      return result;
    } finally {
      resolve!();
      this.locks.delete(key);
    }
  }
}
```

---

## 7. Trade-off Analysis

### When to Use

| Situation | Recommended Proxy Type | Reason |
|------|----------------|------|
| Image gallery (many images) | Virtual | Memory savings, reduced initialization cost |
| Multi-tenant API | Protection | Per-tenant access control |
| External API calls | Cache + Logging | Cost reduction, debuggability |
| Microservice communication | Remote + Circuit Breaker | Prevent failure propagation |
| Systems with audit requirements | Logging | Compliance support |

### When Not to Use

| Situation | Reason |
|------|------|
| Simple direct call is sufficient | YAGNI: unnecessary indirection |
| Inner processing in a hot path | Performance overhead |
| No cross-cutting concerns | Proxy adds no value |
| AOP framework is available | No need to manually implement Proxy |

### The Cost of Proxy

```
┌──────────────────────────────────────────────────────────┐
│                 Proxy Cost Analysis                       │
│                                                          │
│  Benefits                    Drawbacks                   │
│  ┌──────────────────────┐    ┌──────────────────────┐    │
│  │ + Separation of cross-│   │ - Added indirection  │    │
│  │   cutting concerns   │    │ - More complex debug │    │
│  │ + OCP compliance     │    │ - God Proxy risk     │    │
│  │ + Lazy initialization│    │ - ES6 Proxy          │    │
│  │ + Testability        │    │   performance        │    │
│  │ + Transparent        │    │ - Cache consistency  │    │
│  │ + Composable         │    │   management         │    │
│  │   (chainable)        │    │                      │    │
│  └──────────────────────┘    └──────────────────────┘    │
│                                                          │
│  Guideline: Consider Proxy when cross-cutting concerns   │
│  (auth, caching, logging) are mixed into business logic. │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Exercises

### Exercise 1: Basic -- Virtual Proxy (Difficulty: ★☆☆)

Implement a Virtual Proxy for the following `ExpensiveReport` class.

```typescript
interface Report {
  getTitle(): string;
  generate(): string;
}

class ExpensiveReport implements Report {
  private data: string;

  constructor(private title: string) {
    // Heavy initialization (DB queries, aggregation, etc.)
    console.log(`[Report] Generating "${title}" (takes 3 seconds)...`);
    this.data = `Report data for "${title}" with 10000 rows`;
  }

  getTitle(): string {
    return this.title;
  }

  generate(): string {
    return this.data;
  }
}

// TODO: Implement ReportProxy
// - getTitle() returns without creating the RealSubject
// - generate() creates the RealSubject only on first access
```

**Expected output**:

```
Creating 3 report proxies...
(no loading happens yet)

Getting title: Monthly Sales
(still no loading)

Generating report:
[Report] Generating "Monthly Sales" (takes 3 seconds)...
Report data for "Monthly Sales" with 10000 rows
```

<details>
<summary>Sample Solution (click to expand)</summary>

```typescript
class ReportProxy implements Report {
  private real: ExpensiveReport | null = null;

  constructor(private title: string) {
    console.log(`[Proxy] Created proxy for "${title}"`);
  }

  getTitle(): string {
    // Title is known by Proxy, so no RealSubject needed
    return this.title;
  }

  generate(): string {
    if (!this.real) {
      this.real = new ExpensiveReport(this.title);
    }
    return this.real.generate();
  }
}

// Test
console.log("Creating 3 report proxies...");
const reports: Report[] = [
  new ReportProxy("Monthly Sales"),
  new ReportProxy("Weekly Users"),
  new ReportProxy("Daily Revenue"),
];
console.log("(no loading happens yet)\n");

console.log(`Getting title: ${reports[0].getTitle()}`);
console.log("(still no loading)\n");

console.log("Generating report:");
console.log(reports[0].generate());
// [Report] Generating "Monthly Sales" (takes 3 seconds)...
// Report data for "Monthly Sales" with 10000 rows
```

</details>

---

### Exercise 2: Applied -- Protection + Logging Proxy Chain (Difficulty: ★★☆)

Implement a Proxy chain that satisfies the following requirements.

**Requirements**:
1. Create a Protection Proxy and a Logging Proxy for the `FileService` interface
2. Protection Proxy: forbid `delete` for any role other than `"admin"`
3. Logging Proxy: log all method calls with a `[LOG]` prefix
4. Chain order: Client -> Logging -> Protection -> RealSubject

```typescript
interface FileService {
  read(path: string): string;
  write(path: string, content: string): void;
  delete(path: string): void;
}

interface User {
  name: string;
  role: "viewer" | "editor" | "admin";
}
```

**Expected output (admin user)**:

```
[LOG] read("/data/file.txt")
[File] Reading /data/file.txt
[LOG] delete("/data/old.txt")
[Auth] admin access granted for delete
[File] Deleting /data/old.txt
```

**Expected output (viewer user)**:

```
[LOG] read("/data/file.txt")
[File] Reading /data/file.txt
[LOG] delete("/data/old.txt")
[Auth] Access denied: viewer cannot delete
Error: Access denied
```

<details>
<summary>Sample Solution (click to expand)</summary>

```typescript
class RealFileService implements FileService {
  read(path: string): string {
    console.log(`[File] Reading ${path}`);
    return `content of ${path}`;
  }
  write(path: string, content: string): void {
    console.log(`[File] Writing ${path}`);
  }
  delete(path: string): void {
    console.log(`[File] Deleting ${path}`);
  }
}

class ProtectionProxy implements FileService {
  constructor(
    private real: FileService,
    private user: User,
  ) {}

  read(path: string): string {
    return this.real.read(path); // all roles allowed
  }

  write(path: string, content: string): void {
    if (this.user.role === "viewer") {
      console.log(`[Auth] Access denied: ${this.user.role} cannot write`);
      throw new Error("Access denied");
    }
    return this.real.write(path, content);
  }

  delete(path: string): void {
    if (this.user.role !== "admin") {
      console.log(`[Auth] Access denied: ${this.user.role} cannot delete`);
      throw new Error("Access denied");
    }
    console.log(`[Auth] ${this.user.role} access granted for delete`);
    this.real.delete(path);
  }
}

class LoggingProxy implements FileService {
  constructor(private real: FileService) {}

  read(path: string): string {
    console.log(`[LOG] read("${path}")`);
    return this.real.read(path);
  }

  write(path: string, content: string): void {
    console.log(`[LOG] write("${path}", "${content.substring(0, 20)}...")`);
    this.real.write(path, content);
  }

  delete(path: string): void {
    console.log(`[LOG] delete("${path}")`);
    this.real.delete(path);
  }
}

// Build chain
function createFileService(user: User): FileService {
  const real = new RealFileService();
  const protected_ = new ProtectionProxy(real, user);
  const logged = new LoggingProxy(protected_);
  return logged;
}

// Admin test
const adminFs = createFileService({ name: "Alice", role: "admin" });
adminFs.read("/data/file.txt");
adminFs.delete("/data/old.txt");

// Viewer test
const viewerFs = createFileService({ name: "Bob", role: "viewer" });
viewerFs.read("/data/file.txt");
try {
  viewerFs.delete("/data/old.txt");
} catch (e) {
  console.log(`Error: ${(e as Error).message}`);
}
```

</details>

---

### Exercise 3: Advanced -- Generic Proxy Factory (Difficulty: ★★★)

Using ES6 Proxy, implement a generic factory that automatically adds the following features to any object.

**Requirements**:
1. `createSmartProxy<T>(target, options)` factory function
2. `options.cache`: if true, cache method call results for the same arguments
3. `options.log`: if true, log method calls
4. `options.readonly`: if true, forbid property `set` and `delete`
5. `options.onAccess`: callback on property access
6. Support both synchronous and asynchronous methods

```typescript
interface SmartProxyOptions {
  cache?: boolean;
  log?: boolean;
  readonly?: boolean;
  onAccess?: (prop: string) => void;
}

function createSmartProxy<T extends object>(
  target: T,
  options: SmartProxyOptions,
): T {
  // TODO: implement
}
```

**Expected output**:

```typescript
const obj = createSmartProxy(
  {
    greet(name: string) { return `Hello, ${name}!`; },
    value: 42,
  },
  { cache: true, log: true, readonly: true },
);

obj.greet("World");
// [Log] greet("World") -> "Hello, World!" [0ms]
// "Hello, World!"

obj.greet("World"); // 2nd call: cache hit
// [Cache] HIT: greet:["World"]
// "Hello, World!"

obj.value = 100; // Error: Cannot modify readonly proxy
```

<details>
<summary>Sample Solution (click to expand)</summary>

```typescript
function createSmartProxy<T extends object>(
  target: T,
  options: SmartProxyOptions = {},
): T {
  const cache = new Map<string, unknown>();

  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);

      // onAccess callback
      if (options.onAccess && typeof prop === "string") {
        options.onAccess(prop);
      }

      // Return non-methods as-is
      if (typeof value !== "function") return value;

      // Wrap method
      return function (this: unknown, ...args: unknown[]) {
        const methodName = String(prop);

        // Cache check
        if (options.cache) {
          const key = `${methodName}:${JSON.stringify(args)}`;
          if (cache.has(key)) {
            console.log(`[Cache] HIT: ${key}`);
            return cache.get(key);
          }
        }

        // Execute
        const start = performance.now();
        const result = (value as Function).apply(obj, args);

        // If Promise
        if (result instanceof Promise) {
          return result.then((resolved: unknown) => {
            const elapsed = Math.round(performance.now() - start);
            if (options.log) {
              console.log(`[Log] ${methodName}(${args.map(a => JSON.stringify(a)).join(", ")}) -> ${JSON.stringify(resolved)} [${elapsed}ms]`);
            }
            if (options.cache) {
              cache.set(`${methodName}:${JSON.stringify(args)}`, resolved);
            }
            return resolved;
          });
        }

        // Synchronous case
        const elapsed = Math.round(performance.now() - start);
        if (options.log) {
          console.log(`[Log] ${methodName}(${args.map(a => JSON.stringify(a)).join(", ")}) -> ${JSON.stringify(result)} [${elapsed}ms]`);
        }
        if (options.cache) {
          cache.set(`${methodName}:${JSON.stringify(args)}`, result);
        }
        return result;
      };
    },

    set(obj, prop, value) {
      if (options.readonly) {
        throw new Error(`Cannot modify readonly proxy (property: ${String(prop)})`);
      }
      return Reflect.set(obj, prop, value);
    },

    deleteProperty(obj, prop) {
      if (options.readonly) {
        throw new Error(`Cannot delete from readonly proxy (property: ${String(prop)})`);
      }
      return Reflect.deleteProperty(obj, prop);
    },
  });
}

// Test
const calculator = createSmartProxy(
  {
    add(a: number, b: number) { return a + b; },
    async fetchData(id: string) {
      await new Promise(r => setTimeout(r, 50));
      return { id, data: "result" };
    },
    value: 42,
  },
  { cache: true, log: true, readonly: true },
);

console.log(calculator.add(1, 2));
// [Log] add(1, 2) -> 3 [0ms]
// 3

console.log(calculator.add(1, 2)); // cache hit
// [Cache] HIT: add:[1,2]
// 3

const data = await calculator.fetchData("abc");
// [Log] fetchData("abc") -> {"id":"abc","data":"result"} [51ms]

try {
  calculator.value = 100;
} catch (e) {
  console.log((e as Error).message);
  // Cannot modify readonly proxy (property: value)
}
```

</details>

---

## 9. FAQ

### Q1: Is the JavaScript Proxy object the same as the GoF Proxy pattern?

The essence is the same, but the level of abstraction differs. The GoF Proxy creates a "proxy class with the same interface" in a class-based approach. ES6 Proxy is a metaprogramming mechanism that can intercept any object operation through 13 types of traps (get, set, has, deleteProperty, apply, construct, etc.). All GoF Proxy patterns (Virtual, Protection, Cache, Logging) can be implemented with ES6 Proxy, but not vice versa (ES6 Proxy's property traps are concepts not found in GoF).

### Q2: Does Proxy affect performance?

It depends on what the Proxy layer does. A GoF-style class Proxy with simple delegation has virtually zero overhead. ES6 Proxy handlers are called on every property access, so caution is needed in hot paths (more than 1 million accesses per second). V8 engine benchmarks show that property access via ES6 Proxy can be 5-10x slower than direct access.

### Q3: How should cache Proxy invalidation be handled?

"Cache invalidation is one of the hardest problems in computer science." Introduce it incrementally in the following order:

1. **TTL (time-based)**: Simplest. Automatically expires after 60 seconds
2. **TTL + LRU**: Add LRU if there are memory constraints
3. **Event-based**: Explicitly invalidate on data update events (when needed)
4. **Stale-while-revalidate**: When high availability is required

### Q4: What is the relationship between Proxy and AOP (Aspect-Oriented Programming)?

Proxy pattern is a manual implementation of AOP weaving (the weaving-in of cross-cutting concerns). Spring AOP and AspectJ use the Proxy pattern internally. If your framework supports AOP, manual Proxy is unnecessary.

### Q5: Is React's Suspense a Virtual Proxy?

Yes, conceptually it is a form of Virtual Proxy. `React.lazy()` lazily loads components and shows the Suspense fallback until loading is complete. This is the same characteristic as Virtual Proxy's "don't create RealSubject until needed."

### Q6: How should the order of a Proxy chain be decided?

Keeping in mind that chains are evaluated from the outermost layer, the following order is recommended:

```
Client
  -> Logging (record all accesses)
    -> Rate Limiting (restrict early)
      -> Authentication (auth check)
        -> Caching (speed up with cache)
          -> RealSubject
```

Reason: Logging should be at the outermost layer to record all requests. Rate limiting should come before auth to reject early. Caching should be innermost to target only authenticated requests.

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world development?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| **Purpose** | A surrogate object that controls access to another object |
| **Essence** | Same interface + transparent access control |
| **Main Types** | Virtual, Protection, Cache, Remote, Logging, Smart Reference |
| **GoF vs ES6** | GoF is class-based, ES6 is metaprogramming |
| **Benefits** | Separation of cross-cutting concerns, lazy initialization, OCP compliance |
| **Chaining** | 1 Proxy = 1 responsibility, compose with chains |
| **Caveats** | ES6 Proxy performance, cache invalidation |
| **Testing** | Inject RealSubject via DI, replaceable with mocks |

---

## Guides to Read Next

- [Decorator Pattern](./01-decorator.md) -- Dynamic feature addition (understand the difference from Proxy)
- [Facade Pattern](./02-facade.md) -- Simplifying subsystems
- [Adapter Pattern](./00-adapter.md) -- Interface conversion
- [Composite Pattern](./04-composite.md) -- Unified operations on tree structures
- [Observer Pattern](../02-behavioral/00-observer.md) -- Reactive change notification
- [Caching Strategy](../../../system-design-guide/docs/01-components/01-caching.md) -- System-level cache design

---

## References

1. Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
2. MDN Web Docs -- Proxy. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
3. MDN Web Docs -- Reflect. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect
4. Refactoring.Guru -- Proxy. https://refactoring.guru/design-patterns/proxy
5. Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly Media.
6. Rauschmayer, A. (2015). *Exploring ES6*. Chapter 28: Metaprogramming with Proxies. https://exploringjs.com/es6/ch_proxies.html
