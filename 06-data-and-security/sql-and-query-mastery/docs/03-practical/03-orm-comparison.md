# ORM Comparison — Prisma / TypeORM / Drizzle / SQLAlchemy

> A practical guide comparing the four major ORMs across features, performance, and developer experience to help you choose the best ORM for your project.

---

## What You Will Learn

1. **Architecture of each ORM** and differences in design philosophy
2. **CRUD implementation comparison** and differences in type safety
3. **Performance characteristics** and scalability differences
4. **Transaction management** implementation patterns
5. **Migration strategies** and production operation considerations

## Prerequisites

- Basic knowledge of TypeScript or Python
- Fundamental concepts of relational databases (tables, relations, SQL)
- Knowledge of connection pooling from [02-performance-tuning.md](./02-performance-tuning.md) is recommended

---

## 1. Overview of ORM Selection

### 1.1 Differences in Design Philosophy

```
┌────────────────────────────────────────────────────────┐
│               ORM Design Philosophy Spectrum            │
│                                                        │
│  Close to SQL ←──────────────────────────→ High abstraction │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Drizzle  │  │SQLAlchemy│  │  Prisma  │  │TypeORM │ │
│  │          │  │  Core    │  │          │  │        │ │
│  │ SQL-like │  │ Maximum  │  │ Own DSL  │  │ AR/DM  │ │
│  │ TypeSafe │  │ Expressive│  │ Type Gen │  │ Deco   │ │
│  └──────────┘  └──────────┘  └──────────┘  │ rators │ │
│                                            └────────┘ │
│                                                        │
│  Type Safe ←────────────────────────────→ Flexibility  │
│                                                        │
│  Drizzle ≈ Prisma > SQLAlchemy > TypeORM              │
└────────────────────────────────────────────────────────┘
```

### 1.2 Positioning of Each ORM

```
                    Type Safety
                      ▲
                      │
              Prisma  │  Drizzle
                 ●    │    ●
                      │
   ──────────────────┼──────────────────→ SQL Control
                      │
            TypeORM   │   SQLAlchemy
                ●     │      ●
                      │
```

### 1.3 ORM Internal Architecture

```
┌──────── ORM Internal Operation Flow ──────────────────┐
│                                                  │
│  Application Code                                │
│  │                                              │
│  ▼                                              │
│  ┌──────────────────────────────────┐           │
│  │ ORM Layer                         │           │
│  │  ┌─────────────────────────┐     │           │
│  │  │ Query Builder            │     │           │
│  │  │ (TypeSafe API → SQL gen)│     │           │
│  │  └───────┬─────────────────┘     │           │
│  │          │                        │           │
│  │  ┌───────▼─────────────────┐     │           │
│  │  │ Mapping Layer            │     │           │
│  │  │ (DB rows → Objects)     │     │           │
│  │  └───────┬─────────────────┘     │           │
│  │          │                        │           │
│  │  ┌───────▼─────────────────┐     │           │
│  │  │ Connection Pool Manager  │     │           │
│  │  │ (Connection Pooling)    │     │           │
│  │  └───────┬─────────────────┘     │           │
│  └──────────┼────────────────────────┘           │
│             │                                    │
│  ┌──────────▼──────────────────────┐             │
│  │ Database Driver                  │             │
│  │ (pg, mysql2, better-sqlite3, etc.) │             │
│  └──────────┬──────────────────────┘             │
│             │                                    │
│  ┌──────────▼──────────────────────┐             │
│  │ RDBMS (PostgreSQL, MySQL, etc.)│             │
│  └─────────────────────────────────┘             │
└──────────────────────────────────────────────────┘
```

### 1.4 ORM Pattern Classification

