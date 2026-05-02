# Prototype Pattern

> A creational pattern that generates new objects by **cloning** existing ones, avoiding the cost of re-executing constructors.

---

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| Object-Oriented Programming | Basic | OOP Basics |
| Interfaces and Abstract Classes | Basic | Interface Design |
| Reference Types vs Primitive Types | Understanding | Language Reference |
| Generics | Basic | TypeScript Generics |
| Memory Model (Stack & Heap) | Understanding | CS Basics |

---

## What You Will Learn

1. The **purpose** of the Prototype pattern and why objects are created by cloning rather than through constructors
2. The difference between **Shallow Copy** and **Deep Copy** — when to use each and common implementation pitfalls
3. Clone implementation in various languages (TypeScript / Python / Java / Go / Kotlin)
4. Managing prototypes as a catalog using the **Prototype Registry** pattern
5. Risks and anti-patterns associated with cloning, and criteria for deciding when to use this pattern

---

## Why the Prototype Pattern Is Needed (WHY)

### Problem: The Cost and Constraints of Re-running Constructors

Creating an object involves executing its constructor. In the following scenarios, constructor-based creation becomes a bottleneck or a design constraint.

```
[Problem 1: High creation cost]
  When creating multiple objects whose constructors perform
  DB connections, external API calls, or bulk data loading
  → Repeating the same initialization every time is wasteful

[Problem 2: Type determined at runtime]
  When the class of the instance to be created is determined
  at runtime rather than at compile time
  → Cannot hardcode new ConcreteClass()

[Problem 3: Reproducing complex initial state]
  When you want to replicate a "certain state" of an object
  with many properties into another object
  → Passing all constructor arguments is cumbersome and fragile

[Problem 4: Framework/library constraints]
  When the internal structure of an object provided by
  an external library is private, but you need a copy of it
  → Cannot access private fields
```

### Solution: Creation by Cloning

The Prototype pattern takes the approach of "**creating a new object by copying an already-completed existing object**."

```
Traditional approach:
  Blueprint (class) → new → object → initialize → configure → complete

Prototype approach:
  Completed object → clone() → independent new object
                                  ↓
                               Ready to use immediately
```

With this pattern:
- Initialization cost can be limited to **just once**
- Objects can be copied without knowing their type at runtime
- Complex state can be reproduced accurately
- Private fields can also be copied (accessible from the clone() method within the same class)

---

## 1. Structure of Prototype

### Class Diagram

```
+-------------------+
|   <<interface>>   |
|    Prototype      |
+-------------------+
| + clone(): Self   |
+-------------------+
        △
        |
+-------------------+       clone()       +-------------------+
| ConcretePrototype |───────────────────>>| Copied            |
+-------------------+                     | Object            |
| - field1: T       |                     +-------------------+
| - field2: U       |                     | - field1: T (copy)|
| - nested: V       |                     | - field2: U (copy)|
| + clone(): Self   |                     | - nested: V (???) |
+-------------------+                     +-------------------+
                                              ↑
                                     Shallow? Deep? is the design decision
```

### Prototype Registry Structure

```
+-------------------+          +-------------------+
|     Client        |          | PrototypeRegistry |
+-------------------+          +-------------------+
| + operation()     |--------->| - prototypes: Map |
+-------------------+          | + register(key,p) |
                               | + get(key): Proto |
                               +-------------------+
                                         |
                          +--------------+--------------+
                          |              |              |
                   +----------+   +----------+   +----------+
                   | Proto A  |   | Proto B  |   | Proto C  |
                   +----------+   +----------+   +----------+
                   | clone()  |   | clone()  |   | clone()  |
                   +----------+   +----------+   +----------+
```

### Sequence Diagram

```
Client          Registry         Prototype(original)    Clone
  |                |                    |                  |
  |--get("typeA")-->|                   |                  |
  |                |--clone()---------->|                  |
  |                |                    |--new(copy)------>|
  |                |                    |    (Deep Copy)   |
  |                |<---clone instance--|                  |
  |<--returned-----|                    |                  |
  |                                                       |
  |--modify()------------------------------------------------>|
  |                                     |                  |
  |             (original is not affected)                  |
```

---

## 2. Shallow Copy vs Deep Copy

### Conceptual Diagram

```
=== Shallow Copy ===

┌──────────────┐    clone    ┌──────────────┐
│   Original   │ ──────────> │    Clone     │
│ name: "A"    │             │ name: "A"    │  ← primitives are copied
│ age: 25      │             │ age: 25      │  ← primitives are copied
│ tags: ───────┼──┐          │ tags: ───────┼──┐
│ addr: ───────┼──┼──┐       │ addr: ───────┼──┼──┐
└──────────────┘  │  │       └──────────────┘  │  │
                  v  │                         v  │
            ┌────────┐│                  Same reference! │
            │["a","b"]│                            │
            └────────┘                             │
                  ┌────────────┐                   │
                  │{city:"NYC"}│ <── Same object!
                  └────────────┘


=== Deep Copy ===

┌──────────────┐    clone    ┌──────────────┐
│   Original   │ ──────────> │    Clone     │
│ name: "A"    │             │ name: "A"    │
│ age: 25      │             │ age: 25      │
│ tags: ───────┼──┐          │ tags: ───────┼──┐
│ addr: ───────┼──┼──┐       │ addr: ───────┼──┼──┐
└──────────────┘  │  │       └──────────────┘  │  │
                  v  │                         v  │
            ┌────────┐│               ┌────────┐  │
            │["a","b"]│               │["a","b"]│  │ ← separate array
            └────────┘                └────────┘  │
                  ┌────────────┐  ┌────────────┐  │
                  │{city:"NYC"}│  │{city:"NYC"}│<─┘ ← separate object
                  └────────────┘  └────────────┘
```

### When to Use Which

```
Want to copy an object
        |
  Are all fields primitives or immutable?
  |                                            |
  Yes                                          No
  |                                            |
  v                                            v
Shallow Copy is sufficient             Has reference-type fields
(String, number, boolean,               |
 readonly, frozen)                  Will you modify after copying?
                                    |                    |
                                    Yes                  No (read-only)
                                    |                    |
                                    v                    v
                                Deep Copy required    Shallow Copy + caution
                                    |
                            +-------+--------+
                            |                |
                      structuredClone    manual recursive copy
                      JSON.parse/stringify (for circular refs,
                      copy.deepcopy      special type handling)
```

---

## 3. Code Examples

### Code Example 1: TypeScript — Basic Prototype Interface

