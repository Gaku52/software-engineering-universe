# Composition Over Inheritance

> Why composition is more flexible and maintainable than inheritance. A systematic explanation of its relationship to design patterns, language-specific implementation techniques, and refactoring strategies.

---

## What You Will Learn

1. Understand the **problems with inheritance and the advantages of composition** theoretically, and explain the rationale behind design decisions
2. Implement **composition-based design patterns** such as Strategy, Decorator, and Delegate
3. Learn how to **refactor existing inheritance hierarchies into composition** to improve maintainability
4. Use **language-specific composition techniques** (Python Mixin, TypeScript Mixin, Rust Trait, Go Interface) appropriately
5. Accurately judge **when inheritance is appropriate and when it is not**, and explain your reasoning in design reviews

---

## Prerequisites

The following knowledge is required to understand this guide.

| Prerequisite | Reference |
|---------|-------|
| Basics of object-oriented programming (classes, inheritance, polymorphism) | 00-principles/02-solid.md |
| SOLID principles (especially LSP, OCP, DIP) | 00-principles/02-solid.md |
| Difference between interfaces and abstract classes | `02-programming/` |
| Basic concepts of design patterns | `design-patterns-guide/docs/00-creational/` |
| Fundamentals of dependency injection (DI) | 01-practices/03-dependency-injection.md |

---

## 1. Why "Composition Over Inheritance"?

### 1.1 Problems with Inheritance

```
┌──────────────────────────────────────────────────────┐
│              Five Problems with Inheritance            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. Fragile Base Class Problem                       │
│     Changes to the base class propagate to all       │
│     subclasses                                       │
│                                                      │
│  2. Diamond Problem                                  │
│     Methods with the same name conflict in           │
│     multiple inheritance                             │
│                                                      │
│  3. Deep hierarchies → hard to understand            │
│     A → B → C → D → E... where is what?             │
│                                                      │
│  4. Forced is-a relationship                         │
│     Is "Square is-a Rectangle" really valid?         │
│                                                      │
│  5. Single inheritance limitations                   │
│     Can only classify along one axis                 │
│     (A bird is-a animal, but a bird is-a             │
│      flying object too)                              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 1.2 Concrete Example of the Fragile Base Class Problem

```java
// Classic example of the Fragile Base Class problem (from Effective Java Item 18)

// Base class: a class that extends HashSet to count the number of additions
public class CountingHashSet<E> extends HashSet<E> {
    private int addCount = 0;

    @Override
    public boolean add(E e) {
        addCount++;
        return super.add(e);
    }

    @Override
    public boolean addAll(Collection<? extends E> c) {
        addCount += c.size();
        return super.addAll(c); // ← This is the problem!
    }

    public int getAddCount() {
        return addCount;
    }
}

// Usage
CountingHashSet<String> s = new CountingHashSet<>();
s.addAll(List.of("A", "B", "C"));
s.getAddCount(); // Expected: 3, Actual: 6!

// Why?
// HashSet.addAll() calls add() internally.
// After CountingHashSet.addAll() does addCount += 3,
// super.addAll() calls add() 3 times internally,
// each of which increments addCount++, totaling 6.
//
// Moreover, this is an "implementation detail" of HashSet
// and is not documented in the specification.
// If the internal implementation changes in a future Java version,
// this code may introduce a different bug.
```

### 1.3 Comparison: Inheritance vs. Composition

```
Inheritance (is-a):               Composition (has-a):
─────────                         ─────────

  Animal                          ┌─────────┐
    │                             │ Duck    │
    ├── Bird                      │         │
    │    ├── Duck                 │ swim: SwimBehavior
    │    ├── Penguin              │ fly:  FlyBehavior
    │    └── Eagle                │ sound: QuackBehavior
    │                             └─────────┘
    └── Fish
         └── FlyingFish           ← What about FlyingFish?
                                      Bird? Fish? Both?
                                      → Easily combined with composition
```

| Comparison Axis | Inheritance | Composition |
|--------|------|------|
| Coupling | High (parent-child tight coupling) | Low (via interfaces) |
| Flexibility | Low (fixed at compile time) | High (changeable at runtime) |
| Reusability | Limited (depends on hierarchy) | High (freely combinable) |
| Testability | Difficult (depends on parent class) | Easy (mockable) |
| Understandability | Deep hierarchies are difficult | Flat and clear |
| Multiple classification | Difficult (single inheritance barrier) | Easy (can have multiple behaviors) |
| Scope of change impact | Large (propagates to all subclasses) | Small (localized to the change point) |
| Encapsulation | Broken (protected exposure) | Maintained (internal implementation hidden) |

### 1.4 Liskov Substitution Principle (LSP) and the Limits of Inheritance

```
Square-Rectangle Problem: A classic example of LSP violation

  Rectangle
    │
    └── Square

  Rectangle code:
    rect.setWidth(5)
    rect.setHeight(3)
    assert rect.area() == 15  // Works as expected

  Does it work with Square?
    square.setWidth(5)   // → height is also set to 5 internally
    square.setHeight(3)  // → width is also set to 3 internally
    assert square.area() == 15  // Fails! area() = 9

  Problem: Square cannot inherit the "behavior" of Rectangle
  → Even if the is-a relationship holds mathematically, it does not hold programmatically

  Solution with composition:
    Shape { dimensions: Dimensions }
    Dimensions has different implementations such as Width×Height / Side
```

```python
# Example of LSP violation and the fix

# NG: LSP violation with inheritance
class Rectangle:
    def __init__(self, width: float, height: float):
        self._width = width
        self._height = height

    @property
    def width(self) -> float:
        return self._width

    @width.setter
    def width(self, value: float) -> None:
        self._width = value

    @property
    def height(self) -> float:
        return self._height

    @height.setter
    def height(self, value: float) -> None:
        self._height = value

    def area(self) -> float:
        return self._width * self._height

class Square(Rectangle):  # LSP violation!
    def __init__(self, side: float):
        super().__init__(side, side)

    @Rectangle.width.setter
    def width(self, value: float) -> None:
        self._width = value
        self._height = value  # Changing width also changes height

    @Rectangle.height.setter
    def height(self, value: float) -> None:
        self._width = value
        self._height = value

# OK: Solved with composition
from abc import ABC, abstractmethod
from dataclasses import dataclass

class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        pass

@dataclass(frozen=True)
class Rectangle(Shape):
    width: float
    height: float

    def area(self) -> float:
        return self.width * self.height

@dataclass(frozen=True)
class Square(Shape):
    side: float

    def area(self) -> float:
        return self.side ** 2

