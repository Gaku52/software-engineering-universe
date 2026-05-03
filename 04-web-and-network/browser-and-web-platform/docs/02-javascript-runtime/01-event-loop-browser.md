# Browser Event Loop

> The browser event loop is the core of the JavaScript execution model. A precise understanding of the execution order of the task queue, microtask queue, requestAnimationFrame, and requestIdleCallback dramatically simplifies performance optimization and debugging. This guide explains the accurate model conforming to the WHATWG HTML Living Standard, with abundant code examples, diagrams, and exercises.

---

## Table of Contents

1. [What You Will Learn](#what-you-will-learn)
2. [Prerequisites](#prerequisites)
3. [Overall Structure of the Event Loop](#1-overall-structure-of-the-event-loop)
4. [Tasks (Macrotasks) in Detail](#2-tasks-macrotasks-in-detail)
5. [Microtasks in Detail](#3-microtasks-in-detail)
6. [Tasks vs. Microtasks Comparison](#4-tasks-vs-microtasks-comparison)
7. [requestAnimationFrame (rAF)](#5-requestanimationframe-raf)
8. [requestIdleCallback (rIC)](#6-requestidlecallback-ric)
9. [Scheduling API Comparison Table](#7-scheduling-api-comparison-table)
10. [Integrated Execution Order Model](#8-integrated-execution-order-model)
11. [Code Examples](#9-code-examples)
12. [Anti-Patterns](#10-anti-patterns)
13. [Edge Case Analysis](#11-edge-case-analysis)
14. [Staged Exercises](#12-staged-exercises)
15. [FAQ](#13-faq)
16. [Glossary](#14-glossary)
17. [Summary](#summary)
18. [Guides to Read Next](#guides-to-read-next)
19. [References](#references)

---

## What You Will Learn

- [ ] Understand how the browser event loop is defined in the WHATWG specification
- [ ] Accurately predict the execution order of macrotasks and microtasks
- [ ] Learn the timing and usage of requestAnimationFrame (rAF)
- [ ] Learn design techniques for low-priority processing with requestIdleCallback (rIC)
- [ ] Understand how to choose the right scheduling API for each situation
- [ ] Grasp the relationship between the rendering pipeline and the event loop
- [ ] Recognize and avoid typical anti-patterns
- [ ] Predict behavior in edge cases

---

## Prerequisites

To get the most out of this guide, the following knowledge is recommended.

| Field | Required Level | Reference |
|-------|---------------|-----------|
| JavaScript basics | Understanding of call stack and scope chain | JS Basics Guide |
| Promise / async-await | Ability to write basic asynchronous code | Async Processing Guide |
| DOM API | addEventListener, querySelector, etc. | DOM Manipulation Guide |
| Browser rendering | Concepts of layout and paint | Rendering Guide |

---

## 1. Overall Structure of the Event Loop

### 1.1 Model Based on the WHATWG Specification

The event loop is the mechanism by which a browser cooperatively processes tasks such as user interactions, script execution, rendering, and network handling. The WHATWG HTML Living Standard (Section 8.1.7) strictly defines the processing steps performed in each cycle of the event loop.

```
┌─────────────────────────────────────────────────────────────────┐
│                  One Cycle of the Event Loop                    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Step 1: Retrieve the oldest task from the task queue      │  │
│  │         and execute it (skip if queue is empty)           │  │
│  │                                                           │  │
│  │  Examples of tasks:                                       │  │
│  │   - setTimeout / setInterval callbacks                    │  │
│  │   - I/O callbacks (fetch, XMLHttpRequest completion)      │  │
│  │   - UI event dispatch (click, keydown, etc.)              │  │
│  │   - MessageChannel onmessage                              │  │
│  │   - history.back() / history.forward() navigation        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Step 2: Microtask checkpoint                              │  │
│  │         Repeatedly execute until the microtask queue      │  │
│  │         is empty                                          │  │
│  │                                                           │  │
│  │  Examples of microtasks:                                  │  │
│  │   - Promise then / catch / finally callbacks              │  │
│  │   - Functions registered with queueMicrotask()           │  │
│  │   - MutationObserver callbacks                            │  │
│  │   - Continuation after await in async functions           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Step 3: Rendering update (when browser deems necessary)   │  │
│  │                                                           │  │
│  │  3a. Fire resize / scroll events                          │  │
│  │  3b. Execute requestAnimationFrame callbacks              │  │
│  │  3c. IntersectionObserver callbacks                       │  │
│  │  3d. Style recalculation (Recalculate Style)              │  │
│  │  3e. Layout (Reflow)                                      │  │
│  │  3f. Paint                                                │  │
│  │  3g. Composite                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Step 4: Idle period processing (if time allows)           │  │
│  │         Execute requestIdleCallback callbacks             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│                    Return to ① (next cycle)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Principles

The event loop design rests on the following fundamental principles.

**Single-thread principle**: There is only one main JavaScript thread, and only one task can execute at a time. This means data races on shared state cannot occur in principle. On the other hand, long-running tasks cause the UI to freeze (jank).

**Cooperative multitasking**: The event loop is not preemptive (forcible interruption); each task voluntarily returns control to give other tasks a chance to run. This is a form of cooperative multitasking, and task designers must be aware of the frame budget (typically 16.67ms = 1/60fps).

**Task granularity control**: Tasks are executed one at a time, but microtasks are all executed at each checkpoint. This difference is intentional design; microtasks are treated as a "logical extension of the current task."

### 1.3 Types of Event Loops

The WHATWG specification defines the following types of event loops.

| Type | Context | Characteristics |
|------|---------|----------------|
| Window event loop | Browser tab / iframe | Full loop including rendering updates |
| Worker event loop | Web Worker / Service Worker | No rendering step |
| Worklet event loop | AudioWorklet, PaintWorklet | Restricted API set |

This guide focuses primarily on the most common **Window event loop**. Worker event loops are covered in a separate guide.

---

## 2. Tasks (Macrotasks) in Detail

### 2.1 Task Sources and Task Queues

According to the specification, an event loop can have multiple task queues. Each task is generated from a specific "task source," and tasks from the same source are guaranteed to be ordered. However, the priority between different task sources is left to the browser implementation.

```
Internal structure of task queues (conceptual diagram):

 ┌──────────────────────────────────────────────────────┐
 │ Event Loop                                           │
 │                                                      │
 │  ┌─────────────────────────┐                         │
 │  │ Task Queue A            │  ← For UI events        │
 │  │ [click_cb] [scroll_cb]  │                         │
 │  └─────────────────────────┘                         │
 │                                                      │
 │  ┌─────────────────────────┐                         │
 │  │ Task Queue B            │  ← For timers           │
 │  │ [timeout1] [interval2]  │                         │
 │  └─────────────────────────┘                         │
 │                                                      │
 │  ┌─────────────────────────┐                         │
 │  │ Task Queue C            │  ← For network          │
 │  │ [fetch_cb] [xhr_cb]     │                         │
 │  └─────────────────────────┘                         │
 │                                                      │
 │  The browser can freely choose which queue to        │
 │  pick from each cycle (priority is browser-specific) │
 └──────────────────────────────────────────────────────┘
```

### 2.2 List of Major Task Sources

| Task Source | When Generated | Notes |
|-------------|----------------|-------|
| DOM manipulation | Programmatic `element.click()` calls | Treated differently from user actions |
| User interaction | Click, key input, scroll | Browser tends to give high priority |
| Network | fetch / XHR completion | Queued when response arrives |
| Navigation | `history.pushState()`, etc. | Processing for page transitions |
| Timer | `setTimeout`, `setInterval` | Note that delay is not guaranteed |
| MessageChannel | `port.postMessage()` | Also used for Worker communication |
| IndexedDB | On transaction completion | Result notification for async DB operations |

### 2.3 Specification for setTimeout Delay

Even writing `setTimeout(fn, 0)` does not mean it will actually execute after 0ms. The WHATWG specification defines the following rules.

```javascript
// setTimeout nesting limit (HTML spec Section 8.6)
//
// When nesting level exceeds 5, the minimum delay is forced to 4ms

function demonstrateNestedTimeout() {
  const start = performance.now();
  let count = 0;

  function nest() {
    count++;
    const elapsed = performance.now() - start;
    console.log(`Nest ${count}: ${elapsed.toFixed(2)}ms`);

    if (count < 10) {
      setTimeout(nest, 0);  // Even with 0ms, becomes 4ms+ when deeply nested
    }
  }

  setTimeout(nest, 0);
}

demonstrateNestedTimeout();
// Typical output:
// Nest 1: 0.10ms    ← nearly immediate
// Nest 2: 0.20ms
// Nest 3: 0.30ms
// Nest 4: 0.40ms
// Nest 5: 0.50ms
// Nest 6: 4.50ms    ← nesting limit kicks in here
// Nest 7: 8.60ms
// Nest 8: 12.70ms
// Nest 9: 16.80ms
// Nest 10: 20.90ms
```

This behavior is called "setTimeout clamping" and is a protection mechanism to prevent excessive CPU consumption by recursive setTimeouts.

### 2.4 Task Execution and the Long Task Problem

Each task runs uninterrupted from start to finish (run-to-completion). While this enhances code predictability, long-running tasks risk blocking the main thread and preventing rendering updates and responses to user interactions.

```javascript
// Example of a long-running task (anti-pattern)
button.addEventListener('click', () => {
  // The UI is frozen until this synchronous processing completes
  const result = heavyComputation(); // Takes 200ms
  display.textContent = result;
});

// Improved example: splitting the task
button.addEventListener('click', async () => {
  display.textContent = 'Computing...';

  // yieldToMain: return control to the main thread
  await yieldToMain();

  const result = heavyComputation();
  display.textContent = result;
});

// Simple implementation of yieldToMain
function yieldToMain() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}
```

The **Long Tasks API** allows you to detect tasks that exceed 50ms.

```javascript
// Monitoring with the Long Tasks API
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.warn(
      `Long task detected: ${entry.duration.toFixed(1)}ms`,
      `(name: ${entry.name})`
    );
  }
});

observer.observe({ type: 'longtask', buffered: true });
```

---

## 3. Microtasks in Detail

### 3.1 Microtask Checkpoints

Microtasks are executed at the following "microtask checkpoints."

1. **After each task completes** (Step 2 of the event loop)
2. **After certain Web API callbacks execute**
3. **When the call stack becomes empty**

An important point is that if a new microtask is added to the queue while processing microtasks, **that microtask is also executed within the same checkpoint**. This means recursive microtask queuing can cause an infinite loop.

```javascript
// Dangerous: infinite microtask loop
// The following code will freeze a browser tab
function dangerousInfiniteLoop() {
  queueMicrotask(() => {
    console.log('This will repeat forever');
    dangerousInfiniteLoop();  // New microtask executes immediately
  });
}
// dangerousInfiniteLoop(); // Never run this!

// Contrast: recursion with setTimeout is safe
function safeRecursion() {
  setTimeout(() => {
    console.log('This yields to the event loop');
    safeRecursion();  // Waits until the next task cycle
  }, 0);
}
```

### 3.2 Promise Chains and Microtasks

Promise `.then()` / `.catch()` / `.finally()` callbacks are added to the microtask queue when the Promise is settled.

```javascript
// Tracing the execution order of a Promise chain
console.log('A: sync start');

const p = new Promise((resolve) => {
  console.log('B: executor (sync)');  // executor runs synchronously
  resolve('done');
  console.log('C: after resolve (still sync)');
});

p.then((val) => {
  console.log('D: first then - ' + val);
}).then(() => {
  console.log('E: second then');
});

p.then(() => {
  console.log('F: another branch then');
});

console.log('G: sync end');

// Output order:
// A: sync start
// B: executor (sync)
// C: after resolve (still sync)
// G: sync end
// D: first then - done
// F: another branch then    ← D and F branch from the same Promise
// E: second then            ← in D's .then() chain, so after F
```

### 3.3 async/await and Microtasks

`async/await` is syntactic sugar for Promises; code after `await` executes as a microtask.

```javascript
async function example() {
  console.log('1: before await');
  await Promise.resolve();
  console.log('2: after await');  // executed as a microtask
  await Promise.resolve();
  console.log('3: after second await');  // executed as the next microtask
}

console.log('A: start');
example();
console.log('B: end');

// Output:
// A: start
// 1: before await
// B: end
// 2: after await
// 3: after second await
```

`await` is internally transformed as follows.

```
async function f() {        →   function f() {
  console.log('before');    →     console.log('before');
  await somePromise;        →     return somePromise.then(() => {
  console.log('after');     →       console.log('after');
}                           →     });
                            →   }
```

### 3.4 Using queueMicrotask

`queueMicrotask()` is an API that adds a microtask directly to the queue without going through a Promise.

```javascript
// Typical use of queueMicrotask:
// Optimizing batch processing

class BatchProcessor {
  #pending = [];
  #scheduled = false;

  add(item) {
    this.#pending.push(item);

    if (!this.#scheduled) {
      this.#scheduled = true;
      // Batch process after all synchronous code completes
      queueMicrotask(() => {
        this.#flush();
      });
    }
  }

  #flush() {
    const batch = this.#pending.splice(0);
    this.#scheduled = false;
    console.log(`Processing batch of ${batch.length} items:`, batch);
    // Perform actual processing here in bulk
  }
}

const processor = new BatchProcessor();
processor.add('item1');
processor.add('item2');
processor.add('item3');
// After synchronous code completes, flush is called once:
// "Processing batch of 3 items: ['item1', 'item2', 'item3']"
```

### 3.5 MutationObserver and Microtasks

`MutationObserver` callbacks execute as microtasks. This allows multiple DOM changes to be efficiently handled in a single callback invocation.

```javascript
const observer = new MutationObserver((mutations) => {
  // This runs as a microtask
  console.log(`${mutations.length} mutations observed`);
  mutations.forEach(m => {
    console.log(`  Type: ${m.type}, Target: ${m.target.id}`);
  });
});

observer.observe(document.getElementById('container'), {
  childList: true,
  subtree: true,
  attributes: true,
});

// The following 3 DOM changes are bundled into a single callback
// notification at the same microtask checkpoint
const container = document.getElementById('container');
container.appendChild(document.createElement('div'));
container.setAttribute('data-count', '1');
container.firstChild.textContent = 'Hello';
```

---

## 4. Tasks vs. Microtasks Comparison

### 4.1 Comparison Table

| Property | Task (Macrotask) | Microtask |
|----------|-----------------|-----------|
| **Execution timing** | One at a time each event loop cycle | All executed at each checkpoint |
| **Relationship to rendering** | Rendering opportunity between tasks | No rendering while processing microtasks |
| **Queue management** | Multiple task queues (with priority) | Single microtask queue |
| **Sources** | setTimeout, I/O, UI events | Promise, queueMicrotask, MutationObserver |
| **Priority** | Lower than microtasks | Higher than tasks (executed first within the same cycle) |
| **Risk of infinite loop** | Relatively safe as tasks yield between cycles | Risk of infinite loop with recursive additions |
| **Typical delay** | Minimum 4ms (under nesting limit) | Sub-millisecond |
| **Best use case** | Delayed execution, periodic processing | Async continuation, state consistency guarantees |

### 4.2 Visualizing Execution Order

```
Time axis →

Tasks only:
  ┌──────┐     ┌──────┐     ┌──────┐
  │Task A│ Ren │Task B│ Ren │Task C│
  └──────┘     └──────┘     └──────┘
          ↑           ↑
      Rendering   Rendering

With microtasks:
  ┌──────┬──────────────┐     ┌──────┬───────┐
  │Task A│ Micro1 Micro2│ Ren │Task B│ Micro3│ Ren
  └──────┴──────────────┘     └──────┴───────┘
                         ↑                     ↑
                     Rendering             Rendering

  Key point: Microtasks "interject" immediately after a task
             Rendering is delayed until microtasks complete
```

### 4.3 Complete Execution Order Example

```javascript
// Code example 1: Execution order of tasks and microtasks (basics)
console.log('1: sync');

setTimeout(() => {
  console.log('2: timeout');
}, 0);

Promise.resolve().then(() => {
  console.log('3: promise');
});

queueMicrotask(() => {
  console.log('4: queueMicrotask');
});

console.log('5: sync');

// Output:
// 1: sync
// 5: sync
// 3: promise
// 4: queueMicrotask
// 2: timeout
//
// Explanation:
// (a) Synchronous code: 1, 5
// (b) Microtasks: 3, 4 (Promise.then and queueMicrotask are on the same level)
// (c) Task: 2 (setTimeout runs in the next task cycle)
```

```javascript
// Code example 2: Microtasks generated within a task (intermediate)
setTimeout(() => {
  console.log('timeout 1');
  Promise.resolve().then(() => console.log('promise in timeout 1'));
}, 0);

setTimeout(() => {
  console.log('timeout 2');
  Promise.resolve().then(() => console.log('promise in timeout 2'));
}, 0);

Promise.resolve().then(() => {
  console.log('promise 1');
  queueMicrotask(() => console.log('nested microtask'));
});

// Output:
// promise 1
// nested microtask     ← added inside the promise 1 microtask
// timeout 1
// promise in timeout 1 ← microtask checkpoint after timeout 1
// timeout 2
// promise in timeout 2 ← microtask checkpoint after timeout 2
```

---

## 5. requestAnimationFrame (rAF)

### 5.1 rAF Execution Timing

`requestAnimationFrame` registers a callback to be called immediately before a rendering update. In cycles where the browser decides to render, rAF callbacks execute, followed by style recalculation, layout, and paint.

```
Detailed timeline of one frame (at 60fps, 1 frame ≈ 16.67ms):

  0ms                              16.67ms
  │                                │
  ├── Task execution               │
  │     │                          │
  │     ├── Microtask checkpoint   │
  │     │                          │
  │     ├── resize / scroll events │
  │     │                          │
  │     ├── rAF callbacks          │ ← make DOM changes here
  │     │                          │
  │     ├── Style recalculation    │
  │     ├── Layout (Reflow)        │
  │     ├── Paint                  │
  │     ├── Composite              │
  │     │                          │
  │     └── Idle (remaining time)  │ ← rIC runs here
  │                                │
  │◄──────── 16.67ms ─────────────►│
```

### 5.2 Basic Usage of rAF

```javascript
// Code example 3: Smooth animation with rAF
function animateElement(element, targetX, duration) {
  const startX = parseFloat(getComputedStyle(element).transform.split(',')[4]) || 0;
  const distance = targetX - startX;
  let startTime = null;

  function frame(currentTime) {
    if (startTime === null) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function: ease-out-cubic
    const eased = 1 - Math.pow(1 - progress, 3);

    element.style.transform = `translateX(${startX + distance * eased}px)`;

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

// Usage
const box = document.getElementById('animated-box');
animateElement(box, 300, 1000);  // Move to 300px over 1000ms
```

### 5.3 rAF and DOM Batch Updates

Alternating DOM reads and writes causes "Forced Synchronous Layout" and degrades performance. Batching writes with rAF avoids this problem.

```javascript
// Anti-pattern: alternating reads and writes
// → causes Forced Synchronous Layout
function badLayout(elements) {
  elements.forEach(el => {
    const height = el.offsetHeight;       // read (forces Layout)
    el.style.height = height * 2 + 'px'; // write (invalidates Layout)
    // Next read requires layout recalculation again
  });
}

// Recommended pattern: separate reads and writes
function goodLayout(elements) {
  // Phase 1: perform all reads first
  const heights = elements.map(el => el.offsetHeight);

  // Phase 2: perform all writes inside rAF
  requestAnimationFrame(() => {
    elements.forEach((el, i) => {
      el.style.height = heights[i] * 2 + 'px';
    });
  });
}
```

### 5.4 Canceling rAF

```javascript
// How to cancel rAF
let animationId = null;

function startAnimation() {
  function frame(timestamp) {
    // Animation processing
    updatePosition(timestamp);
    animationId = requestAnimationFrame(frame);
  }
  animationId = requestAnimationFrame(frame);
}

function stopAnimation() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

// Control based on page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAnimation();  // Stop when tab becomes hidden
  } else {
    startAnimation(); // Resume when tab becomes visible
  }
});
```

### 5.5 Important Notes on rAF

1. **Behavior in inactive tabs**: Most browsers stop or throttle rAF in inactive tabs. This is a power-saving measure.
2. **Frame rate variation**: rAF is not necessarily called at 60fps. It depends on the display's refresh rate (120Hz, 144Hz, etc.) and browser load.
3. **Registering rAF inside rAF**: Calling `requestAnimationFrame` inside a rAF callback schedules the new callback for the **next frame** (not the current one).

```javascript
// rAF registered inside rAF runs in the next frame
requestAnimationFrame(() => {
  console.log('Frame 1');
  requestAnimationFrame(() => {
    console.log('Frame 2');  // Runs in the frame after Frame 1
  });
});
```

### 5.6 rAF vs. setTimeout(fn, 16) Comparison Table

| Property | requestAnimationFrame | setTimeout(fn, 16) |
|----------|-----------------------|-------------------|
| **Frame sync** | Precisely synchronized with display refresh rate | Drift can accumulate |
| **Inactive tab** | Stopped (power-saving) | Continues running (limited in some browsers) |
| **Timestamp** | High-precision DOMHighResTimeStamp is provided | Must measure manually |
| **Battery usage** | Low (stops when not needed) | High (always running) |
| **Relationship to rendering** | Runs just before rendering (optimal timing) | Unrelated to rendering |
| **Minimum interval** | Display-dependent (16.67ms @60Hz) | 4ms (after nesting limit) |
| **Use case** | Animations, DOM updates | Delayed execution, polling |

---

## 6. requestIdleCallback (rIC)

### 6.1 The Concept of Idle Periods

Each browser frame has a "budget." At 60fps, this is approximately 16.67ms per frame. When task execution, microtask processing, and rendering all finish within this budget, the remaining time becomes an "idle period." `requestIdleCallback` is the API for executing low-priority processing during this idle period.

```
Frame budget allocation:

 Case 1: Light processing (idle time available)
 ┌────────┬──────┬──────────┬──────────────────┐
 │ Task   │Micro │Rendering │   Idle (rIC)     │
 │ 3ms    │ 1ms  │  5ms     │   7.67ms         │
 └────────┴──────┴──────────┴──────────────────┘
 │◄───────────── 16.67ms ─────────────────────►│

 Case 2: Heavy processing (no idle time)
 ┌────────────────────┬──────┬──────────┐
 │ Task               │Micro │Rendering │
 │ 10ms               │ 2ms  │  5ms     │← Budget exceeded! rIC does not run
 └────────────────────┴──────┴──────────┘
 │◄───────────── 17ms ────────────────►│
```

### 6.2 IdleDeadline API

rIC callbacks receive an `IdleDeadline` object. Use it to check the remaining idle time and split processing appropriately.

```javascript
// Code example 4: Incremental data processing with rIC
class IdleProcessor {
  #queue = [];
  #isProcessing = false;

  enqueue(items) {
    this.#queue.push(...items);
    this.#scheduleProcessing();
  }

  #scheduleProcessing() {
    if (this.#isProcessing) return;
    this.#isProcessing = true;

    requestIdleCallback((deadline) => {
      this.#process(deadline);
    }, { timeout: 5000 });  // Force execution if not run within 5 seconds
  }

  #process(deadline) {
    // Process while idle time remains, or when timed out
    while (
      this.#queue.length > 0 &&
      (deadline.timeRemaining() > 1 || deadline.didTimeout)
    ) {
      const item = this.#queue.shift();
      this.#processItem(item);
    }

    if (this.#queue.length > 0) {
      // If items remain, continue in next idle period
      requestIdleCallback((deadline) => {
        this.#process(deadline);
      }, { timeout: 5000 });
    } else {
      this.#isProcessing = false;
    }
  }

  #processItem(item) {
    // Process individual items
    console.log(`Processing: ${item}`);
  }
}

// Usage: incrementally process 1000 items during idle time
const processor = new IdleProcessor();
processor.enqueue(Array.from({ length: 1000 }, (_, i) => `item-${i}`));
```

### 6.3 rIC Restrictions and Cautions

**No DOM manipulation**: Changing the DOM inside an rIC callback can cause unexpected layout recalculations. If DOM changes are needed, schedule an rAF from within rIC and manipulate the DOM inside rAF.

```javascript
// Recommended: combining rIC + rAF
requestIdleCallback((deadline) => {
  // Perform calculations during idle time
  const results = performCalculations(deadline);

  // Delegate DOM changes to rAF
  requestAnimationFrame(() => {
    updateDOM(results);
  });
});
```

**Browser support**: Safari does not support requestIdleCallback (as of 2025). A polyfill or fallback is needed.

```javascript
// rIC polyfill (simplified)
const requestIdleCallbackCompat =
  window.requestIdleCallback ||
  function(callback, options) {
    const start = Date.now();
    return setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        },
      });
    }, 1);
  };

const cancelIdleCallbackCompat =
  window.cancelIdleCallback ||
  function(id) {
    clearTimeout(id);
  };
```

### 6.4 Typical rIC Use Cases

| Use Case | Description | Recommended timeout |
|----------|-------------|---------------------|
| Analytics sending | Async sending of user behavior logs | 3000ms |
| Prefetch | Pre-fetching resources for the next page | 5000ms |
| Lazy initialization | Initializing non-critical features | 10000ms |
| Data preprocessing | Building search indexes, etc. | none (no completion guarantee needed) |
| Cache management | Deleting unnecessary cache entries | none |
| Telemetry | Collecting and sending performance data | 5000ms |

---

## 7. Scheduling API Comparison Table

### 7.1 Cross-API Comparison

| API | Execution Timing | Priority | Frame sync | Cancelable | Best Use |
|-----|-----------------|----------|------------|------------|----------|
| Synchronous code | Immediate | Highest | - | No | Processing needing immediate execution |
| `queueMicrotask()` | Right after task | High | No | No | State consistency guarantees |
| `Promise.then()` | Right after task | High | No | No | Async continuation |
| `MutationObserver` | After DOM change | High | No | Disconnect | Watching DOM changes |
| `requestAnimationFrame` | Before rendering | Medium-High | Yes | `cancelAnimationFrame` | Animations, DOM updates |
| `setTimeout(fn, 0)` | Next cycle onward | Medium | No | `clearTimeout` | Delayed execution |
| `setInterval(fn, ms)` | Periodic | Medium | No | `clearInterval` | Periodic polling |
| `MessageChannel` | Next cycle | Medium | No | port.close() | Avoiding nesting limits |
| `requestIdleCallback` | During idle | Low | No | `cancelIdleCallback` | Low-priority processing |
| `scheduler.postTask()` | Priority-dependent | Variable | No | `AbortController` | Priority-based tasks |

### 7.2 scheduler.postTask() (New API)

`scheduler.postTask()` is a new API that allows explicit priority assignment to tasks (supported in Chrome 94+).

```javascript
// Usage of scheduler.postTask()
async function demonstrateScheduler() {
  // user-blocking: processing affecting user interactions (highest priority)
  scheduler.postTask(() => {
    console.log('user-blocking task');
  }, { priority: 'user-blocking' });

  // user-visible: affects display but doesn't need to be immediate
  scheduler.postTask(() => {
    console.log('user-visible task');
  }, { priority: 'user-visible' });

  // background: background processing (lowest priority)
  scheduler.postTask(() => {
    console.log('background task');
  }, { priority: 'background' });
}

// Canceling with AbortController
const controller = new AbortController();

scheduler.postTask(
  () => { console.log('cancellable task'); },
  { priority: 'background', signal: controller.signal }
);

controller.abort();  // Cancel the task
```

---

## 8. Integrated Execution Order Model

### 8.1 Execution Order Including All APIs

```javascript
// Code example 5: Execution order with all scheduling APIs
console.log('1: sync');

setTimeout(() => console.log('2: setTimeout'), 0);

Promise.resolve().then(() => console.log('3: promise'));

queueMicrotask(() => console.log('4: queueMicrotask'));

requestAnimationFrame(() => console.log('5: rAF'));

requestIdleCallback(() => console.log('6: rIC'));

console.log('7: sync end');

// Guaranteed order:
// 1: sync
// 7: sync end
// 3: promise         ← microtask (Promise)
// 4: queueMicrotask  ← microtask (queueMicrotask)
//
// The following depend on browser decision (relative order may vary):
// 2: setTimeout      ← task
// 5: rAF             ← before rendering (if rendering occurs)
// 6: rIC             ← during idle time (if time allows)
//
// Typical output:
// 1, 7, 3, 4, 5, 2, 6
// or
// 1, 7, 3, 4, 2, 5, 6
```

### 8.2 Flowchart for Determining Execution Order

```
Flowchart for predicting execution order:

  Read the code
       │
       ▼
  ┌─────────────┐    yes    ┌──────────────────────┐
  │ Synchronous? ├─────────►│ Execute immediately   │
  └──────┬──────┘           │ (in order)            │
         │ no               └──────────────────────┘
         ▼
  ┌─────────────────┐  yes  ┌────────────────────────┐
  │ Microtask?       ├──────►│ Execute right after     │
  │ (Promise, queue  │       │ current task, together  │
  │  Microtask, etc) │       │ with all microtasks     │
  └──────┬──────────┘       └────────────────────────┘
         │ no
         ▼
  ┌─────────────┐    yes    ┌────────────────────────┐
  │ rAF?         ├─────────►│ Run just before the     │
  │              │           │ next rendering frame    │
  └──────┬──────┘           └────────────────────────┘
         │ no
         ▼
  ┌─────────────┐    yes    ┌────────────────────────┐
  │ Task?        ├─────────►│ Added to task queue     │
  │ (setTimeout) │           │ Runs when its turn comes│
  └──────┬──────┘           └────────────────────────┘
         │ no
         ▼
  ┌─────────────┐    yes    ┌────────────────────────┐
  │ rIC?         ├─────────►│ Run during idle period  │
  │              │           │ (lowest priority)       │
  └─────────────┘           └────────────────────────┘
```

### 8.3 Tracing Complex Execution Order

The following is a detailed trace for a case combining multiple APIs.

```javascript
// Example of composite execution order
console.log('A');

setTimeout(() => {
  console.log('B');
  queueMicrotask(() => console.log('C'));
}, 0);

requestAnimationFrame(() => {
  console.log('D');
  Promise.resolve().then(() => console.log('E'));
});

queueMicrotask(() => {
  console.log('F');
  queueMicrotask(() => console.log('G'));
});

Promise.resolve().then(() => console.log('H'));

console.log('I');

// Trace:
// Step 1 (sync): A, I
// Step 2 (microtasks): F → G (G added inside F, runs same checkpoint), H
//   ※ F and H order is registration order F → H; G added inside F so F → G → H
//   Exact output: F, G, H
// Step 3 (rendering decision):
//   If rendering: D → E (Promise inside rAF)
//   If not rendering: D, E deferred until next rendering
// Step 4 (task): B → C (C added inside B, runs at microtask checkpoint)
//
// Typical output: A, I, F, G, H, D, E, B, C
```

---

## 9. Code Examples

### 9.1 Code Example 6: Immediate Task Scheduling with MessageChannel

Using `MessageChannel` avoids the `setTimeout` nesting limit (4ms) and allows faster task scheduling. React's scheduler (Scheduler package) also uses this technique.

```javascript
// Fast task scheduling with MessageChannel
function scheduleTask(callback) {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => callback();
  channel.port2.postMessage(null);
}

// Speed comparison
async function benchmark() {
  const iterations = 100;

  // With setTimeout(fn, 0)
  const startTimeout = performance.now();
  let countTimeout = 0;
  await new Promise(resolve => {
    function next() {
      countTimeout++;
      if (countTimeout < iterations) {
        setTimeout(next, 0);
      } else {
        resolve();
      }
    }
    setTimeout(next, 0);
  });
  const timeoutDuration = performance.now() - startTimeout;

  // With MessageChannel
  const startChannel = performance.now();
  let countChannel = 0;
  await new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      countChannel++;
      if (countChannel < iterations) {
        channel.port2.postMessage(null);
      } else {
        resolve();
      }
    };
    channel.port2.postMessage(null);
  });
  const channelDuration = performance.now() - startChannel;

  console.log(`setTimeout x${iterations}: ${timeoutDuration.toFixed(1)}ms`);
  console.log(`MessageChannel x${iterations}: ${channelDuration.toFixed(1)}ms`);
  // Typical results (Chrome):
  // setTimeout x100: ~450ms (each 4ms+ due to nesting limit)
  // MessageChannel x100: ~15ms (no nesting limit)
}
```

### 9.2 Code Example 7: Progress Display Using the Event Loop

```javascript
// Update a progress bar in the middle of heavy processing
async function processWithProgress(data, progressCallback) {
  const total = data.length;
  const chunkSize = 100;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    // Process the chunk
    for (const item of chunk) {
      processItem(item);
    }

    // Update progress (DOM manipulation)
    const progress = Math.min((i + chunkSize) / total, 1);
    progressCallback(progress);

    // Return control to the main thread to allow rendering
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        // Resolving inside rAF means the next chunk runs after rendering
        resolve();
      });
    });
  }

  progressCallback(1);
}

