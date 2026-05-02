# TypeScript DI (Dependency Injection) Patterns Complete Guide

> Centered around inversify, tsyringe, and NestJS — achieving type-safe DI containers and interface-based loosely coupled design in TypeScript

## What You Will Learn

1. **DI Fundamentals** -- How to practice the Dependency Inversion Principle (DIP) and Inversion of Control (IoC) in TypeScript
2. **DI Containers** -- Automatic resolution, lifecycle management, and scope configuration using inversify / tsyringe / NestJS
3. **Testability** -- Techniques for easily swapping in mocks during testing and speeding up unit tests with DI
4. **Detecting and Resolving Circular Dependencies** -- Practical approaches and tools
5. **Performance Optimization** -- Real-world examples and benchmarks for production environments
6. **Functional Approach** -- DI with Reader Monad and Effect-ts


## Prerequisites

Before reading this guide, the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [TypeScript Branded Types Complete Guide](./03-branded-types.md)

---

## Table of Contents

1. [DI Fundamentals and SOLID-D](#1-di-fundamentals-and-solid-d)
2. [Manual DI (Pure DI)](#2-manual-dipure-di)
3. [DI with InversifyJS](#3-di-with-inversifyjs)
4. [Lightweight DI with tsyringe](#4-lightweight-di-with-tsyringe)
5. [NestJS DI System](#5-nestjs-di-system)
6. [DI Without a DI Container](#6-di-without-a-di-container)
7. [Testability and Mock Injection](#7-testability-and-mock-injection)
8. [Detecting and Resolving Circular Dependencies](#8-detecting-and-resolving-circular-dependencies)
9. [Performance Comparison and Production Examples](#9-performance-comparison-and-production-examples)
10. [Anti-Patterns](#10-anti-patterns)
11. [Edge Case Analysis](#11-edge-case-analysis)
12. [Exercises](#12-exercises)
13. [FAQ](#13-faq)
14. [References](#14-references)

---

## 1. DI Fundamentals and SOLID-D

### 1-1. Dependency Inversion Principle

The "D" in SOLID states that high-level modules (business logic) should not depend on low-level modules (infrastructure implementations); both should depend on abstractions (interfaces).

```
■ Before DIP (concrete dependency)

  +------------+        +------------+
  | UserService|------->| PostgresDB |
  +------------+        +------------+
  High-level             Low-level
  (Business Logic)      (Infrastructure)

  UserService directly depends on PostgresDB
  → Changing the DB requires changes to UserService
  → Requires the actual DB during testing

■ After DIP (abstract dependency)

  +------------+        +-----------+
  | UserService|------->| IDatabase |  ← Abstraction (interface)
  +------------+        +-----------+
                             ↑
                     +-------+--------+
                     |                |
               +----------+    +----------+
               |PostgresDB|    | MockDB   |
               +----------+    +----------+
               Production       Testing

  UserService depends on the abstraction
  → Easy to swap implementations
  → Can inject mocks during testing
```

### 1-2. Inversion of Control

In traditional design, application code creates its own dependency objects (via `new`). With IoC, an external container or framework creates the dependencies and injects them into the application.

```typescript
// Traditional design (control on the application side)
class UserService {
  private userRepo: IUserRepository;

  constructor() {
    // Creates its own dependency
    this.userRepo = new PostgresUserRepository();
  }
}

// After applying IoC (control on the container side)
class UserService {
  constructor(
    private readonly userRepo: IUserRepository // injected by the container
  ) {}
}

// The container resolves and injects UserService's dependencies
const userService = container.resolve(UserService);
```

### 1-3. Why DI Matters in TypeScript

TypeScript's type system pairs very well with the DI pattern.

```typescript
// TypeScript's type system guarantees dependencies
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

interface IEmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown): void;
}

// Constructor injection (the most basic form of DI)
class UserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly logger: ILogger
  ) {}

  async createUser(data: CreateUserDto): Promise<User> {
    this.logger.info("Creating user", { email: data.email });

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);
    await this.emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}`
    );

    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    await this.userRepo.delete(id);
    await this.emailService.send(
      user.email,
      "Account Deleted",
      `Goodbye ${user.name}`
    );

    this.logger.info("User deleted", { id });
  }
}
```

**Benefits of TypeScript + DI:**

1. **Type safety**: Dependency types are verified at compile time
2. **Refactoring support**: IDEs track interface changes
3. **Auto-completion**: Dependency methods are auto-completed
4. **Documentation**: Interfaces clearly define contracts

---

## 2. Manual DI (Pure DI)

For small-scale projects or when you want to avoid library dependencies, manual dependency injection is the simplest and most type-safe approach.

### 2-1. Constructor Injection

```typescript
// Domain layer (type definitions)
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface CreateUserDto {
  name: string;
  email: string;
}

// Abstractions (interfaces)
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

interface IEmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

// Implementations (infrastructure layer)
class PostgresUserRepository implements IUserRepository {
  constructor(private readonly connectionString: string) {}

  async findById(id: string): Promise<User | null> {
    // Actual DB query
    console.log(`SELECT * FROM users WHERE id = '${id}'`);
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    console.log(`SELECT * FROM users WHERE email = '${email}'`);
    return null;
  }

  async save(user: User): Promise<void> {
    console.log(`INSERT INTO users VALUES (...)`, user);
  }

  async delete(id: string): Promise<void> {
    console.log(`DELETE FROM users WHERE id = '${id}'`);
  }
}

class SmtpEmailService implements IEmailService {
  constructor(private readonly smtpUrl: string) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    console.log(`Sending email to ${to}: ${subject}`);
    // Actual SMTP sending
  }
}

class ConsoleLogger implements ILogger {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, meta);
  }

  error(message: string, error?: unknown): void {
    console.error(`[ERROR] ${message}`, error);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, meta);
  }
}

// Service layer (business logic)
class UserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly logger: ILogger
  ) {}

  async createUser(data: CreateUserDto): Promise<User> {
    this.logger.info("Creating user", { email: data.email });

    // Business rule: duplicate check
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);
    await this.emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}, welcome to our service!`
    );

    this.logger.info("User created successfully", { userId: user.id });
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    await this.userRepo.delete(id);
    await this.emailService.send(
      user.email,
      "Account Deleted",
      `Goodbye ${user.name}, your account has been deleted.`
    );

    this.logger.info("User deleted", { id });
  }
}

// Manual wiring (Composition Root)
function createApp() {
  // Load configuration from environment variables
  const databaseUrl = process.env.DATABASE_URL || "postgres://localhost/mydb";
  const smtpUrl = process.env.SMTP_URL || "smtp://localhost";

  // Create infrastructure layer instances
  const logger = new ConsoleLogger();
  const userRepo = new PostgresUserRepository(databaseUrl);
  const emailService = new SmtpEmailService(smtpUrl);

  // Create service layer instances (injecting dependencies)
  const userService = new UserService(userRepo, emailService, logger);

  return { userService };
}

// Application entry point
const app = createApp();

// Usage example
app.userService.createUser({
  name: "Alice",
  email: "alice@example.com",
});
```

### 2-2. Function Injection

```typescript
// Inject functions as dependencies
type GenerateId = () => string;
type GetCurrentTime = () => Date;

class OrderService {
  constructor(
    private readonly generateId: GenerateId,
    private readonly getCurrentTime: GetCurrentTime,
    private readonly logger: ILogger
  ) {}

  createOrder(userId: string, items: OrderItem[]): Order {
    const order: Order = {
      id: this.generateId(), // Uses the injected function
      userId,
      items,
      createdAt: this.getCurrentTime(), // Uses the injected function
      status: "pending",
    };

    this.logger.info("Order created", { orderId: order.id });
    return order;
  }
}

// Production environment
const orderService = new OrderService(
  () => crypto.randomUUID(), // Actual UUID generation
  () => new Date(), // Actual current time
  new ConsoleLogger()
);

// Test environment
const testOrderService = new OrderService(
  () => "test-id-123", // Fixed ID
  () => new Date("2024-01-01"), // Fixed time
  new MockLogger()
);
```

### 2-3. Combining with the Factory Pattern

```typescript
// Inject a factory as a dependency
interface IUserRepositoryFactory {
  create(connectionString: string): IUserRepository;
}

class PostgresUserRepositoryFactory implements IUserRepositoryFactory {
  create(connectionString: string): IUserRepository {
    return new PostgresUserRepository(connectionString);
  }
}

class MultiTenantUserService {
  constructor(
    private readonly repoFactory: IUserRepositoryFactory,
    private readonly emailService: IEmailService,
    private readonly logger: ILogger
  ) {}

  async createUserForTenant(
    tenantId: string,
    data: CreateUserDto
  ): Promise<User> {
    // Use a different DB connection per tenant
    const connectionString = `postgres://localhost/${tenantId}`;
    const userRepo = this.repoFactory.create(connectionString);

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await userRepo.save(user);
    await this.emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}`
    );

    this.logger.info("User created for tenant", { tenantId, userId: user.id });
    return user;
  }
}
```

---

## 3. DI with InversifyJS

InversifyJS is a powerful DI container for TypeScript that provides decorator-based declarative dependency management.

### 3-1. Basic Setup

```typescript
// inversify requires reflect-metadata
import "reflect-metadata";
import { Container, injectable, inject, interfaces } from "inversify";

// Define tokens with Symbols (prevents string collisions)
const TYPES = {
  UserRepository: Symbol.for("UserRepository"),
  OrderRepository: Symbol.for("OrderRepository"),
  EmailService: Symbol.for("EmailService"),
  Logger: Symbol.for("Logger"),
  Database: Symbol.for("Database"),
  UserService: Symbol.for("UserService"),
  OrderService: Symbol.for("OrderService"),
} as const;

// Add @injectable decorator to implementation classes
@injectable()
class PostgresDatabase {
  constructor() {
    console.log("PostgresDatabase initialized");
  }

  async query(sql: string): Promise<any[]> {
    console.log(`Executing: ${sql}`);
    return [];
  }

  async close(): Promise<void> {
    console.log("Database connection closed");
  }
}

@injectable()
class PostgresUserRepository implements IUserRepository {
  constructor(
    @inject(TYPES.Database) private readonly db: PostgresDatabase
  ) {}

  async findById(id: string): Promise<User | null> {
    const results = await this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
    return results[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const results = await this.db.query(`SELECT * FROM users WHERE email = '${email}'`);
    return results[0] || null;
  }

  async save(user: User): Promise<void> {
    await this.db.query(`INSERT INTO users VALUES (...)`);
  }

  async delete(id: string): Promise<void> {
    await this.db.query(`DELETE FROM users WHERE id = '${id}'`);
  }
}

@injectable()
class PostgresOrderRepository {
  constructor(
    @inject(TYPES.Database) private readonly db: PostgresDatabase
  ) {}

  async findById(id: string): Promise<Order | null> {
    const results = await this.db.query(`SELECT * FROM orders WHERE id = '${id}'`);
    return results[0] || null;
  }

  async save(order: Order): Promise<void> {
    await this.db.query(`INSERT INTO orders VALUES (...)`);
  }
}

@injectable()
class SmtpEmailService implements IEmailService {
  async send(to: string, subject: string, body: string): Promise<void> {
    console.log(`Sending email to ${to}: ${subject}`);
  }
}

@injectable()
class ConsoleLogger implements ILogger {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, meta);
  }

  error(message: string, error?: unknown): void {
    console.error(`[ERROR] ${message}`, error);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, meta);
  }
}

// Declare dependencies with @inject on service classes
@injectable()
class UserService {
  constructor(
    @inject(TYPES.UserRepository) private readonly userRepo: IUserRepository,
    @inject(TYPES.EmailService) private readonly emailService: IEmailService,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {}

  async createUser(data: CreateUserDto): Promise<User> {
    this.logger.info("Creating user", { email: data.email });

    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);
    await this.emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}`
    );

    this.logger.info("User created", { userId: user.id });
    return user;
  }
}

@injectable()
class OrderService {
  constructor(
    @inject(TYPES.OrderRepository) private readonly orderRepo: PostgresOrderRepository,
    @inject(TYPES.UserRepository) private readonly userRepo: IUserRepository,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {}

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const order: Order = {
      id: crypto.randomUUID(),
      userId,
      items,
      createdAt: new Date(),
      status: "pending",
    };

    await this.orderRepo.save(order);
    this.logger.info("Order created", { orderId: order.id });
    return order;
  }
}
```

### 3-2. Container Configuration and Scopes

```
inversify container resolution flow:

  container.get(TYPES.UserService)
       |
       v
  +------------------+
  | Analyze           |
  | UserService deps  |
  +------------------+
       |
  +----+----+--------+
  |         |        |
  v         v        v
 UserRepo EmailSvc Logger
  |         |        |
  v         v        v
Database  (new)   (singleton)
(singleton)
```

```typescript
// Container configuration
const container = new Container();

// Singleton scope (one instance per application)
container
  .bind<PostgresDatabase>(TYPES.Database)
  .to(PostgresDatabase)
  .inSingletonScope();

container
  .bind<ILogger>(TYPES.Logger)
  .to(ConsoleLogger)
  .inSingletonScope();

container
  .bind<IUserRepository>(TYPES.UserRepository)
  .to(PostgresUserRepository)
  .inSingletonScope();

container
  .bind<PostgresOrderRepository>(TYPES.OrderRepository)
  .to(PostgresOrderRepository)
  .inSingletonScope();

// Transient scope (new instance every time)
container
  .bind<IEmailService>(TYPES.EmailService)
  .to(SmtpEmailService)
  .inTransientScope(); // Created anew each time

// Request scope (one instance per request)
container
  .bind<UserService>(TYPES.UserService)
  .to(UserService)
  .inRequestScope(); // Created anew per request

container
  .bind<OrderService>(TYPES.OrderService)
  .to(OrderService);

// Resolution
const userService = container.get<UserService>(TYPES.UserService);
const orderService = container.get<OrderService>(TYPES.OrderService);

// All dependencies are automatically injected
await userService.createUser({
  name: "Bob",
  email: "bob@example.com",
});
```

### 3-3. Module Splitting

For large-scale projects, split container bindings into modules.

```typescript
import { ContainerModule, interfaces } from "inversify";

// Infrastructure layer module
const infrastructureModule = new ContainerModule((bind: interfaces.Bind) => {
  bind<ILogger>(TYPES.Logger)
    .to(ConsoleLogger)
    .inSingletonScope();

  bind<PostgresDatabase>(TYPES.Database)
    .to(PostgresDatabase)
    .inSingletonScope();
});

// Repository layer module
const repositoryModule = new ContainerModule((bind: interfaces.Bind) => {
  bind<IUserRepository>(TYPES.UserRepository)
    .to(PostgresUserRepository)
    .inSingletonScope();

  bind<PostgresOrderRepository>(TYPES.OrderRepository)
    .to(PostgresOrderRepository)
    .inSingletonScope();
});

// Service layer module
const serviceModule = new ContainerModule((bind: interfaces.Bind) => {
  bind<IEmailService>(TYPES.EmailService)
    .to(SmtpEmailService)
    .inTransientScope();

  bind<UserService>(TYPES.UserService)
    .to(UserService);

  bind<OrderService>(TYPES.OrderService)
    .to(OrderService);
});

// Load modules into the container
const container = new Container();
container.load(
  infrastructureModule,
  repositoryModule,
  serviceModule
);

export { container };
```

### 3-4. Conditional Bindings

```typescript
// Switch implementations based on the environment
const container = new Container();

if (process.env.NODE_ENV === "production") {
  container
    .bind<ILogger>(TYPES.Logger)
    .to(CloudWatchLogger)
    .inSingletonScope();
} else if (process.env.NODE_ENV === "test") {
  container
    .bind<ILogger>(TYPES.Logger)
    .to(MockLogger)
    .inSingletonScope();
} else {
  container
    .bind<ILogger>(TYPES.Logger)
    .to(ConsoleLogger)
    .inSingletonScope();
}

// Named bindings
container
  .bind<IUserRepository>(TYPES.UserRepository)
  .to(PostgresUserRepository)
  .whenTargetNamed("postgres");

container
  .bind<IUserRepository>(TYPES.UserRepository)
  .to(MongoUserRepository)
  .whenTargetNamed("mongo");

// Specify by name at usage
@injectable()
class MultiDbService {
  constructor(
    @inject(TYPES.UserRepository) @named("postgres")
    private readonly pgRepo: IUserRepository,

    @inject(TYPES.UserRepository) @named("mongo")
    private readonly mongoRepo: IUserRepository
  ) {}
}
```

### 3-5. Factory Bindings

```typescript
// Customize instance creation with a factory function
container
  .bind<IUserRepository>(TYPES.UserRepository)
  .toFactory<IUserRepository>((context: interfaces.Context) => {
    return (tenantId: string) => {
      const db = context.container.get<PostgresDatabase>(TYPES.Database);
      return new TenantUserRepository(db, tenantId);
    };
  });

// Usage example
const userRepoFactory = container.get<(tenantId: string) => IUserRepository>(
  TYPES.UserRepository
);
const tenant1Repo = userRepoFactory("tenant-1");
const tenant2Repo = userRepoFactory("tenant-2");
```

---

## 4. Lightweight DI with tsyringe

tsyringe is a lightweight DI container developed by Microsoft that offers a simpler API than inversify.

### 4-1. Basic Setup

```typescript
import "reflect-metadata";
import { container, injectable, inject, singleton, scoped, Lifecycle } from "tsyringe";

// tsyringe allows using class tokens directly
@singleton()
class ConfigService {
  get(key: string): string {
    return process.env[key] ?? "";
  }
}

@singleton()
class DatabaseConnection {
  constructor(private readonly config: ConfigService) {
    const url = this.config.get("DATABASE_URL");
    console.log(`Connecting to database: ${url}`);
  }

  async query(sql: string): Promise<any[]> {
    console.log(`Query: ${sql}`);
    return [];
  }
}

@singleton()
class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: DatabaseConnection) {}

  async findById(id: string): Promise<User | null> {
    await this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    await this.db.query(`SELECT * FROM users WHERE email = '${email}'`);
    return null;
  }

  async save(user: User): Promise<void> {
    await this.db.query(`INSERT INTO users VALUES (...)`);
  }

  async delete(id: string): Promise<void> {
    await this.db.query(`DELETE FROM users WHERE id = '${id}'`);
  }
}

