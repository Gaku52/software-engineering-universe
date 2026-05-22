# What Is Backend Development — A Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What Is the Backend](#what-is-the-backend)
3. [Frontend vs. Backend](#frontend-vs-backend)
4. [Roles of the Backend](#roles-of-the-backend)
5. [Backend Technology Stack](#backend-technology-stack)
6. [Why Learn Backend Development](#why-learn-backend-development)
7. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The core concepts of backend development
- How the frontend and backend differ
- The responsibilities of a backend system
- Key technology stacks

### Estimated Time: 30–40 minutes

---

## What Is the Backend

### Definition

The **backend** is the server-side system that users never see directly.

```
┌─────────────┐      HTTP        ┌─────────────┐
│             │  ──────────────→ │             │
│  Frontend   │                  │   Backend   │
│             │  ←────────────── │             │
│  (Browser)  │      JSON        │  (Server)   │
└─────────────┘                  └─────────────┘
                                        │
                                        ↓
                                 ┌─────────────┐
                                 │  Database   │
                                 └─────────────┘
```

### Concrete Example

**Using Twitter as an example:**

- **Frontend**: The screen, buttons, and input forms
- **Backend**:
  - User authentication (login)
  - Storing tweets
  - Generating timelines
  - Uploading images
  - Sending notifications

---

## Frontend vs. Backend

### Frontend

```javascript
// Frontend (React)
function Tweet() {
  const [text, setText] = useState('');

  const handleSubmit = async () => {
    await fetch('/api/tweets', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea value={text} onChange={e => setText(e.target.value)} />
      <button>Tweet</button>
    </form>
  );
}
```

### Backend

```python
# Backend (FastAPI)
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

app = FastAPI()

@app.post("/api/tweets")
async def create_tweet(
    text: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Save to database
    tweet = Tweet(text=text, user_id=user.id)
    db.add(tweet)
    db.commit()
    return {"id": tweet.id, "text": tweet.text}
```

### Comparison Table

| Item | Frontend | Backend |
|------|----------|---------|
| **Runs on** | Browser | Server |
| **Languages** | HTML, CSS, JavaScript | Python, Node.js, Go, Java, etc. |
| **Primary role** | UI/UX, user interaction | Business logic, data processing |
| **Data** | Display only | Store, update, delete |
| **Security** | Client-side (untrusted) | Server-side (trusted) |

---

## Roles of the Backend

### 1. Providing APIs

The backend exposes APIs that the frontend calls.

```python
# GET /api/users/:id — retrieve a user
@app.get("/api/users/{user_id}")
async def get_user(user_id: int):
    return {"id": user_id, "name": "Alice", "email": "alice@example.com"}

# POST /api/users — create a user
@app.post("/api/users")
async def create_user(name: str, email: str):
    # Save to database
    return {"id": 1, "name": name, "email": email}
```

### 2. Database Operations

The backend is responsible for persisting data.

```python
# Read a user
user = db.query(User).filter(User.id == user_id).first()

# Create a user
new_user = User(name="Alice", email="alice@example.com")
db.add(new_user)
db.commit()

# Update a user
user.name = "Bob"
db.commit()

# Delete a user
db.delete(user)
db.commit()
```

### 3. Authentication and Authorization

The backend manages who is accessing the system and what they are allowed to do.

```python
# Authentication
@app.post("/login")
async def login(email: str, password: str):
    user = authenticate_user(email, password)
    token = create_access_token(user.id)
    return {"token": token}

# Authorization
@app.get("/admin/users")
async def get_all_users(current_user: User = Depends(get_current_admin_user)):
    # Accessible only by administrators
    return db.query(User).all()
```

### 4. Business Logic

The backend implements application-specific rules.

```python
# Example: purchase flow
@app.post("/purchase")
async def purchase(product_id: int, user: User = Depends(get_current_user)):
    # Check inventory
    product = db.query(Product).filter(Product.id == product_id).first()
    if product.stock <= 0:
        raise HTTPException(400, "Out of stock")

    # Check user balance
    if user.points < product.price:
        raise HTTPException(400, "Insufficient points")

    # Process purchase
    user.points -= product.price
    product.stock -= 1
    order = Order(user_id=user.id, product_id=product.id)
    db.add(order)
    db.commit()

    return {"message": "Purchase complete"}
```

---

## Backend Technology Stack

### Programming Languages

| Language | Frameworks | Characteristics |
|----------|-----------|-----------------|
| **Python** | Django, FastAPI, Flask | Beginner-friendly, AI/ML integration |
| **JavaScript/TypeScript** | Node.js, Express, NestJS | Same language as the frontend |
| **Go** | Gin, Echo | High-performance, strong concurrency |
| **Java** | Spring Boot | Large-scale enterprise systems |
| **Ruby** | Ruby on Rails | Fast development cycle |

### Databases

**Relational (SQL)**:
- PostgreSQL
- MySQL
- SQLite

**NoSQL**:
- MongoDB (document)
- Redis (cache)
- Elasticsearch (search)

### Infrastructure

- **Cloud**: AWS, GCP, Azure
- **Containers**: Docker, Kubernetes
- **CI/CD**: GitHub Actions, CircleCI

---

## Why Learn Backend Development

### 1. High Demand

Backend engineers are consistently in demand:
- Web API development
- Microservices
- Data infrastructure
- DevOps

### 2. Full-Stack Capability

Frontend + Backend = **Full-Stack Engineer**

### 3. Building Scalable Systems

- Systems that support millions of users
- High availability (minimal downtime)
- Performance optimization

### 4. Diverse Career Paths

- Backend Engineer
- Infrastructure Engineer
- Software Architect
- SRE (Site Reliability Engineer)

---

## Next Steps

### What You Learned in This Guide

- The fundamental concepts of backend development
- How frontend and backend differ
- The roles of a backend system
- Key technology stacks

### What to Study Next

1. **[02-http-basics.md](./02-http-basics.md)** — HTTP, requests, and responses
2. **[03-rest-api-intro.md](./03-rest-api-intro.md)** — REST API fundamentals

---

**Next guide**: [02-http-basics.md](./02-http-basics.md)

**Parent guide**: [Backend Development — SKILL.md](../../SKILL.md)
