# Union Types and Intersection Types

> A powerful mechanism for combining types with "or" and "and". Master safe type narrowing using discriminated unions and type guards.

## What You Will Learn in This Chapter

1. **Union types** -- Type composition with the `|` operator, discriminated unions, type narrowing
2. **Intersection types** -- Type composition with the `&` operator, mixin patterns
3. **Type guards** -- Narrowing via typeof, instanceof, in, and user-defined type guards
4. **Exhaustiveness checking** -- Safe branching using the never type
5. **Practical patterns** -- Design techniques for Union/Intersection types frequently used in real-world code


## Prerequisites

Before reading this guide, the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding the content of [Functions and Object Types](./02-functions-and-objects.md)

---

## 1. Union Types

A union type is a fundamental feature of the type system that expresses that a value is "one of multiple types". In set-theoretic terms, it corresponds to a "union", accepting values of either type A or type B.

### Why Union Types Matter

In real-world programming, situations frequently arise where functions accept arguments of multiple types or where API responses return different structures on success and failure. By using union types, you can accurately express these "multiple possibilities" at the type level, and when combined with type guards, you can safely access properties in each branch.

### Code Example 1: Basic Union Types

```typescript
// Accepts a string or a number
function formatId(id: string | number): string {
  if (typeof id === "string") {
    return id.toUpperCase();
  }
  return id.toString().padStart(6, "0");
}

formatId("abc");  // "ABC"
formatId(42);     // "000042"

// Union type variable
let value: string | number | boolean;
value = "hello";  // OK
value = 42;       // OK
value = true;     // OK
// value = [];    // Error: Type 'never[]' is not assignable to type 'string | number | boolean'
```

### Code Example 1b: Method Access Restrictions on Union Types

For variables of union types, you can only access **members common to all constituent types**. This is an important constraint for maintaining type safety.

```typescript
function describe(value: string | number): string {
  // toString() exists on both string and number, so OK
  return value.toString();

  // value.toUpperCase() is an error
  // -> toUpperCase does not exist on number

  // value.toFixed(2) is also an error
  // -> toFixed does not exist on string
}

// Array of union types
type StringOrNumber = string | number;
const mixed: StringOrNumber[] = [1, "two", 3, "four"];

// Array methods are usable, but element type is string | number
mixed.forEach((item) => {
  console.log(item.toString()); // OK: common method
  // console.log(item.toUpperCase()); // Error
});
```

### Code Example 1c: Union of Literal Types

```typescript
// Union of string literal types (enum-like usage)
type Direction = "north" | "south" | "east" | "west";
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type LogLevel = "debug" | "info" | "warn" | "error";

function move(direction: Direction): void {
  // direction is one of four string literals
  console.log(`Moving ${direction}`);
}

move("north"); // OK
// move("up"); // Error: Argument of type '"up"' is not assignable

// Union of numeric literal types
type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;
type HttpStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 500;

// Combination of template literal types and unions
type EventName = `on${Capitalize<"click" | "hover" | "focus">}`;
// "onClick" | "onHover" | "onFocus"

type CSSUnit = `${number}${"px" | "em" | "rem" | "%"}`;
// Allows "10px", "1.5em", "100%", etc.
```

### Union Types and Type Inference

```typescript
// TypeScript infers union types from context
const arr = [1, "hello", true]; // (string | number | boolean)[]

// Union type inference in conditional expressions
function getValue(flag: boolean) {
  return flag ? "text" : 42;
}
// Return type: string | number

// Use as const to obtain a union of literal types
const ROLES = ["admin", "user", "guest"] as const;
type Role = (typeof ROLES)[number]; // "admin" | "user" | "guest"
```

---

### Code Example 2: Discriminated Unions

Discriminated unions are the most important and practical pattern within union types. They are unions of object types that share a common "discriminant" property, allowing safe type narrowing through switch or if statements.

```typescript
// Union with a common literal type property (discriminant)
interface Circle {
  kind: "circle";
  radius: number;
}

interface Rectangle {
  kind: "rectangle";
  width: number;
  height: number;
}

interface Triangle {
  kind: "triangle";
  base: number;
  height: number;
}

type Shape = Circle | Rectangle | Triangle;

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
    case "triangle":
      return (shape.base * shape.height) / 2;
  }
}
```

### Structure of a Discriminated Union

```
  Shape (Union type)
  +-----------+--------------+--------------+
  |  Circle   |  Rectangle   |  Triangle    |
  +-----------+--------------+--------------+
  | kind:     | kind:        | kind:        |
  | "circle"  | "rectangle"  | "triangle"   |
  | radius    | width        | base         |
  |           | height       | height       |
  +-----------+--------------+--------------+
       ^             ^              ^
       |             |              |
   kind = "circle"  kind = "rect"  kind = "tri"
   -> radius       -> width,      -> base,
     available       height         height
                     available      available
```

### Code Example 2b: Discriminated Unions in Practice

Discriminated unions are leveraged across many areas including API responses, state management, and event handling.