// Interface token (for abstractions)
const IEmailServiceToken = Symbol("IEmailService");

@injectable()
class SmtpEmailService implements IEmailService {
  constructor(private readonly config: ConfigService) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    const smtpUrl = this.config.get("SMTP_URL");
    console.log(`Sending via ${smtpUrl} to ${to}: ${subject}`);
  }
}

// Register with a token
container.register<IEmailService>(IEmailServiceToken, {
  useClass: SmtpEmailService,
});

@injectable()
class UserService {
  constructor(
    private readonly userRepo: PostgresUserRepository, // Direct class reference
    @inject(IEmailServiceToken) private readonly emailService: IEmailService, // Token reference
    private readonly config: ConfigService
  ) {}

  async createUser(data: CreateUserDto): Promise<User> {
    console.log("Creating user:", data.email);

    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);
    await this.emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}`
    );

    return user;
  }
}

// Resolution
const userService = container.resolve(UserService);
await userService.createUser({
  name: "Charlie",
  email: "charlie@example.com",
});
```

### 4-2. Lifecycle and Scopes

```typescript
import { Lifecycle, scoped, injectable } from "tsyringe";

// Singleton (default)
@singleton()
class AppConfig {
  readonly version = "1.0.0";
}

// Transient (new instance each time)
@injectable()
class RequestLogger {
  private readonly requestId = crypto.randomUUID();

  log(message: string) {
    console.log(`[${this.requestId}] ${message}`);
  }
}

// Lifecycle control with scope
@scoped(Lifecycle.ContainerScoped)
class RequestContext {
  constructor(public readonly requestId: string) {}
}

// Specify lifecycle via manual registration
container.register("DatabasePool", DatabaseConnection, {
  lifecycle: Lifecycle.Singleton,
});

container.register("RequestHandler", RequestHandler, {
  lifecycle: Lifecycle.Transient,
});
```