// Usage
const progressBar = document.getElementById('progress-bar');
const data = generateLargeDataset(10000);

processWithProgress(data, (progress) => {
  progressBar.style.width = `${progress * 100}%`;
  progressBar.textContent = `${Math.round(progress * 100)}%`;
});
```

### 9.3 Code Example 8: Debounce and the Event Loop

```javascript
// Microtask-based debounce (merges multiple calls within the same task)
function microtaskDebounce(fn) {
  let scheduled = false;
  let latestArgs = null;

  return function(...args) {
    latestArgs = args;
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        fn.apply(this, latestArgs);
      });
    }
  };
}

// rAF-based debounce (merges per frame)
function rafDebounce(fn) {
  let frameId = null;
  let latestArgs = null;

  return function(...args) {
    latestArgs = args;
    if (frameId === null) {
      frameId = requestAnimationFrame(() => {
        frameId = null;
        fn.apply(this, latestArgs);
      });
    }
  };
}

// Task-based debounce (traditional, with ms delay)
function taskDebounce(fn, delay = 300) {
  let timerId = null;

  return function(...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// When to use which:
// microtaskDebounce: deduplication within the same synchronous context
// rafDebounce: per-frame processing like scroll or resize
// taskDebounce: waiting for user input (search boxes, etc.)
```

---

## 10. Anti-Patterns

### 10.1 Anti-Pattern 1: Blocking Rendering with Microtasks

**Problem**: Because microtasks are all executed within a checkpoint, a large number of microtasks will block rendering for a long time.

```javascript
// BAD: queuing a large number of microtasks
function processAllWithMicrotasks(items) {
  items.forEach((item, index) => {
    // 10,000 Promise chains are stacked in the microtask queue
    Promise.resolve().then(() => {
      processItem(item);
      if (index % 100 === 0) {
        updateProgressUI(index / items.length);
        // This UI update will NOT render!
        // Rendering is blocked until all microtasks complete
      }
    });
  });
}

// GOOD: split into tasks to allow rendering opportunities
async function processAllWithYield(items) {
  const chunkSize = 50;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    chunk.forEach(item => processItem(item));

    updateProgressUI(Math.min((i + chunkSize) / items.length, 1));

    // Return control to the main thread with setTimeout
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

**Why it's a problem**: The rendering pipeline does not start until the microtask queue is empty. If 10,000 microtasks are queued, the screen won't update until all of them run, making it appear frozen to the user.

### 10.2 Anti-Pattern 2: Heavy Synchronous Processing Inside rAF

**Problem**: Performing heavy processing inside rAF callbacks exceeds the frame budget and causes frame drops.

```javascript
// BAD: heavy processing inside rAF
requestAnimationFrame(() => {
  // Sorting a large array (could take tens of ms)
  const sorted = hugeArray.sort((a, b) => complexComparison(a, b));

  // Reflecting sort results in the DOM
  sorted.forEach(item => {
    const el = document.createElement('div');
    el.textContent = item.name;
    container.appendChild(el);  // DOM manipulation is also heavy
  });
  // Far exceeds the frame budget (16.67ms) → jank occurs
});

// GOOD: compute ahead of time, only do DOM operations in rAF
const sorted = hugeArray.sort((a, b) => complexComparison(a, b));

// Batch DOM updates using DocumentFragment
requestAnimationFrame(() => {
  const fragment = document.createDocumentFragment();
  sorted.forEach(item => {
    const el = document.createElement('div');
    el.textContent = item.name;
    fragment.appendChild(el);
  });
  container.appendChild(fragment);  // Single DOM operation
});
```

**Why it's a problem**: rAF runs immediately before rendering. Using up the frame budget here delays rendering itself, causing jank that users can perceive. Focus only on DOM writes inside rAF, and complete computation beforehand.

### 10.3 Anti-Pattern 3: Inappropriate Use of setInterval

```javascript
// BAD: expecting precise timing from setInterval
let lastTime = performance.now();
setInterval(() => {
  const now = performance.now();
  const drift = now - lastTime - 1000;
  console.log(`Drift: ${drift.toFixed(1)}ms`);
  lastTime = now;
  // Drift accumulates over long runs
}, 1000);

// GOOD: self-correcting recursive setTimeout
function accurateInterval(callback, interval) {
  let expected = performance.now() + interval;

  function step() {
    const now = performance.now();
    const drift = now - expected;
    callback(drift);

    expected += interval;
    // Correct for drift when setting the next timer
    setTimeout(step, Math.max(0, interval - drift));
  }

  setTimeout(step, interval);
}

accurateInterval((drift) => {
  console.log(`Drift: ${drift.toFixed(1)}ms`);
}, 1000);
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: Exceptions Inside the Promise Constructor

Exceptions thrown synchronously inside a Promise constructor executor are handled as a rejection. However, exceptions thrown asynchronously (inside setTimeout) within the executor become unhandled exceptions that cannot be caught.

```javascript
// Case A: synchronous exception in executor → catchable as rejection
const p1 = new Promise((resolve, reject) => {
  throw new Error('sync error');
});
p1.catch(err => console.log('Caught:', err.message));
// Output: Caught: sync error

// Case B: async exception in executor → cannot be caught
const p2 = new Promise((resolve, reject) => {
  setTimeout(() => {
    throw new Error('async error');
    // This exception cannot be caught with the Promise chain
    // Detected by window.onerror or unhandledrejection
  }, 0);
});
p2.catch(err => console.log('This will NOT be called'));

// Case C: exception after resolve is ignored
const p3 = new Promise((resolve, reject) => {
  resolve('done');
  throw new Error('after resolve');
  // throw after resolve is ignored (Promise state is immutable)
});
p3.then(val => console.log('Value:', val));
// Output: Value: done
```

**Relationship to the event loop**: In Case B, the `setTimeout` callback runs as a separate task. The exception in that task occurs in a completely independent context from the original Promise chain, so it cannot be caught with `.catch()`. This is due to crossing a "task boundary" in the event loop.

### 11.2 Edge Case 2: Execution Frame of Nested rAF

Calling `requestAnimationFrame` inside a `requestAnimationFrame` callback causes the new callback to run in the next frame. This can be utilized in layout read/write patterns, but requires care.

```javascript
// "Wait until next paint" technique
function afterNextPaint(callback) {
  requestAnimationFrame(() => {
    // This rAF runs before rendering of the current frame
    requestAnimationFrame(() => {
      // This rAF runs before rendering of the next frame
      // i.e., after rendering (Paint) of the previous frame completes
      callback();
    });
  });
}

// Usage: detect "paint complete" after DOM change
element.style.display = 'block';
afterNextPaint(() => {
  // Here, element is expected to be visible on screen
  const rect = element.getBoundingClientRect();
  console.log('Element is now visible at:', rect);
});
```

```
Double rAF timeline:

 Frame N                          Frame N+1
 ┌──────────────────────────────┐ ┌────────────────────────────┐
 │ rAF-1 │ Style │Layout│Paint │ │ rAF-2  │ Style│Layout│Paint│
 │(reg.) │       │      │      │ │(exec.) │      │      │     │
 └───┬──────────────────────────┘ └───┬────────────────────────┘
     │                                │
     └─ registers rAF-2               └─ callback runs
                                         (state after Paint confirmed)
```

### 11.3 Edge Case 3: Retaining Execution Context with async/await

```javascript
// Behavior of this inside async functions
class Timer {
  name = 'MyTimer';

  async start() {
    console.log(this.name);    // 'MyTimer' (synchronous part)

    await Promise.resolve();
    console.log(this.name);    // 'MyTimer' (this is retained)

    // But when passed as a callback, it differs
    setTimeout(function() {
      // console.log(this.name); // undefined (this is lost)
    }, 0);

    setTimeout(() => {
      console.log(this.name);   // 'MyTimer' (this retained with arrow function)
    }, 0);
  }
}

// Case where microtask execution order changes across await boundaries
async function tricky() {
  console.log('1');
  await null;           // microtask boundary
  console.log('2');
  await null;           // microtask boundary
  console.log('3');
}

console.log('A');
tricky();
console.log('B');
Promise.resolve().then(() => console.log('C'));

// Output: A, 1, B, C, 2, 3
// Explanation:
// Sync: A, 1 (up to await null), B
// Microtasks: C (Promise.then), 2 (continuation of await null)
//   ※ await null continuation is equivalent to Promise.resolve(null).then(() => ...)
//   C is registered first, so C comes first
// Next microtask: 3 (continuation of 2's await null)
```

---

## 12. Staged Exercises

### 12.1 Exercise 1 (Beginner): Predicting Execution Order

Predict the output order of the following code. After predicting, verify in the browser's DevTools console.

```javascript
// Problem 1
console.log('start');

setTimeout(() => console.log('timeout'), 0);

Promise.resolve()
  .then(() => console.log('promise 1'))
  .then(() => console.log('promise 2'));

queueMicrotask(() => console.log('microtask'));

console.log('end');
```

<details>
<summary>Answer</summary>

```
start
end
promise 1
microtask
promise 2
timeout
```

**Explanation**:
1. Synchronous code: `start`, `end`
2. Microtask checkpoint:
   - `promise 1` (first .then, queued immediately with Promise.resolve())
   - `microtask` (registered with queueMicrotask)
   - `promise 2` (queued after promise 1 resolves → runs in the same checkpoint)
3. Task: `timeout`

The order of `promise 1` and `microtask` depends on the registration order of Promise.resolve().then() and queueMicrotask(). `promise 2` is added to the microtask queue after `promise 1` executes, but since it's within the same checkpoint, it runs immediately.
</details>

### 12.2 Exercise 2 (Intermediate): Implementing an Animation with rAF

Implement a countdown timer using rAF that meets the following requirements.

- Counts down from 10 to 0
- Each count displays at exactly 1-second intervals
- Stops at count 0 and displays "Complete!"
- Can be stopped mid-way with `cancelAnimationFrame`

```javascript
// Exercise 2 skeleton
function createCountdown(element, from, onComplete) {
  let startTime = null;
  let currentCount = from;
  let animationId = null;

  function tick(timestamp) {
    // Implement here
  }

  animationId = requestAnimationFrame(tick);

  // Return cancel function
  return () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
}
```

<details>
<summary>Answer</summary>

```javascript
function createCountdown(element, from, onComplete) {
  let startTime = null;
  let currentCount = from;
  let animationId = null;

  element.textContent = String(currentCount);

  function tick(timestamp) {
    if (startTime === null) {
      startTime = timestamp;
    }

    const elapsed = timestamp - startTime;
    const newCount = from - Math.floor(elapsed / 1000);

    if (newCount !== currentCount && newCount >= 0) {
      currentCount = newCount;
      element.textContent = String(currentCount);
    }

    if (currentCount > 0) {
      animationId = requestAnimationFrame(tick);
    } else {
      element.textContent = 'Complete!';
      animationId = null;
      if (onComplete) onComplete();
    }
  }

  animationId = requestAnimationFrame(tick);

  return () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
}

// Usage
const display = document.getElementById('countdown');
const cancel = createCountdown(display, 10, () => {
  console.log('Countdown finished!');
});

// To stop after 5 seconds:
// setTimeout(() => cancel(), 5000);
```

**Key points**:
- Record `startTime` at the first frame and calculate the count based on elapsed time
- Using rAF instead of `setInterval` enables smooth frame-synchronized display
- Returning a cancel function allows external stopping
</details>

### 12.3 Exercise 3 (Advanced): Implementing a Task Scheduler

Implement a task scheduler that meets the following requirements.

- Priority-based task queue (3 levels: high, normal, low)
- Each task runs within the frame budget (default 8ms)
- When budget is exceeded, defer to the next frame
- Tasks can be added and canceled

```javascript
// Exercise 3 skeleton
class PriorityTaskScheduler {
  #queues = { high: [], normal: [], low: [] };
  #isRunning = false;
  #frameBudget;

  constructor(frameBudgetMs = 8) {
    this.#frameBudget = frameBudgetMs;
  }

  schedule(task, priority = 'normal') {
    // Implement here
    // task has the form { id: string, run: () => void }
  }

  cancel(taskId) {
    // Implement here
  }

  #processQueue() {
    // Implement here
  }
}
```

<details>
<summary>Answer</summary>

```javascript
class PriorityTaskScheduler {
  #queues = { high: [], normal: [], low: [] };
  #isRunning = false;
  #frameBudget;
  #frameId = null;

  constructor(frameBudgetMs = 8) {
    this.#frameBudget = frameBudgetMs;
  }

  schedule(task, priority = 'normal') {
    if (!this.#queues[priority]) {
      throw new Error(`Invalid priority: ${priority}`);
    }
    this.#queues[priority].push(task);
    this.#ensureRunning();
    return task.id;
  }

  cancel(taskId) {
    for (const priority of ['high', 'normal', 'low']) {
      const index = this.#queues[priority].findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.#queues[priority].splice(index, 1);
        return true;
      }
    }
    return false;
  }

  #ensureRunning() {
    if (this.#isRunning) return;
    this.#isRunning = true;
    this.#frameId = requestAnimationFrame((ts) => this.#processQueue(ts));
  }

  #getNextTask() {
    for (const priority of ['high', 'normal', 'low']) {
      if (this.#queues[priority].length > 0) {
        return this.#queues[priority].shift();
      }
    }
    return null;
  }

  #hasRemainingTasks() {
    return (
      this.#queues.high.length > 0 ||
      this.#queues.normal.length > 0 ||
      this.#queues.low.length > 0
    );
  }

  #processQueue(frameTimestamp) {
    const deadline = performance.now() + this.#frameBudget;

    while (performance.now() < deadline) {
      const task = this.#getNextTask();
      if (!task) break;

      try {
        task.run();
      } catch (err) {
        console.error(`Task ${task.id} failed:`, err);
      }
    }

    if (this.#hasRemainingTasks()) {
      this.#frameId = requestAnimationFrame((ts) => this.#processQueue(ts));
    } else {
      this.#isRunning = false;
      this.#frameId = null;
    }
  }

  destroy() {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
    }
    this.#queues = { high: [], normal: [], low: [] };
    this.#isRunning = false;
    this.#frameId = null;
  }
}

