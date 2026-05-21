# Python Basic Syntax -- A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Variables and Assignment](#variables-and-assignment)
4. [Data Types](#data-types)
5. [Operators](#operators)
6. [String Operations](#string-operations)
7. [Type Conversion](#type-conversion)
8. [Comments](#comments)
9. [Common Mistakes](#common-mistakes)
10. [Practice Exercises](#practice-exercises)
11. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- Declaring variables and assigning values
- Basic data types (int, float, str, bool)
- Arithmetic, comparison, and logical operators
- String manipulation and formatting
- Type conversion

### Estimated Time

- Reading: 30--40 minutes
- Including exercises: 2--3 hours

---

## Prerequisites

- Completion of [01-python-intro.md](./01-python-intro.md)

---

## Variables and Assignment

### What Is a Variable?

A **variable** is like a box that stores data.

```python
# Assign values to variables
name = "Alice"
age = 25
height = 175.5

print(name)    # Alice
print(age)     # 25
print(height)  # 175.5
```

### Variable Naming Rules

```python
# Valid variable names
user_name = "Alice"
userName = "Alice"
user1 = "Alice"
_private = "private"

# Invalid variable names
# 1user = "Alice"       # starts with a digit
# user-name = "Alice"   # contains a hyphen
# class = "A"           # reserved keyword
```

**Naming conventions**:
- Only letters, digits, and underscores `_`
- Must not start with a digit
- Reserved words (keywords) cannot be used
- **Convention**: use `snake_case` (lowercase + underscores)

### Assigning Multiple Variables

```python
# Assign simultaneously
x, y, z = 10, 20, 30

# Assign the same value
a = b = c = 0

# Swap values
x, y = y, x
```

---

## Data Types

### 1. Integer (int)

```python
age = 25
year = 2024
negative = -10

print(type(age))  # <class 'int'>
```

### 2. Floating-Point Number (float)

```python
height = 175.5
pi = 3.14159
temperature = -5.0

print(type(height))  # <class 'float'>
```

### 3. String (str)

```python
name = "Alice"
message = 'Hello'
multiline = """This is a
multi-line string"""

print(type(name))  # <class 'str'>
```

### 4. Boolean (bool)

```python
is_student = True
is_adult = False

print(type(is_student))  # <class 'bool'>
```

### Checking the Type

```python
x = 10
print(type(x))             # <class 'int'>
print(isinstance(x, int))  # True
```

---

## Operators

### 1. Arithmetic Operators

```python
a = 10
b = 3

# Basic operations
print(a + b)   # 13  addition
print(a - b)   # 7   subtraction
print(a * b)   # 30  multiplication
print(a / b)   # 3.333... division

# Additional operators
print(a // b)  # 3    integer division (floor)
print(a % b)   # 1    modulo (remainder)
print(a ** b)  # 1000 exponentiation
```

### 2. Comparison Operators

```python
x = 10
y = 20

print(x == y)  # False  equal
print(x != y)  # True   not equal
print(x > y)   # False  greater than
print(x < y)   # True   less than
print(x >= y)  # False  greater than or equal
print(x <= y)  # True   less than or equal
```

### 3. Logical Operators

```python
age = 25
has_license = True

# and
print(age >= 18 and has_license)  # True

# or
print(age < 18 or has_license)    # True

# not
print(not has_license)            # False
```

### 4. Assignment Operators

```python
x = 10

x += 5   # x = x + 5  -> 15
x -= 3   # x = x - 3  -> 12
x *= 2   # x = x * 2  -> 24
x /= 4   # x = x / 4  -> 6.0
```

---

## String Operations

### String Concatenation

```python
first_name = "Alice"
last_name = "Smith"

# + operator
full_name = last_name + " " + first_name
print(full_name)  # Smith Alice

# * operator (repetition)
print("=" * 20)  # ====================
```

### String Formatting

```python
name = "Alice"
age = 25

# f-string (recommended)
message = f"My name is {name} and I am {age} years old."
print(message)

# format()
message = "My name is {} and I am {} years old.".format(name, age)

# % operator (older style)
message = "My name is %s and I am %d years old." % (name, age)
```

### String Indexing and Slicing

```python
text = "Hello, World!"

# Indexing
print(text[0])      # H
print(text[-1])     # !

# Slicing
print(text[0:5])    # Hello
print(text[7:])     # World!
print(text[:5])     # Hello
print(text[::2])    # Hlo ol!  (every 2nd character)
```

### String Methods

```python
text = "  Hello, World!  "

print(text.upper())                      # "  HELLO, WORLD!  "
print(text.lower())                      # "  hello, world!  "
print(text.strip())                      # "Hello, World!"
print(text.replace("World", "Python"))   # "  Hello, Python!  "
print(text.split(","))                   # ['  Hello', ' World!  ']
print(len(text))                         # 17
```

---

## Type Conversion

### Explicit Type Conversion

```python
# String to integer
age_str = "25"
age_int = int(age_str)
print(type(age_int))  # <class 'int'>

# String to float
height_str = "175.5"
height_float = float(height_str)

# Integer to string
num = 100
num_str = str(num)

# Number to boolean
print(bool(0))    # False
print(bool(1))    # True
print(bool(""))   # False (empty string)
print(bool("a"))  # True
```

### Common Errors

```python
# Invalid string passed to int()
# age = int("twenty-five")  # ValueError

# Correct
age = int("25")

# Cannot concatenate string and number
# message = "I am " + 25 + " years old"  # TypeError

# Correct
message = "I am " + str(25) + " years old"
# or
message = f"I am {25} years old"
```

---

## Comments

### Single-Line Comments

```python
# This is a comment
print("Hello")  # Inline comment
```

### Multi-Line Comments

```python
"""
This is a
multi-line comment
"""

'''
Single quotes work
too
'''
```

### Docstrings

```python
def greet(name):
    """
    Displays a greeting.

    Args:
        name (str): The name to greet
    """
    print(f"Hello, {name}!")
```

---

## Common Mistakes

### Mistake 1: Type Mismatch

```python
# Error
age = "25"
next_year = age + 1  # TypeError

# Fixed
age = int("25")
next_year = age + 1
```

### Mistake 2: Typo in Variable Name

```python
user_name = "Alice"
print(username)  # NameError
```

### Mistake 3: Confusing Integer Division and Regular Division

```python
# In Python 3
print(10 / 3)   # 3.333... (float)
print(10 // 3)  # 3        (int)
```

---

## Practice Exercises

### Exercise 1: BMI Calculator

```python
# BMI = weight(kg) / height(m)^2

weight = float(input("Weight (kg): "))
height = float(input("Height (cm): "))

height_m = height / 100  # convert cm to m
bmi = weight / (height_m ** 2)

print(f"Your BMI is {bmi:.1f}")
```

### Exercise 2: Temperature Converter

```python
# Celsius to Fahrenheit: F = C * 9/5 + 32

celsius = float(input("Temperature in Celsius: "))
fahrenheit = celsius * 9/5 + 32

print(f"{celsius}°C = {fahrenheit:.1f}°F")
```

---

## Next Steps

### What You Learned in This Guide

- Variables and assignment
- Basic data types
- Operators
- String operations
- Type conversion

### What to Study Next

1. **[03-control-flow.md](./03-control-flow.md)** -- Conditionals and loops

---

**Next guide**: [03-control-flow.md](./03-control-flow.md)

**Previous guide**: [01-python-intro.md](./01-python-intro.md)
