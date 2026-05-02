# Notification System Design

> Design a large-scale notification system from scratch that integrates iOS push notifications, Android FCM, SMS, email, and in-app notifications. This guide covers a comprehensive architecture including delivery guarantees, rate limiting, user preference management, priority control, and analytics infrastructure.

---

## What You Will Learn in This Chapter

1. **Unified multi-channel architecture** — Design approach for managing push notifications, SMS, email, and in-app notifications through a unified API with cross-channel coordination
2. **Reliability and delivery guarantees** — Mechanisms for message deduplication, retry strategies, delivery confirmation, and failure recovery using Dead Letter Queues
3. **User experience optimization** — Intelligent delivery based on rate limiting, priority management, batch aggregation, timezone support, and user preferences
4. **Scalability and operations** — Horizontal scaling, monitoring, A/B testing, and analytics infrastructure for processing billions of notifications per day

---

## Prerequisites

Having the following knowledge before reading this guide will help you follow along smoothly.

| Topic | Reference |
|---------|--------|
| Fundamentals of system design | [System Design Overview](../00-fundamentals/00-system-design-overview.md) |
| Scalability principles | [Scalability](../00-fundamentals/01-scalability.md) |
| How message queues work | [Message Queue](../01-components/02-message-queue.md) |
| Caching strategies | [Caching](../01-components/01-caching.md) |
| Event-driven architecture | [Event-Driven Design](../02-architecture/03-event-driven.md) |
| Observer pattern | Observer Pattern |
| API design best practices | API Design |

---

## 1. Requirements Definition

### 1.1 Functional Requirements

Clarify the key features the notification system must provide.

```
Functional requirements list:

1. Multi-channel delivery
   - iOS push notifications (APNs)
   - Android push notifications (FCM)
   - SMS (Twilio, AWS SNS, etc.)
   - Email (SES, SendGrid, etc.)
   - In-app notifications (WebSocket / SSE)
   - Web Push (Service Worker)

2. Template management
   - Multilingual templates (i18n)
   - Channel-specific templates
   - Dynamic variable interpolation (Jinja2 / Mustache)
   - Template version control

3. User preferences
   - Per-channel on/off settings
   - Per-category notification settings (marketing / transactional, etc.)
   - Quiet Hours (do-not-disturb time window)
   - Customizable frequency limits

4. Delivery control
   - Scheduled delivery (send at a specified date/time)
   - Priority control (critical / high / normal / low)
   - Rate limiting (per user / per channel)
   - Batch aggregation (grouping similar notifications)

5. Operational features
   - Notification history storage and browsing API
   - Real-time delivery status monitoring
   - A/B testing
   - Delivery analytics (open rate, click rate)
```

### 1.2 Non-Functional Requirements

```
Non-functional requirements:

1. Performance
   - Notification intake API: p99 latency < 100ms
   - Delivery latency: normal notifications < 30s, priority notifications < 5s
   - Throughput: peak 200,000 QPS or more

2. Availability
   - SLA: 99.99% (annual downtime < 52 minutes)
   - Automatic failover on data center failure

3. Durability
   - Zero notification message loss (at-least-once delivery)
   - Notification history retained for 90 days

4. Scalability
   - Handle 10x load increase via horizontal scaling
   - Adding a new channel has no impact on existing system

5. Security
   - API authentication and authorization (OAuth 2.0 / API Key)
   - PII data encryption
   - Compliance with GDPR / personal information protection laws
```

### 1.3 Scale Estimation

```
Assumptions:
  - Registered users: 500M
  - DAU: 100M
  - Notifications per day: 10B (push 5B + email 3B + SMS 0.5B + in-app 1.5B)

Throughput calculation:
  Push notifications:
    5B / 86,400 ≈ 57,870 QPS (peak 2x ≈ 115,000 QPS)

  Email:
    3B / 86,400 ≈ 34,700 QPS (peak 2x ≈ 70,000 QPS)

  SMS:
    0.5B / 86,400 ≈ 5,780 QPS (peak 2x ≈ 11,560 QPS)

  In-app notifications:
    1.5B / 86,400 ≈ 17,360 QPS (peak 2x ≈ 34,720 QPS)

  Total peak across all channels: ≈ 231,280 QPS → approx 200K+ QPS

Storage calculation:
  Notification metadata (1 notification ≈ 500B):
    10B * 500B = 5TB/day
    90-day retention: 450TB

  Notification history (per-user view, last 100 items):
    500M users * 100 items * 200B = 10TB

  Templates:
    10,000 templates * 10KB = 100MB (negligible)

Bandwidth:
  Email body (average 50KB):
    3B * 50KB = 150TB/day → approx 14 Gbps

  Push payload (average 1KB):
    5B * 1KB = 5TB/day → approx 0.5 Gbps
```

---

## 2. High-Level Architecture

### 2.1 Overall Architecture Diagram

```
Notification System Overall Architecture

  +-----------+    +-----------+    +-----------+
  | Micro-    |    | Admin     |    | Scheduler |
  | services  |    | Console   |    | (Cron)    |
  | (events)  |    | (CMS)     |    |           |
  +-----------+    +-----------+    +-----------+
       |                |                |
       v                v                v
  +--------------------------------------------------+
  |           Notification API Gateway               |
  |  (Auth, rate limiting, validation, routing)      |
  +--------------------------------------------------+
                        |
                        v
  +--------------------------------------------------+
  |           Notification Orchestrator              |
  |                                                  |
  |  +----------+  +---------+  +---------+  +------+|
  |  | User     |  | Template|  | Priority|  | Dedup||
  |  | Prefs    |->| Render  |->| Routing |->|      ||
  |  +----------+  +---------+  +---------+  +------+|
  +--------------------------------------------------+
                        |
          +-------------+-------------+
          |             |             |
     +---------+  +---------+  +---------+
     | Push    |  | Email   |  | SMS     |
     | Queue   |  | Queue   |  | Queue   |
     +---------+  +---------+  +---------+
          |             |             |
     +---------+  +---------+  +---------+
     | Push    |  | Email   |  | SMS     |
     | Workers |  | Workers |  | Workers |
     +---------+  +---------+  +---------+
          |             |             |
     +----+----+  +-----+-----+  +--------+
     |    |    |  |     |     |  |        |
    APNs  FCM WP  SES SendGrid  Twilio  Vonage

  +--------------------------------------------------+
  |         Analytics & Observability Platform       |
  |  Delivery Logs → Kafka → ClickHouse → Grafana   |
  +--------------------------------------------------+
```

### 2.2 Detailed Component Diagram

```
+-------------------------------------------------------------------+
|                Notification Service                               |
+-------------------------------------------------------------------+
|                                                                   |
|  [Intake API]                                                     |
|      |                                                            |
|      v                                                            |
|  [Validation] --- Invalid request → 400 Error                    |
|      |                                                            |
|      v                                                            |
|  [User Preference Check] --- Redis Cache (TTL: 5min)             |
|      |                   |                                        |
|      |              [User Preferences DB]                         |
|      |                                                            |
|      v                                                            |
|  [Template Rendering] --- Template Cache (TTL: 1hour)            |
|      |                   |                                        |
|      |              [Template DB (versioned)]                     |
|      |                                                            |
|      v                                                            |
|  [Priority Determination & Routing]                               |
|      |                                                            |
|      +-- critical → immediate delivery (queue bypass)            |
|      +-- high     → priority queue                               |
|      +-- normal   → standard queue                               |
|      +-- low      → batch queue (aggregate then deliver)         |
|      |                                                            |
|      v                                                            |
|  [Deduplication] --- Redis SETNX (TTL: 24h)                      |
|      |                                                            |
|      v                                                            |
|  [Rate Limiting] --- Redis Sorted Set (Sliding Window)           |
|      |                                                            |
|      v                                                            |
|  [Enqueue to Channel-Specific Queue] --- Kafka Topics            |
|                                                                   |
+-------------------------------------------------------------------+
```

### 2.3 Data Flow Diagram

```
The Life of a Notification (Lifecycle)

  [1. Generate]      [2. Process]        [3. Deliver]      [4. Track]

  Event occurs    →  Check prefs     →  Enqueue        →  Log delivery
  API call           Render template    Worker process     Track open
  Scheduler run      Deduplication      Send to provider   Track click
  Rule engine        Rate limiting      Retry handling     Aggregate analytics

  Status transitions:
  CREATED → PROCESSING → QUEUED → SENDING → DELIVERED → OPENED → CLICKED
                                     |
                                     +→ FAILED → RETRYING → DELIVERED
                                                     |
                                                     +→ DEAD_LETTERED
```

---

## 3. Data Model Design

### 3.1 Key Tables

