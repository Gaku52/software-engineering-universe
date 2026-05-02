# Legacy Code

> Legacy code is code without tests (Michael Feathers). This chapter explains systematic techniques for safely modifying codebases that have been maintained for years and whose overall picture no one fully grasps — covering dependency breaking, characterization tests, and the Strangler Fig pattern. Feathers wrote in *Working Effectively with Legacy Code*: "Legacy code is a source of fear — without tests, you never know what will break when you make a change." This chapter dives deep into practical techniques for removing that fear and improving legacy code in a planned, systematic way.

---

## Prerequisites

| Prerequisite | Reference |
|------|--------|
| Code smell taxonomy | [00-code-smells.md](./00-code-smells.md) |
| Refactoring techniques | [01-refactoring-techniques.md](./01-refactoring-techniques.md) |
| Testing fundamentals (AAA, test doubles) | [01-practices/04-testing-principles.md](../01-practices/04-testing-principles.md) |
| Clean code core principles | [00-principles/](../00-principles/) |

---

## What You Will Learn in This Chapter

1. **Definition and characteristics of legacy code** — Understand the essence of legacy code as "code without tests" and how to quantitatively assess change risk
2. **Finding Seams** — Master techniques for identifying points where behavior can be substituted without editing the code
3. **Characterization Tests** — Learn how to document current behavior and build a safety net for refactoring
4. **Sprout / Wrap patterns** — Master techniques for safely adding new features without modifying existing code
5. **Strangler Fig pattern** — Learn how to design a phased modernization strategy for large-scale legacy systems

---

## 1. Legacy Code Characteristics and Assessment

### 1.1 Definition of Legacy Code

Michael Feathers' definition is the most widely accepted:

```
  Legacy code = code without tests

  ┌─────────────────────────────────────────────────────┐
  │  Why is "no tests" a problem?                       │
  │                                                     │
  │  No tests                                           │
  │    → Cannot verify the impact of changes            │
  │    → Afraid to make changes                         │
  │    → Avoid making changes                           │
  │    → Code rots                                      │
  │    → Even more afraid to change                     │
  │    → ★ Spiral of fear                               │
  │                                                     │
  │  Tests exist                                        │
  │    → Can immediately verify the impact of changes   │
  │    → Can change with confidence                     │
  │    → Can actively improve                           │
  │    → Code stays healthy                             │
  │    → ★ Spiral of improvement                        │
  └─────────────────────────────────────────────────────┘
```

### 1.2 Typical Signs of Legacy Code

```
  Legacy code symptom checklist

  □ No tests (or almost none)
  □ Documentation is outdated or nonexistent
  □ Build takes more than 15 minutes
  □ God Class of 5,000+ lines exists in a single file
  □ Global state (static variables, singletons) is heavily used
  □ Dependencies are directly instantiated with new (no DI)
  □ There is an unspoken agreement that "touching it breaks things"
  □ No one on the team understands the big picture
  □ Each change causes bugs in unexpected places
  □ Production deployments are a fearful event

  ┌─────────────────────────────────────────────┐
  │  Typical structure of legacy code           │
  │                                             │
  │  [God Class (5,000 lines)]                  │
  │     |                                       │
  │     +-- static config (global)              │
  │     +-- static dbConn (global)              │
  │     +-- new DBConnection()  (direct)        │
  │     +-- new HttpClient()    (direct)        │
  │     +-- new EmailSender()   (direct)        │
  │                                             │
  │  Tests: none (or almost none)               │
  │  Documentation: 3 years old                 │
  │  Build: 15 minutes                          │
  └─────────────────────────────────────────────┘
```

### 1.3 Change Risk Matrix

Not all legacy code needs to be treated equally. Use a matrix of change frequency vs. complexity to prioritize.

```
            High change frequency
                 |
   +-------------+-------------+
   |  Zone A:    |  Zone B:    |
   |  Low risk · |  High risk ·|  ← Highest priority for improvement
   |  High freq  |  High freq  |
   |             |             |
   |  Monitor    |  Add tests  |
   |  only. OK   |  Refactor   |
   +-------------+-------------+
   |  Zone C:    |  Zone D:    |
   |  Low risk · |  High risk ·|  ← Leave until you need to touch it
   |  Low freq   |  Low freq   |
   |             |             |
   |  Leave      |  Next phase |
   +-------------+-------------+
                 |
            Low change frequency
   Low complexity ----+---- High complexity

  ★ Starting with Zone B (high risk · high frequency) is most efficient
```

### 1.4 Visualizing Dependencies

**Code Example 1: Dependency Analysis Script (Python)**

```python
#!/usr/bin/env python3
"""
Script to visualize dependencies in legacy code.
Analyzes the number of dependencies and dependents for each module
to determine refactoring priority.
"""
import ast
import sys
from pathlib import Path
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class ModuleDependency:
    """Module dependency information"""
    module: str
    imports: list[str] = field(default_factory=list)
    imported_by: list[str] = field(default_factory=list)

    @property
    def afferent_coupling(self) -> int:
        """Afferent coupling: number of modules that depend on this module"""
        return len(self.imported_by)

    @property
    def efferent_coupling(self) -> int:
        """Efferent coupling: number of modules this module depends on"""
        return len(self.imports)

    @property
    def instability(self) -> float:
        """Instability: 0.0 (stable) ~ 1.0 (unstable)"""
        total = self.afferent_coupling + self.efferent_coupling
        if total == 0:
            return 0.0
        return self.efferent_coupling / total


def analyze_dependencies(src_path: str) -> dict[str, ModuleDependency]:
    """Analyze dependencies in source code"""
    modules: dict[str, ModuleDependency] = {}

    for py_file in Path(src_path).rglob("*.py"):
        module_name = str(py_file.relative_to(src_path)).replace("/", ".").rstrip(".py")
        tree = ast.parse(py_file.read_text())

        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)

        modules[module_name] = ModuleDependency(
            module=module_name, imports=imports
        )

    # Build reverse dependency map
    for mod_name, mod_dep in modules.items():
        for imp in mod_dep.imports:
            if imp in modules:
                modules[imp].imported_by.append(mod_name)

    return modules


def print_dependency_report(modules: dict[str, ModuleDependency]) -> None:
    """Output dependency analysis report"""
    print("=" * 70)
    print("  Dependency Analysis Report")
    print("=" * 70)
    print(f"{'Module':<30} {'Deps':>6} {'Dependents':>10} {'Instability':>12}")
    print("-" * 70)

    sorted_modules = sorted(
        modules.values(),
        key=lambda m: m.efferent_coupling,
        reverse=True
    )
    for mod in sorted_modules[:20]:
        stability = "stable" if mod.instability < 0.3 else (
            "medium" if mod.instability < 0.7 else "unstable"
        )
        print(f"{mod.module:<30} {mod.efferent_coupling:>6} "
              f"{mod.afferent_coupling:>10} {mod.instability:>11.2f} ({stability})")

    # Detect circular dependencies
    print("\n--- Circular Dependency Detection ---")
    for mod_name, mod_dep in modules.items():
        for imp in mod_dep.imports:
            if imp in modules and mod_name in modules[imp].imports:
                print(f"  ⚠ {mod_name} <-> {imp}")
```

