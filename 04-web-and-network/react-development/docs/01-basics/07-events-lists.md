# Events and Lists — A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Event Handling Basics](#event-handling-basics)
4. [Common Event Types](#common-event-types)
5. [Working with Forms](#working-with-forms)
6. [The Event Object](#the-event-object)
7. [Passing Arguments to Event Handlers](#passing-arguments-to-event-handlers)
8. [Rendering Lists in Depth](#rendering-lists-in-depth)
9. [The Importance of Keys](#the-importance-of-keys)
10. [Common Mistakes](#common-mistakes)
11. [Exercises](#exercises)
12. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- React event handling fundamentals
- Click, input, keyboard, and other event types
- Controlling forms and validation
- Using the event object
- Efficient list rendering
- The importance of the `key` prop

### Why It Matters

**Event handling** and **list rendering** are essential skills for building interactive UIs. Mastering them enables you to:
- **Handle user interactions**: Clicks, input, drag, and more
- **Build dynamic UIs**: Screens that respond to user actions
- **Render efficiently**: Display large amounts of data at high speed

### Estimated Learning Time

- Reading this guide: 40–50 minutes
- Full understanding including exercises: 2–3 hours

---

## Prerequisites

### Required Knowledge

1. **State basics**: Complete [06-state-basics.md](./06-state-basics.md) first
2. **JavaScript basics**: Events (`addEventListener`, `onClick`, etc.), array methods (`map`, `filter`, `find`)

---

## Event Handling Basics

### HTML vs React

#### HTML (traditional approach)

```html
<button onclick="handleClick()">Click</button>

<script>
function handleClick() {
  alert('Clicked!');
}
</script>
```

#### React

```typescript
function Button() {
  const handleClick = () => {
    alert('Clicked!');
  };

  return <button onClick={handleClick}>Click</button>;
}
```

**Differences**:
- React: `onClick` (camelCase) vs HTML: `onclick` (lowercase)
- React: passes a function (`{handleClick}`) vs HTML: passes a string (`"handleClick()"`)

### Basic Event Handler

```typescript
function Button() {
  const handleClick = () => {
    console.log('Button was clicked');
  };

  return (
    <button onClick={handleClick}>
      Click
    </button>
  );
}
```

### Inline Function (for simple cases)

```typescript
function Button() {
  return (
    <button onClick={() => alert('Clicked!')}>
      Click
    </button>
  );
}
```

**Note**: Define a named function for complex logic — inline functions get hard to read.

---

## Common Event Types

### 1. Click Events

```typescript
function ClickExample() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
  };

  const handleDoubleClick = () => {
    setCount(0);
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleClick}>
        Click
      </button>
      <button onDoubleClick={handleDoubleClick}>
        Double-click to reset
      </button>
    </div>
  );
}
```

### 2. Input Events

```typescript
function InputExample() {
  const [text, setText] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  return (
    <div>
      <input
        type="text"
        value={text}
        onChange={handleChange}
        placeholder="Type something"
      />
      <p>Input: {text}</p>
      <p>Length: {text.length}</p>
    </div>
  );
}
```

### 3. Keyboard Events

```typescript
function KeyboardExample() {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setMessage(`Message sent: ${text}`);
      setText('');
    } else if (e.key === 'Escape') {
      setText('');
    }
  };

  return (
    <div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter to send, Escape to clear"
      />
      {message && <p>{message}</p>}
    </div>
  );
}
```

### 4. Mouse Events

```typescript
function MouseExample() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div>
      <div
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          width: '300px',
          height: '300px',
          border: '2px solid black',
          backgroundColor: isHovering ? 'lightblue' : 'white'
        }}
      >
        Move the mouse here
      </div>
      <p>Position: X: {position.x}, Y: {position.y}</p>
    </div>
  );
}
```

### 5. Focus Events

```typescript
function FocusExample() {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div>
      <input
        type="text"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Click to focus"
        style={{
          borderColor: isFocused ? 'blue' : 'gray',
          borderWidth: '2px'
        }}
      />
      <p>{isFocused ? 'Focused' : 'Not focused'}</p>
    </div>
  );
}
```

---

## Working with Forms

### Controlled Components

In React, form values are managed in **State**.

```typescript
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();  // prevent default form submission
    console.log('Email:', email);
    console.log('Password:', password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">Email:</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password">Password:</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button type="submit">Log In</button>
    </form>
  );
}
```

### Handling Multiple Inputs

```typescript
type FormData = {
  username: string;
  email: string;
  age: number;
  bio: string;
};

function RegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    age: 0,
    bio: ''
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form data:', formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="username"
        value={formData.username}
        onChange={handleChange}
        placeholder="Username"
      />
      <input
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="Email"
      />
      <input
        name="age"
        type="number"
        value={formData.age}
        onChange={handleChange}
        placeholder="Age"
      />
      <textarea
        name="bio"
        value={formData.bio}
        onChange={handleChange}
        placeholder="About you"
      />
      <button type="submit">Register</button>
    </form>
  );
}
```

### Validation

```typescript
function ValidatedForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      return 'Please enter an email address.';
    }
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address.';
    }
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setError(validateEmail(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    console.log('Submitted:', email);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={handleChange}
        placeholder="Email"
        style={{ borderColor: error ? 'red' : 'gray' }}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={!!error}>
        Submit
      </button>
    </form>
  );
}
```

---

## The Event Object

### Synthetic Events

React provides **Synthetic Events** that wrap native browser events.

```typescript
function EventExample() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Event type:', e.type);           // "click"
    console.log('Target element:', e.currentTarget); // <button>
    console.log('Click position:', e.clientX, e.clientY);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('Key pressed:', e.key);
    console.log('Shift key:', e.shiftKey);
    console.log('Ctrl key:', e.ctrlKey);
  };

  return (
    <div>
      <button onClick={handleClick}>Click</button>
      <input onKeyDown={handleKeyDown} placeholder="Press a key" />
    </div>
  );
}
```

### Preventing Default Behavior

```typescript
function PreventDefaultExample() {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();  // prevent navigation
    console.log('Link clicked but not navigated');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();  // prevent form submission
    console.log('Form submitted but page not reloaded');
  };

  return (
    <div>
      <a href="https://example.com" onClick={handleLinkClick}>
        Click (no navigation)
      </a>

      <form onSubmit={handleSubmit}>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
```

### Event Propagation (Bubbling)

```typescript
function BubblingExample() {
  const handleParentClick = () => {
    console.log('Parent clicked');
  };

  const handleChildClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();  // stop the event from bubbling to the parent
    console.log('Child clicked');
  };

  return (
    <div onClick={handleParentClick} style={{ padding: '20px', border: '1px solid black' }}>
      Parent
      <button onClick={handleChildClick}>
        Child (click does not bubble to parent)
      </button>
    </div>
  );
}
```

---

## Passing Arguments to Event Handlers

### Method 1: Arrow Function (most common)

```typescript
function ButtonList() {
  const handleClick = (id: number) => {
    console.log(`Button ${id} clicked`);
  };

  return (
    <div>
      <button onClick={() => handleClick(1)}>Button 1</button>
      <button onClick={() => handleClick(2)}>Button 2</button>
      <button onClick={() => handleClick(3)}>Button 3</button>
    </div>
  );
}
```

### Method 2: bind (older approach)

```typescript
function ButtonList() {
  const handleClick = (id: number) => {
    console.log(`Button ${id} clicked`);
  };

  return (
    <div>
      <button onClick={handleClick.bind(null, 1)}>Button 1</button>
      <button onClick={handleClick.bind(null, 2)}>Button 2</button>
    </div>
  );
}
```

### Method 3: Currying (advanced)

```typescript
function ButtonList() {
  const handleClick = (id: number) => () => {
    console.log(`Button ${id} clicked`);
  };

  return (
    <div>
      <button onClick={handleClick(1)}>Button 1</button>
      <button onClick={handleClick(2)}>Button 2</button>
    </div>
  );
}
```

---

## Rendering Lists in Depth

### Basic List

```typescript
function FruitList() {
  const fruits = ['Apple', 'Banana', 'Orange'];

  return (
    <ul>
      {fruits.map((fruit, index) => (
        <li key={index}>{fruit}</li>
      ))}
    </ul>
  );
}
```

### Array of Objects

```typescript
type Product = {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
};

function ProductList() {
  const products: Product[] = [
    { id: 1, name: 'Laptop', price: 899, inStock: true },
    { id: 2, name: 'Mouse', price: 29, inStock: true },
    { id: 3, name: 'Keyboard', price: 59, inStock: false }
  ];

  return (
    <div>
      {products.map(product => (
        <div key={product.id} className="product-card">
          <h3>{product.name}</h3>
          <p>${product.price.toLocaleString()}</p>
          <p>{product.inStock ? 'In stock' : 'Out of stock'}</p>
          <button disabled={!product.inStock}>
            Buy Now
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Filtering and Sorting

```typescript
type Task = {
  id: number;
  text: string;
  completed: boolean;
  priority: number;
};

function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: 'Shopping', completed: false, priority: 2 },
    { id: 2, text: 'Cleaning', completed: true, priority: 1 },
    { id: 3, text: 'Cooking', completed: false, priority: 3 }
  ]);

  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredTasks = tasks
    .filter(task => {
      if (filter === 'active') return !task.completed;
      if (filter === 'completed') return task.completed;
      return true;
    })
    .sort((a, b) => a.priority - b.priority);

  return (
    <div>
      <div>
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('active')}>Active</button>
        <button onClick={() => setFilter('completed')}>Completed</button>
      </div>

      <ul>
        {filteredTasks.map(task => (
          <li key={task.id}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => {
                setTasks(tasks.map(t =>
                  t.id === task.id ? { ...t, completed: !t.completed } : t
                ));
              }}
            />
            <span style={{
              textDecoration: task.completed ? 'line-through' : 'none'
            }}>
              {task.text} (Priority: {task.priority})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## The Importance of Keys

### Why Keys are Necessary

**Keys** are required for React to identify each element in a list. Without them, React cannot update the list efficiently.

```typescript
// Wrong: no keys (produces a warning)
<ul>
  {items.map(item => <li>{item}</li>)}
</ul>
// Warning: Each child in a list should have a unique "key" prop.

// Correct: keys provided
<ul>
  {items.map((item, index) => (
    <li key={index}>{item}</li>
  ))}
</ul>
```

### How to Choose a Key

#### 1. Unique ID (preferred)

```typescript
type User = {
  id: string;
  name: string;
};

const users: User[] = [
  { id: 'u1', name: 'Alice' },
  { id: 'u2', name: 'Bob' }
];

<ul>
  {users.map(user => (
    <li key={user.id}>{user.name}</li>
  ))}
</ul>
```

#### 2. Index (only for static lists with no reordering or deletion)

```typescript
const fruits = ['Apple', 'Banana', 'Orange'];

<ul>
  {fruits.map((fruit, index) => (
    <li key={index}>{fruit}</li>
  ))}
</ul>
```

#### 3. The Problem with Index Keys

```typescript
function TodoList() {
  const [todos, setTodos] = useState(['Shopping', 'Cleaning', 'Cooking']);

  const deleteTodo = (index: number) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <ul>
      {todos.map((todo, index) => (
        // Wrong: using index as key causes problems on deletion
        <li key={index}>
          {todo}
          <button onClick={() => deleteTodo(index)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

**Problem**: When "Cleaning" is deleted, indices are reassigned. React cannot correctly determine which element was removed, leading to unexpected behavior.

**Solution**: Use unique IDs.

```typescript
type Todo = {
  id: string;
  text: string;
};

function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: '1', text: 'Shopping' },
    { id: '2', text: 'Cleaning' },
    { id: '3', text: 'Cooking' }
  ]);

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <ul>
      {todos.map(todo => (
        // Correct: using ID as key
        <li key={todo.id}>
          {todo.text}
          <button onClick={() => deleteTodo(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## Common Mistakes

### Mistake 1: Calling the Handler Instead of Passing It

```typescript
// Wrong: called immediately
<button onClick={handleClick()}>Click</button>

// Correct: pass the function reference
<button onClick={handleClick}>Click</button>

// Or wrap in an arrow function
<button onClick={() => handleClick()}>Click</button>
```

### Mistake 2: Forgetting e.preventDefault

```typescript
// Wrong: form submission reloads the page
const handleSubmit = () => {
  console.log('Submitted');
};

<form onSubmit={handleSubmit}>...</form>

// Correct
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  console.log('Submitted');
};
```

### Mistake 3: Using an Object as a Key

```typescript
// Wrong: a new object is created every render
{items.map(item => (
  <div key={{ id: item.id }}>
    {item.name}
  </div>
))}

// Correct: use a primitive value
{items.map(item => (
  <div key={item.id}>
    {item.name}
  </div>
))}
```

---

## Exercises

### Exercise 1: Searchable List

**Difficulty**: Intermediate

Create a user list with:
- Display a list of users
- A search box to filter by name
- Real-time search results

**Sample solution**:
```typescript
import { useState } from 'react';

type User = {
  id: number;
  name: string;
  email: string;
};

function UserList() {
  const [users] = useState<User[]>([
    { id: 1, name: 'Alice Smith', email: 'alice@example.com' },
    { id: 2, name: 'Bob Jones', email: 'bob@example.com' },
    { id: 3, name: 'Carol Davis', email: 'carol@example.com' }
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search users..."
      />

      <p>Results: {filteredUsers.length}</p>

      <ul>
        {filteredUsers.map(user => (
          <li key={user.id}>
            <strong>{user.name}</strong> — {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Exercise 2: Full-Featured TODO List with Form

**Difficulty**: Advanced

Create a complete TODO list with:
- Add a TODO (with a form)
- Delete a TODO
- Toggle complete/incomplete
- Priority selection
- Filter (all / active / completed)
- Sort by priority

**Sample solution**:
```typescript
import { useState } from 'react';

type Todo = {
  id: number;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
};

function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setTodos([
        ...todos,
        { id: Date.now(), text: input, completed: false, priority }
      ]);
      setInput('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const priorityOrder = { high: 1, medium: 2, low: 3 };

  const filteredTodos = todos
    .filter(todo => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return (
    <div>
      <h1>TODO List</h1>

      <form onSubmit={addTodo}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="New TODO"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button type="submit">Add</button>
      </form>

      <div>
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('active')}>Active</button>
        <button onClick={() => setFilter('completed')}>Completed</button>
      </div>

      <ul>
        {filteredTodos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span style={{
              textDecoration: todo.completed ? 'line-through' : 'none'
            }}>
              {todo.text}
            </span>
            <span className={`priority-${todo.priority}`}>
              [{todo.priority}]
            </span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Next Steps

### What You Learned in This Guide

- React event handling fundamentals
- Various event types (click, input, keyboard, etc.)
- Controlled forms and validation
- Using the event object
- Efficient list rendering
- The importance of `key` and choosing the right key

**Congratulations!** You have completed the React Basics series.

### What to Study Next

1. **[Hooks Mastery Guide](../02-hooks/hooks-mastery.md)** — useEffect, useContext, custom hooks, and more
2. **[TypeScript Patterns Guide](../03-typescript/typescript-patterns.md)** — Type-safe React development
3. **[Performance Optimization Guide](../04-optimization/optimization-complete.md)** — React.memo, useMemo, useCallback

### Related Resources

- [React: Responding to Events](https://react.dev/learn/responding-to-events)
- [React: Rendering Lists](https://react.dev/learn/rendering-lists)
- [React Tutorial: Tic-Tac-Toe](https://react.dev/learn/tutorial-tic-tac-toe)

---

**Previous guide**: [06-state-basics.md](./06-state-basics.md)

**Parent guide**: [React Development - SKILL.md](../../SKILL.md)
