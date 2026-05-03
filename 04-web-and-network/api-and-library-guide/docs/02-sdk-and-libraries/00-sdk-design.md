# SDK Design

> SDKs are the frontline that determines the developer experience of an API. Master best practices for SDK design that developers love — from type-safe client design, Builder patterns, error handling, and retry strategies to authentication abstraction.

## What You Will Learn in This Chapter

- [ ] Understand SDK design principles and methods for quantitatively evaluating DX (Developer Experience)
- [ ] Grasp type-safe client implementation patterns and design trade-offs
- [ ] Design and implement abstraction layers for retry, authentication, and pagination
- [ ] Build an error hierarchy and user-friendly failure recovery flows
- [ ] Master versioning strategies and breaking change management techniques
- [ ] Practice SDK quality assurance through testability and mock strategies

## Prerequisites

- REST API design principles → See: [REST Best Practices](../01-rest-and-graphql/00-rest-best-practices.md)
- TypeScript type system fundamentals → See: TypeScript Complete Guide
- Basic knowledge of npm/package managers

---

## 1. Overview of SDK Design

### 1.1 What Is an SDK?

An SDK (Software Development Kit) is a development toolkit for utilizing a specific API or platform. It is designed not merely as an HTTP wrapper, but as a development foundation that integrates multiple layers of functionality including authentication management, error handling, type safety, pagination, retry, and logging.

```
+------------------------------------------------------------------+
|                    SDK Architecture Overview                      |
+------------------------------------------------------------------+
|                                                                    |
|  +--------------------+    +--------------------+                  |
|  |   Developer Code   |    |   SDK Public API   |                  |
|  |                    | -> |  (Type-safe         |                  |
|  |                    |    |   Interface)        |                  |
|  +--------------------+    +--------+-----------+                  |
|                                     |                              |
|                          +----------v-----------+                  |
|                          |  Resource Layer       |                  |
|                          |  users / orders / ...  |                 |
|                          +----------+-----------+                  |
|                                     |                              |
|                          +----------v-----------+                  |
|                          |  Middleware Pipeline  |                  |
|                          |  Auth -> Retry ->     |                  |
|                          |  RateLimit -> Log     |                  |
|                          +----------+-----------+                  |
|                                     |                              |
|                          +----------v-----------+                  |
|                          |  HTTP Transport       |                  |
|                          |  fetch / axios / node  |                 |
|                          +----------+-----------+                  |
|                                     |                              |
|                          +----------v-----------+                  |
|                          |  Serialization        |                  |
|                          |  JSON / Protobuf      |                  |
|                          +----------+-----------+                  |
|                                     |                              |
|                          +----------v-----------+                  |
|                          |  External API Server  |                 |
|                          +----------------------+                  |
+------------------------------------------------------------------+
```

### 1.2 The 5 Principles of SDK Design

Excellent SDKs are designed according to the following 5 principles. These are common patterns extracted from globally well-regarded SDKs such as Stripe, Twilio, and AWS.

#### Principle 1: Principle of Least Surprise

SDK behavior should align with developers' intuition. Method names, argument order, and return value types must all be "predictable."

```typescript
// Good: Intuitive method names and arguments
const user = await client.users.get("user_123");
const users = await client.users.list({ limit: 20 });

// Bad: Cannot predict what this does
const user = await client.fetch("users", "user_123", true, null);
const users = await client.query({ type: "user", max: 20, mode: 1 });
```

#### Principle 2: Progressive Disclosure

Basic operations can be accomplished with minimal code, while advanced features can be discovered and used when needed.

```typescript
// Level 1: Start using with minimal configuration
const client = new ExampleClient({ apiKey: "sk_live_abc" });

// Level 2: Add options as needed
const client = new ExampleClient({
  apiKey: "sk_live_abc",
  timeout: 60000,
  maxRetries: 5,
});

// Level 3: Advanced customization
const client = new ExampleClient({
  apiKey: "sk_live_abc",
  timeout: 60000,
  maxRetries: 5,
  httpAgent: new https.Agent({ keepAlive: true }),
  middleware: [loggingMiddleware, metricsMiddleware],
  baseUrl: "https://api-staging.example.com/v2",
});
```

#### Principle 3: Fail Fast, Fail Clearly

Invalid input or configuration should be detected before the API call and throw an immediately understandable error.

```typescript
class ExampleClient {
  constructor(config: ClientConfig) {
    // Validate on initialization
    if (!config.apiKey) {
      throw new ConfigurationError(
        "API key is required. Get your key at https://dashboard.example.com/api-keys"
      );
    }
    if (config.apiKey.startsWith("sk_test_") && config.baseUrl?.includes("production")) {
      throw new ConfigurationError(
        "Test API key cannot be used with production endpoint. " +
        "Use a live key (sk_live_*) or switch to the sandbox endpoint."
      );
    }
    if (config.timeout !== undefined && config.timeout < 0) {
      throw new ConfigurationError(
        `Invalid timeout value: ${config.timeout}. Timeout must be a positive number in milliseconds.`
      );
    }
  }
}
```

#### Principle 4: Idiomatic Design

Follow the idioms and ecosystem conventions of each programming language. TypeScript SDKs return Promises, Go SDKs return error values, and Python SDKs leverage generators.

```typescript
// TypeScript: async/await + Promise
const user = await client.users.get("123");

// The same operation in Go would look like:
// user, err := client.Users.Get(ctx, "123")
// if err != nil { ... }

// The same operation in Python would look like:
// user = client.users.get("123")
// for user in client.users.list():  # generator
```

#### Principle 5: Backward Compatibility

Minor version upgrades must not break existing code. Breaking changes should be consolidated into major versions, and migration guides should be provided.

### 1.3 Quantitative Metrics for DX (Developer Experience)

```
+---------------------------------------------------------------+
|                    DX Evaluation Matrix                        |
+------------------+-------------+-------------+----------------+
| Metric           | Target      | Measurement | Improvement    |
+------------------+-------------+-------------+----------------+
| Time to First    | < 5 min     | Tutorial    | Quick Start    |
| API Call (TTFAC) |             | completion  | guide          |
|                  |             | time        |                |
+------------------+-------------+-------------+----------------+
| Lines of Code    | < 5 lines   | Lines       | Optimize       |
| (LOC)            |             | needed for  | default values |
|                  |             | basic ops   |                |
+------------------+-------------+-------------+----------------+
| Error Recovery   | < 30 sec    | Recovery    | Actionable     |
| Time (ERT)       |             | from error  | error messages |
|                  |             | message     |                |
+------------------+-------------+-------------+----------------+
| Feature          | > 90%       | % of        | Improve        |
| Discoverability  |             | features    | type           |
|                  |             | discoverable| definitions    |
|                  |             | via IDE     |                |
+------------------+-------------+-------------+----------------+
| Dependency       | < 3         | Dependencies| Minimize       |
| Count            |             | in          | bundle         |
|                  |             | package.json|                |
+------------------+-------------+-------------+----------------+
| Bundle Size      | < 50KB      | minified +  | Tree shaking   |
|                  | (gzip)      | gzip        | support        |
+------------------+-------------+-------------+----------------+
```

### 1.4 Deciding SDK Scope

When designing an SDK, the first decision to make is scope. Whether to build a full-coverage SDK that covers all API endpoints or a lightweight SDK focused on primary use cases significantly changes design decisions.

| Scope | Characteristics | Best For |
|-------|----------------|----------|
| Full Coverage | Type-safely wraps all endpoints | Enterprise use, stable API |
| Core Only | Provides only primary operations (CRUD) | Startups, frequently changing API |
| Code Generation | Auto-generated from OpenAPI spec | Large APIs, multi-language support |
| Hybrid | Handwritten core + auto-generated extensions | Balance-focused |

---

## 2. Client Design Patterns

### 2.1 Comparison of Major Patterns

SDK client design patterns fall into roughly 3 categories. Understand the characteristics of each and choose the optimal pattern for your project.

| Pattern | Type Safety | Learning Cost | Extensibility | Representative SDK |
|---------|-------------|---------------|---------------|-------------------|
| Resource-based | High | Low | High | Stripe, Twilio |
| Fluent API | Medium | Medium | Medium | Elasticsearch |
| Function-based | High | Low | Medium | AWS SDK v3 |
| Builder | High | High | High | Google Cloud |
| Proxy-based | High | Low | High | tRPC |

### 2.2 Resource-based Pattern (Recommended)

The Resource-based pattern represents API resources as objects and attaches CRUD methods to those objects. It has strong affinity with REST APIs and is the most widely adopted.

```typescript
// --- Consumer code ---

// Basic CRUD operations
const user = await client.users.get("user_123");
const users = await client.users.list({ role: "admin", limit: 20 });
const newUser = await client.users.create({
  name: "Taro Yamada",
  email: "taro@example.com",
});
const updated = await client.users.update("user_123", { name: "Updated Name" });
await client.users.delete("user_123");

// Nested resources
const orders = await client.users.orders.list("user_123", { status: "active" });
const address = await client.users.addresses.get("user_123", "addr_456");
```

