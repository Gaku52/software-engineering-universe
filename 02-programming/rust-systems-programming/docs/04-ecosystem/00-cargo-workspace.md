# Cargo / Workspaces — features and publish

> Systematically master Cargo's package management, monorepo organization with workspaces, feature flags, and the procedure for publishing to crates.io.

## What you will learn in this chapter

1. **Cargo basics** — dependency management, profile configuration, build scripts
2. **Workspaces** — multi-crate organization, sharing dependencies, selective builds
3. **Feature flags and publishing** — conditional compilation, semantic versioning, publishing to crates.io
4. **Cargo toolchain** — quality-management tools such as clippy, rustfmt, cargo-deny, and cargo-audit
5. **CI/CD integration** — automated build, test, and publish pipelines on GitHub Actions and similar systems


## Prerequisites

Reading this guide is easier if you already have the following knowledge:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. Cargo project structure

```
┌──────────────── Cargo project layout ───────────────┐
│                                                       │
│  Single crate:                                        │
│  my-app/                                              │
│  ├── Cargo.toml        (package definition)           │
│  ├── Cargo.lock        (pinned dependency versions)   │
│  ├── src/                                             │
│  │   ├── main.rs       (binary crate)                 │
│  │   ├── lib.rs        (library crate)                │
│  │   └── bin/          (additional binaries)          │
│  │       └── tool.rs                                  │
│  ├── tests/            (integration tests)            │
│  ├── benches/          (benchmarks)                   │
│  ├── examples/         (usage examples)               │
│  └── build.rs          (build script)                 │
│                                                       │
│  Workspace:                                           │
│  my-workspace/                                        │
│  ├── Cargo.toml        (workspace definition)         │
│  ├── crates/                                          │
│  │   ├── core/         (shared library)               │
│  │   ├── cli/          (CLI app)                      │
│  │   └── server/       (web server)                   │
│  └── Cargo.lock        (shared across the workspace)  │
└───────────────────────────────────────────────────────┘
```

### 1.1 Directory convention details

Cargo adopts a convention-based directory structure, and each directory has a clear role.

```
my-project/
├── Cargo.toml          # Package manifest
├── Cargo.lock          # Records the exact versions of dependencies
├── rust-toolchain.toml # Toolchain version specification
├── .cargo/
│   └── config.toml     # Cargo local configuration
├── src/
│   ├── main.rs         # Default binary entry point
│   ├── lib.rs          # Root module of the library
│   └── bin/
│       ├── admin.rs    # Additional binary: cargo run --bin admin
│       └── migrate/
│           └── main.rs # Additional binary: cargo run --bin migrate
├── tests/
│   ├── integration_test.rs    # Each file is an independent test crate
│   └── common/
│       └── mod.rs             # Shared test helpers
├── benches/
│   └── my_bench.rs            # criterion benchmark
├── examples/
│   ├── basic_usage.rs         # cargo run --example basic_usage
│   └── advanced/
│       └── main.rs            # cargo run --example advanced
└── build.rs                   # Build script
```

### 1.2 .cargo/config.toml settings

`.cargo/config.toml` is the file that holds project-level Cargo configuration.

```toml
# .cargo/config.toml

# Build target specification
[build]
# Default target for cross-compilation
# target = "x86_64-unknown-linux-musl"

# Limit on the number of jobs (useful in CI environments)
jobs = 4

# Linker specification
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=lld"]

# macOS settings
[target.aarch64-apple-darwin]
rustflags = ["-C", "link-arg=-fuse-ld=lld"]

# Settings for Windows MSVC
[target.x86_64-pc-windows-msvc]
rustflags = ["-C", "target-feature=+crt-static"]

# Aliases (custom commands)
[alias]
xtask = "run --package xtask --"
ci = "test --workspace --all-features"
lint = "clippy --workspace --all-targets --all-features -- -D warnings"
fmt-check = "fmt --all -- --check"

# Registry settings
[registries.my-private]
index = "sparse+https://cargo.my-company.com/index/"

# Environment variables
[env]
RUST_BACKTRACE = "1"
RUST_LOG = { value = "info", force = false }

# Network settings
[net]
retry = 3
git-fetch-with-cli = true
```

### 1.3 rust-toolchain.toml

This file pins the Rust version used throughout the project.

```toml
# rust-toolchain.toml
[toolchain]
channel = "1.78.0"
components = ["rustfmt", "clippy", "rust-analyzer", "rust-src"]
targets = ["x86_64-unknown-linux-musl", "wasm32-unknown-unknown"]
profile = "default"
```

---

## 2. Detailed Cargo.toml configuration

### Code example 1: A fully featured Cargo.toml

```toml
[package]
name = "my-awesome-lib"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"
authors = ["Your Name <you@example.com>"]
description = "A short description of the library"
license = "MIT OR Apache-2.0"
repository = "https://github.com/user/my-awesome-lib"
documentation = "https://docs.rs/my-awesome-lib"
readme = "README.md"
keywords = ["async", "web", "http"]
categories = ["web-programming"]
exclude = ["tests/fixtures/**", ".github/**"]

[lib]
# Crate types (multiple values allowed)
# crate-type = ["lib", "cdylib"]

[dependencies]
# Ways to specify versions
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"], optional = true }
log = "0.4"

# From a Git repository
# my-dep = { git = "https://github.com/user/repo", branch = "main" }

# From a local path (during development)
# my-local = { path = "../my-local" }

[dev-dependencies]
# Used only for tests and benchmarks
tokio = { version = "1", features = ["full", "test-util"] }
criterion = { version = "0.5", features = ["html_reports"] }
tempfile = "3"

[build-dependencies]
# Used only by build.rs
cc = "1"

[features]
default = ["json"]
json = ["serde/derive"]
async = ["dep:tokio"]
full = ["json", "async"]

# Profile settings
[profile.dev]
opt-level = 0
debug = true

[profile.release]
opt-level = 3
lto = "thin"          # Link-time optimization
strip = true           # Strip debug information
codegen-units = 1      # Maximum optimization (slow build)
panic = "abort"        # Terminate immediately on panic

[profile.bench]
inherits = "release"
debug = true           # For benchmark profiling
```

### 2.1 Detailed ways to specify dependencies

```toml
[dependencies]
# Basic version specification
serde = "1.0"                           # Equivalent to ^1.0.0
serde_json = "1.0.100"                  # ^1.0.100

# Strict version specification
pin-project = "=1.1.3"                  # Exact match

# Version ranges
rand = ">=0.8, <0.9"                    # Range specification

# Tilde requirement (pin the minor version)
semver = "~1.0.4"                       # >=1.0.4, <1.1.0

# Wildcard
uuid = "1.*"                            # >=1.0.0, <2.0.0

# Dependencies from a Git repository
my-lib = { git = "https://github.com/user/repo" }
my-lib-branch = { git = "https://github.com/user/repo", branch = "develop" }
my-lib-tag = { git = "https://github.com/user/repo", tag = "v1.0.0" }
my-lib-rev = { git = "https://github.com/user/repo", rev = "abc1234" }

# Dependencies from a local path (during development)
my-local = { path = "../my-local-crate" }

# Both path and version specified (path is ignored when publishing)
my-lib = { path = "../my-lib", version = "0.1.0" }

# Platform-specific dependencies
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.52", features = ["Win32_Foundation"] }

[target.'cfg(unix)'.dependencies]
nix = { version = "0.28", features = ["signal"] }

[target.'cfg(target_arch = "wasm32")'.dependencies]
wasm-bindgen = "0.2"
web-sys = { version = "0.3", features = ["Window", "Document"] }
```

