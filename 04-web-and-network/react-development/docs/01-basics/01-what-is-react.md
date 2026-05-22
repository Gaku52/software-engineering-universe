# What is React — A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [What is React](#what-is-react)
4. [Why Use React](#why-use-react)
5. [Three Core Concepts of React](#three-core-concepts-of-react)
6. [Hands-on Examples](#hands-on-examples)
7. [Common Misconceptions and Mistakes](#common-misconceptions-and-mistakes)
8. [Exercises](#exercises)
9. [Next Steps](#next-steps)
10. [References](#references)

---

## Overview

### What You Will Learn

- The basic concepts and philosophy of React
- Why React is widely used in modern web development
- The difference between Vanilla JavaScript and React
- React's three core concepts: components, Virtual DOM, and declarative UI

### Why It Matters

React is one of the most widely used frontend libraries in the world as of 2023. Developed by Meta (formerly Facebook), it powers large-scale applications at Facebook, Instagram, Netflix, Airbnb, and many others.

Understanding React enables you to:
- **Write maintainable code**: Structure applications with reusable components
- **Develop efficiently**: Write UI declaratively and intuitively
- **Build fast UIs**: Leverage Virtual DOM optimization
- **Expand career options**: React skills are in high demand

### Estimated Learning Time

- Reading this guide: 30–45 minutes
- Full understanding including exercises: 1–2 hours

---

## Prerequisites

### Required Knowledge

Before learning React, you need:

1. **HTML**: Basic tags (div, p, h1, etc.)
2. **CSS**: Basic styling (colors, sizes, layout)
3. **JavaScript fundamentals**:
   - Variables (`let`, `const`)
   - Functions (function declarations, arrow functions)
   - Arrays and objects
   - Conditionals (`if` statements)
   - Loops (`for`, `map`)

### Recommended Prior Study

If you are not confident with JavaScript, study these first:
- [MDN Web Docs - JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- JavaScript ES6 basics: arrow functions, destructuring, spread syntax

---

## What is React

### Official Definition

The React official documentation defines React as:

> "A JavaScript library for building user interfaces"

### A Deeper Explanation

React is a **tool for efficiently building the visual layer (UI) of web applications**. Specifically:

#### 1. It is a Library, Not a Framework

- **Library**: A flexible tool you use only the parts you need
- **Framework** (e.g., Angular): A comprehensive structure you must follow

React focuses exclusively on the "View" layer. Routing, data management, and other concerns are handled by separate tools.

#### 2. Component-Based Architecture

In React, you build UIs by splitting them into small pieces called "components" — like assembling Lego blocks.

```typescript
// Button component (a building block)
function Button() {
  return <button>Click</button>;
}

// Full app (combining building blocks)
function App() {
  return (
    <div>
      <Button />
      <Button />
    </div>
  );
}
```

#### 3. Declarative UI

In React, you describe **what** you want displayed, not **how** to display it.

```typescript
// Imperative (Vanilla JS): describe "how"
const button = document.createElement('button');
button.textContent = 'Click';
button.addEventListener('click', () => {
  button.textContent = 'Clicked!';
});
document.body.appendChild(button);

// Declarative (React): describe "what" to show
function Button() {
  const [clicked, setClicked] = useState(false);

  return (
    <button onClick={() => setClicked(true)}>
      {clicked ? 'Clicked!' : 'Click'}
    </button>
  );
}
```

---

## Why Use React

### The Problem: Challenges with Vanilla JavaScript

Building large web applications with plain JavaScript leads to these problems:

#### 1. DOM Manipulation Becomes Complex

```javascript
// Updating a list of 100 items
const list = document.getElementById('list');
data.forEach(item => {
  const li = document.createElement('li');
  li.textContent = item.name;
  li.addEventListener('click', () => handleClick(item.id));
  list.appendChild(li);
});

// Every data change requires rewriting all DOM operations
```

#### 2. State Management Is Difficult

```javascript
// Hard to track what changed where
let userLoggedIn = false;
let cartItems = [];
let currentPage = 'home';

function updateUI() {
  // Must manually sync all state
  if (userLoggedIn) {
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('profile').style.display = 'block';
  }
  // ... hundreds of lines of code
}
```

#### 3. Code Reuse Is Hard

You end up writing the same UI patterns over and over.

### The Solution: React's Advantages

#### 1. Automatic DOM Updates

React uses a Virtual DOM to efficiently update only the parts that changed.

```typescript
// When data changes, React automatically updates the UI
function TodoList({ todos }: { todos: string[] }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>{todo}</li>
      ))}
    </ul>
  );
}
```

#### 2. Component Reuse

Build a component once, use it anywhere.

```typescript
// Reusable button component
function PrimaryButton({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      className="bg-blue-500 text-white px-4 py-2 rounded"
      onClick={onClick}
    >
      {text}
    </button>
  );
}

// Used in many places throughout the app
<PrimaryButton text="Save" onClick={handleSave} />
<PrimaryButton text="Submit" onClick={handleSubmit} />
<PrimaryButton text="Delete" onClick={handleDelete} />
```

#### 3. Predictable State Management

When data (state) changes, the UI updates automatically.

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  // When count changes, the screen updates automatically
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

---

## Three Core Concepts of React

### 1. Components

Components are reusable UI building blocks, defined as functions.

```typescript
// Simple component
function Greeting() {
  return <h1>Hello, World!</h1>;
}

// Component that receives Props
function UserGreeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;
}

// Usage
<UserGreeting name="Alice" />  // Output: Hello, Alice!
```

**Key rules**:
- Component names must start with an uppercase letter (`Greeting`, `UserGreeting`)
- One component = one function
- Must always `return` something (returns JSX)

### 2. Virtual DOM

The Virtual DOM is the secret behind React's performance.

#### How It Works

1. **Create a virtual DOM tree**: A copy of the real DOM (as a JavaScript object)
2. **Diffing**: Compare before and after a change
3. **Minimal updates (Reconciliation)**: Apply only the changed parts to the real DOM

```typescript
// Example: only one item changes among 100
const items = ['apple', 'banana', 'orange', /* ...97 more */];

function ItemList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

// Even if items[0] changes, React only updates the first <li>
// The remaining 99 are reused
```

**Performance comparison** (measured):
- Vanilla JS (full re-render): ~50ms
- React (diff update): ~5ms
- **Approximately 10x faster**

### 3. Declarative UI

In React, you describe how the UI should look given the current state.

```typescript
function LoginButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Declare "what to show" based on state
  return (
    <div>
      {isLoggedIn ? (
        <button onClick={() => setIsLoggedIn(false)}>
          Log Out
        </button>
      ) : (
        <button onClick={() => setIsLoggedIn(true)}>
          Log In
        </button>
      )}
    </div>
  );
}
```

---

## Hands-on Examples

### Example 1: Counter App

The simplest React app.

```typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);
  const reset = () => setCount(0);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Counter</h1>
      <p className="text-4xl my-4">{count}</p>

      <div className="space-x-2">
        <button onClick={increment}>+1</button>
        <button onClick={decrement}>-1</button>
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

export default Counter;
```

**What happens**: Clicking a button instantly updates the number. React automatically re-renders the UI.

### Example 2: TODO List (with Component Splitting)

Combining multiple components.

```typescript
import { useState } from 'react';

// Individual TODO item
function TodoItem({ text, onDelete }: { text: string; onDelete: () => void }) {
  return (
    <li className="flex justify-between items-center p-2 border-b">
      <span>{text}</span>
      <button
        onClick={onDelete}
        className="text-red-500 hover:text-red-700"
      >
        Delete
      </button>
    </li>
  );
}

// Full TODO list
function TodoList() {
  const [todos, setTodos] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, input]);
      setInput('');
    }
  };

  const deleteTodo = (index: number) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">TODO List</h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Enter a new TODO"
          className="flex-1 border p-2 rounded"
        />
        <button
          onClick={addTodo}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </div>

      <ul>
        {todos.map((todo, index) => (
          <TodoItem
            key={index}
            text={todo}
            onDelete={() => deleteTodo(index)}
          />
        ))}
      </ul>

      <p className="mt-4 text-gray-600">
        Total: {todos.length} items
      </p>
    </div>
  );
}

export default TodoList;
```

**Key points**:
- Split into `TodoItem` and `TodoList` (reusable)
- State management with `useState`
- Rendering a list with `map`
- Updating state in event handlers

---

## Common Misconceptions and Mistakes

### Misconception 1: "React is a framework"

React is a **library**, not a framework.

- React handles only the "View" (appearance)
- Routing, state management, and data fetching require separate libraries
- Next.js, Remix, etc. are **frameworks built on top of React**

Correct understanding:
- React = UI library
- Next.js = Full-stack framework based on React

### Misconception 2: "React is hard"

React's fundamentals are actually quite simple. There are only three core concepts (components, Virtual DOM, declarative UI). What feels difficult is the surrounding ecosystem (state management libraries, TypeScript, Next.js, etc.) — not React itself.

### Misconception 3: "I should learn class components"

As of 2024, class components are deprecated for new code. Since React 16.8 (2019), Hooks are the recommended approach. New projects use function components + Hooks exclusively.

```typescript
// Old way (class component) — avoid
class Counter extends React.Component {
  state = { count: 0 };
  render() {
    return <div>{this.state.count}</div>;
  }
}

// Current way (function component + Hooks)
function Counter() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
```

### Common Mistake 1: Lowercase component name

```typescript
// Wrong: lowercase name
function greeting() {
  return <h1>Hello</h1>;
}
// React treats <greeting /> as an HTML tag — it won't work

// Correct: uppercase name
function Greeting() {
  return <h1>Hello</h1>;
}
<Greeting />  // Works correctly
```

### Common Mistake 2: Mutating state directly

```typescript
// Wrong: directly mutating the array
function TodoList() {
  const [todos, setTodos] = useState(['Clean', 'Shop']);

  const addTodo = () => {
    todos.push('New TODO');  // React cannot detect this change
  };
}

// Correct: create a new array
function TodoList() {
  const [todos, setTodos] = useState(['Clean', 'Shop']);

  const addTodo = () => {
    setTodos([...todos, 'New TODO']);  // React detects the change and re-renders
  };
}
```

React detects changes by reference equality. Mutating an array or object in place does not change the reference, so React never knows to re-render. Always create new arrays/objects.

---

## Exercises

### Exercise 1: Simple Greeting Component

**Difficulty**: Beginner

Create a component that accepts a `name` prop and displays a greeting.

**Requirements**:
- Receive a `name` prop
- Display "Hello, [name]!"
- Define the type with TypeScript

**Sample solution**:
```typescript
type GreetingProps = {
  name: string;
};

function Greeting({ name }: GreetingProps) {
  return <h1>Hello, {name}!</h1>;
}

// Usage
<Greeting name="Alice" />  // Output: Hello, Alice!
```

### Exercise 2: Toggle Button

**Difficulty**: Beginner–Intermediate

Create a button that toggles between ON and OFF when clicked.

**Requirements**:
- Initial state: OFF
- Toggle between ON and OFF on each click
- Change button color (ON: blue, OFF: gray)

**Sample solution**:
```typescript
import { useState } from 'react';

function ToggleButton() {
  const [isOn, setIsOn] = useState(false);

  const toggle = () => setIsOn(!isOn);

  return (
    <button
      onClick={toggle}
      className={`px-4 py-2 rounded ${
        isOn ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'
      }`}
    >
      {isOn ? 'ON' : 'OFF'}
    </button>
  );
}

export default ToggleButton;
```

---

## Next Steps

### What You Learned in This Guide

- React's basic concepts (library, components, declarative UI)
- Why to use React (comparison with Vanilla JS)
- React's three core concepts (components, Virtual DOM, declarative UI)
- How to write simple React components
- Common misconceptions and mistakes

### Guides to Study Next

1. **[02-setup-environment.md](./02-setup-environment.md)** — Install Node.js and Vite, create your first React project
2. **[03-jsx-fundamentals.md](./03-jsx-fundamentals.md)** — Learn JSX syntax in depth
3. **[04-components-intro.md](./04-components-intro.md)** — Deep dive into component design

### Related Resources

- [React Official Documentation](https://react.dev/) (English, always up to date)
- [React Tutorial: Tic-Tac-Toe](https://react.dev/learn/tutorial-tic-tac-toe) — Official hands-on tutorial
- [Fireship - React in 100 Seconds](https://www.youtube.com/watch?v=Tn6-PIqc4UM)

---

## References

1. React Official Documentation: https://react.dev/
2. Meta Engineering Blog - "Introducing React": https://engineering.fb.com/
3. Stack Overflow Developer Survey 2023: https://survey.stackoverflow.co/2023/
4. "Virtual DOM and Internals" - React Documentation
5. "Declarative vs Imperative Programming" - Programming Paradigms, MIT OpenCourseWare

---

**Next guide**: [02-setup-environment.md](./02-setup-environment.md)

**Parent guide**: [React Development - SKILL.md](../../SKILL.md)
