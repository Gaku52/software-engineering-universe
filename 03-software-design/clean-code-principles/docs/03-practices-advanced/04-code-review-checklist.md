# Code Review Checklist

> Code review serves three roles: quality assurance, knowledge sharing, and team learning. This guide explains the perspectives, processes, and communication techniques for conducting efficient and constructive reviews based on a systematic checklist rather than subjective judgment.

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|--------|
| Clean Code Fundamentals | Naming conventions, function design, how to write comments | 00-naming-conventions.md |
| SOLID Principles | Single Responsibility Principle, Dependency Inversion | 04-solid-principles.md |
| Testing Principles | Test pyramid, test coverage | [04-testing-principles.md](../01-practices/04-testing-principles.md) |
| Refactoring | Code smells, technical debt | [03-technical-debt.md](../02-refactoring/03-technical-debt.md) |
| API Design | REST API design principles | [03-api-design.md](./03-api-design.md) |

---

## What You Will Learn

1. **Review Perspective Framework** — Perform comprehensive checks across five axes: correctness, readability, maintainability, security, and performance
2. **Efficient Review Process** — Balance review efficiency and quality through PR size limits, response time SLAs, and automation integration
3. **Constructive Feedback** — Promote team growth through comment classification, suggestion-based reviews, and psychological safety
4. **Review Automation Strategy** — Integrate with CI/CD pipelines and leverage static analysis tools to focus human judgment where it matters most
5. **Organization-Level Review Culture** — Establish a sustainable review system using CODEOWNERS, review metrics, and knowledge-sharing mechanisms

---

## 1. The Five Axes of Review

### 1.1 Overall Checklist Structure

```
Code Review 5-Axis Check

  +-----------+
  | Correctness|  <- Is the logic correct? Edge cases?
  +-----------+
       |
  +-----------+
  | Readability|  <- Can your future self understand this in 6 months?
  +-----------+
       |
  +-----------+
  | Maintainability| <- Is it easy to change? Are there tests?
  +-----------+
       |
  +-----------+
  | Security  |  <- Input validation? Authentication and authorization?
  +-----------+
       |
  +-----------+
  | Performance| <- N+1 issues? Memory leaks?
  +-----------+
```

```
Review Priority Matrix:

  High Priority (Merge Blockers):
  ├── Bugs / Logic errors
  ├── Security vulnerabilities
  ├── Potential data loss
  └── Impact on production environment

  Medium Priority (Recommended to Fix):
  ├── Design / Architecture issues
  ├── Insufficient tests
  ├── Performance issues
  └── Insufficient error handling

  Low Priority (Improvement Suggestions):
  ├── Naming improvements
  ├── Code style
  ├── Insufficient documentation
  └── Room for refactoring
```

### 1.2 Detailed Checklist for Each Axis

```python
# ===== Correctness Check =====
correctness_checklist = [
    "Does the business logic match the requirements?",
    "Are edge cases handled? (null, empty array, 0, negative numbers, max values)",
    "Is error handling appropriate? (exception types, recovery)",
    "Are there concurrency issues? (race conditions, deadlocks)",
    "Are transaction boundaries correct?",
    "Do existing tests pass? (no regressions)",
    "Are integer overflow and floating-point rounding errors accounted for?",
    "Is timezone and date boundary handling correct?",
]

# ===== Readability Check =====
readability_checklist = [
    "Do variable and function names clearly convey intent?",
    "Is the function length appropriate? (aim for 20 lines or fewer)",
    "Is nesting too deep? (aim for 3 levels or fewer)",
    "Do comments explain 'why'? (code should explain 'what')",
    "Is a consistent naming convention followed?",
    "Are there unnecessary comments or dead code?",
    "Is cognitive load low? (not mixing multiple abstraction levels in one function)",
    "Is there deep nesting where early-return patterns could be used?",
]

# ===== Maintainability Check =====
maintainability_checklist = [
    "Does it follow the Single Responsibility Principle? (1 class = 1 responsibility)",
    "DRY principle: is there duplicate code?",
    "Have tests been added? (new features, bug fixes)",
    "Does it follow existing architectural patterns?",
    "Are dependency directions correct? (no layer violations)",
    "Are magic numbers extracted as constants?",
    "Is there appropriate abstraction for areas likely to change in the future?",
    "Are configuration values not hardcoded? (environment variables, config files)",
]

# ===== Security Check =====
security_checklist = [
    "Is input validation and sanitization appropriate?",
    "SQL injection protection (parameter binding)",
    "XSS protection (output escaping)",
    "Are authentication and authorization checks complete?",
    "Is sensitive information not being output to logs?",
    "Are secret keys and tokens not hardcoded in the code?",
    "Is CSRF protection appropriate?",
    "Are file upload size limits and type checks appropriate?",
    "Are rate limits configured appropriately?",
]

# ===== Performance Check =====
performance_checklist = [
    "Are there N+1 query issues?",
    "Is there unnecessary data fetching? (SELECT *)",
    "Are there DB/API calls inside loops?",
    "Are appropriate indexes configured?",
    "Will large data processing not exhaust memory?",
    "Is data that should be cached being cached?",
    "Are there unnecessary re-renders? (React)",
    "Are heavy operations that should be async being run synchronously?",
]
```

### 1.3 Review Perspective Cheat Sheet

