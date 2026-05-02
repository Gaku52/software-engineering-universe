# Event Sourcing / CQRS — Event-Driven Design

> A practical guide to recording state changes as an immutable event log with Event Sourcing, and separating reads from writes with CQRS to maximize auditability, scalability, and domain expressiveness. Covers event store design, projections, snapshot optimization, and incremental adoption strategies.

---

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| TypeScript / JavaScript | Intermediate (generics, async/await, discriminated union) | [02-programming](../../../../02-programming/) |
| Relational DB basics | Basics (INSERT, SELECT, transactions) | [06-data-and-security](../../../../06-data-and-security/) |
| Repository pattern | Basics | [01-repository-pattern.md](./01-repository-pattern.md) |
| DDD fundamentals | Basics (aggregates, domain events) | ../../clean-code-principles/ |
| Message queue basics | Basics (Pub/Sub model) | ../../system-design-guide/ |

---

## What You Will Learn

1. **Event Sourcing** — Design and implementation of the pattern that stores state as a history of events
2. **CQRS (Command Query Responsibility Segregation)** — Four levels of separating read and write responsibilities
3. **Event Sourcing + CQRS** combined — Projection design and managing eventual consistency
4. **Snapshot optimization** — Strategies to reduce event replay costs
5. **Incremental adoption** — Migration paths from existing CRUD applications and event schema versioning

---

## 1. Traditional CRUD vs Event Sourcing

### WHY: Why Event Sourcing Is Needed

Traditional CRUD stores only the "current state" of data. This leads to the following problems:

1. **Lack of audit trail** — You cannot tell "when", "who", or "why" a change was made
2. **No time-series analysis** — You cannot reconstruct the state at any arbitrary point in the past
3. **Loss of domain knowledge** — You cannot distinguish between "the price was changed" and "a discount was applied"
4. **Concurrent update conflicts** — UPDATE overwrites, so the last write wins (Lost Update)

Event Sourcing fundamentally resolves all of these.

### 1.1 The Fundamental Difference

```
┌──────────────────────────────────────────────────────┐
│  Traditional CRUD (state storage)                    │
│                                                      │
│  orders table:                                       │
│  ┌──────┬────────┬────────┬───────────┐              │
│  │ id   │ status │ total  │ updated_at│              │
│  ├──────┼────────┼────────┼───────────┤              │
│  │ O-01 │ shipped│ 15,000 │ 02-10     │ ← Only the  │
│  └──────┴────────┴────────┴───────────┘   current   │
│                                            state     │
│  Problem: Cannot tell "when" or "why" the order     │
│           changed. Why did it go from 12,000 to      │
│           15,000?                                    │
│           ・Item added? ・Price change? ・Shipping?  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Event Sourcing (event storage)                      │
│                                                      │
│  events table:                                       │
│  ┌────┬──────┬────────────────┬──────────┬───────┐   │
│  │ #  │ Agg  │ Event Type     │ Data     │ Time  │   │
│  ├────┼──────┼────────────────┼──────────┼───────┤   │
│  │ 1  │ O-01 │ OrderCreated   │ {items}  │ 02-08 │   │
│  │ 2  │ O-01 │ ItemAdded      │ {item}   │ 02-08 │   │
│  │ 3  │ O-01 │ PaymentReceived│ {amount} │ 02-09 │   │
│  │ 4  │ O-01 │ OrderShipped   │ {carrier}│ 02-10 │   │
│  └────┴──────┴────────────────┴──────────┴───────┘   │
│                                                      │
│  Benefit: Full change history is preserved;          │
│           reconstruct state at any point in time.    │
│           "Why 15,000?" = sum of Event 1+2           │
└──────────────────────────────────────────────────────┘
```

### 1.2 State Reconstruction via Event Sourcing

```
State reconstruction through event replay (Replay):

  Event 1: OrderCreated      → Order { status: "created", items: [], total: 0 }
      │
      ▼
  Event 2: ItemAdded(A,5000)  → Order { status: "created", items: [A], total: 5000 }
      │
      ▼
  Event 3: ItemAdded(B,7000)  → Order { status: "created", items: [A,B], total: 12000 }
      │
      ▼
  Event 4: ShippingAdded(3000)→ Order { status: "created", items: [A,B], total: 15000 }
      │
      ▼
  Event 5: PaymentReceived    → Order { status: "paid", items: [A,B], total: 15000 }
      │
      ▼
  Event 6: OrderShipped       → Order { status: "shipped", items: [A,B], total: 15000 }

  * Need state as of Feb 9 → replay Events 1-5
  * "Why 15,000?" → Event 2(5000) + Event 3(7000) + Event 4(3000)
```

### 1.3 Core Concepts of Event Sourcing

```
┌───────────────────────────────────────────────────────────┐
│  Three core principles of Event Sourcing                  │
│                                                           │
│  1. Events are Immutable                                  │
│     ────────────────────────                               │
│     Events, once recorded, are never modified or deleted  │
│     → Guarantees reliability of the audit trail           │
│                                                           │
│  2. Events are Append-Only                                │
│     ────────────────────────────                           │
│     New events are simply appended to the end             │
│     → Fewer lock conflicts, higher write performance      │
│                                                           │
│  3. Current State is Derived State                        │
│     ──────────────────────────────────                     │
│     state = fold(initialState, allEvents, applyFunction)  │
│     → The same sequence of events always yields the       │
│       same reconstructed state                            │
│     → Same concept as reduce in functional programming    │
└───────────────────────────────────────────────────────────┘

Mathematical expression:
  state(t) = reduce(apply, initialState, events[0..t])

In TypeScript:
  const currentState = events.reduce(
    (state, event) => applyEvent(state, event),
    initialState
  );
```

---

## 2. Implementing Event Sourcing

### 2.1 Event Definitions (TypeScript)

