# Databases — sqlx / diesel / SeaORM

> A practical guide for comparing the three major crates for working with databases in Rust, helping you choose the optimal ORM / query builder for your project.

---

## What You Will Learn in This Chapter

1. **sqlx** — An asynchronous query library with compile-time SQL validation
2. **diesel** — A type-safe, DSL-based synchronous ORM
3. **SeaORM** — An asynchronous ORM following the ActiveRecord pattern


## Prerequisites

Before reading this guide, the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Serde — JSON/TOML/YAML](./02-serde.md)

---

## 1. Overview of Rust Database Crates

### 1.1 Layered Structure

```
┌─────────────────────────────────────────────────┐
│           Application Code                      │
├─────────────────────────────────────────────────┤
│  ORM / Query Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  diesel   │  │  SeaORM  │  │  sqlx    │      │
│  │ (DSL)     │  │ (AR)     │  │ (Raw SQL)│      │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘      │
│        │             │             │            │
├────────┼─────────────┼─────────────┼────────────┤
│  Connection Pool                                │
│  ┌──────────────────────────────────────┐       │
│  │  sqlx::Pool / deadpool / bb8         │       │
│  └──────────────────┬───────────────────┘       │
│                     │                           │
├─────────────────────┼───────────────────────────┤
│  Driver                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ tokio-    │  │ sqlx-    │  │ libpq /  │      │
│  │ postgres  │  │ sqlite   │  │ mysqlclient│    │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
```

### 1.2 Selection Flow

```
Want to use a DB in Rust
       │
       ├── Want to write raw SQL?
       │      │
       │      ├── Yes → sqlx
       │      │         (compile-time SQL validation is appealing)
       │      │
       │      └── No ──┐
       │               │
       ├── Want a type-safe DSL?
       │      │
       │      ├── Yes → diesel
       │      │         (all queries are type-checked at compile time)
       │      │
       │      └── No ──┐
       │               │
       └── Prefer the ActiveRecord pattern?
              │
              └── Yes → SeaORM
                        (Rails/Laravel-like feel)
```

---

## 2. sqlx — Compile-Time SQL Validation

### 2.1 Setup

```toml
# Cargo.toml
[dependencies]
sqlx = { version = "0.8", features = [
    "runtime-tokio",     # async runtime
    "tls-rustls",        # TLS
    "postgres",          # PostgreSQL driver
    "macros",            # query! macro
    "migrate",           # migrations
    "chrono",            # date/time type support
    "uuid",              # UUID type support
] }
tokio = { version = "1", features = ["full"] }
```

### 2.2 Basic CRUD Operations

```rust
use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, FromRow)]
struct User {
    id: Uuid,
    name: String,
    email: String,
    created_at: DateTime<Utc>,
}

// Create connection pool
async fn create_pool() -> Result<PgPool, sqlx::Error> {
    PgPool::builder()
        .max_connections(10)
        .connect("postgres://user:pass@localhost:5432/mydb")
        .await
}

// INSERT — validates SQL at compile time using the query! macro
async fn create_user(pool: &PgPool, name: &str, email: &str) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (id, name, email, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id, name, email, created_at
        "#,
        Uuid::new_v4(),
        name,
        email,
    )
    .fetch_one(pool)
    .await
}

// SELECT — fetch multiple rows
async fn list_users(pool: &PgPool, limit: i64) -> Result<Vec<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        "SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT $1",
        limit,
    )
    .fetch_all(pool)
    .await
}

// UPDATE
async fn update_email(pool: &PgPool, user_id: Uuid, new_email: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        "UPDATE users SET email = $1 WHERE id = $2",
        new_email,
        user_id,
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

// DELETE
async fn delete_user(pool: &PgPool, user_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}
```

### 2.3 Migrations

```bash
# Install sqlx-cli
cargo install sqlx-cli --no-default-features --features postgres

# Create a migration
sqlx migrate add create_users_table

# Edit the generated file
# migrations/20260101000000_create_users_table.sql
```

```sql
-- migrations/20260101000000_create_users_table.sql
CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
```

```bash
# Run migrations
sqlx migrate run

# Check migration status
sqlx migrate info
```

### 2.4 Advanced Transaction Usage

In sqlx, you start a transaction with `pool.begin()` and end it with `commit()` or `rollback()`. Since `Transaction` automatically rolls back on `Drop`, an explicit `rollback()` is not required.

```rust
use sqlx::PgPool;

/// Nested transactions (using SAVEPOINT)
async fn nested_transaction_example(pool: &PgPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Operate within the outer transaction
    sqlx::query!("INSERT INTO audit_log (action) VALUES ('start_batch')")
        .execute(&mut *tx)
        .await?;

    // Nested transaction using SAVEPOINT
    let mut savepoint = tx.begin().await?;  // SAVEPOINT is created automatically

    let result = sqlx::query!(
        "UPDATE inventory SET quantity = quantity - 1 WHERE product_id = $1 AND quantity > 0",
        product_id
    )
    .execute(&mut *savepoint)
    .await?;

    if result.rows_affected() == 0 {
        // If out of stock, roll back to the SAVEPOINT
        // savepoint is automatically rolled back on Drop
        drop(savepoint);
    } else {
        savepoint.commit().await?;  // Release the SAVEPOINT
    }

    // Commit the outer transaction
    sqlx::query!("INSERT INTO audit_log (action) VALUES ('end_batch')")
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}
```

### 2.5 Streaming Queries

When handling large amounts of data, you can stream rows one at a time instead of loading the entire result set into memory.

```rust
use sqlx::PgPool;
use futures::TryStreamExt;  // required to use try_next()

/// Process 1 million rows of data via streaming
async fn process_large_dataset(pool: &PgPool) -> Result<(), sqlx::Error> {
    let mut stream = sqlx::query_as!(
        User,
        "SELECT id, name, email, created_at FROM users WHERE created_at > $1",
        cutoff_date,
    )
    .fetch(pool);  // fetch() returns a stream (not fetch_all())

    let mut count = 0u64;
    while let Some(user) = stream.try_next().await? {
        // Process one row at a time — memory usage stays constant
        process_user(&user).await?;
        count += 1;

        if count % 10_000 == 0 {
            tracing::info!("Processed {} users", count);
        }
    }

    tracing::info!("Total processed: {} users", count);
    Ok(())
}
```

### 2.6 Building Dynamic Queries

The `query!` macro only supports static SQL, but you can use `QueryBuilder` to assemble SQL dynamically.

