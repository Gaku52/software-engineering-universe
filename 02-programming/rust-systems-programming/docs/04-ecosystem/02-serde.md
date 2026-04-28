# Serde — JSON/TOML/YAML

> Master Serde, Rust's de facto standard serialization framework, alongside practical conversion patterns for JSON/TOML/YAML

## What you will learn in this chapter

1. **How Serde works** — Serialize/Deserialize traits, derive macros, and the Data Model
2. **Format-specific practice** — How to choose between JSON (serde_json), TOML (toml), and YAML (serde_yaml)
3. **Customization** — Attribute macros, custom serializers, and zero-copy deserialization
4. **Advanced patterns** — flatten, untagged enums, the Visitor pattern, and serde_with
5. **Performance** — Zero-copy, simd-json, and binary formats


## Prerequisites

Before reading this guide, the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the contents of [Testing — proptest, criterion](./01-testing.md)

---

## 1. Serde Architecture

```
┌──────────────── Serde Layered Structure ────────────────┐
│                                                          │
│  ┌─────────────┐   Serialize    ┌─────────────────┐     │
│  │  Rust types │ ─────────────→ │  Serde Data     │     │
│  │  struct,enum│                │  Model          │     │
│  │  Vec,HashMap│ ←───────────── │  (29 types)     │     │
│  └─────────────┘  Deserialize   └────────┬────────┘     │
│                                          │               │
│                                   Serializer /           │
│                                   Deserializer           │
│                                   (per format)           │
│                                          │               │
│                    ┌─────────────────────┼──────┐       │
│                    ▼                     ▼      ▼       │
│              ┌──────────┐  ┌──────────┐  ┌──────┐      │
│              │   JSON   │  │   TOML   │  │ YAML │      │
│              │serde_json│  │   toml   │  │serde │      │
│              │          │  │          │  │_yaml │      │
│              └──────────┘  └──────────┘  └──────┘      │
│                                                          │
│  This separation enables:                                │
│  - Support for all formats with a single derive          │
│  - Easy addition of new formats                          │
│  - Direct type-to-type conversion (serde_transcode)      │
└──────────────────────────────────────────────────────────┘
```

### 1.1 The 29 types of the Serde Data Model

```
┌──────────── Serde Data Model ──────────────┐
│                                              │
│  Primitives:                                 │
│    bool, i8, i16, i32, i64, i128            │
│    u8, u16, u32, u64, u128                  │
│    f32, f64                                  │
│    char, string                              │
│    byte_array, bytes                         │
│                                              │
│  Composite types:                            │
│    option       → Option<T>                 │
│    unit         → ()                        │
│    unit_struct  → struct Unit;              │
│    unit_variant → enum E { A }              │
│    newtype_struct → struct N(T);            │
│    newtype_variant → enum E { A(T) }        │
│    seq          → Vec<T>, [T; N]            │
│    tuple        → (T1, T2, ...)             │
│    tuple_struct → struct T(T1, T2)          │
│    tuple_variant → enum E { A(T1, T2) }    │
│    map          → HashMap<K, V>             │
│    struct       → struct S { f: T }         │
│    struct_variant → enum E { A { f: T } }   │
│                                              │
│  The derive macro automatically generates    │
│  code mapping Rust types to the model above. │
└──────────────────────────────────────────────┘
```

### 1.2 Cargo.toml configuration

```toml
[dependencies]
# Serde core (with derive macros)
serde = { version = "1", features = ["derive"] }

# JSON
serde_json = "1"

# TOML
toml = "0.8"

# YAML
serde_yaml = "0.9"

# Binary formats
bincode = "1"              # Rust-to-Rust communication
rmp-serde = "1"            # MessagePack
ciborium = "0.2"           # CBOR
postcard = "1"             # Compact format for embedded systems

# Utilities
serde_with = "3"           # Custom serialization helpers
serde_repr = "0.1"         # Represent enums as integers
serde_ignored = "0.1"      # Collect unknown fields

# Fast JSON
simd-json = "0.13"         # Fast JSON parser using SIMD
sonic-rs = "0.3"           # Fast JSON serializer/deserializer
```

---

## 2. Basic usage

### Code example 1: Automatic implementation via derive

```rust
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
struct Config {
    /// Server settings
    server: ServerConfig,
    /// Database settings
    database: DatabaseConfig,
    /// Feature flags
    #[serde(default)]
    features: Features,
}

#[derive(Debug, Serialize, Deserialize)]
struct ServerConfig {
    host: String,
    port: u16,
    #[serde(default = "default_workers")]
    workers: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct DatabaseConfig {
    url: String,
    #[serde(default = "default_pool_size")]
    pool_size: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
struct Features {
    auth_enabled: bool,
    rate_limiting: bool,
    cors: bool,
}

impl Default for Features {
    fn default() -> Self {
        Features {
            auth_enabled: true,
            rate_limiting: true,
            cors: false,
        }
    }
}

fn default_workers() -> usize { num_cpus::get() }
fn default_pool_size() -> u32 { 10 }

fn main() -> anyhow::Result<()> {
    // JSON
    let json = r#"{
        "server": { "host": "localhost", "port": 8080 },
        "database": { "url": "postgres://localhost/mydb" }
    }"#;
    let config: Config = serde_json::from_str(json)?;
    println!("JSON: {:?}", config);

    // TOML
    let toml_str = r#"
        [server]
        host = "0.0.0.0"
        port = 3000
        workers = 4

        [database]
        url = "postgres://prod-host/mydb"
        pool_size = 20
    "#;
    let config: Config = toml::from_str(toml_str)?;
    println!("TOML: {:?}", config);

    // Output
    println!("\n--- JSON output ---");
    println!("{}", serde_json::to_string_pretty(&config)?);

    println!("\n--- TOML output ---");
    println!("{}", toml::to_string_pretty(&config)?);

    Ok(())
}
```

### 2.1 Detailed usage of serde_json

