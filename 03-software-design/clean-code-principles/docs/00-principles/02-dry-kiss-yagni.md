# DRY / KISS / YAGNI ── Eliminating Duplication, Simplicity, and Avoiding Unnecessary Features

> Three fundamental principles of software development. DRY eliminates knowledge duplication, KISS avoids complexity, and YAGNI prevents premature implementation. The right balance of these three principles produces maintainable code.

---

## What You Will Learn in This Chapter

1. **Understanding DRY Correctly** ── Learn that DRY is about "centralizing knowledge," not just eliminating code duplication
2. **How to Practice KISS** ── Acquire design skills that meet requirements while keeping things simple
3. **Criteria for YAGNI** ── Learn to distinguish cases where upfront investment is justified from those where it is not
4. **Interactions and Tensions Among the Three Principles** ── Learn how to prioritize when principles conflict
5. **Practicing the Rule of Three** ── Learn the heuristic for deciding when to eliminate duplication

---

## Prerequisites

| Prerequisite | Description | Reference |
|---------|------|-----------|
| Clean Code Overview | Basic concepts of code quality | [00-clean-code-overview.md](./00-clean-code-overview.md) |
| Refactoring Basics | Techniques for restructuring code | [Refactoring Techniques](../02-refactoring/01-refactoring-techniques.md) |
| Function Basics | Function definitions, arguments, return values | [Function Design](../01-practices/01-functions.md) |

---

## 1. DRY ── Don't Repeat Yourself

### 1.1 Definition and Essence

```
+-----------------------------------------------------------+
|  DRY (Don't Repeat Yourself)                              |
|  ─────────────────────────────────────────────────         |
|  "Every piece of knowledge must have a single,            |
|   unambiguous, authoritative representation               |
|   within a system"                                        |
|                    ── Andrew Hunt & David Thomas           |
|                       "The Pragmatic Programmer"          |
+-----------------------------------------------------------+
```

**Important note:** DRY is about **"centralizing knowledge,"** not "textually eliminating code duplication." Misunderstanding this distinction can actually worsen code quality.

### 1.2 What DRY Targets ── What Counts as "Duplication"

```
     Types of "knowledge" to which DRY applies
     ┌──────────────────────────────┐
     │  Business logic              │  e.g., tax calculation rules
     ├──────────────────────────────┤
     │  Data schema                 │  e.g., user definition
     ├──────────────────────────────┤
     │  Configuration values        │  e.g., API endpoints
     ├──────────────────────────────┤
     │  Algorithms                  │  e.g., sorting procedures
     ├──────────────────────────────┤
     │  Validation rules            │  e.g., email format check
     ├──────────────────────────────┤
     │  Database schema             │  e.g., table definitions
     ├──────────────────────────────┤
     │  API contracts               │  e.g., request/response format
     └──────────────────────────────┘
     * Even if code looks the same,
       if it expresses different "knowledge," it is not duplication
```

### 1.3 WHY ── Why DRY Matters

The fundamental problem with DRY violations is **missed changes** (Shotgun Surgery).

```
  Cost of changes when DRY is violated

  "Change the consumption tax rate from 10% to 12%"

  DRY compliant:                DRY violation:
  ┌──────────────┐              ┌──────────────┐
  │ TaxCalculator │              │ InvoiceService│ ← 10% → 12%
  │ TAX_RATE=0.10│              │ tax = x*0.10  │
  │ → change to  │              ├──────────────┤
  │   0.12       │              │ CartService   │ ← 10% → 12%
  │ (1 place)    │              │ tax = x*0.10  │
  └──────────────┘              ├──────────────┤
                                │ ReportService │ ← 10% → 12%
  Change locations: 1           │ tax = x*0.10  │
  Risk of missed change: 0%     ├──────────────┤
                                │ API Response  │ ← 10% → 12%
                                │ tax_rate: 0.10│
                                └──────────────┘
                                Change locations: 4
                                Risk of missed change: High
```

### 1.4 Code Examples

**Code Example 1: True DRY violation ── same knowledge exists in multiple places**

```python
# DRY violation: tax calculation logic exists in 2 places
class InvoiceService:
    def calculate_total(self, subtotal: float) -> float:
        tax = subtotal * 0.10  # 10% consumption tax
        return subtotal + tax

class CartService:
    def calculate_total(self, subtotal: float) -> float:
        tax = subtotal * 0.10  # 10% consumption tax ← same knowledge duplicated!
        return subtotal + tax


# DRY applied: centralize the tax calculation knowledge
class TaxCalculator:
    """The single authoritative source for tax calculation"""
    TAX_RATE = 0.10

    @classmethod
    def calculate_tax(cls, amount: float) -> float:
        """Calculate tax amount"""
        return amount * cls.TAX_RATE

    @classmethod
    def calculate_total_with_tax(cls, subtotal: float) -> float:
        """Calculate total including tax"""
        return subtotal + cls.calculate_tax(subtotal)


class InvoiceService:
    def calculate_total(self, subtotal: float) -> float:
        return TaxCalculator.calculate_total_with_tax(subtotal)

class CartService:
    def calculate_total(self, subtotal: float) -> float:
        return TaxCalculator.calculate_total_with_tax(subtotal)
```

