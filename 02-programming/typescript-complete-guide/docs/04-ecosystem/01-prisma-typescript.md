# Prisma + TypeScript Complete Guide

> Maximize TypeScript's type safety with Prisma ORM for robust database operations

## What You Will Learn

1. **Prisma Basics** -- Schema definition, migrations, and type-safe CRUD operations
2. **Advanced Query Patterns** -- Type-safe handling of relations, transactions, and raw SQL
3. **Practical Design** -- Repository pattern, testing strategies, and performance tuning
4. **Operations and Scaling** -- Connection pooling, Edge Runtime support, monitoring and logging


## Prerequisites

Before reading this guide, the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Zod Validation Complete Guide](./00-zod-validation.md)

---

## 1. Prisma Basics

### 1-1. Setup

```bash
# Install
npm install prisma --save-dev
npm install @prisma/client

# Initialize
npx prisma init --datasource-provider postgresql
```

```
Prisma Architecture:

  schema.prisma          npx prisma generate
  (schema definition) ─────────────────────────>  @prisma/client
       |                                           (typed client)
       |                                                |
  npx prisma migrate                                    |
       |                                                |
       v                                                v
  Database  <──── SQL queries ──── PrismaClient
  (PostgreSQL, etc.)                (runtime)
```

Prisma consists of 3 main components.

```
┌──────────────────────────────────────────────────┐
│                  Prisma Ecosystem                 │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐│
│  │   Prisma     │  │   Prisma     │  │  Prisma  ││
│  │   Schema     │  │   Client     │  │  Studio  ││
│  │              │  │              │  │          ││
│  │ Define       │  │ Type-safe    │  │ GUI tool ││
│  │ models in    │  │ DB access    │  │ for data ││
│  │ .prisma      │  │ via          │  │ view/    ││
│  │ files        │  │ @prisma/     │  │ edit     ││
│  │              │  │ client       │  │          ││
│  └──────┬───────┘  └──────┬───────┘  └──────────┘│
│         │                 │                       │
│         │  npx prisma     │                       │
│         │  generate       │                       │
│         └────────────────>┘                       │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │   Prisma     │  │   Prisma     │               │
│  │   Migrate    │  │   Accelerate │               │
│  │              │  │              │               │
│  │ Auto-        │  │ Connection   │               │
│  │ generate     │  │ pooling +    │               │
│  │ SQL from     │  │ global       │               │
│  │ schema diff  │  │ cache        │               │
│  └──────────────┘  └──────────────┘               │
└──────────────────────────────────────────────────┘
```

### 1-2. Schema Definition

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@map("users")
}

model Post {
  id          String     @id @default(uuid())
  title       String
  content     String?
  published   Boolean    @default(false)
  author      User       @relation(fields: [authorId], references: [id])
  authorId    String
  categories  Category[]
  tags        Tag[]
  comments    Comment[]
  viewCount   Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([authorId])
  @@index([published, createdAt])
  @@map("posts")
}

model Comment {
  id        String   @id @default(uuid())
  content   String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId    String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  parent    Comment? @relation("CommentReplies", fields: [parentId], references: [id])
  parentId  String?
  replies   Comment[] @relation("CommentReplies")
  createdAt DateTime @default(now())

  @@index([postId])
  @@index([authorId])
  @@map("comments")
}

model Profile {
  id     String  @id @default(uuid())
  bio    String?
  avatar String?
  user   User    @relation(fields: [userId], references: [id])
  userId String  @unique

  @@map("profiles")
}

model Category {
  id    String @id @default(uuid())
  name  String @unique
  slug  String @unique
  posts Post[]

  @@map("categories")
}

model Tag {
  id    String @id @default(uuid())
  name  String @unique
  posts Post[]

  @@map("tags")
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

#### Schema Design Best Practices

| Item | Recommendation | Reason |
|------|------|------|
| ID type | `uuid()` or `cuid()` | Sequential IDs are guessable; risk of collision in distributed systems |
| Timestamps | `createdAt` + `updatedAt` | Essential for audit trails and debugging |
| Table names | `@@map("snake_case")` | Follow DB conventions while keeping model names in PascalCase |
| Indexes | `@@index` for search conditions | Directly impacts query performance |
| Composite unique | `@@unique([fieldA, fieldB])` | Enforce business rules as DB-level constraints |
| onDelete | Explicitly specified | Intentionally choose `Cascade` / `SetNull` / `Restrict` |
| enum | Prisma enum | Maps to DB enum, ensures type safety |

#### Relation Design Patterns

```
Relation Types:

  One-to-One
  ┌──────┐     ┌─────────┐
  │ User │────>│ Profile  │
  └──────┘     └─────────┘
  Enforced by userId: @unique

  One-to-Many
  ┌──────┐     ┌──────┐
  │ User │────>│ Post │
  │      │────>│ Post │
  │      │────>│ Post │
  └──────┘     └──────┘
  posts Post[]  ←→  author User

  Many-to-Many
  ┌──────┐     ┌──────────┐
  │ Post │<──>>│ Category │
  │      │<──>>│ Category │
  └──────┘     └──────────┘
  Implicit join table _CategoryToPost is auto-generated

  Self-Relation
  ┌──────────┐
  │ Comment  │
  │  parent ─┼──┐
  │  replies ─┼──┘
  └──────────┘
  parentId references the parent comment
```

### 1-3. Migrations

```bash
# Create and apply migration
npx prisma migrate dev --name init

# Apply to production
npx prisma migrate deploy

# Sync schema (development, no migration file)
npx prisma db push

# Regenerate client
npx prisma generate

# Inspect data via GUI
npx prisma studio

# Reset migrations (development only)
npx prisma migrate reset

# Check migration diff (show SQL without applying)
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma
```

#### Migration Strategy Comparison

| Situation | Command | Purpose |
|------|---------|------|
| Development changes | `prisma migrate dev` | Generate migration file and apply immediately |
| Prototyping | `prisma db push` | Reflect changes instantly without migration files |
| CI/CD | `prisma migrate deploy` | Apply existing migrations in order |
| Regenerate types only | `prisma generate` | Regenerate client code without touching DB |
| Full reset | `prisma migrate reset` | Re-apply all migrations (deletes data) |

#### Common Migration Pitfalls

```typescript
// Problem: Adding a column to production DB without a default value
// → Existing records cannot be updated due to NOT NULL constraint violation

// Solution: Staged migration
// Step 1: Add column as nullable
model User {
  displayName String? // Add as nullable first
}

// Step 2: Backfill existing data
// prisma/migrations/xxx_backfill_display_name.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfill() {
  const users = await prisma.user.findMany({
    where: { displayName: null },
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { displayName: user.name },
    });
  }
}

backfill();

// Step 3: Add NOT NULL constraint
model User {
  displayName String @default("") // Change to NOT NULL
}
```

### 1-4. PrismaClient Initialization Patterns

```typescript
// lib/prisma.ts -- Singleton pattern (recommended)
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

```typescript
// Why is a singleton necessary?
// ─────────────────────────────────────────────
// In Next.js development mode, modules are re-evaluated on every
// hot reload. If new PrismaClient() runs each time,
// the connection pool grows indefinitely and eventually
// hits the DB's connection limit.
//
// By caching on globalThis, we reuse the same instance
// across hot reloads.
```

#### Log Configuration Details

```typescript
const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "stdout" },
    { level: "info", emit: "stdout" },
    { level: "warn", emit: "stdout" },
  ],
});

