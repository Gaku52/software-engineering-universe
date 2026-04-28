# Rust Best Practices

> Systematically learn practical guidelines for writing high-quality Rust code, including clippy, API design, error handling, and testing strategies. This chapter is designed as a reference for intermediate to advanced Rust developers to consult in real-world work.

## What You'll Learn in This Chapter

1. **Code quality tools** — Automated quality management with clippy, rustfmt, and cargo-audit
2. **API design principles** — Type-driven design, the builder pattern, and zero-cost abstractions
3. **Error handling** — Choosing between thiserror/anyhow and principles of error design
4. **Testing strategies** — Unit tests, integration tests, property-based tests, and mocking
5. **Performance** — Reducing memory allocations, profiling, and parallelization
6. **Project structure** — Workspace management, documentation, and CI/CD integration


## Prerequisites

Your understanding will deepen if you have the following knowledge before reading this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- An understanding of the contents of [Database — sqlx / diesel / SeaORM](./03-database.md)

---

## 1. Static Analysis with clippy

### 1.1 Overview of the Quality Management Toolchain

```
Rust Quality Management Toolchain
==================================

Source code
    |
    v
[rustfmt]     --> Unify code formatting
    |
    v
[clippy]      --> Static analysis (700+ lint rules)
    |
    v
[cargo test]  --> Unit tests + integration tests + doc tests
    |
    v
[cargo audit] --> Vulnerability check on dependencies
    |
    v
[cargo deny]  --> License and duplicate dependency check
    |
    v
[cargo semver-checks] --> Semantic versioning verification
    |
    v
Production build

Roles of each tool:
┌──────────────────┬───────────────────────────────────┐
│ Tool              │ Detection target                  │
├──────────────────┼───────────────────────────────────┤
│ rustfmt          │ Formatting inconsistencies         │
│ clippy           │ Code smells, inefficiencies, bugs  │
│ cargo test       │ Logic errors, regression bugs      │
│ cargo audit      │ Known vulnerabilities (CVEs)       │
│ cargo deny       │ License violations, dup. deps      │
│ cargo semver-checks│ Backward-incompatible API changes│
│ miri             │ Undefined behavior (unsafe code)   │
│ cargo-fuzz       │ Crash detection through fuzzing    │
└──────────────────┴───────────────────────────────────┘
```

### 1.2 clippy Configuration and Key Lints

```toml
# clippy configuration in Cargo.toml
[lints.clippy]
# pedantic level (strict)
pedantic = { level = "warn", priority = -1 }
# Allow individually
module_name_repetitions = "allow"
must_use_candidate = "allow"

# Additional warnings
nursery = { level = "warn", priority = -1 }
unwrap_used = "deny"
expect_used = "warn"
panic = "deny"

# Security-related
# Prevention of SQL injection, etc.
# Detection of inappropriate cryptographic usage
```

```rust
// Typical improvements detected by clippy

// === Unnecessary clones ===
// [NG] Unnecessary clone
let s = String::from("hello");
let t = s.clone();  // clippy: redundant_clone
println!("{}", t);

// [OK]
let s = String::from("hello");
println!("{}", s);

// === Inefficient string concatenation ===
// [NG] Inefficient string concatenation
let mut result = String::new();
for item in items {
    result = result + &item.to_string();  // clippy: string_add
}

// [OK] Efficient concatenation
let result: String = items.iter().map(|i| i.to_string()).collect();

// === map + unwrap ===
// [NG] map + unwrap
let values: Vec<i32> = strings.iter().map(|s| s.parse().unwrap()).collect();

// [OK] filter_map
let values: Vec<i32> = strings.iter().filter_map(|s| s.parse().ok()).collect();

// === Unnecessary if let ===
// [NG]
if let Some(value) = option {
    do_something(value);
} else {
    // do nothing
}

// [OK]
if let Some(value) = option {
    do_something(value);
}

// === Repetition of complex types ===
// [NG] Writing the same type repeatedly
fn process(data: HashMap<String, Vec<(u64, String, bool)>>) -> HashMap<String, Vec<(u64, String, bool)>> {
    data
}

// [OK] Use a type alias
type DataMap = HashMap<String, Vec<(u64, String, bool)>>;
fn process(data: DataMap) -> DataMap {
    data
}

// === Improving match ===
// [NG] Use if let for simple match
match result {
    Ok(value) => do_something(value),
    Err(_) => (),
}

// [OK]
if let Ok(value) = result {
    do_something(value);
}

// === Iterator method chaining ===
// [NG] Manual loop
let mut count = 0;
for item in &items {
    if item.is_active() {
        count += 1;
    }
}

// [OK] Iterator method
let count = items.iter().filter(|i| i.is_active()).count();
```

### 1.3 clippy Lint Levels in Detail

```
Hierarchy of clippy lint levels:

 correctness  --- default: deny
   -> Obvious bugs, possibility of undefined behavior
   -> Examples: approx_constant, infinite_loop, invalid_regex

 suspicious  --- default: warn
   -> Code that is likely to be a bug
   -> Examples: suspicious_arithmetic, suspicious_else_formatting

 style  --- default: warn
   -> Places that could be written more idiomatically
   -> Examples: needless_return, redundant_closure, manual_map

 complexity  --- default: warn
   -> Code that could be simplified
   -> Examples: needless_bool, too_many_arguments

 perf (performance)  --- default: warn
   -> Room for performance improvement
   -> Examples: box_vec, unnecessary_to_owned

 pedantic  --- default: allow
   -> Strict but debatable improvements
   -> Examples: must_use_candidate, missing_errors_doc

 nursery (experimental)  --- default: allow
   -> New lints that are not yet stable
```

### 1.4 rustfmt Configuration

```toml
# rustfmt.toml
edition = "2021"
max_width = 100
tab_spaces = 4
use_field_init_shorthand = true
use_try_shorthand = true
imports_granularity = "Crate"
group_imports = "StdExternalCrate"
reorder_imports = true
# Nightly-only settings (use as needed)
# wrap_comments = true
# format_code_in_doc_comments = true
# normalize_comments = true
```

### 1.5 Supply Chain Security with cargo-deny

```toml
# deny.toml
[licenses]
unlicensed = "deny"
allow = [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Unicode-DFS-2016",
]
copyleft = "deny"  # Forbid GPL family

[bans]
multiple-versions = "warn"  # Multiple versions of the same crate
wildcards = "deny"          # Forbid wildcard dependencies
deny = [
    # Forbid specific crates
    { name = "openssl", wrappers = ["openssl-sys"] },
]

[advisories]
vulnerability = "deny"
unmaintained = "warn"
unsound = "deny"
yanked = "deny"

[sources]
unknown-registry = "deny"
unknown-git = "deny"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
```

