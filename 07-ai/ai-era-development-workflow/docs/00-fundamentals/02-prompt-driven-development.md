# Prompt-Driven Development -- From Specs to Prompts, From Prompts to Code

> Shift the starting point of software development from "writing code" to "designing prompts," and systematically learn the new development cycle of specification -> prompt -> code -> verification.

---

## What You Will Learn in This Chapter

1. **Prompt-Driven Development (PDD) Process** -- Understand a consistent workflow from specification definition to code generation
2. **Effective Prompt Design Patterns** -- Master prompt templates that improve reproducibility and quality
3. **Iterative Prompt Refinement Techniques** -- Acquire techniques to incrementally improve AI output quality
4. **Practical PDD Workflow** -- Learn how to introduce and operate PDD in real projects
5. **Standardizing PDD Across Teams** -- Build a system for prompt quality management and knowledge sharing


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding of the content in [AI-Era Mindset -- Principles for Human+AI Collaboration](./01-ai-dev-mindset.md)

---

## 1. What Is Prompt-Driven Development (PDD)?

### 1.1 Evolution of Development Paradigms

```
Procedural Dev        Object-Oriented      Test-Driven Dev(TDD)  Prompt-Driven Dev(PDD)
(1960s-)              (1990s-)             (2000s-)              (2024s-)

Code -> Behavior      Design -> Code       Test -> Code          Prompt -> Code

+---------+           +---------+          +---------+           +------------+
| Write   |           | Class   |          | Red     |           | Define     |
| proce-  |           | design  |          | Green   |           | spec       |
| dures   |           |   |     |          | Refac-  |           |   |        |
|   |     |           |   v     |          |  tor    |           | Prompt     |
| Debug   |           | Imple-  |          |         |           |   |        |
|         |           | ment    |          |         |           | AI gen     |
+---------+           +---------+          +---------+           |   |        |
                                                                 | Verify &   |
                                                                 | improve    |
                                                                 +------------+
```

### 1.2 PDD Workflow

```
+------------------------------------------------------+
|            Prompt-Driven Development Cycle            |
|                                                      |
|   +---------+    +---------+    +---------+          |
|   | 1.Spec  |--->| 2.Prompt|--->| 3.Gene- |          |
|   | defini- |    | design  |    | ration  |          |
|   | tion    |    |         |    | (AI)    |          |
|   +---------+    +---------+    +----+----+          |
|        ^                             |               |
|        |                             v               |
|   +---------+    +---------+    +---------+          |
|   | 6.Inte- |<---| 5.Refine|<---| 4.Veri- |          |
|   | gration |    | (iterate)|   | fication|          |
|   |         |    |         |    | (human) |          |
|   +---------+    +---------+    +---------+          |
|                                                      |
|   Estimated time per step:                           |
|   Spec(10min) -> Prompt(5min) -> Generation(1min)    |
|   -> Verification(5min) -> Refinement(3min)          |
|   -> Integration(5min)                               |
|   Total: ~30 min (traditional: 2-4 hours)            |
+------------------------------------------------------+
```

### 1.3 Fundamental Principles of PDD

Understand the five fundamental principles for making prompt-driven development successful.

```
Principle 1: Specification First
  - Always document specifications before writing code
  - Spec quality determines prompt quality, which determines code quality
  - Vague specs -> Vague prompts -> Vague code (Garbage In, Garbage Out)

Principle 2: Incremental Refinement
  - Don't aim for perfection in one shot; improve iteratively
  - Focus on one quality dimension per round (functional correctness, error handling, performance, etc.)
  - Target reaching production quality within 3 rounds

Principle 3: Context is King
  - AI can only produce optimal solutions within the scope of information provided
  - Always provide existing code, conventions, and architectural decisions as context
  - Context quality exponentially improves prompt effectiveness

Principle 4: Human in the Loop
  - Don't unconditionally accept AI output
  - Humans must review from perspectives of domain knowledge, security, and performance
  - Ultimate quality responsibility lies with humans

Principle 5: Prompt as Asset
  - Excellent prompts have asset value equal to code
  - Version-control, review, and make them reusable
  - A team's prompt library becomes a competitive advantage for the organization
```

### 1.4 Comparing PDD with Traditional Approaches

```
+--------------+--------------+--------------+--------------+
|   Aspect     | Traditional  |     TDD      |     PDD      |
+--------------+--------------+--------------+--------------+
| Starting     | Code         | Tests        | Prompts      |
| point        |              |              |              |
| Design       | UML, etc.    | Test cases   | Structured   |
| expression   |              |              | documents    |
| Iteration    | Implement -> | Red -> Green | Generate ->  |
| unit         | Debug        |              | Verify       |
| Quality      | Code review  | Tests pass   | Prompt       |
| assurance    |              |              | quality      |
| Scalability  | Linear       | Linear       | Exponential  |
| Learning     | High         | Moderate     | New skill    |
| curve        |              |              | required     |
| Reusability  | Libraries    | Tests        | Templates    |
| Documentation| Created      | Tests = Docs | Prompts =    |
|              | separately   |              | Docs         |
+--------------+--------------+--------------+--------------+
```

### 1.5 When PDD Is and Isn't Suitable

```python
# Cases where PDD is particularly effective
pdd_suitable_cases = {
    "CRUD operations": "Bulk generation of standardized APIs and screens",
    "Boilerplate": "Config files, initial code, scaffolding",
    "Test code": "Comprehensive test case generation",
    "Data transformation": "ETL, migrations, format conversions",
    "Documentation": "API docs, JSDoc/docstring",
    "Prototyping": "Proof of concept, MVP development",
    "Standard patterns": "Authentication, RBAC, audit logging, etc.",
}

# Cases where PDD has limited effectiveness
pdd_limited_cases = {
    "Advanced algorithms": "Competitive programming optimization, cases requiring mathematical proofs",
    "Domain-specific knowledge": "Complex business rules unique to an industry",
    "Performance optimization": "Microsecond-level tuning",
    "Security-critical": "Cryptographic implementation, core authentication infrastructure",
    "Legacy integration": "Integration with undocumented legacy systems",
    "Hardware interaction": "Drivers, low-level embedded systems",
}

# Decision framework
def should_use_pdd(task: dict) -> str:
    """Determine whether a task is suitable for PDD"""
    score = 0
    if task.get("is_well_defined"):        score += 2  # Spec is clear
    if task.get("has_standard_pattern"):    score += 2  # Standard pattern exists
    if task.get("is_repetitive"):          score += 1  # Repetitive work
    if task.get("needs_domain_expertise"): score -= 2  # Domain expertise needed
    if task.get("is_security_critical"):   score -= 2  # Security-critical
    if task.get("has_existing_examples"):  score += 1  # Reference examples exist

    if score >= 3:
        return "PDD recommended: Can be efficiently generated with prompts"
    elif score >= 1:
        return "Partial PDD: Generate skeleton with PDD, manually adjust details"
    else:
        return "Traditional development recommended: Manual implementation is safer and more efficient"
```

