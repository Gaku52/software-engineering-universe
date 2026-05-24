# Custom Hook Design Patterns

## What You Will Learn

In this chapter, you will learn design patterns for building reusable custom Hooks.

- Design principles for custom Hooks
- Complete implementation of useFetch (error handling, cancellation)
- Type-safe implementation of useLocalStorage
- Implementing useDebounce / useThrottle and when to use each
- Useful helpers like useToggle and useAsync
- Testing strategies for custom Hooks
- A common pitfall: over-abstraction

**Prerequisites**: Basics of useState, useEffect, and useRef

**Estimated time**: 60–70 minutes


## Table of Contents

1. [Custom Hook Design Principles](#1-custom-hook-design-principles)
2. [Complete useFetch Implementation](#2-complete-usefetch-implementation)
3. [useLocalStorage Implementation](#3-uselocalstorage-implementation)
4. [useDebounce / useThrottle](#4-usedebounce--usethrottle)
5. [useToggle and useAsync](#5-usetoggle-and-useasync)
6. [Testing Custom Hooks](#6-testing-custom-hooks)
7. [Common Failure Patterns](#7-common-failure-patterns)
8. [Summary](#8-summary)


## 1. Custom Hook Design Principles

### 1.1 What Is a Custom Hook?

A custom Hook is logic extracted into a **reusable function**.

**Characteristics**:
- Function name starts with `use`
- Can use other Hooks (useState, useEffect, etc.)
- Shares logic across components

### 1.2 Design Principles

**Principle 1: Single Responsibility**

Each custom Hook should have exactly one responsibility.

```typescript
// ❌ Bad: multiple responsibilities
function useUserAndPosts(userId: string) {
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  // Fetches both user info and posts (two responsibilities)
}

// - Good: separate responsibilities
function useUser(userId: string) {
  // User info only
}

function usePosts(userId: string) {
  // Posts only
}
```

**Principle 2: Type Safety**

Use TypeScript generics to build type-safe Hooks.

```typescript
// - Type-safe custom Hook
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  // ...
  return data // T | null type
}

// Specify the type at the call site
const { data } = useFetch<User>('/api/user')
// data is User | null type
```

**Principle 3: Consistent API**

Provide an API that feels familiar alongside other Hooks.

```typescript
// - Same pattern as useState
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)
  // ...
  return [value, setValue] as const // same as useState
}

// Usage
const [theme, setTheme] = useLocalStorage('theme', 'light')
```

### 1.3 Naming Conventions

**Pattern 1: use + verb**
- `useFetch` — fetches data
- `useToggle` — toggles a value
- `useDebounce` — debounces a value

**Pattern 2: use + noun**
- `useUser` — gets user info
- `useAuth` — gets authentication info


## 2. Complete useFetch Implementation

### 2.1 Basic Implementation

```typescript
type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

interface UseFetchOptions {
  immediate?: boolean // whether to fetch immediately
}

function useFetch<T>(
  url: string,
  options: UseFetchOptions = {}
) {
  const { immediate = true } = options
  const [state, setState] = useState<FetchState<T>>({ status: 'idle' })

  const execute = useCallback(async () => {
    setState({ status: 'loading' })

    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setState({ status: 'success', data })
      return data
    } catch (error) {
      const err = error as Error
      setState({ status: 'error', error: err })
      throw err
    }
  }, [url])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [immediate, execute])

  const refetch = execute

  return { ...state, refetch }
}
```

### 2.2 Usage Example

```typescript
interface User {
  id: string
  name: string
  email: string
}

function UserList() {
  const { status, data, error, refetch } = useFetch<User[]>('/api/users')

  if (status === 'loading') return <Spinner />
  if (status === 'error') return <ErrorMessage error={error} />
  if (status === 'success') {
    return (
      <>
        <button onClick={refetch}>Refresh</button>
        <ul>
          {data.map(user => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      </>
    )
  }
  return null
}
```

### 2.3 Version with AbortController

```typescript
function useFetch<T>(url: string, options: UseFetchOptions = {}) {
  const { immediate = true } = options
  const [state, setState] = useState<FetchState<T>>({ status: 'idle' })
  const abortControllerRef = useRef<AbortController>()

  const execute = useCallback(async () => {
    // Cancel the previous request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    setState({ status: 'loading' })

    try {
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setState({ status: 'success', data })
      return data
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Ignore cancelled requests
        return
      }
      const err = error as Error
      setState({ status: 'error', error: err })
      throw err
    }
  }, [url])

  useEffect(() => {
    if (immediate) {
      execute()
    }

    return () => {
      // Cleanup: cancel any in-flight request
      abortControllerRef.current?.abort()
    }
  }, [immediate, execute])

  return { ...state, refetch: execute }
}
```


## 3. useLocalStorage Implementation

### 3.1 Complete Implementation

```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Read initial value (Lazy Initialization)
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Set value
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  // Remove value
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}
```

### 3.2 Usage Example

```typescript
interface Theme {
  mode: 'light' | 'dark'
  primaryColor: string
}

function ThemeSettings() {
  const [theme, setTheme, resetTheme] = useLocalStorage<Theme>('theme', {
    mode: 'light',
    primaryColor: '#3b82f6'
  })

  const toggleMode = () => {
    setTheme(prev => ({
      ...prev,
      mode: prev.mode === 'light' ? 'dark' : 'light'
    }))
  }

  return (
    <div>
      <p>Current mode: {theme.mode}</p>
      <p>Primary color: {theme.primaryColor}</p>
      <button onClick={toggleMode}>Toggle Mode</button>
      <button onClick={resetTheme}>Reset to Default</button>
    </div>
  )
}
```

### 3.3 Version with Storage Event Support

When you need to sync state across multiple browser tabs:

```typescript
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // ... initialization code
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    // ... set code
  }, [key, storedValue])

  // Listen for storage events (detect changes from other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch (error) {
          console.error('Error parsing storage event:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key])

  const removeValue = useCallback(() => {
    // ... remove code
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}
```


## 4. useDebounce / useThrottle

### 4.1 useDebounce Implementation

**Debounce**: Use only the last value from a rapid sequence of inputs

```typescript
function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
```

**Usage: real-time search**

```typescript
function SearchInput() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    if (debouncedSearchTerm) {
      // API call only fires after 500ms (not while the user is typing)
      fetch(`/api/search?q=${debouncedSearchTerm}`)
        .then(res => res.json())
        .then(setResults)
    } else {
      setResults([])
    }
  }, [debouncedSearchTerm])

  return (
    <>
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      <ul>
        {results.map(result => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </>
  )
}
```

### 4.2 useThrottle Implementation

**Throttle**: Update the value only at a fixed interval

```typescript
function useThrottle<T>(value: T, delay: number = 500): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastRan = useRef(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, delay - (Date.now() - lastRan.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return throttledValue
}
```

**Usage: scroll position tracking**

```typescript
function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0)
  const throttledScrollY = useThrottle(scrollY, 100)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Updates only every 100ms
  return <div>Scroll position: {throttledScrollY}px</div>
}
```

### 4.3 When to Use Each

| | useDebounce | useThrottle |
|---|---|---|
| **Timing** | After input stops | At fixed intervals |
| **Use cases** | Search input, form validation | Scroll, resize |
| **API calls** | Only the final one | Multiple, at regular intervals |


## 5. useToggle and useAsync

### 5.1 useToggle Implementation

```typescript
function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => {
    setValue(prev => !prev)
  }, [])

  const setExplicit = useCallback((newValue: boolean) => {
    setValue(newValue)
  }, [])

  return [value, toggle, setExplicit]
}
```

**Usage**

```typescript
function Modal() {
  const [isOpen, toggle, setIsOpen] = useToggle(false)

  return (
    <>
      <button onClick={toggle}>Toggle Modal</button>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      {isOpen && (
        <div className="modal">
          <p>Modal Content</p>
          <button onClick={toggle}>Close</button>
        </div>
      )}
    </>
  )
}
```

### 5.2 useAsync Implementation

A general-purpose async operation Hook:

```typescript
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true
) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' })

  const execute = useCallback(async () => {
    setState({ status: 'loading' })

    try {
      const data = await asyncFunction()
      setState({ status: 'success', data })
      return data
    } catch (error) {
      setState({ status: 'error', error: error as Error })
      throw error
    }
  }, [asyncFunction])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [immediate, execute])

  return { ...state, execute }
}
```

**Usage**

```typescript
function UserProfile({ userId }: { userId: string }) {
  const fetchUser = useCallback(
    () => fetch(`/api/users/${userId}`).then(res => res.json()),
    [userId]
  )

  const { status, data: user, error, execute } = useAsync<User>(fetchUser)

  if (status === 'loading') return <Spinner />
  if (status === 'error') return <ErrorMessage error={error} />
  if (status === 'success') {
    return (
      <div>
        <h1>{user.name}</h1>
        <button onClick={execute}>Refresh</button>
      </div>
    )
  }
  return null
}
```


## 6. Testing Custom Hooks

### 6.1 renderHook from React Testing Library

```typescript
import { renderHook, act } from '@testing-library/react'

describe('useToggle', () => {
  it('should toggle value', () => {
    const { result } = renderHook(() => useToggle(false))

    // Initial value
    expect(result.current[0]).toBe(false)

    // Toggle
    act(() => {
      result.current[1]()
    })

    expect(result.current[0]).toBe(true)
  })

  it('should set explicit value', () => {
    const { result } = renderHook(() => useToggle(false))

    act(() => {
      result.current[2](true)
    })

    expect(result.current[0]).toBe(true)
  })
})
```

### 6.2 Testing useLocalStorage

```typescript
describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should read from localStorage', () => {
    localStorage.setItem('test', JSON.stringify('value'))

    const { result } = renderHook(() =>
      useLocalStorage('test', 'default')
    )

    expect(result.current[0]).toBe('value')
  })

  it('should write to localStorage', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test', 'default')
    )

    act(() => {
      result.current[1]('new value')
    })

    expect(localStorage.getItem('test')).toBe(JSON.stringify('new value'))
  })
})
```

### 6.3 Testing useFetch with MSW

```typescript
import { setupServer } from 'msw/node'
import { rest } from 'msw'

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json([{ id: '1', name: 'John' }]))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useFetch', () => {
  it('should fetch data successfully', async () => {
    const { result, waitFor } = renderHook(() =>
      useFetch<User[]>('/api/users')
    )

    expect(result.current.status).toBe('loading')

    await waitFor(() => result.current.status === 'success')

    expect(result.current.data).toEqual([{ id: '1', name: 'John' }])
  })
})
```


## 7. Common Failure Patterns

### 7.1 Mistake 1: Over-abstraction

```typescript
// ❌ Bad: too complex
function useEverything<T, U, V>(
  config: {
    fetchUrl?: string
    storageKey?: string
    debounceDelay?: number
    initialValue?: T
    transform?: (data: U) => V
  }
) {
  // 100+ lines of code...
  // Can do anything, but hard to use
}

// - Good: compose simple Hooks
function MyComponent() {
  const [value, setValue] = useLocalStorage('key', 'default')
  const debouncedValue = useDebounce(value, 500)
  const { data } = useFetch(`/api/search?q=${debouncedValue}`)
}
```

### 7.2 Mistake 2: Incorrect Dependency Array

```typescript
// ❌ Bad
function useBadFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)

  const fetchData = () => {
    fetch(url).then(res => res.json()).then(setData)
  }

  useEffect(() => {
    fetchData() // fetchData is a new function every render
  }, [fetchData]) // infinite loop
}

// - Good
function useGoodFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    fetch(url).then(res => res.json()).then(setData)
  }, [url]) // depends only on url
}
```

### 7.3 Mistake 3: Missing Cleanup

```typescript
// ❌ Bad: memory leak
function useBadInterval(callback: () => void, delay: number) {
  useEffect(() => {
    const id = setInterval(callback, delay)
    // No cleanup
  }, [callback, delay])
}

// - Good
function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    const tick = () => savedCallback.current()
    const id = setInterval(tick, delay)

    return () => {
      clearInterval(id) // cleanup
    }
  }, [delay])
}
```


## 8. Summary

### 8.1 Key Takeaways

**1. Follow design principles**
- Single responsibility
- Type safety
- Consistent API

**2. Master commonly used patterns**
- useFetch: data fetching
- useLocalStorage: persistence
- useDebounce / useThrottle: performance optimization
- useToggle: UI state management

**3. Write tests**
- Use renderHook
- Mock APIs with MSW
- Test edge cases

**4. Avoid over-abstraction**
- Compose simple Hooks
- Split overly complex Hooks

### 8.2 Checklist

When creating a custom Hook, check the following:

- [ ] Does the function name start with `use`?
- [ ] Does it follow the single responsibility principle?
- [ ] Does it make use of TypeScript generics?
- [ ] Is the dependency array configured correctly?
- [ ] Is a cleanup function needed?
- [ ] Have you written tests?
- [ ] Does it have a consistent API with other Hooks?

### 8.3 Next Steps

In the next chapter, you will learn about component type definitions with TypeScript:
- React.FC vs function declarations
- Props type definition patterns
- Type-safe handling of children
- Type definitions for forwardRef


**References**:
- [React Official Docs - Building Your Own Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [React Testing Library - renderHook](https://testing-library.com/docs/react-testing-library/api/#renderhook)
