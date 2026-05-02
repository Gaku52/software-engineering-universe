# Testing Principles ── Techniques for Building a Reliable Test Suite

> Tests are a safety net that guarantees code quality and a feedback mechanism that improves design. This guide explains how to build a reliable test suite by understanding the AAA pattern, FIRST principles, and how to choose the right test doubles. Tests are not about "finding bugs" — they are about "creating an environment where changes can be made with confidence."

---

## What You Will Learn

1. **Fundamental test principles and design philosophy** ── Understand the test pyramid, AAA pattern, and FIRST principles for structuring tests, along with the essential role tests should play
2. **Choosing the right test doubles** ── Learn the roles of Stub, Mock, Spy, and Fake and how to select the appropriate one, enabling designs with high testability
3. **Practical test design techniques** ── Master boundary value testing, parameterized testing, property-based testing, and the TDD cycle
4. **Maintaining and improving test quality** ── Learn how to deal with flaky tests, use test coverage appropriately, and validate test quality with mutation testing
5. **Integration with CI/CD pipelines** ── Achieve faster feedback loops through automated test execution, parallelization, and selective test execution

---

## Prerequisites

The following knowledge is recommended to fully understand this chapter.

| Prerequisite | Reference |
|---------|--------|
| Principles of function design | [Function Design](./01-functions.md) |
| Basics of class design | Class Design |
| Basic Python syntax | Foundational programming knowledge |
| Basic usage of pytest | pytest official documentation |

---

## 1. The Essence of Testing ── Why Write Tests?

### 1.1 The Three Roles of Tests

Tests are not simply about "finding bugs." Vladimir Khorikov organizes the roles of tests into the following three categories in *Unit Testing Principles, Practices, and Patterns*:

```
The Three Roles of Tests
────────────────────────────────────
1. Regression Protection
   → Guarantees that code changes do not break existing functionality
   → Acts as a safety net for refactoring

2. Design Feedback
   → If tests are hard to write, there is a design problem
   → Highly testable design = good design (strong correlation)

3. Living Documentation
   → Tests are a living specification of "how code is used"
   → As long as tests pass, that behavior is guaranteed
────────────────────────────────────
```

### 1.2 The Relationship Between Tests and Design

When tests are hard to write, it is a sign of a design problem in the code.

```
Mapping test difficulty to design problems
────────────────────────────────────
Test difficulty               → Design problem
──────────────────────────── → ────────────────────
Long Arrange section          → Too many dependencies (SRP violation)
Many test doubles             → High coupling
Long test names               → Too many responsibilities per function
Too many test cases           → Overly complex conditional logic
Dependency on external systems → Interface not separated
Tests depend on order         → Global state exists
────────────────────────────────────
```

### 1.3 Cost vs. Return of Tests

```
  Cost-Effectiveness of Tests

  Return (bug prevention, confidence)
  High |         *  (Unit tests:
      |        *    core logic)
      |       *
      |      *        * (Integration tests)
      |     *       *
      |    *      *
      |   *     *       * (E2E tests)
      |  *    *       *
      | *   *       *
  Low |___*______*________*___
       Low                  High
          Cost (creation + maintenance)

  Highest cost-effectiveness:
  "Unit tests for business logic"
```

---

## 2. The Test Pyramid

### 2.1 Overall Structure

```
                  /\
                 /  \          E2E Tests
                / E2E \        (few, slow, high cost)
               /      \
              /--------\
             /          \      Integration Tests
            / Integration\     (moderate)
           /              \
          /----------------\
         /                  \   Unit Tests
        /      Unit Tests    \  (many, fast, low cost)
       /                      \
      +------------------------+

  Unit : Integration : E2E = 70% : 20% : 10% (guideline)
```

This ratio was proposed by Mike Cohn in *Succeeding with Agile* and is a guideline, not an absolute rule. The optimal ratio varies depending on the nature of the project (API-centric, UI-centric, data pipeline, etc.).

### 2.2 Characteristics and Comparison of Each Level

```
Level        Speed     Reliability  Maintenance  Feedback     Bugs Detected
---------------------------------------------------------------------------
Unit         < 1ms     High         Low          Immediate    Logic errors
Integration  < 1sec    Medium       Medium       Seconds      Connection/config errors
E2E          < 30sec   Low (Flaky)  High         Minutes      Full flow inconsistencies
```

| Test Level | Target | Examples | Tools Used |
|-------------|-----------|--------|-------------|
| Unit | Single function/method | Price calculation, validation | pytest, JUnit, Jest |
| Integration | Inter-module interactions | DB operations, API calls | pytest + testcontainers |
| E2E | Full user flows | "Login → product selection → payment" | Playwright, Cypress |

### 2.3 Variations on the Test Pyramid

```
Testing Trophy (proposed by Kent C. Dodds)
── An approach that emphasizes integration tests for frontend

            /\
           /  \          E2E (few)
          /----\
         /      \
        / Integra-\      Integration Tests (most)
       /   tion    \
      /------------\
     /              \
    /  Unit          \   Unit Tests (moderate)
   /                  \
  +--------------------+
  |     Static Types    |   Type checking (foundation)
  +--------------------+

* For frontend, what matters more than individual function tests
  is that "interactions between components" are correct
```

---

## 3. The AAA Pattern

### 3.1 Basics of Arrange-Act-Assert

This is the most widely used pattern for structuring tests. It also corresponds to Given-When-Then (BDD style).

**Code Example 1: Basic form of the AAA pattern**

```python
def test_order_total_calculation():
    # Arrange: prepare the subject under test and preconditions
    order = Order(id="order-1", user_id="user-1")
    order.add_item(OrderItem(product_id="p1", name="Product A", price=1000, quantity=2))
    order.add_item(OrderItem(product_id="p2", name="Product B", price=500, quantity=3))

    # Act: execute the method under test
    total = order.total_amount

    # Assert: verify the expected result
    assert total == 3500  # 1000*2 + 500*3

def test_order_cancel_shipped_raises_error():
    # Arrange
    order = Order(id="order-1", user_id="user-1", status="shipped")

    # Act & Assert (can be combined for exceptions)
    with pytest.raises(ValueError, match="Cannot cancel a shipped order"):
        order.cancel()
```