```
┌──────── ORM Design Patterns ──────────────────┐
│                                                  │
│  Active Record (AR):                             │
│  ┌──────────────────────────────────────┐       │
│  │ Model class = Table + CRUD operations  │       │
│  │ user.save(), user.find()              │       │
│  │ Adopted by: TypeORM (partially), Rails AR │   │
│  │ Pros: Simple, intuitive               │       │
│  │ Cons: Business logic mixed with DB ops│       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  Data Mapper (DM):                               │
│  ┌──────────────────────────────────────┐       │
│  │ Separates Model (Entity) and DB ops (Repository)│ │
│  │ repository.save(user)                 │       │
│  │ Adopted by: TypeORM (DM mode), SQLAlchemy │   │
│  │ Pros: Separation of concerns, testability │   │
│  │ Cons: More code required              │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  Query Builder (QB):                             │
│  ┌──────────────────────────────────────┐       │
│  │ SQL-like API, type-safe query building │       │
│  │ db.select().from(users).where(...)    │       │
│  │ Adopted by: Drizzle, Knex.js         │       │
│  │ Pros: SQL knowledge transfers directly│       │
│  │ Cons: Fewer ORM conveniences          │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  Schema-First (SF):                              │
│  ┌──────────────────────────────────────┐       │
│  │ Define schema with own DSL → auto-generate types │ │
│  │ schema.prisma → prisma generate       │       │
│  │ Adopted by: Prisma                    │       │
│  │ Pros: Schema is single source of truth│       │
│  │ Cons: DSL learning cost, flexibility limits │  │
│  └──────────────────────────────────────┘       │
└──────────────────────────────────────────────────┘
```

---

## 2. CRUD Implementation Comparison for Each ORM

### 2.1 Schema / Model Definition

```typescript
// === Prisma (schema.prisma) ===
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(uuid())
  title     String
  body      String
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
```

```typescript
// === TypeORM (Entity decorators) ===
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @Column({ type: "timestamp", default: () => "NOW()" })
  createdAt: Date;
}

@Entity()
export class Post {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column("text")
  body: string;

  @Column({ default: false })
  published: boolean;

  @ManyToOne(() => User, (user) => user.posts)
  author: User;
}
```

```typescript
// === Drizzle (TypeScript schema) ===
import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  published: boolean("published").default(false).notNull(),
  authorId: uuid("author_id").notNull().references(() => users.id),
});

// Relation definitions (for Drizzle relational queries)
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

```python
# === SQLAlchemy (Mapped type annotations) ===
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    posts: Mapped[list["Post"]] = relationship(back_populates="author")

class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str]
    published: Mapped[bool] = mapped_column(default=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    author: Mapped["User"] = relationship(back_populates="posts")
```

### 2.2 SELECT (including relations)

```typescript
// === Prisma ===
const usersWithPosts = await prisma.user.findMany({
  where: { email: { contains: "@example.com" } },
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    },
  },
  take: 10,
});

// Prisma generated SQL:
// SELECT "User"."id", "User"."name", "User"."email", "User"."createdAt"
// FROM "User"
// WHERE "User"."email" LIKE '%@example.com%'
// LIMIT 10;
//
// SELECT "Post"."id", "Post"."title", ...
// FROM "Post"
// WHERE "Post"."authorId" IN ($1, $2, ...) AND "Post"."published" = true
// ORDER BY "Post"."createdAt" DESC
// LIMIT 5;
// → Executed in 2 queries (not N+1)

// === TypeORM ===
const usersWithPosts = await userRepository.find({
  where: { email: Like("%@example.com") },
  relations: { posts: true },
  take: 10,
});
// TypeORM requires QueryBuilder for filtering relations
const usersWithPosts2 = await userRepository
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.posts", "post", "post.published = :pub", { pub: true })
  .where("user.email LIKE :email", { email: "%@example.com" })
  .orderBy("post.createdAt", "DESC")
  .take(10)
  .getMany();

// === Drizzle ===
const usersWithPosts = await db.query.users.findMany({
  where: like(users.email, "%@example.com"),
  with: {
    posts: {
      where: eq(posts.published, true),
      orderBy: desc(posts.createdAt),
      limit: 5,
    },
  },
  limit: 10,
});

// Drizzle SQL-like query building (low-level API)
const result = await db
  .select({
    userName: users.name,
    postTitle: posts.title,
  })
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId))
  .where(like(users.email, "%@example.com"))
  .limit(10);
```

```python
# === SQLAlchemy ===
from sqlalchemy import select
from sqlalchemy.orm import selectinload

stmt = (
    select(User)
    .where(User.email.contains("@example.com"))
    .options(
        selectinload(User.posts).where(Post.published == True)
    )
    .limit(10)
)
users_with_posts = session.scalars(stmt).all()

# SQLAlchemy loading strategy comparison
# 1. Lazy Loading (default): queries on access → causes N+1 problem
# 2. Eager Loading (joinedload): fetch all at once via JOIN
# 3. Subquery Loading (selectinload): fetch all at once via subquery (recommended)
# 4. Raise Loading (raiseload): error on access → detects N+1

stmt_joined = (
    select(User)
    .options(joinedload(User.posts))  # Fetch with LEFT JOIN
    .limit(10)
)

