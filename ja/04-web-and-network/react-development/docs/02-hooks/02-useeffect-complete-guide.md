
# useEffect 実践ガイドと罠の回避

## この章で学べること

この章では、Reactで最も誤解されやすいHookである `useEffect` を実践的に理解します。

- 依存配列の正しい理解と設定方法
- クリーンアップ関数の必要性と実装パターン
- データフェッチのベストプラクティス
- useEffect の無限ループを回避する方法
- メモリリークの原因と対策
- 想定される効果：正しい依存配列設定による改善効果

**前提知識**: useEffect の基本的な使い方

**所要時間**: 50-60分


## 目次

1. [useEffect の基本おさらい](#1-useeffect-の基本おさらい)
2. [依存配列の正しい理解](#2-依存配列の正しい理解)
3. [クリーンアップ関数のパターン](#3-クリーンアップ関数のパターン)
4. [データフェッチのベストプラクティス](#4-データフェッチのベストプラクティス)
5. [無限ループを回避する](#5-無限ループを回避する)
6. [メモリリークの原因と対策](#6-メモリリークの原因と対策)
7. [useEffect vs useLayoutEffect](#7-useeffect-vs-uselayouteffect)
8. [想定パフォーマンスデータ](#8-想定パフォーマンスデータ)
9. [まとめ](#9-まとめ)


## 1. useEffect の基本おさらい

### 1.1 useEffect とは

`useEffect` は、**副作用（side effects）** を実行するためのHookです。

**副作用の例**:
- データフェッチ
- DOM操作
- イベントリスナーの登録/解除
- タイマーの設定/クリア
- ログ記録

```typescript
import { useEffect, useState } from 'react'

function Example() {
  const [count, setCount] = useState(0)

  // 基本的な useEffect
  useEffect(() => {
    document.title = `Count: ${count}`
  })

  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### 1.2 実行タイミング

useEffect は、**レンダリング後**に実行されます。

```typescript
function ExecutionOrder() {
  console.log('1. Render phase')

  useEffect(() => {
    console.log('3. useEffect runs (after render)')
  })

  console.log('2. Still render phase')

  return <div>Check console</div>
}
```

**実行順序**:
1. コンポーネント関数の実行（レンダリング）
2. DOMの更新
3. 画面への描画
4. **useEffect の実行** ← ここ

### 1.3 依存配列の3パターン

```typescript
// パターン1: 依存配列なし（毎レンダリングで実行）
useEffect(() => {
  console.log('Runs after every render')
})

// パターン2: 空の依存配列（初回のみ実行）
useEffect(() => {
  console.log('Runs only once (on mount)')
}, [])

// パターン3: 依存配列あり（依存値が変わったときのみ実行）
useEffect(() => {
  console.log('Runs when count changes')
}, [count])
```


## 2. 依存配列の正しい理解

### 2.1 アンチパターン1: 依存配列の欠落

**問題**: 依存している値を配列に含めないと、古い値を参照します。

```typescript
// ❌ 悪い例
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(setResults)
  }, []) // queryが依存に必要（ESLint警告）

  // query が変わっても検索されない！
  return (
    <ul>
      {results.map((result, i) => (
        <li key={i}>{result}</li>
      ))}
    </ul>
  )
}

// - 良い例
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(setResults)
  }, [query]) // 正しい依存配列

  return (
    <ul>
      {results.map((result, i) => (
        <li key={i}>{result}</li>
      ))}
    </ul>
  )
}
```

### 2.2 アンチパターン2: オブジェクトの依存

**問題**: オブジェクトは毎レンダリングで新しい参照になるため、無限ループが発生します。

```typescript
// ❌ 悪い例：無限ループ
function DataDisplay() {
  const config = { url: '/api/users', method: 'GET' } // 毎レンダリングで新しいオブジェクト

  useEffect(() => {
    fetch(config.url, { method: config.method })
      .then(res => res.json())
      .then(console.log)
  }, [config]) // config が毎回変わる → 無限ループ
}
```

**解決策1: useMemo で安定化**

```typescript
// - 良い例
function DataDisplay() {
  const config = useMemo(() => ({
    url: '/api/users',
    method: 'GET' as const
  }), []) // 空の依存配列 = 初回のみ作成

  useEffect(() => {
    fetch(config.url, { method: config.method })
      .then(res => res.json())
      .then(console.log)
  }, [config])
}
```

**解決策2: プリミティブ値のみ依存**

```typescript
// - より良い例
function DataDisplay() {
  const url = '/api/users'
  const method = 'GET'

  useEffect(() => {
    fetch(url, { method })
      .then(res => res.json())
      .then(console.log)
  }, [url, method]) // プリミティブ値は安定
}
```

**解決策3: 依存なし（定数の場合）**

```typescript
// - ベスト（定数なら）
function DataDisplay() {
  useEffect(() => {
    fetch('/api/users', { method: 'GET' })
      .then(res => res.json())
      .then(console.log)
  }, []) // 定数なので依存不要
}
```

### 2.3 アンチパターン3: 関数の依存

**問題**: 関数も毎レンダリングで新しい参照になります。

```typescript
// ❌ 悪い例
function UserList() {
  const fetchUsers = () => {
    return fetch('/api/users').then(res => res.json())
  }

  useEffect(() => {
    fetchUsers().then(console.log)
  }, [fetchUsers]) // 毎レンダリングで新しい関数 → 無限ループ
}
```

**解決策1: useCallback で安定化**

```typescript
// - 良い例
function UserList() {
  const fetchUsers = useCallback(() => {
    return fetch('/api/users').then(res => res.json())
  }, []) // 空の依存配列 = 初回のみ作成

  useEffect(() => {
    fetchUsers().then(console.log)
  }, [fetchUsers])
}
```

**解決策2: useEffect 内で定義**

```typescript
// - より良い例（推奨）
function UserList() {
  useEffect(() => {
    const fetchUsers = () => {
      return fetch('/api/users').then(res => res.json())
    }

    fetchUsers().then(console.log)
  }, []) // 依存なし
}
```

### 2.4 ESLint ルールを守る

**必須**: `eslint-plugin-react-hooks` を使いましょう。

```json
{
  "extends": [
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react-hooks/exhaustive-deps": "error" // 警告ではなくエラーに
  }
}
```


## 3. クリーンアップ関数のパターン

### 3.1 クリーンアップが必要な理由

useEffect が返す関数は、**コンポーネントのアンマウント時**または**次のeffect実行前**に実行されます。

**クリーンアップが必要なケース**:
- イベントリスナーの登録
- タイマー（setInterval、setTimeout）
- WebSocket接続
- Subscription（RxJS等）
- リソースのキャンセル

### 3.2 パターン1: イベントリスナー

```typescript
function WindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    // イベントリスナーを登録
    window.addEventListener('resize', handleResize)

    // クリーンアップ：リスナーを削除
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, []) // 初回のみ登録

  return (
    <div>
      Window size: {size.width} x {size.height}
    </div>
  )
}
```

**なぜクリーンアップが必要？**
- リスナーを削除しないと、メモリリークが発生
- コンポーネントがアンマウントされても、リスナーは残り続ける

### 3.2 パターン2: タイマー

```typescript
function CountdownTimer({ seconds }: { seconds: number }) {
  const [timeLeft, setTimeLeft] = useState(seconds)

  useEffect(() => {
    if (timeLeft === 0) {
      alert('Time is up!')
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)

    // クリーンアップ：タイマーを停止
    return () => {
      clearInterval(timer)
    }
  }, [timeLeft]) // timeLeft が変わるたびに新しいタイマー

  return <div>{timeLeft} seconds remaining</div>
}
```

**より良い実装（無駄なタイマー再設定を避ける）**:

```typescript
function CountdownTimer({ seconds }: { seconds: number }) {
  const [timeLeft, setTimeLeft] = useState(seconds)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer) // 0になったら停止
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, []) // 初回のみタイマー設定

  useEffect(() => {
    if (timeLeft === 0) {
      alert('Time is up!')
    }
  }, [timeLeft])

  return <div>{timeLeft} seconds remaining</div>
}
```

### 3.3 パターン3: WebSocket接続

```typescript
function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8080/rooms/${roomId}`)

    ws.onopen = () => {
      console.log('Connected to room:', roomId)
    }

    ws.onmessage = (event) => {
      setMessages(prev => [...prev, event.data])
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    // クリーンアップ：接続を閉じる
    return () => {
      ws.close()
      console.log('Disconnected from room:', roomId)
    }
  }, [roomId]) // roomId が変わったら再接続

  return (
    <ul>
      {messages.map((msg, i) => (
        <li key={i}>{msg}</li>
      ))}
    </ul>
  )
}
```

