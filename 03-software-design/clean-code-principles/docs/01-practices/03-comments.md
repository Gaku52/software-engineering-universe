# Comments — Good Comments, Bad Comments, and Self-Documenting Code

> "A comment is a failure to express yourself in code." — Robert C. Martin. The best comment is the one you don't need to write, but well-placed comments can greatly aid code comprehension. Learn to distinguish good comments from bad, and develop the skill to write self-documenting code.

---

## What You Will Learn in This Chapter

1. **Types and techniques for good comments** — Understand the patterns and specific writing techniques for comments worth writing: Why comments, warning comments, documentation comments, and more
2. **Types of bad comments and how to eliminate them** — Recognize anti-patterns such as redundant comments, lying comments, and commented-out code, and learn how to remove them from your codebase
3. **Self-documenting code design techniques** — Master techniques for making code communicate its intent without relying on comments, through naming, structure, and the type system
4. **Documentation comment design** — Learn how to write effective documentation comments for public APIs and the standard formats used in various languages
5. **Team comment strategies** — Learn how to establish comment policies, define review standards, and introduce automated checks

---

## Prerequisites

The following knowledge is helpful for understanding this chapter.

| Prerequisite | Reference |
|---------|--------|
| Basics of naming conventions | [Naming Conventions](./00-naming.md) |
| Principles of function design | [Function Design](./01-functions.md) |
| Basics of class design | Class Design |
| Basic Git operations | Version control fundamentals |

---

## 1. Comment Fundamentals — Why Comment Quality Matters

### 1.1 The Cost of Comments

Comments are not "free." They carry the following hidden costs.

```
Hidden Costs of Comments
────────────────────────────────────
1. Maintenance cost: Every code change requires updating comments too
2. Cognitive cost: Readers must process both code and comments
3. Trust cost: A lying comment erodes trust in all comments
4. Misdirection cost: Bad comments can lead readers in the wrong direction

More comments ≠ Better code
Fewer comments ≠ Worse code
────────────────────────────────────
The right comments in the right places is what matters
```

Robert C. Martin repeatedly emphasizes in Clean Code: "Before writing a comment, ask yourself if you can improve the code instead." The act of writing a comment may itself indicate a design deficiency in the code. At the same time, there is definitely information that code alone cannot convey (business reasons, technical constraints, historical context), and that is precisely where comments have real value.

To understand the essence of comments, you need to grasp this point: "Code tells us *How* (how it is done), but is poor at conveying *Why* (why it is done that way)." Communicating *Why* is the primary role of comments.

### 1.2 Comment Priority

```
+-----------------------------------------------------------+
|  Comment Priority                                          |
|  ─────────────────────────────────────                    |
|  1st: Express intent in code (naming, structure)           |
|  2nd: Supplement with comments what code cannot express    |
|  3rd: Record details in external documentation            |
|                                                           |
|  "What it does" is told by the code                       |
|  "Why it does it" is supplemented by comments             |
+-----------------------------------------------------------+
```

Let's explore why this priority matters. The reason expressing intent in code (1st) takes top priority is that code is verified for correctness by a compiler or interpreter, while comments are verified by no one. When code changes, comments do not automatically follow. Therefore, you should put as much information as possible into code, whose accuracy can be guaranteed.

### 1.3 Comment Necessity Matrix

```
  Comment Necessity Matrix

           Code is clear    Code is unclear
         ┌──────────────┬──────────────────┐
  Intent │ No comment   │ Comment needed   │
  is     │ needed       │ (improve code    │
  obvious│ x = x + 1   │  first)          │
         ├──────────────┼──────────────────┤
  Intent │ Why comment  │ Comment required │
  is not │ is effective │ + improve code   │
  obvious│              │                  │
         └──────────────┴──────────────────┘

  Decision flow:
  1. Does the code alone convey its intent? → Yes → No comment needed
  2. Can the code be improved?              → Yes → Improve first; add comment only if still insufficient
  3. Is there a WHY that needs explaining?  → Yes → Add a Why comment
  4. Are there warnings or constraints?     → Yes → Add a warning comment
```

### 1.4 Overview of Comment Classification

```
  Comment Classification Diagram

  Comments
  ├── Good comments (worth writing)
  │   ├── Why comments ── Explaining business rules, technical reasons
  │   ├── Warning comments ── Thread safety, performance caveats
  │   ├── TODO/FIXME ── Planned future improvements (must link to an Issue)
  │   ├── License comments ── Legal requirements
  │   ├── Documentation comments ── Explanations for public APIs
  │   └── Complex algorithm explanations ── Regex, mathematical processing
  │
  ├── Bad comments (to avoid)
  │   ├── What comments ── Repeating the code
  │   ├── Lying comments ── Inconsistencies with the code
  │   ├── Commented-out code ── A role Git should play
  │   ├── Personal comments ── Dependence on specific individuals
  │   ├── Change history comments ── A role VCS should play
  │   ├── Section divider comments ── Should be separated by structure
  │   └── Journal comments ── Diary-style notes
  │
  └── Self-documenting code (techniques to make comments unnecessary)
      ├── Meaningful naming
      ├── Extract Method
      ├── Introduce Constant
      ├── Using the type system
      └── Using polymorphism
```

---

## 2. Types of Good Comments

### 2.1 Why Comments — Explaining the Reason

The most valuable comments explain "why this particular implementation was chosen." Code can tell you *what* is happening, but not *why* it is happening that way. Here are cases where Why comments are especially effective:

- **Business rule context**: Why this value, this condition, this processing order
- **Technical constraint reasons**: Why this library, this algorithm, this workaround
- **Historical background**: Why the implementation goes against intuition
- **Recorded tradeoffs**: Why this approach was chosen over alternatives

**Code Example 1: A Why comment explaining the business rule context**

```python
class RateLimiter:
    def should_allow(self, client_id: str) -> bool:
        # Using the Sliding Window algorithm.
        # Fixed Window causes burst traffic at window boundaries.
        # Example: With Fixed Window at 100 requests/minute,
        # 100 requests at second 59 + 100 requests at second 0 of the next minute
        # = effectively 200 requests passing in 1 second.
        # Reference: https://blog.cloudflare.com/counting-things-a-lot-of-different-things/
        window_start = time.time() - self.window_size
        request_count = self.store.count_since(client_id, window_start)
        return request_count < self.max_requests

    def _cleanup_old_entries(self):
        # Explicitly deleting old entries to keep Redis memory usage low.
        # Normally TTL handles automatic deletion, but with a large number of keys,
        # Redis lazy deletion can fall behind.
        # (Redis 6.0+ allows tuning via active-expire-effort, but its
        #  performance impact is hard to predict, so explicit deletion is preferred.)
        cutoff = time.time() - (self.window_size * 2)
        self.store.delete_before(cutoff)
```

**Code Example 2: A Why comment for technical constraints**

```python
class PaymentProcessor:
    def process(self, payment: Payment) -> PaymentResult:
        # Stripe API supports idempotency keys to prevent duplicate charges.
        # Using the order ID as the idempotency key prevents double-charging
        # in case of retries after a network failure.
        # Reference: https://stripe.com/docs/api/idempotent_requests
        idempotency_key = f"payment-{payment.order_id}"

        try:
            charge = stripe.Charge.create(
                amount=payment.amount,
                currency="jpy",
                idempotency_key=idempotency_key,
            )
            return PaymentResult.success(charge.id)
        except stripe.error.CardError as e:
            return PaymentResult.failure(str(e))
```

**Code Example 3: A Why comment explaining performance reasons**

