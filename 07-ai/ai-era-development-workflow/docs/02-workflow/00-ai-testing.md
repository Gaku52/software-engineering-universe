# AI Testing -- Test Generation and Coverage Improvement

> Systematically learn strategies and specific techniques for efficiently generating test code with AI and significantly improving test coverage.

---

## What You Will Learn in This Chapter

1. **AI Test Generation Techniques** -- Master patterns for auto-generating unit tests, integration tests, and E2E tests
2. **Coverage Improvement Strategies** -- Learn approaches to efficiently increase test comprehensiveness using AI
3. **Test Quality Verification** -- Acquire methods to verify whether AI-generated tests are truly effective


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. Overview of AI Test Generation

### 1.1 Classification of Test Generation Approaches

```
┌──────────────────────────────────────────────────────┐
│          AI Test Generation Approaches                │
│                                                      │
│  Approach 1: Generate Tests from Code                │
│  ┌──────────────┐  AI Analysis  ┌──────────────┐    │
│  │ Source Code   │──────────────►│  Test Code   │    │
│  └──────────────┘               └──────────────┘    │
│  - Reverse-generate tests by reading existing code   │
│  - Automatically detect coverage gaps                │
│                                                      │
│  Approach 2: Generate Tests from Specs (TDD)         │
│  ┌──────────────┐  AI Generation ┌──────────────┐   │
│  │ Specification│────────────────►│  Test Code   │   │
│  └──────────────┘                └──────┬───────┘   │
│                                         │ AI Impl   │
│                                   ┌─────▼──────┐    │
│                                   │ Source Code │    │
│                                   └────────────┘    │
│                                                      │
│  Approach 3: Generate Tests from Change Diffs        │
│  ┌──────────────┐  AI Analysis  ┌──────────────┐    │
│  │  git diff    │──────────────►│  Diff Tests  │    │
│  └──────────────┘               └──────────────┘    │
│  - Add tests focused only on changed parts           │
└──────────────────────────────────────────────────────┘
```

### 1.2 Test Pyramid and AI Utilization

```
                    ┌─────┐
                   /  E2E  \          AI utilization: Medium
                  /  Tests  \         - Scenario generation
                 /───────────\        - Selector generation
                / Integration  \      AI utilization: High
               /    Tests       \     - API call patterns
              /─────────────────\     - Mock generation
             /    Unit Tests     \    AI utilization: Very High
            /    (Unit Test)     \   - Auto-generate tests per function
           /─────────────────────\  - Comprehensive edge cases
          /                       \
         /─────────────────────────\
        Test count: Many ← ──────── → Few
        Execution speed: Fast ← ──────── → Slow
```

---

## 2. Auto-Generation of Unit Tests

### Code Example 1: Generating Tests from a Function

```python
# Target function
def calculate_bmi(weight_kg: float, height_m: float) -> dict:
    """Calculate BMI and return the assessment result"""
    if weight_kg <= 0 or height_m <= 0:
        raise ValueError("Weight and height must be positive numbers")
    bmi = weight_kg / (height_m ** 2)
    if bmi < 18.5:
        category = "Underweight"
    elif bmi < 25:
        category = "Normal weight"
    elif bmi < 30:
        category = "Obese (Class 1)"
    else:
        category = "Obese (Class 2+)"
    return {"bmi": round(bmi, 1), "category": category}

# AI Prompt: "Generate comprehensive tests for the calculate_bmi function.
#             Include normal cases, error cases, and boundary values"

# AI-generated tests
import pytest
from app.health import calculate_bmi

class TestCalculateBMI:
    """Tests for BMI calculation"""

    # Normal cases: Each category
    def test_underweight(self):
        result = calculate_bmi(50, 1.75)
        assert result["category"] == "Underweight"
        assert result["bmi"] == 16.3

    def test_normal_weight(self):
        result = calculate_bmi(65, 1.70)
        assert result["category"] == "Normal weight"
        assert result["bmi"] == 22.5

    def test_overweight(self):
        result = calculate_bmi(85, 1.70)
        assert result["category"] == "Obese (Class 1)"
        assert result["bmi"] == 29.4

    def test_obese(self):
        result = calculate_bmi(100, 1.70)
        assert result["category"] == "Obese (Class 2+)"
        assert result["bmi"] == 34.6

    # Boundary values
    @pytest.mark.parametrize("weight,height,expected_category", [
        (56.6, 1.75, "Underweight"),       # BMI ≈ 18.49
        (56.7, 1.75, "Normal weight"),     # BMI ≈ 18.51
        (76.5, 1.75, "Normal weight"),     # BMI ≈ 24.98
        (76.6, 1.75, "Obese (Class 1)"),   # BMI ≈ 25.01
    ])
    def test_boundary_values(self, weight, height, expected_category):
        result = calculate_bmi(weight, height)
        assert result["category"] == expected_category

    # Error cases
    def test_negative_weight(self):
        with pytest.raises(ValueError):
            calculate_bmi(-70, 1.70)

    def test_zero_height(self):
        with pytest.raises(ValueError):
            calculate_bmi(70, 0)

    def test_zero_weight(self):
        with pytest.raises(ValueError):
            calculate_bmi(0, 1.70)
```

