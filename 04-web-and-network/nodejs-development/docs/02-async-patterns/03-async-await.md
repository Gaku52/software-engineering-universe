# async/await in Node.js

`async/await` is syntactic sugar over Promises that allows you to write asynchronous code in a synchronous style. It was introduced in ES2017 (Node.js 7.6+) and is now the dominant pattern for async Node.js code.

---

## Table of Contents

1. [What is async/await](#1-what-is-asyncawait)
2. [Basic `async` Function](#2-basic-async-function)
3. [How `await` Works](#3-how-await-works)
4. [Error Handling with try/catch](#4-error-handling-with-trycatch)
5. [Parallel Execution with `Promise.all`](#5-parallel-execution-with-promiseall)
6. [Common Mistakes](#6-common-mistakes)
7. [FAQ](#7-faq)

---

## 1. What is async/await

`async/await` does not introduce new async capabilities — it is a layer on top of Promises. Every `async` function returns a Promise, and `await` pauses execution of that function until the awaited Promise settles.

**The same logic, three styles:**

```js
// 1. Callback style
readFile("config.json", "utf8", (err, data) => {
  if (err) return console.error(err);
  const cfg = JSON.parse(data);
  connectDB(cfg.dbUrl, (err, db) => {
    if (err) return console.error(err);
    console.log("Connected");
  });
});

// 2. Promise chain style
readFile("config.json", "utf8")
  .then((data) => JSON.parse(data))
  .then((cfg) => connectDB(cfg.dbUrl))
  .then(() => console.log("Connected"))
  .catch(console.error);

// 3. async/await style
async function init() {
  const data = await readFile("config.json", "utf8");
  const cfg = JSON.parse(data);
  await connectDB(cfg.dbUrl);
  console.log("Connected");
}

init().catch(console.error);
```

All three are equivalent in behavior. The async/await version reads like synchronous code while remaining non-blocking.

---

## 2. Basic `async` Function

### Declaring an async Function

The `async` keyword can be placed before any function declaration or expression.

```js
// Function declaration
async function fetchUser(id) {
  return { id, name: "Alice" };
}

// Function expression
const fetchPost = async function (id) {
  return { id, title: "Hello" };
};

// Arrow function
const fetchComment = async (id) => {
  return { id, body: "Great post!" };
};

// Class method
class UserService {
  async getUser(id) {
    return { id, name: "Bob" };
  }
}
```

### Return Value

An `async` function **always returns a Promise**, even if you return a plain value.

```js
async function add(a, b) {
  return a + b; // equivalent to: return Promise.resolve(a + b)
}

add(2, 3).then(console.log); // 5
```

### Practical Example: File Operations

```js
const fs = require("fs/promises"); // Node.js 14+ built-in Promise API

async function processConfig(path) {
  const raw = await fs.readFile(path, "utf8");
  const config = JSON.parse(raw);

  config.processedAt = new Date().toISOString();

  const output = JSON.stringify(config, null, 2);
  await fs.writeFile(path.replace(".json", ".out.json"), output, "utf8");

  return config;
}

processConfig("./config.json")
  .then((cfg) => console.log("Processed:", cfg.processedAt))
  .catch((err) => console.error("Failed:", err.message));
```

---

## 3. How `await` Works

### Pausing Execution

`await` suspends the execution of the `async` function at that point and yields control back to the event loop. When the awaited Promise settles, execution resumes.

```js
async function demo() {
  console.log("1 - before await");

  const result = await new Promise((resolve) => {
    setTimeout(() => resolve("done"), 1000);
  });

  console.log("3 - after await:", result); // runs ~1 second later
}

demo();
console.log("2 - this runs while demo() is awaiting");
```

```
Output:
  1 - before await
  2 - this runs while demo() is awaiting
  3 - after await: done
```

### `await` on Non-Promise Values

`await` wraps any non-Promise value in `Promise.resolve()`. This means `await 42` is valid but returns `42` immediately.

```js
async function test() {
  const x = await 42;       // resolves immediately
  const y = await "hello";  // also fine
  console.log(x, y);        // 42 hello
}
```

### `await` Only Works Inside `async`

Attempting to use `await` at the top level of a CommonJS module causes a syntax error. Use an async IIFE or switch to ES modules (which support top-level `await` since Node.js 14.8).

```js
// CommonJS — wrap in async function
(async () => {
  const data = await fetchData();
  console.log(data);
})();

// ES module (.mjs or "type": "module" in package.json) — top-level await OK
const data = await fetchData();
console.log(data);
```

### Under the Hood

`async/await` desugars to generator-based coroutine scheduling over Promises. The following two snippets are equivalent:

```js
// async/await
async function getUser(id) {
  const user = await fetchUser(id);
  return user.name;
}

// Equivalent Promise chain
function getUser(id) {
  return fetchUser(id).then((user) => user.name);
}
```

---

## 4. Error Handling with try/catch

### Basic try/catch

Wrap `await` expressions in try/catch to handle rejected Promises.

```js
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    console.log("User:", user.name);
    return user;
  } catch (err) {
    console.error("Failed to load user:", err.message);
    return null;
  }
}
```

### Handling Multiple Steps

A single try block can cover multiple awaited operations.

```js
const fs = require("fs/promises");

async function buildReport(userId) {
  try {
    const user = await fetchUser(userId);
    const posts = await fetchPosts(userId);
    const report = { user, posts, generatedAt: new Date() };
    await fs.writeFile("./report.json", JSON.stringify(report, null, 2));
    console.log("Report saved");
    return report;
  } catch (err) {
    console.error("Report generation failed:", err.message);
    throw err; // re-throw so the caller knows it failed
  }
}
```

### Granular Error Handling

When different errors require different handling, use separate try/catch blocks.

```js
async function syncData(userId) {
  let user;

  try {
    user = await fetchUser(userId);
  } catch (err) {
    console.error("Could not fetch user:", err.message);
    return; // bail early
  }

  try {
    await syncToRemote(user);
    console.log("Sync complete");
  } catch (err) {
    // sync failure is non-fatal — log and continue
    console.warn("Sync failed, will retry later:", err.message);
    await scheduleRetry(userId);
  }
}
```

### Helper: `to` Pattern (Optional)

Some teams adopt a helper that converts a rejected Promise to `[err, null]` / `[null, data]` to avoid nested try/catch blocks.

```js
async function to(promise) {
  try {
    const data = await promise;
    return [null, data];
  } catch (err) {
    return [err, null];
  }
}

async function getUser(id) {
  const [err, user] = await to(fetchUser(id));
  if (err) {
    console.error("Fetch failed:", err.message);
    return null;
  }
  return user;
}
```

---

## 5. Parallel Execution with `Promise.all`

### The Sequential Trap

A common mistake is awaiting operations one by one when they could run in parallel.

```js
// SLOW: 300ms total (100 + 100 + 100)
async function slowFetch() {
  const user = await fetchUser(1);    // wait 100ms
  const posts = await fetchPosts(1);  // then wait 100ms
  const tags = await fetchTags(1);    // then wait 100ms
  return { user, posts, tags };
}
```

### Running in Parallel with `Promise.all`

```js
// FAST: ~100ms total (all run at the same time)
async function fastFetch() {
  const [user, posts, tags] = await Promise.all([
    fetchUser(1),
    fetchPosts(1),
    fetchTags(1),
  ]);
  return { user, posts, tags };
}
```

```
Sequential:  [fetchUser][fetchPosts][fetchTags]   ~300ms
Parallel:    [fetchUser ]
             [fetchPosts]                          ~100ms
             [fetchTags ]
```

### Combining Sequential and Parallel

Some steps are independent (run in parallel); others depend on earlier results (run sequentially).

```js
async function loadDashboard(userId) {
  // Step 1: fetch user first (required for next steps)
  const user = await fetchUser(userId);

  // Step 2: fetch posts and preferences in parallel (both need userId)
  const [posts, preferences] = await Promise.all([
    fetchPosts(user.id),
    fetchPreferences(user.id),
  ]);

  return { user, posts, preferences };
}
```

### Handling Partial Failures with `Promise.allSettled`

```js
async function loadOptionalData(userId) {
  const results = await Promise.allSettled([
    fetchUser(userId),          // required
    fetchRecommendations(userId), // optional
    fetchAds(userId),           // optional
  ]);

  const [userResult, recsResult, adsResult] = results;

  if (userResult.status === "rejected") {
    throw userResult.reason; // user is required
  }

  return {
    user: userResult.value,
    recommendations: recsResult.status === "fulfilled" ? recsResult.value : [],
    ads: adsResult.status === "fulfilled" ? adsResult.value : [],
  };
}
```

---

## 6. Common Mistakes

### 6.1 Sequential await in a Loop (Unnecessary Serialization)

```js
const userIds = [1, 2, 3, 4, 5];

// WRONG: each fetch waits for the previous to finish
async function slowAll() {
  const users = [];
  for (const id of userIds) {
    const user = await fetchUser(id); // sequential!
    users.push(user);
  }
  return users;
}

// CORRECT: start all fetches, then await all results
async function fastAll() {
  const promises = userIds.map((id) => fetchUser(id));
  return await Promise.all(promises);
}
```

**Exception**: Use sequential await in loops when each iteration depends on the previous result (e.g., paginated API traversal).

### 6.2 Unhandled Rejected Promises from async Functions

```js
// WRONG: async function called without .catch() or try/catch
async function dangerousOperation() {
  await doSomethingRisky(); // may reject
}

dangerousOperation(); // rejection goes unhandled — Node.js may crash

// CORRECT: handle at the call site
dangerousOperation().catch((err) => console.error(err));

// or with try/catch in an async context
async function safeWrapper() {
  try {
    await dangerousOperation();
  } catch (err) {
    console.error(err);
  }
}
```

### 6.3 `await` Inside `forEach` Does Not Work as Expected

```js
const ids = [1, 2, 3];

// WRONG: forEach does not await the async callbacks
async function wrong() {
  ids.forEach(async (id) => {
    const user = await fetchUser(id); // these run but forEach does not wait
    console.log(user.name);
  });
  console.log("Done?"); // prints before users are fetched
}

// CORRECT: use for...of for sequential, or map + Promise.all for parallel
async function correctSequential() {
  for (const id of ids) {
    const user = await fetchUser(id);
    console.log(user.name);
  }
}

async function correctParallel() {
  await Promise.all(ids.map(async (id) => {
    const user = await fetchUser(id);
    console.log(user.name);
  }));
  console.log("All done");
}
```

### 6.4 Ignoring the Return Value of `await`

```js
// WRONG: result is discarded, variable is undefined
async function bad() {
  const user = fetchUser(1); // missing await!
  console.log(user.name);   // TypeError: cannot read property of Promise
}

// CORRECT
async function good() {
  const user = await fetchUser(1);
  console.log(user.name);
}
```

### 6.5 Using `async` When Not Needed

```js
// UNNECESSARY: the function body has no await expressions
async function getConfig() {
  return { host: "localhost", port: 3000 }; // no async operation
}

// SIMPLER: return a plain value or Promise.resolve if needed
function getConfig() {
  return { host: "localhost", port: 3000 };
}
```

---

## 7. FAQ

**Q: Is `async/await` just syntactic sugar?**

A: Yes. Every `async` function returns a Promise, and `await` is equivalent to `.then()`. The JavaScript engine compiles `async/await` to Promise chains under the hood. There is no performance difference.

---

**Q: Can I use `async/await` with older Node.js versions?**

A: `async/await` requires Node.js 7.6+ (natively) or Node.js 4+ with Babel transpilation. As of 2025, Node.js 18+ is the LTS baseline, so native support is universal.

---

**Q: Does `await` block the thread?**

A: No. `await` suspends the current `async` function but yields control back to the event loop, allowing other callbacks and Promises to execute. The thread is never blocked.

---

**Q: When should I use `Promise.all` vs sequential `await`?**

A: Use `Promise.all` when operations are **independent** (order does not matter, no data dependencies). Use sequential `await` when each step **depends on the result of the previous** step or when order matters (e.g., read before write).

---

**Q: How do I handle timeouts with `async/await`?**

A: Combine `Promise.race` with a timeout Promise.

```js
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function fetchWithTimeout(url) {
  try {
    const data = await withTimeout(fetch(url).then((r) => r.json()), 5000);
    return data;
  } catch (err) {
    console.error(err.message);
    throw err;
  }
}
```

---

**Q: Can I use top-level `await` in Node.js?**

A: Yes, in ES modules (files with `.mjs` extension or `"type": "module"` in `package.json`). In CommonJS modules, wrap your code in an async IIFE.

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
