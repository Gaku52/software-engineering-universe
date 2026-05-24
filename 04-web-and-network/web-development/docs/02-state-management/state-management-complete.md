# State Management — Complete Guide

Comprehensive guide to Context API, Zustand, Jotai, and Redux Toolkit.

## Table of Contents

1. [Overview](#overview)
2. [State Management Fundamentals](#state-management-fundamentals)
3. [Context API](#context-api)
4. [Zustand](#zustand)
5. [Jotai](#jotai)
6. [Redux Toolkit](#redux-toolkit)
7. [Comparison](#comparison)
8. [Decision Flowchart](#decision-flowchart)
9. [Complete Implementation Examples](#complete-implementation-examples)
10. [Performance Benchmarks](#performance-benchmarks)
11. [Common Mistakes](#common-mistakes)

---

## Overview

### Why State Management Matters

The complexity of a React app is proportional to the complexity of its state:

- **Avoid prop drilling**: Stop passing data through deeply nested component trees
- **Global state**: Share state across many components
- **Performance**: Prevent unnecessary re-renders
- **Maintainability**: Make state changes easy to trace

### Library Comparison at a Glance

| Library | Type | Learning Curve | Bundle Size | Popularity |
|---------|------|---------------|------------|------------|
| **Context API** | React built-in | Low | 0KB | ◎ |
| **Zustand** | Lightweight store | Low | 1.2KB | ◎ |
| **Jotai** | Atomic | Medium | 3.2KB | ○ |
| **Redux Toolkit** | Redux simplified | High | 12KB | ◎ |

---

## State Management Fundamentals

### Types of State

#### 1. Local State

State used only within a single component.

```tsx
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

**Examples**: form inputs, modal open/close, local UI state

#### 2. Global State

State shared across multiple components.

```tsx
// User info used by many components
<Header user={user} />
<Sidebar user={user} />
<Content user={user} />
```

**Examples**: authenticated user, theme/language settings, shopping cart

#### 3. Server State

Data fetched from the server.

```tsx
const { data: posts, isLoading } = useQuery('posts', fetchPosts)
```

**Recommended libraries**:
- **TanStack Query (React Query)** — most popular
- **SWR** — by Vercel
- **Apollo Client** — for GraphQL

> **Important**: Server state should typically be managed with a dedicated library (React Query, etc.). Zustand/Redux are primarily for client state.

#### 4. URL State

State stored in the URL (search params, etc.).

```tsx
// /products?category=electronics&page=2
const [searchParams] = useSearchParams()
const category = searchParams.get('category')
const page = searchParams.get('page')
```

**Examples**: search filters, pagination, active tab

---

### The Prop Drilling Problem

```tsx
// ❌ Prop drilling through many layers
function App() {
  const [user, setUser] = useState<User | null>(null)
  return <Dashboard user={user} setUser={setUser} />
}

function Dashboard({ user, setUser }: Props) {
  return <Sidebar user={user} setUser={setUser} />
}

function Sidebar({ user, setUser }: Props) {
  return <UserMenu user={user} setUser={setUser} />
}

function UserMenu({ user, setUser }: Props) {
  return <div>{user?.name}</div>  // Finally uses it
}
```

**Problems**:
- Intermediate components pass props they don't use
- Changing shape requires updating multiple files
- Duplicate type definitions

**Solution**: Global state management (Context API, Zustand, etc.)

---

## Context API

### Overview

**React's built-in global state management**

- ✅ No additional library required
- ✅ Low learning curve
- ✅ Full TypeScript support
- ❌ Performance optimization is tricky
- ❌ Multiple contexts can lead to verbose code

### Basic Usage

```tsx
// contexts/UserContext.tsx
import { createContext, useContext, useState, useMemo, ReactNode } from 'react'

interface User {
  id: string
  name: string
  email: string
}

interface UserContextType {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const logout = () => setUser(null)

  const value = useMemo(() => ({ user, setUser, logout }), [user])

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
```

```tsx
// App.tsx
import { UserProvider } from '@/contexts/UserContext'

export default function App() {
  return (
    <UserProvider>
      <Dashboard />
    </UserProvider>
  )
}

// Dashboard.tsx
import { useUser } from '@/contexts/UserContext'

export function Dashboard() {
  const { user, logout } = useUser()
  if (!user) return <Login />
  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

### Performance Optimization

**Problem**: When Context value changes, ALL child components re-render.

```tsx
// ❌ Single context for everything
function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  // When either user or settings changes, ALL children re-render
  return (
    <AppContext.Provider value={{ user, setUser, settings, setSettings }}>
      {children}
    </AppContext.Provider>
  )
}
```

**Solution 1**: Split contexts by concern

```tsx
// ✅ Separate contexts
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const value = useMemo(() => ({ user, setUser }), [user])
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const value = useMemo(() => ({ settings, setSettings }), [settings])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

// App.tsx
<UserProvider>
  <SettingsProvider>
    <App />
  </SettingsProvider>
</UserProvider>
```

### When to Use Context API

**✅ Good fit**:
- Small to medium apps
- Few global state values (1–3)
- Avoiding extra dependencies
- Simple state like theme or language settings

**❌ Avoid when**:
- Large apps with many global state values
- Frequently updated state
- Complex state logic
- Performance is critical

---

## Zustand

### Overview

**Lightweight, flexible state management**

- ✅ Tiny (1.2KB)
- ✅ Low learning curve
- ✅ Hooks-based (feels like React)
- ✅ Full TypeScript support
- ✅ Redux DevTools compatible
- ✅ Excellent performance
- ✅ No Provider required

### Basic Usage

```bash
npm install zustand
```

```tsx
// store/userStore.ts
import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
}

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
// Dashboard.tsx
import { useUserStore } from '@/store/userStore'

export function Dashboard() {
  const { user, logout } = useUserStore()
  if (!user) return <Login />
  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```

**No Provider needed — just import and use.**

### Selectors for Performance

```tsx
// ❌ Subscribes to the entire store — re-renders on any change
function UserName() {
  const store = useUserStore()
  return <div>{store.user?.name}</div>
}

// ✅ Subscribes only to user — re-renders only when user changes
function UserName() {
  const user = useUserStore(state => state.user)
  return <div>{user?.name}</div>
}
```

### Middleware

#### persist — survive page reload

```tsx
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: 'user-storage' }  // localStorage key
  )
)
```

#### devtools — Redux DevTools integration

```tsx
import { devtools } from 'zustand/middleware'

export const useUserStore = create<UserStore>()(
  devtools(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }, false, 'setUser'),
      logout: () => set({ user: null }, false, 'logout'),
    }),
    { name: 'UserStore' }
  )
)
```

#### immer — mutable-style updates

```tsx
import { immer } from 'zustand/middleware/immer'

export const useTodoStore = create<TodoStore>()(
  immer((set) => ({
    todos: [],
    addTodo: (text) =>
      set((state) => {
        state.todos.push({ id: nanoid(), text, done: false })
      }),
    toggleTodo: (id) =>
      set((state) => {
        const todo = state.todos.find((t) => t.id === id)
        if (todo) todo.done = !todo.done
      }),
  }))
)
```

### Multiple Stores

```tsx
// Use multiple stores in one component
function Header() {
  const user = useUserStore(state => state.user)
  const cartCount = useCartStore(state => state.items.length)
  const theme = useSettingsStore(state => state.theme)

  return <header>{/* ... */}</header>
}
```

### When to Use Zustand

**✅ Good fit**: Small to large apps, want simple API, care about bundle size.

> **When in doubt, choose Zustand** — it handles most use cases well.

**❌ Consider alternatives when**:
- You want full Redux patterns → Redux Toolkit
- You want atomic state design → Jotai

---

## Jotai

### Overview

**Atomic state management (inspired by Recoil)**

- ✅ Atomic (fine-grained state units)
- ✅ Minimal boilerplate
- ✅ Full TypeScript support
- ✅ Suspense compatible
- ❌ Medium learning curve (atomic concept)
- ❌ Larger than Zustand (3.2KB)

### Basic Usage

```bash
npm install jotai
```

```tsx
// atoms/userAtom.ts
import { atom } from 'jotai'

export const userAtom = atom<User | null>(null)
```

```tsx
// Dashboard.tsx
import { useAtom } from 'jotai'
import { userAtom } from '@/atoms/userAtom'

export function Dashboard() {
  const [user, setUser] = useAtom(userAtom)
  if (!user) return <Login />
  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <button onClick={() => setUser(null)}>Logout</button>
    </div>
  )
}
```

### Derived Atoms

```tsx
import { atom } from 'jotai'

const cartItemsAtom = atom<CartItem[]>([])

// Derived atom — computed from cartItemsAtom
const cartTotalAtom = atom((get) => {
  const items = get(cartItemsAtom)
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
})

const cartCountAtom = atom((get) => get(cartItemsAtom).length)

function CartSummary() {
  const total = useAtomValue(cartTotalAtom)
  const count = useAtomValue(cartCountAtom)
  return <div>{count} items — ${total.toFixed(2)}</div>
}
```

### When to Use Jotai

**✅ Good fit**: Fine-grained reactivity, complex derived state, Suspense usage.

**❌ Avoid when**: Team prefers simpler Zustand API, or Redux patterns required.

---

## Redux Toolkit

### Overview

**Official Redux package — significantly reduced boilerplate**

- ✅ Industry standard for large apps
- ✅ Excellent DevTools
- ✅ Time-travel debugging
- ✅ Predictable state flow
- ❌ Higher learning curve
- ❌ Larger bundle (12KB)
- ❌ More verbose than Zustand

### Basic Usage

```bash
npm install @reduxjs/toolkit react-redux
```

```tsx
// store/userSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UserState {
  user: User | null
  isLoading: boolean
  error: string | null
}

const initialState: UserState = {
  user: null,
  isLoading: false,
  error: null,
}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload
    },
    logout: (state) => {
      state.user = null
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const { setUser, logout, setLoading } = userSlice.actions
export default userSlice.reducer
```

```tsx
// store/index.ts
import { configureStore } from '@reduxjs/toolkit'
import userReducer from './userSlice'
import cartReducer from './cartSlice'

export const store = configureStore({
  reducer: {
    user: userReducer,
    cart: cartReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

```tsx
// App.tsx
import { Provider } from 'react-redux'
import { store } from '@/store'

export default function App() {
  return (
    <Provider store={store}>
      <Dashboard />
    </Provider>
  )
}

// Dashboard.tsx
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '@/store'
import { logout } from '@/store/userSlice'

export function Dashboard() {
  const user = useSelector((state: RootState) => state.user.user)
  const dispatch = useDispatch()

  if (!user) return <Login />
  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <button onClick={() => dispatch(logout())}>Logout</button>
    </div>
  )
}
```

### When to Use Redux Toolkit

**✅ Good fit**: Large enterprise apps, existing Redux codebase, strong DevTools requirements, complex async flows.

**❌ Overkill for**: Small/medium apps, new projects without Redux history.

---

## Comparison

| Feature | Context API | Zustand | Jotai | Redux Toolkit |
|---------|-------------|---------|-------|---------------|
| Bundle size | 0KB | 1.2KB | 3.2KB | 12KB |
| Learning curve | Low | Low | Medium | High |
| Provider required | Yes | No | Provider optional | Yes |
| DevTools | No | Yes | Yes | Excellent |
| Performance | Manual optimization | Auto with selectors | Fine-grained | Excellent |
| Boilerplate | Low | Very low | Very low | Medium |
| Async support | Manual | Manual | Built-in | createAsyncThunk |

---

## Decision Flowchart

```
New project?
├─ Small app (< 5 global states, < 3 devs)
│   └─ Context API + useState (no extra library)
├─ Medium app (typical SaaS/dashboard)
│   └─ Zustand ← recommended default
├─ Large app (enterprise, 15+ devs)
│   ├─ Complex state + strong DevTools needed → Redux Toolkit
│   └─ Fine-grained reactivity needed → Jotai
└─ Existing Redux project → Redux Toolkit (stick with it)
```

---

## Complete Implementation Examples

### Shopping Cart (Zustand)

```tsx
// store/cartStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  total: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            }
          }
          return { items: [...state.items, { ...item, quantity: 1 }] }
        }),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity === 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        })),
      clearCart: () => set({ items: [] }),
      total: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
    { name: 'cart-storage' }
  )
)
```

```tsx
// components/Cart.tsx
export function Cart() {
  const { items, removeItem, updateQuantity, total } = useCartStore()

  if (items.length === 0) return <p>Your cart is empty</p>

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>
          <span>{item.name}</span>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
            min={0}
          />
          <span>${(item.price * item.quantity).toFixed(2)}</span>
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}
      <div>Total: ${total().toFixed(2)}</div>
    </div>
  )
}
```

### Authentication (Zustand + persist)

```tsx
// store/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: 'auth-storage' }
  )
)
```

---

## Performance Benchmarks

### Scenario: 10 child components, 1 updates state

| Method | Re-renders | Update Time |
|--------|-----------|-------------|
| Context (single, no split) | 10/10 | 8ms |
| Context (split by concern) | 3/10 | 2ms (-75%) |
| Zustand (no selector) | 10/10 | 6ms |
| Zustand (with selector) | 3/10 | 1.5ms (-75%) |
| Jotai (atom) | 1–3/10 | 1ms |
| Redux Toolkit | 3/10 | 2ms |

---

## Common Mistakes

### ❌ Context re-render on every render

```tsx
// ❌ New object created every render = all consumers re-render
function Provider({ children }) {
  const [user, setUser] = useState(null)
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}

