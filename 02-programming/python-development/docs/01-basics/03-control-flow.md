# Control Flow -- A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [if Statements (Conditionals)](#if-statements-conditionals)
3. [for Loops](#for-loops)
4. [while Loops](#while-loops)
5. [break, continue, and pass](#break-continue-and-pass)
6. [Practice Exercises](#practice-exercises)
7. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- if/elif/else (conditionals)
- for loops (iteration)
- while loops
- break, continue, pass

### Estimated Time: 1--2 hours

---

## if Statements (Conditionals)

### Basic Form

```python
age = 20

if age >= 20:
    print("Adult")
```

### if-else

```python
age = 18

if age >= 20:
    print("Adult")
else:
    print("Minor")
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

### Multiple Conditions

```python
age = 25
has_license = True

if age >= 18 and has_license:
    print("You can drive")
elif age >= 18 and not has_license:
    print("Please get a license")
else:
    print("Under 18")
```

### Ternary Expression

```python
age = 20
status = "Adult" if age >= 20 else "Minor"
print(status)  # Adult
```

---

## for Loops

### Looping with range()

```python
# 0 to 4
for i in range(5):
    print(i)  # 0, 1, 2, 3, 4

# 1 to 5
for i in range(1, 6):
    print(i)  # 1, 2, 3, 4, 5

# Step of 2
for i in range(0, 10, 2):
    print(i)  # 0, 2, 4, 6, 8
```

### Looping Over a List

```python
fruits = ["apple", "banana", "orange"]

for fruit in fruits:
    print(fruit)

# With index
for i, fruit in enumerate(fruits):
    print(f"{i}: {fruit}")
# 0: apple
# 1: banana
# 2: orange
```

### Nested Loops

```python
for i in range(3):
    for j in range(3):
        print(f"({i}, {j})", end=" ")
    print()  # newline
# (0, 0) (0, 1) (0, 2)
# (1, 0) (1, 1) (1, 2)
# (2, 0) (2, 1) (2, 2)
```

---

## while Loops

### Basic Form

```python
count = 0
while count < 5:
    print(count)
    count += 1
# 0, 1, 2, 3, 4
```

### Infinite Loop (with break)

```python
# Use break to exit
while True:
    answer = input("Continue? (y/n): ")
    if answer == "n":
        break
    print("Continuing...")
```

---

## break, continue, and pass

### break (exit the loop)

```python
for i in range(10):
    if i == 5:
        break
    print(i)
# 0, 1, 2, 3, 4
```

### continue (skip to the next iteration)

```python
for i in range(5):
    if i == 2:
        continue
    print(i)
# 0, 1, 3, 4
```

### pass (do nothing)

```python
for i in range(5):
    if i == 2:
        pass  # implement later
    else:
        print(i)
```

---

## Practice Exercises

### Exercise 1: Multiplication Table

```python
for i in range(1, 10):
    for j in range(1, 10):
        print(f"{i * j:3}", end=" ")
    print()
```

### Exercise 2: FizzBuzz

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

## Next Steps

**Next guide**: [04-functions.md](./04-functions.md) -- Defining and using functions