**Code Example 2: Not a DRY violation ── coincidental similarity**

```python
# This is NOT a DRY violation!
# They look similar, but express different "knowledge"

def validate_username(name: str) -> bool:
    """Username must be between 3 and 20 characters (username business rule)"""
    return 3 <= len(name) <= 20

def validate_product_name(name: str) -> bool:
    """Product name must be between 3 and 20 characters (product name business rule)"""
    return 3 <= len(name) <= 20

# Forcing them into a common function produces this (bad example):
def validate_name_length(name: str, min_len: int = 3, max_len: int = 20) -> bool:
    return min_len <= len(name) <= max_len

# Problem: if the username rule changes, it should not affect the product name rule
# e.g., "Change minimum username length to 5" → product names are affected too
# This is "coincidental similarity," not the same "knowledge"
```

**Code Example 3: DRY application pattern ── centralizing constants**

```typescript
// DRY violation: the same value is scattered throughout the code
class UserValidator {
  validate(email: string): boolean {
    return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(email);
  }
}

class RegistrationForm {
  isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(email);
  }
}

// DRY applied: define the regex in one place
const EMAIL_PATTERN = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

// All places use this function
class UserValidator {
  validate(email: string): boolean {
    return isValidEmail(email);
  }
}
```

**Code Example 4: DRY application ── Template Method pattern**

```python
from abc import ABC, abstractmethod
from datetime import datetime

# DRY violation: the common report generation flow is duplicated in each class
class SalesReport:
    def generate(self, data):
        header = f"=== Sales Report ===\nDate: {datetime.now()}\n"
        body = self._format_sales(data)
        footer = f"\n--- End ---\n"
        return header + body + footer

class InventoryReport:
    def generate(self, data):
        header = f"=== Inventory Report ===\nDate: {datetime.now()}\n"
        body = self._format_inventory(data)
        footer = f"\n--- End ---\n"
        return header + body + footer


# DRY applied: Template Method pattern
class BaseReport(ABC):
    """Defines the common flow for report generation"""

    def generate(self, data) -> str:
        header = self._build_header()
        body = self._build_body(data)
        footer = self._build_footer()
        return header + body + footer

    def _build_header(self) -> str:
        return f"=== {self.title} ===\nDate: {datetime.now()}\n"

    def _build_footer(self) -> str:
        return f"\n--- End ---\n"

    @property
    @abstractmethod
    def title(self) -> str:
        pass

    @abstractmethod
    def _build_body(self, data) -> str:
        pass

class SalesReport(BaseReport):
    @property
    def title(self) -> str:
        return "Sales Report"

    def _build_body(self, data) -> str:
        return "\n".join(f"  {item['name']}: {item['amount']}" for item in data)

class InventoryReport(BaseReport):
    @property
    def title(self) -> str:
        return "Inventory Report"

    def _build_body(self, data) -> str:
        return "\n".join(f"  {item['name']}: {item['stock']} units" for item in data)
```

### 1.5 Rule of Three

The "Rule of Three" is a practical heuristic for deciding when to apply DRY.

```
  Rule of Three

  1st duplication → Leave it (might be a coincidence)
  2nd duplication → Note it (wait and see)
  3rd duplication → Consolidate it (the pattern is established)

  Reasons:
  · With 1-2 occurrences, the right abstraction is not yet clear
  · By the 3rd occurrence, the common pattern becomes obvious
  · Premature consolidation leads to wrong abstractions
```

### 1.6 Types of DRY Violations and How to Address Them

```
  Classification of code duplication

  ┌─────────────────────────────────────────────────┐
  │  Type 1: Exact clone                             │
  │  → Identical code that was copy-pasted           │
  │  → Fix: Extract function/method                  │
  ├─────────────────────────────────────────────────┤
  │  Type 2: Parameterized clone                     │
  │  → Code differing only in constants or literals  │
  │  → Fix: Parameterize into a shared function      │
  ├─────────────────────────────────────────────────┤
  │  Type 3: Structural clone                        │
  │  → Code with some statements added/removed/      │
  │    changed                                       │
  │  → Fix: Template Method or Strategy pattern      │
  ├─────────────────────────────────────────────────┤
  │  Type 4: Semantic clone                          │
  │  → Different code that produces the same result  │
  │  → Fix: Unify to the simplest implementation     │
  └─────────────────────────────────────────────────┘
```

