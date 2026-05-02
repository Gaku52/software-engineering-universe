# Repository Pattern — Data Access Abstraction

> A practical guide to completely separating data access logic from business logic using the Repository pattern, achieving testability, maintainability, and the ability to swap data sources. Covers the relationship with aggregate roots in DDD, combining with Unit of Work and Specification patterns, and concrete implementation examples for various ORMs.

---

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| Object-Oriented Programming | Intermediate (interfaces, abstract classes, DI) | [02-programming](../../../../02-programming/) |
| TypeScript / Python basics | Intermediate (generics, async/await) | [02-programming](../../../../02-programming/) |
| SQL basics | Foundational (SELECT, INSERT, JOIN) | [06-data-and-security](../../../../06-data-and-security/) |
| SOLID principles | Foundational (Dependency Inversion Principle DIP) | ../../clean-code-principles/ |
| MVC / MVVM basics | Foundational | [00-mvc-mvvm.md](./00-mvc-mvvm.md) |

---

## What You Will Learn

1. **Repository pattern** — purpose, structure, and its role in Domain-Driven Design (DDD)
2. **Separating interface from implementation** — testable design based on the Dependency Inversion Principle (DIP)
3. **Implementation patterns** — Specific Repository, Generic Repository, Specification pattern
4. **Unit of Work pattern** — transaction management across multiple Repositories
5. **ORM-specific implementations** — concrete examples with Prisma, SQLAlchemy, TypeORM, and Drizzle

---

## 1. Overview of the Repository Pattern

### WHY: Why Do We Need the Repository Pattern?

When data access code is mixed into business logic, the following problems arise:

1. **Hard to test** — testing business logic requires a database connection
2. **Cascading changes** — DB schema changes or ORM changes affect all services
3. **Duplicate code** — the same queries are scattered across multiple places
4. **Violation of separation of concerns** — "what data is needed" and "how to retrieve it" are intermixed

The Repository pattern solves these issues:

```
┌──────────────────────────────────────────────────────┐
│  Without Repository (BAD)                             │
│                                                      │
│  ┌────────────────────────────────────┐              │
│  │ UserService                        │              │
│  │                                    │              │
│  │ async createUser(data) {           │              │
│  │   // SQL is embedded directly      │              │
│  │   await db.query(                  │              │
│  │     "INSERT INTO users ..."        │              │
│  │   );                               │              │
│  │   // Business logic mixed with DB  │              │
│  │   if (user.role === "admin") {     │              │
│  │     await db.query(                │              │
│  │       "INSERT INTO audit_log ..."  │              │
│  │     );                             │              │
│  │   }                                │              │
│  │ }                                  │              │
│  └────────────────────────────────────┘              │
│  Problem: hard to test, must update all places on DB change │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  With Repository (GOOD)                               │
│                                                      │
│  ┌──────────────┐     ┌──────────────────┐           │
│  │ UserService  │ ──→ │ UserRepository   │(Interface)│
│  │ (Business    │     │  findById()      │           │
│  │  Logic)      │     │  save()          │           │
│  └──────────────┘     │  findByEmail()   │           │
│                       └────────┬─────────┘           │
│        For tests              │      For production  │
│    ┌──────────────┐  ┌───────▼─────────┐             │
│    │ InMemory     │  │ PostgresUser    │             │
│    │ Repository   │  │ Repository      │ (impl)      │
│    └──────────────┘  │ (SQL only here)  │             │
│                      └─────────────────┘             │
│  Benefits: easy to test, DB changes only affect impl class │
└──────────────────────────────────────────────────────┘
```

### 1.1 Relationship with the Dependency Inversion Principle (DIP)

```
┌───────────────────────────────────────────────────────────┐
│  Dependency Inversion Principle (DIP)                     │
│                                                           │
│  BAD: Upper module directly depends on lower module       │
│                                                           │
│  UserService ──→ PostgresUserRepository ──→ PostgreSQL    │
│  (upper)         (lower)                   (detail)       │
│                                                           │
│  Problem: changing PostgreSQL to MongoDB also requires    │
│           changing UserService                            │
│                                                           │
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  GOOD: Upper module depends on abstraction (interface)    │
│                                                           │
│  UserService ──→ UserRepository (Interface)               │
│  (upper)         (abstraction)                            │
│                       ▲                                   │
│                       │ implements                        │
│                       │                                   │
│              PostgresUserRepository ──→ PostgreSQL        │
│              MongoUserRepository   ──→ MongoDB            │
│              InMemoryUserRepository (for tests)           │
│                                                           │
│  Benefit: UserService does not know the concrete DB       │
│           Swapping the DB only requires changing the impl │
└───────────────────────────────────────────────────────────┘
```

### 1.2 Position in Layered Architecture

```
┌──────────────────────────────────────────────────┐
│  Presentation Layer (Controller / Handler)         │
│  → Handles HTTP requests/responses                │
├──────────────────────────────────────────────────┤
│  Application Layer (Service / UseCase)             │
│  → Orchestrates use cases, manages transactions   │
│  → Uses Repository Interface                      │
├──────────────────────────────────────────────────┤
│  Domain Layer (Entity / Value Object)              │
│  → Business rules, domain logic                   │
│  ┌─────────────────────────────────┐              │
│  │ Repository Interface            │ ← defined here │
│  │ (belongs to domain layer)       │              │
│  └─────────────────────────────────┘              │
├──────────────────────────────────────────────────┤
│  Infrastructure Layer                              │
│  ┌─────────────────────────────────┐              │
│  │ Repository Implementation       │ ← implemented here │
│  │ (PostgresUserRepository, etc.)  │              │
│  └─────────────────────────────────┘              │
│  → DB access, external API calls                  │
└──────────────────────────────────────────────────┘

Important: Interface belongs to the domain layer, Implementation to the infrastructure layer
           → The direction of dependency points inward (toward the domain)
```

