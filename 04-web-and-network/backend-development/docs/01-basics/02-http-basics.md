# HTTP Basics — A Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What Is HTTP](#what-is-http)
3. [HTTP Methods](#http-methods)
4. [Status Codes](#status-codes)
5. [Requests and Responses](#requests-and-responses)
6. [Headers](#headers)
7. [Exercises](#exercises)
8. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The fundamentals of the HTTP protocol
- HTTP methods (GET, POST, PUT, DELETE)
- Status codes
- The structure of requests and responses

### Estimated Time: 30–40 minutes

---

## What Is HTTP

### Definition

**HTTP (HyperText Transfer Protocol)** is the protocol (communication convention) used to exchange information between a web browser and a web server.

```
Client                            Server
(Browser)                      (Web Server)
    │                               │
    │  HTTP Request                 │
    │  GET /api/users/1             │
    │───────────────────────────────>│
    │                               │
    │  HTTP Response                │
    │  200 OK                       │
    │  {"id": 1, "name": "Alice"}   │
    │<───────────────────────────────│
```

---

## HTTP Methods

### The Four Primary Methods (CRUD)

| Method | Meaning | CRUD | Example |
|--------|---------|------|---------|
| **GET** | Retrieve | Read | Fetch user information |
| **POST** | Create | Create | Create a new user |
| **PUT/PATCH** | Update | Update | Update user information |
| **DELETE** | Delete | Delete | Delete a user |

### Implementation Example

```python
from fastapi import FastAPI

app = FastAPI()

# GET — retrieve
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    return {"id": user_id, "name": "Alice"}

# POST — create
@app.post("/users")
async def create_user(name: str, email: str):
    return {"id": 1, "name": name, "email": email}

# PUT — full update
@app.put("/users/{user_id}")
async def update_user(user_id: int, name: str, email: str):
    return {"id": user_id, "name": name, "email": email}

# PATCH — partial update
@app.patch("/users/{user_id}")
async def patch_user(user_id: int, name: str = None):
    return {"id": user_id, "name": name}

# DELETE — remove
@app.delete("/users/{user_id}")
async def delete_user(user_id: int):
    return {"message": "Deleted successfully"}
```

---

## Status Codes

### Key Status Codes

#### 2xx — Success

| Code | Meaning | Use Case |
|------|---------|----------|
| **200** | OK | Request completed successfully |
| **201** | Created | Resource created successfully |
| **204** | No Content | Success with no response body |

#### 4xx — Client Errors

| Code | Meaning | Use Case |
|------|---------|----------|
| **400** | Bad Request | Invalid request |
| **401** | Unauthorized | Authentication required |
| **403** | Forbidden | Access denied |
| **404** | Not Found | Resource not found |

#### 5xx — Server Errors

| Code | Meaning | Use Case |
|------|---------|----------|
| **500** | Internal Server Error | Unhandled server error |
| **502** | Bad Gateway | Gateway error |
| **503** | Service Unavailable | Service temporarily unavailable |

### Implementation Example

```python
from fastapi import HTTPException

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user

@app.post("/users")
async def create_user(name: str, email: str):
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = User(name=name, email=email)
    db.add(user)
    db.commit()

    return user, 201  # 201 Created
```

---

## Requests and Responses

### Structure of an HTTP Request

```http
POST /api/users HTTP/1.1
Host: example.com
Content-Type: application/json
Authorization: Bearer eyJhbGc...

{
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Components**:
1. **Request line**: method, path, HTTP version
2. **Headers**: metadata
3. **Body**: data being sent

### Structure of an HTTP Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 52

{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Components**:
1. **Status line**: HTTP version, status code
2. **Headers**: metadata
3. **Body**: data being returned

---

## Headers

### Commonly Used Headers

#### Request Headers

```http
Content-Type: application/json
Authorization: Bearer token123
Accept: application/json
User-Agent: Mozilla/5.0...
```

#### Response Headers

```http
Content-Type: application/json
Content-Length: 123
Cache-Control: no-cache
Set-Cookie: session=abc123
```

### Implementation Example

```python
from fastapi import Header

@app.get("/protected")
async def protected_route(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")

    token = authorization.replace("Bearer ", "")
    user = verify_token(token)

    return {"user": user}
```

---

## Exercises

### Exercise: Call an API with curl

```bash
# GET
curl http://localhost:8000/users/1

# POST
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# DELETE
curl -X DELETE http://localhost:8000/users/1
```

---

## Next Steps

**Next guide**: [03-rest-api-intro.md](./03-rest-api-intro.md) — REST API Design
