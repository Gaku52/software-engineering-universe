# Type Basics

> Systematically learn the primitive types, literal types, arrays, tuples, enums, and special types (any/unknown/never) that form the foundation of TypeScript.

## What You Will Learn in This Chapter

1. **Primitive and literal types** -- string, number, boolean, symbol, bigint, and restricting values via literal types
2. **Collection types** -- array types, tuple types, and expressing immutability with the readonly modifier
3. **Special types** -- correctly distinguishing between any, unknown, never, void, null, and undefined
4. **Type inference** -- how TypeScript automatically infers types
5. **Type widening and narrowing** -- widening, narrowing, and const assertions
6. **Practical patterns** -- how to leverage each type in real-world code


## Prerequisites

Reading the following beforehand will deepen your understanding of this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [TypeScript Overview](./00-typescript-overview.md)

---

## 1. Primitive Types

### Code Example 1: Basic Primitive Types

```typescript
// String
const name: string = "TypeScript";

// Number (no distinction between integers and floating-point numbers)
const age: number = 12;
const pi: number = 3.14159;

// Boolean
const isReady: boolean = true;

// Symbol
const uniqueKey: symbol = Symbol("key");

// BigInt (large integers)
const huge: bigint = 9007199254740991n;

// null and undefined
const nothing: null = null;
const notDefined: undefined = undefined;
```

### List of Primitive Types

```
+------------------+-------------------+------------------------+
| Type             | Example value     | Use case               |
+------------------+-------------------+------------------------+
| string           | "hello"           | Text data              |
| number           | 42, 3.14          | Numeric values         |
| boolean          | true, false       | Logical values         |
| symbol           | Symbol("id")      | Unique keys            |
| bigint           | 100n              | Huge integers          |
| null             | null              | Absence (intentional)  |
| undefined        | undefined         | Value not defined      |
+------------------+-------------------+------------------------+
```

### Details of the string Type

```typescript
// Basic string operations and types
const greeting: string = "Hello, TypeScript!";
const templateStr: string = `Count: ${42}`; // Template literal
const multiLine: string = `
  Multi-line
  strings are also
  string type
`;

// Difference between string and String (important)
const primitive: string = "hello";       // Primitive type (recommended)
// const wrapped: String = new String("hello"); // Wrapper object type (not recommended)

// Why you should use the primitive type
// 1. The String object returns "object" with typeof
// 2. The String object yields unexpected results with == comparison
// 3. Almost all of TypeScript's APIs expect primitive string

// Type inference for string operations
const upper = "hello".toUpperCase(); // Inferred as string
const includes = "hello".includes("ell"); // Inferred as boolean
const split = "a,b,c".split(","); // Inferred as string[]
const charAt = "hello".charAt(0); // Inferred as string (not "h")

// Template literal types (string operations at the type level)
type Greeting = `Hello, ${string}!`;
const greet1: Greeting = "Hello, World!"; // OK
const greet2: Greeting = "Hello, TypeScript!"; // OK
// const greet3: Greeting = "Hi, World!"; // Error: "Hi, World!" is not assignable to "Hello, ${string}!"
```

### Details of the number Type

```typescript
// Basics of numbers
const integer: number = 42;
const float: number = 3.14;
const negative: number = -100;
const hex: number = 0xff;         // Hexadecimal = 255
const octal: number = 0o77;      // Octal = 63
const binary: number = 0b1010;   // Binary = 10
const scientific: number = 1e10; // Exponential notation = 10000000000

// Special numeric values
const inf: number = Infinity;
const negInf: number = -Infinity;
const notANumber: number = NaN;
// Note that NaN is included in the number type

// Checking for NaN
function isValidNumber(value: number): boolean {
  return !Number.isNaN(value) && Number.isFinite(value);
}

// number and bigint are not compatible
const num: number = 42;
const big: bigint = 42n;
// const mixed: number = big; // Error: cannot assign bigint to number
// const result = num + big;  // Error: cannot perform arithmetic between number and bigint

// Safe integer range
const maxSafe: number = Number.MAX_SAFE_INTEGER;  // 9007199254740991
const minSafe: number = Number.MIN_SAFE_INTEGER;  // -9007199254740991
// Use bigint when exceeding this range

// Type guard for numbers
function processNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  throw new Error(`Invalid number: ${value}`);
}
```

### Details of the boolean Type

```typescript
// Basics of booleans
const isActive: boolean = true;
const isDisabled: boolean = false;

// Type inference and boolean
const result = 10 > 5; // Inferred as boolean
const comparison = "a" === "b"; // Inferred as boolean

// Literal types of boolean
type True = true;
type False = false;

// Use in conditional branching
interface Feature {
  enabled: boolean;
  name: string;
}

function isFeatureEnabled(feature: Feature): feature is Feature & { enabled: true } {
  return feature.enabled;
}

// truthy/falsy and TypeScript's type system
// JavaScript falsy values: false, 0, "", null, undefined, NaN
// TypeScript's boolean type only includes true and false
// Other falsy values are not of type boolean

// Safe boolean conversion when strictNullChecks is enabled
function toBooleanSafe(value: unknown): boolean {
  return Boolean(value); // Explicit conversion
  // return !!value; // Double-bang (also common)
}
```

### Details of the symbol Type

```typescript
// Basics of symbol
const sym1: symbol = Symbol("description");
const sym2: symbol = Symbol("description");
console.log(sym1 === sym2); // false (always unique)

// unique symbol: a stricter symbol type
const UNIQUE_KEY: unique symbol = Symbol("uniqueKey");
// unique symbol can only be used with const declarations

// Practical uses of symbols

// 1. Private properties of an object (alternative to WeakMap)
const _privateData = Symbol("privateData");

class MyClass {
  [_privateData]: string;

  constructor(data: string) {
    this[_privateData] = data;
  }

  getData(): string {
    return this[_privateData];
  }
}

// 2. Well-known Symbols (built-in symbols)
class CustomCollection {
  private items: number[] = [];

  // Make iterable by implementing Symbol.iterator
  [Symbol.iterator](): Iterator<number> {
    let index = 0;
    const items = this.items;
    return {
      next(): IteratorResult<number> {
        if (index < items.length) {
          return { value: items[index++], done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }

  add(item: number): void {
    this.items.push(item);
  }
}

// 3. Symbol.dispose (TypeScript 5.2+)
class Resource {
  [Symbol.dispose](): void {
    console.log("Resource disposed");
  }
}

// With a using declaration, dispose is called automatically when the scope ends
// function useResource() {
//   using resource = new Resource();
//   // ... use resource
// } // <- [Symbol.dispose]() is called automatically here
```