### 2.2 Package metadata details

```toml
[package]
name = "my-crate"
version = "1.2.3"
edition = "2021"                    # 2015, 2018, 2021, 2024
rust-version = "1.75"              # MSRV (minimum supported version)

# Author information
authors = ["Alice <alice@example.com>", "Bob <bob@example.com>"]
description = "A brief description for crates.io"
license = "MIT OR Apache-2.0"      # SPDX expression
license-file = "LICENSE"            # Custom license file

# Links
homepage = "https://my-crate.example.com"
repository = "https://github.com/user/my-crate"
documentation = "https://docs.rs/my-crate"
readme = "README.md"

# Classification
keywords = ["parser", "json", "serialization"]   # Up to 5 entries
categories = ["encoding", "parser-implementations"]

# Publish control
publish = true                      # Set to false to forbid publishing
# publish = ["my-private-registry"]  # Publish only to a specific registry

# File control
include = ["src/**/*", "Cargo.toml", "LICENSE*", "README.md"]
# exclude = ["tests/fixtures/**", ".github/**"]

# Binary definitions
name = "my-tool"
path = "src/bin/tool.rs"
required-features = ["cli"]         # Build only when this feature is enabled

name = "my-server"
path = "src/bin/server.rs"
required-features = ["server"]

# Library definition
[lib]
name = "my_crate"                   # Hyphens are converted to underscores
crate-type = ["lib"]
path = "src/lib.rs"
doc = true                          # Subject to documentation generation
doctest = true                      # Documentation tests enabled
test = true                         # Subject to testing
```

### Code example 2: Build script (build.rs)

```rust
// build.rs
use std::process::Command;

fn main() {
    // Set the Git commit hash as an environment variable
    let output = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .expect("git command failed");
    let git_hash = String::from_utf8(output.stdout).unwrap();
    println!("cargo:rustc-env=GIT_HASH={}", git_hash.trim());

    // Build timestamp
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC");
    println!("cargo:rustc-env=BUILD_TIME={}", now);

    // Conditional compilation flags
    if cfg!(target_os = "linux") {
        println!("cargo:rustc-cfg=has_epoll");
    }

    // Re-run conditions
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/schema.sql");
}

// Usage in src/main.rs:
// const GIT_HASH: &str = env!("GIT_HASH");
// const BUILD_TIME: &str = env!("BUILD_TIME");
```

### 2.3 Advanced build scripts

```rust
// build.rs — Advanced example including linking with a C library and code generation
use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let target = env::var("TARGET").unwrap();
    let profile = env::var("PROFILE").unwrap();

    // --- 1. Compile a C/C++ library ---
    cc::Build::new()
        .file("native/crypto.c")
        .file("native/hash.c")
        .include("native/include")
        .flag_if_supported("-Wall")
        .flag_if_supported("-Wextra")
        .opt_level(if profile == "release" { 3 } else { 0 })
        .compile("native_crypto");

    // --- 2. Link the native library ---
    println!("cargo:rustc-link-lib=static=native_crypto");
    println!("cargo:rustc-link-search=native={}", out_dir.display());

    // Link system libraries (platform dependent)
    if target.contains("linux") {
        println!("cargo:rustc-link-lib=dylib=ssl");
        println!("cargo:rustc-link-lib=dylib=crypto");
    } else if target.contains("apple") {
        println!("cargo:rustc-link-lib=framework=Security");
    }

    // --- 3. protobuf code generation ---
    let proto_files = &["proto/api.proto", "proto/models.proto"];
    let proto_include = &["proto/"];

    prost_build::Config::new()
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .out_dir(&out_dir)
        .compile_protos(proto_files, proto_include)
        .expect("protobuf compilation failed");

    // --- 4. Generate a version information file ---
    let version_info = format!(
        r#"
        pub const VERSION: &str = "{}";
        pub const TARGET: &str = "{}";
        pub const PROFILE: &str = "{}";
        pub const GIT_HASH: &str = "{}";
        "#,
        env::var("CARGO_PKG_VERSION").unwrap(),
        target,
        profile,
        get_git_hash(),
    );
    fs::write(out_dir.join("version_info.rs"), version_info).unwrap();

    // --- 5. Re-run triggers ---
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=native/");
    println!("cargo:rerun-if-changed=proto/");
    // Also watch for environment variable changes
    println!("cargo:rerun-if-env-changed=DATABASE_URL");
}

fn get_git_hash() -> String {
    std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}
```

```rust
// Usage in src/lib.rs
// Include the code generated by build.rs
include!(concat!(env!("OUT_DIR"), "/version_info.rs"));

// Include code generated by protobuf
pub mod api {
    include!(concat!(env!("OUT_DIR"), "/api.rs"));
}

pub mod models {
    include!(concat!(env!("OUT_DIR"), "/models.rs"));
}
```

### 2.4 Reference list of Cargo build script output instructions

```rust
// List of cargo: instructions usable in build.rs

fn main() {
    // --- Linking related ---
    // Link a native library
    println!("cargo:rustc-link-lib=static=mylib");      // Static linking
    println!("cargo:rustc-link-lib=dylib=ssl");          // Dynamic linking
    println!("cargo:rustc-link-lib=framework=Security"); // macOS framework

    // Library search paths
    println!("cargo:rustc-link-search=native=/usr/local/lib");
    println!("cargo:rustc-link-search=all=/opt/lib");

    // --- Compiler flags ---
    // Set as an environment variable (retrievable via env!())
    println!("cargo:rustc-env=MY_VAR=my_value");

    // Conditional compilation cfg
    println!("cargo:rustc-cfg=my_feature");
    println!("cargo:rustc-cfg=my_key=\"my_value\"");

    // Compiler flags
    println!("cargo:rustc-flags=-l dylib=foo");
    println!("cargo:rustc-cdylib-link-arg=-Wl,-rpath,/usr/local/lib");

    // --- Re-run control ---
    // Re-run on file change
    println!("cargo:rerun-if-changed=src/schema.sql");
    println!("cargo:rerun-if-changed=native/");

    // Re-run on environment variable change
    println!("cargo:rerun-if-env-changed=DATABASE_URL");

    // --- Metadata ---
    // Referenceable as DEP_<name>_<key> from another crate's build.rs
    println!("cargo:metadata=key=value");

    // --- Warnings ---
    println!("cargo:warning=This is a build warning");
}
```

