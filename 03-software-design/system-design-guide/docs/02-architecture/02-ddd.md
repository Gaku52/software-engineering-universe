# Domain-Driven Design (DDD)

> A design methodology for accurately reflecting complex business domains in software, explaining how domain experts and developers can build robust models through shared understanding using aggregates, bounded contexts, and ubiquitous language as core pillars

---

## What You Will Learn in This Chapter

1. **Strategic Design** — Understand how to establish bounded contexts, context mapping, and ubiquitous language
2. **Tactical Design** — Master implementation patterns for entities, value objects, aggregates, domain events, and repositories
3. **Aggregate Design Principles** — Learn to implement aggregate roots, transaction boundaries, and consistency guarantees
4. **Domain Services vs Application Services** — Develop judgment on where to place logic
5. **Eventual Consistency and the Saga Pattern** — Learn to design coordination between aggregates

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|-----------|
| SOLID Principles | Single Responsibility Principle, Dependency Inversion Principle | SOLID Principles |
| Clean Architecture | Layer structure, dependency rules | [Clean Architecture](./01-clean-architecture.md) |
| Repository Pattern | Persistence abstraction | Design Patterns |
| Python Basics | dataclass, Protocol, type hints | - |

---

## 1. Background and Philosophy of DDD

### 1.1 Why DDD Is Needed

The greatest challenge in software development is not **technical complexity** but **domain (business area) complexity**. In his 2003 book "Domain-Driven Design," Eric Evans proposed a systematic approach to tackle this essential complexity.

```
Causes of Software Project Failure

  Technical problems (performance, scalability, etc.)
  ├── Solution: Technical knowledge, experience, best practices
  └── Easier to address (clear metrics exist)

  Domain complexity (business rules, workflows, etc.)
  ├── Solution: Domain-Driven Design
  └── Harder to address (much tacit knowledge, requirements change)
       → DDD focuses here
```

**WHY: Limitations of Traditional Approaches**

In traditional software development, domain knowledge was written in documents (requirements specifications, ER diagrams), and developers "translated" these into code. However, information was lost in this "translation" process, leading to the problem where domain complexity was not accurately reflected in code.

The essence of DDD is to **express domain knowledge in the code itself**. The terms that domain experts use become class names and method names directly, and business rules are implemented directly in entities. This fundamentally resolves the "gap between documentation and code" problem.

### 1.2 Overview of DDD

```
The Two Pillars of DDD

[Strategic Design]
  ─ Divide the problem domain and define team/system boundaries
  ─ Bounded Context
  ─ Context Map (relationships between contexts)
  ─ Ubiquitous Language (establishing a shared language)
  ─ Subdomain classification (Core / Supporting / Generic)

[Tactical Design]
  ─ Modeling patterns inside a context
  ─ Entity / Value Object / Aggregate
  ─ Domain Service / Domain Event
  ─ Repository / Factory
  ─ Specification Pattern
```

```
DDD Adoption Decision Flow

  Are business rules complex?
    ├── No → CRUD + traditional architecture is sufficient
    └── Yes
         Can you access domain experts?
           ├── No → Adopt only tactical patterns partially
           └── Yes
                Is the team large enough (3+ people)?
                  ├── No → Simplify strategic design, focus on tactical design
                  └── Yes → Adopt full DDD
```

---

## 2. Strategic Design

### 2.1 Bounded Context

The bounded context is the **most important concept** in DDD. It explicitly acknowledges that the same term can have different meanings in different contexts, and unifies the ubiquitous language within each context.

```
Context Map for an E-Commerce Site

  +--------------------+     +--------------------+     +--------------------+
  |  Order Context      |     |  Inventory Context  |     |  Shipping Context   |
  |                    |     |                    |     |                    |
  | Order              |     | StockItem          |     | Shipment           |
  | OrderItem          |     | Warehouse          |     | DeliveryRoute      |
  | Customer(orderer)  |     | Reservation        |     | Customer(recipient) |
  | "confirm" = place  |     | "allocate" = reserve|    | "send" = ship      |
  +--------+-----------+     +--------+-----------+     +--------+-----------+
           |                          |                          |
           | OrderPlaced              | StockReserved            |
           | (domain event)           | (domain event)           |
           +--------> [Event Bus] <---+------------------------->+

  ★ Even the same "Customer" has different meaning and attributes in each context
     Order: name, contact info, order history
     Shipping: delivery address, preferred delivery time slot
  ★ Contexts communicate loosely via events
  ★ Each context can be deployed and developed independently
```

**WHY split the same concept across multiple contexts?**

If a single "Customer" class holds all attributes (order information, shipping address, points information, inquiry history...), it becomes a massive and incomprehensible class. Furthermore, changes by the order team affect the shipping team, increasing inter-team dependencies. By splitting contexts, each team only needs to be responsible for the "Customer" within their own context.

### 2.2 Context Map Patterns

```
Relationship Patterns Between Contexts

1. Shared Kernel
   ┌─────────┐   shared part   ┌─────────┐
   │ Context A├────┤ Shared ├────┤ Context B│
   └─────────┘   └────────┘   └─────────┘
   → Two contexts share part of the model
   → Changes require agreement from both teams
   → Creates tight coupling, so use minimally

2. Customer-Supplier
   ┌──────────┐  API  ┌──────────┐
   │ Supplier  ├──────>│ Customer  │
   │(upstream) │       │(downstream)│
   └──────────┘       └──────────┘
   → The upstream (Supplier) considers downstream (Customer) requirements
   → The downstream team communicates requirements to the upstream team

3. Conformist
   ┌──────────┐  API  ┌──────────┐
   │ Upstream  ├──────>│ Downstream│
   │(immutable)│       │(conforms) │
   └──────────┘       └──────────┘
   → Follows the external service's model as-is
   → When translation costs cannot be accepted

4. Anti-Corruption Layer (ACL)
   ┌──────────┐  ACL  ┌──────────┐
   │ External  ├──┤translate├──>│ Internal  │
   │ System    │  └──┘   │ Context  │
   └──────────┘          └──────────┘
   → Translates external system models into internal context models
   → Especially important when integrating with legacy systems

5. Published Language
   → Communicate using a common schema (JSON Schema, Protobuf, etc.)
   → Works well with event-driven architecture
```

### 2.3 Subdomain Classification

```
Subdomain Classification

  ┌─────────────────────────────────────────────────────┐
  │  Core Domain                                         │
  │  · Source of business competitive advantage          │
  │  · Most complex, most important                      │
  │  · Where you should deploy your best team            │
  │  · Examples: "Recommendations" and "Price Optimization" in e-commerce │
  ├─────────────────────────────────────────────────────┤
  │  Supporting Subdomain                                │
  │  · Necessary functionality that supports the core    │
  │  · Business-specific but not as critical as core     │
  │  · Can be outsourced but customization is needed     │
  │  · Examples: "Inventory Management" and "Shipping Management" in e-commerce │
  ├─────────────────────────────────────────────────────┤
  │  Generic Subdomain                                   │
  │  · Functionality common to any company               │
  │  · Can be replaced with existing solutions (SaaS, OSS) │
  │  · No reason to build in-house                       │
  │  · Examples: "Authentication", "Email Sending", "File Storage" │
  └─────────────────────────────────────────────────────┘

  Resource allocation guidelines:
    Core Domain:       70% of resources → Full DDD applied
    Supporting Domain: 20% of resources → DDD tactical patterns only
    Generic Domain:    10% of resources → Use existing solutions
```