// Usage
const scheduler = new PriorityTaskScheduler(8);

scheduler.schedule({
  id: 'analytics',
  run: () => sendAnalytics(),
}, 'low');

scheduler.schedule({
  id: 'render-update',
  run: () => updateCriticalUI(),
}, 'high');

const taskId = scheduler.schedule({
  id: 'prefetch',
  run: () => prefetchNextPage(),
}, 'normal');

// Cancel when no longer needed
scheduler.cancel(taskId);
```

**Design points**:
- Retrieve tasks from the highest-priority queue first (high → normal → low)
- Check remaining frame budget with `performance.now()` and exit the loop before exceeding it
- Use rAF to achieve a per-frame processing cycle
- Release resources properly with the `destroy()` method
</details>

---

## 13. FAQ

### Q1: What is the difference in execution order between macrotasks and microtasks?

**Answer**: Macrotasks and microtasks are processed at different timings in the event loop.

**Macrotask (Task)**:
- Generated by `setTimeout`, `setInterval`, I/O, UI events, etc.
- The event loop executes **only one macrotask** per loop iteration
- Rendering update opportunities are interspersed between macrotasks
- Multiple task queues may exist, and the browser determines priority

**Microtask**:
- Generated by `Promise.then`, `queueMicrotask`, `MutationObserver`, etc.
- After a macrotask completes, **all** microtasks run until the queue is empty
- If a new microtask is added while processing microtasks, it also runs within the same checkpoint
- Rendering updates do not occur until the microtask queue is empty

**Concrete example of execution order**:

```javascript
console.log('1: synchronous code');