### Code Example 2: Auto-Generation of API Tests

```python
# Generate tests from FastAPI endpoints

# Prompt: "Generate integration tests for the following FastAPI endpoint.
#          Use httpx AsyncClient and mock the DB"

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from app.main import app

@pytest.fixture
def mock_db():
    """DB mock setup"""
    mock = AsyncMock()
    mock.get.return_value = {"id": 1, "name": "Test User", "email": "test@example.com"}
    return mock

@pytest.mark.asyncio
class TestUserAPI:
    """User API integration tests"""

    async def test_get_user_success(self, mock_db):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with patch("app.deps.get_db", return_value=mock_db):
                response = await client.get("/api/v1/users/1")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test User"

    async def test_get_user_not_found(self, mock_db):
        mock_db.get.return_value = None
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with patch("app.deps.get_db", return_value=mock_db):
                response = await client.get("/api/v1/users/999")
        assert response.status_code == 404

    async def test_create_user_validation_error(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/v1/users", json={"name": ""})
        assert response.status_code == 422
```

### Code Example 3: Generating Property-Based Tests

```python
# Have AI generate Property-Based Tests

# Prompt: "Generate property-based tests for the calculate_bmi function
#          using the Hypothesis library"

from hypothesis import given, assume, settings
from hypothesis.strategies import floats

class TestCalculateBMIProperty:
    """Property-Based Tests for BMI calculation"""

    @given(
        weight=floats(min_value=0.1, max_value=500),
        height=floats(min_value=0.3, max_value=3.0),
    )
    @settings(max_examples=1000)
    def test_bmi_always_positive(self, weight, height):
        """BMI value is always positive"""
        result = calculate_bmi(weight, height)
        assert result["bmi"] > 0

    @given(
        weight=floats(min_value=0.1, max_value=500),
        height=floats(min_value=0.3, max_value=3.0),
    )
    def test_category_always_valid(self, weight, height):
        """Category is always one of the four types"""
        result = calculate_bmi(weight, height)
        valid_categories = {"Underweight", "Normal weight", "Obese (Class 1)", "Obese (Class 2+)"}
        assert result["category"] in valid_categories

    @given(
        weight=floats(min_value=-1000, max_value=0),
        height=floats(min_value=0.3, max_value=3.0),
    )
    def test_negative_weight_raises(self, weight, height):
        """Negative weight raises ValueError"""
        with pytest.raises(ValueError):
            calculate_bmi(weight, height)
```

### Code Example 4: Generating E2E Tests

```typescript
// Auto-generation of E2E tests using Playwright

// Prompt: "Generate an E2E test for login -> product search -> add to cart -> purchase"

import { test, expect } from '@playwright/test';

test.describe('Purchase Flow', () => {
  test('Search for a product, add to cart, and complete purchase', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');

    // 2. Product search
    await page.fill('[data-testid="search-input"]', 'TypeScript Beginner');
    await page.press('[data-testid="search-input"]', 'Enter');
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // 3. Add to cart
    await page.click('[data-testid="product-card"]:first-child');
    await page.click('[data-testid="add-to-cart"]');
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');

    // 4. Checkout
    await page.click('[data-testid="cart-icon"]');
    await page.click('[data-testid="checkout-button"]');
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/28');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.click('[data-testid="confirm-purchase"]');

    // 5. Confirmation
    await expect(page).toHaveURL(/\/orders\/\d+/);
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
  });
});
```