### 4-3. Factories and Custom Providers

```typescript
// Factory registration
container.register("DatabaseConnection", {
  useFactory: (c) => {
    const config = c.resolve(ConfigService);
    const url = config.get("DATABASE_URL");
    return new DatabaseConnection(url);
  },
});

// Value registration
container.register("API_KEY", {
  useValue: process.env.API_KEY,
});

container.register("APP_VERSION", {
  useValue: "1.0.0",
});

// Usage example
@injectable()
class ApiClient {
  constructor(@inject("API_KEY") private readonly apiKey: string) {}

  async fetch(endpoint: string) {
    console.log(`Fetching ${endpoint} with key ${this.apiKey}`);
  }
}
```

### 4-4. Child Containers (Request Scope)

```typescript
import { container as rootContainer } from "tsyringe";

// HTTP request handler
async function handleRequest(req: Request, res: Response) {
  // Create a child container per request
  const requestContainer = rootContainer.createChildContainer();

  // Register request-specific values
  requestContainer.register("RequestId", {
    useValue: crypto.randomUUID(),
  });

  requestContainer.register("UserId", {
    useValue: req.headers["x-user-id"],
  });

  // Resolve services from the request container
  const userService = requestContainer.resolve(UserService);

  // Handle request
  const result = await userService.createUser({
    name: req.body.name,
    email: req.body.email,
  });

  res.json(result);

  // Dispose child container (release resources)
  requestContainer.dispose();
}
```

### 4-5. Lazy Injection

```typescript
import { inject, delay, injectable } from "tsyringe";

// A class with heavy initialization
@singleton()
class HeavyService {
  constructor() {
    console.log("HeavyService initializing... (expensive)");
    // Heavy initialization work
  }

  process(): string {
    return "processed";
  }
}

@injectable()
class OptimizedService {
  constructor(
    // Lazy injection: HeavyService is not initialized until actually used
    @inject(delay(() => HeavyService))
    private readonly heavyServiceFactory: () => HeavyService
  ) {
    console.log("OptimizedService created (HeavyService not yet initialized)");
  }

  async doSomething() {
    console.log("Doing lightweight work...");

    // Initialize when needed
    const heavyService = this.heavyServiceFactory();
    return heavyService.process();
  }
}

const service = container.resolve(OptimizedService);
// HeavyService has not been initialized at this point

await service.doSomething();
// HeavyService is initialized here for the first time
```

---

## 5. NestJS DI System

NestJS is a TypeScript framework that provides an Angular-like DI system.

### 5-1. Module / Provider / Inject Basics

```typescript
import { Module, Injectable, Inject } from "@nestjs/common";

// Provider (a class managed by DI)
@Injectable()
class ConfigService {
  get(key: string): string {
    return process.env[key] ?? "";
  }
}

@Injectable()
class DatabaseService {
  constructor(private readonly config: ConfigService) {
    const url = this.config.get("DATABASE_URL");
    console.log(`Database initialized: ${url}`);
  }

  async query(sql: string): Promise<any[]> {
    console.log(`Query: ${sql}`);
    return [];
  }
}

@Injectable()
class UserRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(id: string): Promise<User | null> {
    await this.db.query(`SELECT * FROM users WHERE id = '${id}'`);
    return null;
  }

  async save(user: User): Promise<void> {
    await this.db.query(`INSERT INTO users VALUES (...)`);
  }
}

@Injectable()
class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async createUser(data: CreateUserDto): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);
    return user;
  }
}

// Module (groups Providers)
@Module({
  providers: [ConfigService, DatabaseService, UserRepository, UserService],
  exports: [UserService], // Export so other modules can use it
})
class UserModule {}
```

### 5-2. Custom Providers

```typescript
import { Module, Provider } from "@nestjs/common";

// Value provider
const configProvider: Provider = {
  provide: "APP_CONFIG",
  useValue: {
    apiKey: process.env.API_KEY,
    appName: "MyApp",
    version: "1.0.0",
  },
};

// Factory provider
const databaseProvider: Provider = {
  provide: "DATABASE_CONNECTION",
  useFactory: (config: ConfigService) => {
    const url = config.get("DATABASE_URL");
    return new DatabaseConnection(url);
  },
  inject: [ConfigService], // Factory dependencies
};

// Class provider (alias)
const loggerProvider: Provider = {
  provide: "ILogger",
  useClass: process.env.NODE_ENV === "production"
    ? CloudWatchLogger
    : ConsoleLogger,
};

// Existing provider (alias)
const userRepoProvider: Provider = {
  provide: "IUserRepository",
  useExisting: UserRepository,
};

@Module({
  providers: [
    ConfigService,
    configProvider,
    databaseProvider,
    loggerProvider,
    UserRepository,
    userRepoProvider,
  ],
})
class AppModule {}

// Usage example
@Injectable()
class SomeService {
  constructor(
    @Inject("APP_CONFIG") private readonly config: any,
    @Inject("DATABASE_CONNECTION") private readonly db: DatabaseConnection,
    @Inject("ILogger") private readonly logger: ILogger,
    @Inject("IUserRepository") private readonly userRepo: UserRepository
  ) {}
}
```

### 5-3. Global Modules and Dynamic Modules

```typescript
import { Module, Global, DynamicModule } from "@nestjs/common";

// Global module (available in all modules)
@Global()
@Module({
  providers: [ConfigService, LoggerService],
  exports: [ConfigService, LoggerService],
})
class CoreModule {}

// Dynamic module (change providers based on configuration)
@Module({})
class DatabaseModule {
  static forRoot(options: DatabaseOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: "DATABASE_OPTIONS",
          useValue: options,
        },
        {
          provide: DatabaseService,
          useFactory: (opts: DatabaseOptions) => {
            return new DatabaseService(opts);
          },
          inject: ["DATABASE_OPTIONS"],
        },
      ],
      exports: [DatabaseService],
    };
  }

  static forFeature(entities: any[]): DynamicModule {
    const providers = entities.map((entity) => ({
      provide: `${entity.name}Repository`,
      useFactory: (db: DatabaseService) => {
        return new Repository(db, entity);
      },
      inject: [DatabaseService],
    }));

    return {
      module: DatabaseModule,
      providers,
      exports: providers,
    };
  }
}

// Usage example
@Module({
  imports: [
    CoreModule,
    DatabaseModule.forRoot({
      host: "localhost",
      port: 5432,
      database: "mydb",
    }),
    DatabaseModule.forFeature([User, Order]),
  ],
})
class AppModule {}
```

### 5-4. Request Scope and Injection Scope

```typescript
import { Injectable, Scope, Inject } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Request } from "express";

// Request scope (new instance per request)
@Injectable({ scope: Scope.REQUEST })
class RequestScopedService {
  constructor(
    @Inject(REQUEST) private readonly request: Request
  ) {
    console.log(`RequestScopedService created for ${request.url}`);
  }

  getRequestId(): string {
    return this.request.headers["x-request-id"] as string;
  }
}

// Transient scope (new instance each time it is injected)
@Injectable({ scope: Scope.TRANSIENT })
class TransientService {
  private readonly instanceId = crypto.randomUUID();

  getInstanceId(): string {
    return this.instanceId;
  }
}

// Default scope (singleton)
@Injectable() // scope: Scope.DEFAULT
class SingletonService {
  private readonly createdAt = new Date();

  getCreatedAt(): Date {
    return this.createdAt;
  }
}
```

