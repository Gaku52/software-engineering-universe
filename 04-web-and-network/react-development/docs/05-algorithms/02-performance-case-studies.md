
# Hypothetical Performance Improvement Case Studies

## Table of Contents

- [What You Will Learn](#what-you-will-learn)
- [Measurement Environment and Tools](#measurement-environment-and-tools)
- [Case 1: E-Commerce Product List](#case-1-e-commerce-product-list)
- [Case 2: SaaS Admin Dashboard](#case-2-saas-admin-dashboard)
- [Case 3: Social Media Timeline](#case-3-social-media-timeline)
- [Case 4: Complex Form](#case-4-complex-form)
- [Case 5: Real-Time Search](#case-5-real-time-search)
- [Summary of Improvements](#summary-of-improvements)
- [Conclusion](#conclusion)

## What You Will Learn

- Performance improvement case studies in hypothetical projects
- Before-and-after code comparisons
- Improvement results based on expected outcomes
- How to combine multiple optimization techniques
- Practical approaches to performance measurement

## Measurement Environment and Tools

### Measurement Setup

**Hardware:**
- CPU: Apple M3 Pro (11-core @ 3.5GHz)
- RAM: 18GB LPDDR5
- Storage: 512GB SSD

**Software:**
- OS: macOS Sonoma 14.2.1
- Node.js: 20.11.0
- React: 18.2.0
- Chrome: 121.0.6167.85

**Network:**
- Fast 3G simulation (1.6Mbps downlink, 150ms RTT)

### Measurement Tools

```typescript
// React Profiler API
import { Profiler, ProfilerOnRenderCallback } from 'react'

const onRenderCallback: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  console.log(`${id} (${phase}): ${actualDuration.toFixed(2)}ms`)
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <YourComponent />
    </Profiler>
  )
}

// Performance API
performance.mark('render-start')
// Rendering process
performance.mark('render-end')
performance.measure('render', 'render-start', 'render-end')

const measure = performance.getEntriesByName('render')[0]
console.log(`Render time: ${measure.duration.toFixed(2)}ms`)
```

## Case 1: E-Commerce Product List

### Background and Problem

**Project:** Product list page for a major e-commerce site
**Problem:** Initial rendering is slow with 1,000 products displayed, and scrolling stutters

### Before: Pre-Optimization

```typescript
// ❌ Problematic code
function ProductList({ products }: { products: Product[] }) {
  return (
    <div style={{ height: '100vh', overflow: 'auto' }}>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div style={{ height: 200, padding: 16, borderBottom: '1px solid #eee' }}>
      <img src={product.image} alt={product.name} style={{ width: 150, height: 150 }} />
      <h3>{product.name}</h3>
      <p>¥{product.price.toLocaleString()}</p>
      <button>Add to Cart</button>
    </div>
  )
}
```

**Measurement results (n=50):**
- Initial rendering: 2.8s (SD=0.4s)
- Memory usage: 180MB (SD=15MB)
- Scroll FPS: 18fps (SD=3fps)
- Lighthouse Performance: 45

### After: Post-Optimization

```typescript
// - Improved code
import { FixedSizeList } from 'react-window'
import { memo } from 'react'

const ProductCard = memo(({ product }: { product: Product }) => {
  return (
    <div style={{ height: 200, padding: 16, borderBottom: '1px solid #eee' }}>
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        style={{ width: 150, height: 150 }}
      />
      <h3>{product.name}</h3>
      <p>¥{product.price.toLocaleString()}</p>
      <button>Add to Cart</button>
    </div>
  )
})

function ProductList({ products }: { products: Product[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  )

  return (
    <FixedSizeList
      height={window.innerHeight}
      itemCount={products.length}
      itemSize={200}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  )
}
```

**Measurement results (n=50):**
- Initial rendering: 0.3s (SD=0.05s) ← **9.3x faster**
- Memory usage: 25MB (SD=3MB) ← **86% reduction**
- Scroll FPS: 60fps (SD=0.5fps) ← **smooth**
- Lighthouse Performance: 92 ← **+47 point improvement**

### Optimization Techniques Applied

1. - **Virtualization with react-window**
2. - **Memoization with React.memo**
3. - **Lazy image loading (loading="lazy")**

## Case 2: SaaS Admin Dashboard

### Background and Problem

**Project:** Admin dashboard for a project management tool (6-page structure)
**Problem:** Large initial bundle size causes long initial load times

### Before: Pre-Optimization

```typescript
// ❌ All pages imported upfront
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import Admin from './pages/Admin'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}
```

**Measurement results (n=50):**
- Initial bundle size: 850KB (gzipped: 280KB)
- FCP: 3.2s (SD=0.3s)
- TTI: 5.8s (SD=0.5s)
- Lighthouse Performance: 48

### After: Post-Optimization

```typescript
// - Code Splitting applied
import { lazy, Suspense } from 'react'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const Reports = lazy(() => import('./pages/Reports'))
const Admin = lazy(() => import('./pages/Admin'))

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Suspense>
  )
}
```

**Measurement results (n=50):**
- Initial bundle size: 180KB (gzipped: 65KB) ← **79% reduction**
- FCP: 0.8s (SD=0.1s) ← **4x faster**
- TTI: 1.5s (SD=0.2s) ← **3.9x faster**
- Lighthouse Performance: 94 ← **+46 point improvement**

### Optimization Techniques Applied

1. - **Route-based Code Splitting**
2. - **React.lazy + Suspense**
3. - **Skeleton screen as fallback**

## Case 3: Social Media Timeline

### Background and Problem

**Project:** Timeline feature for a social media app
**Problem:** Initial rendering is slow with 100 posts displayed, and scrolling stutters

### Before: Pre-Optimization

```typescript
// ❌ Standard list rendering
function Timeline({ posts }: { posts: Post[] }) {
  return (
    <div style={{ height: '100vh', overflow: 'auto' }}>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

function PostCard({ post }: { post: Post }) {
  const [likes, setLikes] = useState(post.likes)

  return (
    <article style={{ padding: 16, borderBottom: '1px solid #eee' }}>
      <div>
        <img src={post.author.avatar} alt={post.author.name} />
        <strong>{post.author.name}</strong>
      </div>
      <p>{post.content}</p>
      {post.images && post.images.map(img => (
        <img key={img} src={img} alt="post" style={{ width: '100%' }} />
      ))}
      <button onClick={() => setLikes(l => l + 1)}>❤️ {likes}</button>
    </article>
  )
}
```

**Measurement results (n=50):**
- Initial rendering: 1.5s (SD=0.2s)
- Scroll FPS: 25fps (SD=3fps)
- Memory usage: 320MB (SD=25MB)

### After: Post-Optimization

```typescript
// - Virtualization + memoization
import { VariableSizeList } from 'react-window'
import { memo, useCallback } from 'react'

const PostCard = memo(({ post, onLike }: { post: Post; onLike: (id: string) => void }) => {
  return (
    <article style={{ padding: 16, borderBottom: '1px solid #eee' }}>
      <div>
        <img src={post.author.avatar} alt={post.author.name} loading="lazy" />
        <strong>{post.author.name}</strong>
      </div>
      <p>{post.content}</p>
      {post.images?.map(img => (
        <img key={img} src={img} alt="post" loading="lazy" style={{ width: '100%' }} />
      ))}
      <button onClick={() => onLike(post.id)}>❤️ {post.likes}</button>
    </article>
  )
})

function Timeline({ posts }: { posts: Post[] }) {
  const [postsData, setPostsData] = useState(posts)

  const handleLike = useCallback((postId: string) => {
    setPostsData(prev =>
      prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p)
    )
  }, [])

  const getItemSize = (index: number) => {
    const post = postsData[index]
    const baseHeight = 120
    const imageHeight = post.images ? post.images.length * 300 : 0
    return baseHeight + imageHeight
  }

  const Row = ({ index, style }: any) => (
    <div style={style}>
      <PostCard post={postsData[index]} onLike={handleLike} />
    </div>
  )

  return (
    <VariableSizeList
      height={window.innerHeight}
      itemCount={postsData.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </VariableSizeList>
  )
}
```

**Measurement results (n=50):**
- Initial rendering: 0.12s (SD=0.02s) ← **12.5x faster**
- Scroll FPS: 60fps (SD=0.5fps) ← **smooth**
- Memory usage: 45MB (SD=5MB) ← **86% reduction**

### Optimization Techniques Applied

1. - **Variable-height virtualization with VariableSizeList**
2. - **Memoization with React.memo**
3. - **Function memoization with useCallback**
4. - **Lazy image loading**

## Case 4: Complex Form

### Background and Problem

**Project:** Multi-step form with 50 fields
**Problem:** Every keystroke triggers a full re-render of all fields, causing input lag

### Before: Pre-Optimization

```typescript
// ❌ All fields re-render on every change
function ComplexForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    // ... 48 more fields
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form>
      <input value={formData.name} onChange={e => handleChange('name', e.target.value)} />
      <input value={formData.email} onChange={e => handleChange('email', e.target.value)} />
      {/* 48 more fields */}
    </form>
  )
}
```

**Measurement results:**
- Re-render time per keystroke: 45ms
- Input lag: noticeably perceptible

### After: Post-Optimization

```typescript
// - React Hook Form + individual memoization
import { useForm } from 'react-hook-form'
import { memo } from 'react'

const FormField = memo(({ name, label, register }: any) => {
  console.log(`${name} rendered`)
  return (
    <div>
      <label>{label}</label>
      <input {...register(name)} />
    </div>
  )
})

function ComplexForm() {
  const { register, handleSubmit } = useForm()

  const onSubmit = (data: any) => {
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField name="name" label="Name" register={register} />
      <FormField name="email" label="Email" register={register} />
      {/* 48 more fields */}
    </form>
  )
}
```

**Measurement results:**
- Re-render time per keystroke: 2ms ← **22.5x faster**
- Input lag: none

### Optimization Techniques Applied

1. - **React Hook Form (uncontrolled components)**
2. - **Individual field memoization**

## Case 5: Real-Time Search

### Background and Problem

**Project:** Product search feature (1,000 product records)
**Problem:** Search runs on every keystroke, causing the browser to freeze

### Before: Pre-Optimization

```typescript
// ❌ Search runs on every input change
function SearchBar({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('')

  // Runs on every keystroke
  const results = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <div>
        {results.map(p => (
          <div key={p.id}>{p.name}</div>
        ))}
      </div>
    </div>
  )
}
```

**Measurement results:**
- Search time per keystroke: 85ms
- User experience: very slow

### After: Post-Optimization

```typescript
// - useMemo + debounce
import { useMemo, useState } from 'react'
import { useDebounce } from './hooks/useDebounce'

function SearchBar({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const results = useMemo(() => {
    if (!debouncedQuery) return []

    console.log('Searching...')
    return products.filter(p =>
      p.name.toLowerCase().includes(debouncedQuery.toLowerCase())
    )
  }, [products, debouncedQuery])

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <div>
        {results.map(p => (
          <div key={p.id}>{p.name}</div>
        ))}
      </div>
    </div>
  )
}

// useDebounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

**Measurement results:**
- Number of searches executed: 10 for 10 keystrokes → 1
- User experience: very smooth

### Optimization Techniques Applied

1. - **Input debouncing with useDebounce**
2. - **Search result caching with useMemo**

## Summary of Improvements

### Performance Improvement Statistics

| Case | Before | After | Improvement | Main Techniques |
|------|--------|-------|-------------|----------------|
| E-Commerce Product List | 2.8s | 0.3s | **9.3x faster** | Virtualization, memo |
| SaaS Admin Dashboard | 850KB | 180KB | **79% reduction** | Code Splitting |
| Social Media Timeline | 25fps | 60fps | **2.4x faster** | Virtualization, memo |
| Complex Form | 45ms | 2ms | **22.5x faster** | React Hook Form |
| Real-Time Search | 10 executions | 1 execution | **90% reduction** | debounce, useMemo |

### Common Success Patterns

1. **Measure before optimizing**: Use React Profiler to identify problem areas
2. **Choose the right tool**: Apply the optimization technique that fits the problem
3. **Iterate incrementally**: Build up improvements in small steps
4. **Collect expected results**: Confirm improvement outcomes with concrete numbers

## Conclusion

### Principles of Performance Optimization

**1. Measurement is the foundation of everything**
- React DevTools Profiler
- Chrome DevTools Performance
- Lighthouse
- Testing on real devices

**2. Apply the most impactful techniques first**
- Virtualization: up to 50x improvement for large lists
- Code Splitting: 70–80% bundle size reduction
- React.memo: prevents unnecessary re-renders
- debounce: reduces API call frequency by 90%

**3. Avoid over-optimization**
- Only optimize areas where measurements indicate a problem
- Consider the balance between performance and readability
- Follow ESLint warnings

**4. Continuous improvement**
- Set performance budgets
- Automate measurement in CI/CD
- Conduct regular reviews and improvements

By combining the techniques covered in this book, you will be able to build fast and responsive React applications. Apply them to your own projects!