---

## 2. Prompt Design Patterns

### Code Example 1: Basic Template (CRISP Format)

```markdown
# CRISP Prompt Template

## Context
- Project: E-commerce order management system
- Tech stack: Python 3.12, FastAPI, SQLAlchemy, PostgreSQL
- Existing code conventions: PEP 8 compliant, type hints required, docstrings required

## Role
You are a senior backend engineer.
You are well-versed in Clean Architecture and DDD.

## Intent
I want to implement an order cancellation feature.
It needs to strictly check cancellation conditions (only before shipment)
and also restore inventory and notify the user.

## Specifics
- Endpoint: POST /api/v1/orders/{order_id}/cancel
- Cancellation conditions: Only when status is "pending" or "confirmed"
- Side effects: Restore inventory count, send cancellation email
- Errors: Already cancelled (409), Already shipped (422)

## Pattern (Output Format)
- Separate into domain layer, use case layer, and presentation layer
- Output each layer as a separate file
- Include test code
```

### Code Example 2: Incremental Refinement Pattern

```python
# === Step 1: Request high-level design ===
prompt_step1 = """
Please propose a design for the order cancellation feature from the following perspectives:
1. Changes to the domain model
2. Use case flow
3. Required interfaces
No code needed. Just outline the structure in bullet points.
"""

# === Step 2: Review design and generate code ===
prompt_step2 = """
I agree with the above design. Please generate code with the following modifications:
- Add an OrderCancelled event
- Guarantee idempotency (safe to send the same request twice)
- Define CancelReason as an enum
"""

# === Step 3: Tests and edge cases ===
prompt_step3 = """
Please create the following tests for the generated code:
1. Happy path: Cancel an order in pending state
2. Happy path: Cancel an order in confirmed state
3. Error case: Attempt to cancel an order in shipped state
4. Error case: Re-cancel an already cancelled order
5. Boundary: Cancel an order containing a product with 0 inventory
6. Concurrency: Two simultaneous cancel requests
"""
```

### Code Example 3: Context Injection Pattern

```markdown
# Provide existing code as context to maintain consistency

## Existing Domain Model (Reference)
```python
# Existing code in domain/order.py
class Order:
    def __init__(self, order_id: OrderId, items: list[OrderItem]):
        self._id = order_id
        self._items = items
        self._status = OrderStatus.PENDING
        self._events: list[DomainEvent] = []

    def confirm(self) -> None:
        if self._status != OrderStatus.PENDING:
            raise OrderAlreadyConfirmedException(self._id)
        self._status = OrderStatus.CONFIRMED
        self._events.append(OrderConfirmed(self._id))
```

## Request
Please add a `cancel` method that fully matches the existing patterns
(event publishing, exception classes, naming conventions) shown above.
Output only the diff from the existing code.
```

### Code Example 4: Constraint Specification Pattern

```python
# Control AI output with constraints

PROMPT_WITH_CONSTRAINTS = """
Please create a React component following the constraints below.

## Functional Requirements
User list table (with search, sort, and pagination)

## Constraints (must be followed)
- DO: Make it type-safe with TypeScript strict mode
- DO: Use TanStack Table v8
- DO: Support server-side pagination
- DO: Implement three UI states: loading, error, and empty
- DO: Include accessibility (aria attributes)

- DON'T: Use the any type
- DON'T: Fetch data inside useEffect (use TanStack Query)
- DON'T: Write inline CSS (use Tailwind CSS)
- DON'T: Exceed 200 lines per component
"""
```

### Code Example 5: Prompt Version Control

```yaml
# .prompts/order-cancel.yaml
# Version-control prompts just like code

metadata:
  id: order-cancel-v3
  author: "team-backend"
  created: "2025-03-15"
  model: "claude-sonnet-4-20250514"
  quality_score: 0.92  # Quality score from past outputs

context:
  project: "ec-platform"
  module: "order-management"
  conventions: |
    - Clean Architecture (domain / usecase / infra / presentation)
    - Domain events for side effects
    - Result type for error handling (no exceptions in domain layer)

prompt: |
  Please implement the order cancellation use case.

  Input: order_id (UUID), reason (CancelReason enum), cancelled_by (UserId)
  Output: Result[CancelledOrder, CancelError]

  Business rules:
  1. Cancellable statuses: PENDING, CONFIRMED
  2. Cannot cancel after shipment -> Redirect to ReturnRequest
  3. Restore inventory upon cancellation
  4. Publish an OrderCancelled event

  Constraints:
  - Guarantee idempotency
  - Concurrency control with optimistic locking

validation:
  - "CancelError type is defined"
  - "Returns using Result type"
  - "DomainEvent is published"
  - "At least 5 tests are included"
```

### Code Example 6: Multimodal Prompt Pattern

```markdown
# Prompts that include images and diagrams

## Code Generation from UI Mockups

### Prompt Structure
1. Attach a screenshot or Figma export
2. Add the following text prompt

## Text Prompt

Please implement the attached UI design as React components.

### Technical Specifications
- Framework: Next.js 14 App Router
- Styling: Tailwind CSS + shadcn/ui
- State management: React Server Components + useActionState

### Layout Analysis Instructions
1. Split each section of the attached image into independent components
2. Responsive design (mobile -> desktop)
3. Extract color codes accurately from the image
4. Maintain relative font size ratios

### Expected Component Structure
```
src/
  components/
    layout/
      Header.tsx
      Sidebar.tsx
      MainContent.tsx
    features/
      UserProfile/
        UserProfileCard.tsx
        UserProfileStats.tsx
        index.tsx