// Send query logs to a custom logger
prisma.$on("query", (e) => {
  console.log(`[Prisma Query] ${e.query}`);
  console.log(`  Params: ${e.params}`);
  console.log(`  Duration: ${e.duration}ms`);

  // Detect slow queries
  if (e.duration > 1000) {
    console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query}`);
  }
});
```

---

## 2. Type-Safe CRUD Operations

### 2-1. Basic CRUD

```typescript
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ────────── Create ──────────
const user = await prisma.user.create({
  data: {
    email: "alice@example.com",
    name: "Alice",
    role: "ADMIN", // Autocomplete works with enum literal types
  },
});
// Type: User

// Bulk create with createMany
const result = await prisma.user.createMany({
  data: [
    { email: "bob@example.com", name: "Bob" },
    { email: "carol@example.com", name: "Carol" },
    { email: "dave@example.com", name: "Dave" },
  ],
  skipDuplicates: true, // Skip duplicates
});
// Type: Prisma.BatchPayload { count: number }

// ────────── Read ──────────
const found = await prisma.user.findUnique({
  where: { email: "alice@example.com" },
});
// Type: User | null

// findUniqueOrThrow: throws if not found
const mustExist = await prisma.user.findUniqueOrThrow({
  where: { email: "alice@example.com" },
});
// Type: User (no null)

const users = await prisma.user.findMany({
  where: {
    role: "USER",
    createdAt: { gte: new Date("2024-01-01") },
  },
  orderBy: { createdAt: "desc" },
  take: 10,
  skip: 0,
});
// Type: User[]

// findFirst: retrieve the first matching record
const firstAdmin = await prisma.user.findFirst({
  where: { role: "ADMIN" },
  orderBy: { createdAt: "asc" },
});
// Type: User | null

// ────────── Update ──────────
const updated = await prisma.user.update({
  where: { id: user.id },
  data: { name: "Alice Smith" },
});
// Type: User

// upsert: update if exists, create otherwise
const upserted = await prisma.user.upsert({
  where: { email: "alice@example.com" },
  update: { name: "Alice Updated" },
  create: {
    email: "alice@example.com",
    name: "Alice",
  },
});

// updateMany: update all matching records
const bulkUpdate = await prisma.user.updateMany({
  where: { role: "USER" },
  data: { role: "MODERATOR" },
});
// Type: Prisma.BatchPayload

// ────────── Delete ──────────
const deleted = await prisma.user.delete({
  where: { id: user.id },
});

// deleteMany: delete all matching records
const bulkDelete = await prisma.post.deleteMany({
  where: {
    published: false,
    createdAt: { lt: new Date("2023-01-01") },
  },
});

// ────────── Aggregate ──────────
const stats = await prisma.post.aggregate({
  _count: { _all: true },
  _avg: { viewCount: true },
  _max: { viewCount: true },
  _min: { viewCount: true },
  where: { published: true },
});
// Type: {
//   _count: { _all: number };
//   _avg: { viewCount: number | null };
//   _max: { viewCount: number | null };
//   _min: { viewCount: number | null };
// }

// groupBy: group aggregation
const postsByRole = await prisma.user.groupBy({
  by: ["role"],
  _count: { _all: true },
  having: {
    role: {
      _count: { gt: 5 },
    },
  },
  orderBy: {
    _count: { role: "desc" },
  },
});
```

### 2-2. Filtering Operators

```typescript
// Prisma's Where conditions are highly expressive

// String filters
const search = await prisma.user.findMany({
  where: {
    name: {
      contains: "ali",   // LIKE '%ali%'
      startsWith: "A",   // LIKE 'A%'
      endsWith: "ce",    // LIKE '%ce'
      mode: "insensitive", // Case-insensitive (PostgreSQL)
    },
  },
});

// Numeric filters
const popular = await prisma.post.findMany({
  where: {
    viewCount: {
      gt: 100,    // > 100
      gte: 50,    // >= 50
      lt: 10000,  // < 10000
      lte: 500,   // <= 500
      not: 0,     // != 0
    },
  },
});

// List filters
const adminsOrMods = await prisma.user.findMany({
  where: {
    role: { in: ["ADMIN", "MODERATOR"] },
    // role: { notIn: ["USER"] }, // Inverse condition
  },
});

// Logical operators
const complex = await prisma.user.findMany({
  where: {
    OR: [
      { role: "ADMIN" },
      {
        AND: [
          { role: "MODERATOR" },
          { createdAt: { gte: new Date("2024-01-01") } },
        ],
      },
    ],
    NOT: {
      email: { contains: "test" },
    },
  },
});

// Relation conditions (some / every / none)
const usersWithPublishedPosts = await prisma.user.findMany({
  where: {
    posts: {
      some: { published: true },  // Has at least one published post
    },
  },
});

const usersWithAllPublished = await prisma.user.findMany({
  where: {
    posts: {
      every: { published: true }, // All posts are published
    },
  },
});

const usersWithNoPosts = await prisma.user.findMany({
  where: {
    posts: {
      none: {}, // Has no posts at all
    },
  },
});
```

### 2-3. Fetching Relations

```
Difference between select and include:

  include: existing fields + relations
  +------------------+
  | id               |
  | email            |
  | name             |  ← all fields preserved
  | role             |
  | posts: Post[]    |  ← relation added
  +------------------+

  select: only specified fields
  +------------------+
  | name             |  ← only specified fields
  | email            |
  | posts: { title } |  ← relations can also be selected
  +------------------+

  Note: select and include cannot be used together at the top level
```

```typescript
// Fetch relations with include
const userWithPosts = await prisma.user.findUnique({
  where: { id: "user-1" },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        categories: true,   // Nested relation
        _count: {
          select: { comments: true },
        },
      },
    },
    profile: true,
  },
});
// Type: (User & {
//   posts: (Post & {
//     categories: Category[];
//     _count: { comments: number };
//   })[];
//   profile: Profile | null;
// }) | null

// Fetch only required fields with select
const userSummary = await prisma.user.findUnique({
  where: { id: "user-1" },
  select: {
    name: true,
    email: true,
    posts: {
      select: {
        title: true,
        createdAt: true,
      },
      where: { published: true },
    },
    _count: {
      select: { posts: true },
    },
  },
});
// Type: {
//   name: string;
//   email: string;
//   posts: { title: string; createdAt: Date }[];
//   _count: { posts: number };
// } | null
```

### 2-4. Nested Create and Update

```typescript
// Create user and related data in one operation
const newUser = await prisma.user.create({
  data: {
    email: "bob@example.com",
    name: "Bob",
    profile: {
      create: {
        bio: "Hello, I'm Bob",
        avatar: "https://example.com/avatar.png",
      },
    },
    posts: {
      create: [
        {
          title: "First Post",
          content: "Hello World",
          published: true,
          categories: {
            connectOrCreate: [
              {
                where: { name: "General" },
                create: { name: "General", slug: "general" },
              },
            ],
          },
        },
        { title: "Draft", content: "WIP" },
      ],
    },
  },
  include: {
    profile: true,
    posts: { include: { categories: true } },
  },
});

// connectOrCreate: connect if exists, create otherwise
const post = await prisma.post.create({
  data: {
    title: "TypeScript Tips",
    author: { connect: { email: "alice@example.com" } },
    categories: {
      connectOrCreate: [
        {
          where: { name: "TypeScript" },
          create: { name: "TypeScript", slug: "typescript" },
        },
        {
          where: { name: "Programming" },
          create: { name: "Programming", slug: "programming" },
        },
      ],
    },
  },
});

// Nested update
const updatedUser = await prisma.user.update({
  where: { id: "user-1" },
  data: {
    name: "Bob Updated",
    profile: {
      upsert: {
        create: { bio: "New bio" },
        update: { bio: "Updated bio" },
      },
    },
    posts: {
      updateMany: {
        where: { published: false },
        data: { published: true },
      },
      deleteMany: {
        createdAt: { lt: new Date("2023-01-01") },
      },
    },
  },
});
```

### 2-5. Prisma Type Utilities

```typescript
import { Prisma } from "@prisma/client";

// ───── Leverage generated types ─────

// Model input types
type UserCreateInput = Prisma.UserCreateInput;
// { email: string; name: string; role?: Role; ... }

type UserWhereInput = Prisma.UserWhereInput;
// { id?: StringFilter; email?: StringFilter; ... }

type UserOrderByInput = Prisma.UserOrderByWithRelationInput;
// { id?: SortOrder; email?: SortOrder; ... }

// Infer return types based on select / include
type UserWithPosts = Prisma.UserGetPayload<{
  include: { posts: true; profile: true };
}>;
// User & { posts: Post[]; profile: Profile | null }

type UserSummary = Prisma.UserGetPayload<{
  select: { id: true; name: true; email: true };
}>;
// { id: string; name: string; email: string }

// ───── Integration with validators ─────

// Define a zod schema based on Prisma's UserCreateInput
import { z } from "zod";

const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["USER", "ADMIN", "MODERATOR"]).optional(),
}) satisfies z.ZodType<Omit<Prisma.UserCreateInput, "posts" | "profile">>;

// Type-safe query objects using Prisma.validator
const userWithPostsQuery = Prisma.validator<Prisma.UserFindManyArgs>()({
  where: { role: "ADMIN" },
  include: {
    posts: {
      where: { published: true },
      select: { id: true, title: true },
    },
  },
});

// Make this definition reusable
async function getAdminUsers() {
  return prisma.user.findMany(userWithPostsQuery);
}

// Return type is also automatically inferred
type AdminUsersResult = Prisma.PromiseReturnType<typeof getAdminUsers>;
```

---

## 3. Advanced Query Patterns

### 3-1. Transactions

```typescript
// ───── Method 1: Interactive Transaction (recommended) ─────
const transfer = await prisma.$transaction(async (tx) => {
  // tx has the same API as PrismaClient but runs within a transaction
  const sender = await tx.user.update({
    where: { id: senderId },
    data: { balance: { decrement: amount } },
  });

  if (sender.balance < 0) {
    throw new Error("Insufficient balance");
    // → Entire transaction is rolled back
  }

  const receiver = await tx.user.update({
    where: { id: receiverId },
    data: { balance: { increment: amount } },
  });

  // Record transfer log
  await tx.transferLog.create({
    data: {
      senderId,
      receiverId,
      amount,
      timestamp: new Date(),
    },
  });

  return { sender, receiver };
}, {
  timeout: 5000,                    // Timeout
  maxWait: 2000,                    // Max wait time to acquire transaction
  isolationLevel: "Serializable",   // Isolation level
});

// ───── Method 2: Batch Transaction ─────
// Pass multiple operations as an array (all succeed or all roll back)
const [user, post, comment] = await prisma.$transaction([
  prisma.user.create({ data: { email: "x@x.com", name: "X" } }),
  prisma.post.create({ data: { title: "P", authorId: "..." } }),
  prisma.comment.create({ data: { content: "C", postId: "...", authorId: "..." } }),
]);
// Return value is an array (result of each operation)

// ───── Method 3: Optimistic Lock Pattern ─────
async function updateWithOptimisticLock(
  postId: string,
  expectedVersion: number,
  newTitle: string
): Promise<Post> {
  const result = await prisma.post.updateMany({
    where: {
      id: postId,
      version: expectedVersion, // Check version number
    },
    data: {
      title: newTitle,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    throw new Error("Optimistic lock conflict: record was modified by another transaction");
  }

  return prisma.post.findUniqueOrThrow({ where: { id: postId } });
}
```

#### Transaction Isolation Level Comparison

```
Isolation levels and concurrency issues:

  ┌────────────────────┬──────────┬──────────────┬─────────────┐
  │ Isolation Level    │ Dirty    │ Non-repeatable│ Phantom    │
  │                    │ Read     │ Read          │ Read       │
  ├────────────────────┼──────────┼──────────────┼─────────────┤
  │ ReadUncommitted    │ Yes      │ Yes           │ Yes         │
  │ ReadCommitted      │ No       │ Yes           │ Yes         │
  │ RepeatableRead     │ No       │ No            │ Yes         │
  │ Serializable       │ No       │ No            │ No          │
  └────────────────────┴──────────┴──────────────┴─────────────┘

  Higher = better performance
  Lower = stronger consistency
```

### 3-2. Prisma Client Extensions

```typescript
// ───── Adding custom methods ─────
const xprisma = prisma.$extends({
  model: {
    user: {
      async findByEmail(email: string) {
        return prisma.user.findUnique({
          where: { email },
          include: { profile: true },
        });
      },

      async softDelete(id: string) {
        return prisma.user.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      },

      async exists(id: string): Promise<boolean> {
        const count = await prisma.user.count({
          where: { id },
        });
        return count > 0;
      },
    },

    post: {
      async publish(id: string) {
        return prisma.post.update({
          where: { id },
          data: {
            published: true,
            publishedAt: new Date(),
          },
        });
      },

      async incrementViewCount(id: string) {
        return prisma.post.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
        });
      },
    },
  },

  // Middleware-like extensions for queries
  query: {
    user: {
      // Automatically add soft delete condition to all findMany
      async findMany({ model, operation, args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      // Also apply to findUnique
      async findUnique({ args, query }) {
        args.where = { ...args.where, deletedAt: null } as any;
        return query(args);
      },
    },
    // Query logging common to all models
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const start = performance.now();
        const result = await query(args);
        const end = performance.now();
        console.log(`${model}.${operation} took ${end - start}ms`);
        return result;
      },
    },
  },

  // Transform results
  result: {
    user: {
      fullName: {
        needs: { name: true },
        compute(user) {
          return user.name.toUpperCase();
        },
      },
    },
  },
});

// Using extended methods
const user = await xprisma.user.findByEmail("alice@example.com");
const exists = await xprisma.user.exists("user-123");
await xprisma.post.publish("post-456");
```

### 3-3. Type-Safe Raw SQL

```typescript
// Prisma's typed SQL (Prisma 5.x+)
import { Prisma } from "@prisma/client";

// ───── $queryRaw: SELECT queries ─────
interface UserPostCount {
  id: string;
  name: string;
  post_count: bigint;
}

const minPosts = 5;
const users = await prisma.$queryRaw<UserPostCount[]>`
  SELECT u.id, u.name, COUNT(p.id) as post_count
  FROM users u
  LEFT JOIN posts p ON u.id = p."authorId"
  WHERE u.role = 'USER'
  GROUP BY u.id, u.name
  HAVING COUNT(p.id) > ${minPosts}
  ORDER BY post_count DESC
`;

// Note: bigint cannot be JSON serialized, so conversion is needed
const serializable = users.map((u) => ({
  ...u,
  post_count: Number(u.post_count),
}));

// ───── $executeRaw: INSERT/UPDATE/DELETE ─────
const affectedRows = await prisma.$executeRaw`
  UPDATE posts
  SET "viewCount" = "viewCount" + 1
  WHERE id = ${postId}
`;
// Type: number (number of affected rows)

// ───── Safely build queries with Prisma.sql ─────
function buildSearchQuery(
  searchTerm: string,
  role?: string,
  limit: number = 10
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`u.name ILIKE ${`%${searchTerm}%`}`,
  ];

  if (role) {
    conditions.push(Prisma.sql`u.role = ${role}`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  return prisma.$queryRaw<{ id: string; name: string; role: string }[]>`
    SELECT u.id, u.name, u.role
    FROM users u
    WHERE ${whereClause}
    LIMIT ${limit}
  `;
}

// ───── TypedSQL (Prisma 5.9+) ─────
// Create prisma/sql/getUserStats.sql:
// SELECT u.id, u.name, COUNT(p.id) as "postCount"
// FROM users u LEFT JOIN posts p ON u.id = p."authorId"
// WHERE u.role = $1
// GROUP BY u.id

// Generate types with npx prisma generate --sql
import { getUserStats } from "@prisma/client/sql";

const stats = await prisma.$queryRawTyped(getUserStats("ADMIN"));
// Type: { id: string; name: string; postCount: number }[]
```

### 3-4. Pagination

```typescript
// ───── Offset-based (traditional) ─────
async function getPaginatedUsers(page: number, pageSize: number) {
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
  ]);

  return {
    data: users,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    },
  };
}

// ───── Cursor-based (for large datasets, recommended) ─────
async function getCursorPaginatedPosts(
  cursor?: string,
  take: number = 20
) {
  const posts = await prisma.post.findMany({
    take: take + 1, // Fetch one extra to determine hasNext
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1, // Skip the cursor itself
        }
      : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  });

  const hasNext = posts.length > take;
  const data = hasNext ? posts.slice(0, -1) : posts;
  const nextCursor = hasNext ? data[data.length - 1].id : null;

  return {
    data,
    meta: {
      hasNext,
      nextCursor,
    },
  };
}
```

```
Pagination method comparison:

  Offset-based:
  ┌────────────────────────────────────────────┐
  │ Page 1    │ Page 2    │ Page 3    │ ...    │
  │ skip=0    │ skip=20   │ skip=40   │        │
  │ take=20   │ take=20   │ take=20   │        │
  └────────────────────────────────────────────┘
  ✅ Can jump to a specific page number
  ❌ Slows down with large datasets (larger OFFSET = slower)
  ❌ Page shift occurs when data is inserted/deleted

  Cursor-based:
  ┌────────────┐  cursor  ┌────────────┐  cursor  ┌──────┐
  │ Chunk 1    │───────>  │ Chunk 2    │───────>  │ ...  │
  │ after: null│          │ after: id20│          │      │
  └────────────┘          └────────────┘          └──────┘
  ✅ Consistent speed even with large datasets
  ✅ Less affected by data changes
  ❌ Cannot jump to a specific page number
  ❌ Slightly more complex implementation
```

### 3-5. Full-Text Search

```typescript
// PostgreSQL full-text search (Prisma 4.x+)
// Add preview feature to schema.prisma:
// generator client {
//   provider        = "prisma-client-js"
//   previewFeatures = ["fullTextSearch", "fullTextIndex"]
// }

const results = await prisma.post.findMany({
  where: {
    // PostgreSQL text search operators
    title: { search: "TypeScript & Prisma" },
    content: { search: "type-safe | ORM" },
  },
  orderBy: {
    _relevance: {
      fields: ["title", "content"],
      search: "TypeScript Prisma",
      sort: "desc",
    },
  },
});
```

---

## 4. Repository Pattern

```
Repository Pattern:

  Controller / Service
       |
       v
  +-------------------+
  | IUserRepository   |  ← Interface
  +-------------------+
       |            |
       v            v
  +-----------+  +-----------+
  |PrismaUser |  |MockUser   |
  |Repository |  |Repository |
  +-----------+  +-----------+
  (production)   (testing)
```

### 4-1. Generic Repository Interface

```typescript
// Generic repository interface
interface PaginationParams {
  page: number;
  pageSize: number;
}

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface IRepository<T, CreateInput, UpdateInput> {
  findById(id: string): Promise<T | null>;
  findMany(params?: PaginationParams): Promise<PaginatedResult<T>>;
  create(data: CreateInput): Promise<T>;
  update(id: string, data: UpdateInput): Promise<T>;
  delete(id: string): Promise<void>;
  count(where?: Partial<T>): Promise<number>;
}
```

### 4-2. User Repository Implementation

```typescript
// Interface
interface IUserRepository extends IRepository<User, CreateUserDto, UpdateUserDto> {
  findByEmail(email: string): Promise<User | null>;
  findByRole(role: Role): Promise<User[]>;
  findWithPosts(id: string): Promise<(User & { posts: Post[] }) | null>;
  existsByEmail(email: string): Promise<boolean>;
}

type CreateUserDto = {
  email: string;
  name: string;
  role?: Role;
};

type UpdateUserDto = Partial<CreateUserDto>;

// Prisma implementation
class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByRole(role: Role): Promise<User[]> {
    return this.prisma.user.findMany({ where: { role } });
  }

  async findWithPosts(id: string): Promise<(User & { posts: Post[] }) | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        posts: {
          where: { published: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async findMany(params?: PaginationParams): Promise<PaginatedResult<User>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async create(data: CreateUserDto): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async count(where?: Partial<User>): Promise<number> {
    return this.prisma.user.count({ where: where as any });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email },
    });
    return count > 0;
  }
}

// Mock implementation (for testing)
class InMemoryUserRepository implements IUserRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findByRole(role: Role): Promise<User[]> {
    return this.users.filter((u) => u.role === role);
  }

  async findWithPosts(id: string): Promise<(User & { posts: Post[] }) | null> {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    return { ...user, posts: [] };
  }

  async findMany(params?: PaginationParams): Promise<PaginatedResult<User>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const data = this.users.slice(start, start + pageSize);

    return {
      data,
      meta: {
        total: this.users.length,
        page,
        pageSize,
        totalPages: Math.ceil(this.users.length / pageSize),
      },
    };
  }

  async create(data: CreateUserDto): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      ...data,
      role: data.role ?? "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) throw new Error("User not found");
    this.users[index] = {
      ...this.users[index],
      ...data,
      updatedAt: new Date(),
    };
    return this.users[index];
  }

  async delete(id: string): Promise<void> {
    this.users = this.users.filter((u) => u.id !== id);
  }

  async count(): Promise<number> {
    return this.users.length;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.users.some((u) => u.email === email);
  }

  // Test helpers
  clear(): void {
    this.users = [];
  }

  seed(users: User[]): void {
    this.users = [...users];
  }
}
```

### 4-3. Usage in the Service Layer

```typescript
class UserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly logger: ILogger
  ) {}

  async registerUser(data: CreateUserDto): Promise<User> {
    // Business rule validation
    const existing = await this.userRepo.existsByEmail(data.email);
    if (existing) {
      throw new ConflictError(`Email ${data.email} is already registered`);
    }

    // Create user
    const user = await this.userRepo.create(data);

    // Send welcome email
    await this.emailService.send(
      user.email,
      "Welcome!",
      `Hello ${user.name}, welcome to our platform!`
    );

    this.logger.info("User registered", { userId: user.id });
    return user;
  }

  async getUserProfile(id: string): Promise<User & { posts: Post[] }> {
    const user = await this.userRepo.findWithPosts(id);
    if (!user) {
      throw new NotFoundError(`User ${id} not found`);
    }
    return user;
  }
}
```

---

## 5. Testing Strategy

### 5-1. Test Environment Setup

```typescript
// test/setup.ts -- Prisma client for testing
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/test_db";

let prisma: PrismaClient;

// Pre-processing for the entire test suite
beforeAll(async () => {
  // Run migrations on the test DB
  execSync("npx prisma migrate deploy", {
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
  });

  prisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });

  await prisma.$connect();
});

// Pre-processing for each test (clean up tables)
beforeEach(async () => {
  // Note the deletion order respects relations
  await prisma.$transaction([
    prisma.comment.deleteMany(),
    prisma.post.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.user.deleteMany(),
    prisma.category.deleteMany(),
    prisma.tag.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
```

```yaml
# docker-compose.test.yml
version: "3.8"
services:
  test-db:
    image: postgres:16-alpine
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: test_db
    tmpfs:
      - /var/lib/postgresql/data  # Run in memory for speed
```

### 5-2. Integration Tests

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../setup";

describe("User CRUD Integration Tests", () => {
  it("should create a user with profile", async () => {
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
        profile: {
          create: { bio: "Hello" },
        },
      },
      include: { profile: true },
    });

    expect(user.email).toBe("test@example.com");
    expect(user.profile).not.toBeNull();
    expect(user.profile!.bio).toBe("Hello");
  });

  it("should enforce unique email constraint", async () => {
    await prisma.user.create({
      data: { email: "dup@example.com", name: "User 1" },
    });

    await expect(
      prisma.user.create({
        data: { email: "dup@example.com", name: "User 2" },
      })
    ).rejects.toThrow();
  });

  it("should cascade delete posts when user is deleted", async () => {
    const user = await prisma.user.create({
      data: {
        email: "author@example.com",
        name: "Author",
        posts: {
          create: [
            { title: "Post 1", published: true },
            { title: "Post 2", published: false },
          ],
        },
      },
    });

    // Post count before user deletion
    const beforeCount = await prisma.post.count({
      where: { authorId: user.id },
    });
    expect(beforeCount).toBe(2);

    // Delete user (when Cascade is configured)
    await prisma.user.delete({ where: { id: user.id } });

    // Confirm posts are also deleted
    const afterCount = await prisma.post.count({
      where: { authorId: user.id },
    });
    expect(afterCount).toBe(0);
  });

  it("should correctly paginate results", async () => {
    // Create 15 test records
    await prisma.user.createMany({
      data: Array.from({ length: 15 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
      })),
    });

    // Page 1 (10 records)
    const page1 = await prisma.user.findMany({
      take: 10,
      skip: 0,
      orderBy: { email: "asc" },
    });
    expect(page1).toHaveLength(10);

    // Page 2 (5 records)
    const page2 = await prisma.user.findMany({
      take: 10,
      skip: 10,
      orderBy: { email: "asc" },
    });
    expect(page2).toHaveLength(5);
  });
});
```

### 5-3. Repository Unit Tests

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("UserService with InMemoryRepository", () => {
  let userService: UserService;
  let userRepo: InMemoryUserRepository;
  let emailService: MockEmailService;
  let logger: MockLogger;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    emailService = new MockEmailService();
    logger = new MockLogger();
    userService = new UserService(userRepo, emailService, logger);
  });

  it("should register a new user", async () => {
    const user = await userService.registerUser({
      email: "new@example.com",
      name: "New User",
    });

    expect(user.email).toBe("new@example.com");
    expect(user.name).toBe("New User");

    // Confirm email was sent
    expect(emailService.sentEmails).toHaveLength(1);
    expect(emailService.sentEmails[0].to).toBe("new@example.com");

    // Confirm log was recorded
    expect(logger.infoMessages).toHaveLength(1);
  });

  it("should throw ConflictError for duplicate email", async () => {
    await userService.registerUser({
      email: "dup@example.com",
      name: "User 1",
    });

    await expect(
      userService.registerUser({
        email: "dup@example.com",
        name: "User 2",
      })
    ).rejects.toThrow(ConflictError);

    // Email should have been sent only once
    expect(emailService.sentEmails).toHaveLength(1);
  });

  it("should return user with posts", async () => {
    const user = await userRepo.create({
      email: "author@example.com",
      name: "Author",
    });

    const profile = await userService.getUserProfile(user.id);
    expect(profile.posts).toEqual([]);
  });

  it("should throw NotFoundError for non-existent user", async () => {
    await expect(
      userService.getUserProfile("non-existent-id")
    ).rejects.toThrow(NotFoundError);
  });
});

// Mock implementations
class MockEmailService implements IEmailService {
  sentEmails: { to: string; subject: string; body: string }[] = [];

  async send(to: string, subject: string, body: string): Promise<void> {
    this.sentEmails.push({ to, subject, body });
  }
}

class MockLogger implements ILogger {
  infoMessages: string[] = [];
  errorMessages: string[] = [];

  info(message: string): void {
    this.infoMessages.push(message);
  }
  error(message: string): void {
    this.errorMessages.push(message);
  }
}
```

