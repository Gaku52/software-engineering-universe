# Express Fundamentals — Complete Guide

## Table of Contents

1. [What is Express?](#what-is-express)
2. [Installing and Basic Setup](#installing-and-basic-setup)
3. [Routing Basics](#routing-basics)
4. [Request and Response Objects](#request-and-response-objects)
5. [Serving Static Files](#serving-static-files)
6. [FAQ](#faq)

---

## What is Express?

Express is a minimal and flexible Node.js web application framework that provides a robust set of features for building web and mobile applications. It is the most popular Node.js framework and the foundation of many production-grade systems.

```
┌─────────────────────────────────────────────┐
│              Node.js Runtime                │
│  ┌───────────────────────────────────────┐  │
│  │         Express Framework             │  │
│  │  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  Router  │  │   Middleware      │  │  │
│  │  └──────────┘  └──────────────────┘  │  │
│  │  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │   Req    │  │      Res         │  │  │
│  │  └──────────┘  └──────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Why Use Express?

- **Minimal footprint** — No opinions on database, template engine, or structure
- **Middleware ecosystem** — Thousands of compatible npm packages
- **Fast routing** — Clean, chainable route definitions
- **Large community** — Extensive documentation and Stack Overflow answers
- **Proven in production** — Used by major companies worldwide

---

## Installing and Basic Setup

### Prerequisites

- Node.js 18 or later installed
- npm or yarn available in your terminal

### Initialize a Project

```bash
mkdir my-express-app
cd my-express-app
npm init -y
npm install express
```

### Minimal Server

```javascript
// server.js
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Run it:

```bash
node server.js
# → Server running on http://localhost:3000
```

### Project Structure (Recommended)

```
my-express-app/
├── server.js          ← entry point
├── routes/
│   ├── users.js
│   └── products.js
├── middleware/
│   └── auth.js
├── controllers/
│   └── userController.js
├── package.json
└── .env
```

### Using nodemon for Development

```bash
npm install --save-dev nodemon
```

Add to `package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

```bash
npm run dev
# Auto-restarts when files change
```

---

## Routing Basics

Routing maps HTTP methods and URL paths to handler functions.

### Syntax

```javascript
app.METHOD(PATH, HANDLER);
//  ^^^^^^  ^^^^  ^^^^^^^
//  HTTP    URL   function(req, res)
```

### GET — Read Data

```javascript
// List all users
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// Get a single user by ID
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ id, name: 'Alice' });
});
```

### POST — Create Data

```javascript
app.use(express.json()); // Must parse JSON body first

app.post('/users', (req, res) => {
  const { name, email } = req.body;
  // Save to database ...
  res.status(201).json({ id: 1, name, email });
});
```

### PUT — Replace Data

```javascript
app.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  // Replace user in database ...
  res.json({ id, name, email });
});
```

### PATCH — Update Partial Data

```javascript
app.patch('/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  // Apply partial update ...
  res.json({ id, ...updates });
});
```

### DELETE — Remove Data

```javascript
app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  // Delete from database ...
  res.status(204).send(); // No content
});
```

### Route Parameters and Query Strings

```javascript
// Route parameter: /products/42
app.get('/products/:id', (req, res) => {
  console.log(req.params.id); // "42"
});

// Query string: /search?q=node&limit=10
app.get('/search', (req, res) => {
  console.log(req.query.q);     // "node"
  console.log(req.query.limit); // "10"
});
```

### Express Router — Modular Routes

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ users: [] }));
router.get('/:id', (req, res) => res.json({ id: req.params.id }));
router.post('/', (req, res) => res.status(201).json(req.body));
router.delete('/:id', (req, res) => res.status(204).send());

module.exports = router;
```

```javascript
// server.js
const usersRouter = require('./routes/users');

app.use('/users', usersRouter);
// GET  /users      → router.get('/')
// GET  /users/42   → router.get('/:id')
// POST /users      → router.post('/')
```

### Route Chaining

