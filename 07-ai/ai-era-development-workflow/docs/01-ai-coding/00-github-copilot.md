# GitHub Copilot -- Setup, Effective Usage, and Limitations

> From how GitHub Copilot works to practical usage tips and limitations you should know, learn how to maximize productivity gains in your daily coding.

---

## What You Will Learn in This Chapter

1. **Copilot Architecture and Setup** -- Understand how the completion engine works and configure the optimal environment
2. **Effective Usage Patterns** -- Master techniques and workflows that maximize completion accuracy
3. **Limitations and Alternative Strategies** -- Learn areas where Copilot struggles and how to address them appropriately
4. **Team Adoption and Operations** -- Learn strategies and governance for effectively deploying Copilot across an organization
5. **Performance Measurement and Optimization** -- Learn how to quantitatively evaluate Copilot's effectiveness and continuously improve it


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. GitHub Copilot Architecture

### 1.1 How It Works

```
┌─────────────────────────────────────────────────────┐
│              GitHub Copilot Workflow                  │
│                                                     │
│  Editor (VSCode / JetBrains / Neovim)               │
│  ┌────────────────────────────────────────┐         │
│  │  Code before and after cursor position  │         │
│  │  Context of open files                  │         │
│  │  File path and language information     │         │
│  └─────────────┬──────────────────────────┘         │
│                │ Send                               │
│                ▼                                    │
│  ┌────────────────────────────────────────┐         │
│  │  GitHub Copilot Server                  │         │
│  │  ┌──────────────┐  ┌───────────────┐  │         │
│  │  │ Context      │  │ LLM Model     │  │         │
│  │  │ Build Engine │─►│ (GPT-4o etc.) │  │         │
│  │  └──────────────┘  └───────┬───────┘  │         │
│  └────────────────────────────┼──────────┘         │
│                │              │                     │
│                │ Return       │                     │
│                │ candidates   │                     │
│                ▼              ▼                     │
│  ┌────────────────────────────────────────┐         │
│  │  Completion candidates (Ghost Text)     │         │
│  │  Tab to accept / Esc to reject          │         │
│  └────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

### 1.2 Copilot Product Lineup

```
┌─────────────────────────────────────────────────┐
│           GitHub Copilot Product Family           │
│                                                 │
│  ┌─────────────┐  ┌──────────────┐             │
│  │ Individual  │  │  Business    │             │
│  │ $10/month   │  │  $19/mo/user │             │
│  │             │  │              │             │
│  │ - Code      │  │ - All        │             │
│  │   completion│  │   Individual │             │
│  │ - Chat      │  │   features   │             │
│  │ - CLI       │  │ - Org mgmt   │             │
│  │             │  │ - Policies   │             │
│  └─────────────┘  │ - Audit logs │             │
│                   └──────────────┘             │
│  ┌──────────────────────────────┐               │
│  │  Enterprise   $39/mo/user    │               │
│  │  - All Business features     │               │
│  │  - Fine-tuning               │               │
│  │  - Knowledge Base integration│               │
│  │  - IP indemnity              │               │
│  └──────────────────────────────┘               │
└─────────────────────────────────────────────────┘
```

### 1.3 Internal Workings of the Context Build Engine

Understanding how Copilot builds context and sends it to the LLM is essential for improving completion accuracy.

```
┌──────────────────────────────────────────────────────┐
│        Detailed Context Build Flow                    │
│                                                      │
│  Step 1: Collecting Local Information                │
│  ┌────────────────────────────────────────┐          │
│  │ - Full content of the current file      │          │
│  │ - Cursor position (line, column)        │          │
│  │ - File path (used for language          │          │
│  │   detection)                            │          │
│  │ - List of files open in tabs            │          │
│  └──────────────┬─────────────────────────┘          │
│                 ▼                                    │
│  Step 2: Context Prioritization                      │
│  ┌────────────────────────────────────────┐          │
│  │ Priority 1: Code around cursor         │          │
│  │             (up to 2000 lines)         │          │
│  │ Priority 2: Import statements in       │          │
│  │             the same file              │          │
│  │ Priority 3: Related files              │          │
│  │             (same name .test / .d.ts)  │          │
│  │ Priority 4: Content of open tabs       │          │
│  │ Priority 5: Files in adjacent          │          │
│  │             directories               │          │
│  └──────────────┬─────────────────────────┘          │
│                 ▼                                    │
│  Step 3: Prompt Construction Within Token Limits     │
│  ┌────────────────────────────────────────┐          │
│  │ Total token budget: ~8,000 tokens      │          │
│  │ - Prefix (before cursor): ~4,000       │          │
│  │ - Suffix (after cursor): ~2,000        │          │
│  │ - Related files: ~2,000                │          │
│  └──────────────┬─────────────────────────┘          │
│                 ▼                                    │
│  Step 4: LLM Invocation and Candidate Generation     │
│  ┌────────────────────────────────────────┐          │
│  │ - Sent in Fill-in-the-Middle (FIM)     │          │
│  │   format                               │          │
│  │ - Multiple candidates generated in     │          │
│  │   parallel (typically 3)               │          │
│  │ - Post-processing filtering applied    │          │
│  └────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────┘
```

### 1.4 Copilot Agent Mode Architecture

Agent Mode, added to Copilot in late 2025, has a fundamentally different architecture from traditional inline completion.

```
┌──────────────────────────────────────────────────────┐
│          Copilot Agent Mode Architecture              │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │  User Instruction                           │      │
│  │  "Implement auth and write tests for it"    │      │
│  └──────────────┬─────────────────────────────┘      │
│                 ▼                                    │
│  ┌────────────────────────────────────────────┐      │
│  │  Planning Agent                             │      │
│  │  ┌────────────────────────────────────┐    │      │
│  │  │ 1. Decompose task                  │    │      │
│  │  │ 2. Plan file structure             │    │      │
│  │  │ 3. Determine execution order       │    │      │
│  │  └────────────────────────────────────┘    │      │
│  └──────────────┬─────────────────────────────┘      │
│                 ▼                                    │
│  ┌────────────────────────────────────────────┐      │
│  │  Execution Agent                            │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │      │
│  │  │ File     │ │ Code     │ │ Terminal │  │      │
│  │  │ Search   │ │ Edit     │ │ Commands │  │      │
│  │  └──────────┘ └──────────┘ └──────────┘  │      │
│  │  ┌──────────┐ ┌──────────┐               │      │
│  │  │ Test     │ │ Error    │               │      │
│  │  │ Execution│ │ Fixing   │               │      │
│  │  └──────────┘ └──────────┘               │      │
│  └──────────────┬─────────────────────────────┘      │
│                 ▼                                    │
│  ┌────────────────────────────────────────────┐      │
│  │  Result Presentation                        │      │
│  │  - Diff preview of changed files            │      │
│  │  - Test result summary                      │      │
│  │  - Accept/Reject options                    │      │
│  └────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

