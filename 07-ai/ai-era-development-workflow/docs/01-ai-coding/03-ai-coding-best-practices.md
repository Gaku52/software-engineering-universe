# AI Coding Best Practices -- Review, Verification, and Quality Assurance

> Learn systematic review methods and verification processes to ensure the quality of AI-generated code, and secure reliability and maintainability in AI-assisted coding.

---

## What You Will Learn in This Chapter

1. **AI Code Quality Evaluation Framework** -- Establish criteria and procedures for systematically reviewing AI output
2. **Designing Verification Processes** -- Build gates for safely deploying AI-generated code to production
3. **Continuous Quality Improvement** -- Build feedback loops to organizationally elevate the quality of AI utilization
4. **Language-Specific Best Practices** -- Master AI code quality patterns for each language such as Python, TypeScript, and Go
5. **Prompt Design and Quality Relationship** -- Understand prompt engineering for generating high-quality code


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Cursor / Windsurf -- AI IDEs and Context Management](./02-cursor-and-windsurf.md)

---

## 1. Quality Evaluation of AI-Generated Code

### 1.1 Five-Layer Review Model

```
┌──────────────────────────────────────────────────┐
│        AI-Generated Code: Five-Layer Review Model │
│                                                  │
│  Layer 5: Business Logic Verification            │
│  ┌────────────────────────────────────────────┐  │
│  │ Requirements alignment, edge cases,        │  │
│  │ domain rules                               │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Layer 4: Security Verification                  │
│  ┌────────────────────────────────────────────┐  │
│  │ Input validation, authentication/          │  │
│  │ authorization, encryption, vulnerability   │  │
│  │ checks                                     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Layer 3: Performance Verification               │
│  ┌────────────────────────────────────────────┐  │
│  │ Computational complexity, memory usage,    │  │
│  │ N+1 problems, caching                      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Layer 2: Design Quality Verification            │
│  ┌────────────────────────────────────────────┐  │
│  │ SOLID principles, naming, cohesion,        │  │
│  │ coupling, testability                      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Layer 1: Syntax and Style Verification          │
│  ┌────────────────────────────────────────────┐  │
│  │ Linters, formatters, type checking         │  │
│  │ (automated)                                │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
  * Layers 1-2 can be automated. Layers 3-5 require human judgment
```

### 1.2 Quality Gate Flow

```
AI-Generated Code
    │
    ▼
┌──────────────┐  Fail   ┌──────────┐
│ Gate 1: Lint │───────►│ Request  │
│ + Format     │        │ AI fix   │──┐
└──────┬───────┘        └──────────┘  │
       │ Pass                         │
       ▼                             │
┌──────────────┐  Fail               │
│ Gate 2: Type │──────────────────────┤
│ Check        │                      │
└──────┬───────┘                      │
       │ Pass                         │
       ▼                             │
┌──────────────┐  Fail               │
│ Gate 3: Test │──────────────────────┤
│ (Automated)  │                      │
└──────┬───────┘                      │
       │ Pass                         │
       ▼                             │
┌──────────────┐  Issues found       │
│ Gate 4:      │──────────────────────┘
│ Human Review │
└──────┬───────┘
       │ Approved
       ▼
   Production
```

### 1.3 Detailed Review Points for Each Layer

Organize the specific items to check at each layer in detail.

```python
# Review check system defining each layer of the five-layer model
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable

class ReviewLayer(Enum):
    SYNTAX_STYLE = 1
    DESIGN_QUALITY = 2
    PERFORMANCE = 3
    SECURITY = 4
    BUSINESS_LOGIC = 5

class Severity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class ReviewItem:
    """Review item"""
    layer: ReviewLayer
    category: str
    description: str
    severity: Severity
    automated: bool  # Whether it can be automated
    checker: Callable | None = None  # Automated check function

@dataclass
class ReviewChecklist:
    """AI-generated code review checklist"""
    items: list[ReviewItem] = field(default_factory=list)

    def add_layer1_items(self) -> None:
        """Layer 1: Syntax and style verification"""
        checks = [
            ("Formatting", "Does it comply with code formatters (black/prettier)?", True),
            ("Linting", "Are there no linter warnings or errors?", True),
            ("Type annotations", "Are type annotations properly applied?", True),
            ("Import organization", "Are there no unused imports and is the order correct?", True),
            ("Naming conventions", "Does it follow the project's naming conventions?", True),
            ("Comments", "Are there no unnecessary comments or insufficient explanations?", False),
        ]
        for category, desc, automated in checks:
            self.items.append(ReviewItem(
                layer=ReviewLayer.SYNTAX_STYLE,
                category=category,
                description=desc,
                severity=Severity.WARNING,
                automated=automated,
            ))

    def add_layer2_items(self) -> None:
        """Layer 2: Design quality verification"""
        checks = [
            ("Single responsibility", "Does each function/class have only one responsibility?", Severity.ERROR),
            ("DRY principle", "Is there no code duplication?", Severity.WARNING),
            ("Cohesion", "Are related features properly grouped?", Severity.WARNING),
            ("Coupling", "Are inter-module dependencies minimized?", Severity.WARNING),
            ("Testability", "Is the design unit-testable without mocks?", Severity.ERROR),
            ("Extensibility", "Is the design open to future changes?", Severity.INFO),
            ("Error handling", "Is exception handling appropriate and consistent?", Severity.ERROR),
            ("Abstraction level", "Is the abstraction level unified within functions?", Severity.WARNING),
        ]
        for category, desc, severity in checks:
            self.items.append(ReviewItem(
                layer=ReviewLayer.DESIGN_QUALITY,
                category=category,
                description=desc,
                severity=severity,
                automated=False,
            ))

    def add_layer3_items(self) -> None:
        """Layer 3: Performance verification"""
        checks = [
            ("Computational complexity", "Are O(n^2) or higher algorithms not used unnecessarily?", Severity.ERROR),
            ("N+1 problem", "Are DB/API queries not issued inside loops?", Severity.CRITICAL),
            ("Memory usage", "Is large data not expanded entirely in memory?", Severity.ERROR),
            ("Caching", "Is caching being utilized?", Severity.WARNING),
            ("Concurrency", "Is asynchronous processing used appropriately?", Severity.WARNING),
            ("Indexing", "Are appropriate indexes considered for DB queries?", Severity.ERROR),
        ]
        for category, desc, severity in checks:
            self.items.append(ReviewItem(
                layer=ReviewLayer.PERFORMANCE,
                category=category,
                description=desc,
                severity=severity,
                automated=False,
            ))

    def add_layer4_items(self) -> None:
        """Layer 4: Security verification"""
        checks = [
            ("Input validation", "Are all external inputs validated?", Severity.CRITICAL),
            ("SQL injection", "Are parameterized queries used?", Severity.CRITICAL),
            ("XSS", "Is output escaped?", Severity.CRITICAL),
            ("Authentication/Authorization", "Is proper access control implemented?", Severity.CRITICAL),
            ("Secrets", "Are there no hardcoded secrets?", Severity.CRITICAL),
            ("CSRF protection", "Do state-changing requests have CSRF tokens?", Severity.ERROR),
            ("Rate limiting", "Do API endpoints have rate limiting?", Severity.WARNING),
        ]
        for category, desc, severity in checks:
            self.items.append(ReviewItem(
                layer=ReviewLayer.SECURITY,
                category=category,
                description=desc,
                severity=severity,
                automated=category in ("SQL injection", "Secrets"),
            ))

    def add_layer5_items(self) -> None:
        """Layer 5: Business logic verification"""
        checks = [
            ("Requirements alignment", "Does it meet the requirements of specs/user stories?", Severity.CRITICAL),
            ("Edge cases", "Are boundary values and null/empty cases handled?", Severity.ERROR),
            ("Domain rules", "Are business rules (tax calculation, inventory management, etc.) accurate?", Severity.CRITICAL),
            ("Data integrity", "Are transaction boundaries appropriate?", Severity.CRITICAL),
            ("Idempotency", "Are side effects not duplicated on retry?", Severity.ERROR),
            ("Audit trail", "Are important operations logged?", Severity.WARNING),
        ]
        for category, desc, severity in checks:
            self.items.append(ReviewItem(
                layer=ReviewLayer.BUSINESS_LOGIC,
                category=category,
                description=desc,
                severity=severity,
                automated=False,
            ))

    def generate_report(self) -> dict:
        """Generate a review report"""
        report = {
            "total_items": len(self.items),
            "automated_count": sum(1 for item in self.items if item.automated),
            "manual_count": sum(1 for item in self.items if not item.automated),
            "by_layer": {},
            "by_severity": {},
        }
        for layer in ReviewLayer:
            layer_items = [i for i in self.items if i.layer == layer]
            report["by_layer"][layer.name] = {
                "count": len(layer_items),
                "automated": sum(1 for i in layer_items if i.automated),
            }
        for severity in Severity:
            report["by_severity"][severity.value] = sum(
                1 for i in self.items if i.severity == severity
            )
        return report

# Usage example
checklist = ReviewChecklist()
checklist.add_layer1_items()
checklist.add_layer2_items()
checklist.add_layer3_items()
checklist.add_layer4_items()
checklist.add_layer5_items()
report = checklist.generate_report()
# → automated_count: ~10, manual_count: ~25
# → Layers 1-2 are mostly automatable, Layers 3-5 are primarily human judgment
```