---

## 3. Workspaces

### Code example 3: Workspace structure

```toml
# Cargo.toml (root)
[workspace]
members = [
    "crates/core",
    "crates/cli",
    "crates/server",
    "crates/macros",
]
resolver = "2"

# Unify dependency versions across the entire workspace
[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
anyhow = "1"
tracing = "0.1"

# Shared package metadata for the workspace
[workspace.package]
version = "0.1.0"
edition = "2021"
license = "MIT"
repository = "https://github.com/user/project"
```

```toml
# crates/core/Cargo.toml
[package]
name = "project-core"
version.workspace = true
edition.workspace = true

[dependencies]
serde.workspace = true
anyhow.workspace = true
```

```toml
# crates/cli/Cargo.toml
[package]
name = "project-cli"
version.workspace = true
edition.workspace = true

[dependencies]
project-core = { path = "../core" }
tokio.workspace = true
clap = { version = "4", features = ["derive"] }
```

### Workspace dependencies

```
┌──────────── Workspace dependency graph ────────────┐
│                                                     │
│  project-cli                project-server          │
│    │                          │                     │
│    ├── project-core          ├── project-core      │
│    ├── clap                  ├── axum              │
│    └── tokio                 └── tokio              │
│                                                     │
│  project-core                                       │
│    ├── serde                                        │
│    └── anyhow                                       │
│                                                     │
│  project-macros (proc-macro)                        │
│    ├── syn                                          │
│    ├── quote                                        │
│    └── proc-macro2                                  │
│                                                     │
│  Commands:                                          │
│  $ cargo build -p project-cli    # Specific crate   │
│  $ cargo test --workspace        # Run all tests    │
│  $ cargo doc --workspace         # All docs         │
└─────────────────────────────────────────────────────┘
```

### 3.1 Practical workspace design patterns

#### Pattern 1: Web application layout

```
web-platform/
├── Cargo.toml                 # Workspace root
├── crates/
│   ├── domain/                # Domain models (minimal external dependencies)
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── repository/            # Data access layer
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── usecase/               # Business logic
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── api/                   # HTTP API server
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs
│   │       ├── routes/
│   │       └── middleware/
│   ├── worker/                # Background jobs
│   │   ├── Cargo.toml
│   │   └── src/main.rs
│   ├── migration/             # DB migrations
│   │   ├── Cargo.toml
│   │   └── src/main.rs
│   └── shared/                # Common utilities
│       ├── Cargo.toml
│       └── src/lib.rs
└── xtask/                     # Build task runner
    ├── Cargo.toml
    └── src/main.rs
```

```toml
# Cargo.toml (root)
[workspace]
members = [
    "crates/domain",
    "crates/repository",
    "crates/usecase",
    "crates/api",
    "crates/worker",
    "crates/migration",
    "crates/shared",
    "xtask",
]
resolver = "2"

[workspace.dependencies]
# Domain layer
serde = { version = "1", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }

# Infrastructure layer
sqlx = { version = "0.7", features = ["runtime-tokio", "postgres", "chrono", "uuid"] }
redis = { version = "0.25", features = ["tokio-comp"] }

# Web layer
axum = { version = "0.7", features = ["macros"] }
tower = { version = "0.4", features = ["full"] }
tower-http = { version = "0.5", features = ["cors", "trace", "compression-gzip"] }
tokio = { version = "1", features = ["full"] }

# Cross-cutting concerns
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
anyhow = "1"
thiserror = "1"
config = "0.14"

# Testing
wiremock = "0.6"
testcontainers = "0.15"

# Internal to the workspace
platform-domain = { path = "crates/domain" }
platform-repository = { path = "crates/repository" }
platform-usecase = { path = "crates/usecase" }
platform-shared = { path = "crates/shared" }
```

```toml
# crates/domain/Cargo.toml — Keep external dependencies to a minimum
[package]
name = "platform-domain"
version.workspace = true
edition.workspace = true

[dependencies]
serde.workspace = true
chrono.workspace = true
uuid.workspace = true
thiserror.workspace = true
```

```toml
# crates/repository/Cargo.toml — DB access
[package]
name = "platform-repository"
version.workspace = true
edition.workspace = true

[dependencies]
platform-domain.workspace = true
platform-shared.workspace = true
sqlx.workspace = true
redis.workspace = true
tokio.workspace = true
anyhow.workspace = true
tracing.workspace = true

[dev-dependencies]
testcontainers.workspace = true
tokio = { workspace = true, features = ["test-util"] }
```

```toml
# crates/api/Cargo.toml — HTTP server
[package]
name = "platform-api"
version.workspace = true
edition.workspace = true

[dependencies]
platform-domain.workspace = true
platform-repository.workspace = true
platform-usecase.workspace = true
platform-shared.workspace = true
axum.workspace = true
tower.workspace = true
tower-http.workspace = true
tokio.workspace = true
tracing.workspace = true
tracing-subscriber.workspace = true
config.workspace = true
anyhow.workspace = true

[dev-dependencies]
wiremock.workspace = true
reqwest = { version = "0.12", features = ["json"] }
```

#### Pattern 2: The xtask pattern (build task runner)

```toml
# xtask/Cargo.toml
[package]
name = "xtask"
version = "0.1.0"
edition = "2021"
publish = false    # Do not publish

[dependencies]
clap = { version = "4", features = ["derive"] }
xshell = "0.2"
anyhow = "1"
```

```rust
// xtask/src/main.rs
use clap::{Parser, Subcommand};
use xshell::{cmd, Shell};
use anyhow::Result;

#[derive(Parser)]
#[command(name = "xtask")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run all checks (for CI)
    Ci,
    /// Run database migrations
    Migrate,
    /// Build a Docker image
    Docker {
        #[arg(long, default_value = "latest")]
        tag: String,
    },
    /// Prepare a release
    Release {
        #[arg(long)]
        version: String,
    },
    /// Measure code coverage
    Coverage,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let sh = Shell::new()?;

    match cli.command {
        Commands::Ci => {
            // Format check
            cmd!(sh, "cargo fmt --all -- --check").run()?;
            // Clippy
            cmd!(sh, "cargo clippy --workspace --all-targets --all-features -- -D warnings").run()?;
            // Tests
            cmd!(sh, "cargo test --workspace --all-features").run()?;
            // Documentation tests
            cmd!(sh, "cargo doc --workspace --no-deps").run()?;
            println!("CI checks passed!");
        }
        Commands::Migrate => {
            cmd!(sh, "cargo run -p platform-migration").run()?;
        }
        Commands::Docker { tag } => {
            cmd!(sh, "docker build -t platform-api:{tag} -f docker/Dockerfile .").run()?;
        }
        Commands::Release { version } => {
            // Bump version, create a tag, and publish
            println!("Releasing version {version}...");
            cmd!(sh, "cargo set-version --workspace {version}").run()?;
            cmd!(sh, "cargo check --workspace").run()?;
            cmd!(sh, "git add -A").run()?;
            cmd!(sh, "git commit -m 'Release v{version}'").run()?;
            cmd!(sh, "git tag v{version}").run()?;
        }
        Commands::Coverage => {
            cmd!(sh, "cargo llvm-cov --workspace --html").run()?;
            println!("Coverage report generated in target/llvm-cov/html/");
        }
    }

    Ok(())
}
```

