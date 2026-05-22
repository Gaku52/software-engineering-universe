# Environment Variables and Configuration Management — A Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What Are Environment Variables](#what-are-environment-variables)
3. [Why Environment Variables Are Necessary](#why-environment-variables-are-necessary)
4. [The .env File](#the-env-file)
5. [Using python-dotenv](#using-python-dotenv)
6. [Configuration Best Practices](#configuration-best-practices)
7. [Implementation Example](#implementation-example)
8. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The core concepts of environment variables
- How to use .env files
- Managing environment variables with python-dotenv
- Separating settings for development, staging, and production
- Secure configuration management

### Why It Matters

Properly managing environment variables lets you keep sensitive information out of your codebase and reuse the same code across different environments (development, staging, production).

### Estimated Time: 40–50 minutes

---

## What Are Environment Variables

### Definition

**Environment variables** are dynamic values provided by the operating system that programs can read at runtime.

### Checking Environment Variables

```bash
# macOS/Linux
echo $PATH
echo $HOME

# Windows
echo %PATH%
echo %USERPROFILE%
```

### Reading Environment Variables in Python

```python
import os

# Get an environment variable
path = os.environ["PATH"]
print(path)

# Default value when variable is missing
db_host = os.environ.get("DB_HOST", "localhost")
print(db_host)  # "localhost" if not set
```

---

## Why Environment Variables Are Necessary

### 1. Protecting Sensitive Information

**❌ Bad: hardcoded in source code**

```python
# ❌ Published to GitHub!
DATABASE_URL = "postgresql://admin:password123@db.example.com/mydb"
SECRET_KEY = "super-secret-key-12345"
```

**✅ Good: read from environment variables**

```python
import os

DATABASE_URL = os.environ["DATABASE_URL"]
SECRET_KEY = os.environ["SECRET_KEY"]
```

### 2. Switching Configuration per Environment

```python
# Development
DATABASE_URL = "sqlite:///./dev.db"
DEBUG = True

# Production
DATABASE_URL = "postgresql://user:pass@prod-server/db"
DEBUG = False
```

Environment variables let you switch configuration without changing any code.

### 3. Deployment Flexibility

```bash
# Local development
export DATABASE_URL="sqlite:///./test.db"
python app.py

# Production (Heroku, AWS, etc.)
# Set environment variables in the platform dashboard — no code changes needed
```

---

## The .env File

### What Is a .env File

A **.env** file defines environment variables for local development.

```bash
# .env
DATABASE_URL=postgresql://user:password@localhost/mydb
SECRET_KEY=your-secret-key-here
DEBUG=True
PORT=8000
```

### Benefits of .env Files

- Simplifies local development setup
- Easy to share the shape of config with teammates (using `.env.example`)
- Never committed to Git (added to `.gitignore`)

### Add .env to .gitignore

```bash
# .gitignore
.env
.env.local
.env.*.local
```

### Provide a .env.example

```bash
# .env.example (safe to commit)
DATABASE_URL=postgresql://user:password@localhost/dbname
SECRET_KEY=your-secret-key
DEBUG=True
PORT=8000
```

Team members copy `.env.example` to create their own `.env`:

```bash
cp .env.example .env
# Edit .env with your own settings
```

---

## Using python-dotenv

### Installation

```bash
pip install python-dotenv
```

### Basic Usage

```python
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Read environment variables
database_url = os.environ["DATABASE_URL"]
secret_key = os.environ["SECRET_KEY"]
debug = os.environ.get("DEBUG", "False") == "True"

print(f"Database: {database_url}")
print(f"Debug mode: {debug}")
```

### Specifying a File

```python
from dotenv import load_dotenv

# Production config
load_dotenv(".env.production")

# Test config
load_dotenv(".env.test")
```

### Preserve Existing Environment Variables

```python
# Do not overwrite variables already set in the environment
load_dotenv(override=False)
```

---

## Configuration Best Practices

### 1. Use Pydantic Settings

```python
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    database_url: str = Field(..., alias="DATABASE_URL")
    secret_key: str = Field(..., alias="SECRET_KEY")
    debug: bool = Field(False, alias="DEBUG")
    port: int = Field(8000, alias="PORT")

    class Config:
        env_file = ".env"
        case_sensitive = False

# Usage
settings = Settings()
print(settings.database_url)
print(settings.debug)
```

**Benefits**:
- Type checking
- Validation
- Default values
- Automatically reads `.env`

### 2. Per-Environment Configuration Files

```python
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    debug: bool = False

    class Config:
        # Switch .env file based on the environment
        env = os.environ.get("ENV", "development")
        env_file = f".env.{env}"

# Usage
# ENV=production python app.py  → reads .env.production
# ENV=test python app.py        → reads .env.test
```

### 3. Check for Required Environment Variables at Startup

```python
import os
import sys

REQUIRED_ENV_VARS = ["DATABASE_URL", "SECRET_KEY"]

def check_env_vars():
    missing = [var for var in REQUIRED_ENV_VARS if var not in os.environ]
    if missing:
        print(f"Error: the following environment variables are not set: {', '.join(missing)}")
        sys.exit(1)

# Run at application startup
check_env_vars()
```

---

## Implementation Example

### Environment Variable Management in FastAPI

```python
from fastapi import FastAPI
from pydantic_settings import BaseSettings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Settings class
class Settings(BaseSettings):
    app_name: str = "My API"
    database_url: str
    secret_key: str
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()

# FastAPI application
app = FastAPI(
    title=settings.app_name,
    debug=settings.debug
)

# Database connection
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine)

@app.get("/")
def read_root():
    return {
        "app_name": settings.app_name,
        "debug": settings.debug
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}
```

### .env File (Local Development)

```bash
# .env
APP_NAME="My API (Development)"
DATABASE_URL=sqlite:///./dev.db
SECRET_KEY=dev-secret-key-change-in-production
DEBUG=True
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
```

### Per-Environment Configuration Examples

#### Development (.env.development)

```bash
APP_NAME="My API (Dev)"
DATABASE_URL=sqlite:///./dev.db
DEBUG=True
LOG_LEVEL=DEBUG
```

#### Staging (.env.staging)

```bash
APP_NAME="My API (Staging)"
DATABASE_URL=postgresql://user:pass@staging-db.example.com/db
DEBUG=False
LOG_LEVEL=INFO
```

#### Production (.env.production)

```bash
APP_NAME="My API"
DATABASE_URL=postgresql://user:pass@prod-db.example.com/db
DEBUG=False
LOG_LEVEL=WARNING
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Common Mistakes

### ❌ Mistake 1: Forgetting to Convert Environment Variable Types

```python
# ❌ Value is read as a string
DEBUG = os.environ.get("DEBUG", "False")
if DEBUG:  # "False" is truthy!
    print("Debug mode")
```

**✅ Correct approach**:

```python
DEBUG = os.environ.get("DEBUG", "False").lower() == "true"
# or
DEBUG = os.environ.get("DEBUG", "False") == "True"
```

### ❌ Mistake 2: Committing .env to Git

```bash
# ❌ Never do this
git add .env
git commit -m "Add config"
```

If you accidentally commit it:

```bash
# Remove from tracking
git rm --cached .env
git commit -m "Remove .env from git"

# Regenerate secret keys and update your environment variables
```

---

## Next Steps

### What You Learned in This Guide

- The basics of environment variables
- How to use .env files
- Managing environment variables with python-dotenv
- Type-safe configuration management with Pydantic Settings
- Separating configuration per environment

**Next guide**: [07-simple-api-tutorial.md](./07-simple-api-tutorial.md) — Comprehensive Exercise: Building a Simple API

---

**Previous guide**: [05-authentication-basics.md](./05-authentication-basics.md)

**Parent guide**: [Backend Development — SKILL.md](../../SKILL.md)
