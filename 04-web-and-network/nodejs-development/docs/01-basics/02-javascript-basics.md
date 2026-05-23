# JavaScript Basics - Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Variables and Constants](#variables-and-constants)
3. [Data Types](#data-types)
4. [Functions](#functions)
5. [Arrays and Objects](#arrays-and-objects)
6. [ES6+ Features](#es6-features)
7. [Exercises](#exercises)
8. [Next Steps](#next-steps)

---

## Overview

### What You'll Learn

- Basic JavaScript syntax
- Variables, functions, arrays, objects
- Modern ES6+ features
- Key concepts used in Node.js

### Estimated Time: 1–1.5 hours

---

## Variables and Constants

### let (variable)

```javascript
let count = 0
count = 10  // reassignment allowed

let message = 'Hello'
message = 'Hi'  // OK
```

### const (constant)

```javascript
const PI = 3.14159
// PI = 3.14  // Error: cannot reassign

const user = { name: 'Alice' }
user.name = 'Bob'  // OK: the object's contents can be changed
// user = {}  // Error: cannot reassign the variable itself
```

### var (not recommended)

```javascript
// Don't use var (scoping issues)
// Use let / const instead
```

---

## Data Types

### Primitive Types

```javascript
// Number
const age = 25
const price = 1980.5

// String
const name = 'Alice'
const message = "Hello"

// Boolean
const isActive = true
const hasPermission = false

// null / undefined
const empty = null
const notDefined = undefined
```

### Type Conversion

```javascript
// String → Number
const str = '42'
const num = Number(str)  // 42
const num2 = parseInt(str)  // 42
const num3 = parseFloat('3.14')  // 3.14

// Number → String
const n = 123
const s = String(n)  // '123'
const s2 = n.toString()  // '123'

// Boolean conversion
Boolean(1)  // true
Boolean(0)  // false
Boolean('')  // false
Boolean('text')  // true
```

---

## Functions

### Traditional Function Declaration

```javascript
function greet(name) {
  return `Hello, ${name}!`
}

console.log(greet('Alice'))  // Hello, Alice!
```

### Arrow Functions (recommended)

```javascript
// Basic form
const add = (a, b) => {
  return a + b
}

// Shorthand (implicit return)
const add2 = (a, b) => a + b

// Single parameter
const double = x => x * 2

// No parameters
const getTime = () => new Date()
```

### Default Parameters

```javascript
const greet = (name = 'Guest') => {
  return `Hello, ${name}!`
}

console.log(greet())        // Hello, Guest!
console.log(greet('Alice')) // Hello, Alice!
```

---

## Arrays and Objects

### Arrays

```javascript
const fruits = ['apple', 'banana', 'grape']

// Access
console.log(fruits[0])  // apple

// Length
console.log(fruits.length)  // 3

// Add
fruits.push('strawberry')

// Remove
fruits.pop()  // removes the last element

// map (transform)
const numbers = [1, 2, 3]
const doubled = numbers.map(n => n * 2)  // [2, 4, 6]

// filter (narrow down)
const ages = [15, 25, 35]
const adults = ages.filter(age => age >= 18)  // [25, 35]

// find (search)
const users = ['Alice', 'Bob', 'Charlie']
const user = users.find(u => u === 'Bob')  // Bob
```

### Objects

```javascript
const user = {
  name: 'Alice',
  age: 25,
  email: 'alice@example.com'
}

// Access
console.log(user.name)    // Alice
console.log(user['age'])  // 25

// Add / modify
user.city = 'New York'
user.age = 26

// Methods
const calculator = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b
}

console.log(calculator.add(10, 5))  // 15
```

---

## ES6+ Features

### Template Literals

```javascript
const name = 'Alice'
const age = 25

// Old way
const message1 = 'Hello, ' + name + '! You are ' + age + ' years old.'

// Template literals (recommended)
const message2 = `Hello, ${name}! You are ${age} years old.`

// Multi-line
const html = `
  <div>
    <h1>${name}</h1>
    <p>Age: ${age}</p>
  </div>
`
```

### Destructuring Assignment

```javascript
// Array
const [a, b, c] = [1, 2, 3]
console.log(a)  // 1

// Object
const user = { name: 'Alice', age: 25 }
const { name, age } = user
console.log(name)  // Alice

// Function parameters
const greet = ({ name, age }) => {
  return `${name} (${age} years old)`
}

greet({ name: 'Alice', age: 25 })
```

### Spread Syntax

```javascript
// Merge arrays
const arr1 = [1, 2, 3]
const arr2 = [4, 5, 6]
const combined = [...arr1, ...arr2]  // [1, 2, 3, 4, 5, 6]

// Merge objects
const user = { name: 'Alice', age: 25 }
const updated = { ...user, age: 26 }  // { name: 'Alice', age: 26 }

// Spread as function arguments
const numbers = [1, 2, 3]
console.log(Math.max(...numbers))  // 3
```

### Modules

```javascript
// math.js (export)
export const add = (a, b) => a + b
export const subtract = (a, b) => a - b

// Default export
export default class Calculator {}

// main.js (import)
import { add, subtract } from './math.js'
import Calculator from './math.js'

console.log(add(10, 5))  // 15
```

---

## Node.js-Specific Concepts

### CommonJS Modules

```javascript
// math.js (export)
const add = (a, b) => a + b
const subtract = (a, b) => a - b

module.exports = { add, subtract }

// main.js (import)
const { add, subtract } = require('./math')

console.log(add(10, 5))  // 15
```

### The process Object

```javascript
// Environment variables
console.log(process.env.NODE_ENV)

// Command-line arguments
console.log(process.argv)
// node app.js arg1 arg2
// ['node', '/path/to/app.js', 'arg1', 'arg2']

// Current directory
console.log(process.cwd())

// Exit the process
process.exit(0)
```

---

## Exercises

### Exercise 1: FizzBuzz

```javascript
// For numbers 1 to 100:
// Multiples of 3: Fizz
// Multiples of 5: Buzz
// Multiples of both: FizzBuzz

for (let i = 1; i <= 100; i++) {
  if (i % 15 === 0) {
    console.log('FizzBuzz')
  } else if (i % 3 === 0) {
    console.log('Fizz')
  } else if (i % 5 === 0) {
    console.log('Buzz')
  } else {
    console.log(i)
  }
}
```

### Exercise 2: Array Operations

```javascript
// Extract names of users who are 18 or older

const users = [
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 17 },
  { name: 'Charlie', age: 30 }
]

const adults = users
  .filter(user => user.age >= 18)
  .map(user => user.name)

console.log(adults)  // ['Alice', 'Charlie']
```

---

## Common Mistakes

### ❌ Mistake 1: Using var

```javascript
var x = 10  // not recommended
```

**✅ Correct approach**:

```javascript
const x = 10  // recommended (when not reassigning)
let y = 20    // recommended (when reassigning)
```

### ❌ Mistake 2: Using == instead of ===

```javascript
'5' == 5  // true (type coercion occurs)
```

**✅ Correct approach**:

```javascript
'5' === 5  // false (type is also compared)
```

### ❌ Mistake 3: Misusing this

```javascript
const obj = {
  name: 'Alice',
  greet: function() {
    setTimeout(function() {
      console.log(this.name)  // undefined
    }, 1000)
  }
}
```

**✅ Correct approach**:

```javascript
const obj = {
  name: 'Alice',
  greet: function() {
    setTimeout(() => {
      console.log(this.name)  // Alice
    }, 1000)
  }
}
```

---

## Next Steps

### What You Learned in This Guide

- ✅ Basic JavaScript syntax
- ✅ Variables, functions, arrays, objects
- ✅ Modern ES6+ features
- ✅ Key concepts used in Node.js

### Next Guide to Study

**Next guide**: [03-npm-basics.md](./03-npm-basics.md) - NPM and Package Management

---

**Previous guide**: [01-what-is-nodejs.md](./01-what-is-nodejs.md)

**Parent guide**: [Node.js Development - SKILL.md](../../SKILL.md)
