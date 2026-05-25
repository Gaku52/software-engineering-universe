# The Node.js Event Loop

The event loop is the core mechanism that enables Node.js to perform non-blocking I/O despite running on a single thread. Understanding it is essential for writing predictable async code and diagnosing performance issues.

---

## Table of Contents

1. [What is the Event Loop](#1-what-is-the-event-loop)
2. [Call Stack](#2-call-stack)
3. [Task Queue (Macrotasks)](#3-task-queue-macrotasks)
4. [Microtask Queue](#4-microtask-queue)
5. [Event Loop Phases](#5-event-loop-phases)
6. [Execution Order Examples](#6-execution-order-examples)
7. [Common Interview Questions](#7-common-interview-questions)

---

## 1. What is the Event Loop

Node.js is built on **libuv**, a C library that provides the event loop and async I/O primitives. The event loop continuously checks for pending operations and dispatches their callbacks.

```
  ┌─────────────────────────────────────────┐
  │         Node.js Process                 │
  │                                         │
  │  ┌───────────┐   ┌───────────────────┐  │
  │  │ Call Stack│   │   libuv / OS      │  │
  │  │ (V8)      │   │  Thread Pool      │  │
  │  └─────┬─────┘   │  (fs, crypto...)  │  │
  │        │          └────────┬──────────┘  │
  │        │                   │             │
  │  ┌─────▼─────────────────▼──────────┐  │
  │  │            Event Loop             │  │
  │  │  timers → I/O → poll → check     │  │
  │  └──────────────────────────────────┘  │
  └─────────────────────────────────────────┘
```

**Key insight**: The event loop itself runs on the main thread. When I/O operations (file reads, network requests) are dispatched, libuv offloads them to OS kernel async APIs or the thread pool. Their callbacks are queued for the event loop to pick up — the main thread is never blocked waiting.

---

## 2. Call Stack

The **call stack** is a LIFO (last-in, first-out) data structure that tracks currently executing functions. When a function is called, a frame is pushed; when it returns, the frame is popped.

```js
function multiply(a, b) {
  return a * b;
}

function square(n) {
  return multiply(n, n);
}

function main() {
  const result = square(5);
  console.log(result);
}

main();
```

```
Call stack progression:

  main()          →  square(5)       →  multiply(5,5)
  ┌─────────┐       ┌─────────┐        ┌─────────────┐
  │  main   │       │ square  │        │  multiply   │
  └─────────┘       │  main   │        │  square     │
                    └─────────┘        │  main       │
                                       └─────────────┘
                    ← multiply returns
                    ← square returns
  ← main returns  (stack empty → event loop checks queues)
```

**Blocking the call stack**: If a synchronous operation takes a long time (e.g., `fs.readFileSync` on a large file, heavy computation), the call stack is occupied for that duration. The event loop cannot process any callbacks until the stack is empty — this is what "blocking Node.js" means.

```js
// DANGER: blocks the call stack for potentially seconds
const data = fs.readFileSync("huge-file.csv"); // no I/O during this time

// SAFE: yields to the event loop between chunks
const stream = fs.createReadStream("huge-file.csv");
stream.on("data", (chunk) => processChunk(chunk));
```

---

## 3. Task Queue (Macrotasks)

The **task queue** (also called the macrotask queue or callback queue) holds callbacks ready to be executed. Common sources of macrotasks:

| Source | Description |
|--------|-------------|
| `setTimeout(fn, delay)` | Fires after at least `delay` ms |
| `setInterval(fn, delay)` | Repeats every `delay` ms |
| `setImmediate(fn)` | Fires in the check phase (after I/O) |
| I/O callbacks | `fs.readFile`, network responses, etc. |

The event loop processes **one macrotask per loop iteration**, then drains the microtask queue before moving on.

```js
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));

// Output order in Node.js (when not inside an I/O callback):
// Either order is possible — depends on system timer resolution
// Inside an I/O callback: setImmediate always fires before setTimeout
```

---

## 4. Microtask Queue

The **microtask queue** holds callbacks that should run as soon as the current operation completes, before the event loop moves to the next phase or processes another macrotask.

Sources of microtasks:

| Source | Description |
|--------|-------------|
| `Promise.then()` / `.catch()` / `.finally()` | Promise resolution callbacks |
| `queueMicrotask(fn)` | Explicit microtask scheduling |
| `process.nextTick(fn)` | Node.js-specific — highest priority microtask |

### Priority Order

```
After each task (or at startup):
  1. Drain process.nextTick queue (all of them)
  2. Drain Promise microtask queue (all of them)
  3. Return to event loop → next macrotask
```

```js
Promise.resolve().then(() => console.log("Promise microtask"));
process.nextTick(() => console.log("nextTick"));
setTimeout(() => console.log("setTimeout macrotask"), 0);

console.log("synchronous");

// Output:
// synchronous
// nextTick          ← process.nextTick runs first
// Promise microtask ← then Promise .then()
// setTimeout macrotask ← then macrotask queue
```

### Microtask Starvation

Because the microtask queue is fully drained before any macrotask runs, an infinitely-recursive microtask can starve the event loop.

```js
// DANGER: starves I/O callbacks forever
function infinite() {
  Promise.resolve().then(infinite);
}
infinite();
// setTimeout callbacks never fire, I/O never responds
```

---

## 5. Event Loop Phases

The Node.js event loop has six phases, executed in a fixed order. Each phase has a FIFO queue of callbacks.

```
  ┌──────────────────────────────────────────────┐
  │                                              │
  │   ┌─────────┐                               │
  │   │ timers  │  setTimeout, setInterval       │
  │   └────┬────┘                               │
  │        │                                    │
  │   ┌────▼──────────┐                         │
  │   │ pending I/O   │  deferred I/O errors    │
  │   └────┬──────────┘                         │
  │        │                                    │
  │   ┌────▼──────┐                             │
  │   │  idle,    │  internal use only          │
  │   │  prepare  │                             │
  │   └────┬──────┘                             │
  │        │                                    │
  │   ┌────▼──────┐     ┌──────────────────┐   │
  │   │   poll    │◄────│ incoming I/O /   │   │
  │   └────┬──────┘     │ block if empty   │   │
  │        │            └──────────────────┘   │
  │   ┌────▼──────┐                             │
  │   │   check   │  setImmediate               │
  │   └────┬──────┘                             │
  │        │                                    │
  │   ┌────▼───────────┐                        │
  │   │ close callbacks│  socket.on('close')    │
  │   └────────────────┘                        │
  │        │                                    │
  └────────┘ (loop repeats)
```

### Phase Details

**Timers phase**: Executes callbacks scheduled by `setTimeout` and `setInterval` whose delay threshold has passed. Note: `setTimeout(fn, 0)` is internally clamped to at least 1ms.

**Pending I/O phase**: Executes I/O callbacks deferred to the next loop iteration (mostly error callbacks from the previous cycle).

**Poll phase**: The most critical phase.
- Calculates how long to block and wait for new I/O events
- Processes I/O callbacks in the poll queue
- If the poll queue is empty, waits for I/O events (unless `setImmediate` callbacks are pending)

**Check phase**: Executes `setImmediate` callbacks. Always runs after the poll phase completes.

**Close callbacks phase**: Executes callbacks for closed handles (e.g., `socket.on('close', ...)`).

**Between every phase**: The microtask queues (`process.nextTick` then Promises) are fully drained.

---

## 6. Execution Order Examples

### Example 1: Basic Ordering

```js
console.log("A"); // synchronous

setTimeout(() => console.log("B"), 0); // macrotask

Promise.resolve().then(() => console.log("C")); // microtask

process.nextTick(() => console.log("D")); // highest-priority microtask

console.log("E"); // synchronous

// Output: A, E, D, C, B
```

Explanation:
1. `A` and `E` run synchronously (call stack)
2. `D` runs — `process.nextTick` queue is drained first
3. `C` runs — Promise microtask queue is drained
4. `B` runs — event loop enters timers phase

### Example 2: Nested Microtasks

```js
process.nextTick(() => {
  console.log("nextTick 1");
  process.nextTick(() => console.log("nextTick 2 (nested)"));
});

Promise.resolve().then(() => {
  console.log("Promise 1");
  return Promise.resolve();
}).then(() => console.log("Promise 2 (chained)"));

// Output:
// nextTick 1
// nextTick 2 (nested)  ← nextTick queue fully drained before Promises
// Promise 1
// Promise 2 (chained)
```

### Example 3: `setImmediate` vs `setTimeout` Inside I/O

```js
const fs = require("fs");

fs.readFile(__filename, () => {
  // Inside an I/O callback — poll phase just completed
  setTimeout(() => console.log("setTimeout"), 0);
  setImmediate(() => console.log("setImmediate"));
});

// Output (deterministic inside I/O callback):
// setImmediate  ← check phase always comes before next timers phase
// setTimeout
```

### Example 4: Full Pipeline

```js
const fs = require("fs/promises");

async function pipeline() {
  console.log("1 - start");

  const data = await fs.readFile(__filename, "utf8"); // suspends here

  console.log("3 - after await (I/O complete)");

  process.nextTick(() => console.log("4 - nextTick after resume"));

  await Promise.resolve();

  console.log("5 - after inner await");
}

pipeline();
console.log("2 - synchronous after pipeline() call");

// Output:
// 1 - start
// 2 - synchronous after pipeline() call
// 3 - after await (I/O complete)
// 4 - nextTick after resume
// 5 - after inner await
```

### Example 5: Timer Precision

```js
const start = Date.now();

setTimeout(() => {
  console.log(`Timer fired after ${Date.now() - start}ms`);
}, 100);

// Simulate blocking work
const until = Date.now() + 200;
while (Date.now() < until) {} // blocks the call stack for 200ms

// Output: Timer fired after ~200ms (not 100ms)
// The callback was queued at ~100ms but could not run until the stack was free
```

This demonstrates why blocking the call stack delays all pending callbacks.

---

## 7. Common Interview Questions

### Q1: What is the difference between `process.nextTick` and `Promise.then`?

Both are microtasks, but `process.nextTick` callbacks run **before** Promise callbacks in every microtask drain cycle.

```js
Promise.resolve().then(() => console.log("Promise"));
process.nextTick(() => console.log("nextTick"));

// Output:
// nextTick
// Promise
```

Use `process.nextTick` when you need to schedule a callback before any I/O or Promise resolution in the current turn. Use `Promise.then` for standard async sequencing.

---

### Q2: What is the difference between `setImmediate` and `setTimeout(fn, 0)`?

- `setImmediate` runs in the **check phase**, after the poll phase
- `setTimeout(fn, 0)` runs in the **timers phase** at the start of the next iteration

Inside an I/O callback, `setImmediate` always fires first. Outside I/O callbacks, the order is non-deterministic (depends on OS timer resolution).

```js
// Inside I/O callback → setImmediate always first
fs.readFile("file.txt", () => {
  setImmediate(() => console.log("setImmediate")); // first
  setTimeout(() => console.log("setTimeout"), 0);  // second
});
```

---

### Q3: Can the event loop get "stuck"?

Yes, in two ways:

1. **Blocking the call stack** — synchronous CPU-intensive code (heavy loops, `readFileSync` on large files) prevents the event loop from processing callbacks.

2. **Microtask starvation** — an infinite chain of microtasks (recursive `Promise.resolve().then(...)` or `process.nextTick(...)`) never allows macrotasks to run.

---

### Q4: How does `async/await` interact with the event loop?

An `await` expression suspends the `async` function and schedules its resumption as a **microtask** when the awaited Promise settles. This means code after `await` runs in the microtask queue, not as a new macrotask.

```js
async function example() {
  await Promise.resolve(); // suspends here
  console.log("resumed"); // queued as a microtask
}

example();
console.log("synchronous");

// Output:
// synchronous
// resumed
```

---

### Q5: Why does `setTimeout(fn, 0)` not fire immediately?

Three reasons:
1. The minimum clamp: Node.js internally clamps `setTimeout` delays to at least 1ms.
2. The event loop must finish the current phase before reaching the timers phase.
3. All microtasks (nextTick + Promises) must drain before macrotasks run.

---

### Q6: What is the thread pool, and how does it relate to the event loop?

libuv uses a thread pool (default size: 4 threads, configurable via `UV_THREADPOOL_SIZE`) for operations that cannot be performed asynchronously at the OS level, including:

- File system operations (`fs.readFile`, etc.)
- `crypto` module operations
- `dns.lookup` (not `dns.resolve`)
- Some `zlib` operations

The thread pool runs **off the main thread**. When a thread pool task completes, its callback is placed in the poll queue for the event loop to pick up on the main thread.

```
  Main Thread        Thread Pool (4 threads)
  ┌──────────┐       ┌────────────────────┐
  │ Event    │──────►│ fs.readFile        │
  │ Loop     │       │ crypto.pbkdf2      │
  │          │◄──────│ (callbacks queued  │
  └──────────┘       │  when done)        │
                     └────────────────────┘
```

If all 4 thread pool slots are busy, subsequent I/O operations queue up and wait — this is why CPU-intensive crypto operations can degrade I/O throughput.

---

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
