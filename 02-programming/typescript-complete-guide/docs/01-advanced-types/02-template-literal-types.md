# Template Literal Types

> Express string patterns at the type level. Learn type-safe string manipulation and type-level parser implementation, including path types, event names, and CSS properties.

## What You Will Learn in This Chapter

1. **Basic Syntax** -- Template literal type syntax and combination with string unions
2. **String Manipulation Types** -- Using Uppercase, Lowercase, Capitalize, and Uncapitalize
3. **Pattern Matching and infer** -- Decomposing strings and extracting types
4. **Advanced Patterns** -- Path types, type-level parsers, and string decomposition/reconstruction
5. **Practical Patterns** -- CSS properties, routing, i18n, and type-safe SQL
6. **Performance and Best Practices** -- Avoiding union explosion and efficient type design


## Prerequisites

To get the most out of this guide, you should be familiar with:

- Basic programming knowledge
- Understanding of related fundamental concepts
- The content of [Mapped Types](./01-mapped-types.md)

---

## 1. Basic Syntax

### 1.1 Basics of Template Literal Types

Template literal types were introduced in TypeScript 4.1 and allow you to compose string literal types as templates. They bring JavaScript's template literal syntax directly to the type level.

```typescript
// Composing string literal types
type Greeting = `Hello, ${string}`;

const a: Greeting = "Hello, World";  // OK
const b: Greeting = "Hello, Alice";  // OK
// const c: Greeting = "Hi, World";  // Error: "Hi, World" is not assignable to `Hello, ${string}`

// Primitive types other than string can also be embedded
type NumberString = `value-${number}`;
const d: NumberString = "value-42";    // OK
const e: NumberString = "value-3.14";  // OK
// const f: NumberString = "value-abc"; // Error

type BooleanString = `is-${boolean}`;
const g: BooleanString = "is-true";   // OK
const h: BooleanString = "is-false";  // OK
// const i: BooleanString = "is-yes"; // Error

// bigint is also usable
type BigIntString = `big-${bigint}`;
const j: BigIntString = "big-12345678901234567890"; // OK

// null and undefined are also usable (though rarely useful in practice)
type NullString = `value-${null}`;       // "value-null"
type UndefString = `value-${undefined}`; // "value-undefined"
```

### 1.2 Combining with Union Types (Cartesian Product Expansion)

```typescript
// Combining with union types (cartesian product)
type Color = "red" | "green" | "blue";
type Size = "small" | "medium" | "large";

type ColorSize = `${Color}-${Size}`;
// "red-small" | "red-medium" | "red-large" |
// "green-small" | "green-medium" | "green-large" |
// "blue-small" | "blue-medium" | "blue-large"

// Cartesian product of three unions
type Prefix = "btn" | "link";
type Variant = "primary" | "secondary";
type State = "active" | "disabled";

type ClassName = `${Prefix}-${Variant}-${State}`;
// 2 × 2 × 2 = 8 patterns
// "btn-primary-active" | "btn-primary-disabled" | "btn-secondary-active" | ...
// "link-primary-active" | "link-primary-disabled" | "link-secondary-active" | ...

// Combining with numeric literals
type Port = 80 | 443 | 8080 | 3000;
type Protocol = "http" | "https";
type URL = `${Protocol}://localhost:${Port}`;
// "http://localhost:80" | "http://localhost:443" | ... | "https://localhost:3000"
```

### Cartesian Product Expansion of Union Types

```
  Color = "red" | "green" | "blue"
  Size  = "small" | "medium" | "large"

  Expansion of `${Color}-${Size}`:

  "red"   × "small"  → "red-small"
  "red"   × "medium" → "red-medium"
  "red"   × "large"  → "red-large"
  "green" × "small"  → "green-small"
  "green" × "medium" → "green-medium"
  "green" × "large"  → "green-large"
  "blue"  × "small"  → "blue-small"
  "blue"  × "medium" → "blue-medium"
  "blue"  × "large"  → "blue-large"

  Result: a union of 3 × 3 = 9 patterns

  For three unions:
  |A| × |B| × |C| = number of resulting union members
  Example: 10 × 10 × 10 = 1,000 patterns → caution required
```

### 1.3 Event Handler Name Types

```typescript
type DomEvent = "click" | "focus" | "blur" | "change" | "submit" |
  "mouseenter" | "mouseleave" | "keydown" | "keyup" | "scroll" |
  "resize" | "load" | "error" | "input" | "drag" | "drop";

// Event handler names with on + PascalCase
type EventHandler = `on${Capitalize<DomEvent>}`;
// "onClick" | "onFocus" | "onBlur" | "onChange" | "onSubmit" |
// "onMouseenter" | "onMouseleave" | "onKeydown" | "onKeyup" | ...

// Type for data- attributes
type DataAttribute = `data-${string}`;

function setAttribute(element: HTMLElement, attr: DataAttribute, value: string): void {
  element.setAttribute(attr, value);
}

setAttribute(document.body, "data-theme", "dark");     // OK
setAttribute(document.body, "data-user-id", "123");    // OK
// setAttribute(document.body, "class", "main");        // Error

// CSS custom properties
type CSSCustomProperty = `--${string}`;

function setCustomProp(name: CSSCustomProperty, value: string): void {
  document.documentElement.style.setProperty(name, value);
}

setCustomProp("--primary-color", "#333");   // OK
setCustomProp("--font-size", "16px");       // OK
// setCustomProp("primary-color", "#333");  // Error: does not start with --

// Type for ARIA attributes
type AriaAttribute = `aria-${string}`;
type AriaRole = "button" | "dialog" | "alert" | "navigation" | "main" | "complementary";

function setAria(element: HTMLElement, attr: AriaAttribute, value: string): void {
  element.setAttribute(attr, value);
}
```

### 1.4 Namespaced Type Definitions

```typescript
// Namespaced event names (jQuery-style)
type Namespace = "app" | "user" | "ui" | "data";
type BaseEvent = "init" | "update" | "destroy" | "error";

type NamespacedEvent = `${Namespace}:${BaseEvent}`;
// "app:init" | "app:update" | "app:destroy" | "app:error" |
// "user:init" | "user:update" | ... (4 × 4 = 16 patterns)

// Patterns including wildcards
type EventPattern = NamespacedEvent | `${Namespace}:*` | "*";