```sql
-- Notification request (per batch)
CREATE TABLE notification_batches (
    batch_id        UUID PRIMARY KEY,
    template_id     VARCHAR(100) NOT NULL,
    channels        JSONB NOT NULL,          -- ["push", "email"]
    data            JSONB NOT NULL,          -- template variables
    priority        VARCHAR(10) DEFAULT 'normal',
    scheduled_at    TIMESTAMPTZ,
    created_by      VARCHAR(100) NOT NULL,   -- originating service
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    status          VARCHAR(20) DEFAULT 'processing'
);

-- Individual notification (per user × channel)
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY,
    batch_id        UUID REFERENCES notification_batches(batch_id),
    user_id         VARCHAR(100) NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    content         JSONB NOT NULL,          -- rendered content
    priority        VARCHAR(10) NOT NULL,
    status          VARCHAR(20) DEFAULT 'queued',
    -- queued / sending / delivered / failed / dead_lettered
    retry_count     INT DEFAULT 0,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    clicked_at      TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    INDEX idx_notifications_user (user_id, created_at DESC),
    INDEX idx_notifications_status (status, channel),
    INDEX idx_notifications_batch (batch_id)
);

-- User notification preferences
CREATE TABLE user_notification_preferences (
    user_id         VARCHAR(100) PRIMARY KEY,
    push_enabled    BOOLEAN DEFAULT TRUE,
    email_enabled   BOOLEAN DEFAULT TRUE,
    sms_enabled     BOOLEAN DEFAULT TRUE,
    in_app_enabled  BOOLEAN DEFAULT TRUE,
    quiet_hours     JSONB,  -- {"start": "23:00", "end": "07:00", "timezone": "Asia/Tokyo"}
    categories      JSONB,  -- {"marketing": false, "transaction": true, ...}
    frequency_limit JSONB,  -- custom rate limits
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Device tokens
CREATE TABLE device_tokens (
    token_id        UUID PRIMARY KEY,
    user_id         VARCHAR(100) NOT NULL,
    platform        VARCHAR(20) NOT NULL,    -- ios / android / web
    device_token    TEXT NOT NULL,
    app_version     VARCHAR(20),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,

    UNIQUE(user_id, device_token),
    INDEX idx_device_tokens_user (user_id, is_active)
);

-- Notification templates
CREATE TABLE notification_templates (
    template_id     VARCHAR(100) NOT NULL,
    version         INT NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    locale          VARCHAR(10) NOT NULL,    -- ja, en, zh, ...
    subject         TEXT,                     -- email subject, etc.
    title           TEXT,                     -- push title
    body            TEXT NOT NULL,            -- body template
    metadata        JSONB,                   -- custom data
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (template_id, version, channel, locale)
);
```

### 3.2 Redis Data Structures

```
Redis Key Design:

1. User preference cache
   Key:    user_prefs:{user_id}
   Type:   Hash
   TTL:    300s (5 minutes)
   Fields: push_enabled, email_enabled, sms_enabled, quiet_hours, categories

2. Rate limit counters
   Key:    ratelimit:{user_id}:{channel}:hour
   Type:   Sorted Set (score = timestamp)
   TTL:    3600s

   Key:    ratelimit:{user_id}:{channel}:day
   Type:   Sorted Set (score = timestamp)
   TTL:    86400s

3. Deduplication
   Key:    dedup:{notification_id}
   Type:   String ("1")
   TTL:    86400s (24 hours)

4. Device token cache
   Key:    devices:{user_id}
   Type:   Hash (platform → token)
   TTL:    600s (10 minutes)

5. Batch aggregation buffer
   Key:    batch:{user_id}:{category}
   Type:   List (notifications pending aggregation)
   TTL:    300s (5-minute window)
```

---

## 4. Core Implementation

### 4.1 Notification API and Delivery Pipeline

```python
# Code example 1: Notification service entry point
from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel, validator
from enum import Enum
from typing import Optional
import uuid
import logging

app = FastAPI(title="Notification Service", version="2.0")
logger = logging.getLogger(__name__)

class Channel(str, Enum):
    PUSH = "push"
    EMAIL = "email"
    SMS = "sms"
    IN_APP = "in_app"
    WEB_PUSH = "web_push"

class Priority(str, Enum):
    CRITICAL = "critical"  # system failures, security
    HIGH = "high"          # payment completion, password change
    NORMAL = "normal"      # general notifications
    LOW = "low"            # marketing, recommendations

class NotificationRequest(BaseModel):
    user_ids: list[str]
    template_id: str
    channels: list[Channel]
    data: dict
    priority: Priority = Priority.NORMAL
    scheduled_at: Optional[str] = None
    idempotency_key: Optional[str] = None  # idempotency key
    category: str = "general"               # notification category

    @validator('user_ids')
    def validate_user_ids(cls, v):
        if len(v) == 0:
            raise ValueError("user_ids must not be empty")
        if len(v) > 10000:
            raise ValueError("user_ids must not exceed 10000")
        return v

class NotificationResponse(BaseModel):
    batch_id: str
    status: str
    total_recipients: int
    accepted: int
    rejected: int

class NotificationService:
    """
    Core orchestrator for the notification service.

    Responsibilities:
    1. Request validation
    2. Filtering based on user preferences
    3. Template rendering
    4. Deduplication
    5. Rate limit enforcement
    6. Enqueuing to channel-specific queues
    """

    def __init__(self, queue, user_service, template_service,
                 rate_limiter, dedup_service, metrics):
        self.queue = queue
        self.user_service = user_service
        self.template_service = template_service
        self.rate_limiter = rate_limiter
        self.dedup_service = dedup_service
        self.metrics = metrics

    async def send(self, request: NotificationRequest) -> NotificationResponse:
        batch_id = str(uuid.uuid4())
        accepted = 0
        rejected = 0

        # Idempotency check
        if request.idempotency_key:
            if await self.dedup_service.is_duplicate(request.idempotency_key):
                logger.info(f"Duplicate request: {request.idempotency_key}")
                raise HTTPException(status_code=409, detail="Duplicate request")

        for user_id in request.user_ids:
            try:
                result = await self._process_user(
                    batch_id, user_id, request
                )
                if result:
                    accepted += 1
                else:
                    rejected += 1
            except Exception as e:
                logger.error(f"Error processing user {user_id}: {e}")
                rejected += 1
                self.metrics.increment("notification.processing_error")

        # Record metrics
        self.metrics.increment("notification.batches_created")
        self.metrics.gauge("notification.batch_size", len(request.user_ids))

        return NotificationResponse(
            batch_id=batch_id,
            status="queued",
            total_recipients=len(request.user_ids),
            accepted=accepted,
            rejected=rejected,
        )

    async def _process_user(self, batch_id: str, user_id: str,
                             request: NotificationRequest) -> bool:
        """Process notification for an individual user"""

        # 1. Check user preferences (with cache)
        prefs = await self.user_service.get_preferences(user_id)
        if prefs is None:
            logger.warning(f"User not found: {user_id}")
            return False

        # 2. Check category settings
        if not prefs.is_category_enabled(request.category):
            return False

        # 3. Check Quiet Hours
        if prefs.is_quiet_hours():
            if request.priority not in (Priority.CRITICAL, Priority.HIGH):
                # Schedule low-priority notifications for after quiet hours
                await self._schedule_after_quiet_hours(
                    batch_id, user_id, request, prefs
                )
                return True

        channels_sent = 0
        for channel in request.channels:
            # 4. Check whether the user has this channel enabled
            if not prefs.is_channel_enabled(channel):
                continue

            # 5. Rate limit check
            if not await self.rate_limiter.allow(user_id, channel.value):
                self.metrics.increment("notification.rate_limited",
                                       tags={"channel": channel.value})
                continue

            # 6. Render template
            locale = prefs.locale or "en"
            content = await self.template_service.render(
                request.template_id, channel.value,
                request.data, locale=locale
            )

            # 7. Generate notification ID and deduplicate
            notification_id = f"{batch_id}:{user_id}:{channel.value}"
            if await self.dedup_service.is_duplicate(notification_id):
                continue

            # 8. Publish to message queue
            message = {
                "id": notification_id,
                "batch_id": batch_id,
                "user_id": user_id,
                "channel": channel.value,
                "content": content,
                "priority": request.priority.value,
                "category": request.category,
                "created_at": int(time.time()),
            }

            # Select queue based on priority
            topic = self._select_topic(channel, request.priority)
            await self.queue.publish(topic=topic, message=message)
            channels_sent += 1

        return channels_sent > 0

    def _select_topic(self, channel: Channel, priority: Priority) -> str:
        """Select the Kafka topic based on priority"""
        if priority == Priority.CRITICAL:
            return f"notifications.{channel.value}.critical"
        elif priority == Priority.HIGH:
            return f"notifications.{channel.value}.high"
        else:
            return f"notifications.{channel.value}.normal"

    async def _schedule_after_quiet_hours(self, batch_id, user_id,
                                           request, prefs):
        """Schedule delivery after Quiet Hours end"""
        send_at = prefs.get_quiet_hours_end_utc()
        await self.queue.publish(
            topic="notifications.scheduled",
            message={
                "batch_id": batch_id,
                "user_id": user_id,
                "request": request.dict(),
                "scheduled_at": send_at.isoformat(),
            }
        )

@app.post("/api/v1/notifications", response_model=NotificationResponse)
async def create_notification(request: NotificationRequest):
    """Notification creation API endpoint"""
    service = get_notification_service()  # obtained from DI container
    return await service.send(request)

@app.get("/api/v1/notifications/{batch_id}/status")
async def get_batch_status(batch_id: str):
    """Get delivery status for a batch"""
    stats = await get_batch_statistics(batch_id)
    return {
        "batch_id": batch_id,
        "total": stats["total"],
        "delivered": stats["delivered"],
        "failed": stats["failed"],
        "pending": stats["pending"],
        "delivery_rate": stats["delivered"] / max(stats["total"], 1),
    }
```

### 4.2 Channel Adapters (Strategy Pattern)