```
┌───────────────────────────────────────────────────────┐
│          Review Perspective Quick Reference            │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Identify areas affected by the change:               │
│  ├── Where is this function called? (impact scope)    │
│  ├── What tests might this change break?              │
│  └── Is documentation update needed?                 │
│                                                       │
│  Check these (not "how would I write it"):            │
│  ├── Does it satisfy the requirements?                │
│  ├── Are edge cases handled?                          │
│  ├── Are tests sufficient?                            │
│  └── Are there security risks?                        │
│                                                       │
│  Easy-to-miss points:                                 │
│  ├── Impact of deleted code                           │
│  ├── Changes to configuration files                   │
│  ├── DB migrations (can they be rolled back?)         │
│  └── Addition of environment variables / secrets      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 2. Review Flow and Rules

### 2.1 Process

```
  Create PR
    |
    v
  [Automated Checks] <- CI: lint, test, coverage, security scan
    |
    | All pass
    v
  [Self Review] <- Author confirms first
    |
    v
  [Review Request] <- Assign 1-2 reviewers
    |
    +---> Reviewer check (target: within 24 hours)
    |
    v
  [Feedback]
    |
    +---> Approve -> Merge
    |
    +---> Request Changes -> Fix -> Re-review
    |
    +---> Comment -> Discussion -> Consensus
```

### 2.2 Systematic Self-Review Method

```python
# Self-review checklist
# Author confirms this after creating the PR, before requesting a review

self_review_checklist = {
    "Debug code": [
        "Are print / console.log / debugger statements left in?",
        "Confirm TODO / FIXME / HACK comments are intentional",
        "Are hardcoded values for testing left in?",
    ],
    "Diff confirmation": [
        "Are unnecessary changes (formatting-only diffs) mixed in?",
        "Are unintended files included? (.env, node_modules)",
        "Do commit messages accurately reflect the changes?",
    ],
    "Tests": [
        "Were tests added for new features?",
        "Were regression tests added for bug fixes?",
        "Are tests independent of each other? (independence)",
    ],
    "Documentation": [
        "Does a change to a public API require a documentation update?",
        "Are README or CHANGELOG updates needed?",
        "Are comments consistent with the latest implementation?",
    ],
}

# Research finding: self-review can pre-emptively remove 30-40% of review items
```

### 2.3 PR Size Guidelines

```
Relationship Between PR Size and Review Quality

  Lines Changed  Review Quality  Recommendation  Estimated Review Time
  ──────────────────────────────────────────────────────────────────────
  < 50           Very high       Optimal         Under 15 min
  50-200         High            Recommended     Under 30 min
  200-400        Moderate        Acceptable      Under 60 min
  400-800        Low             Split recommended  60+ min
  > 800          Very low        Must split      Request split

  Research findings (SmartBear, Cisco):
  - Defect detection rate is highest for reviews under 200 lines
  - Over 400 lines tends to result in "LGTM" rubber-stamping
  - Concentration drops after 60 minutes of reviewing
  - Max 60 minutes per review session; take a break before continuing
```

```
Strategy for splitting large PRs:

  1. Split by layer
     ├── PR 1: DB migration + model
     ├── PR 2: Business logic + service layer
     └── PR 3: API endpoints + tests

  2. Split by feature (using Feature Flags)
     ├── PR 1: User registration API
     ├── PR 2: Email verification feature
     └── PR 3: Admin UI

  3. Separate refactoring from feature addition
     ├── PR 1: Refactor existing code (no functional change)
     └── PR 2: Add new feature

  Principle: make each PR a unit that can be merged independently
```

### 2.4 Response Time SLA

```python
# Efficient time allocation for reviews
review_time_guide = {
    "small_pr":   {"lines": "< 100",   "time": "Within 15 min"},
    "medium_pr":  {"lines": "100-300",  "time": "Within 30 min"},
    "large_pr":   {"lines": "300-500",  "time": "Within 60 min"},
    "too_large":  {"lines": "> 500",    "time": "Request split"},
}

# Response time SLA
response_sla = {
    "initial_review":  "Within 24 hours",   # First review
    "re_review":       "Within 8 hours",    # Re-review after fixes
    "urgent_hotfix":   "Within 2 hours",    # Emergency fix
    "documentation":   "Within 48 hours",   # Documentation-only changes
}

# Environment setup to improve review efficiency
review_setup = {
    "Notification settings": "Set up PR notifications in Slack/Teams",
    "Time blocking": "Reserve 30 minutes daily for reviews",
    "Batching": "Review 2-3 small PRs together",
    "Minimize context switching": "Review at a natural stopping point, not during deep work",
}
```

---

## 3. Comment Classification and Writing Style

### 3.1 Comment Prefixes

```
[MUST]     Fix is required (merge blocker)
[SHOULD]   Please fix if possible
[NIT]      Minor comment (fix is optional)
[QUESTION] Question / item to confirm
[PRAISE]   Praise for good code
[FYI]      Sharing reference information
[DISCUSS]  Design decision that requires discussion

Usage examples:
  [MUST] There is a SQL injection vulnerability.
         Please use parameter binding.

  [SHOULD] This function is 40 lines. Extracting the validation part
           into a separate method would improve readability.

  [NIT] Variable name `d` -> `delivery_date` makes the intent clearer.

  [PRAISE] The coverage of boundary values in these test cases is excellent.

  [QUESTION] Could you explain the reasoning behind this timeout value (30s)?
             Is it based on the external API's SLA?

  [FYI] There is similar logic in utils/date.ts, so it might be possible to consolidate.

  [DISCUSS] This design seems like it could make future extensions difficult.
            Would you consider introducing the Strategy pattern?