// Redis key patterns
type CachePrefix = "user" | "post" | "session" | "config";
type CacheKey = `${CachePrefix}:${string}`;

function getCache(key: CacheKey): Promise<string | null> {
  // Implementation...
  return Promise.resolve(null);
}

getCache("user:123");         // OK
getCache("session:abc-def");  // OK
// getCache("invalid");       // Error

// Environment variable prefixes
type EnvPrefix = "NEXT_PUBLIC" | "VITE" | "REACT_APP";
type PublicEnvVar = `${EnvPrefix}_${string}`;

function getPublicEnv(key: PublicEnvVar): string | undefined {
  return process.env[key];
}
```

---

## 2. String Manipulation Types

### 2.1 Built-in String Manipulation Types

TypeScript provides four built-in string manipulation types. Unlike conditional types, these are special types built into the compiler.

```typescript
// Uppercase<S>: convert all to uppercase
type A = Uppercase<"hello">;      // "HELLO"
type A2 = Uppercase<"Hello">;     // "HELLO"
type A3 = Uppercase<"HELLO">;     // "HELLO" (already uppercase)

// Lowercase<S>: convert all to lowercase
type B = Lowercase<"HELLO">;      // "hello"
type B2 = Lowercase<"Hello">;     // "hello"
type B3 = Lowercase<"hello">;     // "hello" (already lowercase)

// Capitalize<S>: capitalize the first character
type C = Capitalize<"hello">;     // "Hello"
type C2 = Capitalize<"Hello">;    // "Hello" (already capitalized)
type C3 = Capitalize<"hELLO">;    // "HELLO" (only the first changes; rest stays as-is)

// Uncapitalize<S>: uncapitalize the first character
type D = Uncapitalize<"Hello">;   // "hello"
type D2 = Uncapitalize<"hello">;  // "hello" (already uncapitalized)
type D3 = Uncapitalize<"HELLO">;  // "hELLO" (only the first changes)

// Combining with union types (applied to each member individually)
type Events = "click" | "focus" | "blur";
type PascalEvents = Capitalize<Events>;  // "Click" | "Focus" | "Blur"
type UpperEvents = Uppercase<Events>;    // "CLICK" | "FOCUS" | "BLUR"
type LowerEvents = Lowercase<Uppercase<Events>>;  // "click" | "focus" | "blur"
```

### 2.2 Implementing Case Conversions

```typescript
// camelCase → snake_case
type CamelToSnake<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Tail extends Uncapitalize<Tail>
      ? `${Lowercase<Head>}${CamelToSnake<Tail>}`
      : `${Lowercase<Head>}_${CamelToSnake<Tail>}`
    : S;

type Snake1 = CamelToSnake<"camelCaseString">;    // "camel_case_string"
type Snake2 = CamelToSnake<"getElementById">;      // "get_element_by_id"
type Snake3 = CamelToSnake<"XMLParser">;           // "x_m_l_parser" (note: consecutive uppercase letters are converted individually)

// snake_case → camelCase
type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Lowercase<Head>}${Capitalize<SnakeToCamel<Tail>>}`
    : Lowercase<S>;

type Camel1 = SnakeToCamel<"snake_case_string">;  // "snakeCaseString"
type Camel2 = SnakeToCamel<"user_id">;             // "userId"
type Camel3 = SnakeToCamel<"created_at">;           // "createdAt"

// snake_case → PascalCase
type SnakeToPascal<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Capitalize<Lowercase<Head>>}${SnakeToPascal<Tail>}`
    : Capitalize<Lowercase<S>>;

type Pascal1 = SnakeToPascal<"user_profile">;      // "UserProfile"
type Pascal2 = SnakeToPascal<"api_response_data">;  // "ApiResponseData"

// kebab-case → camelCase
type KebabToCamel<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Lowercase<Head>}${Capitalize<KebabToCamel<Tail>>}`
    : Lowercase<S>;

type Kebab1 = KebabToCamel<"kebab-case-string">;  // "kebabCaseString"
type Kebab2 = KebabToCamel<"font-size">;            // "fontSize"
type Kebab3 = KebabToCamel<"border-top-width">;     // "borderTopWidth"

// camelCase → kebab-case
type CamelToKebab<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Tail extends Uncapitalize<Tail>
      ? `${Lowercase<Head>}${CamelToKebab<Tail>}`
      : `${Lowercase<Head>}-${CamelToKebab<Tail>}`
    : S;

type KebabR1 = CamelToKebab<"fontSize">;           // "font-size"
type KebabR2 = CamelToKebab<"borderTopWidth">;      // "border-top-width"
type KebabR3 = CamelToKebab<"backgroundColor">;     // "background-color"
```

### 2.3 Joining and Splitting Strings

```typescript
// Joining strings (Join)
type Join<T extends string[], D extends string> =
  T extends []
    ? ""
    : T extends [infer F extends string]
      ? F
      : T extends [infer F extends string, ...infer R extends string[]]
        ? `${F}${D}${Join<R, D>}`
        : never;

type Joined1 = Join<["a", "b", "c"], ".">;    // "a.b.c"
type Joined2 = Join<["hello", "world"], " ">;  // "hello world"
type Joined3 = Join<["one"], ",">;             // "one"
type Joined4 = Join<[], ",">;                  // ""

// Splitting strings (Split)
type Split<S extends string, D extends string> =
  S extends `${infer Head}${D}${infer Tail}`
    ? [Head, ...Split<Tail, D>]
    : [S];

type Splitted1 = Split<"a.b.c", ".">;       // ["a", "b", "c"]
type Splitted2 = Split<"hello", ".">;        // ["hello"]
type Splitted3 = Split<"a-b-c-d", "-">;      // ["a", "b", "c", "d"]
type Splitted4 = Split<"hello world", " ">;  // ["hello", "world"]

// Replacing strings (Replace)
type Replace<
  S extends string,
  From extends string,
  To extends string
> = S extends `${infer Before}${From}${infer After}`
  ? `${Before}${To}${After}`
  : S;

type Replaced1 = Replace<"hello world", "world", "TypeScript">;
// "hello TypeScript"

// Replacing all occurrences (ReplaceAll)
type ReplaceAll<
  S extends string,
  From extends string,
  To extends string
> = S extends `${infer Before}${From}${infer After}`
  ? ReplaceAll<`${Before}${To}${After}`, From, To>
  : S;

type ReplacedAll1 = ReplaceAll<"a-b-c-d", "-", ".">;  // "a.b.c.d"
type ReplacedAll2 = ReplaceAll<"aaa", "a", "bb">;      // "bbbbbb"

// Trim (remove leading and trailing whitespace)
type TrimLeft<S extends string> =
  S extends ` ${infer Rest}` | `\n${infer Rest}` | `\t${infer Rest}`
    ? TrimLeft<Rest>
    : S;

type TrimRight<S extends string> =
  S extends `${infer Rest} ` | `${infer Rest}\n` | `${infer Rest}\t`
    ? TrimRight<Rest>
    : S;

type Trim<S extends string> = TrimLeft<TrimRight<S>>;

type Trimmed = Trim<"  hello  ">;  // "hello"
```