---

## 2. Concrete Review Methods

### Code Example 1: Security Review Checklist

```python
# Example of conducting a security review on AI-generated code

# === AI-generated authentication code ===
from fastapi import Depends, HTTPException
from jose import jwt

SECRET_KEY = "my-secret-key-12345"  # ⚠️ Issue 1: Hardcoded
ALGORITHM = "HS256"

async def get_current_user(token: str):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    user_id = payload.get("sub")  # ⚠️ Issue 2: No type check
    if user_id is None:
        raise HTTPException(status_code=401)
    return user_id  # ⚠️ Issue 3: No user existence check

# === Revised version after review ===
import os
from fastapi import Depends, HTTPException, status
from jose import jwt, JWTError
from datetime import datetime, timezone

SECRET_KEY = os.environ["JWT_SECRET_KEY"]  # Fix 1: Retrieved from environment variable
ALGORITHM = "HS256"

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")  # Fix 2: Type annotation
        if user_id is None:
            raise credentials_exception
        # Fix 3: Expiration check
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Fix 4: User existence check
    user = await db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise credentials_exception
    return user
```

### Code Example 2: Performance Review

```python
# Identifying performance issues in AI-generated code

# === AI-generated code (with N+1 problem) ===
async def get_orders_with_items(db: AsyncSession) -> list[dict]:
    orders = await db.execute(select(Order))
    result = []
    for order in orders.scalars():
        # ⚠️ N+1 problem: A query is issued for each order
        items = await db.execute(
            select(OrderItem).where(OrderItem.order_id == order.id)
        )
        result.append({
            "order": order,
            "items": items.scalars().all()
        })
    return result

# === Revised version after review (Eager Loading) ===
async def get_orders_with_items(db: AsyncSession) -> list[dict]:
    # Consolidated into a single query with JOIN
    query = (
        select(Order)
        .options(selectinload(Order.items))  # Eager Loading
        .order_by(Order.created_at.desc())
        .limit(100)  # Pagination
    )
    result = await db.execute(query)
    orders = result.scalars().unique().all()
    return [
        {"order": order, "items": order.items}
        for order in orders
    ]
```

### Code Example 3: Test Generation and Verification

```python
# Having AI generate tests and verifying their quality

# Step 1: Request AI to generate tests
# Prompt: "Generate tests for the calculate_discount function.
#          3 normal cases, 3 error cases, 2 boundary values"

# Step 2: AI-generated tests
import pytest
from decimal import Decimal
from app.pricing import calculate_discount

class TestCalculateDiscount:
    """Discount calculation tests"""

    # Normal cases
    def test_percentage_discount(self):
        assert calculate_discount(Decimal("1000"), "SAVE10") == Decimal("900")

    def test_fixed_amount_discount(self):
        assert calculate_discount(Decimal("5000"), "FLAT500") == Decimal("4500")

    def test_no_discount(self):
        assert calculate_discount(Decimal("1000"), None) == Decimal("1000")

    # Error cases
    def test_expired_coupon(self):
        with pytest.raises(CouponExpiredError):
            calculate_discount(Decimal("1000"), "EXPIRED01")

    def test_invalid_coupon(self):
        with pytest.raises(InvalidCouponError):
            calculate_discount(Decimal("1000"), "INVALID")

    def test_negative_amount(self):
        with pytest.raises(ValueError):
            calculate_discount(Decimal("-100"), "SAVE10")

    # Boundary values
    def test_zero_amount(self):
        assert calculate_discount(Decimal("0"), "SAVE10") == Decimal("0")

    def test_discount_exceeds_amount(self):
        # When the discount exceeds the product price → should become 0
        assert calculate_discount(Decimal("100"), "FLAT500") == Decimal("0")

# Step 3: Points that humans should review
# ✓ Do the tests reflect actual business rules?
# ✓ Are edge cases covered?
# ✓ Is test independence maintained?
# ✗ Missing: No concurrent execution tests → additional instructions needed
```

### Code Example 4: Refactoring Decisions for AI-Generated Code

```typescript
// Criteria for splitting large functions generated by AI at once

// === A 200-line function generated by AI (needs refactoring) ===
async function processOrder(orderData: OrderInput): Promise<OrderResult> {
  // Validation (30 lines) → candidate for separation
  // Inventory check (20 lines) → candidate for separation
  // Price calculation (40 lines) → candidate for separation
  // Payment processing (30 lines) → candidate for separation
  // Inventory update (20 lines) → candidate for separation
  // Notification sending (20 lines) → candidate for separation
  // Logging (20 lines) → candidate for separation
  // ... all in one function
}

// === After refactoring ===
async function processOrder(orderData: OrderInput): Promise<OrderResult> {
  const validatedOrder = validateOrder(orderData);
  await checkInventory(validatedOrder.items);
  const pricing = calculatePricing(validatedOrder);
  const payment = await processPayment(pricing);
  await updateInventory(validatedOrder.items);
  await sendNotifications(validatedOrder, payment);
  await recordAuditLog('order_processed', { orderId: payment.orderId });

  return { orderId: payment.orderId, total: pricing.total };
}

// Each function has a single responsibility and fits within 20-30 lines
```

### Code Example 5: Automated Quality Metrics Collection

```yaml
# .github/workflows/ai-code-quality.yml
# CI that automatically measures the quality of AI-generated code

name: AI Code Quality Check
on: [pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Type Check
        run: npx tsc --noEmit

      - name: Lint
        run: npx eslint . --max-warnings 0

      - name: Test Coverage
        run: |
          npx vitest run --coverage
          # Fail if coverage is below 80%
          npx istanbul check-coverage --lines 80

      - name: Security Audit
        run: npm audit --audit-level=high

      - name: Complexity Check
        run: |
          # Check if any functions exceed cyclomatic complexity of 10
          npx eslint . --rule '{"complexity": ["error", 10]}'

      - name: Bundle Size Check
        run: |
          npm run build
          npx bundlesize
```