### Code Example 5: Identifying Test Coverage Gaps

```bash
# Have AI analyze the coverage report

# Step 1: Generate coverage report
pytest --cov=src --cov-report=json:coverage.json

# Step 2: Ask Claude Code for analysis
claude "Read coverage.json and list files with low coverage that are
       important from a business logic perspective.
       Suggest test cases to add for each file"

# Example AI output:
# 1. src/services/payment.py (Coverage: 45%)
#    - Retry logic on payment failure is not tested
#    - Partial refund tests are missing
#    - No tests for timeout behavior
#
# 2. src/domain/order.py (Coverage: 62%)
#    - Not all order status transition patterns are covered
#    - No concurrent order conflict tests
```

---

## 3. Test Generation Tool Comparison

### 3.1 AI Test Generation Tools

| Tool | Supported Languages | Features | Accuracy |
|------|---------------------|----------|----------|
| Copilot (/tests) | General | Instant generation in editor | Medium |
| Claude Code | General | Deep context understanding | High |
| Codium AI (Qodo) | Python/JS/TS | Test-specialized, suggestion-based | High |
| Diffblue Cover | Java | Automatic JUnit generation | Very High |
| EvoSuite | Java | Genetic algorithm | High |

### 3.2 Optimal Approach by Test Type

| Test Type | Recommended Method | AI Contribution | Human Role |
|-----------|--------------------|-----------------|------------|
| Unit tests | Auto-generate with AI | 90% | Boundary value verification |
| Integration tests | AI generates skeleton + human adjustment | 70% | Mock design |
| E2E tests | AI scenario generation | 60% | User flow verification |
| Property tests | AI generation | 80% | Invariant definition |
| Performance tests | AI template generation | 50% | Threshold determination |
| Security tests | Human-led + AI assistance | 30% | Threat model design |

---

## 4. Test Quality Verification

```
┌──────────────────────────────────────────────────┐
│    Quality Verification Process for              │
│    AI-Generated Tests                            │
│                                                  │
│  Step 1: Mutation Testing                        │
│  ┌──────────────────────────────────────────┐    │
│  │ Intentionally inject bugs into code       │    │
│  │ → Check if tests can detect them          │    │
│  │ → Pass if detection rate (Mutation Score) │    │
│  │   is 80% or higher                        │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Step 2: Test Independence Check                 │
│  ┌──────────────────────────────────────────┐    │
│  │ Randomize test execution order            │    │
│  │ → Verify no order-dependent failures      │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Step 3: Verify Meaningful Assertions            │
│  ┌──────────────────────────────────────────┐    │
│  │ Detect meaningless tests like assert True │    │
│  │ → Check if test fails when assertion is   │    │
│  │   removed                                 │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

---

## 5. Practical Patterns for Test Generation

### 5.1 TDD + AI Integrated Workflow

```python
# Workflow combining TDD (Test-Driven Development) and AI test generation