### 1.3 Aggregates and Repositories in DDD

```
┌───────────────────────────────────────────────────────────┐
│  Aggregate Root and Repository in DDD                     │
│                                                           │
│  Principle: one Repository per Aggregate Root             │
│                                                           │
│  ┌─────────── Order Aggregate ─────────┐                  │
│  │  Order (Aggregate Root) ★            │                  │
│  │    ├── OrderItem                    │                  │
│  │    ├── OrderItem                    │                  │
│  │    └── ShippingAddress              │                  │
│  └─────────────────────────────────────┘                  │
│           │                                               │
│           ▼                                               │
│  ┌────────────────────────────┐                           │
│  │  OrderRepository           │  ← per aggregate root    │
│  │  findById(id): Order       │  ← Order + Items + Address│
│  │  save(order): void         │  ← saves as a whole      │
│  └────────────────────────────┘                           │
│                                                           │
│  BAD: Do not create an OrderItemRepository                │
│       → OrderItem is part of the Order aggregate and      │
│         should not be retrieved or saved independently    │
│                                                           │
│  GOOD: Customer aggregate has its own Repository          │
│  ┌─────────── Customer Aggregate ──────┐                  │
│  │  Customer (Aggregate Root) ★         │                  │
│  │    └── Address                      │                  │
│  └─────────────────────────────────────┘                  │
│           │                                               │
│           ▼                                               │
│  ┌────────────────────────────┐                           │
│  │  CustomerRepository        │                           │
│  └────────────────────────────┘                           │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Implementation in TypeScript

### 2.1 Separating Interface from Implementation (Prisma)

```typescript
// ============================================================
// Domain Layer: Repository Interface
// domain/repositories/UserRepository.ts
// ============================================================

import { User } from "../entities/User";

export interface FindOptions {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filter?: {
    active?: boolean;
    role?: string;
    createdAfter?: Date;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Repository Interface — defined in the domain layer
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(options?: FindOptions): Promise<PaginatedResult<User>>;
  findByIds(ids: string[]): Promise<User[]>;
  save(user: User): Promise<User>;
  saveMany(users: User[]): Promise<User[]>;
  delete(id: string): Promise<void>;
  exists(email: string): Promise<boolean>;
  count(filter?: FindOptions["filter"]): Promise<number>;
}
```

```typescript
// ============================================================
// Infrastructure Layer: PostgreSQL implementation (Prisma)
// infrastructure/repositories/PrismaUserRepository.ts
// ============================================================

import { PrismaClient, User as PrismaUser } from "@prisma/client";
import {
  UserRepository,
  FindOptions,
  PaginatedResult,
} from "../../domain/repositories/UserRepository";
import { User } from "../../domain/entities/User";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },  // also fetch related entities in the aggregate
    });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(options?: FindOptions): Promise<PaginatedResult<User>> {
    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 20;
    const skip = (page - 1) * perPage;

    // Build filter conditions
    const where: Record<string, unknown> = {};
    if (options?.filter?.active !== undefined) {
      where.active = options.filter.active;
    }
    if (options?.filter?.role) {
      where.role = options.filter.role;
    }
    if (options?.filter?.createdAfter) {
      where.createdAt = { gte: options.filter.createdAfter };
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          [options?.sortBy ?? "createdAt"]: options?.sortOrder ?? "desc",
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      data: rows.map((row) => this.toDomain(row)),
      total,
      page,
      perPage,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(user: User): Promise<User> {
    const row = await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
      update: {
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        updatedAt: new Date(),
      },
    });
    return this.toDomain(row);
  }

  async saveMany(users: User[]): Promise<User[]> {
    const results = await this.prisma.$transaction(
      users.map((user) =>
        this.prisma.user.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            active: user.active,
          },
          update: {
            name: user.name,
            email: user.email,
            role: user.role,
            active: user.active,
          },
        })
      )
    );
    return results.map((row) => this.toDomain(row));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async exists(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  async count(filter?: FindOptions["filter"]): Promise<number> {
    const where: Record<string, unknown> = {};
    if (filter?.active !== undefined) where.active = filter.active;
    if (filter?.role) where.role = filter.role;
    return this.prisma.user.count({ where });
  }

  // Convert to domain model
  private toDomain(row: PrismaUser): User {
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as "admin" | "user",
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
```

### 2.2 In-Memory Implementation for Testing

```typescript
// ============================================================
// Test: In-Memory implementation
// tests/repositories/InMemoryUserRepository.ts
// ============================================================

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return (
      [...this.users.values()].find((u) => u.email === email) ?? null
    );
  }

  async findAll(options?: FindOptions): Promise<PaginatedResult<User>> {
    let all = [...this.users.values()];

    // Filtering
    if (options?.filter?.active !== undefined) {
      all = all.filter((u) => u.active === options.filter!.active);
    }
    if (options?.filter?.role) {
      all = all.filter((u) => u.role === options.filter!.role);
    }
    if (options?.filter?.createdAfter) {
      all = all.filter(
        (u) => u.createdAt >= options.filter!.createdAfter!
      );
    }

    // Sorting
    const sortBy = options?.sortBy ?? "createdAt";
    const sortOrder = options?.sortOrder ?? "desc";
    all.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === "desc" ? -cmp : cmp;
    });

    // Pagination
    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 20;
    const start = (page - 1) * perPage;
    const data = all.slice(start, start + perPage);
    const totalPages = Math.ceil(all.length / perPage);

    return {
      data,
      total: all.length,
      page,
      perPage,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findByIds(ids: string[]): Promise<User[]> {
    return ids
      .map((id) => this.users.get(id))
      .filter((u): u is User => u !== undefined);
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async saveMany(users: User[]): Promise<User[]> {
    users.forEach((u) => this.users.set(u.id, u));
    return users;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  async exists(email: string): Promise<boolean> {
    return [...this.users.values()].some((u) => u.email === email);
  }

  async count(filter?: FindOptions["filter"]): Promise<number> {
    let all = [...this.users.values()];
    if (filter?.active !== undefined) {
      all = all.filter((u) => u.active === filter.active);
    }
    return all.length;
  }

  // Test helpers
  clear(): void {
    this.users.clear();
  }

  seed(users: User[]): void {
    users.forEach((u) => this.users.set(u.id, u));
  }

  getAll(): User[] {
    return [...this.users.values()];
  }
}
```

### 2.3 Usage in the Service Layer and DI

```typescript
// ============================================================
// Application Layer: Service
// application/services/UserService.ts
// ============================================================

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,   // depends on the interface
    private readonly emailService: EmailService,
    private readonly eventBus: EventBus,
  ) {}

  async registerUser(name: string, email: string): Promise<User> {
    // Validate business rules
    const existing = await this.userRepo.exists(email);
    if (existing) {
      throw new DuplicateEmailError(email);
    }

    // Create domain object
    const user = User.create(name, email);

    // Persist
    const saved = await this.userRepo.save(user);

    // Side effects (publish domain event)
    await this.eventBus.publish(new UserRegisteredEvent(saved));
    await this.emailService.sendWelcome(saved.email);

    return saved;
  }

  async deactivateUser(id: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new UserNotFoundError(id);

    user.deactivate();
    await this.userRepo.save(user);
    await this.eventBus.publish(new UserDeactivatedEvent(user));
  }

  async getUserList(options?: FindOptions): Promise<PaginatedResult<User>> {
    return this.userRepo.findAll({
      ...options,
      filter: { ...options?.filter, active: true },
    });
  }
}