```typescript
// --- Pattern 1: API Response ---
type ApiResponse<T> =
  | { status: "success"; data: T; timestamp: string }
  | { status: "error"; error: { code: string; message: string }; timestamp: string }
  | { status: "loading" };

function handleResponse<T>(response: ApiResponse<T>): void {
  switch (response.status) {
    case "success":
      console.log("Data:", response.data);
      console.log("At:", response.timestamp);
      break;
    case "error":
      console.error(`Error ${response.error.code}: ${response.error.message}`);
      break;
    case "loading":
      console.log("Loading...");
      break;
  }
}

// --- Pattern 2: Redux Action ---
type UserAction =
  | { type: "USER_FETCH_REQUEST" }
  | { type: "USER_FETCH_SUCCESS"; payload: User[] }
  | { type: "USER_FETCH_FAILURE"; error: string }
  | { type: "USER_CREATE"; payload: Omit<User, "id"> }
  | { type: "USER_UPDATE"; payload: { id: string; changes: Partial<User> } }
  | { type: "USER_DELETE"; payload: { id: string } };

function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case "USER_FETCH_REQUEST":
      return { ...state, loading: true, error: null };
    case "USER_FETCH_SUCCESS":
      return { ...state, loading: false, users: action.payload };
    case "USER_FETCH_FAILURE":
      return { ...state, loading: false, error: action.error };
    case "USER_CREATE":
      // action.payload has type Omit<User, "id">
      return state;
    case "USER_UPDATE":
      // action.payload.id and action.payload.changes are accessible
      return state;
    case "USER_DELETE":
      return {
        ...state,
        users: state.users.filter((u) => u.id !== action.payload.id),
      };
  }
}

// --- Pattern 3: Form field validation result ---
type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email.includes("@")) {
    errors.push("Email address must contain @");
  }
  if (email.length > 255) {
    errors.push("Must be 255 characters or fewer");
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true };
}

const result = validateEmail("test");
if (!result.valid) {
  // result.errors is accessible (type-safe)
  result.errors.forEach((err) => console.log(err));
}
```

### Code Example 2c: Patterns with Multiple Discriminants

```typescript
// Example combining two discriminants
type Notification =
  | { channel: "email"; priority: "high"; to: string; subject: string; body: string }
  | { channel: "email"; priority: "low"; to: string; body: string }
  | { channel: "sms"; priority: "high"; phoneNumber: string; message: string }
  | { channel: "push"; priority: "high" | "low"; userId: string; title: string };

function sendNotification(notification: Notification): void {
  switch (notification.channel) {
    case "email":
      if (notification.priority === "high") {
        // subject is accessible
        console.log(`[URGENT] ${notification.subject}: ${notification.body}`);
      } else {
        console.log(notification.body);
      }
      break;
    case "sms":
      console.log(`SMS to ${notification.phoneNumber}: ${notification.message}`);
      break;
    case "push":
      console.log(`Push to ${notification.userId}: ${notification.title}`);
      break;
  }
}
```

### Best Practices for Discriminated Unions

```
Discriminated union design checklist:

  [1] The discriminant must be a literal type
      OK  kind: "circle"        (string literal)
      OK  type: 1               (numeric literal)
      OK  success: true          (boolean literal)
      NG  kind: string           (too broad)

  [2] The discriminant property name should be uniform across the union
      OK  { kind: "a", ... } | { kind: "b", ... }
      NG  { kind: "a", ... } | { type: "b", ... }

  [3] Discriminant values must be unique within the union
      OK  { kind: "circle" } | { kind: "rect" }
      NG  { kind: "shape" }  | { kind: "shape" }

  [4] Always include exhaustiveness checks
```

---

## 2. Intersection Types

An intersection type creates a type that "satisfies all" of multiple types. In set-theoretic terms, it corresponds to an "intersection". While union types mean "A or B", intersection types mean "A and B".

### Code Example 3: Basics of Intersection Types

```typescript
// Type composition (has all properties)
type HasId = { id: number };
type HasName = { name: string };
type HasEmail = { email: string };

type User = HasId & HasName & HasEmail;
// { id: number; name: string; email: string }

const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
};

// Mixin pattern
type Timestamped = {
  createdAt: Date;
  updatedAt: Date;
};

type SoftDeletable = {
  deletedAt: Date | null;
};

type BaseEntity = HasId & Timestamped & SoftDeletable;
// { id: number; createdAt: Date; updatedAt: Date; deletedAt: Date | null }
```

### Code Example 3b: Practical Patterns of Intersection Types

```typescript
// --- Pattern 1: Separation of concerns and composition ---
type WithPagination = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
};

type WithSorting = {
  sortBy: string;
  sortOrder: "asc" | "desc";
};

type WithFiltering = {
  filters: Record<string, string | number | boolean>;
};

// Build the list-fetching type by combining required features
type PaginatedSortedList<T> = {
  items: T[];
} & WithPagination & WithSorting;

type FullFeaturedList<T> = {
  items: T[];
} & WithPagination & WithSorting & WithFiltering;

const userList: PaginatedSortedList<User> = {
  items: [{ id: 1, name: "Alice", email: "a@example.com" }],
  page: 1,
  pageSize: 20,
  totalPages: 5,
  totalItems: 100,
  sortBy: "createdAt",
  sortOrder: "desc",
};

// --- Pattern 2: Permission expansion by role ---
type BasePermissions = {
  canRead: boolean;
  canWrite: boolean;
};

type AdminPermissions = BasePermissions & {
  canDelete: boolean;
  canManageUsers: boolean;
  canAccessLogs: boolean;
};

type SuperAdminPermissions = AdminPermissions & {
  canModifySettings: boolean;
  canDeployApp: boolean;
};

// --- Pattern 3: Composing React component props ---
type WithClassName = {
  className?: string;
};

type WithTestId = {
  "data-testid"?: string;
};

type WithDisabled = {
  disabled?: boolean;
};

type ButtonProps = {
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary" | "danger";
} & WithClassName & WithTestId & WithDisabled;

// --- Pattern 4: Adding metadata to event handlers ---
type EventMetadata = {
  timestamp: number;
  source: string;
  correlationId: string;
};

type UserCreatedEvent = EventMetadata & {
  type: "user.created";
  data: { userId: string; email: string };
};

type OrderPlacedEvent = EventMetadata & {
  type: "order.placed";
  data: { orderId: string; amount: number };
};

type AppEvent = UserCreatedEvent | OrderPlacedEvent;
```