class TDDAIWorkflow:
    """
    TDD + AI Hybrid Workflow

    Steps:
    1. Human describes the specification in a prompt
    2. AI generates test code (Red)
    3. Human verifies the validity of the tests
    4. AI generates implementation code (Green)
    5. AI suggests refactoring (Refactor)
    6. Human performs final review
    """

    # Step 1: Describe the specification in a prompt
    SPEC_PROMPT = """
    Please generate tests based on the following specification.

    ## Feature: Discount Calculation Service

    ### Business Rules
    1. Standard discount: 5% off for purchases of 10,000 yen or more
    2. Member discount: Gold members get an additional 10% off
    3. Coupon: Fixed amount discount with a valid coupon code
    4. Discount cap: Total discount rate must not exceed 30%
    5. Minimum payment: Amount after discount must be at least 1 yen

    ### Test Case Requirements
    - Boundary value tests for each rule
    - Combination tests for rules
    - Error case tests (invalid coupon, negative amount, etc.)
    - Concurrent access tests (double use of same coupon)

    ## Technical Specification
    - pytest + pytest-asyncio
    - Given-When-Then format for test names
    - Generate test data using factory pattern
    """

    # Step 2: Example test generated by AI
    GENERATED_TEST = """
import pytest
from decimal import Decimal
from discount_service import DiscountService, DiscountRequest
from factories import UserFactory, CouponFactory

class TestDiscountService:
    \"\"\"Tests for discount calculation service\"\"\"

    @pytest.fixture
    def service(self):
        return DiscountService()

    @pytest.fixture
    def gold_user(self):
        return UserFactory.create(membership="gold")

    @pytest.fixture
    def regular_user(self):
        return UserFactory.create(membership="regular")

    # --- Standard Discount Tests ---

    def test_given_amount_below_10000_when_calculate_then_no_discount(
        self, service, regular_user
    ):
        request = DiscountRequest(user=regular_user, amount=Decimal("9999"))
        result = service.calculate(request)
        assert result.discount_amount == Decimal("0")
        assert result.final_amount == Decimal("9999")

    def test_given_amount_exactly_10000_when_calculate_then_5_percent_discount(
        self, service, regular_user
    ):
        request = DiscountRequest(user=regular_user, amount=Decimal("10000"))
        result = service.calculate(request)
        assert result.discount_amount == Decimal("500")
        assert result.final_amount == Decimal("9500")

    def test_given_amount_above_10000_when_calculate_then_5_percent_discount(
        self, service, regular_user
    ):
        request = DiscountRequest(user=regular_user, amount=Decimal("20000"))
        result = service.calculate(request)
        assert result.discount_amount == Decimal("1000")
        assert result.final_amount == Decimal("19000")

    # --- Member Discount Tests ---

    def test_given_gold_member_when_calculate_then_additional_10_percent(
        self, service, gold_user
    ):
        request = DiscountRequest(user=gold_user, amount=Decimal("10000"))
        result = service.calculate(request)
        # 5% + 10% = 15%
        assert result.discount_amount == Decimal("1500")
        assert result.final_amount == Decimal("8500")

    # --- Discount Cap Tests ---

    def test_given_max_discounts_combined_when_calculate_then_cap_at_30_percent(
        self, service, gold_user
    ):
        coupon = CouponFactory.create(discount_percent=Decimal("20"))
        request = DiscountRequest(
            user=gold_user, amount=Decimal("10000"), coupon=coupon
        )
        result = service.calculate(request)
        # 5% + 10% + 20% = 35% → Capped at 30%
        assert result.discount_rate <= Decimal("0.30")
        assert result.final_amount >= Decimal("7000")

    # --- Minimum Payment Tests ---

    def test_given_huge_discount_when_calculate_then_minimum_1_yen(
        self, service, regular_user
    ):
        coupon = CouponFactory.create(discount_amount=Decimal("99999"))
        request = DiscountRequest(
            user=regular_user, amount=Decimal("100"), coupon=coupon
        )
        result = service.calculate(request)
        assert result.final_amount >= Decimal("1")

    # --- Error Case Tests ---

    def test_given_negative_amount_when_calculate_then_raise_error(
        self, service, regular_user
    ):
        with pytest.raises(ValueError, match="Amount must be positive"):
            DiscountRequest(user=regular_user, amount=Decimal("-100"))

    def test_given_expired_coupon_when_calculate_then_raise_error(
        self, service, regular_user
    ):
        expired_coupon = CouponFactory.create(expired=True)
        request = DiscountRequest(
            user=regular_user, amount=Decimal("10000"),
            coupon=expired_coupon
        )
        with pytest.raises(ValueError, match="Coupon has expired"):
            service.calculate(request)
    """
```

### 5.2 Test Factory Pattern

```python
# Test data factory that works well with AI test generation

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
import uuid

@dataclass
class User:
    id: str
    name: str
    email: str
    membership: str
    created_at: datetime

@dataclass
class Coupon:
    code: str
    discount_type: str  # "percent" or "fixed"
    discount_value: Decimal
    expires_at: datetime
    max_uses: int
    used_count: int

class UserFactory:
    """Factory for test user data"""

    _counter = 0

    @classmethod
    def create(cls, **overrides) -> User:
        cls._counter += 1
        defaults = {
            "id": str(uuid.uuid4()),
            "name": f"Test User {cls._counter}",
            "email": f"test{cls._counter}@example.com",
            "membership": "regular",
            "created_at": datetime.now(),
        }
        defaults.update(overrides)
        return User(**defaults)

    @classmethod
    def create_gold_member(cls, **overrides) -> User:
        return cls.create(membership="gold", **overrides)

    @classmethod
    def create_batch(cls, count: int, **overrides) -> list[User]:
        return [cls.create(**overrides) for _ in range(count)]