```rust
use serde::{Serialize, Deserialize};
use serde_json::{json, Value, Map};

// --- Building dynamic JSON with the json! macro ---
fn build_json_response(user_id: u64, name: &str) -> Value {
    json!({
        "status": "success",
        "data": {
            "user": {
                "id": user_id,
                "name": name,
                "roles": ["admin", "user"],
                "settings": {
                    "theme": "dark",
                    "notifications": true
                }
            }
        },
        "meta": {
            "version": "1.0",
            "timestamp": chrono::Utc::now().to_rfc3339()
        }
    })
}

// --- Manipulating Value ---
fn manipulate_json() {
    let mut value = json!({
        "users": [
            {"name": "Alice", "age": 30},
            {"name": "Bob", "age": 25}
        ]
    });

    // Pointer access
    if let Some(name) = value.pointer("/users/0/name") {
        println!("First user: {}", name);
    }

    // Mutable pointer access
    if let Some(age) = value.pointer_mut("/users/1/age") {
        *age = json!(26);
    }

    // Appending to an array
    if let Some(users) = value["users"].as_array_mut() {
        users.push(json!({"name": "Charlie", "age": 35}));
    }

    // Manipulating a map
    if let Some(obj) = value.as_object_mut() {
        obj.insert("total".to_string(), json!(3));
    }
}

// --- Streaming read/write ---
use std::io::{BufReader, BufWriter};
use std::fs::File;

fn stream_json() -> anyhow::Result<()> {
    // Streaming read from a file
    let file = File::open("large_data.json")?;
    let reader = BufReader::new(file);
    let data: Vec<Record> = serde_json::from_reader(reader)?;

    // Streaming write to a file
    let file = File::create("output.json")?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, &data)?;

    Ok(())
}

// --- Line-delimited JSON (NDJSON / JSON Lines) ---
fn process_ndjson(input: &str) -> Vec<Record> {
    input
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect()
}

fn write_ndjson(records: &[Record], writer: &mut impl std::io::Write) -> anyhow::Result<()> {
    for record in records {
        serde_json::to_writer(&mut *writer, record)?;
        writeln!(writer)?;
    }
    Ok(())
}

// --- Mutual conversion between serde_json::Value and types ---
fn value_conversion() -> anyhow::Result<()> {
    // Type → Value
    let user = User { name: "Alice".into(), age: 30 };
    let value: Value = serde_json::to_value(&user)?;

    // Value → Type
    let user2: User = serde_json::from_value(value)?;

    // Partial deserialization using Value
    let json_str = r#"{"name": "Bob", "age": 25, "extra": "ignored"}"#;
    let value: Value = serde_json::from_str(json_str)?;
    let name: String = serde_json::from_value(value["name"].clone())?;

    Ok(())
}
```

### 2.2 Leveraging serde_json::RawValue

```rust
use serde::{Serialize, Deserialize};
use serde_json::value::RawValue;

/// RawValue: holds JSON without parsing it
/// Useful for performance-critical intermediate processing
#[derive(Serialize, Deserialize)]
struct Envelope<'a> {
    #[serde(rename = "type")]
    msg_type: String,
    /// Holds the JSON payload without parsing
    #[serde(borrow)]
    payload: &'a RawValue,
}

fn route_message(json: &str) -> anyhow::Result<()> {
    // Parse only the envelope; the payload is parsed later according to type
    let envelope: Envelope = serde_json::from_str(json)?;

    match envelope.msg_type.as_str() {
        "user_event" => {
            let event: UserEvent = serde_json::from_str(envelope.payload.get())?;
            handle_user_event(event);
        }
        "order_event" => {
            let event: OrderEvent = serde_json::from_str(envelope.payload.get())?;
            handle_order_event(event);
        }
        _ => {
            // Unknown events can also be forwarded with payload retained
            println!("Unknown event: {}", envelope.payload.get());
        }
    }

    Ok(())
}

// A transparent JSON proxy using RawValue
#[derive(Serialize, Deserialize)]
struct ProxyRequest {
    target: String,
    headers: std::collections::HashMap<String, String>,
    /// Forward the request body without parsing it
    body: Box<RawValue>,
}
```

### Code example 2: Enum serialization

```rust
use serde::{Serialize, Deserialize};

/// Tagged enum (default: externally tagged)
#[derive(Debug, Serialize, Deserialize)]
enum Message {
    Text(String),
    Image { url: String, width: u32, height: u32 },
    Ping,
}
// JSON: {"Text": "hello"}
// JSON: {"Image": {"url": "...", "width": 800, "height": 600}}
// JSON: "Ping"

/// Internally tagged form
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum Event {
    #[serde(rename = "user.created")]
    UserCreated { id: u64, name: String },
    #[serde(rename = "user.deleted")]
    UserDeleted { id: u64 },
    #[serde(rename = "system.health")]
    HealthCheck { status: String },
}
// JSON: {"type": "user.created", "id": 1, "name": "Alice"}

/// Adjacently tagged form
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
enum ApiResponse {
    Success(serde_json::Value),
    Error { code: u16, message: String },
}
// JSON: {"kind": "Success", "data": {...}}
// JSON: {"kind": "Error", "data": {"code": 404, "message": "Not found"}}

/// Untagged form (distinguished by each variant's fields)
#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum NumberOrString {
    Number(f64),
    Text(String),
}
// JSON: 42.0 or "hello"
```

### 2.3 Detailed comparison of enum representations

```rust
use serde::{Serialize, Deserialize};

// --- Externally Tagged [default] ---
#[derive(Serialize, Deserialize)]
enum ExternalTag {
    Variant1(String),
    Variant2 { x: i32, y: i32 },
    Variant3,
}
// {"Variant1": "hello"}
// {"Variant2": {"x": 1, "y": 2}}
// "Variant3"
// Pros: clear. Cons: deeply nested.

// --- Internally Tagged ---
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
enum InternalTag {
    #[serde(rename = "circle")]
    Circle { radius: f64 },
    #[serde(rename = "rectangle")]
    Rectangle { width: f64, height: f64 },
}
// {"type": "circle", "radius": 5.0}
// {"type": "rectangle", "width": 10.0, "height": 20.0}
// Pros: flat. Cons: cannot be used with tuple variants.

// --- Adjacently Tagged ---
#[derive(Serialize, Deserialize)]
#[serde(tag = "t", content = "c")]
enum AdjacentTag {
    Text(String),
    Number(i32),
    Pair(String, i32),
}
// {"t": "Text", "c": "hello"}
// {"t": "Number", "c": 42}
// {"t": "Pair", "c": ["hello", 42]}
// Pros: tuple variants work. Cons: verbose.

// --- Untagged ---
#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum Untagged {
    Int(i64),
    Float(f64),
    Str(String),
    Array(Vec<serde_json::Value>),
    Object(std::collections::HashMap<String, serde_json::Value>),
}
// 42, 3.14, "hello", [...], {...}
// Pros: natural JSON. Cons: variant order matters; error messages are unclear.

// --- serde_repr: integer representation ---
use serde_repr::{Serialize_repr, Deserialize_repr};

#[derive(Debug, Serialize_repr, Deserialize_repr)]
#[repr(u8)]
enum Priority {
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
}
// JSON: 0, 1, 2, 3
```

---

## 3. List of serde attribute macros