// ============================================================
// DI Container (tsyringe example)
// ============================================================
import { container } from "tsyringe";

// Production environment: inject PostgreSQL implementation
container.register<UserRepository>("UserRepository", {
  useClass: PrismaUserRepository,
});

// Test environment: inject InMemory implementation
container.register<UserRepository>("UserRepository", {
  useClass: InMemoryUserRepository,
});
```

### 2.4 Testing the Service

```typescript
// ============================================================
// Tests — using InMemory Repository
// ============================================================

describe("UserService", () => {
  let service: UserService;
  let userRepo: InMemoryUserRepository;
  let emailService: jest.Mocked<EmailService>;
  let eventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    emailService = { sendWelcome: jest.fn() } as any;
    eventBus = { publish: jest.fn() } as any;
    service = new UserService(userRepo, emailService, eventBus);
  });

  describe("registerUser", () => {
    test("can register a new user", async () => {
      const user = await service.registerUser("Alice", "alice@example.com");

      // Validate domain properties
      expect(user.name).toBe("Alice");
      expect(user.email).toBe("alice@example.com");
      expect(user.active).toBe(true);

      // Validate persistence
      const found = await userRepo.findByEmail("alice@example.com");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);

      // Validate side effects
      expect(emailService.sendWelcome).toHaveBeenCalledWith("alice@example.com");
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: "UserRegistered" })
      );
    });

    test("throws error for duplicate email address", async () => {
      await service.registerUser("Alice", "alice@example.com");

      await expect(
        service.registerUser("Bob", "alice@example.com")
      ).rejects.toThrow(DuplicateEmailError);

      // Validate that side effects were not called again
      expect(emailService.sendWelcome).toHaveBeenCalledTimes(1);
    });
  });

  describe("deactivateUser", () => {
    test("can deactivate a user", async () => {
      const user = await service.registerUser("Alice", "alice@example.com");
      await service.deactivateUser(user.id);

      const found = await userRepo.findById(user.id);
      expect(found!.active).toBe(false);
    });

    test("throws error for non-existent user", async () => {
      await expect(
        service.deactivateUser("non-existent-id")
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  describe("getUserList", () => {
    test("returns only active users", async () => {
      const alice = await service.registerUser("Alice", "alice@example.com");
      await service.registerUser("Bob", "bob@example.com");
      await service.deactivateUser(alice.id);

      const result = await service.getUserList();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Bob");
    });
  });
});
```

---

## 3. Implementation in Python

### 3.1 Definition Using Abstract Base Class

```python
# ============================================================
# domain/repositories/user_repository.py
# ============================================================
from abc import ABC, abstractmethod
from typing import Optional, List
from dataclasses import dataclass
from domain.entities.user import User


@dataclass
class FindOptions:
    page: int = 1
    per_page: int = 20
    sort_by: str = "created_at"
    sort_order: str = "desc"
    active: Optional[bool] = None
    role: Optional[str] = None


@dataclass
class PaginatedResult:
    data: List[User]
    total: int
    page: int
    per_page: int

    @property
    def total_pages(self) -> int:
        return -(-self.total // self.per_page)  # ceiling division

    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @property
    def has_prev(self) -> bool:
        return self.page > 1


class UserRepository(ABC):
    """User repository interface (defined in the domain layer)"""

    @abstractmethod
    async def find_by_id(self, user_id: str) -> Optional[User]:
        ...

    @abstractmethod
    async def find_by_email(self, email: str) -> Optional[User]:
        ...

    @abstractmethod
    async def find_all(self, options: Optional[FindOptions] = None) -> PaginatedResult:
        ...

    @abstractmethod
    async def save(self, user: User) -> User:
        ...

    @abstractmethod
    async def delete(self, user_id: str) -> None:
        ...

    @abstractmethod
    async def exists(self, email: str) -> bool:
        ...
```

```python
# ============================================================
# infrastructure/repositories/sqlalchemy_user_repository.py
# ============================================================
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from domain.repositories.user_repository import (
    UserRepository, FindOptions, PaginatedResult
)
from domain.entities.user import User
from infrastructure.models import UserModel


class SQLAlchemyUserRepository(UserRepository):
    """PostgreSQL implementation using SQLAlchemy"""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def find_by_id(self, user_id: str) -> Optional[User]:
        stmt = select(UserModel).where(UserModel.id == user_id)
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        return self._to_domain(row) if row else None

    async def find_by_email(self, email: str) -> Optional[User]:
        stmt = select(UserModel).where(UserModel.email == email)
        result = await self._session.execute(stmt)
        row = result.scalar_one_or_none()
        return self._to_domain(row) if row else None

    async def find_all(self, options: Optional[FindOptions] = None) -> PaginatedResult:
        opts = options or FindOptions()

        # Base query
        stmt = select(UserModel)
        count_stmt = select(func.count()).select_from(UserModel)

        # Filters
        if opts.active is not None:
            stmt = stmt.where(UserModel.active == opts.active)
            count_stmt = count_stmt.where(UserModel.active == opts.active)
        if opts.role:
            stmt = stmt.where(UserModel.role == opts.role)
            count_stmt = count_stmt.where(UserModel.role == opts.role)

        # Sorting
        sort_col = getattr(UserModel, opts.sort_by, UserModel.created_at)
        stmt = stmt.order_by(
            sort_col.desc() if opts.sort_order == "desc" else sort_col.asc()
        )

        # Pagination
        offset = (opts.page - 1) * opts.per_page
        stmt = stmt.offset(offset).limit(opts.per_page)

        # Execute
        result = await self._session.execute(stmt)
        count_result = await self._session.execute(count_stmt)
        rows = result.scalars().all()
        total = count_result.scalar()

        return PaginatedResult(
            data=[self._to_domain(row) for row in rows],
            total=total,
            page=opts.page,
            per_page=opts.per_page,
        )

    async def save(self, user: User) -> User:
        model = UserModel(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            active=user.active,
        )
        merged = await self._session.merge(model)
        await self._session.flush()
        return self._to_domain(merged)

    async def delete(self, user_id: str) -> None:
        stmt = select(UserModel).where(UserModel.id == user_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        await self._session.delete(model)

    async def exists(self, email: str) -> bool:
        stmt = select(func.count()).select_from(UserModel).where(
            UserModel.email == email
        )
        result = await self._session.execute(stmt)
        return result.scalar() > 0

    def _to_domain(self, model: UserModel) -> User:
        return User(
            id=model.id,
            name=model.name,
            email=model.email,
            role=model.role,
            active=model.active,
            created_at=model.created_at,
        )
```

```python
# ============================================================
# InMemory implementation for testing
# tests/repositories/in_memory_user_repository.py
# ============================================================
class InMemoryUserRepository(UserRepository):
    def __init__(self):
        self._users: dict[str, User] = {}

    async def find_by_id(self, user_id: str) -> Optional[User]:
        return self._users.get(user_id)

    async def find_by_email(self, email: str) -> Optional[User]:
        return next(
            (u for u in self._users.values() if u.email == email), None
        )

    async def find_all(self, options: Optional[FindOptions] = None) -> PaginatedResult:
        opts = options or FindOptions()
        users = list(self._users.values())

        # Filters
        if opts.active is not None:
            users = [u for u in users if u.active == opts.active]
        if opts.role:
            users = [u for u in users if u.role == opts.role]

        # Pagination
        total = len(users)
        start = (opts.page - 1) * opts.per_page
        data = users[start:start + opts.per_page]

        return PaginatedResult(
            data=data, total=total, page=opts.page, per_page=opts.per_page
        )

    async def save(self, user: User) -> User:
        self._users[user.id] = user
        return user

    async def delete(self, user_id: str) -> None:
        self._users.pop(user_id, None)

    async def exists(self, email: str) -> bool:
        return any(u.email == email for u in self._users.values())

    def clear(self):
        self._users.clear()
```

---

## 4. Specification Pattern

### WHY: Why Do We Need the Specification Pattern?

Continuously adding methods to the Repository for complex search conditions causes the interface to bloat:

```typescript
// BAD: methods multiply for each search condition
interface UserRepository {
  findByName(name: string): Promise<User[]>;
  findByRole(role: string): Promise<User[]>;
  findByNameAndRole(name: string, role: string): Promise<User[]>;
  findActiveByRole(role: string): Promise<User[]>;
  findInactiveCreatedBefore(date: Date): Promise<User[]>;
  // ... grows indefinitely
}

// GOOD: Specification pattern turns conditions into objects
interface UserRepository {
  findAll(spec?: Specification<User>): Promise<User[]>;
  // a single method handles all search conditions
}
```

### 4.1 Implementing the Specification

```typescript
// ============================================================
// Specification Pattern
// ============================================================

// Base Specification
interface Specification<T> {
  isSatisfiedBy(entity: T): boolean;
  toSQL(): { where: string; params: unknown[] };
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

abstract class BaseSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(entity: T): boolean;
  abstract toSQL(): { where: string; params: unknown[] };

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends BaseSpecification<T> {
  constructor(private left: Specification<T>, private right: Specification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }

  toSQL(): { where: string; params: unknown[] } {
    const l = this.left.toSQL();
    const r = this.right.toSQL();
    return {
      where: `(${l.where}) AND (${r.where})`,
      params: [...l.params, ...r.params],
    };
  }
}

class OrSpecification<T> extends BaseSpecification<T> {
  constructor(private left: Specification<T>, private right: Specification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }

  toSQL(): { where: string; params: unknown[] } {
    const l = this.left.toSQL();
    const r = this.right.toSQL();
    return {
      where: `(${l.where}) OR (${r.where})`,
      params: [...l.params, ...r.params],
    };
  }
}

class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return !this.spec.isSatisfiedBy(entity);
  }

  toSQL(): { where: string; params: unknown[] } {
    const s = this.spec.toSQL();
    return { where: `NOT (${s.where})`, params: s.params };
  }
}

// Concrete Specifications
class ActiveUserSpec extends BaseSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.active;
  }

  toSQL() {
    return { where: "active = true", params: [] };
  }
}

class UserWithRoleSpec extends BaseSpecification<User> {
  constructor(private role: string) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.role === this.role;
  }

  toSQL() {
    return { where: "role = $1", params: [this.role] };
  }
}

class CreatedAfterSpec extends BaseSpecification<User> {
  constructor(private date: Date) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.createdAt >= this.date;
  }

  toSQL() {
    return { where: "created_at >= $1", params: [this.date] };
  }
}