```typescript
// ============================================================
// Domain Events — type-safe event definitions
// ============================================================

// Base event type
interface DomainEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<{
    timestamp: Date;
    version: number;
    userId?: string;          // Who made this change
    correlationId?: string;   // ID of the related operation (distributed tracing)
    causationId?: string;     // ID of the event that caused this event
  }>;
}

// Order domain events (type-safe with Discriminated Union)
type OrderEvent =
  | OrderCreated
  | ItemAdded
  | ItemRemoved
  | DiscountApplied
  | PaymentReceived
  | OrderShipped
  | OrderCancelled;

interface OrderCreated extends DomainEvent {
  readonly eventType: "OrderCreated";
  readonly data: {
    readonly customerId: string;
    readonly items: ReadonlyArray<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
    readonly shippingAddress: {
      street: string;
      city: string;
      postalCode: string;
    };
  };
}

interface ItemAdded extends DomainEvent {
  readonly eventType: "ItemAdded";
  readonly data: {
    readonly productId: string;
    readonly productName: string;
    readonly quantity: number;
    readonly unitPrice: number;
  };
}

interface ItemRemoved extends DomainEvent {
  readonly eventType: "ItemRemoved";
  readonly data: {
    readonly productId: string;
    readonly quantity: number;
    readonly reason: string;
  };
}

interface DiscountApplied extends DomainEvent {
  readonly eventType: "DiscountApplied";
  readonly data: {
    readonly discountType: "percentage" | "fixed";
    readonly value: number;
    readonly couponCode?: string;
    readonly reason: string;
  };
}

interface PaymentReceived extends DomainEvent {
  readonly eventType: "PaymentReceived";
  readonly data: {
    readonly amount: number;
    readonly paymentMethod: "credit_card" | "bank_transfer" | "wallet";
    readonly transactionId: string;
  };
}

interface OrderShipped extends DomainEvent {
  readonly eventType: "OrderShipped";
  readonly data: {
    readonly carrier: string;
    readonly trackingNumber: string;
    readonly estimatedDelivery: string;
  };
}

interface OrderCancelled extends DomainEvent {
  readonly eventType: "OrderCancelled";
  readonly data: {
    readonly reason: string;
    readonly cancelledBy: string;
    readonly refundAmount: number;
  };
}
```

### 2.2 Aggregate Implementation

```typescript
// ============================================================
// Order Aggregate — Event Sourcing compatible
// ============================================================

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

type OrderStatus = "created" | "paid" | "shipped" | "delivered" | "cancelled";

class Order {
  private _id: string = "";
  private _customerId: string = "";
  private _status: OrderStatus = "created";
  private _items: OrderItem[] = [];
  private _totalAmount: number = 0;
  private _discountAmount: number = 0;
  private _version: number = 0;
  private _uncommittedEvents: OrderEvent[] = [];

  // ============================================
  // Queries (reads)
  // ============================================
  get id(): string { return this._id; }
  get status(): OrderStatus { return this._status; }
  get items(): ReadonlyArray<OrderItem> { return this._items; }
  get totalAmount(): number { return this._totalAmount; }
  get netAmount(): number { return this._totalAmount - this._discountAmount; }
  get version(): number { return this._version; }

  // ============================================
  // Factory: restore state from events
  // ============================================
  static fromEvents(events: OrderEvent[]): Order {
    const order = new Order();
    for (const event of events) {
      order.applyEvent(event, false);  // Existing events are not added to uncommitted
    }
    return order;
  }

  static fromSnapshot(snapshot: OrderSnapshot, newEvents: OrderEvent[]): Order {
    const order = new Order();
    order._id = snapshot.id;
    order._customerId = snapshot.customerId;
    order._status = snapshot.status;
    order._items = [...snapshot.items];
    order._totalAmount = snapshot.totalAmount;
    order._discountAmount = snapshot.discountAmount;
    order._version = snapshot.version;

    // Replay events after the snapshot
    for (const event of newEvents) {
      order.applyEvent(event, false);
    }
    return order;
  }

  // ============================================
  // Commands (writes) — business rule validation + event emission
  // ============================================
  static create(
    orderId: string,
    customerId: string,
    items: OrderItem[],
    shippingAddress: { street: string; city: string; postalCode: string },
    userId: string
  ): Order {
    // Business rule validation
    if (items.length === 0) {
      throw new DomainError("An order must have at least one item");
    }
    if (items.some((i) => i.quantity <= 0)) {
      throw new DomainError("Item quantity must be a positive integer");
    }

    const order = new Order();
    order.raiseEvent({
      eventType: "OrderCreated",
      aggregateId: orderId,
      data: {
        customerId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        shippingAddress,
      },
    }, userId);
    return order;
  }

  addItem(item: OrderItem, userId: string): void {
    // Business rule: cannot add items to a paid order
    if (this._status !== "created") {
      throw new DomainError(
        `Cannot add items to an order with status "${this._status}"`
      );
    }
    if (item.quantity <= 0) {
      throw new DomainError("Item quantity must be a positive integer");
    }

    this.raiseEvent({
      eventType: "ItemAdded",
      aggregateId: this._id,
      data: {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      },
    }, userId);
  }

  removeItem(productId: string, quantity: number, reason: string, userId: string): void {
    if (this._status !== "created") {
      throw new DomainError("Cannot remove items from a paid order");
    }
    const existingItem = this._items.find((i) => i.productId === productId);
    if (!existingItem) {
      throw new DomainError(`Item ${productId} is not in the order`);
    }
    if (existingItem.quantity < quantity) {
      throw new DomainError("Removal quantity exceeds ordered quantity");
    }

    this.raiseEvent({
      eventType: "ItemRemoved",
      aggregateId: this._id,
      data: { productId, quantity, reason },
    }, userId);
  }

  applyDiscount(type: "percentage" | "fixed", value: number, reason: string, couponCode?: string, userId?: string): void {
    if (this._status !== "created") {
      throw new DomainError("Cannot apply a discount to a paid order");
    }
    if (type === "percentage" && (value < 0 || value > 100)) {
      throw new DomainError("Discount percentage must be in the range 0-100%");
    }

    this.raiseEvent({
      eventType: "DiscountApplied",
      aggregateId: this._id,
      data: { discountType: type, value, couponCode, reason },
    }, userId ?? "system");
  }

  receivePayment(amount: number, method: PaymentReceived["data"]["paymentMethod"], txId: string, userId: string): void {
    if (this._status !== "created") {
      throw new DomainError("This order has already been paid");
    }
    if (amount < this.netAmount) {
      throw new DomainError(
        `Payment amount ${amount} is insufficient (required: ${this.netAmount})`
      );
    }

    this.raiseEvent({
      eventType: "PaymentReceived",
      aggregateId: this._id,
      data: { amount, paymentMethod: method, transactionId: txId },
    }, userId);
  }

  ship(carrier: string, trackingNumber: string, estimatedDelivery: string, userId: string): void {
    if (this._status !== "paid") {
      throw new DomainError("Only paid orders can be shipped");
    }

    this.raiseEvent({
      eventType: "OrderShipped",
      aggregateId: this._id,
      data: { carrier, trackingNumber, estimatedDelivery },
    }, userId);
  }

  cancel(reason: string, userId: string): void {
    if (this._status === "shipped" || this._status === "delivered") {
      throw new DomainError("Shipped orders cannot be cancelled");
    }
    if (this._status === "cancelled") {
      throw new DomainError("Order is already cancelled");
    }

    const refundAmount = this._status === "paid" ? this.netAmount : 0;
    this.raiseEvent({
      eventType: "OrderCancelled",
      aggregateId: this._id,
      data: { reason, cancelledBy: userId, refundAmount },
    }, userId);
  }

  // ============================================
  // Event application (state mutation logic) — pure function
  // ============================================
  private applyEvent(event: OrderEvent, isNew: boolean = true): void {
    switch (event.eventType) {
      case "OrderCreated":
        this._id = event.aggregateId;
        this._customerId = event.data.customerId;
        this._status = "created";
        this._items = event.data.items.map((i) => ({
          productId: i.productId,
          productName: "",
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        }));
        this._totalAmount = this._items.reduce(
          (sum, i) => sum + i.unitPrice * i.quantity, 0
        );
        break;

      case "ItemAdded":
        this._items.push({
          productId: event.data.productId,
          productName: event.data.productName,
          quantity: event.data.quantity,
          unitPrice: event.data.unitPrice,
        });
        this._totalAmount += event.data.unitPrice * event.data.quantity;
        break;

      case "ItemRemoved": {
        const idx = this._items.findIndex(
          (i) => i.productId === event.data.productId
        );
        if (idx >= 0) {
          this._totalAmount -= this._items[idx].unitPrice * event.data.quantity;
          this._items[idx].quantity -= event.data.quantity;
          if (this._items[idx].quantity <= 0) {
            this._items.splice(idx, 1);
          }
        }
        break;
      }

      case "DiscountApplied":
        if (event.data.discountType === "percentage") {
          this._discountAmount = this._totalAmount * (event.data.value / 100);
        } else {
          this._discountAmount = event.data.value;
        }
        break;

      case "PaymentReceived":
        this._status = "paid";
        break;

      case "OrderShipped":
        this._status = "shipped";
        break;

      case "OrderCancelled":
        this._status = "cancelled";
        break;
    }

    this._version++;
    if (isNew) {
      this._uncommittedEvents.push(event as OrderEvent);
    }
  }

  // ============================================
  // Event emission helper
  // ============================================
  private raiseEvent(
    eventData: Pick<OrderEvent, "eventType" | "aggregateId" | "data">,
    userId: string
  ): void {
    const event = {
      ...eventData,
      eventId: crypto.randomUUID(),
      aggregateType: "Order",
      metadata: {
        timestamp: new Date(),
        version: this._version + 1,
        userId,
      },
    } as OrderEvent;
    this.applyEvent(event, true);
  }

  getUncommittedEvents(): ReadonlyArray<OrderEvent> {
    return [...this._uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }

  toSnapshot(): OrderSnapshot {
    return {
      id: this._id,
      customerId: this._customerId,
      status: this._status,
      items: [...this._items],
      totalAmount: this._totalAmount,
      discountAmount: this._discountAmount,
      version: this._version,
    };
  }
}

interface OrderSnapshot {
  id: string;
  customerId: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  discountAmount: number;
  version: number;
}

class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
```