```

### 3.2 How to Write Suggestion-Based Comments

```python
# BAD: Comments that only negate
# "This code is hard to read."
# "Why did you write it this way?"

# GOOD: Identify the problem + reason + concrete improvement suggestion

# ===== Pattern 1: Present as Before/After =====

# [SHOULD] The nesting is getting deep.
# Changing to an early-return pattern will improve readability:
#
# Before:
def process(order):
    if order:
        if order.is_valid():
            if order.items:
                # processing...
                pass

# Suggested:
def process(order):
    if not order:
        return
    if not order.is_valid():
        raise ValueError("Invalid order")
    if not order.items:
        raise ValueError("Empty items")
    # processing...

# ===== Pattern 2: Suggest with reasoning =====

# [SHOULD] There is a DB access happening inside this loop,
# creating an N+1 problem.
# If there are 100 items, 100 queries will be issued.
#
# Suggestion: switch to a batch query
# Before:
for item in items:
    product = db.get_product(item.product_id)  # N queries

# Suggested:
product_ids = [item.product_id for item in items]
products = db.get_products_by_ids(product_ids)  # 1 query
product_map = {p.id: p for p in products}

# ===== Pattern 3: Present tradeoffs to prompt discussion =====

# [DISCUSS] We need to consider whether to introduce caching here.
# Pros: Response time approximately 10x faster (reduced DB round-trips)
# Cons: Increased complexity of cache invalidation
# Given the current traffic volume, it may not be necessary yet.
# What do you think?
```

### 3.3 Using GitHub Suggestion Feature

```python
# Propose fixes directly using GitHub's Suggestion syntax

# Write the following in a review comment:
#
# [NIT] Constant names should use UPPER_SNAKE_CASE.
#
# ```suggestion
# MAX_RETRY_COUNT = 3
# TIMEOUT_SECONDS = 30
# ```
#
# -> The author can apply it with one click

# Multi-line suggestions are also possible:
#
# [SHOULD] Let's add type hints.
#
# ```suggestion
# def calculate_total(
#     items: list[OrderItem],
#     tax_rate: float = 0.10,
# ) -> int:
# ```

# Batch suggestions: multiple suggestions can be applied together
# -> Small fixes can be grouped into a single commit
```

### 3.4 Practicing a Culture of Praise

```
Good reviews include not just "criticisms" but also "praise."

  Points worth praising:
  ├── Readable naming
  ├── Clever test case design
  ├── Appropriate handling of edge cases
  ├── Improvement of existing code (Boy Scout Rule)
  ├── Good documentation
  └── Consideration for performance

  Examples of praise:
  [PRAISE] This error handling pattern is very instructive.
           I'd like to apply it to other areas as well.

  [PRAISE] The boundary value tests are comprehensive.
           Especially good that both the zero-item case and the upper limit are covered.

  [PRAISE] The way this function is split is precise.
           Each function has a single responsibility and is easy to test.

  Research finding: reviews that include praise have a 23% higher fix adoption rate
  compared to reviews with only criticisms (Google Engineering Practices)
```

---

## 4. Combining with Automation

### 4.1 Integration with CI/CD Pipeline

```
Division of Review Responsibilities

  What automation (CI) handles:
  ├── Code style (Ruff, ESLint, Prettier)
  ├── Type checking (MyPy, TypeScript)
  ├── Test execution
  ├── Coverage measurement
  ├── Security scanning (Bandit, Snyk, Trivy)
  ├── Dependency vulnerability checks
  ├── License compatibility checks
  └── Code complexity checks (cyclomatic complexity)

  What humans handle:
  ├── Correctness of business logic
  ├── Validity of design and architecture
  ├── Readability and appropriateness of naming
  ├── Sufficiency of test cases (semantic coverage, not just line coverage)
  ├── Context-dependent judgment
  └── Assessment of future extensibility and maintainability

  ★ Automate what can be automated; let humans focus on higher-order judgment
```

### 4.2 Practical CI Configuration Example

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint Check
        run: |
          ruff check .        # Python
          ruff format --check . # Format check

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Type Check
        run: mypy src/ --strict

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Tests
        run: pytest --cov=src --cov-report=xml --cov-fail-under=80

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Security Scan
        run: |
          bandit -r src/       # Python security
          pip-audit            # Dependency vulnerabilities

  pr-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Check PR Size
        run: |
          CHANGED_LINES=$(git diff --stat origin/main...HEAD | tail -1 | awk '{print $4}')
          if [ "$CHANGED_LINES" -gt 400 ]; then
            echo "::warning::PR exceeds 400 lines. Consider splitting it."
          fi
```

### 4.3 CODEOWNERS Design

```
# .github/CODEOWNERS

# Default reviewers
* @team-leads

# Frontend
/frontend/             @frontend-team
/frontend/src/auth/    @security-team @frontend-team

# Backend
/backend/              @backend-team
/backend/src/billing/  @billing-team @backend-team

# Infrastructure
/infrastructure/       @sre-team
/docker/              @sre-team
/.github/             @devops-team

# DB migrations (must always be reviewed by DBA)
/backend/migrations/   @dba-team

# Security-related (security team approval required)
**/auth/**            @security-team
**/crypto/**          @security-team
```

```
Best practices for CODEOWNERS design:

  ├── Don't configure too granularly (creates bottlenecks in review wait time)
  ├── Assign at team level (individual assignments cause delays during vacations)
  ├── Security and DB migrations require a dedicated expert team
  ├── Review periodically (keep up with team structure changes)
  └── Also use optional reviewers (for knowledge-sharing reviews)
```