```

### Output Format
- Output each file separately
- Generate Storybook stories for each component
- Responsive breakpoints: sm(640px), md(768px), lg(1024px)
```

### Code Example 7: Domain Expert Prompt Pattern

```python
# Inject specific domain knowledge into AI to improve accuracy

DOMAIN_EXPERT_PROMPT = """
## Domain Knowledge (Financial Trading System)

### Terminology
- Execution (yakujo): When a buy/sell order is fulfilled
- Settlement date (ukewatashibi): 2 business days after the execution date (T+2)
- Mark-to-market (araigae): Daily recalculation of unrealized gains/losses
- Netting: Offsetting receivables and payables in the same currency

### Business Rules (strictly enforced)
1. Transactions under 100 million yen: auto-approved
2. 100 million to under 1 billion yen: department head approval required
3. 1 billion yen and above: executive approval required
4. Alert if total daily transactions to the same customer exceed 5 billion yen

### Regulatory Requirements
- 7-year retention of transaction records per the Financial Instruments and Exchange Act
- Anti-social forces screening (per transaction)
- Money laundering detection (pattern matching)

## Request
Based on the domain knowledge above, implement a domain model for the
transaction approval workflow. Write it in TypeScript + Prisma and use
the State pattern for approval state management.
"""
```

---

## 3. Prompt Quality Evaluation Criteria

### 3.1 CLEAR Criteria

| Criterion | Description | Checklist |
|-----------|-------------|-----------|
| **C**oncrete | No ambiguity | Are input/output types and error cases explicitly stated? |
| **L**ayered | Decomposes complexity | Is the scope of a single prompt appropriately limited? |
| **E**xample-rich | Shows expected format | Are input/output examples or code snippets included? |
| **A**ctionable | Immediately convertible to code | Can the AI implement it without additional questions? |
| **R**eproducible | Same result regardless of who runs it | Are model, version, and context fixed? |

### 3.2 Correlation Between Prompt Quality and Code Quality

| Prompt Quality | Code Quality Tendency | Revision Count | Total Time |
|----------------|----------------------|----------------|------------|
| Vague (1 line) | Works but poorly designed | 5-10 times | Same as traditional |
| Basic (requirements list) | Functionally correct | 2-3 times | 50% of traditional |
| Structured (CRISP) | High design and quality | 0-1 times | 25% of traditional |
| Complete (with examples + constraints) | Production quality | 0 times | 15% of traditional |

### 3.3 Prompt Quality Score Card

```python
from dataclasses import dataclass
from enum import Enum

class QualityLevel(Enum):
    POOR = 1
    BASIC = 2
    GOOD = 3
    EXCELLENT = 4

@dataclass
class PromptScoreCard:
    """Score card to quantitatively evaluate prompt quality"""

    # CLEAR criteria scores (1-4)
    concrete: QualityLevel      # Concreteness
    layered: QualityLevel       # Layering
    example_rich: QualityLevel  # Richness of examples
    actionable: QualityLevel    # Actionability
    reproducible: QualityLevel  # Reproducibility

    @property
    def total_score(self) -> int:
        """Total score (5-20)"""
        return sum([
            self.concrete.value,
            self.layered.value,
            self.example_rich.value,
            self.actionable.value,
            self.reproducible.value,
        ])

    @property
    def quality_grade(self) -> str:
        """Quality grade"""
        score = self.total_score
        if score >= 18:
            return "A: Production-quality code can be expected"
        elif score >= 14:
            return "B: Code usable with minor modifications can be expected"
        elif score >= 10:
            return "C: Skeleton is correct but significant modifications needed"
        else:
            return "D: Prompt redesign required"

    def improvement_suggestions(self) -> list[str]:
        """Generate improvement suggestions"""
        suggestions = []
        if self.concrete.value <= 2:
            suggestions.append(
                "Improve concreteness: Specify input/output types, error cases, and boundary conditions"
            )
        if self.layered.value <= 2:
            suggestions.append(
                "Improve layering: Narrow the scope of a single prompt and split into multiple steps"
            )
        if self.example_rich.value <= 2:
            suggestions.append(
                "Add examples: Include concrete input/output examples and sample code style references"
            )
        if self.actionable.value <= 2:
            suggestions.append(
                "Improve actionability: Add tech stack, library versions, and environment information"
            )
        if self.reproducible.value <= 2:
            suggestions.append(
                "Improve reproducibility: Fix model name, temperature setting, and tools used"
            )
        return suggestions


# Usage example
score = PromptScoreCard(
    concrete=QualityLevel.EXCELLENT,
    layered=QualityLevel.GOOD,
    example_rich=QualityLevel.GOOD,
    actionable=QualityLevel.EXCELLENT,
    reproducible=QualityLevel.BASIC,
)
print(f"Total score: {score.total_score}/20")
print(f"Quality grade: {score.quality_grade}")
for suggestion in score.improvement_suggestions():
    print(f"  Improvement: {suggestion}")
```

### 3.4 Automated Quality Metrics Collection

