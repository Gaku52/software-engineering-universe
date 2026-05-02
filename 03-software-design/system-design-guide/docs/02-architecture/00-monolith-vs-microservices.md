# Monolith vs Microservices

> Develop a thorough understanding of the characteristics of both monoliths and microservices, and build the judgment to select the optimal architecture based on project scale, team structure, and business requirements.

## What You Will Learn

1. **Structural differences** --- The essential differences in architecture, deployment, and data management between monoliths and microservices
2. **Trade-off analysis** --- Understanding the advantages and disadvantages of each architecture and the conditions under which they apply
3. **Incremental migration** --- Migration strategy from monolith to microservices using the Strangler Fig pattern
4. **Design patterns** --- Implementation of inter-service communication, distributed transactions (Saga), and API Gateway
5. **Decision framework** --- Selection criteria based on team size, domain maturity, and technical requirements

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| Web application development | Intermediate | Programming |
| REST API | Basic | Web Basics |
| Database | Basic | [DB Scaling](../01-components/04-database-scaling.md) |
| Message Queue | Basic | [Message Queue](../01-components/02-message-queue.md) |

---

## 0. WHY --- Why Does Architecture Choice Matter?

### 0.1 The Scope of Architecture Decisions

```
Architecture choice affects all of the following:

  ┌──────────────────────────────────────────────┐
  │                                              │
  │  1. Development speed                        │
  │     └─ Short-term: Monolith > Microservices  │
  │        Long-term: Microservices > Monolith   │
  │                                              │
  │  2. Deployment frequency                     │
  │     └─ Monolith: 1-2 times per week          │
  │        Microservices: Several to dozens      │
  │                       of times per day       │
  │                                              │
  │  3. Team autonomy                            │
  │     └─ Monolith: Everyone shares one         │
  │                  codebase                    │
  │        Microservices: Teams own services     │
  │                                              │
  │  4. Scalability                              │
  │     └─ Monolith: Scale the entire system     │
  │        Microservices: Scale only bottlenecks │
  │                                              │
  │  5. Blast radius of failures                 │
  │     └─ Monolith: One bug affects everything  │
  │        Microservices: Failures are isolated  │
  │                                              │
  │  6. Operational cost                         │
  │     └─ Monolith: Low (single process)        │
  │        Microservices: High (distributed      │
  │                           system ops)        │
  │                                              │
  └──────────────────────────────────────────────┘
```

### 0.2 Real-World Trade-offs

| Metric | Monolith | Microservices |
|------|---------|---------------|
| Initial development cost | $100K | $300K-500K |
| Monthly operational cost (small scale) | $500 | $2,000-5,000 |
| Deployment frequency | 1-2 times/week | 5-20 times/day |
| Mean time to recovery | Minutes (restart) | Seconds (per service) |
| New feature release speed (50-person team) | Slow (many conflicts) | Fast (independent deploys) |
| Required infrastructure knowledge | Basic | Advanced (K8s, Service Mesh) |
| Monitoring complexity | Low | High (distributed tracing required) |

---

## 1. What Is a Monolith?

### 1.1 Monolithic Architecture

```
  ┌────────────────────────────────────────┐
  │         Monolith Application           │
  │                                        │
  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐ │
  │  │ User │ │Order │ │ Pay- │ │Notifi-│ │
  │  │Module│ │Module│ │ ment │ │cation │ │
  │  └──┬───┘ └──┬───┘ └──┬───┘ └───┬───┘ │
  │     │        │        │         │     │
  │  ┌──▼────────▼────────▼─────────▼──┐  │
  │  │          Shared Database         │  │
  │  └─────────────────────────────────┘  │
  │                                        │
  │  One deployment unit, one process      │
  │  One codebase, one CI/CD pipeline      │
  └────────────────────────────────────────┘
```

### 1.2 Types of Monoliths

```
1. Simple Monolith
   └─ All code in a single package. Best for small teams.

2. Modular Monolith  ← Recommended
   └─ Internals are divided into modules. Modules communicate
      only through defined interfaces. DB schemas are also
      separated per module.
      Prepares for future migration to microservices.
      Examples: Shopify, Basecamp

3. Distributed Monolith  ← Anti-pattern
   └─ Split into services but still tightly coupled.
      Gets the worst of microservices with none of the benefits.

  ┌──────────────────────────────────────────────┐
  │     Internal Structure of a Modular Monolith  │
  │                                              │
  │  ┌──────────────┐    ┌──────────────┐        │
  │  │ User Module  │    │ Order Module │        │
  │  │              │    │              │        │
  │  │ UserService  │◄──►│ OrderService │        │
  │  │ UserRepo     │    │ OrderRepo    │        │
  │  │              │    │              │        │
  │  │ user_*       │    │ order_*      │        │
  │  │ tables       │    │ tables       │        │
  │  └──────────────┘    └──────────────┘        │
  │                                              │
  │  Rules:                                      │
  │  - No direct access to another module's      │
  │    tables                                    │
  │  - Access only through public interfaces     │
  │  - Internal design is free within a module   │
  └──────────────────────────────────────────────┘
```

---

## 2. What Are Microservices?

### 2.1 Microservices Architecture

```
  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
  │  User   │    │  Order  │    │ Payment │    │ Notif.   │
  │ Service │    │ Service │    │ Service │    │ Service  │
  │         │←──→│         │←──→│         │←──→│          │
  └────┬────┘    └────┬────┘    └────┬────┘    └────┬─────┘
       │              │              │               │
  ┌────▼────┐    ┌────▼────┐    ┌────▼────┐    ┌────▼─────┐
  │ User DB │    │Order DB │    │ Pay DB  │    │Notif DB  │
  │(Postgres)│   │(Postgres)│   │(Postgres)│   │ (Redis)  │
  └─────────┘    └─────────┘    └─────────┘    └──────────┘

  Each service: independent deploy, independent DB, independent scale
  Communication: REST / gRPC / Message Queue
  Ownership: 1 team = 1-3 services (Two Pizza Team)
```

