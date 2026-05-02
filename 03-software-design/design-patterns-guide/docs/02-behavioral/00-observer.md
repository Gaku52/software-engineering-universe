# Observer Pattern

> A behavioral pattern that defines a **one-to-many** dependency between objects, automatically notifying all dependent objects when one object changes state. It is the foundation of event-driven design and one of the most important patterns for building loosely coupled systems.

---

## What You Will Learn in This Chapter

1. Understand the structure of the Observer pattern (Pub/Sub) and the fundamentals of event-driven design, grasping the GoF design intent and modern applications
2. Learn the differences between Push and Pull notification models, when to use each, and how to design a type-safe EventEmitter
3. Acquire practical knowledge of real-world challenges and countermeasures: memory leak prevention, event ordering guarantees, asynchronous notifications, and backpressure

---

## Prerequisites

Before reading this guide, it is recommended to understand the following concepts.

| Prerequisite | Description | Reference Link |
|---------|------|-----------|
| Interfaces and Polymorphism | The concept of treating different types uniformly through a common contract | [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) |
| Callback Functions | Functions passed to other functions to be called later | [Functional Patterns](../03-functional/02-fp-patterns.md) |
| Dependency Direction and Coupling | Managing dependencies between modules | [Clean Code Principles](../../../clean-code-principles/docs/00-principles/) |
| Promise/async-await | Fundamentals of asynchronous processing (required for understanding async Observer) | [Monad Pattern](../03-functional/00-monad.md) |

---

## 1. What Is the Observer Pattern?

### 1.1 The Problem It Solves

In software systems, there is a frequent requirement: "when one part changes state, update all other parts that depend on it."

- When a user purchases a product, send an email, update inventory, and record analytics data
- When data changes, redraw all related UI elements
- When a sensor value changes, reflect it in all monitors, alarms, and logs

Implementing these with direct function calls requires the caller to know all its dependents, resulting in **tight coupling**. Every time a new dependent is added, the caller's code must be changed, violating the Open/Closed Principle.

### 1.2 Pattern Intent

GoF definition:

> Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically.

### 1.3 WHY: Why Is the Observer Pattern Needed?

The fundamental reason is to **reverse the direction of dependencies**.

```
Direct calls (tight coupling):
  OrderService ----> EmailService
              |----> InventoryService
              |----> AnalyticsService
  Problem: OrderService knows all downstream processes

Observer Pattern (loose coupling):
  OrderService --emit("ordered")--> EventBus
                                      |
  EmailService      <--- subscribe ---+
  InventoryService  <--- subscribe ---+
  AnalyticsService  <--- subscribe ---+
  Benefit: OrderService does not know about downstream processes
```

1. **Loose Coupling**: The Subject does not know the concrete types of its Observers. It depends only on interfaces
2. **Open/Closed Principle**: Adding a new Observer requires no changes to the Subject's code
3. **Runtime Dynamic Configuration**: Observers can be freely registered and deregistered at runtime

---

## 2. Observer Structure

### 2.1 Class Diagram

```
+------------------+          +------------------+
|    Subject       |  1    *  |    Observer      |
|    (Publisher)   |--------->|   (Subscriber)   |
+------------------+          +------------------+
| - observers[]   |          | + update(data)   |
| + subscribe()   |          +------------------+
| + unsubscribe() |                  ^
| + notify()      |           _______|_______
+------------------+          |              |
                        +----------+  +----------+
                        |ObserverA |  |ObserverB |
                        +----------+  +----------+
```

### 2.2 Role of Each Component

| Component | Role | Responsibility |
|---------|------|------|
| Subject (Publisher) | Holds state and publishes notifications on change | Manages Observer registration/deregistration/notification |
| Observer (Subscriber) | Reacts to Subject changes | Receives notifications via update() and processes them |
| ConcreteSubject | A Subject with concrete state | Calls notify() when state changes |
| ConcreteObserver | Concrete reaction logic | Executes processing in response to update() |

### 2.3 Processing Sequence

```
Temporal processing flow:

Client          Subject              ObserverA       ObserverB
  |                |                    |               |
  |-- subscribe(A) -->|                 |               |
  |                |-- register ------->|               |
  |-- subscribe(B) -->|                 |               |
  |                |-- register --------------------------->|
  |                |                    |               |
  |-- setState() --->|                  |               |
  |                |-- notify() ------->|               |
  |                |   update(data)     |               |
  |                |-- notify() --------------------------->|
  |                |                    |   update(data)|
  |                |                    |               |
  |-- unsubscribe(A)->|                |               |
  |                |-- deregister ----->|               |
  |                |                    |               |
  |-- setState() --->|                  |               |
  |                |-- notify() --------------------------->|
  |                |                    |   update(data)|
  |                |   (A is not notified)              |
```

---

## 3. Push vs Pull

The Observer pattern has two notification models: Push and Pull.

```
Push: Subject directly passes changed data
Subject --notify(data)--> Observer
  Benefit: Observer can immediately get the needed data
  Drawback: Unnecessary data is also sent; inefficient for large data

Pull: Subject only notifies; Observer fetches data
Subject --notify()--> Observer --getState()--> Subject
  Benefit: Observer can fetch only the data it needs
  Drawback: Requires additional access to Subject; increases Subject's public interface

Hybrid: Notify event type; Observer fetches details
Subject --notify(eventType)--> Observer --getRelevantData()--> Subject
  Benefit: Best of both Push and Pull
  Drawback: Slightly more complex design
```

