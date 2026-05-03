# Web Workers

> Web Workers are a mechanism for running JavaScript in a background thread separate from the main thread. They offload heavy computation to maintain UI responsiveness and bring multithreaded programming patterns to the Web. By correctly using the three types — Dedicated Worker, Shared Worker, and Service Worker — you can build high-performance, offline-capable applications.

## What You Will Learn

- [ ] Understand the basic concepts of Web Workers and the browser thread model
- [ ] Implement Dedicated Worker creation, message passing, and termination
- [ ] Achieve state sharing across multiple tabs with Shared Worker
- [ ] Design Service Worker lifecycle and caching strategies
- [ ] Decide when to use Transferable Objects vs. SharedArrayBuffer
- [ ] Design parallel processing with the Worker pool pattern
- [ ] Understand the types and purposes of Worklets

---

## Prerequisites

- **Browser Event Loop** → Reference: [Event Loop](./01-event-loop-browser.md)
  To understand how Web Workers cooperate with the main thread, you need a prior grasp of the event loop mechanism (task queue, microtasks, rendering timing).

- **V8 Engine Internals** → Reference: [V8 Engine](./00-v8-engine.md)
  Worker threads also run on the V8 engine, so foundational knowledge of JIT compilation, garbage collection, and heap management will make Worker performance tuning easier.

- **Multithreaded Programming Concepts**
  Understanding message passing between Workers, state sharing in Shared Workers, and synchronization with SharedArrayBuffer requires basic concepts of inter-thread communication, race conditions, and mutual exclusion with Atomics.

---

## 1. Browser Thread Model and the Role of Web Workers

### 1.1 Single-Thread Limitations

The browser's main thread (UI thread) handles JavaScript execution, DOM updates, layout calculations, and paint processing all in a single thread. As a result, any long-running computation freezes the screen (jank) and dramatically degrades user experience.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Main Thread (UI Thread)                      │
│                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────────────────────┐ ┌──────┐ ┌──────┐ │
│  │ JS   │ │Layout│ │  Heavy computation   │ │Layout│ │Paint │ │
│  │ exec │ │      │ │  (3 seconds)         │ │      │ │      │ │
│  │      │ │      │ │  ← UI is frozen here │ │      │ │      │ │
│  └──────┘ └──────┘ └──────────────────────┘ └──────┘ └──────┘ │
│  0ms      16ms      33ms ─────────────────── 3033ms   3050ms   │
│                                                                 │
│  Maintaining 60fps requires each frame to complete within      │
│  16.67ms. A 3-second block equals about 180 dropped frames.    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Multithreading with Web Workers

Introducing a Web Worker moves heavy computation to a background thread, freeing the main thread to focus on UI updates.

```
┌───────────────────────────────────────────────────────────────────┐
│  Main Thread                                                      │
│  ┌────┐ ┌──────┐ ┌────┐ ┌──────┐ ┌────┐ ┌──────┐ ┌────────────┐│
│  │ JS │ │Layout│ │ JS │ │Layout│ │ JS │ │Layout│ │ Recv+Render││
│  └────┘ └──────┘ └────┘ └──────┘ └────┘ └──────┘ └────────────┘│
│  0ms    16ms     33ms    50ms     67ms   83ms     ...           │
│    │                                                     ▲       │
│    │ postMessage                            postMessage  │       │
│    ▼                                                     │       │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Worker Thread                                          │     │
│  │  ┌──────────────────────────────────────────────────┐   │     │
│  │  │        Heavy computation (3 seconds)             │   │     │
│  │  │        Does not affect the main thread           │   │     │
│  │  └──────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│  The main thread continues to maintain 60fps                     │
└───────────────────────────────────────────────────────────────────┘
```

### 1.3 Types of Workers and Overview

```
                        Web Worker API
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        Dedicated       Shared         Service
         Worker         Worker          Worker
              │              │              │
        1 page          Multiple       All pages
        dedicated       pages          proxy-type
              │              │              │
        Heavy calc     State sharing   Caching
        Data process   WebSocket share  Offline
        Image process  DB conn share   Push notifications
                                      Background sync

              ┌──────────────────────────┐
              │        Worklet           │
              │  Paint / Animation /     │
              │  Audio / Layout          │
              │  (Lightweight Worker     │
              │   integrated into the    │
              │   rendering pipeline)    │
              └──────────────────────────┘
```

---

## 2. Dedicated Worker

### 2.1 Basic Usage

A Dedicated Worker is the most fundamental Worker type, tied to a single page (specifically, a single script context).

```javascript
// ===== main.js =====

// Creating a Worker
// worker.js is prepared as a separate file from the main script
const worker = new Worker('worker.js');

// Send data to the Worker
worker.postMessage({
  type: 'sort',
  data: generateLargeArray(1_000_000)
});

// Receive results from the Worker
worker.onmessage = (event) => {
  const { type, result, duration } = event.data;
  console.log(`[${type}] Completed: ${duration}ms`);
  renderResult(result);
};

// Catch errors inside the Worker
worker.onerror = (error) => {
  console.error('Worker error:', error.message);
  console.error('File:', error.filename);
  console.error('Line number:', error.lineno);
};

// Terminate the Worker when no longer needed (release resources)
// worker.terminate();


// ===== worker.js =====

// The global scope on the Worker side is `self` (= DedicatedWorkerGlobalScope)
// `window` and `document` do not exist

self.onmessage = (event) => {
  const { type, data } = event.data;
  const start = performance.now();

  switch (type) {
    case 'sort': {
      const sorted = data.sort((a, b) => a - b);
      const duration = Math.round(performance.now() - start);
      self.postMessage({ type, result: sorted, duration });
      break;
    }
    case 'filter': {
      const filtered = data.filter(x => x > 0);
      const duration = Math.round(performance.now() - start);
      self.postMessage({ type, result: filtered, duration });
      break;
    }
    default:
      self.postMessage({ type: 'error', message: `Unknown type: ${type}` });
  }
};

// Voluntarily terminate from inside the Worker
// self.close();
```

### 2.2 APIs Accessible in Workers

A Worker thread has a different global scope from the main thread. It has no access to the DOM whatsoever, but can use some network communication and storage APIs.

| Category | API | Available |
|----------|-----|-----------|
| DOM | document, window, HTMLElement | No |
| Network | fetch, XMLHttpRequest | Yes |
| WebSocket | WebSocket | Yes |
| Timers | setTimeout, setInterval | Yes |
| Storage | IndexedDB | Yes |
| Storage | localStorage, sessionStorage | No |
| URL | URL, URLSearchParams | Yes |
| Crypto | crypto.subtle (Web Crypto API) | Yes |
| Performance | performance.now(), performance.mark() | Yes |
| Console | console.log() etc. | Yes |
| Modules | importScripts() | Yes |
| Encoding | TextEncoder, TextDecoder | Yes |
| Image processing | createImageBitmap, OffscreenCanvas | Yes |
| Notifications | Notification (some browsers) | Limited |

### 2.3 Module Worker

Traditional Workers loaded scripts with `importScripts()`, but a Module Worker supporting ES Modules allows the use of `import`/`export` syntax.