### 2.2 Characteristics of Microservices

```
9 Characteristics of Microservices (Martin Fowler):

  1. Componentization via Services
     └─ Split into independent processes, not libraries

  2. Organized Around Business Capabilities
     └─ Split by business function, not technical layer
        NG: Frontend team / Backend team / DB team
        OK: User team / Order team / Payment team

  3. Products Not Projects
     └─ Teams own the full lifecycle of their service

  4. Smart Endpoints and Dumb Pipes
     └─ Logic lives in services; communication is lightweight
        (REST/gRPC/MQ)

  5. Decentralized Governance
     └─ Each service can choose its own tech stack

  6. Decentralized Data Management
     └─ Each service has its own independent data store
        (Database per Service)

  7. Infrastructure Automation
     └─ CI/CD, IaC, container orchestration

  8. Design for Failure
     └─ Circuit breakers, retries, fallbacks

  9. Evolutionary Design
     └─ Services can be replaced or retired easily
```

---

## 3. Comparing with Code Examples

### Code Example 1: Order Processing in a Monolith

```python
# monolith/order_service.py
# Monolith: everything runs inside one process

class OrderService:
    def __init__(self, db_session):
        self.db = db_session

    def create_order(self, user_id: str, items: list) -> dict:
        # Transaction within same DB → ACID guaranteed
        with self.db.begin():
            # 1. Verify user (same DB)
            user = self.db.query(User).get(user_id)
            if not user:
                raise ValueError("User not found")

            # 2. Check inventory (same DB)
            for item in items:
                product = self.db.query(Product).get(item["product_id"])
                if product.stock < item["quantity"]:
                    raise ValueError(f"Insufficient stock: {product.name}")
                product.stock -= item["quantity"]

            # 3. Create order (same DB)
            order = Order(user_id=user_id, items=items, status="pending")
            self.db.add(order)

            # 4. Process payment (called within same process)
            payment = PaymentService(self.db)
            payment.charge(user_id, order.total_amount)

            # 5. Send notification (called within same process)
            notification = NotificationService(self.db)
            notification.send_order_confirmation(user_id, order.id)

            order.status = "confirmed"
            return {"order_id": order.id, "status": order.status}

        # Pros:
        # - ACID guaranteed within a single transaction
        # - Easy to debug (traceable via stack trace)
        # - Simple tests (fewer mocks)
        #
        # Cons:
        # - All modules are tightly coupled
        # - Slow payment processing blocks the entire order
        # - A notification service failure causes order failure
```

### Code Example 2: Order Processing in Microservices

```python
# microservices/order_service/app.py
# Microservices: each service is independent

import httpx
import json
from kafka import KafkaProducer

class OrderService:
    def __init__(self, db, producer: KafkaProducer):
        self.db = db
        self.producer = producer
        self.user_service_url = "http://user-service:8080"
        self.inventory_service_url = "http://inventory-service:8080"

    async def create_order(self, user_id: str, items: list) -> dict:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # 1. Verify user (query another service via HTTP)
            resp = await client.get(
                f"{self.user_service_url}/users/{user_id}"
            )
            if resp.status_code != 200:
                raise ValueError("User not found")

            # 2. Check inventory (query another service via HTTP)
            resp = await client.post(
                f"{self.inventory_service_url}/reserve",
                json={"items": items}
            )
            if resp.status_code != 200:
                raise ValueError("Insufficient stock")
            reservation_id = resp.json()["reservation_id"]

        # 3. Create order (this service's own DB)
        order = Order(
            user_id=user_id,
            items=items,
            status="pending",
            reservation_id=reservation_id,
        )
        self.db.add(order)
        self.db.commit()

        # 4. Publish event (payment and notification handled asynchronously)
        self.producer.send("order-events", json.dumps({
            "event_type": "order_created",
            "order_id": order.id,
            "user_id": user_id,
            "amount": order.total_amount,
            "reservation_id": reservation_id,
        }).encode())

        return {"order_id": order.id, "status": "pending"}

    # Pros:
    # - Independent deploy and scale (order service can scale to 10 instances)
    # - Freedom to choose tech stack (payment in Java, notification in Go)
    # - Failure isolation (notification failure doesn't stop orders)
    #
    # Cons:
    # - Distributed transactions (consistency across inventory + order + payment)
    # - Network latency (overhead of HTTP calls)
    # - More complex tests (inter-service integration testing)
    # - Eventual consistency (order status updates may be delayed)
```

### Code Example 3: Distributed Transactions with the Saga Pattern