---

## 6. Performance Optimization

### 6-1. Detecting and Solving N+1 Problems

```typescript
// ───── NG: Queries inside a loop (N+1 problem) ─────
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
  // 1 + N queries are issued
}

// ───── OK: Fetch all at once with include ─────
const usersWithPosts = await prisma.user.findMany({
  include: {
    posts: true,
  },
});
// Completed with 2 queries (users + posts)

// ───── OK: Pre-fetch all posts and map them ─────
const users = await prisma.user.findMany();
const posts = await prisma.post.findMany({
  where: { authorId: { in: users.map((u) => u.id) } },
});

const postsByAuthor = new Map<string, Post[]>();
for (const post of posts) {
  const existing = postsByAuthor.get(post.authorId) ?? [];
  postsByAuthor.set(post.authorId, [...existing, post]);
}

const result = users.map((user) => ({
  ...user,
  posts: postsByAuthor.get(user.id) ?? [],
}));
```

### 6-2. Narrowing Required Fields with select

```typescript
// NG: Fetch all fields (includes unnecessary data)
const users = await prisma.user.findMany();
// → id, email, name, role, createdAt, updatedAt all retrieved

// OK: Fetch only required fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
  },
});
// → Only 3 fields. Reduces data transfer from DB and memory usage
```

### 6-3. Index Strategy