---

## 2. API Design Principles

### 2.1 Type-Driven Design

```
The Idea of Type-Driven Design
==============================

Make invalid states unrepresentable in the type system.

[NG] Manage state with strings
  status: String  --> "active", "inactive", "pending", "actve" (typo!)

[OK] Manage state with an enum
  enum Status { Active, Inactive, Pending }
  --> Eliminate invalid states at compile time

[NG] Chained Options
  name: Option<String>, email: Option<String>  --> Only one is None?

[OK] A type per state
  enum User {
      Anonymous,
      Registered { name: String, email: String },
  }

Principles of type-driven design:
  1. Eliminate invalid states at the type level
  2. Express domain concepts with the newtype pattern
  3. Guarantee state exhaustiveness with enums
  4. Realize type-level state transitions with PhantomData
```

### 2.2 Domain Types via the newtype Pattern

```rust
/// newtype pattern: Attach domain meaning to primitive types.
/// Prevents bugs caused by mixing up different ID types.

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(String);

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct OrderId(String);

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ProductId(String);

impl UserId {
    pub fn new(id: impl Into<String>) -> Result<Self, ValidationError> {
        let id = id.into();
        if id.is_empty() {
            return Err(ValidationError::new("UserId", "ID must not be empty"));
        }
        if id.len() > 64 {
            return Err(ValidationError::new("UserId", "ID must be 64 characters or fewer"));
        }
        Ok(Self(id))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// Type safety via newtype
fn get_user_orders(user_id: &UserId, order_repo: &OrderRepo) -> Vec<Order> {
    order_repo.find_by_user(user_id)
}

// Compile error! You cannot pass an OrderId where a UserId is expected.
// let orders = get_user_orders(&order_id, &repo);  // Error!

// Correct usage
let user_id = UserId::new("user-123")?;
let orders = get_user_orders(&user_id, &repo);
```

### 2.3 Builder Pattern (Typestate)

```rust
/// A type-safe builder pattern (Typestate pattern).
/// Forces required fields to be set at compile time.
pub struct RequestBuilder<S: BuilderState> {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
    timeout: Option<std::time::Duration>,
    _state: std::marker::PhantomData<S>,
}

pub struct NoUrl;
pub struct HasUrl;

pub trait BuilderState {}
impl BuilderState for NoUrl {}
impl BuilderState for HasUrl {}

impl RequestBuilder<NoUrl> {
    pub fn new() -> Self {
        RequestBuilder {
            url: String::new(),
            method: "GET".to_string(),
            headers: Vec::new(),
            body: None,
            timeout: None,
            _state: std::marker::PhantomData,
        }
    }

    /// Set the URL (required; build() cannot be called without this).
    pub fn url(self, url: impl Into<String>) -> RequestBuilder<HasUrl> {
        RequestBuilder {
            url: url.into(),
            method: self.method,
            headers: self.headers,
            body: self.body,
            timeout: self.timeout,
            _state: std::marker::PhantomData,
        }
    }
}

impl RequestBuilder<HasUrl> {
    pub fn method(mut self, method: impl Into<String>) -> Self {
        self.method = method.into();
        self
    }

    pub fn header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.push((key.into(), value.into()));
        self
    }

    pub fn body(mut self, body: impl Into<Vec<u8>>) -> Self {
        self.body = Some(body.into());
        self
    }

    pub fn timeout(mut self, timeout: std::time::Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    /// Build: callable only in the HasUrl state.
    pub fn build(self) -> Request {
        Request {
            url: self.url,
            method: self.method,
            headers: self.headers,
            body: self.body,
            timeout: self.timeout.unwrap_or(std::time::Duration::from_secs(30)),
        }
    }
}

// Usage example: build() cannot be called without url()
let req = RequestBuilder::new()
    .url("https://api.example.com")
    .method("POST")
    .header("Content-Type", "application/json")
    .body(b"{\"key\": \"value\"}")
    .timeout(std::time::Duration::from_secs(10))
    .build();

// Compile error! url() was not called.
// let req = RequestBuilder::new().build();
```

### 2.4 A More Complex Typestate Example

```rust
/// Express the connection lifecycle in the type system.
/// Transitions are only allowed in the order Disconnected -> Connected -> Authenticated.

pub struct Connection<S: ConnectionState> {
    inner: TcpStream,
    _state: PhantomData<S>,
}

pub struct Disconnected;
pub struct Connected;
pub struct Authenticated {
    user_id: String,
}

pub trait ConnectionState {}
impl ConnectionState for Disconnected {}
impl ConnectionState for Connected {}
impl ConnectionState for Authenticated {}

impl Connection<Disconnected> {
    pub fn new(addr: &str) -> Result<Connection<Connected>, IoError> {
        let stream = TcpStream::connect(addr)?;
        Ok(Connection {
            inner: stream,
            _state: PhantomData,
        })
    }
}

impl Connection<Connected> {
    pub fn authenticate(
        self,
        username: &str,
        password: &str,
    ) -> Result<Connection<Authenticated>, AuthError> {
        // Authentication logic...
        Ok(Connection {
            inner: self.inner,
            _state: PhantomData,
        })
    }

    pub fn disconnect(self) {
        // Close the connection
        drop(self.inner);
    }
}

impl Connection<Authenticated> {
    /// Queries can only be executed on an authenticated connection.
    pub fn query(&mut self, sql: &str) -> Result<QueryResult, DbError> {
        // Execute query...
        todo!()
    }

    pub fn disconnect(self) {
        drop(self.inner);
    }
}

// Usage example
let conn = Connection::<Disconnected>::new("localhost:5432")?;
let auth_conn = conn.authenticate("user", "pass")?;
let result = auth_conn.query("SELECT * FROM users")?;

// Compile error: cannot query on an unauthenticated connection
// let conn = Connection::<Disconnected>::new("localhost:5432")?;
// conn.query("SELECT 1");  // Error!
```

### 2.5 Designing Function Arguments