### Union vs Intersection Comparison

| Property | Union (`A \| B`) | Intersection (`A & B`) |
|------|-------------------|------------------------|
| Meaning | A **or** B | A **and** B |
| Properties | Only common properties accessible | All properties accessible |
| Set theory | Union | Intersection |
| Value range | Wider (more permissive acceptance) | Narrower (stricter requirements) |
| Type range | Broad (satisfying either is OK) | Narrow (must satisfy all) |
| Use case | Expressing multiple possibilities | Type composition / extension |
| Assignment compatibility | Each member type is assignable to the union | Intersection type is assignable to each member type |

```
  Union (A | B)               Intersection (A & B)
+-------+-------+           +-------+
|       |  A&B  |           |  A&B  |
|   A   |       |   B      +-------+
|       +-------+           Has all properties of A
+-------+       |           and
        |       |           all properties of B
        +-------+
A or B value
```

### Type Conflicts in Intersection Types

```typescript
// Intersection of primitive types becomes never
type Impossible1 = string & number;      // never
type Impossible2 = "hello" & "world";    // never
type Impossible3 = true & false;         // never

// When properties of the same name conflict in object types
type A = { x: string; shared: number };
type B = { y: boolean; shared: string };
type C = A & B;
// C = { x: string; y: boolean; shared: never }
// shared is string & number = never
// -> It is essentially impossible to create a value of type C

// To avoid this, exclude conflicting properties with Omit
type SafeMerge = A & Omit<B, "shared">;
// { x: string; shared: number; y: boolean }
```

### Intersection Types and Function Type Composition

```typescript
// Intersection of function types = overloads
type NumberToString = (x: number) => string;
type StringToNumber = (x: string) => number;

type Combined = NumberToString & StringToNumber;
// Behaves like overloads
// (x: number) => string
// (x: string) => number

declare const fn: Combined;
fn(42);      // returns string
fn("hello"); // returns number
```

---

## 3. Type Guards and Narrowing

Type guards are mechanisms for "narrowing" a union type variable down to a specific type. TypeScript's control flow analysis tracks the conditions of if/switch statements and automatically narrows the type of variables within each block.

### Conceptual Diagram of Narrowing

```
  function handle(x: string | number | null) {

  Type of x: string | number | null
      |
      v
  if (x === null) return;
      |
      v
  Type of x: string | number    <- null has been excluded
      |
      v
  if (typeof x === "string") {
      |
      v
    Type of x: string             <- number has been excluded
  } else {
      |
      v
    Type of x: number             <- string has been excluded
  }
```

### Code Example 4: Built-in Type Guards

```typescript
function process(value: string | number | boolean | Date) {
  // typeof guard
  if (typeof value === "string") {
    console.log(value.toUpperCase()); // string
    return;
  }

  if (typeof value === "number") {
    console.log(value.toFixed(2));     // number
    return;
  }

  if (typeof value === "boolean") {
    console.log(value ? "yes" : "no"); // boolean
    return;
  }

  // At this point, value is narrowed to Date
  console.log(value.toISOString());    // Date
}

// instanceof guard
function formatError(error: Error | string): string {
  if (error instanceof Error) {
    return error.message;   // Error
  }
  return error;             // string
}

// in guard
interface Dog { bark(): void; breed: string; }
interface Cat { meow(): void; indoor: boolean; }

function speak(pet: Dog | Cat): void {
  if ("bark" in pet) {
    pet.bark();   // Dog
  } else {
    pet.meow();   // Cat
  }
}
```

### Code Example 4b: Complete Reference for typeof Guards

```typescript
// typeof can identify 7 types
function typeofDemo(value: unknown): string {
  switch (typeof value) {
    case "string":
      return `String: ${value.toUpperCase()}`;
    case "number":
      return `Number: ${value.toFixed(2)}`;
    case "boolean":
      return `Boolean: ${value ? "true" : "false"}`;
    case "bigint":
      return `BigInt: ${value.toString()}`;
    case "symbol":
      return `Symbol: ${value.toString()}`;
    case "undefined":
      return "Undefined";
    case "function":
      return `Function: ${value.name}`;
    case "object":
      if (value === null) return "Null";
      if (Array.isArray(value)) return `Array[${value.length}]`;
      return `Object: ${JSON.stringify(value)}`;
    default:
      return "Unknown";
  }
}

// Caveats of typeof
typeof null === "object";        // historical bug in JavaScript
typeof [] === "object";          // arrays are also object
typeof new Date() === "object";  // Date is also object
// -> Use instanceof or Array.isArray to distinguish these
```

### Code Example 4c: Narrowing via Truthiness Checks

