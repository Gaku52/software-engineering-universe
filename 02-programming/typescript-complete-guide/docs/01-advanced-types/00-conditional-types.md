# Conditional Types

> A powerful type feature that enables conditional branching at the type level. With `extends`, `infer`, distributive conditional types, and recursive conditional types, you can perform sophisticated type transformations.

## What you'll learn in this chapter

1. **Basics of conditional types** -- The `T extends U ? X : Y` syntax, type-level if/else
2. **The infer keyword** -- Extracting types via type pattern matching
3. **Distributive conditional types** -- How union types are distributed and how to control it
4. **Recursive conditional types** -- Recursive type transformations for deeply nested structures
5. **Building practical utility types** -- Designing useful types by combining conditional types
6. **Performance and debugging** -- Compile-time performance and troubleshooting techniques

## Prerequisites

Before reading this guide, the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Basics of Conditional Types

### 1.1 Basic Syntax and Evaluation Rules

A conditional type is the type-system equivalent of an "if/else" in TypeScript. It returns a different type depending on whether a type parameter satisfies a particular condition.

```typescript
// Basic syntax: T extends U ? TrueType : FalseType
// "If T is assignable to U, return TrueType; otherwise return FalseType"

// The simplest example: check whether the type is string
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;   // true
type B = IsString<number>;   // false
type C = IsString<"hello">;  // true (literal types are subtypes of string)
type D = IsString<any>;      // boolean (any is special: expands to true | false)
type E = IsString<never>;    // never (never is treated as an empty union)

// What `extends` means: "is a subtype of"
// string extends string → true
// "hello" extends string → true (literal types are subtypes of string)
// number extends string → false
// string extends "hello" → false (string is a supertype of "hello")
```

### 1.2 Nested Conditional Types

```typescript
// Apply different transformations based on the type
type TypeName<T> =
  T extends string ? "string" :
  T extends number ? "number" :
  T extends boolean ? "boolean" :
  T extends undefined ? "undefined" :
  T extends null ? "null" :
  T extends symbol ? "symbol" :
  T extends bigint ? "bigint" :
  T extends Function ? "function" :
  T extends any[] ? "array" :
  "object";

type T1 = TypeName<string>;       // "string"
type T2 = TypeName<() => void>;   // "function"
type T3 = TypeName<string[]>;     // "array"
type T4 = TypeName<null>;         // "null"
type T5 = TypeName<{ x: 1 }>;    // "object"
type T6 = TypeName<42>;           // "number"
type T7 = TypeName<true>;         // "boolean"
type T8 = TypeName<symbol>;       // "symbol"
type T9 = TypeName<bigint>;       // "bigint"
```

### 1.3 Practical Example: Null-safe Utility Type

```typescript
// A type that excludes null and undefined (the standard library's NonNullable)
type NonNullable<T> = T extends null | undefined ? never : T;

type R1 = NonNullable<string | null>;             // string
type R2 = NonNullable<number | undefined>;         // number
type R3 = NonNullable<string | null | undefined>;  // string
type R4 = NonNullable<null | undefined>;           // never

// Real-world example: exclude null from an API response type
interface ApiResponse {
  user: {
    name: string;
    email: string | null;
    phone: string | null | undefined;
  };
}

// Safely obtain the type of a nullable field
type UserEmail = NonNullable<ApiResponse["user"]["email"]>;  // string
type UserPhone = NonNullable<ApiResponse["user"]["phone"]>;  // string
```

### 1.4 Combining Conditional Types with Generic Constraints

```typescript
// A practical pattern combining generic constraints and conditional types
type MessageFor<T extends { type: string }> =
  T extends { type: "error" } ? { message: string; code: number } :
  T extends { type: "warning" } ? { message: string } :
  T extends { type: "info" } ? { text: string } :
  never;

// Usage example
interface ErrorEvent { type: "error"; }
interface WarningEvent { type: "warning"; }
interface InfoEvent { type: "info"; }

type ErrorMsg = MessageFor<ErrorEvent>;    // { message: string; code: number }
type WarningMsg = MessageFor<WarningEvent>; // { message: string }
type InfoMsg = MessageFor<InfoEvent>;       // { text: string }

// Use in a function: a type-safe event handler
function handleEvent<T extends { type: string }>(
  event: T,
  handler: (msg: MessageFor<T>) => void
): void {
  // implementation...
}
```

### Conditional Type Evaluation Flow

```
  Conditional type: T extends U ? X : Y

  Evaluation process:
  +----------+
  | Is T a   |---Yes---> return X
  | subtype  |
  | of U?    |---No----> return Y
  +----------+

  Example: IsString<number>
  +----------+
  | number   |
  | extends  |---No----> false
  | string?  |
  +----------+

  Multi-level nesting:
  TypeName<string[]>
  +----------+
  | string[] |           +----------+
  | extends  |---No----> | string[] |           +----------+
  | string?  |           | extends  |---No----> | ...      |
  +----------+           | number?  |           |          |---...
                         +----------+           +----------+
                         ...eventually reaches "array"
```

### 1.5 Comparing Conditional Types and Function Overloads

```typescript
// Approach using function overloads
function processValue(value: string): string[];
function processValue(value: number): number;
function processValue(value: string | number): string[] | number {
  if (typeof value === "string") {
    return value.split(",");
  }
  return value * 2;
}

// Approach using conditional types (more scalable)
type ProcessResult<T> =
  T extends string ? string[] :
  T extends number ? number :
  never;

function processValueGeneric<T extends string | number>(
  value: T
): ProcessResult<T> {
  if (typeof value === "string") {
    return value.split(",") as ProcessResult<T>;
  }
  return (value as number) * 2 as ProcessResult<T>;
}

// Both work in a type-safe manner
const strResult = processValueGeneric("a,b,c");  // string[]
const numResult = processValueGeneric(42);         // number
```

### 1.6 Understanding the Meaning of `extends` Deeply

```typescript
// `extends` checks the "subtype relationship"
// Subtype relationships in TypeScript are based on structural typing

// Basic subtype relationships
type Test1 = "hello" extends string ? true : false;     // true (literal -> general)
type Test2 = string extends "hello" ? true : false;     // false (general -> literal is not allowed)
type Test3 = 42 extends number ? true : false;          // true
type Test4 = true extends boolean ? true : false;       // true

// Subtypes of object types: more properties means a subtype
type Test5 = { a: string; b: number } extends { a: string } ? true : false;  // true
type Test6 = { a: string } extends { a: string; b: number } ? true : false;  // false

// Subtypes of function types: contravariance (parameters go in the opposite direction)
type Test7 = ((x: string) => void) extends ((x: string | number) => void) ? true : false;
// false (parameters are contravariant)

type Test8 = ((x: string | number) => void) extends ((x: string) => void) ? true : false;
// true (a function that accepts a wider parameter type is a subtype)

// The peculiarities of any and unknown
type Test9 = any extends string ? true : false;      // boolean (true | false)
type Test10 = unknown extends string ? true : false;  // false
type Test11 = string extends any ? true : false;      // true
type Test12 = string extends unknown ? true : false;  // true

// The peculiarity of never
type Test13 = never extends string ? true : false;    // never (empty union due to distribution)
type TestNeverWrapped = [never] extends [string] ? true : false;  // true
```

---

## 2. The infer Keyword

### 2.1 Basic Type Extraction

The `infer` keyword is used inside the `extends` clause of a conditional type, and it extracts a partial type via type pattern matching.

