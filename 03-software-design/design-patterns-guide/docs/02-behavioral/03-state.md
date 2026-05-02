# State Pattern

> A behavioral pattern that dynamically switches behavior based on an object's internal state, enabling type-safe implementation of finite state machines (FSM)

---

## What You Will Learn in This Chapter

1. **Basic structure of the State pattern and GoF's intent** -- The principles of separating behavior into per-state classes to prevent conditional branch explosion
2. **Type-safe implementation of finite state machines (FSM)** -- Translating state transition diagrams into code and preventing invalid transitions at compile time
3. **Declarative FSM and hierarchical state machines** -- XState-style configuration-based FSM, managing complexity with parent-child states
4. **Applying to real products** -- Practical examples in e-commerce order management, UI components, form validation, and game AI
5. **Combining the State pattern with other patterns** -- Integration with Strategy, Command, and Observer, and when to use each

---

## Prerequisites

| Topic | Required Understanding | Reference Link |
|---------|-----------|-----------|
| TypeScript interface and class | Interface implementation, generics, type guards | 02-programming |
| SOLID principles (especially OCP & SRP) | Open-Closed Principle, Single Responsibility Principle | clean-code-principles |
| Strategy pattern | Basic concept of switching algorithms | [01-strategy.md](./01-strategy.md) |
| Observer pattern | Notification of state changes | [00-observer.md](./00-observer.md) |
| Command pattern | Encapsulating operations, Undo/Redo | [02-command.md](./02-command.md) |

---

## Why the State Pattern Is Needed

### The if/else Explosion Problem

Consider the requirement to "perform different processing based on order status" in an order management system.

```
Problems with the if/else approach:

class Order {
  status: string = 'pending';

  pay(): void {
    if (this.status === 'pending') {
      // Payment processing...
      this.status = 'paid';
    } else if (this.status === 'paid') {
      throw new Error('Already paid');
    } else if (this.status === 'shipped') {
      throw new Error('Cannot pay after shipping');
    } else if (this.status === 'delivered') {
      throw new Error('Cannot pay after delivery');
    } else if (this.status === 'cancelled') {
      throw new Error('Order is cancelled');
    }
  }

  ship(): void {
    if (this.status === 'pending') {
      throw new Error('Must pay first');
    } else if (this.status === 'paid') {
      // Shipping processing...
      this.status = 'shipped';
    } else if (...) { ... }
    // The same pattern repeats...
  }

  deliver(): void { /* Same pattern */ }
  cancel(): void { /* Same pattern */ }
  refund(): void { /* Same pattern */ }
}

Problems:
  ┌──────────────────────────────────────────────────┐
  │ 5 states × 5 methods = 25 branches               │
  │                                                  │
  │ Adding a new state "returned":                    │
  │   → All 5 methods must be modified (OCP violation)│
  │   → Missed modifications → runtime errors        │
  │   → Test cases grow exponentially                 │
  └──────────────────────────────────────────────────┘
```

### Solution with the State Pattern

```
State pattern solution:

  ┌──────────────┐         ┌──────────────────┐
  │   Context    │────────►│   State (abstract)│
  │ OrderContext │         │                  │
  │              │         │ + pay()          │
  │ - state ─────┤         │ + ship()         │
  │ + pay()      │         │ + deliver()      │
  │ + ship()     │         │ + cancel()       │
  │ + deliver()  │         └────────┬─────────┘
  │ + cancel()   │                  │
  └──────────────┘            ┌─────┴──────┐
                              │            │
                     ┌────────┴──┐  ┌──────┴────────┐
                     │ Pending   │  │ Paid          │
                     │ State     │  │ State         │
                     │           │  │               │
                     │ pay() →   │  │ ship() →      │
                     │  PaidState│  │  ShippedState  │
                     │ cancel()→ │  │ cancel() →    │
                     │  Cancelled│  │  Cancelled     │
                     └───────────┘  └───────────────┘
                     ...same for other states

  Benefits:
  ✓ Each state's behavior is consolidated in one class (SRP)
  ✓ Adding a new state only requires adding a new class (OCP)
  ✓ Invalid transitions simply throw exceptions within their state class
  ✓ Each state class can be tested independently
```

GoF definition:

> "Allow an object to alter its behavior when its internal state changes. The object will appear to change its class."
>
> -- Design Patterns: Elements of Reusable Object-Oriented Software (1994)

The essence of the State pattern is **"converting conditional branches into polymorphism"**. The conditional branch `if (status === 'pending')` is expressed by the very existence of the `PendingState` class. This consolidates each state's behavior and allows adding new states without affecting existing code.

---

## 1. Structure of the State Pattern

```
State pattern components (GoF):

  ┌──────────────────┐         ┌──────────────────┐
  │    Context        │────────►│   State (abstract)│
  │                   │         │                  │
  │ - currentState    │         │ + handle(ctx)    │
  │ + request()       │         │                  │
  │ + setState(s)     │         └────────┬─────────┘
  └──────────────────┘                   │
                                    ┌────┴──────┐
                               ┌────┴───┐  ┌───┴────────┐
                               │State A │  │ State B    │
                               │        │  │            │
                               │handle()│  │ handle()   │
                               │→ A's   │  │ → B's      │
                               │behavior│  │  behavior  │
                               │→ trans.│  │ → trans.   │
                               │  to B  │  │  to C      │
                               └────────┘  └────────────┘

  Context.request() delegates to currentState.handle(this)
  Inside handle(), context.setState(new NextState()) is called

  ★ Difference from Strategy pattern:
    Strategy: The client switches the strategy from outside
    State:    The state object itself transitions to the next state

  Direction of transitions:
    Strategy: Client → Context.setStrategy(new X())
    State:    StateA.handle() → context.setState(new StateB())
              (the state decides its own next state)
```

---

## 2. Basic Implementation -- Order Status Management

### Code Example 1: GoF-style State Pattern

