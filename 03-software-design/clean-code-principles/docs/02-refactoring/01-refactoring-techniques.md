# Refactoring Techniques — Extract Method, Move, and Other Fundamental Techniques

> Refactoring is a disciplined process of improving the internal structure of code without changing its external behavior. It proceeds in small steps, verifying safety with tests at each stage. Martin Fowler systematized over 60 techniques in the second edition of *Refactoring*, but this chapter takes a deep dive into the most frequently used techniques in practice, along with safe application procedures, code examples, IDE support, and decision criteria.

---

## Prerequisites

| Prerequisite | Reference |
|------|--------|
| Code smell classification | [00-code-smells.md](./00-code-smells.md) |
| Testing fundamentals (AAA pattern, test doubles) | [01-practices/04-testing-principles.md](../01-practices/04-testing-principles.md) |
| Core clean code principles | [00-principles/](../00-principles/) |
| Naming and function design | 01-practices/01-naming.md, 01-practices/02-functions.md |

---

## What You Will Learn in This Chapter

1. **The 5 iron rules of refactoring** — Understand the prerequisites and approach for safe refactoring
2. **10+ key techniques** — Learn Extract Method, Move Method, Rename, Replace Conditional, and more with step-by-step procedures
3. **Technique selection criteria** — Develop a decision framework for choosing the right technique based on code smells
4. **IDE-assisted refactoring** — Master the automated refactoring features of IntelliJ IDEA, VS Code, and PyCharm
5. **Safe refactoring workflow** — Learn to practice the test → change → test → commit cycle

---

## 1. Core Principles of Refactoring

### 1.1 The 5 Iron Rules

```
+-------------------------------------------------------------------+
|  The 5 Iron Rules of Refactoring                                   |
|  ───────────────────────────────────────────                       |
|  1. Do not change behavior (external specification is immutable)   |
|  2. Write/verify tests first (establish a safety net)             |
|  3. Proceed in small steps (one change = one type of improvement) |
|  4. Commit frequently (so you can always revert to a known state) |
|  5. Never refactor and add features simultaneously (Two Hats)     |
+-------------------------------------------------------------------+

Martin Fowler's "Two Hats" metaphor:
- Hat A: Feature addition → Add tests, implement new behavior
- Hat B: Refactoring → Improve structure without changing tests
- ★ Never wear both hats at the same time
```

### 1.2 The Safe Refactoring Cycle

```
  Refactoring Micro-Cycle

  ┌──────────────┐
  │ 1. Run tests  │     Confirm all tests pass
  │   (GREEN)    │     → Fix any bugs before proceeding
  └──────┬───────┘
         v
  ┌──────────────┐
  │ 2. Small     │     Apply one technique, one step at a time
  │   change     │     e.g., rename a method only
  │   (1 step)   │
  └──────┬───────┘
         v
  ┌──────────────┐      Failure → Undo change (git checkout)
  │ 3. Run tests  │──────→ Identify what broke → Fix and retry
  │              │
  └──────┬───────┘
    Pass  v
  ┌──────────────┐
  │ 4. Commit    │     "refactor: improve XXX"
  └──────┬───────┘     → Can always return to this point
         v
  ┌──────────────┐
  │ 5. Next      │──→ Back to step 1
  │   change     │
  └──────────────┘

  ★ Ideal cycle duration: 2–10 minutes
  ★ The longer the cycle, the higher the risk
```

### 1.3 When to Refactor

```
  When should you refactor?

  ┌─────────────────────────────────────────────────┐
  │  Rule of Three                                   │
  │  ─────────────────────                          │
  │  1st time: Just write it                        │
  │  2nd time: Notice duplication, but hold back    │
  │  3rd time: Refactor                             │
  └─────────────────────────────────────────────────┘

  Effective timing:
  ┌───────────────────┬───────────────────────────────┐
  │ Timing            │ Reason                        │
  ├───────────────────┼───────────────────────────────┤
  │ Before adding     │ Prepare a structure easier    │
  │ features          │ to change                     │
  │ After fixing bugs │ Resolve underlying design     │
  │                   │ problems                      │
  │ During code review│ As a response to review       │
  │                   │ feedback                      │
  │ For understanding │ Improve structure while       │
  │                   │ reading the code              │
  └───────────────────┴───────────────────────────────┘

  When NOT to refactor:
  - Just before a deadline
  - When tests are insufficient
  - In the middle of a large feature development
  - When performance is an issue (measure first)
```

---

## 2. Key Refactoring Techniques

### 2.1 Extract Method

**Purpose**: Split a Long Method and give each part a name that expresses its intent. The most frequently used fundamental technique.

**Safe procedure**:
1. Identify the code block to extract
2. Create a new method and give it an intent-expressing name
3. Replace the original code with a call to the new method
4. Pass necessary variables as parameters
5. Run tests to confirm behavior has not changed

**Code Example 1: Extract Method (Python)**

```python
# Before: A long method mixing multiple concerns
class Order:
    def print_invoice(self):
        print("========== Invoice ==========")
        print(f"Customer: {self.customer.name}")
        print(f"Date: {self.date}")
        print()

        # Print line items
        total = 0
        for item in self.items:
            line_total = item.price * item.quantity
            total += line_total
            print(f"  {item.name}: {item.price} x {item.quantity} = {line_total}")

        # Calculate and print totals
        tax = total * 0.10
        grand_total = total + tax
        print()
        print(f"Subtotal: {total}")
        print(f"Tax (10%): {tax}")
        print(f"Total: {grand_total}")
        print("============================")


# After: Extract a method for each intent
class Order:
    def print_invoice(self):
        """Print invoice — the high-level flow is clear at a glance"""
        self._print_header()
        self._print_line_items()
        self._print_totals()

    def _print_header(self):
        """Print the header section"""
        print("========== Invoice ==========")
        print(f"Customer: {self.customer.name}")
        print(f"Date: {self.date}")
        print()

    def _print_line_items(self):
        """Print line items"""
        for item in self.items:
            line_total = item.price * item.quantity
            print(f"  {item.name}: {item.price} x {item.quantity} = {line_total}")

    def _print_totals(self):
        """Print the totals section"""
        subtotal = self.calculate_subtotal()
        tax = subtotal * Decimal("0.10")
        print()
        print(f"Subtotal: {subtotal}")
        print(f"Tax (10%): {tax}")
        print(f"Total: {subtotal + tax}")
        print("============================")

    def calculate_subtotal(self) -> Decimal:
        """Calculate subtotal — reusable from other methods"""
        return sum(item.price * item.quantity for item in self.items)
```

