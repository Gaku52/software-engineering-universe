# JavaScript Memory Management

> From V8 heap structure to GC algorithms, memory leak detection, and Chrome DevTools profiling — systematically understand memory management in JavaScript running in the browser and acquire the skills to build high-performance web applications.

## What You Will Learn

- [ ] Accurately understand the JavaScript memory model (stack and heap)
- [ ] Grasp V8 engine heap structure and generational GC principles
- [ ] Distinguish between Mark-Sweep, Mark-Compact, and Scavenge algorithms
- [ ] Identify 6 typical memory leak patterns and implement countermeasures
- [ ] Perform Heap Snapshot comparison analysis with the Chrome DevTools Memory panel
- [ ] Use WeakRef, WeakMap, and FinalizationRegistry appropriately
- [ ] Design memory monitoring strategies for production environments

---

## Prerequisites

- V8 engine internals → Reference: [V8 Engine](./00-v8-engine.md)
- Web Workers → Reference: [Web Workers](./02-web-workers.md)
- Basic concepts of garbage collection

---

## 1. JavaScript Memory Model

### 1.1 Two-Layer Structure: Stack and Heap

The JavaScript engine manages memory divided into two main regions.

```
Two-layer structure of JavaScript memory:

  Call Stack (Stack)                    Heap
  ┌──────────────────────┐          ┌───────────────────────────────┐
  │ Frame: main()        │          │                               │
  │  ├─ x = 42 (number) │          │  ┌─────────────────────┐      │
  │  ├─ y = "hello"      │          │  │ Object {a:1, b:2}   │      │
  │  └─ obj ─────────────│──────→   │  └─────────────────────┘      │
  │                       │          │                               │
  │ Frame: doWork()       │          │  ┌─────────────────────┐      │
  │  ├─ i = 0 (number)   │          │  │ Array [1, 2, 3]     │      │
  │  ├─ arr ──────────────│──────→   │  └─────────────────────┘      │
  │  └─ flag = true       │          │                               │
  │                       │          │  ┌─────────────────────┐      │
  │ Frame: nested()       │          │  │ Function closure    │      │
  │  ├─ temp = 3.14       │          │  │  captured: [arr]    │      │
  │  └─ fn ───────────────│──────→   │  └─────────────────────┘      │
  └──────────────────────┘          │                               │
                                    │  ┌─────────────────────┐      │
  Characteristics:                  │  │ Map {key → value}   │      │
  - LIFO (Last In, First Out)       │  └─────────────────────┘      │
  - Fixed size (typically ~1MB)     │                               │
  - Automatically freed on         │  Characteristics:             │
    function return                 │  - Dynamic size (MB to GB)   │
  - Stores primitive values         │  - Automatically freed by GC │
    directly                        │  - Stores object types       │
                                    └───────────────────────────────┘
```

#### What Is Stored on the Stack

| Data Type | Example | Size |
|-----------|---------|------|
| Number | `42`, `3.14` | 8 bytes (IEEE 754) |
| Boolean | `true`, `false` | Within tagged pointer |
| null / undefined | `null` | Within tagged pointer |
| BigInt (small value) | `42n` | May be inlined |
| Reference (pointer) | `obj → 0x7ff...` | 8 bytes (64-bit environment) |

#### What Is Stored on the Heap

| Data Type | Example | Notes |
|-----------|---------|-------|
| Object | `{a: 1}` | Hidden Class + property storage |
| Array | `[1, 2, 3]` | Internally a special Object |
| Function | `() => {}` | Reference to code + closure environment |
| String (long) | `"hello..."` | Heap-allocated above a certain length |
| Map / Set | `new Map()` | Hash table structure |
| RegExp | `/abc/g` | Compiled pattern |
| ArrayBuffer | `new ArrayBuffer(1024)` | Contiguous memory block |
| DOM Node reference | `document.getElementById(...)` | Wrapper for a C++ object |

### 1.2 Value Copy vs. Reference Sharing

```javascript
// Code example 1: primitive copy vs. object reference sharing

// Primitives: the value is copied
let a = 42;
let b = a;      // b has an independent copy of 42
b = 100;
console.log(a); // 42 (a is unaffected)

// Objects: the reference is shared
let obj1 = { name: "Alice", scores: [90, 85, 92] };
let obj2 = obj1;          // obj2 references the same object
obj2.name = "Bob";
console.log(obj1.name);   // "Bob" (obj1 is also affected)

// Cutting the reference: assign a new object
obj2 = { name: "Charlie", scores: [70, 80] };
console.log(obj1.name);   // "Bob" (obj1 continues to reference the original object)

// Shallow copy: spread operator
let obj3 = { ...obj1 };
obj3.name = "Dave";
console.log(obj1.name);   // "Bob" (primitive properties are independent)
obj3.scores.push(100);
console.log(obj1.scores); // [90, 85, 92, 100] (nested array is shared!)

// Deep copy: structuredClone (recommended)
let obj4 = structuredClone(obj1);
obj4.scores.push(200);
console.log(obj1.scores); // [90, 85, 92, 100] (unaffected)
```

### 1.3 GC Roots and Reachability

Garbage collection (GC) determines whether objects are alive based on "reachability." Objects reachable from GC roots survive; objects that are not reachable become candidates for collection.

```
Reachability determination from GC roots:

  GC Roots
  ├── Global object (window / globalThis)
  │     ├── window.app ──→ [App Object] ──→ [Config]
  │     └── window.cache ──→ [Cache Map] ──→ [Entry1] ──→ [Data1]
  │                                        └→ [Entry2] ──→ [Data2]
  │
  ├── Local variables on the call stack
  │     ├── localVar ──→ [Temp Object]
  │     └── callback ──→ [Function] ──→ (closure) ──→ [Captured Vars]
  │
  ├── Active timers
  │     ├── setInterval(fn, 1000) ──→ [fn] ──→ [Referenced Data]
  │     └── setTimeout(fn, 5000) ──→ [fn]
  │
  └── Others
        ├── Promise then/catch callbacks
        ├── MutationObserver
        ├── MessagePort
        └── Active EventListeners

  Unreachable (GC targets):
  ┌─────────────────────────────────────────────────┐
  │  [Orphan Object]     Not reachable from any root │
  │  [Detached DOM Tree] Removed from DOM & no JS ref│
  │  [Old Closure Data]  Function done & refs gone   │
  └─────────────────────────────────────────────────┘
```

---

## 2. V8 Engine Heap Structure

### 2.1 Internal Layout of the V8 Heap

The V8 engine (used in Chrome and Node.js) divides and manages the heap into multiple spaces. This structure forms the foundation of generational GC.

```
V8 Heap Structure (detailed):

  ┌──────────────────────────────────────────────────────────────┐
  │                        V8 Heap                               │
  │                                                              │
  │  ┌─────────────────────────────────────────────────────┐     │
  │  │              New Space (Young Generation)           │     │
  │  │  ┌──────────────────┐  ┌──────────────────┐         │     │
  │  │  │   Semi-Space A   │  │   Semi-Space B   │         │     │
  │  │  │   (From-Space)   │  │   (To-Space)     │         │     │
  │  │  │                  │  │                  │         │     │
  │  │  │  New objects are │  │  Survivors after │         │     │
  │  │  │  allocated here  │  │  Scavenge move   │         │     │
  │  │  │                  │  │  here            │         │     │
  │  │  │  Size: 1~8 MB    │  │  Size: 1~8 MB    │         │     │
  │  │  └──────────────────┘  └──────────────────┘         │     │
  │  └─────────────────────────────────────────────────────┘     │
  │                                                              │
  │  ┌─────────────────────────────────────────────────────┐     │
  │  │              Old Space (Old Generation)             │     │
  │  │                                                     │     │
  │  │  ┌──────────────────────────────────────────┐       │     │
  │  │  │  Old Pointer Space                       │       │     │
  │  │  │  Objects containing references to others │       │     │
  │  │  └──────────────────────────────────────────┘       │     │
  │  │                                                     │     │
  │  │  ┌──────────────────────────────────────────┐       │     │
  │  │  │  Old Data Space                          │       │     │
  │  │  │  Objects with only primitive data        │       │     │
  │  │  │  (strings, boxed numbers, etc.)          │       │     │
  │  │  └──────────────────────────────────────────┘       │     │
  │  │                                                     │     │
  │  │  Size: hundreds of MB to GB (--max-old-space-size)  │     │
  │  └─────────────────────────────────────────────────────┘     │
  │                                                              │
  │  ┌──────────────────┐  ┌──────────────────┐                  │
  │  │ Large Object     │  │ Code Space       │                  │
  │  │ Space            │  │                  │                  │
  │  │ Objects larger   │  │ JIT-compiled     │                  │
  │  │ than threshold   │  │ code             │                  │
  │  │ (arrays, etc.)   │  │                  │                  │
  │  └──────────────────┘  └──────────────────┘                  │
  │                                                              │
  │  ┌──────────────────┐  ┌──────────────────┐                  │
  │  │ Map Space        │  │ Cell Space       │                  │
  │  │                  │  │                  │                  │
  │  │ Hidden Class     │  │ Cell / Property  │                  │
  │  │ (Map) structs    │  │ Cell             │                  │
  │  └──────────────────┘  └──────────────────┘                  │
  └──────────────────────────────────────────────────────────────┘
```