```javascript
// ===== main.js =====

// Specifying type: 'module' loads it as an ES Module
const worker = new Worker('worker.js', { type: 'module' });

worker.postMessage({ numbers: [5, 3, 8, 1, 9, 2, 7] });

worker.onmessage = (event) => {
  console.log('Statistics result:', event.data);
};


// ===== worker.js (Module Worker) =====

// ES Module imports are available
import { mean, median, standardDeviation } from './statistics.js';

self.onmessage = (event) => {
  const { numbers } = event.data;

  const result = {
    mean: mean(numbers),
    median: median(numbers),
    stdDev: standardDeviation(numbers),
    count: numbers.length
  };

  self.postMessage(result);
};


// ===== statistics.js =====

export function mean(arr) {
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

export function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function standardDeviation(arr) {
  const avg = mean(arr);
  const squareDiffs = arr.map(v => (v - avg) ** 2);
  return Math.sqrt(mean(squareDiffs));
}
```

### 2.4 Inline Worker (Blob URL Pattern)

A technique for defining the Worker code inline in the main script rather than as a separate file. Useful for bundler integration or keeping everything in a single file.

```javascript
// Define the Worker code as a string
function createInlineWorker(workerFunction) {
  const blob = new Blob(
    [`(${workerFunction.toString()})()`],
    { type: 'application/javascript' }
  );
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  // Blob URL can be released immediately (Worker is already loaded)
  URL.revokeObjectURL(url);

  return worker;
}

// Usage
const worker = createInlineWorker(function() {
  self.onmessage = (event) => {
    const { data } = event;
    // Fibonacci sequence computation (iterative, not recursive)
    function fibonacci(n) {
      if (n <= 1) return n;
      let prev = 0, curr = 1;
      for (let i = 2; i <= n; i++) {
        [prev, curr] = [curr, prev + curr];
      }
      return curr;
    }
    self.postMessage({
      input: data.n,
      result: fibonacci(data.n)
    });
  };
});

worker.postMessage({ n: 45 });
worker.onmessage = (e) => console.log(e.data);
// { input: 45, result: 1134903170 }
```

### 2.5 Worker Pool Pattern

Creating a Worker has a cost (a few to several tens of milliseconds). When tasks are submitted frequently, it is efficient to pre-create multiple Workers in a pool and distribute tasks using round-robin or queue-based dispatch.

```javascript
// ===== WorkerPool.js =====

class WorkerPool {
  constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
    this.poolSize = poolSize;
    this.workers = [];
    this.taskQueue = [];
    this.workerStatus = [];  // true = idle, false = busy

    // Create Workers equal to pool size
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerScript, { type: 'module' });
      this.workers.push(worker);
      this.workerStatus.push(true);  // Initially idle
    }
  }

  // Submit a task and return the result as a Promise
  exec(data) {
    return new Promise((resolve, reject) => {
      const task = { data, resolve, reject };

      // Look for an idle Worker
      const idleIndex = this.workerStatus.indexOf(true);
      if (idleIndex !== -1) {
        this._runTask(idleIndex, task);
      } else {
        // If all Workers are busy, queue the task
        this.taskQueue.push(task);
      }
    });
  }

  _runTask(workerIndex, task) {
    this.workerStatus[workerIndex] = false;  // Set to busy
    const worker = this.workers[workerIndex];

    const onMessage = (event) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      this.workerStatus[workerIndex] = true;  // Return to idle

      task.resolve(event.data);
      this._processQueue();  // Process queued tasks if any
    };

    const onError = (error) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      this.workerStatus[workerIndex] = true;

      task.reject(error);
      this._processQueue();
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage(task.data);
  }

  _processQueue() {
    if (this.taskQueue.length === 0) return;
    const idleIndex = this.workerStatus.indexOf(true);
    if (idleIndex === -1) return;
    const task = this.taskQueue.shift();
    this._runTask(idleIndex, task);
  }

  // Terminate all Workers
  terminate() {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.workerStatus = [];
    // Reject unprocessed tasks in the queue
    this.taskQueue.forEach(task =>
      task.reject(new Error('WorkerPool terminated'))
    );
    this.taskQueue = [];
  }

  // Get pool status
  get stats() {
    return {
      poolSize: this.poolSize,
      idle: this.workerStatus.filter(s => s).length,
      busy: this.workerStatus.filter(s => !s).length,
      queued: this.taskQueue.length
    };
  }
}


// ===== Usage =====

const pool = new WorkerPool('compute-worker.js', 4);

// Execute 100 tasks in parallel (max 4 parallel)
const tasks = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  type: 'heavyComputation',
  payload: generateData(i)
}));

const results = await Promise.all(
  tasks.map(task => pool.exec(task))
);

console.log(`All ${results.length} tasks completed`);
console.log('Pool status:', pool.stats);

// Release resources when done
pool.terminate();
```

```
Worker pool operation:

  Task Queue          Worker Pool (size = 4)
  ┌─────────┐
  │ Task 8   │     ┌────────────────────────────────┐
  │ Task 7   │     │ Worker 0: [Task 1] ■■■■□□□□    │
  │ Task 6   │     │ Worker 1: [Task 2] ■■■□□□□□    │
  │ Task 5   │     │ Worker 2: [Task 3] ■■■■■■□□    │
  │          │────→│ Worker 3: [Task 4] ■■□□□□□□    │
  └─────────┘     └────────────────────────────────┘
                          │
                          ▼ On task completion
                    Dequeue next task from queue

  ■ = progress of processing
  □ = remaining processing

  Worker 3 completes Task 4
    → Worker 3 becomes idle
    → Dequeue Task 5 from queue
    → Worker 3 starts processing Task 5
```

---

## 3. Message Passing in Detail

### 3.1 Structured Clone Algorithm

Data sent with `postMessage()` is deep-copied by the Structured Clone algorithm by default. It supports more types than `JSON.parse(JSON.stringify())`.

| Data Type | Structured Clone | JSON | Notes |
|-----------|:----------------:|:----:|-------|
| Primitives (string, number, boolean) | Yes | Yes | |
| null, undefined | Yes | null only | undefined disappears in JSON |
| Date | Yes | Stringified | JSON converts Date to string |
| RegExp | Yes | Empty object | JSON converts RegExp to {} |
| Map, Set | Yes | No | Not supported by JSON |
| ArrayBuffer, TypedArray | Yes | No | Binary data |
| Blob, File | Yes | No | |
| ImageData, ImageBitmap | Yes | No | |
| Error | Yes | No | Only name and message |
| Function | No | No | Functions cannot be cloned |
| DOM nodes | No | No | |
| Symbol | No | No | |
| WeakMap, WeakRef | No | No | Weak references cannot be transferred |
| Class instances | Properties only | Properties only | Prototype chain is lost |

### 3.2 Message Serialization Cost

Structured Clone incurs a copy cost. The larger the data, the more time the copy takes.

```
Approximate cost of Structured Clone (varies by browser and environment):

  Data size          Approximate copy time
  ─────────────────────────────────
    1 KB             < 0.01 ms
   10 KB             ~ 0.05 ms
  100 KB             ~ 0.5  ms
    1 MB             ~ 5    ms
   10 MB             ~ 50   ms
  100 MB             ~ 500  ms

  Note: These are general reference values. They can vary greatly
  depending on data structure (nesting depth, number of objects)
  and the browser engine. In actual applications, verify with profiling.
```