```typescript
// TypeScript also narrows types through truthy/falsy checks
function processOptional(value: string | null | undefined): string {
  // Falsy check excludes null and undefined
  if (!value) {
    return "default";
  }
  // value is string (null, undefined, "" are excluded)
  return value.toUpperCase();
}

// Boolean conversion via !!
function hasValue(x: string | null | undefined): x is string {
  return !!x; // null, undefined, "" become false
}

// Nullish coalescing and optional chaining
type Config = {
  database?: {
    host?: string;
    port?: number;
  };
};

function getDbHost(config: Config): string {
  return config.database?.host ?? "localhost";
}
```

### Code Example 5: User-Defined Type Guards

```typescript
// Type predicate: `value is Type`
interface Fish { swim(): void; kind: "fish"; }
interface Bird { fly(): void; kind: "bird"; }

function isFish(pet: Fish | Bird): pet is Fish {
  return "swim" in pet;
}

function move(pet: Fish | Bird): void {
  if (isFish(pet)) {
    pet.swim();  // Usable as Fish
  } else {
    pet.fly();   // Usable as Bird
  }
}

// Assertion function: asserts
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Expected string, got ${typeof value}`);
  }
}

function processInput(input: unknown): void {
  assertIsString(input);
  // At this point, input is of type string
  console.log(input.toUpperCase());
}
```

### Code Example 5b: Practical User-Defined Type Guards

```typescript
// --- Pattern 1: Type guards for API responses ---
interface SuccessResponse<T> {
  success: true;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string };
}

type ApiResult<T> = SuccessResponse<T> | ErrorResponse;

function isSuccess<T>(result: ApiResult<T>): result is SuccessResponse<T> {
  return result.success === true;
}

function isError<T>(result: ApiResult<T>): result is ErrorResponse {
  return result.success === false;
}

async function fetchUser(id: string): Promise<User> {
  const result: ApiResult<User> = await fetch(`/api/users/${id}`).then(
    (r) => r.json()
  );

  if (isError(result)) {
    throw new Error(result.error.message); // type-safe as ErrorResponse
  }

  return result.data; // type-safe as SuccessResponse<User>
}

// --- Pattern 2: Type guards in array filtering ---
type MaybeUser = User | null | undefined;

function isUser(value: MaybeUser): value is User {
  return value != null;
}

const mixedResults: MaybeUser[] = [
  { id: "1", name: "Alice", email: "a@test.com" },
  null,
  { id: "2", name: "Bob", email: "b@test.com" },
  undefined,
];

// filter + type guard removes null/undefined in a type-safe way
const validUsers: User[] = mixedResults.filter(isUser);
// validUsers has type User[] (null | undefined excluded)

