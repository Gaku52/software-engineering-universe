# Building REST APIs with Express — Complete Guide

## Table of Contents

1. [REST API Design Principles](#rest-api-design-principles)
2. [Building a Complete CRUD API](#building-a-complete-crud-api)
3. [Request Validation](#request-validation)
4. [Response Formatting](#response-formatting)
5. [HTTP Status Codes](#http-status-codes)
6. [API Versioning](#api-versioning)
7. [FAQ](#faq)

---

## REST API Design Principles

REST (Representational State Transfer) is an architectural style for networked applications. A RESTful API uses HTTP methods and URIs to expose resources.

### Core Constraints

| Constraint       | Description                                              |
|-----------------|----------------------------------------------------------|
| Stateless        | Each request contains all information needed to process it |
| Client–Server    | Client and server are decoupled                          |
| Uniform Interface| Consistent resource naming and HTTP methods              |
| Cacheable        | Responses must define themselves as cacheable or not     |
| Layered System   | Client cannot tell if it is connected to the end server  |

### Resource Naming Conventions

```
✅ Good (nouns, plural)
GET    /users              → list users
GET    /users/42           → get user 42
POST   /users              → create user
PUT    /users/42           → replace user 42
PATCH  /users/42           → partially update user 42
DELETE /users/42           → delete user 42

GET    /users/42/posts     → posts belonging to user 42
GET    /users/42/posts/7   → post 7 belonging to user 42

❌ Bad (verbs in URL)
GET    /getUsers
POST   /createUser
DELETE /deleteUser/42
```

### HTTP Methods and Idempotency

```
Method  │ Safe │ Idempotent │ Use Case
────────┼──────┼────────────┼────────────────────────
GET     │  ✓   │     ✓      │ Read resource(s)
HEAD    │  ✓   │     ✓      │ Read headers only
POST    │  ✗   │     ✗      │ Create resource
PUT     │  ✗   │     ✓      │ Replace entire resource
PATCH   │  ✗   │     ✗      │ Partial update
DELETE  │  ✗   │     ✓      │ Delete resource
OPTIONS │  ✓   │     ✓      │ CORS preflight
```

---

## Building a Complete CRUD API

### Project Setup

```bash
mkdir rest-api-demo
cd rest-api-demo
npm init -y
npm install express express-validator
npm install --save-dev nodemon
```

### Entry Point

```javascript
// server.js
const express = require('express');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/users', usersRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

module.exports = app;
```

### In-memory Data Store (for demonstration)

```javascript
// data/store.js
let users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', createdAt: new Date().toISOString() },
  { id: 2, name: 'Bob',   email: 'bob@example.com',   role: 'user',  createdAt: new Date().toISOString() },
];
let nextId = 3;

module.exports = {
  findAll: () => [...users],
  findById: (id) => users.find(u => u.id === Number(id)),
  create: (data) => {
    const user = { id: nextId++, ...data, createdAt: new Date().toISOString() };
    users.push(user);
    return user;
  },
  update: (id, data) => {
    const index = users.findIndex(u => u.id === Number(id));
    if (index === -1) return null;
    users[index] = { ...users[index], ...data };
    return users[index];
  },
  remove: (id) => {
    const index = users.findIndex(u => u.id === Number(id));
    if (index === -1) return false;
    users.splice(index, 1);
    return true;
  },
};
```

### CRUD Routes

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();
const store = require('../data/store');

// GET /api/v1/users — list with pagination and filtering
router.get('/', (req, res) => {
  const { page = 1, limit = 10, role } = req.query;

  let users = store.findAll();

  // Filter
  if (role) {
    users = users.filter(u => u.role === role);
  }

  // Pagination
  const total = users.length;
  const start = (Number(page) - 1) * Number(limit);
  const paginated = users.slice(start, start + Number(limit));

  res.json({
    success: true,
    data: paginated,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// GET /api/v1/users/:id — get one
router.get('/:id', (req, res, next) => {
  const user = store.findById(req.params.id);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    return next(err);
  }
  res.json({ success: true, data: user });
});

// POST /api/v1/users — create
router.post('/', (req, res) => {
  const { name, email, role = 'user' } = req.body;
  const user = store.create({ name, email, role });
  res
    .status(201)
    .set('Location', `/api/v1/users/${user.id}`)
    .json({ success: true, data: user });
});

// PUT /api/v1/users/:id — replace
router.put('/:id', (req, res, next) => {
  const { name, email, role } = req.body;
  const user = store.update(req.params.id, { name, email, role });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    return next(err);
  }
  res.json({ success: true, data: user });
});

// PATCH /api/v1/users/:id — partial update
router.patch('/:id', (req, res, next) => {
  const allowed = ['name', 'email', 'role'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  const user = store.update(req.params.id, updates);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    return next(err);
  }
  res.json({ success: true, data: user });
});

// DELETE /api/v1/users/:id — delete
router.delete('/:id', (req, res, next) => {
  const deleted = store.remove(req.params.id);
  if (!deleted) {
    const err = new Error('User not found');
    err.status = 404;
    return next(err);
  }
  res.status(204).send();
});

module.exports = router;
```

---

## Request Validation

Never trust user input. Validate early and return clear error messages.

### Manual Validation

```javascript
router.post('/', (req, res, next) => {
  const { name, email, role } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }
  if (role && !['admin', 'user', 'moderator'].includes(role)) {
    errors.push({ field: 'role', message: 'Role must be admin, user, or moderator' });
  }

  if (errors.length > 0) {
    return res.status(422).json({ success: false, errors });
  }

  const user = store.create({ name: name.trim(), email, role: role || 'user' });
  res.status(201).json({ success: true, data: user });
});
```

### Using express-validator

```bash
npm install express-validator
```

```javascript
const { body, param, query, validationResult } = require('express-validator');

// Reusable validation middleware
function validate(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map(v => v.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
      });
    }
    next();
  };
}

// Validation rules
const createUserRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'user', 'moderator'])
    .withMessage('Role must be admin, user, or moderator'),
];

const userIdRule = [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
];

const paginationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be ≥ 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100'),
];

// Apply to routes
router.get('/',    validate(paginationRules), listUsers);
router.post('/',   validate(createUserRules), createUser);
router.get('/:id', validate(userIdRule), getUser);
```

---

## Response Formatting

Consistent response shapes make APIs predictable and easy to consume.

### Standard Success Response

```javascript
// Single resource
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  }
}

