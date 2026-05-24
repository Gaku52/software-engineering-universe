# JSX の基礎 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [前提知識](#前提知識)
3. [JSX とは](#jsx-とは)
4. [JSX の基本構文](#jsx-の基本構文)
5. [JavaScript の埋め込み](#javascript-の埋め込み)
6. [属性（Attributes）](#属性attributes)
7. [条件付きレンダリング](#条件付きレンダリング)
8. [リストのレンダリング](#リストのレンダリング)
9. [Fragment](#fragment)
10. [よくあるミス](#よくあるミス)
11. [演習](#演習)
12. [次のステップ](#次のステップ)

---

## 概要

### このガイドで学ぶこと

- JSX の基本概念と仕組み
- HTML に似た構文で UI を記述する方法
- JSX 内に JavaScript の式を埋め込む方法
- 条件分岐とループの実装方法
- JSX の制約とルール

### なぜ重要なのか

**JSX（JavaScript XML）** は React 最大の特徴的な構文です。JSX を使うと：
- **直感的に UI を記述できる**：HTML のように見えるコンポーネントを書ける
- **型安全性を確保できる**：TypeScript と組み合わせて安全なコードを書ける
- **表現力が高い**：UI の記述に JavaScript の機能をフルに活用できる

### 学習時間の目安

- このガイドを読むだけ：30〜40 分
- 演習まで含めた完全理解：1〜2 時間

---

## 前提知識

### 必須の知識

1. **HTML の基礎**：タグの構造（`<div>`・`<p>`・`<button>` など）と属性（`class`・`id`・`href` など）
2. **JavaScript の基礎**：変数（`const`・`let`）・関数（アロー関数）・配列メソッド（`map`・`filter`）・テンプレートリテラル
3. **React の環境構築**：先に [02-setup-environment.md](./02-setup-environment.md) を完了しておくこと

---

## JSX とは

### 公式の定義

> JSX は JavaScript のシンタックス拡張で、JavaScript ファイル内に HTML に似たマークアップを書けるようにするものです。

### もう少し詳しく説明すると

JSX は次のような特徴を持つ **JavaScript のシンタックス拡張**です：

#### 1. HTML のように見えるが、JavaScript である

```typescript
// これは JSX
const element = <h1>こんにちは、世界！</h1>;

// ブラウザはそのまま理解できないので、Babel が次のように変換する：
const element = React.createElement('h1', null, 'こんにちは、世界！');
```

#### 2. JSX はオブジェクトを生成する

JSX は最終的に **React 要素**（JavaScript オブジェクト）になります。

```typescript
// JSX
<div className="container">こんにちは</div>

// 変換後の内部表現
{
  type: 'div',
  props: {
    className: 'container',
    children: 'こんにちは'
  }
}
```

#### 3. JSX はどこでも使える

JSX は式なので、変数に代入したり、引数として渡したり、関数から返したりできます。

```typescript
// 変数に代入する
const greeting = <h1>こんにちは</h1>;

// 引数として渡す
const element = renderElement(<p>テキスト</p>);

// 関数から返す
function Component() {
  return <div>コンテンツ</div>;
}
```

---

## JSX の基本構文

### 1. ルート要素は 1 つだけ

JSX は**必ず 1 つのルート要素**で囲む必要があります。

```typescript
// NG：ルート要素が複数ある
function Component() {
  return (
    <h1>タイトル</h1>
    <p>本文</p>
  );
}

// OK：div で囲む
function Component() {
  return (
    <div>
      <h1>タイトル</h1>
      <p>本文</p>
    </div>
  );
}

// より良い：Fragment を使う（後述）
function Component() {
  return (
    <>
      <h1>タイトル</h1>
      <p>本文</p>
    </>
  );
}
```

### 2. すべてのタグを閉じる

JSX では、HTML で閉じタグが不要なものも含め、すべてのタグを閉じる必要があります。

```typescript
// NG：閉じていない（HTML では有効だが JSX では無効）
<img src="image.jpg">
<input type="text">
<br>

// OK：自己終了タグを使う
<img src="image.jpg" />
<input type="text" />
<br />
```

### 3. camelCase を使う

HTML の属性は JSX では camelCase で書きます。

```typescript
// HTML
<div class="container" onclick="handleClick()">

// JSX
<div className="container" onClick={handleClick}>
```

**よく使う変換一覧**：

| HTML | JSX |
|------|-----|
| `class` | `className` |
| `for` | `htmlFor` |
| `onclick` | `onClick` |
| `onchange` | `onChange` |
| `tabindex` | `tabIndex` |

`class` と `for` は JavaScript の予約語なので、JSX では別の名前を使います。

---

## JavaScript の埋め込み

### `{}` で式を埋め込む

JSX 内で `{}` を使うと、JavaScript の式を評価して表示できます。

#### 1. 変数

```typescript
function Greeting() {
  const name = "Alice";
  const age = 25;

  return (
    <div>
      <h1>こんにちは、{name}！</h1>
      <p>あなたは {age} 歳です。</p>
    </div>
  );
}
```

#### 2. 式

```typescript
function Calculator() {
  const a = 10;
  const b = 20;

  return (
    <div>
      <p>{a} + {b} = {a + b}</p>
      <p>{a} × {b} = {a * b}</p>
    </div>
  );
}
```

#### 3. 関数の呼び出し

```typescript
function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP');
}

function App() {
  return (
    <div>
      <p>今日は {formatDate(new Date())} です</p>
    </div>
  );
}
```

#### 4. テンプレートリテラル

```typescript
function UserCard() {
  const firstName = "太郎";
  const lastName = "山田";

  return (
    <div>
      <h2>{`${lastName} ${firstName}`}</h2>
      <p>フルネーム: {`${firstName} ${lastName}`}</p>
    </div>
  );
}
```

### 重要な制約

`{}` 内に書けるのは**式（expression）**だけで、**文（statement）**は書けません。

```typescript
// NG：if 文は式ではない
<div>
  {if (isLoggedIn) { "ログイン済み" }}
</div>

// OK：三項演算子（式）を使う
<div>
  {isLoggedIn ? "ログイン済み" : "未ログイン"}
</div>

// NG：for 文は式ではない
<ul>
  {for (let i = 0; i < 5; i++) { <li>{i}</li> }}
</ul>

// OK：map（式）を使う
<ul>
  {[0, 1, 2, 3, 4].map(i => <li key={i}>{i}</li>)}
</ul>
```

---

## 属性（Attributes）

### 1. 文字列リテラル

```typescript
<img src="logo.png" alt="ロゴ" />
<a href="https://example.com">リンク</a>
```

### 2. JavaScript の式

```typescript
function Avatar() {
  const imageUrl = "https://example.com/avatar.jpg";
  const size = 100;
  const userName = "Alice";

  return (
    <img
      src={imageUrl}
      width={size}
      height={size}
      alt={`${userName} のアバター`}
    />
  );
}
```

### 3. 真偽値の属性

```typescript
<button disabled={true}>無効なボタン</button>
<button disabled={false}>有効なボタン</button>

// {true} は省略できる
<button disabled>無効なボタン</button>

// {false} は属性ごと省略する
<button>有効なボタン</button>
```

### 4. style 属性

スタイルは**オブジェクト**で指定し、プロパティ名は camelCase で書きます。

```typescript
function StyledBox() {
  const boxStyle = {
    backgroundColor: 'lightblue',  // background-color → backgroundColor
    fontSize: '20px',               // font-size → fontSize
    padding: '10px',
    borderRadius: '8px'             // border-radius → borderRadius
  };

  return (
    <div style={boxStyle}>
      スタイル付きボックス
    </div>
  );
}

// インラインで書く場合（二重の波括弧に注意）
<div style={{ color: 'red', fontSize: '24px' }}>
  赤いテキスト
</div>
```

**なぜ二重波括弧 `{{ }}` なのか**：
- 外側の `{}`：JavaScript の式の開始
- 内側の `{}`：オブジェクトリテラル

---

## 条件付きレンダリング

### 1. 三項演算子（最もよく使う）

```typescript
function LoginButton() {
  const isLoggedIn = false;

  return (
    <div>
      {isLoggedIn ? (
        <button>ログアウト</button>
      ) : (
        <button>ログイン</button>
      )}
    </div>
  );
}
```

### 2. 論理 AND 演算子（`&&`）

条件が **true のときだけ**表示したい場合に使います。

```typescript
function Notification() {
  const hasNewMessages = true;
  const messageCount = 5;

  return (
    <div>
      <h1>メッセージ</h1>
      {hasNewMessages && (
        <div className="notification">
          新着メッセージが {messageCount} 件あります
        </div>
      )}
    </div>
  );
}
```

**注意**：`false`・`null`・`undefined` は描画されませんが、**`0` は描画されます**。

```typescript
function Counter() {
  const count = 0;

  return (
    <div>
      {/* NG：0 が表示されてしまう */}
      {count && <p>カウント: {count}</p>}

      {/* OK：明示的に比較する */}
      {count > 0 && <p>カウント: {count}</p>}
    </div>
  );
}
```

### 3. 複数条件（if-else if-else）

```typescript
function UserStatus({ status }: { status: 'online' | 'offline' | 'away' }) {
  return (
    <div>
      {status === 'online' ? (
        <span className="status-online">オンライン</span>
      ) : status === 'away' ? (
        <span className="status-away">退席中</span>
      ) : (
        <span className="status-offline">オフライン</span>
      )}
    </div>
  );
}
```

### 4. 変数に代入する（複雑な条件のとき）

条件が複雑な場合は、変数に代入してから JSX に渡すと読みやすくなります。

```typescript
function UserGreeting({ user }: { user: { name: string; isAdmin: boolean } | null }) {
  let content;

  if (!user) {
    content = <p>ゲストユーザー</p>;
  } else if (user.isAdmin) {
    content = <p>管理者: {user.name}</p>;
  } else {
    content = <p>ユーザー: {user.name}</p>;
  }

  return <div>{content}</div>;
}
```

---

## リストのレンダリング

### 1. `map` 関数を使う

配列をレンダリングするには `map()` を使います。

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

### 2. `key` prop（重要）

**key** は React がリスト内の各要素を識別するために必要です。

```typescript
// NG：key がない（警告が出る）
<ul>
  {fruits.map(fruit => <li>{fruit}</li>)}
</ul>
// Warning: Each child in a list should have a unique "key" prop.

// OK：key を指定する
<ul>
  {fruits.map((fruit, index) => (
    <li key={index}>{fruit}</li>
  ))}
</ul>
```

**key の選び方**：
1. **一意な ID**（推奨）：`<li key={item.id}>`
2. **インデックス**（静的なリストのみ）：`<li key={index}>`
3. **内容**（暫定的な方法）：`<li key={item.name}>`

```typescript
// ベストプラクティス：ID を key に使う
type Todo = {
  id: string;
  text: string;
  completed: boolean;
};

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

### 3. オブジェクトの配列

```typescript
type User = {
  id: number;
  name: string;
  email: string;
};

function UserList() {
  const users: User[] = [
    { id: 1, name: '山田 太郎', email: 'taro@example.com' },
    { id: 2, name: '鈴木 花子', email: 'hanako@example.com' },
    { id: 3, name: '佐藤 次郎', email: 'jiro@example.com' }
  ];

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          <strong>{user.name}</strong> — {user.email}
        </li>
      ))}
    </ul>
  );
}
```

### 4. filter と map を組み合わせる

```typescript
function ActiveTodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos
        .filter(todo => !todo.completed)  // 未完了のみ
        .map(todo => (
          <li key={todo.id}>{todo.text}</li>
        ))}
    </ul>
  );
}
```

---

## Fragment

### 問題：余分な div が増えてしまう

複数の要素を返すとき、`<div>` で囲むと DOM に不要なノードが追加されます。

```typescript
// NG：余分な <div> がテーブル構造を壊す
function Columns() {
  return (
    <div>  {/* この <div> がテーブルのレイアウトを崩す */}
      <td>カラム 1</td>
      <td>カラム 2</td>
    </div>
  );
}
```

### 解決策：Fragment

**Fragment** を使うと、余分な DOM ノードを追加せずに複数の要素をまとめられます。

```typescript
import { Fragment } from 'react';

// 方法 1：<Fragment> を使う
function Columns() {
  return (
    <Fragment>
      <td>カラム 1</td>
      <td>カラム 2</td>
    </Fragment>
  );
}

// 方法 2：省略記法 <> を使う（最も一般的）
function Columns() {
  return (
    <>
      <td>カラム 1</td>
      <td>カラム 2</td>
    </>
  );
}
```

### key を使う Fragment

リスト内で Fragment を使う場合は key が必要です。省略記法 `<>` は key をサポートしていないため、`<Fragment>` を使います。

```typescript
function DescriptionList({ items }: { items: Array<{ term: string; desc: string }> }) {
  return (
    <dl>
      {items.map(item => (
        <Fragment key={item.term}>
          <dt>{item.term}</dt>
          <dd>{item.desc}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```

---

## よくあるミス

### ミス 1：ルート要素が複数ある

```typescript
// NG
function Component() {
  return (
    <h1>タイトル</h1>
    <p>本文</p>
  );
}
// Error: Adjacent JSX elements must be wrapped in an enclosing tag.

// OK
function Component() {
  return (
    <>
      <h1>タイトル</h1>
      <p>本文</p>
    </>
  );
}
```

### ミス 2：`className` の代わりに `class` を使っている

```typescript
<div class="container">       // NG：class は予約語
<div className="container">   // OK
```

### ミス 3：`style` に文字列を渡している

```typescript
<div style="color: red; font-size: 20px;">   // NG

<div style={{ color: 'red', fontSize: '20px' }}>  // OK
```

### ミス 4：タグを閉じ忘れている

```typescript
<img src="logo.png">     // NG
<input type="text">      // NG

<img src="logo.png" />   // OK
<input type="text" />    // OK
```

### ミス 5：`key` を指定していない

```typescript
{items.map(item => <li>{item}</li>)}
// Warning: Each child in a list should have a unique "key" prop.

{items.map((item, index) => <li key={index}>{item}</li>)}  // OK
```

### ミス 6：条件付きレンダリングで `0` が表示される

```typescript
const count = 0;
return <div>{count && <p>カウント: {count}</p>}</div>;
// 出力: 0（数値の 0 が描画される）

// OK
return <div>{count > 0 && <p>カウント: {count}</p>}</div>;
// 出力: （何も表示されない）
```

---

## 演習

### 演習 1：ユーザープロフィール

**難易度**：初級

次の情報を表示するコンポーネントを作ってください：
- 名前
- 年齢
- メールアドレス
- 自己紹介文（ある場合のみ表示）

**解答例**：
```typescript
type User = {
  name: string;
  age: number;
  email: string;
  bio?: string;
};

function UserProfile() {
  const user: User = {
    name: '山田 太郎',
    age: 28,
    email: 'taro@example.com',
    bio: 'Web 開発が好きです。'
  };

  return (
    <div className="profile">
      <h1>{user.name}</h1>
      <p>年齢: {user.age} 歳</p>
      <p>メール: {user.email}</p>
      {user.bio && (
        <div className="bio">
          <h2>自己紹介</h2>
          <p>{user.bio}</p>
        </div>
      )}
    </div>
  );
}
```

### 演習 2：買い物リスト

**難易度**：中級

次の機能を持つ買い物リストを作ってください：
- 商品名と価格を表示する
- 合計金額を計算して表示する
- 1,000 円以上の商品は赤色で表示する

**解答例**：
```typescript
type Item = {
  id: number;
  name: string;
  price: number;
};

function ShoppingList() {
  const items: Item[] = [
    { id: 1, name: 'りんご', price: 200 },
    { id: 2, name: '牛乳', price: 300 },
    { id: 3, name: 'ノートPC', price: 80000 },
    { id: 4, name: '食パン', price: 400 }
  ];

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div>
      <h1>買い物リスト</h1>
      <ul>
        {items.map(item => (
          <li
            key={item.id}
            style={{
              color: item.price >= 1000 ? 'red' : 'black',
              fontWeight: item.price >= 1000 ? 'bold' : 'normal'
            }}
          >
            {item.name}: ¥{item.price.toLocaleString()}
          </li>
        ))}
      </ul>
      <p className="total">合計: ¥{total.toLocaleString()}</p>
    </div>
  );
}
```

---

## 次のステップ

### このガイドで学んだこと

- JSX の基本概念と仕組み
- JavaScript の式を埋め込む（`{}`）
- 属性の書き方（`className`・`style` など）
- 条件付きレンダリング（三項演算子・`&&`）
- リストのレンダリング（`map`・`key`）
- Fragment の使い方

### 次に読むガイド

1. **[04-components-intro.md](./04-components-intro.md)** — コンポーネントの分割・props の渡し方・コンポーネント設計の基礎
2. **[05-props-basics.md](./05-props-basics.md)** — props の詳細・TypeScript の型定義・デフォルト値

### 参考リンク

- [React: JSX でマークアップを書く](https://ja.react.dev/learn/writing-markup-with-jsx)
- [React: JSX に波括弧で JavaScript を含める](https://ja.react.dev/learn/javascript-in-jsx-with-curly-braces)
- [Babel REPL](https://babeljs.io/repl) — JSX がどう変換されるか確認できる

---

**次のガイド**: [04-components-intro.md](./04-components-intro.md)

**前のガイド**: [02-setup-environment.md](./02-setup-environment.md)

**上位ガイド**: [React 開発 - SKILL.md](../../SKILL.md)
