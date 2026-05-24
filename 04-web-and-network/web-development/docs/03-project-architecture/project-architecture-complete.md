# Project Architecture — Complete Guide

Scalable directory structures, build tools, CSS strategy, and development environment setup.

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [File Naming Conventions](#file-naming-conventions)
4. [Module Splitting Strategy](#module-splitting-strategy)
5. [Build Tool Comparison](#build-tool-comparison)
6. [CSS Strategy Comparison](#css-strategy-comparison)
7. [Development Environment Setup](#development-environment-setup)
8. [Monorepo Structure](#monorepo-structure)
9. [Performance Data](#performance-data)
10. [Common Mistakes](#common-mistakes)

---

## Overview

### Why Project Architecture Matters

A well-structured project directly impacts long-term development velocity:

- **Scalability**: Structure that holds up with 100+ engineers
- **Maintainability**: Understandable 6 months later
- **Onboarding**: New members productive in a day
- **Build time**: Up to 50% faster builds with proper structure

---

## Directory Structure

### Next.js App Router (Small: 1–3 people)

```
project/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx          # /
│   │   ├── about/page.tsx    # /about
│   │   └── contact/page.tsx  # /contact
│   ├── blog/
│   │   ├── page.tsx          # /blog
│   │   └── [slug]/page.tsx   # /blog/[slug]
│   ├── api/
│   │   └── posts/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── input.tsx
│   └── header.tsx
├── lib/
│   ├── utils.ts
│   └── api.ts
├── public/
├── .env.local
├── next.config.js
├── tailwind.config.ts
└── package.json
```

**Characteristics**: Simple, ~50 files, entire codebase fits in one person's head.

---

### Next.js App Router (Medium: 5–15 people)

```
project/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── about/page.tsx
│   │   └── pricing/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── settings/page.tsx
│   │   └── profile/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── posts/route.ts
│   │   └── users/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── input.tsx
│   ├── marketing/
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   └── pricing-table.tsx
│   ├── dashboard/
│   │   ├── sidebar.tsx
│   │   └── stats-card.tsx
│   └── layout/
│       ├── header.tsx
│       └── footer.tsx
├── lib/
│   ├── api/
│   │   ├── posts.ts
│   │   └── users.ts
│   ├── utils/
│   │   ├── format.ts
│   │   └── date.ts
│   └── db.ts
├── hooks/
│   ├── use-user.ts
│   └── use-posts.ts
├── types/
│   ├── user.ts
│   └── post.ts
├── store/
│   ├── userStore.ts
│   └── uiStore.ts
└── config/
    ├── site.ts
    └── constants.ts
```

**Characteristics**: Feature-grouped directories, 50–200 files, team can own domains.

---

### Next.js App Router (Large: 15+ people, Feature-based)

```
project/
├── app/
│   ├── (marketing)/
│   ├── (dashboard)/
│   ├── (admin)/
│   ├── api/
│   └── layout.tsx
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── login-form.tsx
│   │   │   └── signup-form.tsx
│   │   ├── hooks/
│   │   │   └── use-auth.ts
│   │   ├── api/
│   │   │   └── auth.ts
│   │   ├── types/
│   │   │   └── auth.ts
│   │   └── index.ts
│   ├── posts/
│   │   ├── components/
│   │   │   ├── post-card.tsx
│   │   │   └── post-editor.tsx
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── types/
│   │   └── index.ts
│   └── users/
│       ├── components/
│       ├── hooks/
│       ├── api/
│       ├── types/
│       └── index.ts
├── components/         # Shared across all features
│   ├── ui/
│   └── layout/
├── lib/
│   ├── api/
│   ├── utils/
│   └── db/
│       ├── client.ts
│       └── schema.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── architecture.md
    └── api.md
```

**Characteristics**: Feature-based isolation, 200–1000+ files, teams own features independently.

**Advantages of feature-based architecture**:
- Easy to add/remove features
- Clear impact boundary
- Fewer merge conflicts

---

### React + Vite (SPA, Medium)

```
project/
├── src/
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Dashboard.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useApi.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   ├── store/
│   │   ├── userStore.ts
│   │   └── uiStore.ts
│   ├── routes/
│   │   └── index.tsx
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
└── package.json
```

---

## File Naming Conventions

### Components

```
✅ Good (PascalCase):
- Button.tsx
- UserProfile.tsx
- PostCard.tsx

❌ Bad:
- button.tsx     (lowercase)
- user-profile.tsx (kebab-case)
- userProfile.tsx  (camelCase)
```

### Utilities and Hooks

```
✅ Good (camelCase):
- useAuth.ts
- useUser.ts
- formatDate.ts
- validateEmail.ts

❌ Bad:
- UseAuth.ts    (PascalCase)
- use-auth.ts   (kebab-case)
- format-date.ts
```

### Directories

```
✅ Good (kebab-case):
- user-profile/
- post-editor/
- api-client/

❌ Bad:
- UserProfile/  (PascalCase)
- userProfile/  (camelCase)
```

---

## Module Splitting Strategy

### Feature-based vs Layer-based

| Approach | Pros | Cons | Best for |
|----------|------|------|----------|
| **Layer-based** | Simple, familiar | Cross-feature changes touch many dirs | Small teams |
| **Feature-based** | Clear ownership, less coupling | More upfront structure | Medium/large teams |

**Layer-based** (components/, hooks/, lib/, store/):
- Familiar structure
- Good for small apps

**Feature-based** (features/auth/, features/posts/):
- Each feature is self-contained
- Teams own entire features
- Better for scaling

### Import Rules

```typescript
// ✅ Feature can import from shared/components
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

// ❌ Features should not import from each other directly
import { useAuth } from '@/features/auth'  // OK if exported via index.ts
import { PostCard } from '@/features/posts/components/post-card'  // BAD — use index.ts

// ✅ Cross-feature access via public interface
import { PostCard } from '@/features/posts'  // via features/posts/index.ts
```

---

## Build Tool Comparison

| Tool | HMR | Production Build | Config | Best for |
|------|-----|-----------------|--------|----------|
| **Vite** | ~80ms | ~18s | Simple | New projects, SPA |
| **Turbopack** | ~30ms | ~12s | Next.js only | Next.js projects |
| **Webpack** | ~300ms | ~45s | Complex | Legacy projects |

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
})
```

---

## CSS Strategy Comparison

| Strategy | Bundle Size | DX | Runtime cost | Best for |
|----------|------------|-----|-------------|----------|
| **Tailwind CSS** | 8–30KB | ✅ Great | None | Most projects |
| **CSS Modules** | Per-component | ✅ Good | None | Component libraries |
| **Styled Components** | +13KB | ✅ Good | Small | Complex theming |
| **Vanilla CSS** | Minimal | Moderate | None | Simple projects |

### Tailwind CSS Setup

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```javascript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          900: '#1e3a5f',
        },
      },
    },
  },
  plugins: [],
}

export default config
```

### CSS Modules

```tsx
// Button.module.css
.button {
  padding: 8px 16px;
  border-radius: 4px;
}

.primary {
  background: #3b82f6;
  color: white;
}

// Button.tsx
import styles from './Button.module.css'

export function Button({ variant = 'primary', children }) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  )
}
```

---

## Development Environment Setup

### ESLint

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error",
    "no-console": ["warn", { "allow": ["error"] }]
  }
}
```