```java
public class UserSearchService {
    public List<User> searchByName(String query) {
        // Using LIKE search instead of full-text search index.
        // Reason: User count is under 10,000, so Elasticsearch's
        // operational cost (infrastructure, maintenance) is not justified.
        // Consider migrating to full-text search if users exceed 100,000.
        // Issue: https://github.com/example/app/issues/567
        return userRepository.findByNameLike("%" + query + "%");
    }

    public List<User> findActive() {
        // Returning a sorted list.
        // The UI uses pagination + infinite scroll, and without a guaranteed
        // consistent order, items may appear duplicated or missing while scrolling.
        return userRepository.findByStatus(Status.ACTIVE, Sort.by("id"));
    }
}
```

**Code Example 4: Recording tradeoffs**

```python
class SessionStore:
    def __init__(self):
        # Using an in-memory dictionary instead of Redis.
        # Tradeoffs:
        #   Benefits: No external dependencies, minimal latency, easy dev setup
        #   Drawbacks: Sessions lost on process restart, no horizontal scaling
        # Acceptable for now because we run as a single instance.
        # Switch to Redis when moving to a multi-instance configuration.
        # Decision date: 2024-01-15, Decision maker: Architecture review meeting
        self._sessions: dict[str, Session] = {}
```

### 2.2 Legal Comments and License Notices

Legally required comments must not be omitted. Complying with OSS licenses is a legal obligation, and omitting these comments can lead to copyright infringement.

```java
/*
 * Copyright (c) 2024 Example Corp.
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */
```

```python
# SPDX-License-Identifier: Apache-2.0
# Copyright 2024 Example Corp.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
```

SPDX (Software Package Data Exchange) format for license notices is highly machine-readable and recommended. See https://spdx.org/licenses/ for a list of SPDX identifiers.

### 2.3 Warning Comments

Always leave important warnings for future developers in comments. Cases where warning comments are especially necessary:

- **Thread safety**: Constraints when running concurrently
- **Performance**: Notes on processing time or memory usage
- **Side effects**: Potential for unexpected impacts
- **Processing order**: Reasons why the order must not be changed

**Code Example 5: A collection of warning comment patterns**

```python
# WARNING: This function is not thread-safe.
# External mutual exclusion is required when used in a multi-threaded environment.
# Recommend using threading.Lock() or concurrent.futures.
def update_global_cache(key: str, value: any) -> None:
    global_cache[key] = value

# CAUTION: This operation takes an average of 2 seconds (up to 10 seconds).
# Do not use in user-facing request paths.
# Call via a background job (e.g., Celery) to avoid request timeouts.
def rebuild_search_index() -> None:
    pass

# NOTE: This constant is based on the external API specification.
# Verify the API documentation before changing it.
# https://api.example.com/docs#rate-limits
MAX_REQUESTS_PER_MINUTE = 60

# IMPORTANT: Do not change the order of the following operations.
# The order must be: check inventory → payment → reserve inventory.
# Changing this order causes double inventory reservation.
# This exact ordering change caused a production incident (2023-06 P1 Incident).
def process_order(order: Order) -> None:
    check_inventory(order)      # 1. Check inventory
    process_payment(order)      # 2. Process payment
    reserve_inventory(order)    # 3. Reserve inventory
```

```
Warning Comment Prefix Conventions
────────────────────────────────────
  WARNING   : Caveats that could cause serious problems
  CAUTION   : Notes on performance or resource usage
  NOTE      : Supplementary information that is useful to know
  IMPORTANT : Constraints that must not be changed
  SECURITY  : Security-related warnings
────────────────────────────────────
```

### 2.4 TODO / FIXME / HACK Comments

Comments that record planned future improvements. Always link to an issue tracker.

**Code Example 6: Proper use of TODO/FIXME/HACK**

```python
# TODO(#1234): Migrate to OAuth2 in v2.0. Basic auth is deprecated.
# Deadline: 2025-Q2
# Owner: auth-team
def authenticate_basic(username: str, password: str) -> bool:
    pass

# FIXME(#2345): OOM occurs with large datasets (over 1 million records).
# Cause: Loading all records into memory at once.
# Fix: Switch to streaming processing.
def export_all_users() -> list:
    return db.query("SELECT * FROM users")

# HACK(#3456): Workaround for a MySQL 5.7 bug (#12345).
# Remove after upgrading to MySQL 8.0.
# Reference: https://bugs.mysql.com/bug.php?id=12345
def query_with_workaround(sql: str) -> list:
    sql = sql.replace("GROUP BY", "GROUP BY 1, ")
    return db.execute(sql)

# OPTIMIZE(#4567): N+1 query is occurring.
# Currently acceptable due to low data volume,
# but switch to a JOIN query when tenant count exceeds 100.
def get_tenant_users(tenant_ids: list[str]) -> list[User]:
    result = []
    for tid in tenant_ids:
        result.extend(db.query("SELECT * FROM users WHERE tenant_id = %s", tid))
    return result
```

```
TODO Comment Format Rules
────────────────────────────────────
Format:   # TODO(#<issue_number>): <description>
Required: Issue number, concise description
Optional: Deadline, owning team, reference link

  Prefix list:
  TODO     : Feature or improvement to implement in the future
  FIXME    : Known bug or defect
  HACK     : Temporary workaround (planned for removal)
  OPTIMIZE : Opportunity for performance improvement
  REVIEW   : Area that needs reconsideration during review

  Bad:  # TODO: fix this later
  Good: # TODO(#1234): Migrate to OAuth2 in v2.0. Basic auth deprecated in 2025-Q2.
────────────────────────────────────
```

### 2.5 Explaining Regex and Complex Algorithms

Regular expressions and algorithms are prime examples where code alone struggles to convey *What* it is doing. Comments explaining *What* are justified here.

**Code Example 7: Detailed comments for regular expressions**

```python
# Email address validation compliant with RFC 5322
# Local part: alphanumerics, dots, hyphens, underscores, plus signs
# Domain part: labels (alphanumerics + hyphens) connected by dots
# Reference: https://datatracker.ietf.org/doc/html/rfc5322#section-3.4.1
EMAIL_PATTERN = re.compile(
    r'^[a-zA-Z0-9._%+-]+'    # local part
    r'@'                       # @ symbol
    r'[a-zA-Z0-9.-]+'         # domain name
    r'\.[a-zA-Z]{2,}$'        # top-level domain
)

# Japanese phone number validation (landline + mobile)
# Format 1: 03-1234-5678 (area code - city code - subscriber number)
# Format 2: 090-1234-5678 (mobile phone)
# Format 3: 0120-123-456 (toll-free)
# Supports both hyphenated and non-hyphenated formats
PHONE_PATTERN = re.compile(
    r'^0'                      # starts with 0
    r'[0-9]{1,4}'             # area code (1-4 digits)
    r'-?'                      # hyphen (optional)
    r'[0-9]{1,4}'             # city code (1-4 digits)
    r'-?'                      # hyphen (optional)
    r'[0-9]{3,4}$'            # subscriber number (3-4 digits)
)

# Credit card number masking
# Retain first 6 digits (BIN) and last 4 digits, mask the middle
# Example: 4111-1111-1111-1111 → 411111******1111
# PCI DSS compliant: display up to first 6 + last 4 digits
MASK_PATTERN = re.compile(r'^(\d{6})\d+(\d{4})$')
```

**Code Example 8: Explanatory comments for complex algorithms**

