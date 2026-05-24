
# Type-Safe Implementation of Context and Forms

## What You Will Learn

In this chapter, you will learn how to implement Context API and forms in a type-safe way.

- Best practices for defining Context types
- Safe Context usage via custom Hooks
- Patterns for combining multiple Contexts
- Combining useReducer with Context
- Integration with React Hook Form
- Type-safe validation using Zod
- Practical examples: authentication, theme, and locale management

**Prerequisites**: Basics of Context API and React Hook Form

**Supported Versions**: React 19.x / React Hook Form v7 (`react-hook-form`) / Zod v4 (`zod`) / `@hookform/resolvers` v5

**Estimated Time**: 50–60 minutes


## Table of Contents

1. [Basic Type Definitions for Context](#1-basic-type-definitions-for-context)
2. [Using Context Safely with Custom Hooks](#2-using-context-safely-with-custom-hooks)
3. [Combining Multiple Contexts](#3-combining-multiple-contexts)
4. [Combining useReducer with Context](#4-combining-usereducer-with-context)
5. [Type Definitions for React Hook Form](#5-type-definitions-for-react-hook-form)
6. [Type-Safe Validation with Zod](#6-type-safe-validation-with-zod)
7. [Practical Example: Complete Authentication Context Implementation](#7-practical-example-complete-authentication-context-implementation)
8. [Summary](#8-summary)


## Before Context API: Consider Component Composition

Context API is powerful, but **it is not always the best solution for every Props drilling problem**.

The first option to consider is **Component Composition**.

```typescript
// ❌ Props drilling: intermediate components pass theme through without using it
function App() {
  const theme = useThemeValue()
  return <Layout theme={theme} />  // Layout does not use theme
}
function Layout({ theme }: { theme: Theme }) {
  return <Sidebar theme={theme} />  // Sidebar does not use theme either
}
function Sidebar({ theme }: { theme: Theme }) {
  return <Avatar theme={theme} />  // Only Avatar uses theme
}

// - Component composition: pass directly via children
function App() {
  const theme = useThemeValue()
  return (
    <Layout>
      <Sidebar>
        <Avatar theme={theme} />  {/* Pass directly */}
      </Sidebar>
    </Layout>
  )
}
```

**When Context API is appropriate:**
- Theme (dark/light): many components throughout the app need to reference it
- Authentication info: login status needs to be checked from any screen
- Locale/language settings: affects all text in the app

**When Component Composition is appropriate:**
- Only specific child components need the data
- Props drilling spans only 2–3 levels and intermediate components are unnecessarily passing Props

With this distinction in mind, the following sections cover type-safe Context API implementation.


## 1. Basic Type Definitions for Context

### Basic Pattern

```typescript
interface User {
  id: string
  name: string
  email: string
}

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

// Allowing undefined makes it possible to detect usage outside a Provider
const AuthContext = createContext<AuthContextValue | undefined>(undefined)
```

**Why include `undefined`?**

```typescript
// ❌ Setting a default value allows usage without a Provider
const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false
})

// - Using undefined enforces that a Provider is required
const AuthContext = createContext<AuthContextValue | undefined>(undefined)
```

### Provider Implementation

```typescript
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const user = await response.json()
      setUser(user)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    // Clear local storage, cookies, etc.
  }

  const isAuthenticated = user !== null

  // Fetch user info on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me')
        if (response.ok) {
          const user = await response.json()
          setUser(user)
        }
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}
```


## 2. Using Context Safely with Custom Hooks

### Basic Pattern

```typescript
function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
```

**Benefits**:
1. Prevents usage outside a Provider
2. Centralizes `undefined` checks in one place
3. Eliminates the need for type assertions at the call site

### Usage Example

```typescript
function UserProfile() {
  // context is of type AuthContextValue (not undefined)
  const { user, logout } = useAuth()

  if (!user) {
    return <div>Please log in</div>
  }

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
```


## 3. Combining Multiple Contexts

### Theme Context

```typescript
type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  useEffect(() => {
    // Load from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('theme', theme)
    // Apply to document
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

### Locale Context

```typescript
type Locale = 'en' | 'ja'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'welcome': 'Welcome',
    'logout': 'Logout'
  },
  ja: {
    'welcome': 'ようこそ',
    'logout': 'ログアウト'
  }
}

function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')

  const t = (key: string): string => {
    return translations[locale][key] ?? key
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return context
}
```

### Combined Provider

```typescript
interface AppProvidersProps {
  children: React.ReactNode
}

function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}

// Usage example
function App() {
  return (
    <AppProviders>
      <Router>
        <Routes>
          {/* ... */}
        </Routes>
      </Router>
    </AppProviders>
  )
}
```


## 4. Combining useReducer with Context

### Type Definitions for State and Actions

```typescript
interface TodoItem {
  id: string
  title: string
  completed: boolean
  createdAt: Date
}

interface TodoState {
  todos: TodoItem[]
  filter: 'all' | 'active' | 'completed'
}

type TodoAction =
  | { type: 'ADD_TODO'; payload: { title: string } }
  | { type: 'TOGGLE_TODO'; payload: { id: string } }
  | { type: 'DELETE_TODO'; payload: { id: string } }
  | { type: 'SET_FILTER'; payload: { filter: TodoState['filter'] } }
  | { type: 'CLEAR_COMPLETED' }
```

### Reducer Implementation

```typescript
function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [
          ...state.todos,
          {
            id: crypto.randomUUID(),
            title: action.payload.title,
            completed: false,
            createdAt: new Date()
          }
        ]
      }

    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload.id
            ? { ...todo, completed: !todo.completed }
            : todo
        )
      }

    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter((todo) => todo.id !== action.payload.id)
      }

    case 'SET_FILTER':
      return {
        ...state,
        filter: action.payload.filter
      }

    case 'CLEAR_COMPLETED':
      return {
        ...state,
        todos: state.todos.filter((todo) => !todo.completed)
      }

    default:
      return state
  }
}
```

### Context Provider

```typescript
interface TodoContextValue {
  state: TodoState
  dispatch: React.Dispatch<TodoAction>
}

