# Python Best Practices

> **Goal**: Learn best practices for type safety, code quality, and maintainability in Python development.

## Table of Contents

1. [Type Hints](#type-hints)
2. [Code Quality](#code-quality)
3. [Project Structure](#project-structure)
4. [Virtual Environment Management](#virtual-environment-management)
5. [Testing](#testing)
6. [Performance](#performance)

---

## Type Hints

### Basic Type Hints

```python
# Primitive types
def greet(name: str) -> str:
    return f"Hello, {name}"

# List
def process_numbers(numbers: list[int]) -> list[int]:
    return [n * 2 for n in numbers]

# Dictionary
User = dict[str, str | int]

def get_user(user_id: int) -> User:
    return {"id": user_id, "name": "John", "age": 30}

# Optional (can be None)
from typing import Optional

def find_user(user_id: int) -> Optional[User]:
    if user_id == 0:
        return None
    return {"id": user_id, "name": "John"}

# Union (multiple types)
def process_value(value: int | str) -> str:
    return str(value)
```

### Validation with Pydantic

```python
from pydantic import BaseModel, EmailStr, Field, validator

class User(BaseModel):
    id: int
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    age: int = Field(..., ge=0, le=120)

    @validator('age')
    def age_must_be_adult(cls, v):
        if v < 18:
            raise ValueError('Must be 18 or older')
        return v

# Usage
user = User(id=1, name="John", email="john@example.com", age=25)
print(user.dict())  # {'id': 1, 'name': 'John', 'email': 'john@example.com', 'age': 25}

# Validation error
try:
    User(id=1, name="", email="invalid", age=15)
except ValidationError as e:
    print(e.json())
```

### TypedDict

```python
from typing import TypedDict

class UserDict(TypedDict):
    id: int
    name: str
    email: str

def create_user() -> UserDict:
    return {
        "id": 1,
        "name": "John",
        "email": "john@example.com"
    }

# mypy will catch type errors
user: UserDict = create_user()
print(user["name"])  # OK
# print(user["age"]) # Error: TypedDict "UserDict" has no key "age"
```

---

## Code Quality

### Linter / Formatter

**ruff (fast linter + formatter)**:
```bash
# Install
pip install ruff

# Configuration (pyproject.toml)
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
ignore = ["E501"]  # leave line length to formatter

# Run
ruff check .      # Lint
ruff format .     # Format
```

**black (code formatter)**:
```bash
pip install black

# Run
black .

# Configuration (pyproject.toml)
[tool.black]
line-length = 100
target-version = ['py311']
```

**mypy (type checker)**:
```bash
pip install mypy

# Run
mypy .

# Configuration (pyproject.toml)
[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.6
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.7.1
    hooks:
      - id: mypy
        additional_dependencies: [pydantic]

# Install
pip install pre-commit
pre-commit install

# Run
pre-commit run --all-files
```

---

## Project Structure

### Directory Layout

```
my-project/
├── src/
│   └── myapp/
│       ├── __init__.py
│       ├── main.py
│       ├── models/
│       │   ├── __init__.py
│       │   └── user.py
│       ├── api/
│       │   ├── __init__.py
│       │   └── routes.py
│       └── utils/
│           ├── __init__.py
│           └── helpers.py
├── tests/
│   ├── __init__.py
│   ├── test_models.py
│   └── test_api.py
├── pyproject.toml
├── requirements.txt
├── .gitignore
└── README.md
```

### pyproject.toml

```toml
[project]
name = "myapp"
version = "1.0.0"
description = "My Application"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn>=0.24.0",
    "pydantic>=2.5.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "ruff>=0.1.6",
    "mypy>=1.7.0",
]

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"

[tool.ruff]
line-length = 100

[tool.mypy]
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
```

---

## Virtual Environment Management

### venv (Standard)

```bash
# Create
python -m venv venv

# Activate
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install
pip install -r requirements.txt

# Deactivate
deactivate
```

### Poetry (Recommended)

```bash
# Install
curl -sSL https://install.python-poetry.org | python3 -

# Initialize a project
poetry init

# Add dependencies
poetry add fastapi uvicorn
poetry add --group dev pytest ruff mypy

# Install
poetry install

# Run
poetry run python main.py
poetry run pytest

# Open shell
poetry shell
```

**pyproject.toml** (Poetry):
```toml
[tool.poetry]
name = "myapp"
version = "1.0.0"
description = "My Application"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.104.0"
uvicorn = "^0.24.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
ruff = "^0.1.6"
mypy = "^1.7.0"
```

---

## Testing

### pytest

```python
# tests/test_user.py
import pytest
from myapp.models.user import User

def test_user_creation():
    user = User(id=1, name="John", email="john@example.com")
    assert user.id == 1
    assert user.name == "John"

def test_user_validation():
    with pytest.raises(ValidationError):
        User(id=1, name="", email="invalid")

# Fixture
@pytest.fixture
def sample_user():
    return User(id=1, name="John", email="john@example.com")

def test_user_name(sample_user):
    assert sample_user.name == "John"

# Parametrize
@pytest.mark.parametrize("age,expected", [
    (0, False),
    (17, False),
    (18, True),
    (30, True),
])
def test_is_adult(age, expected):
    assert is_adult(age) == expected
```

### FastAPI Testing

```python
from fastapi.testclient import TestClient
from myapp.main import app

client = TestClient(app)

def test_read_users():
    response = client.get("/users/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_user():
    response = client.post("/users/", json={
        "name": "John",
        "email": "john@example.com"
    })
    assert response.status_code == 201
    assert response.json()["name"] == "John"

def test_user_not_found():
    response = client.get("/users/999")
    assert response.status_code == 404
```

### Coverage

```bash
# Install
pip install pytest-cov

# Run
pytest --cov=src --cov-report=html

# Enforce threshold
pytest --cov=src --cov-fail-under=80
```

---

## Performance

### List Comprehensions

```python
# Slow
result = []
for i in range(1000):
    result.append(i * 2)

# Fast
result = [i * 2 for i in range(1000)]

# Generator (memory-efficient)
result = (i * 2 for i in range(1000000))
```

### Dictionary Access

```python
# Slow
if 'key' in my_dict:
    value = my_dict['key']
else:
    value = default

# Fast
value = my_dict.get('key', default)
```

### f-strings

```python
# Slow
message = "Hello, " + name + "!"

# Fast
message = f"Hello, {name}!"
```

### functools.lru_cache

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Memoization gives instant results
print(fibonacci(100))
```

---

## Summary

### Checklist

**Type Safety**:
- [ ] Add type hints to all functions
- [ ] Use Pydantic for data validation
- [ ] Run mypy for type checking

**Code Quality**:
- [ ] Format with ruff or black
- [ ] Type-check with mypy
- [ ] Set up pre-commit hooks

**Project Structure**:
- [ ] Manage dependencies with pyproject.toml
- [ ] Use an appropriate directory structure
- [ ] Use Poetry or venv for virtual environments

**Testing**:
- [ ] Write unit tests with pytest
- [ ] Maintain at least 80% coverage
- [ ] Run tests automatically in CI/CD

---

## Next Steps

1. **fastapi-django.md**: FastAPI/Django development guide
2. **data-processing.md**: Data processing and automation guide