```toml
# Configure an alias in .cargo/config.toml
[alias]
xtask = "run --package xtask --"
```

```bash
# Examples
cargo xtask ci          # Run CI checks
cargo xtask migrate     # Migrations
cargo xtask docker --tag v1.0.0  # Docker build
cargo xtask release --version 1.0.0  # Release
cargo xtask coverage    # Measure coverage
```

### 3.2 Workspace exclude and default-members

```toml
[workspace]
members = [
    "crates/*",
    "xtask",
]
# Exclude from workspace members
exclude = [
    "crates/experimental",
    "tools/standalone",
]
# Default targets when running cargo build
default-members = [
    "crates/api",
    "crates/worker",
]
resolver = "2"
```

### 3.3 Inter-crate dependency rules within a workspace

```
┌─────────────────────────────────────────────────────────┐
│         Direction of dependencies (only allowed arrows)  │
│                                                          │
│   api ──────┐                                            │
│   worker ───┤                                            │
│             ▼                                            │
│          usecase ──► domain                              │
│             │           ▲                                │
│             ▼           │                                │
│         repository ─────┘                                │
│                                                          │
│   Rules:                                                 │
│   ✓ Upper layers may depend on lower layers              │
│   ✗ Lower layers must not depend on upper layers         │
│     (no circular dependencies)                           │
│   ✓ domain keeps external crate dependencies minimal     │
│   ✓ shared can be referenced from any layer              │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Feature flags

### Code example 4: Implementing feature flags

```rust
// Cargo.toml
// [features]
// default = ["json"]
// json = ["dep:serde_json"]
// yaml = ["dep:serde_yaml"]
// toml-support = ["dep:toml"]
// async = ["dep:tokio"]
// full = ["json", "yaml", "toml-support", "async"]

// src/lib.rs

/// JSON support (only enabled when feature = "json")
#[cfg(feature = "json")]
pub mod json {
    use serde::{Serialize, de::DeserializeOwned};

    pub fn to_string<T: Serialize>(value: &T) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(value)
    }

    pub fn from_str<T: DeserializeOwned>(s: &str) -> Result<T, serde_json::Error> {
        serde_json::from_str(s)
    }
}

/// YAML support
#[cfg(feature = "yaml")]
pub mod yaml {
    use serde::{Serialize, de::DeserializeOwned};

    pub fn to_string<T: Serialize>(value: &T) -> Result<String, serde_yaml::Error> {
        serde_yaml::to_string(value)
    }
}

/// Asynchronous client (only when feature = "async")
#[cfg(feature = "async")]
pub mod async_client {
    pub struct Client {
        inner: tokio::sync::RwLock<Vec<String>>,
    }

    impl Client {
        pub fn new() -> Self {
            Client {
                inner: tokio::sync::RwLock::new(Vec::new()),
            }
        }
    }
}

// Switch code at compile time based on which features are enabled
pub fn available_formats() -> Vec<&'static str> {
    let mut formats = Vec::new();

    #[cfg(feature = "json")]
    formats.push("json");

    #[cfg(feature = "yaml")]
    formats.push("yaml");

    #[cfg(feature = "toml-support")]
    formats.push("toml");

    formats
}
```

### 4.1 Advanced feature flag patterns

```toml
# Cargo.toml — Practical feature design
[features]
default = ["std", "json"]

# Foundational features
std = ["alloc", "serde/std", "chrono/std"]
alloc = []

# Format features
json = ["dep:serde_json"]
yaml = ["dep:serde_yaml"]
toml-support = ["dep:toml"]
msgpack = ["dep:rmp-serde"]

# Runtime features
async-tokio = ["dep:tokio", "dep:tokio-stream"]
async-async-std = ["dep:async-std"]

# Database features
postgres = ["dep:sqlx", "sqlx/postgres"]
mysql = ["dep:sqlx", "sqlx/mysql"]
sqlite = ["dep:sqlx", "sqlx/sqlite"]

# TLS features
native-tls = ["dep:native-tls"]
rustls = ["dep:rustls", "dep:webpki-roots"]

# Meta features
full = [
    "std", "json", "yaml", "toml-support", "msgpack",
    "async-tokio", "postgres", "mysql", "sqlite",
    "rustls",
]

# Internal features (not used directly by users)
__internal_bench = []

[dependencies]
serde = { version = "1", default-features = false, features = ["derive"] }
chrono = { version = "0.4", default-features = false, optional = false }

serde_json = { version = "1", optional = true }
serde_yaml = { version = "0.9", optional = true }
toml = { version = "0.8", optional = true }
rmp-serde = { version = "1", optional = true }

tokio = { version = "1", features = ["full"], optional = true }
tokio-stream = { version = "0.1", optional = true }
async-std = { version = "1", optional = true }

sqlx = { version = "0.7", optional = true, default-features = false, features = ["runtime-tokio"] }

native-tls = { version = "0.2", optional = true }
rustls = { version = "0.23", optional = true }
webpki-roots = { version = "0.26", optional = true }
```

```rust
// src/lib.rs — Conditional compilation leveraging feature flags

// Gradual std/alloc support
#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(feature = "alloc")]
extern crate alloc;

#[cfg(feature = "alloc")]
use alloc::{string::String, vec::Vec};

// Combination of multiple features
#[cfg(all(feature = "json", feature = "async-tokio"))]
pub mod async_json {
    use serde::{Serialize, de::DeserializeOwned};
    use tokio::io::{AsyncRead, AsyncReadExt};

    pub async fn from_reader<T, R>(reader: &mut R) -> Result<T, Box<dyn std::error::Error>>
    where
        T: DeserializeOwned,
        R: AsyncRead + Unpin,
    {
        let mut buf = Vec::new();
        reader.read_to_end(&mut buf).await?;
        let value = serde_json::from_slice(&buf)?;
        Ok(value)
    }
}

// When any of the listed features is enabled
#[cfg(any(feature = "postgres", feature = "mysql", feature = "sqlite"))]
pub mod database {
    pub fn is_database_enabled() -> bool {
        true
    }

    #[cfg(feature = "postgres")]
    pub mod postgres {
        pub fn connection_string_prefix() -> &'static str {
            "postgres://"
        }
    }
}

// Fallback when a feature is disabled
#[cfg(not(any(feature = "native-tls", feature = "rustls")))]
compile_error!("Either 'native-tls' or 'rustls' feature must be enabled");