### List of String Manipulation Types

| Type | Input | Output | Use Case |
|------|-------|--------|----------|
| `Uppercase<S>` | `"hello"` | `"HELLO"` | HTTP methods, constant names |
| `Lowercase<S>` | `"HELLO"` | `"hello"` | Normalization |
| `Capitalize<S>` | `"hello"` | `"Hello"` | PascalCase, event names |
| `Uncapitalize<S>` | `"Hello"` | `"hello"` | camelCase conversion |

### List of Custom String Manipulation Types

| Type | Input | Output | Use Case |
|------|-------|--------|----------|
| `CamelToSnake<S>` | `"camelCase"` | `"camel_case"` | API communication |
| `SnakeToCamel<S>` | `"snake_case"` | `"snakeCase"` | API communication |
| `KebabToCamel<S>` | `"kebab-case"` | `"kebabCase"` | CSS → JS |
| `CamelToKebab<S>` | `"camelCase"` | `"camel-case"` | JS → CSS |
| `Split<S, D>` | `"a.b.c", "."` | `["a","b","c"]` | Path parsing |
| `Join<T, D>` | `["a","b"], "."` | `"a.b"` | Path construction |
| `Replace<S, F, T>` | `"ab", "a", "x"` | `"xb"` | String transformation |
| `Trim<S>` | `" abc "` | `"abc"` | Input normalization |

---

## 3. Pattern Matching and infer

### 3.1 Decomposing Strings

Using `infer` inside template literal types lets you pattern-match strings and extract substrings.

```typescript
// Get the first character
type FirstChar<S extends string> =
  S extends `${infer F}${string}` ? F : never;

type FC1 = FirstChar<"hello">;  // "h"
type FC2 = FirstChar<"A">;      // "A"
type FC3 = FirstChar<"">;       // never

// Get the rest of the string
type RestChars<S extends string> =
  S extends `${string}${infer R}` ? R : never;

type RC1 = RestChars<"hello">;  // "ello"
type RC2 = RestChars<"A">;      // ""
type RC3 = RestChars<"">;       // never

// Get the last character
type LastChar<S extends string> =
  S extends `${infer Rest}${infer Last}`
    ? Last extends ""
      ? Rest
      : LastChar<`${Last}`> extends never
        ? Last
        : LastChar<`${Rest}${LastChar<Last>}`>
    : never;

// Reversing a string
type Reverse<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? `${Reverse<Rest>}${First}`
    : "";

type Rev = Reverse<"hello">;  // "olleh"

// Check if a string contains a given substring
type Includes<S extends string, Search extends string> =
  S extends `${string}${Search}${string}` ? true : false;

type Inc1 = Includes<"hello world", "world">;  // true
type Inc2 = Includes<"hello world", "xyz">;    // false
type Inc3 = Includes<"typescript", "script">;  // true

// Check if a string starts with a given prefix
type StartsWith<S extends string, Prefix extends string> =
  S extends `${Prefix}${string}` ? true : false;

type SW1 = StartsWith<"hello world", "hello">;  // true
type SW2 = StartsWith<"hello world", "world">;  // false

// Check if a string ends with a given suffix
type EndsWith<S extends string, Suffix extends string> =
  S extends `${string}${Suffix}` ? true : false;

type EW1 = EndsWith<"hello world", "world">;  // true
type EW2 = EndsWith<"hello world", "hello">;  // false
```

### 3.2 Extracting Path Parameters

```typescript
// Extracting URL path parameters (basic version)
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

type Params1 = ExtractParams<"/users/:userId/posts/:postId">;
// "userId" | "postId"

type Params2 = ExtractParams<"/api/v1/:version/users/:id/profile">;
// "version" | "id"

type Params3 = ExtractParams<"/static/index.html">;
// never (no parameters)

// Generate an object type from parameters
type RouteParams<T extends string> = {
  [K in ExtractParams<T>]: string;
};

type UserPostParams = RouteParams<"/users/:userId/posts/:postId">;
// { userId: string; postId: string }

// Typed parameters (numeric IDs)
type TypedRouteParams<T extends string> = {
  [K in ExtractParams<T>]: K extends `${string}Id` ? number : string;
};

type TypedParams = TypedRouteParams<"/users/:userId/posts/:postId">;
// { userId: number; postId: number } (parameters ending in "Id" become numbers)
```

### Pattern Matching for Path Types

```
  Input: "/users/:userId/posts/:postId"

  Step 1: `${string}:${infer P}/${infer R}`
    P = "userId"
    R = "posts/:postId"

  Step 2: ExtractParams<"posts/:postId">
    `${string}:${infer P}`
    P = "postId"

  Result: "userId" | "postId"

  Conversion via RouteParams:
    "userId" | "postId"
    → { userId: string; postId: string }
```

### 3.3 Type-Safe Router