stmt_subquery = (
    select(User)
    .options(selectinload(User.posts))  # Fetch with separate query (recommended)
    .limit(10)
)

# raiseload: raises error if not explicitly loaded (for N+1 detection)
from sqlalchemy.orm import raiseload
stmt_strict = (
    select(User)
    .options(raiseload(User.posts))  # Error on user.posts access
)
```

### 2.3 INSERT (bulk)

```typescript
// === Prisma ===
const users = await prisma.user.createMany({
  data: [
    { name: "Alice", email: "alice@example.com" },
    { name: "Bob", email: "bob@example.com" },
  ],
  skipDuplicates: true,
});

// Prisma: nested relation creation
const userWithPosts = await prisma.user.create({
  data: {
    name: "Charlie",
    email: "charlie@example.com",
    posts: {
      create: [
        { title: "First Post", body: "Hello World", published: true },
        { title: "Draft", body: "WIP", published: false },
      ],
    },
  },
  include: { posts: true },
});

// === Drizzle ===
const inserted = await db.insert(users).values([
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
]).onConflictDoNothing().returning();

// Drizzle: UPSERT (ON CONFLICT)
const upserted = await db.insert(users).values({
  name: "Alice",
  email: "alice@example.com",
}).onConflictDoUpdate({
  target: users.email,
  set: { name: "Alice Updated" },
}).returning();

// === TypeORM ===
const result = await userRepository.insert([
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
]);
// TypeORM: UPSERT
await userRepository.upsert(
  { name: "Alice", email: "alice@example.com" },
  ["email"]
);
```

```python
# === SQLAlchemy ===
session.add_all([
    User(name="Alice", email="alice@example.com"),
    User(name="Bob", email="bob@example.com"),
])
session.commit()

# SQLAlchemy: bulk INSERT (faster version)
from sqlalchemy import insert
stmt = insert(User).values([
    {"name": "Alice", "email": "alice@example.com"},
    {"name": "Bob", "email": "bob@example.com"},
])
session.execute(stmt)
session.commit()

# SQLAlchemy: UPSERT (PostgreSQL)
from sqlalchemy.dialects.postgresql import insert as pg_insert
stmt = pg_insert(User).values(name="Alice", email="alice@example.com")
stmt = stmt.on_conflict_do_update(
    index_elements=["email"],
    set_={"name": stmt.excluded.name},
)
session.execute(stmt)
session.commit()
```

### 2.4 Transaction Management

```typescript
// === Prisma: Interactive Transaction ===
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { name: "Alice", email: "alice@example.com" },
  });
  const post = await tx.post.create({
    data: { title: "Hello", body: "World", authorId: user.id },
  });
  return { user, post };
});
// Automatically rolled back if an exception occurs

// Prisma: Sequential Transaction (multiple operations atomically)
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: { name: "Bob", email: "bob@example.com" } }),
  prisma.post.create({ data: { title: "Hi", body: "!", authorId: "..." } }),
]);

// === Drizzle ===
const result = await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({
    name: "Alice", email: "alice@example.com"
  }).returning();

  await tx.insert(posts).values({
    title: "Hello", body: "World", authorId: user.id
  });

  return user;
});

// === TypeORM: QueryRunner ===
const queryRunner = dataSource.createQueryRunner();
await queryRunner.startTransaction();
try {
  const user = queryRunner.manager.create(User, {
    name: "Alice", email: "alice@example.com"
  });
  await queryRunner.manager.save(user);

  const post = queryRunner.manager.create(Post, {
    title: "Hello", body: "World", author: user
  });
  await queryRunner.manager.save(post);

  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();
}
```

```python
# === SQLAlchemy: Session ===
# Method 1: Context manager (recommended)
with Session(engine) as session:
    with session.begin():  # Auto commit/rollback
        user = User(name="Alice", email="alice@example.com")
        session.add(user)
        session.flush()  # Flush to get the ID

        post = Post(title="Hello", body="World", author=user)
        session.add(post)
    # Auto commit when block exits

# Method 2: Explicit commit/rollback
session = Session(engine)
try:
    user = User(name="Alice", email="alice@example.com")
    session.add(user)
    session.flush()

    post = Post(title="Hello", body="World", author=user)
    session.add(post)
    session.commit()
except Exception:
    session.rollback()
    raise
finally:
    session.close()