### Details of the bigint Type

```typescript
// Basics of bigint
const big1: bigint = 100n;
const big2: bigint = BigInt(100);
const big3: bigint = BigInt("9007199254740991");

// bigint arithmetic
const sum: bigint = 100n + 200n;       // 300n
const product: bigint = 10n * 20n;     // 200n
const division: bigint = 10n / 3n;     // 3n (truncated)
const remainder: bigint = 10n % 3n;    // 1n
const power: bigint = 2n ** 64n;       // 18446744073709551616n

// bigint and number cannot be mixed in arithmetic
// const mixed = 1n + 1; // Error

// bigint can be compared with number
console.log(1n === 1);  // false (different types)
console.log(1n == 1);   // true (same value)
console.log(1n < 2);    // true

// Practical uses of bigint
// 1. Large database IDs (e.g., snowflake IDs)
type SnowflakeId = bigint;
const discordId: SnowflakeId = 1234567890123456789n;

// 2. Cryptographic computations
// 3. High-precision financial calculations (handled as integers)
// 4. Nanosecond-precision timestamps

// Constraints of bigint
// - Cannot be directly serialized with JSON.stringify()
// - Math object functions cannot be used with it
// - There is no implicit conversion to number

// Workaround for JSON serialization
function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

const data = { id: 123456789012345n };
JSON.stringify(data, bigintReplacer); // '{"id":"123456789012345"}'
```

---

## 2. Literal Types

### Code Example 2: Restricting Values with Literal Types

```typescript
// String literal types
type Direction = "north" | "south" | "east" | "west";
let dir: Direction = "north"; // OK
// dir = "up"; // Compile error

// Numeric literal types
type DiceRoll = 1 | 2 | 3 | 4 | 5 | 6;
let roll: DiceRoll = 3; // OK
// roll = 7; // Compile error

// Boolean literal types
type Success = true;
const result: Success = true;
```

### Practical Patterns for Literal Types

```typescript
// Pattern 1: Restricting HTTP methods
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

interface RequestConfig {
  method: HttpMethod;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function makeRequest(config: RequestConfig): Promise<Response> {
  return fetch(config.url, {
    method: config.method,
    body: config.body ? JSON.stringify(config.body) : undefined,
    headers: config.headers,
  });
}

// makeRequest({ method: "GETTT", url: "/" }); // Error: "GETTT" is not assignable to HttpMethod
makeRequest({ method: "GET", url: "/api/users" }); // OK

// Pattern 2: State transitions of statuses
type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

interface Order {
  id: string;
  status: OrderStatus;
  amount: number;
}

// Express transition constraints in the type system
function transitionOrder(
  order: Order,
  newStatus: OrderStatus
): Order {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  if (!validTransitions[order.status].includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${order.status} → ${newStatus}`
    );
  }

  return { ...order, status: newStatus };
}

// Pattern 3: Leveraging numeric literal types
type Bit = 0 | 1;
type Nibble = [Bit, Bit, Bit, Bit]; // 4 bits

type LogLevel = 0 | 1 | 2 | 3 | 4;
const LOG_LEVELS = {
  TRACE: 0 as const,
  DEBUG: 1 as const,
  INFO: 2 as const,
  WARN: 3 as const,
  ERROR: 4 as const,
};

// Pattern 4: Combining with template literal types
type CSSUnit = "px" | "em" | "rem" | "%" | "vh" | "vw";
type CSSValue = `${number}${CSSUnit}`;

function setWidth(element: HTMLElement, width: CSSValue): void {
  element.style.width = width;
}

// setWidth(element, "100px");  // OK
// setWidth(element, "2.5rem"); // OK
// setWidth(element, "100");    // Error: missing unit

// Pattern 5: Using literal types as an alternative to overloading
type EventType = "click" | "hover" | "focus";

interface EventPayload {
  click: { x: number; y: number; button: number };
  hover: { x: number; y: number };
  focus: { target: string };
}

function handleEvent<T extends EventType>(
  type: T,
  payload: EventPayload[T]
): void {
  console.log(`Event: ${type}`, payload);
}

handleEvent("click", { x: 100, y: 200, button: 0 }); // OK
handleEvent("hover", { x: 100, y: 200 }); // OK
// handleEvent("click", { x: 100, y: 200 }); // Error: button is missing
```

### Code Example 3: const Assertion

```typescript
// Narrow to literal types with as const
const config = {
  host: "localhost",
  port: 3000,
} as const;
// Type: { readonly host: "localhost"; readonly port: 3000 }

// Without as const
const config2 = {
  host: "localhost",
  port: 3000,
};
// Type: { host: string; port: number } -- becomes a wider type
```

### Detailed Patterns of const Assertions

```typescript
// as const on arrays
const colors = ["red", "green", "blue"] as const;
// Type: readonly ["red", "green", "blue"]
// colors[0] is of type "red" (not string)

// Generating a union type from as const
type Color = (typeof colors)[number]; // "red" | "green" | "blue"

// as const on nested objects
const theme = {
  colors: {
    primary: "#007bff",
    secondary: "#6c757d",
    danger: "#dc3545",
  },
  spacing: {
    small: 4,
    medium: 8,
    large: 16,
  },
  breakpoints: {
    mobile: 320,
    tablet: 768,
    desktop: 1024,
  },
} as const;

// Deeply nested values are also recognized as literal types
type PrimaryColor = typeof theme.colors.primary; // "#007bff"
type AllColors = (typeof theme.colors)[keyof typeof theme.colors];
// "#007bff" | "#6c757d" | "#dc3545"

// Leveraging as const in function arguments
function createConfig<const T extends Record<string, unknown>>(config: T): T {
  return config;
}

const appConfig = createConfig({
  apiUrl: "https://api.example.com",
  timeout: 5000,
  retry: 3,
});
// appConfig.apiUrl is of type "https://api.example.com"

// Combining satisfies and as const
interface ThemeConfig {
  colors: Record<string, string>;
  spacing: Record<string, number>;
}