### 3.3 Designing a Message Protocol

For complex applications, it is good practice to establish a protocol for messages between Workers and the main thread.

```javascript
// ===== message-protocol.js =====

// Define message types (use interface / type in TypeScript)
const MessageType = {
  // Main thread → Worker
  REQUEST_COMPUTE: 'REQUEST_COMPUTE',
  REQUEST_CANCEL:  'REQUEST_CANCEL',

  // Worker → Main thread
  RESPONSE_SUCCESS: 'RESPONSE_SUCCESS',
  RESPONSE_ERROR:   'RESPONSE_ERROR',
  PROGRESS_UPDATE:  'PROGRESS_UPDATE',
};

// Utility for generating request IDs
let requestIdCounter = 0;
function generateRequestId() {
  return `req_${Date.now()}_${++requestIdCounter}`;
}

// ===== main.js =====

const pendingRequests = new Map();

function sendRequest(worker, payload) {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();

    pendingRequests.set(requestId, {
      resolve,
      reject,
      startTime: performance.now()
    });

    worker.postMessage({
      type: MessageType.REQUEST_COMPUTE,
      requestId,
      payload
    });
  });
}

worker.onmessage = (event) => {
  const { type, requestId, data, error, progress } = event.data;

  switch (type) {
    case MessageType.RESPONSE_SUCCESS: {
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pendingRequests.delete(requestId);
        pending.resolve(data);
      }
      break;
    }
    case MessageType.RESPONSE_ERROR: {
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pendingRequests.delete(requestId);
        pending.reject(new Error(error));
      }
      break;
    }
    case MessageType.PROGRESS_UPDATE: {
      console.log(`[${requestId}] Progress: ${progress}%`);
      // Update progress bar in the UI, etc.
      break;
    }
  }
};

// Usage: call the Worker in a Promise-based way
async function processData(rawData) {
  try {
    const result = await sendRequest(worker, {
      operation: 'analyze',
      data: rawData
    });
    console.log('Result:', result);
  } catch (err) {
    console.error('Processing failed:', err.message);
  }
}


// ===== worker.js =====

self.onmessage = (event) => {
  const { type, requestId, payload } = event.data;

  if (type === MessageType.REQUEST_COMPUTE) {
    try {
      const totalSteps = 100;
      let result = [];

      for (let i = 0; i < totalSteps; i++) {
        // Report progress periodically
        if (i % 10 === 0) {
          self.postMessage({
            type: MessageType.PROGRESS_UPDATE,
            requestId,
            progress: Math.round((i / totalSteps) * 100)
          });
        }
        // Actual computation
        result.push(compute(payload.data, i));
      }

      self.postMessage({
        type: MessageType.RESPONSE_SUCCESS,
        requestId,
        data: result
      });
    } catch (err) {
      self.postMessage({
        type: MessageType.RESPONSE_ERROR,
        requestId,
        error: err.message
      });
    }
  }
};
```

---

## 4. Transferable Objects

### 4.1 Ownership Transfer

Because Structured Clone copies data, transferring large binary data has significant overhead. With Transferable Objects, you can transfer "ownership" of the memory region — which is nearly zero-cost.

```javascript
// ===== Comparison: Structured Clone (copy) vs. Transfer (ownership transfer) =====

// --- Method 1: Structured Clone (default) ---
const buffer1 = new ArrayBuffer(100 * 1024 * 1024); // 100MB
console.log('Before send:', buffer1.byteLength); // 104857600

worker.postMessage(buffer1);  // A copy is made (tens of ms)
console.log('After send:', buffer1.byteLength); // 104857600 (original remains)


// --- Method 2: Transfer (ownership transfer) ---
const buffer2 = new ArrayBuffer(100 * 1024 * 1024); // 100MB
console.log('Before send:', buffer2.byteLength); // 104857600

worker.postMessage(buffer2, [buffer2]);  // Transfer ownership (nearly 0ms)
console.log('After send:', buffer2.byteLength); // 0 (no longer accessible)

// Using buffer2 after transfer does not throw an error,
// but byteLength becomes 0 and TypedArray views become empty
```

### 4.2 List of Transferable Types

| Type | Use Case | Notes |
|------|----------|-------|
| ArrayBuffer | General binary data | Most common Transferable |
| MessagePort | Direct communication channel between Workers | Channel Messaging API |
| ImageBitmap | Image data | Created with createImageBitmap() |
| OffscreenCanvas | Canvas rendering inside Workers | Transfers drawing rights |
| ReadableStream | Transfer of stream ownership | Streams API |
| WritableStream | Transfer of stream ownership | Streams API |
| TransformStream | Transfer of stream ownership | Streams API |
| VideoFrame | Video frames | WebCodecs API |
| AudioData | Audio data | WebCodecs API |

### 4.3 Using Transferable Objects for Image Processing

```javascript
// ===== main.js: Delegate grayscale conversion to a Worker =====

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

async function processImage(imageElement) {
  // Convert image to ImageBitmap
  const bitmap = await createImageBitmap(imageElement);

  // Get ImageData using OffscreenCanvas
  const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
  const offCtx = offscreen.getContext('2d');
  offCtx.drawImage(bitmap, 0, 0);
  const imageData = offCtx.getImageData(0, 0, bitmap.width, bitmap.height);

  // Transfer the internal buffer of ImageData to the Worker
  // imageData.data is a Uint8ClampedArray; its buffer is an ArrayBuffer
  const buffer = imageData.data.buffer;

  worker.postMessage(
    {
      type: 'grayscale',
      width: imageData.width,
      height: imageData.height,
      buffer: buffer
    },
    [buffer]  // Transfer the buffer
  );
}

worker.onmessage = (event) => {
  const { width, height, buffer } = event.data;
  const resultData = new ImageData(
    new Uint8ClampedArray(buffer),
    width,
    height
  );
  ctx.putImageData(resultData, 0, 0);
};


// ===== worker.js =====

self.onmessage = (event) => {
  const { type, width, height, buffer } = event.data;

  if (type === 'grayscale') {
    const pixels = new Uint8ClampedArray(buffer);

    // Grayscale conversion
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // Weighted average of luminance (ITU-R BT.709)
      const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      pixels[i] = gray;
      pixels[i + 1] = gray;
      pixels[i + 2] = gray;
      // pixels[i + 3] is the alpha value (do not change)
    }

    // Return the processed buffer via Transfer
    self.postMessage(
      { width, height, buffer: pixels.buffer },
      [pixels.buffer]
    );
  }
};
```

### 4.4 SharedArrayBuffer and Atomics

SharedArrayBuffer is neither Transfer nor Clone; it is a mechanism by which multiple threads share the same memory region. Shared memory access carries a risk of race conditions, so thread-safe operations are performed with the Atomics API.

