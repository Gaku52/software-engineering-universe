# Message Queue

> A foundational technology for asynchronous messaging in distributed systems; explains core patterns for achieving loose coupling, scalability, and fault tolerance between components through a comparative look at Kafka, RabbitMQ, and SQS implementations

## What You Will Learn in This Chapter

1. **Fundamental Concepts of Message Queues** -- Producer/Consumer model, the difference between queues and topics, delivery guarantees (At-most-once / At-least-once / Exactly-once)
2. **Comparing and Selecting Major Products** -- Architecture, performance characteristics, and appropriate use cases for Apache Kafka, RabbitMQ, and Amazon SQS
3. **Practical Design Patterns** -- Dead Letter Queue, backpressure, idempotent processing, and techniques for guaranteeing message ordering
4. **Operations and Monitoring** -- Consumer Lag monitoring, queue depth alerts, performance tuning
5. **Failure Response Patterns** -- Message reprocessing, poison message handling, graceful shutdown

---

## Prerequisites

| Topic | Content | Reference Guide |
|---------|------|-----------|
| Distributed Systems Basics | CAP theorem, eventual consistency | [CAP Theorem](../00-fundamentals/03-cap-theorem.md) |
| Reliability Patterns | Retry, circuit breaker | [Reliability](../00-fundamentals/02-reliability.md) |
| Scalability | Concept of horizontal scaling | [Scalability](../00-fundamentals/01-scalability.md) |
| Database Basics | Transactions, ACID properties | DB Basics |
| Network Basics | TCP/IP, HTTP, asynchronous communication | Network Basics |

---

## Why Learn Message Queues

Message queues are the **glue of microservice architectures** and are an indispensable infrastructure component in modern distributed systems.

**The essential difference between synchronous and asynchronous:**
```
Synchronous call (direct HTTP communication):
  OrderService --HTTP POST--> PaymentService --wait--> response
  Problem: PaymentService goes down → OrderService also errors (cascade failure)
  Problem: PaymentService is slow → OrderService is also slow (latency coupling)

Asynchronous messaging:
  OrderService --publish--> [Message Queue] ... PaymentService --consume-->
  Benefit: OrderService operates normally even if PaymentService goes down
  Benefit: Queue acts as buffer to level out load
```

**Business Impact:**
- **Fault Tolerance**: Downstream service failures do not cascade to the entire system
- **Scalability**: Processing capacity scales linearly by simply adding Consumers
- **Load Leveling**: Queue absorbs traffic spikes and processes at a steady rate
- **Loose Coupling**: Minimizes dependencies between services, enabling independent development and deployment

**Real-world examples:**
- LinkedIn: Processes millions of events per second with Kafka (activity streams)
- Uber: Streams real-time location and demand forecast data with Kafka
- Slack: Ensures message delivery reliability with RabbitMQ

---

## 1. Basic Message Queue Architecture

### 1.1 Overall Architecture Diagram

```
+------------+     +------------------+     +-------------+
|  Producer  |---->|  Message Broker  |---->|  Consumer   |
|  (sender)  |     |  (queue/topic)   |     |  (receiver) |
+------------+     +------------------+     +-------------+
      |                    |                       |
      |   Publish          |   Store & Forward     |   Subscribe/Poll
      +--------------------+-----------------------+

  Synchronous call:  A --req--> B --res--> A  (A waits for B's response)
  Async queue:       A --msg--> [Queue] ... B --poll--> [Queue]
                     (A does not wait for B to finish processing)
```

### 1.2 Point-to-Point vs Pub/Sub

```
[Point-to-Point (Queue)]

  Producer A --+
               +--> [ Queue ] --> Consumer X
  Producer B --+     (1 message = consumed by 1 consumer only)

[Pub/Sub (Topic)]

  Producer ---> [ Topic ] --+--> Consumer Group A (Consumer A1, A2)
                            |
                            +--> Consumer Group B (Consumer B1, B2)
              (1 message = delivered to all subscribed groups)
```

### 1.3 Message Lifecycle

```
  Producer                Broker                Consumer
     |                      |                      |
     |--- 1. Publish ------>|                      |
     |<-- 1a. Ack(receipt) -|                      |
     |                      |-- 2. Persist         |
     |                      |                      |
     |                      |<-- 3. Poll/Push -----|
     |                      |--- 4. Deliver ------>|
     |                      |                      |-- 5. Process
     |                      |<-- 6. Ack(done) -----|
     |                      |-- 7. Mark Done ----->|
     |                      |                      |
```

### ASCII Diagram: Message Queue Use Case Map