---

## 2. KISS ── Keep It Simple, Stupid

### 2.1 Definition

```
+-----------------------------------------------------------+
|  KISS (Keep It Simple, Stupid)                            |
|  ─────────────────────────────────────────────────         |
|  "Simplicity is the ultimate sophistication"               |
|                                    ── Leonardo da Vinci   |
|  "Choose the simplest solution that is sufficient"         |
|                                                           |
|  Related principles:                                      |
|  · Occam's Razor: "Do not multiply assumptions beyond     |
|    necessity"                                             |
|  · UNIX philosophy: "Do one thing and do it well"         |
|  · Einstein: "As simple as possible, but no simpler"      |
+-----------------------------------------------------------+
```

### 2.2 WHY ── Why Simplicity Matters

```
  Cost model of complexity

  Cost
    ^
    |                        ####
    |                   #####
    |              #####         ← Maintenance cost of complex code
    |         #####
    |    #####
    |####
    |
    |  ****************************  ← Maintenance cost of simple code
    |****
    +------------------------------------> Time
    Start  1mo  3mo  6mo  1yr  2yr
```

### 2.3 Metrics for Measuring Simplicity

| Metric | How to Measure | Target |
|------|---------|------|
| Cyclomatic complexity | Count branches | 10 or fewer per function |
| Cognitive complexity | Weighted by nesting depth | 15 or fewer per function |
| Lines per function | Count physical lines | 20 or fewer |
| Number of arguments | Count parameters | 3 or fewer |
| Levels of abstraction | Depth of call hierarchy | 3 or fewer levels |
| Number of imports | Count dependency modules | 10 or fewer |

### 2.4 Code Examples

**Code Example 5: Overly complex implementation vs. simple implementation**

```javascript
// KISS violation: overly complex validation
class UserValidator {
  constructor() {
    this.validationChain = new ValidationChainBuilder()
      .addValidator(new NotNullValidator())
      .addValidator(new StringLengthValidator(1, 100))
      .addValidator(new RegexValidator(/^[a-zA-Z0-9_]+$/))
      .addValidator(new BlacklistValidator(BANNED_WORDS))
      .setErrorHandler(new ValidationErrorAggregator())
      .setLocalizationProvider(new I18nValidationMessages('en'))
      .build();
  }

  validate(username) {
    return this.validationChain.execute(
      new ValidationContext(username, 'username')
    );
  }
}

// KISS applied: simple and sufficient
function validateUsername(username) {
  if (!username || username.length === 0) {
    return { valid: false, error: 'Username is required' };
  }
  if (username.length > 100) {
    return { valid: false, error: 'Username must be 100 characters or fewer' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Only alphanumeric characters and underscores are allowed' };
  }
  return { valid: true, error: null };
}
```

**Code Example 6: Simple data transformation**

```python
# KISS violation: overly generic transformation pipeline
class DataTransformPipeline:
    def __init__(self):
        self.transformers = []

    def add_transformer(self, transformer):
        self.transformers.append(transformer)
        return self

    def execute(self, data):
        result = data
        for transformer in self.transformers:
            result = transformer.transform(result)
        return result

pipeline = DataTransformPipeline()
pipeline.add_transformer(StripWhitespaceTransformer())
pipeline.add_transformer(LowercaseTransformer())
pipeline.add_transformer(RemoveSpecialCharsTransformer())
result = pipeline.execute(user_input)


# KISS applied: direct and clear
def normalize_input(text: str) -> str:
    """Normalize input text"""
    return text.strip().lower().replace('-', '').replace('.', '')
```

**Code Example 7: KISS applied ── configuration management**

```python
# KISS violation: configuration management with multiple layers of abstraction
class ConfigurationManager:
    def __init__(self):
        self._providers = []
        self._cache = {}
        self._observers = []
        self._encryption_service = EncryptionService()

    def register_provider(self, provider):
        self._providers.append(provider)

    def get(self, key: str, default=None):
        if key in self._cache:
            return self._cache[key]
        for provider in reversed(self._providers):
            value = provider.get(key)
            if value is not None:
                if self._is_encrypted(key):
                    value = self._encryption_service.decrypt(value)
                self._cache[key] = value
                self._notify_observers(key, value)
                return value
        return default


# KISS applied: necessary and sufficient simplicity
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class AppConfig:
    """Application configuration (immutable)"""
    database_url: str
    api_key: str
    debug: bool = False
    max_connections: int = 10

    @classmethod
    def from_env(cls) -> "AppConfig":
        """Load configuration from environment variables"""
        return cls(
            database_url=os.environ["DATABASE_URL"],
            api_key=os.environ["API_KEY"],
            debug=os.environ.get("DEBUG", "false").lower() == "true",
            max_connections=int(os.environ.get("MAX_CONNECTIONS", "10")),
        )
```

