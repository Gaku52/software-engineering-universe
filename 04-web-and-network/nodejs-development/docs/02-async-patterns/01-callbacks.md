# Callbacks in Node.js

Callbacks are the foundation of asynchronous programming in Node.js. Understanding them is essential before moving to Promises and async/await.

---

## Table of Contents

1. [What is a Callback](#1-what-is-a-callback)
2. [Basic Callback Patterns](#2-basic-callback-patterns)
3. [Callback Hell](#3-callback-hell)
4. [Problems with Callback Hell](#4-problems-with-callback-hell)
5. [Anti-patterns](#5-anti-patterns)
6. [FAQ](#6-faq)

---

## 1. What is a Callback

A **callback** is a function passed as an argument to another function, which is then invoked once the operation completes. In Node.js, callbacks are the primary mechanism for handling asynchronous I/O operations.

```js
// Basic callback concept
function greet(name, callback) {
  const message = `Hello, ${name}!`;
  callback(message);
}

greet("Alice", (msg) => {
  console.log(msg); // Hello, Alice!
});
```

Node.js adopts the **error-first callback convention** (also called "Node-style callbacks" or "errbacks"). The first argument is always an error object (or `null` if no error), and the second argument is the result.

```js
// Error-first callback convention
function readData(id, callback) {
  if (id <= 0) {
    return callback(new Error("ID must be positive"));
  }
  // simulate async work
  setTimeout(() => {
    callback(null, { id, value: "data" });
  }, 100);
}

readData(1, (err, data) => {
  if (err) {
    console.error("Error:", err.message);
    return;
  }
  console.log("Data:", data);
});
```

**Why error-first?**
- Enforces consistent error handling across all async APIs
- Node.js core modules (`fs`, `net`, `http`) all follow this convention
- Makes it obvious to callers that they must handle errors

---

## 2. Basic Callback Patterns

### 2.1 File System Operations

The most common real-world callback usage in Node.js is `fs` module operations.

```js
const fs = require("fs");

// Reading a file asynchronously
fs.readFile("./data.txt", "utf8", (err, content) => {
  if (err) {
    console.error("Failed to read file:", err.message);
    return;
  }
  console.log("File content:", content);
});

console.log("This runs before file content is logged");
```

```
Output:
  This runs before file content is logged
  File content: (file contents here)
```

### 2.2 Writing Files

```js
const fs = require("fs");

const data = JSON.stringify({ name: "Alice", age: 30 }, null, 2);

fs.writeFile("./output.json", data, "utf8", (err) => {
  if (err) {
    console.error("Write failed:", err.message);
    return;
  }
  console.log("File written successfully");
});
```

### 2.3 HTTP Request with Callbacks

```js
const https = require("https");

function fetchData(url, callback) {
  https
    .get(url, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          callback(null, parsed);
        } catch (parseErr) {
          callback(parseErr);
        }
      });
    })
    .on("error", (err) => {
      callback(err);
    });
}

fetchData("https://jsonplaceholder.typicode.com/todos/1", (err, data) => {
  if (err) {
    console.error("Fetch error:", err.message);
    return;
  }
  console.log("Fetched:", data);
});
```

### 2.4 Database Query Simulation

```js
// Simulating an async database query
function queryUser(userId, callback) {
  // Simulate network latency
  setTimeout(() => {
    const users = {
      1: { id: 1, name: "Alice", role: "admin" },
      2: { id: 2, name: "Bob", role: "user" },
    };

    const user = users[userId];
    if (!user) {
      return callback(new Error(`User ${userId} not found`));
    }
    callback(null, user);
  }, 50);
}

queryUser(1, (err, user) => {
  if (err) {
    console.error(err.message);
    return;
  }
  console.log("Found user:", user.name); // Found user: Alice
});
```

---

## 3. Callback Hell

**Callback hell** (also called the "pyramid of doom") occurs when multiple async operations depend on each other and each must be nested inside the previous callback.

### 3.1 A Real-World Scenario

Imagine a workflow: read a config file → query a database → fetch additional data from an API → write the combined result to a file.

```js
const fs = require("fs");

fs.readFile("./config.json", "utf8", (err, configData) => {
  if (err) {
    console.error("Config read error:", err.message);
    return;
  }

  const config = JSON.parse(configData);

  queryUser(config.userId, (err, user) => {
    if (err) {
      console.error("User query error:", err.message);
      return;
    }

    fetchUserPosts(user.id, (err, posts) => {
      if (err) {
        console.error("Posts fetch error:", err.message);
        return;
      }

      const report = JSON.stringify({ user, posts }, null, 2);

      fs.writeFile("./report.json", report, "utf8", (err) => {
        if (err) {
          console.error("Write error:", err.message);
          return;
        }

        console.log("Report written successfully");

        notifyAdmin(user.name, (err) => {
          if (err) {
            console.error("Notification error:", err.message);
            return;
          }
          console.log("Admin notified");
        });
      });
    });
  });
});
```

The indentation visualizes the problem:

```
readFile(
  queryUser(
    fetchUserPosts(
      writeFile(
        notifyAdmin(
          // callback hell
        )
      )
    )
  )
)
```

---

## 4. Problems with Callback Hell

### 4.1 Readability

Code grows horizontally instead of vertically. Deep nesting makes it hard to follow the logical flow at a glance.

### 4.2 Error Handling Duplication

Every nested callback must handle its own error, leading to repetitive `if (err) { return; }` blocks scattered throughout.

```js
// Error handling repeated at every level
step1((err, result1) => {
  if (err) return handleError(err); // repeated
  step2(result1, (err, result2) => {
    if (err) return handleError(err); // repeated
    step3(result2, (err, result3) => {
      if (err) return handleError(err); // repeated
      // ...
    });
  });
});
```

### 4.3 Difficult Refactoring

Adding a new step in the middle requires restructuring the entire nesting hierarchy.

### 4.4 No Return Values

Callbacks cannot use `return` to propagate values up the call stack. All data must be threaded through callback arguments.

### 4.5 Partial Mitigation: Named Functions

One way to reduce visual nesting is to extract callbacks into named functions:

```js
const fs = require("fs");

function onAdminNotified(err) {
  if (err) {
    console.error("Notification error:", err.message);
    return;
  }
  console.log("Admin notified");
}

function onReportWritten(err, user) {
  // note: user must be closed over or passed differently
  if (err) {
    console.error("Write error:", err.message);
    return;
  }
  notifyAdmin(user.name, onAdminNotified);
}

// This approach helps with indentation but still has sequential dependencies
```

Named functions reduce nesting visually but do not solve the fundamental issues of error propagation or composability.

---

## 5. Anti-patterns

### 5.1 Forgetting to Return After Callback

```js
// WRONG: callback is called twice if there is no return
function badFunction(input, callback) {
  if (!input) {
    callback(new Error("No input")); // execution continues!
  }
  callback(null, processInput(input)); // called again → bug
}

// CORRECT: always return after calling back with an error
function goodFunction(input, callback) {
  if (!input) {
    return callback(new Error("No input")); // stops here
  }
  callback(null, processInput(input));
}
```

### 5.2 Throwing Instead of Passing Errors

```js
// WRONG: throwing inside an async callback crashes the process
fs.readFile("file.txt", "utf8", (err, data) => {
  if (err) throw err; // unhandled exception in async context
});

// CORRECT: pass errors through the callback
function readAndProcess(path, callback) {
  fs.readFile(path, "utf8", (err, data) => {
    if (err) return callback(err);
    callback(null, data.toUpperCase());
  });
}
```

### 5.3 Synchronous Code Inside Async Wrappers

```js
// WRONG: using sync fs inside what should be async
function getConfig(callback) {
  try {
    const data = fs.readFileSync("config.json"); // blocks the event loop
    callback(null, JSON.parse(data));
  } catch (err) {
    callback(err);
  }
}

// CORRECT: use the async version
function getConfig(callback) {
  fs.readFile("config.json", "utf8", (err, data) => {
    if (err) return callback(err);
    try {
      callback(null, JSON.parse(data));
    } catch (parseErr) {
      callback(parseErr);
    }
  });
}
```

### 5.4 Mixing Sync and Async Returns

```js
// WRONG: sometimes async, sometimes sync — unpredictable behavior
function getData(useCache, callback) {
  if (useCache) {
    callback(null, cachedData); // sync call — fires before current tick ends
  } else {
    fetchFromDB(callback); // async call
  }
}

// CORRECT: always async using process.nextTick
function getData(useCache, callback) {
  if (useCache) {
    return process.nextTick(() => callback(null, cachedData));
  }
  fetchFromDB(callback);
}
```

---

## 6. FAQ

**Q: Is the error-first callback convention mandatory?**

A: It is not enforced by the language, but it is a de-facto standard in the Node.js ecosystem. Breaking this convention makes your API harder to integrate with utilities like `util.promisify`.

---

**Q: Can I use `util.promisify` to convert callback-based functions to Promises?**

A: Yes, as long as the function follows the error-first callback convention.

```js
const fs = require("fs");
const { promisify } = require("util");

const readFile = promisify(fs.readFile);

readFile("./data.txt", "utf8")
  .then((content) => console.log(content))
  .catch((err) => console.error(err));
```

---

**Q: Should I still learn callbacks if I always use async/await?**

A: Yes. Many Node.js core modules and third-party libraries still expose callback-based APIs. Knowing callbacks lets you understand what async/await compiles down to and helps you debug event-loop issues.

---

**Q: What is `process.nextTick` and when should I use it?**

A: `process.nextTick` schedules a callback to run at the end of the current operation, before the event loop continues to the next phase. Use it to ensure callbacks always fire asynchronously even when the result is available synchronously.

```js
function alwaysAsync(value, callback) {
  process.nextTick(() => callback(null, value));
}
```

---

**Q: How many levels of nesting are acceptable before refactoring?**

A: As a guideline, more than 2–3 levels of callback nesting is a signal to refactor. Use Promises or async/await for any workflow with more than two sequential async steps.

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