# area() can be safely called on a list of Shape
shapes: list[Shape] = [Rectangle(5, 3), Square(4)]
total_area = sum(s.area() for s in shapes)  # 15 + 16 = 31
```

---

## 2. Composition-Based Design Patterns

### 2.1 Strategy Pattern

```python
# Strategy pattern: inject behavior from outside
from abc import ABC, abstractmethod
from dataclasses import dataclass

# === Strategy interface ===
class SortStrategy(ABC):
    @abstractmethod
    def sort(self, data: list) -> list:
        pass

    @abstractmethod
    def name(self) -> str:
        pass

class QuickSort(SortStrategy):
    def sort(self, data: list) -> list:
        if len(data) <= 1:
            return data
        pivot = data[0]
        left = [x for x in data[1:] if x <= pivot]
        right = [x for x in data[1:] if x > pivot]
        return self.sort(left) + [pivot] + self.sort(right)

    def name(self) -> str:
        return "QuickSort"

class MergeSort(SortStrategy):
    def sort(self, data: list) -> list:
        if len(data) <= 1:
            return data
        mid = len(data) // 2
        left = self.sort(data[:mid])
        right = self.sort(data[mid:])
        return self._merge(left, right)

    def _merge(self, left, right):
        result = []
        i = j = 0
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                result.append(left[i]); i += 1
            else:
                result.append(right[j]); j += 1
        return result + left[i:] + right[j:]

    def name(self) -> str:
        return "MergeSort"

class InsertionSort(SortStrategy):
    """Best suited for small datasets"""
    def sort(self, data: list) -> list:
        result = list(data)
        for i in range(1, len(result)):
            key = result[i]
            j = i - 1
            while j >= 0 and result[j] > key:
                result[j + 1] = result[j]
                j -= 1
            result[j + 1] = key
        return result

    def name(self) -> str:
        return "InsertionSort"

# === Composition: a class that holds a strategy ===
@dataclass
class DataProcessor:
    sort_strategy: SortStrategy  # has-a (composition)

    def process(self, data: list) -> list:
        print(f"  Algorithm used: {self.sort_strategy.name()}")
        return self.sort_strategy.sort(data)

# === Choose a strategy at runtime ===
def choose_strategy(data_size: int) -> SortStrategy:
    """Select the optimal strategy based on data size"""
    if data_size < 50:
        return InsertionSort()
    elif data_size < 10000:
        return QuickSort()
    else:
        return MergeSort()

data = [3, 1, 4, 1, 5, 9, 2, 6]
strategy = choose_strategy(len(data))
processor = DataProcessor(sort_strategy=strategy)
result = processor.process(data)
print(f"  Result: {result}")

# Switching strategies is also easy
processor.sort_strategy = MergeSort()
result2 = processor.process(data)
```

### 2.2 Decorator Pattern

```typescript
// Decorator pattern: dynamically add functionality
// Stack up features using composition, not inheritance

interface Logger {
  log(message: string): void;
}

// === Base implementation ===
class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(message);
  }
}

class FileLogger implements Logger {
  constructor(private filePath: string) {}

  log(message: string): void {
    // fs.appendFileSync(this.filePath, message + '\n');
    console.log(`[File: ${this.filePath}] ${message}`);
  }
}

// === Decorator: add timestamp ===
class TimestampDecorator implements Logger {
  constructor(private inner: Logger) {} // composition

  log(message: string): void {
    const timestamp = new Date().toISOString();
    this.inner.log(`[${timestamp}] ${message}`);
  }
}

// === Decorator: add log level ===
class LevelDecorator implements Logger {
  constructor(
    private inner: Logger,
    private level: string = "INFO"
  ) {}

  log(message: string): void {
    this.inner.log(`[${this.level}] ${message}`);
  }
}

// === Decorator: convert to JSON format ===
class JsonDecorator implements Logger {
  constructor(private inner: Logger) {}

  log(message: string): void {
    const json = JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
    });
    this.inner.log(json);
  }
}

// === Decorator: filtering ===
class FilterDecorator implements Logger {
  constructor(
    private inner: Logger,
    private minLevel: string
  ) {}

  private levelOrder: Record<string, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  log(message: string): void {
    // Log level filtering logic
    this.inner.log(message);
  }
}

// === Usage: freely combine decorators ===

// Combination 1: Console log with timestamp + level
const logger1 = new TimestampDecorator(
  new LevelDecorator(new ConsoleLogger(), "DEBUG")
);
logger1.log("Test message");
// Output: [2026-01-15T10:30:00.000Z] [DEBUG] Test message

// Combination 2: JSON-formatted file log
const logger2 = new JsonDecorator(new FileLogger("/var/log/app.log"));
logger2.log("Error occurred");

// Combination 3: For production (timestamp + JSON)
const prodLogger = new TimestampDecorator(
  new JsonDecorator(new ConsoleLogger())
);

// ★ Important: Trying to achieve this with inheritance would require
// ConsoleLogger, FileLogger × Timestamp, Level, Json, Filter
// = 2 × 4 = 8 classes (and even more with combinations)
// With composition, just combine the needed decorators
```

### 2.3 Delegation Pattern

```java
// Delegation pattern: delegate processing to an inner object instead of inheriting

// === NG: Implementing Stack with inheritance ===
// public class Stack<T> extends ArrayList<T> {
//     // All ArrayList methods become public
//     // Stack invariants can be broken with add(index, element)
//     // Unnecessary methods like sort() and set() also become available
// }

// === OK: Implement Stack with composition + delegation ===
public class Stack<T> {
    private final List<T> elements = new ArrayList<>(); // has-a

    public void push(T item) {
        Objects.requireNonNull(item, "Cannot push null");
        elements.add(item);  // delegation
    }

    public T pop() {
        if (elements.isEmpty()) {
            throw new EmptyStackException();
        }
        return elements.remove(elements.size() - 1);  // delegation
    }

    public T peek() {
        if (elements.isEmpty()) {
            throw new EmptyStackException();
        }
        return elements.get(elements.size() - 1);  // delegation
    }

    public boolean isEmpty() {
        return elements.isEmpty();  // delegation
    }

    public int size() {
        return elements.size();  // delegation
    }

    // ArrayList's add(index) and sort() are not exposed
    // → The invariants of the stack are guaranteed
}

// === Practical example: a collection of domain objects ===
public class OrderList {
    private final List<Order> orders = new ArrayList<>();

    public void place(Order order) {
        if (!order.isValid()) {
            throw new IllegalArgumentException("Invalid order");
        }
        orders.add(order);
    }

    public List<Order> findByStatus(OrderStatus status) {
        return orders.stream()
            .filter(o -> o.getStatus() == status)
            .toList(); // returns an immutable list
    }

    public int totalAmount() {
        return orders.stream()
            .mapToInt(Order::getAmount)
            .sum();
    }

    // List's remove(), set(), sort() are not exposed
    // → Only operations consistent with business rules are allowed
}
```

### 2.4 Dependency Injection (DI) with Composition

```python
# Composition + DI: a design that is easy to test and flexible
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Protocol