```typescript
// --- SDK internal implementation ---

// Client class
class ExampleClient {
  private config: ResolvedClientConfig;
  readonly users: UsersResource;
  readonly orders: OrdersResource;
  readonly products: ProductsResource;

  constructor(config: ClientConfig) {
    this.config = this.resolveConfig(config);
    this.validateConfig(this.config);

    const httpClient = new HttpClient(this.config);
    this.users = new UsersResource(httpClient);
    this.orders = new OrdersResource(httpClient);
    this.products = new ProductsResource(httpClient);
  }

  private resolveConfig(config: ClientConfig): ResolvedClientConfig {
    return {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? "https://api.example.com/v1",
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      userAgent: `example-sdk-ts/${SDK_VERSION}`,
    };
  }

  private validateConfig(config: ResolvedClientConfig): void {
    if (!config.apiKey) {
      throw new ConfigurationError(
        "API key is required. " +
        "Obtain your API key from https://dashboard.example.com/api-keys"
      );
    }
  }
}

// Type definitions
interface ClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface ResolvedClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  userAgent: string;
}
```

### 2.3 Fluent API / Method Chaining Pattern

A pattern that excels for use cases like query builders. Allows building complex filtering and search conditions intuitively.

```typescript
// Usage example
const users = await client.users
  .list()
  .filter({ role: "admin", status: "active" })
  .sort("-createdAt")
  .fields("id", "name", "email")
  .limit(20)
  .execute();

// Implementation
class QueryBuilder<T> {
  private params: Record<string, any> = {};

  constructor(
    private httpClient: HttpClient,
    private path: string
  ) {}

  filter(conditions: Record<string, any>): this {
    this.params.filter = { ...this.params.filter, ...conditions };
    return this;
  }

  sort(field: string): this {
    this.params.sort = field;
    return this;
  }

  fields(...fields: string[]): this {
    this.params.fields = fields.join(",");
    return this;
  }

  limit(n: number): this {
    this.params.limit = n;
    return this;
  }

  async execute(): Promise<PaginatedResponse<T>> {
    return this.httpClient.request<PaginatedResponse<T>>(
      "GET",
      this.path,
      { params: this.params }
    );
  }
}
```

### 2.4 Function-based Pattern

A pattern adopted by AWS SDK v3. Works well with Tree shaking and excels at bundle size optimization.

```typescript
// Usage example (AWS SDK v3 style)
import { ExampleClient, GetUserCommand, ListUsersCommand } from "example-sdk";

const client = new ExampleClient({ apiKey: "sk_live_abc" });

const user = await client.send(new GetUserCommand({ userId: "user_123" }));
const users = await client.send(new ListUsersCommand({ limit: 20 }));

// Command class implementation
class GetUserCommand {
  readonly input: { userId: string };

  constructor(input: { userId: string }) {
    this.input = input;
  }

  resolveEndpoint(): string {
    return `/users/${this.input.userId}`;
  }

  resolveMethod(): string {
    return "GET";
  }
}

class ListUsersCommand {
  readonly input: { limit?: number; cursor?: string; role?: string };

  constructor(input: { limit?: number; cursor?: string; role?: string }) {
    this.input = input;
  }

  resolveEndpoint(): string {
    return "/users";
  }

  resolveMethod(): string {
    return "GET";
  }
}
```

### 2.5 Builder Pattern

A pattern suited for constructing objects with complex configuration. Adopted by Google Cloud SDK and others.

```typescript
// Request builder
const request = new SearchRequestBuilder()
  .query("typescript sdk")
  .filter("language", "ja")
  .dateRange(new Date("2024-01-01"), new Date("2024-12-31"))
  .pageSize(50)
  .includeMetadata(true)
  .build();

const results = await client.search.execute(request);

// Builder implementation
class SearchRequestBuilder {
  private request: Partial<SearchRequest> = {};

  query(q: string): this {
    this.request.query = q;
    return this;
  }

  filter(field: string, value: string): this {
    if (!this.request.filters) this.request.filters = {};
    this.request.filters[field] = value;
    return this;
  }

  dateRange(from: Date, to: Date): this {
    this.request.dateFrom = from.toISOString();
    this.request.dateTo = to.toISOString();
    return this;
  }

  pageSize(size: number): this {
    if (size < 1 || size > 100) {
      throw new ValidationError("Page size must be between 1 and 100");
    }
    this.request.pageSize = size;
    return this;
  }

  includeMetadata(include: boolean): this {
    this.request.includeMetadata = include;
    return this;
  }

  build(): SearchRequest {
    if (!this.request.query) {
      throw new ValidationError("Query is required");
    }
    return this.request as SearchRequest;
  }
}
```

---

## 3. HTTP Communication Foundation

### 3.1 Abstracting the HTTP Client

The HTTP communication layer inside an SDK should ideally avoid dependency on external libraries. This is to ensure testability and environment portability.

```typescript
// HTTP client interface
interface HttpTransport {
  request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>>;
}

interface HttpRequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

interface HttpResponse<T> {
  status: number;
  headers: Record<string, string>;
  data: T;
  requestId?: string;
}

// fetch-based implementation
class FetchTransport implements HttpTransport {
  async request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    const response = await fetch(options.url, {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal ?? AbortSignal.timeout(options.timeout ?? 30000),
    });

    const data = response.status === 204
      ? (undefined as T)
      : await response.json() as T;

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      requestId: response.headers.get("x-request-id") ?? undefined,
    };
  }
}

// Node.js environment implementation (with keep-alive support)
class NodeTransport implements HttpTransport {
  private agent: https.Agent;

  constructor() {
    this.agent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
    });
  }

  async request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    // Implementation using node:https
    // ...omitted
  }
}
```

### 3.2 BaseResource: Common HTTP Communication Foundation

```typescript
class BaseResource {
  constructor(private httpClient: HttpClient) {}

  protected async request<T>(
    method: string,
    path: string,
    options?: { params?: Record<string, any>; body?: any }
  ): Promise<T> {
    const url = new URL(path, this.httpClient.baseUrl);

    // Build query parameters
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            // Array parameters: ?role=admin&role=user
            value.forEach(v => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }

    // Execute request through the middleware pipeline
    return this.httpClient.executeWithMiddleware<T>({
      method,
      url: url.toString(),
      body: options?.body,
    });
  }
}
```

### 3.3 Middleware Pipeline

A design that separates cross-cutting concerns inside the SDK as middleware. Authentication, retry, logging, and metrics can be managed as independent modules.

```
+------------------------------------------------------------------+
|                    Middleware Pipeline                            |
+------------------------------------------------------------------+
|                                                                    |
|  Request -->  [Auth]  -->  [Retry]  -->  [RateLimit]              |
|                                              |                     |
|                                         [Logging]                  |
|                                              |                     |
|                                         [Metrics]                  |
|                                              |                     |
|                                         [Transport]                |
|                                              |                     |
|  Response <-- [Transform] <-- [Validate] <---+                    |
|                                                                    |
+------------------------------------------------------------------+
```

```typescript
// Middleware type definition
type Middleware = (
  request: HttpRequestOptions,
  next: (request: HttpRequestOptions) => Promise<HttpResponse<unknown>>
) => Promise<HttpResponse<unknown>>;

// Authentication middleware
const authMiddleware = (authManager: AuthManager): Middleware => {
  return async (request, next) => {
    const token = await authManager.getToken();
    request.headers = {
      ...request.headers,
      Authorization: `Bearer ${token}`,
    };
    return next(request);
  };
};

// Logging middleware
const loggingMiddleware = (logger: Logger): Middleware => {
  return async (request, next) => {
    const startTime = Date.now();
    logger.debug(`[SDK] ${request.method} ${request.url}`);

    try {
      const response = await next(request);
      const duration = Date.now() - startTime;
      logger.debug(
        `[SDK] ${request.method} ${request.url} -> ${response.status} (${duration}ms)`
      );
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        `[SDK] ${request.method} ${request.url} -> ERROR (${duration}ms)`,
        error
      );
      throw error;
    }
  };
};

// Metrics middleware
const metricsMiddleware = (metrics: MetricsCollector): Middleware => {
  return async (request, next) => {
    const startTime = performance.now();
    try {
      const response = await next(request);
      metrics.recordLatency(request.method, request.url, performance.now() - startTime);
      metrics.incrementCounter(`sdk.request.${response.status}`);
      return response;
    } catch (error) {
      metrics.incrementCounter("sdk.request.error");
      throw error;
    }
  };
};

// HTTP client (with middleware integration)
class HttpClient {
  readonly baseUrl: string;
  private transport: HttpTransport;
  private middlewares: Middleware[];

  constructor(config: ResolvedClientConfig) {
    this.baseUrl = config.baseUrl;
    this.transport = new FetchTransport();
    this.middlewares = [];
  }

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async executeWithMiddleware<T>(
    options: HttpRequestOptions
  ): Promise<T> {
    // Build the middleware chain
    const execute = this.middlewares.reduceRight(
      (next, middleware) => (req: HttpRequestOptions) => middleware(req, next),
      (req: HttpRequestOptions) => this.transport.request<T>(req)
    );

    const response = await execute(options);
    if (response.status >= 400) {
      throw this.createError(response);
    }
    return response.data as T;
  }

  private createError(response: HttpResponse<unknown>): ExampleError {
    const body = response.data as any;
    return new ExampleError({
      status: response.status,
      code: body?.code ?? "UNKNOWN_ERROR",
      message: body?.message ?? body?.detail ?? `HTTP ${response.status}`,
      retryable: response.status >= 500 || response.status === 429,
      headers: response.headers,
      requestId: response.requestId,
    });
  }
}
```

