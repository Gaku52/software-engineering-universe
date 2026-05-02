# Naming Conventions ── The Art of Naming Variables, Functions, and Classes

> Code is read ten times more often than it is written. A good name is the best documentation; a bad name is the worst form of technical debt. Naming is one of the most important and most difficult skills in programming.

---

## What You Will Learn in This Chapter

1. **Core Principles of Naming** ── Understand how to choose names that clearly communicate intent
2. **Naming Rules by Element** ── Master naming patterns for variables, functions, classes, and constants
3. **Naming Anti-Patterns** ── Recognize naming habits to avoid and how to improve them
4. **Naming from a Cognitive Science Perspective** ── Understand what makes a good name from the standpoint of human memory and cognition
5. **Naming Strategies for Team Development** ── Learn how to establish and automatically enforce naming conventions

---

## Prerequisites

To get the most out of this guide, you should have the following knowledge.

| Prerequisite | Required Level | Reference |
|---------|----------|--------|
| Overview of Clean Code | Recommended to read first | [Clean Code Overview](../00-principles/00-clean-code-overview.md) |
| At least one programming language | Basic coding experience | -- |
| Basic IDE operations | Able to use rename features | -- |

---

## 1. Core Principles of Naming

### 1.1 Why Naming Matters

Robert C. Martin states that "programmers spend 70% of their working time reading code." This means good names are a **direct investment in the productivity of the entire team**.

```
+-----------------------------------------------------------+
|  Three Conditions for a Good Name                         |
|  ─────────────────────────────────────                    |
|  1. Intention-Revealing                                   |
|     → Makes clear why it exists                           |
|  2. Pronounceable                                         |
|     → Can be discussed verbally within a team             |
|  3. Searchable                                            |
|     → Can be found with IDE/grep                          |
+-----------------------------------------------------------+
```

### 1.2 Naming from a Cognitive Science Perspective

Human short-term memory (working memory) can hold only 7 ± 2 chunks (Miller's Law). A good name conveys meaning in "one chunk," minimizing the cognitive load on the reader.

```
  Time to understand context vs. quality of name

  Comprehension time
    ^
    |  ***
    |     ***
    |        ***
    |           ****
    |               *****
    |                    ********
    +------------------------------> Quality of name
     d  data  val  userData  activeUserList
     ^                              ^
  Not immediately understandable   Immediately understandable
```

| Naming Quality | Cognitive Cost | Example | Reader's Reaction |
|---------|----------|-----|------------|
| Cryptic | Extremely high | `d`, `x2`, `tmp` | "What is this? I have to read the whole codebase to understand." |
| Vague | High | `data`, `info`, `result` | "What data?" |
| Specific | Low | `userAge`, `orderTotal` | "Ah, the user's age." |
| Self-explanatory | Minimal | `activeUserCount`, `isEmailVerified` | Immediately understood |

**Reading process for code with bad naming:**

```
  Bad naming:
  p = g(d, f)

  Reader's thought process:
  1. What is p? → Search for context (20 seconds)
  2. What function is g? → Go look at the function definition (30 seconds)
  3. What data are d and f? → Check the call site (20 seconds)
  → Total: 70+ seconds to understand one line

  Good naming:
  discountedPrice = calculateDiscount(originalPrice, discountRate)

  Reader's thought process:
  1. Understood at a glance → "Calculate the discounted price by applying a discount rate to the original price."
  → Total: 3 seconds to understand one line
```

### 1.3 Five Basic Rules of Naming

| Rule | Description | Bad Example | Good Example |
|-------|------|--------|--------|
| 1. Express intent | Makes clear why it exists | `d` | `elapsedDays` |
| 2. Avoid misleading | Doesn't lead readers to wrong assumptions | `accountList` (when it's a Set) | `accounts` or `accountSet` |
| 3. Be distinguishable | Doesn't cause confusion with similar names | `product` vs `productData` | `product` vs `productDetail` |
| 4. Be pronounceable | Can be discussed by the team | `genymdhms` | `generationTimestamp` |
| 5. Be searchable | Can be found uniquely in IDE | `e`, `t`, `MAX` | `maxRetryCount` |

**Code Example 1: Naming that clearly communicates intent**

```python
# === Bad naming: impossible to tell what the data is ===
d = 86400
l = get_list()
for i in l:
    if i.s == 1:
        process(i)

# Reader's questions:
# - What number is d? → Seconds in a day? A constant?
# - What kind of list is l? → Users? Orders?
# - What is i.s? → status? score? size?
# - What does 1 mean? → Active? Completed?


# === Good naming: the code is self-explanatory ===
SECONDS_PER_DAY = 86400
active_users = get_active_users()
for user in active_users:
    if user.status == UserStatus.ACTIVE:
        send_notification(user)

# Reader understands immediately:
# - Define the number of seconds in a day as a constant
# - Get the list of active users
# - Send a notification to each user whose status is ACTIVE
```

