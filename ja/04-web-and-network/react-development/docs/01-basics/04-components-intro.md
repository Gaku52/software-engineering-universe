# コンポーネント入門 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [前提知識](#前提知識)
3. [コンポーネントとは](#コンポーネントとは)
4. [関数コンポーネントの書き方](#関数コンポーネントの書き方)
5. [コンポーネントの分割](#コンポーネントの分割)
6. [import と export](#import-と-export)
7. [コンポーネント設計の原則](#コンポーネント設計の原則)
8. [コンポーネントの組み合わせ](#コンポーネントの組み合わせ)
9. [よくあるミス](#よくあるミス)
10. [演習](#演習)
11. [次のステップ](#次のステップ)

---

## 概要

### このガイドで学ぶこと

- React コンポーネントの基本概念
- 関数コンポーネントの書き方
- コンポーネントの分割と再利用
- ファイル構成と import / export
- コンポーネント設計の基本原則

### なぜ重要なのか

**コンポーネント**は React アプリケーションの構成要素です。コンポーネントを理解すると：
- **再利用できる**：一度作ったコンポーネントをどこでも使い回せる
- **保守しやすい**：小さく役割が明確なパーツなら変更しやすい
- **テストしやすい**：個々のコンポーネントを独立してテストできる
- **分業できる**：チームメンバーで担当を分けやすくなる

### 学習時間の目安

- このガイドを読むだけ：30〜40 分
- 演習まで含めた完全理解：1〜2 時間

---

## 前提知識

### 必須の知識

1. **JSX の基礎**：先に [03-jsx-fundamentals.md](./03-jsx-fundamentals.md) を完了しておくこと
2. **JavaScript ES6**：アロー関数・import / export・分割代入
3. **TypeScript の基礎**：型アノテーション（`: string`・`: number` など）とインターフェース

---

## コンポーネントとは

### 定義

**コンポーネント**は、UI の一部を表す**再利用可能な構成要素**です。

```typescript
// 最もシンプルなコンポーネント
function Welcome() {
  return <h1>こんにちは！</h1>;
}
```

### レゴブロックのたとえ

コンポーネントは**レゴブロック**のようなものです：
- 小さなパーツ（コンポーネント）を組み合わせて大きなものを作る
- 同じパーツを複数の場所で使い回せる
- パーツを差し替えて別の構造を作れる

```typescript
// 小さなパーツ
function Button() {
  return <button>クリック</button>;
}

// パーツを組み合わせる
function App() {
  return (
    <div>
      <Button />
      <Button />
      <Button />
    </div>
  );
}
```

### コンポーネントの種類

React 16.8 以降、**関数コンポーネント**が推奨されています。

```typescript
// 推奨：関数コンポーネント（2024 年現在のスタンダード）
function Greeting() {
  return <h1>こんにちは</h1>;
}

// 非推奨：クラスコンポーネント（古いスタイル）
class Greeting extends React.Component {
  render() {
    return <h1>こんにちは</h1>;
  }
}
```

**このガイドでは関数コンポーネントのみを使います。**

---

## 関数コンポーネントの書き方

### 基本形

```typescript
function コンポーネント名() {
  return (
    <div>
      {/* ここに JSX を書く */}
    </div>
  );
}
```

### 守るべきルール

#### 1. 名前は大文字で始める

```typescript
// OK：大文字で始まっている
function MyComponent() {
  return <div>コンテンツ</div>;
}

// NG：小文字で始まっている
function myComponent() {
  return <div>コンテンツ</div>;
}
// React は <myComponent /> を HTML タグとして扱ってしまう
```

#### 2. 必ず何かを return する

```typescript
// OK：JSX を返している
function ValidComponent() {
  return <div>コンテンツ</div>;
}

// NG：return がない
function InvalidComponent() {
  <div>コンテンツ</div>;  // return 文がない
}
```

#### 3. ルート要素は 1 つだけ

```typescript
// NG：ルート要素が複数ある
function InvalidComponent() {
  return (
    <h1>タイトル</h1>
    <p>本文</p>
  );
}

// OK：Fragment で囲む
function ValidComponent() {
  return (
    <>
      <h1>タイトル</h1>
      <p>本文</p>
    </>
  );
}
```

### 例：シンプルなコンポーネント

```typescript
// ユーザーカードコンポーネント
function UserCard() {
  return (
    <div className="card">
      <img src="avatar.jpg" alt="ユーザー" />
      <h2>山田 太郎</h2>
      <p>Web エンジニア</p>
    </div>
  );
}

// 使い方
function App() {
  return (
    <div>
      <UserCard />
      <UserCard />
      <UserCard />
    </div>
  );
}
```

---

## コンポーネントの分割

### なぜ分割するのか

大きなコンポーネントには次のような問題があります：
- **読みにくい**：コードが長くなりすぎる
- **再利用できない**：特定の場所に依存してしまっている
- **テストしにくい**：複雑すぎて効果的にテストできない

### 分割の例

#### 分割前：1 つの大きなコンポーネント

```typescript
function BlogPost() {
  return (
    <article>
      <header>
        <h1>React 入門</h1>
        <div>
          <img src="author.jpg" alt="著者" />
          <span>山田 太郎</span>
          <time>2024年1月28日</time>
        </div>
      </header>

      <div>
        <p>React は素晴らしいライブラリです...</p>
        <p>コンポーネントベースで...</p>
      </div>

      <footer>
        <button>いいね</button>
        <button>シェア</button>
        <button>コメント</button>
      </footer>
    </article>
  );
}
```

#### 分割後：複数の小さなコンポーネント

```typescript
// ヘッダーコンポーネント
function PostHeader() {
  return (
    <header>
      <h1>React 入門</h1>
      <AuthorInfo />
    </header>
  );
}

// 著者情報コンポーネント
function AuthorInfo() {
  return (
    <div className="author">
      <img src="author.jpg" alt="著者" />
      <span>山田 太郎</span>
      <time>2024年1月28日</time>
    </div>
  );
}

// 本文コンポーネント
function PostContent() {
  return (
    <div className="content">
      <p>React は素晴らしいライブラリです...</p>
      <p>コンポーネントベースで...</p>
    </div>
  );
}

// フッターコンポーネント
function PostFooter() {
  return (
    <footer>
      <button>いいね</button>
      <button>シェア</button>
      <button>コメント</button>
    </footer>
  );
}

// メインコンポーネント（パーツを組み合わせる）
function BlogPost() {
  return (
    <article>
      <PostHeader />
      <PostContent />
      <PostFooter />
    </article>
  );
}
```

**メリット**：
- 各コンポーネントが短くて読みやすい
- `AuthorInfo` や `PostFooter` を他の場所でも再利用できる
- 各パーツを個別にテストできる

---

## import と export

### なぜファイルを分けるのか

すべてのコンポーネントを 1 つのファイルに書くと、巨大で管理不能なファイルになります。**ファイルを分けて管理しましょう**。

### ディレクトリ構成

```
src/
├── App.tsx
├── components/
│   ├── Button.tsx
│   ├── UserCard.tsx
│   └── Header.tsx
└── main.tsx
```

### export の種類

#### 1. デフォルトエクスポート（1 ファイル 1 コンポーネント）

```typescript
// components/Button.tsx
function Button() {
  return <button>クリック</button>;
}

export default Button;  // デフォルトエクスポート
```

```typescript
// App.tsx
import Button from './components/Button';  // 好きな名前で import できる

function App() {
  return <Button />;
}
```

#### 2. 名前付きエクスポート（1 ファイルに複数コンポーネント）

```typescript
// components/Buttons.tsx
export function PrimaryButton() {
  return <button className="primary">プライマリ</button>;
}

export function SecondaryButton() {
  return <button className="secondary">セカンダリ</button>;
}
```

```typescript
// App.tsx
import { PrimaryButton, SecondaryButton } from './components/Buttons';

function App() {
  return (
    <div>
      <PrimaryButton />
      <SecondaryButton />
    </div>
  );
}
```

### ベストプラクティス

```typescript
// 推奨：1 ファイル 1 コンポーネント、デフォルトエクスポート
// components/UserCard.tsx
function UserCard() {
  return <div className="user-card">...</div>;
}

export default UserCard;
```

ファイル名とコンポーネント名を一致させると、どこで何が定義されているかわかりやすくなります。

---

## コンポーネント設計の原則

### 1. 単一責任の原則（SRP）

1 つのコンポーネントは**1 つのことだけ**を担当する。

```typescript
// 悪い例：複数の責任を持っている
function UserDashboard() {
  return (
    <div>
      {/* ユーザープロフィール */}
      <div>...</div>
      {/* 投稿リスト */}
      <div>...</div>
      {/* フレンドリスト */}
      <div>...</div>
      {/* 通知 */}
      <div>...</div>
    </div>
  );
}

// 良い例：責任を分離している
function UserDashboard() {
  return (
    <div>
      <UserProfile />
      <PostList />
      <FriendList />
      <NotificationList />
    </div>
  );
}
```

### 2. DRY 原則（Don't Repeat Yourself）

コードを重複させない。

```typescript
// 悪い例：同じコードが繰り返されている
function Buttons() {
  return (
    <div>
      <button className="btn btn-primary">保存</button>
      <button className="btn btn-primary">送信</button>
      <button className="btn btn-primary">削除</button>
    </div>
  );
}

// 良い例：再利用可能なコンポーネントにする
type ButtonProps = {
  label: string;
};

function PrimaryButton({ label }: ButtonProps) {
  return <button className="btn btn-primary">{label}</button>;
}

function Buttons() {
  return (
    <div>
      <PrimaryButton label="保存" />
      <PrimaryButton label="送信" />
      <PrimaryButton label="削除" />
    </div>
  );
}
```

### 3. 適切なサイズ

コンポーネントは**適切なサイズ**に保つ。

**目安**：
- 1 コンポーネント：50〜100 行以内
- 1 ファイル：200 行以内
- それ以上になったら分割を検討する

### 4. 命名規則

コンポーネントには**内容がわかる名前**をつける。

```typescript
// 悪い名前
function A() { }
function Thing() { }
function DoStuff() { }

// 良い名前
function UserProfile() { }      // ユーザープロフィール
function LoginButton() { }      // ログインボタン
function ProductCard() { }      // 商品カード
function NavigationMenu() { }   // ナビゲーションメニュー
```

**よくあるパターン**：
- `UserCard`・`ProductCard`：`...Card`（カードレイアウト）
- `LoginButton`・`SubmitButton`：`...Button`（ボタン）
- `UserList`・`ProductList`：`...List`（リスト）
- `UserForm`・`LoginForm`：`...Form`（フォーム）

---

## コンポーネントの組み合わせ

### コンポーネントをネストする

コンポーネントの中に別のコンポーネントを含められます。

```typescript
function Avatar() {
  return <img src="avatar.jpg" alt="ユーザー" />;
}

function UserName() {
  return <h2>山田 太郎</h2>;
}

function UserCard() {
  return (
    <div className="card">
      <Avatar />
      <UserName />
      <p>Web エンジニア</p>
    </div>
  );
}

function App() {
  return (
    <div>
      <UserCard />
    </div>
  );
}
```

### コンポーネントツリー

アプリケーション全体は**コンポーネントツリー**として表現できます。

```
App
├── Header
│   ├── Logo
│   └── Navigation
│       ├── NavItem
│       ├── NavItem
│       └── NavItem
├── Main
│   ├── Sidebar
│   │   └── Widget
│   └── Content
│       ├── Article
│       └── Article
└── Footer
    ├── Copyright
    └── SocialLinks
```

---

## よくあるミス

### ミス 1：コンポーネント名が小文字で始まっている

```typescript
// NG
function button() {
  return <button>クリック</button>;
}

<button />  // HTML の <button> タグとして扱われる

// OK
function Button() {
  return <button>クリック</button>;
}

<Button />  // React コンポーネントとして扱われる
```

### ミス 2：コンポーネントの中でコンポーネントを定義している

```typescript
// NG：別のコンポーネントの中で新しいコンポーネントを定義している
function ParentComponent() {
  function ChildComponent() {
    return <div>子コンポーネント</div>;
  }

  return <ChildComponent />;
}
```

**問題点**：レンダリングのたびに新しいコンポーネントが生成され、パフォーマンス低下や state のリセットが起きます。

```typescript
// OK：モジュールのトップレベルで定義する
function ChildComponent() {
  return <div>子コンポーネント</div>;
}

function ParentComponent() {
  return <ChildComponent />;
}
```

### ミス 3：return を忘れている

```typescript
// NG
function MyComponent() {
  <div>コンテンツ</div>;  // return がない
}

// OK
function MyComponent() {
  return <div>コンテンツ</div>;
}
```

### ミス 4：ファイル名とコンポーネント名が一致していない

```typescript
// ファイル名: UserProfile.tsx
function Profile() {  // 名前が一致していない
  return <div>...</div>;
}

// OK
// ファイル名: UserProfile.tsx
function UserProfile() {  // ファイル名と一致している
  return <div>...</div>;
}

export default UserProfile;
```

---

## 演習

### 演習 1：名刺コンポーネント

**難易度**：初級

次の情報を表示する名刺コンポーネントを作ってください：
- 名前
- 役職
- 会社名
- メールアドレス

**解答例**：
```typescript
function BusinessCard() {
  return (
    <div className="business-card">
      <h2>山田 太郎</h2>
      <p className="title">シニアエンジニア</p>
      <p className="company">テックソリューションズ株式会社</p>
      <a href="mailto:taro@example.com">taro@example.com</a>
    </div>
  );
}

export default BusinessCard;
```

### 演習 2：ブログ記事を分割する

**難易度**：中級

次の大きなコンポーネントを 4 つに分割してください：
- `ArticleHeader`：タイトルと著者情報
- `ArticleContent`：本文
- `ArticleTags`：タグリスト
- `BlogArticle`：全体を組み合わせたもの

**元のコード**：
```typescript
function BlogArticle() {
  return (
    <article>
      <header>
        <h1>React の基礎</h1>
        <div>
          <span>著者: 山田 太郎</span>
          <time>2024年1月28日</time>
        </div>
      </header>

      <div>
        <p>React はコンポーネントベースのライブラリです。</p>
        <p>再利用可能な部品を作ることができます。</p>
      </div>

      <footer>
        <span className="tag">React</span>
        <span className="tag">JavaScript</span>
        <span className="tag">Web 開発</span>
      </footer>
    </article>
  );
}
```

**解答例**：
```typescript
function ArticleHeader() {
  return (
    <header>
      <h1>React の基礎</h1>
      <div className="meta">
        <span>著者: 山田 太郎</span>
        <time>2024年1月28日</time>
      </div>
    </header>
  );
}

function ArticleContent() {
  return (
    <div className="content">
      <p>React はコンポーネントベースのライブラリです。</p>
      <p>再利用可能な部品を作ることができます。</p>
    </div>
  );
}

function ArticleTags() {
  const tags = ['React', 'JavaScript', 'Web 開発'];
  return (
    <footer>
      {tags.map(tag => (
        <span key={tag} className="tag">{tag}</span>
      ))}
    </footer>
  );
}

function BlogArticle() {
  return (
    <article>
      <ArticleHeader />
      <ArticleContent />
      <ArticleTags />
    </article>
  );
}

export default BlogArticle;
```

---

## 次のステップ

### このガイドで学んだこと

- コンポーネントの基本概念
- 関数コンポーネントの書き方
- コンポーネントの分割方法
- import と export
- コンポーネント設計の原則

### 次に読むガイド

1. **[05-props-basics.md](./05-props-basics.md)** — props の詳細・データの受け渡し・TypeScript の型定義
2. **[06-state-basics.md](./06-state-basics.md)** — state 管理の基礎・useState Hook・動的な UI

### 参考リンク

- [React: 最初のコンポーネント](https://ja.react.dev/learn/your-first-component)
- [React: コンポーネントの import と export](https://ja.react.dev/learn/importing-and-exporting-components)
- [Atomic Design](https://bradfrost.com/blog/post/atomic-web-design/)
- [Component Design Patterns in React](https://www.patterns.dev/)

---

**次のガイド**: [05-props-basics.md](./05-props-basics.md)

**前のガイド**: [03-jsx-fundamentals.md](./03-jsx-fundamentals.md)

**上位ガイド**: [React 開発 - SKILL.md](../../SKILL.md)