---

## 4. Retry Strategy

### 4.1 Exponential Backoff

Retry is an important mechanism for handling transient errors (network failures, server overload, rate limits). However, disorganized retries increase server load, so exponential backoff is combined with jitter.

```typescript
// Retry middleware
const retryMiddleware = (config: RetryConfig): Middleware => {
  return async (request, next) => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await next(request);
      } catch (error) {
        lastError = error as Error;

        // Determine if retry is appropriate
        if (!shouldRetry(error, attempt, config)) {
          throw error;
        }

        // Calculate wait time
        const delay = calculateDelay(attempt, error, config);
        await sleep(delay);
      }
    }

    throw lastError;
  };
};

function shouldRetry(
  error: unknown,
  attempt: number,
  config: RetryConfig
): boolean {
  if (attempt >= config.maxRetries) return false;

  if (error instanceof ExampleError) {
    // Explicitly non-retryable error
    if (!error.retryable) return false;

    // 429 Too Many Requests: follow the Retry-After header
    if (error.status === 429) return true;

    // 5xx: retry on server errors
    if (error.status >= 500) return true;

    // 408 Request Timeout
    if (error.status === 408) return true;
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  return false;
}

function calculateDelay(
  attempt: number,
  error: unknown,
  config: RetryConfig
): number {
  // Follow Retry-After header if present
  if (error instanceof RateLimitError && error.retryAfter > 0) {
    return error.retryAfter * 1000;
  }

  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);

  // Cap the maximum wait time
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  // Full jitter: randomize within [0, cappedDelay]
  const jitter = Math.random() * cappedDelay;

  return jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RetryConfig {
  maxRetries: number;    // Default: 3
  baseDelay: number;     // Default: 1000ms
  maxDelay: number;      // Default: 30000ms
}
```

### 4.2 Comparison of Jitter Strategies

```
Wait Time
  ^
  |                                          * Full Jitter
  |                                     *         (recommended)
  |                                *
  |                           *    ..... Equal Jitter
  |                      *  ..
  |                 *  ..
  |            * ..          _____ Fixed Backoff
  |         *..         ____/      (no jitter)
  |      *.        ____/
  |   ..*     ____/
  |  .*  ____/
  | * __/
  |_/________________________________________________> Retry Attempt
  0    1    2    3    4    5    6    7    8
```

| Jitter Strategy | Formula | Characteristics |
|-----------------|---------|-----------------|
| No Jitter | `base * 2^attempt` | Concentrates load on the server |
| Full Jitter | `random(0, base * 2^attempt)` | Distributes load most evenly (recommended) |
| Equal Jitter | `base * 2^attempt / 2 + random(0, base * 2^attempt / 2)` | More predictable than full jitter |
| Decorrelated Jitter | `min(cap, random(base, prev * 3))` | AWS recommended, randomization with correlation |

### 4.3 Idempotency and Retry Safety

Retry cannot be safely executed for all HTTP methods. Retrying non-idempotent requests (POST) requires an idempotency key.

```typescript
// Automatic idempotency key assignment
class IdempotencyMiddleware implements Middleware {
  async handle(
    request: HttpRequestOptions,
    next: (req: HttpRequestOptions) => Promise<HttpResponse<unknown>>
  ): Promise<HttpResponse<unknown>> {
    // Automatically assign an idempotency key to POST requests
    if (request.method === "POST" && !request.headers?.["Idempotency-Key"]) {
      request.headers = {
        ...request.headers,
        "Idempotency-Key": crypto.randomUUID(),
      };
    }
    return next(request);
  }
}
```

---

## 5. Error Design

### 5.1 Designing the Error Hierarchy

SDK errors should be designed hierarchically so that users can handle errors at the appropriate level of granularity. Catching the base class handles all errors, while catching individual subclasses handles only specific errors.

```
+------------------------------------------------------------------+
|                     Error Class Hierarchy                         |
+------------------------------------------------------------------+
|                                                                    |
|  Error (JavaScript built-in)                                      |
|    |                                                               |
|    +-- ExampleError (SDK base error)                               |
|          |                                                         |
|          +-- AuthenticationError (401)                              |
|          |     +-- InvalidApiKeyError                               |
|          |     +-- ExpiredTokenError                                |
|          |                                                         |
|          +-- AuthorizationError (403)                               |
|          |     +-- InsufficientPermissionError                      |
|          |                                                         |
|          +-- NotFoundError (404)                                    |
|          |                                                         |
|          +-- ConflictError (409)                                    |
|          |                                                         |
|          +-- ValidationError (422)                                  |
|          |     +-- InvalidParameterError                            |
|          |     +-- MissingRequiredFieldError                        |
|          |                                                         |
|          +-- RateLimitError (429)                                   |
|          |                                                         |
|          +-- InternalServerError (500)                              |
|          |                                                         |
|          +-- ServiceUnavailableError (503)                          |
|          |                                                         |
|          +-- NetworkError (connection-related)                      |
|          |     +-- TimeoutError                                     |
|          |     +-- ConnectionRefusedError                           |
|          |                                                         |
|          +-- ConfigurationError (SDK configuration error)          |
|                                                                    |
+------------------------------------------------------------------+
```

### 5.2 Implementing the Base Error Class

```typescript
class ExampleError extends Error {
  /** HTTP status code (0 for network errors) */
  readonly status: number;

  /** Error code returned by the API */
  readonly code: string;

  /** Whether automatic retry is safe */
  readonly retryable: boolean;

  /** Response headers */
  readonly headers: Record<string, string>;

  /** Server-side request ID (for support inquiries) */
  readonly requestId?: string;

  /** Timestamp when the error occurred */
  readonly timestamp: Date;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    retryable: boolean;
    headers: Record<string, string>;
    requestId?: string;
  }) {
    super(params.message);
    this.name = "ExampleError";
    this.status = params.status;
    this.code = params.code;
    this.retryable = params.retryable;
    this.headers = params.headers;
    this.requestId = params.requestId;
    this.timestamp = new Date();

    // Preserve V8 stack trace correctly
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Human-readable error information */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      retryable: this.retryable,
      requestId: this.requestId,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /** Generate message for support inquiry */
  toSupportMessage(): string {
    return [
      `Error: ${this.message}`,
      `Code: ${this.code}`,
      `Status: ${this.status}`,
      `Request ID: ${this.requestId ?? "N/A"}`,
      `Timestamp: ${this.timestamp.toISOString()}`,
    ].join("\n");
  }
}
```

### 5.3 Implementing Subclasses

```typescript
// Authentication error
class AuthenticationError extends ExampleError {
  constructor(message: string, requestId?: string) {
    super({
      status: 401,
      code: "AUTHENTICATION_ERROR",
      message: message || "Authentication failed. Please check your API key.",
      retryable: false,
      headers: {},
      requestId,
    });
    this.name = "AuthenticationError";
  }
}

// Rate limit error
class RateLimitError extends ExampleError {
  /** Seconds to wait before retrying */
  readonly retryAfter: number;

  /** Rate limit reset time (Unix timestamp) */
  readonly resetAt?: number;

  /** Remaining request count */
  readonly remaining?: number;

  constructor(params: {
    message: string;
    retryAfter: number;
    resetAt?: number;
    remaining?: number;
    requestId?: string;
  }) {
    super({
      status: 429,
      code: "RATE_LIMIT_EXCEEDED",
      message: params.message ||
        `Rate limit exceeded. Retry after ${params.retryAfter} seconds.`,
      retryable: true,
      headers: {},
      requestId: params.requestId,
    });
    this.name = "RateLimitError";
    this.retryAfter = params.retryAfter;
    this.resetAt = params.resetAt;
    this.remaining = params.remaining;
  }
}

// Validation error
class ValidationError extends ExampleError {
  /** Error details per field */
  readonly fieldErrors: Array<{
    field: string;
    message: string;
    code: string;
    expected?: string;
    received?: string;
  }>;

  constructor(
    message: string,
    fieldErrors: Array<{
      field: string;
      message: string;
      code: string;
      expected?: string;
      received?: string;
    }>,
    requestId?: string
  ) {
    super({
      status: 422,
      code: "VALIDATION_ERROR",
      message,
      retryable: false,
      headers: {},
      requestId,
    });
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }

  /** Get error for a specific field */
  getFieldError(fieldName: string): string | undefined {
    return this.fieldErrors.find(e => e.field === fieldName)?.message;
  }

  /** Display all field errors as a string */
  formatErrors(): string {
    return this.fieldErrors
      .map(e => `  - ${e.field}: ${e.message}`)
      .join("\n");
  }
}

// Network error
class NetworkError extends ExampleError {
  /** The original network error */
  readonly cause: Error;

  constructor(cause: Error) {
    super({
      status: 0,
      code: "NETWORK_ERROR",
      message: `Network error: ${cause.message}. Please check your internet connection.`,
      retryable: true,
      headers: {},
    });
    this.name = "NetworkError";
    this.cause = cause;
  }
}

// Timeout error
class TimeoutError extends NetworkError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(new Error(`Request timed out after ${timeoutMs}ms`));
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}
```

