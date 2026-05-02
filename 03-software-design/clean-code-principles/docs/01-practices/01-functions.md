# Function Design ── Single Responsibility, Arguments, and Side Effects

> Functions are the fundamental building blocks of programs. Small functions that do one thing and communicate intent through their names determine the readability and maintainability of the entire system.

---

## What You Will Learn

1. **Single Responsibility of Functions** ── Understand how to design functions that do exactly one thing
2. **Principles of Argument Design** ── Learn how to optimize the number, order, and types of arguments
3. **Managing Side Effects** ── Master techniques for writing predictable and safe functions
4. **Unified Abstraction Levels** ── Understand how to keep all operations within a function at the same level of abstraction
5. **Command/Query Separation** ── Learn the CQS principle and how to apply it in practice

---

## Prerequisites

To get the most out of this guide, the following knowledge is required.

| Prerequisite | Required Level | Reference |
|---------|----------|--------|
| Naming conventions | Recommended to read first | [Naming Conventions](./00-naming.md) |
| SOLID principles (especially SRP) | Understand the basics | [SOLID Principles](../00-principles/01-solid.md) |
| Overview of clean code | Recommended to read first | [Clean Code Overview](../00-principles/00-clean-code-overview.md) |

---

## 1. Basic Principles of Functions

### 1.1 Five Conditions for a Good Function

```
+-----------------------------------------------------------+
|  Five Conditions for a Good Function                      |
|  ─────────────────────────────────────                    |
|  1. Small             → Aim for 20 lines or fewer         |
|  2. Do One Thing      → Keep abstraction levels uniform   |
|  3. No Hidden Side Effects (explicit if any)              |
|  4. Few Arguments     → Ideally 0-2                       |
|  5. Command/Query Separation (CQS) → Either mutate        |
|     or query, not both                                    |
+-----------------------------------------------------------+
```

### 1.2 Why Functions Should Be Small

```
  Relationship Between Function Size and Cognitive Load

  Cognitive Load
    ^
    |                              /
    |                          /
    |                      /
    |                  /
    |             __/
    |         __/
    |     __/
    |  __/
    +──────────────────────────→ Lines of code
    0    10    20    50   100   200+

  · ~10 lines: Understandable at a glance. Easy to test
  · ~20 lines: Acceptable. No scrolling needed
  · ~50 lines: Yellow flag. Consider splitting
  · 100+ lines: Red flag. Split without fail
  · 200+ lines: Emergency. God Function
```

| Metric | Target | Action When Exceeded |
|-----------|------|-----------------|
| Lines of code | 20 or fewer | Extract Method |
| Number of arguments | 2 or fewer | Introduce Parameter Object |
| Nesting depth | 2 levels or fewer | Guard clauses, early return |
| Cyclomatic complexity | 5 or fewer | Separate conditional branches |
| Cognitive complexity | 15 or fewer | Extract complex logic into functions |

### 1.3 Unified Abstraction Levels

```
  Consistency of Abstraction Levels

  High abstraction ┌──────────────────────────────────┐
  level            │ processOrder()                    │
                   │   ├── validateOrder()             │
                   │   ├── calculateTotal()            │
                   │   ├── chargePayment()             │
                   │   └── sendConfirmation()          │
                   └──────────────────────────────────┘
  Low abstraction  ┌──────────────────────────────────┐
  level            │ calculateTotal()                  │
                   │   ├── subtotal = sum(prices)      │
                   │   ├── tax = subtotal * rate       │
                   │   └── return subtotal + tax       │
                   └──────────────────────────────────┘
  * Do not mix abstraction levels within a single function
```

**Code Example 1: Unified Abstraction Levels**

```python
# === Bad: Mixed abstraction levels ===
def process_order(order):
    # High level: validation
    if not order.is_valid():
        raise InvalidOrderError()

    # Low level: manual total calculation (details mixed in)
    total = 0
    for item in order.items:
        price = item.unit_price * item.quantity
        if item.discount_code:
            discount = db.query(
                "SELECT rate FROM discounts WHERE code = %s",
                item.discount_code
            )
            if discount:
                price *= (1 - discount[0].rate)
        total += price
    tax = total * 0.10
    total_with_tax = total + tax

    # High level: payment
    charge_payment(order.customer, total_with_tax)

# Problems:
# · Validation (high level) is mixed with calculation details (low level)
# · DB calls (low level) are embedded inline
# · Difficult to test (DB dependency exists inline)


# === Good: Each function at the same abstraction level ===
def process_order(order: Order) -> OrderResult:
    """Process an order (high level)"""
    validate_order(order)
    total = calculate_total(order.items)
    payment_result = charge_payment(order.customer, total)
    return create_order_result(order, payment_result)

def calculate_total(items: list[OrderItem]) -> Money:
    """Calculate order total (mid level)"""
    subtotal = sum(calculate_item_price(item) for item in items)
    tax = calculate_tax(subtotal)
    return subtotal + tax

def calculate_item_price(item: OrderItem) -> Money:
    """Calculate price for an individual item (low level)"""
    base_price = item.unit_price * item.quantity
    discount = get_discount_rate(item.discount_code)
    return base_price * (1 - discount)

# Each function:
# · Operates at a single abstraction level
# · Can be tested independently
# · Intent is clear from the name
```

