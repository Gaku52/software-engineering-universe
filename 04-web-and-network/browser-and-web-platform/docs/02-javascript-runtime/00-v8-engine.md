# V8 Engine

> V8 is a high-performance JavaScript engine developed by Google that forms the foundation of a wide range of runtime environments including Chrome, Node.js, and Deno. This guide dives deep into V8's internal architecture and systematically explains each mechanism: the parser, Ignition (interpreter), TurboFan (optimizing compiler), Hidden Classes, inline caches, and garbage collection.

## Prerequisites

The following knowledge is assumed for effective learning from this guide.

- **JavaScript's basic execution model** — Understanding of variables, functions, closures, and prototype chains
- **Difference between compilers and interpreters** — The process of converting source code to executable code
  - Reference: CS Fundamentals - Compiler Principles
- **Browser architecture** — Relationship between the rendering engine, JavaScript engine, and event loop
  - Reference: [Browser Architecture](../00-browser-engine/00-browser-architecture.md)
- **Basics of memory management** — Concepts of stack, heap, and garbage collection
- **Runtime environment differences** — The different roles of V8 in browser and Node.js environments

## What You Will Learn

- [ ] Understand the overall pipeline of V8's source code processing
- [ ] Grasp the mechanism of the parser (Lazy Parsing / Eager Parsing)
- [ ] Understand the operating principles of the Ignition bytecode interpreter
- [ ] Learn the optimization techniques of the TurboFan optimizing compiler
- [ ] Grasp the internal structure of object representation via Hidden Classes
- [ ] Understand the state transitions of Inline Caches (IC)
- [ ] Learn the strategy of generational garbage collection
- [ ] Practice writing code optimized for V8

---

## 1. V8's Overall Architecture

V8 is not merely an interpreter but an advanced compilation pipeline with multiple phases. JavaScript source code goes through the following stages before execution.

### 1.1 Overall Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    V8 Compilation Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  JavaScript source code (.js)                                   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                            │
│  │   Scanner        │  Lexical analysis (Tokenizer)             │
│  │   (Lexer)        │  Decomposes source code into tokens       │
│  └────────┬────────┘                                            │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   Parser         │  Syntactic analysis                       │
│  │   (Full/Lazy)    │  Builds AST (Abstract Syntax Tree)        │
│  │                  │  from the token stream                    │
│  └────────┬────────┘                                            │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   Ignition       │  Bytecode interpreter                     │
│  │   (Interpreter)  │  Generates and executes bytecode from AST │
│  │                  │  + Profiling via feedback vector          │
│  └────────┬────────┘                                            │
│           │                                                     │
│           │  Hot spot detection                                 │
│           │  (functions executed more than a threshold)         │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   TurboFan       │  Optimizing compiler                      │
│  │   (Optimizing    │  bytecode + type feedback →               │
│  │    Compiler)     │  generates optimized machine code         │
│  └────────┬────────┘                                            │
│           │                                                     │
│           │  Deoptimization                                     │
│           │  If assumptions break, falls back to Ignition       │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   Execution      │  Execute optimized machine code           │
│  │                  │  or bytecode                              │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Historical Background

V8's compilation pipeline has undergone major changes across versions.

| Period | Compiler configuration | Characteristics |
|------|---------------|------|
| 2008-2010 | Full-Codegen only (no Crankshaft) | Early simple JIT compiler |
| 2010-2016 | Full-Codegen + Crankshaft | Two-tier JIT. Crankshaft optimizes hot code |
| 2016-2017 | Ignition + TurboFan (gradual rollout) | Transition period to the new pipeline |
| 2017-present | Ignition + TurboFan | Current pipeline. Bytecode + optimizing JIT |

Full-Codegen compiled all functions to native code immediately, but had slow startup and high memory usage. The introduction of Ignition enabled an efficient approach: run as bytecode first and only optimizing-compile the code that is truly needed.

---

## 2. Parser

### 2.1 Lexical Analysis (Scanner)

The Scanner converts the source code string into a sequence of tokens. A token is the minimal unit of a programming language and is categorized as a keyword, identifier, literal, operator, etc.

```javascript
// Source code
function add(a, b) { return a + b; }

// Converted to a token stream
// Token::kFunction  → "function"
// Token::kIdentifier → "add"
// Token::kLeftParen  → "("
// Token::kIdentifier → "a"
// Token::kComma      → ","
// Token::kIdentifier → "b"
// Token::kRightParen → ")"
// Token::kLeftBrace  → "{"
// Token::kReturn     → "return"
// Token::kIdentifier → "a"
// Token::kAdd        → "+"
// Token::kIdentifier → "b"
// Token::kSemicolon  → ";"
// Token::kRightBrace → "}"
```

V8's Scanner processes UTF-16 encoded source code and uses one-character lookahead to identify tokens. Multi-character tokens such as numeric and string literals are handled by dedicated scanning routines.

### 2.2 Lazy Parsing and Eager Parsing

V8's parser has two modes of operation. This is a core part of V8's performance strategy.

```
┌───────────────────────────────────────────────────────────┐
│                  Two Modes of the Parser                   │
├──────────────────────┬────────────────────────────────────┤
│   Eager Parsing      │   Lazy Parsing (PreParser)         │
│   (Full Parse)       │   (Deferred Parse)                 │
├──────────────────────┼────────────────────────────────────┤
│ · Builds a full AST  │ · Skips the body of functions      │
│ · Used for code that │ · Only checks variable scope       │
│   is executed        │ · Only detects syntax errors       │
│   immediately        │ · Defers parsing until the         │
│ · Applied to         │   function is actually called      │
│   top-level code     │ · Saves memory and startup time    │
├──────────────────────┼────────────────────────────────────┤
│ Cost: High           │ Cost: Low (about half of full)     │
│ Target: Immediately  │ Target: Function declarations      │
│         executed code│                                    │
└──────────────────────┴────────────────────────────────────┘
```

**How Lazy Parsing works:**

```javascript
// Top-level code → Eager Parsing (fully parsed immediately)
const config = { debug: true };

// Function declaration → Lazy Parsing (body is skipped)
function processData(data) {
  // The body is not parsed until the first call
  const result = data.map(item => item.value * 2);
  return result.filter(v => v > 10);
}

// IIFE (Immediately Invoked Function Expression) → Eager Parsing (executed immediately)
(function() {
  console.log("immediately invoked");
})();

// processData is fully parsed only when it is first called
processData([{ value: 5 }, { value: 8 }, { value: 15 }]);
```

**Why Lazy Parsing is effective:**

In a typical web page, 30–50% of the loaded JavaScript code is not executed during the initial display. Lazy Parsing defers the parsing cost of unused functions, improving the page's initial load speed.

**Pitfalls of Lazy Parsing:**

```javascript
// Anti-pattern: case where Lazy Parsing backfires
// V8 lazy-parses the function even though it is called immediately

function heavyComputation() {
  // A lot of code...
}

// Called immediately → double cost from Lazy Parse + Re-parse
heavyComputation();

// Mitigation: give V8 a hint for Eager Parsing
// Wrapping in parentheses makes V8 recognize it as an IIFE pattern and do Eager Parsing
const heavyComputation2 = (function() {
  // A lot of code...
});
```

### 2.3 Structure of the AST (Abstract Syntax Tree)

The parser builds an AST (Abstract Syntax Tree) from the token stream. An AST represents the syntactic structure of source code in tree form.

```javascript
// Source code
function multiply(x, y) {
  return x * y;
}

// Corresponding AST (conceptual representation)
//
//  FunctionDeclaration
//  ├── name: "multiply"
//  ├── params: ["x", "y"]
//  └── body: BlockStatement
//      └── ReturnStatement
//          └── BinaryExpression
//              ├── operator: "*"
//              ├── left: Identifier("x")
//              └── right: Identifier("y")
```

V8's AST nodes are represented internally as C++ classes, and each node holds source position information (SourcePosition). This is used for generating error messages and debug information.

---

## 3. Ignition Bytecode Interpreter

### 3.1 Ignition's Role

Ignition is a register-based bytecode interpreter introduced into V8 in 2016. It generates bytecode from the AST and executes that bytecode directly.

**Motivation for introducing Ignition:**

1. **Reduced memory usage** — Bytecode is more compact than the native code generated by Full-Codegen
2. **Improved startup speed** — Bytecode generation is faster than native code generation
3. **Providing information to TurboFan** — Type information collected during execution is passed to TurboFan

### 3.2 Bytecode Example

```javascript
// JavaScript source code
function add(a, b) {
  return a + b;
}

// Bytecode generated by Ignition (conceptual representation)
// * Actual bytecode can be seen with the --print-bytecode flag
//
// Parameter count: 3 (receiver + a + b)
// Register count: 0
// Frame size: 0
//
//   Ldar a1          // Load register a1 (argument a) into the accumulator
//   Add a2, [0]      // Add a2 (argument b) to the accumulator
//                     // [0] is the feedback slot index
//   Return            // Return the value in the accumulator
```

