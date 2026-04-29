# Type Challenges

> Walks through representative Type Challenges problems to build practical skill in type-level programming. Master the solution patterns for practical type puzzles.

## What you will learn in this chapter

1. **Fundamental techniques of type-level programming** -- recursion, pattern matching, accumulators
2. **Easy challenges** -- Pick, Readonly, TupleToUnion, Last, Includes, etc.
3. **Medium challenges** -- DeepReadonly, Flatten, StringToUnion, CamelCase, Chainable, etc.
4. **Hard challenges** -- type-level arithmetic, parsers, Union manipulation, etc.
5. **Application to real work** -- how to apply type-puzzle techniques in production code


## Prerequisites

Reading this guide will be more rewarding if you have the following knowledge:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with [Template Literal Types](./02-template-literal-types.md)

---

## 1. Fundamental Techniques of Type-Level Programming

### 1.1 List of Key Techniques

```
+------------------+-------------------------------+------------------------+
| Technique        | Purpose                       | Syntax used            |
+------------------+-------------------------------+------------------------+
| Conditional type | Type branching                | T extends U ? X : Y    |
| infer            | Type extraction               | T extends F<infer U>   |
| Recursion        | Repetitive processing         | Type<T> = ... Type<U>  |
| Tuple operations | Length count, looping         | [...T, U], T["length"] |
| String ops       | Pattern matching              | `${infer H}${infer T}` |
| Mapped type      | Property transformation       | { [K in keyof T]: ... }|
| Key Remapping    | Renaming keys                 | [K in ... as ...]      |
| Distributive     | Apply to each union member    | T extends any ? F<T>   |
| Tuple → Union    | Array type to union type      | T[number]              |
| Union → Intersect| Union type to intersection    | infer in contravariant |
+------------------+-------------------------------+------------------------+
```

### 1.2 Utility Types for Testing

The following utility types are used to verify solutions to type challenges.

```typescript
// Determine whether two types are equal (the most accurate implementation)
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

// Type that expects Equal to be true (compile error if false)
type Expect<T extends true> = T;

// Type that expects Equal to be false
type ExpectFalse<T extends false> = T;

// Test examples
type Test1 = Expect<Equal<1, 1>>;           // OK
type Test2 = Expect<Equal<"a", "a">>;       // OK
// type Test3 = Expect<Equal<1, 2>>;         // Compile error (as expected)
// type Test4 = Expect<Equal<string, number>>; // Compile error (as expected)

// Not type: invert a boolean
type Not<T extends boolean> = T extends true ? false : true;

// Tests
type Test5 = Expect<Not<false>>;            // OK
type Test6 = ExpectFalse<Not<true>>;        // OK
```

### 1.3 Counters Using Tuples

```typescript
// Type-level numeric operations use the length of a tuple
type Length<T extends readonly unknown[]> = T["length"];

type A = Length<[1, 2, 3]>;  // 3
type B = Length<[]>;          // 0

// Build a tuple of the specified length
type BuildTuple<N extends number, T extends unknown[] = []> =
  T["length"] extends N ? T : BuildTuple<N, [...T, unknown]>;

type Tuple3 = BuildTuple<3>;   // [unknown, unknown, unknown]
type Tuple5 = BuildTuple<5>;   // [unknown, unknown, unknown, unknown, unknown]

// Type-level addition
type Add<A extends number, B extends number> =
  [...BuildTuple<A>, ...BuildTuple<B>]["length"] & number;

type Sum = Add<3, 4>;  // 7

// Type-level subtraction
type Subtract<A extends number, B extends number> =
  BuildTuple<A> extends [...BuildTuple<B>, ...infer Rest]
    ? Rest["length"]
    : never;  // never when B > A

type Diff = Subtract<7, 3>;  // 4

// Type-level multiplication
type Multiply<
  A extends number,
  B extends number,
  Acc extends unknown[] = []
> = B extends 0
  ? 0
  : BuildTuple<B> extends [unknown, ...infer Rest]
    ? Multiply<A, Rest["length"] & number, [...Acc, ...BuildTuple<A>]>
    : Acc["length"] & number;

type Product = Multiply<3, 4>;  // 12

// Type-level comparison
type GreaterThanOrEqual<
  A extends number,
  B extends number,
  Count extends unknown[] = []
> = Count["length"] extends A
  ? Count["length"] extends B
    ? true  // A === B
    : false // Count reached A first, A < B
  : Count["length"] extends B
    ? true  // Count reached B first, A > B
    : GreaterThanOrEqual<A, B, [...Count, unknown]>;
```

### 1.4 Recursion Patterns

```typescript
// Pattern 1: Recursive array processing (from the head)
type ProcessArray<T extends unknown[]> =
  T extends [infer First, ...infer Rest]
    ? /* process First */ [First, ...ProcessArray<Rest>]
    : [];

// Pattern 2: Recursive array processing (from the tail)
type ProcessFromEnd<T extends unknown[]> =
  T extends [...infer Init, infer Last]
    ? [...ProcessFromEnd<Init>, Last]
    : [];

// Pattern 3: Accumulator pattern (accumulate the result)
type Accumulate<
  T extends unknown[],
  Acc extends unknown[] = []  // accumulate the result
> = T extends [infer First, ...infer Rest]
  ? Accumulate<Rest, [...Acc, First]>
  : Acc;

// Pattern 4: Recursive string processing
type ProcessString<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? `${First}${ProcessString<Rest>}`
    : "";

// Pattern 5: Recursion with depth limit
type LimitedRecursion<
  T,
  Depth extends unknown[] = []
> = Depth["length"] extends 10
  ? T  // stop at the depth limit
  : T extends object
    ? { [K in keyof T]: LimitedRecursion<T[K], [...Depth, unknown]> }
    : T;

// Pattern 6: Efficient recursion via halving
// Allows deeper recursion than linear recursion
type DeepBuild<
  N extends number,
  T extends unknown[] = [unknown]
> = T["length"] extends N
  ? T
  : DeepBuild<N, [...T, ...T]> extends infer R extends unknown[]
    ? R["length"] extends N
      ? R
      : /* trim excess */ R
    : never;
```

