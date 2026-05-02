# Iterator Pattern

> Master techniques for sequentially accessing elements while hiding a collection's internal structure, and learn lazy evaluation using generators

---

## What You Will Learn

1. **How the Iterator protocol works** -- Internal workings of Symbol.iterator and for...of, designing and implementing custom iterators
2. **Generator functions (function*)** -- Lazy evaluation with yield, infinite sequences, generators as coroutines
3. **Async iterators (AsyncGenerator)** -- API pagination, stream processing, using for await...of
4. **Practical iterator patterns** -- Lazy evaluation pipelines, tree traversal, external vs internal iterators
5. **GoF Iterator and the JavaScript Iterator protocol** -- Relationship between the classic pattern and the language-built-in protocol

---

## Prerequisites

| Topic | Required Understanding | Reference |
|---------|-----------|-----------|
| TypeScript generics | Type parameters of `Iterable<T>`, `Iterator<T>`, `Generator<T>` | 02-programming |
| Promise / async-await | Basics of async processing, `for await...of` syntax | 02-programming |
| Basic data structures | Concepts of arrays, linked lists, and trees | 01-cs-fundamentals |
| Composite pattern | Tree structure pattern (uses Iterator for traversal) | [../01-structural/04-composite.md](../01-structural/04-composite.md) |

---

## Why the Iterator Pattern Is Needed

### The Problem of Depending on a Collection's Internal Structure

```
Arrays, linked lists, trees, hash maps...
Each collection type has a different traversal method:

  Array:
    for (let i = 0; i < arr.length; i++) { arr[i] }

  Linked List:
    let node = head;
    while (node) { node = node.next; }

  Tree (depth-first):
    function traverse(node) {
      visit(node);
      for (const child of node.children) traverse(child);
    }

  Hash Map:
    for (const key of Object.keys(map)) { map[key] }

  Problem:
  ┌────────────────────────────────────────────────┐
  │ Consumers need to know the internal structure  │
  │ Changing the collection type requires changing │
  │ the traversal code as well                     │
  │ Traversal logic (DFS/BFS etc.) is scattered    │
  │ across consumer code                           │
  └────────────────────────────────────────────────┘
```

### Solution via the Iterator Pattern

```
Iterator pattern solution:

  ┌──────────────────┐     ┌──────────────────┐
  │   Collection     │────►│   Iterator       │
  │ (hides internal  │     │ (unified access) │
  │  structure)      │     │                  │
  │ [Symbol.iterator]│     │ + next()         │
  │   → Iterator     │     │   { value, done }│
  └──────────────────┘     └──────────────────┘

  Consumer always uses the same code:
    for (const item of collection) {
      // Same for arrays, lists, trees, etc.
    }

  Benefits:
  ✓ No need to know the collection's internal structure
  ✓ Multiple traversal algorithms are supported (DFS, BFS, filtered, etc.)
  ✓ Lazy evaluation can express infinite sequences
  ✓ Spread operator, destructuring, Array.from work automatically
```

GoF definition:

> "Provide a way to access the elements of an aggregate object sequentially without exposing its underlying representation."
>
> -- Design Patterns: Elements of Reusable Object-Oriented Software (1994)

In JavaScript/TypeScript, a notable feature is that the Iterator pattern is **built into the language specification**. Simply implementing the `Symbol.iterator` protocol automatically enables language features such as `for...of`, the spread operator, destructuring, and `Array.from`.

---

## 1. Structure of the Iterator Protocol

```
JavaScript/TypeScript Iterator protocol:

  ┌─────────────────────────────┐
  │        Iterable             │
  │                             │
  │  [Symbol.iterator]()        │
  │    → returns an Iterator    │
  │                             │
  │  Usable syntax:             │
  │    for...of                 │
  │    [...iterable]            │
  │    const [a, b] = iterable  │
  │    Array.from(iterable)     │
  │    yield* iterable          │
  │    new Map(iterable)        │
  │    Promise.all(iterable)    │
  └──────────────┬──────────────┘
                 │ returns
                 ▼
  ┌─────────────────────────────┐
  │        Iterator             │
  │                             │
  │  next(): IteratorResult     │
  │    { value: T, done: false }│  ← has a value
  │    { value: undefined,      │
  │      done: true }           │  ← finished
  │                             │
  │  return?(): IteratorResult  │  ← early exit
  │  throw?(e): IteratorResult  │  ← error injection
  └─────────────────────────────┘

  Call sequence:
  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────────┐
  │next()│───►│next()│───►│next()│───►│next()    │
  │{v:1, │    │{v:2, │    │{v:3, │    │{done:    │
  │ d:F} │    │ d:F} │    │ d:F} │    │ true}    │
  └──────┘    └──────┘    └──────┘    └──────────┘

  ★ Important: Iterable ≠ Iterator
    Iterable: has a [Symbol.iterator]() method → generates a new Iterator each time
    Iterator: has a next() method → single-use
```

---

## 2. Implementing Custom Iterators

### Code Example 1: Range Iterator

