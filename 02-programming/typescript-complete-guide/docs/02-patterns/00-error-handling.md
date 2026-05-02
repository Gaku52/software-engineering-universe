# TypeScript Error Handling Patterns

> A robust error handling strategy combining the Result type, custom error hierarchies, and zod validation

## What You Will Learn

1. **Result type pattern** -- How to represent errors in a type-safe way without using exceptions
2. **Custom error hierarchies** -- Techniques for designing domain-specific error classes and discriminating error kinds by type
3. **Validation with zod** -- How to integrate runtime validation and type inference to safely process external input
4. **Async error handling** -- Error management for asynchronous processing combining Promise and the Result type
5. **Error aggregation and transformation** -- Techniques for aggregating multiple errors and transforming errors between layers
6. **Integration patterns in production** -- Error handling integration in Express/NestJS/tRPC
7. **Testing strategy** -- Methods for testing error paths and best practices


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Result Type Pattern

### 1-1. Why Result Type Instead of Exceptions

```
+----------------------------------+
|        Traditional Exception Flow |
+----------------------------------+
|  function parse(input) {         |
|    if (invalid) throw Error()  --+---> Type information is
|    return value                  |     lost in catch block
|  }                               |
+----------------------------------+

+----------------------------------+
|        Result Type Flow           |
+----------------------------------+
|  function parse(input):          |
|    Result<Value, ParseError>     |
|    if (invalid) return Err(...)--+---> Type is preserved
|    return Ok(value)              |     Pattern matching possible
|  }                               |
+----------------------------------+
```

Exception-based error handling has the following fundamental problems.

