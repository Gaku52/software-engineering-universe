# Testing — proptest, criterion

> Comprehensively master Rust's testing ecosystem, covering unit tests, integration tests, property-based testing, and benchmarks

## What You Will Learn in This Chapter

1. **Standard Testing** — #[test], #[cfg(test)], assert macros, test organization
2. **Property-Based Testing** — Property-based tests with proptest / quickcheck
3. **Benchmarking** — Statistical performance measurement with criterion
4. **Test Design Patterns** — Mocks, stubs, fixtures, testable architecture
5. **Test Automation** — Coverage measurement, CI integration, mutation testing


## Prerequisites

Reading this guide will be more meaningful if you have the following knowledge:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the contents of [Cargo/Workspaces — features, publish](./00-cargo-workspace.md)

---

## 1. Overview of the Testing System

```
┌──────────── Rust Testing System ─────────────────────┐
│                                                      │
│  ┌─ Unit Test ─────────────────────────────────────┐ │
│  │  Defined in src/ with #[cfg(test)] mod tests   │ │
│  │  Private functions can also be tested           │ │
│  │  $ cargo test --lib                             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Integration Test ──────────────────────────────┐ │
│  │  Placed in the tests/ directory                 │ │
│  │  Tests only the public API (treated as external)│ │
│  │  $ cargo test --test test_name                  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Documentation Test (Doc Test) ─────────────────┐ │
│  │  Code blocks inside /// comments                │ │
│  │  Maintains documentation and tests together     │ │
│  │  $ cargo test --doc                             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Property-Based Test ───────────────────────────┐ │
│  │  proptest / quickcheck                          │ │
│  │  Verifies properties with random inputs         │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Benchmark ─────────────────────────────────────┐ │
│  │  criterion / divan                              │ │
│  │  Statistical performance measurement            │ │
│  │  $ cargo bench                                  │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 1.1 File Layout Conventions for Tests

```
my-project/
├── src/
│   ├── lib.rs              # Library root + unit tests
│   ├── parser.rs           # #[cfg(test)] mod tests in each module
│   ├── validator.rs
│   └── utils/
│       └── mod.rs
├── tests/                   # Integration tests
│   ├── common/
│   │   └── mod.rs          # Shared test helpers (not run as tests)
│   ├── api_test.rs         # Each file is an independent test crate
│   ├── parser_test.rs
│   └── e2e/
│       └── main.rs         # Subdirectories are treated as binary crates
├── benches/
│   ├── parser_bench.rs     # criterion benchmarks
│   └── sorting_bench.rs
└── examples/
    └── basic.rs            # Can be tested with cargo test --examples
```

---

## 2. Standard Tests

### Code Example 1: Basic Unit Test Patterns

```rust
// src/lib.rs
pub struct Calculator;

impl Calculator {
    pub fn add(a: i64, b: i64) -> i64 {
        a + b
    }

    pub fn divide(a: f64, b: f64) -> Result<f64, &'static str> {
        if b == 0.0 {
            Err("division by zero error")
        } else {
            Ok(a / b)
        }
    }

    /// Internal helper (private)
    fn clamp(value: i64, min: i64, max: i64) -> i64 {
        value.max(min).min(max)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_basic() {
        assert_eq!(Calculator::add(2, 3), 5);
    }

    #[test]
    fn test_add_negative() {
        assert_eq!(Calculator::add(-1, 1), 0);
        assert_eq!(Calculator::add(-5, -3), -8);
    }

    #[test]
    fn test_divide_success() {
        let result = Calculator::divide(10.0, 3.0).unwrap();
        assert!((result - 3.333).abs() < 0.001, "result differs from expected: {}", result);
    }

    #[test]
    fn test_divide_by_zero() {
        let result = Calculator::divide(1.0, 0.0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "division by zero error");
    }

    // Private functions can also be tested
    #[test]
    fn test_clamp() {
        assert_eq!(Calculator::clamp(5, 0, 10), 5);
        assert_eq!(Calculator::clamp(-1, 0, 10), 0);
        assert_eq!(Calculator::clamp(15, 0, 10), 10);
    }

    // Verifying panics
    #[test]
    #[should_panic(expected = "index out of bounds")]
    fn test_index_panic() {
        let v = vec![1, 2, 3];
        let _ = v[5];
    }

    // Conditional skip
    #[test]
    #[ignore = "Run only in CI environments"]
    fn test_slow_integration() {
        std::thread::sleep(std::time::Duration::from_secs(10));
    }
}
```

### 2.1 Details and Usage of assert Macros

```rust
#[cfg(test)]
mod assert_examples {
    // --- Basic assert ---
    #[test]
    fn test_assert_basic() {
        let x = 42;
        assert!(x > 0);
        assert!(x > 0, "x should be positive: x = {}", x);
    }

    // --- Equality comparison ---
    #[test]
    fn test_assert_eq() {
        let expected = vec![1, 2, 3];
        let actual = vec![1, 2, 3];
        // On failure: the values of left and right are displayed
        assert_eq!(expected, actual);
        assert_eq!(expected, actual, "vectors do not match");
    }

    // --- Inequality comparison ---
    #[test]
    fn test_assert_ne() {
        let a = "hello";
        let b = "world";
        assert_ne!(a, b);
    }

    // --- Floating-point comparison (epsilon-based) ---
    #[test]
    fn test_float_comparison() {
        let result = 0.1 + 0.2;
        let expected = 0.3;
        let epsilon = 1e-10;

        assert!(
            (result - expected).abs() < epsilon,
            "floating-point comparison failed: {} != {} (diff: {})",
            result, expected, (result - expected).abs()
        );
    }

    // --- Tests that return Result ---
    #[test]
    fn test_with_result() -> Result<(), Box<dyn std::error::Error>> {
        let value: i32 = "42".parse()?;
        assert_eq!(value, 42);
        Ok(())
    }

    // --- debug_assert (removed in release builds) ---
    #[test]
    fn test_debug_assert() {
        debug_assert!(true, "Checked only in debug builds");
        debug_assert_eq!(1 + 1, 2);
        debug_assert_ne!(1, 2);
    }

    // --- Custom assert macro ---
    macro_rules! assert_between {
        ($value:expr, $min:expr, $max:expr) => {
            assert!(
                $value >= $min && $value <= $max,
                "{} is outside the range {} to {} (actual: {})",
                stringify!($value), $min, $max, $value
            );
        };
    }

    #[test]
    fn test_custom_assert() {
        let score = 85;
        assert_between!(score, 0, 100);
    }
}
```

### 2.2 Test Structuring Patterns

```rust
// Hierarchical test modules
#[cfg(test)]
mod tests {
    use super::*;

    // --- Arrange-Act-Assert (AAA) pattern ---
    #[test]
    fn test_user_registration() {
        // Arrange: prepare test data
        let email = "test@example.com";
        let password = "SecureP@ss123";
        let mut service = UserService::new(MockDatabase::new());

        // Act: execute the system under test
        let result = service.register(email, password);

        // Assert: verify the result
        assert!(result.is_ok());
        let user = result.unwrap();
        assert_eq!(user.email, email);
        assert!(user.password_hash != password); // confirms it was hashed
    }

    // --- Given-When-Then pattern ---
    mod given_valid_input {
        use super::*;

        mod when_parsing {
            use super::*;