**Code Example 2: The Stepdown Rule (Newspaper Style)**

```python
# Like a newspaper article: overview → details → further details

# === 1. Top level (article headline) ===
def deploy_application(config: DeployConfig) -> DeployResult:
    """Deploy the application"""
    validate_config(config)
    build_artifacts = build_application(config)
    test_results = run_tests(build_artifacts)
    ensure_tests_passed(test_results)
    return deploy_to_target(build_artifacts, config.target)

# === 2. Mid level (article paragraphs) ===
def build_application(config: DeployConfig) -> BuildArtifacts:
    """Build the application"""
    source = checkout_source(config.repository, config.branch)
    dependencies = install_dependencies(source)
    return compile_and_package(source, dependencies)

def run_tests(artifacts: BuildArtifacts) -> TestResults:
    """Run the tests"""
    unit_results = run_unit_tests(artifacts)
    integration_results = run_integration_tests(artifacts)
    return TestResults(unit=unit_results, integration=integration_results)

# === 3. Low level (article details) ===
def checkout_source(repo: str, branch: str) -> SourceCode:
    """Check out the source code"""
    return git.clone(repo, branch=branch)

def install_dependencies(source: SourceCode) -> Dependencies:
    """Install dependency packages"""
    return package_manager.install(source.dependency_file)
```

---

## 2. Argument Design

### 2.1 Number of Arguments

```
  Number of Arguments vs. Understandability

  Understandability
    ^
    |  *****
    |       ****
    |           ***
    |              **
    |                *
    |                 *
    +--+--+--+--+--+--> Number of arguments
       0  1  2  3  4  5+

  0 (niladic)  : Best. Circle.area()
  1 (monadic)  : Good. isValid(email)
  2 (dyadic)   : Acceptable. Point(x, y)
  3 (triadic)  : Reconsider. Use a parameter object
  4+ (polyadic): Refactoring required
```

**Code Example 3: Parameter Object Pattern**

```typescript
// === Bad: Too many arguments ===
function createUser(
  name: string,
  email: string,
  age: number,
  address: string,
  phone: string,
  role: string,
  department: string
): User {
  // ...
}

// Easy to get the argument order wrong
createUser("Tanaka", "tanaka@example.com", 30, "Tokyo...", "090-...", "admin", "Engineering");

// === Good: Structured with a parameter object ===
interface CreateUserRequest {
  name: string;
  email: string;
  age: number;
  address: string;
  phone: string;
  role: UserRole;
  department: string;
}

function createUser(request: CreateUserRequest): User {
  // ...
}

// Intent is clear with named fields
createUser({
  name: "Tanaka",
  email: "tanaka@example.com",
  age: 30,
  address: "Tokyo...",
  phone: "090-...",
  role: UserRole.ADMIN,
  department: "Engineering"
});
```

**Code Example 4: Eliminating Flag Arguments**

```python
# === Bad: Boolean argument switches behavior (sign of SRP violation) ===
def create_report(data, is_pdf: bool):
    if is_pdf:
        return generate_pdf_report(data)
    else:
        return generate_html_report(data)

# Caller: create_report(data, True) ← it's unclear what True means

# === Good: Split into separate functions ===
def create_pdf_report(data: ReportData) -> bytes:
    return generate_pdf(data)

def create_html_report(data: ReportData) -> str:
    return generate_html(data)

# === Even better: Use the Strategy pattern for extensibility ===
class ReportGenerator(Protocol):
    def generate(self, data: ReportData) -> Report: ...

class PdfReportGenerator:
    def generate(self, data: ReportData) -> PdfReport:
        # PDF generation logic
        pass

class HtmlReportGenerator:
    def generate(self, data: ReportData) -> HtmlReport:
        # HTML generation logic
        pass

# Usage
generator = PdfReportGenerator()  # or HtmlReportGenerator()
report = generator.generate(data)
```

**Code Example 5: Builder Pattern for Complex Construction**