const validatedTheme = {
  colors: {
    primary: "#007bff",
    secondary: "#6c757d",
  },
  spacing: {
    small: 4,
    large: 16,
  },
} as const satisfies ThemeConfig;
// Type-checked while preserving literal types
// validatedTheme.colors.primary is of type "#007bff"
```

---

## 3. Arrays and Tuples

### Code Example 4: Array Types

```typescript
// Two notations for arrays
const numbers: number[] = [1, 2, 3];
const strings: Array<string> = ["a", "b", "c"];

// Read-only arrays
const frozen: readonly number[] = [1, 2, 3];
// frozen.push(4); // Compile error: push does not exist on readonly array

const frozenAlt: ReadonlyArray<number> = [1, 2, 3];
```

### Detailed Patterns for Array Types

```typescript
// Multidimensional arrays
const matrix: number[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

// 3-dimensional array
const cube: number[][][] = [
  [[1, 2], [3, 4]],
  [[5, 6], [7, 8]],
];

// Array of union types
const mixed: (string | number)[] = [1, "hello", 2, "world"];

// Array of objects
interface User {
  id: number;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
];

// Type inference for array methods
const doubled = numbers.map(n => n * 2); // number[]
const filtered = numbers.filter(n => n > 1); // number[]
const found = numbers.find(n => n === 2); // number | undefined
const sum = numbers.reduce((acc, n) => acc + n, 0); // number
const names = users.map(u => u.name); // string[]

// Narrowing types with filter
const mixedArray: (string | number | null)[] = [1, "hello", null, 2, "world", null];

// filter using a type predicate
const nonNull = mixedArray.filter(
  (item): item is string | number => item !== null
); // (string | number)[]

const onlyStrings = mixedArray.filter(
  (item): item is string => typeof item === "string"
); // string[]

// Array.isArray as a type guard
function processInput(input: string | string[]): string[] {
  if (Array.isArray(input)) {
    return input; // string[]
  }
  return [input]; // string[]
}

// Practical patterns for readonly arrays
function processItems(items: readonly string[]): string {
  // items.push("new"); // Error: cannot modify a readonly array
  // items.sort();       // Error: sort modifies the array

  // Methods that produce new arrays are fine
  const sorted = [...items].sort(); // OK: copy with spread
  return sorted.join(", ");
}

// Difference between ReadonlyArray and readonly
const arr1: ReadonlyArray<number> = [1, 2, 3]; // Generic notation
const arr2: readonly number[] = [1, 2, 3];     // Shorthand notation
// The two are completely equivalent
```

### Code Example 5: Tuple Types

```typescript
// Tuple: an array with a fixed number of elements and a fixed type at each position
type Point2D = [number, number];
type Point3D = [number, number, number];

const origin: Point2D = [0, 0];
const point: Point3D = [1, 2, 3];

// Labeled tuples (improved readability)
type UserEntry = [id: number, name: string, active: boolean];
const user: UserEntry = [1, "Alice", true];

// Variadic tuples (rest elements)
type StringNumberBooleans = [string, number, ...boolean[]];
const data: StringNumberBooleans = ["hello", 42, true, false, true];
```

### Detailed Patterns for Tuple Types

```typescript
// Destructuring tuples
type NameAge = [name: string, age: number];
const [userName, userAge]: NameAge = ["Alice", 30];
// userName is of type string, userAge is of type number

// Tuples as function return values
function useState<T>(initial: T): [T, (newValue: T) => void] {
  let value = initial;
  const setValue = (newValue: T) => {
    value = newValue;
  };
  return [value, setValue];
}

const [count, setCount] = useState(0);
// count is of type number
// setCount is of type (newValue: number) => void

// Functions that return multiple values
function divmod(a: number, b: number): [quotient: number, remainder: number] {
  return [Math.floor(a / b), a % b];
}
const [quotient, remainder] = divmod(17, 5); // [3, 2]

// Tuples with optional elements
type PartialPoint = [number, number, number?];
const point2d: PartialPoint = [1, 2];     // OK
const point3d: PartialPoint = [1, 2, 3];  // OK

// Rest element at the start
type TailString = [...number[], string]; // Last is string, the rest is number[]
const data1: TailString = ["end"];            // OK
const data2: TailString = [1, 2, 3, "end"];  // OK

// Rest element in the middle
type Sandwich = [string, ...number[], string]; // Both ends are string
const s1: Sandwich = ["start", "end"];               // OK
const s2: Sandwich = ["start", 1, 2, 3, "end"];     // OK

// readonly tuples
type ReadonlyPoint = readonly [number, number];
const p: ReadonlyPoint = [1, 2];
// p[0] = 3; // Error: cannot modify a readonly tuple

// Tuple type inference and as const
const pair = [1, "hello"] as const; // readonly [1, "hello"]
// Without as const, it is inferred as (string | number)[] (an array, not a tuple)

// Variadic Tuple Types (TypeScript 4.0+)
type Concat<A extends readonly unknown[], B extends readonly unknown[]> = [...A, ...B];
type Result = Concat<[1, 2], [3, 4]>; // [1, 2, 3, 4]

// Event emitter using tuples
type EventMap = {
  click: [x: number, y: number];
  keypress: [key: string, modifiers: string[]];
  resize: [width: number, height: number];
};

class TypedEventEmitter<T extends Record<string, unknown[]>> {
  private listeners = new Map<keyof T, Set<(...args: any[]) => void>>();

  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    this.listeners.get(event)?.forEach(listener => listener(...args));
  }
}

const emitter = new TypedEventEmitter<EventMap>();
emitter.on("click", (x, y) => {
  // x is inferred as number, y as number
  console.log(`Clicked at (${x}, ${y})`);
});
emitter.emit("click", 100, 200); // OK
// emitter.emit("click", "100", 200); // Error: string is not assignable to number
```

### Array vs Tuple Comparison

| Property | Array | Tuple |
|------|-------------|----------------|
| Number of elements | Variable | Fixed (variable also possible with rest elements) |
| Element types | Same type for all elements | Different types possible at each position |
| Use case | Collection of homogeneous data | Combination of heterogeneous data |
| Access | Same type by index | Type depends on position by index |
| Example | `number[]` | `[string, number]` |
| Destructuring | Same type | Each variable has its corresponding type |

```
  Array (number[])           Tuple ([string, number, boolean])
+---+---+---+---+...      +--------+--------+---------+
| n | n | n | n |          | string | number | boolean |
+---+---+---+---+...      +--------+--------+---------+
 All the same type           Different type per position
 Variable length             Fixed length