**Code Example 2: Extract Method — Handling Local Variables (Python)**

```python
# Before: Many local variables make extraction difficult
def generate_report(orders: list[Order], start_date: date, end_date: date) -> str:
    # Filtering
    filtered = [o for o in orders
                if start_date <= o.date <= end_date]

    # Aggregation
    total_revenue = sum(o.total for o in filtered)
    total_orders = len(filtered)
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0

    # Aggregate top products
    product_counts = {}
    for order in filtered:
        for item in order.items:
            product_counts[item.name] = (
                product_counts.get(item.name, 0) + item.quantity
            )
    top_products = sorted(
        product_counts.items(), key=lambda x: x[1], reverse=True
    )[:10]

    # Generate report string
    lines = [
        f"=== Report ({start_date} ~ {end_date}) ===",
        f"Total Revenue: {total_revenue:,.0f}",
        f"Orders: {total_orders}",
        f"Average Order Value: {avg_order_value:,.0f}",
        "",
        "--- Top Products ---",
    ]
    for name, count in top_products:
        lines.append(f"  {name}: {count}")

    return "\n".join(lines)


# After: Extract each stage into an independent method
@dataclass
class ReportStatistics:
    """Data class holding aggregated report results"""
    total_revenue: Decimal
    total_orders: int
    avg_order_value: Decimal
    top_products: list[tuple[str, int]]


class ReportGenerator:
    def generate(self, orders: list[Order],
                 start_date: date, end_date: date) -> str:
        """Orchestrate report generation"""
        filtered = self._filter_by_date(orders, start_date, end_date)
        stats = self._calculate_statistics(filtered)
        return self._format_report(stats, start_date, end_date)

    def _filter_by_date(self, orders: list[Order],
                        start: date, end: date) -> list[Order]:
        """Filter by date range"""
        return [o for o in orders if start <= o.date <= end]

    def _calculate_statistics(self, orders: list[Order]) -> ReportStatistics:
        """Calculate statistics from an order list"""
        total_revenue = sum(o.total for o in orders)
        total_orders = len(orders)
        avg = total_revenue / total_orders if total_orders > 0 else Decimal("0")
        top_products = self._aggregate_products(orders)
        return ReportStatistics(total_revenue, total_orders, avg, top_products)

    def _aggregate_products(self, orders: list[Order]) -> list[tuple[str, int]]:
        """Aggregate sales quantities by product"""
        counts: dict[str, int] = {}
        for order in orders:
            for item in order.items:
                counts[item.name] = counts.get(item.name, 0) + item.quantity
        return sorted(counts.items(), key=lambda x: x[1], reverse=True)[:10]

    def _format_report(self, stats: ReportStatistics,
                       start: date, end: date) -> str:
        """Format statistics into a report string"""
        lines = [
            f"=== Report ({start} ~ {end}) ===",
            f"Total Revenue: {stats.total_revenue:,.0f}",
            f"Orders: {stats.total_orders}",
            f"Average Order Value: {stats.avg_order_value:,.0f}",
            "",
            "--- Top Products ---",
        ]
        for name, count in stats.top_products:
            lines.append(f"  {name}: {count}")
        return "\n".join(lines)
```

### 2.2 Move Method / Move Field

**Purpose**: Eliminate Feature Envy (methods that excessively use data from another class). Move the method to the class that owns the data.

**Safe procedure**:
1. Create a copy of the method in the destination class
2. Adjust parameters so it works correctly in the destination
3. Change the original method to delegate to the destination method
4. Run tests
5. Update all callers of the original method to use the destination
6. Delete the original method
7. Run tests

**Code Example 3: Move Method (Java)**

```java
// Before: calculateDiscount() uses Order's data (Feature Envy)
class Customer {
    private Address address;
    private List<Order> orders;

    // This calculation should be Order's responsibility
    public double calculateOrderDiscount(Order order) {
        double total = order.getTotal();
        int itemCount = order.getItems().size();

        if (total > 10000 && itemCount > 5) return 0.15;
        if (total > 10000) return 0.10;
        if (total > 5000) return 0.05;
        return 0;
    }

    // This calculation also depends on Order's internal data
    public String formatOrderSummary(Order order) {
        return String.format("Order #%s: %d items, Total %.0f",
            order.getId(),
            order.getItems().size(),
            order.getTotal());
    }
}


// After: Move the methods to Order
class Order {
    private String id;
    private List<OrderItem> items;
    private double total;

    public double calculateDiscount() {
        if (this.total > 10000 && this.items.size() > 5) return 0.15;
        if (this.total > 10000) return 0.10;
        if (this.total > 5000) return 0.05;
        return 0;
    }

    public String formatSummary() {
        return String.format("Order #%s: %d items, Total %.0f",
            this.id, this.items.size(), this.total);
    }

    public double getDiscountedTotal() {
        return this.total * (1 - calculateDiscount());
    }
}

// Customer simply delegates to Order's methods
class Customer {
    public double getOrderDiscount(Order order) {
        return order.calculateDiscount();  // delegation
    }
}
```

### 2.3 Rename

**Purpose**: Replace unclear names with names that convey intent. One of the safest and highest-impact techniques.

**Code Example 4: Rename — Incremental Improvement (TypeScript)**