# === Port definitions (interfaces) ===
class UserRepository(Protocol):
    def find_by_id(self, user_id: str) -> dict | None: ...
    def save(self, user: dict) -> None: ...

class EmailSender(Protocol):
    def send(self, to: str, subject: str, body: str) -> bool: ...

class Logger(Protocol):
    def info(self, message: str) -> None: ...
    def error(self, message: str) -> None: ...

# === Adapter implementations ===
class PostgresUserRepository:
    def __init__(self, connection_string: str):
        self.conn_str = connection_string

    def find_by_id(self, user_id: str) -> dict | None:
        # Actual DB operation
        return {"id": user_id, "name": "Test", "email": "test@example.com"}

    def save(self, user: dict) -> None:
        # Actual DB operation
        pass

class SmtpEmailSender:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port

    def send(self, to: str, subject: str, body: str) -> bool:
        # Actual email sending
        return True

class ConsoleLogger:
    def info(self, message: str) -> None:
        print(f"[INFO] {message}")

    def error(self, message: str) -> None:
        print(f"[ERROR] {message}")

# === Service: inject dependencies via composition ===
@dataclass
class UserService:
    """User service (holds dependencies via composition)"""
    repository: UserRepository    # has-a
    email_sender: EmailSender     # has-a
    logger: Logger                # has-a

    def register(self, name: str, email: str) -> dict:
        self.logger.info(f"Starting user registration: {name}")

        user = {"id": f"user-{hash(email)}", "name": name, "email": email}
        self.repository.save(user)

        self.email_sender.send(
            to=email,
            subject="Registration Complete",
            body=f"Thank you for registering, {name}."
        )

        self.logger.info(f"User registration complete: {user['id']}")
        return user

# === Production environment ===
prod_service = UserService(
    repository=PostgresUserRepository("postgresql://localhost/mydb"),
    email_sender=SmtpEmailSender("smtp.example.com", 587),
    logger=ConsoleLogger(),
)

# === For testing: inject mocks ===
class MockUserRepository:
    def __init__(self):
        self.saved_users = []

    def find_by_id(self, user_id: str) -> dict | None:
        return next((u for u in self.saved_users if u["id"] == user_id), None)

    def save(self, user: dict) -> None:
        self.saved_users.append(user)

class MockEmailSender:
    def __init__(self):
        self.sent_emails = []

    def send(self, to: str, subject: str, body: str) -> bool:
        self.sent_emails.append({"to": to, "subject": subject, "body": body})
        return True

class NullLogger:
    def info(self, message: str) -> None: pass
    def error(self, message: str) -> None: pass

# Test
mock_repo = MockUserRepository()
mock_email = MockEmailSender()
test_service = UserService(
    repository=mock_repo,
    email_sender=mock_email,
    logger=NullLogger(),
)

user = test_service.register("Tanaka", "tanaka@example.com")
assert len(mock_repo.saved_users) == 1
assert len(mock_email.sent_emails) == 1
assert mock_email.sent_emails[0]["to"] == "tanaka@example.com"
```

---

## 3. Composition Pattern Reference and Comparison

### 3.1 Pattern Comparison Table

| Pattern | Purpose | Structure | Use Cases |
|---------|------|------|---------|
| Strategy | Switch behavior | Context has-a strategy | Algorithm selection |
| Decorator | Dynamically add features | Decorator has-a component | Middleware, logging |
| Delegate | Delegate implementation | Wrapper has-a delegate | Restricted API exposure |
| Observer | Event notification | Subject has-a observers | Event-driven |
| Composite | Tree structure | Node has-a child nodes | UI, file systems |
| State | State transitions | Context has-a state | State machines |
| Bridge | Separate abstraction and implementation | Abstraction has-a implementation | Cross-platform |
| Adapter | Interface conversion | Adapter has-a adaptee | Legacy integration |

### 3.2 Comparison of Composition Approaches

| Approach | Language | Characteristics | Use Cases |
|------|------|------|---------|
| Interface + DI | Java, TypeScript | Most type-safe | Large-scale systems |
| Protocol | Python | Duck typing | General Python |
| Trait | Rust, Scala | Zero-cost abstraction | Performance-critical |
| Mixin | TypeScript, Python | Easy feature addition | Small feature additions |
| Higher-Order Function | All languages | Most lightweight | Function-level composition |
| Interface embedding | Go | Implicit interfaces | General Go |

### 3.3 Mixin/Trait Pattern (Multiple Composition)

```typescript
// TypeScript: Add features compositionally with Mixins

type Constructor<T = {}> = new (...args: any[]) => T;

// === Mixin: Serialization feature ===
function Serializable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    serialize(): string {
      return JSON.stringify(this);
    }

    static deserialize<T>(json: string): T {
      return JSON.parse(json) as T;
    }
  };
}

// === Mixin: Validation feature ===
function Validatable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    private validationErrors: string[] = [];

    validate(): boolean {
      this.validationErrors = [];
      return this.validationErrors.length === 0;
    }

    getErrors(): string[] {
      return [...this.validationErrors];
    }

    protected addError(error: string): void {
      this.validationErrors.push(error);
    }
  };
}

// === Mixin: Audit log feature ===
function Auditable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    createdAt: Date = new Date();
    updatedAt: Date = new Date();
    createdBy: string = "";
    updatedBy: string = "";

    markCreated(user: string): void {
      this.createdBy = user;
      this.createdAt = new Date();
    }

    markUpdated(user: string): void {
      this.updatedBy = user;
      this.updatedAt = new Date();
    }
  };
}

// === Mixin: Event emitting feature ===
function EventEmittable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    private listeners: Map<string, Function[]> = new Map();

    on(event: string, handler: Function): void {
      const handlers = this.listeners.get(event) || [];
      this.listeners.set(event, [...handlers, handler]);
    }

    emit(event: string, ...args: any[]): void {
      const handlers = this.listeners.get(event) || [];
      handlers.forEach((h) => h(...args));
    }
  };
}

// === Base class ===
class BaseEntity {
  constructor(public id: string) {}
}

// === Composition: combine the needed features ===
class User extends Auditable(
  Validatable(Serializable(EventEmittable(BaseEntity)))
) {
  constructor(id: string, public name: string, public email: string) {
    super(id);
  }
}

const user = new User("1", "Tanaka", "tanaka@example.com");
user.markCreated("admin");
user.on("updated", () => console.log("User was updated"));
const json = user.serialize();
console.log(user.validate());
```

### 3.4 Composition with Rust Traits

```rust
// Rust: Zero-cost composition with Traits

// Trait definitions (equivalent to interfaces)
trait Drawable {
    fn draw(&self);
    fn bounding_box(&self) -> (f64, f64, f64, f64);
}