```rust
use sqlx::{PgPool, QueryBuilder, Postgres};

/// Search for users with dynamic filter conditions
async fn search_users(
    pool: &PgPool,
    name_filter: Option<&str>,
    email_filter: Option<&str>,
    min_created_at: Option<DateTime<Utc>>,
    order_by: &str,
    limit: i64,
) -> Result<Vec<User>, sqlx::Error> {
    let mut builder: QueryBuilder<Postgres> = QueryBuilder::new(
        "SELECT id, name, email, created_at FROM users WHERE 1=1"
    );

    if let Some(name) = name_filter {
        builder.push(" AND name ILIKE ");
        builder.push_bind(format!("%{}%", name));
    }

    if let Some(email) = email_filter {
        builder.push(" AND email ILIKE ");
        builder.push_bind(format!("%{}%", email));
    }

    if let Some(min_date) = min_created_at {
        builder.push(" AND created_at >= ");
        builder.push_bind(min_date);
    }

    // ORDER BY cannot be a bind variable, so validate against a whitelist
    let safe_order = match order_by {
        "name" => "name",
        "email" => "email",
        "created_at" => "created_at",
        _ => "created_at",  // default
    };
    builder.push(format!(" ORDER BY {} DESC", safe_order));

    builder.push(" LIMIT ");
    builder.push_bind(limit);

    builder
        .build_query_as::<User>()
        .fetch_all(pool)
        .await
}
```

### 2.7 Bulk Insert

Methods for efficiently inserting large numbers of records.

```rust
use sqlx::{PgPool, QueryBuilder, Postgres};

/// Bulk insert — insert multiple rows in a single query
async fn bulk_insert_users(
    pool: &PgPool,
    users: &[(String, String)],  // (name, email)
) -> Result<u64, sqlx::Error> {
    // For PostgreSQL, specify multiple rows in the VALUES clause
    let mut builder: QueryBuilder<Postgres> = QueryBuilder::new(
        "INSERT INTO users (id, name, email, created_at) "
    );

    builder.push_values(users.iter(), |mut b, (name, email)| {
        b.push_bind(Uuid::new_v4())
         .push_bind(name)
         .push_bind(email)
         .push("NOW()");
    });

    let result = builder.build().execute(pool).await?;
    Ok(result.rows_affected())
}

/// Even more efficient bulk insert using UNNEST
async fn bulk_insert_with_unnest(
    pool: &PgPool,
    names: &[String],
    emails: &[String],
) -> Result<u64, sqlx::Error> {
    let ids: Vec<Uuid> = (0..names.len()).map(|_| Uuid::new_v4()).collect();

    let result = sqlx::query!(
        r#"
        INSERT INTO users (id, name, email, created_at)
        SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[])
        AS t(id, name, email),
        LATERAL (SELECT NOW() AS created_at) ts
        "#,
        &ids,
        names,
        emails,
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}
```

### 2.8 Mapping Custom Types

How to map PostgreSQL custom types (ENUM, composite types) in sqlx.

```rust
use sqlx::Type;

// Mapping a PostgreSQL ENUM type
// CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'user');
#[derive(Debug, Clone, PartialEq, Type)]
#[sqlx(type_name = "user_role", rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    Moderator,
    User,
}

#[derive(Debug, FromRow)]
struct UserWithRole {
    id: Uuid,
    name: String,
    email: String,
    role: UserRole,
    created_at: DateTime<Utc>,
}

async fn find_admins(pool: &PgPool) -> Result<Vec<UserWithRole>, sqlx::Error> {
    sqlx::query_as!(
        UserWithRole,
        r#"
        SELECT id, name, email, role as "role: UserRole", created_at
        FROM users
        WHERE role = $1
        "#,
        UserRole::Admin as UserRole,
    )
    .fetch_all(pool)
    .await
}

// Mapping a JSON type
use sqlx::types::Json;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
struct UserPreferences {
    theme: String,
    language: String,
    notifications_enabled: bool,
}

#[derive(Debug, FromRow)]
struct UserWithPrefs {
    id: Uuid,
    name: String,
    preferences: Json<UserPreferences>,
}

async fn update_preferences(
    pool: &PgPool,
    user_id: Uuid,
    prefs: &UserPreferences,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE users SET preferences = $1 WHERE id = $2",
        Json(prefs) as _,
        user_id,
    )
    .execute(pool)
    .await?;
    Ok(())
}
```

---

## 3. diesel — A Type-Safe DSL-Based ORM

### 3.1 Setup

```toml
# Cargo.toml
[dependencies]
diesel = { version = "2.2", features = ["postgres", "chrono", "uuid"] }
diesel_migrations = "2.2"
dotenvy = "0.15"
```

### 3.2 Schema and Model Definitions

```rust
// src/schema.rs (auto-generated by the diesel CLI)
diesel::table! {
    users (id) {
        id -> Uuid,
        name -> Varchar,
        email -> Varchar,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    posts (id) {
        id -> Uuid,
        user_id -> Uuid,
        title -> Varchar,
        body -> Text,
        published -> Bool,
        created_at -> Timestamptz,
    }
}

diesel::joinable!(posts -> users (user_id));
diesel::allow_tables_to_appear_in_same_query!(users, posts);
```

```rust
// src/models.rs
use diesel::prelude::*;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Queryable, Selectable, Debug)]
#[diesel(table_name = crate::schema::users)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::users)]
pub struct NewUser<'a> {
    pub name: &'a str,
    pub email: &'a str,
}
```

### 3.3 CRUD Operations

```rust
use diesel::prelude::*;
use crate::schema::users;
use crate::models::{User, NewUser};

// INSERT
fn create_user(conn: &mut PgConnection, name: &str, email: &str) -> QueryResult<User> {
    let new_user = NewUser { name, email };

    diesel::insert_into(users::table)
        .values(&new_user)
        .returning(User::as_returning())
        .get_result(conn)
}

// SELECT with filter
fn find_user_by_email(conn: &mut PgConnection, email_addr: &str) -> QueryResult<User> {
    users::table
        .filter(users::email.eq(email_addr))
        .select(User::as_select())
        .first(conn)
}

// SELECT with JOIN
fn get_user_with_posts(conn: &mut PgConnection, user_id: Uuid) -> QueryResult<Vec<(User, Post)>> {
    users::table
        .inner_join(posts::table)
        .filter(users::id.eq(user_id))
        .filter(posts::published.eq(true))
        .select((User::as_select(), Post::as_select()))
        .load(conn)
}

// UPDATE
fn update_user_email(conn: &mut PgConnection, user_id: Uuid, new_email: &str) -> QueryResult<User> {
    diesel::update(users::table.filter(users::id.eq(user_id)))
        .set(users::email.eq(new_email))
        .returning(User::as_returning())
        .get_result(conn)
}

// DELETE
fn delete_user(conn: &mut PgConnection, user_id: Uuid) -> QueryResult<usize> {
    diesel::delete(users::table.filter(users::id.eq(user_id)))
        .execute(conn)
}
```

### 3.4 Async Support via diesel-async

diesel is inherently synchronous, but the `diesel-async` crate enables asynchronous operation.

```toml
# Cargo.toml
[dependencies]
diesel = { version = "2.2", features = ["postgres", "chrono", "uuid"] }
diesel-async = { version = "0.5", features = ["postgres", "deadpool"] }
deadpool = "0.12"
```