### 2.5 Simplicity vs Simplistic

| Simplicity (good simplicity) | Simplistic (bad simplicity) |
|------------------------|------------------------|
| Solves complex problems clearly | Simplifies by ignoring the problem |
| Organizes with appropriate abstraction | Omits necessary abstraction |
| Accounts for edge cases | Ignores edge cases |
| Appropriate error handling | Insufficient error handling |
| Testable structure | Untestable structure |

---

## 3. YAGNI ── You Aren't Gonna Need It

### 3.1 Definition

```
+-----------------------------------------------------------+
|  YAGNI (You Aren't Gonna Need It)                         |
|  ─────────────────────────────────────────────────         |
|  "Do not implement a feature until you actually need it"   |
|                    ── Ron Jeffries (co-founder of XP)      |
|                                                           |
|  "Costs of implementing features you don't need yet:      |
|    implementation cost + testing cost + maintenance cost   |
|    + reading cost + risk of never being used               |
|    + risk of misalignment with actual needs"               |
+-----------------------------------------------------------+
```

### 3.2 WHY ── The Cost of Unnecessary Upfront Implementation

```
  Real costs of YAGNI violations

  Feature A: needed now → implement → used → cost recovered

  Feature B: might be needed later → implement → never used
    ├── Implementation cost: 3 days
    ├── Test creation: 1 day
    ├── Review: 0.5 day
    ├── Documentation: 0.5 day
    ├── Maintenance cost: 0.5 day/month x 12 months = 6 days
    └── Total: 11 days of effort wasted

  Feature C: might be needed later → implement → doesn't match actual needs
    ├── The above 11 days + refactoring: 5 days
    └── Total: 16 days of effort wasted
```

### 3.3 Code Examples

**Code Example 8: Excessive upfront implementation vs. necessary and sufficient implementation**

```typescript
// YAGNI violation: many extension points provided that are not currently needed
interface LogTransport {
  send(entry: LogEntry): Promise<void>;
}
interface LogFormatter {
  format(entry: LogEntry): string;
}
interface LogFilter {
  shouldLog(entry: LogEntry): boolean;
}

class Logger {
  private transports: LogTransport[] = [];
  private formatters: Map<string, LogFormatter> = new Map();
  private filters: LogFilter[] = [];
  private bufferSize: number;
  private flushInterval: number;
  private retryPolicy: RetryPolicy;
  private encryptionProvider?: EncryptionProvider;
  // When all we actually use is console output...
}


// YAGNI applied: implement only what is needed now
enum LogLevel { DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3 }

class Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  info(message: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${new Date().toISOString()} ${message}`);
    }
  }

  error(message: string, error?: Error): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()} ${message}`, error);
    }
  }

  warn(message: string): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()} ${message}`);
    }
  }
  // When file output is needed, extend it at that point
}
```

**Code Example 9: YAGNI applied ── API response**

```python
import json
from dataclasses import dataclass

# YAGNI violation: upfront support for every format
class ApiResponse:
    def __init__(self, data, status=200):
        self.data = data
        self.status = status
        self._formatters = {
            'json': JsonFormatter(),
            'xml': XmlFormatter(),
            'csv': CsvFormatter(),
            'yaml': YamlFormatter(),
            'msgpack': MsgpackFormatter(),
        }

    def to_format(self, format_type: str) -> bytes:
        return self._formatters[format_type].format(self.data)


# YAGNI applied: JSON only for now
@dataclass
class ApiResponse:
    data: dict
    status: int = 200

    def to_json(self) -> str:
        return json.dumps({
            'status': self.status,
            'data': self.data
        }, ensure_ascii=False)
# Add XML or CSV when they become necessary
```

### 3.4 Exceptions to YAGNI ── Cases Where Upfront Investment Is Justified

| Cases where upfront investment is justified | Reason |
|---------------------|------|
| Security measures | Difficult to add later; must be built in from the start |
| Database schema design | Migration costs are high |
| Public API interfaces | Backward compatibility must be maintained |
| Logging infrastructure | Adding it later affects all code |
| Test infrastructure | Testable design must be established from the start |
| i18n (internationalization) infrastructure | Hard-coded strings are difficult to fix later |

---

## 4. Interactions and Tensions Among the Three Principles

### 4.1 Relationship Diagram

```
          DRY                KISS               YAGNI
     "Don't repeat"    "Keep it simple"   "Don't build what
                                           you don't need"
          |                  |                   |
          +--------+---------+--------+----------+
                   |                  |
           Where tension arises     Where they align
                   |                  |
      Pursuing DRY → over-            All three point in
      abstraction                     the same direction:
      → may violate KISS              "Simple, no duplication,
                                       only what's needed"
      Pursuing KISS → tolerating
      duplication
      → may violate DRY

      Pursuing DRY → abstraction
      anticipating future reuse
      → may violate YAGNI
