# Error Handling ── Exceptions, Result Types, and Robust Error Processing

> Error handling determines the reliability of a program. Writing only the happy path is easy, but handling exceptional cases properly is the mark of professional code. Understand when to use exceptions, Result types, and error codes, and build resilient systems.
>
> -- Robert C. Martin, *Clean Code* Chapter 7

---

## What You Will Learn in This Chapter

1. **Core Error Handling Strategies** ── Understand when to use exceptions, Result types, and error codes, and the recommended patterns for each language
2. **Exception Design Principles** ── Master checked vs unchecked exceptions, custom exception hierarchies, and cross-layer exception translation
3. **Type-Safe Error Handling with Result Types** ── Learn implementation patterns in TypeScript, Python, and Rust, including monadic composition
4. **Robust Error Handling Patterns** ── Practice Fail Fast, guard clauses, Circuit Breaker, and graceful degradation
5. **Structured Logging and Error Monitoring** ── Understand the design of error tracking, analysis, and alerting in production environments

---

## Prerequisites

| Topic | Required Level | Reference Guide |
|---------|-----------|-----------|
| Function Design | Basic | [Function Design](./01-functions.md) |
| Type Systems | Basic | Language-specific type system documentation |
| Clean Code Overview | Understood | [Clean Code Overview](../00-principles/00-clean-code-overview.md) |
| Coupling & Cohesion | Understood | [Coupling and Cohesion](../00-principles/03-coupling-cohesion.md) |
| Design Patterns | Recommended | GoF Patterns reference |

---

## Why Error Handling Matters

### The Quality of Error Handling Determines System-Wide Reliability

```
  Relationship Between Error Handling Quality and System Failures

  Failure Rate
  (per month)
    │
  20│ ●  Swallowed exceptions
    │
  15│    ●  Broad catch + log only
    │
  10│       ●  Basic exception handling
    │
   5│          ●  Custom exception hierarchy
    │              ●  Result types + monitoring
   1│                 ●  Fail Fast + Circuit Breaker + structured logging
    └──────────────────────────────────────────
     Low ──────── Error Handling Maturity ────────── High
```

### The Cost of Inadequate Error Handling

| Problem | Impact | Example |
|------|------|------|
| Swallowed exceptions | Data loss, integrity violations | Payment failure goes unnoticed; product ships without being charged |
| Improper retries | Failure amplification | Infinite retries to payment API cause double billing |
| Insufficient error info | Increased investigation time | A log with just "an error occurred" requires days to diagnose |
| Overly broad catches | Hidden bugs | NullPointerException is swallowed; root cause is never found |
| Security info leakage | Information disclosed to attackers | Stack traces shown to users reveal internal architecture |

### The Ariane 5 Lesson

The 1996 Ariane 5 rocket launch failure was caused by a failure in error handling. An overflow exception occurred when converting a 64-bit floating-point value to a 16-bit integer, but it was not handled properly. The system halted, and the rocket self-destructed. The estimated loss was approximately 500 million dollars.

**Lesson: Errors will always occur. The question is not whether errors happen, but how you respond when they do.**

---

## 1. Overview of Error Handling Strategies

### 1.1 The Three Approaches

```
+---------------------------------------------------------------------+
|  Three Approaches to Error Handling                                  |
+---------------------------------------------------------------------+
|  1. Exceptions                                                       |
|     → Propagate unexpected errors up the call stack                  |
|     → Java, Python, C#, TypeScript, Ruby, Kotlin                    |
|     → Pros: Separation of happy path and error path                 |
|     → Cons: Risk of missed handling, performance cost               |
+---------------------------------------------------------------------+
|  2. Result/Either Types                                              |
|     → Express success/failure as types, checked at compile time     |
|     → Rust (Result), Go (error), Haskell (Either), Scala (Try)      |
|     → Pros: Type-safe, handling enforced, zero cost                 |
|     → Cons: Code tends to become verbose                            |
+---------------------------------------------------------------------+
|  3. Error Codes (Legacy)                                             |
|     → Signal errors through function return values                  |
|     → A C language tradition. Not recommended in modern code        |
|     → Pros: Simple, performant                                       |
|     → Cons: Easily ignored, not type-safe                           |
+---------------------------------------------------------------------+
```

### 1.2 Classifying Errors

Correctly classifying errors is the first step toward choosing the right handling strategy.

```
  Error Classification and Response Strategy

  ┌─────────────────────────────────────────────────────────────┐
  │              Programming Errors (Bugs)                       │
  │  · Null references, array out of bounds, type errors,       │
  │    assertion failures                                        │
  │  → Bugs that must be fixed. Fail Fast: stop immediately     │
  │  → Report via (unchecked) exceptions. No retry              │
  ├─────────────────────────────────────────────────────────────┤
  │              Business Errors (Expected Failures)             │
  │  · Out of stock, insufficient balance, unauthorized,        │
  │    validation failures                                       │
  │  → Expected errors. Express with Result types or            │
  │    dedicated exceptions                                      │
  │  → Return appropriate messages to users                     │
  ├─────────────────────────────────────────────────────────────┤
  │              Infrastructure Errors (Transient Failures)      │
  │  · DB connection failure, network timeout, disk full        │
  │  → Temporary failures. Retry or Circuit Breaker             │
  │  → Graceful degradation                                     │
  ├─────────────────────────────────────────────────────────────┤
  │              Fatal Errors                                    │
  │  · Out of memory, corrupted config, missing startup         │
  │    dependencies                                             │
  │  → Cannot recover. Log and shut down safely                 │
  │  → Auto-restart via process monitor                         │
  └─────────────────────────────────────────────────────────────┘
```

### 1.3 Error Handling Decision Flowchart

```
  Error occurs
       │
       ▼
  ┌───────────────────┐
  │ Programming error? │
  └────┬──────┬────────┘
       │Yes   │No
       ▼      ▼
  Fail Fast   ┌───────────────────┐
  (stop now)  │ Business error?    │
              └────┬──────┬────────┘
                   │Yes   │No
                   ▼      ▼
           Result type or ┌───────────────────┐
           dedicated      │ Transient error?   │
           exception      └────┬──────┬────────┘
                              │Yes   │No
                              ▼      ▼
                         Retry      Fatal error
                         + Circuit  → Log + safe shutdown
                         Breaker
```

---

## 2. Exception Design

### 2.1 Basic Exception Principles

| Principle | Description |
|------|------|
| Throw specific exceptions | Use `UserNotFoundError` instead of `Exception` |
| Catch specific exceptions | Use `PaymentDeclinedError` instead of `Exception` |
| Keep try-catch scope minimal | Only wrap the operations that can fail |
| Translate exceptions across layers | Convert infrastructure exceptions to domain exceptions |
| Include sufficient context in exceptions | What, why, and which ID |
| Never include sensitive information in exceptions | Passwords and tokens are absolutely forbidden |

### 2.2 Custom Exception Hierarchy Design

**Code Example 1: Application Exception Hierarchy (Python)**

```python
"""
Application-specific exception hierarchy

Design principles:
- All application exceptions extend AppError
- Programmatically identifiable via error code (string)
- Maps to HTTP status codes
- Provides both machine-readable error info and human-readable messages
"""
from __future__ import annotations
from typing import Any
from datetime import datetime


class AppError(Exception):
    """Base application exception"""

    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN",
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        self.timestamp = datetime.utcnow()

    def to_dict(self) -> dict[str, Any]:
        """Dictionary representation for API responses"""
        return {
            "error": {
                "code": self.code,
                "message": str(self),
                "details": self.details,
                "timestamp": self.timestamp.isoformat(),
            }
        }


# ── Business Errors ──────────────────────────────

class ValidationError(AppError):
    """Input validation error (400 Bad Request)"""

    def __init__(self, field: str, message: str, value: Any = None):
        super().__init__(
            message,
            code="VALIDATION_ERROR",
            status_code=400,
            details={"field": field, "rejected_value": repr(value)},
        )
        self.field = field


class NotFoundError(AppError):
    """Resource not found error (404 Not Found)"""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            f"{resource} (ID: {identifier}) was not found",
            code="NOT_FOUND",
            status_code=404,
            details={"resource": resource, "identifier": identifier},
        )
        self.resource = resource
        self.identifier = identifier


class ConflictError(AppError):
    """Resource conflict error (409 Conflict)"""

    def __init__(self, resource: str, message: str):
        super().__init__(
            message,
            code="CONFLICT",
            status_code=409,
            details={"resource": resource},
        )


class AuthorizationError(AppError):
    """Insufficient permissions error (403 Forbidden)"""

    def __init__(self, action: str, resource: str | None = None):
        msg = f"You do not have permission to perform '{action}'"
        if resource:
            msg += f" (target: {resource})"
        super().__init__(
            msg,
            code="FORBIDDEN",
            status_code=403,
            details={"action": action, "resource": resource},
        )


class BusinessRuleViolationError(AppError):
    """Business rule violation error (422 Unprocessable Entity)"""

    def __init__(self, rule: str, message: str):
        super().__init__(
            message,
            code="BUSINESS_RULE_VIOLATION",
            status_code=422,
            details={"rule": rule},
        )


# ── Infrastructure Errors ──────────────────────────────

class InfrastructureError(AppError):
    """Base infrastructure exception"""

    def __init__(self, message: str, code: str = "INFRASTRUCTURE_ERROR"):
        super().__init__(message, code=code, status_code=503)


class DataAccessError(InfrastructureError):
    """Database access error"""

    def __init__(self, message: str, cause: Exception | None = None):
        super().__init__(message, code="DATA_ACCESS_ERROR")
        self.__cause__ = cause


class ExternalServiceError(InfrastructureError):
    """External service communication error"""

    def __init__(self, service: str, message: str, cause: Exception | None = None):
        super().__init__(
            f"External service '{service}' error: {message}",
            code="EXTERNAL_SERVICE_ERROR",
        )
        self.service = service
        self.__cause__ = cause


# ── Usage Example ────────────────────────────────────────

class UserService:
    def __init__(self, repository, auth_service):
        self.repository = repository
        self.auth_service = auth_service

    def get_user(self, user_id: str) -> User:
        """Retrieve a user. Raises NotFoundError if not found."""
        user = self.repository.find_by_id(user_id)
        if user is None:
            raise NotFoundError("User", user_id)
        return user

    def update_email(self, user_id: str, new_email: str, actor: User) -> User:
        """Update a user's email address."""
        # Authorization check
        if not self.auth_service.can(actor, "update_user", user_id):
            raise AuthorizationError("update_user", f"User:{user_id}")

        # Validation
        if not self._is_valid_email(new_email):
            raise ValidationError("email", "Invalid email address format", new_email)

        # Duplicate check
        existing = self.repository.find_by_email(new_email)
        if existing and existing.id != user_id:
            raise ConflictError("User", f"Email '{new_email}' is already in use")

        user = self.get_user(user_id)
        user.email = new_email
        return self.repository.save(user)
```

