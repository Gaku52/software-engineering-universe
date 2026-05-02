# TypeScript Builder Pattern

> Verify complex object construction at compile time with type-safe builder patterns and Fluent APIs

## What You Will Learn

1. **Classic Builder** -- Techniques for constructing objects step by step and turning incomplete-state builds into compile errors
2. **Phantom Type Builder** -- A type-level state machine that tracks "set/unset" using generic flag types
3. **Fluent API Design** -- Maximizing type inference in method chains to achieve both IDE completion and type safety
4. **Immutable Builder** -- Techniques for returning a new instance at each step to safely branch mid-construction state
5. **Test Data Builder** -- Implementing factory builders that dramatically improve test code readability
6. **Real-World Applications** -- Practical patterns such as query builders, form builders, and configuration object builders


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [TypeScript Error Handling Patterns](./00-error-handling.md)

---

## 1. Classic Builder Pattern

### 1-1. Basic Structure

```
+-----------+     .setName()     +-------------+
|  Builder  | -----------------> |   Builder   |
| (empty)   |                    | (name set)  |
+-----------+                    +-------------+
                                       |
                                  .setEmail()
                                       |
                                       v
                                 +-------------+
                                 |   Builder   |
                                 | (both set)  |
                                 +-------------+
                                       |
                                   .build()
                                       |
                                       v
                                 +-------------+
                                 |   User      |
                                 | (final)     |
                                 +-------------+
```

```typescript
// Target object
interface HttpRequest {
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly timeout: number;
}

// Builder
class HttpRequestBuilder {
  private method: HttpRequest["method"] = "GET";
  private url = "";
  private headers: Record<string, string> = {};
  private body?: string;
  private timeout = 30000;

  setMethod(method: HttpRequest["method"]): this {
    this.method = method;
    return this;
  }

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  addHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  setBody(body: string): this {
    this.body = body;
    return this;
  }

  setTimeout(ms: number): this {
    this.timeout = ms;
    return this;
  }

  build(): HttpRequest {
    if (!this.url) throw new Error("URL is required");
    return {
      method: this.method,
      url: this.url,
      headers: { ...this.headers },
      body: this.body,
      timeout: this.timeout,
    };
  }
}

// Usage example
const request = new HttpRequestBuilder()
  .setMethod("POST")
  .setUrl("https://api.example.com/users")
  .addHeader("Content-Type", "application/json")
  .setBody(JSON.stringify({ name: "Alice" }))
  .setTimeout(5000)
  .build();
```

### 1-2. The Problem -- Runtime Errors

```typescript
// Forgetting to set the URL still compiles fine
const bad = new HttpRequestBuilder()
  .setMethod("POST")
  .build(); // Runtime error: "URL is required"
```

The biggest problem with the classic builder is that forgetting to set required fields cannot be detected at compile time. The Phantom Type builder introduced in the next section solves this using the type system.

### 1-3. Classic Builder with Validation

To improve runtime safety, you can also implement a builder combined with the Result type.

```typescript
import { Result, Ok, Err } from "./result";

class ValidatedHttpRequestBuilder {
  private method: HttpRequest["method"] = "GET";
  private url = "";
  private headers: Record<string, string> = {};
  private body?: string;
  private timeout = 30000;

  setMethod(method: HttpRequest["method"]): this {
    this.method = method;
    return this;
  }

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  addHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  setBody(body: string): this {
    this.body = body;
    return this;
  }

  setTimeout(ms: number): this {
    this.timeout = ms;
    return this;
  }

  // build() returns a Result
  build(): Result<HttpRequest, BuildError[]> {
    const errors: BuildError[] = [];

    if (!this.url) {
      errors.push({ field: "url", message: "URL is required" });
    }

    if (this.url && !this.url.startsWith("http")) {
      errors.push({ field: "url", message: "URL must start with http:// or https://" });
    }

    if (this.timeout < 0) {
      errors.push({ field: "timeout", message: "Timeout must be non-negative" });
    }

    if ((this.method === "POST" || this.method === "PUT") && !this.body) {
      errors.push({ field: "body", message: `Body is required for ${this.method} requests` });
    }

    if (errors.length > 0) {
      return Err(errors);
    }

    return Ok({
      method: this.method,
      url: this.url,
      headers: { ...this.headers },
      body: this.body,
      timeout: this.timeout,
    });
  }
}

interface BuildError {
  field: string;
  message: string;
}

// Usage example
const result = new ValidatedHttpRequestBuilder()
  .setMethod("POST")
  .setUrl("https://api.example.com")
  .build();

if (isErr(result)) {
  console.error("Build errors:", result.error);
  // [{ field: "body", message: "Body is required for POST requests" }]
} else {
  console.log("Request:", result.value);
}
```

---

## 2. Phantom Type Builder (Type-Safe Version)

### 2-1. State Tracking with Flag Types

```
Type parameters: Builder<HasUrl, HasMethod>

  Builder<false, false>  -- Initial state
       |
   .url("...")
       |
       v
  Builder<true, false>   -- URL set
       |
   .method("POST")
       |
       v
  Builder<true, true>    -- All set
       |
   .build()  <-- Only callable in this type
       |
       v
    HttpRequest
```

```typescript
// Flag types
type True = true;
type False = false;

// Phantom Type builder
class RequestBuilder<
  HasUrl extends boolean = false,
  HasMethod extends boolean = false
> {
  private _url = "";
  private _method: "GET" | "POST" | "PUT" | "DELETE" = "GET";
  private _headers: Record<string, string> = {};
  private _body?: string;

  url(url: string): RequestBuilder<True, HasMethod> {
    this._url = url;
    return this as unknown as RequestBuilder<True, HasMethod>;
  }

  method(
    method: "GET" | "POST" | "PUT" | "DELETE"
  ): RequestBuilder<HasUrl, True> {
    this._method = method;
    return this as unknown as RequestBuilder<HasUrl, True>;
  }

  header(key: string, value: string): this {
    this._headers[key] = value;
    return this;
  }

  body(body: string): this {
    this._body = body;
    return this;
  }

  // build() is only callable when HasUrl=true and HasMethod=true
  build(this: RequestBuilder<True, True>): HttpRequest {
    return {
      method: this._method,
      url: this._url,
      headers: { ...this._headers },
      body: this._body,
      timeout: 30000,
    };
  }
}

// OK: both fields set
const req = new RequestBuilder()
  .url("https://api.example.com")
  .method("POST")
  .header("Authorization", "Bearer token")
  .build(); // Compiles OK

// NG: URL not set -- compile error
const bad = new RequestBuilder()
  .method("POST")
  .build();
// Error: The 'this' context of type 'RequestBuilder<false, true>'
//        is not assignable to method's 'this' of type 'RequestBuilder<true, true>'
```

### 2-2. Phantom Type for Tracking Many Required Fields