```
┌─────────────────────────────────────────────────┐
│          Message Queue Use Cases                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ■ Task Queue (Work Queue)                      │
│    Image resizing, PDF generation, email send   │
│    → Delegate heavy processing to background    │
│                                                 │
│  ■ Event-Driven                                 │
│    Order created→inventory update→notify→log    │
│    → Loosely coupled integration between        │
│      services                                   │
│                                                 │
│  ■ Streaming (Stream Processing)                │
│    Log aggregation, clickstream, IoT data       │
│    → Real-time processing of large data volumes │
│                                                 │
│  ■ CQRS / Event Sourcing                        │
│    Separation of reads and writes               │
│    → Scalable data architecture                 │
│                                                 │
│  ■ Load Leveling                                │
│    Absorbing sale traffic spikes                │
│    → Leveling to match Consumer capacity        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 2. Delivery Guarantee Models

| Guarantee Level | Description | Message Loss | Duplicate Delivery | Typical Use Cases |
|-----------|------|:------------:|:-------:|-----------------|
| At-most-once | Delivered at most once. No retransmission | Possible | None | Log collection, metrics reporting |
| At-least-once | Delivered at least once. Resent on Ack failure | None | Possible | Order processing, email sending |
| Exactly-once | Delivered exactly once | None | None | Payment processing, inventory updates |

### Implementation Cost of Delivery Guarantees

```
  At-most-once         At-least-once        Exactly-once
  ┌──────────┐         ┌──────────┐         ┌──────────┐
  │ fire &   │         │ Ack +    │         │ transaction│
  │ forget   │         │ retry    │         │ + idempotent│
  └──────────┘         └──────────┘         └──────────┘
  Cost: Low            Cost: Medium         Cost: High
  Latency: Lowest      Latency: Low         Latency: High

  How to achieve Exactly-once:
  1. Kafka Transactions (acks=all + enable.idempotence + transactional.id)
  2. Outbox pattern (DB transaction + CDC)
  3. Idempotent Consumer-side processing (At-least-once + deduplication)
```

---

## 3. Apache Kafka

### 3.1 Architecture

```
Kafka Cluster
+-------------------------------------------------------------+
|  Broker 0              Broker 1              Broker 2        |
|  +--------------+      +--------------+      +-----------+   |
|  | orders-topic |      | orders-topic |      |orders-topic|  |
|  | Partition 0  |      | Partition 1  |      | Partition 2|  |
|  | [Leader]     |      | [Leader]     |      | [Leader]   |  |
|  +--------------+      +--------------+      +-----------+   |
|  | orders-topic |      | orders-topic |      |orders-topic|  |
|  | Partition 1  |      | Partition 2  |      | Partition 0|  |
|  | [Follower]   |      | [Follower]   |      | [Follower] |  |
|  +--------------+      +--------------+      +-----------+   |
+-------------------------------------------------------------+
        ^                                           |
        |              Consumer Group               v
   Producers       +----------------------------+
                   | Consumer 0 <-- Partition 0 |
                   | Consumer 1 <-- Partition 1 |
                   | Consumer 2 <-- Partition 2 |
                   +----------------------------+
```

### 3.2 Producer Implementation

```python
# Kafka Producer (Python - confluent-kafka)
from confluent_kafka import Producer
import json
import time

conf = {
    'bootstrap.servers': 'broker1:9092,broker2:9092,broker3:9092',
    'acks': 'all',                    # Confirm writes to all ISR replicas
    'retries': 5,
    'retry.backoff.ms': 100,
    'enable.idempotence': True,       # Idempotent producer (prevents duplicates)
    'compression.type': 'snappy',     # Compression improves throughput
    'linger.ms': 5,                   # Wait time for batching
    'batch.size': 32768,              # Batch size (32KB)
    'max.in.flight.requests.per.connection': 5,  # Max 5 when idempotence is enabled
}

producer = Producer(conf)

def delivery_report(err, msg):
    if err:
        print(f"Delivery failed: {err}")
    else:
        print(f"Delivery succeeded: topic={msg.topic()} "
              f"partition={msg.partition()} offset={msg.offset()}")

# Send messages
for i in range(1000):
    order = {"order_id": i, "user_id": i % 100, "amount": 1000 + i,
             "timestamp": time.time()}
    producer.produce(
        topic='order-events',
        key=str(order['user_id']).encode('utf-8'),   # Same user goes to same partition
        value=json.dumps(order).encode('utf-8'),
        callback=delivery_report,
    )
    producer.poll(0)  # Process callbacks

producer.flush()  # Wait for all messages to be sent
```

### 3.3 Consumer Implementation

```python
# Kafka Consumer (Python - confluent-kafka)
from confluent_kafka import Consumer, KafkaError
import json

conf = {
    'bootstrap.servers': 'broker1:9092',
    'group.id': 'order-processing-group',
    'auto.offset.reset': 'earliest',       # Start from oldest on first read
    'enable.auto.commit': False,           # Manual commit for reliable processing
    'max.poll.interval.ms': 300000,        # Processing timeout: 5 minutes
    'session.timeout.ms': 45000,
    'fetch.min.bytes': 1024,               # Fetch at least 1KB (improves batch efficiency)
    'fetch.max.wait.ms': 500,              # Wait up to 500ms
}