setTimeout(() => console.log('2: macrotask'), 0);

Promise.resolve().then(() => {
  console.log('3: microtask');
  Promise.resolve().then(() => console.log('4: nested microtask'));
});

queueMicrotask(() => console.log('5: queueMicrotask'));

console.log('6: sync end');

// Output order:
// 1: synchronous code
// 6: sync end
// 3: microtask
// 5: queueMicrotask
// 4: nested microtask
// 2: macrotask
```

**Key points**:
- Microtasks are treated as the "logical extension" of the current task
- Large numbers of queued microtasks block rendering and can freeze the UI
- Even `setTimeout(fn, 0)` runs after microtasks

### Q2: What is the difference between the browser event loop and the Node.js event loop?

**Answer**: The browser and Node.js event loops share basic concepts but have important structural and behavioral differences.

**Browser event loop**:

1. **Task sources**: UI events, timers, network, user interactions, etc.
2. **Rendering**: After task and microtask processing, a rendering update step is inserted as needed
3. **Frame rate**: Rendering is attempted at typically 60fps (approximately 16.67ms/frame)
4. **Priority**: Multiple task queues exist, but priority depends on browser implementation

**Node.js event loop**:

1. **Phase-based**: The event loop is divided into multiple phases (timers, pending callbacks, idle/prepare, poll, check, close callbacks)
2. **Phase processing**: Each phase processes its corresponding task queue; the microtask queue is processed between phases
3. **`setImmediate` vs `setTimeout`**: Node.js-specific `setImmediate` runs in the check phase; `setTimeout` runs in the timers phase
4. **No rendering**: Node.js is a server environment, so no rendering step exists

**Example of specific differences**:

```javascript
// Example that behaves differently in browser vs Node.js
setTimeout(() => console.log('timeout 1'), 0);
setImmediate(() => console.log('immediate 1'));  // Node.js only