```typescript
// Track set state per field
interface BuilderState {
  hasUrl: boolean;
  hasMethod: boolean;
  hasAuth: boolean;
}

// Default state
type EmptyState = {
  hasUrl: false;
  hasMethod: false;
  hasAuth: false;
};

// Utility type to update state
type SetField<S extends BuilderState, K extends keyof BuilderState> = {
  [P in keyof BuilderState]: P extends K ? true : S[P];
};

// Type to confirm all fields are true
type AllSet<S extends BuilderState> = S extends {
  hasUrl: true;
  hasMethod: true;
  hasAuth: true;
}
  ? true
  : false;

class AdvancedRequestBuilder<S extends BuilderState = EmptyState> {
  private _url = "";
  private _method: "GET" | "POST" | "PUT" | "DELETE" = "GET";
  private _auth = "";
  private _headers: Record<string, string> = {};
  private _body?: string;
  private _timeout = 30000;

  url(url: string): AdvancedRequestBuilder<SetField<S, "hasUrl">> {
    this._url = url;
    return this as unknown as AdvancedRequestBuilder<SetField<S, "hasUrl">>;
  }

  method(
    method: "GET" | "POST" | "PUT" | "DELETE"
  ): AdvancedRequestBuilder<SetField<S, "hasMethod">> {
    this._method = method;
    return this as unknown as AdvancedRequestBuilder<SetField<S, "hasMethod">>;
  }

  auth(token: string): AdvancedRequestBuilder<SetField<S, "hasAuth">> {
    this._auth = token;
    return this as unknown as AdvancedRequestBuilder<SetField<S, "hasAuth">>;
  }

  header(key: string, value: string): this {
    this._headers[key] = value;
    return this;
  }

  body(body: string): this {
    this._body = body;
    return this;
  }

  timeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  // build() is only callable when AllSet<S> is true
  build(
    this: AdvancedRequestBuilder<{
      hasUrl: true;
      hasMethod: true;
      hasAuth: true;
    }>
  ): HttpRequest {
    return {
      method: this._method,
      url: this._url,
      headers: {
        ...this._headers,
        Authorization: `Bearer ${this._auth}`,
      },
      body: this._body,
      timeout: this._timeout,
    };
  }
}

// OK: all fields set
const req1 = new AdvancedRequestBuilder()
  .url("https://api.example.com")
  .method("POST")
  .auth("my-token")
  .header("Content-Type", "application/json")
  .body(JSON.stringify({ data: "value" }))
  .build(); // Compiles OK

// NG: auth not set
const bad1 = new AdvancedRequestBuilder()
  .url("https://api.example.com")
  .method("POST")
  .build(); // Compile error
```

### 2-3. Step Builder (Order-Enforcement Pattern)

```typescript
// Define each step as a separate interface
interface NeedsUrl {
  url(url: string): NeedsMethod;
}

interface NeedsMethod {
  method(method: "GET" | "POST" | "PUT" | "DELETE"): OptionalConfig;
}

interface OptionalConfig {
  header(key: string, value: string): OptionalConfig;
  body(body: string): OptionalConfig;
  timeout(ms: number): OptionalConfig;
  build(): HttpRequest;
}

function createRequest(): NeedsUrl {
  const config: Partial<HttpRequest> = { headers: {}, timeout: 30000 };

  const optionalConfig: OptionalConfig = {
    header(key, value) {
      (config.headers as Record<string, string>)[key] = value;
      return optionalConfig;
    },
    body(body) {
      config.body = body;
      return optionalConfig;
    },
    timeout(ms) {
      config.timeout = ms;
      return optionalConfig;
    },
    build() {
      return config as HttpRequest;
    },
  };

  return {
    url(url) {
      config.url = url;
      return {
        method(method) {
          config.method = method;
          return optionalConfig;
        },
      };
    },
  };
}

// Order is enforced
const req = createRequest()
  .url("https://api.example.com")    // 1. URL first
  .method("POST")                     // 2. method next
  .header("Content-Type", "json")     // 3. anything after is free
  .build();
```

### 2-4. Type Constraints for Conditional Methods

```typescript
// Control body presence with types based on the HTTP method
interface GetBuilder {
  header(key: string, value: string): GetBuilder;
  query(params: Record<string, string>): GetBuilder;
  build(): HttpRequest;
  // body() does not exist -- GET requests have no body
}

interface PostBuilder {
  header(key: string, value: string): PostBuilder;
  body(body: string): PostBuilder;
  json<T>(data: T): PostBuilder;
  build(): HttpRequest;
}

interface MethodSelector {
  get(): GetBuilder;
  post(): PostBuilder;
  put(): PostBuilder;
  delete(): GetBuilder;
}

function request(url: string): MethodSelector {
  const config: Partial<HttpRequest> & { query?: Record<string, string> } = {
    url,
    headers: {},
    timeout: 30000,
  };

  const getBuilder: GetBuilder = {
    header(key, value) {
      (config.headers as Record<string, string>)[key] = value;
      return getBuilder;
    },
    query(params) {
      config.query = params;
      return getBuilder;
    },
    build() {
      let url = config.url!;
      if (config.query) {
        const qs = new URLSearchParams(config.query).toString();
        url += `?${qs}`;
      }
      return { ...config, url, method: config.method! } as HttpRequest;
    },
  };

  const postBuilder: PostBuilder = {
    header(key, value) {
      (config.headers as Record<string, string>)[key] = value;
      return postBuilder;
    },
    body(body) {
      config.body = body;
      return postBuilder;
    },
    json<T>(data: T) {
      (config.headers as Record<string, string>)["Content-Type"] = "application/json";
      config.body = JSON.stringify(data);
      return postBuilder;
    },
    build() {
      return { ...config, method: config.method! } as HttpRequest;
    },
  };

  return {
    get() {
      config.method = "GET";
      return getBuilder;
    },
    post() {
      config.method = "POST";
      return postBuilder;
    },
    put() {
      config.method = "PUT";
      return postBuilder;
    },
    delete() {
      config.method = "DELETE";
      return getBuilder;
    },
  };
}

// GET request: body() cannot be called
const getReq = request("https://api.example.com/users")
  .get()
  .header("Accept", "application/json")
  .query({ page: "1", limit: "20" })
  .build();

// POST request: json() is available
const postReq = request("https://api.example.com/users")
  .post()
  .json({ name: "Alice", email: "alice@example.com" })
  .build();
```

---

## 3. Type Inference Techniques for Fluent APIs

### 3-1. Generating Methods Dynamically with Mapped Types

```typescript
type QueryBuilder<T extends Record<string, unknown>> = {
  [K in keyof T & string as `where${Capitalize<K>}`]: (
    value: T[K]
  ) => QueryBuilder<T>;
} & {
  orderBy(field: keyof T, direction?: "asc" | "desc"): QueryBuilder<T>;
  limit(n: number): QueryBuilder<T>;
  execute(): Promise<T[]>;
};

// Example type for usage
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

// QueryBuilder<User> automatically has the following methods:
// - whereId(value: number)
// - whereName(value: string)
// - whereEmail(value: string)
// - whereAge(value: number)
// - orderBy(field: keyof User, direction?)
// - limit(n: number)
// - execute(): Promise<User[]>
```

### 3-2. SQL Builder Using Template Literal Types

```typescript
// Build SELECT statements at the type level
type SelectFields<T, Fields extends (keyof T)[]> = Pick<T, Fields[number]>;

class TypedQueryBuilder<
  T extends Record<string, unknown>,
  Selected extends (keyof T)[] = []
> {
  private fields: string[] = [];
  private conditions: string[] = [];

  select<F extends keyof T>(
    ...fields: F[]
  ): TypedQueryBuilder<T, [...Selected, ...F[]]> {
    this.fields.push(...(fields as string[]));
    return this as unknown as TypedQueryBuilder<T, [...Selected, ...F[]]>;
  }

  where<K extends keyof T>(
    field: K,
    op: "=" | ">" | "<" | "!=",
    value: T[K]
  ): this {
    this.conditions.push(`${String(field)} ${op} ${JSON.stringify(value)}`);
    return this;
  }

  async execute(): Promise<SelectFields<T, Selected>[]> {
    const sql = `SELECT ${this.fields.join(", ")} FROM ...`;
    console.log(sql);
    return [] as SelectFields<T, Selected>[];
  }
}

// Usage example
const users = await new TypedQueryBuilder<User>()
  .select("name", "email")  // Selected = ["name", "email"]
  .where("age", ">", 18)
  .execute();
// Type of users: Pick<User, "name" | "email">[]
```

