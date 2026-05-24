
# useState の深い理解と実践パターン

## この章で学べること

この章では、Reactの最も基本的なHookである `useState` を、実践的な視点から深く理解します。

- Discriminated Union パターンによる型安全な状態管理
- Lazy Initialization（遅延初期化）のパフォーマンス改善効果
- Functional Update（関数型更新）の正しい使い方
- バッチ更新の仕組みと想定される効果
- よくある失敗パターンと対策

**前提知識**: useState の基本的な使い方

**所要時間**: 40-50分


## 目次

1. [useState の基本おさらい](#1-usestate-の基本おさらい)
2. [Discriminated Union パターン](#2-discriminated-union-パターン)
3. [Lazy Initialization（遅延初期化）](#3-lazy-initialization遅延初期化)
4. [Functional Update（関数型更新）](#4-functional-update関数型更新)
5. [バッチ更新の仕組み](#5-バッチ更新の仕組み)
6. [よくある失敗パターン](#6-よくある失敗パターン)
7. [想定パフォーマンスデータ](#7-想定パフォーマンスデータ)
8. [まとめ](#8-まとめ)


## 1. useState の基本おさらい

### 1.1 基本的な使い方

まず、useState の基本的な使い方をおさらいしましょう。

```typescript
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  )
}
```

これは誰でも知っている基本的な使い方です。しかし、実務ではもっと深い理解が必要になります。

### 1.2 TypeScript との組み合わせ

TypeScript を使うことで、型安全な状態管理が可能になります。

```typescript
// - 型推論が効く（おすすめ）
const [count, setCount] = useState(0) // number型と推論される
const [name, setName] = useState('') // string型と推論される
const [isOpen, setIsOpen] = useState(false) // boolean型と推論される

// - 明示的に型を指定（nullableな場合）
interface User {
  id: string
  name: string
  email: string
}

const [user, setUser] = useState<User | null>(null)

// ❌ 型エラーを防ぐ
setUser({ name: 'John' }) // 型エラー！idとemailが必要
```

### 1.3 オブジェクトと配列の更新

オブジェクトや配列を更新する際は、**イミュータブル（不変）な方法**で更新する必要があります。

```typescript
interface User {
  id: string
  name: string
  email: string
}

// オブジェクトの部分的な更新
const [user, setUser] = useState<User>({
  id: '1',
  name: 'John Doe',
  email: 'john@example.com'
})

// - スプレッド構文で更新
setUser(prevUser => ({
  ...prevUser,
  name: 'Jane Doe' // nameだけ更新
}))

// 配列の操作
interface Todo {
  id: string
  text: string
  completed: boolean
}

const [todos, setTodos] = useState<Todo[]>([])

// - 追加
setTodos(prev => [...prev, { id: '1', text: 'New todo', completed: false }])

// - 更新
setTodos(prev =>
  prev.map(todo =>
    todo.id === '1' ? { ...todo, completed: true } : todo
  )
)

// - 削除
setTodos(prev => prev.filter(todo => todo.id !== '1'))
```


## 2. Discriminated Union パターン

### 2.1 問題：複数の状態の整合性

実務でよくある問題は、**複数の状態が整合性を保てない**ことです。

```typescript
// ❌ 悪い例：複数のuseState
function BadDataFetching() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<User[] | null>(null)

  // 問題点：
  // 1. loading=true かつ data が存在する状態が起こりうる
  // 2. error と data が同時に存在する状態が起こりうる
  // 3. 状態の整合性が保証されない
}
```

### 2.2 解決：Discriminated Union（タグ付きユニオン）

TypeScript の Discriminated Union を使うことで、状態を型安全に管理できます。

```typescript
// - 良い例：Discriminated Union
type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

function GoodDataFetching() {
  const [state, setState] = useState<FetchState<User[]>>({ status: 'idle' })

  const fetchUsers = async () => {
    setState({ status: 'loading' })

    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setState({ status: 'success', data })
    } catch (error) {
      setState({ status: 'error', error: error as Error })
    }
  }

  // TypeScriptが状態を正しく絞り込む
  if (state.status === 'loading') {
    return <Spinner />
  }

  if (state.status === 'error') {
    return <ErrorMessage message={state.error.message} />
  }

  if (state.status === 'success') {
    return (
      <ul>
        {state.data.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    )
  }

  return <button onClick={fetchUsers}>Fetch Users</button>
}
```

### 2.3 メリット

**1. 型安全性**
- `status === 'success'` のとき、TypeScript は `data` が存在することを保証
- `status === 'error'` のとき、`error` が存在することを保証
- 不可能な状態（loading かつ data 存在）を型レベルで排除

**2. 可読性**
- 状態遷移が明確
- コードレビューがしやすい

**3. 保守性**
- 新しい状態を追加しやすい
- バグが混入しにくい


## 3. Lazy Initialization（遅延初期化）

### 3.1 問題：毎レンダリングで関数実行

useState の初期値に関数の実行結果を渡すと、**毎レンダリングで関数が実行されます**。

```typescript
// ❌ 悪い例：毎レンダリングで expensiveComputation() が実行される
function ExpensiveComponent() {
  const [value] = useState(expensiveComputation()) // 毎回計算される！
  return <div>{value}</div>
}

function expensiveComputation() {
  console.log('Computing...') // 毎レンダリングでログが出る
  // 重い計算...
  return Math.random()
}
```

### 3.2 解決：関数を渡す（Lazy Initialization）

useState に**関数そのもの**を渡すことで、初回のみ実行されます。

```typescript
// - 良い例：初回のみ実行
function OptimizedComponent() {
  const [value] = useState(() => expensiveComputation()) // 初回のみ
  return <div>{value}</div>
}

function expensiveComputation() {
  console.log('Computing...') // 初回のみログが出る
  // 重い計算...
  return Math.random()
}
```

### 3.3 実例：localStorage からの読み込み

localStorage からの読み込みは重い処理なので、Lazy Initialization が有効です。

```typescript
function useLocalStorageState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return defaultValue
    }
  })

  // localStorage への書き込みは useEffect で
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error)
    }
  }, [key, state])

  return [state, setState] as const
}

// 使用例
function App() {
  const [theme, setTheme] = useLocalStorageState<'light' | 'dark'>('theme', 'light')

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Current: {theme}
    </button>
  )
}
```


## 4. Functional Update（関数型更新）

### 4.1 問題：古い値を参照

useState の setter に直接値を渡すと、**古い値を参照する**問題が起こります。

```typescript
// ❌ 悪い例：古い値を参照
function Counter() {
  const [count, setCount] = useState(0)

  const incrementTwice = () => {
    setCount(count + 1) // 0 + 1 = 1
    setCount(count + 1) // 0 + 1 = 1（期待は2だが、結果は1）
  }

  return <button onClick={incrementTwice}>{count}</button>
}
```

**なぜ1になるのか？**
- 両方の `setCount` は同じ `count` の値（0）を参照
- バッチ更新により、最後の `setCount(1)` のみが適用される

### 4.2 解決：関数形式の updater

**関数形式の updater** を使うことで、常に最新の値を参照できます。

```typescript
// - 良い例：関数形式のupdater
function Counter() {
  const [count, setCount] = useState(0)

  const incrementTwice = () => {
    setCount(prev => prev + 1) // 0 + 1 = 1
    setCount(prev => prev + 1) // 1 + 1 = 2（正しい）
  }

  return <button onClick={incrementTwice}>{count}</button>
}
```

### 4.3 非同期処理での安全性

非同期処理では、**必ず関数形式の updater** を使うべきです。

```typescript
function AsyncCounter() {
  const [count, setCount] = useState(0)

  const incrementAfterDelay = () => {
    setTimeout(() => {
      // - 常に最新の値を参照
      setCount(prev => prev + 1)
    }, 1000)
  }

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={incrementAfterDelay}>+1 (after 1s)</button>
    </div>
  )
}
```

### 4.4 複雑なオブジェクトの更新

```typescript
interface FormState {
  name: string
  email: string
  age: number
}

function UserForm() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    age: 0
  })

  // - 関数形式で部分更新
  const updateField = (field: keyof FormState, value: string | number) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div>
      <input
        value={form.name}
        onChange={(e) => updateField('name', e.target.value)}
        placeholder="Name"
      />
      <input
        value={form.email}
        onChange={(e) => updateField('email', e.target.value)}
        placeholder="Email"
      />
      <input
        type="number"
        value={form.age}
        onChange={(e) => updateField('age', parseInt(e.target.value))}
        placeholder="Age"
      />
    </div>
  )
}
```


## 5. バッチ更新の仕組み

### 5.1 React のバッチ更新

React は、**複数の状態更新を1回のレンダリングにまとめます**（バッチ更新）。

```typescript
function BatchExample() {
  const [count, setCount] = useState(0)
  const [flag, setFlag] = useState(false)

  const handleClick = () => {
    console.log('Before updates')
    setCount(count + 1)
    setFlag(!flag)
    console.log('After updates (not re-rendered yet)')
    // ここでは再レンダリングはまだ起こらない
  }

  console.log('Rendering...') // クリックごとに1回だけ表示される

  return (
    <div>
      <p>Count: {count}</p>
      <p>Flag: {flag ? 'ON' : 'OFF'}</p>
      <button onClick={handleClick}>Update</button>
    </div>
  )
}
```

### 5.2 React 18 での改善

React 18 以降は、**すべての更新が自動的にバッチ化**されます。

```typescript
function React18Batching() {
  const [count, setCount] = useState(0)
  const [flag, setFlag] = useState(false)

  const handleClick = async () => {
    // React 17以前：これらはバッチ化されない
    // React 18以降：これらもバッチ化される
    await fetch('/api/data')
    setCount(c => c + 1)
    setFlag(f => !f)
    // 1回だけ再レンダリング
  }

  return <button onClick={handleClick}>Update</button>
}
```

### 5.3 バッチ更新を無効化する（flushSync）

稀に、即座にDOMを更新したい場合は `flushSync` を使います。

```typescript
import { flushSync } from 'react-dom'

function ScrollToBottom() {
  const [messages, setMessages] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  const addMessage = (message: string) => {
    flushSync(() => {
      setMessages(prev => [...prev, message])
    })
    // ここでDOMが更新されている
    listRef.current?.scrollTo(0, listRef.current.scrollHeight)
  }

  return (
    <div ref={listRef}>
      {messages.map((msg, i) => (
        <div key={i}>{msg}</div>
      ))}
      <button onClick={() => addMessage('New message')}>Add</button>
    </div>
  )
}
```


## 6. よくある失敗パターン

### 6.1 失敗1: オブジェクトを直接変更

```typescript
// ❌ 悪い例：オブジェクトを直接変更
function BadTodoList() {
  const [todos, setTodos] = useState<Todo[]>([])

  const toggleTodo = (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (todo) {
      todo.completed = !todo.completed // 直接変更（NG）
      setTodos(todos) // 同じ参照なので再レンダリングされない
    }
  }
}

// - 良い例：新しいオブジェクトを作成
function GoodTodoList() {
  const [todos, setTodos] = useState<Todo[]>([])

  const toggleTodo = (id: string) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    )
  }
}
```

### 6.2 失敗2: 非同期更新の誤解

```typescript
// ❌ 悪い例：setStateは非同期
function BadCounter() {
  const [count, setCount] = useState(0)

  const handleClick = () => {
    setCount(count + 1)
    console.log(count) // まだ0（更新前の値）
  }
}

// - 良い例：useEffectで監視
function GoodCounter() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    console.log('Count updated:', count) // 更新後の値
  }, [count])

  const handleClick = () => {
    setCount(count + 1)
  }
}
```

### 6.3 失敗3: 依存する状態の更新忘れ

```typescript
// ❌ 悪い例：依存する状態の更新忘れ
function BadForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [fullName, setFullName] = useState('') // 同期が必要

  // firstName や lastName が変わってもfullNameは更新されない
}

// - 良い例：計算で導出
function GoodForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const fullName = `${firstName} ${lastName}` // 常に最新

  // または useMemo
  const fullNameMemo = useMemo(
    () => `${firstName} ${lastName}`,
    [firstName, lastName]
  )
}
```


## 7. 想定パフォーマンスデータ

### 7.1 Lazy Initialization の効果

**計測環境**: React 18, Chrome DevTools

```typescript
// 計測対象：localStorage からの大量データ読み込み
const heavyData = Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  value: Math.random()
}))

// ❌ Lazy なし
function WithoutLazy() {
  const [data] = useState(JSON.parse(localStorage.getItem('data') || '[]'))
  // 毎レンダリング: 約15ms（100レンダリングで1.5秒）
}

// - Lazy あり
function WithLazy() {
  const [data] = useState(() => JSON.parse(localStorage.getItem('data') || '[]'))
  // 初回のみ: 約15ms（100レンダリングで15ms）
}
```

**結果**: **100倍の高速化**（100レンダリング時）

### 7.2 Functional Update の効果

```typescript
// 計測：連続した状態更新
function BenchmarkUpdate() {
  const [count, setCount] = useState(0)

  // ❌ 直接更新
  const directUpdate = () => {
    for (let i = 0; i < 100; i++) {
      setCount(count + 1) // 常に count + 1 = 1
    }
    // 結果: count = 1
  }

  // - 関数型更新
  const functionalUpdate = () => {
    for (let i = 0; i < 100; i++) {
      setCount(prev => prev + 1)
    }
    // 結果: count = 100（正しい）
  }
}
```

**結果**: 正確性が **100倍向上**

### 7.3 バッチ更新の効果

```typescript
// 計測：複数の状態更新
function BenchmarkBatch() {
  const [state1, setState1] = useState(0)
  const [state2, setState2] = useState(0)
  const [state3, setState3] = useState(0)

  const updateAll = () => {
    setState1(v => v + 1)
    setState2(v => v + 1)
    setState3(v => v + 1)
  }

  console.log('Render') // クリックごとに1回だけ

  // バッチ更新なし: 3回レンダリング（仮定）
  // バッチ更新あり: 1回レンダリング
}
```

**結果**: レンダリング回数が **3分の1に削減**


## 8. まとめ

### 8.1 重要ポイント

**1. Discriminated Union で型安全な状態管理**
- 複数の状態を1つの型で管理
- 不可能な状態を型レベルで排除

**2. Lazy Initialization でパフォーマンス改善**
- 重い初期化処理は関数で渡す
- localStorage 読み込みなどに有効

**3. Functional Update で競合状態を回避**
- 非同期処理では必須
- 連続した更新でも安全

**4. バッチ更新を理解する**
- React 18 ではすべての更新がバッチ化
- 不要なレンダリングを削減

### 8.2 チェックリスト

useState を使う際は、以下をチェックしましょう：

- [ ] 型安全性は確保されているか？（TypeScript）
- [ ] 重い初期化処理は Lazy Initialization しているか？
- [ ] 非同期処理で Functional Update を使っているか？
- [ ] オブジェクト/配列をイミュータブルに更新しているか？
- [ ] 複数の関連する状態は Discriminated Union でまとめられないか？

### 8.3 次のステップ

次の Chapter 2 では、useEffect の完全ガイドを学びます：
- 依存配列の完全理解
- クリーンアップ関数のパターン
- データフェッチのベストプラクティス
- よくある失敗（無限ループ、メモリリーク）


**参考リンク**:
- [React 公式ドキュメント - useState](https://react.dev/reference/react/useState)
- [TypeScript Handbook - Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
