# Event-Driven Architecture

> An architectural pattern that centers inter-component communication on events (records of facts), explaining how to build loosely coupled, scalable systems using Pub/Sub models, Event Sourcing, and CQRS

## What You Will Learn in This Chapter

1. **Fundamental Event-Driven Models** — The three patterns of Event Notification, Event-Carried State Transfer, and Event Sourcing, and how to choose among them
2. **Pub/Sub Architecture** — Loosely coupled integration design through topic-based messaging
3. **CQRS and Event Sourcing** — Separating commands from queries, reconstructing state from event logs
4. **Saga Pattern** — Compensation-based eventual consistency as an alternative to distributed transactions
5. **Operations and Monitoring** — Practical observability, retries, and Dead Letter Queues for event-driven systems

---

## Prerequisites

| Topic | Required Level | Reference Guide |
|---------|-----------|-----------|
| Message Queue Basics | Understand Kafka / RabbitMQ concepts | [Message Queue](../01-components/02-message-queue.md) |
| Domain Modeling | Basics of entities, aggregates, and domain events | [DDD](./02-ddd.md) |
| Clean Architecture | Understanding layer structure and dependency direction | [Clean Architecture](./01-clean-architecture.md) |
| Database Basics | Read/write characteristics of RDB / NoSQL | Database |
| Intermediate Python | dataclass, Protocol, async/await | Python Guide |

---

## Background and Philosophy

### Why Event-Driven Architecture Is Needed

```
Problems with traditional monolithic / synchronous microservices:

  1. Tight coupling: Order → Inventory → Payment → Notification
     → One service failure stops everything (cascade failure)
     → Adding a new service requires changes to existing services

  2. Scalability wall:
     → Read load: 10,000 req/s, but write load: 100 req/s
     → Cannot optimize both with the same model

  3. Domain knowledge leakage:
     → Order Service commands "reserve inventory"
     → Order knows the internals of Inventory (tight coupling)

Paradigm shift with event-driven:
  "Notification of facts" rather than "commands"

  Order Service: "An order was placed" (OrderPlaced) ← simply states a fact
  Inventory Service: "Then I'll reserve the inventory" ← decides autonomously
  Payment Service: "Then I'll initiate payment" ← decides autonomously
  Email Service: "Then I'll send a confirmation email" ← decides autonomously

  → Each service acts autonomously. Adding/removing services is free
```

### History of Event-Driven Architecture

```
1987: Kent Beck - Event system in Smalltalk
2003: Gregor Hohpe - Enterprise Integration Patterns
2005: Martin Fowler - Systematization of Event Sourcing pattern
2006: Greg Young - Proposal of CQRS
2011: Apache Kafka released - Large-scale event streaming platform
2014: Reactive Manifesto - Four principles of reactive systems
2017: Martin Kleppmann - Theoretical framework for stream processing in DDIA
2020: Adam Bellemare - Practical guide to Event-Driven Microservices

Core idea:
  "The state of software is the cumulative result of all events that have occurred"
  — Greg Young
```

### Four Design Principles

```
1. Facts, not Commands
   × "ReserveInventory" (command)
   ○ "OrderPlaced"      (record of fact)

2. Temporal Decoupling
   Sender and receiver do not need to be running at the same time
   → Message queue handles buffering

3. Autonomy
   Each service receives events and decides/acts autonomously
   → Does not depend on the internal implementation of other services

4. Eventual Consistency
   Paradigm shift from "all data is always consistent"
   to "will eventually be consistent"
   → Design that limits where strong consistency is required
```

---

## 1. Three Patterns of Event-Driven

### 1.1 Pattern Overview

```
Pattern 1: Event Notification
  Order Service --"OrderPlaced {id:123}"--> [Event Bus]
  → Inventory Service: "Order 123 arrived, let me check inventory"
  → Minimum information only. Receiver fetches data as needed

Pattern 2: Event-Carried State Transfer
  Order Service --"OrderPlaced {id:123, items:[...], address:{...}}"--> [Event Bus]
  → Shipping Service: "All information is available, can process directly"
  → Contains all necessary data. No need for receiver to query back

Pattern 3: Event Sourcing
  Records all state changes as events
  [OrderCreated] → [ItemAdded] → [ItemAdded] → [OrderPlaced] → [OrderShipped]
  → Current state = result of replaying all events
```

### 1.2 Detailed Comparison of the Three Patterns

```python
# === Pattern 1: Event Notification ===
# Sends only minimum information. Receiver fetches data when needed

@dataclass(frozen=True)
class OrderPlacedNotification(DomainEvent):
    """Notification event: ID only"""
    event_type: str = "order.placed"
    order_id: str = ""
    # → Receiver queries Order Service using order_id

# Pros: Small event size, less impact from schema changes
# Cons: Dependency from receiver back to sender remains (for data fetching)


# === Pattern 2: Event-Carried State Transfer ===
# Contains all necessary information. Receiver does not need to query sender

@dataclass(frozen=True)
class OrderPlacedFull(DomainEvent):
    """State-carried event: contains all data"""
    event_type: str = "order.placed"
    order_id: str = ""
    customer_id: str = ""
    customer_name: str = ""
    customer_email: str = ""
    items: tuple = ()
    shipping_address: str = ""
    total_amount: int = 0
    currency: str = "JPY"

# Pros: Complete loose coupling, high performance
# Cons: Large event size, greater impact from schema changes


# === Pattern 3: Event Sourcing ===
# Records all state changes as events and restores current state by replay

@dataclass(frozen=True)
class OrderCreated(DomainEvent):
    event_type: str = "order.created"
    order_id: str = ""
    customer_id: str = ""

@dataclass(frozen=True)
class ItemAddedToOrder(DomainEvent):
    event_type: str = "order.item_added"
    order_id: str = ""
    product_id: str = ""
    quantity: int = 0
    unit_price: int = 0

@dataclass(frozen=True)
class OrderConfirmed(DomainEvent):
    event_type: str = "order.confirmed"
    order_id: str = ""
    confirmed_at: str = ""

# Pros: Complete audit trail, state restoration at any point, easy debugging
# Cons: Complex implementation, event store management, snapshots required
```

### 1.3 Decision Criteria for Pattern Selection

| Criterion | Event Notification | Event-Carried State | Event Sourcing |
|---------|:-----------------:|:------------------:|:--------------:|
| Loose Coupling | Medium (dependency via data fetch) | High (fully independent) | High (autonomous event log) |
| Event Size | Small | Large | Medium (delta records) |
| Impact of Schema Changes | Small | Large | Medium |
| Audit Trail | None | None | Complete |
| Use Cases | Internal microservices | External system integration | Finance, healthcare, regulation |
| Implementation Complexity | Low | Low | High |

### 1.4 Overall Pub/Sub Architecture

```
                          Event Bus (Kafka / SNS+SQS)
                    +-----------------------------------+
                    |                                   |
  Order Service --->| Topic: order-events               |
                    |   "OrderPlaced"                   |
                    |   "OrderCancelled"                |
                    +---+----------+----------+---------+
                        |          |          |
                        v          v          v
                  +---------+ +--------+ +----------+
                  |Inventory| |Payment | |  Email   |
                  |Service  | |Service | | Service  |
                  +---------+ +--------+ +----------+

  ★ Order Service does not know of downstream services
  ★ Adding a new consumer requires no changes to Order Service
  ★ Each Consumer processes at its own pace (backpressure control)
```

### 1.5 Detailed Comparison: Synchronous vs Asynchronous

```
[Synchronous (REST/gRPC)]
  Order --> Inventory --> Payment --> Notification
   |            |            |            |
   |<-----------+<-----------+<-----------+
   Total latency = sum of each service (50ms + 200ms + 100ms = 350ms)
   One failure = full failure (cascade failure)
   Scaling = slowest service is the bottleneck

[Asynchronous (Event-Driven)]
  Order --event--> [Bus] ---> Inventory (processes independently)
                         ---> Payment   (processes independently)
                         ---> Notification (processes independently)
   Order can respond immediately (latency = time to publish event only ≈ 5ms)
   One failure = affects only that service (recovers via retry)
   Scaling = each service scales independently

[Hybrid (Recommended Practical Configuration)]
  User → [API Gateway] → Order Service (synchronous response: "Order accepted")
                              |
                         [Event Bus]
                          /   |    \
                    Inventory Payment Email
                    (async)  (async) (async)

  → Return an immediate response to the user,
    and execute downstream processing asynchronously — this is best practice
```

---

## 2. Implementing Pub/Sub

### 2.1 Defining Events

```python
# domain/events/base.py
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol, Any
import uuid
import json


@dataclass(frozen=True)
class DomainEvent:
    """Base class for domain events

    All events are immutable (frozen=True).
    Because an event (a fact) that has occurred cannot be changed.
    """
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    occurred_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    event_type: str = ""
    # Metadata: for tracing
    correlation_id: str = ""  # ID for tracking the entire request
    causation_id: str = ""    # ID of the event/command that caused this event

    def to_dict(self) -> dict:
        """Dictionary conversion for serialization"""
        result = {}
        for key, value in self.__dict__.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, (tuple, list)):
                result[key] = list(value)
            else:
                result[key] = value
        return result

    @property
    def aggregate_id(self) -> str:
        """Returns aggregate ID. Override in subclass"""
        raise NotImplementedError


@dataclass(frozen=True)
class OrderPlaced(DomainEvent):
    """Order placed event"""
    event_type: str = "order.placed"
    order_id: str = ""
    customer_id: str = ""
    items: tuple = ()          # Use tuple because frozen=True
    total_amount: int = 0
    currency: str = "JPY"

    @property
    def aggregate_id(self) -> str:
        return self.order_id


@dataclass(frozen=True)
class OrderCancelled(DomainEvent):
    """Order cancelled event"""
    event_type: str = "order.cancelled"
    order_id: str = ""
    reason: str = ""
    cancelled_by: str = ""     # "customer" | "system" | "admin"

    @property
    def aggregate_id(self) -> str:
        return self.order_id


@dataclass(frozen=True)
class PaymentCompleted(DomainEvent):
    """Payment completed event"""
    event_type: str = "payment.completed"
    payment_id: str = ""
    order_id: str = ""
    amount: int = 0
    currency: str = "JPY"
    payment_method: str = ""   # "credit_card" | "bank_transfer"

    @property
    def aggregate_id(self) -> str:
        return self.payment_id


@dataclass(frozen=True)
class InventoryReserved(DomainEvent):
    """Inventory reservation completed event"""
    event_type: str = "inventory.reserved"
    reservation_id: str = ""
    order_id: str = ""
    items: tuple = ()

    @property
    def aggregate_id(self) -> str:
        return self.reservation_id
```