### 3-3. Conditional Method Visibility (Conditional Types)

```typescript
// Control method visibility based on configuration state
type ConditionalBuilder<
  T,
  State extends Record<string, boolean>
> = {
  // Always available methods
  reset(): ConditionalBuilder<T, Record<string, false>>;
} & (State extends { hasSelect: true }
  ? {
      // Available only after select
      where(condition: string): ConditionalBuilder<T, State & { hasWhere: true }>;
      orderBy(field: keyof T): ConditionalBuilder<T, State>;
    }
  : {
      // Available only before select
      select(...fields: (keyof T)[]): ConditionalBuilder<T, State & { hasSelect: true }>;
    }) &
  (State extends { hasSelect: true }
    ? {
        execute(): Promise<T[]>;
      }
    : {});

// With this pattern:
// 1. where() is not shown before calling select()
// 2. select() is not shown again after it has been called
// 3. execute() is only shown after calling select()
```

### 3-4. Fluent API Validation Rule Builder

```typescript
// Fluent API for type-safe construction of validation rules
type Validator<T> = {
  validate(value: unknown): Result<T, ValidationError[]>;
};

class StringValidatorBuilder {
  private rules: Array<{
    check: (value: string) => boolean;
    message: string;
  }> = [];
  private _optional = false;

  min(length: number): this {
    this.rules.push({
      check: (v) => v.length >= length,
      message: `Must be at least ${length} characters`,
    });
    return this;
  }

  max(length: number): this {
    this.rules.push({
      check: (v) => v.length <= length,
      message: `Must be no more than ${length} characters`,
    });
    return this;
  }

  pattern(regex: RegExp, message: string): this {
    this.rules.push({
      check: (v) => regex.test(v),
      message,
    });
    return this;
  }

  email(): this {
    return this.pattern(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      "Please enter a valid email address"
    );
  }

  url(): this {
    return this.pattern(
      /^https?:\/\/[^\s]+$/,
      "Please enter a valid URL"
    );
  }

  optional(): this {
    this._optional = true;
    return this;
  }

  custom(check: (value: string) => boolean, message: string): this {
    this.rules.push({ check, message });
    return this;
  }

  build(): Validator<string> {
    const rules = [...this.rules];
    const optional = this._optional;

    return {
      validate(value: unknown): Result<string, ValidationError[]> {
        if (value === undefined || value === null || value === "") {
          if (optional) return Ok("");
          return Err([{ field: "", message: "This field is required" }]);
        }

        if (typeof value !== "string") {
          return Err([{ field: "", message: "Please enter a string" }]);
        }

        const errors: ValidationError[] = [];
        for (const rule of rules) {
          if (!rule.check(value)) {
            errors.push({ field: "", message: rule.message });
          }
        }

        return errors.length > 0 ? Err(errors) : Ok(value);
      },
    };
  }
}

// Usage example
const emailValidator = new StringValidatorBuilder()
  .min(1)
  .max(255)
  .email()
  .build();

const result = emailValidator.validate("test@example.com");
```

### 3-5. Method Chain Type Inference and IDE Experience

```typescript
// Type-safe builder for configuration objects
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

interface AppConfig {
  server: {
    host: string;
    port: number;
    cors: {
      origins: string[];
      credentials: boolean;
    };
  };
  database: {
    host: string;
    port: number;
    name: string;
    pool: {
      min: number;
      max: number;
    };
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "text";
  };
}

class ConfigBuilder {
  private config: DeepPartial<AppConfig> = {};

  server(fn: (builder: ServerConfigBuilder) => ServerConfigBuilder): this {
    const serverBuilder = new ServerConfigBuilder();
    fn(serverBuilder);
    this.config.server = serverBuilder.getConfig();
    return this;
  }

  database(fn: (builder: DatabaseConfigBuilder) => DatabaseConfigBuilder): this {
    const dbBuilder = new DatabaseConfigBuilder();
    fn(dbBuilder);
    this.config.database = dbBuilder.getConfig();
    return this;
  }

  logging(level: AppConfig["logging"]["level"], format?: AppConfig["logging"]["format"]): this {
    this.config.logging = { level, format: format ?? "json" };
    return this;
  }

  build(): AppConfig {
    // Validate required fields
    if (!this.config.server?.host) throw new Error("server.host is required");
    if (!this.config.server?.port) throw new Error("server.port is required");
    if (!this.config.database?.host) throw new Error("database.host is required");
    if (!this.config.database?.name) throw new Error("database.name is required");

    return this.config as AppConfig;
  }
}

class ServerConfigBuilder {
  private config: DeepPartial<AppConfig["server"]> = {};

  host(host: string): this {
    this.config.host = host;
    return this;
  }

  port(port: number): this {
    this.config.port = port;
    return this;
  }

  cors(origins: string[], credentials = false): this {
    this.config.cors = { origins, credentials };
    return this;
  }

  getConfig(): DeepPartial<AppConfig["server"]> {
    return this.config;
  }
}

class DatabaseConfigBuilder {
  private config: DeepPartial<AppConfig["database"]> = {};

  host(host: string): this {
    this.config.host = host;
    return this;
  }

  port(port: number): this {
    this.config.port = port;
    return this;
  }

  name(name: string): this {
    this.config.name = name;
    return this;
  }

  pool(min: number, max: number): this {
    this.config.pool = { min, max };
    return this;
  }

  getConfig(): DeepPartial<AppConfig["database"]> {
    return this.config;
  }
}

// Usage example: nested builders
const config = new ConfigBuilder()
  .server((s) =>
    s
      .host("0.0.0.0")
      .port(3000)
      .cors(["https://example.com"], true)
  )
  .database((db) =>
    db
      .host("localhost")
      .port(5432)
      .name("myapp")
      .pool(5, 20)
  )
  .logging("info", "json")
  .build();
```

---

## 4. Immutable Builder

### 4-1. Basics of an Immutable Builder

Mutable builders (returning `this`) are efficient, but saving an intermediate state and branching from it can produce unexpected results.