### Decision Criteria for Push vs Pull

| Criteria | Push | Pull |
|---------|---------|---------|
| Data is small and fixed | Appropriate | Excessive |
| Each Observer needs different data | Inefficient | Appropriate |
| Subject state changes frequently | Efficient (send only changed data) | Inefficient (fetch each time) |
| Many Observers | Send same data to each Observer | Each Observer fetches individually |
| Real-time responsiveness is critical | Appropriate (no delay) | Delay due to additional communication |

---

## 4. Code Examples

### Code Example 1: Type-Safe EventEmitter (TypeScript)

```typescript
// typed-event-emitter.ts — Type-safe Observer pattern in TypeScript

// Event map: defines event names and their data types
type EventMap = {
  userCreated: { id: string; name: string; email: string };
  userDeleted: { id: string; reason: string };
  userUpdated: { id: string; changes: Partial<{ name: string; email: string }> };
  orderPlaced: { orderId: string; userId: string; total: number };
};

class TypedEventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<Function>>();
  private onceListeners = new Map<keyof T, Set<Function>>();

  /**
   * Subscribe to an event
   * @returns unsubscribe function
   */
  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function (for cleanup)
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe only once
   */
  once<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(handler);

    return () => {
      this.onceListeners.get(event)?.delete(handler);
    };
  }

  /**
   * Emit an event
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    // Regular listeners
    this.listeners.get(event)?.forEach(fn => fn(data));

    // once listeners (deleted after execution)
    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      onceHandlers.forEach(fn => fn(data));
      onceHandlers.clear();
    }
  }

  /**
   * Remove all listeners for a specific event
   */
  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get listener count (for debugging/monitoring)
   */
  listenerCount<K extends keyof T>(event: K): number {
    return (this.listeners.get(event)?.size ?? 0) +
           (this.onceListeners.get(event)?.size ?? 0);
  }
}

// --- Usage example ---
const bus = new TypedEventEmitter<EventMap>();

// Type-safe: handler argument types are automatically inferred
const unsubUser = bus.on("userCreated", (user) => {
  console.log(`Welcome, ${user.name}! (${user.email})`);
  // user.id, user.name, user.email are type-safely accessible
});

bus.on("orderPlaced", (order) => {
  console.log(`Order ${order.orderId}: $${order.total}`);
});

// once: fires only for the first occurrence
bus.once("userCreated", (user) => {
  console.log(`First user bonus for ${user.name}!`);
});

bus.emit("userCreated", { id: "1", name: "Taro", email: "taro@example.com" });
// "Welcome, Taro! (taro@example.com)"
// "First user bonus for Taro!"

bus.emit("userCreated", { id: "2", name: "Hanako", email: "hanako@example.com" });
// "Welcome, Hanako! (hanako@example.com)"
// (once is not executed)

unsubUser(); // Unsubscribe

bus.emit("userCreated", { id: "3", name: "Jiro", email: "jiro@example.com" });
// (no output — already unsubscribed)
```

### Code Example 2: React — Custom Observable Hook

```typescript
// use-observable.ts — Hook for handling reactive data in React
import { useState, useEffect, useRef, useCallback } from 'react';

// Observable interface
interface Observable<T> {
  subscribe(observer: (value: T) => void): { unsubscribe: () => void };
  getValue(): T;
}

// SimpleObservable implementation
class SimpleObservable<T> implements Observable<T> {
  private observers = new Set<(value: T) => void>();
  private currentValue: T;

  constructor(initialValue: T) {
    this.currentValue = initialValue;
  }

  getValue(): T {
    return this.currentValue;
  }

  next(value: T): void {
    this.currentValue = value;
    this.observers.forEach(observer => observer(value));
  }

  subscribe(observer: (value: T) => void): { unsubscribe: () => void } {
    this.observers.add(observer);
    return {
      unsubscribe: () => this.observers.delete(observer),
    };
  }
}

// React Hook
function useObservable<T>(observable$: Observable<T>): T {
  const [value, setValue] = useState<T>(() => observable$.getValue());

  useEffect(() => {
    // Sync in case the value has changed
    setValue(observable$.getValue());

    const subscription = observable$.subscribe(setValue);
    return () => subscription.unsubscribe(); // Cleanup
  }, [observable$]);

  return value;
}

// Hook for combining multiple Observables
function useCombinedObservable<T extends Record<string, Observable<any>>>(
  observables: T
): { [K in keyof T]: T[K] extends Observable<infer U> ? U : never } {
  const keys = Object.keys(observables) as (keyof T)[];
  const [values, setValues] = useState(() => {
    const initial: any = {};
    keys.forEach(key => {
      initial[key] = observables[key].getValue();
    });
    return initial;
  });

  useEffect(() => {
    const subscriptions = keys.map(key =>
      observables[key].subscribe((val: any) => {
        setValues((prev: any) => ({ ...prev, [key]: val }));
      })
    );
    return () => subscriptions.forEach(sub => sub.unsubscribe());
  }, []);

  return values;
}

// --- Usage example ---
// Global Observable store
const priceStore = new SimpleObservable<number>(100);
const statusStore = new SimpleObservable<string>("idle");

function StockPrice({ symbol }: { symbol: string }) {
  const price = useObservable(priceStore);
  const status = useObservable(statusStore);

  return (
    <div>
      <span>{symbol}: ${price}</span>
      <span>Status: {status}</span>
    </div>
  );
}

// Update value from outside
priceStore.next(105); // All subscribed components automatically re-render
```