```

### 4.2 Guide to Resolving Tensions

| Situation | Principle to prioritize | Reason |
|------|---------------|------|
| 2 instances of duplication, low change frequency | KISS > DRY | Abstraction cost is not worth it |
| 3 or more instances of duplication | DRY > KISS | High risk of missed changes |
| Abstraction for future extension | YAGNI > OCP | Do not invest in an uncertain future |
| Duplication of business rules | DRY > YAGNI | Consistency on rule changes is critical |
| Duplication in small scripts | KISS > DRY | Copy-paste is clearer than abstraction |
| Duplication in test code | KISS > DRY | Prioritize readability of tests |
| Security-related features | Err on the side of safety | YAGNI does not apply to safety |

### 4.3 Decision Flowchart

```
  Decision flow for the three principles

  Duplication found
  │
  ├── Does it express the same "knowledge"?
  │   ├── No → Leave it (coincidental similarity)
  │   └── Yes → How many locations?
  │       ├── 2 locations → How often does it change?
  │       │   ├── Often → Apply DRY
  │       │   └── Rarely → Rule of Three (wait for a 3rd occurrence)
  │       └── 3 or more → Apply DRY
  │
  ├── Consider how to apply DRY
  │   ├── Can it be simply extracted to a function/constant?
  │   │   └── Yes → Extract it (KISS compliant)
  │   └── Does it require complex abstraction?
  │       ├── Needed for current requirements? → Implement it
  │       └── For future requirements? → YAGNI (defer for now)
```

---

## 5. Practical Decision Flow

| Decision point | Question | Yes → | No → |
|-------------|------|-------|------|
| Duplication found | Is it the same "knowledge"? | Consider DRY | Leave it (coincidental similarity) |
| DRY consideration | 3 or more instances? | Consolidate | Rule of Three if only 2 |
| Consolidation method | Can it be extracted simply? | Extract to function/constant | Consider design patterns |
| New feature request | Needed in this sprint? | Implement it | YAGNI (defer) |
| Implementation approach | Does it work with the simplest method? | Use that method | Consider if it can be made simpler |
| Abstraction consideration | 3 or more concrete use cases? | Abstract it | Keep as concrete implementation |

---

## 6. DRY Across Layers

### 6.1 Duplication Between Frontend and Backend

```python
# Cross-layer DRY violation: validation rules scattered across layers

# Improvement: generate rules for each layer from a single definition
AGE_MIN = 0
AGE_MAX = 150

def validate_age(age: int) -> bool:
    return AGE_MIN <= age <= AGE_MAX

def get_age_schema() -> dict:
    """Share with frontend as JSON Schema"""
    return {
        "type": "integer",
        "minimum": AGE_MIN,
        "maximum": AGE_MAX
    }

def get_age_constraint_sql() -> str:
    """Share as DB constraint"""
    return f"CHECK (age >= {AGE_MIN} AND age <= {AGE_MAX})"
```

### 6.2 DRY in Microservices

```
  DRY decisions in microservices

  Sharing between services:
  ┌─────────────────────────────────────────────────┐
  │ Should be shared         │ Should NOT be shared  │
  ├─────────────────────────┼─────────────────────┤
  │ API contracts (OpenAPI)  │ Business logic        │
  │ Event schemas            │ Database schemas      │
  │ Auth token format        │ Internal impl details │
  │ Common domain types      │ Utility functions     │
  └─────────────────────────┴─────────────────────┘

  Principle: Service independence > DRY
  → Tolerate some duplication; maintain independent deployability
```

---

## 7. Anti-patterns

### Anti-pattern 1: WET (Write Everything Twice) Code

```python
# Bad: the same validation logic exists in subtly different forms
def validate_email_frontend(email):
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return bool(re.match(pattern, email))

def validate_email_backend(email):
    pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return bool(re.match(pattern, email))  # Subtly different!

# Good: single definition
EMAIL_PATTERN = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'

def validate_email(email: str) -> bool:
    """Validate email address format (single regex definition)"""
    return bool(re.match(EMAIL_PATTERN, email))