// In Node.js, execution order is non-deterministic (depends on timer precision)
// In browsers, setImmediate is not supported
```

```javascript
// Timing of microtask processing
setTimeout(() => {
  console.log('timeout');
  Promise.resolve().then(() => console.log('microtask in timeout'));
}, 0);

setTimeout(() => console.log('timeout 2'), 0);

// Browser: timeout → microtask in timeout → timeout 2
// Node.js v11+: same (browser-compatible behavior)
// Node.js v10 and earlier: timeout → timeout 2 → microtask in timeout
```

**Summary**:
- The browser event loop is designed around "UI rendering"
- The Node.js event loop is designed around "I/O processing efficiency"
- Since Node.js v11, compatibility with browsers has improved, and microtask processing timing is equivalent to the browser

### Q3: What should I do when a long-running task blocks the UI?

**Answer**: Long Tasks (tasks exceeding 50ms) are the primary cause of reduced UI responsiveness. Here are approaches to address them.

**1. Task Splitting**

Split long tasks into small chunks and yield control back to the main thread.

```javascript
// Bad: long blocking
function processLargeArray(items) {
  items.forEach(item => {
    heavyComputation(item);  // 10ms per item
  });
  // 1000 items means the UI is blocked for 10 seconds
}

// Good: task splitting
async function processLargeArrayChunked(items, chunkSize = 100) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    chunk.forEach(item => heavyComputation(item));

    // Return control to the main thread after each chunk
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