---

## 2. Easy Challenges

### 2.1 MyPick (implement Pick yourself)

```typescript
// Task: Implement Pick<T, K> yourself
// Requirement: select only the properties specified by K from T

type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// Test
interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

type TodoPreview = MyPick<Todo, "title" | "completed">;
// { title: string; completed: boolean }

// Verification
type TestPick1 = Expect<Equal<
  MyPick<Todo, "title">,
  { title: string }
>>;
type TestPick2 = Expect<Equal<
  MyPick<Todo, "title" | "completed">,
  { title: string; completed: boolean }
>>;

// Explanation:
// - K extends keyof T constrains K to keys of T
// - [P in K] iterates over members of K
// - T[P] reuses the original type's value as-is
```

### 2.2 MyReadonly

```typescript
// Task: Implement Readonly<T> yourself
// Requirement: make all properties of T readonly

type MyReadonly<T> = {
  readonly [K in keyof T]: T[K];
};

// Test
type ReadonlyTodo = MyReadonly<Todo>;
// { readonly title: string; readonly description: string; readonly completed: boolean }

type TestReadonly = Expect<Equal<
  MyReadonly<Todo>,
  { readonly title: string; readonly description: string; readonly completed: boolean }
>>;
```

### 2.3 TupleToUnion

```typescript
// Task: Convert a tuple type to a union type
// Requirement: [1, 2, 3] -> 1 | 2 | 3

type TupleToUnion<T extends readonly unknown[]> = T[number];

type A = TupleToUnion<[1, 2, 3]>;        // 1 | 2 | 3
type B = TupleToUnion<["a", "b", "c"]>;   // "a" | "b" | "c"
type C = TupleToUnion<[string, number]>;   // string | number

// Verification
type TestTTU = Expect<Equal<TupleToUnion<[1, 2, 3]>, 1 | 2 | 3>>;

// Explanation:
// T[number] is the index signature of an array type, returning the union of all element types
// For [1, 2, 3]: [1, 2, 3][number] = 1 | 2 | 3

// Recursive version (for deeper understanding)
type TupleToUnionRecursive<T extends readonly unknown[]> =
  T extends [infer First, ...infer Rest]
    ? First | TupleToUnionRecursive<Rest>
    : never;
```

### 2.4 First

```typescript
// Task: Get the type of the first element of an array
// Requirement: First<[3, 2, 1]> = 3, First<[]> = never

// Solution 1: use infer
type First<T extends readonly unknown[]> =
  T extends [infer F, ...unknown[]] ? F : never;

// Solution 2: empty array check via conditional type
type First2<T extends readonly unknown[]> =
  T extends [] ? never : T[0];

// Solution 3: use T["length"]
type First3<T extends readonly unknown[]> =
  T["length"] extends 0 ? never : T[0];

type D = First<[3, 2, 1]>;  // 3
type E = First<[]>;          // never
type F = First<[undefined]>; // undefined

// Verification
type TestFirst1 = Expect<Equal<First<[3, 2, 1]>, 3>>;
type TestFirst2 = Expect<Equal<First<[]>, never>>;
type TestFirst3 = Expect<Equal<First<[undefined]>, undefined>>;
```

### 2.5 Last

```typescript
// Task: Get the type of the last element of an array
// Requirement: Last<[1, 2, 3]> = 3

type Last<T extends readonly unknown[]> =
  T extends [...unknown[], infer L] ? L : never;

type G = Last<[1, 2, 3]>;  // 3
type H = Last<["a"]>;       // "a"
type I = Last<[]>;           // never

// Verification
type TestLast1 = Expect<Equal<Last<[1, 2, 3]>, 3>>;
type TestLast2 = Expect<Equal<Last<["a"]>, "a">>;
type TestLast3 = Expect<Equal<Last<[]>, never>>;

// Explanation:
// [...unknown[], infer L] is the pattern for "extract the last element as L"
// Leverages Variadic Tuple Types from TypeScript 4.0+
```

### 2.6 Includes

```typescript
// Task: Determine whether an array contains U
// Requirement: Includes<[1, 2, 3], 2> = true

// Strict equality check (IsEqual)
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Includes<T extends readonly unknown[], U> =
  T extends [infer First, ...infer Rest]
    ? IsEqual<First, U> extends true
      ? true
      : Includes<Rest, U>
    : false;

type J = Includes<[1, 2, 3], 2>;       // true
type K = Includes<[1, 2, 3], 4>;       // false
type L = Includes<["a", "b"], "a">;     // true
type M = Includes<[true, false], true>; // true
type N = Includes<[boolean], true>;     // false (boolean !== true)

// Verification
type TestInc1 = Expect<Equal<Includes<[1, 2, 3], 2>, true>>;
type TestInc2 = Expect<Equal<Includes<[1, 2, 3], 4>, false>>;
type TestInc3 = Expect<Equal<Includes<[boolean], true>, false>>;

// Explanation:
// IsEqual performs strict type comparison via the (<T>() => T extends X ? 1 : 2) pattern
// Plain extends comparison would consider boolean and true equivalent,
// so this special pattern is required
```

### 2.7 Push and Unshift