```
┌──────────── Major serde attributes ──────────────┐
│                                                    │
│  Field attributes:                                 │
│  #[serde(rename = "fieldName")]  Rename            │
│  #[serde(alias = "old_name")]    Alias             │
│  #[serde(default)]               Default value     │
│  #[serde(default = "fn_name")]   Custom default    │
│  #[serde(skip)]                  Ignore            │
│  #[serde(skip_serializing)]      Ignore on output  │
│  #[serde(skip_deserializing)]    Ignore on input   │
│  #[serde(skip_serializing_if)]   Conditional skip  │
│  #[serde(flatten)]               Flatten in place  │
│  #[serde(with = "module")]       Custom conversion │
│                                                    │
│  Container attributes:                             │
│  #[serde(rename_all = "camelCase")]  Rename all    │
│  #[serde(tag = "type")]          Tag form          │
│  #[serde(deny_unknown_fields)]   Reject unknowns   │
│  #[serde(transparent)]           Treat as inner    │
└────────────────────────────────────────────────────┘
```

### 3.1 Detailed reference of attribute macros

```rust
use serde::{Serialize, Deserialize};

// ========================================
// Container attributes (apply to entire struct/enum)
// ========================================

// --- rename_all ---
// Specify the renaming convention for all fields at once
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]       // camelCase
// #[serde(rename_all = "snake_case")]    // snake_case
// #[serde(rename_all = "PascalCase")]    // PascalCase
// #[serde(rename_all = "SCREAMING_SNAKE_CASE")]  // SCREAMING_SNAKE_CASE
// #[serde(rename_all = "kebab-case")]    // kebab-case
// #[serde(rename_all = "SCREAMING-KEBAB-CASE")]  // SCREAMING-KEBAB-CASE
// #[serde(rename_all = "lowercase")]     // lowercase
// #[serde(rename_all = "UPPERCASE")]     // UPPERCASE
struct UserProfile {
    user_id: u64,           // → "userId"
    first_name: String,     // → "firstName"
    last_name: String,      // → "lastName"
    is_active: bool,        // → "isActive"
}

// --- Different rules for serialization and deserialization ---
#[derive(Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
struct MixedNaming {
    field_name: String,     // serialize: "fieldName", deserialize: "field_name"
}

// --- deny_unknown_fields ---
// Error if there are unknown fields
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StrictConfig {
    host: String,
    port: u16,
    // {"host": "localhost", "port": 8080, "extra": true} → Error!
}

// --- transparent ---
// Treat a newtype as the inner type
#[derive(Serialize, Deserialize)]
#[serde(transparent)]
struct UserId(u64);
// JSON: 42 (not {"UserId": 42})

#[derive(Serialize, Deserialize)]
#[serde(transparent)]
struct Email(String);
// JSON: "user@example.com"

// ========================================
// Field attributes
// ========================================

#[derive(Serialize, Deserialize)]
struct DetailedExample {
    // --- rename ---
    #[serde(rename = "ID")]
    id: u64,

    // --- alias ---
    // Accept multiple names during deserialization
    #[serde(alias = "userName", alias = "user_name")]
    name: String,

    // --- default ---
    #[serde(default)]
    count: u32,             // 0 if absent

    #[serde(default = "default_status")]
    status: String,         // "active" if absent

    // --- skip ---
    #[serde(skip)]
    internal_state: u32,    // Ignored in both serialization and deserialization

    #[serde(skip_serializing)]
    write_only_field: String, // Write-only (not output)

    #[serde(skip_deserializing)]
    computed_field: String,  // Read-only (ignored from input)

    // --- skip_serializing_if ---
    #[serde(skip_serializing_if = "Option::is_none")]
    optional_field: Option<String>,

    #[serde(skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,

    #[serde(skip_serializing_if = "is_zero")]
    retry_count: u32,

    // --- flatten ---
    // Eliminate nesting and expand inline
    #[serde(flatten)]
    metadata: std::collections::HashMap<String, serde_json::Value>,

    // --- with ---
    // Custom serialization module
    #[serde(with = "chrono::serde::ts_seconds")]
    created_at: chrono::DateTime<chrono::Utc>,

    // --- serialize_with / deserialize_with ---
    #[serde(serialize_with = "serialize_uppercase")]
    #[serde(deserialize_with = "deserialize_trimmed")]
    label: String,

    // --- getter ---
    // Call a method during serialization
    #[serde(getter = "DetailedExample::computed_value")]
    computed: String,

    // --- bound ---
    // Customize the trait bounds generated by derive
    // #[serde(bound(serialize = "T: Serialize + Display"))]
    // #[serde(bound(deserialize = "T: Deserialize<'de> + Default"))]
}

fn default_status() -> String { "active".to_string() }
fn is_zero(v: &u32) -> bool { *v == 0 }

fn serialize_uppercase<S>(value: &str, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&value.to_uppercase())
}

fn deserialize_trimmed<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Ok(s.trim().to_string())
}
```

### Code example 3: Practical use of attribute macros

```rust
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // Rename all fields to camelCase
#[serde(deny_unknown_fields)]       // Reject unknown fields
struct UserProfile {
    user_id: u64,                    // → "userId"
    display_name: String,            // → "displayName"

    #[serde(rename = "email")]       // Explicit rename
    email_address: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    bio: Option<String>,             // Do not output if None

    #[serde(default)]
    is_active: bool,                 // false if missing in input

    #[serde(with = "chrono::serde::ts_seconds")]
    created_at: DateTime<Utc>,       // As Unix timestamp

    #[serde(flatten)]
    metadata: std::collections::HashMap<String, serde_json::Value>,
    // Store additional fields flatly
}

// Input JSON:
// {
//   "userId": 1,
//   "displayName": "Alice",
//   "email": "alice@example.com",
//   "isActive": true,
//   "createdAt": 1700000000,
//   "customField": "extra data"
// }
```

### 3.2 Leveraging the serde_with crate

