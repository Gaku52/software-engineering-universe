# Code Smells — Long Method, God Class, and Other Warning Signs

> A code smell is a surface-level symptom that signals "something is off" in the code. It is not a bug, but it suggests an underlying design problem. The ability to quickly detect smells and connect them to appropriate refactoring is essential for maintaining software quality. In the second edition of *Refactoring*, Martin Fowler described smells as "a thermometer of design quality," and Kent Beck advised developers to "listen to the signals smells send — they're saying *look here*." This chapter uses Fowler's five-category taxonomy as a starting point, systematically covering 22 or more smells, and dives deep into automated detection tools, review techniques, and incremental refactoring strategies.

---

## Prerequisites

| Prerequisite | Reference |
|------|--------|
| Fundamentals of clean code principles | [00-principles/](../00-principles/) |
| Naming and function design | 01-practices/01-naming.md, 01-practices/02-functions.md |
| Basics of testing | [01-practices/04-testing-principles.md](../01-practices/04-testing-principles.md) |
| Basics of object-oriented programming (classes, inheritance, polymorphism) | — |

---

## What You Will Learn in This Chapter

1. **The five categories of major code smells** — Understand 22+ smells based on Martin Fowler's taxonomy
2. **Smell severity and impact matrix** — Learn how to quantitatively assess the seriousness of a smell
3. **Automated and manual smell detection** — Master detection techniques combining tools with code review
4. **Refactoring responses for each smell** — Learn the mapping from each smell to the appropriate refactoring technique
5. **Designing a detection workflow** — Build an organizational detection system that integrates CI/CD, review, and static analysis

---

## 1. What Is a Code Smell?

### 1.1 Definition and History

The term "code smell" was coined by Kent Beck in conversation with Martin Fowler, and became widely known through the first edition of *Refactoring: Improving the Design of Existing Code* in 1999.

```
The Essence of Smells

  +-----------------------------------------------------------------+
  |  Code smell ≠ bug                                               |
  |  Code smell ≠ coding style violation                            |
  |  Code smell  = a heuristic signal suggesting that               |
  |               "a design problem may be lurking here"            |
  +-----------------------------------------------------------------+

  Smells have the following characteristics:
  1. Subjective — may be acceptable depending on context
  2. Cumulative — minor individually, but can become critical in combination
  3. Detectable — most can be found with tools or review
  4. Actionable — each smell has a corresponding refactoring technique
```

### 1.2 The "Odor Intensity" of a Smell

Not all smells carry the same severity. Robert C. Martin introduced the concept of "odor intensity" in *Clean Code* as a guideline for judging the urgency of a fix.

```
  Odor Intensity Levels

  Level 5 (Putrid) — Fix immediately
    Example: Circular dependencies, God Class with no tests
    → Left unaddressed, can cause development-halting failures

  Level 4 (Foul)   — Fix in the next sprint
    Example: Shotgun Surgery, pervasive Feature Envy
    → Every change incurs unnecessary effort

  Level 3 (Off)    — Fix with a plan
    Example: Long Method, Primitive Obsession
    → Readability and maintainability degrade gradually

  Level 2 (Faint)  — Fix when noticed
    Example: Excessive comments, unused parameters
    → Address with the Boy Scout Rule

  Level 1 (None)   — Acceptable
    Example: Complexity that is unavoidable given context
    → Record the intent in documentation and leave it
```

---

## 2. The Five-Category Taxonomy of Code Smells

Martin Fowler organized smells into five categories in *Refactoring*. Each category contains multiple smells, and each smell has a corresponding refactoring technique.

```
+-------------------------------------------------------------------+
|  Five Categories of Code Smells (Martin Fowler, 2nd Edition 2018) |
+-------------------------------------------------------------------+
| 1. Bloaters                                                       |
|    Long Method, Large Class, Long Parameter List,                 |
|    Data Clumps, Primitive Obsession                               |
+-------------------------------------------------------------------+
| 2. Object-Orientation Abusers                                     |
|    Switch Statements, Refused Bequest,                            |
|    Parallel Inheritance Hierarchy, Alternative Classes with       |
|    Different Interfaces, Temporary Field                          |
+-------------------------------------------------------------------+
| 3. Change Preventers                                              |
|    Divergent Change, Shotgun Surgery,                             |
|    Parallel Inheritance Hierarchy                                 |
+-------------------------------------------------------------------+
| 4. Dispensables                                                   |
|    Dead Code, Speculative Generality, Lazy Class,                 |
|    Data Class, Duplicate Code, Comments (excessive)               |
+-------------------------------------------------------------------+
| 5. Couplers                                                       |
|    Feature Envy, Inappropriate Intimacy, Message Chains,          |
|    Middle Man, Incomplete Library Class                            |
+-------------------------------------------------------------------+
```

### 2.1 Smell Relationship Diagram — Causal Relationships Between Smells

Smells do not exist in isolation; they are often interrelated and arise in chains.

```
  Causal Relationship Map Between Smells

  [Long Method] ──causes──> [Duplicated Code]
       |                              |
       v                              v
  [Feature Envy] ──causes──> [Shotgun Surgery]
       |                              |
       v                              v
  [God Class] ──causes──> [Divergent Change]
       |
       v
  [Inappropriate Intimacy]
       |
       v
  [Message Chains]

  Typical chain patterns:
  1. Long Method → Duplicate Code → Shotgun Surgery
  2. God Class → Divergent Change → Feature Envy
  3. Primitive Obsession → Data Clumps → Long Parameter List
```

---

## 3. Bloater Smells in Detail

### 3.1 Long Method

**Definition**: A method has too many lines and does not fit on a single screen. A common threshold is 20–30 lines or more.

**Detection indicators**:
- Line count: Warning at 20+, danger at 50+
- Cyclomatic complexity: 10 or higher
- Nesting depth: 3 or more levels
- Blocks separated by comments

**Code Example 1: Detecting and Improving a Long Method (Python)**

```python
# NG: Multiple responsibilities mixed into a single method (50+ lines)
class OrderProcessor:
    def process_order(self, order_data: dict) -> OrderResult:
        # ── Validation ──
        if not order_data.get('items'):
            raise ValidationError("No items selected")
        if not order_data.get('customer_id'):
            raise ValidationError("Customer information is missing")
        for item in order_data['items']:
            if item['quantity'] <= 0:
                raise ValidationError(f"Invalid quantity: {item['name']}")
            product = self.db.query(
                "SELECT stock FROM products WHERE id = %s", item['id']
            )
            if product.stock < item['quantity']:
                raise ValidationError(f"Insufficient stock: {item['name']}")

        # ── Total Calculation ──
        subtotal = 0
        for item in order_data['items']:
            price = item['unit_price'] * item['quantity']
            if item.get('discount_code'):
                discount = self.db.query(
                    "SELECT rate FROM discounts WHERE code = %s",
                    item['discount_code']
                )
                price *= (1 - discount.rate)
            subtotal += price
        tax = subtotal * Decimal("0.10")
        shipping = Decimal("500") if subtotal < Decimal("5000") else Decimal("0")
        total = subtotal + tax + shipping

        # ── Save to DB ──
        order = Order(
            customer_id=order_data['customer_id'],
            items=order_data['items'],
            subtotal=subtotal, tax=tax, shipping=shipping, total=total
        )
        self.db.save(order)

        # ── Send Email ──
        customer = self.db.query(
            "SELECT * FROM customers WHERE id = %s",
            order_data['customer_id']
        )
        self.email_service.send(
            to=customer.email,
            subject="Thank you for your order",
            body=self._render_confirmation(order)
        )

        # ── Analytics Tracking ──
        self.analytics.track('order_completed', {
            'order_id': order.id,
            'total': float(total),
            'item_count': len(order_data['items'])
        })

        return OrderResult.success(order)


# OK: Separate functions by intent — each method is 5–10 lines
class OrderProcessor:
    def process_order(self, order_data: dict) -> OrderResult:
        """Orchestrates the order processing flow"""
        self._validate_order(order_data)
        pricing = self._calculate_pricing(order_data['items'])
        order = self._save_order(order_data, pricing)
        self._send_confirmation(order)
        self._track_analytics(order)
        return OrderResult.success(order)

    def _validate_order(self, order_data: dict) -> None:
        """Validates order data"""
        validator = OrderValidator(self.db)
        validator.validate(order_data)

    def _calculate_pricing(self, items: list[dict]) -> OrderPricing:
        """Calculates pricing"""
        calculator = PricingCalculator(self.db)
        return calculator.calculate(items)

    def _save_order(self, data: dict, pricing: OrderPricing) -> Order:
        """Saves the order to the database"""
        order = Order.from_data(data, pricing)
        self.db.save(order)
        return order

    def _send_confirmation(self, order: Order) -> None:
        """Sends a confirmation email"""
        customer = self.db.find_customer(order.customer_id)
        self.email_service.send_order_confirmation(customer, order)

    def _track_analytics(self, order: Order) -> None:
        """Tracks analytics"""
        self.analytics.track('order_completed', order.to_analytics_dict())
```