**Code Example 2: Name length according to scope**

```python
# ============================================================
# Rule: The wider the scope, the longer the name; the narrower, the shorter
# ============================================================

# Loop variables (narrow scope): short names are OK
for i in range(10):
    matrix[i][i] = 1

# Be explicit when there is meaning
for row_index in range(height):
    for col_index in range(width):
        grid[row_index][col_index] = calculate_cell(row_index, col_index)

# Module-level constants (wide scope): long and specific
MAX_LOGIN_ATTEMPTS_BEFORE_LOCKOUT = 5
DEFAULT_SESSION_TIMEOUT_MINUTES = 30
MINIMUM_PASSWORD_LENGTH = 8

# Class members (medium scope): moderate length
class UserService:
    def __init__(self):
        self.retry_count = 0            # Context exists within the class
        self.last_login_timestamp = None  # The class name provides context

# Variables close to global scope: be most specific
user_session_timeout_seconds = 1800
database_connection_pool_max_size = 20
```

```
  Relationship between scope and name length

  Name length
    ^
    |                          ★ Global constants
    |                    ★ Class fields
    |              ★ Method parameters
    |        ★ Local variables
    |  ★ Loop variables
    +──────────────────────────→ Width of scope
    Narrow                     Wide

  Examples:
  i (loop)
  total (local)
  order_count (method parameter)
  active_user_count (class field)
  MAX_LOGIN_ATTEMPTS_BEFORE_LOCKOUT (global constant)
```

---

## 2. Naming Rules by Element

### 2.1 Variable Names

```
  ┌────────────────────────────────────────────────┐
  │ Variable Naming Guidelines                      │
  ├──────────┬─────────────────────────────────────┤
  │ bool     │ is/has/can/should + adjective/past   │
  │          │ participle                            │
  │          │ isActive, hasPermission, canEdit      │
  ├──────────┼─────────────────────────────────────┤
  │ numbers  │ Include the unit                      │
  │          │ timeoutMs, fileSizeBytes, ageYears    │
  ├──────────┼─────────────────────────────────────┤
  │ collections│ Plural or xxxList/xxxMap            │
  │          │ users, orderItems, nameToEmail        │
  ├──────────┼─────────────────────────────────────┤
  │ temporaries│ Indicate purpose                   │
  │          │ tempFile, swapValue, accumulator      │
  ├──────────┼─────────────────────────────────────┤
  │ Optional │ maybe/optional + noun                 │
  │          │ maybeUser, optionalAddress            │
  ├──────────┼─────────────────────────────────────┤
  │ date/time│ type + At/On/Since                   │
  │          │ createdAt, publishedOn, activeSince   │
  └──────────┴─────────────────────────────────────┘
```

**Code Example 3: Naming boolean variables**

```typescript
// === Bad: the meaning of true is unclear ===
let flag = true;
let check = false;
let status = true;
let enable = false;
let login = true;

// === Good: the meaning of true/false is clear ===
let isVisible = true;
let hasAdminPermission = false;
let shouldAutoSave = true;
let canDeletePost = user.role === 'admin';
let wasProcessed = order.processedAt !== null;
let isEmailVerified = !!user.emailVerifiedAt;
let hasExceededLimit = currentCount > MAX_ALLOWED;

// Best practices for boolean variable naming
// | Prefix      | Meaning              | Example                    |
// |-------------|----------------------|----------------------------|
// | is          | is in a state        | isActive, isLoading        |
// | has         | possesses            | hasError, hasChildren      |
// | can         | is capable of        | canEdit, canDelete         |
// | should      | ought to             | shouldUpdate, shouldRetry  |
// | was         | past state           | wasDeleted, wasNotified    |
// | will        | future state         | willExpire, willRetry      |
```

**Code Example 4: Including units in numeric variable names**

```python
# === Bad: unit is unclear ===
timeout = 5000     # Milliseconds? Seconds? Minutes?
file_size = 1024   # Bytes? KB? MB?
distance = 100     # Meters? Kilometers? Miles?
age = 25           # Years? Months? Days?

# === Good: include the unit in the name ===
timeout_ms = 5000
timeout_seconds = 5
file_size_bytes = 1048576
file_size_mb = 1.0
distance_km = 100.0
age_years = 25

# === Even better: express units via types (type-safe) ===
from dataclasses import dataclass

@dataclass
class Duration:
    milliseconds: int

    @classmethod
    def from_seconds(cls, seconds: int) -> 'Duration':
        return cls(milliseconds=seconds * 1000)

    @classmethod
    def from_minutes(cls, minutes: int) -> 'Duration':
        return cls(milliseconds=minutes * 60 * 1000)

# Usage examples
connection_timeout = Duration.from_seconds(30)
session_timeout = Duration.from_minutes(15)
```