```python
import re
from typing import NamedTuple

class PromptMetrics(NamedTuple):
    """Quantitative prompt metrics"""
    word_count: int          # Word count
    has_context: bool        # Presence of context information
    has_constraints: bool    # Presence of constraints
    has_examples: bool       # Presence of examples
    has_error_cases: bool    # Description of error cases
    specificity_score: float # Specificity score (0-1)
    estimated_quality: str   # Estimated quality level

def analyze_prompt(prompt: str) -> PromptMetrics:
    """Analyze a prompt and compute metrics"""
    words = prompt.split()
    word_count = len(words)

    # Context information detection
    context_patterns = [
        r"project|tech stack|existing|architecture|convention",
        r"context|project|stack|architecture|convention",
    ]
    has_context = any(
        re.search(p, prompt, re.IGNORECASE) for p in context_patterns
    )

    # Constraint detection
    constraint_patterns = [
        r"constraint|DON'?T|forbidden|must|MUST|SHOULD NOT",
        r"constraint|restriction|requirement",
    ]
    has_constraints = any(
        re.search(p, prompt, re.IGNORECASE) for p in constraint_patterns
    )

    # Example detection
    has_examples = bool(re.search(r"example[：:]|for example|```|example|e\.g\.", prompt))

    # Error case detection
    has_error_cases = bool(
        re.search(r"error|abnormal|exception|failure|error|exception|failure", prompt, re.IGNORECASE)
    )

    # Specificity score calculation
    specificity_indicators = [
        has_context, has_constraints, has_examples, has_error_cases,
        word_count > 50, word_count > 100, word_count > 200,
        bool(re.search(r"\d+", prompt)),  # Contains numbers
        bool(re.search(r"(int|str|bool|float|list|dict|string|number)", prompt)),
    ]
    specificity_score = sum(specificity_indicators) / len(specificity_indicators)

    # Estimated quality level
    if specificity_score >= 0.8:
        estimated_quality = "EXCELLENT"
    elif specificity_score >= 0.6:
        estimated_quality = "GOOD"
    elif specificity_score >= 0.4:
        estimated_quality = "BASIC"
    else:
        estimated_quality = "POOR"

    return PromptMetrics(
        word_count=word_count,
        has_context=has_context,
        has_constraints=has_constraints,
        has_examples=has_examples,
        has_error_cases=has_error_cases,
        specificity_score=specificity_score,
        estimated_quality=estimated_quality,
    )
```

---

## 4. Iterative Refinement Techniques

### 4.1 Feedback Loop

```
+------------------------------------------------+
|        Prompt Iterative Refinement Process      |
|                                                 |
|  Round 1: Initial generation                    |
|  +----------+    +----------+                   |
|  | Prompt   |--->| Output   |---> Score: 60     |
|  | (v1)     |    | (Draft1) |                   |
|  +----------+    +----------+                   |
|       |                                         |
|       | Fix: "Error handling is insufficient"    |
|       v                                         |
|  Round 2: Improvement                           |
|  +----------+    +----------+                   |
|  | Prompt   |--->| Output   |---> Score: 80     |
|  | (v2)     |    | (Draft2) |                   |
|  +----------+    +----------+                   |
|       |                                         |
|       | Fix: "Add edge case tests"              |
|       v                                         |
|  Round 3: Completion                            |
|  +----------+    +----------+                   |
|  | Prompt   |--->| Output   |---> Score: 95     |
|  | (v3)     |    | (Final)  |                   |
|  +----------+    +----------+                   |
+------------------------------------------------+
```

### 4.2 Specific Iterative Refinement Techniques

```python
# Technique 1: Diff instruction method
# Reference previous output and only specify changes

DIFF_INSTRUCTION_PROMPT = """
Please apply the following modifications to the previously generated code.
Output only the changed parts (omit unchanged files).

## Modification Instructions
1. Add retry logic to OrderService.cancel()
   - Max 3 retries, exponential backoff (1s, 2s, 4s)
   - Retry only on OptimisticLockException

2. Add the following to the CancelledOrder response
   - refund_amount: Refund amount (tax included)
   - refund_estimated_date: Estimated refund date (3 business days later)

3. Add the following test cases
   - Retry success case
   - Retry limit exceeded case
"""

# Technique 2: Perspective switching method
# Request review and improvement from different perspectives

PERSPECTIVE_SWITCH_PROMPTS = {
    "security": """
    Please review the generated code from a security perspective:
    - Potential SQL injection, XSS vulnerabilities
    - Missing authorization checks
    - Information leakage risks (log output, error messages)
    - Need for rate limiting
    Specifically point out areas that need fixing.
    """,

    "performance": """
    Please review the generated code from a performance perspective:
    - Presence of N+1 queries
    - Unnecessary memory allocations
    - Appropriateness of caching strategy
    - Need for indexes
    Show improvement proposals as specific code modifications.
    """,

    "maintainability": """
    Please review the generated code from a maintainability perspective:
    - Compliance with SOLID principles
    - Clarity of function responsibilities
    - Testability
    - Appropriateness of naming
    Show specific refactoring proposals.
    """,
}

# Technique 3: Comparative generation method
# Generate multiple approaches and compare them

COMPARISON_PROMPT = """
Please implement the following feature using 3 different approaches.

## Feature: Order Cancellation Processing

### Approach A: Domain Event pattern
- State pros and cons

### Approach B: Saga pattern
- State pros and cons

### Approach C: State Machine pattern
- State pros and cons

Finally, state the recommended approach and the reasoning.
"""
```

### 4.3 Prompt Chaining

```python
# Chain multiple prompts to build complex deliverables

class PromptChain:
    """Chain prompts sequentially to incrementally build deliverables"""

    def __init__(self, ai_client):
        self.client = ai_client
        self.context = {}  # Accumulate output from each step

    def execute_chain(self, feature_spec: dict) -> dict:
        """Execute the prompt chain"""

        # Step 1: Architecture design
        arch_prompt = f"""
        Please design the architecture for the following feature.

        Feature: {feature_spec['name']}
        Requirements: {feature_spec['requirements']}

        Output in the following format:
        1. Component diagram (text format)
        2. Data flow
        3. API design (endpoint list)
        4. Data model (ER diagram in text format)
        """
        self.context['architecture'] = self.client.generate(arch_prompt)

        # Step 2: Domain model implementation
        domain_prompt = f"""
        Please implement the domain model based on the following architecture design.

        ## Architecture Design
        {self.context['architecture']}

        ## Constraints
        - Python 3.12 + dataclasses
        - Value objects use frozen=True
        - Include domain events
        - Use factory methods
        """
        self.context['domain'] = self.client.generate(domain_prompt)

        # Step 3: Use case implementation
        usecase_prompt = f"""
        Please implement the use cases using the following domain model.

        ## Domain Model
        {self.context['domain']}

        ## Constraints
        - Define Repository interfaces (implementation in a later step)
        - Clarify transaction boundaries
        - Express errors using Result type
        """
        self.context['usecase'] = self.client.generate(usecase_prompt)

        # Step 4: Infrastructure layer implementation
        infra_prompt = f"""
        Please create the implementation for the following Repository interfaces.

        ## Use Cases (including Repository interface definitions)
        {self.context['usecase']}

        ## Constraints
        - SQLAlchemy 2.0 + asyncio
        - For PostgreSQL
        - Include migrations (Alembic)
        """
        self.context['infra'] = self.client.generate(infra_prompt)

        # Step 5: Test generation
        test_prompt = f"""
        Please create tests for all layers below.

        ## Domain Model
        {self.context['domain']}

        ## Use Cases
        {self.context['usecase']}

        ## Constraints
        - pytest + pytest-asyncio
        - Domain layer: Unit tests (no mocks needed)
        - Use case layer: Mock Repository
        - Infrastructure layer: Start PostgreSQL with testcontainers
        - Target coverage of 90% or higher
        """
        self.context['tests'] = self.client.generate(test_prompt)

        return self.context
