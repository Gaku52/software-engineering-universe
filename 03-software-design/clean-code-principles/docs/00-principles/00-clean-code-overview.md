# Clean Code Overview ── Why Code Quality Matters

> More than 80% of the total cost of software is spent on maintenance. Code that is readable and easy to change dramatically improves the productivity of the entire team.

---

## What You Will Learn in This Chapter

1. **Definition of Clean Code** ── Understand "good code" from the perspectives of renowned engineers
2. **Impact of Quality on Business** ── Quantify the relationship between technical debt and development velocity
3. **Practical Principles of Clean Code** ── Acquire fundamental rules you can apply in everyday coding
4. **Quantitative Measurement of Code Quality** ── Evaluate quality using objective metrics such as complexity and coverage
5. **Building a Clean Code Culture** ── Create the systems and culture needed to maintain quality across the entire team

---

## Prerequisites

To get the most out of this guide, the following knowledge is recommended.

| Prerequisite | Description | Reference Link |
|---------|------|-----------|
| Programming fundamentals | Basic concepts of variables, functions, and classes | `../../02-programming/` |
| Object-oriented basics | Classes, inheritance, polymorphism | `../../02-programming/` |
| Git basics | Basic version control operations | `../../05-infrastructure/` |

Note: The above are not strictly required, but they will help you understand the code examples.

---

## 1. What Is Clean Code?

### 1.1 Definitions by Renowned Engineers

```
+-----------------------------------------------------------+
|  Robert C. Martin (Uncle Bob)                             |
|  "Clean code is code that is readable, understandable,    |
|    and easy to change."                                   |
+-----------------------------------------------------------+
|  Bjarne Stroustrup (Father of C++)                        |
|  "Elegant and efficient code is clean code.               |
|    Logic is clear and bugs have nowhere to hide."         |
+-----------------------------------------------------------+
|  Grady Booch (Father of UML)                              |
|  "Clean code reads like well-written prose."              |
+-----------------------------------------------------------+
|  Ward Cunningham (Inventor of Wiki)                       |
|  "Code that makes you think 'of course it should          |
|    be this way' when you read it."                        |
+-----------------------------------------------------------+
|  Michael Feathers                                         |
|  "Clean code is code written with an awareness            |
|    that someone else will maintain it."                   |
+-----------------------------------------------------------+
```

What these definitions share is **consideration for the reader of the code**. A program is an instruction to a computer, but it is also a means of communication with your teammates.

### 1.2 Why "Readability" Is Most Important ── A Deeper WHY

In software development, the ratio of time spent writing code to time spent reading it is said to be roughly 1:10 (based on research by Robert C. Martin). In other words, code is read ten times more than it is written. This fact is the fundamental reason why readability should be the top priority.

```
  Developer Time Distribution

  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  Reading code                                        │
  │  ████████████████████████████████████████  (70%)    │
  │                                                     │
  │  Modifying existing code                             │
  │  ████████████████  (20%)                            │
  │                                                     │
  │  Writing new code                                    │
  │  ██████  (10%)                                      │
  │                                                     │
  └─────────────────────────────────────────────────────┘
  * Approximate figures based on Robert C. Martin and multiple empirical studies
```

The conclusion drawn from this ratio is clear: **Spending one extra minute to write readable code saves ten minutes in the future**. Conversely, prioritizing writing speed and leaving unreadable code behind inflates future costs by tenfold.

### 1.3 Multidimensional Quality Assessment

```
          ┌─────────────────────────────────────────┐
          │     Four Quadrants of Code Quality        │
          ├──────────────┬──────────────────────────┤
          │  Readability  │  Maintainability          │
          │  ・Clear names│  ・Changes are localized  │
          │  ・Consistent │  ・Easy to test           │
          │    structure  │  ・Impact is predictable  │
          │  ・Intent is  │                           │
          │    obvious    │                           │
          ├──────────────┼──────────────────────────┤
          │  Reliability  │  Efficiency               │
          │  ・Error      │  ・Appropriate algorithms │
          │    handling   │  ・No unnecessary         │
          │  ・Edge cases │    computation            │
          │  ・Type safety│  ・Good memory efficiency │
          └──────────────┴──────────────────────────┘
```

### 1.4 The Internal Mechanism of Clean Code ── A Neuroscience Perspective

Let's also understand why clean code matters from a neuroscience perspective.