### 2.4 Ubiquitous Language

```python
# Example of ubiquitous language: Order context for an e-commerce site

# NG: Modeled in technical language
class OrderData:
    def update_status(self, new_status: int):  # status is a number
        self.status_code = new_status

# OK: Modeled in domain expert language
class Order:
    """Order: The customer's expression of intent to purchase a product"""

    def place(self) -> None:
        """Confirm the order"""
        # Domain experts say "confirm the order"
        # → Method name is place, not place_order
        ...

    def cancel(self) -> None:
        """Cancel the order"""
        ...

    def ship(self) -> None:
        """Ship the order"""
        ...

# Ubiquitous language glossary (defined per context)
"""
Order Context Glossary:
  Order:      The customer's expression of intent to purchase a product
  Place:      The act of confirming order contents and starting processing
  Cancel:     The act of invalidating an order before or after it is placed
  OrderItem:  The combination of an individual product and quantity included in an order
  Customer:   The entity that places an order (has name and contact info)
"""
```

---

## 3. Implementing Tactical Patterns

### 3.1 Aggregate Structure

```
   Aggregate
  +---------------------------------------------+
  |  [Order] ← Aggregate Root                    |
  |     |                                        |
  |     +-- OrderItem (Value Object / Entity)    |
  |     +-- OrderItem                            |
  |     +-- ShippingAddress (Value Object)       |
  |     +-- PaymentInfo (Value Object)           |
  +---------------------------------------------+

  Rules:
  1. No direct access from outside the aggregate to its internals
  2. All operations go through the aggregate root
  3. 1 transaction = 1 aggregate change
  4. References between aggregates use ID only
  5. Keep aggregates as small as possible
```

**Criteria for aggregate design decisions:**

```
Questions to determine aggregate boundaries:

  Q1: Must these objects always be changed together?
    → Yes: place in the same aggregate
    → No: place in separate aggregates

  Q2: Is strong consistency (immediate consistency) required between these objects?
    → Yes: place in the same aggregate
    → No (eventual consistency is sufficient): place in separate aggregates

  Q3: Can this aggregate be updated in a single transaction?
    → Yes → OK
    → No → The aggregate is too large; consider splitting
```

### 3.2 Value Object

```python
# domain/value_objects/money.py
from dataclasses import dataclass

@dataclass(frozen=True)     # Immutable
class Money:
    """
    Value object representing a monetary amount

    Characteristics of value objects:
    1. Immutable: Cannot be changed once created
    2. Equality by value: Identical if all attributes are the same (not by ID)
    3. No side effects: Operations return a new object
    4. Self-validating: Validation at creation time
    """
    amount: int              # Smallest unit (yen)
    currency: str = "JPY"

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError(f"Amount must be 0 or more: {self.amount}")
        if not self.currency:
            raise ValueError("Currency code is required")

    def add(self, other: 'Money') -> 'Money':
        """Addition: returns a new Money (the original object is immutable)"""
        if self.currency != other.currency:
            raise ValueError(
                f"Currencies differ: {self.currency} vs {other.currency}"
            )
        return Money(
            amount=self.amount + other.amount,
            currency=self.currency,
        )

    def subtract(self, other: 'Money') -> 'Money':
        """Subtraction"""
        if self.currency != other.currency:
            raise ValueError(
                f"Currencies differ: {self.currency} vs {other.currency}"
            )
        if self.amount < other.amount:
            raise ValueError(
                f"Negative amount is invalid: {self.amount} - {other.amount}"
            )
        return Money(
            amount=self.amount - other.amount,
            currency=self.currency,
        )

    def multiply(self, factor: int) -> 'Money':
        """Multiplication"""
        return Money(amount=self.amount * factor, currency=self.currency)

    def is_greater_than(self, other: 'Money') -> bool:
        """Comparison"""
        if self.currency != other.currency:
            raise ValueError("Currencies differ")
        return self.amount > other.amount

    def __str__(self) -> str:
        if self.currency == "JPY":
            return f"¥{self.amount:,}"
        return f"{self.amount / 100:.2f} {self.currency}"


# domain/value_objects/address.py
@dataclass(frozen=True)
class Address:
    """Value object representing an address"""
    postal_code: str
    prefecture: str
    city: str
    street: str
    building: str = ""

    def __post_init__(self):
        if not self.postal_code or len(self.postal_code) != 7:
            raise ValueError(f"Postal code must be 7 digits: {self.postal_code}")
        if not self.prefecture:
            raise ValueError("Prefecture is required")
        if not self.city:
            raise ValueError("City is required")

    @property
    def full_address(self) -> str:
        parts = [self.prefecture, self.city, self.street]
        if self.building:
            parts.append(self.building)
        return " ".join(parts)


# domain/value_objects/email.py
import re

@dataclass(frozen=True)
class EmailAddress:
    """Value object representing an email address"""
    value: str

    def __post_init__(self):
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, self.value):
            raise ValueError(f"Invalid email address: {self.value}")

    @property
    def domain(self) -> str:
        return self.value.split('@')[1]

    @property
    def local_part(self) -> str:
        return self.value.split('@')[0]

    def __str__(self) -> str:
        return self.value


# domain/value_objects/quantity.py
@dataclass(frozen=True)
class Quantity:
    """Value object representing a quantity"""
    value: int

    def __post_init__(self):
        if self.value < 0:
            raise ValueError(f"Quantity must be 0 or more: {self.value}")

    def add(self, other: 'Quantity') -> 'Quantity':
        return Quantity(value=self.value + other.value)

    def subtract(self, other: 'Quantity') -> 'Quantity':
        if self.value < other.value:
            raise ValueError("Insufficient stock")
        return Quantity(value=self.value - other.value)

    def is_zero(self) -> bool:
        return self.value == 0
```

### 3.3 Entity and Aggregate Root