```typescript
// Get the return type of a function (the standard library's ReturnType)
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type A = ReturnType<() => string>;             // string
type B = ReturnType<(x: number) => boolean>;   // boolean
type C = ReturnType<typeof Math.max>;          // number
type D = ReturnType<typeof JSON.parse>;        // any

// Get the value inside a Promise (the standard library's Awaited)
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

type E = Awaited<Promise<string>>;            // string
type F = Awaited<Promise<Promise<number>>>;   // number (recursively unwrapped)
type G = Awaited<string>;                     // string (returned as-is if not a Promise)

// Get the parameter types of a function (the standard library's Parameters)
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

type H = Parameters<(a: string, b: number) => void>;  // [string, number]
type I = Parameters<() => void>;                        // []

// Get the element type of an array
type ElementType<T> = T extends (infer U)[] ? U : never;

type J = ElementType<string[]>;   // string
type K = ElementType<number[]>;   // number
type L = ElementType<string>;     // never (because it is not an array)
```

### 2.2 Advanced Use of infer

```typescript
// Extract the type of an object's property
type PropType<T, K extends string> =
  T extends { [key in K]: infer V } ? V : never;

type UserName = PropType<{ name: string; age: number }, "name">;  // string
type UserAge = PropType<{ name: string; age: number }, "age">;    // number

// infer with template literal types
type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractRouteParams<`/${Rest}`>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type Params = ExtractRouteParams<"/users/:userId/posts/:postId">;
// "userId" | "postId"

// Get the instance type of a constructor (the standard library's InstanceType)
type InstanceType<T> = T extends new (...args: any[]) => infer R ? R : never;

class MyClass {
  constructor(public name: string) {}
}

type MyInstance = InstanceType<typeof MyClass>;  // MyClass

// Get the parameter types of a constructor (the standard library's ConstructorParameters)
type ConstructorParameters<T> =
  T extends new (...args: infer P) => any ? P : never;

type MyCtorParams = ConstructorParameters<typeof MyClass>;  // [string]
```

### 2.3 Pattern Matching with Multiple infers

```typescript
// Extract both arguments and return type from a function type at once
type FuncParts<T> =
  T extends (...args: infer A) => infer R
    ? { args: A; returnType: R }
    : never;

type Parts = FuncParts<(x: string, y: number) => boolean>;
// { args: [x: string, y: number]; returnType: boolean }

// Extract both key and value from a Map type at once
type MapParts<T> =
  T extends Map<infer K, infer V>
    ? { key: K; value: V }
    : never;

type MP = MapParts<Map<string, number>>;
// { key: string; value: number }

// Split a tuple into its head and tail
type Head<T extends any[]> =
  T extends [infer H, ...any[]] ? H : never;

type Tail<T extends any[]> =
  T extends [any, ...infer R] ? R : never;

type H = Head<[1, 2, 3]>;  // 1
type TT = Tail<[1, 2, 3]>; // [2, 3]

// Get the last element of a tuple
type Last<T extends any[]> =
  T extends [...any[], infer L] ? L : never;

type LL = Last<[1, 2, 3]>;  // 3

// Get all but the last element of a tuple
type Init<T extends any[]> =
  T extends [...infer I, any] ? I : never;

type II = Init<[1, 2, 3]>;  // [1, 2]
```

### 2.4 infer in Covariant and Contravariant Positions

```typescript
// Inference results differ depending on the position of infer

// infer in a covariant position: a union type is inferred
type Foo<T> =
  T extends { a: infer U; b: infer U } ? U : never;

type FooResult = Foo<{ a: string; b: number }>;
// string | number (union, because of covariant position)

// infer in a contravariant position: an intersection type is inferred
type Bar<T> =
  T extends {
    a: (x: infer U) => void;
    b: (x: infer U) => void;
  } ? U : never;

type BarResult = Bar<{
  a: (x: string) => void;
  b: (x: number) => void;
}>;
// string & number → never (the intersection of string and number does not exist)

// Practical example: get all parameter types from an overloaded function
type UnionOfParams<T> =
  T extends {
    (x: infer A): any;
    (x: infer B): any;
  } ? A | B : never;
```

### 2.5 String Manipulation with infer

```typescript
// Get the first character of a string
type FirstChar<T extends string> =
  T extends `${infer F}${string}` ? F : never;

type FC = FirstChar<"hello">;  // "h"

// Get the rest of the string
type RestOfString<T extends string> =
  T extends `${string}${infer R}` ? R : never;

type RS = RestOfString<"hello">;  // "ello"

// Split a string by a specified delimiter
type Split<S extends string, D extends string> =
  S extends `${infer Head}${D}${infer Tail}`
    ? [Head, ...Split<Tail, D>]
    : [S];

type Splitted = Split<"a.b.c", ".">;  // ["a", "b", "c"]

// String replacement
type Replace<
  S extends string,
  From extends string,
  To extends string
> = S extends `${infer Before}${From}${infer After}`
  ? `${Before}${To}${After}`
  : S;

type Replaced = Replace<"hello world", "world", "TypeScript">;
// "hello TypeScript"

// Replace all occurrences
type ReplaceAll<
  S extends string,
  From extends string,
  To extends string
> = S extends `${infer Before}${From}${infer After}`
  ? ReplaceAll<`${Before}${To}${After}`, From, To>
  : S;

type ReplacedAll = ReplaceAll<"a-b-c-d", "-", ".">;
// "a.b.c.d"
```

### infer Position and the Extracted Type

```
  Pattern                           infer position    Extracted type
+-------------------------------------+----------------+------------------+
| T extends (infer U)[]               | array element  | element type     |
| T extends (...args: infer P) => any | function args  | parameter tuple  |
| T extends (...args: any) => infer R | function ret   | return type      |
| T extends Promise<infer U>          | Promise value  | resolved type    |
| T extends Map<infer K, infer V>     | Map type args  | key & value types|
| T extends Set<infer U>              | Set type arg   | element type     |
| T extends { a: infer U }            | property value | property type    |
| T extends [infer H, ...infer T]     | tuple split    | head & rest      |
| T extends `${infer A}.${infer B}`   | string split   | substrings       |
| T extends new (...args: infer P)... | constructor    | constructor args |
+-------------------------------------+----------------+------------------+
```

---

## 3. Distributive Conditional Types

### 3.1 How Distribution Works

When a union type is passed to a conditional type as a "naked" type parameter, the conditional type is evaluated individually for each member of the union. This is called "distribution".

```typescript
// When a union type is passed to a conditional type, it is "distributed"
type ToArray<T> = T extends any ? T[] : never;

// When string | number is passed:
// ToArray<string> | ToArray<number>
// = string[] | number[]
type A = ToArray<string | number>;  // string[] | number[]

// Conditions for distribution to occur:
// 1. The checked type in the conditional type must be a "naked type parameter"
// 2. The type parameter must be a union type

// To prevent distribution, wrap with []
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;

type B = ToArrayNonDist<string | number>;  // (string | number)[]
```

### 3.2 Detailed Behavior of Distribution

