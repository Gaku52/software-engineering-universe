
# よくある失敗事例10選と対策

## 目次

- [この章で学べること](#この章で学べること)
- [失敗事例1: useEffectの無限ループ](#失敗事例1-useeffectの無限ループ)
- [失敗事例2: メモリリーク](#失敗事例2-メモリリーク)
- [失敗事例3: 古いクロージャ問題](#失敗事例3-古いクロージャ問題)
- [失敗事例4: 不要な再レンダリング](#失敗事例4-不要な再レンダリング)
- [失敗事例5: 過剰なuseCallback/useMemo](#失敗事例5-過剰なusecallbackusememo)
- [失敗事例6: useStateの非同期更新](#失敗事例6-usestateの非同期更新)
- [失敗事例7: useRefの誤用](#失敗事例7-userefの誤用)
- [失敗事例8: Contextの過剰使用](#失敗事例8-contextの過剰使用)
- [失敗事例9: 依存配列の抜け漏れ](#失敗事例9-依存配列の抜け漏れ)
- [失敗事例10: 型定義の不備](#失敗事例10-型定義の不備)
- [まとめ](#まとめ)

## この章で学べること

- React開発で実際によく発生する10の失敗パターン
- 各失敗の原因と影響
- 具体的な修正方法とベストプラクティス
- 失敗を未然に防ぐためのチェックリスト

## 失敗事例1: useEffectの無限ループ

### 問題のコード

```typescript
// ❌ 悪い例: 無限ループが発生
function BadComponent() {
  const [count, setCount] = useState(0)
  const [data, setData] = useState([])

  useEffect(() => {
    // dataが変わるたびに実行される
    const newData = processData(data)
    setData(newData)  // これがdataを更新 → useEffectが再実行 → 無限ループ
  }, [data])

  return <div>{count}</div>
}
```

**症状:**
- ブラウザがフリーズする
- "Maximum update depth exceeded" エラー
- メモリ使用量が急増

### 正しい修正

```typescript
// - 良い例1: 依存配列を空にする
function GoodComponent1() {
  const [count, setCount] = useState(0)
  const [data, setData] = useState([])

  useEffect(() => {
    // 初回のみ実行
    fetchData().then(newData => setData(newData))
  }, [])  // 空の依存配列

  return <div>{count}</div>
}

// - 良い例2: 関数型更新を使う
function GoodComponent2() {
  const [data, setData] = useState([])

  useEffect(() => {
    // prevDataを使って更新（dataに依存しない）
    setData(prevData => processData(prevData))
  }, [])  // dataを依存配列から除外

  return <div>{data.length}</div>
}

// - 良い例3: useRefで前回の値を記憶
function GoodComponent3() {
  const [data, setData] = useState([])
  const prevDataRef = useRef(data)

  useEffect(() => {
    if (prevDataRef.current !== data) {
      prevDataRef.current = data
      // 処理...
    }
  }, [data])

  return <div>{data.length}</div>
}
```

## 失敗事例2: メモリリーク

### 問題のコード

```typescript
// ❌ 悪い例: クリーンアップがない
function BadTimer() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1)
    }, 1000)
    // クリーンアップがない！
  }, [])

  return <div>{count}</div>
}

// 問題: コンポーネントがアンマウントされてもタイマーが動き続ける
```

### 正しい修正

```typescript
// - 良い例: クリーンアップ関数を返す
function GoodTimer() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1)
    }, 1000)

    // クリーンアップ関数
    return () => {
      clearInterval(timer)
    }
  }, [])

  return <div>{count}</div>
}

// - 良い例: イベントリスナーのクリーンアップ
function GoodEventListener() {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }

    window.addEventListener('resize', handleResize)

    // クリーンアップ
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <div>{size.width} x {size.height}</div>
}

// - 良い例: fetch/axiosのキャンセル
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

    // クリーンアップ: fetchをキャンセル
    return () => {
      controller.abort()
    }
  }, [userId])

  return <div>{user?.name}</div>
}
```

## 失敗事例3: 古いクロージャ問題

### 問題のコード

```typescript
// ❌ 悪い例: 古い値を参照し続ける
function BadClosure() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count)  // 常に0が表示される（古いクロージャ）
      setCount(count + 1)  // これも常に0+1=1になる
    }, 1000)

    return () => clearInterval(timer)
  }, [])  // countを依存配列に入れていない

  return <div>{count}</div>
}
```

### 正しい修正

```typescript
// - 良い例1: 依存配列に含める
function GoodClosure1() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count)  // 正しい値が表示される
      setCount(count + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [count])  // countを依存配列に含める

  return <div>{count}</div>
}

// - 良い例2: 関数型更新を使う（推奨）
function GoodClosure2() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => {
        console.log(c)  // 正しい値
        return c + 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])  // 依存配列は空でOK

  return <div>{count}</div>
}

// - 良い例3: useRefで最新の値を参照
function GoodClosure3() {
  const [count, setCount] = useState(0)
  const countRef = useRef(count)

  useEffect(() => {
    countRef.current = count
  })

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(countRef.current)  // 常に最新の値
      setCount(c => c + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return <div>{count}</div>
}
```

## 失敗事例4: 不要な再レンダリング

### 問題のコード

```typescript
// ❌ 悪い例: 毎回新しいオブジェクト/配列を作る
function BadParent() {
  const [count, setCount] = useState(0)

  // 毎回新しいオブジェクト
  const config = { url: '/api', timeout: 5000 }

  // 毎回新しい関数
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
  // countが変わるたびに再レンダリングされる
  return <div onClick={onClick}>Child</div>
})
```

### 正しい修正

```typescript
// - 良い例: useCallback と useMemo を使う
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

// さらに良い例: コンポーネント外で定義
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

## 失敗事例5: 過剰なuseCallback/useMemo

### 問題のコード

```typescript
// ❌ 悪い例: 全てをメモ化（可読性が低下）
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

### 正しい修正

```typescript
// - 良い例: 必要な箇所のみメモ化
function GoodOptimization({ count }: { count: number }) {
  // 単純な計算はメモ化不要
  const doubled = count * 2
  const tripled = count * 3
  const message = `Count is ${count}`

  // memo化されたコンポーネントに渡す場合のみメモ化
  const handleClick = () => console.log('clicked')

  return (
    <div style={{ color: 'blue', fontSize: 16 }} onClick={handleClick}>
      {message} - Doubled: {doubled}, Tripled: {tripled}
    </div>
  )
}
```

## 失敗事例6: useStateの非同期更新

### 問題のコード

```typescript
// ❌ 悪い例: setStateの結果をすぐに参照
function BadCounter() {
  const [count, setCount] = useState(0)

  const increment = () => {
    setCount(count + 1)
    console.log(count)  // まだ古い値（0）が表示される

    setCount(count + 1)  // これも0+1=1になる
    setCount(count + 1)  // これも0+1=1になる
    // 結果: countは1になる（期待: 3）
  }

  return <button onClick={increment}>{count}</button>
}
```

### 正しい修正

```typescript
// - 良い例: 関数型更新を使う
function GoodCounter() {
  const [count, setCount] = useState(0)

  const increment = () => {
    setCount(c => c + 1)  // 0 + 1 = 1
    setCount(c => c + 1)  // 1 + 1 = 2
    setCount(c => c + 1)  // 2 + 1 = 3
    // 結果: countは3になる
  }

  return <button onClick={increment}>{count}</button>
}

// - 良い例: useEffectで更新後の値を使う
function GoodWithEffect() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    console.log('Count updated:', count)  // 更新後の値
  }, [count])

  const increment = () => {
    setCount(count + 1)
  }

  return <button onClick={increment}>{count}</button>
}
```

## 失敗事例7: useRefの誤用

### 問題のコード

```typescript
// ❌ 悪い例: useRefの変更で再レンダリングを期待
function BadRef() {
  const countRef = useRef(0)

  const increment = () => {
    countRef.current += 1
    // 再レンダリングされない！
  }

  return <button onClick={increment}>{countRef.current}</button>
}
```

### 正しい修正

```typescript
// - 良い例: useStateを使う（再レンダリングが必要な場合）
function GoodState() {
  const [count, setCount] = useState(0)

  const increment = () => {
    setCount(c => c + 1)  // 再レンダリングされる
  }

  return <button onClick={increment}>{count}</button>
}

// - 良い例: useRefの正しい使い方（DOM参照）
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

## 失敗事例8: Contextの過剰使用

### 問題のコード

```typescript
// ❌ 悪い例: 頻繁に変わる値をContextに入れる
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
      // 全てのConsumerが再レンダリング！
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

### 正しい修正

```typescript
// - 良い例: Contextを分割する
const ThemeContext = createContext<string>('light')
const UserContext = createContext<string>('')

function GoodContextProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState('')
  const [theme, setTheme] = useState('light')

  // mousePositionはContextに入れない（頻繁に変わるため）
  // 必要なコンポーネントで直接useEventを使う

  return (
    <UserContext.Provider value={userId}>
      <ThemeContext.Provider value={theme}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  )
}
```

## 失敗事例9: 依存配列の抜け漏れ

### 問題のコード

```typescript
// ❌ 悪い例: 依存配列にuserIdがない
function BadDeps({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUser(userId).then(data => setUser(data))
    // userIdが変わっても再実行されない
  }, [])  // userIdを入れ忘れ

  return <div>{user?.name}</div>
}
```

### 正しい修正

```typescript
// - 良い例: 全ての依存を含める
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
  }, [userId])  // userIdを依存配列に含める

  return <div>{user?.name}</div>
}

// ESLintの警告に従う
// eslint-plugin-react-hooks を導入推奨
```

## 失敗事例10: 型定義の不備

### 問題のコード

```typescript
// ❌ 悪い例: any型の乱用
function BadTypes({ data }: { data: any }) {
  const [items, setItems] = useState<any>([])

  const handleClick = (item: any) => {
    // 型チェックがない
    console.log(item.name)  // 実行時エラーの可能性
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

### 正しい修正

```typescript
// - 良い例: 適切な型定義
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
    console.log(item.name)  // 型安全
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

## まとめ

### 失敗を防ぐチェックリスト

**useEffect関連:**
- [ ] 依存配列は正確か（ESLint警告を確認）
- [ ] 無限ループの可能性はないか
- [ ] クリーンアップ関数を返しているか
- [ ] 古いクロージャ問題はないか

**パフォーマンス関連:**
- [ ] 不要な再レンダリングはないか
- [ ] 過剰なメモ化をしていないか
- [ ] オブジェクト/配列を毎回生成していないか

**useState関連:**
- [ ] 関数型更新を使うべき箇所で使っているか
- [ ] 非同期更新を理解しているか
- [ ] useStateとuseRefの使い分けは正しいか

**Context関連:**
- [ ] 頻繁に変わる値をContextに入れていないか
- [ ] Contextを適切に分割しているか

**型定義関連:**
- [ ] any型を使っていないか
- [ ] Propsの型定義は適切か
- [ ] Hooksの型推論は正しいか

### 開発時の心構え

1. **ESLintの警告を無視しない**
2. **DevToolsで再レンダリングを確認**
3. **TypeScriptを活用して型安全性を確保**
4. **クリーンアップ関数を忘れない**
5. **測定してから最適化する**

これらの失敗事例を理解することで、より堅牢で保守しやすいReactアプリケーションを開発できるようになります。