1. **Loss of type information**: The `error` in a `catch` block is of type `unknown` since TypeScript 4.4, so the compiler cannot track what kinds of errors can occur.
2. **Implicit control flow**: You cannot tell from a function signature alone what exceptions that function might throw (unlike Java's checked exceptions, TypeScript has no throw declarations).
3. **Difficulty of composition**: Exceptions impede function composition. Nested `try-catch` blocks severely reduce readability.
4. **Test complexity**: Testing functions that throw exceptions requires indirect assertions like `expect(() => fn()).toThrow()`.

The Result type solves these problems and achieves both type safety and readability by **treating errors as values**.

```typescript
// Exception-based: unclear what is thrown
function parseJSON(input: string): unknown {
  return JSON.parse(input); // might throw SyntaxError
}

// Result type-based: errors appear in the type signature
function parseJSON(input: string): Result<unknown, SyntaxError> {
  try {
    return Ok(JSON.parse(input));
  } catch (e) {
    return Err(e instanceof SyntaxError ? e : new SyntaxError(String(e)));
  }
}
```

### 1-2. Basic Result Type Definition

```typescript
// Result type definition
type Result<T, E> = Ok<T> | Err<E>;

interface Ok<T> {
  readonly _tag: "Ok";
  readonly value: T;
}

interface Err<E> {
  readonly _tag: "Err";
  readonly error: E;
}

// Constructor functions
function Ok<T>(value: T): Ok<T> {
  return { _tag: "Ok", value };
}

function Err<E>(error: E): Err<E> {
  return { _tag: "Err", error };
}

// Type guards
function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result._tag === "Ok";
}

function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result._tag === "Err";
}
```

### 1-3. Result Type Utilities

```typescript
// map: transform the success value
function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return isOk(result) ? Ok(fn(result.value)) : result;
}

// flatMap (chain): return a new Result from the success value
function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return isOk(result) ? fn(result.value) : result;
}

// unwrapOr: return a default value on error
function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isOk(result) ? result.value : defaultValue;
}

// Usage example
const parsed = parseAge("25");           // Result<number, ParseError>
const doubled = map(parsed, (n) => n * 2); // Result<number, ParseError>
const age = unwrapOr(doubled, 0);        // number
```

### 1-4. Advanced Result Utilities

```typescript
// mapErr: transform the error
function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return isErr(result) ? Err(fn(result.error)) : result;
}

// tap: execute a side effect while passing the Result through
function tap<T, E>(
  result: Result<T, E>,
  fn: (value: T) => void
): Result<T, E> {
  if (isOk(result)) {
    fn(result.value);
  }
  return result;
}

// tapErr: execute a side effect on error
function tapErr<T, E>(
  result: Result<T, E>,
  fn: (error: E) => void
): Result<T, E> {
  if (isErr(result)) {
    fn(result.error);
  }
  return result;
}

// match: pattern matching
function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U {
  return isOk(result) ? handlers.ok(result.value) : handlers.err(result.error);
}

// fromPromise: convert a Promise to a Result
async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  errorFn?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return Ok(value);
  } catch (error) {
    if (errorFn) {
      return Err(errorFn(error));
    }
    return Err(error as E);
  }
}

// fromThrowable: convert a throwing function to a Result
function fromThrowable<T, E = Error>(
  fn: () => T,
  errorFn?: (error: unknown) => E
): Result<T, E> {
  try {
    return Ok(fn());
  } catch (error) {
    if (errorFn) {
      return Err(errorFn(error));
    }
    return Err(error as E);
  }
}

// combine: aggregate multiple Results
function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return Ok(values);
}

// combineAll: collect all errors
function combineAll<T, E>(results: Result<T, E>[]): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (isErr(result)) {
      errors.push(result.error);
    } else {
      values.push(result.value);
    }
  }

  return errors.length > 0 ? Err(errors) : Ok(values);
}

// Usage example: combine
const validations = [
  validateName("John"),   // Result<string, ValidationError>
  validateEmail("a@b.c"), // Result<string, ValidationError>
  validateAge("25"),      // Result<number, ValidationError>
];

const combined = combine(validations);
// Result<(string | number)[], ValidationError>
```

### 1-5. Method-Chaining Result Class

In addition to the functional style with plain objects, a method-chaining style is also useful.

```typescript
class ResultClass<T, E> {
  private constructor(
    private readonly _tag: "Ok" | "Err",
    private readonly _value?: T,
    private readonly _error?: E
  ) {}

  static ok<T, E = never>(value: T): ResultClass<T, E> {
    return new ResultClass<T, E>("Ok", value);
  }

  static err<T = never, E = unknown>(error: E): ResultClass<T, E> {
    return new ResultClass<T, E>("Err", undefined, error);
  }

  isOk(): this is ResultClass<T, never> {
    return this._tag === "Ok";
  }

  isErr(): this is ResultClass<never, E> {
    return this._tag === "Err";
  }

  map<U>(fn: (value: T) => U): ResultClass<U, E> {
    if (this._tag === "Ok") {
      return ResultClass.ok(fn(this._value as T));
    }
    return ResultClass.err(this._error as E);
  }

  mapErr<F>(fn: (error: E) => F): ResultClass<T, F> {
    if (this._tag === "Err") {
      return ResultClass.err(fn(this._error as E));
    }
    return ResultClass.ok(this._value as T);
  }

  flatMap<U>(fn: (value: T) => ResultClass<U, E>): ResultClass<U, E> {
    if (this._tag === "Ok") {
      return fn(this._value as T);
    }
    return ResultClass.err(this._error as E);
  }

  unwrap(): T {
    if (this._tag === "Ok") {
      return this._value as T;
    }
    throw new Error(`Attempted to unwrap an Err: ${this._error}`);
  }

  unwrapOr(defaultValue: T): T {
    return this._tag === "Ok" ? (this._value as T) : defaultValue;
  }

  unwrapOrElse(fn: (error: E) => T): T {
    return this._tag === "Ok" ? (this._value as T) : fn(this._error as E);
  }

  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    if (this._tag === "Ok") {
      return handlers.ok(this._value as T);
    }
    return handlers.err(this._error as E);
  }

  tap(fn: (value: T) => void): ResultClass<T, E> {
    if (this._tag === "Ok") {
      fn(this._value as T);
    }
    return this;
  }

  tapErr(fn: (error: E) => void): ResultClass<T, E> {
    if (this._tag === "Err") {
      fn(this._error as E);
    }
    return this;
  }

  toPromise(): Promise<T> {
    if (this._tag === "Ok") {
      return Promise.resolve(this._value as T);
    }
    return Promise.reject(this._error);
  }
}

// Usage example: method chaining
const result = ResultClass.ok<string, Error>("42")
  .map((s) => parseInt(s, 10))
  .flatMap((n) =>
    n > 0
      ? ResultClass.ok(n)
      : ResultClass.err(new Error("Must be positive"))
  )
  .map((n) => n * 2)
  .tapErr((e) => console.error("Error:", e.message))
  .match({
    ok: (value) => `Success: ${value}`,
    err: (error) => `Failed: ${error.message}`,
  });
```

### 1-6. Implementation Using neverthrow

```typescript
import { ok, err, Result, ResultAsync } from "neverthrow";

// Basic usage
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return err(new Error("Division by zero"));
  }
  return ok(a / b);
}

// ResultAsync: async version of Result
function fetchUser(id: string): ResultAsync<User, ApiError> {
  return ResultAsync.fromPromise(
    fetch(`/api/users/${id}`).then((r) => r.json()),
    (error) => new ApiError("FETCH_FAILED", String(error))
  );
}

// Combine processing with method chaining
const result = await fetchUser("123")
  .andThen((user) =>
    user.isActive
      ? ok(user)
      : err(new ApiError("INACTIVE_USER", "User is inactive"))
  )
  .map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  }))
  .mapErr((error) => ({
    code: error.code,
    message: error.message,
  }));

// Pattern matching with match
result.match(
  (user) => console.log("User:", user),
  (error) => console.error("Error:", error)
);

// combine: compose multiple Results
const combinedResult = Result.combine([
  validateName(input.name),
  validateEmail(input.email),
  validateAge(input.age),
]);
// Result<[string, string, number], ValidationError>

// combineWithAllErrors: collect all errors
const allErrors = Result.combineWithAllErrors([
  validateName(input.name),
  validateEmail(input.email),
  validateAge(input.age),
]);
// Result<[string, string, number], ValidationError[]>
```

### 1-7. Chaining with the pipe Pattern

```typescript
// pipe function definition
function pipe<A>(value: A): A;
function pipe<A, B>(value: A, fn1: (a: A) => B): B;
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
function pipe<A, B, C, D>(
  value: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D
): D;
function pipe(value: unknown, ...fns: Function[]): unknown {
  return fns.reduce((acc, fn) => fn(acc), value);
}

// pipe-compatible functions for Result
const R = {
  map:
    <T, U, E>(fn: (value: T) => U) =>
    (result: Result<T, E>): Result<U, E> =>
      isOk(result) ? Ok(fn(result.value)) : result,

  flatMap:
    <T, U, E>(fn: (value: T) => Result<U, E>) =>
    (result: Result<T, E>): Result<U, E> =>
      isOk(result) ? fn(result.value) : result,

  mapErr:
    <T, E, F>(fn: (error: E) => F) =>
    (result: Result<T, E>): Result<T, F> =>
      isErr(result) ? Err(fn(result.error)) : result,

  unwrapOr:
    <T, E>(defaultValue: T) =>
    (result: Result<T, E>): T =>
      isOk(result) ? result.value : defaultValue,

  tap:
    <T, E>(fn: (value: T) => void) =>
    (result: Result<T, E>): Result<T, E> => {
      if (isOk(result)) fn(result.value);
      return result;
    },
};

// Usage example
const processedAge = pipe(
  parseAge("25"),
  R.map((n: number) => n + 1),
  R.flatMap((n: number) =>
    n > 0 && n < 150 ? Ok(n) : Err(new Error("Invalid age"))
  ),
  R.tap((n: number) => console.log("Valid age:", n)),
  R.unwrapOr(0)
);
```

---

## 2. Custom Error Hierarchies

### 2-1. Error Class Design

```
+---------------------+
|     AppError        |  Base class
+---------------------+
         |
    +----+--------+----------+
    |             |          |
+---------+ +---------+ +-----------+
|Validation| |NotFound | |Permission |
|Error     | |Error    | |Error      |
+---------+ +---------+ +-----------+
    |
+----------+
|FieldError|  Further specialized
+----------+
```

```typescript
// Base error class
abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    // Fix prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

// Concrete error classes
class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly fields: Record<string, string[]>
  ) {
    super(message);
  }
}

class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly statusCode = 404;

  constructor(public readonly resource: string, public readonly id: string) {
    super(`${resource} with id ${id} not found`);
  }
}

class PermissionError extends AppError {
  readonly code = "PERMISSION_DENIED";
  readonly statusCode = 403;

  constructor(
    public readonly action: string,
    public readonly resource: string
  ) {
    super(`Permission denied: cannot ${action} on ${resource}`);
  }
}
```

### 2-2. Extended Error Hierarchy Design

In production projects, finer-grained error classification is needed.

```typescript
// ─── Infrastructure Errors ───
class InfraError extends AppError {
  readonly code = "INFRA_ERROR";
  readonly statusCode = 500;

  constructor(
    message: string,
    public readonly service: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

class DatabaseError extends InfraError {
  readonly code = "DATABASE_ERROR" as const;

  constructor(
    message: string,
    public readonly query?: string,
    cause?: unknown
  ) {
    super(message, "database", cause);
  }
}

class ExternalApiError extends InfraError {
  readonly code = "EXTERNAL_API_ERROR" as const;

  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly responseStatus?: number,
    cause?: unknown
  ) {
    super(message, "external_api", cause);
  }
}

class CacheError extends InfraError {
  readonly code = "CACHE_ERROR" as const;

  constructor(
    message: string,
    public readonly key?: string,
    cause?: unknown
  ) {
    super(message, "cache", cause);
  }
}

// ─── Business Logic Errors ───
class BusinessError extends AppError {
  abstract readonly statusCode: number;

  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

class ConflictError extends BusinessError {
  readonly code = "CONFLICT";
  readonly statusCode = 409;

  constructor(
    public readonly resource: string,
    public readonly conflictField: string,
    public readonly conflictValue: string
  ) {
    super(
      `${resource} with ${conflictField}=${conflictValue} already exists`
    );
  }
}

class RateLimitError extends BusinessError {
  readonly code = "RATE_LIMIT_EXCEEDED";
  readonly statusCode = 429;

  constructor(
    public readonly limit: number,
    public readonly windowMs: number,
    public readonly retryAfterMs: number
  ) {
    super(`Rate limit exceeded: ${limit} requests per ${windowMs}ms`);
  }
}

class InsufficientBalanceError extends BusinessError {
  readonly code = "INSUFFICIENT_BALANCE";
  readonly statusCode = 422;

  constructor(
    public readonly required: number,
    public readonly available: number,
    public readonly currency: string
  ) {
    super(
      `Insufficient balance: required ${required} ${currency}, available ${available} ${currency}`
    );
  }
}

class ExpiredError extends BusinessError {
  readonly code = "EXPIRED";
  readonly statusCode = 410;

  constructor(
    public readonly resource: string,
    public readonly expiredAt: Date
  ) {
    super(`${resource} expired at ${expiredAt.toISOString()}`);
  }
}
```

### 2-3. Exhaustiveness Check with Literal Type Error Codes

```typescript
// Define all error codes as a union of literal types
type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "INSUFFICIENT_BALANCE"
  | "EXPIRED"
  | "DATABASE_ERROR"
  | "EXTERNAL_API_ERROR"
  | "CACHE_ERROR";

// Discriminated union of domain errors
type DomainError =
  | ValidationError
  | NotFoundError
  | PermissionError
  | ConflictError
  | RateLimitError
  | InsufficientBalanceError
  | ExpiredError;

// Helper for exhaustiveness check
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

// Branching by error code (with exhaustiveness check)
function handleDomainError(error: DomainError): HttpResponse {
  switch (error.code) {
    case "VALIDATION_ERROR":
      return {
        status: 400,
        body: {
          code: error.code,
          message: error.message,
          fields: error.fields,
        },
      };
    case "NOT_FOUND":
      return {
        status: 404,
        body: {
          code: error.code,
          message: error.message,
          resource: error.resource,
        },
      };
    case "PERMISSION_DENIED":
      return {
        status: 403,
        body: { code: error.code, message: error.message },
      };
    case "CONFLICT":
      return {
        status: 409,
        body: { code: error.code, message: error.message },
      };
    case "RATE_LIMIT_EXCEEDED":
      return {
        status: 429,
        body: {
          code: error.code,
          message: error.message,
          retryAfter: error.retryAfterMs,
        },
      };
    case "INSUFFICIENT_BALANCE":
      return {
        status: 422,
        body: { code: error.code, message: error.message },
      };
    case "EXPIRED":
      return {
        status: 410,
        body: { code: error.code, message: error.message },
      };
    default:
      // If this is reached, a new case has been added to DomainError
      return assertNever(error);
  }
}
```

### 2-4. Combining Result Type with Custom Errors

```typescript
type DomainError = ValidationError | NotFoundError | PermissionError;

type DomainResult<T> = Result<T, DomainError>;

async function getUser(id: string): Promise<DomainResult<User>> {
  const user = await db.users.findById(id);
  if (!user) {
    return Err(new NotFoundError("User", id));
  }
  return Ok(user);
}

async function updateUser(
  requesterId: string,
  targetId: string,
  data: unknown
): Promise<DomainResult<User>> {
  // Permission check
  if (requesterId !== targetId) {
    return Err(new PermissionError("update", "User"));
  }

  // Validation
  const validation = userSchema.safeParse(data);
  if (!validation.success) {
    return Err(
      new ValidationError("Invalid user data", formatZodErrors(validation.error))
    );
  }

  // Update
  const result = await getUser(targetId);
  if (isErr(result)) return result;

  const updated = await db.users.update(targetId, validation.data);
  return Ok(updated);
}
```

### 2-5. Error Factory Pattern

In large-scale projects, it is useful to have a factory that centralizes error creation.

```typescript
// Error factory
class AppErrors {
  // ─── Validation Errors ───
  static validation(fields: Record<string, string[]>): ValidationError {
    return new ValidationError("Validation failed", fields);
  }

  static requiredField(field: string): ValidationError {
    return new ValidationError(`${field} is required`, {
      [field]: [`${field} is required`],
    });
  }

  static invalidFormat(field: string, expected: string): ValidationError {
    return new ValidationError(`${field} has invalid format`, {
      [field]: [`${field} must be in ${expected} format`],
    });
  }

  // ─── 404 Errors ───
  static notFound(resource: string, id: string): NotFoundError {
    return new NotFoundError(resource, id);
  }

  static userNotFound(id: string): NotFoundError {
    return new NotFoundError("User", id);
  }

  static orderNotFound(id: string): NotFoundError {
    return new NotFoundError("Order", id);
  }

  // ─── Permission Errors ───
  static forbidden(action: string, resource: string): PermissionError {
    return new PermissionError(action, resource);
  }

  // ─── Conflict Errors ───
  static duplicate(
    resource: string,
    field: string,
    value: string
  ): ConflictError {
    return new ConflictError(resource, field, value);
  }

  static emailAlreadyExists(email: string): ConflictError {
    return new ConflictError("User", "email", email);
  }

  // ─── Infrastructure Errors ───
  static database(message: string, cause?: unknown): DatabaseError {
    return new DatabaseError(message, undefined, cause);
  }

  static externalApi(
    endpoint: string,
    status?: number,
    cause?: unknown
  ): ExternalApiError {
    return new ExternalApiError(
      `External API error: ${endpoint}`,
      endpoint,
      status,
      cause
    );
  }
}

// Usage example
function createUser(data: CreateUserInput): Promise<DomainResult<User>> {
  const existing = await db.users.findByEmail(data.email);
  if (existing) {
    return Err(AppErrors.emailAlreadyExists(data.email));
  }
  // ...
}
```

### 2-6. Error Serialization and Deserialization

Error serialization for API responses and log output.

```typescript
// Error response type
interface ErrorResponse {
  code: string;
  message: string;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

// Error serializer
class ErrorSerializer {
  static toResponse(error: AppError, requestId?: string): ErrorResponse {
    const base: ErrorResponse = {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp.toISOString(),
      requestId,
    };

    // Add details based on error type
    if (error instanceof ValidationError) {
      base.details = { fields: error.fields };
    } else if (error instanceof NotFoundError) {
      base.details = { resource: error.resource, id: error.id };
    } else if (error instanceof RateLimitError) {
      base.details = {
        limit: error.limit,
        windowMs: error.windowMs,
        retryAfterMs: error.retryAfterMs,
      };
    }

    return base;
  }

  // For log output (with stack trace)
  static toLogEntry(error: AppError, context?: Record<string, unknown>) {
    return {
      level: error.statusCode >= 500 ? "error" : "warn",
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: error.timestamp.toISOString(),
      stack: error.stack,
      cause: error.cause,
      ...context,
    };
  }
}

// Integration with structured logging
import { Logger } from "pino";

function logError(logger: Logger, error: AppError, context?: Record<string, unknown>) {
  const entry = ErrorSerializer.toLogEntry(error, context);
  if (entry.level === "error") {
    logger.error(entry, error.message);
  } else {
    logger.warn(entry, error.message);
  }
}
```

---

## 3. Validation with zod

### 3-1. Schema Definition and Error Conversion

```typescript
import { z } from "zod";

// Schema definition
const UserCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  email: z
    .string()
    .email("Please enter a valid email address"),
  age: z
    .number()
    .int("Age must be an integer")
    .min(0, "Age must be 0 or greater")
    .max(150, "Age must be 150 or less"),
});

// Auto-infer type
type UserCreate = z.infer<typeof UserCreateSchema>;
// => { name: string; email: string; age: number }

// Convert zod to Result type
function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Result<T, ValidationError> {
  const result = schema.safeParse(data);
  if (result.success) {
    return Ok(result.data);
  }

  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!fields[path]) fields[path] = [];
    fields[path].push(issue.message);
  }

  return Err(new ValidationError("Validation failed", fields));
}
```

### 3-2. Advanced zod Patterns

```typescript
// Discriminate request types with discriminatedUnion
const PaymentSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("credit_card"),
    cardNumber: z.string().regex(/^\d{16}$/),
    expiry: z.string().regex(/^\d{2}\/\d{2}$/),
    cvv: z.string().regex(/^\d{3,4}$/),
  }),
  z.object({
    method: z.literal("bank_transfer"),
    bankCode: z.string().length(4),
    accountNumber: z.string().min(7).max(8),
  }),
  z.object({
    method: z.literal("wallet"),
    walletId: z.string().uuid(),
  }),
]);

type Payment = z.infer<typeof PaymentSchema>;

// Shape data with transform
const DateRangeSchema = z
  .object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  })
  .refine((data) => data.start < data.end, {
    message: "Start date must be before end date",
    path: ["start"],
  });
```

### 3-3. Reusable Custom Validators

```typescript
// ─── Custom Validator Definitions ───

// Japanese phone number
const JapanesePhoneNumber = z
  .string()
  .regex(
    /^0[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{4}$/,
    "Please enter a valid Japanese phone number"
  )
  .transform((val) => val.replace(/-/g, ""));

// Postal code
const JapanesePostalCode = z
  .string()
  .regex(/^\d{3}-?\d{4}$/, "Please enter a valid postal code (e.g. 123-4567)")
  .transform((val) => val.replace(/-/, ""));

// Password strength
const StrongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or less")
  .refine(
    (val) => /[A-Z]/.test(val),
    "Password must contain at least one uppercase letter"
  )
  .refine(
    (val) => /[a-z]/.test(val),
    "Password must contain at least one lowercase letter"
  )
  .refine(
    (val) => /[0-9]/.test(val),
    "Password must contain at least one number"
  )
  .refine(
    (val) => /[!@#$%^&*(),.?":{}|<>]/.test(val),
    "Password must contain at least one symbol"
  );

// URL validator (allow only specific domains)
function urlWithDomain(...domains: string[]) {
  return z
    .string()
    .url("Please enter a valid URL")
    .refine(
      (val) => {
        try {
          const url = new URL(val);
          return domains.some(
            (d) => url.hostname === d || url.hostname.endsWith(`.${d}`)
          );
        } catch {
          return false;
        }
      },
      `Allowed domains: ${domains.join(", ")}`
    );
}

// ISO 8601 date string
const ISODateString = z
  .string()
  .datetime({ message: "Please enter an ISO 8601 formatted date string" })
  .transform((val) => new Date(val));

// Non-negative integer (for pagination)
const PositiveInt = z.coerce
  .number()
  .int("Please specify an integer")
  .min(1, "Please specify a value of 1 or greater");

const NonNegativeInt = z.coerce
  .number()
  .int("Please specify an integer")
  .min(0, "Please specify a value of 0 or greater");

// ─── Schema Combination Example ───

const AddressSchema = z.object({
  postalCode: JapanesePostalCode,
  prefecture: z.string().min(1, "Prefecture is required"),
  city: z.string().min(1, "City is required"),
  street: z.string().min(1, "Street address is required"),
  building: z.string().optional(),
  phone: JapanesePhoneNumber.optional(),
});

const UserRegistrationSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: StrongPassword,
    passwordConfirmation: z.string(),
    address: AddressSchema,
    profileUrl: urlWithDomain("github.com", "twitter.com").optional(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  });

type UserRegistration = z.infer<typeof UserRegistrationSchema>;
```

### 3-4. Customizing zod Error Messages

```typescript
// Global message customization via error map
const englishErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.expected === "string") {
        return { message: "Please enter a string" };
      }
      if (issue.expected === "number") {
        return { message: "Please enter a number" };
      }
      return { message: `Please enter a value of type ${issue.expected}` };

    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: `Please enter at least ${issue.minimum} characters` };
      }
      if (issue.type === "number") {
        return { message: `Please enter a value of ${issue.minimum} or greater` };
      }
      if (issue.type === "array") {
        return { message: `At least ${issue.minimum} items are required` };
      }
      return { message: ctx.defaultError };

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return { message: `Please enter ${issue.maximum} characters or fewer` };
      }
      if (issue.type === "number") {
        return { message: `Please enter a value of ${issue.maximum} or less` };
      }
      return { message: ctx.defaultError };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") {
        return { message: "Please enter a valid email address" };
      }
      if (issue.validation === "url") {
        return { message: "Please enter a valid URL" };
      }
      if (issue.validation === "uuid") {
        return { message: "Please enter a valid UUID" };
      }
      return { message: ctx.defaultError };

    default:
      return { message: ctx.defaultError };
  }
};

// Set globally
z.setErrorMap(englishErrorMap);

// Error formatter for forms
function formatZodErrorForForm(
  error: z.ZodError
): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

// Flat list of error messages
function flattenZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
```

### 3-5. Integration of zod with API Validation

```typescript
// zod validation as Express middleware
import { Request, Response, NextFunction } from "express";

function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = formatZodErrorForForm(result.error);
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Invalid input data",
        errors,
      });
    }
    req.body = result.data;
    next();
  };
}

function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = formatZodErrorForForm(result.error);
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters",
        errors,
      });
    }
    // Type-safe query parameters
    (req as any).validatedQuery = result.data;
    next();
  };
}

function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = formatZodErrorForForm(result.error);
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Invalid path parameters",
        errors,
      });
    }
    (req as any).validatedParams = result.data;
    next();
  };
}

// Usage example
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["created_at", "updated_at", "name"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const UserIdSchema = z.object({
  id: z.string().uuid("Please specify a valid user ID"),
});

app.get(
  "/api/users",
  validateQuery(PaginationSchema),
  async (req, res) => {
    const query = (req as any).validatedQuery;
    // query is of type { page: number; limit: number; sort: string; order: string }
    const users = await userService.list(query);
    res.json(users);
  }
);

app.get(
  "/api/users/:id",
  validateParams(UserIdSchema),
  async (req, res) => {
    const { id } = (req as any).validatedParams;
    const result = await userService.getById(id);
    if (isErr(result)) {
      return res.status(result.error.statusCode).json(result.error.toJSON());
    }
    res.json(result.value);
  }
);
```

### 3-6. zod and Environment Variable Validation

```typescript
// Environment variable schema
const EnvSchema = z.object({
  // Required
  NODE_ENV: z.enum(["development", "staging", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, "Example: 1h, 30m, 7d")
    .default("1h"),

  // External API
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // S3
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),
  S3_REGION: z.string().default("ap-northeast-1"),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

type Env = z.infer<typeof EnvSchema>;

// Validate at startup
function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`
    );
    console.error("❌ Environment variable configuration error:");
    console.error(errors.join("\n"));
    process.exit(1);
  }

  return result.data;
}