### 5.4 Error Handling Patterns

```typescript
// Pattern 1: Type-based branching (recommended)
try {
  const user = await client.users.create({
    name: "",
    email: "invalid-email",
  });
} catch (error) {
  if (error instanceof ValidationError) {
    // Display per-field errors
    console.log("Validation failed:");
    console.log(error.formatErrors());
    // Example:
    //   - name: Name must not be empty
    //   - email: Invalid email format
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
    // Only reached when SDK's automatic retry is exhausted
  } else if (error instanceof AuthenticationError) {
    console.log("Invalid API key. Please check your configuration.");
    // Prompt user to review their configuration
  } else if (error instanceof NetworkError) {
    console.log("Network issue. Please check your connection.");
  } else if (error instanceof ExampleError) {
    // Other API errors
    console.log(`API error [${error.code}]: ${error.message}`);
    console.log(`Request ID: ${error.requestId}`);
  } else {
    // Unexpected error
    throw error;
  }
}

// Pattern 2: Error code-based branching
try {
  await client.users.get("nonexistent");
} catch (error) {
  if (error instanceof ExampleError) {
    switch (error.code) {
      case "NOT_FOUND":
        console.log("User not found");
        break;
      case "RATE_LIMIT_EXCEEDED":
        console.log("Please slow down");
        break;
      default:
        console.log(`Unexpected error: ${error.code}`);
    }
  }
}

// Pattern 3: Result type pattern (no thrown errors)
type Result<T, E = ExampleError> =
  | { success: true; data: T }
  | { success: false; error: E };

async function safeGetUser(
  client: ExampleClient,
  id: string
): Promise<Result<User>> {
  try {
    const data = await client.users.get(id);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ExampleError) {
      return { success: false, error };
    }
    throw error; // Re-throw unexpected errors
  }
}

// Usage example
const result = await safeGetUser(client, "123");
if (result.success) {
  console.log(result.data.name);
} else {
  console.log(result.error.message);
}
```

---

## 6. Authentication Patterns

### 6.1 Comparison of Authentication Methods

| Authentication Method | Security | Implementation Difficulty | Use Case |
|----------------------|----------|--------------------------|----------|
| API Key | Medium | Low | Server-to-server, personal use |
| Bearer Token | High | Medium | Mobile apps, SPA |
| OAuth 2.0 PKCE | High | High | Public clients |
| mTLS | Very High | High | Finance, healthcare |
| HMAC Signature | High | Medium | Webhooks, S2S |

### 6.2 Implementing the Authentication Manager

```typescript
// Authentication strategy interface
interface AuthStrategy {
  /** Attach authentication credentials to a request */
  authenticate(headers: Record<string, string>): Promise<Record<string, string>>;
  /** Check if the token is expired */
  isExpired(): boolean;
  /** Refresh the token (if needed) */
  refresh?(): Promise<void>;
}

// API Key authentication
class ApiKeyAuth implements AuthStrategy {
  constructor(
    private apiKey: string,
    private headerName: string = "Authorization",
    private prefix: string = "Bearer"
  ) {}

  async authenticate(
    headers: Record<string, string>
  ): Promise<Record<string, string>> {
    return {
      ...headers,
      [this.headerName]: `${this.prefix} ${this.apiKey}`,
    };
  }

  isExpired(): boolean {
    return false; // API Keys do not expire
  }
}

// OAuth 2.0 authentication with automatic token refresh
class OAuth2Auth implements AuthStrategy {
  private accessToken: string | null = null;
  private expiresAt: number = 0;
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private refreshToken: string,
    private tokenEndpoint: string = "https://auth.example.com/oauth/token"
  ) {}

  async authenticate(
    headers: Record<string, string>
  ): Promise<Record<string, string>> {
    if (this.isExpired()) {
      await this.refresh();
    }
    return {
      ...headers,
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  isExpired(): boolean {
    // Refresh 60 seconds before expiry (buffer)
    return !this.accessToken || Date.now() >= this.expiresAt - 60000;
  }

  async refresh(): Promise<void> {
    // Prevent concurrent refreshes (deduplication)
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<void> {
    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new AuthenticationError(
        `Token refresh failed: ${error.error_description ?? response.statusText}`
      );
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;

    // Handle updated refresh token
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
  }
}

// HMAC signature authentication (for Webhook verification)
class HmacAuth implements AuthStrategy {
  constructor(
    private secretKey: string,
    private algorithm: string = "sha256"
  ) {}

  async authenticate(
    headers: Record<string, string>
  ): Promise<Record<string, string>> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}.${headers["x-request-body"] ?? ""}`;

    const signature = await this.computeHmac(payload);

    return {
      ...headers,
      "X-Signature": signature,
      "X-Timestamp": timestamp,
    };
  }

  isExpired(): boolean {
    return false;
  }

  private async computeHmac(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.secretKey),
      { name: "HMAC", hash: `SHA-256` },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
```

### 6.3 Client Initialization Patterns

```typescript
// Flexible initialization using the Factory pattern

// Pattern 1: API Key (simplest)
const client = ExampleClient.withApiKey("sk_live_abc123");

// Pattern 2: OAuth 2.0 Bearer Token
const client = ExampleClient.withAccessToken("eyJhbG...");

// Pattern 3: OAuth 2.0 with auto-refresh
const client = ExampleClient.withOAuth({
  clientId: "client_123",
  clientSecret: "secret_456",
  refreshToken: "rt_789",
});

// Pattern 4: Auto-detect from environment variables
const client = ExampleClient.fromEnvironment();
// Automatically detects EXAMPLE_API_KEY, EXAMPLE_CLIENT_ID, etc.

// Factory method implementation
class ExampleClient {
  private constructor(private config: ResolvedClientConfig) {
    // ...initialization logic
  }

  static withApiKey(apiKey: string, options?: Partial<ClientConfig>): ExampleClient {
    return new ExampleClient({
      ...DEFAULT_CONFIG,
      ...options,
      auth: new ApiKeyAuth(apiKey),
    });
  }

  static withAccessToken(token: string, options?: Partial<ClientConfig>): ExampleClient {
    return new ExampleClient({
      ...DEFAULT_CONFIG,
      ...options,
      auth: new ApiKeyAuth(token, "Authorization", "Bearer"),
    });
  }

  static withOAuth(
    oauthConfig: OAuthConfig,
    options?: Partial<ClientConfig>
  ): ExampleClient {
    return new ExampleClient({
      ...DEFAULT_CONFIG,
      ...options,
      auth: new OAuth2Auth(
        oauthConfig.clientId,
        oauthConfig.clientSecret,
        oauthConfig.refreshToken,
        oauthConfig.tokenEndpoint
      ),
    });
  }

  static fromEnvironment(options?: Partial<ClientConfig>): ExampleClient {
    const apiKey = process.env.EXAMPLE_API_KEY;
    if (apiKey) {
      return ExampleClient.withApiKey(apiKey, options);
    }

    const clientId = process.env.EXAMPLE_CLIENT_ID;
    const clientSecret = process.env.EXAMPLE_CLIENT_SECRET;
    const refreshToken = process.env.EXAMPLE_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
      return ExampleClient.withOAuth(
        { clientId, clientSecret, refreshToken },
        options
      );
    }

    throw new ConfigurationError(
      "No authentication credentials found. " +
      "Set EXAMPLE_API_KEY or EXAMPLE_CLIENT_ID/EXAMPLE_CLIENT_SECRET/EXAMPLE_REFRESH_TOKEN " +
      "environment variables."
    );
  }
}
```

---

## 7. Pagination

### 7.1 Pagination Strategies

Abstraction patterns on the SDK side for various API pagination approaches.

| Method | Mechanism | Advantages | Disadvantages |
|--------|-----------|-----------|---------------|
| Cursor-based | Specify next page with `cursor` parameter | Strong for real-time data | Cannot jump to arbitrary pages |
| Offset-based | Position using `offset` + `limit` | Can jump to any page | Shifts when data changes |
| Keyset-based | Retrieve from after the last ID with `after_id` | High performance | Sort order is restricted |

### 7.2 Automatic Pagination Iterator

```typescript
// Pagination abstraction