```typescript
// Before: Meaningless names
class Mgr {
  proc(d: any[]): any[] {
    return d.filter(i => i.s === 1).map(i => ({ ...i, t: Date.now() }));
  }

  chk(v: string): boolean {
    return v.length > 0 && v.length <= 100;
  }

  calc(a: number, b: number, c: number): number {
    return a * b - c;
  }
}


// After: Names that clearly express intent
class ActiveUserProcessor {
  /**
   * Filter active users and attach a processing timestamp.
   */
  filterAndTimestamp(users: User[]): TimestampedUser[] {
    return users
      .filter(user => user.status === UserStatus.ACTIVE)
      .map(user => ({
        ...user,
        processedAt: Date.now(),
      }));
  }

  /**
   * Validate that a display name is within the allowed length.
   */
  isValidDisplayName(name: string): boolean {
    return name.length > 0 && name.length <= 100;
  }

  /**
   * Calculate sales profit: unit price x quantity - discount
   */
  calculateProfit(unitPrice: number, quantity: number, discount: number): number {
    return unitPrice * quantity - discount;
  }
}
```

### 2.4 Replace Conditional with Polymorphism

**Purpose**: Eliminate the Switch Statements smell. Replace type-based branching with method overrides in each subclass.

**Safe procedure**:
1. Create a subclass for each case in the conditional
2. Define an abstract method in the base class
3. Implement the method in each subclass
4. Create a factory method or factory class
5. Replace the original conditional with a polymorphic call
6. Run tests

**Code Example 5: Replace Conditional with Polymorphism (Python)**

```python
# Before: Type-based conditionals scattered across multiple methods
class Employee:
    def __init__(self, employee_type: str, **kwargs):
        self.type = employee_type
        self.salary = kwargs.get('salary', 0)
        self.hourly_rate = kwargs.get('hourly_rate', 0)
        self.hours_worked = kwargs.get('hours_worked', 0)
        self.daily_rate = kwargs.get('daily_rate', 0)
        self.days_worked = kwargs.get('days_worked', 0)

    def calculate_pay(self) -> Decimal:
        if self.type == 'full_time':
            return self.salary
        elif self.type == 'part_time':
            return self.hourly_rate * self.hours_worked
        elif self.type == 'contractor':
            return self.daily_rate * self.days_worked
        elif self.type == 'intern':
            return Decimal("0")  # unpaid intern
        else:
            raise ValueError(f"Unknown type: {self.type}")

    def calculate_benefits(self) -> Decimal:
        if self.type == 'full_time':
            return self.salary * Decimal("0.2")
        elif self.type == 'part_time':
            return self.hourly_rate * self.hours_worked * Decimal("0.05")
        elif self.type == 'contractor':
            return Decimal("0")
        elif self.type == 'intern':
            return Decimal("0")
        else:
            raise ValueError(f"Unknown type: {self.type}")

    def get_title(self) -> str:
        if self.type == 'full_time':
            return "Full-Time"
        elif self.type == 'part_time':
            return "Part-Time"
        elif self.type == 'contractor':
            return "Contractor"
        elif self.type == 'intern':
            return "Intern"
        else:
            return "Unknown"


# After: Each type owns its own behavior via polymorphism
from abc import ABC, abstractmethod
from decimal import Decimal

class Employee(ABC):
    """Base class for employees"""

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def calculate_pay(self) -> Decimal:
        """Calculate pay"""

    @abstractmethod
    def calculate_benefits(self) -> Decimal:
        """Calculate benefits cost"""

    @abstractmethod
    def get_title(self) -> str:
        """Return job title"""

    def total_cost(self) -> Decimal:
        """Total company cost = pay + benefits"""
        return self.calculate_pay() + self.calculate_benefits()


class FullTimeEmployee(Employee):
    def __init__(self, name: str, salary: Decimal):
        super().__init__(name)
        self.salary = salary

    def calculate_pay(self) -> Decimal:
        return self.salary

    def calculate_benefits(self) -> Decimal:
        return self.salary * Decimal("0.2")

    def get_title(self) -> str:
        return "Full-Time"


class PartTimeEmployee(Employee):
    def __init__(self, name: str, hourly_rate: Decimal, hours_worked: int):
        super().__init__(name)
        self.hourly_rate = hourly_rate
        self.hours_worked = hours_worked

    def calculate_pay(self) -> Decimal:
        return self.hourly_rate * self.hours_worked

    def calculate_benefits(self) -> Decimal:
        return self.calculate_pay() * Decimal("0.05")

    def get_title(self) -> str:
        return "Part-Time"


class Contractor(Employee):
    def __init__(self, name: str, daily_rate: Decimal, days_worked: int):
        super().__init__(name)
        self.daily_rate = daily_rate
        self.days_worked = days_worked

    def calculate_pay(self) -> Decimal:
        return self.daily_rate * self.days_worked

    def calculate_benefits(self) -> Decimal:
        return Decimal("0")  # No benefits

    def get_title(self) -> str:
        return "Contractor"


class Intern(Employee):
    def __init__(self, name: str, stipend: Decimal = Decimal("0")):
        super().__init__(name)
        self.stipend = stipend

    def calculate_pay(self) -> Decimal:
        return self.stipend

    def calculate_benefits(self) -> Decimal:
        return Decimal("0")

    def get_title(self) -> str:
        return "Intern"


# Factory function: maintain compatibility with old code
def create_employee(employee_type: str, name: str, **kwargs) -> Employee:
    """Factory that creates an Employee from a type string"""
    factories = {
        'full_time': lambda: FullTimeEmployee(name, Decimal(str(kwargs['salary']))),
        'part_time': lambda: PartTimeEmployee(
            name, Decimal(str(kwargs['hourly_rate'])), kwargs['hours_worked']),
        'contractor': lambda: Contractor(
            name, Decimal(str(kwargs['daily_rate'])), kwargs['days_worked']),
        'intern': lambda: Intern(name, Decimal(str(kwargs.get('stipend', 0)))),
    }
    factory = factories.get(employee_type)
    if factory is None:
        raise ValueError(f"Unknown employee type: {employee_type}")
    return factory()
```

### 2.5 Introduce Parameter Object

**Purpose**: Eliminate Data Clumps (repeated groups of the same parameters) and Long Parameter Lists.

