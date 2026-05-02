# TypeScript Testing Complete Guide

> Using Vitest, Jest, and type tests (tsd / expect-type) to verify both runtime behavior and type correctness

## What You Will Learn

1. **Testing with Vitest** -- Setup and usage of the fast test runner integrated with the Vite ecosystem
2. **Jest + TypeScript** -- Configuration of ts-jest / @swc/jest and running Jest in existing projects
3. **Type tests** -- Techniques for verifying that library type definitions are correct using `expectTypeOf` (built into Vitest) and tsd
4. **Test design patterns** -- How to structure the AAA pattern, test doubles, integration tests, and E2E tests
5. **Test performance and maintainability** -- Testing strategies and optimization techniques for large-scale projects


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [TypeScript Build Tools Complete Guide](./01-build-tools.md)

---

## 1. Vitest

### 1-1. Setup

```
Vitest architecture:

  vite.config.ts
       |
       v
  +----------+     +---------+     +----------+
  | Test      | --> | Vite    | --> | esbuild  |
  | Files     |     | (trans) |     | (fast TS)|
  +----------+     +---------+     +----------+
       |
       v
  +----------+
  | Test     |
  | Results  |
  +----------+

  Vitest features:
  - Shares config with Vite (resolve.alias, plugins, etc.)
  - Fast transpilation via esbuild
  - Jest-compatible API
  - Built-in type tests (expectTypeOf)
  - HMR-enabled watch mode
  - Browser mode (Playwright / WebDriverIO)
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,           // Make describe, it, expect global
    environment: "node",     // or "jsdom", "happy-dom"
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "e2e/**"],
    // Coverage settings
    coverage: {
      provider: "v8",        // or "istanbul"
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/**/index.ts",    // re-export only files
        "src/types/**",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    // Type test settings
    typecheck: {
      enabled: true,         // Enable type tests
      tsconfig: "./tsconfig.test.json",
      include: ["src/**/*.typetest.ts"],
    },
    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    // Setup files
    setupFiles: ["./tests/setup.ts"],
    // Global setup (once for the entire test suite)
    globalSetup: ["./tests/global-setup.ts"],
    // Snapshots
    snapshotFormat: {
      printBasicPrototype: false,
    },
    // Automatic mock cleanup
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    // Parallel execution settings
    pool: "threads",          // or "forks", "vmThreads"
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:related": "vitest related",
    "test:changed": "vitest --changed"
  }
}
```

```typescript
// tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

### 1-2. Writing Tests

```typescript
// src/user-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UserService } from "./user-service";
import type { IUserRepository, IEmailService } from "./interfaces";

// Create mocks (type-safe)
function createMockUserRepo(): IUserRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  };
}

function createMockEmailService(): IEmailService {
  return {
    send: vi.fn(),
  };
}