### 2.2 Role and Characteristics of Each Space

| Space | Role | Typical Size | GC Method | Frequency |
|-------|------|-------------|-----------|-----------|
| New Space (Semi-Space A/B) | Allocating new objects | 1~8 MB | Scavenge (copy GC) | High (millisecond-level) |
| Old Pointer Space | Long-lived objects (containing references) | Hundreds of MB+ | Mark-Sweep / Mark-Compact | Low |
| Old Data Space | Long-lived data (no references) | Tens of MB+ | Mark-Sweep / Mark-Compact | Low |
| Large Object Space | Large objects (above threshold) | Variable | Mark-Sweep | Low |
| Code Space | JIT-compiled code | Tens of MB | Special GC | Low |
| Map Space | Hidden Classes (Maps) | A few MB | Mark-Sweep | Low |

### 2.3 Object Lifecycle

```javascript
// Code example 2: Tracking object lifecycle

function demonstrateLifecycle() {
  // Phase 1: Allocated in New Space
  const shortLived = { type: "temporary", data: new Array(100) };
  // → shortLived is placed in New Space (Semi-Space A)

  // Phase 2: shortLived becomes unreachable when function ends
  // → Collected by next Scavenge (completed within New Space)

  // Phase 3: Long-lived objects are promoted to Old Space
  const cache = new Map();
  for (let i = 0; i < 10000; i++) {
    cache.set(i, { value: i * 2, label: `item-${i}` });
  }
  // → cache and internal objects survive multiple Scavenge cycles
  //   and are promoted to Old Space (Old Pointer Space)

  return cache; // cache continues to be referenced by the caller
}

// Kept in global scope → reachable from GC roots
const globalCache = demonstrateLifecycle();

// Explicitly cut the reference → becomes GC candidate
// globalCache = null;
```

### 2.4 Hidden Classes (Maps) and Inline Caches

V8 manages the "shape" of objects using Hidden Classes (internally called Maps). Objects with the same properties in the same order share a Hidden Class, speeding up property access.

```javascript
// Code example 3: Hidden Classes and memory efficiency

// Good example: sharing the same Hidden Class
function createPoint(x, y) {
  // All objects have properties in the same order
  return { x: x, y: y };
}

const points = [];
for (let i = 0; i < 10000; i++) {
  points.push(createPoint(i, i * 2));
}
// → 10,000 objects share a single Hidden Class
// → Memory-efficient (only one Hidden Class)

// Bad example: many different Hidden Classes are created
const badPoints = [];
for (let i = 0; i < 10000; i++) {
  const p = {};
  if (i % 2 === 0) {
    p.x = i;
    p.y = i * 2;
  } else {
    p.y = i * 2;  // Different property addition order!
    p.x = i;
  }
  badPoints.push(p);
}
// → 2 types of Hidden Classes are created
// → Inline cache misses occur, slowing property access

// Worst example: degradation of Hidden Class by delete
const obj = { a: 1, b: 2, c: 3 };
delete obj.b;
// → Hidden Class degrades to "dictionary mode (slow mode)"
// → Property access becomes hash-table-based lookup, slowing things down
// Countermeasure: assign undefined instead of using delete
// obj.b = undefined; // Does not destroy the Hidden Class
```

---

## 3. GC Algorithms in Detail

### 3.1 Minor GC: Scavenge (Copy GC)

A fast GC algorithm executed in New Space. Based on Cheney's copy GC algorithm.

```
Scavenge algorithm operation:

  === Initial state ===
  From-Space (Semi-Space A):          To-Space (Semi-Space B):
  ┌────────────────────────────┐      ┌────────────────────────────┐
  │ [Obj-A] [Dead] [Obj-B]    │      │         (empty)            │
  │ [Dead] [Obj-C] [Dead]     │      │                            │
  │ [Obj-D] [Dead] [Dead]     │      │                            │
  └────────────────────────────┘      └────────────────────────────┘

  === Scavenge execution ===
  1. Scan reachable objects in From-Space from GC roots
  2. Copy reachable objects to To-Space
  3. Objects that have already survived one or more Scavenge cycles
     are promoted to Old Space

  From-Space:                          To-Space:
  ┌────────────────────────────┐      ┌────────────────────────────┐
  │ (all data discarded)       │      │ [Obj-A'] [Obj-B'] [Obj-C']│
  │                            │      │                            │
  │                            │      │                            │
  └────────────────────────────┘      └────────────────────────────┘
                                            ↑ Already compacted
                                            (no fragmentation)
  [Obj-D] → Promoted to Old Space (survived 2nd Scavenge)

  === Role swap ===
  Old To-Space becomes new From-Space
  Old From-Space becomes new To-Space (for next Scavenge)
```

**Scavenge characteristics:**

| Property | Value |
|----------|-------|
| Stop time | Typically 1~10 ms |
| Target space | New Space only (1~8 MB) |
| Algorithm | Copy GC (Cheney) |
| Compaction | Automatically performed during copy |
| Space efficiency | 50% (uses 2 Semi-Spaces) |
| Promotion condition | Survived 1+ Scavenge, or To-Space exceeds 25% |

### 3.2 Major GC: Mark-Sweep and Mark-Compact

A larger-scale GC executed in Old Space, consisting of two phases: Mark-Sweep and Mark-Compact.

#### Mark Phase

```
Mark phase (tri-color marking):

  Color meaning:
  - White: Unvisited (all objects are white at GC start)
  - Gray:  Visited but children not yet scanned
  - Black: Visited and all children scanned

  === Steps ===

  Step 1: Mark direct children of GC roots as gray
  ┌─────┐
  │Root │──→ [Obj-A: gray] ──→ [Obj-B: white]
  │     │──→ [Obj-C: gray]     [Obj-D: white] (isolated)
  └─────┘

  Step 2: Scan children of gray objects, mark self as black
  ┌─────┐
  │Root │──→ [Obj-A: black] ──→ [Obj-B: gray]
  │     │──→ [Obj-C: black]     [Obj-D: white] (isolated)
  └─────┘

  Step 3: Repeat until no more gray objects
  ┌─────┐
  │Root │──→ [Obj-A: black] ──→ [Obj-B: black]
  │     │──→ [Obj-C: black]     [Obj-D: white → collected!]
  └─────┘

  Result: Objects that remain white = unreachable = GC targets
```

#### Sweep Phase and Compact Phase

**Mark-Sweep** frees the memory of objects that were not marked (white). It is fast but causes fragmentation.

**Mark-Compact** eliminates fragmentation by moving surviving objects to one end of memory. It is slower than Sweep but can secure the contiguous region needed for allocating large objects.

### 3.3 Incremental Marking and Concurrent GC

V8 combines multiple optimization techniques to reduce stop times.

| Technique | Description | Effect |
|-----------|-------------|--------|
| Incremental marking | Divides the Mark phase into small steps, interleaving with application execution | Avoids long stop times |
| Concurrent marking | Runs marking in parallel on worker threads | Reduces main thread stop time |
| Parallel marking | Runs marking simultaneously on multiple threads | Speeds up the marking process itself |
| Lazy sweeping | Defers Sweep until needed | Distributes stop time |
| Concurrent compaction | Runs memory movement concurrently | Reduces stop time during compaction |

```javascript
// Code example 4: Measuring GC pause times

// Indirect measurement of GC pause times using the Performance API
function measureGCPauses(durationMs = 5000) {
  const pauses = [];
  let lastTime = performance.now();
  const threshold = 5; // Estimate pauses > 5ms as GC

  const intervalId = setInterval(() => {
    const now = performance.now();
    const elapsed = now - lastTime;

    if (elapsed > threshold) {
      pauses.push({
        timestamp: now,
        duration: elapsed.toFixed(2) + "ms",
        likely: elapsed > 50 ? "Major GC" : "Minor GC"
      });
    }
    lastTime = now;
  }, 1);

  setTimeout(() => {
    clearInterval(intervalId);
    console.table(pauses);
    console.log(`Detected pauses: ${pauses.length}`);
  }, durationMs);
}

// Usage:
// measureGCPauses(10000); // Monitor for 10 seconds
```

### 3.4 Orinoco: V8's Modern GC Architecture

V8's GC subsystem "Orinoco" continues to evolve with the following design principles.

1. **Concurrent**: Execute GC work in the background without stopping the main thread
2. **Parallel**: Distribute GC work across multiple helper threads
3. **Incremental**: Divide GC work into small chunks and process them gradually

Through a combination of these approaches, even Major GC stop times are kept to just a few milliseconds.

---

## 4. Typical Memory Leak Patterns and Countermeasures

### 4.1 Pattern Overview

| # | Pattern | Severity | Detection Difficulty | Main Countermeasure |
|---|---------|----------|---------------------|---------------------|
| 1 | Unintentional creation of global variables | Medium | Easy | `"use strict"`, ESLint no-implicit-globals |
| 2 | Forgetting to clear timers | High | Medium | `clearInterval` / `clearTimeout` |
| 3 | Forgetting to remove event listeners | High | Medium | `removeEventListener` / `AbortController` |
| 4 | Unintentional reference retention by closures | High | Hard | Minimize scope, assign null |
| 5 | Detached DOM trees | High | Medium | Null out JS-side references |
| 6 | Object retention by console.log | Low | Easy | Remove logs in production |