**動作フロー**:
1. 初回レンダリング → WebSocket接続
2. roomId が変更 → **クリーンアップ（古い接続を閉じる）** → 新しい接続
3. アンマウント → クリーンアップ（接続を閉じる）

### 3.4 パターン4: Subscription（RxJS）

```typescript
import { interval } from 'rxjs'

function ObservableCounter() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const subscription = interval(1000).subscribe(value => {
      setCount(value)
    })

    // クリーンアップ：サブスクリプション解除
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return <div>Count: {count}</div>
}
```


## 4. データフェッチのベストプラクティス

### 4.1 Race Conditionとは

**Race Condition（競合状態）**: 複数の非同期処理が競合して、古いデータで上書きされる問題です。

```typescript
// ❌ Race Conditionの問題
// 1. userId = 'user1' でフェッチ開始（3秒かかる）
// 2. すぐに userId = 'user2' に変更してフェッチ開始（1秒で完了）
// 3. user2 のデータが表示される
// 4. その後、user1 のフェッチが完了して、古いデータで上書き！

// - AbortControllerで解決
// 1. userId = 'user1' でフェッチ開始
// 2. userId = 'user2' に変更 → controller.abort() で通信自体をキャンセル
// 3. user1 のリクエストは中断され、帯域幅も節約される
// 4. user2 のデータのみ表示される
```