### 3.2 Guidelines for the AAA Pattern

```
AAA Pattern Guidelines
────────────────────────────────────
1. If Arrange is long → extract to factory functions or fixtures
2. Act should be one line as a rule → multiple lines suggests the function is too large
3. Assert one concept per test → do not verify multiple concepts
4. Separate each section with a blank line → visually clarify structure
5. Comments are optional → the AAA structure itself serves as documentation
────────────────────────────────────
```

**Code Example 2: Handling a long Arrange section**

```python
# BAD: Arrange is too long
def test_monthly_report_generation():
    user = User(id="u1", name="Alice", role="admin")
    department = Department(id="d1", name="Engineering")
    project1 = Project(id="p1", name="Alpha", budget=1000000)
    project2 = Project(id="p2", name="Beta", budget=2000000)
    team = Team(members=[user], department=department)
    time_entries = [
        TimeEntry(user=user, project=project1, hours=80),
        TimeEntry(user=user, project=project2, hours=40),
    ]
    report_config = ReportConfig(
        period="monthly", include_overtime=True, format="pdf"
    )

    report = generate_report(team, time_entries, report_config)

    assert report.total_hours == 120
    assert report.overtime_hours == 20


# GOOD: Use factory functions to clarify test intent
def test_monthly_report_generation():
    team = create_team_with_single_member()
    time_entries = create_time_entries(regular_hours=120, overtime_hours=20)
    config = create_monthly_report_config()

    report = generate_report(team, time_entries, config)

    assert report.total_hours == 120
    assert report.overtime_hours == 20
```

### 3.3 Test Naming Conventions

Test names should be understandable just by reading them — they should clearly convey "what is being tested."

**Code Example 3: Test naming patterns**

```python
# Naming pattern 1: [subject]_[condition]_[expected result]
def test_order_when_empty_items_raises_validation_error():
    ...

def test_discount_when_total_exceeds_10000_applies_10_percent():
    ...

def test_user_registration_with_duplicate_email_returns_conflict():
    ...

# Naming pattern 2: BDD style (nested classes)
class TestOrder:
    class TestPlace:
        def test_changes_status_to_placed(self): ...
        def test_raises_error_when_items_empty(self): ...
        def test_emits_order_placed_event(self): ...

    class TestCancel:
        def test_changes_status_to_cancelled(self): ...
        def test_raises_error_when_already_shipped(self): ...
        def test_restores_inventory(self): ...

# Naming pattern 3: should style
def test_order_should_calculate_total_including_tax():
    ...

def test_user_should_be_locked_after_five_failed_attempts():
    ...
```

| Naming Pattern | Example | When to Use |
|-------------|-----|---------|
| `test_[subject]_[condition]_[expected result]` | `test_order_when_empty_raises_error` | Most common |
| BDD nested class | `TestOrder.TestCancel.test_restores_inventory` | When there are many tests |
| should style | `test_order_should_calculate_total` | Reading as a specification |
| it style (JS) | `it('calculates total including tax')` | Jest, Mocha |

---

## 4. FIRST Principles

The FIRST principles define five characteristics of good unit tests. They were proposed by Robert C. Martin in *Clean Code*.

| Principle | Meaning | Concrete Guidelines |
|------|------|------------------|
| **F**ast | High speed | Single unit test < 10ms. Full suite < 10 seconds |
| **I**ndependent | Independent | No dependencies between tests. Same result regardless of order |
| **R**epeatable | Reproducible | Not dependent on environment or time. Same result in CI |
| **S**elf-Validating | Self-validating | Pass/Fail determined automatically. No manual verification needed |
| **T**imely | Timely | Write tests immediately before or after production code |

### 4.1 Fast

**Code Example 4: Improving test speed**

```python
# BAD (Fast violation): calls a real external API
def test_payment_processing():
    result = stripe.Charge.create(amount=1000, currency="jpy")  # actual API call
    assert result.status == "succeeded"

# GOOD: respond immediately with a test double
def test_payment_processing():
    gateway = StubPaymentGateway(always_succeeds=True)
    processor = PaymentProcessor(gateway=gateway)

    result = processor.process(Payment(amount=1000, currency="jpy"))

    assert result.status == "succeeded"
```

### 4.2 Independent

**Code Example 5: Eliminating dependencies between tests**

```python
# BAD (Independent violation): sharing state between tests
class TestUserService:
    user_id = None  # shared state via class variable

    def test_create_user(self):
        TestUserService.user_id = service.create_user("Alice")

    def test_get_user(self):
        user = service.get_user(TestUserService.user_id)  # depends on the previous test
        assert user.name == "Alice"

# GOOD: each test is independent
class TestUserService:
    def test_create_user(self):
        user_id = service.create_user("Alice")
        assert user_id is not None

    def test_get_user(self):
        user_id = service.create_user("Bob")  # sets up its own data
        user = service.get_user(user_id)
        assert user.name == "Bob"
```

### 4.3 Repeatable

**Code Example 6: Eliminating time dependency**

```python
# BAD (Repeatable violation): depends on the current time
def test_is_expired():
    token = Token(expires_at=datetime(2026, 3, 1))
    assert token.is_expired()  # only passes after March 2026

# GOOD: inject time (dependency injection)
def test_is_expired():
    token = Token(expires_at=datetime(2026, 3, 1))
    now = datetime(2026, 3, 2)  # fixed time for testing
    assert token.is_expired(now=now)

# GOOD (alternative): freeze time with freezegun
from freezegun import freeze_time

@freeze_time("2026-03-02")
def test_is_expired():
    token = Token(expires_at=datetime(2026, 3, 1))
    assert token.is_expired()
```