```typescript
// Problem with a mutable builder
const baseBuilder = new HttpRequestBuilder()
  .setUrl("https://api.example.com");

// Trying to branch and create two requests, but...
const getRequest = baseBuilder.setMethod("GET").build();
const postRequest = baseBuilder.setMethod("POST").build(); // GET is overwritten by POST

// Solution: Immutable builder
class ImmutableRequestBuilder<
  HasUrl extends boolean = false,
  HasMethod extends boolean = false
> {
  private constructor(
    private readonly _url: string,
    private readonly _method: "GET" | "POST" | "PUT" | "DELETE",
    private readonly _headers: Readonly<Record<string, string>>,
    private readonly _body: string | undefined,
    private readonly _timeout: number
  ) {}

  static create(): ImmutableRequestBuilder<false, false> {
    return new ImmutableRequestBuilder("", "GET", {}, undefined, 30000);
  }

  url(url: string): ImmutableRequestBuilder<true, HasMethod> {
    return new ImmutableRequestBuilder(
      url,
      this._method,
      this._headers,
      this._body,
      this._timeout
    ) as ImmutableRequestBuilder<true, HasMethod>;
  }

  method(
    method: "GET" | "POST" | "PUT" | "DELETE"
  ): ImmutableRequestBuilder<HasUrl, true> {
    return new ImmutableRequestBuilder(
      this._url,
      method,
      this._headers,
      this._body,
      this._timeout
    ) as ImmutableRequestBuilder<HasUrl, true>;
  }

  header(key: string, value: string): ImmutableRequestBuilder<HasUrl, HasMethod> {
    return new ImmutableRequestBuilder(
      this._url,
      this._method,
      { ...this._headers, [key]: value },
      this._body,
      this._timeout
    ) as ImmutableRequestBuilder<HasUrl, HasMethod>;
  }

  body(body: string): ImmutableRequestBuilder<HasUrl, HasMethod> {
    return new ImmutableRequestBuilder(
      this._url,
      this._method,
      this._headers,
      body,
      this._timeout
    ) as ImmutableRequestBuilder<HasUrl, HasMethod>;
  }

  timeout(ms: number): ImmutableRequestBuilder<HasUrl, HasMethod> {
    return new ImmutableRequestBuilder(
      this._url,
      this._method,
      this._headers,
      this._body,
      ms
    ) as ImmutableRequestBuilder<HasUrl, HasMethod>;
  }

  build(this: ImmutableRequestBuilder<true, true>): HttpRequest {
    return {
      method: this._method,
      url: this._url,
      headers: { ...this._headers },
      body: this._body,
      timeout: this._timeout,
    };
  }
}

// Can safely branch
const base = ImmutableRequestBuilder.create()
  .url("https://api.example.com")
  .header("Accept", "application/json");

const getReq = base.method("GET").build();       // GET request
const postReq = base.method("POST")              // POST request
  .body(JSON.stringify({ name: "Alice" }))
  .build();
// base is unchanged
```

### 4-2. Record-Based Immutable Builder

```typescript
// A simpler implementation of an immutable builder
type RequiredKeys = "url" | "method";
type BuilderConfig = {
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
};

type HasRequired<
  Config extends BuilderConfig,
  Keys extends string
> = Keys extends keyof Config
  ? Config[Keys] extends undefined
    ? false
    : true
  : false;

function createBuilder(config: BuilderConfig = {}) {
  const builder = {
    url: (url: string) => createBuilder({ ...config, url }),
    method: (method: "GET" | "POST" | "PUT" | "DELETE") =>
      createBuilder({ ...config, method }),
    header: (key: string, value: string) =>
      createBuilder({
        ...config,
        headers: { ...(config.headers ?? {}), [key]: value },
      }),
    body: (body: string) => createBuilder({ ...config, body }),
    timeout: (ms: number) => createBuilder({ ...config, timeout: ms }),
    build: (): HttpRequest => {
      if (!config.url) throw new Error("url is required");
      if (!config.method) throw new Error("method is required");
      return {
        url: config.url,
        method: config.method,
        headers: config.headers ?? {},
        body: config.body,
        timeout: config.timeout ?? 30000,
      };
    },
  };

  return builder;
}

// Usage example
const req = createBuilder()
  .url("https://api.example.com")
  .method("POST")
  .header("Content-Type", "application/json")
  .body(JSON.stringify({ name: "Alice" }))
  .build();
```

### 4-3. Generic Immutable Builder with Generics

```typescript
// General-purpose type-safe immutable builder
type Builder<
  Target,
  Required extends keyof Target,
  Set extends keyof Target = never
> = {
  [K in keyof Target]-?: (
    value: Target[K]
  ) => Builder<Target, Required, Set | K>;
} & (Required extends Set
  ? { build(): Readonly<Target> }
  : {});

function createTypedBuilder<
  Target extends Record<string, unknown>,
  Required extends keyof Target = never
>(
  defaults?: Partial<Target>,
  requiredKeys?: Required[]
): Builder<Target, Required> {
  const config: Partial<Target> = { ...(defaults ?? {}) };

  const handler: ProxyHandler<any> = {
    get(_, prop: string) {
      if (prop === "build") {
        return () => ({ ...config }) as Target;
      }
      return (value: unknown) => {
        const newConfig = { ...config, [prop]: value };
        return new Proxy({}, {
          get(_, prop: string) {
            if (prop === "build") {
              return () => ({ ...newConfig }) as Target;
            }
            return (value: unknown) => {
              return createTypedBuilder<Target, Required>({
                ...newConfig,
                [prop]: value,
              } as Partial<Target>);
            };
          },
        });
      };
    },
  };

  return new Proxy({}, handler) as Builder<Target, Required>;
}

// Usage example
interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

const emailBuilder = createTypedBuilder<EmailMessage, "to" | "from" | "subject" | "body">();
```

---

## 5. Test Data Builder

### 5-1. Basic Test Data Builder

```
Test data generation flow:

  UserBuilder.create()
       |
  .withDefaults()     <- Reasonable default values
       |
  .withName("Alice")  <- Override only values needed for the test
       |
  .withPosts(3)       <- Generate relations
       |
  .build()
       |
       v
  { id: "uuid-1", name: "Alice", email: "alice@test.com",
    posts: [Post, Post, Post] }
```

```typescript
// Builder for test data
class UserBuilder {
  private data: User = {
    id: crypto.randomUUID(),
    name: "Test User",
    email: "test@example.com",
    age: 25,
    role: "user",
    createdAt: new Date(),
  };

  static create(): UserBuilder {
    return new UserBuilder();
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withAge(age: number): this {
    this.data.age = age;
    return this;
  }

  withRole(role: "user" | "admin"): this {
    this.data.role = role;
    return this;
  }

  build(): User {
    return { ...this.data };
  }

  async persist(db: Database): Promise<User> {
    const user = this.build();
    await db.users.insert(user);
    return user;
  }
}

// Usage in tests
describe("UserService", () => {
  it("should allow admin to delete users", async () => {
    const admin = UserBuilder.create().withRole("admin").build();
    const target = UserBuilder.create().withName("Bob").build();

    const result = await userService.deleteUser(admin.id, target.id);
    expect(result).toBeOk();
  });
});
```

### 5-2. Test Data Builder with Related Entities