// Verifying features in tests
#[cfg(test)]
mod tests {
    #[test]
    fn test_available_features() {
        let features = crate::available_formats();

        #[cfg(feature = "json")]
        assert!(features.contains(&"json"));

        #[cfg(not(feature = "json"))]
        assert!(!features.contains(&"json"));
    }
}
```

### 4.2 Caveats for features and details on cfg attributes

```rust
// Various ways to use cfg attributes

// --- Platform detection ---
#[cfg(target_os = "linux")]
fn platform_specific() -> &'static str { "Linux" }

#[cfg(target_os = "macos")]
fn platform_specific() -> &'static str { "macOS" }

#[cfg(target_os = "windows")]
fn platform_specific() -> &'static str { "Windows" }

// --- Architecture detection ---
#[cfg(target_arch = "x86_64")]
fn simd_operation(data: &[f32]) -> f32 {
    // Optimization using SSE/AVX instructions
    data.iter().sum()
}

#[cfg(target_arch = "aarch64")]
fn simd_operation(data: &[f32]) -> f32 {
    // Optimization using NEON instructions
    data.iter().sum()
}

// --- cfg_attr: conditional attributes ---
// derive only when the serde feature is enabled
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Debug, Clone)]
pub struct Config {
    pub name: String,
    pub value: i32,
}

// Force inlining in release builds
#[cfg_attr(not(debug_assertions), inline(always))]
fn hot_path(x: i32) -> i32 {
    x * 2 + 1
}

// --- The cfg! macro (compile-time, not runtime, evaluation) ---
fn log_platform() {
    if cfg!(target_os = "linux") {
        println!("Running on Linux");
    } else if cfg!(target_os = "macos") {
        println!("Running on macOS");
    }
    // Note: although it looks like an if statement, it is determined at compile time
    // The compiler eliminates unreachable branches
}
```

### Code example 5: Publishing to crates.io

```bash
# 1. Pre-publish check
cargo publish --dry-run

# 2. Verify documentation
cargo doc --open

# 3. Verify package contents
cargo package --list

# 4. Publish (a crates.io account and token are required)
cargo login  # First time only
cargo publish

# For a workspace, publish individually (mind the dependency order)
cargo publish -p project-core
cargo publish -p project-macros
cargo publish -p project-cli
```

```rust
// Versioning rules (SemVer)
// MAJOR.MINOR.PATCH
//
// PATCH: bug fixes (backward compatible)
//   0.1.0 → 0.1.1
//
// MINOR: feature additions (backward compatible)
//   0.1.0 → 0.2.0
//
// MAJOR: breaking changes
//   0.x.y → 1.0.0  (every change in 0.x is treated as breaking)
//   1.0.0 → 2.0.0

// Meaning of dependency version specifiers:
// "1.0"     → >=1.0.0 && <2.0.0
// "1.2.3"   → >=1.2.3 && <2.0.0
// "~1.2.3"  → >=1.2.3 && <1.3.0
// "=1.2.3"  → 1.2.3 only
// ">=1, <2" → range specifier
```

### 4.3 Pre-publish checklist and automation

```bash
# --- Comprehensive pre-publish checks ---

# 1. Compilation check (every feature combination)
cargo check --all-features
cargo check --no-default-features
cargo check --features "json"
cargo check --features "yaml"

# 2. Tests
cargo test --all-features
cargo test --no-default-features

# 3. Clippy
cargo clippy --all-features -- -D warnings

# 4. Formatting
cargo fmt --check

# 5. Documentation (detect broken links)
RUSTDOCFLAGS="-D warnings" cargo doc --all-features --no-deps

# 6. Minimum supported version (MSRV) check
cargo +1.75.0 check --all-features

# 7. Security audit
cargo audit
cargo deny check

# 8. License check
cargo deny check licenses

# 9. Package size verification
cargo package --list | wc -l
du -sh target/package/

# 10. Dry run
cargo publish --dry-run
```

```rust
// Automated publish script (xtask)
// xtask/src/publish.rs
use xshell::{cmd, Shell};
use anyhow::Result;

pub fn publish_workspace(sh: &Shell, dry_run: bool) -> Result<()> {
    // Publish order (in dependency order)
    let publish_order = vec![
        "project-core",
        "project-macros",
        "project-shared",
        "project-repository",
        "project-usecase",
        "project-cli",
        "project-api",
    ];

    for crate_name in &publish_order {
        println!("Publishing {}...", crate_name);

        if dry_run {
            cmd!(sh, "cargo publish -p {crate_name} --dry-run").run()?;
        } else {
            cmd!(sh, "cargo publish -p {crate_name}").run()?;
            // Wait for the crates.io index to update
            std::thread::sleep(std::time::Duration::from_secs(30));
        }
    }

    Ok(())
}
```

---

## 5. Profile configuration in detail

### 5.1 Detailed comparison of profiles

```toml
# --- Development profile ---
[profile.dev]
opt-level = 0          # No optimization (fast build)
debug = true           # Full debug information
debug-assertions = true # debug_assert!() enabled
overflow-checks = true  # Integer overflow checks
lto = false            # LTO disabled
codegen-units = 256    # Parallel compilation (fast build)
incremental = true     # Incremental compilation
panic = "unwind"       # Stack unwinding on panic
strip = "none"         # No symbol stripping
split-debuginfo = "packed"  # How debug information is stored

# --- Release profile ---
[profile.release]
opt-level = 3          # Maximum optimization
debug = false          # No debug information
debug-assertions = false
overflow-checks = false
lto = "thin"           # Thin LTO (good balance)
codegen-units = 1      # Single codegen unit (maximum optimization)
incremental = false    # Incremental disabled
panic = "abort"        # Terminate immediately on panic (smaller binary)
strip = true           # Strip symbols

# --- Benchmark profile (inherits release) ---
[profile.bench]
inherits = "release"
debug = true           # Keep debug info for profiling

# --- Custom profile: production deployment ---
[profile.production]
inherits = "release"
lto = "fat"            # Fat LTO (maximum optimization, very slow build)
codegen-units = 1
strip = true
panic = "abort"

# --- Custom profile: development with light optimization ---
[profile.dev-fast]
inherits = "dev"
opt-level = 1          # Minimal optimization (mainly to avoid generic bloat)
debug = true

# --- Optimize only dependencies (keep your own code building fast) ---
[profile.dev.package."*"]
opt-level = 2          # Optimize dependencies (improves runtime)

# Optimize specific dependencies
[profile.dev.package.sqlx]
opt-level = 3

[profile.dev.package.image]
opt-level = 3
```

### 5.2 Binary size optimization

```toml
# Profile aiming for minimum binary size
[profile.min-size]
inherits = "release"
opt-level = "z"        # Optimize for size ("s" also works)
lto = "fat"
codegen-units = 1
panic = "abort"
strip = true

# Use default-features = false in [dependencies] of Cargo.toml
# Exclude unused features to reduce binary size
```

```bash
# Verifying and analyzing binary size
cargo build --release
ls -la target/release/my-app