```python
# BAD (Repeatable violation): depends on random values
import random

def test_shuffle_changes_order():
    items = [1, 2, 3, 4, 5]
    shuffled = shuffle(items)
    assert items != shuffled  # may occasionally produce the same order

# GOOD: fix the seed
def test_shuffle_changes_order():
    items = [1, 2, 3, 4, 5]
    shuffled = shuffle(items, seed=42)  # fixed seed
    assert shuffled == [3, 1, 4, 5, 2]  # deterministic result
```

### 4.4 Self-Validating

```python
# BAD (Self-Validating violation): requires manual verification
def test_report_generation():
    report = generate_report(data)
    print(report)  # visual inspection required → Pass/Fail cannot be determined automatically

# GOOD: assertions that can be evaluated automatically
def test_report_generation():
    report = generate_report(data)
    assert report.total_rows == 100
    assert report.summary == "Monthly Report: Sales ¥1,000,000"
    assert report.generated_at is not None
```

### 4.5 Timely

In TDD (Test-Driven Development), tests are written before production code. Even without TDD, tests should be written at the same time as the feature implementation. "Writing tests later" tends to become synonymous with "not writing tests at all."

```
TDD Cycle (Red-Green-Refactor)
────────────────────────────────────
  1. Red     : Write a failing test (implementation does not exist yet)
  2. Green   : Write the minimum implementation to make the test pass
  3. Refactor: Clean up the code while keeping the tests passing

  ┌─────────┐     ┌──────────┐     ┌────────────┐
  │  Red     │ ──→ │  Green   │ ──→ │  Refactor  │
  │ (test)   │     │ (impl)   │     │ (cleanup)  │
  └─────────┘     └──────────┘     └────────────┘
       ↑                                   │
       └───────────────────────────────────┘
────────────────────────────────────
```

---

## 5. Test Doubles

### 5.1 Types and How to Choose

```
Classification of Test Doubles

  Test Double
  ├── Dummy ─── only fills in an argument (never used)
  ├── Stub ──── returns a fixed value
  ├── Spy ───── real processing + call recording
  ├── Mock ──── verifies calls (expectations are set)
  └── Fake ──── simplified but working implementation
```

| Type | Purpose | What Is Verified | Example |
|------|------|---------|-----|
| **Dummy** | Satisfies an argument | Nothing | An argument that the subject under test does not use |
| **Stub** | Returns a fixed value | Return value | `find_by_id()` returns a fixed user |
| **Mock** | Verifies calls | Method calls | Whether `send_email()` was called with the correct arguments |
| **Spy** | Real processing + recording | Call count, arguments | Actually sends an email and records how many times it was called |
| **Fake** | Simplified implementation | Entire logic | An in-memory DB as a substitute for a Repository |

### 5.2 Test Double Selection Flowchart

```
Flowchart for selecting a test double

Q1: Does the subject under test depend on "output" from an external system?
    (e.g., DB reads, API responses, reading config values)
    → Yes → Use a Stub

Q2: Does the subject under test send "input" to an external system?
    (e.g., sending email, DB writes, emitting events)
    → Yes → Use a Mock

Q3: Is a complete alternative implementation needed?
    (e.g., in-memory DB, local file system)
    → Yes → Use a Fake

Q4: Just need to fill in an argument?
    → Yes → Use a Dummy
```

### 5.3 Implementation Examples

**Code Example 7: Stub (returns a fixed value)**

```python
class StubProductRepository:
    """For testing: returns fixed product data."""
    def find_by_id(self, product_id: str) -> Product:
        return Product(id=product_id, name="Test Product", price=1000)

    def find_all(self) -> list[Product]:
        return [
            Product(id="p1", name="Product A", price=1000),
            Product(id="p2", name="Product B", price=2000),
        ]

def test_create_order_calculates_total():
    # Arrange
    product_repo = StubProductRepository()
    use_case = CreateOrderUseCase(product_repo=product_repo)

    # Act
    result = use_case.execute(CreateOrderInput(
        items=[{"product_id": "p1", "quantity": 3}]
    ))

    # Assert
    assert result.total_amount == 3000
```

**Code Example 8: Mock (verifies calls)**

```python
from unittest.mock import Mock, call

def test_order_placement_sends_notification():
    # Arrange
    notifier = Mock()
    service = OrderService(notifier=notifier)

    # Act
    service.place_order(order_id="order-1")

    # Assert: verify called with correct arguments
    notifier.send.assert_called_once_with(
        recipient="customer@example.com",
        subject="Order Confirmation",
    )

def test_bulk_notification_sends_to_all_users():
    # Arrange
    notifier = Mock()
    service = NotificationService(notifier=notifier)

    # Act
    service.notify_all(user_ids=["u1", "u2", "u3"], message="Sale started")

    # Assert: verify called 3 times
    assert notifier.send.call_count == 3
    notifier.send.assert_any_call(user_id="u1", message="Sale started")
```

**Code Example 9: Fake (simplified implementation)**

```python
class FakeOrderRepository:
    """For testing: an in-memory repository."""
    def __init__(self):
        self._store: dict[str, Order] = {}

    def save(self, order: Order) -> None:
        self._store[order.id] = order

    def find_by_id(self, order_id: str) -> Order | None:
        return self._store.get(order_id)

    def find_by_user(self, user_id: str) -> list[Order]:
        return [o for o in self._store.values() if o.user_id == user_id]

    def count(self) -> int:
        return len(self._store)

def test_order_persistence_and_retrieval():
    # Arrange
    repo = FakeOrderRepository()
    order = Order(id="o1", user_id="u1", items=[
        OrderItem(product_id="p1", quantity=2, price=1000)
    ])

    # Act
    repo.save(order)
    found = repo.find_by_id("o1")

    # Assert
    assert found is not None
    assert found.id == "o1"
    assert found.user_id == "u1"
```

### 5.4 The Danger of Overusing Mocks

Overusing Mocks couples tests to implementation details, causing them to break during refactoring. Vladimir Khorikov argues that "Mocks should only be used to verify outputs (commands), and Stubs should be used for inputs (queries)."