### 2.3 Appropriate Scope for try-catch

**Code Example 2: try-catch Scope Design (Java)**

```java
// ──────────────────────────────────────────────────
// Bad: try scope is too broad
// ──────────────────────────────────────────────────
// Problems:
// 1. Unclear which operation caused the exception
// 2. catch(Exception) silences all exceptions
// 3. A failed email delivery rolls back the entire order
try {
    User user = userRepository.findById(userId);
    Order order = new Order(user);
    order.addItem(item);
    order.calculateTotal();
    paymentService.charge(order);
    emailService.sendConfirmation(user, order);
    analyticsService.track(order);
} catch (Exception e) {
    logger.error("An error occurred", e);  // unclear what kind of error
}

// ──────────────────────────────────────────────────
// Good: separate try-catch blocks by operation criticality
// ──────────────────────────────────────────────────
// Principles:
// 1. Catch critical operations (payments) precisely
// 2. Use a separate try block for non-critical operations (notifications)
// 3. Catch specific exception types

// Phase 1: Pre-processing (no try needed — exception means abort)
User user = userRepository.findById(userId);
if (user == null) {
    return OrderResult.userNotFound(userId);
}

Order order = new Order(user);
order.addItem(item);
order.calculateTotal();

// Phase 2: Payment (failure is business-critical — catch precisely)
try {
    paymentService.charge(order);
} catch (PaymentDeclinedException e) {
    logger.info("Payment declined: userId={}, reason={}", userId, e.getReason());
    return OrderResult.paymentFailed(e.getReason());
} catch (PaymentGatewayException e) {
    logger.error("Payment gateway connection error: orderId={}", order.getId(), e);
    return OrderResult.systemError("Cannot connect to payment system. Please try again later.");
}

// Phase 3: Order confirmation (must not fail here)
orderRepository.save(order);

// Phase 4: Notification (failure does not roll back the order)
try {
    emailService.sendConfirmation(user, order);
} catch (EmailServiceException e) {
    logger.warn("Confirmation email failed (order succeeded): orderId={}", order.getId(), e);
    // Add failed notification to retry queue
    notificationRetryQueue.enqueue(new EmailNotification(user, order));
}

// Phase 5: Analytics (completely optional)
try {
    analyticsService.track(order);
} catch (Exception e) {
    logger.debug("Analytics event failed (ignored): orderId={}", order.getId(), e);
    // Missing analytics data is acceptable
}
```

### 2.4 Exception Translation (Across Layers)

Translate exceptions at layer boundaries. This prevents upper layers from depending on the implementation details of lower layers.

```
  Exception Translation Flow

  ┌──────────────────────────────────┐
  │  Controller Layer                 │  HttpException → HTTP Response
  │  Domain exception → HTTP status  │  (404, 403, 422, 500)
  ├──────────────────────────────────┤
  │  Service Layer                    │  Propagates domain exceptions as-is
  │  Business rule validation         │  (may also raise new exceptions)
  ├──────────────────────────────────┤
  │  Repository Layer                 │  Infrastructure exception → Domain exception
  │  SQLError → DataAccessError      │  (translation happens here)
  ├──────────────────────────────────┤
  │  Infrastructure Layer             │  Raw infrastructure exceptions
  │  SQLError, ConnectionError, etc  │  (not exposed directly to upper layers)
  └──────────────────────────────────┘
```

**Code Example 3: Cross-Layer Exception Translation (TypeScript)**

```typescript
// ====================================================================
// Infrastructure Layer: raw exceptions
// ====================================================================
// pg (PostgreSQL client) throws DatabaseError

// ====================================================================
// Repository Layer: infrastructure exception → domain exception
// ====================================================================
class UserRepository {
  constructor(private db: DatabasePool) {}

  async findById(id: string): Promise<User> {
    try {
      const row = await this.db.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (!row) {
        throw new UserNotFoundError(id);
      }

      return this.mapToUser(row);
    } catch (error) {
      // Re-throw domain exceptions as-is
      if (error instanceof AppError) throw error;

      // PostgreSQL unique constraint violation → domain exception
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new ConflictError('User', `ID ${id} already exists`);
      }

      // Wrap other infrastructure exceptions
      throw new DataAccessError(
        `Failed to retrieve user (ID: ${id})`,
        { cause: error }
      );
    }
  }

  async save(user: User): Promise<User> {
    try {
      await this.db.query(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3) ' +
        'ON CONFLICT (id) DO UPDATE SET name = $2, email = $3',
        [user.id, user.name, user.email]
      );
      return user;
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new ConflictError('User', `Email '${user.email}' is already in use`);
      }
      throw new DataAccessError(
        `Failed to save user (ID: ${user.id})`,
        { cause: error }
      );
    }
  }
}

// ====================================================================
// Service Layer: propagate domain exceptions as-is (or raise new ones)
// ====================================================================
class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
  ) {}

  async getUser(id: string): Promise<User> {
    // Repository exceptions (NotFoundError, DataAccessError) propagate as-is
    return this.userRepository.findById(id);
  }

  async updateEmail(userId: string, newEmail: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    // Business rule validation (raise new domain exceptions)
    if (!this.isValidEmail(newEmail)) {
      throw new ValidationError('email', 'Invalid email address format');
    }

    user.email = newEmail;
    return this.userRepository.save(user);
  }
}

// ====================================================================
// Controller Layer: domain exception → HTTP response
// ====================================================================
class UserController {
  constructor(private userService: UserService) {}

  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.userService.getUser(req.params.id);
      res.json(user);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateEmail(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.userService.updateEmail(
        req.params.id,
        req.body.email
      );
      res.json(user);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private handleError(res: Response, error: unknown): void {
    if (error instanceof AppError) {
      // Domain exception → appropriate HTTP status code
      res.status(error.statusCode).json(error.toDict());
    } else {
      // Unexpected exception → 500
      console.error('Unexpected error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'A server error occurred',
        },
      });
    }
  }
}

// ====================================================================
// Global Error Handler (Express middleware)
// ====================================================================
function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Structured logging
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    errorType: error.constructor.name,
    message: error.message,
    stack: error.stack,
    requestId: req.headers['x-request-id'],
  };

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(logEntry);
    } else {
      logger.warn(logEntry);
    }
    res.status(error.statusCode).json(error.toDict());
  } else {
    logger.error(logEntry);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'A server error occurred',
      },
    });
  }
}
```

### 2.5 Checked vs Unchecked Exceptions (Java-Specific Discussion)

Java's checked exceptions have been debated for a long time.

```
  Pros and Cons of Checked Exceptions

  ┌──────────────────────────────────────────────────┐
  │  Checked Exceptions                               │
  │  · FileNotFoundException, SQLException            │
  │  · Pro: Forces callers to handle them            │
  │  · Con: Violates OCP (lower-layer changes        │
  │    ripple through method signatures)              │
  │  · Con: Proliferation of catch blocks harms      │
  │    readability                                    │
  │  → Robert C. Martin: "The cost of checked        │
  │    exceptions is too high"                        │
  ├──────────────────────────────────────────────────┤
  │  Unchecked Exceptions                             │
  │  · NullPointerException, IllegalArgumentException │
  │  · Pro: Keeps method signatures clean            │
  │  · Con: Risk of missed handling                  │
  │  → Kotlin, Scala, C# adopt only unchecked        │
  └──────────────────────────────────────────────────┘
```

**Code Example 4: Checked Exception OCP Violation Problem**

```java
// Example of checked exceptions violating the Open-Closed Principle

// Step 1: Initial implementation
class UserRepository {
    User findById(String id) throws SQLException {  // declares SQLException
        return db.query("SELECT ...");
    }
}

class UserService {
    User getUser(String id) throws SQLException {   // must propagate it
        return repository.findById(id);
    }
}

class UserController {
    void getUser(Request req) throws SQLException {  // propagates further
        userService.getUser(req.getParam("id"));
    }
}

// Step 2: Switching to MongoDB
// → Change throws to MongoException in findById
// → UserService and UserController also need their throws updated!
// → Open-Closed Principle violation

// Solution: wrap in unchecked exception
class UserRepository {
    User findById(String id) {
        try {
            return db.query("SELECT ...");
        } catch (SQLException e) {
            throw new DataAccessException("Failed to retrieve user", e);  // unchecked exception
        }
    }
}
// → UserService and UserController require no changes
```

---

## 3. The Result Type Pattern

### Why Result Types Are Needed

Let's review the problems with exceptions.

```
  Problems with Exceptions

  1. Not visible in the function signature (TypeScript, Python)
     function getUser(id: string): User
     // The fact that this function may throw UserNotFoundError
     // is not apparent from the signature

  2. Missed catches do not cause compile errors
     const user = getUser(id);  // exception thrown → crash

  3. Performance cost
     Exception creation builds a stack trace → expensive
     Business errors (insufficient balance, etc.) may occur frequently
```