### 2.2 Function Names

| Pattern | Use Case | Example |
|---------|------|-----|
| `get/fetch/find` | Data retrieval | `getUserById`, `fetchOrders` |
| `create/build/make` | Creation | `createUser`, `buildQuery` |
| `update/modify/set` | Update | `updateProfile`, `setName` |
| `delete/remove/clear` | Deletion | `deleteUser`, `removeItem` |
| `is/has/can/should` | Predicate | `isValid`, `hasAccess` |
| `validate/check/verify` | Validation | `validateEmail`, `checkAuth` |
| `convert/transform/to` | Conversion | `toJSON`, `convertToCSV` |
| `calculate/compute` | Calculation | `calculateTotal`, `computeHash` |
| `parse/extract` | Parsing/Extraction | `parseDate`, `extractToken` |
| `ensure/require` | Precondition enforcement | `ensureAuthenticated`, `requireAdmin` |
| `try/attempt` | May fail | `tryConnect`, `attemptLogin` |
| `register/subscribe` | Event registration | `registerHandler`, `subscribeToTopic` |

**Distinguishing get/fetch/find:**

```typescript
// get: already in memory or immediately available
class User {
  getName(): string { return this.name; }        // field access
  getAge(): number { return calculateAge(this.birthDate); } // calculation
}

// fetch: asynchronous retrieval from external resources (API, DB)
async function fetchUserFromAPI(id: string): Promise<User> {
  return await api.get(`/users/${id}`);
}

// find: search (may not be found → returns Optional/null)
function findUserByEmail(email: string): User | undefined {
  return users.find(u => u.email === email);
}

// A dangerous example of confusion
class UserService {
  // Bad: if getUser accesses the DB, fetch is more appropriate
  async getUser(id: string): Promise<User> {
    return await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }

  // Good: the name makes it clear this is an async external retrieval
  async fetchUser(id: string): Promise<User> {
    return await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }
}
```

**Code Example 5: Improving function names**

```python
# === Bad: impossible to tell what the function does ===
def handle(data):
    pass

def do_it(x, y):
    pass

def process(items):
    pass

def run(config):
    pass

def execute(params):
    pass

# === Good: verb + noun clearly indicates action and target ===
def validate_email_format(email: str) -> bool:
    """Validate the format of an email address"""
    pass

def calculate_monthly_revenue(transactions: list[Transaction]) -> Decimal:
    """Calculate monthly revenue"""
    pass

def send_password_reset_email(user: User) -> None:
    """Send a password reset email"""
    pass

def convert_celsius_to_fahrenheit(celsius: float) -> float:
    """Convert Celsius to Fahrenheit"""
    return celsius * 9 / 5 + 32

def find_expired_subscriptions(cutoff_date: date) -> list[Subscription]:
    """Find expired subscriptions"""
    pass
```

### 2.3 Class Names

```
  ┌────────────────────────────────────────────┐
  │ Class Naming Guidelines                     │
  ├────────────┬───────────────────────────────┤
  │ Entities   │ Noun: User, Order, Product    │
  ├────────────┼───────────────────────────────┤
  │ Services   │ Noun+Service: PaymentService  │
  │            │ Verb+er: OrderProcessor        │
  ├────────────┼───────────────────────────────┤
  │ Repositories│ Noun+Repository              │
  │            │ UserRepository                 │
  ├────────────┼───────────────────────────────┤
  │ Factories  │ Noun+Factory                  │
  │            │ ConnectionFactory              │
  ├────────────┼───────────────────────────────┤
  │ Validators │ Noun+Validator                │
  │            │ EmailValidator                 │
  ├────────────┼───────────────────────────────┤
  │ Builders   │ Noun+Builder                  │
  │            │ QueryBuilder                   │
  ├────────────┼───────────────────────────────┤
  │ Adapters   │ Noun+Adapter                  │
  │            │ StripePaymentAdapter           │
  ├────────────┼───────────────────────────────┤
  │ Exceptions │ Noun+Error/Exception          │
  │            │ InvalidInputError              │
  ├────────────┼───────────────────────────────┤
  │ Interfaces │ I+Noun or adjective+able      │
  │            │ IPaymentGateway, Serializable  │
  └────────────┴───────────────────────────────┘
```

**Code Example 6: Using namespaces for naming**

```java
// === Bad: using prefixes as a substitute for namespaces ===
class AppUserAccountValidationService { }
class AppUserAccountRepository { }
class AppUserAccountDTO { }
// → Names are too long and readability suffers

// === Good: use packages/modules to structure namespaces ===
package com.example.user.account;

class ValidationService { }
class Repository { }
class AccountDTO { }

// At the usage site: meaning is clear from context
import com.example.user.account.ValidationService;
// → The package provides context, so class names can be shorter
```