```python
# Code example 2: Unified interface for channel adapters
import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

@dataclass
class DeliveryResult:
    """Unified representation of delivery results"""
    success: bool
    provider_message_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    should_retry: bool = False

class ChannelAdapter(ABC):
    """
    Common interface for all channels (Strategy pattern).

    To add a new channel, simply subclass this and implement
    the send() method.
    Follows the Open/Closed Principle (OCP).
    """

    @abstractmethod
    async def send(self, user_id: str, content: dict,
                   metadata: dict) -> DeliveryResult:
        pass

    @abstractmethod
    async def validate_target(self, user_id: str) -> bool:
        """Verify the delivery target is valid (token validity, etc.)"""
        pass

class APNsAdapter(ChannelAdapter):
    """Apple Push Notification service adapter"""

    def __init__(self, team_id: str, key_id: str, private_key: str,
                 bundle_id: str, use_sandbox: bool = False):
        self.team_id = team_id
        self.key_id = key_id
        self.private_key = private_key
        self.bundle_id = bundle_id
        self.base_url = (
            "https://api.sandbox.push.apple.com"
            if use_sandbox else
            "https://api.push.apple.com"
        )
        self._jwt_token = None
        self._jwt_expiry = 0

    async def send(self, user_id: str, content: dict,
                   metadata: dict) -> DeliveryResult:
        devices = await get_user_devices(user_id, platform="ios")
        if not devices:
            return DeliveryResult(success=False, error_code="NO_DEVICE")

        results = []
        for device in devices:
            result = await self._send_to_device(device, content, metadata)
            results.append(result)

            # Immediately invalidate tokens that are no longer valid
            if result.error_code == "INVALID_TOKEN":
                await invalidate_device_token(device["token_id"])

        # Return success if at least one device succeeded
        return DeliveryResult(
            success=any(r.success for r in results),
            should_retry=all(r.should_retry for r in results),
        )

    async def _send_to_device(self, device: dict, content: dict,
                                metadata: dict) -> DeliveryResult:
        token = await self._get_jwt_token()
        payload = {
            "aps": {
                "alert": {
                    "title": content.get("title", ""),
                    "body": content.get("body", ""),
                    "subtitle": content.get("subtitle", ""),
                },
                "badge": metadata.get("badge", 1),
                "sound": metadata.get("sound", "default"),
                "category": metadata.get("action_category", ""),
                "mutable-content": 1,  # Notification Service Extension
                "thread-id": metadata.get("thread_id", ""),
            },
            "custom_data": content.get("data", {}),
        }

        # Send to APNs over HTTP/2
        headers = {
            "authorization": f"bearer {token}",
            "apns-topic": self.bundle_id,
            "apns-priority": "10" if metadata.get("priority") == "high" else "5",
            "apns-push-type": "alert",
            "apns-expiration": str(int(time.time()) + 86400),
        }

        try:
            response = await self.http_client.post(
                f"{self.base_url}/3/device/{device['device_token']}",
                json=payload,
                headers=headers,
                timeout=10,
            )

            if response.status_code == 200:
                return DeliveryResult(
                    success=True,
                    provider_message_id=response.headers.get("apns-id"),
                )
            elif response.status_code == 410:
                return DeliveryResult(
                    success=False,
                    error_code="INVALID_TOKEN",
                    error_message="Device token is no longer active",
                    should_retry=False,
                )
            elif response.status_code in (500, 503):
                return DeliveryResult(
                    success=False,
                    error_code="PROVIDER_ERROR",
                    error_message=f"APNs returned {response.status_code}",
                    should_retry=True,
                )
            else:
                body = response.json()
                return DeliveryResult(
                    success=False,
                    error_code=body.get("reason", "UNKNOWN"),
                    error_message=str(body),
                    should_retry=False,
                )
        except asyncio.TimeoutError:
            return DeliveryResult(
                success=False,
                error_code="TIMEOUT",
                should_retry=True,
            )

    async def validate_target(self, user_id: str) -> bool:
        devices = await get_user_devices(user_id, platform="ios")
        return len(devices) > 0

class FCMAdapter(ChannelAdapter):
    """Firebase Cloud Messaging adapter"""

    async def send(self, user_id: str, content: dict,
                   metadata: dict) -> DeliveryResult:
        devices = await get_user_devices(user_id, platform="android")
        if not devices:
            return DeliveryResult(success=False, error_code="NO_DEVICE")

        for device in devices:
            message = {
                "message": {
                    "token": device["device_token"],
                    "notification": {
                        "title": content.get("title", ""),
                        "body": content.get("body", ""),
                        "image": content.get("image_url"),
                    },
                    "data": {k: str(v) for k, v in content.get("data", {}).items()},
                    "android": {
                        "priority": "high" if metadata.get("priority") == "high" else "normal",
                        "notification": {
                            "channel_id": metadata.get("android_channel", "default"),
                            "click_action": metadata.get("click_action", ""),
                        },
                    },
                }
            }

            try:
                response = await self.http_client.post(
                    f"https://fcm.googleapis.com/v1/projects/{self.project_id}/messages:send",
                    json=message,
                    headers={"authorization": f"Bearer {await self._get_access_token()}"},
                    timeout=10,
                )

                if response.status_code == 200:
                    result = response.json()
                    return DeliveryResult(
                        success=True,
                        provider_message_id=result.get("name"),
                    )
                elif response.status_code == 404:
                    await invalidate_device_token(device["token_id"])
                    return DeliveryResult(
                        success=False,
                        error_code="INVALID_TOKEN",
                        should_retry=False,
                    )
                else:
                    return DeliveryResult(
                        success=False,
                        error_code=f"FCM_{response.status_code}",
                        should_retry=response.status_code >= 500,
                    )
            except asyncio.TimeoutError:
                return DeliveryResult(
                    success=False, error_code="TIMEOUT", should_retry=True
                )

        return DeliveryResult(success=False, error_code="ALL_FAILED")

    async def validate_target(self, user_id: str) -> bool:
        devices = await get_user_devices(user_id, platform="android")
        return len(devices) > 0

class EmailAdapter(ChannelAdapter):
    """Email delivery adapter (supports SES / SendGrid)"""

    async def send(self, user_id: str, content: dict,
                   metadata: dict) -> DeliveryResult:
        email = await get_user_email(user_id)
        if not email:
            return DeliveryResult(success=False, error_code="NO_EMAIL")

        ses_message = {
            "Source": metadata.get("from_email", "noreply@example.com"),
            "Destination": {"ToAddresses": [email]},
            "Message": {
                "Subject": {"Data": content.get("subject", "")},
                "Body": {
                    "Html": {"Data": content.get("html_body", "")},
                    "Text": {"Data": content.get("text_body", content.get("body", ""))},
                },
            },
            "Tags": [
                {"Name": "category", "Value": metadata.get("category", "general")},
                {"Name": "batch_id", "Value": metadata.get("batch_id", "")},
            ],
        }

        try:
            response = await self.ses_client.send_email(**ses_message)
            return DeliveryResult(
                success=True,
                provider_message_id=response["MessageId"],
            )
        except self.ses_client.exceptions.MessageRejected as e:
            return DeliveryResult(
                success=False,
                error_code="REJECTED",
                error_message=str(e),
                should_retry=False,
            )
        except Exception as e:
            return DeliveryResult(
                success=False,
                error_code="SES_ERROR",
                error_message=str(e),
                should_retry=True,
            )

    async def validate_target(self, user_id: str) -> bool:
        email = await get_user_email(user_id)
        return email is not None and await is_email_valid(email)

class SMSAdapter(ChannelAdapter):
    """SMS delivery adapter (supports Twilio)"""

    async def send(self, user_id: str, content: dict,
                   metadata: dict) -> DeliveryResult:
        phone = await get_user_phone(user_id)
        if not phone:
            return DeliveryResult(success=False, error_code="NO_PHONE")

        try:
            message = await self.twilio_client.messages.create_async(
                body=content.get("body", ""),
                from_=self.from_number,
                to=phone,
                status_callback=f"{self.callback_base_url}/sms/status",
            )
            return DeliveryResult(
                success=True,
                provider_message_id=message.sid,
            )
        except Exception as e:
            return DeliveryResult(
                success=False,
                error_code="TWILIO_ERROR",
                error_message=str(e),
                should_retry="temporarily" in str(e).lower(),
            )

    async def validate_target(self, user_id: str) -> bool:
        phone = await get_user_phone(user_id)
        return phone is not None
```

### 4.3 Worker and Retry Processing