```typescript
// order-state.ts -- Order state management

// ============================
// State interface
// ============================
interface OrderState {
  readonly name: string;
  pay(context: OrderContext): void;
  ship(context: OrderContext): void;
  deliver(context: OrderContext): void;
  cancel(context: OrderContext): void;
}

// ============================
// Context: Order
// ============================
class OrderContext {
  private state: OrderState;
  private history: { state: string; timestamp: Date; action: string }[] = [];

  constructor(
    public readonly orderId: string,
    initialState: OrderState = new PendingState()
  ) {
    this.state = initialState;
    this.recordTransition('init');
  }

  setState(state: OrderState, action: string = 'transition'): void {
    const from = this.state.name;
    this.state = state;
    this.recordTransition(action);
    console.log(`[${this.orderId}] ${from} → ${state.name} (${action})`);
  }

  getStateName(): string {
    return this.state.name;
  }

  getHistory(): Array<{ state: string; timestamp: Date; action: string }> {
    return [...this.history];
  }

  private recordTransition(action: string): void {
    this.history.push({
      state: this.state.name,
      timestamp: new Date(),
      action,
    });
  }

  // Delegate operations to the state
  pay(): void { this.state.pay(this); }
  ship(): void { this.state.ship(this); }
  deliver(): void { this.state.deliver(this); }
  cancel(): void { this.state.cancel(this); }
}

// ============================
// Concrete State: Pending (unpaid)
// ============================
class PendingState implements OrderState {
  readonly name = 'pending';

  pay(context: OrderContext): void {
    console.log('Processing payment...');
    context.setState(new PaidState(), 'pay');
  }

  ship(_context: OrderContext): void {
    throw new Error('Cannot ship an unpaid order');
  }

  deliver(_context: OrderContext): void {
    throw new Error('Cannot mark an unpaid order as delivered');
  }

  cancel(context: OrderContext): void {
    console.log('Order has been cancelled');
    context.setState(new CancelledState(), 'cancel');
  }
}

// ============================
// Concrete State: Paid
// ============================
class PaidState implements OrderState {
  readonly name = 'paid';

  pay(_context: OrderContext): void {
    throw new Error('Already paid');
  }

  ship(context: OrderContext): void {
    console.log('Processing shipment...');
    context.setState(new ShippedState(), 'ship');
  }

  deliver(_context: OrderContext): void {
    throw new Error('Cannot mark as delivered before shipping');
  }

  cancel(context: OrderContext): void {
    console.log('Processing refund...');
    context.setState(new CancelledState(), 'cancel');
  }
}

// ============================
// Concrete State: Shipped
// ============================
class ShippedState implements OrderState {
  readonly name = 'shipped';

  pay(_context: OrderContext): void {
    throw new Error('Cannot process payment for a shipped order');
  }

  ship(_context: OrderContext): void {
    throw new Error('Already shipped');
  }

  deliver(context: OrderContext): void {
    console.log('Recording delivery completion...');
    context.setState(new DeliveredState(), 'deliver');
  }

  cancel(_context: OrderContext): void {
    throw new Error('Cannot cancel a shipped order (please use the return process)');
  }
}

// ============================
// Concrete State: Delivered (terminal state)
// ============================
class DeliveredState implements OrderState {
  readonly name = 'delivered';

  pay(): void { throw new Error('Cannot process payment for a delivered order'); }
  ship(): void { throw new Error('Cannot ship a delivered order'); }
  deliver(): void { throw new Error('Already delivered'); }
  cancel(): void { throw new Error('Cannot cancel a delivered order'); }
}

// ============================
// Concrete State: Cancelled (terminal state)
// ============================
class CancelledState implements OrderState {
  readonly name = 'cancelled';

  pay(): void { throw new Error('Cannot process payment for a cancelled order'); }
  ship(): void { throw new Error('Cannot ship a cancelled order'); }
  deliver(): void { throw new Error('Cannot mark a cancelled order as delivered'); }
  cancel(): void { throw new Error('Already cancelled'); }
}

// ============================
// Usage example
// ============================
const order = new OrderContext('ORD-001');
console.log(order.getStateName()); // "pending"

order.pay();
// Processing payment...
// [ORD-001] pending → paid (pay)

order.ship();
// Processing shipment...
// [ORD-001] paid → shipped (ship)

order.deliver();
// Recording delivery completion...
// [ORD-001] shipped → delivered (deliver)

try {
  order.cancel(); // Error because already delivered
} catch (e) {
  console.log(e.message); // "Cannot cancel a delivered order"
}

console.log(order.getHistory());
// [
//   { state: 'pending', action: 'init', ... },
//   { state: 'paid', action: 'pay', ... },
//   { state: 'shipped', action: 'ship', ... },
//   { state: 'delivered', action: 'deliver', ... },
// ]
```

```
Order state transition diagram:

  ┌─────────┐   PAY    ┌─────────┐   SHIP   ┌──────────┐
  │ pending │────────►│  paid   │────────►│ shipped  │
  └────┬────┘         └────┬────┘         └─────┬────┘
       │                   │                     │
       │ CANCEL            │ CANCEL              │ DELIVER
       │                   │                     │
       ▼                   ▼                     ▼
  ┌──────────┐       ┌──────────┐        ┌───────────┐
  │cancelled │       │cancelled │        │ delivered │
  └──────────┘       └──────────┘        └───────────┘

  * delivered and cancelled are terminal states (no further transitions)
  * shipped → cancel is not allowed (a separate return process is required)
```

---

## 3. Type-Safe FSM (Finite State Machine)

### Code Example 2: Constraining Transitions with TypeScript's Type System