**Code Example 6: Introduce Parameter Object (TypeScript)**

```typescript
// Before: A cluster of related parameters repeating across functions
function searchProducts(
  query: string,
  minPrice: number,
  maxPrice: number,
  category: string,
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  page: number,
  pageSize: number
): Product[] { /* ... */ }

function countProducts(
  query: string,
  minPrice: number,
  maxPrice: number,
  category: string
): number { /* ... */ }

function exportProducts(
  query: string,
  minPrice: number,
  maxPrice: number,
  category: string,
  format: 'csv' | 'json'
): Buffer { /* ... */ }


// After: Consolidated into parameter objects
interface ProductSearchCriteria {
  query: string;
  priceRange: PriceRange;
  category: string;
}

class PriceRange {
  constructor(
    readonly min: number,
    readonly max: number
  ) {
    if (min < 0) throw new Error("Minimum price must be 0 or greater");
    if (max < min) throw new Error("Maximum price must be greater than or equal to minimum");
  }

  contains(price: number): boolean {
    return this.min <= price && price <= this.max;
  }

  static unbounded(): PriceRange {
    return new PriceRange(0, Number.MAX_SAFE_INTEGER);
  }
}

interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

interface Pagination {
  page: number;
  pageSize: number;

  get offset(): number;
  get limit(): number;
}

function searchProducts(
  criteria: ProductSearchCriteria,
  sort: SortOptions,
  pagination: Pagination
): Product[] { /* ... */ }

function countProducts(criteria: ProductSearchCriteria): number { /* ... */ }

function exportProducts(
  criteria: ProductSearchCriteria,
  format: 'csv' | 'json'
): Buffer { /* ... */ }
```

### 2.6 Inline Method

**Purpose**: Remove unnecessary indirection. Apply when the method body is as clear as its name. The inverse of Extract Method.

**Code Example 7: Inline Method (Python)**

```python
# Before: Overly fragmented methods
class OrderValidator:
    def validate(self, order):
        if not self._has_items(order):
            raise ValidationError("No items")
        if not self._has_customer(order):
            raise ValidationError("No customer")
        if not self._is_positive_total(order):
            raise ValidationError("Invalid total")

    def _has_items(self, order) -> bool:
        return len(order.items) > 0        # Method name and body mean the same thing

    def _has_customer(self, order) -> bool:
        return order.customer is not None   # Method name and body mean the same thing

    def _is_positive_total(self, order) -> bool:
        return order.total > 0             # Method name and body mean the same thing


# After: Remove unnecessary indirection
class OrderValidator:
    def validate(self, order):
        """Basic order validation"""
        if not order.items:
            raise ValidationError("No items have been selected")
        if order.customer is None:
            raise ValidationError("No customer information")
        if order.total <= 0:
            raise ValidationError("Total amount is invalid")

# ★ Criteria for inlining:
#   - The method body is as clear as its name
#   - The method is only called from one place
#   - The method is pure delegation with no additional logic
```

### 2.7 Extract Class

**Purpose**: Split a God Class by responsibility. Apply when a class has two or more clearly distinct responsibilities.

**Code Example 8: Extract Class (Python)**

```python
# Before: The User class holds both authentication and address responsibilities
class User:
    def __init__(self, name, email, password_hash,
                 street, city, zip_code, country,
                 login_attempts, last_login, is_locked):
        self.name = name
        self.email = email
        self.password_hash = password_hash
        self.street = street
        self.city = city
        self.zip_code = zip_code
        self.country = country
        self.login_attempts = login_attempts
        self.last_login = last_login
        self.is_locked = is_locked

    def verify_password(self, password):
        return bcrypt.checkpw(password.encode(), self.password_hash)

    def record_login_attempt(self, success: bool):
        if success:
            self.login_attempts = 0
            self.last_login = datetime.now()
        else:
            self.login_attempts += 1
            if self.login_attempts >= 5:
                self.is_locked = True

    def format_address(self) -> str:
        return f"{self.zip_code} {self.city} {self.street}"

    def is_domestic(self) -> bool:
        return self.country == "US"

    def calculate_shipping(self) -> Decimal:
        if self.is_domestic():
            return Decimal("5.00")
        return Decimal("20.00")


# After: Separate classes by responsibility
@dataclass(frozen=True)
class Address:
    """Address — value object"""
    street: str
    city: str
    zip_code: str
    country: str

    def format(self) -> str:
        return f"{self.zip_code} {self.city} {self.street}"

    def is_domestic(self) -> bool:
        return self.country == "US"

    def calculate_shipping(self) -> Decimal:
        return Decimal("5.00") if self.is_domestic() else Decimal("20.00")


class LoginSecurity:
    """Authentication security — manages login attempts"""
    MAX_ATTEMPTS = 5

    def __init__(self, password_hash: bytes):
        self._password_hash = password_hash
        self._login_attempts = 0
        self._last_login: datetime | None = None
        self._is_locked = False

    def verify_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode(), self._password_hash)

    def record_attempt(self, success: bool) -> None:
        if success:
            self._login_attempts = 0
            self._last_login = datetime.now()
        else:
            self._login_attempts += 1
            if self._login_attempts >= self.MAX_ATTEMPTS:
                self._is_locked = True

    @property
    def is_locked(self) -> bool:
        return self._is_locked


class User:
    """User — combines address and authentication"""
    def __init__(self, name: str, email: str,
                 address: Address, security: LoginSecurity):
        self.name = name
        self.email = email
        self.address = address
        self.security = security
```

### 2.8 Replace Temp with Query

**Purpose**: Replace temporary variables with query methods. Makes computed results available to other methods as well.

**Code Example 9: Replace Temp with Query (Python)**