Result types solve these problems.

### 3.1 Result Types in TypeScript

**Code Example 5: Complete Result Type Implementation (TypeScript)**

```typescript
// ====================================================================
// Result type definition
// ====================================================================
type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Factory functions
function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ====================================================================
// Result type utility functions
// ====================================================================

/** Transform a Result (success case only) */
function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/** Flat-map a Result (for chaining) */
function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/** Convert a throwing function to a Result */
function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/** Async version */
async function tryCatchAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/** Combine multiple Results */
function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}

// ====================================================================
// Practical Example: Fund Transfer
// ====================================================================

// Business error type definition (Discriminated Union)
type TransferError =
  | { type: 'INSUFFICIENT_BALANCE'; available: number; requested: number }
  | { type: 'ACCOUNT_LOCKED'; reason: string }
  | { type: 'DAILY_LIMIT_EXCEEDED'; limit: number; current: number }
  | { type: 'SAME_ACCOUNT'; accountId: string }
  | { type: 'INVALID_AMOUNT'; amount: number };

function validateTransferAmount(amount: number): Result<number, TransferError> {
  if (amount <= 0 || !Number.isFinite(amount)) {
    return err({ type: 'INVALID_AMOUNT', amount });
  }
  return ok(amount);
}

function checkAccountStatus(account: Account): Result<Account, TransferError> {
  if (account.isLocked) {
    return err({ type: 'ACCOUNT_LOCKED', reason: account.lockReason });
  }
  return ok(account);
}

function checkBalance(
  account: Account,
  amount: number
): Result<Account, TransferError> {
  if (account.balance < amount) {
    return err({
      type: 'INSUFFICIENT_BALANCE',
      available: account.balance,
      requested: amount,
    });
  }
  return ok(account);
}

function checkDailyLimit(
  account: Account,
  amount: number
): Result<Account, TransferError> {
  const DAILY_LIMIT = 1_000_000;
  if (account.dailyTransferred + amount > DAILY_LIMIT) {
    return err({
      type: 'DAILY_LIMIT_EXCEEDED',
      limit: DAILY_LIMIT,
      current: account.dailyTransferred,
    });
  }
  return ok(account);
}

function transfer(
  from: Account,
  to: Account,
  amount: number
): Result<TransferReceipt, TransferError> {
  // Same account check
  if (from.id === to.id) {
    return err({ type: 'SAME_ACCOUNT', accountId: from.id });
  }

  // Validation chain
  const amountResult = validateTransferAmount(amount);
  if (!amountResult.ok) return amountResult as Result<never, TransferError>;

  const statusResult = checkAccountStatus(from);
  if (!statusResult.ok) return statusResult as Result<never, TransferError>;

  const balanceResult = checkBalance(from, amount);
  if (!balanceResult.ok) return balanceResult as Result<never, TransferError>;

  const limitResult = checkDailyLimit(from, amount);
  if (!limitResult.ok) return limitResult as Result<never, TransferError>;

  // All checks passed → execute transfer
  from.balance -= amount;
  to.balance += amount;
  from.dailyTransferred += amount;

  return ok(new TransferReceipt(from, to, amount, new Date()));
}

// Caller: handling all error cases is enforced
const result = transfer(accountA, accountB, 50000);

if (result.ok) {
  console.log(`Transfer successful: ${result.value.receiptId}`);
} else {
  // TypeScript type narrowing infers the correct type for each case
  switch (result.error.type) {
    case 'INSUFFICIENT_BALANCE':
      console.log(
        `Insufficient balance: available ${result.error.available} < requested ${result.error.requested}`
      );
      break;
    case 'ACCOUNT_LOCKED':
      console.log(`Account is locked: ${result.error.reason}`);
      break;
    case 'DAILY_LIMIT_EXCEEDED':
      console.log(
        `Daily limit exceeded: limit ${result.error.limit}, transferred today ${result.error.current}`
      );
      break;
    case 'SAME_ACCOUNT':
      console.log(`Cannot transfer to the same account: ${result.error.accountId}`);
      break;
    case 'INVALID_AMOUNT':
      console.log(`Invalid amount: ${result.error.amount}`);
      break;
  }
}
```

### 3.2 Result Types in Python

**Code Example 6: Python Result Type (with Pattern Matching)**

```python
"""
Result type implementation using Python 3.10+ pattern matching.
Provides an API close to Rust's Result<T, E>.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Generic, TypeVar, Callable, Union

T = TypeVar('T')
U = TypeVar('U')
E = TypeVar('E')


@dataclass(frozen=True)
class Ok(Generic[T]):
    """Type representing success"""
    value: T

    def is_ok(self) -> bool:
        return True

    def is_err(self) -> bool:
        return False

    def map(self, fn: Callable[[T], U]) -> Result[U, E]:
        """Transform the success value"""
        return Ok(fn(self.value))

    def flat_map(self, fn: Callable[[T], Result[U, E]]) -> Result[U, E]:
        """Chain with a function that returns a Result"""
        return fn(self.value)

    def unwrap(self) -> T:
        """Get the success value (raises on failure)"""
        return self.value

    def unwrap_or(self, default: T) -> T:
        """Get the success value (returns default on failure)"""
        return self.value

    def map_err(self, fn: Callable) -> Result[T, E]:
        """Transform the error value (no-op on success)"""
        return self


@dataclass(frozen=True)
class Err(Generic[E]):
    """Type representing failure"""
    error: E

    def is_ok(self) -> bool:
        return False

    def is_err(self) -> bool:
        return True

    def map(self, fn: Callable) -> Result:
        """Transform the success value (no-op on failure)"""
        return self

    def flat_map(self, fn: Callable) -> Result:
        """Transform the success value (no-op on failure)"""
        return self

    def unwrap(self):
        """Get the success value (raises on failure)"""
        raise ValueError(f"Attempted to unwrap an Err: {self.error}")

    def unwrap_or(self, default):
        """Get the success value (returns default on failure)"""
        return default

    def map_err(self, fn: Callable[[E], U]) -> Result[T, U]:
        """Transform the error value"""
        return Err(fn(self.error))


Result = Union[Ok[T], Err[E]]


# ── Utility Functions ────────────────────────────

def try_catch(fn: Callable[[], T]) -> Result[T, Exception]:
    """Convert a throwing function to a Result"""
    try:
        return Ok(fn())
    except Exception as e:
        return Err(e)


# ── Practical Example: User Registration Validation ────────────

@dataclass(frozen=True)
class RegistrationError:
    field: str
    message: str


def validate_username(name: str) -> Result[str, RegistrationError]:
    if len(name) < 3:
        return Err(RegistrationError("username", "Username must be at least 3 characters"))
    if len(name) > 20:
        return Err(RegistrationError("username", "Username must be 20 characters or fewer"))
    if not name.isalnum():
        return Err(RegistrationError("username", "Username may only contain alphanumeric characters"))
    return Ok(name.lower())


def validate_email(email: str) -> Result[str, RegistrationError]:
    if "@" not in email:
        return Err(RegistrationError("email", "Invalid email address format"))
    if email.count("@") > 1:
        return Err(RegistrationError("email", "Only one @ character is allowed"))
    return Ok(email.lower())


def validate_password(password: str) -> Result[str, RegistrationError]:
    if len(password) < 8:
        return Err(RegistrationError("password", "Password must be at least 8 characters"))
    if not any(c.isupper() for c in password):
        return Err(RegistrationError("password", "Password must contain at least one uppercase letter"))
    if not any(c.isdigit() for c in password):
        return Err(RegistrationError("password", "Password must contain at least one digit"))
    return Ok(password)


@dataclass
class RegistrationData:
    username: str
    email: str
    password: str


def validate_registration(
    username: str,
    email: str,
    password: str,
) -> Result[RegistrationData, list[RegistrationError]]:
    """Run all validations and return errors collected together"""
    errors: list[RegistrationError] = []

    username_result = validate_username(username)
    email_result = validate_email(email)
    password_result = validate_password(password)

    # Collect errors
    for result in [username_result, email_result, password_result]:
        match result:
            case Err(error):
                errors.append(error)

    if errors:
        return Err(errors)

    # All succeeded (unwrap is safe here)
    return Ok(RegistrationData(
        username=username_result.unwrap(),
        email=email_result.unwrap(),
        password=password_result.unwrap(),
    ))


# Usage with pattern matching (Python 3.10+)
match validate_registration("ab", "invalid", "short"):
    case Ok(data):
        print(f"Registration successful: {data.username}")
    case Err(errors):
        for error in errors:
            print(f"  [{error.field}] {error.message}")
        # Output:
        #   [username] Username must be at least 3 characters
        #   [email] Invalid email address format
        #   [password] Password must be at least 8 characters
```

### 3.3 Rust's Result Type

**Code Example 7: Rust Native Result Type**