```

---

## 4. enum (Enumerated Types)

### Code Example 6: Kinds of enum

```typescript
// Numeric enum (default: auto-increments from 0)
enum Status {
  Pending,   // 0
  Active,    // 1
  Inactive,  // 2
}

// String enum (recommended: values are explicit)
enum Color {
  Red = "RED",
  Green = "GREEN",
  Blue = "BLUE",
}

// const enum (inlined at compile time, performance gain)
const enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

// Usage
const status: Status = Status.Active;
const method: HttpMethod = HttpMethod.GET;
```

### Detailed enum Patterns

```typescript
// Specifying the starting value of a numeric enum
enum Priority {
  Low = 1,
  Medium = 5,
  High = 10,
  Critical = 100,
}

// Computed members
enum FileAccess {
  None = 0,
  Read = 1 << 0,      // 1
  Write = 1 << 1,     // 2
  Execute = 1 << 2,   // 4
  ReadWrite = Read | Write,      // 3
  ReadExecute = Read | Execute,  // 5
  All = Read | Write | Execute,  // 7
}

// Using as bit flags
function hasPermission(userPermissions: FileAccess, required: FileAccess): boolean {
  return (userPermissions & required) === required;
}

const myPerms = FileAccess.ReadWrite;
console.log(hasPermission(myPerms, FileAccess.Read));    // true
console.log(hasPermission(myPerms, FileAccess.Execute)); // false

// Reverse lookup of numeric enums
enum Direction {
  Up = 0,
  Down = 1,
  Left = 2,
  Right = 3,
}
console.log(Direction[0]); // "Up" (reverse lookup)
console.log(Direction.Up); // 0 (forward lookup)
// Note: reverse lookup does not exist for string enums

// Heterogeneous enums (mixing numbers and strings, not recommended)
enum Mixed {
  No = 0,
  Yes = "YES",
}

// Iterating an enum
enum Fruit {
  Apple = "APPLE",
  Banana = "BANANA",
  Cherry = "CHERRY",
}

// Get string enum values with Object.values
const fruitValues = Object.values(Fruit); // ["APPLE", "BANANA", "CHERRY"]

// For numeric enums, the reverse-lookup keys are also included, so be careful
const dirValues = Object.keys(Direction);
// ["0", "1", "2", "3", "Up", "Down", "Left", "Right"]
// -> Avoid iterating numeric enums or filter them appropriately

// Caveats for const enum
const enum Speeds {
  Slow = 10,
  Medium = 50,
  Fast = 100,
}
const speed = Speeds.Fast;
// After compilation: const speed = 100; // inlined
// Advantage: smaller bundle size
// Caveat: const enum may not be usable when using --isolatedModules
```

### enum vs Union Type Comparison

| Property | enum | Union type |
|------|------|---------|
| Runtime code | Generated (except const enum) | None (type information only) |
| Bundle size | Increases | No impact |
| Reverse lookup | Possible for numeric enums | Not possible |
| Tree-shaking | Sometimes difficult | No problem |
| Type extensibility | Not possible | Flexibly extensible with unions |
| Recommendation | const enum or trending toward not recommended | Recommended in many situations |

```typescript
// Modern TypeScript often recommends Union types
// Alternative to enum
type Color = "RED" | "GREEN" | "BLUE";

// Constant object + as const pattern
const Color = {
  Red: "RED",
  Green: "GREEN",
  Blue: "BLUE",
} as const;
type Color = (typeof Color)[keyof typeof Color];
// "RED" | "GREEN" | "BLUE"
```

### Practical Use of the as const Pattern

```typescript
// Complete example of the constant object pattern
const HTTP_STATUS = {
  OK: 200,
  Created: 201,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  InternalServerError: 500,
} as const;

// Union type of values
type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
// 200 | 201 | 400 | 401 | 403 | 404 | 500

// Union type of keys
type HttpStatusName = keyof typeof HTTP_STATUS;
// "OK" | "Created" | "BadRequest" | "Unauthorized" | "Forbidden" | "NotFound" | "InternalServerError"

// Type-safe implementation of a reverse-lookup map
type ReverseMap<T extends Record<string, string | number>> = {
  [V in T[keyof T]]: {
    [K in keyof T]: T[K] extends V ? K : never;
  }[keyof T];
};

// Defining labels
const LABELS = {
  OK: "Success",
  Created: "Created",
  BadRequest: "Bad Request",
  Unauthorized: "Authentication Required",
  Forbidden: "Access Denied",
  NotFound: "Not Found",
  InternalServerError: "Server Error",
} as const satisfies Record<HttpStatusName, string>;

function getStatusLabel(code: HttpStatusCode): string {
  const entry = Object.entries(HTTP_STATUS).find(([_, v]) => v === code);
  if (!entry) return "Unknown status";
  return LABELS[entry[0] as HttpStatusName];
}
```

---

## 5. Special Types: any, unknown, never

### Type Hierarchy Diagram

```
           any (supertype of all types)
          / | \
   string number boolean ... object
          \ | /
         unknown (safe any)
            |
          never (subtype of all types, has no value)
```

The accurate type hierarchy is as follows.

```
         any (special: assignable to all types & assignable from all types)
          |
        unknown (top type: assignable from all types)
       / | | \
string number boolean object ... void null undefined
       \ | | /
        never (bottom type: assignable to all types, has no value)
```

### Code Example 7: any vs unknown

```typescript
// any: completely disables type checking (dangerous)
let dangerous: any = "hello";
dangerous.foo.bar.baz(); // No compile error -> runtime error

// unknown: a type-safe "can hold anything" type
let safe: unknown = "hello";
// safe.foo; // Compile error! You must check the type first

// Correct way to use unknown: narrow with a type guard
if (typeof safe === "string") {
  console.log(safe.toUpperCase()); // OK: can be safely used as string
}
```

### Practical Cases for any (Limited)

```typescript
// Cases where any is acceptable (extremely limited)

// 1. Temporary use of a third-party library without type definitions
// @ts-expect-error: library with incomplete type definitions
declare const legacyLib: any;

// 2. The return value of JSON.parse (although unknown is preferable)
// JSON.parse returns any, but should be validated immediately
const parsed: unknown = JSON.parse(jsonString) as unknown;

// 3. Intentional type violations in test code
// When verifying edge cases in tests
// expect(() => processUser(null as any)).toThrow();

// 4. Temporarily avoiding type complexity (with a TODO)
// TODO: define proper types in #1234
function temporaryHandler(event: any): void {
  // ...
}