```javascript
// ===== main.js =====

// Cross-Origin Isolation is required (HTTP header configuration):
// Cross-Origin-Opener-Policy: same-origin
// Cross-Origin-Embedder-Policy: require-corp

// Allocate shared memory
const sharedBuffer = new SharedArrayBuffer(4 * 1024); // 4KB
const sharedArray = new Int32Array(sharedBuffer);

// Set initial value
sharedArray[0] = 0; // counter

// Pass the shared memory to a Worker (shared, not transferred)
worker.postMessage({ sharedBuffer });

// Safely increment the counter from the main thread
function incrementCounter() {
  const oldValue = Atomics.add(sharedArray, 0, 1);
  console.log(`Counter: ${oldValue} → ${oldValue + 1}`);
}

// Safely read the counter value
function readCounter() {
  return Atomics.load(sharedArray, 0);
}


// ===== worker.js =====

self.onmessage = (event) => {
  const { sharedBuffer } = event.data;
  const sharedArray = new Int32Array(sharedBuffer);

  // Safely increment the counter from the Worker side
  for (let i = 0; i < 1000; i++) {
    Atomics.add(sharedArray, 0, 1);
  }

  // Synchronization with Atomics.wait / Atomics.notify
  // Wait for a value change in the Worker thread
  // (Atomics.wait cannot be used on the main thread)
  const result = Atomics.wait(sharedArray, 1, 0);
  // result: 'ok' | 'not-equal' | 'timed-out'

  self.postMessage({ done: true, counter: Atomics.load(sharedArray, 0) });
};
```

```
Choosing between SharedArrayBuffer and Transferable Objects:

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   Structured Clone (default)                                │
  │   ┌─────────┐    Copy    ┌─────────┐                        │
  │   │ Main    │ ─────────→ │ Worker  │   Both threads hold    │
  │   │ [ABCDE] │            │ [ABCDE] │   independent copies   │
  │   └─────────┘            └─────────┘                        │
  │                                                             │
  │   Transfer (ownership transfer)                             │
  │   ┌─────────┐  Transfer  ┌─────────┐                        │
  │   │ Main    │ ─────────→ │ Worker  │   Sender loses access  │
  │   │ [     ] │            │ [ABCDE] │   Fast (zero-copy)     │
  │   └─────────┘            └─────────┘                        │
  │                                                             │
  │   SharedArrayBuffer (shared memory)                         │
  │   ┌─────────┐            ┌─────────┐                        │
  │   │ Main    │            │ Worker  │   Both reference same  │
  │   │    ↓    │            │    ↓    │   memory region        │
  │   │  ┌─────────────────────────┐   │   Requires Atomics     │
  │   │  │      [ABCDE]            │   │   for synchronization  │
  │   │  │   Shared memory region  │   │                        │
  │   │  └─────────────────────────┘   │                        │
  │   └─────────┘            └─────────┘                        │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

---

## 5. Shared Worker

### 5.1 Basic Concepts

A Shared Worker can be connected to by multiple pages (tabs or frames) from the same origin. Unlike Dedicated Workers, it manages connections via the `onconnect` event and communicates through a `MessagePort`.

```javascript
// ===== main.js (placed on each page) =====

// Creating a Shared Worker
// Specifying the same URL connects to an existing Shared Worker
const sharedWorker = new SharedWorker('shared-worker.js');

// Communication with the Shared Worker goes through a port
const port = sharedWorker.port;

// Start the port (automatically started when using onmessage)
// port.start();  // Call explicitly when using addEventListener

// Sending a message
port.postMessage({
  type: 'increment',
  tabId: crypto.randomUUID()
});

// Receiving a message
port.onmessage = (event) => {
  const { type, count, connections } = event.data;
  console.log(`Count: ${count}, Connected tabs: ${connections}`);
  document.getElementById('counter').textContent = count;
  document.getElementById('tabs').textContent = connections;
};


// ===== shared-worker.js =====

// List of connected ports
const ports = new Set();
let counter = 0;

self.onconnect = (event) => {
  const port = event.ports[0];
  ports.add(port);

  console.log(`New connection. Current connections: ${ports.size}`);

  port.onmessage = (msgEvent) => {
    const { type, tabId } = msgEvent.data;

    switch (type) {
      case 'increment':
        counter++;
        // Notify all connections (broadcast)
        broadcastToAll({
          type: 'update',
          count: counter,
          connections: ports.size
        });
        break;

      case 'getState':
        // Reply only to the requester
        port.postMessage({
          type: 'state',
          count: counter,
          connections: ports.size
        });
        break;
    }
  };

  // Cleanup when connection is closed
  port.addEventListener('close', () => {
    ports.delete(port);
    console.log(`Disconnected. Remaining connections: ${ports.size}`);
  });

  // Send current state on connection
  port.postMessage({
    type: 'state',
    count: counter,
    connections: ports.size
  });

  port.start();
};

function broadcastToAll(message) {
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch (e) {
      // Remove port if it is closed
      ports.delete(port);
    }
  }
}
```

### 5.2 Major Use Cases for Shared Worker

```
  Representative use cases for Shared Worker:

  1. Sharing a WebSocket connection
  ┌────────┐     ┌────────┐     ┌────────┐
  │ Tab A  │     │ Tab B  │     │ Tab C  │
  └───┬────┘     └───┬────┘     └───┬────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
           ┌─────────┴─────────┐
           │   Shared Worker   │
           │  ┌─────────────┐  │
           │  │ WebSocket   │  │  ← Only 1 connection
           │  │ connection  │  │    reduces server load
           │  └──────┬──────┘  │
           └─────────┼─────────┘
                     │
              ┌──────┴──────┐
              │   Server    │
              └─────────────┘

  2. Shared cache / state management
     Share the same data across multiple tabs, preventing duplicate fetches

  3. Logging / analytics aggregation
     Aggregate events from each tab in Shared Worker and batch-send
```

---

## 6. Service Worker

### 6.1 Lifecycle

A Service Worker is a programmable proxy that sits between the page and the network. It has a lifecycle that differs significantly from ordinary Workers.

```
Service Worker lifecycle:

  ┌──────────┐
  │Unregistered│  navigator.serviceWorker.register('/sw.js')
  └────┬─────┘
       │
       ▼
  ┌──────────┐
  │Registering │  Browser downloads and parses sw.js
  │(installing)│
  └────┬─────┘
       │  install event fires
       │  event.waitUntil() can wait for async processing
       ▼
  ┌──────────┐    If an old SW is already active
  │ Waiting  │─────────────────────────────────────┐
  │(waiting) │  Waits until all tabs controlled by  │
  └────┬─────┘  old SW are closed                  │
       │        (avoidable with skipWaiting())      │
       │                                            │
       │  All clients released                      │
       │  or self.skipWaiting() is called           │
       ▼                                            │
  ┌──────────┐                                      │
  │Activating│  activate event fires                │
  │(activating)│  Best time to delete old caches   │
  └────┬─────┘                                      │
       │                                            │
       ▼                                            │
  ┌──────────┐                                      │
  │ Active   │  Can intercept fetch, push, sync     │
  │(activated)│  events, etc.                       │
  └────┬─────┘                                      │
       │                                            │
       │  New version of sw.js is detected          │
       ▼                                            │
  ┌──────────┐                                      │
  │ Redundant│  Replaced by new SW                  │
  │(redundant)│  or registration/install failed    │
  └──────────┘  ← ───────────────────────────────-─┘
```

### 6.2 Registration and Installation

```javascript
// ===== app.js (main script) =====

