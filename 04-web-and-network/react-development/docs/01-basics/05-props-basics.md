# Props Basics — A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [What are Props](#what-are-props)
4. [Basic Usage](#basic-usage)
5. [TypeScript Type Definitions](#typescript-type-definitions)
6. [Default Values](#default-values)
7. [The children Prop](#the-children-prop)
8. [Props Immutability](#props-immutability)
9. [Common Mistakes](#common-mistakes)
10. [Exercises](#exercises)
11. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The basic concept and mechanics of Props
- Passing data from parent to child components
- Type-safe Props definitions with TypeScript
- Setting default values
- Using the `children` prop
- The immutability rule for Props

### Why It Matters

**Props** (short for "properties") are the mechanism for passing data between React components. Understanding Props enables you to:
- **Reusable components**: Pass different data to the same component
- **Clear data flow**: One-way data flow from parent to child
- **Type safety**: TypeScript catches mistakes at compile time

### Estimated Learning Time

- Reading this guide: 30–40 minutes
- Full understanding including exercises: 1–2 hours

---

## Prerequisites

### Required Knowledge

1. **Components basics**: Complete [04-components-intro.md](./04-components-intro.md) first
2. **TypeScript basics**: Type annotations (`: string`, `: number`, etc.) and `type`/`interface` definitions
3. **JavaScript ES6**: Objects (`{ key: value }`), destructuring (`const { name } = user`)

---

## What are Props

### Definition

**Props** are **data passed from a parent component to a child component**.

```typescript
// Parent component
function App() {
  return <Greeting name="Alice" />;  // pass the name prop
}

// Child component
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;
}

// Output: Hello, Alice!
```

### Analogy with HTML Attributes

Props are similar to HTML attributes.

```html
<!-- HTML -->
<img src="logo.png" alt="Logo" width="100" />

<!-- React -->
<Avatar imageUrl="logo.png" altText="Logo" size={100} />
```

### One-Way Data Flow

In React, data flows **from parent to child** in one direction.

```
App (parent)
  ↓ name="Alice"
Greeting (child)
```

**Important**: Child components treat received Props as **read-only** (see below).

---

## Basic Usage

### 1. Simple Example

```typescript
// Child component
function Welcome({ name }: { name: string }) {
  return <h1>Welcome, {name}!</h1>;
}

// Parent component
function App() {
  return (
    <div>
      <Welcome name="Alice" />
      <Welcome name="Bob" />
      <Welcome name="Carol" />
    </div>
  );
}

// Output:
// Welcome, Alice!
// Welcome, Bob!
// Welcome, Carol!
```

### 2. Multiple Props

```typescript
type UserCardProps = {
  name: string;
  age: number;
  occupation: string;
};

function UserCard({ name, age, occupation }: UserCardProps) {
  return (
    <div className="user-card">
      <h2>{name}</h2>
      <p>Age: {age}</p>
      <p>Occupation: {occupation}</p>
    </div>
  );
}

// Usage
<UserCard name="Alice Smith" age={28} occupation="Engineer" />
```

### 3. Various Prop Types

```typescript
type ProductProps = {
  name: string;          // string
  price: number;         // number
  inStock: boolean;      // boolean
  tags: string[];        // array
  manufacturer: {        // object
    name: string;
    country: string;
  };
  onBuy: () => void;     // function
};

function Product({
  name,
  price,
  inStock,
  tags,
  manufacturer,
  onBuy
}: ProductProps) {
  return (
    <div className="product">
      <h2>{name}</h2>
      <p>Price: ${price.toLocaleString()}</p>
      <p>{inStock ? 'In stock' : 'Out of stock'}</p>
      <p>Tags: {tags.join(', ')}</p>
      <p>Made by: {manufacturer.name} ({manufacturer.country})</p>
      <button onClick={onBuy} disabled={!inStock}>
        Buy Now
      </button>
    </div>
  );
}

// Usage
<Product
  name="Laptop"
  price={899}
  inStock={true}
  tags={['electronics', 'popular']}
  manufacturer={{ name: 'TechCorp', country: 'USA' }}
  onBuy={() => alert('Purchased!')}
/>
```

---

## TypeScript Type Definitions

### 1. Inline Type Definition (for simple cases)

```typescript
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;
}
```

### 2. type Alias (recommended)

```typescript
type GreetingProps = {
  name: string;
};

function Greeting({ name }: GreetingProps) {
  return <h1>Hello, {name}!</h1>;
}
```

### 3. interface (object-oriented style)

```typescript
interface GreetingProps {
  name: string;
}

function Greeting({ name }: GreetingProps) {
  return <h1>Hello, {name}!</h1>;
}
```

**`type` vs `interface`**:
- `type`: More flexible (union types, intersection types, etc.)
- `interface`: Extendable (`extends`)

For Props, `type` is the general convention.

### 4. Optional Props

```typescript
type UserCardProps = {
  name: string;
  age: number;
  email?: string;   // optional (add ?)
  bio?: string;
};

function UserCard({ name, age, email, bio }: UserCardProps) {
  return (
    <div>
      <h2>{name}</h2>
      <p>Age: {age}</p>
      {email && <p>Email: {email}</p>}
      {bio && <p>About: {bio}</p>}
    </div>
  );
}

// email and bio can be omitted
<UserCard name="Alice" age={25} />
<UserCard name="Bob" age={30} email="bob@example.com" />
```

### 5. Union Types (multiple possible values)

```typescript
type ButtonProps = {
  text: string;
  variant: 'primary' | 'secondary' | 'danger';  // one of these three
};

function Button({ text, variant }: ButtonProps) {
  const className = `btn btn-${variant}`;
  return <button className={className}>{text}</button>;
}

// Usage
<Button text="Submit" variant="primary" />
<Button text="Cancel" variant="secondary" />
<Button text="Delete" variant="danger" />
// <Button text="Save" variant="success" />  // TypeScript error!
```

---

## Default Values

### 1. Destructuring Default Values (recommended)

```typescript
type GreetingProps = {
  name: string;
  greeting?: string;
};

function Greeting({ name, greeting = "Hello" }: GreetingProps) {
  return <h1>{greeting}, {name}!</h1>;
}

// Usage
<Greeting name="Alice" />
// Output: Hello, Alice!

<Greeting name="Bob" greeting="Good morning" />
// Output: Good morning, Bob!
```

### 2. Multiple Default Values

```typescript
type ButtonProps = {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
};

function Button({
  text,
  variant = 'primary',
  disabled = false,
  size = 'medium'
}: ButtonProps) {
  const className = `btn btn-${variant} btn-${size}`;

  return (
    <button className={className} disabled={disabled}>
      {text}
    </button>
  );
}

// Usage
<Button text="Submit" />
// variant="primary", disabled=false, size="medium" applied automatically
```

### 3. Object Default Values

```typescript
type UserCardProps = {
  user?: {
    name: string;
    age: number;
  };
};

function UserCard({
  user = { name: 'Guest', age: 0 }
}: UserCardProps) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.age} years old</p>
    </div>
  );
}

// Usage
<UserCard />
// Output: Guest, 0 years old

<UserCard user={{ name: 'Alice', age: 25 }} />
// Output: Alice, 25 years old
```

---

## The children Prop

### What is children

`children` is a special prop that represents **the content placed between a component's opening and closing tags**.

```typescript
// Component that accepts children
type CardProps = {
  children: React.ReactNode;
};

function Card({ children }: CardProps) {
  return (
    <div className="card">
      {children}
    </div>
  );
}

// Usage
<Card>
  <h2>Title</h2>
  <p>Body text</p>
</Card>
```

### Type of children

```typescript
import { ReactNode } from 'react';

type ContainerProps = {
  children: ReactNode;  // the most flexible type for React content
};

function Container({ children }: ContainerProps) {
  return <div className="container">{children}</div>;
}
```

**ReactNode can be**:
- Strings (`"text"`)
- Numbers (`123`)
- JSX elements (`<div>...</div>`)
- Arrays (`[<p>1</p>, <p>2</p>]`)
- `null` / `undefined`

### Practical Example: Layout Component

```typescript
type PageLayoutProps = {
  children: ReactNode;
};

function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      <header>
        <h1>My App</h1>
      </header>
      <main>{children}</main>
      <footer>© 2024</footer>
    </div>
  );
}

// Usage
<PageLayout>
  <h2>Home Page</h2>
  <p>Welcome!</p>
</PageLayout>

<PageLayout>
  <h2>Profile Page</h2>
  <UserProfile />
</PageLayout>
```

### Multiple Slots

```typescript
type ModalProps = {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

function Modal({ title, children, footer }: ModalProps) {
  return (
    <div className="modal">
      <header>{title}</header>
      <main>{children}</main>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}

// Usage
<Modal
  title={<h2>Confirm</h2>}
  footer={
    <>
      <button>OK</button>
      <button>Cancel</button>
    </>
  }
>
  <p>Are you sure you want to delete?</p>
</Modal>
```

---

## Props Immutability

### Important Rule: Props Are Read-Only

**Never mutate Props directly.** This is a critical rule.

```typescript
type CounterProps = {
  count: number;
};

function Counter({ count }: CounterProps) {
  // Wrong: mutating a prop
  count = count + 1;

  return <div>{count}</div>;
}
```

**Why**:
- **Predictability**: One-way data flow is easy to trace
- **Debuggability**: Easier to find the source of bugs
- **Performance optimization**: React can efficiently determine when to re-render

### The Correct Approach: Use State

Use **State** instead of Props for mutable values.

```typescript
import { useState } from 'react';

function Counter() {
  // Correct: use useState
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>
        +1
      </button>
    </div>
  );
}
```

**State** is covered in the next guide: [06-state-basics.md](./06-state-basics.md).

### Arrays and Objects Are Also Immutable

```typescript
type UserListProps = {
  users: string[];
};

function UserList({ users }: UserListProps) {
  // Wrong: mutating the prop array
  users.push('New User');

  return (
    <ul>
      {users.map(user => <li key={user}>{user}</li>)}
    </ul>
  );
}
```

---

## Common Mistakes

### Mistake 1: No Type Definition for Props

```typescript
// Wrong
function Greeting({ name }) {  // no type
  return <h1>Hello, {name}!</h1>;
}

// Correct
type GreetingProps = {
  name: string;
};

function Greeting({ name }: GreetingProps) {
  return <h1>Hello, {name}!</h1>;
}
```

### Mistake 2: Mutating Props

```typescript
// Wrong
function Counter({ count }: { count: number }) {
  count = count + 1;  // mutating a prop
  return <div>{count}</div>;
}

// Correct
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

### Mistake 3: Wrapping Non-Strings in Quotes

```typescript
<UserCard age="25" />  // Wrong: passes the string "25"

<UserCard age={25} />  // Correct: passes the number 25
```

**Rule**: Strings use quotes; everything else uses `{}`.

### Mistake 4: Omitting Required Props

```typescript
type UserCardProps = {
  name: string;  // required
  age: number;   // required
};

<UserCard name="Alice" />  // Missing age — TypeScript error!

// Fix: provide all required props
<UserCard name="Alice" age={25} />

// Or make it optional
type UserCardProps = {
  name: string;
  age?: number;  // optional
};
```

### Mistake 5: Trying to Use `key` as a Prop

```typescript
// Wrong: key is a reserved internal prop
function Item({ key }: { key: string }) {
  return <li>{key}</li>;
}

// Correct: use a different name
function Item({ id }: { id: string }) {
  return <li>{id}</li>;
}

{items.map(item => (
  <Item key={item.id} id={item.id} />
))}
```

---

## Exercises

### Exercise 1: Product Card

**Difficulty**: Beginner

Create a product card component with these Props:
- `name`: product name (string, required)
- `price`: price (number, required)
- `imageUrl`: image URL (string, optional)
- `onSale`: on sale flag (boolean, optional, default: false)

**Requirements**: Define types with TypeScript; show "On Sale!" when `onSale` is true.

**Sample solution**:
```typescript
type ProductCardProps = {
  name: string;
  price: number;
  imageUrl?: string;
  onSale?: boolean;
};

function ProductCard({
  name,
  price,
  imageUrl = 'https://via.placeholder.com/150',
  onSale = false
}: ProductCardProps) {
  return (
    <div className="product-card">
      <img src={imageUrl} alt={name} />
      <h3>{name}</h3>
      <p className="price">${price.toLocaleString()}</p>
      {onSale && <span className="badge">On Sale!</span>}
    </div>
  );
}

// Usage
<ProductCard name="Laptop" price={899} onSale={true} />
<ProductCard name="Mouse" price={29} />
```

### Exercise 2: Reusable Button

**Difficulty**: Intermediate

Create a button component with:
- `text`: button text (required)
- `variant`: style (`'primary' | 'secondary' | 'danger'`, default: `'primary'`)
- `size`: size (`'small' | 'medium' | 'large'`, default: `'medium'`)
- `disabled`: disabled flag (default: `false`)
- `onClick`: click handler (required)

**Sample solution**:
```typescript
type ButtonProps = {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick: () => void;
};

function Button({
  text,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick
}: ButtonProps) {
  const className = `btn btn-${variant} btn-${size}`;

  return (
    <button
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {text}
    </button>
  );
}

// Usage
function App() {
  return (
    <div>
      <Button
        text="Submit"
        variant="primary"
        onClick={() => alert('Submitted')}
      />
      <Button
        text="Delete"
        variant="danger"
        size="small"
        onClick={() => alert('Deleted')}
      />
    </div>
  );
}
```

---

## Next Steps

### What You Learned in This Guide

- The basic concept and mechanics of Props
- Type-safe Props definitions with TypeScript
- Setting default values
- Using the `children` prop
- The Props immutability rule

### Guides to Study Next

1. **[06-state-basics.md](./06-state-basics.md)** — State management basics, useState hook, dynamic UIs
2. **[07-events-lists.md](./07-events-lists.md)** — Event handling, list rendering, user interactions

### Related Resources

- [React: Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
- [TypeScript: React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

---

**Next guide**: [06-state-basics.md](./06-state-basics.md)

**Previous guide**: [04-components-intro.md](./04-components-intro.md)

**Parent guide**: [React Development - SKILL.md](../../SKILL.md)