**How to check bytecode in Node.js:**

```bash
# Output Ignition bytecode with the --print-bytecode flag
node --print-bytecode --print-bytecode-filter="add" script.js

# Example output:
# [generated bytecode for function: add (0x...)]
# Bytecode length: 6
# Parameter count 3
# Register count 0
# Frame size 0
#    0 : 25 02             Ldar a1
#    2 : 39 03 00          Add a2, [0]
#    5 : aa                Return
```

### 3.3 Register-based vs. Stack-based

Bytecode interpreters come in two major styles. Ignition uses a register-based style.

| Feature | Register-based (Ignition) | Stack-based (old Java VM, etc.) |
|------|--------------------------|------------------------------|
| Instruction format | `Add r1, r2, r3` | `Push a; Push b; Add` |
| Instruction count | Fewer (operands specified directly) | More (Push/Pop operations required) |
| Bytecode size | Slightly larger (operand specifications) | Smaller |
| Execution speed | Fast (fewer memory accesses) | Somewhat slower (stack operation overhead) |
| Dispatch count | Fewer | More |
| Examples | V8 Ignition, Lua VM | JVM, Python VM, .NET CLR |

### 3.4 Feedback Vector

During execution, Ignition collects profile information such as type information and property access patterns. This is stored in a data structure called the **feedback vector**.

```
┌─────────────────────────────────────────────────────────┐
│              Structure of the Feedback Vector            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  function calculate(obj) {                              │
│    return obj.x + obj.y;  // Two property accesses      │
│  }                                                      │
│                                                         │
│  Feedback vector:                                       │
│  ┌─────────┬──────────────────────────────────┐         │
│  │ Slot 0  │ LoadIC: obj.x                    │         │
│  │         │ → Map: 0x1234 (Hidden Class)     │         │
│  │         │ → Offset: 12                     │         │
│  │         │ → State: monomorphic             │         │
│  ├─────────┼──────────────────────────────────┤         │
│  │ Slot 1  │ LoadIC: obj.y                    │         │
│  │         │ → Map: 0x1234 (Hidden Class)     │         │
│  │         │ → Offset: 16                     │         │
│  │         │ → State: monomorphic             │         │
│  ├─────────┼──────────────────────────────────┤         │
│  │ Slot 2  │ BinaryOp: +                      │         │
│  │         │ → Hint: SignedSmall              │         │
│  └─────────┴──────────────────────────────────┘         │
│                                                         │
│  This information is passed to TurboFan and used        │
│  as the basis for optimization decisions                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The type information accumulated in the feedback vector serves as the basis when TurboFan performs optimizing compilation. For example, if there is information that "this addition is always performed between SMIs (Small Integers)," TurboFan can generate machine code specialized for integer addition.

---

## 4. TurboFan Optimizing Compiler

### 4.1 Overview of TurboFan

TurboFan is V8's optimizing compiler. Based on Ignition's bytecode and feedback vector, it builds an intermediate representation in SSA (Static Single Assignment) form, applies numerous optimization passes, and then generates highly efficient machine code.

### 4.2 Conditions that Trigger Optimization

The conditions under which TurboFan optimizing-compiles a function are as follows.

```javascript
// Example of an optimization trigger
function hotFunction(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}

// When the number of loop iterations or bytecode executions
// exceeds a threshold, optimization by TurboFan begins.
//
// Approximate thresholds (dynamically adjusted inside V8):
// - Number of times a function is called
// - Loop back-edge count (counted once per loop iteration)
// - Determination for OSR (On-Stack Replacement)
//
// Check optimization status in Node.js:
// node --trace-opt --trace-deopt script.js
```

### 4.3 Key Optimization Techniques

The following are representative optimization techniques applied by TurboFan.

**Inlining:**

```javascript
// Before optimization
function square(x) {
  return x * x;
}

function sumOfSquares(a, b) {
  return square(a) + square(b);
}

// After TurboFan inlining (conceptual)
function sumOfSquares_optimized(a, b) {
  return a * a + b * b;  // Eliminates function call overhead
}
```

Through inlining, the overhead of a function call (creating a stack frame, passing arguments, managing return addresses) is eliminated. TurboFan makes inlining decisions based on function size, call frequency, and call depth.

**Constant Folding:**

```javascript
// Before optimization
const TIMEOUT = 60 * 1000;  // Convert 60 seconds to milliseconds

// After TurboFan optimization
const TIMEOUT = 60000;  // Calculated at compile time
```

**Dead Code Elimination:**

```javascript
// Before optimization
function process(x) {
  const unused = x * 2;  // This result is never used
  return x + 1;
}

// After TurboFan optimization
function process_optimized(x) {
  return x + 1;  // Unnecessary calculation removed
}
```

**Loop-Invariant Code Motion:**

```javascript
// Before optimization
function processArray(arr, factor) {
  const results = [];
  for (let i = 0; i < arr.length; i++) {
    const multiplier = factor * 2;  // Same calculation every iteration
    results.push(arr[i] * multiplier);
  }
  return results;
}

// After TurboFan optimization (conceptual)
function processArray_optimized(arr, factor) {
  const results = [];
  const multiplier = factor * 2;  // Moved outside the loop
  const len = arr.length;         // Length retrieval also moved outside
  for (let i = 0; i < len; i++) {
    results.push(arr[i] * multiplier);
  }
  return results;
}
```

**Type Specialization:**

```javascript
// Feedback vector information:
// → the add function is always called with SMI (Small Integer) arguments

function add(a, b) {
  return a + b;
}

// Machine code generated by TurboFan (conceptual pseudocode):
//
// 1. Check that a is an SMI (type guard)
// 2. Check that b is an SMI (type guard)
// 3. Integer addition between two SMIs (complete in 1 instruction)
// 4. Overflow check
// 5. Return result
//
// If a type guard fails → deoptimize
```

### 4.4 Deoptimization

Optimized code generated by TurboFan is based on type assumptions. If these assumptions break at runtime, V8 performs **deoptimization** and falls back to Ignition's bytecode execution.

```javascript
// Scenario where deoptimization occurs

function add(a, b) {
  return a + b;
}

// Phase 1: Keep calling with SMIs (integers) → TurboFan optimizes for integer addition
for (let i = 0; i < 100000; i++) {
  add(i, i + 1);  // Always integers
}

// Phase 2: Suddenly pass a string → deoptimization occurs!
add("hello", " world");
// → TurboFan's optimized code assumes integer addition, so it can't be used
// → Falls back to Ignition's bytecode to execute string concatenation
// → Profiles again and considers new optimizations
```

**Types of deoptimization:**

```
┌─────────────────────────────────────────────────────────┐
│              Classification of Deoptimization            │
├─────────────────┬───────────────────────────────────────┤
│ Eager Deopt     │ Detected immediately, e.g., type guard │
│                 │ failure. Example: a string arrives     │
│                 │ where an integer was expected          │
├─────────────────┼───────────────────────────────────────┤
│ Lazy Deopt      │ Detected while processing side effects │
│                 │ after code execution. Example: a map   │
│                 │ change is detected                     │
├─────────────────┼───────────────────────────────────────┤
│ Soft Deopt      │ When optimized code is judged          │
│                 │ inefficient. Example: detection of a   │
│                 │ polymorphic call site                  │
└─────────────────┴───────────────────────────────────────┘
```

### 4.5 OSR (On-Stack Replacement)

Normal optimization is applied starting from the next function call, but OSR is a technique that switches to optimized code **in the middle of an executing loop**.

```javascript
function longRunningLoop() {
  let sum = 0;
  for (let i = 0; i < 10000000; i++) {
    sum += i;
    // Optimization decision is made at the loop's back-edge
    // When the threshold is exceeded, switches to optimized code
    // mid-loop (OSR)
    // → The state of loop variables i, sum is carried over to the optimized code
  }
  return sum;
}