```typescript
// Cloneable interface
// Defines a clone() method that returns an object of the same type
interface Cloneable<T> {
  clone(): T;
}

// Shape base class
class Shape implements Cloneable<Shape> {
  constructor(
    public x: number,
    public y: number,
    public color: string
  ) {}

  clone(): Shape {
    // Only primitives, so Shallow Copy is sufficient
    return new Shape(this.x, this.y, this.color);
  }

  toString(): string {
    return `Shape(${this.x}, ${this.y}, ${this.color})`;
  }
}

// Circle: extends Shape
class Circle extends Shape {
  constructor(
    x: number,
    y: number,
    color: string,
    public radius: number
  ) {
    super(x, y, color);
  }

  // Return type specialized to Circle (covariant return type)
  clone(): Circle {
    return new Circle(this.x, this.y, this.color, this.radius);
  }

  toString(): string {
    return `Circle(${this.x}, ${this.y}, ${this.color}, r=${this.radius})`;
  }
}

// Rectangle: extends Shape
class Rectangle extends Shape {
  constructor(
    x: number,
    y: number,
    color: string,
    public width: number,
    public height: number
  ) {
    super(x, y, color);
  }

  clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.color, this.width, this.height);
  }
}

// Usage example
const original = new Circle(10, 20, "red", 50);
const copy = original.clone();
copy.color = "blue";
copy.x = 100;

console.log(original.toString()); // Circle(10, 20, red, r=50)  — independent
console.log(copy.toString());     // Circle(100, 20, blue, r=50) — independent
console.log(original !== copy);   // true — separate instances
console.log(copy instanceof Circle); // true — type is preserved
```

**Key Points**: By calling the constructor inside the clone() method, both the type information and field values are accurately copied. Overriding clone() in each subclass achieves covariant return types.

---

### Code Example 2: Deep Copy (Comparing structuredClone vs Manual Implementation)

```typescript
// === Case where Deep Copy is needed: nested objects ===

class Section {
  constructor(
    public heading: string,
    public content: string,
    public subsections: Section[] = []
  ) {}

  clone(): Section {
    return new Section(
      this.heading,
      this.content,
      this.subsections.map(s => s.clone()) // recursively Deep Copy
    );
  }
}

class Document implements Cloneable<Document> {
  constructor(
    public title: string,
    public sections: Section[],
    public metadata: Map<string, string> = new Map()
  ) {}

  // Method 1: Manual Deep Copy (recommended: fully preserves methods and type info)
  clone(): Document {
    const clonedSections = this.sections.map(s => s.clone());
    const clonedMetadata = new Map(this.metadata);
    return new Document(this.title, clonedSections, clonedMetadata);
  }

  // Method 2: structuredClone (note: methods are lost)
  cloneWithStructuredClone(): Document {
    // Note: structuredClone only copies plain data
    // Class methods, Map, Set custom behavior may be lost
    const data = structuredClone({
      title: this.title,
      sections: this.sections.map(s => ({
        heading: s.heading,
        content: s.content,
        subsections: s.subsections
      })),
      metadata: Object.fromEntries(this.metadata)
    });
    return new Document(
      data.title,
      data.sections.map(
        (s: any) => new Section(s.heading, s.content, s.subsections)
      ),
      new Map(Object.entries(data.metadata))
    );
  }

  // Method 3: JSON.parse/stringify (simplest but has limitations)
  cloneWithJson(): Document {
    // Limitations: does not support Date, Map, Set, undefined, functions, circular refs
    const plain = JSON.parse(JSON.stringify({
      title: this.title,
      sections: this.sections
    }));
    return new Document(
      plain.title,
      plain.sections.map(
        (s: any) => new Section(s.heading, s.content, s.subsections || [])
      )
    );
  }
}

// Verification
const doc = new Document("Report", [
  new Section("Intro", "Introduction text", [
    new Section("Background", "Background detail")
  ]),
  new Section("Body", "Main content"),
]);
doc.metadata.set("author", "Taro");
doc.metadata.set("version", "1.0");

const copy = doc.clone();
copy.sections[0].heading = "Changed Intro";
copy.sections[0].subsections[0].content = "Modified";
copy.metadata.set("version", "2.0");

console.log(doc.sections[0].heading);                  // "Intro" — independent
console.log(doc.sections[0].subsections[0].content);   // "Background detail" — independent
console.log(doc.metadata.get("version"));              // "1.0" — independent
```

**Comparison of Deep Copy methods**:

| Method | Preserves Methods | Circular Refs | Map/Set | Date | Performance |
|------|:---:|:---:|:---:|:---:|:---:|
| Manual clone() | Yes | Supported | Yes | Yes | Fastest |
| structuredClone | No | Yes | Yes | Yes | Medium |
| JSON.parse/stringify | No | No | No | No | Slow |
| lodash.cloneDeep | No | Yes | Yes | Yes | Medium |

---

### Code Example 3: Prototype Registry Pattern

```typescript
// Registry that manages prototypes by key and provides clones on demand
class PrototypeRegistry<T extends Cloneable<T>> {
  private prototypes = new Map<string, T>();

  // Register a prototype
  register(key: string, prototype: T): void {
    this.prototypes.set(key, prototype);
  }

  // Unregister a prototype
  unregister(key: string): boolean {
    return this.prototypes.delete(key);
  }

  // Get a clone
  create(key: string): T {
    const proto = this.prototypes.get(key);
    if (!proto) {
      throw new Error(
        `Prototype "${key}" not found. Available: ${[...this.prototypes.keys()].join(", ")}`
      );
    }
    return proto.clone();
  }

  // List registered keys
  keys(): string[] {
    return [...this.prototypes.keys()];
  }

  // Check if a key is registered
  has(key: string): boolean {
    return this.prototypes.has(key);
  }
}

// Usage example: shape prototype registry
const shapeRegistry = new PrototypeRegistry<Shape>();

// Register default prototypes
shapeRegistry.register("small-red-circle", new Circle(0, 0, "red", 10));
shapeRegistry.register("large-blue-circle", new Circle(0, 0, "blue", 100));
shapeRegistry.register("standard-rect", new Rectangle(0, 0, "gray", 200, 100));

// Usage: generate clones from prototypes
const c1 = shapeRegistry.create("small-red-circle");
const c2 = shapeRegistry.create("small-red-circle");

console.log(c1 !== c2);          // true — separate instances
console.log(c1.toString());      // Circle(0, 0, red, r=10)

// Customization
c1.x = 50;
c1.y = 100;
console.log(c1.toString());      // Circle(50, 100, red, r=10)
```

**Benefits of the Registry pattern**:
- **Centralized management** of prototypes: all templates in one place
- **Dynamic registration at runtime**: prototypes can be registered from config files or API responses
- **Hiding class names**: clients do not need to know concrete classes
- **Combination with Factory**: Prototype can be used as the internal implementation of a Factory pattern

---

### Code Example 4: Python — copy Module and __copy__ / __deepcopy__