```typescript
// range-iterator.ts -- Range iterator

// ============================
// Class implementing Iterable
// ============================
class Range implements Iterable<number> {
  constructor(
    private readonly start: number,
    private readonly end: number,
    private readonly step: number = 1
  ) {
    if (step === 0) throw new Error('step must not be 0');
    if (step > 0 && start > end) throw new Error('start must be <= end for positive step');
    if (step < 0 && start < end) throw new Error('start must be >= end for negative step');
  }

  /** Iterable protocol: generates and returns an Iterator */
  [Symbol.iterator](): Iterator<number> {
    let current = this.start;
    const end = this.end;
    const step = this.step;

    return {
      next(): IteratorResult<number> {
        if ((step > 0 && current < end) || (step < 0 && current > end)) {
          const value = current;
          current += step;
          return { value, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }

  /** Pre-calculate element count (get size while maintaining lazy evaluation) */
  get length(): number {
    return Math.max(0, Math.ceil((this.end - this.start) / this.step));
  }

  /** Check if a value is included (O(1)) */
  includes(value: number): boolean {
    if (this.step > 0) {
      if (value < this.start || value >= this.end) return false;
    } else {
      if (value > this.start || value <= this.end) return false;
    }
    return (value - this.start) % this.step === 0;
  }
}

// ============================
// Usage examples
// ============================

// Traverse with for...of
for (const n of new Range(1, 5)) {
  console.log(n); // 1, 2, 3, 4
}

// Spread operator
const numbers = [...new Range(0, 10, 2)]; // [0, 2, 4, 6, 8]

// Destructuring
const [first, second] = new Range(10, 0, -3); // first=10, second=7

// Array.from
const arr = Array.from(new Range(1, 6)); // [1, 2, 3, 4, 5]

// ★ Since it is Iterable, it can be traversed multiple times
const range = new Range(1, 4);
console.log([...range]); // [1, 2, 3]
console.log([...range]); // [1, 2, 3] ← same result on second pass
```

### Code Example 2: Linked List Iterator

```typescript
// linked-list-iterator.ts -- Linked list iterator

// ============================
// Node and LinkedList definitions
// ============================
class ListNode<T> {
  constructor(
    public value: T,
    public next: ListNode<T> | null = null
  ) {}
}

class LinkedList<T> implements Iterable<T> {
  private head: ListNode<T> | null = null;
  private _size: number = 0;

  push(value: T): void {
    const node = new ListNode(value);
    node.next = this.head;
    this.head = node;
    this._size++;
  }

  get size(): number {
    return this._size;
  }

  /** Forward iterator */
  [Symbol.iterator](): Iterator<T> {
    let current = this.head;

    return {
      next(): IteratorResult<T> {
        if (current) {
          const value = current.value;
          current = current.next;
          return { value, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }

  /** Reverse iterator (providing multiple traversal methods) */
  reversed(): Iterable<T> {
    const items = [...this]; // convert to array first
    let index = items.length - 1;

    return {
      [Symbol.iterator](): Iterator<T> {
        return {
          next(): IteratorResult<T> {
            if (index >= 0) {
              return { value: items[index--], done: false };
            }
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  /** Conditional filter iterator */
  filter(predicate: (value: T) => boolean): Iterable<T> {
    const source = this;
    return {
      *[Symbol.iterator](): Iterator<T> {
        for (const item of source) {
          if (predicate(item)) yield item;
        }
      },
    };
  }
}

// ============================
// Usage examples
// ============================
const list = new LinkedList<number>();
list.push(3);
list.push(2);
list.push(1);

// Forward
for (const value of list) {
  console.log(value); // 1, 2, 3
}

// Reverse
for (const value of list.reversed()) {
  console.log(value); // 3, 2, 1
}

// With filter
for (const value of list.filter(v => v % 2 !== 0)) {
  console.log(value); // 1, 3
}
```

---

## 3. Generator Functions

### Code Example 3: Generator Basics and Applications

```typescript
// generators.ts -- Generator basics and applications

// ============================
// Basic generator
// ============================
function* fibonacci(): Generator<number> {
  let a = 0;
  let b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// Helper to get the first N elements
function take<T>(n: number, iterable: Iterable<T>): T[] {
  const result: T[] = [];
  for (const item of iterable) {
    result.push(item);
    if (result.length >= n) break;
  }
  return result;
}

console.log(take(8, fibonacci()));
// [0, 1, 1, 2, 3, 5, 8, 13]

// ============================
// Tree traversal using generators
// ============================
interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];
}

/** Depth-first traversal (pre-order) */
function* depthFirst<T>(root: TreeNode<T>): Generator<T> {
  yield root.value;
  for (const child of root.children) {
    yield* depthFirst(child); // recursively delegate with yield*
  }
}

/** Depth-first traversal (post-order) */
function* depthFirstPostOrder<T>(root: TreeNode<T>): Generator<T> {
  for (const child of root.children) {
    yield* depthFirstPostOrder(child);
  }
  yield root.value;
}

/** Breadth-first traversal (BFS) */
function* breadthFirst<T>(root: TreeNode<T>): Generator<T> {
  const queue: TreeNode<T>[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    yield node.value;
    queue.push(...node.children);
  }
}

/** Level-grouped traversal */
function* levelOrder<T>(root: TreeNode<T>): Generator<T[]> {
  let currentLevel: TreeNode<T>[] = [root];
  while (currentLevel.length > 0) {
    const values = currentLevel.map(n => n.value);
    yield values;
    const nextLevel: TreeNode<T>[] = [];
    for (const node of currentLevel) {
      nextLevel.push(...node.children);
    }
    currentLevel = nextLevel;
  }
}

// ============================
// Usage examples
// ============================
const tree: TreeNode<string> = {
  value: 'A',
  children: [
    { value: 'B', children: [
      { value: 'D', children: [] },
      { value: 'E', children: [] },
    ]},
    { value: 'C', children: [
      { value: 'F', children: [] },
    ]},
  ],
};

console.log([...depthFirst(tree)]);
// ['A', 'B', 'D', 'E', 'C', 'F']

console.log([...depthFirstPostOrder(tree)]);
// ['D', 'E', 'B', 'F', 'C', 'A']

console.log([...breadthFirst(tree)]);
// ['A', 'B', 'C', 'D', 'E', 'F']

console.log([...levelOrder(tree)]);
// [['A'], ['B', 'C'], ['D', 'E', 'F']]
```