```typescript
// Route definitions
type Routes = {
  "/": {};
  "/users": {};
  "/users/:id": { id: string };
  "/users/:id/posts": { id: string };
  "/users/:userId/posts/:postId": { userId: string; postId: string };
  "/settings": {};
  "/settings/:section": { section: string };
};

// Version that automatically infers parameter types from the route path
type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParamsHelper<Rest>]: string }
    : T extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : {};

type ExtractRouteParamsHelper<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractRouteParamsHelper<Rest>
    : T extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : {};

// Type-safe navigation function
type Route = "/users" | "/users/:id" | "/posts/:postId/comments/:commentId" |
  "/settings" | "/settings/:section";

function navigate<T extends Route>(
  route: T,
  ...args: keyof ExtractRouteParams<T> extends never
    ? []
    : [params: ExtractRouteParams<T>]
): void {
  // Implementation omitted
}

navigate("/users");                                           // OK: no parameters required
navigate("/users/:id", { id: "123" });                        // OK
navigate("/posts/:postId/comments/:commentId", {
  postId: "1",
  commentId: "42",
});                                                           // OK
// navigate("/users/:id");                                    // Error: parameters are required
// navigate("/users/:id", { id: "123", extra: "x" });         // Error: extra parameter

// Building paths (substituting parameters with actual values)
type BuildPath<
  Path extends string,
  Params extends Record<string, string>
> = Path extends `${infer Before}:${infer Param}/${infer After}`
  ? Param extends keyof Params
    ? BuildPath<`${Before}${Params[Param]}/${After}`, Params>
    : never
  : Path extends `${infer Before}:${infer Param}`
    ? Param extends keyof Params
      ? `${Before}${Params[Param]}`
      : never
    : Path;

type Built = BuildPath<"/users/:id/posts/:postId", { id: "123"; postId: "456" }>;
// "/users/123/posts/456"
```

### 3.4 Type-Safe Parsing of Query Parameters

```typescript
// Parsing a query string
type ParseQueryString<S extends string> =
  S extends `${infer Key}=${infer Value}&${infer Rest}`
    ? { [K in Key]: Value } & ParseQueryString<Rest>
    : S extends `${infer Key}=${infer Value}`
      ? { [K in Key]: Value }
      : {};

type Query1 = ParseQueryString<"page=1&limit=10&sort=name">;
// { page: "1" } & { limit: "10" } & { sort: "name" }

type Query2 = ParseQueryString<"q=typescript&lang=ja">;
// { q: "typescript" } & { lang: "ja" }

// Parsing a full URL
type ParseURL<S extends string> =
  S extends `${infer Protocol}://${infer Host}/${infer Path}?${infer Query}`
    ? {
        protocol: Protocol;
        host: Host;
        path: `/${Path}`;
        query: ParseQueryString<Query>;
      }
    : S extends `${infer Protocol}://${infer Host}/${infer Path}`
      ? {
          protocol: Protocol;
          host: Host;
          path: `/${Path}`;
          query: {};
        }
      : S extends `${infer Protocol}://${infer Host}`
        ? {
            protocol: Protocol;
            host: Host;
            path: "/";
            query: {};
          }
        : never;

type URLParsed = ParseURL<"https://api.example.com/users?page=1&limit=10">;
// {
//   protocol: "https";
//   host: "api.example.com";
//   path: "/users";
//   query: { page: "1" } & { limit: "10" };
// }
```

---

## 4. Advanced Template Literal Types

### 4.1 Type-Safe CSS Properties

```typescript
// Types for CSS values
type CSSUnit = "px" | "em" | "rem" | "%" | "vh" | "vw" | "vmin" | "vmax" | "ch" | "ex";
type CSSValue = `${number}${CSSUnit}` | "auto" | "0" | "inherit" | "initial" | "unset";

function setWidth(width: CSSValue): void {
  // Implementation
}

setWidth("100px");    // OK
setWidth("50%");      // OK
setWidth("auto");     // OK
setWidth("2.5rem");   // OK
// setWidth("100");   // Error: unit is missing
// setWidth("abc");   // Error

// CSS color types (hex colors)
type HexDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "a" | "b" | "c" | "d" | "e" | "f"
  | "A" | "B" | "C" | "D" | "E" | "F";

type HexColor = `#${string}`;  // Simplified version (strictly speaking, you'd need 6- or 8-digit checks)

// CSS function value types
type CSSFunction =
  | `rgb(${number}, ${number}, ${number})`
  | `rgba(${number}, ${number}, ${number}, ${number})`
  | `hsl(${number}, ${number}%, ${number}%)`
  | `calc(${string})`
  | `var(${CSSCustomProperty})`;

// CSS transform types
type CSSTransform =
  | `translateX(${CSSValue})`
  | `translateY(${CSSValue})`
  | `translate(${CSSValue}, ${CSSValue})`
  | `rotate(${number}deg)`
  | `scale(${number})`
  | `scale(${number}, ${number})`
  | `skewX(${number}deg)`
  | `skewY(${number}deg)`;

// CSS Grid / Flexbox types
type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";
type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
type FlexFlow = `${FlexDirection} ${FlexWrap}`;

type GridTemplate = `repeat(${number}, ${CSSValue | "1fr" | "auto"})` | string;

// From CSS property names to React style objects
type CSSPropertyName =
  | "background-color" | "font-size" | "font-weight" | "font-family"
  | "border-radius" | "border-width" | "border-color" | "border-style"
  | "margin-top" | "margin-right" | "margin-bottom" | "margin-left"
  | "padding-top" | "padding-right" | "padding-bottom" | "padding-left"
  | "line-height" | "letter-spacing" | "text-align" | "text-decoration"
  | "box-shadow" | "text-shadow" | "z-index" | "opacity";

type CSSToReact<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Head}${Capitalize<CSSToReact<Tail>>}`
    : S;

type ReactProperty = CSSToReact<"background-color">;  // "backgroundColor"
type ReactProperty2 = CSSToReact<"border-top-width">; // "borderTopWidth"
```

### 4.2 Type-Safe SQL Queries