### 2.4 Naming Constants and Enumerations

**Code Example 7: Constants and enumerations**

```typescript
// === Constants: give meaningful names to magic numbers ===

// Bad: magic numbers
if (password.length < 8) { ... }
if (retryCount > 3) { ... }
if (status === 2) { ... }

// Good: constants with clear intent
const MINIMUM_PASSWORD_LENGTH = 8;
const MAX_RETRY_ATTEMPTS = 3;

if (password.length < MINIMUM_PASSWORD_LENGTH) { ... }
if (retryCount > MAX_RETRY_ATTEMPTS) { ... }

// === Enumerations: give names to a set of choices ===

// Bad: managing state with string literals
let status = 'active';
if (status === 'active' || status === 'pending') { ... }
// → Typos go undetected, no auto-completion

// Good: type-safe with enumerations
enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

// Usage
if (order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED) {
  // Typos are caught as compile errors
}
```

---

## 3. Advanced Naming Techniques

### 3.1 Symmetric Naming

Give symmetric names to paired concepts.

| Concept | Good symmetric naming | Bad asymmetric naming |
|------|----------------|----------------|
| Start/Stop | `start` / `stop` | `start` / `end` |
| Add/Remove | `add` / `remove` | `add` / `delete` |
| Open/Close | `open` / `close` | `open` / `shutdown` |
| Get/Set | `get` / `set` | `get` / `put` |
| Send/Receive | `send` / `receive` | `send` / `get` |
| Show/Hide | `show` / `hide` | `show` / `invisible` |
| Enable/Disable | `enable` / `disable` | `enable` / `off` |
| Register/Unregister | `register` / `unregister` | `register` / `remove` |
| Compress/Decompress | `compress` / `decompress` | `compress` / `expand` |
| Serialize/Deserialize | `serialize` / `deserialize` | `serialize` / `parse` |

### 3.2 Unified Domain Terminology (Ubiquitous Language)

```python
# === Bad: using different names for the same concept ===

# File 1: user_controller.py
def get_client(client_id):  # called "client"
    pass

# File 2: order_service.py
def create_order(customer_id):  # called "customer"
    pass

# File 3: notification.py
def notify_user(user_id):  # called "user"
    pass

# → Are "client", "customer", "user" the same concept? Different? Causes confusion.


# === Good: define a glossary and unify terminology ===

# Glossary:
# - User: a person who logs into the system
# - Customer: a person who purchases products (a type of User)
# - Guest: a visitor who is not logged in

# File 1: user_controller.py
def get_user(user_id):  # unified terminology
    pass

# File 2: order_service.py
def create_order(customer_id):  # Customer is a special role of User
    pass

# File 3: notification.py
def notify_user(user_id):  # unified terminology
    pass
```

### 3.3 Using Context to Name

**Code Example 8: Eliminating redundancy through context**

```typescript
// === Bad: redundant repetition of context ===
class User {
  userName: string;        // "User" is redundant
  userEmail: string;       // "User" is redundant
  userAge: number;         // "User" is redundant
  userAddress: Address;    // "User" is redundant

  getUserName(): string { return this.userName; }
  setUserEmail(email: string): void { this.userEmail = email; }
}

// === Good: the class provides context ===
class User {
  name: string;            // User.name is sufficiently clear
  email: string;           // User.email is sufficiently clear
  age: number;             // User.age is sufficiently clear
  address: Address;        // User.address is sufficiently clear

  getName(): string { return this.name; }
  setEmail(email: string): void { this.email = email; }
}

// === However, be specific when leaving the context ===
// When passed as a function argument outside the class, be more specific
function sendEmail(recipientEmail: string, senderEmail: string): void {
  // Just "email" is ambiguous between sender and recipient
}
```

---

## 4. Language-Specific Naming Conventions

### 4.1 Naming Convention Matrix

| Element | Python | JavaScript/TS | Java | Go | Rust |
|------|--------|--------------|------|-----|------|
| Variables | snake_case | camelCase | camelCase | camelCase | snake_case |
| Functions | snake_case | camelCase | camelCase | CamelCase(public)/camelCase(private) | snake_case |
| Classes | PascalCase | PascalCase | PascalCase | PascalCase | PascalCase |
| Constants | UPPER_SNAKE | UPPER_SNAKE | UPPER_SNAKE | CamelCase | UPPER_SNAKE |
| Files | snake_case | camelCase/kebab | PascalCase | snake_case | snake_case |
| Packages | snake_case | kebab-case | lowercase | lowercase | snake_case |
| Interfaces | N/A (Protocol) | I+PascalCase/PascalCase | I+PascalCase | PascalCase+er | PascalCase |
| Enumerations | PascalCase | PascalCase | PascalCase | PascalCase | PascalCase |

