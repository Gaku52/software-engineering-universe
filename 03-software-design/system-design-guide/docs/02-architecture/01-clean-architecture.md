# Clean Architecture

> An architectural pattern based on the Dependency Inversion Principle proposed by Robert C. Martin. This guide explains the design philosophy of isolating business logic from frameworks, databases, and UIs to build testable and change-resistant systems.

---

## What You Will Learn in This Chapter

1. **Concentric Circle Model and the Dependency Rule** — Understand the four-layer structure of Entities, Use Cases, Interface Adapters, and Frameworks, and the inward direction of dependencies.
2. **Implementing Dependency Inversion** — Learn how to abstract external dependencies using interfaces and how to leverage DI containers.
3. **Applying to Real Projects** — Be able to implement directory structures, data transformations between layers, and testing strategies.
4. **Comparison with Similar Architectures** — Be able to judge the differences and appropriate use cases of Hexagonal, Onion, and traditional MVC architectures.
5. **Incremental Adoption and Realistic Trade-offs** — Be able to formulate an adoption strategy based on project scale.

---

## Prerequisites

Before reading this guide, it is desirable to have the following knowledge.

| Topic | Content | Reference |
|---------|------|-----------|
| SOLID Principles | Especially the Dependency Inversion Principle (DIP) and Single Responsibility Principle (SRP) | SOLID Principles |
| Design Pattern Basics | Strategy, Observer, Repository patterns | Design Patterns |
| Python Basics | Understanding of dataclass, Protocol, and type hints | - |
| Testing Basics | Unit testing, concepts of mocks/stubs | Testing Principles |

---

## 1. Background and Philosophy of Clean Architecture

### 1.1 Why Clean Architecture Was Created

Looking back at the history of software development, many projects have fallen into the "framework dependency swamp." Rails application models are tightly coupled to ActiveRecord and cannot be tested; Spring Boot service classes depend on HTTP request objects and cannot be called from batch processes; all business logic is written in Django views making refactoring impossible — all of these stem from the root cause that **business logic depends on external technical details**.

Robert C. Martin (Uncle Bob) proposed "Clean Architecture" in a 2012 blog post "The Clean Architecture," integrating multiple architectural patterns that had been proposed up to that point.

```
Lineage of Clean Architecture

  1979  MVC (Trygve Reenskaug)
         ↓ Concept of UI separation
  1992  BCE (Ivar Jacobson)
         ↓ Boundary-Control-Entity
  2005  Hexagonal Architecture (Alistair Cockburn)
         ↓ Ports & Adapters
  2008  Onion Architecture (Jeffrey Palermo)
         ↓ Domain-centric concentric circles
  2012  Clean Architecture (Robert C. Martin)
         ↓ Integration and systematization of the above
  2017  Book "Clean Architecture" published
```

### 1.2 The Underlying Principles

The core of Clean Architecture can be summarized in three principles.

```
┌─────────────────────────────────────────────────────────┐
│                 Three Core Principles                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Dependency Rule                                     │
│     → Dependencies can only flow from outer to inner    │
│     → Inner code knows nothing about the outer layers   │
│                                                         │
│  2. Abstraction Boundary                                │
│     → Layers communicate via interfaces (abstractions)  │
│     → Concrete implementation details are injected      │
│                                                         │
│  3. Framework Independence                              │
│     → Business logic knows nothing about frameworks     │
│     → Frameworks are treated as plugins                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**WHY: Why are these three principles important?**

Software typically has a lifespan of over 10 years, but external technologies such as web frameworks, databases, and messaging systems go through generational changes every few years. If business logic depends on external technology, the business logic must be rewritten every time the technology is replaced. By limiting dependencies to the inward direction, both **stability of business logic** and **replaceability of external technology** can be achieved.

### 1.3 Problems That Clean Architecture Solves

Contrasting typical problems that arise with traditional architectures against solutions provided by Clean Architecture.

```
Problem 1: Framework Lock-in
  Traditional: Write business logic in Django Model
               → Cannot migrate from Django to FastAPI (logic depends on Django)
  Clean:       Entity is a pure Python class
               → Frameworks can be freely switched

Problem 2: Difficult Testing
  Traditional: Service class directly connects to PostgreSQL
               → DB required for test execution (slow, cumbersome to set up)
  Clean:       UseCase depends on Repository Interface
               → Can inject Fake implementation to test without DB (fast)

Problem 3: Wide Impact Range of Changes
  Traditional: DB schema change → API response format also changes
               → Frontend also needs modification
  Clean:       DB schema change → Only Repository implementation changes
               → UseCase / Entity / API are unaffected

Problem 4: Dispersed Business Logic
  Traditional: Validation scattered across Controller / Service / Model
               → Unclear "where is this rule written?"
  Clean:       Business rules consolidated in Entity
               → Managed in a single place
```

---

## 2. Concentric Circle Model

### 2.1 Four-Layer Structure

```
+---------------------------------------------------------------+
|                    Frameworks & Drivers                         |
|   (Web Framework, DB Driver, External API, UI, Device)         |
|   +-------------------------------------------------------+   |
|   |              Interface Adapters                        |   |
|   |   (Controllers, Gateways, Presenters, ViewModels)      |   |
|   |   +-----------------------------------------------+   |   |
|   |   |              Use Cases                         |   |   |
|   |   |   (Application-Specific Business Rules)        |   |   |
|   |   |   +---------------------------------------+   |   |   |
|   |   |   |           Entities                     |   |   |   |
|   |   |   |   (Enterprise Business Rules)          |   |   |   |
|   |   |   +---------------------------------------+   |   |   |
|   |   +-----------------------------------------------+   |   |
|   +-------------------------------------------------------+   |
+---------------------------------------------------------------+

  Dependency Rule: Only outer → inner dependencies are allowed
  Inner code does not know about the outer layers
```

### 2.2 Detailed Explanation of Each Layer

#### Entities (Enterprise-wide Business Rules)

Located in the innermost layer, these express **business rules shared across the entire enterprise**. They model concepts that are not dependent on a specific application and can be reused in other systems within the same enterprise.

```
Characteristics of the Entities layer:
  ┌────────────────────────────────────────────┐
  │  · Dependency on frameworks: Zero          │
  │  · Dependency on external libraries: Minimal│
  │  · Rate of change: Lowest                  │
  │  · Testing: Easiest (pure unit tests)      │
  │  · Examples: Order, User, Product, Invoice  │
  │  · Contains:                               │
  │    - Entities                              │
  │    - Value Objects                         │
  │    - Domain Events                         │
  │    - Business rules (including validation) │
  └────────────────────────────────────────────┘
```

#### Use Cases (Application-Specific Business Rules)

Implements **business rules specific to a particular application**. Expresses concrete use cases such as "a user creates an order" or "an administrator cancels an order."

```
Characteristics of the Use Cases layer:
  ┌────────────────────────────────────────────┐
  │  · Dependencies: Entities only + Port Interface│
  │  · Rate of change: Moderate               │
  │  · Testing: Easy with Fake/Stub           │
  │  · Examples: CreateOrder, CancelOrder     │
  │  · Contains:                              │
  │    - Use case classes                     │
  │    - Input/Output DTOs                    │
  │    - Ports (repository interfaces, etc.)  │
  │    - Application exceptions               │
  └────────────────────────────────────────────┘
```

#### Interface Adapters (Transformation Layer)

The layer that **transforms data formats** between the external world and the internal world. Converts HTTP requests to UseCase input DTOs, and UseCase output DTOs to HTTP responses. Converts database records to entities, and entities to database records.

```
Characteristics of the Interface Adapters layer:
  ┌────────────────────────────────────────────┐
  │  · Dependencies: Use Cases + Entities      │
  │  · Rate of change: Moderate to High       │
  │  · Testing: Integration tests             │
  │  · Examples:                              │
  │    - Controller (HTTP → UseCase Input)    │
  │    - Presenter (UseCase Output → HTTP)    │
  │    - Repository impl (Entity ↔ DB Record) │
  │    - Gateway (Entity ↔ External API)      │
  └────────────────────────────────────────────┘
```

#### Frameworks & Drivers (External Technical Details)

The outermost layer. **Concrete technical implementations** such as web frameworks, database drivers, and external API clients belong here.

```
Characteristics of the Frameworks & Drivers layer:
  ┌────────────────────────────────────────────┐
  │  · Rate of change: Highest                │
  │  · Testing: E2E tests                     │
  │  · Examples:                              │
  │    - Flask / FastAPI / Django             │
  │    - PostgreSQL / MySQL / MongoDB         │
  │    - Redis / RabbitMQ / Kafka             │
  │    - AWS SDK / GCP Client                 │
  │  · Role: Plugin for technical details     │
  └────────────────────────────────────────────┘
```

### 2.3 Direction of Dependencies and Dependency Inversion

```
  Controller ──depends──> UseCase ──depends──> Entity
       |                   |
       |          UseCase depends on the
       |          "interface" of Repository
       |                   |
       |            <<interface>>
       |           IOrderRepository
       |                   ^
       |                   |  implements
       |                   |
  PostgresOrderRepository ─+
  (Frameworks layer)

  ★ UseCase does not know the concrete DB implementation
  ★ Switching DB to MongoDB requires no changes to UseCase
  ★ Dependency Inversion (DIP) reverses the direction of control flow and dependency