```python
from enum import Enum
from dataclasses import dataclass, field
from typing import Callable, Any
import asyncio
import logging

logger = logging.getLogger(__name__)

class SagaStepStatus(Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATED = "compensated"

@dataclass
class SagaStep:
    name: str
    action: Callable        # Forward action
    compensation: Callable  # Compensation action (rollback)
    status: SagaStepStatus = SagaStepStatus.PENDING
    result: Any = None

class SagaOrchestrator:
    """
    Orchestration Saga: a central orchestrator controls each step

    Flow:
    1. Reserve inventory → success
    2. Process payment → success
    3. Confirm order → failure!
    4. → Refund payment (compensate)
    5. → Release inventory reservation (compensate)
    """

    def __init__(self, saga_id: str):
        self.saga_id = saga_id
        self.steps: list[SagaStep] = []
        self.completed_steps: list[SagaStep] = []

    def add_step(
        self,
        name: str,
        action: Callable,
        compensation: Callable
    ):
        self.steps.append(SagaStep(name, action, compensation))

    async def execute(self, context: dict) -> dict:
        """Execute the Saga"""
        logger.info(f"[SAGA {self.saga_id}] Starting saga")

        for step in self.steps:
            try:
                logger.info(f"[SAGA {self.saga_id}] Executing: {step.name}")
                result = await step.action(context)
                context.update(result or {})
                step.status = SagaStepStatus.COMPLETED
                step.result = result
                self.completed_steps.append(step)
            except Exception as e:
                logger.error(
                    f"[SAGA {self.saga_id}] Failed: {step.name} - {e}"
                )
                step.status = SagaStepStatus.FAILED
                await self._compensate(context)
                return {
                    "status": "failed",
                    "failed_step": step.name,
                    "error": str(e),
                }

        logger.info(f"[SAGA {self.saga_id}] Completed successfully")
        return {"status": "completed", "context": context}

    async def _compensate(self, context: dict):
        """Compensate completed steps in reverse order"""
        logger.info(f"[SAGA {self.saga_id}] Starting compensation")
        for step in reversed(self.completed_steps):
            try:
                logger.info(
                    f"[SAGA {self.saga_id}] Compensating: {step.name}"
                )
                await step.compensation(context)
                step.status = SagaStepStatus.COMPENSATED
            except Exception as e:
                logger.error(
                    f"[SAGA {self.saga_id}] Compensation failed: "
                    f"{step.name} - {e}"
                )
                # Compensation failed: manual intervention required → send to DLQ
                await self._send_to_dlq(step, context, e)

    async def _send_to_dlq(self, step, context, error):
        """Send compensation failure to dead letter queue"""
        logger.critical(
            f"[SAGA {self.saga_id}] Manual intervention required: "
            f"{step.name}"
        )

# Usage example: Order processing Saga
async def create_order_saga(
    user_id: str, items: list, amount: float
):
    saga = SagaOrchestrator(saga_id=f"order-{user_id}-{int(time.time())}")

    saga.add_step(
        "reserve_inventory",
        action=lambda ctx: inventory_service.reserve(ctx["items"]),
        compensation=lambda ctx: inventory_service.cancel_reservation(
            ctx["reservation_id"]
        ),
    )
    saga.add_step(
        "process_payment",
        action=lambda ctx: payment_service.charge(
            ctx["user_id"], ctx["amount"]
        ),
        compensation=lambda ctx: payment_service.refund(
            ctx["payment_id"]
        ),
    )
    saga.add_step(
        "confirm_order",
        action=lambda ctx: order_service.confirm(ctx["order_id"]),
        compensation=lambda ctx: order_service.cancel(ctx["order_id"]),
    )
    saga.add_step(
        "send_notification",
        action=lambda ctx: notification_service.send(
            ctx["user_id"], ctx["order_id"]
        ),
        compensation=lambda ctx: None,  # No compensation needed for notifications
    )

    context = {
        "user_id": user_id,
        "items": items,
        "amount": amount,
    }
    return await saga.execute(context)
```

### Code Example 4: API Gateway Pattern

```python
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import httpx
import time
import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum

app = FastAPI(title="API Gateway")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://example.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICE_REGISTRY = {
    "users":         "http://user-service:8080",
    "orders":        "http://order-service:8080",
    "payments":      "http://payment-service:8080",
    "notifications": "http://notification-service:8080",
}

# ── Rate Limiter ──
class RateLimiter:
    """Sliding window rate limiter"""

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        # Remove old requests
        self.requests[client_id] = [
            t for t in self.requests[client_id]
            if now - t < self.window
        ]
        if len(self.requests[client_id]) >= self.max_requests:
            return False
        self.requests[client_id].append(now)
        return True

rate_limiter = RateLimiter(max_requests=100, window_seconds=60)

# ── Circuit Breaker ──
class CircuitState(Enum):
    CLOSED = "closed"      # Normal
    OPEN = "open"          # Tripped
    HALF_OPEN = "half_open"  # Testing

@dataclass
class CircuitBreaker:
    failure_threshold: int = 5
    recovery_timeout: float = 30.0
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure_time: float = 0

    def record_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

    def is_available(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                return True
            return False
        return True  # HALF_OPEN: allow one attempt

circuit_breakers: dict[str, CircuitBreaker] = {
    name: CircuitBreaker() for name in SERVICE_REGISTRY
}

# ── Routing ──
@app.api_route(
    "/{service}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"]
)
async def gateway(service: str, path: str, request: Request):
    """Route all requests"""
    # 1. Check service exists
    base_url = SERVICE_REGISTRY.get(service)
    if not base_url:
        raise HTTPException(404, f"Service '{service}' not found")

    # 2. Check rate limit
    client_ip = request.client.host
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(429, "Rate limit exceeded")

    # 3. Check circuit breaker
    cb = circuit_breakers[service]
    if not cb.is_available():
        raise HTTPException(503, f"Service '{service}' is temporarily unavailable")

    # 4. Forward request
    target_url = f"{base_url}/{path}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers={
                    k: v for k, v in request.headers.items()
                    if k.lower() not in ("host", "content-length")
                },
                content=await request.body(),
                params=dict(request.query_params),
            )
            cb.record_success()
            return response.json()

    except (httpx.TimeoutException, httpx.ConnectError) as e:
        cb.record_failure()
        raise HTTPException(502, f"Service '{service}' error: {e}")
```

### Code Example 5: Retry and Fallback for Inter-Service Communication

