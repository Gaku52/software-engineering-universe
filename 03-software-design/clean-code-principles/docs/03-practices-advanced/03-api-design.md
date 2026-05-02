# API Design

> Understand the design principles of RESTful APIs, GraphQL, and gRPC to build consistent, intuitive interfaces — covering naming conventions, versioning, error handling, pagination, security, and testing practices

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|--------|
| HTTP Protocol Basics | Methods, status codes, headers | ../../04-web-and-network/ |
| Clean Code Fundamentals | Naming conventions, function design | 00-naming-conventions.md |
| Error Handling | Basic exception handling patterns | 03-error-handling.md |
| Testing Principles | Test pyramid and test design | [04-testing-principles.md](../01-practices/04-testing-principles.md) |
| Functional Error Handling | Result/Either types | [02-functional-principles.md](./02-functional-principles.md) |

---

## What You Will Learn

1. **RESTful API Design Principles** — Understand and apply resource-oriented design, appropriate HTTP method usage, and status code strategies
2. **API Quality Factors** — Implement standard patterns for versioning, pagination, error responses, and rate limiting
3. **Comparing and Selecting API Styles** — Understand the characteristics of REST vs GraphQL vs gRPC and make informed selection decisions based on project requirements
4. **Security and Authentication** — Understand OAuth 2.0 / JWT / API Key authentication patterns and design secure APIs
5. **API Testing and Documentation** — Practice automated documentation generation with OpenAPI and quality assurance through contract testing

---

## 1. RESTful API Design Principles

### 1.1 Resource Design

```
URL Design Principles

  GOOD: Noun (resource) based
    GET    /users              ← List users
    GET    /users/123          ← Get specific user
    POST   /users              ← Create user
    PUT    /users/123          ← Update user (full)
    PATCH  /users/123          ← Update user (partial)
    DELETE /users/123          ← Delete user

  GOOD: Nested resources
    GET    /users/123/orders         ← List orders for user 123
    POST   /users/123/orders         ← Create order for user 123
    GET    /users/123/orders/456     ← Get specific order

  BAD: Verb based
    POST   /createUser               ← RPC style
    GET    /getUserById?id=123       ← RPC style
    POST   /deleteUser/123           ← Contradicts HTTP method semantics
```

```
Resource Design Decision Flow:

  1. Name resources with nouns (plural)
     /users, /orders, /products

  2. Express relationships through nesting (up to 2 levels recommended)
     /users/123/orders
     NG: /users/123/orders/456/items/789/reviews (too deep)
     OK: /orders/456/items  or  /reviews?item_id=789

  3. Non-resource actions are treated as "action resources"
     POST /orders/456/cancel    ← Cancel order (action)
     POST /users/123/activate   ← Activate user

  4. Search and filtering via query parameters
     GET /products?category=electronics&min_price=1000&sort=price_asc

  5. Bulk operations
     POST /users/bulk-create     ← Bulk create
     PATCH /orders/bulk-update   ← Bulk update
```

### 1.2 HTTP Methods and Status Codes

```
HTTP Method Semantics and Safety

  Method    Meaning        Idempotent  Safe    Request Body
  ─────────────────────────────────────────────────────────
  GET       Retrieve       YES         YES     None
  HEAD      Get headers    YES         YES     None
  POST      Create         NO          NO      Yes
  PUT       Full update    YES         NO      Yes
  PATCH     Partial update YES         NO      Yes
  DELETE    Delete         YES         NO      Usually none
  OPTIONS   Check spec     YES         YES     None

  Safe: Does not modify server state
  Idempotent: Same result no matter how many times the request is sent
    Example: Sending DELETE /users/123 twice:
        1st time: Delete success (200)
        2nd time: Already gone (404) ← State is the same
```

```
Response Status Codes

  2xx Success
  ├── 200 OK              - Retrieve/update success
  ├── 201 Created         - Create success (+ Location header)
  ├── 202 Accepted        - Async operation accepted
  └── 204 No Content      - Delete success (no response body)

  3xx Redirect
  ├── 301 Moved Permanently - Resource permanently moved
  └── 304 Not Modified      - Cache valid (ETag match)

  4xx Client Error
  ├── 400 Bad Request     - Malformed request
  ├── 401 Unauthorized    - Authentication failed
  ├── 403 Forbidden       - Authorization failed (insufficient permissions)
  ├── 404 Not Found       - Resource not found
  ├── 405 Method Not Allowed - Method not permitted
  ├── 409 Conflict        - Conflict (e.g., duplicate creation)
  ├── 422 Unprocessable   - Validation error
  └── 429 Too Many Req    - Rate limit exceeded

  5xx Server Error
  ├── 500 Internal Error  - Internal server error
  ├── 502 Bad Gateway     - Upstream service error
  └── 503 Service Unavail - Under maintenance
```

### 1.3 Status Code Selection Flowchart

```
Status Code Decision for Request Processing:

  Request received
    │
    ├── Did authentication pass?
    │   └── NO → 401 Unauthorized
    │
    ├── Did authorization pass?
    │   └── NO → 403 Forbidden
    │
    ├── Is the request format valid?
    │   └── NO → 400 Bad Request
    │
    ├── Does the resource exist?
    │   └── NO → 404 Not Found
    │
    ├── Did validation pass?
    │   └── NO → 422 Unprocessable Entity
    │
    ├── Are there any business rule conflicts?
    │   └── YES (conflict) → 409 Conflict
    │
    ├── Did processing succeed?
    │   ├── Create → 201 Created
    │   ├── Delete → 204 No Content
    │   ├── Async  → 202 Accepted
    │   └── Other  → 200 OK
    │
    └── Server error → 500 Internal Server Error
```