```python
import copy
from dataclasses import dataclass, field
from typing import Self

# === Method 1: Default behavior of the copy module ===

class GameState:
    """Class that manages game state"""
    def __init__(self, level: int, inventory: list[str], stats: dict[str, int]):
        self.level = level
        self.inventory = inventory
        self.stats = stats

    def shallow_clone(self) -> "GameState":
        """Shallow copy: inventory and stats reference the same objects"""
        return copy.copy(self)

    def deep_clone(self) -> "GameState":
        """Deep copy: all nested objects are recursively copied"""
        return copy.deepcopy(self)

    def __repr__(self) -> str:
        return f"GameState(lv={self.level}, inv={self.inventory}, stats={self.stats})"


# Verification
state = GameState(5, ["sword", "shield"], {"hp": 100, "mp": 50})

# The pitfall of shallow copy
shallow = state.shallow_clone()
shallow.inventory.append("potion")
print(state.inventory)    # ["sword", "shield", "potion"] ← original changes too!
print(shallow.inventory)  # ["sword", "shield", "potion"]

# Safety of deep copy
state2 = GameState(5, ["sword", "shield"], {"hp": 100, "mp": 50})
deep = state2.deep_clone()
deep.inventory.append("potion")
deep.stats["hp"] = 80
print(state2.inventory)   # ["sword", "shield"] ← independent
print(state2.stats)       # {"hp": 100, "mp": 50} ← independent


# === Method 2: Customizing __copy__ / __deepcopy__ ===

class CachedResource:
    """Resource with cache: want to reset cache on clone"""
    def __init__(self, url: str, data: dict, cache: dict | None = None):
        self.url = url
        self.data = data
        self._cache = cache or {}
        self._fetch_count = 0

    def __copy__(self) -> "CachedResource":
        """Customize shallow copy: reset cache and counter"""
        new = CachedResource(self.url, self.data)
        new._cache = {}  # reset cache
        new._fetch_count = 0
        return new

    def __deepcopy__(self, memo: dict) -> "CachedResource":
        """Customize deep copy: deep copy data, reset cache"""
        new = CachedResource(
            copy.deepcopy(self.url, memo),
            copy.deepcopy(self.data, memo)
        )
        new._cache = {}
        new._fetch_count = 0
        return new


resource = CachedResource("https://api.example.com", {"key": "value"}, {"cached": True})
cloned = copy.deepcopy(resource)
print(cloned._cache)        # {} ← cache has been reset
print(cloned.data)           # {"key": "value"} ← data is copied
print(resource.data is cloned.data)  # False ← independent objects


# === Method 3: dataclass + custom clone ===

@dataclass
class Config:
    """Configuration class (dataclass version)"""
    host: str
    port: int
    options: dict[str, str] = field(default_factory=dict)

    def clone(self) -> "Config":
        """Generate an independent copy using Deep Copy"""
        return Config(
            host=self.host,
            port=self.port,
            options=dict(self.options)  # shallow copy of dict (sufficient since values are str)
        )
```

---

### Code Example 5: Java — Cloneable and Copy Constructor

```java
// === Method 1: Cloneable interface ===
// Note: Java's Cloneable has many design issues and is now considered deprecated

public class Spreadsheet implements Cloneable {
    private String name;
    private List<List<String>> cells;
    private Map<String, String> metadata;

    public Spreadsheet(String name, List<List<String>> cells) {
        this.name = name;
        this.cells = cells;
        this.metadata = new HashMap<>();
    }

    @Override
    public Spreadsheet clone() {
        try {
            Spreadsheet copy = (Spreadsheet) super.clone();
            // Deep copy of cells (2D list)
            copy.cells = new ArrayList<>();
            for (List<String> row : this.cells) {
                copy.cells.add(new ArrayList<>(row));
            }
            // Deep copy of metadata
            copy.metadata = new HashMap<>(this.metadata);
            return copy;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError("Unreachable since Cloneable is implemented");
        }
    }
}


// === Method 2: Copy Constructor (recommended) ===
// Recommended approach from Effective Java

public class SpreadsheetV2 {
    private final String name;
    private final List<List<String>> cells;
    private final Map<String, String> metadata;

    // Regular constructor
    public SpreadsheetV2(String name, List<List<String>> cells) {
        this.name = name;
        this.cells = cells;
        this.metadata = new HashMap<>();
    }

    // Copy Constructor
    public SpreadsheetV2(SpreadsheetV2 other) {
        this.name = other.name;
        this.cells = new ArrayList<>();
        for (List<String> row : other.cells) {
            this.cells.add(new ArrayList<>(row));
        }
        this.metadata = new HashMap<>(other.metadata);
    }

    // Static Factory Method form
    public static SpreadsheetV2 copyOf(SpreadsheetV2 other) {
        return new SpreadsheetV2(other);
    }
}


// === Method 3: Deep Copy via Serialization ===
import java.io.*;

public class DeepCopyUtil {
    @SuppressWarnings("unchecked")
    public static <T extends Serializable> T deepCopy(T original) {
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            ObjectOutputStream oos = new ObjectOutputStream(bos);
            oos.writeObject(original);
            oos.close();

            ByteArrayInputStream bis = new ByteArrayInputStream(bos.toByteArray());
            ObjectInputStream ois = new ObjectInputStream(bis);
            return (T) ois.readObject();
        } catch (IOException | ClassNotFoundException e) {
            throw new RuntimeException("Deep copy failed", e);
        }
    }
}


// Usage example
SpreadsheetV2 original = new SpreadsheetV2("Budget", List.of(
    new ArrayList<>(List.of("Item", "Cost")),
    new ArrayList<>(List.of("Server", "500"))
));

SpreadsheetV2 copy = new SpreadsheetV2(original); // Copy Constructor
// or
SpreadsheetV2 copy2 = SpreadsheetV2.copyOf(original); // Static Factory
```

**Issues with Java's Cloneable (from Effective Java)**:
1. `Cloneable` is a marker interface with no methods, yet it changes the behavior of `Object.clone()`
2. The return type of `clone()` is `Object` (casting is required)
3. The checked exception `CloneNotSupportedException` is cumbersome
4. `super.clone()` only performs a Shallow Copy
5. Cannot assign to final fields

**Recommendation**: Use a Copy Constructor or Static Factory Method

---

### Code Example 6: Go — Interface-Based Clone

```go
package main

import "fmt"

// Cloneable interface
type Cloneable[T any] interface {
    Clone() T
}

// Shape struct
type Shape struct {
    X, Y  int
    Color string
    Tags  []string
}

// Clone: implements Deep Copy
func (s *Shape) Clone() *Shape {
    // Copy the Tags slice into a new one
    tagsCopy := make([]string, len(s.Tags))
    copy(tagsCopy, s.Tags)

    return &Shape{
        X:     s.X,
        Y:     s.Y,
        Color: s.Color,
        Tags:  tagsCopy,
    }
}

// Circle struct
type Circle struct {
    Shape  // embedded
    Radius float64
}

// Clone: Deep Copy including embedded struct
func (c *Circle) Clone() *Circle {
    shapeCopy := c.Shape.Clone()
    return &Circle{
        Shape:  *shapeCopy,
        Radius: c.Radius,
    }
}

// Document struct (with nesting)
type Document struct {
    Title    string
    Sections []Section
    Meta     map[string]string
}

type Section struct {
    Heading string
    Content string
}

func (d *Document) Clone() *Document {
    // Deep Copy of Sections
    sections := make([]Section, len(d.Sections))
    for i, s := range d.Sections {
        sections[i] = Section{
            Heading: s.Heading,
            Content: s.Content,
        }
    }

    // Deep Copy of Map
    meta := make(map[string]string, len(d.Meta))
    for k, v := range d.Meta {
        meta[k] = v
    }

    return &Document{
        Title:    d.Title,
        Sections: sections,
        Meta:     meta,
    }
}

func main() {
    original := &Circle{
        Shape:  Shape{X: 10, Y: 20, Color: "red", Tags: []string{"important"}},
        Radius: 50,
    }

    cloned := original.Clone()
    cloned.Color = "blue"
    cloned.Tags = append(cloned.Tags, "modified")

    fmt.Println(original.Color, original.Tags) // red [important] — independent
    fmt.Println(cloned.Color, cloned.Tags)     // blue [important modified]
}
```