```typescript
// Task: Push<T, U> - append an element to the end of an array
type Push<T extends unknown[], U> = [...T, U];

type P1 = Push<[1, 2], 3>;       // [1, 2, 3]
type P2 = Push<[], 1>;            // [1]

// Task: Unshift<T, U> - prepend an element to the beginning of an array
type Unshift<T extends unknown[], U> = [U, ...T];

type U1 = Unshift<[1, 2], 0>;    // [0, 1, 2]
type U2 = Unshift<[], 1>;         // [1]

// Task: Pop<T> - remove the last element of an array
type Pop<T extends unknown[]> =
  T extends [...infer Init, unknown] ? Init : [];

type Pop1 = Pop<[1, 2, 3]>;  // [1, 2]
type Pop2 = Pop<[1]>;         // []
type Pop3 = Pop<[]>;           // []

// Task: Shift<T> - remove the first element of an array
type Shift<T extends unknown[]> =
  T extends [unknown, ...infer Rest] ? Rest : [];

type Shift1 = Shift<[1, 2, 3]>;  // [2, 3]
type Shift2 = Shift<[1]>;         // []
```

### 2.8 Concat

```typescript
// Task: Concat<T, U> - concatenate two arrays
type Concat<T extends unknown[], U extends unknown[]> = [...T, ...U];

type C1 = Concat<[1, 2], [3, 4]>;     // [1, 2, 3, 4]
type C2 = Concat<[], [1]>;             // [1]
type C3 = Concat<[1], []>;             // [1]

// Verification
type TestConcat = Expect<Equal<Concat<[1, 2], [3, 4]>, [1, 2, 3, 4]>>;
```

### 2.9 If

```typescript
// Task: If<C, T, F> - T if C is true, F if C is false
type If<C extends boolean, T, F> = C extends true ? T : F;

type If1 = If<true, "a", "b">;   // "a"
type If2 = If<false, "a", "b">;  // "b"

// Verification
type TestIf1 = Expect<Equal<If<true, "a", "b">, "a">>;
type TestIf2 = Expect<Equal<If<false, "a", "b">, "b">>;
```

### 2.10 Awaited

```typescript
// Task: Get the type that a Promise resolves to
// Requirement: Recursively unwrap nested Promises

type MyAwaited<T> =
  T extends Promise<infer U>
    ? U extends Promise<any>
      ? MyAwaited<U>  // recursively unwrap nested Promises
      : U
    : never;

type Aw1 = MyAwaited<Promise<string>>;            // string
type Aw2 = MyAwaited<Promise<Promise<number>>>;    // number
type Aw3 = MyAwaited<Promise<Promise<Promise<boolean>>>>; // boolean

// A simpler implementation
type MyAwaited2<T> =
  T extends Promise<infer U> ? MyAwaited2<U> : T;

// Verification
type TestAwaited = Expect<Equal<MyAwaited<Promise<string>>, string>>;
```

### Solution Patterns for Easy Challenges

```
  Problem type           Technique used         Typical example
+-------------------+----------------------+------------------+
| Property transform | Mapped type          | Pick, Readonly   |
| Head/tail of array | infer + rest         | First, Last      |
| Array -> Union     | Index access         | TupleToUnion     |
| Element search     | Recursion + IsEqual  | Includes         |
| Length             | T["length"]          | Length           |
| Array operations   | Spread syntax        | Push, Concat     |
| Conditional        | Conditional type     | If, Awaited      |
| Promise unwrap     | infer + recursion    | Awaited          |
+-------------------+----------------------+------------------+
```

---

## 3. Medium Challenges

### 3.1 DeepReadonly

```typescript
// Task: Make all nested properties readonly
type DeepReadonly<T> =
  T extends (...args: any[]) => any
    ? T  // leave functions as-is
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;  // leave primitives as-is

// Test
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
}

type ReadonlyConfig = DeepReadonly<Config>;
// All nested properties are readonly

// Verification
type TestDeepReadonly = Expect<Equal<
  DeepReadonly<{ a: { b: string } }>,
  { readonly a: { readonly b: string } }
>>;

// Explanation:
// 1. Do not recurse into functions (avoid infinite loops)
// 2. For object types, apply DeepReadonly recursively
// 3. Return primitives (string, number, etc.) as-is
```

### 3.2 Flatten

```typescript
// Task: Flatten a nested array type
type Flatten<T extends unknown[]> =
  T extends [infer First, ...infer Rest]
    ? First extends unknown[]
      ? [...Flatten<First>, ...Flatten<Rest>]
      : [First, ...Flatten<Rest>]
    : [];

type F1 = Flatten<[1, [2, [3]], 4]>;    // [1, 2, 3, 4]
type F2 = Flatten<[[1, 2], [3, 4]]>;    // [1, 2, 3, 4]
type F3 = Flatten<[1, 2, 3]>;           // [1, 2, 3] (unchanged if already flat)
type F4 = Flatten<[]>;                   // []

// Verification
type TestFlatten = Expect<Equal<Flatten<[1, [2, [3]], 4]>, [1, 2, 3, 4]>>;

// Flatten with depth limit
type FlattenDepth<
  T extends unknown[],
  Depth extends number = 1,
  Counter extends unknown[] = []
> = Counter["length"] extends Depth
  ? T
  : T extends [infer First, ...infer Rest]
    ? First extends unknown[]
      ? [...FlattenDepth<First, Depth, [...Counter, unknown]>, ...FlattenDepth<Rest, Depth, Counter>]
      : [First, ...FlattenDepth<Rest, Depth, Counter>]
    : T;

type FD1 = FlattenDepth<[1, [2, [3, [4]]]], 1>;  // [1, 2, [3, [4]]]
type FD2 = FlattenDepth<[1, [2, [3, [4]]]], 2>;  // [1, 2, 3, [4]]
```

