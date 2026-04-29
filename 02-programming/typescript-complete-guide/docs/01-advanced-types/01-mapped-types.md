# Mapped Types

> Transform existing types to generate new ones. Understand the inner workings of utility types like Partial, Required, Readonly, and Record, and build your own mapped types.

## What You Will Learn in This Chapter

1. **Mapped Type Basics** -- The `{ [K in keyof T]: ... }` syntax and property transformation
2. **Built-in Utility Types** -- Internal implementations of Partial, Required, Readonly, Record, Pick, and Omit
3. **Key Remapping** -- Key name transformation and filtering using the `as` clause
4. **Advanced Mapped Types** -- Recursive mapped types, conditional mapping, and composite patterns
5. **Practical Patterns** -- Form state management, API type transformation, and event system design
6. **Performance and Debugging** -- Compilation performance and troubleshooting for mapped types


## Prerequisites

This guide is easier to understand if you have the following knowledge:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [Conditional Types](./00-conditional-types.md)

---

## 1. Mapped Type Basics

### 1.1 Basic Syntax

Mapped types iterate over the keys of an existing type to construct a new type. Conceptually similar to JavaScript's `Array.map()`, they transform types.

```typescript
// Basic syntax: { [K in keyof T]: transformed type }
// For each property key K in T, specify the transformed type

// Make every property of T be of type string
type Stringify<T> = {
  [K in keyof T]: string;
};

interface User {
  id: number;
  name: string;
  active: boolean;
}

type StringUser = Stringify<User>;
// { id: string; name: string; active: string }

// Make every property of T optional (equivalent to Partial)
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};

type PartialUser = MyPartial<User>;
// { id?: number; name?: string; active?: boolean }

// Wrap every property of T in a Promise
type Promisified<T> = {
  [K in keyof T]: Promise<T[K]>;
};

type PromiseUser = Promisified<User>;
// { id: Promise<number>; name: Promise<string>; active: Promise<boolean> }

// Make every property of T an array
type Arrayified<T> = {
  [K in keyof T]: T[K][];
};

type ArrayUser = Arrayified<User>;
// { id: number[]; name: string[]; active: boolean[] }
```

### 1.2 Conceptual View of Mapped Type Transformation

```
  Original type T              Mapped type { [K in keyof T]: F(T[K]) }
+------------------+        +------------------+
| id: number       |  --->  | id: F(number)    |
| name: string     |  --->  | name: F(string)  |
| active: boolean  |  --->  | active: F(bool)  |
+------------------+        +------------------+

  Conceptually, transformation function F is applied to each property

  Components of a mapped type:
  { [K in keyof T]: T[K] }
     ^  ^     ^       ^
     |  |     |       +--- Value type (transformable)
     |  |     +----------- Iteration target
     |  +----------------- Iteration variable
     +--------------------- Property key
```

### 1.3 Adding and Removing Modifiers

```typescript
// Add readonly
type MyReadonly<T> = {
  readonly [K in keyof T]: T[K];
};

// Remove readonly (-readonly)
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

// Remove optional (-?)
type MyRequired<T> = {
  [K in keyof T]-?: T[K];
};

// Example
interface Config {
  readonly host: string;
  readonly port: number;
  debug?: boolean;
}

type MutableConfig = Mutable<Config>;
// { host: string; port: number; debug?: boolean }

type RequiredConfig = MyRequired<Config>;
// { readonly host: string; readonly port: number; debug: boolean }

// Manipulate both modifiers simultaneously
type MutableRequired<T> = {
  -readonly [K in keyof T]-?: T[K];
};

type MutableRequiredConfig = MutableRequired<Config>;
// { host: string; port: number; debug: boolean }

// Make readonly and optional at the same time
type ReadonlyPartial<T> = {
  readonly [K in keyof T]?: T[K];
};

type ReadonlyPartialConfig = ReadonlyPartial<Config>;
// { readonly host?: string; readonly port?: number; readonly debug?: boolean }
```

### 1.4 Detailed Behavior of keyof

```typescript
// keyof returns a union of all property keys of a type
interface Example {
  name: string;
  age: number;
  0: boolean;
  [Symbol.iterator]: () => Iterator<any>;
}

type Keys = keyof Example;
// "name" | "age" | 0 | typeof Symbol.iterator
// → can be any of string | number | symbol

// Use only string keys in a mapped type
type StringKeysOnly<T> = {
  [K in keyof T & string]: T[K];
};

// Use only number keys
type NumberKeysOnly<T> = {
  [K in keyof T & number]: T[K];
};

// Special case of keyof: index signatures
interface IndexSignature {
  [key: string]: number;
  specific: 42;
}

type ISKeys = keyof IndexSignature;
// string | number (due to the index signature)
// "specific" is included in string

// keyof of an array type
type ArrayKeys = keyof string[];
// number | "length" | "push" | "pop" | "concat" | ... (also includes array methods)

// keyof of a tuple type
type TupleKeys = keyof [string, number];
// "0" | "1" | "length" | "push" | ... (also includes array methods)
```

### 1.5 Mapped Types and the in Operator

```typescript
// The in operator iterates over members of a union type
// You can use any union type, not just keyof T

// Generate a type from a union of string literals
type StatusFlags = {
  [K in "loading" | "error" | "success"]: boolean;
};
// { loading: boolean; error: boolean; success: boolean }

// Generate a type from a union of numeric literals
type DigitMap = {
  [K in 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9]: string;
};

// Combine with template literal types
type CSSVariables = {
  [K in `--color-${"primary" | "secondary" | "accent"}`]: string;
};
// {
//   "--color-primary": string;
//   "--color-secondary": string;
//   "--color-accent": string;
// }
```

---

## 2. Built-in Utility Types

### 2.1 Implementations of Major Utility Types