# Method 3: Nested transaction (SAVEPOINT)
with Session(engine) as session:
    with session.begin():
        session.add(User(name="Alice", email="alice@example.com"))

        # Nested transaction (SAVEPOINT)
        with session.begin_nested():
            try:
                session.add(User(name="Alice", email="alice@example.com"))  # Duplicate
                session.flush()
            except IntegrityError:
                pass  # Rollback to SAVEPOINT, outer continues

        session.add(User(name="Bob", email="bob@example.com"))
    # Alice + Bob are committed (duplicate Alice was rolled back)
```

---

## 3. Migration Comparison

```
┌────────────────────────────────────────────────────────┐
│              Migration Methods                          │
│                                                        │
│  Prisma:    Schema file → prisma migrate dev            │
│             → Auto-generate SQL → prisma migrate deploy │
│             * Declarative (Desired State)               │
│                                                        │
│  TypeORM:   Detect Entity changes                       │
│             → typeorm migration:generate                │
│             → typeorm migration:run                     │
│             * synchronize:true is forbidden in production │
│                                                        │
│  Drizzle:   Schema file → drizzle-kit generate          │
│             → drizzle-kit migrate                       │
│             * Declarative approach similar to Prisma    │
│                                                        │
│  SQLAlchemy: Uses Alembic                               │
│             → alembic revision --autogenerate           │
│             → alembic upgrade head                      │
│             * Auto-generate + manual adjustments        │
└────────────────────────────────────────────────────────┘
```

### 3.1 Migration Execution Examples

```bash
# === Prisma ===
# Development: generate migration from schema diff
npx prisma migrate dev --name add_user_avatar

# Production: apply migration only (no generation)
npx prisma migrate deploy

# Push schema state to DB (for prototyping, no migration files)
npx prisma db push

# === Drizzle ===
# Generate migration file
npx drizzle-kit generate

# Apply migration
npx drizzle-kit migrate

# === TypeORM ===
# Generate migration (detect Entity diff)
npx typeorm migration:generate -n AddUserAvatar

# Apply migration
npx typeorm migration:run

# === SQLAlchemy + Alembic ===
# Initialize
alembic init alembic

# Generate migration (auto-detect)
alembic revision --autogenerate -m "add user avatar"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Migration Feature Comparison

| Feature | Prisma | TypeORM | Drizzle | Alembic (SQLAlchemy) |
|---------|--------|---------|---------|---------------------|
| Auto-generation | ✓ (schema diff) | ✓ (Entity diff) | ✓ (schema diff) | ✓ (model diff) |
| Rollback | ✗ (manual) | ✓ | ✗ (manual) | ✓ |
| Seeding | prisma db seed | manual | manual | manual |
| Multi-DB | ✗ | ✓ | ✗ | ✓ |
| Baseline | prisma migrate resolve | manual | manual | alembic stamp |
| SQL review | ✓ (auto-saved) | ✗ | ✓ (auto-saved) | ✓ (--sql) |
| Team usage | Good (lock file) | Caution needed | Good | Good (branch support) |

---

## 4. Comparison Tables

### 4.1 Feature Comparison

| Feature | Prisma | TypeORM | Drizzle | SQLAlchemy |
|---------|--------|---------|---------|------------|
| **Language** | TypeScript/JS | TypeScript/JS | TypeScript/JS | Python |
| **Paradigm** | Custom DSL + type gen | ActiveRecord / DataMapper | SQL-like TypeSafe | DataMapper (Unit of Work) |
| **Type Safety** | High (auto-generated) | Medium (decorator-dependent) | High (inference-based) | Medium (Mapped annotations) |
| **Raw SQL** | `$queryRaw` | `query()` | `sql` template | `text()` |
| **Relations** | `include` / `select` | `relations` / QueryBuilder | `with` (relational query) | `relationship` + Loading Strategy |
| **Migrations** | Prisma Migrate | TypeORM CLI / synchronize | drizzle-kit | Alembic |
| **Connection Pool** | Built-in (Rust Engine) | Built-in | Depends on external driver | Built-in (QueuePool) |
| **Supported DBs** | PostgreSQL, MySQL, SQLite, MongoDB | PostgreSQL, MySQL, SQLite, etc. | PostgreSQL, MySQL, SQLite | Almost all RDBMSs |
| **Transactions** | `$transaction` | QueryRunner / decorator | `db.transaction()` | Session / begin() |
| **N+1 Prevention** | Auto via include | eager: true / QueryBuilder | Auto via with | selectinload / joinedload |
| **Batch Operations** | createMany, updateMany | insert, update (QueryBuilder) | insert, update (batch) | bulk_insert_mappings |
| **UPSERT** | upsert (4.0+) | upsert | onConflictDoUpdate | on_conflict_do_update |
| **Subqueries** | Limited | Possible via QueryBuilder | SQL template | Full support |
| **Window Functions** | $queryRaw only | QueryBuilder | sql template | Supported via over() |