### 4.2 Language-Specific Conventions

**Code Example 9: Convention examples by language**

```python
# === Python naming conventions ===
# Follow PEP 8

# Module-level constants
MAX_RETRY_COUNT = 3
DEFAULT_TIMEOUT_SECONDS = 30

# Functions and variables: snake_case
def calculate_total_price(items: list[OrderItem]) -> Decimal:
    subtotal = sum(item.price * item.quantity for item in items)
    return subtotal

# Classes: PascalCase
class OrderProcessor:
    # Private: _single_leading_underscore
    def _validate_order(self, order: Order) -> bool:
        pass

    # Name mangling: __double_leading_underscore (used very rarely)
    def __internal_state(self):
        pass

    # Dunder methods: __name__ (Python special methods)
    def __str__(self) -> str:
        pass
```

```go
// === Go naming conventions ===
// Go distinguishes public/private by uppercase/lowercase

// Public: CamelCase (starts with uppercase)
func CalculateTax(amount float64) float64 {
    return amount * taxRate
}

// Private: camelCase (starts with lowercase)
func calculateDiscount(amount float64) float64 {
    return amount * discountRate
}

// Interfaces: verb+er
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

// Single-method interfaces use the Doer form
type Stringer interface {
    String() string
}
```

```typescript
// === TypeScript naming conventions ===

// Interfaces: PascalCase (I prefix is debated)
interface PaymentGateway {
  charge(amount: number): Promise<PaymentResult>;
}

// Type aliases: PascalCase
type UserId = string;
type OrderStatus = 'pending' | 'confirmed' | 'shipped';

// Enumerations: PascalCase (members also PascalCase)
enum HttpStatus {
  Ok = 200,
  NotFound = 404,
  InternalServerError = 500,
}

// Generics: single letter or meaningful name
function identity<T>(value: T): T { return value; }
function mapArray<TInput, TOutput>(
  items: TInput[],
  transform: (item: TInput) => TOutput
): TOutput[] {
  return items.map(transform);
}
```

| Principle | Description |
|------|------|
| Consistency within a project | Consistency within a project is more important than language conventions |
| Enforce automatically with linters | Enforce naming rules with ESLint, pylint, checkstyle |
| Verify in code reviews | Clarity of meaning that cannot be automated is supplemented in reviews |

---

## 5. Naming Refactoring

### 5.1 Incremental Naming Improvement Process

```
  Naming refactoring flow

  Step 1: Implement with a placeholder name
  ┌────────────────────────────────┐
  │ temp_result = do_stuff(data)   │
  └────────────────────────────────┘
                │
                ▼
  Step 2: Improve once the overall context is visible
  ┌────────────────────────────────────────┐
  │ validated_order = validate_order(raw_order) │
  └────────────────────────────────────────┘
                │
                ▼
  Step 3: Refine further in code review
  ┌──────────────────────────────────────────────┐
  │ validated_order = ensure_order_valid(raw_input) │
  └──────────────────────────────────────────────┘
```

**Code Example 10: Using IDE rename features**

```python
# Step 1: Write working code (placeholder names are OK)
def proc(d):
    r = []
    for x in d:
        if x > 0:
            r.append(x * 2)
    return r

# Step 2: Rename once intent is clear (IDE: Shift+F6 / F2)
def double_positive_numbers(numbers: list[float]) -> list[float]:
    doubled = []
    for number in numbers:
        if number > 0:
            doubled.append(number * 2)
    return doubled

# Step 3: Refine to be more Pythonic
def double_positive_numbers(numbers: list[float]) -> list[float]:
    return [n * 2 for n in numbers if n > 0]
```

### 5.2 Naming Checklist for Code Reviews

| Check Item | Question | Example |
|------------|------|-----|
| Is intent clear? | "Can I understand the purpose at a glance from this name?" | `d` → `elapsedDays` |
| Risk of misinterpretation | "Could it be interpreted differently?" | `filter` → `excludeInactive` |
| Consistency | "Is the same word used for the same concept?" | Mixed `get`/`fetch`/`retrieve` → unify |
| Appropriateness of abbreviations | "Can every team member understand this abbreviation?" | `usr` → `user` |
| Elimination of negations | "Is there a double negative?" | `isNotInactive` → `isActive` |
| Context | "Is it redundant combined with the class name?" | `User.userName` → `User.name` |

---

## 6. Anti-Patterns

### Anti-Pattern 1: Misusing Hungarian Notation

```typescript
// NG: putting type in the prefix (unnecessary with modern IDEs)
let strName: string = "Taro";
let intAge: number = 25;
let arrUsers: User[] = [];
let bIsActive: boolean = true;
let objConfig: Config = {};

// OK: leave type information to the type system
let name: string = "Taro";
let age: number = 25;
let users: User[] = [];
let isActive: boolean = true;
let config: Config = {};

// Exception: prefixes may be acceptable in UI contexts
// btnSubmit, txtEmail, lblError indicate the type of UI element
```