```typescript
// Partial<T>: make every property optional
type Partial<T> = { [K in keyof T]?: T[K] };

// Required<T>: make every property required
type Required<T> = { [K in keyof T]-?: T[K] };

// Readonly<T>: make every property readonly
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// Record<K, V>: generate an object type from a set of keys
type Record<K extends keyof any, T> = { [P in K]: T };

// Pick<T, K>: extract only specific properties
type Pick<T, K extends keyof T> = { [P in K]: T[P] };

// Omit<T, K>: exclude specific properties
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
```

### 2.2 Patterns for Using Utility Types

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

// On update, all fields are optional (id and createdAt cannot be changed)
type UpdateUser = Partial<Omit<User, "id" | "createdAt">>;
// { name?: string; email?: string; password?: string; updatedAt?: Date }

// Public API response (excluding password)
type PublicUser = Omit<User, "password">;
// { id: number; name: string; email: string; createdAt: Date; updatedAt: Date }

// Type for creation (id and timestamps are auto-generated)
type CreateUser = Omit<User, "id" | "createdAt" | "updatedAt">;
// { name: string; email: string; password: string }

// Status map
type StatusMap = Record<"pending" | "active" | "inactive", number>;
// { pending: number; active: number; inactive: number }

// Partially Readonly
type UserWithReadonlyId = Readonly<Pick<User, "id">> & Omit<User, "id">;
// { readonly id: number; name: string; email: string; ... }

// Partially Partial
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type UserOptionalEmail = PartialBy<User, "email" | "password">;
// { id: number; name: string; email?: string; password?: string; createdAt: Date; updatedAt: Date }

// Partially Required
type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
```

### 2.3 Advanced Usage of Record

```typescript
// Lookup table using Record
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

type EndpointConfig = {
  path: string;
  auth: boolean;
  rateLimit: number;
};

type ApiEndpoints = Record<HttpMethod, EndpointConfig[]>;

// Combination of Record and generics
type EntityStore<T extends string, E> = Record<T, E[]>;

// Usage example
interface Product {
  id: string;
  name: string;
  price: number;
}

type ProductStore = EntityStore<"electronics" | "clothing" | "food", Product>;
// {
//   electronics: Product[];
//   clothing: Product[];
//   food: Product[];
// }

// Cache type using Record
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

type Cache<Keys extends string, Value> = Record<Keys, CacheEntry<Value> | null>;

// Type-safe initialization of a Record
function createRecord<K extends string, V>(
  keys: K[],
  initialValue: V
): Record<K, V> {
  const result = {} as Record<K, V>;
  for (const key of keys) {
    result[key] = initialValue;
  }
  return result;
}

const flags = createRecord(["loading", "error", "success"] as const, false);
// Record<"loading" | "error" | "success", boolean>
```

### 2.4 Advanced Patterns with Pick and Omit

```typescript
// Conditional Pick: select only properties of a particular type
type PickByType<T, ValueType> = {
  [K in keyof T as T[K] extends ValueType ? K : never]: T[K];
};

interface UserProfile {
  name: string;
  age: number;
  email: string;
  isActive: boolean;
  score: number;
  bio: string;
}

type StringFields = PickByType<UserProfile, string>;
// { name: string; email: string; bio: string }

type NumberFields = PickByType<UserProfile, number>;
// { age: number; score: number }

// Conditional Omit: exclude properties of a particular type
type OmitByType<T, ValueType> = {
  [K in keyof T as T[K] extends ValueType ? never : K]: T[K];
};

type NonStringFields = OmitByType<UserProfile, string>;
// { age: number; isActive: boolean; score: number }

// Recursive Pick: extract only a specific path from a nested object
type DeepPick<T, Paths extends string> =
  Paths extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? { [K in Key]: DeepPick<T[Key], Rest> }
      : never
    : Paths extends keyof T
      ? { [K in Paths]: T[Paths] }
      : never;

interface NestedUser {
  profile: {
    name: string;
    avatar: {
      url: string;
      size: number;
    };
  };
  settings: {
    theme: string;
    notifications: boolean;
  };
}

type JustAvatar = DeepPick<NestedUser, "profile.avatar.url">;
// { profile: { avatar: { url: string } } }
```

### Relationships Among Utility Types

```
  Original type T
    |
    +---> Partial<T>     Add ? to every property
    |
    +---> Required<T>    Remove ? from every property
    |
    +---> Readonly<T>    Add readonly to every property
    |
    +---> Pick<T, K>     Extract only the specified properties
    |       |
    |       +---> Omit<T, K> = Pick<T, Exclude<keyof T, K>>
    |
    +---> Record<K, V>   Key set -> generate object type
    |
    +--- Combination patterns ---+
    |                             |
    +---> PartialBy<T, K>         Omit<T, K> & Partial<Pick<T, K>>
    +---> RequiredBy<T, K>        Omit<T, K> & Required<Pick<T, K>>
    +---> ReadonlyBy<T, K>        Omit<T, K> & Readonly<Pick<T, K>>
    +---> PickByType<T, V>        Filter by value type
    +---> OmitByType<T, V>        Exclude by value type
```

---

## 3. Key Remapping

### 3.1 Key Transformation via the as Clause

Key Remapping (the `as` clause), introduced in TypeScript 4.1, lets you transform mapped type keys dynamically.

```typescript
// Add a prefix to property names
type Prefixed<T, P extends string> = {
  [K in keyof T as `${P}${Capitalize<string & K>}`]: T[K];
};

interface User {
  name: string;
  age: number;
}

type PrefixedUser = Prefixed<User, "get">;
// { getName: string; getAge: number }

// Add a suffix
type Suffixed<T, S extends string> = {
  [K in keyof T as `${string & K}${S}`]: T[K];
};

type UserChangedFlags = Suffixed<User, "Changed">;
// { nameChanged: string; ageChanged: number }

// Convert to getter methods
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// Convert to setter methods
type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

type UserSetters = Setters<User>;
// { setName: (value: string) => void; setAge: (value: number) => void }