---

## 3. Quality Pattern Collection for AI Utilization

### Effective Pattern Comparison

| Pattern | Description | Impact on Quality |
|---------|-------------|-------------------|
| Test-First | Write tests first, then have AI implement | Very High |
| Incremental Generation | Generate in small units → verify repeatedly | High |
| Context Injection | Provide existing code conventions to AI | High |
| One-Shot Generation | Generate everything in one go | Low |
| No-Verification Merge | Merge AI output as-is | Dangerous |

### AI Utilization Maturity and Quality Indicators

| Maturity Level | Test Coverage | Bug Rate | Review Time |
|----------------|---------------|----------|-------------|
| Level 1: Completion only | 40-50% | Same as before | Same as before |
| Level 2: Generation + Manual review | 60-70% | 20% reduction | 30% reduction |
| Level 3: Generation + Automated tests | 80-90% | 50% reduction | 70% reduction |
| Level 4: Agent + CI | 90%+ | 70% reduction | 70% reduction |

### 3.1 Pattern Application Guide

```python
# Helper to determine selection criteria for each pattern

from dataclasses import dataclass
from enum import Enum

class GenerationPattern(Enum):
    TEST_FIRST = "test_first"
    INCREMENTAL = "incremental"
    CONTEXT_INJECTION = "context_injection"
    ONE_SHOT = "one_shot"

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class TaskCharacteristics:
    """Represents task characteristics"""
    complexity: int  # 1-10
    security_sensitivity: bool  # Whether security-related
    has_existing_tests: bool  # Whether existing tests exist
    has_existing_code: bool  # Whether existing code exists
    domain_complexity: int  # Domain complexity 1-10
    team_familiarity: int  # Team's technical proficiency 1-10

def recommend_pattern(task: TaskCharacteristics) -> GenerationPattern:
    """Recommend an AI generation pattern based on task characteristics"""

    # Security-related or high domain complexity → test-first is mandatory
    if task.security_sensitivity or task.domain_complexity >= 7:
        return GenerationPattern.TEST_FIRST

    # High complexity → incremental generation
    if task.complexity >= 7:
        return GenerationPattern.INCREMENTAL

    # Existing code and wanting to follow conventions → context injection
    if task.has_existing_code and task.team_familiarity >= 5:
        return GenerationPattern.CONTEXT_INJECTION

    # Simple task → one-shot is acceptable
    if task.complexity <= 3 and not task.security_sensitivity:
        return GenerationPattern.ONE_SHOT

    # Default: incremental generation
    return GenerationPattern.INCREMENTAL

def estimate_risk(task: TaskCharacteristics) -> RiskLevel:
    """Estimate the risk level of AI-generated code"""
    score = 0
    score += task.complexity * 2
    score += task.domain_complexity * 2
    if task.security_sensitivity:
        score += 20
    if not task.has_existing_tests:
        score += 10
    if task.team_familiarity < 5:
        score += 5

    if score >= 40:
        return RiskLevel.CRITICAL
    elif score >= 25:
        return RiskLevel.HIGH
    elif score >= 15:
        return RiskLevel.MEDIUM
    else:
        return RiskLevel.LOW

# Usage example
task = TaskCharacteristics(
    complexity=6,
    security_sensitivity=True,
    has_existing_tests=True,
    has_existing_code=True,
    domain_complexity=8,
    team_familiarity=7,
)
pattern = recommend_pattern(task)
risk = estimate_risk(task)
# pattern = TEST_FIRST, risk = CRITICAL
# → Write tests first, then have AI implement, and conduct a full-layer review
```

---

## 4. Automating Verification

```
┌────────────────────────────────────────────────────┐
│        AI-Generated Code Verification Pipeline     │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Static   │  │ Testing  │  │ Security │        │
│  │ Analysis │─►│ (Auto)   │─►│ Scan     │        │
│  │ (Auto)   │  │          │  │ (Auto)   │        │
│  │          │  │          │  │          │        │
│  │ - ESLint │  │ - Unit   │  │ - SAST   │        │
│  │ - tsc    │  │ - Integra│  │ - Dep    │        │
│  │ - mypy   │  │ - E2E    │  │   Audit  │        │
│  └──────────┘  └──────────┘  └────┬─────┘        │
│                                    │              │
│                                    ▼              │
│                 ┌──────────────────────────┐      │
│                 │ Human Review (remaining  │      │
│                 │ 10-20%)                  │      │
│                 │ - Business logic         │      │
│                 │   verification           │      │
│                 │ - Architecture alignment │      │
│                 │ - Domain knowledge       │      │
│                 │   consistency            │      │
│                 └──────────────────────────┘      │
└────────────────────────────────────────────────────┘
```

### 4.1 Implementing the Automated Verification Pipeline