// Usage example: combining conditions
const activeAdmins = new ActiveUserSpec().and(new UserWithRoleSpec("admin"));
const recentOrAdmin = new CreatedAfterSpec(lastMonth).or(new UserWithRoleSpec("admin"));

// Using with Repository
const users = await userRepo.findAll(activeAdmins);
```

---

## 5. Combining with the Unit of Work Pattern

### WHY: Why Do We Need Unit of Work?

When you want to execute operations spanning multiple Repositories atomically, having each Repository commit independently can cause inconsistencies:

```
BAD: each Repository commits independently
  OrderRepository.save(order)    → succeeds (already committed)
  UserRepository.updatePoints()  → fails (rolled back)
  → order was created but points were never awarded — inconsistent state

GOOD: batch commit with Unit of Work
  UnitOfWork begins
    OrderRepository.save(order)     → inside transaction
    UserRepository.updatePoints()   → inside transaction
  UnitOfWork.commit()               → commits all changes at once
  On failure → UnitOfWork.rollback() → rolls back all changes at once
```

### 5.1 Unit of Work Structure

```
┌──────────────────────────────────────────────────────┐
│              Unit of Work Pattern                     │
│                                                      │
│  ┌──────────────────────────────────────┐            │
│  │ UnitOfWork                           │            │
│  │                                      │            │
│  │  ┌─────────────────┐                │            │
│  │  │ UserRepository  │                │            │
│  │  └─────────────────┘                │            │
│  │  ┌─────────────────┐                │            │
│  │  │ OrderRepository │                │            │
│  │  └─────────────────┘                │            │
│  │  ┌─────────────────┐                │            │
│  │  │ Transaction     │                │            │
│  │  │ (shared)        │                │            │
│  │  └─────────────────┘                │            │
│  │                                      │            │
│  │  commit()   ← commits/rolls back all │            │
│  │  rollback()   repository changes     │            │
│  └──────────────────────────────────────┘            │
└──────────────────────────────────────────────────────┘
```

### 5.2 Implementation Example

```typescript
// ============================================================
// Unit of Work interface
// ============================================================
interface UnitOfWork {
  readonly users: UserRepository;
  readonly orders: OrderRepository;
  readonly auditLogs: AuditLogRepository;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// ============================================================
// Prisma implementation
// ============================================================
class PrismaUnitOfWork implements UnitOfWork {
  readonly users: UserRepository;
  readonly orders: OrderRepository;
  readonly auditLogs: AuditLogRepository;

