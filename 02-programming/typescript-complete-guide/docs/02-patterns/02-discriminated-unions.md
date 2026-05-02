# TypeScript Discriminated Union Patterns

> Achieve robust branching logic with Discriminated Unions, type-safe Action design for Redux, and exhaustiveness checks

## What You Will Learn

1. **Discriminated Union Basics** -- How to safely narrow union type members using a literal-type discriminant field
2. **Exhaustiveness Checks** -- Using the `never` type to guarantee at compile time that all cases are handled in a switch statement
3. **Usage in Redux / useReducer** -- Defining Action types as discriminated unions and writing type-safe Reducers
4. **Advanced Patterns** -- Combining nesting, generics, and type-level programming
5. **Production Design Patterns** -- Applying discriminated unions to state machines, API responses, and domain modeling
6. **Performance and Optimization** -- Runtime characteristics and memory efficiency of discriminated unions


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [TypeScript Builder Pattern](./01-builder-pattern.md)

---

## 1. Discriminated Union Basics

### 1-1. Structure

```
Components of a Discriminated Union:

  Common field (discriminant)
       |
       v
  +----------+     +----------+     +----------+
  | type:     |     | type:     |     | type:     |
  | "circle"  |     | "rect"   |     | "triangle"|
  +----------+     +----------+     +----------+
  | radius    |     | width    |     | base     |
  |           |     | height   |     | height   |
  +----------+     +----------+     +----------+

  Shape = Circle | Rect | Triangle
             \       |       /
              Discriminant: type field
```

```typescript
// Defining a discriminated union
interface Circle {
  readonly type: "circle";
  readonly radius: number;
}

interface Rect {
  readonly type: "rect";
  readonly width: number;
  readonly height: number;
}

interface Triangle {
  readonly type: "triangle";
  readonly base: number;
  readonly height: number;
}

type Shape = Circle | Rect | Triangle;

// Narrowing types via the discriminant
function area(shape: Shape): number {
  switch (shape.type) {
    case "circle":
      // shape is narrowed to Circle
      return Math.PI * shape.radius ** 2;
    case "rect":
      // shape is narrowed to Rect
      return shape.width * shape.height;
    case "triangle":
      // shape is narrowed to Triangle
      return (shape.base * shape.height) / 2;
  }
}
```

### 1-2. Constructor Functions

```typescript
// Safely construct instances with smart constructors
function circle(radius: number): Circle {
  if (radius <= 0) throw new Error("radius must be positive");
  return { type: "circle", radius };
}

function rect(width: number, height: number): Rect {
  return { type: "rect", width, height };
}

function triangle(base: number, height: number): Triangle {
  return { type: "triangle", base, height };
}

// Usage example
const shapes: Shape[] = [
  circle(5),
  rect(10, 20),
  triangle(6, 8),
];

const totalArea = shapes.reduce((sum, s) => sum + area(s), 0);
```

### 1-3. Choosing the Discriminant

The quality of a discriminated union depends heavily on the design of its discriminant.

```typescript
// ─── String literals (most common) ───
type Event =
  | { type: "click"; x: number; y: number }
  | { type: "keypress"; key: string }
  | { type: "scroll"; offset: number };

// ─── const enum (zero runtime cost, but with limitations) ───
const enum ShapeKind {
  Circle = "circle",
  Rect = "rect",
  Triangle = "triangle",
}
// Note: cannot be used in isolatedModules mode

// ─── Nested discriminant ───
type ApiResult =
  | { status: "success"; data: unknown }
  | { status: "error"; error: { code: "network" | "auth" | "validation"; message: string } };

// ─── Multiple discriminants ───
type Message =
  | { channel: "email"; priority: "high"; subject: string; body: string }
  | { channel: "email"; priority: "low"; body: string }
  | { channel: "sms"; body: string }
  | { channel: "push"; title: string; body: string };
// Distinguishable by the combination of channel and priority
```

### 1-4. Narrowing with if-else

Type narrowing works with if-else statements as well as switch statements.

```typescript
function describe(shape: Shape): string {
  // Narrowing also works with if statements
  if (shape.type === "circle") {
    return `Circle with radius ${shape.radius}`;
  }

  if (shape.type === "rect") {
    return `Rectangle ${shape.width}x${shape.height}`;
  }

  // Here, shape is narrowed to Triangle
  return `Triangle with base ${shape.base} and height ${shape.height}`;
}

// Early return pattern
function processShape(shape: Shape): number | null {
  if (shape.type !== "circle") {
    return null; // Skip non-Circle shapes
  }
  // Here, shape is narrowed to Circle
  return Math.PI * shape.radius ** 2;
}
```

### 1-5. Type Narrowing and Destructuring

```typescript
// Pattern combining narrowing with destructuring
function formatShape(shape: Shape): string {
  switch (shape.type) {
    case "circle": {
      const { radius } = shape; // Destructure from Circle type
      return `○ r=${radius.toFixed(2)}`;
    }
    case "rect": {
      const { width, height } = shape; // Destructure from Rect type
      return `□ ${width}×${height}`;
    }
    case "triangle": {
      const { base, height } = shape; // Destructure from Triangle type
      return `△ base=${base}, h=${height}`;
    }
  }
}

// Usage with array methods
const circles = shapes.filter(
  (s): s is Circle => s.type === "circle"
);
// circles has type Circle[]

const areas = shapes.map((s) => {
  switch (s.type) {
    case "circle": return { shape: "circle", area: Math.PI * s.radius ** 2 };
    case "rect": return { shape: "rect", area: s.width * s.height };
    case "triangle": return { shape: "triangle", area: (s.base * s.height) / 2 };
  }
});
```

---

## 2. Exhaustiveness Checks

### 2-1. The Exhaustive Check Pattern

```
Exhaustiveness in switch statements:

  case "circle":  --> handles Circle
  case "rect":    --> handles Rect
  case "triangle" --> handles Triangle
  default:        --> shape has type never
                      (proof that all cases are handled)

  If a new Shape is added and a case is forgotten:
  default:        --> shape has the new type
                      not assignable to never -> compile error!
```

```typescript
// Helper for exhaustiveness checks
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

function area(shape: Shape): number {
  switch (shape.type) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rect":
      return shape.width * shape.height;
    case "triangle":
      return (shape.base * shape.height) / 2;
    default:
      // If all cases are handled, shape has type never
      return assertNever(shape);
  }
}

// When a new Shape is added:
interface Pentagon {
  readonly type: "pentagon";
  readonly side: number;
}
type Shape = Circle | Rect | Triangle | Pentagon;

// If you forget to add case "pentagon" in area():
// Error: Argument of type 'Pentagon' is not assignable to parameter of type 'never'
```

### 2-2. Exhaustiveness Check with satisfies