```
  Identifying change targets: impact propagation analysis

  [OrderProcessor]
       |
       +-- depends on --> [PriceCalculator]
       |                       |
       +-- depends on --> [InventoryChecker]
       |                       |
       +-- depends on --> [DatabaseHelper] ← static method (hard to test)
       |                       |
       +-- depends on --> [EmailSender]    ← external service (hard to test)

  Priority for safe changes:
  1. Break dependencies on DatabaseHelper and EmailSender
  2. Add characterization tests to OrderProcessor
  3. Make the change
  4. Confirm tests pass
```

---

## 2. Finding Seams

### 2.1 What Is a Seam?

A Seam is a concept defined by Michael Feathers: "a place where you can alter behavior in your program without editing in that place." Used during testing to substitute dependencies with test doubles.

**Code Example 2: Types of Seams and Their Application (Python)**

```python
# ────────────────────────────────────────
# No seam: not testable
# ────────────────────────────────────────
class OrderProcessor:
    """Directly instantiates dependencies → requires DB and mail server during tests"""

    def process(self, order):
        # Static method → cannot substitute during tests
        db = DatabaseHelper.get_connection()
        result = db.execute("SELECT stock FROM products ...", order.product_id)

        if result.stock < order.quantity:
            raise InsufficientStockError()

        # Direct instantiation → cannot substitute during tests
        inventory = InventoryChecker()
        inventory.reserve(order.product_id, order.quantity)

        # Static method → email is actually sent during tests
        EmailSender.send(
            to=order.customer_email,
            subject="Order Confirmed",
            body=f"Order {order.id} has been confirmed"
        )


# ────────────────────────────────────────
# Object Seam: constructor injection
# ────────────────────────────────────────
class OrderProcessor:
    """Injects dependencies → can be substituted with test doubles during tests"""

    def __init__(self, db_connection, inventory_checker, email_sender):
        self._db = db_connection              # injected → can be replaced with Stub
        self._inventory = inventory_checker   # injected → can be replaced with Mock
        self._email = email_sender            # injected → can be replaced with Fake

    def process(self, order):
        result = self._db.execute("SELECT stock FROM products ...", order.product_id)

        if result.stock < order.quantity:
            raise InsufficientStockError()

        self._inventory.reserve(order.product_id, order.quantity)
        self._email.send(
            to=order.customer_email,
            subject="Order Confirmed",
            body=f"Order {order.id} has been confirmed"
        )


# Test: inject test doubles
def test_order_process_sends_email():
    fake_db = FakeDatabase(stock=10)
    mock_inventory = Mock()
    mock_email = Mock()

    processor = OrderProcessor(fake_db, mock_inventory, mock_email)
    processor.process(Order(product_id="P001", quantity=2, customer_email="a@b.com"))

    mock_email.send.assert_called_once()
    mock_inventory.reserve.assert_called_once_with("P001", 2)
```

### 2.2 Types of Seams

| Seam Type | Mechanism | Use Case | Safety |
|------------|--------|---------|:------:|
| Object Seam | Constructor/setter injection | Most common. Works well with DI containers | High |
| Preprocessing Seam | Macros/conditional compilation | C/C++ legacy code | Low |
| Link Seam | Replace library at link time | Binary-level substitution | Medium |
| Subclass Seam | Extract & Override | Override in test subclass | Medium |

### 2.3 Extract and Override

One of the safest techniques for creating a Seam. Extract the difficult-to-test portion into a method, then override it in a test subclass.

**Code Example 3: Extract and Override (Python)**

```python
# ────────────────────────────────────────
# Step 1: Extract the hard-to-test portion into a method
# ────────────────────────────────────────
class OrderProcessor:
    def process(self, order):
        price = self._calculate_price(order)
        self._save_to_database(order, price)    # extracted method
        self._send_notification(order)          # extracted method
        return price

    def _calculate_price(self, order):
        """Pure calculation logic — testable"""
        base_price = order.unit_price * order.quantity
        if order.quantity >= 10:
            return int(base_price * 0.9)  # 10% discount for 10+ items
        return base_price

    def _save_to_database(self, order, price):
        """DB save — hard-to-test external dependency"""
        db = DatabaseHelper.get_connection()
        db.execute("INSERT INTO orders VALUES (%s, %s)", order.id, price)

    def _send_notification(self, order):
        """Email send — hard-to-test external dependency"""
        EmailSender.send(order.customer_email, "Order Confirmed",
                         f"Total: {order.total}")


# ────────────────────────────────────────
# Step 2: Override in test subclass
# ────────────────────────────────────────
class TestableOrderProcessor(OrderProcessor):
    """For testing: replace DB and email"""

    def __init__(self):
        self.saved_orders: list[tuple] = []
        self.sent_emails: list[str] = []

    def _save_to_database(self, order, price):
        """Record saved content without using DB"""
        self.saved_orders.append((order.id, price))

    def _send_notification(self, order):
        """Record recipient without sending email"""
        self.sent_emails.append(order.customer_email)


# ────────────────────────────────────────
# Step 3: Test
# ────────────────────────────────────────
import pytest

class TestOrderProcessor:
    def test_process_calculates_correct_price(self):
        """Test business logic (price calculation)"""
        processor = TestableOrderProcessor()
        order = Order(id="O001", unit_price=1000, quantity=2,
                      customer_email="test@example.com")

        result = processor.process(order)

        assert result == 2000

    def test_process_applies_bulk_discount(self):
        """Test 10% discount for 10 or more items"""
        processor = TestableOrderProcessor()
        order = Order(id="O002", unit_price=1000, quantity=10,
                      customer_email="test@example.com")

        result = processor.process(order)

        assert result == 9000  # 10000 * 0.9

    def test_process_saves_to_database(self):
        """Verify that DB save is called"""
        processor = TestableOrderProcessor()
        order = Order(id="O003", unit_price=500, quantity=3,
                      customer_email="test@example.com")

        processor.process(order)

        assert len(processor.saved_orders) == 1
        assert processor.saved_orders[0] == ("O003", 1500)

    def test_process_sends_notification(self):
        """Verify that email send is called"""
        processor = TestableOrderProcessor()
        order = Order(id="O004", unit_price=500, quantity=1,
                      customer_email="customer@example.com")

        processor.process(order)

        assert processor.sent_emails == ["customer@example.com"]
```

