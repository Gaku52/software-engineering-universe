
# カスタムフック設計パターン

## この章で学べること

この章では、再利用可能なカスタムフックの設計パターンを学びます。

- カスタムフックの設計原則
- useFetch の完全実装（エラーハンドリング、キャンセル処理）
- useLocalStorage の型安全な実装
- useDebounce / useThrottle の実装と使い分け
- useToggle、useAsync などの便利なヘルパー
- カスタムフックのテスト戦略
- よくある失敗：過剰な抽象化

**前提知識**: useState、useEffect、useRef の基本

**所要時間**: 60-70分


## 目次

1. [カスタムフックの設計原則](#1-カスタムフックの設計原則)
2. [useFetch の完全実装](#2-usefetch-の完全実装)
3. [useLocalStorage の実装](#3-uselocalstorage-の実装)
4. [useDebounce / useThrottle](#4-usedebounce--usethrottle)
5. [useToggle と useAsync](#5-usetoggle-と-useasync)
6. [カスタムフックのテスト](#6-カスタムフックのテスト)
7. [よくある失敗パターン](#7-よくある失敗パターン)
8. [まとめ](#8-まとめ)


## 1. カスタムフックの設計原則

### 1.1 カスタムフックとは

カスタムフックは、**ロジックを再利用可能な関数**として抽出したものです。

**特徴**:
- 関数名が `use` で始まる
- 他のHooks（useState、useEffectなど）を使える
- コンポーネント間でロジックを共有できる

### 1.2 設計原則

**原則1: 単一責任の原則**

1つのカスタムフックは、1つの責任のみを持つべきです。

```typescript
// ❌ 悪い例：複数の責任
function useUserAndPosts(userId: string) {
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  // ユーザー情報と投稿を両方取得（責任が2つ）
}

// - 良い例：責任を分離
function useUser(userId: string) {
  // ユーザー情報のみ
}

function usePosts(userId: string) {
  // 投稿のみ
}
```

**原則2: 型安全性**

TypeScript のジェネリクスを活用して、型安全なフックを作りましょう。

```typescript
// - 型安全なカスタムフック
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  // ...
  return data // T | null型
}

// 使用時に型を指定
const { data } = useFetch<User>('/api/user')
// data は User | null 型
```

**原則3: 一貫性のあるAPI**

他のフックと同じようなAPIを提供しましょう。

```typescript
// - useState と同じパターン
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)
  // ...
  return [value, setValue] as const // useStateと同じ
}

// 使用例
const [theme, setTheme] = useLocalStorage('theme', 'light')
```

### 1.3 命名規則

**パターン1: use + 動詞**
- `useFetch` - データをフェッチする
- `useToggle` - トグルする
- `useDebounce` - デバウンスする

**パターン2: use + 名詞**
- `useUser` - ユーザー情報を取得
- `useAuth` - 認証情報を取得


## 2. useFetch の完全実装

### 2.1 基本実装

```typescript
type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

interface UseFetchOptions {
  immediate?: boolean // 即座にフェッチするか
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

### 2.2 使用例

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

### 2.3 AbortController 対応版

```typescript
function useFetch<T>(url: string, options: UseFetchOptions = {}) {
  const { immediate = true } = options
  const [state, setState] = useState<FetchState<T>>({ status: 'idle' })
  const abortControllerRef = useRef<AbortController>()

  const execute = useCallback(async () => {
    // 前回のリクエストをキャンセル
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
        // キャンセルされた場合は無視
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
      // クリーンアップ：進行中のリクエストをキャンセル
      abortControllerRef.current?.abort()
    }
  }, [immediate, execute])

  return { ...state, refetch: execute }
}
```


## 3. useLocalStorage の実装

### 3.1 完全実装

```typescript
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // 初期値の取得（Lazy Initialization）
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

  // 値の設定
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

  // 値の削除
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

### 3.2 使用例

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

### 3.3 Storage イベント対応版

複数タブ間での同期が必要な場合：

```typescript
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // ... 初期化コード
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    // ... 設定コード
  }, [key, storedValue])

  // Storage イベントをリスン（他のタブでの変更を検知）
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
    // ... 削除コード
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}
```


## 4. useDebounce / useThrottle

### 4.1 useDebounce の実装

**デバウンス**: 連続した入力の最後の値のみを使う

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

**使用例：リアルタイム検索**

```typescript
function SearchInput() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    if (debouncedSearchTerm) {
      // API呼び出しは500ms後のみ（入力中は呼ばれない）
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

### 4.2 useThrottle の実装

**スロットル**: 一定間隔でのみ値を更新

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

**使用例：スクロール位置の追跡**

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

  // 100msごとにのみ更新される
  return <div>Scroll position: {throttledScrollY}px</div>
}
```

### 4.3 使い分け

| | useDebounce | useThrottle |
|---|---|---|
| **タイミング** | 入力が止まった後 | 一定間隔ごと |
| **使用例** | 検索入力、フォームバリデーション | スクロール、リサイズ |
| **API呼び出し** | 最後の1回のみ | 一定間隔で複数回 |


## 5. useToggle と useAsync

### 5.1 useToggle の実装

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

**使用例**

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

### 5.2 useAsync の実装

汎用的な非同期処理フック：

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

**使用例**

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


## 6. カスタムフックのテスト

### 6.1 React Testing Library の renderHook

```typescript
import { renderHook, act } from '@testing-library/react'

describe('useToggle', () => {
  it('should toggle value', () => {
    const { result } = renderHook(() => useToggle(false))

    // 初期値
    expect(result.current[0]).toBe(false)

    // トグル
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

### 6.2 useLocalStorage のテスト

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

### 6.3 useFetch のテスト（MSW使用）

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


## 7. よくある失敗パターン

### 7.1 失敗1: 過剰な抽象化

```typescript
// ❌ 悪い例：複雑すぎる
function useEverything<T, U, V>(
  config: {
    fetchUrl?: string
    storageKey?: string
    debounceDelay?: number
    initialValue?: T
    transform?: (data: U) => V
  }
) {
  // 100行以上のコード...
  // 何でもできるが、使いにくい
}

// - 良い例：シンプルなフックを組み合わせる
function MyComponent() {
  const [value, setValue] = useLocalStorage('key', 'default')
  const debouncedValue = useDebounce(value, 500)
  const { data } = useFetch(`/api/search?q=${debouncedValue}`)
}
```

### 7.2 失敗2: 依存配列の誤り

```typescript
// ❌ 悪い例
function useBadFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)

  const fetchData = () => {
    fetch(url).then(res => res.json()).then(setData)
  }

  useEffect(() => {
    fetchData() // fetchData は毎レンダリングで新しい関数
  }, [fetchData]) // 無限ループ
}

// - 良い例
function useGoodFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    fetch(url).then(res => res.json()).then(setData)
  }, [url]) // url のみ依存
}
```

### 7.3 失敗3: クリーンアップの欠落

```typescript
// ❌ 悪い例：メモリリーク
function useBadInterval(callback: () => void, delay: number) {
  useEffect(() => {
    const id = setInterval(callback, delay)
    // クリーンアップなし
  }, [callback, delay])
}

// - 良い例
function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    const tick = () => savedCallback.current()
    const id = setInterval(tick, delay)

    return () => {
      clearInterval(id) // クリーンアップ
    }
  }, [delay])
}
```


## 8. まとめ

### 8.1 重要ポイント

**1. 設計原則を守る**
- 単一責任の原則
- 型安全性
- 一貫性のあるAPI

**2. よく使うパターンを習得**
- useFetch: データフェッチ
- useLocalStorage: 永続化
- useDebounce/useThrottle: パフォーマンス最適化
- useToggle: UI状態管理

**3. テストを書く**
- renderHook を使う
- MSW でAPIをモック
- エッジケースをテスト

**4. 過剰な抽象化を避ける**
- シンプルなフックを組み合わせる
- 複雑すぎるフックは分割

### 8.2 チェックリスト

カスタムフックを作る際は、以下をチェックしましょう：

- [ ] 関数名は `use` で始まっているか？
- [ ] 単一責任の原則を守っているか？
- [ ] TypeScript のジェネリクスを活用しているか？
- [ ] 依存配列は正しく設定されているか？
- [ ] クリーンアップ関数は必要ないか？
- [ ] テストは書いたか？
- [ ] 他のフックと一貫性のあるAPIか？

### 8.3 次のステップ

次の Chapter 4 では、TypeScript を使ったコンポーネントの型定義を学びます：
- React.FC vs 関数宣言
- Props の型定義パターン
- Children の型安全な扱い
- forwardRef の型定義


**参考リンク**:
- [React 公式ドキュメント - Building Your Own Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [React Testing Library - renderHook](https://testing-library.com/docs/react-testing-library/api/#renderhook)
- [MSW (Mock Service Worker)](https://mswjs.io/)