```
Generator execution flow:

  function* gen() {        Caller side
    yield 1;               const g = gen();
    yield 2;               g.next() → { value: 1, done: false }
    yield 3;               g.next() → { value: 2, done: false }
    return 4;              g.next() → { value: 3, done: false }
  }                        g.next() → { value: 4, done: true }

  ┌─────────────────┐     ┌─────────────────┐
  │ Generator       │     │ Caller          │
  │                 │     │                 │
  │  ──── yield 1 ──┼────►│ value: 1        │
  │  (suspended)    │     │                 │
  │                 │◄────┼── next() ───    │
  │  ──── yield 2 ──┼────►│ value: 2        │
  │  (suspended)    │     │                 │
  │                 │◄────┼── next() ───    │
  │  ──── yield 3 ──┼────►│ value: 3        │
  │  (suspended)    │     │                 │
  │                 │◄────┼── next() ───    │
  │  ──── return 4 ─┼────►│ done: true      │
  └─────────────────┘     └─────────────────┘

  ★ yield means "suspend + emit a value"
  ★ next() means "resume + receive a value"
  ★ The value of return is not captured by for...of
    (the value when done: true is ignored)

  Delegation with yield*:
  function* outer() {
    yield 'a';
    yield* inner();   // forwards all yields from inner to the outside
    yield 'c';
  }
  function* inner() { yield 'b1'; yield 'b2'; }

  [...outer()] → ['a', 'b1', 'b2', 'c']
```

---

## 4. Async Iterators

### Code Example 4: Automatic Traversal of API Pagination

```typescript
// async-iterators.ts -- Using async iterators

// ============================
// API pagination
// ============================
interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

async function* fetchAllPages<T>(
  baseUrl: string,
  pageSize: number = 20
): AsyncGenerator<T> {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${baseUrl}?page=${page}&per_page=${pageSize}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: PageResponse<T> = await response.json();

    for (const item of data.items) {
      yield item; // yield one item at a time (memory-efficient)
    }

    hasMore = page * pageSize < data.total;
    page++;
  }
}

// Usage: process all users one at a time (memory-efficient)
interface User { id: string; name: string; active: boolean; }

async function processAllUsers(): Promise<void> {
  let count = 0;
  for await (const user of fetchAllPages<User>('/api/users')) {
    if (user.active) {
      await processUser(user);
      count++;
    }
  }
  console.log(`Processed ${count} active users`);
}

// ============================
// ReadableStream line reader
// ============================
async function* readLines(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        yield line;
      }
    }

    // Last buffer (no trailing newline)
    if (buffer) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================
// Server-Sent Events (SSE) stream
// ============================
async function* streamSSE(url: string): AsyncGenerator<{
  event: string;
  data: string;
}> {
  const response = await fetch(url);
  if (!response.body) throw new Error('No response body');

  for await (const line of readLines(response.body)) {
    if (line.startsWith('event: ')) {
      const event = line.slice(7);
      // Next line is data:
      // (simplified: a real SSE parser is more complex)
      continue;
    }
    if (line.startsWith('data: ')) {
      yield { event: 'message', data: line.slice(6) };
    }
  }
}

// Usage: subscribing to an SSE stream
async function watchUpdates(): Promise<void> {
  for await (const { event, data } of streamSSE('/api/events')) {
    console.log(`[${event}] ${data}`);
    // Can break to interrupt if needed
  }
}
```

```
Correspondence between sync and async iterators:

  Sync                         Async
  ─────────────────────────    ─────────────────────────
  Iterable                     AsyncIterable
  [Symbol.iterator]()          [Symbol.asyncIterator]()
  Iterator                     AsyncIterator
  next(): IteratorResult       next(): Promise<IteratorResult>
  for...of                     for await...of
  function*                    async function*
  yield                        yield (inside async context)
  yield*                       yield*

  ★ for await...of is equivalent to:
  const iter = asyncIterable[Symbol.asyncIterator]();
  while (true) {
    const { value, done } = await iter.next();
    if (done) break;
    // process value
  }
```

---

## 5. Iterator Pipeline (Lazy Evaluation)

### Code Example 5: Functional Iterator Operations Library