```typescript
// typed-fsm.ts -- FSM that constrains transitions with types

// ============================
// Type definitions for states and events
// ============================
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
type OrderEvent = 'PAY' | 'SHIP' | 'DELIVER' | 'CANCEL';

// ============================
// Define allowed transitions at the type level
// ============================
type TransitionMap = {
  pending:   { PAY: 'paid'; CANCEL: 'cancelled' };
  paid:      { SHIP: 'shipped'; CANCEL: 'cancelled' };
  shipped:   { DELIVER: 'delivered' };
  delivered: {};  // Terminal state: no transitions
  cancelled: {};  // Terminal state: no transitions
};

// ============================
// Type of the type-safe transition function
// ============================
// This causes non-existent transitions to produce compile-time errors
type ValidEvent<S extends OrderStatus> = keyof TransitionMap[S];
type NextState<S extends OrderStatus, E extends ValidEvent<S>> =
  TransitionMap[S][E];

// ============================
// FSM class (type-safe version)
// ============================
const STATE_TRANSITIONS: Record<
  OrderStatus,
  Partial<Record<OrderEvent, OrderStatus>>
> = {
  pending:   { PAY: 'paid', CANCEL: 'cancelled' },
  paid:      { SHIP: 'shipped', CANCEL: 'cancelled' },
  shipped:   { DELIVER: 'delivered' },
  delivered: {},
  cancelled: {},
};

class TypedStateMachine<S extends OrderStatus> {
  constructor(private currentState: S) {}

  getState(): S {
    return this.currentState;
  }

  /**
   * Type-safe transition
   * - Only accepts allowed events as arguments
   * - Return type is correctly inferred as the next state
   */
  transition<E extends ValidEvent<S>>(
    event: E
  ): TypedStateMachine<NextState<S, E> & OrderStatus> {
    const transitions = STATE_TRANSITIONS[this.currentState];
    const nextState = transitions[event as string as OrderEvent];

    if (!nextState) {
      throw new Error(
        `Invalid transition: ${this.currentState} + ${String(event)}`
      );
    }

    return new TypedStateMachine(
      nextState as NextState<S, E> & OrderStatus
    );
  }
}

// ============================
// Usage example: detecting invalid transitions at compile time
// ============================
const machine = new TypedStateMachine('pending' as const);

const paid = machine.transition('PAY');       // OK: pending → paid
const shipped = paid.transition('SHIP');      // OK: paid → shipped
const delivered = shipped.transition('DELIVER'); // OK: shipped → delivered

// The following are compile errors!
// machine.transition('SHIP');    // Error: 'SHIP' is not allowed in pending
// machine.transition('DELIVER'); // Error: 'DELIVER' is not allowed in pending
// paid.transition('DELIVER');    // Error: 'DELIVER' is not allowed in paid
// delivered.transition('PAY');   // Error: delivered is a terminal state (no transitions)

// Type inference verification
type PaidMachine = typeof paid;    // TypedStateMachine<'paid'>
type ShippedMachine = typeof shipped; // TypedStateMachine<'shipped'>
```

The key to this implementation is **defining the transition table at the type level**. The `TransitionMap` type declares, for each state, the events that can be fired and their target states as types. Non-existent transitions (e.g., `DELIVER` from `pending`) are caught as type errors at compile time.

---

## 4. Declarative FSM (XState-style)

### Code Example 3: FSM Defined with a Configuration Object

```typescript
// declarative-fsm.ts -- Configuration-based FSM

// ============================
// FSM configuration types
// ============================
interface TransitionConfig<TContext> {
  target: string;
  guard?: (context: TContext) => boolean;
  action?: (context: TContext) => void;
}

interface StateConfig<TContext> {
  on?: Record<string, TransitionConfig<TContext>>;
  entry?: (context: TContext) => void;
  exit?: (context: TContext) => void;
}

interface MachineConfig<TContext> {
  id: string;
  initial: string;
  context: TContext;
  states: Record<string, StateConfig<TContext>>;
}

// ============================
// FSM engine
// ============================
type FSMEvent =
  | { type: 'transition'; from: string; to: string; event: string }
  | { type: 'guard-blocked'; from: string; event: string };

class FSM<TContext> {
  private currentState: string;
  private context: TContext;
  private config: MachineConfig<TContext>;
  private listeners: Array<(event: FSMEvent) => void> = [];

  constructor(config: MachineConfig<TContext>) {
    this.config = config;
    this.currentState = config.initial;
    this.context = { ...config.context };

    // Execute the entry action for the initial state
    this.config.states[this.currentState]?.entry?.(this.context);
  }

  /** Send an event to attempt a transition */
  send(event: string): boolean {
    const stateConfig = this.config.states[this.currentState];
    const transition = stateConfig?.on?.[event];

    if (!transition) {
      console.warn(
        `No transition for event "${event}" in state "${this.currentState}"`
      );
      return false;
    }

    // Check guard conditions
    if (transition.guard && !transition.guard(this.context)) {
      this.notify({
        type: 'guard-blocked',
        from: this.currentState,
        event,
      });
      return false;
    }

    const from = this.currentState;

    // Execute in order: exit → action → entry
    stateConfig?.exit?.(this.context);
    transition.action?.(this.context);

    this.currentState = transition.target;
    this.config.states[this.currentState]?.entry?.(this.context);

    this.notify({ type: 'transition', from, to: this.currentState, event });
    return true;
  }

  getState(): string {
    return this.currentState;
  }

  getContext(): TContext {
    return { ...this.context };
  }

  /** List of events allowed in the current state */
  allowedEvents(): string[] {
    const stateConfig = this.config.states[this.currentState];
    return stateConfig?.on ? Object.keys(stateConfig.on) : [];
  }

  subscribe(listener: (event: FSMEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(event: FSMEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

// ============================
// Usage example: traffic light
// ============================
const trafficLight = new FSM({
  id: 'traffic-light',
  initial: 'red',
  context: { cycleCount: 0 },
  states: {
    red: {
      entry: (ctx) => console.log(`Red light (cycle: ${ctx.cycleCount})`),
      on: {
        TIMER: {
          target: 'green',
          action: (ctx) => { ctx.cycleCount++; },
        },
      },
    },
    green: {
      entry: () => console.log('Green light'),
      on: {
        TIMER: { target: 'yellow' },
      },
    },
    yellow: {
      entry: () => console.log('Yellow light'),
      on: {
        TIMER: { target: 'red' },
      },
    },
  },
});

trafficLight.send('TIMER'); // Red light (cycle: 0) → Green light
trafficLight.send('TIMER'); // Green light → Yellow light
trafficLight.send('TIMER'); // Yellow light → Red light (cycle: 1)
console.log(trafficLight.getContext()); // { cycleCount: 1 }
```

---

## 5. Practical Example: Form Validation State

### Code Example 4: State Management for a Complex Form