```python
# BAD: overuse of Mocks (coupled to implementation details)
def test_order_creation_uses_correct_sql():
    db = Mock()
    service = OrderService(db=db)
    service.create_order(user_id="u1", items=[...])

    # Testing SQL details → breaks during refactoring
    db.execute.assert_called_with(
        "INSERT INTO orders (user_id, total) VALUES (%s, %s)",
        ("u1", 3000)
    )

# GOOD: test behavior (use a Fake)
def test_order_creation_persists_order():
    repo = FakeOrderRepository()
    service = OrderService(repo=repo)
    service.create_order(user_id="u1", items=[...])

    # Verify the result (does not depend on implementation details)
    orders = repo.find_by_user("u1")
    assert len(orders) == 1
    assert orders[0].total == 3000
```

---

## 6. Advanced Test Techniques

### 6.1 Parameterized Tests

When testing the same logic with different inputs, parameterized tests are efficient.

**Code Example 10: Parameterized tests**

```python
import pytest

@pytest.mark.parametrize("total, expected_discount", [
    (5000,  0),         # 5000: no discount
    (9999,  0),         # 9999: no discount (boundary - 1)
    (10000, 0),         # 10000: no discount (boundary)
    (10001, 1000),      # 10001: 10% discount (boundary + 1)
    (20000, 2000),      # 20000: 10% discount
    (49999, 4999),      # 49999: 10% discount (next boundary - 1)
    (50000, 7500),      # 50000: 15% discount
    (100000, 20000),    # 100000: 20% discount
])
def test_discount_calculation(total, expected_discount):
    calculator = DiscountCalculator()
    assert calculator.calculate(total) == expected_discount
```

```python
# Combination of multiple parameters
@pytest.mark.parametrize("user_type, order_total, expected", [
    ("regular",  5000,  0),
    ("regular",  10001, 1000),
    ("premium",  5000,  250),    # premium: 5%
    ("premium",  10001, 1500),   # premium: 15%
    ("vip",      5000,  500),    # VIP: 10%
    ("vip",      10001, 2000),   # VIP: 20%
])
def test_discount_by_user_type(user_type, order_total, expected):
    calculator = DiscountCalculator()
    assert calculator.calculate(order_total, user_type) == expected
```

### 6.2 Boundary Value Testing

Boundary value analysis is a technique that focuses testing on "boundaries" where bugs are most likely to occur.

**Code Example 11: Boundary value tests**

```python
class TestPasswordValidation:
    """Boundary value tests for password validation."""

    @pytest.mark.parametrize("password, is_valid, description", [
        ("1234567", False, "7 chars: min-1 → invalid"),
        ("12345678", True, "8 chars: minimum boundary → valid"),
        ("123456789", True, "9 chars: min+1 → valid"),
        ("A" * 19, True, "19 chars: max-1 → valid"),
        ("A" * 20, True, "20 chars: maximum boundary → valid"),
        ("A" * 21, False, "21 chars: max+1 → invalid"),
    ])
    def test_length_boundary(self, password, is_valid, description):
        result = validate_password(password)
        assert result.is_valid == is_valid, description

    @pytest.mark.parametrize("password, is_valid, description", [
        ("", False, "empty string"),
        ("a", False, "1 character"),
        ("A" * 1000, False, "extremely long string"),
    ])
    def test_edge_cases(self, password, is_valid, description):
        result = validate_password(password)
        assert result.is_valid == is_valid, description
```

```
Boundary Value Analysis Template
────────────────────────────────────
  For any range [min, max], test the following:

  1. min - 1  (out of range: invalid)
  2. min      (boundary: valid)
  3. min + 1  (in range: valid)
  4. A representative middle value
  5. max - 1  (in range: valid)
  6. max      (boundary: valid)
  7. max + 1  (out of range: invalid)

  Also:
  8. Empty input (None, "", [], 0)
  9. Extreme values (max integer, very long string)
────────────────────────────────────
```

### 6.3 Property-Based Testing

Instead of specific input values, test "properties that hold for any input."

**Code Example 12: Property-based tests**

```python
from hypothesis import given, strategies as st

# Property 1: a sorted list has the same elements as the original
@given(st.lists(st.integers()))
def test_sort_preserves_elements(lst):
    sorted_lst = sorted(lst)
    assert sorted(sorted_lst) == sorted(lst)
    assert len(sorted_lst) == len(lst)

# Property 2: a sorted list is in ascending order
@given(st.lists(st.integers(), min_size=2))
def test_sort_is_ordered(lst):
    sorted_lst = sorted(lst)
    for i in range(len(sorted_lst) - 1):
        assert sorted_lst[i] <= sorted_lst[i + 1]

# Property 3: JSON encode → decode restores the original data
@given(st.dictionaries(
    keys=st.text(min_size=1, max_size=50),
    values=st.one_of(st.integers(), st.text(), st.booleans(), st.none()),
))
def test_json_roundtrip(data):
    encoded = json.dumps(data)
    decoded = json.loads(encoded)
    assert decoded == data

# Property 4: no rounding errors in monetary calculations
@given(
    price=st.decimals(min_value=1, max_value=1000000, places=0),
    quantity=st.integers(min_value=1, max_value=100),
)
def test_total_is_positive(price, quantity):
    total = price * quantity
    assert total >= price  # total is at least the unit price
    assert total >= quantity  # total is at least the quantity
```

### 6.4 Snapshot Testing

When output is complex, the initial output is saved as a "snapshot" and subsequent runs are compared against it.

**Code Example 13: Snapshot testing (pytest-snapshot)**

```python
def test_user_serialization(snapshot):
    user = User(
        id="u1", name="Alice", email="alice@example.com",
        created_at=datetime(2024, 1, 1)
    )
    result = user.to_dict()

    # First run: save the snapshot
    # Subsequent runs: compare against the saved snapshot
    snapshot.assert_match(json.dumps(result, indent=2), "user_serialization.json")
```

