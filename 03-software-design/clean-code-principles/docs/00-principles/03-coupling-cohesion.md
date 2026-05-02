# Coupling and Cohesion — The Foundational Principles of Module Design

> Good module design comes down to "low coupling, high cohesion." Coupling measures the strength of dependencies between modules; cohesion measures how strongly the elements within a module are related. By keeping these two metrics in mind, you can build systems that are resilient to change and easy to understand.

---

## What You Will Learn in This Chapter

1. **The 7 Levels of Coupling** — Understand the types and risks of dependencies, from content coupling to data coupling
2. **The 7 Levels of Cohesion** — Understand how elements are organized within a module, from coincidental cohesion to functional cohesion
3. **Design Techniques for Achieving Low Coupling and High Cohesion** — Learn concrete refactoring methods
4. **Quantitative Measurement of Coupling and Cohesion** — Master metric measurement using static analysis tools
5. **Application at the Architecture Level** — Understand how to apply these principles in microservices and modular monoliths

---

## Prerequisites

To get the most out of this guide, you should have the following knowledge.

| Prerequisite | Required Level | Reference |
|---------|----------|--------|
| SOLID Principles (especially SRP, DIP) | Basic understanding | [SOLID Principles](./01-solid.md) |
| Overview of Clean Code | Recommended reading | [Clean Code Overview](./00-clean-code-overview.md) |
| DRY/KISS/YAGNI | Basic understanding | [DRY/KISS/YAGNI](./02-dry-kiss-yagni.md) |
| Object-Oriented Basics | Practical experience | -- |
| Design Pattern Fundamentals | General awareness | Design Patterns Overview |

---

## 1. Coupling — The Strength of Dependencies Between Modules

### 1.1 Why You Should Understand Coupling

The concept of coupling was proposed in 1974 by Larry Constantine and Edward Yourdon. Their research was grounded in empirical data showing that "50–80% of software maintenance costs are spent managing the ripple effects of changes."

```
  Cost of Change Model (Constantine-Yourdon, 1979)

  Cost of Change = Direct Cost + Ripple Cost + Test Cost

  ┌─────────────────────────────────────────────────────┐
  │  Highly Coupled System                               │
  │                                                       │
  │  Direct Cost : ████ (20%)                             │
  │  Ripple Cost : ████████████████████ (55%)             │
  │  Test Cost   : █████████ (25%)                        │
  │                                                       │
  │  → Only 20% is actual change. The rest is ripple and verification │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │  Loosely Coupled System                              │
  │                                                       │
  │  Direct Cost : ████████████ (50%)                     │
  │  Ripple Cost : ████ (15%)                             │
  │  Test Cost   : ████████ (35%)                         │
  │                                                       │
  │  → Change impact is local, and testing is limited    │
  └─────────────────────────────────────────────────────┘
```

There are three essential reasons to understand coupling:

1. **Localizing changes**: In a loosely coupled system, a change in one place is unlikely to ripple to others
2. **Testability**: Modules can be tested in isolation (no mocks needed, or minimal ones)
3. **Parallel team development**: Independent modules allow teams to develop in parallel

Quantifying the impact in real projects looks like this:

| Coupling Level | Files Affected per Change | Regression Bug Rate | Build Time (incremental) |
|------------|------------------------|-------------------|-----------------|
| High coupling | 10–50 files | 15–30% | Full build required |
| Medium coupling | 3–10 files | 5–15% | Partial build possible |
| Low coupling | 1–3 files | 1–5% | Module-level build |

### 1.2 The 7 Levels of Coupling

Based on the Constantine-Yourdon classification, here are the 7 levels of coupling, ordered from most to least dangerous.

```
  Risk: High ←────────────────────────────────────────────→ Low

  ┌───────┬────────┬────────┬────────┬────────┬────────┬───────┐
  │Content│Common  │External│Control │Stamp   │Data    │Message│
  │       │        │        │        │        │        │       │
  │Direct │Shares  │Shares  │Switches│Passes  │Passes  │Commu- │
  │access │global  │external│behavior│entire  │only    │nicates│
  │to     │variable│format  │with    │data    │needed  │via    │
  │internals│      │        │flags   │structure│values │message│
  └───────┴────────┴────────┴────────┴────────┴────────┴───────┘
   Never   Avoid   Minimize  Minimize Tolerate Target   Ideal
```

**Detailed Definitions of Each Level:**

| Level | Name | Definition | Example | Risk |
|------|------|------|--------|--------|
| 1 | Content Coupling | Directly accesses another module's internal implementation (private variables, internal code) | Accessing `obj._private_field` | Highest |
| 2 | Common Coupling | Multiple modules read/write to a global variable or shared state | Sharing a global config object | High |
| 3 | External Coupling | Shares an external data format, communication protocol, or device interface | Common CSV format, shared DB schema | Medium-High |
| 4 | Control Coupling | Uses a flag or control value to switch another module's behavior | `process(data, is_pdf=True)` | Medium |
| 5 | Stamp Coupling | Passes a data structure containing more data than needed | A function receives the entire `User` object but only uses `name` | Low-Medium |
| 6 | Data Coupling | Only the minimum necessary primitive values are passed | `calculate(subtotal, tax_rate)` | Low |
| 7 | Message Coupling | Communicates only via messages (events) without knowing the recipient exists | Event notification via EventBus | Lowest |

**Code Example 1: Code at Each of the 7 Coupling Levels**

```python
# === 1. Content Coupling (Worst): Depends on another module's internal implementation ===
class OrderProcessor:
    def process(self, cart):
        # Directly manipulates Cart's private implementation
        cart._items[0]._price = cart._items[0]._price * 0.9
        cart._total_cache = None  # Manually reset the cache
        # → Breaks immediately if Cart's internal implementation changes

# === 2. Common Coupling (Bad): Sharing global variables ===
GLOBAL_CONFIG = {}

class ServiceA:
    def do_work(self):
        GLOBAL_CONFIG['last_run'] = datetime.now()
        GLOBAL_CONFIG['status'] = 'running'

class ServiceB:
    def do_work(self):
        # Depends on ServiceA's side effects
        if GLOBAL_CONFIG.get('last_run'):
            pass
        # → Changes to ServiceA's implementation affect ServiceB

# === 3. External Coupling (Caution): Sharing external formats ===
class CsvExporter:
    def export(self, data):
        # Depends on common CSV format: "id,name,price\n"
        return ",".join([str(data['id']), data['name'], str(data['price'])])

class CsvImporter:
    def import_data(self, csv_line):
        # Depends on the same CSV format
        parts = csv_line.split(",")
        return {'id': int(parts[0]), 'name': parts[1], 'price': float(parts[2])}
    # → Both need to be updated when the format changes

# === 4. Control Coupling (Watch out): Switching behavior with flags ===
class ReportGenerator:
    def generate(self, data, format_type: str):
        if format_type == 'pdf':
            return self._generate_pdf(data)
        elif format_type == 'csv':
            return self._generate_csv(data)
        elif format_type == 'excel':
            return self._generate_excel(data)
    # → The caller knows about the internal branching logic

# === 5. Stamp Coupling (Tolerable): Passing the entire data structure ===
class EmailSender:
    def send_welcome(self, user: User):
        # Receives the entire User object but only uses name and email
        send_email(to=user.email, subject=f"Welcome {user.name}")
    # → Changes to User's structure may have an impact

# === 6. Data Coupling (Ideal): Passing only the necessary primitive values ===
class TaxCalculator:
    def calculate(self, subtotal: float, tax_rate: float) -> float:
        return subtotal * tax_rate
    # → Arguments are primitive values only. No dependency on other types

# === 7. Message Coupling (Most Ideal): Communicating only via messages ===
class OrderService:
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus

    def place_order(self, order):
        order.confirm()
        self.event_bus.publish('order_placed', {'order_id': order.id})
    # → Doesn't even know the recipient exists
```