---

## 5. Review Metrics and Improvement

### 5.1 Metrics to Track

```
Review Process Health Indicators:

  Velocity Metrics:
  ├── Time to First Review: from PR creation to review start
  │   Target: < 24 hours, Ideal: < 4 hours
  ├── Review Cycle Time: from PR creation to merge
  │   Target: < 48 hours
  └── Re-review Time: time to re-review after fix
      Target: < 8 hours

  Quality Metrics:
  ├── Defect Escape Rate: percentage of bugs that passed review
  │   Target: < 5%
  ├── Review Coverage: percentage of PRs that received a review
  │   Target: 100% (excluding hotfixes)
  └── Comments per PR: number of comments per PR
      Guideline: 2-5 (0 is rubber-stamping, 10+ means PR is too large)

  Team Metrics:
  ├── Review Load Balance: workload distribution across reviewers
  ├── Knowledge Distribution: bias in CODEOWNERS
  └── PR Size Distribution: distribution of PR sizes
```

### 5.2 Visualizing Metrics

```python
# Collecting review metrics using the GitHub API

import requests
from datetime import datetime, timedelta
from collections import defaultdict

def collect_review_metrics(repo: str, token: str, days: int = 30):
    """Collect review metrics for the past N days"""
    headers = {"Authorization": f"Bearer {token}"}
    since = (datetime.now() - timedelta(days=days)).isoformat()

    # Fetch PRs
    prs = requests.get(
        f"https://api.github.com/repos/{repo}/pulls",
        headers=headers,
        params={"state": "closed", "since": since, "per_page": 100},
    ).json()

    metrics = {
        "total_prs": len(prs),
        "avg_time_to_first_review": [],
        "avg_cycle_time": [],
        "avg_comments_per_pr": [],
        "pr_sizes": [],
        "reviewer_load": defaultdict(int),
    }

    for pr in prs:
        # PR creation timestamp
        created_at = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
        merged_at = pr.get("merged_at")

        if merged_at:
            merged_at = datetime.fromisoformat(merged_at.replace("Z", "+00:00"))
            cycle_time = (merged_at - created_at).total_seconds() / 3600
            metrics["avg_cycle_time"].append(cycle_time)

        # Fetch reviews
        reviews = requests.get(
            pr["url"] + "/reviews",
            headers=headers,
        ).json()

        if reviews:
            first_review = datetime.fromisoformat(
                reviews[0]["submitted_at"].replace("Z", "+00:00")
            )
            time_to_first = (first_review - created_at).total_seconds() / 3600
            metrics["avg_time_to_first_review"].append(time_to_first)

            for review in reviews:
                reviewer = review["user"]["login"]
                metrics["reviewer_load"][reviewer] += 1

        # Comment count
        comments = requests.get(pr["url"] + "/comments", headers=headers).json()
        metrics["avg_comments_per_pr"].append(len(comments))

        # PR size
        metrics["pr_sizes"].append(pr.get("additions", 0) + pr.get("deletions", 0))

    # Aggregate
    return {
        "total_prs": metrics["total_prs"],
        "avg_time_to_first_review_hours": (
            sum(metrics["avg_time_to_first_review"])
            / len(metrics["avg_time_to_first_review"])
            if metrics["avg_time_to_first_review"] else 0
        ),
        "avg_cycle_time_hours": (
            sum(metrics["avg_cycle_time"])
            / len(metrics["avg_cycle_time"])
            if metrics["avg_cycle_time"] else 0
        ),
        "avg_comments_per_pr": (
            sum(metrics["avg_comments_per_pr"])
            / len(metrics["avg_comments_per_pr"])
            if metrics["avg_comments_per_pr"] else 0
        ),
        "median_pr_size": sorted(metrics["pr_sizes"])[len(metrics["pr_sizes"]) // 2]
            if metrics["pr_sizes"] else 0,
        "reviewer_load": dict(metrics["reviewer_load"]),
    }
```

---

## 6. Special Review Targets

### 6.1 Reviewing DB Migrations

```
DB Migration Dedicated Checklist:

  Safety:
  ├── [x] Is it rollback-able? (down migration)
  ├── [x] Is the lock duration acceptable for large tables?
  ├── [x] Does adding a NOT NULL constraint have a default value?
  ├── [x] Is index addition done with CONCURRENTLY? (PostgreSQL)
  └── [x] Is the batch size for data migration appropriate?

  Compatibility:
  ├── [x] Is it compatible with older versions of the code? (rolling deploy)
  ├── [x] Is column deletion done in 2 phases? (stop reads first -> delete next release)
  └── [x] Does adding a foreign key constraint avoid application downtime?

  Testing:
  ├── [x] Has it been run in a staging environment?
  ├── [x] Has it been tested with equivalent production data volume?
  └── [x] Has execution time been measured?
```

### 6.2 Reviewing Security-Critical Code

```
Key Checks for Security Review:

  Authentication and Authorization:
  ├── Is the token validation logic correct?
  ├── Are there missing permission checks? (Broken Access Control)
  ├── Is session management secure?
  └── Is the password hashing algorithm appropriate? (bcrypt, Argon2)

  Data Protection:
  ├── Is masking of PII (personally identifiable information) appropriate?
  ├── Is sensitive information not included in logs?
  ├── Is there support for encryption key rotation?
  └── Does it follow the principle of least privilege for data?

  Input Validation:
  ├── Is there validation for all external inputs?
  ├── Protection against file path traversal attacks?
  ├── XML External Entity (XXE) protection?
  └── Server-Side Request Forgery (SSRF) protection?
```