---

## 2. Optimal Setup

### Code Example 1: VSCode Settings

```jsonc
// .vscode/settings.json
{
  // Copilot basic settings
  "github.copilot.enable": {
    "*": true,
    "plaintext": false,     // Disable for plain text
    "markdown": true,        // Enable for Markdown
    "yaml": true,
    "json": true
  },

  // Inline completion display settings
  "editor.inlineSuggest.enabled": true,
  "editor.inlineSuggest.showToolbar": "onHover",

  // Copilot Chat settings
  "github.copilot.chat.localeOverride": "ja",  // Respond in Japanese

  // Exclusion patterns (prevent sending sensitive files to Copilot)
  "github.copilot.advanced": {
    "debug.overrideEngine": "",
    "inlineSuggest.count": 3  // Number of candidates
  }
}
```

### Code Example 2: Excluding Files with .copilotignore

```gitignore
# .copilotignore - Files not to send to Copilot

# Sensitive information
.env
.env.local
*.pem
*.key
credentials/

# Generated files (become noise)
dist/
node_modules/
*.min.js

# Code with licensing issues
vendor/proprietary/
```

### Code Example 3: Effective Comment-Driven Completion

```python
# How to write comments that improve Copilot's completion accuracy

# BAD: Vague comment
# Process data
def process():
    pass  # -> Unclear what to process, resulting in low-quality completion

# GOOD: Describe specific requirements in comments
# Read a sales CSV file and aggregate by month and category
# Input: CSV file path (headers: date, category, amount)
# Output: dict[str, dict[str, float]] = {month: {category: total}}
# Errors: FileNotFoundError, csv.Error
def aggregate_sales(filepath: str) -> dict[str, dict[str, float]]:
    # -> Copilot completes with an accurate implementation
    import csv
    from collections import defaultdict
    from datetime import datetime

    result: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))

    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            month = datetime.strptime(row['date'], '%Y-%m-%d').strftime('%Y-%m')
            category = row['category']
            amount = float(row['amount'])
            result[month][category] += amount

    return dict(result)
```

### Code Example 4: Using Copilot Chat

```python
# Effective ways to use Copilot Chat (Cmd+I)

# 1. Request code explanation
# Select range -> /explain -> Returns explanation

# 2. Test generation
# Select function -> /tests -> Generates pytest tests

# 3. Refactoring
# Select code block -> "Refactor this function.
# Follow the single responsibility principle and split into 3 functions"

# 4. Bug fixing
# Paste error message -> /fix -> Fix code is suggested

# 5. Documentation generation
# Select function -> /doc -> Docstring is generated
```

### Code Example 5: Using Copilot CLI

```bash
# GitHub Copilot CLI (terminal completion)

# Request command explanation
gh copilot explain "find . -name '*.py' -exec grep -l 'import os' {} +"

# Generate command from natural language
gh copilot suggest "Find Python files modified in the last 7 days"
# -> find . -name "*.py" -mtime -7

# Complex Git operations
gh copilot suggest "Show list of files that differ from the main branch"
# -> git diff --name-only main...HEAD

# System administration
gh copilot suggest "Find and kill the process using port 3000"
# -> lsof -ti:3000 | xargs kill -9
```

### Code Example 6: Copilot Setup in JetBrains IDEs

```xml
<!-- JetBrains IDE (IntelliJ IDEA / PyCharm / WebStorm) settings -->
<!-- Settings -> Plugins -> Install "GitHub Copilot" -->

<!-- Customize Copilot behavior -->
<!-- Settings -> Languages & Frameworks -> GitHub Copilot -->
```

```kotlin
// Copilot usage examples in JetBrains IDEs

// 1. Code completion operates similarly to VSCode
// Tab: accept, Esc: reject

// 2. JetBrains-specific strengths
// - Combine with refactoring features
//   Generate with Copilot -> Clean up with IntelliJ refactoring

// 3. Using Copilot Chat
// Tool Window -> GitHub Copilot Chat

// Practical example: Generating data classes in Kotlin
// Describe the spec in comments and Copilot completes it

// Data class for managing user information
// - id: UUID (auto-generated)
// - name: Full name (1-100 characters)
// - email: Email address (RFC 5322 compliant)
// - role: Permission (ADMIN, EDITOR, VIEWER)
// - createdAt: Creation timestamp
// - updatedAt: Update timestamp

data class User(
    val id: UUID = UUID.randomUUID(),
    val name: String,
    val email: String,
    val role: UserRole,
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant = Instant.now()
) {
    init {
        require(name.length in 1..100) { "Name must be 1-100 characters" }
        require(email.matches(Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$"))) {
            "Invalid email format"
        }
    }
}

enum class UserRole {
    ADMIN, EDITOR, VIEWER
}
```

### Code Example 7: copilot.vim Setup for Neovim

```lua
-- Copilot setup in Neovim's init.lua

-- Install copilot.vim plugin (using lazy.nvim)
return {
  {
    "github/copilot.vim",
    event = "InsertEnter",
    config = function()
      -- Enable/disable completion per language
      vim.g.copilot_filetypes = {
        ["*"] = true,
        ["markdown"] = true,
        ["yaml"] = true,
        ["json"] = true,
        ["plaintext"] = false,  -- Disable for plain text
      }

      -- Customize key mappings
      vim.g.copilot_no_tab_map = true
      vim.keymap.set("i", "<C-J>", 'copilot#Accept("\\<CR>")', {
        expr = true,
        replace_keycodes = false,
      })
      vim.keymap.set("i", "<C-]>", "<Plug>(copilot-next)")     -- Next candidate
      vim.keymap.set("i", "<C-[>", "<Plug>(copilot-previous)") -- Previous candidate
      vim.keymap.set("i", "<C-\\>", "<Plug>(copilot-dismiss)") -- Dismiss

      -- Excluded directory settings
      vim.g.copilot_workspace_folders = {
        vim.fn.expand("~/projects/current-project"),
      }
    end,
  },

  -- copilot-cmp (integration with nvim-cmp)
  {
    "zbirenbaum/copilot-cmp",
    dependencies = { "zbirenbaum/copilot.lua" },
    config = function()
      require("copilot_cmp").setup({
        suggestion = { enabled = false },
        panel = { enabled = false },
      })
    end,
  },
}
```