---

## 6. DI Without a DI Container

You can also achieve dependency injection using functional programming patterns without a DI container.

### 6-1. Reader Monad Pattern

```typescript
// Reader Monad: propagate dependencies as an "environment"
type Reader<Env, A> = (env: Env) => A;

// Dependency definitions
interface Dependencies {
  userRepo: IUserRepository;
  emailService: IEmailService;
  logger: ILogger;
}

// Functions returning a Reader Monad
function createUser(data: CreateUserDto): Reader<Dependencies, Promise<User>> {
  return async (deps) => {
    deps.logger.info("Creating user", { email: data.email });

    const existing = await deps.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await deps.userRepo.save(user);
    await deps.emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}`
    );

    deps.logger.info("User created", { userId: user.id });
    return user;
  };
}

function deleteUser(id: string): Reader<Dependencies, Promise<void>> {
  return async (deps) => {
    const user = await deps.userRepo.findById(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    await deps.userRepo.delete(id);
    await deps.emailService.send(
      user.email,
      "Account Deleted",
      `Goodbye ${user.name}`
    );

    deps.logger.info("User deleted", { id });
  };
}

// Usage example
const deps: Dependencies = {
  userRepo: new PostgresUserRepository("postgres://localhost/mydb"),
  emailService: new SmtpEmailService("smtp://localhost"),
  logger: new ConsoleLogger(),
};

// Execute the Reader (inject dependencies)
const userReader = createUser({
  name: "David",
  email: "david@example.com",
});
const user = await userReader(deps);

const deleteReader = deleteUser(user.id);
await deleteReader(deps);
```

### 6-2. DI with Effect-ts

Effect-ts is a library providing type-safe side-effect management and DI.

```typescript
import { Effect, Context, Layer } from "effect";

// Service definitions (using Context)
class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  {
    findById: (id: string) => Effect.Effect<never, Error, User | null>;
    save: (user: User) => Effect.Effect<never, Error, void>;
  }
>() {}

class EmailService extends Context.Tag("EmailService")<
  EmailService,
  {
    send: (to: string, subject: string, body: string) => Effect.Effect<never, Error, void>;
  }
>() {}

class Logger extends Context.Tag("Logger")<
  Logger,
  {
    info: (message: string, meta?: Record<string, unknown>) => Effect.Effect<never, never, void>;
    error: (message: string, error?: unknown) => Effect.Effect<never, never, void>;
  }
>() {}

// Business logic (returns an Effect)
function createUser(data: CreateUserDto) {
  return Effect.gen(function* (_) {
    const userRepo = yield* _(UserRepository);
    const emailService = yield* _(EmailService);
    const logger = yield* _(Logger);

    yield* _(logger.info("Creating user", { email: data.email }));

    const existing = yield* _(userRepo.findById(data.email));
    if (existing) {
      return yield* _(Effect.fail(new Error(`User ${data.email} exists`)));
    }

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    yield* _(userRepo.save(user));
    yield* _(emailService.send(user.email, "Welcome!", `Hello ${user.name}`));
    yield* _(logger.info("User created", { userId: user.id }));

    return user;
  });
}

// Implementation Layer (provides implementations for dependencies)
const UserRepositoryLive = Layer.succeed(
  UserRepository,
  {
    findById: (id: string) =>
      Effect.sync(() => {
        console.log(`Finding user ${id}`);
        return null;
      }),
    save: (user: User) =>
      Effect.sync(() => {
        console.log(`Saving user ${user.id}`);
      }),
  }
);

const EmailServiceLive = Layer.succeed(
  EmailService,
  {
    send: (to: string, subject: string, body: string) =>
      Effect.sync(() => {
        console.log(`Sending email to ${to}: ${subject}`);
      }),
  }
);

const LoggerLive = Layer.succeed(
  Logger,
  {
    info: (message: string, meta?: Record<string, unknown>) =>
      Effect.sync(() => {
        console.log(`[INFO] ${message}`, meta);
      }),
    error: (message: string, error?: unknown) =>
      Effect.sync(() => {
        console.error(`[ERROR] ${message}`, error);
      }),
  }
);

// Compose Layers
const AppLayer = Layer.mergeAll(
  UserRepositoryLive,
  EmailServiceLive,
  LoggerLive
);

// Run the Effect
const program = createUser({
  name: "Eve",
  email: "eve@example.com",
});

const runnable = Effect.provide(program, AppLayer);
await Effect.runPromise(runnable);
```

### 6-3. DI via Function Composition

```typescript
// Inject dependencies using higher-order functions
type WithDependencies<T> = (deps: Dependencies) => T;

// Compose functions that carry dependencies
function compose<A, B, C>(
  f: (b: B) => C,
  g: (a: A) => B
): (a: A) => C {
  return (a) => f(g(a));
}

// Compose functions with dependencies
function composeWithDeps<A, B, C>(
  f: WithDependencies<(b: B) => Promise<C>>,
  g: WithDependencies<(a: A) => Promise<B>>
): WithDependencies<(a: A) => Promise<C>> {
  return (deps) => async (a) => {
    const gWithDeps = g(deps);
    const fWithDeps = f(deps);
    const b = await gWithDeps(a);
    return fWithDeps(b);
  };
}

// Usage example
const validateUser: WithDependencies<(data: CreateUserDto) => Promise<CreateUserDto>> =
  (deps) => async (data) => {
    deps.logger.info("Validating user", { email: data.email });
    const existing = await deps.userRepo.findByEmail(data.email);
    if (existing) {
      throw new Error(`User ${data.email} already exists`);
    }
    return data;
  };

const persistUser: WithDependencies<(data: CreateUserDto) => Promise<User>> =
  (deps) => async (data) => {
    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };
    await deps.userRepo.save(user);
    return user;
  };

const sendWelcomeEmail: WithDependencies<(user: User) => Promise<User>> =
  (deps) => async (user) => {
    await deps.emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}`
    );
    return user;
  };

// Compose the functions
const createUserPipeline = (deps: Dependencies) =>
  compose(
    compose(sendWelcomeEmail(deps), persistUser(deps)),
    validateUser(deps)
  );

// Execute
const deps: Dependencies = {
  userRepo: new PostgresUserRepository("postgres://localhost/mydb"),
  emailService: new SmtpEmailService("smtp://localhost"),
  logger: new ConsoleLogger(),
};

const pipeline = createUserPipeline(deps);
const user = await pipeline({
  name: "Frank",
  email: "frank@example.com",
});
```

---

## 7. Testability and Mock Injection

The greatest benefit of DI is the ability to easily swap in mocks for dependencies during testing.

### 7-1. Mock Injection with Manual DI

```typescript
// Mock implementations
class MockUserRepository implements IUserRepository {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  // Test helpers
  clear() {
    this.users.clear();
  }

  getAll(): User[] {
    return Array.from(this.users.values());
  }
}

class MockEmailService implements IEmailService {
  sentEmails: Array<{ to: string; subject: string; body: string }> = [];

  async send(to: string, subject: string, body: string): Promise<void> {
    this.sentEmails.push({ to, subject, body });
  }

  // Test helpers
  clear() {
    this.sentEmails = [];
  }

  getSentTo(email: string) {
    return this.sentEmails.filter((e) => e.to === email);
  }
}

class MockLogger implements ILogger {
  logs: Array<{ level: string; message: string; meta?: any }> = [];

  info(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "info", message, meta });
  }

  error(message: string, error?: unknown): void {
    this.logs.push({ level: "error", message, meta: error });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "warn", message, meta });
  }

  clear() {
    this.logs = [];
  }

  hasLog(level: string, message: string): boolean {
    return this.logs.some(
      (log) => log.level === level && log.message.includes(message)
    );
  }
}

// Test code
import { describe, it, expect, beforeEach } from "vitest";

describe("UserService", () => {
  let userService: UserService;
  let mockUserRepo: MockUserRepository;
  let mockEmailService: MockEmailService;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockUserRepo = new MockUserRepository();
    mockEmailService = new MockEmailService();
    mockLogger = new MockLogger();

    // Inject mocks
    userService = new UserService(
      mockUserRepo,
      mockEmailService,
      mockLogger
    );
  });

  it("should create user and send welcome email", async () => {
    const userData: CreateUserDto = {
      name: "Test User",
      email: "test@example.com",
    };

    const user = await userService.createUser(userData);

    // Verify the user was saved
    expect(user.id).toBeDefined();
    expect(user.name).toBe("Test User");
    expect(user.email).toBe("test@example.com");

    const savedUser = await mockUserRepo.findById(user.id);
    expect(savedUser).toEqual(user);

    // Verify the email was sent
    expect(mockEmailService.sentEmails).toHaveLength(1);
    expect(mockEmailService.sentEmails[0].to).toBe("test@example.com");
    expect(mockEmailService.sentEmails[0].subject).toBe("Welcome!");

    // Verify the logs were recorded
    expect(mockLogger.hasLog("info", "Creating user")).toBe(true);
    expect(mockLogger.hasLog("info", "User created")).toBe(true);
  });

  it("should throw error if user already exists", async () => {
    // Set up an existing user
    const existingUser: User = {
      id: "existing-id",
      name: "Existing User",
      email: "existing@example.com",
      createdAt: new Date(),
    };
    await mockUserRepo.save(existingUser);

    const userData: CreateUserDto = {
      name: "New User",
      email: "existing@example.com", // Same email
    };

    await expect(userService.createUser(userData)).rejects.toThrow(
      "User with email existing@example.com already exists"
    );

    // Verify no email was sent
    expect(mockEmailService.sentEmails).toHaveLength(0);
  });

  it("should delete user and send goodbye email", async () => {
    // Create a user
    const user: User = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
      createdAt: new Date(),
    };
    await mockUserRepo.save(user);

    await userService.deleteUser(user.id);

    // Verify the user was deleted
    const deletedUser = await mockUserRepo.findById(user.id);
    expect(deletedUser).toBeNull();

    // Verify the email was sent
    expect(mockEmailService.sentEmails).toHaveLength(1);
    expect(mockEmailService.sentEmails[0].to).toBe("test@example.com");
    expect(mockEmailService.sentEmails[0].subject).toBe("Account Deleted");

    // Verify the log was recorded
    expect(mockLogger.hasLog("info", "User deleted")).toBe(true);
  });
});
```