---

## 2. Error Response Design

### 2.1 Unified Error Format

```python
# Unified error response format (compliant with RFC 7807 Problem Details)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

class ProblemDetail(BaseModel):
    """RFC 7807 Problem Details for HTTP APIs"""
    type: str              # URI for the error type
    title: str             # Human-readable error title
    status: int            # HTTP status code
    detail: Optional[str]  # Detailed error description
    instance: Optional[str]  # Request URI where the error occurred
    errors: Optional[list[dict]] = None  # Validation error details

app = FastAPI()

# Error handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=ProblemDetail(
            type=f"https://api.example.com/errors/{exc.detail.get('code', 'unknown')}",
            title=exc.detail.get("title", "Error"),
            status=exc.status_code,
            detail=exc.detail.get("detail"),
            instance=str(request.url),
            errors=exc.detail.get("errors"),
        ).model_dump(exclude_none=True),
    )
```

### 2.2 Error Response Examples

```python
# Validation error (422)
{
    "type": "https://api.example.com/errors/validation_error",
    "title": "Validation Error",
    "status": 422,
    "detail": "There are problems with the input data",
    "instance": "/api/v1/users",
    "errors": [
        {"field": "email", "message": "Invalid email address format", "code": "invalid_format"},
        {"field": "age", "message": "Age must be a non-negative integer", "code": "out_of_range"}
    ]
}

# Authentication error (401)
{
    "type": "https://api.example.com/errors/authentication_required",
    "title": "Authentication Required",
    "status": 401,
    "detail": "Authentication is required to access this resource"
}

# Rate limit (429)
{
    "type": "https://api.example.com/errors/rate_limit_exceeded",
    "title": "Rate Limit Exceeded",
    "status": 429,
    "detail": "Request limit reached. Please retry after 60 seconds",
    "retry_after": 60
}

# Business rule violation (409)
{
    "type": "https://api.example.com/errors/insufficient_stock",
    "title": "Insufficient Stock",
    "status": 409,
    "detail": "Insufficient stock for product 'MacBook Pro' (requested: 5, available: 2)"
}
```

### 2.3 Error Code System Design

```
Error Code Naming Convention:

  {domain}_{category}_{detail}

  Examples:
    AUTH_TOKEN_EXPIRED         - Authentication token expired
    AUTH_INVALID_CREDENTIALS   - Invalid credentials
    USER_NOT_FOUND            - User not found
    USER_EMAIL_DUPLICATE      - Duplicate email address
    ORDER_INSUFFICIENT_STOCK  - Insufficient stock
    ORDER_ALREADY_CANCELLED   - Already cancelled
    PAYMENT_CARD_DECLINED     - Card payment declined
    RATE_LIMIT_EXCEEDED       - Rate limit exceeded

  Benefits:
  ├── Clients can programmatically identify error types
  ├── Error dictionaries can be auto-generated
  ├── Can be used as keys for i18n (internationalization)
  └── Can be used as conditions for log searches and alert configurations
```

---

## 3. Pagination

### 3.1 Cursor-Based vs Offset-Based

```
[Offset-Based]
  GET /users?page=3&per_page=20

  Response:
  {
    "data": [...],
    "pagination": {
      "page": 3,
      "per_page": 20,
      "total": 150,
      "total_pages": 8
    }
  }

  Pros: Simple, can jump to any page
  Cons: Performance degrades with large data sets (OFFSET N)

[Cursor-Based]
  GET /users?cursor=eyJpZCI6MTAwfQ&limit=20

  Response:
  {
    "data": [...],
    "pagination": {
      "next_cursor": "eyJpZCI6MTIwfQ",
      "has_next": true
    }
  }

  Pros: Fast even with large data sets, consistent results
  Cons: Cannot jump to arbitrary pages
```

```
Pagination Method Selection Criteria:

  Requirement                         Recommended Method
  ────────────────────────────────────────
  Admin panel list (<100k records)    Offset
  SNS timeline                        Cursor
  Search results (page jump needed)   Offset
  Real-time feed                      Cursor
  Data export                         Cursor
  Log search                          Cursor
  E-commerce product list             Hybrid*

  *Hybrid: Use offset for the first few pages,
   switch to cursor for deeper pages
```

### 3.2 Cursor-Based Implementation

```python
# Cursor-based pagination (FastAPI)
from fastapi import FastAPI, Query
import base64, json

app = FastAPI()

@app.get("/api/v1/users")
async def list_users(
    cursor: str = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100, description="Number of results to fetch"),
):
    # Decode cursor
    if cursor:
        decoded = json.loads(base64.b64decode(cursor))
        last_id = decoded['id']
        query = "SELECT * FROM users WHERE id > %s ORDER BY id LIMIT %s"
        users = db.execute(query, (last_id, limit + 1))
    else:
        query = "SELECT * FROM users ORDER BY id LIMIT %s"
        users = db.execute(query, (limit + 1,))

    users = list(users)
    has_next = len(users) > limit
    if has_next:
        users = users[:limit]

    # Generate next cursor
    next_cursor = None
    if has_next and users:
        next_cursor = base64.b64encode(
            json.dumps({"id": users[-1].id}).encode()
        ).decode()

    return {
        "data": [user.to_dict() for user in users],
        "pagination": {
            "next_cursor": next_cursor,
            "has_next": has_next,
            "limit": limit,
        }
    }
```

### 3.3 Cursor with Compound Sort