```typescript
// iterator-pipeline.ts -- Functional iterator operations

// ============================
// Lazy evaluation pipeline class
// ============================
class Iter<T> implements Iterable<T> {
  constructor(private source: Iterable<T>) {}

  static from<T>(source: Iterable<T>): Iter<T> {
    return new Iter(source);
  }

  /** Infinite repetition iterator */
  static repeat<T>(value: T): Iter<T> {
    return new Iter((function* () {
      while (true) yield value;
    })());
  }

  /** Natural number sequence (0, 1, 2, ...) */
  static naturals(): Iter<number> {
    return new Iter((function* () {
      let n = 0;
      while (true) yield n++;
    })());
  }

  *[Symbol.iterator](): Iterator<T> {
    yield* this.source;
  }

  /** Transform values */
  map<U>(fn: (item: T, index: number) => U): Iter<U> {
    const source = this.source;
    return new Iter((function* () {
      let i = 0;
      for (const item of source) {
        yield fn(item, i++);
      }
    })());
  }

  /** Filtering */
  filter(predicate: (item: T) => boolean): Iter<T> {
    const source = this.source;
    return new Iter((function* () {
      for (const item of source) {
        if (predicate(item)) yield item;
      }
    })());
  }

  /** Take first N elements */
  take(n: number): Iter<T> {
    const source = this.source;
    return new Iter((function* () {
      let count = 0;
      for (const item of source) {
        if (count >= n) break;
        yield item;
        count++;
      }
    })());
  }

  /** Skip first N elements */
  skip(n: number): Iter<T> {
    const source = this.source;
    return new Iter((function* () {
      let count = 0;
      for (const item of source) {
        if (count >= n) yield item;
        count++;
      }
    })());
  }

  /** Take elements while condition is true */
  takeWhile(predicate: (item: T) => boolean): Iter<T> {
    const source = this.source;
    return new Iter((function* () {
      for (const item of source) {
        if (!predicate(item)) break;
        yield item;
      }
    })());
  }

  /** Flat map */
  flatMap<U>(fn: (item: T) => Iterable<U>): Iter<U> {
    const source = this.source;
    return new Iter((function* () {
      for (const item of source) {
        yield* fn(item);
      }
    })());
  }

  /** Pairs of adjacent elements */
  pairwise(): Iter<[T, T]> {
    const source = this.source;
    return new Iter((function* () {
      let prev: T | undefined;
      let first = true;
      for (const item of source) {
        if (!first) {
          yield [prev!, item] as [T, T];
        }
        prev = item;
        first = false;
      }
    })());
  }

  /** Chunk splitting */
  chunk(size: number): Iter<T[]> {
    const source = this.source;
    return new Iter((function* () {
      let chunk: T[] = [];
      for (const item of source) {
        chunk.push(item);
        if (chunk.length >= size) {
          yield chunk;
          chunk = [];
        }
      }
      if (chunk.length > 0) yield chunk;
    })());
  }

  /** Deduplication */
  distinct(): Iter<T> {
    const source = this.source;
    return new Iter((function* () {
      const seen = new Set<T>();
      for (const item of source) {
        if (!seen.has(item)) {
          seen.add(item);
          yield item;
        }
      }
    })());
  }

  /** Fold/reduce (evaluates eagerly) */
  reduce<U>(fn: (acc: U, item: T) => U, initial: U): U {
    let result = initial;
    for (const item of this.source) {
      result = fn(result, item);
    }
    return result;
  }

  /** Convert to array (evaluates eagerly) */
  toArray(): T[] {
    return [...this.source];
  }

  /** Get the first element */
  first(): T | undefined {
    for (const item of this.source) {
      return item;
    }
    return undefined;
  }

  /** Count elements */
  count(): number {
    let n = 0;
    for (const _ of this.source) n++;
    return n;
  }

  /** Check if all elements satisfy the condition */
  every(predicate: (item: T) => boolean): boolean {
    for (const item of this.source) {
      if (!predicate(item)) return false;
    }
    return true;
  }

  /** Check if any element satisfies the condition */
  some(predicate: (item: T) => boolean): boolean {
    for (const item of this.source) {
      if (predicate(item)) return true;
    }
    return false;
  }
}

// ============================
// Usage: lazy evaluation via pipeline
// ============================

// Get the first 5 squares of even Fibonacci numbers
const result = Iter.from(fibonacci())
  .filter(n => n % 2 === 0)       // even numbers only
  .map(n => n * n)                 // square them
  .take(5)                         // first 5
  .toArray();

console.log(result); // [0, 4, 64, 17956, ...]
// → fibonacci only generates as much as needed (lazy evaluation)

// Generate prime numbers from natural numbers
function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}

const primes = Iter.naturals()
  .skip(2)
  .filter(isPrime)
  .take(10)
  .toArray();

console.log(primes); // [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]

// Chunk splitting + map
const chunks = Iter.from(new Range(1, 11))
  .chunk(3)
  .map(chunk => chunk.reduce((a, b) => a + b, 0))
  .toArray();

console.log(chunks); // [6, 15, 24, 10]
// [1+2+3, 4+5+6, 7+8+9, 10]
```

```
How lazy evaluation works:

  fibonacci() → filter(even) → map(square) → take(3) → toArray()

  Evaluation: demand propagates "right to left",
  values flow one at a time "left to right":

  fib     filter    map      take    result
  ─────   ─────     ─────    ─────   ─────
  0    →  0      →  0     →  [0]
  1    →  (skip)
  1    →  (skip)
  2    →  2      →  4     →  [0,4]
  3    →  (skip)
  5    →  (skip)
  8    →  8      →  64    →  [0,4,64]  ← take(3) done!

  ★ fibonacci is only computed up to 8 (benefit of lazy evaluation)
  ★ No intermediate arrays are created at all
```

---

## 6. Iterators and Generators in Python

### Code Example 6: Python's Iterator Protocol