// --- Pattern 3: Safe handling of unknown ---
interface JsonObject {
  [key: string]: unknown;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseConfig(raw: unknown): Record<string, string> {
  if (!isJsonObject(raw)) {
    throw new Error("Config must be an object");
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

// --- Pattern 4: Validation using asserts ---
function assertPositive(value: number): asserts value is number {
  if (value <= 0) {
    throw new RangeError(`Expected positive number, got ${value}`);
  }
}

function assertNonEmpty(arr: unknown[]): asserts arr is [unknown, ...unknown[]] {
  if (arr.length === 0) {
    throw new Error("Array must not be empty");
  }
}

function processOrder(quantity: number, items: string[]): void {
  assertPositive(quantity);
  assertNonEmpty(items);
  // quantity > 0 is guaranteed
  // items has at least one element
  console.log(`Processing ${quantity} of ${items[0]}`);
}
```

### List of Type Guards and How to Use Them

| Type Guard | Syntax | Target | Use Case |
|---------|------|---------|------|
| typeof | `typeof x === "string"` | Primitive types | string, number, boolean, symbol, bigint, undefined, function |
| instanceof | `x instanceof Error` | Class instances | Error, Date, RegExp, custom classes |
| in | `"key" in x` | Object properties | Distinguish types by property presence |
| Array.isArray | `Array.isArray(x)` | Arrays | Distinguish array from object |
| Equality check | `x === null` | Literal types | null, undefined, specific strings |
| Type predicate | `x is Type` | Custom predicates | Type narrowing under complex conditions |
| asserts | `asserts x is Type` | Assertion | Throw an exception if condition not met |

```
Type guard selection flowchart:

  What type do you want to narrow to?
      |
      +-- Primitive -> typeof
      |
      +-- Class instance -> instanceof
      |
      +-- Array -> Array.isArray
      |
      +-- null / undefined -> equality check (=== null)
      |
      +-- Object structure -> in operator or user-defined type guard
      |
      +-- Complex condition -> user-defined type guard (is / asserts)
```

---

## 4. Exhaustiveness Checking

### Code Example 6: Exhaustiveness Checking with never

A pattern in switch statements over discriminated unions that lets the compiler guarantee that all cases have been handled. When a new member is added, a compile error occurs, preventing missed handling.

```typescript
type Status = "pending" | "approved" | "rejected";

function handleStatus(status: Status): string {
  switch (status) {
    case "pending":
      return "Under review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      // If all cases are handled, this branch is not reached
      // If a new Status is added, this becomes a compile error
      const _exhaustive: never = status;
      throw new Error(`Unknown status: ${_exhaustive}`);
  }
}

// assertNever helper function
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
```

### Code Example 6b: Applications of Exhaustiveness Checking

```typescript
// --- Pattern 1: Exhaustiveness checking on complex discriminated unions ---
type PaymentMethod =
  | { type: "credit_card"; cardNumber: string; expiry: string }
  | { type: "bank_transfer"; bankCode: string; accountNumber: string }
  | { type: "crypto"; walletAddress: string; network: "ethereum" | "bitcoin" }
  | { type: "paypal"; email: string };

function processPayment(payment: PaymentMethod): string {
  switch (payment.type) {
    case "credit_card":
      return `Credit Card ending in ${payment.cardNumber.slice(-4)}`;
    case "bank_transfer":
      return `Bank Transfer to ${payment.bankCode}`;
    case "crypto":
      return `Crypto payment to ${payment.walletAddress} on ${payment.network}`;
    case "paypal":
      return `PayPal payment to ${payment.email}`;
    default:
      return assertNever(payment);
      // If a new payment type is added,
      // a compile error occurs here
  }
}

// --- Pattern 2: Exhaustiveness checking in if-else chains ---
type Animal = { kind: "dog"; breed: string } | { kind: "cat"; indoor: boolean } | { kind: "bird"; canFly: boolean };

function describeAnimal(animal: Animal): string {
  if (animal.kind === "dog") {
    return `Dog (${animal.breed})`;
  }
  if (animal.kind === "cat") {
    return `Cat (${animal.indoor ? "indoor" : "outdoor"})`;
  }
  if (animal.kind === "bird") {
    return `Bird (${animal.canFly ? "can fly" : "cannot fly"})`;
  }
  // TypeScript recognizes that animal is never
  return assertNever(animal);
}

// --- Pattern 3: Exhaustiveness checking via map objects ---
type Fruit = "apple" | "banana" | "cherry";

// Record<Fruit, T> requires keys for all Fruit values
const fruitEmoji: Record<Fruit, string> = {
  apple: "apple",
  banana: "banana",
  cherry: "cherry",
  // grape: "grape" <- Error since not in Fruit
  // Removing cherry causes an error (all keys required)
};

// More flexible exhaustiveness checking using satisfies (TypeScript 4.9+)
const fruitColors = {
  apple: "red",
  banana: "yellow",
  cherry: "dark red",
} satisfies Record<Fruit, string>;
// fruitColors.apple has the literal type "red" (would widen to string with Record)
```

---

## 5. Advanced Use of Intersection Types

### Code Example 7: Advanced Use of Intersection Types

```typescript
// Composition of conditional properties
type BaseConfig = {
  host: string;
  port: number;
};

type WithAuth = {
  auth: {
    username: string;
    password: string;
  };
};

type WithSSL = {
  ssl: {
    cert: string;
    key: string;
  };
};

type WithRetry = {
  retry: {
    maxAttempts: number;
    backoffMs: number;
  };
};

// Combine to create various configurations
type SecureConfig = BaseConfig & WithAuth & WithSSL;
type BasicConfig = BaseConfig & WithAuth;
type PublicConfig = BaseConfig;
type ResilientConfig = BaseConfig & WithRetry;
type FullConfig = BaseConfig & WithAuth & WithSSL & WithRetry;

const secureConfig: SecureConfig = {
  host: "db.example.com",
  port: 5432,
  auth: { username: "admin", password: "secret" },
  ssl: { cert: "...", key: "..." },
};
```

### Code Example 7b: Combining Generics with Intersection/Union

```typescript
// --- Pattern 1: Generic Result type ---
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { ok: false, error: "Division by zero" };
  }
  return { ok: true, value: a / b };
}

const result = divide(10, 3);
if (result.ok) {
  console.log(result.value.toFixed(2)); // "3.33"
} else {
  console.log(result.error.toUpperCase()); // error message
}

// --- Pattern 2: Branded types and unions ---
type Brand<T, B extends string> = T & { readonly __brand: B };

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;
type ProductId = Brand<string, "ProductId">;

function createUserId(id: string): UserId {
  return id as UserId;
}

function createOrderId(id: string): OrderId {
  return id as OrderId;
}

function getUserById(id: UserId): Promise<User> {
  // Accepts only UserId; passing OrderId is a compile error
  return fetch(`/api/users/${id}`).then((r) => r.json());
}

const userId = createUserId("user-123");
const orderId = createOrderId("order-456");

getUserById(userId);  // OK
// getUserById(orderId); // Error: OrderId is not assignable to UserId

// --- Pattern 3: Distributive conditional types over unions ---
type ToArray<T> = T extends unknown ? T[] : never;

type StringOrNumberArray = ToArray<string | number>;
// string[] | number[] (distributed)

type NonDistributed<T> = [T] extends [unknown] ? T[] : never;
type Mixed = NonDistributed<string | number>;
// (string | number)[] (not distributed)

// --- Pattern 4: Mapped types and unions ---
type EventMap = {
  click: { x: number; y: number };
  keypress: { key: string };
  scroll: { offset: number };
};

type EventHandler<T> = (event: T) => void;

type EventHandlers = {
  [K in keyof EventMap]: EventHandler<EventMap[K]>;
};
// {
//   click: (event: { x: number; y: number }) => void;
//   keypress: (event: { key: string }) => void;
//   scroll: (event: { offset: number }) => void;
// }


// Obtain event names from the union
type EventName = keyof EventMap; // "click" | "keypress" | "scroll"
```

### Code Example 7c: Utility Types for Union Types

```typescript
// Extract specific types from a union
type Extract<T, U> = T extends U ? T : never;
type Exclude<T, U> = T extends U ? never : T;

type AllTypes = string | number | boolean | null | undefined;

type OnlyStrings = Extract<AllTypes, string>;       // string
type NoNullish = Exclude<AllTypes, null | undefined>; // string | number | boolean

// Count the number of members in a union (at the type level)
type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends
  (k: infer I) => void ? I : never;

// Filter a union via conditional types
type FilterByKind<T, K extends string> = T extends { kind: K } ? T : never;

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

type CircleOnly = FilterByKind<Shape, "circle">;
// { kind: "circle"; radius: number }

type RectOrTriangle = FilterByKind<Shape, "rectangle" | "triangle">;
// { kind: "rectangle"; ... } | { kind: "triangle"; ... }
```

---

## 6. Practical Pattern Collection

### Pattern 1: State Machine

```typescript
// Express order state transitions as a discriminated union
type OrderState =
  | { status: "draft"; items: CartItem[] }
  | { status: "submitted"; items: CartItem[]; submittedAt: Date }
  | { status: "paid"; items: CartItem[]; submittedAt: Date; paidAt: Date; paymentId: string }
  | { status: "shipped"; items: CartItem[]; submittedAt: Date; paidAt: Date; paymentId: string; trackingNumber: string; shippedAt: Date }
  | { status: "delivered"; items: CartItem[]; submittedAt: Date; paidAt: Date; paymentId: string; trackingNumber: string; shippedAt: Date; deliveredAt: Date }
  | { status: "cancelled"; items: CartItem[]; cancelledAt: Date; reason: string };

interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

// State transition functions (type-safe)
function submitOrder(order: Extract<OrderState, { status: "draft" }>): Extract<OrderState, { status: "submitted" }> {
  return {
    ...order,
    status: "submitted",
    submittedAt: new Date(),
  };
}

function payOrder(
  order: Extract<OrderState, { status: "submitted" }>,
  paymentId: string,
): Extract<OrderState, { status: "paid" }> {
  return {
    ...order,
    status: "paid",
    paidAt: new Date(),
    paymentId,
  };
}

// Invalid transitions become compile errors
// payOrder(draftOrder, "pay-123"); // Error: draft -> paid is not allowed

// Display based on state
function renderOrderStatus(order: OrderState): string {
  switch (order.status) {
    case "draft":
      return `Draft (${order.items.length} items)`;
    case "submitted":
      return `Submitted (${order.submittedAt.toLocaleDateString()})`;
    case "paid":
      return `Paid (Payment ID: ${order.paymentId})`;
    case "shipped":
      return `Shipped (Tracking: ${order.trackingNumber})`;
    case "delivered":
      return `Delivered (${order.deliveredAt.toLocaleDateString()})`;
    case "cancelled":
      return `Cancelled (Reason: ${order.reason})`;
    default:
      return assertNever(order);
  }
}
```

### Pattern 2: Builder Pattern with Intersection Types

```typescript
// Type-safe builder leveraging intersection types
type QueryBuilder<T extends Record<string, unknown>> = {
  select<K extends keyof T>(
    ...keys: K[]
  ): QueryBuilder<Pick<T, K>>;
  where(
    condition: Partial<T>
  ): QueryBuilder<T>;
  orderBy(
    key: keyof T,
    direction: "asc" | "desc"
  ): QueryBuilder<T>;
  limit(n: number): QueryBuilder<T>;
  execute(): Promise<T[]>;
};

// Usage example
declare const userQuery: QueryBuilder<User>;
// Type-safe chain
const result = await userQuery
  .select("name", "email")    // Pick<User, "name" | "email">
  .where({ role: "admin" })
  .orderBy("name", "asc")     // Only "name" | "email" can be specified
  .limit(10)
  .execute();
// result: Pick<User, "name" | "email">[]
```

### Pattern 3: Type-Safe Event Emitter

```typescript
type EventDefinitions = {
  "user:login": { userId: string; timestamp: Date };
  "user:logout": { userId: string; timestamp: Date };
  "order:created": { orderId: string; total: number };
  "order:shipped": { orderId: string; trackingNumber: string };
  "error": { code: string; message: string; stack?: string };
};

class TypedEventEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof Events & string>(
    event: K,
    handler: (data: Events[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  emit<K extends keyof Events & string>(
    event: K,
    data: Events[K],
  ): void {
    this.listeners.get(event)?.forEach((handler) => handler(data));
  }

  off<K extends keyof Events & string>(
    event: K,
    handler: (data: Events[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(handler);
  }
}

const emitter = new TypedEventEmitter<EventDefinitions>();

// Type-safe event listener
emitter.on("user:login", (data) => {
  // data: { userId: string; timestamp: Date }
  console.log(`User ${data.userId} logged in at ${data.timestamp}`);
});

emitter.on("order:created", (data) => {
  // data: { orderId: string; total: number }
  console.log(`Order ${data.orderId}: $${data.total}`);
});

// Type-safe emit
emitter.emit("user:login", {
  userId: "user-123",
  timestamp: new Date(),
});

// Error: types do not match
// emitter.emit("user:login", { orderId: "xxx" }); // compile error
// emitter.emit("unknown:event", {}); // compile error
```

---

## Anti-Patterns

### Anti-Pattern 1: Using Union Types Without Type Guards

```typescript
// BAD: property access without a type guard
function getLength(value: string | string[]): number {
  // return value.split("").length; // Error: string[] has no split
  return (value as string).length;  // Escaping with as -> bug when it's an array
}

// GOOD: handle safely with a type guard
function getLength(value: string | string[]): number {
  if (typeof value === "string") {
    return value.length;
  }
  return value.length;
}

// Even better: use Array.isArray
function getLength(value: string | string[]): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  return value.length;
}
```

### Anti-Pattern 2: Union Type Objects Without a Discriminant

```typescript
// BAD: no property to discriminate on
type Response = { data: string } | { error: string };

function handle(res: Response) {
  // Cannot access res.data (it could be the error variant)
  // Cannot access res.error either
  if ("data" in res) {  // The in guard works but is fragile
    console.log(res.data);
  }
}

// GOOD: provide a discriminant
type Response =
  | { success: true; data: string }
  | { success: false; error: string };

function handle(res: Response) {
  if (res.success) {
    console.log(res.data);   // safe
  } else {
    console.log(res.error);  // safe
  }
}
```

### Anti-Pattern 3: Union Types That Become Massive

```typescript
// BAD: too many union members to maintain
type Event =
  | { type: "a"; data: A }
  | { type: "b"; data: B }
  | { type: "c"; data: C }
  // ... over 50 members
  | { type: "zz"; data: ZZ };

// GOOD: extract the pattern with generics and split into subgroups
type CrudEvent<Entity extends string, T> =
  | { type: `${Entity}:created`; data: T }
  | { type: `${Entity}:updated`; data: T; changes: Partial<T> }
  | { type: `${Entity}:deleted`; id: string };

type UserEvent = CrudEvent<"user", User>;
type OrderEvent = CrudEvent<"order", Order>;
type ProductEvent = CrudEvent<"product", Product>;

type AppEvent = UserEvent | OrderEvent | ProductEvent;
```

### Anti-Pattern 4: Unsafe Casting via as

```typescript
// BAD: forcibly casting a union type with as
function processShape(shape: Shape) {
  const circle = shape as Circle; // cast even when kind is not "circle"
  console.log(circle.radius); // potential runtime error
}

// GOOD: narrow safely with a type guard
function processShape(shape: Shape) {
  if (shape.kind === "circle") {
    console.log(shape.radius); // safe access as Circle
  }
}
```

### Anti-Pattern 5: Unintended never in Intersection Types

```typescript
// BAD: not noticing a contradictory intersection
type Config = { mode: "development" } & { mode: "production" };
// mode: "development" & "production" = never
// -> No value of type Config can be created

// GOOD: use a union type
type Config = { mode: "development" } | { mode: "production" };

// BAD: misunderstanding intersections of function types
type F = ((x: string) => void) & ((x: number) => void);
// This works as overloads (not an error)
// But beware of unintended overloads
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check the path and format of the config file |
| Timeout | Network latency / lack of resources | Adjust timeout values, add retry logic |
| Out of memory | Increase in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify execution user permissions, review settings |
| Data inconsistency | Concurrency conflicts | Introduce locking, manage transactions |

### Debugging Procedure

1. **Check the error message**: Read the stack trace and identify the location
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Step-by-step verification**: Verify hypotheses with logging or a debugger
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
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"exception: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps to diagnose when performance issues arise:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O waits**: Examine disk and network I/O
4. **Check concurrent connections**: Examine connection pool state

| Issue Type | Diagnostic Tool | Mitigation |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Improve algorithms, parallelize |
| Memory leaks | tracemalloc, objgraph | Properly release references |
| I/O bottlenecks | strace, iostat | Asynchronous I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |
---

## FAQ

### Q1: What should I do if a union type has too many members?

**A:** Use discriminated unions while grouping related members into sub-unions. Leveraging generics to extract common patterns is also effective.
```typescript
type CrudEvent<T> =
  | { type: "created"; entity: T }
  | { type: "updated"; entity: T; changes: Partial<T> }
  | { type: "deleted"; id: string };
```

### Q2: What happens if property types conflict between A and B in `A & B`?

**A:** The conflicting property type becomes `never`.
```typescript
type A = { x: string };
type B = { x: number };
type C = A & B;
// x in C is string & number = never
// -> It is essentially impossible to create a value of type C
```

We recommend excluding the conflicting property with Omit or revisiting the type design.
```typescript
type SafeMerge = Omit<A, keyof B> & B;
// B's properties take precedence
```

### Q3: Is the `is` syntax always required for type guards?

**A:** With built-in guards such as `typeof`, `instanceof`, and `in`, TypeScript narrows types automatically. The `is` syntax (type predicate) is required only when narrowing types via a user-defined function. It is especially useful when creating custom validation functions.

### Q4: How should I choose between union types and enums?

**A:** In TypeScript, string literal union types are generally recommended. Enums are difficult to tree-shake and remain as objects after being compiled to JavaScript. Union types, on the other hand, disappear after compilation, so they do not affect bundle size.

```typescript
// Enum case
enum Status {
  Active = "active",
  Inactive = "inactive",
}

// Union type case (recommended)
type Status = "active" | "inactive";

// const enum disappears, but issues can occur with barrel re-exports
const enum Color {
  Red = "red",
  Blue = "blue",
}
```

### Q5: What types can be used as discriminants in discriminated unions?

**A:** String literals, numeric literals, and boolean literals (true/false) can be used. The most common is the string literal.

```typescript
// String literal (most common)
type A = { kind: "a"; ... } | { kind: "b"; ... };

// Numeric literal
type B = { code: 200; data: T } | { code: 404; message: string };

// Boolean literal
type C = { success: true; data: T } | { success: false; error: E };
```

### Q6: Does the order of members in a union type matter?

**A:** At the type level, order does not matter. `string | number` and `number | string` are the same type. However, for code readability we recommend logically grouping members.

### Q7: When should I use intersection types?

**A:** Mainly in the following situations:
1. **Type composition**: Combining small types into larger ones
2. **Mixins**: Adding features to existing types
3. **Generic constraints**: Imposing multiple constraints with `T extends A & B`
4. **Function overloads**: Intersections of function types act as overloads

---

## Summary

| Item | Content |
|------|------|
| Union type (`\|`) | Means "one of the types". Use it after narrowing with type guards |
| Intersection type (`&`) | Means "combination of all types". Used for type composition |
| Discriminated union | A safe pattern that distinguishes types via a common literal-typed property |
| typeof | Detects primitive types: string, number, boolean, etc. |
| instanceof | Detects class instances |
| in | Checks for property existence |
| User-defined type guard | Define a custom type-checking function with `value is Type` |
| asserts | Assertion functions that throw an exception when the condition is not met |
| Exhaustiveness check | Detects missed branches across all cases via never + default |
| Distributive conditional types | Conditional types applied to union types distribute over each member |

---

## Exercises

### Problem 1: Designing a Discriminated Union

Define a discriminated union `Shape` that meets the following requirements, and implement a `calculateArea` function that calculates the area.

- Circle (radius)
- Rectangle (width, height)
- Triangle (base, height)
- Ellipse (major axis, minor axis)

Include exhaustiveness checking.

```typescript
// Write your implementation here
type Shape = /* ... */;

function calculateArea(shape: Shape): number {
  // ...
}
```

### Problem 2: Implementing a Type Guard Function

Implement a type guard function that determines whether `unknown` data satisfies a specific interface.

```typescript
interface UserProfile {
  id: string;
  name: string;
  email: string;
  age: number;
}

function isUserProfile(value: unknown): value is UserProfile {
  // Write your implementation here
}
```

### Problem 3: Implementing a Result Type

Define a `Result<T, E>` type and implement utility functions according to the following spec.

- `Result<T, E>` is a union of `Ok<T>` or `Err<E>`
- `map` function: Transforms the success value
- `flatMap` function: Generates a new Result from a success value
- `unwrapOr` function: Returns the success value or a default value

```typescript
// Write your implementation here
type Result<T, E> = /* ... */;

function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  // ...
}

function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  // ...
}

function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  // ...
}
```

### Problem 4: Type-Safe Event System

Implement a type-safe event bus corresponding to the following event definitions. When `emit` is called with data that does not match the event name, a compile error must occur.

```typescript
type Events = {
  "user:created": { id: string; name: string };
  "user:deleted": { id: string };
  "order:placed": { orderId: string; items: string[] };
};

// Implement the EventBus class
class EventBus<E extends Record<string, unknown>> {
  // Implement on, emit, off methods
}
```

### Problem 5: Type-Safe State Machine Transitions

Based on the state transition diagram below, implement a set of functions that turn invalid transitions into compile errors.

```
  draft -> submitted -> approved -> published
                    \-> rejected
  (Any state can transition to cancelled)
```

```typescript
// Implement the type for each state and the transition functions
type ArticleState = /* ... */;

function submit(article: /* draft */): /* submitted */ { ... }
function approve(article: /* submitted */): /* approved */ { ... }
function reject(article: /* submitted */): /* rejected */ { ... }
function publish(article: /* approved */): /* published */ { ... }
function cancel(article: ArticleState): /* cancelled */ { ... }
```

### Problem 6: Plugin System Using Intersection Types

For a `BaseApp` with basic functionality, design a plugin system that extends features via intersection types. Each plugin adds its own methods and properties.

```typescript
type BaseApp = {
  name: string;
  version: string;
  start(): void;
};

type WithAuth = { /* authentication feature */ };
type WithLogging = { /* logging feature */ };
type WithCache = { /* caching feature */ };

// Define a type that composes the app from any combination of plugins
type MyApp = BaseApp & WithAuth & WithLogging;

function createApp<T extends BaseApp>(config: T): T {
  // ...
}
```

---

## Recommended Next Reads

- [04-generics.md](./04-generics.md) -- Generics
- [../02-patterns/02-discriminated-unions.md](../02-patterns/02-discriminated-unions.md) -- Discriminated union patterns (practical edition)
- [../01-advanced-types/00-conditional-types.md](../01-advanced-types/00-conditional-types.md) -- Conditional types

---

## References

1. **TypeScript Handbook: Narrowing** -- https://www.typescriptlang.org/docs/handbook/2/narrowing.html
2. **TypeScript Handbook: Unions and Intersection Types** -- https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types
3. **Discriminated Unions in TypeScript** -- https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions
4. **Effective TypeScript** -- by Dan Vanderkam, O'Reilly. Item 22: Understand Type Narrowing
5. **Programming TypeScript** -- by Boris Cherny, O'Reilly. Chapter 6: Advanced Types