```typescript
// Detailed patterns where distribution occurs

// Pattern 1: naked type parameter → distributes
type Dist1<T> = T extends string ? T : never;
type R1 = Dist1<string | number | boolean>;  // string

// Pattern 2: type parameter wrapped by another type → does not distribute
type NoDist1<T> = [T] extends [string] ? T : never;
type R2 = NoDist1<string | number>;  // never (the entire union is not a string)

// Pattern 3: type parameter used as a property → does not distribute
type NoDist2<T> = { value: T } extends { value: string } ? T : never;
type R3 = NoDist2<string | number>;  // never

// Pattern 4: type parameter used as the element of an array → does not distribute
type NoDist3<T> = T[] extends string[] ? T : never;
type R4 = NoDist3<string | number>;  // never

// Important: distribution applies only to type parameters on the left side of the extends clause
type Example<T, U> = T extends U ? T : never;
// T is distributed (left side), U is not distributed (right side)
type R5 = Example<"a" | "b" | "c", "a" | "c">;  // "a" | "c"
```

### 3.3 Practical Examples of Distributive Conditional Types

```typescript
// Exclude null and undefined from a union type (implementation of NonNullable)
type MyNonNullable<T> = T extends null | undefined ? never : T;

type A = MyNonNullable<string | null | undefined>;  // string

// Extract a specific type from a union (implementation of Extract)
type MyExtract<T, U> = T extends U ? T : never;

type B = MyExtract<"a" | "b" | "c", "a" | "c">;  // "a" | "c"

// Exclude a specific type from a union (implementation of Exclude)
type MyExclude<T, U> = T extends U ? never : T;

type C = MyExclude<"a" | "b" | "c", "a">;  // "b" | "c"

// Extract a specific member from a discriminated union
type Action =
  | { type: "fetch"; url: string }
  | { type: "save"; data: unknown }
  | { type: "delete"; id: string };

type FetchAction = Extract<Action, { type: "fetch" }>;
// { type: "fetch"; url: string }

type NonFetchAction = Exclude<Action, { type: "fetch" }>;
// { type: "save"; data: unknown } | { type: "delete"; id: string }

// Filtering an object type: keep only properties of a specific type
type FilterByValueType<T, ValueType> = {
  [K in keyof T as T[K] extends ValueType ? K : never]: T[K];
};

interface User {
  name: string;
  age: number;
  email: string;
  isActive: boolean;
}

type StringProps = FilterByValueType<User, string>;
// { name: string; email: string }

type NumberProps = FilterByValueType<User, number>;
// { age: number }
```

### 3.4 Distributive Conditional Types and never

```typescript
// `never` is treated as the "empty" union type
// When `never` is passed to a distributive conditional type, there are no
// members to process, so the result is also `never`

type Test<T> = T extends string ? "yes" : "no";
type Result1 = Test<never>;  // never (neither "yes" nor "no")

// To detect `never`, prevent distribution
type IsNever<T> = [T] extends [never] ? true : false;

type Result2 = IsNever<never>;       // true
type Result3 = IsNever<string>;      // false
type Result4 = IsNever<undefined>;   // false

// Practical example: branch processing based on whether the type is never
type SafeReturn<T> =
  [T] extends [never]
    ? undefined
    : T;

type R1 = SafeReturn<string>;  // string
type R2 = SafeReturn<never>;   // undefined

// Determine whether a union type is empty
type IsEmptyUnion<T> = [T] extends [never] ? true : false;

// Difference between never and void
type TestVoid = Test<void>;    // "no" (void is evaluated as a union member)
type TestNever = Test<never>;  // never (empty union)
```

### 3.5 Union Manipulation Using Distributive Conditional Types

```typescript
// Counting the members of a union type (a conceptual approach)
// Although it cannot be done directly, there is a technique to convert it to
// a tuple and read its length

// Convert a union to a tuple (the order is not guaranteed)
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

type LastOfUnion<T> =
  UnionToIntersection<
    T extends any ? () => T : never
  > extends () => infer R
    ? R
    : never;

type UnionToTuple<T, Last = LastOfUnion<T>> =
  [T] extends [never]
    ? []
    : [...UnionToTuple<Exclude<T, Last>>, Last];

type Tuple = UnionToTuple<"a" | "b" | "c">;  // ["a", "b", "c"]

// Generate every pair from a union type
type Pairs<T, U = T> =
  T extends any
    ? U extends any
      ? T extends U
        ? never
        : [T, U]
      : never
    : never;

type AllPairs = Pairs<"a" | "b" | "c">;
// ["a", "b"] | ["a", "c"] | ["b", "a"] | ["b", "c"] | ["c", "a"] | ["c", "b"]
```

---

## 4. Recursive Conditional Types

### 4.1 Deep Object Type Transformations

```typescript
// Deep Readonly for nested objects
type DeepReadonly<T> =
  T extends (...args: any[]) => any
    ? T  // functions are kept as-is
    : T extends any[]
      ? DeepReadonlyArray<T>  // arrays are handled separately
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;  // primitives are kept as-is

type DeepReadonlyArray<T extends any[]> =
  readonly [...{ [K in keyof T]: DeepReadonly<T[K]> }];

interface Config {
  db: {
    host: string;
    port: number;
    credentials: {
      user: string;
      pass: string;
    };
  };
  features: string[];
  nested: {
    list: { id: number; name: string }[];
  };
}

type ReadonlyConfig = DeepReadonly<Config>;
// All nested properties become readonly
// features becomes readonly string[]
// nested.list becomes readonly { readonly id: number; readonly name: string }[]

// Deep Partial
type DeepPartial<T> =
  T extends (...args: any[]) => any
    ? T
    : T extends any[]
      ? T
      : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

type PartialConfig = DeepPartial<Config>;
// All nested properties become optional

// Deep Required
type DeepRequired<T> =
  T extends (...args: any[]) => any
    ? T
    : T extends any[]
      ? T
      : T extends object
        ? { [K in keyof T]-?: DeepRequired<T[K]> }
        : T;
```

### 4.2 Flatten Types

```typescript
// Flatten (one-level flattening of a nested array)
type Flatten<T> = T extends (infer U)[] ? U : T;

type A = Flatten<string[][]>;  // string[]
type B = Flatten<string[]>;    // string

// Deep flattening
type DeepFlatten<T> = T extends (infer U)[] ? DeepFlatten<U> : T;

type C = DeepFlatten<string[][][]>;  // string

// Flatten up to a specified depth
type FlattenDepth<
  T extends any[],
  Depth extends number = 1,
  Counter extends any[] = []
> = Counter["length"] extends Depth
  ? T
  : T extends [infer First, ...infer Rest]
    ? First extends any[]
      ? [...FlattenDepth<First, Depth, [...Counter, 0]>, ...FlattenDepth<Rest, Depth, Counter>]
      : [First, ...FlattenDepth<Rest, Depth, Counter>]
    : T;

type FD1 = FlattenDepth<[1, [2, [3, [4]]]], 1>;  // [1, 2, [3, [4]]]
type FD2 = FlattenDepth<[1, [2, [3, [4]]]], 2>;  // [1, 2, 3, [4]]
```

### 4.3 Type-level String Manipulation (Recursive)

```typescript
// Convert a string to upper case
type UpperCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? `${Uppercase<First>}${UpperCase<Rest>}`
    : S;

// Convert camelCase to snake_case
type CamelToSnake<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends Uppercase<First>
      ? First extends Lowercase<First>
        ? `${First}${CamelToSnake<Rest>}`
        : `_${Lowercase<First>}${CamelToSnake<Rest>}`
      : `${First}${CamelToSnake<Rest>}`
    : S;

type Snake = CamelToSnake<"camelCaseString">;
// "camel_case_string"

// Convert snake_case to camelCase
type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
    : S;

type Camel = SnakeToCamel<"snake_case_string">;
// "snakeCaseString"

// Convert kebab-case to camelCase
type KebabToCamel<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Head}${Capitalize<KebabToCamel<Tail>>}`
    : S;