// tsconfig settings to gradually eliminate any
// {
//   "compilerOptions": {
//     "noImplicitAny": true,       // Forbid implicit any
//     "noExplicitAny": false       // Allow explicit any (to be forbidden in future)
//   }
// }

// Restrict any with ESLint rules
// {
//   "rules": {
//     "@typescript-eslint/no-explicit-any": "warn",
//     "@typescript-eslint/no-unsafe-assignment": "error",
//     "@typescript-eslint/no-unsafe-member-access": "error",
//     "@typescript-eslint/no-unsafe-call": "error",
//     "@typescript-eslint/no-unsafe-return": "error"
//   }
// }
```

### Practical Patterns for unknown

```typescript
// Where to use unknown

// 1. Receiving external data
async function fetchData(url: string): Promise<unknown> {
  const response = await fetch(url);
  return response.json(); // Return as unknown
}

// 2. A type-safe parser
function parseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

// 3. Type-safe conversion from unknown
// Method A: narrowing with typeof
function processUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Method B: user-defined type guards
interface User {
  id: number;
  name: string;
  email: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "email" in value &&
    typeof (value as User).id === "number" &&
    typeof (value as User).name === "string" &&
    typeof (value as User).email === "string"
  );
}

const data: unknown = await fetchData("/api/user/1");
if (isUser(data)) {
  console.log(data.name); // Safe access
}

// Method C: validation with Zod (recommended)
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

function parseUser(data: unknown): User {
  return UserSchema.parse(data); // Invalid data throws ZodError
}

// 4. unknown in catch blocks
try {
  await riskyOperation();
} catch (error: unknown) {
  // In TypeScript 4.4+, the catch variable is of type unknown (when strict mode is on)
  if (error instanceof Error) {
    console.error(error.message);
  } else if (typeof error === "string") {
    console.error(error);
  } else {
    console.error("Unknown error:", error);
  }
}
```

### Code Example 8: never Type

```typescript
// never: never returns a value (unreachable)
function throwError(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {
    // Never ends
  }
}

// Use for exhaustiveness checking
type Shape = "circle" | "square" | "triangle";

function getArea(shape: Shape): number {
  switch (shape) {
    case "circle":
      return Math.PI * 10 * 10;
    case "square":
      return 10 * 10;
    case "triangle":
      return (10 * 10) / 2;
    default:
      // shape becomes never type = all cases handled
      const _exhaustive: never = shape;
      return _exhaustive;
  }
}
```

### Detailed Patterns for the never Type

```typescript
// Advanced uses of the never type

// 1. Helper function for exhaustiveness checking
function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${value}`);
}

type Action =
  | { type: "INCREMENT"; amount: number }
  | { type: "DECREMENT"; amount: number }
  | { type: "RESET" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "INCREMENT":
      return state + action.amount;
    case "DECREMENT":
      return state - action.amount;
    case "RESET":
      return 0;
    default:
      return assertNever(action); // Adding a new Action type causes an error here
  }
}

// 2. Using never in conditional types
// never is excluded from union types
type RemoveString<T> = T extends string ? never : T;
type Result = RemoveString<string | number | boolean>;
// number | boolean (string excluded)

// 3. Internal implementation of the Exclude utility type
// type Exclude<T, U> = T extends U ? never : T;
type WithoutNull = Exclude<string | null | undefined, null | undefined>;
// string

// 4. Type-level assertions using never
type Assert<T extends true> = T;
type IsString<T> = T extends string ? true : false;

// Compile-time tests
type _test1 = Assert<IsString<"hello">>; // OK
// type _test2 = Assert<IsString<42>>;   // Error: false is not assignable to true

// 5. never and conditional branching
type IsNever<T> = [T] extends [never] ? true : false;
type Test1 = IsNever<never>;  // true
type Test2 = IsNever<string>; // false

// 6. Forbidding properties (preventing certain keys from being used)
type Without<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};

interface FullUser {
  id: string;
  name: string;
  email: string;
  password: string;
}

type PublicUser = Without<FullUser, "password">;
// { id: string; name: string; email: string }
```

### Code Example 9: void and undefined

```typescript
// void: indicates that there is no return value
function logMessage(msg: string): void {
  console.log(msg);
  // return undefined; is performed implicitly
}

// undefined: undefined as a value
let u: undefined = undefined;

// Difference between void and undefined
// void carries the meaning of "ignoring the return value of a callback"
type Callback = () => void;

// A void callback may actually return a value (the value is ignored)
const cb: Callback = () => 42; // OK (42 is ignored)
```

### Details of void and undefined

```typescript
// Precise meaning of void
// void expresses the intent of "do not use the return value"

// undefined is a concrete type meaning "the value is undefined"
function getUndefined(): undefined {
  return undefined; // Must explicitly return undefined
}

function getVoid(): void {
  // return; or return undefined; are both fine
  // It's also fine to not return anything
}

// Important difference: assignment compatibility for functions returning void
type VoidFunc = () => void;
type UndefinedFunc = () => undefined;

// A function typed as void can actually return anything (the value is ignored)
const f1: VoidFunc = () => 42;         // OK
const f2: VoidFunc = () => "hello";    // OK
const f3: VoidFunc = () => true;       // OK

// A function typed as undefined can only return undefined
// const f4: UndefinedFunc = () => 42; // Error
const f5: UndefinedFunc = () => undefined; // OK

// Reason for this design: the type of Array.prototype.forEach
// forEach's callback returns void
// If it weren't void, callbacks that return values (like map's) couldn't be used
const arr = [1, 2, 3];
arr.forEach(n => n * 2); // OK: the result of n * 2 is ignored

// Choosing between null and undefined
// In TypeScript, strictNullChecks: true is recommended
// null: indicates that "a value intentionally does not exist"
// undefined: indicates that "a value has not been set"

interface UserProfile {
  name: string;
  bio: string | null;        // Intentionally empty: user chose "not set"
  middleName?: string;       // Optional: may not be set
  // Equivalent to middleName: string | undefined
}

// Practical conventions
// - API responses: use null (undefined does not exist in JSON)
// - Optional properties: undefined (means optional)
// - Function return value (when not found): undefined (convention of Array.find, etc.)
//   Although patterns returning null (e.g., document.getElementById) are also common
```

---

## 6. Type Inference

### Basic Type Inference