// Compose getters and setters
type GettersAndSetters<T> = Getters<T> & Setters<T>;

type UserAccessors = GettersAndSetters<User>;
// {
//   getName: () => string;
//   getAge: () => number;
//   setName: (value: string) => void;
//   setAge: (value: number) => void;
// }
```

### 3.2 Filtering

```typescript
// Extract only properties of a specific type (filtering)
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

interface Mixed {
  name: string;
  age: number;
  email: string;
  active: boolean;
}

type StringProps = OnlyStrings<Mixed>;
// { name: string; email: string }

// Extract only function properties
type OnlyFunctions<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K];
};

interface Service {
  name: string;
  port: number;
  start: () => void;
  stop: () => void;
  getStatus: () => string;
}

type ServiceMethods = OnlyFunctions<Service>;
// { start: () => void; stop: () => void; getStatus: () => string }

// Extract non-function properties
type OnlyData<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K];
};

type ServiceData = OnlyData<Service>;
// { name: string; port: number }

// Extract only properties with a specific prefix
type WithPrefix<T, P extends string> = {
  [K in keyof T as K extends `${P}${string}` ? K : never]: T[K];
};

interface AppConfig {
  dbHost: string;
  dbPort: number;
  dbName: string;
  apiKey: string;
  apiUrl: string;
  logLevel: string;
}

type DbConfig = WithPrefix<AppConfig, "db">;
// { dbHost: string; dbPort: number; dbName: string }

type ApiConfig = WithPrefix<AppConfig, "api">;
// { apiKey: string; apiUrl: string }

// Strip the prefix and remap
type StripPrefix<T, P extends string> = {
  [K in keyof T as K extends `${P}${infer Rest}`
    ? Uncapitalize<Rest>
    : never]: T[K];
};

type CleanDbConfig = StripPrefix<AppConfig, "db">;
// { host: string; port: number; name: string }
```

### 3.3 Generating Event Handlers

```typescript
// Auto-generate handler types from event names
type EventMap = {
  click: { x: number; y: number };
  focus: { target: HTMLElement };
  submit: { data: FormData };
  resize: { width: number; height: number };
  scroll: { scrollTop: number; scrollLeft: number };
};

type EventHandlers<T> = {
  [K in keyof T as `on${Capitalize<string & K>}`]: (event: T[K]) => void;
};

type Handlers = EventHandlers<EventMap>;
// {
//   onClick: (event: { x: number; y: number }) => void;
//   onFocus: (event: { target: HTMLElement }) => void;
//   onSubmit: (event: { data: FormData }) => void;
//   onResize: (event: { width: number; height: number }) => void;
//   onScroll: (event: { scrollTop: number; scrollLeft: number }) => void;
// }

// Generate add/remove event listener methods
type EventMethods<T> = {
  [K in keyof T as `add${Capitalize<string & K>}Listener`]:
    (handler: (event: T[K]) => void) => void;
} & {
  [K in keyof T as `remove${Capitalize<string & K>}Listener`]:
    (handler: (event: T[K]) => void) => void;
};

type EventEmitterMethods = EventMethods<EventMap>;
// {
//   addClickListener: (handler: (event: { x: number; y: number }) => void) => void;
//   removeClickListener: (handler: (event: { x: number; y: number }) => void) => void;
//   addFocusListener: ...
//   removeFocusListener: ...
//   ...
// }

// Reverse mapping (derive the event name from a handler name)
type HandlerToEvent<T extends string> =
  T extends `on${infer E}` ? Uncapitalize<E> : never;

type EventName = HandlerToEvent<"onClick">;  // "click"
type EventName2 = HandlerToEvent<"onResize">; // "resize"
```

### 3.4 Camel Case Conversion

```typescript
// Key conversion from snake_case to camelCase
type SnakeToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
    : S;

type CamelizeKeys<T> = {
  [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K] extends object
    ? T[K] extends any[]
      ? T[K]
      : CamelizeKeys<T[K]>
    : T[K];
};

