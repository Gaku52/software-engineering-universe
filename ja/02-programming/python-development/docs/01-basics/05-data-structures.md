# データ構造 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [リスト](#リスト)
3. [タプル](#タプル)
4. [辞書](#辞書)
5. [セット](#セット)
6. [内包表記](#内包表記)
7. [練習問題](#練習問題)
8. [次のステップ](#次のステップ)

---

## 概要

### 学習内容

- リスト（ミュータブル・順序あり）
- タプル（イミュータブル・順序あり）
- 辞書（キーと値のペア）
- セット（重複なし・順序なし）
- 内包表記（簡潔な構文）

### 所要時間の目安：2〜3時間

---

## リスト

### 基本操作

```python
# リストを作成する
fruits = ["apple", "banana", "orange"]

# インデックスアクセス
print(fruits[0])   # apple
print(fruits[-1])  # orange

# スライス
print(fruits[0:2])  # ['apple', 'banana']

# 長さ
print(len(fruits))  # 3
```

### リストの変更

```python
fruits = ["apple", "banana", "orange"]

# 要素を追加する
fruits.append("grape")
fruits.insert(1, "strawberry")  # 位置 1 に挿入

# 要素を削除する
fruits.remove("banana")  # 値で削除
del fruits[0]            # インデックスで削除
last = fruits.pop()      # 最後の要素を取り出す

# 要素を変更する
fruits[0] = "melon"

# 並べ替え
numbers = [3, 1, 4, 1, 5]
numbers.sort()    # [1, 1, 3, 4, 5]
numbers.reverse() # [5, 4, 3, 1, 1]
```

### リストのメソッド

```python
numbers = [1, 2, 3, 2, 4]

numbers.count(2)         # 2 の個数 -> 2
numbers.index(3)         # 3 の位置 -> 2
numbers.extend([5, 6])   # 別のリストを結合する
numbers.clear()          # 全要素を削除する
```

---

## タプル

### 特徴：イミュータブル（変更不可）

```python
# タプルを作成する
point = (10, 20)
colors = ("red", "green", "blue")

# アクセス
print(point[0])   # 10

# 変更はできない
# point[0] = 15  # TypeError

# アンパッキング
x, y = point
print(x, y)  # 10 20

# 要素が1つのタプル（カンマが必要）
single = (42,)
```

### タプルの使いどころ

```python
# 複数の戻り値
def get_user():
    return "Alice", 25, "New York"

name, age, city = get_user()

# 辞書のキーとして使う（リストはキーに使えない）
locations = {
    (0, 0): "原点",
    (1, 0): "右",
    (0, 1): "上"
}
```

---

## 辞書

### 基本操作

```python
# 辞書を作成する
user = {
    "name": "Alice",
    "age": 25,
    "city": "New York"
}

# アクセス
print(user["name"])                     # Alice
print(user.get("age"))                  # 25
print(user.get("email", "未設定"))      # デフォルト値

# 追加・更新
user["email"] = "alice@example.com"
user["age"] = 26

# 削除
del user["city"]
email = user.pop("email")  # 取り出して削除
```

### 辞書のメソッド

```python
user = {"name": "Alice", "age": 25}

# キー・値・ペアを取得する
print(user.keys())    # dict_keys(['name', 'age'])
print(user.values())  # dict_values(['Alice', 25])
print(user.items())   # dict_items([('name', 'Alice'), ('age', 25)])

# ループ
for key, value in user.items():
    print(f"{key}: {value}")

# キーの存在確認
if "name" in user:
    print("'name' キーが存在します")
```

---

## セット

### 特徴：重複なし・順序なし

```python
# セットを作成する
numbers = {1, 2, 3, 2, 1}  # 重複は自動的に除去される
print(numbers)  # {1, 2, 3}

# 追加・削除
numbers.add(4)
numbers.remove(1)    # 存在しない場合はエラー
numbers.discard(10)  # 存在しなくても安全

# 集合演算
a = {1, 2, 3}
b = {3, 4, 5}

print(a | b)  # 和集合：      {1, 2, 3, 4, 5}
print(a & b)  # 積集合：      {3}
print(a - b)  # 差集合：      {1, 2}
print(a ^ b)  # 対称差集合：  {1, 2, 4, 5}
```

---

## 内包表記

### リスト内包表記

```python
# 従来の書き方
squares = []
for i in range(10):
    squares.append(i ** 2)

# リスト内包表記（簡潔）
squares = [i ** 2 for i in range(10)]

# 条件付き
evens = [i for i in range(10) if i % 2 == 0]
# [0, 2, 4, 6, 8]
```

### 辞書内包表記

```python
squares = {i: i ** 2 for i in range(5)}
# {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}
```

### セット内包表記

```python
unique_lengths = {len(word) for word in ["apple", "banana", "pear"]}
# {4, 5, 6}
```

---

## 練習問題

### 問題1：リスト操作

```python
# 1〜100 の偶数リストを作成する
evens = [i for i in range(1, 101) if i % 2 == 0]

# 合計と平均
total = sum(evens)
average = total / len(evens)
print(f"合計: {total}, 平均: {average}")
```

### 問題2：辞書操作

```python
# 生徒の成績管理
students = {
    "Alice": {"math": 80, "english": 75},
    "Bob":   {"math": 90, "english": 85},
    "Carol": {"math": 70, "english": 80}
}

# 生徒ごとの平均点
for name, scores in students.items():
    avg = sum(scores.values()) / len(scores)
    print(f"{name} の平均点: {avg}")
```

---

## 次のステップ

**次のガイド**：[06-modules-packages.md](./06-modules-packages.md) — モジュールとパッケージ
