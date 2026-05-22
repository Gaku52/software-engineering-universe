# Building a Simple API — Comprehensive Exercise

## Table of Contents

1. [Overview](#overview)
2. [Project Goal](#project-goal)
3. [Project Setup](#project-setup)
4. [Database Design](#database-design)
5. [Models and Schemas](#models-and-schemas)
6. [Authentication System](#authentication-system)
7. [CRUD API Implementation](#crud-api-implementation)
8. [Testing and Debugging](#testing-and-debugging)
9. [Summary](#summary)

---

## Overview

### What You Will Learn

This tutorial integrates all the concepts covered so far to implement a **task management API**.

### Features to Build

- User registration and login
- JWT authentication
- Task CRUD operations
- Environment variable management
- Error handling

### Estimated Time: 1–2 hours

---

## Project Goal

### The Completed API

```
POST   /register          - Register a user
POST   /login             - Login
GET    /me                - Get current user info
GET    /tasks             - List tasks
POST   /tasks             - Create a task
GET    /tasks/:id         - Get task detail
PUT    /tasks/:id         - Update a task
DELETE /tasks/:id         - Delete a task
```

---

## Project Setup

### 1. Directory Structure

```
task-api/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI application
│   ├── database.py       # Database connection
│   ├── models.py         # SQLAlchemy models
│   ├── schemas.py        # Pydantic schemas
│   ├── auth.py           # Authentication logic
│   └── config.py         # Settings management
├── .env                  # Environment variables
├── .env.example          # Environment variable template
├── .gitignore
├── requirements.txt
└── README.md
```

### 2. Install Required Packages

```bash
# Create project directory
mkdir task-api
cd task-api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install packages
pip install fastapi uvicorn sqlalchemy python-dotenv passlib[bcrypt] python-jose[cryptography]
```

### 3. requirements.txt

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
python-dotenv==1.0.0
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
pydantic-settings==2.1.0
```

### 4. .env.example

```bash
# .env.example
DATABASE_URL=sqlite:///./task.db
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 5. Create .env File

```bash
cp .env.example .env
# Edit .env and set your secret key
```

---

## Database Design

### Entity Diagram

```
users table
┌────┬───────┬──────────┬──────────┐
│ id │ email │ password │ name     │
└────┴───────┴──────────┴──────────┘
       │
       │ 1:many
       │
       ↓
tasks table
┌────┬────────┬─────────┬───────────┬─────────┐
│ id │ title  │ done    │ user_id   │ created │
└────┴────────┴─────────┴───────────┴─────────┘
```

---

## Models and Schemas

### app/config.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
```

### app/database.py

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}  # SQLite only
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### app/models.py

```python
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)

    tasks = relationship("Task", back_populates="owner")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    done = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="tasks")
```

### app/schemas.py

```python
from pydantic import BaseModel, EmailStr
from datetime import datetime

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

# Token schema
class Token(BaseModel):
    access_token: str
    token_type: str

# Task schemas
class TaskBase(BaseModel):
    title: str
    description: str | None = None
    done: bool = False

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    done: bool | None = None

class TaskResponse(TaskBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
```

---

## Authentication System

### app/auth.py

```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "user_id": user_id,
        "exp": expire
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token

def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    user_id = decode_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

---

## CRUD API Implementation

### app/main.py

```python
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .database import engine, get_db, Base
from .models import User, Task
from .schemas import (
    UserCreate, UserResponse, Token,
    TaskCreate, TaskUpdate, TaskResponse
)
from .auth import (
    hash_password, verify_password,
    create_access_token, get_current_user
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Task API", version="1.0.0")

# ========================================
# Authentication endpoints
# ========================================

@app.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check for duplicate email
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(400, "This email address is already registered")

    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        hashed_password=hash_password(user_data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/login", response_model=Token)
def login(email: str, password: str, db: Session = Depends(get_db)):
    """Login."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(401, "Incorrect email address or password")

    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get the logged-in user's information."""
    return current_user

# ========================================
# Task endpoints
# ========================================

@app.get("/tasks", response_model=List[TaskResponse])
def get_tasks(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List tasks."""
    tasks = db.query(Task)\
        .filter(Task.user_id == current_user.id)\
        .offset(skip)\
        .limit(limit)\
        .all()
    return tasks

@app.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a task."""
    task = Task(**task_data.dict(), user_id=current_user.id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get task detail."""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return task

@app.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a task."""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(404, "Task not found")

    # Apply updates
    update_data = task_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task

@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a task."""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()
    if not task:
        raise HTTPException(404, "Task not found")

    db.delete(task)
    db.commit()
    return None
```

---

## Testing and Debugging

### Start the Server

```bash
uvicorn app.main:app --reload
```

### Test with curl

```bash
# 1. Register a user
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "password123"
  }'

# 2. Login
curl -X POST http://localhost:8000/login \
  -d "email=test@example.com&password=password123"
# Response: {"access_token":"xxx","token_type":"bearer"}

# Save the token
export TOKEN="your-token-here"

# 3. Get current user info
curl -X GET http://localhost:8000/me \
  -H "Authorization: Bearer $TOKEN"

# 4. Create a task
curl -X POST http://localhost:8000/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement the API",
    "description": "Build a REST API with FastAPI",
    "done": false
  }'

# 5. List tasks
curl -X GET http://localhost:8000/tasks \
  -H "Authorization: Bearer $TOKEN"

# 6. Update a task
curl -X PUT http://localhost:8000/tasks/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"done": true}'

# 7. Delete a task
curl -X DELETE http://localhost:8000/tasks/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Test with Swagger UI

Open http://localhost:8000/docs in a browser to access the automatically generated API documentation.

1. Register via `/register`
2. Obtain a token via `/login`
3. Click the "Authorize" button at the top right
4. Enter `Bearer <token>`
5. Test each endpoint

---

## Common Errors and Solutions

### Error 1: 401 Unauthorized

**Cause**: Token is invalid or expired

**Fix**:
```bash
# Re-login to get a new token
curl -X POST http://localhost:8000/login \
  -d "email=test@example.com&password=password123"
```

### Error 2: 404 Task Not Found

**Cause**: Attempting to access another user's task

**Fix**: Check your own task IDs first

```bash
curl -X GET http://localhost:8000/tasks \
  -H "Authorization: Bearer $TOKEN"
```

### Error 3: 500 Internal Server Error

**Cause**: Database connection error

**Fix**:
```python
# Enable debug logging in database.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## Extension Ideas

### 1. Pagination

```python
@app.get("/tasks")
def get_tasks(
    page: int = 1,
    per_page: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    skip = (page - 1) * per_page
    tasks = db.query(Task)\
        .filter(Task.user_id == current_user.id)\
        .offset(skip)\
        .limit(per_page)\
        .all()

    total = db.query(Task).filter(Task.user_id == current_user.id).count()

    return {
        "tasks": tasks,
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page
    }
```

### 2. Filtering

```python
@app.get("/tasks")
def get_tasks(
    done: bool | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task).filter(Task.user_id == current_user.id)

    if done is not None:
        query = query.filter(Task.done == done)

    if search:
        query = query.filter(Task.title.contains(search))

    return query.all()
```

### 3. Sorting

```python
from sqlalchemy import desc, asc

@app.get("/tasks")
def get_tasks(
    sort_by: str = "created_at",
    order: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task).filter(Task.user_id == current_user.id)

    if order == "desc":
        query = query.order_by(desc(getattr(Task, sort_by)))
    else:
        query = query.order_by(asc(getattr(Task, sort_by)))

    return query.all()
```

---

## Summary

### What You Learned in This Tutorial

- FastAPI project structure
- Database design and ORM
- Implementing JWT authentication
- Implementing CRUD APIs
- Environment variable management
- Error handling
- How to test APIs

### Next Steps

1. **Add tests**: Unit tests with pytest
2. **Deploy**: Heroku, Render, AWS, etc.
3. **Frontend integration**: Connect with React or similar
4. **Feature expansion**: Add tags, priorities, due dates, etc.

---

**Previous guide**: [06-environment-variables.md](./06-environment-variables.md)

**Parent guide**: [Backend Development — SKILL.md](../../SKILL.md)

Congratulations! You have learned all the fundamentals of backend development.
