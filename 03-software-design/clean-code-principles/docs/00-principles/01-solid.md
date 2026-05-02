# SOLID Principles — The Five Foundational Principles of Object-Oriented Design

> The SOLID principles are five fundamental principles for designing software that is resilient to change and easy to extend. They were advocated by Robert C. Martin and named as an acronym by Michael Feathers.

---

## What You Will Learn in This Chapter

1. **The meaning and purpose of each SOLID principle** — Understand the essence of SRP, OCP, LSP, ISP, and DIP
2. **Signs and impact of principle violations** — Recognize the design problems that violations cause
3. **Practical application methods for each principle** — Internalize correct design through concrete code examples
4. **The interrelationships among principles** — Understand how the five principles work together and complement each other
5. **Criteria for applying the principles** — Develop a practical sense of balance and avoid over-application

---

## Prerequisites

| Prerequisite | Description | Reference |
|---------|------|-----------|
| Object-Oriented Programming | Classes, inheritance, polymorphism, interfaces | `../../02-programming/` |
| Clean Code Overview | Basic concepts and metrics for code quality | [00-clean-code-overview.md](./00-clean-code-overview.md) |
| Abstraction Concepts | Abstract classes, interfaces, dependencies | `../../02-programming/` |

---

## 1. Overview of SOLID Principles

### 1.1 Summary of Each Principle

```
+------------------------------------------------------------------+
|                    SOLID Principles                               |
+------------------------------------------------------------------+
| S - Single Responsibility Principle (SRP)                        |
|     → A class should have only one reason to change              |
+------------------------------------------------------------------+
| O - Open/Closed Principle (OCP)                                  |
|     → Open for extension, closed for modification                |
+------------------------------------------------------------------+
| L - Liskov Substitution Principle (LSP)                          |
|     → Subtypes must be substitutable for their base types        |
+------------------------------------------------------------------+
| I - Interface Segregation Principle (ISP)                        |
|     → Clients should not be forced to depend on methods they     |
|       do not use                                                 |
+------------------------------------------------------------------+
| D - Dependency Inversion Principle (DIP)                         |
|     → Depend on abstractions, not on concretions                 |
+------------------------------------------------------------------+
```

### 1.2 Why SOLID Principles Are Necessary — A Deep Dive into the WHY

It is relatively easy to "build something that works at first," but difficult to "build something that can keep being changed." The fundamental problem that SOLID principles solve is the **ripple effect of change**.

```
  Change Propagation Model

  Without SOLID                    With SOLID
  ┌──────────────────┐            ┌──────────────────┐
  │  Change Request  │            │  Change Request  │
  │      │           │            │      │           │
  │      v           │            │      v           │
  │  ┌───────┐       │            │  ┌───────┐       │
  │  │ ClassA│       │            │  │ ClassA│       │
  │  └───┬───┘       │            │  └───────┘       │
  │      │ ripples   │            │  (change ends here)│
  │  ┌───┼───┐       │            │                  │
  │  v   v   v       │            │  ClassB, ClassC  │
  │  B   C   D       │            │  → unaffected    │
  │  │   │   │       │            │                  │
  │  v   v   v       │            │                  │
  │  E   F   G       │            │                  │
  │  (6 classes affected)│        │  (only 1 class changes)│
  └──────────────────┘            └──────────────────┘
```

Specific problems that each SOLID principle solves:

| Principle | Problem Solved | Symptoms of Violation |
|------|------------|------------------|
| SRP | A single change affects unrelated functionality | Frequent unexpected bugs |
| OCP | Existing code must be modified every time a new feature is added | Proliferating if/switch branches |
| LSP | Derived classes break the assumptions of base classes | Increasing instanceof checks |
| ISP | Clients are forced to depend on methods they do not use | Empty method implementations |
| DIP | Direct dependency on concrete classes makes testing difficult | Impossible to create mocks |

### 1.3 Historical Background of SOLID Principles

Each SOLID principle was proposed in a different era by different researchers.

```
  Timeline

  1988  Barbara Liskov  → Original LSP paper
  1994  Liskov & Wing   → Formal definition of LSP
  1996  Robert C. Martin → OCP, DIP published in papers
  1988  Bertrand Meyer  → Pioneering description of OCP (Object-Oriented Software Construction, 1st ed.)
  2000  Robert C. Martin → SRP, ISP systematized
  2004  Michael Feathers → Named the 5 principles "SOLID"
  2017  Robert C. Martin → Redefined SOLID in Clean Architecture
```

---

## 2. S — Single Responsibility Principle (SRP)

### 2.1 Definition

> "A class should have only one reason to change." — Robert C. Martin

Robert C. Martin later refined this definition, redefining "reason to change" as "actor":

> "A module should be responsible to one, and only one, actor (stakeholder)." — Clean Architecture (2017)

This refinement resolved the ambiguity around "reason to change." An actor is a person or group that can request changes to that code.

```
   Class with multiple reasons to change     After applying SRP
   ┌─────────────────┐      ┌──────────────┐
   │   Employee       │      │  Employee     │
   │  ─────────────   │      │  ──────────── │
   │  calculatePay()  │──→   │  getName()    │
   │  generateReport()│      │  getDept()    │
   │  saveToDatabase() │     └──────────────┘
   └─────────────────┘      ┌──────────────┐
    Actors: 3                │ PayCalculator │
    · CFO (payroll rules)    │  ──────────── │
    · COO (report format)    │  calculate()  │
    · CTO (DB persistence)   └──────────────┘
                              ┌──────────────┐
                              │ ReportGenerator│
                              │  ──────────── │
                              │  generate()   │
                              └──────────────┘
                              ┌──────────────┐
                              │ EmployeeRepo  │
                              │  ──────────── │
                              │  save()       │
                              └──────────────┘
                              Actor: one each
```

### 2.2 How to Detect SRP Violations

A practical checklist for detecting SRP violations:

```
  SRP Violation Checklist

  □ The class name contains "And", "Or", "Manager", or "Handler"
  □ Explaining the class requires "...and then...and then..."
  □ There are 10 or more import statements
  □ The class exceeds 200 lines
  □ Testing requires unrelated mocks/stubs
  □ Change requests come from different teams/departments
  □ Every change breaks unrelated tests
```

### 2.3 Code Examples

**Code Example 1: SRP Violation and Improvement — User Management**

```python
# SRP violation: User class handles authentication, persistence, and notification
class User:
    def __init__(self, name: str, email: str, password: str):
        self.name = name
        self.email = email
        self.password = password

    def authenticate(self, password: str) -> bool:
        """Authentication logic (managed by the security team)"""
        return bcrypt.check(self.password, password)

    def save(self) -> None:
        """Persistence logic (managed by the infrastructure team)"""
        db.execute("INSERT INTO users ...", self.name, self.email)

    def send_welcome_email(self) -> None:
        """Notification logic (managed by the marketing team)"""
        smtp.send(self.email, "Welcome!", f"Hello {self.name}")


# SRP applied: Separate each responsibility into a dedicated class
class User:
    """Domain model for a user (data representation only)"""
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email


class AuthenticationService:
    """Handles authentication logic (actor: security team)"""
    def __init__(self, credential_store: "CredentialStore"):
        self.credential_store = credential_store

    def authenticate(self, user: User, password: str) -> bool:
        stored_hash = self.credential_store.get_hash(user.email)
        return bcrypt.check(stored_hash, password)


class UserRepository:
    """Handles user persistence (actor: infrastructure team)"""
    def __init__(self, db: "Database"):
        self.db = db

    def save(self, user: User) -> None:
        self.db.execute("INSERT INTO users ...", user.name, user.email)

    def find_by_email(self, email: str) -> User | None:
        row = self.db.query("SELECT * FROM users WHERE email = %s", email)
        return User(row['name'], row['email']) if row else None


class NotificationService:
    """Handles sending notifications (actor: marketing team)"""
    def __init__(self, mailer: "Mailer"):
        self.mailer = mailer

    def send_welcome(self, user: User) -> None:
        self.mailer.send(user.email, "Welcome!", f"Hello {user.name}")
```

**Code Example 2: Applying SRP in Practice — Log Analysis**

```python
# SRP violation: one class handles parsing, filtering, aggregation, and output
class LogAnalyzer:
    def analyze(self, log_file: str) -> None:
        # Parse
        entries = []
        with open(log_file) as f:
            for line in f:
                parts = line.strip().split(' ')
                entries.append({
                    'timestamp': parts[0],
                    'level': parts[1],
                    'message': ' '.join(parts[2:])
                })

        # Filter
        errors = [e for e in entries if e['level'] == 'ERROR']

        # Aggregate
        counts = {}
        for error in errors:
            msg = error['message'][:50]
            counts[msg] = counts.get(msg, 0) + 1

        # Output
        for msg, count in sorted(counts.items(), key=lambda x: -x[1]):
            print(f"{count:5d} | {msg}")


# SRP applied: separate each responsibility
from dataclasses import dataclass
from typing import Iterator

@dataclass
class LogEntry:
    timestamp: str
    level: str
    message: str

class LogParser:
    """Responsible for parsing log files"""
    def parse(self, log_file: str) -> list[LogEntry]:
        entries = []
        with open(log_file) as f:
            for line in f:
                entries.append(self._parse_line(line))
        return entries

    def _parse_line(self, line: str) -> LogEntry:
        parts = line.strip().split(' ', 2)
        return LogEntry(
            timestamp=parts[0],
            level=parts[1],
            message=parts[2] if len(parts) > 2 else ''
        )

class LogFilter:
    """Responsible for filtering log entries"""
    def filter_by_level(
        self, entries: list[LogEntry], level: str
    ) -> list[LogEntry]:
        return [e for e in entries if e.level == level]

class LogAggregator:
    """Responsible for aggregating logs"""
    def count_by_message(
        self, entries: list[LogEntry], prefix_length: int = 50
    ) -> dict[str, int]:
        counts: dict[str, int] = {}
        for entry in entries:
            key = entry.message[:prefix_length]
            counts[key] = counts.get(key, 0) + 1
        return counts

class LogReporter:
    """Responsible for outputting aggregated results"""
    def print_summary(self, counts: dict[str, int]) -> None:
        for msg, count in sorted(counts.items(), key=lambda x: -x[1]):
            print(f"{count:5d} | {msg}")
```

---

## 3. O — Open/Closed Principle (OCP)

### 3.1 Definition

> "Software entities should be open for extension, but closed for modification." — Bertrand Meyer

The essence of this principle is to create designs where **new behavior can be added without modifying existing code**.

### 3.2 How to Achieve OCP

There are three primary patterns for achieving OCP:

```
  Ways to Achieve OCP

  ┌─────────────────────────────────────────────────────┐
  │ 1. Polymorphism (most common)                        │
  │    → Define interfaces and allow implementations     │
  │      to be swapped                                  │
  │                                                     │
  │ 2. Strategy Pattern                                  │
  │    → Inject algorithms as objects                   │
  │                                                     │
  │ 3. Template Method Pattern                           │
  │    → Define the skeleton in a base class and        │
  │      implement details in derived classes           │
  └─────────────────────────────────────────────────────┘
```

### 3.3 Code Examples

**Code Example 3: OCP Violation and Improvement — Shape Area Calculation**

