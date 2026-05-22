# Database Fundamentals — A Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What Is a Database](#what-is-a-database)
3. [Relational Databases](#relational-databases)
4. [SQL Basics](#sql-basics)
5. [Introduction to ORM](#introduction-to-orm)
6. [Database Design](#database-design)
7. [Implementation Example](#implementation-example)
8. [Exercises](#exercises)
9. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- Core concepts of databases
- SQL basics (SELECT, INSERT, UPDATE, DELETE)
- ORM (Object-Relational Mapping)
- Fundamentals of table design
- Database operations with FastAPI + SQLAlchemy

### Why It Matters

Database operations are central to backend development. Proper database design and query optimization determine an application's performance and scalability.

### Estimated Time: 1–2 hours

---

## What Is a Database

### Definition

A **database** is a system that stores and manages data in a structured way.

### Why Use a Database Instead of Files

| Item | Files | Database |
|------|-------|----------|
| **Concurrent access** | Difficult | Supported |
| **Data integrity** | No guarantee | Ensured via transactions |
| **Search speed** | Slow | Fast with indexes |
| **Backups** | Manual | Automated backups available |

### Types of Databases

#### 1. Relational Databases (SQL)

**Characteristics**: Table-based, SQL language, ACID guarantees

**Examples**:
- PostgreSQL (recommended)
- MySQL
- SQLite (development)

#### 2. NoSQL Databases

**Characteristics**: Flexible schema, horizontal scaling

**Examples**:
- MongoDB (document)
- Redis (key-value)
- Elasticsearch (search engine)

---

## Relational Databases

### Table Structure

```
users table
┌────┬────────┬─────────────────────┬─────┐
│ id │ name   │ email               │ age │
├────┼────────┼─────────────────────┼─────┤
│ 1  │ Alice  │ alice@example.com   │ 25  │
│ 2  │ Bob    │ bob@example.com     │ 30  │
│ 3  │ Carol  │ carol@example.com   │ 22  │
└────┴────────┴─────────────────────┴─────┘
```

### Relations

#### One-to-Many

```
users (1) ──< posts (many)

One user has many posts.

users table
┌────┬────────┐
│ id │ name   │
├────┼────────┤
│ 1  │ Alice  │
└────┴────────┘

posts table
┌────┬──────────┬─────────┐
│ id │ title    │ user_id │
├────┼──────────┼─────────┤
│ 1  │ Post 1   │ 1       │
│ 2  │ Post 2   │ 1       │
└────┴──────────┴─────────┘
```

#### Many-to-Many

```
users (many) ──< user_tags >── (many) tags

Use a junction table.

users table
┌────┬────────┐
│ id │ name   │
├────┼────────┤
│ 1  │ Alice  │
│ 2  │ Bob    │
└────┴────────┘

tags table
┌────┬────────┐
│ id │ name   │
├────┼────────┤
│ 1  │ Python │
│ 2  │ React  │
└────┴────────┘

user_tags table (junction table)
┌─────────┬────────┐
│ user_id │ tag_id │
├─────────┼────────┤
│ 1       │ 1      │
│ 1       │ 2      │
│ 2       │ 1      │
└─────────┴────────┘
```

---

## SQL Basics

### CREATE (Create a Table)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    age INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### INSERT (Insert Data)

```sql
-- Single row
INSERT INTO users (name, email, age)
VALUES ('Alice', 'alice@example.com', 25);

-- Multiple rows
INSERT INTO users (name, email, age)
VALUES
    ('Bob', 'bob@example.com', 30),
    ('Carol', 'carol@example.com', 22);
```

### SELECT (Query Data)

```sql
-- All rows
SELECT * FROM users;

-- Specific columns only
SELECT name, email FROM users;

-- Conditional
SELECT * FROM users WHERE age >= 25;

-- Sorted
SELECT * FROM users ORDER BY age DESC;

-- Limited
SELECT * FROM users LIMIT 10 OFFSET 0;

-- Aggregates
SELECT COUNT(*) FROM users;
SELECT AVG(age) FROM users;
SELECT MAX(age), MIN(age) FROM users;
```

### UPDATE (Update Data)

```sql
-- Update a specific user
UPDATE users
SET age = 26
WHERE id = 1;

-- Update multiple columns
UPDATE users
SET name = 'Alice Smith', age = 26
WHERE id = 1;
```

### DELETE (Delete Data)

```sql
-- Delete a specific user
DELETE FROM users WHERE id = 1;

-- Conditional delete
DELETE FROM users WHERE age < 18;
```

### JOIN (Join Tables)

```sql
-- Join users and posts
SELECT
    users.name,
    posts.title,
    posts.created_at
FROM users
INNER JOIN posts ON users.id = posts.user_id;

-- LEFT JOIN (include users without posts)
SELECT
    users.name,
    COUNT(posts.id) as post_count
FROM users
LEFT JOIN posts ON users.id = posts.user_id
GROUP BY users.id, users.name;
```

---

## Introduction to ORM

### What Is an ORM

**ORM (Object-Relational Mapping)** maps database tables to objects in code.

**Benefits**:
- No need to write raw SQL
- Type safety
- More readable code

### SQLAlchemy (Python)

```python
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()

# Model definition
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    age = Column(Integer)

# Database connection
engine = create_engine("postgresql://user:password@localhost/dbname")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# CRUD operations

# Create
new_user = User(name="Alice", email="alice@example.com", age=25)
db.add(new_user)
db.commit()

# Read
user = db.query(User).filter(User.id == 1).first()
users = db.query(User).filter(User.age >= 25).all()

# Update
user = db.query(User).filter(User.id == 1).first()
user.age = 26
db.commit()

# Delete
user = db.query(User).filter(User.id == 1).first()
db.delete(user)
db.commit()
```

---

## Database Design

### Normalization

**First Normal Form**: Eliminate repeating groups.

```
❌ Bad design
users table
┌────┬────────┬────────────────────────────┐
│ id │ name   │ hobbies                    │
├────┼────────┼────────────────────────────┤
│ 1  │ Alice  │ reading, music, sports     │
└────┴────────┴────────────────────────────┘

✅ Good design
users table          hobbies table
┌────┬────────┐      ┌────┬─────────┬─────────┐
│ id │ name   │      │ id │ user_id │ hobby   │
├────┼────────┤      ├────┼─────────┼─────────┤
│ 1  │ Alice  │      │ 1  │ 1       │ reading │
└────┴────────┘      │ 2  │ 1       │ music   │
                      │ 3  │ 1       │ sports  │
                      └────┴─────────┴─────────┘
```

### Indexes

**Indexes** are lookup structures that speed up searches.

```sql
-- Create an index
CREATE INDEX idx_users_email ON users(email);

-- Composite index
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at);

-- This query now uses the index
SELECT * FROM users WHERE email = 'alice@example.com';
```

---

## Implementation Example

### FastAPI + SQLAlchemy

```python
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Model
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)

Base.metadata.create_all(bind=engine)

# Pydantic schemas
class UserCreate(BaseModel):
    name: str
    email: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True

# FastAPI app
app = FastAPI()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = User(name=user.name, email=user.email)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user
```

---

## Exercises

### Exercise: Design a Blog System

Design tables that satisfy the following requirements:
- Users can write posts
- Posts can have multiple categories
- Posts can have comments

**Sample solution**:

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

-- Posts table
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Junction table for posts and categories
CREATE TABLE post_categories (
    post_id INTEGER REFERENCES posts(id),
    category_id INTEGER REFERENCES categories(id),
    PRIMARY KEY (post_id, category_id)
);

-- Comments table
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    post_id INTEGER REFERENCES posts(id),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Next Steps

### What You Learned in This Guide

- Core concepts of databases
- SQL basics (CRUD operations)
- ORM with SQLAlchemy
- Fundamentals of table design

**Next guide**: [05-authentication-basics.md](./05-authentication-basics.md) — Authentication Basics

---

**Previous guide**: [03-rest-api-intro.md](./03-rest-api-intro.md)

**Parent guide**: [Backend Development — SKILL.md](../../SKILL.md)