```

### Anti-pattern 2: Speculative Generality

```java
// Bad: building a framework that is not used
public interface DataExporter<T, F extends ExportFormat, C extends ExportConfig> {
    ExportResult<T> export(Collection<T> data, F format, C config);
    void registerPlugin(ExportPlugin<T> plugin);
    void setMiddleware(ExportMiddleware<T>... middlewares);
}
// All that is actually needed is "output a user list as CSV"

// Good: minimum necessary
public class UserCsvExporter {
    public String export(List<User> users) {
        StringBuilder csv = new StringBuilder("name,email\n");
        for (User u : users) {
            csv.append(u.getName()).append(",").append(u.getEmail()).append("\n");
        }
        return csv.toString();
    }
}
```

### Anti-pattern 3: DRY Fundamentalism (Wrong Abstraction)

```python
# Bad: forcibly consolidating coincidental similarities from different contexts
class GenericProcessor:
    def process(self, type: str, data: dict) -> dict:
        if type == 'user_registration':
            validated = self._validate(data, USER_RULES)
            result = self._save(data, 'users')
            self._notify(data['email'], 'welcome')
        elif type == 'email_campaign':
            validated = self._validate(data, CAMPAIGN_RULES)
            result = self._save(data, 'campaigns')
            self._notify(data['recipients'], 'campaign')
        return result

# Good: each context is independent
class UserRegistrationService:
    def register(self, user_data: dict) -> User:
        self.validator.validate(user_data)
        user = self.repository.save(user_data)
        self.mailer.send_welcome(user.email)
        return user

class EmailCampaignService:
    def launch(self, campaign_data: dict) -> Campaign:
        self.validator.validate(campaign_data)
        campaign = self.repository.save(campaign_data)
        self.mailer.send_campaign(campaign.recipients)
        return campaign
```

Sandi Metz's famous quote:

> "Duplication is far cheaper than the wrong abstraction"

---

## 8. Practice Exercises

### Exercise 1 (Basic): Detecting and Fixing DRY Violations

Identify the DRY violations in the code below and consolidate them appropriately.

```python
class OrderService:
    def calculate_domestic_shipping(self, weight: float) -> float:
        if weight <= 1.0:
            base = 500
        elif weight <= 5.0:
            base = 800
        elif weight <= 10.0:
            base = 1200
        else:
            base = 1200 + (weight - 10) * 100
        tax = base * 0.10
        return base + tax

    def calculate_express_shipping(self, weight: float) -> float:
        if weight <= 1.0:
            base = 500
        elif weight <= 5.0:
            base = 800
        elif weight <= 10.0:
            base = 1200
        else:
            base = 1200 + (weight - 10) * 100
        express_surcharge = base * 0.50
        base = base + express_surcharge
        tax = base * 0.10
        return base + tax
```

**Expected output example:**

```python
TAX_RATE = 0.10
EXPRESS_SURCHARGE_RATE = 0.50

def _calculate_base_shipping(weight: float) -> float:
    """Calculate the base shipping cost based on weight"""
    if weight <= 1.0:
        return 500.0
    elif weight <= 5.0:
        return 800.0
    elif weight <= 10.0:
        return 1200.0
    else:
        return 1200.0 + (weight - 10.0) * 100.0

def _apply_tax(amount: float) -> float:
    return amount * (1 + TAX_RATE)

class OrderService:
    def calculate_domestic_shipping(self, weight: float) -> float:
        base = _calculate_base_shipping(weight)
        return _apply_tax(base)

    def calculate_express_shipping(self, weight: float) -> float:
        base = _calculate_base_shipping(weight)
        base_with_surcharge = base * (1 + EXPRESS_SURCHARGE_RATE)
        return _apply_tax(base_with_surcharge)
```

### Exercise 2 (Intermediate): Judging DRY vs KISS

Determine which of the following two patterns is more appropriate and explain why.

**Pattern A (DRY-focused):**
```python
def format_entity(entity: dict, entity_type: str) -> str:
    template = TEMPLATES[entity_type]
    fields = FIELD_MAPPINGS[entity_type]
    result = template['header']
    for field in fields:
        result += f"  {field['label']}: {entity.get(field['key'], 'N/A')}\n"
    result += template['footer']
    return result
```

**Pattern B (KISS-focused):**
```python
def format_user(user: dict) -> str:
    return f"Name: {user.get('name', 'N/A')}\nEmail: {user.get('email', 'N/A')}"

def format_product(product: dict) -> str:
    return f"Product: {product.get('name', 'N/A')}\nPrice: {product.get('price', 'N/A')}"