```typescript
// OCP violation: this class must be modified every time a new shape is added
class AreaCalculator {
  calculate(shape: any): number {
    if (shape.type === 'circle') {
      return Math.PI * shape.radius ** 2;
    } else if (shape.type === 'rectangle') {
      return shape.width * shape.height;
    } else if (shape.type === 'triangle') {
      return (shape.base * shape.height) / 2;
    }
    // A new if branch is added every time a new shape is added...
    throw new Error(`Unknown shape: ${shape.type}`);
  }
}

// OCP applied: new shapes are handled by adding a class only (no changes to existing code)
interface Shape {
  area(): number;
  perimeter(): number;
}

class Circle implements Shape {
  constructor(private radius: number) {}
  area(): number {
    return Math.PI * this.radius ** 2;
  }
  perimeter(): number {
    return 2 * Math.PI * this.radius;
  }
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area(): number {
    return this.width * this.height;
  }
  perimeter(): number {
    return 2 * (this.width + this.height);
  }
}

// Adding a new shape: no changes to existing code whatsoever
class Pentagon implements Shape {
  constructor(private side: number) {}
  area(): number {
    return (Math.sqrt(5 * (5 + 2 * Math.sqrt(5))) / 4) * this.side ** 2;
  }
  perimeter(): number {
    return 5 * this.side;
  }
}

class AreaCalculator {
  calculate(shape: Shape): number {
    return shape.area();  // Delegate processing via polymorphism
  }

  calculateTotal(shapes: Shape[]): number {
    return shapes.reduce((total, shape) => total + shape.area(), 0);
  }
}
```

**Code Example 4: Applying OCP — Strategy Pattern for Discount Calculation**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal

@dataclass
class Order:
    subtotal: Decimal
    customer_type: str
    item_count: int

# OCP violation: adding new discount rules requires modifying existing code
class DiscountCalculatorBad:
    def calculate(self, order: Order) -> Decimal:
        if order.customer_type == 'vip':
            return order.subtotal * Decimal('0.20')
        elif order.customer_type == 'regular' and order.item_count >= 10:
            return order.subtotal * Decimal('0.10')
        elif order.customer_type == 'employee':
            return order.subtotal * Decimal('0.30')
        # An elif is added every time a new discount rule is added
        return Decimal('0')


# OCP applied: extensible via strategy pattern
class DiscountStrategy(ABC):
    @abstractmethod
    def calculate(self, order: Order) -> Decimal:
        """Calculate the discount amount"""
        pass

    @abstractmethod
    def is_applicable(self, order: Order) -> bool:
        """Determine if this discount is applicable"""
        pass

class VipDiscount(DiscountStrategy):
    def calculate(self, order: Order) -> Decimal:
        return order.subtotal * Decimal('0.20')

    def is_applicable(self, order: Order) -> bool:
        return order.customer_type == 'vip'

class BulkDiscount(DiscountStrategy):
    MIN_ITEMS = 10
    def calculate(self, order: Order) -> Decimal:
        return order.subtotal * Decimal('0.10')

    def is_applicable(self, order: Order) -> bool:
        return order.item_count >= self.MIN_ITEMS

class EmployeeDiscount(DiscountStrategy):
    def calculate(self, order: Order) -> Decimal:
        return order.subtotal * Decimal('0.30')

    def is_applicable(self, order: Order) -> bool:
        return order.customer_type == 'employee'

# Adding a new discount: just create a SeasonalDiscount class
class SeasonalDiscount(DiscountStrategy):
    """Seasonal discount (adding this does not change existing code)"""
    def calculate(self, order: Order) -> Decimal:
        return order.subtotal * Decimal('0.15')

    def is_applicable(self, order: Order) -> bool:
        from datetime import date
        month = date.today().month
        return month in (7, 8, 12)  # Summer and year-end

class DiscountCalculator:
    """Orchestrator for discount calculation (closed for modification)"""
    def __init__(self, strategies: list[DiscountStrategy]):
        self.strategies = strategies

    def calculate_best_discount(self, order: Order) -> Decimal:
        applicable = [
            s.calculate(order)
            for s in self.strategies
            if s.is_applicable(order)
        ]
        return max(applicable, default=Decimal('0'))

# Usage: inject strategies
calculator = DiscountCalculator([
    VipDiscount(),
    BulkDiscount(),
    EmployeeDiscount(),
    SeasonalDiscount(),  # Just add the new strategy
])
```

---

## 4. L — Liskov Substitution Principle (LSP)

### 4.1 Definition

> "If S is a subtype of T, then objects of type T in a program may be replaced with objects of type S without altering any of the desirable properties of that program." — Barbara Liskov

### 4.2 The Contract Model of LSP

To correctly understand LSP, the concept of "Design by Contract" is essential.

```
  Contract Model

  Contract defined by the base class:
  ┌───────────────────────────────────────┐
  │  Precondition                         │
  │  → Conditions that must hold before   │
  │    a method call                      │
  │  → Derived classes cannot strengthen  │
  │    preconditions                      │
  │                                       │
  │  Postcondition                        │
  │  → Conditions guaranteed after a      │
  │    method call                        │
  │  → Derived classes cannot weaken      │
  │    postconditions                     │
  │                                       │
  │  Invariant                            │
  │  → Conditions the object must always  │
  │    satisfy                            │
  │  → Derived classes must also maintain │
  └───────────────────────────────────────┘

  Examples of violations:
  · Strengthened precondition: base accepts positive numbers, derived accepts only even numbers
  · Weakened postcondition: base always returns non-null, derived may return null
  · Broken invariant: base guarantees sorted order, derived does not
```

### 4.3 Code Examples

**Code Example 5: Classic LSP Violation (Rectangle/Square Problem)**

```python
class Rectangle:
    def __init__(self, width: int, height: int):
        self._width = width
        self._height = height

    @property
    def width(self) -> int:
        return self._width

    @width.setter
    def width(self, value: int):
        self._width = value

    @property
    def height(self) -> int:
        return self._height

    @height.setter
    def height(self, value: int):
        self._height = value

    def area(self) -> int:
        return self._width * self._height


# LSP violation: Square breaks the contract of Rectangle
class Square(Rectangle):
    def __init__(self, side: int):
        super().__init__(side, side)

    @Rectangle.width.setter
    def width(self, value: int):
        self._width = value
        self._height = value  # Changing the width also changes the height!

    @Rectangle.height.setter
    def height(self, value: int):
        self._width = value
        self._height = value


# This function assumes the contract of Rectangle
def test_area(rect: Rectangle):
    rect.width = 5
    rect.height = 4
    assert rect.area() == 20  # Fails with Square! (5*5=25)