### 4.2 Developer Experience Comparison

| Aspect | Prisma | TypeORM | Drizzle | SQLAlchemy |
|--------|--------|---------|---------|------------|
| **Learning Curve** | Low | Medium | Low | High |
| **Documentation** | Excellent | Good | Good | Excellent |
| **Error Messages** | Clear | Sometimes unclear | Clear | Detailed |
| **IDE Completion** | Excellent (type gen) | Good | Excellent (type inference) | Good (type annotations) |
| **Debugging** | Prisma Studio | None (external tools) | Drizzle Studio | SQLAlchemy echo |
| **Bundle Size** | Large (Rust engine ~15MB) | Medium (~3MB) | Small (~500KB) | N/A (server) |
| **Community** | Large | Large (slightly stagnant) | Rapidly growing | Huge |
| **Production Track Record** | Many | Many | Increasing | Very many |
| **Testability** | Mockable | Repository pattern | Function-based | Session mock |

### 4.3 Performance Characteristics Comparison

| Metric | Prisma | TypeORM | Drizzle | SQLAlchemy |
|--------|--------|---------|---------|------------|
| **Cold Start** | Slow (Rust Engine startup) | Normal | Fast | Normal |
| **Query Generation Speed** | Fast (Rust) | Normal | Fast | Normal |
| **Memory Usage** | High (Engine overhead) | Normal | Low | Normal |
| **Connection Pool Efficiency** | Good (built-in) | Good (built-in) | Driver-dependent | Excellent (QueuePool) |
| **Bulk INSERT** | Good (createMany) | Somewhat slow | Fast | Fast (Core API) |
| **Large SELECT** | Good | Normal | Fast | Good (yield_per) |
| **Serverless Suitability** | Medium (Cold Start issue) | Good | Excellent | Normal |

---

## 5. Advanced Usage Patterns

### 5.1 Executing Raw SQL

```typescript
// === Prisma: $queryRaw ===
const users = await prisma.$queryRaw<User[]>`
  SELECT u.*, COUNT(p.id) as post_count
  FROM "User" u
  LEFT JOIN "Post" p ON p."authorId" = u.id
  GROUP BY u.id
  HAVING COUNT(p.id) > ${minPosts}
  ORDER BY post_count DESC
`;

// === Drizzle: sql template ===
import { sql } from "drizzle-orm";

const result = await db.execute(sql`
  SELECT ${users.name}, COUNT(${posts.id}) as post_count
  FROM ${users}
  LEFT JOIN ${posts} ON ${posts.authorId} = ${users.id}
  GROUP BY ${users.name}
  HAVING COUNT(${posts.id}) > ${minPosts}
`);

// === TypeORM: Query ===
const result = await dataSource.query(
  `SELECT u.*, COUNT(p.id) as post_count
   FROM "user" u
   LEFT JOIN "post" p ON p."authorId" = u.id
   GROUP BY u.id
   HAVING COUNT(p.id) > $1`,
  [minPosts]
);
```

```python
# === SQLAlchemy: text() ===
from sqlalchemy import text

stmt = text("""
    SELECT u.*, COUNT(p.id) as post_count
    FROM users u
    LEFT JOIN posts p ON p.author_id = u.id
    GROUP BY u.id
    HAVING COUNT(p.id) > :min_posts
""")
result = session.execute(stmt, {"min_posts": min_posts}).all()

# SQLAlchemy: Hybrid (Core + ORM)
from sqlalchemy import func, select

stmt = (
    select(User, func.count(Post.id).label("post_count"))
    .outerjoin(Post)
    .group_by(User.id)
    .having(func.count(Post.id) > min_posts)
    .order_by(func.count(Post.id).desc())
)
results = session.execute(stmt).all()
```

### 5.2 Complex Query Patterns

