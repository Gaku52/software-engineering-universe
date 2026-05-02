# Chat System Design

> Design a real-time chat system like LINE / Slack / WhatsApp from scratch. Systematically learn design patterns for WebSocket management, message delivery, offline handling, and group chat.

---

## What You Will Learn

1. **Real-Time Communication Foundation** — WebSocket connection management, presence management, and heartbeat design
2. **Message Delivery** — One-to-one chat, group chat, and message ordering guarantees
3. **Scalability and Reliability** — Message persistence, offline delivery, read receipt management, and push notification integration
4. **Security** — End-to-end encryption and message integrity guarantees
5. **Operational Design** — Monitoring, incident response, and capacity planning

---

## Prerequisites

| Topic | Required Level | Reference Guide |
|---------|-----------|-----------|
| WebSocket Protocol | HTTP upgrade, bidirectional communication basics | Network Fundamentals |
| Message Queue | Kafka / RabbitMQ concepts | [Message Queue](../01-components/02-message-queue.md) |
| NoSQL Database | Cassandra / DynamoDB basics | Database |
| Cache Design | Basic Redis operations | Cache |
| Event-Driven Design | Pub/Sub concepts | [Event-Driven Architecture](../02-architecture/03-event-driven.md) |

---

## Background

### Why Is Chat System Design Difficult?

```
Technical challenges of chat systems:

  1. Real-time responsiveness:
     → Users feel dissatisfied when message latency exceeds 100ms
     → Need to handle millions of concurrent connections with low latency

  2. Reliability:
     → Message loss is absolutely unacceptable
     → Out-of-order delivery severely degrades UX
     → Messages must be guaranteed even during network disconnections

  3. Scalability:
     → 50 million DAU, 5 million concurrent connections
     → Group chat fan-out (1 message → delivered to 500 people)
     → High throughput for both writes and reads

  4. Presence management:
     → Track "online/offline" status in real time
     → Efficiently manage presence information for 5 million concurrent connections

Why this is frequently asked in interviews:
  - WebSocket (real-time communication)
  - Message queue (asynchronous processing)
  - Database design (high write throughput)
  - Cache design (presence, read receipts)
  - Push notifications (external service integration)
  → A single problem covers many design elements
```

---

## 1. Requirements Definition

### 1.1 Functional Requirements

```
=== Must Have ===
- One-to-one chat (text messages)
- Group chat (up to 500 people)
- Online/offline presence display
- Message persistence and history display
- Push notifications (for offline users)

=== Should Have ===
- Message read receipt management (read/unread, read marks)
- Image and file sending/receiving
- Message search
- Typing indicator

=== Nice to Have ===
- Message editing and deletion
- Threads / replies
- Reactions (emoji)
- Voice/video calls (WebRTC)
- End-to-end encryption (E2EE)
```

### 1.2 Non-Functional Requirements

```
=== Performance ===
- Message delivery latency: P99 < 200ms
- Message persistence: P99 < 100ms
- Presence updates: P99 < 500ms

=== Availability ===
- Message delivery: 99.99%
- Message loss rate: 0% (at-least-once delivery guarantee)

=== Scalability ===
- Concurrent WebSocket connections: 5 million
- Message QPS: 50,000 (peak)
- Messages per day: 2 billion
```

### 1.3 Scale Estimation

```python
# === Chat System Scale Estimation ===

dau = 50_000_000                    # DAU: 50 million
messages_per_user_per_day = 40       # Average 40 messages per user per day
daily_messages = dau * messages_per_user_per_day  # 2 billion messages per day

# QPS
message_qps = daily_messages / 86400           # ≈ 23,148 QPS
message_qps_peak = message_qps * 2.5           # ≈ 57,870 QPS (peak)

# Concurrent connections
concurrent_connections = dau * 0.10             # 5 million concurrent connections (10% of DAU)

# Storage
avg_message_size_bytes = 200                    # Text + metadata
daily_storage_gb = (daily_messages * avg_message_size_bytes) / (1024**3)  # ≈ 373 GB/day
yearly_storage_tb = daily_storage_gb * 365 / 1024  # ≈ 133 TB/year

# Bandwidth
# 1 message sent → delivered to an average of 2.5 people (average of 1-to-1 + group)
fan_out_factor = 2.5
delivery_qps = message_qps_peak * fan_out_factor  # ≈ 144,675 deliveries/sec
bandwidth_mbps = (delivery_qps * avg_message_size_bytes * 8) / (1024**2)  # ≈ 22 Mbps

# WebSocket memory
# 1 connection ≈ 10KB (buffer + metadata)
ws_memory_gb = (concurrent_connections * 10 * 1024) / (1024**3)  # ≈ 47 GB
ws_servers = ws_memory_gb / 16  # 16GB per server → ≈ 3 servers (minimum)

print(f"""
=== Chat System Scale Estimation ===
Message QPS:          {message_qps:,.0f} (peak: {message_qps_peak:,.0f})
Concurrent WebSocket: {concurrent_connections:,.0f}
Storage:              {daily_storage_gb:.0f} GB/day, {yearly_storage_tb:.0f} TB/year
Delivery throughput:  {delivery_qps:,.0f} deliveries/sec
WebSocket memory:     {ws_memory_gb:.0f} GB → minimum {ws_servers:.0f} servers
""")
```

---

## 2. High-Level Architecture

### 2.1 Overall Structure