# LSP-compliant: design with a common interface
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> int:
        pass

    @abstractmethod
    def perimeter(self) -> int:
        pass

class Rectangle(Shape):
    def __init__(self, width: int, height: int):
        self._width = width
        self._height = height

    def area(self) -> int:
        return self._width * self._height

    def perimeter(self) -> int:
        return 2 * (self._width + self._height)

class Square(Shape):
    def __init__(self, side: int):
        self._side = side

    def area(self) -> int:
        return self._side ** 2

    def perimeter(self) -> int:
        return 4 * self._side
```

**Code Example 6: Practical LSP Violation — Collections**

```java
// LSP violation: ReadOnlyList breaks the "addable" contract of List
class ReadOnlyList<T> extends ArrayList<T> {
    @Override
    public boolean add(T element) {
        throw new UnsupportedOperationException("Read-only list");
    }

    @Override
    public T remove(int index) {
        throw new UnsupportedOperationException("Read-only list");
    }
}

// A function that accepts List assumes add() can be called
void addDefaultItems(List<String> list) {
    list.add("default1");  // Runtime error with ReadOnlyList!
    list.add("default2");
}


// LSP-compliant: use appropriate interfaces for each purpose
// Java's standard library already provides this distinction
void readItems(Iterable<String> items) {
    // Read-only → Iterable is sufficient
    for (String item : items) {
        System.out.println(item);
    }
}

void modifyItems(List<String> items) {
    // Modification required → require List (ReadOnlyList won't be passed)
    items.add("new item");
}
```

### 4.4 LSP Violation Detection Patterns

| Detection Pattern | Example | Fix |
|------------|-----|--------|
| `instanceof` check | `if (shape instanceof Circle)` | Replace with polymorphism |
| `UnsupportedOperationException` | `throw new UnsupportedOperationException()` | Interface segregation (ISP) |
| Downcast | `(Circle) shape` | Revisit the design |
| Type-based branching | `if (type == "square")` | Strategy pattern |
| Strengthened precondition in derived class | Base accepts positive numbers, derived requires positive even numbers | Redesign the contract |

---

## 5. I — Interface Segregation Principle (ISP)

### 5.1 Definition

> "Clients should not be forced to depend upon interfaces that they do not use." — Robert C. Martin

### 5.2 The Internal Mechanism of ISP

The problems ISP solves are "unnecessary recompilation" and "unnecessary redeployment." When a client depends on an interface that includes methods it does not use, the client is affected when those methods change.

```
  ISP violation: The problem with fat interfaces

  ┌───────────────┐
  │  FatInterface  │
  │  ─────────────│
  │  methodA()     │ ← Used by ClientA
  │  methodB()     │ ← Used by ClientB
  │  methodC()     │ ← Used by ClientC
  └───────┬───────┘
          │
     ┌────┼────┐
     v    v    v
  ClientA ClientB ClientC

  A change to methodB() → ClientA and ClientC also need recompilation
  (even though they don't use it!)


  ISP applied: segregate interfaces

  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ InterfaceA│  │InterfaceB│  │InterfaceC│
  │ methodA() │  │methodB() │  │methodC() │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       v              v              v
    ClientA       ClientB        ClientC

  A change to methodB() → only ClientB needs recompilation
```

### 5.3 Code Examples

**Code Example 7: ISP Violation and Improvement — Worker Interface**

```java
// ISP violation: a bloated interface
interface Worker {
    void work();
    void eat();
    void sleep();
    void attendMeeting();
    void writeReport();
}

// Robots cannot eat or sleep, but are forced to implement these
class Robot implements Worker {
    public void work() { /* perform work */ }
    public void eat() { throw new UnsupportedOperationException(); }   // Also an LSP violation!
    public void sleep() { throw new UnsupportedOperationException(); }
    public void attendMeeting() { throw new UnsupportedOperationException(); }
    public void writeReport() { throw new UnsupportedOperationException(); }
}


// ISP applied: segregate interfaces by role
interface Workable {
    void work();
}

interface Feedable {
    void eat();
}

interface Restable {
    void sleep();
}

interface Communicable {
    void attendMeeting();
    void writeReport();
}

// Human: implements all
class HumanWorker implements Workable, Feedable, Restable, Communicable {
    public void work() { /* perform work */ }
    public void eat() { /* eat a meal */ }
    public void sleep() { /* sleep */ }
    public void attendMeeting() { /* attend a meeting */ }
    public void writeReport() { /* write a report */ }
}

// Robot: implements only what is needed
class RobotWorker implements Workable {
    public void work() { /* perform work */ }
}

// AI assistant: work and communication
class AiAssistant implements Workable, Communicable {
    public void work() { /* perform work */ }
    public void attendMeeting() { /* take meeting minutes */ }
    public void writeReport() { /* generate a report */ }
}
```

**Code Example 8: Applying ISP — Repository Interfaces**

```typescript
// ISP violation: all CRUD operations in a single interface
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  update(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
  bulkInsert(entities: T[]): Promise<void>;
  executeRawQuery(sql: string): Promise<any>;
}

// A read-only report service still sees all methods
class ReportService {
  constructor(private repo: Repository<Order>) {}
  // save, delete, executeRawQuery are dependencies even though they are never used
}


// ISP applied: segregate interfaces by use case
interface Readable<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
}

interface Writable<T> {
  save(entity: T): Promise<void>;
  update(entity: T): Promise<void>;
}

interface Deletable {
  delete(id: string): Promise<void>;
}

interface BulkOperable<T> {
  bulkInsert(entities: T[]): Promise<void>;
}

// Full CRUD repository
interface CrudRepository<T>
  extends Readable<T>, Writable<T>, Deletable {}

// Report service depends only on the read-only interface
class ReportService {
  constructor(private repo: Readable<Order>) {}

  async generateMonthlyReport(): Promise<Report> {
    const orders = await this.repo.findAll();
    // ... report generation logic
  }
}