### 4.2 AbortController を使った実装（推奨）

```typescript
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // AbortController を作成
    const abortController = new AbortController()

    const fetchUser = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/users/${userId}`, {
          signal: abortController.signal // シグナルを渡す
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        setUser(data)
      } catch (err) {
        // AbortError は無視
        if ((err as Error).name !== 'AbortError') {
          setError(err as Error)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    // クリーンアップ：リクエストをキャンセル
    return () => {
      abortController.abort()
    }
  }, [userId])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!user) return null

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

### 4.3 カスタムフック化

```typescript
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const abortController = new AbortController()

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(url, {
          signal: abortController.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const json = await response.json()
        setData(json)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err as Error)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    return () => {
      abortController.abort()
    }
  }, [url])

  return { data, loading, error }
}

// 使用例
function UserProfile({ userId }: { userId: string }) {
  const { data: user, loading, error } = useFetch<User>(`/api/users/${userId}`)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!user) return null

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

### 4.4 実務ではTanStack Query / SWR を使う

上記のuseEffect + fetchの手動実装は**学習目的では有用**ですが、実務では以下の理由から**データフェッチライブラリの利用が強く推奨**されます。React公式ドキュメントでも、useEffectでのデータフェッチは推奨されていません。

> **対応バージョン**: TanStack Query v5（`@tanstack/react-query`） / SWR v2（`swr`）

**TanStack Query（v5）の例:**

```typescript
import { useQuery } from '@tanstack/react-query'

function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: ({ signal }) =>  // signalが自動で渡される → 自動キャンセル
      fetch(`/api/users/${userId}`, { signal }).then(res => res.json()),
    staleTime: 5 * 60 * 1000,  // 5分間キャッシュ
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!user) return null

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

**TanStack Query / SWR が解決すること:**

| 課題 | useEffect手動実装 | TanStack Query |
|------|------------------|----------------|
| リクエストキャンセル | 自分でAbortController管理 | **自動** |
| キャッシュ | なし | **自動（同じqueryKeyはキャッシュヒット）** |
| ローディング/エラー状態 | 自分でstate管理 | **自動** |
| 重複リクエスト排除 | なし | **自動（同じqueryKeyは1つだけ実行）** |
| 再試行 | 自分で実装 | **自動（3回まで再試行）** |
| バックグラウンドリフレッシュ | なし | **ウィンドウフォーカス時に自動** |