```python
# Before: Holding intermediate results in temporary variables
class ShoppingCart:
    def checkout_summary(self) -> str:
        subtotal = sum(item.price * item.quantity for item in self.items)
        discount = subtotal * Decimal("0.1") if subtotal > 10000 else Decimal("0")
        tax = (subtotal - discount) * Decimal("0.10")
        total = subtotal - discount + tax

        return (f"Subtotal: {subtotal}, Discount: {discount}, "
                f"Tax: {tax}, Total: {total}")


# After: Convert temporary variables to methods
class ShoppingCart:
    @property
    def subtotal(self) -> Decimal:
        """Item total"""
        return sum(item.price * item.quantity for item in self.items)

    @property
    def discount(self) -> Decimal:
        """Discount amount: 10% off for orders over 10,000"""
        return self.subtotal * Decimal("0.1") if self.subtotal > 10000 else Decimal("0")

    @property
    def tax(self) -> Decimal:
        """Consumption tax"""
        return (self.subtotal - self.discount) * Decimal("0.10")

    @property
    def total(self) -> Decimal:
        """Total payable"""
        return self.subtotal - self.discount + self.tax

    def checkout_summary(self) -> str:
        return (f"Subtotal: {self.subtotal}, Discount: {self.discount}, "
                f"Tax: {self.tax}, Total: {self.total}")

    # ★ self.total and others are now reusable from other methods
    def can_apply_coupon(self, min_amount: Decimal) -> bool:
        return self.subtotal >= min_amount
```

### 2.9 Decompose Conditional

**Purpose**: Break down complex conditional expressions into methods with clear intent.

**Code Example 10: Decompose Conditional (Python)**

```python
# Before: Complex conditional expressions
def calculate_charge(date: date, quantity: int, rate: Decimal) -> Decimal:
    if (date.month >= 6 and date.month <= 9) or \
       (date.weekday() >= 5) or \
       (date in get_holidays(date.year)):
        # Peak season / weekend / holiday rate
        charge = quantity * rate * Decimal("1.5")
        if quantity > 100:
            charge *= Decimal("0.9")
    else:
        # Regular rate
        charge = quantity * rate
        if quantity > 200:
            charge *= Decimal("0.95")
    return charge


# After: Decompose the condition and each branch into methods with clear intent
def calculate_charge(date: date, quantity: int, rate: Decimal) -> Decimal:
    if is_peak_season(date):
        return calculate_peak_charge(quantity, rate)
    return calculate_regular_charge(quantity, rate)

def is_peak_season(date: date) -> bool:
    """Peak season: summer, weekend, or holiday"""
    return is_summer(date) or is_weekend(date) or is_holiday(date)

def is_summer(date: date) -> bool:
    return 6 <= date.month <= 9

def is_weekend(date: date) -> bool:
    return date.weekday() >= 5

def is_holiday(date: date) -> bool:
    return date in get_holidays(date.year)

def calculate_peak_charge(quantity: int, rate: Decimal) -> Decimal:
    """Peak season rate: 1.5x, 10% discount for over 100 units"""
    charge = quantity * rate * Decimal("1.5")
    if quantity > 100:
        charge *= Decimal("0.9")
    return charge

def calculate_regular_charge(quantity: int, rate: Decimal) -> Decimal:
    """Regular rate: 5% discount for over 200 units"""
    charge = quantity * rate
    if quantity > 200:
        charge *= Decimal("0.95")
    return charge
```

### 2.10 Pull Up Method / Push Down Method

**Purpose**: Move methods to the appropriate level within an inheritance hierarchy. Used to eliminate duplicate code or isolate specialized logic.

**Code Example 11: Pull Up Method (Java)**

```java
// Before: The same method duplicated across multiple subclasses
class SavingsAccount extends Account {
    public double calculateInterest() {
        return this.balance * this.interestRate / 12;  // duplicate
    }
}

class CheckingAccount extends Account {
    public double calculateInterest() {
        return this.balance * this.interestRate / 12;  // duplicate
    }
}

class MoneyMarketAccount extends Account {
    public double calculateInterest() {
        return this.balance * this.interestRate / 12;  // duplicate
    }
}


// After: Pull the common method up to the parent class
abstract class Account {
    protected double balance;
    protected double interestRate;

    // Pull Up: move common calculation to parent class
    public double calculateInterest() {
        return this.balance * this.interestRate / 12;
    }
}

// Only subclasses that need special logic override it
class HighYieldAccount extends Account {
    @Override
    public double calculateInterest() {
        // Special logic: tiered interest rate
        if (this.balance > 1_000_000) {
            return this.balance * (this.interestRate * 1.5) / 12;
        }
        return super.calculateInterest();
    }
}
```

---

## 3. IDE-Assisted Refactoring

### 3.1 Comparison of IDE Automated Refactoring Features

| Technique | IntelliJ IDEA | VS Code | PyCharm | Eclipse |
|------|:------------:|:-------:|:-------:|:-------:|
| Extract Method | Ctrl+Alt+M | Ctrl+Shift+R | Ctrl+Alt+M | Alt+Shift+M |
| Rename | Shift+F6 | F2 | Shift+F6 | Alt+Shift+R |
| Move | F6 | — | F6 | Alt+Shift+V |
| Inline | Ctrl+Alt+N | — | Ctrl+Alt+N | Alt+Shift+I |
| Extract Variable | Ctrl+Alt+V | — | Ctrl+Alt+V | Alt+Shift+L |
| Extract Parameter | Ctrl+Alt+P | — | Ctrl+Alt+P | — |
| Change Signature | Ctrl+F6 | — | Ctrl+F6 | Alt+Shift+C |
| Safe Delete | Alt+Del | — | Alt+Del | — |

### 3.2 How to Use IDE Refactoring

```
  Refactoring procedure in IntelliJ IDEA / PyCharm

  1. Extract Method:
     a. Select the code block to extract
     b. Ctrl+Alt+M (Mac: Cmd+Option+M)
     c. Enter the method name
     d. Review parameters and return value
     e. Press Enter to confirm
     → IDE automatically handles variable passing

  2. Rename:
     a. Place cursor on the symbol to change
     b. Shift+F6
     c. Enter the new name
     d. Press Enter to confirm
     → All references (including tests) are automatically updated

  3. Move:
     a. Place cursor on the method/class to move
     b. F6
     c. Select the destination class/package
     d. Press Enter to confirm
     → Import statements are also adjusted automatically

  ★ IDE automated refactoring updates all references with
    "compiler-level accuracy" — safer than manual changes.
```