// Admin service uses all features
class AdminService {
  constructor(private repo: CrudRepository<Order>) {}

  async deleteOrder(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
```

---

## 6. D — Dependency Inversion Principle (DIP)

### 6.1 Definition

> "High-level modules should not depend on low-level modules. Both should depend on abstractions." — Robert C. Martin

> "Abstractions should not depend on details. Details should depend on abstractions."

### 6.2 The Internal Mechanism of DIP

DIP decouples high-level business logic from low-level infrastructure details by **inverting the direction of dependencies**.

```
  DIP violation                  DIP applied
  ┌──────────┐                  ┌──────────┐
  │ OrderSvc  │                 │ OrderSvc  │
  └─────┬─────┘                 └─────┬─────┘
        │ direct dependency           │ depends on abstraction
        v                             v
  ┌──────────┐              ┌────────────────┐
  │ MySQLRepo │              │ <<interface>>   │
  └──────────┘              │ OrderRepository │
   Depends on concretion     └───────┬────────┘
   → Changing MySQL also          │ implemented by
     affects OrderSvc        ┌─────┼─────┐
                              v     v     v
                         MySQL  Postgres InMemory
                          Repo   Repo    Repo
   → No matter which implementation is used, OrderSvc is unaffected
```

### 6.3 Code Examples

**Code Example 9: DIP Violation and Improvement — Notification System**

```python
# DIP violation: high-level module directly depends on concrete classes
class OrderService:
    def __init__(self):
        self.repository = MySQLOrderRepository()  # Direct dependency on concretion
        self.notifier = EmailNotifier()            # Direct dependency on concretion
        self.logger = FileLogger()                 # Direct dependency on concretion

    def place_order(self, order: "Order") -> None:
        self.repository.save(order)
        self.notifier.notify(order.customer, "Your order has been received")
        self.logger.log(f"Order {order.id} processed")


# DIP applied: depend on abstractions (interfaces)
from abc import ABC, abstractmethod

class OrderRepository(ABC):
    @abstractmethod
    def save(self, order: "Order") -> None:
        pass

    @abstractmethod
    def find_by_id(self, order_id: str) -> "Order | None":
        pass

class Notifier(ABC):
    @abstractmethod
    def notify(self, recipient: str, message: str) -> None:
        pass

class Logger(ABC):
    @abstractmethod
    def log(self, message: str) -> None:
        pass


class OrderService:
    """High-level module: depends only on abstractions"""
    def __init__(
        self,
        repository: OrderRepository,
        notifier: Notifier,
        logger: Logger
    ):
        self.repository = repository
        self.notifier = notifier
        self.logger = logger

    def place_order(self, order: "Order") -> None:
        self.repository.save(order)
        self.notifier.notify(order.customer, "Your order has been received")
        self.logger.log(f"Order {order.id} processed")


# Low-level modules: implement the abstractions
class PostgreSQLOrderRepository(OrderRepository):
    def __init__(self, connection_string: str):
        self.connection_string = connection_string

    def save(self, order: "Order") -> None:
        # PostgreSQL-specific implementation
        pass

    def find_by_id(self, order_id: str) -> "Order | None":
        pass

class SlackNotifier(Notifier):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    def notify(self, recipient: str, message: str) -> None:
        # Notification via Slack API
        pass

class CloudWatchLogger(Logger):
    def log(self, message: str) -> None:
        # Send to AWS CloudWatch
        pass


# Assembly (Composition Root)
service = OrderService(
    repository=PostgreSQLOrderRepository("postgresql://..."),
    notifier=SlackNotifier("https://hooks.slack.com/..."),
    logger=CloudWatchLogger()
)

# During testing: inject mocks
class MockRepository(OrderRepository):
    def __init__(self):
        self.saved_orders = []

    def save(self, order):
        self.saved_orders.append(order)

    def find_by_id(self, order_id):
        return next((o for o in self.saved_orders if o.id == order_id), None)

test_service = OrderService(
    repository=MockRepository(),
    notifier=MockNotifier(),
    logger=MockLogger()
)
```

**Code Example 10: The Relationship Between DIP and Dependency Injection (DI)**

```typescript
// DIP is an architectural principle; DI is an implementation technique to achieve it

// 1. Constructor injection (most recommended)
class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly mailer: Mailer
  ) {}

  async register(email: string, password: string): Promise<User> {
    const hashedPassword = await this.hasher.hash(password);
    const user = new User(email, hashedPassword);
    await this.repository.save(user);
    await this.mailer.sendWelcome(email);
    return user;
  }
}

// 2. Setter injection (for optional dependencies)
class ReportGenerator {
  private formatter: ReportFormatter = new DefaultFormatter();

  setFormatter(formatter: ReportFormatter): void {
    this.formatter = formatter;
  }
}

// 3. Method injection (for dependencies that vary per call)
class DataProcessor {
  process(data: RawData, transformer: DataTransformer): ProcessedData {
    return transformer.transform(data);
  }
}
```

---

## 7. Interrelationships Among SOLID Principles

### 7.1 Relationship Diagram

```
  ┌──────────────────────────────────────────────────────┐
  │         Interrelationships Among SOLID Principles     │
  │                                                      │
  │  ┌─────┐    prerequisite     ┌─────┐                 │
  │  │ LSP │ ─────────────────→ │ OCP │                 │
  │  └──┬──┘                    └──┬──┘                  │
  │     │                          │                      │
  │     │ type safety              │ means of realization │
  │     │                          │                      │
  │     v                          v                      │
  │  ┌─────┐    IF version      ┌─────┐                  │
  │  │ ISP │ ←──────────────── │ SRP │                  │
  │  └──┬──┘                    └─────┘                  │
  │     │                                                │
  │     │ minimizing dependencies                        │
  │     v                                                │
  │  ┌─────┐                                             │
  │  │ DIP │ ← means of achieving OCP                   │
  │  └─────┘                                             │
  └──────────────────────────────────────────────────────┘