consumer = Consumer(conf)
consumer.subscribe(['order-events'])

try:
    while True:
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            raise Exception(f"Consumer error: {msg.error()}")

        order = json.loads(msg.value().decode('utf-8'))
        print(f"Received: partition={msg.partition()} "
              f"offset={msg.offset()} order_id={order['order_id']}")

        # Execute business logic
        process_order(order)

        # Manual commit after processing completes
        consumer.commit(asynchronous=False)
finally:
    consumer.close()
```

### 3.4 Stream Processing with Kafka Streams

```python
# Conceptual implementation of real-time aggregation using Kafka
import json
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Optional

@dataclass
class WindowedCounter:
    """Real-time aggregation using tumbling windows"""
    window_size_sec: int = 60
    windows: dict = field(default_factory=lambda: defaultdict(lambda: defaultdict(int)))

    def add(self, key: str, value: int = 1):
        window_start = int(time.time() / self.window_size_sec) * self.window_size_sec
        self.windows[window_start][key] += value

    def get_current_window(self) -> dict:
        window_start = int(time.time() / self.window_size_sec) * self.window_size_sec
        return dict(self.windows[window_start])

    def get_window(self, window_start: int) -> dict:
        return dict(self.windows.get(window_start, {}))

    def cleanup_old_windows(self, retain_count: int = 10):
        """Delete old windows to save memory"""
        sorted_windows = sorted(self.windows.keys())
        for w in sorted_windows[:-retain_count]:
            del self.windows[w]


class StreamProcessor:
    """Stream processing framework based on Kafka Consumer

    Features:
    1. Real-time event aggregation (window functions)
    2. Event filtering / transformation
    3. Writing to output topics
    """

    def __init__(self, consumer, producer,
                 input_topic: str, output_topic: str):
        self.consumer = consumer
        self.producer = producer
        self.input_topic = input_topic
        self.output_topic = output_topic
        self.counter = WindowedCounter(window_size_sec=60)
        self.filters: list[Callable] = []
        self.transformers: list[Callable] = []

    def add_filter(self, predicate: Callable):
        """Add an event filter"""
        self.filters.append(predicate)

    def add_transformer(self, transform: Callable):
        """Add an event transformer"""
        self.transformers.append(transform)

    def process(self):
        """Main processing loop"""
        self.consumer.subscribe([self.input_topic])

        while True:
            msg = self.consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                continue

            event = json.loads(msg.value().decode('utf-8'))

            # Filtering
            if not all(f(event) for f in self.filters):
                self.consumer.commit(asynchronous=False)
                continue

            # Transformation
            for transform in self.transformers:
                event = transform(event)

            # Aggregation
            self.counter.add(event.get("category", "unknown"))

            # Output
            self.producer.produce(
                topic=self.output_topic,
                key=event.get("key", "").encode('utf-8'),
                value=json.dumps(event).encode('utf-8'),
            )
            self.consumer.commit(asynchronous=False)


# Example usage: filter only high-value orders from order events and aggregate
processor = StreamProcessor(consumer, producer,
                           "order-events", "high-value-orders")