```typescript
// TypeScript automatically infers types in many situations

// At variable initialization
const name = "TypeScript";  // Inferred as string
const age = 12;             // Inferred as 12 (literal type because of const)
let count = 0;              // Inferred as number (wide type because of let)

// Difference in inference between const and let
const x = "hello";  // Type: "hello" (literal type)
let y = "hello";    // Type: string (wide type)

// Even with const, the contents of objects are widened
const config = { host: "localhost", port: 3000 };
// Type: { host: string; port: number }
// host is inferred as string, not "localhost"

// Preserve literal types with as const
const configConst = { host: "localhost", port: 3000 } as const;
// Type: { readonly host: "localhost"; readonly port: 3000 }

// Function return value inference
function add(a: number, b: number) {
  return a + b; // Return value inferred as number
}

function createPair<T>(value: T) {
  return [value, value] as const; // Inferred as readonly [T, T]
}

// Inference for conditional expressions
const result = Math.random() > 0.5 ? "yes" : "no";
// Type: "yes" | "no"

const value = Math.random() > 0.5 ? 42 : "hello";
// Type: 42 | "hello" (in case of const)
// Type: number | string (in case of let)
```

### Contextual Typing

```typescript
// Callback parameter types are inferred from the function argument's type

// Example 1: Array methods
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
// n is inferred as number (because numbers is number[])

// Example 2: Event handlers
document.addEventListener("click", event => {
  // event is inferred as MouseEvent (from the type definition of the "click" event)
  console.log(event.clientX, event.clientY);
});

document.addEventListener("keydown", event => {
  // event is inferred as KeyboardEvent
  console.log(event.key);
});

// Example 3: Callback function
type Comparator<T> = (a: T, b: T) => number;

function sort<T>(arr: T[], comparator: Comparator<T>): T[] {
  return [...arr].sort(comparator);
}

// a and b are inferred as number
const sorted = sort([3, 1, 2], (a, b) => a - b);

// Example 4: Promise callback
const promise = new Promise<string>((resolve, reject) => {
  // resolve is inferred as (value: string) => void
  // reject is inferred as (reason?: any) => void
  resolve("done");
});

// Example 5: Contextual typing with satisfies
type Routes = Record<string, { method: "GET" | "POST"; handler: () => void }>;

const routes = {
  "/users": { method: "GET", handler: () => {} },
  "/users/create": { method: "POST", handler: () => {} },
} satisfies Routes;
// The type of routes preserves the inferred concrete types while ensuring compatibility with Routes
// routes["/users"].method has type "GET" (not "GET" | "POST")
```

### Type Widening and Narrowing

```typescript
// ===== Widening =====
// Variables declared with let are inferred as wide types, not literal types

let x = "hello";  // string (widened)
const y = "hello"; // "hello" (not widened)

// Situations where widening occurs
let a = 42;        // number
let b = true;      // boolean
let c = null;      // any (when strictNullChecks is off) / null (when on)
let d = undefined; // any (when strictNullChecks is off) / undefined (when on)

// How to prevent widening
let e: "hello" = "hello"; // Explicit type annotation
let f = "hello" as const; // as const assertion (but cannot be reassigned with let)

// ===== Narrowing =====
// TypeScript's control flow analysis automatically narrows the type

function processValue(value: string | number | null) {
  // At this point: string | number | null

  if (value === null) {
    // Here: null
    return;
  }
  // Here: string | number

  if (typeof value === "string") {
    // Here: string
    console.log(value.toUpperCase());
  } else {
    // Here: number
    console.log(value.toFixed(2));
  }
}

// List of narrowing patterns

// 1. typeof guard
function typeofGuard(x: unknown) {
  if (typeof x === "string") { /* x: string */ }
  if (typeof x === "number") { /* x: number */ }
  if (typeof x === "boolean") { /* x: boolean */ }
  if (typeof x === "bigint") { /* x: bigint */ }
  if (typeof x === "symbol") { /* x: symbol */ }
  if (typeof x === "function") { /* x: Function */ }
  if (typeof x === "object" && x !== null) { /* x: object */ }
}

// 2. instanceof guard
function instanceofGuard(x: Date | RegExp) {
  if (x instanceof Date) {
    x.getFullYear(); // x: Date
  } else {
    x.test("hello"); // x: RegExp
  }
}

// 3. in guard
interface Fish { swim(): void; }
interface Bird { fly(): void; }

function inGuard(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim(); // animal: Fish
  } else {
    animal.fly(); // animal: Bird
  }
}

// 4. Equality check
function equalityGuard(x: string | number, y: string | boolean) {
  if (x === y) {
    // The common type of x and y: string
    x.toUpperCase(); // x: string
    y.toUpperCase(); // y: string
  }
}

// 5. Truthiness check
function truthinessGuard(x: string | null | undefined) {
  if (x) {
    x.toUpperCase(); // x: string (null, undefined, "" are excluded)
  }
}

// 6. Discriminated Union (tagged union)
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number }
  | { kind: "rectangle"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2; // shape: { kind: "circle"; radius: number }
    case "square":
      return shape.side ** 2; // shape: { kind: "square"; side: number }
    case "rectangle":
      return shape.width * shape.height; // shape: { kind: "rectangle"; ... }
  }
}

// 7. User-defined type guard (Type Predicate)
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

const values: (string | null)[] = ["hello", null, "world", null];
const nonNullValues = values.filter(isNonNull); // string[]

// 8. Assertion functions
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Expected string, got ${typeof value}`);
  }
}

function processInput(input: unknown): string {
  assertIsString(input);
  // From here on, input is treated as type string
  return input.toUpperCase();
}
```

---

## 7. Advanced Use of Type Aliases and Literal Types

### Template Literal Types

```typescript
// Basics of template literal types
type Greeting = `Hello, ${string}`;
type EventName = `on${string}`;

// Combining literal types
type Vertical = "top" | "middle" | "bottom";
type Horizontal = "left" | "center" | "right";
type Position = `${Vertical}-${Horizontal}`;
// "top-left" | "top-center" | "top-right" | "middle-left" | ... (9 combinations)

// Built-in string manipulation types
type Upper = Uppercase<"hello">;     // "HELLO"
type Lower = Lowercase<"HELLO">;     // "hello"
type Capitalized = Capitalize<"hello">; // "Hello"
type Uncapitalized = Uncapitalize<"Hello">; // "hello"