```rust
// === Minimize ownership ===

// [NG] Unnecessarily demanding ownership
fn count_words(text: String) -> usize {
    text.split_whitespace().count()
}

// [OK] A reference is enough
fn count_words(text: &str) -> usize {
    text.split_whitespace().count()
}

// === Flexible APIs with impl Into<T> ===

// [NG] Accepts only String
fn greet(name: String) {
    println!("Hello, {}!", name);
}
// greet("world".to_string());  // The caller must call to_string()

// [OK] Accepts both &str and String
fn greet(name: impl Into<String>) {
    let name = name.into();
    println!("Hello, {}!", name);
}
// greet("world");  // OK
// greet(String::from("world"));  // OK

// === Slice vs Vec ===

// [NG] Demands a Vec
fn sum(numbers: Vec<i32>) -> i32 {
    numbers.iter().sum()
}

// [OK] Take a slice (works for Vec, arrays, etc.)
fn sum(numbers: &[i32]) -> i32 {
    numbers.iter().sum()
}

// === Generic reference conversion via AsRef ===
fn read_file(path: impl AsRef<std::path::Path>) -> Result<String, io::Error> {
    std::fs::read_to_string(path)
}
// read_file("config.toml");                       // &str
// read_file(String::from("config.toml"));         // String
// read_file(std::path::PathBuf::from("config.toml")); // PathBuf

// === Lazy cloning with Cow ===
use std::borrow::Cow;

fn normalize_name(name: &str) -> Cow<'_, str> {
    if name.contains(char::is_uppercase) {
        // Allocate a new String only when conversion is needed
        Cow::Owned(name.to_lowercase())
    } else {
        // Return the reference as-is (no allocation)
        Cow::Borrowed(name)
    }
}
```

### 2.6 Designing Return Values

```rust
// === Return iterators (lazy evaluation) ===

// [NG] Returning a Vec (allocates all elements on the heap)
fn even_numbers(data: &[i32]) -> Vec<i32> {
    data.iter().filter(|&&x| x % 2 == 0).copied().collect()
}

// [OK] Return impl Iterator (lazy, no allocation)
fn even_numbers(data: &[i32]) -> impl Iterator<Item = i32> + '_ {
    data.iter().filter(|&&x| x % 2 == 0).copied()
}

// === Option<&T> vs &Option<T> ===

// [OK] Return Option<&T> (the caller decides whether the value exists)
fn find_user(&self, id: &UserId) -> Option<&User> {
    self.users.get(id)
}

// === Add context to Result ===
use anyhow::Context;

fn load_config(path: &str) -> anyhow::Result<Config> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read configuration file: {}", path))?;

    let config: Config = toml::from_str(&content)
        .with_context(|| format!("failed to parse configuration file: {}", path))?;

    config.validate()
        .with_context(|| format!("configuration validation failed: {}", path))?;

    Ok(config)
}
```

---

## 3. Error Handling Strategies

### 3.1 Designing Error Types

```rust
use thiserror::Error;

/// Application-wide error type.
#[derive(Error, Debug)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("authentication error: {0}")]
    Auth(#[from] AuthError),

    #[error("validation error: {field} - {message}")]
    Validation { field: String, message: String },

    #[error("resource not found: {resource_type} (id={id})")]
    NotFound { resource_type: String, id: String },

    #[error("external service error: {service} - {0}", service = .service)]
    ExternalService {
        service: String,
        #[source]
        source: reqwest::Error,
    },

    #[error("rate limit exceeded: please retry after {retry_after_secs} seconds")]
    RateLimited { retry_after_secs: u64 },

    #[error("internal error")]
    Internal(#[source] anyhow::Error),
}

/// Authentication-specific error type.
#[derive(Error, Debug)]
pub enum AuthError {
    #[error("invalid token")]
    InvalidToken,
    #[error("token has expired")]
    TokenExpired,
    #[error("insufficient permissions: {required} is required")]
    InsufficientPermissions { required: String },
    #[error("account is locked")]
    AccountLocked,
}

/// Conversion to HTTP status code.
impl AppError {
    pub fn status_code(&self) -> u16 {
        match self {
            AppError::Database(_) => 500,
            AppError::Auth(AuthError::InvalidToken) => 401,
            AppError::Auth(AuthError::TokenExpired) => 401,
            AppError::Auth(AuthError::InsufficientPermissions { .. }) => 403,
            AppError::Auth(AuthError::AccountLocked) => 423,
            AppError::Validation { .. } => 400,
            AppError::NotFound { .. } => 404,
            AppError::ExternalService { .. } => 502,
            AppError::RateLimited { .. } => 429,
            AppError::Internal(_) => 500,
        }
    }

    /// Determine whether the message is safe to expose to users.
    pub fn is_safe_to_expose(&self) -> bool {
        matches!(
            self,
            AppError::Validation { .. }
            | AppError::NotFound { .. }
            | AppError::Auth(_)
            | AppError::RateLimited { .. }
        )
    }

    /// Generate an error response.
    pub fn to_response(&self) -> ErrorResponse {
        ErrorResponse {
            status: self.status_code(),
            message: if self.is_safe_to_expose() {
                self.to_string()
            } else {
                "an internal error occurred".to_string()
            },
            error_code: self.error_code(),
        }
    }

    fn error_code(&self) -> &'static str {
        match self {
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::Auth(AuthError::InvalidToken) => "INVALID_TOKEN",
            AppError::Auth(AuthError::TokenExpired) => "TOKEN_EXPIRED",
            AppError::Auth(AuthError::InsufficientPermissions { .. }) => "FORBIDDEN",
            AppError::Auth(AuthError::AccountLocked) => "ACCOUNT_LOCKED",
            AppError::Validation { .. } => "VALIDATION_ERROR",
            AppError::NotFound { .. } => "NOT_FOUND",
            AppError::ExternalService { .. } => "EXTERNAL_SERVICE_ERROR",
            AppError::RateLimited { .. } => "RATE_LIMITED",
            AppError::Internal(_) => "INTERNAL_ERROR",
        }
    }
}

/// Result type alias.
pub type AppResult<T> = Result<T, AppError>;
```

### 3.2 Choosing Between thiserror and anyhow

```
┌──────────────┬───────────────────────┬───────────────────────┐
│              │ thiserror             │ anyhow                │
├──────────────┼───────────────────────┼───────────────────────┤
│ Use case     │ Libraries              │ Applications          │
│ Error type   │ Custom enum            │ anyhow::Error (dynamic)│
│ Pattern match│ Possible              │ Requires downcast     │
│ Context      │ Added manually         │ Easy via .context()   │
│ Dependencies │ Few                    │ Just anyhow           │
│ Error chains │ #[from], #[source]    │ Automatic             │
│ Display      │ Defined via #[error("...")] │ Auto-implemented Display │
└──────────────┴───────────────────────┴───────────────────────┘

Guidelines for choosing:
  - Public library API           -> thiserror
  - Internal application logic   -> anyhow
  - main() of a CLI tool         -> anyhow::Result<()>
  - Web server handlers          -> thiserror (for status code conversion)
```