---

### Code Example 7: Kotlin — data class copy() and Manual Clone

```kotlin
// === Method 1: data class copy() (Shallow Copy) ===

data class Address(
    val city: String,
    val street: String
)

data class User(
    val name: String,
    val age: Int,
    val address: Address,    // reference type
    val tags: MutableList<String>  // mutable collection
)

fun main() {
    val original = User(
        name = "Taro",
        age = 25,
        address = Address("Tokyo", "Shibuya"),
        tags = mutableListOf("admin", "user")
    )

    // data class copy() is a Shallow Copy
    val shallow = original.copy(name = "Jiro")

    // Address is immutable (val + data class), so this is safe
    println(original.address === shallow.address) // true (same reference, but immutable so no problem)

    // MutableList is a shallow copy — dangerous!
    shallow.tags.add("editor")
    println(original.tags) // [admin, user, editor] ← original changes too!
}


// === Method 2: Manually implement Deep Copy ===

data class UserV2(
    val name: String,
    val age: Int,
    val address: Address,
    val tags: List<String>  // use immutable list (solved by design)
) {
    // Deep Copy method
    fun deepCopy(): UserV2 = UserV2(
        name = this.name,
        age = this.age,
        address = this.address.copy(), // data class copy() is fine (all fields are val String)
        tags = this.tags.toList()      // generate a new list
    )
}


// === Method 3: sealed interface + clone ===

sealed interface ShapeK {
    fun clone(): ShapeK
}

data class CircleK(
    val x: Int,
    val y: Int,
    val radius: Double,
    val color: String
) : ShapeK {
    override fun clone(): CircleK = this.copy()
}

data class RectangleK(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int,
    val color: String
) : ShapeK {
    override fun clone(): RectangleK = this.copy()
}

// Usage example: polymorphic cloning
fun duplicateShapes(shapes: List<ShapeK>): List<ShapeK> {
    return shapes.map { it.clone() }
}
```

---

### Code Example 8: Combining Prototype + Factory Patterns

```typescript
// Factory that internally uses Prototype
// Only the factory interface is exposed to the client

interface Notification {
  title: string;
  body: string;
  priority: "low" | "medium" | "high";
  channels: string[];
  clone(): Notification;
}

class EmailNotification implements Notification {
  constructor(
    public title: string,
    public body: string,
    public priority: "low" | "medium" | "high",
    public channels: string[],
    public templateId: string
  ) {}

  clone(): EmailNotification {
    return new EmailNotification(
      this.title,
      this.body,
      this.priority,
      [...this.channels],
      this.templateId
    );
  }
}

class SlackNotification implements Notification {
  constructor(
    public title: string,
    public body: string,
    public priority: "low" | "medium" | "high",
    public channels: string[],
    public webhookUrl: string
  ) {}

  clone(): SlackNotification {
    return new SlackNotification(
      this.title,
      this.body,
      this.priority,
      [...this.channels],
      this.webhookUrl
    );
  }
}

// NotificationFactory: manages Prototypes internally
class NotificationFactory {
  private prototypes = new Map<string, Notification>();

  constructor() {
    // Register default templates
    this.prototypes.set("welcome-email", new EmailNotification(
      "Welcome!",
      "Welcome to our service.",
      "medium",
      ["email"],
      "tmpl-welcome-001"
    ));
    this.prototypes.set("alert-slack", new SlackNotification(
      "Alert",
      "System alert detected.",
      "high",
      ["#alerts"],
      "https://hooks.slack.com/xxx"
    ));
  }

  // Factory method: clone a Prototype and customize
  create(type: string, overrides?: Partial<Notification>): Notification {
    const proto = this.prototypes.get(type);
    if (!proto) throw new Error(`Unknown notification type: ${type}`);

    const notification = proto.clone();
    if (overrides) {
      Object.assign(notification, overrides);
    }
    return notification;
  }

  // Dynamically register a new template
  registerTemplate(name: string, prototype: Notification): void {
    this.prototypes.set(name, prototype);
  }
}

// Usage example
const factory = new NotificationFactory();

const welcome = factory.create("welcome-email", {
  title: "Welcome, Taro!",
  body: "Your account has been created."
});

const alert = factory.create("alert-slack", {
  body: "CPU usage exceeded 90%"
});

console.log(welcome); // EmailNotification with customized title/body
console.log(alert);   // SlackNotification with customized body
```

---

### Code Example 9: State Cloning for Undo/Redo (Memento + Prototype)

```typescript
// Clone editor state and save it to the Undo/Redo stack

interface EditorState {
  content: string;
  cursorPosition: number;
  selections: Array<{ start: number; end: number }>;
  clone(): EditorState;
}

class TextEditorState implements EditorState {
  constructor(
    public content: string,
    public cursorPosition: number,
    public selections: Array<{ start: number; end: number }>
  ) {}

  clone(): TextEditorState {
    return new TextEditorState(
      this.content,
      this.cursorPosition,
      this.selections.map(s => ({ ...s })) // Deep Copy
    );
  }
}

class TextEditor {
  private state: TextEditorState;
  private undoStack: TextEditorState[] = [];
  private redoStack: TextEditorState[] = [];
  private readonly maxHistory = 50;

  constructor() {
    this.state = new TextEditorState("", 0, []);
  }

  // Save a clone before modifying state
  private saveState(): void {
    this.undoStack.push(this.state.clone());
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift(); // remove oldest history
    }
    this.redoStack = []; // clear Redo stack
  }

  type(text: string): void {
    this.saveState();
    const before = this.state.content.slice(0, this.state.cursorPosition);
    const after = this.state.content.slice(this.state.cursorPosition);
    this.state.content = before + text + after;
    this.state.cursorPosition += text.length;
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.state.clone());
    this.state = this.undoStack.pop()!;
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.state.clone());
    this.state = this.redoStack.pop()!;
  }

  getContent(): string {
    return this.state.content;
  }

  getCursorPosition(): number {
    return this.state.cursorPosition;
  }
}

// Usage example
const editor = new TextEditor();
editor.type("Hello");
editor.type(", World!");
console.log(editor.getContent()); // "Hello, World!"

editor.undo();
console.log(editor.getContent()); // "Hello"

editor.undo();
console.log(editor.getContent()); // ""

editor.redo();
console.log(editor.getContent()); // "Hello"
```