### 3.2 God Class (Large Class)

**Definition**: A class that has far too many responsibilities. Violates the Single Responsibility Principle (SRP).

**Detection indicators**:
- Number of methods: 20 or more
- Number of fields: 15 or more
- Line count: 500 or more
- Number of dependent classes: 10 or more

```
  God Class Symptoms and Decomposition

  ┌────────────────────────────────────────────┐
  │  ApplicationManager                        │
  │  ────────────────────────────              │
  │  - userRepository                          │
  │  - orderRepository                         │
  │  - paymentGateway                          │
  │  - emailService                            │
  │  - cacheManager                            │
  │  - logger                                  │
  │  - configService                           │
  │  - analyticsTracker                        │
  │  ────────────────────────────              │
  │  + authenticateUser()                      │
  │  + createOrder()                           │
  │  + processPayment()                        │
  │  + sendEmail()                             │
  │  + clearCache()                            │
  │  + generateReport()                        │
  │  + validateConfig()                        │
  │  + trackEvent()                            │
  │  + ... (50+ methods)                       │
  └────────────────────────────────────────────┘
         ↓ Separate by responsibility using Extract Class ↓
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ AuthSvc   │  │ OrderSvc  │  │ PaymentSvc│  │ EmailSvc  │
  │ ────────  │  │ ────────  │  │ ────────  │  │ ────────  │
  │ login()   │  │ create()  │  │ charge()  │  │ send()    │
  │ logout()  │  │ cancel()  │  │ refund()  │  │ template()│
  │ verify()  │  │ update()  │  │ verify()  │  │ queue()   │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

**Code Example 2: Incrementally Decomposing a God Class (Java)**

```java
// NG: God Class — multiple responsibilities concentrated in one class
public class ApplicationManager {
    private UserRepository userRepo;
    private OrderRepository orderRepo;
    private PaymentGateway paymentGw;
    private EmailService emailSvc;

    // Authentication responsibility
    public User authenticateUser(String email, String password) {
        User user = userRepo.findByEmail(email);
        if (user == null) throw new AuthException("User not found");
        if (!BCrypt.checkpw(password, user.getPasswordHash())) {
            throw new AuthException("Password does not match");
        }
        user.setLastLogin(Instant.now());
        userRepo.save(user);
        return user;
    }

    // Order responsibility
    public Order createOrder(User user, List<OrderItem> items) {
        Order order = new Order(user, items);
        order.setTotal(items.stream()
            .mapToDouble(i -> i.getPrice() * i.getQuantity())
            .sum());
        orderRepo.save(order);
        return order;
    }

    // Payment responsibility
    public PaymentResult processPayment(Order order, CreditCard card) {
        return paymentGw.charge(card, order.getTotal());
    }

    // Email responsibility
    public void sendConfirmation(Order order) {
        emailSvc.send(order.getUser().getEmail(), "Order Confirmation", "...");
    }
    // ... dozens more methods follow
}


// OK: Separate classes by responsibility
public class AuthenticationService {
    private final UserRepository userRepo;
    private final PasswordEncoder encoder;

    public AuthenticationService(UserRepository userRepo, PasswordEncoder encoder) {
        this.userRepo = userRepo;
        this.encoder = encoder;
    }

    public User authenticate(String email, String password) {
        User user = userRepo.findByEmail(email)
            .orElseThrow(() -> new AuthException("User not found"));
        if (!encoder.matches(password, user.getPasswordHash())) {
            throw new AuthException("Password does not match");
        }
        user.recordLogin();
        userRepo.save(user);
        return user;
    }
}

public class OrderService {
    private final OrderRepository orderRepo;
    private final PricingCalculator calculator;

    public Order create(User user, List<OrderItem> items) {
        Order order = Order.create(user, items, calculator);
        orderRepo.save(order);
        return order;
    }
}
```

### 3.3 Long Parameter List

**Definition**: A method has too many parameters. Generally, four or more is a warning sign.

**Code Example 3: Improving a Long Parameter List (TypeScript)**

```typescript
// NG: 8 parameters — easy to mix up their order
function createUser(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  street: string,
  city: string,
  zipCode: string,
  country: string
): User {
  // ...
}

// Caller side: hard to tell which parameter is which
createUser("Taro", "Yamada", "taro@example.com", "090-1234-5678",
           "Marunouchi 1-1-1", "Chiyoda-ku", "100-0001", "Japan");


// OK: Consolidate into parameter objects
interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface Address {
  street: string;
  city: string;
  zipCode: string;
  country: string;

  // Address owns its own validation
  validate(): ValidationResult;
  format(): string;
}

interface CreateUserRequest {
  personal: PersonalInfo;
  address: Address;
}

function createUser(request: CreateUserRequest): User {
  request.address.validate();
  return new User(request);
}

// Caller side: structure is clear
createUser({
  personal: { firstName: "Taro", lastName: "Yamada",
              email: "taro@example.com", phone: "090-1234-5678" },
  address:  { street: "Marunouchi 1-1-1", city: "Chiyoda-ku",
              zipCode: "100-0001", country: "Japan",
              validate() { /* ... */ }, format() { /* ... */ } },
});
```

### 3.4 Data Clumps

**Definition**: The same combination of parameters appears repeatedly in multiple places.

**Code Example 4: Extracting Data Clumps (Python)**

```python
# NG: The same group of parameters appears repeatedly
def create_user(first_name, last_name, street, city, zip_code, country): ...
def update_address(user_id, street, city, zip_code, country): ...
def validate_address(street, city, zip_code, country): ...
def format_address(street, city, zip_code, country): ...
def calculate_shipping(street, city, zip_code, country, weight): ...

# Tests: too many parameter combinations to test easily