### 2.2 Event Publisher (Protocol + Kafka Implementation)

```python
# domain/ports/event_publisher.py
from typing import Protocol

class EventPublisher(Protocol):
    """Port (interface) for event publishing"""
    def publish(self, event: DomainEvent) -> None: ...
    def publish_batch(self, events: list[DomainEvent]) -> None: ...


# infrastructure/messaging/kafka_publisher.py
from confluent_kafka import Producer
import json
import logging

logger = logging.getLogger(__name__)


class KafkaEventPublisher:
    """Kafka-based event publisher

    Design decisions:
    - acks='all': Guarantees writes to all replicas (durability)
    - enable.idempotence=True: Prevents duplicate messages
    - Partition key = aggregate_id: Guarantees event ordering for same aggregate
    """

    def __init__(self, bootstrap_servers: str, schema_registry_url: str = ""):
        self._producer = Producer({
            'bootstrap.servers': bootstrap_servers,
            'acks': 'all',
            'enable.idempotence': True,
            'max.in.flight.requests.per.connection': 5,
            'retries': 3,
            'retry.backoff.ms': 100,
        })
        self._schema_registry_url = schema_registry_url

    def publish(self, event: DomainEvent) -> None:
        """Publish a single event"""
        topic = self._resolve_topic(event)
        key = event.aggregate_id.encode('utf-8')
        value = json.dumps(
            event.to_dict(), ensure_ascii=False, default=str
        ).encode('utf-8')

        # Attach metadata to headers (for tracing)
        headers = [
            ('event_type', event.event_type.encode()),
            ('correlation_id', event.correlation_id.encode()),
            ('causation_id', event.causation_id.encode()),
        ]

        self._producer.produce(
            topic=topic,
            key=key,
            value=value,
            headers=headers,
            callback=self._delivery_report,
        )
        self._producer.flush()
        logger.info(
            "Event published successfully",
            extra={
                'event_type': event.event_type,
                'event_id': event.event_id,
                'aggregate_id': event.aggregate_id,
                'topic': topic,
            }
        )

    def publish_batch(self, events: list[DomainEvent]) -> None:
        """Batch publish multiple events"""
        for event in events:
            topic = self._resolve_topic(event)
            key = event.aggregate_id.encode('utf-8')
            value = json.dumps(
                event.to_dict(), ensure_ascii=False, default=str
            ).encode('utf-8')
            self._producer.produce(
                topic=topic,
                key=key,
                value=value,
                callback=self._delivery_report,
            )
        # Flush the entire batch at once
        self._producer.flush()
        logger.info(f"Batch event publish completed: {len(events)} events")

    def _resolve_topic(self, event: DomainEvent) -> str:
        """Resolve topic name from event type

        Example: "order.placed" → "domain-events.order"
                 "payment.completed" → "domain-events.payment"
        """
        domain = event.event_type.split('.')[0]
        return f"domain-events.{domain}"

    def _delivery_report(self, err, msg):
        if err:
            logger.error(f"Event delivery failed: {err}, topic={msg.topic()}")
            raise RuntimeError(f"Event delivery failed: {err}")
        logger.debug(
            f"Delivery successful: topic={msg.topic()}, "
            f"partition={msg.partition()}, offset={msg.offset()}"
        )


# infrastructure/messaging/in_memory_publisher.py
class InMemoryEventPublisher:
    """In-memory event publisher for testing"""

    def __init__(self):
        self.published_events: list[DomainEvent] = []

    def publish(self, event: DomainEvent) -> None:
        self.published_events.append(event)

    def publish_batch(self, events: list[DomainEvent]) -> None:
        self.published_events.extend(events)

    def get_events_of_type(self, event_type: str) -> list[DomainEvent]:
        return [e for e in self.published_events if e.event_type == event_type]

    def clear(self) -> None:
        self.published_events.clear()
```

### 2.3 Event Consumer (Kafka Consumer)

```python
# infrastructure/messaging/kafka_consumer.py
from confluent_kafka import Consumer, KafkaError
import json
import logging
from typing import Callable

logger = logging.getLogger(__name__)


class KafkaEventConsumer:
    """Kafka-based event consumer

    Design decisions:
    - enable.auto.commit=False: Manual commit after processing (at-least-once guarantee)
    - Consumer Group: Partitions are distributed among members of the same group
    - Manual offset management: Controls retry on processing failure
    """

    def __init__(
        self,
        bootstrap_servers: str,
        group_id: str,
        topics: list[str],
    ):
        self._consumer = Consumer({
            'bootstrap.servers': bootstrap_servers,
            'group.id': group_id,
            'auto.offset.reset': 'earliest',
            'enable.auto.commit': False,       # Manual commit
            'max.poll.interval.ms': 300000,    # 5 minutes
            'session.timeout.ms': 45000,
        })
        self._consumer.subscribe(topics)
        self._handlers: dict[str, Callable] = {}
        self._running = False

    def register_handler(
        self, event_type: str, handler: Callable[[dict], None]
    ) -> None:
        """Register a handler for the given event type"""
        self._handlers[event_type] = handler
        logger.info(f"Handler registered: {event_type}")

    def start(self) -> None:
        """Start the consumer loop"""
        self._running = True
        logger.info("Consumer started")

        while self._running:
            msg = self._consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                logger.error(f"Consumer error: {msg.error()}")
                continue

            try:
                event_data = json.loads(msg.value().decode('utf-8'))
                event_type = event_data.get('event_type', '')

                handler = self._handlers.get(event_type)
                if handler:
                    logger.info(
                        f"Event processing started: {event_type}, "
                        f"event_id={event_data.get('event_id')}"
                    )
                    handler(event_data)

                    # Commit offset after successful processing
                    self._consumer.commit(message=msg)
                    logger.info(f"Event processing completed: {event_type}")
                else:
                    logger.warning(f"Unregistered event type: {event_type}")
                    self._consumer.commit(message=msg)

            except Exception as e:
                logger.error(
                    f"Event processing failed: {e}",
                    extra={'raw_message': msg.value()},
                    exc_info=True,
                )
                # Processing failed → do not commit → will be redelivered
                # Consider forwarding to Dead Letter Queue
                self._handle_processing_failure(msg, e)

    def stop(self) -> None:
        """Stop the consumer"""
        self._running = False
        self._consumer.close()
        logger.info("Consumer stopped")

    def _handle_processing_failure(self, msg, error: Exception) -> None:
        """Handle processing failure (DLQ forwarding, etc.)"""
        # Get retry count from headers
        headers = dict(msg.headers() or [])
        retry_count = int(headers.get(b'retry_count', b'0'))

        if retry_count >= 3:
            logger.error(
                f"Maximum retry count exceeded. Forwarding to DLQ: "
                f"topic={msg.topic()}, offset={msg.offset()}"
            )
            # Forward to DLQ topic (implementation omitted)
            self._consumer.commit(message=msg)
        else:
            logger.warning(
                f"Scheduled for retry ({retry_count + 1}/3): {error}"
            )
```

### 2.4 Event Handler

```python
# application/handlers/inventory_handler.py
import logging

logger = logging.getLogger(__name__)


class InventoryEventHandler:
    """Event handler for the inventory service

    This handler is placed within the Inventory Bounded Context.
    It receives domain events from the Order service and
    autonomously performs inventory domain operations (reservation/release).
    """

    def __init__(self, inventory_repo, stock_service, event_publisher):
        self._repo = inventory_repo
        self._stock = stock_service
        self._publisher = event_publisher

    def handle_order_placed(self, event_data: dict) -> None:
        """Process OrderPlaced event: Reserve inventory

        Idempotency guarantee:
        - reservation_id = order_id for duplicate check
        - Skip if already reserved
        """
        order_id = event_data['data']['order_id']
        items = event_data['data']['items']

        # Idempotency check: confirm if already processed
        if self._repo.reservation_exists(order_id):
            logger.info(f"Already reserved, skipping: order_id={order_id}")
            return

        reserved_items = []
        try:
            for item in items:
                success = self._stock.reserve(
                    product_id=item['product_id'],
                    quantity=item['quantity'],
                    reservation_id=order_id,
                )
                if not success:
                    # Insufficient inventory → release all previous reservations + publish compensation event
                    self._rollback_reservations(reserved_items, order_id)
                    self._publisher.publish(InventoryInsufficientEvent(
                        order_id=order_id,
                        product_id=item['product_id'],
                        requested_quantity=item['quantity'],
                        correlation_id=event_data.get('correlation_id', ''),
                        causation_id=event_data.get('event_id', ''),
                    ))
                    return
                reserved_items.append(item)

            # All items reserved successfully → publish success event
            self._publisher.publish(InventoryReserved(
                reservation_id=order_id,
                order_id=order_id,
                items=tuple(
                    (item['product_id'], item['quantity'])
                    for item in items
                ),
                correlation_id=event_data.get('correlation_id', ''),
                causation_id=event_data.get('event_id', ''),
            ))
            logger.info(f"Inventory reservation completed: order_id={order_id}")

        except Exception as e:
            logger.error(f"Inventory reservation error: {e}", exc_info=True)
            self._rollback_reservations(reserved_items, order_id)
            raise

    def handle_order_cancelled(self, event_data: dict) -> None:
        """Process OrderCancelled event: Release inventory

        Idempotency guarantee:
        - Do nothing if reservation does not exist
        """
        order_id = event_data['data']['order_id']

        if not self._repo.reservation_exists(order_id):
            logger.info(f"No reservation found, skipping: order_id={order_id}")
            return

        self._stock.release_reservation(reservation_id=order_id)
        self._publisher.publish(InventoryReleasedEvent(
            order_id=order_id,
            correlation_id=event_data.get('correlation_id', ''),
            causation_id=event_data.get('event_id', ''),
        ))
        logger.info(f"Inventory release completed: order_id={order_id}")

    def _rollback_reservations(
        self, reserved_items: list[dict], order_id: str
    ) -> None:
        """Rollback already-reserved items"""
        for item in reversed(reserved_items):
            try:
                self._stock.release(
                    product_id=item['product_id'],
                    reservation_id=order_id,
                )
            except Exception as e:
                logger.error(
                    f"Rollback failed: product_id={item['product_id']}, "
                    f"order_id={order_id}, error={e}"
                )
                # Send alert (manual intervention required)
```