```typescript
// Exhaustiveness check using an object map
const areaCalculators = {
  circle: (s: Circle) => Math.PI * s.radius ** 2,
  rect: (s: Rect) => s.width * s.height,
  triangle: (s: Triangle) => (s.base * s.height) / 2,
} satisfies Record<Shape["type"], (s: any) => number>;

function area(shape: Shape): number {
  return areaCalculatorsshape.type;
}

// Adding Pentagon causes a compile error from satisfies
// because the "pentagon" key is missing
```

### 2-3. Exhaustiveness Check Variations

```typescript
// ─── Method 1: assertNever (most common) ───
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

// ─── Method 2: Implicit check via return type annotation ───
function area(shape: Shape): number {
  switch (shape.type) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rect":
      return shape.width * shape.height;
    case "triangle":
      return (shape.base * shape.height) / 2;
    // Forgetting a case could result in undefined being returned,
    // which conflicts with the return type number -> compile error
  }
}

// ─── Method 3: satisfies Record (object map) ───
const handlers = {
  circle: (s: Circle) => `Circle: r=${s.radius}`,
  rect: (s: Rect) => `Rect: ${s.width}x${s.height}`,
  triangle: (s: Triangle) => `Triangle: b=${s.base}, h=${s.height}`,
} satisfies Record<Shape["type"], (s: any) => string>;

// ─── Method 4: const assertion + type check ───
const SHAPE_TYPES = ["circle", "rect", "triangle"] as const;
type ShapeType = (typeof SHAPE_TYPES)[number];
// Verify that Shape["type"] matches ShapeType
type Check = ShapeType extends Shape["type"] ? true : false;
// If Check is not true, SHAPE_TYPES is missing entries

// ─── Method 5: ESLint rule ───
// Enabling @typescript-eslint/switch-exhaustiveness-check
// allows detecting non-exhaustive switch statements via lint
```

### 2-4. Conditional Exhaustiveness Checks

```typescript
// When you want to handle only some cases and apply common handling for the rest

// Pattern 1: Explicit common handling
function getStatusColor(status: "active" | "inactive" | "pending" | "archived"): string {
  switch (status) {
    case "active":
      return "green";
    case "pending":
      return "yellow";
    case "inactive":
    case "archived":
      return "gray"; // Group multiple cases together
    default:
      return assertNever(status);
  }
}

// Pattern 2: Partial handling + default
type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

function shouldAlert(level: LogLevel): boolean {
  switch (level) {
    case "error":
    case "fatal":
      return true;
    default:
      // The rest are false; no exhaustiveness check performed
      return false;
  }
}

// Pattern 3: Type-safe exhaustiveness check with default fallback
function toHttpStatus(error: DomainError): number {
  switch (error.code) {
    case "VALIDATION_ERROR": return 400;
    case "NOT_FOUND": return 404;
    case "PERMISSION_DENIED": return 403;
    case "CONFLICT": return 409;
    default: {
      // If error.code is not never here,
      // a new error code has been added
      const _exhaustive: never = error;
      // Fallback: return 500 (type check warns but build passes)
      return 500;
    }
  }
}
```

---

## 3. Usage in Redux / useReducer

### 3-1. Designing Action Types

```
                   dispatch(action)
                        |
                        v
+---------------------------------------------------+
|                    Reducer                          |
|                                                     |
|  switch (action.type) {                            |
|    case "ADD_TODO":                                |
|      action.payload  -> { text: string }            |
|    case "TOGGLE_TODO":                             |
|      action.payload  -> { id: number }              |
|    case "DELETE_TODO":                             |
|      action.payload  -> { id: number }              |
|    case "SET_FILTER":                              |
|      action.payload  -> { filter: FilterType }      |
|    default:                                        |
|      assertNever(action)  -> exhaustiveness check  |
|  }                                                 |
+---------------------------------------------------+
```

```typescript
// State
interface TodoState {
  readonly todos: readonly Todo[];
  readonly filter: "all" | "active" | "completed";
}

interface Todo {
  readonly id: number;
  readonly text: string;
  readonly completed: boolean;
}

// Action -- discriminated union
type TodoAction =
  | { readonly type: "ADD_TODO"; readonly payload: { text: string } }
  | { readonly type: "TOGGLE_TODO"; readonly payload: { id: number } }
  | { readonly type: "DELETE_TODO"; readonly payload: { id: number } }
  | { readonly type: "SET_FILTER"; readonly payload: { filter: TodoState["filter"] } };

// Reducer
function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case "ADD_TODO":
      return {
        ...state,
        todos: [
          ...state.todos,
          {
            id: Date.now(),
            text: action.payload.text, // Narrowed to { text: string }
            completed: false,
          },
        ],
      };

    case "TOGGLE_TODO":
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload.id // Narrowed to { id: number }
            ? { ...todo, completed: !todo.completed }
            : todo
        ),
      };

    case "DELETE_TODO":
      return {
        ...state,
        todos: state.todos.filter(
          (todo) => todo.id !== action.payload.id
        ),
      };

    case "SET_FILTER":
      return {
        ...state,
        filter: action.payload.filter, // Narrowed to { filter: ... }
      };

    default:
      return assertNever(action);
  }
}
```

### 3-2. Type-Safe Action Creator Definitions

```typescript
// Auto-generate Action Creator types
type ActionCreator<A extends { type: string }> = {
  [T in A["type"]]: (
    payload: Extract<A, { type: T }> extends { payload: infer P }
      ? P
      : never
  ) => Extract<A, { type: T }>;
};

// Implementation
const todoActions: ActionCreator<TodoAction> = {
  ADD_TODO: (payload) => ({ type: "ADD_TODO", payload }),
  TOGGLE_TODO: (payload) => ({ type: "TOGGLE_TODO", payload }),
  DELETE_TODO: (payload) => ({ type: "DELETE_TODO", payload }),
  SET_FILTER: (payload) => ({ type: "SET_FILTER", payload }),
};

// Usage -- payload type is automatically inferred
const action = todoActions.ADD_TODO({ text: "Learn TypeScript" });
// Type: { type: "ADD_TODO"; payload: { text: string } }
```

### 3-3. Integration with React useReducer