### 6.3 Reviewing Performance-Critical Code

```
Key Checks for Performance Review:

  Database:
  ├── Was the query plan confirmed with EXPLAIN ANALYZE?
  ├── Is there a full table scan?
  ├── Are there unnecessary JOINs?
  └── Is the chunk size for batch processing appropriate?

  Memory:
  ├── Is large data being loaded all at once?
  ├── Are areas that could use stream processing being batch-processed?
  ├── Are there memory leaks from closures?
  └── Are event listeners being removed properly?

  Network:
  ├── Are there unnecessary API calls?
  ├── Is gzip compression for responses enabled?
  ├── Are there static resources that should use a CDN?
  └── Is the choice of WebSocket vs. polling appropriate?
```

---

## 7. Comparison of Review Methods

| Review Method | Target | Cost | Defect Detection Rate | Knowledge Sharing Effect |
|------------|------|-------|:--------:|:----------:|
| PR Review (async) | Code diff | Low | Medium | Medium |
| Pair Programming | Real-time | High | High | High |
| Mob Programming | Whole team | Highest | Highest | Highest |
| Automated Review (CI) | Static analysis | Lowest | Low (pattern-limited) | None |
| Architecture Review | Design documents | Medium | High (design level) | High |

| Perspective | Automatable | Requires Human |
|------|:--------:|:--------:|
| Code style | Fully automatable | -- |
| Type safety | Fully automatable | -- |
| Test passing | Fully automatable | -- |
| Business logic | -- | Required |
| Design judgment | -- | Required |
| Naming appropriateness | Partially automatable | Required |
| Test sufficiency | Partially automatable | Required |
| Security | Partially automatable | Required |

```
Choosing review methods by situation:

  Code complexity
    |
    ├── Low (bug fixes, small feature additions)
    |   -> Async PR review (1 reviewer)
    |
    ├── Medium (medium-sized feature, adding an API)
    |   -> Async PR review (2 reviewers) + CI automated checks
    |
    ├── High (architecture changes, new service)
    |   -> Architecture review + pair programming + PR review
    |
    └── Highest (security, financial logic)
        -> Review by specialist team + mob programming
```

---

## 8. Anti-Patterns

### 8.1 Anti-Pattern: Reviews That Become Personal Attacks

```
BAD:
  "Why do you write it like this? The normal way is like this."
  "This code is amateur-level."
  "I told you before, why didn't you fix it?"
  -> Collapse of psychological safety, deterioration of review culture

GOOD:
  "[SHOULD] For this part, using an early-return pattern
   would reduce nesting and improve readability. How about the following?"
  "[PRAISE] This error handling design is very instructive."
  "[FYI] This naming pattern is a best practice also in our team's
   coding guidelines: [link]"
  -> Feedback on the code, respect for the person
```

**Root Cause**: The purpose of review has shifted from "finding problems" to "criticism." Reviewers need the mindset of "collaborating to make the code better."

**Countermeasures**: (1) The team creates review guidelines together. (2) Make comment prefixes mandatory. (3) Conduct review training. (4) Re-examine feedback methods in 1:1s.

### 8.2 Anti-Pattern: LGTM Rubber-Stamping

```
BAD:
  "LGTM" (review completed in 1 minute for a 400-line PR)
  -> The review is meaningless and provides no quality assurance

GOOD:
  - Leave at least one specific comment
  - Also point out good things ([PRAISE])
  - If the PR is too large, request that it be split
  - Ask [QUESTION] about anything not understood
  - Write a summary of the changes in your own words (confirmation of understanding)
```

**Root Cause**: Time for reviews is not allocated; the value of reviews is not recognized within the organization.

**Countermeasures**: (1) Officially allocate review time as part of work hours. (2) Visualize review metrics. (3) Set a minimum standard for reviews as a condition for CODEOWNERS approval.

### 8.3 Anti-Pattern: Gatekeeper-Style Review

```
BAD:
  Review structure where a specific individual becomes a bottleneck
  ├── A single senior engineer reviews all PRs
  ├── 3-5 day wait for approval
  └── Team autonomy does not grow

GOOD:
  Distributed review structure
  ├── Reviewers rotate within the team
  ├── CODEOWNERS is configured at the "team" level
  ├── Junior members also actively participate in reviews (learning opportunity)
  └── Review guidelines are written down to prevent knowledge concentration
```

**Root Cause**: The assumption that "only seniors can review."

**Countermeasures**: (1) Senior engineers do "review of reviews" on junior reviews for mentoring. (2) Domain knowledge is shared through pair reviews. (3) Relax approval conditions to "1 of 2 reviewers is a senior."

### 8.4 Anti-Pattern: Style Debates (Bike-shedding)

```
BAD:
  80% of PR comments are debates like:
  ├── Tabs vs. spaces
  ├── Presence or absence of semicolons
  ├── Bracket placement
  └── Import order

  -> Substantial issues (bugs, design, security) get overlooked

GOOD:
  ├── Enforce code style automatically with Linter/Formatter
  │   (Prettier, Black, Ruff, gofmt)
  ├── Document the style guide (debate it only the first time)
  ├── CI automatically checks formatting
  └── Humans focus on logic, design, and security
```

**Root Cause**: Humans are checking things that can be automated.

**Countermeasures**: Integrate `.editorconfig`, `prettier`, `ruff`, etc. into CI to automatically detect and fix formatting violations.

---

## 9. Practice Problems