class CouponFactory:
    """Factory for test coupon data"""

    @classmethod
    def create(cls, **overrides) -> Coupon:
        defaults = {
            "code": f"TEST-{uuid.uuid4().hex[:8].upper()}",
            "discount_type": "percent",
            "discount_value": Decimal("10"),
            "expires_at": datetime.now() + timedelta(days=30),
            "max_uses": 100,
            "used_count": 0,
        }

        # Shortcut for expired=True
        if overrides.pop("expired", False):
            defaults["expires_at"] = datetime.now() - timedelta(days=1)

        # Shortcut for discount_percent
        if "discount_percent" in overrides:
            defaults["discount_type"] = "percent"
            defaults["discount_value"] = overrides.pop("discount_percent")

        # Shortcut for discount_amount
        if "discount_amount" in overrides:
            defaults["discount_type"] = "fixed"
            defaults["discount_value"] = overrides.pop("discount_amount")

        defaults.update(overrides)
        return Coupon(**defaults)
```

### 5.3 Best Practices for Test Generation Prompts

```python
# Prompt template collection for generating high-quality tests

TEST_GENERATION_PROMPTS = {
    "unit_test": """
    Generate unit tests for the following code.

    ## Target Code
    {source_code}

    ## Test Requirements
    1. Given-When-Then format for test names
    2. At least 3 test cases per public method
       - Normal case (typical input)
       - Boundary values (min/max/empty)
       - Error case (invalid input, exceptions)
    3. Guarantee test independence (no shared state)
    4. Minimize mocks (external dependencies only)
    5. Assert specific values (no assert is not None)

    ## Tech Stack
    - pytest
    - unittest.mock
    - freezegun (time freezing)
    """,

    "integration_test": """
    Generate integration tests between the following services.

    ## Target Services
    {service_code}

    ## Dependencies
    {dependencies}

    ## Test Requirements
    1. Test with real DB (using testcontainers)
    2. Mock external APIs (responses / httpx-mock)
    3. Verify transaction rollback
    4. Test concurrent access (asyncio.gather)
    5. Verify error propagation (Service A error → Service B behavior)

    ## Tech Stack
    - pytest-asyncio
    - testcontainers-python
    - httpx-mock
    """,

    "snapshot_test": """
    Generate snapshot tests for the following React component.

    ## Target Component
    {component_code}

    ## Test Requirements
    1. Snapshot rendering results for each props pattern
    2. State changes after interactions (click, input)
    3. Test each UI state: loading, error, empty
    4. Responsive snapshots (mobile/desktop)

    ## Tech Stack
    - Vitest
    - @testing-library/react
    - @testing-library/user-event
    """,
}
```

### 5.4 Test Coverage Analysis and Improvement Suggestions

```python
# Analyze coverage reports with AI and generate improvement suggestions

import json
from pathlib import Path

class CoverageAnalyzer:
    """Tool for analyzing test coverage with AI"""

    def __init__(self, coverage_json_path: str):
        self.coverage_data = json.loads(Path(coverage_json_path).read_text())

    def analyze(self) -> dict:
        """Analyze coverage data"""
        files = self.coverage_data.get("files", {})

        analysis = {
            "total_coverage": self.coverage_data.get("totals", {}).get(
                "percent_covered", 0
            ),
            "low_coverage_files": [],
            "uncovered_critical_paths": [],
            "improvement_suggestions": [],
        }

        for file_path, file_data in files.items():
            coverage = file_data.get("summary", {}).get("percent_covered", 0)

            if coverage < 70:
                missing_lines = file_data.get("missing_lines", [])
                analysis["low_coverage_files"].append({
                    "path": file_path,
                    "coverage": coverage,
                    "missing_lines": missing_lines[:20],
                    "total_missing": len(missing_lines),
                })

        # Sort by priority (lower coverage and larger files first)
        analysis["low_coverage_files"].sort(
            key=lambda x: (x["coverage"], -x["total_missing"])
        )

        return analysis

    def generate_improvement_prompt(self, analysis: dict) -> str:
        """Generate AI prompt for coverage improvement"""
        low_files = analysis["low_coverage_files"][:5]

        prompt = f"""
Based on the following test coverage analysis results, suggest test addition
priorities and specific test cases.

## Overall Coverage: {analysis['total_coverage']:.1f}%

## Files with Low Coverage (Top 5)
"""
        for f in low_files:
            prompt += f"""
### {f['path']} (Coverage: {f['coverage']:.1f}%)
Uncovered lines: {f['total_missing']} lines
Example uncovered lines: {f['missing_lines'][:10]}
"""

        prompt += """
## Response Format
1. Priority (High/Medium/Low) and reason for each file
2. List of test cases to add for each file
3. Test code skeleton
"""
        return prompt
