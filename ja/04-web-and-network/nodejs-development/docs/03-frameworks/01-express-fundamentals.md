# Express 基礎 — 完全ガイド

## 目次

1. [Expressとは？](#expressとは)
2. [インストールと基本セットアップ](#インストールと基本セットアップ)
3. [ルーティングの基本](#ルーティングの基本)
4. [RequestオブジェクトとResponseオブジェクト](#requestオブジェクトとresponseオブジェクト)
5. [静的ファイルの配信](#静的ファイルの配信)
6. [FAQ](#faq)

---

## Expressとは？

Expressは、Webアプリケーションおよびモバイルアプリケーションのビルドに必要な機能を豊富に備えた、最小限かつ柔軟なNode.jsのWebアプリケーションフレームワークです。最も人気の高いNode.jsフレームワークであり、多くの本番システムの基盤として広く使われています。

```
┌─────────────────────────────────────────────┐
│              Node.js Runtime                │
│  ┌───────────────────────────────────────┐  │
│  │         Express Framework             │  │
│  │  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  Router  │  │   Middleware      │  │  │
│  │  └──────────┘  └──────────────────┘  │  │
│  │  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │   Req    │  │      Res         │  │  │
│  │  └──────────┘  └──────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Expressを使う理由

- **最小限のフットプリント** — データベース、テンプレートエンジン、ディレクトリ構成に関する制約なし
- **Middlewareエコシステム** — 互換性のあるnpmパッケージが数千種類
- **高速なルーティング** — すっきりとしたチェーン可能なルート定義
- **大規模なコミュニティ** — 充実したドキュメントとStack Overflowの回答
- **本番実績** — 世界中の大手企業で採用

---

## インストールと基本セットアップ

### 前提条件

- Node.js 18以降がインストール済みであること
- npmまたはyarnがターミナルで使用できること

### プロジェクトの初期化

```bash
mkdir my-express-app
cd my-express-app
npm init -y
npm install express
```

### 最小構成のサーバー

```javascript
// server.js
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

実行:

```bash
node server.js
# → Server running on http://localhost:3000
```

### 推奨プロジェクト構成

```
my-express-app/
├── server.js          ← エントリポイント
├── routes/
│   ├── users.js
│   └── products.js
├── middleware/
│   └── auth.js
├── controllers/
│   └── userController.js
├── package.json
└── .env
```

### 開発時はnodemonを使う

```bash
npm install --save-dev nodemon
```

`package.json`に追記:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

```bash
npm run dev
# ファイルの変更を検知して自動で再起動
```

---

## ルーティングの基本

ルーティングは、HTTPメソッドとURLパスをハンドラー関数に対応づける仕組みです。

### 構文

```javascript
app.METHOD(PATH, HANDLER);
//  ^^^^^^  ^^^^  ^^^^^^^
//  HTTP    URL   function(req, res)
```

### GET — データの取得

```javascript
// 全ユーザーの一覧を取得
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// IDを指定して1件取得
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ id, name: 'Alice' });
});
```

### POST — データの作成

```javascript
app.use(express.json()); // JSONボディを事前にパースする

app.post('/users', (req, res) => {
  const { name, email } = req.body;
  // データベースへ保存 ...
  res.status(201).json({ id: 1, name, email });
});
```

### PUT — データの置換

```javascript
app.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  // データベースのユーザーを置換 ...
  res.json({ id, name, email });
});
```

### PATCH — データの部分更新

```javascript
app.patch('/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  // 部分更新を適用 ...
  res.json({ id, ...updates });
});
```

### DELETE — データの削除

```javascript
app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  // データベースから削除 ...
  res.status(204).send(); // レスポンスボディなし
});
```

### ルートパラメーターとクエリ文字列

```javascript
// ルートパラメーター: /products/42
app.get('/products/:id', (req, res) => {
  console.log(req.params.id); // "42"
});

// クエリ文字列: /search?q=node&limit=10
app.get('/search', (req, res) => {
  console.log(req.query.q);     // "node"
  console.log(req.query.limit); // "10"
});
```

### Express Router — モジュール化されたルート

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ users: [] }));
router.get('/:id', (req, res) => res.json({ id: req.params.id }));
router.post('/', (req, res) => res.status(201).json(req.body));
router.delete('/:id', (req, res) => res.status(204).send());

module.exports = router;
```

```javascript
// server.js
const usersRouter = require('./routes/users');

app.use('/users', usersRouter);
// GET  /users      → router.get('/')
// GET  /users/42   → router.get('/:id')
// POST /users      → router.post('/')
```

### ルートのチェーン

```javascript
app.route('/books')
  .get((req, res) => res.json({ books: [] }))
  .post((req, res) => res.status(201).json(req.body));

app.route('/books/:id')
  .get((req, res) => res.json({ id: req.params.id }))
  .put((req, res) => res.json(req.body))
  .delete((req, res) => res.status(204).send());
```

---

## RequestオブジェクトとResponseオブジェクト

### Requestオブジェクト（`req`）

```javascript
app.post('/example', (req, res) => {
  // URLパラメーター (/example/:id)
  console.log(req.params);       // { id: '42' }

  // クエリ文字列 (?page=2&limit=20)
  console.log(req.query);        // { page: '2', limit: '20' }

  // リクエストボディ（JSONまたはフォームデータ）
  console.log(req.body);         // { name: 'Alice', email: '...' }

  // HTTPヘッダー
  console.log(req.headers);      // { 'content-type': 'application/json', ... }
  console.log(req.get('Authorization')); // 'Bearer token123'

  // リクエストのメタ情報
  console.log(req.method);       // 'POST'
  console.log(req.path);         // '/example'
  console.log(req.url);          // '/example?page=2'
  console.log(req.ip);           // '127.0.0.1'
  console.log(req.protocol);     // 'http'
  console.log(req.secure);       // false（HTTPSの場合はtrue）
});
```

### Responseオブジェクト（`res`）

```javascript
app.get('/response-demo', (req, res) => {
  // プレーンテキストを送信
  res.send('Hello World');

  // JSONを送信
  res.json({ message: 'Success', data: [] });

  // ステータスコードを指定して送信
  res.status(201).json({ id: 1 });
  res.status(404).json({ error: 'Not found' });
  res.status(204).send(); // レスポンスボディなし

  // レスポンスヘッダーを設定
  res.set('X-Custom-Header', 'value');
  res.set({ 'Cache-Control': 'no-store', 'X-Powered-By': 'Express' });

  // リダイレクト
  res.redirect('/new-path');
  res.redirect(301, '/permanent-new-path');

  // ファイルを送信
  res.sendFile('/absolute/path/to/file.pdf');

  // ファイルをダウンロード
  res.download('/path/to/report.pdf', 'report.pdf');

  // テンプレートをレンダリング（ビューエンジンの設定が必要）
  res.render('index', { title: 'Home', user: req.user });
});
```

### Content-Typeヘルパー

```javascript
// Expressが自動的にContent-Typeを設定する:
res.send('text');           // text/html
res.json({ key: 'val' });   // application/json
res.sendFile('image.png');  // image/png（自動検出）

// 手動でオーバーライド:
res.type('application/xml').send('<root/>');
```

---

## 静的ファイルの配信

`express.static`を使って、HTML、CSS、JavaScript、画像などのアセットを配信します。

### 基本設定

```javascript
const path = require('path');

// "public"ディレクトリ内のファイルを配信
app.use(express.static(path.join(__dirname, 'public')));
```

```
public/
├── index.html        → /index.html（または /）でアクセス可能
├── css/
│   └── style.css     → /css/style.css でアクセス可能
├── js/
│   └── app.js        → /js/app.js でアクセス可能
└── images/
    └── logo.png      → /images/logo.png でアクセス可能
```

### 仮想パスプレフィックスを付ける

```javascript
// "public"内のファイルを /static/... で配信
app.use('/static', express.static(path.join(__dirname, 'public')));
// /static/css/style.css → public/css/style.css
```

### 複数の静的ディレクトリ

```javascript
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));
// Expressは登録した順にディレクトリを検索する
```

### キャッシュ制御

```javascript
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',        // 1日間キャッシュ
  etag: true,          // ETagを有効化
  lastModified: true,  // Last-Modifiedヘッダーを有効化
}));
```

---

## FAQ

**Q: Node.jsでWebサーバーを作るのにExpressは必須ですか？**
いいえ。Node.jsには組み込みの`http`モジュールがあります。Expressはその上に構築されており、定型コードを削減し、ルーティング、middleware、ヘルパーを提供します。

**Q: `app.use`と`app.get`の違いは何ですか？**
`app.use`はすべてのHTTPメソッドに一致し、オプションで任意のパスプレフィックスも対象にできます。`app.get`はGETリクエストの特定パスのみに一致します。middlewareには`app.use`を、ルートハンドラーには`app.get`/`app.post`などを使いましょう。

**Q: Expressで404エラーを処理するにはどうすればよいですか？**
middlewareチェーンの末尾にキャッチオールルートを追加します:
```javascript
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
```

**Q: ExpressでESモジュール（`import`/`export`）は使えますか？**
はい。`package.json`に`"type": "module"`を設定し、`.js`ファイルで`import express from 'express'`を使用します。ただし、ESモジュールでは`__dirname`と`__filename`が使えないため、代わりに`import.meta.url`と`new URL`を利用してください。

**Q: どのバージョンのExpressを使うべきですか？**
新規プロジェクトにはExpress 5（2024年に安定版リリース）を推奨します。ネイティブなasync/awaitのエラー伝播など、多くの改善が加えられています。

---

**親ガイド**: [Node.js Development - SKILL.md](../../SKILL.md)