### Exercise 1 (Basic): Code Review Practice

**Task**: Review the following Python code and create 5 or more comments with appropriate prefixes.

```python
# Code to review
import json
import os

def get_users(db, role, page):
    query = f"SELECT * FROM users WHERE role = '{role}' ORDER BY id LIMIT 20 OFFSET {page * 20}"
    users = db.execute(query)
    result = []
    for u in users:
        if u.active == True:
            data = {}
            data['id'] = u.id
            data['name'] = u.first_name + ' ' + u.last_name
            data['email'] = u.email
            data['role'] = u.role
            data['created'] = str(u.created_at)
            data['password_hash'] = u.password_hash  # Frontend needs this
            result.append(data)
    return json.dumps(result)
```

**Expected Output**:

```
5 or more review comments (with prefixes)
```

**Model Answer**:

```
[MUST] There is a SQL injection vulnerability.
  The role parameter is embedded directly in the query without escaping.
  Please use parameter binding:
  query = "SELECT * FROM users WHERE role = %s ORDER BY id LIMIT %s OFFSET %s"
  db.execute(query, (role, 20, page * 20))

[MUST] password_hash is included in the response.
  This is a serious security issue.
  There is no reason to return the password hash to the frontend.
  Convert to a DTO that contains only the necessary fields.

[SHOULD] The function returns a JSON string.
  Normally, functions should return data structures (list[dict]),
  and serialization should be left to the caller (API layer).
  This makes testing easier and improves reusability.

[SHOULD] `u.active == True` can be written as `u.active`.
  Also, it is more efficient to do the filtering on the SQL side:
  WHERE role = %s AND active = TRUE

[SHOULD] The pagination constant 20 is hardcoded.
  Extract as a constant PER_PAGE = 20, or make it a parameter.

[NIT] Variable name `u` is more readable as `user`.
  for user in users:

[NIT] Using str() for datetime formatting produces an implementation-dependent format.
  Use ISO 8601 format:
  data['created_at'] = u.created_at.isoformat()

[QUESTION] Regarding pagination for this endpoint,
  is offset-based pagination acceptable?
  If there are many users, cursor-based pagination is more efficient.
```

---

### Exercise 2 (Applied): Designing a Review Process

**Task**: Design a review process for the following team composition.

```
Team composition:
  - 1 tech lead
  - 2 senior engineers
  - 3 mid-level engineers
  - 2 junior engineers

Issues:
  - The tech lead is becoming a bottleneck (reviewing all PRs)
  - Average review wait time is 48 hours
  - Juniors are not participating in reviews
  - Too many discussions about code style
```

**Expected Output**:

```
1. Review rules (CODEOWNERS, approval conditions)
2. Automation proposals (CI configuration)
3. Review culture improvements
4. Metrics targets
```

**Model Answer**:

```
1. Review rules:

  CODEOWNERS:
    /src/           @backend-team  (whole team)
    /src/billing/   @senior-team   (senior or above required)
    /infrastructure/ @tech-lead    (tech lead required)
    /migrations/    @tech-lead @senior-team

  Approval conditions:
    Normal PR:  2 approvals (at least 1 from senior or above)
    Security-related: tech lead + senior
    Documentation only: 1 approval
    Hotfix: 1 approval from tech lead or senior

  Junior participation:
    Juniors are added as "optional reviewers" on all PRs
    No approval rights, but comments and questions are encouraged
    Senior provides feedback on junior review comments weekly

2. Automation:
    Introduce Prettier / Ruff in CI -> eliminate style debates
    PR size check (warning for over 400 lines)
    Warning for coverage below 80%
    Automated security scanning

3. Review culture:
    Everyone reserves 30 minutes daily for reviews
    Weekly "Good Review" sharing session (5 minutes)
    Written review guidelines
    Encourage [PRAISE] comments

4. Metrics targets:
    Time to First Review: < 8 hours (currently 48 hours)
    Review Cycle Time: < 24 hours
    Reviewer load balance: within 20% deviation
    Junior review comments: 3+ per week
```

---

### Exercise 3 (Advanced): AI Code Review Tool Adoption Strategy

**Task**: Design a strategy for introducing AI code review tools (GitHub Copilot, Coderabbit, etc.) to the team.

```
Conditions:
  - Team of 10 people
  - 200 PRs per month
  - Want to reduce review wait time by 50%
  - Want to minimize false positives from AI
```

**Expected Output**:

```
1. Areas AI tools should handle
2. Areas humans should continue to handle
3. Phased rollout plan
4. Quality verification methods
```

**Model Answer**:

```
1. Areas AI tools handle:
   ├── Code style and formatting suggestions
   ├── Detection of common bug patterns
   ├── Detection of unused variables and unhandled exceptions
   ├── Basic security pattern checks
   ├── Documentation and comment suggestions
   └── Test coverage suggestions

2. Areas humans handle:
   ├── Correctness of business logic (AI doesn't know the requirements)
   ├── Validity of architecture and design
   ├── Domain-specific conventions and rules
   ├── Judgments based on actual performance measurements
   ├── Final approval of AI suggestions
   └── Mentoring and developing team members

3. Rollout phases:
   Phase 1 (Month 1): Introduce AI in comment-only mode
     -> Measure AI suggestion accuracy (precision and recall)
   Phase 2 (Month 2): Auto-approve only high-accuracy items
     -> Clear issues like style and unused code
   Phase 3 (Month 3): Establish hybrid flow of AI + human
     -> AI does first review -> Humans review logic and design

4. Quality verification:
   ├── Track AI suggestions with human review for 1 month
   ├── Measure false positive rate (target: < 10%)
   ├── Compare bug counts before and after AI introduction
   ├── Measure changes in review wait time
   └── Team satisfaction survey
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check path and format of configuration file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check executing user permissions, review configuration |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify the location
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Validate incrementally**: Use log output or a debugger to validate hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debug utility
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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
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

Steps to diagnose when a performance issue occurs:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize When | Can Compromise When |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed users |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                       │
│    ├─ Small (1-5 people) -> Monolith             │
│    └─ Large (10+ people) -> Go to 2              │
│                                                 │
│  2. What is the deployment frequency?            │
│    ├─ Weekly or less -> Monolith + module split  │
│    └─ Daily / multiple times -> Go to 3          │
│                                                 │
│  3. How independent are teams from each other?   │
│    ├─ High -> Microservices                      │
│    └─ Moderate -> Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Tradeoff Analysis

Technical decisions always involve tradeoffs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay a project

**2. Consistency vs. Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging harder
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and issue"""
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
- Focus on minimum viable features
- Automated tests for critical paths only
- Introduce monitoring from early on

**Lessons Learned:**
- Don't demand perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually renewing a system that has been running for 10+ years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If no existing tests, first create Characterization Tests
- Coexist old and new systems with an API gateway
- Perform data migration incrementally

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries using Domain-Driven Design
- Set ownership per team
- Manage shared libraries with Inner Source model
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
        """Check SLA compliance"""
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

**Situation:** Systems requiring millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging async processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Usage in Team Development

### Code Review Checklist

Points to check during code review related to this topic:

- [ ] Is naming consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there a performance impact?
- [ ] Are there security issues?
- [ ] Is documentation updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Whole team | Horizontal knowledge sharing |
| ADR (design records) | As needed | Future members | Decision transparency |
| Retrospective | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Important design | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          |
    ┌─────┼─────┐
    │ Plan│Act  │
    │ to  │imm- │
    │ addr│edi- │
    │ ess │ately│
    ├─────┼─────┤
    │ Just│ Next│
    │ doc-│ Spr-│
    │ ument│int  │
    └─────┼─────┘
          |
        Low Impact
    Low Frequency  High Frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------|------------|------|---------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Broken authentication | High | Multi-factor auth, strengthened session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, least privilege principle | Configuration scan |
| Insufficient logging | Medium | Structured logs, audit trail | Log analysis |

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
- [ ] CORS policy is properly configured
- [ ] Vulnerability scan of dependency packages has been performed
- [ ] Error messages do not contain internal information

---

## Migration Guide

### Notes on Version Upgrades

| Version | Main Changes | Migration Work | Scope |
|-----------|-----------|---------|---------|
| v1.x -> v2.x | Redesigned API | Endpoint changes | All clients |
| v2.x -> v3.x | Authentication method change | Token format update | Auth-related |
| v3.x -> v4.x | Data model change | Run migration scripts | DB-related |

### Steps for Incremental Migration

```python
# Migration script template
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Callable

logger = logging.getLogger(__name__)

class MigrationRunner:
    """Incremental migration execution engine"""

    def __init__(self, migration_dir: str):
        self.migration_dir = Path(migration_dir)
        self.migrations: List[Dict] = []
        self.completed: List[str] = []

    def register(self, version: str, description: str,
                 up: Callable, down: Callable):
        """Register a migration"""
        self.migrations.append({
            'version': version,
            'description': description,
            'up': up,
            'down': down,
            'registered_at': datetime.now().isoformat()
        })

    def run_up(self, target_version: str = None):
        """Run migrations (upgrade)"""
        for migration in self.migrations:
            if migration['version'] in self.completed:
                continue
            logger.info(f"Running: {migration['version']} - "
                       f"{migration['description']}")
            try:
                migration['up']()
                self.completed.append(migration['version'])
                logger.info(f"Completed: {migration['version']}")
            except Exception as e:
                logger.error(f"Failed: {migration['version']}: {e}")
                raise
            if target_version and migration['version'] == target_version:
                break

    def run_down(self, target_version: str):
        """Roll back migrations"""
        for migration in reversed(self.migrations):
            if migration['version'] not in self.completed:
                continue
            if migration['version'] == target_version:
                break
            logger.info(f"Rolling back: {migration['version']}")
            migration['down']()
            self.completed.remove(migration['version'])

    def status(self) -> Dict:
        """Check migration status"""
        return {
            'total': len(self.migrations),
            'completed': len(self.completed),
            'pending': len(self.migrations) - len(self.completed),
            'versions': {
                m['version']: 'completed'
                if m['version'] in self.completed else 'pending'
                for m in self.migrations
            }
        }