```

---

## 5. Practical PDD Workflow

### 5.1 Full-Stack Feature Development PDD Flow

```python
# Complete workflow example applying PDD to a real project

class PDDWorkflow:
    """
    Practical PDD Workflow

    Application example for typical feature development (user search feature)
    """

    # Phase 1: Specification definition (done by humans)
    SPEC = """
    ## User Search Feature Specification

    ### Purpose
    Quickly search for users from the admin panel and display detailed information

    ### Search Conditions
    - Free text (partial match on name, email, phone number)
    - Status filter (active, suspended, deleted)
    - Registration period (from - to)
    - Sort (name, registration date, last login date)

    ### Non-Functional Requirements
    - Response time: Under 200ms (with 1 million records)
    - Pagination: Offset-based, 20 items per page
    - Access control: Only ADMIN and SUPPORT roles can access
    """

    # Phase 2: Prompt design (humans leverage templates)
    PROMPTS = {
        "api_design": """
        ## Context
        - FastAPI + SQLAlchemy + PostgreSQL
        - Existing user table: users (id, name, email, phone,
          status, created_at, last_login_at)
        - Authentication: JWT + RBAC (roles: ADMIN, SUPPORT, USER)

        ## Request
        Please design the user search API endpoint.

        ### Search Specification
        - GET /api/v1/admin/users/search
        - Query parameters: q (free text), status,
          from_date, to_date, sort_by, sort_order, page, per_page
        - Response: Paginated user list

        ### Output Format
        - Pydantic request/response models
        - FastAPI router
        - Search service
        - SQLAlchemy query builder
        - Test code (pytest)
        """,

        "frontend": """
        ## Context
        - Next.js 14 App Router + TypeScript
        - UI: shadcn/ui + Tailwind CSS
        - State management: TanStack Query v5
        - Previously designed API: GET /api/v1/admin/users/search

        ## Request
        Please implement the admin user search page.

        ### UI Specification
        - Search form (debounced text input)
        - Filter panel (status, date range)
        - Results table (sortable, paginated)
        - Loading, error, and empty result states

        ### Output Format
        - page.tsx (Server Component)
        - SearchForm.tsx (Client Component)
        - UserTable.tsx (Client Component)
        - useUserSearch.ts (custom hook)
        - Type definition file
        """,
    }

    # Phase 3: Verification checklist (confirmed by humans)
    VERIFICATION = """
    ## Verification Checklist

    ### Functional Verification
    - [ ] Free text search works on name, email, and phone number
    - [ ] Status filter is correctly applied
    - [ ] Date range filter works correctly
    - [ ] Sorting works in ascending and descending order
    - [ ] Pagination works correctly

    ### Security Verification
    - [ ] Roles other than ADMIN and SUPPORT cannot access
    - [ ] SQL injection countermeasures are in place
    - [ ] XSS payloads in free text are handled safely

    ### Performance Verification
    - [ ] Under 200ms with 1 million test records
    - [ ] Appropriate indexes are defined
    - [ ] No N+1 queries occur

    ### UX Verification
    - [ ] Search debounce is approximately 300ms
    - [ ] Skeleton is displayed during loading
    - [ ] Retry button is displayed on error
    """
```

### 5.2 PDD for Legacy Code Refactoring

```python
# PDD approach for incrementally refactoring legacy code

LEGACY_REFACTORING_PROMPTS = {
    "step1_analysis": """
    ## Context
    Please analyze the following legacy code.

    ```python
    # legacy_order_processor.py (800-line god class)
    class OrderProcessor:
        def __init__(self, db):
            self.db = db

        def process(self, order_data):
            # Validation, inventory check, payment, notification, logging...
            # 800-line method
            ...
    ```

    ## Request
    1. Analyze and list the responsibilities
    2. Diagram the dependencies
    3. Propose refactoring priorities
    4. Create a phased migration plan (5 steps or fewer)
    """,

    "step2_interface": """
    ## Context
    Based on the previous analysis results, please design new interfaces.

    ## Constraints
    - Don't rewrite the entire OrderProcessor at once
    - Migrate incrementally using the Strangler Fig pattern
    - Maintain passing tests at each step
    - New code must follow Clean Architecture
    """,

    "step3_migration": """
    ## Context
    Based on the designed interfaces, please implement the first migration step.

    ## Migration Target
    Extract validation logic into an OrderValidator class

    ## Constraints
    - Modify OrderProcessor to delegate to OrderValidator
    - Don't change external interfaces
    - All tests must pass before and after migration
    - Include rollback procedures for the migration
    """,
}
```

### 5.3 PDD for API Design

```python
# Workflow for generating OpenAPI specifications with prompts

API_DESIGN_PDD = """
## Context
- Microservices architecture
- API Gateway: Kong
- Authentication: OAuth 2.0 + JWT
- Versioning: URL path method (/api/v1/)
- Documentation: OpenAPI 3.1

## Request
Please design REST APIs for the following resources.

### Resources: Project Management
- Project: Create, update, delete, list, and detail projects
- Task: Task management within projects
- Member: Project member management

### Design Requirements
1. HATEOAS-compliant response format
2. Cursor-based pagination (for large datasets)
3. Partial response (fields parameter)
4. Batch operation API (batch endpoint)
5. Webhook notification registration API

### Output Format
1. OpenAPI 3.1 YAML format
2. Include request/response examples for each endpoint
3. Error response schema (RFC 7807 compliant)
4. Authorization rules (which roles can access which endpoints)
"""
```

---

## 6. Prompt Template Library

### 6.1 General-Purpose Template Collection

```yaml
# .prompts/templates/crud-api.yaml
name: "CRUD API Generation Template"
description: "General-purpose template for generating standard CRUD APIs"
version: "2.0"