```python
import httpx
import asyncio
from functools import wraps
from typing import Optional, Any
from dataclasses import dataclass
import time

@dataclass
class RetryConfig:
    max_retries: int = 3
    base_delay: float = 0.5      # Initial wait 500ms
    max_delay: float = 10.0      # Maximum wait 10s
    exponential_base: float = 2  # Base for exponential backoff
    retry_on_status: set = None  # Status codes that trigger retry

    def __post_init__(self):
        if self.retry_on_status is None:
            self.retry_on_status = {502, 503, 504, 429}

class ResilientServiceClient:
    """Fault-tolerant inter-service communication"""

    def __init__(
        self,
        base_url: str,
        timeout: float = 5.0,
        retry_config: RetryConfig = None,
        fallback: Optional[Any] = None,
    ):
        self.base_url = base_url
        self.timeout = timeout
        self.retry_config = retry_config or RetryConfig()
        self.fallback = fallback
        self._metrics = {
            'total_requests': 0,
            'successful': 0,
            'retries': 0,
            'failures': 0,
            'fallbacks': 0,
        }

    async def get(self, path: str, **kwargs) -> dict:
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, data: dict = None, **kwargs) -> dict:
        return await self._request("POST", path, json=data, **kwargs)

    async def _request(self, method: str, path: str, **kwargs):
        self._metrics['total_requests'] += 1
        last_error = None

        for attempt in range(self.retry_config.max_retries):
            try:
                async with httpx.AsyncClient(
                    base_url=self.base_url,
                    timeout=self.timeout
                ) as client:
                    resp = await client.request(method, path, **kwargs)

                    # Check if status code should trigger a retry
                    if resp.status_code in self.retry_config.retry_on_status:
                        raise httpx.HTTPStatusError(
                            f"Status {resp.status_code}",
                            request=resp.request,
                            response=resp,
                        )

                    resp.raise_for_status()
                    self._metrics['successful'] += 1
                    return resp.json()

            except (
                httpx.TimeoutException,
                httpx.HTTPStatusError,
                httpx.ConnectError,
            ) as e:
                last_error = e
                self._metrics['retries'] += 1

                if attempt < self.retry_config.max_retries - 1:
                    # Exponential backoff + jitter
                    delay = min(
                        self.retry_config.base_delay *
                        (self.retry_config.exponential_base ** attempt),
                        self.retry_config.max_delay
                    )
                    # Jitter: randomize to 0.5x~1.5x
                    import random
                    jitter = delay * (0.5 + random.random())
                    print(
                        f"[Retry {attempt+1}/{self.retry_config.max_retries}] "
                        f"{method} {path}: {e}, waiting {jitter:.1f}s"
                    )
                    await asyncio.sleep(jitter)

        # All retries exhausted
        self._metrics['failures'] += 1

        # Fallback
        if self.fallback is not None:
            self._metrics['fallbacks'] += 1
            if callable(self.fallback):
                return self.fallback()
            return self.fallback

        raise last_error

    @property
    def metrics(self) -> dict:
        total = self._metrics['total_requests']
        return {
            **self._metrics,
            'success_rate': (
                self._metrics['successful'] / total if total > 0 else 0
            ),
            'fallback_rate': (
                self._metrics['fallbacks'] / total if total > 0 else 0
            ),
        }

# Usage example
user_client = ResilientServiceClient(
    "http://user-service:8080",
    timeout=3.0,
    retry_config=RetryConfig(max_retries=3, base_delay=0.5),
    fallback={"id": "unknown", "name": "Guest"},  # Fallback value
)

order_client = ResilientServiceClient(
    "http://order-service:8080",
    timeout=10.0,
    retry_config=RetryConfig(max_retries=2, base_delay=1.0),
)
```

### Code Example 6: Implementing a Modular Monolith

```python
"""Modular Monolith: design with clearly defined module boundaries"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

# ── Interface definitions between modules ──

class UserModuleInterface(ABC):
    """Public interface of the User module"""
    @abstractmethod
    def get_user(self, user_id: str) -> Optional[dict]: ...
    @abstractmethod
    def validate_user(self, user_id: str) -> bool: ...

class OrderModuleInterface(ABC):
    """Public interface of the Order module"""
    @abstractmethod
    def create_order(self, user_id: str, items: list) -> dict: ...
    @abstractmethod
    def get_order(self, order_id: str) -> Optional[dict]: ...

class PaymentModuleInterface(ABC):
    """Public interface of the Payment module"""
    @abstractmethod
    def charge(self, user_id: str, amount: float) -> dict: ...
    @abstractmethod
    def refund(self, payment_id: str) -> dict: ...

# ── User module implementation ──

class UserModule(UserModuleInterface):
    """User module: accesses only users_* tables"""

    def __init__(self, db_session):
        self.db = db_session

    def get_user(self, user_id: str) -> Optional[dict]:
        user = self.db.query(User).get(user_id)
        if not user:
            return None
        return {"id": user.id, "name": user.name, "email": user.email}

    def validate_user(self, user_id: str) -> bool:
        return self.db.query(User).get(user_id) is not None

# ── Order module implementation ──

class OrderModule(OrderModuleInterface):
    """Order module: accesses only orders_* tables"""

    def __init__(
        self,
        db_session,
        user_module: UserModuleInterface,      # Dependency via interface
        payment_module: PaymentModuleInterface,
    ):
        self.db = db_session
        self.users = user_module      # No direct DB access
        self.payments = payment_module

    def create_order(self, user_id: str, items: list) -> dict:
        # Access via the User module's interface
        if not self.users.validate_user(user_id):
            raise ValueError("User not found")

        order = Order(user_id=user_id, items=items, status="pending")
        self.db.add(order)
        self.db.flush()

        # Access via the Payment module's interface
        total = sum(item["price"] * item["quantity"] for item in items)
        payment = self.payments.charge(user_id, total)

        order.payment_id = payment["id"]
        order.status = "confirmed"
        self.db.commit()

        return {"order_id": order.id, "status": order.status}

    def get_order(self, order_id: str) -> Optional[dict]:
        order = self.db.query(Order).get(order_id)
        return {"id": order.id, "status": order.status} if order else None

# ── Module assembly (Composition Root) ──

class Application:
    """Application entry point"""

    def __init__(self, db_session):
        # Initialize modules (dependency injection)
        self.user_module = UserModule(db_session)
        self.payment_module = PaymentModule(db_session)
        self.order_module = OrderModule(
            db_session,
            user_module=self.user_module,
            payment_module=self.payment_module,
        )

# Pros:
# - Simplicity of monolith (single deployment unit, ACID transactions)
# - Clear boundaries between modules (easy future migration to microservices)
# - Type-safe interfaces
# - Easy to test (modules can be mocked individually)
```

---

## 4. The Strangler Fig Pattern

### 4.1 Incremental Migration