```
                    Chat System Overall Structure

  ┌──────────┐                                    ┌──────────┐
  │ Client A │                                    │ Client B │
  │ (Mobile/ │                                    │ (Mobile/ │
  │  Web)    │                                    │  Web)    │
  └────┬─────┘                                    └────┬─────┘
       │ WebSocket                                     │ WebSocket
       v                                               v
  ┌──────────┐                                    ┌──────────┐
  │ WS       │                                    │ WS       │
  │ Gateway  │                                    │ Gateway  │
  │ (GW-1)   │                                    │ (GW-2)   │
  └────┬─────┘                                    └────┬─────┘
       │                                               │
       └──────────────────┬────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │ Message   │
                    │ Service   │
                    └─────┬─────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            v             v             v
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │ Kafka    │  │ Cassandra│  │ Redis    │
     │ (Message │  │ (Message │  │ (Connection│
     │  Queue)  │  │  DB)     │  │  Map,    │
     └──────────┘  └──────────┘  │  Presence,│
                                 │  Read    │
                                 │  Receipts)│
                                 └──────────┘

  Auxiliary Services:
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Push     │  │ File     │  │ Search   │
  │ Notif.   │  │ Upload   │  │ (Elastic │
  │ (APNS/   │  │ (S3)     │  │  search) │
  │  FCM)    │  │          │  │          │
  └──────────┘  └──────────┘  └──────────┘
```

### 2.2 Connection Management Architecture

```
=== Roles of the WebSocket Gateway ===

  1. WebSocket connection termination
     Client ←── WebSocket ──→ Gateway ←── gRPC/HTTP ──→ Message Service

  2. Connection map management (Redis)
     Maintains user_id → gateway_id mapping
     → Tracks which user is connected to which Gateway

  3. Message routing
     Incoming message → Message Service → Destination Gateway → Recipient's WebSocket

  4. Heartbeat management
     ping/pong every 30 seconds to verify connection liveness
     → Timeout → Disconnect → Presence update

  ┌────────────────────────────────────────────────┐
  │  Redis Connection Map (Hash)                   │
  │                                                 │
  │  ws:connections                                  │
  │    user_A → gw-001                              │
  │    user_B → gw-001                              │
  │    user_C → gw-002                              │
  │    user_D → gw-002                              │
  │                                                 │
  │  Message delivery flow (User A → User C):       │
  │  1. GW-1 receives the message                   │
  │  2. Message Service persists the message        │
  │  3. Look up User C's Gateway in Redis → GW-2   │
  │  4. Forward message to GW-2 via Redis Pub/Sub  │
  │  5. GW-2 sends to User C's WebSocket           │
  └────────────────────────────────────────────────┘
```

---

## 3. Core Implementation

### 3.1 WebSocket Gateway

```python
# infrastructure/gateway/websocket_gateway.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
import json
import uuid
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

app = FastAPI()
redis_client = aioredis.Redis(host="redis-host", port=6379)

# ID of this gateway instance
GATEWAY_ID = f"gw-{uuid.uuid4().hex[:8]}"

# Local connection map (user_id -> WebSocket)
local_connections: dict[str, WebSocket] = {}

# Heartbeat settings
HEARTBEAT_INTERVAL = 30  # seconds
HEARTBEAT_TIMEOUT = 90   # seconds (3 missed = treated as disconnected)
PRESENCE_TTL = 300       # seconds (presence TTL)


@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str):
    """WebSocket endpoint

    Connection flow:
    1. Authentication (JWT token verification)
    2. Connection registration (Redis + local map)
    3. Presence update (online)
    4. Deliver offline messages
    5. Message send/receive loop
    6. Disconnect handling
    """
    # 1. Authentication
    if not await authenticate_ws(token, user_id):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    logger.info(f"WebSocket connected: user_id={user_id}, gw={GATEWAY_ID}")

    # 2. Connection registration
    local_connections[user_id] = websocket
    await redis_client.hset("ws:connections", user_id, GATEWAY_ID)

    # 3. Presence update
    await redis_client.set(f"presence:{user_id}", "online", ex=PRESENCE_TTL)
    await broadcast_presence_change(user_id, "online")

    # 4. Deliver offline messages
    await deliver_offline_messages(user_id, websocket)

    # 5. Start heartbeat task
    heartbeat_task = asyncio.create_task(
        heartbeat_loop(user_id, websocket)
    )

    try:
        # 6. Message send/receive loop
        while True:
            data = await websocket.receive_json()
            await handle_message(user_id, data)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: user_id={user_id}")
    except Exception as e:
        logger.error(f"WebSocket error: user_id={user_id}, error={e}")
    finally:
        # 7. Disconnect handling
        heartbeat_task.cancel()
        local_connections.pop(user_id, None)
        await redis_client.hdel("ws:connections", user_id)
        await redis_client.set(f"presence:{user_id}", "offline")
        await broadcast_presence_change(user_id, "offline")


async def heartbeat_loop(user_id: str, websocket: WebSocket):
    """Heartbeat loop: periodically send ping

    Verifies WebSocket connection state and extends presence TTL
    """
    try:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            try:
                await websocket.send_json({"type": "ping"})
                # Extend presence TTL
                await redis_client.set(
                    f"presence:{user_id}", "online", ex=PRESENCE_TTL
                )
            except Exception:
                logger.warning(f"Heartbeat failed: user_id={user_id}")
                break
    except asyncio.CancelledError:
        pass


async def handle_message(sender_id: str, data: dict):
    """Route received messages"""
    msg_type = data.get("type")

    if msg_type == "chat":
        await handle_chat_message(sender_id, data)
    elif msg_type == "group_chat":
        await handle_group_message(sender_id, data)
    elif msg_type == "typing":
        await handle_typing_indicator(sender_id, data)
    elif msg_type == "read_receipt":
        await handle_read_receipt(sender_id, data)
    elif msg_type == "pong":
        pass  # Heartbeat response
    else:
        logger.warning(f"Unknown message type: {msg_type}")


async def handle_chat_message(sender_id: str, data: dict):
    """Handle one-to-one chat messages"""
    recipient_id = data["to"]
    message = {
        "id": str(uuid.uuid4()),
        "from": sender_id,
        "to": recipient_id,
        "content": data["content"],
        "content_type": data.get("content_type", "text"),
        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
        "type": "chat",
    }

    # 1. Persist message (asynchronously via Kafka)
    await publish_to_kafka("messages", message)

    # 2. Return ACK to sender
    sender_ws = local_connections.get(sender_id)
    if sender_ws:
        await sender_ws.send_json({
            "type": "ack",
            "message_id": message["id"],
            "status": "sent",
        })

    # 3. Deliver to recipient
    await deliver_message(recipient_id, message)


async def deliver_message(recipient_id: str, message: dict):
    """Deliver a message to the recipient

    Delivery flow:
    1. Look up the recipient's Gateway in Redis
    2. Same Gateway → deliver directly
    3. Different Gateway → forward via Redis Pub/Sub
    4. Offline → push notification + offline queue
    """
    gateway_id = await redis_client.hget("ws:connections", recipient_id)

    if gateway_id is None:
        # Offline → push notification + offline queue
        logger.info(f"Offline delivery: recipient={recipient_id}")
        await enqueue_offline_message(recipient_id, message)
        await send_push_notification(recipient_id, message)
        return

    gateway_id = gateway_id.decode()

    if gateway_id == GATEWAY_ID:
        # Same Gateway → deliver directly
        ws = local_connections.get(recipient_id)
        if ws:
            try:
                await ws.send_json(message)
                logger.debug(f"Direct delivery: recipient={recipient_id}")
            except Exception as e:
                logger.error(f"Delivery failed: recipient={recipient_id}, {e}")
                await enqueue_offline_message(recipient_id, message)
        else:
            await enqueue_offline_message(recipient_id, message)
    else:
        # Different Gateway → forward via Redis Pub/Sub
        channel = f"gw:{gateway_id}"
        await redis_client.publish(channel, json.dumps(message))
        logger.debug(f"Pub/Sub forwarding: recipient={recipient_id}, gw={gateway_id}")


async def deliver_offline_messages(user_id: str, websocket: WebSocket):
    """Deliver messages accumulated while offline"""
    queue_key = f"offline:{user_id}"
    messages = await redis_client.lrange(queue_key, 0, -1)

    if messages:
        logger.info(f"Delivering offline messages: user={user_id}, count={len(messages)}")
        for msg_data in messages:
            try:
                message = json.loads(msg_data)
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Offline message delivery failed: {e}")

        # Clear queue after delivery
        await redis_client.delete(queue_key)


async def enqueue_offline_message(user_id: str, message: dict):
    """Add message to the offline message queue"""
    queue_key = f"offline:{user_id}"
    await redis_client.rpush(queue_key, json.dumps(message))
    # Keep up to 1000 messages (truncate older ones)
    await redis_client.ltrim(queue_key, -1000, -1)
    # Retain for 7 days
    await redis_client.expire(queue_key, 7 * 86400)


async def broadcast_presence_change(user_id: str, status: str):
    """Notify related users of a presence change"""
    # Notify the user's friends/chat partners of the presence change
    # Implementation omitted: retrieve friends list and notify each friend
    pass


async def send_push_notification(user_id: str, message: dict):
    """Send push notification (via APNS / FCM)"""
    # Implementation omitted: delegate to Push Notification Service
    pass


async def publish_to_kafka(topic: str, message: dict):
    """Publish message to Kafka"""
    # Implementation omitted: use confluent_kafka Producer
    pass


async def authenticate_ws(token: str, user_id: str) -> bool:
    """Authenticate WebSocket connection"""
    # Implementation omitted: verify JWT token
    return True
```

