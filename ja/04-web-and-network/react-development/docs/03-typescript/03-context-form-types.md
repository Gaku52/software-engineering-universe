
# Context と Form の型安全な実装

## この章で学べること

この章では、Context API とフォームの型安全な実装方法を学びます。

- Context の型定義ベストプラクティス
- カスタムフックによる Context の安全な使用
- 複数の Context の組み合わせパターン
- useReducer と Context の組み合わせ
- React Hook Form との統合
- Zod を使った型安全なバリデーション
- 実践例：認証・テーマ・ロケール管理

**前提知識**: Context API、React Hook Form の基礎

**対応バージョン**: React 19.x / React Hook Form v7（`react-hook-form`） / Zod v4（`zod`） / `@hookform/resolvers` v5

**所要時間**: 50-60分


## 目次

1. [Context の基本的な型定義](#1-context-の基本的な型定義)
2. [カスタムフックで Context を安全に使う](#2-カスタムフックで-context-を安全に使う)
3. [複数の Context の組み合わせ](#3-複数の-context-の組み合わせ)
4. [useReducer と Context の組み合わせ](#4-usereducer-と-context-の組み合わせ)
5. [React Hook Form の型定義](#5-react-hook-form-の型定義)
6. [Zod を使った型安全なバリデーション](#6-zod-を使った型安全なバリデーション)
7. [実践例：認証 Context の完全実装](#7-実践例認証-context-の完全実装)
8. [まとめ](#8-まとめ)


## Context APIの前に: コンポーネント合成を検討する

Context APIは強力ですが、**全てのProps drilling問題にContext APIが最適とは限りません**。

まず検討すべきは**コンポーネント合成（Composition）**です。

```typescript
// ❌ Props drilling: themeを中間コンポーネントが素通りさせている
function App() {
  const theme = useThemeValue()
  return <Layout theme={theme} />  // Layoutはthemeを使わない
}
function Layout({ theme }: { theme: Theme }) {
  return <Sidebar theme={theme} />  // Sidebarもthemeを使わない
}
function Sidebar({ theme }: { theme: Theme }) {
  return <Avatar theme={theme} />  // Avatarだけがthemeを使う
}

// - コンポーネント合成: childrenで直接渡す
function App() {
  const theme = useThemeValue()
  return (
    <Layout>
      <Sidebar>
        <Avatar theme={theme} />  {/* 直接渡す */}
      </Sidebar>
    </Layout>
  )
}
```

**Context APIが適切な場面:**
- テーマ（ダーク/ライト）: アプリ全体の多くのコンポーネントが参照する
- 認証情報: どの画面でもログイン状態を確認する
- ロケール/言語設定: 全てのテキストに影響する

**コンポーネント合成が適切な場面:**
- 特定の子コンポーネントだけがデータを必要とする
- Props drillingが2-3階層程度で、中間コンポーネントが不要にPropsを受け渡している

この使い分けを理解した上で、以下ではContext APIの型安全な実装を学びます。


## 1. Context の基本的な型定義

### 基本パターン

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

// undefined を許可することで、Provider 外での使用を検出可能に
const AuthContext = createContext<AuthContextValue | undefined>(undefined)
```

**なぜ `undefined` を含めるのか？**

```typescript
// ❌ デフォルト値を設定すると、Provider なしでも使えてしまう
const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false
})

// - undefined にすることで、Provider が必要であることを強制
const AuthContext = createContext<AuthContextValue | undefined>(undefined)
```

### Provider の実装

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
    // ローカルストレージやクッキーのクリアなど
  }

  const isAuthenticated = user !== null

  // 初期ロード時のユーザー情報取得
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


## 2. カスタムフックで Context を安全に使う

### 基本パターン

```typescript
function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
```

**メリット**:
1. Provider 外での使用を防止
2. `undefined` チェックを一箇所に集約
3. 使用側で型アサーションが不要

### 使用例

```typescript
function UserProfile() {
  // context は AuthContextValue 型（undefined ではない）
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


## 3. 複数の Context の組み合わせ

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
    // localStorage から読み込み
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    // localStorage に保存
    localStorage.setItem('theme', theme)
    // ドキュメントに適用
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

### 統合 Provider

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

// 使用例
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


## 4. useReducer と Context の組み合わせ

### State と Action の型定義

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

### Reducer の実装

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

### 使用例

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


## 5. React Hook Form の型定義

### 基本的な使用方法

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
      // ログイン成功処理
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

### ネストした型の定義

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


## 6. Zod を使った型安全なバリデーション

### Zod スキーマの定義

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

// スキーマから型を自動生成
type LoginFormData = z.infer<typeof loginSchema>
```

### React Hook Form との統合

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
    // data は LoginFormData 型で型安全
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

### 複雑なスキーマ

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


## 7. 実践例：認証 Context の完全実装

### 型定義

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

### Provider 実装

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
    // クッキー削除など
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

  // 初期ロード
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

### 使用例

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


## 8. まとめ

この章では、Context API とフォームの型安全な実装を学びました。

### 重要ポイント

1. **Context の型定義**:
   - `createContext<T | undefined>(undefined)` で Provider の必要性を強制
   - カスタムフックで型安全なアクセスを提供

2. **複数 Context の組み合わせ**:
   - Theme、Locale、Auth などを個別に定義
   - 統合 Provider で一括管理

3. **useReducer と Context**:
   - 複雑な状態管理は useReducer を活用
   - Action の型を Union Types で定義

4. **React Hook Form**:
   - `useForm<T>` でフォームデータの型を定義
   - `SubmitHandler<T>` で submit 関数の型安全性を確保

5. **Zod でバリデーション**:
   - スキーマ定義から型を自動生成 (`z.infer<typeof schema>`)
   - zodResolver で React Hook Form と統合

### 実践での使い所

- **認証管理**: AuthContext でユーザー情報とログイン状態を管理
- **テーマ管理**: ThemeContext でダークモード切り替え
- **フォーム**: Zod + React Hook Form で型安全なバリデーション
- **複雑な状態**: useReducer + Context で状態管理を集約

### Next Steps

次の章からは、パフォーマンス最適化の実践的なテクニックを学びます。

- Chapter 7: React.memo と再レンダリング最適化


**執筆時間**: 約55分で習得可能
**文字数**: 約2,100語

この章をマスターすることで、型安全で保守性の高い Context とフォーム実装ができるようになります。
