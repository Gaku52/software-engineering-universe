# Components Introduction — A Complete Beginner's Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [What is a Component](#what-is-a-component)
4. [Writing Function Components](#writing-function-components)
5. [Splitting Components](#splitting-components)
6. [Imports and Exports](#imports-and-exports)
7. [Component Design Principles](#component-design-principles)
8. [Composing Components](#composing-components)
9. [Common Mistakes](#common-mistakes)
10. [Exercises](#exercises)
11. [Next Steps](#next-steps)

---

## Overview

### What You Will Learn

- The basic concept of React components
- How to write function components
- Splitting and reusing components
- File structure and imports/exports
- Basic principles of component design

### Why It Matters

**Components** are the building blocks of a React application. Understanding components allows you to:
- **Reuse**: Build a component once and use it anywhere
- **Maintain**: Small, focused pieces are easy to change
- **Test**: Individual components can be tested in isolation
- **Collaborate**: Responsibilities can be divided among team members

### Estimated Learning Time

- Reading this guide: 30–40 minutes
- Full understanding including exercises: 1–2 hours

---

## Prerequisites

### Required Knowledge

1. **JSX basics**: Complete [03-jsx-fundamentals.md](./03-jsx-fundamentals.md) first
2. **JavaScript ES6**: Arrow functions, import/export, destructuring
3. **TypeScript basics**: Type annotations (`: string`, `: number`, etc.) and interfaces

---

## What is a Component

### Definition

A **component** is a **reusable building block** that represents a piece of UI.

```typescript
// The simplest component
function Welcome() {
  return <h1>Hello!</h1>;
}
```

### The Lego Block Analogy

Components are like **Lego blocks**:
- Combine small pieces (components) to build something larger
- Use the same piece in multiple places
- Swap pieces out to create different structures

```typescript
// A small piece
function Button() {
  return <button>Click</button>;
}

// Combine pieces
function App() {
  return (
    <div>
      <Button />
      <Button />
      <Button />
    </div>
  );
}
```

### Types of Components

Since React 16.8, **function components** are the recommended approach.

```typescript
// Recommended: function component (standard as of 2024)
function Greeting() {
  return <h1>Hello</h1>;
}

// Deprecated: class component (old style)
class Greeting extends React.Component {
  render() {
    return <h1>Hello</h1>;
  }
}
```

**This guide uses function components exclusively.**

---

## Writing Function Components

### Basic Form

```typescript
function ComponentName() {
  return (
    <div>
      {/* Write JSX here */}
    </div>
  );
}
```

### Important Rules

#### 1. Name Must Start with an Uppercase Letter

```typescript
// Correct: starts with uppercase
function MyComponent() {
  return <div>Content</div>;
}

// Wrong: starts with lowercase
function myComponent() {
  return <div>Content</div>;
}
// React treats <myComponent /> as an HTML tag
```

#### 2. Must Always Return Something

```typescript
// Correct: returns JSX
function ValidComponent() {
  return <div>Content</div>;
}

// Wrong: missing return
function InvalidComponent() {
  <div>Content</div>;  // no return statement
}
```

#### 3. Return a Single Root Element

```typescript
// Wrong: multiple root elements
function InvalidComponent() {
  return (
    <h1>Title</h1>
    <p>Body</p>
  );
}

// Correct: wrap in a Fragment
function ValidComponent() {
  return (
    <>
      <h1>Title</h1>
      <p>Body</p>
    </>
  );
}
```

### Example: Simple Component

```typescript
// User card component
function UserCard() {
  return (
    <div className="card">
      <img src="avatar.jpg" alt="User" />
      <h2>Alice Smith</h2>
      <p>Web Developer</p>
    </div>
  );
}

// Usage
function App() {
  return (
    <div>
      <UserCard />
      <UserCard />
      <UserCard />
    </div>
  );
}
```

---

## Splitting Components

### Why Split

Large components have these problems:
- **Hard to understand**: The code is too long
- **Not reusable**: Tied to a specific place in the app
- **Hard to test**: Too complex to test effectively

### Splitting Example

#### Before: One Large Component

```typescript
function BlogPost() {
  return (
    <article>
      <header>
        <h1>Getting Started with React</h1>
        <div>
          <img src="author.jpg" alt="Author" />
          <span>Alice Smith</span>
          <time>January 28, 2024</time>
        </div>
      </header>

      <div>
        <p>React is a wonderful library...</p>
        <p>It is component-based...</p>
      </div>

      <footer>
        <button>Like</button>
        <button>Share</button>
        <button>Comment</button>
      </footer>
    </article>
  );
}
```

#### After: Multiple Small Components

```typescript
// Header component
function PostHeader() {
  return (
    <header>
      <h1>Getting Started with React</h1>
      <AuthorInfo />
    </header>
  );
}

// Author info component
function AuthorInfo() {
  return (
    <div className="author">
      <img src="author.jpg" alt="Author" />
      <span>Alice Smith</span>
      <time>January 28, 2024</time>
    </div>
  );
}

// Content component
function PostContent() {
  return (
    <div className="content">
      <p>React is a wonderful library...</p>
      <p>It is component-based...</p>
    </div>
  );
}

// Footer component
function PostFooter() {
  return (
    <footer>
      <button>Like</button>
      <button>Share</button>
      <button>Comment</button>
    </footer>
  );
}

// Main component (assembled from pieces)
function BlogPost() {
  return (
    <article>
      <PostHeader />
      <PostContent />
      <PostFooter />
    </article>
  );
}
```

**Benefits**:
- Each component is short and easy to understand
- `AuthorInfo` and `PostFooter` can be reused elsewhere
- Each piece can be tested individually

---

## Imports and Exports

### Why Split Files

Writing all components in one file creates a massive, unmanageable file. **Split into separate files**.

### Directory Structure

```
src/
├── App.tsx
├── components/
│   ├── Button.tsx
│   ├── UserCard.tsx
│   └── Header.tsx
└── main.tsx
```

### Types of Exports

#### 1. Default Export (one component per file)

```typescript
// components/Button.tsx
function Button() {
  return <button>Click</button>;
}

export default Button;  // default export
```

```typescript
// App.tsx
import Button from './components/Button';  // can import with any name

function App() {
  return <Button />;
}
```

#### 2. Named Export (multiple components per file)

```typescript
// components/Buttons.tsx
export function PrimaryButton() {
  return <button className="primary">Primary</button>;
}

export function SecondaryButton() {
  return <button className="secondary">Secondary</button>;
}
```

```typescript
// App.tsx
import { PrimaryButton, SecondaryButton } from './components/Buttons';

function App() {
  return (
    <div>
      <PrimaryButton />
      <SecondaryButton />
    </div>
  );
}
```

### Best Practice

```typescript
// Recommended: one file, one component, default export
// components/UserCard.tsx
function UserCard() {
  return <div className="user-card">...</div>;
}

export default UserCard;
```

This way the file name matches the component name, and imports can use any alias.

---

## Component Design Principles

### 1. Single Responsibility Principle (SRP)

Each component should do **one thing only**.

```typescript
// Bad: multiple responsibilities
function UserDashboard() {
  return (
    <div>
      {/* User profile */}
      <div>...</div>
      {/* Post list */}
      <div>...</div>
      {/* Friends list */}
      <div>...</div>
      {/* Notifications */}
      <div>...</div>
    </div>
  );
}

// Good: responsibilities separated
function UserDashboard() {
  return (
    <div>
      <UserProfile />
      <PostList />
      <FriendList />
      <NotificationList />
    </div>
  );
}
```

### 2. DRY Principle (Don't Repeat Yourself)

Do not duplicate code.

```typescript
// Bad: repeated code
function Buttons() {
  return (
    <div>
      <button className="btn btn-primary">Save</button>
      <button className="btn btn-primary">Submit</button>
      <button className="btn btn-primary">Delete</button>
    </div>
  );
}

// Good: reusable component
type ButtonProps = {
  label: string;
};

function PrimaryButton({ label }: ButtonProps) {
  return <button className="btn btn-primary">{label}</button>;
}

function Buttons() {
  return (
    <div>
      <PrimaryButton label="Save" />
      <PrimaryButton label="Submit" />
      <PrimaryButton label="Delete" />
    </div>
  );
}
```

### 3. Appropriate Size

Keep components at an **appropriate size**.

**Rule of thumb**:
- 1 component: 50–100 lines or fewer
- 1 file: 200 lines or fewer
- If it grows beyond that, split it

### 4. Naming Conventions

Give components descriptive names.

```typescript
// Bad names
function A() { }
function Thing() { }
function DoStuff() { }

// Good names
function UserProfile() { }        // user profile
function LoginButton() { }        // login button
function ProductCard() { }        // product card
function NavigationMenu() { }     // navigation menu
```

**Common patterns**:
- `UserCard`, `ProductCard`: `...Card` (card layout)
- `LoginButton`, `SubmitButton`: `...Button` (button)
- `UserList`, `ProductList`: `...List` (list)
- `UserForm`, `LoginForm`: `...Form` (form)

---

## Composing Components

### Nesting Components

Components can contain other components.

```typescript
function Avatar() {
  return <img src="avatar.jpg" alt="User" />;
}

function UserName() {
  return <h2>Alice Smith</h2>;
}

function UserCard() {
  return (
    <div className="card">
      <Avatar />
      <UserName />
      <p>Web Developer</p>
    </div>
  );
}

function App() {
  return (
    <div>
      <UserCard />
    </div>
  );
}
```

### The Component Tree

An application can be represented as a **component tree**.

```
App
├── Header
│   ├── Logo
│   └── Navigation
│       ├── NavItem
│       ├── NavItem
│       └── NavItem
├── Main
│   ├── Sidebar
│   │   └── Widget
│   └── Content
│       ├── Article
│       └── Article
└── Footer
    ├── Copyright
    └── SocialLinks
```

---

## Common Mistakes

### Mistake 1: Lowercase Component Name

```typescript
// Wrong
function button() {
  return <button>Click</button>;
}

<button />  // treated as an HTML <button> tag

// Correct
function Button() {
  return <button>Click</button>;
}

<Button />  // treated as a React component
```

### Mistake 2: Defining Components Inside Components

```typescript
// Wrong: defines a new component inside another
function ParentComponent() {
  function ChildComponent() {
    return <div>Child</div>;
  }

  return <ChildComponent />;
}
```

**Problems**: A new component is created on every render, causing performance issues and state resets.

```typescript
// Correct: define components at the module level
function ChildComponent() {
  return <div>Child</div>;
}

function ParentComponent() {
  return <ChildComponent />;
}
```

### Mistake 3: Forgetting the `return`

```typescript
// Wrong
function MyComponent() {
  <div>Content</div>;  // no return statement
}

// Correct
function MyComponent() {
  return <div>Content</div>;
}
```

### Mistake 4: File Name and Component Name Do Not Match

```typescript
// File: UserProfile.tsx
function Profile() {  // name does not match
  return <div>...</div>;
}

// Correct
// File: UserProfile.tsx
function UserProfile() {  // matches the file name
  return <div>...</div>;
}

export default UserProfile;
```

---

## Exercises

### Exercise 1: Business Card Component

**Difficulty**: Beginner

Create a business card component that displays:
- Name
- Job title
- Company name
- Email address

**Sample solution**:
```typescript
function BusinessCard() {
  return (
    <div className="business-card">
      <h2>Alice Smith</h2>
      <p className="title">Senior Engineer</p>
      <p className="company">Tech Solutions Inc.</p>
      <a href="mailto:alice@example.com">alice@example.com</a>
    </div>
  );
}

export default BusinessCard;
```

### Exercise 2: Split a Blog Article

**Difficulty**: Intermediate

Split the following large component into four smaller ones:
- `ArticleHeader`: title and author info
- `ArticleContent`: body text
- `ArticleTags`: tag list
- `BlogArticle`: the whole article assembled

**Starting code**:
```typescript
function BlogArticle() {
  return (
    <article>
      <header>
        <h1>React Fundamentals</h1>
        <div>
          <span>Author: Alice Smith</span>
          <time>January 28, 2024</time>
        </div>
      </header>

      <div>
        <p>React is a component-based library.</p>
        <p>You can create reusable building blocks.</p>
      </div>

      <footer>
        <span className="tag">React</span>
        <span className="tag">JavaScript</span>
        <span className="tag">Web Development</span>
      </footer>
    </article>
  );
}
```

**Sample solution**:
```typescript
function ArticleHeader() {
  return (
    <header>
      <h1>React Fundamentals</h1>
      <div className="meta">
        <span>Author: Alice Smith</span>
        <time>January 28, 2024</time>
      </div>
    </header>
  );
}

function ArticleContent() {
  return (
    <div className="content">
      <p>React is a component-based library.</p>
      <p>You can create reusable building blocks.</p>
    </div>
  );
}

function ArticleTags() {
  const tags = ['React', 'JavaScript', 'Web Development'];
  return (
    <footer>
      {tags.map(tag => (
        <span key={tag} className="tag">{tag}</span>
      ))}
    </footer>
  );
}

function BlogArticle() {
  return (
    <article>
      <ArticleHeader />
      <ArticleContent />
      <ArticleTags />
    </article>
  );
}

export default BlogArticle;
```

---

## Next Steps

### What You Learned in This Guide

- The basic concept of components
- How to write function components
- How to split components
- Imports and exports
- Component design principles

### Guides to Study Next

1. **[05-props-basics.md](./05-props-basics.md)** — Props in depth, passing data, TypeScript type definitions
2. **[06-state-basics.md](./06-state-basics.md)** — State management basics, useState hook, dynamic UIs

### Related Resources

- [React: Your First Component](https://react.dev/learn/your-first-component)
- [React: Importing and Exporting Components](https://react.dev/learn/importing-and-exporting-components)
- [Atomic Design](https://bradfrost.com/blog/post/atomic-web-design/)
- [Component Design Patterns in React](https://www.patterns.dev/)

---

**Next guide**: [05-props-basics.md](./05-props-basics.md)

**Previous guide**: [03-jsx-fundamentals.md](./03-jsx-fundamentals.md)

**Parent guide**: [React Development - SKILL.md](../../SKILL.md)