// Service Worker registration
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker is not supported in this browser');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      // Scope: path prefix this SW controls
      scope: '/'
    });

    console.log('SW registered:', registration.scope);

    // Detect updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('New SW detected:', newWorker.state);

      newWorker.addEventListener('statechange', () => {
        console.log('SW state changed:', newWorker.state);
        if (newWorker.state === 'activated') {
          // New SW has become active
          // e.g., show UI prompting user to reload
          showUpdateNotification();
        }
      });
    });
  } catch (error) {
    console.error('SW registration failed:', error);
  }
}

// Register after page load
window.addEventListener('load', registerServiceWorker);
```

### 6.3 Implementing Caching Strategies

The most important feature of Service Workers is intercepting network requests and controlling caching. Here we implement representative caching strategies.

```javascript
// ===== sw.js =====

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Static assets to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/images/logo.png',
  '/offline.html'
];

// ===== Install: Precache static assets =====
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Starting precache');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Skip waiting state (activate immediately)
        return self.skipWaiting();
      })
  );
});

// ===== Activate: Delete old caches =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map(name => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// ===== Fetch: Intercept requests =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network First strategy for API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache First strategy for static assets
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stale While Revalidate strategy for other requests
  event.respondWith(staleWhileRevalidate(request));
});


// ===== Caching strategy implementations =====

// Cache First: cache first, network if not cached
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return caches.match('/offline.html');
  }
}

// Network First: network first, cache on failure
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'You are offline' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Stale While Revalidate: return cache immediately, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  // Return cache immediately if available; otherwise wait for network
  return cached || fetchPromise;
}
```

### 6.4 Caching Strategy Comparison Table

| Strategy | Behavior | Best Use Case | Offline Support | Freshness |
|----------|----------|---------------|:--------------:|-----------|
| Cache First | Cache first, network if missing | Static assets (CSS, JS, images) | High | Low (manual update required) |
| Network First | Network first, cache on failure | API responses, frequently updated data | Medium | High |
| Stale While Revalidate | Return cache immediately + background update | News feeds, social timelines | Medium | Medium (reflected on next access) |
| Network Only | Always network | Non-idempotent requests (POST), real-time data | No | Highest |
| Cache Only | Always cache | Pre-cached static resources | Highest | None (fixed at build time) |

### 6.5 Background Sync

Service Worker's background sync feature allows saving operations performed while offline and automatically sending them to the server when the network is restored.

```javascript
// ===== app.js (main script) =====

async function sendMessage(message) {
  // Save message to IndexedDB
  await saveToOutbox(message);

  // Register Background Sync
  const registration = await navigator.serviceWorker.ready;
  try {
    await registration.sync.register('outbox-sync');
    console.log('Background Sync registered');
  } catch (err) {
    console.error('Background Sync not supported:', err);
    // Fallback: try to send immediately
    await sendPendingMessages();
  }
}


// ===== sw.js =====

// sync event fires automatically when network is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') {
    event.waitUntil(sendPendingMessages());
  }
});

async function sendPendingMessages() {
  const messages = await getFromOutbox(); // Retrieve from IndexedDB

  const results = await Promise.allSettled(
    messages.map(async (msg) => {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });

      if (response.ok) {
        await removeFromOutbox(msg.id); // Delete on successful send
        return { id: msg.id, status: 'sent' };
      }
      throw new Error(`Send failed: ${response.status}`);
    })
  );

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    throw new Error(`Failed to send ${failed.length} message(s)`);
    // Throwing an error causes the browser to retry later
  }
}
```

### 6.6 Push Notifications

Service Workers integrate with the Push API to receive push notifications from the server. Notifications can be displayed even when the browser is closed (in the background).

```javascript
// ===== app.js =====

async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;

  // Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission not granted');
    return;
  }

  // Create a push subscription
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // Visible notifications only (Chrome requirement)
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  // Send subscription information to the server
  await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}


// ===== sw.js =====

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'You have a notification',
    icon: '/images/notification-icon.png',
    badge: '/images/badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notification', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus an already-open tab if available
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(targetUrl);
      })
  );
});
```

---

## 7. Inter-Worker Communication and Channel Messaging

### 7.1 Direct Communication with MessageChannel

Normally, Workers can only communicate through the main thread. However, using MessageChannel, you can create a direct communication channel between two Workers.

```javascript
// ===== main.js =====

const workerA = new Worker('workerA.js');
const workerB = new Worker('workerB.js');

// Create a MessageChannel
const channel = new MessageChannel();

// Transfer port1 to workerA and port2 to workerB
workerA.postMessage({ type: 'setPort', port: channel.port1 }, [channel.port1]);
workerB.postMessage({ type: 'setPort', port: channel.port2 }, [channel.port2]);

// From this point, workerA and workerB can communicate directly
// without going through the main thread


// ===== workerA.js =====

let directPort = null;

self.onmessage = (event) => {
  if (event.data.type === 'setPort') {
    directPort = event.data.port;
    directPort.onmessage = (e) => {
      console.log('[WorkerA] Direct message from WorkerB:', e.data);
    };
    // Send a direct message to WorkerB
    directPort.postMessage({ from: 'A', message: 'Direct communication test' });
  }
};


// ===== workerB.js =====

let directPort = null;

self.onmessage = (event) => {
  if (event.data.type === 'setPort') {
    directPort = event.data.port;
    directPort.onmessage = (e) => {
      console.log('[WorkerB] Direct message from WorkerA:', e.data);
      // Reply
      directPort.postMessage({
        from: 'B',
        message: 'Acknowledged, direct communication successful'
      });
    };
  }
};
```

```
Direct Worker-to-Worker communication with MessageChannel:

  Normal communication (through main thread):
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Worker A │ →  │  Main    │ →  │ Worker B │
  │          │ ←  │ Thread   │ ←  │          │
  └──────────┘    └──────────┘    └──────────┘
  Main thread can become a bottleneck

  MessageChannel (direct communication):
  ┌──────────┐                    ┌──────────┐
  │ Worker A │ ←── port1──port2 ──→ │ Worker B │
  │          │  MessageChannel    │          │
  └──────────┘                    └──────────┘
  Fast communication without going through the main thread
```

### 7.2 Many-to-Many Communication with BroadcastChannel

BroadcastChannel is a mechanism for broadcasting messages to all contexts of the same origin (pages, Workers, Service Workers).

```javascript
// ===== Any context (can be a page or Worker) =====

// Specifying the same channel name automatically connects
const channel = new BroadcastChannel('app-events');

// Send a message (delivered to all listeners)
channel.postMessage({
  type: 'user-login',
  userId: 'user123',
  timestamp: Date.now()
});

// Receive messages
channel.onmessage = (event) => {
  const { type, userId } = event.data;
  if (type === 'user-login') {
    console.log(`User ${userId} logged in`);
    updateUI();
  }
};

// Close when no longer needed
// channel.close();
```

```
BroadcastChannel communication model:

  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
  │  Tab A   │  │  Tab B   │  │ Worker   │  │ Service Worker│
  │          │  │          │  │          │  │              │
  │ channel  │  │ channel  │  │ channel  │  │ channel      │
  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘
       │             │             │               │
       └─────────────┴─────────────┴───────────────┘
                           │
                BroadcastChannel('app-events')
                           │
            All listeners except the sender receive the message
