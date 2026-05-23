# Building Your First Server — Comprehensive Tutorial

## Table of Contents

1. [Overview](#overview)
2. [Project Goal](#project-goal)
3. [Project Setup](#project-setup)
4. [Server Implementation](#server-implementation)
5. [Data Management](#data-management)
6. [Error Handling](#error-handling)
7. [Testing and Debugging](#testing-and-debugging)
8. [Summary](#summary)

---

## Overview

### What You'll Build

This tutorial integrates all concepts learned so far to implement a **Task Management API**.

### Features

- ✅ List all tasks
- ✅ Create a task
- ✅ Update a task
- ✅ Delete a task
- ✅ Data persistence (JSON file)
- ✅ Error handling

### Estimated Time: 2–3 hours

---

## Project Goal

### The Final API

```
GET    /api/tasks          - List tasks
POST   /api/tasks          - Create a task
GET    /api/tasks/:id      - Get task details
PUT    /api/tasks/:id      - Update a task
DELETE /api/tasks/:id      - Delete a task
```

---

## Project Setup

### Step 1: Create the Project

```bash
mkdir task-api
cd task-api

npm init -y

npm install express
npm install --save-dev nodemon
```

### Step 2: Directory Structure

```bash
task-api/
├── src/
│   ├── server.js          # Server entry point
│   ├── routes/
│   │   └── tasks.js       # Tasks router
│   └── data/
│       └── tasks.json     # Data file
├── package.json
└── .gitignore
```

```bash
mkdir -p src/routes src/data
touch src/server.js
touch src/routes/tasks.js
touch src/data/tasks.json
echo "node_modules/" > .gitignore
```

### Step 3: Configure package.json

```json
{
  "name": "task-api",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## Server Implementation

### src/server.js

```javascript
const express = require('express')
const tasksRouter = require('./routes/tasks')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    message: 'Task API',
    endpoints: {
      tasks: '/api/tasks',
      task: '/api/tasks/:id'
    }
  })
})

app.use('/api/tasks', tasksRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal Server Error' })
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
```

---

## Data Management

### src/data/tasks.json (initial data)

```json
[
  {
    "id": 1,
    "title": "Go grocery shopping",
    "completed": false,
    "createdAt": "2024-12-24T10:00:00.000Z"
  },
  {
    "id": 2,
    "title": "Reply to emails",
    "completed": true,
    "createdAt": "2024-12-24T11:00:00.000Z"
  }
]
```

### src/routes/tasks.js

```javascript
const express = require('express')
const fs = require('fs').promises
const path = require('path')

const router = express.Router()
const DATA_FILE = path.join(__dirname, '../data/tasks.json')

async function readTasks() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Failed to read tasks:', error)
    return []
  }
}

async function writeTasks(tasks) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2))
  } catch (error) {
    console.error('Failed to write tasks:', error)
    throw error
  }
}

// GET /api/tasks
router.get('/', async (req, res, next) => {
  try {
    const tasks = await readTasks()
    res.json({ tasks })
  } catch (error) {
    next(error)
  }
})

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const tasks = await readTasks()
    const task = tasks.find(t => t.id === parseInt(req.params.id))

    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    res.json({ task })
  } catch (error) {
    next(error)
  }
})

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' })
    }

    const tasks = await readTasks()
    const newTask = {
      id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    }

    tasks.push(newTask)
    await writeTasks(tasks)

    res.status(201).json({ task: newTask })
  } catch (error) {
    next(error)
  }
})

// PUT /api/tasks/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const { title, completed } = req.body

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      return res.status(400).json({ error: 'Invalid title' })
    }

    if (completed !== undefined && typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'Invalid completed value' })
    }

    const tasks = await readTasks()
    const taskIndex = tasks.findIndex(t => t.id === id)

    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' })
    }

    if (title !== undefined) tasks[taskIndex].title = title.trim()
    if (completed !== undefined) tasks[taskIndex].completed = completed

    await writeTasks(tasks)
    res.json({ task: tasks[taskIndex] })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const tasks = await readTasks()
    const taskIndex = tasks.findIndex(t => t.id === id)

    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' })
    }

    tasks.splice(taskIndex, 1)
    await writeTasks(tasks)

    res.json({ message: 'Task deleted' })
  } catch (error) {
    next(error)
  }
})

module.exports = router
```

---

## Testing and Debugging

### Start the Server

```bash
# Development mode (auto-restart)
npm run dev

# Production mode
npm start
```

### Test with curl

```bash
# 1. List tasks
curl http://localhost:3000/api/tasks

# 2. Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"New task"}'

# 3. Get task details
curl http://localhost:3000/api/tasks/1

# 4. Update a task
curl -X PUT http://localhost:3000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# 5. Delete a task
curl -X DELETE http://localhost:3000/api/tasks/1
```

---

## Extension Ideas

### 1. Search and Filtering

```javascript
// GET /api/tasks?completed=false
router.get('/', async (req, res, next) => {
  try {
    let tasks = await readTasks()

    if (req.query.completed !== undefined) {
      const completed = req.query.completed === 'true'
      tasks = tasks.filter(t => t.completed === completed)
    }

    res.json({ tasks })
  } catch (error) {
    next(error)
  }
})
```

### 2. Sorting

```javascript
// GET /api/tasks?sort=createdAt&order=desc
router.get('/', async (req, res, next) => {
  try {
    let tasks = await readTasks()
    const { sort = 'id', order = 'asc' } = req.query
    tasks.sort((a, b) => {
      const aVal = a[sort]
      const bVal = b[sort]
      return order === 'asc' ? aVal > bVal ? 1 : -1 : aVal < bVal ? 1 : -1
    })
    res.json({ tasks })
  } catch (error) {
    next(error)
  }
})
```

### 3. Pagination

```javascript
// GET /api/tasks?page=1&limit=10
router.get('/', async (req, res, next) => {
  try {
    const tasks = await readTasks()
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const startIndex = (page - 1) * limit
    const paginatedTasks = tasks.slice(startIndex, startIndex + limit)

    res.json({
      tasks: paginatedTasks,
      pagination: {
        page,
        limit,
        total: tasks.length,
        totalPages: Math.ceil(tasks.length / limit)
      }
    })
  } catch (error) {
    next(error)
  }
})
```

---

## Summary

### What You Learned

- ✅ Building an API with Express
- ✅ Routing and middleware
- ✅ File-based data management
- ✅ Asynchronous programming (async/await)
- ✅ Error handling
- ✅ CRUD operations

### Next Steps

1. **Database integration**: MongoDB, PostgreSQL, etc.
2. **Authentication**: JWT, OAuth
3. **Validation**: Joi, express-validator
4. **Testing**: Jest, Supertest
5. **Deployment**: Heroku, Render, AWS, etc.

---

**Previous guide**: [05-async-programming.md](./05-async-programming.md)

**Parent**: [Node.js Development - SKILL.md](../../SKILL.md)

**Congratulations!** You've learned all the Node.js development fundamentals.