// API response (snake_case)
interface ApiResponse {
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

type CamelizedResponse = CamelizeKeys<ApiResponse>;
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

// camelCase to snake_case
type CamelToSnake<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends Uppercase<First>
      ? First extends Lowercase<First>
        ? `${First}${CamelToSnake<Rest>}`
        : `_${Lowercase<First>}${CamelToSnake<Rest>}`
      : `${First}${CamelToSnake<Rest>}`
    : S;

type SnakifyKeys<T> = {
  [K in keyof T as K extends string ? CamelToSnake<K> : K]: T[K] extends object
    ? T[K] extends any[]
      ? T[K]
      : SnakifyKeys<T[K]>
    : T[K];
};
```

---

## 4. Advanced Mapped Types

### 4.1 DeepPartial and DeepReadonly

```typescript
// DeepPartial: recursively make every property optional
type DeepPartial<T> =
  T extends (...args: any[]) => any
    ? T  // leave functions as-is
    : T extends any[]
      ? DeepPartialArray<T>
      : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

type DeepPartialArray<T extends any[]> = {
  [K in keyof T]?: DeepPartial<T[K]>;
};

interface Config {
  server: {
    host: string;
    port: number;
    ssl: {
      cert: string;
      key: string;
      passphrase: string;
    };
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    file: string;
    format: {
      timestamp: boolean;
      colors: boolean;
    };
  };
  features: string[];
}

type PartialConfig = DeepPartial<Config>;
// All nested properties are also optional

// Merge function that allows updating just deep parts
function deepMerge<T extends object>(
  base: T,
  updates: DeepPartial<T>
): T {
  const result = { ...base } as any;
  for (const key of Object.keys(updates) as (keyof T)[]) {
    const updateValue = (updates as any)[key];
    if (
      updateValue !== undefined &&
      typeof updateValue === "object" &&
      !Array.isArray(updateValue) &&
      updateValue !== null
    ) {
      result[key] = deepMerge(result[key] as object, updateValue);
    } else if (updateValue !== undefined) {
      result[key] = updateValue;
    }
  }
  return result;
}

// Usage example
const defaultConfig: Config = {
  server: { host: "localhost", port: 3000, ssl: { cert: "", key: "", passphrase: "" } },
  logging: { level: "info", file: "app.log", format: { timestamp: true, colors: false } },
  features: ["auth", "api"],
};

const updatedConfig = deepMerge(defaultConfig, {
  server: { port: 8080 },           // change only port
  logging: { level: "debug" },       // change only level
});

// DeepReadonly: recursively make every property readonly
type DeepReadonly<T> =
  T extends (...args: any[]) => any
    ? T
    : T extends any[]
      ? readonly [...{ [K in keyof T]: DeepReadonly<T[K]> }]
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

type FrozenConfig = DeepReadonly<Config>;
// All nested properties become readonly
// features becomes readonly string[]

// DeepRequired: recursively make every property required
type DeepRequired<T> =
  T extends (...args: any[]) => any
    ? T
    : T extends any[]
      ? T
      : T extends object
        ? { [K in keyof T]-?: DeepRequired<T[K]> }
        : T;

// DeepMutable: recursively remove readonly
type DeepMutable<T> =
  T extends (...args: any[]) => any
    ? T
    : T extends any[]
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T extends object
        ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
        : T;
```

### 4.2 Conditional Mapping

```typescript
// Apply different transformations depending on the property's type
type TransformByType<T> = {
  [K in keyof T]: T[K] extends string
    ? { type: "string"; value: T[K]; maxLength: number }
    : T[K] extends number
      ? { type: "number"; value: T[K]; min: number; max: number }
      : T[K] extends boolean
        ? { type: "boolean"; value: T[K] }
        : T[K] extends any[]
          ? { type: "array"; value: T[K]; minItems: number; maxItems: number }
          : { type: "object"; value: T[K] };
};

interface Product {
  name: string;
  price: number;
  inStock: boolean;
  tags: string[];
}

type ProductSchema = TransformByType<Product>;
// {
//   name: { type: "string"; value: string; maxLength: number };
//   price: { type: "number"; value: number; min: number; max: number };
//   inStock: { type: "boolean"; value: boolean };
//   tags: { type: "array"; value: string[]; minItems: number; maxItems: number };
// }

// Make only nullable properties strict (remove null)
type StrictNonNullable<T> = {
  [K in keyof T]: NonNullable<T[K]>;
};

interface ApiUser {
  name: string;
  email: string | null;
  phone: string | null | undefined;
  age: number | undefined;
}

type StrictUser = StrictNonNullable<ApiUser>;
// { name: string; email: string; phone: string; age: number }

// Make only nullable properties optional
type NullableToOptional<T> = {
  [K in keyof T as null extends T[K] ? never : undefined extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as null extends T[K] ? K : undefined extends T[K] ? K : never]?: NonNullable<T[K]>;
};

type OptionalizedUser = NullableToOptional<ApiUser>;
// { name: string } & { email?: string; phone?: string; age?: number }
```

### 4.3 Combining With Template Literal Types

```typescript
// Generate a React style object from CSS properties
type CSSProperties = {
  "background-color": string;
  "font-size": string;
  "border-radius": string;
  "margin-top": string;
  "padding-left": string;
};

// kebab-case to camelCase
type KebabToCamel<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Head}${Capitalize<KebabToCamel<Tail>>}`
    : S;

type ReactStyle = {
  [K in keyof CSSProperties as K extends string ? KebabToCamel<K> : K]:
    CSSProperties[K];
};
// {
//   backgroundColor: string;
//   fontSize: string;
//   borderRadius: string;
//   marginTop: string;
//   paddingLeft: string;
// }

// Type definitions for environment variables
type EnvVarName = "DATABASE_URL" | "API_KEY" | "PORT" | "NODE_ENV";

// Type-safe accessors for process.env
type EnvAccessors = {
  [K in EnvVarName as `get${SnakeToPascal<K>}`]: () => string;
};

type SnakeToPascal<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Capitalize<Lowercase<Head>>}${SnakeToPascal<Tail>}`
    : Capitalize<Lowercase<S>>;

// EnvAccessors:
// {
//   getDatabaseUrl: () => string;
//   getApiKey: () => string;
//   getPort: () => string;
//   getNodeEnv: () => string;
// }
```

### 4.4 Practical Combinations of Mapped Types

```typescript
// Auto-generate form state types
interface FormFields {
  username: string;
  email: string;
  age: number;
  bio: string;
  agreeToTerms: boolean;
}

// State of each field
type FieldState<T> = {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
  validating: boolean;
};

// Overall form state
type FormState<T> = {
  fields: {
    [K in keyof T]: FieldState<T[K]>;
  };
  isValid: boolean;
  isSubmitting: boolean;
  submitCount: number;
};

type MyFormState = FormState<FormFields>;
// {
//   fields: {
//     username: FieldState<string>;
//     email: FieldState<string>;
//     age: FieldState<number>;
//     bio: FieldState<string>;
//     agreeToTerms: FieldState<boolean>;
//   };
//   isValid: boolean;
//   isSubmitting: boolean;
//   submitCount: number;
// }

// Type for form validation rules
type ValidationRule<T> = {
  validate: (value: T) => boolean;
  message: string;
};

type FormValidation<T> = {
  [K in keyof T]?: ValidationRule<T[K]>[];
};

const validationRules: FormValidation<FormFields> = {
  username: [
    { validate: (v) => v.length >= 3, message: "Must be at least 3 characters" },
    { validate: (v) => /^[a-zA-Z0-9]+$/.test(v), message: "Only alphanumeric characters allowed" },
  ],
  email: [
    { validate: (v) => v.includes("@"), message: "Please enter a valid email address" },
  ],
  age: [
    { validate: (v) => v >= 0, message: "Please enter a number greater than or equal to 0" },
    { validate: (v) => v <= 150, message: "Please enter a number less than or equal to 150" },
  ],
  agreeToTerms: [
    { validate: (v) => v === true, message: "You must agree to the terms of service" },
  ],
};