```python
# Code example 3: Retry strategy for notification workers
import asyncio
import time
import json
from dataclasses import dataclass

@dataclass
class RetryConfig:
    """Per-channel retry configuration"""
    max_retries: int
    base_delay: float       # seconds
    max_delay: float        # seconds
    backoff_factor: float   # exponential backoff factor

# Optimal retry settings per channel
RETRY_CONFIGS = {
    "push": RetryConfig(max_retries=3, base_delay=1.0, max_delay=60.0, backoff_factor=2.0),
    "email": RetryConfig(max_retries=5, base_delay=5.0, max_delay=300.0, backoff_factor=3.0),
    "sms": RetryConfig(max_retries=2, base_delay=10.0, max_delay=60.0, backoff_factor=2.0),
    "in_app": RetryConfig(max_retries=3, base_delay=1.0, max_delay=30.0, backoff_factor=2.0),
}

class NotificationWorker:
    """
    Worker that consumes messages from Kafka and delivers notifications.

    Retry strategy:
    - Exponential backoff + jitter
    - Per-channel maximum retry count
    - Move to DLQ (Dead Letter Queue) on max retry exceeded
    - DLQ messages trigger alerts and manual intervention
    """

    def __init__(self, channel: str, adapter: ChannelAdapter,
                 consumer, dlq_producer, metrics):
        self.channel = channel
        self.adapter = adapter
        self.consumer = consumer
        self.dlq_producer = dlq_producer
        self.metrics = metrics
        self.retry_config = RETRY_CONFIGS.get(
            channel, RetryConfig(3, 1.0, 60.0, 2.0)
        )

    async def run(self):
        """Main loop: continuously consume messages from Kafka"""
        async for message in self.consumer:
            try:
                await self._process_message(json.loads(message.value))
                await self.consumer.commit()
            except Exception as e:
                logger.error(f"Unexpected error: {e}", exc_info=True)
                self.metrics.increment("worker.unexpected_error")

    async def _process_message(self, message: dict):
        """Process a message and handle retries"""
        notification_id = message["id"]
        retry_count = message.get("retry_count", 0)
        start_time = time.time()

        # Attempt delivery
        result = await self.adapter.send(
            user_id=message["user_id"],
            content=message["content"],
            metadata={
                "priority": message.get("priority"),
                "batch_id": message.get("batch_id"),
                "category": message.get("category"),
            },
        )

        # Record metrics
        latency = time.time() - start_time
        self.metrics.histogram(
            "notification.delivery_latency",
            latency,
            tags={"channel": self.channel, "success": str(result.success)},
        )

        if result.success:
            # Delivery succeeded
            await self._record_delivery(notification_id, result)
            self.metrics.increment(
                "notification.delivered",
                tags={"channel": self.channel},
            )
        elif result.should_retry and retry_count < self.retry_config.max_retries:
            # Retry
            delay = self._calculate_delay(retry_count)
            message["retry_count"] = retry_count + 1
            await self._schedule_retry(message, delay)
            self.metrics.increment(
                "notification.retry",
                tags={"channel": self.channel, "attempt": str(retry_count + 1)},
            )
        else:
            # Move to DLQ
            await self._send_to_dlq(message, result)
            self.metrics.increment(
                "notification.dead_lettered",
                tags={"channel": self.channel},
            )

    def _calculate_delay(self, retry_count: int) -> float:
        """Calculate retry interval using exponential backoff + jitter"""
        import random
        delay = min(
            self.retry_config.base_delay * (self.retry_config.backoff_factor ** retry_count),
            self.retry_config.max_delay,
        )
        # Jitter: random variation of 0.5x to 1.5x
        jitter = delay * (0.5 + random.random())
        return jitter

    async def _schedule_retry(self, message: dict, delay: float):
        """Schedule re-enqueue into the retry queue"""
        await asyncio.sleep(delay)  # simple implementation; use a delay queue in production
        topic = f"notifications.{self.channel}.retry"
        await self.dlq_producer.send(topic, json.dumps(message).encode())

    async def _send_to_dlq(self, message: dict, result: DeliveryResult):
        """Move to Dead Letter Queue"""
        dlq_message = {
            **message,
            "dlq_reason": result.error_code,
            "dlq_error": result.error_message,
            "dlq_timestamp": int(time.time()),
        }
        topic = f"notifications.{self.channel}.dlq"
        await self.dlq_producer.send(topic, json.dumps(dlq_message).encode())

        # Emit alert
        if message.get("priority") in ("critical", "high"):
            await send_alert(
                f"High priority notification failed: {message['id']}",
                severity="warning",
            )

    async def _record_delivery(self, notification_id: str,
                                result: DeliveryResult):
        """Record delivery result in DB"""
        await update_notification_status(
            notification_id=notification_id,
            status="delivered",
            provider_message_id=result.provider_message_id,
            delivered_at=int(time.time()),
        )
```

### 4.4 Rate Limiting

```python
# Code example 4: Rate limiting using a sliding window
import time
import redis.asyncio as redis

class NotificationRateLimiter:
    """
    Per-user, per-channel notification rate limiter.

    WHY: Reasons rate limiting is necessary
    1. User experience protection: excessive notifications lead to app uninstalls
    2. Provider limit compliance: APNs/FCM also impose rate limits
    3. Cost control: SMS is billed per message
    4. Legal compliance: CAN-SPAM Act, anti-spam email laws, etc.

    Algorithm: Sliding Window (Redis Sorted Set)
    - Avoids the "boundary problem" of Fixed Window
    - Accurate counting with O(log N) complexity
    - Atomic Redis operations prevent race conditions
    """

    # Default rate limit settings
    DEFAULT_LIMITS = {
        "push":     {"per_hour": 10, "per_day": 50},
        "email":    {"per_hour": 3,  "per_day": 10},
        "sms":      {"per_hour": 2,  "per_day": 5},
        "in_app":   {"per_hour": 20, "per_day": 100},
        "web_push": {"per_hour": 8,  "per_day": 40},
    }

    # Limit multipliers per priority
    PRIORITY_MULTIPLIERS = {
        "critical": float('inf'),  # no limit
        "high": 5.0,
        "normal": 1.0,
        "low": 0.5,
    }

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def allow(self, user_id: str, channel: str,
                    priority: str = "normal") -> bool:
        """Determine whether a notification is allowed to be sent"""
        # Always allow critical
        if priority == "critical":
            return True

        # Apply user custom limits if available
        custom_limits = await self._get_custom_limits(user_id, channel)
        limits = custom_limits or self.DEFAULT_LIMITS.get(
            channel, {"per_hour": 10, "per_day": 50}
        )

        # Apply priority multiplier
        multiplier = self.PRIORITY_MULTIPLIERS.get(priority, 1.0)
        effective_hour = int(limits["per_hour"] * multiplier)
        effective_day = int(limits["per_day"] * multiplier)

        now = time.time()

        # Atomically check and record using Lua script
        result = await self._check_and_record(
            user_id, channel, now, effective_hour, effective_day
        )
        return result

    LUA_RATE_CHECK = """
    local hour_key = KEYS[1]
    local day_key = KEYS[2]
    local now = tonumber(ARGV[1])
    local hour_limit = tonumber(ARGV[2])
    local day_limit = tonumber(ARGV[3])

    -- Remove old entries
    redis.call('ZREMRANGEBYSCORE', hour_key, 0, now - 3600)
    redis.call('ZREMRANGEBYSCORE', day_key, 0, now - 86400)

    -- Check current count
    local hour_count = redis.call('ZCARD', hour_key)
    local day_count = redis.call('ZCARD', day_key)

    if hour_count >= hour_limit or day_count >= day_limit then
        return 0  -- deny
    end

    -- Record the count
    local member = now .. ':' .. math.random(1000000)
    redis.call('ZADD', hour_key, now, member)
    redis.call('ZADD', day_key, now, member)
    redis.call('EXPIRE', hour_key, 3600)
    redis.call('EXPIRE', day_key, 86400)

    return 1  -- allow
    """

    async def _check_and_record(self, user_id: str, channel: str,
                                 now: float, hour_limit: int,
                                 day_limit: int) -> bool:
        """Atomically check rate limit using Lua script"""
        hour_key = f"ratelimit:{user_id}:{channel}:hour"
        day_key = f"ratelimit:{user_id}:{channel}:day"

        result = await self.redis.eval(
            self.LUA_RATE_CHECK,
            2,  # number of KEYS
            hour_key, day_key,
            now, hour_limit, day_limit,
        )
        return bool(result)

    async def _get_custom_limits(self, user_id: str,
                                  channel: str) -> dict | None:
        """Retrieve user-defined custom rate limit settings"""
        key = f"user_prefs:{user_id}"
        data = await self.redis.hget(key, "frequency_limit")
        if data:
            import json
            limits = json.loads(data)
            return limits.get(channel)
        return None

    async def get_remaining(self, user_id: str, channel: str) -> dict:
        """Get remaining quota (for API responses)"""
        limits = self.DEFAULT_LIMITS.get(channel, {"per_hour": 10, "per_day": 50})
        now = time.time()

        hour_key = f"ratelimit:{user_id}:{channel}:hour"
        day_key = f"ratelimit:{user_id}:{channel}:day"

        pipe = self.redis.pipeline()
        pipe.zrangebyscore(hour_key, now - 3600, now)
        pipe.zrangebyscore(day_key, now - 86400, now)
        hour_entries, day_entries = await pipe.execute()

        return {
            "hour": {
                "limit": limits["per_hour"],
                "remaining": max(0, limits["per_hour"] - len(hour_entries)),
                "reset": int(now) + 3600,
            },
            "day": {
                "limit": limits["per_day"],
                "remaining": max(0, limits["per_day"] - len(day_entries)),
                "reset": int(now) + 86400,
            },
        }
```

### 4.5 Deduplication Service

```python
# Code example 5: Preventing duplicate notifications using idempotency keys
import hashlib
import json

class DeduplicationService:
    """
    Service that prevents duplicate notifications from being sent.

    WHY: Reasons deduplication is necessary

    1. At-least-once delivery in event-driven architecture
       → The same event may be processed multiple times
    2. Kafka consumer rebalancing
       → Rebalance before offset commit causes reprocessing
    3. Duplicate user actions
       → Double-clicking the "Submit" button
    4. Retries between microservices
       → HTTP timeout triggers retry → the original actually succeeded

    Implementation comparison:
    +------------------+----------+---------+--------+
    | Method           | Memory   | Accuracy| Speed  |
    +------------------+----------+---------+--------+
    | Redis SETNX      | Medium   | High    | High   | ← adopted
    | Bloom Filter     | Low      | Approx. | Highest|
    | DB Unique Key    | High     | Highest | Low    |
    +------------------+----------+---------+--------+
    """

    def __init__(self, redis_client, ttl: int = 86400):
        self.redis = redis_client
        self.ttl = ttl  # default 24 hours

    async def is_duplicate(self, key: str) -> bool:
        """Check whether this key has already been processed"""
        dedup_key = f"dedup:{self._hash_key(key)}"
        result = await self.redis.set(dedup_key, "1", nx=True, ex=self.ttl)
        return result is None  # None = already exists = duplicate

    async def is_duplicate_content(self, user_id: str, channel: str,
                                    content_hash: str,
                                    window_seconds: int = 300) -> bool:
        """
        Check whether the same notification content was sent recently.

        Example: prevent the same "order confirmed" notification
        from being sent twice within 5 minutes.
        """
        key = f"dedup:content:{user_id}:{channel}:{content_hash}"
        result = await self.redis.set(key, "1", nx=True, ex=window_seconds)
        return result is None

    @staticmethod
    def compute_content_hash(content: dict) -> str:
        """Compute a hash of the notification content"""
        serialized = json.dumps(content, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(serialized.encode()).hexdigest()[:16]

    async def mark_sent(self, notification_id: str, channel: str):
        """Record that a notification has been sent (for delivery tracking)"""
        key = f"sent:{notification_id}:{channel}"
        await self.redis.set(key, "1", ex=self.ttl)

    async def was_sent(self, notification_id: str, channel: str) -> bool:
        """Check whether a notification has already been sent (idempotency check on retry)"""
        key = f"sent:{notification_id}:{channel}"
        return await self.redis.exists(key) > 0

    @staticmethod
    def _hash_key(key: str) -> str:
        """Hash long keys to save Redis memory"""
        if len(key) > 64:
            return hashlib.sha256(key.encode()).hexdigest()
        return key
```