type Kebab = KebabToCamel<"kebab-case-string">;
// "kebabCaseString"

// Get the length of a string
type StringLength<
  S extends string,
  Counter extends any[] = []
> = S extends `${string}${infer Rest}`
  ? StringLength<Rest, [...Counter, 0]>
  : Counter["length"];

type Len = StringLength<"hello">;  // 5
```

### 4.4 Type-level Arithmetic

```typescript
// Type-level addition
type Add<A extends number, B extends number> =
  [...BuildTuple<A>, ...BuildTuple<B>]["length"] & number;

type BuildTuple<
  N extends number,
  T extends any[] = []
> = T["length"] extends N ? T : BuildTuple<N, [...T, 0]>;

type Sum = Add<3, 4>;  // 7

// Type-level comparison
type GreaterThan<
  A extends number,
  B extends number,
  Counter extends any[] = []
> = Counter["length"] extends A
  ? false
  : Counter["length"] extends B
    ? true
    : GreaterThan<A, B, [...Counter, 0]>;

type GT = GreaterThan<5, 3>;  // true
type LT = GreaterThan<2, 4>;  // false

// Type-level range generation
type Range<
  Start extends number,
  End extends number,
  Result extends number[] = [],
  Counter extends any[] = BuildTuple<Start>
> = Counter["length"] extends End
  ? [...Result, End]
  : Range<Start, End, [...Result, Counter["length"] & number], [...Counter, 0]>;

type R = Range<1, 5>;  // [1, 2, 3, 4, 5]
```

### 4.5 Nested Property Access via Dot Paths

```typescript
// Generate dot-separated keys from a path
type DotPath<T, Prefix extends string = ""> =
  T extends object
    ? {
        [K in keyof T & string]: T[K] extends object
          ? T[K] extends any[]
            ? `${Prefix}${K}`
            : DotPath<T[K], `${Prefix}${K}.`> | `${Prefix}${K}`
          : `${Prefix}${K}`;
      }[keyof T & string]
    : never;

interface Settings {
  theme: {
    color: string;
    fontSize: number;
    font: {
      family: string;
      weight: number;
    };
  };
  user: {
    name: string;
    preferences: {
      darkMode: boolean;
    };
  };
}

type SettingPaths = DotPath<Settings>;
// "theme" | "theme.color" | "theme.fontSize" | "theme.font"
// | "theme.font.family" | "theme.font.weight"
// | "user" | "user.name" | "user.preferences" | "user.preferences.darkMode"

// Get the type of a value at a dot path
type PathValue<T, P extends string> =
  P extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? PathValue<T[Key], Rest>
      : never
    : P extends keyof T
      ? T[P]
      : never;

type ThemeColor = PathValue<Settings, "theme.color">;      // string
type FontWeight = PathValue<Settings, "theme.font.weight">; // number
type DarkMode = PathValue<Settings, "user.preferences.darkMode">; // boolean

// Type-safe getByPath function
function getByPath<T, P extends DotPath<T>>(
  obj: T,
  path: P
): PathValue<T, P & string> {
  const keys = (path as string).split(".");
  let result: any = obj;
  for (const key of keys) {
    result = result[key];
  }
  return result;
}

// Usage example
declare const settings: Settings;
const color = getByPath(settings, "theme.color");           // typed as string
const weight = getByPath(settings, "theme.font.weight");    // typed as number
// getByPath(settings, "theme.invalid");  // compile error
```

---

## 5. Building Practical Utility Types

### 5.1 API Response Type Transformation

```typescript
// A type that automatically transforms API response fields

// Convert snake_case keys to camelCase
type SnakeToCamelKeys<T> =
  T extends any[]
    ? { [K in keyof T]: SnakeToCamelKeys<T[K]> }
    : T extends object
      ? {
          [K in keyof T as K extends string
            ? SnakeToCamel<K>
            : K]: SnakeToCamelKeys<T[K]>
        }
      : T;

// API response type (the server returns snake_case)
interface ApiUserResponse {
  user_id: number;
  first_name: string;
  last_name: string;
  email_address: string;
  created_at: string;
  profile_data: {
    avatar_url: string;
    display_name: string;
    bio_text: string | null;
  };
}

// Convert to camelCase for the frontend
type UserData = SnakeToCamelKeys<ApiUserResponse>;
// {
//   userId: number;
//   firstName: string;
//   lastName: string;
//   emailAddress: string;
//   createdAt: string;
//   profileData: {
//     avatarUrl: string;
//     displayName: string;
//     bioText: string | null;
//   };
// }

// A type that converts date strings to Date
type ConvertDates<T> =
  T extends object
    ? {
        [K in keyof T]: K extends `${string}_at` | `${string}At`
          ? Date
          : T[K] extends object
            ? ConvertDates<T[K]>
            : T[K];
      }
    : T;

type UserWithDates = ConvertDates<UserData>;
// createdAt is converted to the Date type
```

### 5.2 Form Validation Types

```typescript
// Define form validation rules in a type-safe way

// Validation rules
interface ValidationRules {
  required: boolean;
  minLength: number;
  maxLength: number;
  pattern: RegExp;
  min: number;
  max: number;
  custom: (value: any) => boolean;
}

// Auto-generate a validation-error type from the form-field type
type ValidationErrors<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends any[]
      ? string[]
      : ValidationErrors<T[K]>
    : string;
};

// Form state type
type FormState<T> = {
  values: T;
  errors: ValidationErrors<T>;
  touched: { [K in keyof T]?: boolean };
  isValid: boolean;
  isSubmitting: boolean;
};

// Usage example
interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

type LoginFormState = FormState<LoginForm>;
// {
//   values: LoginForm;
//   errors: { email?: string; password?: string; rememberMe?: string };
//   touched: { email?: boolean; password?: boolean; rememberMe?: boolean };
//   isValid: boolean;
//   isSubmitting: boolean;
// }

// Nested form
interface RegistrationForm {
  personal: {
    firstName: string;
    lastName: string;
  };
  account: {
    email: string;
    password: string;
  };
  address: {
    street: string;
    city: string;
    zipCode: string;
  };
}

type RegistrationErrors = ValidationErrors<RegistrationForm>;
// {
//   personal?: {
//     firstName?: string;
//     lastName?: string;
//   };
//   account?: {
//     email?: string;
//     password?: string;
//   };
//   address?: {
//     street?: string;
//     city?: string;
//     zipCode?: string;
//   };
// }
```

### 5.3 Type-safe State Management Design

```typescript
// Redux-style type-safe action definitions

// Define the type of an action creator
type ActionCreator<T extends string, P = void> =
  P extends void
    ? { type: T }
    : { type: T; payload: P };

// Auto-generate action types from a type map of actions
type ActionMap = {
  INCREMENT: void;
  DECREMENT: void;
  SET_COUNT: number;
  SET_NAME: string;
  SET_USER: { name: string; age: number };
  ADD_ITEM: { id: string; value: unknown };
  REMOVE_ITEM: string;
  RESET: void;
};

// Generate all action types from the map
type Actions = {
  [K in keyof ActionMap]: ActionCreator<K & string, ActionMap[K]>;
}[keyof ActionMap];