```rust
use std::fs;
use std::io;
use std::num::ParseIntError;

// ── Custom Error Type ────────────────────────────
#[derive(Debug)]
enum ConfigError {
    IoError(io::Error),
    ParseError(ParseIntError),
    MissingField(String),
    InvalidValue { field: String, value: String, reason: String },
}

// Automatic conversion via the From trait
impl From<io::Error> for ConfigError {
    fn from(error: io::Error) -> Self {
        ConfigError::IoError(error)
    }
}

impl From<ParseIntError> for ConfigError {
    fn from(error: ParseIntError) -> Self {
        ConfigError::ParseError(error)
    }
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::IoError(e) => write!(f, "IO error: {}", e),
            ConfigError::ParseError(e) => write!(f, "Parse error: {}", e),
            ConfigError::MissingField(field) => write!(f, "Field '{}' not found", field),
            ConfigError::InvalidValue { field, value, reason } =>
                write!(f, "Invalid value '{}' for field '{}': {}", value, field, reason),
        }
    }
}

impl std::error::Error for ConfigError {}

// ── Automatic Conversion and Error Propagation via the ? Operator ──────────
struct Config {
    host: String,
    port: u16,
    max_connections: u32,
}

fn load_config(path: &str) -> Result<Config, ConfigError> {
    // ? operator: automatically converts io::Error → ConfigError and returns early
    let content = fs::read_to_string(path)?;

    let mut host = None;
    let mut port = None;
    let mut max_connections = None;

    for line in content.lines() {
        let parts: Vec<&str> = line.splitn(2, '=').collect();
        if parts.len() != 2 { continue; }

        let key = parts[0].trim();
        let value = parts[1].trim();

        match key {
            "host" => host = Some(value.to_string()),
            "port" => {
                // ? operator: automatically converts ParseIntError → ConfigError
                let p: u16 = value.parse()?;
                if p == 0 {
                    return Err(ConfigError::InvalidValue {
                        field: "port".to_string(),
                        value: value.to_string(),
                        reason: "Port number must be 1 or greater".to_string(),
                    });
                }
                port = Some(p);
            },
            "max_connections" => {
                max_connections = Some(value.parse()?);
            },
            _ => {} // ignore unknown keys
        }
    }

    Ok(Config {
        host: host.ok_or(ConfigError::MissingField("host".to_string()))?,
        port: port.ok_or(ConfigError::MissingField("port".to_string()))?,
        max_connections: max_connections.unwrap_or(100), // default value
    })
}

fn main() {
    match load_config("server.conf") {
        Ok(config) => {
            println!("Server starting: {}:{}", config.host, config.port);
            println!("Max connections: {}", config.max_connections);
        }
        Err(e) => {
            eprintln!("Failed to load config file: {}", e);
            std::process::exit(1);
        }
    }
}
```

### 3.4 Error Handling in Go

**Code Example 8: Explicit Error Handling in Go**

```go
package user

import (
    "errors"
    "fmt"
    "regexp"
)

// ── Sentinel Errors (predefined errors for comparison) ────
var (
    ErrNotFound       = errors.New("user not found")
    ErrAlreadyExists  = errors.New("user already exists")
    ErrInvalidEmail   = errors.New("invalid email format")
    ErrAccountLocked  = errors.New("account is locked")
)

// ── Structured Error Type ────────────────────────────
type ValidationError struct {
    Field   string
    Message string
    Value   interface{}
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error: field=%s, message=%s, value=%v",
        e.Field, e.Message, e.Value)
}

// ── Error Wrapping (Go 1.13+) ────────────────
type RepositoryError struct {
    Operation string
    UserID    string
    Err       error // holds the original error
}

func (e *RepositoryError) Error() string {
    return fmt.Sprintf("repository error: op=%s, userId=%s: %v",
        e.Operation, e.UserID, e.Err)
}

func (e *RepositoryError) Unwrap() error {
    return e.Err
}

// ── Service Implementation ────────────────────────────────
type UserService struct {
    repo UserRepository
}

func (s *UserService) GetUser(id string) (*User, error) {
    user, err := s.repo.FindByID(id)
    if err != nil {
        // Handle based on error type
        if errors.Is(err, ErrNotFound) {
            return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
        }
        // Wrap infrastructure error
        return nil, &RepositoryError{
            Operation: "FindByID",
            UserID:    id,
            Err:       err,
        }
    }
    return user, nil
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

func (s *UserService) UpdateEmail(userID, newEmail string) error {
    // Validation
    if !emailRegex.MatchString(newEmail) {
        return &ValidationError{
            Field:   "email",
            Message: "Invalid email address format",
            Value:   newEmail,
        }
    }

    user, err := s.GetUser(userID)
    if err != nil {
        return err  // propagate error as-is
    }

    user.Email = newEmail
    if err := s.repo.Save(user); err != nil {
        return &RepositoryError{
            Operation: "Save",
            UserID:    userID,
            Err:       err,
        }
    }

    return nil
}

// ── Caller: distinguish errors with errors.Is / errors.As ────
func handleUpdateEmail(userID, email string) {
    svc := &UserService{repo: NewPostgresRepo()}

    err := svc.UpdateEmail(userID, email)
    if err == nil {
        fmt.Println("Update successful")
        return
    }

    // errors.Is: search for a sentinel error in the error chain
    if errors.Is(err, ErrNotFound) {
        fmt.Printf("User %s not found\n", userID)
        return
    }

    // errors.As: search for a typed error in the error chain
    var validationErr *ValidationError
    if errors.As(err, &validationErr) {
        fmt.Printf("Input error: %s - %s\n",
            validationErr.Field, validationErr.Message)
        return
    }

    var repoErr *RepositoryError
    if errors.As(err, &repoErr) {
        fmt.Printf("System error: %s (operation=%s)\n",
            repoErr.Error(), repoErr.Operation)
        return
    }

    fmt.Printf("Unexpected error: %v\n", err)
}
```

---

## 4. Exceptions vs Result Types: When to Use Which

### 4.1 Decision Criteria

| Criterion | Exceptions | Result Types |
|------|------|---------|
| Programming errors | Best (crash immediately) | Inappropriate (bugs should not be expressed as types) |
| Business errors | Possible but verbose | Best (expressed as types, handling enforced) |
| Unexpected errors | Best | Inappropriate (cannot type what is unexpected) |
| Enforcing error handling | Cannot enforce (missed catch) | Enforced at compile time (switch exhaustiveness) |
| Performance | High cost (stack trace generation) | Zero cost (ordinary return value) |
| Code readability | Happy path remains clean | Error checks tend to be scattered |
| Debuggability | Stack trace available | Finding the source can be harder |
| Composability | Nested try-catch required | Composable via map/flatMap |

### 4.2 Hybrid Approach (Recommended)

```
  Hybrid Approach

  ┌──────────────────────────────────────────────────┐
  │  Infrastructure Layer                             │
  │  → Use exceptions (DB, network errors, etc.)     │
  │  → Catch with try-catch and convert to Result    │
  ├──────────────────────────────────────────────────┤
  │  Domain Layer                                     │
  │  → Use Result types (business rule violations)   │
  │  → Type-safe, no missed handling                 │
  ├──────────────────────────────────────────────────┤
  │  Application Layer                                │
  │  → Aggregate Results, generate error responses   │
  │  → Unexpected exceptions caught by global handler│
  └──────────────────────────────────────────────────┘
```

**Code Example 9: Hybrid Approach (TypeScript)**

```typescript
// Infrastructure layer: exception → Result conversion
class UserRepositoryImpl implements UserRepository {
  async findById(id: string): Promise<Result<User, AppError>> {
    try {
      const row = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
      if (!row) {
        return err(new NotFoundError('User', id));
      }
      return ok(this.mapToUser(row));
    } catch (error) {
      // Convert infrastructure exception to Result
      return err(new DataAccessError('Failed to retrieve user', { cause: error }));
    }
  }
}

// Domain layer: pure Result types
function applyDiscount(
  order: Order,
  coupon: Coupon,
): Result<Order, DiscountError> {
  if (coupon.isExpired()) {
    return err({ type: 'COUPON_EXPIRED', expiredAt: coupon.expiresAt });
  }
  if (order.total < coupon.minimumAmount) {
    return err({
      type: 'MINIMUM_NOT_MET',
      minimum: coupon.minimumAmount,
      current: order.total,
    });
  }
  return ok(order.withDiscount(coupon.discountAmount));
}

// Application layer: aggregating Results
class OrderService {
  async createOrder(
    userId: string,
    items: OrderItem[],
    couponCode?: string,
  ): Promise<Result<Order, OrderError>> {
    // Infrastructure operation (returns Result)
    const userResult = await this.userRepo.findById(userId);
    if (!userResult.ok) return userResult;

    const order = Order.create(userResult.value, items);

    // Coupon application (Result chain)
    if (couponCode) {
      const couponResult = await this.couponRepo.findByCode(couponCode);
      if (!couponResult.ok) return couponResult;

      const discountResult = applyDiscount(order, couponResult.value);
      if (!discountResult.ok) return discountResult;

      return this.orderRepo.save(discountResult.value);
    }

    return this.orderRepo.save(order);
  }
}
```

### 4.3 Recommended Approach by Language

| Language | Recommended Approach | Reason |
|------|---------------|------|
| Java | Unchecked exceptions (business) + domain exception hierarchy | Checked exceptions have too many practical drawbacks |
| Python | Exceptions are standard. Design a custom exception hierarchy | EAFP culture (Easier to Ask Forgiveness than Permission) |
| TypeScript | Combination of Result types + exceptions | Powerful type system, Union types are ergonomic |
| Rust | Result types are standard. panic! for fatal errors only | Type system enforces handling, ? operator is convenient |
| Go | error interface + errors.Is/As | Simple, explicit, if err != nil pattern |
| Kotlin | sealed class + when expression | Null safety + exhaustive when |
| Scala | Either[L, R] / Try[T] | Affinity with functional programming |
| Haskell | Either / Maybe + monads | Pure functional, composition via do-notation |

---

## 5. Robust Error Handling Patterns

### 5.1 Fail Fast Pattern

Validate preconditions at the start of a function and reject invalid input early.

```
  Fail Fast Flow

  Input
    │
    ▼
  ┌─────────────┐
  │ Precondition │ ─ violated → immediate error (guard clause)
  │ checks       │
  └──────┬──────┘
         │OK
         ▼
  ┌─────────────┐
  │ Business     │
  │ logic        │ ← no error checks needed here
  └──────┬──────┘   (preconditions are guaranteed)
         │
         ▼
       Result
```