### 4.2 Pattern 1: Unintentional Creation of Global Variables

```javascript
// Anti-pattern 1: implicit global variables

function processData(items) {
  // Without "use strict", result becomes a global variable
  result = items.map(item => item.value * 2); // No var/let/const!

  // Even more dangerous: case where this points to window
  this.accumulatedData = new Array(100000).fill(0);
  // → Persists globally as window.accumulatedData
}

// Countermeasure: strict mode + proper variable declarations
"use strict";

function processDataSafe(items) {
  const result = items.map(item => item.value * 2); // Block scope
  return result;
}
```

### 4.3 Pattern 2: Forgetting to Clear Timers

```javascript
// Anti-pattern 2: timer leak in SPAs

class DataPollingWidget {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.data = null;

    // Problem: not cleared when component is destroyed
    this.intervalId = setInterval(async () => {
      const response = await fetch(this.endpoint);
      this.data = await response.json(); // Accumulates large amounts of data
      this.render();
    }, 5000);
  }

  render() {
    // UI update processing
  }

  // Fix: explicit cleanup method
  destroy() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.data = null;
  }
}

// Correct pattern in React
function useDataPolling(endpoint, intervalMs = 5000) {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    const controller = new AbortController();

    const poll = async () => {
      try {
        const response = await fetch(endpoint, {
          signal: controller.signal
        });
        const json = await response.json();
        setData(json);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Polling error:", err);
        }
      }
    };

    const id = setInterval(poll, intervalMs);
    poll(); // Execute immediately on first run

    // Cleanup: ensure stopping on unmount
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [endpoint, intervalMs]);

  return data;
}
```

### 4.4 Pattern 3: Forgetting to Remove Event Listeners

```javascript
// Problematic pattern: listeners accumulate
class ScrollTracker {
  constructor() {
    this.positions = [];

    // Problem: anonymous function, cannot removeEventListener
    window.addEventListener("scroll", () => {
      this.positions.push({
        y: window.scrollY,
        time: Date.now()
      });
    });
  }
}

// Fix 1: named function + removeEventListener
class ScrollTrackerFixed {
  constructor() {
    this.positions = [];
    this.handleScroll = this.handleScroll.bind(this);
    window.addEventListener("scroll", this.handleScroll);
  }

  handleScroll() {
    this.positions.push({ y: window.scrollY, time: Date.now() });
  }

  destroy() {
    window.removeEventListener("scroll", this.handleScroll);
    this.positions = [];
  }
}

// Fix 2: bulk management with AbortController (recommended)
class ScrollTrackerModern {
  constructor() {
    this.positions = [];
    this.abortController = new AbortController();

    window.addEventListener("scroll", () => {
      this.positions.push({ y: window.scrollY, time: Date.now() });
    }, { signal: this.abortController.signal });

    window.addEventListener("resize", () => {
      this.positions = []; // Reset on resize
    }, { signal: this.abortController.signal });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.flush();
    }, { signal: this.abortController.signal });
  }

  flush() {
    // Processing such as sending to server
    this.positions = [];
  }

  destroy() {
    // Bulk remove all listeners
    this.abortController.abort();
    this.positions = [];
  }
}
```

### 4.5 Pattern 4: Unintentional Reference Retention by Closures

Closures "capture" variables from outer scopes. V8 excludes unused variables from closures through optimization, but under certain conditions, large objects can continue to be retained.

```javascript
// Edge case 1: presence of eval disables closure optimization

function createProcessor() {
  const hugeBuffer = new ArrayBuffer(100 * 1024 * 1024); // 100MB
  const metadata = { created: Date.now(), type: "buffer" };

  // hugeBuffer is not used, but because eval exists,
  // all variables are captured
  return function process(code) {
    // With eval present, V8 cannot statically determine which variables are used
    // Therefore, all variables in scope are retained
    return eval(code); // hugeBuffer is also retained!
  };
}

// Countermeasure: explicitly limit closure scope
function createProcessorFixed() {
  const hugeBuffer = new ArrayBuffer(100 * 1024 * 1024);
  const result = processBuffer(hugeBuffer);

  // Create function in a different scope after finishing with hugeBuffer
  return createCallback(result);
}

function createCallback(processedResult) {
  // This closure only captures processedResult
  return function() {
    return processedResult;
  };
}
```

```javascript
// Edge case 2: multiple closures share the same scope

function setupHandlers() {
  const largeData = new Array(1000000).fill("data");
  const config = { debug: true };

  // handler1 uses largeData
  const handler1 = () => {
    console.log(largeData.length);
  };

  // handler2 does not use largeData
  // However, depending on V8's implementation, it may share the same
  // Context object as handler1
  // → largeData reference may remain in handler2 as well
  const handler2 = () => {
    console.log(config.debug);
  };

  // Even if handler1 is discarded, if handler2 is alive,
  // largeData may not be freed
  return { handler1, handler2 };
}

// Countermeasure: define functions in separate scopes
function setupHandlersSafe() {
  const handler1 = createHandler1();
  const handler2 = createHandler2();
  return { handler1, handler2 };
}

function createHandler1() {
  const largeData = new Array(1000000).fill("data");
  return () => console.log(largeData.length);
}

function createHandler2() {
  const config = { debug: true };
  return () => console.log(config.debug);
}
```

### 4.6 Pattern 5: Detached DOM Tree

One of the most frequently occurring leak patterns in SPAs. Even when a DOM node is removed from the document tree, if a JavaScript-side reference remains, it cannot be GC'd.

```
Detached DOM tree leak mechanism:

  === Connected to DOM tree ===
  document
  └── body
      └── #container
          ├── .card-1 ←─── JS: this.cards[0]
          ├── .card-2 ←─── JS: this.cards[1]
          └── .card-3 ←─── JS: this.cards[2]

  === Remove #container from DOM ===
  document
  └── body
      (empty)

  Detached DOM tree:
  #container          ← Want to GC, but...
  ├── .card-1 ←────── JS: this.cards[0] still references!
  ├── .card-2 ←────── JS: this.cards[1] still references!
  └── .card-3 ←────── JS: this.cards[2] still references!

  → Because the this.cards array holds references,
    the entire tree under #container cannot be GC'd
  → Displayed as "Detached" in DevTools Heap Snapshot
```

```javascript
// Code example 5: Detecting and fixing Detached DOM

// Problematic code
class CardList {
  constructor(container) {
    this.container = container;
    this.cards = [];
    this.listeners = new Map();
  }

  addCard(data) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${data.title}</h3>
      <p>${data.description}</p>
      <button class="delete-btn">Delete</button>
    `;

    const deleteBtn = card.querySelector(".delete-btn");
    const handler = () => this.removeCard(card);
    deleteBtn.addEventListener("click", handler);

    // Problem: references retained in cards array and listeners Map
    this.cards.push(card);
    this.listeners.set(card, { element: deleteBtn, handler });

    this.container.appendChild(card);
  }

  removeCard(card) {
    this.container.removeChild(card);
    // Not removing from the cards array here causes Detached DOM leak!
  }

  // Fixed version: complete cleanup
  removeCardFixed(card) {
    // 1. Remove event listener
    const listenerInfo = this.listeners.get(card);
    if (listenerInfo) {
      listenerInfo.element.removeEventListener("click", listenerInfo.handler);
      this.listeners.delete(card);
    }

    // 2. Remove from array
    const index = this.cards.indexOf(card);
    if (index !== -1) {
      this.cards.splice(index, 1);
    }

    // 3. Remove from DOM
    card.remove();
  }

  // Full cleanup
  destroy() {
    // Clean up all cards
    for (const card of [...this.cards]) {
      this.removeCardFixed(card);
    }
    this.cards = [];
    this.listeners.clear();
    this.container = null;
  }
}
```

### 4.7 Pattern 6: Object Retention by console.log

An easily overlooked leak pattern during development. Objects passed to `console.log` are referenced by DevTools to display them.

```javascript
// Leak by console.log
function processLargeData() {
  const data = generateHugeDataset(); // Data of tens of MB

  console.log("Processing data:", data); // DevTools holds a reference to data!

  const result = transform(data);

  // data should become a GC candidate here,
  // but console.log continues to hold the reference

  return result;
}

// Countermeasure 1: Remove logs in production
// Strip console.log in webpack / vite configuration

// Countermeasure 2: Log only necessary information
function processLargeDataFixed() {
  const data = generateHugeDataset();

  console.log("Processing data, size:", data.length); // Size only

  const result = transform(data);
  return result;
}

// Countermeasure 3: Conditional logging
const IS_DEV = process.env.NODE_ENV === "development";

function debugLog(label, data) {
  if (IS_DEV) {
    console.log(label, typeof data === "object" ? JSON.stringify(data).slice(0, 200) : data);
  }
}
```

---

## 5. WeakRef / WeakMap / WeakSet / FinalizationRegistry

### 5.1 The Concept of Weak References

Normal references (strong references) prevent an object from being GC'd, but weak references do not. If only weak references to an object remain, it becomes a GC candidate.

| Type | Key Reference | Value Reference | GC Effect | Iteration |
|------|:------------:|:---------------:|:----------:|:---------:|
| Map | Strong | Strong | Both key and value prevent GC | Possible |
| WeakMap | Weak | Strong | Entry deleted when key is GC'd | Not possible |
| Set | - | Strong | Prevents GC of value | Possible |
| WeakSet | - | Weak | Does not prevent GC of value | Not possible |
| WeakRef | - | Weak | Does not prevent GC of target | - |

### 5.2 Implementing a Cache with WeakMap

```javascript
// Code example 6: Memory-safe cache with WeakMap