```python
# === When there are many arguments: Builder pattern ===

class QueryBuilder:
    """Incrementally build a complex query"""
    def __init__(self, table: str):
        self._table = table
        self._conditions: list[str] = []
        self._order_by: str | None = None
        self._limit: int | None = None
        self._offset: int | None = None
        self._columns: list[str] = ['*']

    def select(self, *columns: str) -> 'QueryBuilder':
        self._columns = list(columns)
        return self

    def where(self, condition: str) -> 'QueryBuilder':
        self._conditions.append(condition)
        return self

    def order_by(self, column: str, desc: bool = False) -> 'QueryBuilder':
        direction = 'DESC' if desc else 'ASC'
        self._order_by = f"{column} {direction}"
        return self

    def limit(self, count: int) -> 'QueryBuilder':
        self._limit = count
        return self

    def offset(self, count: int) -> 'QueryBuilder':
        self._offset = count
        return self

    def build(self) -> str:
        columns = ', '.join(self._columns)
        query = f"SELECT {columns} FROM {self._table}"
        if self._conditions:
            query += " WHERE " + " AND ".join(self._conditions)
        if self._order_by:
            query += f" ORDER BY {self._order_by}"
        if self._limit:
            query += f" LIMIT {self._limit}"
        if self._offset:
            query += f" OFFSET {self._offset}"
        return query

# Usage: build incrementally, then call build() at the end
query = (
    QueryBuilder("users")
    .select("name", "email", "age")
    .where("age >= 18")
    .where("is_active = true")
    .order_by("name")
    .limit(50)
    .offset(100)
    .build()
)
```

---

## 3. Managing Side Effects

### 3.1 Eliminating Hidden Side Effects

**Code Example 6: Eliminating Hidden Side Effects**

```java
// === Bad: Has side effects not apparent from the name ===
public boolean checkPassword(String userName, String password) {
    User user = userRepository.findByName(userName);
    if (user == null) return false;

    if (user.getPassword().equals(encrypt(password))) {
        Session.initialize();  // Hidden side effect! Initializes session during a password check
        return true;
    }
    return false;
}
// → The name says "check" but it has the side effect of initializing the session
// → Tests produce unexpected session states


// === Good: Side effects are separated and the name makes intent explicit ===
public boolean isPasswordValid(String userName, String password) {
    // Pure validation only. No side effects
    User user = userRepository.findByName(userName);
    if (user == null) return false;
    return user.getPassword().equals(encrypt(password));
}

public AuthResult authenticateAndCreateSession(String userName, String password) {
    // The name makes the side effect explicit
    if (!isPasswordValid(userName, password)) {
        return AuthResult.failure("Authentication failed");
    }
    Session session = sessionManager.createSession(userName);
    return AuthResult.success(session);
}
```

### 3.2 Separating Pure Functions from Functions with Side Effects

```python
# === Pure functions: always return the same output for the same input. No side effects ===

def calculate_discount(price: float, discount_rate: float) -> float:
    """Apply a discount to a price (pure function)"""
    return price * (1 - discount_rate)

def validate_email(email: str) -> bool:
    """Validate the format of an email address (pure function)"""
    import re
    return bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email))

def format_currency(amount: float, currency: str = 'JPY') -> str:
    """Format a monetary amount (pure function)"""
    if currency == 'JPY':
        return f"¥{amount:,.0f}"
    return f"${amount:,.2f}"

# Characteristics of pure functions:
# · Easy to test (no mocks needed)
# · Safe for concurrent execution
# · Cacheable (memoizable)
# · Easy to reason about


# === Functions with side effects: explicitly separated ===

def save_order(order: Order, repository: OrderRepository) -> None:
    """Save an order (side effect: DB write)"""
    repository.save(order)

def send_notification(user_id: str, message: str, client: NotificationClient) -> None:
    """Send a notification (side effect: external API call)"""
    client.send(user_id, message)

def log_event(event: str, logger: Logger) -> None:
    """Record an event to the log (side effect: file/stream write)"""
    logger.info(event)
```

**Code Example 7: Functional Core and Imperative Shell**