```python
# python_iterators.py -- Iterator pattern in Python

from __future__ import annotations
from typing import Iterator, Iterable, TypeVar, Callable, Generator
from dataclasses import dataclass

T = TypeVar("T")
U = TypeVar("U")


# ============================
# Custom Range (equivalent to Python's built-in range)
# ============================
class MyRange:
    """Re-implementation of Python's range()"""

    def __init__(self, start: int, stop: int, step: int = 1):
        self.start = start
        self.stop = stop
        self.step = step

    def __iter__(self) -> Iterator[int]:
        """__iter__ is equivalent to [Symbol.iterator]"""
        current = self.start
        while (self.step > 0 and current < self.stop) or \
              (self.step < 0 and current > self.stop):
            yield current  # In Python, generators allow concise writing
            current += self.step

    def __len__(self) -> int:
        return max(0, (self.stop - self.start + self.step - 1) // self.step)

    def __contains__(self, value: int) -> bool:
        if self.step > 0:
            return self.start <= value < self.stop and (value - self.start) % self.step == 0
        else:
            return self.stop < value <= self.start and (self.start - value) % (-self.step) == 0


# ============================
# Generator application: pipeline
# ============================
def take(n: int, iterable: Iterable[T]) -> Generator[T, None, None]:
    """Get the first N elements"""
    count = 0
    for item in iterable:
        if count >= n:
            return
        yield item
        count += 1


def chunk(iterable: Iterable[T], size: int) -> Generator[list[T], None, None]:
    """Chunk splitting"""
    buf: list[T] = []
    for item in iterable:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def flatten(iterable: Iterable[Iterable[T]]) -> Generator[T, None, None]:
    """Flatten nested iterables"""
    for inner in iterable:
        yield from inner  # yield from is equivalent to yield*


# ============================
# Python generator expressions
# ============================
def demonstrate_generators():
    # List comprehension (generates all elements immediately)
    squares_list = [x**2 for x in range(10)]  # list

    # Generator expression (lazy evaluation)
    squares_gen = (x**2 for x in range(10))   # generator

    # Memory efficiency difference:
    # squares_list: holds all 10 ints in memory
    # squares_gen:  generates one at a time, O(1) memory

    # Pipeline (function composition)
    import itertools
    result = list(
        itertools.islice(                    # take(5)
            filter(lambda x: x % 2 == 0,    # filter(even)
                (x**2 for x in range(100))   # map(square)
            ),
            5
        )
    )
    print(result)  # [0, 4, 16, 36, 64]


# ============================
# Usage examples
# ============================
if __name__ == "__main__":
    # Custom Range
    for n in MyRange(1, 5):
        print(n, end=" ")  # 1 2 3 4
    print()

    # Chunk splitting
    for c in chunk(range(1, 11), 3):
        print(c)
    # [1, 2, 3]
    # [4, 5, 6]
    # [7, 8, 9]
    # [10]

    # Using itertools
    demonstrate_generators()
```

---

## 7. External Iterator vs Internal Iterator

### Code Example 7: Comparison and Usage of Both Styles

```typescript
// external-vs-internal.ts -- External and internal iterators

// ============================
// External Iterator
// ============================
// The consumer explicitly calls next() to control traversal
class ExternalIterator<T> {
  private iterator: Iterator<T>;

  constructor(iterable: Iterable<T>) {
    this.iterator = iterable[Symbol.iterator]();
  }

  /** Check if there is a next element */
  hasNext(): boolean {
    const result = this.iterator.next();
    if (result.done) return false;
    // We need to put the value back for peek, but Iterators cannot rewind
    // → In practice, a 1-element lookahead buffer is needed
    return true;
  }

  /** Get the next element */
  next(): T {
    const result = this.iterator.next();
    if (result.done) throw new Error('No more elements');
    return result.value;
  }
}

// External iterator with lookahead
class PeekableIterator<T> implements Iterable<T> {
  private iterator: Iterator<T>;
  private buffer: T[] = [];

  constructor(source: Iterable<T>) {
    this.iterator = source[Symbol.iterator]();
  }

  /** Inspect the next element without consuming it */
  peek(): T | undefined {
    if (this.buffer.length === 0) {
      const result = this.iterator.next();
      if (result.done) return undefined;
      this.buffer.push(result.value);
    }
    return this.buffer[0];
  }

  /** Get and consume the next element */
  next(): T | undefined {
    if (this.buffer.length > 0) {
      return this.buffer.shift();
    }
    const result = this.iterator.next();
    return result.done ? undefined : result.value;
  }

  hasNext(): boolean {
    return this.peek() !== undefined;
  }

  [Symbol.iterator](): Iterator<T> {
    return {
      next: () => {
        const value = this.next();
        if (value === undefined) {
          return { value: undefined, done: true };
        }
        return { value, done: false };
      },
    };
  }
}

// ============================
// Internal Iterator
// ============================
// The collection controls traversal and calls the callback
class InternalIterator<T> {
  constructor(private items: T[]) {}

  forEach(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this.items.length; i++) {
      callback(this.items[i], i);
    }
  }

  map<U>(fn: (item: T) => U): U[] {
    const result: U[] = [];
    this.forEach(item => result.push(fn(item)));
    return result;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    for (const item of this.items) {
      if (predicate(item)) return item;
    }
    return undefined;
  }
}

// ============================
// External iterator use case: tokenizer
// ============================
function* tokenize(input: string): Generator<{ type: string; value: string }> {
  const patterns = [
    { type: 'number', regex: /^\d+/ },
    { type: 'operator', regex: /^[+\-*/]/ },
    { type: 'paren', regex: /^[()]/ },
    { type: 'whitespace', regex: /^\s+/ },
  ];

  let pos = 0;
  while (pos < input.length) {
    let matched = false;
    for (const { type, regex } of patterns) {
      const match = input.slice(pos).match(regex);
      if (match) {
        if (type !== 'whitespace') {
          yield { type, value: match[0] };
        }
        pos += match[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(`Unexpected character at position ${pos}: '${input[pos]}'`);
    }
  }
}

// Implement a parser using PeekableIterator
function parseExpression(tokens: PeekableIterator<{ type: string; value: string }>): number {
  let result = parseTerm(tokens);

  while (tokens.peek()?.type === 'operator' &&
         ['+', '-'].includes(tokens.peek()!.value)) {
    const op = tokens.next()!.value;
    const right = parseTerm(tokens);
    result = op === '+' ? result + right : result - right;
  }

  return result;
}

function parseTerm(tokens: PeekableIterator<{ type: string; value: string }>): number {
  const token = tokens.next();
  if (!token) throw new Error('Unexpected end of input');
  if (token.type === 'number') return parseInt(token.value);
  if (token.type === 'paren' && token.value === '(') {
    const result = parseExpression(tokens);
    tokens.next(); // consume ')'
    return result;
  }
  throw new Error(`Unexpected token: ${token.value}`);
}

// Usage
const tokens = new PeekableIterator(tokenize('3 + 5 - 2'));
console.log(parseExpression(tokens)); // 6
```