### 6.5 Table-Driven Tests (Go Style)

A test pattern widely used in Go. Test cases are defined in a table (list) and executed in a loop.

```python
# Table-driven tests
class TestEmailValidation:
    test_cases = [
        {"input": "user@example.com", "valid": True, "desc": "valid email"},
        {"input": "user@example", "valid": False, "desc": "no TLD"},
        {"input": "@example.com", "valid": False, "desc": "no local part"},
        {"input": "user@", "valid": False, "desc": "no domain"},
        {"input": "", "valid": False, "desc": "empty string"},
        {"input": "a" * 255 + "@example.com", "valid": False, "desc": "too long"},
        {"input": "user+tag@example.com", "valid": True, "desc": "plus tag"},
        {"input": "user.name@example.com", "valid": True, "desc": "with dot"},
    ]

    @pytest.mark.parametrize("case", test_cases, ids=lambda c: c["desc"])
    def test_email_validation(self, case):
        result = validate_email(case["input"])
        assert result.is_valid == case["valid"], f"Failed: {case['desc']}"
```

---

## 7. Maintaining and Improving Test Quality

### 7.1 Appropriate Use of Test Coverage

```
Types of Test Coverage
────────────────────────────────────
1. Line Coverage
   → Percentage of lines executed. Most basic but shallow

2. Branch Coverage
   → Whether each branch of if/else was executed. Deeper than line coverage

3. Condition Coverage
   → Whether each condition in a compound expression (A && B) experienced both true and false

4. Mutation Score
   → Percentage of intentionally broken code that tests can detect
   → The most accurate metric for measuring test "quality"
────────────────────────────────────
```

```python
# Example showing the limits of coverage
def calculate_discount(amount: int, is_premium: bool) -> int:
    if amount > 10000 and is_premium:
        return int(amount * 0.15)
    return 0

# This test achieves 100% line coverage but misses a bug
def test_discount():
    assert calculate_discount(20000, True) == 3000  # 100% coverage
    # But the case (20000, False) → 0 is not tested
    # If the condition is changed to 'or', the test still passes
```

### 7.2 Mutation Testing

Intentionally "break" the code (create mutants) and verify whether tests can detect them.

```python
# Original code
def is_adult(age: int) -> bool:
    return age >= 18

# Mutant 1: change >= to >
def is_adult_mutant1(age: int) -> bool:
    return age > 18  # not detectable without a test for age == 18

# Mutant 2: change 18 to 17
def is_adult_mutant2(age: int) -> bool:
    return age >= 17  # not detectable without boundary value tests

# Mutant 3: invert True/False
def is_adult_mutant3(age: int) -> bool:
    return not (age >= 18)  # detectable if basic tests exist
```

```
Running Mutation Tests (mutmut)
────────────────────────────────────
$ pip install mutmut
$ mutmut run --paths-to-mutate=src/ --tests-dir=tests/

How to read results:
  Killed:   tests detected the mutant (good)
  Survived: tests missed the mutant (insufficient tests)
  Timeout:  tests did not complete

Mutation score = Killed / (Killed + Survived) * 100
Target: 80% or higher
────────────────────────────────────
```

### 7.3 Dealing with Flaky Tests

Flaky tests (unstable tests) undermine trust in the entire test suite. Once the culture of "that test just fails sometimes, it's probably flaky" takes hold, real bugs start getting missed too.

```
Common causes of flaky tests and countermeasures
────────────────────────────────────
Cause 1: Order dependency between tests
  Countermeasure: → Run in random order with pytest-randomly
                 → Reset state in each test

Cause 2: Timing dependency (async processing)
  Countermeasure: → Use explicit waiting (polling) instead of sleep()
                 → Use the awaitility pattern

Cause 3: Dependency on external services
  Countermeasure: → Replace with test doubles
                 → Stub APIs with WireMock or similar

Cause 4: Resource contention (ports, files)
  Countermeasure: → Use random ports
                 → Use temporary directories

Cause 5: Floating-point comparisons
  Countermeasure: → Use pytest.approx()
                 → Use Decimal
────────────────────────────────────
```

**Code Example 14: Fixing a flaky test**

```python
# BAD: timing-dependent
def test_async_job_completion():
    start_background_job("process-data")
    time.sleep(5)  # should finish in 5 seconds... Flaky!
    assert job_status("process-data") == "completed"

# GOOD: wait with polling
def test_async_job_completion():
    start_background_job("process-data")

    # Poll every 1 second for up to 30 seconds
    for _ in range(30):
        if job_status("process-data") == "completed":
            return  # test passed
        time.sleep(1)

    pytest.fail("Job did not complete within 30 seconds")


# BETTER: wait using the tenacity library
from tenacity import retry, stop_after_delay, wait_fixed

@retry(stop=stop_after_delay(30), wait=wait_fixed(1))
def wait_for_job_completion(job_id: str):
    assert job_status(job_id) == "completed"

def test_async_job_completion():
    start_background_job("process-data")
    wait_for_job_completion("process-data")
```

---

## 8. Structuring Tests and Fixtures

### 8.1 pytest Fixtures

**Code Example 15: Using fixtures**

```python
import pytest

# Session scope: runs once for the entire test suite
@pytest.fixture(scope="session")
def database():
    """Create and tear down a test database."""
    db = create_test_database()
    create_schema(db)
    yield db
    drop_database(db)

# Function scope: runs for each test function
@pytest.fixture
def clean_db(database):
    """Begin a transaction before each test, rollback after."""
    database.begin()
    yield database
    database.rollback()

# Custom factory fixture
@pytest.fixture
def create_user(clean_db):
    """Factory for test users."""
    def _create_user(name="Alice", email="alice@test.com", role="user"):
        user = User(name=name, email=email, role=role)
        clean_db.save(user)
        return user
    return _create_user

# Using fixtures
def test_user_can_place_order(create_user, clean_db):
    user = create_user(name="Bob")
    order = Order(user_id=user.id, items=[...])
    clean_db.save(order)

    assert order.user_id == user.id
```