```typescript
// Extract column names from a SELECT clause
type ExtractColumns<S extends string> =
  S extends `${infer Col}, ${infer Rest}`
    ? Trim<Col> | ExtractColumns<Rest>
    : Trim<S>;

// Extract the table name
type ExtractTable<S extends string> =
  S extends `${string} FROM ${infer Table} ${string}`
    ? Trim<Table>
    : S extends `${string} FROM ${infer Table}`
      ? Trim<Table>
      : never;

// Type-level parsing of a SELECT query
type ParseSelect<S extends string> =
  S extends `SELECT ${infer Columns} FROM ${infer Rest}`
    ? {
        columns: ExtractColumns<Columns>;
        table: Rest extends `${infer Table} WHERE ${string}`
          ? Trim<Table>
          : Trim<Rest>;
      }
    : never;

type Parsed = ParseSelect<"SELECT name, email, age FROM users WHERE id = 1">;
// {
//   columns: "name" | "email" | "age";
//   table: "users";
// }

// Type-safe SQL builder (conceptual implementation)
type TableName = "users" | "posts" | "comments";

type TableSchema = {
  users: {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
  };
  posts: {
    id: number;
    title: string;
    content: string;
    authorId: number;
    published: boolean;
  };
  comments: {
    id: number;
    text: string;
    postId: number;
    authorId: number;
  };
};

// Constrain selectable columns by type
type ValidColumn<T extends TableName> = keyof TableSchema[T] & string;

type SelectResult<T extends TableName, Cols extends ValidColumn<T>> =
  Pick<TableSchema[T], Cols>;

// Usage example
function select<T extends TableName, C extends ValidColumn<T>>(
  table: T,
  columns: C[]
): Promise<SelectResult<T, C>[]> {
  // Implementation...
  return Promise.resolve([]);
}

// Type-safe usage
const result = await select("users", ["name", "email"]);
// result is Pick<TableSchema["users"], "name" | "email">[]
// = { name: string; email: string }[]
```

### 4.3 A Type-Level JSON Parser

```typescript
// Convert numeric strings to numbers
type StringToNumber<S extends string> =
  S extends `${infer N extends number}` ? N : never;

type N1 = StringToNumber<"42">;    // 42
type N2 = StringToNumber<"0">;     // 0
type N3 = StringToNumber<"3.14">;  // 3.14

// Convert boolean strings to booleans
type StringToBoolean<S extends string> =
  S extends "true" ? true :
  S extends "false" ? false :
  never;

// Compute string length at the type level
type StringLength<
  S extends string,
  Acc extends unknown[] = []
> = S extends `${string}${infer Rest}`
  ? StringLength<Rest, [...Acc, unknown]>
  : Acc["length"];

type L1 = StringLength<"hello">;      // 5
type L2 = StringLength<"">;           // 0
type L3 = StringLength<"TypeScript">; // 10

// Repeating a string
type Repeat<
  S extends string,
  N extends number,
  Counter extends any[] = [],
  Result extends string = ""
> = Counter["length"] extends N
  ? Result
  : Repeat<S, N, [...Counter, 0], `${Result}${S}`>;

type Rep1 = Repeat<"ab", 3>;    // "ababab"
type Rep2 = Repeat<"-", 5>;     // "-----"
type Rep3 = Repeat<"ha", 2>;    // "haha"

// Padding
type PadStart<
  S extends string,
  Length extends number,
  Pad extends string = " "
> = StringLength<S> extends Length
  ? S
  : PadStart<`${Pad}${S}`, Length, Pad>;

type Padded = PadStart<"42", 5, "0">;  // "00042"
```

### 4.4 Type-Safe Template Engine