```

### Rollback Plan

Always prepare a rollback plan for migration work:

1. **Back up data**: Take a full backup before migration
2. **Validate in test environment**: Pre-validate in an environment equivalent to production
3. **Staged rollout**: Deploy incrementally with a canary release
4. **Strengthen monitoring**: Shorten metric monitoring intervals during migration
5. **Clarify decision criteria**: Define criteria for deciding to roll back in advance
---

## 10. FAQ

### Q1. How many reviewers is appropriate?

**A.** 1-2 is optimal. With 3 or more, the "someone else will take care of it" effect occurs (social loafing / Diffusion of Responsibility). 2 reviewers for important changes or changes related to architecture, 1 is sufficient for routine changes. Use the CODEOWNERS file to set up automatic assignment so the right reviewers with domain knowledge are selected.

### Q2. What if opinions clash during a review?

**A.** Decide on escalation rules in advance:

1. Discuss based on **objective evidence** (performance benchmarks, official documentation)
2. If **more than 3 comments go back and forth, go offline** (video call) to talk directly
3. **Document in the team's coding guidelines** to set a future standard
4. If no agreement is reached, **the tech lead makes the final decision**
5. **Personal preference issues** are not debated; defer to team guidelines (tabs vs. spaces, etc.)

### Q3. What are the key points for self-review?

**A.** After creating a PR, check the diff yourself before requesting a review. Checkpoints: (1) Is debug code (print, console.log) left in? (2) Do commit messages accurately reflect the changes? (3) Are unnecessary changes (formatting-only diffs) mixed in? (4) Have tests been added? Self-review can pre-emptively remove 30% of review items.

### Q4. When time is short for a review, what should be prioritized?

**A.** Priority order when time is limited:

1. **Security**: Authentication/authorization, input validation, sensitive data exposure
2. **Correctness**: Business logic bugs, edge cases
3. **Tests**: Test coverage for new features and bug fixes
4. **Maintainability**: Design and architecture issues
5. **Readability**: Naming, comments, code style

When time is short, leave 5 to CI and focus on 1-3.

### Q5. How should junior members participate in reviews?

**A.** Junior participation in reviews has a very high learning effect. Recommended steps:

1. **Observe**: First, read senior review comments to learn
2. **Ask questions**: Use the `[QUESTION]` prefix to ask about things that are unclear (don't be shy)
3. **Simple observations**: Start with `[NIT]` for naming, comments, and formatting
4. **Check tests**: Check the coverage of test cases
5. **Gradually move to logic**: Verify the correctness of logic within your area of understanding

When seniors provide feedback like "good point" or "here's a better way to look at it" on junior review comments, review skills improve.

### Q6. When is the right time to "Approve" in a review?

**A.** When all 3 of the following conditions are met:

1. **All MUSTs are resolved**: All merge-blocking comments have been addressed
2. **Agreement on SHOULDs**: There is agreement with the author on whether to fix now or defer
3. **Understanding**: You understand the changes and can explain them

"It doesn't have to be perfect" is the principle. Even if there is room for improvement, Approve if the code is better than it was. Demanding perfection delays merges and reduces overall team productivity.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Item | Key Point |
|------|---------|
| 5-axis check | Correctness, readability, maintainability, security, performance |
| PR size | Under 200 lines is optimal. Splitting is required over 400 lines |
| Response time | First review within 24 hours, re-review within 8 hours |
| Comment classification | Clarify with MUST / SHOULD / NIT / QUESTION / PRAISE / DISCUSS |
| Suggestion-based feedback | Present concrete improvements, not just negations. Show Before/After |
| Division with automation | Style, types, tests -> CI; logic, design -> humans |
| CODEOWNERS | Configure at team level, prevent bottlenecks |
| Psychological safety | Feedback on code, respect for people. Include praise |
| Metrics | Time to First Review, Cycle Time, Defect Escape Rate |
| Self-review | Remove 30% of issues yourself before requesting review |

```
Review Culture Maturity Model:

  Level 0: No review (individual work)
      |
  Level 1: Formal review (LGTM rubber-stamping)
      |
  Level 2: Checklist-based review
      |
  Level 3: Constructive feedback + automation
      |
  Level 4: Metrics-driven continuous improvement
      |
  Level 5: Review as a knowledge-sharing culture
```

---

## What to Read Next

- [03-api-design.md](./03-api-design.md) — API Design (design principles for APIs that are subject to review)
- [../01-practices/04-testing-principles.md](../01-practices/04-testing-principles.md) — Testing Principles (review perspectives for test code)
- [../02-refactoring/03-technical-debt.md](../02-refactoring/03-technical-debt.md) — Technical Debt (preventing debt accumulation through review)
- ../00-principles/00-naming-conventions.md — Naming Conventions (criteria for readability reviews)
- ../00-principles/04-solid-principles.md — SOLID Principles (criteria for design reviews)
- [00-immutability.md](./00-immutability.md) — Immutability (evaluation criteria for code quality)
- ../../design-patterns-guide/docs/04-architectural/ — Architectural Patterns (reference for design reviews)

---

## References

1. **Software Engineering at Google** — Titus Winters et al. (O'Reilly, 2020) — Google's code review practices
2. **The Art of Readable Code** — Dustin Boswell & Trevor Foucher (O'Reilly, 2011) — Principles of readability
3. **Google Engineering Practices: Code Review** — https://google.github.io/eng-practices/review/ — Google's review guidelines
4. **SmartBear: Best Practices for Code Review** — https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/ — Quantitative research on reviews
5. **Microsoft Research: Code Review Best Practices** — https://www.microsoft.com/en-us/research/publication/code-reviewing-in-the-trenches/ — Microsoft's review research
6. **Conventional Comments** — https://conventionalcomments.org/ — Standard for comment prefixes
7. **GitHub Pull Request Best Practices** — https://docs.github.com/en/pull-requests — Official guide to PRs
8. **OWASP Secure Code Review Guide** — https://owasp.org/www-project-code-review-guide/ — Guide to security reviews
9. **Accelerate** — Nicole Forsgren et al. (IT Revolution, 2018) — DevOps metrics and their relationship to reviews
10. **Amy Edmondson, "The Fearless Organization"** (Wiley, 2018) — Psychological safety and team performance