```

---

## 8. Worklet

### 8.1 Differences Between Worklets and Workers

A Worklet is a lightweight Worker integrated into the rendering pipeline. Unlike ordinary Workers, it can directly intervene in browser internal processing (rendering, layout, audio processing).

| Property | Worker | Worklet |
|----------|--------|---------|
| Thread model | Independent background thread | Rendering pipeline integrated |
| Creation cost | Relatively high | Lightweight |
| Global scope | DedicatedWorkerGlobalScope | Each Worklet has its own scope |
| postMessage | Available | Unavailable (no direct communication) |
| DOM access | Unavailable | Unavailable |
| Purpose | General computation offloading | Pipeline-specific processing |
| Execution guarantee | Explicit start/stop | Browser runs when needed |
| Modules | importScripts / ES Modules | ES Modules only |

### 8.2 Paint Worklet (CSS Houdini)

A Paint Worklet draws a CSS `background-image` programmatically. It supports free drawing with an interface similar to the Canvas API.

```javascript
// ===== main.js =====

if ('paintWorklet' in CSS) {
  CSS.paintWorklet.addModule('paint-worklet.js');
}


// ===== paint-worklet.js =====

class GradientBorderPainter {
  // Declare dependency on CSS custom properties
  static get inputProperties() {
    return [
      '--border-width',
      '--gradient-start',
      '--gradient-end'
    ];
  }

  paint(ctx, size, properties) {
    const borderWidth = parseInt(properties.get('--border-width')) || 4;
    const startColor = properties.get('--gradient-start').toString().trim()
      || '#ff6b6b';
    const endColor = properties.get('--gradient-end').toString().trim()
      || '#4ecdc4';

    // Draw gradient border
    const gradient = ctx.createLinearGradient(0, 0, size.width, size.height);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(
      borderWidth / 2,
      borderWidth / 2,
      size.width - borderWidth,
      size.height - borderWidth
    );
  }
}

registerPaint('gradient-border', GradientBorderPainter);


// ===== styles.css =====
/*
.card {
  --border-width: 4;
  --gradient-start: #ff6b6b;
  --gradient-end: #4ecdc4;
  background-image: paint(gradient-border);
}
*/
```

### 8.3 Audio Worklet

An Audio Worklet performs real-time signal processing for the Web Audio API. It is a high-performance alternative to the deprecated ScriptProcessorNode (which ran on the main thread).

```javascript
// ===== main.js =====

async function setupAudioWorklet() {
  const audioContext = new AudioContext();

  // Register the Audio Worklet module
  await audioContext.audioWorklet.addModule('audio-processor.js');

  // Create a custom AudioWorkletNode
  const gainNode = new AudioWorkletNode(audioContext, 'custom-gain');

  // Control parameters
  const gainParam = gainNode.parameters.get('gain');
  gainParam.value = 0.5; // Set volume to half

  // Input → Custom processing → Output
  const source = audioContext.createMediaStreamSource(
    await navigator.mediaDevices.getUserMedia({ audio: true })
  );
  source.connect(gainNode).connect(audioContext.destination);
}


// ===== audio-processor.js =====

class CustomGainProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: 'gain',
      defaultValue: 1.0,
      minValue: 0.0,
      maxValue: 2.0,
      automationRate: 'a-rate' // Can vary per sample
    }];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const gain = parameters.gain;

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        // If gain parameter is a-rate, it can have different values per sample
        const g = gain.length > 1 ? gain[i] : gain[0];
        outputChannel[i] = inputChannel[i] * g;
      }
    }

    return true; // Returning true continues processing
  }
}

registerProcessor('custom-gain', CustomGainProcessor);
```

---

## 9. Comprehensive Comparison of Worker Types

### 9.1 Feature Comparison Table

```
┌────────────────────┬───────────────┬───────────────┬───────────────┬────────────────┐
│                    │ Dedicated     │ Shared        │ Service       │ Worklet        │
│                    │ Worker        │ Worker        │ Worker        │                │
├────────────────────┼───────────────┼───────────────┼───────────────┼────────────────┤
│ Scope              │ 1 page        │ Same origin   │ Same origin   │ Specific proc. │
│ Connections        │ 1             │ Multiple pages│ All pages     │ N/A            │
│ DOM access         │ No            │ No            │ No            │ No             │
│ Lifecycle          │ Same as page  │ Until all tabs│ Independent   │ Browser-managed│
│                    │               │ close         │ (persistent)  │                │
│ Offline support    │ No            │ No            │ Yes           │ No             │
│ Push notifications │ No            │ No            │ Yes           │ No             │
│ Network control    │ No            │ No            │ Yes           │ No             │
│ fetch() available  │ Yes           │ Yes           │ Yes           │ No             │
│ IndexedDB          │ Yes           │ Yes           │ Yes           │ No             │
│ postMessage        │ Yes           │ Yes (via port)│ Yes           │ No             │
│ ES Modules         │ Yes           │ Yes           │ Yes           │ Required       │
│ HTTPS required     │ No            │ No            │ Yes           │ No             │
│ DevTools support   │ Good          │ Limited       │ Good          │ Limited        │
│ Browser support    │ All modern    │ Limited       │ All modern    │ Partial        │
├────────────────────┼───────────────┼───────────────┼───────────────┼────────────────┤
│ Main uses          │ Heavy calc    │ State sharing │ Caching       │ Rendering ext. │
│                    │ Data process  │ WebSocket sh. │ PWA           │ Audio process  │
│                    │ Image/video   │ DB conn share │ Push / Sync   │ Animation      │
└────────────────────┴───────────────┴───────────────┴───────────────┴────────────────┘
```

### 9.2 Selection Guide by Use Case

```
Which Worker should I use? Flowchart:

  ┌─────────────────────────────────────────┐
  │  What do you want to do?                │
  └───────────┬─────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
  Offload heavy       Control the
  computation         network
    │                    │
    │                    ▼
    │              ┌──────────────┐
    │              │ Service Worker│
    │              │ Caching       │
    │              │ Offline       │
    │              │ Push notif.   │
    │              └──────────────┘
    │
    ├── Only needed in 1 page?
    │     │
    │     ├── Yes → Dedicated Worker
    │     │
    │     └── No → Want to share across multiple tabs?
    │               │
    │               ├── Yes → Shared Worker
    │               │
    │               └── No → Dedicated Worker
    │                          (one per page)
    │
    └── Rendering-related processing?
          │
          ├── Customizing drawing → Paint Worklet
          ├── Smooth animations → Animation Worklet
          ├── Real-time audio processing → Audio Worklet
          └── Custom layout → Layout Worklet (experimental)
```

---

## 10. Anti-Patterns and Improvements

### 10.1 Anti-Pattern 1: Creating Too Many Workers

```javascript
// ===== BAD: Create and destroy a Worker for each task =====

async function processItems(items) {
  const results = [];
  for (const item of items) {
    // Create a Worker every time (overhead of a few ms × 1000 times)
    const worker = new Worker('process.js');

    const result = await new Promise((resolve) => {
      worker.onmessage = (e) => {
        resolve(e.data);
        worker.terminate();  // Terminate every time
      };
      worker.postMessage(item);
    });

    results.push(result);
  }
  return results;
}
// Problem: High cost of creating/destroying Workers
// Problem: Not executed in parallel (sequential)
// Problem: Potential memory leaks


// ===== GOOD: Reuse Workers with a pool =====

const pool = new WorkerPool('process.js', 4);