### 8.2 Test Classification and Markers

```python
# Register markers in conftest.py
def pytest_configure(config):
    config.addinivalue_line("markers", "slow: tests that take a long time to run")
    config.addinivalue_line("markers", "integration: integration tests")
    config.addinivalue_line("markers", "e2e: E2E tests")

# Apply markers to tests
@pytest.mark.slow
def test_full_data_migration():
    ...

@pytest.mark.integration
def test_database_connection():
    ...

# Run only tests with specific markers
# $ pytest -m "not slow"           # run all except slow tests
# $ pytest -m "integration"        # run only integration tests
# $ pytest -m "not e2e"            # run all except E2E
```

---

## 9. Integration with CI/CD Pipelines

### 9.1 Automating the Test Strategy

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on:
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements-dev.txt
      - run: |
          pytest tests/unit/ \
            --cov=src \
            --cov-report=xml \
            --cov-fail-under=80 \
            -x \
            --timeout=10

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements-dev.txt
      - run: pytest tests/integration/ -v --timeout=60
```

### 9.2 Running Tests in Parallel

```
Strategies for speeding up test execution
────────────────────────────────────
1. Parallel execution with pytest-xdist
   $ pytest -n auto  # automatic parallelization based on CPU core count

2. Splitting tests
   # Split into multiple jobs in CI
   $ pytest --splits 4 --group 1  # group 1 of 4
   $ pytest --splits 4 --group 2  # group 2 of 4

3. Run only tests related to changed files
   $ pytest --picked  # tests related to files in git diff

4. Using the cache
   $ pytest --lf  # re-run only tests that failed last time
   $ pytest --ff  # run tests that failed last time first
────────────────────────────────────
```

---

## 10. Comparison Tables

### Comparison of Test Techniques

| Technique | Granularity | Speed | Maintainability | Use Case |
|------|------|------|--------|---------|
| Unit test | Method/function | Fastest | High | Business logic, pure functions |
| Integration test | Inter-module interaction | Medium | Medium | DB operations, API integration |
| E2E test | Full flow | Slow | Low | Critical paths |
| Snapshot | UI output | Fast | Low | UI components |
| Property-based | Random input | Medium | High | Algorithms, parsers |
| Mutation | Test quality | Slow | ── | Validating test suite quality |

### Choosing the Right Test Double

| Test Double | When to Use | When to Avoid |
|------------|---------|-----------|
| Stub | Want to fix the response from an external service | Simple logic where it is unnecessary |
| Mock | Want to verify that a side effect (e.g., email sending) occurred | When it would couple to implementation details |
| Fake | Want a complete in-memory substitute | When implementation cost is too high |
| Spy | Want to run the real processing while also recording it | When a Mock is sufficient |
| Dummy | Just need to fill an argument | When the subject under test actually uses it |

---

## 11. Anti-Patterns

### Anti-Pattern 1: Testing Implementation Details

```python
# BAD: testing internal implementation (method call order)
def test_order_creation_calls_methods_in_order():
    mock = Mock()
    service = OrderService(repo=mock)
    service.create_order(...)
    assert mock.method_calls == [
        call.validate(),        # coupled to internal call order
        call.calculate_tax(),
        call.save(),
    ]
    # Changing the internal implementation during refactoring breaks the test

# GOOD: test behavior (input → output)
def test_order_creation_returns_valid_order():
    repo = FakeOrderRepository()
    service = OrderService(repo=repo)
    result = service.create_order(user_id="u1", items=[...])
    assert result.status == "created"
    assert result.total > 0
```

**Why it is bad:** Tests coupled to implementation details break every time the code is refactored. When tests start blocking refactoring, the greatest value of tests — the ability to change code with confidence — is lost.

### Anti-Pattern 2: Slow Tests

```python
# BAD: initialize the DB in every test
def test_user_query(self):
    db.create_all()          # creates schema each time (slow)
    seed_test_data(1000)     # inserts 1000 records each time (slow)
    result = query_users()
    assert len(result) > 0
    db.drop_all()

# GOOD: share with fixtures, rollback with transactions
@pytest.fixture(scope="session")
def db():
    create_schema()
    yield database
    drop_schema()

@pytest.fixture(autouse=True)
def transaction(db):
    db.begin()
    yield
    db.rollback()    # rollback after each test (fast)
```

**Why it is bad:** When tests are slow, developers start avoiding running them. "Running tests is a pain" → "don't write tests" → "quality degrades" — a vicious cycle.

### Anti-Pattern 3: Verifying Multiple Concepts in One Test

```python
# BAD: verifying multiple concepts in a single test
def test_user_creation():
    user = service.create_user("Alice", "alice@example.com")
    assert user.id is not None                    # concept 1: ID generation
    assert user.name == "Alice"                   # concept 2: name saved
    assert user.email == "alice@example.com"      # concept 3: email saved
    assert user.created_at is not None            # concept 4: timestamp
    assert user.status == "active"                # concept 5: initial status
    assert email_was_sent("alice@example.com")    # concept 6: email sent
    assert audit_log_exists("user_created")       # concept 7: audit log

# GOOD: split tests by concept
def test_create_user_generates_unique_id():
    user = service.create_user("Alice", "alice@example.com")
    assert user.id is not None

def test_create_user_saves_name_and_email():
    user = service.create_user("Alice", "alice@example.com")
    assert user.name == "Alice"
    assert user.email == "alice@example.com"

def test_create_user_sets_initial_status_to_active():
    user = service.create_user("Alice", "alice@example.com")
    assert user.status == "active"

def test_create_user_sends_welcome_email():
    service.create_user("Alice", "alice@example.com")
    assert email_was_sent("alice@example.com")