```python
# Implementation example of an AI-generated code verification pipeline

import subprocess
import json
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

class GateResult(Enum):
    PASS = "pass"
    FAIL = "fail"
    WARN = "warn"

@dataclass
class GateOutput:
    """Gate execution result"""
    gate_name: str
    result: GateResult
    details: str
    duration_ms: float
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

class AICodeValidator:
    """Validator that verifies AI-generated code in stages"""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.gates: list[GateOutput] = []

    def run_gate1_lint(self, files: list[Path]) -> GateOutput:
        """Gate 1: Lint + format check"""
        import time
        start = time.monotonic()
        errors = []
        warnings = []

        for file_path in files:
            if file_path.suffix == ".py":
                # Check with Ruff (fast Python linter)
                result = subprocess.run(
                    ["ruff", "check", str(file_path), "--output-format=json"],
                    capture_output=True, text=True
                )
                if result.returncode != 0:
                    lint_errors = json.loads(result.stdout)
                    for err in lint_errors:
                        msg = f"{err['filename']}:{err['location']['row']}: {err['code']} {err['message']}"
                        if err["code"].startswith("E"):
                            errors.append(msg)
                        else:
                            warnings.append(msg)

                # Format check
                fmt_result = subprocess.run(
                    ["ruff", "format", "--check", str(file_path)],
                    capture_output=True, text=True
                )
                if fmt_result.returncode != 0:
                    errors.append(f"{file_path}: Formatting is invalid")

            elif file_path.suffix in (".ts", ".tsx"):
                # Check with ESLint
                result = subprocess.run(
                    ["npx", "eslint", str(file_path), "--format=json"],
                    capture_output=True, text=True,
                    cwd=str(self.project_root)
                )
                if result.returncode != 0:
                    lint_data = json.loads(result.stdout)
                    for file_result in lint_data:
                        for msg in file_result.get("messages", []):
                            line = f"{file_result['filePath']}:{msg['line']}: {msg['message']}"
                            if msg["severity"] == 2:
                                errors.append(line)
                            else:
                                warnings.append(line)

        elapsed = (time.monotonic() - start) * 1000
        result_status = GateResult.FAIL if errors else (
            GateResult.WARN if warnings else GateResult.PASS
        )

        output = GateOutput(
            gate_name="Gate 1: Lint + Format",
            result=result_status,
            details=f"files={len(files)}, errors={len(errors)}, warnings={len(warnings)}",
            duration_ms=elapsed,
            errors=errors,
            warnings=warnings,
        )
        self.gates.append(output)
        return output

    def run_gate2_typecheck(self) -> GateOutput:
        """Gate 2: Type check"""
        import time
        start = time.monotonic()
        errors = []

        # Python: mypy
        mypy_result = subprocess.run(
            ["mypy", ".", "--strict", "--no-error-summary"],
            capture_output=True, text=True,
            cwd=str(self.project_root)
        )
        if mypy_result.returncode != 0:
            for line in mypy_result.stdout.strip().split("\n"):
                if line.strip():
                    errors.append(f"[mypy] {line}")

        # TypeScript: tsc
        tsc_result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            capture_output=True, text=True,
            cwd=str(self.project_root)
        )
        if tsc_result.returncode != 0:
            for line in tsc_result.stdout.strip().split("\n"):
                if line.strip():
                    errors.append(f"[tsc] {line}")

        elapsed = (time.monotonic() - start) * 1000
        output = GateOutput(
            gate_name="Gate 2: Type Check",
            result=GateResult.FAIL if errors else GateResult.PASS,
            details=f"errors={len(errors)}",
            duration_ms=elapsed,
            errors=errors,
        )
        self.gates.append(output)
        return output

    def run_gate3_tests(self, coverage_threshold: float = 80.0) -> GateOutput:
        """Gate 3: Test execution + coverage"""
        import time
        start = time.monotonic()
        errors = []
        warnings = []

        # Run pytest
        test_result = subprocess.run(
            ["pytest", "--tb=short", "--cov=app", "--cov-report=json", "-q"],
            capture_output=True, text=True,
            cwd=str(self.project_root)
        )

        if test_result.returncode != 0:
            errors.append(f"Test failure:\n{test_result.stdout}")

        # Check coverage
        coverage_file = self.project_root / "coverage.json"
        if coverage_file.exists():
            with open(coverage_file) as f:
                cov_data = json.load(f)
            total_coverage = cov_data.get("totals", {}).get("percent_covered", 0)
            if total_coverage < coverage_threshold:
                warnings.append(
                    f"Coverage {total_coverage:.1f}% < threshold {coverage_threshold}%"
                )

        elapsed = (time.monotonic() - start) * 1000
        output = GateOutput(
            gate_name="Gate 3: Tests + Coverage",
            result=GateResult.FAIL if errors else (
                GateResult.WARN if warnings else GateResult.PASS
            ),
            details=f"errors={len(errors)}, warnings={len(warnings)}",
            duration_ms=elapsed,
            errors=errors,
            warnings=warnings,
        )
        self.gates.append(output)
        return output

    def run_gate4_security(self) -> GateOutput:
        """Gate 4: Security scan"""
        import time
        start = time.monotonic()
        errors = []
        warnings = []

        # Bandit (Python SAST)
        bandit_result = subprocess.run(
            ["bandit", "-r", "app", "-f", "json", "-ll"],
            capture_output=True, text=True,
            cwd=str(self.project_root)
        )
        if bandit_result.stdout:
            bandit_data = json.loads(bandit_result.stdout)
            for issue in bandit_data.get("results", []):
                severity = issue["issue_severity"]
                msg = f"[Bandit {severity}] {issue['filename']}:{issue['line_number']}: {issue['issue_text']}"
                if severity in ("HIGH", "MEDIUM"):
                    errors.append(msg)
                else:
                    warnings.append(msg)

        # Secret scanning (gitleaks)
        gitleaks_result = subprocess.run(
            ["gitleaks", "detect", "--no-git", "-s", ".", "-r", "/tmp/gitleaks.json"],
            capture_output=True, text=True,
            cwd=str(self.project_root)
        )
        if gitleaks_result.returncode != 0:
            errors.append("Secrets detected in the code")

        elapsed = (time.monotonic() - start) * 1000
        output = GateOutput(
            gate_name="Gate 4: Security Scan",
            result=GateResult.FAIL if errors else (
                GateResult.WARN if warnings else GateResult.PASS
            ),
            details=f"errors={len(errors)}, warnings={len(warnings)}",
            duration_ms=elapsed,
            errors=errors,
            warnings=warnings,
        )
        self.gates.append(output)
        return output

    def generate_summary(self) -> str:
        """Generate a summary for all gates"""
        lines = ["=== AI-Generated Code Verification Summary ===\n"]
        all_passed = True

        for gate in self.gates:
            icon = {"pass": "✅", "fail": "❌", "warn": "⚠️"}[gate.result.value]
            lines.append(f"{icon} {gate.gate_name}: {gate.result.value} ({gate.duration_ms:.0f}ms)")
            if gate.errors:
                all_passed = False
                for err in gate.errors[:3]:  # Show only the first 3
                    lines.append(f"   - {err}")
                if len(gate.errors) > 3:
                    lines.append(f"   ... and {len(gate.errors) - 3} more")

        lines.append("")
        if all_passed:
            lines.append("Result: All gates passed → Ready for human review")
        else:
            lines.append("Result: Gates not passed → Please request AI to fix the issues")

        return "\n".join(lines)
```

---

## 5. Language-Specific AI Coding Best Practices

### 5.1 Python-Specific Quality Checks

```python
# Common problems and fix patterns in Python AI-generated code

# === Problem Pattern 1: Mutable default arguments ===
# Frequently occurs in AI-generated code

# BAD: Pattern that AI tends to generate
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)  # ⚠️ Default argument is mutable → shared across calls
    return items

# GOOD: Fixed version
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items


# === Problem Pattern 2: Bare exception catch ===
# BAD: AI tends to catch broad exceptions for safety
def parse_config(config_str: str) -> dict:
    try:
        return json.loads(config_str)
    except Exception:  # ⚠️ Catches all exceptions → hides bugs
        return {}

# GOOD: Catch specific exceptions
def parse_config(config_str: str) -> dict:
    try:
        return json.loads(config_str)
    except json.JSONDecodeError as e:
        logger.warning("Invalid JSON config", error=str(e), input_length=len(config_str))
        raise ConfigParseError(f"Failed to parse config: {e}") from e


# === Problem Pattern 3: Mixing sync/async ===
# BAD: AI calls synchronous I/O in an async context
async def get_user_data(user_id: int) -> dict:
    # ⚠️ requests is synchronous → blocks the event loop
    response = requests.get(f"https://api.example.com/users/{user_id}")
    return response.json()

# GOOD: Use an async HTTP client
async def get_user_data(user_id: int) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"https://api.example.com/users/{user_id}")
        response.raise_for_status()
        return response.json()


# === Problem Pattern 4: Not using context managers ===
# BAD: AI forgets resource cleanup
def read_file(path: str) -> str:
    f = open(path, "r")  # ⚠️ File not closed on exception
    content = f.read()
    f.close()
    return content

# GOOD: Use a context manager
def read_file(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# === Problem Pattern 5: Missing or inaccurate type hints ===
# BAD: AI omits or provides inaccurate type hints
def process_data(data):  # ⚠️ No type hints
    result = {}
    for item in data:
        result[item['id']] = item['value'] * 2
    return result

# GOOD: Accurate type hints and input validation
from typing import TypedDict

class DataItem(TypedDict):
    id: str
    value: float

def process_data(data: list[DataItem]) -> dict[str, float]:
    """Process data and return a dictionary keyed by ID"""
    return {item["id"]: item["value"] * 2 for item in data}
```

### 5.2 TypeScript/React-Specific Quality Checks