```

**Internal Mechanism of Dependency Inversion:**

In a normal program, it is natural for the "caller to depend on the callee." If a UseCase wants to save data to PostgreSQL, naively written code would have the UseCase directly depend on PostgresOrderRepository. However, this would make the UseCase depend on an outer layer, violating the Dependency Rule.

Dependency Inversion solves this problem by "placing an interface in between." The UseCase depends on an abstraction (Protocol/Interface) of "something that can save things," and PostgresOrderRepository implements that interface. The direction of control flow (UseCase → PostgreSQL) and the direction of dependency (PostgresOrderRepository → Interface ← UseCase) are reversed.

```
Direction of control flow:
  UseCase ────calls────> PostgresOrderRepository ──────> PostgreSQL
  (inner)                (outer)

Direction of dependency (after Dependency Inversion):
  UseCase ──depends──> IOrderRepository <──implements── PostgresOrderRepository
  (inner)              (defined in inner)                (outer)

  ★ Control flow and dependency direction are reversed
  ★ UseCase only depends on the interface defined in the inner layer
```

### 2.4 Data Flow

```
HTTP Request (JSON)
     │
     ▼
[Controller]
     │  (1) JSON → CreateOrderInput (DTO conversion)
     ▼
[CreateOrderUseCase]
     │  (2) Execute business logic
     │  (3) Data operations via Repository Interface
     ▼
[Repository implementation]
     │  (4) Entity ↔ DB Model conversion
     ▼
[Database]

     ── Return ──

[CreateOrderUseCase]
     │  (5) Generate CreateOrderOutput (Output DTO)
     ▼
[Presenter / Controller]
     │  (6) Output DTO → JSON conversion
     ▼
HTTP Response (JSON)
```

### 2.5 Data Crossing Boundaries

The principle that **inner layers must not know about the data structures of outer layers** also applies to data that passes between layers. Data transformation is required at each boundary.

```
External world      Controller       UseCase          Entity
                  (Adapter layer)  (Application layer) (Domain layer)

JSON Request  →  RequestDTO    →  InputDTO       →  Entity operation
                  (HTTP-specific)  (App-specific)    (Domain)

JSON Response ←  ResponseDTO   ←  OutputDTO      ←  Entity state
                  (HTTP-specific)  (App-specific)    (Domain)

Each layer has its own optimal data structure
The cost of conversion is recovered through testability and ease of change
```

---

## 3. Implementation of Each Layer

### 3.1 Entities (Domain Model)

```python
# domain/entities/order.py
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List

class OrderStatus(Enum):
    """Order status: rules for state transitions are managed by the entity"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

@dataclass(frozen=True)
class OrderItem:
    """Order line item: immutable as a value object"""
    product_id: str
    name: str
    price: int          # In yen units (use minimum currency unit to avoid floating point)
    quantity: int

    def __post_init__(self):
        if self.price < 0:
            raise ValueError(f"Price must be 0 or more: {self.price}")
        if self.quantity < 1:
            raise ValueError(f"Quantity must be 1 or more: {self.quantity}")

    @property
    def subtotal(self) -> int:
        return self.price * self.quantity

@dataclass
class Order:
    """
    Order entity: aggregate root encapsulating business rules

    Design principles:
    - All business rules are contained within this class
    - Zero dependency on external frameworks (DB, Web)
    - Validates state transitions internally
    """
    id: str
    user_id: str
    items: List[OrderItem]
    status: OrderStatus = OrderStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # --- Business rules ---

    @property
    def total_amount(self) -> int:
        """Calculate total amount"""
        return sum(item.subtotal for item in self.items)

    @property
    def item_count(self) -> int:
        """Return the number of line items"""
        return len(self.items)

    def confirm(self) -> None:
        """Confirm the order"""
        if self.status != OrderStatus.PENDING:
            raise ValueError(
                f"Can only confirm from PENDING state (current: {self.status.value})"
            )
        if not self.items:
            raise ValueError("Order items are empty")
        if self.total_amount <= 0:
            raise ValueError("Total amount is 0 or less")
        self.status = OrderStatus.CONFIRMED
        self.updated_at = datetime.now()

    def ship(self) -> None:
        """Ship the order"""
        if self.status != OrderStatus.CONFIRMED:
            raise ValueError(
                f"Can only ship from CONFIRMED state (current: {self.status.value})"
            )
        self.status = OrderStatus.SHIPPED
        self.updated_at = datetime.now()

    def deliver(self) -> None:
        """Mark the order as delivered"""
        if self.status != OrderStatus.SHIPPED:
            raise ValueError(
                f"Can only deliver from SHIPPED state (current: {self.status.value})"
            )
        self.status = OrderStatus.DELIVERED
        self.updated_at = datetime.now()

    def cancel(self) -> None:
        """Cancel the order"""
        if self.status in (OrderStatus.SHIPPED, OrderStatus.DELIVERED,
                           OrderStatus.CANCELLED):
            raise ValueError(
                f"Cannot cancel shipped/delivered/already-cancelled orders"
            )
        self.status = OrderStatus.CANCELLED
        self.updated_at = datetime.now()

    # --- State transition diagram ---
    # PENDING → CONFIRMED → SHIPPED → DELIVERED
    #    ↓          ↓
    # CANCELLED  CANCELLED
```

### 3.2 Implementing Value Objects

```python
# domain/value_objects/money.py
from dataclasses import dataclass

@dataclass(frozen=True)
class Money:
    """
    Value object representing a monetary amount

    WHY frozen=True?
    - Value objects should be immutable (the same "1000 yen" is always the same)
    - Immutability prevents unintended state changes
    - Becomes hashable, so it can be used as a dict key or set element
    """
    amount: int          # Minimum currency unit (yen for Japanese yen)
    currency: str = "JPY"

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError(f"Amount must be 0 or more: {self.amount}")
        if not self.currency:
            raise ValueError("Currency code is required")

    def add(self, other: 'Money') -> 'Money':
        """Addition: only allowed for the same currency"""
        self._assert_same_currency(other)
        return Money(amount=self.amount + other.amount, currency=self.currency)

    def subtract(self, other: 'Money') -> 'Money':
        """Subtraction: only allowed for the same currency"""
        self._assert_same_currency(other)
        if self.amount < other.amount:
            raise ValueError("Insufficient balance")
        return Money(amount=self.amount - other.amount, currency=self.currency)

    def multiply(self, factor: int) -> 'Money':
        """Multiplication"""
        return Money(amount=self.amount * factor, currency=self.currency)

    def _assert_same_currency(self, other: 'Money') -> None:
        if self.currency != other.currency:
            raise ValueError(
                f"Different currencies: {self.currency} vs {other.currency}"
            )

    def __str__(self) -> str:
        if self.currency == "JPY":
            return f"¥{self.amount:,}"
        return f"{self.amount} {self.currency}"


# domain/value_objects/email.py
import re
from dataclasses import dataclass

@dataclass(frozen=True)
class Email:
    """Value object representing an email address"""
    value: str

    def __post_init__(self):
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, self.value):
            raise ValueError(f"Invalid email address: {self.value}")

    def domain(self) -> str:
        return self.value.split('@')[1]

    def __str__(self) -> str:
        return self.value
```

### 3.3 Use Cases (Application Logic)

```python
# application/use_cases/create_order.py
from dataclasses import dataclass
from typing import List, Protocol, Optional

# ========================================
# Input/Output DTO
# ========================================

@dataclass(frozen=True)
class OrderItemInput:
    """Input DTO for order line item"""
    product_id: str
    quantity: int

@dataclass(frozen=True)
class CreateOrderInput:
    """Input DTO for order creation"""
    user_id: str
    items: List[OrderItemInput]

@dataclass(frozen=True)
class CreateOrderOutput:
    """Output DTO for order creation"""
    order_id: str
    total_amount: int
    item_count: int
    status: str

# ========================================
# Port (Repository Interface)
# ========================================

class OrderRepository(Protocol):
    """Port for order repository"""
    def save(self, order: 'Order') -> None: ...
    def find_by_id(self, order_id: str) -> Optional['Order']: ...
    def find_by_user_id(self, user_id: str) -> List['Order']: ...

class ProductRepository(Protocol):
    """Port for product repository"""
    def find_by_id(self, product_id: str) -> Optional['Product']: ...

class EventPublisher(Protocol):
    """Port for event publishing"""
    def publish(self, event_name: str, data: dict) -> None: ...

class IdGenerator(Protocol):
    """Port for ID generation"""
    def generate(self) -> str: ...

# ========================================
# Use Case
# ========================================

class CreateOrderUseCase:
    """
    Order creation use case

    Responsibilities:
    - Input validation (application level)
    - Coordinating entity creation and operations
    - Instructing persistence via repository
    - Publishing events

    Note: Business rules themselves are held by Entity.
    UseCase focuses solely on orchestration.
    """

    def __init__(
        self,
        order_repo: OrderRepository,
        product_repo: ProductRepository,
        event_publisher: EventPublisher,
        id_generator: IdGenerator,
    ):
        self._order_repo = order_repo
        self._product_repo = product_repo
        self._events = event_publisher
        self._id_gen = id_generator

    def execute(self, input_dto: CreateOrderInput) -> CreateOrderOutput:
        # 1. Input validation (application level)
        if not input_dto.items:
            raise ValueError("Order items are empty")

        # 2. Retrieve product information and build OrderItems
        order_items = []
        for item_input in input_dto.items:
            product = self._product_repo.find_by_id(item_input.product_id)
            if not product:
                raise ProductNotFoundError(item_input.product_id)
            order_items.append(OrderItem(
                product_id=product.id,
                name=product.name,
                price=product.price,
                quantity=item_input.quantity,
            ))

        # 3. Create Order entity
        order = Order(
            id=self._id_gen.generate(),
            user_id=input_dto.user_id,
            items=order_items,
        )

        # 4. Persist
        self._order_repo.save(order)

        # 5. Publish event
        self._events.publish('order.created', {
            'order_id': order.id,
            'user_id': order.user_id,
            'total_amount': order.total_amount,
        })

        # 6. Return Output DTO
        return CreateOrderOutput(
            order_id=order.id,
            total_amount=order.total_amount,
            item_count=order.item_count,
            status=order.status.value,
        )


# application/use_cases/cancel_order.py

@dataclass(frozen=True)
class CancelOrderInput:
    order_id: str
    user_id: str       # For identity verification
    reason: str = ""

@dataclass(frozen=True)
class CancelOrderOutput:
    order_id: str
    status: str
    cancelled_at: str

class CancelOrderUseCase:
    """Order cancellation use case"""

    def __init__(
        self,
        order_repo: OrderRepository,
        event_publisher: EventPublisher,
    ):
        self._order_repo = order_repo
        self._events = event_publisher

    def execute(self, input_dto: CancelOrderInput) -> CancelOrderOutput:
        # 1. Retrieve order
        order = self._order_repo.find_by_id(input_dto.order_id)
        if not order:
            raise OrderNotFoundError(input_dto.order_id)

        # 2. Identity verification
        if order.user_id != input_dto.user_id:
            raise PermissionDeniedError("Cannot cancel another user's order")

        # 3. Execute cancellation (Entity validates business rules)
        order.cancel()

        # 4. Persist
        self._order_repo.save(order)

        # 5. Publish event
        self._events.publish('order.cancelled', {
            'order_id': order.id,
            'reason': input_dto.reason,
        })

        return CancelOrderOutput(
            order_id=order.id,
            status=order.status.value,
            cancelled_at=order.updated_at.isoformat(),
        )


# application/exceptions.py

class ApplicationError(Exception):
    """Base exception for application layer"""
    pass

class OrderNotFoundError(ApplicationError):
    def __init__(self, order_id: str):
        super().__init__(f"Order not found: {order_id}")
        self.order_id = order_id

class ProductNotFoundError(ApplicationError):
    def __init__(self, product_id: str):
        super().__init__(f"Product not found: {product_id}")
        self.product_id = product_id

class PermissionDeniedError(ApplicationError):
    pass
```

### 3.4 Interface Adapters (Controller / Repository Implementation)

```python
# adapters/controllers/order_controller.py
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/orders', methods=['POST'])
def create_order():
    """
    Converts an HTTP request to UseCase input,
    and converts UseCase output to an HTTP response.

    Controller responsibilities:
    - Parsing HTTP requests
    - Converting to Input DTO
    - Calling the UseCase
    - Converting Output DTO to HTTP response
    - Error handling (converting to HTTP status codes)
    """
    try:
        body = request.get_json()

        # HTTP → Input DTO conversion
        input_dto = CreateOrderInput(
            user_id=body['user_id'],
            items=[
                OrderItemInput(
                    product_id=item['product_id'],
                    quantity=item['quantity'],
                )
                for item in body['items']
            ],
        )

        # Retrieve UseCase from DI container and execute
        use_case = container.resolve(CreateOrderUseCase)
        output = use_case.execute(input_dto)

        # Output DTO → HTTP response conversion
        return jsonify({
            'order_id': output.order_id,
            'total_amount': output.total_amount,
            'item_count': output.item_count,
            'status': output.status,
        }), 201

    except ProductNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except PermissionDeniedError as e:
        return jsonify({'error': str(e)}), 403


@app.route('/orders/<order_id>', methods=['DELETE'])
def cancel_order(order_id: str):
    """Order cancellation endpoint"""
    try:
        body = request.get_json()
        input_dto = CancelOrderInput(
            order_id=order_id,
            user_id=body['user_id'],
            reason=body.get('reason', ''),
        )

        use_case = container.resolve(CancelOrderUseCase)
        output = use_case.execute(input_dto)

        return jsonify({
            'order_id': output.order_id,
            'status': output.status,
            'cancelled_at': output.cancelled_at,
        }), 200

    except OrderNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


# adapters/repositories/postgres_order_repository.py
from sqlalchemy.orm import Session

class PostgresOrderRepository:
    """
    PostgreSQL implementation of the OrderRepository interface

    Responsibilities:
    - Conversion between domain entities and DB models
    - Persistence operations using SQLAlchemy

    Important: This class belongs to the Infrastructure layer, but
    implements the OrderRepository interface (Application layer)
    """

    def __init__(self, session: Session):
        self._session = session

    def save(self, order: Order) -> None:
        """Convert entity to DB model and save"""
        db_order = self._to_model(order)
        self._session.merge(db_order)
        self._session.commit()

    def find_by_id(self, order_id: str) -> Order | None:
        """Search DB model by ID, convert to entity and return"""
        db_order = self._session.query(OrderModel).get(order_id)
        if not db_order:
            return None
        return self._to_entity(db_order)

    def find_by_user_id(self, user_id: str) -> list[Order]:
        """Retrieve list of orders by user ID"""
        db_orders = (
            self._session.query(OrderModel)
            .filter(OrderModel.user_id == user_id)
            .order_by(OrderModel.created_at.desc())
            .all()
        )
        return [self._to_entity(o) for o in db_orders]

    def _to_model(self, order: Order) -> 'OrderModel':
        """Domain entity → DB model"""
        db_order = OrderModel(
            id=order.id,
            user_id=order.user_id,
            status=order.status.value,
            total_amount=order.total_amount,
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
        db_order.items = [
            OrderItemModel(
                product_id=item.product_id,
                name=item.name,
                price=item.price,
                quantity=item.quantity,
            )
            for item in order.items
        ]
        return db_order

    def _to_entity(self, model: 'OrderModel') -> Order:
        """DB model → Domain entity"""
        return Order(
            id=model.id,
            user_id=model.user_id,
            items=[
                OrderItem(
                    product_id=i.product_id,
                    name=i.name,
                    price=i.price,
                    quantity=i.quantity,
                )
                for i in model.items
            ],
            status=OrderStatus(model.status),
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


# adapters/repositories/inmemory_order_repository.py

class InMemoryOrderRepository:
    """
    In-memory repository implementation for testing

    Because it implements the same OrderRepository interface,
    it can be used in UseCase tests instead of PostgreSQL.
    This is the true value of Dependency Inversion.
    """

    def __init__(self):
        self._store: dict[str, Order] = {}

    def save(self, order: Order) -> None:
        self._store[order.id] = order

    def find_by_id(self, order_id: str) -> Order | None:
        return self._store.get(order_id)

    def find_by_user_id(self, user_id: str) -> list[Order]:
        return [
            o for o in self._store.values()
            if o.user_id == user_id
        ]
```

### 3.5 DI Container Configuration

```python
# infrastructure/container.py
"""
DI Container: Consolidates dependency assembly in one place