---

## 4. Technique Selection Guide

### 4.1 Flowchart from Smell to Technique

```
  Selection flow from code smell to refactoring technique

  Smell detected
      |
      v
  Long method? ──Yes──> Extract Method
      |
      No
      v
  Method in wrong ──Yes──> Move Method
  class?
      |
      No
      v
  Same parameters ──Yes──> Introduce Parameter Object
  repeating?                   or Extract Class
      |
      No
      v
  Type-based ──Yes──> Replace Conditional
  conditionals?                with Polymorphism
      |
      No
      v
  Unclear names? ──Yes──> Rename
      |
      No
      v
  Unnecessary ──Yes──> Inline Method
  indirection?
      |
      No
      v
  Class too large? ──Yes──> Extract Class
      |
      No
      v
  Complex ──Yes──> Decompose Conditional
  conditionals?
      |
      No
      v
  Too many ──Yes──> Replace Temp with Query
  temp variables?
```

### 4.2 Technique Selection Comparison Table

| Smell | Primary Technique | Alternative | Effect |
|--------|------------|---------|------|
| Long Method | Extract Method | Decompose Conditional | Improved readability, reusability |
| Feature Envy | Move Method/Field | Extract Class | Improved cohesion |
| Data Clumps | Introduce Parameter Object | Extract Class | Reduced parameter count |
| Switch Statements | Replace Conditional with Polymorphism | Strategy pattern | Improved extensibility (OCP) |
| Unclear names | Rename | — | Improved readability |
| Duplicate code | Extract Method + Pull Up Method | Template Method pattern | DRY compliance |
| God Class | Extract Class | Facade pattern | SRP achieved |
| Unnecessary indirection | Inline Method | Inline Class | Simplification |
| Shotgun Surgery | Move Method + Inline Class | — | Localized changes |
| Complex conditionals | Decompose Conditional | Replace Conditional with Polymorphism | Improved readability |

### 4.3 Safety Levels of Refactoring Techniques

| Safety | Technique | Reason |
|:------:|------|------|
| High | Rename | IDE auto-updates all references. Does not change meaning |
| High | Extract Method | Changes structure only without changing behavior. IDE-supported |
| High | Inline Method | Inverse of Extract Method. IDE-supported |
| Medium | Move Method | Requires updating callers. IDE automates most of it |
| Medium | Replace Temp with Query | Be careful if side effects are present |
| Medium | Introduce Parameter Object | Changes to callers can be widespread |
| Medium | Extract Class | Requires organizing dependencies |
| Low | Replace Conditional with Polymorphism | Major design change. Thorough tests are essential |
| Low | Pull Up / Push Down | Changes inheritance hierarchy. Tests may need restructuring |

---

## 5. Practical Refactoring Workflow

### 5.1 Micro-Refactoring Session (15 minutes)

**Code Example 12: Actual Refactoring Steps (with Git operations)**

```bash
# Step 1: Check current test status
$ pytest tests/ -q
42 passed in 3.2s

# Step 2: Stash any work in progress before starting refactoring
$ git stash  # stash in-progress changes (if any)

# Step 3: Apply Extract Method
# (Select code in IDE → Ctrl+Alt+M → Enter method name)

# Step 4: Run tests
$ pytest tests/ -q
42 passed in 3.1s  # OK: test count is unchanged

# Step 5: Commit
$ git add -p  # stage changes while reviewing them
$ git commit -m "refactor: extract _calculate_discount from process_order"

# Step 6: Next change (Rename)
# (Place cursor on symbol in IDE → Shift+F6 → Enter new name)

# Step 7: Run tests
$ pytest tests/ -q
42 passed in 3.1s  # OK

# Step 8: Commit
$ git commit -am "refactor: rename 'calc' to 'calculate_monthly_revenue'"

# Step 9: Next change (Move Method)...
# Repeat the same cycle from here
```

### 5.2 Commit Message Conventions for Refactoring

```
  Recommended commit message format

  refactor: <technique name> <target> from <original location>

  Examples:
  refactor: extract calculate_discount from process_order
  refactor: move format_address from User to Address
  refactor: rename 'proc' to 'process_payment'
  refactor: replace conditional with polymorphism in Employee
  refactor: inline get_is_valid into validate
  refactor: introduce OrderCriteria parameter object

  ★ The "refactor:" prefix clearly distinguishes from feature changes
  ★ Run git log --grep="refactor:" to list refactoring history
```

---

## 6. Anti-Patterns

### Anti-Pattern 1: Refactoring Without Tests

```
  BAD: Changing structure without tests

  "I don't like the structure of this code"
    → Start refactoring without writing tests
    → "Looks like it works"
    → Bug found in production a week later
    → No idea which change caused the bug
    → Takes days to debug

  GOOD: Establish a safety net with tests before refactoring

  1. Write tests first (or verify existing ones)
  2. Confirm tests are GREEN
  3. Apply one small change
  4. Confirm tests are GREEN
  5. Commit
  6. Move to the next change

  ★ If there are no tests, first write Characterization Tests
  → See [Legacy Code](./02-legacy-code.md) for details
```

### Anti-Pattern 2: Big Bang Refactoring

```
  BAD: "Let's rewrite everything at once!"

  "I'll refactor this entire module over the weekend"
    → 500 lines of diff in one PR
    → Reviewers cannot understand it
    → Merge conflicts everywhere
    → When tests break, hard to identify the cause
    → End up reverting

  GOOD: Incremental migration using the Strangler Fig pattern

  PR #1: [Extract Class] Separate Address from User (diff: 40 lines)
  PR #2: [Move Method] Move format_address to Address (diff: 20 lines)
  PR #3: [Rename] User.addr to User.address (diff: 15 lines)
  PR #4: [Inline] Remove now-unnecessary User.get_city (diff: 10 lines)

  Each PR:
  - Less than 300 lines of diff
  - A reviewable size
  - Tests always pass
  - Can be merged/reverted independently
```