```typescript
// ─── Builders for each entity ───

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  status: "draft" | "published" | "archived";
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

class PostBuilder {
  private data: Post = {
    id: crypto.randomUUID(),
    title: "Test Post",
    content: "This is a test post content.",
    authorId: "",
    status: "draft",
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  static create(): PostBuilder {
    return new PostBuilder();
  }

  withTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  withContent(content: string): this {
    this.data.content = content;
    return this;
  }

  withAuthor(authorId: string): this {
    this.data.authorId = authorId;
    return this;
  }

  withStatus(status: Post["status"]): this {
    this.data.status = status;
    return this;
  }

  withTags(...tags: string[]): this {
    this.data.tags = tags;
    return this;
  }

  published(): this {
    this.data.status = "published";
    return this;
  }

  archived(): this {
    this.data.status = "archived";
    return this;
  }

  build(): Post {
    return { ...this.data };
  }
}

class CommentBuilder {
  private data: Comment = {
    id: crypto.randomUUID(),
    postId: "",
    authorId: "",
    content: "Test comment",
    createdAt: new Date(),
  };

  static create(): CommentBuilder {
    return new CommentBuilder();
  }

  forPost(postId: string): this {
    this.data.postId = postId;
    return this;
  }

  byAuthor(authorId: string): this {
    this.data.authorId = authorId;
    return this;
  }

  withContent(content: string): this {
    this.data.content = content;
    return this;
  }

  build(): Comment {
    return { ...this.data };
  }
}

// ─── Scenario builder: generate multiple entities at once ───

interface BlogScenario {
  users: User[];
  posts: Post[];
  comments: Comment[];
}

class BlogScenarioBuilder {
  private users: User[] = [];
  private posts: Post[] = [];
  private comments: Comment[] = [];

  static create(): BlogScenarioBuilder {
    return new BlogScenarioBuilder();
  }

  withUser(
    configurator?: (builder: UserBuilder) => UserBuilder
  ): this {
    const builder = UserBuilder.create();
    const user = configurator ? configurator(builder).build() : builder.build();
    this.users.push(user);
    return this;
  }

  withPost(
    authorIndex: number,
    configurator?: (builder: PostBuilder) => PostBuilder
  ): this {
    const author = this.users[authorIndex];
    if (!author) throw new Error(`User at index ${authorIndex} not found`);

    const builder = PostBuilder.create().withAuthor(author.id);
    const post = configurator ? configurator(builder).build() : builder.build();
    this.posts.push(post);
    return this;
  }

  withComment(
    postIndex: number,
    authorIndex: number,
    content?: string
  ): this {
    const post = this.posts[postIndex];
    const author = this.users[authorIndex];
    if (!post) throw new Error(`Post at index ${postIndex} not found`);
    if (!author) throw new Error(`User at index ${authorIndex} not found`);

    const comment = CommentBuilder.create()
      .forPost(post.id)
      .byAuthor(author.id)
      .withContent(content ?? "Test comment")
      .build();
    this.comments.push(comment);
    return this;
  }

  build(): BlogScenario {
    return {
      users: [...this.users],
      posts: [...this.posts],
      comments: [...this.comments],
    };
  }

  async persist(db: Database): Promise<BlogScenario> {
    const scenario = this.build();
    await db.users.insertMany(scenario.users);
    await db.posts.insertMany(scenario.posts);
    await db.comments.insertMany(scenario.comments);
    return scenario;
  }
}

// Usage in tests
describe("Blog API", () => {
  it("should return published posts with comments", async () => {
    const scenario = BlogScenarioBuilder.create()
      .withUser((u) => u.withName("Alice").withRole("admin"))
      .withUser((u) => u.withName("Bob"))
      .withPost(0, (p) => p.withTitle("Hello World").published().withTags("typescript", "testing"))
      .withPost(0, (p) => p.withTitle("Draft Post"))  // draft
      .withComment(0, 1, "Great post!")
      .withComment(0, 0, "Thanks!")
      .build();

    await persistScenario(scenario);

    const response = await api.get("/posts?status=published");
    expect(response.body).toHaveLength(1);
    expect(response.body[0].title).toBe("Hello World");
    expect(response.body[0].comments).toHaveLength(2);
  });
});
```

### 5-3. Factory Function Pattern (Lightweight Test Data Generation)

```typescript
// A lightweight pattern that generates test data using only functions, without builder classes

// Factory with a counter
let userCounter = 0;
function createTestUser(overrides: Partial<User> = {}): User {
  userCounter++;
  return {
    id: `user-${userCounter}`,
    name: `User ${userCounter}`,
    email: `user${userCounter}@test.com`,
    age: 25,
    role: "user",
    createdAt: new Date(),
    ...overrides,
  };
}

let postCounter = 0;
function createTestPost(overrides: Partial<Post> = {}): Post {
  postCounter++;
  return {
    id: `post-${postCounter}`,
    title: `Post ${postCounter}`,
    content: `Content of post ${postCounter}`,
    authorId: `user-1`,
    status: "draft",
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Usage example
describe("PostService", () => {
  it("should publish a draft post", async () => {
    const author = createTestUser({ role: "admin" });
    const post = createTestPost({ authorId: author.id, status: "draft" });

    const result = await postService.publish(author.id, post.id);
    expect(result).toBeOk();
  });
});

// ─── Integration with faker.js ───
import { faker } from "@faker-js/faker";

function createRealisticUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    age: faker.number.int({ min: 18, max: 80 }),
    role: faker.helpers.arrayElement(["user", "admin"]),
    createdAt: faker.date.past(),
    ...overrides,
  };
}

function createRealisticPost(overrides: Partial<Post> = {}): Post {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(3),
    authorId: faker.string.uuid(),
    status: faker.helpers.arrayElement(["draft", "published", "archived"]),
    tags: faker.helpers.arrayElements(
      ["typescript", "javascript", "react", "nodejs", "testing"],
      { min: 1, max: 3 }
    ),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}
```

### 5-4. Type-Safe Test Data Builder Generics

```typescript
// General-purpose test data builder compatible with any interface
type WithMethods<T> = {
  [K in keyof T as `with${Capitalize<string & K>}`]: (
    value: T[K]
  ) => WithMethods<T> & { build(): T };
} & {
  build(): T;
};

function createTestDataBuilder<T extends Record<string, unknown>>(
  defaults: T
): WithMethods<T> {
  const data = { ...defaults };

  const handler: ProxyHandler<any> = {
    get(_, prop: string) {
      if (prop === "build") {
        return () => ({ ...data });
      }
      if (prop.startsWith("with")) {
        const fieldName =
          prop.charAt(4).toLowerCase() + prop.slice(5);
        return (value: unknown) => {
          (data as any)[fieldName] = value;
          return new Proxy({}, handler);
        };
      }
      return undefined;
    },
  };

  return new Proxy({}, handler) as WithMethods<T>;
}

// Usage example
const userBuilder = createTestDataBuilder<User>({
  id: "test-id",
  name: "Default User",
  email: "default@test.com",
  age: 25,
  role: "user",
  createdAt: new Date(),
});

const user = userBuilder
  .withName("Custom Name")
  .withAge(30)
  .withRole("admin")
  .build();
// => { id: "test-id", name: "Custom Name", email: "default@test.com", age: 30, role: "admin", ... }
```

---

## 6. Real-World Application Examples

### 6-1. ORM-Style Query Builder

```typescript
// Prisma-style type-safe query builder
interface WhereClause<T> {
  equals?: T;
  not?: T;
  in?: T[];
  notIn?: T[];
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
  contains?: T extends string ? string : never;
  startsWith?: T extends string ? string : never;
  endsWith?: T extends string ? string : never;
}

type WhereInput<T> = {
  [K in keyof T]?: T[K] | WhereClause<T[K]>;
} & {
  AND?: WhereInput<T>[];
  OR?: WhereInput<T>[];
  NOT?: WhereInput<T>;
};

type OrderByInput<T> = {
  [K in keyof T]?: "asc" | "desc";
};

interface FindManyArgs<T> {
  where?: WhereInput<T>;
  orderBy?: OrderByInput<T> | OrderByInput<T>[];
  skip?: number;
  take?: number;
  select?: { [K in keyof T]?: boolean };
  include?: Record<string, boolean>;
}

class TypeSafeQueryBuilder<T extends Record<string, unknown>> {
  private args: FindManyArgs<T> = {};

  where(condition: WhereInput<T>): this {
    this.args.where = { ...this.args.where, ...condition };
    return this;
  }

  orderBy(field: keyof T, direction: "asc" | "desc" = "asc"): this {
    this.args.orderBy = { [field]: direction } as OrderByInput<T>;
    return this;
  }

  skip(count: number): this {
    this.args.skip = count;
    return this;
  }

  take(count: number): this {
    this.args.take = count;
    return this;
  }

  select<K extends keyof T>(...fields: K[]): this {
    const select = {} as { [P in keyof T]?: boolean };
    for (const field of fields) {
      select[field] = true;
    }
    this.args.select = select;
    return this;
  }

  getArgs(): FindManyArgs<T> {
    return { ...this.args };
  }
}

// Usage example
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  createdAt: Date;
}

const query = new TypeSafeQueryBuilder<Product>()
  .where({
    category: "electronics",
    price: { lte: 10000 },
    stock: { gt: 0 },
  })
  .orderBy("price", "asc")
  .skip(0)
  .take(20)
  .select("id", "name", "price")
  .getArgs();
```