WHY DI container?
- What the UseCase "uses" is defined by the UseCase itself (Protocol)
- "What implements it" is decided by the DI container
- Inject Fake implementations for testing, real ones for production
"""

from dependency_injector import containers, providers

class Container(containers.DeclarativeContainer):
    """Dependency definitions for the entire application"""

    # --- Configuration ---
    config = providers.Configuration()

    # --- Infrastructure ---
    db_session = providers.Singleton(
        create_session,
        database_url=config.database_url,
    )

    # --- Repositories ---
    order_repository = providers.Factory(
        PostgresOrderRepository,
        session=db_session,
    )

    product_repository = providers.Factory(
        PostgresProductRepository,
        session=db_session,
    )

    # --- Events ---
    event_publisher = providers.Singleton(
        KafkaEventPublisher,
        bootstrap_servers=config.kafka_servers,
    )

    # --- ID generation ---
    id_generator = providers.Singleton(UUIDGenerator)

    # --- Use cases ---
    create_order_use_case = providers.Factory(
        CreateOrderUseCase,
        order_repo=order_repository,
        product_repo=product_repository,
        event_publisher=event_publisher,
        id_generator=id_generator,
    )

    cancel_order_use_case = providers.Factory(
        CancelOrderUseCase,
        order_repo=order_repository,
        event_publisher=event_publisher,
    )


# Test container
class TestContainer(containers.DeclarativeContainer):
    """For testing: replace all external dependencies with Fakes"""

    order_repository = providers.Singleton(InMemoryOrderRepository)
    product_repository = providers.Singleton(FakeProductRepository)
    event_publisher = providers.Singleton(FakeEventPublisher)
    id_generator = providers.Singleton(SequentialIdGenerator)

    create_order_use_case = providers.Factory(
        CreateOrderUseCase,
        order_repo=order_repository,
        product_repo=product_repository,
        event_publisher=event_publisher,
        id_generator=id_generator,
    )
```

### 3.6 Testing (UseCase Unit Tests)

```python
# tests/unit/test_create_order.py
import pytest

# === Fake Implementations ===

class FakeOrderRepository:
    """For testing: manages orders in memory"""
    def __init__(self):
        self.saved: list[Order] = []

    def save(self, order: Order) -> None:
        self.saved.append(order)

    def find_by_id(self, order_id: str) -> Order | None:
        return next((o for o in self.saved if o.id == order_id), None)

    def find_by_user_id(self, user_id: str) -> list[Order]:
        return [o for o in self.saved if o.user_id == user_id]

class FakeProductRepository:
    """For testing: returns fixed products"""
    def __init__(self, products: dict[str, 'Product'] | None = None):
        self._products = products or {
            "prod-1": Product(id="prod-1", name="Test Product A", price=1000),
            "prod-2": Product(id="prod-2", name="Test Product B", price=2500),
        }

    def find_by_id(self, product_id: str) -> 'Product | None':
        return self._products.get(product_id)

class FakeEventPublisher:
    """For testing: records events"""
    def __init__(self):
        self.events: list[tuple[str, dict]] = []

    def publish(self, event_name: str, data: dict) -> None:
        self.events.append((event_name, data))

class SequentialIdGenerator:
    """For testing: predictable ID generation"""
    def __init__(self, prefix: str = "order"):
        self._counter = 0
        self._prefix = prefix

    def generate(self) -> str:
        self._counter += 1
        return f"{self._prefix}-{self._counter}"


# === Test Cases ===

@pytest.fixture
def dependencies():
    """Build test dependencies"""
    return {
        'order_repo': FakeOrderRepository(),
        'product_repo': FakeProductRepository(),
        'event_pub': FakeEventPublisher(),
        'id_gen': SequentialIdGenerator(),
    }

@pytest.fixture
def use_case(dependencies):
    """Build the UseCase under test"""
    return CreateOrderUseCase(
        order_repo=dependencies['order_repo'],
        product_repo=dependencies['product_repo'],
        event_publisher=dependencies['event_pub'],
        id_generator=dependencies['id_gen'],
    )


class TestCreateOrder:
    """Tests for the order creation use case"""

    def test_happy_path_order_is_created(self, use_case, dependencies):
        """When products exist, an order is created successfully"""
        result = use_case.execute(CreateOrderInput(
            user_id="user-1",
            items=[
                OrderItemInput(product_id="prod-1", quantity=2),
                OrderItemInput(product_id="prod-2", quantity=1),
            ],
        ))

        # Verify Output DTO
        assert result.order_id == "order-1"
        assert result.total_amount == 4500   # 1000*2 + 2500*1
        assert result.item_count == 2
        assert result.status == "pending"

        # Verify saved to repository
        assert len(dependencies['order_repo'].saved) == 1
        saved_order = dependencies['order_repo'].saved[0]
        assert saved_order.user_id == "user-1"

        # Verify event was published
        assert len(dependencies['event_pub'].events) == 1
        event_name, event_data = dependencies['event_pub'].events[0]
        assert event_name == "order.created"
        assert event_data['order_id'] == "order-1"

    def test_error_case_nonexistent_product(self, use_case):
        """When a nonexistent product ID is included, an error occurs"""
        with pytest.raises(ProductNotFoundError):
            use_case.execute(CreateOrderInput(
                user_id="user-1",
                items=[
                    OrderItemInput(product_id="nonexistent", quantity=1),
                ],
            ))

    def test_error_case_empty_item_list(self, use_case):
        """When the item list is empty, an error occurs"""
        with pytest.raises(ValueError, match="Order items are empty"):
            use_case.execute(CreateOrderInput(
                user_id="user-1",
                items=[],
            ))

    def test_happy_path_create_multiple_orders(self, use_case, dependencies):
        """When orders are created consecutively, each is assigned a different ID"""
        result1 = use_case.execute(CreateOrderInput(
            user_id="user-1",
            items=[OrderItemInput(product_id="prod-1", quantity=1)],
        ))
        result2 = use_case.execute(CreateOrderInput(
            user_id="user-2",
            items=[OrderItemInput(product_id="prod-2", quantity=3)],
        ))

        assert result1.order_id == "order-1"
        assert result2.order_id == "order-2"
        assert len(dependencies['order_repo'].saved) == 2


# tests/unit/test_order_entity.py

class TestOrderEntity:
    """Business rule tests for the Order entity"""

    def _make_order(self, **kwargs) -> Order:
        defaults = {
            'id': 'order-1',
            'user_id': 'user-1',
            'items': [
                OrderItem(
                    product_id='prod-1',
                    name='Test Product',
                    price=1000,
                    quantity=2,
                )
            ],
        }
        defaults.update(kwargs)
        return Order(**defaults)

    def test_total_amount_calculation(self):
        order = self._make_order(items=[
            OrderItem(product_id='p1', name='A', price=1000, quantity=2),
            OrderItem(product_id='p2', name='B', price=500, quantity=3),
        ])
        assert order.total_amount == 3500   # 1000*2 + 500*3

    def test_transition_from_PENDING_to_CONFIRMED(self):
        order = self._make_order()
        order.confirm()
        assert order.status == OrderStatus.CONFIRMED

    def test_transition_from_CONFIRMED_to_SHIPPED(self):
        order = self._make_order()
        order.confirm()
        order.ship()
        assert order.status == OrderStatus.SHIPPED

    def test_cannot_cancel_in_SHIPPED_state(self):
        order = self._make_order()
        order.confirm()
        order.ship()
        with pytest.raises(ValueError, match="Cannot cancel"):
            order.cancel()

    def test_empty_order_cannot_be_confirmed(self):
        order = self._make_order(items=[])
        with pytest.raises(ValueError, match="Order items are empty"):
            order.confirm()
```

---

## 4. Directory Structure

### 4.1 Recommended Directory Structure (Python)

```
project/
├── domain/                      # Entities (innermost layer)
│   ├── __init__.py
│   ├── entities/
│   │   ├── __init__.py
│   │   ├── order.py             # Order aggregate root
│   │   ├── product.py           # Product entity
│   │   └── user.py              # User entity
│   ├── value_objects/
│   │   ├── __init__.py
│   │   ├── money.py             # Money value object
│   │   ├── email.py             # Email value object
│   │   └── address.py           # Address value object
│   ├── events/
│   │   ├── __init__.py
│   │   └── order_events.py      # OrderCreated, OrderCancelled, etc.
│   └── exceptions.py            # Domain exceptions
│
├── application/                 # Use Cases
│   ├── __init__.py
│   ├── use_cases/
│   │   ├── __init__.py
│   │   ├── create_order.py      # Order creation use case
│   │   ├── cancel_order.py      # Order cancellation use case
│   │   ├── get_order.py         # Order retrieval use case
│   │   └── list_orders.py       # Order list use case
│   ├── ports/                   # Ports (interface definitions)
│   │   ├── __init__.py
│   │   ├── order_repository.py  # OrderRepository Protocol
│   │   ├── product_repository.py
│   │   ├── event_publisher.py   # EventPublisher Protocol
│   │   └── id_generator.py      # IdGenerator Protocol
│   ├── dto/                     # Data Transfer Objects
│   │   ├── __init__.py
│   │   ├── order_dto.py         # Input/Output DTO
│   │   └── product_dto.py
│   └── exceptions.py            # Application exceptions
│
├── adapters/                    # Interface Adapters
│   ├── __init__.py
│   ├── controllers/             # HTTP → UseCase
│   │   ├── __init__.py
│   │   ├── order_controller.py
│   │   └── product_controller.py
│   ├── repositories/            # DB → Entity
│   │   ├── __init__.py
│   │   ├── postgres_order_repository.py
│   │   ├── postgres_product_repository.py
│   │   └── inmemory_order_repository.py  # For testing
│   ├── presenters/              # UseCase Output → Display format
│   │   ├── __init__.py
│   │   └── order_presenter.py
│   └── gateways/                # Entity → External API
│       ├── __init__.py
│       └── payment_gateway.py
│
├── infrastructure/              # Frameworks & Drivers
│   ├── __init__.py
│   ├── db/
│   │   ├── __init__.py
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── connection.py        # DB connection configuration
│   │   └── migrations/          # Alembic migrations
│   ├── web/
│   │   ├── __init__.py
│   │   ├── flask_app.py         # Flask application configuration
│   │   └── middleware.py        # Middleware
│   ├── messaging/
│   │   ├── __init__.py
│   │   └── kafka_publisher.py   # Kafka event publishing
│   └── container.py             # DI container
│
├── tests/
│   ├── unit/                    # Entity + UseCase tests
│   │   ├── test_order_entity.py
│   │   ├── test_create_order.py
│   │   └── test_cancel_order.py
│   ├── integration/             # Repository + DB tests
│   │   ├── test_postgres_order_repository.py
│   │   └── conftest.py          # Test DB configuration
│   └── e2e/                     # API tests
│       ├── test_order_api.py
│       └── conftest.py          # Test server configuration
│
├── config/
│   ├── settings.py              # Environment-specific configuration
│   └── logging.py               # Logging configuration
│
└── main.py                      # Entry point
```

### 4.2 For TypeScript Projects

```
src/
├── domain/
│   ├── entities/
│   │   ├── Order.ts
│   │   └── Product.ts
│   ├── valueObjects/
│   │   ├── Money.ts
│   │   └── Email.ts
│   └── events/
│       └── OrderEvents.ts
├── application/
│   ├── useCases/
│   │   ├── CreateOrder.ts
│   │   └── CancelOrder.ts
│   ├── ports/
│   │   ├── IOrderRepository.ts
│   │   └── IEventPublisher.ts
│   └── dto/
│       └── OrderDto.ts
├── adapters/
│   ├── controllers/
│   │   └── OrderController.ts
│   ├── repositories/
│   │   └── TypeOrmOrderRepository.ts
│   └── presenters/
│       └── OrderPresenter.ts
├── infrastructure/
│   ├── database/
│   │   └── typeOrmConfig.ts
│   ├── web/
│   │   └── expressApp.ts
│   └── container.ts             # tsyringe DI
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### 4.3 For Go Projects

```
internal/
├── domain/
│   ├── order.go                 # Order struct + business logic
│   ├── product.go
│   ├── money.go                 # Value object
│   └── events.go                # Domain events
├── application/
│   ├── create_order.go          # UseCase
│   ├── cancel_order.go
│   └── ports.go                 # interface definitions
├── adapters/
│   ├── http/
│   │   └── order_handler.go     # HTTP handler
│   └── postgres/
│       └── order_repository.go  # PostgreSQL implementation
├── infrastructure/
│   ├── server.go                # HTTP server configuration
│   └── database.go              # DB connection configuration
cmd/
└── api/
    └── main.go                  # Entry point
```

---

## 5. Advanced Topics

### 5.1 Presenter Pattern

Beyond the simple case where a Controller directly converts UseCase output to JSON, the **Presenter pattern** can be used to separate the output format conversion logic.

```python
# adapters/presenters/order_presenter.py

class OrderPresenter:
    """
    Converts UseCase output to various formats

    WHY separate the Presenter?
    - When the same UseCase output needs to be converted
      to different formats like JSON / HTML / CSV / gRPC
    - Prevents Controllers from becoming bloated with conversion logic
    """

    @staticmethod
    def to_json(output: CreateOrderOutput) -> dict:
        """JSON for API response"""
        return {
            'order_id': output.order_id,
            'total_amount': output.total_amount,
            'total_amount_display': f"¥{output.total_amount:,}",
            'item_count': output.item_count,
            'status': output.status,
        }

    @staticmethod
    def to_csv_row(output: CreateOrderOutput) -> str:
        """For CSV export"""
        return (f"{output.order_id},{output.total_amount},"
                f"{output.item_count},{output.status}")

    @staticmethod
    def to_notification(output: CreateOrderOutput) -> dict:
        """For notification messages"""
        return {
            'title': 'Your order has been created',
            'body': (f'Order ID: {output.order_id} / '
                     f'Total: ¥{output.total_amount:,}'),
        }
```

### 5.2 Combining with CQRS

CQRS (Command Query Responsibility Segregation) is a pattern that separates "writes" and "reads," and it pairs very well with Clean Architecture.

```
Clean Architecture + CQRS

  Command (Write)                       Query (Read)
  ┌──────────────────┐                ┌──────────────────┐
  │  CreateOrderInput │                │  GetOrderInput   │
  │        ↓          │                │        ↓          │
  │  CreateOrderUseCase│               │  GetOrderQuery   │
  │        ↓          │                │        ↓          │
  │  OrderRepository  │                │  OrderReadModel  │
  │  (write-only)     │                │  (read-only)     │
  │        ↓          │                │        ↓          │
  │  PostgreSQL       │──sync/async──>│  Elasticsearch   │
  └──────────────────┘                └──────────────────┘

  Command side: Apply business rules via domain model
  Query side: Retrieve directly from performance-optimized Read Model
  → Writes and reads can be scaled independently
```

```python
# application/queries/get_order_query.py

@dataclass(frozen=True)
class GetOrderInput:
    order_id: str

@dataclass(frozen=True)
class OrderDetailOutput:
    order_id: str
    user_id: str
    items: list[dict]
    total_amount: int
    status: str
    created_at: str

class OrderReadRepository(Protocol):
    """Read-only repository (Query side of CQRS)"""
    def find_detail_by_id(
        self, order_id: str
    ) -> OrderDetailOutput | None: ...
    def search(
        self, user_id: str, status: str | None = None
    ) -> list[OrderDetailOutput]: ...

class GetOrderQuery:
    """
    Order detail retrieval query

    Note: Queries do not go through the domain model;
    they return DTOs directly from the Read Model.
    No application of business rules is required.
    """

    def __init__(self, read_repo: OrderReadRepository):
        self._read_repo = read_repo

    def execute(self, input_dto: GetOrderInput) -> OrderDetailOutput:
        result = self._read_repo.find_detail_by_id(input_dto.order_id)
        if not result:
            raise OrderNotFoundError(input_dto.order_id)
        return result
```

### 5.3 Clean Architecture in Microservices

```
Coordination between microservices

  [Order Service]                   [Inventory Service]
  ┌─────────────────┐              ┌─────────────────┐
  │ Domain           │              │ Domain           │
  │  Order Entity    │              │  Stock Entity    │
  ├─────────────────┤              ├─────────────────┤
  │ Application      │              │ Application      │
  │  CreateOrder     │──event────>│  ReserveStock    │
  ├─────────────────┤    (Kafka)   ├─────────────────┤
  │ Adapters         │              │ Adapters         │
  │  KafkaPublisher  │              │  KafkaConsumer   │
  ├─────────────────┤              ├─────────────────┤
  │ Infrastructure   │              │ Infrastructure   │
  │  PostgreSQL      │              │  MongoDB         │
  └─────────────────┘              └─────────────────┘

  Each service has an independent Clean Architecture structure
  Services are loosely coupled via events (domain events)
  Each service can choose its own DB technology (Polyglot Persistence)
```

```python
# adapters/gateways/inventory_gateway.py

class InventoryGateway(Protocol):
    """Port for coordination with the inventory service"""
    def check_availability(
        self, product_id: str, quantity: int
    ) -> bool: ...
    def reserve(
        self, product_id: str, quantity: int
    ) -> str: ...

class HttpInventoryGateway:
    """HTTP API client implementation for the inventory service"""

    def __init__(self, base_url: str, http_client: 'HttpClient'):
        self._base_url = base_url
        self._client = http_client

    def check_availability(
        self, product_id: str, quantity: int
    ) -> bool:
        response = self._client.get(
            f"{self._base_url}/products/{product_id}/availability",
            params={'quantity': quantity},
        )
        return response.json()['available']

    def reserve(self, product_id: str, quantity: int) -> str:
        response = self._client.post(
            f"{self._base_url}/reservations",
            json={'product_id': product_id, 'quantity': quantity},
        )
        return response.json()['reservation_id']
```

### 5.4 Incremental Adoption Strategy

A three-step approach based on project scale.

```
Step 1: Minimal configuration (small projects / MVP)
────────────────────────────────────────────
  domain/
    entities/        ← Entities with business rules
  application/
    use_cases/       ← Use cases + Port definitions
  infrastructure/
    everything_else/ ← Controller + Repository + DB + everything else

  Number of layers: 3 (Domain / Application / Infrastructure)
  Goal: Achieve minimal separation of concerns

Step 2: Standard configuration (medium-scale projects)
────────────────────────────────────────────
  domain/
    entities/
    value_objects/
  application/
    use_cases/
    ports/
    dto/
  adapters/
    controllers/
    repositories/
  infrastructure/
    db/
    web/

  Number of layers: 4 (complete concentric circle model)
  Goal: Ensure testability and ease of change

Step 3: Full configuration (large-scale / microservices)
────────────────────────────────────────────
  Above + CQRS + Event Sourcing + Saga
  Separate Bounded Contexts per module
  Each module has an independent Clean Architecture structure
```

### 5.5 TypeScript Implementation Example

As an implementation example in a language other than Python, here is a TypeScript version.

```typescript
// domain/entities/Order.ts

export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  SHIPPED = "shipped",
  CANCELLED = "cancelled",
}

export class OrderItem {
  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly price: number,
    public readonly quantity: number,
  ) {
    if (price < 0) throw new Error(`Price must be 0 or more: ${price}`);
    if (quantity < 1) throw new Error(`Quantity must be 1 or more: ${quantity}`);
  }

  get subtotal(): number {
    return this.price * this.quantity;
  }
}

export class Order {
  private _status: OrderStatus = OrderStatus.PENDING;

  constructor(
    public readonly id: string,
    public readonly userId: string,
    private _items: OrderItem[],
  ) {}

  get status(): OrderStatus { return this._status; }
  get items(): ReadonlyArray<OrderItem> { return this._items; }
  get totalAmount(): number {
    return this._items.reduce((sum, i) => sum + i.subtotal, 0);
  }

  confirm(): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new Error(`Can only confirm from PENDING state (current: ${this._status})`);
    }
    if (this._items.length === 0) {
      throw new Error("Order items are empty");
    }
    this._status = OrderStatus.CONFIRMED;
  }

  cancel(): void {
    if ([OrderStatus.SHIPPED, OrderStatus.CANCELLED].includes(this._status)) {
      throw new Error("Cannot cancel shipped/already-cancelled orders");
    }
    this._status = OrderStatus.CANCELLED;
  }
}

// application/ports/IOrderRepository.ts

export interface IOrderRepository {
  save(order: Order): Promise<void>;
  findById(orderId: string): Promise<Order | null>;
}

// application/useCases/CreateOrder.ts

export interface CreateOrderInput {
  userId: string;
  items: { productId: string; quantity: number }[];
}

export interface CreateOrderOutput {
  orderId: string;
  totalAmount: number;
  status: string;
}

export class CreateOrderUseCase {
  constructor(
    private orderRepo: IOrderRepository,
    private productRepo: IProductRepository,
    private eventPublisher: IEventPublisher,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const orderItems: OrderItem[] = [];
    for (const item of input.items) {
      const product = await this.productRepo.findById(item.productId);
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      orderItems.push(
        new OrderItem(product.id, product.name, product.price, item.quantity)
      );
    }

    const order = new Order(generateId(), input.userId, orderItems);
    await this.orderRepo.save(order);
    await this.eventPublisher.publish("order.created", {
      orderId: order.id,
    });

    return {
      orderId: order.id,
      totalAmount: order.totalAmount,
      status: order.status,
    };
  }
}
```

---

## 6. Layer Comparison Table

### 6.1 Characteristic Comparison of Each Layer

| Layer | Responsibility | Dependencies | Rate of Change | Testing Method | Code Examples |
|---------|------|--------|---------|-----------|---------|
| Entities | Business rules | None (self-contained) | Lowest | Unit tests | Order, Money |
| Use Cases | Application logic | Entities + Port Interface | Moderate | Unit tests (Fake) | CreateOrderUseCase |
| Adapters | Data format conversion | Use Cases + Entities | Moderate to High | Integration tests | PostgresOrderRepository |
| Frameworks | Technical detail implementation | All layers (outermost) | Highest | E2E tests | Flask, SQLAlchemy |

### 6.2 Comparison with Similar Architectures

| Characteristic | Clean Architecture | Hexagonal (Ports & Adapters) | Onion | Traditional 3-tier (MVC) |
|------|---------------------|-------------------------------|---------|-----------------|
| Proponent | Robert C. Martin (2012) | Alistair Cockburn (2005) | Jeffrey Palermo (2008) | Trygve Reenskaug (1979) |
| Core Concept | Controlling direction of dependencies | Ports and Adapters | Domain model centric | Separation of UI/Logic/Data |
| Number of Layers | 4 (clearly defined) | 2 (inner/outer) | 4 (Domain/Service/Infra/UI) | 3 (View/Controller/Model) |
| Handling I/O | Placed on the outer concentric circle | Explicitly via Primary/Secondary Port | Placed in outer layer | Controller handles directly |
| Framework Dependency | Treated as plugin | Via adapter | Absorbed in outer layer | Tends toward tight coupling |
| Testability | Very high | High | High | Moderate |
| Learning Cost | High | Moderate | Moderate | Low |
| Initial Build Cost | High | Moderate | Moderate | Low |
| Suitable Project Scale | Medium to large | Medium scale and above | Medium scale and above | Small to medium |

### 6.3 Comparison of Testing Strategies

```
Test pyramid and correspondence to Clean Architecture

          /\
         /  \         E2E tests (few)
        / E2E\        → Frameworks layer: all-layer integration
       /------\
      /  Integ  \     Integration tests (moderate)
     /  ration   \    → Adapters layer: DB connection tests, etc.
    /------------\
   /   Unit      \    Unit tests (many)
  /   Tests       \   → Entities + Use Cases: fast tests with Fakes
 /________________\

Test execution time:
  Entity tests:   ~0.01s/test (pure calculations)
  UseCase tests:  ~0.05s/test (Fake repositories)
  Integration:    ~0.5s/test  (with DB connection)
  E2E tests:      ~2s/test    (HTTP + DB)
```

### 6.4 Comparison of Data Formats Handled by Each Layer

| Layer | Input Data | Output Data | Responsible for Conversion |
|---------|-----------|-----------|------------|
| Frameworks | JSON / HTML Form / gRPC | JSON / HTML / Protobuf | The framework itself |
| Adapters (Controller) | Request DTO | Response DTO | Controller |
| Use Cases | Input DTO | Output DTO | UseCase itself |
| Entities | Method arguments | Return values / Properties | Entity itself |

---

## 7. Anti-patterns

### Anti-pattern 1: Entity Depends on Framework

```python
# BAD: Entity depends on SQLAlchemy
from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
Base = declarative_base()

class Order(Base):           # ← Dependency on framework
    __tablename__ = 'orders'
    id = Column(Integer, primary_key=True)
    user_id = Column(String(50))
    status = Column(String(20))
    # Entity and DB model are mixed
    # → DB changes affect business logic
    # → DB connection required for unit tests

# GOOD: Entity is a pure Python class
@dataclass
class Order:
    id: str
    user_id: str
    items: List[OrderItem]
    status: OrderStatus = OrderStatus.PENDING
    # Has no knowledge of DB
    # → Entity is unchanged even if DB changes
    # → Unit tests can run immediately

    def confirm(self) -> None:
        if self.status != OrderStatus.PENDING:
            raise ValueError("Can only confirm from PENDING state")
        self.status = OrderStatus.CONFIRMED
```

**WHY is this a problem?**

When an Entity depends on an ORM: (1) a DB connection becomes mandatory during testing, slowing down test speed; (2) DB schema changes affect business logic; (3) the domain model must be distorted to fit ORM constraints. Pushing all validation into `full_clean()` of a Django Model is a typical example of this anti-pattern.

### Anti-pattern 2: UseCase Directly Depends on HTTP Request

```python
# BAD: UseCase depends on Flask's request
from flask import request

class CreateOrderUseCase:
    def execute(self):
        user_id = request.json['user_id']  # ← Web framework dependency
        items = request.json['items']
        # → Cannot be called from CLI
        # → Cannot be called from batch processing
        # → Flask request context required during testing

# GOOD: Completely separated via DTO
class CreateOrderUseCase:
    def execute(self, input_dto: CreateOrderInput):
        user_id = input_dto.user_id        # ← Pure data class
        # → Can be called from HTTP, CLI, batch, tests — anywhere
```

**WHY is this a problem?**

When a UseCase depends on HTTP requests, the same business logic cannot be called from CLI, batch processing, or message queue consumers. By using a DTO, the UseCase doesn't need to know anything about the input source.

### Anti-pattern 3: Skipping Layers in Dependencies

```python
# BAD: Controller directly uses Repository implementation
class OrderController:
    def __init__(self):
        self._repo = PostgresOrderRepository()  # ← Direct dependency on concrete class

    def get_order(self, order_id):
        # Accesses DB directly without going through UseCase
        return self._repo.find_by_id(order_id)
        # → Business rules are bypassed
        # → PostgreSQL required during testing

# GOOD: Maintain the order Controller → UseCase → Repository Interface
class OrderController:
    def __init__(self, get_order_use_case: GetOrderUseCase):
        self._use_case = get_order_use_case  # ← Depends on UseCase

    def get_order(self, order_id):
        return self._use_case.execute(GetOrderInput(order_id=order_id))
        # → Business rules are always applied
        # → UseCase can be replaced with Fake during testing
```

### Anti-pattern 4: UseCase Bloat (God UseCase)

```python
# BAD: Too many responsibilities in one UseCase
class OrderUseCase:
    def create_order(self, ...): ...
    def cancel_order(self, ...): ...
    def update_order(self, ...): ...
    def get_order(self, ...): ...
    def list_orders(self, ...): ...
    def export_orders(self, ...): ...
    # → Violates Single Responsibility Principle
    # → Tests become complex
    # → Wide impact range of changes

# GOOD: 1 UseCase = 1 operation
class CreateOrderUseCase:
    def execute(self, input_dto: CreateOrderInput) -> CreateOrderOutput:
        ...

class CancelOrderUseCase:
    def execute(self, input_dto: CancelOrderInput) -> CancelOrderOutput:
        ...

class GetOrderQuery:
    def execute(self, input_dto: GetOrderInput) -> OrderDetailOutput:
        ...
```

### Anti-pattern 5: Exposing Entities Directly Without DTOs

```python
# BAD: UseCase returns entity directly
class GetOrderUseCase:
    def execute(self, order_id: str) -> Order:
        order = self._order_repo.find_by_id(order_id)
        return order    # ← Returns Entity directly
        # → Controller can call Entity methods
        # → Entity internal structure changes affect API response
        # → Serialization becomes the Entity's responsibility

# GOOD: Expose information via Output DTO
class GetOrderUseCase:
    def execute(self, order_id: str) -> OrderDetailOutput:
        order = self._order_repo.find_by_id(order_id)
        return OrderDetailOutput(
            order_id=order.id,
            status=order.status.value,
            total_amount=order.total_amount,
        )
        # → Controller can only access DTO fields
        # → Entity internal structure changes are absorbed by DTO conversion
```

---

## 8. Practice Exercises

### Exercise 1 (Basic): Implementing Business Rules in an Entity

**Task**: Implement a `ShoppingCart` entity with the following specifications.

```
Specifications:
- Items can be added to the cart (add_item)
- Quantity is added for the same product
- Maximum number of items in the cart is 20
- Total amount can be calculated (total_amount property)
- Cart can be cleared (clear)
- Number of items in the cart can be returned (item_count property)
```

**Expected implementation and output**:

```python
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass(frozen=True)
class CartItem:
    """Cart item (value object)"""
    product_id: str
    name: str
    price: int
    quantity: int

    def __post_init__(self):
        if self.price < 0:
            raise ValueError(f"Price must be 0 or more: {self.price}")
        if self.quantity < 1:
            raise ValueError(f"Quantity must be 1 or more: {self.quantity}")

    @property
    def subtotal(self) -> int:
        return self.price * self.quantity

@dataclass
class ShoppingCart:
    """Shopping cart aggregate root"""
    id: str
    user_id: str
    _items: List[CartItem] = field(default_factory=list)
    MAX_ITEMS = 20

    @property
    def items(self) -> List[CartItem]:
        return list(self._items)

    @property
    def item_count(self) -> int:
        return sum(item.quantity for item in self._items)

    @property
    def total_amount(self) -> int:
        return sum(item.subtotal for item in self._items)

    def add_item(self, item: CartItem) -> None:
        existing = self._find_item(item.product_id)
        if existing:
            new_quantity = existing.quantity + item.quantity
            if self._total_quantity() - existing.quantity + new_quantity > self.MAX_ITEMS:
                raise ValueError(f"Exceeds cart limit ({self.MAX_ITEMS})")
            idx = self._items.index(existing)
            self._items[idx] = CartItem(
                product_id=existing.product_id,
                name=existing.name,
                price=existing.price,
                quantity=new_quantity,
            )
        else:
            if self._total_quantity() + item.quantity > self.MAX_ITEMS:
                raise ValueError(f"Exceeds cart limit ({self.MAX_ITEMS})")
            self._items.append(item)

    def remove_item(self, product_id: str) -> None:
        existing = self._find_item(product_id)
        if not existing:
            raise ValueError(f"Product not in cart: {product_id}")
        self._items.remove(existing)

    def clear(self) -> None:
        self._items.clear()

    def _find_item(self, product_id: str) -> Optional[CartItem]:
        return next(
            (i for i in self._items if i.product_id == product_id), None
        )

    def _total_quantity(self) -> int:
        return sum(i.quantity for i in self._items)


# Test run
cart = ShoppingCart(id="cart-1", user_id="user-1")
cart.add_item(CartItem(product_id="p1", name="Apple", price=150, quantity=3))
cart.add_item(CartItem(product_id="p2", name="Orange", price=100, quantity=5))
print(f"Item count: {cart.item_count}")      # Output: Item count: 8
print(f"Total amount: ¥{cart.total_amount:,}")    # Output: Total amount: ¥950

# Adding the same product accumulates quantity
cart.add_item(CartItem(product_id="p1", name="Apple", price=150, quantity=2))
print(f"Item count: {cart.item_count}")      # Output: Item count: 10
print(f"Total amount: ¥{cart.total_amount:,}")    # Output: Total amount: ¥1,250

cart.clear()
print(f"After clear: {cart.item_count}")        # Output: After clear: 0
```

### Exercise 2 (Applied): UseCase + Test Implementation

**Task**: Implement the `TransferMoneyUseCase` (money transfer use case) below and write tests.

```
Specifications:
- Deduct balance from the source account
- Add balance to the destination account
- Error if insufficient balance
- Publish event after transfer completion
- Error if transferring to the same account
```

**Expected implementation and output**:

```python
# --- Entity ---
@dataclass
class Account:
    id: str
    owner_name: str
    balance: int   # In yen units

    def withdraw(self, amount: int) -> None:
        if amount <= 0:
            raise ValueError("Withdrawal amount must be positive")
        if self.balance < amount:
            raise ValueError(
                f"Insufficient balance: balance {self.balance} yen < withdrawal {amount} yen"
            )
        self.balance -= amount

    def deposit(self, amount: int) -> None:
        if amount <= 0:
            raise ValueError("Deposit amount must be positive")
        self.balance += amount

# --- DTO ---
@dataclass(frozen=True)
class TransferInput:
    from_account_id: str
    to_account_id: str
    amount: int

@dataclass(frozen=True)
class TransferOutput:
    from_balance: int
    to_balance: int
    transferred_amount: int

# --- Port ---
class AccountRepository(Protocol):
    def find_by_id(self, account_id: str) -> Account | None: ...
    def save(self, account: Account) -> None: ...

# --- UseCase ---
class TransferMoneyUseCase:
    def __init__(
        self,
        account_repo: AccountRepository,
        event_publisher: EventPublisher,
    ):
        self._repo = account_repo
        self._events = event_publisher

    def execute(self, input_dto: TransferInput) -> TransferOutput:
        if input_dto.from_account_id == input_dto.to_account_id:
            raise ValueError("Cannot transfer to the same account")
        if input_dto.amount <= 0:
            raise ValueError("Transfer amount must be positive")

        from_account = self._repo.find_by_id(input_dto.from_account_id)
        to_account = self._repo.find_by_id(input_dto.to_account_id)

        if not from_account:
            raise ValueError(
                f"Source account not found: {input_dto.from_account_id}"
            )
        if not to_account:
            raise ValueError(
                f"Destination account not found: {input_dto.to_account_id}"
            )

        from_account.withdraw(input_dto.amount)
        to_account.deposit(input_dto.amount)

        self._repo.save(from_account)
        self._repo.save(to_account)

        self._events.publish('money.transferred', {
            'from': from_account.id,
            'to': to_account.id,
            'amount': input_dto.amount,
        })

        return TransferOutput(
            from_balance=from_account.balance,
            to_balance=to_account.balance,
            transferred_amount=input_dto.amount,
        )

# --- Tests ---
class FakeAccountRepository:
    def __init__(self):
        self._store: dict[str, Account] = {}

    def save(self, account: Account) -> None:
        self._store[account.id] = account

    def find_by_id(self, account_id: str) -> Account | None:
        return self._store.get(account_id)

    def add(self, account: Account) -> None:
        self._store[account.id] = account

def test_transfer_happy_path():
    repo = FakeAccountRepository()
    repo.add(Account(id="A", owner_name="Tanaka", balance=10000))
    repo.add(Account(id="B", owner_name="Suzuki", balance=5000))
    events = FakeEventPublisher()

    uc = TransferMoneyUseCase(repo, events)
    result = uc.execute(TransferInput(
        from_account_id="A", to_account_id="B", amount=3000
    ))

    assert result.from_balance == 7000    # 10000 - 3000
    assert result.to_balance == 8000      # 5000 + 3000
    assert result.transferred_amount == 3000
    assert events.events[0][0] == "money.transferred"
    print("OK: Transfer happy path test passed")

def test_transfer_insufficient_balance():
    repo = FakeAccountRepository()
    repo.add(Account(id="A", owner_name="Tanaka", balance=1000))
    repo.add(Account(id="B", owner_name="Suzuki", balance=5000))
    events = FakeEventPublisher()

    uc = TransferMoneyUseCase(repo, events)
    try:
        uc.execute(TransferInput(
            from_account_id="A", to_account_id="B", amount=5000
        ))
        assert False, "Exception should have been raised"
    except ValueError as e:
        assert "Insufficient balance" in str(e)
        print("OK: Insufficient balance test passed")

test_transfer_happy_path()     # Output: OK: Transfer happy path test passed
test_transfer_insufficient_balance()    # Output: OK: Insufficient balance test passed
```

### Exercise 3 (Advanced): Framework Migration Simulation

**Task**: Migrate an existing order API implemented in Flask to FastAPI. Verify that if Clean Architecture is followed, **only the Controller (Adapter layer) and Web Framework (Infrastructure layer) need to be changed**.

```
Goals:
- Make no changes to domain/ and application/
- Rewrite adapters/controllers/ for FastAPI
- Rewrite infrastructure/web/ for FastAPI
- Verify that all tests pass
```

**Expected implementation**:

```python
# === Before: Flask ===

# adapters/controllers/order_controller_flask.py
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/orders', methods=['POST'])
def create_order():
    body = request.get_json()
    input_dto = CreateOrderInput(
        user_id=body['user_id'],
        items=[OrderItemInput(**i) for i in body['items']],
    )
    use_case = container.resolve(CreateOrderUseCase)
    output = use_case.execute(input_dto)
    return jsonify(OrderPresenter.to_json(output)), 201


# === After: FastAPI ===

# adapters/controllers/order_controller_fastapi.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class CreateOrderRequest(BaseModel):
    """FastAPI request validation"""
    user_id: str
    items: list[dict]

class CreateOrderResponse(BaseModel):
    """FastAPI response serialization"""
    order_id: str
    total_amount: int
    item_count: int
    status: str

@app.post(
    '/orders',
    response_model=CreateOrderResponse,
    status_code=201,
)
async def create_order(req: CreateOrderRequest):
    input_dto = CreateOrderInput(
        user_id=req.user_id,
        items=[OrderItemInput(**i) for i in req.items],
    )
    try:
        # UseCase is exactly the same as in the Flask version
        use_case = container.resolve(CreateOrderUseCase)
        output = use_case.execute(input_dto)
        return CreateOrderResponse(
            order_id=output.order_id,
            total_amount=output.total_amount,
            item_count=output.item_count,
            status=output.status,
        )
    except ProductNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Verification of changed files:
# domain/              → No changes (0 files)
# application/         → No changes (0 files)
# adapters/controllers → Only order_controller.py changed (1 file)
# infrastructure/web/  → flask_app.py → fastapi_app.py (1 file)
# tests/unit/          → No changes (uses Fakes)
# tests/e2e/           → Flask test client → changed to httpx

# Only Adapter + Infrastructure were changed for the framework migration
# Business logic (Entity + UseCase) was never touched
# → This is the true value of Clean Architecture
```

---

## 9. Implementation Notes and Best Practices

### 9.1 Error Handling Strategy

It is important to standardize how errors are handled in each layer.

```python
# Domain layer: Domain exceptions
class DomainError(Exception):
    """Business rule violation"""
    pass

class InsufficientBalanceError(DomainError):
    pass

# Application layer: Application exceptions
class ApplicationError(Exception):
    pass

class OrderNotFoundError(ApplicationError):
    pass

# Adapter layer: Convert exceptions to HTTP status codes
ERROR_STATUS_MAP = {
    DomainError: 422,          # Unprocessable Entity
    OrderNotFoundError: 404,    # Not Found
    PermissionDeniedError: 403, # Forbidden
    ValueError: 400,            # Bad Request
}

@app.errorhandler(Exception)
def handle_error(error):
    status = ERROR_STATUS_MAP.get(type(error), 500)
    return jsonify({'error': str(error)}), status
```

### 9.2 Logging Strategy

```python
# BAD: Directly using a logger inside Entity or UseCase
import logging
logger = logging.getLogger(__name__)

class CreateOrderUseCase:
    def execute(self, input_dto):
        logger.info("Starting order creation")  # ← Dependency on logging framework
        ...

# GOOD: Logging is done in the Adapter layer or via a decorator
class LoggingUseCaseDecorator:
    """Decorator that adds logging functionality to a UseCase"""

    def __init__(self, use_case, logger):
        self._use_case = use_case
        self._logger = logger

    def execute(self, input_dto):
        self._logger.info(
            f"UseCase started: {type(self._use_case).__name__}"
        )
        try:
            result = self._use_case.execute(input_dto)
            self._logger.info(
                f"UseCase succeeded: {type(self._use_case).__name__}"
            )
            return result
        except Exception as e:
            self._logger.error(
                f"UseCase failed: {type(self._use_case).__name__} - {e}"
            )
            raise
```

### 9.3 Transaction Management

```python
# Manage transactions with the Unit of Work pattern

class UnitOfWork(Protocol):
    def __enter__(self) -> 'UnitOfWork': ...
    def __exit__(self, *args) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...

class SQLAlchemyUnitOfWork:
    def __init__(self, session_factory):
        self._session_factory = session_factory

    def __enter__(self):
        self._session = self._session_factory()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        self._session.close()

    def commit(self):
        self._session.commit()

    def rollback(self):
        self._session.rollback()


# Transaction management in UseCase
class TransferMoneyUseCase:
    def __init__(self, account_repo, event_publisher, uow: UnitOfWork):
        self._repo = account_repo
        self._events = event_publisher
        self._uow = uow

    def execute(self, input_dto: TransferInput) -> TransferOutput:
        with self._uow:
            from_account = self._repo.find_by_id(input_dto.from_account_id)
            to_account = self._repo.find_by_id(input_dto.to_account_id)

            from_account.withdraw(input_dto.amount)
            to_account.deposit(input_dto.amount)

            self._repo.save(from_account)
            self._repo.save(to_account)
            self._uow.commit()

            self._events.publish('money.transferred', {...})

        return TransferOutput(...)
```

---

## 10. FAQ

### Q1. Is Clean Architecture necessary even for small-scale projects?

**A.** For small-scale or short-term projects, it often becomes over-engineering. The decision criteria are as follows.

```
Application decision flowchart:

  Will the project last more than 1 year?
    ├── No → Traditional MVC is sufficient
    └── Yes
         Are the business rules complex?
           ├── No → Simple 3-tier (Domain/Application/Infrastructure)
           └── Yes
                Is the team 3 or more people?
                  ├── No → Simple 3-tier + Port definitions
                  └── Yes → Full Clean Architecture
```

Consider a "simplified version" with fewer layers. For example, a pragmatic approach is to simplify to 3 layers — Domain + Application + Infrastructure — and incrementally increase separation as the project grows. For CRUD-centric admin screens, traditional MVC may be sufficient.

### Q2. The DTO-to-entity conversion is tedious — can it be omitted?

**A.** Data conversion between layers is an **essential cost** of Clean Architecture. Omitting it increases coupling between layers and expands the impact range of changes.

However, the amount of conversion code can be reduced with the following methods.

```python
# Method 1: Use dataclass's asdict()
from dataclasses import asdict

output = CreateOrderOutput(**{
    k: v for k, v in asdict(order).items()
    if k in CreateOrderOutput.__dataclass_fields__
})

# Method 2: Share a mapping function
def map_to_output(order: Order) -> CreateOrderOutput:
    return CreateOrderOutput(
        order_id=order.id,
        total_amount=order.total_amount,
        item_count=order.item_count,
        status=order.status.value,
    )

# Method 3: Use pydantic's model_validate (v2)
class CreateOrderOutput(BaseModel):
    @classmethod
    def from_entity(cls, order: Order) -> 'CreateOrderOutput':
        return cls(
            order_id=order.id,
            total_amount=order.total_amount,
            item_count=order.item_count,
            status=order.status.value,
        )
```

The value of conversion is recovered through "testability" and "ease of change." It feels tedious at the beginning of a project, but 6 months later, when a framework migration or DB change occurs, you will experience its value firsthand.

### Q3. Is a DI container mandatory?

**A.** Not mandatory, but recommended. For small scale, manual DI (constructor injection) is sufficient.

```python
# Manual DI (for small-scale projects)
def create_order_use_case() -> CreateOrderUseCase:
    session = create_session()
    return CreateOrderUseCase(
        order_repo=PostgresOrderRepository(session),
        product_repo=PostgresProductRepository(session),
        event_publisher=KafkaEventPublisher(),
        id_generator=UUIDGenerator(),
    )

# DI container (for medium to large-scale projects)
# dependency-injector (Python), tsyringe (TypeScript)
# → Centralized dependency management, easy environment switching
```

As the project grows larger, using a DI container like `dependency-injector` (Python) or `tsyringe` (TypeScript) to centrally manage dependencies makes configuration changes and environment switching (test Fakes / production implementations) easier.

### Q4. How should you design things when an Entity is called from multiple UseCases?

**A.** It is natural for an Entity to be called from multiple UseCases. An Entity is the Single Source of Truth for business rules, and the same rule (e.g., "shipped orders cannot be cancelled") only needs to be implemented once in the Entity. UseCases call Entity methods and focus solely on orchestration.

```python
# One Entity, multiple UseCases
class Order:
    def cancel(self):
        # Cancellation business rules are in Entity in just one place
        ...

class UserCancelOrderUseCase:     # Cancellation initiated by user
    def execute(self, ...):
        order.cancel()

class AdminCancelOrderUseCase:    # Cancellation initiated by admin (with additional processing)
    def execute(self, ...):
        order.cancel()
        self._notify_user(order)  # Admin-cancellation-specific processing
```

### Q5. Does Clean Architecture sacrifice performance?

**A.** The overhead from data conversion between layers exists, but it is usually at a negligible level (a few microseconds for DTO conversion). Performance bottlenecks are DB queries and network communication (milliseconds to hundreds of milliseconds), and the cost of inter-layer conversion is 2 to 3 orders of magnitude smaller.

However, for bulk processing of large amounts of data (batch imports, etc.), the cost of converting all data to Entities can accumulate. In such cases, a design that accesses the DB directly on the Query side of CQRS is appropriate.

### Q6. What is the relationship between Clean Architecture and DDD?

**A.** Clean Architecture defines **layer structure**, and DDD provides **domain modeling techniques**. The two are complementary.

```
Clean Architecture: Defines "in which direction dependencies should point"
DDD:                Defines "what to implement in the Entities layer"

Clean + DDD combination:
  Entities layer = DDD aggregates, value objects, domain events
  Use Cases layer = DDD application services
  Adapters layer = DDD repository implementations
```

### Q7. How do you introduce Clean Architecture into an existing project?

**A.** Avoid big-bang rewrites and introduce it incrementally. The recommended procedure is as follows.

```
Step 1: Apply Clean Architecture to new features first
  → Don't touch existing code; write only new use cases in Clean style

Step 2: Extract Entities while adding tests
  → Move business rules from existing Models/Services to Entities

Step 3: Introduce Repository Interfaces
  → Wrap existing DB access code with Repository implementations

Step 4: Change Controllers to go through UseCases
  → Migrate API endpoints to go through UseCases one by one

Estimated time: 3 to 6 months for a medium-scale project
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming how it works.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently utilized in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## 11. Summary

| Item | Key Points |
|------|---------|
| Dependency Rule | Dependencies flow only from outer to inner. Inner knows nothing about outer. This is the most important rule. |
| Entities | The core of business rules. Framework-independent. Lowest rate of change. |
| Use Cases | Application logic. Depends on Ports (interfaces). Orchestrator of Entities. |
| Adapters | DTO conversion; bridge between HTTP ↔ UseCase and DB ↔ Entity. Layer that absorbs technical details. |
| Frameworks | Plugin for technical details. Highest rate of change; located at the outermost layer. |
| Testing Strategy | The inner the layer, the easier unit testing is. No DB required with Fake implementations. |
| DI | Dependency assembly is centrally managed by DI container. Easy switching between test/production. |
| Trade-offs | Initial cost (DTO conversion, layer construction) vs. long-term maintainability and testability. |
| Incremental Adoption | Apply with 3 layers for small scale, 4 layers for medium scale, combined with CQRS for large scale. |
| Similar Patterns | Essentially equivalent to Hexagonal and Onion. Fundamentally different from traditional MVC. |

---

## Next Guides to Read

- [DDD (Domain-Driven Design)](./02-ddd.md) — Domain modeling with aggregates and bounded contexts. Design techniques for the Entities layer in Clean Architecture.
- [Event-Driven Architecture](./03-event-driven.md) — Loosely coupled coordination via Pub/Sub. Application in microservices.
- Testing Principles — Test design with AAA and FIRST. Foundation of testing strategy in Clean Architecture.
- SOLID Principles — Details on the Dependency Inversion Principle (DIP). Theoretical foundation of Clean Architecture.
- Repository Pattern — Concrete implementation patterns for Port/Adapter.
- [System Design Fundamentals](../00-fundamentals/) — Fundamentals of non-functional requirements such as scalability and availability.

---

## References

1. **Clean Architecture: A Craftsman's Guide to Software Structure and Design** — Robert C. Martin (Prentice Hall, 2017) — The original work on Clean Architecture. Detailed explanation of the concentric circle model and Dependency Rule.
2. **Hexagonal Architecture (Ports and Adapters)** — Alistair Cockburn — https://alistair.cockburn.us/hexagonal-architecture/ — The Ports & Adapters pattern that became the prototype for Clean Architecture.
3. **Architecture Patterns with Python** — Harry Percival & Bob Gregory (O'Reilly, 2020) — Clean Architecture in practice with Python. Implementation examples of Repository pattern and Unit of Work.
4. **The Clean Architecture (Blog Post)** — Robert C. Martin (2012) — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html — The original blog post where Clean Architecture was first introduced.