```python
# Cursor-based pagination with compound conditions
# Example: sorted by created_at DESC, id DESC

@app.get("/api/v1/orders")
async def list_orders(
    cursor: str = Query(None),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None, description="Status filter"),
):
    if cursor:
        decoded = json.loads(base64.b64decode(cursor))
        # Compound cursor: uniquely identify by id when created_at values are equal
        query = """
            SELECT * FROM orders
            WHERE (created_at, id) < (%s, %s)
            {status_filter}
            ORDER BY created_at DESC, id DESC
            LIMIT %s
        """
        params = [decoded["created_at"], decoded["id"]]
    else:
        query = """
            SELECT * FROM orders
            {status_filter}
            ORDER BY created_at DESC, id DESC
            LIMIT %s
        """
        params = []

    # Dynamically add status filter
    if status:
        status_filter = "AND status = %s"
        params.append(status)
    else:
        status_filter = ""

    query = query.replace("{status_filter}", status_filter)
    params.append(limit + 1)
    orders = db.execute(query, params)

    orders = list(orders)
    has_next = len(orders) > limit
    if has_next:
        orders = orders[:limit]

    next_cursor = None
    if has_next and orders:
        last = orders[-1]
        next_cursor = base64.b64encode(json.dumps({
            "created_at": last.created_at.isoformat(),
            "id": last.id,
        }).encode()).decode()

    return {
        "data": [o.to_dict() for o in orders],
        "pagination": {"next_cursor": next_cursor, "has_next": has_next},
    }
```

---

## 4. Versioning

### 4.1 Comparing Versioning Strategies

```
Versioning Method Comparison:

  Method              Example                         Pros                        Cons
  ──────────────────────────────────────────────────────────────────────────────
  URL path            /api/v1/users                   Most explicit, easy routing  URL changes
  Query parameter     /api/users?version=1            Clean URL path               Easy to overlook
  Header              Accept: application/vnd.        No URL change               Hard to test
                      api.v1+json
  Content             Accept: application/            High flexibility            Complex to implement
  negotiation         vnd.api+json; version=1

  Recommended: URL path-based (most widely adopted, intuitively understood by developers)
```

### 4.2 Versioning Implementation

```python
# URL path based (most common)
# GET /api/v1/users
# GET /api/v2/users

from fastapi import APIRouter

v1_router = APIRouter(prefix="/api/v1")
v2_router = APIRouter(prefix="/api/v2")

@v1_router.get("/users/{user_id}")
async def get_user_v1(user_id: int):
    """v1: returns the name field"""
    user = await get_user(user_id)
    return {"id": user.id, "name": user.name, "email": user.email}

@v2_router.get("/users/{user_id}")
async def get_user_v2(user_id: int):
    """v2: split into first_name / last_name"""
    user = await get_user(user_id)
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
    }
```

### 4.3 Version Deprecation Policy

```
API Version Deprecation Lifecycle:

  v1 release ──── v2 release ──── v1 deprecation notice ──── v1 sunset
      │               │                │                          │
      │               │                │ Sunset header            │
      │               │                │ added                    │
      └───── Live ─────┴── Migration period ────┴── Sunset ────────┘
                       (6-12 months)

  Deprecation notice implementation:
  ┌──────────────────────────────────────────────────┐
  │ HTTP/1.1 200 OK                                   │
  │ Sunset: Sat, 01 Mar 2026 00:00:00 GMT             │
  │ Deprecation: true                                  │
  │ Link: <https://api.example.com/docs/migration>;    │
  │       rel="deprecation"                            │
  └──────────────────────────────────────────────────┘

  Client actions:
  1. Monitor the Sunset header and migrate before the deprecation date
  2. Detect deprecated API usage via logs/alerts
  3. Handle automatically by upgrading SDK version
```

---

## 5. Authentication and Authorization

### 5.1 Comparing Authentication Patterns

```
Authentication Method Comparison:

  Method        Security    Implementation Cost    Best Use Case
  ──────────────────────────────────────────────────────
  API Key       Low         Low                    Internal APIs, server-to-server
  Basic Auth    Low         Lowest                 Dev environments, internal tools
  Bearer Token  Medium      Medium                 Mobile apps, SPAs
  (JWT)
  OAuth 2.0     High        High                   Third-party integrations
  mTLS          Highest     Highest                Between microservices
```

### 5.2 JWT Authentication Implementation

```python
# FastAPI + JWT authentication
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from datetime import datetime, timedelta

app = FastAPI()
security = HTTPBearer()

SECRET_KEY = "your-secret-key"  # In practice, load from environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(user_id: str, roles: list[str]) -> str:
    """Generate access token"""
    payload = {
        "sub": user_id,
        "roles": roles,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Token verification middleware"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail={
            "code": "AUTH_TOKEN_EXPIRED",
            "title": "Token Expired",
            "detail": "The authentication token has expired",
        })
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail={
            "code": "AUTH_INVALID_TOKEN",
            "title": "Invalid Token",
            "detail": "The authentication token is invalid",
        })

def require_role(required_role: str):
    """Role-based authorization"""
    def role_checker(token: dict = Depends(verify_token)):
        if required_role not in token.get("roles", []):
            raise HTTPException(status_code=403, detail={
                "code": "AUTH_INSUFFICIENT_PERMISSIONS",
                "title": "Forbidden",
                "detail": f"The '{required_role}' role is required for this operation",
            })
        return token
    return role_checker

# Usage examples
@app.get("/api/v1/users")
async def list_users(token: dict = Depends(verify_token)):
    """Authentication-required endpoint"""
    return {"users": [...]}

@app.delete("/api/v1/users/{user_id}")
async def delete_user(user_id: str, token: dict = Depends(require_role("admin"))):
    """Requires admin role"""
    pass
```