```python
# domain/entities/order.py
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional
from domain.value_objects.money import Money
from domain.value_objects.address import Address

class OrderStatus(Enum):
    DRAFT = "draft"
    PLACED = "placed"
    PAID = "paid"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

@dataclass
class OrderItem:
    """
    Order line item entity (used only within the aggregate)

    Note: OrderItem is not accessed directly from outside the aggregate.
    All operations go through Order (the aggregate root).
    """
    id: str
    product_id: str            # References to other aggregates use ID only
    product_name: str
    unit_price: Money
    quantity: int

    def __post_init__(self):
        if self.quantity < 1:
            raise ValueError(f"Quantity must be 1 or more: {self.quantity}")

    @property
    def subtotal(self) -> Money:
        return self.unit_price.multiply(self.quantity)

    def change_quantity(self, new_quantity: int) -> None:
        """Change quantity (only called via the aggregate root)"""
        if new_quantity < 1:
            raise ValueError(f"Quantity must be 1 or more: {new_quantity}")
        self.quantity = new_quantity


@dataclass
class Order:
    """
    Order aggregate root

    Design principles:
    - All business rules are encapsulated within this class
    - Operations on internal objects (OrderItem) must go
      through this class's methods
    - Generates domain events to notify external parties of changes
    """
    id: str
    customer_id: str              # References to other aggregates use ID only
    items: List[OrderItem] = field(default_factory=list)
    shipping_address: Optional[Address] = None
    status: OrderStatus = OrderStatus.DRAFT
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    _domain_events: List = field(default_factory=list, repr=False)

    # --- Business rule constants ---
    MAX_ITEMS = 50
    MIN_ORDER_AMOUNT = Money(100)   # Minimum order amount: 100 yen

    # --- Aggregate invariants ---

    @property
    def total_amount(self) -> Money:
        """Calculate the total amount"""
        total = Money(0)
        for item in self.items:
            total = total.add(item.subtotal)
        return total

    @property
    def item_count(self) -> int:
        return len(self.items)

    # --- Commands (operations that change state) ---

    def add_item(self, item: OrderItem) -> None:
        """Add a line item to the order"""
        if self.status != OrderStatus.DRAFT:
            raise ValueError("Line items can only be added in draft status")
        if len(self.items) >= self.MAX_ITEMS:
            raise ValueError(f"Maximum {self.MAX_ITEMS} line items per order")

        # If the same product exists, add the quantity
        existing = self._find_item_by_product(item.product_id)
        if existing:
            existing.change_quantity(existing.quantity + item.quantity)
        else:
            self.items.append(item)
        self.updated_at = datetime.now()

    def remove_item(self, product_id: str) -> None:
        """Remove a line item from the order"""
        if self.status != OrderStatus.DRAFT:
            raise ValueError("Line items can only be removed in draft status")
        existing = self._find_item_by_product(product_id)
        if not existing:
            raise ValueError(f"No matching line item found: {product_id}")
        self.items.remove(existing)
        self.updated_at = datetime.now()

    def set_shipping_address(self, address: Address) -> None:
        """Set the shipping address"""
        if self.status not in (OrderStatus.DRAFT, OrderStatus.PLACED):
            raise ValueError("Address can only be changed before or after confirmation")
        self.shipping_address = address
        self.updated_at = datetime.now()

    def place(self) -> None:
        """Confirm the order"""
        if self.status != OrderStatus.DRAFT:
            raise ValueError(
                f"Can only be confirmed in draft status (current: {self.status.value})"
            )
        if not self.items:
            raise ValueError("Cannot confirm an order with no line items")
        if not self.shipping_address:
            raise ValueError("Shipping address is not set")
        if not self.total_amount.is_greater_than(self.MIN_ORDER_AMOUNT):
            raise ValueError(
                f"Minimum order amount ({self.MIN_ORDER_AMOUNT}) has not been reached"
            )

        self.status = OrderStatus.PLACED
        self.updated_at = datetime.now()

        # Generate domain event
        self._domain_events.append(OrderPlaced(
            order_id=self.id,
            customer_id=self.customer_id,
            total_amount=self.total_amount.amount,
            item_count=self.item_count,
            occurred_at=datetime.now(),
        ))

    def pay(self, payment_id: str) -> None:
        """Mark the order as paid"""
        if self.status != OrderStatus.PLACED:
            raise ValueError(
                f"Payment is only possible in placed status (current: {self.status.value})"
            )
        self.status = OrderStatus.PAID
        self.updated_at = datetime.now()
        self._domain_events.append(OrderPaid(
            order_id=self.id,
            payment_id=payment_id,
            amount=self.total_amount.amount,
            occurred_at=datetime.now(),
        ))

    def ship(self, tracking_number: str) -> None:
        """Ship the order"""
        if self.status != OrderStatus.PAID:
            raise ValueError(
                f"Shipping is only possible in paid status (current: {self.status.value})"
            )
        self.status = OrderStatus.SHIPPED
        self.updated_at = datetime.now()
        self._domain_events.append(OrderShipped(
            order_id=self.id,
            tracking_number=tracking_number,
            occurred_at=datetime.now(),
        ))

    def cancel(self) -> None:
        """Cancel the order"""
        cancellable = (OrderStatus.DRAFT, OrderStatus.PLACED, OrderStatus.PAID)
        if self.status not in cancellable:
            raise ValueError(
                f"Cannot cancel (current: {self.status.value})"
            )
        self.status = OrderStatus.CANCELLED
        self.updated_at = datetime.now()
        self._domain_events.append(OrderCancelled(
            order_id=self.id,
            occurred_at=datetime.now(),
        ))

    # --- Domain event management ---

    def collect_events(self) -> List:
        """
        Collect domain events

        Called by the application service,
        which then publishes the collected events to the event bus.
        """
        events = list(self._domain_events)
        self._domain_events.clear()
        return events

    # --- Internal helpers ---

    def _find_item_by_product(self, product_id: str) -> Optional[OrderItem]:
        return next(
            (i for i in self.items if i.product_id == product_id), None
        )

    # --- State transition diagram ---
    # DRAFT → PLACED → PAID → SHIPPED → DELIVERED
    #   ↓       ↓       ↓
    # CANCELLED CANCELLED CANCELLED
```

### 3.4 Domain Events

```python
# domain/events/order_events.py
from dataclasses import dataclass
from datetime import datetime

@dataclass(frozen=True)
class DomainEvent:
    """Base class for domain events"""
    occurred_at: datetime

@dataclass(frozen=True)
class OrderPlaced(DomainEvent):
    """Order confirmed event"""
    order_id: str
    customer_id: str
    total_amount: int
    item_count: int

@dataclass(frozen=True)
class OrderPaid(DomainEvent):
    """Order payment completed event"""
    order_id: str
    payment_id: str
    amount: int

@dataclass(frozen=True)
class OrderShipped(DomainEvent):
    """Order shipped event"""
    order_id: str
    tracking_number: str

@dataclass(frozen=True)
class OrderCancelled(DomainEvent):
    """Order cancelled event"""
    order_id: str
```

**WHY use domain events?**

```
Benefits of domain events:

  1. Loose coupling between aggregates
     Directly calling inventory reservation from order confirmation raises coupling
     Order confirmed → publish OrderPlaced event → inventory service subscribes
     → The order service does not know the inventory service exists

  2. Automatic audit log generation
     Recording all events allows tracking what happened and when
     Easy to extend to event sourcing

  3. Separation of side effects
     Separates "core logic" of order confirmation from "notification email sending"
     → Easier to test

  4. Ease of adding new features
     Adding "award points on order confirmation"
     → No changes to existing code; just add a new event handler
```