```
Phase 1: Stay with the monolith
  ┌──────────────────────────────┐
  │         Monolith             │
  │  [User] [Order] [Pay] [Noti]│
  └──────────────────────────────┘

Phase 2: API Gateway + extract the first service
  ┌────────────────────────┐
  │    Monolith (remaining) │     ┌───────────┐
  │  [User] [Order] [Pay]  │────→│ Notif.    │ (extracted)
  └────────────────────────┘     │ Service   │
         ↑                       └───────────┘
         │
  ┌──────┴──────┐
  │ API Gateway │  ← Routes traffic
  └─────────────┘

Phase 3: Gradually extract more services
  ┌────────────────┐
  │  Monolith      │     ┌───────────┐  ┌───────────┐
  │  [User] [Order]│────→│ Payment   │  │ Notif.    │
  └────────────────┘     │ Service   │  │ Service   │
         ↑               └───────────┘  └───────────┘
         │                     ↑              ↑
  ┌──────┴─────────────────────┴──────────────┴──┐
  │              API Gateway                      │
  └───────────────────────────────────────────────┘

Phase 4: All services are microservices
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │  User    │ │  Order   │ │ Payment  │ │  Notif.  │
  │ Service  │ │ Service  │ │ Service  │ │ Service  │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
         ↑          ↑           ↑            ↑
  ┌──────┴──────────┴───────────┴────────────┴──┐
  │              API Gateway                     │
  └──────────────────────────────────────────────┘
```

### 4.2 Implementing Strangler Fig

```python
"""Strangler Fig Pattern: routing controlled by API Gateway"""
from fastapi import FastAPI, Request, Response
import httpx
import re

app = FastAPI(title="Strangler Gateway")

# Migration routing configuration
# status: "monolith" → "dual" → "microservice"
MIGRATION_ROUTES = {
    # Fully migrated
    "/api/notifications": {
        "status": "microservice",
        "service_url": "http://notification-service:8080",
    },
    # Dual write in progress (sent to both, responses compared)
    "/api/payments": {
        "status": "dual",
        "monolith_url": "http://monolith:8080",
        "service_url": "http://payment-service:8080",
    },
    # Still on monolith
    "/api/users": {
        "status": "monolith",
        "monolith_url": "http://monolith:8080",
    },
    "/api/orders": {
        "status": "monolith",
        "monolith_url": "http://monolith:8080",
    },
}

@app.api_route("/api/{path:path}", methods=["GET","POST","PUT","DELETE"])
async def strangler_route(path: str, request: Request):
    """Strangler Fig routing"""
    full_path = f"/api/{path}"

    # Find route config (longest match)
    route_config = None
    for prefix, config in sorted(
        MIGRATION_ROUTES.items(), key=lambda x: -len(x[0])
    ):
        if full_path.startswith(prefix):
            route_config = config
            break

    if not route_config:
        route_config = {
            "status": "monolith",
            "monolith_url": "http://monolith:8080",
        }

    # Route based on status
    status = route_config["status"]

    if status == "microservice":
        return await forward_request(
            request, route_config["service_url"], full_path
        )

    elif status == "dual":
        # Dual write: send to both and compare responses
        monolith_resp, service_resp = await asyncio.gather(
            forward_request(
                request, route_config["monolith_url"], full_path
            ),
            forward_request(
                request, route_config["service_url"], full_path
            ),
            return_exceptions=True,
        )

        # Return monolith response (safe side)
        # Log diffs in the background
        if monolith_resp != service_resp:
            log_diff(full_path, monolith_resp, service_resp)

        return monolith_resp

    else:  # monolith
        return await forward_request(
            request, route_config["monolith_url"], full_path
        )

async def forward_request(request: Request, base_url: str, path: str):
    """Forward request"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.request(
            method=request.method,
            url=f"{base_url}{path}",
            headers={
                k: v for k, v in request.headers.items()
                if k.lower() not in ("host",)
            },
            content=await request.body(),
        )
        return resp.json()

def log_diff(path: str, monolith: dict, service: dict):
    """Log response differences between monolith and service"""
    import json
    print(f"[DIFF] {path}")
    print(f"  Monolith: {json.dumps(monolith, indent=2)}")
    print(f"  Service:  {json.dumps(service, indent=2)}")
```

### 4.3 Migration Decision Criteria

```python
"""Prioritization for service extraction"""
from dataclasses import dataclass

@dataclass
class ServiceExtractionCandidate:
    """Evaluation of extraction candidate"""
    name: str
    change_frequency: str    # "High" / "Medium" / "Low"
    coupling: str            # "Low" / "Medium" / "High"
    team_ownership: str      # "Clear" / "Unclear"
    scalability_need: str    # "High" / "Medium" / "Low"
    data_independence: str   # "Independent" / "Partial" / "Shared"
    priority: str            # "High" / "Medium" / "Low"

EXTRACTION_CANDIDATES = [
    ServiceExtractionCandidate(
        name="Notification Service",
        change_frequency="High",
        coupling="Low",
        team_ownership="Clear",
        scalability_need="High",
        data_independence="Independent",
        priority="High (extract first)",
    ),
    ServiceExtractionCandidate(
        name="Payment Service",
        change_frequency="Medium",
        coupling="Medium",
        team_ownership="Clear",
        scalability_need="Medium",
        data_independence="Partial",
        priority="Medium (extract second)",
    ),
    ServiceExtractionCandidate(
        name="User Service",
        change_frequency="Low",
        coupling="High",
        team_ownership="Unclear",
        scalability_need="Low",
        data_independence="Shared",
        priority="Low (extract last, or don't extract)",
    ),
]

# Extraction criteria:
# 1. Low coupling → easier to extract
# 2. High change frequency → bigger benefit from independent deploys
# 3. Scalability requirements → need for independent scaling
# 4. Clear team ownership → easier to operate
# 5. Data is independent → easier data migration
```

---

## 5. Observability

### 5.1 Distributed Tracing