```javascript
app.route('/books')
  .get((req, res) => res.json({ books: [] }))
  .post((req, res) => res.status(201).json(req.body));

app.route('/books/:id')
  .get((req, res) => res.json({ id: req.params.id }))
  .put((req, res) => res.json(req.body))
  .delete((req, res) => res.status(204).send());
```

---

## Request and Response Objects

### Request Object (`req`)

```javascript
app.post('/example', (req, res) => {
  // URL parameters (/example/:id)
  console.log(req.params);       // { id: '42' }

  // Query string (?page=2&limit=20)
  console.log(req.query);        // { page: '2', limit: '20' }

  // Request body (JSON or form data)
  console.log(req.body);         // { name: 'Alice', email: '...' }

  // HTTP headers
  console.log(req.headers);      // { 'content-type': 'application/json', ... }
  console.log(req.get('Authorization')); // 'Bearer token123'

  // Request metadata
  console.log(req.method);       // 'POST'
  console.log(req.path);         // '/example'
  console.log(req.url);          // '/example?page=2'
  console.log(req.ip);           // '127.0.0.1'
  console.log(req.protocol);     // 'http'
  console.log(req.secure);       // false (true if HTTPS)
});
```

### Response Object (`res`)

```javascript
app.get('/response-demo', (req, res) => {
  // Send plain text
  res.send('Hello World');

  // Send JSON
  res.json({ message: 'Success', data: [] });

  // Set status code then send
  res.status(201).json({ id: 1 });
  res.status(404).json({ error: 'Not found' });
  res.status(204).send(); // No content

  // Set response headers
  res.set('X-Custom-Header', 'value');
  res.set({ 'Cache-Control': 'no-store', 'X-Powered-By': 'Express' });

  // Redirect
  res.redirect('/new-path');
  res.redirect(301, '/permanent-new-path');

  // Send a file
  res.sendFile('/absolute/path/to/file.pdf');

  // Download a file
  res.download('/path/to/report.pdf', 'report.pdf');

  // Render a template (requires view engine setup)
  res.render('index', { title: 'Home', user: req.user });
});
```

### Content Type Helpers

```javascript
// Express sets Content-Type automatically:
res.send('text');           // text/html
res.json({ key: 'val' });   // application/json
res.sendFile('image.png');  // image/png (detected)

// Override manually:
res.type('application/xml').send('<root/>');
```

---

## Serving Static Files

Use `express.static` to serve HTML, CSS, JavaScript, images, and other assets.

### Basic Setup

```javascript
const path = require('path');

// Serve files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
```

```
public/
├── index.html        → accessible at /index.html (or /)
├── css/
│   └── style.css     → accessible at /css/style.css
├── js/
│   └── app.js        → accessible at /js/app.js
└── images/
    └── logo.png      → accessible at /images/logo.png
```

### With a Virtual Path Prefix

```javascript
// Files in "public" served under /static/...
app.use('/static', express.static(path.join(__dirname, 'public')));
// /static/css/style.css → public/css/style.css
```

### Multiple Static Directories

```javascript
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));
// Express searches directories in order
```

### Cache Control

```javascript
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',        // Cache for 1 day
  etag: true,          // Enable ETags
  lastModified: true,  // Enable Last-Modified headers
}));
```

---

## FAQ

**Q: Do I need Express to build a web server in Node.js?**
No. Node.js has a built-in `http` module. Express builds on top of it to reduce boilerplate and provide routing, middleware, and helpers.

**Q: What is the difference between `app.use` and `app.get`?**
`app.use` matches any HTTP method and optionally any path prefix. `app.get` matches only GET requests to an exact path. Use `app.use` for middleware and `app.get`/`app.post`/etc. for route handlers.

**Q: How do I handle 404 errors in Express?**
Add a catch-all route at the end of your middleware chain:
```javascript
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
```

**Q: Can I use ES modules (`import`/`export`) with Express?**
Yes. Set `"type": "module"` in `package.json` and use `.js` files with `import express from 'express'`. Note that `__dirname` and `__filename` are not available in ES modules — use `import.meta.url` with `new URL`.

**Q: What version of Express should I use?**
Express 5 (stable as of 2024) is recommended for new projects. It adds native async/await error propagation and other improvements.

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