### 3.3 Chainable

```typescript
// Task: Chainable option configuration
// Requirements:
// - option(key, value) adds a setting
// - Setting the same key twice is an error
// - get() returns the final type

type Chainable<T = {}> = {
  option<K extends string, V>(
    key: K extends keyof T ? never : K,
    value: V
  ): Chainable<Omit<T, K> & Record<K, V>>;
  get(): T;
};

// Usage
declare const config: Chainable;
const result = config
  .option("name", "TypeScript")
  .option("version", 5)
  .option("strict", true)
  .get();
// type: { name: string; version: number; strict: boolean }

// Explanation:
// 1. Chainable<T> holds the type T of options set so far
// 2. option() returns a Chainable with the new key and value added to T
// 3. K extends keyof T ? never : K prevents duplicate keys
// 4. get() returns the accumulated type T
```

### 3.4 StringToUnion

```typescript
// Task: Convert a string to a union type
type StringToUnion<S extends string> =
  S extends `${infer C}${infer Rest}`
    ? C | StringToUnion<Rest>
    : never;

type STU1 = StringToUnion<"hello">;  // "h" | "e" | "l" | "o"
type STU2 = StringToUnion<"abc">;    // "a" | "b" | "c"
type STU3 = StringToUnion<"">;       // never

// Verification
type TestSTU = Expect<Equal<StringToUnion<"abc">, "a" | "b" | "c">>;

// Note: the result of "hello" contains only one "l" (unions deduplicate)
```

### 3.5 Trim

```typescript
// Task: Remove whitespace from both ends of a string
type TrimLeft<S extends string> =
  S extends `${" " | "\n" | "\t"}${infer Rest}`
    ? TrimLeft<Rest>
    : S;

type TrimRight<S extends string> =
  S extends `${infer Rest}${" " | "\n" | "\t"}`
    ? TrimRight<Rest>
    : S;

type Trim<S extends string> = TrimLeft<TrimRight<S>>;

type T1 = Trim<"  hello  ">;   // "hello"
type T2 = Trim<"\nhello\n">;   // "hello"
type T3 = Trim<"\t hello \t">; // "hello"

// Verification
type TestTrim = Expect<Equal<Trim<"  hello  ">, "hello">>;
```

### 3.6 Replace and ReplaceAll

```typescript
// Task: Replace the first match in a string
type Replace<S extends string, From extends string, To extends string> =
  From extends ""
    ? S
    : S extends `${infer Before}${From}${infer After}`
      ? `${Before}${To}${After}`
      : S;

type R1 = Replace<"types are fun!", "fun", "awesome">;  // "types are awesome!"
type R2 = Replace<"foobar", "bar", "baz">;               // "foobaz"
type R3 = Replace<"foobar", "", "baz">;                   // "foobar"

// Task: Replace all matches in a string
type ReplaceAll<S extends string, From extends string, To extends string> =
  From extends ""
    ? S
    : S extends `${infer Before}${From}${infer After}`
      ? ReplaceAll<`${Before}${To}${After}`, From, To>
      : S;

type RA1 = ReplaceAll<"t y p e s", " ", "">;  // "types"
type RA2 = ReplaceAll<"aaa", "a", "b">;        // "bbb"
```

### 3.7 Reverse

```typescript
// Task: Reverse a tuple
type Reverse<T extends unknown[]> =
  T extends [infer First, ...infer Rest]
    ? [...Reverse<Rest>, First]
    : [];

type Rev1 = Reverse<[1, 2, 3]>;       // [3, 2, 1]
type Rev2 = Reverse<["a", "b", "c"]>; // ["c", "b", "a"]
type Rev3 = Reverse<[]>;               // []

// Verification
type TestReverse = Expect<Equal<Reverse<[1, 2, 3]>, [3, 2, 1]>>;

// String reverse
type ReverseString<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? `${ReverseString<Rest>}${First}`
    : "";

type RS1 = ReverseString<"hello">;  // "olleh"
```

### 3.8 Implementing Omit

```typescript
// Task: Implement Omit<T, K> yourself
// Approach 1: Pick + Exclude
type MyOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// Approach 2: Mapped type + as clause
type MyOmit2<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};

// Test
type OmitTest = MyOmit<Todo, "description">;
// { title: string; completed: boolean }

// Verification
type TestOmit = Expect<Equal<
  MyOmit<Todo, "description">,
  { title: string; completed: boolean }
>>;
```

### 3.9 Implementing ReturnType

```typescript
// Task: Implement ReturnType<T> yourself
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

type RT1 = MyReturnType<() => string>;            // string
type RT2 = MyReturnType<(x: number) => boolean>;  // boolean
type RT3 = MyReturnType<() => void>;               // void

// Verification
type TestRT = Expect<Equal<MyReturnType<() => string>, string>>;
```

### 3.10 Implementing Parameters

```typescript
// Task: Implement Parameters<T> yourself
type MyParameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;

type Params1 = MyParameters<(a: string, b: number) => void>;  // [a: string, b: number]
type Params2 = MyParameters<() => void>;                        // []

// Verification
type TestParams = Expect<Equal<
  MyParameters<(a: string, b: number) => void>,
  [a: string, b: number]
>>;
```

---

## 4. Hard Challenges

### 4.1 CamelCase