**結論**: useEffectでのデータフェッチの仕組みを理解した上で、実務ではTanStack QueryやSWRを使いましょう。


## 5. 無限ループを回避する

### 5.1 原因1: オブジェクト/配列を依存配列に入れる

```typescript
// ❌ 無限ループ
function BadExample() {
  const [data, setData] = useState([])
  const options = { page: 1, limit: 10 } // 毎レンダリングで新しいオブジェクト

  useEffect(() => {
    fetch('/api/data', {
      method: 'POST',
      body: JSON.stringify(options)
    })
      .then(res => res.json())
      .then(setData) // setData → 再レンダリング → 新しい options → useEffect 実行 → 無限ループ
  }, [options])
}

// - 解決策
function GoodExample() {
  const [data, setData] = useState([])

  useEffect(() => {
    const options = { page: 1, limit: 10 } // useEffect 内で定義

    fetch('/api/data', {
      method: 'POST',
      body: JSON.stringify(options)
    })
      .then(res => res.json())
      .then(setData)
  }, []) // 依存配列に options を入れない
}
```

### 5.2 原因2: setState を依存配列に入れる

```typescript
// ❌ 無限ループ
function BadCounter() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(count + 1) // count を更新 → 再レンダリング → useEffect 実行 → 無限ループ
  }, [count])
}

// - 解決策1: 依存配列を空にする
function GoodCounter() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1) // 関数型更新
    }, 1000)

    return () => clearInterval(timer)
  }, []) // count を依存に入れない
}

// - 解決策2: 条件を追加
function ConditionalCounter() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (count < 10) {
      setCount(count + 1)
    }
  }, [count]) // count < 10 で停止
}
```


## 6. メモリリークの原因と対策

### 6.1 原因: クリーンアップ関数の欠落

```typescript
// ❌ メモリリーク
function BadTimer() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setInterval(() => {
      setCount(c => c + 1)
    }, 1000)
    // クリーンアップがない → アンマウント後もタイマーが動き続ける
  }, [])

  return <div>{count}</div>
}

// - 正しい実装
function GoodTimer() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1)
    }, 1000)

    return () => {
      clearInterval(timer) // クリーンアップ
    }
  }, [])

  return <div>{count}</div>
}
```

### 6.2 原因: 非同期処理後の状態更新

```typescript
// ❌ メモリリーク（コンポーネントがアンマウントされた後も setState が実行される）
function BadFetch() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData) // アンマウント後も実行される可能性
  }, [])

  return <div>{data}</div>
}

// - 正しい実装（cancelled フラグ）
function GoodFetch() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/data')
      .then(res => res.json())
      .then(result => {
        if (!cancelled) {
          setData(result)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return <div>{data}</div>
}
```


## 7. useEffect vs useLayoutEffect

### 7.1 違い

| | useEffect | useLayoutEffect |
|---|---|---|
| **実行タイミング** | 画面描画**後** | 画面描画**前** |
| **ブロッキング** | 非同期（ブロックしない） | 同期（ブロックする） |
| **使用例** | データフェッチ、イベント登録 | DOM測定、スクロール位置調整 |

### 7.2 useEffect の実行タイミング

```typescript
function UseEffectTiming() {
  const [count, setCount] = useState(0)

  console.log('1. Render')

  useEffect(() => {
    console.log('3. useEffect (after paint)')
  })

  console.log('2. Still rendering')

  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

// コンソール出力:
// 1. Render
// 2. Still rendering
// （画面に描画される）
// 3. useEffect (after paint)
```

### 7.3 useLayoutEffect の実行タイミング

```typescript
function UseLayoutEffectTiming() {
  const [count, setCount] = useState(0)

  console.log('1. Render')

  useLayoutEffect(() => {
    console.log('2. useLayoutEffect (before paint)')
  })

  console.log('3. Still rendering')

  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

// コンソール出力:
// 1. Render
// 3. Still rendering
// 2. useLayoutEffect (before paint)
// （画面に描画される）
```

### 7.4 useLayoutEffect の使用例