### 1.3 Techniques for Reducing Coupling

```
  Direct Dependency               Indirect Dependency (via abstraction)

  ┌───────┐                   ┌───────┐
  │ ModuleA │                  │ ModuleA │
  └───┬───┘                   └───┬───┘
      │ import & new               │ depends on abstraction
      v                           v
  ┌───────┐               ┌─────────────┐
  │ ModuleB │               │ <<interface>>│
  └───────┘               │  IModuleB    │
                            └──────┬──────┘
                                   │ implements
                                   v
                            ┌───────────┐
                            │ ModuleBImpl│
                            └───────────┘
```

**List of Techniques:**

| Technique | Effect | When to Apply | Cost |
|-----------|------|---------|--------|
| Dependency Injection (DI) | Eliminates dependency on concrete classes | Dependencies between services | Low |
| Interface extraction | Hides implementation details | Module boundaries | Low-Medium |
| Event-driven | Fully decouples sender from receiver | Async processing, notifications | Medium |
| Facade pattern | Consolidates dependencies on complex subsystems to a single point | Communication between layers | Low |
| Adapter pattern | Isolates dependency on external libraries | Third-party integrations | Low-Medium |
| Message queue | Physically separates services | Microservices | High |

**Code Example 2: Decoupling via Event-Driven Architecture**

```python
from typing import Callable, Any
from dataclasses import dataclass, field
from datetime import datetime

# === Before: Tight Coupling ===
# OrderService directly calls InventoryService, NotificationService, and AnalyticsService

class OrderServiceTightlyCoupled:
    def __init__(self):
        self.inventory = InventoryService()     # Direct dependency on concrete class
        self.notification = NotificationService() # Direct dependency on concrete class
        self.analytics = AnalyticsService()     # Direct dependency on concrete class

    def place_order(self, order):
        self.inventory.reduce_stock(order.items)
        self.notification.send_confirmation(order)
        self.analytics.track_purchase(order)
        # → This class must be modified every time new processing is added (OCP violation)
        # → All dependencies must be set up when testing each service


# === After: Loosely coupled via event-driven architecture ===

@dataclass
class DomainEvent:
    """Base class for domain events"""
    occurred_at: datetime = field(default_factory=datetime.now)

@dataclass
class OrderPlacedEvent(DomainEvent):
    """Order confirmed event"""
    order_id: str = ""
    customer_id: str = ""
    items: list = field(default_factory=list)
    total_amount: float = 0.0

class EventBus:
    """Simple in-memory event bus"""
    def __init__(self):
        self._handlers: dict[type, list[Callable]] = {}

    def subscribe(self, event_type: type, handler: Callable) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def publish(self, event: DomainEvent) -> None:
        for handler in self._handlers.get(type(event), []):
            handler(event)

    def unsubscribe(self, event_type: type, handler: Callable) -> None:
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

class OrderService:
    """Order service - responsible only for publishing events"""
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus

    def place_order(self, order) -> None:
        order.confirm()
        # Does not know about the existence of other services
        self.event_bus.publish(OrderPlacedEvent(
            order_id=order.id,
            customer_id=order.customer_id,
            items=order.items,
            total_amount=order.total_amount
        ))

# Each handler can be registered and tested independently
class InventoryHandler:
    def handle_order_placed(self, event: OrderPlacedEvent) -> None:
        for item in event.items:
            self.reduce_stock(item.product_id, item.quantity)

class NotificationHandler:
    def handle_order_placed(self, event: OrderPlacedEvent) -> None:
        self.send_confirmation_email(event.customer_id, event.order_id)

class AnalyticsHandler:
    def handle_order_placed(self, event: OrderPlacedEvent) -> None:
        self.track_purchase(event.order_id, event.total_amount)

# Assembly (Composition Root)
event_bus = EventBus()
event_bus.subscribe(OrderPlacedEvent, InventoryHandler().handle_order_placed)
event_bus.subscribe(OrderPlacedEvent, NotificationHandler().handle_order_placed)
event_bus.subscribe(OrderPlacedEvent, AnalyticsHandler().handle_order_placed)

# Adding a new handler does not require modifying OrderService (OCP compliant)
# event_bus.subscribe(OrderPlacedEvent, LoyaltyPointHandler().handle_order_placed)
```

**Code Example 3: Decoupling via Dependency Injection**

```python
from abc import ABC, abstractmethod
from typing import Protocol

# === Define interfaces (abstractions) ===

class PaymentGateway(Protocol):
    """Payment gateway interface"""
    def charge(self, amount: float, currency: str) -> PaymentResult: ...

class NotificationService(Protocol):
    """Notification service interface"""
    def send(self, recipient: str, message: str) -> None: ...

class OrderRepository(Protocol):
    """Order repository interface"""
    def save(self, order: Order) -> None: ...
    def find_by_id(self, order_id: str) -> Order | None: ...


# === Concrete class implementations ===

class StripePaymentGateway:
    """Payment implementation using Stripe"""
    def __init__(self, api_key: str):
        self.api_key = api_key

    def charge(self, amount: float, currency: str) -> PaymentResult:
        # Call the Stripe API
        response = stripe.Charge.create(amount=int(amount * 100), currency=currency)
        return PaymentResult(success=True, transaction_id=response.id)

class EmailNotificationService:
    """Notification implementation via email"""
    def __init__(self, smtp_config: SmtpConfig):
        self.smtp = smtp_config

    def send(self, recipient: str, message: str) -> None:
        # Send email via SMTP
        send_email(to=recipient, body=message, config=self.smtp)

class PostgresOrderRepository:
    """Order persistence using PostgreSQL"""
    def __init__(self, connection_pool):
        self.pool = connection_pool

    def save(self, order: Order) -> None:
        with self.pool.connection() as conn:
            conn.execute("INSERT INTO orders ...", order.to_dict())

    def find_by_id(self, order_id: str) -> Order | None:
        with self.pool.connection() as conn:
            row = conn.execute("SELECT * FROM orders WHERE id = %s", [order_id])
            return Order.from_dict(row) if row else None


# === Service depends only on abstractions ===

class OrderService:
    """Order service - has no knowledge of any concrete classes"""
    def __init__(
        self,
        repository: OrderRepository,
        payment: PaymentGateway,
        notification: NotificationService,
    ):
        self.repository = repository
        self.payment = payment
        self.notification = notification

    def place_order(self, order: Order) -> OrderResult:
        payment_result = self.payment.charge(order.total, order.currency)
        if not payment_result.success:
            return OrderResult.payment_failed(payment_result.error)

        self.repository.save(order)
        self.notification.send(
            order.customer_email,
            f"Your order {order.id} has been received"
        )
        return OrderResult.success(order.id)


# === In tests: inject mocks ===

class MockPaymentGateway:
    def __init__(self, should_succeed: bool = True):
        self.should_succeed = should_succeed
        self.charges: list = []

    def charge(self, amount: float, currency: str) -> PaymentResult:
        self.charges.append((amount, currency))
        if self.should_succeed:
            return PaymentResult(success=True, transaction_id="mock-txn-001")
        return PaymentResult(success=False, error="Mock decline")

class MockNotificationService:
    def __init__(self):
        self.sent_messages: list = []

    def send(self, recipient: str, message: str) -> None:
        self.sent_messages.append((recipient, message))

# Test
def test_place_order_success():
    mock_payment = MockPaymentGateway(should_succeed=True)
    mock_notification = MockNotificationService()
    mock_repository = InMemoryOrderRepository()

    service = OrderService(mock_repository, mock_payment, mock_notification)
    result = service.place_order(create_test_order())

    assert result.is_success
    assert len(mock_payment.charges) == 1
    assert len(mock_notification.sent_messages) == 1
```