```typescript
// Task: Convert kebab-case to camelCase
type CamelCase<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? Tail extends Capitalize<Tail>
      ? `${Head}-${CamelCase<Tail>}`  // keep '-' if already starts with uppercase
      : `${Head}${CamelCase<Capitalize<Tail>>}`
    : S;

type CC1 = CamelCase<"foo-bar-baz">;       // "fooBarBaz"
type CC2 = CamelCase<"hello-world">;        // "helloWorld"
type CC3 = CamelCase<"no-dash">;            // "noDash"
type CC4 = CamelCase<"already">;            // "already" (no dash)

// A stricter implementation
type CamelCase2<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Lowercase<Head>}${CamelCase2<Capitalize<Tail>>}`
    : S;

// Convert object keys to CamelCase
type CamelCaseKeys<T> = {
  [K in keyof T as K extends string ? CamelCase2<K> : K]:
    T[K] extends object
      ? T[K] extends any[]
        ? T[K]
        : CamelCaseKeys<T[K]>
      : T[K];
};

interface ApiResponse {
  "user-name": string;
  "created-at": string;
  "is-active": boolean;
  "profile-data": {
    "avatar-url": string;
    "display-name": string;
  };
}

type CamelResponse = CamelCaseKeys<ApiResponse>;
// {
//   userName: string;
//   createdAt: string;
//   isActive: boolean;
//   profileData: {
//     avatarUrl: string;
//     displayName: string;
//   };
// }
```

### 4.2 Unique

```typescript
// Task: Remove duplicates from a tuple
type Unique<T extends unknown[], Seen extends unknown[] = []> =
  T extends [infer First, ...infer Rest]
    ? Includes<Seen, First> extends true
      ? Unique<Rest, Seen>
      : Unique<Rest, [...Seen, First]>
    : Seen;

type U1 = Unique<[1, 1, 2, 2, 3, 3]>;           // [1, 2, 3]
type U2 = Unique<[1, "a", 2, "b", 2, "a"]>;      // [1, "a", 2, "b"]
type U3 = Unique<[string, string, number]>;        // [string, number]

// Verification
type TestUnique = Expect<Equal<Unique<[1, 1, 2, 2, 3, 3]>, [1, 2, 3]>>;
```

### 4.3 Zip

```typescript
// Task: Pair up two arrays
type Zip<
  T extends unknown[],
  U extends unknown[]
> = T extends [infer TFirst, ...infer TRest]
  ? U extends [infer UFirst, ...infer URest]
    ? [[TFirst, UFirst], ...Zip<TRest, URest>]
    : []
  : [];

type Z1 = Zip<[1, 2, 3], ["a", "b", "c"]>;
// [[1, "a"], [2, "b"], [3, "c"]]

type Z2 = Zip<[1, 2], ["a", "b", "c"]>;
// [[1, "a"], [2, "b"]] (matches the shorter one)

// Verification
type TestZip = Expect<Equal<
  Zip<[1, 2, 3], ["a", "b", "c"]>,
  [[1, "a"], [2, "b"], [3, "c"]]
>>;
```

### 4.4 GroupBy

```typescript
// Task: Group an array by a condition
type GroupBy<
  T extends Record<string, any>[],
  Key extends string
> = {
  [V in T[number][Key]]: Extract<T[number], Record<Key, V>>[];
};

type Items = [
  { type: "a"; value: 1 },
  { type: "b"; value: 2 },
  { type: "a"; value: 3 },
];

type Grouped = GroupBy<Items, "type">;
// {
//   a: ({ type: "a"; value: 1 } | { type: "a"; value: 3 })[];
//   b: { type: "b"; value: 2 }[];
// }
```

### 4.5 TupleToNestedObject

```typescript
// Task: Build a nested object type from a tuple
type TupleToNestedObject<
  T extends string[],
  V
> = T extends [infer First extends string, ...infer Rest extends string[]]
  ? { [K in First]: TupleToNestedObject<Rest, V> }
  : V;

type Nested1 = TupleToNestedObject<["a", "b", "c"], string>;
// { a: { b: { c: string } } }

type Nested2 = TupleToNestedObject<["x"], number>;
// { x: number }

type Nested3 = TupleToNestedObject<[], boolean>;
// boolean

// Verification
type TestNested = Expect<Equal<
  TupleToNestedObject<["a", "b"], string>,
  { a: { b: string } }
>>;
```

### 4.6 UnionToIntersection

```typescript
// Task: Convert a union type to an intersection type
// This is regarded as the "royal road of type puzzles" - an advanced technique

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

type UTI1 = UnionToIntersection<{ a: 1 } | { b: 2 }>;
// { a: 1 } & { b: 2 }

type UTI2 = UnionToIntersection<((x: string) => void) | ((x: number) => void)>;
// ((x: string) => void) & ((x: number) => void)
// = (x: string & number) => void = (x: never) => void

// Explanation:
// 1. (U extends any ? (k: U) => void : never)
//    -> Distributive conditional type wraps each union member as a function argument
//    -> ((k: { a: 1 }) => void) | ((k: { b: 2 }) => void)
// 2. extends (k: infer I) => void
//    -> Function parameters are in a contravariant position
//    -> infer in a contravariant position infers an intersection
//    -> I = { a: 1 } & { b: 2 }
```

### 4.7 UnionToTuple

```typescript
// Task: Convert a union type to a tuple type
// Note: the order of union members is not guaranteed

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

type UT1 = UnionToTuple<"a" | "b" | "c">;
// ["a", "b", "c"] (order not guaranteed)

type UT2 = UnionToTuple<1 | 2 | 3>;
// [1, 2, 3] (order not guaranteed)
```

### 4.8 IsUnion

```typescript
// Task: Determine whether a type is a union type
type IsUnion<T, Copy = T> =
  T extends any  // distribute via distributive conditional types
    ? [Copy] extends [T]  // is the original whole type a subtype of the current member?
      ? false  // if subtype, it's a single type
      : true   // otherwise it's a union
    : never;