```typescript
// === Drizzle: Subqueries ===
import { sql, eq, gt, and } from "drizzle-orm";

// Employees earning above their department's average salary
const deptAvg = db
  .select({
    deptId: employees.departmentId,
    avgSalary: sql`AVG(${employees.salary})`.as("avg_salary"),
  })
  .from(employees)
  .groupBy(employees.departmentId)
  .as("dept_avg");

const result = await db
  .select()
  .from(employees)
  .innerJoin(deptAvg, eq(employees.departmentId, deptAvg.deptId))
  .where(gt(employees.salary, deptAvg.avgSalary));

// === Prisma: fluent API ===
// Complex subqueries in Prisma require $queryRaw
const result = await prisma.$queryRaw`
  SELECT e.*
  FROM employees e
  INNER JOIN (
    SELECT department_id, AVG(salary) as avg_salary
    FROM employees GROUP BY department_id
  ) da ON e.department_id = da.department_id
  WHERE e.salary > da.avg_salary
`;
```

```python
# === SQLAlchemy: Complex subqueries ===
from sqlalchemy import select, func

# Employees earning above their department's average salary
dept_avg = (
    select(
        Employee.department_id,
        func.avg(Employee.salary).label("avg_salary")
    )
    .group_by(Employee.department_id)
    .subquery()
)

stmt = (
    select(Employee)
    .join(dept_avg, Employee.department_id == dept_avg.c.department_id)
    .where(Employee.salary > dept_avg.c.avg_salary)
)
results = session.scalars(stmt).all()

# SQLAlchemy: Window functions
from sqlalchemy import over

stmt = (
    select(
        Employee.name,
        Employee.salary,
        func.rank().over(
            partition_by=Employee.department_id,
            order_by=Employee.salary.desc()
        ).label("salary_rank")
    )
)
```

---

## 6. Anti-Patterns

### 6.1 Using TypeORM's synchronize: true in Production

```typescript
// NG: Auto schema sync in production
const dataSource = new DataSource({
  type: "postgres",
  synchronize: true,  // ← Absolutely forbidden in production!
  // Tables get auto-modified → risk of data loss
});

// OK: Manage explicitly with migration files
const dataSource = new DataSource({
  type: "postgres",
  synchronize: false,
  migrations: ["dist/migrations/*.js"],
  migrationsRun: true,  // Run migrations on startup
});
```

**Problem**: synchronize may drop and recreate tables, causing production data loss. Use only in development environments and manage production with migration files.

### 6.2 Causing N+1 in Prisma

```typescript
// NG: Individual queries inside a loop
const users = await prisma.user.findMany();
for (const user of users) {
  // 1 query per user = N+1 problem!
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
  console.log(`${user.name}: ${posts.length} posts`);
}

// OK: Consolidate into 1 query with include
const users = await prisma.user.findMany({
  include: {
    posts: {
      select: { id: true },  // Only necessary fields
    },
  },
});
for (const user of users) {
  console.log(`${user.name}: ${user.posts.length} posts`);
}
```

### 6.3 Implicit Lazy Loading in SQLAlchemy

```python
# NG: Lazy loading in async context (SQLAlchemy 2.0)
async def get_users():
    async with async_session() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()

    # Accessing relations outside session → Error or N+1
    for user in users:
        print(user.posts)  # DetachedInstanceError or lazy load

# OK: Specify loading strategy explicitly
async def get_users_with_posts():
    async with async_session() as session:
        result = await session.execute(
            select(User).options(selectinload(User.posts))
        )
        users = result.scalars().all()
        for user in users:
            print(user.posts)  # Already loaded
```

### 6.4 Ignoring Type Safety in Drizzle

```typescript
// NG: Ignoring types with sql template
const result = await db.execute(sql`SELECT * FROM users WHERE id = ${userId}`);
// result type is unclear

// OK: Use type-safe query builder
const result = await db
  .select()
  .from(users)
  .where(eq(users.id, userId));
// result type is inferred: { id: string, name: string, ... }[]
```

---

## 7. Edge Cases

### Edge Case 1: Streaming Large Amounts of Data

```python
# SQLAlchemy: Memory-efficient bulk reads with yield_per
stmt = select(User).execution_options(yield_per=1000)
for user in session.scalars(stmt):
    process(user)
# → Fetches 1000 rows at a time from DB (doesn't load all rows into memory)
```

```typescript
// Prisma: Cursor-based pagination
let cursor: string | undefined;
while (true) {
  const users = await prisma.user.findMany({
    take: 100,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: "asc" },
  });
  if (users.length === 0) break;
  cursor = users[users.length - 1].id;
  for (const user of users) {
    await process(user);
  }
}
```

### Edge Case 2: Multi-tenancy