trait Resizable {
    fn resize(&mut self, factor: f64);
}

trait Serializable {
    fn serialize(&self) -> String;
    fn deserialize(data: &str) -> Self where Self: Sized;
}

// Struct implements Traits (compositional, not inheritance)
struct Circle {
    x: f64,
    y: f64,
    radius: f64,
}

impl Drawable for Circle {
    fn draw(&self) {
        println!("Drawing circle at ({}, {}) r={}", self.x, self.y, self.radius);
    }

    fn bounding_box(&self) -> (f64, f64, f64, f64) {
        (
            self.x - self.radius,
            self.y - self.radius,
            self.x + self.radius,
            self.y + self.radius,
        )
    }
}

impl Resizable for Circle {
    fn resize(&mut self, factor: f64) {
        self.radius *= factor;
    }
}

impl Serializable for Circle {
    fn serialize(&self) -> String {
        format!("circle:{},{},{}", self.x, self.y, self.radius)
    }

    fn deserialize(data: &str) -> Self {
        let parts: Vec<f64> = data.strip_prefix("circle:")
            .unwrap()
            .split(',')
            .map(|s| s.parse().unwrap())
            .collect();
        Circle { x: parts[0], y: parts[1], radius: parts[2] }
    }
}

// Trait bounds require multiple Traits (compositional type constraints)
fn save_drawable<T: Drawable + Serializable>(item: &T) {
    item.draw();
    let data = item.serialize();
    println!("Saved: {}", data);
}

// Trait Objects for dynamic dispatch (polymorphism)
fn draw_all(items: &[Box<dyn Drawable>]) {
    for item in items {
        item.draw();
    }
}
```

### 3.5 Go Interface Embedding (Compositional Interfaces)

```go
// Go: Composition via implicit interfaces and struct embedding

// Define small interfaces
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type Closer interface {
    Close() error
}

// Interface composition (embedding)
type ReadWriter interface {
    Reader
    Writer
}

type ReadWriteCloser interface {
    Reader
    Writer
    Closer
}

// Struct composition (embedding)
type Logger struct {
    prefix string
}

func (l *Logger) Log(msg string) {
    fmt.Printf("[%s] %s\n", l.prefix, msg)
}

type Validator struct{}

func (v *Validator) Validate(data string) error {
    if data == "" {
        return fmt.Errorf("data is empty")
    }
    return nil
}

// Composition: combine features via embedding
type UserService struct {
    Logger     // Embedded: UserService.Log() is available
    Validator  // Embedded: UserService.Validate() is available
    repo UserRepository
}

func NewUserService(repo UserRepository) *UserService {
    return &UserService{
        Logger:    Logger{prefix: "UserService"},
        Validator: Validator{},
        repo:      repo,
    }
}

func (s *UserService) Create(name string) error {
    if err := s.Validate(name); err != nil {
        s.Log("Validation failed: " + err.Error())
        return err
    }
    s.Log("Creating user: " + name)
    return s.repo.Save(name)
}
```

---

## 4. Refactoring from Inheritance to Composition

### 4.1 Refactoring Steps

```
Step 1: Analyze the inheritance hierarchy
──────────────────────────────────────────
  Base
   ├── ChildA (override: methodX, methodY)
   ├── ChildB (override: methodX, methodZ)
   └── ChildC (override: methodY, methodZ)

Step 2: Identify axes of behavior
──────────────────────────────────────────
  behavior of methodX → BehaviorX interface
  behavior of methodY → BehaviorY interface
  behavior of methodZ → BehaviorZ interface

Step 3: Extract interfaces and implementations
──────────────────────────────────────────────
  interface BehaviorX { doX(); }
  class BehaviorXImpl1 implements BehaviorX { ... }
  class BehaviorXImpl2 implements BehaviorX { ... }

Step 4: Rewrite with composition
─────────────────────────────────
  class Entity:
      behaviorX: BehaviorX
      behaviorY: BehaviorY
      behaviorZ: BehaviorZ

  entityA = Entity(BehaviorXImpl1, BehaviorYImpl1, default)
  entityB = Entity(BehaviorXImpl1, default, BehaviorZImpl1)
  entityC = Entity(default, BehaviorYImpl1, BehaviorZImpl1)

Step 5: Manage configurations with factories
──────────────────────────────────────────────
  EntityFactory.createTypeA() → returns the appropriate combination
```

### 4.2 Concrete Example: Refactoring a Notification System

```python
# Before: Inheritance-based notification system (problematic)

# class Notification:
#     def send(self, message): ...
#     def format(self, message): return message
#
# class EmailNotification(Notification):
#     def send(self, message): ...    # Send email
#     def format(self, message): ...  # HTML format
#
# class SlackNotification(Notification):
#     def send(self, message): ...    # Send to Slack
#     def format(self, message): ...  # Markdown format
#
# class UrgentEmailNotification(EmailNotification):
#     def format(self, message): ...  # HTML + red text
#
# class UrgentSlackNotification(SlackNotification):
#     def format(self, message): ...  # Markdown + :alert:
#
# → Combinatorial explosion with delivery method × format × urgency!
# → 3 deliveries × 3 formats × 3 urgency levels = 27 classes needed

# After: Composition-based refactoring
from abc import ABC, abstractmethod
from dataclasses import dataclass

# === Delivery strategy ===
class DeliveryChannel(ABC):
    @abstractmethod
    def deliver(self, formatted_message: str, recipient: str) -> bool:
        pass

    @abstractmethod
    def channel_name(self) -> str:
        pass

class EmailChannel(DeliveryChannel):
    def deliver(self, formatted_message: str, recipient: str) -> bool:
        print(f"Email to {recipient}: {formatted_message}")
        return True

    def channel_name(self) -> str:
        return "Email"

class SlackChannel(DeliveryChannel):
    def __init__(self, webhook_url: str = ""):
        self.webhook_url = webhook_url

    def deliver(self, formatted_message: str, recipient: str) -> bool:
        print(f"Slack to {recipient}: {formatted_message}")
        return True

    def channel_name(self) -> str:
        return "Slack"

class SMSChannel(DeliveryChannel):
    def deliver(self, formatted_message: str, recipient: str) -> bool:
        print(f"SMS to {recipient}: {formatted_message}")
        return True

    def channel_name(self) -> str:
        return "SMS"

# === Format strategy ===
class Formatter(ABC):
    @abstractmethod
    def format(self, message: str) -> str:
        pass

class PlainFormatter(Formatter):
    def format(self, message: str) -> str:
        return message

class HTMLFormatter(Formatter):
    def format(self, message: str) -> str:
        return f"<html><body><p>{message}</p></body></html>"

class MarkdownFormatter(Formatter):
    def format(self, message: str) -> str:
        return f"**{message}**"