```prisma
// Index design aligned with frequently used queries

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())

  // Single-column index
  @@index([authorId])

  // Composite index (for fetching published posts in descending order)
  @@index([published, createdAt(sort: Desc)])

  // Covering index (includes all columns needed by the query)
  @@index([authorId, published, createdAt])

  @@map("posts")
}

model User {
  id    String @id @default(uuid())
  email String @unique  // unique also serves as an index
  name  String

  // Partial index (PostgreSQL)
  // Not directly supported in schema.prisma,
  // so add manually in migration SQL:
  // CREATE INDEX idx_active_users ON users (email) WHERE deleted_at IS NULL;

  @@map("users")
}
```

### 6-4. Connection Pooling

```typescript
// PrismaClient connection configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Specify pooling parameters in DATABASE_URL
// postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30
```

```
Connection pooling architecture:

  Challenge in serverless environments:
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ Lambda  │  │ Lambda  │  │ Lambda  │  × N instances
  │ Instance│  │ Instance│  │ Instance│
  └────┬────┘  └────┬────┘  └────┬────┘
       │           │            │
       v           v            v
  ┌────────────────────────────────────┐
  │          PostgreSQL                │
  │   max_connections = 100            │ ← Exhausted quickly!
  └────────────────────────────────────┘

  Solved with Prisma Accelerate / PgBouncer:
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ Lambda  │  │ Lambda  │  │ Lambda  │
  └────┬────┘  └────┬────┘  └────┬────┘
       │           │            │
       v           v            v
  ┌────────────────────────────────────┐
  │     Connection Pooler              │  ← Pool management
  │  (Prisma Accelerate / PgBouncer)   │
  └──────────────┬─────────────────────┘
                 │
                 v
  ┌────────────────────────────────────┐
  │          PostgreSQL                │
  │  Handle many clients with few      │
  │  connections                       │
  └────────────────────────────────────┘
```