// Export as singleton
export const env = loadEnv();
```

---

## 4. Async Error Handling

### 4-1. Integration of Promise and Result

```typescript
// AsyncResult type definition
type AsyncResult<T, E> = Promise<Result<T, E>>;

// Async Result utilities
const AsyncR = {
  // map for Promise<Result>
  map: async <T, U, E>(
    asyncResult: AsyncResult<T, E>,
    fn: (value: T) => U
  ): AsyncResult<U, E> => {
    const result = await asyncResult;
    return isOk(result) ? Ok(fn(result.value)) : result;
  },

  // flatMap for Promise<Result>
  flatMap: async <T, U, E>(
    asyncResult: AsyncResult<T, E>,
    fn: (value: T) => AsyncResult<U, E>
  ): AsyncResult<U, E> => {
    const result = await asyncResult;
    return isOk(result) ? fn(result.value) : result;
  },

  // Convert Promise to Result
  fromPromise: async <T, E>(
    promise: Promise<T>,
    errorMapper: (error: unknown) => E
  ): AsyncResult<T, E> => {
    try {
      const value = await promise;
      return Ok(value);
    } catch (error) {
      return Err(errorMapper(error));
    }
  },

  // Parallel execution
  all: async <T, E>(
    results: AsyncResult<T, E>[]
  ): AsyncResult<T[], E> => {
    const resolved = await Promise.all(results);
    return combine(resolved);
  },

  // settled: return all results (including errors)
  allSettled: async <T, E>(
    results: AsyncResult<T, E>[]
  ): Promise<Result<T, E>[]> => {
    return Promise.all(results);
  },
};