// Auto-generate form action types
type FormActions<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
} & {
  [K in keyof T as `validate${Capitalize<string & K>}`]: () => boolean;
} & {
  [K in keyof T as `reset${Capitalize<string & K>}`]: () => void;
} & {
  submit: () => Promise<void>;
  reset: () => void;
  validateAll: () => boolean;
};

type MyFormActions = FormActions<FormFields>;
// {
//   setUsername: (value: string) => void;
//   setEmail: (value: string) => void;
//   setAge: (value: number) => void;
//   ...
//   validateUsername: () => boolean;
//   validateEmail: () => boolean;
//   ...
//   resetUsername: () => void;
//   ...
//   submit: () => Promise<void>;
//   reset: () => void;
//   validateAll: () => boolean;
// }
```

---

## 5. Practical Patterns

### 5.1 Type Definitions for an API Client

```typescript
// RESTful API endpoint definitions
interface ApiEndpoints {
  "/users": {
    GET: { response: User[]; query: { page: number; limit: number } };
    POST: { response: User; body: CreateUser };
  };
  "/users/:id": {
    GET: { response: User; params: { id: string } };
    PUT: { response: User; body: UpdateUser; params: { id: string } };
    DELETE: { response: void; params: { id: string } };
  };
  "/posts": {
    GET: { response: Post[]; query: { page: number; limit: number; userId?: string } };
    POST: { response: Post; body: CreatePost };
  };
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// Generate the request type from an endpoint
type RequestConfig<
  Path extends keyof ApiEndpoints,
  Method extends keyof ApiEndpoints[Path]
> = ApiEndpoints[Path][Method] extends { body: infer B }
  ? { body: B }
  : {} & (ApiEndpoints[Path][Method] extends { query: infer Q }
    ? { query: Q }
    : {}) & (ApiEndpoints[Path][Method] extends { params: infer P }
    ? { params: P }
    : {});

// Get the response type from an endpoint
type ResponseType<
  Path extends keyof ApiEndpoints,
  Method extends keyof ApiEndpoints[Path]
> = ApiEndpoints[Path][Method] extends { response: infer R }
  ? R
  : never;

// Type-safe API client
class ApiClient {
  async request<
    Path extends keyof ApiEndpoints,
    Method extends keyof ApiEndpoints[Path] & string
  >(
    method: Method,
    path: Path,
    config?: RequestConfig<Path, Method>
  ): Promise<ResponseType<Path, Method>> {
    // implementation...
    return {} as ResponseType<Path, Method>;
  }
}

// Usage example
const api = new ApiClient();

// API calls are type-safe
const users = await api.request("GET", "/users", {
  query: { page: 1, limit: 10 },
});
// users is of type User[]

const newUser = await api.request("POST", "/users", {
  body: { name: "Alice", email: "alice@example.com", password: "secret" },
});
// newUser is of type User
```

### 5.2 State Management Patterns

```typescript
// Type-safe Zustand-style store definition
type StoreDefinition<T extends object> = {
  state: T;
  actions: {
    [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
  } & {
    reset: () => void;
  };
  selectors: {
    [K in keyof T as `select${Capitalize<string & K>}`]: () => T[K];
  };
  computed: Record<string, (...args: any[]) => any>;
};

interface AppState {
  user: User | null;
  theme: "light" | "dark";
  language: string;
  notifications: Notification[];
}

type AppStore = StoreDefinition<AppState>;
// {
//   state: AppState;
//   actions: {
//     setUser: (value: User | null) => void;
//     setTheme: (value: "light" | "dark") => void;
//     setLanguage: (value: string) => void;
//     setNotifications: (value: Notification[]) => void;
//     reset: () => void;
//   };
//   selectors: {
//     selectUser: () => User | null;
//     selectTheme: () => "light" | "dark";
//     selectLanguage: () => string;
//     selectNotifications: () => Notification[];
//   };
//   computed: Record<string, (...args: any[]) => any>;
// }

// Immer-style immutable update pattern
type DraftState<T> = {
  -readonly [K in keyof T]: T[K] extends object
    ? T[K] extends (...args: any[]) => any
      ? T[K]
      : DraftState<T[K]>
    : T[K];
};

function produce<T extends object>(
  state: T,
  recipe: (draft: DraftState<T>) => void
): T {
  // implementation...
  return state;
}
```

### 5.3 Auto-Generating Database Model Types

```typescript
// Auto-generate CRUD operation types from model definitions

interface ModelDefinition {
  User: {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  };
  Post: {
    id: number;
    title: string;
    content: string;
    authorId: number;
    published: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  Comment: {
    id: number;
    text: string;
    postId: number;
    authorId: number;
    createdAt: Date;
  };
}

// Type for creation, excluding auto-generated fields
type AutoFields = "id" | "createdAt" | "updatedAt";

type CreateInput<T> = Omit<T, AutoFields>;
type UpdateInput<T> = Partial<Omit<T, AutoFields>>;

// Repository interface for each model
type Repository<T> = {
  findById: (id: number) => Promise<T | null>;
  findMany: (where?: Partial<T>) => Promise<T[]>;
  create: (data: CreateInput<T>) => Promise<T>;
  update: (id: number, data: UpdateInput<T>) => Promise<T>;
  delete: (id: number) => Promise<boolean>;
  count: (where?: Partial<T>) => Promise<number>;
};

// Generate repositories for all models at once
type Repositories = {
  [K in keyof ModelDefinition as Uncapitalize<string & K>]:
    Repository<ModelDefinition[K]>;
};

// Repositories:
// {
//   user: Repository<ModelDefinition["User"]>;
//   post: Repository<ModelDefinition["Post"]>;
//   comment: Repository<ModelDefinition["Comment"]>;
// }

// Usage example
declare const repos: Repositories;

const user = await repos.user.findById(1);          // User | null
const posts = await repos.post.findMany({ published: true }); // Post[]
const newComment = await repos.comment.create({
  text: "Great post!",
  postId: 1,
  authorId: 1,
});  // Comment
```

### 5.4 Type-Safe Internationalization (i18n) Design

```typescript
// Type-safe management of translation keys
interface Translations {
  common: {
    save: string;
    cancel: string;
    delete: string;
    confirm: string;
  };
  auth: {
    login: string;
    logout: string;
    register: string;
    forgotPassword: string;
  };
  errors: {
    notFound: string;
    unauthorized: string;
    serverError: string;
    validation: {
      required: string;
      minLength: string;
      maxLength: string;
      email: string;
    };
  };
}

// Generate translation keys via dot paths
type DotPath<T, Prefix extends string = ""> =
  T extends string
    ? Prefix
    : {
        [K in keyof T & string]:
          DotPath<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>
      }[keyof T & string];

type TranslationKey = DotPath<Translations>;
// "common.save" | "common.cancel" | "common.delete" | "common.confirm"
// | "auth.login" | "auth.logout" | ...
// | "errors.validation.required" | "errors.validation.minLength" | ...

// Type-safe translation function
function t(key: TranslationKey): string {
  // implementation...
  return "";
}

// Usage example
t("common.save");        // OK
t("auth.login");         // OK
// t("invalid.key");     // compile error
// t("common");          // compile error (only leaf nodes are allowed)
```

### 5.5 Generating Mock Types for Testing

```typescript
// Auto-generate mock types from interfaces

// Convert all methods to jest.Mock
type MockedMethods<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]:
    T[K] extends (...args: infer A) => infer R
      ? jest.Mock<R, A>
      : never;
};

// Keep properties as-is, mock only methods
type Mocked<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? T[K] extends (...args: infer A) => infer R
      ? jest.Mock<R, A>
      : T[K]
    : T[K];
};