describe("UserService", () => {
  let service: UserService;
  let mockRepo: ReturnType<typeof createMockUserRepo>;
  let mockEmail: ReturnType<typeof createMockEmailService>;

  beforeEach(() => {
    mockRepo = createMockUserRepo();
    mockEmail = createMockEmailService();
    service = new UserService(mockRepo, mockEmail);
  });

  describe("createUser", () => {
    it("should save user and send welcome email", async () => {
      // Arrange
      mockRepo.save.mockResolvedValue(undefined);
      mockEmail.send.mockResolvedValue(undefined);

      // Act
      const user = await service.createUser({
        name: "Alice",
        email: "alice@example.com",
      });

      // Assert
      expect(user.name).toBe("Alice");
      expect(mockRepo.save).toHaveBeenCalledOnce();
      expect(mockEmail.send).toHaveBeenCalledWith(
        "alice@example.com",
        expect.stringContaining("Welcome"),
        expect.any(String)
      );
    });

    it("should return error for invalid email", async () => {
      const result = await service.createUser({
        name: "Bob",
        email: "invalid",
      });

      expect(result).toMatchObject({
        _tag: "Err",
        error: { code: "VALIDATION_ERROR" },
      });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockRepo.save.mockRejectedValue(new Error("Connection refused"));

      const result = await service.createUser({
        name: "Charlie",
        email: "charlie@example.com",
      });

      expect(result).toMatchObject({
        _tag: "Err",
        error: { code: "DATABASE_ERROR" },
      });
    });
  });

  describe("deleteUser", () => {
    it("should delete existing user", async () => {
      mockRepo.findById.mockResolvedValue({
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
      });
      mockRepo.delete.mockResolvedValue(undefined);

      await service.deleteUser("user-1");

      expect(mockRepo.delete).toHaveBeenCalledWith("user-1");
    });

    it("should throw when user not found", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.deleteUser("nonexistent")).rejects.toThrow(
        "User not found"
      );
    });
  });
});
```

### 1-3. Module Mocking with vi.mock

```typescript
// Mock entire module
vi.mock("./database", () => ({
  db: {
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Partial mock (replace only part of implementation)
vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils")>();
  return {
    ...actual,
    generateId: vi.fn(() => "fixed-id"),
    getCurrentTimestamp: vi.fn(() => new Date("2024-01-01T00:00:00Z")),
  };
});

// Spy
import * as mathUtils from "./math-utils";
vi.spyOn(mathUtils, "calculate").mockReturnValue(42);

// Environment variable mock
vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("API_KEY", "test-key");

// Timer mock
vi.useFakeTimers();
vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
// Restore after test
afterEach(() => {
  vi.useRealTimers();
});

// fetch mock
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

mockFetch.mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ data: "test" }),
});
```

### 1-4. Snapshot Tests

```typescript
import { describe, it, expect } from "vitest";

describe("Snapshot tests", () => {
  it("should match user object snapshot", () => {
    const user = createUser({ name: "Alice", email: "alice@test.com" });

    expect(user).toMatchSnapshot();
    // On first run, the snapshot is saved in __snapshots__
  });

  it("should match inline snapshot", () => {
    const result = formatCurrency(1234.56, "JPY");

    expect(result).toMatchInlineSnapshot(`"¥1,235"`);
    // The snapshot is embedded in the test file
  });

  it("should match serialized output", () => {
    const html = renderToString(<UserCard user={mockUser} />);

    expect(html).toMatchSnapshot();
    // Update snapshot: vitest --update
  });
});
```

### 1-5. Parameterized Tests

```typescript
import { describe, it, expect } from "vitest";

describe("calculateTax", () => {
  it.each([
    { price: 1000, rate: 0.1, expected: 1100 },
    { price: 2000, rate: 0.1, expected: 2200 },
    { price: 500, rate: 0.08, expected: 540 },
    { price: 0, rate: 0.1, expected: 0 },
    { price: 99.99, rate: 0.1, expected: 109.989 },
  ])(
    "should calculate $price with $rate% tax = $expected",
    ({ price, rate, expected }) => {
      expect(calculateTax(price, rate)).toBeCloseTo(expected);
    }
  );
});

// Table format
describe("validateEmail", () => {
  it.each`
    email                | valid    | reason
    ${"user@example.com"} | ${true}  | ${"valid email"}
    ${"user@test.co.jp"} | ${true}  | ${"country TLD"}
    ${"invalid"}          | ${false} | ${"no @ symbol"}
    ${"@example.com"}     | ${false} | ${"no local part"}
    ${"user@"}            | ${false} | ${"no domain"}
  `("$email should be valid=$valid ($reason)", ({ email, valid }) => {
    expect(isValidEmail(email)).toBe(valid);
  });
});
```

---

## 2. Jest + TypeScript

### 2-1. ts-jest Setup

```typescript
// jest.config.ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/index.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Setup files
  setupFilesAfterSetup: ["<rootDir>/tests/setup.ts"],
  // Timeout
  testTimeout: 10000,
};