processor.add_filter(lambda e: e.get("amount", 0) > 10000)
processor.add_transformer(lambda e: {**e, "flagged": True})
# processor.process()
```

---

## 4. RabbitMQ

### 4.1 Exchange/Queue Model

```
                   Exchange (routing)
                  +------------------+
  Publisher -->   | Type: topic      |
                  |                  |
                  | order.created -->+--> [order_processing_queue] --> Consumer A
                  |                  |
                  | order.* -------->+--> [order_audit_queue]      --> Consumer B
                  |                  |
                  | payment.* ------>+--> [payment_queue]          --> Consumer C
                  +------------------+

  Exchange Types:
  ┌──────────┬─────────────────────────────────────────┐
  │ direct   │ Deliver to queues with exact routing_key match   │
  │ topic    │ Wildcard pattern matching (*.*, #)               │
  │ fanout   │ Deliver to all bound queues (broadcast)          │
  │ headers  │ Routing based on message headers                 │
  └──────────┴─────────────────────────────────────────┘
```

### 4.2 Producer / Consumer

```python
# RabbitMQ Producer (Python - pika)
import pika
import json
import uuid

connection = pika.BlockingConnection(
    pika.ConnectionParameters(
        host='localhost',
        credentials=pika.PlainCredentials('app_user', 'secret'),
        heartbeat=600,
        blocked_connection_timeout=300,
    )
)
channel = connection.channel()

# Declare Exchange and Queue
channel.exchange_declare(exchange='order_exchange',
                        exchange_type='topic', durable=True)
channel.queue_declare(queue='order_processing', durable=True, arguments={
    'x-dead-letter-exchange': 'dlx_exchange',        # DLQ configuration
    'x-dead-letter-routing-key': 'order.failed',
    'x-message-ttl': 86400000,                        # TTL: 24 hours
    'x-max-length': 100000,                           # Maximum queue length
    'x-overflow': 'reject-publish',                   # Reject on overflow
})
channel.queue_bind(exchange='order_exchange', queue='order_processing',
                   routing_key='order.created')

# Send message
message = json.dumps({"order_id": 123, "amount": 5000, "currency": "JPY"})
channel.basic_publish(
    exchange='order_exchange',
    routing_key='order.created',
    body=message,
    properties=pika.BasicProperties(
        delivery_mode=2,                  # Persist message
        content_type='application/json',
        message_id=str(uuid.uuid4()),
        timestamp=int(time.time()),
        headers={'retry_count': 0},
    ),
)
print(f"Sent: {message}")
connection.close()
```

```python
# RabbitMQ Consumer (Python - pika) with retry logic
import pika
import json
import traceback

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()
channel.queue_declare(queue='order_processing', durable=True)
channel.basic_qos(prefetch_count=10)    # Control number of concurrent processes

MAX_RETRIES = 3

def callback(ch, method, properties, body):
    order = json.loads(body)
    retry_count = (properties.headers or {}).get('retry_count', 0)
    print(f"Processing started: order_id={order['order_id']} (retry={retry_count})")

    try:
        process_order(order)
        ch.basic_ack(delivery_tag=method.delivery_tag)        # Success → Ack
        print(f"Processing complete: order_id={order['order_id']}")
    except Exception as e:
        print(f"Processing failed: {e}")
        traceback.print_exc()

        if retry_count < MAX_RETRIES:
            # Retry: re-enqueue to same queue (increment retry_count)
            ch.basic_publish(
                exchange='',
                routing_key='order_processing',
                body=body,
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    headers={'retry_count': retry_count + 1},
                ),
            )
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f"Retry scheduled: order_id={order['order_id']} "
                  f"retry={retry_count + 1}")
        else:
            # Max retries exceeded → send to DLQ
            ch.basic_nack(delivery_tag=method.delivery_tag,
                          requeue=False)
            print(f"Sent to DLQ: order_id={order['order_id']} (max retries exceeded)")

channel.basic_consume(queue='order_processing', on_message_callback=callback)
print("Consumer started. Waiting for messages...")
channel.start_consuming()
```

---

## 5. Amazon SQS

```python
# Amazon SQS (Python - boto3)
import boto3
import json
import uuid
import time

sqs = boto3.client('sqs', region_name='ap-northeast-1')
QUEUE_URL = 'https://sqs.ap-northeast-1.amazonaws.com/123456789/order-queue.fifo'

# --- Producer ---
response = sqs.send_message(
    QueueUrl=QUEUE_URL,
    MessageBody=json.dumps({"order_id": 456, "amount": 8000}),
    MessageAttributes={
        'EventType': {'DataType': 'String', 'StringValue': 'OrderCreated'},
        'Priority': {'DataType': 'Number', 'StringValue': '1'},
    },
    MessageDeduplicationId=str(uuid.uuid4()),  # FIFO: 5-minute deduplication window
    MessageGroupId='user-group-42',            # FIFO: ordering guaranteed within group
)
print(f"Sent MessageId: {response['MessageId']}")

# --- Consumer (long polling) ---
while True:
    response = sqs.receive_message(
        QueueUrl=QUEUE_URL,
        MaxNumberOfMessages=10,         # Retrieve up to 10 messages at once
        WaitTimeSeconds=20,             # Long polling (wait up to 20 seconds)
        VisibilityTimeout=120,          # Invisibility period during processing
        MessageAttributeNames=['All'],
    )
    for message in response.get('Messages', []):
        body = json.loads(message['Body'])
        print(f"Processing: order_id={body['order_id']}")

        try:
            process_order(body)
            sqs.delete_message(
                QueueUrl=QUEUE_URL,
                ReceiptHandle=message['ReceiptHandle'],
            )
            print(f"Processing complete, deleted: order_id={body['order_id']}")
        except Exception as e:
            # Automatically returned to queue after VisibilityTimeout
            print(f"Processing failed: {e} → Will be redelivered after VisibilityTimeout")

    if not response.get('Messages'):
        time.sleep(1)  # No messages → short wait