```python
# Dijkstra's algorithm: computes shortest distances from the source to all vertices
# Time complexity: O((V + E) log V) where V = number of vertices, E = number of edges
# Use Bellman-Ford if the graph contains negative weights
#
# Algorithm overview:
# 1. Initialize source distance to 0 and all other vertices to inf
# 2. Select the unvisited vertex with the smallest distance (using a priority queue)
# 3. Update distances to adjacent vertices (relaxation)
# 4. Repeat steps 2-3 until all vertices are finalized
def dijkstra(graph: Graph, source: int) -> dict[int, float]:
    distances = {v: float('inf') for v in graph.vertices}
    distances[source] = 0
    priority_queue = [(0, source)]
    visited = set()

    while priority_queue:
        current_dist, u = heapq.heappop(priority_queue)

        if u in visited:
            continue
        visited.add(u)

        for v, weight in graph.neighbors(u):
            # Relaxation: update if a shorter path to v is found
            new_dist = current_dist + weight
            if new_dist < distances[v]:
                distances[v] = new_dist
                heapq.heappush(priority_queue, (new_dist, v))

    return distances
```

### 2.6 Intent-Explaining Comments for Public APIs

```python
class EventBus:
    def subscribe(self, event_type: str, handler: Callable) -> None:
        """Register an event handler.

        Multiple handlers can be registered for the same event.
        Handlers are called in registration order (FIFO).

        # Why guarantee order:
        # There are use cases where an audit log handler must be
        # called before the business logic handler.
        # Order-independent design is preferred, but required by current specs.

        Args:
            event_type: String identifying the type of event.
            handler: Callback function to invoke when the event fires.

        Raises:
            ValueError: If event_type is an empty string.
            TypeError: If handler is not callable.
        """
        self._handlers.setdefault(event_type, []).append(handler)
```

---

## 3. Types of Bad Comments

### 3.1 What Comments (Repeating the Code)

Comments that simply translate code into natural language add zero information and only incur maintenance costs. This type of comment is the most commonly seen bad comment in codebases.

**Code Example 9: Examples of What comments and how to improve them**

```python
# -----  NG: Repeating the code as-is -----

# Get the username
username = user.get_name()  # obvious from the code

# Increment the counter
counter += 1  # unnecessary

# Append to the list
items.append(new_item)  # too obvious

# Null check
if user is not None:  # same as the code
    process(user)


# ----- OK: Code that needs no comments -----

username = user.get_name()
counter += 1
items.append(new_item)
if user is not None:
    process(user)

# Comment only when there is a "why":
# Even deleted users still need their profile displayed during the grace period,
# which is why the None check is necessary.
if user is not None:
    process(user)
```

### 3.2 Lying Comments (Inconsistencies with Code)

When a comment contradicts the code, you have the most dangerous situation. Readers trust the comment, but the actual behavior is determined by the code. Lying comments are rarely written intentionally — they arise when code is changed but the comment update is missed.

**Code Example 10: Detecting and fixing lying comments**

```python
# NG: Lying comment (the condition description is reversed)
# Check if the number is even
if number % 2 != 0:  # actually checks for odd!
    process_odd(number)

# NG: Stale comment (value changed but comment not updated)
# Maximum retry count is 3
MAX_RETRIES = 5  # quietly changed to 5 at some point

# NG: Argument description does not match reality
def send_email(
    to: str,       # recipient email address
    subject: str,  # subject line
    body: str,     # body (plain text) ← actually supports HTML too
) -> bool:
    pass

# NG: Return value description is wrong
def find_user(user_id: str):
    """Retrieves a user. Returns None if not found."""
    # Actually raises UserNotFoundError if not found
    user = db.query("SELECT * FROM users WHERE id = %s", user_id)
    if not user:
        raise UserNotFoundError(user_id)
    return user


# OK: Fix the comment, or improve the code
def is_odd(number: int) -> bool:
    """Returns True if the number is odd."""
    return number % 2 != 0

if is_odd(number):
    process_odd(number)
```

### 3.3 Commented-Out Code

Commented-out code makes readers wonder "is it safe to delete this?" and accumulates noise in the codebase. Since history is preserved in Git, you should delete it rather than comment it out.

```python
# NG: Leaving commented-out code in place
def calculate_total(items):
    total = sum(item.price for item in items)
    # tax = total * 0.08  # old tax rate
    # discount = total * 0.05 if is_member else 0
    # total = total + tax - discount
    # if apply_coupon:
    #     total = total * 0.9
    tax = total * 0.10
    return total + tax

# Why this is bad:
# 1. Readers wonder "is it safe to delete this?"
# 2. It's unclear why it was left in
# 3. It makes the code flow harder to read
# 4. Git history allows restoration → just delete it
```

```
Correct Way to Handle Commented-Out Code
────────────────────────────────────
1. It can be restored from Git history → delete it
2. Planned for future use → file an Issue, then delete
3. For debugging → delete after debugging is complete
4. Reference for an alternative implementation → move to external docs, then delete
5. During A/B testing → branch with a Feature Flag (no need to comment out)
────────────────────────────────────
Principle: Delete commented-out code as soon as you find it
```

### 3.4 Personal Comments

```python
# NG: Personal comments — information that depends on individuals
# Confirmed with Tanaka (2023/01/15)
# TODO: Sato will refactor this later
# Only Yamada understands this part
# Feature added at Suzuki's request

# OK: State as objective information
# 2023-01-15 Approved: FSA guideline compliance confirmed (Issue #789)
# TODO(#1234): Refactor the query for performance improvement
# NOTE: See docs/pricing-algorithm.md for the spec behind this logic
# Requirement: Discount feature added in ticket #567
```

### 3.5 Change History Comments

```python
# NG: Change history inside a file (a role Git should play)
# Change history:
# 2024-01-01 Tanaka: Initial version
# 2024-02-15 Sato: Added validation
# 2024-03-20 Suzuki: Performance improvement
# 2024-04-10 Tanaka: Bug fix (#1234)

# Alternative: Use Git commands to check history
# → git log --oneline -- path/to/file.py
# → git blame path/to/file.py
# → git log --author="Tanaka" -- path/to/file.py
```

### 3.6 Section Divider Comments

```python
# NG: Using comments to divide structure (a sign of God Class)
class UserService:
    ##################################
    # User-related processing
    ##################################
    def create_user(self): ...
    def update_user(self): ...
    def delete_user(self): ...

    ##################################
    # Authentication-related processing
    ##################################
    def login(self): ...
    def logout(self): ...

    ##################################
    # Notification-related processing
    ##################################
    def send_email(self): ...
    def send_sms(self): ...

# OK: Separate responsibilities into classes or modules
class UserService:
    def create_user(self): ...
    def update_user(self): ...

class AuthService:
    def login(self): ...
    def logout(self): ...

class NotificationService:
    def send_email(self): ...
    def send_sms(self): ...
```

The very need for section divider comments is a code smell indicating that the class or function is too large. See [Code Smells](../02-refactoring/00-code-smells.md) for details.

### 3.7 Noise Comments

Comments written out of a sense of obligation to write something, even when the code is self-evident. When a documentation tool requires "all public methods must have a docstring," it often results in mass-produced meaningless docstrings.

```python
# NG: Noise comments
class User:
    def __init__(self):
        """Default constructor"""  # adds no information
        pass

    def get_name(self) -> str:
        """Get the name"""  # same as the method name
        return self.name

    def set_name(self, name: str) -> None:
        """Set the name"""  # same as the method name
        self.name = name

    def is_active(self) -> bool:
        """Returns whether the user is active"""  # translation of the method name
        return self.status == Status.ACTIVE
```

---

## 4. Converting to Self-Documenting Code