// This function is only called once, but is
// optimized via OSR inside the loop
longRunningLoop();
```

OSR is particularly effective for loops that run for a long time. Even if a function is only called once, optimization is applied if the loop iteration count exceeds the threshold.

---

## 5. Hidden Classes (Maps)

### 5.1 Basic Concept of Hidden Classes

JavaScript objects are dynamic, and properties can be freely added or removed at runtime. However, this flexibility adversely affects property access performance. V8 solves this problem with a mechanism called **Hidden Classes** (referred to internally as **Maps**).

A Hidden Class is metadata that describes the "shape" of an object and contains the following information:

- Property names
- Property offsets (positions in memory)
- Property attributes (writable, enumerable, configurable)
- Prototype chain references

### 5.2 Hidden Class Transition Chain

A new Hidden Class is created each time a property is added to an object, forming a transition chain.

```
┌───────────────────────────────────────────────────────────────┐
│           Example of a Hidden Class Transition Chain           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  const point = {};          // Map M0 (empty object)          │
│  point.x = 10;             // Map M0 → M1 transition         │
│  point.y = 20;             // Map M1 → M2 transition         │
│                                                               │
│                                                               │
│  Map M0          Map M1              Map M2                   │
│  ┌─────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │ (empty)  │───▶│ x: offset 0  │───▶│ x: offset 0  │         │
│  │          │ x  │              │ y  │ y: offset 1  │         │
│  └─────────┘    └──────────────┘    └──────────────┘         │
│                                                               │
│  Transition info is stored in Map M0:                         │
│  M0.transitions = { "x" → M1 }                               │
│  M1.transitions = { "y" → M2 }                               │
│                                                               │
│  When another object adds properties in the same order,       │
│  the existing transition chain is reused:                     │
│                                                               │
│  const point2 = {};         // Map M0 (same)                  │
│  point2.x = 30;            // Map M0 → M1 (reused)           │
│  point2.y = 40;            // Map M1 → M2 (reused)           │
│                                                               │
│  → point and point2 share the same Map M2!                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 Hidden Class Sharing and Branching

Objects with the same "shape" share a Hidden Class, but if properties are added in a different order, a different Hidden Class is created.

```javascript
// Case 1: Same order → share Hidden Class
const a = {};
a.x = 1;
a.y = 2;

const b = {};
b.x = 3;
b.y = 4;
// a and b have the same Hidden Class

// Case 2: Different order → different Hidden Class
const c = {};
c.y = 2;  // Add y first
c.x = 1;  // Then add x
// c has a different Hidden Class from a, b

// Case 3: Object literal → optimized
const d = { x: 1, y: 2 };
const e = { x: 3, y: 4 };
// d and e have the same Hidden Class (same literal shape)

// Case 4: delete operator → Hidden Class invalidated
const f = { x: 1, y: 2 };
delete f.x;
// f switches to "slow mode" (dictionary mode)
// → The Hidden Class optimization is lost
```

### 5.4 In-Object Properties vs. Backing Store

V8 stores object properties in two ways.

```
┌───────────────────────────────────────────────────────────┐
│         Property Storage Methods                          │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  [In-Object Properties]                                   │
│  Stored directly in the object itself                     │
│  ┌──────────────────────────┐                             │
│  │ Object Header            │                             │
│  │ ├── Map pointer          │                             │
│  │ ├── Properties pointer   │                             │
│  │ ├── Elements pointer     │                             │
│  │ ├── In-object prop 0 (x) │  ← Directly accessible     │
│  │ ├── In-object prop 1 (y) │  ← Directly accessible     │
│  │ └── In-object prop 2 (z) │  ← Directly accessible     │
│  └──────────────────────────┘                             │
│  → Fastest (direct access via fixed offset)               │
│  → V8 reserves space by estimating the initial            │
│    number of properties                                   │
│                                                           │
│  [Backing Store (Properties array)]                       │
│  Used when In-Object slots are insufficient               │
│  ┌──────────────────────────┐    ┌──────────────┐        │
│  │ Object Header            │    │ Properties    │        │
│  │ ├── Map pointer          │    │ ├── prop 3    │        │
│  │ ├── Properties pointer ──┼───▶│ ├── prop 4    │        │
│  │ ├── Elements pointer     │    │ └── prop 5    │        │
│  │ ├── In-object prop 0     │    └──────────────┘        │
│  │ ├── In-object prop 1     │                             │
│  │ └── In-object prop 2     │                             │
│  └──────────────────────────┘                             │
│  → Slightly slower (one indirection required)             │
│                                                           │
│  [Dictionary Mode (Slow Properties)]                      │
│  After using the delete operator, or when there           │
│  are a very large number of properties                    │
│  → Hash table-based storage                               │
│  → Hidden Class optimization disabled                     │
│  → Slowest                                                │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 5.5 Elements (Array Element) Storage

Separately from named properties, numerically indexed properties (array elements) are stored in a separate **Elements** array.

```javascript
// Element types (V8 internal ElementsKind)

// PACKED_SMI_ELEMENTS: all elements are small integers
const smiArray = [1, 2, 3, 4, 5];

// PACKED_DOUBLE_ELEMENTS: contains floating-point numbers
const doubleArray = [1.1, 2.2, 3.3];

// PACKED_ELEMENTS: objects or mixed types
const mixedArray = [1, "two", { three: 3 }];

// HOLEY_SMI_ELEMENTS: sparse array (integers)
const holeyArray = [1, , 3];  // Index 1 is empty

// ElementsKind transitions (one-way only, cannot go back!)
//
// PACKED_SMI_ELEMENTS
//     │
//     ├──→ PACKED_DOUBLE_ELEMENTS
//     │        │
//     │        ├──→ PACKED_ELEMENTS
//     │        │
//     │        └──→ HOLEY_DOUBLE_ELEMENTS ──→ HOLEY_ELEMENTS
//     │
//     └──→ HOLEY_SMI_ELEMENTS
//              │
//              ├──→ HOLEY_DOUBLE_ELEMENTS ──→ HOLEY_ELEMENTS
//              │
//              └──→ HOLEY_ELEMENTS

// Once HOLEY, it can never go back to PACKED
const arr = [1, 2, 3];       // PACKED_SMI_ELEMENTS
arr.push(4.5);               // → PACKED_DOUBLE_ELEMENTS (irreversible transition)
arr.push("hello");           // → PACKED_ELEMENTS (irreversible transition)
```

---

## 6. Inline Cache (IC)

### 6.1 Basic Principles of Inline Cache

Inline Cache is a mechanism for speeding up property access. A JavaScript property access `obj.x` normally requires the following steps:

1. Get the object's Hidden Class
2. Search for "x" in the Hidden Class's property table
3. Retrieve the offset
4. Read the property value from memory at that offset

Inline Cache caches the search result so that for objects with the same Hidden Class, steps 2-3 are skipped.

```javascript
function getX(obj) {
  return obj.x;  // ← An IC is generated at this access site
}

// 1st call: IC miss
// → Check the Hidden Class and search for the offset of "x"
// → Cache the result in the IC (Hidden Class → offset pair)
const p1 = { x: 10, y: 20 };
getX(p1);

// 2nd call onwards: IC hit
// → Hidden Class matches the cache → use the offset directly
// → Skip the property table search
const p2 = { x: 30, y: 40 };  // Same Hidden Class as p1
getX(p2);  // Fast access
```

### 6.2 IC State Machine

Inline Cache operates as a finite state machine with the following states.

```
┌─────────────────────────────────────────────────────────────┐
│              IC State Transition Diagram                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐   1st Map         ┌──────────────┐        │
│  │ Uninitialized │ ────────────▶    │ Monomorphic  │        │
│  └──────────────┘                  └──────┬───────┘        │
│                                           │                 │
│                                  Different Map              │
│                                           ▼                 │
│                                  ┌──────────────┐           │
│                                  │ Polymorphic  │           │
│                                  │ (2-4 maps)   │           │
│                                  └──────┬───────┘           │
│                                         │                   │
│                                5+ Maps  │                   │
│                                         ▼                   │
│                                  ┌──────────────┐           │
│                                  │ Megamorphic  │           │
│                                  │ (5+ maps)    │           │
│                                  └──────────────┘           │
│                                                             │
│  Performance:                                               │
│  Monomorphic  ≫  Polymorphic  ≫  Megamorphic               │
│  (Fastest)        (Medium)         (Slowest / opt. disabled)│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Details of Each State

**Monomorphic — Fastest:**

```javascript
// Always the same Hidden Class object is passed
function getName(person) {
  return person.name;  // IC: monomorphic
}

// All objects have the same shape
getName({ name: "Alice", age: 30 });
getName({ name: "Bob", age: 25 });
getName({ name: "Charlie", age: 35 });
// → IC records only one Hidden Class → fastest
```

**Polymorphic — Medium:**

```javascript
// 2–4 types of Hidden Classes mixed
function getArea(shape) {
  return shape.area;  // IC: polymorphic
}

getArea({ area: 100, type: "circle" });     // Hidden Class A
getArea({ area: 200, width: 10, height: 20 }); // Hidden Class B
// → IC records 2 Hidden Classes → still fast enough
// → Linear search to find the matching Hidden Class
```

**Megamorphic — Slowest:**

```javascript
// 5 or more types of Hidden Classes mixed
function getValue(obj) {
  return obj.value;  // IC: megamorphic
}

getValue({ value: 1 });
getValue({ value: 2, a: 1 });
getValue({ value: 3, a: 1, b: 2 });
getValue({ value: 4, a: 1, b: 2, c: 3 });
getValue({ value: 5, a: 1, b: 2, c: 3, d: 4 });
getValue({ value: 6, x: 1 });
// → IC goes megamorphic → cache disabled
// → Every call requires a Hidden Class search → slow
// → TurboFan also gives up on type specialization
```

### 6.4 Types of ICs

V8 has multiple IC types beyond property access.