// Type definitions
interface PaginatedResponse<T> {
  data: T[];
  hasNextPage: boolean;
  nextCursor: string | null;
  totalCount?: number;
}

interface PaginationParams {
  limit?: number;
  cursor?: string;
}

// Auto-iterator implementation
class AutoPaginator<T> implements AsyncIterable<T> {
  constructor(
    private fetchPage: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
    private params: Omit<PaginationParams, "cursor"> = {}
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let cursor: string | undefined;
    do {
      const response = await this.fetchPage({
        ...this.params,
        cursor,
      });
      for (const item of response.data) {
        yield item;
      }
      cursor = response.nextCursor ?? undefined;
    } while (cursor);
  }

  /** Retrieve all data as an array */
  async toArray(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }

  /** Retrieve the first N items */
  async take(n: number): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
      if (items.length >= n) break;
    }
    return items;
  }

  /** Retrieve the first element matching a condition */
  async find(predicate: (item: T) => boolean): Promise<T | undefined> {
    for await (const item of this) {
      if (predicate(item)) return item;
    }
    return undefined;
  }

  /** Execute a callback for every element */
  async forEach(callback: (item: T, index: number) => void | Promise<void>): Promise<void> {
    let index = 0;
    for await (const item of this) {
      await callback(item, index++);
    }
  }

  /** Transform all elements and return as an array */
  async map<U>(fn: (item: T) => U): Promise<U[]> {
    const results: U[] = [];
    for await (const item of this) {
      results.push(fn(item));
    }
    return results;
  }

  /** Filter to matching elements and return as an array */
  async filter(predicate: (item: T) => boolean): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this) {
      if (predicate(item)) results.push(item);
    }
    return results;
  }
}

// Usage in resource class
class UsersResource extends BaseResource {
  async get(id: string): Promise<User> {
    return this.request<User>("GET", `/users/${id}`);
  }

  async list(params?: ListUsersParams): Promise<PaginatedResponse<User>> {
    return this.request<PaginatedResponse<User>>("GET", "/users", { params });
  }

  async create(data: CreateUserParams): Promise<User> {
    return this.request<User>("POST", "/users", { body: data });
  }

  async update(id: string, data: Partial<CreateUserParams>): Promise<User> {
    return this.request<User>("PATCH", `/users/${id}`, { body: data });
  }

  async delete(id: string): Promise<void> {
    return this.request<void>("DELETE", `/users/${id}`);
  }

  /** Returns an auto-pagination iterator */
  listAll(params?: Omit<ListUsersParams, "cursor">): AutoPaginator<User> {
    return new AutoPaginator(
      (paginationParams) => this.list({ ...params, ...paginationParams }),
      params
    );
  }
}

// Usage examples
// Iterate over all users
for await (const user of client.users.listAll({ role: "admin" })) {
  console.log(user.name);
}

// Retrieve the first 100 items as an array
const first100 = await client.users.listAll().take(100);

// Search for a user matching a condition
const targetUser = await client.users
  .listAll({ role: "admin" })
  .find(user => user.email === "admin@example.com");
```

---

## 8. Versioning Strategy

### 8.1 Semantic Versioning

Apply Semantic Versioning (SemVer) strictly to SDK versioning.

```
MAJOR.MINOR.PATCH
  |     |     |
  |     |     +-- Bug fix (backward compatible)
  |     +-------- Feature addition (backward compatible)
  +-------------- Breaking change (not backward compatible)

Examples:
  1.0.0 → 1.0.1  Patch: bug fix
  1.0.1 → 1.1.0  Minor: new method added
  1.1.0 → 2.0.0  Major: method signature change
```

### 8.2 Defining Breaking Changes

It is important to clearly define what constitutes a "breaking change."

| Change Type | Breaking? | Reason |
|-------------|----------|--------|
| Method deletion | Yes | Existing code will have compile errors |
| Adding required parameter | Yes | Existing calls will fail |
| Return type change | Yes | Type checking will break |
| Adding optional parameter | No | Existing code is not affected |
| Adding new method | No | Existing code is not affected |
| Changing error message | No (*) | (*) Only if branching on the message string |
| Adding new error subclass | No | Caught by existing catch blocks |
| Changing default value | Depends | May change behavior |

### 8.3 Relationship Between API Version and SDK Version

```typescript
// SDK version and API version are managed independently

// SDK v2.3.1 supports both API v1 and API v2
const clientV1 = new ExampleClient({
  apiKey: "sk_live_abc",
  apiVersion: "2024-01-01", // Date-based API version (Stripe style)
});

const clientV2 = new ExampleClient({
  apiKey: "sk_live_abc",
  apiVersion: "2024-06-15",
});

// Automatic API version header attachment
class ApiVersionMiddleware implements Middleware {
  constructor(private apiVersion: string) {}

  async handle(
    request: HttpRequestOptions,
    next: (req: HttpRequestOptions) => Promise<HttpResponse<unknown>>
  ): Promise<HttpResponse<unknown>> {
    request.headers = {
      ...request.headers,
      "Example-Version": this.apiVersion,
    };
    return next(request);
  }
}
```

### 8.4 Managing Deprecation

```typescript
// Deprecation warning for deprecated methods
class UsersResource extends BaseResource {
  /**
   * @deprecated Scheduled for removal in v2.0.0. Use `list()` instead.
   */
  async getAll(params?: ListUsersParams): Promise<User[]> {
    if (typeof process !== "undefined" && process.emitWarning) {
      process.emitWarning(
        "users.getAll() is deprecated and will be removed in v2.0.0. " +
        "Use users.list() instead.",
        "DeprecationWarning"
      );
    }
    const response = await this.list(params);
    return response.data;
  }

  async list(params?: ListUsersParams): Promise<PaginatedResponse<User>> {
    return this.request<PaginatedResponse<User>>("GET", "/users", { params });
  }
}

// TypeScript @deprecated JSDoc tag
// IDE displays a strikethrough on the method, visually notifying users
```

---

## 9. Testability

### 9.1 Overview of Test Strategy

SDK tests are structured in 3 layers.

| Test Layer | Target | Tools | Frequency |
|------------|--------|-------|-----------|
| Unit tests | Individual methods, validation | Jest/Vitest | Every CI run |
| Integration tests | HTTP client, authentication flows | MSW | Every CI run |
| E2E tests | Real API connection | Production sandbox | Before release |

### 9.2 Interface-based Mocks

```typescript
// Define interfaces for each resource
interface IUsersResource {
  get(id: string): Promise<User>;
  list(params?: ListUsersParams): Promise<PaginatedResponse<User>>;
  create(data: CreateUserParams): Promise<User>;
  update(id: string, data: Partial<CreateUserParams>): Promise<User>;
  delete(id: string): Promise<void>;
}

interface IExampleClient {
  readonly users: IUsersResource;
  readonly orders: IOrdersResource;
}

// Mock client for testing
class MockExampleClient implements IExampleClient {
  readonly users: MockUsersResource;
  readonly orders: MockOrdersResource;

  constructor() {
    this.users = new MockUsersResource();
    this.orders = new MockOrdersResource();
  }
}

class MockUsersResource implements IUsersResource {
  private store: Map<string, User> = new Map();
  private callLog: Array<{ method: string; args: any[] }> = [];

  // Test data setup
  seed(users: User[]): void {
    for (const user of users) {
      this.store.set(user.id, user);
    }
  }

  // Check call history
  getCalls(method: string): any[][] {
    return this.callLog
      .filter(c => c.method === method)
      .map(c => c.args);
  }

  async get(id: string): Promise<User> {
    this.callLog.push({ method: "get", args: [id] });
    const user = this.store.get(id);
    if (!user) {
      throw new NotFoundError(`User ${id} not found`);
    }
    return user;
  }

  async list(params?: ListUsersParams): Promise<PaginatedResponse<User>> {
    this.callLog.push({ method: "list", args: [params] });
    let users = Array.from(this.store.values());
    if (params?.role) {
      users = users.filter(u => u.role === params.role);
    }
    return {
      data: users.slice(0, params?.limit ?? 20),
      hasNextPage: false,
      nextCursor: null,
    };
  }

  async create(data: CreateUserParams): Promise<User> {
    this.callLog.push({ method: "create", args: [data] });
    const user: User = {
      id: `user_${Date.now()}`,
      name: data.name,
      email: data.email,
      role: data.role ?? "user",
      createdAt: new Date().toISOString(),
    };
    this.store.set(user.id, user);
    return user;
  }

  async update(id: string, data: Partial<CreateUserParams>): Promise<User> {
    this.callLog.push({ method: "update", args: [id, data] });
    const existing = this.store.get(id);
    if (!existing) throw new NotFoundError(`User ${id} not found`);
    const updated = { ...existing, ...data };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.callLog.push({ method: "delete", args: [id] });
    if (!this.store.has(id)) throw new NotFoundError(`User ${id} not found`);
    this.store.delete(id);
  }
}