// Problem: using Map keeps key objects alive even when no longer needed
class UnsafeCache {
  constructor() {
    this.cache = new Map();
  }

  compute(obj) {
    if (this.cache.has(obj)) {
      return this.cache.get(obj);
    }
    const result = expensiveComputation(obj);
    this.cache.set(obj, result);
    return result;
  }
  // Even if obj is no longer needed, this.cache holds the reference → leak
}

// Fix: using WeakMap, the entry is automatically deleted when the key is GC'd
class SafeCache {
  constructor() {
    this.cache = new WeakMap();
  }

  compute(obj) {
    if (this.cache.has(obj)) {
      return this.cache.get(obj);
    }
    const result = expensiveComputation(obj);
    this.cache.set(obj, result);
    return result;
  }
  // Once obj is no longer referenced anywhere, the entry is also automatically deleted
}

// Practical example: associating data with DOM elements
const elementData = new WeakMap();

function attachData(element, data) {
  elementData.set(element, data);
  // When element is removed from DOM and has no other references,
  // data is also automatically GC'd
}

function getData(element) {
  return elementData.get(element);
}
```

### 5.3 WeakRef and FinalizationRegistry

```javascript
// Code example 7: Unlimited-size cache using WeakRef

class WeakCache {
  constructor() {
    this.cache = new Map(); // key: string, value: WeakRef<Object>
    this.registry = new FinalizationRegistry((key) => {
      // When an object is GC'd, remove the entry from Map
      const ref = this.cache.get(key);
      if (ref && ref.deref() === undefined) {
        this.cache.delete(key);
        console.log(`Cache entry "${key}" was cleaned up by GC`);
      }
    });
  }

  set(key, value) {
    // Unregister from FinalizationRegistry if existing entry exists
    const existingRef = this.cache.get(key);
    if (existingRef) {
      this.registry.unregister(existingRef);
    }

    const ref = new WeakRef(value);
    this.cache.set(key, ref);

    // Register GC notification (use ref as token for unregister)
    this.registry.register(value, key, ref);
  }

  get(key) {
    const ref = this.cache.get(key);
    if (!ref) return undefined;

    const value = ref.deref();
    if (value === undefined) {
      // Already GC'd → delete the entry
      this.cache.delete(key);
      return undefined;
    }
    return value;
  }

  get size() {
    // Actual number of live entries (excludes GC'd ones)
    let count = 0;
    for (const [key, ref] of this.cache) {
      if (ref.deref() !== undefined) {
        count++;
      } else {
        this.cache.delete(key);
      }
    }
    return count;
  }
}

// Usage
const imageCache = new WeakCache();

async function loadImage(url) {
  let image = imageCache.get(url);
  if (image) {
    console.log("Cache hit:", url);
    return image;
  }

  console.log("Cache miss, loading:", url);
  image = await fetchAndDecodeImage(url);
  imageCache.set(url, image);
  return image;
}
```

> **Note**: FinalizationRegistry callbacks depend on GC timing and are not guaranteed to execute. For reliable resource cleanup, use explicit `dispose()` / `close()` methods. FinalizationRegistry should be positioned as a safety net.

### 5.4 Symbol.dispose and the using Declaration (TC39 Stage 3→4)

The ECMAScript Explicit Resource Management proposal supports reliable resource cleanup at the language level through `Symbol.dispose` and `using` declarations.

```javascript
// Code example 8: Explicit Resource Management (using declaration)

class DatabaseConnection {
  #connection;

  constructor(url) {
    this.#connection = connect(url);
  }

  query(sql) {
    return this.#connection.execute(sql);
  }

  // Implement Symbol.dispose → automatic cleanup with using declaration
  [Symbol.dispose]() {
    this.#connection.close();
    this.#connection = null;
    console.log("Connection disposed");
  }
}

// using declaration: dispose is automatically called when the scope ends
async function fetchUserData(userId) {
  using db = new DatabaseConnection("postgres://localhost/mydb");

  const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
  const orders = await db.query(`SELECT * FROM orders WHERE user_id = ${userId}`);

  return { user, orders };
  // ← db[Symbol.dispose]() is automatically called here
  // Called reliably even if an exception occurs (equivalent to try-finally)
}

// For async resources: Symbol.asyncDispose + await using
class StreamProcessor {
  #stream;

  constructor(stream) {
    this.#stream = stream;
  }

  async [Symbol.asyncDispose]() {
    await this.#stream.close();
    console.log("Stream closed");
  }
}

async function processFile(path) {
  await using processor = new StreamProcessor(openFile(path));
  // ... processing ...
  // await processor[Symbol.asyncDispose]() is called when scope ends
}
```

---

## 6. Memory Profiling with Chrome DevTools

### 6.1 Overview of the Memory Panel

The Memory panel in Chrome DevTools provides three main profiling approaches.

| Approach | Purpose | Overhead | Suitable Scenarios |
|----------|---------|----------|-------------------|
| Heap Snapshot | Record all objects at a point in time | High (with pause) | Identifying leak locations, analyzing object retention chains |
| Allocation Timeline | Record memory allocations over time | Medium | Identifying when memory is allocated |
| Allocation Sampling | Sampling-based allocation recording | Low | Long-running profiling, near-production environments |

### 6.2 Heap Snapshot Step-by-Step Procedure

```
Memory leak detection with Heap Snapshot (step-by-step):

  ┌────────────────────────────────────────────────────────┐
  │ Step 1: Preparation                                    │
  │  - Open Chrome DevTools (F12 / Cmd+Opt+I)              │
  │  - Select the Memory tab                               │
  │  - Select the "Heap snapshot" radio button             │
  └───────────────────────────┬────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────┐
  │ Step 2: Baseline snapshot                              │
  │  - Force GC (click the trash icon)                     │
  │  - Click the "Take snapshot" button                    │
  │  - → Snapshot 1 is recorded                            │
  └───────────────────────────┬────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────┐
  │ Step 3: Perform the suspected leaking operation        │
  │  - Page navigation, dialog open/close, data loading    │
  │  - Return to state before operation (e.g., close dialog)│
  └───────────────────────────┬────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────┐
  │ Step 4: Comparison snapshot                            │
  │  - Force GC                                            │
  │  - "Take snapshot" → Snapshot 2                        │
  └───────────────────────────┬────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────┐
  │ Step 5: Comparison analysis                            │
  │  - Select Snapshot 2                                    │
  │  - Switch view to "Comparison"                          │
  │  - Select "Compared to Snapshot 1"                      │
  │  - Sort by "#Delta" column → positive values = leak     │
  │  - "#New" column = number of newly allocated objects    │
  │  - "#Deleted" column = number of GC'd objects           │
  │  - "#Delta" = #New - #Deleted                          │
  └───────────────────────────┬────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────┐
  │ Step 6: Investigate retention chains                   │
  │  - Click on a leak candidate object                     │
  │  - Check retainers in the bottom "Retainers" panel     │
  │  - Trace the chain to the root to identify leak source │
  └────────────────────────────────────────────────────────┘
```

### 6.3 Heap Snapshot View Modes

| View | Content Displayed | Use Case |
|------|------------------|----------|
| Summary | Grouped by constructor name | Understanding memory consumption by object type |
| Comparison | Diff between two snapshots | Best for identifying leaks |
| Containment | Containment relationships between objects | Understanding heap structure |
| Statistics | Pie chart of memory types | Understanding the overall picture |

#### Important Columns in Summary View

| Column | Meaning |
|--------|---------|
| Constructor | Object's constructor name |
| Distance | Shortest distance from GC root |
| Shallow Size | Size of the object itself (bytes) |
| Retained Size | Total size of object and its exclusive dependencies |

**Difference between Shallow Size and Retained Size:**

```
Example: Object A exclusively holds B and C; D is held by both A and E

  [A] ──→ [B] ──→ [C]
   │
   └──→ [D] ←── [E]

  A's Shallow Size  = size of A itself (e.g., 64 bytes)
  A's Retained Size = total of A + B + C sizes (e.g., 64 + 128 + 256 = 448 bytes)
                     D is referenced by E as well, so it is not included
```

### 6.4 Using Allocation Timeline

Allocation Timeline tracks memory allocations over time and is useful for identifying which operations are responsible for memory consumption.

```
How to read Allocation Timeline:

  Time →
  ┌──────────────────────────────────────────────────────┐
  │ ████                                                  │ ← blue: alive
  │ ░░░░██████                                            │ ← gray: GC'd
  │         ░░░░████████████████████████████              │ ← long blue = leak candidate
  │              ░░░░░░░░                                 │
  │                    ████                               │
  │                         ░░░░██████████████████████    │ ← leak candidate
  │                              ░░░░░░░░                 │
  └──────────────────────────────────────────────────────┘
    ↑ button click       ↑ page nav       ↑ data load

  Blue bars remaining until recording end = surviving objects
  → Should have been freed but remains = leak
  → Click on a bar to show details of the corresponding object
```

### 6.5 Performance.memory API and measureUserAgentSpecificMemory

```javascript
// Code example 9: Memory usage monitoring in the browser