interface UserService {
  name: string;
  getUser(id: number): Promise<User>;
  createUser(data: CreateUser): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getUserCount(): number;
}

type MockedUserService = Mocked<UserService>;
// {
//   name: string;
//   getUser: jest.Mock<Promise<User>, [id: number]>;
//   createUser: jest.Mock<Promise<User>, [data: CreateUser]>;
//   deleteUser: jest.Mock<Promise<void>, [id: number]>;
//   getUserCount: jest.Mock<number, []>;
// }

// Mock factory function
function createMock<T extends object>(): Mocked<T> {
  return new Proxy({} as Mocked<T>, {
    get: (target, prop) => {
      if (!(prop in target)) {
        (target as any)[prop] = jest.fn();
      }
      return (target as any)[prop];
    },
  });
}

// Usage example
const mockService = createMock<UserService>();
mockService.getUser.mockResolvedValue({ id: 1, name: "Alice" } as User);
```

---

## 6. Performance and Debugging

### 6.1 Optimizing Compilation Performance

```typescript
// Notes on the performance of mapped types

// BAD: unnecessary recursion
type BadDeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? BadDeepReadonly<T[K]> : T[K];
};
// Recurses into arrays, Date, and functions as well

// GOOD: limit recursion via appropriate conditional branches
type GoodDeepReadonly<T> =
  T extends Function ? T :
  T extends Date ? T :
  T extends RegExp ? T :
  T extends Map<infer K, infer V> ? ReadonlyMap<K, V> :
  T extends Set<infer U> ? ReadonlySet<U> :
  T extends any[] ? readonly [...{ [K in keyof T]: GoodDeepReadonly<T[K]> }] :
  T extends object ? { readonly [K in keyof T]: GoodDeepReadonly<T[K]> } :
  T;

// BAD: Key Remapping over a large number of keys
// Remapping with template literals on a type with hundreds of properties
// → significantly increases compilation time

// GOOD: process only the necessary properties
type SelectiveRemap<T, Keys extends keyof T> = {
  [K in Keys as `get${Capitalize<string & K>}`]: () => T[K];
} & Omit<T, Keys>;

// BAD: redundant application of mapped types
type Redundant<T> = Readonly<Partial<Required<Partial<T>>>>;
// Partial then Required then Partial again... pointless

// GOOD: do it in a single transformation
type Clean<T> = { readonly [K in keyof T]?: T[K] };
```

### 6.2 Debugging Techniques

```typescript
// Technique 1: use Prettify to expand a type for inspection
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// Flatten the type so it's easier to inspect via hover
type ComplexType = Omit<User, "password"> & Partial<Pick<User, "email">>;
type PrettifiedType = Prettify<ComplexType>;
// Hovering in your editor shows the expanded type

// Technique 2: type equality testing
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

// Writing test cases
type TestPartial = Expect<Equal<
  MyPartial<{ a: string; b: number }>,
  { a?: string; b?: number }
>>;

// Technique 3: visualizing type errors
type ShowError<T, Message extends string> = T & { __error: Message };

// Technique 4: incremental type construction
type Step1 = keyof User;                      // "id" | "name" | "email" | ...
type Step2 = Exclude<Step1, "password">;      // "id" | "name" | "email" | "createdAt" | "updatedAt"
type Step3 = Pick<User, Step2>;               // User without password
type Step4 = Prettify<Step3>;                 // expand to inspect

// Technique 5: debugging with branded types
type Debug<T, Label extends string = ""> = T & { __debug: Label; __type: T };
```

### 6.3 Common Errors and How to Fix Them

```typescript
// Error 1: "Type 'string' cannot be used to index type 'T'"
// Cause: keyof T may return string | number | symbol
// Fix: constrain with & string
type BadGetters<T> = {
  // [K in keyof T as `get${Capitalize<K>}`]: () => T[K]; // error
  [K in keyof T as K extends string ? `get${Capitalize<K>}` : never]: () => T[K]; // OK
};