```python
# === Functional Core / Imperative Shell pattern ===
# Separates business logic (pure functions) from external interactions (side effects)

# --- Functional Core: business logic as pure functions ---
class PricingRules:
    """Pricing calculation rules (a collection of pure functions)"""

    @staticmethod
    def calculate_subtotal(items: list[OrderItem]) -> Decimal:
        return sum(item.price * item.quantity for item in items)

    @staticmethod
    def apply_discount(subtotal: Decimal, discount: Discount) -> Decimal:
        if discount.is_percentage:
            return subtotal * (1 - discount.rate)
        return subtotal - discount.amount

    @staticmethod
    def calculate_tax(amount: Decimal, tax_rate: Decimal) -> Decimal:
        return amount * tax_rate

    @staticmethod
    def calculate_shipping(
        total_weight: Decimal,
        is_premium_member: bool
    ) -> Decimal:
        if is_premium_member:
            return Decimal('0')
        base = total_weight * Decimal('10')
        return base if base > Decimal('500') else Decimal('500')


# --- Imperative Shell: external interactions with side effects ---
class OrderService:
    """Order service (imperative shell)"""

    def __init__(
        self,
        order_repo: OrderRepository,
        discount_repo: DiscountRepository,
        notification: NotificationService,
    ):
        self.order_repo = order_repo
        self.discount_repo = discount_repo
        self.notification = notification

    def place_order(self, request: PlaceOrderRequest) -> OrderResult:
        # Side effect: fetch data from DB
        discount = self.discount_repo.find_by_code(request.discount_code)

        # Pure functions: business logic
        subtotal = PricingRules.calculate_subtotal(request.items)
        discounted = PricingRules.apply_discount(subtotal, discount)
        tax = PricingRules.calculate_tax(discounted, Decimal('0.10'))
        shipping = PricingRules.calculate_shipping(
            request.total_weight, request.is_premium
        )
        total = discounted + tax + shipping

        # Side effect: save to DB
        order = Order(items=request.items, total=total)
        self.order_repo.save(order)

        # Side effect: send notification
        self.notification.send_order_confirmation(request.user_id, order.id)

        return OrderResult.success(order)
```

### 3.3 Command/Query Separation (CQS)

```
  ┌─────────────────────────────────────────────┐
  │  Command-Query Separation (CQS)             │
  ├──────────────┬──────────────────────────────┤
  │ Command      │ Mutates state. No return value│
  │              │ void setName(String name)    │
  ├──────────────┼──────────────────────────────┤
  │ Query        │ Returns a value. No mutation  │
  │              │ String getName()             │
  ├──────────────┼──────────────────────────────┤
  │ Mixed (avoid)│ Mutation + return value       │
  │              │ int addAndGetCount(Item i)    │
  └──────────────┴──────────────────────────────┘
```

**Code Example 8: Applying CQS**

```python
# === CQS violation: one method both mutates and queries ===
class UserService:
    def update_and_get_user(self, user_id: str, name: str) -> User:
        """Update a user and return them (command + query mixed)"""
        user = self.repo.find_by_id(user_id)
        user.name = name
        self.repo.save(user)
        return user

# Problems:
# · The caller may not notice the side effect
# · Verifying side effects in tests becomes complex
# · Cannot be cached (has side effects)


# === CQS compliant: commands and queries are separated ===
class UserService:
    def update_user_name(self, user_id: str, name: str) -> None:
        """Update a user's name (command: mutation only)"""
        user = self.repo.find_by_id(user_id)
        user.name = name
        self.repo.save(user)

    def get_user(self, user_id: str) -> User:
        """Retrieve a user (query: no side effects)"""
        return self.repo.find_by_id(user_id)

# Usage
user_service.update_user_name("user-123", "New Name")
updated_user = user_service.get_user("user-123")
```

```python
# CQS exception: classic operations like Stack.pop()

# Strict CQS compliance
class Stack:
    def peek(self) -> T:
        """Return the top element (query: no state change)"""
        if self.is_empty():
            raise EmptyStackError()
        return self.items[-1]

    def remove_top(self) -> None:
        """Remove the top element (command: no return value)"""
        if self.is_empty():
            raise EmptyStackError()
        self.items.pop()

# Note: pop() violates CQS but is widely accepted in practice
# Whether to apply strict CQS depends on the situation

# Cases where CQS exceptions are acceptable:
# · pop(): removes and returns an element (useful as an atomic operation)
# · next(): advances an iterator and retrieves a value
# · dequeue(): removes from a queue
# → CQS violations are acceptable when atomicity is important
```

---

## 4. Guard Clauses and Early Return

### 4.1 Techniques to Reduce Nesting

**Code Example 9: Improving Readability with Guard Clauses**

```python
# === Bad: Deep nesting ===
def process_payment(order):
    if order is not None:
        if order.is_valid():
            if order.payment_method is not None:
                if order.total > 0:
                    if order.customer.has_sufficient_balance(order.total):
                        result = charge(order)
                        if result.success:
                            send_confirmation(order)
                            return result
                        else:
                            return PaymentResult.failed(result.error)
                    else:
                        return PaymentResult.insufficient_balance()
                else:
                    return PaymentResult.invalid_amount()
            else:
                return PaymentResult.no_payment_method()
        else:
            return PaymentResult.invalid_order()
    else:
        return PaymentResult.null_order()


# === Good: Early return with guard clauses ===
def process_payment(order: Order) -> PaymentResult:
    # Guard clauses: handle error cases first
    if order is None:
        return PaymentResult.null_order()

    if not order.is_valid():
        return PaymentResult.invalid_order()

    if order.payment_method is None:
        return PaymentResult.no_payment_method()

    if order.total <= 0:
        return PaymentResult.invalid_amount()

    if not order.customer.has_sufficient_balance(order.total):
        return PaymentResult.insufficient_balance()

    # Happy Path: normal flow at the bottom
    result = charge(order)
    if not result.success:
        return PaymentResult.failed(result.error)

    send_confirmation(order)
    return result

# Benefits:
# · Nesting depth is 0 (max 1 level)
# · Error cases are eliminated first, so you can focus on the happy path
# · Easy to add new conditions (just add a guard clause)
```

