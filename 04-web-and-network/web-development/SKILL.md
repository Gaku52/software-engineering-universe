---
name: web-development
description: Fundamentals of modern web development. Framework selection (React, Vue, Next.js), project architecture, state management, routing, build tools, and CSS strategy best practices.
---

# Web Development Skill

> Fundamentals of modern web development. Framework selection (React, Vue, Next.js), project architecture, state management, routing, build tools, and CSS strategy best practices.

## Table of Contents

### Fundamentals (this file)
1. [Overview](#overview)
2. [When to Use](#when-to-use)
3. [Framework Selection](#framework-selection)
4. [Project Structure](#project-structure)
5. [Development Environment](#development-environment)
6. [Practical Examples](#practical-examples)
7. [Anti-patterns](#anti-patterns)

### Detailed Guides
1. [Framework Selection — Complete Guide](./docs/01-framework-selection/framework-selection-complete.md)
2. [State Management — Complete Guide](./docs/02-state-management/state-management-complete.md)
3. [Project Architecture — Complete Guide](./docs/03-project-architecture/project-architecture-complete.md)

---

## Overview

This skill covers modern web development fundamentals:

- **Framework selection** — React, Vue, Next.js, Remix, etc.
- **Project architecture** — Directory structure, file naming conventions
- **State management** — Context API, Redux, Zustand, Jotai
- **Routing** — React Router, Next.js App Router
- **Build tools** — Vite, Webpack, Turbopack
- **CSS strategy** — Tailwind CSS, CSS Modules, Styled Components

## Official Documentation

- **[MDN Web Docs](https://developer.mozilla.org/)** — Comprehensive web technology reference
- **[React Documentation](https://react.dev/)** — React library
- **[Next.js Documentation](https://nextjs.org/docs)** — Next.js framework
- **[Vue.js Documentation](https://vuejs.org/guide/)** — Vue.js framework
- **[web.dev](https://web.dev/)** — Google's modern web development guide

---

## When to Use

### Required
- [ ] Starting a new web project (framework selection)
- [ ] Designing project architecture
- [ ] Deciding on a state management strategy
- [ ] Choosing a CSS strategy

### Periodic
- [ ] Updating dependencies
- [ ] Performance optimization
- [ ] Adding major new features

---

## Framework Selection

| Framework | Use Case | Pros | Cons |
|-----------|----------|------|------|
| **Next.js** | Full-stack web apps | SSR/SSG built-in, SEO optimized, App Router | Higher learning curve |
| **React (Vite)** | SPA, admin dashboards | Simple, flexible | SEO requires extra work |
| **Remix** | Full-stack | Nested routing, great UX | Smaller ecosystem |
| **Vue (Nuxt)** | Full-stack | Easier to learn | Smaller ecosystem than React |
| **Astro** | Content sites | Extremely fast, partial hydration | Not suited for complex apps |

### Decision Flowchart

```
Is SEO critical?
├─ Yes → Need server-side rendering
│   ├─ Prefer React → Next.js
│   └─ Prefer Vue  → Nuxt.js
└─ No → SPA is fine
    ├─ Admin panel / internal tool → React + Vite
    └─ Content-focused site → Astro
```

---

## Project Structure

### Next.js App Router (recommended)

```
project/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # /
│   │   └── about/page.tsx    # /about
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   └── page.tsx          # /dashboard
│   ├── api/
│   │   └── users/route.ts    # /api/users
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                   # shadcn/ui etc.
│   └── features/
├── lib/
│   ├── utils.ts
│   ├── api.ts
│   └── db.ts
├── hooks/
├── types/
└── public/
```

### React + Vite (SPA)

```
project/
├── src/
│   ├── pages/
│   ├── components/
│   │   ├── Header.tsx
│   │   └── ui/
│   ├── hooks/
│   ├── lib/
│   ├── store/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
└── public/
```

---

## Development Environment

### Recommended Toolset

```json
{
  "devDependencies": {
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

**.prettierrc**
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

**Git Hooks (Husky)**
```bash
pnpm add -D husky lint-staged
```

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

---

## Practical Examples

### Example 1: Next.js App Router project

```bash
pnpm create next-app@latest my-app --typescript --tailwind --app
cd my-app
pnpm add zustand zod react-hook-form
pnpm dlx shadcn-ui@latest init
```

### Example 2: React + Vite (SPA)

```bash
pnpm create vite@latest my-app --template react-ts
cd my-app
pnpm install
pnpm add react-router-dom zustand
pnpm add -D tailwindcss postcss autoprefixer
```

### Example 3: State management with Zustand

```typescript
// store/userStore.ts
import { create } from 'zustand'

interface UserStore {
  user: User | null
  setUser: (user: User) => void
  logout: () => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}))
```

```tsx
import { useUserStore } from '@/store/userStore'

export function UserProfile() {
  const { user, logout } = useUserStore()
  if (!user) return <div>Not logged in</div>
  return (
    <div>
      <p>{user.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

---

## Anti-patterns

### Over-splitting Components

```tsx
// ❌ Unnecessary micro-components
function UserName({ name }: { name: string }) { return <span>{name}</span> }
function UserEmail({ email }: { email: string }) { return <span>{email}</span> }

// ✅ Keep it simple
function UserProfile({ user }: { user: User }) {
  return <div><span>{user.name}</span><span>{user.email}</span></div>
}
```

### Prop Drilling

```tsx
// ❌ Passing props through many layers
function App() {
  const [user, setUser] = useState<User | null>(null)
  return <Dashboard user={user} setUser={setUser} />
}

// ✅ Use Zustand instead
const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
```

### Misusing useEffect for Data Fetching

```tsx
// ❌ Client-side fetch with useEffect
function UserList() {
  const [users, setUsers] = useState<User[]>([])
  useEffect(() => {
    fetch('/api/users').then(res => res.json()).then(setUsers)
  }, [])
}

// ✅ Server Component (Next.js App Router)
async function UserList() {
  const users = await fetch('/api/users').then(res => res.json())
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}
```

---

## Related Skills

- **nextjs-development** — Next.js deep dive
- **react-development** — React deep dive
- **frontend-performance** — Performance optimization
- **web-accessibility** — Accessibility

---

_Last updated: 2026-05-24_