// Usage example: chaining async operations
async function processOrder(
  orderId: string,
  userId: string
): AsyncResult<OrderConfirmation, DomainError> {
  // 1. Get user
  const userResult = await getUser(userId);
  if (isErr(userResult)) return userResult;
  const user = userResult.value;

  // 2. Get order
  const orderResult = await getOrder(orderId);
  if (isErr(orderResult)) return orderResult;
  const order = orderResult.value;

  // 3. Permission check
  if (order.userId !== user.id) {
    return Err(new PermissionError("process", "Order"));
  }

  // 4. Process payment
  const paymentResult = await processPayment(order, user);
  if (isErr(paymentResult)) return paymentResult;

  // 5. Send confirmation email
  const emailResult = await sendConfirmation(user.email, order);
  if (isErr(emailResult)) {
    // Email send failure is not fatal, only log
    console.warn("Failed to send confirmation email:", emailResult.error);
  }

  return Ok({
    orderId: order.id,
    status: "confirmed",
    paymentId: paymentResult.value.id,
    processedAt: new Date(),
  });
}
```

### 4-2. Do-Notation Style Pipeline

A do-notation style pattern that solves the problem of too many early returns.

```typescript
// ResultBuilder: do-notation style chain
class ResultBuilder<E> {
  private steps: Map<string, unknown> = new Map();

  async bind<K extends string, T>(
    key: K,
    fn: () => AsyncResult<T, E>
  ): Promise<
    | { success: true; value: T }
    | { success: false; error: Err<E> }
  > {
    const result = await fn();
    if (isErr(result)) {
      return { success: false, error: result };
    }
    this.steps.set(key, result.value);
    return { success: true, value: result.value };
  }

  get<K extends string>(key: K): unknown {
    return this.steps.get(key);
  }
}

// Do-notation helper
async function Do<T, E>(
  fn: (ctx: {
    bind: <V>(result: AsyncResult<V, E>) => Promise<V>;
  }) => AsyncResult<T, E>
): AsyncResult<T, E> {
  try {
    const ctx = {
      bind: async <V>(result: AsyncResult<V, E>): Promise<V> => {
        const r = await result;
        if (isErr(r)) {
          throw { _tag: "ResultError" as const, error: r };
        }
        return r.value;
      },
    };
    return await fn(ctx);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "_tag" in e &&
      (e as any)._tag === "ResultError"
    ) {
      return (e as any).error;
    }
    throw e;
  }
}

// Usage example: flatten with Do-notation
async function processOrder(
  orderId: string,
  userId: string
): AsyncResult<OrderConfirmation, DomainError> {
  return Do(async ({ bind }) => {
    const user = await bind(getUser(userId));
    const order = await bind(getOrder(orderId));

    if (order.userId !== user.id) {
      return Err(new PermissionError("process", "Order"));
    }

    const payment = await bind(processPayment(order, user));

    // Continue even if email send fails
    await sendConfirmation(user.email, order).catch(() => {});

    return Ok({
      orderId: order.id,
      status: "confirmed" as const,
      paymentId: payment.id,
      processedAt: new Date(),
    });
  });
}
```

### 4-3. Retry Pattern

```typescript
interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

async function withRetry<T, E>(
  fn: () => AsyncResult<T, E>,
  options: Partial<RetryOptions> = {}
): AsyncResult<T, E> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastResult: Result<T, E> | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    lastResult = await fn();

    if (isOk(lastResult)) {
      return lastResult;
    }

    // Check if the error is retryable
    if (
      opts.retryableErrors &&
      !opts.retryableErrors(lastResult.error)
    ) {
      return lastResult;
    }

    // Do not retry on the last attempt
    if (attempt < opts.maxRetries) {
      // Exponential backoff with jitter
      const jitter = Math.random() * delay * 0.1;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delay + jitter, opts.maxDelayMs))
      );
      delay *= opts.backoffMultiplier;
    }
  }

  return lastResult!;
}

// Circuit breaker pattern
class CircuitBreaker<T, E> {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private readonly fn: () => AsyncResult<T, E>,
    private readonly options: {
      failureThreshold: number;
      resetTimeoutMs: number;
      fallback?: () => AsyncResult<T, E>;
    }
  ) {}

  async execute(): AsyncResult<T, E> {
    if (this.state === "open") {
      // Check if reset timeout has elapsed
      const now = new Date();
      if (
        this.lastFailure &&
        now.getTime() - this.lastFailure.getTime() > this.options.resetTimeoutMs
      ) {
        this.state = "half-open";
      } else {
        // Return fallback or error
        if (this.options.fallback) {
          return this.options.fallback();
        }
        return Err({
          code: "CIRCUIT_OPEN",
          message: "Circuit breaker is open",
        } as any);
      }
    }

    const result = await this.fn();

    if (isErr(result)) {
      this.failures++;
      this.lastFailure = new Date();

      if (this.failures >= this.options.failureThreshold) {
        this.state = "open";
      }
    } else {
      this.failures = 0;
      this.state = "closed";
    }

    return result;
  }
}

// Usage example
const fetchUserWithRetry = (id: string) =>
  withRetry(() => fetchUser(id), {
    maxRetries: 3,
    retryableErrors: (error) => {
      // Only retry on network errors
      return error instanceof ExternalApiError;
    },
  });

const userCircuitBreaker = new CircuitBreaker(
  () => fetchUser("123"),
  {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    fallback: () => Promise.resolve(Ok(getCachedUser("123"))),
  }
);
```

### 4-4. Timeout Pattern

```typescript
class TimeoutError extends AppError {
  readonly code = "TIMEOUT";
  readonly statusCode = 408;

  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number
  ) {
    super(`Operation "${operationName}" timed out after ${timeoutMs}ms`);
  }
}

async function withTimeout<T, E>(
  fn: () => AsyncResult<T, E>,
  timeoutMs: number,
  operationName: string = "unknown"
): AsyncResult<T, E | TimeoutError> {
  const timeoutPromise = new Promise<Result<never, TimeoutError>>((resolve) =>
    setTimeout(
      () => resolve(Err(new TimeoutError(operationName, timeoutMs))),
      timeoutMs
    )
  );

  return Promise.race([fn(), timeoutPromise]);
}

// Cancellable processing using AbortController
async function fetchWithAbort<T>(
  url: string,
  options: { timeoutMs: number }
): AsyncResult<T, ExternalApiError | TimeoutError> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return Err(
        new ExternalApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          url,
          response.status
        )
      );
    }

    const data = await response.json();
    return Ok(data as T);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      return Err(new TimeoutError("fetch", options.timeoutMs));
    }
    return Err(new ExternalApiError(String(error), url));
  }
}
```

---

## 5. Error Aggregation and Transformation

### 5-1. Error Transformation Between Layers

```
+------------------+     +------------------+     +------------------+
| Presentation     |     | Application      |     | Domain           |
|       Layer      |     |       Layer      |     |       Layer      |
+------------------+     +------------------+     +------------------+
| HttpError        | <-- | ApplicationError | <-- | DomainError      |
| - statusCode     |     | - DomainError    |     | - ValidationError|
| - body           |     | - AuthError      |     | - NotFoundError  |
|                  |     | - InputError     |     | - BusinessError  |
+------------------+     +------------------+     +------------------+
        ^                        ^                        ^
        |                        |                        |