# Size analysis with cargo-bloat
cargo install cargo-bloat
cargo bloat --release -n 20          # Top 20 largest functions
cargo bloat --release --crates       # Size by crate

# Detailed analysis with twiggy
cargo install twiggy
twiggy top target/release/my-app -n 20
twiggy dominators target/release/my-app
```

---

## 6. The Cargo toolchain

### 6.1 Essential tools

```bash
# --- Formatter ---
rustup component add rustfmt
cargo fmt                          # Run formatting
cargo fmt -- --check               # Check formatting (for CI)
cargo fmt -- --emit files          # Show only changed files

# --- Linter ---
rustup component add clippy
cargo clippy                                           # Basic checks
cargo clippy --all-targets --all-features              # Check everything
cargo clippy -- -D warnings                            # Treat warnings as errors
cargo clippy -- -W clippy::pedantic                    # Stricter checks
cargo clippy --fix                                     # Apply auto-fixes

# --- Security audit ---
cargo install cargo-audit
cargo audit                        # Vulnerability check
cargo audit fix                    # Auto-fix

# --- Dependency license / policy checks ---
cargo install cargo-deny
cargo deny init                    # Generate deny.toml
cargo deny check                   # All checks
cargo deny check licenses          # Licenses only
cargo deny check bans              # Banned crate check
cargo deny check advisories        # Security advisories

# --- Updating dependencies ---
cargo install cargo-edit
cargo upgrade                      # Update dependencies to the latest
cargo upgrade --incompatible       # Include breaking updates
cargo add serde --features derive  # Add a dependency

# --- Detecting unused dependencies ---
cargo install cargo-machete
cargo machete                      # Detect unused crates

# --- Build time analysis ---
cargo install cargo-timings
cargo build --timings              # Detailed build timing report

# --- Code coverage ---
cargo install cargo-llvm-cov
cargo llvm-cov                     # Measure test coverage
cargo llvm-cov --html              # HTML report
cargo llvm-cov --lcov              # LCOV format

# --- Cross-compilation ---
cargo install cross
cross build --target x86_64-unknown-linux-musl
cross build --target aarch64-unknown-linux-gnu

# --- Documentation ---
cargo doc --all-features --no-deps --open
```

### 6.2 rustfmt.toml configuration

```toml
# rustfmt.toml
edition = "2021"
max_width = 100
tab_spaces = 4
use_small_heuristics = "Default"
newline_style = "Unix"

# Imports
imports_granularity = "Crate"
group_imports = "StdExternalCrate"
reorder_imports = true

# Functions
fn_params_layout = "Tall"
fn_single_line = false

# Structs
struct_lit_single_line = true
struct_variant_force_align = false

# Comments
normalize_comments = false
normalize_doc_attributes = false
wrap_comments = false

# Other
format_code_in_doc_comments = true
format_macro_matchers = true
use_field_init_shorthand = true
use_try_shorthand = true
```

### 6.3 clippy.toml configuration

```toml
# clippy.toml
# Project-specific Clippy configuration

# Upper bound on cognitive complexity per function
cognitive-complexity-threshold = 25

# Upper bound on the number of enum variants
enum-variant-size-threshold = 200

# Maximum type size on the stack (bytes)
too-large-for-stack = 200

# Modules where wildcard imports are allowed
allowed-wildcard-imports = ["prelude"]

# Specify the MSRV
msrv = "1.75.0"

# Maximum length of type names
type-complexity-threshold = 250
```

```rust
// Using Clippy attributes

// Allow specific warnings across the whole file
#![allow(clippy::module_inception)]

// Allow at the function level
#[allow(clippy::too_many_arguments)]
fn complex_function(a: i32, b: i32, c: i32, d: i32, e: i32, f: i32, g: i32) {
    // ...
}

// Allow at the struct level
#[allow(clippy::large_enum_variant)]
enum Message {
    Small(u8),
    Large([u8; 1024]),
}

// Strict mode (enable pedantic lints)
#![warn(clippy::pedantic)]
// Exclude specific pedantic lints
#![allow(clippy::must_use_candidate)]
#![allow(clippy::missing_errors_doc)]

// Restriction lints (must be enabled explicitly)
#![warn(clippy::dbg_macro)]        // Warn on use of dbg!
#![warn(clippy::print_stdout)]     // Warn on use of println!
#![warn(clippy::unwrap_used)]      // Warn on use of unwrap()
```

### 6.4 cargo-deny configuration

```toml
# deny.toml

[graph]
targets = [
    { triple = "x86_64-unknown-linux-gnu" },
    { triple = "aarch64-apple-darwin" },
    { triple = "x86_64-pc-windows-msvc" },
]

[advisories]
vulnerability = "deny"
unmaintained = "warn"
yanked = "deny"
notice = "warn"
ignore = []

[licenses]
unlicensed = "deny"
allow = [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Unicode-DFS-2016",
    "Zlib",
]
deny = [
    "GPL-2.0",
    "GPL-3.0",
    "AGPL-3.0",
]
copyleft = "warn"

name = "ring"
expression = "MIT AND ISC AND OpenSSL"
license-files = [{ path = "LICENSE", hash = 0xbd0eed23 }]

[bans]
multiple-versions = "warn"
wildcards = "deny"
highlight = "all"

# Ban specific crates
deny = [
    { name = "openssl" },  # Policy: use rustls instead
]

# Allow duplication for specific crates
skip = [
    { name = "syn", version = "1" },  # syn v1 and v2 coexist due to proc-macros
]

[sources]
unknown-registry = "deny"
unknown-git = "warn"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
allow-git = []
```

---

## 7. CI/CD integration

### 7.1 GitHub Actions configuration

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1
  RUSTFLAGS: "-D warnings"

jobs:
  check:
    name: Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - uses: Swatinem/rust-cache@v2

      - name: Format check
        run: cargo fmt --all -- --check

      - name: Clippy
        run: cargo clippy --workspace --all-targets --all-features

      - name: Build
        run: cargo build --workspace --all-features

  test:
    name: Test
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        rust: [stable, "1.75.0"]  # stable + MSRV
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@master
        with:
          toolchain: ${{ matrix.rust }}
      - uses: Swatinem/rust-cache@v2

      - name: Test (default features)
        run: cargo test --workspace

      - name: Test (all features)
        run: cargo test --workspace --all-features

      - name: Test (no default features)
        run: cargo test --workspace --no-default-features

  coverage:
    name: Coverage
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: llvm-tools-preview
      - uses: Swatinem/rust-cache@v2
      - uses: taiki-e/install-action@cargo-llvm-cov

      - name: Generate coverage
        run: cargo llvm-cov --workspace --all-features --lcov --output-path lcov.info

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: lcov.info

  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rustsec/audit-check@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

  deny:
    name: Dependency Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: EmbarkStudios/cargo-deny-action@v1
        with:
          command: check
          arguments: --all-features

  publish:
    name: Publish
    needs: [check, test, security, deny]
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Publish to crates.io
        run: |
          cargo publish -p project-core
          sleep 30
          cargo publish -p project-macros
          sleep 30
          cargo publish -p project-cli
        env:
          CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}
```

