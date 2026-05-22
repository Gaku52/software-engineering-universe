# Authentication Basics — A Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Authentication vs. Authorization](#authentication-vs-authorization)
3. [Authentication Methods](#authentication-methods)
4. [JWT Tokens](#jwt-tokens)
5. [Password Hashing](#password-hashing)
6. [Implementation Example](#implementation-example)
7. [Security Best Practices](#security-best-practices)
8. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- Authentication (AuthN) and Authorization (AuthZ)
- Password authentication and JWT
- Secure password management
- Implementing authentication with FastAPI

### Estimated Time: 1–2 hours

---

## Authentication vs. Authorization

### Authentication (AuthN)

**"Who are you?"**

The process of verifying that a user is who they claim to be.

```python
# Login (authentication)
@app.post("/login")
def login(email: str, password: str):
    user = authenticate(email, password)  # verify identity
    return {"token": create_token(user.id)}
```

### Authorization (AuthZ)

**"What are you allowed to do?"**

The process of verifying that a user may access a given resource.

```python
# Admin-only endpoint (authorization)
@app.get("/admin/users")
def get_all_users(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:  # check permission
        raise HTTPException(403, "Administrator privileges required")
    return db.query(User).all()
```

### Comparison

| Item | Authentication | Authorization |
|------|---------------|---------------|
| **Question** | Who are you? | What can you do? |
| **When** | At login | When accessing a resource |
| **Example** | Username and password | Admin permission check |

---

## Authentication Methods

### 1. Session-Based Authentication

```python
# Session state is kept on the server
sessions = {}

@app.post("/login")
def login(email: str, password: str):
    user = authenticate(email, password)
    session_id = generate_session_id()
    sessions[session_id] = user.id  # store on server
    return {"session_id": session_id}

@app.get("/profile")
def get_profile(session_id: str):
    user_id = sessions.get(session_id)
    if not user_id:
        raise HTTPException(401, "Authentication required")
    return get_user(user_id)
```

**Drawbacks**:
- Server must hold session state (stateful)
- Hard to scale horizontally

### 2. Token-Based Authentication (JWT)

```python
# Token is handed to the client (stateless)
@app.post("/login")
def login(email: str, password: str):
    user = authenticate(email, password)
    token = create_jwt_token(user.id)  # generate JWT
    return {"token": token}

@app.get("/profile")
def get_profile(token: str = Header(...)):
    user_id = decode_jwt_token(token)  # verify JWT
    return get_user(user_id)
```

**Advantages**:
- Stateless (server holds no state)
- Scalable
- Well-suited for microservices

---

## JWT Tokens

### JWT Structure

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE2MzI4NTc2MDB9.abc123...
│                                        │                                    │
└── Header                               └── Payload                          └── Signature
```

#### 1. Header

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

#### 2. Payload

```json
{
  "user_id": 1,
  "email": "alice@example.com",
  "exp": 1632857600
}
```

#### 3. Signature

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

### Generating and Verifying JWTs

```python
import jwt
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"

def create_jwt_token(user_id: int) -> str:
    """Generate a JWT token."""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=24)  # valid for 24 hours
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def decode_jwt_token(token: str) -> int:
    """Verify a JWT token and return the user_id."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token has expired")
    except jwt.JWTError:
        raise HTTPException(401, "Invalid token")
```

---

## Password Hashing

### Why Hashing Is Necessary

**❌ Storing plain text**: A database leak exposes every user's password.

**✅ Hashing**: Passwords are stored in an irreversible form.

### Hashing with bcrypt

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

# Usage
hashed = hash_password("mypassword123")
# $2b$12$N9qo8uLOickgx2ZMRZoMye...

is_valid = verify_password("mypassword123", hashed)
# True
```

### Salt

A **salt** is a random string added to the password so that identical passwords produce different hashes.

```python
# bcrypt adds a salt automatically
hash1 = hash_password("password123")  # $2b$12$abc...
hash2 = hash_password("password123")  # $2b$12$xyz... (different)
```

---

## Implementation Example

### Complete Authentication System

```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta

app = FastAPI()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = "your-secret-key-change-this"
ALGORITHM = "HS256"

# Model
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

# Schemas
class UserRegister(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# Password helpers
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# JWT helpers
def create_access_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token has expired")
    except jwt.JWTError:
        raise HTTPException(401, "Invalid token")

# Dependency
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    user_id = decode_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user

# Endpoints

@app.post("/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check for duplicate email
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(400, "This email address is already registered")

    # Create user
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password)
    )
    db.add(user)
    db.commit()
    return {"message": "Registration successful"}

@app.post("/login", response_model=Token)
def login(email: str, password: str, db: Session = Depends(get_db)):
    """Login."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(401, "Incorrect email address or password")

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Get the logged-in user's information."""
    return {"id": current_user.id, "email": current_user.email}
```

---

## Security Best Practices

### 1. Always Hash Passwords

Never store passwords in plain text.

### 2. Use Strong Secret Keys

```python
import secrets

# Generate a secure secret key
secret_key = secrets.token_urlsafe(32)
print(secret_key)
# e.g.: A3TvL9XK2pR8qN5mZ7wY1jC6uH4bS0eD
```

### 3. Set Token Expiry

Short-lived tokens reduce the impact of compromise.

```python
# Access token: 15–30 minutes
# Refresh token: 7–30 days
payload = {
    "user_id": user_id,
    "exp": datetime.utcnow() + timedelta(minutes=30)
}
```

### 4. Use HTTPS

Always use HTTPS in production to protect tokens in transit.

### 5. Validate All Input

```python
from pydantic import BaseModel, EmailStr

class UserRegister(BaseModel):
    email: EmailStr  # validates email format
    password: str

    @validator("password")
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v
```

---

## Next Steps

### What You Learned in This Guide

- Authentication (AuthN) and authorization (AuthZ)
- Session-based and token-based (JWT) authentication
- Secure password hashing with bcrypt
- A complete FastAPI authentication implementation

**Next guide**: [06-environment-variables.md](./06-environment-variables.md) — Environment Variables

---

**Previous guide**: [04-database-intro.md](./04-database-intro.md)

**Parent guide**: [Backend Development — SKILL.md](../../SKILL.md)