---

## 3. Characterization Tests

### 3.1 What Is a Characterization Test?

A characterization test is a test that "records" the current behavior. It tests "actual" behavior, not "correct" behavior. Its purpose is to guarantee that the same values are returned after refactoring.

```
  The idea behind characterization tests

  ┌─────────────────────────────────────────┐
  │  Normal test:                           │
  │  "Set expected value based on spec"     │
  │  → assert calculate(100, 10) == 110    │
  │  (spec: 100 + 10% = 110)               │
  │                                         │
  │  Characterization test:                 │
  │  "Run it and record the actual result"  │
  │  → assert calculate(100, 10) == 108    │
  │  (reality: 108 for some reason.         │
  │   Bug? Spec? Unknown.)                  │
  │                                         │
  │  ★ Characterization tests don't ask    │
  │    "is this correct?"                   │
  │  ★ They guarantee "same result after   │
  │    refactoring"                         │
  └─────────────────────────────────────────┘
```

**Code Example 4: Creating Characterization Tests (Python)**

```python
# ────────────────────────────────────────
# Characterization test: "records" current behavior
# ────────────────────────────────────────
class TestLegacyPriceCalculatorCharacterization:
    """
    Characterization test: records current behavior of LegacyPriceCalculator.
    As long as these tests pass, refactoring is safe.
    """

    def setup_method(self):
        self.calculator = LegacyPriceCalculator()

    def test_single_item_basic_price(self):
        """Basic price for a single item"""
        result = self.calculator.calculate(
            items=[{"price": 100, "qty": 1}]
        )
        assert result == 100

    def test_multiple_items_basic_price(self):
        """Basic price for multiple items (no discount)"""
        result = self.calculator.calculate(
            items=[{"price": 100, "qty": 5}]
        )
        assert result == 500

    def test_bulk_discount_at_10(self):
        """Discount is applied for 10 or more items"""
        result = self.calculator.calculate(
            items=[{"price": 100, "qty": 10}]
        )
        assert result == 900  # 10% discount? Spec unknown but recorded

    def test_empty_items(self):
        """When the list is empty"""
        result = self.calculator.calculate(items=[])
        assert result == 0

    def test_zero_price(self):
        """Item with price 0"""
        result = self.calculator.calculate(
            items=[{"price": 0, "qty": 5}]
        )
        assert result == 0

    def test_negative_price_boundary(self):
        """Negative price — possibly a bug, but recording current behavior"""
        result = self.calculator.calculate(
            items=[{"price": -100, "qty": 1}]
        )
        assert result == -100  # ★ May be a bug, but the goal is to record current state

    def test_large_quantity(self):
        """Large quantity order"""
        result = self.calculator.calculate(
            items=[{"price": 100, "qty": 1000}]
        )
        assert result == 80000  # 20% discount? Spec unknown


# ────────────────────────────────────────
# Auto-generating characterization tests (large-scale cases)
# ────────────────────────────────────────
import json
import itertools

def generate_characterization_tests(output_path: str = "characterization_tests.json"):
    """
    Auto-generate characterization tests and save to JSON.
    Comprehensively records the behavior of legacy code.
    """
    calculator = LegacyPriceCalculator()
    test_cases = []

    # Generate input combinations including boundary values
    prices = [0, 1, 50, 100, 500, 999, 1000, 5000, 9999, 10000]
    quantities = [0, 1, 5, 9, 10, 11, 50, 100, 500, 1000]

    for price, qty in itertools.product(prices, quantities):
        try:
            result = calculator.calculate(
                items=[{"price": price, "qty": qty}]
            )
            test_cases.append({
                "input": {"price": price, "qty": qty},
                "expected": result,
                "error": None
            })
        except Exception as e:
            test_cases.append({
                "input": {"price": price, "qty": qty},
                "expected": None,
                "error": str(e)
            })

    with open(output_path, "w") as f:
        json.dump(test_cases, f, indent=2, ensure_ascii=False)

    print(f"Generated test cases: {len(test_cases)}")
    print(f"Saved to: {output_path}")
    return test_cases


# ────────────────────────────────────────
# Parameterized tests using saved cases
# ────────────────────────────────────────
def load_test_cases(path: str) -> list[dict]:
    with open(path) as f:
        return json.load(f)


@pytest.mark.parametrize("case", load_test_cases("characterization_tests.json"))
def test_refactored_matches_legacy(case):
    """Verify that refactored code returns the same result as the legacy"""
    calculator = RefactoredPriceCalculator()  # new implementation

    if case["error"]:
        with pytest.raises(Exception):
            calculator.calculate(items=[case["input"]])
    else:
        result = calculator.calculate(items=[case["input"]])
        assert result == case["expected"], (
            f"Input: {case['input']}, "
            f"Expected: {case['expected']}, Actual: {result}"
        )
```