### 7-2. Mock Injection with inversify

```typescript
import { Container } from "inversify";

// Test container
function createTestContainer(): Container {
  const container = new Container();

  // Register mocks
  container
    .bind<IUserRepository>(TYPES.UserRepository)
    .toConstantValue(new MockUserRepository());

  container
    .bind<IEmailService>(TYPES.EmailService)
    .toConstantValue(new MockEmailService());

  container
    .bind<ILogger>(TYPES.Logger)
    .toConstantValue(new MockLogger());

  container
    .bind<UserService>(TYPES.UserService)
    .to(UserService);

  return container;
}

// Test code
describe("UserService with inversify", () => {
  let container: Container;
  let userService: UserService;
  let mockUserRepo: MockUserRepository;
  let mockEmailService: MockEmailService;

  beforeEach(() => {
    container = createTestContainer();
    userService = container.get<UserService>(TYPES.UserService);
    mockUserRepo = container.get<IUserRepository>(TYPES.UserRepository) as MockUserRepository;
    mockEmailService = container.get<IEmailService>(TYPES.EmailService) as MockEmailService;
  });

  it("should create user", async () => {
    const user = await userService.createUser({
      name: "Test",
      email: "test@example.com",
    });

    expect(mockUserRepo.getAll()).toHaveLength(1);
    expect(mockEmailService.sentEmails).toHaveLength(1);
  });
});
```

### 7-3. Mock Injection with tsyringe

```typescript
import { container } from "tsyringe";

describe("UserService with tsyringe", () => {
  let userService: UserService;
  let mockUserRepo: MockUserRepository;
  let mockEmailService: MockEmailService;

  beforeEach(() => {
    // Reset the container
    container.clearInstances();

    // Register mocks
    mockUserRepo = new MockUserRepository();
    mockEmailService = new MockEmailService();

    container.registerInstance(PostgresUserRepository, mockUserRepo as any);
    container.registerInstance(IEmailServiceToken, mockEmailService);

    userService = container.resolve(UserService);
  });

  afterEach(() => {
    container.reset();
  });

  it("should create user", async () => {
    const user = await userService.createUser({
      name: "Test",
      email: "test@example.com",
    });

    expect(mockUserRepo.getAll()).toHaveLength(1);
    expect(mockEmailService.sentEmails).toHaveLength(1);
  });
});
```

### 7-4. Types of Test Doubles

```typescript
// 1. Dummy: only fills in an argument, never actually used
class DummyLogger implements ILogger {
  info() {}
  error() {}
  warn() {}
}

// 2. Stub: returns fixed values
class StubUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return {
      id,
      name: "Stub User",
      email: "stub@example.com",
      createdAt: new Date("2024-01-01"),
    };
  }

  async findByEmail(): Promise<User | null> {
    return null;
  }

  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

// 3. Spy: records calls
class SpyEmailService implements IEmailService {
  callCount = 0;
  lastCall?: { to: string; subject: string; body: string };

  async send(to: string, subject: string, body: string): Promise<void> {
    this.callCount++;
    this.lastCall = { to, subject, body };
  }
}

// 4. Mock: verifies expectations
class MockEmailService implements IEmailService {
  private expectedCalls: Array<{ to: string; subject: string }> = [];
  private actualCalls: Array<{ to: string; subject: string; body: string }> = [];

  expectSend(to: string, subject: string) {
    this.expectedCalls.push({ to, subject });
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    this.actualCalls.push({ to, subject, body });
  }

  verify() {
    expect(this.actualCalls.length).toBe(this.expectedCalls.length);
    for (let i = 0; i < this.expectedCalls.length; i++) {
      expect(this.actualCalls[i].to).toBe(this.expectedCalls[i].to);
      expect(this.actualCalls[i].subject).toBe(this.expectedCalls[i].subject);
    }
  }
}

// 5. Fake: simplified implementation
class FakeUserRepository implements IUserRepository {
  private users = new Map<string, User>();
  private emailIndex = new Map<string, string>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const id = this.emailIndex.get(email);
    return id ? this.users.get(id) || null : null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);
  }

  async delete(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.emailIndex.delete(user.email);
      this.users.delete(id);
    }
  }
}
```

---

## 8. Detecting and Resolving Circular Dependencies

Circular dependencies are one of the most troublesome problems in DI systems.

### 8-1. Example of a Circular Dependency

```typescript
// NG: circular dependency
@injectable()
class UserService {
  constructor(
    @inject(TYPES.OrderService) private orderService: OrderService
  ) {}

  async getUserOrders(userId: string) {
    return this.orderService.getOrdersByUser(userId);
  }
}

@injectable()
class OrderService {
  constructor(
    @inject(TYPES.UserService) private userService: UserService
  ) {}

  async getOrdersByUser(userId: string) {
    const user = await this.userService.getUser(userId);
    // ... fetch orders
  }
}

// Error: Circular dependency detected
```

### 8-2. Diagram of a Circular Dependency

```
Structure of a circular dependency:

  UserService
       |
       | depends on
       v
  OrderService
       |
       | depends on
       v
  UserService  ← Circular!
       |
       v
  (infinite loop)

Types of solutions:

1. Interface segregation
   UserService → IOrderQuery (read-only)
   OrderService → IUserQuery (read-only)

2. Event-driven
   UserService → Event Bus ← OrderService

3. Introduce an intermediate service
   UserService → QueryService ← OrderService
```

### 8-3. Solution 1: Interface Segregation

```typescript
// Separate read-only interfaces
interface IOrderQuery {
  getOrdersByUser(userId: string): Promise<Order[]>;
}

interface IUserQuery {
  getUser(userId: string): Promise<User | null>;
}

// UserService depends only on IOrderQuery
@injectable()
class UserService implements IUserQuery {
  constructor(
    @inject(TYPES.UserRepository) private userRepo: IUserRepository,
    @inject(TYPES.OrderQuery) private orderQuery: IOrderQuery
  ) {}

  async getUser(userId: string): Promise<User | null> {
    return this.userRepo.findById(userId);
  }

  async getUserWithOrders(userId: string) {
    const user = await this.getUser(userId);
    if (!user) return null;

    const orders = await this.orderQuery.getOrdersByUser(userId);
    return { ...user, orders };
  }
}

// OrderService depends only on IUserQuery
@injectable()
class OrderService implements IOrderQuery {
  constructor(
    @inject(TYPES.OrderRepository) private orderRepo: IOrderRepository,
    @inject(TYPES.UserQuery) private userQuery: IUserQuery
  ) {}

  async getOrdersByUser(userId: string): Promise<Order[]> {
    const user = await this.userQuery.getUser(userId);
    if (!user) throw new Error("User not found");

    return this.orderRepo.findByUserId(userId);
  }
}

// Bindings
container.bind<IUserQuery>(TYPES.UserQuery).to(UserService);
container.bind<IOrderQuery>(TYPES.OrderQuery).to(OrderService);
container.bind<UserService>(TYPES.UserService).to(UserService);
container.bind<OrderService>(TYPES.OrderService).to(OrderService);
```

### 8-4. Solution 2: Event-Driven Architecture

```typescript
// Decouple using an event bus
interface DomainEvent {
  type: string;
  timestamp: Date;
  data: any;
}

interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}

@injectable()
class EventBus implements IEventBus {
  private handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(handlers.map((handler) => handler(event)));
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }
}

// UserService publishes events to the EventBus
@injectable()
class UserService {
  constructor(
    @inject(TYPES.UserRepository) private userRepo: IUserRepository,
    @inject(TYPES.EventBus) private eventBus: IEventBus
  ) {}

  async createUser(data: CreateUserDto): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);

    // Publish event (no direct dependency on OrderService)
    await this.eventBus.publish({
      type: "UserCreated",
      timestamp: new Date(),
      data: { userId: user.id, email: user.email },
    });

    return user;
  }
}

// OrderService subscribes to events
@injectable()
class OrderService {
  constructor(
    @inject(TYPES.OrderRepository) private orderRepo: IOrderRepository,
    @inject(TYPES.EventBus) private eventBus: IEventBus
  ) {
    // Register event handler
    this.eventBus.subscribe("UserCreated", async (event) => {
      console.log("User created, initializing order history", event.data);
      // Initialize order history
    });
  }

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    const order: Order = {
      id: crypto.randomUUID(),
      userId,
      items,
      createdAt: new Date(),
      status: "pending",
    };

    await this.orderRepo.save(order);

    // Publish event
    await this.eventBus.publish({
      type: "OrderCreated",
      timestamp: new Date(),
      data: { orderId: order.id, userId },
    });

    return order;
  }
}
```