### 1.4 Quantitative Measurement of Coupling

Coupling can be measured quantitatively using static analysis tools, not just subjective judgment.

| Metric | Definition | Ideal Value | Tools |
|-----------|------|--------|--------|
| CBO (Coupling Between Objects) | Number of other classes a given class depends on | 10 or fewer | SonarQube, JDepend |
| Ca (Afferent Coupling) | Number of external modules that depend on this module | -- | NDepend, Structure101 |
| Ce (Efferent Coupling) | Number of external modules this module depends on | -- | NDepend, Structure101 |
| Instability = Ce / (Ca + Ce) | Instability. Closer to 1 means more unstable | Determined by design intent (stable vs. unstable) | NDepend |

```python
# Example of measuring CBO (Coupling Between Objects)
# Count the CBO of the following class

class OrderService:                  # CBO = 5
    def __init__(
        self,
        repository: OrderRepository,    # 1. OrderRepository
        payment: PaymentGateway,         # 2. PaymentGateway
        notification: NotificationService, # 3. NotificationService
        logger: Logger,                  # 4. Logger
    ):
        pass

    def place_order(self, order: Order) -> OrderResult:  # 5. Order, 6. OrderResult
        pass
    # → CBO = 6 (number of dependency classes)
    # → Within acceptable range because it is 10 or fewer

# Example of a class with CBO that is too high
class GodService:                    # CBO = 15+
    def __init__(
        self,
        user_repo, order_repo, product_repo,     # 3
        payment, shipping, tax_calculator,        # 3
        email_service, sms_service, push_service, # 3
        cache, logger, metrics,                   # 3
        config, event_bus, scheduler              # 3
    ):
        pass
    # → CBO = 15: candidate for refactoring
```

**Using Instability in Design:**

```
  Stable Dependencies Principle (SDP)

  Unstable modules should depend on stable modules,
  not the other way around.

  Instability = Ce / (Ca + Ce)

  Stable (I=0)                    Unstable (I=1)
  ┌───────────┐                  ┌───────────┐
  │ Abstract  │ ←── depends on ──│ UI Layer  │
  │ Ca=10,Ce=0│                  │ Ca=0,Ce=5 │
  │ I = 0.0   │                  │ I = 1.0   │
  └───────────┘                  └───────────┘
  Unlikely to change              Free to change
  (many things depend on it)     (nothing depends on it)

  ✗ Stable module depends on an unstable module → Dangerous
  ✓ Unstable module depends on a stable module → Safe
```

---

## 2. Cohesion — The Relatedness of Elements Within a Module

### 2.1 Why You Should Understand Cohesion

A module with low cohesion causes the following problems:

1. **Many reasons to change**: Unrelated elements are grouped together, causing changes for a variety of reasons (SRP violation)
2. **Increased understanding cost**: The purpose of the module is unclear, taking time to read and understand
3. **Reduced reusability**: It brings in unnecessary dependencies, making it hard to reuse in other projects
4. **Difficult to test**: It is unclear what to test, leading to an enormous number of test cases

```
  Relationship Between Cohesion and Maintainability (Empirical study: Bieman & Kang, 1995)

  Maintainability
  (Understandability)
    ^
    |                                    ★ Functional Cohesion
    |                              ★ Sequential Cohesion
    |                        ★ Communicational Cohesion
    |                  ★ Procedural Cohesion
    |            ★ Temporal Cohesion
    |      ★ Logical Cohesion
    |★ Coincidental Cohesion
    +──────────────────────────────────→ Cohesion
    Low                                 High
```

### 2.2 The 7 Levels of Cohesion

```
  Quality: Low ←──────────────────────────────────────────→ High

  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  │Coinci│Logical│Tempor│Proced│Commun│Sequen│Functi│
  │dental │      │al    │ural  │icatio│tial  │onal  │
  │      │      │      │      │nal   │      │      │
  │Unrela│Groups│Groups│Execut│Operat│Output│Single│
  │ted   │simila│by    │ed in │on    │of one│clear │
  │elemen│r type│timing│order │same  │feeds │respon│
  │ts    │only  │only  │      │data  │next  │sibili│
  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘
  Avoid   Avoid  Caution Tolerate Good   Good   Best
```

**Detailed Definitions and Examples of Each Level:**

| Level | Name | Definition | How to Identify |
|------|------|------|---------|
| 1 | Coincidental Cohesion | Groups unrelated elements into one | Class name is `Util`, `Manager`, `Helper` |
| 2 | Logical Cohesion | Groups logically similar categories together | Switches processing based on arguments or flags |
| 3 | Temporal Cohesion | Groups processing that executes at the same time | `initialize()`, `cleanup()` |
| 4 | Procedural Cohesion | Processes in a specific execution order | Breaks if order is changed, but data is not shared |
| 5 | Communicational Cohesion | Groups processing that operates on the same data | All methods use the same fields |
| 6 | Sequential Cohesion | The output of one step becomes the input of the next | Pipeline processing |
| 7 | Functional Cohesion | Has one clear, single responsibility | The question "What does this class do?" can be answered in one sentence |

**Code Example 4: Code at Each Level of Cohesion**

```java
// === 1. Coincidental Cohesion (Worst): A grab-bag of unrelated functions ===
class Utilities {
    public static String formatDate(Date d) { /* date processing */ }
    public static double calculateTax(double amount) { /* tax calculation */ }
    public static void sendEmail(String to, String body) { /* email sending */ }
    public static Image resizeImage(Image img, int w, int h) { /* image processing */ }
    // → Date, tax, email, and images have no relationship to each other
}

// === 2. Logical Cohesion (Low): Just grouped by similar type ===
class InputHandler {
    public void handleMouseInput(MouseEvent e) { /* mouse processing */ }
    public void handleKeyboardInput(KeyEvent e) { /* keyboard processing */ }
    public void handleTouchInput(TouchEvent e) { /* touch processing */ }
    public void handleGamepadInput(GamepadEvent e) { /* gamepad processing */ }
    // → Just grouped by the logical category "input." Each handler is independent.
}

// === 3. Temporal Cohesion (Moderate): Just grouped by when they run ===
class AppInitializer {
    public void initialize() {
        loadConfig();       // Load configuration
        initDatabase();     // Initialize DB
        startWebServer();   // Start web server
        registerShutdownHook(); // Register shutdown hook
    }
    // → Just grouped by the timing "at app startup"
}

// === 4. Procedural Cohesion: Execute in a specific order ===
class FileProcessor {
    public void process(String path) {
        openFile(path);
        readHeader();
        parseBody();
        closeFile();
    }
    // → Order is fixed, but open/read/parse/close are conceptually different
}

// === 5. Communicational Cohesion: Operate on the same data ===
class EmployeeReport {
    private List<Employee> employees;

    public double calculateAverageSalary() { /* uses employees */ }
    public Employee findHighestPaid() { /* uses employees */ }
    public List<Employee> filterByDepartment(String dept) { /* uses employees */ }
    // → All methods operate on the employees field
}

// === 6. Sequential Cohesion: Pipeline processing ===
class DataPipeline {
    public Report generate(RawData raw) {
        CleanedData cleaned = clean(raw);       // Raw data → Cleaned data
        AnalyzedData analyzed = analyze(cleaned); // Cleaned data → Analyzed data
        return format(analyzed);                  // Analyzed data → Report
    }
    // → The output of each step is the input of the next
}

// === 7. Functional Cohesion (Best): One clear responsibility ===
class PasswordHasher {
    private final int saltLength;
    private final int iterations;

    public PasswordHasher(int saltLength, int iterations) {
        this.saltLength = saltLength;
        this.iterations = iterations;
    }

    public String hash(String password) {
        byte[] salt = generateSalt();
        return pbkdf2(password, salt, iterations);
    }

    public boolean verify(String password, String hashedPassword) {
        byte[] salt = extractSalt(hashedPassword);
        String rehashed = pbkdf2(password, salt, iterations);
        return constantTimeEquals(rehashed, hashedPassword);
    }

    private byte[] generateSalt() { /* generate salt */ }
    private byte[] extractSalt(String hash) { /* extract salt */ }
    private String pbkdf2(String password, byte[] salt, int iterations) { /* hash calculation */ }
    // → Only one responsibility: "hashing passwords"
}
```