### 3.2 Group Chat Delivery

```python
# application/services/group_chat_service.py
import uuid
import time
import logging
from typing import Protocol

logger = logging.getLogger(__name__)


class GroupChatService:
    """Group chat delivery service

    Design decisions:
    - Small groups (<50 members): write-time fan-out (immediate delivery)
    - Large groups (>500 members): read-time fan-out (latency acceptable)
    - Hybrid: automatically switches based on group size
    """

    SMALL_GROUP_THRESHOLD = 50
    LARGE_GROUP_THRESHOLD = 500

    def __init__(self, redis_client, db, kafka_producer, push_service):
        self._redis = redis_client
        self._db = db
        self._kafka = kafka_producer
        self._push = push_service

    async def send_group_message(
        self,
        sender_id: str,
        group_id: str,
        content: str,
        content_type: str = "text",
    ):
        """Deliver a group message to all members"""
        message = {
            "id": str(uuid.uuid4()),
            "from": sender_id,
            "group_id": group_id,
            "content": content,
            "content_type": content_type,
            "timestamp": int(time.time() * 1000),
            "type": "group_chat",
        }

        # 1. Persist message (asynchronously via Kafka)
        await self._kafka.send("group-messages", message)

        # 2. Return ACK to sender
        await deliver_message(sender_id, {
            "type": "ack",
            "message_id": message["id"],
            "status": "sent",
        })

        # 3. Get group members
        members = await self.get_group_members(group_id)
        group_size = len(members)

        # 4. Fan-out strategy based on group size
        if group_size <= self.SMALL_GROUP_THRESHOLD:
            await self._fanout_push(sender_id, members, message)
        elif group_size <= self.LARGE_GROUP_THRESHOLD:
            await self._fanout_push_async(sender_id, members, message)
        else:
            await self._fanout_pull(sender_id, group_id, message)

    async def _fanout_push(
        self,
        sender_id: str,
        members: list[str],
        message: dict,
    ):
        """Write-time fan-out: immediately deliver to each member"""
        online_members = []
        offline_members = []

        for member_id in members:
            if member_id == sender_id:
                continue
            presence = await self._redis.get(f"presence:{member_id}")
            if presence and presence.decode() == "online":
                online_members.append(member_id)
            else:
                offline_members.append(member_id)

        # Immediately deliver to online members
        delivery_tasks = [
            deliver_message(member_id, message)
            for member_id in online_members
        ]
        await asyncio.gather(*delivery_tasks, return_exceptions=True)

        # Send push notifications to offline members
        if offline_members:
            await self._push.batch_send(
                user_ids=offline_members,
                title=f"New message ({message['group_id']})",
                body=message["content"][:100],
            )
            # Also save to offline queue
            for member_id in offline_members:
                await enqueue_offline_message(member_id, message)

    async def _fanout_push_async(
        self,
        sender_id: str,
        members: list[str],
        message: dict,
    ):
        """Asynchronous fan-out: deliver via Kafka worker"""
        # Publish fan-out job to Kafka
        await self._kafka.send("fanout-jobs", {
            "type": "group_fanout",
            "sender_id": sender_id,
            "members": members,
            "message": message,
        })

    async def _fanout_pull(
        self,
        sender_id: str,
        group_id: str,
        message: dict,
    ):
        """Read-time fan-out: members retrieve messages on access"""
        # Add message to the group timeline
        await self._redis.zadd(
            f"group_timeline:{group_id}",
            {json.dumps(message): message["timestamp"]},
        )
        # Limit timeline size (keep latest 10,000 entries)
        await self._redis.zremrangebyrank(
            f"group_timeline:{group_id}", 0, -10001
        )

    async def get_group_members(self, group_id: str) -> list[str]:
        """Retrieve the group member list (with cache)"""
        cached = await self._redis.smembers(f"group:{group_id}:members")
        if cached:
            return [m.decode() for m in cached]

        # Load from DB and cache
        members = await self._db.fetch_all(
            "SELECT user_id FROM group_members WHERE group_id = :gid",
            {"gid": group_id}
        )
        member_ids = [m["user_id"] for m in members]
        if member_ids:
            await self._redis.sadd(
                f"group:{group_id}:members", *member_ids
            )
            await self._redis.expire(f"group:{group_id}:members", 3600)
        return member_ids
```