### 8-5. Solution 3: Introduce an Intermediate Service

```typescript
// Place a query service in the middle
@injectable()
class QueryService {
  constructor(
    @inject(TYPES.UserRepository) private userRepo: IUserRepository,
    @inject(TYPES.OrderRepository) private orderRepo: IOrderRepository
  ) {}

  async getUserWithOrders(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) return null;

    const orders = await this.orderRepo.findByUserId(userId);
    return { ...user, orders };
  }

  async getOrderWithUser(orderId: string) {
    const order = await this.orderRepo.findById(orderId);
    if (!order) return null;

    const user = await this.userRepo.findById(order.userId);
    return { ...order, user };
  }
}

// UserService depends on QueryService
@injectable()
class UserService {
  constructor(
    @inject(TYPES.UserRepository) private userRepo: IUserRepository,
    @inject(TYPES.QueryService) private queryService: QueryService
  ) {}

  async getUserWithOrders(userId: string) {
    return this.queryService.getUserWithOrders(userId);
  }
}

// OrderService also depends on QueryService
@injectable()
class OrderService {
  constructor(
    @inject(TYPES.OrderRepository) private orderRepo: IOrderRepository,
    @inject(TYPES.QueryService) private queryService: QueryService
  ) {}

  async getOrderWithUser(orderId: string) {
    return this.queryService.getOrderWithUser(orderId);
  }
}
```

### 8-6. Circular Dependency Detection Tools

```typescript
// Circular dependency detection utility
class CircularDependencyDetector {
  private graph = new Map<string, Set<string>>();

  addDependency(from: string, to: string) {
    if (!this.graph.has(from)) {
      this.graph.set(from, new Set());
    }
    this.graph.get(from)!.add(to);
  }

  detectCycles(): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = this.graph.get(node) || new Set();
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          dfs(dep, path);
        } else if (recursionStack.has(dep)) {
          // Cycle detected
          const cycleStart = path.indexOf(dep);
          cycles.push([...path.slice(cycleStart), dep]);
        }
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const node of this.graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }
}

// Usage example
const detector = new CircularDependencyDetector();
detector.addDependency("UserService", "OrderService");
detector.addDependency("OrderService", "UserService");

const cycles = detector.detectCycles();
if (cycles.length > 0) {
  console.error("Circular dependencies detected:");
  cycles.forEach((cycle) => {
    console.error("  " + cycle.join(" -> "));
  });
}
```

---

## 9. Performance Comparison and Production Examples

### 9-1. DI Library Benchmarks

```typescript
import Benchmark from "benchmark";

// Simple service for benchmarking
@injectable()
class SimpleService {
  getValue(): string {
    return "value";
  }
}

@injectable()
class DependentService {
  constructor(
    @inject(TYPES.SimpleService) private simpleService: SimpleService
  ) {}

  execute(): string {
    return this.simpleService.getValue();
  }
}

// Benchmark suite
const suite = new Benchmark.Suite();

// 1. Manual DI
suite.add("Manual DI", () => {
  const simple = new SimpleService();
  const dependent = new DependentService(simple);
  dependent.execute();
});

// 2. inversify
const inversifyContainer = new Container();
inversifyContainer.bind(TYPES.SimpleService).to(SimpleService);
inversifyContainer.bind(TYPES.DependentService).to(DependentService);

suite.add("inversify (transient)", () => {
  const service = inversifyContainer.get(TYPES.DependentService);
  service.execute();
});

inversifyContainer
  .bind(TYPES.SimpleService)
  .to(SimpleService)
  .inSingletonScope();

suite.add("inversify (singleton)", () => {
  const service = inversifyContainer.get(TYPES.DependentService);
  service.execute();
});

// 3. tsyringe
container.register(SimpleService, { useClass: SimpleService });
container.register(DependentService, { useClass: DependentService });

suite.add("tsyringe (transient)", () => {
  const service = container.resolve(DependentService);
  service.execute();
});

// Output results
suite
  .on("cycle", (event: any) => {
    console.log(String(event.target));
  })
  .on("complete", function (this: any) {
    console.log("Fastest is " + this.filter("fastest").map("name"));
  })
  .run({ async: true });
```

**Typical benchmark results:**

```
Manual DI               x 10,000,000 ops/sec ±1.2%
inversify (transient)   x    500,000 ops/sec ±2.1%
inversify (singleton)   x  1,000,000 ops/sec ±1.8%
tsyringe (transient)    x    800,000 ops/sec ±1.5%
tsyringe (singleton)    x  1,500,000 ops/sec ±1.3%

Fastest is Manual DI
```

### 9-2. Performance Optimization Points

```typescript
// 1. Aggressively use singleton scope
container
  .bind<ILogger>(TYPES.Logger)
  .to(ConsoleLogger)
  .inSingletonScope(); // Stateless services should be singletons

// 2. Lazy initialization
@injectable()
class HeavyService {
  private data: any;

  // Do not perform heavy processing in the constructor
  constructor() {}

  // Initialize when needed
  async initialize() {
    if (!this.data) {
      this.data = await loadHeavyData();
    }
  }

  async process() {
    await this.initialize();
    return this.data;
  }
}

// 3. Conditional branching with factories
container.bind(TYPES.UserRepository).toFactory((context) => {
  return (useCache: boolean) => {
    const db = context.container.get<Database>(TYPES.Database);

    if (useCache) {
      const cache = context.container.get<Cache>(TYPES.Cache);
      return new CachedUserRepository(db, cache);
    }

    return new PostgresUserRepository(db);
  };
});

// 4. Preloading
// Preload frequently used services at application startup
async function preloadServices(container: Container) {
  const criticalServices = [
    TYPES.Database,
    TYPES.Logger,
    TYPES.ConfigService,
  ];

  await Promise.all(
    criticalServices.map((token) => container.get(token))
  );
}
```

### 9-3. Bundle Size Comparison

```
DI library bundle sizes (minified + gzipped):

inversify         ~15 KB
  + reflect-metadata ~10 KB
  = Total ~25 KB

tsyringe          ~5 KB
  + reflect-metadata ~10 KB
  = Total ~15 KB

Manual DI         0 KB

typed-inject      ~3 KB
  (no reflect-metadata needed)

Effect-ts         ~50 KB
  (includes DI + side-effect management + other features)
```

### 9-4. Production Examples

#### Example 1: E-commerce Platform (inversify)

```typescript
// inversify usage in a large-scale e-commerce site
// Services: 100+, Dependencies: 300+

// Module structure
const modules = [
  // Core
  coreModule,          // Logger, Config, EventBus
  databaseModule,      // DB connections, transaction management
  cacheModule,         // Redis cache

  // Domain
  userModule,          // User management
  productModule,       // Product management
  orderModule,         // Order processing
  paymentModule,       // Payment processing
  inventoryModule,     // Inventory management
  shippingModule,      // Shipping management

  // Infrastructure
  emailModule,         // Email sending
  smsModule,           // SMS sending
  searchModule,        // Full-text search
  analyticsModule,     // Analytics
];

const container = new Container();
container.load(...modules);

// Performance optimizations
// - 95% of services as singletons
// - Request scope only for authentication info
// - Minimize dynamic creation with factory pattern

// Results
// - Average response time: 50ms
// - DI overhead: <1ms
// - Memory usage: stable
```

#### Example 2: SaaS Platform (NestJS)

```typescript
// NestJS usage in a multi-tenant SaaS
// Tenants: 1000+, Monthly requests: 100M+

@Module({
  imports: [
    // Global modules
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({ isGlobal: true }),

    // Feature modules
    AuthModule,
    TenantModule,
    UserModule,
    ProjectModule,
    TaskModule,
    NotificationModule,

    // Infrastructure modules
    DatabaseModule.forRoot({
      type: "postgres",
      poolSize: 20,
    }),
    CacheModule.forRoot({
      type: "redis",
      ttl: 300,
    }),
  ],
})
class AppModule {}

// Request scope for tenant isolation
@Injectable({ scope: Scope.REQUEST })
class TenantContext {
  constructor(@Inject(REQUEST) private request: Request) {}

  getTenantId(): string {
    return this.request.headers["x-tenant-id"] as string;
  }

  getDatabaseConnection(): Connection {
    // Switch DB connection per tenant
    const tenantId = this.getTenantId();
    return getConnectionForTenant(tenantId);
  }
}

// Performance optimizations
// - Aggressive use of cache layer
// - DB connection pooling
// - Background jobs in a separate container

// Results
// - 99th percentile response: 100ms
// - Full tenant isolation achieved
// - Scalability ensured
```

#### Example 3: Microservices (tsyringe)