// Actions is the following union type:
// | { type: "INCREMENT" }
// | { type: "DECREMENT" }
// | { type: "SET_COUNT"; payload: number }
// | { type: "SET_NAME"; payload: string }
// | { type: "SET_USER"; payload: { name: string; age: number } }
// | { type: "ADD_ITEM"; payload: { id: string; value: unknown } }
// | { type: "REMOVE_ITEM"; payload: string }
// | { type: "RESET" }

// Type-safe reducer definition
type State = {
  count: number;
  name: string;
  user: { name: string; age: number } | null;
  items: { id: string; value: unknown }[];
};

function reducer(state: State, action: Actions): State {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, count: state.count + 1 };
    case "SET_COUNT":
      return { ...state, count: action.payload }; // payload is number
    case "SET_USER":
      return { ...state, user: action.payload };   // payload is { name: string; age: number }
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.payload] };
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter(i => i.id !== action.payload),  // payload is string
      };
    case "RESET":
      return { count: 0, name: "", user: null, items: [] };
    default:
      return state;
  }
}
```

### 5.4 Type-safe Event Emitter

```typescript
// Define an event map type
interface EventMap {
  connect: { host: string; port: number };
  disconnect: { reason: string };
  message: { from: string; text: string; timestamp: number };
  error: { code: number; message: string };
  "user:join": { userId: string; username: string };
  "user:leave": { userId: string };
}

// Define a type-safe event emitter using conditional types
type EventHandler<T> = (event: T) => void;

type EventHandlers<M> = {
  [K in keyof M]?: EventHandler<M[K]>[];
};

class TypedEventEmitter<M extends Record<string, any>> {
  private handlers: EventHandlers<M> = {} as EventHandlers<M>;

  on<K extends keyof M>(event: K, handler: EventHandler<M[K]>): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event]!.push(handler);
  }

  emit<K extends keyof M>(event: K, data: M[K]): void {
    const eventHandlers = this.handlers[event];
    if (eventHandlers) {
      eventHandlers.forEach(handler => handler(data));
    }
  }

  off<K extends keyof M>(event: K, handler: EventHandler<M[K]>): void {
    const eventHandlers = this.handlers[event];
    if (eventHandlers) {
      this.handlers[event] = eventHandlers.filter(h => h !== handler) as any;
    }
  }
}

// Usage example
const emitter = new TypedEventEmitter<EventMap>();

emitter.on("connect", (event) => {
  // event is inferred as { host: string; port: number }
  console.log(`Connected to ${event.host}:${event.port}`);
});

emitter.on("message", (event) => {
  // event is inferred as { from: string; text: string; timestamp: number }
  console.log(`${event.from}: ${event.text}`);
});

// emitter.on("connect", (event: { invalid: true }) => {}); // compile error
// emitter.emit("message", { invalid: true }); // compile error
```

### 5.5 Type-safe Implementation of the Builder Pattern

```typescript
// A type-safe builder using conditional types

// Track required fields
type RequiredFields = {
  name: string;
  age: number;
  email: string;
};

type OptionalFields = {
  phone?: string;
  address?: string;
  bio?: string;
};

// Track the builder's state in a type parameter
type BuilderState<
  Required extends Record<string, any>,
  Set extends string = never
> = {
  // build() is callable only when all required fields have been set
  build: [Exclude<keyof Required, Set>] extends [never]
    ? () => Required & OptionalFields
    : never;
} & {
  // Setters for fields that have not been set yet
  [K in Exclude<keyof Required, Set> & string as `set${Capitalize<K>}`]:
    (value: Required[K]) => BuilderState<Required, Set | K>;
} & {
  // Setters for optional fields
  [K in keyof OptionalFields & string as `set${Capitalize<K>}`]:
    (value: NonNullable<OptionalFields[K]>) => BuilderState<Required, Set>;
};

// Conceptual usage (types only)
// const user = createBuilder<RequiredFields>()
//   .setName("Alice")   // BuilderState<RequiredFields, "name">
//   .setAge(30)          // BuilderState<RequiredFields, "name" | "age">
//   .setEmail("a@b.c")  // BuilderState<RequiredFields, "name" | "age" | "email">
//   .build();            // Required & OptionalFields (build is callable)
```

---

## 6. Performance and Debugging

### 6.1 Performance Considerations of Conditional Types

```typescript
// Things to keep in mind regarding compile-time performance of conditional types

// BAD: deep recursion makes compilation slow
type DeepNested1<T, Depth extends any[] = []> =
  Depth["length"] extends 100
    ? T
    : DeepNested1<T[], [...Depth, 0]>;

// TypeScript has a recursion-depth limit (typically around 50 to 100)
// Excessive recursion causes the error "Type instantiation is excessively deep"

// GOOD: limit the recursion depth
type SafeDeepType<T, Depth extends any[] = []> =
  Depth["length"] extends 10  // limit to a reasonable depth
    ? T
    : T extends object
      ? { [K in keyof T]: SafeDeepType<T[K], [...Depth, 0]> }
      : T;

// BAD: union-type explosion
// distributive conditional type + large union = computational explosion
type HugeUnion = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"; // 8 members
type Combinations<T, U = T> =
  T extends any
    ? U extends any
      ? [T, U]
      : never
    : never;

type AllCombinations = Combinations<HugeUnion>;
// Generates 8 × 8 = 64 union members
// Adding more members makes compilation exponentially slower

// GOOD: generate only the combinations you need
type SpecificCombinations = ["a", "b"] | ["a", "c"] | ["b", "c"];
```

### 6.2 Debugging Techniques for Conditional Types

```typescript
// Technique 1: capture intermediate types in variables to verify them
type Debug1 = string extends any ? true : false;  // verify it is true

// Technique 2: confirm a type using error messages
type ShowType<T> = T & { __debug: T };

// Technique 3: utilities for type-level testing
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

// Writing tests
type TestCase1 = Expect<Equal<IsString<string>, true>>;  // OK
type TestCase2 = Expect<Equal<IsString<number>, false>>; // OK
// type TestCase3 = Expect<Equal<IsString<string>, false>>; // compile error (as expected)

// Technique 4: trace conditional-type expansion
// Use the "Expand Type" feature of the TypeScript Language Server
// In VSCode, hovering over a variable shows the expanded type

// Technique 5: negative testing with @ts-expect-error
// @ts-expect-error -- number is not a string, so this should error
type NegativeTest: IsString<number> = true;

// Technique 6: a helper to confirm type equality
type Assert<T, Expected> = T extends Expected
  ? Expected extends T
    ? true
    : { error: "Types are not equal"; got: T; expected: Expected }
  : { error: "Types are not equal"; got: T; expected: Expected };

type Check1 = Assert<ReturnType<() => string>, string>;  // true
type Check2 = Assert<ReturnType<() => number>, string>;  // an object with error info
```

### 6.3 Limitations of Conditional Types

```typescript
// Limitation 1: type guards cannot be used inside conditional types
// BAD: runtime typeof cannot be used at the type level
// type RuntimeCheck<T> = typeof T === "string" ? true : false; // error

// Limitation 2: lazy evaluation of conditional types
// When the type parameter is unresolved, evaluation of the conditional type is deferred
function example<T>(x: T) {
  // T is unknown at this point, so the conditional type is not expanded
  type Result = T extends string ? "string" : "other";
  // Result remains as T extends string ? "string" : "other"
}

