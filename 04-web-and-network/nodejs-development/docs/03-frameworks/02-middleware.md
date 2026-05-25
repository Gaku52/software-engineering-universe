# Middleware in Express — Complete Guide

## Table of Contents

1. [What is Middleware?](#what-is-middleware)
2. [Built-in Middleware](#built-in-middleware)
3. [Third-party Middleware](#third-party-middleware)
4. [Writing Custom Middleware](#writing-custom-middleware)
5. [Middleware Execution Order](#middleware-execution-order)
6. [Error Handling Middleware](#error-handling-middleware)
7. [FAQ](#faq)

---

## What is Middleware?

Middleware functions are functions that have access to the request object (`req`), the response object (`res`), and the `next` function in the application's request-response cycle.

```
HTTP Request
     │
     ▼
┌────────────┐
│ Middleware │  → can read/modify req and res
│     1      │  → can end the cycle (res.send)
└─────┬──────┘  → or pass control (next())
      │ next()
      ▼
┌────────────┐
│ Middleware │
│     2      │
└─────┬──────┘
      │ next()
      ▼
┌────────────┐
│   Route    │
│  Handler   │  → sends final response
└────────────┘
     │
     ▼
HTTP Response
```

### What Middleware Can Do

- Execute any code
- Make changes to the request and response objects
- End the request-response cycle
- Call the next middleware in the stack

### Middleware Signature

```javascript
// Regular middleware
function myMiddleware(req, res, next) {
  // do something
  next(); // pass control to the next middleware
}

// Error-handling middleware (4 arguments — Express detects this)
function errorMiddleware(err, req, res, next) {
  res.status(500).json({ error: err.message });
}
```

---

## Built-in Middleware

Express ships with several built-in middleware functions since version 4.16.

### `express.json()`

Parses incoming requests with JSON payloads (replaces the old `body-parser` package).

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/data', (req, res) => {
  console.log(req.body); // parsed JSON object
  res.json({ received: req.body });
});
```

Options:

```javascript
app.use(express.json({
  limit: '10kb',    // maximum request body size
  strict: true,     // only accept arrays and objects
}));
```

### `express.urlencoded()`

Parses requests with URL-encoded payloads (HTML form submissions).

```javascript
app.use(express.urlencoded({ extended: true }));

app.post('/form', (req, res) => {
  console.log(req.body); // { username: 'alice', password: '...' }
  res.redirect('/dashboard');
});
```

`extended: true` uses the `qs` library (supports nested objects). `extended: false` uses the built-in `querystring` module.

### `express.static()`

Serves static assets from a directory.

```javascript
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

### `express.raw()` and `express.text()`

```javascript
// Parse body as a Buffer (binary data)
app.use(express.raw({ type: 'application/octet-stream' }));

// Parse body as a plain string
app.use(express.text({ type: 'text/plain' }));
```

---

## Third-party Middleware

### morgan — HTTP Request Logger

```bash
npm install morgan
```

```javascript
const morgan = require('morgan');

// Predefined formats: combined, common, dev, short, tiny
app.use(morgan('dev'));
// GET /users 200 12.345 ms - 42

// Combined format (standard Apache-style logging)
app.use(morgan('combined'));

// Custom format
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Log only errors (4xx and 5xx) in production
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
  }));
}
```

### cors — Cross-Origin Resource Sharing

```bash
npm install cors
```

```javascript
const cors = require('cors');

// Allow all origins (development only)
app.use(cors());

// Restrict to specific origins
app.use(cors({
  origin: ['https://myapp.com', 'https://staging.myapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // allow cookies and auth headers
}));

// Per-route CORS
app.get('/public-data', cors(), (req, res) => {
  res.json({ data: 'publicly accessible' });
});
```

### helmet — Security HTTP Headers

```bash
npm install helmet
```

```javascript
const helmet = require('helmet');

// Apply all default security headers
app.use(helmet());

// Customize individual headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'cdn.jsdelivr.net'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));
```

Helmet sets headers like:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `Content-Security-Policy`

### express-rate-limit — Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // limit each IP to 100 requests per window
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api', limiter);

// Stricter limit for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many login attempts.' },
});
app.use('/api/auth', authLimiter);
```

### compression — Gzip Compression

```bash
npm install compression
```

```javascript
const compression = require('compression');

app.use(compression({
  threshold: 1024, // only compress responses larger than 1 KB
  level: 6,        // compression level (1-9)
}));
```

---

## Writing Custom Middleware

### Logging Middleware

```javascript
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });

  next();
}