### 2.3 Implementing the Event Store

```typescript
// ============================================================
// Event Store Interface (domain layer)
// ============================================================
interface EventStore {
  append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void>;
  getEvents(aggregateId: string): Promise<DomainEvent[]>;
  getEventsAfterVersion(
    aggregateId: string,
    version: number
  ): Promise<DomainEvent[]>;
  getAllEvents(options?: {
    eventTypes?: string[];
    since?: Date;
    limit?: number;
  }): AsyncIterable<DomainEvent>;
}

// ============================================================
// PostgreSQL implementation
// ============================================================
class PostgresEventStore implements EventStore {
  constructor(private pool: Pool) {}

  async append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Optimistic lock: check the current version
      const { rows } = await client.query(
        `SELECT COALESCE(MAX(version), 0) as current_version
         FROM events WHERE aggregate_id = $1
         FOR UPDATE`,  // SELECT FOR UPDATE for exclusive lock
        [aggregateId]
      );
      const currentVersion = rows[0].current_version;

      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          `Expected version ${expectedVersion}, but found ${currentVersion}. ` +
          `Another process may have modified this aggregate.`
        );
      }

      // Append events (batch INSERT)
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const event of events) {
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, ` +
          `$${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`
        );
        values.push(
          event.eventId,
          event.aggregateId,
          event.aggregateType,
          event.eventType,
          JSON.stringify(event.data),
          JSON.stringify(event.metadata),
          event.metadata.version
        );
        paramIndex += 7;
      }

      await client.query(
        `INSERT INTO events
         (event_id, aggregate_id, aggregate_type, event_type, data, metadata, version)
         VALUES ${placeholders.join(", ")}`,
        values
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM events WHERE aggregate_id = $1 ORDER BY version ASC",
      [aggregateId]
    );
    return rows.map(this.toDomainEvent);
  }

  async getEventsAfterVersion(
    aggregateId: string,
    version: number
  ): Promise<DomainEvent[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM events
       WHERE aggregate_id = $1 AND version > $2
       ORDER BY version ASC`,
      [aggregateId, version]
    );
    return rows.map(this.toDomainEvent);
  }

  async *getAllEvents(options?: {
    eventTypes?: string[];
    since?: Date;
    limit?: number;
  }): AsyncIterable<DomainEvent> {
    let query = "SELECT * FROM events WHERE 1=1";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.eventTypes?.length) {
      query += ` AND event_type = ANY($${paramIndex})`;
      params.push(options.eventTypes);
      paramIndex++;
    }
    if (options?.since) {
      query += ` AND (metadata->>'timestamp')::timestamptz >= $${paramIndex}`;
      params.push(options.since);
      paramIndex++;
    }
    query += " ORDER BY (metadata->>'timestamp')::timestamptz ASC";
    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const { rows } = await this.pool.query(query, params);
    for (const row of rows) {
      yield this.toDomainEvent(row);
    }
  }

  private toDomainEvent(row: any): DomainEvent {
    return {
      eventId: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: row.data,
      metadata: {
        ...row.metadata,
        timestamp: new Date(row.metadata.timestamp),
      },
    };
  }
}

class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrencyError";
  }
}
```

### 2.4 Event Store Schema

```sql
-- ============================================================
-- PostgreSQL: Event Store table definition
-- ============================================================

CREATE TABLE events (
    -- Primary key
    id              BIGSERIAL PRIMARY KEY,

    -- Event identification
    event_id        UUID NOT NULL UNIQUE,
    aggregate_id    UUID NOT NULL,
    aggregate_type  VARCHAR(100) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,

    -- Event data
    data            JSONB NOT NULL,
    metadata        JSONB NOT NULL,

    -- Versioning (for optimistic locking)
    version         INTEGER NOT NULL,

    -- Timestamp
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Version is unique per aggregate
    CONSTRAINT unique_aggregate_version
        UNIQUE (aggregate_id, version)
);

-- Indexes
CREATE INDEX idx_events_aggregate_id ON events (aggregate_id, version);
CREATE INDEX idx_events_event_type ON events (event_type);
CREATE INDEX idx_events_created_at ON events (created_at);

-- Snapshots table
CREATE TABLE snapshots (
    aggregate_id    UUID PRIMARY KEY,
    aggregate_type  VARCHAR(100) NOT NULL,
    version         INTEGER NOT NULL,
    state           JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. CQRS Design

### WHY: Why CQRS Is Needed

Reads and writes have fundamentally different requirements:

```
┌───────────────────────────────────────────────────────┐
│  Asymmetry between reads and writes                   │
│                                                       │
│  Write (Command):                                     │
│  · Domain model consistency is critical               │
│  · Business rule validation is required               │
│  · Transactional consistency                          │
│  · Usually operates on a single aggregate             │
│  · 10-20% of traffic                                  │
│                                                       │
│  Read (Query):                                        │
│  · Data format optimized for display is important     │
│  · Requires JOINed data from multiple aggregates      │
│  · Caching is effective                               │
│  · Eventual consistency is often sufficient           │
│  · 80-90% of traffic                                  │
│                                                       │
│  → It is difficult to optimize both with one model    │
│  → Separating them allows optimal design for each     │
└───────────────────────────────────────────────────────┘
```

### 3.1 Four Levels of CQRS

```
┌───────────────────────────────────────────────────────────┐
│  Incremental CQRS adoption                                │
│                                                           │
│  Level 0: Traditional (no separation)                     │
│  ┌──────────────┐                                         │
│  │ Same Model   │ ← Same model for both reads and writes  │
│  │ (User Entity)│                                         │
│  └──────┬───────┘                                         │
│         │                                                 │
│  ┌──────▼───────┐                                         │
│  │   Same DB    │                                         │
│  └──────────────┘                                         │
│                                                           │
│  Level 1: Model separation (same DB)                      │
│  ┌──────────┐  ┌──────────┐                               │
│  │ Write    │  │ Read     │ ← Different models             │
│  │ Model    │  │ Model    │    (DTO / View Model)          │
│  └────┬─────┘  └────┬─────┘                               │
│       └──────┬──────┘                                     │
│       ┌──────▼───────┐                                    │
│       │   Same DB    │                                    │
│       └──────────────┘                                    │
│                                                           │
│  Level 2: DB separation (synchronous update)              │
│  ┌──────────┐           ┌──────────┐                      │
│  │ Write    │           │ Read     │                      │
│  │ Model    │           │ Model    │                      │
│  └────┬─────┘           └────┬─────┘                      │
│  ┌────▼─────┐  sync    ┌────▼─────┐                      │
│  │ Write DB │ ───────→ │ Read DB  │                      │
│  └──────────┘          └──────────┘                      │
│                                                           │
│  Level 3: Event Sourcing + async projections              │
│  ┌──────────┐           ┌──────────┐                      │
│  │ Command  │           │ Query    │                      │
│  │ Handler  │           │ Handler  │                      │
│  └────┬─────┘           └────┬─────┘                      │
│  ┌────▼──────┐  Event  ┌────▼─────┐                      │
│  │ Event     │ ──────→ │ Read DB  │ ← Asynchronously      │
│  │ Store     │ Stream  │(Projection)│  projected into an  │
│  └───────────┘         └──────────┘  optimized format    │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Separating Commands and Queries

```typescript
// ============================================================
// Command Side (writes)
// ============================================================

// Command definitions
type OrderCommand =
  | CreateOrderCommand
  | AddItemCommand
  | ApplyDiscountCommand
  | ReceivePaymentCommand
  | ShipOrderCommand
  | CancelOrderCommand;

interface CreateOrderCommand {
  type: "CreateOrder";
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  shippingAddress: { street: string; city: string; postalCode: string };
  userId: string;
}

interface ShipOrderCommand {
  type: "ShipOrder";
  orderId: string;
  carrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
  userId: string;
}

// Command Handler
class OrderCommandHandler {
  constructor(
    private eventStore: EventStore,
    private snapshotRepo: SnapshotRepository,
    private eventBus: EventBus,
  ) {}

  async handle(command: OrderCommand): Promise<void> {
    switch (command.type) {
      case "CreateOrder":
        return this.handleCreateOrder(command);
      case "ShipOrder":
        return this.handleShipOrder(command);
      // ... other commands
    }
  }

  private async handleCreateOrder(cmd: CreateOrderCommand): Promise<void> {
    // Create a new aggregate
    const order = Order.create(
      cmd.orderId,
      cmd.customerId,
      cmd.items.map((i) => ({
        productId: i.productId,
        productName: "",
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      cmd.shippingAddress,
      cmd.userId
    );

    // Persist events
    const events = order.getUncommittedEvents();
    await this.eventStore.append(cmd.orderId, [...events], 0);
    order.clearUncommittedEvents();

    // Publish events (to update projections)
    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }

  private async handleShipOrder(cmd: ShipOrderCommand): Promise<void> {
    // Restore the aggregate
    const order = await this.loadOrder(cmd.orderId);

    // Execute the command (business rule validation + event emission)
    order.ship(
      cmd.carrier,
      cmd.trackingNumber,
      cmd.estimatedDelivery,
      cmd.userId
    );

    // Persist events
    const newEvents = order.getUncommittedEvents();
    await this.eventStore.append(
      cmd.orderId,
      [...newEvents],
      order.version - newEvents.length
    );
    order.clearUncommittedEvents();

    // Publish events
    for (const event of newEvents) {
      await this.eventBus.publish(event);
    }
  }

  private async loadOrder(orderId: string): Promise<Order> {
    // Use snapshot if available
    const snapshot = await this.snapshotRepo.load(orderId);
    if (snapshot) {
      const newEvents = await this.eventStore.getEventsAfterVersion(
        orderId,
        snapshot.version
      );
      return Order.fromSnapshot(snapshot.state as OrderSnapshot, newEvents as OrderEvent[]);
    }

    // Otherwise, restore from all events
    const events = await this.eventStore.getEvents(orderId);
    if (events.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }
    return Order.fromEvents(events as OrderEvent[]);
  }
}
```

```typescript
// ============================================================
// Query Side (reads)
// ============================================================

// Read Model (Projection) — data structure optimized for display
interface OrderSummaryView {
  orderId: string;
  customerName: string;
  customerEmail: string;
  status: string;
  statusLabel: string;  // Display label (e.g. "Shipped")
  itemCount: number;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  lastUpdated: Date;
  trackingUrl?: string;
}

interface OrderDetailView extends OrderSummaryView {
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    postalCode: string;
  };
  timeline: Array<{
    event: string;
    timestamp: Date;
    description: string;
  }>;
}

// Projector: builds the Read Model from events
class OrderProjector {
  constructor(
    private readDb: ReadDatabase,
    private customerService: CustomerService,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case "OrderCreated":
        await this.onOrderCreated(event as OrderCreated);
        break;
      case "ItemAdded":
        await this.onItemAdded(event as ItemAdded);
        break;
      case "PaymentReceived":
        await this.onPaymentReceived(event as PaymentReceived);
        break;
      case "OrderShipped":
        await this.onOrderShipped(event as OrderShipped);
        break;
      case "OrderCancelled":
        await this.onOrderCancelled(event as OrderCancelled);
        break;
    }
  }

  private async onOrderCreated(event: OrderCreated): Promise<void> {
    // Fetch customer information (denormalization is fine in Read Model)
    const customer = await this.customerService.getById(event.data.customerId);
    const items = event.data.items;
    const totalAmount = items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity, 0
    );

    await this.readDb.upsert("order_summaries", event.aggregateId, {
      orderId: event.aggregateId,
      customerName: customer.name,
      customerEmail: customer.email,
      status: "created",
      statusLabel: "Order Received",
      itemCount: items.length,
      totalAmount,
      discountAmount: 0,
      netAmount: totalAmount,
      lastUpdated: event.metadata.timestamp,
    });
  }

  private async onItemAdded(event: ItemAdded): Promise<void> {
    const current = await this.readDb.findOne(
      "order_summaries",
      event.aggregateId
    );
    if (!current) return;

    const addedAmount = event.data.unitPrice * event.data.quantity;
    await this.readDb.update("order_summaries", event.aggregateId, {
      itemCount: current.itemCount + 1,
      totalAmount: current.totalAmount + addedAmount,
      netAmount: current.netAmount + addedAmount,
      lastUpdated: event.metadata.timestamp,
    });
  }

  private async onPaymentReceived(event: PaymentReceived): Promise<void> {
    await this.readDb.update("order_summaries", event.aggregateId, {
      status: "paid",
      statusLabel: "Payment Complete",
      lastUpdated: event.metadata.timestamp,
    });
  }

  private async onOrderShipped(event: OrderShipped): Promise<void> {
    await this.readDb.update("order_summaries", event.aggregateId, {
      status: "shipped",
      statusLabel: "Shipped",
      trackingUrl: `https://tracking.example.com/${event.data.trackingNumber}`,
      lastUpdated: event.metadata.timestamp,
    });
  }

  private async onOrderCancelled(event: OrderCancelled): Promise<void> {
    await this.readDb.update("order_summaries", event.aggregateId, {
      status: "cancelled",
      statusLabel: "Cancelled",
      lastUpdated: event.metadata.timestamp,
    });
  }
}