```typescript
import { useReducer, Dispatch } from "react";

// Initial state
const initialState: TodoState = {
  todos: [],
  filter: "all",
};

// Custom hook
function useTodos() {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  const actions = {
    addTodo: (text: string) =>
      dispatch({ type: "ADD_TODO", payload: { text } }),

    toggleTodo: (id: number) =>
      dispatch({ type: "TOGGLE_TODO", payload: { id } }),

    deleteTodo: (id: number) =>
      dispatch({ type: "DELETE_TODO", payload: { id } }),

    setFilter: (filter: TodoState["filter"]) =>
      dispatch({ type: "SET_FILTER", payload: { filter } }),
  };

  const filteredTodos = state.todos.filter((todo) => {
    switch (state.filter) {
      case "all": return true;
      case "active": return !todo.completed;
      case "completed": return todo.completed;
    }
  });

  return { state, filteredTodos, actions };
}

// Usage in a component
function TodoApp() {
  const { filteredTodos, actions } = useTodos();

  return (
    <div>
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            actions.addTodo(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
      />
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <span
              onClick={() => actions.toggleTodo(todo.id)}
              style={{
                textDecoration: todo.completed ? "line-through" : "none",
              }}
            >
              {todo.text}
            </span>
            <button onClick={() => actions.deleteTodo(todo.id)}>x</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 3-4. Complex State Management (Composing Multiple Reducers)

```typescript
// ─── Authentication state ───
type AuthState =
  | { status: "anonymous" }
  | { status: "authenticating" }
  | { status: "authenticated"; user: User; token: string }
  | { status: "error"; error: string };

type AuthAction =
  | { type: "LOGIN_START" }
  | { type: "LOGIN_SUCCESS"; payload: { user: User; token: string } }
  | { type: "LOGIN_FAILURE"; payload: { error: string } }
  | { type: "LOGOUT" };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "LOGIN_START":
      return { status: "authenticating" };
    case "LOGIN_SUCCESS":
      return {
        status: "authenticated",
        user: action.payload.user,
        token: action.payload.token,
      };
    case "LOGIN_FAILURE":
      return { status: "error", error: action.payload.error };
    case "LOGOUT":
      return { status: "anonymous" };
    default:
      return assertNever(action);
  }
}

// ─── Transition constraints between states ───
// Restrict available actions based on current state at the type level

type AuthActionFor<S extends AuthState["status"]> =
  S extends "anonymous" ? Extract<AuthAction, { type: "LOGIN_START" }>
  : S extends "authenticating" ? Extract<AuthAction, { type: "LOGIN_SUCCESS" | "LOGIN_FAILURE" }>
  : S extends "authenticated" ? Extract<AuthAction, { type: "LOGOUT" }>
  : S extends "error" ? Extract<AuthAction, { type: "LOGIN_START" | "LOGOUT" }>
  : never;

// Type-safe dispatch
function createAuthDispatch(
  state: AuthState,
  dispatch: Dispatch<AuthAction>
) {
  return {
    login: () => {
      if (state.status === "anonymous" || state.status === "error") {
        dispatch({ type: "LOGIN_START" });
      }
    },
    logout: () => {
      if (state.status === "authenticated") {
        dispatch({ type: "LOGOUT" });
      }
    },
  };
}
```

---

## 4. Advanced Patterns

### 4-1. Nested Discriminated Unions

```typescript
// API response type
type ApiResponse<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: ApiError };

type ApiError =
  | { code: "NETWORK"; message: string; retryable: true }
  | { code: "AUTH"; message: string; retryable: false }
  | { code: "VALIDATION"; message: string; fields: string[] };

// Nested discrimination
function handleResponse<T>(response: ApiResponse<T>): string {
  switch (response.status) {
    case "loading":
      return "Loading...";
    case "success":
      return `Data: ${JSON.stringify(response.data)}`;
    case "error":
      switch (response.error.code) {
        case "NETWORK":
          return `Network error (retryable): ${response.error.message}`;
        case "AUTH":
          return "Please login again";
        case "VALIDATION":
          return `Invalid fields: ${response.error.fields.join(", ")}`;
        default:
          return assertNever(response.error);
      }
    default:
      return assertNever(response);
  }
}
```

### 4-2. Combining Discriminated Unions with Generics

```typescript
// Event system
type AppEvent =
  | { kind: "user.created"; payload: { userId: string; name: string } }
  | { kind: "user.deleted"; payload: { userId: string } }
  | { kind: "order.placed"; payload: { orderId: string; total: number } }
  | { kind: "order.shipped"; payload: { orderId: string; trackingId: string } };

// Type-safe event handler registration
type EventHandler<E extends AppEvent["kind"]> = (
  payload: Extract<AppEvent, { kind: E }>["payload"]
) => void;

class EventBus {
  private handlers = new Map<string, Set<Function>>();

  on<E extends AppEvent["kind"]>(
    event: E,
    handler: EventHandler<E>
  ): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  emit<E extends AppEvent["kind"]>(
    event: E,
    payload: Extract<AppEvent, { kind: E }>["payload"]
  ): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}

// Usage example
const bus = new EventBus();
bus.on("user.created", (payload) => {
  // payload is inferred as { userId: string; name: string }
  console.log(`User ${payload.name} created`);
});

bus.emit("order.placed", { orderId: "123", total: 9800 });
// bus.emit("order.placed", { orderId: "123" }); // Error: total is required
```

### 4-3. Type-Level Operations on Discriminated Unions

```typescript
// ─── Extract: pull out specific members ───
type UserEvents = Extract<AppEvent, { kind: `user.${string}` }>;
// => { kind: "user.created"; payload: ... } | { kind: "user.deleted"; payload: ... }

type OrderEvents = Extract<AppEvent, { kind: `order.${string}` }>;
// => { kind: "order.placed"; payload: ... } | { kind: "order.shipped"; payload: ... }

// ─── Exclude: remove specific members ───
type NonUserEvents = Exclude<AppEvent, { kind: `user.${string}` }>;

// ─── Get discriminant values ───
type EventKind = AppEvent["kind"];
// => "user.created" | "user.deleted" | "order.placed" | "order.shipped"

// ─── Utility type to get payload ───
type PayloadOf<K extends AppEvent["kind"]> = Extract<
  AppEvent,
  { kind: K }
>["payload"];

type UserCreatedPayload = PayloadOf<"user.created">;
// => { userId: string; name: string }

// ─── Generate an event map ───
type EventMap = {
  [K in AppEvent["kind"]]: PayloadOf<K>;
};
// => {
//   "user.created": { userId: string; name: string };
//   "user.deleted": { userId: string };
//   "order.placed": { orderId: string; total: number };
//   "order.shipped": { orderId: string; trackingId: string };
// }
```

### 4-4. Auto-Generating Tagged Unions

```typescript
// Auto-generate a discriminated union from a payload map
type EventPayloads = {
  "user.created": { userId: string; name: string };
  "user.deleted": { userId: string };
  "order.placed": { orderId: string; total: number };
  "order.shipped": { orderId: string; trackingId: string };
  "payment.completed": { paymentId: string; amount: number };
  "payment.failed": { paymentId: string; reason: string };
};

// Generate discriminated union from payload map
type GeneratedEvent = {
  [K in keyof EventPayloads]: {
    kind: K;
    payload: EventPayloads[K];
    timestamp: Date;
  };
}[keyof EventPayloads];

// Type-safe event creation function
function createEvent<K extends keyof EventPayloads>(
  kind: K,
  payload: EventPayloads[K]
): Extract<GeneratedEvent, { kind: K }> {
  return { kind, payload, timestamp: new Date() } as any;
}