const TodoContext = createContext<TodoContextValue | undefined>(undefined)

function TodoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(todoReducer, {
    todos: [],
    filter: 'all'
  })

  return (
    <TodoContext.Provider value={{ state, dispatch }}>
      {children}
    </TodoContext.Provider>
  )
}

function useTodo() {
  const context = useContext(TodoContext)
  if (!context) {
    throw new Error('useTodo must be used within TodoProvider')
  }
  return context
}
```

### Usage Example

```typescript
function TodoList() {
  const { state, dispatch } = useTodo()

  const filteredTodos = state.todos.filter((todo) => {
    if (state.filter === 'active') return !todo.completed
    if (state.filter === 'completed') return todo.completed
    return true
  })

  const handleAddTodo = (title: string) => {
    dispatch({ type: 'ADD_TODO', payload: { title } })
  }

  const handleToggle = (id: string) => {
    dispatch({ type: 'TOGGLE_TODO', payload: { id } })
  }

  return (
    <div>
      <TodoInput onAdd={handleAddTodo} />
      <ul>
        {filteredTodos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo.id)}
            />
            <span>{todo.title}</span>
            <button
              onClick={() =>
                dispatch({ type: 'DELETE_TODO', payload: { id: todo.id } })
              }
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <TodoFilters />
    </div>
  )
}
```


## 5. Type Definitions for React Hook Form

### Basic Usage

```typescript
import { useForm, SubmitHandler } from 'react-hook-form'

interface LoginFormData {
  email: string
  password: string
  rememberMe: boolean
}

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  })

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    try {
      await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      // Handle successful login
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
        />
        {errors.email && (
          <span className="error">{errors.email.message}</span>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters'
            }
          })}
        />
        {errors.password && (
          <span className="error">{errors.password.message}</span>
        )}
      </div>

      <div>
        <label>
          <input type="checkbox" {...register('rememberMe')} />
          Remember me
        </label>
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  )
}
```

### Defining Nested Types

```typescript
interface Address {
  street: string
  city: string
  zipCode: string
}

interface ProfileFormData {
  username: string
  email: string
  address: Address
  tags: string[]
}

function ProfileForm() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ProfileFormData>({
    defaultValues: {
      username: '',
      email: '',
      address: {
        street: '',
        city: '',
        zipCode: ''
      },
      tags: []
    }
  })

  const onSubmit: SubmitHandler<ProfileFormData> = (data) => {
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('username', { required: true })}
        placeholder="Username"
      />

      <input
        {...register('email', { required: true })}
        placeholder="Email"
      />

      <input
        {...register('address.street', { required: true })}
        placeholder="Street"
      />

      <input
        {...register('address.city', { required: true })}
        placeholder="City"
      />

      <input
        {...register('address.zipCode', { required: true })}
        placeholder="Zip Code"
      />

      <button type="submit">Submit</button>
    </form>
  )
}
```


## 6. Type-Safe Validation with Zod

### Defining a Zod Schema

```typescript
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),
  rememberMe: z.boolean().default(false)
})