### 3.3 Message Ordering Guarantee

```python
# infrastructure/id_generator/snowflake.py
"""
Message ID generation: Snowflake approach

Requirements:
  1. Globally unique
  2. Chronologically ordered (ID magnitude = time order)
  3. No collisions in distributed environments
  4. High throughput (4M+ IDs/sec per machine)

Structure: 64bit
  [1bit sign][41bit timestamp][10bit machine ID][12bit sequence]

  Timestamp: millisecond precision, ~69 years
  Machine ID: up to 1024 machines
  Sequence: 4096 IDs per millisecond
"""
import time
import threading


class MessageIdGenerator:
    EPOCH = 1704067200000  # 2024-01-01 00:00:00 UTC

    def __init__(self, machine_id: int):
        if machine_id < 0 or machine_id >= 1024:
            raise ValueError("machine_id must be in range 0-1023")
        self._machine_id = machine_id
        self._sequence = 0
        self._last_timestamp = -1
        self._lock = threading.Lock()

    def generate(self) -> int:
        with self._lock:
            timestamp = int(time.time() * 1000) - self.EPOCH

            if timestamp == self._last_timestamp:
                self._sequence = (self._sequence + 1) & 0xFFF  # 12bit
                if self._sequence == 0:
                    # Sequence limit reached within same millisecond → wait for next millisecond
                    while timestamp <= self._last_timestamp:
                        timestamp = int(time.time() * 1000) - self.EPOCH
            else:
                self._sequence = 0

            self._last_timestamp = timestamp

            return (
                (timestamp << 22)
                | (self._machine_id << 12)
                | self._sequence
            )

    def extract_timestamp(self, message_id: int) -> int:
        """Extract timestamp from a message ID"""
        return (message_id >> 22) + self.EPOCH
```

### 3.4 Read Receipt Management

```python
# application/services/read_receipt_service.py
"""
Read receipt design decisions:

  Option 1: Store a read flag per message
    → Read records = number of messages × number of users
    → 2 billion messages × 2 users = 4 billion records/day → impractical

  Option 2: Store only the "last read message ID" (adopted)
    → Only records per chat room × users
    → Since msg_id is a Snowflake ID, unread detection is possible via comparison
    → Far more storage-efficient
"""
import logging

logger = logging.getLogger(__name__)


class ReadReceiptService:
    """Efficiently manage read receipt state

    For each chat room, only the "last read message ID" is stored.
    Using the monotonically increasing property of Snowflake IDs,
    messages after last_read_msg_id are treated as unread.
    """

    def __init__(self, redis_client, db):
        self._redis = redis_client
        self._db = db

    async def mark_read(
        self,
        user_id: str,
        chat_id: str,
        last_read_msg_id: str,
    ) -> None:
        """Mark messages as read up to the specified message"""
        key = f"read:{chat_id}:{user_id}"
        current = await self._redis.get(key)

        # Only update if the message ID is newer (idempotent)
        if current is None or last_read_msg_id > current.decode():
            await self._redis.set(key, last_read_msg_id)

            # Also persist to DB asynchronously (for recovery in case of Redis failure)
            await self._db.execute(
                """
                INSERT INTO read_receipts (user_id, chat_id, last_read_msg_id)
                VALUES (:uid, :cid, :mid)
                ON CONFLICT (user_id, chat_id) DO UPDATE
                SET last_read_msg_id = :mid
                WHERE read_receipts.last_read_msg_id < :mid
                """,
                {"uid": user_id, "cid": chat_id, "mid": last_read_msg_id}
            )

            # Send read receipt notification to the other party
            await self._notify_read_receipt(
                chat_id, user_id, last_read_msg_id
            )

    async def get_unread_count(self, user_id: str, chat_id: str) -> int:
        """Get the number of unread messages"""
        last_read = await self._redis.get(f"read:{chat_id}:{user_id}")

        if last_read is None:
            # All messages are unread
            return await self._count_all_messages(chat_id)

        return await self._count_messages_after(
            chat_id, last_read.decode()
        )

    async def get_unread_counts_batch(
        self, user_id: str, chat_ids: list[str]
    ) -> dict[str, int]:
        """Batch-retrieve unread counts for multiple chats (for the chat list screen)"""
        result = {}
        pipe = self._redis.pipeline()
        for chat_id in chat_ids:
            pipe.get(f"read:{chat_id}:{user_id}")
        last_reads = await pipe.execute()

        for chat_id, last_read in zip(chat_ids, last_reads):
            if last_read is None:
                result[chat_id] = await self._count_all_messages(chat_id)
            else:
                result[chat_id] = await self._count_messages_after(
                    chat_id, last_read.decode()
                )
        return result

    async def _notify_read_receipt(
        self, chat_id: str, reader_id: str, last_read_msg_id: str
    ):
        """Send read receipt notification to the other party"""
        # Get the other participants in the chat
        participants = await self._redis.smembers(
            f"chat:{chat_id}:participants"
        )
        for participant in participants:
            pid = participant.decode()
            if pid != reader_id:
                await deliver_message(pid, {
                    "type": "read_receipt",
                    "chat_id": chat_id,
                    "reader_id": reader_id,
                    "last_read_msg_id": last_read_msg_id,
                })

    async def _count_all_messages(self, chat_id: str) -> int:
        """Total number of messages in a chat"""
        result = await self._db.fetch_one(
            "SELECT COUNT(*) as cnt FROM messages WHERE chat_id = :cid",
            {"cid": chat_id}
        )
        return result["cnt"] if result else 0

    async def _count_messages_after(
        self, chat_id: str, msg_id: str
    ) -> int:
        """Number of messages after the specified message"""
        result = await self._db.fetch_one(
            "SELECT COUNT(*) as cnt FROM messages "
            "WHERE chat_id = :cid AND id > :mid",
            {"cid": chat_id, "mid": msg_id}
        )
        return result["cnt"] if result else 0
```