// Example test code
describe("UserService", () => {
  let client: MockExampleClient;

  beforeEach(() => {
    client = new MockExampleClient();
    client.users.seed([
      {
        id: "user_1",
        name: "Alice",
        email: "alice@example.com",
        role: "admin",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "user_2",
        name: "Bob",
        email: "bob@example.com",
        role: "user",
        createdAt: "2024-01-02T00:00:00Z",
      },
    ]);
  });

  test("get user by ID", async () => {
    const user = await client.users.get("user_1");
    expect(user.name).toBe("Alice");
  });

  test("list admin users", async () => {
    const result = await client.users.list({ role: "admin" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Alice");
  });

  test("throw NotFoundError for unknown user", async () => {
    await expect(client.users.get("unknown"))
      .rejects.toThrow(NotFoundError);
  });
});
```

### 9.3 HTTP-level Testing with MSW (Mock Service Worker)

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const handlers = [
  http.get("https://api.example.com/v1/users/:id", ({ params }) => {
    if (params.id === "nonexistent") {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "User not found" },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      id: params.id,
      name: "Test User",
      email: "test@example.com",
      role: "user",
      createdAt: "2024-01-01T00:00:00Z",
    });
  }),

  http.post("https://api.example.com/v1/users", async ({ request }) => {
    const body = await request.json() as any;
    if (!body.name || !body.email) {
      return HttpResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          errors: [
            ...(!body.name ? [{ field: "name", message: "Name is required" }] : []),
            ...(!body.email ? [{ field: "email", message: "Email is required" }] : []),
          ],
        },
        { status: 422 }
      );
    }
    return HttpResponse.json(
      { id: "new_user", ...body, role: body.role ?? "user", createdAt: new Date().toISOString() },
      { status: 201 }
    );
  }),

  // Rate limit simulation
  http.get("https://api.example.com/v1/rate-limited", () => {
    return HttpResponse.json(
      { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": "5" },
      }
    );
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ExampleClient with MSW", () => {
  const client = new ExampleClient({ apiKey: "test_key" });

  test("get user returns user data", async () => {
    const user = await client.users.get("123");
    expect(user.name).toBe("Test User");
    expect(user.email).toBe("test@example.com");
  });

  test("get nonexistent user throws NotFoundError", async () => {
    await expect(client.users.get("nonexistent"))
      .rejects.toThrow(NotFoundError);
  });

  test("create user with missing fields throws ValidationError", async () => {
    try {
      await client.users.create({ name: "", email: "" } as any);
      fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.fieldErrors).toHaveLength(2);
      }
    }
  });

  test("handles server errors with retry", async () => {
    let callCount = 0;
    server.use(
      http.get("https://api.example.com/v1/users/retry-test", () => {
        callCount++;
        if (callCount < 3) {
          return HttpResponse.json(
            { message: "Internal error" },
            { status: 500 }
          );
        }
        return HttpResponse.json({
          id: "retry-test",
          name: "Success",
          email: "ok@example.com",
          role: "user",
          createdAt: "2024-01-01T00:00:00Z",
        });
      })
    );

    const user = await client.users.get("retry-test");
    expect(user.name).toBe("Success");
    expect(callCount).toBe(3);
  });
});
```

---

## 10. Anti-patterns

Common anti-patterns in SDK design and how to improve them.

### 10.1 Anti-pattern: God Client

A pattern of packing all methods into a single massive class. As the number of methods grows, IDE auto-completion becomes unusable and testability decreases.

```typescript
// NG: God Client pattern
class ApiClient {
  async getUser(id: string): Promise<User> { /* ... */ }
  async listUsers(): Promise<User[]> { /* ... */ }
  async createUser(data: any): Promise<User> { /* ... */ }
  async updateUser(id: string, data: any): Promise<User> { /* ... */ }
  async deleteUser(id: string): Promise<void> { /* ... */ }
  async getOrder(id: string): Promise<Order> { /* ... */ }
  async listOrders(): Promise<Order[]> { /* ... */ }
  async createOrder(data: any): Promise<Order> { /* ... */ }
  async getProduct(id: string): Promise<Product> { /* ... */ }
  async listProducts(): Promise<Product[]> { /* ... */ }
  // ... 100+ methods listed flat
  // IDE completion list becomes enormous, making desired methods hard to find
}

// OK: Split into Resource-based structure
class ApiClient {
  readonly users: UsersResource;
  readonly orders: OrdersResource;
  readonly products: ProductsResource;
  // Organized by namespace like client.users.get("123")
  // IDE completion narrows candidates once you type client.users.
}
```

**Why this is a problem:**
- Too many methods make IDE completion impractical
- Difficult to set up different test configurations between resources
- A single file balloons in size, making code review difficult
- Adding new resources risks impacting existing code

### 10.2 Anti-pattern: Exposing Raw HTTP Responses

A pattern of returning SDK internal implementation details (HTTP responses, headers, status codes) directly to the user.

```typescript
// NG: Returning raw HTTP response
class UserService {
  async getUser(id: string): Promise<Response> {
    return fetch(`${this.baseUrl}/users/${id}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }
}

// User must write the following boilerplate every time
const response = await service.getUser("123");
if (!response.ok) {
  if (response.status === 404) {
    // ...
  } else if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    // ...
  }
  // Error handling is scattered across each call site
}
const user = await response.json();
// No type information: user is of type any

// OK: Return a type-safe response
class UsersResource {
  async get(id: string): Promise<User> {
    // HTTP details are handled internally by the SDK
    // Errors are thrown as typed exceptions
    return this.request<User>("GET", `/users/${id}`);
  }
}

// User code is simple
const user = await client.users.get("123");
// user is of type User, IDE completion works
console.log(user.name); // OK
console.log(user.unknown); // TypeScript gives a compile error
```

**Why this is a problem:**
- Users become dependent on HTTP implementation details
- Type safety is lost
- Error handling boilerplate is scattered across each call site
- Internal SDK changes (e.g., switching from fetch to axios) affect user code

### 10.3 Anti-pattern: Implicit Global State

A pattern of sharing state through singletons or module-scope variables. Test isolation is lost and multi-tenant support becomes difficult.

```typescript
// NG: Global state
let globalApiKey: string;
let globalBaseUrl: string = "https://api.example.com/v1";

export function configure(apiKey: string, baseUrl?: string) {
  globalApiKey = apiKey;
  if (baseUrl) globalBaseUrl = baseUrl;
}

export async function getUser(id: string): Promise<User> {
  // Depends on global variables
  return fetch(`${globalBaseUrl}/users/${id}`, {
    headers: { Authorization: `Bearer ${globalApiKey}` },
  }).then(r => r.json());
}

// If test A calls configure("key_a") and test B calls configure("key_b"),
// results change depending on execution order (test isolation is broken)

// OK: Instance-based
const clientA = new ExampleClient({ apiKey: "key_a" });
const clientB = new ExampleClient({ apiKey: "key_b" });
// Each has independent state
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case: Concurrent Refresh Race Condition

When an OAuth 2.0 token expires and multiple requests are in-flight simultaneously, all requests attempt to refresh the token. If this race condition is not handled properly, refresh token invalidation or rate limit violations can occur.

```typescript
// Problematic code: each request independently refreshes
class NaiveOAuth2Auth {
  async getToken(): Promise<string> {
    if (this.isExpired()) {
      // Problem: if 10 requests concurrently detect expiration,
      // 10 refresh API calls will be made.
      // If the refresh token rotates,
      // all but the first call will fail using the old token.
      await this.refreshToken();
    }
    return this.accessToken;
  }
}

// Solution: refresh deduplication
class SafeOAuth2Auth {
  private refreshPromise: Promise<void> | null = null;
  private refreshLock = false;

  async getToken(): Promise<string> {
    if (this.isExpired()) {
      // If already refreshing, wait for that result
      if (this.refreshPromise) {
        await this.refreshPromise;
      } else {
        // Only the first request performs the refresh
        this.refreshPromise = this.doRefresh()
          .finally(() => {
            this.refreshPromise = null;
          });
        await this.refreshPromise;
      }
    }
    return this.accessToken!;
  }

  private async doRefresh(): Promise<void> {
    try {
      const response = await fetch(this.tokenEndpoint, {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new AuthenticationError("Token refresh failed");
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.expiresAt = Date.now() + data.expires_in * 1000;

      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
    } catch (error) {
      // Clear token on refresh failure
      this.accessToken = null;
      this.expiresAt = 0;
      throw error;
    }
  }
}
```

**Key points for handling this:**
- Promise deduplication consolidates concurrent refreshes into a single call
- Ensure cleanup is executed reliably on refresh failure
- Handle refresh token rotation (receiving a new refresh token)

### 11.2 Edge Case: Client Disposal During Request

If a client is disposed while a long-running request is in progress (e.g., React component unmount, server shutdown), resource leaks or memory leaks may occur.