export default config;
```

### 2-2. @swc/jest (Fast Version)

```typescript
// jest.config.ts -- Use SWC for faster execution
import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: true,
          },
          transform: {
            decoratorVersion: "2022-03",
            react: {
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default config;
```

### 2-3. Migrating from Jest to Vitest

```typescript
// Jest code works almost as-is in Vitest
// Main changes:

// 1. jest.fn() → vi.fn()
// 2. jest.mock() → vi.mock()
// 3. jest.spyOn() → vi.spyOn()

// 4. jest.config.ts → vitest.config.ts
// 5. @types/jest → vitest/globals

// 6. Incompatible features:
//    - jest.requireActual() → await importOriginal()
//    - jest.useFakeTimers("modern") → vi.useFakeTimers()
//    - jest.runAllTimers() → vi.runAllTimers()

// Migration script (bulk replace with sed)
// sed -i 's/jest\.fn/vi.fn/g' **/*.test.ts
// sed -i 's/jest\.mock/vi.mock/g' **/*.test.ts
// sed -i 's/jest\.spyOn/vi.spyOn/g' **/*.test.ts

// Codemod tool also available:
// npx @vitest/codemod migrate-jest
```

---

## 3. Type Tests

### 3-1. Vitest's expectTypeOf

```
Purpose of type tests:

  Library public API
       |
       v
  +------------------+
  | Verify type      |
  | correctness      |
  |                  |
  | - Inference result    |
  | - Assignability       |
  | - That errors occur   |
  +------------------+
       |
       v
  Type regression tests (guarantee types don't break during refactoring)
```

```typescript
// src/result.typetest.ts
import { describe, it, expectTypeOf } from "vitest";
import { Ok, Err, type Result, map, isOk, flatMap } from "./result";

describe("Result type tests", () => {
  it("Ok should infer the correct type", () => {
    const ok = Ok(42);
    expectTypeOf(ok).toEqualTypeOf<{ _tag: "Ok"; value: number }>();
  });

  it("Err should infer the correct type", () => {
    const err = Err("not found");
    expectTypeOf(err).toEqualTypeOf<{ _tag: "Err"; error: string }>();
  });

  it("Result should be a union", () => {
    type R = Result<number, string>;
    expectTypeOf<R>().toEqualTypeOf<
      { _tag: "Ok"; value: number } | { _tag: "Err"; error: string }
    >();
  });

  it("map should transform the success type", () => {
    const result: Result<number, string> = Ok(42);
    const mapped = map(result, (n) => String(n));
    expectTypeOf(mapped).toEqualTypeOf<Result<string, string>>();
  });

  it("flatMap should compose Results", () => {
    const result: Result<number, string> = Ok(42);
    const composed = flatMap(result, (n) =>
      n > 0 ? Ok(String(n)) : Err("negative")
    );
    expectTypeOf(composed).toEqualTypeOf<Result<string, string>>();
  });

  it("isOk should narrow the type", () => {
    const result: Result<number, string> = Ok(42);
    if (isOk(result)) {
      expectTypeOf(result).toEqualTypeOf<{ _tag: "Ok"; value: number }>();
    }
  });

  it("should not accept wrong types", () => {
    // @ts-expect-error -- number is not assignable to string
    const bad: Result<string, string> = Ok(42);
  });

  // Rich assertions with expectTypeOf
  it("should demonstrate various type assertions", () => {
    // Whether types match
    expectTypeOf<string>().toEqualTypeOf<string>();

    // Whether assignable
    expectTypeOf<string>().toMatchTypeOf<string | number>();

    // Type of function parameters
    function greet(name: string, age: number): string {
      return `${name} (${age})`;
    }
    expectTypeOf(greet).parameter(0).toBeString();
    expectTypeOf(greet).parameter(1).toBeNumber();
    expectTypeOf(greet).returns.toBeString();

    // Element type of arrays
    expectTypeOf<string[]>().items.toBeString();

    // Object properties
    interface User {
      name: string;
      age: number;
    }
    expectTypeOf<User>().toHaveProperty("name");
    expectTypeOf<User>().toHaveProperty("age");
  });
});
```

### 3-2. Type Tests with tsd

```typescript
// test-d/index.test-d.ts (for tsd)
import { expectType, expectError, expectAssignable, expectNotType } from "tsd";
import { createStore, type Store } from "../src";

// Correct type should be inferred
const store = createStore({ count: 0, name: "test" });
expectType<Store<{ count: number; name: string }>>(store);

// get should return the correct type
const count = store.get("count");
expectType<number>(count);

// Non-existent key should produce an error
expectError(store.get("nonexistent"));

// Assignability test
expectAssignable<{ count: number }>(store.getState());

// Types should not match
expectNotType<string>(store.get("count"));
```

```json
// tsd configuration in package.json
{
  "scripts": {
    "test:types": "tsd"
  },
  "tsd": {
    "directory": "test-d"
  }
}
```

### 3-3. Type Tests with @ts-expect-error

```typescript
// Verify that compile errors occur
describe("type safety", () => {
  it("should reject wrong argument types", () => {
    function add(a: number, b: number): number {
      return a + b;
    }

    // @ts-expect-error -- string is not assignable to number
    add("1", "2");

    // @ts-expect-error -- not enough arguments
    add(1);

    // @ts-expect-error -- too many arguments
    add(1, 2, 3);
  });

  it("branded types should not be interchangeable", () => {
    type UserId = string & { __brand: "UserId" };
    type OrderId = string & { __brand: "OrderId" };

    function getUser(id: UserId): void {}
    const orderId = "order-1" as OrderId;

    // @ts-expect-error -- OrderId is not assignable to UserId
    getUser(orderId);
  });

  it("readonly properties should not be writable", () => {
    interface Config {
      readonly apiUrl: string;
      readonly port: number;
    }

    const config: Config = { apiUrl: "https://api.example.com", port: 3000 };

    // @ts-expect-error -- cannot assign to readonly property
    config.apiUrl = "https://other.com";
  });

  it("discriminated unions should be exhaustive", () => {
    type Shape =
      | { kind: "circle"; radius: number }
      | { kind: "square"; side: number };

    function area(shape: Shape): number {
      switch (shape.kind) {
        case "circle":
          return Math.PI * shape.radius ** 2;
        case "square":
          return shape.side ** 2;
        default:
          // Exhaustiveness check with never type
          const _exhaustive: never = shape;
          return _exhaustive;
      }
    }
  });
});
```

---

## 4. Test Design Patterns

### 4-1. AAA Pattern (Arrange-Act-Assert)

```typescript
it("should calculate total with tax", () => {
  // Arrange
  const items = [
    { price: 1000, quantity: 2 },
    { price: 500, quantity: 3 },
  ];
  const taxRate = 0.1;

  // Act
  const total = calculateTotal(items, taxRate);

  // Assert
  expect(total).toBe(3850); // (1000*2 + 500*3) * 1.1
});
```

### 4-2. Test Data Builder

```typescript
// Test data builder pattern
class UserBuilder {
  private data: Partial<User> = {
    id: "default-id",
    name: "Default User",
    email: "default@test.com",
    role: "USER",
    createdAt: new Date("2024-01-01"),
  };

  static create(): UserBuilder {
    return new UserBuilder();
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withRole(role: "USER" | "ADMIN"): this {
    this.data.role = role;
    return this;
  }

  build(): User {
    return this.data as User;
  }
}

// Usage example
it("admin should have special permissions", () => {
  const admin = UserBuilder.create()
    .withName("Admin Alice")
    .withRole("ADMIN")
    .build();

  expect(hasPermission(admin, "delete_users")).toBe(true);
});
```

### 4-3. Test Context Factory

```typescript
// Test helper
function createTestContext() {
  const userRepo = createMockUserRepo();
  const emailService = createMockEmailService();
  const logger = createMockLogger();
  const eventBus = createMockEventBus();

  const service = new UserService(userRepo, emailService, logger, eventBus);

  return { service, userRepo, emailService, logger, eventBus };
}

describe("UserService", () => {
  it("should handle concurrent creates", async () => {
    const { service, userRepo } = createTestContext();

    userRepo.save.mockResolvedValue(undefined);

    const results = await Promise.all([
      service.createUser({ name: "A", email: "a@test.com" }),
      service.createUser({ name: "B", email: "b@test.com" }),
    ]);

    expect(userRepo.save).toHaveBeenCalledTimes(2);
    results.forEach((r) => expect(r).toMatchObject({ _tag: "Ok" }));
  });

  it("should emit UserCreated event", async () => {
    const { service, userRepo, eventBus } = createTestContext();

    userRepo.save.mockResolvedValue(undefined);

    await service.createUser({ name: "Alice", email: "alice@test.com" });

    expect(eventBus.emit).toHaveBeenCalledWith(
      "UserCreated",
      expect.objectContaining({ email: "alice@test.com" })
    );
  });
});
```

### 4-4. HTTP Mocking (msw)

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("https://api.example.com/users", () => {
    return HttpResponse.json([
      { id: "1", name: "Alice", email: "alice@example.com" },
      { id: "2", name: "Bob", email: "bob@example.com" },
    ]);
  }),

  http.get("https://api.example.com/users/:id", ({ params }) => {
    const { id } = params;
    if (id === "404") {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      id,
      name: "Alice",
      email: "alice@example.com",
    });
  }),

  http.post("https://api.example.com/users", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: "new-id", ...body },
      { status: 201 }
    );
  }),
];

// tests/setup.ts
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Usage in tests
describe("UserApiClient", () => {
  it("should fetch users", async () => {
    const client = new UserApiClient("https://api.example.com");
    const users = await client.getUsers();

    expect(users).toHaveLength(2);
    expect(users[0].name).toBe("Alice");
  });

  it("should handle 404 errors", async () => {
    const client = new UserApiClient("https://api.example.com");

    await expect(client.getUser("404")).rejects.toThrow("User not found");
  });

  // Override handler per test
  it("should handle server errors", async () => {
    server.use(
      http.get("https://api.example.com/users", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const client = new UserApiClient("https://api.example.com");
    await expect(client.getUsers()).rejects.toThrow("Server error");
  });
});
```

### 4-5. Database Tests (Prisma + Test Containers)

```typescript
// tests/helpers/database.ts
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "child_process";

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

export async function setupTestDatabase(): Promise<PrismaClient> {
  // Start test PostgreSQL in a Docker container
  container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("testdb")
    .start();

  const databaseUrl = container.getConnectionUri();

  // Apply migrations
  execSync(`DATABASE_URL="${databaseUrl}" npx prisma migrate deploy`, {
    stdio: "pipe",
  });

  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  return prisma;
}

export async function teardownTestDatabase(): Promise<void> {
  await prisma.$disconnect();
  await container.stop();
}

export async function cleanDatabase(): Promise<void> {
  // Clear all tables in a transaction
  const tablenames = await prisma.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;

  for (const { tablename } of tablenames) {
    if (tablename !== "_prisma_migrations") {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
  }
}

// Usage in tests
describe("UserRepository (integration)", () => {
  let prisma: PrismaClient;
  let repo: UserRepository;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    repo = new PrismaUserRepository(prisma);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  it("should create and find user", async () => {
    const created = await repo.create({
      name: "Alice",
      email: "alice@test.com",
      role: "USER",
    });

    const found = await repo.findById(created.id);

    expect(found).toMatchObject({
      name: "Alice",
      email: "alice@test.com",
    });
  });

  it("should return null for non-existent user", async () => {
    const found = await repo.findById("non-existent-id");
    expect(found).toBeNull();
  });
});
```

---

## 5. Test Organization and Naming Conventions

### 5-1. File Organization Patterns

```
Pattern A: Colocation (same directory)
src/
├── user/
│   ├── user-service.ts
│   ├── user-service.test.ts      ← Tests alongside source
│   ├── user-repository.ts
│   └── user-repository.test.ts
└── order/
    ├── order-service.ts
    └── order-service.test.ts

Pattern B: Separate directory
src/
├── user/
│   ├── user-service.ts
│   └── user-repository.ts
tests/
├── unit/
│   ├── user-service.test.ts
│   └── user-repository.test.ts
├── integration/
│   └── user-flow.test.ts
└── e2e/
    └── api.test.ts

Pattern C: Hybrid (recommended)
src/
├── user/
│   ├── user-service.ts
│   ├── user-service.test.ts      ← Unit tests
│   └── user-repository.ts
tests/
├── integration/                   ← Integration tests
│   └── user-creation.test.ts
├── e2e/                           ← E2E tests
│   └── user-api.test.ts
├── helpers/                       ← Test helpers
│   ├── database.ts
│   ├── builders.ts
│   └── mocks.ts
└── setup.ts                       ← Global setup
```

### 5-2. Test Naming Conventions

```typescript
// Naming pattern: should + expected behavior + when + condition
describe("UserService.createUser", () => {
  // Happy path
  it("should create user and return Ok when valid data is provided", async () => {
    // ...
  });

  it("should send welcome email when user is created successfully", async () => {
    // ...
  });

  // Error cases
  it("should return ValidationError when email is invalid", async () => {
    // ...
  });

  it("should return DuplicateError when email already exists", async () => {
    // ...
  });

  // Boundary values
  it("should accept name with exactly 100 characters", async () => {
    // ...
  });

  it("should reject name with 101 characters", async () => {
    // ...
  });
});
```

---

## 6. Test Pyramid and Coverage Strategy

```
Test Pyramid:

         /\
        /  \     E2E Tests (few)
       /    \    - Playwright / Cypress
      /------\   - Complete user scenarios
     /        \  - Execution time: long
    / Integra-  \
   /   tion      \  Integration Tests (moderate)
  /--------------\  - DB / API integration
 /                \ - Test containers
/   Unit Tests     \
+-------------------+ Unit Tests (many)
                       - Pure functions
                       - Uses mocks
                       - Execution time: short

Guidelines:
  Unit tests:        70%
  Integration tests: 20%
  E2E tests:         10%
```

```typescript
// Coverage exclusion settings
// vitest.config.ts
{
  test: {
    coverage: {
      exclude: [
        // Test files themselves
        "**/*.test.ts",
        "**/*.spec.ts",
        // Type definitions
        "**/*.d.ts",
        // Config files
        "*.config.ts",
        // re-export only files
        "**/index.ts",
        // Generated code
        "src/generated/**",
        // Test helpers
        "tests/**",
      ],
    },
  },
}
```

---

## Comparison Tables

### Test Runner Comparison

| Feature | Vitest | Jest | Node.js test runner |
|---------|--------|------|---------------------|
| Speed | Very fast | Moderate | Fast |
| TypeScript | Transformed via Vite | ts-jest / @swc/jest | --loader |
| Type tests | expectTypeOf built-in | tsd separately | None |
| HMR | Yes | No | No |
| UI | vitest --ui | jest-stare etc. | None |
| Watch | Optimized | Yes | Yes |
| Coverage | v8 / istanbul | istanbul | v8 |
| Ecosystem | Growing | Largest | Minimal |
| Browser tests | Playwright/WebDriverIO | jsdom only | None |
| Setup | Easy | Moderate | Minimal |
| Snapshots | Yes | Yes | Yes |

### Mock Method Comparison

| Method | Use case | Type safety | Flexibility | Recommended for |
|--------|----------|-------------|-------------|-----------------|
| vi.fn() / jest.fn() | Function mock | Medium | High | Callbacks |
| vi.mock() / jest.mock() | Module mock | Low | Highest | External dependencies |
| vi.spyOn() / jest.spyOn() | Spy | High | Medium | Monitoring existing functions |
| Manual mock | DI-based | Highest | Medium | Service layer |
| msw | HTTP mock | High | High | API clients |
| testcontainers | Real DB tests | Highest | Highest | Repository layer |

### Test Environment Comparison

| Environment | Use case | DOM | Performance |
|-------------|----------|-----|-------------|
| node | Backend | None | Fastest |
| jsdom | Frontend | Simulated | Fast |
| happy-dom | Frontend | Simulated | Fast |
| playwright | E2E / Browser | Real browser | Slow |

---

## Anti-Patterns

### AP-1: Using any in Tests

```typescript
// Bad: Destroying type safety with any
it("should process data", () => {
  const mockData: any = { foo: "bar" };
  const result = processUser(mockData); // Type checking doesn't work
  expect(result).toBeDefined();
});

// Good: Create test data with proper types
it("should process data", () => {
  const user = UserBuilder.create()
    .withName("Alice")
    .withEmail("alice@test.com")
    .build();
  const result = processUser(user); // Type checking works
  expect(result.name).toBe("Alice");
});
```

### AP-2: Testing Implementation Details

```typescript
// Bad: Test that depends on internal implementation (fragile)
it("should call repository save then email send", async () => {
  // Testing that save is called before email
  const callOrder: string[] = [];
  mockRepo.save.mockImplementation(() => {
    callOrder.push("save");
    return Promise.resolve();
  });
  mockEmail.send.mockImplementation(() => {
    callOrder.push("email");
    return Promise.resolve();
  });

  await service.createUser(data);
  expect(callOrder).toEqual(["save", "email"]); // Depends on internal implementation
});

// Good: Test behavior (results)
it("should create user and send welcome email", async () => {
  const result = await service.createUser(data);
  expect(result).toMatchObject({ _tag: "Ok" });
  expect(mockEmail.send).toHaveBeenCalledWith(
    data.email,
    expect.any(String),
    expect.any(String)
  );
});
```

### AP-3: Dependencies Between Tests

```typescript
// Bad: Sharing state between tests
let userId: string;

it("should create user", async () => {
  const user = await service.createUser(data);
  userId = user.id; // Used in next test ← Dangerous!
  expect(user).toBeDefined();
});

it("should get user", async () => {
  const user = await service.getUser(userId); // Depends on previous test
  expect(user.name).toBe("Alice");
});

// Good: Each test is independent
it("should get created user", async () => {
  // Arrange: self-contained within test
  const created = await service.createUser(data);

  // Act
  const found = await service.getUser(created.id);

  // Assert
  expect(found.name).toBe(data.name);
});
```

### AP-4: Excessive Mocking

```typescript
// Bad: Mocking everything and verifying nothing
it("should work", async () => {
  mockRepo.findById.mockResolvedValue(mockUser);
  mockRepo.save.mockResolvedValue(undefined);
  mockEmail.send.mockResolvedValue(undefined);
  mockLogger.info.mockReturnValue(undefined);
  mockCache.get.mockResolvedValue(null);
  mockCache.set.mockResolvedValue(undefined);

  const result = await service.updateUser("id", { name: "New" });

  expect(result).toBeDefined(); // Unclear what is being verified
});

// Good: Focus on truly important behavior
it("should update user name and invalidate cache", async () => {
  mockRepo.findById.mockResolvedValue(existingUser);
  mockRepo.save.mockResolvedValue(undefined);

  const result = await service.updateUser("user-1", { name: "New Name" });

  expect(result.name).toBe("New Name");
  expect(mockRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ id: "user-1", name: "New Name" })
  );
  expect(mockCache.delete).toHaveBeenCalledWith("user:user-1");
});
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation pattern"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "Exception should be raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be aware of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Configuration file issues | Check config file path and format |
| Timeout | Network delay / resource shortage | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check running user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce lock mechanism, transaction management |

### Debugging Steps

1. **Check error messages**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use logging and debugger to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debug utility
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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
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

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Problem type | Diagnostic tool | Solution |
|-------------|-----------------|----------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |
---

## FAQ

### Q1: Should I choose Vitest or Jest?

Vitest is recommended for new projects. Its advantages are integration with the Vite ecosystem, built-in type test support, and fast execution. There is no need to forcibly migrate existing Jest projects, but since Vitest provides a Jest-compatible API, migration is relatively straightforward. Automatic migration is also possible with @vitest/codemod.

### Q2: How many type tests should I write?

They are essential when publishing libraries or utility types. For application code, they are effective when written for complex generic functions or utility types. There is no need to write type tests for every function -- focus on "parts where the type inference result matters."

### Q3: What is the appropriate test coverage target?

80% is a common target. However, rather than chasing coverage % alone, prioritize whether "the critical path (main happy path and error flows) is covered." Aiming for 100% makes test maintenance costs enormous.

### Q4: Should I use a real DB in integration tests?

If possible, it is recommended to use a real DB with testcontainers. You can discover SQL issues and data integrity errors that cannot be detected with mocks. Docker is required in CI environments, but it is easy to configure in GitHub Actions etc.

### Q5: What to do when tests are slow?

1. `vitest --pool=threads` for parallel execution
2. `vitest --changed` to run only tests related to changed files
3. Minimize module mocks (more mocks = greater overhead)
4. Separate integration tests and unit tests (`vitest --project unit`)
5. Use `--shard` in CI to split into parallel jobs

---

## Summary Table

| Concept | Key points |
|---------|------------|
| Vitest | Vite-based, fast, built-in type tests |
| Jest | Largest ecosystem, can be sped up with @swc/jest |
| Type tests | Verify library types with expectTypeOf / tsd |
| @ts-expect-error | Verify that compile errors occur |
| AAA pattern | Structured with Arrange-Act-Assert |
| DI + mocks | Easy to swap out with interface-based design |
| msw | HTTP request mocking (service worker) |
| Test pyramid | Unit 70%, integration 20%, E2E 10% |

---

## 7. Testing React Components

### 7-1. Testing Library + Vitest

```typescript
// src/components/UserCard.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UserCard } from "./UserCard";

describe("UserCard", () => {
  const mockUser = {
    id: "1",
    name: "Alice",
    email: "alice@example.com",
    role: "admin" as const,
  };

  it("should render user information", () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("badge")).toHaveTextContent("admin");
  });

  it("should call onEdit when edit button is clicked", async () => {
    const onEdit = vi.fn();
    render(<UserCard user={mockUser} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledWith(mockUser.id);
  });

  it("should show delete confirmation dialog", async () => {
    const onDelete = vi.fn();
    render(<UserCard user={mockUser} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText("Are you sure you want to delete?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onDelete).toHaveBeenCalledWith(mockUser.id);
  });
});
```

### 7-2. Testing Custom Hooks

```typescript
// src/hooks/useUsers.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUsers } from "./useUsers";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("useUsers", () => {
  it("should fetch and return users", async () => {
    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    // Initial state
    expect(result.current.isLoading).toBe(true);

    // Data fetch complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe("Alice");
  });

  it("should handle error state", async () => {
    // Override with msw to return error response
    server.use(
      http.get("https://api.example.com/users", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain("Server error");
  });
});
```

---

## 8. Test Configuration in CI/CD

### 8-1. GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]  # Split tests into 4 shards
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: Run tests
        run: vitest run --shard=${{ matrix.shard }} --reporter=junit --outputFile=test-results.xml

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.shard }}
          path: test-results.xml

  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: vitest run --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: coverage/lcov.info
```

### 8-2. Test Performance Optimization

```typescript
// Optimize performance in vitest.config.ts
export default defineConfig({
  test: {
    // Parallel execution with thread pool
    pool: "threads",
    poolOptions: {
      threads: {
        // Adjust to number of CPU cores
        minThreads: 2,
        maxThreads: 8,
      },
    },
    // Run failed tests first (faster feedback)
    sequence: {
      shuffle: false,
    },
    // Test isolation (prevent memory leaks)
    isolate: true,
    // Per-file timeout
    testTimeout: 10000,
    // Identify slow tests
    slowTestThreshold: 1000,
    // Reporter settings
    reporters: ["default", "junit"],
    outputFile: {
      junit: "test-results/junit.xml",
    },
  },
});
```

---


## Summary

This guide covered the following key points:

- Understanding basic concepts and principles
- Practical implementation patterns
- Best practices and cautions
- How to apply in real-world projects

---

## Guides to Read Next

- [Build Tools](./01-build-tools.md) -- Integration settings between Vitest and Vite
- [DI Pattern](../02-patterns/04-dependency-injection.md) -- Testable design and DI
- [ESLint + TypeScript](./04-eslint-typescript.md) -- Lint rules for test code

---

## References

1. **Vitest** -- Next Generation Testing Framework
   https://vitest.dev/

2. **Jest** -- Delightful JavaScript Testing
   https://jestjs.io/

3. **tsd** -- Check TypeScript type definitions
   https://github.com/tsdjs/tsd

4. **msw** -- Mock Service Worker
   https://mswjs.io/

5. **testcontainers** -- Integration testing with real services
   https://testcontainers.com/