```rust
use diesel_async::{AsyncPgConnection, RunQueryDsl, AsyncConnection};
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::pooled_connection::AsyncDieselConnectionManager;

type DbPool = Pool<AsyncPgConnection>;

/// Creating an async connection pool
fn create_pool(database_url: &str) -> DbPool {
    let config = AsyncDieselConnectionManager::<AsyncPgConnection>::new(database_url);
    Pool::builder(config)
        .max_size(16)
        .build()
        .expect("Failed to create pool")
}

/// Async CRUD operations
async fn create_user_async(
    pool: &DbPool,
    name: &str,
    email: &str,
) -> QueryResult<User> {
    let mut conn = pool.get().await.expect("Failed to get connection");

    let new_user = NewUser { name, email };
    diesel::insert_into(users::table)
        .values(&new_user)
        .returning(User::as_returning())
        .get_result(&mut conn)
        .await
}

/// Async transactions
async fn transfer_with_diesel_async(
    pool: &DbPool,
    from_id: Uuid,
    to_id: Uuid,
    amount: i64,
) -> QueryResult<()> {
    let mut conn = pool.get().await.expect("Failed to get connection");

    conn.transaction::<_, diesel::result::Error, _>(|conn| {
        Box::pin(async move {
            diesel::update(accounts::table.filter(accounts::id.eq(from_id)))
                .set(accounts::balance.eq(accounts::balance - amount))
                .execute(conn)
                .await?;

            diesel::update(accounts::table.filter(accounts::id.eq(to_id)))
                .set(accounts::balance.eq(accounts::balance + amount))
                .execute(conn)
                .await?;

            Ok(())
        })
    })
    .await
}
```

### 3.5 Custom Queries and Pagination

```rust
use diesel::prelude::*;
use diesel::dsl::count_star;

/// Search with pagination
fn paginated_users(
    conn: &mut PgConnection,
    page: i64,
    per_page: i64,
    name_filter: Option<&str>,
) -> QueryResult<(Vec<User>, i64)> {
    let mut query = users::table.into_boxed();  // boxed() enables dynamic queries

    if let Some(name) = name_filter {
        query = query.filter(users::name.ilike(format!("%{}%", name)));
    }

    // Get total count
    let total = users::table
        .select(count_star())
        .first::<i64>(conn)?;

    // Pagination
    let results = query
        .order(users::created_at.desc())
        .limit(per_page)
        .offset((page - 1) * per_page)
        .select(User::as_select())
        .load(conn)?;

    Ok((results, total))
}

/// GROUP BY and aggregate functions
fn user_post_counts(conn: &mut PgConnection) -> QueryResult<Vec<(Uuid, String, i64)>> {
    users::table
        .left_join(posts::table)
        .group_by((users::id, users::name))
        .select((users::id, users::name, diesel::dsl::count(posts::id.nullable())))
        .order(diesel::dsl::count(posts::id.nullable()).desc())
        .load::<(Uuid, String, i64)>(conn)
}

/// Using subqueries
fn users_with_recent_posts(conn: &mut PgConnection) -> QueryResult<Vec<User>> {
    let recent_posters = posts::table
        .filter(posts::created_at.gt(chrono::Utc::now() - chrono::Duration::days(7)))
        .select(posts::user_id);

    users::table
        .filter(users::id.eq_any(recent_posters))
        .select(User::as_select())
        .load(conn)
}
```

### 3.6 Managing Migrations in diesel

```bash
# Install the diesel CLI
cargo install diesel_cli --no-default-features --features postgres

# Initialize the project (creates diesel.toml and the migrations/ directory)
diesel setup

# Create a migration
diesel migration generate create_users

# Run migrations
diesel migration run

# Roll back migrations
diesel migration revert

# Check migration status
diesel migration list

# Regenerate the schema
diesel print-schema > src/schema.rs
```

```sql
-- migrations/2026-01-01-000000_create_users/up.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrations/2026-01-01-000000_create_users/down.sql
DROP TABLE users;
```

diesel migrations are managed as pairs of `up.sql` and `down.sql`. Writing rollback-capable migrations makes schema changes easy during development.

---

## 4. SeaORM — An ActiveRecord-Style Asynchronous ORM

### 4.1 Setup

```toml
# Cargo.toml
[dependencies]
sea-orm = { version = "1.0", features = [
    "sqlx-postgres",
    "runtime-tokio-rustls",
    "macros",
] }
```

### 4.2 Entity Definition

```rust
// src/entities/user.rs
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::post::Entity")]
    Posts,
}

impl Related<super::post::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Posts.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
```

### 4.3 CRUD Operations

```rust
use sea_orm::*;
use crate::entities::{user, post};

// INSERT
async fn create_user(db: &DatabaseConnection, name: &str, email: &str) -> Result<user::Model, DbErr> {
    let new_user = user::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(name.to_string()),
        email: Set(email.to_string()),
        created_at: Set(chrono::Utc::now()),
        ..Default::default()
    };

    new_user.insert(db).await
}

// SELECT with filter and pagination
async fn list_users(
    db: &DatabaseConnection,
    page: u64,
    per_page: u64,
) -> Result<(Vec<user::Model>, u64), DbErr> {
    let paginator = user::Entity::find()
        .order_by_desc(user::Column::CreatedAt)
        .paginate(db, per_page);

    let total = paginator.num_pages().await?;
    let users = paginator.fetch_page(page).await?;

    Ok((users, total))
}

// SELECT with JOIN (Eager Loading)
async fn get_user_with_posts(
    db: &DatabaseConnection,
    user_id: Uuid,
) -> Result<Option<(user::Model, Vec<post::Model>)>, DbErr> {
    let result = user::Entity::find_by_id(user_id)
        .find_with_related(post::Entity)
        .all(db)
        .await?;

    Ok(result.into_iter().next())
}

// UPDATE
async fn update_email(
    db: &DatabaseConnection,
    user_id: Uuid,
    new_email: &str,
) -> Result<user::Model, DbErr> {
    let mut user: user::ActiveModel = user::Entity::find_by_id(user_id)
        .one(db)
        .await?
        .ok_or(DbErr::RecordNotFound("User not found".into()))?
        .into();

    user.email = Set(new_email.to_string());
    user.update(db).await
}

// DELETE
async fn delete_user(db: &DatabaseConnection, user_id: Uuid) -> Result<DeleteResult, DbErr> {
    user::Entity::delete_by_id(user_id).exec(db).await
}
```

### 4.4 Advanced SeaORM Queries