### 7.2 Docker multi-stage build

```dockerfile
# Dockerfile — Rust multi-stage build
# Stage 1: build
FROM rust:1.78-slim-bookworm AS builder

WORKDIR /app

# Dependency cache layer (avoid rebuilding when source changes)
COPY Cargo.toml Cargo.lock ./
COPY crates/core/Cargo.toml crates/core/Cargo.toml
COPY crates/api/Cargo.toml crates/api/Cargo.toml
# Create cache layer with dummy sources
RUN mkdir -p crates/core/src && echo "pub fn dummy() {}" > crates/core/src/lib.rs && \
    mkdir -p crates/api/src && echo "fn main() {}" > crates/api/src/main.rs && \
    cargo build --release -p platform-api && \
    rm -rf crates/

# Copy real sources and build
COPY . .
RUN touch crates/core/src/lib.rs crates/api/src/main.rs && \
    cargo build --release -p platform-api

# Stage 2: runtime
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/platform-api /usr/local/bin/
EXPOSE 8080
CMD ["platform-api"]
```

---

## 8. Comparison tables

### Crate type comparison

| crate-type | Output | Use case |
|---|---|---|
| `lib` | rlib | Standard Rust library (default) |
| `bin` | Executable | CLI apps and servers |
| `cdylib` | .so / .dylib / .dll | Shared library for FFI |
| `staticlib` | .a / .lib | Static linking into C/C++ |
| `dylib` | .so / .dylib | Dynamic linking between Rust crates (rare) |
| `proc-macro` | Compiler plugin | derive / attribute macros |

### Profile comparison

| Setting | dev | release | Effect |
|---|---|---|---|
| opt-level | 0 | 3 | Optimization level (0 = none, 3 = maximum) |
| debug | true | false | Whether debug info is included |
| lto | false | "thin" | Link-time optimization |
| codegen-units | 256 | 1 | Number of parallel codegen units |
| strip | false | true | Whether symbols are stripped |
| panic | "unwind" | "abort" | Behavior on panic |

### Comparison of version specifier syntax

| Syntax | Example | Meaning | Use case |
|---|---|---|---|
| Caret (default) | `"1.2.3"` | `>=1.2.3, <2.0.0` | Typical use |
| Tilde | `"~1.2.3"` | `>=1.2.3, <1.3.0` | Allow only patch updates |
| Exact | `"=1.2.3"` | `1.2.3` only | Strict version pinning |
| Wildcard | `"1.*"` | `>=1.0.0, <2.0.0` | Pin only the major version |
| Range | `">=1.2, <1.5"` | `>=1.2.0, <1.5.0` | Fine-grained range |
| Compound | `">=1.2, <2"` | `>=1.2.0, <2.0.0` | Specify a minimum version |

### List of Cargo commands

| Command | Description | Common flags |
|---|---|---|
| `cargo new` | Create a project | `--lib`, `--name` |
| `cargo init` | Initialize an existing directory | `--lib` |
| `cargo build` | Build | `--release`, `-p <crate>` |
| `cargo run` | Build & run | `--release`, `--bin <name>` |
| `cargo test` | Run tests | `--workspace`, `--lib`, `--doc` |
| `cargo bench` | Run benchmarks | `-p <crate>` |
| `cargo check` | Compile check (no binary output) | `--all-features` |
| `cargo clippy` | Lint | `-- -D warnings` |
| `cargo fmt` | Format | `--check` |
| `cargo doc` | Generate documentation | `--open`, `--no-deps` |
| `cargo publish` | Publish to crates.io | `--dry-run`, `-p <crate>` |
| `cargo update` | Update Cargo.lock | `-p <crate>` |
| `cargo tree` | Display dependency tree | `--duplicates`, `-i <crate>` |
| `cargo clean` | Remove build artifacts | `-p <crate>` |
| `cargo vendor` | Copy dependencies locally | |
| `cargo fix` | Auto-fix | `--edition` |

---

## 9. Anti-patterns

### Anti-pattern 1: Tracking Cargo.lock in Git for libraries

```
# NG: Committing Cargo.lock for a library crate
# → Conflicts with consumers' own Cargo.lock

# .gitignore
# For libraries:
Cargo.lock    ← Add to .gitignore for libraries

# OK: For binaries (apps), commit it
# Cargo.lock  ← Apps commit it for reproducible builds
```

### Anti-pattern 2: Overuse of feature flags

```toml
# NG: Feature splits that are too fine-grained
[features]
default = ["std"]
std = []
alloc = []
parse-int = []
parse-float = []
parse-string = []
format-int = []
format-float = []
# → Users cannot tell what to enable

# OK: Split at meaningful granularity
[features]
default = ["std"]
std = ["alloc"]
alloc = []
serde = ["dep:serde"]
async = ["dep:tokio"]
full = ["std", "serde", "async"]
# → default for basic behavior, full for the full feature set
```

### Anti-pattern 3: Circular dependencies

```
# NG: Circular dependency between crates
crate-a → crate-b → crate-a  ← Compile error

# OK: Extract the shared portion
crate-a → crate-common
crate-b → crate-common
```

### Anti-pattern 4: Inconsistent versions across the workspace

```toml
# NG: Different versions in each crate
# crates/a/Cargo.toml
[dependencies]
serde = "1.0.190"

# crates/b/Cargo.toml
[dependencies]
serde = "1.0.195"

# OK: Unify with workspace.dependencies
[workspace.dependencies]
serde = { version = "1.0.195", features = ["derive"] }

# Use workspace = true in each crate
[dependencies]
serde.workspace = true
```

### Anti-pattern 5: `*` wildcard versions

```toml
# NG: Using a wildcard
[dependencies]
serde = "*"                # Any version is OK (dangerous)

# OK: Appropriate version range
[dependencies]
serde = "1"                # ^1.0.0 (SemVer-compatible range)
```

### Anti-pattern 6: Mixing release dependencies into dev-dependencies

```toml
# NG: Test-only dependencies are also pulled into production
[dependencies]
tokio = { version = "1", features = ["full"] }
pretty_assertions = "1"    # Used only for tests but listed under dependencies

# OK: Move test-only deps to dev-dependencies
[dependencies]
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
pretty_assertions = "1"    # Used only in tests/examples
tokio = { version = "1", features = ["test-util"] }  # Extra test-only feature
```

---

## 10. Performance optimization

### 10.1 Reducing build time

```toml
# .cargo/config.toml — Build acceleration settings

# mold linker (Linux)
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

# lld linker (macOS)
[target.aarch64-apple-darwin]
rustflags = ["-C", "link-arg=-fuse-ld=lld"]

# Use sccache (distributed cache)
[build]
rustc-wrapper = "sccache"
```