+------------------+     +------------------+     +------------------+
| Infrastructure   |     | External Service |     | Database         |
|       Layer      |     |       Layer      |     |       Layer      |
+------------------+     +------------------+     +------------------+
| InfraError       |     | ExternalApiError |     | DatabaseError    |
+------------------+     +------------------+     +------------------+
```

```typescript
// ─── Error Transformation Mappers Between Layers ───

// Infra error → domain error
function infraToDomainError(error: InfraError): DomainError {
  if (error instanceof DatabaseError) {
    // Unique constraint violation
    if (error.message.includes("unique constraint")) {
      return new ConflictError("Resource", "unknown", "unknown");
    }
    // Other DB errors treated as NotFound or re-thrown
    return new NotFoundError("Resource", "unknown");
  }
  // Catch-all
  throw error; // Infra errors cannot be handled at the domain layer
}

// Domain error → HTTP response
function domainToHttpResponse(error: DomainError): {
  status: number;
  body: ErrorResponse;
} {
  return {
    status: error.statusCode,
    body: ErrorSerializer.toResponse(error),
  };
}

// Error transformation pipeline
class ErrorTransformer {
  private transformers: Map<
    string,
    (error: any) => AppError
  > = new Map();

  register<E extends AppError>(
    code: string,
    transformer: (error: E) => AppError
  ): this {
    this.transformers.set(code, transformer);
    return this;
  }

  transform(error: AppError): AppError {
    const transformer = this.transformers.get(error.code);
    if (transformer) {
      return transformer(error);
    }
    return error;
  }
}

// Usage example
const errorTransformer = new ErrorTransformer()
  .register("DATABASE_ERROR", (error: DatabaseError) => {
    if (error.message.includes("unique constraint")) {
      return new ConflictError("Resource", "field", "value");
    }
    return error;
  })
  .register("EXTERNAL_API_ERROR", (error: ExternalApiError) => {
    if (error.responseStatus === 404) {
      return new NotFoundError("ExternalResource", error.endpoint);
    }
    return error;
  });
```

### 5-2. Aggregating Multiple Validation Errors

```typescript
// Collector for aggregating validation errors
class ValidationCollector {
  private errors: Record<string, string[]> = {};

  add(field: string, message: string): this {
    if (!this.errors[field]) {
      this.errors[field] = [];
    }
    this.errors[field].push(message);
    return this;
  }

  addIf(condition: boolean, field: string, message: string): this {
    if (condition) {
      this.add(field, message);
    }
    return this;
  }

  merge(other: ValidationCollector): this {
    for (const [field, messages] of Object.entries(other.errors)) {
      for (const message of messages) {
        this.add(field, message);
      }
    }
    return this;
  }

  hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  toResult<T>(value: T): Result<T, ValidationError> {
    if (this.hasErrors()) {
      return Err(new ValidationError("Validation failed", this.errors));
    }
    return Ok(value);
  }

  toValidationError(): ValidationError | null {
    if (this.hasErrors()) {
      return new ValidationError("Validation failed", this.errors);
    }
    return null;
  }
}

// Usage example: business rule validation
async function validateOrder(
  order: OrderInput,
  user: User
): Result<OrderInput, ValidationError> {
  const collector = new ValidationCollector();

  // Basic validation with zod schema
  const schemaResult = OrderSchema.safeParse(order);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      collector.add(issue.path.join("."), issue.message);
    }
  }

  // Business rule validation
  collector
    .addIf(
      order.items.length === 0,
      "items",
      "An order must contain at least one item"
    )
    .addIf(
      order.items.length > 100,
      "items",
      "You can order up to 100 items at a time"
    )
    .addIf(
      !user.isVerified,
      "_root",
      "Email address verification has not been completed"
    )
    .addIf(
      user.isSuspended,
      "_root",
      "Your account has been suspended"
    );

  // Inventory check (async)
  for (const item of order.items) {
    const stock = await getStock(item.productId);
    if (!stock || stock.quantity < item.quantity) {
      collector.add(
        `items.${item.productId}`,
        `Insufficient stock (remaining: ${stock?.quantity ?? 0})`
      );
    }
  }

  return collector.toResult(order);
}
```

### 5-3. Error Propagation and Transformation Chain

```typescript
// Repository layer: convert DB-specific errors to domain errors
class UserRepository {
  async findById(id: string): AsyncResult<User, NotFoundError | DatabaseError> {
    try {
      const row = await this.db.query("SELECT * FROM users WHERE id = $1", [id]);
      if (!row) {
        return Err(new NotFoundError("User", id));
      }
      return Ok(this.mapToUser(row));
    } catch (error) {
      return Err(new DatabaseError("Failed to query user", undefined, error));
    }
  }

  async create(data: CreateUserInput): AsyncResult<User, ConflictError | DatabaseError> {
    try {
      const row = await this.db.query(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
        [data.name, data.email]
      );
      return Ok(this.mapToUser(row));
    } catch (error: unknown) {
      // PostgreSQL unique constraint violation
      if (
        error instanceof Error &&
        error.message.includes("unique_violation")
      ) {
        return Err(new ConflictError("User", "email", data.email));
      }
      return Err(new DatabaseError("Failed to create user", undefined, error));
    }
  }

  private mapToUser(row: any): User {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Service layer: convert repository errors to application errors
class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly emailService: EmailService
  ) {}

  async register(
    input: unknown
  ): AsyncResult<User, ValidationError | ConflictError | InfraError> {
    // 1. Validation
    const validated = validate(UserRegistrationSchema, input);
    if (isErr(validated)) return validated;

    // 2. Create user
    const created = await this.userRepo.create(validated.value);
    if (isErr(created)) return created;

    // 3. Welcome email (continue on failure)
    const emailResult = await this.emailService.sendWelcome(created.value.email);
    if (isErr(emailResult)) {
      // Log the email send failure, but consider user creation a success
      console.warn("Welcome email failed:", emailResult.error);
    }

    return created;
  }
}

// Controller layer: convert service errors to HTTP responses
class UserController {
  constructor(private readonly userService: UserService) {}

  async register(req: Request, res: Response): Promise<void> {
    const result = await this.userService.register(req.body);

    result.match({
      ok: (user) => {
        res.status(201).json(user);
      },
      err: (error) => {
        const response = domainToHttpResponse(error);
        res.status(response.status).json(response.body);
      },
    });
  }
}
```

---

## 6. Integration Patterns in Production

### 6-1. Global Error Handling in Express

```typescript
import express, { Request, Response, NextFunction, ErrorRequestHandler } from "express";

// Global error handler
const globalErrorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Get request ID
  const requestId = req.headers["x-request-id"] as string | undefined;

  // Check if it is an AppError instance
  if (error instanceof AppError) {
    const response = ErrorSerializer.toResponse(error, requestId);

    // For 5xx errors, also log the stack trace
    if (error.statusCode >= 500) {
      console.error("Internal error:", {
        ...response,
        stack: error.stack,
        cause: error.cause,
      });
    }

    res.status(error.statusCode).json(response);
    return;
  }

  // Unexpected error
  console.error("Unexpected error:", error);
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    requestId,
  });
};

// Wrapper for async route handlers
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// Route handler using Result
function resultHandler<T>(
  fn: (req: Request) => AsyncResult<T, AppError>
) {
  return asyncHandler(async (req, res) => {
    const result = await fn(req);

    if (isOk(result)) {
      res.json(result.value);
    } else {
      const error = result.error;
      const response = ErrorSerializer.toResponse(error);
      res.status(error.statusCode).json(response);
    }
  });
}

// Application setup
const app = express();
app.use(express.json());

// Route definitions
app.post(
  "/api/users",
  resultHandler(async (req) => {
    return userService.register(req.body);
  })
);

app.get(
  "/api/users/:id",
  resultHandler(async (req) => {
    return userService.getById(req.params.id);
  })
);

// Register global error handler (at the end)
app.use(globalErrorHandler);
```

### 6-2. Error Handling in NestJS

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

// Exception filter for NestJS
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    if (exception instanceof AppError) {
      response.status(exception.statusCode).json(
        ErrorSerializer.toResponse(exception, request.id)
      );
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      response.status(status).json(
        typeof exceptionResponse === "string"
          ? { code: "HTTP_ERROR", message: exceptionResponse }
          : exceptionResponse
      );
      return;
    }

    // Unexpected error
    console.error("Unhandled exception:", exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
  }
}

// NestJS interceptor for services returning Result
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, map } from "rxjs";

@Injectable()
export class ResultInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((result) => {
        if (result && typeof result === "object" && "_tag" in result) {
          if (result._tag === "Err") {
            const error = result.error;
            if (error instanceof AppError) {
              throw error; // Processed by AppExceptionFilter
            }
          }
          if (result._tag === "Ok") {
            return result.value;
          }
        }
        return result;
      })
    );
  }
}

// Usage in controller
@Controller("users")
@UseFilters(AppExceptionFilter)
@UseInterceptors(ResultInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.userService.register(body);
    // Returns Result<User, AppError>
    // ResultInterceptor converts Ok → value, Err → throw
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.userService.getById(id);
  }
}
```