### 3.2 Golden Master Tests

An advanced form of characterization tests that saves large numbers of inputs/outputs to a file and compares them against output after refactoring.

**Code Example 5: Golden Master Tests (Python)**

```python
import hashlib
from pathlib import Path

class GoldenMasterTest:
    """
    Golden Master test:
    Save legacy system output as a snapshot,
    and verify the same output is produced after refactoring.
    """
    GOLDEN_DIR = Path("tests/golden_masters")

    def __init__(self, system_under_test):
        self.sut = system_under_test
        self.GOLDEN_DIR.mkdir(parents=True, exist_ok=True)

    def capture(self, test_name: str, inputs: list[dict]) -> None:
        """Generate and save the golden master"""
        outputs = []
        for inp in inputs:
            try:
                result = self.sut.process(**inp)
                outputs.append({"input": inp, "output": result, "error": None})
            except Exception as e:
                outputs.append({"input": inp, "output": None, "error": str(e)})

        golden_path = self.GOLDEN_DIR / f"{test_name}.json"
        with open(golden_path, "w") as f:
            json.dump(outputs, f, indent=2, ensure_ascii=False, default=str)

        # Also save a checksum
        checksum = hashlib.sha256(
            json.dumps(outputs, sort_keys=True).encode()
        ).hexdigest()
        (self.GOLDEN_DIR / f"{test_name}.sha256").write_text(checksum)

        print(f"Golden master saved: {golden_path} ({len(outputs)} cases)")

    def verify(self, test_name: str) -> bool:
        """Verify that current output matches the golden master"""
        golden_path = self.GOLDEN_DIR / f"{test_name}.json"
        with open(golden_path) as f:
            golden = json.load(f)

        mismatches = []
        for case in golden:
            try:
                actual = self.sut.process(**case["input"])
                if actual != case["output"]:
                    mismatches.append({
                        "input": case["input"],
                        "expected": case["output"],
                        "actual": actual,
                    })
            except Exception as e:
                if case["error"] is None or str(e) != case["error"]:
                    mismatches.append({
                        "input": case["input"],
                        "expected_error": case["error"],
                        "actual_error": str(e),
                    })

        if mismatches:
            print(f"Mismatches: {len(mismatches)}")
            for m in mismatches[:5]:
                print(f"  {m}")
            return False

        print(f"OK: all {len(golden)} cases match")
        return True
```

---

## 4. Sprout / Wrap Patterns

### 4.1 Sprout Method

Add new functionality as a "sprout" — a new, tested method — without modifying existing code.

**Code Example 6: Sprout Method (Python)**

```python
# ────────────────────────────────────────
# Situation: want to add "loyalty discount" to a large process() method
# However, process() has no tests and is structurally complex — scary to change
# ────────────────────────────────────────

# BEFORE: large method we want to change (no tests)
class OrderProcessor:
    def process(self, order):
        # ... 200 lines of complex processing (hard to understand) ...
        total = self._legacy_calculate(order)
        # ... 100 more lines of complex processing ...
        return total


# AFTER: new feature "sprouts" as a new, tested method
class OrderProcessor:
    def process(self, order):
        # ... 200 lines of complex processing (unchanged) ...
        total = self._legacy_calculate(order)

        # ★ Sprout: add new feature as an independent method
        discount = self._calculate_loyalty_discount(order, total)
        total = total - discount

        # ... 100 more lines of complex processing (unchanged) ...
        return total

    def _calculate_loyalty_discount(self, order, total: int) -> int:
        """
        New feature: loyalty discount (with tests)

        Customers with 3+ years get 5% off, 5+ years get 10% off.
        ★ This new method has tests → safe
        """
        years = order.customer.loyalty_years
        if years >= 5:
            return int(total * 0.10)
        elif years >= 3:
            return int(total * 0.05)
        return 0


# ────────────────────────────────────────
# Tests: only test the new Sprout method
# ────────────────────────────────────────
class TestLoyaltyDiscount:
    def setup_method(self):
        self.processor = OrderProcessor()

    def test_no_discount_for_new_customer(self):
        order = create_order(loyalty_years=1)
        assert self.processor._calculate_loyalty_discount(order, 10000) == 0

    def test_5_percent_for_3_year_customer(self):
        order = create_order(loyalty_years=3)
        assert self.processor._calculate_loyalty_discount(order, 10000) == 500

    def test_10_percent_for_5_year_customer(self):
        order = create_order(loyalty_years=5)
        assert self.processor._calculate_loyalty_discount(order, 10000) == 1000

    def test_10_percent_for_veteran_customer(self):
        order = create_order(loyalty_years=10)
        assert self.processor._calculate_loyalty_discount(order, 10000) == 1000
```

### 4.2 Sprout Class

When a new feature has a cohesive responsibility, add it as a class rather than a method.

**Code Example 7: Sprout Class (Python)**

```python
# Add new functionality as an independent class
class LoyaltyDiscountCalculator:
    """
    Loyalty discount calculation — Sprout Class
    A fully tested, independent class.
    """
    TIERS = [
        (10, Decimal("0.15")),  # 10+ years: 15%
        (5, Decimal("0.10")),   # 5+ years: 10%
        (3, Decimal("0.05")),   # 3+ years: 5%
    ]

    def calculate(self, customer: Customer, amount: Decimal) -> Decimal:
        """Calculate loyalty discount amount"""
        rate = self._get_discount_rate(customer.loyalty_years)
        return (amount * rate).quantize(Decimal("1"))

    def _get_discount_rate(self, years: int) -> Decimal:
        """Discount rate based on customer loyalty years"""
        for min_years, rate in self.TIERS:
            if years >= min_years:
                return rate
        return Decimal("0")


# Integrate into existing code with minimal changes
class OrderProcessor:
    def __init__(self):
        self._loyalty_calculator = LoyaltyDiscountCalculator()  # Sprout

    def process(self, order):
        # ... existing complex processing (unchanged) ...
        total = self._legacy_calculate(order)

        # Add one line to call the Sprout Class
        discount = self._loyalty_calculator.calculate(order.customer, total)
        total -= discount

        # ... existing complex processing (unchanged) ...
        return total
```