---

### Code Example 10: Deep Copy of Objects with Circular References

```typescript
// Deep Copy of objects with circular references requires special handling

class TreeNode {
  children: TreeNode[] = [];
  parent: TreeNode | null = null;

  constructor(public name: string, public value: number) {}

  addChild(child: TreeNode): void {
    child.parent = this;
    this.children.push(child);
  }

  // Deep Copy with circular reference support
  // Track already-cloned nodes with a visited map
  clone(visited = new Map<TreeNode, TreeNode>()): TreeNode {
    // If already cloned, return it (resolves circular reference)
    if (visited.has(this)) {
      return visited.get(this)!;
    }

    // Create a new node and register it in visited
    const cloned = new TreeNode(this.name, this.value);
    visited.set(this, cloned);

    // Recursively clone child nodes
    for (const child of this.children) {
      const clonedChild = child.clone(visited);
      clonedChild.parent = cloned;
      cloned.children.push(clonedChild);
    }

    return cloned;
  }

  toString(indent = 0): string {
    const prefix = "  ".repeat(indent);
    let result = `${prefix}${this.name}(${this.value})`;
    for (const child of this.children) {
      result += "\n" + child.toString(indent + 1);
    }
    return result;
  }
}

// Usage example
const root = new TreeNode("root", 0);
const a = new TreeNode("A", 1);
const b = new TreeNode("B", 2);
const c = new TreeNode("C", 3);

root.addChild(a);
root.addChild(b);
a.addChild(c);

const clonedRoot = root.clone();
clonedRoot.children[0].name = "A-modified";
clonedRoot.children[0].value = 999;

console.log(root.toString());
// root(0)
//   A(1)
//     C(3)
//   B(2)

console.log(clonedRoot.toString());
// root(0)
//   A-modified(999)  ← independent
//     C(3)
//   B(2)

// Verify parent-child relationships
console.log(clonedRoot.children[0].parent === clonedRoot); // true
console.log(clonedRoot.children[0].parent === root);       // false (independent)
```

---

## 4. Comparison Tables

### Comparison Table 1: Shallow Copy vs Deep Copy

| Aspect | Shallow Copy | Deep Copy |
|------|:---:|:---:|
| Copy speed | **Fast** (O(n) field count) | **Slow** (O(N) total node count) |
| Memory usage | **Less** (shared references) | **More** (everything duplicated) |
| Reference sharing | **Yes** (side-effect risk) | **No** (fully independent) |
| Safety | **Low** (changes propagate) | **High** (fully independent) |
| Implementation difficulty | **Low** | **Medium to High** (circular ref handling, etc.) |
| Use with immutable data | **Safe** (no modifications) | **Unnecessary** (copying itself is wasteful) |
| Use cases | Immutable data, read-only, performance-critical | Mutable data, independent modifications needed |

### Comparison Table 2: Prototype vs Factory vs Constructor vs Copy Constructor

| Aspect | Prototype(clone) | Factory Method | Constructor | Copy Constructor |
|------|:---:|:---:|:---:|:---:|
| Creation cost | Low (copy) | Medium | High (initialization) | Low (copy) |
| Retains pre-configured state | **Yes** | Requires setup | No | **Yes** |
| Dynamic type determination | **Yes** | **Yes** | No | No |
| Type safety | Medium | High | High | High |
| Private field access | **Accessible** | Requires getter | N/A | **Accessible** |
| Language support | All languages | All languages | All languages | Java/C++/Kotlin |
| Recommendation | Medium | High | Basic | High (Java) |

### Comparison Table 3: Clone Implementation Comparison by Language

| Language | Standard Approach | Deep Copy Support | Recommended Approach |
|------|---------|:---:|---------|
| TypeScript | Custom clone() | structuredClone | Manual clone() + structuredClone combined |
| Python | copy.copy/deepcopy | **Built-in** | copy.deepcopy + __deepcopy__ customization |
| Java | Cloneable.clone() | Serialization | **Copy Constructor** (recommended by Effective Java) |
| Go | Manual implementation | None | Clone() method per struct |
| Kotlin | data class copy() | None | data class copy() + immutable design |
| C# | ICloneable.Clone() | None | Manual Deep Copy + record types |
| Rust | Clone trait | Clone derive | `#[derive(Clone)]` |

---

## 5. Anti-Patterns

### Anti-Pattern 1: Sharing Mutable Objects with Shallow Copy

```typescript
// NG: Shallow Copy shares arrays and objects
class Config {
  constructor(
    public name: string,
    public plugins: string[],
    public settings: Record<string, unknown>
  ) {}

  clone(): Config {
    // Object.assign is a Shallow Copy!
    return Object.assign(new Config("", [], {}), this);
    // plugins and settings share the same reference
  }
}

const a = new Config("prod", ["auth", "logger"], { debug: false });
const b = a.clone();
b.plugins.push("cache");
b.settings.debug = true;

console.log(a.plugins);        // ["auth", "logger", "cache"] ← unintended modification!
console.log(a.settings.debug); // true ← unintended modification!
```

```typescript
// OK: Explicitly Deep Copy reference-type fields
class Config {
  constructor(
    public name: string,
    public plugins: string[],
    public settings: Record<string, unknown>
  ) {}

  clone(): Config {
    return new Config(
      this.name,
      [...this.plugins],                    // spread copy of array
      structuredClone(this.settings)        // Deep Copy of nested object
    );
  }
}
```

---

### Anti-Pattern 2: Bypassing Constructor Invariants with clone()

```typescript
// NG: clone() skips validation
class PositiveNumber {
  private value: number;

  constructor(value: number) {
    if (value <= 0) throw new Error("Value must be positive");
    this.value = value;
  }

  getValue(): number { return this.value; }

  clone(): PositiveNumber {
    // Bypass constructor with Object.create
    const copy = Object.create(PositiveNumber.prototype);
    copy.value = this.value;
    return copy;
    // Problem: if a setter that modifies value is added in the future,
    // objects could be created without validation
  }
}
```

```typescript
// OK: Maintain invariants by going through the constructor
class PositiveNumber {
  private value: number;

  constructor(value: number) {
    if (value <= 0) throw new Error("Value must be positive");
    this.value = value;
  }

  getValue(): number { return this.value; }

  clone(): PositiveNumber {
    // Validation runs because the constructor is called
    return new PositiveNumber(this.value);
  }
}
```

---

### Anti-Pattern 3: Copying Unique Identifiers in clone()

```typescript
// NG: ID is also copied → uniqueness is broken
class Entity {
  constructor(
    public id: string,     // UUID — should be unique
    public name: string,
    public data: unknown
  ) {}

  clone(): Entity {
    return new Entity(this.id, this.name, structuredClone(this.data));
    // same id → collision in the database!
  }
}
```