### 3.5 Domain Services

```python
# domain/services/pricing_service.py

class PricingService:
    """
    Pricing domain service

    WHY a domain service?
    - Discount calculation does not belong to a single entity
    - It crosses Order, Customer, and CouponCode information
    - Putting it in an entity method would bloat one of them
    → Logic spanning multiple aggregates belongs in a domain service
    """

    def calculate_discount(
        self,
        order: 'Order',
        customer_tier: str,
        coupon_code: str | None = None,
    ) -> Money:
        """Calculate the discount amount"""
        base_amount = order.total_amount

        # Discount based on membership tier
        tier_discount_rate = {
            "gold": 0.10,
            "silver": 0.05,
            "bronze": 0.02,
            "regular": 0.00,
        }
        rate = tier_discount_rate.get(customer_tier, 0.00)
        tier_discount = Money(int(base_amount.amount * rate))

        # Coupon discount
        coupon_discount = Money(0)
        if coupon_code:
            coupon_discount = self._apply_coupon(coupon_code, base_amount)

        # Total discount (maximum: 30% of order amount)
        total_discount = tier_discount.add(coupon_discount)
        max_discount = Money(int(base_amount.amount * 0.30))

        if total_discount.is_greater_than(max_discount):
            return max_discount
        return total_discount

    def _apply_coupon(self, code: str, amount: Money) -> Money:
        # In practice, retrieved from the coupon repository
        coupon_values = {"SAVE500": Money(500), "SAVE1000": Money(1000)}
        return coupon_values.get(code, Money(0))


# domain/services/transfer_service.py

class MoneyTransferService:
    """
    Money transfer domain service

    WHY a domain service?
    - A transfer is an operation that spans two Account aggregates
    - The orchestration of calling Account.withdraw() and Account.deposit()
      in the right order does not belong to either Account
    """

    def transfer(
        self,
        source: 'Account',
        target: 'Account',
        amount: Money,
    ) -> None:
        if source.id == target.id:
            raise ValueError("Cannot transfer to the same account")
        source.withdraw(amount)
        target.deposit(amount)
```

### 3.6 Repository

```python
# domain/repositories/order_repository.py (interface)
from typing import Protocol, Optional, List

class OrderRepository(Protocol):
    """
    Order repository interface

    Notes:
    - Repositories are defined per aggregate
    - Do not create a repository for OrderItem (go through the aggregate root)
    - Interface lives in the domain layer, implementation in the infrastructure layer
    """
    def save(self, order: Order) -> None: ...
    def find_by_id(self, order_id: str) -> Optional[Order]: ...
    def find_by_customer(self, customer_id: str) -> List[Order]: ...
    def next_id(self) -> str: ...


# infrastructure/repositories/sqlalchemy_order_repository.py (implementation)
from sqlalchemy.orm import Session

class SQLAlchemyOrderRepository:
    """SQLAlchemy implementation of OrderRepository"""

    def __init__(self, session: Session):
        self._session = session

    def save(self, order: Order) -> None:
        model = self._to_model(order)
        self._session.merge(model)
        self._session.flush()

    def find_by_id(self, order_id: str) -> Optional[Order]:
        model = self._session.query(OrderModel).get(order_id)
        return self._to_entity(model) if model else None

    def find_by_customer(self, customer_id: str) -> List[Order]:
        models = (
            self._session.query(OrderModel)
            .filter(OrderModel.customer_id == customer_id)
            .order_by(OrderModel.created_at.desc())
            .all()
        )
        return [self._to_entity(m) for m in models]

    def next_id(self) -> str:
        import uuid
        return str(uuid.uuid4())

    def _to_model(self, order: Order) -> 'OrderModel':
        """Domain entity → DB model"""
        return OrderModel(
            id=order.id,
            customer_id=order.customer_id,
            status=order.status.value,
            total_amount=order.total_amount.amount,
            shipping_postal_code=order.shipping_address.postal_code if order.shipping_address else None,
            shipping_prefecture=order.shipping_address.prefecture if order.shipping_address else None,
            shipping_city=order.shipping_address.city if order.shipping_address else None,
            shipping_street=order.shipping_address.street if order.shipping_address else None,
            created_at=order.created_at,
            updated_at=order.updated_at,
            items=[
                OrderItemModel(
                    id=item.id,
                    product_id=item.product_id,
                    product_name=item.product_name,
                    unit_price=item.unit_price.amount,
                    quantity=item.quantity,
                )
                for item in order.items
            ],
        )

    def _to_entity(self, model: 'OrderModel') -> Order:
        """DB model → domain entity"""
        shipping_address = None
        if model.shipping_postal_code:
            shipping_address = Address(
                postal_code=model.shipping_postal_code,
                prefecture=model.shipping_prefecture,
                city=model.shipping_city,
                street=model.shipping_street,
            )

        return Order(
            id=model.id,
            customer_id=model.customer_id,
            items=[
                OrderItem(
                    id=item.id,
                    product_id=item.product_id,
                    product_name=item.product_name,
                    unit_price=Money(item.unit_price),
                    quantity=item.quantity,
                )
                for item in model.items
            ],
            shipping_address=shipping_address,
            status=OrderStatus(model.status),
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
```

### 3.7 Application Service

```python
# application/services/order_service.py

class PlaceOrderService:
    """
    Place order application service

    Responsibilities of an application service:
    - Transaction management
    - Retrieving aggregates from repositories
    - Invoking domain logic (acting as an orchestrator)
    - Publishing domain events
    - Exception handling

    Note: Do NOT write business rules here!
    Business rules belong in entities / domain services.
    """

    def __init__(
        self,
        order_repo: OrderRepository,
        event_publisher: EventPublisher,
        unit_of_work: UnitOfWork,
    ):
        self._order_repo = order_repo
        self._events = event_publisher
        self._uow = unit_of_work

    def execute(self, order_id: str) -> PlaceOrderOutput:
        with self._uow:
            # 1. Retrieve the aggregate
            order = self._order_repo.find_by_id(order_id)
            if not order:
                raise OrderNotFoundError(order_id)

            # 2. Execute domain logic (delegated to the Entity)
            order.place()

            # 3. Persist
            self._order_repo.save(order)

            # 4. Publish domain events
            for event in order.collect_events():
                self._events.publish(event)

            # 5. Commit
            self._uow.commit()

        return PlaceOrderOutput(
            order_id=order.id,
            status=order.status.value,
            total_amount=order.total_amount.amount,
        )


class CreateOrderService:
    """Create order application service"""

    def __init__(
        self,
        order_repo: OrderRepository,
        product_repo: ProductRepository,
        unit_of_work: UnitOfWork,
    ):
        self._order_repo = order_repo
        self._product_repo = product_repo
        self._uow = unit_of_work

    def execute(self, input_dto: CreateOrderInput) -> CreateOrderOutput:
        with self._uow:
            order_id = self._order_repo.next_id()

            # Retrieve product information and build OrderItems
            items = []
            for item_input in input_dto.items:
                product = self._product_repo.find_by_id(item_input.product_id)
                if not product:
                    raise ProductNotFoundError(item_input.product_id)
                items.append(OrderItem(
                    id=f"{order_id}-{len(items)+1}",
                    product_id=product.id,
                    product_name=product.name,
                    unit_price=Money(product.price),
                    quantity=item_input.quantity,
                ))

            # Create the aggregate
            order = Order(id=order_id, customer_id=input_dto.customer_id)
            for item in items:
                order.add_item(item)

            if input_dto.shipping_address:
                order.set_shipping_address(input_dto.shipping_address)

            # Persist
            self._order_repo.save(order)
            self._uow.commit()

        return CreateOrderOutput(
            order_id=order.id,
            item_count=order.item_count,
            total_amount=order.total_amount.amount,
            status=order.status.value,
        )
```