type IU1 = IsUnion<string>;           // false
type IU2 = IsUnion<string | number>;  // true
type IU3 = IsUnion<never>;            // false
type IU4 = IsUnion<boolean>;          // true (boolean = true | false)

// Verification
type TestIsUnion1 = Expect<Equal<IsUnion<string | number>, true>>;
type TestIsUnion2 = Expect<Equal<IsUnion<string>, false>>;
type TestIsUnion3 = Expect<Equal<IsUnion<boolean>, true>>;

// Explanation:
// boolean is actually the union type true | false
// The distributive conditional type T extends any expands across members
// [Copy] extends [T] compares "the whole original type" with "an individual member"
// They match for a single type but not for a union
```

### 4.9 PercentageParser

```typescript
// Task: Decompose a string into sign, number, and percent symbol
type PercentageParser<S extends string> =
  S extends `${infer Sign extends "+" | "-"}${infer Num}%`
    ? [Sign, Num, "%"]
    : S extends `${infer Sign extends "+" | "-"}${infer Num}`
      ? [Sign, Num, ""]
      : S extends `${infer Num}%`
        ? ["", Num, "%"]
        : S extends ""
          ? ["", "", ""]
          : ["", S, ""];

type PP1 = PercentageParser<"+100%">;  // ["+", "100", "%"]
type PP2 = PercentageParser<"-50">;    // ["-", "50", ""]
type PP3 = PercentageParser<"100%">;   // ["", "100", "%"]
type PP4 = PercentageParser<"42">;     // ["", "42", ""]
type PP5 = PercentageParser<"">;       // ["", "", ""]
```

### 4.10 Type-Level FizzBuzz

```typescript
// Task: Implement FizzBuzz at the type level

// Test divisibility by 3
type IsDivisibleBy3<
  N extends number,
  Count extends unknown[] = [],
  Triple extends unknown[] = []
> = Count["length"] extends N
  ? true
  : Triple["length"] extends 3
    ? IsDivisibleBy3<N, Count, []>
    : IsDivisibleBy3<N, [...Count, unknown], [...Triple, unknown]>;

// Test divisibility by 5
type IsDivisibleBy5<
  N extends number,
  Count extends unknown[] = [],
  Penta extends unknown[] = []
> = Count["length"] extends N
  ? true
  : Penta["length"] extends 5
    ? IsDivisibleBy5<N, Count, []>
    : IsDivisibleBy5<N, [...Count, unknown], [...Penta, unknown]>;

// One element of FizzBuzz
type FBValue<N extends number> =
  IsDivisibleBy3<N> extends true
    ? IsDivisibleBy5<N> extends true
      ? "FizzBuzz"
      : "Fizz"
    : IsDivisibleBy5<N> extends true
      ? "Buzz"
      : N;

// Run FizzBuzz
type FizzBuzz<
  N extends number,
  Acc extends (string | number)[] = [],
  Count extends unknown[] = [unknown]  // start from 1
> = Count["length"] extends [...BuildTuple<N>, unknown]["length"]
  ? Acc
  : FizzBuzz<N, [...Acc, FBValue<Count["length"] & number>], [...Count, unknown]>;

// Test with a small number
type FB15 = FizzBuzz<15>;
// [1, 2, "Fizz", 4, "Buzz", "Fizz", 7, 8, "Fizz", "Buzz", 11, "Fizz", 13, 14, "FizzBuzz"]
```

---

## 5. Application to Real Work

### 5.1 Applying Type Challenge Techniques in Practice

```typescript
// Pattern 1: Type conversion of API responses (application of the CamelCase challenge)
// Automatically convert snake_case API responses into camelCase

type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
    : S;

type CamelizeKeys<T> = {
  [K in keyof T as K extends string ? SnakeToCamel<K> : K]:
    T[K] extends object
      ? T[K] extends any[]
        ? CamelizeKeys<T[K][number]>[]
        : CamelizeKeys<T[K]>
      : T[K];
};

// Pattern 2: Type-safe configuration object (application of the Chainable challenge)
class ConfigBuilder<T extends Record<string, unknown> = {}> {
  private config: T;

  constructor(config: T = {} as T) {
    this.config = config;
  }

  set<K extends string, V>(
    key: K extends keyof T ? never : K,
    value: V
  ): ConfigBuilder<T & Record<K, V>> {
    return new ConfigBuilder({ ...this.config, [key]: value } as any);
  }

  build(): Readonly<T> {
    return Object.freeze({ ...this.config });
  }
}

const config = new ConfigBuilder()
  .set("host", "localhost")
  .set("port", 3000)
  .set("debug", true)
  .build();
// Readonly<{ host: string; port: number; debug: boolean }>

// Pattern 3: Type-safe path access (application of the TupleToNestedObject challenge)
type PathValue<T, P extends string> =
  P extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? PathValue<T[Key], Rest>
      : never
    : P extends keyof T
      ? T[P]
      : never;

function get<T, P extends string>(obj: T, path: P): PathValue<T, P> {
  return path.split(".").reduce((acc: any, key) => acc?.[key], obj);
}

// Pattern 4: Type-safe event system (application of the StringToUnion challenge)
type EventCallback<T> = (data: T) => void;

class TypedEmitter<Events extends Record<string, any>> {
  private handlers = new Map<string, Function[]>();

