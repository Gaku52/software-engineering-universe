# The Principle of Immutability

> Why immutable data leads to safer code. A comprehensive look at the theory and practice of immutability — covering language-specific implementation patterns, performance implications, and the benefits in multithreaded environments.

---

## What You Will Learn in This Chapter

1. Understand the **theoretical basis for immutability** and explain why immutable data leads to safe, predictable code
2. Master **language-specific immutability patterns** (Java, TypeScript, Python, Rust, Kotlin) and apply them in practice
3. Understand **tradeoffs with performance** and know when to use optimization techniques such as structural sharing and copy-on-write
4. Understand **the relationship between immutable data and architecture** and apply it to event sourcing, CQRS, and React state management
5. Plan a **gradual adoption strategy** and practically introduce immutability into existing teams and codebases

---

## Prerequisites

The following knowledge is required to understand this guide.

| Prerequisite | Reference |
|---------|-------|
| Variables, references, and the basics of pass-by-value/reference | 01-practices/00-naming-conventions.md |
| Object-oriented basics (classes, instances) | 00-principles/02-solid.md |
| Basic data structures (arrays, dictionaries, trees) | `01-cs-fundamentals/data-structures-algorithms` |
| Foundational concepts of functional programming | [02-functional-principles.md](./02-functional-principles.md) |
| Basic multithreading concepts (threads, locks) | `01-cs-fundamentals/operating-systems` |

---

## 1. What Is Immutability?

### 1.1 Definition and Basic Concepts

Immutability is the property by which data, once created, cannot be changed afterward. When you want to change the state of an object, instead of modifying the existing object, you create a new object that holds the updated value.

This concept corresponds to variables in mathematics. If you define x = 5 in math, x is always 5. The "variable" in programming — contrary to its name — can be reassigned in most languages, and this is a breeding ground for bugs.

### 1.2 Mutable vs Immutable

```
Mutable                              Immutable
─────────────────                ─────────────────

  user.name = "Tanaka"               newUser = user.copy(name="Tanaka")
       │                                │
       v                                v
  ┌──────────┐                    ┌──────────┐  ┌──────────┐
  │ user     │                    │ user     │  │ newUser  │
  │ name:"Tanaka"│  ← original changes │ name:"Suzuki"│  │ name:"Tanaka"│
  │ age: 30  │                    │ age: 30  │  │ age: 30  │
  └──────────┘                    └──────────┘  └──────────┘
                                   original unchanged  new copy

  Problem: who changed it and when?  Benefit: change history is clear
  unexpected changes via shared refs  safe to share
```

This difference may seem minor, but it becomes decisive as system complexity grows. When multiple components share mutable data, a change in one place can unexpectedly ripple to others. The so-called "ghost bugs" appear — bugs that are hard to reproduce and cost enormous debugging time.

### 1.3 Benefits of Immutability

```
┌───────────────────────────────────────────────────┐
│            Five Benefits of Immutability           │
├───────────────────────────────────────────────────┤
│                                                   │
│  1. Predictability                                │
│     Values don't change → functions always return │
│     the same result                               │
│                                                   │
│  2. Thread Safety                                 │
│     No mutations → no locks needed → no deadlocks │
│                                                   │
│  3. Ease of Debugging                             │
│     No state changes → problems are easy to       │
│     reproduce                                     │
│                                                   │
│  4. Efficient Change Detection                    │
│     Reference comparison alone detects changes    │
│     → O(1)                                        │
│                                                   │
│  5. History Management (Undo/Redo)                │
│     Old states are preserved as-is → time travel  │
│     is possible                                   │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 1.4 Levels of Immutability

Immutability exists at multiple levels. Without understanding this, bugs can appear in code you thought was immutable.

```
Level 1: Variable Immutability
─────────────────────────────────────────────
  const x = 5;        // x cannot be reassigned
  const obj = {a: 1}; // obj cannot be reassigned
  obj.a = 2;          // but properties can still be changed!

Level 2: Shallow Object Immutability
──────────────────────────────────────────────────────
  Object.freeze(obj);  // direct properties become non-writable
  obj.a = 2;           // silently ignored (throws in strict mode)
  obj.nested.b = 3;    // nested objects can still be changed!

Level 3: Deep Object Immutability
───────────────────────────────────────────────────
  deepFreeze(obj);     // properties at all levels become non-writable
  // or
  type DeepReadonly<T> // guaranteed at the TypeScript type level

Level 4: Language-Level Immutability
────────────────────────────────────────────────────────
  Rust: let x = 5;    // immutable by default
  Haskell: everything is immutable  // mutability is explicit via types (IORef, STRef)
```

### 1.5 The Immutability Spectrum

```
Fully Mutable ◄──────────────────────────────► Fully Immutable

  C             Java        TypeScript      Scala         Haskell
  (all mutable) (has final)  (has readonly)  (val default) (all immutable)

                    Rust
                    (let is immutable by default)

                    Kotlin
                    (explicit val/var)

Recommended Zone:
  ┌──────────────────────────────┐
  │  Immutable by default + mutable only where needed  │
  │  (Rust/Kotlin approach)                            │
  └──────────────────────────────┘
```

---

## 2. Language-Specific Immutability Implementations

### 2.1 TypeScript / JavaScript

```typescript
// TypeScript: Immutable data operations

// === 1. readonly and as const ===

interface User {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly address: Readonly<Address>;
}

interface Address {
  readonly prefecture: string;
  readonly city: string;
}

// Deep immutability with as const
const CONFIG = {
  api: {
    baseUrl: "https://api.example.com",
    timeout: 5000,
  },
  features: ["auth", "logging"] as const,
} as const;

// CONFIG.api.baseUrl = "xxx"; // compile error
// CONFIG.features.push("x");  // compile error

// === 2. Readonly utility type ===

// Shallow Readonly (one level only)
type ShallowReadonlyUser = Readonly<{
  name: string;
  address: { city: string };
}>;
// address.city can still be changed (shallow)

// Deep Readonly (recursively all levels)
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P];
};

type FullyReadonlyUser = DeepReadonly<{
  name: string;
  address: { city: string; tags: string[] };
}>;
// address.city and tags are all non-writable

// === 3. Immutable update patterns ===

function updateUserName(user: User, newName: string): User {
  // Generate a new object using spread syntax
  return { ...user, name: newName };
}

// Updating a nested object
function updateCity(user: User, newCity: string): User {
  return {
    ...user,
    address: {
      ...user.address,
      city: newCity,
    },
  };
}

// === 4. Immutable array operations ===

function addItem<T>(items: readonly T[], item: T): readonly T[] {
  return [...items, item]; // returns a new array
}

function removeItem<T>(items: readonly T[], index: number): readonly T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

function updateItem<T>(
  items: readonly T[],
  index: number,
  updater: (item: T) => T
): readonly T[] {
  return items.map((item, i) => (i === index ? updater(item) : item));
}

// Immutable array sort
function sortedBy<T, K>(
  items: readonly T[],
  keyFn: (item: T) => K
): readonly T[] {
  return [...items].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

// === 5. Immutable Map/Set operations ===

function addToMap<K, V>(
  map: ReadonlyMap<K, V>,
  key: K,
  value: V
): ReadonlyMap<K, V> {
  const newMap = new Map(map);
  newMap.set(key, value);
  return newMap;
}

function removeFromMap<K, V>(
  map: ReadonlyMap<K, V>,
  key: K
): ReadonlyMap<K, V> {
  const newMap = new Map(map);
  newMap.delete(key);
  return newMap;
}

function addToSet<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const newSet = new Set(set);
  newSet.add(value);
  return newSet;
}

// === 6. Runtime immutability guarantee with Object.freeze ===

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
}

const frozenConfig = deepFreeze({
  api: { url: "https://example.com" },
  retries: 3,
});
// frozenConfig.api.url = "xxx"; // TypeError at runtime (strict mode)
```

### 2.2 Java

```java
// Java: Design patterns for immutable classes