### Code Example 3: Node.js EventEmitter — Domain Events

```typescript
// order-service.ts — Domain events using Node.js EventEmitter
import { EventEmitter } from "events";

interface Order {
  id: string;
  userId: string;
  items: { productId: string; quantity: number; price: number }[];
  total: number;
  status: string;
}

// Domain service: order processing
class OrderService extends EventEmitter {
  private orders = new Map<string, Order>();

  async placeOrder(userId: string, items: Order["items"]): Promise<Order> {
    const order: Order = {
      id: `ORD-${Date.now()}`,
      userId,
      items,
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      status: "confirmed",
    };

    this.orders.set(order.id, order);

    // Emit domain event (OrderService does not know about downstream processes)
    this.emit("orderPlaced", order);
    return order;
  }

  async cancelOrder(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);

    order.status = "cancelled";
    this.emit("orderCancelled", order);
  }
}

// --- Register Observers (at application startup) ---
const orderService = new OrderService();

// Send email
orderService.on("orderPlaced", (order: Order) => {
  console.log(`[Email] Sending confirmation for order ${order.id}`);
  // emailService.sendConfirmation(order);
});

// Inventory management
orderService.on("orderPlaced", (order: Order) => {
  console.log(`[Inventory] Decrementing stock for ${order.items.length} items`);
  // order.items.forEach(item => inventoryService.decrement(item.productId, item.quantity));
});

// Analytics
orderService.on("orderPlaced", (order: Order) => {
  console.log(`[Analytics] Recording purchase: $${order.total}`);
  // analyticsService.trackPurchase(order);
});

// Handler for cancellations
orderService.on("orderCancelled", (order: Order) => {
  console.log(`[Email] Sending cancellation notice for ${order.id}`);
  console.log(`[Inventory] Restoring stock for ${order.items.length} items`);
});

// --- Usage example ---
orderService.placeOrder("user-1", [
  { productId: "p-1", quantity: 2, price: 1000 },
  { productId: "p-2", quantity: 1, price: 3000 },
]);
// [Email] Sending confirmation for order ORD-...
// [Inventory] Decrementing stock for 2 items
// [Analytics] Recording purchase: $5000
```

### Code Example 4: Python — Observer with WeakRef

```python
# event_bus.py — Observer pattern using WeakRef to prevent memory leaks
from __future__ import annotations
import weakref
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Event:
    """Base class for events"""
    timestamp: datetime
    source: str


@dataclass
class UserCreatedEvent(Event):
    user_id: str
    name: str
    email: str


@dataclass
class OrderPlacedEvent(Event):
    order_id: str
    user_id: str
    total: float


class EventBus:
    """WeakRef-compatible EventBus"""

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[weakref.ref]] = {}
        self._function_subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable) -> Callable[[], None]:
        """
        Subscribe to an event.
        If handler is a method, held via WeakRef
        and automatically deregistered when GC'd.
        """
        if hasattr(handler, '__self__'):
            # Bound method: hold via WeakRef
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []
            ref = weakref.ref(handler.__self__)
            method_name = handler.__func__.__name__
            self._subscribers[event_type].append(ref)
        else:
            # Regular function
            if event_type not in self._function_subscribers:
                self._function_subscribers[event_type] = []
            self._function_subscribers[event_type].append(handler)

        def unsubscribe() -> None:
            if event_type in self._function_subscribers:
                try:
                    self._function_subscribers[event_type].remove(handler)
                except ValueError:
                    pass

        return unsubscribe

    def publish(self, event_type: str, data: Any = None) -> None:
        """Emit an event"""
        # Regular function handlers
        for handler in self._function_subscribers.get(event_type, []):
            handler(data)

        # WeakRef handlers (remove GC'd ones)
        if event_type in self._subscribers:
            alive_refs = []
            for ref in self._subscribers[event_type]:
                obj = ref()
                if obj is not None:
                    alive_refs.append(ref)
                    # Call the handle method
                    if hasattr(obj, 'handle_event'):
                        obj.handle_event(event_type, data)
            self._subscribers[event_type] = alive_refs


# --- Usage example ---
bus = EventBus()


def on_user_created(event: UserCreatedEvent) -> None:
    print(f"[Handler] Welcome email sent to {event.email}")


unsub = bus.subscribe("user.created", on_user_created)

bus.publish("user.created", UserCreatedEvent(
    timestamp=datetime.now(),
    source="user-service",
    user_id="u-1",
    name="Taro",
    email="taro@example.com",
))
# [Handler] Welcome email sent to taro@example.com

unsub()  # Unsubscribe

bus.publish("user.created", UserCreatedEvent(
    timestamp=datetime.now(),
    source="user-service",
    user_id="u-2",
    name="Hanako",
    email="hanako@example.com",
))
# (no output)
```

### Code Example 5: Async Observer (Promise-based)