```python
"""Distributed tracing implementation for microservices"""
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
import uuid

# Initialize tracer
provider = TracerProvider()
processor = BatchSpanProcessor(
    OTLPSpanExporter(endpoint="http://jaeger:4317")
)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

# Auto-instrumentation for FastAPI and httpx
FastAPIInstrumentor().instrument_app(app)
HTTPXClientInstrumentor().instrument()

# Adding custom spans
@app.post("/api/orders")
async def create_order(request: OrderRequest):
    with tracer.start_as_current_span("create_order") as span:
        span.set_attribute("user_id", request.user_id)
        span.set_attribute("item_count", len(request.items))

        # Child span: user validation
        with tracer.start_as_current_span("validate_user"):
            user = await user_client.get(f"/users/{request.user_id}")

        # Child span: inventory check
        with tracer.start_as_current_span("check_inventory"):
            inventory = await inventory_client.post(
                "/check", data={"items": request.items}
            )

        # Child span: save order
        with tracer.start_as_current_span("save_order"):
            order = await save_to_db(request)
            span.set_attribute("order_id", order.id)

        return {"order_id": order.id}

# Trace result (visualized in Jaeger UI):
#
# create_order [Order Service] ─── 150ms
#   ├── validate_user [→ User Service] ─── 30ms
#   ├── check_inventory [→ Inventory Service] ─── 45ms
#   └── save_order [DB] ─── 20ms
#
# Identifying bottlenecks:
# - check_inventory is slow → optimize Inventory Service
# - DB write is slow → add index
```

### 5.2 Health Check Pattern

```python
"""Health check implementation for microservices"""
from fastapi import FastAPI
from datetime import datetime
import psycopg2
import redis

app = FastAPI()

@app.get("/health/live")
async def liveness():
    """Liveness: is the process alive? (K8s livenessProbe)"""
    return {"status": "alive"}

@app.get("/health/ready")
async def readiness():
    """Readiness: can the service accept requests? (K8s readinessProbe)"""
    checks = {}

    # DB connection check
    try:
        conn = psycopg2.connect(DB_DSN, connect_timeout=2)
        conn.close()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Redis connection check
    try:
        r = redis.Redis.from_url(REDIS_URL, socket_timeout=2)
        r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    # Dependent service check
    for service_name, url in SERVICE_REGISTRY.items():
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{url}/health/live")
                checks[service_name] = "ok" if resp.status_code == 200 else "degraded"
        except Exception:
            checks[service_name] = "unreachable"

    all_ok = all(v == "ok" for v in checks.values())

    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat(),
    }

# Kubernetes manifest example:
# livenessProbe:
#   httpGet:
#     path: /health/live
#     port: 8080
#   initialDelaySeconds: 10
#   periodSeconds: 10
#   failureThreshold: 3
#
# readinessProbe:
#   httpGet:
#     path: /health/ready
#     port: 8080
#   initialDelaySeconds: 5
#   periodSeconds: 5
#   failureThreshold: 2
```

---

## 6. Comparison Tables

### Comparison Table 1: Monolith vs Microservices

| Item | Monolith | Microservices |
|------|---------|---------------|
| Deployment | All at once | Independent per service |
| Scaling | Scale entire system | Scale each service independently |
| Tech stack | Unified (1 language/1 framework) | Free choice per service |
| Database | One shared DB | Independent DB per service |
| Transactions | ACID (single DB) | Eventual consistency (Saga, etc.) |
| Testing | Easy integration tests | Complex E2E tests |
| Debugging | Traceable via stack trace | Requires distributed tracing |
| Team | Everyone on same codebase | Teams own their services |
| Initial dev speed | Fast | Slow (infrastructure setup cost) |
| Long-term maintainability | Codebase tends to bloat | Complexity divided by service boundaries |
| Failure impact | One bug affects everything | Failures are isolated |
| Operational cost | Low | High (K8s, Service Mesh, monitoring) |

### Comparison Table 2: Team Size and Architecture Fit

| Team Size | Recommended Architecture | Reason |
|-----------|-----------------|------|
| 1-5 people | Monolith | Minimum overhead, everyone understands the full codebase |
| 5-15 people | Modular Monolith | Clear boundaries through module split, single deployment |
| 15-50 people | Monolith → MS migration | Incremental extraction with Strangler Fig |
| 50+ people | Microservices | Teams own services, independent development and deployment |

### Comparison Table 3: Inter-Service Communication Methods

| Method | Latency | Reliability | Coupling | Use Case |
|------|----------|--------|--------|------------|
| REST (HTTP) | Medium | Low (sync) | Medium | CRUD APIs, public APIs |
| gRPC | Low | Low (sync) | High (schema) | High-speed internal service communication |
| Message Queue | High | High (async) | Low | Event-driven, async processing |
| GraphQL Federation | Medium | Medium | Medium | BFF (Backend for Frontend) |

| Decision Criteria | REST | gRPC | Message Queue |
|---------|------|------|---------------|
| Real-time response required | OK | Best | Not suitable |
| Fault tolerance is critical | Not suitable | Not suitable | Best |
| Strict latency requirements | OK | Best | Not suitable |
| Large data streaming | Not suitable | Best | OK |
| Loose coupling between services | Medium | Tight | Loose |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Distributed Monolith

```python
# NG: Split into microservices but still tightly coupled
class DistributedMonolith:
    """Typical example of a distributed monolith"""

    def create_order(self, user_id: str, items: list):
        # Problem 1: All services tightly coupled via synchronous HTTP
        user = requests.get(f"http://user-service/users/{user_id}").json()
        inventory = requests.post(
            "http://inventory-service/check", json=items
        ).json()
        payment = requests.post(
            "http://payment-service/charge",
            json={"user_id": user_id, "amount": 100}
        ).json()
        notification = requests.post(
            "http://notification-service/send",
            json={"user_id": user_id, "type": "order"}
        ).json()

        # Problem 2: Failure in one service cascades to everything
        # notification-service returns 503 → entire order fails
        # → Worst configuration: gets only the downsides of microservices

        # Problem 3: Still using a shared database
        # → All services depend on the same DB schema
        # → Schema changes require redeployment of all services

# OK: Correct microservices design
class ProperMicroservice:
    """Loosely coupled microservices"""

    def create_order(self, user_id: str, items: list):
        # 1. Minimize necessary sync calls + timeout + fallback
        try:
            user = await self.user_client.get(
                f"/users/{user_id}", timeout=3.0
            )
        except Exception:
            user = {"id": user_id}  # Fallback: from cache

        # 2. Create order (write to this service's DB)
        order = await self.save_order(user_id, items)

        # 3. Handle the rest via async events
        await self.publish_event("order_created", {
            "order_id": order.id,
            "user_id": user_id,
            "items": items,
        })
        # → Inventory service consumes event and decrements stock
        # → Payment service consumes event and charges
        # → Notification service consumes event and sends notification
        # → Each service processes independently; failures are isolated

        return {"order_id": order.id, "status": "processing"}
```