```

**Expected analysis:** Pattern B is more appropriate. Each format expresses different "knowledge" and is only coincidentally similar in structure. Pattern A complicates the management of template configuration, violating KISS.

### Exercise 3 (Advanced): Designing a Balance of the Three Principles

Design a product search feature for an e-commerce site.

Current requirement: partial-match search by product name only
Future possibilities: category filtering, price range, sorting, pagination

**Expected output example:**

```python
from dataclasses import dataclass

@dataclass
class SearchQuery:
    """Search parameters (currently name only; fields can be added in the future)"""
    name: str

class ProductRepository:
    def search(self, query: SearchQuery) -> list:
        return self.db.query(
            "SELECT * FROM products WHERE name LIKE %s",
            (f"%{query.name}%",)
        )

class ProductSearchService:
    def __init__(self, repository: ProductRepository):
        self.repository = repository

    def search(self, name: str) -> list:
        query = SearchQuery(name=name)
        return self.repository.search(query)
```

Design rationale:
- **YAGNI**: Only name search is implemented now. Pagination etc. are deferred.
- **DIP**: Repository layer is separated (ensures testability).
- **KISS**: SearchQuery can have fields added in the future, but is simple for now.


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check config file path and format |
| Timeout | Network latency / resource shortage | Adjust timeout value, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check executing user's permissions, review settings |
| Data inconsistency | Concurrency conflict | Introduce locking, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify incrementally**: Use log output or a debugger to verify hypotheses
5. **Fix and run regression tests**: After fixing, also run tests for related areas

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
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
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

Diagnostic steps when a performance issue occurs:

1. **Identify the bottleneck**: Measure with a profiling tool
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O wait**: Check disk and network I/O conditions
4. **Check concurrent connections**: Check the state of the connection pool

| Problem type | Diagnostic tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Index, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes decision criteria for making technology choices.

| Criterion | When to prioritize | When it can be compromised |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                   │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. Deployment frequency?                        │
│    ├─ Weekly or less → Monolith + module split   │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. Independence between teams?                  │
│    ├─ High → Microservices                       │
│    └─ Medium → Modular monolith                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term cost and can delay a project

**2. Consistency vs Flexibility**
- A unified tech stack has low learning costs
- Diverse technology adoption allows the right tool for the job, but increases operational cost

**3. Level of Abstraction**
- Higher abstraction improves reusability but can make debugging harder
- Lower abstraction is intuitive but prone to code duplication

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
        """Describe background and problem"""
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
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't pursue perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually refreshing a system that has been in operation for 10 or more years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If there are no existing tests, create Characterization Tests first
- Coexist old and new systems via an API gateway
- Perform data migration incrementally

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, understanding dependencies | 2-4 weeks | Low |
| 2. Foundation | Build CI/CD, test environment | 4-6 weeks | Low |
| 3. Migration starts | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50 or more engineers developing the same product

**Approach:**
- Clarify boundaries with domain-driven design
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

| Optimization technique | Effect | Implementation cost | Applicable situation |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | Processing with heavy I/O wait |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Team Development Usage

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Has the documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Audience | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Entire team | Horizontal knowledge sharing |
| ADR (design records) | Each decision | Future members | Transparency of decisions |
| Retrospectives | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Critical design | Building consensus |

### Managing Technical Debt

```
Priority matrix:

        High impact
          │
    ┌─────┼─────┐
    │ Plan│ Fix  │
    │ it  │ now  │
    ├─────┼─────┤
    │ Log │ Next │
    │ it  │Sprint│
    │     │      │
    └─────┼─────┘
          │
        Low impact
    Low frequency  High frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk level | Countermeasure | Detection method |
|--------|------------|------|---------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication failures | High | Multi-factor authentication, stronger session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
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
        """Sanitize input value"""
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
- [ ] CORS policy is configured appropriately
- [ ] Vulnerability scanning of dependency packages is performed
- [ ] Error messages do not contain internal information

---

## Migration Guide

### Notes on Version Upgrades

| Version | Main changes | Migration work | Scope of impact |
|-----------|-----------|---------|---------|
| v1.x → v2.x | API design overhaul | Endpoint changes | All clients |
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

1. **Back up your data**: Take a full backup before migration
2. **Validate in a test environment**: Verify in advance in an environment equivalent to production
3. **Incremental rollout**: Deploy incrementally with a canary release
4. **Enhanced monitoring**: Shorten the monitoring interval during migration
5. **Define rollback criteria**: Define the criteria for deciding to roll back in advance
---

## 9. FAQ

### Q1: Does strictly following DRY end up making the code more complex?

That is correct. DRY is about "eliminating knowledge duplication," not "textually eliminating code duplication." Forcibly consolidating coincidental similarities from different contexts creates unnatural coupling and leads to KISS violations. The **Rule of Three** (consolidate on the third duplication) is a practical guideline.

