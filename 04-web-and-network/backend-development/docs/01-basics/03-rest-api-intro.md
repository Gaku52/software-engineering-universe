# REST API Introduction — A Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What Is a REST API](#what-is-a-rest-api)
3. [The Six REST Constraints](#the-six-rest-constraints)
4. [Resource Design](#resource-design)
5. [Endpoint Design](#endpoint-design)
6. [Implementation Example](#implementation-example)
7. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The core concepts of REST APIs
- RESTful design principles
- Endpoint naming conventions
- Implementing CRUD operations

### Estimated Time: 40–50 minutes

---

## What Is a REST API

### Definition

**REST (Representational State Transfer)** is an architectural style for designing web APIs.

**Characteristics**:
- Stateless (no session stored on the server)
- Resource-oriented
- Uses HTTP methods deliberately
- Exchanges data in JSON format

---

## The Six REST Constraints

### 1. Client-Server Separation

```
Client ←→ Server
(independent)   (independent)
```

### 2. Stateless

The server holds no client state between requests.

```python
# ❌ Stateful (uses session)
@app.get("/cart")
def get_cart(session: Session):
    return session.cart

# ✅ Stateless (authenticates via token)
@app.get("/cart")
def get_cart(token: str = Header(...)):
    user = verify_token(token)
    return db.query(Cart).filter(Cart.user_id == user.id).all()
```

### 3. Cacheable

Responses include caching information.

```python
from fastapi import Response

@app.get("/users/{user_id}")
def get_user(user_id: int, response: Response):
    response.headers["Cache-Control"] = "max-age=3600"  # cache for 1 hour
    return {"id": user_id, "name": "Alice"}
```

### 4. Uniform Interface

APIs follow consistent patterns.

### 5. Layered System

```
Client → Load Balancer → API Server → Database
```

### 6. Code on Demand (Optional)

The server may deliver executable code (e.g., JavaScript) to the client.

---

## Resource Design

### What Is a Resource

A resource is the "thing" operated on by an API.

**Examples**:
- Users (`users`)
- Posts (`posts`)
- Comments (`comments`)

### Representing Resources

```
/users          - list of users
/users/1        - user with ID=1
/users/1/posts  - posts belonging to user with ID=1
```

---

## Endpoint Design

### Standard Patterns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users | Retrieve a list of users |
| GET | /users/:id | Retrieve a specific user |
| POST | /users | Create a user |
| PUT | /users/:id | Replace a user (full update) |
| PATCH | /users/:id | Update a user (partial) |
| DELETE | /users/:id | Delete a user |

### Naming Conventions

```python
# ✅ Good examples (plural, lowercase, hyphens)
GET /users
GET /blog-posts
GET /user-profiles

# ❌ Bad examples
GET /getUsers        # do not use verbs
GET /Users           # use lowercase
GET /user            # use plural form
```

### Nested Resources

```python
# Posts belonging to a user
GET /users/1/posts

# Comments on a post
GET /posts/1/comments

# ❌ Too deeply nested (limit to 3 levels)
GET /users/1/posts/1/comments/1/likes  # avoid this
```

---

## Implementation Example

### REST API with FastAPI

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI()

# Model definition
class User(BaseModel):
    id: int
    name: str
    email: str

# Dummy database
users_db: List[User] = [
    User(id=1, name="Alice", email="alice@example.com"),
    User(id=2, name="Bob", email="bob@example.com")
]

# GET /users — list
@app.get("/users", response_model=List[User])
async def get_users():
    return users_db

# GET /users/:id — detail
@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    user = next((u for u in users_db if u.id == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# POST /users — create
@app.post("/users", response_model=User, status_code=201)
async def create_user(name: str, email: str):
    new_id = max([u.id for u in users_db], default=0) + 1
    new_user = User(id=new_id, name=name, email=email)
    users_db.append(new_user)
    return new_user

# PUT /users/:id — replace
@app.put("/users/{user_id}", response_model=User)
async def update_user(user_id: int, name: str, email: str):
    user = next((u for u in users_db if u.id == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name = name
    user.email = email
    return user

# DELETE /users/:id — delete
@app.delete("/users/{user_id}")
async def delete_user(user_id: int):
    global users_db
    users_db = [u for u in users_db if u.id != user_id]
    return {"message": "Deleted successfully"}
```

### Query Parameters

```python
# GET /users?limit=10&offset=0
@app.get("/users")
async def get_users(limit: int = 10, offset: int = 0):
    return users_db[offset:offset+limit]

# GET /users?name=Alice
@app.get("/users")
async def search_users(name: str = None):
    if name:
        return [u for u in users_db if name in u.name]
    return users_db
```

---

## Next Steps

**Next guide**: [04-database-intro.md](./04-database-intro.md) — Database Fundamentals