```rust
// === Example of using thiserror in a library ===
// my_library/src/lib.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ParseError {
    #[error("invalid syntax (line {line}, column {column}): {message}")]
    Syntax {
        line: usize,
        column: usize,
        message: String,
    },
    #[error("unknown token: {0}")]
    UnknownToken(String),
    #[error("IO error")]
    Io(#[from] std::io::Error),
}

// The caller can pattern-match on the error
pub fn parse(input: &str) -> Result<Ast, ParseError> {
    // ...
    Err(ParseError::Syntax {
        line: 10,
        column: 5,
        message: "unexpected ')'".to_string(),
    })
}


// === Example of using anyhow in an application ===
// my_app/src/main.rs
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let config = load_config("config.toml")
        .context("failed to load application configuration")?;

    let db = connect_database(&config.database_url)
        .context("failed to connect to the database")?;

    let server = start_server(&config, db)
        .context("failed to start the server")?;

    server.run().context("error while running the server")
}

// Example error chain output:
// Error: failed to start the server
//
// Caused by:
//     0: failed to connect to the database
//     1: Connection refused (os error 111)
```

### 3.3 Error Handling Patterns

```rust
// === Pattern 1: Propagation with the ? operator ===
fn process_user(id: &UserId) -> AppResult<UserResponse> {
    let user = user_repo.find(id)
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound {
            resource_type: "User".to_string(),
            id: id.to_string(),
        })?;

    let profile = profile_service.get(&user.profile_id)
        .map_err(AppError::Database)?;

    Ok(UserResponse::from(user, profile))
}

// === Pattern 2: Error transformation and aggregation ===
fn validate_user_input(input: &CreateUserInput) -> AppResult<()> {
    let mut errors = Vec::new();

    if input.name.is_empty() {
        errors.push(("name", "name is required"));
    }
    if input.name.len() > 100 {
        errors.push(("name", "name must be 100 characters or fewer"));
    }
    if !input.email.contains('@') {
        errors.push(("email", "please enter a valid email address"));
    }

    if let Some((field, message)) = errors.first() {
        return Err(AppError::Validation {
            field: field.to_string(),
            message: message.to_string(),
        });
    }

    Ok(())
}

// === Pattern 3: Error handling with retries ===
async fn with_retry<F, Fut, T, E>(
    f: F,
    max_retries: u32,
    initial_delay: Duration,
) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut delay = initial_delay;
    let mut last_error = None;

    for attempt in 0..=max_retries {
        match f().await {
            Ok(value) => return Ok(value),
            Err(e) => {
                tracing::warn!(
                    attempt = attempt + 1,
                    max_retries,
                    error = %e,
                    "retrying..."
                );
                last_error = Some(e);
                if attempt < max_retries {
                    tokio::time::sleep(delay).await;
                    delay *= 2; // exponential backoff
                }
            }
        }
    }

    Err(last_error.unwrap())
}

// === Pattern 4: Custom error context ===
trait ResultExt<T> {
    fn with_not_found(self, resource_type: &str, id: &str) -> AppResult<T>;
}

impl<T> ResultExt<T> for Option<T> {
    fn with_not_found(self, resource_type: &str, id: &str) -> AppResult<T> {
        self.ok_or_else(|| AppError::NotFound {
            resource_type: resource_type.to_string(),
            id: id.to_string(),
        })
    }
}

// Usage example
let user = user_repo.find(&user_id)?
    .with_not_found("User", user_id.as_str())?;
```

---

## 4. Testing Strategies

### 4.1 Test Composition and Types

```
The Test Pyramid:

          /\
         /  \       E2E tests (few, slow, expensive)
        /    \
       /------\
      / Integ. \    Integration tests (medium)
     / tests    \
    /------------\
   /  Unit tests  \  Unit tests (many, fast, cheap)
  /________________\

Test layout in Rust:
  src/
  ├── lib.rs          # #[cfg(test)] mod tests { ... }  <- unit tests
  ├── module_a.rs     # #[cfg(test)] mod tests { ... }  <- unit tests
  └── module_b.rs     # #[cfg(test)] mod tests { ... }  <- unit tests
  tests/
  ├── integration_a.rs  <- integration tests (compiled as a separate crate)
  └── integration_b.rs  <- integration tests
  benches/
  └── benchmark.rs      <- benchmarks (criterion)
```

### 4.2 Unit Test Patterns

```rust
// src/domain/price.rs
pub fn calculate_price(base: f64, tax_rate: f64, discount: Option<f64>) -> f64 {
    let discounted = match discount {
        Some(d) if (0.0..=1.0).contains(&d) => base * (1.0 - d),
        _ => base,
    };
    discounted * (1.0 + tax_rate)
}

#[cfg(test)]
mod tests {
    use super::*;

    // === Basic tests ===
    #[test]
    fn test_price_without_discount() {
        let result = calculate_price(100.0, 0.1, None);
        assert!((result - 110.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_price_with_discount() {
        let result = calculate_price(100.0, 0.1, Some(0.2));
        assert!((result - 88.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_invalid_discount_ignored() {
        let result = calculate_price(100.0, 0.1, Some(1.5));
        assert!((result - 110.0).abs() < f64::EPSILON);
    }

    // === Table-driven tests ===
    #[test]
    fn test_price_calculation_table() {
        let cases = vec![
            // (base, tax_rate, discount, expected, description)
            (100.0, 0.10, None,       110.0, "no discount, 10% tax"),
            (100.0, 0.10, Some(0.2),  88.0,  "20% discount, 10% tax"),
            (100.0, 0.08, Some(0.5),  54.0,  "50% discount, 8% tax"),
            (0.0,   0.10, None,       0.0,   "free item"),
            (100.0, 0.0,  Some(0.0),  100.0, "0% discount, 0% tax"),
        ];

        for (base, tax, discount, expected, desc) in cases {
            let result = calculate_price(base, tax, discount);
            assert!(
                (result - expected).abs() < 0.001,
                "Failed for case '{}': expected {}, got {}",
                desc, expected, result
            );
        }
    }

    // === Property-based tests ===
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn price_is_always_non_negative(
            base in 0.0f64..10000.0,
            tax in 0.0f64..0.5,
            discount in proptest::option::of(0.0f64..1.0),
        ) {
            let result = calculate_price(base, tax, discount);
            prop_assert!(result >= 0.0, "Price must be non-negative: {}", result);
        }

        #[test]
        fn discount_reduces_price(
            base in 1.0f64..10000.0,
            tax in 0.0f64..0.5,
            discount in 0.01f64..1.0,
        ) {
            let without = calculate_price(base, tax, None);
            let with = calculate_price(base, tax, Some(discount));
            prop_assert!(with <= without, "Discount should reduce price");
        }
    }
}
```