---

## 3. Limitations and Workarounds

### 3.1 Copilot's Strengths and Weaknesses

| Strengths | Weaknesses |
|-----------|------------|
| Boilerplate CRUD operations | Complex business logic |
| Standard library usage | Domain-specific processing |
| Test code generation | Security-critical implementations |
| Documentation comments | Large-scale multi-file refactoring |
| Regex creation | Project-wide architecture design |
| Data transformation logic | In-house proprietary framework usage |

### 3.2 Completion Quality Comparison (By Language)

| Language | Completion Accuracy | Reason |
|----------|-------------------|--------|
| Python | Very high | Abundant training data, large community |
| TypeScript | Very high | Type information is effective as context |
| Java | High | Many boilerplate patterns make prediction easy |
| Rust | Moderate | Ownership system not fully understood |
| Haskell | Moderate | Less training data for functional patterns |
| COBOL | Low | Limited training data |

### 3.3 Completion Quality by Framework

| Framework | Completion Accuracy | Strong Patterns | Notes |
|-----------|-------------------|-----------------|-------|
| React | Very high | Component definitions, hooks | Accuracy drops for latest Server Components |
| Next.js | High | Routing, API Routes | Confuses App Router vs Pages Router |
| Django | Very high | Model definitions, views, forms | Accuracy drops for custom middleware |
| FastAPI | High | Endpoint definitions, Pydantic models | Weak with complex Dependency Injection |
| Spring Boot | High | Controller, Service, Repository | Moderate accuracy for AOP configuration |
| Ruby on Rails | High | MVC overall, migrations | Weak with metaprogramming patterns |
| Flutter | Moderate | Widget definitions, State management | Weak with custom RenderObject |
| SwiftUI | Moderate | View definitions, modifiers | Weak with complex animations |

### 3.4 Specific Workarounds for Limitations

```python
# Limitation 1: Generates code for outdated API versions
# Workaround: Explicitly specify the version in comments

# GOOD: Specify the version explicitly
# Using Python 3.12, FastAPI 0.109, Pydantic v2
from pydantic import BaseModel, field_validator  # Specify v2 API

class UserCreate(BaseModel):
    name: str
    email: str

    # Explicitly use Pydantic v2 syntax
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("Invalid email")
        return v

# Limitation 2: Doesn't know project-specific naming conventions
# Workaround: Provide examples in the same file

# Project naming conventions:
# - Service names: XxxService (e.g., OrderService, PaymentService)
# - Repository names: XxxRepository (e.g., OrderRepository)
# - DTO class names: XxxDto (e.g., OrderDto, OrderCreateDto)

class OrderService:
    """Business logic for orders"""
    def __init__(self, order_repo: OrderRepository):
        self.order_repo = order_repo

    # -> Subsequent method completions will follow the naming conventions

# Limitation 3: Cannot understand business logic context
# Workaround: Define domain terms in comments

# Domain terminology:
# - SKU: Stock Keeping Unit
# - MOQ: Minimum Order Quantity
# - Lead Time: Days from order to delivery
# - Safety Stock: Buffer inventory for demand fluctuations

def calculate_reorder_point(
    average_daily_demand: float,
    lead_time_days: int,
    safety_stock: int
) -> int:
    """Calculate reorder point (ROP = average daily demand x lead time + safety stock)"""
    return int(average_daily_demand * lead_time_days) + safety_stock
```

### 3.5 Security Risks and Countermeasures

```
┌──────────────────────────────────────────────────────────┐
│           Copilot Security Risk Matrix                    │
│                                                          │
│  Risk                Impact  Frequency  Countermeasure   │
│  ─────────────────────────────────────────────────       │
│  Sensitive data leak   High    Medium   .copilotignore   │
│  Vulnerable code gen   Med     High     Review required  │
│  License violation     Med     Low      Enable public    │
│                                        code filter      │
│  Outdated API usage    Low     High     Specify version  │
│  Unintended data       Med     Medium   Network policy   │
│  transmission                          configuration    │
│                                                          │
│  Security checklist:                                     │
│  [ ] .copilotignore is configured                        │
│  [ ] Public code filter is enabled                       │
│  [ ] Compliant with organization security policies       │
│  [ ] Security review process for generated code exists   │
│  [ ] Copilot usage policy for sensitive repos defined    │
│  [ ] SOC2/ISO27001 compliance verified                   │
└──────────────────────────────────────────────────────────┘
```