### 3.5 Message Persistence (Cassandra)

```python
# infrastructure/repositories/cassandra_message_repo.py
"""
Reasons for choosing Cassandra as the message store:

  1. Write optimization: High write throughput based on LSM-tree
  2. Horizontal scaling: Scales linearly with node additions
  3. High availability: Fault tolerance with replication factor 3
  4. Optimized for time-series data: Partition key + clustering key

  Table design:
  PRIMARY KEY ((chat_id), message_id)
  → chat_id is the partition key (collocates messages from the same chat on the same node)
  → message_id is the clustering key (sorted chronologically by Snowflake ID)
"""


class CassandraMessageRepository:
    """Cassandra-based message repository"""

    CREATE_TABLE = """
    CREATE TABLE IF NOT EXISTS messages (
        chat_id     TEXT,
        message_id  BIGINT,
        sender_id   TEXT,
        content     TEXT,
        content_type TEXT,
        created_at  TIMESTAMP,
        PRIMARY KEY ((chat_id), message_id)
    ) WITH CLUSTERING ORDER BY (message_id DESC)
      AND compaction = {'class': 'TimeWindowCompactionStrategy',
                        'compaction_window_size': 1,
                        'compaction_window_unit': 'DAYS'};
    """

    def __init__(self, session):
        self._session = session

    async def save_message(self, message: dict) -> None:
        """Save a message"""
        await self._session.execute_async(
            """
            INSERT INTO messages
                (chat_id, message_id, sender_id, content, content_type, created_at)
            VALUES (%s, %s, %s, %s, %s, toTimestamp(now()))
            """,
            (
                message.get("to") or message.get("group_id"),
                int(message["id"]),
                message["from"],
                message["content"],
                message.get("content_type", "text"),
            )
        )

    async def get_messages(
        self,
        chat_id: str,
        before_id: int | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """Retrieve message history (with pagination support)

        before_id: retrieve messages before this message ID
        limit: number of messages to retrieve (default 50)
        """
        if before_id:
            rows = await self._session.execute_async(
                """
                SELECT * FROM messages
                WHERE chat_id = %s AND message_id < %s
                ORDER BY message_id DESC
                LIMIT %s
                """,
                (chat_id, before_id, limit)
            )
        else:
            rows = await self._session.execute_async(
                """
                SELECT * FROM messages
                WHERE chat_id = %s
                ORDER BY message_id DESC
                LIMIT %s
                """,
                (chat_id, limit)
            )
        return [dict(row) for row in rows]

    async def get_message_count(self, chat_id: str) -> int:
        """Get total message count (use of a counter table is recommended)"""
        rows = await self._session.execute_async(
            "SELECT COUNT(*) as cnt FROM messages WHERE chat_id = %s",
            (chat_id,)
        )
        return rows[0]["cnt"] if rows else 0
```

---

## 4. Testing

### 4.1 WebSocket Gateway Tests