### Anti-Pattern 2: Premature Microservices

```python
# NG: Startup starts with 20 microservices on Day 1
class PrematureMicroservices:
    """Premature microservices decomposition"""
    services = [
        "user-service", "auth-service", "profile-service",
        "order-service", "cart-service", "inventory-service",
        "payment-service", "notification-service", "email-service",
        "search-service", "recommendation-service", "analytics-service",
        "logging-service", "config-service", "gateway-service",
        # ... 20 services total
    ]

    # Problems:
    # - Service boundaries are unclear (domain not yet understood)
    # - Cost of building K8s + Kafka + Jaeger + CI/CD x 20
    # - A 3-person team cannot operate 20 services
    # - Pivoting requires redesigning service boundaries
    # - Initial development speed is 3-5x slower

# OK: The right approach
class MonolithFirst:
    """Start with a monolith, understand the domain, then split"""

    # Phase 1: Build MVP with monolith (3-6 months)
    # - Understand the domain
    # - Validate user needs
    # - Identify candidate service boundaries

    # Phase 2: Migrate to modular monolith (6-12 months)
    # - Define interfaces between modules
    # - Separate DB schema per module
    # - Prepare for future extraction

    # Phase 3: Extract services as needed (12+ months)
    # - Modules with high change frequency
    # - Modules with scalability requirements
    # - Modules owned by a team

    # Martin Fowler:
    # "Almost all the successful microservice stories have started
    #  with a monolith that got too big and was broken up."
    pass
```

### Anti-Pattern 3: Proliferation of Different Tech Stacks Per Service

```python
# NG: Every service uses a different tech stack
class TechStackChaos:
    """Tech stack proliferation"""
    services = {
        "user-service": "Python + Django + PostgreSQL",
        "order-service": "Go + Gin + MongoDB",
        "payment-service": "Java + Spring Boot + MySQL",
        "notification-service": "Node.js + Express + Redis",
        "search-service": "Rust + Actix + Elasticsearch",
        "analytics-service": "Scala + Play + ClickHouse",
    }
    # Problems:
    # - Hard to hire people who know 6 languages
    # - Must maintain shared libraries (auth, logging, metrics) in 6 languages
    # - 6 different CI/CD pipelines
    # - Debugging and troubleshooting is extremely difficult

# OK: Limit tech stack to 2-3 options
class ControlledTechStack:
    """Controlled tech stack"""
    standards = {
        "primary": "Python + FastAPI + PostgreSQL",  # 80% of services
        "performance": "Go + PostgreSQL",             # 15% needing high performance
        "data": "Python + Spark + ClickHouse",       # 5% data pipelines
    }
    # Benefits:
    # - Easy hiring (only need to know 2 languages)
    # - Shared libraries maintained in 2 languages
    # - Easy to move engineers between teams
```

---

## 8. Exercises

### Exercise 1 (Basic): Architecture Selection

For each of the following scenarios, choose between monolith / modular monolith / microservices and explain your reasoning.

```
Scenario A:
- 2-year-old startup
- 4 engineers
- E-commerce site (100K page views/month)
- Want to release MVP in 2 months

Scenario B:
- Large financial institution
- 60 engineers (5 teams x 12 people)
- Payment platform (100M transactions/month)
- Regulatory requirement: independent audit per service

Scenario C:
- Mid-size SaaS company
- 20 engineers
- Currently running a monolith (500K lines of code)
- Scalability issues in some features
```

**Expected Output:**

```
Scenario A: Monolith
Reason: Small team, short release timeline, low traffic.
        No need for microservices infrastructure overhead.
        Too early to split when domain is not yet understood.

Scenario B: Microservices
Reason: Large team, high traffic, independent audit requirements.
        Teams own services and deploy independently.
        Separate payment / user management / reporting.

Scenario C: Modular Monolith → incremental migration to microservices
Reason: Mid-size team, existing monolith, partial scalability issues.
        First clarify module boundaries, then extract bottleneck
        features using the Strangler Fig pattern.
```

### Exercise 2 (Applied): Designing a Saga Pattern

Design the following order processing flow using the Saga pattern.

```
Order processing flow:
1. Reserve inventory (Inventory Service)
2. Charge credit card (Payment Service)
3. Confirm order (Order Service)
4. Arrange shipping (Shipping Service)
5. Send confirmation email (Notification Service)

Tasks:
1. Define the compensation action (rollback) for each step
2. Draw the flow when Step 3 (confirm order) fails
3. Design a strategy for when a compensation action itself fails
4. Choose between Choreography and Orchestration and explain your reasoning
```

**Expected Output:**

```
Compensation actions:
1. Reserve inventory → Cancel reservation
2. Process payment → Issue refund
3. Confirm order → Cancel order
4. Arrange shipping → Cancel shipment
5. Send email → Send cancellation email (or do nothing)

Flow when Step 3 fails:
  Reserve inventory ✓ → Process payment ✓ → Confirm order ✗ → Refund → Cancel reservation
```

### Exercise 3 (Advanced): Migration Plan from Monolith

Create a migration plan to move the following monolithic application to microservices.