```typescript
// Prisma: RLS and client extensions
const prismaWithTenant = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        // Automatically add tenant filter to all queries
        args.where = { ...args.where, tenantId: currentTenantId };
        return query(args);
      },
    },
  },
});
```

```python
# SQLAlchemy: Multi-tenancy with event hooks
from sqlalchemy import event

@event.listens_for(Session, "do_orm_execute")
def _add_tenant_filter(execute_state):
    if execute_state.is_select:
        execute_state.statement = execute_state.statement.where(
            User.tenant_id == get_current_tenant_id()
        )
```

### Edge Case 3: Optimistic Locking

```typescript
// Prisma: Optimistic locking with version field
const updated = await prisma.product.update({
  where: { id: productId, version: currentVersion },
  data: { name: "New Name", version: { increment: 1 } },
});
// RecordNotFoundError if version doesn't match
```

```python
# SQLAlchemy: Optimistic locking with version_id_col
class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    version: Mapped[int] = mapped_column(default=1)

    __mapper_args__ = {
        "version_id_col": version,
    }

# StaleDataError on version mismatch during update
product = session.get(Product, product_id)
product.name = "New Name"
session.commit()  # UPDATE ... WHERE id = ? AND version = ?
```

---

## 8. Exercises

### Exercise 1 (Basic): Implementing CRUD Operations

Implement the following requirements using your preferred ORM.

**Requirements**:
- CRUD for users (name, email) and posts (title, body, published)
- Query to retrieve a list of users with unpublished posts
- Cascade delete posts when a user is deleted

### Exercise 2 (Intermediate): Detecting and Fixing N+1 Problems

Identify the N+1 problem in the following code and fix it.

```typescript
// Problematic code
const departments = await prisma.department.findMany();
for (const dept of departments) {
  const employees = await prisma.employee.findMany({
    where: { departmentId: dept.id },
  });
  const avgSalary = employees.reduce((sum, e) => sum + e.salary, 0) / employees.length;
  console.log(`${dept.name}: avg salary = ${avgSalary}`);
}
```

### Exercise 3 (Advanced): Performance Comparison