```
Comparison of external vs internal iterators:

  External Iterator (for...of, next())
  ┌──────────┐                    ┌──────────┐
  │ Consumer │── next() ─────────►│ Iterator │
  │          │◄── { value, done } │          │
  │ Control  │                    │ Provides │
  │ is with  │                    │ values   │
  │ consumer │                    │          │
  └──────────┘                    └──────────┘

  Internal Iterator (forEach, map)
  ┌──────────┐                    ┌───────────┐
  │ Consumer │── callback ───────►│ Collection│
  │          │                    │           │
  │ Just     │◄── callback(item) ─│ Controls  │
  │ provides │                    │ traversal │
  │ callback │                    │           │
  └──────────┘                    └───────────┘

  When to use which:
  External: simultaneous traversal of multiple iterators, peek, early exit
  Internal: simple full-element processing, functional style
```

---

## 8. Deep Dive: Iterator Design Decisions

### The Single-Use Iterator Problem

```
Iterators can only be traversed once (single-use):
  const gen = fibonacci();
  [...gen]  // [0, 1, 1, 2, ...]
  [...gen]  // [] ← empty! iterator is exhausted

Iterables can be traversed multiple times:
  const range = new Range(1, 5);
  [...range]  // [1, 2, 3, 4]
  [...range]  // [1, 2, 3, 4] ← works every time

Reason: Iterable creates a new Iterator via [Symbol.iterator]() each time
        A Generator is a single Iterator instance that holds its state internally

  ★ Design guidelines:
    Reusable collections → Implement the Iterable interface (class + [Symbol.iterator])
    One-time streams → A Generator function is sufficient
```

### Lazy Evaluation vs Eager Evaluation

```
Eager evaluation (Array.map/filter):
  [1,2,3,4,5].filter(x => x > 2).map(x => x * 2)
  Step 1: filter produces intermediate array [3,4,5]
  Step 2: map produces result array [6,8,10]
  → Two arrays exist in memory

Lazy evaluation (Iterator pipeline):
  Iter.from([1,2,3,4,5]).filter(x => x > 2).map(x => x * 2).toArray()
  → No intermediate arrays, one element processed at a time
  → 1 → filter(skip) → 2 → filter(skip) → 3 → filter(pass) → map(6) → ...

Decision criteria:
  Small data (< 1000 items) → Eager evaluation is fine (prioritize readability)
  Large data (> 10000 items) → Lazy evaluation is effective
  Infinite sequences → Lazy evaluation is required
  Multiple traversals → Eager evaluation (convert to array)
```

---

## 9. Comparison Tables

### Comparison of Traversal Methods

| Property | for loop | Array.map/filter | Generator | Iter pipeline |
|------|-----------|-----------------|-----------|-----------------|
| Lazy evaluation | No | No (array created immediately) | Yes | Yes |
| Infinite sequences | No | No | Yes | Yes |
| Memory efficiency | Good | Intermediate arrays created | Best | Best |
| Chain readability | Low | High | Medium | High |
| Async support | Requires work | None | AsyncGenerator | Extensible |
| Early exit (break) | Yes | No (forEach) | Yes | Yes |
| TypeScript type inference | Full | Full | Full | Full |

### Types of Iterators

| Iterator type | Sync Iterator | AsyncIterator | Generator | AsyncGenerator |
|--------------|-------------|---------------|-----------|---------------|
| Protocol | Symbol.iterator | Symbol.asyncIterator | function* | async function* |
| Syntax | for...of | for await...of | yield | yield (inside async) |
| Use case | Collection traversal | API/Stream processing | Lazy sequences | Pagination |
| Execution control | next() | next() (Promise) | suspend with yield | yield + await |
| Resource release | return() | return() | try/finally | try/finally |

### Iterator Correspondence Across Languages

| Concept | JavaScript/TS | Python | Rust | Java |
|------|--------------|--------|------|------|
| Iterable | Symbol.iterator | `__iter__` | `IntoIterator` | `Iterable<T>` |
| Iterator | `{ next() }` | `__next__` | `Iterator` trait | `Iterator<T>` |
| Generator | `function*` | `yield` | -- (replaced by Iterator) | -- |
| Lazy pipeline | Custom implementation | `itertools` | `.iter().map().filter()` | `Stream API` |
| Async iterator | `async function*` | `async for` | `Stream` | `Flow (Kotlin)` |