### 4.6 Template Engine

```python
# Code example 6: Multi-language, multi-channel template service
from jinja2 import Environment, BaseLoader, TemplateSyntaxError
from typing import Optional
import json

class NotificationTemplateService:
    """
    Service for managing and rendering notification templates.

    Design points:
    1. Templates are managed in DB and accelerated via cache
    2. Different templates for each channel
    3. Multilingual support (locale-based fallback)
    4. Template versioning (rollback capable)
    5. Variant management for A/B testing
    """

    def __init__(self, db, cache, metrics):
        self.db = db
        self.cache = cache
        self.metrics = metrics
        self.env = Environment(loader=BaseLoader())

    async def render(self, template_id: str, channel: str,
                      data: dict, locale: str = "en",
                      variant: Optional[str] = None) -> dict:
        """Render a template and produce delivery content"""

        # 1. Fetch template from cache
        cache_key = f"template:{template_id}:{channel}:{locale}"
        if variant:
            cache_key += f":{variant}"

        template_data = await self.cache.get(cache_key)

        if not template_data:
            # 2. Load from DB (with fallback)
            template_data = await self._load_template(
                template_id, channel, locale, variant
            )
            if template_data:
                await self.cache.set(cache_key, json.dumps(template_data), ex=3600)
            else:
                self.metrics.increment("template.not_found")
                raise TemplateNotFoundError(
                    f"Template not found: {template_id}/{channel}/{locale}"
                )
        else:
            template_data = json.loads(template_data)

        # 3. Render with Jinja2
        try:
            rendered = {}
            for key, template_str in template_data.items():
                template = self.env.from_string(template_str)
                rendered[key] = template.render(**data)
            return rendered
        except TemplateSyntaxError as e:
            self.metrics.increment("template.render_error")
            raise TemplateRenderError(f"Template render failed: {e}")

    async def _load_template(self, template_id: str, channel: str,
                               locale: str, variant: Optional[str]) -> dict:
        """
        Load template from DB. Fallback chain:
        1. Specified locale + variant
        2. Specified locale (no variant)
        3. Default locale (en)
        """
        for try_locale in [locale, "en"]:
            result = await self.db.fetch_one(
                """
                SELECT title, subject, body, metadata
                FROM notification_templates
                WHERE template_id = :template_id
                  AND channel = :channel
                  AND locale = :locale
                  AND is_active = TRUE
                ORDER BY version DESC
                LIMIT 1
                """,
                {
                    "template_id": template_id,
                    "channel": channel,
                    "locale": try_locale,
                },
            )
            if result:
                template = {}
                if result["title"]:
                    template["title"] = result["title"]
                if result["subject"]:
                    template["subject"] = result["subject"]
                if result["body"]:
                    template["body"] = result["body"]
                return template

        return None

    async def create_template(self, template_id: str, channel: str,
                                locale: str, content: dict,
                                created_by: str) -> int:
        """Create a new version of a template"""
        # Get the current latest version
        current = await self.db.fetch_one(
            "SELECT MAX(version) as ver FROM notification_templates "
            "WHERE template_id = :tid AND channel = :ch AND locale = :lo",
            {"tid": template_id, "ch": channel, "lo": locale},
        )
        new_version = (current["ver"] or 0) + 1

        await self.db.execute(
            """
            INSERT INTO notification_templates
            (template_id, version, channel, locale, title, subject, body, metadata)
            VALUES (:tid, :ver, :ch, :lo, :title, :subject, :body, :meta)
            """,
            {
                "tid": template_id,
                "ver": new_version,
                "ch": channel,
                "lo": locale,
                "title": content.get("title"),
                "subject": content.get("subject"),
                "body": content.get("body"),
                "meta": json.dumps({"created_by": created_by}),
            },
        )

        # Invalidate cache
        cache_key = f"template:{template_id}:{channel}:{locale}"
        await self.cache.delete(cache_key)

        return new_version

class TemplateNotFoundError(Exception):
    pass

class TemplateRenderError(Exception):
    pass
```

### 4.7 Notification Batch Aggregation

```python
# Code example 7: Intelligent aggregation of similar notifications
import asyncio
import json
from collections import defaultdict

class NotificationAggregator:
    """
    Service for batch-aggregating similar notifications.

    Example: "A liked your post" + "B liked your post" + "C liked your post"
    → "A, B, and 1 other liked your post"

    Design:
    - Uses a Redis List as a buffer
    - Flushes after a fixed time window (5 min) or a fixed count (10 items)
    - Aggregates per user × category
    """

    AGGREGATION_WINDOW = 300  # 5 minutes
    MAX_BATCH_SIZE = 10       # maximum aggregation count

    def __init__(self, redis_client, notification_service):
        self.redis = redis_client
        self.notification_service = notification_service

    async def add(self, user_id: str, category: str,
                  notification: dict) -> bool:
        """
        Add a notification to the buffer. Flush when threshold is reached.

        Returns:
            True: added to buffer (will be sent later in bulk)
            False: not eligible for aggregation (send immediately)
        """
        # Check if the category is eligible for aggregation
        if category not in self.AGGREGATABLE_CATEGORIES:
            return False

        key = f"batch:{user_id}:{category}"

        pipe = self.redis.pipeline()
        pipe.rpush(key, json.dumps(notification))
        pipe.expire(key, self.AGGREGATION_WINDOW)
        pipe.llen(key)
        results = await pipe.execute()

        current_count = results[2]

        # Immediately flush when max aggregation count is reached
        if current_count >= self.MAX_BATCH_SIZE:
            await self.flush(user_id, category)

        return True

    async def flush(self, user_id: str, category: str):
        """Send all buffered notifications together"""
        key = f"batch:{user_id}:{category}"

        # Atomically retrieve and delete
        pipe = self.redis.pipeline()
        pipe.lrange(key, 0, -1)
        pipe.delete(key)
        results = await pipe.execute()

        raw_notifications = results[0]
        if not raw_notifications:
            return

        notifications = [json.loads(n) for n in raw_notifications]

        # Generate aggregated message
        aggregated_content = self._aggregate_content(category, notifications)

        # Send aggregated notification
        await self.notification_service.send_aggregated(
            user_id=user_id,
            content=aggregated_content,
            original_count=len(notifications),
        )

    def _aggregate_content(self, category: str,
                            notifications: list) -> dict:
        """Aggregate notification content and generate a summary"""
        if category == "like":
            actors = [n["data"]["actor_name"] for n in notifications]
            if len(actors) <= 3:
                names = ", ".join(actors)
            else:
                names = f"{actors[0]}, {actors[1]}, and {len(actors)-2} others"
            return {
                "title": "Like Notification",
                "body": f"{names} liked your post",
                "data": {
                    "type": "like_aggregated",
                    "count": len(notifications),
                    "actor_ids": [n["data"]["actor_id"] for n in notifications],
                },
            }
        elif category == "follow":
            actors = [n["data"]["actor_name"] for n in notifications]
            if len(actors) <= 3:
                names = ", ".join(actors)
            else:
                names = f"{actors[0]}, {actors[1]}, and {len(actors)-2} others"
            return {
                "title": "Follow Notification",
                "body": f"{names} followed you",
                "data": {
                    "type": "follow_aggregated",
                    "count": len(notifications),
                },
            }
        else:
            return {
                "title": f"{len(notifications)} Notifications",
                "body": f"You have {len(notifications)} new notifications about {category}",
            }

    AGGREGATABLE_CATEGORIES = {"like", "follow", "comment", "mention"}

    async def flush_all_expired(self):
        """
        Periodic execution: bulk flush of expired buffers.
        Run by a cron job every 1 minute.
        """
        cursor = 0
        while True:
            cursor, keys = await self.redis.scan(
                cursor, match="batch:*", count=1000
            )
            for key in keys:
                ttl = await self.redis.ttl(key)
                if ttl < 0 or ttl < self.AGGREGATION_WINDOW * 0.1:
                    # Flush buffers with little TTL remaining
                    parts = key.decode().split(":")
                    if len(parts) == 3:
                        await self.flush(parts[1], parts[2])
            if cursor == 0:
                break
```

---

## 5. Reliability Design

### 5.1 Overall Retry Strategy

```
Notification Delivery Retry Flow

  [Notification Worker]
       |
       v
  Delivery attempt ──success──> [Record delivery] → Done
       |
     failure
       |
       v
  Retryable? ──No──> [DLQ] → Alert → Manual intervention
       |
      Yes
       |
       v
  Retry count < max? ──No──> [DLQ]
       |
      Yes
       |
       v
  Wait with exponential backoff + jitter
       |
       v
  Enqueue into retry queue
       |
       v
  [Notification Worker] (loop)


  Per-channel retry settings:
  +----------+----------+-----------+----------+-------------------+
  | Channel  | Max retry| Init delay| Max delay| Reason            |
  +----------+----------+-----------+----------+-------------------+
  | Push     | 3        | 1s        | 60s      | Device offline    |
  | Email    | 5        | 5s        | 300s     | SMTP transient    |
  | SMS      | 2        | 10s       | 60s      | High cost         |
  | In-App   | 3        | 1s        | 30s      | Connection lost   |
  | Web Push | 3        | 2s        | 120s     | Browser offline   |
  +----------+----------+-----------+----------+-------------------+

  Exponential backoff formula:
    delay = min(base_delay * backoff_factor^attempt, max_delay)
    jitter = delay * (0.5 + random())
    actual_delay = jitter

  Example (Push, base=1s, factor=2):
    Attempt 0: 1s  * (0.5~1.5) = 0.5~1.5s
    Attempt 1: 2s  * (0.5~1.5) = 1.0~3.0s
    Attempt 2: 4s  * (0.5~1.5) = 2.0~6.0s
    → failure → DLQ
```