```typescript
// form-state.ts -- Form state management

// ============================
// Form context
// ============================
interface FormContext {
  data: Record<string, string>;
  errors: Record<string, string>;
  submitCount: number;
  lastSubmitAt: Date | null;
}

// ============================
// Form FSM
// ============================
const formMachine = new FSM<FormContext>({
  id: 'form',
  initial: 'idle',
  context: {
    data: {},
    errors: {},
    submitCount: 0,
    lastSubmitAt: null,
  },
  states: {
    idle: {
      entry: () => console.log('[Form] Idle - waiting for input'),
      on: {
        CHANGE: {
          target: 'editing',
          action: () => console.log('[Form] Input started'),
        },
      },
    },
    editing: {
      on: {
        CHANGE: {
          target: 'editing',
        },
        SUBMIT: {
          target: 'validating',
          action: (ctx) => { ctx.submitCount++; },
        },
        RESET: {
          target: 'idle',
          action: (ctx) => {
            ctx.data = {};
            ctx.errors = {};
          },
        },
      },
    },
    validating: {
      entry: (ctx) => {
        console.log('[Form] Running validation...');
        ctx.errors = {};
        // Apply validation rules
        if (!ctx.data.email?.includes('@')) {
          ctx.errors.email = 'Invalid email address format';
        }
        if (!ctx.data.name || ctx.data.name.length < 2) {
          ctx.errors.name = 'Name must be at least 2 characters';
        }
      },
      on: {
        VALID: {
          target: 'submitting',
          guard: (ctx) => Object.keys(ctx.errors).length === 0,
        },
        INVALID: {
          target: 'editing',
        },
      },
    },
    submitting: {
      entry: () => console.log('[Form] Submitting...'),
      on: {
        SUCCESS: {
          target: 'success',
          action: (ctx) => { ctx.lastSubmitAt = new Date(); },
        },
        FAILURE: {
          target: 'error',
        },
      },
    },
    success: {
      entry: () => console.log('[Form] Submission successful!'),
      on: {
        RESET: {
          target: 'idle',
          action: (ctx) => {
            ctx.data = {};
            ctx.errors = {};
          },
        },
      },
    },
    error: {
      entry: () => console.log('[Form] Submission error'),
      on: {
        RETRY: {
          target: 'submitting',
          guard: (ctx) => ctx.submitCount < 3,
        },
        RESET: {
          target: 'idle',
          action: (ctx) => {
            ctx.data = {};
            ctx.errors = {};
          },
        },
      },
    },
  },
});

// Usage example
formMachine.send('CHANGE');      // idle → editing
formMachine.send('SUBMIT');      // editing → validating
// If there are validation errors:
formMachine.send('INVALID');     // validating → editing
```

```
Form state transition diagram:

  ┌──────┐  CHANGE  ┌─────────┐  SUBMIT  ┌────────────┐
  │ idle │────────►│ editing │────────►│ validating │
  └──────┘         └────┬────┘         └──┬─────┬───┘
       ▲                │                  │     │
       │ RESET          │ RESET    INVALID │     │ VALID
       │                │                  │     │  (guard: errors=0)
       ├────────────────┘◄─────────────────┘     │
       │                                         ▼
       │            ┌─────────┐ FAILURE ┌────────────┐
       │ RESET      │  error  │◄────────│ submitting │
       ├────────────┤         │         └─────┬──────┘
       │            │ RETRY → │               │
       │            │(guard:  │               │ SUCCESS
       │            │ cnt<3)  │               │
       │            └─────────┘               ▼
       │                              ┌───────────┐
       └──────────────────────────────│  success  │
                      RESET           └───────────┘
```

---

## 6. State Pattern in Python

### Code Example 5: State Pattern with Python ABC and Decorators

```python
# state_python.py -- State pattern implementation in Python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Callable


# ============================
# State pattern for a vending machine
# ============================

class VendingState(ABC):
    """Vending machine state interface"""

    @abstractmethod
    def insert_coin(self, machine: VendingMachine, amount: int) -> None: ...

    @abstractmethod
    def select_product(self, machine: VendingMachine, product: str) -> None: ...

    @abstractmethod
    def dispense(self, machine: VendingMachine) -> None: ...

    @abstractmethod
    def cancel(self, machine: VendingMachine) -> None: ...

    @property
    @abstractmethod
    def name(self) -> str: ...


class IdleState(VendingState):
    """Idle state: waiting for coin insertion"""

    @property
    def name(self) -> str:
        return "idle"

    def insert_coin(self, machine: VendingMachine, amount: int) -> None:
        machine.balance += amount
        print(f"Inserted: {amount} yen (balance: {machine.balance} yen)")
        machine.set_state(HasMoneyState())

    def select_product(self, machine: VendingMachine, product: str) -> None:
        print("Please insert a coin first")

    def dispense(self, machine: VendingMachine) -> None:
        print("Please insert a coin and select a product first")

    def cancel(self, machine: VendingMachine) -> None:
        print("There is nothing to cancel")


class HasMoneyState(VendingState):
    """Coin inserted: waiting for product selection"""

    @property
    def name(self) -> str:
        return "has_money"

    def insert_coin(self, machine: VendingMachine, amount: int) -> None:
        machine.balance += amount
        print(f"Additional coin: {amount} yen (balance: {machine.balance} yen)")

    def select_product(self, machine: VendingMachine, product: str) -> None:
        price = machine.get_price(product)
        if price is None:
            print(f"Product '{product}' does not exist")
            return
        if machine.balance < price:
            print(f"Insufficient balance: {machine.balance} yen < {price} yen")
            return
        if not machine.has_stock(product):
            print(f"'{product}' is out of stock")
            return

        machine.selected_product = product
        machine.balance -= price
        print(f"Selected '{product}' (price: {price} yen, balance: {machine.balance} yen)")
        machine.set_state(DispensingState())

    def dispense(self, machine: VendingMachine) -> None:
        print("Please select a product first")

    def cancel(self, machine: VendingMachine) -> None:
        print(f"Refund: {machine.balance} yen")
        machine.balance = 0
        machine.set_state(IdleState())


class DispensingState(VendingState):
    """Dispensing product"""

    @property
    def name(self) -> str:
        return "dispensing"

    def insert_coin(self, machine: VendingMachine, amount: int) -> None:
        print("Dispensing product. Please wait")

    def select_product(self, machine: VendingMachine, product: str) -> None:
        print("Dispensing product. Please wait")

    def dispense(self, machine: VendingMachine) -> None:
        product = machine.selected_product
        machine.reduce_stock(product)
        print(f"Dispensed '{product}'")
        machine.selected_product = None

        if machine.balance > 0:
            machine.set_state(HasMoneyState())
        else:
            machine.set_state(IdleState())

    def cancel(self, machine: VendingMachine) -> None:
        print("Cannot cancel while dispensing")


# ============================
# Context: Vending machine
# ============================
@dataclass
class VendingMachine:
    products: dict[str, dict] = field(default_factory=lambda: {
        "Cola": {"price": 120, "stock": 5},
        "Tea": {"price": 100, "stock": 3},
        "Coffee": {"price": 150, "stock": 0},  # Out of stock
    })
    balance: int = 0
    selected_product: str | None = None
    _state: VendingState = field(default_factory=IdleState)
    _history: list[str] = field(default_factory=list)

    def set_state(self, state: VendingState) -> None:
        old = self._state.name
        self._state = state
        self._history.append(f"{old} → {state.name}")

    def get_price(self, product: str) -> int | None:
        info = self.products.get(product)
        return info["price"] if info else None

    def has_stock(self, product: str) -> bool:
        info = self.products.get(product)
        return info is not None and info["stock"] > 0

    def reduce_stock(self, product: str) -> None:
        if product in self.products:
            self.products[product]["stock"] -= 1

    # Delegate operations to the state
    def insert_coin(self, amount: int) -> None:
        self._state.insert_coin(self, amount)

    def select_product(self, product: str) -> None:
        self._state.select_product(self, product)

    def dispense(self) -> None:
        self._state.dispense(self)

    def cancel(self) -> None:
        self._state.cancel(self)


# ============================
# Usage example
# ============================
if __name__ == "__main__":
    vm = VendingMachine()

    vm.insert_coin(100)    # Inserted: 100 yen
    vm.insert_coin(50)     # Additional coin: 50 yen (balance: 150 yen)
    vm.select_product("Cola")  # Selected 'Cola' (price: 120 yen, balance: 30 yen)
    vm.dispense()          # Dispensed 'Cola'

    print(f"State: {vm._state.name}")  # idle (balance 0) or has_money (balance remaining)
    print(f"Balance: {vm.balance} yen")  # 30 yen

    vm.select_product("Tea")  # Please insert a coin first... wait
    # Actually should be has_money state (30 yen remaining)

    print(f"Transition history: {vm._history}")
```