**2. Using Web Workers**

Offload CPU-intensive processing to a background thread.

```javascript
// Main thread
const worker = new Worker('heavy-worker.js');
worker.postMessage({ data: largeDataset });
worker.onmessage = (event) => {
  updateUI(event.data.result);
};

// heavy-worker.js
self.onmessage = (event) => {
  const result = performHeavyComputation(event.data.data);
  self.postMessage({ result });
};
```

**3. Using requestIdleCallback**

Run low-priority processing during idle time.

```javascript
function processBackgroundTasks(tasks) {
  function processTasks(deadline) {
    while (deadline.timeRemaining() > 0 && tasks.length > 0) {
      const task = tasks.shift();
      task();
    }

    if (tasks.length > 0) {
      requestIdleCallback(processTasks);
    }
  }

  requestIdleCallback(processTasks);
}

// Usage
const backgroundTasks = [
  () => preloadImage('img1.jpg'),
  () => preloadImage('img2.jpg'),
  () => buildSearchIndex(),
];
processBackgroundTasks(backgroundTasks);
```

**4. Scheduler API (Experimental)**

Perform priority-based task scheduling.

```javascript
// High-priority task (user interaction)
scheduler.postTask(() => {
  handleUserClick();
}, { priority: 'user-blocking' });

// Medium-priority task (rendering update)
scheduler.postTask(() => {
  updateChart();
}, { priority: 'user-visible' });

// Low-priority task (analytics sending)
scheduler.postTask(() => {
  sendAnalytics();
}, { priority: 'background' });
```