```python
# Checker to validate Copilot-generated code from a security perspective

import ast
import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Severity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SecurityFinding:
    severity: Severity
    category: str
    message: str
    line_number: int
    suggestion: str


class CopilotSecurityChecker:
    """Detects security issues in Copilot-generated code"""

    # Dangerous pattern definitions
    DANGEROUS_PATTERNS = [
        {
            "pattern": r"eval\(",
            "severity": Severity.CRITICAL,
            "category": "injection",
            "message": "Using eval() creates arbitrary code execution vulnerability",
            "suggestion": "Use ast.literal_eval() or json.loads() instead",
        },
        {
            "pattern": r"exec\(",
            "severity": Severity.CRITICAL,
            "category": "injection",
            "message": "Using exec() creates arbitrary code execution vulnerability",
            "suggestion": "Consider safe alternatives",
        },
        {
            "pattern": r"subprocess\.call\(.*, shell=True",
            "severity": Severity.HIGH,
            "category": "injection",
            "message": "shell=True poses command injection risk",
            "suggestion": "Use shell=False with list-form arguments",
        },
        {
            "pattern": r"pickle\.loads?\(",
            "severity": Severity.HIGH,
            "category": "deserialization",
            "message": "Loading pickle creates arbitrary code execution vulnerability",
            "suggestion": "Use safe serialization formats such as JSON",
        },
        {
            "pattern": r"password\s*=\s*['\"][^'\"]+['\"]",
            "severity": Severity.CRITICAL,
            "category": "hardcoded_secret",
            "message": "Password is hardcoded",
            "suggestion": "Use environment variables or a secret management service",
        },
        {
            "pattern": r"(api_key|secret_key|token)\s*=\s*['\"][^'\"]+['\"]",
            "severity": Severity.CRITICAL,
            "category": "hardcoded_secret",
            "message": "API key or secret is hardcoded",
            "suggestion": "Use environment variables or a secret management service",
        },
        {
            "pattern": r"verify\s*=\s*False",
            "severity": Severity.MEDIUM,
            "category": "ssl",
            "message": "SSL certificate verification is disabled",
            "suggestion": "Always set verify=True in production environments",
        },
        {
            "pattern": r"md5\(|sha1\(",
            "severity": Severity.MEDIUM,
            "category": "crypto",
            "message": "Using weak hash algorithm",
            "suggestion": "Use SHA-256 or stronger algorithms",
        },
    ]

    def check_code(self, code: str) -> list[SecurityFinding]:
        """Scan code and detect security issues"""
        findings: list[SecurityFinding] = []

        for line_num, line in enumerate(code.split("\n"), 1):
            for pattern_def in self.DANGEROUS_PATTERNS:
                if re.search(pattern_def["pattern"], line):
                    findings.append(SecurityFinding(
                        severity=pattern_def["severity"],
                        category=pattern_def["category"],
                        message=pattern_def["message"],
                        line_number=line_num,
                        suggestion=pattern_def["suggestion"],
                    ))

        return findings

    def generate_report(self, findings: list[SecurityFinding]) -> str:
        """Generate a report of detected issues"""
        if not findings:
            return "No security issues detected."

        report_lines = ["## Security Scan Results\n"]
        report_lines.append(f"Issues found: {len(findings)}\n")

        # Group by severity
        by_severity = {}
        for f in findings:
            by_severity.setdefault(f.severity.value, []).append(f)

        for severity in ["critical", "high", "medium", "low"]:
            if severity in by_severity:
                report_lines.append(f"\n### {severity.upper()}")
                for finding in by_severity[severity]:
                    report_lines.append(
                        f"- L{finding.line_number}: {finding.message}"
                    )
                    report_lines.append(f"  Fix: {finding.suggestion}")

        return "\n".join(report_lines)


# Usage example
checker = CopilotSecurityChecker()
code_to_check = '''
import subprocess
password = "admin123"
subprocess.call(f"echo {user_input}", shell=True)
'''
findings = checker.check_code(code_to_check)
print(checker.generate_report(findings))
```

---

## 4. Techniques to Improve Completion Accuracy

### Technique Illustration

```
┌─────────────────────────────────────────────────┐
│     Copilot Completion Accuracy Techniques        │
│                                                 │
│  1. Use clear file names                         │
│     x utils.py                                  │
│     o order_cancellation_service.py             │
│                                                 │
│  2. Keep related files open                      │
│     Files open in tabs = context                │
│     -> Opening model definition files            │
│        improves completion accuracy              │
│                                                 │
│  3. Write type hints / JSDoc first               │
│     Type info -> constrains completion           │
│     -> accuracy improves                         │
│                                                 │
│  4. Show intent through test files               │
│     Write tests first -> improves completion     │
│     in the implementation file                   │
│                                                 │
│  5. Accept completions incrementally             │
│     Ctrl+Right for word-by-word partial accept   │
└─────────────────────────────────────────────────┘
```

### 4.1 Improving Accuracy with Test-Driven Development

```python
# Dramatically improve Copilot's completion accuracy by writing tests first

# Step 1: Create the test file first (test_order_service.py)
import pytest
from datetime import datetime, timedelta
from decimal import Decimal

from app.services.order_service import OrderService
from app.models.order import Order, OrderStatus, OrderItem


class TestOrderService:
    """Tests for OrderService"""

    def test_create_order_with_valid_items(self):
        """Can create an order with valid items"""
        service = OrderService()
        items = [
            OrderItem(product_id="PROD-001", quantity=2, unit_price=Decimal("1500")),
            OrderItem(product_id="PROD-002", quantity=1, unit_price=Decimal("3000")),
        ]
        order = service.create_order(customer_id="CUST-001", items=items)
        assert order.status == OrderStatus.PENDING
        assert order.total == Decimal("6000")

    def test_create_order_with_empty_items_raises_error(self):
        """Cannot create an order with an empty item list"""
        service = OrderService()
        with pytest.raises(ValueError, match="At least one item is required"):
            service.create_order(customer_id="CUST-001", items=[])

    def test_cancel_order_within_grace_period(self):
        """Cancellation within grace period results in a refund"""
        service = OrderService()
        order = service.create_order(
            customer_id="CUST-001",
            items=[OrderItem(product_id="PROD-001", quantity=1, unit_price=Decimal("1000"))],
        )
        result = service.cancel_order(order.id, reason="customer_request")
        assert result.status == OrderStatus.CANCELLED
        assert result.refund_amount == Decimal("1000")

    def test_cancel_shipped_order_raises_error(self):
        """Cannot cancel a shipped order"""
        service = OrderService()
        order = service.create_order(
            customer_id="CUST-001",
            items=[OrderItem(product_id="PROD-001", quantity=1, unit_price=Decimal("1000"))],
        )
        service.ship_order(order.id)
        with pytest.raises(ValueError, match="Cannot cancel shipped order"):
            service.cancel_order(order.id, reason="customer_request")


# Step 2: Switch to the implementation file (order_service.py)
# -> Since the test file is open in a tab,
#    Copilot references the test specs to accurately complete the implementation
```

### 4.2 Improving Accuracy with Type Hints

```typescript
// Writing TypeScript type definitions first dramatically improves Copilot accuracy

// Step 1: Create the type definition file (types/order.ts)
export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  shippedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
}

export interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  statusBreakdown: Record<OrderStatus, number>;
}

// Step 2: Switch to the service file
// -> Since the type definition file is open, Copilot
//    accurately completes the implementation following the CreateOrderRequest structure
```

### 4.3 Effective Use of the Context Window

```
┌──────────────────────────────────────────────────────────┐
│     Files to Open for Optimal Context Strategy            │
│                                                          │
│  Task                Files to keep open                  │
│  ─────────────────────────────────────────────────       │
│  New API             ┌─────────────────────────┐         │
│  implementation      │ 1. Existing similar API  │         │
│                     │ 2. Request/response types │         │
│                     │ 3. Routing config         │         │
│                     │ 4. Test file              │         │
│                     └─────────────────────────┘         │
│                                                          │
│  Adding DB           ┌─────────────────────────┐         │
│  operations          │ 1. Schema definition     │         │
│                     │ 2. Existing repository    │         │
│                     │ 3. Migration file         │         │
│                     └─────────────────────────┘         │
│                                                          │
│  Writing tests       ┌─────────────────────────┐         │
│                     │ 1. Target file            │         │
│                     │ 2. Existing tests         │         │
│                     │    (same directory)       │         │
│                     │ 3. Test helpers/fixtures  │         │
│                     │ 4. Type definition file   │         │
│                     └─────────────────────────┘         │
│                                                          │
│  Frontend            ┌─────────────────────────┐         │
│  component           │ 1. Similar component     │         │
│  creation            │ 2. Shared UI components  │         │
│                     │ 3. API client             │         │
│                     │ 4. Style variables/theme  │         │
│                     └─────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

### 4.4 Prompt Engineering Techniques

```python
# Prompt technique collection to maximize Copilot completions