```typescript
// Prisma Accelerate configuration
// .env
// DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
// DIRECT_URL="postgresql://user:pass@host:5432/db"  // For migrations

// schema.prisma
// datasource db {
//   provider  = "postgresql"
//   url       = env("DATABASE_URL")
//   directUrl = env("DIRECT_URL")
// }

// Accelerate caching feature
const users = await prisma.user.findMany({
  cacheStrategy: {
    ttl: 60,      // Cache for 60 seconds
    swr: 120,     // Stale While Revalidate: 120 seconds
  },
});
```

### 6-5. Batch Processing

```typescript
// Split large data processing into batches
async function processAllUsers(batchSize: number = 100) {
  let cursor: string | undefined;
  let processedCount = 0;

  while (true) {
    const users = await prisma.user.findMany({
      take: batchSize,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
      orderBy: { id: "asc" },
    });

    if (users.length === 0) break;

    // Batch processing
    await Promise.all(
      users.map(async (user) => {
        await processUser(user);
      })
    );

    processedCount += users.length;
    cursor = users[users.length - 1].id;

    console.log(`Processed ${processedCount} users...`);
  }

  return processedCount;
}

// Bulk insert with createMany
async function bulkInsertUsers(users: CreateUserDto[]) {
  const CHUNK_SIZE = 1000;
  let totalInserted = 0;

  for (let i = 0; i < users.length; i += CHUNK_SIZE) {
    const chunk = users.slice(i, i + CHUNK_SIZE);
    const result = await prisma.user.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    totalInserted += result.count;
  }

  return totalInserted;
}
```