### 6-3. Error Handling in tRPC

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.context<Context>().create({
  // Global zod error formatter
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError
            ? error.cause.flatten()
            : null,
        appError:
          error.cause instanceof AppError
            ? error.cause.toJSON()
            : null,
      },
    };
  },
});

// Helper to convert Result to TRPCError
function resultToTRPC<T>(result: Result<T, AppError>): T {
  if (isOk(result)) {
    return result.value;
  }

  const error = result.error;
  const codeMap: Record<string, TRPCError["code"]> = {
    VALIDATION_ERROR: "BAD_REQUEST",
    NOT_FOUND: "NOT_FOUND",
    PERMISSION_DENIED: "FORBIDDEN",
    CONFLICT: "CONFLICT",
    RATE_LIMIT_EXCEEDED: "TOO_MANY_REQUESTS",
    INSUFFICIENT_BALANCE: "PRECONDITION_FAILED",
    EXPIRED: "PRECONDITION_FAILED",
  };

  throw new TRPCError({
    code: codeMap[error.code] ?? "INTERNAL_SERVER_ERROR",
    message: error.message,
    cause: error,
  });
}

// Router definition
const userRouter = t.router({
  create: t.procedure
    .input(UserCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.userService.register(input);
      return resultToTRPC(result);
    }),

  getById: t.procedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const result = await ctx.userService.getById(input.id);
      return resultToTRPC(result);
    }),

  list: t.procedure
    .input(PaginationSchema)
    .query(async ({ input, ctx }) => {
      const result = await ctx.userService.list(input);
      return resultToTRPC(result);
    }),
});
```

### 6-4. Error Handling in GraphQL

```typescript
import { GraphQLError } from "graphql";

// Convert Result to GraphQL response
function resultToGraphQL<T>(
  result: Result<T, AppError>
): T {
  if (isOk(result)) {
    return result.value;
  }

  const error = result.error;

  // GraphQL error code extension
  throw new GraphQLError(error.message, {
    extensions: {
      code: error.code,
      statusCode: error.statusCode,
      ...(error instanceof ValidationError
        ? { fields: error.fields }
        : {}),
    },
  });
}

// Error representation using Union types (GraphQL style)
// GraphQL Schema:
// union UserResult = User | ValidationErrorPayload | NotFoundErrorPayload

interface UserResultSuccess {
  __typename: "User";
  id: string;
  name: string;
  email: string;
}

interface ValidationErrorPayload {
  __typename: "ValidationError";
  message: string;
  fields: Array<{ path: string; messages: string[] }>;
}

interface NotFoundErrorPayload {
  __typename: "NotFoundError";
  message: string;
  resource: string;
}

type UserResult = UserResultSuccess | ValidationErrorPayload | NotFoundErrorPayload;

function domainResultToGraphQLUnion(
  result: Result<User, DomainError>
): UserResult {
  if (isOk(result)) {
    return {
      __typename: "User",
      ...result.value,
    };
  }

  const error = result.error;
  if (error instanceof ValidationError) {
    return {
      __typename: "ValidationError",
      message: error.message,
      fields: Object.entries(error.fields).map(([path, messages]) => ({
        path,
        messages,
      })),
    };
  }
  if (error instanceof NotFoundError) {
    return {
      __typename: "NotFoundError",
      message: error.message,
      resource: error.resource,
    };
  }

  throw new GraphQLError("Internal error");
}
```

---

## 7. Testing Strategy

### 7-1. Testing the Result Type

```typescript
import { describe, it, expect } from "vitest";

describe("Result utilities", () => {
  describe("map", () => {
    it("should transform Ok value", () => {
      const result = Ok(5);
      const mapped = map(result, (n) => n * 2);
      expect(mapped).toEqual(Ok(10));
    });

    it("should pass through Err", () => {
      const result = Err("error");
      const mapped = map(result, (n: number) => n * 2);
      expect(mapped).toEqual(Err("error"));
    });
  });

  describe("flatMap", () => {
    it("should chain Ok values", () => {
      const result = Ok(10);
      const chained = flatMap(result, (n) =>
        n > 0 ? Ok(n) : Err("must be positive")
      );
      expect(chained).toEqual(Ok(10));
    });

    it("should short-circuit on Err", () => {
      const result = Err("first error");
      const chained = flatMap(result, (n: number) => Ok(n * 2));
      expect(chained).toEqual(Err("first error"));
    });
  });

  describe("combine", () => {
    it("should combine all Ok results", () => {
      const results = [Ok(1), Ok(2), Ok(3)];
      expect(combine(results)).toEqual(Ok([1, 2, 3]));
    });

    it("should return first Err", () => {
      const results = [Ok(1), Err("error"), Ok(3)];
      expect(combine(results)).toEqual(Err("error"));
    });
  });
});

// Custom matchers
expect.extend({
  toBeOk(received: Result<any, any>) {
    const pass = isOk(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected Result not to be Ok, got Ok(${JSON.stringify(received.value)})`
          : `Expected Result to be Ok, got Err(${JSON.stringify(
              (received as Err<any>).error
            )})`,
    };
  },
  toBeErr(received: Result<any, any>) {
    const pass = isErr(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected Result not to be Err, got Err(${JSON.stringify(received.error)})`
          : `Expected Result to be Err, got Ok(${JSON.stringify(
              (received as Ok<any>).value
            )})`,
    };
  },
  toBeOkWith(received: Result<any, any>, expected: any) {
    const pass = isOk(received) && JSON.stringify(received.value) === JSON.stringify(expected);
    return {
      pass,
      message: () =>
        pass
          ? `Expected Result not to be Ok(${JSON.stringify(expected)})`
          : `Expected Ok(${JSON.stringify(expected)}), got ${JSON.stringify(received)}`,
    };
  },
  toBeErrWith(received: Result<any, any>, expectedCode: string) {
    const pass =
      isErr(received) &&
      received.error instanceof AppError &&
      received.error.code === expectedCode;
    return {
      pass,
      message: () =>
        pass
          ? `Expected Result not to be Err with code "${expectedCode}"`
          : `Expected Err with code "${expectedCode}", got ${JSON.stringify(received)}`,
    };
  },
});

// Type extension
declare module "vitest" {
  interface Assertion<T = any> {
    toBeOk(): void;
    toBeErr(): void;
    toBeOkWith(expected: any): void;
    toBeErrWith(expectedCode: string): void;
  }
}
```

### 7-2. Testing Errors in the Service Layer

```typescript
describe("UserService", () => {
  let userService: UserService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockUserRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      findByEmail: jest.fn(),
    } as any;
    mockEmailService = {
      sendWelcome: jest.fn(),
    } as any;
    userService = new UserService(mockUserRepo, mockEmailService);
  });

  describe("register", () => {
    const validInput = {
      name: "Test User",
      email: "test@example.com",
      password: "Password123!",
      passwordConfirmation: "Password123!",
    };

    it("should return ValidationError for invalid input", async () => {
      const result = await userService.register({});
      expect(result).toBeErr();
      expect(result).toBeErrWith("VALIDATION_ERROR");
    });

    it("should return ConflictError for duplicate email", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(Ok({ id: "existing" } as User));
      const result = await userService.register(validInput);
      expect(result).toBeErrWith("CONFLICT");
    });

    it("should create user successfully", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(Ok(null as any));
      mockUserRepo.create.mockResolvedValue(
        Ok({ id: "new-id", ...validInput } as User)
      );
      mockEmailService.sendWelcome.mockResolvedValue(Ok(undefined));

      const result = await userService.register(validInput);
      expect(result).toBeOk();
    });

    it("should succeed even if welcome email fails", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(Ok(null as any));
      mockUserRepo.create.mockResolvedValue(
        Ok({ id: "new-id", ...validInput } as User)
      );
      mockEmailService.sendWelcome.mockResolvedValue(
        Err(new InfraError("SMTP error", "email"))
      );

      const result = await userService.register(validInput);
      // User creation succeeds even if email send fails
      expect(result).toBeOk();
    });

    it("should return DatabaseError on DB failure", async () => {
      mockUserRepo.findByEmail.mockResolvedValue(Ok(null as any));
      mockUserRepo.create.mockResolvedValue(
        Err(new DatabaseError("Connection refused"))
      );

      const result = await userService.register(validInput);
      expect(result).toBeErrWith("DATABASE_ERROR");
    });
  });
});
```

### 7-3. Property-Based Testing

```typescript
import * as fc from "fast-check";

describe("Result laws", () => {
  // Functor law: map(id) === id
  it("should satisfy functor identity law", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const result: Result<number, string> = Ok(n);
        const mapped = map(result, (x) => x);
        expect(mapped).toEqual(result);
      })
    );
  });

  // Functor law: map(f . g) === map(f) . map(g)
  it("should satisfy functor composition law", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const f = (x: number) => x * 2;
        const g = (x: number) => x + 1;

        const result: Result<number, string> = Ok(n);
        const lhs = map(result, (x) => f(g(x)));
        const rhs = map(map(result, g), f);

        expect(lhs).toEqual(rhs);
      })
    );
  });

  // Monad law: flatMap(Ok) === id
  it("should satisfy monad left identity", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const f = (x: number): Result<number, string> =>
          x > 0 ? Ok(x) : Err("negative");

        const lhs = flatMap(Ok(n), f);
        const rhs = f(n);

        expect(lhs).toEqual(rhs);
      })
    );
  });
});