```rust
use serde::{Serialize, Deserialize};
use serde_with::{serde_as, DisplayFromStr, DurationSeconds, TimestampSeconds};
use std::collections::HashMap;
use std::time::Duration;

// serde_as is a macro that makes #[serde(with = "...")] easier to use
#[serde_as]
#[derive(Serialize, Deserialize)]
struct AdvancedConfig {
    // --- Represent Duration as seconds ---
    #[serde_as(as = "DurationSeconds<u64>")]
    timeout: Duration,
    // JSON: {"timeout": 30}

    // --- Conversion via Display/FromStr ---
    #[serde_as(as = "DisplayFromStr")]
    ip_address: std::net::IpAddr,
    // JSON: {"ip_address": "192.168.1.1"}

    // --- Represent HashMap keys as strings ---
    #[serde_as(as = "HashMap<DisplayFromStr, _>")]
    port_mapping: HashMap<u16, String>,
    // JSON: {"port_mapping": {"8080": "web", "5432": "db"}}

    // --- Represent Vec as a comma-separated string ---
    #[serde_as(as = "serde_with::StringWithSeparator::<serde_with::CommaSeparator, String>")]
    tags: Vec<String>,
    // JSON: {"tags": "rust,async,web"}

    // --- Represent DateTime as an RFC3339 string ---
    #[serde_as(as = "TimestampSeconds<String>")]
    created_at: chrono::DateTime<chrono::Utc>,

    // --- Distinguish between None and empty with Option<Vec> ---
    #[serde_as(as = "Option<Vec<DisplayFromStr>>")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    allowed_ips: Option<Vec<std::net::IpAddr>>,

    // --- Base64 encoding ---
    #[serde_as(as = "serde_with::base64::Base64")]
    binary_data: Vec<u8>,
    // JSON: {"binary_data": "SGVsbG8gV29ybGQ="}
}
```

### Code example 4: Custom deserializer

```rust
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// An ID that can be deserialized as either a string or u64
#[derive(Debug, Clone)]
struct FlexibleId(u64);

impl<'de> Deserialize<'de> for FlexibleId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        use serde::de::{self, Visitor};

        struct IdVisitor;

        impl<'de> Visitor<'de> for IdVisitor {
            type Value = FlexibleId;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a numeric or string ID")
            }

            fn visit_u64<E: de::Error>(self, v: u64) -> Result<FlexibleId, E> {
                Ok(FlexibleId(v))
            }

            fn visit_str<E: de::Error>(self, v: &str) -> Result<FlexibleId, E> {
                v.parse::<u64>()
                    .map(FlexibleId)
                    .map_err(|_| E::custom(format!("invalid ID: {}", v)))
            }
        }

        deserializer.deserialize_any(IdVisitor)
    }
}

impl Serialize for FlexibleId {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_u64(self.0)
    }
}

// Accepts both {"id": 42} and {"id": "42"}
#[derive(Debug, Serialize, Deserialize)]
struct Record {
    id: FlexibleId,
    name: String,
}
```

### 3.3 More complex custom deserializers

```rust
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde::de::{self, Visitor, MapAccess, SeqAccess};

/// Accept either a comma-separated string or an array
fn deserialize_string_or_array<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    struct StringOrArrayVisitor;

    impl<'de> Visitor<'de> for StringOrArrayVisitor {
        type Value = Vec<String>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a string or an array of strings")
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            Ok(v.split(',').map(|s| s.trim().to_string()).collect())
        }

        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
            let mut vec = Vec::new();
            while let Some(value) = seq.next_element::<String>()? {
                vec.push(value);
            }
            Ok(vec)
        }
    }

    deserializer.deserialize_any(StringOrArrayVisitor)
}

#[derive(Deserialize)]
struct FlexibleConfig {
    // Both "tags": "rust,async,web" and "tags": ["rust", "async", "web"] are accepted
    #[serde(deserialize_with = "deserialize_string_or_array")]
    tags: Vec<String>,
}

/// Deserialize with environment variable fallback
fn deserialize_with_env_fallback<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;
    if value.starts_with("${") && value.ends_with("}") {
        let env_var = &value[2..value.len() - 1];
        std::env::var(env_var)
            .map_err(|_| de::Error::custom(format!("environment variable {} not found", env_var)))
    } else {
        Ok(value)
    }
}

#[derive(Deserialize)]
struct SecureConfig {
    host: String,
    // "password": "${DB_PASSWORD}" → expanded to the value of the DB_PASSWORD env var
    #[serde(deserialize_with = "deserialize_with_env_fallback")]
    password: String,
}
```

---

## 4. Zero-copy deserialization

### Code example 5: Deserializing borrowed data

```rust
use serde::Deserialize;

/// Zero-copy: deserialize by borrowing from the input string
#[derive(Debug, Deserialize)]
struct LogEntry<'a> {
    #[serde(borrow)]
    level: &'a str,           // Borrow from the input string (no copy)
    #[serde(borrow)]
    message: &'a str,
    timestamp: u64,
    #[serde(borrow)]
    tags: Vec<&'a str>,       // Each tag is borrowed too
}

fn parse_logs(json_bytes: &[u8]) -> Vec<LogEntry<'_>> {
    // Reference the input buffer directly → no memory copy
    serde_json::from_slice(json_bytes).unwrap()
}

/// Owned version (for comparison)
#[derive(Debug, Deserialize)]
struct OwnedLogEntry {
    level: String,             // Allocate String on the heap
    message: String,
    timestamp: u64,
    tags: Vec<String>,
}

fn main() {
    let json = br#"[
        {"level": "INFO", "message": "Server started", "timestamp": 1700000000, "tags": ["boot", "server"]},
        {"level": "ERROR", "message": "Connection lost", "timestamp": 1700000001, "tags": ["network"]}
    ]"#;

    // Zero-copy version (fast, memory-efficient)
    let entries: Vec<LogEntry> = serde_json::from_slice(json).unwrap();
    println!("{:?}", entries);

    // Note: the lifetime of `entries` depends on the `json` buffer.
    // If `json` is dropped, `entries` becomes invalid as well.
}
```

### 4.1 Constraints and caveats of zero-copy

```rust
use serde::Deserialize;

// --- Conditions under which zero-copy is possible ---
// 1. Input is &str or &[u8] (not the owned String or Vec<u8>)
// 2. Strings contain no escape sequences
// 3. Use from_str() or from_slice() (from_reader() is not supported)

// When zero-copy is possible
#[derive(Deserialize)]
struct ZeroCopy<'a> {
    #[serde(borrow)]
    name: &'a str,       // OK: borrowed from the input buffer
    #[serde(borrow)]
    data: &'a [u8],      // OK: borrowed byte slice
    count: u64,           // OK: lightweight even when copied
}

// When zero-copy is not possible
#[derive(Deserialize)]
struct NeedsCopy {
    // May contain escapes → zero-copy not possible
    // "hello \"world\"" → a new unescaped string is needed
    name: String,
}

// --- Conditional zero-copy with Cow<str> ---
use std::borrow::Cow;

#[derive(Deserialize)]
struct SmartCopy<'a> {
    #[serde(borrow)]
    name: Cow<'a, str>,   // No escapes → borrowed; with escapes → owned
    // "hello" → Cow::Borrowed("hello")
    // "hello \"world\"" → Cow::Owned("hello \"world\"")
}

// Performance comparison
fn benchmark_zero_copy(json: &[u8]) {
    // Zero-copy: ~50ns for small JSON
    let _: Vec<LogEntry> = serde_json::from_slice(json).unwrap();

    // Owned copy: ~200ns for the same JSON (overhead of String allocation)
    let _: Vec<OwnedLogEntry> = serde_json::from_slice(json).unwrap();
}
```