---

## 7. Practical Design Patterns

### 7-1. Soft Delete

```typescript
// Add soft delete column to schema.prisma
// model User {
//   ...
//   deletedAt DateTime?
// }

// Handle soft delete transparently with Client Extension
const prismaWithSoftDelete = prisma.$extends({
  query: {
    user: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async findFirst({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async findUnique({ args, query }) {
        // Note: findUnique has strict where constraints
        return query(args);
      },
      async delete({ args }) {
        // Convert physical delete to logical delete
        return prisma.user.update({
          where: args.where,
          data: { deletedAt: new Date() },
        });
      },
      async deleteMany({ args }) {
        return prisma.user.updateMany({
          where: args.where ?? {},
          data: { deletedAt: new Date() },
        });
      },
    },
  },
  model: {
    user: {
      // Full physical delete (for admins)
      async hardDelete(id: string) {
        return prisma.user.delete({ where: { id } });
      },
      // Restore
      async restore(id: string) {
        return prisma.user.update({
          where: { id },
          data: { deletedAt: null },
        });
      },
    },
  },
});
```

### 7-2. Audit Trail

```typescript
// Extension to automatically record change history
const prismaWithAudit = prisma.$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        const result = await query(args);
        await prisma.auditLog.create({
          data: {
            model: model as string,
            action: "CREATE",
            recordId: (result as any).id,
            newData: JSON.stringify(result),
            userId: getCurrentUserId(), // Retrieved from context
            timestamp: new Date(),
          },
        });
        return result;
      },
      async update({ model, args, query }) {
        // Fetch data before change
        const before = await (prisma as any)[model].findUnique({
          where: args.where,
        });
        const result = await query(args);
        await prisma.auditLog.create({
          data: {
            model: model as string,
            action: "UPDATE",
            recordId: (result as any).id,
            oldData: JSON.stringify(before),
            newData: JSON.stringify(result),
            userId: getCurrentUserId(),
            timestamp: new Date(),
          },
        });
        return result;
      },
      async delete({ model, args, query }) {
        const before = await (prisma as any)[model].findUnique({
          where: args.where,
        });
        const result = await query(args);
        await prisma.auditLog.create({
          data: {
            model: model as string,
            action: "DELETE",
            recordId: (before as any).id,
            oldData: JSON.stringify(before),
            userId: getCurrentUserId(),
            timestamp: new Date(),
          },
        });
        return result;
      },
    },
  },
});
```