// Error 2: "Type instantiation is excessively deep and possibly infinite"
// Cause: recursion is too deep
// Fix: add a depth counter
type SafeDeep<T, Depth extends any[] = []> =
  Depth["length"] extends 10
    ? T  // stop at the depth limit
    : T extends object
      ? { [K in keyof T]: SafeDeep<T[K], [...Depth, 0]> }
      : T;

// Error 3: "Expression produces a union type that is too complex to represent"
// Cause: the result of the mapped type produces a huge union
// Fix: limit what is processed

// Error 4: unintended modifier propagation
interface WithOptional {
  required: string;
  optional?: number;
}

type Mapped = { [K in keyof WithOptional]: string };
// { required: string; optional?: string }
// ← the ? on optional is preserved!

// Fix: explicitly make it required
type MappedRequired = { [K in keyof WithOptional]-?: string };
// { required: string; optional: string }

// Error 5: unintended readonly propagation
interface WithReadonly {
  readonly fixed: string;
  mutable: number;
}

type MappedRO = { [K in keyof WithReadonly]: boolean };
// { readonly fixed: boolean; mutable: boolean }
// ← readonly is preserved!

// Fix: remove it explicitly
type MappedMutable = { -readonly [K in keyof WithReadonly]: boolean };
// { fixed: boolean; mutable: boolean }
```

---

## Utility Type Cheat Sheet

| Type | Input | Output | Purpose |
|----|------|------|------|
| `Partial<T>` | `{ a: string; b: number }` | `{ a?: string; b?: number }` | Partial update |
| `Required<T>` | `{ a?: string; b?: number }` | `{ a: string; b: number }` | Make required |
| `Readonly<T>` | `{ a: string }` | `{ readonly a: string }` | Make immutable |
| `Record<K,V>` | `"a" \| "b", number` | `{ a: number; b: number }` | Build a dictionary |
| `Pick<T,K>` | `{ a: 1; b: 2; c: 3 }, "a"\|"b"` | `{ a: 1; b: 2 }` | Selection |
| `Omit<T,K>` | `{ a: 1; b: 2; c: 3 }, "c"` | `{ a: 1; b: 2 }` | Exclusion |

### Custom Utility Type Cheat Sheet

| Type | Description | Purpose |
|----|------|------|
| `DeepPartial<T>` | Recursively make every property optional | Merging configuration |
| `DeepReadonly<T>` | Recursively make every property readonly | Immutable data structures |
| `DeepRequired<T>` | Recursively make every property required | Post-validation |
| `DeepMutable<T>` | Recursively remove readonly | Draft pattern |
| `PartialBy<T, K>` | Make only specific properties optional | Partial omission |
| `RequiredBy<T, K>` | Make only specific properties required | Partial requirement |
| `PickByType<T, V>` | Extract properties by type | Type filtering |
| `OmitByType<T, V>` | Exclude properties by type | Type filtering |
| `Prettify<T>` | Flatten and expand a type | Debugging |
| `Mocked<T>` | Convert methods to mocks | Testing |

---

## Modifier Operation Comparison

| Operation | Syntax | Effect | Example |
|------|------|------|-----|
| Add optional | `[K in keyof T]?:` | Add `?` | `Partial<T>` |
| Remove optional | `[K in keyof T]-?:` | Remove `?` | `Required<T>` |
| Add readonly | `readonly [K in keyof T]:` | Add `readonly` | `Readonly<T>` |
| Remove readonly | `-readonly [K in keyof T]:` | Remove `readonly` | `Mutable<T>` |
| Add both | `readonly [K in keyof T]?:` | Add both | `ReadonlyPartial<T>` |
| Remove both | `-readonly [K in keyof T]-?:` | Remove both | `MutableRequired<T>` |

---

## Anti-Patterns

### Anti-Pattern 1: Adding Unnecessary Complexity With Mapped Types

```typescript
// BAD: a case where you don't need a mapped type
type UserKeys = {
  [K in "name" | "email"]: string;
};

// GOOD: write it simply
interface UserKeys {
  name: string;
  email: string;
}

// BAD: just a copy
type Copy<T> = { [K in keyof T]: T[K] };
// Returns the same type as T (apart from Prettify use cases)

// GOOD: only use mapped types when a transformation is involved
type Nullable<T> = { [K in keyof T]: T[K] | null };
```

### Anti-Pattern 2: Applying DeepReadonly to Everything

```typescript
// BAD: making every object DeepReadonly
type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };
type State = DeepReadonly<HugeComplexType>;
// Compilation slows down and error messages become unreadable

// GOOD: use Readonly only at necessary boundaries
function getConfig(): Readonly<Config> {
  return config;
}

// GOOD: enforce immutability at input boundaries
function processData(data: Readonly<InputData>): OutputData {
  // Guarantees that data is not modified
  return transform(data);
}
```

### Anti-Pattern 3: Excessive Type-Level Programming

```typescript
// BAD: implementing in the type system what is easy to do at runtime
type TypeLevelSort<T extends number[]> = /* a very complex type */;

// GOOD: handle it at runtime; the type only guarantees the result
function sortNumbers<T extends number[]>(arr: T): number[] {
  return [...arr].sort((a, b) => a - b);
}

// BAD: relying so heavily on type inference that the code becomes unreadable
type AbstractFactory<
  T extends Record<string, new (...args: any[]) => any>,
  K extends keyof T = keyof T
> = {
  [P in K as `create${Capitalize<string & P>}`]:
    (...args: ConstructorParameters<T[P]>) => InstanceType<T[P]>;
};

