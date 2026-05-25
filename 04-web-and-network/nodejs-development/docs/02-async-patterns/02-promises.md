# Promises in Node.js

Promises provide a cleaner, more composable way to handle asynchronous operations compared to callbacks. They were standardized in ES2015 and are natively supported in all modern Node.js versions.

---

## Table of Contents

1. [What is a Promise](#1-what-is-a-promise)
2. [Three States of a Promise](#2-three-states-of-a-promise)
3. [`.then()` and `.catch()` Chaining](#3-then-and-catch-chaining)
4. [`Promise.all()` / `Promise.race()` / `Promise.allSettled()`](#4-promiseall--promiserace--promiseallsettled)
5. [Error Handling](#5-error-handling)
6. [Anti-patterns](#6-anti-patterns)
7. [FAQ](#7-faq)

---

## 1. What is a Promise

A **Promise** is an object representing the eventual completion or failure of an asynchronous operation. It solves the two core problems of callback-based code:

- **Callback hell** — sequential async steps can now be chained with `.then()` instead of nested
- **Inconsistent error handling** — a single `.catch()` at the end of a chain handles all errors

```js
// Callback style
readFile("config.json", (err, data) => {
  if (err) return handleError(err);
  processData(data, (err, result) => {
    if (err) return handleError(err);
    saveResult(result, (err) => {
      if (err) return handleError(err);
      console.log("Done");
    });
  });
});

// Promise style — same logic, linear flow
readFile("config.json")
  .then((data) => processData(data))
  .then((result) => saveResult(result))
  .then(() => console.log("Done"))
  .catch((err) => handleError(err));
```

### Creating a Promise

Use `new Promise(executor)` where the executor receives `resolve` and `reject` functions.

```js
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fetchUser(id) {
  return new Promise((resolve, reject) => {
    if (id <= 0) {
      return reject(new Error("Invalid ID"));
    }
    setTimeout(() => {
      resolve({ id, name: "Alice" });
    }, 100);
  });
}

fetchUser(1).then((user) => console.log(user.name)); // Alice
```

### Promisifying Callbacks with `util.promisify`

Node.js provides a built-in utility to convert error-first callback functions into Promise-returning functions.

```js
const fs = require("fs");
const { promisify } = require("util");

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

readFile("./data.txt", "utf8")
  .then((content) => {
    console.log(content);
    return writeFile("./copy.txt", content, "utf8");
  })
  .then(() => console.log("Copy written"))
  .catch((err) => console.error(err));
```

---

## 2. Three States of a Promise

A Promise is always in one of three mutually exclusive states:

```
            ┌─────────────────────────────┐
            │         PENDING             │
            │  (initial state — waiting)  │
            └──────────┬──────────────────┘
                       │
          ┌────────────┴────────────┐
          │ resolve(value)          │ reject(reason)
          ▼                         ▼
  ┌──────────────┐         ┌──────────────────┐
  │  FULFILLED   │         │    REJECTED       │
  │ (succeeded)  │         │ (failed)          │
  └──────────────┘         └──────────────────┘
```

- **Pending**: the async operation has not completed yet
- **Fulfilled**: the operation completed successfully; `resolve(value)` was called
- **Rejected**: the operation failed; `reject(reason)` was called

Once a Promise settles (transitions from pending to either fulfilled or rejected), its state is **immutable**. Calling `resolve` or `reject` a second time has no effect.

```js
const p = new Promise((resolve, reject) => {
  resolve("first");
  resolve("second"); // ignored — already settled
  reject(new Error("too late")); // also ignored
});

p.then((val) => console.log(val)); // "first"
```

---

## 3. `.then()` and `.catch()` Chaining

### `.then(onFulfilled, onRejected)`

`.then()` accepts up to two callbacks: one for success and one for failure.

```js
fetchUser(1)
  .then(
    (user) => console.log("Success:", user.name),
    (err) => console.error("Error:", err.message)
  );
```

In practice, separating success and error handlers into `.then()` and `.catch()` is cleaner:

```js
fetchUser(1)
  .then((user) => console.log("Success:", user.name))
  .catch((err) => console.error("Error:", err.message));
```

### Chaining `.then()`

Each `.then()` returns a **new Promise**, enabling linear chaining of sequential async steps.

```js
const { promisify } = require("util");
const fs = require("fs");
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

readFile("./input.txt", "utf8")
  .then((content) => {
    const transformed = content.toUpperCase();
    return writeFile("./output.txt", transformed, "utf8");
  })
  .then(() => {
    console.log("Transformation complete");
    return readFile("./output.txt", "utf8");
  })
  .then((result) => {
    console.log("Verified output:", result.slice(0, 50));
  })
  .catch((err) => {
    console.error("Pipeline failed:", err.message);
  });
```

### Passing Values Through the Chain

Whatever a `.then()` callback returns becomes the resolved value of the next `.then()`.

```js
Promise.resolve(1)
  .then((n) => n + 1)   // returns 2
  .then((n) => n * 3)   // returns 6
  .then((n) => console.log(n)); // 6
```

### `.finally()`

`.finally()` runs regardless of success or failure — useful for cleanup operations.

```js
let connection;

openConnection()
  .then((conn) => {
    connection = conn;
    return conn.query("SELECT * FROM users");
  })
  .then((rows) => console.log(rows))
  .catch((err) => console.error(err))
  .finally(() => {
    if (connection) connection.close();
  });
```

---

## 4. `Promise.all()` / `Promise.race()` / `Promise.allSettled()`

### `Promise.all(iterable)`

Runs multiple Promises **in parallel** and resolves when **all** of them fulfill. Rejects immediately if **any** one rejects.

```js
const fetchPost = (id) =>
  fetch(`https://jsonplaceholder.typicode.com/posts/${id}`).then((r) =>
    r.json()
  );

Promise.all([fetchPost(1), fetchPost(2), fetchPost(3)])
  .then(([post1, post2, post3]) => {
    console.log(post1.title);
    console.log(post2.title);
    console.log(post3.title);
  })
  .catch((err) => {
    // fires if ANY request fails
    console.error("One or more requests failed:", err.message);
  });
```

```
Timing:
  Sequential:  [---1---][---2---][---3---]  ~300ms
  Parallel:    [---1---]
               [---2---]                    ~100ms (all run at once)
               [---3---]
```

### `Promise.race(iterable)`

Resolves or rejects with the **first** Promise that settles, ignoring all others.

```js
function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
}

function fetchWithTimeout(url, ms) {
  return Promise.race([fetch(url).then((r) => r.json()), timeout(ms)]);
}

fetchWithTimeout("https://api.example.com/data", 3000)
  .then((data) => console.log(data))
  .catch((err) => console.error(err.message));
```

### `Promise.allSettled(iterable)`

Waits for **all** Promises to settle (fulfill or reject), and returns an array of result objects. Never rejects.

```js
const requests = [
  fetch("https://api.example.com/users").then((r) => r.json()),
  fetch("https://api.example.com/posts").then((r) => r.json()),
  fetch("https://api.invalid.com/data").then((r) => r.json()), // will fail
];

Promise.allSettled(requests).then((results) => {
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      console.log(`Request ${index + 1} succeeded:`, result.value);
    } else {
      console.log(`Request ${index + 1} failed:`, result.reason.message);
    }
  });
});
```

### `Promise.any(iterable)` (ES2021)

Resolves with the **first fulfilled** Promise. Rejects only if **all** Promises reject.

```js
// Try multiple mirrors and use whichever responds first
Promise.any([
  fetch("https://mirror1.example.com/file"),
  fetch("https://mirror2.example.com/file"),
  fetch("https://mirror3.example.com/file"),
])
  .then((response) => response.blob())
  .then((blob) => console.log("Downloaded from fastest mirror"))
  .catch((err) => console.error("All mirrors failed"));
```

### Comparison Table

| Method              | Resolves when         | Rejects when         |
|---------------------|-----------------------|----------------------|
| `Promise.all`       | All fulfill           | Any one rejects      |
| `Promise.race`      | First settles         | First settles (fail) |
| `Promise.allSettled`| All settle            | Never                |
| `Promise.any`       | First fulfills        | All reject           |

---

## 5. Error Handling

### Single `.catch()` for the Entire Chain

```js
readConfig()
  .then((config) => validateConfig(config))
  .then((config) => connectDB(config.dbUrl))
  .then((db) => db.query("SELECT 1"))
  .then((result) => console.log("DB OK:", result))
  .catch((err) => {
    // catches errors from any step above
    console.error("Pipeline error:", err.message);
  });
```

### Recovering from Errors Mid-Chain

A `.catch()` in the middle of a chain can handle the error and return a fallback value, allowing the chain to continue.

```js
fetchUserFromAPI(userId)
  .catch((err) => {
    console.warn("API unavailable, falling back to cache:", err.message);
    return fetchUserFromCache(userId); // recovery — chain continues
  })
  .then((user) => {
    console.log("Got user:", user.name);
  })
  .catch((err) => {
    console.error("Both API and cache failed:", err.message);
  });
```

### Re-throwing Errors

```js
fetchData()
  .catch((err) => {
    if (err.code === "ENOENT") {
      return defaultData; // handle and recover
    }
    throw err; // re-throw unknown errors
  })
  .then((data) => process(data))
  .catch((err) => console.error("Unhandled:", err.message));
```

### Unhandled Promise Rejections

Node.js emits an `unhandledRejection` event when a rejected Promise has no `.catch()`. In recent Node.js versions (v15+), this crashes the process.

```js
// Always attach .catch() or use async/await with try/catch
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});
```

---

## 6. Anti-patterns

### 6.1 The Promise Constructor Anti-pattern (Deferred)

```js
// WRONG: wrapping an existing Promise in a new Promise
function getUser(id) {
  return new Promise((resolve, reject) => {
    fetchUser(id) // fetchUser already returns a Promise
      .then((user) => resolve(user))
      .catch((err) => reject(err));
  });
}