---

## 7. Hierarchical State Machine (HSM)

### Code Example 6: Managing Complexity with Parent-Child States

```typescript
// hierarchical-state.ts -- Hierarchical state machine

// ============================
// HSM structure
// ============================
// In a hierarchical state machine, states can be organized in parent-child relationships
// Events that cannot be handled by a child state are delegated to the parent state

interface HierarchicalState {
  readonly name: string;
  readonly parent?: HierarchicalState;
  handle(event: string, context: any): HierarchicalState | null;
  entry?(context: any): void;
  exit?(context: any): void;
}

class HSMEngine {
  private currentState: HierarchicalState;

  constructor(
    private initialState: HierarchicalState,
    private context: any
  ) {
    this.currentState = initialState;
    this.enterState(initialState);
  }

  send(event: string): void {
    let state: HierarchicalState | undefined = this.currentState;

    // Search for a handler from the current state up to parents
    while (state) {
      const nextState = state.handle(event, this.context);
      if (nextState !== null) {
        this.transitionTo(nextState);
        return;
      }
      state = state.parent;
    }

    console.warn(`Unhandled event "${event}" in state "${this.currentState.name}"`);
  }

  private transitionTo(target: HierarchicalState): void {
    // Find common ancestor and execute exit/entry in the correct order
    const exitStates = this.getAncestors(this.currentState);
    const enterStates = this.getAncestors(target);

    // Skip states above the common ancestor
    const common = this.findCommonAncestor(exitStates, enterStates);

    // exit: from current state up to the common ancestor
    for (const s of exitStates) {
      if (s === common) break;
      s.exit?.(this.context);
    }

    // entry: from the common ancestor down to the target
    const toEnter = [];
    for (const s of enterStates) {
      if (s === common) break;
      toEnter.unshift(s);
    }
    for (const s of toEnter) {
      this.enterState(s);
    }

    this.currentState = target;
  }

  private enterState(state: HierarchicalState): void {
    state.entry?.(this.context);
  }

  private getAncestors(state: HierarchicalState): HierarchicalState[] {
    const ancestors: HierarchicalState[] = [state];
    let current = state.parent;
    while (current) {
      ancestors.push(current);
      current = current.parent;
    }
    return ancestors;
  }

  private findCommonAncestor(
    a: HierarchicalState[],
    b: HierarchicalState[]
  ): HierarchicalState | undefined {
    const setB = new Set(b);
    return a.find(s => setB.has(s));
  }

  getState(): string {
    return this.currentState.name;
  }
}

// ============================
// Usage example: media player
// ============================
// Hierarchy:
//   Root
//   ├── Stopped
//   └── Playing (parent state)
//       ├── NormalSpeed
//       └── FastForward

const stoppedState: HierarchicalState = {
  name: 'stopped',
  handle(event) {
    if (event === 'PLAY') return normalSpeedState;
    return null;
  },
  entry() { console.log('[Stopped] Stopped'); },
};

const playingState: HierarchicalState = {
  name: 'playing',
  handle(event) {
    // Handle events not processed by child states here
    if (event === 'STOP') return stoppedState;
    return null;
  },
  entry() { console.log('[Playing] Playback started'); },
  exit() { console.log('[Playing] Playback ended'); },
};

const normalSpeedState: HierarchicalState = {
  name: 'playing.normal',
  parent: playingState,
  handle(event) {
    if (event === 'FAST_FORWARD') return fastForwardState;
    return null; // Delegate to parent (playing)
  },
  entry() { console.log('[Normal] Normal speed'); },
};

const fastForwardState: HierarchicalState = {
  name: 'playing.fastForward',
  parent: playingState,
  handle(event) {
    if (event === 'NORMAL') return normalSpeedState;
    return null; // Delegate to parent (playing)
  },
  entry() { console.log('[FastForward] Fast forward'); },
};

// Usage example
const player = new HSMEngine(stoppedState, {});
// [Stopped] Stopped

player.send('PLAY');
// [Playing] Playback started
// [Normal] Normal speed

player.send('FAST_FORWARD');
// [FastForward] Fast forward

player.send('STOP');
// ★ fastForward itself cannot handle STOP, so
//    it delegates to the parent playing → transitions to stoppedState
// [Playing] Playback ended
// [Stopped] Stopped
```

```
Hierarchical state machine structure:

  ┌─────────────────────────────────────────┐
  │                Root                      │
  │                                          │
  │  ┌──────────┐    ┌─────────────────────┐ │
  │  │ Stopped  │    │     Playing         │ │
  │  │          │◄───┤                     │ │
  │  │          │STOP│  ┌───────┐ ┌──────┐ │ │
  │  │          │    │  │Normal │ │Fast  │ │ │
  │  │          │────►  │ Speed │→│Fwd   │ │ │
  │  │          │PLAY│  │       │←│      │ │ │
  │  │          │    │  └───────┘ └──────┘ │ │
  │  └──────────┘    └─────────────────────┘ │
  │                                          │
  └──────────────────────────────────────────┘

  Event delegation flow:
    When STOP is received in FastForward:
    1. FastForward.handle('STOP') → null (cannot handle)
    2. Playing.handle('STOP') → stoppedState (parent handles it)
```