# OK: Extract into a data class
@dataclass(frozen=True)
class Address:
    """Address value object — immutable with validation"""
    street: str
    city: str
    zip_code: str
    country: str

    def __post_init__(self):
        if not self.zip_code:
            raise ValueError("Zip code is required")
        if not self.country:
            raise ValueError("Country name is required")

    def validate(self) -> bool:
        """Validates the address"""
        return bool(self.street and self.city and
                    self.zip_code and self.country)

    def format(self, style: str = "standard") -> str:
        """Formats the address"""
        if style == "japanese":
            return f"〒{self.zip_code} {self.city}{self.street}"
        return f"{self.street}, {self.city} {self.zip_code}, {self.country}"

    def is_domestic(self) -> bool:
        return self.country == "Japan"


def create_user(first_name: str, last_name: str, address: Address): ...
def update_address(user_id: str, address: Address): ...
def calculate_shipping(address: Address, weight: float) -> Decimal: ...

# Tests: create one Address and reuse it across all functions
```

### 3.5 Primitive Obsession

**Definition**: Domain concepts are expressed using primitive types such as `str`, `int`, or `float`, losing type safety.

**Code Example 5: Improving Primitive Obsession (TypeScript)**

```typescript
// NG: Domain concepts expressed with primitive types
function processPayment(
  amount: number,       // Yen? Dollars? Negative?
  currency: string,     // "JPY"? "jpy"? "Yen"?
  email: string,        // Already validated?
  cardNumber: string    // Masked? Expiry date?
): boolean { /* ... */ }

// Caller side: negative amounts or invalid emails can be passed
processPayment(-1000, "yen", "not-an-email", "1234");


// OK: Use value objects to ensure type safety
class Money {
  readonly amount: number;
  readonly currency: Currency;

  constructor(amount: number, currency: Currency) {
    if (amount < 0) throw new Error("Amount must be 0 or greater");
    if (!Number.isFinite(amount)) throw new Error("Amount must be a finite number");
    this.amount = amount;
    this.currency = currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.amount * factor), this.currency);
  }

  format(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: this.currency
    }).format(this.amount);
  }
}

class Email {
  private static readonly PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  readonly value: string;

  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!Email.PATTERN.test(normalized)) {
      throw new InvalidEmailError(value);
    }
    this.value = normalized;
  }
}

class CreditCard {
  readonly maskedNumber: string;
  readonly last4: string;

  constructor(number: string, expiry: Date) {
    if (!CreditCard.isValidLuhn(number)) {
      throw new InvalidCardError("Invalid card number");
    }
    if (expiry < new Date()) {
      throw new ExpiredCardError("Card has expired");
    }
    this.last4 = number.slice(-4);
    this.maskedNumber = `****-****-****-${this.last4}`;
  }

  private static isValidLuhn(number: string): boolean {
    // Validation using the Luhn algorithm
    let sum = 0;
    let isEven = false;
    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number[i], 10);
      if (isEven) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  }
}

// Type-safe function signature
function processPayment(
  amount: Money,
  email: Email,
  card: CreditCard
): PaymentResult { /* ... */ }
```

---

## 4. Object-Orientation Abuser Smells in Detail

### 4.1 Switch Statements (Proliferating Conditionals)

**Definition**: Conditional branches based on type or state are scattered across multiple places. Every time a new type or state is added, all branches must be updated (violates the Open-Closed Principle).

**Code Example 6: Improving Switch Statements (Python)**

```python
# NG: Type-based branching scattered across multiple locations
# Every time a new Shape is added, all functions must be modified
def calculate_area(shape):
    if shape.type == 'circle':
        return math.pi * shape.radius ** 2
    elif shape.type == 'rectangle':
        return shape.width * shape.height
    elif shape.type == 'triangle':
        return shape.base * shape.height / 2
    else:
        raise ValueError(f"Unknown shape: {shape.type}")

def calculate_perimeter(shape):
    if shape.type == 'circle':
        return 2 * math.pi * shape.radius
    elif shape.type == 'rectangle':
        return 2 * (shape.width + shape.height)
    elif shape.type == 'triangle':
        return shape.side_a + shape.side_b + shape.side_c
    else:
        raise ValueError(f"Unknown shape: {shape.type}")

def draw(shape, canvas):
    if shape.type == 'circle':
        canvas.draw_circle(shape.center, shape.radius)
    elif shape.type == 'rectangle':
        canvas.draw_rect(shape.origin, shape.width, shape.height)
    elif shape.type == 'triangle':
        canvas.draw_polygon(shape.vertices)


# OK: Replace with polymorphism — adding a new shape only requires a new class
from abc import ABC, abstractmethod
import math

class Shape(ABC):
    """Base class for shapes"""

    @abstractmethod
    def area(self) -> float:
        """Calculate area"""

    @abstractmethod
    def perimeter(self) -> float:
        """Calculate perimeter"""

    @abstractmethod
    def draw(self, canvas: Canvas) -> None:
        """Draw on canvas"""

class Circle(Shape):
    def __init__(self, center: Point, radius: float):
        if radius <= 0:
            raise ValueError("Radius must be a positive number")
        self.center = center
        self.radius = radius

    def area(self) -> float:
        return math.pi * self.radius ** 2

    def perimeter(self) -> float:
        return 2 * math.pi * self.radius

    def draw(self, canvas: Canvas) -> None:
        canvas.draw_circle(self.center, self.radius)

class Rectangle(Shape):
    def __init__(self, origin: Point, width: float, height: float):
        self.origin = origin
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height

    def perimeter(self) -> float:
        return 2 * (self.width + self.height)

    def draw(self, canvas: Canvas) -> None:
        canvas.draw_rect(self.origin, self.width, self.height)

# Adding a new shape: no modification to existing code needed
class Pentagon(Shape):
    def __init__(self, center: Point, side_length: float):
        self.center = center
        self.side_length = side_length

    def area(self) -> float:
        return (math.sqrt(5 * (5 + 2 * math.sqrt(5))) / 4) * self.side_length ** 2

    def perimeter(self) -> float:
        return 5 * self.side_length

    def draw(self, canvas: Canvas) -> None:
        canvas.draw_polygon(self._calculate_vertices())
```

### 4.2 Refused Bequest

**Definition**: A subclass does not use most of the methods or properties of its parent class.

```python
# NG: Stack does not use (and should not expose) most of list's methods
class Stack(list):
    """Stack — but insert, sort, and reverse from list are accessible"""
    def push(self, item):
        self.append(item)

    def peek(self):
        return self[-1] if self else None

# stack.insert(0, "cut in line")  ← breaks the stack's invariant!
# stack.sort()                     ← meaningless operation is possible


# OK: Use delegation (composition) to expose only the needed interface
class Stack:
    """Stack — exposes only LIFO operations"""
    def __init__(self):
        self._items: list = []

    def push(self, item) -> None:
        self._items.append(item)

    def pop(self):
        if not self._items:
            raise EmptyStackError("Stack is empty")
        return self._items.pop()

    def peek(self):
        if not self._items:
            raise EmptyStackError("Stack is empty")
        return self._items[-1]

    def is_empty(self) -> bool:
        return len(self._items) == 0

    def __len__(self) -> int:
        return len(self._items)
```

### 4.3 Temporary Field

**Definition**: A field exists in a class that is only used by a specific method.

```java
// NG: totalSales and averagePrice are only used in generateReport()
public class SalesAnalyzer {
    private List<Sale> sales;
    private double totalSales;     // ← temporary field
    private double averagePrice;   // ← temporary field

    public Report generateReport() {
        this.totalSales = sales.stream().mapToDouble(Sale::getAmount).sum();
        this.averagePrice = this.totalSales / sales.size();
        return new Report(this.totalSales, this.averagePrice);
    }
}