# Technique 1: Progressive Refinement
# First write a high-level comment, then progressively add detail

# === Batch Processing Engine ===
# Purpose: Efficiently process large volumes of data
# Requirements:
#   - Input: Generator (for memory efficiency)
#   - Batch size: Configurable (default 100 items)
#   - Error handling: Skip individual errors and log them
#   - Retry: Exponential backoff with max 3 retries
#   - Progress reporting: Notify via callback function
#   - Concurrency: asyncio-based with max concurrent execution limit

import asyncio
import logging
from dataclasses import dataclass, field
from typing import AsyncGenerator, Callable, TypeVar, Generic

T = TypeVar("T")
R = TypeVar("R")

logger = logging.getLogger(__name__)


@dataclass
class BatchConfig:
    """Batch processing configuration"""
    batch_size: int = 100
    max_retries: int = 3
    max_concurrency: int = 10
    retry_base_delay: float = 1.0
    retry_max_delay: float = 60.0


@dataclass
class BatchResult(Generic[R]):
    """Batch processing result"""
    successful: list[R] = field(default_factory=list)
    failed: list[tuple[Exception, T]] = field(default_factory=list)
    total_processed: int = 0
    total_errors: int = 0


class BatchProcessor(Generic[T, R]):
    """
    Async batch processing engine for large data volumes.

    Usage:
        processor = BatchProcessor(
            process_fn=send_email,
            config=BatchConfig(batch_size=50, max_concurrency=5)
        )
        result = await processor.run(email_generator())
    """

    def __init__(
        self,
        process_fn: Callable[[T], R],
        config: BatchConfig | None = None,
        on_progress: Callable[[int, int], None] | None = None,
    ):
        self.process_fn = process_fn
        self.config = config or BatchConfig()
        self.on_progress = on_progress
        self._semaphore = asyncio.Semaphore(self.config.max_concurrency)

    async def _process_with_retry(self, item: T) -> R:
        """Process a single item with retry"""
        last_error: Exception | None = None
        for attempt in range(self.config.max_retries):
            try:
                async with self._semaphore:
                    if asyncio.iscoroutinefunction(self.process_fn):
                        return await self.process_fn(item)
                    return self.process_fn(item)
            except Exception as e:
                last_error = e
                delay = min(
                    self.config.retry_base_delay * (2 ** attempt),
                    self.config.retry_max_delay
                )
                logger.warning(
                    f"Attempt {attempt + 1}/{self.config.max_retries} failed: {e}. "
                    f"Retrying in {delay}s"
                )
                await asyncio.sleep(delay)
        raise last_error

    async def run(self, items: AsyncGenerator[T, None] | list[T]) -> BatchResult[R]:
        """Execute batch processing"""
        result = BatchResult()
        batch: list[T] = []

        async def process_batch(batch_items: list[T]):
            tasks = [self._process_with_retry(item) for item in batch_items]
            outcomes = await asyncio.gather(*tasks, return_exceptions=True)
            for item, outcome in zip(batch_items, outcomes):
                if isinstance(outcome, Exception):
                    result.failed.append((outcome, item))
                    result.total_errors += 1
                else:
                    result.successful.append(outcome)
                result.total_processed += 1
                if self.on_progress:
                    self.on_progress(result.total_processed, result.total_errors)

        if isinstance(items, list):
            for i in range(0, len(items), self.config.batch_size):
                await process_batch(items[i:i + self.config.batch_size])
        else:
            async for item in items:
                batch.append(item)
                if len(batch) >= self.config.batch_size:
                    await process_batch(batch)
                    batch = []
            if batch:
                await process_batch(batch)

        return result
```

---

## 5. Team Adoption Guide

### 5.1 Adoption Phases and Planning

```
┌──────────────────────────────────────────────────────────┐
│           Copilot Team Adoption Roadmap                   │
│                                                          │
│  Phase 1: Pilot (2 weeks)                                │
│  ┌────────────────────────────────────────────┐          │
│  │ - Select 3-5 early adopters               │          │
│  │ - Start trial with Individual plan        │          │
│  │ - Weekly feedback on usage experience     │          │
│  │ - Create security checklist               │          │
│  └────────────────────────────────────────────┘          │
│                    ▼                                     │
│  Phase 2: Evaluation (2 weeks)                           │
│  ┌────────────────────────────────────────────┐          │
│  │ - Measure quantitative metrics            │          │
│  │   (acceptance rate, development speed)    │          │
│  │ - Collect qualitative feedback            │          │
│  │ - Standardize .copilotignore              │          │
│  │ - Develop guidelines                      │          │
│  └────────────────────────────────────────────┘          │
│                    ▼                                     │
│  Phase 3: Expanded Rollout (1 month)                     │
│  ┌────────────────────────────────────────────┐          │
│  │ - Migrate to Business plan                │          │
│  │ - Deploy to all development teams         │          │
│  │ - Conduct training sessions               │          │
│  │ - Update coding standards                 │          │
│  │   (accounting for Copilot)               │          │
│  └────────────────────────────────────────────┘          │
│                    ▼                                     │
│  Phase 4: Optimization (ongoing)                         │
│  ┌────────────────────────────────────────────┐          │
│  │ - Produce monthly effectiveness reports   │          │
│  │ - Build best practices knowledge base     │          │
│  │ - Consider Enterprise                     │          │
│  │   (Knowledge Base integration)           │          │
│  │ - Integrate with CI/CD pipeline           │          │
│  └────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Effectiveness Measurement Framework