            #[test]
            fn then_returns_correct_value() {
                let input = "42";
                let result: Result<i32, _> = input.parse();
                assert_eq!(result.unwrap(), 42);
            }
        }
    }

    mod given_invalid_input {
        use super::*;

        mod when_parsing {
            use super::*;

            #[test]
            fn then_returns_error() {
                let input = "not_a_number";
                let result: Result<i32, _> = input.parse();
                assert!(result.is_err());
            }
        }
    }

    // --- Test fixtures ---
    struct TestFixture {
        db: MockDatabase,
        service: UserService,
        admin_user: User,
    }

    impl TestFixture {
        fn new() -> Self {
            let db = MockDatabase::new();
            let service = UserService::new(db.clone());
            let admin_user = User {
                id: 1,
                email: "admin@example.com".to_string(),
                role: Role::Admin,
                ..Default::default()
            };
            TestFixture { db, service, admin_user }
        }

        fn with_users(mut self, count: usize) -> Self {
            for i in 0..count {
                self.db.insert_user(User {
                    id: i as u64 + 100,
                    email: format!("user{}@example.com", i),
                    role: Role::User,
                    ..Default::default()
                });
            }
            self
        }
    }

    #[test]
    fn test_with_fixture() {
        let fixture = TestFixture::new().with_users(5);
        let users = fixture.service.list_users(&fixture.admin_user);
        assert_eq!(users.unwrap().len(), 5);
    }
}
```

### Code Example 2: Integration Tests and Test Helpers

```rust
// tests/common/mod.rs — test helpers
pub struct TestContext {
    pub temp_dir: tempfile::TempDir,
    pub config: String,
}

impl TestContext {
    pub fn new() -> Self {
        let temp_dir = tempfile::tempdir().unwrap();
        let config = format!(
            r#"{{ "data_dir": "{}" }}"#,
            temp_dir.path().display()
        );
        TestContext { temp_dir, config }
    }

    pub fn write_test_file(&self, name: &str, content: &str) {
        let path = self.temp_dir.path().join(name);
        std::fs::write(path, content).unwrap();
    }
}

// tests/integration_test.rs
mod common;

use my_lib::Calculator;

#[test]
fn test_full_workflow() {
    let ctx = common::TestContext::new();
    ctx.write_test_file("input.txt", "10\n20\n30");

    let path = ctx.temp_dir.path().join("input.txt");
    let content = std::fs::read_to_string(path).unwrap();
    let sum: i64 = content.lines()
        .filter_map(|line| line.parse::<i64>().ok())
        .fold(0, |acc, x| Calculator::add(acc, x));

    assert_eq!(sum, 60);
}
```

### 2.3 Advanced Integration Test Patterns

```rust
// tests/api_integration.rs — integration tests for a Web API
use axum::http::StatusCode;
use reqwest::Client;
use std::net::SocketAddr;
use tokio::net::TcpListener;

/// Helper to spawn a test server
async fn spawn_test_server() -> (SocketAddr, tokio::task::JoinHandle<()>) {
    let app = my_app::create_app().await;
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let handle = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    // Wait for the server to start
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    (addr, handle)
}