// === 1. Basic immutable class ===
// Rules from Effective Java Item 17: Minimize mutability
// (1) Provide no setters
// (2) Make the class final (prevent inheritance)
// (3) Make all fields final
// (4) Make all fields private
// (5) Ensure exclusive access to mutable components

public final class Money {
    private final int amount;
    private final String currency;

    public Money(int amount, String currency) {
        if (amount < 0) {
            throw new IllegalArgumentException("Amount must be >= 0: " + amount);
        }
        this.amount = amount;
        this.currency = Objects.requireNonNull(currency, "Currency is required");
    }

    public int getAmount() { return amount; }
    public String getCurrency() { return currency; }

    // Mutations return a new instance
    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                "Currency mismatch: " + this.currency + " vs " + other.currency
            );
        }
        return new Money(this.amount + other.amount, this.currency);
    }

    public Money multiply(int factor) {
        return new Money(this.amount * factor, this.currency);
    }

    public Money subtract(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("Currency mismatch");
        }
        return new Money(this.amount - other.amount, this.currency);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money money)) return false;
        return amount == money.amount && currency.equals(money.currency);
    }

    @Override
    public int hashCode() {
        return Objects.hash(amount, currency);
    }

    @Override
    public String toString() {
        return amount + " " + currency;
    }
}

// === 2. Java 16+ Record (automatically immutable) ===

public record User(
    String id,
    String name,
    int age,
    Address address
) {
    // Validation in compact constructor
    public User {
        Objects.requireNonNull(id, "ID is required");
        Objects.requireNonNull(name, "Name is required");
        if (age < 0 || age > 200) {
            throw new IllegalArgumentException("Age must be between 0 and 200: " + age);
        }
    }

    // Wither pattern: returns a new instance with a changed field
    public User withName(String newName) {
        return new User(id, newName, age, address);
    }

    public User withAge(int newAge) {
        return new User(id, name, newAge, address);
    }

    public User withAddress(Address newAddress) {
        return new User(id, name, age, newAddress);
    }
}

public record Address(String prefecture, String city, String zipCode) {
    public Address {
        Objects.requireNonNull(prefecture);
        Objects.requireNonNull(city);
    }

    public Address withCity(String newCity) {
        return new Address(prefecture, newCity, zipCode);
    }
}

// === 3. Immutable collections ===

// Java 9+ factory methods
var immutableList = List.of("a", "b", "c");
var immutableMap = Map.of("key1", "value1", "key2", "value2");
var immutableSet = Set.of(1, 2, 3);
// immutableList.add("d"); // UnsupportedOperationException

// Java 10+ copy factory
var mutableList = new ArrayList<>(List.of("a", "b"));
var snapshot = List.copyOf(mutableList); // immutable snapshot
mutableList.add("c"); // original is still mutable
// snapshot is unchanged

// Difference from Collections.unmodifiableList
var original = new ArrayList<>(List.of("a", "b"));
var unmodifiable = Collections.unmodifiableList(original);
original.add("c");
// unmodifiable now has size 3 as well! (it's a view, so changes to original affect it)

var copied = List.copyOf(original);
original.add("d");
// copied remains size 3 (it's a copy, unaffected by changes to original)

// === 4. Defensive copying of mutable components ===

public final class Period {
    private final Date start;
    private final Date end;

    public Period(Date start, Date end) {
        // Defensive copy: protect against caller modifying the Date object
        this.start = new Date(start.getTime());
        this.end = new Date(end.getTime());
        if (this.start.compareTo(this.end) > 0) {
            throw new IllegalArgumentException("start > end");
        }
    }

    public Date getStart() {
        return new Date(start.getTime()); // return a defensive copy
    }

    public Date getEnd() {
        return new Date(end.getTime());
    }
}
// Note: In Java 8+, use the immutable LocalDate/LocalDateTime instead of Date
```

### 2.3 Python

```python
# Python: Immutability implementation patterns

# === 1. frozen dataclass ===
from dataclasses import dataclass, replace, field
from typing import Tuple

