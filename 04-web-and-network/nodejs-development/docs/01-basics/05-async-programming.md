# Asynchronous Programming — Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Synchronous vs Asynchronous](#synchronous-vs-asynchronous)
3. [Callbacks](#callbacks)
4. [Promises](#promises)
5. [async/await](#asyncawait)
6. [Error Handling](#error-handling)
7. [Exercises](#exercises)
8. [Next Steps](#next-steps)

---

## Overview

### What You'll Learn

- The difference between synchronous and asynchronous code
- Callback functions
- How to use Promises
- How to use async/await

### Estimated Time: 1–1.5 hours

---

## Synchronous vs Asynchronous

### Synchronous (Blocking)

```javascript
const fs = require('fs')

console.log('Start')

// Synchronous: waits for file read to complete
const data = fs.readFileSync('file.txt', 'utf8')
console.log(data)

console.log('End')
```

**Execution order**:
```
1. Start
2. (waiting for file read)
3. File contents
4. End
```

### Asynchronous (Non-blocking)

```javascript
const fs = require('fs')

console.log('Start')

// Asynchronous: continues without waiting
fs.readFile('file.txt', 'utf8', (err, data) => {
  console.log(data)
})

console.log('End')
```

**Execution order**:
```
1. Start
2. End
3. File contents
```

---

## Callbacks

### What is a Callback?

A **callback** is a function executed after an asynchronous operation completes.

```javascript
// Basic form
setTimeout(() => {
  console.log('2 seconds later')
}, 2000)

// Callback arguments
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) {
    console.error(err)
    return
  }
  console.log(data)
})
```

### Callback Hell

```javascript
// ❌ Callback hell (avoid this)
fs.readFile('file1.txt', 'utf8', (err, data1) => {
  if (err) return console.error(err)

  fs.readFile('file2.txt', 'utf8', (err, data2) => {
    if (err) return console.error(err)

    fs.readFile('file3.txt', 'utf8', (err, data3) => {
      if (err) return console.error(err)

      console.log(data1, data2, data3)
    })
  })
})
```

---

## Promises

### What is a Promise?

A **Promise** is an object representing the eventual result of an asynchronous operation.

**States**:
- **Pending**: operation in progress
- **Fulfilled**: operation succeeded
- **Rejected**: operation failed

### Basic Usage

```javascript
const readFileAsync = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

readFileAsync('file.txt')
  .then(data => {
    console.log(data)
  })
  .catch(err => {
    console.error(err)
  })
```

### Promise Chaining

```javascript
// ✅ Promise chain (readable)
readFileAsync('file1.txt')
  .then(data1 => {
    console.log('File 1:', data1)
    return readFileAsync('file2.txt')
  })
  .then(data2 => {
    console.log('File 2:', data2)
    return readFileAsync('file3.txt')
  })
  .then(data3 => {
    console.log('File 3:', data3)
  })
  .catch(err => {
    console.error(err)
  })
```

### Promise.all (Parallel Execution)

```javascript
const promises = [
  readFileAsync('file1.txt'),
  readFileAsync('file2.txt'),
  readFileAsync('file3.txt')
]

Promise.all(promises)
  .then(([data1, data2, data3]) => {
    console.log(data1, data2, data3)
  })
  .catch(err => {
    console.error(err)
  })
```

---

## async/await

### What is async/await?

**async/await** is syntax that makes Promises easier to read and write.

### Basic Usage

```javascript
async function readFiles() {
  try {
    const data1 = await readFileAsync('file1.txt')
    console.log('File 1:', data1)

    const data2 = await readFileAsync('file2.txt')
    console.log('File 2:', data2)

    const data3 = await readFileAsync('file3.txt')
    console.log('File 3:', data3)
  } catch (err) {
    console.error(err)
  }
}

readFiles()
```

### Arrow Function Syntax

```javascript
const readFiles = async () => {
  try {
    const data = await readFileAsync('file.txt')
    console.log(data)
  } catch (err) {
    console.error(err)
  }
}
```

### Parallel Execution

```javascript
// ❌ Sequential (slow)
async function sequential() {
  const data1 = await readFileAsync('file1.txt')  // 1s
  const data2 = await readFileAsync('file2.txt')  // 1s
  const data3 = await readFileAsync('file3.txt')  // 1s
  // Total: 3s
}

// ✅ Parallel (fast)
async function parallel() {
  const [data1, data2, data3] = await Promise.all([
    readFileAsync('file1.txt'),
    readFileAsync('file2.txt'),
    readFileAsync('file3.txt')
  ])
  // Total: 1s
}
```

---

## Error Handling

### try-catch

```javascript
async function fetchData() {
  try {
    const response = await fetch('https://api.example.com/data')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error:', error.message)
    throw error
  }
}
```

### Multiple try-catch Blocks

```javascript
async function process() {
  let data

  try {
    data = await fetchData()
  } catch (error) {
    console.error('Fetch failed:', error)
    return
  }

  try {
    await saveData(data)
  } catch (error) {
    console.error('Save failed:', error)
  }
}
```

---

## Practical Examples

### Example 1: API Request

```javascript
const fetch = require('node-fetch')

// Using async/await (recommended)
async function getUser(id) {
  try {
    const response = await fetch(`https://api.example.com/users/${id}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const user = await response.json()
    return user
  } catch (error) {
    console.error('Failed to fetch user:', error)
    throw error
  }
}

getUser(1)
  .then(user => console.log(user))
  .catch(err => console.error(err))
```

### Example 2: Multiple API Calls

```javascript
async function fetchMultipleUsers() {
  try {
    const [user1, user2, user3] = await Promise.all([
      getUser(1),
      getUser(2),
      getUser(3)
    ])

    console.log('Users:', user1, user2, user3)
  } catch (error) {
    console.error('Failed to fetch users:', error)
  }
}
```

---

## async/await in Express

### Route Handlers

```javascript
const express = require('express')
const app = express()

// ❌ Errors are not caught
app.get('/users/:id', async (req, res) => {
  const user = await getUser(req.params.id)
  res.json({ user })
})

// ✅ Wrap in try-catch
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await getUser(req.params.id)
    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})
```

### Async Wrapper Utility

```javascript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id)
  res.json({ user })
}))
```

---

## Common Mistakes

### Forgetting await

```javascript
// ❌ Returns a Promise object, not the data
async function fetchData() {
  const data = fetch('https://api.example.com')
  console.log(data)  // [Promise]
}

// ✅ Correct
async function fetchData() {
  const data = await fetch('https://api.example.com')
  console.log(data)
}
```

### Using await Outside async

```javascript
// ❌ Error: await outside async function
const data = await fetchData()

// ✅ Correct
async function main() {
  const data = await fetchData()
}

main()
```

---

## Exercises

### Task: sleep Function

Implement a `sleep` function.

```javascript
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function example() {
  console.log('Start')
  await sleep(2000)
  console.log('2 seconds later')
}

example()
```

---

## Next Steps

### What You Learned

- ✅ The difference between synchronous and asynchronous code
- ✅ Callback functions
- ✅ How to use Promises
- ✅ How to use async/await

**Next guide**: [06-first-server-tutorial.md](./06-first-server-tutorial.md) — Building Your First Server

---

**Previous guide**: [04-express-intro.md](./04-express-intro.md)

**Parent**: [Node.js Development - SKILL.md](../../SKILL.md)