### 4.3 Mocks and Test Doubles

```rust
// === Trait-based mocking ===

// Production code
#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find(&self, id: &UserId) -> Result<Option<User>, DbError>;
    async fn save(&self, user: &User) -> Result<(), DbError>;
    async fn delete(&self, id: &UserId) -> Result<(), DbError>;
}

pub struct UserService<R: UserRepository> {
    repo: R,
}

impl<R: UserRepository> UserService<R> {
    pub fn new(repo: R) -> Self {
        Self { repo }
    }

    pub async fn get_user(&self, id: &UserId) -> AppResult<User> {
        self.repo
            .find(id)
            .await
            .map_err(AppError::Database)?
            .ok_or_else(|| AppError::NotFound {
                resource_type: "User".to_string(),
                id: id.to_string(),
            })
    }
}

// Mock for testing
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    struct MockUserRepository {
        users: Mutex<HashMap<String, User>>,
        save_called: Mutex<Vec<User>>,
    }

    impl MockUserRepository {
        fn new() -> Self {
            Self {
                users: Mutex::new(HashMap::new()),
                save_called: Mutex::new(Vec::new()),
            }
        }

        fn with_user(self, user: User) -> Self {
            self.users.lock().unwrap().insert(user.id.to_string(), user);
            self
        }

        fn saved_users(&self) -> Vec<User> {
            self.save_called.lock().unwrap().clone()
        }
    }

    #[async_trait]
    impl UserRepository for MockUserRepository {
        async fn find(&self, id: &UserId) -> Result<Option<User>, DbError> {
            Ok(self.users.lock().unwrap().get(id.as_str()).cloned())
        }

        async fn save(&self, user: &User) -> Result<(), DbError> {
            self.save_called.lock().unwrap().push(user.clone());
            self.users.lock().unwrap()
                .insert(user.id.to_string(), user.clone());
            Ok(())
        }

        async fn delete(&self, id: &UserId) -> Result<(), DbError> {
            self.users.lock().unwrap().remove(id.as_str());
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_get_user_found() {
        let user = User {
            id: UserId::new("user-1").unwrap(),
            name: "Test User".to_string(),
        };
        let repo = MockUserRepository::new().with_user(user.clone());
        let service = UserService::new(repo);

        let result = service.get_user(&UserId::new("user-1").unwrap()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().name, "Test User");
    }

    #[tokio::test]
    async fn test_get_user_not_found() {
        let repo = MockUserRepository::new();
        let service = UserService::new(repo);

        let result = service.get_user(&UserId::new("nonexistent").unwrap()).await;
        assert!(matches!(result, Err(AppError::NotFound { .. })));
    }
}
```

### 4.4 Integration Tests and Test Helpers

```rust
// tests/common/mod.rs - test helpers
pub struct TestApp {
    pub db: PgPool,
    pub addr: String,
    pub client: reqwest::Client,
}

impl TestApp {
    pub async fn spawn() -> Self {
        let db = setup_test_database().await;
        let app = build_app(db.clone()).await;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = format!("http://{}", listener.local_addr().unwrap());

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        Self {
            db,
            addr,
            client: reqwest::Client::new(),
        }
    }

    pub async fn create_test_user(&self, name: &str) -> User {
        sqlx::query_as!(
            User,
            "INSERT INTO users (name) VALUES ($1) RETURNING *",
            name
        )
        .fetch_one(&self.db)
        .await
        .unwrap()
    }

    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.addr, path)
    }
}

impl Drop for TestApp {
    fn drop(&mut self) {
        // Clean up the test database
    }
}

// tests/api/users.rs
use crate::common::TestApp;

#[tokio::test]
async fn test_create_user_success() {
    let app = TestApp::spawn().await;

    let response = app.client
        .post(app.url("/api/users"))
        .json(&serde_json::json!({
            "name": "Test User",
            "email": "test@example.com"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 201);

    let user: UserResponse = response.json().await.unwrap();
    assert_eq!(user.name, "Test User");
}

#[tokio::test]
async fn test_create_user_validation_error() {
    let app = TestApp::spawn().await;

    let response = app.client
        .post(app.url("/api/users"))
        .json(&serde_json::json!({
            "name": "",
            "email": "invalid-email"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 400);
}
```

### 4.5 Documentation Tests

```rust
/// Adds two numbers.
///
/// # Examples
///
/// ```
/// use my_crate::add;
///
/// assert_eq!(add(2, 3), 5);
/// assert_eq!(add(-1, 1), 0);
/// ```
///
/// # Panics
///
/// Panics on overflow (debug builds only).
///
/// ```should_panic
/// use my_crate::add;
/// let _ = add(i32::MAX, 1);  // panics in debug builds
/// ```
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

/// Reads and parses a file.
///
/// # Errors
///
/// - When the file cannot be found
/// - When parsing fails
///
/// # Examples
///
/// ```no_run
/// use my_crate::parse_config;
///
/// let config = parse_config("config.toml")?;
/// println!("{:?}", config);
/// # Ok::<(), anyhow::Error>(())
/// ```
pub fn parse_config(path: &str) -> anyhow::Result<Config> {
    // ...
    todo!()
}
```

### 4.6 CI/CD Configuration (GitHub Actions)

```yaml
# .github/workflows/rust.yml
name: Rust CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  CARGO_TERM_COLOR: always
  RUSTFLAGS: -Dwarnings

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - uses: Swatinem/rust-cache@v2

      - name: Format check
        run: cargo fmt --all -- --check

      - name: Clippy
        run: cargo clippy --all-targets --all-features -- -D warnings

      - name: Test
        run: cargo test --all-features

      - name: Doc test
        run: cargo doc --no-deps --all-features

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable

      - name: Security audit
        run: |
          cargo install cargo-audit
          cargo audit

      - name: License check
        run: |
          cargo install cargo-deny
          cargo deny check

  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable

      - name: Install tarpaulin
        run: cargo install cargo-tarpaulin

      - name: Code coverage
        run: cargo tarpaulin --all-features --workspace --out xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  # MSRV (Minimum Supported Rust Version) check
  msrv:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@1.75.0  # MSRV
      - run: cargo check --all-features