```python
# tests/test_websocket_gateway.py
import pytest
import asyncio
from unittest.mock import AsyncMock, patch


class FakeRedis:
    def __init__(self):
        self._data = {}
        self._hash = {}
        self._pubsub_messages = []

    async def hset(self, name, key, value):
        self._hash.setdefault(name, {})[key] = value

    async def hget(self, name, key):
        return self._hash.get(name, {}).get(key)

    async def hdel(self, name, key):
        self._hash.get(name, {}).pop(key, None)

    async def set(self, key, value, ex=None):
        self._data[key] = value

    async def get(self, key):
        value = self._data.get(key)
        return value.encode() if isinstance(value, str) else value

    async def publish(self, channel, message):
        self._pubsub_messages.append((channel, message))

    async def rpush(self, key, *values):
        self._data.setdefault(key, []).extend(values)

    async def lrange(self, key, start, stop):
        return self._data.get(key, [])

    async def delete(self, key):
        self._data.pop(key, None)


class FakeWebSocket:
    def __init__(self):
        self.sent_messages = []
        self.closed = False

    async def send_json(self, data):
        self.sent_messages.append(data)

    async def accept(self):
        pass

    async def close(self, code=1000, reason=""):
        self.closed = True


class TestDeliverMessage:
    """Tests for message delivery"""

    @pytest.fixture
    def redis(self):
        return FakeRedis()

    @pytest.mark.asyncio
    async def test_same_gateway_direct_delivery(self, redis):
        """When the recipient is connected to the same Gateway, deliver directly"""
        ws = FakeWebSocket()
        local_connections["user_b"] = ws
        await redis.hset("ws:connections", "user_b", GATEWAY_ID)

        message = {"type": "chat", "content": "Hello!"}
        await deliver_message("user_b", message)

        assert len(ws.sent_messages) == 1
        assert ws.sent_messages[0]["content"] == "Hello!"

    @pytest.mark.asyncio
    async def test_different_gateway_pubsub_forwarding(self, redis):
        """When the recipient is connected to a different Gateway, forward via Pub/Sub"""
        await redis.hset("ws:connections", "user_c", "gw-other")

        message = {"type": "chat", "content": "Hello!"}
        await deliver_message("user_c", message)

        assert len(redis._pubsub_messages) == 1
        channel, _ = redis._pubsub_messages[0]
        assert channel == "gw:gw-other"

    @pytest.mark.asyncio
    async def test_offline_save_to_queue(self, redis):
        """When the recipient is offline, save to queue"""
        # User not in connection map = offline
        message = {"type": "chat", "content": "Hello!"}
        await deliver_message("user_offline", message)

        # Message should be saved to the offline queue
        queue = redis._data.get("offline:user_offline", [])
        assert len(queue) == 1


class TestReadReceipt:
    """Tests for read receipt management"""

    @pytest.mark.asyncio
    async def test_mark_read(self):
        redis = FakeRedis()
        db = AsyncMock()
        service = ReadReceiptService(redis, db)

        await service.mark_read("user_a", "chat_001", "msg_100")

        last_read = await redis.get("read:chat_001:user_a")
        assert last_read.decode() == "msg_100"

    @pytest.mark.asyncio
    async def test_not_updated_with_older_message_id(self):
        redis = FakeRedis()
        db = AsyncMock()
        service = ReadReceiptService(redis, db)

        await service.mark_read("user_a", "chat_001", "msg_100")
        await service.mark_read("user_a", "chat_001", "msg_050")

        last_read = await redis.get("read:chat_001:user_a")
        assert last_read.decode() == "msg_100"  # Not updated with older ID


class TestMessageIdGenerator:
    """Tests for the Snowflake ID generator"""

    def test_uniqueness(self):
        gen = MessageIdGenerator(machine_id=1)
        ids = [gen.generate() for _ in range(10000)]
        assert len(set(ids)) == 10000  # All unique

    def test_monotonically_increasing(self):
        gen = MessageIdGenerator(machine_id=1)
        ids = [gen.generate() for _ in range(1000)]
        assert ids == sorted(ids)  # Monotonically increasing

    def test_unique_across_different_machine_ids(self):
        gen1 = MessageIdGenerator(machine_id=1)
        gen2 = MessageIdGenerator(machine_id=2)
        ids1 = {gen1.generate() for _ in range(1000)}
        ids2 = {gen2.generate() for _ in range(1000)}
        assert len(ids1 & ids2) == 0  # No duplicates
```

---

## 5. Fan-Out Strategy Comparison

### 5.1 Write-Time vs. Read-Time Fan-Out

| Aspect | Write-Time Fan-Out (Push) | Read-Time Fan-Out (Pull) |
|------|------------------------------|------------------------------|
| Approach | Write to all recipients' inboxes at send time | Recipients retrieve messages on access |
| Delivery latency | Low (immediate delivery) | High (aggregation needed at retrieval) |
| Write cost | High (write to N users) | Low (write to one place) |
| Read cost | Low (just read own inbox) | High (aggregate from multiple sources) |
| Storage | High (N copies) | Low (1 copy) |
| Best suited for | Small to medium groups (<50 people) | Large channels (>500 people) |

### 5.2 Hybrid Approach

```
=== Fan-Out Strategy by Group Size ===

Small group (< 50 people): Write-time fan-out (Push)
  → Immediate delivery is critical, latency is unacceptable
  → 50 people × 40 messages/day = 2000 writes/day (acceptable)

Medium group (50-500 people): Asynchronous fan-out
  → Deliver asynchronously via Kafka worker
  → Return ACK to sender immediately
  → Delivery latency is a few hundred ms (acceptable)

Large channel (> 500 people): Read-time fan-out (Pull)
  → Write cost is enormous (500 people × delivery = massive writes)
  → Write to the channel timeline only once
  → Members read the timeline on access

VIP users: Always write-time fan-out
  → Experience takes priority
  → Differentiation based on service level
```

---

## 6. Comparison Tables

### 6.1 Communication Protocols

| Protocol | Direction | Latency | Overhead | Use Case |
|-----------|:----:|:---------:|:-----------:|---------|
| WebSocket | Bidirectional | Lowest | Low | Real-time chat (recommended) |
| SSE (Server-Sent Events) | Server → Client | Low | Medium | Notifications, feed updates |
| Long Polling | Pseudo-bidirectional | Medium | High | Fallback for non-WebSocket environments |
| HTTP Polling | Pseudo-bidirectional | High | Highest | Legacy environments only |

### 6.2 Message Stores

| Property | Cassandra | DynamoDB | MongoDB |
|-----|:---------:|:--------:|:------:|
| Write throughput | Very high | High | Moderate |
| Read pattern | Partition key lookup | Hash key lookup | Flexible queries |
| Scalability | Automatic (add nodes) | Automatic (managed) | Manual sharding |
| Operational cost | High (self-managed) | Low (managed) | Moderate |
| Best suited for | Very large-scale chat | AWS ecosystem | Small to medium scale |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Poll for All Messages

