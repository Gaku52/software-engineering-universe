# State Basics — A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [What is State](#what-is-state)
4. [The useState Hook](#the-usestate-hook)
5. [Updating State](#updating-state)
6. [Managing Multiple States](#managing-multiple-states)
7. [Object and Array State](#object-and-array-state)
8. [State vs Props](#state-vs-props)
9. [Common Mistakes](#common-mistakes)
10. [Exercises](#exercises)
11. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The basic concept of State and why it is necessary
- How to use the `useState` hook
- How to update state correctly
- Managing multiple states
- State management for objects and arrays
- The difference between State and Props

### Why It Matters

**State** is the mechanism by which React components hold **data that changes dynamically**. Understanding State allows you to:
- **Build interactive UIs**: The screen changes in response to user actions
- **Persist data**: Store and update data inside a component
- **Trigger re-renders**: When state changes, React automatically updates the screen

### Estimated Learning Time

- Reading this guide: 40–50 minutes
- Full understanding including exercises: 2–3 hours

---

## Prerequisites

### Required Knowledge

1. **Props basics**: Complete [05-props-basics.md](./05-props-basics.md) first
2. **JavaScript ES6**: Array destructuring (`const [a, b] = [1, 2]`), spread syntax (`[...array]`, `{...object}`)

---

## What is State

### Definition

**State** is **dynamic data that a component holds internally**.

```typescript
import { useState } from 'react';

function Counter() {
  // count is State
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

### Why State is Necessary

#### Without State: Regular Variables (does not work)

```typescript
function Counter() {
  let count = 0;  // regular variable

  const increment = () => {
    count = count + 1;    // value changes in memory...
    console.log(count);   // shows in the console
  };

  return (
    <div>
      <p>Count: {count}</p>  {/* screen does NOT update! */}
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

**Problem**: The variable's value changes, but **React cannot detect the change**, so the screen never updates.

#### With State: Using useState (correct)

```typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);  // State

  const increment = () => {
    setCount(count + 1);  // update State
    // React detects the change → automatically re-renders
  };

  return (
    <div>
      <p>Count: {count}</p>  {/* screen updates! */}
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

**Solution**: `useState` manages state; `setCount` updates it; React automatically re-renders the screen.

---

## The useState Hook

### Syntax

```typescript
const [state, setState] = useState(initialValue);
```

- `state`: The current state value
- `setState`: The function to update state
- `initialValue`: The initial value

### Basic Examples

```typescript
import { useState } from 'react';

function Example() {
  // Number state
  const [count, setCount] = useState(0);

  // String state
  const [name, setName] = useState('');

  // Boolean state
  const [isVisible, setIsVisible] = useState(true);

  return <div>...</div>;
}
```

### useState Naming Convention

By convention:

```typescript
const [value, setValue] = useState(initialValue);
```

**Examples**:
- `const [count, setCount] = useState(0);`
- `const [name, setName] = useState('');`
- `const [isOpen, setIsOpen] = useState(false);`
- `const [todos, setTodos] = useState([]);`

**Rules**:
- State variable: a noun (`count`, `name`, `isOpen`)
- Updater function: `set` + state variable name (`setCount`, `setName`, `setIsOpen`)

---

## Updating State

### 1. Providing a Value Directly

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(count - 1)}>-1</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

### 2. Using a Functional Update (recommended)

When the new state depends on the current state, pass a **function** for safety.

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{count}</p>
      {/* Pass a function (prevCount is the current value) */}
      <button onClick={() => setCount(prevCount => prevCount + 1)}>
        +1
      </button>
    </div>
  );
}
```

**Why use the functional form?**

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  const handleMultipleClicks = () => {
    // Wrong: calling it 3 times only increments by 1
    setCount(count + 1);  // count = 0 + 1 = 1
    setCount(count + 1);  // count = 0 + 1 = 1
    setCount(count + 1);  // count = 0 + 1 = 1
    // Result: count = 1

    // Correct: calling it 3 times increments by 3
    setCount(prev => prev + 1);  // prev = 0 → 1
    setCount(prev => prev + 1);  // prev = 1 → 2
    setCount(prev => prev + 1);  // prev = 2 → 3
    // Result: count = 3
  };

  return <button onClick={handleMultipleClicks}>+3</button>;
}
```

### 3. State Updates Are Asynchronous

**Important**: `setState` is **asynchronous**.

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
    console.log(count);  // still shows the old value!
  };

  return <button onClick={increment}>+1</button>;
}
```

**Solution**: The updated value is available in the next render. If you need the new value immediately, store it in a variable.

```typescript
const increment = () => {
  const newCount = count + 1;
  setCount(newCount);
  console.log(newCount);  // use the new value
};
```

---

## Managing Multiple States

### Using Multiple useStates

A single component can manage multiple states.

```typescript
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setIsLoading(true);
    setError('');

    if (email === '' || password === '') {
      setError('Please enter both email and password.');
      setIsLoading(false);
      return;
    }

    // API call etc.
    setIsLoading(false);
  };

  return (
    <form>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <p className="error">{error}</p>}
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
```

### Group Related States into an Object

```typescript
type FormState = {
  email: string;
  password: string;
  isLoading: boolean;
  error: string;
};

function LoginForm() {
  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    isLoading: false,
    error: ''
  });

  const handleSubmit = () => {
    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    if (form.email === '' || form.password === '') {
      setForm(prev => ({
        ...prev,
        error: 'Please enter both email and password.',
        isLoading: false
      }));
      return;
    }

    setForm(prev => ({ ...prev, isLoading: false }));
  };

  return (
    <form>
      <input
        type="email"
        value={form.email}
        onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
      />
      <input
        type="password"
        value={form.password}
        onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
      />
      {form.error && <p className="error">{form.error}</p>}
      <button onClick={handleSubmit} disabled={form.isLoading}>
        {form.isLoading ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
```

---

## Object and Array State

### Updating Object State

**Important**: Objects must be updated **immutably**.

```typescript
type User = {
  name: string;
  age: number;
  email: string;
};

function UserProfile() {
  const [user, setUser] = useState<User>({
    name: 'Alice Smith',
    age: 28,
    email: 'alice@example.com'
  });

  // Wrong: direct mutation
  const updateName = (newName: string) => {
    user.name = newName;  // React cannot detect this!
    setUser(user);
  };

  // Correct: create a new object
  const updateName = (newName: string) => {
    setUser({
      ...user,         // copy all existing properties
      name: newName    // override only name
    });
  };

  // Correct (functional form — recommended)
  const updateAge = (newAge: number) => {
    setUser(prev => ({
      ...prev,
      age: newAge
    }));
  };

  return (
    <div>
      <p>Name: {user.name}</p>
      <p>Age: {user.age}</p>
      <p>Email: {user.email}</p>
      <button onClick={() => updateName('Bob Jones')}>
        Change Name
      </button>
      <button onClick={() => updateAge(user.age + 1)}>
        Birthday
      </button>
    </div>
  );
}
```

### Updating Array State

Arrays must also be updated **immutably**.

```typescript
function TodoList() {
  const [todos, setTodos] = useState<string[]>(['Shopping', 'Cleaning']);

  // Wrong: direct mutation
  const addTodoWrong = (newTodo: string) => {
    todos.push(newTodo);  // React cannot detect this!
    setTodos(todos);
  };

  // Correct: create a new array
  const addTodo = (newTodo: string) => {
    setTodos([...todos, newTodo]);
  };

  // Remove
  const removeTodo = (index: number) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  // Update
  const updateTodo = (index: number, newText: string) => {
    setTodos(todos.map((todo, i) =>
      i === index ? newText : todo
    ));
  };

  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>
          {todo}
          <button onClick={() => removeTodo(index)}>Remove</button>
        </li>
      ))}
      <button onClick={() => addTodo('New TODO')}>
        Add
      </button>
    </ul>
  );
}
```

### Array Operation Patterns

```typescript
// Add (to the end)
setTodos([...todos, newTodo]);

// Add (to the beginning)
setTodos([newTodo, ...todos]);

// Remove
setTodos(todos.filter((_, i) => i !== indexToRemove));

// Update
setTodos(todos.map((todo, i) =>
  i === indexToUpdate ? newValue : todo
));

// Sort
setTodos([...todos].sort());

// Clear
setTodos([]);
```

---

## State vs Props

### Comparison Table

| | State | Props |
|---|-------|-------|
| **Definition** | Data managed inside a component | Data passed from a parent component |
| **Mutability** | Mutable (via setState) | Read-only |
| **Managed by** | The component itself | The parent component |
| **Usage** | `useState` hook | Function arguments |
| **Re-render** | Changes trigger re-render | Changes trigger re-render |

### Practical Example

```typescript
// Parent component
function Parent() {
  const [count, setCount] = useState(0);  // State

  return (
    <div>
      <p>Parent count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment in parent</button>
      {/* Pass count as a prop to the child */}
      <Child count={count} />
    </div>
  );
}

// Child component
type ChildProps = {
  count: number;  // Props
};

function Child({ count }: ChildProps) {
  const [localCount, setLocalCount] = useState(0);  // State

  return (
    <div>
      <p>Count from parent: {count}</p>
      <p>Local count: {localCount}</p>
      <button onClick={() => setLocalCount(localCount + 1)}>
        Increment locally
      </button>
    </div>
  );
}
```

---

## Common Mistakes

### Mistake 1: Mutating State Directly

```typescript
// Wrong
const [count, setCount] = useState(0);
count = count + 1;  // direct mutation — React will not re-render

// Correct
setCount(count + 1);  // use setCount
```

### Mistake 2: Mutating Object State Directly

```typescript
// Wrong
const [user, setUser] = useState({ name: 'Alice', age: 25 });
user.age = 26;  // direct mutation
setUser(user);  // React won't detect the change

// Correct
setUser({ ...user, age: 26 });  // new object
```

### Mistake 3: Using push/pop on Array State

```typescript
// Wrong
const [todos, setTodos] = useState(['Shopping']);
todos.push('Cleaning');  // direct mutation
setTodos(todos);

// Correct
setTodos([...todos, 'Cleaning']);  // new array
```

### Mistake 4: Reading State Immediately After Setting It

```typescript
const [count, setCount] = useState(0);
setCount(count + 1);
console.log(count);  // still the old value!

// Correct
const newCount = count + 1;
setCount(newCount);
console.log(newCount);  // the new value
```

### Mistake 5: Calling an Expensive Function as the Initial Value

```typescript
// Wrong: expensiveCalculation() runs on every render
const [value, setValue] = useState(expensiveCalculation());

// Correct: pass a function so it runs only once
const [value, setValue] = useState(() => expensiveCalculation());
```

---

## Exercises

### Exercise 1: Extended Counter

**Difficulty**: Beginner

Create a counter with these features:
- +1 button
- -1 button
- +10 button
- Reset button
- The count cannot go below 0

**Sample solution**:
```typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => setCount(prev => prev + 1);
  const decrement = () => setCount(prev => Math.max(0, prev - 1));
  const incrementBy10 = () => setCount(prev => prev + 10);
  const reset = () => setCount(0);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={increment}>+1</button>
      <button onClick={decrement}>-1</button>
      <button onClick={incrementBy10}>+10</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

### Exercise 2: TODO List

**Difficulty**: Intermediate

Create a TODO list with:
- Add a TODO
- Delete a TODO
- Toggle complete/incomplete
- Show the number of completed items

**Sample solution**:
```typescript
import { useState } from 'react';

type Todo = {
  id: number;
  text: string;
  completed: boolean;
};

function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([
        ...todos,
        { id: Date.now(), text: input, completed: false }
      ]);
      setInput('');
    }
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const completedCount = todos.filter(todo => todo.completed).length;

  return (
    <div>
      <h1>TODO List</h1>
      <div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="New TODO"
        />
        <button onClick={addTodo}>Add</button>
      </div>

      <p>Completed: {completedCount} / {todos.length}</p>

      <ul>
        {todos.map(todo => (
          <li
            key={todo.id}
            style={{
              textDecoration: todo.completed ? 'line-through' : 'none'
            }}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
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

- The basic concept of State and why it is necessary
- The `useState` hook
- Correct state update patterns
- Managing multiple states
- Immutable updates for objects and arrays
- The difference between State and Props

### Guides to Study Next

1. **[07-events-lists.md](./07-events-lists.md)** — Event handling in depth, forms, user interactions
2. **[hooks-mastery.md](../02-hooks/hooks-mastery.md)** — useEffect and other hooks, custom hooks, advanced state management

### Related Resources

- [React: State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
- [React: useState](https://react.dev/reference/react/useState)

---

**Next guide**: [07-events-lists.md](./07-events-lists.md)

**Previous guide**: [05-props-basics.md](./05-props-basics.md)

**Parent guide**: [React Development - SKILL.md](../../SKILL.md)
