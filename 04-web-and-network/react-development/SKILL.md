# React Development — Complete Guide

> A comprehensive guide to building modern React applications with TypeScript. Covers fundamentals through advanced patterns, Hooks mastery, TypeScript integration, performance optimization, and algorithm internals.

## Target Audience

- Developers new to React who want a solid foundation
- Intermediate React developers looking to deepen their understanding of Hooks and TypeScript patterns
- Engineers who want to understand React's internal algorithms (Virtual DOM, Fiber)

## Prerequisites

- HTML/CSS basics
- JavaScript fundamentals (variables, functions, arrays, objects)
- Basic TypeScript knowledge is helpful but not required for the basics section

## Guide Index

### 01-basics (React Fundamentals)

| File | Topic | Overview |
|------|-------|----------|
| [01-what-is-react.md](docs/01-basics/01-what-is-react.md) | What is React | Core concepts: components, Virtual DOM, declarative UI |
| [02-setup-environment.md](docs/01-basics/02-setup-environment.md) | Setup Environment | Node.js, Vite, project creation and structure |
| [03-jsx-fundamentals.md](docs/01-basics/03-jsx-fundamentals.md) | JSX Fundamentals | JSX syntax, JavaScript embedding, conditionals, lists |
| [04-components-intro.md](docs/01-basics/04-components-intro.md) | Components Intro | Function components, splitting, imports/exports |
| [05-props-basics.md](docs/01-basics/05-props-basics.md) | Props Basics | Passing data, TypeScript types, default values, children |
| [06-state-basics.md](docs/01-basics/06-state-basics.md) | State Basics | useState, state updates, arrays and objects |
| [07-events-lists.md](docs/01-basics/07-events-lists.md) | Events and Lists | Event handling, forms, list rendering, keys |

### 02-hooks (Hooks Mastery)

| File | Topic | Overview |
|------|-------|----------|
| [hooks-mastery.md](docs/02-hooks/hooks-mastery.md) | Hooks Complete Guide | useState, useEffect, useRef, custom hooks, useContext + useReducer, performance data |

### 03-typescript (TypeScript Patterns)

| File | Topic | Overview |
|------|-------|----------|
| [typescript-patterns.md](docs/03-typescript/typescript-patterns.md) | TypeScript Patterns | Component types, advanced Props patterns, generics, Context, forms |

### 04-optimization (Performance Optimization)

| File | Topic | Overview |
|------|-------|----------|
| [optimization-complete.md](docs/04-optimization/optimization-complete.md) | Optimization Complete Guide | React.memo, useMemo, useCallback, code splitting, virtualization |

### 05-algorithms (Algorithm Internals)

| File | Topic | Overview |
|------|-------|----------|
| [fiber-reconciliation-proof.md](docs/05-algorithms/fiber-reconciliation-proof.md) | Fiber Reconciliation | Mathematical proof of O(n) reconciliation algorithm |
| [virtual-dom-diffing-proof.md](docs/05-algorithms/virtual-dom-diffing-proof.md) | Virtual DOM Diffing | Proof of heuristic diffing vs optimal tree edit distance |

## Learning Path

```
Beginners:    01-basics (01 → 07, in order)
Intermediate: 02-hooks → 03-typescript
Advanced:     04-optimization → 05-algorithms
```

## FAQ

### Q1: Should I learn class components?
No. As of 2024, function components with Hooks are the standard. Class components are only relevant for maintaining legacy code. All guides here use function components exclusively.

### Q2: When should I use useCallback and useMemo?
Not by default. Memoization adds overhead and complexity. Apply it only when you have measured a real performance problem — typically when passing callbacks to memoized child components (`React.memo`) or when performing expensive calculations that run on every render.

### Q3: TypeScript or JavaScript?
TypeScript is strongly recommended for any project beyond a quick prototype. It catches prop type errors at compile time, provides IDE autocompletion, and makes refactoring safer. All code examples in this guide use TypeScript.

## Summary

This guide covers:

- React fundamentals: components, JSX, props, state, events, and list rendering
- Hooks mastery: useState patterns, useEffect with cleanup, useRef, and custom hooks
- TypeScript integration: type-safe props, discriminated unions, generics, and HTML attribute inheritance
- Performance optimization: memoization strategies backed by measured data
- Algorithm internals: mathematical proofs of React's O(n) diffing and Fiber reconciliation

## References

1. React. "React Documentation." react.dev, 2024.
2. TypeScript. "TypeScript Handbook." typescriptlang.org, 2024.
3. Vite. "Vite Documentation." vitejs.dev, 2024.
4. Lin, A. "React Fiber Architecture." github.com/acdlite/react-fiber-architecture, 2018.
5. Zhang, K., & Shasha, D. "Simple Fast Algorithms for the Editing Distance Between Trees." SIAM Journal on Computing, 1989.

## Related Skills

- [Next.js Development](../nextjs-development/) — Server Components, data fetching, caching
- [Web Application Development](../web-application-development/) — Full-stack architecture, state management, routing
- [Browser and Web Platform](../browser-and-web-platform/) — Browser APIs and web standards