async function processItems(items) {
  // Queue all tasks in parallel (max 4 parallel)
  const results = await Promise.all(
    items.map(item => pool.exec(item))
  );
  return results;
}
// Workers are reused, so creation cost is only at initialization
// Maximum concurrency can be controlled
// Resources are reliably released with explicit terminate
```

### 10.2 Anti-Pattern 2: Needlessly Copying Large Data

```javascript
// ===== BAD: Copy a large buffer every frame =====

function processVideoFrame(frameBuffer) {
  // 100MB buffer is copied every frame
  worker.postMessage({ frame: frameBuffer });
  // frameBuffer still remains in the main thread
  // Memory is consumed twice until GC
}

worker.onmessage = (event) => {
  // Results are also returned by copy
  const processedFrame = event.data.result;
  renderFrame(processedFrame);
};

// Problem: At 30fps video processing, 6GB of memory copying per second
// Problem: GC pressure increases and performance becomes unstable


// ===== GOOD: Transfer ownership with Transferable Objects =====

function processVideoFrame(frameBuffer) {
  // Transfer ownership to Worker (zero-copy)
  worker.postMessage(
    { frame: frameBuffer },
    [frameBuffer]  // Include in Transfer list
  );
  // frameBuffer.byteLength === 0 (no longer usable)
}

worker.onmessage = (event) => {
  // Also returned from Worker by Transfer
  const processedFrame = event.data.result;
  renderFrame(processedFrame);
  // Transfer back to Worker for next frame processing
};

// Zero-copy, so no problems even at 30fps
// Memory usage is also minimal


// ===== BETTER: Shared memory with SharedArrayBuffer (requires CORS config) =====

const frameBuffer = new SharedArrayBuffer(frameSize);
const mainView = new Uint8Array(frameBuffer);
const statusArray = new Int32Array(new SharedArrayBuffer(4));
// statusArray[0]: 0 = idle, 1 = processing, 2 = done

worker.postMessage({ frameBuffer, statusArray });

function processVideoFrame(rawFrame) {
  // Write to shared memory
  mainView.set(rawFrame);
  // Notify Worker to start processing
  Atomics.store(statusArray, 0, 1);
  Atomics.notify(statusArray, 0);
}

// No copy or memory transfer occurs
```

### 10.3 Anti-Pattern 3: Missing Error Handling

```javascript
// ===== BAD: Errors are ignored =====

const worker = new Worker('worker.js');
worker.postMessage(data);
worker.onmessage = (e) => {
  updateUI(e.data);
};
// If an error occurs inside the Worker, nothing happens
// The Promise may never resolve


// ===== GOOD: Comprehensive error handling =====

const worker = new Worker('worker.js');

// Worker's own errors (syntax errors, uncaught exceptions)
worker.onerror = (error) => {
  console.error('[Worker Error]', error.message);
  console.error('File:', error.filename, 'Line:', error.lineno);
  error.preventDefault(); // Suppress default error reporting
  showErrorUI('An unexpected error occurred in the worker');
};

// messageerror in Worker (deserialization failure, etc.)
worker.onmessageerror = (event) => {
  console.error('[Message Error] Failed to deserialize message');
};

// Request with timeout
function requestWithTimeout(worker, data, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Worker timeout: ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (event) => {
      clearTimeout(timer);
      worker.removeEventListener('message', handler);
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data);
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage(data);
  });
}

// Usage
try {
  const result = await requestWithTimeout(worker, taskData, 10000);
  updateUI(result);
} catch (err) {
  console.error('Processing failed:', err.message);
  showErrorUI(err.message);
}
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: Concurrent Worker Creation Limits

Browsers have an effective upper limit on the number of Workers that can be created simultaneously. While not a specification limit, the OS thread count and memory constraints mean that creating large numbers of Workers simultaneously can degrade performance or fail altogether.

```javascript
// ===== Problem: Creating many Workers at once =====

// Attempting to create 100 Workers at once
const workers = [];
for (let i = 0; i < 100; i++) {
  try {
    workers.push(new Worker('heavy-task.js'));
  } catch (e) {
    console.error(`Worker ${i} creation failed:`, e);
    // Some browsers hit the limit around 20-50
    break;
  }
}

// Results:
// - Chrome: Generally works but context switches increase with too many threads
// - Firefox: Queued beyond a certain number
// - Safari: Tends to hit the limit sooner
// - All browsers: Memory consumption spikes sharply (stack space of a few MB per Worker)


// ===== Solution: Worker pool + queuing =====

// Get the number of logical CPU cores with navigator.hardwareConcurrency
const optimalPoolSize = Math.max(1, navigator.hardwareConcurrency - 1);
// Convention: leave 1 core for the main thread
console.log(`Optimal pool size: ${optimalPoolSize}`);

const pool = new WorkerPool('heavy-task.js', optimalPoolSize);
// Execute 100 tasks with appropriate parallelism
const results = await Promise.all(
  tasks.map(task => pool.exec(task))
);
```

### 11.2 Edge Case 2: Service Worker Scope Restrictions

The control range of a Service Worker is determined by the `scope` parameter at registration time (or the directory of the script). Not understanding this limitation means requests may not be intercepted as expected.

```javascript
// ===== Rules about Service Worker scope =====

// 1. Default scope = directory of sw.js
//    If sw.js is at /scripts/sw.js
//    → Scope is /scripts/ and below only

// /sw.js → Scope: / (everything under root)
navigator.serviceWorker.register('/sw.js');

// /scripts/sw.js → Scope: /scripts/ and below only
navigator.serviceWorker.register('/scripts/sw.js');
// Requests for /index.html are NOT intercepted

// Attempting to widen scope beyond the script directory throws an error
navigator.serviceWorker.register('/scripts/sw.js', {
  scope: '/'  // SecurityError: cannot specify a scope above the script's directory
});

// Solution 1: Place sw.js in the root
navigator.serviceWorker.register('/sw.js', { scope: '/' });

// Solution 2: Set Service-Worker-Allowed header on the server
// HTTP response header: Service-Worker-Allowed: /
// This allows /scripts/sw.js to obtain root scope
navigator.serviceWorker.register('/scripts/sw.js', { scope: '/' });


// 2. Register multiple Service Workers with different scopes
navigator.serviceWorker.register('/sw-main.js', { scope: '/' });
navigator.serviceWorker.register('/blog/sw-blog.js', { scope: '/blog/' });
// Requests under /blog/ are handled by sw-blog.js first
// All other requests are handled by sw-main.js

// 3. Service Worker update detection
// The browser compares scripts byte-by-byte; any change triggers an update
// Automatic update check is performed once every 24 hours
// registration.update() enables manual checking
```

---

## FAQ

### Q1: What is the difference between Web Worker, Shared Worker, and Service Worker?

**A:** The three types of Workers differ in purpose and lifetime.

| Worker Type | Purpose | Lifetime | Sharing Scope |
|-------------|---------|----------|---------------|
| **Dedicated Worker** | Parallel computation in a single page | Until the page closes | Only the creating page |
| **Shared Worker** | State sharing across multiple tabs | Until all tabs close | All tabs of the same origin |
| **Service Worker** | Offline support, push notifications | Browser-managed (stops when idle) | All pages within the same scope |