### 2.5 Outbox Pattern (Transaction Guarantee)

```python
# infrastructure/outbox/outbox_publisher.py
"""
Outbox Pattern: Transaction guarantee for event publishing

Problem:
  1. Save domain object to DB
  2. Publish event to Kafka
  → If step 1 succeeds but step 2 fails, data inconsistency occurs

Solution: Outbox table
  1. Save domain object and Outbox record in the same transaction
  2. A separate process (Outbox Relay) reads from the Outbox table and publishes to Kafka
  → Leverages atomicity of transactions

  [DB Transaction]
  ┌─────────────────────────────────────┐
  │  1. INSERT into orders table          │
  │  2. INSERT into outbox table          │
  │  → Both succeed or both rollback      │
  └─────────────────────────────────────┘

  [Outbox Relay (separate process)]
  outbox table → publish to Kafka → update outbox record to published
"""
from sqlalchemy import Column, String, DateTime, Text, Boolean
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json
import uuid


class OutboxRecord(Base):
    """Model for the Outbox table"""
    __tablename__ = 'outbox'

    id = Column(String(36), primary_key=True)
    aggregate_type = Column(String(100), nullable=False)
    aggregate_id = Column(String(100), nullable=False)
    event_type = Column(String(100), nullable=False)
    payload = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)
    published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime, nullable=True)


class OutboxEventPublisher:
    """Event publishing via the Outbox pattern

    Writes events to the Outbox table within the same transaction
    as saving the domain object
    """

    def __init__(self, session: Session):
        self._session = session

    def publish(self, event: DomainEvent) -> None:
        """Record event in the Outbox table

        Note: This method is executed within the caller's transaction
        (session.commit() is called by the caller)
        """
        record = OutboxRecord(
            id=event.event_id,
            aggregate_type=event.event_type.split('.')[0],
            aggregate_id=event.aggregate_id,
            event_type=event.event_type,
            payload=json.dumps(event.to_dict(), ensure_ascii=False, default=str),
            created_at=datetime.now(timezone.utc),
            published=False,
        )
        self._session.add(record)
        # Commit is left to the caller's transaction

    def publish_batch(self, events: list[DomainEvent]) -> None:
        for event in events:
            self.publish(event)


class OutboxRelay:
    """Outbox Relay: Forwards unpublished events to Kafka

    Runs on a regular schedule (e.g., polling every 1 second)
    to fetch unpublished records from the Outbox table and publish to Kafka
    """

    def __init__(self, session: Session, kafka_publisher: KafkaEventPublisher):
        self._session = session
        self._kafka = kafka_publisher

    def relay_pending_events(self, batch_size: int = 100) -> int:
        """Forward unpublished events to Kafka"""
        records = (
            self._session.query(OutboxRecord)
            .filter_by(published=False)
            .order_by(OutboxRecord.created_at)
            .limit(batch_size)
            .all()
        )

        published_count = 0
        for record in records:
            try:
                event_data = json.loads(record.payload)
                # Publish to Kafka
                self._kafka._producer.produce(
                    topic=f"domain-events.{record.aggregate_type}",
                    key=record.aggregate_id.encode(),
                    value=record.payload.encode(),
                )
                # Mark as published
                record.published = True
                record.published_at = datetime.now(timezone.utc)
                published_count += 1
            except Exception as e:
                logger.error(f"Outbox relay failed: {record.id}, {e}")

        self._kafka._producer.flush()
        self._session.commit()

        if published_count > 0:
            logger.info(f"Outbox relay completed: {published_count} events")
        return published_count
```

### 2.6 Saga Pattern (Distributed Transactions)

```python
# application/sagas/order_saga.py
"""
Saga Pattern: Transaction management in distributed environments

Traditional ACID transaction:
  BEGIN
    1. Reserve inventory
    2. Process payment
    3. Arrange shipping
  COMMIT  ← All succeed or all rollback

Distributed Saga:
  1. Reserve inventory → success
  2. Process payment → failure!
  3. Execute compensation for inventory reservation (release)

  Each step is an independent transaction.
  On failure, execute compensation for completed steps in reverse order.

  ┌──────────────────────────────────────────────┐
  │ Normal flow:                                   │
  │ reserve_inventory → process_payment →          │
  │ schedule_shipping → send_confirmation          │
  │                                                │
  │ Compensation flow on failure (fails at payment): │
  │ reserve_inventory → process_payment(FAIL!)     │
  │                   ← release_inventory           │
  └──────────────────────────────────────────────┘
"""
import logging
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class SagaStatus(Enum):
    STARTED = "started"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    FAILED = "failed"


@dataclass
class SagaStep:
    name: str
    execute_func: str
    compensate_func: str
    status: str = "pending"  # pending | completed | compensated | failed


class SagaFailedError(Exception):
    def __init__(self, step_name: str, reason: str):
        self.step_name = step_name
        self.reason = reason
        super().__init__(f"Saga failed at step '{step_name}': {reason}")


class OrderPlacementSaga:
    """Saga for order placement: coordinates processing across multiple services

    Orchestration pattern: Saga directly controls all steps
    (comparison with Choreography pattern described later)
    """

    STEPS = [
        SagaStep('reserve_inventory', 'reserve_inventory', 'release_inventory'),
        SagaStep('process_payment',   'process_payment',   'refund_payment'),
        SagaStep('schedule_shipping', 'schedule_shipping', 'cancel_shipping'),
        SagaStep('send_confirmation', 'send_confirmation', 'noop'),
    ]

    def __init__(
        self,
        inventory_service,
        payment_service,
        shipping_service,
        notification_service,
        saga_log_repo,
    ):
        self._inventory = inventory_service
        self._payment = payment_service
        self._shipping = shipping_service
        self._notification = notification_service
        self._saga_log = saga_log_repo
        self._completed_steps: list[SagaStep] = []
        self._status = SagaStatus.STARTED

    def execute(self, order_id: str, order_data: dict) -> None:
        """Execute the Saga"""
        saga_id = f"saga-{order_id}"
        self._saga_log.create(saga_id, order_id, "order_placement")
        logger.info(f"Saga started: {saga_id}")

        for step in self.STEPS:
            try:
                logger.info(f"Executing Saga step: {step.name}")
                execute_func = getattr(self, step.execute_func)
                execute_func(order_id, order_data)
                step.status = "completed"
                self._completed_steps.append(step)
                self._saga_log.update_step(saga_id, step.name, "completed")
            except Exception as e:
                logger.error(f"Saga failed at {step.name}: {e}")
                step.status = "failed"
                self._saga_log.update_step(saga_id, step.name, "failed")
                self._status = SagaStatus.COMPENSATING
                self._compensate(saga_id, order_id)
                self._status = SagaStatus.FAILED
                raise SagaFailedError(step.name, str(e))

        self._status = SagaStatus.COMPLETED
        self._saga_log.complete(saga_id)
        logger.info(f"Saga completed: {saga_id}")

    def _compensate(self, saga_id: str, order_id: str) -> None:
        """Execute compensation for completed steps in reverse order

        Compensation processing is executed on a "best effort" basis.
        If the compensation itself fails, send an alert and request manual intervention.
        """
        logger.warning(f"Compensation started: {saga_id}")
        for step in reversed(self._completed_steps):
            if step.compensate_func == 'noop':
                continue
            try:
                comp_func = getattr(self, step.compensate_func)
                comp_func(order_id)
                step.status = "compensated"
                self._saga_log.update_step(
                    saga_id, step.name, "compensated"
                )
                logger.info(f"Compensation completed: {step.name}")
            except Exception as e:
                logger.critical(
                    f"Compensation failed (manual intervention required): {step.name}, error={e}",
                    exc_info=True,
                )
                # Send alert: PagerDuty, Slack, etc.

    # === Implementation of each step ===

    def reserve_inventory(self, order_id: str, order_data: dict) -> None:
        self._inventory.reserve(order_id, order_data['items'])

    def release_inventory(self, order_id: str) -> None:
        self._inventory.release_reservation(order_id)

    def process_payment(self, order_id: str, order_data: dict) -> None:
        self._payment.charge(
            order_id=order_id,
            amount=order_data['total_amount'],
            payment_method=order_data['payment_method'],
        )

    def refund_payment(self, order_id: str) -> None:
        self._payment.refund(order_id)

    def schedule_shipping(self, order_id: str, order_data: dict) -> None:
        self._shipping.schedule(
            order_id=order_id,
            address=order_data['shipping_address'],
        )

    def cancel_shipping(self, order_id: str) -> None:
        self._shipping.cancel(order_id)

    def send_confirmation(self, order_id: str, order_data: dict) -> None:
        self._notification.send_order_confirmation(
            order_id=order_id,
            customer_email=order_data['customer_email'],
        )

    def noop(self, order_id: str) -> None:
        pass
```