```

---

## 6. Major Product Comparison

### Comparison Table 1: Feature Comparison

| Characteristic | Apache Kafka | RabbitMQ | Amazon SQS |
|-----|-------------|----------|------------|
| **Model** | Distributed commit log (Pull) | Message broker (Push/Pull) | Managed queue (Pull) |
| **Throughput** | Millions of msg/sec | Tens of thousands of msg/sec | Thousands of msg/sec (standard) |
| **Message Retention** | Retained for configured period (re-readable) | Deleted after consumption | Retained up to 14 days |
| **Ordering Guarantee** | Guaranteed within partition | Guaranteed within queue | Guaranteed with FIFO queue |
| **Delivery Guarantee** | At-least-once / Exactly-once | At-least-once | At-least-once / Exactly-once with FIFO |
| **Delayed Messages** | Not supported (requires external implementation) | Supported (TTL + DLX) | Supported (up to 15 minutes) |
| **Operational Cost** | High (KRaft/ZooKeeper management) | Medium (Erlang VM management) | Low (fully managed) |
| **Best For** | Streaming, log aggregation, CQRS | Task queues, RPC, complex routing | Serverless integration, simple queues |

### Comparison Table 2: Selection Flowchart

| Decision Criteria | Choose Kafka | Choose RabbitMQ | Choose SQS |
|---------|------------|----------------|-----------|
| Need to re-read messages | YES | -- | -- |
| Over 1 million messages/sec | YES | -- | -- |
| Complex routing rules | -- | YES | -- |
| Request/response RPC pattern | -- | YES | -- |
| AWS-native with minimal operations | -- | -- | YES |
| Lambda integration | -- | -- | YES |
| Event sourcing | YES | -- | -- |
| Priority queues | -- | YES | -- |
| Stream processing (aggregation, joins) | YES | -- | -- |
| Get started immediately (low learning curve) | -- | -- | YES |

### Comparison Table 3: Non-Functional Requirements

| Item | Kafka | RabbitMQ | SQS |
|------|-------|----------|-----|
| Latency (P99) | 5-15ms | 1-5ms | 20-50ms |
| Max Message Size | 1MB (default) | 128MB | 256KB (extendable via S3) |
| Max Consumer Parallelism | Number of partitions | Unlimited | Unlimited |
| Minimum Cluster Size | 3 nodes | 3 nodes (Quorum) | N/A (managed) |
| Encryption | TLS + SASL | TLS + AMQP auth | KMS + IAM |
| Monitoring | JMX, Prometheus | Prometheus, Management UI | CloudWatch |

---

## 7. Design Patterns

### 7.1 Dead Letter Queue (DLQ)

```
                          Processing success
  [Main Queue] --------> Consumer ------> Done (Ack)
       |                     |
       |               Processing failed (after N retries)
       |                     |
       v                     v
  [Retry Queue]         [Dead Letter Queue]
  (delayed redelivery)        |
       |                     +--> Monitoring alert notification
       +---> [Main Queue]   +--> View in admin dashboard
                             +--> Manual reprocessing or correction
```

### 7.2 Idempotent Processing Pattern

```python
# Example implementation of an idempotent Consumer
import redis
import hashlib
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

class IdempotentConsumer:
    """Ensures the result does not change no matter how many times the same message is received

    Implementation approaches:
    1. Message ID-based: duplicate check by message_id
    2. Business key-based: duplicate check by entity_id + version
    3. Hash-based: duplicate check by hash of message content
    """

    def __init__(self, redis_client: redis.Redis,
                 dedup_ttl: int = 86400 * 7):
        self.redis = redis_client
        self.dedup_ttl = dedup_ttl  # Retention period for duplicate checks

    def process(self, message: dict) -> bool:
        """Process a message idempotently

        Returns:
            True: Processing succeeded (new message)
            False: Skipped (already-processed message)
        """
        message_id = message.get('message_id')
        if not message_id:
            # Use content hash if message_id is absent
            content = json.dumps(message, sort_keys=True)
            message_id = hashlib.sha256(content.encode()).hexdigest()

        idempotency_key = f"processed:{message_id}"

        # Exclusive control via SETNX (Set if Not eXists)
        if not self.redis.set(idempotency_key, 'processing',
                              nx=True, ex=self.dedup_ttl):
            print(f"[SKIP] Already processed or in progress: {message_id}")
            return False

        try:
            # Execute business logic
            result = self._execute_business_logic(message)

            # Mark as complete
            self.redis.set(idempotency_key, json.dumps({
                'status': 'completed',
                'result': result,
                'processed_at': time.time(),
            }), ex=self.dedup_ttl)
            return True

        except Exception as e:
            # Delete key on failure to allow retry
            self.redis.delete(idempotency_key)
            raise

    def _execute_business_logic(self, message: dict):
        """Business logic (override in subclass)"""
        raise NotImplementedError


class OrderConsumer(IdempotentConsumer):
    """Concrete Consumer for order processing"""

    def _execute_business_logic(self, message: dict):
        order_id = message['order_id']
        amount = message['amount']
        print(f"[PROCESS] Processing order: order_id={order_id}, amount={amount}")
        # DB update, external API call, etc.
        return {"order_id": order_id, "status": "confirmed"}


# Usage example
consumer = OrderConsumer(redis_client)
messages = [
    {"message_id": "msg-001", "order_id": 123, "amount": 5000},
    {"message_id": "msg-001", "order_id": 123, "amount": 5000},  # Duplicate
    {"message_id": "msg-002", "order_id": 456, "amount": 8000},
]

for msg in messages:
    result = consumer.process(msg)
    print(f"  → processed={result}")