### 4.3 Wrap Method

Wrap an existing method to add processing before and after it. Separate the old and new logic internally while preserving the existing method name.

**Code Example 8: Wrap Method (Python)**

```python
# BEFORE: complex report generation logic (do not want to change)
class ReportGenerator:
    def generate(self, data):
        # ... complex report generation logic (200 lines) ...
        return report


# AFTER: wrap the existing method
class ReportGenerator:
    def generate(self, data):
        """Wrapper: add pre/post processing"""
        self._log_generation_start(data)           # ← new: wrap (pre-processing)
        self._validate_input(data)                 # ← new: wrap (pre-processing)
        report = self._generate_legacy(data)       # ← old: renamed
        self._record_metrics(report)               # ← new: wrap (post-processing)
        self._log_generation_complete(report)       # ← new: wrap (post-processing)
        return report

    def _generate_legacy(self, data):
        """Original complex logic — unchanged"""
        # ... 200 lines of legacy code ...
        return report

    def _log_generation_start(self, data):
        """New: log report generation start"""
        logger.info(f"Report generation started: {data.get('report_type')}")

    def _validate_input(self, data):
        """New: pre-validation of input data"""
        if not data:
            raise ValueError("Data is empty")
        if 'report_type' not in data:
            raise ValueError("report_type is not specified")

    def _record_metrics(self, report):
        """New: record metrics"""
        metrics.increment('reports_generated')
        metrics.histogram('report_size', len(str(report)))

    def _log_generation_complete(self, report):
        """New: log report generation completion"""
        logger.info(f"Report generation complete: {len(str(report))} characters")
```

---

## 5. Strangler Fig Pattern

### 5.1 Concept

The Strangler Fig pattern is a technique for incrementally replacing a legacy system with a new one. Martin Fowler named it after the strangler fig trees of Australia.

```
  Strangler Fig Pattern: 4 Phases

  Phase 1: Place a facade
  ┌──────┐    ┌─────────────┐    ┌─────────────────┐
  │Client│ -> │ Facade/Proxy│ -> │ Legacy System   │
  └──────┘    └─────────────┘    └─────────────────┘

  Phase 2: Implement new features in the new system
  ┌──────┐    ┌─────────┐  ┌──> │ Legacy System   │ (existing features)
  │Client│ -> │ Facade  │──┤    └─────────────────┘
  └──────┘    └─────────┘  └──> │ New System      │ (new features)
                                └─────────────────┘

  Phase 3: Migrate existing features incrementally
  ┌──────┐    ┌─────────┐  ┌──> │ Legacy (remainder)│
  │Client│ -> │ Facade  │──┤    └───────────────────┘
  └──────┘    └─────────┘  └──> │ New System        │ (most features)
                                └───────────────────┘

  Phase 4: Completely replace legacy
  ┌──────┐    ┌─────────┐       ┌─────────────────┐
  │Client│ -> │ Facade  │ ----> │ New System      │ (all features)
  └──────┘    └─────────┘       └─────────────────┘
                                Legacy is decommissioned
```

### 5.2 Routing with Feature Flags

**Code Example 9: Strangler Fig Implementation (Python)**

```python
from enum import Enum
from typing import Protocol


class FeatureFlag(Enum):
    """Centralized management of feature flags"""
    NEW_ORDER_CREATION = "new_order_creation"
    NEW_ORDER_RETRIEVAL = "new_order_retrieval"
    NEW_PAYMENT_PROCESSING = "new_payment_processing"
    NEW_NOTIFICATION = "new_notification"


class FeatureFlagService:
    """Feature flag service — reads from environment variables, DB, or config files"""

    def __init__(self, config: dict[str, bool]):
        self._config = config

    def is_enabled(self, flag: FeatureFlag) -> bool:
        """Returns whether the specified flag is enabled"""
        return self._config.get(flag.value, False)

    @classmethod
    def from_env(cls) -> "FeatureFlagService":
        """Load flags from environment variables"""
        import os
        config = {}
        for flag in FeatureFlag:
            config[flag.value] = os.getenv(
                f"FF_{flag.value.upper()}", "false"
            ).lower() == "true"
        return cls(config)


class OrderService(Protocol):
    """Order service interface"""
    def create_order(self, order_data: dict) -> Order: ...
    def get_order(self, order_id: str) -> Order: ...


class OrderFacade:
    """
    Strangler Fig Facade:
    Routes between legacy and new system based on feature flags.
    """

    def __init__(self, legacy: OrderService, new: OrderService,
                 flags: FeatureFlagService):
        self._legacy = legacy
        self._new = new
        self._flags = flags

    def create_order(self, order_data: dict) -> Order:
        if self._flags.is_enabled(FeatureFlag.NEW_ORDER_CREATION):
            return self._new.create_order(order_data)
        return self._legacy.create_order(order_data)

    def get_order(self, order_id: str) -> Order:
        if self._flags.is_enabled(FeatureFlag.NEW_ORDER_RETRIEVAL):
            return self._new.get_order(order_id)
        return self._legacy.get_order(order_id)


# ────────────────────────────────────────
# Usage example: phased migration
# ────────────────────────────────────────

# Phase 2: only new features handled by new system
flags = FeatureFlagService({
    "new_order_creation": True,     # new system
    "new_order_retrieval": False,   # still legacy
    "new_payment_processing": False,
    "new_notification": False,
})

facade = OrderFacade(
    legacy=LegacyOrderService(),
    new=NewOrderService(),
    flags=flags
)

# Phase 3: migrate existing features incrementally
flags = FeatureFlagService({
    "new_order_creation": True,     # migrated
    "new_order_retrieval": True,    # newly enabled ← migrated
    "new_payment_processing": False,
    "new_notification": False,
})
```

### 5.3 Safe Rollback with Strangler Fig