### 3.8 Factory Pattern

```python
# domain/factories/order_factory.py

class OrderFactory:
    """
    Order factory

    WHY a factory?
    - Encapsulates complex aggregate creation logic
    - Centralizes invariants (validation) at creation time
    - Can be swapped out in tests
    """

    def __init__(self, id_generator: IdGenerator):
        self._id_gen = id_generator

    def create_from_cart(
        self,
        customer_id: str,
        cart_items: List[CartItemDTO],
        shipping_address: Address,
    ) -> Order:
        """Create an order from a shopping cart"""
        order_id = self._id_gen.generate()
        order = Order(
            id=order_id,
            customer_id=customer_id,
            shipping_address=shipping_address,
        )

        for cart_item in cart_items:
            order.add_item(OrderItem(
                id=f"{order_id}-{cart_item.product_id}",
                product_id=cart_item.product_id,
                product_name=cart_item.product_name,
                unit_price=Money(cart_item.price),
                quantity=cart_item.quantity,
            ))

        return order

    def reconstitute(
        self,
        id: str,
        customer_id: str,
        items: List[dict],
        status: str,
        **kwargs,
    ) -> Order:
        """Reconstruct an aggregate from persisted data"""
        # Used in the repository's _to_entity
        order = Order(
            id=id,
            customer_id=customer_id,
            status=OrderStatus(status),
            **kwargs,
        )
        # Skip validation during reconstruction
        order.items = [
            OrderItem(**item_data) for item_data in items
        ]
        return order
```

---

## 4. Eventual Consistency and the Saga Pattern

### 4.1 Eventual Consistency

```
Consistency Between Aggregates: Eventual Consistency Is the Default

  [Order Context]                 [Inventory Context]
  ┌─────────────┐              ┌─────────────┐
  │  Order placed │              │  Stock reserved│
  │  (immediate)  │              │  (async)      │
  └──────┬──────┘              └──────┬──────┘
         │                            │
         │  OrderPlaced event          │
         └──────────────────────────>│
                                      │ StockReserved or
                                      │ StockReserveFailed
                                      └──────────────>...

  Strong consistency (same transaction):
    → Only between objects within an aggregate
    → Order and OrderItem are always consistent

  Eventual consistency (async events):
    → Between aggregates
    → Order confirmation and stock reservation are separate transactions
    → Temporarily inconsistent, but eventually consistent
```

### 4.2 Saga Pattern

```python
# application/sagas/order_saga.py

class OrderSaga:
    """
    Order Saga: manages a business process spanning multiple aggregates

    Flow:
    1. Order confirmed → OrderPlaced
    2. Stock reserved → StockReserved or StockReserveFailed
    3. Payment processed → PaymentCompleted or PaymentFailed
    4. Shipment instructed → ShipmentCreated

    If any step fails,
    the preceding steps are compensated (rolled back).
    """

    def __init__(
        self,
        order_repo: OrderRepository,
        inventory_service: InventoryService,
        payment_service: PaymentService,
        event_publisher: EventPublisher,
    ):
        self._order_repo = order_repo
        self._inventory = inventory_service
        self._payment = payment_service
        self._events = event_publisher

    def handle_order_placed(self, event: OrderPlaced) -> None:
        """Handle the order placed event"""
        try:
            # Step 1: Reserve stock
            reservation_id = self._inventory.reserve(
                order_id=event.order_id,
                items=self._get_order_items(event.order_id),
            )

            # Step 2: Process payment
            payment_id = self._payment.charge(
                customer_id=event.customer_id,
                amount=event.total_amount,
            )

            # Step 3: Record payment information on the order
            order = self._order_repo.find_by_id(event.order_id)
            order.pay(payment_id)
            self._order_repo.save(order)

        except InventoryError:
            # Stock reservation failed → cancel order
            self._cancel_order(event.order_id, "Insufficient stock")

        except PaymentError:
            # Payment failed → release stock reservation, then cancel order
            self._inventory.release(event.order_id)
            self._cancel_order(event.order_id, "Payment failed")

    def _cancel_order(self, order_id: str, reason: str) -> None:
        """Compensating cancel of the order"""
        order = self._order_repo.find_by_id(order_id)
        if order:
            order.cancel()
            self._order_repo.save(order)
            self._events.publish(OrderCancelled(
                order_id=order_id,
                occurred_at=datetime.now(),
            ))
```

```
Saga Pattern Compensation Flow:

  Happy path:
    Order confirmed → Stock reserved → Payment completed → Shipment instructed

  Stock reservation failed:
    Order confirmed → Stock reserve (failed) → Order cancel (compensate)

  Payment failed:
    Order confirmed → Stock reserved → Payment (failed)
      → Stock release (compensate) → Order cancel (compensate)

  Shipment failed:
    Order confirmed → Stock reserved → Payment completed → Shipment (failed)
      → Refund (compensate) → Stock release (compensate) → Order cancel (compensate)
```

---

## 5. Testing