```javascript
// Dedicated Worker: used for heavy computation in a single page, e.g., image processing
const worker = new Worker('image-processor.js');
worker.postMessage(imageData);

// Shared Worker: share a WebSocket connection across multiple tabs
const sharedWorker = new SharedWorker('websocket-manager.js');
sharedWorker.port.start();
sharedWorker.port.postMessage({ type: 'subscribe', channel: 'chat' });

// Service Worker: cache API responses for offline support
navigator.serviceWorker.register('/sw.js').then(registration => {
  console.log('Service Worker registered with scope:', registration.scope);
});
```

**Selection criteria:**
- **Computation only** → Dedicated Worker
- **Real-time sync across tabs** → Shared Worker
- **Control network requests** → Service Worker

---

### Q2: What are Transferable Objects for transferring large data to a Worker?

**A:** Transferable Objects are a mechanism for transferring ownership of data without copying it. Transferring a large ArrayBuffer using the Structured Clone algorithm deep copy can take hundreds of milliseconds, whereas transfer completes in under 1ms.

```javascript
// ===== Normal copy (slow) =====
const largeBuffer = new ArrayBuffer(100 * 1024 * 1024); // 100MB
console.time('Copy');
worker.postMessage({ buffer: largeBuffer }); // Deep copy occurs (hundreds of ms)
console.timeEnd('Copy');
// largeBuffer is still usable in the main thread

// ===== Transferable Objects (fast) =====
const largeBuffer2 = new ArrayBuffer(100 * 1024 * 1024);
console.time('Transfer');
worker.postMessage(
  { buffer: largeBuffer2 },
  [largeBuffer2] // Specify transfer target in second argument
);
console.timeEnd('Transfer'); // Under 1ms
// Accessing largeBuffer2 in the main thread after this throws TypeError
// console.log(largeBuffer2.byteLength); // Error: Detached ArrayBuffer
```

**Transferable objects:**
- `ArrayBuffer`
- `MessagePort`
- `ImageBitmap`
- `OffscreenCanvas`
- `ReadableStream`, `WritableStream`, `TransformStream`

**Important notes:**
- After transfer, access from the original thread is impossible (Detached state)
- When bidirectional transfer is needed, also specify transfer when returning from Worker

```javascript
// Return from Worker after processing
self.onmessage = (e) => {
  const buffer = e.data.buffer;
  // Execute processing
  processBuffer(buffer);

  // Return processed buffer by transfer
  self.postMessage({ result: buffer }, [buffer]);
};
```

---

### Q3: How do I debug Workers?

**A:** Chrome DevTools and Firefox Developer Tools provide debugging features specific to Workers.

**Debugging Workers with Chrome DevTools:**

1. **View Worker list**
   `Sources` tab → `Threads` section in the left pane → Running Workers are displayed

2. **Set breakpoints**
   Open the Worker script and set breakpoints just like with regular JavaScript

3. **Access the console**
   `Console` tab → dropdown at `top` → Select the Worker → Check `console.log` in the Worker's context

4. **Track postMessage**
   Record in the `Performance` tab → Compare `Main` and `Worker` timelines side by side → Visualize message exchanges

**Debugging Workers in Firefox:**

1. `about:debugging` → `This Firefox` → Find the target Worker
2. Launch dedicated DevTools with the `Inspect` button
3. Debug normally with `Console`, `Debugger`, and `Network` tabs

**Log output best practices:**

```javascript
// Add timestamps and Worker ID to logs on the Worker side
const workerId = Math.random().toString(36).slice(2, 9);

self.onmessage = (e) => {
  console.log(`[Worker ${workerId}] ${Date.now()} - Received:`, e.data);
  const result = heavyComputation(e.data);
  console.log(`[Worker ${workerId}] ${Date.now()} - Sending result:`, result);
  self.postMessage(result);
};

// Corresponding logs on the main thread side
worker.postMessage(data);
console.log(`[Main] ${Date.now()} - Sent to worker:`, data);

worker.onmessage = (e) => {
  console.log(`[Main] ${Date.now()} - Received from worker:`, e.data);
};
```

**Debugging Service Workers:**

- Chrome: `chrome://serviceworker-internals/` → List of registered SWs, force update, Unregister
- Firefox: `about:debugging` → `Service Workers` section
- Application tab → Service Workers → Check `Update on reload` to make reloading easier during development

---

## Summary

### Comparison of Web Worker Characteristics

| Item | Dedicated Worker | Shared Worker | Service Worker |
|------|-----------------|---------------|----------------|
| **Creation** | `new Worker(url)` | `new SharedWorker(url)` | `navigator.serviceWorker.register(url)` |
| **Communication** | `postMessage` / `onmessage` | `port.postMessage` / `port.onmessage` | `postMessage` + `fetch` event |
| **DOM access** | No | No | No |
| **Multi-tab sharing** | No | Yes | Yes |
| **Persistence** | Ends when page closes | Ends when all tabs close | Browser-managed (stops when idle) |
| **Main uses** | Image processing, encryption, bulk computation | WebSocket sharing, state sync | Offline support, push notifications |

### Key Points

1. **Avoid blocking the main thread**
   Offload processing exceeding 16.67ms (60fps) to a Worker. Account for structured clone costs and use Transferable Objects for large data.

2. **Control parallelism with a Worker pool**
   Use `navigator.hardwareConcurrency` to get the CPU core count and determine the appropriate pool size. Creating unlimited Workers degrades performance through context switches and memory consumption.

3. **Service Worker is a special Worker that controls the network layer**
   Design caching strategies (Cache First, Network First, Stale While Revalidate) to achieve both offline support and speed. Understand the lifecycle (installing → waiting → activated) and execute `skipWaiting()` and `clients.claim()` at the appropriate time.

---

## Guides to Read Next

- [Memory Management](./03-memory-management.md)
  Learn best practices for preventing memory leaks in large buffers handled by Workers, and the memory model of SharedArrayBuffer.

- Async Processing Patterns
  Learn how to wrap async requests to Workers with Promises, and how to aggregate results from multiple Workers with `Promise.all`.

- Performance Optimization
  Learn techniques for quantitatively evaluating the offloading effect of Workers with the Performance API and Chrome DevTools, and identifying bottlenecks.

---

## References

1. **MDN Web Docs - Web Workers API**
   https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
   API reference for Web Worker, Shared Worker, and Service Worker. Details on the Structured Clone algorithm and Transferable Objects.

2. **Google Developers - Service Worker Lifecycle**
   https://web.dev/service-worker-lifecycle/
   The Service Worker lifecycle (installing → waiting → activated) and timing of `skipWaiting()` and `clients.claim()` explained with diagrams.

3. **HTML Living Standard - Web Workers**
   https://html.spec.whatwg.org/multipage/workers.html
   Worker specification definition. Confirms standard behavior for the thread model, message passing, and error handling.

4. **Jake Archibald - The Offline Cookbook**
   https://jakearchibald.com/2014/offline-cookbook/
   Collection of Service Worker caching strategy patterns (Cache First, Network First, Stale While Revalidate, etc.).

5. **Surma - Is postMessage slow?**
   https://surma.dev/things/is-postmessage-slow/
   Performance measurements of `postMessage`'s Structured Clone algorithm, and comparison experiments with Transferable Objects. Demonstrates 100x+ speedup with ArrayBuffer transfer.