| Technique | Description | Effect |
|------|------|------|
| Guard clauses | Handle error cases first and return early | Reduces nesting |
| Early return | Return immediately when a condition is not met | Clarifies the Happy Path |
| Fail Fast | Reject invalid input immediately | Catches bugs early |

| Nesting depth | Recommendation | Action |
|-----------|--------|------|
| 1-2 | Good | Leave as is |
| 3 | Caution | Consider guard clauses or method extraction |
| 4+ | Refactoring required | Always decompose |

---

## 5. Advanced Function Design Patterns

### 5.1 Abstraction with Higher-Order Functions

**Code Example 10: Abstracting Patterns with Higher-Order Functions**

```python
from typing import TypeVar, Callable, Optional
import time
import logging

T = TypeVar('T')

# === Abstracting the retry pattern ===
def with_retry(
    operation: Callable[[], T],
    max_retries: int = 3,
    delay_seconds: float = 1.0,
    backoff_factor: float = 2.0,
    on_retry: Optional[Callable[[int, Exception], None]] = None,
) -> T:
    """A higher-order function that abstracts retry logic"""
    last_exception = None
    for attempt in range(max_retries + 1):
        try:
            return operation()
        except Exception as e:
            last_exception = e
            if attempt < max_retries:
                if on_retry:
                    on_retry(attempt + 1, e)
                time.sleep(delay_seconds * (backoff_factor ** attempt))
    raise last_exception

# Usage: usable without knowing retry details
user = with_retry(
    lambda: api_client.fetch_user("user-123"),
    max_retries=3,
    delay_seconds=0.5,
    on_retry=lambda attempt, e: logging.warning(f"Retry {attempt}: {e}"),
)


# === Abstracting timing measurement (decorator) ===
def timed(func: Callable) -> Callable:
    """A decorator that measures the execution time of a function"""
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            elapsed = time.perf_counter() - start
            logging.info(f"{func.__name__} took {elapsed:.3f}s")
    return wrapper

@timed
def heavy_computation(data: list) -> float:
    return sum(x ** 2 for x in data)


# === Abstracting transaction boundaries ===
def with_transaction(
    db: Database,
    operation: Callable[[Connection], T]
) -> T:
    """Abstracts transaction management"""
    conn = db.get_connection()
    try:
        result = operation(conn)
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# Usage: focus on business logic without worrying about transaction management
def transfer_money(from_id: str, to_id: str, amount: Decimal) -> None:
    def _transfer(conn: Connection) -> None:
        conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", [amount, from_id])
        conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", [amount, to_id])

    with_transaction(db, _transfer)
```

### 5.2 Pipeline Processing

```python
# === Data transformation pipeline ===

from functools import reduce
from typing import TypeVar, Callable

T = TypeVar('T')

def pipe(*functions: Callable) -> Callable:
    """A pipeline that composes functions from left to right"""
    def pipeline(data):
        return reduce(lambda acc, fn: fn(acc), functions, data)
    return pipeline

# Usage: incremental data transformation
process_users = pipe(
    lambda users: [u for u in users if u.is_active],      # Active users only
    lambda users: [u for u in users if u.age >= 18],       # Adults only
    lambda users: sorted(users, key=lambda u: u.name),     # Sort by name
    lambda users: [u.to_summary() for u in users],         # Convert to summary
    lambda summaries: summaries[:100],                      # Top 100
)

result = process_users(all_users)
```

---

## 6. Anti-Patterns

### Anti-Pattern 1: God Function (Massive Function)

```python
# NG: One function handles everything (200+ lines)
def process_everything(request):
    # Validation (30 lines)
    # Data transformation (40 lines)
    # Business logic (60 lines)
    # DB operations (30 lines)
    # External API calls (20 lines)
    # Response generation (20 lines)
    pass

# OK: Split functions by responsibility
def handle_request(request: Request) -> Response:
    validated = validate_request(request)
    domain_data = transform_to_domain(validated)
    result = apply_business_rules(domain_data)
    persisted = save_to_database(result)
    notify_external_services(persisted)
    return create_response(persisted)
```

### Anti-Pattern 2: Output Arguments (Out Parameters)