---

## 10. Anti-Patterns

### Anti-Pattern 1: Loading All Data into Memory Before Processing

```typescript
// ============================
// [BAD] Load 1 million records into an array
// ============================
const allUsers = await fetchAllUsers(); // 1 million records in memory!
const activeUsers = allUsers.filter(u => u.active);
const names = activeUsers.map(u => u.name);
// → Two intermediate arrays are created
// → Memory usage: 1 million records × 3 arrays

// ============================
// [GOOD] Process one record at a time using a generator
// ============================
async function* fetchActiveUserNames(): AsyncGenerator<string> {
  for await (const user of fetchAllPages<User>('/api/users')) {
    if (user.active) {
      yield user.name;
    }
  }
}

// Memory usage is only the page size
const names2: string[] = [];
for await (const name of fetchActiveUserNames()) {
  names2.push(name);
  if (names2.length >= 100) break; // early exit is also possible
}
```

### Anti-Pattern 2: Reusing an Iterator

```typescript
// ============================
// [BAD] Trying to consume the same iterator twice
// ============================
function* nums() { yield 1; yield 2; yield 3; }
const iter = nums();

console.log([...iter]); // [1, 2, 3]
console.log([...iter]); // [] ← empty! iterator is exhausted

// ============================
// [GOOD Option 1] Hold an Iterable and create a new Iterator when needed
// ============================
const range = new Range(1, 4);
console.log([...range]); // [1, 2, 3]
console.log([...range]); // [1, 2, 3] ← works any number of times since it's Iterable

// ============================
// [GOOD Option 2] Wrap the generator in a factory function
// ============================
function numsIterable(): Iterable<number> {
  return {
    *[Symbol.iterator]() { yield 1; yield 2; yield 3; }
  };
}

const reusable = numsIterable();
console.log([...reusable]); // [1, 2, 3]
console.log([...reusable]); // [1, 2, 3] ← OK
```

### Anti-Pattern 3: Misusing forEach / map with Async Processing

```typescript
// ============================
// [BAD] async/await inside forEach does not work as expected
// ============================
const urls = ['url1', 'url2', 'url3'];

// forEach launches all callbacks synchronously
urls.forEach(async (url) => {
  const data = await fetch(url);
  console.log(data); // order is non-deterministic, errors cannot be caught
});
console.log('Done'); // ← executes before the forEach callbacks!

// ============================
// [GOOD] Sequential processing with for...of + await
// ============================
for (const url of urls) {
  const data = await fetch(url);
  console.log(data); // order is guaranteed, catchable with try/catch
}
console.log('Done'); // ← executes after all fetches complete

// [GOOD] Use Promise.all when parallel execution is needed
const results = await Promise.all(urls.map(url => fetch(url)));
```

---

## 11. Exercises

### Exercise 1 (Basic): Binary Tree Iterator

Implement a binary tree iterator that meets the following specification.

**Specification:**
- Define a binary search tree (BST) class
- Implement three traversal methods using Generator: `inOrder()`, `preOrder()`, `postOrder()`
- The default `[Symbol.iterator]` should use in-order traversal

```typescript
// Hint
interface BSTNode<T> {
  value: T;
  left: BSTNode<T> | null;
  right: BSTNode<T> | null;
}
```

**Expected output:**
```
Insert 5, 3, 7, 1, 4, 6, 8 into BST

inOrder:   [1, 3, 4, 5, 6, 7, 8]  // sorted ascending
preOrder:  [5, 3, 1, 4, 7, 6, 8]  // root → left → right
postOrder: [1, 4, 3, 6, 8, 7, 5]  // left → right → root

for (const value of bst) { ... }   // traverses in inOrder
[...bst]                            // [1, 3, 4, 5, 6, 7, 8]
```

---

### Exercise 2 (Applied): Async Pipeline

Implement an async iterator pipeline that meets the following specification.

**Specification:**
- Implement an `AsyncIter<T>` class
- Provide `map`, `filter`, `take`, and `buffer` (batching N items at a time) with lazy evaluation
- Consumable via `for await...of`

**Expected output:**
```
const pipeline = AsyncIter.from(fetchAllPages<User>('/api/users'))
  .filter(user => user.active)
  .map(user => user.name)
  .buffer(10)  // batch 10 items at a time
  .take(5);    // 5 batches (up to 50 items)

for await (const batch of pipeline) {
  console.log(`Processing batch of ${batch.length} names`);
  await saveBatch(batch);
}
```

---

### Exercise 3 (Advanced): Coroutine-Based Job Scheduler

Implement a coroutine-based job scheduler that meets the following specification.

**Specification:**
- Use two-way communication via Generator's `next(value)`
- Define jobs as Generator functions that yield to give up execution
- The scheduler runs multiple jobs in round-robin fashion

```typescript
// Hint: job definition
function* downloadJob(url: string): Generator<string, void, void> {
  yield `Starting download: ${url}`;
  yield `Downloading... 50%`;
  yield `Downloading... 100%`;
  yield `Download complete: ${url}`;
}
```

