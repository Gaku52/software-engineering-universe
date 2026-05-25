# Error Handling in Node.js and Express — Complete Guide

## Table of Contents

1. [Error Types in Node.js](#error-types-in-nodejs)
2. [Synchronous vs Asynchronous Error Handling](#synchronous-vs-asynchronous-error-handling)
3. [Global Error Handling Middleware](#global-error-handling-middleware)
4. [Operational vs Programmer Errors](#operational-vs-programmer-errors)
5. [Logging Errors](#logging-errors)
6. [Best Practices](#best-practices)
7. [FAQ](#faq)

---

## Error Types in Node.js

Node.js distinguishes several categories of errors. Understanding them is the first step to handling them correctly.

```
Error (base class)
├── SyntaxError         — invalid JavaScript syntax
├── ReferenceError      — accessing undefined variable
├── TypeError           — wrong type for an operation
├── RangeError          — value out of allowed range
├── URIError            — malformed URI functions
├── EvalError           — issues with eval()
└── SystemError         — OS-level errors (ENOENT, ECONNREFUSED …)
```

### Built-in Error Properties

```javascript
try {
  null.property; // TypeError
} catch (err) {
  console.log(err.name);    // "TypeError"
  console.log(err.message); // "Cannot read properties of null"
  console.log(err.stack);   // full stack trace string
}
```

### System (OS) Errors

```javascript
const fs = require('fs');

fs.readFile('/nonexistent', (err, data) => {
  if (err) {
    console.log(err.code);    // "ENOENT"
    console.log(err.errno);   // -2
    console.log(err.syscall); // "open"
    console.log(err.path);    // "/nonexistent"
  }
});
```

Common system error codes:

| Code            | Meaning                            |
|-----------------|------------------------------------|
| ENOENT          | No such file or directory          |
| EACCES          | Permission denied                  |
| ECONNREFUSED    | Connection refused                 |
| ECONNRESET      | Connection reset by peer           |
| ETIMEDOUT       | Connection or operation timed out  |
| EADDRINUSE      | Address already in use             |

### Custom Error Class

```javascript
class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isOperational = true; // mark as expected error

    // Maintains proper prototype chain
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}
```

---

## Synchronous vs Asynchronous Error Handling

### Synchronous Errors

```javascript
// throw — caught by try/catch
function divide(a, b) {
  if (b === 0) throw new AppError('Division by zero', 400, 'BAD_INPUT');
  return a / b;
}

try {
  const result = divide(10, 0);
} catch (err) {
  console.error(err.message); // "Division by zero"
}

// In Express: synchronous throws are automatically caught
app.get('/sync', (req, res) => {
  throw new NotFoundError('Item'); // Express catches this
});
```

### Asynchronous Errors — Callbacks

```javascript
const fs = require('fs');

// Old style: error-first callback (err, data)
fs.readFile('./config.json', 'utf8', (err, data) => {
  if (err) {
    // Handle error — do NOT throw here
    console.error('Failed to read config:', err.message);
    return;
  }
  console.log(data);
});
```

### Asynchronous Errors — Promises

```javascript
// .catch() on rejected promises
fetch('https://api.example.com/data')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error('Fetch failed:', err.message));

// Unhandled promise rejections crash Node.js (v15+)
// Always attach .catch() or use try/await
```

### Asynchronous Errors — async/await

```javascript
async function fetchUser(id) {
  try {
    const response = await fetch(`https://api.example.com/users/${id}`);
    if (!response.ok) {
      throw new AppError(`Upstream API error: ${response.status}`, 502);
    }
    return await response.json();
  } catch (err) {
    // Re-throw to propagate to caller
    throw err;
  }
}

// In Express 4 — wrap async handlers
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await fetchUser(req.params.id);
  res.json({ success: true, data: user });
}));

// In Express 5 — no wrapper needed
app.get('/users/:id', async (req, res) => {
  const user = await fetchUser(req.params.id); // rejection auto-forwarded to next(err)
  res.json({ success: true, data: user });
});
```

### Asynchronous Errors — EventEmitter

```javascript
const { EventEmitter } = require('events');
const emitter = new EventEmitter();

// Always handle 'error' events — unhandled ones crash Node.js
emitter.on('error', (err) => {
  console.error('Emitter error:', err.message);
});

emitter.emit('error', new Error('Something went wrong'));
```

---

## Global Error Handling Middleware

Express provides a dedicated error-handling middleware pattern (4 arguments).

### Basic Structure

```javascript
// server.js — register AFTER all routes

// 404 — route not matched
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler — must have exactly 4 parameters
app.use((err, req, res, next) => {
  handleError(err, req, res);
});
```

### Production-Grade Error Handler

```javascript
// middleware/errorHandler.js
const { AppError, ValidationError } = require('../errors');
const logger = require('../utils/logger');

function handleError(err, req, res, next) {
  // Normalize status
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  let errors = undefined;

  // Handle known third-party error types
  if (err.name === 'JsonWebTokenError') {
    status = 401; message = 'Invalid token'; code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    status = 401; message = 'Token expired'; code = 'TOKEN_EXPIRED';
  } else if (err.name === 'CastError') {
    // Mongoose invalid ObjectId
    status = 400; message = 'Invalid ID format'; code = 'INVALID_ID';
  } else if (err.name === 'ValidationError' && err.errors) {
    // Mongoose validation
    status = 422; code = 'VALIDATION_ERROR';
    errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Log appropriately
  if (status >= 500) {
    logger.error({ err, req: { method: req.method, url: req.url } });
  } else {
    logger.warn({ code, message, url: req.url });
  }

  // Build response
  const body = { success: false, error: { code, message } };
  if (errors) body.error.details = errors;

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = handleError;
```

### Unhandled Exceptions and Rejections

```javascript
// server.js — register BEFORE starting the server

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  // Gracefully close the server then exit
  server.close(() => process.exit(1));
  // Force exit after 10 seconds if close hangs
  setTimeout(() => process.exit(1), 10_000).unref();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection — shutting down');
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 10_000).unref();
});

const server = app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
```

---

## Operational vs Programmer Errors

This distinction determines how you handle and recover from errors.

```
All Errors
├── Operational Errors (expected)
│   ├── Invalid user input (400, 422)
│   ├── Resource not found (404)
│   ├── Authentication failure (401, 403)
│   ├── Network timeout (503)
│   └── Disk full, DB connection lost (503)
│
└── Programmer Errors (bugs)
    ├── Reading property of undefined
    ├── Calling a function with wrong arguments
    ├── Async code without error handling
    └── Logic bugs
```

### Detecting Operational Errors

```javascript
// Mark your custom errors as operational
class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.isOperational = true; // key flag
  }
}