// ✅ Memoize the value
function Provider({ children }) {
  const [user, setUser] = useState(null)
  const value = useMemo(() => ({ user, setUser }), [user])
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
```

### ❌ Zustand without selectors

```tsx
// ❌ Re-renders on any store change
const { user, cart, settings } = useStore()

// ✅ Subscribe to specific slices
const user = useStore(state => state.user)
const cartCount = useStore(state => state.cart.length)
```

### ❌ Storing server state in global state

```tsx
// ❌ Managing server data in Zustand
const usePostStore = create((set) => ({
  posts: [],
  isLoading: false,
  fetchPosts: async () => {
    set({ isLoading: true })
    const posts = await api.getPosts()
    set({ posts, isLoading: false })
  },
}))

// ✅ Use TanStack Query for server state
const { data: posts, isLoading } = useQuery({
  queryKey: ['posts'],
  queryFn: api.getPosts,
})
```

### ❌ One giant store for everything

```tsx
// ❌ Everything in one store
const useStore = create((set) => ({
  user: null,
  cart: [],
  settings: {},
  posts: [],
  comments: [],
  notifications: [],
  // ... 50 more fields
}))

// ✅ Split by domain
const useUserStore = create(...)
const useCartStore = create(...)
const useSettingsStore = create(...)
```