```python
# Script for measuring Copilot adoption effectiveness

import json
from dataclasses import dataclass, asdict
from datetime import datetime, date
from typing import Optional


@dataclass
class CopilotMetrics:
    """Copilot usage metrics"""
    date: date
    developer_id: str

    # Completion-related
    suggestions_shown: int = 0      # Number of suggestions shown
    suggestions_accepted: int = 0    # Number of suggestions accepted
    characters_accepted: int = 0     # Number of characters accepted

    # Productivity-related
    lines_of_code_written: int = 0   # Lines of code written
    pull_requests_created: int = 0   # Number of PRs created
    time_to_first_commit: float = 0  # Time to first commit (minutes)

    # Quality-related
    bugs_introduced: int = 0         # Number of bugs introduced
    code_review_iterations: int = 0  # Number of code review round-trips
    test_coverage_change: float = 0  # Change in test coverage

    @property
    def acceptance_rate(self) -> float:
        """Completion acceptance rate"""
        if self.suggestions_shown == 0:
            return 0.0
        return self.suggestions_accepted / self.suggestions_shown * 100

    @property
    def productivity_score(self) -> float:
        """Overall productivity score (0-100)"""
        # Calculated as weighted average
        scores = {
            "acceptance_rate": min(self.acceptance_rate / 40 * 30, 30),  # Max 30 points
            "code_volume": min(self.lines_of_code_written / 200 * 20, 20),  # Max 20 points
            "pr_velocity": min(self.pull_requests_created / 3 * 20, 20),  # Max 20 points
            "quality": max(0, 30 - self.bugs_introduced * 10 -
                          self.code_review_iterations * 5),  # Max 30 points
        }
        return sum(scores.values())


class CopilotDashboard:
    """Dashboard for team-wide Copilot usage"""

    def __init__(self):
        self.metrics_history: list[CopilotMetrics] = []

    def add_metrics(self, metrics: CopilotMetrics):
        self.metrics_history.append(metrics)

    def team_summary(self) -> dict:
        """Return team-wide summary"""
        if not self.metrics_history:
            return {"error": "No data available"}

        total_suggestions = sum(m.suggestions_shown for m in self.metrics_history)
        total_accepted = sum(m.suggestions_accepted for m in self.metrics_history)
        avg_acceptance = total_accepted / total_suggestions * 100 if total_suggestions > 0 else 0

        developers = set(m.developer_id for m in self.metrics_history)
        avg_productivity = sum(
            m.productivity_score for m in self.metrics_history
        ) / len(self.metrics_history)

        return {
            "period": {
                "start": min(m.date for m in self.metrics_history).isoformat(),
                "end": max(m.date for m in self.metrics_history).isoformat(),
            },
            "team_size": len(developers),
            "total_suggestions_shown": total_suggestions,
            "total_suggestions_accepted": total_accepted,
            "average_acceptance_rate": round(avg_acceptance, 1),
            "average_productivity_score": round(avg_productivity, 1),
            "total_characters_accepted": sum(
                m.characters_accepted for m in self.metrics_history
            ),
            "estimated_time_saved_hours": round(
                sum(m.characters_accepted for m in self.metrics_history) / 500 * 0.5, 1
            ),
        }

    def generate_report(self) -> str:
        """Generate a report"""
        summary = self.team_summary()
        report = f"""
## Copilot Usage Report

### Period
{summary.get('period', {}).get('start', 'N/A')} to {summary.get('period', {}).get('end', 'N/A')}

### Team Overview
- Team size: {summary.get('team_size', 0)} members
- Suggestions shown: {summary.get('total_suggestions_shown', 0):,}
- Suggestions accepted: {summary.get('total_suggestions_accepted', 0):,}
- Average acceptance rate: {summary.get('average_acceptance_rate', 0)}%
- Average productivity score: {summary.get('average_productivity_score', 0)}/100
- Characters accepted: {summary.get('total_characters_accepted', 0):,}
- Estimated time saved: {summary.get('estimated_time_saved_hours', 0)} hours

### Assessment
A healthy acceptance rate target is 25-35%.
If higher, consider stricter code reviews.
If lower, context improvement or training is needed.
"""
        return report
```

### 5.3 Organization Policy Template

```markdown
# GitHub Copilot Usage Policy

## 1. Eligible Users
- All full-time developers (contractors require individual approval)
- QA engineers and SREs are also eligible

## 2. Prohibited Uses
- [ ] Using Copilot with files containing sensitive information (customer data, credentials)
- [ ] Using security-critical encryption/authentication code without review
- [ ] Using in outsourced partner repositories (contract review required)
- [ ] Providing licenses to offshore teams (legal review required)

## 3. Required Configuration
- Configure .copilotignore (use the template)
- Enable public code filter
- Configure chat log retention period

## 4. Code Review Requirements
- Apply standard code review process to Copilot-generated code
- Conduct additional security review for security-related code
- Recommend adding // Generated with Copilot comments to generated code

## 5. Quality Standards
- 80%+ test coverage for generated code
- Zero lint errors
- Documented public APIs
```

---

## 6. Troubleshooting

### 6.1 Common Issues and Solutions

```
┌──────────────────────────────────────────────────────────────┐
│           Copilot Troubleshooting Guide                       │
│                                                              │
│  Issue 1: No completion suggestions appear                    │
│  ─────────────────────────────────────────────               │
│  Check 1: Copilot icon in VSCode status bar                  │
│           -> Active (green) / Disabled (gray) / Error (red)  │
│  Check 2: Network connection                                 │
│           -> Verify proxy settings and firewall              │
│  Check 3: File type exclusion settings                       │
│           -> Check copilot.enable in settings.json           │
│  Check 4: Extension conflicts                                │
│           -> Disable other AI completion extensions           │
│  Check 5: Authentication status                              │
│           -> GitHub Copilot: Sign Out -> Sign in again       │
│                                                              │
│  Issue 2: Low completion quality                              │
│  ─────────────────────────────────────────────               │
│  Fix 1: Reinforce context with comments                      │
│  Fix 2: Add type hints / JSDoc                               │
│  Fix 3: Open related files in tabs                           │
│  Fix 4: Use clear file names                                 │
│  Fix 5: Review workspace settings                            │
│                                                              │
│  Issue 3: Outdated code/APIs are generated                    │
│  ─────────────────────────────────────────────               │
│  Fix 1: Explicitly specify versions in comments              │
│  Fix 2: Place up-to-date sample code in the same file        │
│  Fix 3: Reference latest info via @docs or web search        │
│  Fix 4: Pin versions in .cursorrules / CLAUDE.md             │
│                                                              │
│  Issue 4: Conflicts with other editor extensions              │
│  ─────────────────────────────────────────────               │
│  Fix 1: Disable other AI completions such as TabNine         │
│  Fix 2: Set priority with IntelliCode completion             │
│  Fix 3: Resolve keybinding conflicts                         │
│         (Cmd+K, Ctrl+Space, etc.)                            │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Performance Optimization

```jsonc
// VSCode settings for optimizing Copilot performance