// OK: Move to method-local variables or a data class
public class SalesAnalyzer {
    private final List<Sale> sales;

    public Report generateReport() {
        SalesStatistics stats = calculateStatistics();
        return new Report(stats);
    }

    private SalesStatistics calculateStatistics() {
        double total = sales.stream().mapToDouble(Sale::getAmount).sum();
        double average = total / sales.size();
        return new SalesStatistics(total, average);
    }
}

record SalesStatistics(double totalSales, double averagePrice) {}
```

---

## 5. Change Preventer Smells in Detail

### 5.1 Divergent Change

**Definition**: A single class is frequently modified for different reasons.

```
  Divergent Change Symptoms

  [UserService] is modified for all of the following changes:
  ├── When changing authentication method   → modify authenticate()
  ├── When changing order logic             → modify processOrder()
  ├── When changing email delivery          → modify sendNotification()
  └── When changing report format           → modify generateReport()

  Fix: Separate responsibilities with Extract Class
  [AuthService]         ← only changes for authentication method
  [OrderService]        ← only changes for order logic
  [NotificationService] ← only changes for email delivery
  [ReportService]       ← only changes for report format
```

### 5.2 Shotgun Surgery

**Definition**: A single change requires modifying many classes. The inverse of Divergent Change.

**Code Example 7: Detecting and Improving Shotgun Surgery (Python)**

```python
# NG: Changing the "tax rate" requires modifying 6 files
# order_service.py
class OrderService:
    def calculate_total(self, order):
        return order.subtotal * 1.10  # ← hardcoded tax rate

# invoice_service.py
class InvoiceService:
    def generate(self, order):
        tax = order.subtotal * 0.10   # ← same tax rate
        return f"Tax: {tax}"

# report_service.py
class ReportService:
    def monthly_tax(self, orders):
        return sum(o.subtotal * 0.10 for o in orders)  # ← again the same

# receipt_printer.py, api_controller.py, test_helper.py ... all need to be modified


# OK: Consolidate tax calculation in one place
class TaxCalculator:
    """Single Source of Truth for tax calculations"""
    STANDARD_RATE = Decimal("0.10")
    REDUCED_RATE = Decimal("0.08")

    @classmethod
    def calculate(cls, amount: Decimal,
                  rate_type: str = "standard") -> Decimal:
        rate = cls.REDUCED_RATE if rate_type == "reduced" else cls.STANDARD_RATE
        return (amount * rate).quantize(Decimal("1"))

    @classmethod
    def add_tax(cls, amount: Decimal,
                rate_type: str = "standard") -> Decimal:
        return amount + cls.calculate(amount, rate_type)


# All services use TaxCalculator
class OrderService:
    def calculate_total(self, order):
        return TaxCalculator.add_tax(order.subtotal)

class InvoiceService:
    def generate(self, order):
        tax = TaxCalculator.calculate(order.subtotal)
        return f"Tax: {tax}"
```

---

## 6. Dispensable Smells in Detail

### 6.1 Dead Code

**Definition**: Code that is never executed, functions that are never called, unused imports or variables.

**Code Example 8: Detecting and Removing Dead Code (Python)**

```python
# NG: Dead code scattered throughout
import os                     # ← unused import
import json                   # ← unused import
from datetime import datetime

class UserManager:
    def __init__(self, db):
        self.db = db
        self.cache = {}        # ← never read or written

    def get_user(self, user_id: str) -> User:
        return self.db.find(user_id)

    def _old_get_user(self, user_id: str) -> User:
        """Old implementation — keeping it in case it's needed someday"""  # ← dead code
        result = self.db.execute(f"SELECT * FROM users WHERE id = '{user_id}'")
        return User.from_row(result)

    def update_user(self, user_id: str, data: dict) -> User:
        user = self.get_user(user_id)
        # if False:                              # ← unreachable code
        #     self._send_update_notification(user)
        user.update(data)
        self.db.save(user)
        return user

    def _send_update_notification(self, user):   # ← never called
        pass


# OK: Remove dead code completely
from datetime import datetime

class UserManager:
    def __init__(self, db):
        self.db = db

    def get_user(self, user_id: str) -> User:
        return self.db.find(user_id)

    def update_user(self, user_id: str, data: dict) -> User:
        user = self.get_user(user_id)
        user.update(data)
        self.db.save(user)
        return user

# Old implementations can be restored from Git history
# → No need to keep dead code "just in case"
```

### 6.2 Speculative Generality

**Definition**: Code that has been over-abstracted "in case it's needed in the future." Violates YAGNI (You Aren't Gonna Need It).

```python
# NG: Over-abstracted even though only JSON is currently used
class SerializerFactory:
    def create(self, format_type: str) -> Serializer:
        if format_type == "json":
            return JsonSerializer()
        elif format_type == "xml":          # ← never used
            return XmlSerializer()
        elif format_type == "yaml":         # ← never used
            return YamlSerializer()
        elif format_type == "msgpack":      # ← never used
            return MsgpackSerializer()
        elif format_type == "protobuf":     # ← never used
            return ProtobufSerializer()

class Serializer(ABC): ...
class JsonSerializer(Serializer): ...
class XmlSerializer(Serializer): ...        # ← never used
class YamlSerializer(Serializer): ...       # ← never used
class MsgpackSerializer(Serializer): ...    # ← never used
class ProtobufSerializer(Serializer): ...   # ← never used


# OK: Implement only what is needed
class JsonSerializer:
    """JSON serialization — the only format currently needed"""
    def serialize(self, data: dict) -> str:
        return json.dumps(data, ensure_ascii=False, default=str)

    def deserialize(self, text: str) -> dict:
        return json.loads(text)

# If XML is needed in the future, introduce the abstraction at that point
# → "Rule of Three": wait until a pattern appears for the third time before abstracting
```

### 6.3 Duplicate Code

**Definition**: Identical or very similar code exists in multiple locations.

**Code Example 9: Consolidating Duplicate Code (Python)**

```python
# NG: Nearly identical validation logic duplicated in 3 places
class UserRegistration:
    def register(self, data: dict):
        # Email validation (duplicate 1)
        if not data.get('email'):
            raise ValueError("Email is required")
        if '@' not in data['email']:
            raise ValueError("Invalid email format")
        if len(data['email']) > 254:
            raise ValueError("Email is too long")
        # ...

class ProfileUpdate:
    def update_email(self, data: dict):
        # Email validation (duplicate 2 — nearly identical)
        if not data.get('new_email'):
            raise ValueError("Email is required")
        if '@' not in data['new_email']:
            raise ValueError("Invalid email format")
        if len(data['new_email']) > 254:
            raise ValueError("Email is too long")
        # ...

class InviteService:
    def send_invite(self, email: str):
        # Email validation (duplicate 3 — slightly different)
        if not email or '@' not in email:
            raise ValueError("Invalid email")
        # ...


# OK: Consolidate validation logic into a value object
import re
from dataclasses import dataclass

@dataclass(frozen=True)
class Email:
    """Email address value object — validation in one place only"""
    value: str

    _PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    _MAX_LENGTH = 254

    def __post_init__(self):
        if not self.value:
            raise ValueError("Email address is required")
        if len(self.value) > self._MAX_LENGTH:
            raise ValueError(f"Email address must be {self._MAX_LENGTH} characters or fewer")
        if not self._PATTERN.match(self.value):
            raise ValueError(f"Invalid email format: {self.value}")
        # frozen=True so normalize via object.__setattr__
        object.__setattr__(self, 'value', self.value.strip().lower())