#[tokio::test]
async fn test_health_check() {
    let (addr, _handle) = spawn_test_server().await;
    let client = Client::new();

    let response = client
        .get(format!("http://{}/health", addr))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn test_create_and_get_user() {
    let (addr, _handle) = spawn_test_server().await;
    let client = Client::new();
    let base_url = format!("http://{}", addr);

    // Create user
    let create_response = client
        .post(format!("{}/api/users", base_url))
        .json(&serde_json::json!({
            "name": "Test User",
            "email": "test@example.com"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created_user: serde_json::Value = create_response.json().await.unwrap();
    let user_id = created_user["id"].as_u64().unwrap();

    // Get user
    let get_response = client
        .get(format!("{}/api/users/{}", base_url, user_id))
        .send()
        .await
        .unwrap();

    assert_eq!(get_response.status(), StatusCode::OK);
    let user: serde_json::Value = get_response.json().await.unwrap();
    assert_eq!(user["name"], "Test User");
    assert_eq!(user["email"], "test@example.com");
}
```

### 2.4 DB Tests with Testcontainers

```rust
// tests/database_test.rs — real DB tests using testcontainers
use testcontainers::{clients::Cli, images::postgres::Postgres};
use sqlx::PgPool;

async fn setup_test_db(docker: &Cli) -> (PgPool, testcontainers::Container<Postgres>) {
    let container = docker.run(Postgres::default());
    let port = container.get_host_port_ipv4(5432);
    let database_url = format!(
        "postgres://postgres:postgres@localhost:{}/postgres",
        port
    );

    let pool = PgPool::connect(&database_url).await.unwrap();

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .unwrap();

    (pool, container)
}

#[tokio::test]
async fn test_user_repository() {
    let docker = Cli::default();
    let (pool, _container) = setup_test_db(&docker).await;

    let repo = UserRepository::new(pool.clone());

    // Create user
    let user = repo.create("test@example.com", "Test User").await.unwrap();
    assert_eq!(user.email, "test@example.com");

    // Find user
    let found = repo.find_by_email("test@example.com").await.unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "Test User");

    // Nonexistent user
    let not_found = repo.find_by_email("nobody@example.com").await.unwrap();
    assert!(not_found.is_none());
}
```

### Code Example 3: Asynchronous Tests

```rust
// tokio's test macro
#[tokio::test]
async fn test_async_operation() {
    let result = async_fetch_data("test").await;
    assert!(result.is_ok());
}

// Test with timeout
#[tokio::test(flavor = "multi_thread")]
async fn test_with_timeout() {
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        long_running_task(),
    ).await;
    assert!(result.is_ok(), "timed out!");
}

// Time control for tests
#[tokio::test]
async fn test_time_control() {
    tokio::time::pause(); // virtual time mode
    let start = tokio::time::Instant::now();
    tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
    // Completes immediately in reality (virtual time advances)
    assert!(start.elapsed() >= tokio::time::Duration::from_secs(3600));
}

async fn async_fetch_data(_: &str) -> Result<String, String> { Ok("data".into()) }
async fn long_running_task() -> String { "done".into() }
```

### 2.5 Advanced Patterns for Asynchronous Tests

```rust
use tokio::sync::mpsc;
use std::sync::Arc;

// --- Tests using channels ---
#[tokio::test]
async fn test_producer_consumer() {
    let (tx, mut rx) = mpsc::channel::<String>(10);

    // Producer
    let producer = tokio::spawn(async move {
        for i in 0..5 {
            tx.send(format!("message_{}", i)).await.unwrap();
        }
    });

    // Consumer
    let mut received = Vec::new();
    while let Some(msg) = rx.recv().await {
        received.push(msg);
    }

    producer.await.unwrap();
    assert_eq!(received.len(), 5);
    assert_eq!(received[0], "message_0");
    assert_eq!(received[4], "message_4");
}

// --- Concurrency tests ---
#[tokio::test]
async fn test_concurrent_access() {
    use tokio::sync::RwLock;

    let data = Arc::new(RwLock::new(Vec::<i32>::new()));
    let mut handles = Vec::new();

    // Multiple writer tasks
    for i in 0..10 {
        let data = Arc::clone(&data);
        handles.push(tokio::spawn(async move {
            let mut guard = data.write().await;
            guard.push(i);
        }));
    }

    // Wait for all tasks to complete
    for handle in handles {
        handle.await.unwrap();
    }

    let result = data.read().await;
    assert_eq!(result.len(), 10);
    // Order is not guaranteed, but all elements should be present
    let mut sorted: Vec<i32> = result.clone();
    sorted.sort();
    assert_eq!(sorted, (0..10).collect::<Vec<_>>());
}

// --- Tests for retry logic ---
#[tokio::test]
async fn test_retry_logic() {
    use std::sync::atomic::{AtomicUsize, Ordering};

    let attempt_count = Arc::new(AtomicUsize::new(0));

    let count = Arc::clone(&attempt_count);
    let result = retry_with_backoff(3, || {
        let count = Arc::clone(&count);
        async move {
            let attempt = count.fetch_add(1, Ordering::SeqCst);
            if attempt < 2 {
                Err("transient error".to_string())
            } else {
                Ok("success".to_string())
            }
        }
    }).await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "success");
    assert_eq!(attempt_count.load(Ordering::SeqCst), 3);
}

async fn retry_with_backoff<F, Fut, T, E>(
    max_retries: usize,
    f: F,
) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
{
    let mut last_err = None;
    for i in 0..max_retries {
        match f().await {
            Ok(v) => return Ok(v),
            Err(e) => {
                last_err = Some(e);
                if i + 1 < max_retries {
                    tokio::time::sleep(std::time::Duration::from_millis(10 * (i as u64 + 1))).await;
                }
            }
        }
    }
    Err(last_err.unwrap())
}
```

### 2.6 Documentation Tests

```rust
/// Adds two numbers.
///
/// # Examples
///
/// ```
/// use my_lib::add;
///
/// assert_eq!(add(2, 3), 5);
/// assert_eq!(add(-1, 1), 0);
/// ```
///
/// # Panics
///
/// Panics on overflow (in debug builds).
///
/// ```should_panic
/// use my_lib::add;
///
/// // i64::MAX + 1 overflows
/// let _ = add(i64::MAX, 1);
/// ```
///
/// # Error Handling Example
///
/// ```
/// use my_lib::divide;
///
/// let result = divide(10.0, 0.0);
/// assert!(result.is_err());
/// ```
///
/// # Hidden Code (setup code)
///
/// ```
/// # // This line is hidden in the rendered docs but executed in tests
/// # use my_lib::Calculator;
/// let calc = Calculator::new();
/// assert_eq!(calc.add(1, 2), 3);
/// ```
///
/// # Compile Only (do not run)
///
/// ```no_run
/// use my_lib::Server;
///
/// // Not run, but verified to compile
/// let server = Server::bind("0.0.0.0:8080").await.unwrap();
/// server.run().await;
/// ```
///
/// # Neither Compiled Nor Run (display-only docs)
///
/// ```ignore
/// // This code is not tested (e.g. when external dependencies are required)
/// let result = external_api::call().await;
/// ```
///
/// # Text Block (not treated as code)
///
/// ```text
/// This is shown as plain text and is neither tested nor compiled.
/// ```
pub fn add(a: i64, b: i64) -> i64 {
    a + b
}
```

### 2.7 Parameterized Tests with rstest

```rust
// Cargo.toml:
// [dev-dependencies]
// rstest = "0.18"

use rstest::rstest;

// --- Parameterized tests (table-driven tests) ---
#[rstest]
#[case("", true)]
#[case(" ", true)]
#[case("hello", false)]
#[case("  spaces  ", false)]
fn test_is_blank(#[case] input: &str, #[case] expected: bool) {
    assert_eq!(input.trim().is_empty(), expected);
}

// --- Fixtures ---
#[rstest::fixture]
fn database() -> MockDatabase {
    let db = MockDatabase::new();
    db.seed_test_data();
    db
}

#[rstest::fixture]
fn service(database: MockDatabase) -> UserService {
    UserService::new(database)
}

#[rstest]
fn test_find_user(service: UserService) {
    let user = service.find_by_id(1).unwrap();
    assert_eq!(user.name, "Test User");
}

// --- Combinations of multiple parameters ---
#[rstest]
fn test_format_combinations(
    #[values("json", "yaml", "toml")] format: &str,
    #[values(true, false)] pretty: bool,
) {
    let config = FormatConfig { format: format.to_string(), pretty };
    let result = serialize_config(&config);
    assert!(result.is_ok());
}

// --- Asynchronous fixtures ---
#[rstest]
#[tokio::test]
async fn test_async_with_fixture(
    #[future] async_database: MockDatabase,
) {
    let db = async_database.await;
    assert!(db.is_connected());
}
```

---

## 3. Property-Based Testing

### Comparison of Testing Approaches

```
┌─────────── Comparison of Testing Approaches ───────┐
│                                                     │
│  Example-based Test (traditional):                  │
│    Input: concrete values                           │
│    assert_eq!(sort(vec![3,1,2]),                    │
│               vec![1,2,3]);                         │
│    -> Verifies only specific cases                  │
│                                                     │
│  Property-based Test:                               │
│    Input: randomly generated (hundreds-thousands)   │
│    proptest! {                                      │
│      fn test(v: Vec<i32>) {                         │
│        let sorted = sort(v);                        │
│        assert!(is_sorted(&sorted));                 │
│      }                                              │
│    }                                                │
│    -> Verifies properties (invariants)              │
│    -> Automatically minimizes counterexamples       │
│       (shrinking)                                   │
└─────────────────────────────────────────────────────┘
```

### Code Example 4: Using proptest

```rust
use proptest::prelude::*;

/// System under test: custom sort
fn insertion_sort(mut arr: Vec<i32>) -> Vec<i32> {
    for i in 1..arr.len() {
        let key = arr[i];
        let mut j = i;
        while j > 0 && arr[j - 1] > key {
            arr[j] = arr[j - 1];
            j -= 1;
        }
        arr[j] = key;
    }
    arr
}

proptest! {
    // The sorted vector is in ascending order
    #[test]
    fn test_sort_is_ordered(mut v in prop::collection::vec(any::<i32>(), 0..100)) {
        let sorted = insertion_sort(v.clone());
        for window in sorted.windows(2) {
            prop_assert!(window[0] <= window[1],
                "not sorted: {} > {}", window[0], window[1]);
        }
    }

    // The length is preserved after sorting
    #[test]
    fn test_sort_preserves_length(v in prop::collection::vec(any::<i32>(), 0..100)) {
        let sorted = insertion_sort(v.clone());
        prop_assert_eq!(v.len(), sorted.len());
    }

    // All original elements are preserved after sorting
    #[test]
    fn test_sort_preserves_elements(v in prop::collection::vec(any::<i32>(), 0..100)) {
        let mut original = v.clone();
        let mut sorted = insertion_sort(v);
        original.sort();
        sorted.sort();
        prop_assert_eq!(original, sorted);
    }

    // Custom strategy: email address validation
    #[test]
    fn test_email_validation(
        local in "[a-z][a-z0-9]{0,15}",
        domain in "[a-z]{2,10}",
        tld in "(com|org|net|io)"
    ) {
        let email = format!("{}@{}.{}", local, domain, tld);
        prop_assert!(is_valid_email(&email),
            "valid email was rejected: {}", email);
    }
}

fn is_valid_email(email: &str) -> bool {
    email.contains('@') && email.contains('.')
}
```

### 3.1 Implementing Custom Strategies

```rust
use proptest::prelude::*;
use proptest::strategy::Strategy;

// --- Generation strategy for custom data types ---
#[derive(Debug, Clone, PartialEq)]
struct Money {
    amount: i64,     // in cents
    currency: String,
}

impl Money {
    fn new(amount: i64, currency: &str) -> Self {
        Money { amount, currency: currency.to_string() }
    }

    fn add(&self, other: &Money) -> Result<Money, String> {
        if self.currency != other.currency {
            return Err("currencies differ".to_string());
        }
        Ok(Money::new(self.amount + other.amount, &self.currency))
    }
}

// Arbitrary implementation for Money
fn money_strategy() -> impl Strategy<Value = Money> {
    (
        -1_000_000i64..1_000_000i64,
        prop::sample::select(vec!["JPY", "USD", "EUR"]),
    ).prop_map(|(amount, currency)| Money::new(amount, currency))
}

// Strategy for a pair of Money values with the same currency
fn same_currency_pair() -> impl Strategy<Value = (Money, Money)> {
    prop::sample::select(vec!["JPY", "USD", "EUR"]).prop_flat_map(|currency| {
        (
            (-1_000_000i64..1_000_000i64).prop_map(move |amt| Money::new(amt, &currency)),
            (-1_000_000i64..1_000_000i64).prop_map(move |amt| Money::new(amt, &currency)),
        )
    })
}

proptest! {
    // Commutativity of addition: a + b == b + a
    #[test]
    fn test_money_addition_commutative((a, b) in same_currency_pair()) {
        let ab = a.add(&b).unwrap();
        let ba = b.add(&a).unwrap();
        prop_assert_eq!(ab.amount, ba.amount);
    }

    // Identity of zero addition: a + 0 == a
    #[test]
    fn test_money_addition_identity(a in money_strategy()) {
        let zero = Money::new(0, &a.currency);
        let result = a.add(&zero).unwrap();
        prop_assert_eq!(result.amount, a.amount);
    }

    // Adding different currencies fails
    #[test]
    fn test_different_currency_fails(
        amount1 in -1_000_000i64..1_000_000i64,
        amount2 in -1_000_000i64..1_000_000i64,
    ) {
        let jpy = Money::new(amount1, "JPY");
        let usd = Money::new(amount2, "USD");
        prop_assert!(jpy.add(&usd).is_err());
    }
}

// --- JSON round-trip test ---
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct UserProfile {
    name: String,
    age: u8,
    tags: Vec<String>,
}

fn user_profile_strategy() -> impl Strategy<Value = UserProfile> {
    (
        "[a-zA-Z]{1,20}",
        0u8..150u8,
        prop::collection::vec("[a-z]{1,10}", 0..5),
    ).prop_map(|(name, age, tags)| UserProfile { name, age, tags })
}

proptest! {
    // Serialization -> deserialization yields the original value
    #[test]
    fn test_json_roundtrip(profile in user_profile_strategy()) {
        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: UserProfile = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(profile, deserialized);
    }
}
```

### 3.2 Configuring and Tuning proptest

```rust
use proptest::prelude::*;
use proptest::test_runner::Config;

// --- Customizing test configuration ---
proptest! {
    #![proptest_config(Config::with_cases(10_000))]

    #[test]
    fn test_with_more_cases(x in any::<i32>()) {
        // Default 256 cases -> 10,000 cases
        prop_assert!(x.checked_add(0) == Some(x));
    }
}

// Detailed ProptestConfig settings
fn custom_config() -> ProptestConfig {
    ProptestConfig {
        cases: 1000,            // number of test cases
        max_shrink_iters: 10000, // max shrink iterations
        max_shrink_time: 30000,  // max shrink time (milliseconds)
        fork: false,            // run in a forked process
        timeout: 60000,         // test timeout (milliseconds)
        ..ProptestConfig::default()
    }
}

// --- Regression test files ---
// Failure cases are saved in the proptest-regressions/ directory
// Commit this directory to Git

// Example of proptest-regressions/my_tests.txt:
// # seed = "cc deadbeef12345678..."
// # Seed for reproducing the failed input
```

---

## 4. Benchmarking

### Code Example 5: criterion Benchmarks

```rust
// benches/sorting_bench.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};

fn fibonacci_recursive(n: u64) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        n => fibonacci_recursive(n - 1) + fibonacci_recursive(n - 2),
    }
}