{
  // Optimization for large repositories
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true,
    "**/build/**": true,
    "**/.git/objects/**": true,
    "**/vendor/**": true
  },

  // Improve Copilot response speed
  "editor.quickSuggestions": {
    "strings": false  // Disable completion in strings (reduce noise)
  },

  // Optimize memory usage
  "editor.maxTokenizationLineLength": 5000,

  // Network optimization (proxy environments)
  "http.proxy": "http://proxy.company.com:8080",
  "http.proxyStrictSSL": true,
  "github.copilot.advanced": {
    "debug.useProxy": true
  }
}
```

### 6.3 Configuration for Corporate Networks

```bash
# Copilot configuration in corporate proxy environments

# 1. Verify proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 2. VS Code proxy settings
# Settings -> Search for "proxy"
# "http.proxy": "http://proxy.example.com:8080"

# 3. npm (copilot-cli) proxy settings
npm config set proxy http://proxy.example.com:8080
npm config set https-proxy http://proxy.example.com:8080

# 4. Git proxy settings
git config --global http.proxy http://proxy.example.com:8080

# 5. Authentication test
gh auth status  # Verify connection to GitHub
gh copilot --version  # Verify Copilot CLI operation

# 6. Domains that need firewall allowlisting
# - github.com
# - api.github.com
# - copilot-proxy.githubusercontent.com
# - *.githubcopilot.com
# - default.exp-tas.com
```

---

## 7. Copilot Extensions and Future Outlook

### 7.1 Copilot Extensions

```
┌──────────────────────────────────────────────────────────┐
│           Copilot Extensions Ecosystem                    │
│                                                          │
│  ┌──────────────────────────────────┐                    │
│  │  Copilot Extensions              │                    │
│  │  - Third parties extend Copilot  │                    │
│  │  - Invoke via @extension_name    │                    │
│  │    in Chat                       │                    │
│  │  - Distributed on GitHub         │                    │
│  │    Marketplace                   │                    │
│  └──────────────┬───────────────────┘                    │
│                 │                                        │
│  ┌──────────────▼───────────────────┐                    │
│  │  Major Extensions                │                    │
│  │                                  │                    │
│  │  @docker     Docker assistance   │                    │
│  │  @sentry     Error tracking      │                    │
│  │  @datadog    Monitoring          │                    │
│  │  @mongodb    MongoDB operations  │                    │
│  │  @azure      Azure development   │                    │
│  │  @hashicorp  Terraform support   │                    │
│  └──────────────────────────────────┘                    │
│                                                          │
│  Usage examples:                                         │
│  > @docker Optimize the Dockerfile for this app          │
│  > @sentry Summarize recent production errors            │
│  > @azure Deploy this API to Azure Functions             │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Copilot Workspace

```
┌──────────────────────────────────────────────────────────┐
│            Copilot Workspace Overview                     │
│                                                          │
│  Copilot Workspace is a next-generation development      │
│  environment where AI assists the entire workflow         │
│  from Issue to Pull Request.                             │
│                                                          │
│  ┌─────────┐                                            │
│  │ Issue   │ <- Describe the problem in natural language │
│  └────┬────┘                                            │
│       ▼                                                  │
│  ┌─────────┐                                            │
│  │ Analyze │ <- AI analyzes the issue and identifies     │
│  └────┬────┘    the scope of impact                     │
│       ▼                                                  │
│  ┌─────────┐                                            │
│  │ Plan    │ <- Proposes a change plan                   │
│  └────┬────┘    (files and changes)                     │
│       ▼                                                  │
│  ┌─────────┐                                            │
│  │Implement│ <- Generates code based on the plan        │
│  └────┬────┘                                            │
│       ▼                                                  │
│  ┌─────────┐                                            │
│  │ Verify  │ <- Runs tests, checks links                │
│  └────┬────┘                                            │
│       ▼                                                  │
│  ┌─────────┐                                            │
│  │Create PR│ <- Automatically creates a reviewable PR   │
│  └─────────┘                                            │
│                                                          │
│  Traditional flow:                                       │
│  Issue -> Developer analyzes -> Design -> Implement      │
│  -> Test -> PR                                          │
│  Time required: Hours to days                            │
│                                                          │
│  Workspace:                                              │
│  Issue -> AI analysis -> AI proposal -> Human review     │
│  and refinement -> PR                                   │
│  Time required: Minutes to hours                         │
└──────────────────────────────────────────────────────────┘
```

---

## Anti-patterns

### Anti-pattern 1: Tab-Mashing Development

```python
# BAD: Continuously accepting Copilot suggestions by mashing Tab
# -> Risk of unintended logic sneaking in

# Example: Authentication code suggested by Copilot
def verify_token(token: str) -> bool:
    # Accepted via Tab, but expiration check is missing
    decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    return decoded is not None  # <- Returns True even if expired!

# GOOD: Read and understand each suggestion before accepting
def verify_token(token: str) -> bool:
    try:
        decoded = jwt.decode(
            token, SECRET_KEY,
            algorithms=["HS256"],
            options={"verify_exp": True}  # Verify expiration
        )
        return True
    except jwt.ExpiredSignatureError:
        return False
    except jwt.InvalidTokenError:
        return False
```

### Anti-pattern 2: Abandoning Code Understanding Due to Copilot Dependency

```
Bad habits:
   - Using completed code without reading it
   - Judging "it works so it must be correct"
   - Becoming unable to write code without Copilot

Good habits:
   - Always read the code before accepting
   - Verify you can explain the completion out loud
   - Practice coding without Copilot once a week
   - Write tests for completed code
```

### Anti-pattern 3: Context Pollution

```python
# BAD: Unrelated code scattered throughout the file,
# polluting Copilot's context

# =============================================
# Temporary debug code (remove later)
# =============================================
# import pdb; pdb.set_trace()
# print("DEBUG: user_data =", user_data)
# # TODO: This if statement makes no sense but breaks if removed
# if True:
#     pass
# =============================================

class OrderService:
    # -> Copilot is influenced by this debug code
    #    and generates low-quality completions

# GOOD: Keep files clean
# - Remove debug code as soon as you're done with it
# - Regularly clean up TODO/HACK comments
# - Auto-remove unused imports (isort / autoflake)
```

### Anti-pattern 4: Deploying Copilot-Generated Code Without Tests