```typescript
// Safe cancellation using AbortController

class ExampleClient {
  private abortController: AbortController;

  constructor(config: ClientConfig) {
    this.abortController = new AbortController();
    // ...
  }

  /** Destroy the client: cancel all in-progress requests */
  destroy(): void {
    this.abortController.abort();
  }

  /** Support for cancelling individual requests */
  async request<T>(
    method: string,
    path: string,
    options?: RequestOptions & { signal?: AbortSignal }
  ): Promise<T> {
    // Combine the client-level signal with the individual signal
    const signal = options?.signal
      ? anySignal([this.abortController.signal, options.signal])
      : this.abortController.signal;

    try {
      const response = await fetch(url, {
        method,
        headers: this.buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal,
      });
      // ...
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new CancellationError(
          "Request was cancelled. " +
          (this.abortController.signal.aborted
            ? "Client has been destroyed."
            : "Request was explicitly cancelled.")
        );
      }
      throw error;
    }
  }
}

// Utility for composing multiple AbortSignals
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

// React usage example
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    client.users.get(userId, { signal: abortController.signal })
      .then(setUser)
      .catch(error => {
        if (!(error instanceof CancellationError)) {
          console.error("Failed to fetch user:", error);
        }
      });

    return () => {
      abortController.abort(); // Cancel on component unmount
    };
  }, [userId]);

  // ...
}
```

### 11.3 Edge Case: Large Responses and Memory Management

For endpoints that return thousands of records at once, or large file downloads, memory consumption can become a problem. Streaming support is required.

```typescript
// Streaming download support
class FilesResource extends BaseResource {
  /** Retrieve a file as a stream */
  async download(fileId: string): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(
      `${this.httpClient.baseUrl}/files/${fileId}/content`,
      {
        headers: this.httpClient.buildHeaders(),
      }
    );

    if (!response.ok) {
      throw await this.httpClient.createError(response);
    }

    if (!response.body) {
      throw new ExampleError({
        status: 0,
        code: "STREAM_ERROR",
        message: "Response body is null",
        retryable: false,
        headers: {},
      });
    }

    return response.body;
  }

  /** Save a file to disk (Node.js) */
  async downloadToFile(fileId: string, destPath: string): Promise<void> {
    const stream = await this.download(fileId);
    const fileStream = fs.createWriteStream(destPath);

    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(value);
      }
    } finally {
      reader.releaseLock();
      fileStream.end();
    }
  }
}
```

---

## 12. Exercises

### Exercise 1: Beginner — Basic SDK Client Implementation

Implement a simple SDK client based on the following specification.

**Specification:**
- API base URL: `https://api.todoapp.com/v1`
- Authentication: API Key (Authorization header)
- Resource: `todos` (with CRUD support)
- Type definitions: `id`, `title`, `completed`, `createdAt`

**Requirements:**
1. Create a `TodoClient` class that accepts an API Key in the constructor
2. Implement `get`, `list`, `create`, `update`, `delete` methods on the `todos` resource
3. Define TypeScript types appropriately

```typescript
// Solution skeleton

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface CreateTodoParams {
  title: string;
  completed?: boolean;
}

interface ListTodosParams {
  completed?: boolean;
  limit?: number;
  cursor?: string;
}

class TodoClient {
  readonly todos: TodosResource;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    const resolvedConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? "https://api.todoapp.com/v1",
      timeout: 30000,
    };
    // Create HttpClient and pass it to TodosResource
    // ... complete the implementation
  }
}

class TodosResource {
  async get(id: string): Promise<Todo> {
    // Call GET /todos/:id
  }

  async list(params?: ListTodosParams): Promise<PaginatedResponse<Todo>> {
    // Call GET /todos
  }

  async create(data: CreateTodoParams): Promise<Todo> {
    // Call POST /todos
  }

  async update(id: string, data: Partial<CreateTodoParams>): Promise<Todo> {
    // Call PATCH /todos/:id
  }

  async delete(id: string): Promise<void> {
    // Call DELETE /todos/:id
  }
}
```

**Evaluation Criteria:**
- Is type safety ensured?
- Is configuration validation implemented?
- Are method signatures intuitive?

### Exercise 2: Intermediate — Implementing Retry and Error Handling

Add the following features to the client created in Exercise 1.

**Requirements:**
1. Retry with exponential backoff (maximum 3 retries)
2. Full jitter implementation
3. Retry only on 429 (Rate Limit) and 5xx (Server Error)
4. Custom error class hierarchy:
   - `TodoApiError` (base)
   - `ValidationError`
   - `NotFoundError`
   - `RateLimitError`
5. Support for `Retry-After` header

```typescript
// Hint: retry decision function
function shouldRetry(error: TodoApiError, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  if (error.status === 429) return true;
  if (error.status >= 500) return true;
  return false;
}

// Hint: delay calculation
function getRetryDelay(attempt: number, error: TodoApiError): number {
  // For RateLimitError, prioritize Retry-After
  // Otherwise, use exponential backoff with full jitter
}
```

**Evaluation Criteria:**
- Only retryable errors are retried
- Jitter is correctly implemented
- `Retry-After` header is considered
- Retries on non-idempotent requests (POST) are handled safely

### Exercise 3: Advanced — Designing a Middleware Pipeline

Design and implement a middleware system that meets the following requirements.

**Requirements:**
1. Define the middleware interface
2. Implement the following middleware:
   - Authentication middleware (supports switching between API Key / OAuth)
   - Retry middleware (improved version of Exercise 2)
   - Logging middleware (records request/response)
   - Rate limit middleware (client-side rate limiting)
   - Cache middleware (TTL-based caching for GET requests)
3. Make the execution order of middleware controllable
4. Allow dynamic addition and removal of middleware

```typescript
// Hint: cache middleware implementation skeleton
class CacheMiddleware {
  private cache = new Map<string, { data: unknown; expiresAt: number }>();

  constructor(private ttlMs: number = 60000) {}

  async handle(
    request: HttpRequestOptions,
    next: NextFunction
  ): Promise<HttpResponse<unknown>> {
    // Only cache GET requests
    if (request.method !== "GET") {
      return next(request);
    }

    const cacheKey = this.buildCacheKey(request);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      // Cache hit
      return { status: 200, data: cached.data, headers: {} };
    }

    // Cache miss: execute the actual request
    const response = await next(request);

    // Cache successful responses
    if (response.status >= 200 && response.status < 300) {
      this.cache.set(cacheKey, {
        data: response.data,
        expiresAt: Date.now() + this.ttlMs,
      });
    }

    return response;
  }

  private buildCacheKey(request: HttpRequestOptions): string {
    return `${request.method}:${request.url}`;
  }

  /** Clear all cache */
  clear(): void {
    this.cache.clear();
  }

  /** Invalidate cache for a specific key */
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// Hint: client-side rate limit middleware
class ClientRateLimitMiddleware {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number = 100,
    private refillRate: number = 10, // Tokens refilled per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async handle(
    request: HttpRequestOptions,
    next: NextFunction
  ): Promise<HttpResponse<unknown>> {
    await this.waitForToken();
    return next(request);
  }

  private async waitForToken(): Promise<void> {
    this.refill();
    while (this.tokens < 1) {
      const waitMs = (1 / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this.refill();
    }
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }
}
```

**Evaluation Criteria:**
- Is the middleware interface consistent?
- Is the pipeline execution order correct?
- Are dependencies between middleware properly managed?
- Is testability ensured?

---

## 13. SDK Development via Code Generation

### 13.1 Code Generation from OpenAPI

For large-scale APIs, an approach of auto-generating the SDK from an OpenAPI (Swagger) spec is adopted. Compared to handwritten SDKs, it is easier to keep up with API changes and also simplifies multi-language support.

```
+------------------------------------------------------------------+
|              OpenAPI-based SDK Generation Pipeline               |
+------------------------------------------------------------------+
|                                                                    |
|  OpenAPI Spec       Code Generator        Generated SDK            |
|  (YAML/JSON)   -->  (openapi-generator,  -->  TypeScript           |
|                      orval, etc.)              Python               |
|                                                Go                  |
|                                                Java                |
|                                                Ruby                |
|                                                                    |
|  +---------------+   +------------------+   +-----------------+    |
|  | paths:        |   | Template         |   | client.ts       |    |
|  |   /users:     |-->| Engine           |-->| types.ts        |    |
|  |     get: ...  |   | (Mustache/EJS)   |   | resources/      |    |
|  |     post: ... |   +------------------+   |   users.ts      |    |
|  | schemas:      |                          |   orders.ts     |    |
|  |   User: ...   |                          | errors.ts       |    |
|  +---------------+                          +-----------------+    |
|                                                                    |
+------------------------------------------------------------------+
```

### 13.2 Pros and Cons of Code Generation

| Aspect | Handwritten SDK | Auto-generated SDK |
|--------|----------------|-------------------|
| API compatibility | Requires manual updates | Auto-regenerated on spec update |
| DX quality | High (customizable) | Tool-dependent (room for improvement) |
| Multi-language support | Handwritten per language | Supported by adding templates |
| Maintenance cost | High | Low |
| Customizability | Free | Constrained by templates |
| Edge case handling | Flexible | Limited |