```typescript
// async-event-emitter.ts — Async Observer implementation
type AsyncHandler<T> = (data: T) => Promise<void> | void;

interface EmitOptions {
  /** Parallel or sequential execution */
  mode: 'parallel' | 'sequential';
  /** Timeout (ms) */
  timeout?: number;
  /** Whether to continue other handlers on error */
  continueOnError?: boolean;
}

class AsyncEventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<AsyncHandler<any>>>();

  on<K extends keyof T>(event: K, handler: AsyncHandler<T[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  /**
   * Parallel execution: run all handlers simultaneously
   * Use when order is not required but throughput should be maximized
   */
  async emitParallel<K extends keyof T>(
    event: K,
    data: T[K],
    options?: { timeout?: number; continueOnError?: boolean }
  ): Promise<{ successes: number; errors: Error[] }> {
    const handlers = this.listeners.get(event);
    if (!handlers) return { successes: 0, errors: [] };

    const errors: Error[] = [];
    let successes = 0;

    const promises = [...handlers].map(async (fn) => {
      try {
        const promise = fn(data);
        if (options?.timeout && promise instanceof Promise) {
          await Promise.race([
            promise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Handler timeout')), options.timeout)
            ),
          ]);
        } else {
          await promise;
        }
        successes++;
      } catch (error) {
        errors.push(error as Error);
        if (!options?.continueOnError) throw error;
      }
    });

    if (options?.continueOnError) {
      await Promise.allSettled(promises);
    } else {
      await Promise.all(promises);
    }

    return { successes, errors };
  }

  /**
   * Sequential execution: run handlers one by one in registration order
   * Use when order must be guaranteed
   */
  async emitSequential<K extends keyof T>(
    event: K,
    data: T[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const fn of handlers) {
      await fn(data);
    }
  }
}

// --- Usage example ---
type AppEvents = {
  orderPlaced: { orderId: string; total: number };
  paymentProcessed: { orderId: string; amount: number };
};

const emitter = new AsyncEventEmitter<AppEvents>();

emitter.on("orderPlaced", async (order) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log(`[Email] Sent for ${order.orderId}`);
});

emitter.on("orderPlaced", async (order) => {
  await new Promise(resolve => setTimeout(resolve, 50));
  console.log(`[Inventory] Updated for ${order.orderId}`);
});

// Parallel execution: all handlers start simultaneously, completes when the slowest finishes
const result = await emitter.emitParallel(
  "orderPlaced",
  { orderId: "ORD-1", total: 5000 },
  { timeout: 3000, continueOnError: true }
);
console.log(`Success: ${result.successes}, Errors: ${result.errors.length}`);

// Sequential execution: runs in order Email -> Inventory
await emitter.emitSequential("orderPlaced", { orderId: "ORD-2", total: 3000 });
```

### Code Example 6: AbortController Integration — Safe Subscription Management

```typescript
// abort-event-emitter.ts — Bulk deregistration via AbortController
class ManagedEventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<Function>>();

  on<K extends keyof T>(
    event: K,
    handler: (data: T[K]) => void,
    signal?: AbortSignal
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    const unsubscribe = () => {
      this.listeners.get(event)?.delete(handler);
    };

    // Integrate with AbortSignal: auto-deregister when signal is aborted
    if (signal) {
      signal.addEventListener('abort', unsubscribe, { once: true });
    }

    return unsubscribe;
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}

// --- Usage example: bulk management via component lifecycle ---
class DashboardComponent {
  private abortController = new AbortController();

  constructor(private emitter: ManagedEventEmitter<AppEvents>) {
    // Pass the AbortController's signal
    const signal = this.abortController.signal;

    emitter.on("orderPlaced", (order) => {
      console.log(`Dashboard: New order ${order.orderId}`);
    }, signal);

    emitter.on("paymentProcessed", (payment) => {
      console.log(`Dashboard: Payment ${payment.amount}`);
    }, signal);
  }

  destroy(): void {
    // Deregister all subscriptions at once
    this.abortController.abort();
    console.log("Dashboard: All subscriptions removed");
  }
}

const emitter = new ManagedEventEmitter<AppEvents>();
const dashboard = new DashboardComponent(emitter);

emitter.emit("orderPlaced", { orderId: "1", total: 100 });
// Dashboard: New order 1

dashboard.destroy();
// Dashboard: All subscriptions removed

emitter.emit("orderPlaced", { orderId: "2", total: 200 });
// (no output — all subscriptions removed)
```

### Code Example 7: Reactive Store (Redux-style Observer)

```typescript
// reactive-store.ts — State management with Observer pattern
type Reducer<S, A> = (state: S, action: A) => S;
type Listener = () => void;
type Middleware<S, A> = (store: Store<S, A>) =>
  (next: (action: A) => void) => (action: A) => void;

class Store<S, A extends { type: string }> {
  private state: S;
  private listeners = new Set<Listener>();
  private reducer: Reducer<S, A>;
  private dispatch: (action: A) => void;

  constructor(
    reducer: Reducer<S, A>,
    initialState: S,
    middlewares: Middleware<S, A>[] = []
  ) {
    this.reducer = reducer;
    this.state = initialState;

    // Build middleware chain
    let dispatch = (action: A) => {
      this.state = this.reducer(this.state, action);
      this.listeners.forEach(listener => listener()); // Notify all Observers
    };

    // Apply middlewares in reverse order
    for (let i = middlewares.length - 1; i >= 0; i--) {
      dispatch = middlewaresi(dispatch);
    }

    this.dispatch = dispatch;
  }

  getState(): S {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(action: A): void {
    this.dispatch(action);
  }
}

// --- Usage example: counter store ---
type CounterState = { count: number; history: number[] };
type CounterAction =
  | { type: 'INCREMENT'; amount: number }
  | { type: 'DECREMENT'; amount: number }
  | { type: 'RESET' };

const counterReducer: Reducer<CounterState, CounterAction> = (state, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return {
        count: state.count + action.amount,
        history: [...state.history, state.count + action.amount]
      };
    case 'DECREMENT':
      return {
        count: state.count - action.amount,
        history: [...state.history, state.count - action.amount]
      };
    case 'RESET':
      return { count: 0, history: [0] };
    default:
      return state;
  }
};

// Logging middleware
const logger: Middleware<CounterState, CounterAction> =
  (store) => (next) => (action) => {
    console.log(`[Logger] Action: ${action.type}, Before: ${store.getState().count}`);
    next(action);
    console.log(`[Logger] After: ${store.getState().count}`);
  };

const store = new Store(counterReducer, { count: 0, history: [0] }, [logger]);

// Register Observer (subscriber)
const unsub = store.subscribe(() => {
  console.log(`[UI] Count changed to: ${store.getState().count}`);
});

store.send({ type: 'INCREMENT', amount: 5 });
// [Logger] Action: INCREMENT, Before: 0
// [UI] Count changed to: 5
// [Logger] After: 5

store.send({ type: 'DECREMENT', amount: 2 });
// [Logger] Action: DECREMENT, Before: 5
// [UI] Count changed to: 3
// [Logger] After: 3

unsub(); // Unsubscribe UI

store.send({ type: 'RESET' });
// [Logger] Action: RESET, Before: 3
// [Logger] After: 0
// (UI is not notified)
```