### 2.7 Choreography vs Orchestration

```
=== Orchestration Pattern (Saga above) ===

  [Saga Orchestrator]
       |
       |---> Inventory Service: "Reserve inventory"
       |<--- "Done"
       |
       |---> Payment Service: "Process payment"
       |<--- "Done"
       |
       |---> Shipping Service: "Arrange shipping"
       |<--- "Done"

  Pros: Entire flow can be understood in one place
  Cons: Orchestrator is a SPOF, logic is centralized


=== Choreography Pattern ===

  Order Service --"OrderPlaced"--> [Event Bus]
       |
       +---> Inventory Service: reserves inventory
                 |
                 +--"InventoryReserved"--> [Event Bus]
                       |
                       +---> Payment Service: processes payment
                                 |
                                 +--"PaymentCompleted"--> [Event Bus]
                                       |
                                       +---> Shipping Service: arranges shipping

  Pros: No SPOF, each service is autonomous
  Cons: Difficult to understand the entire flow, hard to debug


=== Selection Criteria ===

  Choose Orchestration when:
  - 3 or more steps and order matters
  - Compensation processing is complex
  - Visibility of the entire flow is required

  Choose Choreography when:
  - 2-3 steps and simple
  - Maximize independence of each service
  - New consumers are frequently added
```

---

## 3. CQRS (Command Query Responsibility Segregation)

### 3.1 Architecture

```
                        CQRS Architecture

  Command Side                              Query Side
  (Write)                                   (Read)

  [POST /orders]                           [GET /orders?user=123]
       |                                        |
  [Command Handler]                        [Query Handler]
       |                                        |
  [Domain Model]                           [Read Model]
  (normalized                              (denormalized
   domain entities)                         views/projections)
       |                                        ^
  [Write DB]                               [Read DB]
  (PostgreSQL)                              (Elasticsearch / Redis)
       |                                        |
       +--- Domain Events --->  [Projector] ----+
            (updates Read Model asynchronously)

  ★ Write: Prioritizes domain model consistency (normalized)
  ★ Read: Prioritizes query efficiency (denormalized, index-optimized)
  ★ Projector: Receives events and updates the Read Model
```

### 3.2 Implementing CQRS

```python
# === Command Side: Command Handler ===

# application/commands/place_order.py
from dataclasses import dataclass


@dataclass(frozen=True)
class PlaceOrderCommand:
    """Order placement command"""
    customer_id: str
    items: list  # [{"product_id": "...", "quantity": 1}]
    shipping_address: str
    payment_method: str


class PlaceOrderCommandHandler:
    """Handler for the order placement command

    Command Handler responsibilities:
    1. Validate the command
    2. Operate on the domain model
    3. Persist
    4. Publish domain events
    """

    def __init__(self, order_repo, event_publisher, pricing_service):
        self._order_repo = order_repo
        self._event_publisher = event_publisher
        self._pricing = pricing_service

    def handle(self, command: PlaceOrderCommand) -> str:
        # 1. Create domain model
        order = Order.create(
            customer_id=command.customer_id,
            items=command.items,
            shipping_address=command.shipping_address,
        )

        # 2. Apply business rules
        total = self._pricing.calculate_total(order.items)
        order.set_total(total)
        order.confirm()

        # 3. Persist
        self._order_repo.save(order)

        # 4. Publish domain events
        for event in order.collect_events():
            self._event_publisher.publish(event)

        return order.id


# === Query Side: Query Handler ===

# application/queries/get_order_summary.py
@dataclass(frozen=True)
class GetOrderSummaryQuery:
    """Order summary retrieval query"""
    customer_id: str
    page: int = 1
    page_size: int = 20


class GetOrderSummaryQueryHandler:
    """Query handler for order summaries

    Query Handler responsibilities:
    - Return data directly from Read Model (denormalized view)
    - Contains no domain logic
    - Focused on performance optimization
    """

    def __init__(self, read_db):
        self._read_db = read_db

    def handle(self, query: GetOrderSummaryQuery) -> dict:
        # Read Model is already denormalized,
        # so it can be queried quickly without JOINs
        results = self._read_db.find(
            collection='order_summaries',
            filter={'customer_id': query.customer_id},
            sort=[('created_at', -1)],
            skip=(query.page - 1) * query.page_size,
            limit=query.page_size,
        )
        total_count = self._read_db.count(
            collection='order_summaries',
            filter={'customer_id': query.customer_id},
        )
        return {
            'orders': list(results),
            'page': query.page,
            'page_size': query.page_size,
            'total_count': total_count,
        }
```

### 3.3 Projector (Updating the Read Model)

```python
# infrastructure/projectors/order_projector.py
"""
Projector: Receives domain events and updates the Read Model

Write Side events → Projector → Denormalized view on Read Side

  OrderPlaced event → OrderSummaryProjector
  → Creates the following in order_summaries collection:
    {
      "order_id": "ORD-123",
      "customer_id": "USR-456",
      "customer_name": "John Doe",       ← denormalized (no JOIN needed)
      "status": "confirmed",
      "item_count": 3,
      "total_amount": 15000,
      "created_at": "2026-01-15T10:30:00Z"
    }
"""
import logging

logger = logging.getLogger(__name__)


class OrderSummaryProjector:
    """Projector that manages the order summary Read Model"""

    def __init__(self, read_db, customer_repo):
        self._read_db = read_db
        self._customer_repo = customer_repo

    def handle_order_placed(self, event_data: dict) -> None:
        """OrderPlaced event → Create Read Model"""
        data = event_data['data']

        # Fetch customer info (for denormalization)
        customer = self._customer_repo.find_by_id(data['customer_id'])

        summary = {
            'order_id': data['order_id'],
            'customer_id': data['customer_id'],
            'customer_name': customer.name if customer else 'Unknown',
            'customer_email': customer.email if customer else '',
            'status': 'confirmed',
            'items': data['items'],
            'item_count': len(data['items']),
            'total_amount': data['total_amount'],
            'currency': data.get('currency', 'JPY'),
            'created_at': event_data['occurred_at'],
            'updated_at': event_data['occurred_at'],
        }

        self._read_db.upsert(
            collection='order_summaries',
            filter={'order_id': data['order_id']},
            document=summary,
        )
        logger.info(f"Read Model updated: order_id={data['order_id']}")

    def handle_order_cancelled(self, event_data: dict) -> None:
        """OrderCancelled event → Update Read Model"""
        data = event_data['data']
        self._read_db.update(
            collection='order_summaries',
            filter={'order_id': data['order_id']},
            update={
                '$set': {
                    'status': 'cancelled',
                    'cancel_reason': data.get('reason', ''),
                    'updated_at': event_data['occurred_at'],
                }
            },
        )
        logger.info(f"Read Model updated (cancelled): order_id={data['order_id']}")

    def handle_payment_completed(self, event_data: dict) -> None:
        """PaymentCompleted event → Update Read Model"""
        data = event_data['data']
        self._read_db.update(
            collection='order_summaries',
            filter={'order_id': data['order_id']},
            update={
                '$set': {
                    'status': 'paid',
                    'payment_method': data.get('payment_method', ''),
                    'paid_at': event_data['occurred_at'],
                    'updated_at': event_data['occurred_at'],
                }
            },
        )

    def rebuild_all(self) -> None:
        """Full rebuild of the Read Model

        A powerful advantage of Event Sourcing:
        The Read Model can be arbitrarily rebuilt from the event log
        → Easy to rebuild after schema changes or bug fixes
        """
        logger.info("Full Read Model rebuild started")
        self._read_db.drop_collection('order_summaries')
        # Replay all events from the event store
        # (implementation uses EventStore.load_all_events())
        logger.info("Full Read Model rebuild completed")
```

### 3.4 Implementing Event Sourcing