```typescript
// Common problems and fix patterns in TypeScript AI-generated code

// === Problem Pattern 1: Overuse of any type ===
// BAD: AI uses any to avoid type definitions
function processResponse(data: any): any {
  return data.results.map((item: any) => ({
    id: item.id,
    name: item.name,
  }));
}

// GOOD: Proper type definitions
interface ApiResponse {
  results: ApiItem[];
  total: number;
  page: number;
}

interface ApiItem {
  id: string;
  name: string;
  createdAt: string;
}

interface ProcessedItem {
  id: string;
  name: string;
}

function processResponse(data: ApiResponse): ProcessedItem[] {
  return data.results.map((item) => ({
    id: item.id,
    name: item.name,
  }));
}


// === Problem Pattern 2: Incorrect useEffect dependency array ===
// BAD: AI makes the dependency array incomplete
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // ⚠️ userId is not included in the dependency array

  return <div>{user?.name}</div>;
}

// GOOD: Specify the dependency array correctly
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchUser(userId)
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };  // Cleanup
  }, [userId]);

  if (error) return <ErrorMessage message={error} />;
  if (!user) return <Skeleton />;
  return <div>{user.name}</div>;
}


// === Problem Pattern 3: Inappropriate use of memoization ===
// BAD: AI tends to memo everything
const UserList = React.memo(({ users }: { users: User[] }) => {
  // ⚠️ Using useMemo but deps reference a new array each time
  const sortedUsers = useMemo(
    () => users.sort((a, b) => a.name.localeCompare(b.name)),
    [users]  // Recalculated every time the users reference changes
  );

  // ⚠️ Empty dependency array in useCallback → stale closure
  const handleClick = useCallback((id: string) => {
    const user = users.find(u => u.id === id);  // References stale users
    console.log(user);
  }, []);

  return (
    <ul>
      {sortedUsers.map(user => (
        <li key={user.id} onClick={() => handleClick(user.id)}>
          {user.name}
        </li>
      ))}
    </ul>
  );
});

// GOOD: Proper memoization
function UserList({ users }: { users: User[] }) {
  // sort() is destructive → use toSorted()
  const sortedUsers = useMemo(
    () => users.toSorted((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const handleClick = useCallback((id: string) => {
    const user = users.find(u => u.id === id);
    if (user) {
      console.log(user);
    }
  }, [users]);  // Include users in the dependency array

  return (
    <ul>
      {sortedUsers.map(user => (
        <li key={user.id} onClick={() => handleClick(user.id)}>
          {user.name}
        </li>
      ))}
    </ul>
  );
}


// === Problem Pattern 4: Insufficient error handling ===
// BAD: AI only implements the happy path
async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return response.json();  // ⚠️ No response status check
}

// GOOD: Robust error handling
class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchData<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ApiError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
```

### 5.3 Go-Specific Quality Checks

```go
// Common problems and fix patterns in Go AI-generated code

// === Problem Pattern 1: Swallowing errors ===
// BAD: AI omits error handling
func GetUser(id int) *User {
    user, _ := db.FindUser(id)  // ⚠️ Error ignored
    return user
}

// GOOD: Properly propagate errors
func GetUser(ctx context.Context, id int) (*User, error) {
    user, err := db.FindUser(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("finding user %d: %w", id, err)
    }
    if user == nil {
        return nil, ErrUserNotFound
    }
    return user, nil
}


// === Problem Pattern 2: Goroutine leaks ===
// BAD: AI does not consider goroutine termination conditions
func ProcessItems(items []Item) {
    for _, item := range items {
        go func(i Item) {
            result := heavyProcess(i)  // ⚠️ No timeout
            saveToDB(result)            // ⚠️ No error handling
        }(item)
    }
    // ⚠️ Does not wait for goroutine completion
}

// GOOD: Control with errgroup + context
func ProcessItems(ctx context.Context, items []Item) error {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(10)  // Limit concurrent executions

    for _, item := range items {
        item := item
        g.Go(func() error {
            ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
            defer cancel()

            result, err := heavyProcess(ctx, item)
            if err != nil {
                return fmt.Errorf("processing item %s: %w", item.ID, err)
            }

            if err := saveToDB(ctx, result); err != nil {
                return fmt.Errorf("saving item %s: %w", item.ID, err)
            }
            return nil
        })
    }

    return g.Wait()
}


// === Problem Pattern 3: Misuse of defer ===
// BAD: Using defer inside a loop
func ProcessFiles(paths []string) error {
    for _, path := range paths {
        f, err := os.Open(path)
        if err != nil {
            return err
        }
        defer f.Close()  // ⚠️ Not closed until function exits → file descriptor exhaustion

        // File processing...
    }
    return nil
}

// GOOD: Separate into individual functions
func ProcessFiles(paths []string) error {
    for _, path := range paths {
        if err := processFile(path); err != nil {
            return fmt.Errorf("processing %s: %w", path, err)
        }
    }
    return nil
}

func processFile(path string) error {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer f.Close()  // Reliably closed within this function's scope

    // File processing...
    return nil
}
```

---

## 6. Prompt Design and Quality Relationship

### 6.1 Prompt Design for Generating High-Quality Code

```python
# Quality-oriented prompt template

QUALITY_PROMPT_TEMPLATE = """
## Implementation Task
{task_description}

## Technical Requirements
- Language: {language}
- Framework: {framework}
- Target Python/Node version: {runtime_version}

## Quality Requirements (Mandatory)
1. **Type safety**: Add type hints/annotations to all functions
2. **Error handling**: Place try-except/try-catch for all external calls
3. **Input validation**: Validate arguments of public APIs
4. **Logging**: Add structured logging at important processing points
5. **Testing**: Generate unit tests simultaneously with implementation

## Coding Standards
{coding_standards}

## Existing Code Pattern Example
```{language}
{existing_code_example}
```

## Prohibited Items
- No use of any type (TypeScript)
- No bare except usage (Python)
- No hardcoded secrets
- No use of global variables
- No waiting with sleep/time.sleep

## Output Format
1. Implementation code
2. Unit tests
3. Description of changes
"""


# Prompt quality scoring
from dataclasses import dataclass

@dataclass
class PromptQualityScore:
    """Score for evaluating prompt quality"""
    has_task_description: bool = False
    has_technical_context: bool = False
    has_quality_requirements: bool = False
    has_coding_standards: bool = False
    has_examples: bool = False
    has_constraints: bool = False
    has_output_format: bool = False

    @property
    def score(self) -> float:
        """Return a score from 0-100"""
        weights = {
            "has_task_description": 20,
            "has_technical_context": 15,
            "has_quality_requirements": 20,
            "has_coding_standards": 15,
            "has_examples": 15,
            "has_constraints": 10,
            "has_output_format": 5,
        }
        total = sum(
            weight for attr, weight in weights.items()
            if getattr(self, attr)
        )
        return total

    @property
    def grade(self) -> str:
        """Return a quality grade"""
        s = self.score
        if s >= 90:
            return "A: High-quality prompt → High-quality code expected"
        elif s >= 70:
            return "B: Good prompt → Moderate quality fixes needed"
        elif s >= 50:
            return "C: Basic prompt → Significant quality fixes needed"
        else:
            return "D: Insufficient → Prompt improvement required before code generation"

    def improvement_suggestions(self) -> list[str]:
        """Return improvement suggestions"""
        suggestions = []
        if not self.has_quality_requirements:
            suggestions.append("Add quality requirements (type safety, error handling, etc.)")
        if not self.has_examples:
            suggestions.append("Add existing code pattern examples")
        if not self.has_coding_standards:
            suggestions.append("Add team coding standards")
        if not self.has_constraints:
            suggestions.append("Specify prohibited items and constraints explicitly")
        if not self.has_technical_context:
            suggestions.append("Specify the technology stack and versions used")
        return suggestions

# Usage example
score = PromptQualityScore(
    has_task_description=True,
    has_technical_context=True,
    has_quality_requirements=True,
    has_coding_standards=False,
    has_examples=False,
    has_constraints=True,
    has_output_format=True,
)
print(f"Score: {score.score}/100")  # 70/100
print(f"Grade: {score.grade}")     # B
print(f"Suggestions: {score.improvement_suggestions()}")
```

### 6.2 Concrete Steps for Incremental Generation