fn fibonacci_iterative(n: u64) -> u64 {
    let (mut a, mut b) = (0u64, 1u64);
    for _ in 0..n {
        let temp = b;
        b = a + b;
        a = temp;
    }
    a
}

fn bench_fibonacci(c: &mut Criterion) {
    let mut group = c.benchmark_group("fibonacci");

    for n in [10, 20, 30].iter() {
        group.bench_with_input(
            BenchmarkId::new("recursive", n),
            n,
            |b, &n| b.iter(|| fibonacci_recursive(black_box(n))),
        );
        group.bench_with_input(
            BenchmarkId::new("iterative", n),
            n,
            |b, &n| b.iter(|| fibonacci_iterative(black_box(n))),
        );
    }
    group.finish();
}

fn bench_sorting(c: &mut Criterion) {
    let mut group = c.benchmark_group("sorting");

    for size in [100, 1_000, 10_000].iter() {
        let mut data: Vec<i32> = (0..*size).rev().collect();

        group.bench_with_input(
            BenchmarkId::new("std_sort", size),
            &data,
            |b, data| b.iter(|| {
                let mut d = data.clone();
                d.sort();
                black_box(d)
            }),
        );

        group.bench_with_input(
            BenchmarkId::new("std_sort_unstable", size),
            &data,
            |b, data| b.iter(|| {
                let mut d = data.clone();
                d.sort_unstable();
                black_box(d)
            }),
        );
    }
    group.finish();
}

criterion_group!(benches, bench_fibonacci, bench_sorting);
criterion_main!(benches);

// Cargo.toml:
// name = "sorting_bench"
// harness = false
//
// [dev-dependencies]
// criterion = { version = "0.5", features = ["html_reports"] }
```

### How to Read Benchmark Results

```
┌──────────── Interpreting criterion Output ──────┐
│                                                  │
│  fibonacci/iterative/20                          │
│                  time:   [12.3 ns 12.5 ns 12.7 ns]
│                          ~~~~~~~ ~~~~~~~ ~~~~~~~
│                          95% lower median 95% upper
│                                                  │
│  change: [-2.1234% -0.5678% +1.0123%]            │
│          ~~~~~~~~  ~~~~~~~~  ~~~~~~~~            │
│          min change estimate max change          │
│          (95% confidence interval)               │
│                                                  │
│  Performance has improved. (p < 0.05)            │
│  -> Statistically significant improvement        │
│                                                  │
│  HTML report:                                    │
│  target/criterion/report/index.html              │
│  -> Visualize changes over time with graphs      │
└──────────────────────────────────────────────────┘
```

### 4.1 Advanced Benchmark Configuration

```rust
// benches/advanced_bench.rs
use criterion::{
    black_box, criterion_group, criterion_main,
    Criterion, BenchmarkId, BatchSize,
    measurement::WallTime,
    PlotConfiguration, AxisScale,
};
use std::time::Duration;