// Query Handler — queries against the Read Model
class OrderQueryHandler {
  constructor(private readDb: ReadDatabase) {}

  async getOrderSummary(orderId: string): Promise<OrderSummaryView | null> {
    return this.readDb.findOne("order_summaries", orderId);
  }

  async getOrdersByCustomer(
    customerId: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<{ data: OrderSummaryView[]; total: number }> {
    return this.readDb.findPaginated("order_summaries", {
      where: { customerId },
      orderBy: { lastUpdated: "desc" },
      page,
      perPage,
    });
  }

  async getRecentOrders(limit: number = 50): Promise<OrderSummaryView[]> {
    return this.readDb.find("order_summaries", {
      orderBy: { lastUpdated: "desc" },
      limit,
    });
  }

  async getOrderStats(): Promise<{
    totalOrders: number;
    pendingOrders: number;
    shippedToday: number;
    totalRevenue: number;
  }> {
    return this.readDb.aggregate("order_summaries", {
      totalOrders: { count: "*" },
      pendingOrders: { count: { where: { status: "created" } } },
      shippedToday: {
        count: {
          where: { status: "shipped", lastUpdated: { gte: today() } },
        },
      },
      totalRevenue: { sum: "netAmount", where: { status: { ne: "cancelled" } } },
    });
  }
}
```

---

## 4. Snapshot Optimization

### 4.1 How Snapshots Work

```
As the number of events grows, replay cost increases:

  Without Snapshot:
  Event 1 → Event 2 → ... → Event 999 → Event 1000
  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  Replay all 1000 events (slow)

  With Snapshot (every 100 events):
  [Snapshot @ Event 900] → Event 901 → ... → Event 1000
                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                           Only replay 100 events (fast)

  ┌──────────────────────────────────────────────────┐
  │  Snapshot strategies                             │
  │                                                  │
  │  When to save:                                   │
  │  - Every N events (e.g. every 100)               │
  │  - Time-based (e.g. every hour)                  │
  │  - Manual (only for high-load aggregates)        │
  │  - When event replay time exceeds a threshold    │
  │                                                  │
  │  Where to save:                                  │
  │  - Separate table in the same Event Store        │
  │  - Redis / Memcached (fast access)               │
  │  - S3 (large data, infrequent access)            │
  └──────────────────────────────────────────────────┘
```

### 4.2 Snapshot Implementation

```typescript
// ============================================================
// Snapshot Repository
// ============================================================
interface Snapshot {
  aggregateId: string;
  version: number;
  state: Record<string, unknown>;
  createdAt: Date;
}

interface SnapshotRepository {
  save(snapshot: Snapshot): Promise<void>;
  load(aggregateId: string): Promise<Snapshot | null>;
}

class PostgresSnapshotRepository implements SnapshotRepository {
  constructor(private pool: Pool) {}