```python
# Practical example of incrementally improving AI-generated code quality

# Step 1: Have AI generate interface definitions first
STEP1_PROMPT = """
Based on the following user story,
define Python interfaces (Protocol/ABC).
No implementation is needed.

User Story:
"As an administrator, I want to generate and download
 user activity reports in CSV/PDF format"

Requirements:
- Report generation should be asynchronous
- Support both CSV and PDF formats
- Filterable by date range
"""

# AI output example
from abc import ABC, abstractmethod
from datetime import date
from pathlib import Path
from enum import Enum

class ReportFormat(Enum):
    CSV = "csv"
    PDF = "pdf"

class ReportFilter:
    """Report filter conditions"""
    def __init__(
        self,
        start_date: date,
        end_date: date,
        user_ids: list[int] | None = None,
    ):
        if start_date > end_date:
            raise ValueError("start_date must be before end_date")
        self.start_date = start_date
        self.end_date = end_date
        self.user_ids = user_ids

class ReportGenerator(ABC):
    """Report generation interface"""

    @abstractmethod
    async def generate(
        self,
        report_filter: ReportFilter,
        format: ReportFormat,
    ) -> Path:
        """Generate a report and return the file path"""
        ...

    @abstractmethod
    async def get_status(self, report_id: str) -> str:
        """Return the progress status of report generation"""
        ...


# Step 2: Have AI generate tests based on the interface
STEP2_PROMPT = """
Generate tests for the above ReportGenerator interface.
3 normal cases, 3 error cases, 2 boundary values.
"""


# Step 3: Have AI generate implementation that satisfies the tests
STEP3_PROMPT = """
Create a ReportGenerator implementation that passes all the above tests.
Follow these constraints:
- DB access via SQLAlchemy AsyncSession
- Report generation with a 10-minute timeout
- Files saved to a temporary directory
"""


# Step 4: Review + improvement instructions
STEP4_PROMPT = """
Review and improve the generated implementation from the following perspectives:
1. Completeness of error handling
2. Performance (handling large data volumes)
3. Security (path traversal protection)
4. Add logging
"""
```

---

## 7. Building Code Review Automation Tools

### 7.1 Review Bot Specialized for AI-Generated Code

```python
# Review bot that performs quality checks on AI-generated code for GitHub PRs

import re
from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class ReviewComment:
    """Review comment"""
    file: str
    line: int
    severity: str  # "error", "warning", "info"
    category: str  # "security", "performance", "design", "style"
    message: str
    suggestion: str | None = None

class AICodeReviewBot:
    """Review bot specialized for AI-generated code"""

    # Common problem patterns in AI-generated code
    PATTERNS: dict[str, list[dict]] = {
        "python": [
            {
                "name": "hardcoded_secret",
                "pattern": r'(?:password|secret|api_key|token)\s*=\s*["\'][^"\']+["\']',
                "severity": "error",
                "category": "security",
                "message": "Hardcoded secret detected",
                "suggestion": "Use environment variables or a secret manager",
            },
            {
                "name": "bare_except",
                "pattern": r'except\s*:',
                "severity": "error",
                "category": "design",
                "message": "Bare except detected",
                "suggestion": "Catch a specific exception class (e.g., except ValueError:)",
            },
            {
                "name": "mutable_default",
                "pattern": r'def\s+\w+\([^)]*(?::\s*list|:\s*dict|:\s*set)\s*=\s*(?:\[\]|\{\}|set\(\))',
                "severity": "warning",
                "category": "design",
                "message": "Mutable default argument detected",
                "suggestion": "Use None as default and initialize inside the function",
            },
            {
                "name": "sync_in_async",
                "pattern": r'async\s+def.*\n(?:.*\n)*?.*requests\.(get|post|put|delete)',
                "severity": "error",
                "category": "performance",
                "message": "Synchronous HTTP client used inside an async function",
                "suggestion": "Use httpx.AsyncClient or aiohttp",
            },
            {
                "name": "no_type_hints",
                "pattern": r'def\s+\w+\([^:)]*\)\s*:',
                "severity": "warning",
                "category": "style",
                "message": "Missing type hints",
                "suggestion": "Add type hints to all arguments and return values",
            },
            {
                "name": "string_format_sql",
                "pattern": r'(?:execute|query)\s*\(\s*f["\']|(?:execute|query)\s*\([^)]*%\s',
                "severity": "error",
                "category": "security",
                "message": "SQL injection risk detected",
                "suggestion": "Use parameterized queries",
            },
        ],
        "typescript": [
            {
                "name": "any_type",
                "pattern": r':\s*any\b',
                "severity": "warning",
                "category": "style",
                "message": "any type is used",
                "suggestion": "Use a specific type or unknown",
            },
            {
                "name": "empty_catch",
                "pattern": r'catch\s*\([^)]*\)\s*\{\s*\}',
                "severity": "error",
                "category": "design",
                "message": "Empty catch block detected",
                "suggestion": "Log the error or re-throw it",
            },
            {
                "name": "no_error_handling_fetch",
                "pattern": r'await\s+fetch\([^)]+\)(?!\s*\.then|\s*;?\s*\n\s*if\s*\(!)',
                "severity": "warning",
                "category": "design",
                "message": "Possible missing error check on fetch result",
                "suggestion": "Check response.ok and add error handling",
            },
        ],
    }

    def __init__(self):
        self.comments: list[ReviewComment] = []

    def review_file(self, file_path: str, content: str) -> list[ReviewComment]:
        """Review a file and return comments"""
        comments = []

        # Determine language
        ext = Path(file_path).suffix
        lang_map = {".py": "python", ".ts": "typescript", ".tsx": "typescript"}
        lang = lang_map.get(ext)

        if not lang or lang not in self.PATTERNS:
            return comments

        lines = content.split("\n")

        for pattern_def in self.PATTERNS[lang]:
            for match in re.finditer(pattern_def["pattern"], content, re.MULTILINE):
                # Determine line number from match position
                line_num = content[:match.start()].count("\n") + 1

                comment = ReviewComment(
                    file=file_path,
                    line=line_num,
                    severity=pattern_def["severity"],
                    category=pattern_def["category"],
                    message=pattern_def["message"],
                    suggestion=pattern_def.get("suggestion"),
                )
                comments.append(comment)

        self.comments.extend(comments)
        return comments

    def generate_pr_review(self) -> str:
        """Generate a review summary for a PR"""
        if not self.comments:
            return "AI-generated code review: No issues detected ✅"

        errors = [c for c in self.comments if c.severity == "error"]
        warnings = [c for c in self.comments if c.severity == "warning"]

        lines = [
            "## AI-Generated Code Review Results\n",
            f"- Errors: {len(errors)}",
            f"- Warnings: {len(warnings)}\n",
        ]

        if errors:
            lines.append("### Errors (Must Fix)\n")
            for c in errors:
                lines.append(f"- **{c.file}:{c.line}** [{c.category}] {c.message}")
                if c.suggestion:
                    lines.append(f"  - Suggestion: {c.suggestion}")

        if warnings:
            lines.append("\n### Warnings (Review Recommended)\n")
            for c in warnings:
                lines.append(f"- **{c.file}:{c.line}** [{c.category}] {c.message}")
                if c.suggestion:
                    lines.append(f"  - Suggestion: {c.suggestion}")

        return "\n".join(lines)
```

### 7.2 Quality Assurance for AI-Generated Code with Pre-Commit Hooks