---

## 8. State Pattern in React

### Code Example 7: UI State Management with useReducer + State Pattern

```typescript
// react-state-pattern.tsx -- Using the State pattern in React

// ============================
// UI state definitions
// ============================
type ModalState =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'open'; data: any }
  | { status: 'error'; message: string; retryCount: number }
  | { status: 'confirming'; data: any; message: string };

type ModalAction =
  | { type: 'OPEN' }
  | { type: 'LOADED'; data: any }
  | { type: 'ERROR'; message: string }
  | { type: 'CONFIRM'; message: string }
  | { type: 'CONFIRM_YES' }
  | { type: 'CONFIRM_NO' }
  | { type: 'CLOSE' }
  | { type: 'RETRY' };

// ============================
// Expressing the State pattern as a Reducer
// ============================
function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (state.status) {
    case 'closed':
      switch (action.type) {
        case 'OPEN': return { status: 'loading' };
        default: return state;
      }

    case 'loading':
      switch (action.type) {
        case 'LOADED': return { status: 'open', data: action.data };
        case 'ERROR': return { status: 'error', message: action.message, retryCount: 0 };
        case 'CLOSE': return { status: 'closed' };
        default: return state;
      }

    case 'open':
      switch (action.type) {
        case 'CLOSE': return { status: 'closed' };
        case 'CONFIRM': return {
          status: 'confirming',
          data: state.data,
          message: action.message,
        };
        default: return state;
      }

    case 'error':
      switch (action.type) {
        case 'RETRY':
          if (state.retryCount >= 3) return state; // Guard condition
          return { status: 'loading' };
        case 'CLOSE': return { status: 'closed' };
        default: return state;
      }

    case 'confirming':
      switch (action.type) {
        case 'CONFIRM_YES': return { status: 'closed' }; // Close after confirmation
        case 'CONFIRM_NO': return { status: 'open', data: state.data };
        default: return state;
      }

    default:
      return state;
  }
}

// ============================
// Usage in a React component
// ============================
/*
function ModalComponent() {
  const [state, dispatch] = useReducer(modalReducer, { status: 'closed' });

  // Render UI based on state
  switch (state.status) {
    case 'closed':
      return <button onClick={() => dispatch({ type: 'OPEN' })}>Open</button>;

    case 'loading':
      return <div>Loading...</div>;

    case 'open':
      return (
        <div>
          <pre>{JSON.stringify(state.data)}</pre>
          <button onClick={() => dispatch({ type: 'CLOSE' })}>Close</button>
          <button onClick={() => dispatch({
            type: 'CONFIRM',
            message: 'Are you sure you want to delete?',
          })}>
            Delete
          </button>
        </div>
      );

    case 'error':
      return (
        <div>
          <p>Error: {state.message}</p>
          {state.retryCount < 3 && (
            <button onClick={() => dispatch({ type: 'RETRY' })}>
              Retry ({state.retryCount}/3)
            </button>
          )}
          <button onClick={() => dispatch({ type: 'CLOSE' })}>Close</button>
        </div>
      );

    case 'confirming':
      return (
        <div>
          <p>{state.message}</p>
          <button onClick={() => dispatch({ type: 'CONFIRM_YES' })}>Yes</button>
          <button onClick={() => dispatch({ type: 'CONFIRM_NO' })}>No</button>
        </div>
      );
  }
}
*/
```

React's `useReducer` is the State pattern itself. The `status` field of the state corresponds to "which State class", and `switch (state.status)` corresponds to "behavior branching per state". Discriminated unions ensure that the properties available in each state are type-safely restricted.

---

## 9. Deep Dive: Design Decisions for the State Pattern

### Where to Place Transition Responsibility

```
Approach 1: Transitions inside State (GoF recommendation)
  Each State class directly knows the next state
  PaidState.ship() → context.setState(new ShippedState())

  Pros: Each state is autonomous, decentralized control
  Cons: Coupling between states, the overall transition picture is hard to see

Approach 2: Centralized management via Context / transition table
  All transitions are defined in an external table
  transitions['paid']['SHIP'] = 'shipped'

  Pros: Overall transitions are clear, easy to change
  Cons: Table grows large, guard conditions are verbose to express

Approach 3: Hybrid
  Simple transitions use the table, complex transitions use methods
  Transitions with guard conditions use methods, simple ones use the table
```

### State Object Creation Strategy

```
Approach 1: Create a new instance each time
  context.setState(new PaidState());
  Pros: Can hold state-specific data
  Cons: GC pressure

Approach 2: Singleton / shared instance
  context.setState(PaidState.INSTANCE);
  Pros: Memory efficient
  Cons: Cannot hold data in the state

Approach 3: Flyweight + external data
  State is shared, data is held in Context
  Pros: Memory efficient + data holding
  Cons: Implementation is slightly more complex

  Decision criteria: Is there state-specific data?
  Yes → Approach 1
  No  → Approach 2 (recommended)
```

---

## 10. Comparison Table

### State vs Other Patterns

| Characteristic | State Pattern | Strategy Pattern | if/else Branching |
|------|--------------|-----------------|-------------|
| Behavior switching | Automatic based on internal state | Explicitly injected from outside | Determined by conditional branches |
| Transition management | State class knows the next state | No concept of transitions | Scattered throughout code |
| Who drives transitions | State itself decides the transition | Client switches | None |
| OCP (adding new states) | Just add a new class | Just add a new strategy | Modify all conditions |
| Testability | Independent test per state | Independent test per strategy | Hard to cover all paths |
| Complexity | Medium (proportional to number of states) | Low | Proportional to the square of number of states |

### FSM Library Comparison

| Characteristic | XState | Robot | Zustand + custom FSM | Custom implementation |
|------|--------|-------|--------------------|---------|
| Type safety | High (greatly improved in v5) | High | Medium | Depends on implementation |
| Visualization | Inspector / Visualizer | None | None | None |
| Hierarchical states | Supported | Not supported | Not supported | Requires implementation |
| Parallel states | Supported | Not supported | Not supported | Requires implementation |
| Bundle size | ~40KB | ~1KB | ~3KB + custom | 0 |
| Learning cost | High | Low | Medium | Low |
| Track record | Many large-scale products | Medium scale | Many | -- |