# [PROCESS] Processing order: order_id=123, amount=5000
#   → processed=True
# [SKIP] Already processed or in progress: msg-001
#   → processed=False
# [PROCESS] Processing order: order_id=456, amount=8000
#   → processed=True
```

### 7.3 Outbox Pattern

```python
# Outbox pattern: guarantees atomicity of DB updates and message publishing

class OutboxPattern:
    """Implementation of the Outbox pattern

    Problem: Cannot atomically perform two operations—DB update and message publish
    → DB update succeeds + message publish fails = inconsistency

    Solution: Also write to the outbox table within the DB transaction;
    a separate process reads the outbox and publishes to the message broker

    DB Transaction:
      1. INSERT into the orders table
      2. INSERT into the outbox table (same transaction)

    Outbox Relay (separate process):
      1. Poll the outbox table
      2. Publish unsent messages to the broker
      3. Mark them as sent
    """

    def __init__(self, db_session, producer):
        self.db = db_session
        self.producer = producer

    def create_order(self, order_data: dict):
        """Create order + publish event (atomically)"""
        with self.db.begin():
            # 1. Save the order
            order = Order(**order_data)
            self.db.add(order)
            self.db.flush()  # Get the ID

            # 2. Write to Outbox (same transaction)
            outbox_event = OutboxEvent(
                aggregate_type='Order',
                aggregate_id=str(order.id),
                event_type='OrderCreated',
                payload=json.dumps({
                    'order_id': order.id,
                    'user_id': order_data['user_id'],
                    'amount': order_data['amount'],
                    'created_at': time.time(),
                }),
                status='PENDING',
            )
            self.db.add(outbox_event)
            # Transaction completes → both are committed atomically

    def relay_outbox_events(self, batch_size: int = 100):
        """Publish unsent events from the Outbox table to the broker"""
        pending_events = self.db.query(OutboxEvent)\
            .filter_by(status='PENDING')\
            .order_by(OutboxEvent.created_at)\
            .limit(batch_size)\
            .all()

        for event in pending_events:
            try:
                self.producer.produce(
                    topic=f"{event.aggregate_type.lower()}-events",
                    key=event.aggregate_id.encode('utf-8'),
                    value=event.payload.encode('utf-8'),
                )
                event.status = 'SENT'
                event.sent_at = time.time()
            except Exception as e:
                print(f"[OUTBOX ERROR] {event.id}: {e}")

        self.db.commit()
        self.producer.flush()
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Using the Queue as a Massive Data Store

```python
# BAD: Storing large payloads directly in the queue

class BadProducer:
    def send_invoice(self, order_id: int, pdf_data: bytes, images: list[bytes]):
        message = {
            "order_id": order_id,
            "pdf_invoice": base64.b64encode(pdf_data).decode(),  # 10MB
            "images": [base64.b64encode(img).decode() for img in images],  # Several MB
        }
        # Problem: Puts pressure on broker memory/disk
        # Problem: Wastes network bandwidth
        # Problem: Consumer deserialization is slow
        self.producer.send("invoices", json.dumps(message).encode())


# GOOD: Claim-Check pattern (store only a reference in the queue)

import boto3

class GoodProducer:
    def __init__(self, producer, s3_client):
        self.producer = producer
        self.s3 = s3_client

    def send_invoice(self, order_id: int, pdf_data: bytes, images: list[bytes]):
        # Step 1: Store large data in S3
        pdf_key = f"invoices/{order_id}/invoice.pdf"
        self.s3.put_object(Bucket='my-bucket', Key=pdf_key, Body=pdf_data)

        image_keys = []
        for i, img in enumerate(images):
            key = f"invoices/{order_id}/image_{i}.jpg"
            self.s3.put_object(Bucket='my-bucket', Key=key, Body=img)
            image_keys.append(key)

        # Step 2: Store only a lightweight reference in the queue
        message = {
            "order_id": order_id,
            "invoice_s3_key": pdf_key,
            "image_s3_keys": image_keys,
        }
        self.producer.send("invoices", json.dumps(message).encode())
        # Message size: a few hundred bytes (vs tens of MB)
```

### Anti-Pattern 2: Design That Ignores Delivery Guarantees

```python
# BAD: fire-and-forget with Auto-Ack

def bad_consumer():
    channel.basic_consume(
        queue='payment_queue',
        auto_ack=True,  # Problem: Ack sent the moment message is received
        on_message_callback=process_payment
    )
    # Consumer crashes → message lost → payment data missing


# GOOD: Manual Ack + DLQ + idempotent processing

def good_consumer():
    channel.basic_qos(prefetch_count=5)  # Limit concurrent processing count
    channel.basic_consume(
        queue='payment_queue',
        auto_ack=False,  # Manual Ack
        on_message_callback=safe_process_payment
    )

def safe_process_payment(ch, method, properties, body):
    try:
        # Idempotent processing (safely skip duplicates)
        payment = json.loads(body)
        if is_already_processed(payment['payment_id']):
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        execute_payment(payment)
        mark_as_processed(payment['payment_id'])
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception:
        # Failure → send to DLQ (requeue=False prevents infinite loop)
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
```