  private constructor(private tx: PrismaClient) {
    this.users = new PrismaUserRepository(tx);
    this.orders = new PrismaOrderRepository(tx);
    this.auditLogs = new PrismaAuditLogRepository(tx);
  }

  // Factory method: executes inside a transaction
  static async execute<T>(
    prisma: PrismaClient,
    fn: (uow: UnitOfWork) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const uow = new PrismaUnitOfWork(tx as PrismaClient);
      return fn(uow);
    });
  }

  async commit(): Promise<void> {
    // Prisma $transaction auto-commits
  }

  async rollback(): Promise<void> {
    // Prisma $transaction auto-rolls back on exception
    throw new Error("Transaction aborted");
  }
}

// ============================================================
// Usage in Service
// ============================================================
class OrderService {
  constructor(
    private prisma: PrismaClient,
    private eventBus: EventBus,
  ) {}

  async placeOrder(userId: string, items: OrderItem[]): Promise<Order> {
    const result = await PrismaUnitOfWork.execute(this.prisma, async (uow) => {
      // 1. Fetch user
      const user = await uow.users.findById(userId);
      if (!user) throw new UserNotFoundError(userId);

      // 2. Create order (domain logic)
      const order = Order.create(user, items);

      // 3. Save order
      await uow.orders.save(order);

      // 4. Update user points
      user.addPoints(order.calculatePoints());
      await uow.users.save(user);

      // 5. Record audit log
      await uow.auditLogs.append(
        AuditLog.create("ORDER_PLACED", userId, { orderId: order.id })
      );

      return order;
    });
    // All changes are committed together within the transaction

    // Publish event after the transaction succeeds
    await this.eventBus.publish(new OrderPlacedEvent(result));

    return result;
  }
}
```

---

## 6. Comparison Tables

### 6.1 Comparison of Repository Implementation Approaches

| Approach | Description | Pros | Cons | Best For |
|------|------|---------|----------|----------|
| **Specific Repository** | Custom methods per entity | Clear API, type-safe, expressive domain language | More boilerplate | DDD, medium to large scale |
| **Generic Repository** | Common CRUD in base class | Less code, unified API | Can over-abstract | CRUD-centric, small to medium scale |
| **Specification Pattern** | Query conditions as objects | Flexible query building, reusable conditions | High learning curve, complex | Complex search requirements |
| **CQRS + Repository** | Separates reads from writes | Performance optimization | Increased complexity | Skewed read/write ratios |

### 6.2 Comparison of Data Access Patterns

| Pattern | Abstraction | Testability | Complexity | Learning Curve | Use Case |
|---------|--------|------------|--------|----------|---------|
| **Direct SQL** | Low | Low (needs DB) | Low | Low | Small scripts |
| **ORM only** | Medium | Medium | Low–Medium | Medium | Small to medium apps |
| **Active Record** | Medium | Medium | Low | Low | Rails/Django |
| **Repository** | High | High | Medium | Medium–High | Medium to large apps |
| **Repository + UoW** | High | High | High | High | Large-scale, DDD |
| **CQRS + ES** | Highest | High | Highest | Highest | Complex domains |

### 6.3 Repository Implementation Characteristics by ORM/Library

| ORM / Library | Language | Ease of Repository Implementation | UoW Support | Notes |
|--------------|------|------------------------|-----------|---------|
| **Prisma** | TypeScript | High | $transaction | Type-safe, schema-first |
| **Drizzle** | TypeScript | High | transaction() | SQL-close, lightweight |
| **TypeORM** | TypeScript | Medium | QueryRunner | Built-in Repository pattern |
| **SQLAlchemy** | Python | High | Session | Most flexible, built-in UoW |
| **Django ORM** | Python | Medium | atomic() | Leans toward Active Record |
| **GORM** | Go | Medium | Transaction | Simple but lower type safety |
| **Entity Framework** | C# | High | DbContext | UoW pattern is standard |

---

## 7. Anti-Patterns

### 7.1 Leaking ORM Types into the Repository

```typescript
// BAD: Prisma types leak into the Repository interface
interface UserRepository {
  findMany(args: Prisma.UserFindManyArgs): Promise<PrismaUser[]>;
  //       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^
  //       infrastructure-layer types leaked into domain layer
}