Self-Documenting Code is code whose intent is clear without comments. Robert C. Martin says: "Before writing a comment, ask whether you can improve the code to make the comment unnecessary." This section explains concrete techniques for converting comment-dependent code into self-documenting code.

### 4.1 List of Conversion Techniques

| Technique | Description | Effect |
|-----------|------|------|
| Extract Method | Extract a commented block into a function | The comment becomes the function name |
| Rename | Change to a name that better conveys intent | The comment becomes unnecessary |
| Introduce Constant | Give a name to a magic number | The meaning of the value becomes self-evident |
| Introduce Explaining Variable | Give a name to a complex expression | The meaning of intermediate results becomes clear |
| Replace Conditional with Guard Clause | Use early returns to reduce nesting | The intent of the condition becomes clear |
| Replace Conditional with Polymorphism | Replace conditionals with polymorphism | Type-based dispatch becomes self-evident |
| Replace Type Code with Class | Replace string/numeric codes with a class | Domain concepts are expressed as types |
| Introduce Parameter Object | Group related parameters into an object | The relationship between parameters becomes clear |

### 4.2 Before / After Comparison Table

| Before (comment-dependent) | After (self-documenting) |
|----------------------|-------------------|
| `# Check if 18 or older` `if age >= 18:` | `if user.is_adult():` |
| `# Calculate price with tax` `p * 1.10` | `calculate_price_with_tax(price)` |
| `# Active users only` `if s == 1:` | `if user.status == Status.ACTIVE:` |
| `# Lock after 5 failures` `if c >= 5:` | `if login_attempts >= MAX_ATTEMPTS:` |
| `# Logged in within 30 days` `if d <= 30:` | `if user.is_recently_active():` |
| `# Total over 10,000` `if t >= 10000:` | `if order.qualifies_for_free_shipping():` |
| `# Check email format` `if re.match(...)` | `if Email.is_valid(address):` |
| `# Business days only` `if w not in [5, 6]:` | `if date.is_business_day():` |

### 4.3 Self-Documenting Code via Extract Method

**Code Example 11: Converting comment blocks into functions**

```python
# BEFORE: Comments explain each section
def process_order(order: Order) -> OrderResult:
    # Validation
    if not order.items:
        raise ValidationError("No items selected")
    if not order.customer_id:
        raise ValidationError("No customer information")
    for item in order.items:
        if item.quantity <= 0:
            raise ValidationError(f"Invalid quantity: {item.name}")

    # Calculate total
    subtotal = sum(item.price * item.quantity for item in order.items)
    tax = subtotal * Decimal("0.10")
    shipping = Decimal("500") if subtotal < Decimal("5000") else Decimal("0")
    total = subtotal + tax + shipping

    # Save
    order.total = total
    db.save(order)

    # Notify
    email_service.send_confirmation(order)

    return OrderResult.success(order)


# AFTER: Function names replace the comments
def process_order(order: Order) -> OrderResult:
    validate_order(order)
    pricing = calculate_order_pricing(order)
    saved_order = save_order(order, pricing)
    send_order_confirmation(saved_order)
    return OrderResult.success(saved_order)

def validate_order(order: Order) -> None:
    """Validates the order inputs."""
    if not order.items:
        raise ValidationError("No items selected")
    if not order.customer_id:
        raise ValidationError("No customer information")
    for item in order.items:
        if item.quantity <= 0:
            raise ValidationError(f"Invalid quantity: {item.name}")

def calculate_order_pricing(order: Order) -> OrderPricing:
    """Calculates pricing information for the order."""
    subtotal = sum(item.price * item.quantity for item in order.items)
    tax = subtotal * TAX_RATE
    shipping = calculate_shipping_fee(subtotal)
    return OrderPricing(subtotal=subtotal, tax=tax, shipping=shipping)

FREE_SHIPPING_THRESHOLD = Decimal("5000")
STANDARD_SHIPPING_FEE = Decimal("500")

def calculate_shipping_fee(subtotal: Decimal) -> Decimal:
    """Calculates the shipping fee based on the subtotal."""
    if subtotal >= FREE_SHIPPING_THRESHOLD:
        return Decimal("0")
    return STANDARD_SHIPPING_FEE
```

### 4.4 Eliminating Magic Numbers by Introducing Constants

**Code Example 12: Introduce Constant**

```python
# BEFORE: Comments on magic numbers
def check_password(password: str) -> bool:
    if len(password) < 8:      # minimum length
        return False
    if len(password) > 128:    # maximum length
        return False
    if not re.search(r'[A-Z]', password):  # uppercase required
        return False
    if not re.search(r'[0-9]', password):  # digit required
        return False
    return True


# AFTER: Constant names explain themselves
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
UPPERCASE_PATTERN = re.compile(r'[A-Z]')
DIGIT_PATTERN = re.compile(r'[0-9]')

def check_password(password: str) -> bool:
    if len(password) < MIN_PASSWORD_LENGTH:
        return False
    if len(password) > MAX_PASSWORD_LENGTH:
        return False
    if not UPPERCASE_PATTERN.search(password):
        return False
    if not DIGIT_PATTERN.search(password):
        return False
    return True
```

### 4.5 Introducing Explaining Variables

**Code Example 13: Introduce Explaining Variable**

```python
# BEFORE: Comments explain complex conditions
def should_send_reminder(user: User, order: Order) -> bool:
    # Send reminder to premium-or-above active users
    # who haven't ordered in over 30 days
    # and have notifications enabled
    return (user.tier in ('premium', 'enterprise')
            and user.status == 'active'
            and (datetime.now() - order.last_order_date).days > 30
            and user.notification_enabled)


# AFTER: Explaining variables express the intent of conditions
INACTIVITY_THRESHOLD_DAYS = 30

def should_send_reminder(user: User, order: Order) -> bool:
    is_high_tier_user = user.tier in ('premium', 'enterprise')
    is_active = user.status == 'active'
    days_since_last_order = (datetime.now() - order.last_order_date).days
    is_inactive_buyer = days_since_last_order > INACTIVITY_THRESHOLD_DAYS
    accepts_notifications = user.notification_enabled

    return (is_high_tier_user
            and is_active
            and is_inactive_buyer
            and accepts_notifications)
```

### 4.6 Self-Documenting Code via the Type System

Types are "comments verified by the compiler." Constraints expressed in types never go stale unlike comments, and they are also leveraged by IDE auto-completion and error detection.

**Code Example 14: Expressing intent through types**

```python
# BEFORE: Comments supplement the meaning of types
def create_user(
    name: str,       # username (2-50 characters)
    email: str,      # email address (RFC 5322 compliant)
    age: int,        # age (0-150)
    role: str,       # role ("admin", "user", "viewer")
) -> dict:           # user info dictionary
    pass


# AFTER: Types serve as documentation
class UserName:
    """Value object representing a username of 2-50 characters."""
    def __init__(self, value: str):
        if not (2 <= len(value) <= 50):
            raise ValueError(f"Username must be 2-50 characters: {len(value)} characters")
        self.value = value

class Email:
    """Value object representing an RFC 5322 compliant email address."""
    def __init__(self, value: str):
        if not EMAIL_PATTERN.match(value):
            raise ValueError(f"Invalid email address: {value}")
        self.value = value

class Age:
    """Value object representing an age from 0 to 150."""
    def __init__(self, value: int):
        if not (0 <= value <= 150):
            raise ValueError(f"Invalid age: {value}")
        self.value = value

class Role(Enum):
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"

@dataclass
class User:
    name: UserName
    email: Email
    age: Age
    role: Role

def create_user(name: UserName, email: Email, age: Age, role: Role) -> User:
    # No comment needed — the types say it all
    return User(name=name, email=email, age=age, role=role)
```