```bash
# Measuring and analyzing build time
cargo build --timings             # Generate HTML report
# Inspect target/cargo-timings/cargo-timing.html

# Analyze the dependency chain of a specific crate
cargo tree -p heavy-crate --depth 3

# Identify crates with long compile times
cargo build 2>&1 | grep "Compiling" | tail -20
```

### 10.2 Strategies for managing dependencies

```bash
# Analyze the dependency tree
cargo tree                         # Full dependency tree
cargo tree --duplicates            # Show duplicated dependencies
cargo tree -i serde                # Reverse lookup: which crates use serde
cargo tree --depth 1               # Direct dependencies only
cargo tree -e features             # Show feature propagation
cargo tree -f "{p} {f}"            # Show package and features

# Detect unused dependencies
cargo machete

# Check the latest versions of dependencies
cargo outdated                     # Requires cargo-outdated
```

---

## FAQ

### Q1: What is the difference between `cargo update` and `cargo upgrade`?

**A:** `cargo update` updates Cargo.lock to the latest within the range allowed by Cargo.toml (Cargo.toml itself is not modified). `cargo upgrade`, provided by `cargo-edit`, rewrites the version specifications in Cargo.toml to the latest.

```bash
# When Cargo.toml has serde = "1.0.190"
cargo update -p serde    # Updates Cargo.lock to the latest 1.0.x
                          # (Cargo.toml is not modified)

cargo upgrade -p serde   # Rewrites serde in Cargo.toml to the latest version
                          # serde = "1.0.190" → serde = "1.0.210"
```

### Q2: How do I test only part of a workspace?

**A:** Specify the target crate with the `-p` flag.

```bash
cargo test -p project-core          # Test only core
cargo test -p project-cli -- --nocapture  # Test cli (show output)
cargo build -p project-server       # Build only server
cargo clippy -p project-core        # Lint only core
```

### Q3: What is the difference between `optional = true` and `dep:`?

**A:** With `optional = true`, the crate name is implicitly used as the feature name. The `dep:` syntax (Rust 2021+) lets you separate the feature name from the crate name and avoid name collisions.

```toml
# Old way: a feature named tokio is implicitly created
[dependencies]
tokio = { version = "1", optional = true }

# New way: choose the feature name freely
[features]
async-runtime = ["dep:tokio"]

[dependencies]
tokio = { version = "1", optional = true }
```

### Q4: How do I configure a private registry?

**A:** Configure the registry in `.cargo/config.toml` and specify it in `Cargo.toml`.

```toml
# .cargo/config.toml
[registries.my-company]
index = "sparse+https://cargo.my-company.com/index/"

# Cargo.toml
[dependencies]
internal-lib = { version = "1.0", registry = "my-company" }

[package]
publish = ["my-company"]  # Allow publishing only to this registry
```

### Q5: How do I manage MSRV (minimum supported version)?

**A:** Manage it via the `rust-version` field together with CI.

```toml
# Cargo.toml
[package]
rust-version = "1.75"  # Compatibility guaranteed for this Rust version and above

# Check MSRV in CI
# cargo +1.75.0 check --all-features
```

```bash
# Automatically detect the minimum version with cargo-msrv
cargo install cargo-msrv
cargo msrv find              # Detect MSRV automatically
cargo msrv verify            # Verify it works at the specified MSRV
```

### Q6: How do I bulk-update dependencies across the workspace?

**A:** `cargo update` updates the workspace-wide `Cargo.lock`. With `cargo upgrade`, you can also update `workspace.dependencies`.

```bash
# Update Cargo.lock (within the range of Cargo.toml)
cargo update

# Update workspace.dependencies in Cargo.toml to the latest
cargo upgrade --workspace

# Update only specific crates
cargo update -p serde
cargo upgrade -p serde --workspace
```

### Q7: How do I debug build cache issues?

**A:** Use the `CARGO_LOG` environment variable or the `--verbose` flag.

```bash
# Detailed build logs
cargo build -v               # verbose mode
cargo build -vv              # Even more verbose

# Internal Cargo logs
CARGO_LOG=cargo::core::compiler=trace cargo build

# Invalidate the cache (clean build)
cargo clean
cargo build

# Clean only specific crates
cargo clean -p my-crate
```

### Q8: How do I efficiently test combinations of feature flags?

**A:** Use `cargo hack` to automatically test feature combinations.

```bash
# Install cargo-hack
cargo install cargo-hack

# Test every combination of features
cargo hack test --feature-powerset

# Test each feature individually
cargo hack check --each-feature

# Test each feature individually without default features
cargo hack check --each-feature --no-default-features

# Group related features with --group-features
cargo hack check --feature-powerset --group-features json,yaml,toml-support
```

---

## Summary

| Item | Key points |
|---|---|
| Cargo.toml | Package definition, dependencies, features, profiles |
| Cargo.lock | Reproducible builds. Commit for apps, exclude for libraries |
| Workspace | Manage multiple crates via members. Unify dependency versions |
| workspace.dependencies | Centrally manage dependency versions across all crates |
| features | Conditional compilation. The default + full pattern |
| Profiles | dev (fast build) vs. release (fast execution) |
| crates.io | Publish via `cargo publish`. Adhere to SemVer |
| build.rs | Code generation, environment variables, native library linking |
| .cargo/config.toml | Linker settings, aliases, network settings |
| rust-toolchain.toml | Pin the toolchain version |
| cargo-deny | License, security, and dependency policy checks |
| xtask pattern | A Rust-based task runner to automate builds |
| CI/CD | Automated test/publish pipelines via GitHub Actions |
| Performance | mold/lld linkers, sccache, profile tuning |

## Recommended next reading

- [Testing](./01-testing.md) — Workspace-wide testing strategy
- [Serde](./02-serde.md) — Common serde configurations used in Cargo.toml
- [Best practices](./04-best-practices.md) — API design and versioning

## References

1. **The Cargo Book**: https://doc.rust-lang.org/cargo/
2. **Cargo Reference — Features**: https://doc.rust-lang.org/cargo/reference/features.html
3. **API Guidelines — Crate naming**: https://rust-lang.github.io/api-guidelines/naming.html
4. **Cargo Reference — Build Scripts**: https://doc.rust-lang.org/cargo/reference/build-scripts.html
5. **Cargo Reference — Profiles**: https://doc.rust-lang.org/cargo/reference/profiles.html
6. **Cargo Reference — Workspaces**: https://doc.rust-lang.org/cargo/reference/workspaces.html
7. **cargo-deny documentation**: https://embarkstudios.github.io/cargo-deny/
8. **Rust API Guidelines**: https://rust-lang.github.io/api-guidelines/
9. **cargo-hack documentation**: https://github.com/taiki-e/cargo-hack
10. **Swatinem/rust-cache GitHub Action**: https://github.com/Swatinem/rust-cache