// Collection with pagination
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 2,
    "limit": 10,
    "totalPages": 10
  }
}
```

### Standard Error Response

```javascript
// Single error
{
  "success": false,
  "error": "User not found"
}

// Validation errors
{
  "success": false,
  "errors": [
    { "field": "email", "message": "Valid email is required" },
    { "field": "name",  "message": "Name is required" }
  ]
}
```

### Response Helper

```javascript
// utils/response.js
const send = {
  ok: (res, data, meta = undefined) => {
    const body = { success: true, data };
    if (meta) body.meta = meta;
    res.status(200).json(body);
  },
  created: (res, data, location) => {
    if (location) res.set('Location', location);
    res.status(201).json({ success: true, data });
  },
  noContent: (res) => res.status(204).send(),
  badRequest: (res, errors) => res.status(400).json({ success: false, errors }),
  unauthorized: (res, message = 'Unauthorized') =>
    res.status(401).json({ success: false, error: message }),
  forbidden: (res, message = 'Forbidden') =>
    res.status(403).json({ success: false, error: message }),
  notFound: (res, resource = 'Resource') =>
    res.status(404).json({ success: false, error: `${resource} not found` }),
  unprocessable: (res, errors) =>
    res.status(422).json({ success: false, errors }),
  internal: (res, message = 'Internal server error') =>
    res.status(500).json({ success: false, error: message }),
};

