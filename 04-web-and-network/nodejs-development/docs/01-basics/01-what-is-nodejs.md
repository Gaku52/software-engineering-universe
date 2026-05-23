# What is Node.js - Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What is Node.js](#what-is-nodejs)
3. [Why is Node.js Popular](#why-is-nodejs-popular)
4. [Installing Node.js](#installing-nodejs)
5. [Your First Node.js Program](#your-first-nodejs-program)
6. [Using the REPL](#using-the-repl)
7. [Next Steps](#next-steps)

---

## Overview

### What You'll Learn

- Core concepts of Node.js
- Running JavaScript on the server side
- How to install Node.js
- Running your first program

### Estimated Time: 30–40 minutes

---

## What is Node.js

### Definition

**Node.js** is a runtime environment for executing JavaScript on the server side.

```
Browser (frontend)
   JavaScript → Manipulates HTML

Node.js (backend)
   JavaScript → Manipulates servers, databases, files
```

### Features

1. **Uses JavaScript**
   - Same language as the frontend
   - Low learning cost

2. **Asynchronous I/O**
   - Fast and efficient
   - Handles many simultaneous connections

3. **NPM Ecosystem**
   - Over 1 million packages
   - Rich library selection

---

## Why is Node.js Popular

### 1. Full-Stack Development

```
Frontend: JavaScript (React, Vue)
    ↕
Backend: JavaScript (Node.js, Express)
    ↕
Database: JavaScript (MongoDB)
```

**Benefits**:
- Develop everything with one language
- Easy code reuse
- Improved team efficiency

### 2. High Performance

The **event loop** enables non-blocking I/O:

```javascript
// Synchronous (slow)
const data1 = readFileSync('file1.txt')
const data2 = readFileSync('file2.txt')  // waits for file1 to finish

// Asynchronous (fast)
readFile('file1.txt', (data1) => {})
readFile('file2.txt', (data2) => {})  // runs concurrently
```

### 3. Adoption by Major Companies

- **Netflix**: API servers
- **LinkedIn**: Backend
- **Uber**: Real-time matching
- **PayPal**: Payment systems

---

## Installing Node.js

### macOS

```bash
# Install via Homebrew (recommended)
brew install node

# Verify versions
node --version  # v20.10.0
npm --version   # 10.2.3
```

### Windows

```bash
# Download installer from official site
# https://nodejs.org/

# After installation, verify
node --version
npm --version
```

### Linux (Ubuntu)

```bash
# Install via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

### Version Management (Recommended)

```bash
# Manage Node.js versions with nvm
# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Install Node.js 20
nvm install 20
nvm use 20
```

---

## Your First Node.js Program

### 1. Create a Project Directory

```bash
mkdir hello-node
cd hello-node
```

### 2. Create a JavaScript File

Create `index.js`:

```javascript
// index.js
console.log('Hello, Node.js!')

// Calculation
const sum = (a, b) => a + b
console.log('2 + 3 =', sum(2, 3))

// Current time
const now = new Date()
console.log('Current time:', now.toLocaleString())
```

### 3. Run It

```bash
node index.js
```

**Output**:
```
Hello, Node.js!
2 + 3 = 5
Current time: 12/24/2024, 10:30:00 AM
```

---

## Using the REPL

### What is the REPL

**REPL (Read-Eval-Print Loop)** is an interactive environment where you can execute code on the fly.

```bash
# Start the REPL
node

# A prompt appears
>
```

### Usage Examples

```javascript
> 2 + 3
5

> const name = 'Alice'
undefined

> console.log(`Hello, ${name}!`)
Hello, Alice!
undefined

> [1, 2, 3].map(x => x * 2)
[ 2, 4, 6 ]

> .exit  // exit
```

---

## What You Can Do with Node.js

### 1. Web Servers

```javascript
const http = require('http')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Hello, World!')
})

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/')
})
```

### 2. File Operations

```javascript
const fs = require('fs')

// Read file
fs.readFile('data.txt', 'utf8', (err, data) => {
  if (err) throw err
  console.log(data)
})

// Write file
fs.writeFile('output.txt', 'Hello, Node.js!', (err) => {
  if (err) throw err
  console.log('File saved')
})
```

### 3. API Development

```javascript
const express = require('express')
const app = express()

app.get('/api/users', (req, res) => {
  res.json({ users: ['Alice', 'Bob'] })
})

app.listen(3000)
```

---

## Frequently Asked Questions

### Q1: Do I need to know JavaScript first?

**A**: Yes, a basic knowledge of JavaScript is required.

**Learning order**:
1. JavaScript basics (variables, functions, arrays)
2. ES6+ features (arrow functions, async/await)
3. Node.js

### Q2: What is the difference between browser JavaScript and Node.js?

| Item | Browser | Node.js |
|------|---------|---------|
| **DOM manipulation** | ✅ Available | ❌ Not available |
| **File I/O** | ❌ Not available | ✅ Available |
| **Modules** | ES Modules | CommonJS/ES Modules |
| **Global object** | window | global |

### Q3: What kinds of projects is it suited for?

**Good fit**:
- REST APIs
- Real-time apps (chat, games)
- Microservices
- CLI tools

**Not a good fit**:
- CPU-intensive processing (video encoding, etc.)
- Large-scale numerical computation

---

## Next Steps

### What You Learned in This Guide

- ✅ Core concepts of Node.js
- ✅ How to install
- ✅ Running your first program
- ✅ Using the REPL

### Next Guide to Study

**Next guide**: [02-javascript-basics.md](./02-javascript-basics.md) - JavaScript Basics

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