// Generate discriminated union from action map (for Redux)
type ActionPayloads = {
  INCREMENT: void;
  DECREMENT: void;
  SET_VALUE: { value: number };
  RESET: void;
};

type GeneratedAction = {
  [K in keyof ActionPayloads]: ActionPayloads[K] extends void
    ? { type: K }
    : { type: K; payload: ActionPayloads[K] };
}[keyof ActionPayloads];
// =>
//   | { type: "INCREMENT" }
//   | { type: "DECREMENT" }
//   | { type: "SET_VALUE"; payload: { value: number } }
//   | { type: "RESET" }
```

### 4-5. Recursive Discriminated Unions

```typescript
// Recursive data structure like JSON
type JsonValue =
  | { type: "null" }
  | { type: "boolean"; value: boolean }
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "array"; elements: JsonValue[] }
  | { type: "object"; properties: Record<string, JsonValue> };

function stringify(json: JsonValue): string {
  switch (json.type) {
    case "null":
      return "null";
    case "boolean":
      return json.value ? "true" : "false";
    case "number":
      return String(json.value);
    case "string":
      return `"${json.value}"`;
    case "array":
      return `[${json.elements.map(stringify).join(", ")}]`;
    case "object": {
      const entries = Object.entries(json.properties)
        .map(([key, val]) => `"${key}": ${stringify(val)}`)
        .join(", ");
      return `{${entries}}`;
    }
    default:
      return assertNever(json);
  }
}

// AST (Abstract Syntax Tree) representation
type Expression =
  | { kind: "number_literal"; value: number }
  | { kind: "string_literal"; value: string }
  | { kind: "identifier"; name: string }
  | { kind: "binary_op"; op: "+" | "-" | "*" | "/"; left: Expression; right: Expression }
  | { kind: "unary_op"; op: "-" | "!"; operand: Expression }
  | { kind: "function_call"; name: string; args: Expression[] }
  | { kind: "conditional"; condition: Expression; then: Expression; else: Expression };

function evaluate(expr: Expression, env: Record<string, number>): number {
  switch (expr.kind) {
    case "number_literal":
      return expr.value;
    case "string_literal":
      return parseFloat(expr.value);
    case "identifier":
      if (!(expr.name in env)) throw new Error(`Undefined: ${expr.name}`);
      return env[expr.name];
    case "binary_op": {
      const left = evaluate(expr.left, env);
      const right = evaluate(expr.right, env);
      switch (expr.op) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return left / right;
      }
    }
    case "unary_op": {
      const operand = evaluate(expr.operand, env);
      switch (expr.op) {
        case "-": return -operand;
        case "!": return operand === 0 ? 1 : 0;
      }
    }
    case "function_call":
      throw new Error("Function calls not supported in this example");
    case "conditional":
      return evaluate(expr.condition, env) !== 0
        ? evaluate(expr.then, env)
        : evaluate(expr.else, env);
    default:
      return assertNever(expr);
  }
}
```

---

## 5. Production Design Patterns

### 5-1. Discriminated Unions as State Machines

```typescript
// ─── Order state machine ───
//
//  Created -> Confirmed -> Processing -> Shipped -> Delivered
//     |          |            |                        |
//     +----------+------------+-- Cancelled            +-- Returned
//

type OrderState =
  | {
      status: "created";
      orderId: string;
      items: OrderItem[];
      createdAt: Date;
    }
  | {
      status: "confirmed";
      orderId: string;
      items: OrderItem[];
      createdAt: Date;
      confirmedAt: Date;
      paymentId: string;
    }
  | {
      status: "processing";
      orderId: string;
      items: OrderItem[];
      createdAt: Date;
      confirmedAt: Date;
      paymentId: string;
      processingStartedAt: Date;
    }
  | {
      status: "shipped";
      orderId: string;
      items: OrderItem[];
      createdAt: Date;
      confirmedAt: Date;
      paymentId: string;
      shippedAt: Date;
      trackingNumber: string;
    }
  | {
      status: "delivered";
      orderId: string;
      items: OrderItem[];
      createdAt: Date;
      confirmedAt: Date;
      paymentId: string;
      shippedAt: Date;
      trackingNumber: string;
      deliveredAt: Date;
    }
  | {
      status: "cancelled";
      orderId: string;
      items: OrderItem[];
      createdAt: Date;
      cancelledAt: Date;
      reason: string;
      refundId?: string;
    }
  | {
      status: "returned";
      orderId: string;
      items: OrderItem[];
      createdAt: Date;
      confirmedAt: Date;
      deliveredAt: Date;
      returnedAt: Date;
      returnReason: string;
      refundId: string;
    };

// State transition functions
type OrderEvent =
  | { type: "CONFIRM"; paymentId: string }
  | { type: "START_PROCESSING" }
  | { type: "SHIP"; trackingNumber: string }
  | { type: "DELIVER" }
  | { type: "CANCEL"; reason: string }
  | { type: "RETURN"; reason: string; refundId: string };

function transitionOrder(state: OrderState, event: OrderEvent): OrderState {
  switch (event.type) {
    case "CONFIRM": {
      if (state.status !== "created") {
        throw new Error(`Cannot confirm order in ${state.status} state`);
      }
      return {
        ...state,
        status: "confirmed",
        confirmedAt: new Date(),
        paymentId: event.paymentId,
      };
    }

    case "START_PROCESSING": {
      if (state.status !== "confirmed") {
        throw new Error(`Cannot start processing in ${state.status} state`);
      }
      return {
        ...state,
        status: "processing",
        processingStartedAt: new Date(),
      };
    }

    case "SHIP": {
      if (state.status !== "processing") {
        throw new Error(`Cannot ship in ${state.status} state`);
      }
      return {
        ...state,
        status: "shipped",
        shippedAt: new Date(),
        trackingNumber: event.trackingNumber,
      };
    }

    case "DELIVER": {
      if (state.status !== "shipped") {
        throw new Error(`Cannot deliver in ${state.status} state`);
      }
      return {
        ...state,
        status: "delivered",
        deliveredAt: new Date(),
      };
    }

    case "CANCEL": {
      if (state.status !== "created" && state.status !== "confirmed" && state.status !== "processing") {
        throw new Error(`Cannot cancel in ${state.status} state`);
      }
      return {
        status: "cancelled",
        orderId: state.orderId,
        items: state.items,
        createdAt: state.createdAt,
        cancelledAt: new Date(),
        reason: event.reason,
        refundId: state.status === "confirmed" || state.status === "processing"
          ? "refund-pending"
          : undefined,
      };
    }

    case "RETURN": {
      if (state.status !== "delivered") {
        throw new Error(`Cannot return in ${state.status} state`);
      }
      return {
        status: "returned",
        orderId: state.orderId,
        items: state.items,
        createdAt: state.createdAt,
        confirmedAt: state.confirmedAt,
        deliveredAt: state.deliveredAt,
        returnedAt: new Date(),
        returnReason: event.reason,
        refundId: event.refundId,
      };
    }

    default:
      return assertNever(event);
  }
}