**Expected output:**
```
scheduler.add(downloadJob('file1.zip'));
scheduler.add(downloadJob('file2.zip'));
scheduler.run();

// Round-robin execution:
// [Job1] Starting download: file1.zip
// [Job2] Starting download: file2.zip
// [Job1] Downloading... 50%
// [Job2] Downloading... 50%
// [Job1] Downloading... 100%
// [Job2] Downloading... 100%
// [Job1] Download complete: file1.zip
// [Job2] Download complete: file2.zip
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Check the path and format of the configuration file |
| Timeout | Network delay / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Growth in data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user's permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Verify incrementally**: Validate hypotheses using log output or a debugger
5. **Fix and regression test**: After fixing, run tests for related areas as well

```python
# Debug utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps to diagnose performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Inspect disk and network I/O status
4. **Check concurrent connections**: Review connection pool status

| Problem type | Diagnostic tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Index, query optimization |
---

## 12. FAQ

### Q1: When should I use a generator versus a regular function?

A regular function (returning an array) is sufficient when the data is finite and small. Consider a generator in the following cases:

1. **Infinite sequences**: Fibonacci series, random sequences, counters, and other endless data
2. **Sequential processing of large data**: File reading, API pagination, log analysis
3. **Possibility of stopping midway**: Stop when the first element matching a condition is found
4. **Memory-constrained environments**: When you want to avoid creating intermediate arrays

The biggest advantage of generators is lazy evaluation — **"don't compute until needed"**.

### Q2: What is the difference between for...of and forEach?

| Comparison | `for...of` | `Array.forEach` |
|---------|-----------|----------------|
| Target | All Iterables | Arrays only |
| break | Possible | Not possible |
| continue | Possible | Use return as substitute |
| async/await | Works correctly | Does not work as expected |
| Generator support | Yes | No |
| return | Exits the loop | Exits the callback (loop continues) |

Basic guideline: prefer `for...of`; use `forEach` only for simple, side-effect-free processing of all elements.

### Q3: How should error handling be done with AsyncGenerator?

Use `try/catch` inside the `for await...of` block. You can also inject errors from the outside using the Generator's `throw()` method.

```typescript
// Practical error handling
async function* resilientFetch<T>(
  urls: string[]
): AsyncGenerator<T> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Skipping ${url}: ${res.status}`);
        continue; // skip errors on individual pages
      }
      const data = await res.json();
      yield data;
    } catch (err) {
      console.warn(`Network error for ${url}:`, err);
      // continue if non-fatal, throw if fatal
    }
  }
}
```

For processing such as pagination, a practical design is to retry or skip errors on individual pages and only abort the entire process for fatal errors. Don't forget to clean up resources in `finally` blocks (releasing streams, closing connections).

### Q4: How does the Iterator pattern relate to functional programming?

The Iterator pattern is essentially the same concept as **Lazy Lists** in functional programming. Lists in Haskell are lazily evaluated, computing only the elements needed. JavaScript's Generator brings this concept into an imperative language.

Rust's `Iterator` trait provides functional operations like `map`, `filter`, and `fold` with lazy evaluation, making it a great example of the fusion of the Iterator pattern and functional programming.

### Q5: What is the difference between yield* and yield in a Generator?

`yield` emits a single value. `yield*` emits all values from another Iterable one by one (delegation).

```typescript
function* example() {
  yield 1;               // a single value
  yield* [2, 3, 4];      // all elements of the array in order
  yield* anotherGen();   // all elements of another Generator in order
  yield 5;
}
// Result: 1, 2, 3, 4, (all output from anotherGen), 5
```

`yield*` is especially useful for recursive tree traversal. When delegating traversal to a child node's iterator, it can be written naturally without an explicit loop.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world development?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------|
| Iterator protocol | Unified traversal interface via `Symbol.iterator` + `next()` |
| Iterable vs Iterator | Iterable can be traversed multiple times; Iterator is single-use |
| for...of | Loop syntax based on the Iterator protocol. Supports break/continue/await |
| Generator | Lazy evaluation with `function*` and `yield`. Can express infinite sequences |
| yield* | Delegates to another iterator. Useful for recursive tree traversal |
| AsyncGenerator | Sequential async data processing with `async function*` |
| Pipeline | Chain map/filter/take with lazy evaluation. No intermediate arrays |
| External vs Internal | External: consumer controls (peek, multiple simultaneous traversals); Internal: collection controls (forEach) |

---

## What to Read Next

- [02-command.md](./02-command.md) -- Command pattern and encapsulation of operations (Iterator used to traverse Command history)
- [03-state.md](./03-state.md) -- State pattern and state transitions
- [../01-structural/04-composite.md](../01-structural/04-composite.md) -- Composite pattern (Iterator used for tree traversal)
- [../03-functional/02-fp-patterns.md](../03-functional/02-fp-patterns.md) -- Functional patterns (pipelines, composition)
- [../03-functional/00-monad.md](../03-functional/00-monad.md) -- Monad pattern (Iterator is related to the List monad)

---

## References

1. **Design Patterns: Elements of Reusable Object-Oriented Software** -- Gamma, Helm, Johnson, Vlissides (GoF, 1994) -- The original source of the Iterator pattern. Chapter 5, pp.257-271
2. **MDN - Iterators and generators** -- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators -- Official reference for JavaScript iterators and generators
3. **Exploring ES6 - Iterables and iterators** -- Axel Rauschmayer -- Detailed explanation based on the ES6 specification
4. **Python itertools documentation** -- https://docs.python.org/3/library/itertools.html -- Python's iterator utilities
5. **Rust Iterator trait documentation** -- https://doc.rust-lang.org/std/iter/trait.Iterator.html -- An excellent implementation example of lazy evaluation iterators