// Practical patterns for template literal types
// Type-safe generation of CSS property names
type CSSProperty = "margin" | "padding" | "border";
type CSSDirection = "top" | "right" | "bottom" | "left";
type CSSDirectionalProperty = `${CSSProperty}-${CSSDirection}`;
// "margin-top" | "margin-right" | ... | "border-left"

// API endpoint types
type Entity = "user" | "post" | "comment";
type CrudEndpoint = `/${Entity}s` | `/${Entity}s/:id`;
// "/users" | "/users/:id" | "/posts" | "/posts/:id" | "/comments" | "/comments/:id"

// Auto-generating event names
type ModelEvents<T extends string> = `${T}Created` | `${T}Updated` | `${T}Deleted`;
type UserEvents = ModelEvents<"user">;
// "userCreated" | "userUpdated" | "userDeleted"

// Getter/setter types
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }

type PersonSetters = Setters<Person>;
// { setName: (value: string) => void; setAge: (value: number) => void }
```

### Branded Types

```typescript
// TypeScript uses structural typing, so types with the same structure are compatible
// When this becomes a problem, simulate nominal typing with branded types

// Problem: all strings are mutually compatible
type UserId = string;
type ProductId = string;

function getUser(id: UserId): void { /* ... */ }
function getProduct(id: ProductId): void { /* ... */ }

const userId: UserId = "user-123";
const productId: ProductId = "prod-456";

getUser(productId); // No error! (both are strings)

// Solution: use branded types
type BrandedUserId = string & { readonly __brand: unique symbol };
type BrandedProductId = string & { readonly __brand: unique symbol };

function createUserId(id: string): BrandedUserId {
  // Validate
  if (!id.startsWith("user-")) {
    throw new Error("Invalid user ID format");
  }
  return id as BrandedUserId;
}

function createProductId(id: string): BrandedProductId {
  if (!id.startsWith("prod-")) {
    throw new Error("Invalid product ID format");
  }
  return id as BrandedProductId;
}

function getUserById(id: BrandedUserId): void { /* ... */ }
function getProductById(id: BrandedProductId): void { /* ... */ }

const safeUserId = createUserId("user-123");
const safeProductId = createProductId("prod-456");

getUserById(safeUserId);     // OK
// getUserById(safeProductId); // Error! Different types

// Generic utility for branded types
type Brand<T, B extends string> = T & { readonly __brand: B };

type Email = Brand<string, "Email">;
type URL = Brand<string, "URL">;
type PositiveNumber = Brand<number, "PositiveNumber">;

function createEmail(value: string): Email {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Invalid email");
  }
  return value as Email;
}

function createPositiveNumber(value: number): PositiveNumber {
  if (value <= 0) {
    throw new Error("Must be positive");
  }
  return value as PositiveNumber;
}
```

---

## Anti-Patterns

### Anti-Pattern 1: Escaping with any

```typescript
// BAD: using any when the type is unknown
function parseJSON(json: string): any {
  return JSON.parse(json);
}
const data = parseJSON('{"name":"Alice"}');
data.nonExistent.property; // Runtime error, no compiler warning

// GOOD: use unknown and process safely with type guards
function parseJSON(json: string): unknown {
  return JSON.parse(json);
}
const data = parseJSON('{"name":"Alice"}');
if (data !== null && typeof data === "object" && "name" in data) {
  console.log((data as { name: string }).name);
}
// Even better: validate with Zod or similar
```

### Anti-Pattern 2: Unnecessary Type Assertions

```typescript
// BAD: using a type assertion (as) without justification
const input = document.getElementById("name") as HTMLInputElement;
input.value; // Could actually be null -> runtime error

// GOOD: verify safely with a type guard
const input = document.getElementById("name");
if (input instanceof HTMLInputElement) {
  input.value; // Safe
}
```

### Anti-Pattern 3: Overly Wide Types

```typescript
// BAD: overusing string and number
interface Config {
  mode: string;      // Anything goes
  retries: number;   // Negative numbers also pass
  level: string;     // Meaningless values also pass
}

// GOOD: constrain with literal types or branded types
interface Config {
  mode: "development" | "staging" | "production";
  retries: 0 | 1 | 2 | 3 | 5 | 10;
  level: "debug" | "info" | "warn" | "error";
}

// Even better: enforce value constraints at runtime as well
import { z } from "zod";

const ConfigSchema = z.object({
  mode: z.enum(["development", "staging", "production"]),
  retries: z.number().int().min(0).max(10),
  level: z.enum(["debug", "info", "warn", "error"]),
});

type Config = z.infer<typeof ConfigSchema>;
```

### Anti-Pattern 4: Missing null Checks

```typescript
// BAD: disabling strictNullChecks
// tsconfig: "strictNullChecks": false

// GOOD: enable strictNullChecks and handle null explicitly
function findUser(id: string): User | null {
  const user = database.get(id);
  return user ?? null;
}

const user = findUser("123");
// user.name; // Error: Object is possibly 'null'
if (user !== null) {
  user.name; // OK
}

// Use Optional Chaining and Nullish Coalescing
const userName = user?.name ?? "Anonymous";
const userAge = user?.profile?.age ?? 0;
```

### Anti-Pattern 5: Unsafe Indexed Access into Arrays

```typescript
// BAD: assuming array elements always exist
const items: string[] = ["a", "b", "c"];
const item: string = items[10]; // Returns undefined, but the type is string
item.toUpperCase(); // Runtime error!

// GOOD: enable noUncheckedIndexedAccess
// tsconfig: "noUncheckedIndexedAccess": true
// items[10] is now typed as string | undefined

const safeItem = items[10];
// safeItem.toUpperCase(); // Error: Object is possibly 'undefined'
if (safeItem !== undefined) {
  safeItem.toUpperCase(); // OK
}

// Use the at() method (ES2022+)
const lastItem = items.at(-1); // string | undefined (always includes undefined)
```

---

## 8. Best Practices for Type Assertions and Type Guards

### Correct Use of Type Assertions

```typescript
// Use type assertions (as) only when you know more than the compiler

// Acceptable case 1: type of a DOM element
const canvas = document.getElementById("myCanvas");
if (canvas instanceof HTMLCanvasElement) {
  const ctx = canvas.getContext("2d"); // OK: canvas is HTMLCanvasElement
}

// Acceptable case 2: external library types are inaccurate
// Temporary workaround when the library's type definitions are wrong
const result = externalLib.getData() as unknown as CorrectType;
// TODO: send a PR to @types/external-lib

