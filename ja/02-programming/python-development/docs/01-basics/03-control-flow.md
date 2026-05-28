# 制御フロー — 完全入門ガイド


> if/elif/else・for/while ループ・break/continue/pass など Python の制御フローを学ぶガイド。
## 目次

1. [概要](#概要)
2. [if 文（条件分岐）](#if-文条件分岐)
3. [for ループ](#for-ループ)
4. [while ループ](#while-ループ)
5. [break・continue・pass](#breakcontinuepass)
6. [練習問題](#練習問題)
7. [次のステップ](#次のステップ)

---

## 概要

### 学習内容

- if/elif/else（条件分岐）
- for ループ（繰り返し処理）
- while ループ
- break、continue、pass

### 所要時間の目安：1〜2時間

---

## if 文（条件分岐）

### 基本形

```python
age = 20

if age >= 20:
    print("成人")
```

### if-else

```python
age = 18

if age >= 20:
    print("成人")
else:
    print("未成年")
```

### if-elif-else

```python
score = 85

if score >= 90:
    print("A")
elif score >= 80:
    print("B")
elif score >= 70:
    print("C")
else:
    print("D")
```

### 複数条件

```python
age = 25
has_license = True

if age >= 18 and has_license:
    print("運転できます")
elif age >= 18 and not has_license:
    print("免許を取得してください")
else:
    print("18歳未満です")
```

### 三項演算子

```python
age = 20
status = "成人" if age >= 20 else "未成年"
print(status)  # 成人
```

---

## for ループ

### range() を使ったループ

```python
# 0 から 4 まで
for i in range(5):
    print(i)  # 0, 1, 2, 3, 4

# 1 から 5 まで
for i in range(1, 6):
    print(i)  # 1, 2, 3, 4, 5

# 2 刻み
for i in range(0, 10, 2):
    print(i)  # 0, 2, 4, 6, 8
```

### リストのループ

```python
fruits = ["apple", "banana", "orange"]

for fruit in fruits:
    print(fruit)

# インデックス付き
for i, fruit in enumerate(fruits):
    print(f"{i}: {fruit}")
# 0: apple
# 1: banana
# 2: orange
```

### 入れ子ループ

```python
for i in range(3):
    for j in range(3):
        print(f"({i}, {j})", end=" ")
    print()  # 改行
# (0, 0) (0, 1) (0, 2)
# (1, 0) (1, 1) (1, 2)
# (2, 0) (2, 1) (2, 2)
```

---

## while ループ

### 基本形

```python
count = 0
while count < 5:
    print(count)
    count += 1
# 0, 1, 2, 3, 4
```

### 無限ループ（break を使って抜ける）

```python
# break で抜ける
while True:
    answer = input("続けますか？ (y/n): ")
    if answer == "n":
        break
    print("続行中...")
```

---

## break・continue・pass

### break（ループを終了する）

```python
for i in range(10):
    if i == 5:
        break
    print(i)
# 0, 1, 2, 3, 4
```

### continue（次のイテレーションへスキップ）

```python
for i in range(5):
    if i == 2:
        continue
    print(i)
# 0, 1, 3, 4
```

### pass（何もしない）

```python
for i in range(5):
    if i == 2:
        pass  # あとで実装する
    else:
        print(i)
```

---

## 練習問題

### 問題1：九九の表

```python
for i in range(1, 10):
    for j in range(1, 10):
        print(f"{i * j:3}", end=" ")
    print()
```

### 問題2：FizzBuzz

```python
for i in range(1, 101):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)
```

---

## 次のステップ

**次のガイド**：[04-functions.md](./04-functions.md) — 関数の定義と使い方