```
Current state:
- Python/Django monolith (300K lines)
- Single PostgreSQL instance (120 tables)
- Team: 15 people
- Deployment: once a week (Friday night)
- Monthly requests: 50M

Module structure:
- User management (auth, profile, settings)
- Product catalog (products, categories, search)
- Order management (cart, orders, order history)
- Payment (billing, refunds, statements)
- Notifications (email, push, SMS)
- Reporting (sales aggregation, analytics)

Tasks:
1. Determine the priority order for service extraction and explain your reasoning
2. Design milestones and timeline for each phase
3. Design the data migration strategy
4. List risks and mitigation measures
5. Define success metrics (KPIs)
```

**Expected Output:** Detailed plan per phase (in 3-6 month increments), technical decision rationale, risk mitigation

---

## 9. FAQ

### Q1: What is a Modular Monolith?

**A.** A Modular Monolith is deployed as a single monolith, but internally it is clearly divided into modules (bounded contexts). Modules communicate only through defined interfaces (public APIs), and database tables are schema-separated per module. Direct SQL access to another module's tables is prohibited. It combines the simplicity of a monolith (single deployment, ACID transactions, simple operations) with the loose coupling of microservices (independence between modules, ease of future splitting). Shopify is well known for adopting this architecture at scale. It is best suited for mid-size projects with teams of 5-30 people.

### Q2: How do you handle distributed transactions in microservices?

**A.** There are two main approaches. (1) **Saga pattern** --- Each service executes a local transaction, and on failure, compensation transactions roll things back. There is Choreography (event-driven, each service handles things autonomously) and Orchestration (a central orchestrator controls the flow). Choreography is recommended for 5 steps or fewer; Orchestration for more than that. (2) **Accepting eventual consistency** --- Rather than demanding strict immediate consistency, data is propagated via event-driven mechanisms and the system converges to a consistent state eventually. 2PC (Two-Phase Commit) incurs significant performance penalties and reduces availability, so it is generally avoided in microservices.

### Q3: Do I need a service mesh?

**A.** Not necessary for fewer than 10 services. A service mesh (Istio, Linkerd) provides encryption of inter-service communication (mTLS), traffic management (canary deploys, rate limiting), and observability (distributed tracing) at the infrastructure layer via a sidecar proxy. The learning cost and operational cost (about 10-15% CPU/memory overhead) are high. Consider it when you have 20 or more services, multiple teams, and high reliability/security requirements between services. In many cases, application-layer retries, circuit breakers, and mTLS are sufficient to start with.

### Q4: What is the testing strategy for microservices?

**A.** Apply the test pyramid per service: (1) **Unit tests** --- Business logic within each service. Mock external dependencies. 70% of total. (2) **Integration tests** --- Service + DB, service + MQ combinations. Use Testcontainers to spin up real DB/Redis. 20%. (3) **Contract tests** --- Verify API contracts between services. Use tools like Pact. Automatically verify that the Provider satisfies the Consumer's expected requests/responses. 5%. (4) **E2E tests** --- Minimal. Only the main paths of user scenarios. 5%. Contract tests are especially important because they allow you to guarantee API compatibility without starting all services.

### Q5: Should I use gRPC or REST?

**A.** gRPC is common for internal service-to-service communication; REST for external-facing APIs. gRPC advantages: (1) strong typing via Protocol Buffers, (2) fast HTTP/2-based transport (2-5x faster than REST), (3) bidirectional streaming support, (4) automatic code generation. REST advantages: (1) callable directly from browsers, (2) testable with curl, (3) low learning curve, (4) rich ecosystem. In practice, "external APIs use REST, internal communication uses gRPC, async processing uses message queue" is the most common combination. GraphQL is well suited for the BFF (Backend for Frontend) pattern, where multiple microservices are aggregated to provide frontend-optimized data.

### Q6: Is "Database per Service" an absolute rule in microservices data management?

**A.** In principle, yes — but in practice, you migrate incrementally. "Database per Service" is the foundation of service independence. Without it, schema changes require redeployment of all services (the distributed monolith anti-pattern). However, it is practical to start with "schema per service" (separate schemas within the same PostgreSQL instance) in the early stages of migration. Each service accesses only the tables in its own schema and retrieves other services' data via API. Once operations are stable, physically separate the databases. Using the CQRS pattern to give each service its own read-only data store can resolve the problem of cross-service queries.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| Monolith | Single deployment, ACID guarantees, fast initial development. Best for teams of 5 or fewer |
| Modular Monolith | Simplicity of monolith + module division. Recommended choice for teams of 5-30 |
| Microservices | Independent deploy and scale, team autonomy. Effective for teams of 50+ |
| Selection criteria | Decide based on team size, domain understanding, operational capability, and scalability requirements |
| Migration strategy | Incrementally extract with Strangler Fig. Start with the most loosely coupled module |
| Distributed transactions | Use Saga pattern with compensation. Avoid strong consistency across services |
| Communication method | Sync: REST/gRPC (minimal), Async: Message Queue (recommended) |
| Observability | Distributed tracing (OpenTelemetry + Jaeger) is essential |
| Most important principle | "Start with a monolith, understand the domain, then split as needed" |

---

## Guides to Read Next

- [Clean Architecture](./01-clean-architecture.md) --- Controlling dependencies between modules
- [DDD](./02-ddd.md) --- Designing service boundaries (Bounded Contexts)
- [Event-Driven Architecture](./03-event-driven.md) --- Asynchronous communication between microservices
- [Message Queue](../01-components/02-message-queue.md) --- Asynchronous messaging infrastructure
- [Load Balancer](../01-components/00-load-balancer.md) --- Distributing traffic to services

---

## References

1. **Building Microservices**, 2nd Edition --- Sam Newman (O'Reilly, 2021) --- Comprehensive guide to microservices
2. **MonolithFirst** --- Martin Fowler (2015) --- https://martinfowler.com/bliki/MonolithFirst.html
3. **Microservices Patterns** --- Chris Richardson (Manning, 2018) --- Pattern collection including Saga, CQRS, API Gateway
4. **Domain-Driven Design** --- Eric Evans (Addison-Wesley, 2003) --- Service boundary design using Bounded Contexts
5. **Production-Ready Microservices** --- Susan Fowler (O'Reilly, 2016) --- Operational quality standards for microservices