| IC type | Target operation | Example |
|--------|----------|-----|
| LoadIC | Property read | `obj.x` |
| StoreIC | Property write | `obj.x = 1` |
| KeyedLoadIC | Read by dynamic key | `obj[key]` |
| KeyedStoreIC | Write by dynamic key | `obj[key] = 1` |
| CallIC | Function call | `obj.method()` |
| CompareIC | Comparison | `a === b` |
| BinaryOpIC | Binary operation | `a + b` |

---

## 7. Garbage Collection (GC)

### 7.1 V8's Memory Structure

V8's heap memory is divided into multiple regions.

```
┌──────────────────────────────────────────────────────────────┐
│                    V8 Heap Memory Structure                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────┐              │
│  │          New Space (Young Generation)        │              │
│  │  ┌──────────────┬───────────────────┐      │              │
│  │  │  Semi-space   │  Semi-space       │      │              │
│  │  │  (From)       │  (To)             │      │              │
│  │  │  1-16 MB      │  1-16 MB          │      │              │
│  │  └──────────────┴───────────────────┘      │              │
│  │  Where newly created objects are placed     │              │
│  │  Target of Minor GC (Scavenge)              │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
│  ┌────────────────────────────────────────────┐              │
│  │          Old Space (Old Generation)          │              │
│  │  ┌──────────────────────────────────┐      │              │
│  │  │  Old Pointer Space                │      │              │
│  │  │  → Contains references to other  │      │              │
│  │  │    objects                        │      │              │
│  │  ├──────────────────────────────────┤      │              │
│  │  │  Old Data Space                   │      │              │
│  │  │  → Data without references       │      │              │
│  │  │    (strings, etc.)               │      │              │
│  │  └──────────────────────────────────┘      │              │
│  │  Objects that survived 2 Minor GCs          │              │
│  │  Target of Major GC (Mark-Sweep-Compact)    │              │
│  │  Size: configurable with --max-old-space-size│              │
│  └────────────────────────────────────────────┘              │
│                                                              │
│  ┌────────────────────────────────────────────┐              │
│  │          Large Object Space                  │              │
│  │  Large objects that don't fit in             │              │
│  │  normal pages                                │              │
│  │  Managed by GC individually                  │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
│  ┌────────────────────────────────────────────┐              │
│  │          Code Space                          │              │
│  │  Where JIT-compiled code is placed           │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
│  ┌────────────────────────────────────────────┐              │
│  │          Map Space                           │              │
│  │  Where Hidden Class (Map) objects are placed │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Minor GC (Scavenge)

The young generation GC uses **Scavenge** (a variant of Cheney's algorithm).

```
Scavenge algorithm flow:

Step 1: Allocation
┌────────────────────────────┬────────────────────────────┐
│ From Space (active)         │ To Space (inactive)         │
│ [A][B][C][D][E][ free ]    │ [ empty                  ] │
└────────────────────────────┴────────────────────────────┘

Step 2: GC triggered (From Space is nearly full)
  → Identify objects reachable from root objects
  → A, C, E survive; B, D are unreachable (garbage)