### 5.3 API Security Checklist

```
API Security Essentials:

  Authentication & Authorization
  ├── [x] Authentication configured for all endpoints (public APIs explicitly excluded)
  ├── [x] Short token expiry (access: 15-30 min, refresh: 7-30 days)
  ├── [x] Role-Based Access Control (RBAC) implemented
  └── [x] Authorization checked at the resource level (users can only operate on their own data)

  Input Validation
  ├── [x] All input validated server-side
  ├── [x] SQL injection prevention (parameterized queries)
  ├── [x] XSS prevention (output escaping, explicit Content-Type)
  └── [x] Path parameter validation (prevent ../traversal)

  Communication
  ├── [x] HTTPS enforced (HSTS header)
  ├── [x] CORS configured (allowed origins explicitly listed)
  └── [x] No unnecessary information in responses (remove Server header)

  Rate Limiting
  ├── [x] Per-endpoint rate limiting
  ├── [x] 429 responses include Retry-After header
  └── [x] Limit authentication attempts (brute force protection)
```

---

## 6. OpenAPI (Swagger) Documentation

### 6.1 Automatic Documentation Generation

```python
# Automatic documentation generation with FastAPI
from fastapi import FastAPI, Query, Path, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

app = FastAPI(
    title="Order Management API",
    version="1.0.0",
    description="RESTful API for managing orders on an e-commerce site",
)

class OrderStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"

class OrderItemCreate(BaseModel):
    """Order item"""
    product_id: str = Field(..., description="Product ID", example="prod-456")
    quantity: int = Field(..., ge=1, le=100, description="Quantity", example=2)

class OrderCreate(BaseModel):
    """Order creation request"""
    user_id: str = Field(..., description="User ID", example="user-123")
    items: list[OrderItemCreate] = Field(
        ..., description="Order items", min_length=1
    )
    note: Optional[str] = Field(None, max_length=500, description="Notes")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "user_id": "user-123",
                    "items": [
                        {"product_id": "prod-456", "quantity": 2},
                        {"product_id": "prod-789", "quantity": 1},
                    ],
                    "note": "Please deliver in the morning",
                }
            ]
        }
    }

class OrderResponse(BaseModel):
    """Order response"""
    id: str = Field(..., description="Order ID")
    status: OrderStatus = Field(..., description="Order status")
    total_amount: int = Field(..., description="Total amount (in cents)")
    created_at: str = Field(..., description="Creation datetime (ISO 8601)")

@app.post(
    "/api/v1/orders",
    response_model=OrderResponse,
    status_code=201,
    summary="Create order",
    tags=["Orders"],
    responses={
        409: {"description": "Insufficient stock"},
        422: {"description": "Validation error"},
    },
)
async def create_order(order: OrderCreate):
    """Create a new order.

    - At least one order item is required
    - Returns 409 Conflict if out of stock
    - Returns 201 Created + Location header on success
    """
    result = await order_service.create(order)
    return result
```

### 6.2 Contract Testing

```python
# Contract testing based on OpenAPI schema
import pytest
from fastapi.testclient import TestClient
from jsonschema import validate

client = TestClient(app)

class TestOrderAPI:
    """Contract tests for the Order API"""

    def test_create_order_returns_201(self):
        """Happy path: order creation returns 201"""
        response = client.post("/api/v1/orders", json={
            "user_id": "user-123",
            "items": [{"product_id": "prod-456", "quantity": 2}],
        })
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert "status" in data
        assert data["status"] == "pending"

    def test_create_order_with_empty_items_returns_422(self):
        """Error case: empty items returns 422"""
        response = client.post("/api/v1/orders", json={
            "user_id": "user-123",
            "items": [],
        })
        assert response.status_code == 422

    def test_create_order_without_auth_returns_401(self):
        """Error case: no authentication returns 401"""
        response = client.post("/api/v1/orders", json={
            "user_id": "user-123",
            "items": [{"product_id": "prod-456", "quantity": 2}],
        }, headers={})  # No Authorization header
        assert response.status_code == 401

    def test_list_orders_pagination(self):
        """Pagination: next_cursor is returned"""
        response = client.get("/api/v1/orders?limit=2")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert "has_next" in data["pagination"]

    def test_response_matches_schema(self):
        """Response conforms to the OpenAPI schema"""
        expected_schema = {
            "type": "object",
            "required": ["id", "status", "total_amount", "created_at"],
            "properties": {
                "id": {"type": "string"},
                "status": {"type": "string", "enum": ["pending", "confirmed", "shipped", "delivered", "cancelled"]},
                "total_amount": {"type": "integer"},
                "created_at": {"type": "string"},
            },
        }
        response = client.post("/api/v1/orders", json={
            "user_id": "user-123",
            "items": [{"product_id": "prod-456", "quantity": 1}],
        })
        validate(response.json(), expected_schema)
```

---

## 7. Rate Limiting

### 7.1 Rate Limiting Design

```
Rate Limiting Algorithm Comparison:

  Algorithm         Characteristics            Pros                   Cons
  ──────────────────────────────────────────────────────────────────
  Fixed window      Count per time window      Simple to implement    Bursts at window boundaries
  Sliding window    Continuous time window     Uniform limiting       High memory usage
  Token bucket      Refill tokens at fixed rate  Allows bursts       Parameter tuning is tricky
  Leaky bucket      Process at fixed rate      Stable output          No burst tolerance

  Recommended: Token bucket (balance between burst support and ease of implementation)
```