// Performance.memory API (Chrome only, being deprecated)
function getMemoryInfo() {
  if (performance.memory) {
    return {
      usedHeapMB: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
      totalHeapMB: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
      limitMB: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
      usagePercent: (
        (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      ).toFixed(1)
    };
  }
  return null;
}

// Newer API: performance.measureUserAgentSpecificMemory()
// Requires Cross-Origin Isolation (COOP + COEP headers)
async function measureMemory() {
  if (performance.measureUserAgentSpecificMemory) {
    try {
      const result = await performance.measureUserAgentSpecificMemory();
      console.log("Total bytes:", result.bytes);
      for (const breakdown of result.breakdown) {
        console.log(
          `  ${breakdown.types.join(", ")}: ${(breakdown.bytes / 1024).toFixed(0)} KB`
        );
        if (breakdown.attribution.length > 0) {
          for (const attr of breakdown.attribution) {
            console.log(`    scope: ${attr.scope}`);
            if (attr.container) {
              console.log(`    container: ${attr.container.src}`);
            }
          }
        }
      }
      return result;
    } catch (e) {
      console.error("measureUserAgentSpecificMemory failed:", e);
    }
  }
  return null;
}

// Periodic memory monitoring
class MemoryMonitor {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 10000;
    this.warningThresholdMB = options.warningThresholdMB || 100;
    this.criticalThresholdMB = options.criticalThresholdMB || 200;
    this.history = [];
    this.timerId = null;
  }

  start() {
    this.timerId = setInterval(() => {
      const info = getMemoryInfo();
      if (!info) return;

      const entry = {
        timestamp: Date.now(),
        ...info
      };
      this.history.push(entry);

      // Warning determination
      const usedMB = parseFloat(info.usedHeapMB);
      if (usedMB > this.criticalThresholdMB) {
        console.warn(`[Memory CRITICAL] ${usedMB} MB used`);
        this.onCritical?.(entry);
      } else if (usedMB > this.warningThresholdMB) {
        console.warn(`[Memory WARNING] ${usedMB} MB used`);
        this.onWarning?.(entry);
      }

      // Detect upward trend
      if (this.history.length >= 10) {
        const recent = this.history.slice(-10);
        const trend = this.calculateTrend(recent);
        if (trend > 0.5) { // More than 0.5 MB increase per sample
          console.warn(`[Memory TREND] Increasing at ${trend.toFixed(2)} MB/sample`);
        }
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  calculateTrend(entries) {
    if (entries.length < 2) return 0;
    const first = parseFloat(entries[0].usedHeapMB);
    const last = parseFloat(entries[entries.length - 1].usedHeapMB);
    return (last - first) / (entries.length - 1);
  }
}
```

---

## 7. Memory Management in Node.js Environments

### 7.1 Controlling Heap Size in Node.js

Node.js has a default upper limit on heap size. Applications processing large amounts of data need to be aware of this limit.

| Node.js Version | Default Old Space Limit | Notes |
|----------------|------------------------|-------|
| v12 and earlier | ~1.5 GB (64-bit) | ~512 MB on 32-bit |
| v12~v16 | ~2 GB | Gradually increasing |
| v17 and later | ~4 GB | Auto-adjusted up to 50% of physical memory |

```bash
# Explicitly set heap size
node --max-old-space-size=8192 server.js  # Set Old Space to 8GB
node --max-semi-space-size=64 server.js   # Set Semi-Space to 64MB

# V8 GC flags
node --expose-gc server.js                # Enable global.gc()
node --trace-gc server.js                 # Log GC events
node --trace-gc-verbose server.js         # Detailed GC log
```

### 7.2 Monitoring with process.memoryUsage()

```javascript
// Code example 10: Memory usage monitoring in Node.js

function printMemoryUsage(label = "") {
  const usage = process.memoryUsage();
  const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";

  console.log(`=== Memory Usage ${label} ===`);
  console.log(`  rss:          ${formatMB(usage.rss)}`);        // Total memory allocated by OS
  console.log(`  heapTotal:    ${formatMB(usage.heapTotal)}`);   // V8 heap total
  console.log(`  heapUsed:     ${formatMB(usage.heapUsed)}`);    // V8 heap usage
  console.log(`  external:     ${formatMB(usage.external)}`);    // C++ objects (Buffer, etc.)
  console.log(`  arrayBuffers: ${formatMB(usage.arrayBuffers)}`);// Total ArrayBuffers
}

// rss vs heapUsed difference
// rss (Resident Set Size): total physical memory the process is using
//   → V8 heap + C++ objects + native addons + stack
// heapUsed: memory for JavaScript objects managed by V8
//   → a subset of rss

// Usage: measure memory delta before and after processing
async function measureMemoryImpact(fn) {
  // Force GC to stabilize baseline
  if (global.gc) global.gc();

  const before = process.memoryUsage();
  await fn();

  if (global.gc) global.gc();

  const after = process.memoryUsage();

  const delta = {
    rss: after.rss - before.rss,
    heapTotal: after.heapTotal - before.heapTotal,
    heapUsed: after.heapUsed - before.heapUsed,
    external: after.external - before.external,
  };

  const formatMB = (bytes) => {
    const mb = bytes / 1024 / 1024;
    return (mb >= 0 ? "+" : "") + mb.toFixed(2) + " MB";
  };

  console.log("Memory impact:");
  console.log(`  rss:       ${formatMB(delta.rss)}`);
  console.log(`  heapUsed:  ${formatMB(delta.heapUsed)}`);
  console.log(`  external:  ${formatMB(delta.external)}`);

  return delta;
}
```

### 7.3 Memory Characteristics of Buffer and ArrayBuffer

Node.js Buffer can be allocated outside the V8 heap (external memory). This results in memory consumption that is not reflected in `heapUsed`.

```javascript
// Confirming memory characteristics of Buffer
function demonstrateBufferMemory() {
  printMemoryUsage("Before");

  // Buffer.alloc: allocated in external memory
  const buf1 = Buffer.alloc(50 * 1024 * 1024); // 50MB
  printMemoryUsage("After Buffer.alloc(50MB)");
  // → external increases, heapUsed barely changes

  // Normal array: allocated in V8 heap
  const arr = new Array(5 * 1024 * 1024).fill(0);
  printMemoryUsage("After Array(5M)");
  // → heapUsed increases
}
```

---

## 8. Memory Management Best Practices by Framework

### 8.1 Memory Management in React

```javascript
// Code example 11: Memory leak countermeasures in React components

import { useState, useEffect, useRef, useCallback } from "react";

// Anti-pattern: updating state after unmount
function LeakyComponent({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Problem: calling setUser after unmount causes memory leak + warning
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]);

  return <div>{user?.name}</div>;
}

// Fixed version: AbortController + cleanup
function SafeComponent({ userId }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchUser() {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          signal: controller.signal
        });
        const data = await res.json();
        setUser(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err);
        }
      }
    }

    fetchUser();

    return () => {
      controller.abort(); // Cancel request on unmount
    };
  }, [userId]);

  if (error) return <div>Error: {error.message}</div>;
  return <div>{user?.name}</div>;
}

// WebSocket cleanup
function useWebSocket(url) {
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      setMessages(prev => {
        // Memory limit: keep only the latest 1000 messages
        const updated = [...prev, JSON.parse(event.data)];
        return updated.slice(-1000);
      });
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close(); // Close connection on unmount
      wsRef.current = null;
    };
  }, [url]);

  const send = useCallback((data) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { messages, send };
}

// IntersectionObserver cleanup
function useLazyLoad(ref) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element); // Stop watching once visible
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect(); // Cleanup
    };
  }, [ref]);

  return isVisible;
}
```

### 8.2 Memory Management in Vue.js

```javascript
// Memory management with Vue 3 Composition API
import { ref, onMounted, onBeforeUnmount, watch } from "vue";

export function usePolling(fetchFn, intervalMs = 5000) {
  const data = ref(null);
  const error = ref(null);
  let timerId = null;
  let abortController = null;

  async function poll() {
    abortController = new AbortController();
    try {
      data.value = await fetchFn({ signal: abortController.signal });
    } catch (err) {
      if (err.name !== "AbortError") {
        error.value = err;
      }
    }
  }

  onMounted(() => {
    poll();
    timerId = setInterval(poll, intervalMs);
  });

  onBeforeUnmount(() => {
    // Ensure cleanup
    if (timerId) clearInterval(timerId);
    if (abortController) abortController.abort();
  });

  return { data, error };
}
```

---

## 9. Memory Monitoring Strategy for Production Environments

### 9.1 Setting a Memory Budget

Just like performance budgets, it is important to set budgets for memory consumption and monitor them continuously.

| Metric | Recommended Limit (Mobile) | Recommended Limit (Desktop) | Measurement Method |
|--------|--------------------------|---------------------------|-------------------|
| JS Heap (after initial load) | 30 MB | 80 MB | `performance.memory.usedJSHeapSize` |
| JS Heap (peak) | 80 MB | 200 MB | Heap Snapshot |
| DOM node count | 800 | 1500 | `document.querySelectorAll("*").length` |
| JS event listener count | 200 | 500 | DevTools > Elements > Event Listeners |
| Detached DOM nodes | 0 | 0 | Search "Detached" in Heap Snapshot |

### 9.2 Automated Leak Detection Testing

```javascript
// Code example 12: Automated memory leak detection with Puppeteer