---

## 5. Observer vs Pub/Sub vs Reactive Streams

```
Observer Pattern (direct reference)
  Subject <--------- Observer
    |  notify()  -->  |
    +---------------->+
  Characteristic: Subject and Observer know each other
  Use case: simple notifications, UI binding

Pub/Sub Pattern (with mediator)
  Publisher --> EventBus/Broker --> Subscriber
    publish()       |           subscribe()
                    |
  Characteristic: Fully decoupled (neither knows the other)
  Use case: inter-microservice communication, distributed systems

Reactive Streams (stream processing)
  Observable --pipe(operators)--> Observer
    |                                |
    + map, filter, debounce,         + subscribe
      merge, switchMap etc.
  Characteristic: Data transformation pipeline via operators
  Use case: complex event processing, real-time streams
```

---

## 6. Comparison Tables

### Comparison Table 1: Observer vs Pub/Sub vs Reactive Streams

| Aspect | Observer | Pub/Sub | Reactive (RxJS) |
|------|:---:|:---:|:---:|
| Coupling | Medium (knows Subject) | Low (via Bus) | Low (stream) |
| Async support | Manual | Manual/Built-in | Built-in |
| Backpressure | None | None | Available |
| Operators | None | None | Rich (200+) |
| Error handling | Manual | Manual | Built-in |
| Memory management | Manual unsubscribe | Manual unsubscribe | Automatic (complete) |
| Scale | Small to medium | Medium to large | Medium to large |
| Use case | Simple notifications | Microservices | Stream processing |

### Comparison Table 2: Synchronous vs Asynchronous Notification

| Aspect | Sync Notification | Async (Parallel) | Async (Sequential) |
|------|:---:|:---:|:---:|
| Implementation complexity | Low | Medium | Medium |
| Error handling | Easy (try/catch) | Requires design (Promise.allSettled) | Easy (for await) |
| Performance | Blocking | High throughput | Medium |
| Order guarantee | Naturally guaranteed | None | Available |
| Debugging | Easy | Difficult | Medium |
| Timeout | Not needed | Recommended | Recommended |

### Comparison Table 3: Observer Implementations in Frameworks

| Framework | Mechanism | Unsubscribe | Type Safety |
|--------------|----------|---------|---------|
| Node.js EventEmitter | on/emit | removeListener | Low |
| DOM EventTarget | addEventListener | removeEventListener | Medium |
| React (useState) | setState + re-render | Automatic | High |
| Vue (Reactive) | Proxy-based | Automatic | High |
| RxJS | Observable.subscribe | unsubscribe | High |
| Redux | store.subscribe | Return value function | High |
| Angular (Signals) | signal/effect | Automatic | High |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Memory Leak (Forgetting to Unsubscribe)

```typescript
// BAD: listener remains after component is destroyed
class BadComponent {
  constructor(private emitter: EventEmitter) {
    // Registers but does not unsubscribe!
    emitter.on("data", this.handleData);
  }

  handleData = (data: any) => {
    this.element.textContent = data; // Accessing a destroyed element -> error
  };

  destroy(): void {
    // Forgot to unsubscribe handleData
    this.element.remove();
  }
}

// GOOD: reliably unsubscribe (multiple approaches)
class GoodComponent {
  private unsubscribers: (() => void)[] = [];

  constructor(private emitter: TypedEventEmitter<AppEvents>) {
    // Method 1: retain unsubscribe functions
    this.unsubscribers.push(
      emitter.on("orderPlaced", this.handleOrder)
    );
    this.unsubscribers.push(
      emitter.on("paymentProcessed", this.handlePayment)
    );
  }

  handleOrder = (order: any) => { /* ... */ };
  handlePayment = (payment: any) => { /* ... */ };

  destroy(): void {
    // Deregister all subscriptions at once
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.element.remove();
  }
}

// GOOD: correct cleanup in React
function GoodReactComponent() {
  useEffect(() => {
    const unsub = emitter.on("data", handleData);
    return () => unsub(); // Reliably unsubscribed in useEffect cleanup
  }, []);
}

// GOOD: bulk management via AbortController
class BetterComponent {
  private controller = new AbortController();

  constructor(private emitter: ManagedEventEmitter<AppEvents>) {
    const signal = this.controller.signal;
    emitter.on("orderPlaced", this.handleOrder, signal);
    emitter.on("paymentProcessed", this.handlePayment, signal);
  }

  handleOrder = (order: any) => { /* ... */ };
  handlePayment = (payment: any) => { /* ... */ };

  destroy(): void {
    this.controller.abort(); // Deregister all subscriptions at once
  }
}
```