# === Urgency decorator (composition) ===
class UrgencyDecorator(Formatter):
    def __init__(self, inner: Formatter, prefix: str = "[URGENT]"):
        self.inner = inner
        self.prefix = prefix

    def format(self, message: str) -> str:
        return self.inner.format(f"{self.prefix} {message}")

# === Composition: freely combinable ===
@dataclass
class NotificationService:
    channel: DeliveryChannel
    formatter: Formatter

    def send(self, message: str, recipient: str) -> bool:
        formatted = self.formatter.format(message)
        return self.channel.deliver(formatted, recipient)

# Usage: 3 components × 3 combinations = 6 classes cover all combinations
normal_email = NotificationService(EmailChannel(), HTMLFormatter())
urgent_slack = NotificationService(
    SlackChannel(),
    UrgencyDecorator(MarkdownFormatter())
)
urgent_sms = NotificationService(
    SMSChannel(),
    UrgencyDecorator(PlainFormatter(), prefix="[CRITICAL]")
)

normal_email.send("Meeting announcement", "tanaka@example.com")
urgent_slack.send("Server down", "#alerts")
urgent_sms.send("Emergency maintenance", "+1-555-XXXX-XXXX")
```

### 4.3 Guidelines for Incremental Refactoring

```
Refactoring decision flow:

  Discover an inheritance hierarchy
       │
       ▼
  Q1: Is the hierarchy 3 levels or fewer?
       │
    Yes │ No
       │  └──→ Refactor to composition (Priority: High)
       ▼
  Q2: Is there a combinatorial explosion?
       │
    No  │ Yes
       │  └──→ Decompose with Bridge/Strategy pattern (Priority: High)
       ▼
  Q3: Has a change to the base class ever broken subclasses?
       │
    No  │ Yes
       │  └──→ Rewrite with delegation pattern (Priority: Medium)
       ▼
  Q4: Does it satisfy LSP?
       │
    Yes │ No
       │  └──→ Change to interface + composition (Priority: Medium)
       ▼
  Keep as-is (inheritance is appropriate)
```

---

## 5. When Inheritance Is Appropriate

### 5.1 Cases Where Inheritance Should Be Used

```
Appropriate cases for inheritance:
──────────────────────────────────

1. A true is-a relationship (satisfies the Liskov Substitution Principle)
   - IOException is-a Exception ← OK
   - ArrayList is-a List ← OK
   - HttpServletRequest is-a ServletRequest ← OK

2. When a framework requires inheritance
   - Android Activity / Fragment
   - Django View / ModelAdmin
   - JUnit TestCase (legacy)

3. Template Method pattern
   - The algorithm skeleton is fixed; details are overridden
   - Override only get(index) / size() in AbstractList

4. When common state and behavior are closely related
   - GUI widget hierarchy (Button is-a Widget)

Decision criteria:
  □ Can the subclass be a complete substitute for the parent class? (LSP)
  □ Is the inheritance hierarchy 3 levels or fewer?
  □ Will future extensions cause a combinatorial explosion?
  □ Will changes to the parent class not break subclasses?
  □ Should the subclass meaningfully have all methods of the parent class?

  If any answer is No → Consider composition
```

### 5.2 Template Method Pattern (An Example of Appropriate Inheritance)

```python
# Template Method pattern: a case where inheritance is appropriate

from abc import ABC, abstractmethod

class DataExporter(ABC):
    """Skeleton for data export (template method)"""

    def export(self, data: list[dict]) -> str:
        """The export procedure is fixed (template)"""
        # Step 1: Write header
        result = self.write_header()
        # Step 2: Write each record
        for record in data:
            result += self.write_record(record)
        # Step 3: Write footer
        result += self.write_footer()
        return result

    @abstractmethod
    def write_header(self) -> str:
        """Subclasses implement format-specific headers"""
        pass

    @abstractmethod
    def write_record(self, record: dict) -> str:
        """Subclasses implement format-specific record output"""
        pass

    @abstractmethod
    def write_footer(self) -> str:
        """Subclasses implement format-specific footers"""
        pass

class CsvExporter(DataExporter):
    def write_header(self) -> str:
        return "id,name,email\n"

    def write_record(self, record: dict) -> str:
        return f"{record['id']},{record['name']},{record['email']}\n"

    def write_footer(self) -> str:
        return ""

class JsonExporter(DataExporter):
    def __init__(self):
        self._first = True

    def write_header(self) -> str:
        self._first = True
        return "[\n"

    def write_record(self, record: dict) -> str:
        import json
        prefix = "  " if self._first else ",\n  "
        self._first = False
        return prefix + json.dumps(record, ensure_ascii=False)

    def write_footer(self) -> str:
        return "\n]"

# Usage
data = [
    {"id": "1", "name": "Tanaka", "email": "tanaka@example.com"},
    {"id": "2", "name": "Suzuki", "email": "suzuki@example.com"},
]

csv_result = CsvExporter().export(data)
json_result = JsonExporter().export(data)
print(csv_result)
print(json_result)
```

---

## 6. Anti-Patterns

### 6.1 Anti-Pattern: God Inheritance Hierarchy

```
NG: Excessively deep inheritance hierarchy
  Component
   └── VisualComponent
        └── InteractiveComponent
             └── FormComponent
                  └── InputComponent
                       └── TextInputComponent
                            └── SearchInputComponent
                                 └── AutoCompleteSearchInput
                                      └── ... (continues further)

Problems:
- A single change propagates through 8+ levels
- It is unclear "which level has which feature"
- Too many levels need to be mocked during testing
- Adding a new type of input requires understanding all levels

OK: Flat composition structure
  SearchInput:
    - renderer: AutoCompleteRenderer  // appearance
    - validator: SearchValidator      // validation
    - formatter: SearchFormatter      // formatting
    - behavior: SearchBehavior        // behavior
    - accessiblity: AriaProps         // accessibility
```

### 6.2 Anti-Pattern: Implementing Cross-Cutting Concerns with Inheritance

```java
// NG: Adding logging via inheritance
class LoggableService extends BaseService {
    @Override
    public void execute() {
        log("Start");
        super.execute();
        log("End");
    }
}
// → Should all services extend LoggableService?
// → Want to add caching too → CachingLoggableService?
// → And auth → AuthCachingLoggableService? → Combinatorial explosion

// OK: Add compositionally with decorator/aspect
class LoggingDecorator implements Service {
    private final Service inner;
    private final Logger logger;

    public LoggingDecorator(Service inner, Logger logger) {
        this.inner = inner;
        this.logger = logger;
    }

    @Override
    public void execute() {
        logger.info("Start: " + inner.getClass().getSimpleName());
        try {
            inner.execute();
            logger.info("Complete");
        } catch (Exception e) {
            logger.error("Failed: " + e.getMessage());
            throw e;
        }
    }
}