```python
# infrastructure/event_store.py
"""
Event Store: Persists all domain events in chronological order

Traditional CRUD:
  UPDATE orders SET status = 'shipped' WHERE id = 123;
  → Previous state is lost

Event Sourcing:
  INSERT INTO events (aggregate_id, version, type, data) VALUES
    ('ORD-123', 1, 'OrderCreated',   '{"customer_id": "USR-456"}'),
    ('ORD-123', 2, 'ItemAdded',      '{"product_id": "PRD-789", "qty": 2}'),
    ('ORD-123', 3, 'OrderConfirmed', '{"confirmed_at": "..."}'),
    ('ORD-123', 4, 'OrderShipped',   '{"tracking_id": "..."}');
  → All history is preserved. Can restore state at any point in time
"""
from sqlalchemy import Column, String, Integer, DateTime, Text, func
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json


class EventRecord(Base):
    """Table model for the event store"""
    __tablename__ = 'event_store'

    id = Column(Integer, primary_key=True, autoincrement=True)
    aggregate_id = Column(String(100), nullable=False, index=True)
    aggregate_type = Column(String(100), nullable=False)
    version = Column(Integer, nullable=False)
    event_type = Column(String(100), nullable=False)
    data = Column(Text, nullable=False)
    metadata = Column(Text, nullable=True)  # correlation_id, causation_id
    occurred_at = Column(DateTime, nullable=False)
    created_at = Column(
        DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        # Unique constraint on aggregate ID + version (optimistic locking)
        {'unique_together': ('aggregate_id', 'version')},
    )


class ConcurrencyError(Exception):
    """Optimistic lock conflict error"""
    pass


class EventStore:
    """Event store: Saves all events in chronological order

    Design decisions:
    - Append only (UPDATE/DELETE prohibited): Events are immutable facts
    - Optimistic locking: Conflict detection via version
    - Streams per aggregate: Grouped by aggregate_id
    """

    def __init__(self, session: Session):
        self._session = session

    def append(
        self,
        aggregate_id: str,
        aggregate_type: str,
        events: list[DomainEvent],
        expected_version: int,
    ) -> None:
        """Append events (with optimistic locking)

        Args:
            aggregate_id: ID of the aggregate
            aggregate_type: Type name of the aggregate
            events: List of events to append
            expected_version: Expected version (for conflict detection)

        Raises:
            ConcurrencyError: On version conflict
        """
        current_version = self._get_current_version(aggregate_id)
        if current_version != expected_version:
            raise ConcurrencyError(
                f"Expected version {expected_version}, "
                f"but current version is {current_version}. "
                f"aggregate_id={aggregate_id}"
            )

        for i, event in enumerate(events):
            new_version = expected_version + i + 1
            self._session.add(EventRecord(
                aggregate_id=aggregate_id,
                aggregate_type=aggregate_type,
                version=new_version,
                event_type=event.event_type,
                data=json.dumps(event.to_dict(), ensure_ascii=False, default=str),
                metadata=json.dumps({
                    'correlation_id': event.correlation_id,
                    'causation_id': event.causation_id,
                }),
                occurred_at=event.occurred_at,
            ))
        self._session.commit()

    def load(self, aggregate_id: str) -> list[dict]:
        """Fetch all events for an aggregate"""
        records = (
            self._session.query(EventRecord)
            .filter_by(aggregate_id=aggregate_id)
            .order_by(EventRecord.version)
            .all()
        )
        return [
            {
                'version': r.version,
                'event_type': r.event_type,
                'data': json.loads(r.data),
                'metadata': json.loads(r.metadata) if r.metadata else {},
                'occurred_at': r.occurred_at,
            }
            for r in records
        ]

    def load_from_version(
        self, aggregate_id: str, from_version: int
    ) -> list[dict]:
        """Fetch events from a specified version (for use with snapshots)"""
        records = (
            self._session.query(EventRecord)
            .filter_by(aggregate_id=aggregate_id)
            .filter(EventRecord.version > from_version)
            .order_by(EventRecord.version)
            .all()
        )
        return [
            {
                'version': r.version,
                'event_type': r.event_type,
                'data': json.loads(r.data),
                'occurred_at': r.occurred_at,
            }
            for r in records
        ]

    def _get_current_version(self, aggregate_id: str) -> int:
        result = (
            self._session.query(func.max(EventRecord.version))
            .filter_by(aggregate_id=aggregate_id)
            .scalar()
        )
        return result or 0


class SnapshotStore:
    """Snapshot store: Periodically caches aggregate state

    Challenge with Event Sourcing:
    - Replaying increases as the number of events grows
    - Example: Replaying 1000 events for an order every time is inefficient

    Solution: Snapshots
    - Save aggregate state as a snapshot every N events
    - On restore: snapshot + replay events after the snapshot
    """

    def __init__(self, session: Session):
        self._session = session

    def save_snapshot(
        self, aggregate_id: str, version: int, state: dict
    ) -> None:
        """Save a snapshot"""
        self._session.execute(
            """
            INSERT INTO snapshots (aggregate_id, version, state, created_at)
            VALUES (:agg_id, :version, :state, :created_at)
            ON CONFLICT (aggregate_id) DO UPDATE SET
                version = :version,
                state = :state,
                created_at = :created_at
            """,
            {
                'agg_id': aggregate_id,
                'version': version,
                'state': json.dumps(state, ensure_ascii=False),
                'created_at': datetime.now(timezone.utc),
            }
        )
        self._session.commit()

    def load_snapshot(self, aggregate_id: str) -> dict | None:
        """Fetch the latest snapshot"""
        result = self._session.execute(
            "SELECT version, state FROM snapshots WHERE aggregate_id = :agg_id",
            {'agg_id': aggregate_id},
        ).fetchone()
        if result:
            return {
                'version': result[0],
                'state': json.loads(result[1]),
            }
        return None
```

### 3.5 Event Sourced Aggregate

```python
# domain/models/order.py
"""
Event Sourced Aggregate: Aggregate managed by Event Sourcing

Traditional aggregate: Holds current state directly
Event Sourced aggregate: Builds state by applying events

State changes always go through events:
  order.add_item(product, qty)
    → Generates ItemAddedToOrder event
    → Applies event to itself to update state
    → On persistence, appends event to the event store
"""
from dataclasses import dataclass, field


class EventSourcedAggregate:
    """Base class for Event Sourcing-compatible aggregates"""

    def __init__(self):
        self._version: int = 0
        self._pending_events: list[DomainEvent] = []

    @property
    def version(self) -> int:
        return self._version

    def collect_events(self) -> list[DomainEvent]:
        """Fetch and clear unpersisted events"""
        events = self._pending_events.copy()
        self._pending_events.clear()
        return events

    def _apply_event(self, event: DomainEvent) -> None:
        """Apply event to update state (implemented in subclass)"""
        handler_name = f"_on_{self._to_snake_case(type(event).__name__)}"
        handler = getattr(self, handler_name, None)
        if handler:
            handler(event)
        self._version += 1

    def _raise_event(self, event: DomainEvent) -> None:
        """Raise a new event"""
        self._apply_event(event)
        self._pending_events.append(event)

    def _load_from_history(self, events: list[DomainEvent]) -> None:
        """Restore state from event history"""
        for event in events:
            self._apply_event(event)

    @staticmethod
    def _to_snake_case(name: str) -> str:
        import re
        return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()


class Order(EventSourcedAggregate):
    """Order aggregate (Event Sourced)"""

    def __init__(self):
        super().__init__()
        self.id: str = ""
        self.customer_id: str = ""
        self.items: list = []
        self.status: str = ""
        self.total_amount: int = 0
        self.shipping_address: str = ""
        self.created_at: str = ""
        self.confirmed_at: str = ""
        self.shipped_at: str = ""
        self.cancelled_at: str = ""

    # === Command methods (raise events) ===

    @classmethod
    def create(cls, order_id: str, customer_id: str) -> 'Order':
        order = cls()
        order._raise_event(OrderCreated(
            order_id=order_id,
            customer_id=customer_id,
        ))
        return order

    def add_item(
        self, product_id: str, quantity: int, unit_price: int
    ) -> None:
        if self.status != "created":
            raise ValueError("Cannot add items to a confirmed order")
        if quantity <= 0:
            raise ValueError("Quantity must be at least 1")

        self._raise_event(ItemAddedToOrder(
            order_id=self.id,
            product_id=product_id,
            quantity=quantity,
            unit_price=unit_price,
        ))

    def confirm(self) -> None:
        if self.status != "created":
            raise ValueError(f"Cannot confirm from status '{self.status}'")
        if not self.items:
            raise ValueError("Cannot confirm an order with no items")

        self._raise_event(OrderConfirmed(
            order_id=self.id,
            confirmed_at=datetime.now(timezone.utc).isoformat(),
        ))

    def ship(self, tracking_id: str) -> None:
        if self.status != "confirmed":
            raise ValueError(f"Cannot ship from status '{self.status}'")

        self._raise_event(OrderShipped(
            order_id=self.id,
            tracking_id=tracking_id,
            shipped_at=datetime.now(timezone.utc).isoformat(),
        ))

    def cancel(self, reason: str, cancelled_by: str = "customer") -> None:
        if self.status in ("shipped", "cancelled"):
            raise ValueError(f"Cannot cancel from status '{self.status}'")

        self._raise_event(OrderCancelled(
            order_id=self.id,
            reason=reason,
            cancelled_by=cancelled_by,
        ))

    # === Event handlers (update state) ===

    def _on_order_created(self, event: OrderCreated) -> None:
        self.id = event.order_id
        self.customer_id = event.customer_id
        self.status = "created"
        self.items = []
        self.total_amount = 0

    def _on_item_added_to_order(self, event: ItemAddedToOrder) -> None:
        self.items.append({
            'product_id': event.product_id,
            'quantity': event.quantity,
            'unit_price': event.unit_price,
        })
        self.total_amount += event.quantity * event.unit_price

    def _on_order_confirmed(self, event: OrderConfirmed) -> None:
        self.status = "confirmed"
        self.confirmed_at = event.confirmed_at

    def _on_order_shipped(self, event) -> None:
        self.status = "shipped"
        self.shipped_at = event.shipped_at

    def _on_order_cancelled(self, event: OrderCancelled) -> None:
        self.status = "cancelled"
        self.cancelled_at = datetime.now(timezone.utc).isoformat()

    # === Used by repository ===

    @classmethod
    def from_events(cls, events: list[DomainEvent]) -> 'Order':
        """Restore aggregate from event history"""
        order = cls()
        order._load_from_history(events)
        return order
```

---

## 4. Testing Strategy

### 4.1 Testing Event Handlers