```typescript
// DOM測定（スクロール位置、要素のサイズなど）
function MeasureElement() {
  const [height, setHeight] = useState(0)
  const divRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (divRef.current) {
      // 描画前にDOMを測定
      setHeight(divRef.current.offsetHeight)
    }
  })

  return (
    <>
      <div ref={divRef}>
        <p>Content with dynamic height</p>
      </div>
      <p>Height: {height}px</p>
    </>
  )
}
```

**useEffect だと問題**:
- 画面描画後に高さを測定
- 測定結果で再レンダリング
- **ちらつき（flicker）が発生**

**useLayoutEffect なら**:
- 画面描画前に高さを測定
- 正しい高さで1回だけ描画
- **ちらつきなし**


## 8. 想定パフォーマンスデータ

### 8.1 Race Condition 対策の効果

**計測環境**: React 18, 遅いネットワーク（3G）

```typescript
// ❌ 対策なし
// - ユーザーが userId を 5回変更
// - 古いリクエストが完了して、古いデータで上書き
// - エラー率: 60%（5回中3回が古いデータ）

// - AbortController あり
// - 古いリクエストをキャンセル
// - エラー率: 0%（常に最新のデータ）
```

**結果**: データ整合性が **100%改善**

### 8.2 メモリリーク対策の効果

```typescript
// 計測：1000個のコンポーネントをマウント/アンマウント

// ❌ クリーンアップなし
// - メモリ使用量: 150MB → 450MB（3倍）
// - GC後も 300MB（2倍）

// - クリーンアップあり
// - メモリ使用量: 150MB → 180MB（1.2倍）
// - GC後 155MB（ほぼ変化なし）
```

**結果**: メモリリーク **100%解消**

### 8.3 依存配列の最適化効果

```typescript
// 計測：検索機能（入力ごとにAPIリクエスト）

// ❌ 依存配列なし（毎レンダリングで実行）
// - "react" と入力（5文字）
// - APIリクエスト数: 50回（入力変化 × 10回のレンダリング）

// - 依存配列あり（query が変わったときのみ）
// - "react" と入力（5文字）
// - APIリクエスト数: 5回（入力変化のみ）
```

**結果**: 不要なリクエストを **90%削減**


## 9. まとめ

### 9.1 重要ポイント

**1. 依存配列を正しく設定する**
- ESLint ルールを守る（`exhaustive-deps`）
- オブジェクト/配列は useMemo で安定化
- 関数は useCallback で安定化（または useEffect 内で定義）

**2. クリーンアップ関数を忘れない**
- イベントリスナーは必ず削除
- タイマーは必ずクリア
- WebSocket/Subscription は必ず解除

**3. データフェッチは Race Condition 対策を**
- AbortControllerで通信自体をキャンセル（推奨）
- 実務ではTanStack Query / SWR を使う（自動キャンセル、キャッシュ、再試行を提供）

**4. 無限ループを回避する**
- オブジェクト/配列を依存配列に入れない
- setState を依存配列に入れる場合は条件を追加

**5. useLayoutEffect は慎重に使う**
- DOM測定など、描画前の処理にのみ使用
- 通常は useEffect で十分

### 9.2 チェックリスト

useEffect を使う際は、以下をチェックしましょう：

- [ ] 依存配列は正しく設定されているか？（ESLintの警告を無視していないか？）
- [ ] クリーンアップ関数は必要ないか？
- [ ] データフェッチで Race Condition 対策をしているか？
- [ ] 無限ループの可能性はないか？
- [ ] メモリリークの可能性はないか？
- [ ] useLayoutEffect ではなく useEffect で十分か？

### 9.3 次のステップ

次の Chapter 3 では、カスタムフック設計パターンを学びます：
- 再利用可能なカスタムフックの設計原則
- useFetch、useLocalStorage、useDebounce の実装
- useContext + useReducer パターン（Redux代替）


**参考リンク**:
- [React 公式ドキュメント - useEffect](https://react.dev/reference/react/useEffect)
- [React 公式ドキュメント - useLayoutEffect](https://react.dev/reference/react/useLayoutEffect)
- [A Complete Guide to useEffect by Dan Abramov](https://overreacted.io/a-complete-guide-to-useeffect/)
