# Props の基礎 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [前提知識](#前提知識)
3. [Props とは](#props-とは)
4. [基本的な使い方](#基本的な使い方)
5. [TypeScript の型定義](#typescript-の型定義)
6. [デフォルト値](#デフォルト値)
7. [children prop](#children-prop)
8. [Props の不変性](#props-の不変性)
9. [よくあるミス](#よくあるミス)
10. [演習](#演習)
11. [次のステップ](#次のステップ)

---

## 概要

### このガイドで学ぶこと

- Props の基本概念と仕組み
- 親コンポーネントから子コンポーネントへのデータの受け渡し
- TypeScript を使った型安全な Props の定義
- デフォルト値の設定
- `children` prop の使い方
- Props の不変性ルール

### なぜ重要なのか

**Props**（"properties" の略）は、React コンポーネント間でデータを受け渡すための仕組みです。Props を理解すると：
- **再利用可能なコンポーネント**：同じコンポーネントに異なるデータを渡せる
- **明確なデータの流れ**：親から子への一方向のデータフローを実現できる
- **型安全性**：TypeScript がコンパイル時にミスを検出してくれる

### 学習時間の目安

- このガイドを読むだけ：30〜40 分
- 演習まで含めた完全理解：1〜2 時間

---

## 前提知識

### 必須の知識

1. **コンポーネントの基礎**：先に [04-components-intro.md](./04-components-intro.md) を完了しておくこと
2. **TypeScript の基礎**：型アノテーション（`: string`・`: number` など）と `type` / `interface` の定義
3. **JavaScript ES6**：オブジェクト（`{ key: value }`）・分割代入（`const { name } = user`）

---

## Props とは

### 定義

**Props** は**親コンポーネントから子コンポーネントへ渡すデータ**です。

```typescript
// 親コンポーネント
function App() {
  return <Greeting name="Alice" />;  // name prop を渡す
}

// 子コンポーネント
function Greeting({ name }: { name: string }) {
  return <h1>こんにちは、{name}！</h1>;
}

// 出力: こんにちは、Alice！
```

### HTML 属性との対比

Props は HTML の属性に似ています。

```html
<!-- HTML -->
<img src="logo.png" alt="ロゴ" width="100" />

<!-- React -->
<Avatar imageUrl="logo.png" altText="ロゴ" size={100} />
```

### 一方向のデータフロー

React ではデータは**親から子へ**一方向に流れます。

```
App（親）
  ↓ name="Alice"
Greeting（子）
```

**重要**：子コンポーネントは受け取った Props を**読み取り専用**として扱います（後述）。

---

## 基本的な使い方

### 1. シンプルな例

```typescript
// 子コンポーネント
function Welcome({ name }: { name: string }) {
  return <h1>ようこそ、{name}！</h1>;
}

// 親コンポーネント
function App() {
  return (
    <div>
      <Welcome name="Alice" />
      <Welcome name="Bob" />
      <Welcome name="Carol" />
    </div>
  );
}

// 出力:
// ようこそ、Alice！
// ようこそ、Bob！
// ようこそ、Carol！
```

### 2. 複数の Props

```typescript
type UserCardProps = {
  name: string;
  age: number;
  occupation: string;
};

function UserCard({ name, age, occupation }: UserCardProps) {
  return (
    <div className="user-card">
      <h2>{name}</h2>
      <p>年齢: {age} 歳</p>
      <p>職業: {occupation}</p>
    </div>
  );
}

// 使い方
<UserCard name="山田 太郎" age={28} occupation="エンジニア" />
```

### 3. さまざまな型の Props

```typescript
type ProductProps = {
  name: string;          // 文字列
  price: number;         // 数値
  inStock: boolean;      // 真偽値
  tags: string[];        // 配列
  manufacturer: {        // オブジェクト
    name: string;
    country: string;
  };
  onBuy: () => void;     // 関数
};

function Product({
  name,
  price,
  inStock,
  tags,
  manufacturer,
  onBuy
}: ProductProps) {
  return (
    <div className="product">
      <h2>{name}</h2>
      <p>価格: ¥{price.toLocaleString()}</p>
      <p>{inStock ? '在庫あり' : '在庫なし'}</p>
      <p>タグ: {tags.join(', ')}</p>
      <p>製造元: {manufacturer.name}（{manufacturer.country}）</p>
      <button onClick={onBuy} disabled={!inStock}>
        今すぐ購入
      </button>
    </div>
  );
}

// 使い方
<Product
  name="ノートPC"
  price={89900}
  inStock={true}
  tags={['電子機器', '人気商品']}
  manufacturer={{ name: 'テックコープ', country: '日本' }}
  onBuy={() => alert('購入しました！')}
/>
```

---

## TypeScript の型定義

### 1. インライン型定義（シンプルな場合）

```typescript
function Greeting({ name }: { name: string }) {
  return <h1>こんにちは、{name}！</h1>;
}
```

### 2. type エイリアス（推奨）

```typescript
type GreetingProps = {
  name: string;
};

function Greeting({ name }: GreetingProps) {
  return <h1>こんにちは、{name}！</h1>;
}
```

### 3. interface（オブジェクト指向スタイル）

```typescript
interface GreetingProps {
  name: string;
}

function Greeting({ name }: GreetingProps) {
  return <h1>こんにちは、{name}！</h1>;
}
```

**`type` vs `interface`**：
- `type`：柔軟性が高い（ユニオン型・交差型なども使える）
- `interface`：継承できる（`extends`）

Props には `type` を使うのが一般的な慣習です。

### 4. オプショナルな Props

```typescript
type UserCardProps = {
  name: string;
  age: number;
  email?: string;   // オプショナル（? を付ける）
  bio?: string;
};

function UserCard({ name, age, email, bio }: UserCardProps) {
  return (
    <div>
      <h2>{name}</h2>
      <p>年齢: {age} 歳</p>
      {email && <p>メール: {email}</p>}
      {bio && <p>自己紹介: {bio}</p>}
    </div>
  );
}

// email と bio は省略できる
<UserCard name="Alice" age={25} />
<UserCard name="Bob" age={30} email="bob@example.com" />
```

### 5. ユニオン型（複数の値のうちどれか）

```typescript
type ButtonProps = {
  text: string;
  variant: 'primary' | 'secondary' | 'danger';  // この 3 つのどれか
};

function Button({ text, variant }: ButtonProps) {
  const className = `btn btn-${variant}`;
  return <button className={className}>{text}</button>;
}

// 使い方
<Button text="送信" variant="primary" />
<Button text="キャンセル" variant="secondary" />
<Button text="削除" variant="danger" />
// <Button text="保存" variant="success" />  // TypeScript エラー！
```

---

## デフォルト値

### 1. 分割代入でデフォルト値を設定する（推奨）

```typescript
type GreetingProps = {
  name: string;
  greeting?: string;
};

function Greeting({ name, greeting = "こんにちは" }: GreetingProps) {
  return <h1>{greeting}、{name}！</h1>;
}

// 使い方
<Greeting name="Alice" />
// 出力: こんにちは、Alice！

<Greeting name="Bob" greeting="おはようございます" />
// 出力: おはようございます、Bob！
```

### 2. 複数のデフォルト値

```typescript
type ButtonProps = {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
};

function Button({
  text,
  variant = 'primary',
  disabled = false,
  size = 'medium'
}: ButtonProps) {
  const className = `btn btn-${variant} btn-${size}`;

  return (
    <button className={className} disabled={disabled}>
      {text}
    </button>
  );
}

// 使い方
<Button text="送信" />
// variant="primary", disabled=false, size="medium" が自動で適用される
```

### 3. オブジェクトのデフォルト値

```typescript
type UserCardProps = {
  user?: {
    name: string;
    age: number;
  };
};

function UserCard({
  user = { name: 'ゲスト', age: 0 }
}: UserCardProps) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.age} 歳</p>
    </div>
  );
}

// 使い方
<UserCard />
// 出力: ゲスト、0 歳

<UserCard user={{ name: 'Alice', age: 25 }} />
// 出力: Alice、25 歳
```

---

## children prop

### children とは

`children` は、**コンポーネントの開始タグと終了タグの間に置かれたコンテンツ**を表す特別な prop です。

```typescript
// children を受け取るコンポーネント
type CardProps = {
  children: React.ReactNode;
};

function Card({ children }: CardProps) {
  return (
    <div className="card">
      {children}
    </div>
  );
}

// 使い方
<Card>
  <h2>タイトル</h2>
  <p>本文テキスト</p>
</Card>
```

### children の型

```typescript
import { ReactNode } from 'react';

type ContainerProps = {
  children: ReactNode;  // React のコンテンツとして最も柔軟な型
};

function Container({ children }: ContainerProps) {
  return <div className="container">{children}</div>;
}
```

**ReactNode に含められるもの**：
- 文字列（`"テキスト"`）
- 数値（`123`）
- JSX 要素（`<div>...</div>`）
- 配列（`[<p>1</p>, <p>2</p>]`）
- `null` / `undefined`

### 実用例：レイアウトコンポーネント

```typescript
type PageLayoutProps = {
  children: ReactNode;
};

function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      <header>
        <h1>マイアプリ</h1>
      </header>
      <main>{children}</main>
      <footer>© 2024</footer>
    </div>
  );
}

// 使い方
<PageLayout>
  <h2>ホームページ</h2>
  <p>ようこそ！</p>
</PageLayout>

<PageLayout>
  <h2>プロフィールページ</h2>
  <UserProfile />
</PageLayout>
```

### 複数のスロット

```typescript
type ModalProps = {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

function Modal({ title, children, footer }: ModalProps) {
  return (
    <div className="modal">
      <header>{title}</header>
      <main>{children}</main>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}

// 使い方
<Modal
  title={<h2>確認</h2>}
  footer={
    <>
      <button>OK</button>
      <button>キャンセル</button>
    </>
  }
>
  <p>本当に削除しますか？</p>
</Modal>
```

---

## Props の不変性

### 重要なルール：Props は読み取り専用

**Props を直接変更してはいけません。** これは React の重要なルールです。

```typescript
type CounterProps = {
  count: number;
};

function Counter({ count }: CounterProps) {
  // NG：prop を変更している
  count = count + 1;

  return <div>{count}</div>;
}
```

**理由**：
- **予測可能性**：一方向のデータフローはバグの追跡がしやすい
- **デバッグのしやすさ**：バグの原因を特定しやすくなる
- **パフォーマンス最適化**：React が再描画のタイミングを効率的に判断できる

### 正しいアプローチ：State を使う

変更が必要な値には、Props ではなく **State** を使います。

```typescript
import { useState } from 'react';

function Counter() {
  // OK：useState を使う
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>
        +1
      </button>
    </div>
  );
}
```

**State** については次のガイド [06-state-basics.md](./06-state-basics.md) で詳しく説明します。

### 配列・オブジェクトも変更禁止

```typescript
type UserListProps = {
  users: string[];
};

function UserList({ users }: UserListProps) {
  // NG：prop の配列を変更している
  users.push('新しいユーザー');

  return (
    <ul>
      {users.map(user => <li key={user}>{user}</li>)}
    </ul>
  );
}
```

---

## よくあるミス

### ミス 1：Props に型定義がない

```typescript
// NG
function Greeting({ name }) {  // 型がない
  return <h1>こんにちは、{name}！</h1>;
}

// OK
type GreetingProps = {
  name: string;
};

function Greeting({ name }: GreetingProps) {
  return <h1>こんにちは、{name}！</h1>;
}
```

### ミス 2：Props を変更している

```typescript
// NG
function Counter({ count }: { count: number }) {
  count = count + 1;  // prop を変更している
  return <div>{count}</div>;
}

// OK
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

### ミス 3：文字列以外をクォートで囲んでいる

```typescript
<UserCard age="25" />  // NG：文字列の "25" が渡される

<UserCard age={25} />  // OK：数値の 25 が渡される
```

**ルール**：文字列はクォート、それ以外は `{}` で渡す。

### ミス 4：必須の Props を省略している

```typescript
type UserCardProps = {
  name: string;  // 必須
  age: number;   // 必須
};

<UserCard name="Alice" />  // age が欠けている → TypeScript エラー！

// OK：必須の props をすべて渡す
<UserCard name="Alice" age={25} />

// または、オプショナルにする
type UserCardProps = {
  name: string;
  age?: number;  // オプショナル
};
```

### ミス 5：`key` を prop として使おうとしている

```typescript
// NG：key は内部で予約されている prop
function Item({ key }: { key: string }) {
  return <li>{key}</li>;
}

// OK：別の名前を使う
function Item({ id }: { id: string }) {
  return <li>{id}</li>;
}

{items.map(item => (
  <Item key={item.id} id={item.id} />
))}
```

---

## 演習

### 演習 1：商品カード

**難易度**：初級

次の Props を持つ商品カードコンポーネントを作ってください：
- `name`：商品名（文字列、必須）
- `price`：価格（数値、必須）
- `imageUrl`：画像 URL（文字列、オプショナル）
- `onSale`：セール中フラグ（真偽値、オプショナル、デフォルト: false）

**要件**：TypeScript で型を定義し、`onSale` が true のとき「セール中！」と表示する。

**解答例**：
```typescript
type ProductCardProps = {
  name: string;
  price: number;
  imageUrl?: string;
  onSale?: boolean;
};

function ProductCard({
  name,
  price,
  imageUrl = 'https://via.placeholder.com/150',
  onSale = false
}: ProductCardProps) {
  return (
    <div className="product-card">
      <img src={imageUrl} alt={name} />
      <h3>{name}</h3>
      <p className="price">¥{price.toLocaleString()}</p>
      {onSale && <span className="badge">セール中！</span>}
    </div>
  );
}

// 使い方
<ProductCard name="ノートPC" price={89900} onSale={true} />
<ProductCard name="マウス" price={2900} />
```

### 演習 2：再利用可能なボタン

**難易度**：中級

次の Props を持つボタンコンポーネントを作ってください：
- `text`：ボタンのテキスト（必須）
- `variant`：スタイル（`'primary' | 'secondary' | 'danger'`、デフォルト: `'primary'`）
- `size`：サイズ（`'small' | 'medium' | 'large'`、デフォルト: `'medium'`）
- `disabled`：無効フラグ（デフォルト: `false`）
- `onClick`：クリックハンドラ（必須）

**解答例**：
```typescript
type ButtonProps = {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick: () => void;
};

function Button({
  text,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick
}: ButtonProps) {
  const className = `btn btn-${variant} btn-${size}`;

  return (
    <button
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {text}
    </button>
  );
}

// 使い方
function App() {
  return (
    <div>
      <Button
        text="送信"
        variant="primary"
        onClick={() => alert('送信しました')}
      />
      <Button
        text="削除"
        variant="danger"
        size="small"
        onClick={() => alert('削除しました')}
      />
    </div>
  );
}
```

---

## 次のステップ

### このガイドで学んだこと

- Props の基本概念と仕組み
- TypeScript を使った型安全な Props の定義
- デフォルト値の設定
- `children` prop の使い方
- Props の不変性ルール

### 次に読むガイド

1. **[06-state-basics.md](./06-state-basics.md)** — State 管理の基礎・useState Hook・動的な UI
2. **[07-events-lists.md](./07-events-lists.md)** — イベント処理・リストのレンダリング・ユーザー操作

### 参考リンク

- [React: コンポーネントに props を渡す](https://ja.react.dev/learn/passing-props-to-a-component)
- [TypeScript: React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

---

**次のガイド**: [06-state-basics.md](./06-state-basics.md)

**前のガイド**: [04-components-intro.md](./04-components-intro.md)

**上位ガイド**: [React 開発 - SKILL.md](../../SKILL.md)