---

## 5. Format-specific usage

### Code example 6: Reading and writing TOML configuration files

```rust
use serde::{Serialize, Deserialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
struct AppConfig {
    app: AppSettings,
    #[serde(default)]
    logging: LoggingConfig,
    #[serde(default)]
    plugins: Vec<PluginConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AppSettings {
    name: String,
    version: String,
    debug: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(default)]
struct LoggingConfig {
    level: String,
    file: Option<String>,
    json_format: bool,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        LoggingConfig {
            level: "info".into(),
            file: None,
            json_format: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct PluginConfig {
    name: String,
    enabled: bool,
    #[serde(default)]
    settings: toml::Table,
}

fn load_config(path: &Path) -> anyhow::Result<AppConfig> {
    let content = std::fs::read_to_string(path)?;
    let config: AppConfig = toml::from_str(&content)?;
    Ok(config)
}

fn save_config(path: &Path, config: &AppConfig) -> anyhow::Result<()> {
    let content = toml::to_string_pretty(config)?;
    std::fs::write(path, content)?;
    Ok(())
}

// config.toml:
// [app]
// name = "MyApp"
// version = "1.0.0"
// debug = false
//
// [logging]
// level = "debug"
// file = "app.log"
//
// name = "metrics"
// enabled = true
//
// [plugins.settings]
// interval = 30
// endpoint = "http://localhost:9090"
```

### 5.1 Working with YAML

```rust
use serde::{Serialize, Deserialize};

// --- Kubernetes-style YAML configuration ---
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Deployment {
    api_version: String,
    kind: String,
    metadata: Metadata,
    spec: DeploymentSpec,
}

#[derive(Debug, Serialize, Deserialize)]
struct Metadata {
    name: String,
    namespace: String,
    #[serde(default)]
    labels: std::collections::HashMap<String, String>,
    #[serde(default)]
    annotations: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeploymentSpec {
    replicas: u32,
    selector: Selector,
    template: PodTemplate,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Selector {
    match_labels: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PodTemplate {
    metadata: Metadata,
    spec: PodSpec,
}

#[derive(Debug, Serialize, Deserialize)]
struct PodSpec {
    containers: Vec<Container>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Container {
    name: String,
    image: String,
    ports: Vec<ContainerPort>,
    #[serde(default)]
    env: Vec<EnvVar>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    resources: Option<Resources>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContainerPort {
    container_port: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EnvVar {
    name: String,
    value: Option<String>,
    #[serde(rename = "valueFrom", skip_serializing_if = "Option::is_none")]
    value_from: Option<serde_yaml::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Resources {
    limits: ResourceSpec,
    requests: ResourceSpec,
}

#[derive(Debug, Serialize, Deserialize)]
struct ResourceSpec {
    cpu: String,
    memory: String,
}

fn parse_yaml_config() -> anyhow::Result<()> {
    let yaml = r#"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: production
  labels:
    app: web-app
    version: "1.0"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      name: web-app
      namespace: production
      labels:
        app: web-app
    spec:
      containers:
        - name: app
          image: my-registry/web-app:latest
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: DATABASE_URL
              value: postgres://db:5432/app
            - name: LOG_LEVEL
              value: info
          resources:
            limits:
              cpu: "500m"
              memory: "256Mi"
            requests:
              cpu: "100m"
              memory: "128Mi"
    "#;

    let deployment: Deployment = serde_yaml::from_str(yaml)?;
    println!("{:#?}", deployment);

    // Re-emit as YAML
    let output = serde_yaml::to_string(&deployment)?;
    println!("{}", output);

    Ok(())
}
```

### 5.2 Multi-format configuration loader

```rust
use serde::de::DeserializeOwned;
use std::path::Path;

/// Deserialize using the appropriate format based on the file extension
fn load_config_auto<T: DeserializeOwned>(path: &Path) -> anyhow::Result<T> {
    let content = std::fs::read_to_string(path)?;

    match path.extension().and_then(|e| e.to_str()) {
        Some("json") => {
            serde_json::from_str(&content).map_err(Into::into)
        }
        Some("toml") => {
            toml::from_str(&content).map_err(Into::into)
        }
        Some("yaml") | Some("yml") => {
            serde_yaml::from_str(&content).map_err(Into::into)
        }
        _ => {
            // Try each format in turn when the extension is unknown
            serde_json::from_str(&content)
                .or_else(|_| toml::from_str(&content).map_err(Into::into))
                .or_else(|_: anyhow::Error| serde_yaml::from_str(&content).map_err(Into::into))
        }
    }
}

/// Configuration loader with environment variable overrides
fn load_config_with_env<T: DeserializeOwned + Serialize>(path: &Path) -> anyhow::Result<T> {
    // 1. Read from file
    let content = std::fs::read_to_string(path)?;
    let mut value: serde_json::Value = match path.extension().and_then(|e| e.to_str()) {
        Some("toml") => {
            let toml_val: toml::Value = toml::from_str(&content)?;
            serde_json::to_value(&toml_val)?
        }
        Some("yaml") | Some("yml") => {
            let yaml_val: serde_yaml::Value = serde_yaml::from_str(&content)?;
            serde_json::to_value(&yaml_val)?
        }
        _ => serde_json::from_str(&content)?,
    };

    // 2. Override with environment variables (APP_ prefix)
    if let Some(obj) = value.as_object_mut() {
        for (key, val) in obj.iter_mut() {
            let env_key = format!("APP_{}", key.to_uppercase().replace('-', "_"));
            if let Ok(env_val) = std::env::var(&env_key) {
                // Convert according to type
                if val.is_number() {
                    if let Ok(n) = env_val.parse::<i64>() {
                        *val = serde_json::json!(n);
                    }
                } else if val.is_boolean() {
                    if let Ok(b) = env_val.parse::<bool>() {
                        *val = serde_json::json!(b);
                    }
                } else {
                    *val = serde_json::json!(env_val);
                }
            }
        }
    }

    // 3. Convert to the target type
    serde_json::from_value(value).map_err(Into::into)
}
```

### 5.3 Binary formats