Implement the same query (list of 1000 users + post count per user) using all 4 ORMs and compare execution time and memory usage.


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
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
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
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
    """Efficient search using a hash map"""
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

    print(f"Inefficient: {slow_time:.4f}s")
    print(f"Efficient:   {fast_time:.6f}s")
    print(f"Speedup:     {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|-----------|-------------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development Speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow          │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                   │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. Deployment frequency?                        │
│    ├─ Once a week or less → Monolith + modules  │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. Team independence?                           │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- Faster short-term approaches can become technical debt long-term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and challenges"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
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
- Focus on minimum viable features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons Learned:**
- Don't over-engineer (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually renovating a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If no existing tests, create Characterization Tests first
- Coexist new and old systems with an API gateway
- Migrate data in phases

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start Migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core Migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Set ownership per team
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

**Situation:** Systems requiring millisecond-level responses

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|------------------------|--------|--------------------|---------| 
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## 9. FAQ

### Q1. Which ORM should I choose for a new project?

**A.** Choose based on your language and team experience.

- **TypeScript + type safety priority**: Drizzle (close to SQL, excellent type inference)
- **TypeScript + productivity priority**: Prisma (schema-first, rich documentation)
- **TypeScript + legacy projects**: TypeORM (proven integration with existing Express/NestJS)
- **Python**: SQLAlchemy (de facto standard, greatly improved in 2.0)

### Q2. Does Prisma's Rust engine affect performance?

**A.** Prisma uses a Rust binary as its Query Engine. This causes slow initial startup (Cold Start) and a large bundle size (~15MB). Cold Start can be an issue in serverless environments (Lambda). Prisma 6.x and later have reduced this, but if Lambda causes issues, consider Drizzle or direct SQL (e.g., sqlc).

### Q3. Is migrating from SQLAlchemy 1.x to 2.0 difficult?

**A.** Incremental migration is possible. SQLAlchemy 1.4 is the bridge version where the `future=True` flag lets you incrementally adopt the 2.0 style. Key changes are:
- `session.query()` → `select()` statements
- `Column` → `mapped_column`
- Implicit lazy loading → explicit loading strategies

A migration guide is available in the official documentation, and you can enable deprecation warnings with `SQLALCHEMY_WARN_20=1` to address them incrementally.

### Q4. When should I write raw SQL instead of using an ORM?

**A.** The following cases are better suited to raw SQL than an ORM:
- **Extremely complex queries** (recursive CTEs, combinations of window functions, etc.)
- **Batch processing** (bulk operations on millions of rows)
- **Performance is paramount** (microsecond-level optimization)
- **DB-specific features** (PostgreSQL LISTEN/NOTIFY, etc.)
Even in these cases, using type-safe SQL tools such as sqlc (Go) or kysely (TypeScript) is recommended.

### Q5. How costly is it to migrate between ORMs?

**A.** Migrating between ORMs is generally costly. If the repository pattern is adopted, only the data access layer needs to change. If ORM APIs are called directly in business logic, the impact extends to that layer as well. To minimize migration costs, adopt an architecture that separates ORM APIs from business logic (repository pattern, DAO pattern).

### Q6. How should ORMs be used in test environments?

**A.** Testing strategies for each ORM:
- **Prisma**: Initialize test DB with `prisma migrate reset`, or use a mock library
- **Drizzle**: Use a SQLite connection for tests, or an in-memory DB like pg-mem
- **TypeORM**: Auto-generate test DB with `synchronize: true`, initialize with `dropDatabase`
- **SQLAlchemy**: Create a transaction per test → rollback for cleanup

---

## 10. Troubleshooting

| Problem | ORM | Cause | Solution |
|---------|-----|-------|----------|
| Slow cold start | Prisma | Rust engine startup | Prisma Accelerate, or migrate to Drizzle |
| N+1 queries | All ORMs | Lazy loading of relations | Explicitly load with include/with/selectinload |
| Migration conflicts | TypeORM | Using synchronize | Switch to migration files |
| Memory leak | SQLAlchemy | Session not closed | Use context manager |
| Type errors | TypeORM | Missing decorators | strict: true + experimental decorators |
| Connection exhaustion | All ORMs | Insufficient pool size | Adjust max connections, introduce pgBouncer |

---

## 11. Security Considerations

```
┌──────── ORM Security Checklist ────────┐
│                                                  │
│  1. SQL Injection Prevention                     │
│     ✓ Use ORM query builder                     │
│     ✓ Use parameter binding for raw SQL         │
│     ✗ Do not build SQL with string concatenation│
│                                                  │
│  2. Connection String Management                 │
│     ✓ Manage with environment variables         │
│     ✓ Use a secret manager                      │
│     ✗ Do not hardcode in source code            │
│                                                  │
│  3. Least Privilege                              │
│     ✓ Grant only SELECT/INSERT/                 │
│       UPDATE/DELETE to the app DB user          │
│     ✗ Do not connect as superuser               │
│                                                  │
│  4. Separation of Migration Privileges           │
│     ✓ Separate DB users for migrations          │
│       and the application                       │
│     ✓ DDL privileges only for migration user    │
└──────────────────────────────────────────────────┘
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently used in day-to-day development tasks. It becomes especially important during code reviews and architecture design.

---

## 12. Summary

| Item | Key Points |
|------|-----------|
| **Prisma** | Schema-first, type-safe, Rust engine, low learning cost |
| **TypeORM** | Decorator-based, NestJS integration, feature-rich but maintenance is somewhat stagnant |
| **Drizzle** | SQL-like, type inference, lightweight, rapidly growing, optimized for serverless |
| **SQLAlchemy** | Python's de facto standard, maximum expressiveness, improved type safety in 2.0 |
| **Selection Criteria** | Language → team experience → type safety → performance requirements |
| **N+1 Prevention** | Explicit loading is required for all ORMs |
| **Migrations** | Always use file-based migration management in production |
| **Testing** | Isolate ORM dependencies with the repository pattern |

---

## What to Read Next

- [02-performance-tuning.md](./02-performance-tuning.md) — Connection pool and cache optimization
- Migration Operations Guide — Schema change strategies for production environments
- Complete Guide to N+1 Problems — Prevention patterns per ORM

---

## References

1. **Prisma Official Documentation** — https://www.prisma.io/docs
2. **Drizzle ORM Official Documentation** — https://orm.drizzle.team/docs/overview
3. **SQLAlchemy Official Documentation** — "SQLAlchemy 2.0 Tutorial" — https://docs.sqlalchemy.org/en/20/tutorial/
4. **TypeORM Official Documentation** — https://typeorm.io/
5. Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley. (Active Record, Data Mapper patterns)
6. **HikariCP Wiki** — "About Pool Sizing" — https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