### 2.3 Quantitative Measurement of Cohesion: LCOM

**LCOM (Lack of Cohesion in Methods)** is a metric that quantitatively measures the cohesion of a class.

```
  How to Calculate LCOM (Henderson-Sellers version: LCOM*)

  LCOM* = (m - (1/f) * Σsum(mf)) / (m - 1)

  m  = Number of methods
  f  = Number of fields
  mf = Sum of the number of methods accessing each field

  Range of LCOM*: 0 to 1
  0 = Perfectly cohesive (all methods use all fields)
  1 = Perfectly non-cohesive (each method uses different fields)
```

```python
# Example of LCOM calculation

class HighCohesion:
    """LCOM = Low (high cohesion)"""
    def __init__(self, x, y):
        self.x = x  # Field 1
        self.y = y  # Field 2

    def distance_from_origin(self):
        return (self.x**2 + self.y**2) ** 0.5  # Uses both x and y

    def move(self, dx, dy):
        self.x += dx  # Uses x
        self.y += dy  # Uses y

    def __str__(self):
        return f"({self.x}, {self.y})"  # Uses both x and y

    # m=3, f=2
    # x: accessed by 3 methods, y: accessed by 3 methods
    # LCOM* = (3 - (1/2) * (3+3)) / (3-1) = (3 - 3) / 2 = 0
    # → LCOM = 0: Perfectly cohesive


class LowCohesion:
    """LCOM = High (low cohesion)"""
    def __init__(self):
        self.user_name = ""     # Field 1
        self.order_total = 0.0  # Field 2
        self.log_level = "INFO" # Field 3

    def get_user_name(self):
        return self.user_name       # Uses only user_name

    def calculate_total(self):
        return self.order_total * 1.1  # Uses only order_total

    def set_log_level(self, level):
        self.log_level = level      # Uses only log_level

    # m=3, f=3
    # user_name: 1, order_total: 1, log_level: 1
    # LCOM* = (3 - (1/3) * (1+1+1)) / (3-1) = (3 - 1) / 2 = 1.0
    # → LCOM = 1.0: Perfectly non-cohesive → Should be split into 3 independent classes
```

---

## 3. Patterns for Achieving Low Coupling and High Cohesion

### 3.1 Managing Coupling with the Facade Pattern

**Code Example 5: Facade Pattern**

```typescript
// ============================================================
// Before: Tight coupling - the client directly depends on multiple subsystems
// ============================================================
class OrderPage {
  placeOrder(cart: Cart) {
    const inventory = new InventorySystem();
    const payment = new PaymentGateway();
    const shipping = new ShippingCalculator();
    const notification = new EmailService();
    const loyalty = new LoyaltyPointService();

    // Directly depends on 5 subsystems (CBO = 5)
    const available = inventory.check(cart.items);
    if (!available) throw new Error('Out of stock');

    const total = shipping.calculate(cart);
    const paymentResult = payment.charge(cart.customer, total);
    notification.sendConfirmation(cart.customer.email);
    loyalty.addPoints(cart.customer.id, Math.floor(total / 100));
  }
}

// ============================================================
// After: Consolidate coupling with a Facade
// ============================================================

// The Facade hides the internal subsystems
class OrderFacade {
  constructor(
    private inventory: InventorySystem,
    private payment: PaymentGateway,
    private shipping: ShippingCalculator,
    private notification: EmailService,
    private loyalty: LoyaltyPointService
  ) {}

  placeOrder(cart: Cart): OrderResult {
    // The Facade manages internal coordination logic
    if (!this.inventory.check(cart.items)) {
      return OrderResult.outOfStock();
    }

    const total = this.shipping.calculate(cart);

    const paymentResult = this.payment.charge(cart.customer, total);
    if (!paymentResult.success) {
      return OrderResult.paymentFailed(paymentResult.error);
    }

    // Non-critical processing: order is considered successful even if these fail
    this.trySendConfirmation(cart.customer.email);
    this.tryAddLoyaltyPoints(cart.customer.id, total);

    return OrderResult.success(paymentResult.transactionId);
  }

  private trySendConfirmation(email: string): void {
    try {
      this.notification.sendConfirmation(email);
    } catch (e) {
      console.warn('Failed to send confirmation email', e);
    }
  }

  private tryAddLoyaltyPoints(customerId: string, total: number): void {
    try {
      this.loyalty.addPoints(customerId, Math.floor(total / 100));
    } catch (e) {
      console.warn('Failed to add loyalty points', e);
    }
  }
}

// The client depends only on the Facade (CBO = 1)
class OrderPage {
  constructor(private orderFacade: OrderFacade) {}

  placeOrder(cart: Cart) {
    return this.orderFacade.placeOrder(cart);
  }
}
```

### 3.2 Expressing Cohesion Through Package Structure

**Code Example 6: Domain-Based Package Organization**

```
# ============================================================
# Before: Low cohesion package organization (organized by technical layer)
# ============================================================
# A single change ripples across multiple directories
# Example: Adding a new field to User → modify 3 directories

src/
  controllers/           # Controllers for all domains mixed together
    UserController.ts
    OrderController.ts
    ProductController.ts
  services/              # Services for all domains mixed together
    UserService.ts
    OrderService.ts
    ProductService.ts
  repositories/          # Repositories for all domains mixed together
    UserRepository.ts
    OrderRepository.ts
    ProductRepository.ts

# ============================================================
# After: High cohesion package organization (organized by domain)
# ============================================================
# A single change is contained within a single directory
# Example: Adding a new field to User → modify only within user/

src/
  user/                  # All elements of the User domain are consolidated
    UserController.ts
    UserService.ts
    UserRepository.ts
    User.ts
    UserValidator.ts
    user.test.ts
    index.ts             # Exports only the public API
  order/                 # All elements of the Order domain are consolidated
    OrderController.ts
    OrderService.ts
    OrderRepository.ts
    Order.ts
    OrderValidator.ts
    order.test.ts
    index.ts
  product/               # All elements of the Product domain are consolidated
    ProductController.ts
    ProductService.ts
    ProductRepository.ts
    Product.ts
    product.test.ts
    index.ts
  shared/                # Shared utilities (keep to a minimum)
    types.ts
    errors.ts
    logger.ts
```

### 3.3 Isolating External Coupling with the Adapter Pattern