fn bench_with_setup(c: &mut Criterion) {
    let mut group = c.benchmark_group("with_setup");

    // Benchmark group settings
    group.sample_size(100);              // sample count
    group.measurement_time(Duration::from_secs(10)); // measurement time
    group.warm_up_time(Duration::from_secs(3));      // warm-up
    group.noise_threshold(0.05);         // noise threshold (5%)
    group.confidence_level(0.95);        // confidence interval
    group.significance_level(0.05);      // significance level

    // Plot configuration
    let plot_config = PlotConfiguration::default()
        .summary_scale(AxisScale::Logarithmic);
    group.plot_config(plot_config);

    // --- Benchmark with setup ---
    for size in [100, 1_000, 10_000, 100_000].iter() {
        group.bench_with_input(
            BenchmarkId::new("hashmap_insert", size),
            size,
            |b, &size| {
                b.iter_batched(
                    || {
                        // Setup (excluded from measurement time)
                        let data: Vec<(String, i32)> = (0..size)
                            .map(|i| (format!("key_{}", i), i as i32))
                            .collect();
                        data
                    },
                    |data| {
                        // Code under measurement
                        let mut map = std::collections::HashMap::new();
                        for (k, v) in data {
                            map.insert(k, v);
                        }
                        black_box(map)
                    },
                    BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

// --- Throughput benchmark ---
fn bench_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("throughput");

    for size in [1024, 4096, 16384, 65536].iter() {
        let data = vec![0u8; *size];

        group.throughput(criterion::Throughput::Bytes(*size as u64));
        group.bench_with_input(
            BenchmarkId::new("compress", size),
            &data,
            |b, data| {
                b.iter(|| {
                    // Compression benchmark
                    let mut encoder = flate2::write::GzEncoder::new(
                        Vec::new(),
                        flate2::Compression::default(),
                    );
                    std::io::Write::write_all(&mut encoder, data).unwrap();
                    black_box(encoder.finish().unwrap())
                });
            },
        );
    }

    group.finish();
}

// --- Asynchronous benchmark ---
fn bench_async(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("async_task", |b| {
        b.to_async(&rt).iter(|| async {
            let result = async_computation().await;
            black_box(result)
        });
    });
}

async fn async_computation() -> Vec<i32> {
    let mut handles = Vec::new();
    for i in 0..10 {
        handles.push(tokio::spawn(async move { i * i }));
    }
    let mut results = Vec::new();
    for handle in handles {
        results.push(handle.await.unwrap());
    }
    results
}

criterion_group!(benches, bench_with_setup, bench_throughput, bench_async);
criterion_main!(benches);
```

### 4.2 divan Benchmarks (an Alternative Tool)

```rust
// benches/divan_bench.rs
// Cargo.toml:
// name = "divan_bench"
// harness = false
//
// [dev-dependencies]
// divan = "0.1"

fn main() {
    divan::main();
}

#[divan::bench]
fn simple_bench() -> Vec<i32> {
    (0..1000).collect()
}

#[divan::bench(args = [100, 1000, 10000])]
fn bench_with_args(n: usize) -> Vec<i32> {
    (0..n as i32).collect()
}

#[divan::bench(types = [Vec<i32>, Vec<u64>, Vec<f64>])]
fn bench_generic<T: Default + Clone>() -> Vec<T> {
    vec![T::default(); 1000]
}

// Advantages of divan:
// - Define benchmarks easily with just the #[divan::bench] attribute
// - Type-parameterized benchmarks
// - Argument-parameterized benchmarks
// - Simpler configuration than criterion
```

---

## 5. Test Strategies

### Code Example 6: Mocks/Stubs

```rust
/// Testable design: define an interface with a trait
trait EmailSender {
    fn send(&self, to: &str, subject: &str, body: &str) -> Result<(), String>;
}

struct SmtpSender;
impl EmailSender for SmtpSender {
    fn send(&self, to: &str, subject: &str, body: &str) -> Result<(), String> {
        // Actual SMTP send
        Ok(())
    }
}

/// Mock for testing
#[cfg(test)]
struct MockEmailSender {
    sent: std::cell::RefCell<Vec<(String, String, String)>>,
    should_fail: bool,
}

#[cfg(test)]
impl MockEmailSender {
    fn new() -> Self {
        MockEmailSender {
            sent: std::cell::RefCell::new(Vec::new()),
            should_fail: false,
        }
    }

    fn with_failure() -> Self {
        MockEmailSender {
            sent: std::cell::RefCell::new(Vec::new()),
            should_fail: true,
        }
    }

    fn sent_count(&self) -> usize {
        self.sent.borrow().len()
    }
}

#[cfg(test)]
impl EmailSender for MockEmailSender {
    fn send(&self, to: &str, subject: &str, body: &str) -> Result<(), String> {
        if self.should_fail {
            return Err("send failed".into());
        }
        self.sent.borrow_mut().push((to.into(), subject.into(), body.into()));
        Ok(())
    }
}

// Business logic
fn notify_user(sender: &dyn EmailSender, user_email: &str) -> Result<(), String> {
    sender.send(user_email, "Notification", "Processing complete")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notify_sends_email() {
        let mock = MockEmailSender::new();
        notify_user(&mock, "user@example.com").unwrap();
        assert_eq!(mock.sent_count(), 1);
    }

    #[test]
    fn test_notify_handles_failure() {
        let mock = MockEmailSender::with_failure();
        let result = notify_user(&mock, "user@example.com");
        assert!(result.is_err());
    }
}
```

### 5.1 Automatic Mock Generation with mockall

```rust
// Cargo.toml:
// [dev-dependencies]
// mockall = "0.12"

use mockall::{automock, predicate::*};

#[automock]
trait UserRepository {
    fn find_by_id(&self, id: u64) -> Option<User>;
    fn find_by_email(&self, email: &str) -> Option<User>;
    fn save(&self, user: &User) -> Result<(), RepositoryError>;
    fn delete(&self, id: u64) -> Result<(), RepositoryError>;
}

#[automock]
trait NotificationService {
    fn send_email(&self, to: &str, subject: &str, body: &str) -> Result<(), String>;
    fn send_sms(&self, to: &str, message: &str) -> Result<(), String>;
}

struct UserService<R: UserRepository, N: NotificationService> {
    repo: R,
    notification: N,
}

impl<R: UserRepository, N: NotificationService> UserService<R, N> {
    fn register(&self, email: &str, name: &str) -> Result<User, String> {
        // Check for an existing user
        if self.repo.find_by_email(email).is_some() {
            return Err("email address is already registered".to_string());
        }

        let user = User {
            id: 0,
            email: email.to_string(),
            name: name.to_string(),
        };
        self.repo.save(&user).map_err(|e| e.to_string())?;
        self.notification.send_email(email, "Registration Complete", "Registration is complete")?;
        Ok(user)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;

    #[test]
    fn test_register_new_user() {
        let mut mock_repo = MockUserRepository::new();
        let mut mock_notif = MockNotificationService::new();

        // find_by_email returns None (no existing user)
        mock_repo
            .expect_find_by_email()
            .with(eq("new@example.com"))
            .times(1)
            .returning(|_| None);

        // save succeeds
        mock_repo
            .expect_save()
            .times(1)
            .returning(|_| Ok(()));

        // Email send succeeds
        mock_notif
            .expect_send_email()
            .with(eq("new@example.com"), eq("Registration Complete"), always())
            .times(1)
            .returning(|_, _, _| Ok(()));

        let service = UserService {
            repo: mock_repo,
            notification: mock_notif,
        };

        let result = service.register("new@example.com", "New User");
        assert!(result.is_ok());
    }

    #[test]
    fn test_register_duplicate_email() {
        let mut mock_repo = MockUserRepository::new();
        let mock_notif = MockNotificationService::new();

        // Existing user is found
        mock_repo
            .expect_find_by_email()
            .returning(|_| Some(User {
                id: 1,
                email: "existing@example.com".to_string(),
                name: "Existing User".to_string(),
            }));

        // save is never called
        mock_repo.expect_save().never();

        let service = UserService {
            repo: mock_repo,
            notification: mock_notif,
        };

        let result = service.register("existing@example.com", "test");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already registered"));
    }
}
```

### 5.2 HTTP Mocking with wiremock

```rust
// Cargo.toml:
// [dev-dependencies]
// wiremock = "0.6"

use wiremock::{MockServer, Mock, ResponseTemplate};
use wiremock::matchers::{method, path, query_param, body_json};

#[tokio::test]
async fn test_external_api_call() {
    // Start a mock server
    let mock_server = MockServer::start().await;

    // Configure the mock response
    Mock::given(method("GET"))
        .and(path("/api/users/42"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(serde_json::json!({
                    "id": 42,
                    "name": "Test User",
                    "email": "test@example.com"
                }))
        )
        .expect(1)  // Expect to be called exactly once
        .mount(&mock_server)
        .await;

    // Client under test
    let client = ApiClient::new(&mock_server.uri());
    let user = client.get_user(42).await.unwrap();

    assert_eq!(user.name, "Test User");
}

#[tokio::test]
async fn test_api_error_handling() {
    let mock_server = MockServer::start().await;

    // Mock for 500 error
    Mock::given(method("GET"))
        .and(path("/api/users/999"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let client = ApiClient::new(&mock_server.uri());
    let result = client.get_user(999).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_api_retry_on_timeout() {
    let mock_server = MockServer::start().await;

    // First two calls time out, third succeeds
    Mock::given(method("GET"))
        .and(path("/api/data"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(serde_json::json!({"status": "ok"}))
                .set_delay(std::time::Duration::from_millis(100))
        )
        .mount(&mock_server)
        .await;

    let client = ApiClient::new(&mock_server.uri())
        .with_timeout(std::time::Duration::from_secs(5))
        .with_retries(3);

    let result = client.get_data().await;
    assert!(result.is_ok());
}
```

### 5.3 Snapshot Testing

```rust
// Cargo.toml:
// [dev-dependencies]
// insta = { version = "1", features = ["json", "yaml"] }

use insta::{assert_snapshot, assert_json_snapshot, assert_yaml_snapshot};

#[test]
fn test_html_rendering() {
    let html = render_template("welcome", &context);
    // Compare against the expected value stored in the snapshot file
    assert_snapshot!(html);
}

#[test]
fn test_api_response_format() {
    let response = create_user_response(&user);
    // Snapshot in JSON format
    assert_json_snapshot!(response, {
        ".id" => "[id]",           // mask dynamic values
        ".created_at" => "[date]", // mask timestamps
    });
}

#[test]
fn test_config_serialization() {
    let config = Config::default();
    assert_yaml_snapshot!(config);
}

// Updating snapshots:
// cargo insta test         # run tests
// cargo insta review       # review and approve diffs
// cargo insta accept       # accept all
```

### 5.4 Fuzz Testing

```rust
// Cargo.toml:
// [dependencies]
// # fuzz targets are managed separately with cargo-fuzz
//
// fuzz/Cargo.toml:
// [dependencies]
// libfuzzer-sys = "0.4"
// arbitrary = { version = "1", features = ["derive"] }

// fuzz/fuzz_targets/parse_input.rs
#![no_main]
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    // Pass arbitrary byte sequences to the parser
    if let Ok(input) = std::str::from_utf8(data) {
        let _ = my_lib::parse(input);
    }
});

// Structured fuzzing with the Arbitrary trait
use arbitrary::Arbitrary;

#[derive(Debug, Arbitrary)]
struct FuzzInput {
    name: String,
    age: u8,
    values: Vec<i32>,
}

fuzz_target!(|input: FuzzInput| {
    let _ = my_lib::process_user(&input.name, input.age, &input.values);
});

// How to run:
// cargo install cargo-fuzz
// cargo fuzz init           # create the fuzz/ directory
// cargo fuzz add parse_input  # add a fuzz target
// cargo +nightly fuzz run parse_input  # run fuzzing (requires nightly)
// cargo +nightly fuzz run parse_input -- -max_total_time=60  # exit after 60 seconds
```

---

## 6. Test Coverage and CI Integration

### 6.1 Measuring Coverage

```bash
# --- cargo-llvm-cov ---
cargo install cargo-llvm-cov

# Measure test coverage
cargo llvm-cov                     # console output
cargo llvm-cov --html              # HTML report
cargo llvm-cov --lcov --output-path lcov.info  # LCOV format

# Specific test only
cargo llvm-cov --lib               # unit tests only
cargo llvm-cov --test integration  # integration tests only
cargo llvm-cov --all-features      # all features

# Whole workspace
cargo llvm-cov --workspace

# Check coverage threshold
cargo llvm-cov --fail-under-lines 80  # fail if line coverage is below 80%

# --- tarpaulin (Linux only) ---
cargo install cargo-tarpaulin
cargo tarpaulin --out html --all-features
```

### 6.2 Mutation Testing

```bash
# cargo-mutants — mutation testing
cargo install cargo-mutants

# Run mutation tests
cargo mutants                      # run all mutants
cargo mutants -- -p my-crate       # specific crate only
cargo mutants --list               # list mutants
cargo mutants --timeout-multiplier 3  # timeout multiplier

# How to interpret results:
# caught: tests detected the mutant (good)
# missed: tests missed the mutant (need to add tests)
# unviable: mutant fails to compile (safe to ignore)
# timeout: timed out (tests may be too slow)
```

### 6.3 Speeding Up Tests

```bash
# --- nextest: a fast test runner ---
cargo install cargo-nextest

# Run tests (highly parallel)
cargo nextest run                  # default parallel execution
cargo nextest run --workspace      # whole workspace
cargo nextest run -p my-crate      # specific crate
cargo nextest run --retries 2      # retry on failure
cargo nextest run --test-threads 8 # specify thread count

# Filtering tests
cargo nextest run -E 'test(test_parse)'     # filter by name
cargo nextest run -E 'package(my-crate)'    # filter by package
cargo nextest run -E 'kind(test)'           # filter by test kind

# Save test results
cargo nextest run --message-format json > results.json
```

```toml
# .config/nextest.toml — nextest configuration
[store]
dir = "target/nextest"

[profile.default]
retries = 0
slow-timeout = { period = "60s", terminate-after = 2 }
fail-fast = true

[profile.ci]
retries = 2
fail-fast = false
slow-timeout = { period = "120s", terminate-after = 3 }

# Test groups (resource limits)
[test-groups.serial-db]
max-threads = 1

filter = "test(/db_/)"
test-group = "serial-db"
```

---

## 7. Comparison Tables

### Comparison of Testing Frameworks

| Framework | Type | Features | Use Case |
|---|---|---|---|
| Standard #[test] | Unit/Integration | Built-in, zero-config | Basic tests |
| proptest | Property-based | Auto-generation + shrinking | Verifying specifications |
| quickcheck | Property-based | Derived from Haskell | Lightweight property tests |
| criterion | Benchmark | Statistical analysis, HTML | Performance regression |
| divan | Benchmark | #[divan::bench] | Simple benchmarks |
| rstest | Parameterized | #[rstest] + fixtures | Table-driven tests |
| mockall | Mock | Automatic mock generation | Replacing dependencies |
| wiremock | HTTP mock | Async support | External API testing |
| insta | Snapshot | JSON/YAML support | Output regression tests |
| cargo-fuzz | Fuzzing | Based on libFuzzer | Security testing |
| nextest | Test runner | Fast parallel execution | CI/CD |

### Comparison of assert Macros

| Macro | Use Case | Failure Message |
|---|---|---|
| `assert!(expr)` | Boolean | "assertion failed" |
| `assert_eq!(a, b)` | Equality | Displays values of left and right |
| `assert_ne!(a, b)` | Inequality | left and right are equal |
| `debug_assert!()` | Debug builds only | Removed in release |
| `prop_assert!()` | Inside proptest | Performs counterexample shrinking |
| `assert_snapshot!()` | insta | Diff against the snapshot |

### Comparison of Test Execution Commands

| Command | Target | Description |
|---|---|---|
| `cargo test` | All tests | Unit + integration + doc tests |
| `cargo test --lib` | Unit tests | Only #[test] inside src/ |
| `cargo test --test name` | Specific integration test | tests/name.rs |
| `cargo test --doc` | Doc tests | Code blocks inside /// |
| `cargo test --examples` | Example code | Compile tests for examples/ |
| `cargo test name` | Name filter | Tests whose name contains "name" |
| `cargo test -- --nocapture` | Show output | Display println! output |
| `cargo test -- --test-threads=1` | Serial execution | Disable parallel execution |
| `cargo test -- --ignored` | Ignored tests | Run tests marked #[ignore] |
| `cargo test -- --include-ignored` | All tests | Run all including ignored ones |

---

## 8. Anti-Patterns

### Anti-Pattern 1: Sharing State Between Tests

```rust
// BAD: state leaks between tests via static variables
static mut COUNTER: u32 = 0;

#[test]
fn test_a() {
    unsafe { COUNTER += 1; }
    // Depends on test execution order!
}

#[test]
fn test_b() {
    unsafe { assert_eq!(COUNTER, 0); } // fails if test_a runs first!
}

// GOOD: each test sets up its own independent state
#[test]
fn test_a_isolated() {
    let mut counter = 0u32;
    counter += 1;
    assert_eq!(counter, 1);
}

#[test]
fn test_b_isolated() {
    let counter = 0u32;
    assert_eq!(counter, 0);
}
```

### Anti-Pattern 2: Optimization Removal in Benchmarks

```rust
// BAD: the compiler removes code whose result is unused
fn bench_bad(c: &mut Criterion) {
    c.bench_function("sum", |b| {
        b.iter(|| {
            let sum: u64 = (0..1000).sum(); // may be optimized away
        });
    });
}

// GOOD: prevent optimization with black_box
use criterion::black_box;
fn bench_good(c: &mut Criterion) {
    c.bench_function("sum", |b| {
        b.iter(|| {
            let sum: u64 = (0..1000).sum();
            black_box(sum) // tells the compiler "this value is used"
        });
    });
}
```

### Anti-Pattern 3: Over-verifying Implementation Details in Tests

```rust
// BAD: verifying implementation details
#[test]
fn test_sort_uses_quicksort() {
    // Checks whether quicksort is used internally <- implementation detail
    let comparisons = count_comparisons(sort, &data);
    assert!(comparisons < n * log2(n) * 1.5);
}

// GOOD: verify behavior (interface)
#[test]
fn test_sort_produces_ordered_output() {
    let input = vec![3, 1, 4, 1, 5, 9, 2, 6];
    let result = sort(&input);
    assert_eq!(result, vec![1, 1, 2, 3, 4, 5, 6, 9]);
}
```

### Anti-Pattern 4: Duplicated Tests

```rust
// BAD: copy-pasted near-identical tests
#[test]
fn test_parse_int_positive() {
    assert_eq!(parse("42"), Ok(42));
}
#[test]
fn test_parse_int_positive_2() {
    assert_eq!(parse("100"), Ok(100));
}
#[test]
fn test_parse_int_positive_3() {
    assert_eq!(parse("999"), Ok(999));
}

// GOOD: parameterized test
#[rstest]
#[case("42", 42)]
#[case("100", 100)]
#[case("999", 999)]
#[case("0", 0)]
#[case("-1", -1)]
fn test_parse_int(#[case] input: &str, #[case] expected: i32) {
    assert_eq!(parse(input), Ok(expected));
}
```

### Anti-Pattern 5: Tests That Are Too Slow

```rust
// BAD: slow tests (I/O, network, large data)
#[test]
fn test_slow_network_call() {
    let response = reqwest::blocking::get("https://api.example.com/data").unwrap();
    assert_eq!(response.status(), 200);
}

// GOOD: speed up using mocks
#[tokio::test]
async fn test_fast_with_mock() {
    let mock_server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/data"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&mock_server)
        .await;

    let response = client.get(&format!("{}/data", mock_server.uri()))
        .send().await.unwrap();
    assert_eq!(response.status(), 200);
}
```

---

## 9. Testable Architecture

### 9.1 Dependency Injection Patterns

```rust
// --- Dependency injection via traits ---
pub trait Clock {
    fn now(&self) -> chrono::DateTime<chrono::Utc>;
}

pub struct SystemClock;
impl Clock for SystemClock {
    fn now(&self) -> chrono::DateTime<chrono::Utc> {
        chrono::Utc::now()
    }
}

#[cfg(test)]
pub struct FixedClock(pub chrono::DateTime<chrono::Utc>);

#[cfg(test)]
impl Clock for FixedClock {
    fn now(&self) -> chrono::DateTime<chrono::Utc> {
        self.0
    }
}

// Time-dependent business logic
pub struct TokenService<C: Clock> {
    clock: C,
    expiry_duration: chrono::Duration,
}

impl<C: Clock> TokenService<C> {
    pub fn new(clock: C, expiry_hours: i64) -> Self {
        TokenService {
            clock,
            expiry_duration: chrono::Duration::hours(expiry_hours),
        }
    }

    pub fn create_token(&self, user_id: u64) -> Token {
        let now = self.clock.now();
        Token {
            user_id,
            created_at: now,
            expires_at: now + self.expiry_duration,
        }
    }

    pub fn is_expired(&self, token: &Token) -> bool {
        self.clock.now() > token.expires_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_token_expiry() {
        // Test with a fixed time
        let fixed_time = chrono::Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap();
        let clock = FixedClock(fixed_time);
        let service = TokenService::new(clock, 24);

        let token = service.create_token(42);
        assert_eq!(token.user_id, 42);
        assert_eq!(
            token.expires_at,
            chrono::Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap()
        );
    }

    #[test]
    fn test_expired_token() {
        // Check using a time one day later
        let future_time = chrono::Utc.with_ymd_and_hms(2024, 1, 3, 0, 0, 0).unwrap();
        let clock = FixedClock(future_time);
        let service = TokenService::new(clock, 24);

        let token = Token {
            user_id: 42,
            created_at: chrono::Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap(),
            expires_at: chrono::Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap(),
        };

        assert!(service.is_expired(&token));
    }
}
```

### 9.2 Types of Test Doubles

```
┌────────────── Types of Test Doubles ────────────┐
│                                                  │
│  Dummy:  Just satisfies arguments (never called) │
│  Stub:   Returns fixed values                    │
│  Spy:    Records invocations                     │
│  Mock:   Verifies expected invocations           │
│  Fake:   Working simplified implementation       │
│          (e.g., in-memory DB)                    │
│                                                  │
│  When to use which:                              │
│  - Control return values -> Stub                 │
│  - Verify call counts -> Mock (mockall)          │
│  - Record side effects -> Spy                    │
│  - Integration tests -> Fake (in-memory impl)    │
└──────────────────────────────────────────────────┘
```

```rust
// Fake pattern: in-memory repository
pub struct InMemoryUserRepository {
    users: std::sync::Mutex<Vec<User>>,
    next_id: std::sync::atomic::AtomicU64,
}

impl InMemoryUserRepository {
    pub fn new() -> Self {
        InMemoryUserRepository {
            users: std::sync::Mutex::new(Vec::new()),
            next_id: std::sync::atomic::AtomicU64::new(1),
        }
    }
}

impl UserRepository for InMemoryUserRepository {
    fn find_by_id(&self, id: u64) -> Option<User> {
        self.users.lock().unwrap()
            .iter()
            .find(|u| u.id == id)
            .cloned()
    }

    fn find_by_email(&self, email: &str) -> Option<User> {
        self.users.lock().unwrap()
            .iter()
            .find(|u| u.email == email)
            .cloned()
    }

    fn save(&self, user: &User) -> Result<(), RepositoryError> {
        let mut users = self.users.lock().unwrap();
        let mut new_user = user.clone();
        if new_user.id == 0 {
            new_user.id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        }
        users.push(new_user);
        Ok(())
    }

    fn delete(&self, id: u64) -> Result<(), RepositoryError> {
        let mut users = self.users.lock().unwrap();
        users.retain(|u| u.id != id);
        Ok(())
    }
}
```

---

## FAQ

### Q1: What is the test execution order?

**A:** Rust tests run in parallel by default. You can switch to serial execution with `cargo test -- --test-threads=1`. Designs that depend on inter-test relationships should be avoided.

### Q2: How do I measure test coverage?

**A:** Use `cargo-llvm-cov` or `tarpaulin`.

```bash
# cargo-llvm-cov
cargo install cargo-llvm-cov
cargo llvm-cov --html         # generate HTML report
cargo llvm-cov --open         # open in browser

# tarpaulin (Linux only)
cargo install cargo-tarpaulin
cargo tarpaulin --out html
```

### Q3: How do I debug failures in proptest?

**A:** proptest automatically minimizes (shrinks) failing inputs and re-tests them. Failing seeds are saved in the `proptest-regressions/` directory and will be re-run automatically on subsequent test runs.

```
# proptest-regressions/test_name.txt
# Stores seeds for failing inputs
cc deadbeef12345678
```

### Q4: How do I filter tests?

**A:** You can filter by test name or module name.

```bash
# Only tests whose name contains "parse"
cargo test parse

# Tests in a specific module
cargo test tests::given_valid_input

# Regex filter (nextest)
cargo nextest run -E 'test(/test_parse_.*/)'

# Run ignored tests
cargo test -- --ignored

# All tests (including ignored)
cargo test -- --include-ignored
```

### Q5: How do I debug tests?

**A:** Several methods are available.

```bash
# Display println! output
cargo test -- --nocapture

# Run only a specific test, with output
cargo test test_my_function -- --nocapture

# Detailed logging via RUST_LOG
RUST_LOG=debug cargo test -- --nocapture

# Attach a debugger (lldb/gdb)
# 1. Find the test binary path
cargo test --no-run --message-format=json | jq '.executable'
# 2. Run under the debugger
lldb target/debug/deps/my_crate-abc123 -- test_my_function
```

### Q6: What if integration tests are slow to compile?

**A:** Each integration test file is compiled as an independent binary crate. You can improve compile times by reducing the number of files.

```rust
// BAD: many integration test files (each compiled independently)
// tests/test_auth.rs
// tests/test_users.rs
// tests/test_orders.rs
// tests/test_payments.rs
// -> 4 binaries are compiled

// GOOD: load modules from a single entry point
// tests/integration.rs
mod auth;
mod users;
mod orders;
mod payments;
// -> all tests run from a single binary
```

### Q7: How do I separate tests by feature?

**A:** Apply `#[cfg(feature = "...")]` to test modules.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Always-run test
    #[test]
    fn test_basic() {
        assert!(true);
    }

    // Only when the json feature is enabled
    #[cfg(feature = "json")]
    mod json_tests {
        use super::*;

        #[test]
        fn test_json_serialize() {
            let value = MyStruct { name: "test".into() };
            let json = serde_json::to_string(&value).unwrap();
            assert!(json.contains("test"));
        }
    }

    // Only when the async feature is enabled
    #[cfg(feature = "async")]
    mod async_tests {
        use super::*;

        #[tokio::test]
        async fn test_async_operation() {
            let result = async_function().await;
            assert!(result.is_ok());
        }
    }
}
```

---

## Summary

| Topic | Key Points |
|---|---|
| #[test] | Standard tests. Excluded from production builds with #[cfg(test)] |
| Integration tests | The tests/ directory. Tests only the public API |
| Doc tests | Code in /// comments. Manage docs and tests together |
| proptest | Verify properties with random inputs. Auto-minimizes counterexamples |
| criterion | Statistical benchmarks. Effective for regression detection |
| divan | Simple benchmarks. Defined with attribute macros |
| rstest | Parameterized tests. Supports fixtures |
| mockall | Trait-based automatic mock generation |
| wiremock | HTTP mocks. Supports async tests |
| insta | Snapshot testing. Supports JSON/YAML |
| Mocks | Replace dependencies based on traits |
| Test isolation | Each test is independent. Sharing state is forbidden |
| black_box | Prevents removal of benchmarked code by optimization |
| nextest | Fast test runner. Ideal for CI/CD |
| cargo-llvm-cov | Code coverage measurement |
| cargo-mutants | Mutation testing |
| cargo-fuzz | Fuzz testing |

## Further Reading

- [Serde](./02-serde.md) — Useful for loading test fixtures
- [Best Practices](./04-best-practices.md) — Testable design patterns
- [Cargo/Workspaces](./00-cargo-workspace.md) — Test configuration and profiles

## References

1. **The Rust Book — Testing**: https://doc.rust-lang.org/book/ch11-00-testing.html
2. **proptest book**: https://proptest-rs.github.io/proptest/intro.html
3. **criterion.rs User Guide**: https://bheisler.github.io/criterion.rs/book/
4. **mockall documentation**: https://docs.rs/mockall/
5. **rstest documentation**: https://docs.rs/rstest/
6. **wiremock documentation**: https://docs.rs/wiremock/
7. **insta documentation**: https://insta.rs/
8. **cargo-nextest documentation**: https://nexte.st/
9. **cargo-llvm-cov documentation**: https://github.com/taiki-e/cargo-llvm-cov
10. **cargo-fuzz documentation**: https://rust-fuzz.github.io/book/cargo-fuzz.html