// Display based on status
function getOrderStatusDisplay(state: OrderState): {
  label: string;
  color: string;
  actions: string[];
} {
  switch (state.status) {
    case "created":
      return {
        label: "Order Created",
        color: "gray",
        actions: ["confirm", "cancel"],
      };
    case "confirmed":
      return {
        label: "Confirmed",
        color: "blue",
        actions: ["start_processing", "cancel"],
      };
    case "processing":
      return {
        label: "Processing",
        color: "yellow",
        actions: ["ship", "cancel"],
      };
    case "shipped":
      return {
        label: `Shipped (${state.trackingNumber})`,
        color: "orange",
        actions: ["deliver"],
      };
    case "delivered":
      return {
        label: "Delivered",
        color: "green",
        actions: ["return"],
      };
    case "cancelled":
      return {
        label: `Cancelled: ${state.reason}`,
        color: "red",
        actions: [],
      };
    case "returned":
      return {
        label: `Returned: ${state.returnReason}`,
        color: "purple",
        actions: [],
      };
    default:
      return assertNever(state);
  }
}
```

### 5-2. Representing Form State

```typescript
// Form field state
type FieldState<T> =
  | { status: "pristine"; value: T }
  | { status: "dirty"; value: T; originalValue: T }
  | { status: "validating"; value: T }
  | { status: "valid"; value: T }
  | { status: "invalid"; value: T; errors: string[] };

// Overall form state
type FormState<T extends Record<string, unknown>> = {
  fields: {
    [K in keyof T]: FieldState<T[K]>;
  };
  submitState:
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "success"; response: unknown }
    | { status: "error"; error: string };
};

// Form actions
type FormAction<T extends Record<string, unknown>> =
  | { type: "FIELD_CHANGE"; field: keyof T; value: T[keyof T] }
  | { type: "FIELD_BLUR"; field: keyof T }
  | { type: "FIELD_VALIDATE_START"; field: keyof T }
  | { type: "FIELD_VALIDATE_SUCCESS"; field: keyof T }
  | { type: "FIELD_VALIDATE_ERROR"; field: keyof T; errors: string[] }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; response: unknown }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "RESET" };

// UI control based on form state
function isFormSubmittable<T extends Record<string, unknown>>(
  state: FormState<T>
): boolean {
  if (state.submitState.status === "submitting") return false;

  return Object.values(state.fields).every((field) => {
    const f = field as FieldState<unknown>;
    return f.status === "valid" || f.status === "pristine";
  });
}

function getFieldError<T extends Record<string, unknown>>(
  state: FormState<T>,
  field: keyof T
): string[] | null {
  const fieldState = state.fields[field];
  if (fieldState.status === "invalid") {
    return fieldState.errors;
  }
  return null;
}
```

### 5-3. Type-Safe Routing Representation

```typescript
// Type-safe routing
type Route =
  | { path: "/"; page: "home" }
  | { path: "/users"; page: "user-list"; query?: { page?: number; search?: string } }
  | { path: "/users/:id"; page: "user-detail"; params: { id: string } }
  | { path: "/users/:id/edit"; page: "user-edit"; params: { id: string } }
  | { path: "/settings"; page: "settings" }
  | { path: "/404"; page: "not-found" };

// Select page component based on route
function getPageComponent(route: Route): string {
  switch (route.page) {
    case "home":
      return "HomePage";
    case "user-list":
      return "UserListPage";
    case "user-detail":
      return `UserDetailPage(id=${route.params.id})`;
    case "user-edit":
      return `UserEditPage(id=${route.params.id})`;
    case "settings":
      return "SettingsPage";
    case "not-found":
      return "NotFoundPage";
    default:
      return assertNever(route);
  }
}

// Type-safe link generation
type LinkParams<P extends Route["page"]> = Extract<Route, { page: P }>;

function createLink<P extends Route["page"]>(
  ...args: LinkParams<P> extends { params: infer Params }
    ? [page: P, params: Params]
    : [page: P]
): string {
  const [page, params] = args;

  switch (page) {
    case "home": return "/";
    case "user-list": return "/users";
    case "user-detail": return `/users/${(params as any).id}`;
    case "user-edit": return `/users/${(params as any).id}/edit`;
    case "settings": return "/settings";
    default: return "/404";
  }
}

// Usage examples
const homeLink = createLink("home"); // "/"
const userLink = createLink("user-detail", { id: "123" }); // "/users/123"
// createLink("user-detail"); // Error: params is required
```

### 5-4. Type-Safe WebSocket Message Handling

```typescript
// Discriminated union for WebSocket messages
type ClientMessage =
  | { type: "join_room"; roomId: string; userId: string }
  | { type: "leave_room"; roomId: string }
  | { type: "send_message"; roomId: string; content: string }
  | { type: "typing_start"; roomId: string }
  | { type: "typing_stop"; roomId: string }
  | { type: "ping" };

type ServerMessage =
  | { type: "room_joined"; roomId: string; members: string[] }
  | { type: "room_left"; roomId: string }
  | { type: "new_message"; roomId: string; userId: string; content: string; timestamp: number }
  | { type: "user_typing"; roomId: string; userId: string }
  | { type: "user_stopped_typing"; roomId: string; userId: string }
  | { type: "pong" }
  | { type: "error"; code: string; message: string };

// Server-side message handler
class ChatServer {
  handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case "join_room":
        this.joinRoom(ws, message.roomId, message.userId);
        break;
      case "leave_room":
        this.leaveRoom(ws, message.roomId);
        break;
      case "send_message":
        this.sendMessage(ws, message.roomId, message.content);
        break;
      case "typing_start":
        this.broadcastTyping(message.roomId, true);
        break;
      case "typing_stop":
        this.broadcastTyping(message.roomId, false);
        break;
      case "ping":
        this.send(ws, { type: "pong" });
        break;
      default:
        assertNever(message);
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    ws.send(JSON.stringify(message));
  }

  private joinRoom(ws: WebSocket, roomId: string, userId: string): void {
    // Logic to join a room
    const members = this.getRoomMembers(roomId);
    this.send(ws, { type: "room_joined", roomId, members });
  }

  // ... other methods
}