const puppeteer = require("puppeteer");

async function detectMemoryLeak(url, action, iterations = 10) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle0" });

  // Warmup: exclude first few runs from measurement
  for (let i = 0; i < 3; i++) {
    await action(page);
  }

  // Run GC to get baseline
  await page.evaluate(() => {
    if (window.gc) window.gc();
  });

  const memorySnapshots = [];

  for (let i = 0; i < iterations; i++) {
    await action(page);

    // Force GC
    await page.evaluate(() => {
      if (window.gc) window.gc();
    });

    // Record memory usage
    const metrics = await page.metrics();
    memorySnapshots.push({
      iteration: i,
      jsHeapUsedSize: metrics.JSHeapUsedSize,
      jsHeapTotalSize: metrics.JSHeapTotalSize,
      documents: metrics.Documents,
      nodes: metrics.Nodes,
      jsEventListeners: metrics.JSEventListeners,
    });
  }

  await browser.close();

  // Leak determination: is memory monotonically increasing?
  const heapValues = memorySnapshots.map(s => s.jsHeapUsedSize);
  const firstHalf = heapValues.slice(0, Math.floor(heapValues.length / 2));
  const secondHalf = heapValues.slice(Math.floor(heapValues.length / 2));

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const leakDetected = avgSecond > avgFirst * 1.1; // More than 10% increase

  return {
    leakDetected,
    snapshots: memorySnapshots,
    averageFirstHalf: (avgFirst / 1024 / 1024).toFixed(2) + " MB",
    averageSecondHalf: (avgSecond / 1024 / 1024).toFixed(2) + " MB",
    growth: ((avgSecond - avgFirst) / avgFirst * 100).toFixed(1) + "%",
  };
}

// Usage:
// const result = await detectMemoryLeak(
//   "http://localhost:3000",
//   async (page) => {
//     await page.click("#open-modal");
//     await page.waitForSelector(".modal");
//     await page.click("#close-modal");
//     await page.waitForSelector(".modal", { hidden: true });
//   },
//   20
// );
// console.log("Leak detected:", result.leakDetected);
```

---

## 10. Exercises

### Exercise 1 (Beginner): Identifying Memory Leaks

Identify all memory leaks in the following code and fix them.

```javascript
// Exercise 1: Fix the memory leaks in the following code

class ChatRoom {
  constructor() {
    this.messages = [];
    this.subscribers = [];

    // (A) Resize handler
    window.addEventListener("resize", () => {
      this.adjustLayout();
    });

    // (B) Message polling
    setInterval(async () => {
      const newMessages = await fetch("/api/messages").then(r => r.json());
      this.messages.push(...newMessages);
      this.render();
    }, 3000);
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  adjustLayout() {
    // Layout adjustment processing
  }

  render() {
    this.subscribers.forEach(cb => cb(this.messages));
  }

  destroy() {
    // Does nothing!
  }
}
```

<details>
<summary>Example Answer (click to expand)</summary>

```javascript
class ChatRoomFixed {
  constructor() {
    this.messages = [];
    this.subscribers = [];
    this.abortController = new AbortController();

    // (A) Fix: managed with AbortController
    window.addEventListener("resize", () => {
      this.adjustLayout();
    }, { signal: this.abortController.signal });

    // (B) Fix: retain intervalId + message limit
    this.pollingId = setInterval(async () => {
      try {
        const res = await fetch("/api/messages", {
          signal: this.abortController.signal
        });
        const newMessages = await res.json();
        this.messages.push(...newMessages);

        // Set a message limit (prevent unlimited memory growth)
        if (this.messages.length > 1000) {
          this.messages = this.messages.slice(-500);
        }

        this.render();
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Polling failed:", err);
        }
      }
    }, 3000);
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    // Return an unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index !== -1) this.subscribers.splice(index, 1);
    };
  }

  adjustLayout() { /* ... */ }

  render() {
    this.subscribers.forEach(cb => cb(this.messages));
  }

  destroy() {
    // Bulk-remove all listeners
    this.abortController.abort();
    // Stop timer
    clearInterval(this.pollingId);
    // Clear references
    this.messages = [];
    this.subscribers = [];
  }
}
```

**Issues identified:**
1. An anonymous function is used with `window.addEventListener`, which cannot be `removeEventListener`'d → manage with AbortController
2. The return value of `setInterval` is not retained, so `clearInterval` cannot be called → retain as `this.pollingId`
3. `this.messages` grows without limit → set a limit and delete old messages
4. There is no way to unregister the `callback` registered with `subscribe` → return an unsubscribe function
5. `destroy()` is empty → reliably release all resources

</details>

### Exercise 2 (Intermediate): Analyzing Heap Snapshots

Obtain a Heap Snapshot in the following scenario and identify the cause of the leak.

```
Scenario:
1. Display a user list page in an SPA
2. Open and close a user detail modal 10 times
3. Memory increases with each open/close and is not released

Steps:
(a) Open the DevTools Memory tab and take the initial snapshot
(b) Open and close the modal 10 times
(c) Force GC by clicking the trash icon
(d) Take a second snapshot
(e) Analyze with the Comparison view

Key points to look for:
- Search for "Detached" → detached DOM nodes
- Large positive #Delta values → leak candidates
- Check retention chains in the Retainers panel
- Look for EventListeners or closures as retainers
```

**Verification checklist:**

| Item | Expected Value | Tendency When Leaking |
|------|---------------|----------------------|
| Detached HTMLDivElement | 0 | Increases proportionally to modal open/close count |
| (closure) | Stable | New closures accumulate with each open/close |
| EventListener count | Stable | Increases with each open/close |
| Array entries | Stable | DOM references accumulate in internal array |

### Exercise 3 (Advanced): Designing a Memory-Safe Cache System

Design and implement a cache system meeting the following requirements.

**Requirements:**
1. LRU (Least Recently Used) method with a maximum entry count limit
2. Individual entries can have a TTL (Time To Live)
3. Automatically reduce entries under memory pressure
4. Provide cache hit rate statistics

<details>
<summary>Example Answer (click to expand)</summary>

```javascript
class MemorySafeCache {
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 1000;
    this.defaultTTL = options.defaultTTL || 60000; // 60 seconds
    this.pressureThreshold = options.pressureThreshold || 0.8; // 80%

    // Map for LRU (preserves insertion order)
    this.cache = new Map();

    // Statistics
    this.stats = { hits: 0, misses: 0, evictions: 0, expired: 0 };

    // Memory pressure monitoring
    this.startMemoryMonitoring();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // TTL check
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.expired++;
      this.stats.misses++;
      return undefined;
    }

    // LRU: move accessed entry to end
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  set(key, value, ttl = this.defaultTTL) {
    // Delete existing entry if it exists (update)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Size limit check
    while (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      size: this.estimateSize(value),
    });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  evictOldest() {
    // Delete the first entry (oldest) in Map
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  evictPercent(percent) {
    const count = Math.ceil(this.cache.size * percent);
    for (let i = 0; i < count; i++) {
      this.evictOldest();
    }
  }

  estimateSize(value) {
    // Rough size estimation
    if (typeof value === "string") return value.length * 2;
    if (typeof value === "number") return 8;
    if (value === null || value === undefined) return 0;
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024; // Default when estimation is not possible
    }
  }

  startMemoryMonitoring() {
    if (typeof performance !== "undefined" && performance.memory) {
      this.monitorId = setInterval(() => {
        const ratio =
          performance.memory.usedJSHeapSize /
          performance.memory.jsHeapSizeLimit;
        if (ratio > this.pressureThreshold) {
          console.warn(
            `[Cache] Memory pressure detected (${(ratio * 100).toFixed(1)}%), evicting 25% of entries`
          );
          this.evictPercent(0.25);
        }
      }, 5000);
    }
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + "%" : "N/A",
    };
  }

  destroy() {
    if (this.monitorId) clearInterval(this.monitorId);
    this.cache.clear();
  }
}
```

</details>

---

## 11. Frequently Asked Questions (FAQ)

### Q1: Can garbage collection be triggered manually?

In browser environments, the `gc()` function is not normally available. You can trigger manual GC by clicking the trash icon in the Memory panel of Chrome DevTools, but this is limited to debugging purposes.

In Node.js, starting with the `--expose-gc` flag makes `global.gc()` available. However, frequent manual GC in production is not recommended. V8's GC scheduler uses heuristics to run GC at optimal times, and manual intervention can degrade performance.

```javascript
// Node.js: requires --expose-gc flag
if (global.gc) {
  global.gc(); // Runs Minor GC + Major GC
} else {
  console.warn("GC is not exposed. Run with --expose-gc flag.");
}
```

### Q2: What is the difference between a memory leak and memory bloat?

**Memory leak**: A phenomenon where unnecessary objects are unintentionally retained, causing memory usage to monotonically increase. GC cannot collect them because references from GC roots remain.

**Memory bloat**: A phenomenon where an application legitimately requires too much memory by design. Not a leak, but it negatively affects performance.

| Property | Memory Leak | Memory Bloat |
|----------|------------|-------------|
| Memory trend | Monotonically increases (worsens over time) | High but stable |
| GC | Unreachable objects accumulate | GC operates normally |
| Cause | Bug (forgotten reference release) | Design issue (inefficient data structures) |
| Countermeasure | Release references, remove listeners | Optimize data structures, virtualize, lazy load |
| Detection | Heap Snapshot Comparison | Performance Monitor JS Heap Size |

### Q3: Which should I use, WeakMap or regular Map?

**Use Map when:**
- Keys are primitive values (strings, numbers) → WeakMap only supports object keys
- Key enumeration is needed → WeakMap has no `keys()`, `values()`, `entries()`
- You want explicit cache size management

**Use WeakMap when:**
- Associating metadata with DOM elements
- You want additional object data to follow the object's lifecycle
- Storing private data (inaccessible from outside)
- Caches where you want to avoid memory leaks

```javascript
// WeakMap is ideal: attaching metadata to DOM elements
const tooltipData = new WeakMap();