**Code Example 10: Fail Fast Pattern (Python)**

```python
"""
Fail Fast: guard clauses to guarantee preconditions.

Principles:
1. Validate at the start of the function
2. Raise an exception or return an error immediately on failure
3. The function body after all guards handles only the happy path
"""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Optional


@dataclass
class Money:
    amount: Decimal
    currency: str


class InsufficientFundsError(Exception):
    def __init__(self, available: Decimal, requested: Decimal):
        self.available = available
        self.requested = requested
        super().__init__(
            f"Insufficient funds: balance {available} < requested {requested}"
        )


class InvalidAmountError(Exception):
    def __init__(self, amount, reason: str):
        super().__init__(f"Invalid amount ({amount}): {reason}")


class AccountLockedError(Exception):
    def __init__(self, account_id: str, reason: str):
        super().__init__(f"Account {account_id} is locked: {reason}")


# ── Function with Fail Fast Applied ──────────────────────

def withdraw(account: "Account", amount: str, memo: Optional[str] = None) -> Money:
    """
    Withdraw from an account.

    Fail Fast pattern:
    1. Validate argument types and values (prevent programming errors)
    2. Validate business rules (business errors)
    3. Execute logic only after all checks pass
    """

    # ── Guard 1: Basic argument validation ──
    if account is None:
        raise ValueError("account must not be None")

    try:
        decimal_amount = Decimal(amount)
    except (InvalidOperation, TypeError):
        raise InvalidAmountError(amount, "Cannot convert to a number")

    if decimal_amount <= 0:
        raise InvalidAmountError(amount, "Amount must be a positive number")

    if decimal_amount != decimal_amount.quantize(Decimal("0.01")):
        raise InvalidAmountError(amount, "Amount may have at most 2 decimal places")

    # ── Guard 2: Business rule validation ──
    if account.is_locked:
        raise AccountLockedError(account.id, account.lock_reason)

    if account.balance < decimal_amount:
        raise InsufficientFundsError(account.balance, decimal_amount)

    daily_limit = Decimal("1000000")
    if account.daily_withdrawn + decimal_amount > daily_limit:
        raise InvalidAmountError(
            amount,
            f"Exceeds daily withdrawal limit ({daily_limit})"
        )

    # ── Body: happy path only ──
    # (all guard clauses passed — safe to proceed)
    account.balance -= decimal_amount
    account.daily_withdrawn += decimal_amount

    transaction = Transaction(
        account_id=account.id,
        type="WITHDRAWAL",
        amount=decimal_amount,
        memo=memo or "Withdrawal",
    )
    account.transactions.append(transaction)

    return Money(amount=decimal_amount, currency=account.currency)
```

### 5.2 Circuit Breaker Pattern

Monitor calls to external services and temporarily stop calling them when the number of consecutive failures exceeds a threshold.

```
  Circuit Breaker State Transitions

  ┌─────────┐  failures >= threshold  ┌──────────┐
  │  Closed  │ ──────────────────── → │   Open   │
  │ (normal) │                         │ (tripped)│
  └────┬─────┘                         └────┬─────┘
       │ ▲                                  │
       │ │ success               timeout    │
       │ │                                  │
       │ └───────────────────── ┌───────────┘
       │     reset              │
       │                   ┌────▼──────┐
       └────────────────── │ Half-Open  │
            success OK      │ (probing) │
                            └───────────┘
                              │
                              │ failure → back to Open
```

**Code Example 11: Circuit Breaker Implementation (Python)**

```python
"""
Circuit Breaker Pattern

A stability pattern introduced by Michael T. Nygard in "Release It!".
Prevents failures in external services from cascading into your own system.
"""
import time
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Callable, TypeVar, Generic
from threading import Lock

T = TypeVar('T')
logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"        # Normal (requests flow through)
    OPEN = "open"            # Tripped (requests rejected immediately)
    HALF_OPEN = "half_open"  # Probing (limited requests allowed through)


class CircuitOpenError(Exception):
    """Circuit breaker is open (service unavailable)"""
    def __init__(self, service: str, retry_after: float):
        self.service = service
        self.retry_after = retry_after
        super().__init__(
            f"Service '{service}' is temporarily unavailable. "
            f"Retry after {retry_after:.0f} seconds."
        )


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5          # Number of failures before transitioning to OPEN
    success_threshold: int = 3          # Successes required to go from HALF_OPEN → CLOSED
    timeout: float = 30.0               # Timeout before OPEN → HALF_OPEN (seconds)
    excluded_exceptions: tuple = ()      # Exceptions not counted (e.g. business errors)


class CircuitBreaker:
    """
    Circuit Breaker implementation

    Usage:
        breaker = CircuitBreaker("payment-api")

        try:
            result = breaker.call(lambda: payment_api.charge(order))
        except CircuitOpenError:
            # fallback handling
            return fallback_result()
    """

    def __init__(self, name: str, config: CircuitBreakerConfig | None = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0.0
        self._lock = Lock()

    @property
    def state(self) -> CircuitState:
        with self._lock:
            if self._state == CircuitState.OPEN:
                # Check timeout
                elapsed = time.time() - self._last_failure_time
                if elapsed >= self.config.timeout:
                    logger.info(
                        f"[CircuitBreaker:{self.name}] OPEN → HALF_OPEN "
                        f"(timeout={self.config.timeout}s elapsed)"
                    )
                    self._state = CircuitState.HALF_OPEN
                    self._success_count = 0
            return self._state

    def call(self, fn: Callable[[], T]) -> T:
        """
        Protected function call.

        - CLOSED: call normally
        - OPEN: raise CircuitOpenError
        - HALF_OPEN: call and observe the result
        """
        current_state = self.state

        if current_state == CircuitState.OPEN:
            retry_after = (
                self.config.timeout - (time.time() - self._last_failure_time)
            )
            raise CircuitOpenError(self.name, max(0, retry_after))

        try:
            result = fn()
            self._on_success()
            return result
        except Exception as e:
            # Excluded exceptions (e.g. business errors) are not counted
            if isinstance(e, self.config.excluded_exceptions):
                raise
            self._on_failure(e)
            raise

    def _on_success(self) -> None:
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.config.success_threshold:
                    logger.info(
                        f"[CircuitBreaker:{self.name}] HALF_OPEN → CLOSED "
                        f"(success_count={self._success_count})"
                    )
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
            else:
                self._failure_count = 0  # reset count on consecutive success

    def _on_failure(self, error: Exception) -> None:
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

            if self._state == CircuitState.HALF_OPEN:
                logger.warning(
                    f"[CircuitBreaker:{self.name}] HALF_OPEN → OPEN "
                    f"(failure during probe: {error})"
                )
                self._state = CircuitState.OPEN
            elif self._failure_count >= self.config.failure_threshold:
                logger.error(
                    f"[CircuitBreaker:{self.name}] CLOSED → OPEN "
                    f"(failure_count={self._failure_count}, "
                    f"threshold={self.config.failure_threshold})"
                )
                self._state = CircuitState.OPEN


# ── Usage: Protecting the Payment Service ────────────────────

class PaymentService:
    def __init__(self, api_client):
        self.api_client = api_client
        self.breaker = CircuitBreaker(
            "payment-api",
            CircuitBreakerConfig(
                failure_threshold=3,
                timeout=60.0,
                excluded_exceptions=(PaymentDeclinedError,),  # declined payments are not counted
            ),
        )

    def charge(self, order: "Order") -> "PaymentResult":
        try:
            return self.breaker.call(
                lambda: self.api_client.charge(order.total, order.payment_method)
            )
        except CircuitOpenError:
            logger.warning("Payment API is down. Saving to queue for later retry")
            return PaymentResult.queued(order.id)
```

### 5.3 Retry Pattern (Exponential Backoff)

**Code Example 12: Retry with Exponential Backoff (Python)**

```python
"""
Retry Pattern: Exponential Backoff + Jitter

Note: Do not retry every error.
Retry: network timeout, 503, 429
Do not retry: 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)
"""
import time
import random
import logging
from functools import wraps
from typing import Callable, TypeVar, Type

T = TypeVar('T')
logger = logging.getLogger(__name__)


class MaxRetriesExceededError(Exception):
    """Maximum retry attempts exceeded"""
    def __init__(self, attempts: int, last_error: Exception):
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            f"Still failing after {attempts} attempts: {last_error}"
        )


def with_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    retryable_exceptions: tuple[Type[Exception], ...] = (Exception,),
    non_retryable_exceptions: tuple[Type[Exception], ...] = (),
) -> Callable:
    """
    Retry decorator (Exponential Backoff + Full Jitter)

    Parameters:
        max_attempts: Maximum number of attempts (including the first)
        base_delay: Base wait time (seconds)
        max_delay: Maximum wait time (seconds)
        exponential_base: Base of the exponent (typically 2)
        retryable_exceptions: Exceptions that trigger a retry
        non_retryable_exceptions: Exceptions that do not (takes priority)
    """
    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        @wraps(fn)
        def wrapper(*args, **kwargs) -> T:
            last_error = None

            for attempt in range(1, max_attempts + 1):
                try:
                    result = fn(*args, **kwargs)
                    if attempt > 1:
                        logger.info(
                            f"[Retry] {fn.__name__} succeeded "
                            f"(attempt={attempt}/{max_attempts})"
                        )
                    return result

                except non_retryable_exceptions as e:
                    # Non-retryable exceptions are re-raised immediately
                    logger.debug(
                        f"[Retry] {fn.__name__} non-retryable exception: {e}"
                    )
                    raise

                except retryable_exceptions as e:
                    last_error = e

                    if attempt == max_attempts:
                        logger.error(
                            f"[Retry] {fn.__name__} max retries reached "
                            f"(attempts={max_attempts}): {e}"
                        )
                        raise MaxRetriesExceededError(max_attempts, e) from e

                    # Exponential Backoff + Full Jitter
                    delay = min(
                        base_delay * (exponential_base ** (attempt - 1)),
                        max_delay
                    )
                    jittered_delay = random.uniform(0, delay)

                    logger.warning(
                        f"[Retry] {fn.__name__} failed "
                        f"(attempt={attempt}/{max_attempts}): {e}. "
                        f"Retrying in {jittered_delay:.2f}s"
                    )
                    time.sleep(jittered_delay)

            # Should never be reached, but included for safety
            raise MaxRetriesExceededError(max_attempts, last_error)

        return wrapper
    return decorator


# ── Usage Example ────────────────────────────────────────

class ExternalApiClient:

    @with_retry(
        max_attempts=3,
        base_delay=1.0,
        retryable_exceptions=(ConnectionError, TimeoutError),
        non_retryable_exceptions=(ValueError, AuthenticationError),
    )
    def fetch_exchange_rate(self, currency_pair: str) -> float:
        """Fetch exchange rate from external API"""
        response = self.http_client.get(
            f"https://api.example.com/rates/{currency_pair}",
            timeout=5.0,
        )
        if response.status_code == 429:
            raise ConnectionError("Rate limited")
        if response.status_code == 401:
            raise AuthenticationError("Invalid API key")
        return response.json()["rate"]
```