```java
// NG: Modifying an argument to return a result
void calculateTotal(Order order, Money result) {
    result.setAmount(order.getSubtotal() + order.getTax());
}

// OK: Return through the return value
Money calculateTotal(Order order) {
    return order.getSubtotal().add(order.getTax());
}
```

### Anti-Pattern 3: Hidden Temporal Coupling

```python
# NG: The order of method calls is implicitly important
class DataProcessor:
    def initialize(self): ...   # 1. Must be called first
    def load_data(self): ...    # 2. Called after initialize
    def process(self): ...      # 3. Called after load_data
    def save(self): ...         # 4. Called after process

# OK: Design that enforces the order
class DataProcessor:
    def run(self, input_path: str, output_path: str) -> None:
        """All processing in one method with guaranteed order"""
        config = self._initialize()
        data = self._load_data(input_path, config)
        result = self._process(data)
        self._save(result, output_path)
```

### Anti-Pattern 4: Branching with Flag Arguments

```python
# NG: A boolean argument switches behavior inside the function
def render_page(content: str, is_admin: bool) -> str:
    if is_admin:
        header = render_admin_header()
        sidebar = render_admin_sidebar()
    else:
        header = render_user_header()
        sidebar = render_user_sidebar()
    return f"{header}{sidebar}{content}"

# OK: Split functions by role
def render_admin_page(content: str) -> str:
    header = render_admin_header()
    sidebar = render_admin_sidebar()
    return f"{header}{sidebar}{content}"

def render_user_page(content: str) -> str:
    header = render_user_header()
    sidebar = render_user_sidebar()
    return f"{header}{sidebar}{content}"
```

**Problem**: A flag argument is a sign that a function has two responsibilities. Writing `render_page(content, True)` at the call site makes it unclear what `True` means at a glance. Split the function or apply the Strategy pattern to make the intent clear through the name.

---

## 7. Exercises

### Exercise 1 (Basic): Splitting Functions

Refactor the following massive function into a group of single-responsibility functions.

```python
def register_user(data):
    # Validation
    if not data.get('email') or '@' not in data['email']:
        return {'error': 'Invalid email'}
    if not data.get('password') or len(data['password']) < 8:
        return {'error': 'Password too short'}
    if not data.get('name') or len(data['name']) < 2:
        return {'error': 'Name too short'}

    # Create user
    import hashlib
    salt = os.urandom(32)
    hashed = hashlib.pbkdf2_hmac('sha256', data['password'].encode(), salt, 100000)
    user = {
        'name': data['name'],
        'email': data['email'],
        'password_hash': hashed.hex(),
        'salt': salt.hex(),
        'created_at': datetime.now()
    }

    # Save to DB
    db.execute("INSERT INTO users ...", user)

    # Send email
    smtp = smtplib.SMTP('smtp.example.com')
    smtp.sendmail('noreply@example.com', data['email'], f'Welcome {data["name"]}!')

    return {'success': True, 'user_id': user['id']}
```

**Expected Answer:**

```python
def register_user(request: RegisterUserRequest) -> RegisterResult:
    """Register a user (high level)"""
    validation_error = validate_registration(request)
    if validation_error:
        return RegisterResult.invalid(validation_error)

    user = create_user_entity(request)
    saved_user = save_user(user)
    send_welcome_email(saved_user)
    return RegisterResult.success(saved_user.id)

def validate_registration(request: RegisterUserRequest) -> str | None:
    if not is_valid_email(request.email):
        return "Invalid email"
    if len(request.password) < MINIMUM_PASSWORD_LENGTH:
        return "Password too short"
    if len(request.name) < MINIMUM_NAME_LENGTH:
        return "Name too short"
    return None

def create_user_entity(request: RegisterUserRequest) -> User:
    password_hash = hash_password(request.password)
    return User(name=request.name, email=request.email, password_hash=password_hash)
```

### Exercise 2 (Applied): Applying CQS

Fix the following CQS violations.

```python
class ShoppingCart:
    def add_item_and_get_total(self, item):
        self.items.append(item)
        return sum(i.price for i in self.items)

    def remove_item_and_check_empty(self, item_id):
        self.items = [i for i in self.items if i.id != item_id]
        return len(self.items) == 0
```

**Expected Answer:**

```python
class ShoppingCart:
    # Commands (state mutation)
    def add_item(self, item: CartItem) -> None:
        self.items.append(item)

    def remove_item(self, item_id: str) -> None:
        self.items = [i for i in self.items if i.id != item_id]

    # Queries (value retrieval)
    def get_total(self) -> Decimal:
        return sum(i.price for i in self.items)

    def is_empty(self) -> bool:
        return len(self.items) == 0
```

### Exercise 3 (Advanced): Functional Core / Imperative Shell