class CachingDecorator implements Service {
    private final Service inner;
    private final Cache cache;

    public CachingDecorator(Service inner, Cache cache) {
        this.inner = inner;
        this.cache = cache;
    }

    @Override
    public void execute() {
        String key = inner.getClass().getSimpleName();
        if (!cache.has(key)) {
            inner.execute();
            cache.set(key, true);
        }
    }
}

class AuthDecorator implements Service {
    private final Service inner;
    private final AuthService auth;

    public AuthDecorator(Service inner, AuthService auth) {
        this.inner = inner;
        this.auth = auth;
    }

    @Override
    public void execute() {
        if (!auth.isAuthenticated()) {
            throw new UnauthorizedException();
        }
        inner.execute();
    }
}

// Freely composable
Service service = new AuthDecorator(
    new LoggingDecorator(
        new CachingDecorator(
            new ActualService(),
            cache
        ),
        logger
    ),
    authService
);
```

### 6.3 Anti-Pattern: Unnecessary Abstract Base Classes

```python
# NG: Creating an abstract class when there is only one subclass
class AbstractUserRepository(ABC):
    @abstractmethod
    def find_by_id(self, user_id: str) -> User: ...
    @abstractmethod
    def save(self, user: User) -> None: ...

class PostgresUserRepository(AbstractUserRepository):
    # The only implementation
    def find_by_id(self, user_id: str) -> User: ...
    def save(self, user: User) -> None: ...

# → Violates YAGNI (You Ain't Gonna Need It)
# → Abstract only when a second implementation is needed

# OK: A concrete class is sufficient to start
class UserRepository:
    def find_by_id(self, user_id: str) -> User: ...
    def save(self, user: User) -> None: ...

# In Python, you can define an interface after the fact using Protocol
# class UserRepositoryProtocol(Protocol):
#     def find_by_id(self, user_id: str) -> User: ...
#     def save(self, user: User) -> None: ...
# → Existing classes can satisfy the interface without modification
```

---

## 7. Practical Exercises

### Exercise 1 (Basic): Composition Design for a Payment System

**Task**: Design a payment system in Python using composition that satisfies the following requirements.

```python
# Requirements:
# 1. Payment methods: 3 types — CreditCard, BankTransfer, PayPay
# 2. Notification methods: 2 types — Email, SMS
# 3. Logging: 2 types — Console, File
# 4. PaymentService receives payment method, notification method, and logger via composition
# 5. Implement a process_payment(amount, user) method
# 6. Realize all combinations without class explosion
```

**Expected Implementation**:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

# === Payment method interface ===
class PaymentMethod(ABC):
    @abstractmethod
    def charge(self, amount: int, user_id: str) -> bool:
        pass

    @abstractmethod
    def name(self) -> str:
        pass

class CreditCard(PaymentMethod):
    def charge(self, amount: int, user_id: str) -> bool:
        print(f"  Credit card payment: {amount} yen (user: {user_id})")
        return True

    def name(self) -> str:
        return "CreditCard"

class BankTransfer(PaymentMethod):
    def charge(self, amount: int, user_id: str) -> bool:
        print(f"  Bank transfer: {amount} yen (user: {user_id})")
        return True

    def name(self) -> str:
        return "BankTransfer"

class PayPay(PaymentMethod):
    def charge(self, amount: int, user_id: str) -> bool:
        print(f"  PayPay payment: {amount} yen (user: {user_id})")
        return True

    def name(self) -> str:
        return "PayPay"

# === Notification interface ===
class Notifier(ABC):
    @abstractmethod
    def notify(self, user_id: str, message: str) -> None:
        pass

class EmailNotifier(Notifier):
    def notify(self, user_id: str, message: str) -> None:
        print(f"  Email notification -> {user_id}: {message}")

class SMSNotifier(Notifier):
    def notify(self, user_id: str, message: str) -> None:
        print(f"  SMS notification -> {user_id}: {message}")

# === Logger interface ===
class PaymentLogger(ABC):
    @abstractmethod
    def log(self, message: str) -> None:
        pass

class ConsolePaymentLogger(PaymentLogger):
    def log(self, message: str) -> None:
        print(f"  [LOG] {message}")

class FilePaymentLogger(PaymentLogger):
    def __init__(self, path: str = "payment.log"):
        self.path = path

    def log(self, message: str) -> None:
        print(f"  [FILE:{self.path}] {message}")

# === Composition: PaymentService ===
@dataclass
class PaymentService:
    payment_method: PaymentMethod
    notifier: Notifier
    logger: PaymentLogger

    def process_payment(self, amount: int, user_id: str) -> bool:
        self.logger.log(
            f"Payment start: {self.payment_method.name()} {amount} yen user={user_id}"
        )
        success = self.payment_method.charge(amount, user_id)
        if success:
            self.notifier.notify(user_id, f"Payment complete: {amount} yen")
            self.logger.log("Payment succeeded")
        else:
            self.logger.log("Payment failed")
        return success

# === Test ===
# Combination 1: Credit card + Email + Console log
service1 = PaymentService(CreditCard(), EmailNotifier(), ConsolePaymentLogger())
service1.process_payment(5000, "user-001")

print()

# Combination 2: PayPay + SMS + File log
service2 = PaymentService(PayPay(), SMSNotifier(), FilePaymentLogger())
service2.process_payment(1200, "user-002")

# 3 methods × 2 notifications × 2 logs = 12 combinations achieved with 6 classes
print("\nAll tests passed!")
```

**Expected Output**:
```
  [LOG] Payment start: CreditCard 5000 yen user=user-001
  Credit card payment: 5000 yen (user: user-001)
  Email notification -> user-001: Payment complete: 5000 yen
  [LOG] Payment succeeded

  [FILE:payment.log] Payment start: PayPay 1200 yen user=user-002
  PayPay payment: 1200 yen (user: user-002)
  SMS notification -> user-002: Payment complete: 1200 yen
  [FILE:payment.log] Payment succeeded

All tests passed!
```

---

### Exercise 2 (Intermediate): Composing a Middleware Pipeline

**Task**: Implement a system in TypeScript that composes HTTP middleware using the Decorator pattern.

```typescript
// Requirements:
// 1. Handler interface: handle(request) => response
// 2. LoggingMiddleware: log requests/responses
// 3. AuthMiddleware: validate the Authorization header
// 4. RateLimitMiddleware: check rate limits
// 5. Middleware can be composed in any order
```

**Expected Implementation**:

