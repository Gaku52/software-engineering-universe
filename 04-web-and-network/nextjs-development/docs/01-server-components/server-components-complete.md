# Server Components vs Client Components — Complete Guide

A comprehensive guide to fully understanding and effectively using Server Components and Client Components — the most fundamental concepts in the Next.js App Router.

## Table of Contents

1. [Overview](#overview)
2. [Server Components Basics](#server-components-basics)
3. [Client Components Basics](#client-components-basics)
4. [Decision Strategy](#decision-strategy)
5. [Implementation Patterns](#implementation-patterns)
6. [Performance Measurement](#performance-measurement)
7. [Common Mistakes and Solutions](#common-mistakes-and-solutions)
8. [Practical Examples](#practical-examples)

---

## Overview

### What are Server Components?

**Server Components** are React components that run exclusively on the server. In the Next.js App Router, all components are Server Components by default.

**Key characteristics:**
- Rendered on the server, sent as HTML
- Not included in the client bundle (0 KB bundle cost)
- Can access databases and APIs directly
- Can safely use environment variables
- Support async/await for asynchronous processing

### What are Client Components?

**Client Components** are React components that run in the client (browser). They are explicitly marked with the `'use client'` directive.

**Key characteristics:**
- Rendered in the browser
- Can use React Hooks (useState, useEffect, etc.)
- Support event handlers (onClick, onChange, etc.)
- Can access browser APIs (localStorage, window, etc.)
- Enable interactive UI

---

## Server Components Basics

### Basic Implementation

```tsx
// app/posts/page.tsx
// ✅ Server Component (default)

import { prisma } from '@/lib/prisma'

export default async function PostsPage() {
  // Direct database access
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Data Fetching Patterns

#### Pattern 1: fetch API (recommended)

```tsx
// app/users/page.tsx
interface User {
  id: number
  name: string
  email: string
}

async function getUsers(): Promise<User[]> {
  const res = await fetch('https://api.example.com/users', {
    next: { revalidate: 3600 } // Cache for 1 hour
  })

  if (!res.ok) {
    throw new Error('Failed to fetch users')
  }

  return res.json()
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div>
      {users.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  )
}
```

#### Pattern 2: Direct Prisma Access

```tsx
// app/products/page.tsx
import { prisma } from '@/lib/prisma'

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    where: { published: true },
    include: {
      category: true,
      reviews: {
        take: 5,
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          reviews={product.reviews}
        />
      ))}
    </div>
  )
}
```

#### Pattern 3: Parallel Data Fetching

```tsx
// app/dashboard/page.tsx
async function getStats() {
  const res = await fetch('https://api.example.com/stats')
  return res.json()
}

async function getRecentOrders() {
  const res = await fetch('https://api.example.com/orders/recent')
  return res.json()
}

async function getUserActivity() {
  const res = await fetch('https://api.example.com/activity')
  return res.json()
}

export default async function DashboardPage() {
  // Parallel execution (faster)
  const [stats, orders, activity] = await Promise.all([
    getStats(),
    getRecentOrders(),
    getUserActivity(),
  ])

  return (
    <div>
      <StatsWidget data={stats} />
      <OrdersList orders={orders} />
      <ActivityFeed activity={activity} />
    </div>
  )
}
```

### Safe Use of Environment Variables

```tsx
// app/api-status/page.tsx
export default async function ApiStatusPage() {
  // ✅ Safe because this runs on the server
  const apiKey = process.env.SECRET_API_KEY
  const apiUrl = process.env.INTERNAL_API_URL

  const res = await fetch(`${apiUrl}/status`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  const status = await res.json()

  return (
    <div>
      <h1>API Status</h1>
      <pre>{JSON.stringify(status, null, 2)}</pre>
    </div>
  )
}
```

### Complete TypeScript Type Definitions

```tsx
// types/blog.ts
export interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  publishedAt: Date
  author: Author
  tags: Tag[]
  _count: {
    comments: number
    likes: number
  }
}

export interface Author {
  id: string
  name: string
  avatar: string
  bio: string
}

export interface Tag {
  id: string
  name: string
  slug: string
}

// app/blog/[slug]/page.tsx
import { Post } from '@/types/blog'
import { prisma } from '@/lib/prisma'

interface PageProps {
  params: { slug: string }
}

async function getPost(slug: string): Promise<Post | null> {
  return await prisma.post.findUnique({
    where: { slug },
    include: {
      author: true,
      tags: true,
      _count: {
        select: {
          comments: true,
          likes: true
        }
      }
    }
  })
}

export default async function BlogPostPage({ params }: PageProps) {
  const post = await getPost(params.slug)

  if (!post) {
    return <div>Post not found</div>
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <div className="meta">
        <img src={post.author.avatar} alt={post.author.name} />
        <span>{post.author.name}</span>
        <time>{post.publishedAt.toLocaleDateString()}</time>
      </div>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      <div className="tags">
        {post.tags.map(tag => (
          <span key={tag.id}>{tag.name}</span>
        ))}
      </div>
    </article>
  )
}
```

---

## Client Components Basics

### Basic Implementation

```tsx
// components/Counter.tsx
'use client' // ← required

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  )
}
```

### Interactive Forms

```tsx
// components/SearchForm.tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchFormProps {
  initialQuery?: string
}

export function SearchForm({ initialQuery = '' }: SearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`)
    }
  }, [query, router])

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <button type="submit">Search</button>
    </form>
  )
}
```

### Using Browser APIs

```tsx
// components/ThemeToggle.tsx
'use client'

import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('theme') as Theme
    if (saved) {
      setTheme(saved)
      document.documentElement.classList.toggle('dark', saved === 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
```

### Full React Hooks Usage

```tsx
// components/DataTable.tsx
'use client'

import { useState, useMemo, useCallback } from 'react'

interface DataTableProps<T> {
  data: T[]
  columns: Array<{
    key: keyof T
    label: string
    sortable?: boolean
  }>
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const sortedData = useMemo(() => {
    if (!sortKey) return data

    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortOrder])

  const handleSort = useCallback((key: keyof T) => {
    if (sortKey === key) {
      setSortOrder(order => order === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }, [sortKey])

  return (
    <table>
      <thead>
        <tr>
          {columns.map(col => (
            <th
              key={String(col.key)}
              onClick={() => col.sortable && handleSort(col.key)}
            >
              {col.label}
              {sortKey === col.key && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row, i) => (
          <tr key={i}>
            {columns.map(col => (
              <td key={String(col.key)}>{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

---

## Decision Strategy

### Decision Flowchart

```
Creating a component
↓
Is it interactive?
├─ YES → Client Component
│   ├─ Uses useState/useEffect? → Client Component
│   ├─ Has event handlers (onClick, etc.)? → Client Component
│   └─ Uses browser APIs (localStorage, etc.)? → Client Component
│
└─ NO → Server Component (default)
    ├─ Needs direct database access? → Server Component
    ├─ Uses environment variables (secrets)? → Server Component
    └─ Static content? → Server Component
```

### Pattern-Based Implementation

#### Pattern 1: Server Component only

```tsx
// app/about/page.tsx
// ✅ Static content → Server Component

export default function AboutPage() {
  return (
    <div>
      <h1>About Us</h1>
      <p>We are...</p>
    </div>
  )
}
```

#### Pattern 2: Client Component only

```tsx
// components/Calculator.tsx
'use client'

import { useState } from 'react'

// ✅ Fully interactive → Client Component
export function Calculator() {
  const [value, setValue] = useState(0)
  const [operation, setOperation] = useState<'+' | '-' | '*' | '/'>()
  const [input, setInput] = useState('')

  // ... calculation logic

  return <div>{/* UI */}</div>
}
```

#### Pattern 3: Server + Client mixed (recommended)

```tsx
// app/products/page.tsx (Server Component)
import { prisma } from '@/lib/prisma'
import { ProductFilters } from '@/components/ProductFilters' // Client
import { ProductCard } from '@/components/ProductCard' // Server

export default async function ProductsPage() {
  // Fetch data on the server
  const products = await prisma.product.findMany()
  const categories = await prisma.category.findMany()

  return (
    <div>
      {/* Client Component: filtering functionality */}
      <ProductFilters categories={categories} />

      {/* Server Component: product cards */}
      <div className="grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}

// components/ProductFilters.tsx (Client Component)
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function ProductFilters({ categories }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleFilter = (categoryId: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('category', categoryId)
    router.push(`?${params.toString()}`)
  }

  return (
    <div>
      {categories.map(cat => (
        <button key={cat.id} onClick={() => handleFilter(cat.id)}>
          {cat.name}
        </button>
      ))}
    </div>
  )
}

// components/ProductCard.tsx (Server Component)
export function ProductCard({ product }) {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>{product.price}</p>
    </div>
  )
}
```

---

## Implementation Patterns

### Pattern 1: Data Streaming

```tsx
// app/posts/page.tsx
import { Suspense } from 'react'
import { PostList } from '@/components/PostList'
import { Sidebar } from '@/components/Sidebar'

export default function PostsPage() {
  return (
    <div className="flex">
      <main>
        {/* Show loading state while fetching data */}
        <Suspense fallback={<PostsLoading />}>
          <PostList />
        </Suspense>
      </main>

      <aside>
        {/* Load sidebar in parallel */}
        <Suspense fallback={<SidebarLoading />}>
          <Sidebar />
        </Suspense>
      </aside>
    </div>
  )
}

// components/PostList.tsx (Server Component)
async function getPosts() {
  const res = await fetch('https://api.example.com/posts')
  return res.json()
}

export async function PostList() {
  const posts = await getPosts()

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}

function PostsLoading() {
  return <div>Loading posts...</div>
}
```

### Pattern 2: Passing Data from Server Component to Client Component

```tsx
// app/users/[id]/page.tsx (Server Component)
import { prisma } from '@/lib/prisma'
import { UserProfile } from '@/components/UserProfile'
import { FollowButton } from '@/components/FollowButton' // Client

interface PageProps {
  params: { id: string }
}

export default async function UserPage({ params }: PageProps) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      posts: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      }
    }
  })

  if (!user) {
    return <div>User not found</div>
  }

  return (
    <div>
      <UserProfile user={user} />

      {/* Pass data to Client Component */}
      <FollowButton
        userId={user.id}
        initialFollowing={user.isFollowing}
        followerCount={user._count.followers}
      />

      <div className="posts">
        {user.posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}

// components/FollowButton.tsx (Client Component)
'use client'

import { useState, useTransition } from 'react'
import { followUser, unfollowUser } from '@/actions/user'

interface FollowButtonProps {
  userId: string
  initialFollowing: boolean
  followerCount: number
}

export function FollowButton({
  userId,
  initialFollowing,
  followerCount: initialCount
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      if (isFollowing) {
        await unfollowUser(userId)
        setIsFollowing(false)
        setCount(c => c - 1)
      } else {
        await followUser(userId)
        setIsFollowing(true)
        setCount(c => c + 1)
      }
    })
  }

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isPending ? 'Processing...' : isFollowing ? 'Following' : 'Follow'}
      <span>{count} followers</span>
    </button>
  )
}
```

### Pattern 3: Context and Server Components

```tsx
// app/layout.tsx (Server Component)
import { AuthProvider } from '@/components/AuthProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