parameters:
  - name: entity_name
    description: "Entity name (e.g., User, Product)"
    required: true
  - name: fields
    description: "Field definitions (array of name: type)"
    required: true
  - name: tech_stack
    description: "Tech stack"
    default: "Python + FastAPI + SQLAlchemy"
  - name: auth_required
    description: "Whether authentication is required"
    default: true
  - name: soft_delete
    description: "Whether to use soft delete"
    default: true

template: |
  ## Context
  Tech stack: {{tech_stack}}
  Entity: {{entity_name}}

  ## Field Definitions
  {{#each fields}}
  - {{this.name}}: {{this.type}} {{#if this.required}}(required){{/if}}
  {{/each}}

  ## Request
  Please implement a CRUD API for {{entity_name}} with the following specification.

  ### Endpoints
  - POST   /api/v1/{{entity_name | lower}}s     - Create
  - GET    /api/v1/{{entity_name | lower}}s     - List (with pagination)
  - GET    /api/v1/{{entity_name | lower}}s/:id - Detail
  - PUT    /api/v1/{{entity_name | lower}}s/:id - Update
  - DELETE /api/v1/{{entity_name | lower}}s/:id - Delete{{#if soft_delete}} (soft delete){{/if}}

  ### Common Specifications
  {{#if auth_required}}- JWT authentication required{{/if}}
  - Validation (Pydantic)
  - Error handling (RFC 7807 format)
  - Log output (structured logging)
  - Test code (pytest, coverage 90% or higher)
```

### 6.2 Code Review Prompt Template

```yaml
# .prompts/templates/code-review.yaml
name: "AI Code Review Template"
version: "1.5"

template: |
  Please review the following code from multiple perspectives.

  ## Code Under Review
  ```
  {{code}}
  ```

  ## Review Perspectives (score 1-5 for each)

  ### 1. Correctness
  - Any errors in business logic
  - Missing edge case handling
  - Type mismatches

  ### 2. Security
  - Injection vulnerabilities
  - Missing authentication/authorization
  - Sensitive information exposure

  ### 3. Performance
  - Unnecessary computation or IO
  - Memory leaks
  - Room for optimization

  ### 4. Readability
  - Appropriateness of naming
  - Over/under-commenting
  - Function length and complexity

  ### 5. Testability
  - Dependency injection
  - Ease of mocking
  - Separation of side effects

  ## Output Format
  Show scores and specific improvement proposals with code for each perspective.
  Mark critical issues with red, recommendations with yellow, minor with green.
```

### 6.3 Test Generation Template

```yaml
# .prompts/templates/test-generation.yaml
name: "Comprehensive Test Generation Template"
version: "2.0"

template: |
  Please create a comprehensive test suite for the following code.

  ## Target Code
  ```
  {{code}}
  ```

  ## Test Requirements

  ### Test Cases by Category
  1. **Happy Path**
     - Normal operation with typical input
     - Confirm each branch path is traversed

  2. **Boundary Values**
     - Minimum and maximum values
     - Empty list, empty string
     - Zero, negative numbers

  3. **Error Cases**
     - Invalid input
     - null/undefined
     - Type mismatch
     - Resource exhaustion (memory, disk)

  4. **Concurrency**
     - Simultaneous execution
     - Race conditions
     - Deadlocks

  5. **Integration**
     - External service integration
     - DB operations
     - File I/O

  ## Constraints
  - Test framework: {{test_framework}}
  - Coverage target: {{coverage_target}}%
  - Mock library: {{mock_library}}
  - Each test must be independently executable
  - Write test names in Given-When-Then format
```

---

## 7. Advanced Prompt Techniques

### 7.1 Meta-Prompting

```python
# A prompt that generates prompts (meta-prompt)

META_PROMPT = """
You are a prompt engineer.
Please generate an optimal prompt based on the following requirements.

## Requirements
- Purpose: {purpose}
- Technology: {tech_stack}
- Complexity: {complexity}  # low / medium / high
- Quality requirements: {quality_requirements}

## Prompt Design Guidelines
1. Use CRISP format
2. Include concrete input/output examples
3. Explicitly state constraints
4. Include a quality checklist

## Output
Please output the generated prompt in the following format:
1. Prompt body
2. Usage instructions
3. Expected output quality level
4. Tips for further improvement
"""

# Usage example: Auto-generate a prompt for authentication feature
auth_meta = META_PROMPT.format(
    purpose="OAuth 2.0 + PKCE authentication flow implementation",
    tech_stack="Next.js 14 + NextAuth.js v5",
    complexity="high",
    quality_requirements="Level that can pass a security audit",
)
```

### 7.2 Self-Improving Prompts

```python
# Have the AI evaluate and improve its own prompts

SELF_IMPROVEMENT_PROMPT = """
## Step 1
Generate code using the following prompt.

{original_prompt}

## Step 2
Self-evaluate the quality of the generated code (1-10 points).

## Step 3
If the quality is below 8 points, analyze which parts of the prompt
were insufficient and propose an improved version of the prompt.

## Step 4
Regenerate code with the improved prompt and report the quality change.
"""

# Implementation of an auto-improvement loop
class SelfImprovingPrompt:
    """Loop that automatically improves prompts"""

    def __init__(self, ai_client, initial_prompt: str, target_score: int = 8):
        self.client = ai_client
        self.prompt = initial_prompt
        self.target_score = target_score
        self.history: list[dict] = []

    def run(self, max_iterations: int = 5) -> dict:
        for i in range(max_iterations):
            # Generate
            output = self.client.generate(self.prompt)

            # Self-evaluate
            evaluation = self.client.generate(f"""
            Please evaluate the quality of the following code on a 1-10 scale.
            Output the score and improvements in JSON format.

            {output}
            """)

            score = evaluation['score']
            self.history.append({
                'iteration': i + 1,
                'prompt': self.prompt,
                'score': score,
                'feedback': evaluation['improvements'],
            })

            if score >= self.target_score:
                return {
                    'final_prompt': self.prompt,
                    'final_output': output,
                    'iterations': i + 1,
                    'history': self.history,
                }

            # Improve prompt
            self.prompt = self.client.generate(f"""
            Original prompt:
            {self.prompt}

            Evaluation feedback:
            {evaluation['improvements']}

            Please output an improved version of the prompt reflecting the above feedback.
            """)

        return {
            'final_prompt': self.prompt,
            'iterations': max_iterations,
            'history': self.history,
            'note': 'Target score was not reached',
        }
```

### 7.3 Conditional Branching Prompts

```python
# Prompts that dynamically change output content based on conditions

CONDITIONAL_PROMPT_TEMPLATE = """
## Base Requirements
{base_requirement}

## Conditional Branching

### if target_environment == "production"
- Fully implement error handling
- Output structured logs (JSON format)
- Add Prometheus metrics
- Include health check endpoint
- Implement graceful shutdown

### elif target_environment == "staging"
- Implement error handling
- Enable debug logging
- Include test data generation utilities

### elif target_environment == "development"
- Basic error handling only
- Hot reload support
- Console logging
- Enable Swagger UI

## Current target environment: {target_env}
Please generate appropriate code following the conditions above.
"""

# Usage example
prompt = CONDITIONAL_PROMPT_TEMPLATE.format(
    base_requirement="User management API (CRUD)",
    target_env="production",
)
```

---

## Anti-Patterns

### Anti-Pattern 1: One-Shot Do-Everything Prompt

```markdown
# BAD: Trying to solve everything with a single prompt
"Implement all features of an e-commerce site. Include user management,
product management, order management, payment integration, inventory
management, recommendations, and notification features.
Frontend in React, backend in FastAPI, DB in PostgreSQL."

# -> Output is massive and low quality. Also hits context limits.

# GOOD: Split by feature unit and generate in dependency order
"Step 1: Define domain models (User, Product, Order)"
"Step 2: Implement User CRUD API"
"Step 3: Implement Product CRUD API (following Step 2 conventions)"
# ...build incrementally
```

### Anti-Pattern 2: Context-Deficient Prompt

```markdown
# BAD: Not providing project-specific information
"Create a login feature"

# -> Generates overly generic code that doesn't align with existing code

# GOOD: Provide existing code and conventions as context
"Following the pattern of the existing authentication module (auth/service.py),
add a Google login feature via OAuth 2.0.
Reuse the existing SessionManager and assume adding a
google_id field to UserRepository."
```

### Anti-Pattern 3: Abandoned Prompts

```markdown
# BAD: Writing a prompt once and never updating it
# Using a prompt written 3 months ago as-is
# -> Model updates, tech stack changes, quality degrades

# GOOD: Maintain prompts regularly just like code
# .prompts/CHANGELOG.md
## 2025-04-01
- claude-sonnet-4-20250514 support: Removed temperature specification (no longer needed)
- React 19 support: Added constraint permitting use of the use() hook
- Tests: Updated prompts for Vitest v2 compatibility
```

### Anti-Pattern 4: Unconditional Acceptance of Output

```python
# BAD: Deploying AI output directly to production
generated_code = ai.generate(prompt)
deploy(generated_code)  # Dangerous!

# GOOD: Always go through a verification process
generated_code = ai.generate(prompt)

# Step 1: Static analysis
lint_result = run_linter(generated_code)
assert lint_result.errors == 0

# Step 2: Type checking
type_result = run_type_checker(generated_code)
assert type_result.errors == 0

# Step 3: Run tests
test_result = run_tests(generated_code)
assert test_result.passed

# Step 4: Security scan
security_result = run_security_scan(generated_code)
assert security_result.critical == 0

# Step 5: Human review
review = request_human_review(generated_code)
assert review.approved

# Step 6: Deploy
deploy(generated_code)
```

### Anti-Pattern 5: Wasting the Context Window

```markdown
# BAD: Stuffing unnecessary information into the prompt
"Here is the entire file list for the project (500 files).
Please modify order.py from this list..."

# -> Wastes context window, diluting the actual instructions

# GOOD: Carefully select the minimum necessary context
"I'm providing order.py and the related order_repository.py
and order_event.py.
Please modify the cancel method in order.py."
```

---

## 8. Operating PDD in Teams

### 8.1 Prompt Review System

```yaml
# .github/PULL_REQUEST_TEMPLATE/prompt_review.md

## Prompt Change Review Checklist

### Required Verification Items
- [ ] Does it meet CLEAR criteria?
- [ ] Is it consistent with existing prompts?
- [ ] Are template parameters documented?
- [ ] Are validation conditions defined?
- [ ] Are expected output examples included?

### Quality Score
- Concreteness: /4
- Layering: /4
- Richness of examples: /4
- Actionability: /4
- Reproducibility: /4
- **Total: /20**

### Security Verification
- [ ] Is there defense against prompt injection?
- [ ] Is no sensitive information hardcoded?
- [ ] Does the output not contain sensitive data?

### Reviewer Comments
(free-form)
```

### 8.2 Prompt Quality Dashboard

```python
# Dashboard to visualize prompt quality across the team

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import json

@dataclass
class PromptUsageRecord:
    """Prompt usage record"""
    prompt_id: str
    user: str
    timestamp: datetime
    model: str
    quality_score: float         # 0-1
    iteration_count: int          # Number of refinement iterations
    output_accepted: bool         # Whether the output was accepted
    time_saved_minutes: Optional[float] = None  # Estimated time saved

@dataclass
class TeamPromptMetrics:
    """Team-wide prompt metrics"""
    records: list[PromptUsageRecord] = field(default_factory=list)

    @property
    def average_quality(self) -> float:
        """Average quality score"""
        if not self.records:
            return 0
        return sum(r.quality_score for r in self.records) / len(self.records)

    @property
    def acceptance_rate(self) -> float:
        """Output acceptance rate"""
        if not self.records:
            return 0
        accepted = sum(1 for r in self.records if r.output_accepted)
        return accepted / len(self.records)

    @property
    def average_iterations(self) -> float:
        """Average iteration count"""
        if not self.records:
            return 0
        return sum(r.iteration_count for r in self.records) / len(self.records)

    @property
    def total_time_saved(self) -> float:
        """Total time saved (hours)"""
        return sum(
            r.time_saved_minutes for r in self.records
            if r.time_saved_minutes is not None
        ) / 60

    def top_prompts(self, n: int = 10) -> list[dict]:
        """Top N prompts by quality score"""
        from collections import defaultdict
        prompt_scores = defaultdict(list)
        for r in self.records:
            prompt_scores[r.prompt_id].append(r.quality_score)

        averaged = [
            {"prompt_id": pid, "avg_score": sum(scores) / len(scores), "usage_count": len(scores)}
            for pid, scores in prompt_scores.items()
        ]
        return sorted(averaged, key=lambda x: x["avg_score"], reverse=True)[:n]

    def generate_report(self) -> str:
        """Generate weekly report"""
        return f"""
        ## Prompt-Driven Development Weekly Report

        ### Summary
        - Total usage count: {len(self.records)}
        - Average quality score: {self.average_quality:.2f}
        - Output acceptance rate: {self.acceptance_rate:.1%}
        - Average iteration count: {self.average_iterations:.1f}
        - Total time saved: {self.total_time_saved:.1f} hours

        ### Top Prompts
        {json.dumps(self.top_prompts(5), indent=2, ensure_ascii=False)}
        """
```

### 8.3 PDD Adoption Roadmap

```
Phase 1: Pilot Introduction (1-2 weeks)
+-- Select 2-3 PDD champions within the team
+-- Replace existing boilerplate work with PDD
+-- Training on basic templates (CRISP)
+-- Document results and challenges

Phase 2: Expansion (3-4 weeks)
+-- Conduct PDD training for the entire team
+-- Begin building the prompt template library
+-- Integrate prompt review into code review
+-- Start measuring quality metrics
+-- Add PDD retrospective to weekly retrospectives

Phase 3: Standardization (5-8 weeks)
+-- Formally establish prompt quality standards
+-- Integrate prompt validation into CI/CD pipeline
+-- Begin operating the knowledge base
+-- Lateral deployment to other teams
+-- ROI analysis and executive reporting

Phase 4: Optimization (ongoing)
+-- Automated prompt improvement pipeline
+-- Cross-team best practice sharing
+-- Adaptation to new AI models
+-- Continuous improvement based on metrics
+-- Sharing insights at industry conferences
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
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
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
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

### Exercise 2: Applied Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Applied patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for applied patterns"""

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
    print("All applied tests passed!")

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
    """Efficient search using a hash map"""
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup factor: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm time complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## FAQ

### Q1: Can PDD be used alongside TDD (Test-Driven Development)?

They are fully compatible and in fact complement each other well. The procedure is: (1) Describe test specifications with a prompt -> (2) AI generates test code -> (3) Humans review test correctness -> (4) Generate implementation code with a prompt -> (5) Confirm tests pass. AI can be leveraged at each stage of TDD's "Red -> Green -> Refactor" cycle.

### Q2: How can I improve the reusability of prompts?

There are three approaches: (1) Templatize: Create team-shared templates in formats like CRISP. (2) Parameterize: Use placeholders like `{entity_name}` for variable parts. (3) Version control: Manage in a `.prompts/` directory with Git and record quality scores as metadata.

### Q3: How should prompt quality be standardized within a team?

Introduce "prompt review" as a process similar to code review. Create checklists based on CLEAR criteria and include prompts in PRs. Register excellent prompts in the team wiki and accumulate them as a pattern library. Hold monthly "prompt quality improvement sessions" to update best practices.

### Q4: How should AI models be selected for PDD?

Use different models depending on task complexity: (1) For routine CRUD generation and boilerplate, a lightweight/fast model (Claude Haiku, etc.) is sufficient. (2) For moderate complexity involving design decisions, a balanced model (Claude Sonnet, etc.) is optimal. (3) For architecture design and complex refactoring, use a top-tier model (Claude Opus, etc.). An escalation strategy of progressively moving to higher-tier models is effective for cost optimization.

### Q5: How should prompt injection be addressed?

Special care is needed when incorporating user input into prompts. Countermeasures include: (1) Clearly separate user input from system prompts. (2) Sanitize input (escape special characters). (3) Don't trust AI output -- always validate. (4) Apply the principle of least privilege (don't give AI permission to execute system commands).

### Q6: How should PDD effectiveness be measured?

Track the following metrics: (1) Development speed: Change in completion time for similar tasks. (2) Quality: Change in bug occurrence rate and code review feedback count. (3) Reusability: Usage frequency and variety of prompt templates. (4) Satisfaction: Developer surveys (self-assessment of satisfaction and productivity with PDD). Always measure a baseline before adoption.

---

## Summary

| Item | Key Points |
|------|------------|
| PDD Definition | A methodology that develops through the cycle of spec -> prompt -> generation -> verification |
| Design Patterns | CRISP format, incremental refinement, context injection, constraint specification |
| Quality Criteria | CLEAR (Concrete, Layered, Example-rich, Actionable, Reproducible) |
| Iterative Refinement | Average of 2-3 iterations to reach 95-point quality |
| Version Control | Manage prompts with Git just like code |
| Team Operations | Prompt review, quality dashboard, template library |
| Cautions | No one-shot prompts, context required, no unconditional acceptance of output |
| Advanced Techniques | Meta-prompting, self-improvement, prompt chaining |

---

## Recommended Next Reads

- [../01-ai-coding/00-github-copilot.md](../01-ai-coding/00-github-copilot.md) -- Practical prompting with GitHub Copilot
- [../01-ai-coding/01-claude-code.md](../01-ai-coding/01-claude-code.md) -- Advanced PDD with Claude Code
- [../02-workflow/00-ai-testing.md](../02-workflow/00-ai-testing.md) -- Integrated PDD + TDD approach

---

## References

1. Elvis Saravia, "Prompt Engineering Guide," 2024. https://www.promptingguide.ai/
2. Anthropic, "Prompt Engineering Documentation," 2025. https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering
3. Lilian Weng, "Prompt Engineering," lilianweng.github.io, 2023. https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/
4. Harrison Chase, "LangChain: Building applications with LLMs," 2024. https://python.langchain.com/docs/