// Client-side message handler
function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case "room_joined":
      console.log(`Joined room ${message.roomId} with ${message.members.length} members`);
      break;
    case "new_message":
      console.log(`[${message.roomId}] ${message.userId}: ${message.content}`);
      break;
    case "error":
      console.error(`Server error [${message.code}]: ${message.message}`);
      break;
    // ... other cases
  }
}
```

### 5-5. Tree Structures and the Visitor Pattern

```typescript
// HTML-like tree structure
type HtmlNode =
  | { type: "element"; tag: string; attributes: Record<string, string>; children: HtmlNode[] }
  | { type: "text"; content: string }
  | { type: "comment"; content: string }
  | { type: "doctype"; value: string };

// Visitor pattern
interface HtmlVisitor<T> {
  element(node: Extract<HtmlNode, { type: "element" }>, children: T[]): T;
  text(node: Extract<HtmlNode, { type: "text" }>): T;
  comment(node: Extract<HtmlNode, { type: "comment" }>): T;
  doctype(node: Extract<HtmlNode, { type: "doctype" }>): T;
}

function visitHtml<T>(node: HtmlNode, visitor: HtmlVisitor<T>): T {
  switch (node.type) {
    case "element": {
      const children = node.children.map((child) => visitHtml(child, visitor));
      return visitor.element(node, children);
    }
    case "text":
      return visitor.text(node);
    case "comment":
      return visitor.comment(node);
    case "doctype":
      return visitor.doctype(node);
    default:
      return assertNever(node);
  }
}

// Visitor that converts HTML to a string
const htmlStringVisitor: HtmlVisitor<string> = {
  element(node, children) {
    const attrs = Object.entries(node.attributes)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join("");
    return `<${node.tag}${attrs}>${children.join("")}</${node.tag}>`;
  },
  text(node) {
    return node.content;
  },
  comment(node) {
    return `<!-- ${node.content} -->`;
  },
  doctype(node) {
    return `<!DOCTYPE ${node.value}>`;
  },
};

// Visitor that extracts text only
const textExtractVisitor: HtmlVisitor<string> = {
  element(_, children) {
    return children.join(" ");
  },
  text(node) {
    return node.content;
  },
  comment() {
    return "";
  },
  doctype() {
    return "";
  },
};

// Usage example
const doc: HtmlNode = {
  type: "element",
  tag: "div",
  attributes: { class: "container" },
  children: [
    { type: "element", tag: "h1", attributes: {}, children: [
      { type: "text", content: "Hello" },
    ]},
    { type: "text", content: " World" },
    { type: "comment", content: "todo: add more content" },
  ],
};

const html = visitHtml(doc, htmlStringVisitor);
// '<div class="container"><h1>Hello</h1> World<!-- todo: add more content --></div>'

const text = visitHtml(doc, textExtractVisitor);
// 'Hello  World '
```

---

## 6. Performance and Optimization

### 6-1. switch vs if-else vs Object Map

```typescript
// ─── Benchmark results (approximate) ───

// Method 1: switch statement -- ~1-2ns/op
function areaSwitch(shape: Shape): number {
  switch (shape.type) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rect": return shape.width * shape.height;
    case "triangle": return (shape.base * shape.height) / 2;
  }
}

// Method 2: if-else -- ~1-3ns/op
function areaIfElse(shape: Shape): number {
  if (shape.type === "circle") return Math.PI * shape.radius ** 2;
  if (shape.type === "rect") return shape.width * shape.height;
  return (shape.base * shape.height) / 2;
}

// Method 3: object map -- ~3-5ns/op
const areaMap: Record<Shape["type"], (s: any) => number> = {
  circle: (s: Circle) => Math.PI * s.radius ** 2,
  rect: (s: Rect) => s.width * s.height,
  triangle: (s: Triangle) => (s.base * s.height) / 2,
};
function areaMapLookup(shape: Shape): number {
  return areaMapshape.type;
}

// Conclusion:
// - Few branches (3-5): switch is fastest and most readable
// - Many branches (10+): object map provides uniform performance
// - V8 optimizes switch statements heavily, so switch is often fastest
```

### 6-2. Memory Efficiency

```typescript
// ─── Constructor functions vs object literals ───

// Method 1: Object literal (recommended)
const circleObj: Circle = { type: "circle", radius: 5 };
// Each object may have its own hidden class

// Method 2: Factory function (favorable for V8 optimization)
function createCircle(radius: number): Circle {
  return { type: "circle", radius };
}
// Objects created from the same factory share the same hidden class

// Method 3: Class (most V8-friendly)
class CircleImpl implements Circle {
  readonly type = "circle" as const;
  constructor(readonly radius: number) {}
}
// Class instances always share the same hidden class

// ─── Recommendations when creating large numbers of objects ───
// When creating 100,000+ discriminated union objects:
// 1. Use factory functions
// 2. Keep property order consistent
// 3. Use readonly (easier for V8 to optimize)
```

### 6-3. Serialization Efficiency

```typescript
// Handling discriminants during JSON serialization

// Method 1: JSON.stringify directly (recommended)
const serialized = JSON.stringify(shape);
// {"type":"circle","radius":5}

// Method 2: Numeric tags to reduce size (when bandwidth matters)
const TAG = { circle: 0, rect: 1, triangle: 2 } as const;
type TaggedShape =
  | [typeof TAG.circle, number]           // [0, radius]
  | [typeof TAG.rect, number, number]     // [1, width, height]
  | [typeof TAG.triangle, number, number]; // [2, base, height]

function toTagged(shape: Shape): TaggedShape {
  switch (shape.type) {
    case "circle": return [TAG.circle, shape.radius];
    case "rect": return [TAG.rect, shape.width, shape.height];
    case "triangle": return [TAG.triangle, shape.base, shape.height];
  }
}

function fromTagged(tagged: TaggedShape): Shape {
  switch (tagged[0]) {
    case TAG.circle: return { type: "circle", radius: tagged[1] };
    case TAG.rect: return { type: "rect", width: tagged[1], height: tagged[2] };
    case TAG.triangle: return { type: "triangle", base: tagged[1], height: tagged[2] };
  }
}