```

### 7.2 Relationship Details

| Principle | Main Focus | Relationship to Other Principles |
|------|----------|------------------|
| SRP | Scope of class responsibility | The class-level version of ISP. Increases cohesion |
| OCP | Flexibility for extension | Achieved via polymorphism in combination with DIP. LSP is a prerequisite |
| LSP | Correctness of inheritance | Prerequisite of OCP. Guarantees type safety |
| ISP | Granularity of interfaces | The interface-level version of SRP. Minimizes dependencies for DIP |
| DIP | Direction of dependencies | The means to achieve OCP. Dependencies minimized with ISP |

### 7.3 Combining Principles in Practice

```python
# Example of combining SOLID principles: notification service

# SRP: responsible only for sending notifications
# OCP: new notification channels are handled by adding a class
# LSP: all Notifiers honor the contract of the send method
# ISP: synchronous and asynchronous are separated
# DIP: depends on abstractions

from abc import ABC, abstractmethod

# ISP: separate synchronous and asynchronous notifications
class SyncNotifier(ABC):
    @abstractmethod
    def send(self, recipient: str, message: str) -> bool:
        """Send a message synchronously and return success/failure"""
        pass

class AsyncNotifier(ABC):
    @abstractmethod
    async def send(self, recipient: str, message: str) -> str:
        """Send a message asynchronously and return a job ID"""
        pass

# LSP: each implementation fully honors the interface contract
class EmailNotifier(SyncNotifier):
    """SRP: responsible only for sending email"""
    def __init__(self, smtp_config: dict):
        self.smtp = SmtpClient(smtp_config)

    def send(self, recipient: str, message: str) -> bool:
        try:
            self.smtp.send_mail(recipient, message)
            return True
        except SmtpError:
            return False

class SlackNotifier(AsyncNotifier):
    """SRP: responsible only for Slack notifications"""
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    async def send(self, recipient: str, message: str) -> str:
        response = await http_post(self.webhook_url, {"text": message})
        return response["job_id"]

# OCP: adding a new notification channel does not change existing code
class SmsNotifier(SyncNotifier):
    """New addition: SMS notification"""
    def __init__(self, api_key: str):
        self.sms_client = SmsClient(api_key)

    def send(self, recipient: str, message: str) -> bool:
        return self.sms_client.send_sms(recipient, message)

# DIP: NotificationService depends only on abstractions
class NotificationService:
    def __init__(self, notifiers: list[SyncNotifier]):
        self.notifiers = notifiers

    def notify_all(self, recipient: str, message: str) -> dict[str, bool]:
        results = {}
        for notifier in self.notifiers:
            name = type(notifier).__name__
            results[name] = notifier.send(recipient, message)
        return results
```

---

## 8. Criteria for Applying the Principles

### 8.1 When to Apply and When to Avoid

| Situation | Apply SOLID | Avoid Over-application |
|------|-----------|-------------------|
| Frequently changed areas | Apply proactively | -- |
| Stable utility code | Minimal is sufficient | Excessive abstraction violates YAGNI |
| Prototypes / PoC | Can be deferred | Don't over-invest in design |
| Core logic in team development | Required | -- |
| One-off scripts | Not needed | Over-engineering |
| Libraries / Frameworks | Required | Also consider usability for consumers |
| Microservice boundaries | Required (especially DIP) | Apply within services as appropriate |

### 8.2 Guidelines for Incremental Application

```
  Incremental Application Flow for SOLID Principles

  Step 1: Start with SRP (most intuitive)
  ├── Split large classes when you find them
  └── "Can I explain what this function does in one sentence?"

  Step 2: Apply DIP (improve testability)
  ├── Abstract external service dependencies behind interfaces
  └── Introduce constructor injection

  Step 3: Be mindful of OCP (in areas with frequent changes)
  ├── When you see proliferating if/switch, convert to polymorphism
  └── Apply the strategy pattern

  Step 4: Fine-tune with ISP
  ├── Segregate bloated interfaces
  └── Provide the minimum necessary interface for each client

  Step 5: Quality assurance with LSP
  ├── Validate the legitimacy of inheritance relationships
  └── Add contract tests
```

### 8.3 The Cost of Over-application

```
  Cost-Benefit Curve of SOLID Application

  Benefit
    ^
    |        *****
    |    ****     ***
    |  **             **
    | *                 *         ← moderate application
    |*                   *
    |                     **      ← over-application
    +-------------------------> Degree of SOLID Application
    0%   25%   50%   75%  100%

    0-50%: Benefits increase as you apply more
    50-75%: Benefits increase gradually
    75-100%: Overhead of abstraction outweighs benefits
```

---

## 9. SOLID Principles and Other Paradigms

### 9.1 Functional Programming and SOLID

| SOLID Principle | Functional Programming Equivalent | Description |
|-----------|-----------------|------|
| SRP | Pure functions | Each function performs only one transformation |
| OCP | Higher-order functions | Accept functions as arguments to extend behavior |
| LSP | Referential transparency | Same input always produces the same output |
| ISP | Type classes (Haskell) | Require only the behavior that is needed |
| DIP | Function injection | Accept function types rather than specific functions |

```python
# OCP in functional style: extension via higher-order functions
from typing import Any, Callable

# Inject a sort strategy as a function (OCP + DIP)
def sort_users(
    users: list[dict],
    key_fn: Callable[[dict], Any] = lambda u: u['name']
) -> list[dict]:
    return sorted(users, key=key_fn)

# Adding a new sort criterion: no changes to existing code
by_age = lambda u: u['age']
by_score_desc = lambda u: -u['score']

sort_users(users, key_fn=by_age)
sort_users(users, key_fn=by_score_desc)
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: God Class (the extreme of SRP violation)

```python
# BAD: cramming all responsibilities into a single class
class Application:
    def authenticate_user(self): ...
    def process_payment(self): ...
    def generate_report(self): ...
    def send_notification(self): ...
    def validate_input(self): ...
    def manage_cache(self): ...
    def handle_logging(self): ...
    # Methods continue for 1000+ lines...

# GOOD: split classes by responsibility
class AuthService: ...
class PaymentService: ...
class ReportService: ...
class NotificationService: ...
class InputValidator: ...
class CacheManager: ...
class Logger: ...
```