// Limitation 3: recursion depth limit
// TypeScript 4.5+ allows recursion up to 1000 levels, but in practice
// performance becomes an issue at much shallower levels

// Limitation 4: priority of type inference
// Behavior when multiple infer instances use the same type variable name
type Ambiguous<T> =
  T extends { a: infer U; b: infer U }
    ? U
    : never;

// Covariant position, so the result is a union
type AmbiguousResult = Ambiguous<{ a: string; b: number }>;
// string | number

// Limitation 5: interaction between conditional types and function-argument inference
// When a conditional type result is used as a function argument, type inference
// may not work as expected
function problematic<T extends string | number>(
  value: T,
  transform: (x: T extends string ? string : number) => void
): void {
  // T is unresolved, so the conditional type is also unresolved
  // transform(value); // error: T is not assignable to T extends string ? string : number
}

// Workaround: use overloads or type assertions
function fixed(value: string, transform: (x: string) => void): void;
function fixed(value: number, transform: (x: number) => void): void;
function fixed(value: string | number, transform: (x: any) => void): void {
  transform(value);
}
```

---

## 7. Advanced Conditional Type Patterns

### 7.1 A Type-level JSON Parser

```typescript
// Parse a JSON string at the type level (a conceptual implementation)

// Skip whitespace
type SkipWhitespace<S extends string> =
  S extends ` ${infer Rest}` | `\n${infer Rest}` | `\t${infer Rest}`
    ? SkipWhitespace<Rest>
    : S;

// Parse a string literal
type ParseString<S extends string> =
  S extends `"${infer Content}"${infer Rest}`
    ? [Content, Rest]
    : never;

// Parse a number (simplified)
type ParseNumber<S extends string> =
  S extends `${infer N extends number}${infer Rest}`
    ? [N, Rest]
    : never;

// Parse a boolean
type ParseBool<S extends string> =
  S extends `true${infer Rest}` ? [true, Rest] :
  S extends `false${infer Rest}` ? [false, Rest] :
  never;

// Parse null
type ParseNull<S extends string> =
  S extends `null${infer Rest}` ? [null, Rest] : never;

// Combining these allows parsing each JSON value type
// A real full parser is very complex, but this example shows the
// possibilities of type-level programming
```

### 7.2 Type-level Path Analysis

```typescript
// Type-safe extraction of URL path parameters

// Extract path parameters
type ExtractParams<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParamsObj<Rest>]: string }
    : Path extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : {};

type ExtractParamsObj<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractParamsObj<Rest>
    : Path extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : {};

// Type-safe definition of query parameters
type QueryParams<T extends string> =
  T extends `${string}?${infer Query}`
    ? ParseQuery<Query>
    : {};

type ParseQuery<Q extends string> =
  Q extends `${infer Key}=${infer Value}&${infer Rest}`
    ? { [K in Key]: Value } & ParseQuery<Rest>
    : Q extends `${infer Key}=${infer Value}`
      ? { [K in Key]: Value }
      : {};

// Express-style router type definition
type Route<
  Method extends "GET" | "POST" | "PUT" | "DELETE",
  Path extends string,
  Body = never,
  Response = unknown
> = {
  method: Method;
  path: Path;
  params: ExtractParamsObj<Path>;
  body: Body;
  response: Response;
};

// Usage example
type UserRoute = Route<"GET", "/users/:userId/posts/:postId">;
// params is { userId: string; postId: string }

// Type-safe route handler
type RouteHandler<R extends Route<any, any, any, any>> = (
  req: {
    params: R["params"];
    body: R["body"];
  }
) => Promise<R["response"]>;

// Implementation example
type GetUserRoute = Route<"GET", "/users/:userId", never, { name: string; age: number }>;

const getUserHandler: RouteHandler<GetUserRoute> = async (req) => {
  const userId = req.params.userId;  // typed as string
  return { name: "Alice", age: 30 };  // must return { name: string; age: number }
};
```

### 7.3 Type-level State Machines

```typescript
// Express state transitions safely with conditional types

// State definitions
type OrderState = "draft" | "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

// Define state transitions (using conditional types)
type ValidTransition<From extends OrderState> =
  From extends "draft" ? "pending" | "cancelled" :
  From extends "pending" ? "confirmed" | "cancelled" :
  From extends "confirmed" ? "shipped" | "cancelled" :
  From extends "shipped" ? "delivered" :
  From extends "delivered" ? never :
  From extends "cancelled" ? never :
  never;

// Determine whether a state transition is valid
type CanTransition<From extends OrderState, To extends OrderState> =
  To extends ValidTransition<From> ? true : false;

// Type tests
type Test1 = CanTransition<"draft", "pending">;      // true
type Test2 = CanTransition<"draft", "shipped">;       // false
type Test3 = CanTransition<"confirmed", "shipped">;   // true
type Test4 = CanTransition<"delivered", "draft">;      // false
type Test5 = CanTransition<"cancelled", "pending">;    // false

// Type-safe state transition function
class Order<S extends OrderState> {
  constructor(
    public readonly state: S,
    public readonly id: string
  ) {}

  transition<Next extends ValidTransition<S>>(
    nextState: Next
  ): Order<Next> {
    return new Order(nextState, this.id);
  }
}

// Usage example
const order = new Order("draft", "order-001");
const pending = order.transition("pending");      // Order<"pending">
const confirmed = pending.transition("confirmed"); // Order<"confirmed">
const shipped = confirmed.transition("shipped");    // Order<"shipped">
// shipped.transition("draft");                    // compile error!
// confirmed.transition("delivered");              // compile error!

// Express the available actions for each state via types
type ActionsForState<S extends OrderState> =
  S extends "draft" ? { edit: () => void; submit: () => void; cancel: () => void } :
  S extends "pending" ? { confirm: () => void; cancel: () => void } :
  S extends "confirmed" ? { ship: () => void; cancel: () => void } :
  S extends "shipped" ? { deliver: () => void; track: () => string } :
  S extends "delivered" ? { review: () => void; returnItem: () => void } :
  S extends "cancelled" ? { reorder: () => void } :
  never;
```

### 7.4 A Validation DSL Using Conditional Types

```typescript
// Type-level validation rule definitions

// Validation rule type
type Rule<T, Message extends string = string> = {
  validate: (value: T) => boolean;
  message: Message;
};

// Determine validation rules from the field type using conditional types
type DefaultRules<T> =
  T extends string
    ? Rule<string, "String cannot be empty"> | Rule<string, "Exceeds maximum length">
    : T extends number
      ? Rule<number, "Number must be 0 or greater"> | Rule<number, "Number is too large">
      : T extends boolean
        ? Rule<boolean, "This field is required">
        : T extends any[]
          ? Rule<T, "At least one element is required">
          : Rule<T, "Invalid value">;

// Form-field configuration type
type FieldConfig<T> = {
  type: T extends string ? "text" | "email" | "password" | "url"
    : T extends number ? "number" | "range" | "slider"
    : T extends boolean ? "checkbox" | "toggle"
    : T extends Date ? "date" | "datetime"
    : T extends any[] ? "multiselect" | "tags"
    : "custom";
  label: string;
  defaultValue: T;
  rules?: DefaultRules<T>[];
};

// Usage example
type UserFormConfig = {
  [K in keyof RequiredFields]: FieldConfig<RequiredFields[K]>;
};