### Anti-Pattern 2: Abbreviations and Cryptic Naming

```python
# NG: names that require decoding
def calc_ttl_w_dsc(itms, dsc_pct):
    ttl = 0
    for itm in itms:
        ttl += itm.prc * itm.qty
    return ttl * (1 - dsc_pct / 100)

# OK: spell out fully without abbreviation
def calculate_total_with_discount(
    items: list[OrderItem],
    discount_percent: float
) -> float:
    subtotal = sum(item.price * item.quantity for item in items)
    return subtotal * (1 - discount_percent / 100)
```

### Anti-Pattern 3: Overly Generic Names

```python
# NG: vague names that could mean anything
data = get_data()           # What data?
result = process(data)      # What result?
info = fetch_info()         # What info?
manager = get_manager()     # Manages what?
handler = create_handler()  # Handles what?
temp = calculate()          # Temporary value of what?

# OK: specific names
user_profiles = fetch_active_user_profiles()
monthly_revenue = calculate_monthly_revenue(transactions)
server_health_info = check_server_health()
connection_manager = create_database_connection_pool()
request_handler = create_api_request_handler()
interpolated_value = interpolate_between(start, end, ratio)
```

---

## 7. Exercises

### Exercise 1 (Beginner): Improving Names

Improve the variable and function names in the code below.

```python
def f(l, n):
    r = []
    for i in l:
        if i.a > n:
            r.append(i)
    return r

d = f(get_all(), 18)
for i in d:
    s(i.e, "Welcome!")
```

**Expected Answer:**

```python
def find_users_older_than(users: list[User], minimum_age: int) -> list[User]:
    eligible_users = []
    for user in users:
        if user.age > minimum_age:
            eligible_users.append(user)
    return eligible_users

# Even more Pythonic
def find_users_older_than(users: list[User], minimum_age: int) -> list[User]:
    return [user for user in users if user.age > minimum_age]

adult_users = find_users_older_than(get_all_users(), minimum_age=18)
for user in adult_users:
    send_email(user.email, "Welcome!")
```

### Exercise 2 (Intermediate): Unifying Domain Terminology

Identify the places in the codebase below where different names are used for the same concept, and unify the terminology.

```typescript
// user_controller.ts
function getClient(clientId: string): Client { ... }
function updateCustomerProfile(customerId: string, data: any): void { ... }

// notification_service.ts
function notifyMember(memberId: string, message: string): void { ... }

// billing_service.ts
function chargeAccount(accountHolderId: string, amount: number): void { ... }

// analytics_service.ts
function trackUserAction(userId: string, action: string): void { ... }
```

**Expected Answer:**

```typescript
// Define a glossary:
// - User: a user of the system (unified terminology)
// - UserProfile: a user's profile information
// - Account: the account subject to billing

// user_controller.ts
function getUser(userId: string): User { ... }
function updateUserProfile(userId: string, profile: UserProfileUpdate): void { ... }

// notification_service.ts
function notifyUser(userId: string, message: string): void { ... }

// billing_service.ts
function chargeUserAccount(userId: string, amount: number): void { ... }

// analytics_service.ts
function trackUserAction(userId: string, action: string): void { ... }
```

### Exercise 3 (Advanced): Creating a Naming Convention Document

Create a naming convention for your team that includes the following elements.
- Prefix rules for boolean variables
- Naming patterns for asynchronous functions
- Naming conventions for error types
- Naming conventions for API endpoints

**Expected Answer:**