```yaml
# .pre-commit-config.yaml
# Pre-commit hooks that automatically check AI-generated code quality

repos:
  # Python: Format + Lint
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  # Python: Type check
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies: [types-requests, pydantic]
        args: [--strict]

  # Security: Secret scanning
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.0
    hooks:
      - id: gitleaks

  # Security: Python SAST
  - repo: https://github.com/PyCQA/bandit
    rev: 1.8.0
    hooks:
      - id: bandit
        args: [-r, -ll]
        exclude: tests/

  # TypeScript: ESLint
  - repo: local
    hooks:
      - id: eslint
        name: eslint
        entry: npx eslint --max-warnings 0
        language: system
        types: [typescript]

  # Custom: AI-generated code quality check
  - repo: local
    hooks:
      - id: ai-code-quality
        name: AI Code Quality Check
        entry: python scripts/ai_code_quality_check.py
        language: python
        types: [python, typescript]
        additional_dependencies: [pyyaml]
```

```python
# scripts/ai_code_quality_check.py
# AI-generated code quality checker for pre-commit hooks

import ast
import sys
from pathlib import Path

class PythonQualityChecker(ast.NodeVisitor):
    """Analyze Python AST to detect quality issues"""

    def __init__(self, filename: str):
        self.filename = filename
        self.issues: list[str] = []

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Quality check for function definitions"""
        # Type hint check
        if not node.returns:
            self.issues.append(
                f"{self.filename}:{node.lineno}: "
                f"Function '{node.name}' is missing a return type hint"
            )

        for arg in node.args.args:
            if arg.arg != "self" and not arg.annotation:
                self.issues.append(
                    f"{self.filename}:{node.lineno}: "
                    f"Argument '{arg.arg}' is missing a type hint"
                )

        # Function line count check (warn if over 50 lines)
        end_line = node.end_lineno or node.lineno
        func_lines = end_line - node.lineno
        if func_lines > 50:
            self.issues.append(
                f"{self.filename}:{node.lineno}: "
                f"Function '{node.name}' is {func_lines} lines long (recommended: 50 lines or fewer)"
            )

        # Docstring check
        if not (node.body and isinstance(node.body[0], ast.Expr)
                and isinstance(node.body[0].value, ast.Constant)
                and isinstance(node.body[0].value.value, str)):
            if not node.name.startswith("_"):
                self.issues.append(
                    f"{self.filename}:{node.lineno}: "
                    f"Public function '{node.name}' is missing a docstring"
                )

        self.generic_visit(node)

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        """Check exception handlers"""
        if node.type is None:
            self.issues.append(
                f"{self.filename}:{node.lineno}: "
                f"Bare except detected. Please specify a specific exception class"
            )

        # Empty except block
        if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
            self.issues.append(
                f"{self.filename}:{node.lineno}: "
                f"Empty except block detected. Please log the error"
            )

        self.generic_visit(node)

def check_file(filepath: str) -> list[str]:
    """Inspect a file and return a list of issues"""
    path = Path(filepath)
    if path.suffix != ".py":
        return []

    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        return [f"{filepath}:{e.lineno}: Syntax error: {e.msg}"]

    checker = PythonQualityChecker(filepath)
    checker.visit(tree)
    return checker.issues

def main() -> int:
    """Main entry point"""
    files = sys.argv[1:]
    all_issues: list[str] = []

    for filepath in files:
        issues = check_file(filepath)
        all_issues.extend(issues)

    if all_issues:
        print("AI-generated code quality check: Issues detected\n")
        for issue in all_issues:
            print(f"  {issue}")
        print(f"\nTotal: {len(all_issues)} issues")
        return 1

    return 0

if __name__ == "__main__":
    sys.exit(main())
```

---

## Anti-Patterns

### Anti-Pattern 1: Merging Without Tests

```python
# BAD: Merging AI-generated code without tests
# "AI wrote it, so it must be correct" → Dangerous assumption

# A real incident example:
def send_notification(user_id: int, message: str) -> bool:
    """Notification sending function generated by AI"""
    users = get_all_users()  # ← Retrieves all users
    for user in users:
        if user.id == user_id:
            email_service.send(user.email, message)
            return True
    return False
    # Problem: With 100,000 users, retrieves all records every time → performance disaster

# GOOD: Detect performance issues with tests
def test_send_notification_performance():
    """Notification sending should complete within 1 second"""
    with time_limit(seconds=1):
        send_notification(user_id=42, message="test")
```

### Anti-Pattern 2: Over-Trusting AI-Generated Code Confidence Scores

```
❌ BAD: "The AI's output probability is high, so the quality must be high"
   - LLM output probability and accuracy are separate things
   - "Confidently wrong" is a characteristic of LLMs
   - May appear statistically correct but be logically wrong

✅ GOOD: Execution-based quality verification
   - Judge by running tests and evaluating results
   - Verify consistency with type checkers
   - Confirm all existing tests pass
   - Human makes final judgment with domain knowledge
```

### Anti-Pattern 3: Prompts Without Sufficient Context

```python
# BAD: Requesting code generation from AI without context
# Prompt: "Create a user registration API"

# → AI doesn't know the framework, DB, auth method, or validation requirements,
#   so it generates generic, low-quality code

# GOOD: Provide sufficient context
# Prompt:
# """
# In a FastAPI + SQLAlchemy(async) + PostgreSQL environment,
# implement a user registration API.
#
# Existing pattern: Refer to the login endpoint in app/api/v1/auth.py
# Validation: Input validation with Pydantic v2 models
# Password: Hash with bcrypt
# Response: Use the UserResponse schema from app/schemas/user.py
# Testing: Follow the pattern in tests/api/test_auth.py
# """
```

### Anti-Pattern 4: Copy-Pasting Generated Code As-Is

```python
# BAD: Reusing AI-generated code from another project as-is

# Code generated for Project A (Django + MySQL)
class UserView(APIView):
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)

# Bringing it directly into Project B
# → Framework (FastAPI), ORM (SQLAlchemy), and DB (PostgreSQL) are
#   all different, so it won't work or the design won't fit

# GOOD: Regenerate with project-specific context
# Provide Project B's existing code patterns to AI and
# have it generate new code that follows that project's conventions
```

---

## 8. AI Quality Operations in Teams

### 8.1 Quality Metrics Dashboard