### 5.2 Failure Isolation Pattern

```
Failure Isolation Between Channels

  Problem: SMS provider (Twilio) goes down

  [Bad design: single queue]
  +-----+     +--------+     +----------+
  | All | --> | Single | --> | Workers  | → SMS stalls
  | Msg | --> | Queue  | --> | (mixed)  |   → Push/Email also blocked
  +-----+     +--------+     +----------+

  [Good design: channel isolation]
  +-----+     +--------+     +----------+
  | Msg | --> | Push Q | --> | Push W   | → Working normally
  +-----+     +--------+     +----------+
              +--------+     +----------+
              | Email Q| --> | Email W  | → Working normally
              +--------+     +----------+
              +--------+     +----------+
              | SMS Q  | --> | SMS W    | → Failure (isolated)
              +--------+     +----------+

  Further isolation by priority:
  +--------+     +---------+     +------------+
  | Push   | --> | High Q  | --> | High W (4) | ← more workers
  +--------+     +---------+     +------------+
              +-> | Normal Q| --> | Normal W(2)|
              |   +---------+     +------------+
              +-> | Low Q   | --> | Low W (1)  | ← fewer workers
                  +---------+     +------------+

  Circuit breaker:
  [SMS Worker] ---> [Twilio API]
       |                 |
       |            Failure detected (5 consecutive failures)
       |                 |
       v                 v
  [Circuit OPEN] ← Circuit breaker triggered
       |           (SMS sends paused for 60 seconds)
       |
       v
  [Half-Open] → Test send → Success → [Circuit CLOSED]
                              → Failure → [Circuit OPEN] (wait again)
```

### 5.3 Delivery Guarantee Levels

```
Notification types and their delivery guarantee mapping:

+-------------------+----------+--------------------+------------------+
| Notification type | Guarantee| Delivery strategy  | Examples         |
+-------------------+----------+--------------------+------------------+
| Security          | Highest  | Multi-channel      | 2FA code         |
|                   |          | simultaneous +     | Unauthorized     |
|                   |          | ack required       | access detected  |
+-------------------+----------+--------------------+------------------+
| Transactional     | High     | With fallback      | Payment complete |
|                   |          | Push→Email→SMS     | Shipment notice  |
+-------------------+----------+--------------------+------------------+
| Social            | Medium   | Single best channel| Like             |
|                   |          | Aggregation OK     | Comment          |
+-------------------+----------+--------------------+------------------+
| Marketing         | Low      | Best effort        | Campaign         |
|                   |          | No retry           | Recommendation   |
+-------------------+----------+--------------------+------------------+

Multi-channel fallback strategy:

  [Security notification "2FA code"]
       |
       v
  Send Push → Opened within 30s? → Yes → Done
       |                         → No
       v
  Send SMS → Delivered within 60s? → Yes → Done
       |                            → No
       v
  Voice call → Read code aloud → Done
```

---

## 6. Notification Channel Comparison

| Channel | Reach rate | Latency | Cost/msg | Character limit | Rich content | Use cases |
|---------|--------|------|----------|-----------|---------------|-------------|
| iOS Push (APNs) | High (85-95%) | < 1s | Free | 4KB | Images, actions | Real-time alerts |
| Android Push (FCM) | High (85-95%) | < 1s | Free | 4KB | Images, actions | Real-time alerts |
| Email | Medium (60-80%) | Seconds-minutes | ~$0.001 | Unlimited | HTML, attachments | Detailed notices, reports |
| SMS | Very high (98%+) | < 3s | ~$0.05 | 160 chars (70 multibyte) | None | 2FA, critical alerts |
| In-App | Very high (when active) | Instant | Free | Unlimited | Flexible | UX guidance, promotions |
| Web Push | Medium (40-60%) | < 2s | Free | Limited | Images | Browser users |

| Feature | APNs | FCM | Comparison notes |
|------|------|-----|-------------|
| Protocol | HTTP/2 | HTTP/1.1 REST | APNs requires HTTP/2 |
| Auth | JWT (P8 key) | OAuth 2.0 (service account) | FCM integrates with Google Cloud |
| Payload limit | 4KB | 4KB | Equivalent |
| Topic sending | Supported | Supported | Both supported |
| Silent push | content-available | data message | Background updates |
| Priority control | 5 (low) / 10 (high) | normal / high | Battery life consideration |
| Feedback | HTTP response + 410 | HTTP response + 404 | Different methods for invalid token detection |
| Rate limit | Undisclosed (est. ~2000/s) | Unofficial (est. ~1000/s) | Watch for burst traffic |

---

## 7. Monitoring and Observability

### 7.1 Key Metrics

```
Notification System Monitoring Dashboard Design

[Delivery Metrics]
  - notification_sent_total{channel, priority, status}
  - notification_delivery_latency{channel, percentile}
  - notification_retry_total{channel, attempt}
  - notification_dead_lettered_total{channel, error_code}

[Business Metrics]
  - notification_open_rate{channel, category}    -- open rate
  - notification_click_rate{channel, category}   -- click rate
  - notification_unsubscribe_rate{channel}       -- unsubscribe rate
  - notification_opt_out_rate{channel}           -- opt-out rate

[Infrastructure Metrics]
  - kafka_consumer_lag{topic, consumer_group}    -- queue backlog
  - worker_processing_rate{channel}              -- processing rate
  - redis_memory_usage                           -- Redis memory
  - provider_api_latency{provider}               -- provider latency
  - provider_error_rate{provider}                -- provider error rate

[Alert Conditions]
  CRITICAL:
    - Delivery success rate < 90% (over 5 minutes)
    - Queue backlog > 100,000 messages
    - DLQ messages > 1,000/hour
    - Provider API error rate > 50%

  WARNING:
    - Delivery latency p99 > 30s
    - Rate limit rejection rate > 20%
    - Unsubscribe rate > 200% of previous day
```

### 7.2 Delivery Tracking Implementation

```python
# Code example 8: Delivery event tracking pipeline
from datetime import datetime

class DeliveryTracker:
    """
    Tracks the delivery lifecycle of notifications.

    Event flow:
    SENT → DELIVERED → OPENED → CLICKED
                    → BOUNCED
                    → COMPLAINED
    """

    def __init__(self, event_store, analytics_producer):
        self.event_store = event_store
        self.analytics_producer = analytics_producer

    async def track_event(self, notification_id: str, event_type: str,
                           metadata: dict = None):
        """Record a delivery event"""
        event = {
            "notification_id": notification_id,
            "event_type": event_type,  # sent, delivered, opened, clicked, ...
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
        }

        # 1. Record in event store (persistence)
        await self.event_store.append(event)

        # 2. Send to analytics Kafka topic
        await self.analytics_producer.send(
            topic="notification-events",
            value=event,
        )

        # 3. Update real-time metrics
        metrics.increment(
            f"notification.{event_type}",
            tags={"channel": metadata.get("channel", "unknown")},
        )

    async def track_email_webhook(self, webhook_data: dict):
        """
        Process webhooks from email providers (SES/SendGrid).

        For SES:
        - Delivery: delivery succeeded
        - Bounce: bounce (invalid address)
        - Complaint: complaint (spam report)
        - Open: opened (tracking pixel)
        - Click: clicked (link redirect)
        """
        event_type_map = {
            "Delivery": "delivered",
            "Bounce": "bounced",
            "Complaint": "complained",
            "Open": "opened",
            "Click": "clicked",
        }

        ses_event = webhook_data.get("eventType", "")
        mapped_type = event_type_map.get(ses_event)

        if mapped_type:
            notification_id = webhook_data.get("mail", {}).get(
                "messageId", "unknown"
            )
            await self.track_event(
                notification_id=notification_id,
                event_type=mapped_type,
                metadata={
                    "channel": "email",
                    "provider": "ses",
                    "raw_event": ses_event,
                },
            )

            # Disable email address on hard bounce
            if mapped_type == "bounced":
                bounce_type = webhook_data.get("bounce", {}).get("bounceType")
                if bounce_type == "Permanent":
                    email = webhook_data["mail"]["destination"][0]
                    await disable_email_address(email)

    async def get_delivery_stats(self, batch_id: str) -> dict:
        """Get delivery statistics for a batch"""
        events = await self.event_store.get_by_batch(batch_id)

        stats = {
            "total": 0,
            "sent": 0,
            "delivered": 0,
            "opened": 0,
            "clicked": 0,
            "bounced": 0,
            "complained": 0,
            "failed": 0,
        }

        for event in events:
            event_type = event["event_type"]
            if event_type in stats:
                stats[event_type] += 1
            stats["total"] = max(stats["total"], stats["sent"])

        # Calculate rates
        if stats["sent"] > 0:
            stats["delivery_rate"] = stats["delivered"] / stats["sent"]
            stats["open_rate"] = stats["opened"] / stats["delivered"] if stats["delivered"] > 0 else 0
            stats["click_rate"] = stats["clicked"] / stats["opened"] if stats["opened"] > 0 else 0

        return stats
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: "Notification Carpet-Bombing"

```python
# BAD: Send a push notification immediately on every user action
# Result: User disables notifications and uninstalls the app

class BadNotificationHandler:
    async def on_like(self, post_id: str, liker_id: str):
        # Send an individual push notification
        await send_push(
            user_id=post.author_id,
            title="Like",
            body=f"{liker.name} liked your post"
        )
        # 10:00 "A liked your post"
        # 10:01 "B liked your post"
        # 10:02 "C liked your post"
        # ... user turns off notifications


