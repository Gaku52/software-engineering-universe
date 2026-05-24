
# Top 10 Common Mistakes and How to Fix Them

## Table of Contents

- [What You Will Learn](#what-you-will-learn)
- [Mistake 1: Infinite Loop in useEffect](#mistake-1-infinite-loop-in-useeffect)
- [Mistake 2: Memory Leaks](#mistake-2-memory-leaks)
- [Mistake 3: Stale Closure Problem](#mistake-3-stale-closure-problem)
- [Mistake 4: Unnecessary Re-renders](#mistake-4-unnecessary-re-renders)
- [Mistake 5: Overusing useCallback/useMemo](#mistake-5-overusing-usecallbackusememo)
- [Mistake 6: Asynchronous useState Updates](#mistake-6-asynchronous-usestate-updates)
- [Mistake 7: Misusing useRef](#mistake-7-misusing-useref)
- [Mistake 8: Overusing Context](#mistake-8-overusing-context)
- [Mistake 9: Missing Dependencies in Dependency Arrays](#mistake-9-missing-dependencies-in-dependency-arrays)
- [Mistake 10: Inadequate Type Definitions](#mistake-10-inadequate-type-definitions)
- [Summary](#summary)

## What You Will Learn

- 10 failure patterns that commonly occur in real React development
- The cause and impact of each mistake
- Concrete fixes and best practices
- A checklist to prevent mistakes before they happen

## Mistake 1: Infinite Loop in useEffect

### Problematic Code

```typescript
// ❌ Bad example: causes an infinite loop
function BadComponent() {
  const [count, setCount] = useState(0)
  const [data, setData] = useState([])

  useEffect(() => {
    // Runs every time data changes
    const newData = processData(data)
    setData(newData)  // This updates data → useEffect re-runs → infinite loop
  }, [data])

  return <div>{count}</div>
}
```

**Symptoms:**
- The browser freezes
- "Maximum update depth exceeded" error
- Memory usage spikes rapidly

### Correct Fix

```typescript
// ✅ Good example 1: use an empty dependency array
function GoodComponent1() {
  const [count, setCount] = useState(0)
  const [data, setData] = useState([])

  useEffect(() => {
    // Runs only on mount
    fetchData().then(newData => setData(newData))
  }, [])  // Empty dependency array

  return <div>{count}</div>
}

// ✅ Good example 2: use a functional update
function GoodComponent2() {
  const [data, setData] = useState([])

  useEffect(() => {
    // Update using prevData (no dependency on data)
    setData(prevData => processData(prevData))
  }, [])  // data excluded from dependency array

  return <div>{data.length}</div>
}

// ✅ Good example 3: remember the previous value with useRef
function GoodComponent3() {
  const [data, setData] = useState([])
  const prevDataRef = useRef(data)

  useEffect(() => {
    if (prevDataRef.current !== data) {
      prevDataRef.current = data
      // processing...
    }
  }, [data])

  return <div>{data.length}</div>
}
```

## Mistake 2: Memory Leaks

### Problematic Code

```typescript
// ❌ Bad example: no cleanup
function BadTimer() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1)
    }, 1000)
    // No cleanup!
  }, [])

  return <div>{count}</div>
}

// Problem: the timer keeps running even after the component unmounts
```

### Correct Fix

```typescript
// ✅ Good example: return a cleanup function
function GoodTimer() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1)
    }, 1000)

    // Cleanup function
    return () => {
      clearInterval(timer)
    }
  }, [])

  return <div>{count}</div>
}

// ✅ Good example: cleanup for event listeners
function GoodEventListener() {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <div>{size.width} x {size.height}</div>
}

// ✅ Good example: cancelling fetch/axios
function GoodFetch({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err)
        }
      })

    // Cleanup: cancel the fetch
    return () => {
      controller.abort()
    }
  }, [userId])

  return <div>{user?.name}</div>
}
```

## Mistake 3: Stale Closure Problem

### Problematic Code

```typescript
// ❌ Bad example: keeps referencing an old value
function BadClosure() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count)  // Always prints 0 (stale closure)
      setCount(count + 1)  // Also always results in 0+1=1
    }, 1000)

    return () => clearInterval(timer)
  }, [])  // count is not in the dependency array

  return <div>{count}</div>
}
```

### Correct Fix

```typescript
// ✅ Good example 1: include it in the dependency array
function GoodClosure1() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count)  // Prints the correct value
      setCount(count + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [count])  // Include count in the dependency array

  return <div>{count}</div>
}

// ✅ Good example 2: use a functional update (recommended)
function GoodClosure2() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => {
        console.log(c)  // Correct value
        return c + 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])  // Empty dependency array is fine

  return <div>{count}</div>
}

// ✅ Good example 3: reference the latest value with useRef
function GoodClosure3() {
  const [count, setCount] = useState(0)
  const countRef = useRef(count)

  useEffect(() => {
    countRef.current = count
  })

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(countRef.current)  // Always the latest value
      setCount(c => c + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return <div>{count}</div>
}
```

## Mistake 4: Unnecessary Re-renders

### Problematic Code

```typescript
// ❌ Bad example: creates a new object/array on every render
function BadParent() {
  const [count, setCount] = useState(0)

  // New object every render
  const config = { url: '/api', timeout: 5000 }

  // New function every render
  const handleClick = () => {
    console.log('clicked')
  }

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <ExpensiveChild config={config} onClick={handleClick} />
    </>
  )
}

const ExpensiveChild = memo(({ config, onClick }) => {
  console.log('ExpensiveChild rendered')
  // Re-renders every time count changes
  return <div onClick={onClick}>Child</div>
})
```

### Correct Fix

```typescript
// ✅ Good example: use useCallback and useMemo
function GoodParent() {
  const [count, setCount] = useState(0)

  const config = useMemo(() => ({
    url: '/api',
    timeout: 5000
  }), [])

  const handleClick = useCallback(() => {
    console.log('clicked')
  }, [])

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <ExpensiveChild config={config} onClick={handleClick} />
    </>
  )
}

// Even better: define outside the component
const DEFAULT_CONFIG = { url: '/api', timeout: 5000 }

function BetterParent() {
  const [count, setCount] = useState(0)

  const handleClick = useCallback(() => {
    console.log('clicked')
  }, [])

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <ExpensiveChild config={DEFAULT_CONFIG} onClick={handleClick} />
    </>
  )
}
```

## Mistake 5: Overusing useCallback/useMemo

### Problematic Code

```typescript
// ❌ Bad example: memoizing everything (hurts readability)
function BadOptimization({ count }: { count: number }) {
  const doubled = useMemo(() => count * 2, [count])
  const tripled = useMemo(() => count * 3, [count])
  const message = useMemo(() => `Count is ${count}`, [count])

  const handleClick = useCallback(() => {
    console.log('clicked')
  }, [])

  const styles = useMemo(() => ({
    color: 'blue',
    fontSize: 16
  }), [])

  return (
    <div style={styles} onClick={handleClick}>
      {message} - Doubled: {doubled}, Tripled: {tripled}
    </div>
  )
}
```

### Correct Fix

```typescript
// ✅ Good example: memoize only where necessary
function GoodOptimization({ count }: { count: number }) {
  // Simple calculations do not need memoization
  const doubled = count * 2
  const tripled = count * 3
  const message = `Count is ${count}`

  // Only memoize when passing to a memoized component
  const handleClick = () => console.log('clicked')

  return (
    <div style={{ color: 'blue', fontSize: 16 }} onClick={handleClick}>
      {message} - Doubled: {doubled}, Tripled: {tripled}
    </div>
  )
}
```

## Mistake 6: Asynchronous useState Updates

### Problematic Code

```typescript
// ❌ Bad example: reading the result of setState immediately
function BadCounter() {
  const [count, setCount] = useState(0)

  const increment = () => {
    setCount(count + 1)
    console.log(count)  // Still shows the old value (0)

    setCount(count + 1)  // Also becomes 0+1=1
    setCount(count + 1)  // Also becomes 0+1=1
    // Result: count becomes 1 (expected: 3)
  }

  return <button onClick={increment}>{count}</button>
}
```

### Correct Fix

```typescript
// ✅ Good example: use functional updates
function GoodCounter() {
  const [count, setCount] = useState(0)

  const increment = () => {
    setCount(c => c + 1)  // 0 + 1 = 1
    setCount(c => c + 1)  // 1 + 1 = 2
    setCount(c => c + 1)  // 2 + 1 = 3
    // Result: count becomes 3
  }

  return <button onClick={increment}>{count}</button>
}

// ✅ Good example: use useEffect to access the updated value
function GoodWithEffect() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    console.log('Count updated:', count)  // Updated value
  }, [count])

  const increment = () => {
    setCount(count + 1)
  }

  return <button onClick={increment}>{count}</button>
}
```

## Mistake 7: Misusing useRef

### Problematic Code

```typescript
// ❌ Bad example: expecting a re-render when useRef changes
function BadRef() {
  const countRef = useRef(0)

  const increment = () => {
    countRef.current += 1
    // No re-render triggered!
  }

  return <button onClick={increment}>{countRef.current}</button>
}
```

### Correct Fix

```typescript
// ✅ Good example: use useState (when a re-render is needed)
function GoodState() {
  const [count, setCount] = useState(0)

  const increment = () => {
    setCount(c => c + 1)  // Triggers a re-render
  }

  return <button onClick={increment}>{count}</button>
}

// ✅ Good example: correct use of useRef (DOM reference)
function GoodRefUsage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const focusInput = () => {
    inputRef.current?.focus()
  }

  return (
    <>
      <input ref={inputRef} />
      <button onClick={focusInput}>Focus</button>
    </>
  )
}
```

## Mistake 8: Overusing Context

### Problematic Code

```typescript
// ❌ Bad example: putting frequently changing values in Context
const AppContext = createContext<{
  mousePosition: { x: number; y: number }
  userId: string
  theme: string
} | undefined>(undefined)

function BadContextProvider({ children }: { children: React.ReactNode }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [userId, setUserId] = useState('')
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
      // All consumers re-render!
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <AppContext.Provider value={{ mousePosition, userId, theme }}>
      {children}
    </AppContext.Provider>
  )
}
```

### Correct Fix

```typescript
// ✅ Good example: split Context into separate providers
const ThemeContext = createContext<string>('light')
const UserContext = createContext<string>('')

function GoodContextProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState('')
  const [theme, setTheme] = useState('light')

  // mousePosition is not put in Context (changes too frequently)
  // Use a direct event hook in components that need it

  return (
    <UserContext.Provider value={userId}>
      <ThemeContext.Provider value={theme}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  )
}
```

## Mistake 9: Missing Dependencies in Dependency Arrays

### Problematic Code

```typescript
// ❌ Bad example: userId is missing from the dependency array
function BadDeps({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUser(userId).then(data => setUser(data))
    // Does not re-run when userId changes
  }, [])  // Forgot to add userId

  return <div>{user?.name}</div>
}
```

### Correct Fix

```typescript
// ✅ Good example: include all dependencies
function GoodDeps({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchUser(userId, { signal: controller.signal })
      .then(data => setUser(data))
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err)
        }
      })

    return () => controller.abort()
  }, [userId])  // Include userId in the dependency array

  return <div>{user?.name}</div>
}

// Follow ESLint warnings
// It is recommended to install eslint-plugin-react-hooks
```

## Mistake 10: Inadequate Type Definitions

### Problematic Code

```typescript
// ❌ Bad example: overusing the any type
function BadTypes({ data }: { data: any }) {
  const [items, setItems] = useState<any>([])

  const handleClick = (item: any) => {
    // No type checking
    console.log(item.name)  // Potential runtime error
  }

  return (
    <div>
      {items.map((item: any) => (
        <div key={item.id} onClick={() => handleClick(item)}>
          {item.name}
        </div>
      ))}
    </div>
  )
}
```

### Correct Fix

```typescript
// ✅ Good example: proper type definitions
interface Item {
  id: string
  name: string
  description?: string
}

interface Props {
  data: Item[]
}

function GoodTypes({ data }: Props) {
  const [items, setItems] = useState<Item[]>([])

  const handleClick = (item: Item) => {
    console.log(item.name)  // Type-safe
  }

  useEffect(() => {
    setItems(data)
  }, [data])

  return (
    <div>
      {items.map(item => (
        <div key={item.id} onClick={() => handleClick(item)}>
          {item.name}
        </div>
      ))}
    </div>
  )
}
```

## Summary

### Checklist to Prevent Mistakes

**useEffect-related:**
- [ ] Is the dependency array accurate? (check ESLint warnings)
- [ ] Is there any risk of an infinite loop?
- [ ] Are you returning a cleanup function?
- [ ] Are there any stale closure issues?

**Performance-related:**
- [ ] Are there any unnecessary re-renders?
- [ ] Are you over-memoizing?
- [ ] Are objects/arrays being created on every render?

**useState-related:**
- [ ] Are you using functional updates where appropriate?
- [ ] Do you understand asynchronous updates?
- [ ] Are you correctly choosing between useState and useRef?

**Context-related:**
- [ ] Are frequently changing values being put into Context?
- [ ] Is Context split appropriately?

**Type definition-related:**
- [ ] Are you using the any type?
- [ ] Are Props type definitions appropriate?
- [ ] Is type inference for Hooks correct?

### Mindset for Development

1. **Do not ignore ESLint warnings**
2. **Verify re-renders with DevTools**
3. **Leverage TypeScript to ensure type safety**
4. **Never forget cleanup functions**
5. **Measure before optimizing**

By understanding these common mistakes, you will be able to build more robust and maintainable React applications.