### Anti-Pattern 2: Excessive Abstraction (SOLID Fundamentalism)

```java
// BAD: interface + implementation + factory + DI config just for one method
interface StringFormatter { String format(String s); }
class UpperCaseFormatter implements StringFormatter {
    public String format(String s) { return s.toUpperCase(); }
}
class StringFormatterFactory {
    public StringFormatter create(String type) { ... }
}
class StringFormatterConfig {
    @Bean
    public StringFormatter formatter() { return new UpperCaseFormatter(); }
}
// In reality, s.toUpperCase() alone is sufficient

// GOOD: abstract only when the need arises
String formatted = input.toUpperCase();
```

### Anti-Pattern 3: Leaky Abstraction

```python
# BAD: interface leaks DB-specific details
class UserRepository(ABC):
    @abstractmethod
    def find_by_sql(self, sql: str) -> list[User]:
        """Find users by SQL query"""
        pass  # SQL-specific → problematic for non-RDBMS implementations

    @abstractmethod
    def set_connection_pool_size(self, size: int) -> None:
        """Set the connection pool size"""
        pass  # Connection pool-specific → meaningless for in-memory implementations

# GOOD: define the interface in the language of the domain
class UserRepository(ABC):
    @abstractmethod
    def find_by_email(self, email: str) -> User | None:
        """Find a user by email address"""
        pass

    @abstractmethod
    def find_active_users(self, since: datetime) -> list[User]:
        """Find users who have been active since the given date"""
        pass
```

---

## 11. Practical Exercises

### Exercise 1 (Basic): Detecting and Fixing SRP Violations

Identify the SRP violations in the following class and separate its responsibilities.

```python
class ReportManager:
    def __init__(self, db_connection):
        self.db = db_connection

    def fetch_sales_data(self, start_date, end_date):
        query = f"SELECT * FROM sales WHERE date BETWEEN '{start_date}' AND '{end_date}'"
        return self.db.execute(query)

    def calculate_totals(self, sales_data):
        total = sum(item['amount'] for item in sales_data)
        tax = total * 0.10
        return {'subtotal': total, 'tax': tax, 'total': total + tax}

    def format_as_html(self, report_data):
        html = "<html><body>"
        html += f"<h1>Sales Report</h1>"
        html += f"<p>Total: {report_data['total']}</p>"
        html += "</body></html>"
        return html

    def send_email(self, recipient, html_content):
        import smtplib
        server = smtplib.SMTP('localhost')
        server.sendmail('reports@company.com', recipient, html_content)
        server.quit()

    def generate_and_send(self, start_date, end_date, recipient):
        data = self.fetch_sales_data(start_date, end_date)
        totals = self.calculate_totals(data)
        html = self.format_as_html(totals)
        self.send_email(recipient, html)
```

**Expected Analysis:**

Separation of responsibilities:
- **SalesDataRepository**: Data retrieval (actor: DBA/infrastructure team)
- **SalesCalculator**: Aggregation calculations (actor: accounting department)
- **HtmlReportFormatter**: HTML formatting (actor: design team)
- **EmailSender**: Email delivery (actor: infrastructure team)
- **ReportService**: Orchestration (a coordinator with no business responsibility of its own)

**Expected Output:**

```python
class SalesDataRepository:
    def __init__(self, db):
        self.db = db

    def fetch(self, start_date: str, end_date: str) -> list[dict]:
        return self.db.execute(
            "SELECT * FROM sales WHERE date BETWEEN %s AND %s",
            (start_date, end_date)
        )

class SalesCalculator:
    TAX_RATE = Decimal('0.10')

    def calculate_totals(self, sales_data: list[dict]) -> dict:
        subtotal = sum(Decimal(str(item['amount'])) for item in sales_data)
        tax = subtotal * self.TAX_RATE
        return {'subtotal': subtotal, 'tax': tax, 'total': subtotal + tax}

class ReportFormatter(ABC):
    @abstractmethod
    def format(self, report_data: dict) -> str: ...

class HtmlReportFormatter(ReportFormatter):
    def format(self, report_data: dict) -> str:
        return f"""<html><body>
        <h1>Sales Report</h1>
        <p>Total: {report_data['total']}</p>
        </body></html>"""

class EmailSender:
    def __init__(self, smtp_host: str, from_address: str):
        self.smtp_host = smtp_host
        self.from_address = from_address

    def send(self, recipient: str, content: str) -> None:
        # SMTP sending logic
        pass

class ReportService:
    def __init__(self, repo, calculator, formatter, sender):
        self.repo = repo
        self.calculator = calculator
        self.formatter = formatter
        self.sender = sender

    def generate_and_send(self, start_date, end_date, recipient):
        data = self.repo.fetch(start_date, end_date)
        totals = self.calculator.calculate_totals(data)
        content = self.formatter.format(totals)
        self.sender.send(recipient, content)
```

### Exercise 2 (Intermediate): Extension Design with OCP

Redesign the following payment processing class so that adding new payment methods does not require modifying existing code.

```python
class PaymentProcessor:
    def process(self, payment_method: str, amount: float) -> bool:
        if payment_method == "credit_card":
            # Credit card payment logic
            return self._process_credit_card(amount)
        elif payment_method == "bank_transfer":
            # Bank transfer logic
            return self._process_bank_transfer(amount)
        elif payment_method == "paypal":
            # PayPal logic
            return self._process_paypal(amount)
        else:
            raise ValueError(f"Unsupported payment method: {payment_method}")
```

**Expected Output:**