### Deciding When to Introduce the State Pattern

| Decision Criteria | State Pattern Is Effective | if/else Is Sufficient |
|---------|---------------------|---------------|
| Number of states | 3 or more | 2 or fewer |
| State-dependent methods | 2 or more | 1 |
| Adding new states | Likely to happen frequently | Nearly fixed |
| Transition rules | Complex (with guard conditions) | Simple |
| Testing requirements | Independent tests per state needed | Coverage testing is enough |

---

## 11. Anti-patterns

### Anti-pattern 1: Giant switch/if-else chains

```typescript
// ============================
// [BAD] Per-state branching scattered across all methods
// ============================
class Order {
  status: string = 'pending';

  pay(): void {
    if (this.status === 'pending') {
      this.status = 'paid';
    } else if (this.status === 'paid') {
      throw new Error('Already paid');
    } else if (this.status === 'shipped') {
      throw new Error('Cannot pay after shipping');
    } else if (this.status === 'delivered') {
      throw new Error('Cannot pay after delivery');
    } else if (this.status === 'cancelled') {
      throw new Error('Order is cancelled');
    }
    // Adding new state "returned" → add branch here
  }

  ship(): void {
    if (this.status === 'paid') { /* ... */ }
    else if (this.status === 'pending') { throw new Error('Must pay first'); }
    else if (this.status === 'shipped') { throw new Error('Already shipped'); }
    // ... same pattern repeats
    // Adding new state "returned" → add branch here too
  }

  // deliver(), cancel() follow the same pattern...
  // 5 states x 4 methods = 20 conditional branches!!
}

// ============================
// [GOOD] Separate into per-state classes using the State pattern
// ============================
// → Each state's behavior is consolidated in one class, improving maintainability
// → Adding a new state only requires adding a new class
// → No modification to existing code required (OCP compliant)
// (See Code Example 1 above for the implementation)
```

### Anti-pattern 2: Implicit side effects in transitions

```typescript
// ============================
// [BAD] Side effects of transitions hidden inside the State
// ============================
class PaidStateNG implements OrderState {
  readonly name = 'paid';

  ship(context: OrderContext): void {
    // ★ A large number of side effects are executed implicitly on every transition
    sendEmail(context.orderId, 'Your order has been shipped!');
    updateInventory(context.orderId);
    notifyWarehouse(context.orderId);
    logToAnalytics('order_shipped', context.orderId);
    context.setState(new ShippedState(), 'ship');
    // What side effects run is completely invisible from the outside
  }
  // ...
}

// ============================
// [GOOD] Explicitly define side effects as transition actions/middleware
// ============================
// Method 1: Declare declaratively as FSM actions
const orderFSM = new FSM<OrderContext>({
  id: 'order',
  initial: 'pending',
  context: { orderId: '', items: [] },
  states: {
    paid: {
      on: {
        SHIP: {
          target: 'shipped',
          action: (ctx) => {
            // Side effects are explicitly defined
            emailService.send(ctx.orderId, 'shipped');
            inventoryService.update(ctx.orderId);
            warehouseService.notify(ctx.orderId);
          },
        },
      },
    },
    // ...
  },
});

// Method 2: Combine with Observer pattern
// Notify state transitions as events,
// and handle side effects on the listener side
class OrderContextWithEvents extends OrderContext {
  private listeners: Array<(event: { from: string; to: string }) => void> = [];

  override setState(state: OrderState, action: string): void {
    const from = this.getStateName();
    super.setState(state, action);
    // Notify event after transition
    for (const listener of this.listeners) {
      listener({ from, to: state.name });
    }
  }

  onTransition(listener: (event: { from: string; to: string }) => void): void {
    this.listeners.push(listener);
  }
}

// Register side effects as listeners (can be replaced with mocks during testing)
const order2 = new OrderContextWithEvents('ORD-002');
order2.onTransition(({ from, to }) => {
  if (from === 'paid' && to === 'shipped') {
    emailService.send(order2.orderId, 'shipped');
    inventoryService.update(order2.orderId);
  }
});
```

### Anti-pattern 3: Confusing state with data

```typescript
// ============================
// [BAD] Representing "state" with a combination of flags
// ============================
class FormNG {
  isSubmitting: boolean = false;
  isValidating: boolean = false;
  hasError: boolean = false;
  isSuccess: boolean = false;

  submit(): void {
    if (this.isSubmitting) return;
    if (this.isValidating) return;
    // What does isSubmitting && hasError mean?
    // Flag combinations: 2^4 = 16 possibilities
    // Only some are valid states, but invalid combinations cannot be prevented
  }
}

// ============================
// [GOOD] Use Discriminated Union to represent only valid states
// ============================
type FormState =
  | { status: 'idle' }
  | { status: 'editing'; data: Record<string, string> }
  | { status: 'validating'; data: Record<string, string> }
  | { status: 'submitting'; data: Record<string, string> }
  | { status: 'success'; submittedAt: Date }
  | { status: 'error'; message: string; retryCount: number };

// Invalid state combinations do not exist at the type level
// Accessing data when status === 'idle' → type error
function handleForm(state: FormState): void {
  switch (state.status) {
    case 'error':
      console.log(state.message);      // OK: message only exists in error state
      console.log(state.retryCount);   // OK
      break;
    case 'idle':
      // console.log(state.message);   // Type error! idle has no message
      break;
  }
}
```

---

## 12. Exercises

### Exercise 1 (Basic): ATM State Management

Implement an ATM State pattern that satisfies the following specification.

**Specification:**
- States: `idle` (waiting) → `cardInserted` (card inserted) → `pinVerified` (PIN verified) → `transacting` (in transaction) → `idle`
- Operations: `insertCard()`, `enterPin(pin)`, `selectTransaction(type)`, `ejectCard()`
- If the PIN is entered incorrectly 3 times, the card is locked (`locked` state)

**Expected output:**
```
atm.insertCard('1234-5678')
→ [ATM] idle → cardInserted
atm.enterPin('0000')  // Wrong
→ "Incorrect PIN (2 attempts remaining)"
atm.enterPin('1234')  // Correct
→ [ATM] cardInserted → pinVerified
atm.selectTransaction('withdraw')
→ [ATM] pinVerified → transacting
atm.ejectCard()
→ [ATM] transacting → idle
```

---

### Exercise 2 (Intermediate): WebSocket Connection FSM

Implement a WebSocket connection state FSM that satisfies the following specification.