class UserRegistration:
    def register(self, data: dict):
        email = Email(data.get('email', ''))  # validation runs inside Email
        # ...

class ProfileUpdate:
    def update_email(self, data: dict):
        new_email = Email(data.get('new_email', ''))
        # ...
```

---

## 7. Coupler Smells in Detail

### 7.1 Feature Envy

**Definition**: A method references data from another class more than from its own class.

**Code Example 10: Improving Feature Envy (Java)**

```java
// NG: OrderPrinter excessively uses Order's internal data
class OrderPrinter {
    String formatOrder(Order order) {
        StringBuilder sb = new StringBuilder();
        sb.append("Order #: ").append(order.getId()).append("\n");
        sb.append("Customer: ").append(order.getCustomer().getName()).append("\n");
        sb.append("Date: ").append(order.getDate()
            .format(DateTimeFormatter.ISO_DATE)).append("\n");

        double subtotal = 0;
        for (OrderItem item : order.getItems()) {
            double lineTotal = item.getPrice() * item.getQuantity();
            subtotal += lineTotal;
            sb.append(String.format("  %s x%d = $%.2f\n",
                item.getName(), item.getQuantity(), lineTotal));
        }
        double tax = subtotal * 0.10;
        sb.append(String.format("Subtotal: $%.2f\nTax: $%.2f\nTotal: $%.2f\n",
            subtotal, tax, subtotal + tax));
        return sb.toString();
    }
}


// OK: Move the formatting logic to Order
class Order {
    public String format() {
        StringBuilder sb = new StringBuilder();
        sb.append("Order #: ").append(this.id).append("\n");
        sb.append("Customer: ").append(this.customer.getName()).append("\n");
        sb.append("Date: ").append(this.date
            .format(DateTimeFormatter.ISO_DATE)).append("\n");
        this.items.forEach(item -> sb.append(item.formatLine()));
        sb.append(formatTotals());
        return sb.toString();
    }

    private String formatTotals() {
        double subtotal = calculateSubtotal();
        double tax = subtotal * 0.10;
        return String.format("Subtotal: $%.2f\nTax: $%.2f\nTotal: $%.2f\n",
            subtotal, tax, subtotal + tax);
    }

    public double calculateSubtotal() {
        return items.stream()
            .mapToDouble(item -> item.getPrice() * item.getQuantity())
            .sum();
    }
}

class OrderItem {
    public String formatLine() {
        double lineTotal = this.price * this.quantity;
        return String.format("  %s x%d = $%.2f\n",
            this.name, this.quantity, lineTotal);
    }
}
```

### 7.2 Message Chains (Law of Demeter Violation)

**Definition**: A chain of object accesses occurs, such as `a.getB().getC().getD().doSomething()`.

**Code Example 11: Improving Message Chains (Python)**

```python
# NG: Violates the Law of Demeter
class OrderReport:
    def get_customer_city(self, order):
        # 4-level chain: order → customer → address → city
        return order.get_customer().get_address().get_city()

    def get_payment_bank(self, order):
        # 4-level chain: order → payment → method → bank
        return order.get_payment().get_method().get_bank_name()


# OK: Provide methods that directly retrieve the needed information
class Order:
    def get_customer_city(self) -> str:
        """Returns the customer's city (hides internal structure)"""
        return self._customer.get_city()

    def get_payment_bank(self) -> str:
        """Returns the payment bank name"""
        return self._payment.get_bank_name()

class Customer:
    def get_city(self) -> str:
        """Returns the city from the address (hides internal structure)"""
        return self._address.city

class Payment:
    def get_bank_name(self) -> str:
        return self._method.bank_name

# Caller only needs one level
class OrderReport:
    def get_customer_city(self, order):
        return order.get_customer_city()
```

### 7.3 Inappropriate Intimacy

**Definition**: Two classes are overly dependent on each other's internal implementations.

**Code Example 12: Improving Inappropriate Intimacy (TypeScript)**

```typescript
// NG: User and Profile directly manipulate each other's internals
class User {
  public name: string;
  public email: string;
  public profile: Profile;

  updateProfile(bio: string): void {
    // User directly manipulates Profile's internals
    this.profile._bio = bio;               // bypasses private
    this.profile._updatedAt = new Date();  // violates Profile's responsibility
  }
}

class Profile {
  _bio: string;          // should be private
  _updatedAt: Date;      // should be private

  getDisplayName(): string {
    // Profile directly references User's internals
    return `${this.user.name} (${this.user.email})`;
  }
}


// OK: Communicate only through clear interfaces
class User {
  private readonly name: string;
  private readonly email: string;
  private readonly profile: Profile;

  updateProfile(bio: string): void {
    this.profile.updateBio(bio);  // calls Profile's method
  }

  getDisplayInfo(): UserDisplayInfo {
    return { name: this.name, email: this.email };
  }
}

class Profile {
  private bio: string;
  private updatedAt: Date;

  updateBio(bio: string): void {
    if (bio.length > 500) throw new Error("Profile must be 500 characters or fewer");
    this.bio = bio;
    this.updatedAt = new Date();
  }

  formatDisplay(userInfo: UserDisplayInfo): string {
    return `${userInfo.name} - ${this.bio}`;
  }
}
```

---

## 8. Smell Impact Matrix

```
  Smell Impact Matrix — Vertical axis: Impact, Horizontal axis: Ease of detection

  Impact: High
    ^
    |  [Circular Dep.]  [Shotgun Surgery]
    |
    |  [God Class]      [Divergent Change]
    |
    |  [Feature         [Long Method]     [Duplicate Code]
    |   Envy]
    |
    |  [Message          [Dead Code]      [Long Parameter]
    |   Chains]
    |
    |  [Temporary        [Speculative     [Excessive Comments]
    |   Field]            Generality]
    +──────────────────────────────────────────────> Ease of detection
   Hard               Medium                  Easy

  ★ Starting from the top-right zone (high impact, easy to detect) is most efficient