// GOOD: use only domain-layer types
interface UserRepository {
  findAll(options?: FindOptions): Promise<PaginatedResult<User>>;
  //                ^^^^^^^^^^^                            ^^^^
  //                only types defined in the domain layer
}
```

**Why it's BAD**: When switching ORMs (e.g., Prisma to Drizzle), the interface itself must also change, destroying the Repository pattern's "swappable implementation" benefit. The domain layer should not know about infrastructure details (violates DIP).

### 7.2 Treating the Generic Repository as a Silver Bullet

```typescript
// BAD: provides the same CRUD for all entities
interface GenericRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

// Problem: cannot express domain rules
// e.g., "logs cannot be deleted", "settings always have exactly one record"

// GOOD: interface tailored to domain requirements
interface AuditLogRepository {
  append(log: AuditLog): Promise<void>;  // append-only, no deletion
  findByDateRange(from: Date, to: Date): Promise<AuditLog[]>;
  // delete() method is intentionally absent
}

interface AppSettingsRepository {
  get(): Promise<AppSettings>;           // always exactly one record
  update(settings: AppSettings): Promise<void>;
  // findAll() or delete() are not needed
}

interface OrderRepository {
  findById(id: string): Promise<Order>;  // includes Order + OrderItems
  save(order: Order): Promise<void>;     // saves the entire Order + OrderItems at once
  // save persists the whole aggregate; individual OrderItem CRUD is not provided
}
```

**Why it's BAD**: A Generic Repository can only provide the "least common denominator" interface and cannot express domain intent (e.g., "logs are immutable", "aggregates are saved as a whole"). Repositories should be defined in the language of the domain (ubiquitous language).

### 7.3 Executing Business Logic Inside the Repository

```typescript
// BAD: Repository knows about business rules
class PostgresUserRepository implements UserRepository {
  async save(user: User): Promise<User> {
    // Business rule validation mixed into the Repository
    if (!user.email.includes("@")) {
      throw new Error("Invalid email");
    }
    // VIP determination logic inside the Repository
    if (user.purchaseTotal > 100000) {
      user.role = "vip";
    }
    return this.prisma.user.upsert(/* ... */);
  }
}

// GOOD: Repository handles persistence only; business logic belongs in the domain layer
class User {
  // Business rules belong on the entity
  updateEmail(newEmail: string): void {
    if (!newEmail.includes("@")) {
      throw new InvalidEmailError(newEmail);
    }
    this.email = newEmail;
  }

  checkVipStatus(): void {
    if (this.purchaseTotal > 100000) {
      this.role = "vip";
    }
  }
}

class PostgresUserRepository implements UserRepository {
  async save(user: User): Promise<User> {
    // Persistence only. No validation or business logic.
    return this.prisma.user.upsert(/* ... */);
  }
}
```

**Why it's BAD**: The Repository's responsibility is solely to persist and retrieve data. Business logic belongs in Domain Entities or Domain Services. Logic inside the Repository will not execute when testing with an InMemory implementation, reducing test reliability.

### 7.4 Over-Abstraction (YAGNI Violation)

```typescript
// BAD: over-abstracted when only one DB type is in use
interface IRepositoryFactory<T> {
  createRepository(type: "postgres" | "mongo" | "dynamodb"): IRepository<T>;
}