```

---

## 6. Integration with CI/CD Pipelines

### 6.1 Test Auto-Generation Pipeline

```yaml
# .github/workflows/ai-test-generation.yml
name: AI Test Generation

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install -e ".[dev]"

      - name: Run tests with coverage
        run: pytest --cov=src --cov-report=json:coverage.json

      - name: Analyze coverage gaps
        run: |
          python scripts/analyze_coverage.py \
            --coverage coverage.json \
            --changed-files "$(git diff --name-only origin/main...HEAD)" \
            --output coverage-analysis.json

      - name: Comment coverage analysis on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const analysis = JSON.parse(
              fs.readFileSync('coverage-analysis.json')
            );

            let body = '## Test Coverage Analysis\n\n';
            body += `Overall Coverage: **${analysis.total_coverage}%**\n\n`;

            if (analysis.uncovered_changes.length > 0) {
              body += '### Changes with Insufficient Tests\n\n';
              for (const file of analysis.uncovered_changes) {
                body += `- \`${file.path}\` (${file.coverage}%)\n`;
              }
              body += '\nAdding the following tests is recommended.\n';
            }

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body,
            });

  mutation-testing:
    runs-on: ubuntu-latest
    needs: analyze-coverage
    steps:
      - uses: actions/checkout@v4

      - name: Run mutation testing
        run: |
          pip install mutmut
          mutmut run --paths-to-mutate=src/ \
            --tests-dir=tests/ \
            --runner="pytest -x -q" \
            || true  # mutmut exits with 1 when mutants are detected

      - name: Generate mutation report
        run: mutmut results > mutation-report.txt

      - name: Check mutation score
        run: |
          python scripts/check_mutation_score.py \
            --report mutation-report.txt \
            --min-score 80
```

### 6.2 Test Quality Gate

```python
# Automated test quality check gate

class TestQualityGate:
    """Automated test quality checks"""

    def __init__(self, config: dict = None):
        self.config = config or {
            "min_coverage": 80,
            "min_mutation_score": 75,
            "max_test_duration_sec": 300,
            "min_assertion_density": 1.5,  # Minimum assertions per test
            "max_test_complexity": 10,     # Maximum cyclomatic complexity of test functions
        }

    def check_all(self, metrics: dict) -> dict:
        """Check all gates"""
        results = {
            "passed": True,
            "checks": [],
        }

        checks = [
            self._check_coverage(metrics),
            self._check_mutation_score(metrics),
            self._check_test_duration(metrics),
            self._check_assertion_density(metrics),
            self._check_test_independence(metrics),
        ]

        for check in checks:
            results["checks"].append(check)
            if not check["passed"]:
                results["passed"] = False

        return results

    def _check_coverage(self, metrics: dict) -> dict:
        coverage = metrics.get("coverage", 0)
        min_cov = self.config["min_coverage"]
        return {
            "name": "Coverage",
            "passed": coverage >= min_cov,
            "value": f"{coverage:.1f}%",
            "threshold": f"{min_cov}%",
            "message": f"Coverage {'meets' if coverage >= min_cov else 'does not meet'} the threshold ({min_cov}%)",
        }

    def _check_mutation_score(self, metrics: dict) -> dict:
        score = metrics.get("mutation_score", 0)
        min_score = self.config["min_mutation_score"]
        return {
            "name": "Mutation Score",
            "passed": score >= min_score,
            "value": f"{score:.1f}%",
            "threshold": f"{min_score}%",
            "message": f"Test effectiveness {'meets' if score >= min_score else 'does not meet'} the threshold ({min_score}%)",
        }

    def _check_test_duration(self, metrics: dict) -> dict:
        duration = metrics.get("total_duration_sec", 0)
        max_dur = self.config["max_test_duration_sec"]
        return {
            "name": "Test Execution Time",
            "passed": duration <= max_dur,
            "value": f"{duration:.0f} seconds",
            "threshold": f"{max_dur} seconds or less",
            "message": f"Test execution time {'is within' if duration <= max_dur else 'exceeds'} the threshold ({max_dur} seconds)",
        }

    def _check_assertion_density(self, metrics: dict) -> dict:
        density = metrics.get("assertion_density", 0)
        min_density = self.config["min_assertion_density"]
        return {
            "name": "Assertion Density",
            "passed": density >= min_density,
            "value": f"{density:.1f}",
            "threshold": f"{min_density} or more",
            "message": f"Assertions per test {'are sufficient' if density >= min_density else 'are insufficient'}",
        }

    def _check_test_independence(self, metrics: dict) -> dict:
        order_dependent = metrics.get("order_dependent_tests", 0)
        return {
            "name": "Test Independence",
            "passed": order_dependent == 0,
            "value": f"{order_dependent} cases",
            "threshold": "0 cases",
            "message": f"{'No' if order_dependent == 0 else f'{order_dependent}'} order-dependent test(s) found",
        }