```python
# Rate limiting implementation (FastAPI + Redis)
import redis
from fastapi import Request, HTTPException
import time

redis_client = redis.Redis(host="localhost", port=6379, db=0)

class RateLimiter:
    """Token bucket rate limiter"""

    def __init__(self, rate: int, per: int):
        """
        rate: number of allowed requests
        per: time window (seconds)
        """
        self.rate = rate
        self.per = per

    async def check(self, key: str) -> tuple[bool, dict]:
        """Check rate limit"""
        now = time.time()
        pipe = redis_client.pipeline()

        # Sliding window
        window_start = now - self.per
        pipe.zremrangebyscore(key, 0, window_start)  # Remove old entries
        pipe.zadd(key, {str(now): now})               # Add current request
        pipe.zcard(key)                                # Count requests in window
        pipe.expire(key, self.per)                     # Set TTL
        _, _, count, _ = pipe.execute()

        remaining = max(0, self.rate - count)
        headers = {
            "X-RateLimit-Limit": str(self.rate),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(int(now + self.per)),
        }

        if count > self.rate:
            headers["Retry-After"] = str(self.per)
            return False, headers
        return True, headers

# Apply as middleware
rate_limiter = RateLimiter(rate=100, per=60)  # 100 requests per 60 seconds

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Identify client (API key or IP)
    client_id = request.headers.get("X-API-Key") or request.client.host
    key = f"rate_limit:{client_id}"

    allowed, headers = await rate_limiter.check(key)

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "type": "https://api.example.com/errors/rate_limit_exceeded",
                "title": "Rate Limit Exceeded",
                "status": 429,
                "detail": f"Up to {rate_limiter.rate} requests per {rate_limiter.per} seconds allowed",
            },
            headers=headers,
        )

    response = await call_next(request)
    for k, v in headers.items():
        response.headers[k] = v
    return response
```

---

## 8. API Style Comparison

### 8.1 REST vs GraphQL vs gRPC

| Characteristic | REST | GraphQL | gRPC |
|------|------|---------|------|
| **Protocol** | HTTP/1.1, HTTP/2 | HTTP (typically POST) | HTTP/2 |
| **Data Format** | JSON | JSON | Protocol Buffers |
| **Type Safety** | Added via OpenAPI | Built-in schema | .proto files |
| **Overfetching** | Tends to occur | Client specifies needed fields | Predefined messages |
| **N+1 Problem** | Depends on endpoint design | Solved with DataLoader | Mitigated with streaming |
| **Caching** | Natural HTTP caching | Difficult (POST only) | Custom implementation |
| **Learning Curve** | Low | Medium | High |
| **Best Use Case** | Public APIs, CRUD-centric | Complex data graphs | Microservice-to-microservice |

| Decision Criteria | REST | GraphQL | gRPC |
|---------|------|---------|------|
| Public API | Best | Good | Not suitable |
| Mobile app | Good | Best | Possible |
| Microservice-to-microservice | Good | Possible | Best |
| Real-time | Add WebSocket | Subscription | Bidirectional streaming |
| File upload | multipart/form-data | Not suitable | Streaming |

### 8.2 GraphQL Implementation Example