```
WHY: With HTTP polling, most requests return empty responses,
     wasting server resources and bandwidth.

BAD:
  Client: GET /messages?since=xxx (polling every second)
  → 50M DAU × 1 req/sec = 50M QPS (mostly wasteful)
  → Latency: up to 1 second delay
  → Heavy battery consumption

GOOD: Maintain persistent WebSocket connection, server pushes messages
  → More connections, but drastically fewer wasted requests
  → Real-time delivery (latency < 100ms)
  → Long polling as a fallback for non-WebSocket environments
```

### Anti-Pattern 2: Synchronously Deliver to All Group Members

```
WHY: With synchronous delivery, latency grows proportionally to member count,
     and a single error delays the entire delivery.

BAD:
  Synchronously wait for 500 WebSocket sends to a 500-person group
  → 5ms per delivery × 500 people = 2.5 seconds of blocking
  → One connection error delays the entire group

GOOD: Asynchronous fan-out
  1. Publish message to Kafka (one write)
  2. Worker delivers asynchronously to each member
  3. Return ACK to sender immediately
  4. Delivery failures handled via retry queue
```

### Anti-Pattern 3: Record Read Receipts Per Message

```
WHY: Requires records per message × per user, causing storage and write explosion.

BAD:
  2 billion messages/day × 2 users = 4 billion read records/day
  → Enormous storage
  → More read writes than message writes

GOOD: Store only the "last read message ID"
  → Only records per chat room × users
  → Determine unread by Snowflake ID comparison
```

### Anti-Pattern 4: Manage WebSocket Connections on a Single Server

```
WHY: A single server has a limit on concurrent connections,
     and a failure disconnects all users.

BAD:
  5 million connections → 1 server → 47GB memory, CPU overload

GOOD: Cluster WebSocket Gateways
  → Manage connection map in Redis (user_id → gateway_id)
  → Transfer messages between Gateways via Redis Pub/Sub
  → On Gateway failure, clients reconnect to another Gateway
```

### Anti-Pattern 5: Guarantee Message Order Using Timestamps

```
WHY: In distributed environments, server clocks can drift slightly,
     so timestamps alone cannot guarantee accurate ordering.

BAD:
  Server A message: timestamp = 1000
  Server B message: timestamp = 999
  → Server B was actually first, but the order is reversed

GOOD: Guarantee order with Snowflake IDs
  → Timestamp + machine ID + sequence number
  → Strict ordering within the same machine via sequence number
  → Approximately correct ordering to millisecond precision across machines
```

---

## 8. Exercises

### Exercise 1: Basic — WebSocket Chat Server (30 minutes)

**Task**: Implement a simplified WebSocket chat server

Requirements:
1. Handle WebSocket connections
2. Manage list of connected users
3. Broadcast messages (send to all users)
4. Cleanup on disconnect

**Expected output**:
```python
# User A connects
# User B connects
# User A sends a message → delivered to User B
# User B disconnects → User A is notified
```

### Exercise 2: Intermediate — Read Receipt Implementation (60 minutes)

**Task**: Implement a Snowflake ID-based read receipt management system

Requirements:
1. Complete implementation of ReadReceiptService
2. Get unread count (single chat + batch retrieval)
3. Deliver read receipt notifications
4. 5 or more test cases

**Expected output**:
```python
service = ReadReceiptService(redis, db)

# Mark as read
await service.mark_read("user_a", "chat_001", "msg_100")

# Get unread count
count = await service.get_unread_count("user_a", "chat_001")
assert count == 0  # Read up to msg_100

# Batch retrieval
counts = await service.get_unread_counts_batch(
    "user_a", ["chat_001", "chat_002", "chat_003"]
)
```

### Exercise 3: Advanced — Group Chat Fan-Out (90 minutes)

**Task**: Implement a group chat service with a hybrid fan-out strategy

Requirements:
1. Small groups (<50 people): immediate delivery
2. Medium groups (50-500 people): asynchronous delivery (via Kafka)
3. Large channels (>500 people): read-time fan-out
4. Push notifications for offline members
5. Performance tests for each strategy

**Expected output**:
```python
# Small group: immediate delivery
await service.send_group_message("user_a", "small_group", "Hello!")
# → All members receive immediately

# Large channel: write to timeline
await service.send_group_message("user_a", "large_channel", "Hello!")
# → Written to timeline only once
# → Members retrieve on access
```

---

## 9. FAQ

### Q1: What is the reconnection strategy when a WebSocket connection is dropped?

**A:** Implement reconnection with exponential backoff + jitter.

```python
import random
import asyncio


async def reconnect_with_backoff(
    websocket_url: str,
    max_retries: int = 10,
    max_backoff: float = 30.0,
):
    """Reconnection with exponential backoff + jitter"""
    for attempt in range(max_retries):
        try:
            ws = await connect_websocket(websocket_url)
            # Reconnection successful → sync missed messages
            await sync_missed_messages(ws, last_received_msg_id)
            return ws
        except ConnectionError:
            # Exponential backoff: 1, 2, 4, 8, 16, ... seconds
            backoff = min(2 ** attempt, max_backoff)
            # Jitter: random between 0 and backoff (to avoid Thundering Herd)
            jitter = random.uniform(0, backoff)
            await asyncio.sleep(jitter)

    raise ConnectionError("Maximum retry count exceeded")
```

### Q2: How do you implement message encryption?

**A:** The Signal Protocol is the industry standard for end-to-end encryption (E2EE).

```
Signal Protocol overview:

  Key exchange: X3DH (Extended Triple Diffie-Hellman)
  → Establishes a shared key on the first message
  → Private keys are not entrusted to the server

  Message encryption: Double Ratchet Algorithm
  → Generates a new encryption key for each message
  → Even if one key is compromised, past and future messages remain safe

  Server's role:
  → Only relays encrypted messages
  → Even server operators cannot read messages

  Group E2EE:
  → Sender Key protocol
  → Distribute a shared key to all group members
  → Rotate keys when membership changes

  Adopted by: WhatsApp, Signal, LINE (partially)
```

