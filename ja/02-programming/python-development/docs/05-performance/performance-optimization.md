# Pythonパフォーマンス最適化ガイド

> **目標**: プロファイリングやベンチマークを含む実践的な最適化テクニックを習得し、Pythonアプリケーションのパフォーマンスを最大化する。

## 目次

1. [パフォーマンスの計測](#パフォーマンスの計測)
2. [プロファイリング](#プロファイリング)
3. [データ構造の最適化](#データ構造の最適化)
4. [アルゴリズムの最適化](#アルゴリズムの最適化)
5. [メモリの最適化](#メモリの最適化)
6. [並行処理と非同期処理](#並行処理と非同期処理)
7. [NumPy/Pandasの最適化](#numpypandasの最適化)
8. [キャッシュ戦略](#キャッシュ戦略)
9. [データベースの最適化](#データベースの最適化)

---

## パフォーマンスの計測

### timeモジュール

**基本的な計測**:
```python
import time

# 関数の実行時間を計測
start = time.time()
result = some_function()
end = time.time()
print(f"実行時間: {end - start:.4f}秒")

# 高精度計測（time.perf_counter）
start = time.perf_counter()
result = some_function()
end = time.perf_counter()
print(f"実行時間: {end - start:.6f}秒")
```

**タイミングデコレータ**:
```python
import time
from functools import wraps
from typing import Callable, Any


def timeit(func: Callable) -> Callable:
    """関数の実行時間を計測するデコレータ"""
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        start = time.perf_counter()
        result = func(*args, **kwargs)
        end = time.perf_counter()
        print(f"{func.__name__} の処理時間: {end - start:.6f}秒")
        return result
    return wrapper


@timeit
def process_data(data: list[int]) -> int:
    return sum(x ** 2 for x in data)


result = process_data(list(range(1000000)))
# process_data の処理時間: 0.234567秒
```

### timeitモジュール

**コードスニペットのベンチマーク**:
```python
import timeit

# シンプルな計測
execution_time = timeit.timeit(
    stmt='sum(range(100))',
    number=10000
)
print(f"時間: {execution_time:.6f}秒")

# セットアップコードを使った計測
execution_time = timeit.timeit(
    stmt='result = [x ** 2 for x in data]',
    setup='data = list(range(1000))',
    number=10000
)
print(f"時間: {execution_time:.6f}秒")
```

**実装の比較**:
```python
import timeit


def compare_implementations():
    # リスト内包表記
    time1 = timeit.timeit(
        stmt='[x ** 2 for x in range(1000)]',
        number=10000
    )

    # map + lambda
    time2 = timeit.timeit(
        stmt='list(map(lambda x: x ** 2, range(1000)))',
        number=10000
    )

    # forループ
    time3 = timeit.timeit(
        stmt='''
result = []
for x in range(1000):
    result.append(x ** 2)
''',
        number=10000
    )

    print(f"リスト内包表記: {time1:.6f}s")
    print(f"Map + lambda:   {time2:.6f}s")
    print(f"Forループ:      {time3:.6f}s")


compare_implementations()
# リスト内包表記が最速
```

---

## プロファイリング

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
    stats.print_stats(10)  # 上位10件
```

**コマンドラインからの実行**:
```bash
# プロファイルして結果を保存
python -m cProfile -o output.prof script.py

# 結果を確認
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
@profile  # line_profilerのマジックデコレータ
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
# 行ごとにプロファイル
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

## データ構造の最適化

### List vs Tuple vs Set vs Dict

```python
import timeit


def compare_data_structures():
    # リストの検索（O(n)）
    list_lookup = timeit.timeit(
        stmt='999 in data',
        setup='data = list(range(1000))',
        number=10000
    )

    # セットの検索（O(1)）
    set_lookup = timeit.timeit(
        stmt='999 in data',
        setup='data = set(range(1000))',
        number=10000
    )

    # 辞書の検索（O(1)）
    dict_lookup = timeit.timeit(
        stmt='999 in data',
        setup='data = {i: i for i in range(1000)}',
        number=10000
    )

    print(f"リストの検索: {list_lookup:.6f}s")  # O(n) -- 低速
    print(f"セットの検索: {set_lookup:.6f}s")    # O(1) -- 高速！
    print(f"辞書の検索:   {dict_lookup:.6f}s")   # O(1) -- 高速！


compare_data_structures()
```

**適切なデータ構造の選択**:
```python
# 低速: リストによるメンバーシップテスト
def slow_check(items: list[int], target: int) -> bool:
    return target in items  # O(n)


# 高速: セットによるメンバーシップテスト
def fast_check(items: set[int], target: int) -> bool:
    return target in items  # O(1)
```

### collectionsモジュール

**defaultdict**:
```python
from collections import defaultdict


# 低速: キーの手動チェック
def group_slow(items: list[dict]) -> dict[str, list[dict]]:
    result = {}
    for item in items:
        category = item['category']
        if category not in result:
            result[category] = []
        result[category].append(item)
    return result


# 高速: defaultdict
def group_fast(items: list[dict]) -> dict[str, list[dict]]:
    result = defaultdict(list)
    for item in items:
        result[item['category']].append(item)
    return result
```

**Counter**:
```python
from collections import Counter


# 低速: 手動カウント
def count_slow(words: list[str]) -> dict[str, int]:
    counts = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    return counts


# 高速: Counter
def count_fast(words: list[str]) -> dict[str, int]:
    return Counter(words)
```

**deque（両端キュー）**:
```python
from collections import deque
import timeit

# リストの先頭への挿入は低速（O(n)）
list_insert = timeit.timeit(
    stmt='data.insert(0, 1)',
    setup='data = list(range(10000))',
    number=1000
)

# dequeの先頭への挿入は高速（O(1)）
deque_insert = timeit.timeit(
    stmt='data.appendleft(1)',
    setup='from collections import deque; data = deque(range(10000))',
    number=1000
)

print(f"リストの先頭挿入: {list_insert:.6f}s")
print(f"Dequeの先頭挿入: {deque_insert:.6f}s")  # 100倍以上高速
```

---

## アルゴリズムの最適化

### 計算量の改善

**O(n²) → O(n)**:
```python
# 低速: O(n²)のネストループ
def find_duplicates_slow(nums: list[int]) -> list[int]:
    duplicates = []
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] == nums[j] and nums[i] not in duplicates:
                duplicates.append(nums[i])
    return duplicates


# 高速: セットを使ったO(n)
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

## メモリの最適化

### ジェネレータ vs リスト

```python
# リスト: すべての要素をメモリに読み込む
def get_all_items() -> list[int]:
    return [i for i in range(1000000)]


# ジェネレータ: 1要素ずつ読み込む
def get_items_generator():
    for i in range(1000000):
        yield i


# メモリ使用量の比較
import sys

data_list = [i for i in range(10000)]
data_gen = (i for i in range(10000))

print(f"リスト:         {sys.getsizeof(data_list)} bytes")
print(f"ジェネレータ:   {sys.getsizeof(data_gen)} bytes")  # はるかに小さい
```

### slots

```python
# __slots__なし: 各インスタンスが__dict__を持つ
class UserNormal:
    def __init__(self, name: str, age: int, email: str):
        self.name = name
        self.age = age
        self.email = email


# __slots__あり: 固定属性セット、メモリ使用量が少ない
class UserSlots:
    __slots__ = ['name', 'age', 'email']

    def __init__(self, name: str, age: int, email: str):
        self.name = name
        self.age = age
        self.email = email


import sys

normal = UserNormal("Alice", 25, "alice@example.com")
slots = UserSlots("Alice", 25, "alice@example.com")

print(f"通常:   {sys.getsizeof(normal)} bytes")
print(f"Slots:  {sys.getsizeof(slots)} bytes")  # より小さい
```

---

## 並行処理と非同期処理

### asyncio

```python
import asyncio
import aiohttp
from typing import List


async def fetch_url(session: aiohttp.ClientSession, url: str) -> dict:
    """非同期URLフェッチ"""
    async with session.get(url) as response:
        return {"url": url, "status": response.status}


async def fetch_all(urls: List[str]) -> List[dict]:
    """複数URLを並列フェッチ"""
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_url(session, url) for url in urls]
        results = await asyncio.gather(*tasks)
    return results


# 使用例
urls = [
    "https://api.example.com/data1",
    "https://api.example.com/data2",
    "https://api.example.com/data3",
]

results = asyncio.run(fetch_all(urls))
```

### I/Oバウンドタスクのスレッド処理

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

### CPUバウンドタスクのマルチプロセス処理

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

## NumPy/Pandasの最適化

### NumPyのベクトル化

```python
import numpy as np
import timeit


# 低速: Pythonループ
def python_sum(n: int) -> float:
    total = 0.0
    for i in range(n):
        total += i ** 2
    return total


# 高速: NumPyのベクトル化
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

print(f"Pythonループ: {time_python:.4f}s")
print(f"NumPy:        {time_numpy:.4f}s")  # はるかに高速
```

### pandasの最適化

```python
import pandas as pd
import numpy as np


# サンプルDataFrameの作成
df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie"] * 10000,
    "age": np.random.randint(18, 65, 30000),
    "salary": np.random.randint(30000, 120000, 30000),
})

# 低速: lambdaを使ったapply
df["salary_tax"] = df["salary"].apply(lambda x: x * 0.2)

# 高速: ベクトル化された演算
df["salary_tax"] = df["salary"] * 0.2

# フィルタリングにquery()を使用
result = df.query("age > 30 and salary > 50000")

# 繰り返し文字列値にはカテゴリ型を使用
df["name"] = df["name"].astype("category")
```

---

## キャッシュ戦略

### functools.lru_cache

```python
from functools import lru_cache


@lru_cache(maxsize=128)
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)


# メモ化による即時結果
print(fibonacci(100))
```

### Redisキャッシュ

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
    """Redisを使ったキャッシュデコレータ"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"

            # キャッシュを確認
            cached = r.get(cache_key)
            if cached:
                return json.loads(cached)

            # 計算してキャッシュに保存
            result = func(*args, **kwargs)
            r.setex(cache_key, expire, json.dumps(result))
            return result

        return wrapper
    return decorator


@cache(expire=300)
def get_user_data(user_id: int) -> dict:
    """ユーザーデータの取得（5分間キャッシュ）"""
    # DBクエリのシミュレーション
    return {"id": user_id, "name": "Alice", "age": 25}
```

---

## データベースの最適化

### コネクションプーリング

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool


engine = create_engine(
    "postgresql://user:password@localhost/mydb",
    poolclass=QueuePool,
    pool_size=10,          # プール内の接続数
    max_overflow=20,       # 追加で許容する接続数
    pool_pre_ping=True,    # 使用前に接続を検証
    pool_recycle=3600,     # 1時間後に接続を再利用
)
```

### クエリの最適化

```python
from sqlalchemy.orm import Session
from sqlalchemy import select


# 必要なカラムのみ取得
def get_user_names(db: Session) -> list[str]:
    result = db.execute(select(User.name)).scalars().all()
    return result


# N+1問題を避けるためのEagerローディング
def get_posts_with_authors(db: Session):
    from sqlalchemy.orm import joinedload
    return db.query(Post).options(joinedload(Post.author)).all()


# バッチ挿入
def create_users_batch(db: Session, users: list[dict]):
    db.bulk_insert_mappings(User, users)
    db.commit()
```