// CORRECT: return the Promise directly
function getUser(id) {
  return fetchUser(id);
}
```

### 6.2 Forgetting to Return a Promise in `.then()`

```js
// WRONG: the chain does not wait for saveUser to complete
fetchUser(1)
  .then((user) => {
    saveUser(user); // missing return — fire and forget
  })
  .then(() => console.log("Saved")); // runs before saveUser finishes

// CORRECT: return the inner Promise
fetchUser(1)
  .then((user) => {
    return saveUser(user); // chain waits for this
  })
  .then(() => console.log("Saved"));
```

### 6.3 Swallowing Errors with Empty `.catch()`

```js
// WRONG: errors are silently ignored
doSomething()
  .catch(() => {}); // black hole — errors vanish

// CORRECT: at minimum, log the error
doSomething()
  .catch((err) => console.error("doSomething failed:", err));
```

### 6.4 Mixing Callbacks and Promises

```js
// WRONG: unpredictable — callback fires, then .then() also fires
function mixedBad(callback) {
  return fetchData().then((data) => {
    callback(null, data);
    return data; // .then() also runs
  });
}

// CORRECT: pick one style and stick to it
function promiseBased() {
  return fetchData();
}
```

---

## 7. FAQ

**Q: What is the difference between `.then(null, onRejected)` and `.catch(onRejected)`?**

A: They are functionally equivalent — `.catch(fn)` is syntactic shorthand for `.then(undefined, fn)`. Prefer `.catch()` for clarity.

---

**Q: Can I `await` a non-Promise value?**

A: Yes. `await someValue` wraps any non-thenable value in `Promise.resolve()`, so it resolves immediately. This is useful but rarely necessary.

---

**Q: Does `Promise.all` run requests in parallel?**

A: The Promises passed to `Promise.all` are already executing (they start when created). `Promise.all` merely waits for all of them to settle. The parallelism is determined by when you create the Promises, not by `Promise.all` itself.

---

**Q: How do I cancel a Promise?**

A: Native Promises cannot be cancelled. Common workarounds include `AbortController` (for `fetch` and some Node.js APIs) and `Promise.race` with a timeout or a manually-rejected Promise.

```js
const controller = new AbortController();

fetch("https://api.example.com/data", { signal: controller.signal })
  .then((r) => r.json())
  .then(console.log)
  .catch((err) => {
    if (err.name === "AbortError") {
      console.log("Request cancelled");
    }
  });

// Cancel after 2 seconds
setTimeout(() => controller.abort(), 2000);
```

---

**Q: When should I use `Promise.allSettled` vs `Promise.all`?**

A: Use `Promise.allSettled` when you need to process the results of all operations regardless of individual failures (e.g., batch API calls where partial success is acceptable). Use `Promise.all` when all operations must succeed for the workflow to continue.

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