@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def translate(self, dx: float, dy: float) -> "Point":
        """Returns a new Point (does not modify the original)"""
        return replace(self, x=self.x + dx, y=self.y + dy)

    def distance_to(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5

    def scale(self, factor: float) -> "Point":
        return Point(self.x * factor, self.y * factor)

p1 = Point(1.0, 2.0)
p2 = p1.translate(3.0, 4.0)
print(p1)  # Point(x=1.0, y=2.0)  ← original unchanged
print(p2)  # Point(x=4.0, y=6.0)
# p1.x = 5.0  # FrozenInstanceError

# Using a frozen dataclass with collections
@dataclass(frozen=True)
class Polygon:
    name: str
    vertices: Tuple[Point, ...]  # tuple is immutable

    def add_vertex(self, point: Point) -> "Polygon":
        return replace(self, vertices=self.vertices + (point,))

    def vertex_count(self) -> int:
        return len(self.vertices)

triangle = Polygon("Triangle", (Point(0, 0), Point(1, 0), Point(0.5, 1)))
# triangle.vertices = ()  # FrozenInstanceError

# === 2. NamedTuple (lightweight immutable type) ===
from typing import NamedTuple

class Color(NamedTuple):
    r: int
    g: int
    b: int
    a: float = 1.0

    def with_alpha(self, alpha: float) -> "Color":
        return self._replace(a=alpha)

    def to_hex(self) -> str:
        return f"#{self.r:02x}{self.g:02x}{self.b:02x}"

    def blend(self, other: "Color", ratio: float = 0.5) -> "Color":
        """Blends two colors and returns a new color"""
        return Color(
            r=int(self.r * (1 - ratio) + other.r * ratio),
            g=int(self.g * (1 - ratio) + other.g * ratio),
            b=int(self.b * (1 - ratio) + other.b * ratio),
            a=self.a * (1 - ratio) + other.a * ratio,
        )

red = Color(255, 0, 0)
semi_transparent = red.with_alpha(0.5)
print(red)                # Color(r=255, g=0, b=0, a=1.0)
print(semi_transparent)   # Color(r=255, g=0, b=0, a=0.5)

# NamedTuple is hashable (can be used as dict keys or set elements)
color_names = {Color(255, 0, 0): "red", Color(0, 255, 0): "green"}

# === 3. Immutable dictionary pattern ===
from types import MappingProxyType

def create_config(overrides: dict = None) -> MappingProxyType:
    """Creates a non-writable configuration dictionary"""
    defaults = {
        "debug": False,
        "log_level": "INFO",
        "max_retries": 3,
        "timeout_seconds": 30,
    }
    if overrides:
        defaults.update(overrides)
    return MappingProxyType(defaults)

config = create_config({"debug": True})
print(config["debug"])    # True
# config["debug"] = False  # TypeError: 'mappingproxy' object does not support item assignment

# To update an immutable config, create a new MappingProxyType
def update_config(
    config: MappingProxyType, **updates
) -> MappingProxyType:
    new_dict = dict(config)
    new_dict.update(updates)
    return MappingProxyType(new_dict)

new_config = update_config(config, debug=False, log_level="DEBUG")

# === 4. Pydantic v2 immutable model ===
from pydantic import BaseModel, ConfigDict, field_validator

class UserModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    email: str
    tags: tuple[str, ...] = ()  # use tuple instead of list to ensure immutability

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("Please provide a valid email address")
        return v

    def update_name(self, new_name: str) -> "UserModel":
        return self.model_copy(update={"name": new_name})

    def add_tag(self, tag: str) -> "UserModel":
        return self.model_copy(update={"tags": self.tags + (tag,)})

user = UserModel(id="1", name="Tanaka", email="tanaka@example.com")
updated = user.update_name("Suzuki")
print(user.name)     # "Tanaka"  ← original unchanged
print(updated.name)  # "Suzuki"

# === 5. Optimization with __slots__ + frozen ===

@dataclass(frozen=True, slots=True)
class OptimizedPoint:
    """slots=True improves memory efficiency (no __dict__)"""
    x: float
    y: float
    z: float = 0.0

# With slots=True:
# - Memory usage reduced by ~40%
# - Attribute access ~10% faster
# - No __dict__ means no dynamic attribute addition (further enforces immutability)

# === 6. Immutable Enum ===
from enum import Enum

class OrderStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

    def can_transition_to(self, target: "OrderStatus") -> bool:
        """Validates a state transition"""
        valid_transitions = {
            OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
            OrderStatus.CONFIRMED: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
            OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
            OrderStatus.DELIVERED: set(),
            OrderStatus.CANCELLED: set(),
        }
        return target in valid_transitions.get(self, set())
```

### 2.4 Rust (Language-Level Immutability)

```rust
// Rust: Immutable by default
// Rust is the only mainstream language with "immutability as default" as a design philosophy

// === 1. Variables are immutable by default ===
fn basic_immutability() {
    let x = 5;
    // x = 6;  // compile error: cannot assign twice to immutable variable

    let mut y = 5;  // explicitly add mut
    y = 6;          // OK

    // Shadowing: redefinition (not reassignment)
    let x = x + 1;  // new x shadows old x
    let x = x * 2;  // yet another new x
    // Type changes are also possible with shadowing
    let x = x.to_string(); // i32 → String
}

// === 2. Struct immutability ===
#[derive(Clone, Debug, PartialEq)]
struct User {
    name: String,
    age: u32,
    email: String,
}

impl User {
    fn new(name: String, age: u32, email: String) -> Self {
        Self { name, age, email }
    }

    // Builder pattern for immutable updates (consumes ownership and returns a new instance)
    fn with_name(self, name: String) -> Self {
        Self { name, ..self }
    }

    fn with_age(self, age: u32) -> Self {
        Self { age, ..self }
    }

    fn with_email(self, email: String) -> Self {
        Self { email, ..self }
    }
}

fn usage() {
    let user = User::new("tanaka".into(), 30, "tanaka@example.com".into());
    let updated = user.with_name("suzuki".into()); // ownership of user is moved
    // println!("{:?}", user); // compile error: value moved
    println!("{:?}", updated); // OK
}

// === 3. Immutability guaranteed by ownership and borrowing ===
fn print_user(user: &User) {       // shared reference (read-only)
    println!("{:?}", user);
    // user.age += 1; // compile error: cannot assign to immutable borrow
}

fn update_age(user: &mut User) {   // exclusive reference (mutable)
    user.age += 1;
}

// Borrowing rules:
// - Shared references (&T) can exist in any number simultaneously
// - Exclusive references (&mut T) can only exist one at a time
// - Shared and exclusive references cannot coexist
// → Data races are completely prevented at compile time

// === 4. Immutable collections ===
fn immutable_collections() {
    let numbers = vec![1, 2, 3, 4, 5]; // immutable (no mut)
    // numbers.push(6); // compile error

    // Functional operations that produce new collections
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
    let even: Vec<&i32> = numbers.iter().filter(|x| *x % 2 == 0).collect();

    // numbers is still usable (iter only borrows)
    println!("{:?}", numbers);  // [1, 2, 3, 4, 5]
    println!("{:?}", doubled);  // [2, 4, 6, 8, 10]
}

// === 5. Thread-safe immutable data sharing with Arc<T> ===
use std::sync::Arc;
use std::thread;

fn shared_immutable_data() {
    let data = Arc::new(vec![1, 2, 3, 4, 5]); // share immutable data

    let handles: Vec<_> = (0..4).map(|i| {
        let data = Arc::clone(&data); // only increments the reference count
        thread::spawn(move || {
            let sum: i32 = data.iter().sum();
            println!("Thread {}: sum = {}", i, sum);
        })
    }).collect();

    for handle in handles {
        handle.join().unwrap();
    }
    // No locks needed! No data races because data is immutable
}
```

### 2.5 Kotlin

```kotlin
// Kotlin: Explicit immutability with val/var

// === 1. Basic immutability ===
val x = 5        // immutable (cannot be reassigned)
// x = 6         // compile error
var y = 5        // mutable (can be reassigned)
y = 6            // OK

// === 2. data class (immutable design recommended) ===
data class User(
    val id: String,          // val is immutable
    val name: String,
    val age: Int,
    val email: String
) {
    init {
        require(age in 0..200) { "Age must be between 0 and 200: $age" }
        require(email.contains("@")) { "Invalid email address: $email" }
    }
}

// Partial update with auto-generated copy method
val user = User("1", "Tanaka", 30, "tanaka@example.com")
val updated = user.copy(name = "Suzuki")
println(user)    // User(id=1, name=Tanaka, age=30, email=tanaka@example.com)
println(updated) // User(id=1, name=Suzuki, age=30, email=tanaka@example.com)

// === 3. Immutable collections ===
val immutableList = listOf(1, 2, 3)     // List<Int> (immutable)
val mutableList = mutableListOf(1, 2, 3) // MutableList<Int> (mutable)

// immutableList.add(4)  // compile error: List has no add method
mutableList.add(4)        // OK

// "Updating" an immutable list: returns a new list
val newList = immutableList + 4         // [1, 2, 3, 4]
val filtered = immutableList.filter { it > 1 } // [2, 3]
val mapped = immutableList.map { it * 2 }      // [2, 4, 6]

// Immutable Map
val config = mapOf(
    "debug" to false,
    "timeout" to 30,
    "retries" to 3
)
// config["debug"] = true  // compile error
val newConfig = config + ("debug" to true) // creates a new Map

// === 4. Immutable domain model with sealed class + data class ===
sealed class PaymentResult {
    data class Success(
        val transactionId: String,
        val amount: Int,
        val timestamp: Long
    ) : PaymentResult()

    data class Failure(
        val errorCode: String,
        val message: String
    ) : PaymentResult()

    data class Pending(
        val estimatedCompletion: Long
    ) : PaymentResult()
}

// Safe processing with pattern matching (when expression)
fun handlePayment(result: PaymentResult): String = when (result) {
    is PaymentResult.Success -> "Payment successful: ${result.transactionId}"
    is PaymentResult.Failure -> "Payment failed: ${result.message}"
    is PaymentResult.Pending -> "Processing..."
    // sealed class requires all cases to be covered, otherwise compile warning
}

// === 5. Immutable value objects ===
@JvmInline
value class Email(val value: String) {
    init {
        require(value.contains("@")) { "Invalid email address: $value" }
    }
}

@JvmInline
value class UserId(val value: String) {
    init {
        require(value.isNotBlank()) { "ID cannot be empty" }
    }
}

// value class has zero wrapper overhead (expanded at compile time)
val email = Email("user@example.com")
val userId = UserId("user-123")
```

---

## 3. Performance and Optimization

### 3.1 Structural Sharing

```
Structural Sharing: share the parts that have not changed

  Original tree          Tree after changing name
  ──────────          ─────────────────

      root                  newRoot
     /    \                /    \
    A      B            newA     B  ← shared (no copy)
   / \    / \           / \    / \
  a1  a2 b1  b2      a1* a2 b1  b2  ← all of B's subtree is shared
                       ↑
                   only the changed part is newly created

  Memory efficiency: O(log n) new nodes are sufficient
  Change detection: if root references differ, there is a change → O(1)
```

Structural sharing is the core technology of persistent data structures. Despite the name, "persistent" has nothing to do with "persistence to disk" — it means "all versions before and after a change are retained." It is widely used in functional languages such as Clojure, Scala, and Haskell.

### 3.2 Internal Implementation of Persistent Data Structures

```
Hash Array Mapped Trie (HAMT):
Internal structure of PersistentVector and PersistentHashMap in Clojure/Scala

  32-way trie
  ─────────────

              root
       /    |    |    \
     [0-31] [32-63] ... [992-1023]
      / | \
    [0] [1] ... [31]

  Array size: 1024 elements
  Tree depth: log32(1024) = 2 levels
  New nodes required to change 1 element: 2 (root + 1 leaf)

  Computational complexity:
  ┌──────────────┬──────────────────────────────┐
  │ Operation    │ Complexity                    │
  ├──────────────┼──────────────────────────────┤
  │ Read (get)   │ O(log32 n) ≈ effectively O(1) │
  │ Update (set) │ O(log32 n) ≈ effectively O(1) │
  │ Append       │ amortized O(1)                │
  │ Change detect│ O(1) (reference comparison)   │
  └──────────────┴──────────────────────────────┘

  log32(1,000,000) ≈ 4 → even with 1 million elements, 4 pointer hops to reach any element
```

### 3.3 Comparison with Copy-on-Write

| Strategy | Memory Efficiency | CPU Efficiency | Implementation Complexity | Use Cases |
|------|-----------|---------|-----------|---------|
| Full copy every time | Low | Low | Simple | Small data (< 100 elements) |
| Structural sharing | High | High | Complex | Persistent data structures (Clojure etc.) |
| Copy-on-write | High | Medium | Medium | OS/runtime level (Swift Array) |
| Immer (JS) | Medium | Medium | Simple | React app state management |
| Persistent data structures | High | High | Very complex | Core of functional languages |
| Freeze + new creation | Low | Low | Simple | Small-scale config data |

### 3.4 Performance Benchmark Metrics

```
Benchmark: Array operations on 10,000 elements (Node.js v20)

Operation         | Mutable    | Spread     | Immer    | Immutable.js
─────────────────|───────────|──────────|─────────|───────────
Add 1 element     | 0.001ms   | 0.15ms   | 0.03ms  | 0.005ms
Update 1 element  | 0.001ms   | 0.12ms   | 0.02ms  | 0.008ms
Deep nested update| 0.001ms   | 0.30ms   | 0.05ms  | 0.010ms
Change detection  | O(n) deep | O(1) ref  | O(1) ref | O(1) ref
Memory usage      | 1x        | ~2x      | ~1.2x   | ~1.1x

Conclusions:
- Mutable is fastest per individual operation, but the difference is small
- When change detection is included, immutable has an advantage
- Spread is sufficient for 100 elements or fewer
- Consider Immer or Immutable.js for 1000+ elements
```

### 3.5 Efficient Immutable Updates with Immer.js

```typescript
// Immer: immutable updates using mutable syntax
import { produce, Draft } from "immer";

interface AppState {
  users: User[];
  selectedId: string | null;
  filters: {
    status: string;
    search: string;
  };
}

// Apply changes directly to a "draft" with produce
// → Immer automatically generates a new immutable state
const nextState = produce(currentState, (draft: Draft<AppState>) => {
  const user = draft.users.find((u) => u.id === "123");
  if (user) {
    user.name = "New Name"; // direct mutation is OK (on the draft)
  }
  draft.filters.search = "search term";
});

// currentState is unchanged (immutable)
// nextState is a new object
console.log(currentState === nextState); // false
console.log(currentState.users[1] === nextState.users[1]); // true (unchanged → shared)

// === Internal mechanism of Immer ===
// 1. Wrap the draft with a Proxy object
// 2. Trap property access to record changes
// 3. Create new objects only for the changed paths
// 4. Share the original objects for unchanged parts (structural sharing)

// === Combining with React useReducer ===
import { useImmerReducer } from "use-immer";

type Action =
  | { type: "UPDATE_USER"; id: string; name: string }
  | { type: "ADD_USER"; user: User }
  | { type: "DELETE_USER"; id: string }
  | { type: "SET_FILTER"; key: string; value: string };

function reducer(draft: Draft<AppState>, action: Action): void {
  switch (action.type) {
    case "UPDATE_USER": {
      const user = draft.users.find((u) => u.id === action.id);
      if (user) user.name = action.name;
      break;
    }
    case "ADD_USER":
      draft.users.push(action.user);
      break;
    case "DELETE_USER":
      draft.users = draft.users.filter((u) => u.id !== action.id);
      break;
    case "SET_FILTER":
      (draft.filters as any)[action.key] = action.value;
      break;
  }
}

// Usage in a component
function UserList() {
  const [state, dispatch] = useImmerReducer(reducer, initialState);

  const handleRename = (id: string, name: string) => {
    dispatch({ type: "UPDATE_USER", id, name });
  };

  return (
    <ul>
      {state.users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

---

## 4. Benefits in Multithreaded Environments

### 4.1 The Danger of Concurrent Access to Mutable Data

```
Thread 1              Shared Mutable Data       Thread 2
─────────             ──────────────────        ─────────

read(balance)          balance = 1000         read(balance)
  → 1000                                       → 1000

balance -= 500         balance = ???           balance -= 300
  → 500                                        → 700

write(balance)                                write(balance)
  → balance = 500       ← race condition       → balance = 700

Expected: 200 (1000 - 500 - 300)
Actual: 500 or 700 (whichever thread writes last wins)
```

This bug is non-deterministic and only reproduces under specific execution timings. It is extremely difficult to find in tests and can suddenly surface in production. In financial systems, this can be a fatal problem.

### 4.2 No Locks Needed with Immutable Data

```
Thread 1              Immutable Data           Thread 2
─────────             ──────────────           ─────────

read(account)          account{balance:1000}  read(account)
  → {balance:1000}     (never changes)         → {balance:1000}

new1 = withdraw(500)   account{balance:1000}  new2 = withdraw(300)
  → {balance:500}      (original immutable)    → {balance:700}

CAS(account, new1)     ← Compare-And-Swap     CAS(account, new2)
  → success                                    → fail → retry

                                              new3 = withdraw(300)
                                                from account(500)
                                              CAS → success

Final result: {balance: 200} ← correct!
```

### 4.3 Thread-Safe Immutable Data Patterns per Language

```
┌────────────────────────────────────────────────────────────┐
│              Thread-Safe Immutable Data Patterns            │
├─────────┬──────────────────────────────────────────────────┤
│ Java    │ final fields + immutable class                   │
│         │ ConcurrentHashMap + compute for atomic updates   │
│         │ AtomicReference<ImmutableState> + CAS            │
├─────────┼──────────────────────────────────────────────────┤
│ Rust    │ Arc<T> to share immutable data                   │
│         │ Arc<Mutex<T>> for exclusive access to mutable data│
│         │ Compiler fully prevents data races               │
├─────────┼──────────────────────────────────────────────────┤
│ Kotlin  │ kotlinx.coroutines.flow for immutable data flows │
│         │ StateFlow<ImmutableState> for shared state       │
├─────────┼──────────────────────────────────────────────────┤
│ TS/JS   │ Single-threaded (excluding Workers), no issue    │
│         │ Use Atomics API when using SharedArrayBuffer     │
├─────────┼──────────────────────────────────────────────────┤
│ Python  │ Has GIL, but immutable data recommended for      │
│         │ multiprocessing; frozen dataclass + copy safely  │
└─────────┴──────────────────────────────────────────────────┘
```

```java
// Java: Optimistic concurrency control with AtomicReference + CAS
import java.util.concurrent.atomic.AtomicReference;

public class ImmutableAccountService {
    private final AtomicReference<Account> accountRef;

    public ImmutableAccountService(Account initial) {
        this.accountRef = new AtomicReference<>(initial);
    }

    public Account withdraw(int amount) {
        while (true) {
            Account current = accountRef.get();
            Account updated = current.withdraw(amount); // new immutable object
            if (accountRef.compareAndSet(current, updated)) {
                return updated; // CAS succeeded
            }
            // CAS failed → another thread changed it first → retry
        }
    }
}

// Account is immutable (record)
public record Account(String id, int balance) {
    public Account withdraw(int amount) {
        if (balance < amount) throw new IllegalStateException("Insufficient balance");
        return new Account(id, balance - amount);
    }
}
```

---

## 5. Practical Patterns

### 5.1 React State Management and Immutability

```typescript
// The importance of immutability in React
// React uses reference comparison (===) to decide whether to re-render

// === BAD: Mutable state update ===
function TodoListBad() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = (text: string) => {
    // BAD: Mutating the same array — React won't detect the change
    todos.push({ id: Date.now().toString(), text, done: false });
    setTodos(todos); // same reference, so no re-render!
  };

  const toggleTodo = (id: string) => {
    // BAD: Directly mutating an element
    const todo = todos.find((t) => t.id === id);
    if (todo) todo.done = !todo.done;
    setTodos(todos); // no re-render!
  };
}

// === GOOD: Immutable state update ===
function TodoListGood() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = (text: string) => {
    setTodos((prev) => [
      ...prev,
      { id: Date.now().toString(), text, done: false },
    ]);
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  const removeTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  // React.memo + immutable data → prevents unnecessary re-renders
  return (
    <ul>
      {todos.map((todo) => (
        <MemoizedTodoItem
          key={todo.id}
          todo={todo}
          onToggle={toggleTodo}
          onRemove={removeTodo}
        />
      ))}
    </ul>
  );
}

const MemoizedTodoItem = React.memo(function TodoItem({
  todo,
  onToggle,
  onRemove,
}: {
  todo: Todo;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  // Re-renders only when the todo object reference changes
  return (
    <li>
      <span
        style={{ textDecoration: todo.done ? "line-through" : "none" }}
        onClick={() => onToggle(todo.id)}
      >
        {todo.text}
      </span>
      <button onClick={() => onRemove(todo.id)}>Delete</button>
    </li>
  );
});
```

### 5.2 Affinity with Event Sourcing

```python
# Event sourcing: manage state by accumulating immutable events
from dataclasses import dataclass, field
from typing import Union
from datetime import datetime
from functools import reduce

# === Immutable event definitions ===

@dataclass(frozen=True)
class AccountCreated:
    account_id: str
    owner: str
    timestamp: datetime

@dataclass(frozen=True)
class MoneyDeposited:
    account_id: str
    amount: int
    timestamp: datetime
    description: str = ""

@dataclass(frozen=True)
class MoneyWithdrawn:
    account_id: str
    amount: int
    timestamp: datetime
    description: str = ""

@dataclass(frozen=True)
class AccountClosed:
    account_id: str
    timestamp: datetime
    reason: str = ""

Event = Union[AccountCreated, MoneyDeposited, MoneyWithdrawn, AccountClosed]

# === Immutable account state ===

@dataclass(frozen=True)
class AccountState:
    """Immutable account state"""
    account_id: str
    owner: str
    balance: int
    is_active: bool = True
    transaction_count: int = 0

    @staticmethod
    def apply(state: "AccountState | None", event: Event) -> "AccountState":
        """Applies an event and returns the new state (pure function)"""
        match event:
            case AccountCreated(account_id, owner, _):
                return AccountState(
                    account_id=account_id,
                    owner=owner,
                    balance=0,
                    is_active=True,
                    transaction_count=0,
                )
            case MoneyDeposited(_, amount, _, _):
                return AccountState(
                    account_id=state.account_id,
                    owner=state.owner,
                    balance=state.balance + amount,
                    is_active=state.is_active,
                    transaction_count=state.transaction_count + 1,
                )
            case MoneyWithdrawn(_, amount, _, _):
                if state.balance < amount:
                    raise ValueError(f"Insufficient balance: balance={state.balance}, withdrawal={amount}")
                return AccountState(
                    account_id=state.account_id,
                    owner=state.owner,
                    balance=state.balance - amount,
                    is_active=state.is_active,
                    transaction_count=state.transaction_count + 1,
                )
            case AccountClosed(_, _, _):
                return AccountState(
                    account_id=state.account_id,
                    owner=state.owner,
                    balance=state.balance,
                    is_active=False,
                    transaction_count=state.transaction_count,
                )

# === Event store ===

class EventStore:
    """Storage for immutable events"""
    def __init__(self):
        self._events: tuple[Event, ...] = ()  # tuple ensures immutability

    def append(self, event: Event) -> "EventStore":
        """Appends a new event (does not mutate the original store)"""
        new_store = EventStore()
        new_store._events = self._events + (event,)
        return new_store

    def replay(self) -> AccountState | None:
        """Replays all events to restore the current state"""
        return reduce(AccountState.apply, self._events, None)

    def replay_at(self, timestamp: datetime) -> AccountState | None:
        """Replays events up to the specified point in time (time travel)"""
        events_until = tuple(
            e for e in self._events
            if e.timestamp <= timestamp
        )
        return reduce(AccountState.apply, events_until, None)

# === Usage example ===

now = datetime.now()
store = EventStore()
store = store.append(AccountCreated("acc-1", "Tanaka", now))
store = store.append(MoneyDeposited("acc-1", 10000, now, "Initial deposit"))
store = store.append(MoneyWithdrawn("acc-1", 3000, now, "Groceries"))
store = store.append(MoneyDeposited("acc-1", 5000, now, "Salary"))

state = store.replay()
print(state)
# AccountState(account_id='acc-1', owner='Tanaka', balance=12000,
#              is_active=True, transaction_count=3)
```

### 5.3 Value Object Pattern

```python
# DDD Value Objects: a representative use case for immutability
from dataclasses import dataclass
from typing import Self

@dataclass(frozen=True, slots=True)
class Money:
    """Value object representing an amount of money"""
    amount: int  # smallest unit (e.g., yen)
    currency: str

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError(f"Amount must be >= 0: {self.amount}")
        if self.currency not in ("JPY", "USD", "EUR"):
            raise ValueError(f"Unsupported currency: {self.currency}")

    def add(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        return Money(self.amount + other.amount, self.currency)

    def subtract(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        if self.amount < other.amount:
            raise ValueError("Insufficient balance")
        return Money(self.amount - other.amount, self.currency)

    def multiply(self, factor: int) -> "Money":
        return Money(self.amount * factor, self.currency)

    def _assert_same_currency(self, other: "Money") -> None:
        if self.currency != other.currency:
            raise ValueError(
                f"Currency mismatch: {self.currency} vs {other.currency}"
            )

    def __str__(self) -> str:
        if self.currency == "JPY":
            return f"¥{self.amount:,}"
        return f"{self.amount / 100:.2f} {self.currency}"


@dataclass(frozen=True, slots=True)
class DateRange:
    """Value object representing a date range"""
    start: date
    end: date

    def __post_init__(self):
        if self.start > self.end:
            raise ValueError(f"Start date is after end date: {self.start} > {self.end}")

    def contains(self, d: date) -> bool:
        return self.start <= d <= self.end

    def overlaps(self, other: "DateRange") -> bool:
        return self.start <= other.end and other.start <= self.end

    def duration_days(self) -> int:
        return (self.end - self.start).days

    def extend(self, days: int) -> "DateRange":
        from datetime import timedelta
        return DateRange(self.start, self.end + timedelta(days=days))


# Benefits of value objects:
# 1. Equality: same value = same object (__eq__ is auto-generated)
# 2. Hashable: can be used as dict keys or set elements (frozen=True)
# 3. Thread-safe: no locks needed because they never change
# 4. Validation: objects in invalid states cannot exist

price_a = Money(1000, "JPY")
price_b = Money(1000, "JPY")
print(price_a == price_b)  # True (value equality)
print(price_a is price_b)  # False (different instances)

prices = {price_a: "Product A"}  # hashable so can be used as dict key
```

### 5.4 Implementing Undo/Redo

```typescript
// Undo/Redo with immutable data (the principle behind time-travel debugging)

interface HistoryState<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

function createHistory<T>(initial: T): HistoryState<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

function pushState<T>(
  history: HistoryState<T>,
  newPresent: T
): HistoryState<T> {
  return {
    past: [...history.past, history.present],
    present: newPresent,
    future: [], // clear future after new change
  };
}

function undo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0) return history; // nothing to undo

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

function redo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.future.length === 0) return history; // nothing to redo

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

// Usage example: text editor
let editorHistory = createHistory("Hello");
editorHistory = pushState(editorHistory, "Hello World");
editorHistory = pushState(editorHistory, "Hello World!");

console.log(editorHistory.present); // "Hello World!"

editorHistory = undo(editorHistory);
console.log(editorHistory.present); // "Hello World"

editorHistory = undo(editorHistory);
console.log(editorHistory.present); // "Hello"

editorHistory = redo(editorHistory);
console.log(editorHistory.present); // "Hello World"
```

---

## 6. Adoption Strategies for Immutability

### 6.1 Gradual Adoption Roadmap

```
Phase 1: Start with Value Objects (1–2 weeks)
──────────────────────────────────────────
  Targets: Money, Email, DateRange, UserId, etc.
  Methods: frozen dataclass / record / value class
  Effects: centralized validation, hashability

Phase 2: Immutify Domain Models (2–4 weeks)
──────────────────────────────────────────
  Targets: entities like User, Order, Product
  Methods: Wither pattern, copy methods
  Effects: explicit state changes, improved testability

Phase 3: Immutify Collection Operations (1–2 weeks)
──────────────────────────────────────────
  Targets: list and map operations
  Methods: map/filter/reduce, spread syntax
  Effects: eliminate side effects, declarative code

Phase 4: Immutify State Management (2–4 weeks)
────────────────────────────────────
  Targets: application state, Redux/Zustand
  Methods: Immer, persistent data structures
  Effects: time-travel debugging, change tracking

Phase 5: Enforce via Lint/Type System (1 week)
────────────────────────────────────────
  Targets: the entire project
  Methods: ESLint no-param-reassign, TypeScript readonly
  Effects: immutability culture embedded across the team
```

### 6.2 Lint Rule Configuration

```json
// .eslintrc.json: rules to enforce immutability
{
  "rules": {
    "no-param-reassign": ["error", {
      "props": true,
      "ignorePropertyModificationsFor": ["draft"]
    }],
    "prefer-const": "error",
    "no-var": "error",
    "no-let": "warn",
    "immutable/no-let": "error",
    "immutable/no-mutation": "warn",
    "functional/no-let": "error",
    "functional/immutable-data": "error",
    "functional/no-method-signature": "warn"
  }
}
```

```yaml
# .pre-commit-config.yaml: immutability check for Python
repos:
  - repo: local
    hooks:
      - id: check-mutable-defaults
        name: Check mutable default arguments
        language: pygrep
        entry: 'def\s+\w+\(.*=\s*(\[\]|\{\}|set\(\))'
        types: [python]
        # BAD: def func(items=[]), def func(data={})
```

---

## 7. Anti-Patterns

### 7.1 Anti-Pattern: The Shallow Copy Trap

```python
# BAD: shallow copy shares nested objects
original = {"user": {"name": "Tanaka", "scores": [90, 85]}}
copied = original.copy()  # shallow copy

copied["user"]["name"] = "Suzuki"
print(original["user"]["name"])  # "Suzuki" ← original also changed!

copied["user"]["scores"].append(95)
print(original["user"]["scores"])  # [90, 85, 95] ← original also changed!

# GOOD: use deep copy or immutable data structures
import copy
deep_copied = copy.deepcopy(original)
deep_copied["user"]["name"] = "Suzuki"
print(original["user"]["name"])  # "Tanaka" ← original unchanged

# Even better: prevent this at the root with frozen dataclass
@dataclass(frozen=True)
class User:
    name: str
    scores: tuple[int, ...]  # tuple is immutable (not list)

    def add_score(self, score: int) -> "User":
        return replace(self, scores=self.scores + (score,))
```

**Problem**: Shallow copies share nested references, so unintended changes propagate. JavaScript's spread syntax `{...obj}` is also a shallow copy with the same issue. Address this with deep copies or immutable data structures.

### 7.2 Anti-Pattern: Forcing Everything to Be Immutable

```python
# BAD: forcing immutability even in performance-critical code
def process_large_dataset_bad(data: tuple) -> tuple:
    result = data
    for i in range(len(data)):
        # copies the entire tuple every time → O(n^2) complexity
        result = result[:i] + (transform(result[i]),) + result[i+1:]
    return result

# ~50x slower for 10,000 elements

# GOOD: mutable internally, immutable at the external interface
def process_large_dataset_good(data: tuple) -> tuple:
    # use a list (mutable) internally for efficient processing
    work_list = list(data)
    for i in range(len(work_list)):
        work_list[i] = transform(work_list[i])
    # return the result as a tuple (immutable)
    return tuple(work_list)
```

**Problem**: Making everything immutable can degrade performance. Clearly define the boundary: "external API (public interface) is immutable; internal implementation can be mutable."

### 7.3 Anti-Pattern: Deeply Nested Immutable Updates

```typescript
// BAD: manually spreading deeply nested updates
const nextState = {
  ...state,
  users: {
    ...state.users,
    [userId]: {
      ...state.users[userId],
      address: {
        ...state.users[userId].address,
        city: newCity,
      },
    },
  },
};
// hard to read and prone to bugs

// GOOD: use Immer for readable updates
const nextState = produce(state, (draft) => {
  draft.users[userId].address.city = newCity;
});

// GOOD: type-safe with the lens pattern
import { pipe } from "fp-ts/function";
import * as L from "monocle-ts/Lens";

const cityLens = pipe(
  L.id<State>(),
  L.prop("users"),
  L.key(userId),
  L.prop("address"),
  L.prop("city")
);

const nextState = pipe(state, cityLens.set(newCity));
```

**Problem**: Deeply nested spread syntax severely degrades readability. Use Immer or a lens library to write it declaratively.

### 7.4 Anti-Pattern: Overusing freeze

```javascript
// BAD: using Object.freeze in performance hot paths
function processItems(items) {
  return items.map((item) => {
    const result = Object.freeze({
      // freezing every time increases GC pressure
      ...item,
      processed: true,
    });
    return result;
  });
}

// GOOD: use the type system (TypeScript) to guarantee immutability,
// and limit Object.freeze to development-time validation
function processItems(items: readonly Item[]): readonly ProcessedItem[] {
  return items.map((item) => ({
    ...item,
    processed: true as const,
  }));
}

// Use Object.freeze for development-time validation
if (process.env.NODE_ENV === "development") {
  deepFreeze(config);
}
```

**Problem**: `Object.freeze` has a runtime cost and affects the GC. It is more efficient to guarantee immutability at compile time via the type system.

---

## 8. Practice Exercises

### Exercise 1 (Basic): Immutable User Management

**Task**: Implement an immutable user management module in Python that satisfies the following requirements.

```python
# Requirements:
# 1. User should be a frozen dataclass (id, name, email, role)
# 2. UserRepository manages an immutable list of users (tuple)
# 3. add_user, remove_user, update_user_email all return a new repository
# 4. Implement find_by_id and find_by_role

# Hint: use replace and tuple operations
```

**Expected Implementation**:

```python
from dataclasses import dataclass, replace
from typing import Optional

@dataclass(frozen=True, slots=True)
class User:
    id: str
    name: str
    email: str
    role: str = "member"

    def with_email(self, new_email: str) -> "User":
        if "@" not in new_email:
            raise ValueError(f"Invalid email address: {new_email}")
        return replace(self, email=new_email)

    def with_role(self, new_role: str) -> "User":
        valid_roles = {"member", "admin", "moderator"}
        if new_role not in valid_roles:
            raise ValueError(f"Invalid role: {new_role}")
        return replace(self, role=new_role)


@dataclass(frozen=True)
class UserRepository:
    users: tuple[User, ...] = ()

    def add(self, user: User) -> "UserRepository":
        if self.find_by_id(user.id) is not None:
            raise ValueError(f"Duplicate user ID: {user.id}")
        return replace(self, users=self.users + (user,))

    def remove(self, user_id: str) -> "UserRepository":
        new_users = tuple(u for u in self.users if u.id != user_id)
        if len(new_users) == len(self.users):
            raise ValueError(f"User not found: {user_id}")
        return replace(self, users=new_users)

    def update(self, user_id: str, updater) -> "UserRepository":
        new_users = tuple(
            updater(u) if u.id == user_id else u
            for u in self.users
        )
        return replace(self, users=new_users)

    def find_by_id(self, user_id: str) -> Optional[User]:
        return next((u for u in self.users if u.id == user_id), None)

    def find_by_role(self, role: str) -> tuple[User, ...]:
        return tuple(u for u in self.users if u.role == role)

    def count(self) -> int:
        return len(self.users)


# Tests
repo = UserRepository()
repo = repo.add(User("1", "Tanaka", "tanaka@example.com"))
repo = repo.add(User("2", "Suzuki", "suzuki@example.com", "admin"))
repo = repo.add(User("3", "Sato", "sato@example.com"))

assert repo.count() == 3
assert repo.find_by_id("1").name == "Tanaka"
assert len(repo.find_by_role("member")) == 2

# Email update
repo = repo.update("1", lambda u: u.with_email("tanaka_new@example.com"))
assert repo.find_by_id("1").email == "tanaka_new@example.com"

# Remove
repo = repo.remove("3")
assert repo.count() == 2
print("All tests passed!")
```

**Expected Output**:
```
All tests passed!
```

---

### Exercise 2 (Intermediate): Immutable Shopping Cart

**Task**: Implement an immutable shopping cart in TypeScript. All operations must be performed immutably.

```typescript
// Requirements:
// 1. CartItem and Cart have readonly properties only
// 2. addItem: increment quantity if item exists, otherwise add it
// 3. removeItem: decrement quantity by 1, and remove when it reaches 0
// 4. applyCoupon: apply a discount rate
// 5. calculateTotal: calculate total amount (tax-inclusive)
// 6. toSummary: return a cart summary as an object
```

**Expected Implementation**:

```typescript
interface CartItem {
  readonly productId: string;
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
}

interface Cart {
  readonly items: readonly CartItem[];
  readonly couponRate: number; // 0.0 ~ 1.0
}

// === Cart operation functions (all pure functions) ===

function createCart(): Cart {
  return { items: [], couponRate: 0 };
}

function addItem(cart: Cart, product: Omit<CartItem, "quantity">): Cart {
  const existingIndex = cart.items.findIndex(
    (item) => item.productId === product.productId
  );

  if (existingIndex >= 0) {
    // existing product: increment quantity
    const updatedItems = cart.items.map((item, i) =>
      i === existingIndex
        ? { ...item, quantity: item.quantity + 1 }
        : item
    );
    return { ...cart, items: updatedItems };
  }

  // new product: add it
  return {
    ...cart,
    items: [...cart.items, { ...product, quantity: 1 }],
  };
}

function removeItem(cart: Cart, productId: string): Cart {
  const existingIndex = cart.items.findIndex(
    (item) => item.productId === productId
  );
  if (existingIndex < 0) return cart;

  const item = cart.items[existingIndex];

  if (item.quantity <= 1) {
    // remove if quantity is 1 or less
    return {
      ...cart,
      items: cart.items.filter((_, i) => i !== existingIndex),
    };
  }

  // decrement quantity by 1
  const updatedItems = cart.items.map((item, i) =>
    i === existingIndex
      ? { ...item, quantity: item.quantity - 1 }
      : item
  );
  return { ...cart, items: updatedItems };
}

function applyCoupon(cart: Cart, rate: number): Cart {
  if (rate < 0 || rate > 1) {
    throw new Error(`Invalid discount rate: ${rate}`);
  }
  return { ...cart, couponRate: rate };
}

function calculateTotal(
  cart: Cart,
  taxRate: number = 0.1
): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const discount = Math.floor(subtotal * cart.couponRate);
  const afterDiscount = subtotal - discount;
  const tax = Math.floor(afterDiscount * taxRate);
  const total = afterDiscount + tax;

  return { subtotal, discount, tax, total };
}

function toSummary(cart: Cart) {
  const totals = calculateTotal(cart);
  return {
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    uniqueProducts: cart.items.length,
    ...totals,
  };
}

// === Tests ===
let cart = createCart();
cart = addItem(cart, { productId: "p1", name: "Apple", price: 200 });
cart = addItem(cart, { productId: "p1", name: "Apple", price: 200 }); // quantity becomes 2
cart = addItem(cart, { productId: "p2", name: "Orange", price: 150 });
cart = applyCoupon(cart, 0.1); // 10% discount

const summary = toSummary(cart);
console.log(summary);
// {
//   itemCount: 3,
//   uniqueProducts: 2,
//   subtotal: 550,  // 200*2 + 150*1
//   discount: 55,   // 550 * 0.1
//   tax: 49,        // (550-55) * 0.1 = 49.5 → 49
//   total: 544      // 495 + 49
// }
```

**Expected Output**:
```
{ itemCount: 3, uniqueProducts: 2, subtotal: 550, discount: 55, tax: 49, total: 544 }
```

---

### Exercise 3 (Advanced): Time-Travel Debugging with Immutable Data

**Task**: Implement a state machine with time-travel debugging capabilities using immutable data in Python.

```python
# Requirements:
# 1. State is a frozen dataclass
# 2. StateMachine holds all state history as an immutable tuple
# 3. dispatch(action) generates a new state
# 4. undo() / redo() for time travel
# 5. get_history() returns the full history
# 6. goto(index) jumps to any point in time
```

**Expected Implementation**:

```python
from dataclasses import dataclass, replace, field
from typing import Callable, Any, TypeVar
from datetime import datetime

S = TypeVar("S")

@dataclass(frozen=True)
class AppState:
    """Application state (immutable)"""
    counter: int = 0
    message: str = ""
    items: tuple[str, ...] = ()
    last_action: str = "INIT"

# Action definition
@dataclass(frozen=True)
class Action:
    type: str
    payload: Any = None
    timestamp: datetime = field(default_factory=datetime.now)

# Pure reducer
def reducer(state: AppState, action: Action) -> AppState:
    """State transition function (pure)"""
    match action.type:
        case "INCREMENT":
            return replace(state, counter=state.counter + 1, last_action="INCREMENT")
        case "DECREMENT":
            return replace(state, counter=state.counter - 1, last_action="DECREMENT")
        case "SET_MESSAGE":
            return replace(state, message=action.payload, last_action="SET_MESSAGE")
        case "ADD_ITEM":
            return replace(
                state,
                items=state.items + (action.payload,),
                last_action="ADD_ITEM"
            )
        case "REMOVE_ITEM":
            return replace(
                state,
                items=tuple(i for i in state.items if i != action.payload),
                last_action="REMOVE_ITEM"
            )
        case "RESET":
            return AppState(last_action="RESET")
        case _:
            return state

@dataclass(frozen=True)
class TimeTravelMachine:
    """State machine with time-travel capability"""
    past: tuple[AppState, ...] = ()
    present: AppState = field(default_factory=AppState)
    future: tuple[AppState, ...] = ()
    action_log: tuple[Action, ...] = ()

    def dispatch(self, action: Action) -> "TimeTravelMachine":
        """Dispatches an action and returns a new state"""
        new_state = reducer(self.present, action)
        return TimeTravelMachine(
            past=self.past + (self.present,),
            present=new_state,
            future=(),  # clear future after a new action
            action_log=self.action_log + (action,),
        )

    def undo(self) -> "TimeTravelMachine":
        """Go back to the previous state"""
        if not self.past:
            return self  # nothing to undo
        previous = self.past[-1]
        return TimeTravelMachine(
            past=self.past[:-1],
            present=previous,
            future=(self.present,) + self.future,
            action_log=self.action_log,
        )

    def redo(self) -> "TimeTravelMachine":
        """Advance to the next state"""
        if not self.future:
            return self  # nothing to redo
        next_state = self.future[0]
        return TimeTravelMachine(
            past=self.past + (self.present,),
            present=next_state,
            future=self.future[1:],
            action_log=self.action_log,
        )

    def goto(self, index: int) -> "TimeTravelMachine":
        """Jump to any point in time"""
        all_states = self.past + (self.present,) + self.future
        if index < 0 or index >= len(all_states):
            raise IndexError(f"Index out of range: {index}")
        return TimeTravelMachine(
            past=all_states[:index],
            present=all_states[index],
            future=all_states[index + 1:],
            action_log=self.action_log,
        )

    def get_history(self) -> list[dict]:
        """Get the full history"""
        all_states = self.past + (self.present,) + self.future
        current_index = len(self.past)
        return [
            {
                "index": i,
                "state": state,
                "is_current": i == current_index,
            }
            for i, state in enumerate(all_states)
        ]

    @property
    def can_undo(self) -> bool:
        return len(self.past) > 0

    @property
    def can_redo(self) -> bool:
        return len(self.future) > 0


# === Tests ===

machine = TimeTravelMachine()

# Dispatch actions
machine = machine.dispatch(Action("INCREMENT"))
machine = machine.dispatch(Action("INCREMENT"))
machine = machine.dispatch(Action("SET_MESSAGE", "Hello"))
machine = machine.dispatch(Action("ADD_ITEM", "Apple"))
machine = machine.dispatch(Action("ADD_ITEM", "Orange"))

assert machine.present.counter == 2
assert machine.present.message == "Hello"
assert machine.present.items == ("Apple", "Orange")

# Undo
machine = machine.undo()
assert machine.present.items == ("Apple",)  # back to before Orange was added

machine = machine.undo()
assert machine.present.message == "Hello"
assert machine.present.items == ()  # back to before Apple was added

# Redo
machine = machine.redo()
assert machine.present.items == ("Apple",)  # forward to after Apple was added

# Goto
machine = machine.goto(0)
assert machine.present.counter == 0  # jump to initial state

machine = machine.goto(2)
assert machine.present.counter == 2  # jump to after 2 INCREMENTs

# Check history
history = machine.get_history()
assert len(history) == 6  # initial + 5 actions
assert history[2]["is_current"] == True

print("All tests passed!")
```

**Expected Output**:
```
All tests passed!
```

---

## 9. FAQ

### Q1: Does immutability negatively impact performance?

**A**: For small to medium-sized data, the impact is negligible. For large-scale data, it can be handled efficiently with structural sharing (Persistent Data Structures) or libraries like Immer.js. In fact, since change detection becomes O(1), it contributes to improved performance in UI frameworks such as React. Only use mutable data locally when a bottleneck has been confirmed. Judging that "performance is bad" without measurement is premature — always profile first, then optimize.

### Q2: Can immutability be maintained when integrating with a database?

**A**: The common approach is to handle data immutably at the application layer and convert at the persistence layer (Repository/DAO). Specifically: convert data retrieved from the DB to an immutable domain model, process all business logic using only immutable data, and then convert back to the DB format when persisting. Adopting event sourcing or CQRS patterns can leverage immutability even at the database layer. Be careful about compatibility with ORM features like lazy loading and dirty checking — a translation layer between the ORM's expected mutability and your immutable model may be necessary.

### Q3: How do I introduce immutability to a team?

**A**: (1) Start with value objects (Money, Date, etc.), (2) apply `readonly`/`final`/`frozen` to new code, (3) configure lint rules to warn on mutable operations (e.g., `no-param-reassign`), (4) promote immutable patterns in code reviews. A gradual rollout avoids resistance. Rather than "rewriting all existing code," apply it to new code first, and immutify the surrounding code each time you make a fix. This incremental approach is effective.

### Q4: Is immutable data truly thread-safe? Isn't an object during initialization dangerous?

**A**: More precisely, a "fully constructed immutable object" is thread-safe. In Java, the initialization of `final` fields is guaranteed to be safe by the Java Memory Model. However, if `this` is published externally from within the constructor, a partially constructed object can be visible to other threads. Rust's ownership system completely prevents this problem. In other languages, the rule "do not leak `this` from constructors" must be followed.

### Q5: What if an ORM or framework requires mutable objects?

**A**: Use the adapter pattern to clarify the boundary. (1) Domain layer: immutable data model (frozen dataclass/record), (2) Infrastructure layer: mutable model required by the ORM (regular class), (3) Translation layer: conversion functions between the immutable model and the ORM model. For Spring Data JPA, use the `@Immutable` annotation; for Django, create a conversion utility like `model_to_frozen_dataclass`. The conversion cost is worth it in exchange for the safety of your domain logic.

### Q6: What is the difference between JavaScript's `const` and immutability?

**A**: `const` only prevents variable reassignment; it still allows property changes on an object. `const obj = {a: 1}; obj.a = 2;` is valid. To achieve true immutability, you need one of the following: `Object.freeze` (runtime), TypeScript's `readonly`/`as const` (type level), or Immer (library). `const` is "immutability of the variable binding," which is a different level of concept from "immutability of the value."

### Q7: Don't immutable data structures put pressure on the GC?

**A**: Generating a large number of short-lived objects does increase GC pressure. However, generational GC (JVM, V8) is very efficient at collecting short-lived objects, and this is often not a problem in practice. Using structural sharing can dramatically reduce the number of new objects created. In Rust, there is no GC, so this problem does not exist thanks to deterministic memory deallocation via the ownership system. GC pressure becoming an issue is limited to special cases such as game engines or real-time systems that generate objects at extremely high frequencies (hundreds of thousands per second).

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## 10. Summary

| Category | Key Point |
|---------|---------|
| Principle | Immutable by default; mutability is explicit |
| Thread Safety | Immutable data needs no locks — concurrent processing is safe |
| Predictability | Values don't change → easier to debug and test |
| Change Detection | Reference comparison O(1) for efficient UI updates |
| Performance | Structural sharing / Immer handles large-scale data efficiently |
| Language Choice | Rust is immutable by default; other languages use libraries/conventions |
| Adoption Strategy | Gradual rollout starting from value objects, reinforced by lint |
| Architecture | Works well with Event Sourcing, CQRS, and Redux |
| Tradeoff | Internal implementation can be mutable; public APIs should be immutable |

| Language | Immutability Support | Recommended Pattern |
|------|-------------|------------|
| TypeScript | readonly, as const, DeepReadonly | Spread syntax + Immer |
| Java | final, Record, List.of() | Record + Wither pattern |
| Python | frozen dataclass, NamedTuple | frozen dataclass + replace |
| Rust | Immutable by default, ownership system | Use language features directly |
| Kotlin | val, data class, listOf() | data class + copy |
| Scala | val, case class, persistent collections | Use language features directly |

---

## Next Guides to Read

- [01-composition-over-inheritance.md](./01-composition-over-inheritance.md) -- Composition over inheritance
- [02-functional-principles.md](./02-functional-principles.md) -- Functional programming principles (the deep relationship between pure functions and immutability)
- [03-api-design.md](./03-api-design.md) -- API design (immutable request/response models)
- 00-principles/02-solid.md -- SOLID principles (especially the relationship between OCP and immutability)
- [02-refactoring/00-code-smells.md](../02-refactoring/00-code-smells.md) -- Code smells (patterns of mutable state abuse)
- `design-patterns-guide/docs/03-functional/` -- Functional design patterns
- `system-design-guide/docs/02-architecture/` -- Architecture patterns (Event Sourcing, CQRS)

---

## References

1. Joshua Bloch, "Effective Java" 3rd Edition -- Item 17: Minimize mutability
2. Michael Feathers, "Working Effectively with Legacy Code" -- Immutability as a tool for safety
3. Immer.js Documentation -- https://immerjs.github.io/immer/
4. Rust Book, "Understanding Ownership" -- https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html
5. Eric Evans, "Domain-Driven Design" -- Value Objects
6. Rich Hickey, "The Value of Values" -- https://www.infoq.com/presentations/Value-Values/ (a talk on immutability by the creator of Clojure)
7. Chris Okasaki, "Purely Functional Data Structures" -- Theory and implementation of persistent data structures
8. Gary Bernhardt, "Boundaries" -- https://www.destroyallsoftware.com/talks/boundaries (Functional Core / Imperative Shell)
9. Martin Fowler, "ValueObject" -- https://martinfowler.com/bliki/ValueObject.html
10. Kotlin Documentation, "Properties and Fields" -- https://kotlinlang.org/docs/properties.html
