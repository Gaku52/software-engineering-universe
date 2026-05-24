# Express 入門 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [Express とは](#express-とは)
3. [最初の Express アプリ](#最初の-express-アプリ)
4. [ルーティング](#ルーティング)
5. [ミドルウェア](#ミドルウェア)
6. [リクエストとレスポンス](#リクエストとレスポンス)
7. [演習](#演習)
8. [次のステップ](#次のステップ)

---

## 概要

### 学習内容

- Express フレームワークの基礎
- 基本的なルーティング
- ミドルウェアの概念
- リクエストとレスポンスの処理

### 所要時間：1〜1.5 時間

---

## Express とは

### 定義

**Express** は、Node.js で最も広く使われている Web フレームワークです。

**特徴**：
- シンプルで最小限の設計
- 高い柔軟性
- 豊富なミドルウェアエコシステム
- 大きなコミュニティ

### インストール

```bash
mkdir express-app
cd express-app
npm init -y

npm install express
```

---

## 最初の Express アプリ

### Hello World

`index.js` を作成します：

```javascript
const express = require('express')
const app = express()
const PORT = 3000

app.get('/', (req, res) => {
  res.send('Hello, Express!')
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
```

### 起動する

```bash
node index.js
```

ブラウザで `http://localhost:3000` を開いてください。

---

## ルーティング

### HTTP メソッド

```javascript
const express = require('express')
const app = express()

// GET
app.get('/users', (req, res) => {
  res.json({ users: ['Alice', 'Bob'] })
})

// POST
app.post('/users', (req, res) => {
  res.status(201).json({ message: 'User created' })
})

// PUT
app.put('/users/:id', (req, res) => {
  res.json({ message: `User ${req.params.id} updated` })
})

// DELETE
app.delete('/users/:id', (req, res) => {
  res.json({ message: `User ${req.params.id} deleted` })
})

app.listen(3000)
```

### パスパラメータ

```javascript
// /users/123
app.get('/users/:id', (req, res) => {
  const userId = req.params.id
  res.json({ userId })
})

// 複数のパラメータ
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params
  res.json({ userId, postId })
})
```

### クエリパラメータ

```javascript
// /search?q=express&limit=10
app.get('/search', (req, res) => {
  const { q, limit } = req.query
  res.json({ query: q, limit: limit || 20 })
})
```

---

## ミドルウェア

### ミドルウェアとは

**ミドルウェア**は、リクエストとレスポンスの間に実行される関数です。

```
リクエスト → ミドルウェア1 → ミドルウェア2 → ルートハンドラ → レスポンス
```

### 組み込みミドルウェア

```javascript
const express = require('express')
const app = express()

// JSON パーサー
app.use(express.json())

// URL エンコードされたデータ
app.use(express.urlencoded({ extended: true }))

// 静的ファイルの配信
app.use(express.static('public'))
```

### カスタムミドルウェア

```javascript
// ロギングミドルウェア
const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()  // 次のミドルウェアに制御を渡す
}

app.use(logger)

// 認証ミドルウェア
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.user = { id: 1, name: 'Alice' }
  next()
}

// 特定のルートに適用する
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})
```

---

## リクエストとレスポンス

### req（リクエスト）オブジェクト

```javascript
app.post('/api/users', (req, res) => {
  const body = req.body          // リクエストボディ
  const id = req.params.id       // パスパラメータ
  const query = req.query        // クエリパラメータ
  const contentType = req.get('Content-Type')  // ヘッダー
  const method = req.method      // HTTP メソッド
  const url = req.url            // URL 全体
  const path = req.path          // パスのみ

  res.json({ received: true })
})
```

### res（レスポンス）オブジェクト

```javascript
app.get('/api/users', (req, res) => {
  res.json({ name: 'Alice' })              // JSON レスポンス
  res.send('Hello')                        // テキストレスポンス
  res.status(404).json({ error: 'Not Found' })  // ステータスコード付き
  res.redirect('/home')                    // リダイレクト
  res.set('Content-Type', 'application/json')   // ヘッダーの設定
  res.sendFile('/path/to/file.pdf')        // ファイルの送信
})
```

---

## 実践例

### ユーザー CRUD API

```javascript
const express = require('express')
const app = express()

app.use(express.json())

let users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
]

// GET /api/users
app.get('/api/users', (req, res) => {
  res.json({ users })
})

// GET /api/users/:id
app.get('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const user = users.find(u => u.id === id)

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json({ user })
})

// POST /api/users
app.post('/api/users', (req, res) => {
  const { name, email } = req.body

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' })
  }

  const newUser = { id: users.length + 1, name, email }
  users.push(newUser)
  res.status(201).json({ user: newUser })
})

// PUT /api/users/:id
app.put('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const { name, email } = req.body
  const index = users.findIndex(u => u.id === id)

  if (index === -1) {
    return res.status(404).json({ error: 'User not found' })
  }

  users[index] = { id, name, email }
  res.json({ user: users[index] })
})

// DELETE /api/users/:id
app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id)
  const index = users.findIndex(u => u.id === id)

  if (index === -1) {
    return res.status(404).json({ error: 'User not found' })
  }

  users.splice(index, 1)
  res.json({ message: 'User deleted' })
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
```

### curl でテストする

```bash
curl http://localhost:3000/api/users
curl http://localhost:3000/api/users/1
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie","email":"charlie@example.com"}'
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Smith","email":"alice@example.com"}'
curl -X DELETE http://localhost:3000/api/users/1
```

---

## エラーハンドリング

### エラーハンドラー

```javascript
// 404 ハンドラー
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// エラーハンドラー（必ず最後に定義する）
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal Server Error' })
})
```

### try-catch パターン

```javascript
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const user = await getUserById(id)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error) {
    next(error)
  }
})
```

---

## よくある間違い

### next() を呼び忘れる

```javascript
// ❌ next() がないとリクエストがハングする
app.use((req, res, next) => {
  console.log('Middleware')
})

// ✅ 必ず next() を呼び出す
app.use((req, res, next) => {
  console.log('Middleware')
  next()
})
```

### レスポンスを複数回送信する

```javascript
// ❌ エラー：ヘッダー送信後に再度送信できない
app.get('/', (req, res) => {
  res.send('Hello')
  res.send('World')
})

// ✅ レスポンスは必ず1回だけ送信する
app.get('/', (req, res) => {
  res.send('Hello World')
})
```

---

## 演習

### 課題：タスク管理 API の作成

以下のエンドポイントを持つ API を構築してください：
- GET /api/tasks — タスクを一覧表示する
- POST /api/tasks — タスクを作成する
- DELETE /api/tasks/:id — タスクを削除する

---

## 次のステップ

### このガイドで学んだこと

- ✅ Express フレームワークの基礎
- ✅ 基本的なルーティング
- ✅ ミドルウェアの概念
- ✅ リクエストとレスポンスの処理

**次のガイド**：[05-async-programming.md](./05-async-programming.md) — 非同期プログラミング

---

**前のガイド**：[03-npm-basics.md](./03-npm-basics.md)

**親ガイド**：[Node.js 開発 - SKILL.md](../../SKILL.md)