```python
# tests/test_inventory_handler.py
import pytest


class FakeInventoryRepo:
    def __init__(self):
        self._reservations = set()

    def reservation_exists(self, order_id: str) -> bool:
        return order_id in self._reservations

    def add_reservation(self, order_id: str) -> None:
        self._reservations.add(order_id)


class FakeStockService:
    def __init__(self, available_products: set = None):
        self._available = available_products or set()
        self._reserved = {}
        self._released = []

    def reserve(
        self, product_id: str, quantity: int, reservation_id: str
    ) -> bool:
        if product_id not in self._available:
            return False
        self._reserved[reservation_id] = self._reserved.get(
            reservation_id, []
        )
        self._reserved[reservation_id].append(
            {'product_id': product_id, 'quantity': quantity}
        )
        return True

    def release_reservation(self, reservation_id: str) -> None:
        self._released.append(reservation_id)

    def release(self, product_id: str, reservation_id: str) -> None:
        self._released.append(
            {'product_id': product_id, 'reservation_id': reservation_id}
        )


class TestInventoryEventHandler:
    """Tests for the inventory event handler"""

    def setup_method(self):
        self.repo = FakeInventoryRepo()
        self.stock = FakeStockService(
            available_products={'PRD-001', 'PRD-002'}
        )
        self.publisher = InMemoryEventPublisher()
        self.handler = InventoryEventHandler(
            inventory_repo=self.repo,
            stock_service=self.stock,
            event_publisher=self.publisher,
        )

    def test_inventory_reservation_success(self):
        """When all items are sufficiently in stock, reservation succeeds"""
        event_data = {
            'event_id': 'evt-001',
            'event_type': 'order.placed',
            'correlation_id': 'corr-001',
            'data': {
                'order_id': 'ORD-123',
                'items': [
                    {'product_id': 'PRD-001', 'quantity': 2},
                    {'product_id': 'PRD-002', 'quantity': 1},
                ],
            },
        }

        self.handler.handle_order_placed(event_data)

        # InventoryReserved event is published
        reserved_events = self.publisher.get_events_of_type(
            'inventory.reserved'
        )
        assert len(reserved_events) == 1
        assert reserved_events[0].order_id == 'ORD-123'

    def test_insufficient_inventory_publishes_compensation_event(self):
        """When inventory is insufficient, a compensation event is published"""
        event_data = {
            'event_id': 'evt-002',
            'event_type': 'order.placed',
            'correlation_id': 'corr-002',
            'data': {
                'order_id': 'ORD-456',
                'items': [
                    {'product_id': 'PRD-001', 'quantity': 1},
                    {'product_id': 'PRD-999', 'quantity': 1},  # out of stock
                ],
            },
        }

        self.handler.handle_order_placed(event_data)

        # Insufficient inventory event is published
        insufficient_events = self.publisher.get_events_of_type(
            'inventory.insufficient'
        )
        assert len(insufficient_events) == 1

    def test_idempotency_duplicate_event_ignored(self):
        """Even if the same order_id event arrives twice, it is processed only once"""
        self.repo.add_reservation('ORD-789')

        event_data = {
            'event_id': 'evt-003',
            'event_type': 'order.placed',
            'data': {
                'order_id': 'ORD-789',
                'items': [{'product_id': 'PRD-001', 'quantity': 1}],
            },
        }

        self.handler.handle_order_placed(event_data)

        # No events are published (skipped)
        assert len(self.publisher.published_events) == 0
```

### 4.2 Testing Event Sourced Aggregates

```python
# tests/test_order_aggregate.py
import pytest


class TestOrderAggregate:
    """Tests for the Event Sourced Order aggregate"""

    def test_order_creation(self):
        order = Order.create(order_id='ORD-001', customer_id='USR-001')

        assert order.id == 'ORD-001'
        assert order.customer_id == 'USR-001'
        assert order.status == 'created'
        assert order.version == 1

        events = order.collect_events()
        assert len(events) == 1
        assert events[0].event_type == 'order.created'

    def test_add_item(self):
        order = Order.create(order_id='ORD-001', customer_id='USR-001')
        order.add_item('PRD-001', quantity=2, unit_price=1000)
        order.add_item('PRD-002', quantity=1, unit_price=2000)

        assert len(order.items) == 2
        assert order.total_amount == 4000  # 2*1000 + 1*2000
        assert order.version == 3

    def test_order_confirmation(self):
        order = Order.create(order_id='ORD-001', customer_id='USR-001')
        order.add_item('PRD-001', quantity=1, unit_price=1000)
        order.confirm()

        assert order.status == 'confirmed'

    def test_empty_order_cannot_be_confirmed(self):
        order = Order.create(order_id='ORD-001', customer_id='USR-001')

        with pytest.raises(ValueError, match="no items"):
            order.confirm()

    def test_shipped_order_cannot_be_cancelled(self):
        order = Order.create(order_id='ORD-001', customer_id='USR-001')
        order.add_item('PRD-001', quantity=1, unit_price=1000)
        order.confirm()
        order.ship(tracking_id='TRK-001')

        with pytest.raises(ValueError, match="Cannot cancel"):
            order.cancel(reason="Changed my mind")

    def test_restore_from_event_history(self):
        """Core of Event Sourcing: restore state by replaying events"""
        # 1. Operate on aggregate to generate events
        original = Order.create(order_id='ORD-001', customer_id='USR-001')
        original.add_item('PRD-001', quantity=2, unit_price=1000)
        original.add_item('PRD-002', quantity=1, unit_price=2000)
        original.confirm()
        events = original.collect_events()

        # 2. Restore aggregate from event history
        restored = Order.from_events(events)

        # 3. Restored aggregate has the same state as the original
        assert restored.id == original.id
        assert restored.customer_id == original.customer_id
        assert restored.status == original.status
        assert restored.total_amount == original.total_amount
        assert len(restored.items) == len(original.items)
        assert restored.version == original.version
```

### 4.3 Testing Sagas

```python
# tests/test_order_saga.py
import pytest


class FakeService:
    """Fake service for testing"""
    def __init__(self, should_fail: bool = False):
        self._should_fail = should_fail
        self.calls = []

    def __getattr__(self, name):
        def method(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            if self._should_fail and name == self._fail_method:
                raise RuntimeError(f"{name} failed")
        return method

    def set_fail_method(self, method_name: str):
        self._should_fail = True
        self._fail_method = method_name


class FakeSagaLogRepo:
    def __init__(self):
        self.logs = {}

    def create(self, saga_id, order_id, saga_type):
        self.logs[saga_id] = {'order_id': order_id, 'steps': {}}

    def update_step(self, saga_id, step_name, status):
        self.logs[saga_id]['steps'][step_name] = status

    def complete(self, saga_id):
        self.logs[saga_id]['completed'] = True


class TestOrderPlacementSaga:

    def test_successful_completion(self):
        """When all steps succeed"""
        inventory = FakeService()
        payment = FakeService()
        shipping = FakeService()
        notification = FakeService()
        saga_log = FakeSagaLogRepo()

        saga = OrderPlacementSaga(
            inventory_service=inventory,
            payment_service=payment,
            shipping_service=shipping,
            notification_service=notification,
            saga_log_repo=saga_log,
        )

        saga.execute('ORD-001', {
            'items': [{'product_id': 'PRD-001', 'quantity': 1}],
            'total_amount': 1000,
            'payment_method': 'credit_card',
            'shipping_address': '123 Main St, Tokyo',
            'customer_email': 'test@example.com',
        })

        assert saga._status == SagaStatus.COMPLETED

    def test_compensation_on_payment_failure(self):
        """When payment fails, compensation for inventory reservation is executed"""
        inventory = FakeService()
        payment = FakeService()
        payment.set_fail_method('charge')
        shipping = FakeService()
        notification = FakeService()
        saga_log = FakeSagaLogRepo()

        saga = OrderPlacementSaga(
            inventory_service=inventory,
            payment_service=payment,
            shipping_service=shipping,
            notification_service=notification,
            saga_log_repo=saga_log,
        )

        with pytest.raises(SagaFailedError) as exc_info:
            saga.execute('ORD-002', {
                'items': [{'product_id': 'PRD-001', 'quantity': 1}],
                'total_amount': 1000,
                'payment_method': 'credit_card',
                'shipping_address': '123 Main St, Tokyo',
                'customer_email': 'test@example.com',
            })

        assert exc_info.value.step_name == 'process_payment'
        assert saga._status == SagaStatus.FAILED

        # Verify that inventory compensation (release) was called
        inventory_calls = [c[0] for c in inventory.calls]
        assert 'release_reservation' in inventory_calls
```

---

## 5. Operations and Monitoring

### 5.1 Dead Letter Queue (DLQ)

```
=== How Dead Letter Queue Works ===

  Normal flow:
  [Event Bus] → [Consumer] → Processing success → Commit offset

  DLQ flow:
  [Event Bus] → [Consumer] → Processing failure (3 retries)
                                 ↓
                           [Dead Letter Queue]
                                 ↓
                           [DLQ Consumer / manual review]
                                 ↓
                           Reprocess after fix, or discard

  Cases that end up in DLQ:
  - Invalid message format (deserialization failure)
  - Business rule violation (updating a non-existent order)
  - Non-transient failures (external API authentication error, etc.)

  DLQ monitoring items:
  - Number of messages in DLQ (sudden increase indicates system failure)
  - Dwell time of messages in DLQ
  - Success rate of reprocessing from DLQ
```

### 5.2 Monitoring and Tracing

```
=== Observability in Event-Driven Systems ===

  1. Distributed Tracing (OpenTelemetry)
     ┌──────────────────────────────────────┐
     │ Trace ID: abc-123                     │
     │                                       │
     │ [API Gateway] ─── 5ms ──┐             │
     │                          │             │
     │ [Order Service] ─── 20ms ──┐           │
     │                             │           │
     │ [Kafka Publish] ─── 3ms ──┐ │           │
     │                            │ │           │
     │ [Inventory Handler] ─── 50ms │           │
     │                               │           │
     │ [Payment Handler] ─── 200ms  │            │
     │                                           │
     │ Total: 278ms                              │
     └──────────────────────────────────────┘

  2. Metrics (Prometheus + Grafana)
     - events_published_total (counter): Number of events published
     - events_consumed_total (counter): Number of events consumed
     - event_processing_duration_seconds (histogram): Processing time
     - consumer_lag (gauge): Consumer lag
     - dlq_messages_total (counter): Number of messages that entered DLQ

  3. Alert conditions
     - Consumer Lag > 10,000: Consumer is not keeping up
     - DLQ growth rate > 100/min: Sign of large-scale failure
     - P99 processing time > 5s: Performance degradation
     - Error rate > 5%: Handler bug or dependent service failure
```

### 5.3 Idempotency Implementation Patterns