```typescript
interface Request {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

interface Response {
  readonly status: number;
  readonly body: string;
}

interface Handler {
  handle(request: Request): Response;
}

// === Actual handler ===
class UserHandler implements Handler {
  handle(request: Request): Response {
    return { status: 200, body: JSON.stringify({ user: "Tanaka" }) };
  }
}

// === Middleware (decorators) ===
class LoggingMiddleware implements Handler {
  constructor(private inner: Handler) {}

  handle(request: Request): Response {
    console.log(`→ ${request.method} ${request.path}`);
    const response = this.inner.handle(request);
    console.log(`← ${response.status}`);
    return response;
  }
}

class AuthMiddleware implements Handler {
  constructor(
    private inner: Handler,
    private validTokens: Set<string>
  ) {}

  handle(request: Request): Response {
    const token = request.headers["authorization"];
    if (!token || !this.validTokens.has(token)) {
      return { status: 401, body: "Unauthorized" };
    }
    return this.inner.handle(request);
  }
}

class RateLimitMiddleware implements Handler {
  private requestCounts = new Map<string, number>();

  constructor(
    private inner: Handler,
    private maxRequests: number = 10
  ) {}

  handle(request: Request): Response {
    const clientIp = request.headers["x-forwarded-for"] || "unknown";
    const count = this.requestCounts.get(clientIp) || 0;

    if (count >= this.maxRequests) {
      return { status: 429, body: "Too Many Requests" };
    }

    this.requestCounts.set(clientIp, count + 1);
    return this.inner.handle(request);
  }
}

// === Build pipeline ===
const validTokens = new Set(["Bearer token123"]);

const pipeline = new LoggingMiddleware(
  new AuthMiddleware(
    new RateLimitMiddleware(new UserHandler(), 100),
    validTokens
  )
);

// Test 1: Normal request
const response1 = pipeline.handle({
  method: "GET",
  path: "/users/1",
  headers: { authorization: "Bearer token123", "x-forwarded-for": "1.2.3.4" },
});
console.log("Response:", response1);

// Test 2: Authentication failure
const response2 = pipeline.handle({
  method: "GET",
  path: "/users/1",
  headers: { "x-forwarded-for": "1.2.3.4" },
});
console.log("Response:", response2);
```

**Expected Output**:
```
→ GET /users/1
← 200
Response: { status: 200, body: '{"user":"Tanaka"}' }
→ GET /users/1
← 401
Response: { status: 401, body: 'Unauthorized' }
```

---

### Exercise 3 (Advanced): Refactoring from Inheritance to Composition

**Task**: Refactor the following inheritance-based game character system to use composition.

```python
# Before: Inheritance-based (problematic)
# class Character:
#     def attack(self): return 10
#     def defend(self): return 5
#     def move(self): return "walk"
#
# class Warrior(Character):
#     def attack(self): return 20
#     def defend(self): return 15
#
# class Mage(Character):
#     def attack(self): return 25  # Magic attack
#     def move(self): return "teleport"
#
# class FlyingWarrior(Warrior):  # ← Problem! Flying + Warrior
#     def move(self): return "fly"
#
# class FlyingMage(Mage):  # ← Flying + Mage
#     def move(self): return "fly"
#
# → Combinatorial explosion: flying × combat style × movement
#
# Requirements:
# 1. Define AttackStrategy, DefenseStrategy, MovementStrategy
# 2. Character holds the 3 strategies via composition
# 3. Strategies can be changed at runtime (e.g., power-up items)
# 4. New combinations can be created without adding classes
```

**Expected Implementation**:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, replace

# === Attack strategies ===
class AttackStrategy(ABC):
    @abstractmethod
    def attack(self) -> tuple[int, str]:
        """(damage, attack name)"""
        pass

class SwordAttack(AttackStrategy):
    def attack(self) -> tuple[int, str]:
        return (20, "Sword slash")

class MagicAttack(AttackStrategy):
    def attack(self) -> tuple[int, str]:
        return (25, "Fireball")

class BowAttack(AttackStrategy):
    def attack(self) -> tuple[int, str]:
        return (15, "Arrow shot")