### 6-2. Form Builder (React Integration)

```typescript
// Type-safe builder for React forms
interface FormFieldConfig<T> {
  name: keyof T;
  label: string;
  type: "text" | "number" | "email" | "password" | "select" | "textarea" | "checkbox";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: (value: unknown) => string | undefined;
  defaultValue?: T[keyof T];
}

class FormBuilder<T extends Record<string, unknown>> {
  private fields: FormFieldConfig<T>[] = [];
  private _onSubmit?: (data: T) => void | Promise<void>;

  field<K extends keyof T & string>(
    name: K,
    config: Omit<FormFieldConfig<T>, "name"> & { type: FormFieldConfig<T>["type"] }
  ): this {
    this.fields.push({ ...config, name } as FormFieldConfig<T>);
    return this;
  }

  text<K extends keyof T & string>(
    name: K,
    label: string,
    options?: Partial<FormFieldConfig<T>>
  ): this {
    return this.field(name, { label, type: "text", ...options });
  }

  email<K extends keyof T & string>(name: K, label: string): this {
    return this.field(name, {
      label,
      type: "email",
      validation: (v) => {
        if (typeof v === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          return "Please enter a valid email address";
        }
        return undefined;
      },
    });
  }

  password<K extends keyof T & string>(name: K, label: string): this {
    return this.field(name, { label, type: "password" });
  }

  number<K extends keyof T & string>(
    name: K,
    label: string,
    options?: { min?: number; max?: number }
  ): this {
    return this.field(name, {
      label,
      type: "number",
      validation: (v) => {
        const num = Number(v);
        if (isNaN(num)) return "Please enter a number";
        if (options?.min !== undefined && num < options.min) {
          return `Please enter a value of ${options.min} or more`;
        }
        if (options?.max !== undefined && num > options.max) {
          return `Please enter a value of ${options.max} or less`;
        }
        return undefined;
      },
    });
  }

  select<K extends keyof T & string>(
    name: K,
    label: string,
    options: Array<{ value: string; label: string }>
  ): this {
    return this.field(name, { label, type: "select", options });
  }

  onSubmit(handler: (data: T) => void | Promise<void>): this {
    this._onSubmit = handler;
    return this;
  }

  build() {
    return {
      fields: [...this.fields],
      onSubmit: this._onSubmit,
    };
  }
}

// Usage example
interface UserForm {
  name: string;
  email: string;
  age: number;
  role: string;
}

const formConfig = new FormBuilder<UserForm>()
  .text("name", "Name", { required: true, placeholder: "John Doe" })
  .email("email", "Email Address")
  .number("age", "Age", { min: 0, max: 150 })
  .select("role", "Role", [
    { value: "user", label: "General User" },
    { value: "admin", label: "Administrator" },
  ])
  .onSubmit(async (data) => {
    await api.post("/users", data);
  })
  .build();
```

### 6-3. Email Sending Builder

```typescript
interface EmailConfig {
  to: string[];
  cc?: string[];
  bcc?: string[];
  from: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  priority?: "high" | "normal" | "low";
  headers?: Record<string, string>;
}

class EmailBuilder<
  HasTo extends boolean = false,
  HasFrom extends boolean = false,
  HasSubject extends boolean = false,
  HasBody extends boolean = false
> {
  private config: Partial<EmailConfig> = {
    to: [],
    cc: [],
    bcc: [],
    attachments: [],
    priority: "normal",
  };

  to(...addresses: string[]): EmailBuilder<true, HasFrom, HasSubject, HasBody> {
    this.config.to = addresses;
    return this as any;
  }

  cc(...addresses: string[]): this {
    this.config.cc = addresses;
    return this;
  }

  bcc(...addresses: string[]): this {
    this.config.bcc = addresses;
    return this;
  }

  from(address: string): EmailBuilder<HasTo, true, HasSubject, HasBody> {
    this.config.from = address;
    return this as any;
  }

  replyTo(address: string): this {
    this.config.replyTo = address;
    return this;
  }

  subject(subject: string): EmailBuilder<HasTo, HasFrom, true, HasBody> {
    this.config.subject = subject;
    return this as any;
  }

  text(content: string): EmailBuilder<HasTo, HasFrom, HasSubject, true> {
    this.config.text = content;
    return this as any;
  }

  html(content: string): EmailBuilder<HasTo, HasFrom, HasSubject, true> {
    this.config.html = content;
    return this as any;
  }

  attach(
    filename: string,
    content: Buffer | string,
    contentType?: string
  ): this {
    this.config.attachments!.push({ filename, content, contentType });
    return this;
  }

  priority(level: "high" | "normal" | "low"): this {
    this.config.priority = level;
    return this;
  }

  // build is only available when all required fields are set
  build(
    this: EmailBuilder<true, true, true, true>
  ): EmailConfig {
    return { ...this.config } as EmailConfig;
  }

  // Send in one go
  async send(
    this: EmailBuilder<true, true, true, true>,
    transporter: EmailTransporter
  ): Promise<Result<void, EmailError>> {
    const config = this.build();
    return transporter.send(config);
  }
}

// Usage example
const email = new EmailBuilder()
  .to("alice@example.com", "bob@example.com")
  .from("noreply@myapp.com")
  .subject("Order Confirmation")
  .html("<h1>Thank you for your order</h1><p>Order number: #12345</p>")
  .attach("invoice.pdf", invoiceBuffer, "application/pdf")
  .priority("high")
  .build();

// Missing required fields: compile error
const incomplete = new EmailBuilder()
  .to("alice@example.com")
  .subject("Test")
  .build(); // Error: from and body are not set
```

### 6-4. CLI Command Builder