function isOperationalError(err) {
  return err instanceof AppError && err.isOperational;
}
```

### Recovery Strategy

```javascript
// In error handler:
function handleError(err, req, res, next) {
  if (isOperationalError(err)) {
    // Safe to respond and continue running
    return res.status(err.status).json({
      success: false,
      error: err.message,
    });
  }

  // Programmer error — log and restart
  logger.fatal({ err }, 'Programmer error detected');
  process.exit(1); // Let process manager (PM2/Docker) restart the app
}
```

```
Operational Error              Programmer Error
      │                               │
      ▼                               ▼
  Log as warning              Log as fatal
  Send HTTP response          Graceful shutdown
  Continue running            Restart via PM2/k8s
```

---

## Logging Errors

### Using pino (Recommended for Production)

```bash
npm install pino pino-pretty
```

```javascript
// utils/logger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined, // JSON output in production
  redact: ['req.headers.authorization', 'body.password'], // hide secrets
});

module.exports = logger;
```

```javascript
// Usage
logger.info('Server started');
logger.warn({ userId: 42 }, 'Rate limit approached');
logger.error({ err }, 'Database query failed');
logger.fatal({ err }, 'Unrecoverable error');
```

### Using winston

```bash
npm install winston
```

```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'development'
      ? winston.format.prettyPrint()
      : winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = logger;
```

### Log Levels and When to Use Them

```
FATAL  — app must shut down (unhandled exception)
ERROR  — request failed, needs investigation (5xx)
WARN   — unexpected but handled (4xx, rate limit)
INFO   — normal operational events (server start, request)
DEBUG  — detailed diagnostic information
TRACE  — very verbose, rarely used in production
```

### Structured Logging

Log in JSON to make logs searchable in Datadog, CloudWatch, or ELK:

```javascript
// Good — structured and searchable
logger.error({
  err,
  requestId: req.id,
  userId: req.user?.id,
  method: req.method,
  url: req.url,
  duration: Date.now() - req.startTime,
}, 'Request failed');