app.use(requestLogger);
```

### Authentication Middleware

```javascript
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user to request
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Apply to specific routes
app.get('/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Apply to all routes under /api
app.use('/api', authenticate);
```

### Role-based Authorization

```javascript
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

app.delete('/admin/users/:id', authenticate, authorize('admin'), (req, res) => {
  res.status(204).send();
});
```

### Request Validation Middleware

```javascript
function validateUserBody(req, res, next) {
  const { name, email } = req.body;

  const errors = [];
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('valid email is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  req.body.name = name.trim();
  next();
}

app.post('/users', express.json(), validateUserBody, (req, res) => {
  res.status(201).json(req.body);
});
```

---

## Middleware Execution Order

Order matters. Express executes middleware in the order it is registered.

```javascript
const express = require('express');
const app = express();

// 1. Applied to ALL routes — register first
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// 2. Route-specific middleware — register before route handlers
app.use('/api', authenticate);

// 3. Route handlers
app.get('/api/users', (req, res) => res.json({ users: [] }));
app.post('/api/users', validateUserBody, (req, res) => res.status(201).json(req.body));

// 4. 404 handler — after all routes
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// 5. Error handler — always last, always 4 arguments
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message });
});
```

```
Request arrives
      │
      ▼
 helmet()          ← security headers
      │
      ▼
 morgan()          ← logging
      │
      ▼
 express.json()    ← body parsing
      │
      ▼
 authenticate()    ← only for /api/* routes
      │
      ▼
 Route Handler     ← business logic
      │
      ▼ (if next(err) called)
 Error Handler     ← 4-argument middleware
```

### Calling `next()` Variants

```javascript
function middleware(req, res, next) {
  next();           // proceed to next middleware
  next('route');    // skip remaining handlers for this route
  next(new Error('Something went wrong')); // pass error to error handler
}
```

---

## Error Handling Middleware

Error-handling middleware has **exactly four parameters**: `(err, req, res, next)`.

### Basic Error Handler

```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});
```

### Custom Error Class

```javascript
class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

// In a route handler
app.get('/items/:id', (req, res, next) => {
  const item = findItem(req.params.id);
  if (!item) {
    return next(new AppError('Item not found', 404));
  }
  res.json(item);
});

// In error handler — distinguish custom vs unexpected errors
app.use((err, req, res, next) => {
  if (err.name === 'AppError') {
    return res.status(err.status).json({ error: err.message });
  }

  // Unexpected error — hide details in production
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### Async Error Propagation (Express 5)

```javascript
// Express 5: async errors are automatically passed to next(err)
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id); // throws → caught automatically
  res.json(user);
});
```

### Async Error Propagation (Express 4)

```javascript
// Express 4: wrap async handlers manually
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.json(user);
}));
```

---

## FAQ

**Q: What happens if I forget to call `next()`?**
The request will hang indefinitely. The client will wait for a response that never comes. Always either call `next()`, `next(err)`, or send a response (`res.send`, `res.json`, etc.).

**Q: Can middleware be applied to a specific HTTP method?**
Yes. Use `app.METHOD(path, middleware, handler)` or mount it on a router that only handles that method.

**Q: How do I share data between middleware functions?**
Attach properties to `req`. For example: `req.user = decoded` in auth middleware, then access `req.user` in the next handler. Do not mutate `res.locals` unless you are using template rendering.

**Q: Is the order of `app.use` and route handlers important?**
Yes. Middleware registered before a route affects that route. Middleware registered after does not. The 404 handler must come after all routes, and the error handler must come last.

**Q: How do I skip middleware for certain routes?**
Use conditional logic inside the middleware:
```javascript
function skipForPublic(req, res, next) {
  if (req.path.startsWith('/public')) return next();
  authenticate(req, res, next);
}
```
Or mount route-specific middleware instead of global middleware.

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
