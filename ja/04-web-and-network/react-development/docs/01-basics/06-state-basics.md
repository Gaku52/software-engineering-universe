# State の基礎 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [前提知識](#前提知識)
3. [State とは](#state-とは)
4. [useState Hook](#usestate-hook)
5. [State の更新](#state-の更新)
6. [複数の State を管理する](#複数の-state-を管理する)
7. [オブジェクトと配列の State](#オブジェクトと配列の-state)
8. [State と Props の違い](#state-と-props-の違い)
9. [よくあるミス](#よくあるミス)
10. [演習](#演習)
11. [次のステップ](#次のステップ)

---

## 概要

### このガイドで学ぶこと

- State の基本概念となぜ必要なのか
- `useState` Hook の使い方
- State を正しく更新する方法
- 複数の State の管理
- オブジェクトと配列の State 管理
- State と Props の違い

### なぜ重要なのか

**State** は React コンポーネントが**動的に変化するデータ**を保持するための仕組みです。State を理解すると：
- **インタラクティブな UI を作れる**：ユーザーの操作に応じて画面が変わる
- **データを保持できる**：コンポーネント内でデータを保存・更新できる
- **再描画を起こせる**：State が変わると、React が自動的に画面を更新する

### 学習時間の目安

- このガイドを読むだけ：40〜50 分
- 演習まで含めた完全理解：2〜3 時間

---

## 前提知識

### 必須の知識

1. **Props の基礎**：先に [05-props-basics.md](./05-props-basics.md) を完了しておくこと
2. **JavaScript ES6**：配列の分割代入（`const [a, b] = [1, 2]`）・スプレッド構文（`[...array]`・`{...object}`）

---

## State とは

### 定義

**State** は**コンポーネントが内部に持つ動的なデータ**です。

```typescript
import { useState } from 'react';

function Counter() {
  // count が State
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>カウント: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

### なぜ State が必要なのか

#### State なし：通常の変数（動かない）

```typescript
function Counter() {
  let count = 0;  // 通常の変数

  const increment = () => {
    count = count + 1;    // メモリ上の値は変わる…
    console.log(count);   // コンソールには表示される
  };

  return (
    <div>
      <p>カウント: {count}</p>  {/* 画面は更新されない！ */}
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

**問題**：変数の値は変わっても、**React が変化を検知できない**ため画面は更新されません。

#### State あり：useState を使う（正しい方法）

```typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);  // State

  const increment = () => {
    setCount(count + 1);  // State を更新する
    // React が変化を検知 → 自動的に再描画される
  };

  return (
    <div>
      <p>カウント: {count}</p>  {/* 画面が更新される！ */}
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

**解決**：`useState` が State を管理し、`setCount` で更新すると React が自動的に画面を再描画します。

---

## useState Hook

### 構文

```typescript
const [state, setState] = useState(initialValue);
```

- `state`：現在の State の値
- `setState`：State を更新する関数
- `initialValue`：初期値

### 基本的な例

```typescript
import { useState } from 'react';

function Example() {
  // 数値の State
  const [count, setCount] = useState(0);

  // 文字列の State
  const [name, setName] = useState('');

  // 真偽値の State
  const [isVisible, setIsVisible] = useState(true);

  return <div>...</div>;
}
```

### useState の命名規則

慣習として次の形式を使います：

```typescript
const [value, setValue] = useState(initialValue);
```

**例**：
- `const [count, setCount] = useState(0);`
- `const [name, setName] = useState('');`
- `const [isOpen, setIsOpen] = useState(false);`
- `const [todos, setTodos] = useState([]);`

**ルール**：
- State 変数：名詞（`count`・`name`・`isOpen`）
- 更新関数：`set` + State 変数名（`setCount`・`setName`・`setIsOpen`）

---

## State の更新

### 1. 値を直接渡す

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(count - 1)}>-1</button>
      <button onClick={() => setCount(0)}>リセット</button>
    </div>
  );
}
```

### 2. 関数を使った更新（推奨）

新しい State が現在の State に依存する場合は、**関数を渡す**方が安全です。

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{count}</p>
      {/* 関数を渡す（prevCount が現在の値） */}
      <button onClick={() => setCount(prevCount => prevCount + 1)}>
        +1
      </button>
    </div>
  );
}
```

**なぜ関数形式を使うのか？**

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  const handleMultipleClicks = () => {
    // NG：3 回呼んでも 1 しか増えない
    setCount(count + 1);  // count = 0 + 1 = 1
    setCount(count + 1);  // count = 0 + 1 = 1
    setCount(count + 1);  // count = 0 + 1 = 1
    // 結果: count = 1

    // OK：3 回呼ぶと 3 増える
    setCount(prev => prev + 1);  // prev = 0 → 1
    setCount(prev => prev + 1);  // prev = 1 → 2
    setCount(prev => prev + 1);  // prev = 2 → 3
    // 結果: count = 3
  };

  return <button onClick={handleMultipleClicks}>+3</button>;
}
```

### 3. State の更新は非同期

**重要**：`setState` は**非同期**です。

```typescript
function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
    console.log(count);  // まだ古い値が表示される！
  };

  return <button onClick={increment}>+1</button>;
}
```

**解決策**：更新後の値は次の描画で使えます。すぐに新しい値が必要な場合は変数に保存します。

```typescript
const increment = () => {
  const newCount = count + 1;
  setCount(newCount);
  console.log(newCount);  // 新しい値を使う
};
```

---

## 複数の State を管理する

### 複数の useState を使う

1 つのコンポーネントで複数の State を管理できます。

```typescript
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setIsLoading(true);
    setError('');

    if (email === '' || password === '') {
      setError('メールアドレスとパスワードを入力してください。');
      setIsLoading(false);
      return;
    }

    // API 呼び出しなど
    setIsLoading(false);
  };

  return (
    <form>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
      />
      {error && <p className="error">{error}</p>}
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  );
}
```

### 関連する State はオブジェクトにまとめる

```typescript
type FormState = {
  email: string;
  password: string;
  isLoading: boolean;
  error: string;
};

function LoginForm() {
  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    isLoading: false,
    error: ''
  });

  const handleSubmit = () => {
    setForm(prev => ({ ...prev, isLoading: true, error: '' }));

    if (form.email === '' || form.password === '') {
      setForm(prev => ({
        ...prev,
        error: 'メールアドレスとパスワードを入力してください。',
        isLoading: false
      }));
      return;
    }

    setForm(prev => ({ ...prev, isLoading: false }));
  };

  return (
    <form>
      <input
        type="email"
        value={form.email}
        onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
      />
      <input
        type="password"
        value={form.password}
        onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
      />
      {form.error && <p className="error">{form.error}</p>}
      <button onClick={handleSubmit} disabled={form.isLoading}>
        {form.isLoading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  );
}
```

---

## オブジェクトと配列の State

### オブジェクトの State を更新する

**重要**：オブジェクトは**イミュータブル（不変）**に更新する必要があります。

```typescript
type User = {
  name: string;
  age: number;
  email: string;
};

function UserProfile() {
  const [user, setUser] = useState<User>({
    name: '山田 太郎',
    age: 28,
    email: 'taro@example.com'
  });

  // NG：直接変更している
  const updateName = (newName: string) => {
    user.name = newName;  // React が検知できない！
    setUser(user);
  };

  // OK：新しいオブジェクトを作る
  const updateName = (newName: string) => {
    setUser({
      ...user,         // 既存のプロパティをすべてコピー
      name: newName    // name だけ上書き
    });
  };

  // OK（関数形式 — 推奨）
  const updateAge = (newAge: number) => {
    setUser(prev => ({
      ...prev,
      age: newAge
    }));
  };

  return (
    <div>
      <p>名前: {user.name}</p>
      <p>年齢: {user.age} 歳</p>
      <p>メール: {user.email}</p>
      <button onClick={() => updateName('鈴木 花子')}>
        名前を変更
      </button>
      <button onClick={() => updateAge(user.age + 1)}>
        誕生日
      </button>
    </div>
  );
}
```

### 配列の State を更新する

配列も**イミュータブル**に更新する必要があります。

```typescript
function TodoList() {
  const [todos, setTodos] = useState<string[]>(['買い物', '掃除']);

  // NG：直接変更している
  const addTodoWrong = (newTodo: string) => {
    todos.push(newTodo);  // React が検知できない！
    setTodos(todos);
  };

  // OK：新しい配列を作る
  const addTodo = (newTodo: string) => {
    setTodos([...todos, newTodo]);
  };

  // 削除
  const removeTodo = (index: number) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  // 更新
  const updateTodo = (index: number, newText: string) => {
    setTodos(todos.map((todo, i) =>
      i === index ? newText : todo
    ));
  };

  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>
          {todo}
          <button onClick={() => removeTodo(index)}>削除</button>
        </li>
      ))}
      <button onClick={() => addTodo('新しい TODO')}>
        追加
      </button>
    </ul>
  );
}
```

### 配列操作のパターン集

```typescript
// 追加（末尾に）
setTodos([...todos, newTodo]);

// 追加（先頭に）
setTodos([newTodo, ...todos]);

// 削除
setTodos(todos.filter((_, i) => i !== indexToRemove));

// 更新
setTodos(todos.map((todo, i) =>
  i === indexToUpdate ? newValue : todo
));

// ソート
setTodos([...todos].sort());

// 全削除
setTodos([]);
```

---

## State と Props の違い

### 比較表

| | State | Props |
|---|-------|-------|
| **定義** | コンポーネントが内部で管理するデータ | 親コンポーネントから渡されるデータ |
| **変更** | 変更可能（setState 経由） | 読み取り専用 |
| **管理者** | コンポーネント自身 | 親コンポーネント |
| **使い方** | `useState` Hook | 関数の引数 |
| **再描画** | 変更時に再描画される | 変更時に再描画される |

### 実践的な例

```typescript
// 親コンポーネント
function Parent() {
  const [count, setCount] = useState(0);  // State

  return (
    <div>
      <p>親のカウント: {count}</p>
      <button onClick={() => setCount(count + 1)}>親でインクリメント</button>
      {/* count を Props として子に渡す */}
      <Child count={count} />
    </div>
  );
}

// 子コンポーネント
type ChildProps = {
  count: number;  // Props
};

function Child({ count }: ChildProps) {
  const [localCount, setLocalCount] = useState(0);  // State

  return (
    <div>
      <p>親からのカウント: {count}</p>
      <p>ローカルカウント: {localCount}</p>
      <button onClick={() => setLocalCount(localCount + 1)}>
        ローカルでインクリメント
      </button>
    </div>
  );
}
```

---

## よくあるミス

### ミス 1：State を直接変更している

```typescript
// NG
const [count, setCount] = useState(0);
count = count + 1;  // 直接変更 → React は再描画しない

// OK
setCount(count + 1);  // setCount を使う
```

### ミス 2：オブジェクトの State を直接変更している

```typescript
// NG
const [user, setUser] = useState({ name: 'Alice', age: 25 });
user.age = 26;  // 直接変更
setUser(user);  // React は変化を検知しない

// OK
setUser({ ...user, age: 26 });  // 新しいオブジェクトを作る
```

### ミス 3：配列の State に push / pop を使っている

```typescript
// NG
const [todos, setTodos] = useState(['買い物']);
todos.push('掃除');  // 直接変更
setTodos(todos);

// OK
setTodos([...todos, '掃除']);  // 新しい配列を作る
```

### ミス 4：setState の直後に State を読んでいる

```typescript
const [count, setCount] = useState(0);
setCount(count + 1);
console.log(count);  // まだ古い値！

// OK
const newCount = count + 1;
setCount(newCount);
console.log(newCount);  // 新しい値
```

### ミス 5：初期値に重い処理を直接呼び出している

```typescript
// NG：expensiveCalculation() がレンダリングのたびに実行される
const [value, setValue] = useState(expensiveCalculation());

// OK：関数を渡すと初回のみ実行される
const [value, setValue] = useState(() => expensiveCalculation());
```

---

## 演習

### 演習 1：カウンター拡張版

**難易度**：初級

次の機能を持つカウンターを作ってください：
- +1 ボタン
- -1 ボタン
- +10 ボタン
- リセットボタン
- カウントが 0 未満にならないようにする

**解答例**：
```typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => setCount(prev => prev + 1);
  const decrement = () => setCount(prev => Math.max(0, prev - 1));
  const incrementBy10 = () => setCount(prev => prev + 10);
  const reset = () => setCount(0);

  return (
    <div>
      <h1>カウント: {count}</h1>
      <button onClick={increment}>+1</button>
      <button onClick={decrement}>-1</button>
      <button onClick={incrementBy10}>+10</button>
      <button onClick={reset}>リセット</button>
    </div>
  );
}
```

### 演習 2：TODO リスト

**難易度**：中級

次の機能を持つ TODO リストを作ってください：
- TODO を追加する
- TODO を削除する
- 完了 / 未完了を切り替える
- 完了した件数を表示する

**解答例**：
```typescript
import { useState } from 'react';

type Todo = {
  id: number;
  text: string;
  completed: boolean;
};

function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([
        ...todos,
        { id: Date.now(), text: input, completed: false }
      ]);
      setInput('');
    }
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const completedCount = todos.filter(todo => todo.completed).length;

  return (
    <div>
      <h1>TODO リスト</h1>
      <div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="新しい TODO"
        />
        <button onClick={addTodo}>追加</button>
      </div>

      <p>完了: {completedCount} / {todos.length} 件</p>

      <ul>
        {todos.map(todo => (
          <li
            key={todo.id}
            style={{
              textDecoration: todo.completed ? 'line-through' : 'none'
            }}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
            <button onClick={() => deleteTodo(todo.id)}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 次のステップ

### このガイドで学んだこと

- State の基本概念となぜ必要なのか
- `useState` Hook の使い方
- State を正しく更新するパターン
- 複数の State の管理
- オブジェクトと配列のイミュータブルな更新
- State と Props の違い

### 次に読むガイド

1. **[07-events-lists.md](./07-events-lists.md)** — イベント処理の詳細・フォーム・ユーザー操作
2. **[hooks-mastery.md](../02-hooks/hooks-mastery.md)** — useEffect などの Hook・カスタム Hook・高度な State 管理

### 参考リンク

- [React: State：コンポーネントのメモリ](https://ja.react.dev/learn/state-a-components-memory)
- [React: useState](https://ja.react.dev/reference/react/useState)

---

**次のガイド**: [07-events-lists.md](./07-events-lists.md)

**前のガイド**: [05-props-basics.md](./05-props-basics.md)

**上位ガイド**: [React 開発 - SKILL.md](../../SKILL.md)