// Bad — hard to parse
console.log(`ERROR: ${err.message} for user ${req.user?.id} on ${req.url}`);
```

---

## Best Practices

### 1. Always Use Async/Await with Try/Catch or asyncHandler

```javascript
// Never leave unhandled promise rejections
app.get('/bad', async (req, res) => {
  const data = await riskyOperation(); // ❌ No error handling in Express 4
});

// Wrap with asyncHandler in Express 4
app.get('/good', asyncHandler(async (req, res) => {
  const data = await riskyOperation(); // ✅ Errors forwarded to error handler
  res.json(data);
}));
```

### 2. Never Expose Internal Errors to Clients

```javascript
// ❌ Leaks implementation details
res.status(500).json({ error: err.stack });

// ✅ Safe for production
res.status(500).json({ error: 'Internal server error' });

// ✅ Full details in development only
if (process.env.NODE_ENV === 'development') {
  res.status(500).json({ error: err.message, stack: err.stack });
} else {
  res.status(500).json({ error: 'Internal server error' });
}
```

### 3. Validate Input Early

```javascript
// Validate at the boundary — before any business logic
router.post('/users',
  validate(createUserRules), // 422 if invalid
  asyncHandler(createUser)   // business logic
);
```

### 4. Use a Centralized Error Handler

```javascript
// ❌ Error handling scattered across routes
app.get('/a', (req, res) => { try { ... } catch (e) { res.status(500)... } });
app.get('/b', (req, res) => { try { ... } catch (e) { res.status(500)... } });

// ✅ One error handler for all routes
app.get('/a', asyncHandler(handlerA));
app.get('/b', asyncHandler(handlerB));
app.use(centralErrorHandler); // handles everything
```

### 5. Set Timeouts

```javascript
// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30_000, () => {
    const err = new AppError('Request timeout', 408, 'TIMEOUT');
    next(err);
  });
  next();
});

// Upstream fetch with timeout
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new AppError('Upstream timeout', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

### 6. Graceful Shutdown

```javascript
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
    // Close DB connections, flush logs, etc.
    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 30_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker/k8s
process.on('SIGINT',  () => shutdown('SIGINT'));  // Ctrl+C
```

### Summary Checklist

```
✅ asyncHandler wrapping or Express 5 for async routes
✅ Centralized error handler with 4 arguments
✅ Input validation at route entry points
✅ Custom error classes with isOperational flag
✅ Structured logging (JSON) with appropriate log levels
✅ No sensitive data in responses or logs
✅ Unhandled rejection and uncaught exception listeners
✅ Graceful shutdown on SIGTERM/SIGINT
✅ Timeouts on all external calls
✅ Different behavior in development vs production
```

---

## FAQ

**Q: What happens if I throw inside an async middleware in Express 4?**
The error is not automatically caught and becomes an unhandled rejection. Wrap every async middleware with `asyncHandler` or upgrade to Express 5.

**Q: Should I use `next(err)` or `throw err` in route handlers?**
In Express 4 synchronous code, both work. In async functions (without Express 5), only `next(err)` reliably forwards the error. Prefer `next(err)` for clarity and compatibility.

**Q: How do I test error handling?**
Use supertest to make requests that trigger errors and assert the response shape:
```javascript
const request = require('supertest');
const app = require('../server');

test('returns 404 for unknown user', async () => {
  const res = await request(app).get('/api/v1/users/99999');
  expect(res.status).toBe(404);
  expect(res.body.success).toBe(false);
});
```

**Q: Should I exit the process on programmer errors?**
Yes. Programmer errors leave the application in an unknown state. Terminate and let your process manager (PM2, Docker, Kubernetes) restart it in a clean state.

**Q: How do I avoid `console.log` vs a real logger?**
`console.log` lacks log levels, structured fields, and transport options. Install `pino` or `winston` from the start — switching later is painful. At minimum, use `console.error` for errors and `console.info` for informational messages.

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