// Type inference assigns the appropriate config type to each field
const formConfig: UserFormConfig = {
  name: {
    type: "text",        // only "text" | "email" | "password" | "url" allowed
    label: "Name",
    defaultValue: "",
    rules: [
      { validate: (v) => v.length > 0, message: "String cannot be empty" },
    ],
  },
  age: {
    type: "number",      // only "number" | "range" | "slider" allowed
    label: "Age",
    defaultValue: 0,
    rules: [
      { validate: (v) => v >= 0, message: "Number must be 0 or greater" },
    ],
  },
  email: {
    type: "email",
    label: "Email Address",
    defaultValue: "",
  },
};
```

---

## 8. Best Practices for Conditional Types in Practice

### 8.1 Incremental Type Design

```typescript
// GOOD: split a complex conditional type into small pieces

// Step 1: basic decision types
type IsArray<T> = T extends any[] ? true : false;
type IsFunction<T> = T extends (...args: any[]) => any ? true : false;
type IsObject<T> = T extends object
  ? T extends any[]
    ? false
    : T extends (...args: any[]) => any
      ? false
      : true
  : false;

// Step 2: transformation types
type Writable<T> = { -readonly [K in keyof T]: T[K] };
type DeepWritable<T> =
  IsFunction<T> extends true ? T :
  IsArray<T> extends true ? { [K in keyof T]: DeepWritable<T[K]> } :
  IsObject<T> extends true ? { -readonly [K in keyof T]: DeepWritable<T[K]> } :
  T;

// Step 3: combined types
type Mutable<T, Deep extends boolean = false> =
  Deep extends true ? DeepWritable<T> : Writable<T>;

// Usage example
interface ReadonlyConfig {
  readonly host: string;
  readonly port: number;
  readonly db: {
    readonly name: string;
    readonly options: {
      readonly ssl: boolean;
    };
  };
}

type ShallowMutable = Mutable<ReadonlyConfig, false>;
// { host: string; port: number; db: { readonly name: string; ... } }

type DeepMutable = Mutable<ReadonlyConfig, true>;
// { host: string; port: number; db: { name: string; options: { ssl: boolean } } }
```

### 8.2 Naming Conventions for Conditional Types

```typescript
// Best practices for naming conventions

// 1. Is- prefix: types that return a boolean
type IsString<T> = T extends string ? true : false;
type IsNullable<T> = null extends T ? true : false;
type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

// 2. Extract / Get prefix: types that extract a part
type ExtractArrayElement<T> = T extends (infer U)[] ? U : never;
type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// 3. To / As prefix: types that transform
type ToArray<T> = T extends any ? T[] : never;
type ToPromise<T> = T extends any ? Promise<T> : never;
type AsReadonly<T> = { readonly [K in keyof T]: T[K] };

// 4. Without / Omit prefix: types that exclude
type WithoutNullable<T> = T extends null | undefined ? never : T;
type WithoutFunctions<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

// 5. Deep prefix: types that apply recursively
type DeepReadonly<T> = /* ... */;
type DeepPartial<T> = /* ... */;
type DeepRequired<T> = /* ... */;
```

### 8.3 Improving Error Messages

```typescript
// Provide custom error messages with conditional types

// Basic approach: return a type containing an error message instead of never
type MustBeString<T> =
  T extends string
    ? T
    : { __error: `Expected string but got ${T & string}` };

// More advanced approach: express error messages with branded types
type TypeError<Message extends string> = { readonly __typeError: Message } & never;

type SafeDivide<A extends number, B extends number> =
  B extends 0
    ? TypeError<"Division by zero is not allowed">
    : number;

// On use
type Result1 = SafeDivide<10, 2>;  // number
type Result2 = SafeDivide<10, 0>;  // TypeError<"Division by zero is not allowed">

// Report violations of type constraints in a clear way
type ValidateConfig<T> =
  T extends { host: string }
    ? T extends { port: number }
      ? T
      : TypeError<"Config must include 'port' as number">
    : TypeError<"Config must include 'host' as string">;
```

---

## Comparison of Built-in Conditional Types

| Utility Type | Definition | Use |
|-----------------|------|------|
| `NonNullable<T>` | `T extends null \| undefined ? never : T` | Excludes null/undefined |
| `Extract<T, U>` | `T extends U ? T : never` | Extracts specific types from a union |
| `Exclude<T, U>` | `T extends U ? never : T` | Excludes specific types from a union |
| `ReturnType<T>` | `T extends (...) => infer R ? R : any` | Gets the return type of a function |
| `Parameters<T>` | `T extends (...args: infer P) => any ? P : never` | Gets the parameter types of a function |
| `InstanceType<T>` | `T extends new (...) => infer R ? R : any` | Gets the instance type of a constructor |
| `ConstructorParameters<T>` | `T extends new (...args: infer P) => any ? P : never` | Gets the parameter types of a constructor |
| `Awaited<T>` | Recursively unwraps Promises | Gets the type after a Promise resolves |
| `ThisParameterType<T>` | `T extends (this: infer U, ...) => any ? U : unknown` | Gets the type of the `this` parameter |
| `OmitThisParameter<T>` | Removes the `this` parameter | Function type without `this` |

---

## Distributive vs Non-distributive Comparison

| Characteristic | Distributive Conditional Type | Non-distributive Conditional Type |
|------|-----------|-------------|
| Syntax | `T extends U ? X : Y` | `[T] extends [U] ? X : Y` |
| Union input | applied to each member individually | evaluated as the entire union |
| `string \| number` | `F<string> \| F<number>` | `F<string \| number>` |
| Handling of never | returns never | evaluated normally |
| Main use | filtering, type transformation | judging the entire union, detecting never |

```
  Distributive
  ToArray<string | number>
    → ToArray<string> | ToArray<number>
    → string[] | number[]

  Non-distributive
  ToArrayNonDist<string | number>
    → (string | number)[]

  Difference in handling of never
  Distributive: Test<never> → never
  Non-distributive: [never] extends [string] ? true : false → true
```

---

## Anti-patterns

### Anti-pattern 1: Overly complex conditional types

```typescript
// BAD: unreadable nested conditional types
type ComplexType<T> =
  T extends string
    ? T extends `${infer A}.${infer B}`
      ? A extends `${infer C}-${infer D}`
        ? [C, D, B]
        : [A, B]
      : [T]
    : never;

// GOOD: split into named types step by step
type SplitDot<T extends string> =
  T extends `${infer A}.${infer B}` ? [A, B] : [T];

type SplitDash<T extends string> =
  T extends `${infer A}-${infer B}` ? [A, B] : [T];

// Combine them (the meaning of each step is clear)
type ParseSegment<T extends string> =
  SplitDot<T> extends [infer First extends string, infer Second]
    ? [...SplitDash<First>, Second]
    : SplitDot<T>;
```

### Anti-pattern 2: Ignoring recursion depth limits

```typescript
// BAD: a type that approaches infinite recursion (compilation becomes very slow)
type InfiniteNest<T> = {
  value: T;
  children: InfiniteNest<T>[];
};

// GOOD: limit the recursion depth
type Nest<T, Depth extends number[] = []> =
  Depth["length"] extends 5
    ? T
    : {
        value: T;
        children: Nest<T, [...Depth, 0]>[];
      };
```

### Anti-pattern 3: Using conditional types unnecessarily

```typescript
// BAD: cases where a conditional type is unneeded
type Unnecessary<T> = T extends any ? T : never;
// Just returns T as-is (it has no meaning beyond union expansion via distribution)