```typescript
// tsyringe usage in a microservices architecture
// Services: 20, lightweight and fast requirements

// Each microservice has minimal dependencies
@singleton()
class ServiceConfig {
  readonly serviceName = process.env.SERVICE_NAME!;
  readonly port = parseInt(process.env.PORT || "3000");
}

@singleton()
class HealthCheckService {
  constructor(
    private config: ServiceConfig,
    private db: DatabaseService
  ) {}

  async check() {
    return {
      service: this.config.serviceName,
      status: "healthy",
      database: await this.db.ping(),
    };
  }
}

// Lightweight, fast startup
async function bootstrap() {
  const service = container.resolve(HealthCheckService);

  const app = express();
  app.get("/health", async (req, res) => {
    const result = await service.check();
    res.json(result);
  });

  app.listen(service["config"].port);
}

// Results
// - Startup time: <100ms
// - Memory footprint: <50MB
// - Well-suited for containerization
```

---

## 10. Anti-Patterns

### AP-1: Service Locator (Anti-Pattern)

```typescript
// NG: Directly referencing a global container (service locator)
class UserService {
  getUser(id: string) {
    // Referencing the container globally → hard to test, hidden dependencies
    const repo = globalContainer.resolve<IUserRepository>("UserRepo");
    return repo.findById(id);
  }
}

// OK: Constructor injection
class UserService {
  constructor(private readonly userRepo: IUserRepository) {}

  getUser(id: string) {
    return this.userRepo.findById(id);
  }
}

// Why it is NG:
// 1. Cannot inject mocks during testing
// 2. Dependencies are hidden (not visible from the constructor)
// 3. Creates a dependency on global state
```

### AP-2: Over-Abstraction

```typescript
// NG: Creating an interface when there is only one implementation
interface IStringUtils {
  capitalize(s: string): string;
  truncate(s: string, len: number): string;
}

@injectable()
class StringUtils implements IStringUtils {
  capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  truncate(s: string, len: number): string {
    return s.slice(0, len);
  }
}

// DI is not needed for utility functions (pure functions)

// OK: Use directly as pure functions
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function truncate(s: string, len: number): string {
  return s.slice(0, len);
}

// What should be injected via DI:
// - External I/O (DB, API, files)
// - Things with state (cache, session)
// - Things you want to replace in tests (email sending, payments)
```

### AP-3: God Class

```typescript
// NG: One class with too many dependencies
@injectable()
class GodService {
  constructor(
    private userRepo: IUserRepository,
    private orderRepo: IOrderRepository,
    private productRepo: IProductRepository,
    private paymentService: IPaymentService,
    private emailService: IEmailService,
    private smsService: ISmsService,
    private notificationService: INotificationService,
    private analyticsService: IAnalyticsService,
    private logger: ILogger,
    private cache: ICache,
    private eventBus: IEventBus,
    // ... too many dependencies!
  ) {}

  // Handles all operations in one class
}

// OK: Split responsibilities
@injectable()
class UserService {
  constructor(
    private userRepo: IUserRepository,
    private emailService: IEmailService,
    private logger: ILogger
  ) {}
}

@injectable()
class OrderService {
  constructor(
    private orderRepo: IOrderRepository,
    private paymentService: IPaymentService,
    private logger: ILogger
  ) {}
}

// Rule of thumb: keep constructor arguments to 3-5
// More than that may indicate too many responsibilities
```

### AP-4: Overusing new

```typescript
// NG: Using new directly while also using DI
@injectable()
class UserService {
  constructor(private userRepo: IUserRepository) {}

  async createUser(data: CreateUserDto) {
    const user = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);

    // Creating directly with new → hard to test
    const emailService = new SmtpEmailService();
    await emailService.send(user.email, "Welcome!", "Hello");

    return user;
  }
}

// OK: Inject all dependencies
@injectable()
class UserService {
  constructor(
    private userRepo: IUserRepository,
    private emailService: IEmailService // injected
  ) {}

  async createUser(data: CreateUserDto) {
    const user = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
    };

    await this.userRepo.save(user);
    await this.emailService.send(user.email, "Welcome!", "Hello");

    return user;
  }
}
```

---

## 11. Edge Case Analysis

### EC-1: Optional Dependencies

```typescript
// Handling optional dependencies

// Optional dependency in inversify
@injectable()
class UserService {
  constructor(
    @inject(TYPES.UserRepository) private userRepo: IUserRepository,
    @inject(TYPES.Cache) @optional() private cache?: ICache
  ) {}

  async getUser(id: string): Promise<User | null> {
    // Use cache if available
    if (this.cache) {
      const cached = await this.cache.get<User>(`user:${id}`);
      if (cached) return cached;
    }

    const user = await this.userRepo.findById(id);

    if (this.cache && user) {
      await this.cache.set(`user:${id}`, user, 300);
    }

    return user;
  }
}

// Optional dependency in tsyringe
const CacheToken = Symbol("Cache");

@injectable()
class UserService {
  constructor(
    private userRepo: IUserRepository,
    @inject(CacheToken) @optional() private cache?: ICache
  ) {}
}

// Container configuration (cache presence varies by environment)
if (process.env.REDIS_URL) {
  container.register(CacheToken, { useClass: RedisCache });
}

// Optional dependency in manual DI
class UserService {
  constructor(
    private userRepo: IUserRepository,
    private cache?: ICache // optional parameter
  ) {}
}

const userService = new UserService(
  userRepo,
  process.env.REDIS_URL ? new RedisCache() : undefined
);
```

### EC-2: Dynamic Provider Selection

```typescript
// Switch implementations at runtime

// Strategy pattern + DI
interface IStorageStrategy {
  save(key: string, value: any): Promise<void>;
  load(key: string): Promise<any>;
}

@injectable()
class LocalStorageStrategy implements IStorageStrategy {
  async save(key: string, value: any): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async load(key: string): Promise<any> {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  }
}

@injectable()
class S3StorageStrategy implements IStorageStrategy {
  async save(key: string, value: any): Promise<void> {
    // Upload to S3
    console.log(`Uploading to S3: ${key}`);
  }

  async load(key: string): Promise<any> {
    // Download from S3
    console.log(`Downloading from S3: ${key}`);
    return null;
  }
}

// Dynamically select using a factory
@injectable()
class StorageService {
  constructor(
    @inject("StorageFactory")
    private strategyFactory: (type: string) => IStorageStrategy
  ) {}

  async saveWithStrategy(
    type: "local" | "s3",
    key: string,
    value: any
  ): Promise<void> {
    const strategy = this.strategyFactory(type);
    await strategy.save(key, value);
  }
}

// Container configuration
container
  .bind<(type: string) => IStorageStrategy>("StorageFactory")
  .toFactory((context) => {
    return (type: string) => {
      switch (type) {
        case "local":
          return context.container.get<IStorageStrategy>(LocalStorageStrategy);
        case "s3":
          return context.container.get<IStorageStrategy>(S3StorageStrategy);
        default:
          throw new Error(`Unknown storage type: ${type}`);
      }
    };
  });
```

### EC-3: Conditional Bindings

```typescript
// Change bindings based on environment or context

// Conditional bindings in inversify
container
  .bind<ILogger>(TYPES.Logger)
  .to(ConsoleLogger)
  .when((request: interfaces.Request) => {
    // ConsoleLogger in development
    return process.env.NODE_ENV === "development";
  });

container
  .bind<ILogger>(TYPES.Logger)
  .to(CloudWatchLogger)
  .when((request: interfaces.Request) => {
    // CloudWatchLogger in production
    return process.env.NODE_ENV === "production";
  });

// Conditional branching by target name
container
  .bind<IDatabase>(TYPES.Database)
  .to(PostgresDatabase)
  .whenTargetNamed("primary");

container
  .bind<IDatabase>(TYPES.Database)
  .to(MySQLDatabase)
  .whenTargetNamed("secondary");

@injectable()
class ReplicationService {
  constructor(
    @inject(TYPES.Database) @named("primary")
    private primaryDb: IDatabase,

    @inject(TYPES.Database) @named("secondary")
    private secondaryDb: IDatabase
  ) {}

  async write(data: any) {
    await this.primaryDb.query("INSERT ...");
  }

  async read(id: string) {
    // Read from secondary
    return this.secondaryDb.query("SELECT ...");
  }
}

// Conditional branching by parent context
container
  .bind<IUserRepository>(TYPES.UserRepository)
  .to(PostgresUserRepository)
  .whenInjectedInto(UserService);

container
  .bind<IUserRepository>(TYPES.UserRepository)
  .to(CachedUserRepository)
  .whenInjectedInto(AdminService);
```

---

## 12. Exercises

### Exercise 1: Basic — Blog System with Manual DI

**Task:**
Implement the following classes for a blog system and wire them up using manual DI.

- `IPostRepository`: CRUD for posts
- `ICommentRepository`: CRUD for comments
- `ISearchService`: Full-text search
- `PostService`: Create, publish, and search posts
- `CommentService`: Submit and approve comments

**Requirements:**
- Define interfaces
- Create implementation classes (mock implementations are fine)
- Resolve dependencies in a `createApp` function
- Inject mocks in tests

```typescript
// Implement here

interface IPostRepository {
  // TODO: define methods
}

interface ICommentRepository {
  // TODO: define methods
}

interface ISearchService {
  // TODO: define methods
}

class PostService {
  // TODO: implement
}

class CommentService {
  // TODO: implement
}

function createApp() {
  // TODO: wiring
}
```