# GOOD: Intelligent batching and aggregation
class GoodNotificationHandler:
    def __init__(self, aggregator: NotificationAggregator):
        self.aggregator = aggregator

    async def on_like(self, post_id: str, liker_id: str):
        # Add to aggregation buffer
        await self.aggregator.add(
            user_id=post.author_id,
            category="like",
            notification={
                "data": {
                    "actor_id": liker_id,
                    "actor_name": liker.name,
                    "post_id": post_id,
                },
            },
        )
        # Sent together after 5 minutes:
        # "A, B, and 3 others liked your post"

    # Additionally:
    # - Set hourly caps via rate limiting
    # - Deliver based on user's active hours
    # - Adjust frequency based on importance
```

### Anti-Pattern 2: "Processing All Channels with a Single Queue"

```python
# BAD: Use one queue and worker to process all channels
class BadWorker:
    async def process(self, message):
        channel = message["channel"]
        if channel == "push":
            await self.send_push(message)      # fast (< 100ms)
        elif channel == "email":
            await self.send_email(message)     # medium (< 1s)
        elif channel == "sms":
            await self.send_sms(message)       # slow (1-5s)
            # SMS delay blocks Push/Email!

        # Problems:
        # 1. SMS provider failure → all channel delivery stops
        # 2. Cannot scale channels independently
        # 3. High-priority Push waits behind low-priority SMS


# GOOD: Independent queues and workers per channel
class GoodArchitecture:
    """
    Channel-isolated architecture:

    Kafka Topics:
    - notifications.push.critical   → PushWorker (4 instances)
    - notifications.push.normal     → PushWorker (2 instances)
    - notifications.email.normal    → EmailWorker (3 instances)
    - notifications.sms.normal      → SMSWorker (1 instance)

    Benefits:
    1. Failure isolation: SMS down doesn't affect Push/Email
    2. Independent scaling: Push is high-throughput, SMS is low-throughput
    3. Priority control: assign more workers to critical topics
    4. Monitoring granularity: per-channel metrics
    """
    pass
```

### Anti-Pattern 3: "Notification API Without Rate Limiting"

```python
# BAD: Accept notifications without rate limiting
@app.post("/api/v1/notifications")
async def bad_create_notification(request: NotificationRequest):
    # Validate only and immediately enqueue
    for user_id in request.user_ids:
        for channel in request.channels:
            await queue.publish({"user_id": user_id, "channel": channel, ...})
    return {"status": "queued"}

    # Problems:
    # 1. Buggy service infinite-loops sending notifications
    # 2. Mass notifications to all users → UX destroyed
    # 3. SMS cost explodes ($0.05/msg × millions of messages = ...)
    # 4. APNs/FCM rate limits triggered → IP gets blocked


# GOOD: Multi-layer rate limiting
@app.post("/api/v1/notifications")
async def good_create_notification(request: NotificationRequest):
    # 1. API level: rate limit per calling service
    caller = get_caller_service(request)
    if not api_rate_limiter.allow(caller.id):
        raise HTTPException(429, "API rate limit exceeded")

    # 2. User level: per-user rate limit
    for user_id in request.user_ids:
        for channel in request.channels:
            if not user_rate_limiter.allow(user_id, channel):
                continue  # skip (log it)

    # 3. Global level: system-wide safety valve
    if not global_rate_limiter.allow():
        raise HTTPException(503, "System overloaded")

    return {"status": "queued"}
```

### Anti-Pattern 4: "No Delivery Confirmation (Fire and Forget)"

```python
# BAD: Send and forget — don't check the result
class BadSender:
    async def send_push(self, message):
        try:
            await apns_client.send(message)
            # Treated as success. In reality we only know APNs received it —
            # we don't know if it reached the device.
        except Exception:
            pass  # errors are ignored too


# GOOD: Track delivery results and close the feedback loop
class GoodSender:
    async def send_push(self, message):
        result = await apns_client.send(message)

        # Record delivery result
        await delivery_tracker.track_event(
            notification_id=message["id"],
            event_type="sent" if result.success else "failed",
            metadata={"provider_id": result.provider_message_id},
        )

        # Handle invalid tokens
        if result.error_code == "INVALID_TOKEN":
            await device_token_service.invalidate(message["device_token"])

        # Retry on failure
        if not result.success and result.should_retry:
            await retry_queue.publish(message)

        # Update metrics
        metrics.increment("push.sent", tags={"success": str(result.success)})
```

---

## 9. Practice Exercises

### Exercise 1 (Basic): Implement a Notification Preferences API

**Task**: Implement a REST API that lets users manage their notification preferences.

```python
# Requirements:
# 1. GET /api/v1/users/{user_id}/notification-preferences
#    → retrieve user notification preferences
# 2. PUT /api/v1/users/{user_id}/notification-preferences
#    → update notification preferences
# 3. Per-channel on/off settings
# 4. Per-category settings (marketing, transaction, social)
# 5. Quiet Hours configuration

# Skeleton code:
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

class QuietHours(BaseModel):
    enabled: bool = False
    start: str = "23:00"  # HH:MM
    end: str = "07:00"
    timezone: str = "Asia/Tokyo"

class ChannelSettings(BaseModel):
    push: bool = True
    email: bool = True
    sms: bool = True
    in_app: bool = True

class CategorySettings(BaseModel):
    marketing: bool = False
    transaction: bool = True
    social: bool = True
    security: bool = True  # security recommended always True

class NotificationPreferences(BaseModel):
    channels: ChannelSettings = ChannelSettings()
    categories: CategorySettings = CategorySettings()
    quiet_hours: QuietHours = QuietHours()

@app.get("/api/v1/users/{user_id}/notification-preferences")
async def get_preferences(user_id: str):
    # TODO: retrieve user preferences from DB
    # TODO: use caching
    # TODO: set default values
    pass

@app.put("/api/v1/users/{user_id}/notification-preferences")
async def update_preferences(user_id: str, prefs: NotificationPreferences):
    # TODO: validate
    # TODO: save to DB
    # TODO: invalidate cache
    # TODO: publish change event
    pass
```

**Expected output**:
```json
GET /api/v1/users/user-123/notification-preferences

{
  "channels": {
    "push": true,
    "email": true,
    "sms": false,
    "in_app": true
  },
  "categories": {
    "marketing": false,
    "transaction": true,
    "social": true,
    "security": true
  },
  "quiet_hours": {
    "enabled": true,
    "start": "23:00",
    "end": "07:00",
    "timezone": "Asia/Tokyo"
  }
}
```

---

### Exercise 2 (Intermediate): Implement Multi-Channel Fallback Delivery

**Task**: Implement a fallback mechanism that tries multiple channels in sequence to ensure reliable delivery of important notifications.

```python
# Requirements:
# 1. Fallback order: Push → Email → SMS
# 2. If a channel is delivered but not opened within a given time, try the next
# 3. Timeout settings are customizable per channel
# 4. Alert if the last resort (SMS) also fails

# Skeleton code:
class FallbackDeliveryService:
    """
    Multi-channel fallback delivery service.

    Flow:
    1. Send Push → wait 30s → opened? → Done
                              not opened → go to 2
    2. Send Email → wait 5min → opened? → Done
                                not opened → go to 3
    3. Send SMS → Done (SMS has no open confirmation)
    """

    FALLBACK_CHAIN = [
        {"channel": "push", "timeout_seconds": 30},
        {"channel": "email", "timeout_seconds": 300},
        {"channel": "sms", "timeout_seconds": 0},  # last resort
    ]

    async def deliver_with_fallback(self, user_id: str,
                                     notification: dict) -> str:
        # TODO: deliver in order along FALLBACK_CHAIN
        # TODO: move to next channel after timeout
        # TODO: alert on all-channel failure
        # TODO: log delivery result
        pass
```

**Expected output**:
```
Delivery log:
[2024-01-15 10:00:00] Push sent to user-456 (notification: order-confirm-789)
[2024-01-15 10:00:30] Push not opened within 30s, falling back to email
[2024-01-15 10:00:31] Email sent to user-456
[2024-01-15 10:05:31] Email opened by user-456 — delivery complete

Result: {"channel_used": "email", "attempts": 2, "total_time": "5m31s"}
```

---

### Exercise 3 (Advanced): Design a Notification Analytics Dashboard Backend

**Task**: Design and implement a backend API for a dashboard that analyzes notification delivery performance.

```python
# Requirements:
# 1. Per-channel delivery success rate (daily/weekly/monthly)
# 2. Per-category open rate and click rate
# 3. Hourly delivery performance analysis
# 4. A/B test result statistical analysis
# 5. Engagement analysis by user segment
# 6. Assume data is stored in ClickHouse

# Skeleton code:
from datetime import date, timedelta

class NotificationAnalytics:
    """Notification analytics service"""

    async def get_channel_performance(self, start_date: date,
                                       end_date: date) -> dict:
        """
        Get delivery performance per channel.

        Example return value:
        {
          "push": {"sent": 5000000, "delivered": 4750000,
                   "opened": 2375000, "delivery_rate": 0.95,
                   "open_rate": 0.50},
          "email": {"sent": 3000000, "delivered": 2400000,
                    "opened": 720000, "delivery_rate": 0.80,
                    "open_rate": 0.30},
          ...
        }
        """
        # TODO: aggregate data from ClickHouse
        # TODO: return at daily/weekly/monthly granularity
        # TODO: compare with previous period
        pass

    async def get_ab_test_results(self, test_id: str) -> dict:
        """
        Statistical analysis of A/B test results.

        Example return value:
        {
          "test_id": "test-001",
          "variants": {
            "A": {"sent": 50000, "opened": 15000, "clicked": 3000,
                  "open_rate": 0.30, "click_rate": 0.20},
            "B": {"sent": 50000, "opened": 18000, "clicked": 4500,
                  "open_rate": 0.36, "click_rate": 0.25},
          },
          "winner": "B",
          "confidence": 0.97,
          "p_value": 0.003,
        }
        """
        # TODO: implement statistical test (chi-square or Z-test)
        # TODO: determine statistical significance
        pass

    async def get_hourly_heatmap(self, channel: str,
                                  days: int = 7) -> list:
        """
        Hourly delivery performance heatmap data.

        Returns: 24-hour × 7-day matrix
        """
        # TODO: calculate open rate per hour
        # TODO: estimate optimal send time
        pass