```rust
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct SensorData {
    device_id: u32,
    timestamp: u64,
    temperature: f32,
    humidity: f32,
    readings: Vec<f64>,
}

fn binary_formats_comparison() -> anyhow::Result<()> {
    let data = SensorData {
        device_id: 42,
        timestamp: 1700000000,
        temperature: 23.5,
        humidity: 65.2,
        readings: vec![1.0, 2.5, 3.7, 4.2, 5.1],
    };

    // --- JSON (text) ---
    let json = serde_json::to_string(&data)?;
    println!("JSON:     {} bytes", json.len());
    // ~120 bytes

    // --- bincode (Rust-optimized binary) ---
    let bincode_data = bincode::serialize(&data)?;
    println!("bincode:  {} bytes", bincode_data.len());
    // ~60 bytes
    let decoded: SensorData = bincode::deserialize(&bincode_data)?;
    assert_eq!(data, decoded);

    // --- MessagePack ---
    let msgpack = rmp_serde::to_vec(&data)?;
    println!("msgpack:  {} bytes", msgpack.len());
    // ~70 bytes
    let decoded: SensorData = rmp_serde::from_slice(&msgpack)?;
    assert_eq!(data, decoded);

    // --- CBOR ---
    let mut cbor_buf = Vec::new();
    ciborium::into_writer(&data, &mut cbor_buf)?;
    println!("CBOR:     {} bytes", cbor_buf.len());
    let decoded: SensorData = ciborium::from_reader(&cbor_buf[..])?;
    assert_eq!(data, decoded);

    // --- postcard (for embedded systems) ---
    let postcard_data = postcard::to_allocvec(&data)?;
    println!("postcard: {} bytes", postcard_data.len());
    // ~40 bytes (most compact)

    Ok(())
}

// Performance ballpark:
// | Format     | Size   | Serialize speed | Deserialize speed |
// |------------|--------|-----------------|-------------------|
// | JSON       | Large  | Medium          | Medium            |
// | bincode    | Small  | Very fast       | Very fast         |
// | MessagePack| Medium | Fast            | Fast              |
// | CBOR       | Medium | Fast            | Fast              |
// | postcard   | Smallest | Fast          | Fast              |
```

---

## 6. Advanced patterns

### 6.1 Combining flatten and untagged

```rust
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// Generic envelope for API responses
#[derive(Serialize, Deserialize)]
struct ApiResponse<T> {
    success: bool,
    #[serde(flatten)]
    result: ApiResult<T>,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum ApiResult<T> {
    Ok { data: T },
    Err { error: ApiError },
}

#[derive(Serialize, Deserialize)]
struct ApiError {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<HashMap<String, String>>,
}

// On success: {"success": true, "data": {...}}
// On failure: {"success": false, "error": {"code": "NOT_FOUND", "message": "..."}}

/// Partial Update pattern (for PATCH requests)
#[derive(Serialize, Deserialize)]
struct UserUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    age: Option<u8>,
}

impl UserUpdate {
    fn apply_to(&self, user: &mut User) {
        if let Some(ref name) = self.name {
            user.name = name.clone();
        }
        if let Some(ref email) = self.email {
            user.email = email.clone();
        }
        if let Some(age) = self.age {
            user.age = age;
        }
    }
}
```

### 6.2 Combining with type-safe builder patterns

```rust
use serde::{Serialize, Deserialize};

/// Configuration deserialization with validation
#[derive(Debug)]
pub struct ValidatedConfig {
    pub host: String,
    pub port: u16,
    pub max_connections: u32,
    pub tls_enabled: bool,
    pub cert_path: Option<String>,
}

// Intermediate representation (deserialized by Serde)
#[derive(Deserialize)]
struct RawConfig {
    host: String,
    port: u16,
    #[serde(default = "default_max_connections")]
    max_connections: u32,
    #[serde(default)]
    tls_enabled: bool,
    cert_path: Option<String>,
}

fn default_max_connections() -> u32 { 100 }

impl TryFrom<RawConfig> for ValidatedConfig {
    type Error = ConfigError;

    fn try_from(raw: RawConfig) -> Result<Self, Self::Error> {
        // Validation
        if raw.port == 0 {
            return Err(ConfigError::InvalidPort);
        }
        if raw.max_connections == 0 || raw.max_connections > 10000 {
            return Err(ConfigError::InvalidMaxConnections(raw.max_connections));
        }
        if raw.tls_enabled && raw.cert_path.is_none() {
            return Err(ConfigError::TlsWithoutCert);
        }

        Ok(ValidatedConfig {
            host: raw.host,
            port: raw.port,
            max_connections: raw.max_connections,
            tls_enabled: raw.tls_enabled,
            cert_path: raw.cert_path,
        })
    }
}

#[derive(Debug, thiserror::Error)]
enum ConfigError {
    #[error("invalid port number")]
    InvalidPort,
    #[error("invalid max connections: {0}")]
    InvalidMaxConnections(u32),
    #[error("TLS is enabled but no certificate path is specified")]
    TlsWithoutCert,
}

fn load_validated_config(json: &str) -> Result<ValidatedConfig, Box<dyn std::error::Error>> {
    let raw: RawConfig = serde_json::from_str(json)?;
    let config = ValidatedConfig::try_from(raw)?;
    Ok(config)
}
```

### 6.3 Serializing external types via #[serde(remote)]

```rust
use serde::{Serialize, Deserialize};

// Implement Serialize/Deserialize for types from external crates
// (cannot be done directly due to the orphan rule)

// --- Method 1: remote derive ---
mod external_crate {
    pub struct Color {
        pub r: u8,
        pub g: u8,
        pub b: u8,
    }
}

// "Shadow definition" of the remote type
#[derive(Serialize, Deserialize)]
#[serde(remote = "external_crate::Color")]
struct ColorDef {
    r: u8,
    g: u8,
    b: u8,
}

#[derive(Serialize, Deserialize)]
struct Theme {
    name: String,
    #[serde(with = "ColorDef")]
    primary_color: external_crate::Color,
    #[serde(with = "ColorDef")]
    secondary_color: external_crate::Color,
}

// --- Method 2: newtype wrapper ---
#[derive(Serialize, Deserialize)]
#[serde(transparent)]
struct ColorWrapper(#[serde(with = "ColorDef")] external_crate::Color);

// --- Method 3: conversion via From/Into ---
#[derive(Serialize, Deserialize)]
struct SerializableColor {
    r: u8,
    g: u8,
    b: u8,
}

impl From<&external_crate::Color> for SerializableColor {
    fn from(c: &external_crate::Color) -> Self {
        SerializableColor { r: c.r, g: c.g, b: c.b }
    }
}

impl From<SerializableColor> for external_crate::Color {
    fn from(c: SerializableColor) -> Self {
        external_crate::Color { r: c.r, g: c.g, b: c.b }
    }
}
```