**Code Example 7: Localizing the Impact of External Library Changes**

```python
from abc import ABC, abstractmethod
from typing import Any

# === Interface: the contract expected by the application ===

class FileStorage(ABC):
    """File storage interface"""
    @abstractmethod
    def upload(self, key: str, data: bytes) -> str:
        """Upload a file and return its URL"""
        pass

    @abstractmethod
    def download(self, key: str) -> bytes:
        """Download a file"""
        pass

    @abstractmethod
    def delete(self, key: str) -> None:
        """Delete a file"""
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Check if a file exists"""
        pass


# === Adapter: AWS S3 implementation ===

class S3FileStorage(FileStorage):
    """Implementation using AWS S3"""
    def __init__(self, bucket_name: str, region: str):
        import boto3
        self.s3 = boto3.client('s3', region_name=region)
        self.bucket = bucket_name

    def upload(self, key: str, data: bytes) -> str:
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data)
        return f"https://{self.bucket}.s3.amazonaws.com/{key}"

    def download(self, key: str) -> bytes:
        response = self.s3.get_object(Bucket=self.bucket, Key=key)
        return response['Body'].read()

    def delete(self, key: str) -> None:
        self.s3.delete_object(Bucket=self.bucket, Key=key)

    def exists(self, key: str) -> bool:
        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except self.s3.exceptions.NoSuchKey:
            return False


# === Adapter: Local filesystem implementation (for development) ===

class LocalFileStorage(FileStorage):
    """Implementation using the local filesystem (for development and testing)"""
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def upload(self, key: str, data: bytes) -> str:
        file_path = self.base_dir / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        return f"file://{file_path}"

    def download(self, key: str) -> bytes:
        return (self.base_dir / key).read_bytes()

    def delete(self, key: str) -> None:
        (self.base_dir / key).unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        return (self.base_dir / key).exists()


# === Service: has no knowledge of the storage implementation ===

class DocumentService:
    """Document service - depends only on the FileStorage interface"""
    def __init__(self, storage: FileStorage):
        self.storage = storage

    def save_document(self, name: str, content: bytes) -> str:
        key = f"documents/{name}"
        return self.storage.upload(key, content)

    def get_document(self, name: str) -> bytes:
        key = f"documents/{name}"
        return self.storage.download(key)

# Usage examples
# Production: DocumentService(S3FileStorage("my-bucket", "ap-northeast-1"))
# Development: DocumentService(LocalFileStorage("/tmp/dev-storage"))
# Testing: DocumentService(InMemoryFileStorage())
```

---

## 4. The Relationship Between Coupling and Cohesion

### 4.1 Combining the Two Axes

| Combination | Low Coupling | High Coupling |
|-----------|--------|--------|
| **High Cohesion** | **Ideal.** Independent, clear modules. Changes are localized and testing is easy. | Responsibility is clear but dependencies are many. Can be improved with DI or event-driven approaches. |
| **Low Cohesion** | Few dependencies but the module's purpose is unclear. Improve by splitting or merging. | **Worst.** Spaghetti code. Requires a complete refactoring. |

```
                 Coupling
          Low ←────────→ High
         ┌──────┬──────┐
  Cohe High│  ★   │  △   │
  sion     │ Ideal │ DI   │
           │      │improve│
           ├──────┼──────┤
       Low │  △   │  ✗   │
           │Split │Spaghe│
           │improve│tti  │
           └──────┴──────┘
```

### 4.2 Selecting an Improvement Approach

| Improvement Approach | Target | Specific Method | Priority |
|--------------|------|-----------|--------|
| Reduce coupling | Between modules | DI, interfaces, event-driven, Adapter | High |
| Increase cohesion | Within a module | Extract Class, Move Method, Inline Class | High |
| Improve both at once | Architecture | Domain-Driven Design (DDD), modular monolith | Medium |
| Restructure packages | Directories | Migrate to a functionally cohesive package structure | Medium |
| Define API boundaries | Module public surface | Minimize public API, hide internals | High |

### 4.3 Coupling and Cohesion by Architecture Pattern

```
  Architecture Patterns and Their Coupling/Cohesion Characteristics

  ┌─────────────────┬───────────┬───────────┬─────────────────┐
  │ Pattern          │ Coupling  │ Cohesion  │ Characteristics  │
  ├─────────────────┼───────────┼───────────┼─────────────────┤
  │ Monolith         │ High      │ Low       │ Single deploy    │
  │ (Layered)        │           │           │ Change impact: Large │
  ├─────────────────┼───────────┼───────────┼─────────────────┤
  │ Modular Monolith │ Low-Med   │ High      │ Single deploy    │
  │                  │           │           │ Clear module boundaries │
  ├─────────────────┼───────────┼───────────┼─────────────────┤
  │ Microservices    │ Low       │ High      │ Independent deploy │
  │                  │           │           │ Operational cost: High │
  ├─────────────────┼───────────┼───────────┼─────────────────┤
  │ Event-Driven     │ Lowest    │ High      │ Async communication │
  │                  │           │           │ Debugging: Difficult │
  └─────────────────┴───────────┴───────────┴─────────────────┘
```

**Code Example 8: Boundary Design in a Modular Monolith**

```python
# === Modular Monolith: Module design with clear boundaries ===

# --- Module's public API (index.py / __init__.py) ---

# user_module/__init__.py
"""Public API for the User module"""
from .service import UserService
from .models import User, UserProfile
from .events import UserCreatedEvent, UserDeletedEvent

# Internal classes are not exported
# UserRepository, UserValidator, UserMapper are internal implementations

__all__ = ['UserService', 'User', 'UserProfile', 'UserCreatedEvent', 'UserDeletedEvent']


# --- Communication between modules: use only the public API ---

# order_module/service.py
class OrderService:
    def __init__(self, user_service: UserService):  # Depends only on the public API
        self.user_service = user_service

    def create_order(self, user_id: str, items: list) -> Order:
        # Uses only the UserModule's public API (does not access internal implementation)
        user = self.user_service.get_user(user_id)
        if not user:
            raise UserNotFoundError(user_id)
        return Order(user_id=user.id, items=items)


# --- Rules for inter-module communication ---
# 1. Do not directly import internal classes from other modules
# 2. Do not directly access another module's DB tables
# 3. Inter-module communication only via events or public APIs
# 4. Shared data is placed in the shared kernel
```

---

## 5. Practical Refactoring Procedure

### 5.1 Procedure for Splitting a Low-Cohesion Class

```
  God Class Splitting Process

  Step 1: Identify responsibilities
  ┌─────────────────────────────────────────────┐
  │  God Class (ApplicationManager)             │
  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
  │  │ Auth  │ │Payment│ │Notify│ │Invent│      │
  │  └──────┘ └──────┘ └──────┘ └──────┘      │
  └─────────────────────────────────────────────┘

  Step 2: Extract Class
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ AuthService│ │PayService │ │ NotifySvc │ │InventSvc │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘

  Step 3: Manage coupling with interfaces
  ┌──────────┐     ┌──────────────┐     ┌──────────┐
  │ AuthService│ ──→ │ <<interface>> │ ←── │PayService │
  └──────────┘     │  IPayment    │     └──────────┘
                    └──────────────┘
```

**Code Example 9: Refactoring a God Class**