### Q2: If you follow YAGNI, won't you end up needing large design changes later?

YAGNI does not mean "don't think about design"; it means "defer implementation." If you maintain a clean design (low coupling, high cohesion), extending things later is easy. Unnecessary upfront implementation carries the risk of locking in a design that diverges from actual needs.

### Q3: Isn't "simple" in KISS subjective?

To some extent, but objective metrics exist: cyclomatic complexity, cognitive complexity, number of dependencies, levels of abstraction, and the "can I predict what this function does from its name alone?" test.

### Q4: Should DRY be applied to test code as well?

In test code, **prioritize KISS (readability) over DRY**. Tests should be self-contained because they are read as specifications. However, test data generation and mock setup can be consolidated.

### Q5: How should DRY be approached in microservices?

Service independence > DRY. Shared libraries between services create coupling. Tolerate some duplication and maintain independent deployability.

### Q6: When the three principles conflict with each other, how should priority be determined?

Cases where the three principles conflict occur frequently in practice. The general priority order is as follows.

1. **KISS > DRY**: If consolidation makes the code more complex, tolerate some duplication. Sandi Metz's "Duplication is far cheaper than the wrong abstraction" is the guiding standard.
2. **YAGNI > DRY**: Avoid creating abstractions upfront by anticipating future duplication. Consolidate only after the third actual duplication occurs.
3. **KISS > YAGNI**: Cases where maintaining simplicity and future extensibility conflict are rare, but if "adding an extension point itself compromises simplicity," don't add the extension point.

However, these are not mechanical rules to apply blindly. The ultimate decision criterion is: **"Which choice allows a developer reading this code 6 months from now to understand and modify it in the shortest time?"**

```
  Decision flowchart:

  Duplication found
    │
    ├─ Has it appeared 3 or more times? ─No─→ Leave it as-is (YAGNI)
    │
   Yes
    │
    ├─ Does it express the same "knowledge"? ─No─→ Coincidental similarity, keep separate (KISS)
    │
   Yes
    │
    ├─ Can it be consolidated simply? ─No─→ Skip consolidation (KISS > DRY)
    │
   Yes
    │
    └─→ Consolidate (apply DRY)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not only through theory but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Principle | One-liner | Application tips | Signs of going too far |
|------|------|-----------|---------------|
| DRY | Centralize knowledge | Rule of Three | Unnatural abstractions |
| KISS | Keep it simple | Choose the most direct approach | Insufficient functionality |
| YAGNI | Only what's needed now | Implement requirement-driven | Design that is hard to extend |

### Three-Principle Application Checklist

| Checklist item | Principle |
|------------|------|
| Does this duplication express the same "knowledge"? | DRY |
| Can consolidation be achieved in the simplest way? | KISS |
| Is this abstraction necessary for the current use case? | YAGNI |
| Is it a common pattern used in 3 or more places? | Rule of Three |
| Does this design change improve readability? | KISS |
| Is it based on current requirements, not future ones? | YAGNI |

---

## Guides to Read Next

- [Coupling and Cohesion](./03-coupling-cohesion.md) ── Module design principles that underpin DRY and KISS
- [SOLID Principles](./01-solid.md) ── Especially the relationship between OCP and DRY
- [Function Design](../01-practices/01-functions.md) ── Practicing the KISS principle at the function level
- [Refactoring Techniques](../02-refactoring/01-refactoring-techniques.md) ── Concrete techniques for applying DRY
- [Code Smells](../02-refactoring/00-code-smells.md) ── Detecting duplication and code complexity
- Design Patterns: Behavioral ── DRY via Strategy and Template Method

---

## References

1. **Andrew Hunt, David Thomas** *The Pragmatic Programmer: Your Journey to Mastery* Addison-Wesley, 2019 (20th Anniversary Edition)
2. **Kent Beck** *Extreme Programming Explained: Embrace Change* Addison-Wesley, 2004 (2nd Edition)
3. **Sandi Metz** *Practical Object-Oriented Design: An Agile Primer Using Ruby* Addison-Wesley, 2018 (2nd Edition)
4. **John Ousterhout** *A Philosophy of Software Design* Yaknyam Press, 2018
5. **Sandi Metz** "The Wrong Abstraction" (blog post, 2016) ── An important discussion on over-applying DRY
6. **Martin Fowler** *Refactoring: Improving the Design of Existing Code* Addison-Wesley, 2018
7. **Ron Jeffries** "You're NOT Gonna Need It!" (XP Magazine, 1998) ── The original source of YAGNI
8. **Donald Knuth** "Structured Programming with go to Statements" Computing Surveys, 1974 ── The original source of "premature optimization"
