# Python Development

> A comprehensive guide to Python development covering FastAPI, Django, Flask, type hints, async programming, data processing, and performance optimization — everything you need to build high-quality Python applications.

## Target Audience

- Complete beginners new to Python or programming
- Developers looking to adopt Python best practices
- Engineers building web APIs or data pipelines with Python

## Prerequisites

- Basic computer literacy (for the beginner guides)
- Foundational Python knowledge (for the advanced guides)

## Study Guide

### 01-basics -- Python Fundamentals

| # | File | Content |
|---|------|---------|
| 01 | [01-python-intro.md](docs/01-basics/01-python-intro.md) | What Python is, installation, first program, REPL |
| 02 | [02-basic-syntax.md](docs/01-basics/02-basic-syntax.md) | Variables, data types, operators, string manipulation |
| 03 | [03-control-flow.md](docs/01-basics/03-control-flow.md) | if/elif/else, for/while loops, break/continue/pass |
| 04 | [04-functions.md](docs/01-basics/04-functions.md) | Defining functions, arguments, return values, scope, lambdas |
| 05 | [05-data-structures.md](docs/01-basics/05-data-structures.md) | Lists, tuples, dicts, sets, comprehensions |
| 06 | [06-modules-packages.md](docs/01-basics/06-modules-packages.md) | Imports, standard library, pip, virtual environments |

### 02-best-practices -- Python Best Practices

| # | File | Content |
|---|------|---------|
| 01 | [python-best-practices.md](docs/02-best-practices/python-best-practices.md) | Type hints, code quality, project structure, testing |

### 03-frameworks -- Web Frameworks

| # | File | Content |
|---|------|---------|
| 01 | [fastapi-django.md](docs/03-frameworks/fastapi-django.md) | FastAPI and Django development guide |

### 04-data-processing -- Data Processing

| # | File | Content |
|---|------|---------|
| 01 | [data-processing.md](docs/04-data-processing/data-processing.md) | CSV/JSON/Excel processing, pandas/NumPy, web scraping, automation |

### 05-performance -- Performance Optimization

| # | File | Content |
|---|------|---------|
| 01 | [performance-optimization.md](docs/05-performance/performance-optimization.md) | Profiling, data structure optimization, concurrency, caching |

## Quick Reference

```
Python Best Practices Cheat Sheet:

  Type Hints:
    str, int, float, bool     -- primitive types
    list[T], dict[K, V]       -- generics (Python 3.9+)
    T | None                  -- union with None (Python 3.10+)
    Optional[T]               -- equivalent to T | None
    Callable[[A], R]          -- callable type
    TypeVar, Generic[T]       -- generic classes

  Project Tools:
    ruff      -- fast linter + formatter
    mypy      -- static type checker
    pytest    -- test framework
    poetry    -- dependency management
    pre-commit -- git hooks for code quality

  Virtual Environments:
    python -m venv venv       -- create
    source venv/bin/activate  -- activate (Linux/macOS)
    venv\Scripts\activate     -- activate (Windows)
    deactivate                -- deactivate
```

## References

1. Python Software Foundation. "Python Documentation." docs.python.org, 2024.
2. Tiangolo, S. "FastAPI Documentation." fastapi.tiangolo.com, 2024.
3. Django Software Foundation. "Django Documentation." djangoproject.com, 2024.
4. McKinney, W. "Python for Data Analysis." O'Reilly, 2022.