**Specification:**
- States: `disconnected`, `connecting`, `connected`, `reconnecting`, `error`
- Events: `CONNECT`, `CONNECTED`, `DISCONNECT`, `ERROR`, `RETRY`
- Guard condition: `reconnecting` → `connecting` only allowed when retry count is 5 or fewer
- Auto-reconnect: automatic RETRY after 3 seconds in `error` state

**Expected output:**
```
ws.send('CONNECT')    → disconnected → connecting
ws.send('CONNECTED')  → connecting → connected
ws.send('ERROR')      → connected → error → (after 3s) → reconnecting → connecting
ws.send('CONNECTED')  → connecting → connected
// After 5 or more failed retries:
ws.send('ERROR')      → "Maximum retry count reached"
```

---

### Exercise 3 (Advanced): Game AI Behavior State Machine

Implement a hierarchical state machine for an enemy character AI that satisfies the following specification.

**Specification:**
- Parent states: `alive`, `dead`
- Child states of `alive`: `idle`, `patrol`, `chase`, `attack`
- Transition conditions:
  - `idle` → `patrol`: after a certain amount of time has passed
  - `patrol` → `chase`: player detected (distance < 100)
  - `chase` → `attack`: within attack range (distance < 20)
  - `chase` → `patrol`: player lost (distance > 150)
  - `attack` → `chase`: player escapes outside attack range
  - `alive.*` → `dead`: HP <= 0

**Expected output:**
```
enemy.update({ playerDistance: 200, hp: 100 })
→ [idle] Idling...
enemy.update({ playerDistance: 80, hp: 100 })
→ [idle → chase] Player detected! Starting pursuit
enemy.update({ playerDistance: 15, hp: 100 })
→ [chase → attack] Within attack range! Starting attack
enemy.update({ playerDistance: 15, hp: 0 })
→ [attack → dead] HP reached 0 (common handling in alive child state)
```

---

## 13. FAQ

### Q1: What is the difference between the State pattern and the Strategy pattern?

The structure (UML diagram) is nearly identical, but they differ fundamentally in **intent and whether transitions exist**.

| Comparison | State | Strategy |
|---------|-------|----------|
| Intent | Behavior changes based on internal state | Algorithm is injected from outside |
| Transitions | State itself transitions to the next state | No concept of transitions |
| Who switches | The State object itself | The Client (external) |
| Typical example | Order lifecycle management | Choosing a sorting algorithm |

Decision criteria: "Is the behavior switching automatic or manual?" If behavior changes automatically based on internal conditions regardless of user action, use State. If an algorithm is explicitly selected from the outside, use Strategy.

### Q2: What should I do when there are many states?

If there are 10 or more states, consider the following.

1. **Hierarchical State Machine (HSM)**: Consolidate common behavior in parent states. XState has native support.
2. **Parallel state machines**: Separate independent concerns into separate FSMs running in parallel. For example: "connection state" and "authentication state" as separate FSMs.
3. **State decomposition**: Check whether one "state" is actually a combination of two independent concepts. For example: `loadingAuthenticated` can be decomposed into `loading` x `authenticated`.

### Q3: From what scale should I introduce the State pattern?

It is worth considering when there are **3 or more states** and **2 or more methods whose behavior differs by state**. If there are only 2 states and only 1-2 branching points, a simple if statement will be more readable.

Decision formula:
```
Modification cost = number of files/methods to modify when adding a new state
  if/else approach: modification cost = number of methods × 1
  State approach:   modification cost = 1 (only adding a new class)

If modification cost > 3, introducing the State pattern is worthwhile
```

### Q4: Should I use XState or a custom implementation?

Decision criteria:

| Requirement | XState | Custom implementation |
|------|--------|---------|
| Hierarchical states needed | XState | Hard to implement |
| Visualization needed | XState (Inspector) | Requires separate development |
| Bundle size constraints | Custom (~0KB) | -- |
| Parallel states needed | XState | Very hard to implement |
| Simple FSM (5 or fewer states) | Custom | -- |
| Everyone on the team knows XState | XState | -- |

### Q5: What is the relationship between the State pattern and state management libraries (Redux, Zustand)?

Redux and Zustand are libraries that manage "the entire application's state", while the State pattern manages "switching an object's behavior". The two are not mutually exclusive and are commonly **used together**. For example: hold the order status (`pending`, `paid`, ...) in the Redux store, while managing the behavior for each status (allowed operations, UI display content) in a State pattern reducer. React's `useReducer` is a typical implementation of the State pattern.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|------|
| Essence of the State pattern | Convert conditional branching into polymorphism. Prevent if/else explosion |
| Context | Holds the current state and delegates operations to state objects |
| Transition responsibility | The State itself decides the next state (the decisive difference from Strategy) |
| Type-safe FSM | Constrain transitions with TypeScript's type system. Detect invalid transitions at compile time |
| Declarative FSM | Define state transitions in a configuration object. Easy to visualize and test |
| Hierarchical State Machine (HSM) | Organize states in parent-child relationships. Aggregate common processing via event delegation |
| Integration with React | useReducer + Discriminated Union is an implementation of the State pattern |
| Adoption decision | Consider when there are 3+ states & 2+ state-dependent methods |

---

## Guides to Read Next

- [02-command.md](./02-command.md) -- Command pattern and Undo/Redo (stateful operation management with Command + State)
- [01-strategy.md](./01-strategy.md) -- Strategy pattern (structural similarities with State and differences in intent)
- [04-iterator.md](./04-iterator.md) -- Iterator pattern and generators
- [00-observer.md](./00-observer.md) -- Observer pattern (used for notifying State transitions)
- Event Sourcing / CQRS -- Recording state changes as events

---

## References

1. **Design Patterns: Elements of Reusable Object-Oriented Software** -- Gamma, Helm, Johnson, Vlissides (GoF, 1994) -- The original source for the State pattern. Chapter 5, pp.305-313
2. **XState Documentation** -- https://xstate.js.org/docs/ -- Official documentation for the declarative state machine library
3. **Statecharts: A Visual Formalism for Complex Systems** -- David Harel (1987) -- Theoretical foundation of hierarchical state machines. Academic roots of the State pattern
4. **Refactoring.Guru - State** -- https://refactoring.guru/design-patterns/state -- Illustrated examples and multi-language implementations
5. **Ian Horrocks - Constructing the User Interface with Statecharts** -- Addison-Wesley (1999) -- Practical guide for state machines in UI design