  on<K extends keyof Events & string>(
    event: K,
    callback: EventCallback<Events[K]>
  ): this {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, [...existing, callback]);
    return this;
  }

  emit<K extends keyof Events & string>(
    event: K,
    data: Events[K]
  ): void {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(h => h(data));
  }
}
```

### 5.2 Situations Where Type Challenge Knowledge Matters

```typescript
// Situation 1: Reading library type definitions
// Advanced type definitions in Prisma, tRPC, Zod, etc. heavily use
// conditional types, infer, and recursion

// Situation 2: Designing types for your own libraries
// Providing type-safe APIs often requires combining
// mapped types and template literal types

// Situation 3: Solving complex generics issues
// To understand "why doesn't this type match?"
// you need knowledge of distributive conditional types and infer behavior

// Situation 4: Creating custom utility types
// When standard Partial and Pick aren't enough, you need to
// craft your own DeepPartial, PickByType, and similar types
```

---

## Challenges by Difficulty

| Difficulty | Challenge | Required techniques |
|--------|-----------|---------------|
| Easy | Pick, Readonly, First, Length | Mapped types, infer |
| Easy | TupleToUnion, Includes, If | Index access, recursion |
| Easy | Push, Unshift, Concat, Awaited | Spread, recursion |
| Medium | DeepReadonly, Flatten, Trim | Recursion, string operations |
| Medium | Chainable, CamelCase, Omit | Key Remapping, template literals |
| Medium | Replace, Reverse, StringToUnion | String recursion |
| Hard | UnionToIntersection, UnionToTuple | Contravariance, distributive conditional types |
| Hard | IsUnion, FizzBuzz, CurryFn | Advanced recursion, combined techniques |
| Extreme | JSON Parser, SQL Parser | All techniques combined |

---

## How to Choose the Solution Pattern

| Pattern | When to use | Examples |
|----------|---------|-----|
| Mapped type | Transform object properties | Pick, Readonly, Partial |
| infer + conditional type | Extract a type from structure | ReturnType, First, Last |
| Recursion + tuple | Process array elements in order | Flatten, Includes, Reverse |
| Recursion + string | Process a string one character at a time | Trim, CamelCase, StringToUnion |
| Tuple length | Numeric arithmetic | Add, Subtract, GreaterThan |
| Key Remapping | Rename keys | CamelCaseKeys, Getters |
| Distributive | Process each union member | Extract, Exclude, NonNullable |
| Contravariant infer | Union -> Intersection | UnionToIntersection |
| Accumulator | Recurse while accumulating results | Unique, FizzBuzz, GroupBy |

```
  When you see a problem:

  1. What is the input type?
     +-- Object        -> consider mapped types
     +-- Array/tuple   -> consider infer + ... rest
     +-- String        -> consider template literal + infer
     +-- Union         -> consider distributive conditional types
     +-- Number        -> consider a tuple-length counter

  2. What kind of processing?
     +-- Transform -> preserve the original structure while transforming each element
     +-- Filter    -> return never to exclude
     +-- Extract   -> use infer to pull out a portion
     +-- Build     -> accumulate the result with an accumulator
     +-- Decide    -> return true / false

  3. Is recursion needed?
     +-- Nested structure   -> recursion
     +-- Variable-length    -> recursion + termination condition
     +-- Fixed structure    -> non-recursive
```

---

## Anti-Patterns

### Anti-pattern 1: Using complex type puzzles in production code

```typescript
// BAD: using a type-level SQL parser in production
type ParseSQL<T extends string> = /* hundreds of lines of type definitions */;
// -> compile time explodes, error messages become incomprehensible

// GOOD: use library types or keep types simple
import { sql } from "drizzle-orm";
// The library provides appropriate type safety

// GOOD: define just-enough types
type QueryResult<T extends string> = T extends `SELECT * FROM users`
  ? User[]
  : T extends `SELECT * FROM posts`
    ? Post[]
    : unknown[];
```

### Anti-pattern 2: Ignoring recursion-depth limits

```typescript
// BAD: deep recursion
type Repeat<S extends string, N extends number, Acc extends string = ""> =
  BuildTuple<N> extends [unknown, ...infer Rest]
    ? Repeat<S, Rest["length"] & number, `${Acc}${S}`>
    : Acc;

// type Long = Repeat<"a", 1000>;  // Error: recursion is too deep

// TypeScript's recursion limit is around 1000 (TS 4.5+)
// GOOD: design with recursion depth in mind
// Avoid arithmetic on large numbers at the type level
```

### Anti-pattern 3: Incorrect implementation of IsEqual

```typescript
// BAD: comparison via extends
type BadEqual<A, B> = A extends B ? B extends A ? true : false : false;

// Problem: produces wrong results for any, boolean, and union types
type Test1 = BadEqual<boolean, true>;   // boolean (returns true | false)
type Test2 = BadEqual<any, string>;     // boolean

// GOOD: strict equality check
type GoodEqual<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

type Test3 = GoodEqual<boolean, true>;  // false (correct)
type Test4 = GoodEqual<any, string>;    // false (correct)
```

### Anti-pattern 4: Unintended behavior of distributive conditional types

```typescript
// BAD: unexpected results with never or boolean
type BadIsNever<T> = T extends never ? true : false;
type Test1 = BadIsNever<never>;  // never (neither true nor false!)

// GOOD: non-distributive check
type GoodIsNever<T> = [T] extends [never] ? true : false;
type Test2 = GoodIsNever<never>;  // true

// BAD: forgetting that boolean distributes
type BadCheck<T> = T extends true ? "yes" : "no";
type Test3 = BadCheck<boolean>;  // "yes" | "no" (boolean = true | false is distributed)

// GOOD: make the intent explicit
type GoodCheck<T> = [T] extends [true] ? "yes" : "no";
type Test4 = GoodCheck<boolean>;  // "no" (boolean is not a subtype of [true])
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also write test code