### Anti-Pattern 2: Infinite Loop from Event Chains

```typescript
// BAD: change to A notifies B -> change to B notifies A -> ...
const emitter = new TypedEventEmitter<{
  priceChanged: { price: number };
  taxChanged: { tax: number };
}>();

emitter.on("priceChanged", ({ price }) => {
  const newTax = price * 0.1;
  emitter.emit("taxChanged", { tax: newTax }); // emits taxChanged
});

emitter.on("taxChanged", ({ tax }) => {
  const newPrice = tax / 0.1;
  emitter.emit("priceChanged", { price: newPrice }); // re-emits priceChanged!
  // -> infinite loop
});

// GOOD: EventEmitter with circular detection guard
class SafeEventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<Function>>();
  private emitting = new Set<keyof T>(); // currently emitting events

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    if (this.emitting.has(event)) {
      console.warn(`[SafeEmitter] Circular emit detected for "${String(event)}". Skipping.`);
      return; // Prevent circular emission
    }

    this.emitting.add(event);
    try {
      this.listeners.get(event)?.forEach(fn => fn(data));
    } finally {
      this.emitting.delete(event);
    }
  }
}
```

### Anti-Pattern 3: God Observer (One Observer Handles Everything)

```typescript
// BAD: one massive handler processes all events
class GodObserver {
  handle(eventType: string, data: any): void {
    switch (eventType) {
      case "userCreated":
        this.sendWelcomeEmail(data);
        this.createDefaultSettings(data);
        this.notifyAdmin(data);
        break;
      case "orderPlaced":
        this.sendConfirmation(data);
        this.updateInventory(data);
        this.processPayment(data);
        break;
      // ... dozens of event types
    }
  }
}

// GOOD: separate Observers by responsibility
class EmailObserver {
  constructor(private emitter: EventEmitter) {
    emitter.on("userCreated", this.sendWelcome);
    emitter.on("orderPlaced", this.sendConfirmation);
    emitter.on("orderCancelled", this.sendCancellation);
  }

  private sendWelcome = (data: any) => { /* email sending only */ };
  private sendConfirmation = (data: any) => { /* email sending only */ };
  private sendCancellation = (data: any) => { /* email sending only */ };
}

class InventoryObserver {
  constructor(private emitter: EventEmitter) {
    emitter.on("orderPlaced", this.decrementStock);
    emitter.on("orderCancelled", this.restoreStock);
  }

  private decrementStock = (data: any) => { /* inventory management only */ };
  private restoreStock = (data: any) => { /* inventory management only */ };
}
```

---

## 8. Observer Pattern in the Real World

### 8.1 Browser DOM Events

```
DOM event propagation (Observer pattern implementation):

     [window]          Capture Phase (top to bottom)
        |
     [document]
        |
     [body]
        |
     [div.parent]
        |
     [button]    <---- Target Phase
        |
     [div.parent]
        |
     [body]            Bubble Phase (bottom to top)
        |
     [document]
        |
     [window]

addEventListener(event, handler, { capture: true/false })
  capture: true  → executes in Capture Phase
  capture: false → executes in Bubble Phase (default)
```

### 8.2 React's Reactive System

```
React state update flow:

  setState(newValue)
      |
      v
  [Reconciler] -- diff calculation (Virtual DOM diff)
      |
      v
  [Commit Phase] -- DOM update
      |
      v
  useEffect cleanup  → useEffect callback
  (clean previous side effects)   (execute new side effects)

  Essence: useState is the Observer pattern
  - setState = Subject.notify()
  - Component re-render = Observer.update()
```

### 8.3 Event-Driven Architecture in Microservices

```
Event-Driven Architecture:

  Order Service --publish("order.created")--> Message Broker (Kafka/RabbitMQ)
                                                    |
  Email Service       <--- subscribe("order.*") ----+
  Inventory Service   <--- subscribe("order.*") ----+
  Analytics Service   <--- subscribe("order.*") ----+
  Payment Service     <--- subscribe("order.created")+

  Benefits:
  - Complete loose coupling between services
  - Independent deployment and scaling
  - Prevents fault propagation
  - Events can be persisted and replayed
```

---

## 9. Practical Exercises

### Exercise 1: Basic — Implement a Type-Safe EventEmitter

**Task**: Implement a type-safe EventEmitter that satisfies the following requirements.

1. `on(event, handler)`: subscribes to an event and returns an unsubscribe function
2. `once(event, handler)`: subscribes only once
3. `emit(event, data)`: emits an event
4. `listenerCount(event)`: returns the number of listeners
5. Event names and data types are linked type-safely via generics

**Test Cases**:

```typescript
type Events = {
  message: { text: string; from: string };
  error: { code: number; message: string };
};

const emitter = new TypedEventEmitter<Events>();

const unsub = emitter.on("message", (msg) => {
  console.log(`${msg.from}: ${msg.text}`);
});

emitter.once("error", (err) => {
  console.log(`Error ${err.code}: ${err.message}`);
});

emitter.emit("message", { text: "Hello", from: "Alice" });
// "Alice: Hello"

console.log(emitter.listenerCount("message")); // 1
console.log(emitter.listenerCount("error"));   // 1

emitter.emit("error", { code: 404, message: "Not Found" });
// "Error 404: Not Found"

console.log(emitter.listenerCount("error"));   // 0 (once has been consumed)

unsub();
console.log(emitter.listenerCount("message")); // 0
```

**Expected Output**: As indicated in the comments above.

<details>
<summary>Reference Answer (click to expand)</summary>

```typescript
class TypedEventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<Function>>();
  private onceListeners = new Map<keyof T, Set<Function>>();

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  once<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(handler);
    return () => {
      this.onceListeners.get(event)?.delete(handler);
    };
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(data));

    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      onceHandlers.forEach(fn => fn(data));
      onceHandlers.clear();
    }
  }

  listenerCount<K extends keyof T>(event: K): number {
    return (this.listeners.get(event)?.size ?? 0) +
           (this.onceListeners.get(event)?.size ?? 0);
  }

  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }
}
```

**Design Points:**
- Manage `on` and `once` in separate Maps; `once` is cleared on emit
- Each method returns an unsubscribe function, making cleanup easy
- `listenerCount` sums the sizes of both Maps

</details>

---

### Exercise 2: Applied — Implement a Reactive Store

**Task**: Implement a Redux-style reactive Store using the Observer pattern.

Requirements:
1. `Store<S, A>` class: manages state with a Reducer
2. `getState()`: returns current state
3. `dispatch(action)`: dispatches an action and notifies all Observers
4. `subscribe(listener)`: subscribes to state changes
5. `select(selector)`: watches only part of the state and notifies only on changes

**Test Cases**:

```typescript
type State = { count: number; name: string };
type Action =
  | { type: 'INCREMENT' }
  | { type: 'SET_NAME'; name: string };

const store = new Store<State, Action>(
  (state, action) => {
    switch (action.type) {
      case 'INCREMENT': return { ...state, count: state.count + 1 };
      case 'SET_NAME': return { ...state, name: action.name };
      default: return state;
    }
  },
  { count: 0, name: "initial" }
);

// Watch only count
const unsubCount = store.select(
  s => s.count,
  (count) => console.log(`Count: ${count}`)
);

store.dispatch({ type: 'SET_NAME', name: 'Taro' });
// (count has not changed, so no output)

store.dispatch({ type: 'INCREMENT' });
// "Count: 1"

unsubCount();
```

**Expected Output**: As indicated in the comments above.

<details>
<summary>Reference Answer (click to expand)</summary>

```typescript
type Reducer<S, A> = (state: S, action: A) => S;
type Listener = () => void;
type Selector<S, R> = (state: S) => R;

class Store<S, A extends { type: string }> {
  private state: S;
  private listeners = new Set<Listener>();
  private reducer: Reducer<S, A>;

  constructor(reducer: Reducer<S, A>, initialState: S) {
    this.reducer = reducer;
    this.state = initialState;
  }

  getState(): S {
    return this.state;
  }

  dispatch(action: A): void {
    this.state = this.reducer(this.state, action);
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Watch part of the state and call callback only when it changes.
   * Notifies only when the result differs from the previous selected value.
   */
  select<R>(selector: Selector<S, R>, callback: (value: R) => void): () => void {
    let previousValue = selector(this.state);

    return this.subscribe(() => {
      const currentValue = selector(this.state);
      if (currentValue !== previousValue) {
        previousValue = currentValue;
        callback(currentValue);
      }
    });
  }
}
```

**Design Points:**
- `select` internally uses `subscribe` and calls the callback only when the selector result changes
- Comparison with previous value uses `!==` (reference equality), handling both primitives and object references
- `dispatch` generates new state via the Reducer, then notifies all Observers

</details>

---

### Exercise 3: Advanced — Async Event Bus with Retry

**Task**: Implement an EventBus that supports async handlers and has retry functionality on failure.

Requirements:
1. `on(event, handler)`: register an async handler
2. `emit(event, data, options)`: emit an event (selectable parallel/sequential)
3. Retry: retry failed handlers up to 3 times with exponential backoff
4. Dead Letter Queue: record events that fail all retries
5. Timeout: set a time limit for each handler

**Test Cases**:

```typescript
const bus = new ResilientEventBus();

let callCount = 0;
bus.on("process", async (data: { id: string }) => {
  callCount++;
  if (callCount < 3) {
    throw new Error("Temporary failure");
  }
  console.log(`Processed: ${data.id}`);
});

await bus.emit("process", { id: "item-1" }, {
  mode: 'sequential',
  retry: { maxAttempts: 3, backoffMs: 100 },
  timeoutMs: 5000,
});
// 1st attempt: fails (wait 100ms)
// 2nd attempt: fails (wait 200ms)
// 3rd attempt: "Processed: item-1"

console.log(bus.getDeadLetterQueue().length); // 0 (succeeded)
```

**Expected Output**: As indicated in the comments above.

<details>
<summary>Reference Answer (click to expand)</summary>