// Size comparison:
// JSON: {"type":"circle","radius":5}       = 30 bytes
// Tagged: [0,5]                            = 5 bytes
// -> Effective for transferring large amounts of data
```

---

## Comparison Tables

### Comparison of Type Narrowing Techniques

| Technique | Safety | Performance | Extensibility | Exhaustiveness Check |
|-----------|--------|-------------|---------------|----------------------|
| Discriminated union (switch) | High | Best | High | Possible with `never` |
| instanceof | Medium | High | Low | Incomplete |
| in operator | Low | High | Low | Not possible |
| Type predicate (is) | High | Medium | Medium | Not possible |
| zod discriminatedUnion | Highest | Medium | High | Possible at runtime |

### Discriminant Options

| Discriminant | Example | Advantages | Caveats |
|--------------|---------|------------|---------|
| String literal | `type: "circle"` | Most common, highly readable | Risk of typos |
| Numeric literal | `kind: 0 \| 1 \| 2` | switch optimization | Lower readability |
| enum | `Action.Add` | Excellent IDE completion | Tree-shaking issues |
| const enum | `const enum` | Zero runtime cost | Incompatible with isolatedModules |
| Symbol | `Symbol("circle")` | Uniqueness guaranteed | Cannot be serialized |

### Comparison of Exhaustiveness Check Techniques

| Technique | Safety Level | Code Volume | Use Case |
|-----------|-------------|-------------|----------|
| assertNever | Highest | Low | switch default |
| satisfies Record | Highest | Medium | Object maps |
| Return type annotation | High | Minimal | Implicit check |
| ESLint rule | Medium | Config only | Detection in CI/CD |
| Type tests | Highest | High | Inside test files |

### When to Use Discriminated Unions

| Scenario | Example | Benefit |
|----------|---------|---------|
| State machines | Order status, auth state, form state | Prevent invalid transitions at compile time |
| Event-driven | DOM events, WebSocket messages | Type safety in handlers |
| API responses | Success/error/loading | Type-safe UI rendering based on state |
| Redux Actions | Action definitions and Reducers | Payload type inference |
| AST | Compilers, linters, formatters | Per-node-type processing |
| Data models | Payment methods, notification channels | Exhaustiveness guarantee for variants |

---

## Anti-Patterns

### AP-1: Union Types Without a Discriminant

```typescript
// Bad: No discriminant makes narrowing difficult
type Shape =
  | { radius: number }
  | { width: number; height: number }
  | { base: number; height: number }; // height is duplicated!

function area(shape: Shape): number {
  if ("radius" in shape) {
    return Math.PI * shape.radius ** 2;
  }
  // Can only distinguish by presence of width
  if ("width" in shape) {
    return shape.width * shape.height;
  }
  return shape.base * shape.height; // Is this really Triangle?
}

// Good: Add a discriminant
type Shape =
  | { type: "circle"; radius: number }
  | { type: "rect"; width: number; height: number }
  | { type: "triangle"; base: number; height: number };
```

### AP-2: Swallowing Cases with default

```typescript
// Bad: New cases are silently missed with a catch-all default
function describe(shape: Shape): string {
  switch (shape.type) {
    case "circle":
      return "A circle";
    case "rect":
      return "A rectangle";
    default:
      return "Unknown shape"; // Misses Triangle, and future additions too
  }
}

// Good: Use assertNever to guarantee exhaustiveness
function describe(shape: Shape): string {
  switch (shape.type) {
    case "circle":
      return "A circle";
    case "rect":
      return "A rectangle";
    case "triangle":
      return "A triangle";
    default:
      return assertNever(shape); // Compile error when a new type is added
  }
}
```

### AP-3: Setting the Discriminant Dynamically

```typescript
// Bad: Discriminant is a dynamic value
function createShape(type: string, params: any): Shape {
  return { type, ...params } as Shape; // Zero type safety
}

// Good: Smart constructors
function createCircle(radius: number): Circle {
  return { type: "circle", radius };
}

function createRect(width: number, height: number): Rect {
  return { type: "rect", width, height };
}
```

### AP-4: Processing a Huge Discriminated Union in One Place

```typescript
// Bad: A switch with 50 cases
function handleEvent(event: AppEvent): void {
  switch (event.type) {
    case "type_1": /* ... */ break;
    case "type_2": /* ... */ break;
    // ... 50 cases ...
    case "type_50": /* ... */ break;
    default: assertNever(event);
  }
}

// Good: Split by category
type UserEvent = Extract<AppEvent, { type: `user.${string}` }>;
type OrderEvent = Extract<AppEvent, { type: `order.${string}` }>;
type PaymentEvent = Extract<AppEvent, { type: `payment.${string}` }>;

function handleEvent(event: AppEvent): void {
  if (event.type.startsWith("user.")) {
    return handleUserEvent(event as UserEvent);
  }
  if (event.type.startsWith("order.")) {
    return handleOrderEvent(event as OrderEvent);
  }
  if (event.type.startsWith("payment.")) {
    return handlePaymentEvent(event as PaymentEvent);
  }
}

function handleUserEvent(event: UserEvent): void {
  // Only 5-10 cases
}
```

### AP-5: Inconsistent Discriminant Names Across the Project

```typescript
// Bad: Different discriminant names across files
type Shape = { type: "circle"; ... } | { type: "rect"; ... };
type Event = { kind: "click"; ... } | { kind: "keypress"; ... };
type Action = { tag: "add"; ... } | { tag: "remove"; ... };
type Result = { _tag: "Ok"; ... } | { _tag: "Err"; ... };

// Good: Unified across the project
// Policy: standardize discriminant on "type"
type Shape = { type: "circle"; ... } | { type: "rect"; ... };
type Event = { type: "click"; ... } | { type: "keypress"; ... };
type Action = { type: "add"; ... } | { type: "remove"; ... };
type Result = { type: "ok"; ... } | { type: "err"; ... };
```

---

## Testing Strategy

### Testing Discriminated Unions

```typescript
import { describe, it, expect } from "vitest";

describe("Shape area calculation", () => {
  // Test each variant
  it("should calculate circle area", () => {
    const shape: Shape = { type: "circle", radius: 5 };
    expect(area(shape)).toBeCloseTo(78.54, 1);
  });

  it("should calculate rect area", () => {
    const shape: Shape = { type: "rect", width: 10, height: 5 };
    expect(area(shape)).toBe(50);
  });

  it("should calculate triangle area", () => {
    const shape: Shape = { type: "triangle", base: 6, height: 8 };
    expect(area(shape)).toBe(24);
  });

  // Type tests (compile-time checks)
  it("should have correct type narrowing", () => {
    const shape: Shape = { type: "circle", radius: 5 };
    if (shape.type === "circle") {
      // Verify TypeScript narrows shape to Circle here
      const _radius: number = shape.radius; // Should not cause a compile error
      expect(_radius).toBe(5);
    }
  });

  // Exhaustiveness test
  it("should handle all shape types", () => {
    const allTypes: Shape["type"][] = ["circle", "rect", "triangle"];
    for (const type of allTypes) {
      const shape = createShape(type);
      expect(() => area(shape)).not.toThrow();
    }
  });
});