// Property tests for validation
describe("Validation properties", () => {
  it("should accept any valid email", () => {
    fc.assert(
      fc.property(fc.emailAddress(), (email) => {
        const result = z.string().email().safeParse(email);
        expect(result.success).toBe(true);
      })
    );
  });

  it("should reject non-email strings", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("@")),
        (notEmail) => {
          const result = z.string().email().safeParse(notEmail);
          expect(result.success).toBe(false);
        }
      )
    );
  });
});
```

### 7-4. Verifying Error Responses in E2E Tests

```typescript
import request from "supertest";

describe("POST /api/users", () => {
  it("should return 400 with validation errors for invalid input", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ name: "", email: "invalid" })
      .expect(400);

    expect(response.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.any(String),
    });
    expect(response.body.details.fields).toHaveProperty("name");
    expect(response.body.details.fields).toHaveProperty("email");
  });

  it("should return 409 for duplicate email", async () => {
    // First, create a user
    await request(app)
      .post("/api/users")
      .send({
        name: "Test",
        email: "dup@example.com",
        password: "Password123!",
        passwordConfirmation: "Password123!",
      })
      .expect(201);

    // Create again with the same email
    const response = await request(app)
      .post("/api/users")
      .send({
        name: "Test2",
        email: "dup@example.com",
        password: "Password123!",
        passwordConfirmation: "Password123!",
      })
      .expect(409);

    expect(response.body.code).toBe("CONFLICT");
  });

  it("should return 404 for non-existent user", async () => {
    const response = await request(app)
      .get("/api/users/non-existent-id")
      .expect(404);

    expect(response.body.code).toBe("NOT_FOUND");
  });
});
```

---

## 8. Performance Considerations

### 8-1. Result Type Overhead

```typescript
// ─── Benchmark: Result Type vs Exceptions ───

// Exception-based
function divideWithThrow(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
}

// Result-based
function divideWithResult(a: number, b: number): Result<number, string> {
  if (b === 0) return Err("Division by zero");
  return Ok(a / b);
}

// Benchmark results (approximate):
// Success path:
//   Exception-based:  ~5ns/op
//   Result-based: ~20ns/op (object creation overhead)
//
// Error path:
//   Exception-based:  ~10,000ns/op (stack trace generation is expensive)
//   Result-based: ~20ns/op (constant)
//
// Conclusion: Result type is overwhelmingly faster for paths where errors occur frequently

// ─── Performance Optimization Techniques ───

// 1. Singleton Err pattern (when returning the same error repeatedly)
const DIVISION_BY_ZERO_ERR = Err("Division by zero") as Result<never, string>;

function divideFast(a: number, b: number): Result<number, string> {
  if (b === 0) return DIVISION_BY_ZERO_ERR;
  return Ok(a / b);
}

// 2. Disable stack trace for Error class
class LightweightError extends AppError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    // Skip stack trace generation
    // Performance improves but debug information is lost
    this.stack = undefined;
  }
}

// 3. Lazy error creation
function divideWithLazy(a: number, b: number): Result<number, () => Error> {
  if (b === 0) return Err(() => new Error("Division by zero"));
  return Ok(a / b);
}
// Only create when error details are needed
const result = divideWithLazy(1, 0);
if (isErr(result)) {
  const error = result.error(); // Error is created only here
  console.error(error.stack);
}
```

### 8-2. zod Performance Optimization

```typescript
// 1. Pre-compile schemas
// Bad: create schema per request
app.post("/api/users", (req, res) => {
  const schema = z.object({ name: z.string() }); // created every time
  schema.parse(req.body);
});

// Good: define schema at module level
const UserSchema = z.object({ name: z.string() });
app.post("/api/users", (req, res) => {
  UserSchema.parse(req.body); // reused
});

// 2. Validating large amounts of data
// Bad: validate entire array at once
const LargeArraySchema = z.array(UserSchema);

// Good: bounded with size limit + stream processing
const BoundedArraySchema = z.array(UserSchema).max(1000);

// 3. Use coerce only when necessary
// Bad: coerce for all fields
const schema1 = z.object({
  id: z.coerce.string(),   // unnecessary conversion
  name: z.coerce.string(), // unnecessary conversion
  age: z.coerce.number(),  // this is necessary
});

// Good: coerce only for fields that need it
const schema2 = z.object({
  id: z.string(),
  name: z.string(),
  age: z.coerce.number(), // necessary for conversion from query parameters
});

// 4. Comparison with typia (compile-time code generation)
// 10-100x faster than zod but cannot do runtime schema manipulation
import typia from "typia";

interface UserInput {
  name: string;
  email: string & typia.tags.Format<"email">;
  age: number & typia.tags.Minimum<0> & typia.tags.Maximum<150>;
}

// Validation code is generated at compile time
const validateUser = typia.createValidate<UserInput>();
const result = validateUser(input);
```

---

## Comparison Tables

### Error Handling Strategy Comparison

| Strategy | Type Safety | Cost | Readability | Use Case |
|------|---------|--------|--------|---------|
| try-catch | Low (unknown) | Low | Medium | Calling external libraries |
| Result type | High | Medium | High | Domain logic |
| Either (fp-ts) | High | High | Medium | Full functional style |
| zod safeParse | High | Low | High | Input validation |
| Effect-ts | Highest | High | Low-Medium | Large-scale effect management |

### Result Type Library Comparison

| Library | Bundle Size | API Style | Chaining | Pattern Matching |
|-----------|-------------|-------------|---------|--------------|
| Custom implementation | 0 KB | Functional | Manual | switch/if |
| neverthrow | ~2 KB | Method chaining | `.andThen()` | `.match()` |
| ts-results | ~1 KB | Rust-style | `.map()` | `.match()` |
| fp-ts Either | ~15 KB | Functional (pipe) | `pipe()` | `fold()` |
| effect/Either | ~50 KB+ | Effect-style | `Effect.map` | `Effect.match` |

### Validation Library Comparison

| Library | Bundle Size | Speed | Type Inference | Schema Description | Ecosystem |
|-----------|-------------|------|--------|------------|------------|
| zod | ~13 KB | Medium | Excellent | Method chaining | Rich |
| yup | ~15 KB | Medium | Good | Method chaining | Rich |
| io-ts | ~8 KB | Medium | Excellent | Functional | Moderate |
| typia | 0 KB (compile-time) | Fastest | Complete | TypeScript types | Small |
| valibot | ~1 KB | Fast | Excellent | Functional | Growing |
| arktype | ~6 KB | Fast | Excellent | Template literals | Small |

---

## Anti-Patterns

### AP-1: Swallowing Type Information in catch

```typescript
// NG: process error while it is still unknown
async function fetchUser(id: string): Promise<User> {
  try {
    return await api.get(`/users/${id}`);
  } catch (error) {
    // error is unknown -- no type information
    console.log(error.message); // does not cause a compile error but is dangerous
    throw error; // caller also gets unknown
  }
}

// OK: preserve type with Result type
async function fetchUser(id: string): Promise<Result<User, ApiError>> {
  try {
    const user = await api.get(`/users/${id}`);
    return Ok(user);
  } catch (error) {
    return Err(ApiError.fromUnknown(error));
  }
}
```

### AP-2: Discriminating Errors by String

```typescript
// NG: string comparison is fragile
try {
  await saveUser(data);
} catch (e) {
  if (e.message.includes("duplicate")) {  // typos go unnoticed
    // ...
  }
}

// OK: discriminate by type
const result = await saveUser(data);
if (isErr(result)) {
  switch (result.error.code) {
    case "VALIDATION_ERROR":   // literal type enables autocomplete
      handleValidation(result.error);
      break;
    case "NOT_FOUND":
      handleNotFound(result.error);
      break;
  }
}
```

### AP-3: Trusting External Input Without Validation

```typescript
// NG: type assertion of req.body as-is
app.post("/users", (req, res) => {
  const data = req.body as UserCreate; // no runtime check
  db.users.create(data);              // invalid data enters DB
});

// OK: validate with zod
app.post("/users", (req, res) => {
  const result = validate(UserCreateSchema, req.body);
  if (isErr(result)) {
    return res.status(400).json(result.error.toJSON());
  }
  db.users.create(result.value); // validated data
});
```

### AP-4: Excessive try-catch Nesting

```typescript
// NG: deeply nested, low readability
async function processOrder(orderId: string) {
  try {
    const order = await getOrder(orderId);
    try {
      const payment = await processPayment(order);
      try {
        await sendReceipt(order, payment);
      } catch (e) {
        console.error("Receipt failed:", e);
      }
    } catch (e) {
      console.error("Payment failed:", e);
      throw e;
    }
  } catch (e) {
    console.error("Order failed:", e);
    throw e;
  }
}

// OK: flat with Result type
async function processOrder(
  orderId: string
): AsyncResult<OrderConfirmation, DomainError> {
  const order = await getOrder(orderId);
  if (isErr(order)) return order;

  const payment = await processPayment(order.value);
  if (isErr(payment)) return payment;

  // Continue even if email send fails
  await sendReceipt(order.value, payment.value);

  return Ok({ orderId, paymentId: payment.value.id });
}
```

### AP-5: Swallowing Errors

```typescript
// NG: completely ignore errors
async function fetchData() {
  try {
    return await api.get("/data");
  } catch {
    return null; // unclear what happened
  }
}