```typescript
// OK: Generate a new ID in clone()
import { randomUUID } from "crypto";

class Entity {
  constructor(
    public id: string,
    public name: string,
    public data: unknown
  ) {}

  clone(): Entity {
    return new Entity(
      randomUUID(),  // generate a new ID
      this.name,
      structuredClone(this.data)
    );
  }

  // It is important to explicitly design
  // "which fields to copy, and which fields to regenerate"
}
```

---

## 6. Edge Cases and Caveats

### Edge Case 1: Limitations of structuredClone

```typescript
// Things structuredClone cannot copy
class Example {
  method(): void {}  // function → not copied
}

const obj = {
  fn: () => "hello",           // ❌ function
  symbol: Symbol("id"),        // ❌ Symbol
  dom: document.createElement("div"), // ❌ DOM node
  error: new Error("test"),    // ✅ can be copied
  date: new Date(),            // ✅ can be copied
  regex: /test/gi,             // ✅ can be copied
  set: new Set([1, 2, 3]),     // ✅ can be copied
  arrayBuffer: new ArrayBuffer(8), // ✅ can be copied
};

// For class instances
const instance = new Example();
const cloned = structuredClone(instance);
console.log(typeof cloned.method); // "undefined" — method is lost!
console.log(cloned instanceof Example); // false — type info is also lost!
```

### Edge Case 2: Handling Event Listeners and Callbacks

```typescript
class EventEmitterWidget {
  private listeners = new Map<string, Function[]>();

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  // What to do with listeners in clone()?
  // Option 1: Copy listeners too → same handler fires on two objects
  // Option 2: Reset listeners → must re-register after cloning
  // Option 3: Shallow copy listeners → shared function references (usually OK)

  clone(copyListeners = false): EventEmitterWidget {
    const cloned = new EventEmitterWidget();
    if (copyListeners) {
      for (const [event, handlers] of this.listeners) {
        cloned.listeners.set(event, [...handlers]); // shallow copy
      }
    }
    return cloned;
  }
}
```

### Edge Case 3: Detecting and Handling Circular References

```typescript
// Circular references cause stack overflow
const a: any = { name: "A" };
const b: any = { name: "B", ref: a };
a.ref = b; // circular reference

// NG: infinite recursion
function naiveDeepCopy(obj: any): any {
  const copy: any = {};
  for (const key of Object.keys(obj)) {
    copy[key] = typeof obj[key] === "object"
      ? naiveDeepCopy(obj[key]) // ← infinite loop!
      : obj[key];
  }
  return copy;
}

// OK: detect cycles with a visited map
function safeDeepCopy(obj: any, visited = new WeakMap()): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (visited.has(obj)) return visited.get(obj); // return if already visited

  const copy: any = Array.isArray(obj) ? [] : {};
  visited.set(obj, copy); // register early (circular reference guard)

  for (const key of Object.keys(obj)) {
    copy[key] = safeDeepCopy(obj[key], visited);
  }
  return copy;
}

// structuredClone handles circular references automatically
const cloned = structuredClone(a); // OK!
console.log(cloned.ref.ref === cloned); // true — circular reference correctly reproduced
```

### Edge Case 4: Prototype Chain and Serialization

```typescript
// A list of things lost with JSON.stringify/parse
const original = {
  date: new Date("2024-01-01"),         // → becomes a string
  undefined: undefined,                  // → disappears
  nan: NaN,                              // → becomes null
  infinity: Infinity,                    // → becomes null
  regex: /test/g,                        // → becomes {}
  set: new Set([1, 2]),                  // → becomes {}
  fn: () => "hello",                     // → disappears
  symbol: Symbol("id"),                  // → disappears
  bigint: BigInt(42),                    // → TypeError!
};
```

---

## 7. Trade-off Analysis

### When to Use the Prototype Pattern

```
✅ When to use:
┌─────────────────────────────────────────────────┐
│ 1. Creating many objects with high init cost      │
│    e.g.: DB connection config, ML model config,   │
│          game characters                          │
│                                                  │
│ 2. Copying objects whose type is determined       │
│    at runtime                                     │
│    e.g.: plugin systems, configuration templates │
│                                                  │
│ 3. Saving object state as a snapshot             │
│    e.g.: Undo/Redo, version control, test fixture│
│                                                  │
│ 4. Template management via a prototype registry  │
│    e.g.: UI components, notification templates   │
│                                                  │
│ 5. Copying objects from external libraries       │
│    e.g.: duplicating objects with private fields │
└─────────────────────────────────────────────────┘

❌ When NOT to use:
┌─────────────────────────────────────────────────┐
│ 1. Objects with low creation cost                │
│    → new is sufficient; cost of implementing     │
│      clone() outweighs the benefit               │
│                                                  │
│ 2. When using immutable data structures          │
│    → structural sharing is more efficient        │
│    e.g.: Immutable.js, Immer                     │
│                                                  │
│ 3. Object graphs with overly complex             │
│    circular references                           │
│    → Hard to implement Deep Copy, a source of    │
│      bugs                                        │
│                                                  │
│ 4. Most fields are changed after cloning         │
│    → Creating directly with a constructor is     │
│      clearer                                     │
└─────────────────────────────────────────────────┘
```

### Performance Characteristics

```
Performance comparison of creation methods (approximate):

Method            | Small object  | Large object  | With nesting
                  | (5 fields)    | (50 fields)   | (3 levels deep)
─────────────────|────────────────|────────────────|────────────────
new + init        |    baseline   |    baseline   |    baseline
Shallow Clone     |    0.1x       |    0.1x       |    0.1x
Deep Clone(manual)|    0.3x       |    0.5x       |    0.8x
structuredClone   |    2.0x       |    1.5x       |    1.2x
JSON parse/strfy  |    5.0x       |    3.0x       |    2.5x

* When new + init includes DB connections or API calls,
  clone is overwhelmingly faster (100x to 1000x or more)
```

---

## 8. Exercises

### Exercise 1 (Basic): Implement Clone for Shape

Implement a Shape class hierarchy that meets the following requirements.

**Requirements**:
- Define a `clone()` method on the `Shape` base class
- Create subclasses: `Circle`, `Rectangle`, `Triangle`
- Verify that `clone()` in each class correctly returns a Deep Copy
- Return shape information as a string via a `describe()` method

```typescript
// Test
const circle = new Circle(0, 0, "red", 25);
const clonedCircle = circle.clone();
clonedCircle.color = "blue";

console.log(circle.describe());       // "Circle(x=0, y=0, color=red, r=25)"
console.log(clonedCircle.describe()); // "Circle(x=0, y=0, color=blue, r=25)"
console.log(circle !== clonedCircle); // true
```

**Expected output**:
```
Circle(x=0, y=0, color=red, r=25)
Circle(x=0, y=0, color=blue, r=25)
true
```

<details>
<summary>Sample solution</summary>