### Anti-Pattern 3: Scaling Without Considering Consumer Processing Speed

```python
# BAD: Processing a large volume of messages with a single Consumer

class UnscalableConsumer:
    """Producer 1000 msg/sec vs Consumer 100 msg/sec
    → Queue grows infinitely, delay increases without bound"""
    pass


# GOOD: Auto-scaling + backpressure

class ScalableConsumerManager:
    """Auto-scaling based on queue depth"""

    def __init__(self, queue_name: str,
                 target_lag: int = 1000,
                 max_consumers: int = 20,
                 min_consumers: int = 2):
        self.queue_name = queue_name
        self.target_lag = target_lag
        self.max_consumers = max_consumers
        self.min_consumers = min_consumers
        self.current_consumers = min_consumers

    def check_and_scale(self, current_lag: int):
        """Adjust the number of Consumers based on queue depth"""
        if current_lag > self.target_lag * 2:
            # Scale out
            desired = min(
                self.current_consumers * 2,
                self.max_consumers
            )
            self._scale_to(desired)
            print(f"[SCALE OUT] {self.current_consumers} → {desired} "
                  f"(lag={current_lag})")
        elif current_lag < self.target_lag * 0.2:
            # Scale in
            desired = max(
                self.current_consumers // 2,
                self.min_consumers
            )
            self._scale_to(desired)
            print(f"[SCALE IN] {self.current_consumers} → {desired} "
                  f"(lag={current_lag})")

    def _scale_to(self, count: int):
        self.current_consumers = count
        # In practice, implemented via Kubernetes HPA, ECS Service, etc.
```

---

## 9. Practice Exercises

### Exercise 1 (Basic): Deduplication Test for an Idempotent Consumer

**Task**: Using `IdempotentConsumer`, process 10 messages (3 of which are duplicates) and measure the number of messages actually processed versus those skipped as duplicates.

```python
# Hint: Use the IdempotentConsumer class
consumer = OrderConsumer(redis.Redis())
messages = [
    {"message_id": f"msg-{i}", "order_id": i, "amount": 1000 * i}
    for i in range(7)
]
# Add duplicates
messages.extend([
    {"message_id": "msg-0", "order_id": 0, "amount": 0},
    {"message_id": "msg-3", "order_id": 3, "amount": 3000},
    {"message_id": "msg-5", "order_id": 5, "amount": 5000},
])

processed = sum(1 for msg in messages if consumer.process(msg))
skipped = len(messages) - processed
print(f"Processed: {processed}, Skipped: {skipped}")
```

**Expected output**:
```
Processed: 7, Skipped: 3
```

### Exercise 2 (Intermediate): Implementing a Retry Flow with DLQ

**Task**: In an environment where message processing fails 30% of the time, implement a Consumer that sends messages to the DLQ after a maximum of 3 retries, and aggregate the results (success/DLQ) for 100 messages.

```python
import random

class RetryableConsumer:
    def __init__(self, max_retries: int = 3, failure_rate: float = 0.3):
        self.max_retries = max_retries
        self.failure_rate = failure_rate
        self.success_count = 0
        self.dlq_count = 0

    def process_with_retry(self, message: dict) -> str:
        for attempt in range(self.max_retries + 1):
            if random.random() > self.failure_rate:
                self.success_count += 1
                return "success"
        self.dlq_count += 1
        return "dlq"

consumer = RetryableConsumer(max_retries=3, failure_rate=0.3)
random.seed(42)
for i in range(100):
    consumer.process_with_retry({"id": i})
print(f"Success: {consumer.success_count}, DLQ: {consumer.dlq_count}")
```

**Expected output (approximate)**:
```
Success: ~99, DLQ: ~1
(4 attempts at 30% failure rate: failure probability = 0.3^4 = 0.81% → ~1 in 100 goes to DLQ)
```

### Exercise 3 (Advanced): Full Implementation of the Outbox Pattern

**Task**: Using SQLAlchemy + Kafka, implement the Outbox pattern that guarantees atomicity between order creation and event publishing. The implementation must satisfy the following requirements:

1. Update the order table and Outbox table in the same transaction
2. An Outbox Relay process polls for unsent events and publishes them to Kafka
3. Periodic cleanup of sent events


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Verify config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Data volume increase | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check executing user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Verify incrementally**: Use log output or a debugger to validate hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debug utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs the input and output of a function"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Called: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception raised: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps to diagnose performance issues when they arise:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O wait**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Type of Issue | Diagnostic Tool | Countermeasure |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Improve algorithms, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexes, query optimization |
---

## 10. FAQ

### Q1. Which should I choose: Kafka or RabbitMQ?