```python
# tests/unit/test_order.py
import pytest
from datetime import datetime

class TestOrder:
    """Tests for the Order aggregate"""

    def _make_item(self, **kwargs) -> OrderItem:
        defaults = {
            'id': 'item-1',
            'product_id': 'prod-1',
            'product_name': 'Test Product',
            'unit_price': Money(1000),
            'quantity': 2,
        }
        defaults.update(kwargs)
        return OrderItem(**defaults)

    def _make_order(self, **kwargs) -> Order:
        defaults = {
            'id': 'order-1',
            'customer_id': 'cust-1',
        }
        defaults.update(kwargs)
        return Order(**defaults)

    def test_total_amount_calculated_after_adding_items(self):
        order = self._make_order()
        order.add_item(self._make_item(
            unit_price=Money(1000), quantity=2
        ))
        order.add_item(self._make_item(
            id='item-2', product_id='prod-2',
            unit_price=Money(500), quantity=3,
        ))
        assert order.total_amount == Money(3500)

    def test_adding_same_product_accumulates_quantity(self):
        order = self._make_order()
        order.add_item(self._make_item(quantity=2))
        order.add_item(self._make_item(quantity=3))
        assert len(order.items) == 1
        assert order.items[0].quantity == 5

    def test_adding_item_fails_in_non_draft_status(self):
        order = self._make_order()
        order.add_item(self._make_item())
        order.set_shipping_address(Address(
            postal_code='1000001', prefecture='Tokyo',
            city='Chiyoda', street='Marunouchi 1-1-1',
        ))
        order.place()
        with pytest.raises(ValueError, match="only in draft status"):
            order.add_item(self._make_item(product_id='prod-2'))

    def test_event_generated_on_order_placed(self):
        order = self._make_order()
        order.add_item(self._make_item())
        order.set_shipping_address(Address(
            postal_code='1000001', prefecture='Tokyo',
            city='Chiyoda', street='Marunouchi 1-1-1',
        ))
        order.place()

        events = order.collect_events()
        assert len(events) == 1
        assert isinstance(events[0], OrderPlaced)
        assert events[0].order_id == 'order-1'

    def test_shipped_order_cannot_be_cancelled(self):
        order = self._make_order()
        order.add_item(self._make_item())
        order.set_shipping_address(Address(
            postal_code='1000001', prefecture='Tokyo',
            city='Chiyoda', street='Marunouchi 1-1-1',
        ))
        order.place()
        order.pay("pay-1")
        order.ship("track-123")
        with pytest.raises(ValueError, match="Cannot cancel"):
            order.cancel()


class TestMoney:
    """Tests for the Money value object"""

    def test_addition(self):
        a = Money(1000)
        b = Money(500)
        assert a.add(b) == Money(1500)

    def test_adding_different_currencies_raises_error(self):
        jpy = Money(1000, "JPY")
        usd = Money(500, "USD")
        with pytest.raises(ValueError, match="Currencies differ"):
            jpy.add(usd)

    def test_immutability(self):
        a = Money(1000)
        b = a.add(Money(500))
        assert a.amount == 1000   # The original object is unchanged
        assert b.amount == 1500

    def test_equality(self):
        a = Money(1000, "JPY")
        b = Money(1000, "JPY")
        assert a == b             # Compared by value

    def test_negative_amount_raises_error(self):
        with pytest.raises(ValueError, match="Amount must be 0 or more"):
            Money(-100)
```

---

## 6. Comparison Tables

### 6.1 Entity vs Value Object

| Characteristic | Entity | Value Object |
|------|-----------|-------------|
| Identity | Identified by ID | Identified by value |
| Mutability | Mutable | Immutable |
| Lifecycle | Create, change, delete | Creation only (changes create a new instance) |
| Examples | Order, User, Product | Money, Address, Email |
| Equality | Same if id is the same | Same if all attributes are the same |
| Testing | Verify state transitions | Verify value calculations |
| Persistence | Own table / collection | Embedded in parent entity |

### 6.2 List of Tactical Patterns

| Pattern | Responsibility | Layer | Usage Examples |
|---------|------|-------|--------|
| Entity | Business rules + ID | Domain layer | Order, User |
| Value Object | Immutable value representation | Domain layer | Money, Address |
| Aggregate | Transaction boundary | Domain layer | Order + OrderItems |
| Domain Service | Logic spanning multiple aggregates | Domain layer | PricingService |
| Domain Event | Async coordination between aggregates | Domain layer | OrderPlaced |
| Repository | Persisting and retrieving aggregates | Interface=Domain, Implementation=Infrastructure | OrderRepository |
| Factory | Creating complex aggregates | Domain layer | OrderFactory |
| Application Service | Orchestrating use cases | Application layer | PlaceOrderService |

### 6.3 Application Service vs Domain Service

| Aspect | Application Service | Domain Service |
|------|----------------------|----------------|
| Layer | Application layer | Domain layer |
| Responsibility | Orchestrating use cases | Business logic spanning multiple aggregates |
| Transaction management | Yes | No |
| External dependencies | Depends on repositories, events, etc. | Depends only on domain layer |
| Business rules | Not included (delegated to Entity) | Included (cross-aggregate rules) |
| Testing | Closer to integration tests | Unit tests |
| Examples | PlaceOrderService | PricingService, TransferService |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Anemic Domain Model

```python
# NG: Entity has no logic; everything is concentrated in the service
@dataclass
class Order:
    id: str
    status: str
    items: list
    # ← Just a data container with no business rules

class OrderService:
    def place_order(self, order):
        if order.status != "draft":
            raise ValueError("...")
        if not order.items:
            raise ValueError("...")
        order.status = "placed"
        # ← Logic that should belong to the Order entity
    # → State transition rules for Order are scattered across Services
    # → Multiple Services manipulating the same Order can cause inconsistencies

# OK: Entity itself holds the business rules (Rich Domain Model)
class Order:
    def place(self):
        if self.status != "draft":
            raise ValueError("Can only be confirmed in draft status")
        if not self.items:
            raise ValueError("Cannot confirm an order with no line items")
        self.status = "placed"
        # → Rules are centralized in Order
        # → The same rules are applied regardless of where it is called from
```

**WHY is this a problem?**

In an anemic model, entities become mere "data containers" and business rules are scattered across service classes. When multiple services operate on the same entity, it is easy for rules to be missed or for contradictions to arise. Martin Fowler calls this "the worst anti-pattern for a domain model."

### Anti-Pattern 2: Aggregate That Is Too Large

```
NG: Include everything in a single aggregate
  Order (aggregate root)
    ├── Customer (all attributes)       ← Should be a separate aggregate
    ├── Product (all attributes) x N    ← Should be a separate aggregate
    ├── PaymentHistory x N             ← Should be a separate aggregate
    └── ShippingLog x N                ← Should be a separate aggregate
  → Loading a huge object on every update
  → Frequent optimistic lock conflicts on concurrent updates
  → Difficult to test (requires a lot of setup)

OK: Keep aggregates small, reference by ID
  Order (aggregate root)
    ├── customer_id: str               ← ID only
    ├── OrderItem x N
    │     └── product_id: str          ← ID only
    └── shipping_address: Address      ← Value object (embedded)
  → Lightweight and fast to load
  → Minimal concurrent update conflicts
  → Easy to test
```

### Anti-Pattern 3: Using Domain Events for Everything

```python
# NG: Making even intra-aggregate processing event-driven
class Order:
    def place(self):
        self.status = "placed"
        # Recalculating the total amount via an event (excessive)
        self._events.append(RecalculateTotal(self.id))

# OK: Maintain consistency within the same aggregate synchronously
class Order:
    def place(self):
        if self.total_amount.amount < 100:
            raise ValueError("Minimum order amount has not been reached")
        self.status = "placed"
        # Events are for notifying parties "outside" the aggregate
        self._domain_events.append(OrderPlaced(...))
```