### 4.7 Self-Documenting Code via Guard Clauses (Early Return)

**Code Example 15: Flattening nested conditionals with guard clauses**

```python
# BEFORE: Deep nesting + comments explain conditions
def calculate_discount(order: Order) -> Decimal:
    # No discount if order is empty
    if order.items:
        # For premium members
        if order.customer.is_premium:
            # 15% discount for totals over 10,000
            if order.total >= 10000:
                return order.total * Decimal("0.15")
            # Otherwise 10% discount
            else:
                return order.total * Decimal("0.10")
        # For regular members
        else:
            # 5% discount for totals over 10,000
            if order.total >= 10000:
                return order.total * Decimal("0.05")
    return Decimal("0")


# AFTER: Guard clauses + meaningful constants make intent obvious
PREMIUM_HIGH_DISCOUNT_RATE = Decimal("0.15")
PREMIUM_BASE_DISCOUNT_RATE = Decimal("0.10")
STANDARD_DISCOUNT_RATE = Decimal("0.05")
DISCOUNT_THRESHOLD = Decimal("10000")

def calculate_discount(order: Order) -> Decimal:
    if not order.items:
        return Decimal("0")

    if not order.customer.is_premium:
        if order.total >= DISCOUNT_THRESHOLD:
            return order.total * STANDARD_DISCOUNT_RATE
        return Decimal("0")

    if order.total >= DISCOUNT_THRESHOLD:
        return order.total * PREMIUM_HIGH_DISCOUNT_RATE
    return order.total * PREMIUM_BASE_DISCOUNT_RATE
```

---

## 5. Documentation Comments

Documentation comments are the "contract" for public APIs. They provide information that lets users use the API correctly without reading the implementation. Unlike comments in internal implementation, documentation comments must include a *What* (what it does) explanation.

### 5.1 Structure

```
  Structure of Documentation Comments

  ┌─────────────────────────────────────────┐
  │ Line 1: One-line summary of what it does (required) │
  │                                         │
  │ Detailed description (if needed)        │
  │                                         │
  │ Args/Parameters: (if there are args)    │
  │   Parameter descriptions                │
  │                                         │
  │ Returns: (if there is a return value)   │
  │   Description of the return value       │
  │                                         │
  │ Raises/Throws: (if there are exceptions)│
  │   Description of exceptions that occur  │
  │                                         │
  │ Examples: (optional but recommended)    │
  │   Usage examples                        │
  │                                         │
  │ Notes: (optional)                       │
  │   Caveats, constraints                  │
  │                                         │
  │ See Also: (optional)                    │
  │   References to related functions/classes │
  └─────────────────────────────────────────┘
```

### 5.2 Python Docstring (Google Style)

**Code Example 16: A complete documentation comment**

```python
def transfer_funds(
    source: Account,
    destination: Account,
    amount: Decimal,
    currency: Currency = Currency.JPY
) -> TransferReceipt:
    """Transfer the specified amount from the source account to the destination account.

    Executes an immediate transfer between accounts in the same currency.
    Cross-currency transfers are not supported (raises CurrencyMismatchError).

    Runs at transaction isolation level SERIALIZABLE.
    The caller is responsible for retrying on network failures.

    Args:
        source: The source account. Must have a balance of at least amount.
        destination: The destination account. Must not be frozen.
        amount: The transfer amount. Must be a positive number.
        currency: The currency. Defaults to Japanese Yen.

    Returns:
        TransferReceipt: A receipt containing the transaction ID and timestamp.

    Raises:
        InsufficientBalanceError: The source account has insufficient balance.
        AccountFrozenError: Either account is frozen.
        CurrencyMismatchError: The account currency does not match the specified currency.
        ValueError: If amount is zero or negative.

    Example:
        >>> receipt = transfer_funds(account_a, account_b, Decimal('10000'))
        >>> print(receipt.transaction_id)
        'TXN-20240101-001'
        >>> print(receipt.timestamp)
        datetime(2024, 1, 1, 12, 0, 0)

    Note:
        Transferring between the same account raises InsufficientBalanceError.
        This is a constraint imposed by business rules.

    See Also:
        - `Account.withdraw`: Withdrawing from an account
        - `Account.deposit`: Depositing into an account
        - `TransferReceipt`: Receipt details
    """
```

### 5.3 Java Javadoc

```java
/**
 * Updates the stock count for a product.
 *
 * <p>Stock updates use optimistic locking for concurrency control.
 * If a concurrent update is detected, {@link OptimisticLockException} is thrown.</p>
 *
 * <p>Updates that would result in a stock count of zero or less are rejected by business rules.</p>
 *
 * @param productId Product ID (must not be null)
 * @param delta     Stock change amount (positive: incoming, negative: outgoing)
 * @return The updated stock count
 * @throws ProductNotFoundException If the product ID does not exist
 * @throws InsufficientStockException If there is insufficient stock for the outgoing quantity
 * @throws OptimisticLockException If a concurrent update is detected
 * @since 2.0
 * @see Product#getStockCount()
 */
public int updateStock(String productId, int delta) {
    // ...
}
```

### 5.4 TypeScript TSDoc

```typescript
/**
 * Verifies a user's authentication token.
 *
 * @remarks
 * Performs JWT signature verification, expiration check, and revocation check.
 * Returns the decoded payload if the token is valid.
 *
 * @param token - Authentication token in JWT format
 * @param options - Verification options
 * @returns The decoded token payload
 * @throws {@link TokenExpiredError} If the token has expired
 * @throws {@link InvalidSignatureError} If the signature is invalid
 * @throws {@link RevokedTokenError} If the token has been revoked
 *
 * @example
 * ```typescript
 * const payload = await verifyToken("eyJhbGci...", {
 *   audience: "my-app",
 *   issuer: "auth-server",
 * });
 * console.log(payload.userId); // "user-123"
 * ```
 */
async function verifyToken(
  token: string,
  options?: VerifyOptions
): Promise<TokenPayload> {
  // ...
}
```

### 5.5 Documentation Comment Comparison by Language

| Language | Format | Tool | Characteristics |
|------|------|--------|------|
| Python | docstring (Google/NumPy/Sphinx) | Sphinx, pydoc | Choose from three major styles |
| Java | Javadoc (`/** ... */`) | javadoc | Can use HTML tags |
| TypeScript | TSDoc / JSDoc | TypeDoc | `@remarks` for detailed explanation |
| Rust | `///` (doc comments) | rustdoc | Markdown + embedded tests |
| Go | `//` (first line is the package name) | godoc | Simple plain text |
| C# | XML comments (`///`) | Sandcastle, DocFX | Structured XML |
| Kotlin | KDoc (`/** ... */`) | Dokka | Kotlin version of Javadoc |
| Swift | `///` (Markup) | jazzy | Markdown-based |

### 5.6 Docstring Style Comparison (Python)