```typescript
// Extract placeholders from a template string
type ExtractPlaceholders<T extends string> =
  T extends `${string}{{${infer Name}}}${infer Rest}`
    ? Name | ExtractPlaceholders<Rest>
    : never;

type Placeholders = ExtractPlaceholders<"Hello, {{name}}! You have {{count}} messages.">;
// "name" | "count"

// Automatically generate a data type for the template
type TemplateData<T extends string> = {
  [K in ExtractPlaceholders<T>]: string | number;
};

type Data = TemplateData<"Hello, {{name}}! You have {{count}} messages.">;
// { name: string | number; count: string | number }

// Type-safe template rendering function
function render<T extends string>(
  template: T,
  data: TemplateData<T>
): string {
  let result: string = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return result;
}

// Usage example
const message = render(
  "Hello, {{name}}! You have {{count}} new messages.",
  { name: "Alice", count: 5 }  // name and count are required
);

// render(
//   "Hello, {{name}}!",
//   { name: "Alice", count: 5 }  // Error: count is unnecessary
// );

// render(
//   "Hello, {{name}}! {{greeting}}",
//   { name: "Alice" }  // Error: greeting is missing
// );

// Mustache-style section parsing
type ExtractSections<T extends string> =
  T extends `${string}{{#${infer Section}}}${infer Content}{{/${infer _End}}}${infer Rest}`
    ? { section: Section; content: Content } | ExtractSections<Rest>
    : never;

type Sections = ExtractSections<"{{#items}}{{name}}: {{price}}{{/items}}{{#footer}}{{text}}{{/footer}}">;
// { section: "items"; content: "{{name}}: {{price}}" } | { section: "footer"; content: "{{text}}" }
```

### 4.5 Type-Safe Regex-Like Patterns

```typescript
// Simplified regex-like pattern matching types

// Email address pattern (simplified version)
type EmailPattern = `${string}@${string}.${string}`;

// IPv4 address pattern (simplified version)
type IPv4Pattern = `${number}.${number}.${number}.${number}`;

// Semantic versioning
type SemVer = `${number}.${number}.${number}`;
type SemVerWithPre = `${number}.${number}.${number}-${string}`;
type SemVerFull = SemVer | SemVerWithPre;

// Parsing a semantic version
type ParseSemVer<S extends string> =
  S extends `${infer Major extends number}.${infer Minor extends number}.${infer Patch extends number}-${infer Pre}`
    ? { major: Major; minor: Minor; patch: Patch; prerelease: Pre }
    : S extends `${infer Major extends number}.${infer Minor extends number}.${infer Patch extends number}`
      ? { major: Major; minor: Minor; patch: Patch; prerelease: never }
      : never;

type Version = ParseSemVer<"1.2.3">;
// { major: 1; minor: 2; patch: 3; prerelease: never }

type VersionPre = ParseSemVer<"2.0.0-beta.1">;
// { major: 2; minor: 0; patch: 0; prerelease: "beta.1" }

// Date patterns
type DatePattern = `${number}-${number}-${number}`;
type TimePattern = `${number}:${number}:${number}`;
type DateTimePattern = `${DatePattern}T${TimePattern}`;

// Parsing ISO 8601 dates
type ParseDate<S extends string> =
  S extends `${infer Y extends number}-${infer M extends number}-${infer D extends number}`
    ? { year: Y; month: M; day: D }
    : never;

type ParsedDate = ParseDate<"2024-12-25">;
// { year: 2024; month: 12; day: 25 }

// UUID pattern
type UUIDSegment = `${string}`;
type UUIDPattern = `${UUIDSegment}-${UUIDSegment}-${UUIDSegment}-${UUIDSegment}-${UUIDSegment}`;
```

---

## 5. Practical Patterns

### 5.1 Type-Safe Internationalization (i18n)

```typescript
// Type-safe management of translation keys
interface TranslationSchema {
  common: {
    save: "Save";
    cancel: "Cancel";
    delete: "Delete";
    confirm: "Confirm";
    loading: "Loading...";
  };
  auth: {
    login: "Log in";
    logout: "Log out";
    register: "Sign up";
    forgotPassword: "Forgot password?";
  };
  errors: {
    notFound: "Page not found";
    unauthorized: "Authentication required";
    validation: {
      required: "This field is required";
      minLength: "Please enter at least {{min}} characters";
      maxLength: "Please enter no more than {{max}} characters";
      email: "Please enter a valid email address";
      pattern: "Please use the {{pattern}} format";
    };
  };
}

// Generate translation keys via dot paths
type TranslationPath<T, Prefix extends string = ""> =
  T extends string
    ? Prefix
    : {
        [K in keyof T & string]:
          TranslationPath<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>;
      }[keyof T & string];

type TranslationKey = TranslationPath<TranslationSchema>;
// "common.save" | "common.cancel" | ... | "errors.validation.required" | ...

// Get the type of a translation value
type TranslationValue<T, Path extends string> =
  Path extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? TranslationValue<T[Key], Rest>
      : never
    : Path extends keyof T
      ? T[Path]
      : never;

// Extract placeholders
type ExtractI18nParams<S extends string> =
  S extends `${string}{{${infer Param}}}${infer Rest}`
    ? Param | ExtractI18nParams<Rest>
    : never;

// Type for the translation function
type TranslateParams<Key extends TranslationKey> =
  ExtractI18nParams<TranslationValue<TranslationSchema, Key> & string> extends never
    ? [params?: never]
    : [params: Record<ExtractI18nParams<TranslationValue<TranslationSchema, Key> & string>, string | number>];

function t<K extends TranslationKey>(
  key: K,
  ...args: TranslateParams<K>
): string {
  // Implementation...
  return "";
}

// Usage examples
t("common.save");                     // OK: no parameters
t("errors.validation.minLength", { min: 3 });    // OK: min parameter required
t("errors.validation.maxLength", { max: 100 });  // OK: max parameter required
// t("errors.validation.minLength");  // Error: parameters required
// t("invalid.key");                  // Error: invalid key
```

### 5.2 Type-Safe GraphQL Queries

```typescript
// GraphQL schema type definitions
type GraphQLSchema = {
  Query: {
    user: { args: { id: string }; return: User };
    users: { args: { limit?: number; offset?: number }; return: User[] };
    post: { args: { id: string }; return: Post };
    posts: { args: { authorId?: string }; return: Post[] };
  };
  User: {
    id: string;
    name: string;
    email: string;
    posts: Post[];
  };
  Post: {
    id: string;
    title: string;
    content: string;
    author: User;
  };
};

// Extract query fields
type ExtractFields<S extends string> =
  S extends `${infer Field} ${infer Rest}`
    ? Trim<Field> | ExtractFields<Rest>
    : S extends `${infer Field},${infer Rest}`
      ? Trim<Field> | ExtractFields<Rest>
      : Trim<S>;

// Type-safe GraphQL query result
type QueryResult<
  Schema extends Record<string, any>,
  Fields extends keyof Schema
> = Pick<Schema, Fields>;

// Usage example
type UserQueryResult = QueryResult<GraphQLSchema["User"], "id" | "name" | "email">;
// { id: string; name: string; email: string }
```

### 5.3 Type-Safe Environment Variables

```typescript
// Environment variable type definitions
type EnvSchema = {
  NODE_ENV: "development" | "production" | "test";
  PORT: `${number}`;
  DATABASE_URL: `${"postgres" | "mysql"}://${string}`;
  API_KEY: string;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
  CACHE_TTL: `${number}`;
  CORS_ORIGIN: `${"http" | "https"}://${string}`;
  REDIS_URL: `redis://${string}`;
};

// Accessor type for environment variables
type EnvAccessor<T extends Record<string, string>> = {
  get<K extends keyof T>(key: K): T[K];
  getOrDefault<K extends keyof T>(key: K, defaultValue: T[K]): T[K];
  has(key: keyof T): boolean;
  require<K extends keyof T>(key: K): NonNullable<T[K]>;
};

// Type-safe environment variable parser
type ParseEnvValue<T extends string> =
  T extends `${number}` ? number :
  T extends "true" | "false" ? boolean :
  string;

type ParsedEnv<T extends Record<string, string>> = {
  [K in keyof T]: ParseEnvValue<T[K]>;
};

type ParsedEnvSchema = ParsedEnv<EnvSchema>;
// {
//   NODE_ENV: string;  (because of literal types)
//   PORT: number;
//   DATABASE_URL: string;
//   API_KEY: string;
//   LOG_LEVEL: string;
//   CACHE_TTL: number;
//   CORS_ORIGIN: string;
//   REDIS_URL: string;
// }
```

### 5.4 Type-Safe Command Lines

```typescript
// CLI command type definitions
type Command = "init" | "build" | "deploy" | "test" | "lint";
type Flag = "--verbose" | "--quiet" | "--dry-run" | "--force" | "--watch";
type Option = "--config" | "--output" | "--env" | "--port";

type CLIInput = `${Command}${` ${Flag}`}${` ${Option}=${string}`}`;

// Parser for command arguments
type ParseFlags<S extends string> =
  S extends `${string}--${infer Flag} ${infer Rest}`
    ? `--${Flag extends `${infer Name} ${string}` ? Name : Flag}` | ParseFlags<Rest>
    : S extends `${string}--${infer Flag}`
      ? `--${Flag}`
      : never;

type ParseOptions<S extends string> =
  S extends `${string}--${infer Key}=${infer Value} ${infer Rest}`
    ? { [K in Key]: Value } & ParseOptions<Rest>
    : S extends `${string}--${infer Key}=${infer Value}`
      ? { [K in Key]: Value }
      : {};

type ParsedCommand = ParseOptions<"build --config=webpack.config.js --output=dist --env=production">;
// { config: "webpack.config.js" } & { output: "dist" } & { env: "production" }
```

---

## 6. Performance and Best Practices

### 6.1 Avoiding Union Explosion

```typescript
// BAD: combinations explode
// type Letter = "a" | "b" | "c" | ... | "z";  // 26 members
// type TwoLetters = `${Letter}${Letter}`;       // 26 × 26 = 676 members
// type ThreeLetters = `${Letter}${Letter}${Letter}`; // 17,576 members!
// → compilation becomes extremely slow

// GOOD: settle for a pattern
type ThreeLetters = `${string}${string}${string}`; // broad but fast

// GOOD: generate only the combinations you need
type ValidCodes = "AAA" | "BBB" | "CCC";  // defined manually

// GOOD: limit union sizes in template literal types
// Rough guidelines for the number of union members per position:
// - 2 × 2 × 2 = 8 → no issues
// - 10 × 10 = 100 → acceptable
// - 20 × 20 = 400 → may become somewhat slow
// - 50 × 50 = 2,500 → caution required
// - 100 × 100 = 10,000 → should be avoided

// Mitigation 1: constrain via branded types
type ThreeLetterCode = string & { readonly __brand: unique symbol };

function createCode(code: string): ThreeLetterCode {
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error("Invalid code");
  }
  return code as ThreeLetterCode;
}

// Mitigation 2: combine template literal types with runtime validation
type DateString = `${number}-${number}-${number}`;

function isDateString(s: string): s is DateString {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
```

### 6.2 Debugging Techniques

```typescript
// Technique 1: verify types step by step
type Step1 = ExtractParams<"/users/:userId/posts/:postId">;
// Hover to verify: "userId" | "postId"

type Step2 = RouteParams<"/users/:userId/posts/:postId">;
// Hover to verify: { userId: string; postId: string }

// Technique 2: type-checking helpers for tests
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

// Test cases
type TestSplit1 = Expect<Equal<Split<"a.b.c", ".">, ["a", "b", "c"]>>;
type TestJoin1 = Expect<Equal<Join<["a", "b", "c"], ".">, "a.b.c">>;
type TestReplace1 = Expect<Equal<Replace<"ab", "a", "x">, "xb">>;
type TestTrim1 = Expect<Equal<Trim<"  hello  ">, "hello">>;

// Technique 3: improve error messages
type ValidatePath<T extends string> =
  T extends `/${string}`
    ? T
    : `Path must start with '/'. Received: '${T}'`;

type ValidPath = ValidatePath<"/users">;    // "/users"
type InvalidPath = ValidatePath<"users">;   // "Path must start with '/'. Received: 'users'"
```

### 6.3 Best Practices

```typescript
// 1. Use template literal types as "pattern hints"
// Perform strict validation at runtime

// GOOD: indicate the pattern via types and validate at runtime
type Email = `${string}@${string}.${string}`;

function validateEmail(email: string): email is Email {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 2. Break things into small, reusable parts
type Protocol = "http" | "https";
type Domain = `${string}.${string}`;
type Path = `/${string}`;
type URL = `${Protocol}://${Domain}${Path}`;

// 3. Use case conversions only when necessary
// Prioritize type readability

// BAD: excessive case-conversion chains
type OverlyComplex<T extends string> =
  Capitalize<Lowercase<CamelToSnake<SnakeToCamel<T>>>>;

// GOOD: only the conversions you need
type ApiToCamel<T extends string> = SnakeToCamel<T>;

// 4. When combining with conditional types, do it step by step
// BAD: do everything in a single type
type DoEverything<T extends string> =
  T extends `${infer A}:${infer B}`
    ? `${Capitalize<A>}: ${B extends `${infer C}.${infer D}` ? `${Uppercase<C>}.${D}` : B}`
    : never;

// GOOD: split and name each part
type ParsePrefix<T extends string> =
  T extends `${infer Prefix}:${infer Rest}` ? [Prefix, Rest] : never;

type FormatPrefix<T extends string> = Capitalize<T>;

type FormatValue<T extends string> =
  T extends `${infer Head}.${infer Tail}` ? `${Uppercase<Head>}.${Tail}` : T;

// 5. Leave test types as documentation
type _TestCamelToSnake = Expect<Equal<CamelToSnake<"camelCase">, "camel_case">>;
type _TestSnakeToCamel = Expect<Equal<SnakeToCamel<"snake_case">, "snakeCase">>;
```

---

## Template Literal Types vs. Plain String Types

| Characteristic | string | Literal Type | Template Literal Type |
|----------------|--------|--------------|----------------------|
| Range | Any string | Specific values only | Strings matching a pattern |
| Example | `string` | `"hello"` | `` `hello-${string}` `` |
| Type safety | Low | High (fixed value) | Medium-to-high (pattern) |
| Use case | General-purpose | Constants | Patterned strings |
| Union expansion | None | None | Automatic cartesian expansion |
| infer | Not possible | Not possible | Pattern matching is possible |
| Performance | Fastest | Fast | Depends on union size |

### Expansion Rules for Template Literal Types

```
  `${A | B}${C | D}`
  Expansion:
    → `${A}${C}` | `${A}${D}` | `${B}${C}` | `${B}${D}`

  `${"get" | "set"}${"Name" | "Age"}`
  Expansion:
    → "getName" | "getAge" | "setName" | "setAge"

  `${string}` → string (represents a pattern)
  `${number}` → `${number}` (numeric string pattern)
  `${boolean}` → "true" | "false"
  `${bigint}` → `${bigint}` (bigint string pattern)

  Note: combinations may explode.
  |A| × |B| = number of resulting union members
```

---

## Anti-Patterns

### Anti-Pattern 1: Union Explosion

```typescript
// BAD: combinations explode
// type Letter = "a" | "b" | "c" | ... | "z";  // 26 members
// type TwoLetters = `${Letter}${Letter}`;       // 26 × 26 = 676 members
// type ThreeLetters = `${Letter}${Letter}${Letter}`; // 17,576 members!
// → compilation becomes extremely slow

// GOOD: settle for a pattern
type ThreeLetterPattern = `${string}${string}${string}`; // broad but fast
// Or combine with regex-based runtime validation
```

### Anti-Pattern 2: Using Template Literal Types Instead of Runtime Validation

```typescript
// BAD: try to validate email addresses with types alone
type Email = `${string}@${string}.${string}`;
const email: Email = "not-valid@@"; // this can sometimes pass

// GOOD: keep types as rough patterns, and use runtime validation
import { z } from "zod";
const emailSchema = z.string().email();
type EmailBrand = string & { readonly __email: unique symbol };

function parseEmail(input: string): EmailBrand {
  const result = emailSchema.parse(input);
  return result as EmailBrand;
}
```

### Anti-Pattern 3: Excessively Deep Recursion

```typescript
// BAD: iterating through every character of a string at the type level
type CountChar<S extends string, C extends string, Acc extends any[] = []> =
  S extends `${infer Head}${infer Tail}`
    ? Head extends C
      ? CountChar<Tail, C, [...Acc, 0]>
      : CountChar<Tail, C, Acc>
    : Acc["length"];

// OK for short strings, but causes stack overflow on long ones
type Count = CountChar<"hello world", "l">;  // 3

// GOOD: separate what should be done at the type level vs. at runtime
function countChar(s: string, c: string): number {
  return s.split(c).length - 1;
}
```

### Anti-Pattern 4: Ignoring Readability of Template Literal Types

```typescript
// BAD: too much crammed into one line
type ParseComplexURL<S extends string> = S extends `${infer P}://${infer U}@${infer H}:${infer Port extends number}/${infer Path}?${infer Q}#${infer F}` ? { protocol: P; user: U; host: H; port: Port; path: Path; query: Q; fragment: F } : never;

// GOOD: split into stages
type ParseProtocol<S extends string> =
  S extends `${infer Protocol}://${infer Rest}`
    ? { protocol: Protocol; rest: Rest }
    : never;

type ParseAuth<S extends string> =
  S extends `${infer User}@${infer Rest}`
    ? { user: User; rest: Rest }
    : { user: never; rest: S };

type ParseHost<S extends string> =
  S extends `${infer Host}:${infer Port extends number}/${infer Rest}`
    ? { host: Host; port: Port; rest: Rest }
    : S extends `${infer Host}/${infer Rest}`
      ? { host: Host; port: never; rest: Rest }
      : never;
// Combine each part to construct the final type
```

---

## FAQ

### Q1: What is the performance impact of template literal types?

**A:** Cartesian expansion of union types causes the number of combinations to grow rapidly. TypeScript can internally process up to roughly 100,000 union members, but compilation slows down well before reaching the thousands. Avoid cartesian products of large unions. As a rule of thumb, you should be fine if each position's union size is 10 or fewer.

### Q2: What is a practical way to ensure path type safety with template literal types?

**A:** Many routing libraries (React Router, tRPC, Hono, etc.) provide type-safe routing built on template literal types. Leveraging existing libraries' type definitions is more practical than rolling your own. If you do implement it yourself, break path-parameter extraction patterns into small utility types.

### Q3: What kinds of strings does `${number}` match?

**A:** It matches numeric literal representations such as `"0"`, `"42"`, `"3.14"`, and `"-1"`. However, scientific notation like `"1e10"` may also match. `"NaN"` and `"Infinity"` match as well. For strict numeric-string validation, combine with runtime checks.

```typescript
type Test1 = "42" extends `${number}` ? true : false;      // true
type Test2 = "3.14" extends `${number}` ? true : false;    // true
type Test3 = "-1" extends `${number}` ? true : false;      // true
type Test4 = "NaN" extends `${number}` ? true : false;     // true
type Test5 = "abc" extends `${number}` ? true : false;     // false
type Test6 = "" extends `${number}` ? true : false;        // false
```

### Q4: From which version of TypeScript can template literal types be used?

**A:** The basic feature was introduced in TypeScript 4.1, with improvements in subsequent releases:

- **4.1**: Introduction of template literal types and key remapping
- **4.3**: Improvements to template literal types (stronger combination with `infer`)
- **4.5**: Improvements to tail-call optimization (better support for deep recursion)
- **4.7**: Addition of the `infer extends` constraint
- **4.8**: Support for `${infer N extends number}` in template literal types

### Q5: What is the difference between template literal types and regular expressions?

**A:** Template literal types perform pattern matching at compile time on the type level, while regular expressions match strings at runtime. What you can do with template literal types is far more limited than regular expressions (no quantifiers or character classes). For complex pattern validation, the recommended approach is to define a rough pattern with template literal types and perform strict validation with regular expressions at runtime.

### Q6: How can you find out the number of union members generated from a template literal type?

**A:** It is difficult to count members directly at the type level, but conceptually you can use a type like `UnionToTuple`. In practice, it is more pragmatic to confirm the expanded type via the editor's hover display, or to verify expected members are included via type tests.

---

## Summary

| Item | Details |
|------|---------|
| Basic syntax | `` `prefix-${Type}` `` turns string patterns into types |
| Union expansion | `${A \| B}` is automatically expanded as a cartesian product |
| String manipulation | Uppercase, Lowercase, Capitalize, Uncapitalize |
| infer | Pattern matching is possible inside template literal types |
| Case conversion | Custom types like CamelToSnake and SnakeToCamel |
| Path types | Useful for type-safe extraction of URL parameters |
| String operations | Type-level operations like Split, Join, Replace, Trim |
| Practical patterns | CSS, SQL, i18n, template engines, and more |
| Caveats | Watch out for compilation slowdowns due to union explosion |
| Best practices | Split into small parts and combine with runtime validation |

---

## Recommended Next Reads

- [03-type-challenges.md](./03-type-challenges.md) -- Type challenges
- [04-declaration-files.md](./04-declaration-files.md) -- Declaration files
- [00-conditional-types.md](./00-conditional-types.md) -- Conditional types
- [01-mapped-types.md](./01-mapped-types.md) -- Mapped types

---

## References

1. **TypeScript Handbook: Template Literal Types** -- https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
2. **TypeScript 4.1 Release Notes** -- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html
3. **Matt Pocock: Template Literal Types** -- https://www.totaltypescript.com/books/total-typescript-essentials/template-literal-types
4. **Type-Level TypeScript: Template Literal Types** -- https://type-level-typescript.com/template-literal-types
5. **TypeScript 4.8 Release Notes** -- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-8.html