### Anti-Pattern 4: Repository Returning Non-Aggregate-Root Objects

```python
# NG: Repository returns something other than the aggregate root
class OrderRepository:
    def find_item_by_id(self, item_id: str) -> OrderItem:
        # Returning OrderItem directly allows bypassing aggregate invariants
        ...

# OK: Repository always returns the aggregate root
class OrderRepository:
    def find_by_id(self, order_id: str) -> Order:
        # Return Order (the aggregate root)
        # Access to OrderItem goes through Order
        ...
```

---

## 8. Practical Exercises

### Exercise 1 (Basic): Designing a Value Object

**Task**: Implement a value object `PhoneNumber` representing a Japanese phone number.

```
Specification:
- Format: 10-11 digits of numbers only (after removing hyphens)
- Display method: format as "090-1234-5678"
- Equality by value
- Immutable
```

**Expected implementation and output**:

```python
import re
from dataclasses import dataclass

@dataclass(frozen=True)
class PhoneNumber:
    """Value object representing a Japanese phone number"""
    value: str   # Numeric string without hyphens

    def __post_init__(self):
        # Normalize by removing hyphens
        cleaned = self.value.replace('-', '').replace(' ', '')
        if not cleaned.isdigit():
            raise ValueError(f"Contains non-numeric characters: {self.value}")
        if len(cleaned) < 10 or len(cleaned) > 11:
            raise ValueError(f"Phone number must be 10-11 digits: {cleaned} ({len(cleaned)} digits)")
        # Can be set in __post_init__ even with frozen=True
        object.__setattr__(self, 'value', cleaned)

    @property
    def formatted(self) -> str:
        """Display format with hyphens"""
        v = self.value
        if len(v) == 11 and v.startswith('0'):
            # Mobile phone: 090-1234-5678
            return f"{v[:3]}-{v[3:7]}-{v[7:]}"
        elif len(v) == 10:
            # Landline: 03-1234-5678
            return f"{v[:2]}-{v[2:6]}-{v[6:]}"
        return v

    def __str__(self) -> str:
        return self.formatted


# Test
p1 = PhoneNumber("090-1234-5678")
p2 = PhoneNumber("09012345678")
print(p1.formatted)     # Output: 090-1234-5678
print(p1 == p2)          # Output: True (compared by value)
print(p1.value)          # Output: 09012345678

p3 = PhoneNumber("03-1234-5678")
print(p3.formatted)     # Output: 03-1234-5678

try:
    PhoneNumber("123")
except ValueError as e:
    print(f"Error: {e}")  # Output: Error: Phone number must be 10-11 digits: 123 (3 digits)
```

### Exercise 2 (Intermediate): Designing and Implementing an Aggregate

**Task**: Design and implement a "Stock" aggregate with the following specifications.

```
Specification:
- Manage product ID, current stock count, and reserved count
- Receive stock (receive): increase stock count
- Reserve stock (reserve): increase reserved count (must not exceed available count)
- Release reservation (release): decrease reserved count
- Ship (ship): decrease both reserved count and stock count
- Available count = stock count - reserved count
```

**Expected implementation and output**:

```python
@dataclass
class Stock:
    """Stock aggregate root"""
    product_id: str
    quantity: int = 0           # Current stock count
    reserved: int = 0           # Reserved count
    _domain_events: list = field(default_factory=list, repr=False)

    @property
    def available(self) -> int:
        """Available count"""
        return self.quantity - self.reserved

    def receive(self, amount: int) -> None:
        """Receive stock: increase inventory"""
        if amount <= 0:
            raise ValueError("Receive amount must be positive")
        self.quantity += amount
        self._domain_events.append(StockReceived(
            product_id=self.product_id, amount=amount,
        ))

    def reserve(self, amount: int) -> str:
        """Reserve: secure from available count"""
        if amount <= 0:
            raise ValueError("Reservation amount must be positive")
        if self.available < amount:
            raise ValueError(
                f"Insufficient stock: available {self.available} < requested {amount}"
            )
        self.reserved += amount
        reservation_id = f"rsv-{self.product_id}-{self.reserved}"
        self._domain_events.append(StockReserved(
            product_id=self.product_id,
            reservation_id=reservation_id,
            amount=amount,
        ))
        return reservation_id

    def release(self, amount: int) -> None:
        """Release reservation: return reserved amount"""
        if amount <= 0:
            raise ValueError("Release amount must be positive")
        if self.reserved < amount:
            raise ValueError("Release amount exceeds reserved count")
        self.reserved -= amount

    def ship(self, amount: int) -> None:
        """Ship: ship from reserved amount"""
        if amount <= 0:
            raise ValueError("Ship amount must be positive")
        if self.reserved < amount:
            raise ValueError("Ship amount exceeds reserved count")
        self.reserved -= amount
        self.quantity -= amount

    def collect_events(self) -> list:
        events = list(self._domain_events)
        self._domain_events.clear()
        return events


# Test
stock = Stock(product_id="prod-1")
stock.receive(100)
print(f"Stock: {stock.quantity}, Available: {stock.available}")
# Output: Stock: 100, Available: 100

rsv_id = stock.reserve(30)
print(f"After reservation - Stock: {stock.quantity}, Reserved: {stock.reserved}, Available: {stock.available}")
# Output: After reservation - Stock: 100, Reserved: 30, Available: 70

stock.ship(20)
print(f"After shipment - Stock: {stock.quantity}, Reserved: {stock.reserved}, Available: {stock.available}")
# Output: After shipment - Stock: 80, Reserved: 10, Available: 70

try:
    stock.reserve(80)
except ValueError as e:
    print(f"Error: {e}")
# Output: Error: Insufficient stock: available 70 < requested 80
```

### Exercise 3 (Advanced): Context Map and Anti-Corruption Layer

**Task**: Implement an Anti-Corruption Layer for integration with an external payment service (Stripe).

```
Specification:
- Translate between your domain's Payment entity and the external Stripe API model
- Map Stripe's payment_intent to your domain's concepts
- Ensure failures of the external API do not affect your domain model
```

**Expected implementation**:

```python
# Your domain model
@dataclass
class Payment:
    """Payment entity (your domain)"""
    id: str
    order_id: str
    amount: Money
    status: str = "pending"  # pending, completed, failed, refunded

    def complete(self) -> None:
        if self.status != "pending":
            raise ValueError(f"Cannot complete (current: {self.status})")
        self.status = "completed"

    def fail(self, reason: str) -> None:
        self.status = "failed"

    def refund(self) -> None:
        if self.status != "completed":
            raise ValueError("Only completed payments can be refunded")
        self.status = "refunded"


# Anti-Corruption Layer (external model → your domain model translation)
class StripePaymentGateway:
    """
    Anti-Corruption Layer for Stripe integration

    Responsibilities:
    - Translate between your domain concepts and Stripe API concepts
    - Convert Stripe-specific errors into your domain exceptions
    - Absorb the impact of Stripe API specification changes
    """

    def __init__(self, stripe_client):
        self._client = stripe_client

    def charge(self, payment: Payment) -> str:
        """Execute payment and return the external payment_intent_id"""
        try:
            # Stripe API call (external model)
            intent = self._client.PaymentIntent.create(
                amount=payment.amount.amount,
                currency=payment.amount.currency.lower(),
                metadata={
                    'order_id': payment.order_id,
                    'payment_id': payment.id,
                },
            )

            # Translate Stripe status to your domain status
            if intent.status == 'succeeded':
                payment.complete()
            elif intent.status in ('canceled', 'requires_payment_method'):
                payment.fail(f"Stripe status: {intent.status}")
            # Other statuses remain as pending

            return intent.id

        except self._client.error.CardError as e:
            payment.fail(f"Card error: {e.user_message}")
            raise PaymentDeclinedError(str(e))
        except self._client.error.StripeError as e:
            raise PaymentGatewayError(f"Payment service error: {e}")

    def refund(self, payment_intent_id: str, amount: Money) -> str:
        """Execute a refund"""
        try:
            refund = self._client.Refund.create(
                payment_intent=payment_intent_id,
                amount=amount.amount,
            )
            return refund.id
        except self._client.error.StripeError as e:
            raise PaymentGatewayError(f"Refund error: {e}")


# Your domain exceptions (independent of Stripe exceptions)
class PaymentDeclinedError(Exception):
    """Payment was declined"""
    pass

class PaymentGatewayError(Exception):
    """Technical error from the payment gateway"""
    pass

# Fake for testing
class FakeStripeClient:
    """Stripe client for testing"""
    class PaymentIntent:
        @staticmethod
        def create(**kwargs):
            class Intent:
                id = "pi_test_123"
                status = "succeeded"
            return Intent()

# Test
fake_stripe = FakeStripeClient()
gateway = StripePaymentGateway(fake_stripe)
payment = Payment(id="pay-1", order_id="order-1", amount=Money(5000))
intent_id = gateway.charge(payment)
print(f"Payment completed: {intent_id}, status: {payment.status}")
# Output: Payment completed: pi_test_123, status: completed
```

---

## 9. FAQ

### Q1. When should DDD be adopted?

**A.** It is suitable for projects with high domain complexity. The criteria are as follows.

```
DDD Adoption Decision Checklist:

  [x] Business rules are complex (cannot be expressed with simple CRUD)
  [x] Domain experts exist and are accessible
  [x] The project has a long lifespan (1 year or more)
  [x] The team has members with DDD knowledge (or willingness to learn)
  [x] Business competitive advantage depends on the software

  3 or more of the above apply → Recommend adopting DDD
  1-2 → Partially adopt tactical patterns only
  0 → CRUD + traditional architecture is sufficient
```

### Q2. How do you maintain data consistency between aggregates?

**A.** Eventual Consistency is the default. When aggregate A changes, it publishes a domain event, and aggregate B subscribes to that event and updates itself asynchronously. When strong consistency is required, implement compensating transactions with the Saga pattern. It is important not to break the rule of "1 transaction = 1 aggregate."

### Q3. How do you establish ubiquitous language?

**A.** Establish it step by step using the following procedure.

```
Step 1: Extract key terms from conversations with domain experts
Step 2: Create a glossary (per context)
Step 3: Align class names and method names in code with the glossary
Step 4: During reviews, confirm "Would a domain expert use this name?"
Step 5: When new concepts emerge, update the glossary and align the code
```

### Q4. What is the relationship between DDD and CQRS?

**A.** DDD deals with "how to model the domain," while CQRS deals with "how to separate reads and writes." DDD aggregates are models optimized for writing, but they can be inefficient for reads (list display, search, etc.). Using CQRS together enables a division of concerns where the write side uses DDD's rich domain model and the read side uses a Read Model optimized for performance.

### Q5. Is event sourcing required?

**A.** It is not required. Event sourcing is the pattern of "recording all state changes as events and deriving the current state by replaying those events." It is a separate concept from DDD domain events. It is useful in areas where audit logs and time-series analysis are important (finance, healthcare), but it also adds complexity, so the decision should be made carefully. It is practical to start with publishing domain events and evolve to event sourcing as needed.

### Q6. What is the relationship between microservices and DDD?

**A.** DDD's bounded contexts provide natural boundaries for microservices. A design where 1 Bounded Context = 1 Microservice is ideal. However, DDD is also effective in a monolith, and microservices are not a prerequisite for DDD.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important. Understanding deepens not just through theory but by actually writing code and confirming how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is particularly important during code reviews and architectural design.

---

## 10. Summary

| Item | Key Points |
|------|---------|
| Strategic Design | Divide the domain using bounded contexts. Contexts coordinate via events |
| Tactical Design | Model complexity using entities, value objects, aggregates, and domain events |
| Aggregate Design | Keep small. 1 transaction = 1 aggregate. References between aggregates use ID |
| Ubiquitous Language | Use the same language between domain experts and code |
| Avoid Anemic Model | Place business logic in entities; services act only as orchestrators |
| Eventual Consistency | Default to async coordination between aggregates via domain events |
| Domain Service | Container for logic spanning multiple aggregates; rules that don't belong to an entity |
| Saga Pattern | Manage long transactions across multiple aggregates with compensating transactions |
| ACL | A defensive layer that translates external system models into your domain model |
| Subdomain | Optimize resource allocation by classifying as Core / Supporting / Generic |

---

## Guides to Read Next

- [Clean Architecture](./01-clean-architecture.md) — Layered architecture to combine with DDD. Structuring the Entities layer
- [Event-Driven Architecture](./03-event-driven.md) — Loosely coupled design using domain events. Implementation foundation for the Saga pattern
- API Design — Principles for designing APIs that expose aggregates
- Repository Pattern — Persistence patterns for aggregates
- [Fundamentals of System Design](../00-fundamentals/) — Fundamentals of scalability and availability

---

## References

1. **Domain-Driven Design: Tackling Complexity in the Heart of Software** — Eric Evans (Addison-Wesley, 2003) — The original DDD text. Systematic explanation of strategic and tactical design
2. **Implementing Domain-Driven Design** — Vaughn Vernon (Addison-Wesley, 2013) — Detailed DDD implementation patterns. Practical guide to aggregate design and repository implementation
3. **Domain-Driven Design Distilled** — Vaughn Vernon (Addison-Wesley, 2016) — A concise introduction to DDD. Focused on strategic design
4. **Architecture Patterns with Python** — Harry Percival & Bob Gregory (O'Reilly, 2020) — DDD in practice with Python. Implementation examples of Repository and Unit of Work
5. **Patterns, Principles, and Practices of Domain-Driven Design** — Scott Millett & Nick Tune (Wrox, 2015) — A comprehensive catalog of DDD patterns
6. **Event Storming** — Alberto Brandolini — https://www.eventstorming.com/ — A workshop methodology for discovering domain events