// Acceptable case 3: test code
// In tests, you may intentionally pass invalid values
it("should handle invalid input", () => {
  expect(() => processUser(null as unknown as User)).toThrow();
});

// Not recommended: unjustified type assertions
// const data = fetchData() as UserData; // The shape of the data is not guaranteed
```

### Type Guard Design Patterns

```typescript
// Implementation of generic type guards

// 1. Type guards for primitives
const is = {
  string: (value: unknown): value is string => typeof value === "string",
  number: (value: unknown): value is number =>
    typeof value === "number" && !Number.isNaN(value),
  boolean: (value: unknown): value is boolean => typeof value === "boolean",
  null: (value: unknown): value is null => value === null,
  undefined: (value: unknown): value is undefined => value === undefined,
  array: (value: unknown): value is unknown[] => Array.isArray(value),
  object: (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value),
  function: (value: unknown): value is Function => typeof value === "function",
  date: (value: unknown): value is Date => value instanceof Date,
  regExp: (value: unknown): value is RegExp => value instanceof RegExp,
  error: (value: unknown): value is Error => value instanceof Error,
};

// Usage
function processValue(value: unknown): string {
  if (is.string(value)) return value.toUpperCase();
  if (is.number(value)) return value.toFixed(2);
  if (is.boolean(value)) return value ? "true" : "false";
  if (is.null(value)) return "null";
  if (is.undefined(value)) return "undefined";
  if (is.array(value)) return `[${value.length} items]`;
  if (is.object(value)) return JSON.stringify(value);
  return String(value);
}

// 2. Object property checks
function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

function hasProperties<K extends string>(
  obj: unknown,
  keys: K[]
): obj is Record<K, unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    keys.every(key => key in obj)
  );
}

// 3. Type guards for array elements
function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

const data: unknown = [1, 2, 3];
if (isArrayOf(data, is.number)) {
  // data can be treated as number[]
  const sum = data.reduce((a, b) => a + b, 0);
}
```

---

## FAQ

### Q1: What is the difference between `string` and `String`?

**A:** Lowercase `string` is the TypeScript primitive type. Uppercase `String` is the JavaScript wrapper object type. Always use lowercase `string`. The same applies to `number` / `Number` and `boolean` / `Boolean`.

```typescript
// Primitive types (recommended)
const name: string = "Alice";
const age: number = 30;
const active: boolean = true;

// Wrapper object types (not recommended)
// const name: String = new String("Alice"); // Don't use
// const age: Number = new Number(30);       // Don't use
// const active: Boolean = new Boolean(true); // Don't use

// Wrapper objects can be assigned to primitives, but not vice versa
const s: String = "hello"; // OK (implicit conversion)
// const p: string = new String("hello"); // Error
```

### Q2: Are tuple element-count checks performed at runtime?

**A:** No. Tuple type checks are compile-time only. At runtime they are just arrays. If you need a runtime element-count check, write the validation manually or use Zod or similar.

```typescript
// Compile-time check
type Point = [number, number];
// const p: Point = [1]; // Error: not enough elements
// const p: Point = [1, 2, 3]; // Error: too many elements
const p: Point = [1, 2]; // OK

// At runtime it is just an array
console.log(Array.isArray(p)); // true
console.log(p.length); // 2 (although at the type level length is 2)

// A function to validate tuple shape at runtime
function isPoint(value: unknown): value is Point {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}
```

### Q3: Should I use enum?

**A:** As of 2025, many TypeScript style guides recommend either `const enum` or the union type + `as const` object pattern. Regular numeric enums generate runtime code for reverse-lookup mapping, which affects bundle size.

### Q4: Should I enable noUncheckedIndexedAccess?

**A:** Yes, recommended. Enabling this option adds `undefined` to the result of array and object indexed access, encouraging you to write safer code.

```typescript
// When noUncheckedIndexedAccess: true
const arr: string[] = ["a", "b", "c"];
const item = arr[0]; // string | undefined

// Indexed access on Record is also affected
const map: Record<string, number> = { a: 1, b: 2 };
const value = map["c"]; // number | undefined

// Non-destructive workarounds
// 1. Existence check
if (item !== undefined) {
  console.log(item.toUpperCase());
}

// 2. Non-null assertion (only when existence is guaranteed)
const first = arr[0]!; // string (excludes undefined)

// 3. The at() method (always returns T | undefined)
const last = arr.at(-1);
```

### Q5: When should I use symbol?

**A:** Symbols are useful in the following situations.
1. **Metadata properties on objects**: as keys that don't collide with regular properties
2. **Well-known Symbols**: implementing built-in protocols such as `Symbol.iterator`, `Symbol.dispose`
3. **Properties that are quasi-private**: as property keys that are hard to access externally (although not truly private)
4. **Plugin systems for libraries**: to avoid identifier collisions

In typical application development, you'll rarely use them directly, but they are frequently used in the internals of libraries and frameworks.

---

## Summary

| Type category | Type | Use case |
|-----------|-----|------|
| Primitive | string, number, boolean, symbol, bigint | Basic values |
| Literal | "hello", 42, true | Restricting to specific values |
| Template literal | `Hello, ${string}` | Constraining string patterns |
| Collection | T[], [T1, T2] | Sets of homogeneous/heterogeneous data |
| Enumeration | enum, const enum | Set of named constants |
| Special (dangerous) | any | Disabling type checking (not recommended) |
| Special (safe) | unknown | Type-safe arbitrary value |
| Special (absent) | never | Unreachable, exhaustiveness check |
| Special (empty) | void, null, undefined | No return value, absence of a value |
| Branded type | Brand<T, B> | Adding nominal typing on top of structural typing |

---

## Recommended Next Reads

- [02-functions-and-objects.md](./02-functions-and-objects.md) -- Function and object types
- [03-union-intersection.md](./03-union-intersection.md) -- Union and intersection types

---

## References

1. **TypeScript Handbook: Everyday Types** -- https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
2. **TypeScript Handbook: Narrowing** -- https://www.typescriptlang.org/docs/handbook/2/narrowing.html
3. **TypeScript Handbook: Template Literal Types** -- https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
4. **TypeScript Deep Dive: TypeScript's Type System** -- https://basarat.gitbook.io/typescript/type-system
5. **Effective TypeScript (Dan Vanderkam, O'Reilly)** -- especially Item 7: Think of Types as Sets of Values
6. **TypeScript Playground** -- https://www.typescriptlang.org/play -- instantly verify how types behave