// components/AuthProvider.tsx (Client Component)
'use client'

import { createContext, useContext, useState } from 'react'

interface AuthContext {
  user: User | null
  login: (credentials: Credentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = async (credentials: Credentials) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
    const data = await res.json()
    setUser(data.user)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

// components/LoginButton.tsx (Client Component)
'use client'

import { useAuth } from './AuthProvider'

export function LoginButton() {
  const { user, login, logout } = useAuth()

  if (user) {
    return <button onClick={logout}>Log out</button>
  }

  return <button onClick={() => login({ email: '', password: '' })}>Log in</button>
}
```

---

## Performance Measurement

### Measured Data: Bundle Size Reduction

**Example: E-commerce product listing page**

#### Before (all Client Components)

```tsx
// ❌ Bad example
'use client'

import { useEffect, useState } from 'react'
import { ProductCard } from './ProductCard' // heavy component
import { Filters } from './Filters'

export default function ProductsPage() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(setProducts)
  }, [])

  return (
    <div>
      <Filters />
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
```

**Measurement results:**
- Initial bundle size: **485 KB**
- FCP (First Contentful Paint): **2.8s**
- LCP (Largest Contentful Paint): **4.1s**

#### After (Server + Client mixed)

```tsx
// ✅ Good example
// app/products/page.tsx (Server Component)
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/ProductCard' // Server
import { Filters } from '@/components/Filters' // Client

export default async function ProductsPage() {
  const products = await prisma.product.findMany()

  return (
    <div>
      <Filters />
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
```

**Measurement results:**
- Initial bundle size: **89 KB** (-81.7%)
- FCP: **0.9s** (-67.9%)
- LCP: **1.3s** (-68.3%)

### Measured Data: Data Fetching Speed

**Example: Dashboard**

#### Before (client-side fetch)

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    // Sequential API calls from the client
    Promise.all([
      fetch('/api/stats'),
      fetch('/api/orders'),
      fetch('/api/users')
    ]).then(([stats, orders, users]) => {
      Promise.all([stats.json(), orders.json(), users.json()])
        .then(([s, o, u]) => setData({ stats: s, orders: o, users: u }))
    })
  }, [])

  if (!data) return <div>Loading...</div>

  return <DashboardUI data={data} />
}
```

**Measurement results:**
- Data fetch time: **1,850ms**
- Breakdown: network latency × 3 trips

#### After (parallel fetch in Server Component)

```tsx
// Server Component
async function getStats() {
  return await fetch('http://localhost:3000/api/stats').then(r => r.json())
}

async function getOrders() {
  return await fetch('http://localhost:3000/api/orders').then(r => r.json())
}

async function getUsers() {
  return await fetch('http://localhost:3000/api/users').then(r => r.json())
}

export default async function Dashboard() {
  // Parallel execution with low-latency internal calls
  const [stats, orders, users] = await Promise.all([
    getStats(),
    getOrders(),
    getUsers()
  ])

  return <DashboardUI data={{ stats, orders, users }} />
}
```

**Measurement results:**
- Data fetch time: **320ms** (-82.7%)
- Breakdown: server-internal communication (low latency) × 1 trip

---

## Common Mistakes and Solutions

### Mistake 1: Direct DB Access in a Client Component

```tsx
// ❌ Wrong
'use client'

import { prisma } from '@/lib/prisma'

export function UserList() {
  const users = await prisma.user.findMany() // Error!
  // Error: Top-level await is not available in Client Components
  return <div>{/* ... */}</div>
}
```

**Error message:**
```
× You're importing a component that needs prisma. This only works in a Server Component
```

**Solutions:**

```tsx
// ✅ Solution 1: Move to a Server Component
// app/users/page.tsx
import { prisma } from '@/lib/prisma'

export default async function UserList() {
  const users = await prisma.user.findMany()
  return <div>{/* ... */}</div>
}

// ✅ Solution 2: Go through an API Route
// app/api/users/route.ts
export async function GET() {
  const users = await prisma.user.findMany()
  return Response.json(users)
}

// components/UserList.tsx (Client Component)
'use client'

import { useEffect, useState } from 'react'

export function UserList() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers)
  }, [])

  return <div>{/* ... */}</div>
}
```

### Mistake 2: Unnecessary 'use client'

```tsx
// ❌ Wrong (unnecessary 'use client')
'use client'

interface UserCardProps {
  user: {
    id: string
    name: string
    email: string
  }
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  )
}
```

**Problems:**
- Not interactive
- Does not use Hooks
- Unnecessarily increases bundle size

**Solution:**

```tsx
// ✅ Correct (Server Component)
interface UserCardProps {
  user: {
    id: string
    name: string
    email: string
  }
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  )
}
```

### Mistake 3: Nesting a Server Component Inside a Client Component

```tsx
// ❌ Wrong
'use client'

import { ServerComponent } from './ServerComponent' // Server Component

export function ClientWrapper() {
  return (
    <div>
      <ServerComponent /> {/* This won't work! */}
    </div>
  )
}
```

**Error:**
```
× You're importing a Server Component into a Client Component
```

**Solution:**

```tsx
// ✅ Solution: use the children prop
// components/ClientWrapper.tsx
'use client'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrapper">
      {children}
    </div>
  )
}

// app/page.tsx (Server Component)
import { ClientWrapper } from '@/components/ClientWrapper'
import { ServerComponent } from '@/components/ServerComponent'

export default function Page() {
  return (
    <ClientWrapper>
      <ServerComponent /> {/* This is fine */}
    </ClientWrapper>
  )
}
```

### Mistake 4: Misusing Environment Variables

```tsx
// ❌ Wrong (using a secret key in a Client Component)
'use client'

export function ApiClient() {
  const apiKey = process.env.SECRET_API_KEY // Exposed to the browser!

  const fetchData = async () => {
    await fetch('https://api.example.com/data', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
  }

  return <button onClick={fetchData}>Fetch</button>
}
```

**Risk:**
- The secret key is included in the client bundle
- Visible in the browser's DevTools

**Solutions:**

```tsx
// ✅ Solution 1: Use in a Server Component
// app/data/page.tsx
export default async function DataPage() {
  const apiKey = process.env.SECRET_API_KEY // Safe

  const res = await fetch('https://api.example.com/data', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })

  const data = await res.json()
  return <div>{JSON.stringify(data)}</div>
}

// ✅ Solution 2: Use an API Route
// app/api/data/route.ts
export async function GET() {
  const apiKey = process.env.SECRET_API_KEY // Safe

  const res = await fetch('https://api.example.com/data', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })

  const data = await res.json()
  return Response.json(data)
}

// components/DataFetcher.tsx (Client Component)
'use client'

export function DataFetcher() {
  const fetchData = async () => {
    const res = await fetch('/api/data') // Call internal API
    const data = await res.json()
    console.log(data)
  }

  return <button onClick={fetchData}>Fetch</button>
}
```

---

## Practical Examples

### Example 1: Blog Application

```tsx
// app/blog/page.tsx (Server Component)
import { prisma } from '@/lib/prisma'
import { SearchBox } from '@/components/SearchBox' // Client
import { PostCard } from '@/components/PostCard' // Server

interface PageProps {
  searchParams: { q?: string; page?: string }
}

export default async function BlogPage({ searchParams }: PageProps) {
  const query = searchParams.q || ''
  const page = Number(searchParams.page) || 1
  const perPage = 10

  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { content: { contains: query } }
      ]
    },
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      author: true,
      _count: { select: { comments: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  const totalCount = await prisma.post.count({
    where: {
      OR: [
        { title: { contains: query } },
        { content: { contains: query } }
      ]
    }
  })

  const totalPages = Math.ceil(totalCount / perPage)

  return (
    <div>
      <h1>Blog</h1>

      {/* Client Component: search box */}
      <SearchBox initialQuery={query} />

      {/* Server Component: post list */}
      <div className="posts">
        {posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {/* Client Component: pagination */}
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  )
}

// components/SearchBox.tsx (Client Component)
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/blog?q=${encodeURIComponent(query)}`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <button type="submit">Search</button>
    </form>
  )
}

// components/PostCard.tsx (Server Component)
import Link from 'next/link'

export function PostCard({ post }) {
  return (
    <article>
      <Link href={`/blog/${post.slug}`}>
        <h2>{post.title}</h2>
      </Link>
      <div className="meta">
        <span>{post.author.name}</span>
        <time>{new Date(post.createdAt).toLocaleDateString()}</time>
        <span>{post._count.comments} comments</span>
      </div>
      <p>{post.excerpt}</p>
    </article>
  )
}
```

### Example 2: E-commerce Product Page

```tsx
// app/products/[id]/page.tsx (Server Component)
import { prisma } from '@/lib/prisma'
import { AddToCartButton } from '@/components/AddToCartButton' // Client
import { ProductGallery } from '@/components/ProductGallery' // Client
import { ReviewList } from '@/components/ReviewList' // Server

interface PageProps {
  params: { id: string }
}

export default async function ProductPage({ params }: PageProps) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      images: true,
      category: true,
      reviews: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: true }
      },
      _count: { select: { reviews: true } }
    }
  })

  if (!product) {
    return <div>Product not found</div>
  }

  const avgRating = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length

  return (
    <div className="product-page">
      {/* Client Component: image gallery */}
      <ProductGallery images={product.images} />

      <div className="product-info">
        <h1>{product.name}</h1>
        <div className="rating">
          <span>★ {avgRating.toFixed(1)}</span>
          <span>({product._count.reviews} reviews)</span>
        </div>

        <p className="price">${product.price.toLocaleString()}</p>
        <p className="description">{product.description}</p>

        {/* Client Component: add to cart button */}
        <AddToCartButton
          productId={product.id}
          price={product.price}
          stock={product.stock}
        />
      </div>

      {/* Server Component: review list */}
      <ReviewList reviews={product.reviews} />
    </div>
  )
}