```

---

## 5. Performance Best Practices

### 5.1 Comparison Table for Avoiding Allocations

| Pattern | Heap allocation | Recommendation | Description |
|---|---|---|---|
| `String` as argument | Every call | Low | Caller must clone |
| `&str` as argument | None | High | When borrowing is enough |
| `impl Into<String>` | Only when needed | High | Flexible API |
| `Cow<'_, str>` | Only when needed | Medium | Dynamic switch between owned/borrowed |
| Returning `Vec<T>` | Every call | Medium | Returning an iterator may be better |
| Returning `impl Iterator` | None | High | Lazy evaluation |
| `Box<dyn Trait>` | Every call | Low | Dynamic dispatch + heap allocation |
| `impl Trait` | None | High | Static dispatch, can be inlined |
| `Arc<T>` | Initial only | Medium | Reference counting (shared ownership) |

### 5.2 Concrete Optimization Patterns

```rust
// === 1. Reducing String allocations ===

// [NG] Allocates a new String each time
fn format_name(first: &str, last: &str) -> String {
    let mut result = String::new();
    result.push_str(first);
    result.push(' ');
    result.push_str(last);
    result  // Possibly 3 reallocations
}

// [OK] Reserve capacity in advance
fn format_name(first: &str, last: &str) -> String {
    let mut result = String::with_capacity(first.len() + 1 + last.len());
    result.push_str(first);
    result.push(' ');
    result.push_str(last);
    result  // No reallocation
}

// [Best] format! macro
fn format_name(first: &str, last: &str) -> String {
    format!("{} {}", first, last)
}


// === 2. Pre-allocating a Vec ===

// [NG] Reallocates each time
fn collect_even(data: &[i32]) -> Vec<i32> {
    let mut result = Vec::new();
    for &n in data {
        if n % 2 == 0 {
            result.push(n);  // Reallocates when capacity is exceeded
        }
    }
    result
}

// [OK] Reserve capacity in advance
fn collect_even(data: &[i32]) -> Vec<i32> {
    let mut result = Vec::with_capacity(data.len() / 2);
    for &n in data {
        if n % 2 == 0 {
            result.push(n);
        }
    }
    result
}

// [Best] Use iterators
fn collect_even(data: &[i32]) -> Vec<i32> {
    data.iter().copied().filter(|n| n % 2 == 0).collect()
}


// === 3. Removing unnecessary clones ===

// [NG] Unnecessary clone
struct Config {
    name: String,
    values: Vec<String>,
}

impl Config {
    // The clone of `name` is unnecessary
    fn get_name(&self) -> String {
        self.name.clone()  // Heap allocates every call
    }
}

// [OK] Return a reference
impl Config {
    fn name(&self) -> &str {
        &self.name
    }
}


// === 4. Optimizing small arrays with SmallVec ===
use smallvec::SmallVec;

// Avoid heap allocation when there are few elements
fn parse_tags(input: &str) -> SmallVec<[&str; 4]> {
    // Up to 4 elements are stored on the stack
    // Automatically switches to heap when exceeding 5
    input.split(',').map(str::trim).collect()
}


// === 5. String interning / arena allocator ===
use bumpalo::Bump;

fn process_many_strings(inputs: &[String]) {
    let arena = Bump::new();

    // Allocate in the arena: freed all at once, no individual dealloc needed
    let processed: Vec<&str> = inputs
        .iter()
        .map(|s| {
            let allocated = arena.alloc_str(&s.to_uppercase());
            &*allocated
        })
        .collect();

    // Use processed...

    // When the arena is dropped, everything is freed at once
}
```

### 5.3 Profiling Tools

```
Performance measurement tools:

┌──────────────────┬──────────────────────────────────────┐
│ Tool             │ Purpose                              │
├──────────────────┼──────────────────────────────────────┤
│ criterion        │ Microbenchmarks (statistically reliable) │
│ flamegraph       │ CPU profile visualization             │
│ perf (Linux)     │ CPU sampling profiler                 │
│ Instruments (Mac)│ Profiler for macOS                    │
│ heaptrack        │ Heap allocation profiling             │
│ dhat             │ Heap allocation analysis (Valgrind)   │
│ cachegrind       │ Cache hit-rate analysis              │
│ tokio-console    │ Debugging/monitoring async tasks      │
└──────────────────┴──────────────────────────────────────┘
```

```rust
// Benchmarking with criterion
// benches/benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};

fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        n => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn fibonacci_iterative(n: u64) -> u64 {
    if n <= 1 { return n; }
    let (mut a, mut b) = (0u64, 1u64);
    for _ in 2..=n {
        let temp = a + b;
        a = b;
        b = temp;
    }
    b
}

fn bench_fibonacci(c: &mut Criterion) {
    let mut group = c.benchmark_group("fibonacci");

    for size in [10, 20, 30].iter() {
        group.bench_with_input(
            BenchmarkId::new("recursive", size),
            size,
            |b, &n| b.iter(|| fibonacci(black_box(n))),
        );
        group.bench_with_input(
            BenchmarkId::new("iterative", size),
            size,
            |b, &n| b.iter(|| fibonacci_iterative(black_box(n))),
        );
    }

    group.finish();
}

criterion_group!(benches, bench_fibonacci);
criterion_main!(benches);
```

### 5.4 Parallelization (rayon)

```rust
use rayon::prelude::*;

// === Parallelizing CPU-bound work ===

// Sequential
fn process_images_sequential(images: &[Image]) -> Vec<ProcessedImage> {
    images.iter().map(|img| process_image(img)).collect()
}

// Parallel (rayon)
fn process_images_parallel(images: &[Image]) -> Vec<ProcessedImage> {
    images.par_iter().map(|img| process_image(img)).collect()
}

// Parallel sort
fn sort_large_data(data: &mut [f64]) {
    data.par_sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());
}

// Parallel reduce
fn parallel_sum(data: &[f64]) -> f64 {
    data.par_iter().sum()
}

// Custom parallelism
fn with_custom_thread_pool() {
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(4)
        .build()
        .unwrap();

    pool.install(|| {
        // par_iter inside this block runs on 4 threads
        let result: Vec<_> = (0..1000)
            .into_par_iter()
            .map(|i| expensive_computation(i))
            .collect();
    });
}
```

---

## 6. Project Structure

### 6.1 Workspace Layout