### Exercise 2: Applied — Multi-Tenant System with inversify

**Task:**
Build a DI system for a multi-tenant SaaS using inversify.

- Different DB connections per tenant
- Tenant-specific configuration
- Manage tenant context in request scope
- Module splitting (core, tenant, business logic)

```typescript
// Implement here

const TYPES = {
  // TODO: define tokens
};

interface TenantContext {
  tenantId: string;
  databaseUrl: string;
}

// TODO: implement modules and bindings
```

### Exercise 3: Advanced — Resolving Circular Dependencies

**Task:**
Resolve the circular dependencies in the system below using 3 different approaches.

1. Interface segregation
2. Event-driven
3. Introduce an intermediate service

```typescript
// Code with circular dependencies
class ArticleService {
  constructor(private commentService: CommentService) {}

  async getArticleWithComments(articleId: string) {
    const article = await this.getArticle(articleId);
    const comments = await this.commentService.getCommentsByArticle(articleId);
    return { ...article, comments };
  }
}

class CommentService {
  constructor(private articleService: ArticleService) {}

  async getCommentsByArticle(articleId: string) {
    const article = await this.articleService.getArticle(articleId);
    if (!article) throw new Error("Article not found");
    // Fetch comments
  }
}

// TODO: Resolve the circular dependency using 3 approaches
```

---

## 13. FAQ

### Q1: Should I choose inversify or tsyringe?

**Answer:**
Choose based on the scale and requirements of your project.

**When to choose inversify:**
- Large-scale projects (50+ services)
- Complex dependencies (avoiding circular dependencies, conditional bindings)
- Need for module splitting
- Need for detailed scope control
- Team is experienced with DI

**When to choose tsyringe:**
- Small to medium-scale projects (10-30 services)
- Simple dependencies
- Want a smaller bundle size
- Want to minimize learning cost
- Using the Microsoft ecosystem (TypeScript, VS Code)

**When to choose manual DI:**
- Small-scale projects (<10 services)
- Need the highest type safety
- Want to avoid decorators (TC39 Stage 3 compliance)
- Zero dependencies desired

### Q2: Can DI be used with Next.js or Remix?

**Answer:**
It can be used on the server side, but must be managed separately from React components.

**Server-side (API Routes, Server Actions):**
```typescript
// app/api/users/route.ts
import { container } from "@/lib/di-container";
import { UserService } from "@/services/user-service";

export async function POST(req: Request) {
  const userService = container.resolve(UserService);
  const data = await req.json();
  const user = await userService.createUser(data);
  return Response.json(user);
}
```

**React components:**
```typescript
// Use the Context API in React components
"use client";

import { createContext, useContext } from "react";

const ServicesContext = createContext<{
  userService: UserService;
} | null>(null);

export function ServicesProvider({ children }: { children: React.ReactNode }) {
  const services = {
    userService: container.resolve(UserService),
  };

  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useUserService() {
  const context = useContext(ServicesContext);
  if (!context) throw new Error("ServicesProvider not found");
  return context.userService;
}
```

**Recommended approach:**
- Server-side: Use a DI container
- Client-side: Context API + hooks
- Hybrid: Use services in Server Components and pass them to Client Components via props

### Q3: From what project scale should DI be introduced?

**Answer:**
Use the following criteria as a guide.

**DI not needed (manual constructor injection is sufficient):**
- Service classes: 1-5
- External dependencies: 0-2 (DB, external APIs, etc.)
- Developers: 1-2
- Examples: personal projects, prototypes

**Consider lightweight DI (tsyringe):**
- Service classes: 5-30
- External dependencies: 3-5
- Developers: 2-5
- Examples: startup MVPs, small to medium-scale SaaS

**Consider full-featured DI (inversify, NestJS):**
- Service classes: 30+
- External dependencies: 5+
- Developers: 5+
- Examples: enterprise apps, large-scale SaaS

**Decision criteria:**
1. **Test complexity**: Introduce DI when managing mocks manually becomes difficult
2. **Dependency complexity**: Introduce DI when the graph structure has 3+ layers
3. **Team size**: Introduce DI when multiple people are developing and unified dependency management is needed

### Q4: Can DI be achieved without a DI container?

**Answer:**
Yes, it can be achieved using functional programming patterns.

**Reader Monad pattern:**
```typescript
type Reader<Env, A> = (env: Env) => A;

function createUser(data: CreateUserDto): Reader<Dependencies, Promise<User>> {
  return async (deps) => {
    // Processing using deps
  };
}

// Execute by injecting dependencies
const user = await createUser(userData)(dependencies);
```

**Benefits:**
- No library required
- Complete type safety
- Easy function composition

**Drawbacks:**
- Learning cost (requires knowledge of functional programming)
- Boilerplate (passing `(deps)` every time)
- Weaker IDE support

**Recommended for:**
- Teams proficient in functional programming
- When highest type safety is required
- When you want to avoid decorators

### Q5: Is there a way to completely prevent circular dependencies?

**Answer:**
Architecture-level measures are required.

**1. Layered architecture:**
```
Upper layers can depend on lower layers, but lower layers cannot depend on upper layers

Presentation Layer (Controllers)
         ↓
Application Layer (Services)
         ↓
Domain Layer (Entities, Interfaces)
         ↓
Infrastructure Layer (Repositories)
```

**2. Dependency Inversion Principle (DIP):**
```typescript
// Lower layer (Infrastructure) depends on upper layer (Domain) interfaces

// Domain Layer
interface IUserRepository {
  findById(id: string): Promise<User | null>;
}

// Infrastructure Layer
class PostgresUserRepository implements IUserRepository {
  // Depends on IUserRepository (inverted)
}

// Application Layer
class UserService {
  constructor(private userRepo: IUserRepository) {
    // Depends on the interface
  }
}
```

**3. Event-driven architecture:**
```typescript
// Avoid direct dependencies between services, decouple via events

class UserService {
  async createUser(data: CreateUserDto) {
    const user = await this.userRepo.save(data);

    // Publish an event rather than directly depending on other services
    await this.eventBus.publish({
      type: "UserCreated",
      data: { userId: user.id },
    });
  }
}

class OrderService {
  constructor(private eventBus: IEventBus) {
    // Subscribe to events
    this.eventBus.subscribe("UserCreated", this.onUserCreated);
  }

  private async onUserCreated(event: DomainEvent) {
    // Processing when a user is created
  }
}
```

**4. Static analysis tools:**
```bash
# Detect circular dependencies with dependency-cruiser
npx depcruise --validate -- src/

# Visualize the dependency graph with madge
npx madge --circular --extensions ts src/
```

### Q6: Does using DI degrade performance?

**Answer:**
There is a slight overhead, but it is not a practical concern.

**Benchmark results:**
- Manual DI: 10,000,000 ops/sec (baseline)
- tsyringe (singleton): 1,500,000 ops/sec (6.7x slower)
- inversify (singleton): 1,000,000 ops/sec (10x slower)

**Impact in actual applications:**
- DI overhead: <1ms
- DB queries: 10-100ms
- External APIs: 100-1000ms

→ The bottleneck is I/O; DI overhead is within the margin of error

**Optimization points:**
1. **Use singleton scope**: 2-3x faster than transient
2. **Preload frequently used services**: Resolve and cache at startup
3. **Minimize factories**: Dynamic creation is costly
4. **Be mindful of bundle size**: Use tsyringe or manual DI on the client side

---

## 14. References

### Official Documentation

1. **InversifyJS**
   https://inversify.io/
   A powerful, lightweight IoC container. Provides decorator-based DI.

2. **tsyringe**
   https://github.com/microsoft/tsyringe
   A lightweight DI container by Microsoft. Known for its simple API.

3. **NestJS - Dependency Injection**
   https://docs.nestjs.com/fundamentals/custom-providers
   An Angular-like DI system. Suited for enterprise use.

### Books

4. **Clean Architecture** -- Robert C. Martin
   The original source on the Dependency Inversion Principle (DIP) and IoC. Learn about architecture-level dependency management.

5. **Dependency Injection Principles, Practices, and Patterns** -- Steven van Deursen, Mark Seemann
   A systematic explanation of DI patterns. .NET-focused but applicable to TypeScript.

6. **Domain-Driven Design** -- Eric Evans
   Dependency management and layered architecture in domain-driven design.

### Online Articles

7. **TypeScript Decorators**
   https://www.typescriptlang.org/docs/handbook/decorators.html
   TypeScript official documentation. Learn the basics of decorators.

8. **Dependency Injection in TypeScript** -- Alex Jover Morales
   https://www.thisdot.co/blog/dependency-injection-in-typescript
   A practical guide to implementing DI in TypeScript.

9. **SOLID Principles in TypeScript**
   https://khalilstemmler.com/articles/solid-principles/solid-typescript/
   Examples of implementing SOLID principles in TypeScript.

### Tools and Libraries

10. **typed-inject**
    https://github.com/nicojs/typed-inject
    A DI library that prioritizes type safety. No reflect-metadata needed.

11. **Effect-ts**
    https://effect.website/
    Achieves DI using functional programming techniques. Also provides side-effect management.

12. **dependency-cruiser**
    https://github.com/sverweij/dependency-cruiser
    A tool for visualizing dependencies and detecting circular dependencies.