  async save(snapshot: Snapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO snapshots (aggregate_id, aggregate_type, version, state, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (aggregate_id) DO UPDATE
       SET version = $3, state = $4, created_at = $5`,
      ["Order", snapshot.aggregateId, snapshot.version,
       JSON.stringify(snapshot.state), snapshot.createdAt]
    );
  }

  async load(aggregateId: string): Promise<Snapshot | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM snapshots WHERE aggregate_id = $1",
      [aggregateId]
    );
    if (rows.length === 0) return null;
    return {
      aggregateId: rows[0].aggregate_id,
      version: rows[0].version,
      state: rows[0].state,
      createdAt: rows[0].created_at,
    };
  }
}

// ============================================================
// Snapshot-aware Order Repository
// ============================================================
class EventSourcedOrderRepository {
  constructor(
    private eventStore: EventStore,
    private snapshotRepo: SnapshotRepository,
    private snapshotInterval: number = 100,
  ) {}

  async load(orderId: string): Promise<Order> {
    const snapshot = await this.snapshotRepo.load(orderId);

    if (snapshot) {
      const newEvents = await this.eventStore.getEventsAfterVersion(
        orderId,
        snapshot.version
      );
      return Order.fromSnapshot(
        snapshot.state as OrderSnapshot,
        newEvents as OrderEvent[]
      );
    }

    const events = await this.eventStore.getEvents(orderId);
    if (events.length === 0) throw new Error(`Order ${orderId} not found`);
    return Order.fromEvents(events as OrderEvent[]);
  }

  async save(order: Order): Promise<void> {
    const events = order.getUncommittedEvents();
    const baseVersion = order.version - events.length;

    await this.eventStore.append(order.id, [...events], baseVersion);
    order.clearUncommittedEvents();

    // Decide whether to save a snapshot
    if (order.version % this.snapshotInterval === 0) {
      await this.snapshotRepo.save({
        aggregateId: order.id,
        version: order.version,
        state: order.toSnapshot(),
        createdAt: new Date(),
      });
    }
  }
}
```

---

## 5. Event Schema Versioning

### WHY: Why Versioning Is Needed

Because events are immutable, existing events cannot be rewritten when the schema changes. Instead, use the **Upcaster** pattern to transform old-version events at read time.

```typescript
// ============================================================
// Event versioning and Upcaster
// ============================================================

// v1: initial version
interface OrderCreatedV1 {
  eventType: "OrderCreated";
  schemaVersion: 1;
  data: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
  };
}

// v2: added currency field
interface OrderCreatedV2 {
  eventType: "OrderCreated";
  schemaVersion: 2;
  data: {
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
      currency: string;  // newly added
    }>;
    currency: string;  // newly added
  };
}

// v3: added shipping address
interface OrderCreatedV3 {
  eventType: "OrderCreated";
  schemaVersion: 3;
  data: {
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
      currency: string;
    }>;
    currency: string;
    shippingAddress: {  // newly added
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  };
}

// Upcaster Chain
class EventUpcaster {
  private upcasters: Map<string, Map<number, (event: any) => any>> = new Map();

  register(eventType: string, fromVersion: number, transform: (event: any) => any): void {
    if (!this.upcasters.has(eventType)) {
      this.upcasters.set(eventType, new Map());
    }
    this.upcasters.get(eventType)!.set(fromVersion, transform);
  }

  upcast(event: DomainEvent): DomainEvent {
    const version = (event as any).schemaVersion ?? 1;
    const eventUpcasters = this.upcasters.get(event.eventType);
    if (!eventUpcasters) return event;

    let current = event;
    let currentVersion = version;

    while (eventUpcasters.has(currentVersion)) {
      current = eventUpcasters.get(currentVersion)!(current);
      currentVersion++;
    }

    return current;
  }
}

// Registering upcasters
const upcaster = new EventUpcaster();

// v1 → v2: add currency field
upcaster.register("OrderCreated", 1, (event: OrderCreatedV1): OrderCreatedV2 => ({
  ...event,
  schemaVersion: 2,
  data: {
    ...event.data,
    currency: "JPY",  // default value
    items: event.data.items.map((i) => ({
      ...i,
      currency: "JPY",
    })),
  },
}));

// v2 → v3: add shippingAddress
upcaster.register("OrderCreated", 2, (event: OrderCreatedV2): OrderCreatedV3 => ({
  ...event,
  schemaVersion: 3,
  data: {
    ...event.data,
    shippingAddress: {
      street: "Unknown",
      city: "Unknown",
      postalCode: "000-0000",
      country: "JP",
    },
  },
}));
```

---

## 6. Comparison Tables

### 6.1 CRUD vs Event Sourcing

| Aspect | Traditional CRUD | Event Sourcing |
|------|-----------|----------------|
| **Data model** | Current state only | Event history (immutable) |
| **Change history** | Manual audit table required | Full history preserved automatically |
| **Point-in-time recovery** | Not possible (requires separate implementation) | Possible via event replay |
| **Storage volume** | Small (current state only) | Large (all events stored) |
| **Read performance** | High (direct query) | Low (requires replay → solved with projections) |
| **Write performance** | Medium (UPDATE + lock) | High (append-only, fewer locks) |
| **Schema changes** | Handled via migration | Old versions converted with Upcaster |
| **Debugging** | Only current state is visible | Event log makes root cause tracing easy |
| **Complexity** | Low | High |
| **Testing** | DB mock required | Verifiable with event input/output |

### 6.2 CQRS Adoption Pattern Comparison

| Pattern | Description | Consistency | Complexity | Scalability | Use Case |
|---------|------|--------|--------|----------------|------------|
| **Level 0: No separation** | Same model, same DB | Immediate | Low | Low | Small-scale CRUD |
| **Level 1: Model separation** | Different models, same DB | Immediate | Low–Medium | Medium | Read/write optimization |
| **Level 2: DB separation + sync** | Write DB → Read DB sync update | Near-immediate | Medium | Medium–High | Consistency-focused |
| **Level 3: ES + async** | Event Store + async projections | Eventual | High | Highest | High scalability |

### 6.3 Event Store Implementation Options

| Implementation | Characteristics | Suitable Scale | Operational Cost |
|------|------|-----------|----------|
| **PostgreSQL + JSONB** | General-purpose, leverages existing infrastructure | Small–Medium (~tens of millions of events) | Low |
| **EventStoreDB** | ES-dedicated, built-in projection engine | Medium–Large | Medium |
| **Apache Kafka** | Stream processing, high throughput | Large (billions of events) | High |
| **DynamoDB Streams** | AWS-native, serverless | Medium–Large | Medium (pay-per-use) |
| **MongoDB + Change Streams** | Document-oriented, flexible schema | Medium | Medium |

---

## 7. Anti-Patterns

### 7.1 Applying Event Sourcing to All Domains

```
NG: Applying Event Sourcing to master data (product categories, configuration values)
    → Excessive complexity; CRUD is sufficient for these areas

OK: Criteria for applying Event Sourcing
    ┌───────────────────────────────────────┐
    │ Event Sourcing is appropriate for:   │
    │ ✓ Order processing, financial txns   │
    │ ✓ Audit trail legally required       │
    │ ✓ Business event analysis is critical│
    │ ✓ Complex state transitions exist    │
    │ ✓ Undo/compensating txns needed      │
    │                                       │
    │ CRUD is sufficient for:              │
    │ ✗ User profiles                      │
    │ ✗ Master data management             │
    │ ✗ Configuration management           │
    │ ✗ Admin screens centered on CRUD     │
    │ ✗ Simple reference data              │
    └───────────────────────────────────────┘
```

**Why it's NG**: Event Sourcing carries significant costs — event design, Projector implementation, managing eventual consistency. Applying it to domains with no business value only adds complexity.

### 7.2 Frequently Changing Event Schemas

```typescript
// NG: Directly modifying the structure of existing events
// v1 data: { amount: 1000 }
// v2 data: { amount: 1000, currency: "JPY" }
// → Reading v1 events will crash

// OK: Migrate versions using an Upcaster
function upcastOrderCreatedV1toV2(event: OrderCreatedV1): OrderCreatedV2 {
  return {
    ...event,
    schemaVersion: 2,
    data: {
      ...event.data,
      currency: "JPY",  // assign default value
    },
  };
}
```

**Why it's NG**: Events are immutable — the structure of already-stored data cannot be changed. The correct approach is to use an Upcaster to transform them at read time.

### 7.3 Not Encoding Domain Intent in Events

```typescript
// NG: Generic CRUD-style event
interface OrderUpdated {
  eventType: "OrderUpdated";
  data: {
    fields: Record<string, unknown>;  // unclear what changed
  };
}

// OK: Events that express domain intent
interface DiscountApplied {
  eventType: "DiscountApplied";
  data: {
    discountType: "percentage" | "fixed";
    value: number;
    reason: "loyalty_program" | "coupon" | "manual";
    couponCode?: string;
  };
}
// "Why did the amount change?" is clearly expressed
```

**Why it's NG**: The value of Event Sourcing is "recording the history of the domain." A generic "Updated" event, just like CRUD, only tells you "what happened" — the "why it happened" is lost.

### 7.4 Executing Side Effects Inside Projections

```typescript
// NG: Calling external APIs inside a Projector
class OrderProjector {
  async handle(event: OrderShipped) {
    // Update the Read Model
    await this.readDb.update(/* ... */);

    // Side effects (NG!)
    await this.emailService.sendShipmentNotification(event);
    await this.smsService.sendTrackingLink(event);
    // → Every time the projection is rebuilt (Rebuild),
    //   emails and SMS will be re-sent!
  }
}

// OK: Side effects in a separate event handler
class OrderProjector {
  async handle(event: OrderShipped) {
    // Only update the Read Model
    await this.readDb.update(/* ... */);
  }
}

// Notifications handled in a dedicated handler (with idempotency guarantee)
class ShipmentNotificationHandler {
  async handle(event: OrderShipped) {
    // Idempotency check
    const alreadySent = await this.notificationLog.exists(event.eventId);
    if (alreadySent) return;

    await this.emailService.sendShipmentNotification(event);
    await this.notificationLog.record(event.eventId);
  }
}
```

**Why it's NG**: Projections may be rebuilt (Rebuild). If side effects are inside the projection, they will re-execute every time it is rebuilt. Notifications and emails should be separated into dedicated event handlers with idempotency guarantees.

---

## 8. Practical Exercises

### Exercise 1 (Basic): Event Definition and Aggregate

Design a BankAccount aggregate using Event Sourcing.

**Events**:
- AccountOpened
- MoneyDeposited
- MoneyWithdrawn
- AccountFrozen
- AccountClosed

**Business rules**:
- Withdrawals that would result in a negative balance are not allowed
- Frozen accounts cannot perform deposits or withdrawals
- Closed accounts cannot be operated on

**Expected output**: `BankAccount` aggregate class (TypeScript) and test code

---

### Exercise 2 (Applied): Projection Design

Using the bank account events from Exercise 1, implement Projectors that build the following Read Models.

1. **AccountBalanceView** — Account balance list (account ID, name, balance, status)
2. **TransactionHistoryView** — Transaction history (timestamp, type, amount, balance)
3. **DailyReportView** — Daily report (total deposits, total withdrawals, net change per day)

**Expected output**: Three Projector classes and Read Model definitions

---

### Exercise 3 (Advanced): Incremental CRUD → ES Migration

Plan an incremental migration from an existing CRUD-based order system to Event Sourcing using the Strangler Fig pattern.

**Current system**: orders table (id, status, total, user_id, created_at, updated_at)

**Migration plan**:
1. Phase 1: Dual Write (run CRUD and event recording in parallel)
2. Phase 2: Build Read Model (create projections from events)
3. Phase 3: Migrate reads to projections
4. Phase 4: Migrate writes to Event Sourcing
5. Phase 5: Retire the old table

**Expected output**: Concrete code examples (TypeScript) for each phase and a risk analysis

---

## 9. FAQ

### Q1. I'm worried about storage as Event Sourcing events keep growing

**A.** Three countermeasures are available:
1. **Snapshots** — Save state every N events and skip replaying older events
2. **Archiving** — Move events older than a certain period to S3/Glacier (note legal requirements)
3. **Partitioning** — Split tables by month/year to maintain query performance

In practice, tens of millions of events run fine on PostgreSQL. With partitioning, hundreds of millions of events are manageable. At an average of 1KB per event, 100 million events is roughly 100GB — an acceptable range at modern storage costs.

### Q2. How should the UI handle eventual consistency in CQRS?

**A.** Three patterns are available:

1. **Optimistic UI** — Immediately update the UI locally after a successful command
2. **Polling** — Check the Read Model at short intervals after a command
3. **WebSocket / SSE** — Notify in real-time when a projection update is complete

```typescript
// Example of optimistic UI (React)
async function submitOrder(orderData: CreateOrderInput) {
  // 1. Send command
  await api.post("/commands/create-order", orderData);

  // 2. Immediately update the UI locally (without waiting for Read Model update)
  setOrders((prev) => [
    { ...orderData, status: "processing", id: tempId },
    ...prev,
  ]);

  // 3. Confirm Read Model reflection in the background
  const confirmed = await pollUntil(
    () => api.get(`/orders/${orderData.id}`),
    (res) => res.status !== 404,
    { maxAttempts: 10, interval: 500 }
  );

  if (confirmed) {
    // Replace optimistic update with confirmed data
    setOrders((prev) =>
      prev.map((o) => (o.id === tempId ? confirmed : o))
    );
  }
}
```

### Q3. Can Event Sourcing be incrementally introduced into an existing CRUD application?

**A.** Yes. An incremental approach combined with the Strangler Fig pattern is recommended:

1. **Phase 1: Dual Write** — Record events in parallel alongside CRUD
2. **Phase 2: Build Read Model** — Create projections from events and migrate some read queries
3. **Phase 3: Complete read migration** — Switch all reads to projections
4. **Phase 4: Migrate writes** — Migrate writes to Event Sourcing per aggregate
5. **Phase 5: Retire old tables** — Drop the CRUD tables

Verify that the system operates normally between each phase and maintain a rollback-capable state if issues arise. Completing all phases typically takes 3–6 months.

### Q4. How do you write tests for Event Sourcing?

**A.** The "Given-When-Then" pattern is the most natural:

```typescript
describe("Order Aggregate", () => {
  test("adding an item to a paid order throws an error", () => {
    // Given: a paid order
    const events: OrderEvent[] = [
      orderCreatedEvent({ items: [item1] }),
      paymentReceivedEvent({ amount: 5000 }),
    ];
    const order = Order.fromEvents(events);

    // When + Then: adding an item throws an error
    expect(() => {
      order.addItem(item2, "user-1");
    }).toThrow('Cannot add items to an order with status "paid"');
  });

  test("creating an order emits an OrderCreated event", () => {
    // When: create an order
    const order = Order.create("order-1", "customer-1", [item1], address, "user-1");

    // Then: verify the emitted events
    const events = order.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("OrderCreated");
    expect(events[0].data.customerId).toBe("customer-1");
  });
});
```

### Q5. How do you recover if a projection breaks?

**A.** Because events are immutable, projections can always be rebuilt (Rebuild):

1. TRUNCATE the Read Model table
2. Replay all events from the beginning to rebuild the projection
3. When the Read Model schema changes, the same procedure creates data in the new format

This is one of the greatest advantages of Event Sourcing. Even if there is a "data transformation mistake," fixing the Projector and running a Rebuild restores the correct state.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is paramount. Understanding deepens not just through theory, but by actually writing code and confirming how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the core concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work, especially during code reviews and architectural design.

---

## 10. Summary

| Item | Key Points |
|------|---------|
| **Event Sourcing** | Store state changes as append-only events. Full audit trail and point-in-time recovery are possible |
| **Three principles of events** | Immutable, Append-Only, Derived State |
| **CQRS** | Separate reads and writes. Scale and optimize each independently |
| **Projections** | Build optimized Read Models from events. Can be rebuilt if broken |
| **Snapshots** | Optimization technique to reduce event replay costs. Save state every N events |
| **Versioning** | Handle event schema evolution with the Upcaster pattern. Existing events remain immutable |
| **When to apply** | Apply when audit requirements, complex state transitions, or high scalability are needed. Not necessary for CRUD-sufficient areas |
| **Testing** | Given-When-Then pattern. Verifiable with event input/output. No DB required |

---

## What to Read Next

- [00-mvc-mvvm.md](./00-mvc-mvvm.md) — UI layer architectural patterns
- [01-repository-pattern.md](./01-repository-pattern.md) — Data access abstraction
- ../../system-design-guide/ — Message queues, distributed system design
- ../../clean-code-principles/ — DDD, SOLID principles
- [../02-behavioral/](../02-behavioral/) — Observer pattern (foundation of event-driven design)

---

## References

1. **Martin Fowler** — "Event Sourcing" — https://martinfowler.com/eaaDev/EventSourcing.html
2. **Martin Fowler** — "CQRS" — https://martinfowler.com/bliki/CQRS.html
3. **Greg Young** — "CQRS and Event Sourcing" — https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf
4. **Microsoft** — "CQRS pattern" — https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs
5. **Vaughn Vernon** — "Implementing Domain-Driven Design" (2013) — Integration of Event Sourcing and DDD
6. **EventStoreDB Documentation** — https://www.eventstore.com/docs/
7. **Adam Dymitruk** — "Event Modeling" — https://eventmodeling.org/