```python
# === Before: God Class (low cohesion, high coupling) ===

class ApplicationManager:
    """A massive class with all functionality"""
    def __init__(self):
        self.db = Database()
        self.smtp = SmtpClient()
        self.cache = RedisCache()

    # Authentication
    def authenticate_user(self, username, password): ...
    def reset_password(self, email): ...
    def generate_token(self, user_id): ...
    def validate_token(self, token): ...

    # Order processing
    def create_order(self, user_id, items): ...
    def cancel_order(self, order_id): ...
    def calculate_shipping(self, order_id): ...

    # Notifications
    def send_email(self, to, subject, body): ...
    def send_sms(self, phone, message): ...
    def send_push_notification(self, device_id, message): ...

    # Inventory
    def check_inventory(self, product_id): ...
    def update_stock(self, product_id, quantity): ...
    def reorder_if_low(self, product_id): ...

    # Reporting
    def generate_sales_report(self, period): ...
    def generate_inventory_report(self): ...

    # → LCOM is close to 1.0 (each method group uses different fields)
    # → CBO is 20+ (massive external dependencies)
    # → 5+ reasons to change (auth, orders, notifications, inventory, reports)


# === After: Split by responsibility (high cohesion, low coupling) ===

class AuthService:
    """Responsible only for authentication (functional cohesion)"""
    def __init__(self, user_repo: UserRepository, token_provider: TokenProvider):
        self.user_repo = user_repo
        self.token_provider = token_provider

    def authenticate(self, username: str, password: str) -> AuthResult:
        user = self.user_repo.find_by_username(username)
        if user and user.verify_password(password):
            token = self.token_provider.generate(user.id)
            return AuthResult.success(token)
        return AuthResult.failure("Authentication failed")

    def validate_token(self, token: str) -> TokenClaims | None:
        return self.token_provider.validate(token)


class OrderService:
    """Responsible only for order processing (functional cohesion)"""
    def __init__(
        self,
        order_repo: OrderRepository,
        inventory: InventoryService,
        event_bus: EventBus
    ):
        self.order_repo = order_repo
        self.inventory = inventory
        self.event_bus = event_bus

    def create_order(self, user_id: str, items: list[OrderItem]) -> Order:
        for item in items:
            if not self.inventory.is_available(item.product_id, item.quantity):
                raise InsufficientStockError(item.product_id)

        order = Order(user_id=user_id, items=items)
        self.order_repo.save(order)
        self.event_bus.publish(OrderCreatedEvent(order_id=order.id))
        return order


class NotificationService:
    """Responsible only for notifications (functional cohesion)"""
    def __init__(self, channels: list[NotificationChannel]):
        self.channels = channels

    def send(self, recipient: str, message: str, channel_type: str) -> None:
        channel = self._find_channel(channel_type)
        channel.send(recipient, message)


class InventoryService:
    """Responsible only for inventory management (functional cohesion)"""
    def __init__(self, inventory_repo: InventoryRepository, event_bus: EventBus):
        self.repo = inventory_repo
        self.event_bus = event_bus

    def is_available(self, product_id: str, quantity: int) -> bool:
        stock = self.repo.get_stock(product_id)
        return stock >= quantity

    def reduce_stock(self, product_id: str, quantity: int) -> None:
        self.repo.decrease(product_id, quantity)
        current = self.repo.get_stock(product_id)
        if current < self.repo.get_reorder_threshold(product_id):
            self.event_bus.publish(LowStockEvent(product_id=product_id))
```

### 5.2 Procedure for Resolving High Coupling

```
  Flowchart for Resolving High Coupling

  Start
    │
    ▼
  Draw the dependency graph
    │
    ▼
  Are there circular dependencies? ─── Yes ──→ Extract a common interface
    │ No                                        or use event-driven architecture
    ▼
  Is `new` called directly? ─── Yes ──→ Introduce a DI container
    │ No
    ▼
  Depending on a concrete class? ─── Yes ──→ Extract an interface
    │ No
    ▼
  Directly depending on an external library? ─── Yes ──→ Adapter pattern
    │ No
    ▼
  Sharing global state? ─── Yes ──→ Change to argument passing
    │ No
    ▼
  Current coupling level is appropriate
```

---

## 6. Coupling and Cohesion in Microservices

### 6.1 Coupling Problems in Microservices

Adopting microservices does not automatically result in low coupling. The following table shows coupling problems specific to distributed systems.

| Type of Coupling | Description | Solution |
|-----------|------|--------|
| Shared database coupling | Multiple services reference the same DB table | Separate DB per service |
| Synchronous API coupling | Service A calls Service B's API synchronously | Switch to asynchronous messaging |
| Shared library coupling | A shared library upgrade requires redeployment of all services | Contract testing, independent versioning |
| Temporal coupling | Service B cannot function if Service A is unavailable | Circuit breaker, fallback |
| Deployment coupling | Services must be deployed together to work | Design for independent deployment |

**Code Example 10: Managing Coupling in Microservices**

```python
# === Bad: Synchronous inter-service call chain ===

class OrderApiHandler:
    """Order API - synchronously calls 3 services"""
    async def create_order(self, request):
        # 1. Query the user service (synchronous)
        user = await self.http_client.get(f"http://user-service/users/{request.user_id}")
        # → If user-service is down, orders cannot be placed

        # 2. Query the inventory service (synchronous)
        stock = await self.http_client.get(
            f"http://inventory-service/stock/{request.product_id}"
        )
        # → If inventory-service is down, orders cannot be placed

        # 3. Query the payment service (synchronous)
        payment = await self.http_client.post(
            "http://payment-service/charge",
            json={"amount": request.total}
        )
        # → If payment-service is down, orders cannot be placed

        # All 3 services must be available (temporal coupling)


# === Good: Async events and circuit breaker ===

class OrderApiHandler:
    """Order API - async event-driven"""
    def __init__(
        self,
        order_repo: OrderRepository,
        message_queue: MessageQueue,
        circuit_breaker: CircuitBreaker,
        user_cache: UserCache,
    ):
        self.order_repo = order_repo
        self.mq = message_queue
        self.cb = circuit_breaker
        self.user_cache = user_cache

    async def create_order(self, request) -> OrderResult:
        # Get user info from cache (works even if user-service is down)
        user = self.user_cache.get(request.user_id)
        if not user:
            user = await self.cb.call(
                lambda: self.http_client.get(f"http://user-service/users/{request.user_id}")
            )
            self.user_cache.set(request.user_id, user)

        # Save the order in 'PENDING' state (local DB only)
        order = Order(user_id=user.id, items=request.items, status='PENDING')
        self.order_repo.save(order)

        # Publish an async event (other services process it independently)
        await self.mq.publish('order.created', {
            'order_id': order.id,
            'items': [item.to_dict() for item in request.items],
            'total': request.total,
        })

        return OrderResult.pending(order.id)
        # → Even if other services are down, order acceptance itself is possible
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: God Module (The Epitome of Low Cohesion)

```python
# BAD: One module holds the functionality of the entire system
class ApplicationManager:
    def authenticate_user(self, ...): ...
    def process_payment(self, ...): ...
    def generate_invoice(self, ...): ...
    def send_notification(self, ...): ...
    def update_inventory(self, ...): ...
    def calculate_shipping(self, ...): ...
    def manage_cache(self, ...): ...
    # Knowledge of all domains is concentrated here
    # LCOM ≈ 1.0 (each method group uses different fields)
    # CBO ≥ 20 (massive external dependencies)

# GOOD: Split services by domain
class AuthService:
    """Authentication only"""
    def authenticate(self, username, password): ...
    def validate_token(self, token): ...

class PaymentService:
    """Payment only"""
    def charge(self, amount, payment_method): ...
    def refund(self, transaction_id): ...