```python
# Rollback-capable Facade
class SafeOrderFacade:
    """
    Safe Strangler Fig Facade:
    Automatically falls back to legacy if an error occurs in the new system.
    """

    def __init__(self, legacy, new, flags, metrics):
        self._legacy = legacy
        self._new = new
        self._flags = flags
        self._metrics = metrics

    def create_order(self, order_data: dict) -> Order:
        if self._flags.is_enabled(FeatureFlag.NEW_ORDER_CREATION):
            try:
                result = self._new.create_order(order_data)
                self._metrics.increment("new_system.success")
                return result
            except Exception as e:
                self._metrics.increment("new_system.fallback")
                logger.warning(
                    f"Error in new system, falling back to legacy: {e}"
                )
                # Automatic fallback
                return self._legacy.create_order(order_data)
        return self._legacy.create_order(order_data)
```

### 5.4 Verification via Parallel Execution

**Code Example 10: Shadow Mode / Dark Launch (Python)**

```python
class ParallelVerificationFacade:
    """
    Parallel execution Facade:
    Process in both old and new systems and compare results.
    Returns the legacy response while logging any discrepancies.
    """

    def __init__(self, legacy, new, comparator, metrics):
        self._legacy = legacy
        self._new = new
        self._comparator = comparator
        self._metrics = metrics

    def create_order(self, order_data: dict) -> Order:
        # Get legacy result (this is the official response)
        legacy_result = self._legacy.create_order(order_data)

        # Get new system result asynchronously (Shadow Mode)
        try:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(self._new.create_order, order_data)
                new_result = future.result(timeout=5)

            # Compare results
            if self._comparator.are_equivalent(legacy_result, new_result):
                self._metrics.increment("parallel.match")
            else:
                self._metrics.increment("parallel.mismatch")
                logger.warning(
                    f"Mismatch between old and new results: "
                    f"legacy={legacy_result}, new={new_result}"
                )
        except Exception as e:
            self._metrics.increment("parallel.new_system_error")
            logger.error(f"Error in new system (Shadow Mode): {e}")

        # ★ Always return the legacy result
        return legacy_result
```

---

## 6. Phased Modernization Strategy

### 6.1 Improvement Roadmap

```
  5-Stage Roadmap for Legacy Code Improvement

  Stage 1 (1-2 weeks): Visualization
  ├── Analyze and visualize dependencies
  ├── Hotspot analysis: change frequency x complexity
  ├── Assess current test coverage
  └── Create technical debt backlog

  Stage 2 (2-4 weeks): Build a safety net
  ├── Add characterization tests to hotspots
  ├── Build CI pipeline
  ├── Set test coverage baseline
  └── Automate deployments

  Stage 3 (ongoing): Incremental refactoring
  ├── Find Seams and introduce dependency injection
  ├── Improve structure with Extract Method / Extract Class
  ├── Safely add new features with Sprout/Wrap
  └── Practice the Boy Scout Rule

  Stage 4 (quarterly): Large-scale improvements
  ├── Migrate large modules with Strangler Fig
  ├── Gradually improve architecture
  └── Update frameworks/libraries

  Stage 5 (annually): Review and plan
  ├── Review remaining technical debt
  ├── Evaluate ROI of improvements
  └── Draft next year's improvement plan
```

### 6.2 Code Archaeology with Git

**Code Example 11: Legacy Code Archaeology Script (Bash)**

```bash
#!/bin/bash
# Legacy code archaeology: analyze improvement priority from Git history

echo "=== Legacy Code Archaeology Report ==="

# 1. Most frequently changed files (last 6 months)
echo ""
echo "--- Top 20 by change frequency (last 6 months) ---"
git log --format=format: --name-only --since="6 months ago" \
  | sort | uniq -c | sort -rn | head -20

# 2. Files touched by the most developers (dispersed knowledge)
echo ""
echo "--- Top 10 files by number of contributors ---"
git log --format='%aN' --name-only --since="1 year ago" \
  | awk '/^$/{next} /^[^\/]/{author=$0; next} {print author, $0}' \
  | sort -u | awk '{print $NF}' | sort | uniq -c | sort -rn | head -10

# 3. Large files that haven't been changed recently (forgotten legacy)
echo ""
echo "--- Large files not recently modified ---"
find src/ -name "*.py" -exec wc -l {} \; 2>/dev/null \
  | sort -rn | head -10

# 4. Distribution of TODO / FIXME / HACK
echo ""
echo "--- Count of TODO/FIXME/HACK ---"
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ 2>/dev/null | wc -l

# 5. Files with many bug-fix commits
echo ""
echo "--- Top 10 files with most bug fixes ---"
git log --oneline --grep="fix\|bug\|hotfix" --name-only --since="1 year ago" \
  | grep -v "^[a-f0-9]" | sort | uniq -c | sort -rn | head -10
```

---

## 7. Comparison Tables

### 7.1 Comparison of Legacy Code Improvement Techniques

| Technique | Use Case | Risk | Cost | Effect |
|------|---------|:------:|:------:|------|
| Add characterization tests | Build safety net before refactoring | Low | Low | Prevents regression bugs |
| Sprout Method | Adding new features to existing code | Low | Low | Minimizes impact on legacy |
| Sprout Class | Adding a cohesive new feature | Low | Low–Medium | New testable code |
| Wrap Method | Add processing before/after existing functionality | Low | Low | Add logging/metrics |
| Extract & Override | Breaking hard-to-test dependencies | Medium | Medium | Improves testability |
| Introduce DI | Make dependencies explicit | Medium | Medium | Long-term testability |
| Strangler Fig | Replace large-scale systems | Medium | High | Fundamental modernization |
| Big Bang Rewrite | Full rewrite | Extremely High | Extremely High | Not recommended |

### 7.2 Priority Decision Matrix

| Priority | Action | Effect | Estimated Timeline |
|:------:|-----------|------|---------|
| Highest | Add characterization tests to high-change-frequency modules | Prevents regression bugs | 1–2 weeks |
| High | Improve testability via dependency injection | Makes adding tests easier | 2–4 weeks |
| Medium | Add new features using Sprout/Wrap | Minimizes impact on legacy | Ongoing |
| Medium | Build CI/CD pipeline | Automated quality checks | 1–2 weeks |
| Low | Phased Strangler Fig migration | Resolves long-term technical debt | Months to years |

---

## 8. Anti-patterns

### Anti-pattern 1: Big Bang Rewrite