```rust
use sea_orm::*;
use sea_orm::sea_query::{Expr, Func};

/// Conditional dynamic queries
async fn search_users_sea(
    db: &DatabaseConnection,
    name_filter: Option<String>,
    email_filter: Option<String>,
    page: u64,
    per_page: u64,
) -> Result<(Vec<user::Model>, u64), DbErr> {
    let mut query = user::Entity::find();

    if let Some(name) = name_filter {
        query = query.filter(user::Column::Name.contains(&name));
    }

    if let Some(email) = email_filter {
        query = query.filter(user::Column::Email.contains(&email));
    }

    let paginator = query
        .order_by_desc(user::Column::CreatedAt)
        .paginate(db, per_page);

    let total = paginator.num_pages().await?;
    let users = paginator.fetch_page(page).await?;

    Ok((users, total))
}

/// Custom SELECT and grouping
async fn user_post_stats(
    db: &DatabaseConnection,
) -> Result<Vec<(Uuid, String, i64)>, DbErr> {
    #[derive(Debug, FromQueryResult)]
    struct UserPostCount {
        user_id: Uuid,
        user_name: String,
        post_count: i64,
    }

    let results = user::Entity::find()
        .select_only()
        .column(user::Column::Id)
        .column(user::Column::Name)
        .column_as(post::Column::Id.count(), "post_count")
        .join(JoinType::LeftJoin, user::Relation::Posts.def())
        .group_by(user::Column::Id)
        .group_by(user::Column::Name)
        .order_by_desc(Expr::col(post::Column::Id).count())
        .into_model::<UserPostCount>()
        .all(db)
        .await?;

    Ok(results.into_iter().map(|r| (r.user_id, r.user_name, r.post_count)).collect())
}

/// Transactions
async fn create_user_with_post(
    db: &DatabaseConnection,
    name: &str,
    email: &str,
    post_title: &str,
    post_body: &str,
) -> Result<(user::Model, post::Model), DbErr> {
    let txn = db.begin().await?;

    let new_user = user::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(name.to_string()),
        email: Set(email.to_string()),
        created_at: Set(chrono::Utc::now()),
        ..Default::default()
    };
    let user = new_user.insert(&txn).await?;

    let new_post = post::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user.id),
        title: Set(post_title.to_string()),
        body: Set(post_body.to_string()),
        published: Set(false),
        created_at: Set(chrono::Utc::now()),
        ..Default::default()
    };
    let post = new_post.insert(&txn).await?;

    txn.commit().await?;
    Ok((user, post))
}
```

### 4.5 SeaORM CLI and Code Generation

```bash
# Install sea-orm-cli
cargo install sea-orm-cli

# Auto-generate entities from the database
sea-orm-cli generate entity \
    --database-url "postgres://user:pass@localhost:5432/mydb" \
    --output-dir src/entities \
    --with-serde both \
    --date-time-crate chrono

# Create a migration
sea-orm-cli migrate generate create_users_table

# Run migrations
sea-orm-cli migrate up

# Roll back migrations
sea-orm-cli migrate down
```

Auto-generating entities produces Rust code from an existing database schema, which is especially convenient when integrating with legacy databases.

---

## 5. Comparison Tables

### 5.1 Feature Comparison

| Feature | sqlx | diesel | SeaORM |
|------|------|--------|--------|
| **Paradigm** | Raw SQL + macros | DSL-based ORM | ActiveRecord ORM |
| **Async support** | Native | Available via diesel-async | Native |
| **Compile-time validation** | SQL syntax + types | DSL-level type safety | None (runtime validation) |
| **Migrations** | SQL files | DSL or SQL | SeaORM CLI |
| **PostgreSQL** | Supported | Supported | Supported |
| **MySQL** | Supported | Supported | Supported |
| **SQLite** | Supported | Supported | Supported |
| **Transactions** | Supported | Supported | Supported |
| **Connection pool** | Built-in | External (r2d2/deadpool) | Built-in (sqlx-based) |
| **Learning curve** | Low (knowing SQL is enough) | Medium (must learn the DSL) | Medium (understand entity definitions) |
| **Community** | Large | Large | Medium |

### 5.2 Performance Characteristics Comparison

| Aspect | sqlx | diesel | SeaORM |
|------|------|--------|--------|
| **Query generation overhead** | None (raw SQL) | Small (DSL→SQL conversion) | Medium (ORM abstraction) |
| **Compile time** | Medium (macro expansion) | Long (heavy type inference) | Medium |
| **Binary size** | Small | Medium | Medium |
| **N+1 problem mitigation** | Manual (control via SQL) | Manual (write JOINs) | find_with_related |
| **Bulk insert** | query + unnest | insert_into().values(&vec) | insert_many() |
| **Raw SQL fallback** | Default | sql_query() | FromQueryResult |

---

## 6. Designing and Optimizing Connection Pools

### 6.1 Connection Pool Fundamentals

Database connections are resource-intensive, so use a connection pool to reuse them. Pool size configuration directly affects application performance.

```rust
use sqlx::postgres::PgPoolOptions;

/// Production-grade connection pool configuration
async fn create_production_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        // Max connections: a rule of thumb is CPU cores * 2 + number of disk spindles
        // Generally 10-20 is appropriate
        .max_connections(20)
        // Min connections: number of connections to keep alive while idle
        .min_connections(5)
        // Acquire timeout: maximum time to wait when getting a connection from the pool
        .acquire_timeout(std::time::Duration::from_secs(5))
        // Idle timeout: time before closing unused connections
        .idle_timeout(std::time::Duration::from_secs(600))
        // Max lifetime of a connection: periodically refresh old connections
        .max_lifetime(std::time::Duration::from_secs(1800))
        // SQL run when a connection is established (validation or session setup)
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                sqlx::query("SET timezone = 'UTC'")
                    .execute(conn)
                    .await?;
                sqlx::query("SET statement_timeout = '30s'")
                    .execute(conn)
                    .await?;
                Ok(())
            })
        })
        .connect(database_url)
        .await
}
```

### 6.2 Determining Connection Pool Size

Pool size should be determined considering the following factors.

```
Recommended pool size formula:

  pool_size = (number of CPU cores * 2) + effective disk spindles

Example:
  4-core CPU + SSD (equivalent to 1 spindle)
  → pool_size = (4 * 2) + 1 = 9 ≈ 10

Notes:
  - PostgreSQL's default max_connections is 100
  - When you have multiple application instances, consider the total
  - pool_size = max_connections(DB) / app_instances - margin
```

### 6.3 Monitoring the Connection Pool

```rust
use sqlx::PgPool;
use tracing::info;

/// Log the connection pool status
async fn log_pool_status(pool: &PgPool) {
    let size = pool.size();
    let idle = pool.num_idle();
    let acquired = size - idle as u32;

    info!(
        pool.size = size,
        pool.idle = idle,
        pool.acquired = acquired,
        "Connection pool status"
    );

    // Warn if pool utilization exceeds 80%
    if (acquired as f64 / size as f64) > 0.8 {
        tracing::warn!(
            "Connection pool utilization is high: {}/{}",
            acquired,
            size
        );
    }
}

/// Health check endpoint
async fn health_check(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT 1")
        .execute(pool)
        .await?;
    Ok(())
}
```

---

## 7. Testing Strategy

### 7.1 Managing Test Databases

For database tests, it is important that each test runs independently.