```python
from abc import ABC, abstractmethod

class PaymentMethod(ABC):
    @abstractmethod
    def process(self, amount: float) -> bool: ...

    @abstractmethod
    def name(self) -> str: ...

class CreditCardPayment(PaymentMethod):
    def process(self, amount: float) -> bool:
        # Credit card payment logic
        return True
    def name(self) -> str:
        return "credit_card"

class BankTransferPayment(PaymentMethod):
    def process(self, amount: float) -> bool:
        # Bank transfer logic
        return True
    def name(self) -> str:
        return "bank_transfer"

# Adding a new payment method: no changes to existing code
class CryptoPayment(PaymentMethod):
    def process(self, amount: float) -> bool:
        # Cryptocurrency payment logic
        return True
    def name(self) -> str:
        return "crypto"

class PaymentProcessor:
    def __init__(self):
        self._methods: dict[str, PaymentMethod] = {}

    def register(self, method: PaymentMethod) -> None:
        self._methods[method.name()] = method

    def process(self, method_name: str, amount: float) -> bool:
        if method_name not in self._methods:
            raise ValueError(f"Unsupported payment method: {method_name}")
        return self._methods[method_name].process(amount)
```

### Exercise 3 (Advanced): Full Application of SOLID Principles

Design and implement the following requirements in compliance with all SOLID principles.

**Requirements:** Library book management system
- Register, search, check out, and return books
- Checkout notifications (email/SMS)
- Overdue checks and fine calculation
- Support for multiple data stores (DB/file/in-memory)

**Expected Design Overview:**

```
  SRP: each class has a single responsibility
  ├── Book (domain model)
  ├── BookRepository (persistence)
  ├── LoanService (lending business logic)
  ├── FineCalculator (fine calculation)
  ├── NotificationService (sending notifications)
  └── LibraryFacade (orchestration)

  OCP: adding a notification channel requires only a new class
  DIP: LoanService → depends on BookRepository (abstraction)
  ISP: separate interfaces for read/admin operations
  LSP: all Repository implementations honor their contracts
```

---

## 12. FAQ

### Q1: Should all SOLID principles be applied at the same time?

There is no need to apply all of them at once. It is practical to start with SRP and then apply OCP and DIP in areas subject to frequent change. Introduce them incrementally based on the scale of the project and the frequency of change. Fully applying SOLID to small scripts or prototypes is over-engineering.

### Q2: Can SOLID be applied to functional programming?

Conceptually, yes. SRP corresponds to "a function does one thing," OCP to "extend with higher-order functions," and DIP to "inject functions." However, since the terminology was defined in an OOP context, functional programming tends to use different principle names (purity, composability, referential transparency, etc.).

### Q3: How do I detect LSP violations?

The following code smells are hints for detection:
- A derived class is throwing `UnsupportedOperationException`
- The number of `instanceof` / `typeof` checks is increasing
- A derived class is strengthening preconditions or weakening postconditions of the base class
- There is an inheritance relationship where "is-a" does not hold (the Square-is-a-Rectangle problem)

An automated detection method is "contract testing," where the base class's test suite is also run against the derived class.

### Q4: Are DIP and a DI container mandatory?

DIP is a principle; a DI container is just one way to achieve it. DIP can be achieved with constructor injection alone. A DI container becomes necessary in large-scale applications where the dependency graph becomes complex. For smaller projects, manual DI (assembling dependencies by hand) is sufficient.

### Q5: What is the relationship between SOLID and microservices?

A microservices architecture can be seen as the application of SOLID principles at the "service level":
- **SRP**: Each service is responsible for one business domain
- **OCP**: New features are handled by adding a new service
- **LSP**: Honor the API contract of a service
- **ISP**: Expose only the necessary APIs
- **DIP**: Services communicate through abstractions such as message queues

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Principle | In One Phrase | Signs of Violation | Improvement Technique |
|------|--------|-----------|---------|
| SRP | One reason to change | Giant classes, frequent modifications | Extract Class |
| OCP | Handle changes via extension | Proliferating if/switch | Strategy, Template Method |
| LSP | Substitutable | instanceof checks | Redesign the interface |
| ISP | Small interfaces | Empty method implementations | Interface segregation |
| DIP | Depend on abstractions | Direct use of new | Constructor injection |

### Priority Guide for Applying Each Principle

| Priority | Principle | Reason |
|--------|------|------|
| 1 (first) | SRP | Most intuitive with the greatest impact |
| 2 | DIP | Dramatically improves testability |
| 3 | OCP | Effective in areas with many changes |
| 4 | ISP | Reinforces the effect of DIP |
| 5 | LSP | Important when using inheritance |

---

## Guides to Read Next

- [DRY/KISS/YAGNI](./02-dry-kiss-yagni.md) — Principles of deduplication and simplification
- [Coupling and Cohesion](./03-coupling-cohesion.md) — The foundation of module design
- [Law of Demeter](./04-law-of-demeter.md) — Concrete rules for reducing coupling
- [Composition vs Inheritance](../03-practices-advanced/01-composition-over-inheritance.md) — Design decisions beyond LSP
- Design Patterns: Creational — Patterns for achieving OCP and DIP
- Design Patterns: Behavioral — OCP realization techniques such as the Strategy pattern
- System Design: Architecture — Applying SOLID at the architectural level

---

## References

1. **Robert C. Martin** *Agile Software Development: Principles, Patterns, and Practices* Prentice Hall, 2002
2. **Robert C. Martin** *Clean Architecture: A Craftsman's Guide to Software Structure and Design* Prentice Hall, 2017
3. **Barbara Liskov, Jeannette Wing** "A Behavioral Notion of Subtyping" ACM Transactions on Programming Languages and Systems, 1994
4. **Bertrand Meyer** *Object-Oriented Software Construction* Prentice Hall, 1997 (2nd Edition)
5. **Martin Fowler** *Refactoring: Improving the Design of Existing Code* Addison-Wesley, 2018 (2nd Edition)
6. **Sandi Metz** *Practical Object-Oriented Design: An Agile Primer Using Ruby* Addison-Wesley, 2018
7. **Michael Feathers** *Working Effectively with Legacy Code* Prentice Hall, 2004
8. **Mark Seemann** *Dependency Injection: Principles, Practices, and Patterns* Manning Publications, 2019