```

---

## 9. Smell-to-Refactoring Mapping Table

### 9.1 Smell → Refactoring Mapping

| Code Smell | Corresponding Refactoring | Automatable | Priority |
|------------|----------------------|:--------:|:------:|
| Long Method | Extract Method | Yes | High |
| God Class | Extract Class, Move Method | Partial | High |
| Feature Envy | Move Method, Move Field | Partial | High |
| Data Clumps | Extract Class, Introduce Parameter Object | Partial | Medium |
| Primitive Obsession | Replace Primitive with Object | No | Medium |
| Switch Statements | Replace Conditional with Polymorphism | No | Medium |
| Shotgun Surgery | Move Method, Inline Class | No | High |
| Divergent Change | Extract Class | Partial | High |
| Dead Code | Safe Delete | Yes | Low |
| Duplicate Code | Extract Method, Pull Up Method | Partial | Medium |
| Long Parameter List | Introduce Parameter Object | Partial | Medium |
| Message Chains | Hide Delegate | No | Medium |
| Refused Bequest | Replace Inheritance with Delegation | No | Low |
| Speculative Generality | Collapse Hierarchy, Remove Middle Man | Yes | Low |
| Inappropriate Intimacy | Move Method, Extract Class | No | High |
| Temporary Field | Extract Class | Partial | Low |

### 9.2 Automated Detection Tools Comparison

| Tool | Supported Languages | Detectable Smells | CI/CD Integration | License |
|--------|---------|---------------|:---------:|-----------|
| SonarQube | Multi-language (30+) | Complexity, duplication, dead code, security | Yes | Community Edition: Free |
| PMD | Java, Apex | Complexity, naming, design issues | Yes | BSD |
| pylint | Python | Complexity, naming, unused code, style | Yes | GPL |
| Ruff | Python | pylint + flake8 compatible, fast | Yes | MIT |
| ESLint | JS/TS | Complexity, unused variables, style | Yes | MIT |
| RuboCop | Ruby | Complexity, style, naming, Metrics | Yes | MIT |
| detekt | Kotlin | Complexity, code smells, style | Yes | Apache 2.0 |
| radon | Python | Complexity (CC, MI) only | Yes | MIT |
| jscpd | Multi-language | Duplicate code detection only | Yes | MIT |

---

## 10. Smell Detection Workflow

### 10.1 Three-Stage Detection System

```
  Three-Stage Smell Detection Workflow

  ┌──────────────────────────────────────────────┐
  │  Stage 1: Automated Detection (pre-commit / CI) │
  │  ─────────────────────────────────              │
  │  - Auto-check style and complexity with Ruff/ESLint │
  │  - Detect functions with CC > 10 using radon   │
  │  - Block duplication rate > 3% with jscpd      │
  │  Effect: Automatically eliminates 60% of mechanically detectable smells │
  └──────────────┬───────────────────────────────┘
                 v
  ┌──────────────────────────────────────────────┐
  │  Stage 2: Code Review (PR Review)            │
  │  ─────────────────────────────────           │
  │  - Humans judge signs of Feature Envy, God Class │
  │  - Verify alignment with design intent       │
  │  - Use a checklist to prevent oversights     │
  │  Effect: Detects 30% of smells requiring context │
  └──────────────┬───────────────────────────────┘
                 v
  ┌──────────────────────────────────────────────┐
  │  Stage 3: Periodic Audit (Quarterly Review)  │
  │  ─────────────────────────────────           │
  │  - Trend analysis via SonarQube dashboard    │
  │  - Hotspot analysis (change frequency x complexity) │
  │  - Re-prioritize technical debt backlog      │
  │  Effect: Systematically resolves 10% of accumulated smells │
  └──────────────────────────────────────────────┘
```

### 10.2 Smell Detection in CI/CD (GitHub Actions)

**Code Example 13: Automated Smell Detection Pipeline**

```yaml
# .github/workflows/code-smell-detection.yml
name: Code Smell Detection

on:
  pull_request:
    branches: [main, develop]

