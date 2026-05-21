# Python Performance Optimization Guide

> **Goal**: Learn practical optimization techniques, profiling, and benchmarking to maximize the performance of Python applications.

## Table of Contents

1. [Measuring Performance](#measuring-performance)
2. [Profiling](#profiling)
3. [Data Structure Optimization](#data-structure-optimization)
4. [Algorithm Optimization](#algorithm-optimization)
5. [Memory Optimization](#memory-optimization)
6. [Concurrency and Async](#concurrency-and-async)
7. [NumPy/Pandas Optimization](#numpypandas-optimization)
8. [Caching Strategies](#caching-strategies)
9. [Database Optimization](#database-optimization)

---

## Measuring Performance

### The time Module

**Basic timing**:
```python
import time

# Measure function execution time
start = time.time()
result = some_function()
end = time.time()
print(f"Execution time: {end - start:.4f} seconds")

# Higher precision (time.perf_counter)
start = time.perf_counter()
result = some_function()
end = time.perf_counter()
print(f"Execution time: {end - start:.6f} seconds")
```

**Timing decorator**:
```python
import time
from functools import wraps
from typing import Callable, Any


def timeit(func: Callable) -> Callable:
    """Decorator to measure function execution time"""
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        start = time.perf_counter()
        result = func(*args, **kwargs)
        end = time.perf_counter()
        print(f"{func.__name__} took {end - start:.6f} seconds")
        return result
    return wrapper


@timeit
def process_data(data: list[int]) -> int:
    return sum(x ** 2 for x in data)


result = process_data(list(range(1000000)))
# process_data took 0.234567 seconds
```

### The timeit Module

**Benchmarking code snippets**:
```python
import timeit

# Simple timing
execution_time = timeit.timeit(
    stmt='sum(range(100))',
    number=10000
)
print(f"Time: {execution_time:.6f} seconds")

# With setup code
execution_time = timeit.timeit(
    stmt='result = [x ** 2 for x in data]',
    setup='data = list(range(1000))',
    number=10000
)
print(f"Time: {execution_time:.6f} seconds")
```

**Comparing implementations**:
```python
import timeit


def compare_implementations():
    # List comprehension
    time1 = timeit.timeit(
        stmt='[x ** 2 for x in range(1000)]',
        number=10000
    )

    # map + lambda
    time2 = timeit.timeit(
        stmt='list(map(lambda x: x ** 2, range(1000)))',
        number=10000
    )

    # for loop
    time3 = timeit.timeit(
        stmt='''
result = []
for x in range(1000):
    result.append(x ** 2)
''',
        number=10000
    )

    print(f"List comprehension: {time1:.6f}s")
    print(f"Map + lambda:       {time2:.6f}s")
    print(f"For loop:           {time3:.6f}s")


compare_implementations()
# List comprehension is fastest
```

---

## Profiling

### cProfile

```python
import cProfile
import pstats
from io import StringIO


def expensive_function():
    total = 0
    for i in range(1000000):
        total += i ** 2
    return total


def main():
    result = expensive_function()


if __name__ == "__main__":
    profiler = cProfile.Profile()
    profiler.enable()

    main()

    profiler.disable()

    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    stats.print_stats(10)  # top 10
```

**Run from the command line**:
```bash
# Profile and save results
python -m cProfile -o output.prof script.py

# View results
python -m pstats output.prof
# stats> sort cumulative
# stats> stats 10
```

### line_profiler

```bash
pip install line-profiler
```

```python
# script.py
@profile  # line_profiler magic decorator
def process_data(data: list[int]) -> list[int]:
    result = []
    for item in data:
        squared = item ** 2
        if squared > 100:
            result.append(squared)
    return result


def main():
    data = list(range(10000))
    result = process_data(data)


if __name__ == "__main__":
    main()
```

```bash
# Profile line by line
kernprof -l -v script.py
```

### memory_profiler

```bash
pip install memory-profiler
```

```python
from memory_profiler import profile


@profile
def memory_intensive_function():
    data = [i for i in range(1000000)]
    squared = [x ** 2 for x in data]
    result = {i: x for i, x in enumerate(squared)}
    return result


if __name__ == "__main__":
    memory_intensive_function()
```

```bash
python -m memory_profiler script.py
```

---

## Data Structure Optimization

### List vs Tuple vs Set vs Dict

```python
import timeit


def compare_data_structures():
    # List lookup (O(n))
    list_lookup = timeit.timeit(
        stmt='999 in data',
        setup='data = list(range(1000))',
        number=10000
    )

    # Set lookup (O(1))
    set_lookup = timeit.timeit(
        stmt='999 in data',
        setup='data = set(range(1000))',
        number=10000
    )

    # Dict lookup (O(1))
    dict_lookup = timeit.timeit(
        stmt='999 in data',
        setup='data = {i: i for i in range(1000)}',
        number=10000
    )

    print(f"List lookup: {list_lookup:.6f}s")  # O(n) -- slow
    print(f"Set lookup:  {set_lookup:.6f}s")    # O(1) -- fast!
    print(f"Dict lookup: {dict_lookup:.6f}s")   # O(1) -- fast!


compare_data_structures()
```

**Choosing the right structure**:
```python
# Slow: membership test on a list
def slow_check(items: list[int], target: int) -> bool:
    return target in items  # O(n)


# Fast: membership test on a set
def fast_check(items: set[int], target: int) -> bool:
    return target in items  # O(1)
```

### collections Module

**defaultdict**:
```python
from collections import defaultdict


# Slow: manual key check
def group_slow(items: list[dict]) -> dict[str, list[dict]]:
    result = {}
    for item in items:
        category = item['category']
        if category not in result:
            result[category] = []
        result[category].append(item)
    return result


# Fast: defaultdict
def group_fast(items: list[dict]) -> dict[str, list[dict]]:
    result = defaultdict(list)
    for item in items:
        result[item['category']].append(item)
    return result
```

**Counter**:
```python
from collections import Counter


# Slow: manual counting
def count_slow(words: list[str]) -> dict[str, int]:
    counts = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    return counts


# Fast: Counter
def count_fast(words: list[str]) -> dict[str, int]:
    return Counter(words)
```

**deque (double-ended queue)**:
```python
from collections import deque
import timeit

# List insert at front is slow (O(n))
list_insert = timeit.timeit(
    stmt='data.insert(0, 1)',
    setup='data = list(range(10000))',
    number=1000
)

# deque insert at front is fast (O(1))
deque_insert = timeit.timeit(
    stmt='data.appendleft(1)',
    setup='from collections import deque; data = deque(range(10000))',
    number=1000
)

print(f"List insert at front:  {list_insert:.6f}s")
print(f"Deque insert at front: {deque_insert:.6f}s")  # 100x+ faster
```

---

## Algorithm Optimization

### Improving Complexity

**O(n²) → O(n)**:
```python
# Slow: O(n²) nested loop
def find_duplicates_slow(nums: list[int]) -> list[int]:
    duplicates = []
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] == nums[j] and nums[i] not in duplicates:
                duplicates.append(nums[i])
    return duplicates


# Fast: O(n) using a set
def find_duplicates_fast(nums: list[int]) -> list[int]:
    seen = set()
    duplicates = set()
    for num in nums:
        if num in seen:
            duplicates.add(num)
        else:
            seen.add(num)
    return list(duplicates)
```

---

## Memory Optimization

### Generators vs Lists

```python
# List: loads all items into memory
def get_all_items() -> list[int]:
    return [i for i in range(1000000)]


# Generator: loads one item at a time
def get_items_generator():
    for i in range(1000000):
        yield i


# Memory comparison
import sys

data_list = [i for i in range(10000)]
data_gen = (i for i in range(10000))

print(f"List:      {sys.getsizeof(data_list)} bytes")
print(f"Generator: {sys.getsizeof(data_gen)} bytes")  # much smaller
```

### slots

```python
# Without __slots__: each instance uses a __dict__
class UserNormal:
    def __init__(self, name: str, age: int, email: str):
        self.name = name
        self.age = age
        self.email = email


# With __slots__: fixed attribute set, lower memory
class UserSlots:
    __slots__ = ['name', 'age', 'email']

    def __init__(self, name: str, age: int, email: str):
        self.name = name
        self.age = age
        self.email = email


import sys

normal = UserNormal("Alice", 25, "alice@example.com")
slots = UserSlots("Alice", 25, "alice@example.com")

print(f"Normal: {sys.getsizeof(normal)} bytes")
print(f"Slots:  {sys.getsizeof(slots)} bytes")  # smaller
```

---

## Concurrency and Async

### asyncio

```python
import asyncio
import aiohttp
from typing import List


async def fetch_url(session: aiohttp.ClientSession, url: str) -> dict:
    """Async URL fetch"""
    async with session.get(url) as response:
        return {"url": url, "status": response.status}


async def fetch_all(urls: List[str]) -> List[dict]:
    """Fetch multiple URLs in parallel"""
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_url(session, url) for url in urls]
        results = await asyncio.gather(*tasks)
    return results


# Usage
urls = [
    "https://api.example.com/data1",
    "https://api.example.com/data2",
    "https://api.example.com/data3",
]

results = asyncio.run(fetch_all(urls))
```

### Threading for I/O-Bound Tasks

```python
from concurrent.futures import ThreadPoolExecutor
import requests


def fetch_url(url: str) -> dict:
    response = requests.get(url)
    return {"url": url, "status": response.status_code}


urls = ["https://api.example.com/data1", "https://api.example.com/data2"]

with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(fetch_url, urls))
```

### Multiprocessing for CPU-Bound Tasks

```python
from multiprocessing import Pool


def cpu_intensive(n: int) -> int:
    return sum(i * i for i in range(n))


data = [100000, 200000, 300000, 400000]

with Pool(processes=4) as pool:
    results = pool.map(cpu_intensive, data)

print(results)
```

---

## NumPy/Pandas Optimization

### NumPy Vectorization

```python
import numpy as np
import timeit


# Slow: Python loop
def python_sum(n: int) -> float:
    total = 0.0
    for i in range(n):
        total += i ** 2
    return total


# Fast: NumPy vectorization
def numpy_sum(n: int) -> float:
    arr = np.arange(n)
    return np.sum(arr ** 2)


time_python = timeit.timeit(
    stmt='python_sum(100000)',
    globals=globals(),
    number=100
)

time_numpy = timeit.timeit(
    stmt='numpy_sum(100000)',
    globals=globals(),
    number=100
)

print(f"Python loop: {time_python:.4f}s")
print(f"NumPy:       {time_numpy:.4f}s")  # much faster
```

### pandas Optimization

```python
import pandas as pd
import numpy as np


# Create sample DataFrame
df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie"] * 10000,
    "age": np.random.randint(18, 65, 30000),
    "salary": np.random.randint(30000, 120000, 30000),
})

# Slow: apply with lambda
df["salary_tax"] = df["salary"].apply(lambda x: x * 0.2)

# Fast: vectorized operation
df["salary_tax"] = df["salary"] * 0.2

# Use query() for filtering
result = df.query("age > 30 and salary > 50000")

# Use categorical for repeated string values
df["name"] = df["name"].astype("category")
```

---

## Caching Strategies

### functools.lru_cache

```python
from functools import lru_cache


@lru_cache(maxsize=128)
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)


# Instant result with memoization
print(fibonacci(100))
```

### Redis Caching

```bash
pip install redis
```

```python
import redis
import json
from functools import wraps
from typing import Callable, Any


r = redis.Redis(host='localhost', port=6379, db=0)


def cache(expire: int = 300):
    """Cache decorator using Redis"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"

            # Check cache
            cached = r.get(cache_key)
            if cached:
                return json.loads(cached)

            # Compute and store
            result = func(*args, **kwargs)
            r.setex(cache_key, expire, json.dumps(result))
            return result

        return wrapper
    return decorator


@cache(expire=300)
def get_user_data(user_id: int) -> dict:
    """Fetch user data (cached for 5 minutes)"""
    # Simulate DB query
    return {"id": user_id, "name": "Alice", "age": 25}
```

---

## Database Optimization

### Connection Pooling

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool


engine = create_engine(
    "postgresql://user:password@localhost/mydb",
    poolclass=QueuePool,
    pool_size=10,          # number of connections in the pool
    max_overflow=20,       # additional connections allowed
    pool_pre_ping=True,    # verify connections before use
    pool_recycle=3600,     # recycle connections after 1 hour
)
```

### Query Optimization

```python
from sqlalchemy.orm import Session
from sqlalchemy import select


# Fetch only required columns
def get_user_names(db: Session) -> list[str]:
    result = db.execute(select(User.name)).scalars().all()
    return result


# Eager loading to avoid N+1
def get_posts_with_authors(db: Session):
    from sqlalchemy.orm import joinedload
    return db.query(Post).options(joinedload(Post.author)).all()


# Batch insert
def create_users_batch(db: Session, users: list[dict]):
    db.bulk_insert_mappings(User, users)
    db.commit()
```