```

---

## Anti-Patterns

### Anti-Pattern 1: Chasing Coverage Numbers Only

```python
# BAD: 100% coverage but meaningless tests
def test_create_order():
    order = create_order(user_id=1, items=[{"id": 1, "qty": 1}])
    assert order is not None  # <- Verifies nothing!
    # Coverage goes up, but bugs won't be found

# GOOD: Tests that verify business rules
def test_create_order_calculates_total():
    order = create_order(
        user_id=1,
        items=[
            {"id": 1, "qty": 2, "price": 1000},
            {"id": 2, "qty": 1, "price": 500},
        ]
    )
    assert order.total == 2500  # Verify actual calculation result
    assert order.item_count == 3
    assert order.status == OrderStatus.PENDING
```

### Anti-Pattern 2: Uncritically Accepting AI-Generated Tests

```python
# BAD: Using AI-generated tests as-is
# AI often tests "implementation behavior" (implementation tests)

# Implementation test AI tends to generate (BAD)
def test_calculate_discount():
    """Test that depends on internal implementation"""
    result = calculate_discount(1000, "SAVE10")
    assert result == 1000 * 0.9  # <- Directly replicating the implementation formula

# GOOD: Test the specification
def test_calculate_discount():
    """10% discount coupon results in 100 yen discount"""
    result = calculate_discount(1000, "SAVE10")
    assert result == 900  # <- Explicitly state the expected "result"
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Create test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Remove by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Inefficient version: {slow_time:.4f} seconds")
    print(f"Efficient version:   {fast_time:.6f} seconds")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Configuration file issues | Verify configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Data volume growth | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, transaction management |

### Debugging Procedure

1. **Check error messages**: Read the stack trace and identify the location
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify step by step**: Use log output and debuggers to validate hypotheses
5. **Fix and regression test**: After fixing, run tests on related areas as well

