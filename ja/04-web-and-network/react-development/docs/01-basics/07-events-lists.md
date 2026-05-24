# Events とリスト — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [Event handling の基本](#event-handling-の基本)
4. [主要な Event の種類](#主要な-event-の種類)
5. [フォームの操作](#フォームの操作)
6. [Event オブジェクト](#event-オブジェクト)
7. [Event handler への引数渡し](#event-handler-への引数渡し)
8. [リストの描画（詳細）](#リストの描画詳細)
9. [key の重要性](#key-の重要性)
10. [よくある間違い](#よくある間違い)
11. [演習問題](#演習問題)
12. [次のステップ](#次のステップ)

---

## 概要

### 学べること

- React の event handling の基本
- Click・input・キーボードなど各種 event の扱い方
- フォームの制御とバリデーション
- event オブジェクトの活用
- 効率的なリスト描画
- `key` prop の重要性

### なぜ重要か

**Event handling** と**リスト描画**は、インタラクティブな UI を構築するうえで欠かせないスキルです。これらをマスターすると：
- **ユーザー操作への対応**：クリック・入力・ドラッグなどを処理できる
- **動的な UI の構築**：ユーザーの操作に応じて変化する画面を作れる
- **効率的な描画**：大量のデータを高速に表示できる

### 学習の目安時間

- このガイドを読む：40〜50 分
- 演習を含む完全な理解：2〜3 時間

---

## 前提条件

### 必要な知識

1. **State の基本**：[06-state-basics.md](./06-state-basics.md) を先に完了してください
2. **JavaScript の基礎**：Events（`addEventListener`、`onClick` など）、配列メソッド（`map`、`filter`、`find`）

---

## Event handling の基本

### HTML vs React

#### HTML（従来の方法）

```html
<button onclick="handleClick()">クリック</button>

<script>
function handleClick() {
  alert('クリックされました！');
}
</script>
```

#### React

```typescript
function Button() {
  const handleClick = () => {
    alert('クリックされました！');
  };

  return <button onClick={handleClick}>クリック</button>;
}
```

**違い**：
- React：`onClick`（camelCase） vs HTML：`onclick`（小文字）
- React：関数を渡す（`{handleClick}`） vs HTML：文字列を渡す（`"handleClick()"`）

### 基本的な Event handler

```typescript
function Button() {
  const handleClick = () => {
    console.log('ボタンがクリックされました');
  };

  return (
    <button onClick={handleClick}>
      クリック
    </button>
  );
}
```

### インライン関数（シンプルなケース向け）

```typescript
function Button() {
  return (
    <button onClick={() => alert('クリックされました！')}>
      クリック
    </button>
  );
}
```

**注意**：複雑なロジックには名前付き関数を定義しましょう。インライン関数は読みにくくなります。

---

## 主要な Event の種類

### 1. Click Events

```typescript
function ClickExample() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
  };

  const handleDoubleClick = () => {
    setCount(0);
  };

  return (
    <div>
      <p>カウント: {count}</p>
      <button onClick={handleClick}>
        クリック
      </button>
      <button onDoubleClick={handleDoubleClick}>
        ダブルクリックでリセット
      </button>
    </div>
  );
}
```

### 2. Input Events

```typescript
function InputExample() {
  const [text, setText] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  return (
    <div>
      <input
        type="text"
        value={text}
        onChange={handleChange}
        placeholder="何か入力してください"
      />
      <p>入力内容: {text}</p>
      <p>文字数: {text.length}</p>
    </div>
  );
}
```

### 3. キーボード Events

```typescript
function KeyboardExample() {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setMessage(`送信されました: ${text}`);
      setText('');
    } else if (e.key === 'Escape') {
      setText('');
    }
  };

  return (
    <div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enterで送信、Escapeでクリア"
      />
      {message && <p>{message}</p>}
    </div>
  );
}
```

### 4. マウス Events

```typescript
function MouseExample() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div>
      <div
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          width: '300px',
          height: '300px',
          border: '2px solid black',
          backgroundColor: isHovering ? 'lightblue' : 'white'
        }}
      >
        マウスをここに動かしてください
      </div>
      <p>位置: X: {position.x}, Y: {position.y}</p>
    </div>
  );
}
```

### 5. Focus Events

```typescript
function FocusExample() {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div>
      <input
        type="text"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="クリックしてフォーカス"
        style={{
          borderColor: isFocused ? 'blue' : 'gray',
          borderWidth: '2px'
        }}
      />
      <p>{isFocused ? 'フォーカス中' : 'フォーカスなし'}</p>
    </div>
  );
}
```

---

## フォームの操作

### Controlled Components

React では、フォームの値を **State** で管理します。

```typescript
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();  // デフォルトのフォーム送信を防ぐ
    console.log('Email:', email);
    console.log('Password:', password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">メールアドレス:</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password">パスワード:</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button type="submit">ログイン</button>
    </form>
  );
}
```

### 複数の Input の処理

```typescript
type FormData = {
  username: string;
  email: string;
  age: number;
  bio: string;
};

function RegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    age: 0,
    bio: ''
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('フォームデータ:', formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="username"
        value={formData.username}
        onChange={handleChange}
        placeholder="ユーザー名"
      />
      <input
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="メールアドレス"
      />
      <input
        name="age"
        type="number"
        value={formData.age}
        onChange={handleChange}
        placeholder="年齢"
      />
      <textarea
        name="bio"
        value={formData.bio}
        onChange={handleChange}
        placeholder="自己紹介"
      />
      <button type="submit">登録</button>
    </form>
  );
}
```

### バリデーション

```typescript
function ValidatedForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      return 'メールアドレスを入力してください。';
    }
    if (!emailRegex.test(value)) {
      return '正しいメールアドレスを入力してください。';
    }
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setError(validateEmail(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    console.log('送信:', email);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={handleChange}
        placeholder="メールアドレス"
        style={{ borderColor: error ? 'red' : 'gray' }}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={!!error}>
        送信
      </button>
    </form>
  );
}
```

---

## Event オブジェクト

### Synthetic Events

React は、ブラウザのネイティブ event をラップした **Synthetic Events** を提供します。

```typescript
function EventExample() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Event の種類:', e.type);           // "click"
    console.log('対象の要素:', e.currentTarget); // <button>
    console.log('クリック位置:', e.clientX, e.clientY);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('押されたキー:', e.key);
    console.log('Shift キー:', e.shiftKey);
    console.log('Ctrl キー:', e.ctrlKey);
  };

  return (
    <div>
      <button onClick={handleClick}>クリック</button>
      <input onKeyDown={handleKeyDown} placeholder="キーを押してください" />
    </div>
  );
}
```

### デフォルト動作のキャンセル

```typescript
function PreventDefaultExample() {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();  // ページ遷移を防ぐ
    console.log('リンクがクリックされましたが、遷移しません');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();  // フォーム送信を防ぐ
    console.log('フォームが送信されましたが、ページはリロードされません');
  };

  return (
    <div>
      <a href="https://example.com" onClick={handleLinkClick}>
        クリック（遷移しない）
      </a>

      <form onSubmit={handleSubmit}>
        <button type="submit">送信</button>
      </form>
    </div>
  );
}
```

### Event の伝播（バブリング）

```typescript
function BubblingExample() {
  const handleParentClick = () => {
    console.log('親がクリックされました');
  };

  const handleChildClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();  // 親への event の伝播を止める
    console.log('子がクリックされました');
  };

  return (
    <div onClick={handleParentClick} style={{ padding: '20px', border: '1px solid black' }}>
      親
      <button onClick={handleChildClick}>
        子（クリックしても親には伝わらない）
      </button>
    </div>
  );
}
```

---

## Event handler への引数渡し

### 方法 1：アロー関数（最も一般的）

```typescript
function ButtonList() {
  const handleClick = (id: number) => {
    console.log(`ボタン ${id} がクリックされました`);
  };

  return (
    <div>
      <button onClick={() => handleClick(1)}>ボタン 1</button>
      <button onClick={() => handleClick(2)}>ボタン 2</button>
      <button onClick={() => handleClick(3)}>ボタン 3</button>
    </div>
  );
}
```

### 方法 2：bind（古い書き方）

```typescript
function ButtonList() {
  const handleClick = (id: number) => {
    console.log(`ボタン ${id} がクリックされました`);
  };

  return (
    <div>
      <button onClick={handleClick.bind(null, 1)}>ボタン 1</button>
      <button onClick={handleClick.bind(null, 2)}>ボタン 2</button>
    </div>
  );
}
```

### 方法 3：カリー化（上級者向け）

```typescript
function ButtonList() {
  const handleClick = (id: number) => () => {
    console.log(`ボタン ${id} がクリックされました`);
  };

  return (
    <div>
      <button onClick={handleClick(1)}>ボタン 1</button>
      <button onClick={handleClick(2)}>ボタン 2</button>
    </div>
  );
}
```

---

## リストの描画（詳細）

### 基本的なリスト

```typescript
function FruitList() {
  const fruits = ['りんご', 'バナナ', 'みかん'];

  return (
    <ul>
      {fruits.map((fruit, index) => (
        <li key={index}>{fruit}</li>
      ))}
    </ul>
  );
}
```

### オブジェクトの配列

```typescript
type Product = {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
};

function ProductList() {
  const products: Product[] = [
    { id: 1, name: 'ノートPC', price: 89800, inStock: true },
    { id: 2, name: 'マウス', price: 2980, inStock: true },
    { id: 3, name: 'キーボード', price: 5980, inStock: false }
  ];

  return (
    <div>
      {products.map(product => (
        <div key={product.id} className="product-card">
          <h3>{product.name}</h3>
          <p>¥{product.price.toLocaleString()}</p>
          <p>{product.inStock ? '在庫あり' : '在庫なし'}</p>
          <button disabled={!product.inStock}>
            購入する
          </button>
        </div>
      ))}
    </div>
  );
}
```

### フィルタリングとソート

```typescript
type Task = {
  id: number;
  text: string;
  completed: boolean;
  priority: number;
};

function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: '買い物', completed: false, priority: 2 },
    { id: 2, text: '掃除', completed: true, priority: 1 },
    { id: 3, text: '料理', completed: false, priority: 3 }
  ]);

  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredTasks = tasks
    .filter(task => {
      if (filter === 'active') return !task.completed;
      if (filter === 'completed') return task.completed;
      return true;
    })
    .sort((a, b) => a.priority - b.priority);

  return (
    <div>
      <div>
        <button onClick={() => setFilter('all')}>すべて</button>
        <button onClick={() => setFilter('active')}>未完了</button>
        <button onClick={() => setFilter('completed')}>完了済み</button>
      </div>

      <ul>
        {filteredTasks.map(task => (
          <li key={task.id}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => {
                setTasks(tasks.map(t =>
                  t.id === task.id ? { ...t, completed: !t.completed } : t
                ));
              }}
            />
            <span style={{
              textDecoration: task.completed ? 'line-through' : 'none'
            }}>
              {task.text}（優先度: {task.priority}）
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## key の重要性

### key が必要な理由

**key** は、React がリスト内の各要素を識別するために必要です。key がないと、React はリストを効率的に更新できません。

```typescript
// NG：key なし（警告が出る）
<ul>
  {items.map(item => <li>{item}</li>)}
</ul>
// 警告: Each child in a list should have a unique "key" prop.

// OK：key あり
<ul>
  {items.map((item, index) => (
    <li key={index}>{item}</li>
  ))}
</ul>
```

### key の選び方

#### 1. ユニークな ID（推奨）

```typescript
type User = {
  id: string;
  name: string;
};

const users: User[] = [
  { id: 'u1', name: 'Alice' },
  { id: 'u2', name: 'Bob' }
];

<ul>
  {users.map(user => (
    <li key={user.id}>{user.name}</li>
  ))}
</ul>
```

#### 2. index（並び替えや削除がない静的なリストのみ）

```typescript
const fruits = ['りんご', 'バナナ', 'みかん'];

<ul>
  {fruits.map((fruit, index) => (
    <li key={index}>{fruit}</li>
  ))}
</ul>
```

#### 3. index を key に使う問題点

```typescript
function TodoList() {
  const [todos, setTodos] = useState(['買い物', '掃除', '料理']);

  const deleteTodo = (index: number) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <ul>
      {todos.map((todo, index) => (
        // NG：index を key に使うと削除時に問題が起きる
        <li key={index}>
          {todo}
          <button onClick={() => deleteTodo(index)}>削除</button>
        </li>
      ))}
    </ul>
  );
}
```

**問題点**：「掃除」を削除すると index が振り直されます。React はどの要素が削除されたか正確に判断できず、予期しない動作が起きることがあります。

**解決策**：ユニークな ID を使いましょう。

```typescript
type Todo = {
  id: string;
  text: string;
};

function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: '1', text: '買い物' },
    { id: '2', text: '掃除' },
    { id: '3', text: '料理' }
  ]);

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <ul>
      {todos.map(todo => (
        // OK：ID を key に使う
        <li key={todo.id}>
          {todo.text}
          <button onClick={() => deleteTodo(todo.id)}>削除</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## よくある間違い

### 間違い 1：handler を渡す代わりに呼び出してしまう

```typescript
// NG：即座に呼び出されてしまう
<button onClick={handleClick()}>クリック</button>

// OK：関数の参照を渡す
<button onClick={handleClick}>クリック</button>

// またはアロー関数でラップする
<button onClick={() => handleClick()}>クリック</button>
```

### 間違い 2：e.preventDefault を忘れる

```typescript
// NG：フォーム送信でページがリロードされる
const handleSubmit = () => {
  console.log('送信');
};

<form onSubmit={handleSubmit}>...</form>

// OK
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  console.log('送信');
};
```

### 間違い 3：オブジェクトを key に使う

```typescript
// NG：レンダリングごとに新しいオブジェクトが生成される
{items.map(item => (
  <div key={{ id: item.id }}>
    {item.name}
  </div>
))}

// OK：プリミティブ値を使う
{items.map(item => (
  <div key={item.id}>
    {item.name}
  </div>
))}
```

---

## 演習問題

### 演習 1：検索可能なリスト

**難易度**：中級

以下の機能を持つユーザーリストを作成してください：
- ユーザーの一覧を表示する
- 名前で絞り込める検索ボックス
- リアルタイムで検索結果を更新する

**解答例**:
```typescript
import { useState } from 'react';

type User = {
  id: number;
  name: string;
  email: string;
};

function UserList() {
  const [users] = useState<User[]>([
    { id: 1, name: '山田 太郎', email: 'taro@example.com' },
    { id: 2, name: '鈴木 花子', email: 'hanako@example.com' },
    { id: 3, name: '佐藤 次郎', email: 'jiro@example.com' }
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="ユーザーを検索..."
      />

      <p>検索結果: {filteredUsers.length} 件</p>

      <ul>
        {filteredUsers.map(user => (
          <li key={user.id}>
            <strong>{user.name}</strong> — {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 演習 2：フォーム付き TODO リスト（フル機能版）

**難易度**：上級

以下の機能を持つ TODO リストを作成してください：
- TODO を追加する（フォームあり）
- TODO を削除する
- 完了／未完了を切り替える
- 優先度の選択
- フィルター（すべて／未完了／完了済み）
- 優先度でソート

**解答例**:
```typescript
import { useState } from 'react';

type Todo = {
  id: number;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
};

function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setTodos([
        ...todos,
        { id: Date.now(), text: input, completed: false, priority }
      ]);
      setInput('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const priorityOrder = { high: 1, medium: 2, low: 3 };

  const filteredTodos = todos
    .filter(todo => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return (
    <div>
      <h1>TODO リスト</h1>

      <form onSubmit={addTodo}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="新しい TODO"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
        >
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
        <button type="submit">追加</button>
      </form>

      <div>
        <button onClick={() => setFilter('all')}>すべて</button>
        <button onClick={() => setFilter('active')}>未完了</button>
        <button onClick={() => setFilter('completed')}>完了済み</button>
      </div>

      <ul>
        {filteredTodos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span style={{
              textDecoration: todo.completed ? 'line-through' : 'none'
            }}>
              {todo.text}
            </span>
            <span className={`priority-${todo.priority}`}>
              [{todo.priority}]
            </span>
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

- React の event handling の基本
- 各種 event の扱い方（click・input・キーボードなど）
- Controlled forms とバリデーション
- event オブジェクトの活用
- 効率的なリスト描画
- `key` の重要性と適切な選び方

**おめでとうございます！** React の基礎シリーズをすべて完了しました。

### 次に学ぶこと

1. **[Hooks 完全ガイド](../02-hooks/hooks-mastery.md)** — useEffect・useContext・カスタム Hooks など
2. **[TypeScript パターンガイド](../03-typescript/typescript-patterns.md)** — 型安全な React 開発
3. **[パフォーマンス最適化ガイド](../04-optimization/optimization-complete.md)** — React.memo・useMemo・useCallback

### 関連リソース

- [React: Responding to Events](https://react.dev/learn/responding-to-events)
- [React: Rendering Lists](https://react.dev/learn/rendering-lists)
- [React Tutorial: Tic-Tac-Toe](https://react.dev/learn/tutorial-tic-tac-toe)

---

**前のガイド**: [06-state-basics.md](./06-state-basics.md)

**親ガイド**: [React Development - SKILL.md](../../SKILL.md)
