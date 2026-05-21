# Introduction to Python -- A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [What Is Python?](#what-is-python)
4. [Why Learn Python?](#why-learn-python)
5. [Installing Python](#installing-python)
6. [Setting Up Your Development Environment](#setting-up-your-development-environment)
7. [Your First Python Program](#your-first-python-program)
8. [Using the REPL (Interactive Mode)](#using-the-repl-interactive-mode)
9. [Common Issues and Solutions](#common-issues-and-solutions)
10. [Practice Exercises](#practice-exercises)
11. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The basic concepts and characteristics of Python
- Why Python is popular and where it is used
- How to install Python
- Setting up a development environment (VS Code + Python extension)
- Running your first Python program
- Using the REPL (interactive mode)

### Why It Matters

**Python** is one of the most popular programming languages in the world (ranked #1 in TIOBE Index 2024). Learning Python gives you:

- **Beginner-friendly**: Simple, readable syntax
- **Broad applicability**: Web development, data analysis, AI/ML, automation, and more
- **Rich ecosystem**: Over 1.3 million packages on PyPI
- **Career opportunities**: Data scientist, backend engineer, AI engineer, and more

### Estimated Time

- Reading this guide: 30--40 minutes
- Including environment setup: 1--2 hours

---

## Prerequisites

### Required Knowledge

**None.** This guide is written for people who have never programmed before.

### Recommended Environment

- **OS**: Windows 10/11, macOS 10.15 or later, or Linux
- **Memory**: At least 4 GB (8 GB or more recommended)
- **Disk**: At least 2 GB of free space

---

## What Is Python?

### Official Definition

The official Python website defines Python as:

> "Python is a programming language that lets you work quickly and integrate systems more effectively."

### A More Detailed Explanation

Python is a **general-purpose programming language developed by Guido van Rossum in 1991**.

#### 1. Interpreted Language

Python is an **interpreted language**. There is no compilation step -- you can run code as soon as you write it.

```python
# Write this code and run it immediately
print("Hello, World!")
```

**Difference from compiled languages (C, Java, etc.)**:
- **Compiled**: code → compile → executable → run
- **Interpreted**: code → run (directly)

#### 2. Dynamically Typed Language

Python uses **dynamic typing**. You do not need to declare the type of a variable explicitly.

```python
# No type declaration needed (type is inferred automatically)
name = "Alice"      # string
age = 25            # integer
height = 175.5      # floating-point number
is_student = True   # boolean
```

**Difference from statically typed languages (TypeScript, Java, etc.)**:
```typescript
// TypeScript (static typing)
let name: string = "Alice";
let age: number = 25;
```

```python
# Python (dynamic typing)
name = "Alice"
age = 25
```

#### 3. Object-Oriented Language

Python supports **object-oriented programming**.

```python
class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):
        print(f"{self.name}: Woof!")

# Create an object
my_dog = Dog("Rex")
my_dog.bark()  # Output: Rex: Woof!
```

#### 4. Batteries Included

Python has a **rich standard library**. Many features are available without installing anything extra.

```python
# File operations
import os
print(os.getcwd())  # Print current directory

# Date and time
import datetime
print(datetime.datetime.now())  # Print current time

# HTTP requests
import urllib.request
response = urllib.request.urlopen('https://example.com')
```

---

## Why Learn Python?

### 1. Readable and Easy to Write

Python is designed with **readability** as a priority.

```python
# Python code (reads like English)
if age >= 20:
    print("Adult")
else:
    print("Minor")
```

```java
// Java (for comparison)
if (age >= 20) {
    System.out.println("Adult");
} else {
    System.out.println("Minor");
}
```

**Python's characteristics**:
- Indentation (whitespace) defines blocks
- No semicolons required
- No curly braces `{}` required

### 2. Used Across Many Fields

Python is widely used in:

#### Web Development
- **Django**: Used by Instagram, Pinterest, Disqus
- **Flask**: Used by Uber, Reddit
- **FastAPI**: The fastest Python web framework

#### Data Science and Machine Learning
- **NumPy, Pandas**: Data analysis
- **Matplotlib, Seaborn**: Visualization
- **scikit-learn**: Machine learning
- **TensorFlow, PyTorch**: Deep learning

#### Automation and Scripting
- **File processing**: Bulk operations on large numbers of files
- **Web scraping**: BeautifulSoup, Scrapy
- **Task automation**: Streamlining daily work

#### Other Areas
- **Game development**: Pygame
- **Desktop apps**: Tkinter, PyQt
- **Scientific computing**: SciPy, SymPy

### 3. Rich Library Ecosystem

**PyPI (Python Package Index)** hosts over 1.3 million packages.

```bash
# Install packages with pip
pip install requests      # HTTP library
pip install pandas        # Data analysis
pip install django        # Web framework
pip install opencv-python # Image processing
```

### 4. Active Community

- **Stack Overflow**: 19 million+ Python-related questions
- **GitHub**: Python repositories are #2 across all languages
- **PyCon**: Python conferences held worldwide

### 5. High Job Demand

Python-related job postings are growing:
- Data Scientist
- Machine Learning Engineer
- Backend Engineer
- DevOps Engineer

---

## Installing Python

### Python Versions

As of 2024, the main Python versions are:
- **Python 3.12.x**: Latest stable release (recommended)
- **Python 3.11.x**: Stable release
- **Python 2.7.x**: **Deprecated** (support ended in 2020)

**Note**: Always install **Python 3.x**.

### Installation

#### Windows

1. **Visit the official site**: https://www.python.org/downloads/

2. **Download the latest version**: Click "Download Python 3.12.x"

3. **Run the installer**:
   - Check **"Add Python to PATH"** -- this is important
   - Click "Install Now"

4. **Verify installation**:
```bash
# Check in Command Prompt
python --version
# Example output: Python 3.12.0

pip --version
# Example output: pip 23.3.1
```

#### macOS

**Option 1: Official installer (recommended)**

1. Download from https://www.python.org/downloads/
2. Run the `.pkg` file
3. Install with default settings

**Option 2: Homebrew**

```bash
# If Homebrew is already installed
brew install python@3.12

# Verify
python3 --version
pip3 --version
```

#### Linux (Ubuntu/Debian)

```bash
# Update system packages
sudo apt update

# Install Python
sudo apt install python3 python3-pip

# Verify
python3 --version
pip3 --version
```

---

## Setting Up Your Development Environment

### Recommended Editor: VS Code

**Visual Studio Code (VS Code)** is a free editor that works great with Python.

#### 1. Install VS Code

1. Visit https://code.visualstudio.com/
2. Download and install

#### 2. Install the Python Extension

1. Open VS Code
2. Click the "Extensions" icon in the left sidebar
3. Search for "Python"
4. Install the **official Python extension by Microsoft**

#### 3. Create a Project Folder

```bash
# Go to your home directory
cd ~

# Create a folder for Python learning
mkdir python-learning
cd python-learning

# Open in VS Code
code .
```

---

## Your First Python Program

### Hello, World!

1. **Create a file**: In VS Code, create a file named `hello.py`

2. **Write the code**:
```python
# hello.py
print("Hello, World!")
```

3. **Run it**

**Run from terminal**:
```bash
python hello.py
# or (macOS/Linux)
python3 hello.py
```

**Output**:
```
Hello, World!
```

**Run from VS Code**: Click the "Play" button (▷) in the top right, or press `F5`.

### A Slightly More Complex Example

```python
# greeting.py
name = input("Enter your name: ")
age = input("Enter your age: ")

print(f"Hello, {name}!")
print(f"You are {age} years old.")

# Convert age to a number
age_number = int(age)
if age_number >= 18:
    print("You are an adult!")
else:
    years_left = 18 - age_number
    print(f"You will be an adult in {years_left} year(s).")
```

**Example run**:
```
$ python greeting.py
Enter your name: Alice
Enter your age: 16
Hello, Alice!
You are 16 years old.
You will be an adult in 2 year(s).
```

---

## Using the REPL (Interactive Mode)

### What Is the REPL?

The **REPL** (Read-Eval-Print Loop) is a mode that lets you run Python interactively.

- **R**ead: reads your input
- **E**val: evaluates (executes) it
- **P**rint: prints the result
- **L**oop: repeats

### Starting the REPL

```bash
# In your terminal
python
# or
python3
```

**Output**:
```python
Python 3.12.0 (main, Oct  2 2023, 14:00:00)
[Clang 15.0.0 (clang-1500.0.40.1)] on darwin
Type "help", "copyright", "credits" or "license" for more information.
>>>
```

### Experimenting in the REPL

```python
>>> 2 + 3
5

>>> name = "Alice"
>>> print(f"Hello, {name}!")
Hello, Alice!

>>> numbers = [1, 2, 3, 4, 5]
>>> sum(numbers)
15

>>> # Multi-line code
>>> for i in range(3):
...     print(f"Count: {i}")
...
Count: 0
Count: 1
Count: 2

>>> # Exit
>>> exit()
```

**Benefits of the REPL**:
- **Instant experimentation**: write code and see results immediately
- **Great for learning**: handy for trying out new features
- **Calculator**: useful for quick arithmetic

---

## Common Issues and Solutions

### Issue 1: `python: command not found`

**Symptom**:
```bash
$ python --version
python: command not found
```

**Causes**:
- Python is not installed
- Python is not on your PATH

**Solutions**:

**Windows**:
1. Reinstall Python
2. Make sure to check "Add Python to PATH"

**macOS/Linux**:
```bash
# Try python3
python3 --version

# Or set an alias
echo 'alias python=python3' >> ~/.bashrc
source ~/.bashrc
```

### Issue 2: `ModuleNotFoundError`

**Symptom**:
```python
>>> import requests
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
ModuleNotFoundError: No module named 'requests'
```

**Cause**: The package is not installed.

**Solution**:
```bash
pip install requests
# or
pip3 install requests
```

### Issue 3: Indentation Error

**Symptom**:
```python
if age >= 18:
print("Adult")  # No indentation
```

**Error**:
```
IndentationError: expected an indented block
```

**Solution**:
```python
if age >= 18:
    print("Adult")  # 4 spaces of indentation
```

**Python indentation rules**:
- Use a tab or 4 spaces (4 spaces recommended)
- Do not mix tabs and spaces

### Issue 4: Character Encoding Issues

**Symptom**: Non-ASCII characters are garbled.

**Solution**:
```python
# Add at the top of the file
# -*- coding: utf-8 -*-

print("Hello")
```

---

## Practice Exercises

### Exercise 1: Self-Introduction Program

**Difficulty**: Beginner

**Task**: Create a program that displays:
- Your name
- Your age
- Your favorite food

**Sample solution**:
```python
# self_intro.py
name = "Alice Smith"
age = 25
favorite_food = "Pizza"

print("== About Me ==")
print(f"Name: {name}")
print(f"Age: {age}")
print(f"Favorite food: {favorite_food}")
```

### Exercise 2: Simple Calculator

**Difficulty**: Beginner--Intermediate

**Task**: Accept two numbers as input and display the results of all four arithmetic operations.

**Sample solution**:
```python
# calculator.py
print("=== Simple Calculator ===")

num1 = float(input("Enter the first number: "))
num2 = float(input("Enter the second number: "))

addition = num1 + num2
subtraction = num1 - num2
multiplication = num1 * num2
division = num1 / num2 if num2 != 0 else "Error (cannot divide by zero)"

print(f"\n== Results ==")
print(f"{num1} + {num2} = {addition}")
print(f"{num1} - {num2} = {subtraction}")
print(f"{num1} * {num2} = {multiplication}")
print(f"{num1} / {num2} = {division}")
```

---

## Next Steps

### What You Learned in This Guide

- The basic concepts and characteristics of Python
- How to install Python
- Setting up a development environment (VS Code)
- Running your first Python program
- Using the REPL (interactive mode)

### What to Study Next

1. **[02-basic-syntax.md](./02-basic-syntax.md)** -- Variables, types, operators, string manipulation
2. **[03-control-flow.md](./03-control-flow.md)** -- Conditionals and loops

### Related Resources

- [Python.org](https://www.python.org/)
- [Python Tutorial (official)](https://docs.python.org/3/tutorial/index.html)
- [Real Python](https://realpython.com/) -- practical tutorials
- [PyPI (Python Package Index)](https://pypi.org/)

---

**Next guide**: [02-basic-syntax.md](./02-basic-syntax.md)

**Previous guide**: None (this is the first guide)