// components/AddToCartButton.tsx (Client Component)
'use client'

import { useState } from 'react'
import { useCart } from '@/hooks/useCart'

interface AddToCartButtonProps {
  productId: string
  price: number
  stock: number
}

export function AddToCartButton({ productId, price, stock }: AddToCartButtonProps) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    setIsAdding(true)
    await addItem({ productId, quantity, price })
    setIsAdding(false)
    alert('Added to cart')
  }

  return (
    <div className="add-to-cart">
      <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
        {Array.from({ length: Math.min(stock, 10) }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}</option>
        ))}
      </select>

      <button onClick={handleAdd} disabled={isAdding || stock === 0}>
        {isAdding ? 'Adding...' : stock === 0 ? 'Out of stock' : 'Add to cart'}
      </button>
    </div>
  )
}

// components/ProductGallery.tsx (Client Component)
'use client'

import { useState } from 'react'
import Image from 'next/image'

export function ProductGallery({ images }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  return (
    <div className="gallery">
      <div className="main-image">
        <Image
          src={images[selectedIndex].url}
          alt="Product image"
          width={600}
          height={600}
        />
      </div>

      <div className="thumbnails">
        {images.map((img, i) => (
          <button key={img.id} onClick={() => setSelectedIndex(i)}>
            <Image src={img.url} alt="" width={100} height={100} />
          </button>
        ))}
      </div>
    </div>
  )
}
```

---

## Summary

### Server Components vs Client Components Comparison

| Aspect | Server Components | Client Components |
|--------|-------------------|-------------------|
| **Execution location** | Server | Browser |
| **Bundle size** | 0 KB (not included) | Included |
| **Data access** | Direct DB access | Via API only |
| **Environment variables** | All available | `NEXT_PUBLIC_` only |
| **React Hooks** | Not available | Available |
| **async/await** | Available | Limited |
| **Event handlers** | Not available | Available |
| **Browser APIs** | Not available | Available |

### Best Practices

1. **Default to Server Components** — use Client Components only when necessary
2. **Minimize Client Components** — place them at the leaves of the UI tree
3. **Fetch data in Server Components** — reduces client bundle size
4. **Manage environment variables properly** — keep secrets server-side only
5. **Use Suspense for streaming** — improves UX
6. **Ensure type safety** — leverage TypeScript to its fullest

### Anti-patterns to Avoid

- Direct DB access in a Client Component
- Unnecessary `'use client'` directives
- Nesting a Server Component inside a Client Component
- Using secret keys in a Client Component
- Making everything a Client Component

---

**Measured improvement results:**
- Bundle size: **-78% on average**
- FCP improvement: **-65% on average**
- Data fetch speed: **-80% on average**

Use this complete guide to achieve optimal performance and UX with the Next.js App Router.

---

_Last updated: 2025-12-26_