```python
# ----- Google Style -----
def connect(host: str, port: int, timeout: float = 30.0) -> Connection:
    """Connect to the server.

    Args:
        host: Server hostname or IP address.
        port: Port number (1-65535).
        timeout: Connection timeout in seconds.

    Returns:
        The established connection object.

    Raises:
        ConnectionError: If the connection fails.
    """

# ----- NumPy Style -----
def connect(host: str, port: int, timeout: float = 30.0) -> Connection:
    """Connect to the server.

    Parameters
    ----------
    host : str
        Server hostname or IP address.
    port : int
        Port number (1-65535).
    timeout : float, optional
        Connection timeout in seconds. Default is 30.0.

    Returns
    -------
    Connection
        The established connection object.

    Raises
    ------
    ConnectionError
        If the connection fails.
    """

# ----- reStructuredText (Sphinx) Style -----
def connect(host: str, port: int, timeout: float = 30.0) -> Connection:
    """Connect to the server.

    :param host: Server hostname or IP address.
    :param port: Port number (1-65535).
    :param timeout: Connection timeout in seconds.
    :returns: The established connection object.
    :raises ConnectionError: If the connection fails.
    """
```

| Style | Readability | Tool support | Recommended use |
|---------|--------|-----------|---------|
| Google | High | Sphinx (napoleon) | General projects |
| NumPy | Medium | Sphinx (napoleon) | Scientific computing, data analysis |
| Sphinx reST | Low | Sphinx (native) | Projects that use Sphinx heavily |

---

## 6. Comment Language Choice and Team Policy

### 6.1 Criteria for Choosing Comment Language

| Situation | Recommended language | Reason |
|------|---------|------|
| Japanese team / domestic project | Japanese | Higher efficiency for reading and writing |
| Global team | English | Common language everyone can read |
| OSS project | English | Assumes international contributors |
| Legal comments | Project language | Comply with legal requirements |
| Japanese team but may become OSS | English | Avoid switching costs later |

**Important principle: Do not mix languages within the same project.** Mixed language often occurs when external library code is copied in-house or when team members change.

### 6.2 Comment Policy Template

```markdown
# Comment Policy (Template)

## Basic Guidelines
- Comment language: English
- Prioritize expressing intent in code above all else
- Actively write Why comments
- What comments are generally unnecessary

## Required Comments
- Documentation comments for public APIs (Google style)
- License header (SPDX format)
- Explanations of complex algorithms
- Reasons behind non-obvious design decisions

## Prohibited Comments
- Direct translation comments (paraphrasing the code)
- Commented-out code (use Git instead)
- Personal information (individual names)
- Change history within files

## TODO Comments
- Format: `# TODO(#<issue_number>): <description>`
- Linking to the issue tracker is mandatory
- Review all TODOs every quarter
- Monitor TODO count in CI (warn when threshold is exceeded)

## Documentation Comments
- public methods/classes: required
- protected methods: recommended
- private methods: only when intent is unclear from the name
- Style: Google style
```

### 6.3 Introducing Automated Checks

```yaml
# .github/workflows/comment-check.yml
name: Comment Quality Check

on: pull_request

jobs:
  check-comments:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for commented-out code blocks
        run: |
          # Detect 3 or more consecutive lines of commented-out code
          python -c "
          import re, sys, pathlib
          pattern = re.compile(r'(^\s*#\s*(if|for|def|class|return|import|from)\b.*\n){3,}', re.MULTILINE)
          found = False
          for f in pathlib.Path('src').rglob('*.py'):
              text = f.read_text()
              if pattern.search(text):
                  print(f'WARNING: Possible commented-out code in {f}')
                  found = True
          sys.exit(1 if found else 0)
          "

      - name: Check TODO format
        run: |
          # Detect TODOs without an issue number
          if grep -rn 'TODO[^(]' --include="*.py" --include="*.ts" src/; then
            echo "ERROR: TODO without issue number found"
            echo "Required format: TODO(#<issue_number>): <description>"
            exit 1
          fi

      - name: Count TODOs
        run: |
          count=$(grep -rn 'TODO' --include="*.py" src/ | wc -l)
          echo "Current TODO count: $count"
          if [ "$count" -gt 50 ]; then
            echo "WARNING: TODO count exceeds threshold (50)"
          fi
```

---

## 7. Advanced Techniques — Refactoring Comments

### 7.1 Pattern for Converting Comments to Functions

Code that uses comments to divide sections is a prime candidate for Extract Method. The comment content becomes the function name directly.

```python
# Pattern 1: Section comment → Extract function
# BEFORE
def process_data(raw_data):
    # Cleanse the data
    data = raw_data.strip()
    data = data.replace('\n', ' ')
    data = re.sub(r'\s+', ' ', data)

    # Transform the data
    parts = data.split(',')
    result = [int(p) for p in parts if p.isdigit()]

    # Validate the data
    if not result:
        raise ValueError("No valid data")
    if max(result) > 1000000:
        raise ValueError("Value out of range")

    return result

# AFTER: Comments have become function names
def process_data(raw_data: str) -> list[int]:
    cleaned = cleanse_whitespace(raw_data)
    integers = extract_integers(cleaned)
    validate_integer_range(integers)
    return integers

def cleanse_whitespace(raw_data: str) -> str:
    """Normalizes whitespace characters."""
    data = raw_data.strip()
    data = data.replace('\n', ' ')
    return re.sub(r'\s+', ' ', data)

def extract_integers(data: str) -> list[int]:
    """Extracts integers from a comma-separated string."""
    parts = data.split(',')
    return [int(p) for p in parts if p.isdigit()]

MAX_VALUE = 1_000_000

def validate_integer_range(data: list[int]) -> None:
    """Validates that the integer list is non-empty and within range."""
    if not data:
        raise ValueError("No valid data")
    if max(data) > MAX_VALUE:
        raise ValueError(f"Value out of range (max: {MAX_VALUE})")
```

### 7.2 Measuring and Managing Comment Density

```
Comment Density Guidelines
────────────────────────────────────
  Comment density = comment lines / total lines * 100

  0-5%:   Possibly too few comments
          → Check whether public APIs have documentation

  5-15%:  Appropriate range
          → Good if centered on Why comments

  15-25%: Somewhat high
          → Check whether What comments are dominant

  25%+:   Excessive comments
          → The code itself needs readability improvements
────────────────────────────────────
Note: Comment density is not an absolute metric.
The appropriate value varies with the nature of the code (algorithms, business rules).
Files with many regular expressions will naturally have higher density.
```

### 7.3 Mechanisms to Prevent Comment "Rot"

Comments "rot" over time. Code is updated but comments are not, and eventually inconsistencies with the code (lying comments) emerge. Here are mechanisms to prevent this.

```
Preventing Comment Rot
────────────────────────────────────

1. Verification during code review
   - Confirm that related comments are updated when code changes
   - Include "comment consistency" in the review checklist

2. Testable documentation
   - Python: Embed Examples in doctest for execution as tests
   - Rust: Compile and run tests from doc tests
   - TypeScript: Link tsdoc @example to actual test code

3. Automated checks
   - Verify in CI that TODO issue numbers are not closed
   - Verify that parameter names in documentation match those in code
   - Regular reviews (review all TODOs/FIXMEs every quarter)

4. Design to reduce comments
   - Eliminate the root cause (complex code) that makes comments necessary
   - Advance self-documentation through the type system, naming, and structure
────────────────────────────────────
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Hiding Design Flaws with Comments

```java
// NG: Explaining complex logic with comments
// If status is 1 (active), and type is 3 (premium) or
// type is 4 (enterprise), and last login was within 30 days
if (user.status == 1 && (user.type == 3 || user.type == 4)
    && daysSince(user.lastLogin) <= 30) {
    // ...
}

// OK: The code itself conveys the intent
if (user.isActive() && user.isPremiumOrAbove() && user.isRecentlyActive()) {
    // ...
}
```

**Why this is bad:** A comment is a confession that "this code is hard to read." The code itself should be improved first. Code that requires a comment to explain it is a sign of a design problem.