```python
# Exercise 1: Template for a basic implementation
class Exercise1:
    """Exercise on basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Applied Patterns

Extend the basic implementation by adding the following features.

```python
# Exercise 2: applied patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on applied patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Remove by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Inefficient: {slow_time:.4f}s")
    print(f"Efficient:   {fast_time:.6f}s")
    print(f"Speedup:     {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be aware of algorithmic complexity
- Choose the right data structure
- Measure the impact with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Configuration file issues | Check the config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify the executing user's permissions, review settings |
| Data inconsistency | Concurrency conflicts | Introduce locking, manage transactions |

### Debugging Procedure

1. **Check error messages**: read the stack trace and identify the location
2. **Establish reproduction steps**: reproduce the error with minimal code
3. **Form hypotheses**: list possible causes
4. **Verify step by step**: use logging or a debugger to test hypotheses
5. **Fix and run regression tests**: after fixing, run tests on related areas as well

```python
# Debugging utility
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
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception: {func.__name__}: {e}")
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

When performance problems occur, follow these diagnostic steps:

1. **Identify the bottleneck**: measure with profiling tools
2. **Check memory usage**: look for memory leaks
3. **Check I/O waits**: inspect disk and network I/O
4. **Check concurrent connections**: review the connection pool state

| Issue type | Diagnostic tool | Countermeasures |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Improve algorithms, parallelize |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |
---

## FAQ

### Q1: How should I tackle Type Challenges?

**A:** Start with Easy and work your way up. For each problem, follow these steps:
1. Understand the requirements (verify input and expected output)
2. Think about applicable techniques (mapped type? recursion? infer?)
3. Implement starting from small cases
4. Verify edge cases (empty array, never, boolean, any)

You can attempt them in your browser at https://tsch.js.org/. Each problem comes with test cases so you can immediately verify your solution.

### Q2: Is type-level programming useful in real work?

**A:** It is critically important for library authors. For application developers, it is also useful in scenarios such as:
- Understanding type errors (knowing why a type doesn't compile)
- Leveraging utility types (DeepPartial, PickByType, etc.)
- Reading library type definitions (Prisma, tRPC, Zod, etc.)
- Creating custom utility types

That said, you don't need to write overly complex types. As long as you understand the basic type-puzzle solution patterns (conditional types, infer, mapped types, recursion), that is enough.

### Q3: Is TypeScript's type system Turing complete?

**A:** Yes, modulo the recursion limit. In theory you can express any computation at the type level, but in practice there are limits:
- Recursion depth limit (about 1000, TS 4.5+)
- Union member count limit (about 100,000)
- Increasing compile times

What you "can" do at the type level differs from what you "should" do. Don't implement complex things at the type level when they're easy to do at runtime.

### Q4: I don't understand how the Equal type works

**A:** Let's break down `Equal<X, Y>` step by step:

```typescript
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
```

1. `<T>() => T extends X ? 1 : 2` is "a function type that returns 1 if T is a subtype of X, otherwise 2"
2. If X and Y are the same type, these two function types are also the same -> true
3. If X and Y are different types, the function types differ -> false

Why this is more accurate than plain extends comparison:
- `any extends string` behaves specially in conditional branches
- `boolean extends true` gets distributed
- This function-type pattern avoids these problems

### Q5: What do I do when I get a "recursion is too deep" error?

**A:** Possible countermeasures:
1. **Add a recursion depth counter**: track depth via tuple length and stop at the limit
2. **Tail-call optimization**: TS 4.5+ optimizes some tail-recursive types
3. **Divide and conquer**: split the problem to reduce recursion depth
4. **Move to runtime**: it may not be a job for the type level

```typescript
// A pattern where tail-call optimization applies
type TailRecursive<T extends unknown[], Acc extends unknown[] = []> =
  T extends [infer First, ...infer Rest]
    ? TailRecursive<Rest, [...Acc, First]>  // recursive call in tail position
    : Acc;

// Non-tail-recursive pattern (not optimized)
type NonTailRecursive<T extends unknown[]> =
  T extends [infer First, ...infer Rest]
    ? [First, ...NonTailRecursive<Rest>]  // spread after the recursive result
    : [];
```

---

## Summary

| Item | Content |
|------|------|
| Type-level programming | Type-level computation using conditional types, infer, and recursion |
| Basic techniques | Mapped types, tuple operations, string pattern matching |
| Testing | Verify type correctness with Equal + Expect |
| Easy | Pick, Readonly, First, TupleToUnion, Includes, Awaited |
| Medium | DeepReadonly, Flatten, CamelCase, Chainable, Trim |
| Hard | UnionToIntersection, UnionToTuple, IsUnion, FizzBuzz |
| Practical use | API type conversion, configuration builders, event systems |
| Caveats | Recursion-depth limit, compilation speed, accuracy of IsEqual |

---

## Recommended Next Reading

- [04-declaration-files.md](./04-declaration-files.md) -- Declaration files
- [00-conditional-types.md](./00-conditional-types.md) -- Conditional types
- [01-mapped-types.md](./01-mapped-types.md) -- Mapped types
- [02-template-literal-types.md](./02-template-literal-types.md) -- Template literal types

---

## References

1. **Type Challenges** -- https://tsch.js.org/
2. **TypeScript Type-Level Programming** -- https://type-level-typescript.com/
3. **Matt Pocock: Total TypeScript** -- https://www.totaltypescript.com/
4. **TypeScript Handbook: Conditional Types** -- https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
5. **TypeScript Handbook: Mapped Types** -- https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
6. **TypeScript Handbook: Template Literal Types** -- https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