```python
# Debugging utilities
import logging
import traceback
from functools import wraps

# Logger setup
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function input/output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in {func.__name__}: {e}")
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
2. **Check memory usage**: Check for memory leaks
3. **Check I/O wait**: Review disk and network I/O status
4. **Check concurrent connections**: Review connection pool status

| Problem Type | Diagnostic Tool | Countermeasure |
|-------------|----------------|----------------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes decision criteria for technology selection.

| Criteria | When to Prioritize | When Acceptable to Compromise |
|----------|-------------------|-------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flow              │
├─────────────────────────────────────────────────┤
│                                                 │
│  (1) Team size?                                 │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to (2)            │
│                                                 │
│  (2) Deploy frequency?                          │
│    ├─ Once a week or less → Monolith + modular  │
│    └─ Daily / multiple times → Go to (3)        │
│                                                 │
│  (3) Team independence?                         │
│    ├─ High → Microservices                      │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A method that is fast in the short term may become technical debt in the long term
- Conversely, over-engineering incurs high short-term costs and may delay the project

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit solutions but increases operational costs

**3. Level of Abstraction**
- High abstraction offers high reusability but can make debugging difficult
- Low abstraction is intuitive but tends to cause code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and challenges"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
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
- Automated tests only for critical paths
- Introduce monitoring from the start

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernization of a Legacy System

**Situation:** Gradually modernize a system that has been running for over 10 years

**Approach:**
- Migrate gradually using the Strangler Fig pattern
- Create Characterization Tests first if no existing tests
- Use an API gateway to coexist old and new systems
- Migrate data incrementally

| Phase | Work Content | Estimated Duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration Start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core Migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Define clear boundaries with Domain-Driven Design
- Set ownership per team
- Manage shared libraries using Inner Source model
- Design API-first to minimize inter-team dependencies

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

**Situation:** A system that requires millisecond-level response times

**Optimization Points:**
1. Cache strategy (L1: In-memory, L2: Redis, L3: CDN)
2. Leverage async processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | Application |
|--------------------|--------|---------------------|-------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## FAQ

### Q1: How reliable are AI-generated tests?

The reliability of AI-generated tests is approximately "80-90% for normal cases, 60-70% for error cases." Normal case tests are high quality, but AI tends to miss domain-specific edge cases and boundary conditions of business rules. The ideal approach is to verify effectiveness with mutation testing and have humans supplement test cases based on domain knowledge.

### Q2: What is the most important thing in test generation prompts?

"Clearly defining the purpose of the test" is most important. Saying just "generate tests" will only produce generic tests. Instead, specify the business rule to verify, such as "generate a test that verifies inventory is correctly restored when an order is canceled." Providing concrete examples of inputs and outputs further improves accuracy.

### Q3: How do you add AI tests to legacy code with no existing tests?

A gradual approach is effective. (1) First, have AI read the code and assess "testability." (2) Start with parts that can be tested without refactoring (pure functions, etc.). (3) For hard-to-test parts, find Seams (testable junction points) before adding tests. (4) Gradually increase coverage while performing refactoring and test additions in parallel.

### Q4: Tips for introducing mutation testing into CI/CD?

Since execution time tends to be long: (1) Target only changed files (run full suite as a nightly batch). (2) Execute faster mutants first and set timeouts. (3) Start with a low threshold (60%) and gradually increase it. (4) Register equivalent mutants (mutants that cannot be detected by tests) in a whitelist and exclude them. Representative tools are mutmut for Python, Pitest for Java, and Stryker for JavaScript.

### Q5: How to reduce test maintenance costs?

A particularly important consideration for AI tests. (1) Leverage test helpers and factory patterns to eliminate duplication in test data creation. (2) Design tests resilient to change using Page Object pattern (E2E) and Builder pattern. (3) Ask AI to refactor tests as well, applying the DRY principle. (4) Build a mechanism to regularly identify and fix flaky (unstable) tests. (5) Review test code with the same quality standards as production code.

---

## Summary

| Item | Key Points |
|------|------------|
| Generation Approaches | Three types: reverse-generate from code, generate from specs, generate from diffs |
| Test Pyramid | AI utilization is highest for unit tests (90%) |
| Quality Verification | Verify effectiveness of generated tests with mutation testing |
| Tool Selection | Copilot (speed) vs Claude Code (quality) vs Codium (specialization) |
| Coverage Strategy | Prioritize business rule comprehensiveness over numbers |
| Cautions | Avoid implementation tests, verify assertion meaningfulness |

---

## Recommended Next Guides

- [01-ai-code-review.md](./01-ai-code-review.md) -- Integration with AI Code Review
- [03-ai-debugging.md](./03-ai-debugging.md) -- AI Debugging When Tests Fail
- [../01-ai-coding/03-ai-coding-best-practices.md](../01-ai-coding/03-ai-coding-best-practices.md) -- Overall Test Strategy

---

## References

1. Martin Fowler, "TestPyramid," martinfowler.com, 2012. https://martinfowler.com/bliki/TestPyramid.html
2. David R. MacIver, "Hypothesis: Property-based testing for Python," 2024. https://hypothesis.readthedocs.io/
3. Pitest, "Mutation Testing," 2024. https://pitest.org/