Step 3: Copy
┌────────────────────────────┬────────────────────────────┐
│ From Space                  │ To Space                    │
│ [A][B][C][D][E][ free ]    │ [A'][C'][E'][ free       ] │
└────────────────────────────┴────────────────────────────┘
  → Copy surviving objects to To Space
  → Update references with the copy destination address

Step 4: Swap
┌────────────────────────────┬────────────────────────────┐
│ To Space → new From Space   │ From Space → new To Space   │
│ [A'][C'][E'][ free       ] │ [ empty (released)        ] │
└────────────────────────────┴────────────────────────────┘
  → Swap From and To
  → Old From Space is released entirely (no individual frees needed)

Promotion:
  → Objects that survived 2 Scavenges are moved to Old Space
  → Judged to be "long-lived objects"
```

### 7.3 Major GC (Mark-Sweep-Compact)

The old generation GC uses the **Mark-Sweep-Compact** algorithm.

**Mark phase:**

```
Starting from root objects (stack, global variables, etc.),
recursively mark all reachable objects.

  Root Set
    │
    ├──▶ Object A (marked ✓)
    │      ├──▶ Object D (marked ✓)
    │      └──▶ Object E (marked ✓)
    │
    └──▶ Object B (marked ✓)
           └──▶ Object F (marked ✓)

  Object C (unmarked ✗) → Unreachable → Garbage
  Object G (unmarked ✗) → Unreachable → Garbage
```

**Sweep phase:**

Free the memory of unmarked objects and add to the free list.

**Compact phase:**

To eliminate memory fragmentation, move surviving objects to consolidate them into a contiguous memory region. This speeds up subsequent allocations.

### 7.4 Incremental Marking and Concurrent GC

Major GC targets the entire old generation, which takes time. To reduce the main-thread pause time (stop-the-world pause) caused by this, V8 employs the following techniques.

```
[Traditional Stop-the-world GC]
JS execution ────────┤ GC (long pause) ├──── JS execution
               └─── 100ms+ ───┘

[Incremental Marking]
JS execution ──┤GC├── JS ──┤GC├── JS ──┤GC├── JS execution
         5ms       5ms       5ms
→ Splits GC work into small steps
→ Alternates with JS execution

[Concurrent GC]
Main thread:       JS execution ──────────────────────── JS execution
Background:              ├── GC marking ──┤
→ Most GC work is done on a background thread
→ Main thread pause approaches nearly zero

[Parallel GC]
Main thread:    ├── GC ──┤
Helper thread 1:├── GC ──┤
Helper thread 2:├── GC ──┤
→ Pause is still needed, but parallel processing on multiple
  threads reduces the time
```

Through V8's Orinoco GC project, these techniques are combined and GC pause time is kept to a few milliseconds or less in most cases.

---

## 8. V8 Array Optimizations

### 8.1 Details of ElementsKind

V8 switches internal representations based on the element types of arrays. Maintaining an appropriate ElementsKind significantly improves array operation performance.

```javascript
// PACKED_SMI_ELEMENTS: fastest
// SMI = Small Integer (31-bit signed int on 32-bit, 32-bit signed on 64-bit)
const smiArray = [1, 2, 3, 4, 5];
// → Elements stored unboxed (without tags)
// → No pointer tracking or tag checks required

// PACKED_DOUBLE_ELEMENTS
const doubleArray = [1.1, 2.2, 3.3];
// → Stored as IEEE 754 double-precision floating point
// → No heap object overhead

// PACKED_ELEMENTS: most general but slowest
const objectArray = [{ x: 1 }, "hello", true];
// → Each element is a pointer to a heap object
// → GC needs to track the pointers
```

### 8.2 Array Optimization Guidelines

```javascript
// Good: uniform element type
const numbers = [1, 2, 3, 4, 5];  // PACKED_SMI_ELEMENTS
numbers.push(6);  // OK: stays SMI

// Bad: mixed types cause irreversible transitions
const bad = [1, 2, 3];           // PACKED_SMI_ELEMENTS
bad.push(4.5);                   // → PACKED_DOUBLE_ELEMENTS (irreversible)
bad.push("hello");               // → PACKED_ELEMENTS (irreversible)
// Will never return to PACKED_SMI_ELEMENTS

// Good: pre-allocation
const preallocated = new Array(1000);
// Note: this becomes HOLEY_SMI_ELEMENTS

// Better: initialize with fill
const filled = new Array(1000).fill(0);
// PACKED_SMI_ELEMENTS (no holes)

// Bad: sparse array
const holey = [1, , 3];  // HOLEY_SMI_ELEMENTS
// Access to index 1 requires a prototype chain search
// → Slower than PACKED
```

---

## 9. Practical Performance Optimization

### 9.1 Ensuring Type Stability

V8 operates most efficiently when the types of variables and function arguments are stable.

```javascript
// Anti-pattern 1: assigning different types to the same variable
function unstable() {
  let value = 42;       // SMI
  value = 3.14;         // → Double
  value = "hello";      // → String
  value = { x: 1 };    // → Object
  return value;
}
// → TurboFan cannot perform type specialization → difficult to optimize

// Recommended pattern: keep variable types consistent
function stable() {
  const intValue = 42;
  const floatValue = 3.14;
  const strValue = "hello";
  const objValue = { x: 1 };
  return objValue;
}
```

### 9.2 Best Practices for Object Initialization

```javascript
// Anti-pattern 2: conditional property addition
function createUser(name, email, isAdmin) {
  const user = { name, email };
  if (isAdmin) {
    user.role = "admin";        // Hidden Class branches
    user.permissions = ["all"];  // Further branching
  }
  return user;
}
// → Different Hidden Classes for isAdmin=true and isAdmin=false
// → IC at sites using this function becomes polymorphic

// Recommended pattern: initialize all properties
function createUserOptimized(name, email, isAdmin) {
  return {
    name,
    email,
    role: isAdmin ? "admin" : null,
    permissions: isAdmin ? ["all"] : null,
  };
}
// → All objects have the same Hidden Class → IC stays monomorphic

// Recommended pattern: use a class
class User {
  constructor(name, email, isAdmin) {
    this.name = name;
    this.email = email;
    this.role = isAdmin ? "admin" : null;
    this.permissions = isAdmin ? ["all"] : null;
  }
}
// → All properties initialized in constructor → stable Hidden Class
```

### 9.3 Keeping Functions Monomorphic

```javascript
// Anti-pattern: pass objects with various shapes to the same function
function processItem(item) {
  return item.name + ": " + item.value;
}

processItem({ name: "A", value: 1 });
processItem({ name: "B", value: 2, extra: true });       // Different Hidden Class
processItem({ name: "C", value: 3, x: 1, y: 2 });       // Yet another Hidden Class
processItem({ value: 4, name: "D" });                     // Different order → different Hidden Class
// → IC goes megamorphic → performance degrades

// Recommended pattern: use a consistent shape
class Item {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
}

processItem(new Item("A", 1));
processItem(new Item("B", 2));
processItem(new Item("C", 3));
// → All the same Hidden Class → IC stays monomorphic → fastest
```

### 9.4 Avoiding the delete Operator

```javascript
// Anti-pattern: deleting properties with delete
const obj = { x: 1, y: 2, z: 3 };
delete obj.y;
// → Object switches to "dictionary mode (slow mode)"
// → Hidden Class optimization is completely lost
// → All subsequent property accesses on this object become slow

// Recommended pattern: assign null or undefined
const obj2 = { x: 1, y: 2, z: 3 };
obj2.y = undefined;
// → Hidden Class is preserved
// → Property access optimization continues

// Recommended pattern: create a new object
const { y, ...rest } = { x: 1, y: 2, z: 3 };
// rest = { x: 1, z: 3 }
// → New object gets a new Hidden Class, but
//   does not go into dictionary mode
```

### 9.5 Notes on Numeric Types

V8 manages numbers internally in multiple representations.

```javascript
// SMI (Small Integer): most efficient
// → 31-bit signed integer (32-bit platform)
// → 32-bit signed integer (64-bit platform)
// → Stored as a tagged pointer immediate (no heap allocation needed)
const smi = 42;

// HeapNumber: floating-point number allocated on the heap
// → Integers outside the SMI range, or decimals
// → Has heap object overhead
const heapNum = 3.14;
const bigInt = 2147483648;  // Outside SMI range

// Impact of SMI vs Double in arrays
const smiArr = [1, 2, 3];           // PACKED_SMI_ELEMENTS (fastest)
const doubleArr = [1, 2, 3.0];      // PACKED_DOUBLE_ELEMENTS
// The mere presence of 3.0 makes it a Double array

// When integer arithmetic overflows, the type changes
let counter = 0;
for (let i = 0; i < 1000000; i++) {
  counter += i;
  // When counter exceeds the SMI range, it changes to HeapNumber
  // → Addition in the loop may suddenly become slower
}
```

---

## 10. V8 Debugging and Profiling

### 10.1 List of V8 Flags

The following is a summary of V8 debug flags usable in Node.js or Chrome (via DevTools Protocol).

```bash
# Track optimizations
node --trace-opt script.js
# → Shows functions that TurboFan has optimized

# Track deoptimizations
node --trace-deopt script.js
# → Shows where deoptimization occurred and why

# Print bytecode
node --print-bytecode script.js
# → Shows the bytecode generated by Ignition

# Print only bytecode for a specific function
node --print-bytecode --print-bytecode-filter="functionName" script.js

# Track GC
node --trace-gc script.js
# → Shows when GC events occur and how long they take

# Detailed GC information
node --trace-gc-verbose script.js

# Track Hidden Class (Map) transitions
node --trace-maps script.js

# Track IC state
node --trace-ic script.js

# Output TurboFan optimization graph (for Turbolizer)
node --trace-turbo script.js
# → Generates turbo-*.json files
# → Visualize at https://v8.github.io/tools/turbolizer/
```

### 10.2 V8 Analysis with Chrome DevTools

```
V8 performance analysis with Chrome DevTools:

1. Performance tab
   → Record CPU profile
   → Check execution time per function
   → Identify hot spots

2. Memory tab
   → Heap Snapshot: list all objects on the heap
   → Allocation Timeline: time-series view of memory allocations
   → Allocation Sampling: low-overhead sampling

3. Verification in Console
   → %HasFastProperties(obj)
      Check whether an object is in fast properties (Hidden Class) mode
      * Requires the --allow-natives-syntax flag

   → %OptimizeFunctionOnNextCall(fn)
      Force-optimize a function on its next call
      * For testing purposes only. Do not use in production.

   → %GetOptimizationStatus(fn)
      Returns the optimization status of a function as a number
```

### 10.3 How to Check Optimization Status

```javascript
// Check using the --allow-natives-syntax flag in Node.js
// * This flag exposes V8's internal API; use only for development/testing

function testFunction(a, b) {
  return a + b;
}

// Warm up
for (let i = 0; i < 100000; i++) {
  testFunction(i, i + 1);
}

// Check optimization status
// Return values of %GetOptimizationStatus(testFunction):
// 1 = function is optimizable
// 2 = function is optimized
// 3 = function is always optimized
// 4 = function is not optimized
// 6 = function may be baseline code
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: Impact of try-catch on Optimization

In older versions of V8 (the Crankshaft era), functions containing `try-catch` were excluded from optimization. TurboFan has largely removed this restriction, but some cases still warrant caution.

```javascript
// Old anti-pattern (Crankshaft era)
// → The mere presence of try-catch prevented the entire function from being optimized
function oldPattern() {
  try {
    // Hot code
    for (let i = 0; i < 1000000; i++) {
      // Heavy processing
    }
  } catch (e) {
    console.error(e);
  }
}

// Current state in the TurboFan era:
// → try-catch itself does not hinder optimization
// → However, code inside the catch block is harder to optimize
//   (on the assumption that exceptions should be rare)

// Edge case: type instability inside try-catch
function parseJSON(str) {
  try {
    return JSON.parse(str);
    // Return type is indeterminate: string, number, object, array, etc.
    // → IC at the call site is prone to becoming polymorphic
  } catch (e) {
    return null;
    // null is also added to the possible return types
    // → IC at the call site becomes even more complex
  }
}

// Recommended: make an effort to unify the return type
function parseJSONSafe(str) {
  try {
    const result = JSON.parse(str);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, data: null };
  }
}
// → Always returns an object of the same shape → stable Hidden Class
```

### 11.2 Edge Case 2: arguments Object Leak

```javascript
// The arguments object has special behavior and
// can adversely affect optimization

// Anti-pattern: passing arguments to another function (leak)
function leakyFunction() {
  // arguments is captured by the closure → difficult to optimize
  return Array.prototype.slice.call(arguments);
}

// Anti-pattern: assigning arguments to an external variable
function badPattern() {
  const args = arguments;  // arguments object "leaks"
  return function() {
    return args[0];  // arguments is referenced inside a closure
  };
}

// Recommended pattern: use rest parameters
function goodPattern(...args) {
  // args is a normal array → no optimization issues
  return args.slice();
}

// Recommended pattern: ES2015+ destructuring
function betterPattern(first, second, ...rest) {
  return [first, second, ...rest];
}
```

### 11.3 Edge Case 3: with Statement and eval

```javascript
// The with statement completely blocks V8 optimization
// → The scope chain becomes dynamic and variable resolution
//   cannot be done statically

// Anti-pattern: with statement
function withExample(obj) {
  with (obj) {
    // Cannot determine at compile time whether x is obj.x
    // or an x from an outer scope
    return x + y;
  }
}
// → The entire function may be excluded from optimization
// → In strict mode, the with statement is a syntax error

// eval causes the same problems
function evalExample(code) {
  eval(code);
  // Variables may be declared/modified inside eval
  // → The entire function's scope becomes dynamic
  // → Optimization of Hidden Classes and scope is impossible
}

// Indirect eval (executed in global scope) has limited impact
const indirectEval = eval;
indirectEval("console.log('hello')");
// → Does not affect the calling function's scope
```

---

## 12. Comparison Tables

### 12.1 V8 vs Other JavaScript Engines

| Feature | V8 (Chrome/Node) | SpiderMonkey (Firefox) | JavaScriptCore (Safari) |
|------|------------------|----------------------|------------------------|
| Developer | Google | Mozilla | Apple |
| Interpreter | Ignition (register-based) | Warp Baseline | LLInt (Low Level Interpreter) |
| Optimizing compiler | TurboFan | Ion (Warp) | DFG + FTL (B3) |
| JIT tiers | 2 (Ignition → TurboFan) | 3 (Baseline → IC → Ion) | 4 (LLInt → Baseline → DFG → FTL) |
| GC method | Generational Mark-Sweep-Compact | Generational Incremental GC | Generational Mark-Sweep (Riptide) |
| Hidden Class name | Map | Shape | Structure |
| IC implementation | Feedback vector | CacheIR | Polymorphic IC |
| WebAssembly | Liftoff + TurboFan | Baseline + Ion | BBQ + OMG |
| Runtime | Chrome, Node.js, Deno, Electron | Firefox, SpiderNode | Safari, Bun |

### 12.2 Comparison by Optimization Level

| Feature | Ignition (bytecode) | TurboFan (optimized) |
|------|----------------------|---------------------|
| Startup speed | Fast (bytecode generation is lightweight) | Slow (compilation takes time) |
| Execution speed | Medium (interpreted execution) | Fast (native code execution) |
| Memory usage | Small (bytecode is compact) | Large (machine code is larger) |
| Compile time | Short | Long (many optimization passes) |
| Type specialization | None (generic bytecode) | Yes (based on feedback vector) |
| Deoptimization | Not needed (generic code) | May be needed (when type assumptions break) |
| Applies to | All functions (first execution) | Hot spots only |
| Debuggability | High (1:1 with bytecode) | Low (diverges from original due to inlining, etc.) |

---

## 13. Memory Leak Prevention

### 13.1 Typical Memory Leak Patterns

V8's GC automatically manages reachable objects, but "memory leaks" occur when unintended references remain.

```javascript
// Pattern 1: forgetting to remove event listeners
class Component {
  constructor() {
    this.data = new Array(10000).fill("large data");
    // Register event listener
    window.addEventListener("resize", this.handleResize);
  }

  handleResize = () => {
    console.log(this.data.length);
  };

  destroy() {
    // Without removing the listener,
    // this Component instance will not be GC'd
    // → The large array this.data also leaks
  }
}

// Fixed version
class ComponentFixed {
  constructor() {
    this.data = new Array(10000).fill("large data");
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);
  }

  handleResize() {
    console.log(this.data.length);
  }

  destroy() {
    window.removeEventListener("resize", this.handleResize);
    this.data = null;  // Explicitly break the reference
  }
}
```

```javascript
// Pattern 2: unintended reference retention via closures
function createProcessor() {
  const hugeData = new Array(1000000).fill("x");  // Huge data

  // This function keeps holding a reference to hugeData
  return function process(input) {
    // Even if hugeData is not used directly,
    // the closure holds a reference to variables in the same scope
    return input.toUpperCase();
  };
}

const processor = createProcessor();
// → hugeData will not be GC'd as long as processor exists

// Fixed version: separate the scope
function createProcessorFixed() {
  const hugeData = new Array(1000000).fill("x");
  const result = processHugeData(hugeData);

  // Complete processing that uses hugeData before
  // returning the closure
  return function process(input) {
    return input.toUpperCase() + result;
  };
}
```

```javascript
// Pattern 3: forgetting to clear timers
function startPolling() {
  const data = { buffer: new ArrayBuffer(1024 * 1024) }; // 1MB

  const intervalId = setInterval(() => {
    // Reference to data is kept alive
    console.log(data.buffer.byteLength);
  }, 1000);

  // Without returning intervalId, there is no way to clear it
  // → data will never be GC'd
}

// Fixed version
function startPollingFixed() {
  const data = { buffer: new ArrayBuffer(1024 * 1024) };

  const intervalId = setInterval(() => {
    console.log(data.buffer.byteLength);
  }, 1000);

  // Return a cleanup function
  return function stop() {
    clearInterval(intervalId);
    // Clearing intervalId removes the reference to the callback,
    // making data eligible for GC
  };
}
```

### 13.2 WeakRef and FinalizationRegistry

WeakRef and FinalizationRegistry, introduced in ES2021, are powerful tools for preventing memory leaks.

```javascript
// WeakRef: weak reference (does not prevent GC)
class Cache {
  constructor() {
    this.cache = new Map();
  }

  set(key, value) {
    // Hold value via WeakRef → GC can collect it if needed
    this.cache.set(key, new WeakRef(value));
  }

  get(key) {
    const ref = this.cache.get(key);
    if (ref) {
      const value = ref.deref();  // Dereference the weak reference
      if (value !== undefined) {
        return value;  // Still alive
      }
      // Was GC'd → delete the cache entry
      this.cache.delete(key);
    }
    return undefined;
  }
}

// FinalizationRegistry: callback when an object is GC'd
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`Object with key "${heldValue}" was garbage collected`);
  // Cleanup processing (releasing external resources, etc.)
});

function createManagedObject(key) {
  const obj = { data: new Array(10000) };
  registry.register(obj, key);  // When obj is GC'd, callback with key as argument
  return obj;
}

// WeakMap: keys are weak references (entry auto-deleted when key object is GC'd)
const metadata = new WeakMap();

function attachMetadata(obj, meta) {
  metadata.set(obj, meta);
  // When obj is no longer referenced from anywhere,
  // the WeakMap entry is automatically deleted as well
}
```

---

## 14. WebAssembly and V8

### 14.1 V8's WebAssembly Execution Pipeline

V8 can also execute WebAssembly and has a dedicated compilation pipeline.

```
┌──────────────────────────────────────────────────────────┐
│          V8 WebAssembly Pipeline                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  .wasm binary                                            │
│      │                                                   │
│      ▼                                                   │
│  ┌──────────────┐                                        │
│  │  Validation   │  Validate the Wasm binary             │
│  └──────┬───────┘                                        │
│         │                                                │
│         ├──────────────────┐                              │
│         ▼                  ▼                              │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │  Liftoff       │  │  TurboFan     │                      │
│  │  (Baseline)    │  │  (Optimizing) │                      │
│  │                │  │               │                      │
│  │  Fast compile  │  │  High-quality │                      │
│  │  Low-quality   │  │  optimization │                      │
│  │  code          │  │  Slow compile │                      │
│  └──────┬───────┘  └──────┬───────┘                      │
│         │                  │                              │
│         ▼                  ▼                              │
│  Start executing     After TurboFan completes,            │
│  immediately         replace Liftoff code                 │
│  (latency focus)     (throughput focus)                   │
│                                                          │
│  Lazy Compilation:                                       │
│  → Compile when a function is first called               │
│  → Don't compile unused functions                        │
│  → Contributes to shorter startup time                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 14.2 JavaScript and WebAssembly Interoperability

```javascript
// Loading and executing a WebAssembly module
async function loadWasm() {
  const response = await fetch("module.wasm");
  const buffer = await response.arrayBuffer();
  const module = await WebAssembly.compile(buffer);
  const instance = await WebAssembly.instantiate(module, {
    env: {
      // Function passed from JavaScript to Wasm
      log: (value) => console.log(value),
    },
  });

  // Call an exported Wasm function
  const result = instance.exports.add(10, 20);
  // → There is overhead in calls between JavaScript and Wasm
  // → Avoid frequent small calls; delegate chunked processing
}

// Performance considerations:
// · JS → Wasm call: ~10-20ns of overhead
// · Wasm → JS call: larger overhead (type conversions, etc.)
// · Large data: zero-copy transfer with SharedArrayBuffer is ideal
// · Frequent calls to small functions are faster to keep in JS
```

---

## FAQ

### Q1: How do V8's Hidden Classes and Inline Caching work together?

**A:** Hidden Classes and Inline Caching (IC) work closely together to speed up property access.

**Role of Hidden Classes:**
- Metadata that describes the "shape" of an object
- Holds mappings from property names to memory offsets
- Objects with the same shape share the same Hidden Class

**Role of Inline Caching:**
- Caches optimization information at each property access site
- Remembers Hidden Class and offset pairs
- Skips the search on the next identical access

**Concrete example of their cooperation:**

```javascript
function getX(obj) {
  return obj.x;  // ← An IC is generated at this access site
}

// 1st call: IC miss
const p1 = { x: 10, y: 20 };
getX(p1);
// 1. Get p1's Hidden Class (Map M1)
// 2. Search M1's property table for "x"
// 3. Find offset 0
// 4. Cache in IC: { Map: M1, Property: "x", Offset: 0 }

// 2nd call: IC hit
const p2 = { x: 30, y: 40 };  // Same Hidden Class M1 as p1
getX(p2);
// 1. Confirm that p2's Hidden Class is M1
// 2. Use offset 0 directly from the IC cache
// 3. Skip property table search → faster
```

**State transitions:**

```
Uninitialized
    ↓ 1st Hidden Class
Monomorphic — always the same Hidden Class → fastest
    ↓ different Hidden Class
Polymorphic — 2–4 Hidden Classes → medium speed
    ↓ 5+ Hidden Classes
Megamorphic — cache disabled → slowest
```

**Optimization points:**
- Keep using objects with the same shape → maintain Monomorphic state
- Unify property addition order → share Hidden Class
- Use object literals → shape is fixed at initialization

### Q2: What code patterns hinder TurboFan's JIT optimization?

**A:** The following patterns hinder or invalidate TurboFan's optimization.

**1. Type instability — the greatest enemy of optimization**

```javascript
// Anti-pattern: variable types change frequently
function unstable(a, b) {
  return a + b;
}

unstable(1, 2);        // SMI + SMI
unstable(1.5, 2.5);    // Double + Double
unstable("a", "b");    // String + String
unstable({}, {});      // Object + Object

// → TurboFan cannot specialize by type
// → Generates generic (slow) addition code
// → High risk of deoptimization
```

**Recommended pattern:**

```javascript
// Integer-only function
function addInt(a, b) {
  return (a | 0) + (b | 0);  // Bit operation forces integer
}

// Floating-point-only function
function addFloat(a, b) {
  return +a + +b;  // Unary plus operator forces Number type
}
```

**2. Hidden Class branching — IC state deterioration**

```javascript
// Anti-pattern: conditional property addition
function createConfig(enableCache) {
  const config = { baseUrl: "/" };
  if (enableCache) {
    config.cache = true;  // Hidden Class branches
  }
  return config;
}

// → Two different Hidden Classes are created
// → IC at sites using this function becomes Polymorphic
```

**Recommended pattern:**

```javascript
function createConfig(enableCache) {
  return {
    baseUrl: "/",
    cache: enableCache || null,  // Always initialize all properties
  };
}
```

**3. delete operator — falling into dictionary mode**

```javascript
// Anti-pattern: delete properties with delete
const obj = { x: 1, y: 2, z: 3 };
delete obj.y;

// → Object goes into "slow mode (dictionary mode)"
// → Hidden Class optimization is completely lost
// → Subsequent accesses become hash table lookups
```

**Recommended pattern:**

```javascript
// Assign undefined
obj.y = undefined;

// Or create a new object
const { y, ...newObj } = obj;
```

**4. Array holes (Holey Arrays)**

```javascript
// Anti-pattern: sparse array
const arr = [1, 2, , 4];  // Index 2 is empty

// → Transitions to HOLEY_SMI_ELEMENTS
// → Accessing index 2 requires a prototype chain search
// → Slower than PACKED array
```

**Recommended pattern:**

```javascript
const arr = [1, 2, 0, 4];  // Fill the hole
// or
const arr = new Array(4).fill(0);
arr[0] = 1;
arr[1] = 2;
arr[3] = 4;
```

**5. arguments object leak**

```javascript
// Anti-pattern: expose arguments externally
function leaky() {
  const args = arguments;
  return function() { return args[0]; };
}

// → Closure captures arguments
// → Difficult to optimize
```

**Recommended pattern:**

```javascript
function optimized(...args) {
  return function() { return args[0]; };
}
```

**6. Unevaluable dynamic code**

```javascript
// Anti-pattern: eval, with statement
function dynamic(code) {
  eval(code);  // Scope becomes dynamic
}

// → Variable resolution cannot be done statically
// → Entire function excluded from optimization
```

**7. Huge functions — failure of inlining**

```javascript
// Anti-pattern: a 1000-line giant function
function huge() {
  // ... lots of code ...
}

// → TurboFan cannot inline
// → Call overhead remains
```

**Recommended pattern:**

```javascript
// Split into small functions (10–50 lines is a guideline)
function small1() { /* ... */ }
function small2() { /* ... */ }
```

**8. Type instability inside try-catch**

```javascript
// Anti-pattern: returning multiple types from try-catch
function parse(str) {
  try {
    return JSON.parse(str);  // Object, Array, String, Number, etc.
  } catch (e) {
    return null;  // null is also added
  }
}

// → Return type is polymorphic
// → IC at the call site goes Megamorphic
```

**Recommended pattern:**

```javascript
function parse(str) {
  try {
    return { success: true, data: JSON.parse(str) };
  } catch (e) {
    return { success: false, data: null };
  }
}
// → Always returns an object of the same shape
```

### Q3: What are the differences from other major JavaScript engines (SpiderMonkey, JavaScriptCore)?

**A:** The three major engines each have different design philosophies and optimization strategies.

**1. Architectural differences**

| Feature | V8 (Chrome/Node) | SpiderMonkey (Firefox) | JavaScriptCore (Safari/Bun) |
|------|------------------|----------------------|------------------------------|
| **Developer** | Google | Mozilla | Apple |
| **JIT tiers** | 2 | 3 | 4 |
| **Interpreter** | Ignition (register-based) | Warp Baseline | LLInt (Low Level Interpreter) |
| **Baseline compiler** | None (Ignition directly) | Baseline Interpreter | Baseline JIT |
| **Optimizing compiler** | TurboFan | Ion (Warp) | DFG + FTL (B3/Air) |
| **Startup strategy** | Prioritizes fast startup | Balanced | Prioritizes incremental optimization |

**V8's strategy:**
- Two tiers: Ignition (bytecode) → TurboFan (optimized)
- Prioritizes startup speed: bytecode generation is very fast
- Memory efficiency: bytecode is compact

**SpiderMonkey's strategy:**
- Three tiers: Baseline Interpreter → IC Stub → Ion
- Flexible IC generation via CacheIR (Inline Cache IR)
- Focused on WebAssembly optimization (Firefox Reality, etc.)

**JavaScriptCore's strategy:**
- Four tiers: LLInt → Baseline JIT → DFG → FTL
- Assumes long-running execution: most multi-tiered optimization
- FTL (Faster Than Light) uses the LLVM B3 backend
- Emphasizes battery efficiency on Safari and other platforms

**2. Differences in Hidden Class (shape management)**

| Engine | Name | Characteristics |
|---------|------|------|
| V8 | Map | Stores transitions in Maps. Builds a Transition Tree |
| SpiderMonkey | Shape | Shape Lineage system. Fast lookup with ShapeTable |
| JavaScriptCore | Structure | Identified by Structure ID. Property Table is shared |

**V8's Map:**
```javascript
// Property addition order matters
const obj1 = {};
obj1.x = 1;  // Map M0 → M1
obj1.y = 2;  // Map M1 → M2

// Different order → different Map
const obj2 = {};
obj2.y = 2;  // Map M0 → M3
obj2.x = 1;  // Map M3 → M4
```

**SpiderMonkey's Shape:**
- Two-layer structure with BaseShape and Shape
- Prototype information is separated into BaseShape
- Slightly higher Shape sharing rate

**JavaScriptCore's Structure:**
- Fast equality check via Structure ID
- Inline Cache directly compares Structure IDs
- Property Table can be shared across multiple Structures

**3. Garbage collection differences**

| Engine | Young gen GC | Old gen GC | Concurrent/parallel |
|---------|----------|----------|--------------|
| V8 | Scavenge (Cheney's) | Mark-Sweep-Compact | Concurrent Marking, Parallel Scavenging |
| SpiderMonkey | Nursery (Generational) | Incremental Mark-Sweep | Incremental GC, Parallel Marking |
| JavaScriptCore | Eden (Generational) | Full GC (Riptide) | Concurrent GC, DFG Safepoints |

**V8 Orinoco GC:**
- Concurrent Marking: run marking on a background thread
- Parallel Scavenging: parallelize young generation GC
- Idle-time GC: run GC during browser idle time

**SpiderMonkey:**
- Incremental GC: split GC into small pieces to reduce stop-the-world
- Compacting GC: aggressively resolve memory fragmentation
- Background Sweeping: move sweeping to the background

**JavaScriptCore Riptide:**
- Constraint-based GC: constraint-based marking
- DFG Safepoint: safe GC points during optimized code execution
- Incremental Marking: mark a little at a time

**4. Performance characteristic differences**

**General benchmark tendencies:**

| Benchmark type | V8 | SpiderMonkey | JavaScriptCore |
|------------------|-----|--------------|----------------|
| **Startup speed** | Excellent | Good | Slightly slow |
| **Short execution** | Excellent | Good | Good |
| **Long execution** | Good | Good | Best optimized |
| **Memory efficiency** | Excellent (compact bytecode) | Good | Uses more memory (multi-tier JIT) |
| **WebAssembly** | Excellent (fast Liftoff) | Excellent (Ion optimizations) | Good |

**V8's strengths:**
- Workloads with frequent startups: Node.js, Chrome extensions, etc.
- Memory savings from compact bytecode
- TurboFan's powerful optimization (Speculative Optimization)

**SpiderMonkey's strengths:**
- asm.js and WebAssembly optimization (Firefox game execution, etc.)
- Flexible IC optimization via CacheIR
- Responsiveness via Incremental GC

**JavaScriptCore's strengths:**
- Long-running execution on Safari, etc. (advanced optimization via FTL)
- Battery efficiency (mobile devices)
- Incremental optimization via 4-tier JIT

**5. Developer tooling differences**

**V8:**
- `node --trace-opt`: trace optimizations
- `node --trace-deopt`: trace deoptimizations
- Turbolizer: TurboFan IR visualization tool
- `--allow-natives-syntax`: expose internal API

**SpiderMonkey:**
- `--ion-eager`: apply Ion optimization immediately
- `--baseline-eager`: apply Baseline JIT immediately
- Firefox DevTools: detailed profiler

**JavaScriptCore:**
- `--useConcurrentJIT=false`: disable concurrent JIT
- Safari Web Inspector: timeline profiler
- `--dumpDisassembly`: disassemble JIT code

**6. Guidance on which to choose**

**Choose V8 when:**
- Node.js, Deno, Electron and other server/desktop apps
- CLI tools where startup speed matters
- Chrome extensions

**Choose SpiderMonkey when:**
- Firefox extensions (required)
- WebAssembly-heavy applications
- asm.js compatible code

**Choose JavaScriptCore when:**
- Web apps that must support Safari
- iOS/macOS native apps (required)
- Bun (new JavaScript runtime)

**Conclusion:**
- **V8**: Excellent balance of startup speed and memory efficiency. Standard for the Node.js ecosystem
- **SpiderMonkey**: Strong WebAssembly optimization. Required for Firefox-specific features
- **JavaScriptCore**: Excellent optimization for long-running execution. Standard for the Apple ecosystem

In actual development, in a browser environment the engine choice depends on the user, so it is important to write **code that performs well on all engines** (type stability, Hidden Class sharing, etc.).

---

## Summary

A summary of V8 engine internals and optimization mechanisms.

### Correspondence Table of Key Concepts

| Concept | Role | Impact on optimization | Developer control |
|------|------|---------------|-------------|
| **Parser** | Source code → AST conversion | Speed up startup with Lazy Parsing | Use IIFE pattern to induce Eager Parsing |
| **Ignition** | AST → bytecode generation and execution | Collect feedback vector | No direct control (indirect via type stability) |
| **TurboFan** | Bytecode → optimizing compile | Type specialization, inlining, etc. | Support via type stability and monomorphic calls |
| **Hidden Class** | Describe object shape | Speed up property access | Unify init order, avoid delete |
| **Inline Cache** | Optimization per access site | Monomorphic → fastest | Use objects of the same shape |
| **GC** | Automatic memory management | Reduce stop-the-world time | Early reference release, use WeakRef |
| **ElementsKind** | Internal array representation | Speed up with uniform types | Use hole-free, type-uniform arrays |

### Three Key Points of V8 Optimization

**1. Maintain type stability**
```javascript
// Good: types are consistent
function addNumbers(a, b) {
  return (a | 0) + (b | 0);  // Force integer
}

// Bad: types change
function addAny(a, b) {
  return a + b;  // Mix of integers, floats, and strings
}
```

**2. Share Hidden Classes**
```javascript
// Good: all objects have the same shape
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

// Bad: shape differs per object
function createPoint(x, y, hasZ) {
  const p = { x, y };
  if (hasZ) p.z = 0;  // Hidden Class branches
  return p;
}
```

**3. Keep Inline Cache monomorphic**
```javascript
// Good: always process objects with the same Hidden Class
function process(items) {
  for (const item of items) {
    console.log(item.name);  // IC: monomorphic
  }
}
const items = [
  new Item("A"),
  new Item("B"),
  new Item("C"),
];

// Bad: mixed Hidden Classes
const mixed = [
  { name: "A" },
  { name: "B", value: 1 },
  { value: 2, name: "C" },  // Different order
];
process(mixed);  // IC: megamorphic
```

### Performance Diagnosis Checklist

- [ ] Confirmed optimization status with `node --trace-opt`
- [ ] Identified causes of deoptimization with `node --trace-deopt`
- [ ] Identified hot spots with the Chrome DevTools Performance tab
- [ ] Confirmed Hidden Class branching with Memory Snapshot
- [ ] Confirmed IC state (monomorphic/polymorphic/megamorphic) with `--trace-ic`
- [ ] Confirmed that array ElementsKind is as intended (SMI/Double/Object transitions)
- [ ] Confirmed that `delete` operator is not being used
- [ ] Confirmed that `arguments` object is not leaking

### V8's Evolution Direction

V8 continues to evolve, with improvements being made in the following directions.

- **Improved startup speed** — Better Lazy Parsing, bytecode caching
- **Memory efficiency** — Pointer Compression (using 32-bit pointers in a 64-bit environment)
- **Lower GC latency** — Concurrent Marking, Incremental Compaction
- **WebAssembly integration** — Liftoff (fast baseline compiler), TurboFan optimization
- **Optimization of modern JS features** — async/await, Optional Chaining, Nullish Coalescing
- **Security hardening** — Spectre/Meltdown countermeasures, Sandbox hardening

By understanding V8's internals, you can logically explain "why this code is fast" and "why it is slow," enabling evidence-based performance improvements.

---

## Next Guides to Read

After deepening your understanding of the V8 engine, the next step is to learn the event-driven model in the execution environment.

### Recommended Learning Path

1. **[Event Loop (Browser)](./01-event-loop-browser.md)** [Next step]
   - Integration of V8 task execution with asynchronous processing
   - Timing of macro tasks, micro tasks, and rendering
   - Execution order of requestAnimationFrame, setTimeout, and Promise

2. **Event Loop (Node.js)**
   - Node.js-specific event loop via libuv integration
   - Processing per phase (timers, I/O callbacks, poll, etc.)
   - process.nextTick vs setImmediate

3. **Web Workers**
   - Running a V8 instance on a separate thread
   - Communication with the main thread (postMessage)
   - Shared memory via SharedArrayBuffer

4. **Memory Management and Performance**
   - Detailed V8 GC and tuning
   - Detecting and fixing memory leaks
   - Practical profiling with Chrome DevTools

### Related Guides

- **[Chrome Browser Architecture](../00-browser-engine/00-browser-architecture.md)** — How V8 cooperates with the rendering engine
- **JavaScript Core Spec** — Details of the ECMAScript spec implemented by V8
- **TypeScript Type System** — How to statically guarantee type stability

---

## References

### Official Documents and Blogs

1. **V8 Official Blog**
   https://v8.dev/blog
   The latest features, optimization techniques, and performance improvements from the V8 team. Rich in detailed technical articles on Hidden Classes, TurboFan, GC improvements, and more.

2. **V8 Documentation**
   https://v8.dev/docs
   Official V8 documentation. Practical information on build methods, debug flags, and embedding.

3. **Chrome DevTools Documentation**
   https://developer.chrome.com/docs/devtools/
   Official documentation for Chrome DevTools. Usage of the Performance, Memory, and Profiler tabs. Essential for V8 performance analysis.

4. **Node.js Performance Measurement APIs**
   https://nodejs.org/api/perf_hooks.html
   Node.js performance measurement APIs. How to retrieve V8 GC events and timing information.

### Technical Articles and Explanations

5. **"A tour of V8: Full Compiler"** — V8 Blog
   https://v8.dev/blog/full-compiler
   Explanation of V8's early compiler (Full-Codegen). Useful for comparing with the current Ignition.

6. **"Ignition and TurboFan: V8's new interpreter and optimizing compiler"**
   https://v8.dev/blog/ignition-interpreter
   Background on the introduction of Ignition and its cooperation with TurboFan. The definitive explanation of V8's current pipeline.

7. **"Fast properties in V8"** — V8 Blog
   https://v8.dev/blog/fast-properties
   Detailed explanation of Hidden Classes (Maps), In-Object Properties, and Backing Store. A must-read article for property access optimization.

8. **"V8 Garbage Collection"** — V8 Blog
   https://v8.dev/blog/trash-talk
   Explanation of the Orinoco GC project. Mechanisms behind Scavenge, Mark-Sweep-Compact, and Concurrent Marking.

### Books

9. **"JavaScript: The Definitive Guide, 7th Edition"** — David Flanagan
   Comprehensive JavaScript reference. Ideal as prerequisite knowledge for understanding how V8 works.

10. **"High Performance Browser Networking"** — Ilya Grigorik
    Explains the cooperation between browser networking, rendering, and JavaScript engines. Useful for understanding V8 in a browser environment.

### Tools and Visualization

11. **Turbolizer**
    https://v8.github.io/tools/turbolizer/
    A tool for visualizing TurboFan's optimization graph. Load the JSON files generated by `node --trace-turbo` to visually trace the IR (intermediate representation) transformation process.

12. **V8 Heap Snapshot Visualizer**
    Built into Chrome DevTools. Take a Heap Snapshot to analyze object reference relationships, Hidden Classes, and memory leaks.

### Community and Discussion

13. **V8 GitHub Repository**
    https://github.com/v8/v8
    V8 source code. Track the latest discussions via Issues, Pull Requests, and Discussions.

14. **Chromium Blog**
    https://blog.chromium.org/
    Blog for the entire Chromium project. Also helps you understand the interaction with the rendering engine (Blink) beyond V8.

Use these resources to deepen your understanding of the V8 engine and acquire practical performance optimization skills.