interface IRepository<T> extends ICrudRepository<T>, ISearchRepository<T>, IAuditableRepository<T> {
  // ...
}

// GOOD: abstract when the need actually arises
// If using Prisma directly is sufficient for now:
class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    // ...
  }
}
// Introduce an Interface only when you need to swap in an InMemory version for tests
```

**Why it's BAD**: Adding present complexity for future "possibilities" violates YAGNI. Even the introduction of the Repository pattern itself is fine to defer until the need for testability or data source swapping becomes clear.

---

## 8. Practice Exercises

### Exercise 1 (Basic): Designing a Repository Interface

Design a `PostRepository` interface for a blog service.

**Requirements**:
- CRUD for posts
- Search by tag
- Search by author
- Filter by draft/published status
- Pagination
- Sort by popularity (number of likes)

**Constraint**: Be mindful of DDD aggregates; treat Post as an aggregate that includes Comments (do not create a CommentRepository)

**Expected Output**:
- `PostRepository` interface (TypeScript)
- With JSDoc comments for each method

---

### Exercise 2 (Applied): InMemory Repository + Service Tests

Write tests for the following `BookingService` by implementing `InMemoryRoomRepository` and `InMemoryBookingRepository`.

```typescript
class BookingService {
  constructor(
    private roomRepo: RoomRepository,
    private bookingRepo: BookingRepository,
  ) {}

  async createBooking(roomId: string, userId: string, date: Date): Promise<Booking> {
    const room = await this.roomRepo.findById(roomId);
    if (!room) throw new RoomNotFoundError(roomId);
    if (!room.isAvailable) throw new RoomUnavailableError(roomId);

    const existingBooking = await this.bookingRepo.findByRoomAndDate(roomId, date);
    if (existingBooking) throw new DoubleBookingError(roomId, date);

    const booking = Booking.create(roomId, userId, date);
    return this.bookingRepo.save(booking);
  }
}
```

**Test Cases**:
1. Successful booking
2. Room not found
3. Room unavailable
4. Double booking

**Expected Output**: Implementation of `InMemoryRoomRepository` and `InMemoryBookingRepository`, plus four test cases

---

### Exercise 3 (Advanced): Unit of Work + Specification Pattern

Implement the order processing for an e-commerce site using Unit of Work and the Specification pattern.

**Requirements**:
1. Reduce inventory when an order is created (OrderRepository + ProductRepository)
2. Roll back if stock is insufficient
3. Search for "products with 5 or fewer items in stock" using a Specification
4. Also record an audit log within the transaction

**Expected Output**:
- `LowStockSpec` Specification
- `PlaceOrderUseCase` (using Unit of Work)
- Test code

---

## 9. FAQ

### Q1. Is the Repository pattern necessary even for small projects?

**A.** For small projects (CRUD-centric, 5 or fewer tables), it is often unnecessary. Using the ORM directly is simpler. Consider introducing it when **2 or more** of the following conditions apply:

1. You do not want to use a database in unit tests
2. There is a possibility of changing the DB in the future (e.g., PostgreSQL to DynamoDB)
3. Domain logic is complex and testing the service layer is important
4. Combining multiple data sources (DB + external API + cache)
5. The team is large and a unified interface for the data access layer is needed

In the early stages of a startup, it is practical to start by using the ORM directly and introduce the Repository once the need for testing becomes apparent.

### Q2. Should Repositories be per table or per aggregate?

**A.** If you are following DDD, **"one per aggregate root" is the right answer**. For example, `Order` and `OrderItem` are in separate tables, but they are managed together through a single `OrderRepository`. Without DDD, per-table is fine.

```typescript
// DDD: per aggregate root
interface OrderRepository {
  findById(id: string): Promise<Order>;
  // ↑ returns the entire aggregate including Order + OrderItems + ShippingAddress
  save(order: Order): Promise<void>;
  // ↑ saves Order + OrderItems + ShippingAddress all at once
}

// Non-DDD: per table
interface OrderRepository {
  findById(id: string): Promise<Order>;  // Order only
}
interface OrderItemRepository {
  findByOrderId(orderId: string): Promise<OrderItem[]>;
}
```

The benefit of aggregate-level Repositories is that business rules (e.g., "the sum of OrderItem amounts must match the Order total") can be enforced consistently within the aggregate.

### Q3. When testing the Repository, should I use a real DB or mocks?

**A.** Both are needed. Use them based on the type of test:

```
Test Pyramid:
  ┌─────────────────┐
  │    E2E Tests     │  ← few tests, production-equivalent DB
  ├─────────────────┤
  │ Integration Tests│  ← tests for Repository implementation (TestContainers)
  ├─────────────────┤
  │   Unit Tests     │  ← tests for Services (InMemory Repository)
  └─────────────────┘