```typescript
// GraphQL schema definition
const typeDefs = `
  type User {
    id: ID!
    name: String!
    email: String!
    orders(first: Int, after: String): OrderConnection!
  }

  type Order {
    id: ID!
    status: OrderStatus!
    totalAmount: Int!
    items: [OrderItem!]!
    createdAt: String!
  }

  type OrderItem {
    product: Product!
    quantity: Int!
    price: Int!
  }

  type Product {
    id: ID!
    name: String!
    price: Int!
  }

  type OrderConnection {
    edges: [OrderEdge!]!
    pageInfo: PageInfo!
  }

  type OrderEdge {
    cursor: String!
    node: Order!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  enum OrderStatus {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
  }

  type Query {
    user(id: ID!): User
    orders(userId: ID!, first: Int, after: String): OrderConnection!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    cancelOrder(id: ID!): Order!
  }

  input CreateOrderInput {
    userId: ID!
    items: [OrderItemInput!]!
  }

  input OrderItemInput {
    productId: ID!
    quantity: Int!
  }
`;

// Resolvers (solve N+1 problem with DataLoader)
import DataLoader from "dataloader";

const productLoader = new DataLoader<string, Product>(async (ids) => {
  const products = await db.products.findMany({ where: { id: { in: ids as string[] } } });
  const productMap = new Map(products.map(p => [p.id, p]));
  return ids.map(id => productMap.get(id)!);
});

const resolvers = {
  OrderItem: {
    product: (item: OrderItem) => productLoader.load(item.productId),
  },
};
```

### 8.3 gRPC Definition Example

```protobuf
// order_service.proto
syntax = "proto3";

package order.v1;

service OrderService {
  // Unary RPC: create order
  rpc CreateOrder(CreateOrderRequest) returns (CreateOrderResponse);

  // Unary RPC: get order
  rpc GetOrder(GetOrderRequest) returns (Order);

  // Server streaming: monitor order status
  rpc WatchOrderStatus(WatchOrderStatusRequest) returns (stream OrderStatusUpdate);

  // Client streaming: bulk order creation
  rpc BulkCreateOrders(stream CreateOrderRequest) returns (BulkCreateOrdersResponse);
}

message CreateOrderRequest {
  string user_id = 1;
  repeated OrderItem items = 2;
  string note = 3;
}

message OrderItem {
  string product_id = 1;
  int32 quantity = 2;
}

message Order {
  string id = 1;
  string user_id = 2;
  OrderStatus status = 3;
  int32 total_amount = 4;
  repeated OrderItem items = 5;
  google.protobuf.Timestamp created_at = 6;
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_CONFIRMED = 2;
  ORDER_STATUS_SHIPPED = 3;
  ORDER_STATUS_DELIVERED = 4;
  ORDER_STATUS_CANCELLED = 5;
}
```

---

## 9. API Design Best Practices

### 9.1 Naming Conventions

```
API Naming Conventions:

  URL path:
    ├── Lowercase only
    ├── Hyphen-separated words (kebab-case)
    ├── Resource names in plural
    └── No trailing slash

    GOOD: /api/v1/order-items
    BAD:  /api/v1/orderItems
    BAD:  /api/v1/order_items/

  Query parameters:
    ├── snake_case recommended
    └── Common parameters unified

    GOOD: ?sort_by=created_at&order=desc
    BAD:  ?sortBy=createdAt&order=DESC

  Response body:
    ├── camelCase (for JavaScript clients)
    ├── or snake_case (for Python/Ruby clients)
    └── Consistent within the project

  JSON field naming:
    ├── boolean: is_, has_, can_ prefix
    │   "is_active": true, "has_orders": false
    ├── datetime: ISO 8601 format + _at suffix
    │   "created_at": "2025-03-15T10:30:00Z"
    └── ID: {resource}_id
        "user_id": "usr-123", "order_id": "ord-456"
```

### 9.2 HATEOAS (API Self-Documentation)

```python
# HATEOAS: include navigation links in responses
{
    "data": {
        "id": "ord-123",
        "status": "pending",
        "total_amount": 3500,
        "_links": {
            "self": {"href": "/api/v1/orders/ord-123"},
            "cancel": {"href": "/api/v1/orders/ord-123/cancel", "method": "POST"},
            "items": {"href": "/api/v1/orders/ord-123/items"},
            "user": {"href": "/api/v1/users/usr-456"},
        }
    }
}

# Available actions change depending on status
# status: "shipped" → cancel link is not included
# status: "delivered" → return link is added
```

---

## 10. Anti-Patterns

### 10.1 Anti-Pattern: Misuse of HTTP Methods

```
BAD:
  POST /users/123/delete     ← Should use DELETE
  GET  /users/create?name=A  ← GET should have no side effects
  POST /users/123            ← Use PUT/PATCH for updates

GOOD:
  DELETE /users/123
  POST   /users   (Body: {"name": "A"})
  PATCH  /users/123 (Body: {"name": "B"})
```

**Problem**: Ignoring HTTP method semantics causes caching, browser back button behavior, and HTTP client auto-retry to malfunction. If GET requests have side effects, crawlers and prefetching can cause unintended data modifications.

### 10.2 Anti-Pattern: Inconsistent Response Format

```json
// BAD: different format for each endpoint
// GET /users     → [{"id": 1, "name": "Alice"}]
// GET /orders    → {"results": [{"id": 1}], "count": 10}
// GET /products  → {"data": {"items": [...]}}

// GOOD: unified envelope format
// GET /users
{
  "data": [{"id": 1, "name": "Alice"}],
  "pagination": {"next_cursor": "...", "has_next": true}
}
// GET /orders
{
  "data": [{"id": 1, "status": "placed"}],
  "pagination": {"next_cursor": "...", "has_next": false}
}
```

**Problem**: Automatic client SDK generation becomes difficult. Frontend response parsing logic differs per endpoint, becoming a source of bugs.

### 10.3 Anti-Pattern: Excessively Nested URLs

```
BAD:
  GET /companies/123/departments/456/teams/789/members/012/tasks

  Problems:
  - URL is too long and hard to read
  - All intermediate resource IDs are required
  - Cache granularity becomes coarse

GOOD:
  GET /tasks?team_id=789
  GET /teams/789/members
  GET /members/012/tasks

  Principle: Maximum 2 levels of nesting
  If more than 3 levels are needed, use query parameter filtering
```

**Problem**: Deep nesting forces clients to provide IDs for all parent resources. In large APIs, the flexibility of query parameter filtering is more important than URL expressiveness.

### 10.4 Anti-Pattern: Exposing Internal Structure

```python
# BAD: DB column names and table structure leak directly into response
{
    "user_tbl_id": 123,           # Table name exposed
    "usr_pwd_hash": "abc123...",  # Password hash exposed
    "created_ts": 1710489600,     # Internal timestamp format
    "is_del_flg": 0,              # Internal flag
}

# GOOD: Convert to API DTO before responding
{
    "id": "usr-123",
    "name": "Alice",
    "email": "alice@example.com",
    "created_at": "2025-03-15T10:00:00Z",
}
```

**Problem**: Exposing internal structure is a security risk (providing schema information to attackers) and means DB schema changes directly cause breaking API changes.

---

## 11. Exercises

### Exercise 1 (Basic): REST API Endpoint Design

**Task**: Design an API for an online bookstore. Cover the following resources and operations.

```
Resources: books, authors, reviews, users

Operations:
  1. CRUD for books
  2. Search books by author
  3. Post and retrieve reviews for books
  4. Get user order history
  5. Check book stock
```

**Expected output**:

```
List of endpoints (method, URL, description, status codes)
```

**Model answer**:

```
Books:
  GET    /api/v1/books                    200  List books (with pagination)
  GET    /api/v1/books?author_id=123      200  Filter by author
  GET    /api/v1/books/{id}               200  Book details
  POST   /api/v1/books                    201  Register book (admin)
  PATCH  /api/v1/books/{id}               200  Update book (admin)
  DELETE /api/v1/books/{id}               204  Delete book (admin)
  GET    /api/v1/books/{id}/stock         200  Check stock

Authors:
  GET    /api/v1/authors                  200  List authors
  GET    /api/v1/authors/{id}             200  Author details
  GET    /api/v1/authors/{id}/books       200  Books by author

Reviews:
  GET    /api/v1/books/{id}/reviews       200  List reviews for a book
  POST   /api/v1/books/{id}/reviews       201  Post a review (authentication required)
  PATCH  /api/v1/reviews/{id}             200  Update review (own only)
  DELETE /api/v1/reviews/{id}             204  Delete review (own or admin)

Users:
  GET    /api/v1/users/me                 200  My profile
  GET    /api/v1/users/me/orders          200  Order history
  GET    /api/v1/users/me/reviews         200  My reviews
```

---

### Exercise 2 (Intermediate): Error Response Design

**Task**: Design RFC 7807-compliant error responses for the following error scenarios.

```
Scenarios:
  1. Order fails due to insufficient book stock
  2. Duplicate review for the same book
  3. Authentication token expired
  4. Request body validation errors (multiple fields)
```

**Expected output**:

```json
// JSON response for each scenario (status, type, title, detail, errors)
```

**Model answer**:

```json
// 1. Insufficient stock (409 Conflict)
{
  "type": "https://api.bookstore.com/errors/insufficient_stock",
  "title": "Insufficient Stock",
  "status": 409,
  "detail": "Insufficient stock for book 'Effective Java' (requested: 3, available: 1)",
  "instance": "/api/v1/orders"
}

// 2. Duplicate review (409 Conflict)
{
  "type": "https://api.bookstore.com/errors/duplicate_review",
  "title": "Duplicate Review",
  "status": 409,
  "detail": "A review for this book has already been submitted",
  "instance": "/api/v1/books/book-123/reviews"
}

// 3. Token expired (401 Unauthorized)
{
  "type": "https://api.bookstore.com/errors/token_expired",
  "title": "Token Expired",
  "status": 401,
  "detail": "The authentication token has expired. Please log in again"
}

// 4. Validation error (422 Unprocessable Entity)
{
  "type": "https://api.bookstore.com/errors/validation_error",
  "title": "Validation Error",
  "status": 422,
  "detail": "There are 2 problems with the input data",
  "instance": "/api/v1/books",
  "errors": [
    {"field": "title", "message": "Title must be between 1 and 200 characters", "code": "string_too_short"},
    {"field": "price", "message": "Price must be a non-negative integer", "code": "value_error"}
  ]
}
```

---

### Exercise 3 (Advanced): API Version Migration Strategy Design

**Task**: Design a v1 to v2 migration strategy for the following scenario.

```
Changes:
  v1: GET /api/v1/users/{id} → {"id": 1, "name": "Alice Smith", "email": "..."}
  v2: GET /api/v2/users/{id} → {"id": 1, "first_name": "Alice", "last_name": "Smith", "email": "..."}

Constraints:
  - More than 50 v1 clients exist
  - Mobile apps cannot be updated immediately
  - Migration period is 6 months
```

**Expected output**:

```
1. v2 code implementation
2. v1 deprecation schedule
3. Client notification method
4. v1 compatibility layer
```

**Model answer**:

```python
# 1. Internally unify to v2 data model
class UserModel:
    id: int
    first_name: str
    last_name: str
    email: str

# 2. v1 compatibility layer (adapter)
@v1_router.get("/users/{user_id}")
async def get_user_v1(user_id: int, response: Response):
    user = await user_service.get(user_id)

    # Deprecation notice headers
    response.headers["Sunset"] = "Sat, 01 Sep 2026 00:00:00 GMT"
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = (
        '<https://api.example.com/docs/v1-to-v2-migration>; rel="deprecation"'
    )

    # Convert to v1 format
    return {
        "id": user.id,
        "name": f"{user.first_name} {user.last_name}",  # backward compat
        "email": user.email,
    }

# 3. v2 endpoint
@v2_router.get("/users/{user_id}")
async def get_user_v2(user_id: int):
    user = await user_service.get(user_id)
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
    }

# 4. Deprecation schedule
"""
Month 1: Release v2 + add v1 Deprecation headers
Month 2: Email notification to clients + publish migration guide in docs
Month 3: Monitor v1 usage (access log analysis)
Month 4: Individual notifications to high-usage clients
Month 5: Add warning field to v1 responses
Month 6: Change v1 to 410 Gone and sunset
"""

# 5. Monitor v1 usage
@app.middleware("http")
async def track_api_version(request: Request, call_next):
    if request.url.path.startswith("/api/v1/"):
        client_id = request.headers.get("X-API-Key", "unknown")
        logger.warning(f"Deprecated v1 API access: {client_id} -> {request.url.path}")
        # Record in metrics
        metrics.increment("api.v1.deprecated_access", tags={"client": client_id})
    return await call_next(request)
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured settings file | Check the path and format of the settings file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review configuration |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Review the error message**: Read the stack trace to pinpoint where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List all possible causes
4. **Incremental verification**: Use logging and debuggers to validate hypotheses
5. **Fix and regression test**: After fixing, run tests for related areas as well

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
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in {func.__name__}: {e}")
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

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O wait**: Review disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexes, query optimization |
---

## 12. FAQ

### Q1. When should I version an API?

**A.** Only bump the version when a change breaks backward compatibility. Adding a field is backward compatible and does not require a version bump. Removing a field, renaming a field, or changing a type is incompatible and requires a version bump. Set a deprecation date for old versions and provide a 6-12 month migration period. Use the Sunset header to announce the planned deprecation date.

Specific decision criteria:
- **No version needed (backward compatible)**: Adding a field, adding a new endpoint, adding an optional parameter
- **Version required (incompatible)**: Deleting/renaming a field, changing a type, adding a required parameter, changing the response structure, changing error codes

### Q2. Should I use offset or cursor pagination?

**A.** Decide based on data volume and requirements. If data is small (<100k records) and page jumping is needed, use offset. If there is a large amount of data or real-time updates, use cursor. SNS timelines, log searches, etc. should always use cursor-based pagination. Offset is usually sufficient for admin panel list views.

Cursor caveat: If the sort condition changes, the cursor becomes invalid. Either include the sort condition in the cursor, or design the system to restart from the beginning when the sort changes.

### Q3. Is it acceptable to use both REST and GraphQL in the same project?

**A.** Using both is a rational choice. A common approach is to use REST for the public API (caching, simplicity) and GraphQL for the frontend BFF (flexible data fetching). However, considering team learning costs and operational overhead, small teams are often better off standardizing on one approach.

### Q4. Should API responses include null or omit fields?

**A.** Including null is safer. Omitting fields makes it impossible to distinguish between "data is absent" and "the field does not exist." However, for PATCH request bodies, there is a meaningful difference between omitting and null, since only fields that are sent should be updated.

```json
// Recommended: explicitly include null
{"name": "Alice", "nickname": null, "avatar_url": null}

// Not recommended: omit fields (unclear whether nickname exists)
{"name": "Alice"}
```

### Q5. What datetime format should API responses use?

**A.** Use ISO 8601 format (UTC) as the standard. Return timestamps as `"2025-03-15T10:30:00Z"` with the timezone always as Z (UTC). Let the client convert to the local timezone. Avoid Unix timestamps (low readability and ambiguous precision interpretation).

### Q6. How should I design an API for large file uploads?

**A.** The following 3-step approach is recommended:

1. **Get upload URL**: `POST /api/v1/uploads` → returns a presigned URL
2. **Direct upload**: Client uploads directly to S3/GCS (bypassing the API server)
3. **Upload completion notification**: `POST /api/v1/uploads/{id}/complete` → server saves metadata

This avoids consuming API server bandwidth and supports large files (GB-scale).

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Item | Key Points |
|------|---------|
| Resource design | Noun-based URLs, HTTP methods express operations. Max 2 levels of nesting |
| Status codes | Accurately distinguish 2xx/4xx/5xx. Use flowchart to decide |
| Error responses | RFC 7807 compliant (type, title, status, detail, errors) |
| Pagination | Offset for small scale, cursor for large scale |
| Versioning | URL path-based, Sunset header for deprecation notice |
| Auth & authz | JWT + RBAC, comply with security checklist |
| Rate limiting | Token bucket, X-RateLimit-* headers |
| Documentation | Auto-generate with OpenAPI (Swagger) + contract tests |
| API style selection | Public API=REST, BFF=GraphQL, internal comms=gRPC |
| Naming conventions | URL=kebab-case, query=snake_case, JSON=unified |

```
API Design Quality Check Flow:

  Design complete
    │
    ├── Are resources and URLs intuitive?
    ├── Are status codes accurate?
    ├── Are error responses unified?
    ├── Is pagination appropriate?
    ├── Is auth/authz configured for all endpoints?
    ├── Is rate limiting configured?
    ├── Is the OpenAPI documentation up to date?
    ├── Do contract tests pass?
    └── Is backward compatibility maintained?
```

---

## Guides to Read Next

- [04-code-review-checklist.md](./04-code-review-checklist.md) — Code review checklist (API code review perspective)
- [../01-practices/04-testing-principles.md](../01-practices/04-testing-principles.md) — Testing principles (API test design)
- [02-functional-principles.md](./02-functional-principles.md) — Functional programming principles (API error handling with Result types)
- [../../../system-design-guide/docs/03-case-studies/03-rate-limiter.md](../../../system-design-guide/docs/03-case-studies/03-rate-limiter.md) — Rate limiter design in depth
- ../../system-design-guide/docs/01-components/ — System design components (load balancer, cache)
- ../../design-patterns-guide/docs/04-architectural/ — Architectural patterns (BFF, API Gateway)
- ../../04-web-and-network/ — Web/network fundamentals (HTTP, TLS, DNS)

---

## References

1. **RESTful Web APIs** — Leonard Richardson & Mike Amundsen (O'Reilly, 2013) — Comprehensive guide to REST design
2. **API Design Patterns** — JJ Geewax (Manning, 2021) — Catalog of API design patterns
3. **Google API Design Guide** — https://cloud.google.com/apis/design — Google's API design standards
4. **Microsoft REST API Guidelines** — https://github.com/microsoft/api-guidelines — Microsoft's REST API guidelines
5. **RFC 7807: Problem Details for HTTP APIs** — https://www.rfc-editor.org/rfc/rfc7807 — Standard for error responses
6. **Stripe API Reference** — https://stripe.com/docs/api — Example of excellent API design
7. **GitHub REST API** — https://docs.github.com/en/rest — Example of a large-scale REST API
8. **GraphQL Official Documentation** — https://graphql.org/learn/ — Official GraphQL documentation
9. **gRPC Official Documentation** — https://grpc.io/docs/ — Official gRPC documentation
10. **OWASP API Security Top 10** — https://owasp.org/www-project-api-security/ — API security best practices