---

## 7. Performance optimization

### 7.1 Fast parsing with simd-json

```rust
// Cargo.toml:
// [dependencies]
// simd-json = "0.13"
// serde = { version = "1", features = ["derive"] }

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct LargeDataset {
    records: Vec<DataRecord>,
}

#[derive(Debug, Deserialize)]
struct DataRecord {
    id: u64,
    name: String,
    value: f64,
}

fn parse_with_simd_json(json_bytes: &mut [u8]) -> Result<LargeDataset, simd_json::Error> {
    // Note: simd-json operates in place, so the input is taken as mut
    simd_json::from_slice(json_bytes)
}

fn parse_with_serde_json(json_str: &str) -> Result<LargeDataset, serde_json::Error> {
    serde_json::from_str(json_str)
}

// Performance comparison (large JSON file):
// serde_json: ~100ms for 100MB
// simd-json:  ~40ms for 100MB (2-3x faster)
//
// Constraints of simd-json:
// - Input must be mut &[u8]
// - Requires a SIMD-capable CPU (most modern CPUs are supported)
// - Streaming parse is not supported
```

### 7.2 Performance best practices

```rust
use serde::{Serialize, Deserialize};

// --- 1. Avoid unnecessary clones ---

// BAD: allocates a String every time
fn parse_many_bad(jsons: &[&str]) -> Vec<String> {
    jsons.iter()
        .filter_map(|j| {
            let v: serde_json::Value = serde_json::from_str(j).ok()?;
            v["name"].as_str().map(String::from)
        })
        .collect()
}

// GOOD: borrow with zero-copy
fn parse_many_good<'a>(jsons: &'a [&'a str]) -> Vec<&'a str> {
    #[derive(Deserialize)]
    struct NameOnly<'a> {
        #[serde(borrow)]
        name: &'a str,
    }

    jsons.iter()
        .filter_map(|j| {
            let v: NameOnly = serde_json::from_str(j).ok()?;
            Some(v.name)
        })
        .collect()
}

// --- 2. Partial deserialization ---

// BAD: deserialize all fields
#[derive(Deserialize)]
struct FullUser {
    id: u64,
    name: String,
    email: String,
    bio: String,
    avatar_url: String,
    settings: serde_json::Value,
    history: Vec<serde_json::Value>,
}

// GOOD: deserialize only the fields you need
#[derive(Deserialize)]
struct UserSummary {
    id: u64,
    name: String,
    // Other fields are ignored (unless deny_unknown_fields is set)
}

// --- 3. Buffer reuse ---
fn process_stream(reader: impl std::io::BufRead) {
    // Parse a sequence of JSON values with serde_json::StreamDeserializer
    let stream = serde_json::Deserializer::from_reader(reader)
        .into_iter::<DataRecord>();

    for result in stream {
        match result {
            Ok(record) => process_record(&record),
            Err(e) => eprintln!("parse error: {}", e),
        }
    }
}

// --- 4. Pre-allocated String/Vec ---
fn serialize_with_capacity(records: &[DataRecord]) -> String {
    // Pre-allocate the estimated size
    let estimated_size = records.len() * 100;
    let mut buf = Vec::with_capacity(estimated_size);
    serde_json::to_writer(&mut buf, records).unwrap();
    String::from_utf8(buf).unwrap()
}
```

---

## 8. Comparison tables

### Format comparison