```
Recommended project layout:

my-project/
├── Cargo.toml          # workspace root
├── deny.toml           # cargo-deny config
├── rustfmt.toml        # formatting config
├── .github/
│   └── workflows/
│       └── ci.yml
├── crates/
│   ├── my-app/         # binary crate
│   │   ├── Cargo.toml
│   │   └── src/
│   │       └── main.rs
│   ├── my-core/        # core logic (domain)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── domain/
│   │       ├── service/
│   │       └── error.rs
│   ├── my-api/         # web API layer
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── routes/
│   │       ├── middleware/
│   │       └── extractors/
│   ├── my-db/          # database layer
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── models/
│   │       ├── repositories/
│   │       └── migrations/
│   └── my-shared/      # shared types and utilities
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           └── types.rs
└── tests/              # workspace-level integration tests
    └── e2e/
```

```toml
# Root Cargo.toml
[workspace]
resolver = "2"
members = [
    "crates/my-app",
    "crates/my-core",
    "crates/my-api",
    "crates/my-db",
    "crates/my-shared",
]

[workspace.package]
version = "0.1.0"
edition = "2021"
authors = ["Your Name <you@example.com>"]
rust-version = "1.75"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
thiserror = "2"
anyhow = "1"
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres"] }

[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
unwrap_used = "deny"
```

### 6.2 Direction of Dependencies

```
Dependencies between crates:

  ┌──────────┐
  │  my-app  │ (binary: main.rs)
  └──────────┘
    │  │  │
    │  │  └─────────────────────┐
    │  └───────────┐            │
    ▼              ▼            ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  my-api  │  │  my-db   │  │  my-core │
  └──────────┘  └──────────┘  └──────────┘
    │              │            │
    │              │            │
    ▼              ▼            ▼
  ┌──────────────────────────────────────┐
  │            my-shared                  │
  └──────────────────────────────────────┘

  Rules:
  - Dependencies may only flow in the direction of the arrows
  - my-shared depends on no other crate
  - my-core does not depend on my-db (abstract via traits)
  - Circular dependencies are forbidden
```

### 6.3 Leveraging Feature Flags

```toml
# crates/my-core/Cargo.toml
[features]
default = []
# Expose helpers for testing
test-helpers = []
# Expose internal functions for benchmarking
bench = []
# Additional functionality
advanced-analytics = ["dep:stats"]
```

```rust
// Conditional compilation via feature flags
#[cfg(feature = "test-helpers")]
pub mod test_helpers {
    use super::*;

    pub fn create_test_user() -> User {
        User {
            id: UserId::new("test-user").unwrap(),
            name: "Test User".to_string(),
            email: Email::new("test@example.com").unwrap(),
        }
    }
}
```

---

## 7. Anti-patterns

### 7.1 Excessive unwrap/expect

**Problem**: `unwrap()` causes a panic and stops the process in a server application.

```rust
// [NG] Successive unwraps
let config = std::fs::read_to_string("config.toml").unwrap();
let port: u16 = env::var("PORT").unwrap().parse().unwrap();

// [OK] Proper error handling
let config = std::fs::read_to_string("config.toml")
    .context("Failed to read config.toml")?;
let port: u16 = env::var("PORT")
    .unwrap_or_else(|_| "8080".to_string())
    .parse()
    .context("Invalid PORT value")?;

// Cases where unwrap() is acceptable:
// 1. Test code
#[test]
fn test_something() {
    let result = my_function().unwrap();  // OK in tests
}

// 2. When it can be proven that it cannot logically fail (a comment is required)
let regex = Regex::new(r"^\d+$").unwrap();  // A constant pattern cannot fail

// 3. Prototype/experimental code (remove before production)
```

### 7.2 Overuse of Unnecessary Clone

**Problem**: Working around ownership issues with Clone increases memory allocations and degrades performance.

```rust
// [NG] Unnecessary clone
fn process(items: &[String]) {
    for item in items {
        let owned = item.clone();  // Heap allocates every iteration
        do_something(owned);
    }
}

// [OK] Borrowing is enough
fn process(items: &[String]) {
    for item in items {
        do_something_ref(item);  // Take &str
    }
}

// [NG] Unnecessary cloning of an Arc
fn process_shared(data: Arc<Vec<String>>) {
    let cloned = data.clone();  // Cloning an Arc is cheap...
    let cloned2 = data.clone(); // ...but avoid it when unnecessary

    // No need to clone the same Arc multiple times in a single function
    use_data(&data);
    use_data_again(&data);
}

// [OK]
fn process_shared(data: &Arc<Vec<String>>) {
    use_data(data);
    use_data_again(data);
}
```

### 7.3 Excessive Abstraction

```rust
// [NG] Unnecessary trait/generics
trait Addable<T> {
    fn add(&self, other: &T) -> T;
}

impl Addable<i32> for i32 {
    fn add(&self, other: &i32) -> i32 {
        self + other
    }
}

// [OK] A simple function suffices
fn add(a: i32, b: i32) -> i32 {
    a + b
}

// Cases where abstraction is justified:
// - When multiple implementations actually exist
// - When mocking is required for tests
// - When future extension is reliably foreseen
```

### 7.4 Inappropriate Use of unsafe

```rust
// [NG] Using unsafe when a safe alternative exists
unsafe fn get_element(slice: &[i32], index: usize) -> i32 {
    *slice.get_unchecked(index)  // Skips bounds checking
}

// [OK] The safe approach
fn get_element(slice: &[i32], index: usize) -> Option<i32> {
    slice.get(index).copied()
}

// Cases where unsafe is justified:
// - FFI (Foreign Function Interface)
// - Performance-critical hot paths (verified by profiling)
// - Low-level memory operations (custom allocators, etc.)
// * Always include a Safety comment

/// # Safety
///
/// `ptr` must be a valid pointer to `T`, and at least `len`
/// consecutive `T` values must be readable.
unsafe fn read_buffer<T>(ptr: *const T, len: usize) -> Vec<T>
where
    T: Copy,
{
    let slice = std::slice::from_raw_parts(ptr, len);
    slice.to_vec()
}
```

---

## 8. Documentation Best Practices

### 8.1 Conventions for Doc Comments

```rust
/// Domain model representing a user account.
///
/// A user cannot perform operations until they have been
/// activated after creation.
///
/// # Examples
///
/// ```
/// use my_crate::User;
///
/// let user = User::new("alice", "alice@example.com")?;
/// assert_eq!(user.name(), "alice");
/// assert!(!user.is_active());
/// # Ok::<(), my_crate::Error>(())
/// ```
///
/// # Errors
///
/// - When the name is an empty string
/// - When the email address has an invalid format
pub struct User {
    // ...
}

