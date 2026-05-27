# 関数 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [関数の定義](#関数の定義)
3. [引数](#引数)
4. [戻り値](#戻り値)
5. [スコープ](#スコープ)
6. [ラムダ式](#ラムダ式)
7. [練習問題](#練習問題)
8. [次のステップ](#次のステップ)

---

## 概要

### 学習内容

- 関数の定義と呼び出し
- 引数（位置引数・キーワード引数・デフォルト引数）
- 戻り値
- スコープ（変数の有効範囲）
- ラムダ式（無名関数）

### 所要時間の目安：1〜2時間

---

## 関数の定義

### 基本形

```python
def greet():
    print("Hello!")

greet()  # Hello!
```

### ドキュメント文字列（Docstring）

```python
def greet():
    """
    挨拶を表示する。
    """
    print("Hello!")

print(greet.__doc__)  # Docstring を表示
```

---

## 引数

### 位置引数

```python
def greet(name):
    print(f"Hello, {name}!")

greet("Alice")  # Hello, Alice!
```

### 複数の引数

```python
def add(a, b):
    result = a + b
    print(f"{a} + {b} = {result}")

add(10, 20)  # 10 + 20 = 30
```

### デフォルト引数

```python
def greet(name, greeting="Hello"):
    print(f"{greeting}, {name}!")

greet("Alice")                # Hello, Alice!
greet("Bob", "おはようございます")  # おはようございます, Bob!
```

### キーワード引数

```python
def profile(name, age, city):
    print(f"名前: {name}, 年齢: {age}, 都市: {city}")

profile(name="Alice", age=25, city="New York")
profile(city="London", name="Bob", age=30)  # 順序は問わない
```

### 可変長引数

```python
# *args（タプル）
def sum_all(*numbers):
    total = sum(numbers)
    print(f"合計: {total}")

sum_all(1, 2, 3)        # 合計: 6
sum_all(10, 20, 30, 40) # 合計: 100

# **kwargs（辞書）
def print_info(**info):
    for key, value in info.items():
        print(f"{key}: {value}")

print_info(name="Alice", age=25, city="New York")
```

---

## 戻り値

### return 文

```python
def add(a, b):
    return a + b

result = add(10, 20)
print(result)  # 30
```

### 複数の戻り値

```python
def calculate(a, b):
    return a + b, a - b, a * b, a / b

add, sub, mul, div = calculate(10, 2)
print(add, sub, mul, div)  # 12 8 20 5.0
```

### 早期リターン

```python
def is_adult(age):
    if age < 0:
        return None  # 無効な値
    if age >= 18:
        return True
    return False

print(is_adult(25))   # True
print(is_adult(-5))   # None
```

---

## スコープ

### ローカル変数とグローバル変数

```python
# グローバル変数
x = 10

def func():
    # ローカル変数
    y = 20
    print(f"関数内: x={x}, y={y}")

func()
print(f"関数外: x={x}")
# print(y)  # NameError（y は関数外からアクセスできない）
```

### global 宣言

```python
count = 0

def increment():
    global count
    count += 1

increment()
increment()
print(count)  # 2
```

---

## ラムダ式

### 基本形

```python
# 通常の関数
def square(x):
    return x ** 2

# ラムダ式（同じ動作）
square = lambda x: x ** 2

print(square(5))  # 25
```

### 使用例

```python
# リストのソート
pairs = [(1, 'one'), (3, 'three'), (2, 'two')]
pairs.sort(key=lambda pair: pair[1])
print(pairs)  # [(1, 'one'), (3, 'three'), (2, 'two')]

# map() と組み合わせる
numbers = [1, 2, 3, 4, 5]
squared = list(map(lambda x: x ** 2, numbers))
print(squared)  # [1, 4, 9, 16, 25]
```

---

## 練習問題

### 問題1：FizzBuzz 関数

```python
def fizzbuzz(n):
    """
    n の FizzBuzz 結果を返す。

    Args:
        n (int): 判定する数値

    Returns:
        str: 結果の文字列
    """
    if n % 15 == 0:
        return "FizzBuzz"
    elif n % 3 == 0:
        return "Fizz"
    elif n % 5 == 0:
        return "Buzz"
    else:
        return str(n)

for i in range(1, 21):
    print(fizzbuzz(i))
```

### 問題2：階乗計算

```python
def factorial(n):
    """
    n の階乗を計算する。

    Args:
        n (int): 階乗を計算する数値

    Returns:
        int: n!
    """
    if n == 0 or n == 1:
        return 1
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

print(factorial(5))  # 120
```

---

## 次のステップ

**次のガイド**：[05-data-structures.md](./05-data-structures.md) — リスト・辞書・タプル