### Q3: How do you manage message retention periods and storage?

**A:** Adopt a tiered storage strategy.

```
Hot storage (30 days): Cassandra / DynamoDB
  → Fast access to recent messages
  → 373 GB/day × 30 days = 11.2 TB

Warm storage (1 year): Compressed to S3 + metadata DB
  → Search and display of older messages
  → 5:1 compression ratio → 133 TB/year → 26.6 TB/year

Cold storage (5+ years): S3 Glacier / Archive
  → Retention for legal requirements
  → Access frequency: nearly zero

Message search:
  → Create index in Elasticsearch
  → Full-text search of message content
  → Only index messages in hot storage (30 days)
```

### Q4: How do you manage millions of concurrent WebSocket connections?

**A:** Cluster Gateways and distribute connection map management.

```
Concurrent connections per server:
  → Modern version of the C10K problem: 100K+ connections/server with epoll/kqueue
  → Memory per connection: ~10KB
  → ~1 million connections on a 16GB RAM server

For 5 million connections:
  → WebSocket Gateway: minimum 5 servers (10 servers with buffer)
  → Redis: connection map (5 million entries ≈ hundreds of MB)
  → Load balancer: sticky session or IP hash

Scaling strategy:
  → Gateway is stateless (connection state stored in Redis)
  → Scale by simply adding new Gateways
  → On Gateway failure, clients automatically reconnect to another Gateway
```

### Q5: How should I approach this in an interview?

**A:** Answer using the following framework.

```
Step 1: Clarify requirements (3-5 min)
  → 1-to-1? Group? Both?
  → Expected DAU, concurrent connections
  → Message types (text? images? video?)
  → Is E2EE required?

Step 2: High-level design (10-15 min)
  → Architecture diagram: Client → WS Gateway → Message Service → DB
  → Reasoning for choosing WebSocket (vs. polling, SSE)
  → Explain Redis connection map

Step 3: Deep dive (15-20 min)
  → Group chat fan-out strategy
  → Offline handling (queue + push notifications)
  → Efficient read receipt implementation
  → Message ordering guarantee (Snowflake ID)

Step 4: Scalability (5-10 min)
  → How to manage 5 million concurrent connections
  → Gateway scaling
  → Reasoning for choosing Cassandra as message store
```

### Q6: How do you implement a typing indicator?

**A:** Implement it with rate-limited, lightweight Pub/Sub.

```python
# Client side: send a typing event every 3 seconds while typing
# Server side: forward typing events to the recipient

async def handle_typing_indicator(sender_id: str, data: dict):
    """Handle typing indicator

    Design decisions:
    - Not saved to DB (highly volatile data)
    - Rate limit: at most once every 3 seconds
    - TTL: automatically disappears after 5 seconds
    """
    recipient_id = data["to"]
    key = f"typing:{sender_id}:{recipient_id}"

    # Rate limit: once every 3 seconds
    if await redis_client.exists(key):
        return
    await redis_client.set(key, "1", ex=3)

    # Notify recipient (not persisted)
    await deliver_message(recipient_id, {
        "type": "typing",
        "from": sender_id,
        "expires_in": 5000,  # Disappears after 5 seconds
    })
```

### Q7: How do you implement message editing and deletion?

**A:** Implement using soft delete and update events.

```
Message editing:
  1. Update the message record in DB (record edited_at)
  2. Send a "message_edited" event to the other party
  3. Client updates the display (shows "edited" mark)

Message deletion:
  1. Soft-delete the message in DB (is_deleted = true)
  2. Replace content with "This message has been deleted"
  3. Send a "message_deleted" event to the other party

Notes:
  - In E2EE environments, the server does not know the original content
  - "Complete deletion" of already-delivered messages is not possible
  - "Delete from recipient's device too" requires recipient cooperation (like LINE's Unsend)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently applied in day-to-day development tasks. It is especially important during code reviews and architecture design.

---

## Summary

| Design Element | Choice | Reason |
|----------|------|------|
| Communication protocol | WebSocket | Real-time bidirectional communication, low latency |
| Connection management | Redis (connection map) | Fast lookup, bridges between Gateways |
| Message ID | Snowflake ID | Chronological ordering guarantee + distributed generation |
| Message DB | Cassandra | Write scalability, time-series optimization |
| Message queue | Kafka | Asynchronous fan-out, at-least-once guarantee |
| Cache | Redis | Presence, read receipts, member lists |
| Push notifications | APNS / FCM | Offline user support |
| Fan-out | Hybrid | Optimization based on group size |

---

## Further Reading

- [Notification System Design](./02-notification-system.md) — Large-scale push notification delivery design
- [URL Shortener Design](./00-url-shortener.md) — Fundamentals of simple system design
- [Rate Limiter Design](./03-rate-limiter.md) — Rate limiting for API protection
- [Event-Driven Architecture](../02-architecture/03-event-driven.md) — Detailed Pub/Sub patterns
- [Message Queue](../01-components/02-message-queue.md) — Detailed Kafka design

---

## References

1. **System Design Interview: An Insider's Guide** — Alex Xu (2020) — Chapter 12: Design a Chat System
2. **The X3DH Key Agreement Protocol** — Marlinspike, M. & Perrin, T. (Signal Foundation, 2016) — Key exchange protocol for E2EE
3. **Cassandra: A Decentralized Structured Storage System** — Lakshman, A. & Malik, P. (ACM SIGOPS, 2010) — Distributed storage design
4. **The WebSocket Protocol** — RFC 6455 (IETF, 2011) — WebSocket specification
5. **Scaling WhatsApp** — https://highscalability.com/ — WhatsApp scaling in practice
6. **Discord Engineering Blog** — https://discord.com/blog/how-discord-stores-billions-of-messages — Strategy for storing billions of messages