### 13.3 Hybrid Approach (Recommended)

The recommended approach is to ensure quality of core functionality (authentication, retry, error handling) with handwritten code, while auto-generating individual resource CRUD methods from the OpenAPI spec.

```typescript
// Handwritten core parts
// src/core/client.ts - authentication, HTTP foundation, retry
// src/core/errors.ts - error hierarchy
// src/core/middleware.ts - middleware pipeline

// Auto-generated parts
// src/generated/resources/users.ts - UsersResource
// src/generated/resources/orders.ts - OrdersResource
// src/generated/types/user.ts - User type definitions
// src/generated/types/order.ts - Order type definitions

// Integrate auto-generated parts with handwritten core
import { BaseResource } from "../core/base-resource";
import { User, CreateUserParams, ListUsersParams } from "../generated/types";

// Generated resource class inherits from BaseResource
class UsersResource extends BaseResource {
  // Auto-generated methods
  async get(id: string): Promise<User> {
    return this.request<User>("GET", `/users/${id}`);
  }
  // ...
}
```

---

## 14. SDK Distribution and Packaging

### 14.1 Bundle Strategy

```typescript
// Example package.json configuration
{
  "name": "example-sdk",
  "version": "1.2.3",
  "main": "./dist/cjs/index.js",       // CommonJS (Node.js)
  "module": "./dist/esm/index.js",      // ES Modules (bundlers)
  "types": "./dist/types/index.d.ts",   // TypeScript type definitions
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./users": {
      "import": "./dist/esm/resources/users.js",
      "require": "./dist/cjs/resources/users.js",
      "types": "./dist/types/resources/users.d.ts"
    }
  },
  "sideEffects": false,                 // Enable Tree shaking
  "files": ["dist", "LICENSE", "README.md"],
  "engines": {
    "node": ">=18"
  },
  "peerDependencies": {},                // Minimize external dependencies
}
```

### 14.2 Tree Shaking Support

Support Tree Shaking so that unused resources and methods are not included in the bundle.

```typescript
// Use named exports to allow importing each resource individually

// index.ts (entry point)
export { ExampleClient } from "./client";
export { UsersResource } from "./resources/users";
export { OrdersResource } from "./resources/orders";
export type { User, CreateUserParams, ListUsersParams } from "./types/user";
export type { Order, CreateOrderParams } from "./types/order";
export { ExampleError, ValidationError, NotFoundError } from "./errors";

// If the user only uses users
import { ExampleClient } from "example-sdk";
// Bundler excludes OrdersResource via Tree Shaking
```

---

## 15. Summary

| Concept | Key Points |
|---------|-----------|
| Design Principles | Least surprise, progressive disclosure, fail fast, idiomatic, backward compatible |
| Client Patterns | Resource-based is the most intuitive and widely adopted |
| HTTP Foundation | Transport abstraction + middleware pipeline |
| Retry | Exponential backoff + full jitter + idempotency keys |
| Error Design | Hierarchical error classes + actionable messages + requestId |
| Authentication | Strategy pattern for multiple methods, automatic token refresh |
| Pagination | AutoIterator for auto-paging, utilities like take/find/map |
| Versioning | Strict SemVer, date-based API versions, deprecation warnings |
| Testing | Interface mocks + HTTP-level testing with MSW |
| Distribution | ESM/CJS dual format, Tree Shaking support |

### Key Points

1. **SDK Design Best Practices**: Prioritize developer experience (DX) above all, and thoroughly apply the "Principle of Least Surprise" and "Progressive Disclosure." Achieve intuitive API design with the Resource-based pattern, and prevent user mistakes at design time through type safety and IntelliSense support. Follow idiomatic patterns drawing from industry-standard SDKs like Stripe and Twilio.

2. **Error Handling Strategy**: Hierarchical error class design allows users to catch and handle errors at the appropriate level. Automatically recover from transient failures using exponential backoff with full jitter, and prevent duplicate execution with idempotency keys. Error messages must always include actionable information (what to do next) and a requestId to maximize debugging efficiency.

3. **Versioning and Backward Compatibility**: Apply SemVer strictly, clearly distinguishing MAJOR (breaking changes), MINOR (feature additions), and PATCH (bug fixes). Minimize breaking changes and encourage gradual migration through deprecation warnings. Manage API versions in date-based format (2024-01-15) and maintain a version translation layer inside the SDK so users can use the latest API without being aware of it.

---

## FAQ

### Q1: What is the difference between an SDK and an API wrapper library?

An API wrapper thinly wraps HTTP communication, essentially only performing request/response transformation. An SDK, on the other hand, is a comprehensive development kit that integrates cross-cutting concerns such as authentication management, retry, pagination, error handling, type safety, and logging. An SDK includes an API wrapper but is not limited to it. The "SDKs" provided by commercial API providers (Stripe, Twilio, AWS, etc.) typically feature functionality well beyond a simple wrapper.

### Q2: Should I choose a handwritten SDK or a code-generated SDK?

If the number of API endpoints is small (20 or fewer) and you have strong opinions on DX, handwriting is appropriate. If the number of endpoints is large (50 or more) and multi-language support is needed, code generation is more efficient. Ideally, the recommended approach is a hybrid: handwrite the core parts (authentication, retry, error handling) and auto-generate the resource layer from the OpenAPI spec. Stripe uses this hybrid approach, achieving both high DX quality and rapid response to API changes.

### Q3: How can I reduce the SDK bundle size?

The following measures are effective: (1) Minimize external dependencies (zero dependencies is ideal). (2) Export in ES Modules format to enable Tree Shaking. (3) Set `sideEffects: false` in package.json. (4) Adopt the Function-based pattern (AWS SDK v3 style) so unused commands are not included in the bundle. (5) Make Node.js-specific features (crypto, fs, etc.) optional imports to exclude code unnecessary in browser environments. A concrete target is less than 50KB minified + gzip.

### Q4: What HTTP library should I use inside an SDK?

Since 2024, the global `fetch` is available in both browsers and Node.js (v18+), making it possible to build SDKs without depending on external HTTP libraries. The recommended pattern is to use fetch as the default transport and only support swapping to `undici` or `node:http2` when advanced requirements (HTTP/2 multiplexing, fine-grained keep-alive control, etc.) arise. axios has been historically widely used, but fetch-based approaches are now mainstream for new SDKs.

### Q5: What should I watch out for when handling rate limits?

Rate limit handling on the SDK side has two layers. (1) Handling 429 responses from the server: Implement backoff retry following the `Retry-After` header. (2) Preventive client-side rate limiting: Control request frequency using a token bucket algorithm to avoid getting 429 responses in the first place. The three key points to be careful about are: the Retry-After on a 429 response can be seconds or a date (HTTP-date); distributing rate limits when multiple client instances share the same API key; and handling burst requests (a large number of requests in a short period).

---

## Summary

In this guide you learned:

- The 5 key SDK design principles (least surprise, progressive disclosure, fail fast, idiomatic, backward compatible) and design philosophy that prioritizes developer experience (DX)
- Comparison and selection of client design patterns including Resource-based, Function-based, and Builder patterns
- How to build an HTTP communication foundation using transport abstraction and middleware pipeline
- Retry strategies using exponential backoff, full jitter, and idempotency keys, and error design using hierarchical error classes
- Authentication patterns (Strategy pattern), automatic pagination (AsyncIterator), versioning, and ESM/CJS dual distribution in practice

---

## What to Read Next

- [npm Package Development](01-npm-package-development.md)
- API Client Patterns
- SDK Testing Strategy

---

## References

1. Stripe. "Stripe API Reference - Client Libraries." stripe.com/docs/api, 2024. Widely referenced as an industry standard for SDK design principles. Particularly excellent as an example implementation of Resource-based patterns, type-safe error hierarchies, and automatic pagination.

2. Twilio. "SDK Design Principles and Best Practices." twilio.com/docs/libraries, 2024. Explains idiomatic design principles in multi-language SDK development and quantitative evaluation methods for developer experience (DX).

3. AWS. "AWS SDK Design Guide - Middleware Architecture." docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/, 2024. The design philosophy behind the Function-based pattern and middleware pipeline. Detailed explanation of Tree Shaking support and bundle size optimization techniques.

4. Google Cloud. "API Client Libraries Best Practices." cloud.google.com/apis/design, 2024. Client design utilizing the Builder pattern and architecture for dual gRPC/REST protocol support.

5. Marc Brooker. "Exponential Backoff and Jitter." aws.amazon.com/blogs/architecture, 2015. A blog article analyzing the effect of jitter in retry strategies mathematically. Comparative evaluation of full jitter, equal jitter, and decorrelated jitter.

6. Sentry. "SDK Development Guide." docs.sentry.io/development/sdk-dev/, 2024. Guidelines for cross-platform SDK development. Unified SDK architecture and idiomatic implementation examples in each language.
