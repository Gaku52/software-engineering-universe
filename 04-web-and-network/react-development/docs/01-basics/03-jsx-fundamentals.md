# JSX Fundamentals — A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [What is JSX](#what-is-jsx)
4. [JSX Basic Syntax](#jsx-basic-syntax)
5. [Embedding JavaScript](#embedding-javascript)
6. [Attributes](#attributes)
7. [Conditional Rendering](#conditional-rendering)
8. [Rendering Lists](#rendering-lists)
9. [Fragments](#fragments)
10. [Common Mistakes](#common-mistakes)
11. [Exercises](#exercises)
12. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The basic concepts and mechanics of JSX
- How to describe UI with HTML-like syntax
- How to embed JavaScript expressions in JSX
- Implementing conditionals and loops
- JSX constraints and rules

### Why It Matters

**JSX (JavaScript XML)** is React's most distinctive syntax. Using JSX lets you:
- **Describe UI intuitively**: Write components that look like HTML
- **Achieve type safety**: Write safe code combined with TypeScript
- **Express powerfully**: Leverage the full JavaScript language in UI descriptions

### Estimated Learning Time

- Reading this guide: 30–40 minutes
- Full understanding including exercises: 1–2 hours

---

## Prerequisites

### Required Knowledge

1. **HTML basics**: Tag structure (`<div>`, `<p>`, `<button>`, etc.) and attributes (`class`, `id`, `href`, etc.)
2. **JavaScript basics**: Variables (`const`, `let`), functions (arrow functions), array methods (`map`, `filter`), template literals
3. **React environment setup**: Complete [02-setup-environment.md](./02-setup-environment.md) first

---

## What is JSX

### Official Definition

> JSX is a syntax extension for JavaScript that lets you write HTML-like markup inside a JavaScript file.

### A Deeper Explanation

JSX is a **JavaScript syntax extension** with these characteristics:

#### 1. It Looks Like HTML, But It Is JavaScript

```typescript
// This is JSX
const element = <h1>Hello, World!</h1>;

// Browsers cannot understand it directly, so Babel transforms it to:
const element = React.createElement('h1', null, 'Hello, World!');
```

#### 2. JSX Produces Objects

JSX ultimately becomes **React elements** (JavaScript objects).

```typescript
// JSX
<div className="container">Hello</div>

// Internal representation after transformation
{
  type: 'div',
  props: {
    className: 'container',
    children: 'Hello'
  }
}
```

#### 3. JSX Can Be Used Anywhere

JSX is an expression, so you can assign it to variables, pass it as arguments, or return it from functions.

```typescript
// Assign to a variable
const greeting = <h1>Hello</h1>;

// Pass as an argument
const element = renderElement(<p>Text</p>);

// Return from a function
function Component() {
  return <div>Content</div>;
}
```

---

## JSX Basic Syntax

### 1. A Single Root Element

JSX must be wrapped in **exactly one root element**.

```typescript
// Wrong: multiple root elements
function Component() {
  return (
    <h1>Title</h1>
    <p>Body</p>
  );
}

// Correct: wrapped in a single div
function Component() {
  return (
    <div>
      <h1>Title</h1>
      <p>Body</p>
    </div>
  );
}

// Better: use a Fragment (explained later)
function Component() {
  return (
    <>
      <h1>Title</h1>
      <p>Body</p>
    </>
  );
}
```

### 2. All Tags Must Be Closed

In JSX, every tag must be closed — even those that do not require a closing tag in HTML.

```typescript
// Wrong: not closed (valid HTML, but not valid JSX)
<img src="image.jpg">
<input type="text">
<br>

// Correct: self-closing
<img src="image.jpg" />
<input type="text" />
<br />
```

### 3. Use camelCase

HTML attributes are written in camelCase in JSX.

```typescript
// HTML
<div class="container" onclick="handleClick()">

// JSX
<div className="container" onClick={handleClick}>
```

**Common conversions**:

| HTML | JSX |
|------|-----|
| `class` | `className` |
| `for` | `htmlFor` |
| `onclick` | `onClick` |
| `onchange` | `onChange` |
| `tabindex` | `tabIndex` |

`class` and `for` are reserved words in JavaScript, which is why JSX uses different names.

---

## Embedding JavaScript

### Embed Expressions with `{}`

Use `{}` inside JSX to evaluate a JavaScript expression.

#### 1. Variables

```typescript
function Greeting() {
  const name = "Alice";
  const age = 25;

  return (
    <div>
      <h1>Hello, {name}!</h1>
      <p>You are {age} years old.</p>
    </div>
  );
}
```

#### 2. Expressions

```typescript
function Calculator() {
  const a = 10;
  const b = 20;

  return (
    <div>
      <p>{a} + {b} = {a + b}</p>
      <p>{a} × {b} = {a * b}</p>
    </div>
  );
}
```

#### 3. Function Calls

```typescript
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US');
}

function App() {
  return (
    <div>
      <p>Today is {formatDate(new Date())}</p>
    </div>
  );
}
```

#### 4. Template Literals

```typescript
function UserCard() {
  const firstName = "Alice";
  const lastName = "Smith";

  return (
    <div>
      <h2>{`${lastName}, ${firstName}`}</h2>
      <p>Full name: {`${firstName} ${lastName}`}</p>
    </div>
  );
}
```

### Important Constraint

Inside `{}` you can only write **expressions**, not **statements**.

```typescript
// Wrong: if statement is not an expression
<div>
  {if (isLoggedIn) { "Logged in" }}
</div>

// Correct: use a ternary operator (an expression)
<div>
  {isLoggedIn ? "Logged in" : "Not logged in"}
</div>

// Wrong: for loop is not an expression
<ul>
  {for (let i = 0; i < 5; i++) { <li>{i}</li> }}
</ul>

// Correct: use map (an expression)
<ul>
  {[0, 1, 2, 3, 4].map(i => <li key={i}>{i}</li>)}
</ul>
```

---

## Attributes

### 1. String Literals

```typescript
<img src="logo.png" alt="Logo" />
<a href="https://example.com">Link</a>
```

### 2. JavaScript Expressions

```typescript
function Avatar() {
  const imageUrl = "https://example.com/avatar.jpg";
  const size = 100;
  const userName = "Alice";

  return (
    <img
      src={imageUrl}
      width={size}
      height={size}
      alt={`${userName}'s avatar`}
    />
  );
}
```

### 3. Boolean Attributes

```typescript
<button disabled={true}>Disabled button</button>
<button disabled={false}>Enabled button</button>

// {true} can be omitted
<button disabled>Disabled button</button>

// For {false}, omit the attribute entirely
<button>Enabled button</button>
```

### 4. Style Attribute

Styles are specified as an **object**, with property names in camelCase.

```typescript
function StyledBox() {
  const boxStyle = {
    backgroundColor: 'lightblue',  // background-color → backgroundColor
    fontSize: '20px',               // font-size → fontSize
    padding: '10px',
    borderRadius: '8px'             // border-radius → borderRadius
  };

  return (
    <div style={boxStyle}>
      Styled box
    </div>
  );
}

// Inline (note the double curly braces)
<div style={{ color: 'red', fontSize: '24px' }}>
  Red text
</div>
```

**Why double curly braces `{{ }}`**:
- Outer `{}`: start of a JavaScript expression
- Inner `{}`: object literal

---

## Conditional Rendering

### 1. Ternary Operator (most common)

```typescript
function LoginButton() {
  const isLoggedIn = false;

  return (
    <div>
      {isLoggedIn ? (
        <button>Log Out</button>
      ) : (
        <button>Log In</button>
      )}
    </div>
  );
}
```

### 2. Logical AND Operator (`&&`)

Use when you only want to render something when a condition is **true**.

```typescript
function Notification() {
  const hasNewMessages = true;
  const messageCount = 5;

  return (
    <div>
      <h1>Messages</h1>
      {hasNewMessages && (
        <div className="notification">
          You have {messageCount} new messages
        </div>
      )}
    </div>
  );
}
```

**Important**: `false`, `null`, and `undefined` are not rendered, but **`0` is rendered**.

```typescript
function Counter() {
  const count = 0;

  return (
    <div>
      {/* Wrong: 0 will be displayed */}
      {count && <p>Count: {count}</p>}

      {/* Correct: explicit comparison */}
      {count > 0 && <p>Count: {count}</p>}
    </div>
  );
}
```

### 3. Multiple Conditions (if-else if-else)

```typescript
function UserStatus({ status }: { status: 'online' | 'offline' | 'away' }) {
  return (
    <div>
      {status === 'online' ? (
        <span className="status-online">Online</span>
      ) : status === 'away' ? (
        <span className="status-away">Away</span>
      ) : (
        <span className="status-offline">Offline</span>
      )}
    </div>
  );
}
```

### 4. Assign to a Variable (for complex conditions)

Complex conditional logic is more readable when stored in a variable first.

```typescript
function UserGreeting({ user }: { user: { name: string; isAdmin: boolean } | null }) {
  let content;

  if (!user) {
    content = <p>Guest user</p>;
  } else if (user.isAdmin) {
    content = <p>Admin: {user.name}</p>;
  } else {
    content = <p>User: {user.name}</p>;
  }

  return <div>{content}</div>;
}
```

---

## Rendering Lists

### 1. Using the `map` Function

Use `map()` to render an array.

```typescript
function FruitList() {
  const fruits = ['apple', 'banana', 'orange'];

  return (
    <ul>
      {fruits.map((fruit, index) => (
        <li key={index}>{fruit}</li>
      ))}
    </ul>
  );
}
```

### 2. The `key` Prop (important)

**key** is required for React to identify each element in a list.

```typescript
// Wrong: missing key (produces a warning)
<ul>
  {fruits.map(fruit => <li>{fruit}</li>)}
</ul>
// Warning: Each child in a list should have a unique "key" prop.

// Correct: provide a key
<ul>
  {fruits.map((fruit, index) => (
    <li key={index}>{fruit}</li>
  ))}
</ul>
```

**How to choose a key**:
1. **Unique ID** (preferred): `<li key={item.id}>`
2. **Index** (only for static lists): `<li key={index}>`
3. **Content** (temporary only): `<li key={item.name}>`

```typescript
// Best practice: use an ID as the key
type Todo = {
  id: string;
  text: string;
  completed: boolean;
};

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

### 3. Arrays of Objects

```typescript
type User = {
  id: number;
  name: string;
  email: string;
};

function UserList() {
  const users: User[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Carol', email: 'carol@example.com' }
  ];

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          <strong>{user.name}</strong> — {user.email}
        </li>
      ))}
    </ul>
  );
}
```

### 4. Filtering Combined with Mapping

```typescript
function ActiveTodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos
        .filter(todo => !todo.completed)  // only incomplete items
        .map(todo => (
          <li key={todo.id}>{todo.text}</li>
        ))}
    </ul>
  );
}
```

---

## Fragments

### The Problem: Extra Divs Accumulate

When returning multiple elements, wrapping them in a `<div>` adds an unnecessary node to the DOM.

```typescript
// Wrong: the extra <div> breaks table structure
function Columns() {
  return (
    <div>  {/* this <div> destroys the table layout */}
      <td>Column 1</td>
      <td>Column 2</td>
    </div>
  );
}
```

### Solution: Fragment

**Fragments** let you group multiple elements without adding extra DOM nodes.

```typescript
import { Fragment } from 'react';

// Method 1: use <Fragment>
function Columns() {
  return (
    <Fragment>
      <td>Column 1</td>
      <td>Column 2</td>
    </Fragment>
  );
}

// Method 2: use the shorthand <> (most common)
function Columns() {
  return (
    <>
      <td>Column 1</td>
      <td>Column 2</td>
    </>
  );
}
```

### Fragments with a Key

When using Fragments in a list, you need a key. The shorthand `<>` does not support keys — use `<Fragment>` instead.

```typescript
function DescriptionList({ items }: { items: Array<{ term: string; desc: string }> }) {
  return (
    <dl>
      {items.map(item => (
        <Fragment key={item.term}>
          <dt>{item.term}</dt>
          <dd>{item.desc}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```

---

## Common Mistakes

### Mistake 1: Multiple Root Elements

```typescript
// Wrong
function Component() {
  return (
    <h1>Title</h1>
    <p>Body</p>
  );
}
// Error: Adjacent JSX elements must be wrapped in an enclosing tag.

// Correct
function Component() {
  return (
    <>
      <h1>Title</h1>
      <p>Body</p>
    </>
  );
}
```

### Mistake 2: Using `class` Instead of `className`

```typescript
<div class="container">       // Wrong: class is a reserved word
<div className="container">   // Correct
```

### Mistake 3: Using a String for `style`

```typescript
<div style="color: red; font-size: 20px;">   // Wrong

<div style={{ color: 'red', fontSize: '20px' }}>  // Correct
```

### Mistake 4: Forgetting the Closing Tag

```typescript
<img src="logo.png">     // Wrong
<input type="text">      // Wrong

<img src="logo.png" />   // Correct
<input type="text" />    // Correct
```

### Mistake 5: Missing `key`

```typescript
{items.map(item => <li>{item}</li>)}
// Warning: Each child in a list should have a unique "key" prop.

{items.map((item, index) => <li key={index}>{item}</li>)}  // Correct
```

### Mistake 6: Falsy `0` in Conditional Rendering

```typescript
const count = 0;
return <div>{count && <p>Count: {count}</p>}</div>;
// Output: 0 (the number zero is rendered)

// Correct
return <div>{count > 0 && <p>Count: {count}</p>}</div>;
// Output: (nothing is rendered)
```

---

## Exercises

### Exercise 1: User Profile

**Difficulty**: Beginner

Create a component that displays the following information:
- Name
- Age
- Email address
- Bio (only if present)

**Sample solution**:
```typescript
type User = {
  name: string;
  age: number;
  email: string;
  bio?: string;
};

function UserProfile() {
  const user: User = {
    name: 'Alice Smith',
    age: 28,
    email: 'alice@example.com',
    bio: 'I love web development.'
  };

  return (
    <div className="profile">
      <h1>{user.name}</h1>
      <p>Age: {user.age}</p>
      <p>Email: {user.email}</p>
      {user.bio && (
        <div className="bio">
          <h2>About</h2>
          <p>{user.bio}</p>
        </div>
      )}
    </div>
  );
}
```

### Exercise 2: Shopping List

**Difficulty**: Intermediate

Create a shopping list with:
- Item name and price displayed
- Total price calculated and shown
- Items costing $10 or more displayed in red

**Sample solution**:
```typescript
type Item = {
  id: number;
  name: string;
  price: number;
};

function ShoppingList() {
  const items: Item[] = [
    { id: 1, name: 'Apple', price: 2 },
    { id: 2, name: 'Milk', price: 3 },
    { id: 3, name: 'Laptop', price: 800 },
    { id: 4, name: 'Bread', price: 4 }
  ];

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div>
      <h1>Shopping List</h1>
      <ul>
        {items.map(item => (
          <li
            key={item.id}
            style={{
              color: item.price >= 10 ? 'red' : 'black',
              fontWeight: item.price >= 10 ? 'bold' : 'normal'
            }}
          >
            {item.name}: ${item.price.toLocaleString()}
          </li>
        ))}
      </ul>
      <p className="total">Total: ${total.toLocaleString()}</p>
    </div>
  );
}
```

---

## Next Steps

### What You Learned in This Guide

- Basic concepts and mechanics of JSX
- Embedding JavaScript expressions (`{}`)
- Writing attributes (`className`, `style`, etc.)
- Conditional rendering (ternary operator, `&&`)
- Rendering lists (`map`, `key`)
- Using Fragments

### Guides to Study Next

1. **[04-components-intro.md](./04-components-intro.md)** — Splitting components, passing props, component design basics
2. **[05-props-basics.md](./05-props-basics.md)** — Props in depth, TypeScript type definitions, default values

### Related Resources

- [React: Writing Markup with JSX](https://react.dev/learn/writing-markup-with-jsx)
- [React: JavaScript in JSX with Curly Braces](https://react.dev/learn/javascript-in-jsx-with-curly-braces)
- [Babel REPL](https://babeljs.io/repl) — See how JSX is transformed

---

**Next guide**: [04-components-intro.md](./04-components-intro.md)

**Previous guide**: [02-setup-environment.md](./02-setup-environment.md)

**Parent guide**: [React Development - SKILL.md](../../SKILL.md)
