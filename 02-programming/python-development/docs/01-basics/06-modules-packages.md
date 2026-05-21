# Modules and Packages -- A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What Are Modules?](#what-are-modules)
3. [The Standard Library](#the-standard-library)
4. [pip and Package Management](#pip-and-package-management)
5. [Virtual Environments](#virtual-environments)
6. [Practice Exercises](#practice-exercises)
7. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- Importing modules
- Using the standard library
- Installing packages with pip
- Creating and using virtual environments

### Estimated Time: 1--2 hours

---

## What Are Modules?

### Importing Modules

```python
# Import an entire module
import math
print(math.pi)        # 3.141592...
print(math.sqrt(16))  # 4.0

# Import specific functions
from math import pi, sqrt
print(pi)
print(sqrt(16))

# Import with an alias
import math as m
print(m.pi)

# Import everything (not recommended)
from math import *
```

### Writing Your Own Module

```python
# mymodule.py
def greet(name):
    return f"Hello, {name}!"

PI = 3.14159

# main.py
import mymodule
print(mymodule.greet("Alice"))
print(mymodule.PI)
```

---

## The Standard Library

### Commonly Used Standard Libraries

#### os (Operating System)

```python
import os

# Current directory
print(os.getcwd())

# List files in the directory
print(os.listdir("."))

# Join paths
path = os.path.join("folder", "file.txt")
```

#### datetime (Date and Time)

```python
from datetime import datetime, timedelta

# Current time
now = datetime.now()
print(now.strftime("%Y-%m-%d %H:%M:%S"))

# Date arithmetic
tomorrow = now + timedelta(days=1)
print(tomorrow)
```

#### random (Random Numbers)

```python
import random

# Random integer
print(random.randint(1, 10))

# Random choice from a list
fruits = ["apple", "banana", "orange"]
print(random.choice(fruits))

# Shuffle
random.shuffle(fruits)
```

#### json (JSON Processing)

```python
import json

# Dictionary to JSON string
data = {"name": "Alice", "age": 25}
json_str = json.dumps(data)

# JSON string to dictionary
data2 = json.loads(json_str)
```

---

## pip and Package Management

### Basic pip Commands

```bash
# Install a package
pip install requests

# Install a specific version
pip install requests==2.28.0

# Install multiple packages
pip install requests pandas numpy

# List installed packages
pip list

# Uninstall a package
pip uninstall requests

# Show package information
pip show requests

# Upgrade a package
pip install --upgrade requests
```

### requirements.txt

```bash
# Save installed packages
pip freeze > requirements.txt

# Install from requirements.txt
pip install -r requirements.txt
```

**Example requirements.txt**:
```
requests==2.28.0
pandas==1.5.0
numpy==1.23.0
```

---

## Virtual Environments

### Why Virtual Environments?

- Use different package versions per project
- Avoid affecting the system-wide Python installation
- Reproduce environments reliably with requirements.txt

### Using venv

```bash
# Create a virtual environment
python -m venv myenv

# Activate
# Windows
myenv\Scripts\activate

# macOS/Linux
source myenv/bin/activate

# Install packages (inside the virtual environment)
pip install requests

# Deactivate
deactivate
```

### Example Project Structure

```
my_project/
├── myenv/              # virtual environment (.gitignore this)
├── src/
│   └── main.py
├── requirements.txt
└── README.md
```

---

## Practice Exercises

### Exercise 1: File Operations

```python
import os

# List all .py files in the current directory
for file in os.listdir("."):
    if file.endswith(".py"):
        print(file)
```

### Exercise 2: Date Arithmetic

```python
from datetime import datetime, timedelta

# Calculate the date 100 days from now
today = datetime.now()
future = today + timedelta(days=100)
print(f"100 days from now: {future.strftime('%Y-%m-%d')}")
```

### Exercise 3: Read and Write JSON

```python
import json

# Prepare data
users = [
    {"name": "Alice", "age": 25},
    {"name": "Bob", "age": 30}
]

# Write to a JSON file
with open("users.json", "w", encoding="utf-8") as f:
    json.dump(users, f, indent=2)

# Read from a JSON file
with open("users.json", "r", encoding="utf-8") as f:
    loaded_users = json.load(f)
    print(loaded_users)
```

---

## Next Steps

### What You Learned in This Guide

- Importing modules
- Using the standard library
- Managing packages with pip
- Creating virtual environments

### Congratulations!

You have completed the Python basics series.

### What to Learn Next

1. **Object-Oriented Programming** -- classes and objects, inheritance, encapsulation
2. **File I/O** -- reading and writing files, working with CSV
3. **Error Handling** -- try/except, custom exceptions
4. **Practical Projects** -- web scraping, data analysis, web APIs

### Related Resources

- [Python Official Documentation](https://docs.python.org/3/)
- [Real Python](https://realpython.com/)
- [PyPI](https://pypi.org/)

---

**Previous guide**: [05-data-structures.md](./05-data-structures.md)