Decide based on use case. If you need streaming of large data volumes (log aggregation, event sourcing, real-time analytics pipelines), choose **Kafka**. If you need task queues, RPC patterns, or complex routing (priority queues, topic-based filtering), choose **RabbitMQ**. When in doubt, ask "do I need to re-read messages?" If yes, Kafka is the only choice.

### Q2. What happens to messages if a Consumer goes down?

The broker retains messages and redelivers them after the Consumer recovers. **Kafka** uses an offset-based model where Consumers read at their own pace, so messages during downtime are not lost as long as they are within the retention period. **RabbitMQ** returns messages to the queue after an Ack timeout. **SQS** makes messages available again after the Visibility Timeout expires. In all cases, idempotent processing on the Consumer side is essential as a countermeasure against duplicate delivery.

### Q3. To what granularity can message ordering be guaranteed?

A complete global ordering guarantee involves a trade-off with scalability. **Kafka** guarantees ordering within a partition when the same partition key is used (no guarantee across partitions). **SQS FIFO** guarantees ordering within a MessageGroupId (parallel processing across groups). **RabbitMQ** guarantees FIFO with a single queue and single Consumer. The standard approach is to clarify "at what entity granularity is ordering needed?" during design and use that key (user ID, order ID, etc.) as the partition key.

### Q4. What is a Kafka Consumer Group?

A set of Consumers with the same group.id. Each partition of a topic is assigned to exactly one Consumer within a group. This allows horizontal scaling simply by adding Consumers, and the number of partitions equals the maximum parallelism. Different Consumer Groups can consume the same messages independently, which enables the Pub/Sub model. When a Consumer joins or leaves a group, a **rebalance** occurs and partitions are reassigned.

### Q5. How should Consumer Lag be monitored and addressed?

Consumer Lag (= latest offset - Consumer's current offset) is a key metric indicating message processing delay. **Monitoring**: Use Kafka's `kafka-consumer-groups.sh --describe` command, or continuously monitor with Burrow/Prometheus Exporter. **Alert thresholds**: Warning at Lag > 10,000; emergency at Lag > 100,000. **Actions**: (1) Increase number of Consumers (up to partition count), (2) Optimize Consumer batch size, (3) Speed up processing logic (e.g., DB batch writes), (4) Increase partition count (can only be increased, not decreased).

### Q6. Is Exactly-once truly achievable?

Theoretically, complete Exactly-once is impossible in distributed systems, but **practical Exactly-once** can be achieved through the following methods. (1) **Kafka Transactions**: Process Producer and Consumer within the same transaction (used in Kafka Streams). (2) **Outbox pattern**: Atomically publish events via DB transaction + CDC. (3) **Idempotent Consumer-side processing**: At-least-once + deduplication (most common and recommended approach). Especially in microservices, approach (3) is the most practical, and managing message IDs with a DB unique constraint is a simple and reliable method.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and confirming how it behaves.

### Q2: What mistakes do beginners often make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| Role of Message Queues | Loose coupling between components, async processing, load leveling, fault tolerance |
| Delivery Guarantee | Choose At-most-once / At-least-once / Exactly-once based on requirements |
| Kafka | High throughput, suited for streaming. Partition-based distribution. Re-readable |
| RabbitMQ | Suited for flexible routing and task queues. Exchange/Binding model |
| SQS | Fully managed, serverless integration. Minimal operational cost |
| DLQ | Essential for isolating failed messages and handling them downstream |
| Idempotent Processing | At-least-once requires design that assumes duplicate delivery |
| Outbox Pattern | Standard approach to guarantee atomicity of DB updates and message publishing |
| Payload Design | Store large data in external storage; put only a reference in the queue |
| Consumer Lag | The most important monitoring metric. Handled automatically via auto-scaling |

---

## What to Read Next

- [CDN](./03-cdn.md) -- Latency optimization via Content Delivery Networks
- [DB Scaling](./04-database-scaling.md) -- Sharding and replication at the data layer
- [Event-Driven Architecture](../02-architecture/03-event-driven.md) -- Pub/Sub design leveraging message queues
- [Caching](./01-caching.md) -- Cache update strategies used in conjunction with message queues
- [Reliability](../00-fundamentals/02-reliability.md) -- Integration with retry and circuit breaker patterns

---

## References

1. **Designing Data-Intensive Applications** -- Martin Kleppmann (O'Reilly, 2017) -- The definitive book on theory and practice of distributed messaging
2. **Kafka: The Definitive Guide, 2nd Edition** -- Gwen Shapira et al. (O'Reilly, 2021) -- Comprehensive reference for Kafka
3. **RabbitMQ in Depth** -- Gavin M. Roy (Manning, 2017) -- RabbitMQ internal architecture and operational patterns
4. **Amazon SQS Developer Guide** -- AWS Documentation -- https://docs.aws.amazon.com/sqs/
5. **Enterprise Integration Patterns** -- Gregor Hohpe & Bobby Woolf (Addison-Wesley, 2003) -- Classic reference for messaging patterns