function setTooltip(element, text) {
  tooltipData.set(element, { text, visible: false });
  // When element is removed from DOM and GC'd, the tooltipData entry also disappears
}

// Map is ideal: cache with string keys
const apiCache = new Map();

function cacheResponse(url, data) {
  apiCache.set(url, { data, timestamp: Date.now() });
  // Explicit size management is possible
  if (apiCache.size > 100) {
    const oldestKey = apiCache.keys().next().value;
    apiCache.delete(oldestKey);
  }
}
```

### Q4: Where is memory for ArrayBuffer and TypedArray allocated?

The backing store of ArrayBuffer is allocated outside the V8 heap (external memory). However, the ArrayBuffer object itself exists on the V8 heap.

```javascript
// ArrayBuffer: backing store in external memory
const buffer = new ArrayBuffer(1024 * 1024); // 1MB
// → V8 heap: ArrayBuffer object (~100 bytes)
// → external memory: 1MB contiguous memory block

// SharedArrayBuffer: can be shared between multiple Workers
const shared = new SharedArrayBuffer(1024);
// → Shares memory between Web Workers
// → Requires Cross-Origin Isolation (COOP + COEP)

// TypedArray: a view of ArrayBuffer, does not consume additional memory
const view1 = new Uint8Array(buffer);        // References the entire buffer
const view2 = new Float64Array(buffer, 0, 128); // References a portion of buffer
// → view1 and view2 share the same buffer memory
```

### Q5: How does using Web Workers change memory management?

Each Web Worker has an independent V8 instance and heap. Data transfer between Workers is done either by copying (Structured Clone) or by transferring ownership (Transferable objects).

```javascript
// Main thread
const worker = new Worker("worker.js");

// Copy transfer: data is duplicated (original is retained)
const data = new Uint8Array(1024 * 1024);
worker.postMessage({ type: "process", data: data });
// → A copy of data is sent to Worker (memory temporarily doubles)

// Ownership transfer (Transfer): moves data without copying
const buffer = new ArrayBuffer(1024 * 1024);
worker.postMessage({ type: "process", buffer: buffer }, [buffer]);
// → Ownership of buffer is transferred to Worker
// → buffer.byteLength on the main thread side becomes 0 (unusable)
// → No memory duplication occurs
```

### Q6: How do I detect memory leaks? (Chrome DevTools)

Systematic memory leak detection using the Chrome DevTools Memory panel:

**Step 1: Get a baseline**
1. Reload the page to the initial state
2. Memory panel → Take Heap snapshot (Snapshot 1)

**Step 2: Perform operations**
3. Execute suspected leaking operations (e.g., open and close a modal, page navigation, data loading)
4. Repeat the operations (5~10 times)

**Step 3: Comparative analysis**
5. Take another Heap snapshot (Snapshot 2)
6. Select Snapshot 2 and change the display mode to "Comparison"
7. Check "Objects allocated between Snapshot 1 and Snapshot 2"

**Step 4: Identify the leak**
```
How to read the Comparison view:
- New: number of newly created objects
- Deleted: number of deleted objects
- Delta: New - Deleted (large positive value may indicate a leak)
- Size Delta: amount of memory increase
```

Typical signs of a leak:
- Delta stays large and positive
- DOM nodes like Detached HTMLDivElement remain
- Arrays or Objects increase indefinitely

**Step 5: Analyze the Retainers path**
8. Select the increasing object
9. Check the reference chain from the GC root in the "Retainers" panel
10. Identify and fix unintentional references

```javascript
// Detection example: forgotten event listener removal
class ComponentWithLeak {
  constructor() {
    this.data = new Array(10000).fill(0);
    // Problem: not calling removeEventListener
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  handleResize() { /* ... */ }
}

// Heap Snapshot Retainers:
// GC root → Window → listeners → resize → Function → ComponentWithLeak → data
//                                                       ^^^^^^^^^^^^^^^^
//                                                       Leak occurs here
```

### Q7: How can I prevent memory leaks from closures?

Closures are convenient but can cause memory leaks by continuing to capture unnecessary external variables.

**Problem pattern 1: Unintentionally capturing large objects**
```javascript
function createProcessor() {
  const hugeData = new Array(1000000).fill(Math.random()); // 8MB
  const metadata = { size: hugeData.length, created: Date.now() };

  // Problem: want to use only metadata, but hugeData is also captured
  return function() {
    console.log(`Processed ${metadata.size} items`);
  };
}

const process = createProcessor();
// → hugeData is defined in the function scope and continues to be captured
//   by the returned function as a closure
//   (8MB is not freed as long as process is alive)
```

**Solution 1: Extract only needed values**
```javascript
function createProcessor() {
  const hugeData = new Array(1000000).fill(Math.random());
  const size = hugeData.length; // Extract the primitive value
  const created = Date.now();

  // hugeData goes out of scope here and becomes a GC candidate

  return function() {
    console.log(`Processed ${size} items at ${created}`);
  };
  // → Closure captures only size and created (~16 bytes)
}
```

**Problem pattern 2: Capturing this in event handlers**
```javascript
class DataGrid {
  constructor(data) {
    this.data = data; // Large amounts of data
    this.renderCache = new Map();

    // Problem: implicitly captures this with arrow function
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refresh(); // this.data is also captured
    });
  }

  refresh() {
    this.renderCache.clear();
    // ... re-render processing
  }

  destroy() {
    // Problem: event listener is not removed
    // → this (and this.data) cannot be freed
  }
}
```

**Solution 2: Explicit cleanup**
```javascript
class DataGrid {
  constructor(data) {
    this.data = data;
    this.renderCache = new Map();

    // Solution: retain reference to the handler
    this.handleRefresh = () => this.refresh();
    this.refreshBtn = document.getElementById('refresh-btn');
    this.refreshBtn.addEventListener('click', this.handleRefresh);
  }

  refresh() {
    this.renderCache.clear();
  }

  destroy() {
    // Properly remove listener
    this.refreshBtn.removeEventListener('click', this.handleRefresh);
    this.handleRefresh = null; // Also cut the reference
    this.data = null; // Also explicitly free the large data
    this.renderCache.clear();
  }
}
```

**Problem pattern 3: Capturing in timer callbacks**
```javascript
function startPolling(url) {
  const history = []; // Result history

  const intervalId = setInterval(async () => {
    const result = await fetch(url).then(r => r.json());
    history.push(result); // Accumulates indefinitely
    processResult(result);
  }, 5000);

  return () => clearInterval(intervalId);
  // Problem: history persists even after clearInterval
}
```

**Solution 3: Set a limit with a ring buffer**
```javascript
function startPolling(url, maxHistory = 10) {
  const history = [];

  const intervalId = setInterval(async () => {
    const result = await fetch(url).then(r => r.json());

    // Delete old ones when limit is exceeded
    if (history.length >= maxHistory) {
      history.shift();
    }
    history.push(result);

    processResult(result);
  }, 5000);

  return () => {
    clearInterval(intervalId);
    history.length = 0; // Also clear the array
  };
}
```

**Best practices:**
1. Be aware of the variables a closure captures (can verify in DevTools Scope panel)
2. Extract only needed values from large data before returning the function
3. Always implement cleanup for event listeners and timers
4. Set limits on arrays/Maps that grow indefinitely

### Q8: What is the memory management strategy for large-scale SPAs?

Single Page Applications run for long periods, making memory management especially important.

**Strategy 1: Cleanup on page navigation**
```javascript
// React example
function UserProfile({ userId }) {
  useEffect(() => {
    // Start data subscription
    const subscription = userService.subscribe(userId, handleUpdate);
    const timerId = setInterval(refreshData, 30000);

    // Cleanup function: runs when component unmounts
    return () => {
      subscription.unsubscribe(); // Unsubscribe
      clearInterval(timerId);     // Clear timer
      userService.clearCache(userId); // Clear cache
    };
  }, [userId]);

  // ... component body
}
```

**Strategy 2: Handle large data with virtualization**
```javascript
// Problem: render 100,000 list items all as DOM
function HugeList({ items }) {
  return (
    <div>
      {items.map(item => <ListItem key={item.id} {...item} />)}
      {/* 100,000 DOM nodes → memory bloat */}
    </div>
  );
}

// Solution: virtualization with react-window
import { FixedSizeList } from 'react-window';