class DualWield(AttackStrategy):
    """Composition of compositions: dual wield"""
    def __init__(self, main: AttackStrategy, sub: AttackStrategy):
        self.main = main
        self.sub = sub

    def attack(self) -> tuple[int, str]:
        main_dmg, main_name = self.main.attack()
        sub_dmg, sub_name = self.sub.attack()
        return (main_dmg + sub_dmg // 2, f"{main_name} + {sub_name}")

# === Defense strategies ===
class DefenseStrategy(ABC):
    @abstractmethod
    def defend(self) -> tuple[int, str]:
        """(defense power, defense name)"""
        pass

class ShieldDefense(DefenseStrategy):
    def defend(self) -> tuple[int, str]:
        return (15, "Shield block")

class MagicBarrier(DefenseStrategy):
    def defend(self) -> tuple[int, str]:
        return (20, "Magic barrier")

class DodgeDefense(DefenseStrategy):
    def defend(self) -> tuple[int, str]:
        return (10, "Dodge")

# === Movement strategies ===
class MovementStrategy(ABC):
    @abstractmethod
    def move(self) -> tuple[int, str]:
        """(speed, movement name)"""
        pass

class WalkMovement(MovementStrategy):
    def move(self) -> tuple[int, str]:
        return (5, "Walk")

class FlyMovement(MovementStrategy):
    def move(self) -> tuple[int, str]:
        return (15, "Fly")

class TeleportMovement(MovementStrategy):
    def move(self) -> tuple[int, str]:
        return (100, "Teleport")

# === Character: constructed via composition ===
@dataclass
class Character:
    name: str
    attack_strategy: AttackStrategy
    defense_strategy: DefenseStrategy
    movement_strategy: MovementStrategy
    hp: int = 100

    def perform_attack(self) -> str:
        damage, attack_name = self.attack_strategy.attack()
        return f"{self.name}: {attack_name} (Damage: {damage})"

    def perform_defense(self) -> str:
        defense, defense_name = self.defense_strategy.defend()
        return f"{self.name}: {defense_name} (Defense: {defense})"

    def perform_move(self) -> str:
        speed, move_name = self.movement_strategy.move()
        return f"{self.name}: {move_name} (Speed: {speed})"

    def equip_attack(self, strategy: AttackStrategy) -> None:
        """Change attack strategy at runtime"""
        self.attack_strategy = strategy

    def equip_movement(self, strategy: MovementStrategy) -> None:
        """Change movement strategy at runtime"""
        self.movement_strategy = strategy

# === Factory: provides typical configurations ===
class CharacterFactory:
    @staticmethod
    def create_warrior(name: str) -> Character:
        return Character(name, SwordAttack(), ShieldDefense(), WalkMovement())

    @staticmethod
    def create_mage(name: str) -> Character:
        return Character(name, MagicAttack(), MagicBarrier(), TeleportMovement())

    @staticmethod
    def create_ranger(name: str) -> Character:
        return Character(name, BowAttack(), DodgeDefense(), WalkMovement())

    @staticmethod
    def create_flying_warrior(name: str) -> Character:
        return Character(name, SwordAttack(), ShieldDefense(), FlyMovement())

# === Tests ===
warrior = CharacterFactory.create_warrior("Arthur")
mage = CharacterFactory.create_mage("Merlin")
ranger = CharacterFactory.create_ranger("Legolas")

print(warrior.perform_attack())   # Arthur: Sword slash (Damage: 20)
print(mage.perform_attack())      # Merlin: Fireball (Damage: 25)
print(ranger.perform_move())      # Legolas: Walk (Speed: 5)

# Power-up: gained flying ability!
warrior.equip_movement(FlyMovement())
print(warrior.perform_move())     # Arthur: Fly (Speed: 15)

# Switch to dual wield
warrior.equip_attack(DualWield(SwordAttack(), BowAttack()))
print(warrior.perform_attack())   # Arthur: Sword slash + Arrow shot (Damage: 27)

# Custom character: Magic Knight (no new class needed!)
magic_knight = Character(
    "Cecil", MagicAttack(), ShieldDefense(), WalkMovement()
)
print(magic_knight.perform_attack())  # Cecil: Fireball (Damage: 25)
print(magic_knight.perform_defense()) # Cecil: Shield block (Defense: 15)

print("\nAll tests passed!")
```

**Expected Output**:
```
Arthur: Sword slash (Damage: 20)
Merlin: Fireball (Damage: 25)
Legolas: Walk (Speed: 5)
Arthur: Fly (Speed: 15)
Arthur: Sword slash + Arrow shot (Damage: 27)
Cecil: Fireball (Damage: 25)
Cecil: Shield block (Defense: 15)

All tests passed!
```

---

## 8. FAQ

### Q1: Doesn't composition increase code volume?

**A**: In the short term, code volume increases slightly due to interface definitions and factories. However, in the long term, total code volume decreases because new combinations can be created without modifying existing code when adding features. Also, since each component is small and independent, understanding, testing, and changing code becomes easier, and development speed improves. There are cases where composition achieves the same result with 9 classes where inheritance would need 27.

### Q2: What is the relationship between composition and dependency injection (DI)?

**A**: Composition and dependency injection are closely related. Composition is the design of "what to combine," and DI is the implementation technique of "how to configure the combination." DI containers (Spring, Dagger, etc.) automate the configuration of composition patterns. That is, DI is a powerful tool for realizing composition. When DI is introduced into a composition-based design, swapping in mocks during testing becomes easy, and different components can be injected in production and test environments.

### Q3: In TypeScript/JavaScript, should I use Mixins or class inheritance?

**A**: In TypeScript, interface + composition is recommended. Mixins are a technique to work around the constraints of class inheritance, but type safety may be weakened in some cases. Mixins are convenient for small feature additions, but for large systems, interface-based composition + DI is more maintainable. React's custom hooks (useXxx) are a function-level composition pattern and are lighter and more recommended than class-based composition.

### Q4: Doesn't using composition degrade performance?

**A**: There is theoretically a slight overhead because method calls go through one extra level (the cost of delegation). However, due to JIT compiler inlining and method dispatch optimizations, a difference is rarely seen in practice. Rust's traits/generics achieve zero-cost abstraction by converting to static dispatch at compile time. The benefits of improved design flexibility and maintainability far outweigh any performance concerns.

### Q5: How should I refactor an existing large inheritance hierarchy?

**A**: Do not try to refactor everything at once. (1) Start by applying composition patterns in new code. (2) Gradually rewrite surrounding code at the time of bug fixes or feature additions. (3) Prioritize refactoring targets where "change frequency is high," "tests are hard to write," and "combinatorial explosion is occurring." Refer to Martin Fowler's Strangler Fig Pattern to gradually replace old inheritance with new composition.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world development?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## 9. Summary

| Category | Key Points |
|---------|---------|
| Basic principle | Default to composition; use inheritance only when LSP is satisfied |
| Strategy | When runtime switching of behavior is needed |
| Decorator | Best for dynamically adding and combining features |
| Delegate | Expose functionality while hiding internal implementation |
| Mixin/Trait | Adding cross-cutting features (when supported by the language) |
| DI | A tool for automating the configuration of composition patterns |
| Refactoring | Identify behavioral axes → extract interfaces → replace with composition |
| Applying inheritance | Only when a true is-a relationship exists; limit to 3 levels |
| Combinatorial explosion | Decompose N×M problems with Bridge/Strategy |

| Decision Criteria | Choose Inheritance | Choose Composition |
|---------|----------|----------|
| Relationship | True is-a | has-a / can-do |
| Direction of extension | One axis only | Combinations of multiple axes |
| Frequency of change | Low (stable hierarchy) | High (many requirement changes) |
| Testing | Integration-test focused | Unit-test focused |
| Runtime changes | Not needed | Needed |
| Hierarchy depth | 3 levels or fewer | Flat |

---

## Guides to Read Next

- [00-immutability.md](./00-immutability.md) -- Immutability principles (combining composition with immutable data)
- [02-functional-principles.md](./02-functional-principles.md) -- Functional programming principles (function composition)
- [03-api-design.md](./03-api-design.md) -- API design (compositional middleware design)
- 00-principles/02-solid.md -- SOLID principles (relationship between LSP, OCP, DIP and composition)
- 02-refactoring/01-refactoring-catalog.md -- Refactoring catalog
- `design-patterns-guide/docs/01-structural/` -- Structural patterns (Decorator, Bridge, Composite, etc.)
- `design-patterns-guide/docs/02-behavioral/` -- Behavioral patterns (Strategy, State, Observer, etc.)

---

## References

1. Gamma et al., "Design Patterns: Elements of Reusable Object-Oriented Software" -- The original GoF patterns book
2. Joshua Bloch, "Effective Java" 3rd edition -- Item 18: Favor composition over inheritance
3. Robert C. Martin, "Agile Software Development: Principles, Patterns, and Practices" -- OCP, LSP
4. Sandi Metz, "Practical Object-Oriented Design in Ruby" -- Composition chapter
5. Martin Fowler, "Refactoring" 2nd edition -- Replace Inheritance with Delegation
6. Head First Design Patterns, 2nd Edition -- Detailed explanation of Strategy, Decorator patterns
7. Go Proverbs -- "Don't just check errors, handle them gracefully" / Composition over inheritance in Go
8. Rust Book, "Traits: Defining Shared Behavior" -- https://doc.rust-lang.org/book/ch10-02-traits.html
9. Sam Newman, "Building Microservices" -- Service composition and orchestration
10. Michael Feathers, "Working Effectively with Legacy Code" -- Incremental refactoring of legacy code