**5. Performance Measurement**

Detect long tasks with the Long Tasks API.

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.warn('Long task detected:', {
      duration: entry.duration,
      startTime: entry.startTime,
    });
  }
});

observer.observe({ entryTypes: ['longtask'] });
```

**Summary**:
- Maintain UI responsiveness by splitting tasks
- Offload CPU-intensive processing to Web Workers
- Run low-priority processing in idle time with requestIdleCallback
- Identify problem areas with the Long Tasks API and improve continuously
- Goal: keep main thread tasks under 50ms

### Q4: Does using async/await prevent event loop blocking?

**Answer**: `async/await` is syntactic sugar that lets you write asynchronous code in a synchronous style, but the resolution of Promises returned by `await` is processed as microtasks. This means processing is split before and after each `await`, but if each split portion is CPU-intensive, it will still block the main thread. For example, putting a loop with 100,000 calculations inside an `async` function doesn't help, because the loop itself runs synchronously. To prevent blocking, you must explicitly insert `await new Promise(resolve => setTimeout(resolve, 0))` inside the loop to yield control back to the main thread, or offload the processing to Web Workers.

### Q5: What happens if I perform heavy processing inside a requestAnimationFrame callback?

**Answer**: Since rAF callbacks run just before rendering, if processing inside the callback exceeds 16.67ms, rendering for that frame is delayed, causing frame drops (jank). The principle is to only perform "rendering preparation" work inside rAF callbacks — such as DOM updates and style changes — and complete data computation and network communication beforehand. If processing that spans multiple frames is unavoidable, split it into small chunks and execute a portion each frame.

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| Event Loop | An infinite-loop mechanism by which the browser cooperatively processes tasks |
| Task (Macrotask) | A unit of work generated by setTimeout, I/O, UI events, etc. |
| Microtask | A high-priority unit of work generated by Promise.then or queueMicrotask |
| Task Queue | A FIFO queue where tasks are stored in order |
| Microtask Checkpoint | A point where all microtasks in the queue are processed |
| Rendering Pipeline | The processing flow: Style → Layout → Paint → Composite |
| Frame Budget | Time allocated per frame (approximately 16.67ms at 60fps) |
| Forced Synchronous Layout | Forcing layout calculation before a DOM read due to unprocessed style changes |
| Layout Thrashing | Repeated layout calculations caused by alternating reads and writes |
| Jank | Screen stuttering due to frame drops |
| Call Stack | A stack structure that manages the history of function calls |
| Run-to-completion | The property that once a task starts, it cannot be interrupted until it completes |
| Yield | Returning control to the main thread |

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but from actually writing code and observing behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world development?

Knowledge of this topic is frequently utilized in day-to-day development work. It is especially important during code reviews and architectural design.

---

## Summary

| Concept | Execution Timing | Use Case | Important Notes |
|---------|-----------------|----------|----------------|
| Synchronous code | Immediate (on call stack) | Processing requiring immediate execution | Long runs block the UI |
| Microtask | Right after task, all executed | Promise, async/await, MutationObserver | Mass queuing blocks rendering |
| Task (Macrotask) | One at a time, with rendering opportunities | setTimeout, I/O, UI events | Be aware of nesting limit (4ms) |
| rAF | Just before rendering | Animations, batched DOM updates | Avoid heavy processing inside |
| rIC | During idle time | Low-priority processing | No DOM manipulation; not supported in Safari |
| scheduler.postTask | According to priority | Priority-based task scheduling | Limited browser support |

### Design Principles

1. **Be aware of the frame budget**: Design to complete processing within the 16.67ms per-frame budget
2. **Choose the right API**: Use microtasks, tasks, rAF, and rIC appropriately based on processing priority and nature
3. **Split long tasks**: Split tasks exceeding 50ms and apply the "yield to main thread" pattern
4. **Separate reads and writes**: Avoid alternating DOM reads and writes; use batch processing
5. **Optimize based on measurement**: Use the Long Tasks API and Performance Observer to identify bottlenecks

---

## Guides to Read Next

- [Multithreading with Web Workers](02-web-workers.md)
- Service Worker Lifecycle and Event Loop
- Browser Rendering Pipeline in Detail

---

## References

1. WHATWG. "HTML Living Standard -- 8.1.7 Event loops." <https://html.spec.whatwg.org/multipage/webappapis.html#event-loops> (2024)
2. Jake Archibald. "Tasks, microtasks, queues and schedules." <https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/> (2015)
3. Philip Roberts. "What the heck is the event loop anyway?" JSConf EU 2014. <https://www.youtube.com/watch?v=8aGhZQkoFbQ>
4. MDN Web Docs. "The event loop." <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop>
5. MDN Web Docs. "requestAnimationFrame." <https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame>
6. MDN Web Docs. "requestIdleCallback." <https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback>
7. W3C. "Long Tasks API." <https://w3c.github.io/longtasks/>
8. Google Developers. "Optimize long tasks." <https://web.dev/optimize-long-tasks/> (2023)