### 7-3. Multi-Tenancy

```typescript
// Automatically attach tenant ID to all queries

function createTenantPrisma(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenantId } as any;
          return query(args);
        },
      },
    },
  });
}

// Usage example (configured in middleware)
app.use((req, res, next) => {
  const tenantId = req.headers["x-tenant-id"] as string;
  req.prisma = createTenantPrisma(tenantId);
  next();
});
```

---

## Comparison Tables

### ORM / Query Builder Comparison

| Feature | Prisma | Drizzle | TypeORM | Kysely |
|------|--------|---------|---------|--------|
| Type safety | Highest (generated) | Highest (inferred) | Medium (decorators) | High (inferred) |
| Schema definition | .prisma | TypeScript | Decorators | TypeScript |
| Migrations | Built-in | drizzle-kit | Built-in | Separate |
| Raw SQL | $queryRaw | sql`` | query() | sql`` |
| Bundle size | Large (Engine) | Small | Large | Small |
| Learning cost | Low | Low | Medium | Medium |
| Edge Runtime | Supported (Accelerate) | Supported | Not supported | Supported |
| Relations | Declarative | Declarative/SQL | Decorators | Manual JOIN |
| Transactions | Interactive TX | Direct SQL | QueryRunner | Direct SQL |
| Official GUI | Prisma Studio | Drizzle Studio | None | None |

### Prisma Query Method Comparison

| Method | Type safety | Flexibility | Performance | Use case |
|------|---------|--------|-------------|------|
| findMany / findUnique | Highest | Medium | Good | Standard CRUD |
| include / select | Highest | Medium | Caution (N+1) | Relations |
| $queryRaw | Medium | Highest | Highest | Complex queries |
| TypedSQL | High | Highest | Highest | SQL file management |
| $transaction | Highest | High | Good | Multiple operations |
| Client Extensions | Highest | High | Good | Custom logic |
| Accelerate + cache | Highest | Medium | Highest | High read frequency |

### Database Provider Support

| Feature | PostgreSQL | MySQL | SQLite | MongoDB | SQL Server |
|------|-----------|-------|--------|---------|------------|
| Full-text search | Yes | Yes | No | No | No |
| JSON filter | Yes | Yes | No | Yes | Yes |
| enum | Yes | Yes | No | No | No |
| Array type | Yes | No | No | Yes | No |
| Interactive TX | Yes | Yes | Yes | Yes | Yes |

---

## Anti-Patterns

### AP-1: Ignoring N+1 Problems

```typescript
// NG: Queries inside a loop (N+1 problem)
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
  // 1 + N queries are issued
}

// OK: Fetch all at once with include
const users = await prisma.user.findMany({
  include: {
    posts: true,
  },
});
// Completed with 2 queries (users + posts)
```

### AP-2: Creating PrismaClient per Request

```typescript
// NG: New instance every time (connection pool exhaustion)
app.get("/users", async (req, res) => {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany();
  await prisma.$disconnect();
  res.json(users);
});

// OK: Share via singleton
// lib/prisma.ts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
export { prisma };
```

### AP-3: Too Many Levels of include Nesting

```typescript
// NG: 4+ levels of nesting (performance degradation)
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    posts: {
      include: {
        comments: {
          include: {
            author: {
              include: {
                profile: true,  // 4-level nesting
              },
            },
          },
        },
      },
    },
  },
});

// OK: Fetch only necessary data and assemble separately
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    posts: {
      select: { id: true, title: true },
      take: 10,
    },
  },
});

// Additional query as needed
const postIds = user?.posts.map((p) => p.id) ?? [];
const comments = await prisma.comment.findMany({
  where: { postId: { in: postIds } },
  include: { author: { select: { name: true } } },
  take: 50,
});
```

### AP-4: Manually Editing Migration Files

```typescript
// NG: Directly editing generated migration SQL
// → prisma migrate dev can no longer correctly detect diffs

// OK: Create an empty migration for custom SQL
// npx prisma migrate dev --create-only --name add_custom_index
// → Add SQL to the generated file, then
// npx prisma migrate dev to apply
```