class NotificationService:
    """Notifications only"""
    def send_email(self, to, template, data): ...
    def send_push(self, device_id, message): ...
```

### Anti-Pattern 2: Shotgun Surgery (Result of High Coupling)

```python
# BAD: One change ripples across many files
# Files that need to be modified when "changing the consumption tax rate from 8% to 10%":
#
# - cart.py (tax calculation)
# - invoice.py (tax amount on invoices)
# - receipt.py (tax amount on receipts)
# - report.py (tax display in reports)
# - api.py (tax amount in API responses)
# - frontend/cart.js (tax display on the frontend)
# → Evidence that the tax rate is not DRY
# → A single change ripples to 6 files = Shotgun Surgery

# GOOD: Consolidate tax calculation in one place
class TaxCalculator:
    """Single responsibility for tax calculation"""
    TAX_RATE = Decimal('0.10')  # Tax rate managed in one place

    @classmethod
    def calculate(cls, subtotal: Decimal) -> TaxResult:
        tax = subtotal * cls.TAX_RATE
        return TaxResult(subtotal=subtotal, tax=tax, total=subtotal + tax)

    @classmethod
    def get_display_rate(cls) -> str:
        return f"{cls.TAX_RATE * 100}%"

# All modules use TaxCalculator
# When the tax rate changes, only TaxCalculator.TAX_RATE needs to be updated
```

### Anti-Pattern 3: Hidden Coupling

```python
# BAD: Implicit execution order dependency
class DataProcessor:
    def __init__(self):
        self.data = None
        self.processed = None

    def load(self, path):
        self.data = read_file(path)

    def process(self):
        # Implicitly assumes load() was called first
        self.processed = transform(self.data)  # Error if data is None

    def save(self, path):
        # Implicitly assumes process() was called first
        write_file(path, self.processed)  # Error if processed is None

# The caller must know the correct order (temporal coupling)
processor = DataProcessor()
processor.load("input.csv")
processor.process()
processor.save("output.csv")

# GOOD: Guarantee order with method chaining or a single method
class DataProcessor:
    @staticmethod
    def process_file(input_path: str, output_path: str) -> None:
        """Executes all steps of file processing in a single method"""
        data = read_file(input_path)
        processed = transform(data)
        write_file(output_path, processed)

# Or a pipeline of immutable objects
class DataProcessor:
    @staticmethod
    def load(path: str) -> RawData:
        return RawData(read_file(path))

    @staticmethod
    def process(data: RawData) -> ProcessedData:
        return ProcessedData(transform(data.content))

    @staticmethod
    def save(data: ProcessedData, path: str) -> None:
        write_file(path, data.content)

# The type system enforces the order
raw = DataProcessor.load("input.csv")
processed = DataProcessor.process(raw)
DataProcessor.save(processed, "output.csv")
```

---

## 8. Exercises

### Exercise 1 (Basic): Identifying Coupling and Cohesion

Evaluate the coupling and cohesion of the following code and identify the problems.

```python
# Code to evaluate
config = {"db_host": "localhost", "db_port": 5432, "api_key": "secret"}

class AppService:
    def get_user(self, user_id):
        host = config["db_host"]  # Depends on a global variable
        conn = connect(host, config["db_port"])
        return conn.query(f"SELECT * FROM users WHERE id = {user_id}")

    def send_report(self, email):
        import smtplib
        server = smtplib.SMTP("smtp.example.com")
        server.sendmail("noreply@example.com", email, "Report attached")

    def resize_image(self, image_path, width, height):
        from PIL import Image
        img = Image.open(image_path)
        return img.resize((width, height))
```

**Expected Answer:**

```
Coupling Evaluation:
- Common Coupling: Depends on the global variable `config` (Bad)
- Near Content Coupling: Constructs SQL directly (depends on DB structure)
- External Coupling: Hardcodes the SMTP server address

Cohesion Evaluation:
- Coincidental Cohesion: DB operations, email sending, and image processing are mixed in one class
- LCOM ≈ 1.0 (each method uses different resources)

Improvement Plan:
1. UserRepository (dedicated to DB operations)
2. EmailService (dedicated to email sending)
3. ImageProcessor (dedicated to image processing)
4. Inject dependencies into each class via DI
5. The global variable `config` should be injected as a configuration class
```

### Exercise 2 (Applied): Improving Coupling with the Facade Pattern

Refactor the following tightly coupled code using the Facade pattern.

```typescript
class CheckoutPage {
  async checkout(cartId: string) {
    const cart = await fetch(`/api/carts/${cartId}`).then(r => r.json());
    const user = await fetch(`/api/users/${cart.userId}`).then(r => r.json());
    const inventory = await fetch('/api/inventory/check', {
      method: 'POST', body: JSON.stringify(cart.items)
    }).then(r => r.json());

    if (!inventory.available) throw new Error('Out of stock');

    const tax = cart.subtotal * 0.1;
    const shipping = cart.items.length > 3 ? 0 : 500;
    const total = cart.subtotal + tax + shipping;

    const payment = await fetch('/api/payments/charge', {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, amount: total, card: user.defaultCard })
    }).then(r => r.json());

    await fetch('/api/notifications/email', {
      method: 'POST',
      body: JSON.stringify({ to: user.email, template: 'order-confirm', data: { total } })
    });

    return { orderId: payment.orderId, total };
  }
}
```

**Expected Answer:**

```typescript
// CheckoutFacade: hides internal complexity
class CheckoutFacade {
  constructor(
    private cartService: CartService,
    private userService: UserService,
    private inventoryService: InventoryService,
    private pricingService: PricingService,
    private paymentService: PaymentService,
    private notificationService: NotificationService
  ) {}

  async checkout(cartId: string): Promise<CheckoutResult> {
    const cart = await this.cartService.getCart(cartId);
    const user = await this.userService.getUser(cart.userId);

    await this.inventoryService.ensureAvailable(cart.items);

    const pricing = this.pricingService.calculate(cart);
    const payment = await this.paymentService.charge(user, pricing.total);

    // Non-critical: order is considered successful even if notification fails
    await this.notificationService
      .sendOrderConfirmation(user.email, pricing)
      .catch(err => console.warn('Notification failed', err));

    return { orderId: payment.orderId, total: pricing.total };
  }
}

// CheckoutPage depends only on the Facade
class CheckoutPage {
  constructor(private checkout: CheckoutFacade) {}

  async checkout(cartId: string) {
    return this.checkout.checkout(cartId);
  }
}
```

### Exercise 3 (Advanced): Calculating LCOM and Improving Cohesion

Calculate the LCOM (Henderson-Sellers version) for the following class, and refactor it to improve cohesion.

```python
class ReportManager:
    def __init__(self):
        self.sales_data = []
        self.employee_data = []
        self.inventory_data = []

    def add_sale(self, sale):
        self.sales_data.append(sale)

    def get_total_sales(self):
        return sum(s.amount for s in self.sales_data)

    def get_top_seller(self):
        return max(self.sales_data, key=lambda s: s.amount)

    def add_employee(self, employee):
        self.employee_data.append(employee)

    def get_average_salary(self):
        return sum(e.salary for e in self.employee_data) / len(self.employee_data)

    def add_inventory_item(self, item):
        self.inventory_data.append(item)

    def get_low_stock_items(self):
        return [i for i in self.inventory_data if i.quantity < 10]

    def get_inventory_value(self):
        return sum(i.price * i.quantity for i in self.inventory_data)