### Anti-Pattern 3: Mixing Refactoring with Feature Addition

```
  BAD: "While I'm here, let me add a feature too"

  Commit message: "refactor user service and add email verification"
    → Structural changes and feature additions are mixed together
    → When a bug appears, unclear if it's from refactoring or new feature
    → Reverting also loses the new feature

  GOOD: Separate the two hats

  Phase 1: Refactoring
    PR: "refactor: extract EmailValidator from UserService"
    → Do not change tests (because behavior hasn't changed)

  Phase 2: Feature addition
    PR: "feat: add email verification on registration"
    → Add tests (because it's new behavior)

  ★ Strictly follow Martin Fowler's "Two Hats" principle
```

### Anti-Pattern 4: Over-Abstracting Refactoring

```
  BAD: "Let's abstract for future extensibility"

  class Serializer(ABC): ...
  class JsonSerializer(Serializer): ...    # ← only implementation
  class SerializerFactory: ...             # ← only one pattern
  class SerializerStrategy: ...            # ← unnecessary intermediate layer

  → 3 classes and 2 interfaces exist for a single JSON conversion
  → "Abstraction hell": following the code requires jumping across 5 files

  GOOD: Don't abstract until you need to (YAGNI)

  class JsonSerializer:
      def serialize(self, data): ...
      def deserialize(self, text): ...

  → Introduce the abstraction when XML is actually needed
  → "Rule of Three": wait until the pattern appears a third time
```

---

## 7. Exercises

### Exercise 1 (Basic): Applying Extract Method

Extract appropriate methods from the following code to improve readability.

```python
# Problem code
def process_user_registration(data: dict) -> dict:
    # Validation
    errors = []
    if not data.get('name') or len(data['name']) < 2:
        errors.append("Name must be at least 2 characters")
    if not data.get('email') or '@' not in data['email']:
        errors.append("A valid email address is required")
    if not data.get('password') or len(data['password']) < 8:
        errors.append("Password must be at least 8 characters")
    if data.get('password') and not any(c.isupper() for c in data['password']):
        errors.append("Password must contain at least one uppercase letter")
    if data.get('password') and not any(c.isdigit() for c in data['password']):
        errors.append("Password must contain at least one digit")
    if errors:
        return {"success": False, "errors": errors}

    # Create user
    import hashlib
    salt = os.urandom(32)
    password_hash = hashlib.pbkdf2_hmac(
        'sha256', data['password'].encode(), salt, 100000
    )
    user = {
        "name": data['name'].strip(),
        "email": data['email'].lower().strip(),
        "password_hash": password_hash,
        "salt": salt,
        "created_at": datetime.now().isoformat(),
    }

    # Save to DB
    db.execute("INSERT INTO users ...", user)

    # Send welcome email
    email_body = f"""
    Dear {user['name']},
    Thank you for registering.
    """
    send_email(user['email'], "Welcome", email_body)

    return {"success": True, "user_id": user.get('id')}
```

**Expected answer**: Split into 4 methods: `validate_registration`, `create_user_record`, `save_user`, `send_welcome_email`. The main method only calls each method.

---

### Exercise 2 (Intermediate): Move Method + Replace Conditional

Eliminate Feature Envy and Switch Statements from the following code.

```python
class ShippingCalculator:
    def calculate(self, order) -> Decimal:
        # Feature Envy: excessively depends on order's internal data
        weight = sum(item.weight * item.quantity for item in order.items)
        destination = order.customer.address.country

        # Switch Statements: branching by shipping method
        if order.shipping_method == "standard":
            if destination == "US":
                return Decimal("5.00") if weight < 5 else Decimal("10.00")
            else:
                return Decimal("20.00") if weight < 5 else Decimal("40.00")
        elif order.shipping_method == "express":
            if destination == "US":
                return Decimal("12.00") if weight < 5 else Decimal("20.00")
            else:
                return Decimal("50.00") if weight < 5 else Decimal("80.00")
        elif order.shipping_method == "overnight":
            if destination == "US":
                return Decimal("25.00")
            else:
                return Decimal("100.00")
```

**Expected answer**: (1) Add `Order.total_weight()` method, (2) Create `ShippingMethod` base class + `StandardShipping`, `ExpressShipping`, `OvernightShipping` subclasses, (3) Implement `calculate(weight, destination)` method in each subclass.

---

### Exercise 3 (Advanced): Refactoring Plan for Legacy Code

Design a safe test → refactor → test cycle for the following code. Include commit messages for each step.

```python
class ReportEngine:
    """Monolithic report generation engine, 500 lines"""
    def generate(self, report_type, data, format_type,
                 start_date, end_date, filters, sort_by,
                 include_charts, email_to, save_path):
        # Step 1: Data filtering (50 lines)
        # Step 2: Aggregate calculations (80 lines)
        # Step 3: Chart generation (60 lines, only if include_charts)
        # Step 4: Format conversion (100 lines, branching by format_type)
        # Step 5: Send email (30 lines, only if email_to)
        # Step 6: Save file (30 lines, only if save_path)
        ...
```

**Expected answer (overview)**:

```
Refactoring plan (10 PRs, estimated 3 sprints):

PR #1: test: add characterization tests for ReportEngine
  - Add tests that record existing behavior
  Commit: "test: add characterization tests for generate()"

PR #2: refactor: introduce ReportRequest parameter object
  - Consolidate 11 parameters into ReportRequest
  Commit: "refactor: introduce ReportRequest parameter object"

PR #3: refactor: extract _filter_data from generate
  Commit: "refactor: extract _filter_data from generate"

PR #4: refactor: extract _calculate_aggregates from generate
  Commit: "refactor: extract _calculate_aggregates from generate"

PR #5: refactor: extract ChartGenerator class
  Commit: "refactor: extract ChartGenerator from ReportEngine"

PR #6: refactor: replace format_type conditional with polymorphism
  - ReportFormatter base + HtmlFormatter, PdfFormatter, CsvFormatter
  Commit: "refactor: replace conditional with polymorphism for formatters"

PR #7: refactor: extract EmailNotifier class
  Commit: "refactor: extract EmailNotifier from ReportEngine"

PR #8: refactor: extract FileExporter class
  Commit: "refactor: extract FileExporter from ReportEngine"

PR #9: refactor: convert ReportEngine to orchestrator
  - generate() only calls each component
  Commit: "refactor: simplify ReportEngine to orchestrator"

PR #10: refactor: rename and cleanup
  Commit: "refactor: final cleanup and documentation"
```