### AP-5: Embedding User Input Directly in $queryRaw

```typescript
// NG: SQL injection risk
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE name = '${userInput}'
`;

// OK: Use template literal placeholders
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE name = ${userInput}
`;
// Prisma automatically parameterizes this
```

---

## FAQ

### Q1: Should I choose Prisma or Drizzle?

Prisma's schema-first design is intuitive, and Studio, migrations, and type generation are all integrated. Drizzle is lighter and closer to SQL, with better compatibility for Edge Runtime. If your team has strong SQL expertise, Drizzle is a good fit; if you prefer ORM abstraction, Prisma is the better choice.

For large teams, Prisma's schema functioning as a "Single Source of Truth" and serving as a common language between backend and frontend is a significant advantage. On the other hand, if you have many complex queries, Drizzle's SQL-like syntax may feel more natural.

### Q2: What can I do if Prisma performance is slow?

Consider the following measures in order:

1. Use `select` to fetch only required fields
2. Minimize `include` nesting (within 3 levels)
3. Add appropriate indexes (`@@index`)
4. Detect and resolve N+1 problems (check logs with `prisma.$on("query")`)
5. Optimize complex queries with `$queryRaw`
6. Introduce Prisma Accelerate (connection pooling + cache)
7. Utilize read replicas (read replica configuration)

### Q3: How do I mock the DB in tests?

Integration tests using a test DB (Docker PostgreSQL) are the most reliable. For unit tests, inject a mock implementation of the repository interface via DI. The `prisma-mock` library also exists, but real DB tests are recommended.

Test types and when to use them:
- **Unit tests**: Use InMemoryRepository to test only business logic
- **Integration tests**: Use Prisma Client with Docker DB
- **E2E tests**: Test through API endpoints all the way to the DB

### Q4: Can Prisma be used with Edge Runtime (Vercel Edge Functions, Cloudflare Workers)?

Using Prisma Accelerate enables Edge Runtime support. The standard Prisma Client depends on Node.js native binaries and cannot run on Edge, but Accelerate connects via HTTP, making it usable in any runtime.

```typescript
// Usage in Edge Runtime
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());
```

### Q5: How can I avoid downtime when changing the schema?

Use a staged migration strategy:

1. **Expand phase**: Add new columns as nullable, maintain compatibility with old code
2. **Migration phase**: Write to both old and new columns, run backfill
3. **Contract phase**: Stop writing to old columns, add NOT NULL constraints
4. **Cleanup**: Remove old columns

---

## Summary Table

| Concept | Key Point |
|------|------|
| schema.prisma | Single Source of Truth for data models |
| prisma generate | Auto-generate typed client from schema |
| include / select | Type-safe fetching of relations |
| $transaction | Atomic execution of multiple operations |
| Client Extensions | Type-safe addition of custom methods |
| Repository pattern | Ensure testability via DI |
| Prisma Accelerate | Connection pooling and caching |
| TypedSQL | Generate type-safe queries from SQL files |
| Soft delete | Implement transparently with Extensions |
| Optimistic lock | Detect concurrent updates with version column |

---

## Practice Exercises

### Exercise 1: Schema Design

Design a Prisma schema that meets the following requirements.

- An e-commerce product catalog system
- Products belong to multiple categories (many-to-many)
- Products have multiple SKUs (variations: size, color, etc.) (one-to-many)
- Users can add products to favorites (many-to-many)
- Product reviews (one-to-many, relations to both user and product)
- Include appropriate indexes and enums

### Exercise 2: Type-Safe Queries

Using `Prisma.validator` and `Prisma.UserGetPayload`, define the following reusable query types.

1. User dashboard data (profile + latest 5 posts + unread notification count)
2. Admin user list (all fields + post count + comment count)
3. Published article detail page data (author name + categories + top 10 comments)

### Exercise 3: Repository Pattern Implementation

Implement a repository according to the following specifications.

- Design the `IPostRepository` interface
- Implement both `PrismaPostRepository` and `InMemoryPostRepository`
- Support search (text search by title/content), filter (category, published status), and sort (by date, view count)
- Include cursor-based pagination

### Exercise 4: Transactions

Implement the following business logic using a transaction.

- Process for a user to "purchase" an article
- Check the user's balance and deduct the article's price
- Insert a purchase record into a log table
- Update the author's earnings column
- Roll back entirely if any operation fails
- Prevent concurrent purchases with optimistic locking

### Exercise 5: Performance Tuning

Identify performance issues in the following code and improve it.

```typescript
// How many performance problems does this code have?
async function getPopularAuthors() {
  const users = await prisma.user.findMany();

  const results = [];
  for (const user of users) {
    const postCount = await prisma.post.count({
      where: { authorId: user.id, published: true },
    });

    if (postCount > 10) {
      const posts = await prisma.post.findMany({
        where: { authorId: user.id, published: true },
        include: {
          categories: true,
          comments: true,
        },
        orderBy: { viewCount: "desc" },
      });

      results.push({
        user,
        postCount,
        posts,
        totalViews: posts.reduce((sum, p) => sum + p.viewCount, 0),
      });
    }
  }

  return results.sort((a, b) => b.totalViews - a.totalViews).slice(0, 10);
}
```

Hint: Focus on N+1 problems, unnecessary data fetching, aggregation approach, and lack of pagination.

### Exercise 6: Soft Delete Extension

Implement a soft delete system with the following features using a Prisma Client Extension.

- Works across all models (`$allModels`)
- Convert `delete` / `deleteMany` to logical delete
- Automatically exclude deleted records in `findMany` / `findFirst` / `findUnique`
- Restorable with a `restore(id)` method
- Physically deletable with a `hardDelete(id)` method
- Batch process to automatically physically delete records that have been deleted for more than 30 days

---


## Summary

In this guide, we covered the following key points:

- Understanding of basic concepts and principles
- Practical implementation patterns
- Best practices and important notes
- How to apply these in real-world work

---

## Next Guides to Read

- [tRPC](./02-trpc.md) -- Type-safe full-stack development with Prisma + tRPC
- [Zod Validation](./00-zod-validation.md) -- Integration between Prisma schema and zod
- [DI Pattern](../02-patterns/04-dependency-injection.md) -- DI design for repositories

---

## References

1. **Prisma Documentation**
   https://www.prisma.io/docs

2. **Prisma GitHub Repository**
   https://github.com/prisma/prisma

3. **Prisma Best Practices**
   https://www.prisma.io/docs/guides

4. **Prisma Client Extensions**
   https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions

5. **Prisma Accelerate**
   https://www.prisma.io/docs/accelerate