```

### Anti-Pattern 4: Conditional Logic Inside Tests

```python
# BAD: conditional branching inside a test
def test_discount(user_type):
    calculator = DiscountCalculator()
    if user_type == "premium":
        assert calculator.calculate(10000, user_type) == 1500
    elif user_type == "regular":
        assert calculator.calculate(10000, user_type) == 1000
    else:
        assert calculator.calculate(10000, user_type) == 0

# GOOD: eliminate conditional branching with parameterized tests
@pytest.mark.parametrize("user_type, expected", [
    ("premium", 1500),
    ("regular", 1000),
    ("guest", 0),
])
def test_discount(user_type, expected):
    calculator = DiscountCalculator()
    assert calculator.calculate(10000, user_type) == expected
```

---

## 12. Practical Exercises

### Exercise 1 (Basic): Write tests using the AAA pattern

Write five or more unit tests for the following `PasswordValidator` class, following the AAA pattern.

```python
class PasswordValidator:
    MIN_LENGTH = 8
    MAX_LENGTH = 64

    def validate(self, password: str) -> ValidationResult:
        errors = []
        if len(password) < self.MIN_LENGTH:
            errors.append("At least 8 characters required")
        if len(password) > self.MAX_LENGTH:
            errors.append("Maximum 64 characters allowed")
        if not any(c.isupper() for c in password):
            errors.append("Must contain at least one uppercase letter")
        if not any(c.isdigit() for c in password):
            errors.append("Must contain at least one digit")
        return ValidationResult(is_valid=len(errors) == 0, errors=errors)
```

**Expected output:**

```python
class TestPasswordValidator:
    def setup_method(self):
        self.validator = PasswordValidator()

    def test_valid_password_returns_success(self):
        result = self.validator.validate("SecurePass1")
        assert result.is_valid is True
        assert result.errors == []

    def test_short_password_returns_error(self):
        result = self.validator.validate("Short1A")
        assert result.is_valid is False
        assert "At least 8 characters required" in result.errors

    def test_too_long_password_returns_error(self):
        result = self.validator.validate("A1" + "a" * 63)
        assert result.is_valid is False
        assert "Maximum 64 characters allowed" in result.errors

    def test_no_uppercase_returns_error(self):
        result = self.validator.validate("lowercase123")
        assert result.is_valid is False
        assert "Must contain at least one uppercase letter" in result.errors

    def test_no_digit_returns_error(self):
        result = self.validator.validate("NoDigitsHere")
        assert result.is_valid is False
        assert "Must contain at least one digit" in result.errors

    def test_multiple_violations_returns_all_errors(self):
        result = self.validator.validate("short")
        assert result.is_valid is False
        assert len(result.errors) >= 2
```

### Exercise 2 (Applied): Tests using test doubles

Write tests for the following `OrderService` that properly differentiate between Stub and Mock.

```python
class OrderService:
    def __init__(self, product_repo, payment_gateway, notifier):
        self._product_repo = product_repo
        self._payment = payment_gateway
        self._notifier = notifier

    def place_order(self, user_id, items):
        products = [self._product_repo.find_by_id(i["id"]) for i in items]
        total = sum(p.price * i["qty"] for p, i in zip(products, items))

        payment_result = self._payment.charge(user_id, total)
        if not payment_result.success:
            raise PaymentError(payment_result.error_message)

        order = Order(user_id=user_id, items=items, total=total)
        self._notifier.send_confirmation(user_id, order)
        return order
```

**Expected output:**

```python
def test_place_order_calculates_correct_total():
    # Stub: return fixed products from the product repository
    product_repo = StubProductRepo({
        "p1": Product(id="p1", price=1000),
        "p2": Product(id="p2", price=2000),
    })
    payment = StubPaymentGateway(always_succeeds=True)
    notifier = Mock()

    service = OrderService(product_repo, payment, notifier)
    order = service.place_order("u1", [
        {"id": "p1", "qty": 2},
        {"id": "p2", "qty": 1},
    ])

    assert order.total == 4000  # 1000*2 + 2000*1

def test_place_order_sends_confirmation():
    product_repo = StubProductRepo({"p1": Product(id="p1", price=1000)})
    payment = StubPaymentGateway(always_succeeds=True)
    notifier = Mock()  # Mock: verify that notification was called

    service = OrderService(product_repo, payment, notifier)
    service.place_order("u1", [{"id": "p1", "qty": 1}])

    # Verify that notification was called correctly
    notifier.send_confirmation.assert_called_once()

def test_place_order_raises_on_payment_failure():
    product_repo = StubProductRepo({"p1": Product(id="p1", price=1000)})
    payment = StubPaymentGateway(always_fails=True, error="Card declined")
    notifier = Mock()

    service = OrderService(product_repo, payment, notifier)

    with pytest.raises(PaymentError, match="Card declined"):
        service.place_order("u1", [{"id": "p1", "qty": 1}])

    # Verify that no notification is sent on payment failure
    notifier.send_confirmation.assert_not_called()