/// Creates a user.
///
/// New users are created in an inactive state.
/// You must call [`User::activate`] to activate them.
///
/// # Arguments
///
/// * `name` - User name (1 to 100 characters)
/// * `email` - Email address (RFC 5322 compliant)
///
/// # Errors
///
/// * [`ValidationError::EmptyName`] - When the name is empty
/// * [`ValidationError::InvalidEmail`] - When the email is invalid
///
/// # Examples
///
/// ```
/// let user = User::new("alice", "alice@example.com")?;
/// # Ok::<(), my_crate::Error>(())
/// ```
pub fn new(name: &str, email: &str) -> Result<Self, ValidationError> {
    // ...
    todo!()
}
```

---

## API Design Principles Comparison Table

| Principle | Good example | Bad example |
|---|---|---|
| **Express invariants in types** | `NonZeroU32` | `u32` (forgetting the zero check) |
| **Minimize ownership** | `fn process(data: &[u8])` | `fn process(data: Vec<u8>)` |
| **Exhaustiveness via enums** | All `match` patterns | Chains of `if/else` |
| **Newtype for meaning** | `struct UserId(u64)` | `u64` (ID for what?) |
| **Builder for complex construction** | `Config::builder().port(8080).build()` | `Config::new(8080, ...)` with many args |
| **Conversion via From/Into** | `impl From<String> for Name` | Manual conversion functions |
| **Return iterators** | `fn items(&self) -> impl Iterator` | `fn items(&self) -> Vec<T>` |
| **Separate error types** | Library vs. application | All returned as `String` |

---

## FAQ

### Q1: Should I fix every clippy warning?

**A**: Lints at the `warn` level should generally be fixed. However, some `pedantic` lints are overly strict, so you can selectively allow them with `#[allow]` to fit your project. Lints set to `deny` should always be checked in CI. Record the configuration agreed upon by your team in the `[lints]` section of `Cargo.toml` so everyone uses the same rules.

### Q2: How should I choose between anyhow and thiserror?

**A**:
- **thiserror**: Use in libraries. The caller can pattern-match on the error type.
- **anyhow**: Use in applications. When contextual information is more important than the error variant.
It is common to define types with `thiserror` in libraries and unify on `anyhow::Result` in `main` or CLIs of applications. For web server handlers, `thiserror` is suitable because it allows status code conversion.

### Q3: How should I approach performance tuning in Rust?

**A**: Proceed in the following order:
1. **Benchmark** with `criterion` to measure the current state
2. **Profile** with `perf`/`flamegraph` to identify hotspots
3. **Algorithmic improvement** is the highest priority (e.g., O(n^2) -> O(n log n))
4. **Reduce allocations** — eliminate Clones, `String` -> `&str`, `Vec` -> slices
5. **Parallelize** — data parallelism with rayon
6. **unsafe** — last resort. Always verify the gain via benchmarks.
Avoid optimization without measurement.

### Q4: How should I design feature flags?

**A**: Follow these principles:
- Keep the `default` feature minimal (design for opt-in by users)
- Gate heavy dependencies behind feature flags
- Expose test helpers under a `test-helpers` feature
- Make `serde` support opt-in via a `serde` feature

### Q5: How should I manage unsafe code?

**A**:
- Use it within minimal scope (keep unsafe blocks small)
- Always write a `# Safety` doc comment
- When possible, provide a safe abstraction as a wrapper
- Detect undefined behavior with Miri (`cargo +nightly miri test`)
- Set the `unsafe_code` lint to `deny` and explicitly allow it where required

---

## Summary

| Item | Key point |
|---|---|
| clippy | Prevents common mistakes with 700+ lints. Required in CI. |
| rustfmt | Unifies code formatting. Essential for team development. |
| cargo-deny | Supply chain security. License management. |
| API design | Express invariants in types. Minimize ownership. |
| Error handling | Use thiserror for libraries, anyhow for applications. |
| Testing | Unit + integration + property-based + doc tests. |
| Performance | Measurement first. Eliminate unnecessary Clone and allocations. |
| Project structure | Split into a workspace. Keep dependencies one-directional. |
| Documentation | Always write Examples, Errors, and Safety sections. |

---

## Exercises

### Exercise 1: Type-Driven Design

Redesign the following struct so that invalid states are unrepresentable.

```rust
struct User {
    name: String,           // Empty string allowed?
    email: String,          // Invalid format allowed?
    age: i32,               // Negative values allowed?
    role: String,           // Anything other than "admin", "user", "guest"?
    verified: bool,
    verification_code: Option<String>, // verified=true but code is present?
}
```

### Exercise 2: Designing Error Types

Define the errors that may occur in order processing on an e-commerce site using thiserror. Include at least five error variants, and also implement a method that converts to HTTP status codes.

### Exercise 3: Testing Strategy

For the following function, write (1) a regular unit test, (2) a table-driven test, and (3) a property-based test.

```rust
pub fn parse_csv_line(line: &str) -> Vec<String> {
    // Split fields by comma
    // Ignore commas inside fields surrounded by double quotes
    // "" inside double quotes is an escaped "
    todo!()
}
```

### Exercise 4: Performance Improvement

Improve the performance of the following code. Write criterion benchmarks before and after the change to measure the effect.

```rust
fn count_word_frequencies(text: &str) -> HashMap<String, usize> {
    let mut freq = HashMap::new();
    for word in text.split_whitespace() {
        let word = word.to_lowercase();
        let count = freq.entry(word.clone()).or_insert(0);
        *count += 1;
    }
    freq
}
```

### Exercise 5: Workspace Design

Design the workspace layout for a blog system (CRUD for articles, user authentication, comments). Diagram the responsibilities and dependencies of each crate, and write the Cargo.toml.

---

## Recommended Next Reading

- [FFI](../03-systems/02-ffi-interop.md) — Best practices for cross-language integration
- Asynchronous programming — Design patterns for async Rust

## References

1. **Rust API Guidelines**: [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/) — Official API design guidelines
2. **clippy Lints**: [Clippy Lint List](https://rust-lang.github.io/rust-clippy/master/) — A list and explanation of all lints
3. **Rust Design Patterns**: [Rust Design Patterns](https://rust-unofficial.github.io/patterns/) — A collection of Rust-specific design patterns
4. **Rust Performance Book**: [The Rust Performance Book](https://nnethercote.github.io/perf-book/) — Performance tuning
5. **Error Handling in Rust**: [Error Handling Survey](https://blog.burntsushi.net/rust-error-handling/) — A comprehensive guide to error handling
6. **Cargo Book**: [The Cargo Book](https://doc.rust-lang.org/cargo/) — The official Cargo documentation