```

| Test Type | Repository | Purpose |
|-----------|-----------|------|
| **Unit Tests** | InMemory implementation | Validate Service business logic |
| **Integration Tests** | Real DB (TestContainers) | Validate SQL / ORM correctness |
| **E2E Tests** | Real DB | Validate overall system behavior |

```typescript
// Integration test: start PostgreSQL with TestContainers
describe("PrismaUserRepository (Integration)", () => {
  let prisma: PrismaClient;
  let repo: PrismaUserRepository;

  beforeAll(async () => {
    // Start a PostgreSQL container with Docker
    const container = await new PostgreSqlContainer().start();
    prisma = new PrismaClient({
      datasources: { db: { url: container.getConnectionUri() } },
    });
    await prisma.$executeRaw`CREATE TABLE ...`;
    repo = new PrismaUserRepository(prisma);
  });

  test("save and findById", async () => {
    const user = User.create("Alice", "alice@example.com");
    await repo.save(user);

    const found = await repo.findById(user.id);
    expect(found).not.toBeNull();
    expect(found!.email).toBe("alice@example.com");
  });
});
```

### Q4. Should I use Active Record or Repository?

**A.** It depends on the project's scale and framework:

| Criteria | Active Record | Repository |
|------|---------------|-----------|
| **Framework** | Rails, Django, Laravel | Express, Spring, custom |
| **Project Scale** | Small to medium | Medium to large |
| **Testing Requirements** | Integration test-centric | Unit test-focused |
| **Domain Complexity** | Low to medium | High |
| **Team Size** | Small (1–5 people) | Medium to large (5+ people) |

Active Record (e.g., Rails' `User.find_by(email: ...)`) is the simplest approach when following framework conventions. Repository is appropriate when adopting DDD or Clean Architecture.

### Q5. Should Repository return domain entities or DTOs?

**A.** Returning **domain entities** is correct. The Repository is a domain-layer interface and returns results in the domain's language (Entity, Value Object). Converting to DTOs (Data Transfer Objects) is the responsibility of the Presentation layer (Controller / Serializer).

```typescript
// GOOD: return domain entity
interface UserRepository {
  findById(id: string): Promise<User>;  // ← User is a domain entity
}

// BAD: return DTO
interface UserRepository {
  findById(id: string): Promise<UserResponseDTO>;  // ← this is the Controller's job
}
```

### Q6. Should you incorporate caching into the Repository?

**A.** It is recommended to wrap the Repository using the Decorator pattern. This allows you to add a cache layer without changing the Repository interface:

```typescript
// Repository with caching (Decorator pattern)
class CachedUserRepository implements UserRepository {
  constructor(
    private inner: UserRepository,  // the actual DB Repository
    private cache: CacheClient,     // Redis, etc.
    private ttl: number = 300,      // 5 minutes
  ) {}

  async findById(id: string): Promise<User | null> {
    // 1. Check cache
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return JSON.parse(cached);

    // 2. Fetch from DB
    const user = await this.inner.findById(id);
    if (user) {
      await this.cache.set(`user:${id}`, JSON.stringify(user), this.ttl);
    }
    return user;
  }

  async save(user: User): Promise<User> {
    const saved = await this.inner.save(user);
    // Invalidate cache
    await this.cache.del(`user:${saved.id}`);
    return saved;
  }

  // ... same for other methods
}

// DI setup
const dbRepo = new PrismaUserRepository(prisma);
const cachedRepo = new CachedUserRepository(dbRepo, redis);
container.register<UserRepository>("UserRepository", { useValue: cachedRepo });
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not only through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Point |
|------|---------|
| **Repository** | Abstracts data access. Define the interface in the domain layer and implement it in the infrastructure layer. |
| **DIP** | Upper modules (Service) depend on interfaces (Repository). Concrete implementations are injected. |
| **DDD Aggregates** | One Repository per aggregate root. Entities within an aggregate are accessed only through the Repository. |
| **Testing** | Unit-test the service layer using an InMemory implementation. Test the DB implementation with integration tests (TestContainers). |
| **Unit of Work** | Manages changes across multiple Repositories within a single transaction. Guarantees data consistency. |
| **Specification** | Turns search conditions into objects. Combines conditions (AND, OR, NOT) in a type-safe manner. |
| **Caution** | Avoid over-abstraction; design interfaces suited to domain requirements. Be mindful of YAGNI. |
| **Caching** | Wrap the Repository with the Decorator pattern. Add caching without changing the interface. |

---

## Recommended Next Reads

- [00-mvc-mvvm.md](./00-mvc-mvvm.md) — UI layer architecture patterns (design on the side that uses Repository)
- [02-event-sourcing-cqrs.md](./02-event-sourcing-cqrs.md) — Event-driven design and command/query separation (Repository in CQRS)
- ../../clean-code-principles/ — SOLID principles, details on the Dependency Inversion Principle
- [../02-behavioral/](../02-behavioral/) — Strategy pattern (swapping Repository implementations)
- ../../system-design-guide/ — Database scaling and cache strategies

---

## References

1. **Martin Fowler** — "Patterns of Enterprise Application Architecture" — The original source for the Repository pattern — https://martinfowler.com/eaaCatalog/repository.html
2. **Martin Fowler** — "Unit of Work" — https://martinfowler.com/eaaCatalog/unitOfWork.html
3. **Eric Evans** — "Domain-Driven Design: Tackling Complexity in the Heart of Software" — Addison-Wesley, 2003
4. **Microsoft** — "Implementing the Repository and Unit of Work Patterns" — https://learn.microsoft.com/en-us/aspnet/mvc/overview/older-versions/getting-started-with-ef-5-using-mvc-4/implementing-the-repository-and-unit-of-work-patterns-in-an-asp-net-mvc-application
5. **Robert C. Martin** — "Clean Architecture" (2017) — Dependency Inversion Principle and the role of Repository
6. **Prisma Documentation** — "Repository pattern with Prisma" — https://www.prisma.io/docs/guides
7. **Vaughn Vernon** — "Implementing Domain-Driven Design" (2013) — Relationship between aggregates and Repository