```

### Exercise 3 (Advanced): Designing property-based tests

Design property-based tests using hypothesis for the following `Money` class. Test at least three "properties that hold for any monetary amount."

```python
class Money:
    def __init__(self, amount: int, currency: str = "JPY"):
        if amount < 0:
            raise ValueError("Amount must be 0 or greater")
        self.amount = amount
        self.currency = currency

    def add(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise CurrencyMismatchError()
        return Money(self.amount + other.amount, self.currency)

    def multiply(self, factor: int) -> "Money":
        return Money(self.amount * factor, self.currency)
```

**Expected output:**

```python
from hypothesis import given, strategies as st

jpy_amount = st.integers(min_value=0, max_value=10**9)

# Property 1: commutativity of addition (a + b == b + a)
@given(a=jpy_amount, b=jpy_amount)
def test_addition_is_commutative(a, b):
    m1 = Money(a).add(Money(b))
    m2 = Money(b).add(Money(a))
    assert m1.amount == m2.amount

# Property 2: associativity of addition ((a + b) + c == a + (b + c))
@given(a=jpy_amount, b=jpy_amount, c=jpy_amount)
def test_addition_is_associative(a, b, c):
    left = Money(a).add(Money(b)).add(Money(c))
    right = Money(a).add(Money(b).add(Money(c)))
    assert left.amount == right.amount

# Property 3: adding zero is the identity (a + 0 == a)
@given(a=jpy_amount)
def test_adding_zero_is_identity(a):
    result = Money(a).add(Money(0))
    assert result.amount == a

# Property 4: distributive law for multiplication ((a + b) * n == a*n + b*n)
@given(a=jpy_amount, b=jpy_amount, n=st.integers(min_value=0, max_value=100))
def test_multiplication_distributes_over_addition(a, b, n):
    left = Money(a).add(Money(b)).multiply(n)
    right = Money(a).multiply(n).add(Money(b).multiply(n))
    assert left.amount == right.amount
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Invalid configuration file | Verify the path and format of the configuration file |
| Timeout | Network delay / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify executing user's permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with the minimum amount of code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use logging output or a debugger to verify hypotheses
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
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Called: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
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

Steps for diagnosing performance problems:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Verify disk and network I/O status
4. **Check concurrent connections**: Verify connection pool status

| Problem Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |
---

## 13. FAQ

### Q1. What percentage of test coverage should I aim for?

**A.** Coverage numbers are an indicator, not a goal. Around 80% is a realistic guideline, but what matters is "whether critical paths are covered." Aiming for 100% tends to produce low-value tests for things like getters/setters, increasing maintenance costs. The effective approach is to visualize areas with low coverage and prioritize adding tests for the parts with the highest business risk.

Using mutation testing alongside coverage can reveal tests that miss bugs even at 100% coverage. Use coverage as a "tool to find untested areas," not as a "metric of test quality."

### Q2. What should I do if tests run slowly?

**A.** Address in the following priority order:
1. Follow the test pyramid and increase the proportion of unit tests
2. Run tests in parallel (`pytest-xdist -n auto`)
3. Speed up DB tests with transaction rollback
4. Replace external APIs with test doubles
5. In CI, split tests and run in parallel jobs
6. Run only tests related to changed files (`pytest --picked`)
7. Use Docker layer caching and pip caching

Target: "all unit tests < 10 seconds, all tests < 5 minutes."

### Q3. How do I deal with flaky tests (unstable tests)?

**A.** The main causes of flaky tests are (1) order dependency between tests, (2) timing dependency (insufficient waiting for async processing to complete), and (3) dependency on external services. Countermeasures include verifying independence (run in random order), explicit waiting (polling + timeout), and mocking external dependencies. If root cause resolution is not possible, quarantine the test and address it individually.

Always track flaky tests. If "this test sometimes fails" is left unaddressed, the entire team will stop trusting test results.

### Q4. Should TDD always be practiced?

**A.** TDD is a powerful technique, but it should not be applied to all code. It is particularly effective in the following situations:
- **Business logic**: Input and output are clear, and test-first feels natural
- **Bug fixes**: Write a test that reproduces the bug first, then fix it to make it green
- **API design**: Tests provide the perspective of an API consumer

On the other hand, TDD can be inefficient in the following situations:
- **Prototyping**: Specifications are fluid and tests are likely to become obsolete
- **UI layout**: Visual tests are not well suited to TDD
- **Exploratory implementation**: When what you are building is itself unclear

### Q5. Do test code reviews need to happen?

**A.** Yes. Test code is part of production code and maintainability matters. Key review points:
- Does the test name express the intent?
- Does it follow the AAA pattern?
- Does the test verify behavior rather than implementation details?
- Are boundary values and edge cases considered?
- Is the use of test doubles appropriate?

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but from actually writing code and observing behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| Role of tests | Regression protection, design feedback, documentation |
| AAA pattern | Structured in three stages: Arrange → Act → Assert |
| FIRST principles | Fast, Independent, Repeatable, Self-Validating, Timely |
| Test pyramid | Unit 70% : Integration 20% : E2E 10% |
| Test doubles | Use Stub (input), Mock (verify output), Fake (simplified implementation) appropriately |
| Naming convention | [subject]_[condition]_[expected result] to express intent |
| Behavioral testing | Test inputs and outputs, not implementation details |
| Coverage | ~80% guideline. Verify quality with mutation testing as well |
| Flaky test countermeasures | Random order execution, polling waits, mocking external dependencies |

---

## Guides to Read Next

- [Legacy Code](../02-refactoring/02-legacy-code.md) ── Techniques for adding tests to existing code without tests (characterization tests, finding seams)
- [Continuous Improvement](../02-refactoring/04-continuous-improvement.md) ── Automating tests in CI/CD and setting quality gates
- [Code Smells](../02-refactoring/00-code-smells.md) ── Guidelines for improving code that is hard to test
- [Refactoring Techniques](../02-refactoring/01-refactoring-techniques.md) ── Techniques for improving code while protecting it with tests
- [API Design](../03-practices-advanced/03-api-design.md) ── Designing API tests and contract tests
- [Comments](./03-comments.md) ── Documentation in test code

---

## References

1. **Vladimir Khorikov** *Unit Testing Principles, Practices, and Patterns* Manning, 2020 ── The definitive guide to test design. Explains the pitfalls of overusing Mocks and the importance of behavioral testing
2. **Kent Beck** *Test Driven Development: By Example* Addison-Wesley, 2002 ── The original text on TDD. An explanation by the inventor of the Red-Green-Refactor cycle
3. **Gerard Meszaros** *xUnit Test Patterns: Refactoring Test Code* Addison-Wesley, 2007 ── An encyclopedia of test patterns. The original source for the classification of test doubles
4. **Steve Freeman & Nat Pryce** *Growing Object-Oriented Software, Guided by Tests* Addison-Wesley, 2009 ── Outside-In TDD using Mocks
5. **Martin Fowler** "TestPyramid" (Blog, 2012) ── https://martinfowler.com/bliki/TestPyramid.html ── Explanation of the test pyramid and practical guidelines