```

**Expected output**:
```json
GET /api/v1/analytics/channel-performance?start=2024-01-01&end=2024-01-31

{
  "period": {"start": "2024-01-01", "end": "2024-01-31"},
  "channels": {
    "push": {
      "sent": 155000000,
      "delivered": 147250000,
      "opened": 73625000,
      "clicked": 22087500,
      "delivery_rate": 0.95,
      "open_rate": 0.50,
      "click_rate": 0.15,
      "trend": "+2.3%"
    },
    "email": {
      "sent": 93000000,
      "delivered": 74400000,
      "opened": 22320000,
      "clicked": 6696000,
      "delivery_rate": 0.80,
      "open_rate": 0.30,
      "click_rate": 0.09,
      "trend": "-1.1%"
    }
  }
}
```

---

## 10. FAQ

### Q1: What should I do when an APNs device token becomes invalid?

**A:** APNs returns HTTP 410 (Gone) for invalid tokens. Take the following steps.

1. **Immediately invalidate the token**: Set `is_active = false` on the DB record. Exclude from future deliveries.
2. **Monitor the feedback service**: Process APNs HTTP/2 responses in real time and collect a list of invalid tokens.
3. **Encourage re-registration**: Design the app to call `registerForRemoteNotifications()` on every launch and submit the latest token to the server.
4. **Periodic cleanup**: Run a batch job to periodically deactivate tokens that have not been updated in 90 or more days.

```python
# Example implementation for token management
async def handle_apns_response(device_token: str, status_code: int,
                                response_body: dict):
    if status_code == 410:  # Gone
        await db.execute(
            "UPDATE device_tokens SET is_active = FALSE "
            "WHERE device_token = :token",
            {"token": device_token},
        )
        # Also invalidate the cache
        user_id = await get_user_by_token(device_token)
        await cache.delete(f"devices:{user_id}")
    elif status_code == 400 and response_body.get("reason") == "BadDeviceToken":
        # Invalid token format
        await db.execute(
            "DELETE FROM device_tokens WHERE device_token = :token",
            {"token": device_token},
        )
```

### Q2: How do you implement A/B testing for notifications?

**A:** Use the following architecture.

1. **Variant management for templates**: Associate multiple variants (A/B/C...) with a single template ID, each with different copy or layout.
2. **User assignment**: Assign users to A/B groups using a hash of the user ID (consistent hashing). Always placing the same user in the same group maintains consistency.
3. **Metrics collection**: Record open rate, click rate, and conversion rate per variant. Events are streamed through Kafka into ClickHouse.
4. **Statistical significance testing**: Calculate p-values using chi-square or Z-tests, and once a statistically significant difference is detected at 95% confidence, consolidate on the winning variant.
5. **Automatic optimization (MAB)**: Use a Multi-Armed Bandit algorithm (Thompson Sampling) to allocate more traffic to the better-performing variant even during the test.

```python
# Example implementation for A/B test assignment
import hashlib

def assign_variant(user_id: str, test_id: str,
                   variants: list[str] = ["A", "B"]) -> str:
    """Consistently assign a user to a variant"""
    hash_input = f"{user_id}:{test_id}"
    hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
    index = hash_value % len(variants)
    return variants[index]
```

### Q3: How do you handle timezone support for a global service?

**A:** Schedule based on each user's timezone.

- **Store timezone in user profile**: Use IANA timezone names (e.g., `Asia/Tokyo`). If estimating from IP geolocation, ask for confirmation.
- **Schedule in local time**: "Send at 9 AM" → send at 9 AM in each user's local time. Convert to UTC and register with the scheduler.
- **Apply Quiet Hours per timezone**: Calculate "do not send between midnight and 7 AM" using the user's timezone.
- **Scheduler implementation**: A UTC-based scheduler queries every minute for "notifications to send in the next minute" and enqueues them.
- **DST (daylight saving time) handling**: Use the `pytz` or `zoneinfo` library to correctly handle DST transitions.

### Q4: How do you accurately measure notification open rates?

**A:** Use different tracking methods per channel.

| Channel | Tracking method | Accuracy |
|---------|----------------|------|
| Email | 1x1 tracking pixel + link redirect | Medium (undetectable when images are blocked) |
| Push (iOS) | Notify server via `UNNotificationServiceExtension` | High |
| Push (Android) | FCM Data Message + in-app handler | High |
| In-App | Send event on display | Very high |
| SMS | Short URL click tracking only (open not detectable) | Low |

Notes:
- Apple Mail Privacy Protection (iOS 15+) loads images via a proxy, causing email open rates to appear higher than reality
- Distinguish between notification "display" and "tap" in push measurement

### Q5: How do you handle mass delivery (broadcast)?

**A:** Sending to all users simultaneously requires special handling.

1. **Segment splitting**: Divide all users into N segments and deliver sequentially. Sending all at once will trigger provider rate limits.
2. **Leverage Kafka partitioning**: Partition by user ID and process in parallel across multiple workers.
3. **Staged rollout**: First deliver to 1%, verify no issues, then expand gradually: 10% → 50% → 100%.
4. **Cancellation capability**: Auto-stop if the error rate exceeds a threshold during delivery. Manual cancellation should also be available.
5. **Pre-warming**: Notify the provider before a mass delivery and request a temporary rate limit increase (available with APNs/SES).

```python
# Example implementation for staged rollout
class BroadcastService:
    ROLLOUT_STAGES = [0.01, 0.10, 0.50, 1.00]

    async def broadcast(self, notification: dict,
                         auto_rollout: bool = True):
        total_users = await get_total_user_count()

        for stage_pct in self.ROLLOUT_STAGES:
            target_count = int(total_users * stage_pct)
            users = await get_user_segment(
                offset=0, limit=target_count
            )

            batch_id = await send_to_users(users, notification)

            if auto_rollout:
                # Monitor delivery results
                await asyncio.sleep(300)  # wait 5 minutes
                stats = await get_batch_stats(batch_id)

                if stats["error_rate"] > 0.05:  # error rate > 5%
                    await cancel_broadcast(batch_id)
                    raise BroadcastError(
                        f"Error rate too high: {stats['error_rate']}"
                    )
            else:
                # Wait for manual approval
                await wait_for_approval(batch_id)
```

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Design element | Choice | Reason |
|---------|------|------|
| Message queue | Kafka (per-channel + per-priority topics) | High throughput + failure isolation + priority control |
| Deduplication | Redis SETNX (TTL: 24h) | Fast idempotency check, memory efficiency |
| Rate limiting | Redis Sorted Set + Lua script | Accurate sliding window, atomic operations |
| Templates | Jinja2 + DB management + Redis cache | Multilingual/multi-channel, version control |
| Retry | Exponential backoff + jitter + DLQ | Reliability, provider overload prevention |
| Delivery tracking | Kafka → ClickHouse → Grafana | Real-time analytics + long-term storage |
| Channel isolation | Per-channel queues + workers | Failure isolation + independent scaling |
| User preferences | PostgreSQL + Redis cache | Persistence + fast reads |
| Device tokens | PostgreSQL + Redis cache | Token management + fast lookup |
| Monitoring | Prometheus + Grafana + PagerDuty | Metrics + dashboard + alerts |

---

## 12. Design Interview Answer Framework

```
Key points asked in notification system design interviews:

1. Clarify requirements (5 min)
   - User scale? (100M DAU → high-scale design required)
   - Channels supported? (Push/Email/SMS/In-App)
   - Delivery guarantee level? (at-least-once)
   - Latency requirements? (< 30s)

2. High-level design (10 min)
   - API → Orchestrator → Queue → Worker → Provider
   - Per-channel isolation
   - Templates + user preferences

3. Detailed design (15 min)
   - Data model
   - Rate limiting algorithm
   - Retry strategy
   - Deduplication

4. Scalability (5 min)
   - Horizontal scaling
   - Kafka partitioning
   - Redis cluster

5. Operations (5 min)
   - Monitoring and alerting
   - Delivery analytics
   - A/B testing
```

---

## What to Read Next

- [Chat System Design](./01-chat-system.md) — Integration patterns with real-time messaging
- [URL Shortener Design](./00-url-shortener.md) — Shortening and tracking links inside notifications
- [Rate Limiter Design](./03-rate-limiter.md) — Detailed algorithms for notification rate limiting
- [Message Queue](../01-components/02-message-queue.md) — Details on Kafka / RabbitMQ
- [Event-Driven Architecture](../02-architecture/03-event-driven.md) — Principles of event-driven design
- Observer Pattern — Fundamentals of the Pub/Sub pattern
- Strategy Pattern — Design pattern for channel adapters
- API Design — Best practices for notification APIs

---

## References

1. Xu, A. (2020). *System Design Interview: An Insider's Guide*. Chapter 10: Design a Notification System. Byte Code LLC. https://www.systemdesigninterview.com/
2. Apple Inc. (2024). "Sending Notification Requests to APNs." *Apple Developer Documentation*. https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
3. Google. (2024). "Firebase Cloud Messaging Architecture." *Firebase Documentation*. https://firebase.google.com/docs/cloud-messaging/fcm-architecture
4. Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media. Chapter 11: Stream Processing.
5. Amazon Web Services. (2024). "Amazon SES Developer Guide." https://docs.aws.amazon.com/ses/latest/dg/
6. Twilio. (2024). "Programmable Messaging Documentation." https://www.twilio.com/docs/messaging
7. Shopify Engineering. (2018). "Building a Notification System at Scale." https://shopify.engineering/
