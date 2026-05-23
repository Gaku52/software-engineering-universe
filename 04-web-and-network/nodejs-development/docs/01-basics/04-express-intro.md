# Express Basics — Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [What is Express?](#what-is-express)
3. [Your First Express App](#your-first-express-app)
4. [Routing](#routing)
5. [Middleware](#middleware)
6. [Request and Response](#request-and-response)
7. [Exercises](#exercises)
8. [Next Steps](#next-steps)

---

## Overview

### What You'll Learn

- Express framework fundamentals
- Basic routing
- The middleware concept
- Handling requests and responses

### Estimated Time: 1–1.5 hours

---

## What is Express?

### Definition

**Express** is the most popular web framework for Node.js.

**Features**:
- Minimal and simple
- Highly flexible
- Rich middleware ecosystem
- Large community

### Installation

```bash
mkdir express-app
cd express-app
npm init -y

npm install express
```

---

## Your First Express App

### Hello World

Create `index.js`:

```javascript
const express = require('express')
const app = express()
const PORT = 3000

app.get('/', (req, res) => {
  res.send('Hello, Express!')
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
```

### Run It

```bash
node index.js
```

Open `http://localhost:3000` in your browser.

---

## Routing

### HTTP Methods

```javascript
const express = require('express')
const app = express()

// GET
app.get('/users', (req, res) => {
  res.json({ users: ['Alice', 'Bob'] })
})

// POST
app.post('/users', (req, res) => {
  res.status(201).json({ message: 'User created' })
})

// PUT
app.put('/users/:id', (req, res) => {
  res.json({ message: `User ${req.params.id} updated` })
})

// DELETE
app.delete('/users/:id', (req, res) => {
  res.json({ message: `User ${req.params.id} deleted` })
})

app.listen(3000)
```

### Path Parameters

```javascript
// /users/123
app.get('/users/:id', (req, res) => {
  const userId = req.params.id
  res.json({ userId })
})

// Multiple parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params
  res.json({ userId, postId })
})
```

### Query Parameters

```javascript
// /search?q=express&limit=10
app.get('/search', (req, res) => {
  const { q, limit } = req.query
  res.json({ query: q, limit: limit || 20 })
})
```

---

## Middleware

### What is Middleware?

**Middleware** is a function that runs between the request and the response.

```
Request → Middleware 1 → Middleware 2 → Route Handler → Response
```

### Built-in Middleware

```javascript
const express = require('express')
const app = express()

// JSON parser
app.use(express.json())

// URL-encoded data
app.use(express.urlencoded({ extended: true }))

// Serve static files
app.use(express.static('public'))
```

### Custom Middleware

```javascript
// Logging middleware
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()  // Pass control to the next middleware
}

app.use(logger)

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.user = { id: 1, name: 'Alice' }
  next()
}

// Apply to a specific route
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})
```

---

## Request and Response

### req (Request) Object

```javascript
app.post('/api/users', (req, res) => {
  const body = req.body          // Request body
  const id = req.params.id       // Path parameters
  const query = req.query        // Query parameters
  const contentType = req.get('Content-Type')  // Headers
  const method = req.method      // HTTP method
  const url = req.url            // Full URL
  const path = req.path          // Path only

  res.json({ received: true })
})
```

### res (Response) Object

```javascript
app.get('/api/users', (req, res) => {
  res.json({ name: 'Alice' })              // JSON response
  res.send('Hello')                        // Text response
  res.status(404).json({ error: 'Not Found' })  // With status code
  res.redirect('/home')                    // Redirect
  res.set('Content-Type', 'application/json')   // Set header
  res.sendFile('/path/to/file.pdf')        // Send file
})
```

---

## Practical Example

### User CRUD API

```javascript
const express = require('express')
const app = express()

app.use(express.json())

let users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
]

// GET /api/users
app.get('/api/users', (req, res) => {
  res.json({ users })
})

// GET /api/users/:id
app.get('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const user = users.find(u => u.id === id)

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json({ user })
})

// POST /api/users
app.post('/api/users', (req, res) => {
  const { name, email } = req.body

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' })
  }

  const newUser = { id: users.length + 1, name, email }
  users.push(newUser)
  res.status(201).json({ user: newUser })
})

// PUT /api/users/:id
app.put('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const { name, email } = req.body
  const index = users.findIndex(u => u.id === id)

  if (index === -1) {
    return res.status(404).json({ error: 'User not found' })
  }

  users[index] = { id, name, email }
  res.json({ user: users[index] })
})

// DELETE /api/users/:id
app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const index = users.findIndex(u => u.id === id)

  if (index === -1) {
    return res.status(404).json({ error: 'User not found' })
  }

  users.splice(index, 1)
  res.json({ message: 'User deleted' })
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
```

### Testing with curl

```bash
curl http://localhost:3000/api/users
curl http://localhost:3000/api/users/1
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie","email":"charlie@example.com"}'
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Smith","email":"alice@example.com"}'
curl -X DELETE http://localhost:3000/api/users/1
```

---

## Error Handling

### Error Handlers

```javascript
// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// Error handler (must be last)
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal Server Error' })
})
```

### try-catch Pattern

```javascript
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const user = await getUserById(id)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error) {
    next(error)
  }
})
```

---

## Common Mistakes

### Forgetting next()

```javascript
// ❌ Without next(), the request hangs
app.use((req, res, next) => {
  console.log('Middleware')
})

// ✅ Always call next()
app.use((req, res, next) => {
  console.log('Middleware')
  next()
})
```

### Sending Multiple Responses

```javascript
// ❌ Error: cannot send headers after they are sent
app.get('/', (req, res) => {
  res.send('Hello')
  res.send('World')
})

// ✅ Send exactly one response
app.get('/', (req, res) => {
  res.send('Hello World')
})
```

---

## Exercises

### Task: Task Management API

Build an API with:
- GET /api/tasks — list all tasks
- POST /api/tasks — create a task
- DELETE /api/tasks/:id — delete a task

---

## Next Steps

### What You Learned

- ✅ Express framework fundamentals
- ✅ Basic routing
- ✅ The middleware concept
- ✅ Handling requests and responses

**Next guide**: [05-async-programming.md](./05-async-programming.md) — Asynchronous Programming

---

**Previous guide**: [03-npm-basics.md](./03-npm-basics.md)

**Parent**: [Node.js Development - SKILL.md](../../SKILL.md)