Separate the following code into a Functional Core and an Imperative Shell.

```python
def process_order(order_id, discount_code):
    order = db.get_order(order_id)
    discount = db.get_discount(discount_code)

    total = 0
    for item in order.items:
        total += item.price * item.quantity

    if discount:
        total *= (1 - discount.rate)

    tax = total * 0.1
    final = total + tax

    db.update_order_total(order_id, final)
    email_service.send_receipt(order.customer_email, final)

    return final
```

**Expected Answer:**

```python
# Functional Core (pure functions)
def calculate_order_total(items: list[Item], discount_rate: float, tax_rate: float) -> Decimal:
    subtotal = sum(item.price * item.quantity for item in items)
    discounted = subtotal * (1 - discount_rate)
    tax = discounted * tax_rate
    return discounted + tax

# Imperative Shell (with side effects)
def process_order(order_id: str, discount_code: str) -> Decimal:
    order = db.get_order(order_id)
    discount = db.get_discount(discount_code)
    discount_rate = discount.rate if discount else 0.0

    # Business logic via pure function
    final_total = calculate_order_total(order.items, discount_rate, TAX_RATE)

    # Side effects
    db.update_order_total(order_id, final_total)
    email_service.send_receipt(order.customer_email, final_total)

    return final_total
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check the path and format of the configuration file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry handling |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify the executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Read the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with the minimum amount of code
3. **Form a hypothesis**: List possible causes
4. **Verify incrementally**: Use log output or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """A decorator that logs the inputs and outputs of a function"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Called: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception raised: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with a profiling tool
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Examine disk and network I/O status
4. **Check concurrent connection count**: Monitor connection pool status

| Problem Type | Diagnostic Tool | Action |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Improve algorithms, parallelize |
| Memory leak | tracemalloc, objgraph | Release references properly |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize When | Can Compromise When |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② How often do you deploy?                     │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily / multiple times → Go to ③          │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay a project

**2. Consistency vs. Flexibility**
- A unified technology stack has a lower learning curve
- Adopting diverse technologies allows using the right tool for the job, but increases operational cost

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and the problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Context\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum required features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons Learned:**
- Don't strive for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally renovating a system that has been in operation for 10+ years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If there are no existing tests, write Characterization Tests first
- Use an API gateway to coexist old and new systems
- Migrate data incrementally

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Analyze current state, understand dependencies | 2-4 weeks | Low |
| 2. Foundation | Set up CI/CD, test environment | 4-6 weeks | Low |
| 3. Begin migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Use Domain-Driven Design to clarify boundaries
- Set ownership per team
- Manage shared libraries using an Inner Source approach
- Design API-first to minimize dependencies between teams

```python
# API contract definition between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Verify SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** A system where millisecond-level responses are required

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Collaboration in Team Development

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Has documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (design records) | As needed | Future members | Transparency of decisions |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Important designs | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │ Plan│ Act │
    │ ned │ imm-│
    │     │ edi-│
    │     │ ate-│
    │     │ ly  │
    ├─────┼─────┤
    │ Log │ Next│
    │ only│ Spr-│
    │     │ int │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------|------------|------|---------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Broken authentication | High | Multi-factor auth, stronger session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, principle of least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logging, audit trails | Log analysis |

### Secure Coding Best Practices

```python
# Secure coding example
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """Security utilities"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate a cryptographically secure token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """Hash a password"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """Verify a password"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input values"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage example
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not output to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is configured appropriately
- [ ] Vulnerability scanning of dependency packages has been performed
- [ ] Error messages do not contain internal information
---

## 8. FAQ

### Q1: How many lines should a function be?

Robert C. Martin says "4-5 lines is ideal," but in practice **20 lines or fewer** is the target. What matters is not the line count but whether it does "only one thing." A 20-line function with a single responsibility is fine; a 5-line function with multiple responsibilities is a refactoring target.

### Q2: Is it acceptable to pass null as an argument?

In principle, **null arguments should be avoided**. Use Optional types, default values, or method overloading instead. Null arguments are a breeding ground for NullPointerExceptions and push the responsibility for null checking onto the caller.

### Q3: What should you do when there are too many private methods?

A class with many private methods is **a sign that a hidden class exists**. Extract the group of related private methods into a new class (Extract Class) to increase the cohesion of each class.

### Q4: Should CQS always be applied strictly?

CQS is a principle, not an absolute rule. Operations where atomicity is important, such as `pop()`, `next()`, and `dequeue()`, are acceptable CQS violations. What matters is **eliminating unintended side effects**; intentional CQS violations that are explicitly designed are not a problem.

### Q5: Does early return affect performance?

With modern compilers/interpreters, the performance impact of early return is negligible. The improvement in readability is far more important. The one thing to be careful about is resource release — use `try-finally` or `with` statements before an early return to ensure resources are properly released.

### Q6: When should you use lambda expressions vs. named functions?

**Lambda expressions are appropriate for simple 1-2 line transformations or filters**, while **named functions are appropriate for logic that is 3+ lines or is reused**. Lambda expressions are effective when "what they do" is immediately clear, but they become hard to debug as they grow complex.

```python
# OK: Lambda expression is appropriate (simple transformation)
names = sorted(users, key=lambda u: u.last_name)
active = filter(lambda u: u.is_active, users)