```typescript
// Type-safe construction of CLI commands
interface CommandConfig {
  name: string;
  description: string;
  args: Array<{
    name: string;
    description: string;
    required: boolean;
    type: "string" | "number" | "boolean";
    default?: unknown;
  }>;
  options: Array<{
    long: string;
    short?: string;
    description: string;
    type: "string" | "number" | "boolean";
    default?: unknown;
    required?: boolean;
  }>;
  handler: (args: Record<string, unknown>, options: Record<string, unknown>) => void | Promise<void>;
}

class CommandBuilder {
  private config: Partial<CommandConfig> = {
    args: [],
    options: [],
  };

  name(name: string): this {
    this.config.name = name;
    return this;
  }

  description(desc: string): this {
    this.config.description = desc;
    return this;
  }

  argument(
    name: string,
    description: string,
    options?: { required?: boolean; type?: "string" | "number" | "boolean"; default?: unknown }
  ): this {
    this.config.args!.push({
      name,
      description,
      required: options?.required ?? true,
      type: options?.type ?? "string",
      default: options?.default,
    });
    return this;
  }

  option(
    long: string,
    description: string,
    options?: {
      short?: string;
      type?: "string" | "number" | "boolean";
      default?: unknown;
      required?: boolean;
    }
  ): this {
    this.config.options!.push({
      long,
      description,
      short: options?.short,
      type: options?.type ?? "string",
      default: options?.default,
      required: options?.required,
    });
    return this;
  }

  handler(
    fn: (args: Record<string, unknown>, options: Record<string, unknown>) => void | Promise<void>
  ): this {
    this.config.handler = fn;
    return this;
  }

  build(): CommandConfig {
    if (!this.config.name) throw new Error("Command name is required");
    if (!this.config.handler) throw new Error("Command handler is required");
    return this.config as CommandConfig;
  }
}

// Usage example
const deployCommand = new CommandBuilder()
  .name("deploy")
  .description("Deploy the application")
  .argument("environment", "The target deployment environment", { type: "string" })
  .option("--force", "Force deploy", { short: "-f", type: "boolean", default: false })
  .option("--tag", "Tag to deploy", { short: "-t", type: "string" })
  .option("--timeout", "Timeout (seconds)", { type: "number", default: 300 })
  .handler(async (args, options) => {
    console.log(`Deploying to ${args.environment}...`);
    if (options.force) console.log("Force mode enabled");
  })
  .build();
```

### 6-5. Pipeline Builder

```typescript
// Type-safe construction of data transformation pipelines
type TransformFn<In, Out> = (input: In) => Out | Promise<Out>;

class PipelineBuilder<TInput, TCurrent = TInput> {
  private steps: Array<TransformFn<any, any>> = [];

  static from<T>(): PipelineBuilder<T, T> {
    return new PipelineBuilder();
  }

  pipe<TNext>(
    transform: TransformFn<TCurrent, TNext>
  ): PipelineBuilder<TInput, TNext> {
    this.steps.push(transform);
    return this as unknown as PipelineBuilder<TInput, TNext>;
  }

  tap(fn: (value: TCurrent) => void): PipelineBuilder<TInput, TCurrent> {
    this.steps.push((value: TCurrent) => {
      fn(value);
      return value;
    });
    return this;
  }

  filter(
    predicate: (value: TCurrent) => boolean,
    errorMessage?: string
  ): PipelineBuilder<TInput, TCurrent> {
    this.steps.push((value: TCurrent) => {
      if (!predicate(value)) {
        throw new Error(errorMessage ?? "Filter condition not met");
      }
      return value;
    });
    return this;
  }

  build(): (input: TInput) => Promise<TCurrent> {
    const steps = [...this.steps];
    return async (input: TInput) => {
      let result: unknown = input;
      for (const step of steps) {
        result = await step(result);
      }
      return result as TCurrent;
    };
  }
}

// Usage example
interface RawOrder {
  items: Array<{ productId: string; quantity: string; price: string }>;
  customerId: string;
  note?: string;
}

interface ProcessedOrder {
  items: Array<{ productId: string; quantity: number; price: number; total: number }>;
  customerId: string;
  subtotal: number;
  tax: number;
  total: number;
  note?: string;
}

const processOrder = PipelineBuilder.from<RawOrder>()
  .pipe((raw) => ({
    ...raw,
    items: raw.items.map((item) => ({
      productId: item.productId,
      quantity: parseInt(item.quantity, 10),
      price: parseFloat(item.price),
      total: parseInt(item.quantity, 10) * parseFloat(item.price),
    })),
  }))
  .filter(
    (order) => order.items.length > 0,
    "Order must contain at least one item"
  )
  .filter(
    (order) => order.items.every((i) => i.quantity > 0),
    "Quantity must be 1 or more"
  )
  .pipe((order) => {
    const subtotal = order.items.reduce((sum, item) => sum + item.total, 0);
    const tax = Math.round(subtotal * 0.1);
    return {
      ...order,
      subtotal,
      tax,
      total: subtotal + tax,
    } as ProcessedOrder;
  })
  .tap((order) => console.log(`Order total: ${order.total}`))
  .build();

// Execute
const result = await processOrder({
  items: [
    { productId: "p1", quantity: "2", price: "1000" },
    { productId: "p2", quantity: "1", price: "2500" },
  ],
  customerId: "c1",
});
```

---

## Comparison Table

### Comparison of Builder Pattern Variations

| Pattern | Type Safety | Implementation Cost | Flexibility | Order Enforcement | Branching |
|---------|-------------|---------------------|-------------|-------------------|-----------|
| Classic Builder | Low | Low | High | None | Not possible |
| Phantom Type | High | Medium | Medium | None | Not possible |
| Step Builder | Highest | High | Low | Yes | Not possible |
| Immutable Builder | High | Medium | High | None | Possible |
| Functional Composition Builder | High | Medium | High | None | Possible |
| Proxy Builder | Medium | Low | High | None | Possible |

### Builder vs Other Creational Patterns

| Axis | Builder | Factory | Constructor | Object.assign |
|------|---------|---------|-------------|---------------|
| Number of arguments | Best for many | Few to medium | Few to medium | Medium |
| Step-by-step construction | Possible | Not possible | Not possible | Not possible |
| Validation | At build() | At creation | Immediately | None |
| IDE completion | Excellent | Good | Normal | Limited |
| Immutability | Guaranteeable | Guaranteeable | Design-dependent | Difficult |
| Test data | Ideal | Good | Not suitable | Possible |
| Readability | High | Medium | Low (with many args) | Medium |

### Usage Guidelines

| Scenario | Recommended Pattern | Reason |
|----------|---------------------|--------|
| HTTP request construction | Step Builder | Method and URL are required; order is natural |
| Test data generation | Classic or factory function | Default values matter; lower type safety is acceptable |
| Configuration objects | Phantom Type | Validating required settings is important |
| Query construction | Fluent API | Method chaining naturally forms a DSL |
| Email sending | Phantom Type | to/from/subject are required |
| CLI commands | Classic | Flexibility is prioritized; few required fields |
| Pipelines | Functional composition | Type transformations need to be tracked in a chain |

---

## Anti-Patterns

### AP-1: Escaping Types with `any`

```typescript
// NG: Destroys type safety with as any
class BadBuilder {
  private config: any = {};

  set(key: string, value: any): this {
    this.config[key] = value;
    return this;
  }

  build(): HttpRequest {
    return this.config as HttpRequest; // No validation
  }
}

// OK: Track types with generics
class GoodBuilder<T extends Partial<HttpRequest> = {}> {
  constructor(private config: T) {}

  set<K extends keyof HttpRequest>(
    key: K,
    value: HttpRequest[K]
  ): GoodBuilder<T & Pick<HttpRequest, K>> {
    return new GoodBuilder({ ...this.config, [key]: value } as T & Pick<HttpRequest, K>);
  }

  build(this: GoodBuilder<HttpRequest>): HttpRequest {
    return { ...this.config };
  }
}
```

### AP-2: Exposing Mutable State

```typescript
// NG: Internal builder state can be modified from outside
class LeakyBuilder {
  headers: Record<string, string> = {}; // public!

  build(): HttpRequest {
    return { /* ... */ headers: this.headers, /* ... */ } as HttpRequest;
    // If headers is modified after build, the already-constructed object also changes
  }
}

// OK: private + copy
class SafeBuilder {
  private headers: Record<string, string> = {};

  addHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  build(): HttpRequest {
    return {
      /* ... */
      headers: { ...this.headers }, // Return a copy using spread
      /* ... */
    } as HttpRequest;
  }
}
```