```
  BAD: "Let's rewrite everything"

  "This legacy code has reached its limit. Let's rewrite it from scratch."
    → Months to years of development time
    → During that time, the old system also needs parallel maintenance
    → The new team doesn't have the tacit knowledge of the old system
    → Business requirements have changed by the time it's done
    → The "strange specs" in the old system often exist for business reasons
    → Joel Spolsky: "The single worst thing you can do in software"

  Historical lessons:
  - Netscape 6: took 3 years for full rewrite, lost market share
  - Borland dBase → Quattro Pro: market changed during rewrite

  GOOD: Phased migration

  Phase 1: Place facade (1 week)
  Phase 2: New features go into new system (ongoing)
  Phase 3: Migrate existing features incrementally (a few weeks per feature)
  Phase 4: Decommission legacy

  ★ Releasable at each phase
  ★ Rollback is possible
  ★ Safety ensured by running old and new in parallel
  ★ Continuously deliver business value
```

### Anti-pattern 2: Refactoring Without Tests

```
  BAD: Change structure without tests

  1. "This code is messy, let's refactor it"
  2. Change structure without tests
  3. "It looks clean now"
  4. One week later: regression bug in production
  5. Scrambling to fix it, making code even more complex
  6. Wrong lesson learned: "refactoring is dangerous"

  GOOD: Test-first refactoring

  1. First, write characterization tests to record current behavior
  2. Confirm tests pass (GREEN)
  3. Refactor in small steps
  4. Run tests after each step (maintain GREEN)
  5. Confirm tests continue to pass
  6. Commit
  7. Move to next step
```

### Anti-pattern 3: Trying to Modernize Everything at Once

```
  BAD: "Update the framework, libraries, and architecture all at once"

  Sprint 1: React 16 → 18, Express → Fastify,
            MongoDB → PostgreSQL, monolith → microservices
  → Everything breaks
  → Debugging is impossible (can't identify the cause)
  → Team is exhausted

  GOOD: One change at a time, incrementally

  Sprint N:   React 16 → 18 (UI layer only)
  Sprint N+1: Test coverage 60% → 80%
  Sprint N+2: Express → Fastify (API layer only)
  Sprint N+3: Extract part of monolith as a service
  ...

  ★ Maintain "releasable" at each step
  ★ If problems occur, the cause is easy to identify
```

### Anti-pattern 4: Ignoring Tacit Knowledge in Legacy Code

```
  BAD: "This conditional has no meaning, let's delete it"

  if customer.region == "EU" and order.total > 150:
      order.add_customs_declaration()  # Why 150? Why EU only?

  → Actually EU customs regulation: customs declaration required
    for imports over 150 euros
  → Deleting it causes regulatory violation

  GOOD: Save behavior with characterization tests before changing

  1. First record current behavior with characterization tests
  2. Investigate "why is it like this?" (git blame, stakeholder interviews)
  3. If there is a business reason, record it in a comment
  4. If judged unnecessary, update the test first, then delete

  # After refactoring:
  if order.requires_customs_declaration():
      # EU customs regulation: declaration required for imports over 150 euros
      # See: https://ec.europa.eu/taxation_customs/...
      order.add_customs_declaration()
```

---

## 9. Exercises

### Exercise 1 (Basic): Finding a Seam

Create a Seam in the following code so that tests can be added.

```python
class NotificationService:
    def send_alert(self, user_id: str, message: str) -> bool:
        # Directly retrieve user info from DB
        import sqlite3
        conn = sqlite3.connect("/var/db/production.db")
        cursor = conn.execute(
            "SELECT email, phone FROM users WHERE id = ?", (user_id,)
        )
        user = cursor.fetchone()
        if not user:
            return False

        # Send email
        import smtplib
        smtp = smtplib.SMTP("mail.production.com", 587)
        smtp.send_message(create_email(user[0], message))

        # Send SMS
        import requests
        requests.post("https://api.sms-provider.com/send",
                      json={"phone": user[1], "text": message})

        return True
```

**Expected answer**: (1) Extract & Override: extract DB retrieval, email send, and SMS send into protected methods respectively, (2) override in a test subclass, or (3) make `UserRepository`, `EmailSender`, and `SmsSender` injectable via constructor injection.

---

### Exercise 2 (Applied): Creating Characterization Tests

Create at least 10 characterization test cases for the following legacy function.

```python
def calculate_shipping(weight, destination, is_member, order_total):
    """Shipping cost calculation (legacy: no spec document)"""
    base = weight * 100
    if destination == "overseas":
        base *= 3
    if is_member:
        base *= 0.8
    if order_total > 10000:
        base = 0
    if weight > 30:
        base += 2000
    return int(base)
```

**Expected answer**: Comprehensively test cases such as standard domestic shipping, overseas shipping, member discount, free shipping over 10,000, overweight surcharge, and combinations (overseas + member + overweight, etc.).

---

### Exercise 3 (Advanced): Strangler Fig Migration Plan

Design a 6-month Strangler Fig migration plan for the following situation.

```
Legacy system situation:
- PHP 5.6 monolithic web application
- MySQL 5.5 database
- No tests (0% coverage)
- Monthly page views: 1 million
- Core features: user management, product catalog, order processing, payment, reports
- Development team: 5 people
- Deployments per day: 0 (monthly manual deployment)
```

**Expected answer (outline)**:

```
Month 1: Visualization and safety net
  - Dependency analysis
  - Build CI/CD pipeline
  - Add characterization tests to hotspots
  - Build feature flag infrastructure

Month 2: Place facade
  - Place API gateway (Nginx reverse proxy)
  - Set up new API server (Python/FastAPI)
  - Shared authentication token infrastructure

Month 3-4: Phased migration (in priority order)
  - Migrate user management API to new system
  - Migrate product catalog API to new system
  - Compare results in Shadow Mode

Month 5-6: Migrate core features
  - Migrate order processing to new system
  - Migrate payment to new system
  - Reports last (low change frequency)

★ Maintain "releasable" each month
★ Roll back via Feature Flag if problems arise
```

---

## 10. FAQ

### Q1. Where should I start with legacy code?