Human working memory (short-term memory) can hold approximately 7 +/- 2 chunks of information at once (Miller's Law). When reading code, each of the following elements consumes one chunk:

```
  Working Memory Consumption

  ┌────────────────────────────────────────────┐
  │  Available chunks: approximately 7          │
  │                                            │
  │  [Meaning of variable name] [Purpose of    │
  │  function] [Control flow]                  │
  │  [Type information] [Error cases]          │
  │  [Business rules] [Context of caller]      │
  │                                            │
  │  → Nearly at the limit with 7 chunks.      │
  │    Code that demands more becomes          │
  │    incomprehensible.                       │
  └────────────────────────────────────────────┘
```

Clean code minimizes the cognitive load of each chunk. Good naming conveys the meaning of a variable instantly, small functions let you grasp their purpose at a glance, and consistent structure aids pattern recognition. In other words, **clean code is code that respects the cognitive limits of human beings**.

---

## 2. Why Quality Matters ── Business Impact

### 2.1 Development Velocity Over Time

```
Development velocity
  ^
  |  ****
  |      ****
  |          ****                    ← Clean code
  |              ****  ****  ****
  |
  |  ****
  |      **
  |        *                         ← Dirty code
  |         *  *  .  .  .
  +------------------------------------> Time
   Month 1  Month 3  Month 6  Year 1  Year 2
```

### 2.2 Quantitative Analysis of Technical Debt

Technical Debt is a metaphor for the future cost that results from sacrificing quality in favor of short-term speed. The concept was coined by Ward Cunningham in 1992, and like financial debt, it accrues "interest."

```
  Technical Debt Accumulation Model

  Cost
    ^
    |                          ########
    |                     #####
    |                 ####              ← Interest (additional cost from debt)
    |             ####
    |         ####
    |     ####
    |  ###
    | #
    +-----------------------------------------> Time
    │  Principal (the debt originally incurred)
    │  Interest (slowdown and increased bugs from debt)
```

**Types of Technical Debt and Their Impact:**

| Type | Example | Interest (additional cost) |
|------|--------|-------------------|
| Deliberate and prudent | "Ship first, refactor later" | Can be repaid in a planned manner |
| Deliberate and reckless | "We don't have time to design" | Interest grows rapidly |
| Inadvertent and prudent | Realizing later "we should have done it this way" | Acceptable as a learning cost |
| Inadvertent and reckless | Not knowing clean code | Interest accumulates without awareness |

Classification based on Martin Fowler's "Technical Debt Quadrant." The most dangerous type is "inadvertent and reckless debt," where the team does not recognize the importance of code quality in the first place.

### 2.3 Quantitative Data

The following shows the effects of quality investment, based on IBM research and multiple industry reports.

```
  ROI (Return on Investment) of Quality Investment

  ┌──────────────────────────────────────────────────────┐
  │ Investment: 1 hour of code review                     │
  │ Effect: Saves 3–20 hours of downstream bug fixing    │
  │ ROI:  3x – 20x                                      │
  ├──────────────────────────────────────────────────────┤
  │ Investment: Test automation (2-week upfront cost)    │
  │ Effect: Reduced manual testing, regression prevention │
  │ ROI:  Break-even in 3 months, continuously positive  │
  │       thereafter                                     │
  ├──────────────────────────────────────────────────────┤
  │ Investment: Refactoring (repaying technical debt)    │
  │ Effect: Restored change velocity, reduced bug rate   │
  │ ROI:  Depends on the size of the debt. Larger        │
  │       debt means greater effect.                     │
  └──────────────────────────────────────────────────────┘
```

**Rising Cost of Bug Fixes by Phase:**

| Discovery Phase | Relative Cost | Example |
|------------|-----------|-----|
| Requirements | 1x | "Doesn't this spec seem off?" |
| Design | 3-6x | Found in design review |
| Coding | 10x | Found in code review |
| Testing | 15-40x | Found during test phase |
| Post-release | 30-100x | Discovered as a production incident |

Based on research by Steve McConnell (*Code Complete*) and Barry Boehm. It is clear that **building quality in early is the most cost-effective investment**.

---

## 3. Practicing Clean Code ── Code Examples

### Code Example 1: Readability Comparison ── Unreadable Code vs. Clean Code

```python
# Dirty code: It's impossible to tell what this does
def calc(l, t):
    r = []
    for i in l:
        if i['a'] > t and i['s'] == 1:
            r.append(i['n'])
    return r

# Clean code: Intent is clear
ACTIVE = 1

def find_active_users_above_threshold(
    users: list[dict],
    age_threshold: int
) -> list[str]:
    """Returns names of active users above the specified age.

    Args:
        users: A list of user dictionaries. Each dictionary has 'age', 'status', and 'name' keys.
        age_threshold: The minimum age (users strictly older than this value are included).

    Returns:
        A list of user names matching the criteria.

    Examples:
        >>> users = [
        ...     {'name': 'Alice', 'age': 25, 'status': 1},
        ...     {'name': 'Bob', 'age': 17, 'status': 1},
        ...     {'name': 'Charlie', 'age': 30, 'status': 0},
        ... ]
        >>> find_active_users_above_threshold(users, 20)
        ['Alice']
    """
    active_senior_users = []
    for user in users:
        if user['age'] > age_threshold and user['status'] == ACTIVE:
            active_senior_users.append(user['name'])
    return active_senior_users
```

Key improvements:
- The function name accurately describes what it does
- Argument names are meaningful
- Type hints clarify expected types
- The docstring includes usage examples
- The magic number (1) is replaced with a named constant

### Code Example 2: Structured Error Handling

```python
# Dirty code: Errors are swallowed
def get_user(id):
    try:
        return db.query(id)
    except:
        return None  # All errors are silently discarded → impossible to debug

# Clean code: The meaning of errors is clear
class UserNotFoundError(Exception):
    """Error raised when a user is not found"""
    def __init__(self, user_id: int):
        self.user_id = user_id
        super().__init__(f"User ID {user_id} does not exist")

class DatabaseConnectionError(Exception):
    """Error raised when a database connection fails"""
    pass

def get_user_by_id(user_id: int) -> "User":
    """Retrieves a user by their user ID.

    Args:
        user_id: The ID of the user to retrieve.

    Returns:
        The corresponding User object.

    Raises:
        UserNotFoundError: If the user is not found.
        DatabaseConnectionError: If the DB connection fails.
    """
    try:
        user = user_repository.find_by_id(user_id)
    except ConnectionError as e:
        raise DatabaseConnectionError(f"DB connection failed: {e}") from e

    if user is None:
        raise UserNotFoundError(user_id)

    return user
```

Key improvements:
- Catches specific exception types instead of bare `except:`
- Custom exception classes express domain-specific errors
- `from e` preserves the original exception (exception chaining)
- The docstring includes a Raises section

### Code Example 3: Single-Responsibility Functions

```javascript
// Dirty code: One function handling multiple responsibilities
function processOrder(order) {
  // Validation (responsibility 1)
  if (!order.items || order.items.length === 0) return false;
  if (!order.customer) return false;

  // Total calculation (responsibility 2)
  let total = 0;
  for (const item of order.items) {
    total += item.price * item.quantity;
    if (item.discount) total -= item.discount;
  }

  // DB save (responsibility 3)
  db.save({ ...order, total, status: 'confirmed' });

  // Email sending (responsibility 4)
  sendEmail(order.customer.email, `Order confirmed: $${total}`);

  return true;
}

// Clean code: Each responsibility separated
function processOrder(order) {
  validateOrder(order);
  const total = calculateOrderTotal(order.items);
  const confirmedOrder = confirmOrder(order, total);
  notifyCustomer(confirmedOrder);
  return confirmedOrder;
}

function validateOrder(order) {
  if (!order.items || order.items.length === 0) {
    throw new InvalidOrderError('An order must contain at least one item');
  }
  if (!order.customer) {
    throw new InvalidOrderError('Customer information is required');
  }
}

function calculateOrderTotal(items) {
  return items.reduce((total, item) => {
    const itemTotal = item.price * item.quantity;
    const discount = item.discount || 0;
    return total + itemTotal - discount;
  }, 0);
}

function confirmOrder(order, total) {
  const confirmedOrder = { ...order, total, status: 'confirmed' };
  orderRepository.save(confirmedOrder);
  return confirmedOrder;
}

function notifyCustomer(order) {
  emailService.send(
    order.customer.email,
    `Order confirmed: $${order.total}`
  );
}
```

### Code Example 4: Eliminating Magic Numbers

```java
// Dirty code: Full of magic numbers
if (user.getAge() >= 18 && user.getScore() > 70 && user.getType() == 3) {
    applyDiscount(0.15);
}

// Clean code: Constants give meaning
private static final int LEGAL_AGE = 18;
private static final int PREMIUM_SCORE_THRESHOLD = 70;
private static final int GOLD_MEMBER_TYPE = 3;
private static final double GOLD_MEMBER_DISCOUNT_RATE = 0.15;

if (user.isAdult(LEGAL_AGE)
    && user.hasPremiumScore(PREMIUM_SCORE_THRESHOLD)
    && user.isGoldMember()) {
    applyDiscount(GOLD_MEMBER_DISCOUNT_RATE);
}

// Further improvement: Extract business logic into a method
if (user.isEligibleForGoldDiscount()) {
    applyDiscount(GOLD_MEMBER_DISCOUNT_RATE);
}
```

### Code Example 5: Guard Clauses for Early Return

```typescript
// Dirty code: Deeply nested
function getPayAmount(employee: Employee): number {
  let result: number;
  if (employee.isSeparated) {
    result = separatedAmount(employee);
  } else {
    if (employee.isRetired) {
      result = retiredAmount(employee);
    } else {
      if (employee.isOnLeave) {
        result = leaveAmount(employee);
      } else {
        result = normalPayAmount(employee);
      }
    }
  }
  return result;
}

// Clean code: Flattened with guard clauses
function getPayAmount(employee: Employee): number {
  if (employee.isSeparated) return separatedAmount(employee);
  if (employee.isRetired) return retiredAmount(employee);
  if (employee.isOnLeave) return leaveAmount(employee);
  return normalPayAmount(employee);
}
```

### Code Example 6: Express Intent Through Code, Not Comments

```python
# Dirty code: Relying on comments
# Get users who haven't logged in for 30 or more days
# with active status and whose trial period has ended
users = []
for u in all_users:
    d = (datetime.now() - u.last_login).days
    if d >= 30 and u.status == 1 and u.trial_end < datetime.now():
        users.append(u)

# Clean code: The code itself conveys the intent
INACTIVE_THRESHOLD_DAYS = 30

def find_inactive_but_subscribed_users(
    all_users: list[User],
    threshold_days: int = INACTIVE_THRESHOLD_DAYS
) -> list[User]:
    """Returns active users whose trial has ended but who haven't logged in for a given period."""
    return [
        user for user in all_users
        if user.is_inactive_for(threshold_days)
        and user.is_active
        and user.has_trial_ended()
    ]
```

### Code Example 7: Extracting Conditional Expressions

```java
// Dirty code: Complex conditional expression
if (date.getMonth() >= 6 && date.getMonth() <= 8
    && temperature > 30
    && !isHoliday(date)
    && employee.getVacationDaysLeft() > 0
    && !employee.isOnCriticalProject()) {
    applySummerBonus(employee);
}

// Clean code: Conditions extracted into a method
if (isSummerBonusEligible(date, temperature, employee)) {
    applySummerBonus(employee);
}

private boolean isSummerBonusEligible(
    LocalDate date, int temperature, Employee employee
) {
    return isSummerSeason(date)
        && isHotDay(temperature)
        && isWorkingDay(date)
        && employee.hasAvailableVacationDays()
        && !employee.isOnCriticalProject();
}

private boolean isSummerSeason(LocalDate date) {
    int month = date.getMonthValue();
    return month >= 6 && month <= 8;
}

private boolean isHotDay(int temperature) {
    return temperature > SUMMER_BONUS_TEMPERATURE_THRESHOLD;
}
```

---

## 4. Core Principles of Clean Code

| Principle | Description | Effect | Reference |
|------|------|------|------|
| Readability first | Code is read far more often than it is written | Reduced comprehension time | This chapter |
| DRY | Don't repeat the same logic | Single source of truth for changes | [DRY/KISS/YAGNI](./02-dry-kiss-yagni.md) |
| KISS | Avoid complexity, keep it simple | Bug prevention | [DRY/KISS/YAGNI](./02-dry-kiss-yagni.md) |
| YAGNI | Don't build features you don't need now | Elimination of wasted development | [DRY/KISS/YAGNI](./02-dry-kiss-yagni.md) |
| SRP | One responsibility per function/class | Localized impact of changes | [SOLID Principles](./01-solid.md) |
| Express intent | Convey the purpose of code through names and structure | Reduced dependency on comments | [Naming Conventions](../01-practices/00-naming.md) |
| Low coupling, high cohesion | Minimize dependencies between modules, maximize internal relatedness | Improved testability | [Coupling and Cohesion](./03-coupling-cohesion.md) |

### Relationship Diagram Between Principles

```
  ┌────────────────────────────────────────────────────────┐
  │         System of Clean Code Principles                 │
  │                                                        │
  │              ┌──────────────┐                           │
  │              │ Readability  │  ← Highest-level value    │
  │              │    first     │                           │
  │              └──────┬───────┘                           │
  │           ┌────────┼────────┐                           │
  │           v        v        v                           │
  │    ┌──────────┐ ┌──────┐ ┌──────┐                      │
  │    │   KISS   │ │ DRY  │ │YAGNI │  ← 3 core principles │
  │    └────┬─────┘ └──┬───┘ └──┬───┘                      │
  │         │          │        │                           │
  │         v          v        v                           │
  │    ┌──────────────────────────────┐                     │
  │    │       SOLID Principles        │  ← Design principles│
  │    │  (SRP, OCP, LSP, ISP, DIP)   │                     │
  │    └────────────┬─────────────────┘                     │
  │                 │                                       │
  │         ┌───────┼───────┐                               │
  │         v               v                               │
  │  ┌────────────┐  ┌────────────────┐                     │
  │  │Low coupling│  │ Law of Demeter  │  ← Module principles│
  │  │high cohesion│ └────────────────┘                     │
  │  └────────────┘                                         │
  └────────────────────────────────────────────────────────┘
```

---

## 5. Measuring Code Quality

### 5.1 Quantitative Metrics

| Metric | Description | Target | Measurement Tool |
|------|------|------|-----------|
| Cyclomatic complexity | Complexity based on branch count | 10 or less per function | radon (Python), ESLint (JS) |
| Cognitive complexity | Difficulty of understanding for humans | 15 or less per function | SonarQube |
| Code coverage | Percentage of code executed by tests | 80% or more | pytest-cov, Istanbul |
| Duplication rate | Percentage of copy-pasted code | 5% or less | PMD CPD, jscpd |
| Function length | Physical line count per function | 20 lines or fewer recommended | Various linters |
| Dependency depth | Number of dependency levels between modules | 3 or fewer | deptry, madge |
| Technical debt ratio | Fix cost / redevelopment cost | 5% or less | SonarQube |

### 5.2 How to Calculate Cyclomatic Complexity

Cyclomatic Complexity is a metric proposed by Thomas McCabe in 1976 that represents the number of independent execution paths in a program.

```python
# Complexity 1: No branches
def greet(name: str) -> str:
    return f"Hello, {name}"

# Complexity 2: One if statement
def check_age(age: int) -> str:
    if age >= 18:
        return "Adult"
    return "Minor"

# Complexity 4: if + elif + for
def classify_scores(scores: list[int]) -> dict:
    result = {"high": 0, "mid": 0, "low": 0}
    for score in scores:           # +1
        if score >= 80:            # +1
            result["high"] += 1
        elif score >= 50:          # +1
            result["mid"] += 1
        else:
            result["low"] += 1
    return result

# Calculation: M = E - N + 2P
# E = number of edges, N = number of nodes, P = number of connected components
# Quick calculation: M = count of branch keywords (if, elif, for, while, and, or, except) + 1
```

### 5.3 Cognitive Complexity

An improved version of cyclomatic complexity proposed by SonarSource. It quantifies the "difficulty of understanding" for humans using the following rules:

```
  Cognitive Complexity Counting Rules

  1. Penalty increases the deeper the nesting
     if (a) {           // +1
       if (b) {         // +2 (nesting level 1)
         if (c) {       // +3 (nesting level 2)
         }
       }
     }

  2. Break in linear flow
     if, else if, else, switch, for, while,
     catch, &&, ||, ?:  → each +1

  3. Structures that do NOT increase nesting
     else, elif        → no nesting penalty

  Difference from cyclomatic complexity:
  · Cyclomatic: switch with 10 branches → complexity 10 (high)
  · Cognitive:  switch with 10 branches → complexity 1 (easy for humans to read)
```

### 5.4 Example Quality Dashboard Layout

```
  ┌────────────────────────────────────────────────────┐
  │  Quality Dashboard                                   │
  ├────────────────────────────────────────────────────┤
  │                                                    │
  │  [Coverage]      [Complexity]   [Duplication]      │
  │   ████ 85%       Avg 6.2        ██ 3.1%           │
  │   Target: 80%    Target: <10    Target: <5%        │
  │                                                    │
  │  [Tech Debt]     [Security]     [New Issues]       │
  │   12 days        Vulnerabilities: 0  This week: +3 │
  │   vs last week: -2 days  Blockers: 0  vs last: -5  │
  │                                                    │
  │  [Trends]                                           │
  │   Coverage ↑  Complexity →  Debt ↓  (improving)   │
  └────────────────────────────────────────────────────┘
```

---

## 6. Toolchain for Achieving Clean Code

### 6.1 Auto-Formatters and Linters

| Category | Python | JavaScript/TS | Java | Go |
|---------|--------|--------------|------|-----|
| Formatter | Black, Ruff | Prettier | google-java-format | gofmt |
| Linter | Ruff, pylint | ESLint | Checkstyle, SpotBugs | golangci-lint |
| Type checker | mypy | TypeScript | javac | Compiler |
| Complexity measurement | radon | eslint-plugin-complexity | PMD | gocyclo |
| Test coverage | pytest-cov | Istanbul/c8 | JaCoCo | go test -cover |

### 6.2 Quality Gates in CI/CD Pipelines

```
  ┌──────────────────────────────────────────────┐
  │  Example CI/CD Quality Gate Configuration     │
  │                                              │
  │  Stage 1: Lint & Format                      │
  │  ├── Formatter check (--check)               │
  │  ├── Linter (block on errors only)           │
  │  └── Type checking                           │
  │                                              │
  │  Stage 2: Test                               │
  │  ├── Unit tests                              │
  │  ├── Integration tests                       │
  │  └── Coverage measurement (80% or above)    │
  │                                              │
  │  Stage 3: Quality Analysis                   │
  │  ├── SonarQube / SonarCloud                  │
  │  ├── Technical debt check                    │
  │  └── Security scan                          │
  │                                              │
  │  Gate: Merge allowed only if all pass        │
  └──────────────────────────────────────────────┘
```

---

## 7. Building a Clean Code Culture

### 7.1 The Boy Scout Rule

> "Leave the codebase a little cleaner than you found it." ── Robert C. Martin

```
  Practicing the Boy Scout Rule

  Task: Add a filter to the user search feature

  ① Implement the feature (the main work)
     Add filter functionality to user_search.py

  ② Small improvements (Boy Scout Rule)
     · Rename variable lst → users
     · Remove unused imports
     · Add docstring

  ③ Don't overdo it (limit scope)
     · Large-scale refactoring belongs in a separate task
     · Avoid complete rewrites of files with no tests
     · Don't touch unrelated files
```

### 7.2 Quality Checks in Code Reviews

```
  Code Review Checklist (Quality Perspective)

  □ Does the naming accurately convey the intent?
  □ Does each function do only one thing?
  □ Are magic numbers replaced with named constants?
  □ Is error handling appropriate?
  □ Do tests cover boundary values and edge cases?
  □ Is there any duplicated code?
  □ Are there unnecessary comments? (Intent should be expressed in code)
  □ Is the direction of dependencies correct? (DIP)
  □ Is the impact of changes localized?
  □ Are there any performance concerns?
```

### 7.3 Gradual Adoption Strategy

When introducing a clean code culture to a team, a gradual approach is the key to success.

| Phase | Duration | Actions | Success Criteria |
|-------|------|------|---------|
| 1. Awareness | 1-2 weeks | Study sessions, sharing books | Team members can explain the principles |
| 2. Automation | 2-4 weeks | Introduce linter/formatter, configure CI | All PRs pass the quality gate |
| 3. Practice | 1-3 months | Strengthen code reviews, pair programming | Decrease in review comments |
| 4. Culture | 3-6 months | Quality dashboard, retrospectives | Continuous improvement of metrics |
| 5. Establishment | 6 months+ | Incorporate into onboarding | New members naturally follow practices |

---

## 8. Trade-offs and Edge Cases

### 8.1 Clean Code vs. Performance

There are situations where clean code and performance are in conflict. The following shows the decision criteria for such cases.

```
  Decision Flow

  Is there a performance problem?
  ├── No → Prioritize clean code
  └── Yes → Have you measured it?
       ├── No → Measure first (don't optimize based on guesses)
       └── Yes → Identify the bottleneck
            ├── Bottleneck → Optimize it (leave a comment explaining why)
            └── Not a bottleneck → Maintain clean code
```

**Donald Knuth's famous quote:**

> "Premature optimization is the root of all evil."

However, it is also important to know the full quote:

> "Programmers waste enormous amounts of time thinking about, or worrying about, the speed of noncritical parts of their programs, and these attempts at efficiency actually have a strong negative impact when debugging and maintenance are considered. We should forget about small efficiencies, say about 97% of the time: **premature optimization is the root of all evil**. Yet we should not pass up our opportunities in that critical 3%."

### 8.2 Clean Code vs. Deadlines

```
  Decision Matrix for Deliberate Technical Debt "Borrowing"

  ┌───────────────────┬────────────────────┐
  │  When to borrow   │  When to avoid it  │
  ├───────────────────┼────────────────────┤
  │ · A release       │ · Constant deadline│
  │   critical to     │   pressure         │
  │   business        │ · Degradation of   │
  │   survival        │   core feature     │
  │ · Experimental    │   quality          │
  │   features        │ · Team is unaware  │
  │   (may be         │   of the debt      │
  │    discarded      │ · No plan to repay │
  │    after testing) │                    │
  │ · Clear repayment │                    │
  │   plan            │                    │
  └───────────────────┴────────────────────┘
```

### 8.3 Alternative Approach: Pragmatic Quality

Rather than aiming for "perfect clean code," there is also an approach of targeting **pragmatic quality**.

| Perfectionism | Pragmatic |
|---------|----------------|
| Bring all code to ideal quality | Focus improvements on frequently changed areas |
| Comprehensive tests for everything | Focus testing on high-risk areas |
| All design SOLID-compliant | Focus design on areas planned for extension |
| Full refactoring all at once | Improve incrementally every time you touch the code |

---

## 9. Anti-Patterns

### Anti-Pattern 1: Premature Optimization

```python
# NG: Unreadable optimization done too early
def f(d):
    return {k: v for k, v in sorted(
        ((k, sum(x['v'] for x in g))
         for k, g in __import__('itertools').groupby(
             sorted(d, key=lambda x: x['k']),
             key=lambda x: x['k'])),
        key=lambda x: -x[1])}

# OK: Prioritize readability first, then optimize when needed
from collections import defaultdict

def aggregate_and_sort_by_value(data: list[dict]) -> dict:
    """Aggregates values by key and returns them in descending order.

    Args:
        data: A list of dictionaries with 'key' and 'value' fields.

    Returns:
        A dictionary of aggregated totals per key, sorted in descending order.

    Examples:
        >>> data = [
        ...     {'key': 'a', 'value': 10},
        ...     {'key': 'b', 'value': 5},
        ...     {'key': 'a', 'value': 20},
        ... ]
        >>> aggregate_and_sort_by_value(data)
        {'a': 30, 'b': 5}
    """
    aggregated = defaultdict(int)
    for item in data:
        aggregated[item['key']] += item['value']

    return dict(sorted(
        aggregated.items(),
        key=lambda pair: pair[1],
        reverse=True
    ))
```

### Anti-Pattern 2: Using Comments to Justify Dirty Code

```java
// NG: Using comments to explain complexity
// i is the customer index, j is the order index,
// k is the product index, t is the total amount
for (int i = 0; i < c.length; i++) {
    for (int j = 0; j < c[i].o.length; j++) {
        for (int k = 0; k < c[i].o[j].p.length; k++) {
            t += c[i].o[j].p[k].pr * c[i].o[j].p[k].q;
        }
    }
}

// OK: The code speaks for itself
for (Customer customer : customers) {
    for (Order order : customer.getOrders()) {
        for (Product product : order.getProducts()) {
            totalRevenue += product.getPrice() * product.getQuantity();
        }
    }
}
```

### Anti-Pattern 3: Over-Abstraction (Astronaut Architecture)

```python
# NG: Over-abstracting a simple operation
class AbstractDataProcessorFactory:
    def create_processor(self): ...

class ConcreteDataProcessorFactory(AbstractDataProcessorFactory):
    def create_processor(self):
        return DataProcessor(
            reader=FileReaderAdapter(CsvReader()),
            transformer=DataTransformationPipeline([
                WhitespaceNormalizer(),
                EncodingConverter(),
            ]),
            writer=OutputWriterAdapter(ConsoleWriter()),
        )

# OK: Direct and simple
import csv

def read_and_display_csv(filepath: str) -> None:
    """Reads a CSV file and displays it to the console."""
    with open(filepath) as f:
        reader = csv.reader(f)
        for row in reader:
            print(", ".join(row))
```

---

## 10. Practice Exercises

### Exercise 1 (Basic): Improving Code Readability

Refactor the following code according to clean code principles.

```python
# Before improvement
def p(d):
    r = 0
    for x in d:
        if x['t'] == 'i':
            r += x['a']
        elif x['t'] == 'e':
            r -= x['a']
    if r < 0:
        r = 0
    return r
```

**Expected improvement points:**
- Replace with meaningful variable and function names
- Extract string literals that should be named constants
- Add type hints and a docstring

**Expected output example:**

```python
INCOME = 'income'
EXPENSE = 'expense'

def calculate_balance(transactions: list[dict]) -> float:
    """Calculates the balance from a list of transactions. Balance will not go below 0.

    Args:
        transactions: A list of dictionaries with 'type' ('income' or 'expense') and 'amount' (float).

    Returns:
        The calculated balance (minimum value is 0).
    """
    balance = 0.0
    for transaction in transactions:
        if transaction['type'] == INCOME:
            balance += transaction['amount']
        elif transaction['type'] == EXPENSE:
            balance -= transaction['amount']
    return max(balance, 0.0)
```

### Exercise 2 (Intermediate): Analyzing Technical Debt

Identify the technical debt in the following code and create an improvement plan.

```python
import json, os, smtplib, sqlite3

class App:
    def run(self, action, data):
        conn = sqlite3.connect('app.db')
        if action == 'register':
            if data.get('email') and '@' in data['email'] and len(data.get('password', '')) >= 8:
                conn.execute("INSERT INTO users VALUES (?, ?, ?)",
                    (data['email'], data['password'], json.dumps({'created': str(datetime.now())})))
                conn.commit()
                try:
                    s = smtplib.SMTP('localhost')
                    s.sendmail('noreply@app.com', data['email'], 'Welcome!')
                    s.quit()
                except:
                    pass
                return {'status': 'ok'}
            return {'status': 'error', 'msg': 'invalid'}
        elif action == 'login':
            r = conn.execute("SELECT * FROM users WHERE email=? AND password=?",
                (data.get('email', ''), data.get('password', ''))).fetchone()
            if r:
                return {'status': 'ok', 'token': os.urandom(16).hex()}
            return {'status': 'error'}
        elif action == 'delete':
            conn.execute("DELETE FROM users WHERE email=?", (data.get('email', ''),))
            conn.commit()
            return {'status': 'ok'}
        conn.close()
```

**Expected analysis:**

| Debt | Type | Priority | Improvement |
|------|------|--------|--------|
| God Class | SRP violation | High | Separate responsibilities (Service, Repository, Validator) |
| Plaintext password storage | Security | Critical | Hash with bcrypt or equivalent |
| SQL injection resistance | Security | High | Parameterized queries (partially implemented but insufficient validation) |
| except: pass | Error swallowing | Medium | Add logging + proper error handling |
| Magic number (8) | Readability | Low | Replace with named constant |
| DB connection management | Resource leak | High | Use context manager (with statement) |
| No tests | Maintainability | High | Add unit tests |

### Exercise 3 (Advanced): Refactoring to Clean Code

Refactor the code from Exercise 2 to meet the following quality criteria.

**Quality criteria:**
- Compliant with SOLID principles
- Responsibilities of each class/function are clear
- Error handling is appropriate
- Design is testable
- Security issues are resolved

**Expected output example (partial):**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import bcrypt

# Domain model
@dataclass
class User:
    email: str
    password_hash: str

# Repository layer
class UserRepository(ABC):
    @abstractmethod
    def save(self, user: User) -> None: ...

    @abstractmethod
    def find_by_email(self, email: str) -> Optional[User]: ...

    @abstractmethod
    def delete_by_email(self, email: str) -> None: ...

# Validation
class UserValidator:
    MIN_PASSWORD_LENGTH = 8

    def validate_registration(self, email: str, password: str) -> list[str]:
        errors = []
        if not email or '@' not in email:
            errors.append("Please enter a valid email address")
        if len(password) < self.MIN_PASSWORD_LENGTH:
            errors.append(f"Password must be at least {self.MIN_PASSWORD_LENGTH} characters")
        return errors

# Authentication service
class AuthService:
    def __init__(self, repository: UserRepository, validator: UserValidator):
        self.repository = repository
        self.validator = validator

    def register(self, email: str, password: str) -> "RegistrationResult":
        errors = self.validator.validate_registration(email, password)
        if errors:
            return RegistrationResult.failure(errors)

        password_hash = bcrypt.hashpw(
            password.encode(), bcrypt.gensalt()
        ).decode()

        user = User(email=email, password_hash=password_hash)
        self.repository.save(user)
        return RegistrationResult.success(user)
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check the path and format of the configuration file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check permissions for the executing user, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate incrementally**: Use logging or a debugger to verify each hypothesis
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
    """A decorator that logs the input and output of a function"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception raised in {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (subject to debugging)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for the presence of memory leaks
3. **Check for I/O waits**: Examine disk and network I/O conditions
4. **Check concurrent connections**: Inspect the state of the connection pool

| Problem Type | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────┐
│        Architecture Selection Flow           │
├─────────────────────────────────────────────┤
│                                             │
│  ① What is the team size?                   │
│    ├─ Small (1-5 people) → Monolith         │
│    └─ Large (10+ people) → Go to ②          │
│                                             │
│  ② What is the deployment frequency?        │
│    ├─ Weekly or less → Monolith + modules   │
│    └─ Daily / multiple times → Go to ③      │
│                                             │
│  ③ How independent are the teams?           │
│    ├─ High → Microservices                  │
│    └─ Moderate → Modular monolith           │
│                                             │
└─────────────────────────────────────────────┘
```

### Analyzing Trade-offs

Technical decisions always involve trade-offs. Analyze them from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A solution that is fast in the short term can become technical debt in the long term
- Conversely, over-engineering incurs high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has a lower learning cost
- Adopting diverse technologies enables the right tool for the right job, but increases operational costs

**3. Level of Abstraction**
- High abstraction enables reusability but can make debugging difficult
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creates an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describes the background and the problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describes the decision made"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Adds a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Adds a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Outputs in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
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

**Situation:** Need to ship a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring from an early stage

**Lessons learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually modernizing a system that has been in operation for more than 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If no existing tests, write Characterization Tests first
- Use an API gateway to run old and new systems side by side
- Perform data migration in stages

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, understanding dependencies | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration begins | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission the old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50 or more engineers working on the same product

**Approach:**
- Use Domain-Driven Design to clearly define boundaries
- Assign ownership to each team
- Manage shared libraries using an Inner Source model
- Design API-first to minimize inter-team dependencies

```python
# Defining API contracts between teams
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
        """Verifies SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Outputs in OpenAPI format"""
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

**Situation:** A system where millisecond-level response times are required

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Asynchronous processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound operations |

---

## Applying This in Team Development

### Code Review Checklist

Key points to verify in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security concerns?
- [ ] Is the documentation up to date?

### Best Practices for Knowledge Sharing

| Method | Frequency | Audience | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Whole team | Horizontal knowledge transfer |
| ADR (Design records) | As needed | Future members | Transparent decision-making |
| Retrospective | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Important design | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │ Plan│Act  │
    │ for │ now │
    │ it  │     │
    ├─────┼─────┤
    │ Just│ Next│
    │ log │Sprint
    │ it  │     │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```
---

## 11. FAQ

### Q1: Does writing clean code slow down development?

In the short term, you spend more time thinking about naming and structure. However, over the medium to long term, time spent reading, debugging, and modifying code is significantly reduced, so **overall productivity improves**. IBM research shows that code review reduces the cost of fixing defects in later phases by 10 to 100 times.

Let's think in concrete numbers. Of an 8-hour development day, if reading code takes 5.6 hours (70%), modification takes 1.6 hours (20%), and writing new code takes 0.8 hours (10%), then a 30% reduction in reading time through clean code saves 1.68 hours per day. That's 33.6 hours per month and 403 hours per year.

### Q2: Where should I start cleaning up legacy code?

Follow the **Boy Scout Rule** (leave it cleaner than you found it) and improve files a little at a time as you touch them. Rather than a complete rewrite, add tests and refactor incrementally. Priority goes to "files that are changed frequently."

Concrete steps:
1. **Hotspot analysis**: Use Git commit history to identify frequently changed files (`git log --format=format: --name-only | sort | uniq -c | sort -rn | head -20`)
2. **Add tests**: First write tests for the target file (to lock in its behavior)
3. **Incremental improvement**: Follow the Boy Scout Rule and improve a little each time you touch the code
4. **Measure**: Compare quality metrics before and after improvement

### Q3: How do you enforce clean code across an entire team?

1. **Establish coding standards and automate them** (linters, formatters)
2. **Foster a code review culture** (use review checklists)
3. **Introduce pair programming / mob programming**
4. **Make technical debt visible** (quality dashboard)
5. **Team reading groups** (read *Clean Code*, *Refactoring*, etc. together)
6. **Hold regular refactoring sprints**

### Q4: How do you judge whether code is "clean"?

You can use the following checklist:

- **5-second rule**: Can you understand the purpose of a function within 5 seconds of looking at it?
- **Name test**: Can you explain what a function does from its name alone?
- **Principle of least surprise**: Is there anything surprising about the behavior of the code?
- **Modification test**: If you were to change this part, can you predict the scope of impact?
- **Test test**: Can you easily write a unit test for this function?

### Q5: What is the relationship between clean code and design patterns?

Design patterns are **one means** of achieving clean code, not the goal itself. Knowing patterns is important, but using patterns "just to use patterns" is putting the cart before the horse.

The correct relationship:
```
Recognize the problem → Judge using principles (SOLID, DRY, etc.) → Apply a pattern if needed
```

The incorrect relationship:
```
Know a pattern → Look for situations to apply it → Force it in
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|------|
| Essence of clean code | Code that is readable, understandable, and easy to change |
| Business effect | Reduced maintenance cost, sustained development velocity, bug prevention |
| Core principles | Readability first, DRY, KISS, YAGNI, SRP, low coupling and high cohesion |
| Measurement methods | Complexity, coverage, duplication rate, function size, technical debt ratio |
| Key to practice | Automation tools + code review + continuous improvement |
| Neuroscientific basis | Code that respects the constraints of working memory is easier to understand |
| Adoption strategy | Gradual (awareness → automation → practice → culture → establishment) |
| Trade-offs | Balance with performance and deadlines based on the situation |

### Correspondence Table: Clean Code Principles and Practices

| Principle | Corresponding Practice | Measurement Metric | Tool |
|------|------------|---------|--------|
| Readability first | Naming conventions, minimize comments | Review time | Code review metrics |
| DRY | Extract common modules | Duplication rate | jscpd, PMD CPD |
| KISS | Minimal abstraction | Cognitive complexity | SonarQube |
| YAGNI | Requirements-driven implementation | Unused code rate | dead code analysis |
| SRP | Small classes and functions | Class size | Linter |
| Low coupling | DI, interfaces | Number of dependencies | deptry, madge |
| High cohesion | Domain-based organization | LCOM | SonarQube |

---

## Guides to Read Next

- [SOLID Principles](./01-solid.md) ── The 5 principles of object-oriented design
- [DRY/KISS/YAGNI](./02-dry-kiss-yagni.md) ── Principles of eliminating duplication and keeping things simple
- [Coupling and Cohesion](./03-coupling-cohesion.md) ── The foundation of module design
- [Law of Demeter](./04-law-of-demeter.md) ── The principle of least knowledge
- [Naming Conventions](../01-practices/00-naming.md) ── The art of naming to convey intent
- [Function Design](../01-practices/01-functions.md) ── Single responsibility, arguments, and side effects
- [Error Handling](../01-practices/02-error-handling.md) ── Robust error handling
- [Code Smells](../02-refactoring/00-code-smells.md) ── Signs of problematic code
- Design Patterns ── Applying design patterns

---

## References

1. **Robert C. Martin** *Clean Code: A Handbook of Agile Software Craftsmanship* Prentice Hall, 2008
2. **Martin Fowler** *Refactoring: Improving the Design of Existing Code* Addison-Wesley, 2018 (2nd Edition)
3. **Steve McConnell** *Code Complete: A Practical Handbook of Software Construction* Microsoft Press, 2004 (2nd Edition)
4. **Dustin Boswell, Trevor Foucher** *The Art of Readable Code* O'Reilly Media, 2011
5. **John Ousterhout** *A Philosophy of Software Design* Yaknyam Press, 2018
6. **Thomas McCabe** "A Complexity Measure" IEEE Transactions on Software Engineering, 1976
7. **G. Ann Campbell** "Cognitive Complexity: A New Way of Measuring Understandability" SonarSource, 2018
8. **Ward Cunningham** "The WyCash Portfolio Management System" OOPSLA Experience Report, 1992 ── The original source for technical debt