**Fix:** Improve the readability of the code itself through refactoring techniques like Extract Method, Rename, and Introduce Constant. Then supplement only the "why" that still cannot be conveyed.

### Anti-Pattern 2: Managing Change History with Comments

```python
# NG: Change history inside a file
# Change history:
# 2024-01-01 Tanaka: Initial version
# 2024-02-15 Sato: Added validation
# → This is a role that version control (Git) should play
```

**Why this is bad:** Using comments to substitute for a role that Git should play. Information is being managed in duplicate, and it is only a matter of time before the comment falls out of date. Git accurately records who, when, what, and why something was changed, and it is impossible to achieve more information than that with comments.

### Anti-Pattern 3: Omitting API Documentation

```python
# NG: No documentation on a public API
def search(q, opts=None):
    pass

# OK: Documentation comments are required for public APIs
def search(
    query: str,
    options: SearchOptions | None = None,
) -> SearchResult:
    """Execute a full-text search.

    Runs a query against the Elasticsearch index and returns
    results sorted by relevance.

    Args:
        query: The search query string. Supports Lucene query syntax.
        options: Search options (pagination, filters, etc.).

    Returns:
        SearchResult: The hit count and list of search results.

    Raises:
        InvalidQueryError: If the query syntax is invalid.
        SearchTimeoutError: If the search times out (default 30 seconds).
    """
```

**Why this is bad:** A public API is a "contract." Users should be able to use it correctly without reading the implementation. Without documentation comments, users are forced to read the implementation or resort to trial and error.

### Anti-Pattern 4: Neglecting Comments (Rot)

```python
# NG: Stale comments left in place
# Maximum 3 retries
MAX_RETRIES = 5  # value changed to 5 but comment not updated

# Calculate monthly fee (8% consumption tax)
def calculate_monthly_fee(base_price: int) -> int:
    return int(base_price * 1.10)  # tax rate already changed to 10%

# OK: Improve the code so comments are unnecessary
MAX_RETRIES = 5  # no comment needed (constant name is self-evident)

TAX_RATE = Decimal("1.10")

def calculate_monthly_fee_with_tax(base_price: int) -> int:
    return int(base_price * TAX_RATE)
```

**Why this is bad:** A lying comment is worse than having no comment at all. It leads readers in the wrong direction and causes bugs.

---

## 9. Practice Exercises

### Exercise 1 (Basic): Removing Bad Comments

Remove the bad comments from the following code and keep only the necessary ones.

```python
# User service class
class UserService:
    # Constructor
    def __init__(self, repo, mailer):
        # Set the repository
        self.repo = repo
        # Set the mailer
        self.mailer = mailer

    # Create a user
    def create_user(self, name, email):
        # Name validation
        if not name:
            # Error if name is empty
            raise ValueError("Name is required")
        # Email validation
        if not email:
            # Error if email is empty
            raise ValueError("Email is required")

        # Create user object
        user = User(name=name, email=email)
        # Save to database
        self.repo.save(user)
        # Send confirmation email
        # * Even if email sending fails, user creation is considered successful
        # * Should be async, but current infrastructure only supports sync
        try:
            self.mailer.send_welcome(email)
        except MailError:
            pass  # TODO: log this
        # Return the user
        return user
```

**Expected output:**

```python
class UserService:
    def __init__(self, repo: UserRepository, mailer: Mailer):
        self.repo = repo
        self.mailer = mailer

    def create_user(self, name: str, email: str) -> User:
        if not name:
            raise ValueError("Name is required")
        if not email:
            raise ValueError("Email is required")

        user = User(name=name, email=email)
        self.repo.save(user)

        # Email sending failure does not affect user creation success.
        # Reason: Welcome emails can be resent, and there is no need to
        # roll back the user creation transaction.
        # TODO(#567): Migrate to async email sending (pending infrastructure support)
        try:
            self.mailer.send_welcome(email)
        except MailError:
            logger.warning(f"Failed to send welcome email: {email}")

        return user
```

**Explanation:** All removed comments were What comments (repeating the code). What was kept is the Why comment (why the exception is swallowed on email failure) and the TODO linked to an Issue.

### Exercise 2 (Applied): Refactoring to Self-Documenting Code

Refactor the following comment-dependent code so the intent is clear without comments.

```python
def calc(data):
    result = []
    for item in data:
        # Check if not expired
        if item['exp'] >= datetime.now():
            # Check if status is active
            if item['st'] == 1:
                # Multiply amount by tax rate
                amount = item['amt'] * 1.10
                # Apply 5% discount for members
                if item['mbr']:
                    amount = amount * 0.95
                # Append to result
                result.append({
                    'id': item['id'],
                    'total': amount,
                    'name': item['nm']
                })
    return result
```

**Expected output:**

```python
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

TAX_RATE = Decimal("1.10")
MEMBER_DISCOUNT_RATE = Decimal("0.95")

@dataclass
class Item:
    id: str
    name: str
    amount: Decimal
    is_active: bool
    expiry_date: datetime
    is_member: bool

    def is_expired(self) -> bool:
        return self.expiry_date < datetime.now()

@dataclass
class PricedItem:
    id: str
    name: str
    total: Decimal

def calculate_priced_items(items: list[Item]) -> list[PricedItem]:
    return [
        price_item(item)
        for item in items
        if is_eligible(item)
    ]

def is_eligible(item: Item) -> bool:
    return not item.is_expired() and item.is_active

def price_item(item: Item) -> PricedItem:
    total = apply_tax(item.amount)
    if item.is_member:
        total = apply_member_discount(total)
    return PricedItem(id=item.id, name=item.name, total=total)

def apply_tax(amount: Decimal) -> Decimal:
    return amount * TAX_RATE

def apply_member_discount(amount: Decimal) -> Decimal:
    return amount * MEMBER_DISCOUNT_RATE
```

**Explanation:** The following transformations were applied. (1) Abbreviated variable names changed to meaningful names (Rename). (2) Magic numbers extracted as constants (Introduce Constant). (3) Dictionaries converted to dataclasses (Replace Type Code with Class). (4) Condition checks extracted into functions (Extract Method). (5) Nesting flattened using list comprehension.

### Exercise 3 (Advanced): Designing Documentation Comments

Design complete documentation comments for the following class. Use Google style Python docstrings.

```python
class CacheManager:
    def __init__(self, max_size, ttl_seconds, eviction_policy):
        self._store = {}
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._policy = eviction_policy

    def get(self, key):
        pass

    def set(self, key, value, ttl=None):
        pass

    def invalidate(self, key):
        pass

    def clear(self):
        pass

    def stats(self):
        pass
```

**Expected output:**