// Automatically generate types from the schema
type LoginFormData = z.infer<typeof loginSchema>
```

### Integration with React Hook Form

```typescript
function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  })

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    // data is of type LoginFormData — fully type-safe
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input type="email" {...register('email')} />
        {errors.email && <span>{errors.email.message}</span>}
      </div>

      <div>
        <input type="password" {...register('password')} />
        {errors.password && <span>{errors.password.message}</span>}
      </div>

      <div>
        <label>
          <input type="checkbox" {...register('rememberMe')} />
          Remember me
        </label>
      </div>

      <button type="submit" disabled={isSubmitting}>
        Login
      </button>
    </form>
  )
}
```

### Complex Schema Example

```typescript
const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email'),
  age: z
    .number()
    .int('Age must be an integer')
    .min(18, 'Must be 18 or older')
    .max(120, 'Invalid age'),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    zipCode: z.string().regex(/^\d{3}-\d{4}$/, 'Invalid zip code format (e.g., 123-4567)')
  }),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  website: z.string().url('Invalid URL').optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional()
})

type ProfileFormData = z.infer<typeof profileSchema>
```


## 7. Practical Example: Complete Authentication Context Implementation

### Type Definitions

```typescript
interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (name: string, email: string, password: string) => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  isAuthenticated: boolean
}
```

### Provider Implementation

```typescript
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  })

  const login = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const user = await response.json()
      setState({ user, loading: false, error: null })
    } catch (error) {
      setState({
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  const logout = () => {
    setState({ user: null, loading: false, error: null })
    // Clear cookies, etc.
  }

  const register = async (name: string, email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })

      if (!response.ok) {
        throw new Error('Registration failed')
      }

      const user = await response.json()
      setState({ user, loading: false, error: null })
    } catch (error) {
      setState({
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  const updateProfile = async (data: Partial<User>) => {
    if (!state.user) {
      throw new Error('Not authenticated')
    }

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        throw new Error('Update failed')
      }

      const updatedUser = await response.json()
      setState({ user: updatedUser, loading: false, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
      throw error
    }
  }

  const isAuthenticated = state.user !== null

  // Initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me')
        if (response.ok) {
          const user = await response.json()
          setState({ user, loading: false, error: null })
        } else {
          setState({ user: null, loading: false, error: null })
        }
      } catch (error) {
        setState({ user: null, loading: false, error: null })
      }
    }

    checkAuth()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        register,
        updateProfile,
        isAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### Usage Example

```typescript
function ProfilePage() {
  const { user, updateProfile, loading, error } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <div>Please log in</div>
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <p>Role: {user.role}</p>
      {error && <div className="error">{error}</div>}
      <button
        onClick={() => updateProfile({ name: 'New Name' })}
        disabled={loading}
      >
        Update Name
      </button>
    </div>
  )
}
```


## 8. Summary

In this chapter, you learned how to implement Context API and forms in a type-safe way.

### Key Points

1. **Context Type Definitions**:
   - Use `createContext<T | undefined>(undefined)` to enforce the requirement of a Provider
   - Provide type-safe access via custom Hooks

2. **Combining Multiple Contexts**:
   - Define Theme, Locale, Auth, etc. individually
   - Manage them collectively with a combined Provider

3. **useReducer with Context**:
   - Use useReducer for complex state management
   - Define Action types with Union Types

4. **React Hook Form**:
   - Use `useForm<T>` to define the type of form data
   - Use `SubmitHandler<T>` to ensure type safety for submit functions

5. **Validation with Zod**:
   - Automatically generate types from schema definitions (`z.infer<typeof schema>`)
   - Integrate with React Hook Form using zodResolver

### Practical Use Cases

- **Authentication management**: Manage user info and login state with AuthContext
- **Theme management**: Handle dark mode toggling with ThemeContext
- **Forms**: Type-safe validation with Zod + React Hook Form
- **Complex state**: Consolidate state management with useReducer + Context

### Next Steps

The next chapter covers practical techniques for performance optimization.

- Chapter 7: React.memo and Re-render Optimization


**Estimated learning time**: Approximately 55 minutes
**Word count**: Approximately 2,100 words

Mastering this chapter will enable you to implement Context and forms that are type-safe and highly maintainable.