jobs:
  detect-smells:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install analysis tools
        run: |
          pip install ruff radon jscpd

      # 1. Lint check (style + basic smells)
      - name: Ruff Lint
        run: ruff check src/ --output-format=github

      # 2. Cyclomatic complexity check
      - name: Complexity Check
        run: |
          echo "## Complexity Report" >> $GITHUB_STEP_SUMMARY
          radon cc src/ -a -nc --min C
          # Warn if complexity C or higher (11+) is found
          COMPLEX=$(radon cc src/ -nc --min C -j | python3 -c "
          import json, sys
          data = json.load(sys.stdin)
          count = sum(len(funcs) for funcs in data.values())
          print(count)
          ")
          if [ "$COMPLEX" -gt 0 ]; then
            echo "::warning::Found ${COMPLEX} function(s) with high complexity"
          fi

      # 3. Code duplication check
      - name: Duplication Check
        run: |
          jscpd src/ --min-lines 6 --min-tokens 50 \
                --reporters "consoleFull" --threshold 3

      # 4. Dead code detection
      - name: Dead Code Detection
        run: |
          pip install vulture
          vulture src/ --min-confidence 80

      # 5. Maintainability index
      - name: Maintainability Index
        run: |
          radon mi src/ -s --min B
```

### 10.3 Code Review Checklist

```
  ┌─────────────────────────────────────────────────────────┐
  │  Smell Detection Checklist (for Code Review)            │
  ├─────────────────────────────────────────────────────────┤
  │  □ Is the method 20 lines or fewer? (Long Method)       │
  │  □ Does the class have a single responsibility? (God Class) │
  │  □ No repeated groups of the same parameters? (Data Clumps) │
  │  □ Not using primitive types for domain concepts?        │
  │  □ No conditional branches scattered across multiple locations? │
  │  □ Does the method primarily use data from its own class? │
  │  □ Will a single change require modifying multiple files? │
  │  □ No unused code or imports?                           │
  │  □ No excessive abstraction "for the future"?           │
  │  □ No chained object access (a.b.c.d)?                  │
  └─────────────────────────────────────────────────────────┘
```

---

## 11. Hotspot Analysis — Scientific Prioritization

### 11.1 Change Frequency x Complexity Analysis

**Code Example 14: Hotspot Analysis Script (Python)**

```python
#!/usr/bin/env python3
"""
Hotspot analysis: Combines change frequency and complexity to
scientifically prioritize refactoring.

Usage:
  python hotspot_analysis.py /path/to/repo --days 90
"""
import subprocess
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class FileMetrics:
    """Smell metrics for a file"""
    path: str
    change_count: int       # Number of changes in Git
    complexity: float       # Average cyclomatic complexity
    lines: int              # Line count
    hotspot_score: float    # Change frequency x complexity

    @property
    def priority(self) -> str:
        if self.hotspot_score > 100:
            return "Top Priority"
        elif self.hotspot_score > 50:
            return "High"
        elif self.hotspot_score > 20:
            return "Medium"
        return "Low"


def analyze_hotspots(repo_path: str, days: int = 90) -> list[FileMetrics]:
    """Analyzes change frequency x complexity hotspots"""

    # 1. Get change frequency from Git log
    result = subprocess.run(
        ['git', 'log', '--format=format:', '--name-only',
         f'--since={days} days ago', '--diff-filter=M'],
        capture_output=True, text=True, cwd=repo_path
    )
    file_changes: dict[str, int] = {}
    for line in result.stdout.strip().split('\n'):
        line = line.strip()
        if line and line.endswith('.py'):
            file_changes[line] = file_changes.get(line, 0) + 1

    # 2. Get complexity with radon
    result = subprocess.run(
        ['radon', 'cc', repo_path, '-a', '-j'],
        capture_output=True, text=True
    )
    complexity_data = json.loads(result.stdout)

    # 3. Calculate hotspot scores
    metrics = []
    for filepath, change_count in file_changes.items():
        cc = get_file_complexity(complexity_data, filepath)
        score = change_count * cc
        metrics.append(FileMetrics(
            path=filepath,
            change_count=change_count,
            complexity=cc,
            lines=count_lines(Path(repo_path) / filepath),
            hotspot_score=score
        ))

    return sorted(metrics, key=lambda m: m.hotspot_score, reverse=True)


def print_hotspot_report(metrics: list[FileMetrics]) -> None:
    """Prints the hotspot report"""
    print("=" * 75)
    print("  Hotspot Analysis Report")
    print("=" * 75)
    print(f"{'Priority':<12} {'Score':<8} {'Changes':>7} {'CC':>5} {'Lines':>6}  {'File'}")
    print("-" * 75)
    for m in metrics[:20]:
        print(f"{m.priority:<12} {m.hotspot_score:>6.1f} {m.change_count:>7} "
              f"{m.complexity:>5.1f} {m.lines:>6}  {m.path}")
```

### 11.2 Hotspot Matrix

```
  Change Frequency x Complexity Matrix

            High change frequency (20+ / quarter)
                 |
   +-------------+-------------+
   |  Code A      |  Code B      |
   |  Low CC      |  High CC     |
   |  High change |  High change |
   |              |              |
   |  → Monitor   | → Top        |
   |    only      |   Priority   |
   +-------------+-------------+
   |  Code C      |  Code D      |
   |  Low CC      |  High CC     |
   |  Low change  |  Low change  |
   |              |              |
   |  → Ignore    | → Improve in |
   |              |   next phase |
   +-------------+-------------+
                 |
            Low change frequency (< 5 / quarter)
   Low CC (CC<5) ──+── High CC (CC>10)
```

---

## 12. Anti-Patterns

### Anti-Pattern 1: Ignoring Smells (Broken Window Theory)

```
  BAD: The chain of neglect

  First neglect
    → "It's fine, it works"
    → More neglect
    → "It's always been like this"
    → Avalanche decline in quality
    → "We'd have to rewrite everything"
    → State of unreformable code

  Why it's dangerous:
  - Leaving one Long Method teaches teammates "this length is acceptable"
  - Smells are like "broken windows" — one leads to rapid proliferation
  - James Q. Wilson & George L. Kelling's "Broken Window Theory" applies to software too

  GOOD: The Boy Scout Rule
  "Leave it cleaner than you found it" — clean up a little whenever you touch a file
  - No need to fix everything at once
  - Fix one nearby smell while making a related change
  - Small improvements accumulate into significant quality gains
```

### Anti-Pattern 2: Fixing Everything at Once (Big Bang Refactoring)

```
  BAD: Fixing all smells in one batch

  "Let's clean up the whole codebase this weekend!"
    → Massive changeset (500 files changed)
    → Unreviable (10,000-line diff)
    → Tests break
    → Merge conflict hell
    → Risk of introducing bugs
    → End up reverting it all

  GOOD: Incremental improvement

  Sprint N:   Fix [Long Method x 3] (PR #101, #102, #103)
  Sprint N+1: Split [God Class x 1]  (PR #110)
  Sprint N+2: Purge [Dead Code]      (PR #120)

  Principles:
  - One smell per pull request
  - Each PR has a diff under 300 lines
  - Reviewable size
  - Tests always remain passing
```

### Anti-Pattern 3: Over-Detection (Tool Worship)

```
  BAD: Trying to fix every warning from tools

  SonarQube: "1,247 Issues"
    → Setting a goal to fix all of them
    → 30% are actually false positives
    → Spending equal effort on low-priority smells
    → Important smells get buried

  GOOD: Triage (priority classification)

  1. Combine tool output with hotspot analysis
  2. Exclude false positives from rules
  3. Prioritize by impact x change frequency
  4. Focus on the top 20% of smells (Pareto principle)
```

### Anti-Pattern 4: Refactoring Immediately Upon Finding a Smell

```
  BAD: Starting a refactoring right before a deadline

  "This code is messy! I need to refactor it!" (2 days before release)
    → Unplanned changes
    → Test fixes take longer than expected
    → Release is delayed

  GOOD: Record it and address it with a plan

  1. Find a smell → record in the backlog (location, type, estimated effort)
  2. Complete the current task
  3. Evaluate priority in the next sprint planning
  4. Perform refactoring once tests are sufficient
```

---

## 13. Exercises

### Exercise 1 (Basic): Classifying Smells

Identify and classify all smells in the following code.

```python
# Problem code: identify all smells below
import os, sys, json, csv, re  # some unused imports

class AppManager:
    """Class that manages the entire application"""
    def __init__(self):
        self.db = Database()
        self.mailer = Mailer()
        self.cache = {}
        self.temp_result = None   # only used by a specific method

    def process(self, t, n, e, a, c, z, co):
        """User registration processing"""
        # Validation
        if not n:
            raise ValueError("Name is required")
        if '@' not in e:
            raise ValueError("Invalid email")

        # Create user
        user = {"type": t, "name": n, "email": e,
                "address": a, "city": c, "zip": z, "country": co}

        # Pricing
        if t == "premium":
            price = 9800
        elif t == "standard":
            price = 4980
        elif t == "free":
            price = 0

        # Save to DB
        self.db.execute(f"INSERT INTO users VALUES ('{n}', '{e}')")

        # Send email
        self.mailer.send(e, "Registration complete", f"Welcome {n}")

        # Clear cache
        self.cache = {}

        self.temp_result = price
        return price
```

**Expected Answer**:

| Smell | Category | Location |
|--------|------|------|
| Dead Code (unused imports) | Dispensable | `os, sys, csv, re` |
| God Class | Bloater | `AppManager` handles DB, mail, cache, and calculation |
| Long Parameter List | Bloater | `process(self, t, n, e, a, c, z, co)` — 7 parameters |
| Data Clumps | Bloater | `a, c, z, co` belong together as an address |
| Primitive Obsession | Bloater | User type determined by string, email as `str` |
| Switch Statements | OO Abuser | `if t == "premium"` branching |
| Temporary Field | OO Abuser | `self.temp_result` |
| Unclear naming | — | `t, n, e, a, c, z, co` |
| SQL Injection | Security | `f"INSERT INTO users VALUES ('{n}', '{e}')"` |

---

### Exercise 2 (Applied): Refactoring to Remove Smells

Refactor the code from Exercise 1 following these steps:

1. Remove unused imports
2. Extract Data Clumps into value objects
3. Improve Primitive Obsession for type safety
4. Replace Switch Statements with polymorphism
5. Split God Class by responsibility
6. Consolidate Long Parameter List into parameter objects

**Expected Answer (Summary)**:

```python
# 1. Only necessary imports
from dataclasses import dataclass
from abc import ABC, abstractmethod
from decimal import Decimal

# 2. Value objects
@dataclass(frozen=True)
class Email:
    value: str
    def __post_init__(self):
        if '@' not in self.value:
            raise ValueError(f"Invalid email: {self.value}")

@dataclass(frozen=True)
class Address:
    street: str
    city: str
    zip_code: str
    country: str

# 3. Pricing via polymorphism
class UserPlan(ABC):
    @abstractmethod
    def monthly_price(self) -> Decimal: ...

class PremiumPlan(UserPlan):
    def monthly_price(self) -> Decimal:
        return Decimal("9800")

class StandardPlan(UserPlan):
    def monthly_price(self) -> Decimal:
        return Decimal("4980")

class FreePlan(UserPlan):
    def monthly_price(self) -> Decimal:
        return Decimal("0")

# 4. Parameter object
@dataclass
class RegistrationRequest:
    name: str
    email: Email
    address: Address
    plan: UserPlan

# 5. Separation of responsibilities
class UserRegistrationService:
    def __init__(self, repository, notifier):
        self.repository = repository
        self.notifier = notifier

    def register(self, request: RegistrationRequest) -> Decimal:
        user = User(request.name, request.email, request.address, request.plan)
        self.repository.save(user)
        self.notifier.send_welcome(user)
        return request.plan.monthly_price()
```

---

### Exercise 3 (Advanced): Hotspot Analysis and Improvement Planning

Based on the following analysis results, draft an improvement plan for 3 sprints.

```
Hotspot Analysis Results:
File                             Changes  CC   Lines  Score
------------------------------------------------------------
src/services/order_service.py       42    18   850    756
src/services/user_service.py        38    15   620    570
src/utils/helpers.py                35     4   200    140
src/api/endpoints.py                30    12   450    360
src/models/payment.py               25     8   300    200
src/config/settings.py              22     2   100     44
src/services/email_service.py       15    10   350    150
src/tests/test_helpers.py           10     3   150     30
```

**Expected Answer (Summary)**:

```
Sprint 1 (Top Priority — Score > 500):
  1. order_service.py (Score 756)
     - Split God Class: OrderCreation, OrderPricing, OrderFulfillment
     - Extract Method for Long Method
     - Refactor after ensuring test coverage
     Estimated effort: 8 story points

  2. user_service.py (Score 570)
     - Move Method for Feature Envy
     - Extract Class for complex validation
     Estimated effort: 5 story points

Sprint 2 (High Priority — Score 200–500):
  3. endpoints.py (Score 360)
     - Extract Method for Long Method
     - Slim down controllers (move logic to Service layer)
     Estimated effort: 5 story points

  4. payment.py (Score 200)
     - Improve Primitive Obsession (convert amounts to Money value object)
     Estimated effort: 3 story points

Sprint 3 (Medium Priority):
  5. email_service.py (Score 150)
     - Reduce complexity
  6. helpers.py (Score 140)
     - High change frequency but low complexity → continue monitoring

  Note: settings.py (Score 44), test_helpers.py (Score 30) can be ignored
```

---

## 14. FAQ

### Q1: Should every code smell always be fixed?

No. A smell is a "signal to investigate," not necessarily an indication that refactoring is required. Use the following criteria:

**When to fix**:
- It exists in a high-change-frequency file (hotspot)
- The same smell has repeatedly caused problems within the team
- It makes adding or modifying tests difficult
- It hinders onboarding for new team members

**When to leave it**:
- Change frequency is low (once or twice a year)
- Throwaway code (prototype, proof of concept)
- Legacy system slated for decommissioning in the near future
- The cost of fixing significantly outweighs the benefit

### Q2: What if the team has different standards for smells?

1. **Set objective criteria**: Configure numeric thresholds with static analysis tools like SonarQube
   - Method line count: 20 or fewer
   - Cyclomatic complexity: 10 or fewer
   - Class line count: 300 or fewer
   - Parameter count: 4 or fewer
2. **Document in coding conventions**: Record team-agreed thresholds in documentation
3. **Code review checklist**: Make smell detection items mandatory in reviews
4. **Regular "technical review meetings"**: Share real examples of smells monthly to align understanding
5. **Onboarding for new members**: Include a smell example catalog in training materials

### Q3: Where should you start with smells in legacy code?

**Start with the most frequently changed files.** Use a scientific approach with the following steps:

```bash
# Step 1: Identify frequently changed files
git log --format=format: --name-only --since="6 months ago" \
  | sort | uniq -c | sort -rn | head -20

# Step 2: Identify files with high complexity
radon cc src/ -a -nc --min C

# Step 3: Files appearing in both lists are hotspots
```

### Q4: How should you handle a detection tool generating a large number of warnings?

1. **Triage**: Prioritize using hotspot analysis
2. **Set a baseline**: Use the current warning count as a baseline and focus on "preventing new additions"
3. **Quality gate**: Make "zero new smells in new code" a condition for PR merge
4. **Gradually lower thresholds**: Reduce the number of acceptable warnings each quarter
5. **Exclude false positives**: Exclude unnecessary rules via `.sonarqube-exclusions` or similar

### Q5: What is the relationship between smells and design patterns?

Smells and design patterns are two sides of the same coin.

| Smell | Corresponding Pattern | Reference |
|--------|---------------|------|
| Switch Statements | Strategy, State, Factory Method | design-patterns-guide/00-creational/ |
| Feature Envy | Mediator, Facade | design-patterns-guide/02-behavioral/ |
| Parallel Hierarchy | Bridge, Abstract Factory | design-patterns-guide/01-structural/ |
| God Class | Facade + split into multiple smaller classes | design-patterns-guide/01-structural/ |
| Message Chains | Facade, Mediator | design-patterns-guide/02-behavioral/ |

### Q6: Do test code smells exist?

Yes. Test Smells are a distinct category separate from production code smells.

| Test Smell | Description | Fix |
|------------|------|------|
| Eager Test | One test verifies too many features | Split the test |
| Mystery Guest | Test implicitly depends on external resources | Include test data within the test |
| Assertion Roulette | Multiple assertions without messages | Add a message to each assertion |
| Test Code Duplication | Same setup duplicated across tests | Share via pytest fixture or @Before |
| Slow Tests | Tests take too long to run | Use test doubles, in-memory DB |

For details, see [Testing Principles](../01-practices/04-testing-principles.md).

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. You deepen your understanding not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the core concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in everyday development work. It is particularly important during code reviews and architectural design.

---

## 15. Summary

| Category | Representative Smells | Severity | Ease of Detection | Primary Fix |
|------|------------|:------:|:----------:|---------|
| Bloaters | Long Method, God Class | High | High | Extract Method/Class |
| OO Abusers | Switch Statements, Refused Bequest | Medium | High | Polymorphism, Delegation |
| Change Preventers | Shotgun Surgery, Divergent Change | High | Low | Move Method, Extract Class |
| Dispensables | Dead Code, Speculative Generality | Low | High | Safe Delete |
| Couplers | Feature Envy, Message Chains | High | Medium | Move Method, Hide Delegate |

| Detection Stage | Method | Effect |
|---------|------|------|
| Automated (CI) | Ruff, ESLint, SonarQube | Automatically eliminates 60% of mechanical smells |
| Review | Checklist + human judgment | Detects 30% of smells requiring context |
| Periodic Audit | Hotspot analysis, dashboard | Systematically resolves 10% of accumulated smells |

| Principle | Description |
|------|------|
| Boy Scout Rule | Leave every file a little cleaner than you found it |
| Rule of Three | Wait until a pattern appears for the third time before refactoring |
| Pareto Principle | Focus on the top 20% of smells to gain 80% of the benefit |
| Hotspot Analysis | Scientifically prioritize by change frequency x complexity |

---

## Guides to Read Next

- [Refactoring Techniques](./01-refactoring-techniques.md) — Concrete techniques to resolve smells (Extract Method, Move Method, etc.)
- [Legacy Code](./02-legacy-code.md) — How to deal with code full of smells (Seams, Characterization Tests)
- [Technical Debt](./03-technical-debt.md) — The debt caused by ignoring smells and strategies to repay it
- [Testing Principles](../01-practices/04-testing-principles.md) — Test design as a safety net for refactoring
- Naming — Preventing smells through better names
- Design Patterns Overview — Patterns as structural solutions to smells
- Fundamentals of System Design — Addressing smells at the architecture level

---

## References

1. **Martin Fowler** *Refactoring: Improving the Design of Existing Code* Addison-Wesley, 2018 (2nd Edition) — The original source on code smells. Covers 22 smells and their corresponding refactorings comprehensively. Especially Chapter 3 "Bad Smells in Code," which forms the foundation of this chapter.
2. **Robert C. Martin** *Clean Code: A Handbook of Agile Software Craftsmanship* Prentice Hall, 2008 — Chapter 17 "Smells and Heuristics" systematizes heuristics for sharpening your nose for smells.
3. **Joshua Kerievsky** *Refactoring to Patterns* Addison-Wesley, 2004 — A pioneering work that maps smells to design patterns. Positions patterns as the means to resolve smells.
4. **Michael Feathers** *Working Effectively with Legacy Code* Prentice Hall, 2004 — Techniques for detecting smells in legacy code (code without tests) and performing safe refactoring.
5. **Mika Mantyla & Casper Lassenius** "Subjective evaluation of software evolvability using code smells: An empirical study" (Empirical Software Engineering, 2006) — Academic research on the objective evaluation of code smells. Empirically analyzes the correlation between smell severity and maintainability.