### Prettier

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Git Hooks with Husky

```bash
pnpm add -D husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Monorepo Structure

### Turborepo Setup

```
monorepo/
├── apps/
│   ├── web/          # Main web app (Next.js)
│   ├── admin/        # Admin panel (Next.js)
│   └── mobile/       # Mobile app (React Native)
├── packages/
│   ├── ui/           # Shared UI components
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   └── index.ts
│   │   └── package.json
│   ├── utils/        # Shared utilities
│   └── types/        # Shared TypeScript types
├── turbo.json
└── package.json
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {}
  }
}
```

---

## Performance Data

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Vite HMR | 300ms (Webpack) | 80ms | -73% |
| Turbopack HMR | 300ms (Webpack) | 30ms | -90% |
| Production build | 45s (Webpack) | 18s (Vite) | -60% |
| Tailwind CSS bundle | 200KB (no purge) | 8–30KB | -85–96% |
| Feature-based: merge conflicts | High | Low | Significant |

---

## Common Mistakes

### ❌ No Path Aliases

```typescript
// ❌ Relative hell
import { Button } from '../../../components/ui/button'

// ✅ Alias
import { Button } from '@/components/ui/button'
```

### ❌ Everything in components/

```
// ❌ Flat structure
components/
├── Header.tsx
├── UserProfile.tsx
├── LoginForm.tsx
├── Dashboard.tsx
└── ProductCard.tsx

// ✅ Organized by concern
components/ui/          # Generic UI primitives
components/layout/      # Layout components
features/auth/          # Auth-specific
features/products/      # Product-specific
```

### ❌ Inconsistent Naming

```
// ❌ Mixed naming
UserProfile.tsx
user-settings.tsx
useauth.ts

// ✅ Consistent
UserProfile.tsx    (components: PascalCase)
useAuth.ts         (hooks: camelCase)
formatDate.ts      (utils: camelCase)
```

### ❌ No .env.example

```bash
# ❌ Missing template — new devs don't know what's needed

# ✅ Always commit .env.example
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret-here
STRIPE_SECRET_KEY=sk_test_...
```