### 5.4 Graceful Degradation

**Code Example 13: Graceful Degradation (TypeScript)**

```typescript
/**
 * Graceful Degradation
 *
 * Design the system to keep functioning overall
 * even when some services fail.
 *
 * Principles:
 * 1. Clearly separate required and non-required features
 * 2. Do not let non-required failures cascade system-wide
 * 3. Provide fallbacks (alternative processing)
 * 4. Notify users when the system is degraded
 */

interface ProductDetail {
  product: Product;
  recommendations: Product[];
  reviews: Review[];
  inventory: InventoryStatus;
  deliveryEstimate: string | null;
}

class ProductPageService {
  constructor(
    private productService: ProductService,               // required
    private recommendationService: RecommendationService, // non-required
    private reviewService: ReviewService,                 // non-required
    private inventoryService: InventoryService,           // semi-required
    private deliveryService: DeliveryService,             // non-required
  ) {}

  async getProductDetail(productId: string): Promise<ProductDetail> {
    // ── Required: fetch product (fail here = fail entirely) ──
    const product = await this.productService.getById(productId);

    // ── Non-required: fetch in parallel, fall back on failure ──
    const [recommendations, reviews, inventory, deliveryEstimate] =
      await Promise.all([
        this.getRecommendationsSafe(product),
        this.getReviewsSafe(productId),
        this.getInventorySafe(productId),
        this.getDeliveryEstimateSafe(productId),
      ]);

    return {
      product,
      recommendations,
      reviews,
      inventory,
      deliveryEstimate,
    };
  }

  /** Recommendations: on failure → return popular products */
  private async getRecommendationsSafe(product: Product): Promise<Product[]> {
    try {
      return await withTimeout(
        this.recommendationService.getFor(product),
        3000  // 3-second timeout
      );
    } catch (error) {
      logger.warn('Failed to get recommendations, falling back to popular items', { error });
      // Fallback: return cached popular products
      return this.recommendationService.getPopularCached();
    }
  }

  /** Reviews: on failure → return empty array */
  private async getReviewsSafe(productId: string): Promise<Review[]> {
    try {
      return await withTimeout(
        this.reviewService.getFor(productId),
        3000
      );
    } catch (error) {
      logger.warn('Failed to get reviews, falling back to empty array', {
        productId,
        error,
      });
      return []; // page can still be shown without reviews
    }
  }

  /** Inventory: on failure → return "checking" status */
  private async getInventorySafe(
    productId: string
  ): Promise<InventoryStatus> {
    try {
      return await withTimeout(
        this.inventoryService.check(productId),
        2000  // short timeout since inventory is important
      );
    } catch (error) {
      logger.warn('Failed to check inventory, falling back to unknown status', {
        productId,
        error,
      });
      // Return "checking" and keep the buy button enabled
      return { status: 'CHECKING', message: 'Checking inventory...' };
    }
  }

  /** Delivery estimate: on failure → null (hide the field) */
  private async getDeliveryEstimateSafe(
    productId: string
  ): Promise<string | null> {
    try {
      return await withTimeout(
        this.deliveryService.estimate(productId),
        2000
      );
    } catch (error) {
      logger.debug('Failed to get delivery estimate (hiding field)', { productId, error });
      return null; // hide the delivery estimate
    }
  }
}

/** Promise with timeout */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${ms}ms timeout`)), ms)
    ),
  ]);
}
```

---

## 6. Structured Logging and Error Monitoring

### 6.1 Structured Logging Principles

```
  Log Level to Error Type Mapping

  ┌──────────┬────────────────────────────────────────────────┐
  │ Level    │ Usage                                          │
  ├──────────┼────────────────────────────────────────────────┤
  │ ERROR    │ Errors requiring immediate attention           │
  │          │ Data integrity violations, payment failures,   │
  │          │ authentication system outages                  │
  ├──────────┼────────────────────────────────────────────────┤
  │ WARN     │ Abnormal but operations can continue           │
  │          │ Successful retry, fallback activated,          │
  │          │ performance degradation                        │
  ├──────────┼────────────────────────────────────────────────┤
  │ INFO     │ Normal business events                         │
  │          │ User registration, order confirmation,         │
  │          │ batch completion                               │
  ├──────────┼────────────────────────────────────────────────┤
  │ DEBUG    │ Detailed info for development and investigation │
  │          │ SQL queries, API request/response              │
  └──────────┴────────────────────────────────────────────────┘
```

**Code Example 14: Structured Logging (Python)**

```python
"""
Structured Logging: JSON-format logs for easy search and analysis

Principles:
1. Human-readable message + machine-readable fields
2. Tracing via request ID
3. Masking of sensitive information
4. Appropriate use of log levels
"""
import json
import logging
import uuid
from contextvars import ContextVar
from functools import wraps
from typing import Any

# Request-scoped context
request_id_var: ContextVar[str] = ContextVar('request_id', default='')
user_id_var: ContextVar[str] = ContextVar('user_id', default='')