```python
# Dashboard to visualize AI-generated code quality across the team

from dataclasses import dataclass, field
from datetime import datetime, date
from collections import defaultdict

@dataclass
class PRMetrics:
    """Quality metrics per PR"""
    pr_number: int
    author: str
    ai_generated_lines: int
    total_lines: int
    test_coverage: float  # 0-100
    lint_errors: int
    type_errors: int
    security_issues: int
    review_comments: int
    review_time_minutes: int
    merged_at: datetime | None = None
    bugs_found_post_merge: int = 0

@dataclass
class TeamQualityDashboard:
    """Team quality dashboard"""

    metrics: list[PRMetrics] = field(default_factory=list)

    def ai_code_ratio(self) -> float:
        """Ratio of AI-generated code"""
        total = sum(m.total_lines for m in self.metrics)
        ai = sum(m.ai_generated_lines for m in self.metrics)
        return (ai / total * 100) if total > 0 else 0

    def average_coverage(self) -> float:
        """Average test coverage"""
        if not self.metrics:
            return 0
        return sum(m.test_coverage for m in self.metrics) / len(self.metrics)

    def defect_density(self) -> float:
        """Defect density (bugs per 1000 AI-generated lines)"""
        total_ai_lines = sum(m.ai_generated_lines for m in self.metrics)
        total_bugs = sum(m.bugs_found_post_merge for m in self.metrics)
        if total_ai_lines == 0:
            return 0
        return (total_bugs / total_ai_lines) * 1000

    def review_efficiency(self) -> dict[str, float]:
        """Review efficiency analysis"""
        if not self.metrics:
            return {}
        return {
            "avg_review_time_min": sum(m.review_time_minutes for m in self.metrics) / len(self.metrics),
            "avg_comments_per_pr": sum(m.review_comments for m in self.metrics) / len(self.metrics),
            "avg_lines_per_minute": sum(m.total_lines for m in self.metrics) / max(1, sum(m.review_time_minutes for m in self.metrics)),
        }

    def quality_trend(self, period_days: int = 30) -> dict[str, list]:
        """Quality trend (weekly progression)"""
        from datetime import timedelta

        cutoff = datetime.now() - timedelta(days=period_days)
        recent = [m for m in self.metrics if m.merged_at and m.merged_at > cutoff]

        weekly: dict[str, list[PRMetrics]] = defaultdict(list)
        for m in recent:
            if m.merged_at:
                week_key = m.merged_at.strftime("%Y-W%W")
                weekly[week_key].append(m)

        trend = {
            "weeks": [],
            "coverage": [],
            "defects": [],
            "review_time": [],
        }

        for week in sorted(weekly.keys()):
            prs = weekly[week]
            trend["weeks"].append(week)
            trend["coverage"].append(
                sum(p.test_coverage for p in prs) / len(prs)
            )
            trend["defects"].append(
                sum(p.bugs_found_post_merge for p in prs)
            )
            trend["review_time"].append(
                sum(p.review_time_minutes for p in prs) / len(prs)
            )

        return trend

    def generate_report(self) -> str:
        """Generate a monthly quality report"""
        lines = [
            "# AI-Generated Code Quality Report\n",
            f"- Target PRs: {len(self.metrics)}",
            f"- AI-generated code ratio: {self.ai_code_ratio():.1f}%",
            f"- Average test coverage: {self.average_coverage():.1f}%",
            f"- Defect density: {self.defect_density():.2f} bugs/1000 lines",
            "",
        ]

        efficiency = self.review_efficiency()
        if efficiency:
            lines.extend([
                "## Review Efficiency",
                f"- Average review time: {efficiency['avg_review_time_min']:.0f} min",
                f"- Average comments: {efficiency['avg_comments_per_pr']:.1f} per PR",
                f"- Review speed: {efficiency['avg_lines_per_minute']:.0f} lines/min",
            ])

        return "\n".join(lines)
```

### 8.2 Feedback Loop for Quality Improvement

```
AI-generated code quality improvement cycle:

┌─────────────────────────────────────────────────┐
│                                                 │
│  ① Generate: AI generates code                  │
│     │                                           │
│     ▼                                           │
│  ② Verify: Automated gates + human review       │
│     │                                           │
│     ▼                                           │
│  ③ Measure: Record quality metrics              │
│     │                                           │
│     ▼                                           │
│  ④ Analyze: Analyze quality trends by pattern   │
│     │                                           │
│     ▼                                           │
│  ⑤ Improve: Update prompts, rules, and CI       │
│     │                                           │
│     └──────────► Return to ①                    │
│                                                 │
│  Each cycle: Run in 2-week sprints              │
│  KPIs: Coverage, defect density, review time    │
└─────────────────────────────────────────────────┘

Example improvement actions:
- Many security issues → Add security requirements to prompts
- Many type errors → Add strict mode type checking to CI
- Many N+1 problems → Add DB-related items to review checklist
- Low test coverage → Standardize the test-first pattern
```

---

## FAQ

### Q1: How much time should be spent reviewing AI-generated code?

A guideline is "30-50% of the time it took for AI to generate the code." If AI generated code in 10 minutes, review for 3-5 minutes. However, for security-critical areas (authentication, payments, personal data processing), spend 2-3 times the normal amount. To improve review efficiency, automate Layers 1-3 and have humans focus on Layers 4-5.

### Q2: How do you ensure the quality of AI-generated test code?

You need to verify the AI-generated tests themselves. Specifically: (1) Use mutation testing (Stryker, etc.) to verify test effectiveness, (2) Confirm that tests fail when they should fail (verify by removing asserts), (3) Have humans verify not just coverage but also the completeness of business rule coverage.

### Q3: How do you standardize AI code quality criteria across a team?

Standardize at three levels: (1) Automation level: Embed quality gates in CI/CD (lint, type checking, tests, coverage), (2) Guideline level: Create an "AI Code Review Checklist" in the team wiki, (3) Culture level: Share knowledge in regular AI code review meetings and update best practices.

### Q4: Are there copyright or licensing issues with AI-generated code?

The copyright of AI-generated code is legally a gray area, but the following measures are practically important: (1) Verify that AI-generated code does not have high similarity to existing OSS code (especially copyleft-licensed code), (2) Clarify the scope of AI-generated code usage in internal policies, (3) Review the AI tool's terms of service to confirm that commercial use of generated code is permitted, (4) Record the scope of AI assistance in PR descriptions and maintain an audit trail.

### Q5: What should be done when AI-generated code has poor performance?

Address performance issues in AI-generated code with these steps: (1) Identify problem areas with benchmark tests (pytest-benchmark, k6, etc.), (2) Visualize bottlenecks with profilers (cProfile, py-spy, Chrome DevTools), (3) When sending improvement prompts to AI, specify concrete performance requirements ("1000 requests/sec," "response under 100ms," etc.), (4) Compare benchmark results before and after improvements. Including performance requirements in prompts makes it easier to get optimized code from the initial generation.

### Q6: How should AI code quality be managed in large-scale projects?

The following strategies are effective for large-scale projects: (1) Enforce unified quality gates across the entire monorepo via CI (lint, type checking, tests, security scans), (2) Use CODEOWNERS to clarify review owners for each directory, ensuring AI-generated code also goes through human review, (3) Monitor trends across teams with a quality metrics dashboard (see Section 8.1 in this chapter), (4) Share defect patterns of AI-generated code in monthly quality retrospectives and update prompt templates and CI rules, (5) Include an AI code quality guide in new member onboarding.

---

## Summary

| Item | Key Points |
|------|-----------|
| Five-Layer Review | Syntax → Design → Performance → Security → Business Logic |
| Quality Gates | Lint → Type → Test → Human Review in 4 stages |
| Automation Scope | Layers 1-3 (80%) automated, Layers 4-5 by humans |
| Test Strategy | Test-first approach with AI implementation yields highest quality |
| Metrics | Automatically measure coverage, complexity, and security audits |
| Team Operations | Three layers: CI/CD + Guidelines + Regular review meetings |
| Language-Specific Measures | Understand common issues in Python/TypeScript/Go |
| Prompt Quality | Rich context directly correlates to generated code quality |

---

## Recommended Next Reads

- [../02-workflow/00-ai-testing.md](../02-workflow/00-ai-testing.md) -- Detailed AI Testing Methods
- [../02-workflow/01-ai-code-review.md](../02-workflow/01-ai-code-review.md) -- Practical AI Code Review
- [../03-team/00-ai-team-practices.md](../03-team/00-ai-team-practices.md) -- Establishing Team Quality Standards

---

## References

1. Google Engineering Practices, "Code Review Developer Guide," 2024. https://google.github.io/eng-practices/review/
2. OWASP, "OWASP Code Review Guide," 2024. https://owasp.org/www-project-code-review-guide/
3. Martin Fowler, "Refactoring: Improving the Design of Existing Code," Addison-Wesley, 2018.
4. Microsoft, "Best Practices for AI-Assisted Development," 2025. https://learn.microsoft.com/en-us/ai/
5. Dan Abramov, "A Complete Guide to useEffect," 2024. https://overreacted.io/a-complete-guide-to-useeffect/
6. Go Wiki, "Code Review Comments," 2024. https://go.dev/wiki/CodeReviewComments