// GOOD: stay at the level of abstraction you actually need
interface Factory {
  createUser(name: string, age: number): User;
  createPost(title: string, content: string): Post;
}
```

### Anti-Pattern 4: Overusing Key Remapping

```typescript
// BAD: doing many transformations in a single type
type EverythingAtOnce<T> = {
  [K in keyof T as
    T[K] extends string
      ? `str_${string & K}`
      : T[K] extends number
        ? `num_${string & K}`
        : T[K] extends boolean
          ? `bool_${string & K}`
          : `other_${string & K}`
  ]: T[K] extends string
    ? { type: "string"; value: T[K] }
    : T[K] extends number
      ? { type: "number"; value: T[K] }
      : { type: "other"; value: T[K] };
};

// GOOD: split it up and give pieces names
type PrefixByType<T> = {
  [K in keyof T as `${TypePrefix<T[K]>}_${string & K}`]: T[K];
};

type TypePrefix<T> =
  T extends string ? "str" :
  T extends number ? "num" :
  T extends boolean ? "bool" :
  "other";
```

---

## FAQ

### Q1: What's the difference between `keyof T` and `keyof T & string`?

**A:** `keyof T` may return `string | number | symbol`. When you use it as a string in a template literal type like `${K}`, `K` must be `string`, so you constrain it to string keys only with `keyof T & string`.

```typescript
interface Example {
  name: string;
  0: number;
}

type AllKeys = keyof Example;            // "name" | 0
type StringKeys = keyof Example & string; // "name"
```

### Q2: Can a mapped type transform only some properties?

**A:** Yes. You can either combine `Pick` and `Omit`, or branch on conditions in the `as` clause of Key Remapping.

```typescript
// Option 1: combine Pick + Omit
type PartialBy<T, K extends keyof T> =
  Omit<T, K> & Partial<Pick<T, K>>;

// Option 2: Key Remapping + conditional types
type SelectivePartial<T, K extends keyof T> = {
  [P in keyof T as P extends K ? P : never]?: T[P];
} & {
  [P in keyof T as P extends K ? never : P]: T[P];
};
```

### Q3: Are `Record<string, T>` and `{ [key: string]: T }` the same?

**A:** Almost the same, but with subtle differences. `Record<string, T>` is defined as a mapped type, and editors display the type differently. `Record` also tends to interact better with generics. In practical use, they have the same meaning.

```typescript
// These are roughly equivalent
type A = Record<string, number>;
type B = { [key: string]: number };

// However, Record<string, T> accepts both string and number keys
// (due to JavaScript's index signature semantics)
const a: A = { foo: 1 };
a[0] = 2;  // OK (number keys are also allowed)
```

### Q4: Can mapped types handle arrays and tuples?

**A:** Yes, mapped types can be applied to arrays and tuples as well. When applied to an array/tuple, the element types are transformed.

```typescript
type MapArray<T extends any[]> = {
  [K in keyof T]: T[K] extends string ? number : T[K];
};

type Result = MapArray<[string, number, string]>;
// [number, number, number]

// Note that array methods (push, pop, etc.) are also affected,
// so it's common to use generic constraints to transform only the elements
```

### Q5: Why do modifiers (optional, readonly) end up in unexpected forms in the result of a mapped type?

**A:** Mapped types inherit the modifiers of the original type's properties as-is. This behavior is called a "homomorphic mapped type." If you want to change modifiers, explicitly use `?`, `-?`, `readonly`, or `-readonly`.

```typescript
interface Original {
  readonly a: string;
  b?: number;
}

// Modifiers are inherited as-is
type Inherited = { [K in keyof Original]: boolean };
// { readonly a: boolean; b?: boolean }

// Control the modifiers explicitly
type Normalized = { -readonly [K in keyof Original]-?: boolean };
// { a: boolean; b: boolean }
```

### Q6: What's the difference between Omit<T, K> and Pick<T, Exclude<keyof T, K>>?

**A:** They are the same in terms of implementation. `Omit` is defined as a combination of `Pick` and `Exclude`. However, the `K` of `Omit` is constrained by `keyof any` (= `string | number | symbol`), so specifying a key that doesn't exist on `T` doesn't produce an error. The `K` of `Pick`, on the other hand, is constrained by `keyof T`, so specifying a non-existent key does produce an error.

```typescript
interface User {
  name: string;
  age: number;
}

type A = Omit<User, "nonexistent">;       // OK (same type as User)
// type B = Pick<User, "nonexistent">;     // error: "nonexistent" is not in keyof User
```

---

## Summary

| Item | Content |
|------|------|
| Mapped types | Transform a type's properties with `{ [K in keyof T]: ... }` |
| Modifiers | Add/remove `?` and `readonly` (`-?`, `-readonly`) |
| Key Remapping | Transform/filter key names with the `as` clause (TS 4.1+) |
| Built-in types | Partial, Required, Readonly, Record, Pick, Omit |
| Recursive mapped types | DeepPartial, DeepReadonly, etc. handle nested structures |
| Conditional mapping | Apply different transformations based on the property's type |
| Practical patterns | Form state, API type transformation, mock generation, i18n |
| Performance | Limit recursion depth, avoid unnecessary recursion |
| Debugging | Prettify, incremental construction, type tests |

---

## Recommended Next Reading

- [02-template-literal-types.md](./02-template-literal-types.md) -- Template literal types
- [03-type-challenges.md](./03-type-challenges.md) -- Type challenges
- [00-conditional-types.md](./00-conditional-types.md) -- Conditional types

---

## References

1. **TypeScript Handbook: Mapped Types** -- https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
2. **TypeScript Handbook: Utility Types** -- https://www.typescriptlang.org/docs/handbook/utility-types.html
3. **Effective TypeScript, Item 14: Use Type Operations and Generics to Avoid Repeating Yourself** -- by Dan Vanderkam, O'Reilly
4. **TypeScript 4.1 Release Notes: Key Remapping** -- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html
5. **Type-Level TypeScript** -- https://type-level-typescript.com/
6. **Total TypeScript: Mapped Types** -- https://www.totaltypescript.com/