class StructuredLogger:
    """Logger that outputs structured logs"""

    # Field names to mask
    SENSITIVE_FIELDS = {
        'password', 'token', 'api_key', 'secret',
        'credit_card', 'ssn', 'authorization',
    }

    def __init__(self, name: str):
        self._logger = logging.getLogger(name)

    def _mask_sensitive(self, data: dict[str, Any]) -> dict[str, Any]:
        """Mask sensitive information"""
        masked = {}
        for key, value in data.items():
            if key.lower() in self.SENSITIVE_FIELDS:
                masked[key] = "***MASKED***"
            elif isinstance(value, dict):
                masked[key] = self._mask_sensitive(value)
            else:
                masked[key] = value
        return masked

    def _build_entry(
        self,
        level: str,
        message: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Build a log entry"""
        entry = {
            "level": level,
            "message": message,
            "request_id": request_id_var.get(''),
            "user_id": user_id_var.get(''),
        }
        # Mask and add extra fields
        extra = self._mask_sensitive(kwargs)
        entry.update(extra)
        return entry

    def info(self, message: str, **kwargs: Any) -> None:
        entry = self._build_entry("INFO", message, **kwargs)
        self._logger.info(json.dumps(entry, ensure_ascii=False))

    def warning(self, message: str, **kwargs: Any) -> None:
        entry = self._build_entry("WARNING", message, **kwargs)
        self._logger.warning(json.dumps(entry, ensure_ascii=False))

    def error(self, message: str, error: Exception | None = None, **kwargs: Any) -> None:
        entry = self._build_entry("ERROR", message, **kwargs)
        if error:
            entry["error_type"] = type(error).__name__
            entry["error_message"] = str(error)
            # Stack trace included only for ERROR level
            import traceback
            entry["stack_trace"] = traceback.format_exc()
        self._logger.error(json.dumps(entry, ensure_ascii=False))


logger = StructuredLogger(__name__)


# ── Usage Example ────────────────────────────────────────

class OrderService:
    def create_order(self, user_id: str, items: list) -> "Order":
        logger.info(
            "Order creation started",
            user_id=user_id,
            item_count=len(items),
            total_amount=sum(item.price for item in items),
        )

        try:
            order = self._process_order(user_id, items)
            logger.info(
                "Order creation succeeded",
                order_id=order.id,
                user_id=user_id,
                total=order.total,
            )
            return order

        except InsufficientInventoryError as e:
            logger.warning(
                "Order failed due to insufficient inventory",
                user_id=user_id,
                product_id=e.product_id,
                requested=e.requested,
                available=e.available,
            )
            raise

        except PaymentFailedError as e:
            logger.error(
                "Payment processing failed",
                error=e,
                user_id=user_id,
                payment_method=e.payment_method,
                # password and token are automatically masked
                token=e.transaction_token,
            )
            raise

# Log output example (JSON):
# {
#   "level": "ERROR",
#   "message": "Payment processing failed",
#   "request_id": "req-abc123",
#   "user_id": "user-456",
#   "error_type": "PaymentFailedError",
#   "error_message": "Payment gateway timeout",
#   "payment_method": "credit_card",
#   "token": "***MASKED***",
#   "stack_trace": "..."
# }
```

### 6.2 Separating Error Logs from Error Responses

```
  Separation of Logs and Responses

  ┌────────────────────────────────────────────────────────────┐
  │  Error Logs (internal)                                      │
  │  · Stack traces                                            │
  │  · Internal IDs (request ID, trace ID)                     │
  │  · DB queries, API responses                               │
  │  · User ID (an identifier, not personal info)              │
  │  → For developers and operations teams. Managed via        │
  │    Datadog / CloudWatch, etc.                              │
  ├────────────────────────────────────────────────────────────┤
  │  Error Responses (external)                                 │
  │  · Messages users can understand                           │
  │  · Error codes (VALIDATION_ERROR, NOT_FOUND)              │
  │  · Request ID (for support inquiries)                      │
  │  → For users and client developers                         │
  │  → Never expose internal implementation details            │
  └────────────────────────────────────────────────────────────┘
```

**Bad Example vs Good Example**:

```json
// Bad: internal information leaks into the response
{
  "error": "org.postgresql.util.PSQLException: ERROR: relation \"users\" does not exist",
  "stack": "at com.example.UserRepository.findById(UserRepository.java:42)..."
}

// Good: only user-facing information
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "A server error occurred. Please try again later.",
    "request_id": "req-abc123"
  }
}
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Swallowing Exceptions

The most dangerous anti-pattern. Errors vanish into the void, making it impossible to diagnose bugs.

```python
# ──────────────────────────────────────────────────
# BAD: swallowing the exception
# ──────────────────────────────────────────────────
try:
    process_payment(order)
except Exception:
    pass  # do nothing → payment failure disappears silently
          # user sees "Order complete"
          # product ships without being charged

# ──────────────────────────────────────────────────
# BAD: log only and continue
# ──────────────────────────────────────────────────
try:
    process_payment(order)
except Exception as e:
    print(f"error: {e}")  # may not even be logged properly
    # execution continues → same problem

# ──────────────────────────────────────────────────
# GOOD: handle appropriately based on exception type
# ──────────────────────────────────────────────────
try:
    process_payment(order)
except PaymentDeclinedError as e:
    # Business error: notify user, cancel the order
    logger.warning(f"Payment declined: order={order.id}, reason={e.reason}")
    order.cancel(reason=f"Payment declined: {e.reason}")
    return PaymentResult.declined(e.reason)
except PaymentGatewayError as e:
    # Infrastructure error: enqueue for retry
    logger.error(f"Payment gateway failure: order={order.id}", exc_info=True)
    retry_queue.enqueue(order, max_retries=3)
    return PaymentResult.queued("Payment is being processed. You will be notified by email.")
except Exception as e:
    # Unexpected error: log + propagate upward
    logger.error(f"Unexpected payment error: order={order.id}", exc_info=True)
    raise PaymentSystemError("Payment processing failed") from e
```

### Anti-Pattern 2: Using Exceptions for Control Flow

Using exceptions for normal control flow degrades performance and obscures intent.

```python
# ──────────────────────────────────────────────────
# BAD: using exceptions for control flow
# ──────────────────────────────────────────────────
def find_user(users: list, name: str):
    try:
        for user in users:
            if user.name == name:
                raise StopIteration(user)  # escape via exception when found
    except StopIteration as e:
        return e.args[0]
    return None

# BAD: using exceptions for existence checks (misusing LBYL vs EAFP)
def get_config_value(config: dict, key: str):
    try:
        return config[key]
    except KeyError:
        try:
            return config[key.upper()]
        except KeyError:
            try:
                return config[key.lower()]
            except KeyError:
                return None  # 3-level nested try-catch

# ──────────────────────────────────────────────────
# GOOD: use normal control flow
# ──────────────────────────────────────────────────
def find_user(users: list, name: str):
    for user in users:
        if user.name == name:
            return user
    return None

# GOOD: use dict.get() or conditional checks
def get_config_value(config: dict, key: str):
    for candidate in [key, key.upper(), key.lower()]:
        if candidate in config:
            return config[candidate]
    return None
```

### Anti-Pattern 3: Excessive Defensiveness (Over-Engineering Defensive Programming)

```python
# ──────────────────────────────────────────────────
# BAD: argument checks in every method → half the code is checks
# ──────────────────────────────────────────────────
class Calculator:
    def add(self, a, b):
        if a is None:
            raise ValueError("a is None")
        if b is None:
            raise ValueError("b is None")
        if not isinstance(a, (int, float)):
            raise TypeError(f"a must be numeric, got {type(a)}")
        if not isinstance(b, (int, float)):
            raise TypeError(f"b must be numeric, got {type(b)}")
        return a + b  # actual logic is one line

    def multiply(self, a, b):
        if a is None:
            raise ValueError("a is None")
        if b is None:
            raise ValueError("b is None")
        # ... same checks repeated
        return a * b

# ──────────────────────────────────────────────────
# GOOD: validate at the boundary, trust internally
# ──────────────────────────────────────────────────
class Calculator:
    """Internal methods. Type checks happen at the public API boundary."""
    def add(self, a: float, b: float) -> float:
        return a + b

    def multiply(self, a: float, b: float) -> float:
        return a * b

class CalculatorAPI:
    """Public API. Validate input here."""
    def __init__(self):
        self.calc = Calculator()

    def calculate(self, operation: str, a: str, b: str) -> float:
        # Strict validation only at the boundary
        try:
            num_a = float(a)
            num_b = float(b)
        except (ValueError, TypeError) as e:
            raise ValidationError(f"Cannot convert to number: {e}")

        match operation:
            case "add":
                return self.calc.add(num_a, num_b)
            case "multiply":
                return self.calc.multiply(num_a, num_b)
            case _:
                raise ValidationError(f"Unknown operation: {operation}")
```

### Anti-Pattern 4: Missing Error Context

```python
# ──────────────────────────────────────────────────
# BAD: error messages with no context
# ──────────────────────────────────────────────────
raise Exception("An error occurred")  # what error? where? why?
raise ValueError("Invalid value")  # which value is invalid?
raise RuntimeError("Processing failed")  # what processing? what was the cause?

# ──────────────────────────────────────────────────
# GOOD: error messages with sufficient context
# ──────────────────────────────────────────────────
raise UserNotFoundError(
    user_id="user-123",
    searched_in="active_users_table"
)
# → "User user-123 was not found in active_users_table"

raise ValidationError(
    field="email",
    message="Invalid email address format",
    value="not-an-email"  # only non-sensitive values
)
# → "Validation error: email field - Invalid email address format (value: 'not-an-email')"

raise PaymentProcessingError(
    order_id="order-456",
    amount=Decimal("5000"),
    gateway="stripe",
    reason="card_declined",
    # do not include token (sensitive)
)
# → "Payment processing error: order-456, amount=5000, gateway=stripe, reason=card_declined"
```

### Anti-Pattern 5: Broad Catch Without Checking Exception Type

```typescript
// ──────────────────────────────────────────────────
// BAD: catch(error) catches everything and handles it the same way
// ──────────────────────────────────────────────────
try {
  await orderService.createOrder(userId, items);
} catch (error) {
  // all errors return "500 server error"
  res.status(500).json({ error: 'Something went wrong' });
}

// ──────────────────────────────────────────────────
// GOOD: respond appropriately based on error type
// ──────────────────────────────────────────────────
try {
  await orderService.createOrder(userId, items);
} catch (error) {
  if (error instanceof ValidationError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: error.message, field: error.field }
    });
  } else if (error instanceof NotFoundError) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: error.message }
    });
  } else if (error instanceof AuthorizationError) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: error.message }
    });
  } else if (error instanceof ConflictError) {
    res.status(409).json({
      error: { code: 'CONFLICT', message: error.message }
    });
  } else {
    // only truly unexpected errors get 500
    logger.error('Unexpected error', { error, userId });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'A server error occurred' }
    });
  }
}
```

---

## 8. Exercises

### Exercise 1 (Basic): Designing an Exception Hierarchy

Design a custom exception hierarchy satisfying the following requirements.

**Requirements:**
- Backend API for an e-commerce site
- Possible errors: product not found, out of stock, credit card payment declined, invalid delivery address, user authentication failure, external API connection failure

**Tasks:**
1. Design the exception hierarchy and implement each exception class
2. Give each exception an appropriate HTTP status code, error code, and context information
3. Implement a `to_response()` method that converts to a safe API response

**Expected Output (Exception Class Diagram):**

```
AppError (500)
├── BusinessError
│   ├── ProductNotFoundError (404)
│   ├── InsufficientStockError (422)
│   ├── PaymentDeclinedError (422)
│   └── InvalidAddressError (400)
├── AuthenticationError (401)
└── InfrastructureError (503)
    └── ExternalApiError (503)
```

**Hints for the Model Solution:**

```python
class AppError(Exception):
    """Base exception"""
    def __init__(self, message, code, status_code=500, details=None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.details = details or {}

    def to_response(self):
        """Safe API response (excludes internal information)"""
        return {
            "error": {
                "code": self.code,
                "message": str(self),
            }
        }

class InsufficientStockError(BusinessError):
    def __init__(self, product_id, requested, available):
        super().__init__(
            f"Insufficient stock for product {product_id}: requested={requested}, available={available}",
            code="INSUFFICIENT_STOCK",
            status_code=422,
            details={
                "product_id": product_id,
                "requested": requested,
                "available": available,
            },
        )
```

---

### Exercise 2 (Intermediate): Validation Chain with Result Types

Implement the following order validation using Result types.

**Requirements:**
- An order requires a list of items, a delivery address, and a payment method
- Validations: item list is non-empty, each item quantity > 0, required address fields present, payment method is valid
- Collect all validation errors and return them together (do not stop at the first error)

**Expected Behavior:**

```typescript
const result = validateOrder({
  items: [],
  address: { street: '', city: 'Tokyo', zip: '' },
  payment: { method: 'bitcoin' },  // unsupported
});

// result.ok === false
// result.error === [
//   { field: 'items', message: 'Please select at least one item' },
//   { field: 'address.street', message: 'Street address is required' },
//   { field: 'address.zip', message: 'Zip code is required' },
//   { field: 'payment.method', message: 'Unsupported payment method: bitcoin' },
// ]
```

**Hints for the Model Solution:**

```typescript
type ValidationErrors = { field: string; message: string }[];

function validateOrder(input: OrderInput): Result<ValidatedOrder, ValidationErrors> {
  const errors: ValidationErrors = [];

  // Run all validations (do not stop early)
  const itemsResult = validateItems(input.items);
  const addressResult = validateAddress(input.address);
  const paymentResult = validatePayment(input.payment);

  // Collect errors
  if (!itemsResult.ok) errors.push(...itemsResult.error);
  if (!addressResult.ok) errors.push(...addressResult.error);
  if (!paymentResult.ok) errors.push(...paymentResult.error);

  if (errors.length > 0) return err(errors);

  return ok({
    items: itemsResult.value,
    address: addressResult.value,
    payment: paymentResult.value,
  });
}
```

---

### Exercise 3 (Advanced): Circuit Breaker + Graceful Degradation

Implement Circuit Breaker and graceful degradation for the following system.

**Requirements:**
- Product search API: when the primary search engine (Elasticsearch) is down, fall back to RDBMS
- Attach recommendation information to search results: when the recommendation API is down, return category-based alternative results
- Apply Circuit Breaker to each external service (trip after 3 failures, probe after 30 seconds)

**Expected Behavior:**

```
Normal:
  SearchEngine(ES) → product list + Recommendation API → results with recommendations

ES down:
  SearchEngine(ES) → [Circuit OPEN] → RDBMS fallback → product list
  + Recommendation API → results with recommendations

ES + Recommendation both down:
  RDBMS fallback → product list
  + Category-based alternative recommendations → minimal results
```

**Hints for the Model Solution:**

```python
class ProductSearchService:
    def __init__(self):
        self.es_breaker = CircuitBreaker("elasticsearch", threshold=3, timeout=30)
        self.recommend_breaker = CircuitBreaker("recommendation", threshold=3, timeout=30)

    def search(self, query: str) -> SearchResult:
        # Search: ES → RDBMS fallback
        products = self._search_with_fallback(query)

        # Recommendations: API → category-based fallback
        recommendations = self._recommend_with_fallback(products)

        return SearchResult(products=products, recommendations=recommendations)

    def _search_with_fallback(self, query):
        try:
            return self.es_breaker.call(lambda: self.es_client.search(query))
        except CircuitOpenError:
            logger.warning("Elasticsearch unavailable, falling back to RDBMS")
            return self.rdbms_client.search(query)  # slower but functional
```

---

## 9. FAQ

### Q1: Should I write try-catch in every function?

No. The principle is to **catch exceptions at the appropriate layer, once**. Catching in every function impedes error propagation and makes code verbose.

**Where to catch (recommended):**
- API entry points (controller layer)
- Loops in batch processing (so one failure doesn't stop everything)
- Boundaries with external services (translate infrastructure exceptions to domain exceptions)
- UI event handlers (show appropriate messages to users)

**Where not to catch:**
- Inside domain logic (let exceptions propagate)
- Utility functions (leave the decision to the caller)

### Q2: What should be included in exception messages?

**Information to include:**
1. **What happened**: "User not found"
2. **Context**: "ID: user-123, table: active_users"
3. **Cause (if possible)**: "Database connection timeout (5 seconds)"
4. **Hint for recovery**: "Please contact an administrator" / "Please try again later"

**What must not be included:**
- Passwords, API tokens, secret keys
- Credit card numbers, social security numbers
- Personal information (email, phone number) — may be in logs, but not in responses
- Stack traces (include in logs, not in user responses)
- SQL queries (would reveal information useful for SQL injection)

### Q3: Can error logs and error responses have the same content?

**They should be different.** This is an important security principle.

| Item | Error Log (internal) | Error Response (external) |
|------|-------------------|----------------------|
| Stack trace | Include | Do not include |
| Internal IDs | Include | Request ID only |
| SQL queries | Include | Do not include |
| User ID | Include | Do not include |
| Technical details | Include | Do not include |
| Resolution steps | Technical remediation | Actions the user can take |

### Q4: Can Result types and exceptions be mixed in the same project?

**Yes, and it is actually recommended.** The following hybrid approach is effective:

- **Business errors → Result types**: Predictable errors like "insufficient balance" or "out of stock" are expressed as types
- **Infrastructure errors → exceptions**: DB connection failures, etc. are caught as exceptions and converted to Result types
- **Programming errors → exceptions**: Bugs like null references crash immediately via exception
- **Unexpected errors → exceptions**: Caught by the global error handler

The key is consistency. Document within the team which approach to use at each layer.

### Q5: Should retries be applied to every error?

**No. Retries are only effective for transient errors.**

| Error | Retry | Reason |
|--------|---------|------|
| 503 Service Unavailable | Yes | Service is temporarily down |
| 429 Too Many Requests | Yes (with Backoff) | Rate limit; time will resolve it |
| Network timeout | Yes | Possible transient connectivity issue |
| 400 Bad Request | No | Request is invalid; retry won't help |
| 401 Unauthorized | No | Wrong credentials; retry won't help |
| 404 Not Found | No | Resource does not exist |
| 409 Conflict | Depends | Optimistic locking can be retried after re-fetching |

**Notes on retrying:**
- Always use Exponential Backoff + Jitter
- Set a maximum retry count (infinite retries are strictly forbidden)
- Retrying non-idempotent operations risks duplicate processing (use idempotency keys)

### Q6: Isn't the Go `if err != nil` pattern verbose?

Go's `if err != nil` is indeed verbose at first glance, but it has the following advantages:

1. **Explicit error handling**: Unlike exceptions, errors cannot be implicitly skipped
2. **Easy to trace control flow**: Where an error occurs and where it is handled is immediately clear
3. **Performance**: No stack trace generation cost

With Go 2 generics, Result-type-like patterns are also possible. `errors.Is` / `errors.As` (Go 1.13+) allow type-safe error discrimination. If verbosity is a concern, it can be reduced with helper functions or code generation.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development. It is especially important during code reviews and architectural design.

---

## Summary

| Strategy | Use Case | Pros | Cons | Adopted By |
|------|------|------|------|---------|
| Exceptions | Unexpected errors, infrastructure errors | Natural propagation, stack traces | Risk of missed handling | Java, Python, C#, TS |
| Result types | Business errors | Type-safe, handling enforced, zero cost | Code tends to be verbose | Rust, Haskell, TS |
| Error codes | Legacy systems | Simple | Easily ignored | C |
| Fail Fast | Input validation, preconditions | Early bug detection | — | All languages |
| Circuit Breaker | External service calls | Prevents failure cascade | Implementation complexity | All languages |
| Retry + Backoff | Transient infrastructure errors | Automatic recovery | Idempotency must be guaranteed | All languages |
| Graceful Degradation | Non-critical feature failures | Preserves user experience | Fallback design and testing required | All languages |
| Structured Logging | Error monitoring and analysis | Easy to search and analyze | Cost of log design | All languages |

### Error Handling Checklist

- [ ] Is error classification appropriate (programming / business / infrastructure / fatal)?
- [ ] Have you designed a custom exception hierarchy?
- [ ] Is the try-catch scope minimal?
- [ ] Are exceptions translated at layer boundaries?
- [ ] Have you considered Result types for business errors?
- [ ] Are preconditions validated with Fail Fast?
- [ ] Is Circuit Breaker applied to external services?
- [ ] Is retry using Exponential Backoff + Jitter?
- [ ] Is graceful degradation designed?
- [ ] Are logs and responses separated?
- [ ] Is sensitive information free from logs and responses?
- [ ] Do error messages contain sufficient context?

---

## Next Guides to Read

- [Function Design](./01-functions.md) ── Function design incorporating error handling
- [Testing Principles](./04-testing-principles.md) ── How to test error cases (boundary values, negative testing)
- [Clean Code Overview](../00-principles/00-clean-code-overview.md) ── Where error handling fits in clean code
- [Coupling and Cohesion](../00-principles/03-coupling-cohesion.md) ── Why exception translation reduces coupling between layers
- [Functional Principles](../03-practices-advanced/02-functional-principles.md) ── Error handling with Maybe/Either monads

---

## References

1. **Robert C. Martin** *Clean Code: A Handbook of Agile Software Craftsmanship* Prentice Hall, 2008 (Chapter 7: Error Handling) ── Basic exception design principles, appropriate use of try-catch
2. **Michael T. Nygard** *Release It!: Design and Deploy Production-Ready Software* Pragmatic Bookshelf, 2018 (2nd Edition) ── Circuit Breaker, Bulkhead, and other stability patterns
3. **Joe Duffy** "The Error Model" (blog post, 2016) ── Comparative analysis of Result types and exceptions, considerations from a language design perspective
4. **Martin Fowler** "Fail Fast" (martinfowler.com) ── Explanation of the Fail Fast pattern and when to apply it
5. **Eric Evans** *Domain-Driven Design: Tackling Complexity in the Heart of Software* Addison-Wesley, 2003 ── Designing domain exceptions, cross-layer exception translation
6. **Rust The Book** "Error Handling" (doc.rust-lang.org) ── Result<T, E> type, ? operator, error conversion via the From trait
7. **Go Blog** "Error handling and Go" (go.dev/blog) ── Go error handling idioms, errors.Is/As, error wrapping
8. **Sam Newman** *Building Microservices: Designing Fine-Grained Systems* O'Reilly, 2021 (2nd Edition) ── Error handling in distributed systems, retries, Circuit Breaker
9. **Joshua Bloch** *Effective Java* Addison-Wesley, 2018 (3rd Edition, Items 69-77) ── Correct use of exceptions in Java, the checked vs unchecked exception debate
10. **AWS** "Exponential Backoff And Jitter" (aws.amazon.com/blogs) ── Comparison and recommendations for Full Jitter, Equal Jitter, and Decorrelated Jitter