| Aspect | JSON | TOML | YAML | bincode | MessagePack |
|---|---|---|---|---|---|
| Use case | API communication, data interchange | Configuration files | Configuration, CI/CD | Rust internal communication | Cross-language communication |
| Human readability | Medium | High | High | Not readable | Not readable |
| Comments | Not supported | Supported (#) | Supported (#) | - | - |
| Nesting | Free | Restricted | Free | - | Free |
| Date type | String | Native | String | - | - |
| Rust crate | serde_json | toml | serde_yaml | bincode | rmp-serde |
| Performance | Fast (simd-json) | Medium | Slower | Very fast | Fast |
| Data size | Large | - | Large | Small | Medium |
| Schema | None | None | None | None | None |

### Comparison of serde_json functions

| Function | Input | Output | Zero-copy |
|---|---|---|---|
| `from_str(&str)` | String | T | Possible (`&'a str`) |
| `from_slice(&[u8])` | Byte slice | T | Possible |
| `from_reader(Read)` | Stream | T | Not possible |
| `from_value(Value)` | JSON Value | T | Not possible |
| `to_string(&T)` | T | String | - |
| `to_string_pretty(&T)` | T | String (formatted) | - |
| `to_writer(Write, &T)` | T | Stream output | - |
| `to_value(&T)` | T | JSON Value | - |

### Comparison of enum representation forms

| Form | Attribute | JSON example | When to use |
|---|---|---|---|
| Externally tagged | (default) | `{"Variant": data}` | Rust-to-Rust communication |
| Internally tagged | `#[serde(tag = "type")]` | `{"type": "variant", ...}` | REST APIs |
| Adjacently tagged | `#[serde(tag = "t", content = "c")]` | `{"t": "variant", "c": data}` | Tuple variants |
| Untagged | `#[serde(untagged)]` | `data` | Polymorphic JSON |
| Integer representation | `serde_repr` | `0, 1, 2` | DB / protocols |

---

## 9. Anti-patterns

### Anti-pattern 1: Making every field Option

```rust
// BAD: make every field Option to "accept anything"
#[derive(Deserialize)]
struct BadConfig {
    host: Option<String>,
    port: Option<u16>,
    database_url: Option<String>,
    // → None checks scattered throughout runtime
}

// GOOD: express required fields in the type, leverage default values
#[derive(Deserialize)]
struct GoodConfig {
    host: String,                    // Required
    #[serde(default = "default_port")]
    port: u16,                       // Has default value
    database_url: String,            // Required
    #[serde(default)]
    cache_ttl: Option<u64>,          // Only what is genuinely optional
}

fn default_port() -> u16 { 8080 }
```

### Anti-pattern 2: Overusing serde_json::Value

```rust
// BAD: forgo type safety and treat everything as Value
fn bad_process(json: &str) -> String {
    let v: serde_json::Value = serde_json::from_str(json).unwrap();
    let name = v["user"]["name"].as_str().unwrap(); // risk of runtime panic
    name.to_string()
}

// GOOD: deserialize type-safely with structs
#[derive(Deserialize)]
struct ApiResponse {
    user: User,
}
#[derive(Deserialize)]
struct User {
    name: String,
}

fn good_process(json: &str) -> Result<String, serde_json::Error> {
    let response: ApiResponse = serde_json::from_str(json)?;
    Ok(response.user.name)
}

// When Value is appropriate:
// - JSON with an unfixed schema (preserving extra fields)
// - Partial JSON manipulation (rewriting specific keys)
// - Bridging type conversion (serde_json::from_value)
```

### Anti-pattern 3: unwrapping deserialization errors

```rust
// BAD: ignore parse errors
fn bad_parse(json: &str) -> Config {
    serde_json::from_str(json).unwrap()
    // High risk of panic on user input
}

// GOOD: handle errors appropriately
fn good_parse(json: &str) -> Result<Config, AppError> {
    serde_json::from_str(json).map_err(|e| {
        AppError::InvalidConfig {
            source: e,
            input: json.to_string(),
        }
    })
}

// GOOD: detailed error messages
fn parse_with_context(json: &str, source: &str) -> anyhow::Result<Config> {
    serde_json::from_str(json)
        .with_context(|| format!("failed to parse config file '{}'", source))
}
```

### Anti-pattern 4: Overusing flatten

```rust
// BAD: nesting flatten (performance degradation)
#[derive(Deserialize)]
struct BadNested {
    #[serde(flatten)]
    base: BaseFields,
    #[serde(flatten)]
    extra: ExtraFields,
    #[serde(flatten)]
    more: MoreFields,
    #[serde(flatten)]
    catchall: HashMap<String, Value>,
    // → each flatten requires buffering, approaching O(n^2)
}

// GOOD: explicit field definitions
#[derive(Deserialize)]
struct GoodExplicit {
    // base fields
    id: u64,
    name: String,
    // extra fields
    tags: Vec<String>,
    category: String,
    // catchall only for the rest
    #[serde(flatten)]
    extra: HashMap<String, Value>,
}
```

### Anti-pattern 5: Including secrets in serialization

```rust
// BAD: passwords get serialized
#[derive(Serialize, Deserialize)]
struct UserAccount {
    email: String,
    password_hash: String,    // ends up in the API response!
    api_key: String,          // ends up in logs!
}

// GOOD: exclude sensitive information with skip_serializing
#[derive(Serialize, Deserialize)]
struct SecureUserAccount {
    email: String,
    #[serde(skip_serializing)]   // do not output
    password_hash: String,
    #[serde(skip_serializing)]
    api_key: String,
}

// GOOD: define a separate type for the API response
#[derive(Serialize)]
struct UserResponse {
    email: String,
    display_name: String,
    // Sensitive information is not included
}
```

---

## FAQ

### Q1: What is the performance impact of `#[serde(flatten)]`?

**A:** flatten buffers all fields during deserialization, which causes performance degradation in large structs. If you deserialize frequently, consider avoiding flatten in favor of explicit field definitions.

### Q2: Is mutual conversion between JSON and TOML possible?

**A:** They can be easily converted via Serde's Data Model.

```rust
let config: AppConfig = toml::from_str(toml_str)?;
let json_str = serde_json::to_string_pretty(&config)?;
// Two-step conversion: TOML → Rust type → JSON
```

### Q3: Which binary format is recommended?

**A:** For top speed choose `bincode` (Rust-to-Rust communication); for size efficiency choose `MessagePack` (rmp-serde); when schema definitions are needed choose `Protocol Buffers` (prost). All can be used transparently through Serde.

### Q4: When derive cannot be used (when manual implementation is needed)?

**A:** Manual implementation is needed in the following cases.

```rust
// 1. When you cannot impl on an existing type → use #[serde(remote)]
// 2. When complex conditional branching is needed → Visitor pattern
// 3. When accepting multiple input forms → deserialize_any
// 4. When streaming processing is needed → SeqAccess/MapAccess

// In most cases this can be solved with the serde_with crate
```

### Q5: How do I improve error messages?

**A:** Using serde_path_to_error tells you the path of the field where the error occurred.

```rust
// Cargo.toml: serde_path_to_error = "0.1"

fn parse_with_path(json: &str) -> Result<Config, String> {
    let deserializer = &mut serde_json::Deserializer::from_str(json);
    serde_path_to_error::deserialize(deserializer)
        .map_err(|e| format!("path error '{}': {}", e.path(), e.inner()))
    // Example error: "path error 'server.port': invalid type: string "abc", expected u16"
}
```

### Q6: How do I efficiently process a large JSON file?

**A:** Use streaming deserialization.

```rust
use std::io::BufReader;
use std::fs::File;

fn process_large_json(path: &str) -> anyhow::Result<()> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);

    // Process each element of a JSON array sequentially (without keeping the whole thing in memory)
    let stream = serde_json::Deserializer::from_reader(reader)
        .into_iter::<Record>();

    let mut count = 0;
    for record in stream {
        let record = record?;
        process(&record);
        count += 1;
    }
    println!("records processed: {}", count);
    Ok(())
}
```

---

## Summary

| Item | Key points |
|---|---|
| derive | Auto-implementation via `#[derive(Serialize, Deserialize)]` |
| JSON | serde_json. The standard for API communication. Fast |
| TOML | toml crate. Best suited for configuration files |
| YAML | serde_yaml. Often used for CI/CD configuration |
| Attribute macros | Customize flexibly with rename, default, skip |
| enum representation | Control JSON form with tag, content, untagged |
| Zero-copy | High performance via `#[serde(borrow)]` + `&'a str` |
| Value | Use only for JSON of unknown shape; prefer type-safe structs |
| serde_with | A collection of custom serialization helpers |
| RawValue | Holds JSON without parsing. Useful for routing |
| simd-json | Fast JSON parser leveraging SIMD |
| Binary | bincode, MessagePack, CBOR, postcard |
| flatten | Flatten the structure. Watch performance |
| remote | Serde implementation for external types |
| serde_path_to_error | Pinpoint where errors occur |

## Recommended next reads

- [Database](./03-database.md) — Serde integration with SQLx/SeaORM
- [Axum](../02-async/04-axum-web.md) — Building JSON APIs
- [Testing](./01-testing.md) — Using Serde for test fixtures

## References

1. **Serde Documentation**: https://serde.rs/
2. **serde_json crate**: https://docs.rs/serde_json/latest/serde_json/
3. **Serde Attributes Reference**: https://serde.rs/attributes.html
4. **serde_with documentation**: https://docs.rs/serde_with/
5. **simd-json documentation**: https://docs.rs/simd-json/
6. **serde_path_to_error**: https://docs.rs/serde_path_to_error/
7. **serde_repr**: https://docs.rs/serde_repr/
8. **Serde Data Model**: https://serde.rs/data-model.html
