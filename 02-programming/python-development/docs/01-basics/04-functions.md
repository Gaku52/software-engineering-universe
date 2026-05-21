# Functions -- A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Defining Functions](#defining-functions)
3. [Arguments](#arguments)
4. [Return Values](#return-values)
5. [Scope](#scope)
6. [Lambda Expressions](#lambda-expressions)
7. [Practice Exercises](#practice-exercises)
8. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- Defining and calling functions
- Arguments (positional, keyword, default)
- Return values
- Scope (variable visibility)
- Lambda expressions (anonymous functions)

### Estimated Time: 1--2 hours

---

## Defining Functions

### Basic Form

```python
def greet():
    print("Hello!")

greet()  # Hello!
```

### Docstrings

```python
def greet():
    """
    Displays a greeting.
    """
    print("Hello!")

print(greet.__doc__)  # Displays the docstring
```

---

## Arguments

### Positional Arguments

```python
def greet(name):
    print(f"Hello, {name}!")

greet("Alice")  # Hello, Alice!
```

### Multiple Arguments

```python
def add(a, b):
    result = a + b
    print(f"{a} + {b} = {result}")

add(10, 20)  # 10 + 20 = 30
```

### Default Arguments

```python
def greet(name, greeting="Hello"):
    print(f"{greeting}, {name}!")

greet("Alice")              # Hello, Alice!
greet("Bob", "Good morning")  # Good morning, Bob!
```

### Keyword Arguments

```python
def profile(name, age, city):
    print(f"Name: {name}, Age: {age}, City: {city}")

profile(name="Alice", age=25, city="New York")
profile(city="London", name="Bob", age=30)  # order does not matter
```

### Variable-Length Arguments

```python
# *args (tuple)
def sum_all(*numbers):
    total = sum(numbers)
    print(f"Total: {total}")

sum_all(1, 2, 3)        # Total: 6
sum_all(10, 20, 30, 40) # Total: 100

# **kwargs (dictionary)
def print_info(**info):
    for key, value in info.items():
        print(f"{key}: {value}")

print_info(name="Alice", age=25, city="New York")
```

---

## Return Values

### The return Statement

```python
def add(a, b):
    return a + b

result = add(10, 20)
print(result)  # 30
```

### Multiple Return Values

```python
def calculate(a, b):
    return a + b, a - b, a * b, a / b

add, sub, mul, div = calculate(10, 2)
print(add, sub, mul, div)  # 12 8 20 5.0
```

### Early Return

```python
def is_adult(age):
    if age < 0:
        return None  # invalid value
    if age >= 18:
        return True
    return False

print(is_adult(25))   # True
print(is_adult(-5))   # None
```

---

## Scope

### Local and Global Variables

```python
# Global variable
x = 10

def func():
    # Local variable
    y = 20
    print(f"Inside function: x={x}, y={y}")

func()
print(f"Outside function: x={x}")
# print(y)  # NameError (y is not accessible outside the function)
```

### The global Declaration

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

## Lambda Expressions

### Basic Form

```python
# Regular function
def square(x):
    return x ** 2

# Lambda expression (same behavior)
square = lambda x: x ** 2

print(square(5))  # 25
```

### Usage Examples

```python
# Sorting a list
pairs = [(1, 'one'), (3, 'three'), (2, 'two')]
pairs.sort(key=lambda pair: pair[1])
print(pairs)  # [(1, 'one'), (3, 'three'), (2, 'two')]

# Combined with map()
numbers = [1, 2, 3, 4, 5]
squared = list(map(lambda x: x ** 2, numbers))
print(squared)  # [1, 4, 9, 16, 25]
```

---

## Practice Exercises

### Exercise 1: FizzBuzz Function

```python
def fizzbuzz(n):
    """
    Determines the FizzBuzz result for n.

    Args:
        n (int): The number to evaluate

    Returns:
        str: The result
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

### Exercise 2: Factorial

```python
def factorial(n):
    """
    Computes the factorial of n.

    Args:
        n (int): The number to compute the factorial of

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

## Next Steps

**Next guide**: [05-data-structures.md](./05-data-structures.md) -- Lists, dictionaries, and tuples