```rust
/// Helper to create a test database
async fn create_test_database() -> PgPool {
    let db_name = format!("test_{}", Uuid::new_v4().to_string().replace('-', ""));
    let admin_url = "postgres://user:pass@localhost:5432/postgres";

    // Create the test database
    let admin_pool = PgPool::connect(admin_url).await.unwrap();
    sqlx::query(&format!("CREATE DATABASE {}", db_name))
        .execute(&admin_pool)
        .await
        .unwrap();

    // Connect to the test database and run migrations
    let test_url = format!("postgres://user:pass@localhost:5432/{}", db_name);
    let pool = PgPool::connect(&test_url).await.unwrap();
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .unwrap();

    pool
}

/// Drop the database after the test ends
async fn cleanup_test_database(pool: PgPool, db_name: &str) {
    pool.close().await;

    let admin_url = "postgres://user:pass@localhost:5432/postgres";
    let admin_pool = PgPool::connect(admin_url).await.unwrap();
    sqlx::query(&format!("DROP DATABASE IF EXISTS {}", db_name))
        .execute(&admin_pool)
        .await
        .unwrap();
}
```

### 7.2 Transaction-Based Tests

By running each test inside a transaction and rolling it back at the end, you can achieve fast and clean tests.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::PgPool;

    /// Helper to run a test inside a transaction
    /// Automatically rolled back at the end of the test
    async fn with_test_tx<F, Fut>(pool: &PgPool, f: F)
    where
        F: FnOnce(sqlx::Transaction<'_, sqlx::Postgres>) -> Fut,
        Fut: std::future::Future<Output = ()>,
    {
        let tx = pool.begin().await.unwrap();
        f(tx).await;
        // tx is automatically rolled back on Drop
    }

    #[sqlx::test]
    async fn test_create_user(pool: PgPool) {
        // The sqlx::test macro automatically manages the test DB
        let user = create_user(&pool, "Test User", "test@example.com")
            .await
            .unwrap();

        assert_eq!(user.name, "Test User");
        assert_eq!(user.email, "test@example.com");
    }

    #[sqlx::test(fixtures("users"))]
    async fn test_list_users(pool: PgPool) {
        // Load initial data from the fixtures directory
        let users = list_users(&pool, 10).await.unwrap();
        assert!(!users.is_empty());
    }

    #[sqlx::test]
    async fn test_update_email(pool: PgPool) {
        let user = create_user(&pool, "Test", "old@example.com")
            .await
            .unwrap();

        let updated = update_email(&pool, user.id, "new@example.com")
            .await
            .unwrap();

        assert!(updated);

        let found = sqlx::query_as!(
            User,
            "SELECT id, name, email, created_at FROM users WHERE id = $1",
            user.id
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(found.email, "new@example.com");
    }
}
```

### 7.3 Testing with diesel

```rust
#[cfg(test)]
mod tests {
    use diesel::prelude::*;
    use diesel::Connection;

    /// Transaction-based testing with diesel
    #[test]
    fn test_create_user_diesel() {
        let mut conn = PgConnection::establish("postgres://...")
            .expect("Failed to connect");

        // test_transaction runs the test inside a transaction
        // and automatically rolls back at the end
        conn.test_transaction::<_, diesel::result::Error, _>(|conn| {
            let user = create_user(conn, "Test", "test@example.com")?;
            assert_eq!(user.name, "Test");
            assert_eq!(user.email, "test@example.com");

            let found = find_user_by_email(conn, "test@example.com")?;
            assert_eq!(found.id, user.id);

            Ok(())
        });
    }
}
```

### 7.4 Managing Test Fixtures

```sql
-- fixtures/users.sql (used by sqlx::test fixtures)
INSERT INTO users (id, name, email, created_at) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Alice', 'alice@example.com', '2026-01-01 00:00:00+00'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Bob', 'bob@example.com', '2026-01-02 00:00:00+00'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Charlie', 'charlie@example.com', '2026-01-03 00:00:00+00');
```

```rust
/// Test data builder pattern
struct UserBuilder {
    name: String,
    email: String,
}

impl UserBuilder {
    fn new() -> Self {
        Self {
            name: "Default User".to_string(),
            email: format!("user-{}@example.com", Uuid::new_v4()),
        }
    }

    fn name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    fn email(mut self, email: &str) -> Self {
        self.email = email.to_string();
        self
    }

    async fn build(self, pool: &PgPool) -> User {
        create_user(pool, &self.name, &self.email)
            .await
            .expect("Failed to create test user")
    }
}

// Usage example
#[sqlx::test]
async fn test_with_builder(pool: PgPool) {
    let alice = UserBuilder::new()
        .name("Alice")
        .email("alice@test.com")
        .build(&pool)
        .await;

    let bob = UserBuilder::new()
        .name("Bob")
        .build(&pool)  // email is auto-generated
        .await;

    assert_ne!(alice.id, bob.id);
}
```

---

## 8. Anti-Patterns

### 8.1 N+1 Query Problem

```rust
// BAD: Fetching posts individually for each user (N+1)
async fn bad_get_users_with_posts(pool: &PgPool) -> Result<Vec<(User, Vec<Post>)>> {
    let users = sqlx::query_as!(User, "SELECT * FROM users")
        .fetch_all(pool).await?;

    let mut result = Vec::new();
    for user in users {
        // A query is issued for every single user!
        let posts = sqlx::query_as!(Post,
            "SELECT * FROM posts WHERE user_id = $1", user.id
        ).fetch_all(pool).await?;
        result.push((user, posts));
    }
    Ok(result)
}

// GOOD: Fetch in a single query using JOIN
async fn good_get_users_with_posts(pool: &PgPool) -> Result<Vec<UserWithPosts>> {
    sqlx::query_as!(UserWithPosts,
        r#"
        SELECT u.id, u.name, u.email,
               COALESCE(json_agg(p.*) FILTER (WHERE p.id IS NOT NULL), '[]') as "posts!: Json<Vec<Post>>"
        FROM users u
        LEFT JOIN posts p ON p.user_id = u.id
        GROUP BY u.id
        "#
    ).fetch_all(pool).await
}
```

### 8.2 Multiple Operations Without a Transaction

```rust
// BAD: Operating on related data without a transaction
async fn bad_transfer(pool: &PgPool, from: Uuid, to: Uuid, amount: i64) -> Result<()> {
    sqlx::query!("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from)
        .execute(pool).await?;
    // ← If a failure occurs here, the balance is lost!
    sqlx::query!("UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to)
        .execute(pool).await?;
    Ok(())
}

// GOOD: Guarantee atomicity with a transaction
async fn good_transfer(pool: &PgPool, from: Uuid, to: Uuid, amount: i64) -> Result<()> {
    let mut tx = pool.begin().await?;

    sqlx::query!("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, from)
        .execute(&mut *tx).await?;
    sqlx::query!("UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to)
        .execute(&mut *tx).await?;

    tx.commit().await?;  // Commit only if both succeed
    Ok(())
}
```

### 8.3 Connection Pool Exhaustion

```rust
// BAD: Holding a connection for a long time
async fn bad_long_running(pool: &PgPool) -> Result<()> {
    let mut tx = pool.begin().await?;  // Acquire one connection

    // Operations unrelated to the DB, such as calling an external API
    let response = reqwest::get("https://api.example.com/slow-endpoint")
        .await?;  // ← The DB connection is held the whole time!

    sqlx::query!("INSERT INTO results (data) VALUES ($1)", response.text().await?)
        .execute(&mut *tx).await?;

    tx.commit().await?;
    Ok(())
}

// GOOD: Separate DB and non-DB operations
async fn good_minimal_connection(pool: &PgPool) -> Result<()> {
    // 1. First, call the external API (no DB connection needed)
    let response = reqwest::get("https://api.example.com/slow-endpoint")
        .await?;
    let data = response.text().await?;

    // 2. Complete the DB operation in minimal time
    sqlx::query!("INSERT INTO results (data) VALUES ($1)", data)
        .execute(pool).await?;

    Ok(())
}
```

### 8.4 Poor Index Design

```rust
// BAD: Frequently searching on an unindexed column
async fn bad_search(pool: &PgPool, status: &str) -> Result<Vec<Order>> {
    // Without an index on the status column, this becomes a full table scan
    sqlx::query_as!(Order, "SELECT * FROM orders WHERE status = $1", status)
        .fetch_all(pool).await
}

// GOOD: Add an appropriate index via migration
// migrations/xxx_add_orders_status_index.sql:
// CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);
//
// For composite indexes, column order matters:
// CREATE INDEX idx_orders_status_date ON orders (status, created_at DESC);
// ↑ Optimal for queries like WHERE status = ? ORDER BY created_at DESC
```

### 8.5 Overuse of SELECT *

```rust
// BAD: Fetching all columns including unnecessary ones
async fn bad_get_names(pool: &PgPool) -> Result<Vec<String>> {
    let users = sqlx::query_as!(User, "SELECT * FROM users")  // fetches all columns
        .fetch_all(pool).await?;
    Ok(users.into_iter().map(|u| u.name).collect())  // only name is used
}

// GOOD: Fetch only the columns you need
async fn good_get_names(pool: &PgPool) -> Result<Vec<String>> {
    let rows = sqlx::query_scalar!("SELECT name FROM users")
        .fetch_all(pool).await?;
    Ok(rows)
}
```

---

## 9. Performance Tuning

### 9.1 Analyzing Execution Plans with EXPLAIN ANALYZE

```rust
/// Utility to retrieve the execution plan of a query
async fn explain_query(pool: &PgPool, query: &str) -> Result<String, sqlx::Error> {
    let rows = sqlx::query_scalar::<_, String>(
        &format!("EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) {}", query)
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.join("\n"))
}

// Usage example
async fn debug_slow_query(pool: &PgPool) {
    let plan = explain_query(
        pool,
        "SELECT u.*, count(p.id) FROM users u LEFT JOIN posts p ON p.user_id = u.id GROUP BY u.id"
    ).await.unwrap();

    println!("Query Plan:\n{}", plan);
    // If you see Seq Scan, consider adding an index
    // If you see Nested Loop, consider optimizing the JOIN
}
```

### 9.2 Prepared Statement Caching

```rust
// The sqlx query! macro automatically caches prepared statements.
// If you need to manage prepared statements manually:

use sqlx::Statement;

async fn cached_query_example(pool: &PgPool) -> Result<Vec<User>, sqlx::Error> {
    // Prepared statements are cached per connection
    // When using the query_as! macro, this is managed automatically — no manual handling required

    // For query(), you can control it via persistent()
    sqlx::query_as::<_, User>("SELECT id, name, email, created_at FROM users WHERE email = $1")
        .bind("test@example.com")
        .persistent(true)  // Cache the prepared statement (default: true)
        .fetch_all(pool)
        .await
}
```

### 9.3 Batch Processing and Pipelines

```rust
/// Efficient batch processing of large amounts of data
async fn batch_update_status(
    pool: &PgPool,
    user_ids: &[Uuid],
    new_status: &str,
) -> Result<u64, sqlx::Error> {
    // Limit the number updated at once to reduce deadlock risk
    const BATCH_SIZE: usize = 1000;
    let mut total_affected = 0u64;

    for chunk in user_ids.chunks(BATCH_SIZE) {
        let result = sqlx::query!(
            "UPDATE users SET status = $1 WHERE id = ANY($2)",
            new_status,
            chunk,
        )
        .execute(pool)
        .await?;

        total_affected += result.rows_affected();
    }

    Ok(total_affected)
}

/// Ultra-fast bulk loading using the COPY protocol (PostgreSQL specific)
async fn bulk_load_with_copy(
    pool: &PgPool,
    csv_data: &str,
) -> Result<u64, sqlx::Error> {
    let mut conn = pool.acquire().await?;

    let copy_result = sqlx::query(
        "COPY users (name, email) FROM STDIN WITH (FORMAT CSV, HEADER true)"
    )
    .execute(&mut *conn)
    .await?;

    Ok(copy_result.rows_affected())
}
```

### 9.4 Leveraging Read Replicas

```rust
use sqlx::PgPool;

/// Read/write separation pattern
struct DatabasePools {
    writer: PgPool,   // primary (for writes)
    reader: PgPool,   // replica (for reads)
}

impl DatabasePools {
    async fn new(
        writer_url: &str,
        reader_url: &str,
    ) -> Result<Self, sqlx::Error> {
        let writer = PgPoolOptions::new()
            .max_connections(10)
            .connect(writer_url)
            .await?;

        let reader = PgPoolOptions::new()
            .max_connections(20)  // larger because reads are more frequent
            .connect(reader_url)
            .await?;

        Ok(Self { writer, reader })
    }

    /// Send write operations to the primary
    fn writer(&self) -> &PgPool {
        &self.writer
    }

    /// Send read operations to the replica
    fn reader(&self) -> &PgPool {
        &self.reader
    }
}

// Usage example with Axum
async fn list_users_handler(
    State(pools): State<DatabasePools>,
) -> Json<Vec<User>> {
    let users = sqlx::query_as!(User, "SELECT * FROM users LIMIT 50")
        .fetch_all(pools.reader())  // read from the replica
        .await
        .unwrap();
    Json(users)
}

async fn create_user_handler(
    State(pools): State<DatabasePools>,
    Json(payload): Json<CreateUserRequest>,
) -> Json<User> {
    let user = create_user(pools.writer(), &payload.name, &payload.email)  // write to the primary
        .await
        .unwrap();
    Json(user)
}
```

---

## 10. Error Handling Best Practices

### 10.1 Defining Custom Error Types

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Record not found: {entity} with id {id}")]
    NotFound { entity: String, id: String },

    #[error("Duplicate entry: {field} = {value}")]
    DuplicateEntry { field: String, value: String },

    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),

    #[error("Connection pool exhausted")]
    PoolExhausted,
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::RowNotFound => AppError::NotFound {
                entity: "unknown".to_string(),
                id: "unknown".to_string(),
            },
            sqlx::Error::Database(db_err) => {
                // Classification based on PostgreSQL error codes
                if let Some(code) = db_err.code() {
                    match code.as_ref() {
                        "23505" => AppError::DuplicateEntry {
                            field: db_err.constraint()
                                .unwrap_or("unknown")
                                .to_string(),
                            value: "unknown".to_string(),
                        },
                        "23503" => AppError::ConstraintViolation(
                            db_err.message().to_string()
                        ),
                        _ => AppError::Database(err),
                    }
                } else {
                    AppError::Database(err)
                }
            }
            sqlx::Error::PoolTimedOut => AppError::PoolExhausted,
            _ => AppError::Database(err),
        }
    }
}
```

### 10.2 Retry Logic

```rust
use std::time::Duration;
use tokio::time::sleep;

/// Automatic retry on deadlocks or timeouts
async fn with_retry<F, Fut, T>(
    max_retries: u32,
    base_delay: Duration,
    f: F,
) -> Result<T, sqlx::Error>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, sqlx::Error>>,
{
    let mut retries = 0;

    loop {
        match f().await {
            Ok(result) => return Ok(result),
            Err(err) if is_retryable(&err) && retries < max_retries => {
                retries += 1;
                let delay = base_delay * 2u32.pow(retries - 1);  // exponential backoff
                let jitter = Duration::from_millis(rand::random::<u64>() % 100);
                tracing::warn!(
                    retry = retries,
                    max_retries = max_retries,
                    "Retryable database error, waiting {:?}",
                    delay + jitter
                );
                sleep(delay + jitter).await;
            }
            Err(err) => return Err(err),
        }
    }
}

/// Determine whether an error is retryable
fn is_retryable(err: &sqlx::Error) -> bool {
    match err {
        sqlx::Error::PoolTimedOut => true,
        sqlx::Error::Database(db_err) => {
            if let Some(code) = db_err.code() {
                matches!(
                    code.as_ref(),
                    "40001"   // serialization_failure
                    | "40P01" // deadlock_detected
                    | "57P03" // cannot_connect_now
                    | "08006" // connection_failure
                )
            } else {
                false
            }
        }
        sqlx::Error::Io(_) => true,  // network error
        _ => false,
    }
}

// Usage example
async fn reliable_transfer(
    pool: &PgPool,
    from: Uuid,
    to: Uuid,
    amount: i64,
) -> Result<(), sqlx::Error> {
    with_retry(3, Duration::from_millis(100), || async {
        let mut tx = pool.begin().await?;

        sqlx::query!(
            "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
            amount, from
        ).execute(&mut *tx).await?;

        sqlx::query!(
            "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
            amount, to
        ).execute(&mut *tx).await?;

        tx.commit().await
    }).await
}
```

---

## 11. Practical Repository Pattern

### 11.1 Defining a Repository Trait

```rust
use async_trait::async_trait;

/// Repository pattern — abstraction over the DB implementation
#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError>;
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError>;
    async fn list(&self, page: i64, per_page: i64) -> Result<(Vec<User>, i64), AppError>;
    async fn create(&self, name: &str, email: &str) -> Result<User, AppError>;
    async fn update(&self, id: Uuid, name: &str, email: &str) -> Result<User, AppError>;
    async fn delete(&self, id: Uuid) -> Result<bool, AppError>;
}

/// Implementation using sqlx
pub struct PgUserRepository {
    pool: PgPool,
}

impl PgUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PgUserRepository {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as!(
            User,
            "SELECT id, name, email, created_at FROM users WHERE id = $1",
            id,
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as!(
            User,
            "SELECT id, name, email, created_at FROM users WHERE email = $1",
            email,
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    async fn list(&self, page: i64, per_page: i64) -> Result<(Vec<User>, i64), AppError> {
        let total = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
            .fetch_one(&self.pool)
            .await?
            .unwrap_or(0);

        let users = sqlx::query_as!(
            User,
            "SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            per_page,
            (page - 1) * per_page,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok((users, total))
    }

    async fn create(&self, name: &str, email: &str) -> Result<User, AppError> {
        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (id, name, email, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, name, email, created_at
            "#,
            Uuid::new_v4(),
            name,
            email,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    async fn update(&self, id: Uuid, name: &str, email: &str) -> Result<User, AppError> {
        let user = sqlx::query_as!(
            User,
            r#"
            UPDATE users SET name = $1, email = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING id, name, email, created_at
            "#,
            name,
            email,
            id,
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AppError::NotFound {
            entity: "User".to_string(),
            id: id.to_string(),
        })?;

        Ok(user)
    }

    async fn delete(&self, id: Uuid) -> Result<bool, AppError> {
        let result = sqlx::query!("DELETE FROM users WHERE id = $1", id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
}
```

### 11.2 Mock Repository for Testing

```rust
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/// In-memory repository for testing
pub struct MockUserRepository {
    users: Arc<Mutex<HashMap<Uuid, User>>>,
}

impl MockUserRepository {
    pub fn new() -> Self {
        Self {
            users: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[async_trait]
impl UserRepository for MockUserRepository {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError> {
        let users = self.users.lock().unwrap();
        Ok(users.get(&id).cloned())
    }

    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let users = self.users.lock().unwrap();
        Ok(users.values().find(|u| u.email == email).cloned())
    }

    async fn list(&self, page: i64, per_page: i64) -> Result<(Vec<User>, i64), AppError> {
        let users = self.users.lock().unwrap();
        let total = users.len() as i64;
        let offset = ((page - 1) * per_page) as usize;
        let limit = per_page as usize;

        let mut sorted: Vec<User> = users.values().cloned().collect();
        sorted.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        let page_users = sorted.into_iter().skip(offset).take(limit).collect();
        Ok((page_users, total))
    }

    async fn create(&self, name: &str, email: &str) -> Result<User, AppError> {
        let mut users = self.users.lock().unwrap();
        let user = User {
            id: Uuid::new_v4(),
            name: name.to_string(),
            email: email.to_string(),
            created_at: chrono::Utc::now(),
        };
        users.insert(user.id, user.clone());
        Ok(user)
    }

    async fn update(&self, id: Uuid, name: &str, email: &str) -> Result<User, AppError> {
        let mut users = self.users.lock().unwrap();
        let user = users.get_mut(&id)
            .ok_or(AppError::NotFound {
                entity: "User".to_string(),
                id: id.to_string(),
            })?;

        user.name = name.to_string();
        user.email = email.to_string();
        Ok(user.clone())
    }

    async fn delete(&self, id: Uuid) -> Result<bool, AppError> {
        let mut users = self.users.lock().unwrap();
        Ok(users.remove(&id).is_some())
    }
}

// Usage example in tests
#[tokio::test]
async fn test_user_service_with_mock() {
    let repo = MockUserRepository::new();
    let service = UserService::new(Arc::new(repo));

    let user = service.register("Alice", "alice@example.com").await.unwrap();
    assert_eq!(user.name, "Alice");

    let found = service.find_by_email("alice@example.com").await.unwrap();
    assert!(found.is_some());
}
```

---

## 12. FAQ

### Q1. How does sqlx's `query!` macro validate SQL at compile time?

**A.** At compile time, the `query!` macro connects to the actual database specified by the `DATABASE_URL` environment variable and uses a `PREPARE` statement to validate SQL syntax and column types. In CI/CD, you can build without a DB connection by using offline mode (the `.sqlx/` directory generated via `sqlx prepare`).

```bash
# Generate query metadata for offline use
cargo sqlx prepare
# → metadata is saved in the .sqlx/ directory (commit to Git)
```

### Q2. Can diesel and sqlx be used together in the same project?

**A.** Technically possible but not recommended. It increases dependencies and complicates connection pool management. If you only need raw SQL for complex queries, it is better to use diesel's `sql_query()` or sqlx's ability to write raw SQL.

### Q3. How do I integrate with web frameworks (Axum/Actix Web)?

**A.** With Axum, sharing the pool via `State` is the common approach.

```rust
use axum::{extract::State, routing::get, Router, Json};
use sqlx::PgPool;

async fn list_users(State(pool): State<PgPool>) -> Json<Vec<User>> {
    let users = sqlx::query_as!(User, "SELECT * FROM users LIMIT 50")
        .fetch_all(&pool)
        .await
        .unwrap();
    Json(users)
}

#[tokio::main]
async fn main() {
    let pool = PgPool::connect("postgres://...").await.unwrap();

    let app = Router::new()
        .route("/users", get(list_users))
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

### Q4. How should migrations be operated in production?

**A.** Migrations are either run automatically at application startup or executed in the CI/CD pipeline.

```rust
// Run migrations at application startup
#[tokio::main]
async fn main() {
    let pool = PgPool::connect("postgres://...").await.unwrap();

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Start the application
    start_server(pool).await;
}
```

In production, keep the following in mind:
- **Zero downtime**: Since `ALTER TABLE` acquires locks, on large tables use `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` (instant on PostgreSQL 11+).
- **Rollback plan**: Provide rollback SQL for each migration.
- **Testing**: Validate migrations beforehand in a staging environment.

### Q5. What if OFFSET is slow when paginating large datasets?

**A.** OFFSET scans through the specified number of rows, so it becomes slow with large offsets. Use cursor-based pagination instead.

```rust
/// Cursor-based pagination (without OFFSET)
async fn list_users_cursor(
    pool: &PgPool,
    cursor: Option<DateTime<Utc>>,  // the created_at of the last row on the previous page
    limit: i64,
) -> Result<Vec<User>, sqlx::Error> {
    match cursor {
        Some(after) => {
            sqlx::query_as!(
                User,
                r#"
                SELECT id, name, email, created_at
                FROM users
                WHERE created_at < $1
                ORDER BY created_at DESC
                LIMIT $2
                "#,
                after,
                limit,
            )
            .fetch_all(pool)
            .await
        }
        None => {
            sqlx::query_as!(
                User,
                r#"
                SELECT id, name, email, created_at
                FROM users
                ORDER BY created_at DESC
                LIMIT $1
                "#,
                limit,
            )
            .fetch_all(pool)
            .await
        }
    }
}
```

### Q6. How do I support multiple databases (multi-tenancy)?

**A.** There are several ways to implement multi-tenancy.

```rust
/// Schema-based multi-tenancy (PostgreSQL)
async fn with_tenant_schema(
    pool: &PgPool,
    tenant_id: &str,
) -> Result<Vec<User>, sqlx::Error> {
    let mut conn = pool.acquire().await?;

    // Switch to the tenant's schema
    sqlx::query(&format!("SET search_path TO tenant_{}, public", tenant_id))
        .execute(&mut *conn)
        .await?;

    // Subsequent queries run in the tenant's schema
    sqlx::query_as!(User, "SELECT id, name, email, created_at FROM users")
        .fetch_all(&mut *conn)
        .await
}

/// Database-isolated multi-tenancy
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

struct TenantPools {
    pools: Arc<RwLock<HashMap<String, PgPool>>>,
}

impl TenantPools {
    async fn get_pool(&self, tenant_id: &str) -> Option<PgPool> {
        let pools = self.pools.read().await;
        pools.get(tenant_id).cloned()
    }

    async fn add_tenant(&self, tenant_id: &str, database_url: &str) -> Result<(), sqlx::Error> {
        let pool = PgPool::connect(database_url).await?;
        let mut pools = self.pools.write().await;
        pools.insert(tenant_id.to_string(), pool);
        Ok(())
    }
}
```

---


## FAQ

### Q1: What is the most important point in studying this topic?

Gaining hands-on experience is the most important. Beyond theory, deepening your understanding by writing actual code and verifying its behavior is crucial.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals to jump straight into advanced topics. We recommend solidly grasping the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently used in everyday development work. It is especially important during code reviews and architectural design.

---

## 13. Summary

| Item | Key Points |
|------|---------|
| **sqlx** | For raw-SQL fans, compile-time validation, async-native |
| **diesel** | Type-safe DSL, strongest compile-time guarantees, primarily synchronous (with async extension) |
| **SeaORM** | ActiveRecord pattern, Rails-like development experience, async-native |
| **Selection criteria** | SQL control → sqlx, type safety → diesel, productivity → SeaORM |
| **Connection pool** | Proper sizing, monitoring, and timeout configuration are critical |
| **Testing** | Transaction-based tests; the repository pattern enables mocking |
| **Error handling** | Classify by PostgreSQL error codes; implement retry logic |
| **Performance** | Avoid N+1, use cursor-based pagination, leverage EXPLAIN ANALYZE |
| **Common cautions** | Avoid N+1, use transactions, properly configure the connection pool |

---

## Recommended Next Reading

- Rust Asynchronous Programming Guide — integration with the tokio runtime
- Axum Web Framework Guide — patterns for connecting with the DB layer
- SQL Performance Tuning — index design and query optimization

---

## References

1. **sqlx official repository** — https://github.com/launchbadge/sqlx
2. **diesel official site** — "Getting Started with Diesel" — https://diesel.rs/guides/getting-started
3. **SeaORM official documentation** — https://www.sea-ql.org/SeaORM/docs/introduction/
4. **The Rust Programming Language** — "Async/Await" — https://doc.rust-lang.org/book/
5. **diesel-async** — https://github.com/weiznich/diesel_async
6. **PostgreSQL official documentation** — "Connection Pooling" — https://www.postgresql.org/docs/current/runtime-config-connection.html
7. **Use The Index, Luke** — A guide to SQL index design — https://use-the-index-luke.com/