```typescript
type AsyncHandler<T> = (data: T) => Promise<void> | void;

interface RetryOptions {
  maxAttempts: number;
  backoffMs: number;
}

interface EmitOptions {
  mode: 'parallel' | 'sequential';
  retry?: RetryOptions;
  timeoutMs?: number;
}

interface DeadLetterEntry {
  event: string;
  data: any;
  error: Error;
  timestamp: Date;
  attempts: number;
}

class ResilientEventBus {
  private listeners = new Map<string, Set<AsyncHandler<any>>>();
  private deadLetterQueue: DeadLetterEntry[] = [];

  on<T>(event: string, handler: AsyncHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  async emit<T>(event: string, data: T, options: EmitOptions): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const wrappedHandlers = [...handlers].map(fn =>
      () => this.executeWithRetry(fn, data, event, options)
    );

    if (options.mode === 'parallel') {
      await Promise.allSettled(wrappedHandlers.map(fn => fn()));
    } else {
      for (const fn of wrappedHandlers) {
        await fn();
      }
    }
  }

  private async executeWithRetry<T>(
    handler: AsyncHandler<T>,
    data: T,
    event: string,
    options: EmitOptions,
  ): Promise<void> {
    const maxAttempts = options.retry?.maxAttempts ?? 1;
    const backoffMs = options.retry?.backoffMs ?? 100;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const promise = handler(data);
        if (options.timeoutMs && promise instanceof Promise) {
          await Promise.race([
            promise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Handler timeout')), options.timeoutMs)
            ),
          ]);
        } else {
          await promise;
        }
        return; // Success
      } catch (error) {
        if (attempt < maxAttempts) {
          // Wait with exponential backoff
          const delay = backoffMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // All retries failed -> record in Dead Letter Queue
          this.deadLetterQueue.push({
            event,
            data,
            error: error as Error,
            timestamp: new Date(),
            attempts: maxAttempts,
          });
        }
      }
    }
  }

  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }
}
```

**Design Points:**
- `executeWithRetry` implements exponential backoff (`backoffMs * 2^(attempt-1)`)
- Timeout races the handler's Promise against a timeout Promise using `Promise.race`
- Events that fail all retries are recorded in the Dead Letter Queue for later investigation
- In `parallel` mode, `Promise.allSettled` is used so one failure does not affect other handlers

</details>

---

## 10. FAQ

### Q1: In which languages/frameworks is the Observer pattern used?

It is used in virtually all UI/event-driven frameworks: DOM EventListener, Node.js EventEmitter, Vue.js reactive system, RxJS Observable, Android LiveData/Flow, React useState/useEffect, Redux store.subscribe, Angular Signals, Swift Combine framework, and more. It is impossible to do modern frontend/backend development without knowing the Observer pattern.

### Q2: Does having too many Observers affect performance?

Yes. When notifications are synchronous, blocking time increases proportionally to the number of Observers. Countermeasures: (1) switch to asynchronous notifications, (2) batch processing (combining multiple updates into one, like React's automatic batching), (3) debounce/throttle (reducing high-frequency notifications), (4) selector-based subscriptions (notify only the parts that changed).

### Q3: What is the relationship between Redux and the Observer pattern?

Redux's `store.subscribe()` is the Observer pattern itself. When an action is dispatched, the state changes and subscribed components are notified. React-Redux's `useSelector` is an optimized Observer that re-renders only when the selector result changes.

### Q4: How do I decide between EventEmitter and Promise/async-await?

Promise is appropriate for one-time async operations (API calls, file reads). EventEmitter is appropriate for repeatedly occurring events (clicks, message reception, state changes). If you need characteristics of both, consider AsyncIterator or RxJS Observable.

### Q5: When is a WeakRef-based Observer effective?

WeakRef is effective when the Observer's lifecycle is unclear. For example, in a plugin system where plugins are dynamically loaded and unloaded, using WeakRef allows subscriptions to be automatically deregistered when the plugin is GC'd. However, since GC timing is non-deterministic, prefer explicit unsubscription when possible.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## 11. Summary

| Item | Key Point |
|------|---------|
| Purpose | One-to-many state change notification. Loosely coupled event-driven design |
| Push | Passes data directly (simple, optimal when data is small) |
| Pull | Observer fetches data (flexible, when each Observer needs different data) |
| Unsubscribe | **Essential** to prevent memory leaks. AbortController is convenient for bulk management |
| Async notifications | Choose between parallel (high throughput) and sequential (order guaranteed) |
| Preventing circular calls | Use an emitting guard to prevent recursive emission of the same event |
| Evolution | Pub/Sub (fully decoupled), Reactive Streams (with operators) |

---

## Guides to Read Next

- [Strategy Pattern](./01-strategy.md) -- Algorithm switching
- [Command Pattern](./02-command.md) -- Encapsulating operations and Undo/Redo
- [State Pattern](./03-state.md) -- Managing state transitions
- [Event-Driven Architecture](../../../system-design-guide/docs/02-architecture/03-event-driven.md) -- Observer in microservices
- [Monad Pattern](../03-functional/00-monad.md) -- Theoretical foundation of Promise/async-await

---

## References

1. Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley. -- The original source of the Observer pattern.
2. ReactiveX Documentation. https://reactivex.io/ -- Comprehensive reference for reactive programming.
3. Node.js Events Documentation. https://nodejs.org/api/events.html -- Official documentation for Node.js EventEmitter.
4. Redux Documentation. https://redux.js.org/ -- State management library based on the Observer pattern.
5. MDN Web Docs -- EventTarget. https://developer.mozilla.org/en-US/docs/Web/API/EventTarget -- Browser event system.