---

## 8. FAQ

### Q1: When is the best time to refactor?

**Rule of Three**: Refactor when the same pattern appears 3 times. The following timing is also effective:
- **Before adding features**: As preparation to make changes easier ("tidy the garden before planting seeds")
- **After fixing bugs**: To resolve underlying design problems ("reinforce the wall after patching the hole")
- **During code review**: As a response to review feedback
- **For understanding**: Improve structure while reading code, deepening comprehension

### Q2: How do you measure the results of refactoring?

Quantitative metrics:
- **Decrease in cyclomatic complexity**: Measured with `radon cc`
- **Increase in test coverage**: Measured with `pytest --cov`
- **Decrease in code duplication**: Measured with `jscpd`
- **Reduction in time required for changes**: Measured with DORA metrics Lead Time
- **Reduction in pull request size**: Average diff lines per PR
- **Decrease in bug occurrence rate**: Bug reports per change

### Q3: How do you explain the need for refactoring to management?

Avoid the word "refactoring" and instead say:
- "Structural improvements to maintain the speed of adding new features"
- "Preventive maintenance to reduce bug occurrence rates"
- "Investment in development team productivity"

Back it up with numbers: bug rate per change, trends in time to add features. Show a concrete ROI like "Changes to this module currently take an average of 3 days; refactoring is expected to reduce this to 1 day."

### Q4: What should you do if you find a bug during refactoring?

**Do not mix refactoring with bug fixing.** Follow this procedure:

1. Commit the current refactoring changes (or stash them)
2. Create a branch for the bug fix
3. Fix the bug and add a test
4. Commit and merge the bug fix
5. Return to the refactoring branch and merge in the bug fix
6. Resume refactoring

### Q5: How do you proceed with large-scale refactoring?

Apply the **Strangler Fig pattern**:
1. Place a **Facade** between the old code and the new code
2. Add new code **with tests**
3. Gradually switch the Facade's routing to the new code
4. Delete the old code when it is no longer needed

See the Strangler Fig pattern chapter in [Legacy Code](./02-legacy-code.md) for details.

### Q6: What is the difference between refactoring and performance optimization?

| Aspect | Refactoring | Performance Optimization |
|------|--------------|-----------------|
| Purpose | Improve readability and maintainability | Improve execution speed and resource efficiency |
| Behavior | Does not change | Does not change (in theory) |
| Readability | Improves | May decrease |
| Timing | While understanding the code | Based on profiling results |
| Priority | Refactor first | Then optimize performance |

Donald Knuth's famous quote: "Premature optimization is the root of all evil." First write readable code, then identify bottlenecks with profiling before optimizing.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend fully understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional work?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architectural design.

---

## 9. Summary

| Technique | Purpose | Safety | IDE Support |
|------|------|:------:|:------:|
| Extract Method | Split long functions | High | Yes |
| Move Method | Move responsibility (resolve Feature Envy) | Medium | Yes |
| Rename | Improve names | High | Yes |
| Replace Conditional with Polymorphism | Eliminate branching | Low | Partial |
| Introduce Parameter Object | Organize arguments | Medium | Partial |
| Inline Method | Remove unnecessary indirection | High | Yes |
| Extract Class | Split God Class | Medium | Partial |
| Replace Temp with Query | Eliminate temp variables | Medium | No |
| Decompose Conditional | Decompose conditionals | High | No |
| Pull Up / Push Down | Organize inheritance hierarchy | Low | Yes |

| Principle | Content |
|------|------|
| Behavior invariance | Do not change externally visible behavior |
| Tests first | Do not refactor unless tests are GREEN |
| Small steps | One change = one type of improvement |
| Frequent commits | Always be able to return to the last safe state |
| Two hats | Do not refactor and add features simultaneously |
| Rule of Three | Refactor when a pattern appears for the third time |

---

## What to Read Next

- [Code Smells](./00-code-smells.md) — Smell classification that triggers refactoring
- [Legacy Code](./02-legacy-code.md) — Refactoring code without tests (Seam, Characterization Test)
- [Technical Debt](./03-technical-debt.md) — Quantifying the ROI of refactoring
- [Continuous Improvement](./04-continuous-improvement.md) — Integrating refactoring into daily CI/CD
- [Testing Principles](../01-practices/04-testing-principles.md) — Test design as a safety net for refactoring
- Design Patterns Overview — Applying patterns to resolve smells
- Function Design — Function design guidelines after Extract Method

---

## References

1. **Martin Fowler** *Refactoring: Improving the Design of Existing Code*, Addison-Wesley, 2018 (2nd Edition) — The definitive work on refactoring. Catalogs 60+ techniques. Based on JavaScript code examples, a major overhaul from the 1st edition (1999, Java).
2. **Joshua Kerievsky** *Refactoring to Patterns*, Addison-Wesley, 2004 — Bridges refactoring and design patterns. Shows step-by-step transformation procedures from smells to patterns.
3. **Michael Feathers** *Working Effectively with Legacy Code*, Prentice Hall, 2004 — Safe refactoring techniques for code without tests. The origin of Seams, Extract & Override, and Characterization Tests.
4. **Kent Beck** *Implementation Patterns*, Addison-Wesley, 2007 — Design decisions at the code level. Systematizes patterns for naming, method decomposition, and state management.
5. **Sandi Metz** *99 Bottles of OOP* (2nd Edition, 2018) — A practical example of incrementally refactoring toward polymorphism. Ideal for internalizing the Open-Closed Principle.