```typescript
interface Cloneable<T> {
  clone(): T;
}

abstract class Shape implements Cloneable<Shape> {
  constructor(
    public x: number,
    public y: number,
    public color: string
  ) {}

  abstract clone(): Shape;
  abstract describe(): string;
}

class Circle extends Shape {
  constructor(x: number, y: number, color: string, public radius: number) {
    super(x, y, color);
  }

  clone(): Circle {
    return new Circle(this.x, this.y, this.color, this.radius);
  }

  describe(): string {
    return `Circle(x=${this.x}, y=${this.y}, color=${this.color}, r=${this.radius})`;
  }
}

class Rectangle extends Shape {
  constructor(
    x: number, y: number, color: string,
    public width: number, public height: number
  ) {
    super(x, y, color);
  }

  clone(): Rectangle {
    return new Rectangle(this.x, this.y, this.color, this.width, this.height);
  }

  describe(): string {
    return `Rectangle(x=${this.x}, y=${this.y}, color=${this.color}, w=${this.width}, h=${this.height})`;
  }
}

class Triangle extends Shape {
  constructor(
    x: number, y: number, color: string,
    public base: number, public height2: number
  ) {
    super(x, y, color);
  }

  clone(): Triangle {
    return new Triangle(this.x, this.y, this.color, this.base, this.height2);
  }

  describe(): string {
    return `Triangle(x=${this.x}, y=${this.y}, color=${this.color}, base=${this.base}, h=${this.height2})`;
  }
}

// Test
const circle = new Circle(0, 0, "red", 25);
const clonedCircle = circle.clone();
clonedCircle.color = "blue";

console.log(circle.describe());       // "Circle(x=0, y=0, color=red, r=25)"
console.log(clonedCircle.describe()); // "Circle(x=0, y=0, color=blue, r=25)"
console.log(circle !== clonedCircle); // true
```
</details>

---

### Exercise 2 (Applied): Prototype Registry + Deep Copy

Implement a Prototype Registry to manage game character templates.

**Requirements**:
- `Character` class: name, hp, mp, skills (array), equipment (object)
- `CharacterRegistry`: register templates and retrieve clones
- Must be a Deep Copy (skills and equipment are independent)
- Automatically assign a new ID upon cloning

```typescript
// Test
const registry = new CharacterRegistry();

registry.register("warrior", new Character(
  "Warrior Template",
  100, 20,
  ["slash", "block"],
  { weapon: "sword", armor: "plate" }
));

const player1 = registry.create("warrior", "Hero Taro");
const player2 = registry.create("warrior", "Hero Jiro");

player1.skills.push("charge");
player1.equipment.weapon = "legendary-sword";

console.log(player1.name);            // "Hero Taro"
console.log(player2.name);            // "Hero Jiro"
console.log(player1.id !== player2.id); // true
console.log(player1.skills);          // ["slash", "block", "charge"]
console.log(player2.skills);          // ["slash", "block"] ← independent
console.log(player2.equipment.weapon); // "sword" ← independent
```

**Expected output**:
```
Hero Taro
Hero Jiro
true
["slash", "block", "charge"]
["slash", "block"]
sword
```

<details>
<summary>Sample solution</summary>

```typescript
import { randomUUID } from "crypto";

interface Cloneable<T> {
  clone(): T;
}

class Character implements Cloneable<Character> {
  public id: string;

  constructor(
    public name: string,
    public hp: number,
    public mp: number,
    public skills: string[],
    public equipment: Record<string, string>
  ) {
    this.id = randomUUID();
  }

  clone(): Character {
    const cloned = new Character(
      this.name,
      this.hp,
      this.mp,
      [...this.skills],          // Deep Copy of array
      { ...this.equipment }      // Shallow Copy of object (sufficient since values are strings)
    );
    // id is automatically generated inside new Character()
    return cloned;
  }
}

class CharacterRegistry {
  private templates = new Map<string, Character>();

  register(key: string, template: Character): void {
    this.templates.set(key, template);
  }

  create(key: string, name?: string): Character {
    const template = this.templates.get(key);
    if (!template) {
      throw new Error(`Template "${key}" not found`);
    }
    const character = template.clone();
    if (name) {
      character.name = name;
    }
    return character;
  }

  listTemplates(): string[] {
    return [...this.templates.keys()];
  }
}

// Test
const registry = new CharacterRegistry();

registry.register("warrior", new Character(
  "Warrior Template", 100, 20,
  ["slash", "block"],
  { weapon: "sword", armor: "plate" }
));

registry.register("mage", new Character(
  "Mage Template", 60, 100,
  ["fireball", "heal"],
  { weapon: "staff", armor: "robe" }
));

const player1 = registry.create("warrior", "Hero Taro");
const player2 = registry.create("warrior", "Hero Jiro");

player1.skills.push("charge");
player1.equipment.weapon = "legendary-sword";

console.log(player1.name);              // "Hero Taro"
console.log(player2.name);              // "Hero Jiro"
console.log(player1.id !== player2.id); // true
console.log(player1.skills);            // ["slash", "block", "charge"]
console.log(player2.skills);            // ["slash", "block"]
console.log(player2.equipment.weapon);  // "sword"
```
</details>

---

### Exercise 3 (Advanced): General-Purpose Deep Clone Utility

Implement a general-purpose utility function that can correctly Deep Clone all of the following data types.

**Requirements**:
- Primitive types (string, number, boolean, null, undefined)
- Date, RegExp, Map, Set
- Arrays and plain objects
- Circular reference detection and correct handling
- Objects with a `clone()` method should use it preferentially
- Type-safe TypeScript implementation

```typescript
// Test
const original = {
  str: "hello",
  num: 42,
  bool: true,
  date: new Date("2024-01-01"),
  regex: /test/gi,
  set: new Set([1, 2, { x: 3 }]),
  arr: [1, [2, [3]]],
  circular: null as any,
};
original.circular = original; // circular reference

const cloned = deepClone(original);

console.log(cloned.date instanceof Date);     // true
console.log(cloned.date !== original.date);   // true
console.log(cloned.regex instanceof RegExp);  // true
console.log(cloned.map.get("a")!.nested);     // true
console.log(cloned.map.get("a") !== original.map.get("a")); // true
console.log(cloned.circular === cloned);      // true (circular reference correctly reproduced)
console.log(cloned.circular !== original);    // true (independent)
```

**Expected output**:
```
true
true
true
true
true
true
true
```

<details>
<summary>Sample solution</summary>