```markdown
# Naming Conventions

## 1. Boolean Variables
- Prefixes: is, has, can, should, was, will
- Examples: isActive, hasPermission, canEdit, shouldRetry

## 2. Asynchronous Functions
- External API calls: fetch + noun (fetchUsers, fetchOrderById)
- DB operations: find/save/delete + noun (findUserByEmail, saveOrder)
- Processing: process/handle + noun + Async (processPaymentAsync)

## 3. Error Types
- Base: AppError
- Pattern: [Noun] + Error (ValidationError, NotFoundError)
- HTTP-related: Http + [Status] + Error (HttpNotFoundError)

## 4. API Endpoints
- RESTful: /api/v1/{resource}/{id}
- Collections: plural (/users, /orders)
- Actions: POST /api/v1/orders/{id}/cancel
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check the path and format of the configuration file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify the executing user's permissions, review configuration |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish steps to reproduce**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify incrementally**: Use log output and a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, run tests for related areas as well

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
    """Decorator that logs the input and output of a function"""
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
    """Data processing (target for debugging)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps to diagnose when a performance issue occurs:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Examine the status of disk and network I/O
4. **Check concurrent connection count**: Check the state of the connection pool

| Type of Issue | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize when | Can compromise when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to 2               │
│                                                 │
│  2. How often do you deploy?                     │
│    ├─ Weekly or less → Monolith + module split   │
│    └─ Daily/multiple times → Go to 3             │
│                                                 │
│  3. How independent are teams?                   │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A fast short-term approach may become technical debt in the long run
- Conversely, over-engineering has a high short-term cost and can delay the project

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job but increases operational costs

**3. Level of Abstraction**
- High abstraction enables reuse but can make debugging harder
- Low abstraction is intuitive but tends to result in code duplication

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
        """Describe background and challenges"""
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
- Focus on the minimum viable set of features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally renewing a system that has been running for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If there are no existing tests, create characterization tests first
- Use an API gateway to coexist old and new systems
- Perform data migration incrementally

| Phase | Work Content | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, understanding dependencies | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration Start | Migrate peripheral features incrementally | 3-6 months | Medium |
| 4. Core Migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries using an Inner Source approach
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

# Usage examples
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

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Using asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | When to Apply |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy workloads |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Team Development Practices

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Has the documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Whole team | Horizontal knowledge sharing |
| ADR (design records) | As needed | Future members | Transparent decision-making |
| Retrospectives | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Important design | Building consensus |

### Managing Technical Debt

```
Priority matrix:

        High impact
          │
    ┌─────┼─────┐
    │ Plan│ Act │
    │ and │ imme│
    │ addr│ diat│
    │ ess │ ely │
    ├─────┼─────┤
    │ Log │ Next│
    │ only│ Spri│
    │     │ nt  │
    └─────┼─────┘
          │
        Low impact
    Low frequency  High frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------|------------|------|---------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Broken authentication | High | Multi-factor authentication, session management hardening | Penetration testing |