```python
class CacheManager:
    """In-memory cache manager.

    Provides a key-value cache with TTL (time-to-live) support.
    When the maximum size is reached, entries are evicted based
    on the specified eviction policy.

    Not thread-safe. In multi-threaded environments, apply external
    mutual exclusion or use ThreadSafeCacheManager instead.

    Attributes:
        max_size: Maximum number of cache entries.
        ttl_seconds: Default TTL in seconds. 0 means no expiration.
        eviction_policy: Eviction policy ("lru", "lfu", "fifo").

    Example:
        >>> cache = CacheManager(max_size=1000, ttl_seconds=300,
        ...                      eviction_policy="lru")
        >>> cache.set("user:123", {"name": "Alice"})
        >>> user = cache.get("user:123")
        >>> print(user)
        {"name": "Alice"}
        >>> print(cache.stats())
        CacheStats(hits=1, misses=0, size=1, hit_rate=1.0)
    """

    def get(self, key: str) -> Any | None:
        """Retrieve the value associated with the key.

        Entries whose TTL has expired return None and are removed internally.

        Args:
            key: The cache key.

        Returns:
            The cached value, or None if the key does not exist or has expired.
        """

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Store a key-value pair in the cache.

        If the cache has reached max_size, one existing entry is evicted
        based on the eviction_policy before storing the new entry.

        Args:
            key: The cache key.
            value: The value to store. Must be serializable.
            ttl: TTL for this entry in seconds. Uses the default TTL if None.

        Raises:
            ValueError: If ttl is a negative number.
        """

    def invalidate(self, key: str) -> bool:
        """Invalidate (delete) the entry for the specified key.

        Args:
            key: The cache key to invalidate.

        Returns:
            True if the key existed and was deleted; False if the key did not exist.
        """

    def clear(self) -> None:
        """Delete all cache entries.

        Statistics are also reset.
        """

    def stats(self) -> CacheStats:
        """Retrieve cache statistics.

        Returns:
            CacheStats: Statistics including hit count, miss count, current size, and hit rate.
        """
```

**Explanation:** Key points are as follows. (1) The class-level docstring explains the overall picture, constraints, and usage examples. (2) Each method's docstring specifies arguments, return values, and exceptions. (3) Thread safety warnings are included. (4) Behaviors not apparent from the return value alone, such as what happens when TTL expires, are explained.

---

## 10. FAQ

### Q1: Should comments be written in English or Japanese?

Match the common language of the team. Japanese comments are fine for Japanese teams. However, English is required for OSS or global teams. **The key is consistency.** Do not mix languages within the same project.

In practice, the following criteria are recommended:
- **Domestic team, internal project**: Japanese
- **Project with potential for external release**: English
- **Documentation comments (public API)**: Same as the project language
- **Inline comments**: Common language of the team

### Q2: How should TODO comments be managed?

Manage TODO comments by **linking them to an issue tracker**. Include the issue number in the format `TODO(#1234): ~` and review all TODOs regularly. Abandoned TODOs become technical debt, so monitoring the TODO count in CI/CD is also effective.

Specific management rules:
1. **On creation**: File an Issue and include the issue number in the comment
2. **Weekly**: Check the list with `grep -rn "TODO" src/`
3. **Quarterly**: Review all TODOs and delete unnecessary ones
4. **CI**: Automatically detect and warn about TODOs for closed Issues

### Q3: How thoroughly should API documentation comments be written?

**Required for public APIs**. Include:
- What it does (one-line summary)
- Meaning and constraints of parameters
- Type and meaning of the return value
- Exceptions/errors that can occur
- Usage examples (for complex cases)

For private methods, omission is acceptable if intent is clear from the name. However, documentation is recommended even for `private` methods in the following cases:
- Complex algorithms
- Non-obvious side effects
- High likelihood of being modified by other developers

### Q4: Is it acceptable to temporarily leave commented-out code?

**No, in principle.** Git history allows restoration. However, it is acceptable in the following limited cases:
- **On a debugging branch**: Must be deleted before merging to the main branch
- **During A/B testing**: Always create a ticket to delete after the test period ends

In either case, the review should verify that no commented-out code remains before merging.

### Q5: What if comment conventions are not unified across the team?

Proceed with rule-setting in the following order:
1. **Create a comment policy document**: Discuss and agree as a team using the template above
2. **Introduce a linter**: Automatically check for the presence of documentation using pylint, ESLint, etc.
3. **Add to code review standards**: Check comment quality during reviews too
4. **Provide templates**: Prepare IDE snippets or templates

### Q6: What if I am unsure whether a comment is "good" or "bad"?

Use these three questions to decide:
1. **"Would removing this comment lose information?"** → If No, the comment is unnecessary
2. **"Can the code be improved to make this comment unnecessary?"** → If Yes, improve the code first
3. **"Does this comment explain *Why*?"** → If Yes, the comment has value

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important. Understanding deepens not just from theory but from actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping fundamentals and jumping to advanced topics. We recommend solidly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

### Comment Classification and Decision Table

| Type | Should you write it? | Example | Decision criteria |
|------|-----------|-----|---------|
| Why | Write it | Business rule context, technical reasons | Information not readable from the code |
| What | Generally not needed | Direct translation of code | The code itself should convey this |
| How | Only for algorithms | Complex regex, mathematical processing | When the implementation intent is unclear |
| Warning/Caution | Write it | Thread safety, performance | Important information for future developers |
| TODO/FIXME | Link to an Issue | Specify deadline and owner | Managed improvement plans |
| License | Required | Legal requirements | Legally required |
| Documentation | Required for public APIs | Args, return values, exceptions | Contract with users |

### Self-Documenting Code Conversion Technique Table

| Technique | Comment-dependent code | Self-documenting code |
|-----------|-------------------|----------------|
| Extract Method | Commented blocks | Split into meaningfully named functions |
| Rename | `x = x + 1 # increment` | `retry_count += 1` |
| Introduce Constant | `if d <= 30: # within 30 days` | `if days <= ACTIVE_PERIOD` |
| Explaining Variable | `if a && b && c: # condition explanation` | `if is_eligible:` |
| Type system | `s: str # email address` | `email: Email` |
| Guard clause | Deep nesting + comments | Flattened with early returns |

### Comment Quality Checklist

```
Comment Review Checklist
────────────────────────────────────
□ No What comments (repeating the code)
□ Why comments written where appropriate
□ Comments and code are consistent (no lying comments)
□ No commented-out code
□ TODOs linked to Issue numbers
□ Public APIs have documentation comments
□ Warning comments (thread safety, etc.) not missing
□ Magic numbers extracted as constants
□ Comment language is consistent throughout the project
□ No personal information (individual names) included
────────────────────────────────────
```

---

## Guides to Read Next

- [Naming Conventions](./00-naming.md) — The first step to writing comment-free code. Good naming drastically reduces the need for comments
- [Function Design](./01-functions.md) — How to achieve self-documenting code with Extract Method
- Class Design — Self-documentation and clear responsibility at the class level
- [Testing Principles](./04-testing-principles.md) — Comments and documentation in test code
- [Code Smells](../02-refactoring/00-code-smells.md) — Section divider comments are a sign of God Class
- [Refactoring Techniques](../02-refactoring/01-refactoring-techniques.md) — Techniques for improving comment-dependent code
- [Code Review Checklist](../03-practices-advanced/04-code-review-checklist.md) — Review perspectives and quality standards for comments

---

## References

1. **Robert C. Martin** *Clean Code: A Handbook of Agile Software Craftsmanship*, Prentice Hall, 2008 (Chapter 4: Comments) — The canonical source for comment principles. Explains the background behind the provocative thesis "comments always lie"
2. **Dustin Boswell, Trevor Foucher** *The Art of Readable Code*, O'Reilly Media, 2011 (Part II: Simplifying Loops and Logic) — Practical techniques for improving readability. Clear distinction between the uses of What/Why/How
3. **Kevlin Henney** "Comment Only What the Code Cannot Say," *97 Things Every Programmer Should Know*, O'Reilly Media, 2010 — A famous essay that captures the essence of comments in one sentence
4. **Steve McConnell** *Code Complete*, Microsoft Press, 2004 (2nd Edition, Chapter 32: Self-Documenting Code) — Systematic explanation of self-documenting code. Shows the relationship between comment density and quality in numbers
5. **Martin Fowler** *Refactoring: Improving the Design of Existing Code*, Addison-Wesley, 2018 — Techniques for making comments unnecessary through refactoring such as Extract Method