function VirtualizedList({ items }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <ListItem {...items[index]} />
        </div>
      )}
    </FixedSizeList>
    // Only renders what is visible on screen (e.g., 15 items)
    // → Memory usage reduced by thousands of times
  );
}
```

**Strategy 3: Set and monitor memory budget**
```javascript
class MemoryBudgetMonitor {
  constructor(budgetMB = 150) {
    this.budgetBytes = budgetMB * 1024 * 1024;
    this.warningThreshold = this.budgetBytes * 0.8;
    this.startMonitoring();
  }

  async checkMemory() {
    if ('memory' in performance) {
      const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;

      if (usedJSHeapSize > this.budgetBytes) {
        console.error(`Memory budget exceeded: ${(usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`);
        this.triggerEmergencyCleanup();
      } else if (usedJSHeapSize > this.warningThreshold) {
        console.warn(`Memory warning: ${(usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`);
        this.triggerSoftCleanup();
      }
    }
  }

  triggerSoftCleanup() {
    // Clear low-priority caches
    imageCache.evictOldest(50);
    dataCache.trim(100);
  }

  triggerEmergencyCleanup() {
    // Clear all caches
    imageCache.clear();
    dataCache.clear();

    // Notify user
    showNotification("Some data was cleared due to low memory");
  }

  startMonitoring() {
    setInterval(() => this.checkMemory(), 30000); // Every 30 seconds
  }
}

const monitor = new MemoryBudgetMonitor(150); // Budget 150MB
```

**Strategy 4: Cache expiry and limits**
```javascript
class BoundedCache {
  constructor(maxSize = 100, maxAge = 5 * 60 * 1000) { // 5 minutes
    this.cache = new Map();
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  set(key, value) {
    // Limit check: LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Expiry check
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  prune() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }
}
```

**Strategy 5: Offload to Web Worker**
```javascript
// Main thread
const worker = new Worker('heavy-processor.js');

worker.postMessage({
  type: 'processLargeDataset',
  data: hugeDataset
}, [hugeDataset.buffer]); // Transfer ownership with Transferable

worker.onmessage = (e) => {
  const result = e.data;
  updateUI(result); // Receive only the result
};

// heavy-processor.js (Worker)
self.onmessage = (e) => {
  const { type, data } = e.data;

  if (type === 'processLargeDataset') {
    const result = processData(data); // Heavy processing
    self.postMessage(result);
    // Processed on Worker heap, no impact on main thread
  }
};
```

**Strategy 6: Periodic page reload (last resort)**
```javascript
// For long-running dashboards, etc.
class AutoReloadManager {
  constructor(maxUptimeHours = 8) {
    this.maxUptime = maxUptimeHours * 60 * 60 * 1000;
    this.startTime = Date.now();
    this.checkInterval = setInterval(() => this.checkUptime(), 60000); // Every minute
  }

  checkUptime() {
    const uptime = Date.now() - this.startTime;

    if (uptime > this.maxUptime) {
      // Notify user and reload
      if (confirm("The application will be refreshed to the latest state. OK?")) {
        location.reload();
      }
    }
  }
}

// Suggest auto-reload after 8 hours
const reloadManager = new AutoReloadManager(8);
```

**Checklist:**
- [ ] Implement component cleanup functions
- [ ] Virtualize large amounts of data (react-window, virtual-scroller, etc.)
- [ ] Set a memory budget and fire alerts when exceeded
- [ ] Set limits and expiry for caches
- [ ] Offload heavy processing to Web Workers
- [ ] Automate memory leak tests in E2E tests
- [ ] Consider periodic reloads for long-running apps

---

## 12. Anti-Pattern Collection

### Anti-Pattern 1: Arrays/Maps That Grow Without Limit

```javascript
// Problem: event logs accumulate without limit
class EventLogger {
  constructor() {
    this.events = []; // No limit!
  }

  log(event) {
    this.events.push({
      ...event,
      timestamp: Date.now(),
      stack: new Error().stack // Also retains stack trace → high memory consumption
    });
  }
}

// Countermeasure: use a ring buffer
class BoundedEventLogger {
  constructor(maxSize = 1000) {
    this.events = new Array(maxSize);
    this.maxSize = maxSize;
    this.index = 0;
    this.count = 0;
  }

  log(event) {
    this.events[this.index] = {
      ...event,
      timestamp: Date.now()
      // stack omitted in production
    };
    this.index = (this.index + 1) % this.maxSize;
    this.count = Math.min(this.count + 1, this.maxSize);
  }

  getRecent(n = 10) {
    const result = [];
    let idx = (this.index - 1 + this.maxSize) % this.maxSize;
    for (let i = 0; i < Math.min(n, this.count); i++) {
      result.push(this.events[idx]);
      idx = (idx - 1 + this.maxSize) % this.maxSize;
    }
    return result;
  }
}
```

### Anti-Pattern 2: Forgetting to disconnect MutationObserver

```javascript
// Problem: observer is never disconnected
function watchDOMChanges(target) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      processMutation(mutation); // mutation contains many DOM references
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  // If disconnect is not called, even after target is removed from DOM,
  // the observer continues to hold internal references
}

// Countermeasure: always call disconnect
function watchDOMChangesSafe(target) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      processMutation(mutation);
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
  });

  // Return a cleanup function
  return () => {
    observer.disconnect();
  };
}

// React usage example
function useObserveDOMChanges(ref, callback) {
  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new MutationObserver(callback);
    observer.observe(ref.current, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [ref, callback]);
}
```

---

## 13. Memory Management Checklist

### Development Phase

- [ ] Enable `"use strict"` or ESLint's `no-implicit-globals` rule
- [ ] Retain return values of `setInterval` / `setTimeout` and call `clear*` in cleanup
- [ ] Pair `addEventListener` with corresponding `removeEventListener` or AbortController
- [ ] Minimize closure capture variables (define functions in separate scopes)
- [ ] When holding DOM references in JS variables, assign null when the DOM is removed
- [ ] Set maximum sizes on arrays and Maps
- [ ] Do not pass large objects to `console.log` (remove in production)

### Testing Phase

- [ ] Conduct leak detection tests with Chrome DevTools Heap Snapshot Comparison
- [ ] Incorporate automated memory leak detection with Puppeteer / Playwright into CI
- [ ] Check memory trends during long-running operation with Performance Monitor
- [ ] Check memory consumption on mobile devices (stricter memory constraints)

### Production Operation Phase

- [ ] Monitor memory with `performance.measureUserAgentSpecificMemory()` or RUM tools
- [ ] Set a memory budget and fire alerts when exceeded
- [ ] Consider periodic page reloads for long-running SPAs

---

## FAQ

### Q1: What should I check first when a memory leak is suspected?
Start by monitoring the "JS Heap Size" trend in Chrome DevTools Performance Monitor panel. If heap size monotonically increases when repeating specific operations (page navigation, dialog open/close, list manipulation, etc.), a memory leak is likely. Next, get Heap Snapshots before and after the operation in the Memory panel and identify the increasing objects with the Comparison view. Detached DOM nodes, unremoved event listeners, and unintentional reference retention by closures are the main causes.

### Q2: What are the criteria for choosing between WeakMap and Map?
Use WeakMap when storing metadata that depends on the lifecycle of the object serving as the key. For example, it is suitable for caching data associated with DOM elements or for storing per-object private data. WeakMap keys can be GC'd, so key enumeration and the `.size` property are unavailable. On the other hand, use a regular Map when you need to enumerate keys, when you want primitive values as keys, or when you want the Map to guarantee the existence of keys.

### Q3: What are common remedies when memory keeps increasing in an SPA?
Since pages are not reloaded during navigation in SPAs (Single Page Applications), memory tends to accumulate. Effective measures include: (1) ensure cleanup of timers (setInterval), WebSocket connections, and event listeners when components unmount; (2) use AbortController to bulk-remove fetch requests and event listeners; (3) set LRU (Least Recently Used) limits on caches that hold large amounts of data; (4) use `performance.measureUserAgentSpecificMemory()` to periodically monitor memory usage even in production.

---

## Summary

| Concept | Key Points |
|---------|-----------|
| Memory model | Two-layer structure: stack (primitives + references) and heap (objects) |
| V8 heap | Generational structure: New Space (Scavenge) and Old Space (Mark-Sweep/Compact) |
| GC algorithms | Minor GC (Scavenge, ms-level) and Major GC (Mark-Sweep, incremental) |
| Leak patterns | Timers, listeners, closures, Detached DOM, console.log |
| Weak references | WeakMap/WeakRef for references that don't prevent GC |
| DevTools | Heap Snapshot Comparison view is the decisive tool for leak detection |
| Production monitoring | Setting memory budgets and incorporating automated tests |

---

## Guides to Read Next

- [DOM API](../03-web-apis/00-dom-api.md)
- Event Model
- Event Loop

---

## References

1. V8 Team. "Trash talk: the Orinoco garbage collector." V8 Blog, 2019. https://v8.dev/blog/trash-talk
2. Google. "Fix memory problems." Chrome DevTools Documentation, 2024. https://developer.chrome.com/docs/devtools/memory-problems
3. Nicol Ribaudo. "TC39 Proposal: Explicit Resource Management." TC39, 2024. https://github.com/tc39/proposal-explicit-resource-management
4. Addy Osmani. "Memory Management Reference." 2012.
5. MDN Web Docs. "Memory management." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management
6. Lin Clark. "A Cartoon Intro to ArrayBuffers and SharedArrayBuffers." Mozilla Hacks, 2017.
