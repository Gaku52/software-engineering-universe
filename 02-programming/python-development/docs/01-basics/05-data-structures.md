# Data Structures -- A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Lists](#lists)
3. [Tuples](#tuples)
4. [Dictionaries](#dictionaries)
5. [Sets](#sets)
6. [Comprehensions](#comprehensions)
7. [Practice Exercises](#practice-exercises)
8. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- Lists (mutable, ordered)
- Tuples (immutable, ordered)
- Dictionaries (key-value pairs)
- Sets (no duplicates, unordered)
- Comprehensions (concise syntax)

### Estimated Time: 2--3 hours

---

## Lists

### Basic Operations

```python
# Create a list
fruits = ["apple", "banana", "orange"]

# Index access
print(fruits[0])   # apple
print(fruits[-1])  # orange

# Slicing
print(fruits[0:2])  # ['apple', 'banana']

# Length
print(len(fruits))  # 3
```

### Modifying a List

```python
fruits = ["apple", "banana", "orange"]

# Add items
fruits.append("grape")
fruits.insert(1, "strawberry")  # insert at position 1

# Remove items
fruits.remove("banana")  # remove by value
del fruits[0]            # remove by index
last = fruits.pop()      # remove and return last item

# Change an item
fruits[0] = "melon"

# Sort
numbers = [3, 1, 4, 1, 5]
numbers.sort()    # [1, 1, 3, 4, 5]
numbers.reverse() # [5, 4, 3, 1, 1]
```

### List Methods

```python
numbers = [1, 2, 3, 2, 4]

numbers.count(2)         # count of 2 -> 2
numbers.index(3)         # position of 3 -> 2
numbers.extend([5, 6])   # merge another list
numbers.clear()          # remove all items
```

---

## Tuples

### Characteristics: Immutable

```python
# Create a tuple
point = (10, 20)
colors = ("red", "green", "blue")

# Access
print(point[0])   # 10

# Cannot modify
# point[0] = 15  # TypeError

# Unpacking
x, y = point
print(x, y)  # 10 20

# Single-element tuple (comma required)
single = (42,)
```

### Use Cases for Tuples

```python
# Multiple return values
def get_user():
    return "Alice", 25, "New York"

name, age, city = get_user()

# As dictionary keys (lists cannot be used as keys)
locations = {
    (0, 0): "origin",
    (1, 0): "right",
    (0, 1): "up"
}
```

---

## Dictionaries

### Basic Operations

```python
# Create a dictionary
user = {
    "name": "Alice",
    "age": 25,
    "city": "New York"
}

# Access
print(user["name"])                     # Alice
print(user.get("age"))                  # 25
print(user.get("email", "not set"))     # default value

# Add / update
user["email"] = "alice@example.com"
user["age"] = 26

# Delete
del user["city"]
email = user.pop("email")  # remove and return value
```

### Dictionary Methods

```python
user = {"name": "Alice", "age": 25}

# Keys, values, and pairs
print(user.keys())    # dict_keys(['name', 'age'])
print(user.values())  # dict_values(['Alice', 25])
print(user.items())   # dict_items([('name', 'Alice'), ('age', 25)])

# Loop
for key, value in user.items():
    print(f"{key}: {value}")

# Check for key
if "name" in user:
    print("'name' key exists")
```

---

## Sets

### Characteristics: No Duplicates, Unordered

```python
# Create a set
numbers = {1, 2, 3, 2, 1}  # duplicates are removed
print(numbers)  # {1, 2, 3}

# Add / remove
numbers.add(4)
numbers.remove(1)    # raises error if not present
numbers.discard(10)  # safe even if not present

# Set operations
a = {1, 2, 3}
b = {3, 4, 5}

print(a | b)  # union:        {1, 2, 3, 4, 5}
print(a & b)  # intersection: {3}
print(a - b)  # difference:   {1, 2}
print(a ^ b)  # symmetric diff: {1, 2, 4, 5}
```

---

## Comprehensions

### List Comprehensions

```python
# Traditional way
squares = []
for i in range(10):
    squares.append(i ** 2)

# List comprehension (concise)
squares = [i ** 2 for i in range(10)]

# With condition
evens = [i for i in range(10) if i % 2 == 0]
# [0, 2, 4, 6, 8]
```

### Dictionary Comprehensions

```python
squares = {i: i ** 2 for i in range(5)}
# {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}
```

### Set Comprehensions

```python
unique_lengths = {len(word) for word in ["apple", "banana", "pear"]}
# {4, 5, 6}
```

---

## Practice Exercises

### Exercise 1: List Operations

```python
# Create a list of even numbers from 1 to 100
evens = [i for i in range(1, 101) if i % 2 == 0]

# Sum and average
total = sum(evens)
average = total / len(evens)
print(f"Sum: {total}, Average: {average}")
```

### Exercise 2: Dictionary Operations

```python
# Student grade management
students = {
    "Alice": {"math": 80, "english": 75},
    "Bob":   {"math": 90, "english": 85},
    "Carol": {"math": 70, "english": 80}
}

# Average score per student
for name, scores in students.items():
    avg = sum(scores.values()) / len(scores)
    print(f"{name}'s average: {avg}")
```

---

## Next Steps

**Next guide**: [06-modules-packages.md](./06-modules-packages.md) -- Modules and packages