# NG: Lambda expression is too complex
result = map(lambda x: x.price * x.quantity * (1 - x.discount) if x.is_taxable else x.price * x.quantity, items)

# OK: Extract into a named function
def calculate_item_total(item: Item) -> float:
    subtotal = item.price * item.quantity
    if item.is_taxable:
        return subtotal * (1 - item.discount)
    return subtotal

result = map(calculate_item_total, items)
```

### Q7: When should you use recursive functions?

Recursion naturally fits tree structure traversal and fractal-style problems (divide and conquer). However, be mindful of the following:

1. **Stack overflow**: Recursion depth has a limit (Python: default 1000)
2. **Tail call optimization**: Not optimized in many languages, so converting to a loop is safer
3. **Readability**: Use recursion actively for problems that read naturally as recursive (directory traversal, JSON parsing, etc.)

```python
# A case where recursion is natural: traversing a directory tree
def find_files(directory: Path, extension: str) -> list[Path]:
    found = []
    for entry in directory.iterdir():
        if entry.is_dir():
            found.extend(find_files(entry, extension))  # Recursion
        elif entry.suffix == extension:
            found.append(entry)
    return found

# A case where recursion is inappropriate: simple aggregation (a loop is sufficient)
# NG
def sum_recursive(numbers: list[int]) -> int:
    if not numbers:
        return 0
    return numbers[0] + sum_recursive(numbers[1:])

# OK
def sum_iterative(numbers: list[int]) -> int:
    return sum(numbers)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional settings?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Principle | Guideline | Signs of Violation |
|------|------------|-----------|
| Size | 20 lines or fewer | Requires scrolling |
| Responsibility | Only one | Descriptions like "does X, then Y, then Z" |
| Arguments | 2 or fewer recommended | 3+ without a parameter object |
| Side effects | None / explicit | State changes not reflected in the name |
| Abstraction level | Unified | High-level and low-level operations mixed |
| CQS | Separate commands and queries | Mutating state while returning a value |
| Nesting | 2 levels or fewer | Deep nested if/for statements |

| Design Pattern | Effect | Use Case |
|------------|------|---------|
| Guard clauses | Reduced nesting, clarified error cases | Multiple precondition checks |
| Parameter object | Fewer arguments, clearer meaning | 3 or more arguments |
| Strategy pattern | Eliminates flag arguments | Switching behavior based on conditions |
| Higher-order functions | Abstraction of common patterns | Retry, measurement, transactions |
| Functional Core | Testability, ease of reasoning | Business logic |

---

## Next Guides to Read

- [Error Handling](./02-error-handling.md) ── Error handling design for functions
- [Testing Principles](./04-testing-principles.md) ── Conditions for functions that are easy to test
- [Functional Principles](../03-practices-advanced/02-functional-principles.md) ── Pure functions and referential transparency
- [SOLID Principles](../00-principles/01-solid.md) ── SRP and single responsibility of functions

---

## References

1. **Robert C. Martin** *Clean Code: A Handbook of Agile Software Craftsmanship* Prentice Hall, 2008 (Chapter 3: Functions) ── Basic principles of function design
2. **Bertrand Meyer** *Object-Oriented Software Construction* Prentice Hall, 1997 ── Proposal of Command-Query Separation
3. **Martin Fowler** *Refactoring: Improving the Design of Existing Code* Addison-Wesley, 2018 ── Extract Function, Introduce Parameter Object, Replace Flag Argument
4. **Gary Bernhardt** "Boundaries" (talk, 2012) ── Functional Core / Imperative Shell pattern
5. **Michael Feathers** *Working Effectively with Legacy Code* Prentice Hall, 2004 ── Techniques for extracting functions from legacy code
6. **Thomas J. McCabe** "A Complexity Measure" IEEE Transactions on Software Engineering, 1976 ── Definition of cyclomatic complexity
7. **G. Ann Campbell** "Cognitive Complexity" SonarSource, 2018 ── Definition of the cognitive complexity metric
8. **Eric Normand** *Grokking Simplicity: Taming complex software with functional thinking* Manning, 2021 ── Separating pure functions from actions