```typescript
function deepClone<T>(obj: T, visited = new WeakMap()): T {
  // Return primitives and null/undefined as-is
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object" && typeof obj !== "function") return obj;

  // Circular reference check
  if (visited.has(obj as any)) {
    return visited.get(obj as any);
  }

  // Use clone() method if the object has one
  if (typeof (obj as any).clone === "function") {
    const cloned = (obj as any).clone();
    visited.set(obj as any, cloned);
    return cloned;
  }

  let result: any;

  // Date
  if (obj instanceof Date) {
    result = new Date(obj.getTime());
    visited.set(obj as any, result);
    return result;
  }

  // RegExp
  if (obj instanceof RegExp) {
    result = new RegExp(obj.source, obj.flags);
    result.lastIndex = obj.lastIndex;
    visited.set(obj as any, result);
    return result;
  }

  // Map
  if (obj instanceof Map) {
    result = new Map();
    visited.set(obj as any, result); // register early (circular reference guard)
    for (const [key, value] of obj) {
      result.set(deepClone(key, visited), deepClone(value, visited));
    }
    return result;
  }

  // Set
  if (obj instanceof Set) {
    result = new Set();
    visited.set(obj as any, result);
    for (const value of obj) {
      result.add(deepClone(value, visited));
    }
    return result;
  }

  // Array
  if (Array.isArray(obj)) {
    result = [];
    visited.set(obj as any, result);
    for (let i = 0; i < obj.length; i++) {
      result[i] = deepClone(obj[i], visited);
    }
    return result;
  }

  // ArrayBuffer
  if (obj instanceof ArrayBuffer) {
    result = obj.slice(0);
    visited.set(obj as any, result);
    return result;
  }

  // TypedArray (Uint8Array, Float32Array, etc.)
  if (ArrayBuffer.isView(obj)) {
    const typedArray = obj as any;
    result = new typedArray.constructor(deepClone(typedArray.buffer, visited));
    visited.set(obj as any, result);
    return result;
  }

  // Plain object
  result = Object.create(Object.getPrototypeOf(obj));
  visited.set(obj as any, result);

  for (const key of Reflect.ownKeys(obj as any)) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key as any);
    if (descriptor) {
      if ("value" in descriptor) {
        descriptor.value = deepClone(descriptor.value, visited);
      }
      Object.defineProperty(result, key, descriptor);
    }
  }

  return result;
}

// Test
const original = {
  str: "hello",
  num: 42,
  bool: true,
  date: new Date("2024-01-01"),
  regex: /test/gi,
  set: new Set([1, 2, { x: 3 }]),
  arr: [1, [2, [3]]],
  circular: null as any,
};
original.circular = original;

const cloned = deepClone(original);

console.log(cloned.date instanceof Date);     // true
console.log(cloned.date !== original.date);   // true
console.log(cloned.regex instanceof RegExp);  // true
console.log(cloned.map.get("a")!.nested);     // true
console.log(cloned.map.get("a") !== original.map.get("a")); // true
console.log(cloned.circular === cloned);      // true
console.log(cloned.circular !== original);    // true
```
</details>

---

## 9. FAQ

### Q1: When should I use JavaScript's `structuredClone`?

It is ideal when you want to deeply copy plain data objects that do not contain DOM nodes, functions, or Symbols. Since class instance methods and prototype chains are lost, implement a custom `clone()` for objects with methods. `structuredClone` is superior to `JSON.parse(JSON.stringify(...))` in that it automatically handles circular references.

### Q2: Is the Prototype pattern the same as JavaScript's prototype chain?

The names are similar, but they are **completely different concepts**.

| | GoF Prototype Pattern | JavaScript prototype chain |
|--|--|--|
| Purpose | **Clone generation** of objects | **Delegated lookup** of properties |
| Operation | Creates a new object with clone() | Traverses the prototype with `obj.prop` |
| Result | Independent copy | Shared behavior |

JavaScript's `Object.create()` is conceptually close to the GoF Prototype pattern, but differs in that it sets up the prototype chain rather than copying properties.

### Q3: If I use immutable data structures, is clone() unnecessary?

In many cases, using immutable data structures eliminates the need for explicit `clone()`. Libraries like Immutable.js and Immer use **structural sharing** to share references to unchanged parts, making it far more efficient than Deep Copy. However, the Prototype pattern is still useful in the following cases:
- Compatibility with existing mutable classes is required
- Small objects where structural sharing overhead is a concern
- Copying objects from third-party libraries

### Q4: Why is Java's `Cloneable` called a "broken" interface?

Josh Bloch (designer of `java.util.Collection`) detailed this in Effective Java:

1. **Marker interface** with no methods: `clone()` is defined on `Object`, not `Cloneable`
2. **protected**: `Object.clone()` is protected, so it cannot be called from outside (must override as public)
3. **Shallow Copy only**: `super.clone()` only performs a Shallow Copy
4. **Incompatible with final fields**: Cannot reassign final fields after `clone()`
5. **Inappropriate exception**: `CloneNotSupportedException` is a checked exception but almost never actually thrown

**Conclusion**: In Java, use a Copy Constructor or static factory method (`copyOf()`).

### Q5: What is the relationship between the Prototype pattern and the Flyweight pattern?

| | Prototype | Flyweight |
|--|--|--|
| Purpose | **Duplicating** objects | **Sharing** objects |
| Memory | **Increases** (by copies) | **Decreases** (by sharing) |
| Independence | **Fully independent** | Shares intrinsic state |

The two are contrasting, but can be combined. For example, objects cloned with Prototype may internally use Flyweight to share heavy data (textures, fonts, etc.).

### Q6: How is the Prototype pattern used in testing?

In testing, the Prototype pattern is very useful for creating **test fixtures**:

```typescript
// Define base fixture as a prototype
const baseUser = new User("test-user", "test@example.com", {
  role: "user",
  settings: { theme: "dark", notifications: true }
});

// Clone and customize for each test case
test("admin can access settings", () => {
  const admin = baseUser.clone();
  admin.role = "admin";
  // ... test
});

test("user with notifications off", () => {
  const user = baseUser.clone();
  user.settings.notifications = false;
  // ... test
});
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| **Purpose** | Clone existing objects to create new ones (avoids constructor cost) |
| **Shallow Copy** | Fast but shares reference-type fields (safe for immutable data) |
| **Deep Copy** | Fully independent but costly (watch out for circular references) |
| **Registry** | Catalog-manage prototypes and retrieve clones by key |
| **JS/TS recommendation** | Combine manual clone() with structuredClone |
| **Python recommendation** | copy.deepcopy + __deepcopy__ customization |
| **Java recommendation** | Copy Constructor (Cloneable is deprecated) |
| **Go recommendation** | Implement a Clone() method per struct |
| **Kotlin recommendation** | data class copy() + immutable design |
| **Most important caution** | Maintain invariants in clone(); regenerate unique IDs |
| **Use cases** | Undo/Redo, test fixtures, config templates, game state saving |

---

## What to Read Next

- [Singleton Pattern](./00-singleton.md) — Controlling instance count and contrast with Prototype
- [Factory Pattern](./01-factory.md) — Abstraction of object creation (can be used alongside Prototype)
- [Builder Pattern](./02-builder.md) — Step-by-step construction of complex objects
- [Decorator Pattern](../01-structural/01-decorator.md) — Dynamic feature addition
- Memento Pattern — Saving and restoring state (related to Prototype)
- Immutability — Immutable data structures

---

## References

1. Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
2. Bloch, J. (2018). *Effective Java* (3rd ed.). Addison-Wesley. — Item 13: Override clone judiciously
3. MDN Web Docs — structuredClone(). https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
4. Python Documentation — copy module. https://docs.python.org/3/library/copy.html
5. Refactoring.Guru — Prototype. https://refactoring.guru/design-patterns/prototype
6. Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly Media.