// BAD: using a conditional type for simple mapping
type BadMapping<T> =
  T extends "a" ? 1 :
  T extends "b" ? 2 :
  T extends "c" ? 3 :
  never;

// GOOD: use a record type
type GoodMapping = {
  a: 1;
  b: 2;
  c: 3;
};
type Mapped<T extends keyof GoodMapping> = GoodMapping[T];
```

### Anti-pattern 4: Over-relying on type assertions

```typescript
// BAD: always overriding the conditional-type result with an assertion
function process<T extends string | number>(value: T) {
  // Cannot leverage the result of the conditional type
  const result = transform(value) as any;
  return result;
}

// GOOD: use type narrowing in concert with the conditional type
function processGood<T extends string | number>(
  value: T
): T extends string ? string[] : number {
  if (typeof value === "string") {
    return value.split(",") as T extends string ? string[] : number;
  }
  return (value as number) * 2 as T extends string ? string[] : number;
}
// Note: assertions are required for the conditional-type return value, but keep them minimal
```

### Anti-pattern 5: Unexpected behavior of distribution

```typescript
// BAD: passing a union without being aware of distribution
type Wrapper<T> = T extends any ? { value: T } : never;
type Result = Wrapper<string | number>;
// { value: string } | { value: number } (may differ from intent)

// GOOD: make intent clear
// When you want to wrap the entire union
type WrapperUnion<T> = [T] extends [any] ? { value: T } : never;
type ResultUnion = WrapperUnion<string | number>;
// { value: string | number }

// When you intentionally want to wrap each individually (using distribution on purpose)
type WrapperDist<T> = T extends any ? { value: T } : never;
type ResultDist = WrapperDist<string | number>;
// { value: string } | { value: number }
```

---

## FAQ

### Q1: Where are conditional types most effective?

**A:** They are most effective in library type definitions and API type transformations (such as automatically deriving response types). In application code, the built-in utility types `ReturnType`, `Parameters`, `Awaited`, etc., are often enough. Specific places where they are useful:

- Library public-API type definitions
- Transforming API response types (e.g., snake_case -> camelCase)
- Auto-generating action types for state management
- Type-safe definitions for form validation
- Extracting routing parameter types

### Q2: Can `infer` only be used inside conditional types?

**A:** Yes, `infer` can only be used inside an `extends` clause. It is valid only in the form `T extends ... infer U ... ? X : Y`. To "extract" a type outside a conditional type, you have to define a separate conditional type.

```typescript
// infer must be inside an extends clause
type GetFirst<T> = T extends [infer F, ...any[]] ? F : never;

// The following errors
// type Invalid<T> = infer U;  // error: infer can only be used inside conditional types
```

### Q3: How is `never` handled in distributive conditional types?

**A:** `never` is treated as an empty union, so when `never` is passed to a distributive conditional type, the result is also `never`.

```typescript
type Test<T> = T extends string ? "yes" : "no";
type Result = Test<never>; // never (neither "yes" nor "no")

// To detect never properly, switch to non-distributive
type IsNever<T> = [T] extends [never] ? true : false;
type Check = IsNever<never>; // true
```

### Q4: What can I do when conditional types cause slow compile times?

**A:** The following measures are effective:

1. **Limit recursion depth** -- manage depth with a counter tuple
2. **Avoid union explosion** -- be careful not to generate large unions via distribution
3. **Cache types** -- store intermediate results in type aliases
4. **Split conditional types** -- do not pack too much into a single conditional type
5. **Create test type instances with `declare`** -- check without running a full build

### Q5: What is the difference between conditional types and type predicates (type guards)?

**A:** Conditional types are a compile-time mechanism for transforming types, while type guards narrow types at runtime based on value checks.

```typescript
// Conditional type: compile time
type IsString<T> = T extends string ? true : false;

// Type guard: runtime
function isString(value: unknown): value is string {
  return typeof value === "string";
}

// Pattern combining both
function processValue<T>(value: T): T extends string ? string[] : T {
  if (isString(value)) {
    return value.split(",") as any;
  }
  return value as any;
}
```

### Q6: What should I be aware of when using multiple `infer`s in a conditional type?

**A:** When you use the same `infer` variable name in multiple positions, they are inferred as a union if they are in covariant positions and as an intersection if they are in contravariant positions. To avoid unexpected results, use different names or be aware of the position when designing.

```typescript
// Multiple inferred U in covariant positions → union
type CovariantInfer<T> =
  T extends { a: infer U; b: infer U } ? U : never;

type R1 = CovariantInfer<{ a: string; b: number }>;  // string | number

// Use different names to extract individually
type SeparateInfer<T> =
  T extends { a: infer A; b: infer B } ? [A, B] : never;

type R2 = SeparateInfer<{ a: string; b: number }>;  // [string, number]
```

### Q7: How have conditional types differed across TypeScript versions?

**A:** Major evolutionary milestones:

- **TypeScript 2.8**: introduction of conditional types (`T extends U ? X : Y`)
- **TypeScript 4.1**: introduction of template literal types, enabling string manipulation
- **TypeScript 4.5**: relaxed recursion limits (up to 1000 levels), tail-call optimization
- **TypeScript 4.7**: ability to add `extends` constraints on `infer` (`infer U extends string`)
- **TypeScript 4.9**: introduction of the `satisfies` operator (improves type safety when used with conditional types)
- **TypeScript 5.0**: introduction of const type parameters

```typescript
// TypeScript 4.7+: add a constraint on infer
type FirstIfString<T> =
  T extends [infer F extends string, ...any[]]
    ? F
    : never;

type R1 = FirstIfString<["hello", 42]>;  // "hello"
type R2 = FirstIfString<[42, "hello"]>;  // never
```

---

## Summary

| Item | Content |
|------|------|
| Conditional type | Type-level conditional branching with `T extends U ? X : Y` |
| infer | Keyword that extracts types via pattern matching |
| Distributive conditional type | Applies the conditional type individually to each member of a union |
| Non-distributive | Suppresses distribution with `[T] extends [U]` |
| Recursive conditional type | Used for type transformations of deeply nested structures |
| Built-in types | ReturnType, Parameters, Awaited, Extract, Exclude, etc. |
| Covariance / contravariance | Position of infer determines whether a union or intersection is inferred |
| Performance | Beware of recursion depth and union size |
| Debugging | Make use of test utilities like Equal and Expect |
| Best practice | Split into small pieces, unify naming conventions, improve error messages |

---

## Recommended Next Reading

- [01-mapped-types.md](./01-mapped-types.md) -- Mapped types
- [02-template-literal-types.md](./02-template-literal-types.md) -- Template literal types
- [03-type-challenges.md](./03-type-challenges.md) -- Type puzzles and challenges

---

## References

1. **TypeScript Handbook: Conditional Types** -- https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
2. **TypeScript Deep Dive: Conditional Types** -- https://basarat.gitbook.io/typescript/type-system/conditional-types
3. **Matt Pocock: Conditional Types in TypeScript** -- https://www.totaltypescript.com/books/total-typescript-essentials/conditional-types-and-infer
4. **TypeScript Release Notes** -- https://www.typescriptlang.org/docs/handbook/release-notes/overview.html
5. **Type-Level TypeScript** -- https://type-level-typescript.com/
6. **TypeScript Type Challenges** -- https://github.com/type-challenges/type-challenges