```

**Expected Answer:**

```
LCOM* Calculation:
- Number of methods (m) = 8
- Number of fields (f) = 3
- sales_data: add_sale, get_total_sales, get_top_seller → 3 methods
- employee_data: add_employee, get_average_salary → 2 methods
- inventory_data: add_inventory_item, get_low_stock_items, get_inventory_value → 3 methods

LCOM* = (8 - (1/3) * (3+2+3)) / (8-1)
       = (8 - 2.67) / 7
       = 5.33 / 7
       = 0.76

LCOM* = 0.76 → Low cohesion (close to 1.0)

Improvement: Split into 3 classes
```

```python
class SalesReport:
    """Sales report (functional cohesion)"""
    def __init__(self):
        self.sales_data: list[Sale] = []

    def add_sale(self, sale: Sale) -> None:
        self.sales_data.append(sale)

    def get_total(self) -> float:
        return sum(s.amount for s in self.sales_data)

    def get_top_seller(self) -> Sale:
        return max(self.sales_data, key=lambda s: s.amount)
    # LCOM* = (3 - (1/1) * 3) / (3-1) = 0 / 2 = 0 ★Perfectly cohesive

class EmployeeReport:
    """Employee report (functional cohesion)"""
    def __init__(self):
        self.employee_data: list[Employee] = []

    def add_employee(self, employee: Employee) -> None:
        self.employee_data.append(employee)

    def get_average_salary(self) -> float:
        if not self.employee_data:
            return 0.0
        return sum(e.salary for e in self.employee_data) / len(self.employee_data)
    # LCOM* = (2 - (1/1) * 2) / (2-1) = 0 / 1 = 0 ★Perfectly cohesive

class InventoryReport:
    """Inventory report (functional cohesion)"""
    def __init__(self):
        self.inventory_data: list[InventoryItem] = []

    def add_item(self, item: InventoryItem) -> None:
        self.inventory_data.append(item)

    def get_low_stock_items(self, threshold: int = 10) -> list[InventoryItem]:
        return [i for i in self.inventory_data if i.quantity < threshold]

    def get_total_value(self) -> float:
        return sum(i.price * i.quantity for i in self.inventory_data)
    # LCOM* = (3 - (1/1) * 3) / (3-1) = 0 / 2 = 0 ★Perfectly cohesive
```

---

## 9. FAQ

### Q1: Should we aim for zero coupling?

Zero coupling is impossible and should not be the goal. A system cannot function without communication between modules. The goal is **the minimum necessary, explicit coupling**. The key is to eliminate implicit dependencies (global variables, hidden side effects) and replace them with dependencies through explicit interfaces.

The ideal is "dependency on stable abstractions," specifically aiming for the following:
- Depend on interfaces rather than concrete classes
- Depend on minimal interfaces rather than broad public APIs
- Communicate via asynchronous events rather than synchronous calls (where appropriate)

### Q2: Does adopting microservices automatically result in low coupling?

No. Coupling between services exists in distributed systems too. Shared databases, chains of synchronous API calls, and coupling through shared libraries can be even more difficult to manage than in a monolith (this is called a "distributed monolith").

To benefit from microservices, the following are essential:
- Each service has its own data store
- Inter-service communication uses asynchronous messaging
- Contract Testing ensures API compatibility
- Circuit breakers prevent failure propagation

### Q3: Should utility classes be avoided because they have low cohesion?

"Catch-all Utils" should be avoided, but **utilities with a clear theme** (e.g., `StringUtils`, `DateUtils`) represent logical cohesion and are practically acceptable. However, regularly verify that domain logic is not leaking into utilities.

Decision criteria:
- `Utils` / `Helper` / `Manager` are red flags in names
- `StringFormatter`, `DateParser`, `PathNormalizer` are within acceptable range
- If a method in a utility requires knowledge specific to a domain, it should be moved to that domain class

### Q4: Should we also care about coupling and cohesion in test code?

Test code has different criteria than production code. If tests follow the "3A (Arrange-Act-Assert)" pattern and each test verifies one behavior (functional cohesion), the cohesion of the test itself is not a problem.

However, avoid test helpers and fixtures becoming god classes. Test utilities should also be split appropriately.

### Q5: What should the LCOM threshold be?

General guidelines:
- LCOM* = 0.0 ~ 0.3: High cohesion (no problem)
- LCOM* = 0.3 ~ 0.6: Needs attention (consider splitting)
- LCOM* = 0.6 ~ 1.0: Low cohesion (splitting recommended)

However, LCOM is just one indicator. If a class's responsibility is clear and it has only one reason to change, a high number may not be a problem. Make a holistic judgment combining the metric with design intent.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in everyday development work. It is especially important during code reviews and architecture design.

---

## Summary

| Metric | Goal | How to Achieve | How to Measure | Threshold |
|------|------|---------|---------|---------|
| Coupling | Keep low | DI, interfaces, events, Adapter | CBO, Ca/Ce, Instability | CBO ≤ 10 |
| Cohesion | Keep high | SRP, Extract Class | LCOM (cohesion metric) | LCOM* ≤ 0.3 |
| Balance | Low coupling + High cohesion | Domain-Driven Design | Analysis of change impact scope | -- |
| Packages | Domain-based | Functionally cohesive package structure | Changes are contained within one package | -- |

| Improvement Signal | Problem to Suspect | How to Check |
|------------|------------|---------|
| Many files modified for one change | Shotgun Surgery (high coupling) | Change history analysis |
| Class exceeds 500 lines | God Class (low cohesion) | Line count |
| 10+ mocks in tests | High coupling | Test code review |
| Bloated `Utils` / `Helper` | Low cohesion | Class name check |
| Circular dependencies | Architecture-level problem | Dependency graph analysis |

---

## Guides to Read Next

- [Law of Demeter](./04-law-of-demeter.md) — A specific rule for reducing coupling
- [SOLID Principles](./01-solid.md) — Especially SRP and DIP, which directly relate to coupling and cohesion
- [Composition vs Inheritance](../03-practices-advanced/01-composition-over-inheritance.md) — Design decisions that affect coupling
- [Code Smells](../02-refactoring/00-code-smells.md) — Details on God Class and Shotgun Surgery
- Refactoring Techniques — Steps for Extract Class and Move Method

---

## References

1. **Larry Constantine, Edward Yourdon** *Structured Design: Fundamentals of a Discipline of Computer Program and Systems Design*, Yourdon Press, 1979 — The original source on coupling and cohesion
2. **Glenford J. Myers** *Composite/Structured Design*, Van Nostrand Reinhold, 1978 — A classic on structured design
3. **Robert C. Martin** *Clean Architecture: A Craftsman's Guide to Software Structure and Design*, Prentice Hall, 2017 — Stable Dependencies Principle (SDP), Stable Abstractions Principle (SAP)
4. **Eric Evans** *Domain-Driven Design: Tackling Complexity in the Heart of Software*, Addison-Wesley, 2003 — Bounded Context and module design
5. **Sam Newman** *Building Microservices: Designing Fine-Grained Systems*, O'Reilly Media, 2021 (2nd Edition) — Coupling management in microservices
6. **Brian Henderson-Sellers** *Software Metrics*, Prentice Hall, 1996 — Definition of the LCOM* metric
7. **J.M. Bieman, B.K. Kang** "Cohesion and Reuse in an Object-Oriented System" *Proceedings of the 1995 Symposium on Software Reusability*, 1995 — Empirical study on cohesion and reusability
8. **Martin Fowler** *Refactoring: Improving the Design of Existing Code*, Addison-Wesley, 2018 — Refactoring of Feature Envy, Shotgun Surgery, and God Class