**A.** Start with "areas that change frequently and have many bugs." Use a scientific approach with these steps:

1. **Hotspot analysis**: Analyze change frequency with `git log` and measure complexity with `radon`. Files with a high change-frequency x complexity score get the highest priority.
2. **Bug tracking**: Identify modules linked to many bug tickets.
3. **Team knowledge**: List modules that team members feel are "scary to touch."
4. **Don't try to improve everything uniformly** — invest concentrated effort in hotspots.

### Q2. How do I safely add tests to code that has none?

**A.** A phased approach:

1. Record current behavior with **characterization tests** (correctness doesn't matter)
2. Find **Seams** and break dependencies (Extract & Override is safest)
3. Replace broken dependencies with **test doubles** and write unit tests
4. Once enough tests are in place, start **refactoring**

You don't need to write "correct" tests from the start. Recording current behavior is the top priority.

### Q3. How do I convince a team to improve legacy code?

**A.** Speak in business metrics. Avoid technical language and say things like:

- "Changes to this module take an average of 3 days, costing 60 person-days per year"
- "5 production incidents occurred over the past 6 months, impacting customers"
- "Onboarding new team members takes 2 extra weeks"
- "An investment of 3M JPY in improvements will save 5M JPY per year starting next year"

Quantify the interest on technical debt and show the ROI (return on investment) from improvement. See [Technical Debt](./03-technical-debt.md) for details.

### Q4. How do you maintain data consistency between old and new systems in the Strangler Fig pattern?

**A.** Combine the following strategies:

1. **Single database**: Share the same DB between old and new during early migration
2. **Change Data Capture (CDC)**: Sync DB changes from old system to new system
3. **Event Sourcing**: Publish events to a shared bus, consumed by both old and new
4. **Shadow Mode**: Log new system results and analyze differences against legacy

### Q5. How much time should be allocated to improving legacy code?

**A.** Recommendations from Martin Fowler and Kent Beck:

- **Daily**: Boy Scout Rule (make small improvements to files you touch: 5–10% of working time)
- **Sprint**: 20% Rule (dedicate 20% of each sprint to improvement)
- **Quarterly**: Technical debt sprint (dedicate a full sprint to focused improvement)

The key is to "make improvement part of daily work." If improvement is treated as a special event, it gets pushed out by business demands and never happens.

### Q6. Which should I choose: Extract & Override or DI?

**A.** It depends on the situation:

| Aspect | Extract & Override | DI (Dependency Injection) |
|------|:-----------------:|:--------------:|
| Amount of change | Less | Somewhat more |
| Long-term design | Temporary solution | Permanent improvement |
| Testability | Test subclass required | Inject test doubles directly |
| Initial cost | Low | Medium |
| Recommended when | At the stage of first adding tests | At the stage of serious refactoring |

General approach: first add tests with Extract & Override, then migrate to DI.

---


## FAQ

### Q1: What is the most important point in learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this knowledge applied in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## 11. Summary

| Item | Key Points |
|------|---------|
| Definition of legacy code | Code without tests (Michael Feathers) |
| First action | Record current behavior with characterization tests |
| Finding Seams | Ensure testability with dependency injection and Extract & Override |
| Sprout / Wrap | Safely add new features without modifying existing code |
| Strangler Fig | Phased replacement of large-scale systems |
| Avoid Big Bang Rewrite | Phased migration keeps each step releasable |
| Prioritization | Start with hotspots: high change frequency x high complexity |
| Data consistency | Compare old vs. new results with Shadow Mode + parallel execution |
| Building culture | Boy Scout Rule + 20% Rule + quarterly focused improvement |

| Technique | Safety | Cost | Effect |
|------|:------:|:------:|------|
| Characterization tests | High | Low | Prerequisite for refactoring |
| Extract & Override | Medium | Low | Safest way to create a Seam |
| Sprout Method | High | Low | Safely add new features |
| Wrap Method | High | Low | Add pre/post processing |
| Introduce DI | Medium | Medium | Long-term testability |
| Strangler Fig | Medium | High | Fundamental modernization |
| Big Bang Rewrite | Extremely High | Extremely High | Not recommended |

---

## Guides to Read Next

- [Technical Debt](./03-technical-debt.md) — Classifying, visualizing, and paying down debt
- [Continuous Improvement](./04-continuous-improvement.md) — Continuous quality improvement via CI/CD
- [Testing Principles](../01-practices/04-testing-principles.md) — Foundations of test design (AAA pattern, test doubles)
- [Code Smells](./00-code-smells.md) — Detecting smells lurking in legacy code
- [Refactoring Techniques](./01-refactoring-techniques.md) — Concrete techniques: Extract Method, Move Method, etc.
- Design Patterns Overview — Patterns such as Facade and Strategy
- Systems Design Fundamentals — Architecture-level modernization

---

## References

1. **Michael Feathers** *Working Effectively with Legacy Code*, Prentice Hall, 2004 — The seminal work on legacy code improvement. Seams, Extract & Override, Characterization Tests, and Sprout/Wrap patterns are all described here.
2. **Martin Fowler** *Refactoring: Improving the Design of Existing Code*, Addison-Wesley, 2018 (2nd Ed.) — Refactoring catalog. Core techniques such as Extract Method and Move Method. Fowler coined the term Strangler Fig pattern.
3. **Marianne Bellotti** *Kill It with Fire: Manage Aging Computer Systems (and Future Proof Modern Ones)*, No Starch Press, 2021 — An excellent book that discusses legacy system modernization strategies from an organizational perspective. Addresses not just technical methods but also team motivation and organizational culture change.
4. **Sam Newman** *Building Microservices*, O'Reilly, 2021 (2nd Ed.) — Phased migration strategy from monolith to microservices. Rich with practical examples of the Strangler Fig pattern.
5. **Adam Tornhill** *Your Code as a Crime Scene: Use Forensic Techniques to Arrest Defects, Bottlenecks, and Bad Design in Your Programs*, Pragmatic Bookshelf, 2015 — A "crime scene investigation" of code using Git history. Practically explains hotspot analysis, knowledge maps, and organizational analysis techniques.