module.exports = send;
```

---

## HTTP Status Codes

### 2xx — Success

| Code | Name       | When to Use                                        |
|------|------------|----------------------------------------------------|
| 200  | OK         | Successful GET, PUT, PATCH                         |
| 201  | Created    | Successful POST that creates a resource            |
| 204  | No Content | Successful DELETE, or POST/PUT with no body needed |

### 3xx — Redirection

| Code | Name              | When to Use                          |
|------|-------------------|--------------------------------------|
| 301  | Moved Permanently | Resource permanently moved           |
| 304  | Not Modified      | Cached resource is still valid       |

### 4xx — Client Errors

| Code | Name                 | When to Use                                       |
|------|----------------------|---------------------------------------------------|
| 400  | Bad Request          | Malformed request syntax, invalid parameters      |
| 401  | Unauthorized         | Authentication required or failed                 |
| 403  | Forbidden            | Authenticated but not authorized                  |
| 404  | Not Found            | Resource does not exist                           |
| 405  | Method Not Allowed   | HTTP method not supported for this resource       |
| 409  | Conflict             | State conflict (e.g., duplicate email)            |
| 422  | Unprocessable Entity | Validation errors (semantically invalid request)  |
| 429  | Too Many Requests    | Rate limit exceeded                               |

### 5xx — Server Errors

| Code | Name                  | When to Use                                    |
|------|-----------------------|------------------------------------------------|
| 500  | Internal Server Error | Unexpected server-side error                   |
| 502  | Bad Gateway           | Upstream service returned an invalid response  |
| 503  | Service Unavailable   | Server temporarily unavailable (maintenance)   |

```javascript
// Decision tree for common cases
function respondToCreate(res, data, error) {
  if (!error)           return res.status(201).json({ success: true, data });
  if (error.isDuplicate) return res.status(409).json({ success: false, error: 'Already exists' });
  if (error.isValidation) return res.status(422).json({ success: false, errors: error.details });
                          return res.status(500).json({ success: false, error: 'Server error' });
}
```

---

## API Versioning

Versioning allows you to evolve your API without breaking existing clients.

### Strategy 1: URL Path Versioning (Most Common)

```
/api/v1/users
/api/v2/users
```

```javascript
// server.js
const v1Router = require('./routes/v1');
const v2Router = require('./routes/v2');

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);
```

```
routes/
├── v1/
│   ├── index.js
│   └── users.js
└── v2/
    ├── index.js
    └── users.js
```

### Strategy 2: Header Versioning

```javascript
function versionMiddleware(req, res, next) {
  const version = req.headers['api-version'] || '1';
  req.apiVersion = parseInt(version, 10);
  next();
}

app.use(versionMiddleware);

app.get('/users', (req, res) => {
  if (req.apiVersion >= 2) {
    return res.json({ data: [], links: {} }); // v2 shape
  }
  res.json([]); // v1 shape
});
```

### Strategy 3: Query String Versioning

```
GET /users?version=2
```

```javascript
app.get('/users', (req, res) => {
  const version = Number(req.query.version) || 1;
  // handle per version
});
```

### Deprecation Headers

Signal clients that a version will be removed:

```javascript
router.use((req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
  res.set('Link', '</api/v2/users>; rel="successor-version"');
  next();
});
```

### Version Lifecycle

```
v1 ──────────────────────────────────── deprecated ── sunset
v2 ─────────────────────────────────────────────────────────
v3                        ── released ──────────────────────
     │                    │             │
  launch               announce      v1 removed
  v2 beta              v3 stable
```

---

## FAQ

**Q: Should I use PUT or PATCH for updates?**
Use PUT when replacing the entire resource (client sends all fields). Use PATCH when partially updating (client sends only changed fields). PATCH is more common in practice.

**Q: How do I handle pagination for large datasets?**
Prefer cursor-based pagination for large or frequently updated datasets:
```javascript
// Offset pagination (simple, but slow on large tables)
GET /users?page=5&limit=20

// Cursor pagination (efficient, consistent)
GET /users?cursor=eyJpZCI6MTAwfQ&limit=20
// Response includes: { data: [...], nextCursor: "eyJpZCI6MTIwfQ" }
```

**Q: What is the difference between 400 and 422?**
Use 400 for malformed syntax (e.g., invalid JSON). Use 422 for structurally valid but semantically invalid data (e.g., `"age": "not-a-number"` when age must be an integer).

**Q: Should I return the deleted resource in a DELETE response?**
Typically no. Return 204 No Content with an empty body. Some APIs return 200 with the deleted object to confirm what was deleted — both are acceptable.

**Q: How do I document my REST API?**
Use OpenAPI (formerly Swagger). The `swagger-jsdoc` and `swagger-ui-express` packages let you generate interactive docs from JSDoc comments in your Express route files.

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