// Compile-time type tests (using the tsd library)
// @ts-expect-error test
describe("Type-level tests", () => {
  it("should reject invalid discriminant", () => {
    // @ts-expect-error: "invalid" is not in Shape["type"]
    const shape: Shape = { type: "invalid", radius: 5 };
  });

  it("should not allow extra properties when narrowed", () => {
    const shape: Shape = { type: "circle", radius: 5 };
    if (shape.type === "circle") {
      // @ts-expect-error: width does not exist on Circle
      const _width = shape.width;
    }
  });
});
```

### Testing State Machines

```typescript
describe("Order state machine", () => {
  const initialOrder: OrderState = {
    status: "created",
    orderId: "order-1",
    items: [{ productId: "p1", quantity: 1, price: 1000 }],
    createdAt: new Date(),
  };

  it("should transition from created to confirmed", () => {
    const confirmed = transitionOrder(initialOrder, {
      type: "CONFIRM",
      paymentId: "pay-1",
    });
    expect(confirmed.status).toBe("confirmed");
    if (confirmed.status === "confirmed") {
      expect(confirmed.paymentId).toBe("pay-1");
    }
  });

  it("should not allow invalid transitions", () => {
    expect(() =>
      transitionOrder(initialOrder, { type: "SHIP", trackingNumber: "T123" })
    ).toThrow("Cannot ship in created state");
  });

  it("should follow full lifecycle", () => {
    let order: OrderState = initialOrder;

    order = transitionOrder(order, { type: "CONFIRM", paymentId: "pay-1" });
    expect(order.status).toBe("confirmed");

    order = transitionOrder(order, { type: "START_PROCESSING" });
    expect(order.status).toBe("processing");

    order = transitionOrder(order, { type: "SHIP", trackingNumber: "T123" });
    expect(order.status).toBe("shipped");

    order = transitionOrder(order, { type: "DELIVER" });
    expect(order.status).toBe("delivered");
  });

  it("should allow cancellation from valid states", () => {
    const validCancelStates: OrderState["status"][] = ["created", "confirmed", "processing"];

    for (const status of validCancelStates) {
      let order: OrderState = initialOrder;

      // Transition to the target state
      if (status === "confirmed" || status === "processing") {
        order = transitionOrder(order, { type: "CONFIRM", paymentId: "pay-1" });
      }
      if (status === "processing") {
        order = transitionOrder(order, { type: "START_PROCESSING" });
      }

      const cancelled = transitionOrder(order, {
        type: "CANCEL",
        reason: "Test cancellation",
      });
      expect(cancelled.status).toBe("cancelled");
    }
  });
});
```

---

## FAQ

### Q1: Does the discriminant always have to be named `type`?

No. Names like `type`, `kind`, `tag`, `status`, or `_tag` are all fine as long as they are consistent within the project. However, it is strongly recommended to unify the discriminant name within the same codebase. The convention in Redux-style code is `type`.

### Q2: How many members can a discriminated union scale to?

The TypeScript compiler handles even hundreds of members without issue. However, for developer cognitive load, consider splitting into nested discriminated unions by category when you exceed 20-30 members.

### Q3: Should I use enum or discriminated unions?

Discriminated unions are recommended. Enums have tree-shaking issues, and `const enum` is incompatible with `isolatedModules`. Discriminated unions are composed solely of literal types, have minimal runtime cost, and are most compatible with TypeScript's type inference.

### Q4: When should I use discriminated unions vs classes?

Use discriminated unions for data representation, and classes when behavior needs to be included. That said, in TypeScript the combination of discriminated union + functions (Visitor pattern) often offers higher type safety than class inheritance. If you value exhaustiveness checks over OOP's open-closed principle, choose discriminated unions.

### Q5: What should I be careful about when serializing/deserializing discriminated unions?

`JSON.stringify`/`parse` works naturally with discriminated unions. However, non-primitive types like `Date` or `Map` lose information during serialization. The best practice is to define your discriminated union using a zod schema and validate during deserialization.

### Q6: How can I introduce discriminated unions into an existing codebase?

Incremental adoption is possible: (1) first add a common discriminant field (e.g., `type`), (2) replace `instanceof` checks with `switch` statements, (3) add `assertNever` to guarantee exhaustiveness. If you have an existing class hierarchy, adding a `readonly type` property to each class is enough to use it as a discriminated union.

### Q7: Can discriminated unions and interface extends be used together?

Yes. You can define shared fields in a base interface and have each variant extend it. However, the discriminant field must be narrowed to a specific literal type in each variant.

```typescript
interface BaseShape {
  readonly color: string;
}

interface Circle extends BaseShape {
  readonly type: "circle";
  readonly radius: number;
}

interface Rect extends BaseShape {
  readonly type: "rect";
  readonly width: number;
  readonly height: number;
}

type Shape = Circle | Rect;
```

### Q8: Do discriminated unions become slow in performance-critical scenarios?

You do not need to worry about this in typical applications. The V8 engine optimizes switch statements very efficiently. For ultra-high-frequency paths requiring tens of millions of calls per second, numeric tags + array index access would be faster, but such optimization is rarely needed.

---

## Summary Table

| Concept | Key Point |
|---------|-----------|
| Discriminated union | A union where members are distinguished by a shared literal type field |
| Discriminant | A shared field such as `type` or `kind` |
| Type narrowing | Checking a literal value in switch/if narrows the type |
| Exhaustiveness check | `default: assertNever(x)` guarantees all cases are handled |
| satisfies | Checks exhaustiveness via type on an object map |
| Nesting | Discriminated unions can be nested to represent complex branching |
| State machine | Model state transitions in a type-safe way with discriminated unions |
| Visitor pattern | Type-safe processing of recursive structures |
| Event-driven | Handle event payloads type-safely using the discriminant |
| Type-level operations | Use Extract/Exclude to get subsets of a discriminated union |

---


## Summary

In this guide, we covered the following key points:

- Understanding basic concepts and principles
- Practical implementation patterns
- Best practices and pitfalls to avoid
- How to apply these patterns in production

---

## Guides to Read Next

- [Error Handling](./00-error-handling.md) -- Implementing the Result type using discriminated unions
- [Branded Types](./03-branded-types.md) -- Combining discriminated unions with branded types
- [Builder Pattern](./01-builder-pattern.md) -- Discriminated unions underpinning the type safety of Step Builder
- [Dependency Injection](./04-dependency-injection.md) -- Type-safe service management using discriminated unions
- [tRPC](../04-ecosystem/02-trpc.md) -- Type-safe APIs leveraging discriminated unions

---

## References

1. **TypeScript Handbook - Narrowing**
   https://www.typescriptlang.org/docs/handbook/2/narrowing.html

2. **Discriminated Unions in TypeScript** -- Matt Pocock
   https://www.totaltypescript.com/discriminated-unions-are-a-typescript-essential

3. **Redux Toolkit - Using TypeScript**
   https://redux-toolkit.js.org/usage/usage-with-typescript

4. **Algebraic Data Types in TypeScript** -- Giulio Canti
   https://dev.to/gcanti/functional-design-algebraic-data-types-36kf

5. **XState** -- State machines and statecharts for JavaScript
   https://xstate.js.org/

6. **The Expression Problem** -- Philip Wadler
   http://homepages.inf.ed.ac.uk/wadler/papers/expression/expression.txt

7. **Making Impossible States Impossible** -- Richard Feldman
   https://www.youtube.com/watch?v=IcgmSRJHu_8