```python
# BAD: Deploying Copilot-generated code to production without tests
def calculate_discount(price: float, coupon: str) -> float:
    # Using Copilot's completion as-is
    if coupon == "SUMMER20":
        return price * 0.8
    elif coupon == "VIP50":
        return price * 0.5
    return price
    # -> Does not handle negative price, zero price, or float precision issues

# GOOD: Always write tests before deploying to production
def calculate_discount(price: Decimal, coupon: str) -> Decimal:
    """Calculate discounted price"""
    if price < 0:
        raise ValueError("Price must be non-negative")

    discount_map = {
        "SUMMER20": Decimal("0.80"),
        "VIP50": Decimal("0.50"),
    }

    multiplier = discount_map.get(coupon, Decimal("1.00"))
    discounted = (price * multiplier).quantize(Decimal("0.01"))
    return max(discounted, Decimal("0"))

# Tests
class TestCalculateDiscount:
    def test_valid_coupon(self):
        assert calculate_discount(Decimal("1000"), "SUMMER20") == Decimal("800.00")

    def test_no_coupon(self):
        assert calculate_discount(Decimal("1000"), "INVALID") == Decimal("1000.00")

    def test_negative_price_raises(self):
        with pytest.raises(ValueError):
            calculate_discount(Decimal("-100"), "SUMMER20")

    def test_zero_price(self):
        assert calculate_discount(Decimal("0"), "VIP50") == Decimal("0.00")
```

---

## Edge Case Analysis

### Edge Case 1: Copilot in Large Monorepos

```
Problem: Copilot accuracy decreases in monorepos with thousands of files

Causes:
- Context window limitation (~8K tokens)
- Many similarly named files lead to incorrect context selection
- Mixed coding conventions from different teams

Countermeasures:
1. Limit target directories with workspace folders
   {
     "folders": [
       {"path": "packages/my-service"}  // <- Only relevant packages
     ]
   }

2. Exclude unrelated packages with .copilotignore
   packages/other-service/
   packages/legacy-code/

3. Clarify scope through file naming
   packages/order-service/src/services/OrderCalculationService.ts
   (package name is included in the file path)
```

### Edge Case 2: Copilot in Legacy Codebases

```
Problem: Learns old patterns (jQuery, ES5, callback hell)
        and generates code matching them

Countermeasures:
1. Create "example files" with modern code
   -> Copilot references these patterns for completions

2. Explicitly specify modern patterns in comments
   // Implement using React 18 + TypeScript + hooks pattern
   // Do not use jQuery or class components

3. Separate old and new code into different directories
   src/
   ├── legacy/  (add to .copilotignore)
   └── modern/  (Copilot only references this)
```

---

## FAQ

### Q1: What should I do when Copilot doesn't show suggestions?

There are three main causes. (1) Network connection issues -- check the Copilot icon in the status bar, (2) File type is excluded -- check `github.copilot.enable` in settings.json, (3) Insufficient context -- add comments or type hints. If the issue persists, try toggling with `Copilot: Toggle`.

### Q2: Who owns the copyright of Copilot-generated code?

According to GitHub's TOS, users hold the copyright for Copilot's output. However, there is a risk of output being very similar to training data (verbatim copy). The Enterprise plan includes IP indemnity. To ensure compatibility with OSS licenses, it is recommended to enable `public code filter`.

### Q3: Should I choose Copilot or Cursor?

Decide based on your use case. Copilot excels as a "completion tool added to your existing editor" and is ideal if you don't want to leave VSCode or JetBrains. Cursor is an IDE designed with AI in mind and has advantages for multi-file editing and understanding the entire codebase. Ideally, try both, but if you want to minimize costs, start with Copilot Individual.

### Q4: How do I undo after accepting a Copilot completion?

Use the standard Undo (Cmd+Z / Ctrl+Z) to revert. Since accepting Copilot completions is treated as regular text editing, the editor's standard Undo functionality works. Even multi-line completions are undone in a single Undo operation.

### Q5: How can I check Copilot usage statistics?

Available at GitHub.com -> Settings -> Copilot -> Usage. Business/Enterprise plans provide an admin dashboard with organization-wide statistics. Within VSCode, clicking the Copilot icon in the status bar shows the session acceptance rate.

### Q6: Can I train Copilot on our internal private libraries?

With the Enterprise plan's Knowledge Base feature, you can leverage internal repository code as Copilot context. However, this is a RAG (Retrieval-Augmented Generation) based approach, not fine-tuning -- it searches for and references relevant code during completion. This feature is not available on Individual/Business plans.

### Q7: Can Copilot and Claude Code be used together?

Yes, they work well together. An effective division of labor is having Copilot provide inline completions in the editor while Claude Code handles agent tasks in the terminal. However, combining Cursor IDE + Copilot may cause AI completion features to conflict. The combination of VSCode + Copilot + Claude Code in the terminal has the fewest conflicts.

---

## Summary

| Item | Key Points |
|------|-----------|
| How it works | Sends context from editor to server, LLM returns completion candidates |
| Setup | Exclude sensitive files with .copilotignore, enable/disable per language |
| Accuracy improvement | Type hints, clear file names, open related files |
| Chat usage | Four major use cases: /explain, /tests, /fix, /doc |
| CLI | `gh copilot suggest` for terminal operation completion |
| Limitations | Complex business logic and security implementations require human judgment |
| Team adoption | Four phases: Pilot -> Evaluation -> Expanded rollout -> Optimization |
| Effectiveness measurement | 25-35% acceptance rate is healthy, improve through regular reports |
| Security | .copilotignore, public code filter, review process |

---

## Recommended Next Reads

- [01-claude-code.md](./01-claude-code.md) -- Agent-based development with Claude Code
- [02-cursor-and-windsurf.md](./02-cursor-and-windsurf.md) -- Comparison with AI IDEs
- [03-ai-coding-best-practices.md](./03-ai-coding-best-practices.md) -- AI coding best practices

---

## References

1. GitHub, "GitHub Copilot Documentation," 2025. https://docs.github.com/en/copilot
2. Albert Ziegler et al., "Productivity Assessment of Neural Code Completion," ACM, 2022. https://doi.org/10.1145/3520312.3534864
3. GitHub, "GitHub Copilot Trust Center," 2025. https://resources.github.com/copilot-trust-center/
4. GitHub, "Copilot Extensions Documentation," 2025. https://docs.github.com/en/copilot/github-copilot-extensions
5. GitHub, "Copilot Workspace Technical Preview," 2025. https://githubnext.com/projects/copilot-workspace
6. Thomas Dohmke, "GitHub Copilot X: The AI-Powered Developer Experience," GitHub Blog, 2023. https://github.blog/2023-03-22-github-copilot-x-the-ai-powered-developer-experience/