```python
# infrastructure/idempotency/idempotency_store.py
"""
Idempotency: Guarantees that processing the same event multiple times yields the same result

Why idempotency is needed:
  - at-least-once delivery: Kafka guarantees "at least once" delivery
  - Offset may rewind on Consumer restart
  - Retries due to network failures

Idempotency implementation approaches:
  1. Processed check using event_id (recommended)
  2. Deduplication via natural key (e.g., order_id + event_type)
  3. Conditional update (e.g., WHERE version = expected_version)
"""


class IdempotencyStore:
    """Idempotency store: Records processed events"""

    def __init__(self, session):
        self._session = session

    def is_processed(self, event_id: str) -> bool:
        """Check if an event has been processed"""
        result = self._session.execute(
            "SELECT 1 FROM processed_events WHERE event_id = :event_id",
            {'event_id': event_id},
        ).fetchone()
        return result is not None

    def mark_processed(self, event_id: str, handler_name: str) -> None:
        """Record an event as processed"""
        self._session.execute(
            """
            INSERT INTO processed_events (event_id, handler_name, processed_at)
            VALUES (:event_id, :handler_name, :processed_at)
            ON CONFLICT (event_id, handler_name) DO NOTHING
            """,
            {
                'event_id': event_id,
                'handler_name': handler_name,
                'processed_at': datetime.now(timezone.utc),
            },
        )
        self._session.commit()


def idempotent_handler(idempotency_store: IdempotencyStore):
    """Decorator that guarantees idempotency"""
    def decorator(func):
        def wrapper(event_data: dict) -> None:
            event_id = event_data.get('event_id', '')
            handler_name = func.__qualname__

            if idempotency_store.is_processed(event_id):
                logger.info(
                    f"Skipping already-processed event: "
                    f"event_id={event_id}, handler={handler_name}"
                )
                return

            func(event_data)
            idempotency_store.mark_processed(event_id, handler_name)
        return wrapper
    return decorator
```

---

## 6. Comparison Tables

### 6.1 Synchronous vs Asynchronous

| Characteristic | Synchronous (REST/gRPC) | Asynchronous (Event-Driven) |
|-----|:----------------:|:--------------------:|
| Coupling | High (direct calls) | Low (via event bus) |
| Latency | Sum of all services | Can respond immediately |
| Fault tolerance | Cascade failure risk | Independent per service |
| Data consistency | Strong consistency (possible) | Eventual consistency |
| Debugging | Easy (synchronous flow) | Difficult (async flow tracing) |
| Scalability | Bottleneck occurs | Independent scaling |
| Learning cost | Low | High |
| Operational cost | Low | High (Kafka, etc. operation) |

### 6.2 State Management Approaches

| Approach | State Management | Audit Log | Complexity | Use Cases |
|-----------|---------|---------|--------|---------|
| CRUD | Holds only latest state | Requires separate implementation | Low | Simple apps |
| CQRS | Read/write separation | Requires separate implementation | Medium | Different load profiles for reads/writes |
| Event Sourcing | Reconstructed from event log | Naturally achieved | High | Complete audit trail required |
| CQRS + ES | Event log + Read Model | Naturally achieved | Highest | Finance, healthcare, regulation |

### 6.3 Message Broker Comparison

| Characteristic | Apache Kafka | RabbitMQ | AWS SNS+SQS |
|-----|:-----------:|:--------:|:-----------:|
| Throughput | Very high (1M msg/s) | High (10K msg/s) | High (managed) |
| Message retention | Retained for configured period (replayable) | Deleted after consumption | SQS: up to 14 days |
| Ordering guarantee | Within partition | Within queue | FIFO SQS guarantees it |
| Consumer Group | Native support | Manual setup | SQS separates queues |
| Operational cost | High (self-managed) | Moderate | Low (managed) |
| Use cases | Large-scale streaming | Task queues | AWS ecosystem |

### 6.4 Saga Pattern Comparison

| Characteristic | Orchestration | Choreography |
|-----|:------------:|:------------:|
| Centralization of control | High (Orchestrator) | Low (distributed) |
| Flow visibility | High | Low |
| SPOF risk | Yes (Orchestrator) | None |
| Ease of debugging | High | Low |
| Service independence | Moderate | High |
| Use cases | Complex flows with 3+ steps | Simple flows with 2-3 steps |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Using Events as a Replacement for RPC

```
WHY: Events convey "a fact that occurred".
     "Please do X" is a command, not an event.
     Expecting a synchronous response from an event eliminates the benefits of loose coupling.

BAD: Mimicking synchronous request/response with events
  Order Service --> "PleaseReserveInventory" --> Inventory Service
  Order Service <-- "InventoryReserved" <-- Inventory Service
  → Imperative event name. Effectively a synchronous call
  → Order Service is waiting for a response from Inventory Service

GOOD: Events convey "a fact that occurred"
  Order Service --> "OrderPlaced" --> [Event Bus]
  → Inventory Service autonomously decides to reserve inventory
  → Order Service does not wait for the result
  → Past-tense event names (OrderPlaced, PaymentCompleted)
```

### Anti-Pattern 2: Making Everything Event-Driven

```
WHY: Event-driven is not a silver bullet.
     Using events for cases where synchronous processing is appropriate
     (authentication, data retrieval) introduces unnecessary complexity and latency.

BAD: User authentication and data fetching also go through event bus
  User --> "AuthenticateUser" --> [Event Bus] --> Auth Service
  → Several seconds of latency for login
  → Simple GET requests routed through event bus

GOOD: The right tool for the right job
  - Synchronous (REST/gRPC):
    User authentication, data retrieval, processes requiring real-time response
  - Asynchronous (Event):
    Order processing, notification sending, data sync, batch processing,
    fan-out to multiple services
```

### Anti-Pattern 3: Including Domain Logic in Events

```
WHY: Events only record "what happened".
     "How to process it" is the consumer's domain logic.
     Including processing logic in events removes the consumer's autonomy.

BAD: Including processing instructions in events
  {
    "event_type": "order.placed",
    "order_id": "ORD-123",
    "instructions": {
      "inventory": "reserve PRD-001 x 2",     ← processing instruction
      "payment": "charge 3000 JPY",            ← processing instruction
      "shipping": "express delivery to ..."     ← processing instruction
    }
  }
  → The sender knows how every consumer should process (tight coupling)

GOOD: Events contain only facts
  {
    "event_type": "order.placed",
    "order_id": "ORD-123",
    "customer_id": "USR-456",
    "items": [{"product_id": "PRD-001", "quantity": 2}],
    "total_amount": 3000
  }
  → Each Consumer autonomously decides how to process
```

### Anti-Pattern 4: Publishing Events Without the Outbox Pattern

```
WHY: Performing DB save and event publishing as separate transactions means
     if either fails, data inconsistency occurs.

BAD: Two independent operations
  def place_order(order):
      db.save(order)          # 1. Save to DB (succeeds)
      kafka.publish(event)    # 2. Publish to Kafka (may fail)
      # → Saved to DB, but event is not published
      # → Downstream services are unaware of the order

GOOD: Outbox pattern
  def place_order(order):
      with db.transaction():
          db.save(order)          # 1. Save order
          outbox.save(event)      # 2. Save event to Outbox
      # → Saved atomically within the same transaction
      # → Outbox Relay transfers to Kafka in a separate process
```

### Anti-Pattern 5: Handlers Without Idempotency Consideration

```
WHY: With at-least-once delivery, the same event may arrive multiple times.
     Without idempotency, duplicate processing (double billing, double inventory reservation) occurs.

BAD: No idempotency
  def handle_payment(event):
      payment_service.charge(
          order_id=event['order_id'],
          amount=event['total_amount'],
      )
      # → If the same event arrives twice, billing happens twice

GOOD: Idempotency guarantee
  def handle_payment(event):
      if idempotency_store.is_processed(event['event_id']):
          return  # Skip if already processed

      payment_service.charge(
          order_id=event['order_id'],
          amount=event['total_amount'],
      )
      idempotency_store.mark_processed(event['event_id'])
```

---

## 8. Practice Exercises

### Exercise 1: Basic — Event Definition and Publisher (30 minutes)

**Task**: Design an event-driven system for "product review submission" on an e-commerce site

Define the following events and implement a publisher:
1. `ReviewSubmitted`: Review submitted (review_id, product_id, user_id, rating, comment)
2. `ReviewApproved`: Review approved (review_id, approved_by)
3. `ReviewRejected`: Review rejected (review_id, reason)

Implement the following event handlers:
- `ProductRatingUpdater`: Updates the product's average rating when ReviewApproved is received
- `NotificationHandler`: Notifies the submitter when ReviewApproved is received

**Expected output**:
```python
# ReviewSubmitted event is published
publisher.publish(ReviewSubmitted(
    review_id="REV-001",
    product_id="PRD-001",
    user_id="USR-001",
    rating=5,
    comment="Excellent product"
))

# ProductRatingUpdater updates the average rating
# → product PRD-001 average rating updated to 4.5
# NotificationHandler sends a notification
# → user USR-001 receives "Your review has been approved" notification
```

### Exercise 2: Applied — Implementing the Saga Pattern (60 minutes)

**Task**: Implement a Saga for a travel booking system

Steps:
1. Flight reservation (reserve_flight / cancel_flight)
2. Hotel reservation (reserve_hotel / cancel_hotel)
3. Car rental reservation (reserve_car / cancel_car)
4. Payment processing (charge_payment / refund_payment)

Requirements:
- If hotel reservation fails, compensation for flight reservation must be executed
- Record the status of each step in the log
- Write at least 3 test cases

**Expected output**:
```python
# Happy path
saga.execute("TRIP-001", trip_data)
# → All steps completed

# Hotel reservation failure
saga.execute("TRIP-002", trip_data)
# → SagaFailedError: "Saga failed at step 'reserve_hotel': No rooms"
# → Flight reservation compensation (cancellation) has been executed
```

### Exercise 3: Advanced — Implementing an Event Sourced Aggregate (90 minutes)

**Task**: Implement a bank account as an Event Sourced Aggregate

Events:
- `AccountOpened(account_id, owner_name, initial_balance)`
- `MoneyDeposited(account_id, amount, description)`
- `MoneyWithdrawn(account_id, amount, description)`
- `AccountFrozen(account_id, reason)`
- `AccountClosed(account_id)`