### AP-3: State Pollution from Builder Reuse

```typescript
// NG: Reusing a mutable builder
const builder = new HttpRequestBuilder()
  .setUrl("https://api.example.com");

const req1 = builder.setMethod("GET").build();
const req2 = builder.setMethod("POST").build();
// req1.method may have become "POST"!

// OK: Reset state after build
class ResettableBuilder {
  // ... fields omitted ...

  build(): HttpRequest {
    const result = { /* ... */ } as HttpRequest;
    this.reset(); // Reset state after build
    return result;
  }

  private reset(): void {
    this.method = "GET";
    this.url = "";
    this.headers = {};
    this.body = undefined;
    this.timeout = 30000;
  }
}

// Better: use an immutable builder (see section 4)
```

### AP-4: Overly Complex Builders

```typescript
// NG: A builder is unnecessary for a simple object
class PointBuilder {
  private x = 0;
  private y = 0;

  setX(x: number): this { this.x = x; return this; }
  setY(y: number): this { this.y = y; return this; }

  build(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}

// OK: Create simple objects directly
const point = { x: 10, y: 20 };

// When to use a builder:
// - 5 or more fields
// - Complex combinations of required and optional fields
// - Construction requires validation
// - Frequently used for generating test data
```

### AP-5: Calling Methods After build()

```typescript
// NG: Calling methods after build has no effect
const builder = new HttpRequestBuilder();
const request = builder.setUrl("https://example.com").build();
builder.setMethod("POST"); // Not reflected in request

// OK: Design the API to encourage single-use builders
// Option 1: Invalidate the builder after build
class OneTimeBuilder {
  private built = false;

  // ... setter methods ...

  build(): HttpRequest {
    if (this.built) {
      throw new Error("Builder already used. Create a new instance.");
    }
    this.built = true;
    return { /* ... */ } as HttpRequest;
  }
}

// Option 2: Factory style with a static method
const request2 = HttpRequestBuilder.create()
  .setUrl("https://example.com")
  .setMethod("POST")
  .build();
```

---

## Performance Considerations

### Immutable vs Mutable Builder Performance

```typescript
// ─── Benchmark Comparison ───

// Mutable builder: ~50ns/op
// - Only one object is created
// - Each method only assigns a property

// Immutable builder: ~200ns/op
// - A new object is created in each method
// - Copy cost from the spread operator

// ─── Optimization Tips ───

// 1. Choose Mutable if the builder is used frequently
// 2. Immutable is safer for test data generation
// 3. Use direct object literals in hot paths
// 4. Proxy-based builders are the slowest (~1000ns/op)

// ─── Memory Efficiency ───

// When generating a large number of builder instances:
// - Mutable: Can create multiple objects from a single instance
// - Immutable: Creates one instance per step in the method chain
//   (though they are collected by GC)

// Reference benchmark values:
// 10,000 builds:
//   Mutable Builder: ~0.5ms
//   Immutable Builder: ~2ms
//   Proxy Builder: ~10ms
//   Direct object literal: ~0.1ms
```

---

## FAQ

### Q1: When should I use a builder pattern vs a factory pattern?

A builder is appropriate when there are 4 or more arguments, or when there are many optional arguments. A factory is sufficient when arguments are few and fixed. Test data generation is the most effective use case for builders.

### Q2: Does the Phantom Type builder affect performance?

Type parameters only exist at compile time and have absolutely no effect on the JavaScript output. The `as unknown as` casts also have zero runtime cost. There is no need to worry about performance.

### Q3: Which is better, an Immutable builder or a Mutable builder?

An Immutable builder (returning a new instance in each method) is safe but increases memory allocation. A Mutable builder (returning `this`) is efficient but cannot be used to save an intermediate state and branch from it. In general, Mutable is sufficient, but choose Immutable when you want to save the builder to a variable and branch from it.

### Q4: Does the builder pattern conflict with functional programming?

An Immutable builder is fully aligned with the principles of functional programming since each method returns a new instance. In fact, the pattern of building pipelines through function composition can be considered the functional equivalent of a builder. However, Mutable builders modify internal state and are therefore not suited for a purely functional style.

### Q5: Should I use faker.js for test data builders?

Random data reduces test reproducibility, so it is generally recommended to use fixed default values. However, faker.js is useful for property-based tests (fast-check) and stress tests. For regular unit tests, use explicit fixed values like `UserBuilder.create().withName("Alice")` to make intent clear.

### Q6: How do I deal with too many interfaces in a Step Builder?

If there are N required fields, up to N+1 interfaces are needed. If this is too many, consider using a Phantom Type builder to track state with type parameters, or a hybrid approach where required fields are received in the constructor and only optional fields are set via the builder.

### Q7: How should I design a builder for nested objects?

An effective pattern is to have the parent builder provide a method that accepts a callback function and passes a child builder as the argument. This creates an API like `.server((s) => s.host("localhost").port(3000))`. Refer to the `ConfigBuilder` in section 3-5.

### Q8: How should I test a builder pattern?

When testing the builder itself, verify: (1) a normal build with all fields set, (2) an error when a required field is not set, (3) confirmation of default values, and (4) the return types of method chains. For Phantom Type builders, testing compile errors (with the `// @ts-expect-error` annotation) is also important.

---

## Summary Table

| Concept | Key Point |
|---------|-----------|
| Classic Builder | Step-by-step construction but insufficient type safety |
| Phantom Type | Tracks set state using generic flags |
| Step Builder | Enforces order by splitting into interfaces |
| Fluent API | Builds an intuitive DSL with method chaining |
| Immutable Builder | Returns a new instance in each method; safe branching |
| Test Data Builder | Generate test data with `.create().withX().build()` |
| Scenario Builder | Generate multiple related entities at once |
| Pipeline Builder | Track types across a chain of data transformations |
| Immutable Copy | Return a spread copy in `build()` |
| Proxy Builder | A general-purpose builder that generates methods dynamically |

---


## Summary

This guide covered the following key points:

- Understanding basic concepts and principles
- Practical implementation patterns
- Best practices and pitfalls
- How to apply them in real-world work

---

## Guides to Read Next

- [Branded Types](./03-branded-types.md) -- Adding brands to values produced by a builder
- [DI Pattern](./04-dependency-injection.md) -- Factory design combining builders and DI
- [Discriminated Unions](./02-discriminated-unions.md) -- Discriminated unions supporting the type safety of Step Builders
- [Error Handling](./00-error-handling.md) -- Integration patterns with the Result type

---

## References

1. **Design Patterns: Elements of Reusable Object-Oriented Software** -- Gamma et al. (GoF)
   The original source for the Builder pattern

2. **TypeScript Deep Dive - Phantom Types**
   https://basarat.gitbook.io/typescript/

3. **Fluent Interface** -- Martin Fowler
   https://martinfowler.com/bliki/FluentInterface.html

4. **Effective TypeScript** -- Dan Vanderkam
   Explanation of type-safe builder patterns

5. **The Builder Pattern in TypeScript** -- Marius Schulz
   https://mariusschulz.com/blog/tagged/typescript

6. **Phantom Types in TypeScript** -- GitHub Advanced Security
   https://github.blog/engineering/

7. **Test Data Builders** -- Nat Pryce
   http://natpryce.com/articles/000714.html

8. **faker.js** -- Fake data generator
   https://fakerjs.dev/