| Exposure of sensitive data | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, principle of least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logging, audit trail | Log analysis |

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
        """Sanitize input"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage examples
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All inputs are validated
- [ ] Sensitive information is not written to logs
- [ ] HTTPS is enforced
- [ ] CORS policies are properly configured
- [ ] Vulnerability scanning of dependency packages has been performed
- [ ] Error messages do not contain internal information

---

## Migration Guide

### Notes on Version Upgrades

| Version | Key Changes | Migration Work | Scope of Impact |
|-----------|-----------|---------|---------|
| v1.x → v2.x | Redesigned API | Endpoint changes | All clients |
| v2.x → v3.x | Authentication method change | Token format update | Auth-related |
| v3.x → v4.x | Data model change | Run migration scripts | DB-related |

### Incremental Migration Steps

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
2. **Validate in a test environment**: Verify in an environment equivalent to production beforehand
3. **Incremental rollout**: Deploy gradually with a canary release
4. **Enhanced monitoring**: Shorten metrics monitoring intervals during migration
5. **Clarify rollback criteria**: Define in advance the criteria for deciding to roll back
---

## 8. FAQ

### Q1: Are long names bad?

Long names are not inherently bad. **A short name with an ambiguous meaning is far more harmful.** However, if "a function name is so long it doesn't fit on one line," that may be a sign the function has multiple responsibilities. Instead of looking at name length, reconsider the separation of responsibilities.

Guidelines:
- Variable names: 5-25 characters
- Function names: 10-40 characters
- Class names: 5-30 characters
- If a name exceeds 40 characters, revisit the design

### Q2: What should I do if I'm spending too much time struggling with naming?

Assign a placeholder name (`temp_xxx`) and implement first; rename once the overall context becomes clear. Using the IDE's refactoring features, renaming can be done safely. Think of **naming as an iterative process**.

Practical approach:
1. Start with a verb+noun placeholder (the 5-second rule)
2. Once tests pass, think of a better name
3. Verify from a third-party perspective in a code review
4. Use "would my future self understand this in 3 months?" as the standard

### Q3: Is it acceptable to use non-English variable names?

Technically possible in many languages, but English is recommended for the following reasons:
- Readability for international teams
- Consistency with libraries/frameworks
- Technical terms are more precise in English
- Information on StackOverflow etc. is concentrated in the English-speaking community

However, for domain-specific concepts that don't translate well (e.g., Japanese tax terminology), supplement with comments or express in romanized form (e.g., `kakutei_shinkoku`).

### Q4: How strictly should naming conventions be enforced?

Rules that can be automatically enforced by a linter (casing, length) should be applied strictly. The semantic quality of naming is verified by humans in code reviews. What matters most is **consistency** — having the entire team follow the same rules increases productivity.

### Q5: Should legacy code naming be changed all at once?

Bulk changes carry high risk. The following incremental approach is recommended:

1. **New code**: Apply the new naming conventions immediately
2. **Code you are changing**: Rename as you make other changes
3. **Frequently read code**: Prioritize for renaming
4. **Stable legacy code**: Leave it alone (the return is too low relative to the risk)

### Q6: Should I use get or fetch for the same concept?

Having a consistent standard within the team is most important, but the following distinction is widely accepted in general:

| Verb | Meaning | Typical Use |
|------|------|------------|
| `get` | Synchronously returns a value immediately. Low computational cost | Accessing an in-memory property, reading from cache |
| `fetch` | Asynchronously retrieves from an external resource | HTTP API calls, queries to external services |
| `find` | Search that may not find anything (returns null/undefined) | DB queries, searching within a collection |
| `load` | Read a file or resource and initialize | Reading configuration files, lazy-loading a module |
| `retrieve` | Restore from an archive or long-term storage | Restoring from backup, rebuilding cache |

```typescript
// get: synchronous and lightweight
function getUserName(user: User): string { return user.name; }

// fetch: asynchronous, external communication
async function fetchUserProfile(userId: string): Promise<UserProfile> {
  return await api.get(`/users/${userId}/profile`);
}

// find: may not be found
function findUserByEmail(email: string): User | null {
  return users.find(u => u.email === email) ?? null;
}
```

### Q7: How should test method names be structured?

Test method names are allowed to be longer than regular method names. A test name should clearly express "what," "under what condition," and "what should happen." Common patterns are as follows:

```typescript
// Pattern 1: should + expected behavior + when + condition
it('should return empty array when no users match the criteria', () => { ... });

// Pattern 2: given-when-then separated by underscores
test('given_expired_token_when_authenticate_then_throw_error', () => { ... });

// Pattern 3: methodName_condition_expectedResult (xUnit style)
test('calculateTotal_withDiscountCode_appliesDiscount', () => { ... });
```

Regardless of pattern, what matters is that the name alone allows you to infer the cause when a test fails. Avoid vague names like `test1` or `testCalculate`.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and confirming how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this knowledge used in the real world?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Element | Key to Naming | Example | Pattern |
|------|---------|-----|---------|
| Variable | What it stores | `activeUserCount` | noun / adjective+noun |
| Boolean | Meaning of true/false | `isAuthenticated` | is/has/can + adjective |
| Function | What it does | `calculateShippingCost` | verb + noun |
| Class | What it represents | `PaymentProcessor` | noun / noun+role |
| Constant | What value it holds | `MAX_RETRY_COUNT` | UPPER_SNAKE_CASE |
| Enumeration | A set of choices | `OrderStatus.SHIPPED` | PascalCase.UPPER |
| Interface | What it can do | `Serializable` | adjective+able / noun |

| Principle | Description | How to Verify |
|------|------|---------|
| Clarity of intent | The purpose is understandable from the name alone | "Can I understand this name in 3 seconds?" |
| Consistency | Same word for the same concept | Maintain a glossary |
| Appropriate length | Proportional to scope | Short for loop variables, long for globals |
| Searchability | Uniquely findable with grep | Verify with IDE search |
| Pronounceability | Can be discussed verbally | Try using it in a team meeting |

---

## What to Read Next

- [Function Design](./01-functions.md) ── Design principles for functions, closely related to naming
- [Comments](./03-comments.md) ── How to supplement information that cannot be expressed in names
- [Code Review Checklist](../03-practices-advanced/04-code-review-checklist.md) ── Review perspectives for naming
- [DRY/KISS/YAGNI](../00-principles/02-dry-kiss-yagni.md) ── Simplicity in names and the KISS principle

---

## References

1. **Robert C. Martin** *Clean Code: A Handbook of Agile Software Craftsmanship* Prentice Hall, 2008 (Chapter 2: Meaningful Names) ── Core principles of naming
2. **Dustin Boswell, Trevor Foucher** *The Art of Readable Code* O'Reilly Media, 2011 ── Naming techniques for readable code
3. **Steve McConnell** *Code Complete: A Practical Handbook of Software Construction* Microsoft Press, 2004 (Chapter 11: The Power of Variable Names) ── Detailed guidelines for variable naming
4. **George A. Miller** "The Magical Number Seven, Plus or Minus Two" Psychological Review, 1956 ── Classic paper on working memory capacity
5. **Eric Evans** *Domain-Driven Design: Tackling Complexity in the Heart of Software* Addison-Wesley, 2003 ── The concept of ubiquitous language
6. **Python Software Foundation** "PEP 8 -- Style Guide for Python Code" ── Python naming conventions
7. **Effective Go** (golang.org) ── Go naming conventions
8. **Martin Fowler** *Refactoring: Improving the Design of Existing Code* Addison-Wesley, 2018 ── Steps for Rename Variable and Rename Method