// OK: properly handle and transform errors
async function fetchData(): AsyncResult<Data, ApiError> {
  return AsyncR.fromPromise(
    api.get("/data"),
    (error) => new ApiError("FETCH_FAILED", String(error))
  );
}
```

### AP-6: Overusing unwrap

```typescript
// NG: unwrap can panic
const user = (await getUser(id)).unwrap(); // throws on error

// OK: handle safely with pattern matching
const result = await getUser(id);
if (isErr(result)) {
  return handleError(result.error);
}
const user = result.value;

// Or use unwrapOr for a default value
const user = unwrapOr(await getUser(id), defaultUser);
```

### AP-7: Overly Generic Error Types

```typescript
// NG: represent everything with the Error class
function createUser(data: unknown): Result<User, Error> {
  // With Error, unclear what happened
}

// OK: use specific error types
function createUser(
  data: unknown
): Result<User, ValidationError | ConflictError | DatabaseError> {
  // Caller can handle appropriately
}
```

---

## Overall Error Handling Flow

```
External Input (HTTP, File, ENV)
    |
    v
+------------------+
| zod Validation   |---Err---> 400 Bad Request
+------------------+
    | Ok
    v
+------------------+
| Domain Logic     |---Err---> DomainError
| (Result<T, E>)   |           |
+------------------+           +---> NotFoundError    -> 404
    | Ok                       +---> PermissionError  -> 403
    v                          +---> ConflictError    -> 409
+------------------+           +---> BusinessError    -> 422
| Persistence /    |---Err---> InfraError -> 500
| External API     |           |
+------------------+           +---> DatabaseError    -> 500
    | Ok                       +---> ExternalApiError -> 502
    v                          +---> TimeoutError     -> 408
 Success Response 200          +---> RateLimitError   -> 429
```

### Detailed Flow: User Registration

```
POST /api/users { name, email, password }
    |
    v
+------------------------------+
| Express Middleware            |
| - JSON parsing                |
| - Assign request ID           |
| - Rate limit check            |
+------------------------------+
    |
    v
+------------------------------+
| Validation Layer              |
| - zod schema validation       |
| - Password strength check     |
+------------------------------+
    |
    v (ValidationError → 400)
+------------------------------+
| Application Service           |
| - Duplicate email check       |
| - Create user                 |
| - Send welcome email          |
+------------------------------+
    |
    v (ConflictError → 409)
+------------------------------+
| Repository Layer              |
| - SQL INSERT                  |
| - Unique constraint check     |
+------------------------------+
    |
    v (DatabaseError → 500)
+------------------------------+
| Email Service                 |
| - SMTP send                   |
| - On failure: warn log only   |
+------------------------------+
    |
    v
201 Created { id, name, email }
```

---

## Design Guidelines

### Error Design Checklist

| Checklist Item | Description |
|------------|------|
| Are error codes unique? | Is the same code not used with different meanings? |
| Are error messages user-friendly? | Technical details go in details; messages should be easy to understand |
| Are HTTP status codes appropriate? | Is the distinction between 4xx and 5xx correct? |
| Is sensitive information not leaking? | Are stack traces or DB information not being returned to the client? |
| Is the log level appropriate? | 4xx as warn, 5xx as error |
| Are errors testable? | Are error path tests easy to write? |
| Is there an exhaustiveness check? | Does adding a new error cause a compile error? |
| Is retryability clear? | Can the client tell whether to retry? |

### Error Handling Policy by Layer

| Layer | Error Handling Policy |
|---------|--------------|
| Presentation layer | Transform errors to HTTP responses, output logs |
| Application layer | Aggregate domain errors, manage transactions |
| Domain layer | Express business rule violations with Result type, no throwing |
| Infrastructure layer | Convert external service exceptions to Result type |
| Common/cross-cutting | Global error handler, error monitoring |

### Internationalization of Error Messages

```typescript
// Separate error codes from messages
const ERROR_MESSAGES: Record<string, Record<ErrorCode, string>> = {
  ja: {
    VALIDATION_ERROR: "入力データが不正です",
    NOT_FOUND: "リソースが見つかりません",
    PERMISSION_DENIED: "アクセス権限がありません",
    CONFLICT: "リソースが既に存在します",
    RATE_LIMIT_EXCEEDED: "リクエスト数が上限を超えました",
    INSUFFICIENT_BALANCE: "残高が不足しています",
    EXPIRED: "有効期限が切れています",
    DATABASE_ERROR: "データベースエラーが発生しました",
    EXTERNAL_API_ERROR: "外部サービスとの通信に失敗しました",
    CACHE_ERROR: "キャッシュエラーが発生しました",
  },
  en: {
    VALIDATION_ERROR: "Invalid input data",
    NOT_FOUND: "Resource not found",
    PERMISSION_DENIED: "Permission denied",
    CONFLICT: "Resource already exists",
    RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
    INSUFFICIENT_BALANCE: "Insufficient balance",
    EXPIRED: "Resource has expired",
    DATABASE_ERROR: "Database error occurred",
    EXTERNAL_API_ERROR: "External service communication failed",
    CACHE_ERROR: "Cache error occurred",
  },
};

function getLocalizedMessage(code: ErrorCode, locale: string = "en"): string {
  return ERROR_MESSAGES[locale]?.[code] ?? ERROR_MESSAGES["en"][code] ?? code;
}
```

---

## FAQ

### Q1: If I use the Result type, do I need try-catch at all?

No. External libraries (DB drivers, HTTP clients, etc.) throw exceptions, so try-catch is still needed at boundary layers (adapter layers). Use the "boundary pattern" to catch exceptions there and convert them to the Result type. Inside domain logic, only use the Result type and prohibit throwing — that is the best practice.

### Q2: Should I use neverthrow or a custom Result type?

A custom implementation is sufficient for small-scale projects or libraries. If you want team-wide consistency or use method chaining (`.andThen()`, `.map()`, `.match()`) heavily, neverthrow is convenient. neverthrow is ~2KB and designed specifically for TypeScript.

### Q3: Does zod performance become a problem?

In typical web applications it is not a problem. zod validation takes microseconds to milliseconds per request. However, when validating large amounts of data (arrays of tens of thousands of items), consider adding a size check before `.parse()` or using stream processing. If performance is an issue, typia (compile-time code generation) or valibot (lightweight validation) are also options.

### Q4: In which layer should error logging be done?

Error logging should in principle be done centrally at the application layer (controllers or handlers). Logging inside domain logic creates noise during testing and causes the same error to be logged multiple times.

### Q5: If using the Result type, should Promise.reject not be used?

Correct. When using the Result type, avoid `Promise.reject` and return `Promise<Result<T, E>>`. Using `Promise.reject` requires try-catch at the call site, which loses the benefits of the Result type. However, libraries may use `Promise.reject`, so convert them at the boundary layer using `fromPromise`.

### Q6: Which should I choose, Effect-ts or neverthrow?

neverthrow is a lightweight library specialized for the Result type and can be incrementally adopted in existing projects. Effect-ts is a more comprehensive effect system that also includes dependency injection, scheduling, and concurrency. For a new project adopting functional programming across the board, choose Effect-ts; for improving error handling in an existing project, neverthrow is recommended.

### Q7: Should I use the Result type on the frontend as well?

The Result type is also effective on the frontend, but its usage differs. By representing API call results with the Result type and pattern-matching inside components, you can display error states in a type-safe manner. However, you also need to consider integration with framework-specific mechanisms such as React's Error Boundary or Vue's error handling.

### Q8: What is the relationship between Branded types and validation?

Branded types are a pattern that guarantees at the type level that data has been "validated." By converting to a Branded type after validating with zod, you can express in the type system that "this data has been validated." See [Branded Types Pattern](./03-branded-types.md) for details.

### Q9: How should errors be propagated between microservices?

Between microservices, errors are propagated using a standardized error response (such as RFC 7807 Problem Details) with error codes and messages. Implement an adapter in the receiving service that converts the external service's error response to the service's own error type. For gRPC, use Status Codes; for REST APIs, a combination of HTTP status codes and error codes is standard.

### Q10: What is the best practice when expecting a specific error in a test?

When using the Result type, the best approach is to define custom matchers (`toBeErrWith`) and validate by error code. For exception-based code, use `expect(fn).rejects.toThrow(SpecificError)`. In either case, validate by error type or code rather than string comparison of error messages.

---

## Summary Table

| Concept | Key Points |
|------|------|
| Result type | Type-safely represent success/failure with `Ok<T> \| Err<E>` |
| Custom errors | Design a discriminable error hierarchy with `code` literal types |
| Boundary pattern | Use try-catch only at boundaries with external libraries |
| zod validation | Safely process input with `safeParse` + Result conversion |
| Exhaustiveness check | Prevent missing error cases with switch + `never` type |
| Error transformation | Propagate while converting to appropriate error types in each layer |
| Async integration | Integrate Promise and Result with `AsyncResult<T, E>` |
| Retry | Improve fault tolerance with exponential backoff + circuit breaker |
| Testing strategy | Clearly test error paths with custom matchers |
| Performance | For high error frequency paths, Result type is faster than exceptions |