Business rules:
- Reject withdrawals that would make balance negative
- Frozen accounts cannot deposit or withdraw
- Closed accounts cannot be operated on
- Daily withdrawal limit is 1,000,000 JPY

Test requirements:
- Test for state restoration from event history
- Test for rejection of business rule violations
- Test for restoration from snapshot

**Expected output**:
```python
# Operate on account
account = BankAccount.open("ACC-001", "John Doe", 100000)
account.deposit(50000, "Salary transfer")
account.withdraw(30000, "ATM withdrawal")

assert account.balance == 120000
assert account.version == 3

# Restore from event history
events = account.collect_events()
restored = BankAccount.from_events(events)
assert restored.balance == 120000

# Business rule violation
with pytest.raises(ValueError, match="Insufficient balance"):
    account.withdraw(200000, "Large withdrawal")

# Cannot operate while frozen
account.freeze("Suspected fraudulent use")
with pytest.raises(ValueError, match="frozen"):
    account.deposit(10000, "Transfer")
```

---

## 9. FAQ

### Q1. How do you guarantee event ordering?

**A.** In Kafka, by using the aggregate ID as the partition key, events for the same aggregate are guaranteed to be ordered within the same partition. Ordering across different aggregates is not required (since each aggregate is independent). When ordering is necessary, include a `version` field in events and perform ordering validation on the Consumer side.

```python
# Use aggregate_id as the partition key
producer.produce(
    topic="domain-events.order",
    key=order_id.encode(),  # ← partition key
    value=event_payload,
)
# → Events with the same order_id always go to the same partition
# → FIFO (first-in, first-out) guarantee within a partition

# Consumer-side ordering validation
def handle_event(event_data):
    expected_version = get_last_processed_version(event_data['aggregate_id'])
    actual_version = event_data['version']
    if actual_version <= expected_version:
        return  # Already processed (idempotency)
    if actual_version > expected_version + 1:
        raise OutOfOrderError("Event is out of order. Reprocessing required")
```

### Q2. How do you handle the "inconsistency window" in eventual consistency?

**A.** Address it at both the UI level and business level.

```
UI-level handling:
  1. Optimistic UI: Immediately display "Order accepted (processing)"
  2. Polling / WebSocket: Notify of latest state in the background
  3. Status display: Show transition "processing" → "confirmed" → "shipped"

Business-level handling:
  1. Define SLA: "Inventory reservation within 30 seconds of order confirmation"
  2. Timeout: Alert if processing does not complete within specified time
  3. Compensation: Automatically or manually correct detected inconsistencies
  4. Agreement with domain experts: "Is a delay of a few seconds to minutes acceptable?"

Real-world example (e-commerce site):
  - Order confirmation: Immediate response ("Order accepted")
  - Inventory reservation: Within 5 seconds (asynchronous)
  - Payment processing: Within 10 seconds (asynchronous)
  - Shipping notification: Minutes to hours (acceptable by business)
```

### Q3. How do you manage event schema changes (versioning)?

**A.** Combine the following four strategies:

```python
# Strategy 1: Maintain backward compatibility (recommended)
# Adding fields is OK, removing or changing types is NOT OK
@dataclass(frozen=True)
class OrderPlacedV1(DomainEvent):
    event_type: str = "order.placed"
    order_id: str = ""
    total_amount: int = 0

@dataclass(frozen=True)
class OrderPlacedV2(DomainEvent):  # Backward compatible with V1
    event_type: str = "order.placed"
    order_id: str = ""
    total_amount: int = 0
    currency: str = "JPY"     # ← Newly added (has default value)
    discount_amount: int = 0  # ← Newly added (has default value)

# Strategy 2: Versioned event types (when breaking changes are necessary)
# "order.placed.v1" → "order.placed.v2"

# Strategy 3: UpCaster (converts old versions to new versions)
class EventUpCaster:
    def upcast(self, event_data: dict) -> dict:
        event_type = event_data.get('event_type', '')
        version = event_data.get('schema_version', 1)

        if event_type == 'order.placed' and version == 1:
            # Convert V1 → V2
            event_data['currency'] = 'JPY'  # default value
            event_data['discount_amount'] = 0
            event_data['schema_version'] = 2
        return event_data

# Strategy 4: Schema Registry (Confluent Schema Registry)
# → Centralized schema management and automatic compatibility checking
```

### Q4. How do you determine the number of Kafka partitions?

**A.** Determine based on Consumer parallelism and throughput requirements.

```
Basic principle:
  Number of partitions >= Number of Consumer instances

  Example: To run Consumer with 10 instances
  → Number of partitions = 10 or more

  Throughput calculation:
  - Single partition write: approximately 10MB/s
  - Target throughput: 100MB/s
  → Number of partitions = 100MB/s ÷ 10MB/s = 10

Notes:
  - Partition count can be increased but not decreased
  - Too many partitions causes metadata overhead
  - Recommended: 6-12 partitions per topic initially
  - At scale: hundreds of partitions are possible (Kafka limit is thousands)
```

### Q5. What is the relationship between event-driven and microservices?

**A.** Event-driven is one communication pattern between microservices. Microservices are not required, but they are a very good fit together.

```
Event-driven can be used in a monolith too:
  [Module A] --event--> [EventBus(in-process)] --> [Module B]
  → Achieves loose coupling between modules
  → Groundwork for future microservice migration

Microservices + Event-Driven:
  [Service A] --event--> [Kafka] --> [Service B]
  → Complete loose coupling between services
  → Independent deployment, independent scaling

Event-driven without microservices:
  - Internal notification systems
  - Batch processing pipelines
  - IoT device data collection
```

### Q6. How do you handle the "massive number of events" problem in Event Sourcing?

**A.** Handle it with a combination of snapshots and archiving.

```
1. Snapshots (described earlier):
   - Save aggregate state as a snapshot every N events
   - On restore: snapshot + replay events after the snapshot
   - Recommended: snapshot every 100 events

2. Archiving:
   - Move old events to cold storage (S3, etc.)
   - Events before the snapshot are candidates for archiving
   - Can be restored from archive when needed

3. Using the Read Model:
   - Normal queries use the Read Model (updated by Projector)
   - Event store is limited to write and audit use
   - Read Model is denormalized and fast

Real-world example:
  - Average 50 events/year per aggregate
  - 1 million aggregates → 50 million events/year
  - With snapshots + 3-year archiving,
    keep active event count within manageable range
```

### Q7. How do you build an event-driven system in a test environment?

**A.** Combine in-memory implementations for testing with Testcontainers.

```python
# Unit tests: in-memory implementation
class TestOrderWorkflow:
    def setup_method(self):
        self.publisher = InMemoryEventPublisher()
        self.handler = InventoryEventHandler(
            inventory_repo=FakeInventoryRepo(),
            stock_service=FakeStockService(),
            event_publisher=self.publisher,
        )

# Integration tests: Start Kafka with Testcontainers
import testcontainers.kafka

class TestKafkaIntegration:
    @classmethod
    def setup_class(cls):
        cls.kafka = testcontainers.kafka.KafkaContainer()
        cls.kafka.start()
        cls.bootstrap_servers = cls.kafka.get_bootstrap_server()

    @classmethod
    def teardown_class(cls):
        cls.kafka.stop()

    def test_publish_and_consume(self):
        publisher = KafkaEventPublisher(self.bootstrap_servers)
        # ... integration test
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|---------|
| Benefits of event-driven | Loose coupling, independent scaling, fault tolerance |
| Three patterns | Event Notification / Event-Carried State Transfer / Event Sourcing |
| Pub/Sub | Complete separation of producers and consumers |
| CQRS | Independently optimize reads and writes |
| Saga pattern | Alternative to distributed transactions (eventual consistency via compensation) |
| Outbox pattern | Transaction guarantee for DB save and event publishing |
| Idempotency | Prevents duplicate processing with at-least-once delivery |
| Projector | Builds and updates Read Model from events |
| Snapshot | Performance optimization for Event Sourcing |
| DLQ | Isolation and reprocessing of failed events |
| Trade-offs | Eventual consistency, debugging difficulty, operational complexity |

---

## Recommended Next Guides

- [Message Queue](../01-components/02-message-queue.md) — Implementation foundation for the event bus (Kafka / RabbitMQ details)
- [DDD](./02-ddd.md) — Domain modeling from which domain events are designed
- [Clean Architecture](./01-clean-architecture.md) — Placement of event handlers and layer design
- [URL Shortener](../03-case-studies/00-url-shortener.md) — Example of simple system design without event-driven
- [Chat System](../03-case-studies/01-chat-system.md) — Combining WebSocket with event-driven
- [Notification System](../03-case-studies/02-notification-system.md) — A typical application example of Pub/Sub

---

## References

1. **Building Event-Driven Microservices** — Adam Bellemare (O'Reilly, 2020) — Comprehensive guide to event-driven microservices
2. **Designing Data-Intensive Applications** — Martin Kleppmann (O'Reilly, 2017) — Theoretical foundation for stream processing and Event Sourcing
3. **Implementing Domain-Driven Design** — Vaughn Vernon (Addison-Wesley, 2013) — Implementation patterns for domain events and CQRS
4. **Enterprise Integration Patterns** — Gregor Hohpe & Bobby Woolf (Addison-Wesley, 2003) — Classic on messaging patterns
5. **Reactive Messaging Patterns with the Actor Model** — Vaughn Vernon (Addison-Wesley, 2015) — Integration of reactive systems and messaging
6. **Kafka: The Definitive Guide** — Neha Narkhede et al. (O'Reilly, 2021) — Comprehensive reference for Apache Kafka
7. **Martin Fowler — Event Sourcing** — https://martinfowler.com/eaaDev/EventSourcing.html — Explanation of the Event Sourcing pattern
8. **Greg Young — CQRS Documents** — https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf — Original document on CQRS
