# ExpressによるREST API構築 — 完全ガイド

## 目次

1. [REST API設計の原則](#rest-api設計の原則)
2. [完全なCRUD APIを作る](#完全なcrud-apiを作る)
3. [リクエストバリデーション](#リクエストバリデーション)
4. [レスポンスのフォーマット](#レスポンスのフォーマット)
5. [HTTPステータスコード](#httpステータスコード)
6. [APIバージョニング](#apiバージョニング)
7. [FAQ](#faq)

---

## REST API設計の原則

REST（Representational State Transfer）は、ネットワークアプリケーションのためのアーキテクチャスタイルです。RESTful APIはHTTPメソッドとURIを使ってリソースを公開します。

### 主要な制約

| 制約               | 説明                                                     |
|-------------------|----------------------------------------------------------|
| ステートレス        | 各リクエストに処理に必要なすべての情報が含まれている         |
| クライアント—サーバー | クライアントとサーバーは分離されている                      |
| 統一インターフェース  | リソースの命名とHTTPメソッドが一貫している                  |
| キャッシュ可能       | レスポンスがキャッシュ可能かどうかを明示する                |
| 階層化システム       | クライアントはエンドサーバーに直接接続しているかどうかわからない |

### リソース命名規則

```
✅ 良い例（名詞・複数形）
GET    /users              → ユーザー一覧
GET    /users/42           → ユーザー42を取得
POST   /users              → ユーザーを作成
PUT    /users/42           → ユーザー42を置換
PATCH  /users/42           → ユーザー42を部分更新
DELETE /users/42           → ユーザー42を削除

GET    /users/42/posts     → ユーザー42の投稿一覧
GET    /users/42/posts/7   → ユーザー42の投稿7

❌ 悪い例（URLに動詞を使う）
GET    /getUsers
POST   /createUser
DELETE /deleteUser/42
```

### HTTPメソッドとべき等性

```
Method  │ 安全 │ べき等  │ 用途
────────┼──────┼────────┼────────────────────────
GET     │  ✓   │   ✓    │ リソースの読み取り
HEAD    │  ✓   │   ✓    │ ヘッダーのみ読み取り
POST    │  ✗   │   ✗    │ リソースの作成
PUT     │  ✗   │   ✓    │ リソース全体の置換
PATCH   │  ✗   │   ✗    │ 部分更新
DELETE  │  ✗   │   ✓    │ リソースの削除
OPTIONS │  ✓   │   ✓    │ CORSプリフライト
```

---

## 完全なCRUD APIを作る

### プロジェクトのセットアップ

```bash
mkdir rest-api-demo
cd rest-api-demo
npm init -y
npm install express express-validator
npm install --save-dev nodemon
```

### エントリポイント

```javascript
// server.js
const express = require('express');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ルート
app.use('/api/v1/users', usersRouter);

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
  });
});

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

module.exports = app;
```

### インメモリデータストア（デモ用）

```javascript
// data/store.js
let users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', createdAt: new Date().toISOString() },
  { id: 2, name: 'Bob',   email: 'bob@example.com',   role: 'user',  createdAt: new Date().toISOString() },
];
let nextId = 3;

module.exports = {
  findAll: () => [...users],
  findById: (id) => users.find(u => u.id === Number(id)),
  create: (data) => {
    const user = { id: nextId++, ...data, createdAt: new Date().toISOString() };
    users.push(user);
    return user;
  },
  update: (id, data) => {
    const index = users.findIndex(u => u.id === Number(id));
    if (index === -1) return null;
    users[index] = { ...users[index], ...data };
    return users[index];
  },
  remove: (id) => {
    const index = users.findIndex(u => u.id === Number(id));
    if (index === -1) return false;
    users.splice(index, 1);
    return true;
  },
};
```

### CRUDルート

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();
const store = require('../data/store');

// GET /api/v1/users — ページネーションとフィルタリング付き一覧
router.get('/', (req, res) => {
  const { page = 1, limit = 10, role } = req.query;

  let users = store.findAll();

  // フィルタリング
  if (role) {
    users = users.filter(u => u.role === role);
  }

  // ページネーション
  const total = users.length;
  const start = (Number(page) - 1) * Number(limit);
  const paginated = users.slice(start, start + Number(limit));

  res.json({
    success: true,
    data: paginated,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// GET /api/v1/users/:id — 1件取得
router.get('/:id', (req, res, next) => {
  const user = store.findById(req.params.id);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    return next(err);
  }
  res.json({ success: true, data: user });
});

// POST /api/v1/users — 作成
router.post('/', (req, res) => {
  const { name, email, role = 'user' } = req.body;
  const user = store.create({ name, email, role });
  res
    .status(201)
    .set('Location', `/api/v1/users/${user.id}`)
    .json({ success: true, data: user });
});

// PUT /api/v1/users/:id — 置換
router.put('/:id', (req, res, next) => {
  const { name, email, role } = req.body;
  const user = store.update(req.params.id, { name, email, role });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    return next(err);
  }
  res.json({ success: true, data: user });
});

// PATCH /api/v1/users/:id — 部分更新
router.patch('/:id', (req, res, next) => {
  const allowed = ['name', 'email', 'role'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  const user = store.update(req.params.id, updates);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    return next(err);
  }
  res.json({ success: true, data: user });
});

// DELETE /api/v1/users/:id — 削除
router.delete('/:id', (req, res, next) => {
  const deleted = store.remove(req.params.id);
  if (!deleted) {
    const err = new Error('User not found');
    err.status = 404;
    return next(err);
  }
  res.status(204).send();
});

module.exports = router;
```

---

## リクエストバリデーション

ユーザーからの入力を信頼してはいけません。早めにバリデーションを行い、わかりやすいエラーメッセージを返しましょう。

### 手動バリデーション

```javascript
router.post('/', (req, res, next) => {
  const { name, email, role } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }
  if (role && !['admin', 'user', 'moderator'].includes(role)) {
    errors.push({ field: 'role', message: 'Role must be admin, user, or moderator' });
  }

  if (errors.length > 0) {
    return res.status(422).json({ success: false, errors });
  }

  const user = store.create({ name: name.trim(), email, role: role || 'user' });
  res.status(201).json({ success: true, data: user });
});
```

### express-validatorを使う

```bash
npm install express-validator
```

```javascript
const { body, param, query, validationResult } = require('express-validator');

// 再利用可能なバリデーションmiddleware
function validate(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map(v => v.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
      });
    }
    next();
  };
}

// バリデーションルール
const createUserRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'user', 'moderator'])
    .withMessage('Role must be admin, user, or moderator'),
];

const userIdRule = [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
];

const paginationRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be ≥ 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100'),
];

// ルートに適用
router.get('/',    validate(paginationRules), listUsers);
router.post('/',   validate(createUserRules), createUser);
router.get('/:id', validate(userIdRule), getUser);
```

---

## レスポンスのフォーマット

一貫したレスポンス形式にすることで、APIが予測しやすく使いやすくなります。

### 標準的な成功レスポンス

```javascript
// 単一リソース
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  }
}

// ページネーション付きコレクション
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 2,
    "limit": 10,
    "totalPages": 10
  }
}
```

### 標準的なエラーレスポンス

```javascript
// 単一エラー
{
  "success": false,
  "error": "User not found"
}

// バリデーションエラー
{
  "success": false,
  "errors": [
    { "field": "email", "message": "Valid email is required" },
    { "field": "name",  "message": "Name is required" }
  ]
}
```

### レスポンスヘルパー

```javascript
// utils/response.js
const send = {
  ok: (res, data, meta = undefined) => {
    const body = { success: true, data };
    if (meta) body.meta = meta;
    res.status(200).json(body);
  },
  created: (res, data, location) => {
    if (location) res.set('Location', location);
    res.status(201).json({ success: true, data });
  },
  noContent: (res) => res.status(204).send(),
  badRequest: (res, errors) => res.status(400).json({ success: false, errors }),
  unauthorized: (res, message = 'Unauthorized') =>
    res.status(401).json({ success: false, error: message }),
  forbidden: (res, message = 'Forbidden') =>
    res.status(403).json({ success: false, error: message }),
  notFound: (res, resource = 'Resource') =>
    res.status(404).json({ success: false, error: `${resource} not found` }),
  unprocessable: (res, errors) =>
    res.status(422).json({ success: false, errors }),
  internal: (res, message = 'Internal server error') =>
    res.status(500).json({ success: false, error: message }),
};

module.exports = send;
```

---

## HTTPステータスコード

### 2xx — 成功

| コード | 名称       | 使用場面                                               |
|------|------------|----------------------------------------------------|
| 200  | OK         | GET・PUT・PATCHが成功した場合                         |
| 201  | Created    | リソースを作成するPOSTが成功した場合                   |
| 204  | No Content | DELETE成功時、またはレスポンスボディが不要なPOST/PUT   |

### 3xx — リダイレクト

| コード | 名称              | 使用場面                          |
|------|-------------------|--------------------------------------|
| 301  | Moved Permanently | リソースが恒久的に移動した           |
| 304  | Not Modified      | キャッシュされたリソースがまだ有効   |

### 4xx — クライアントエラー

| コード | 名称                 | 使用場面                                                   |
|------|----------------------|---------------------------------------------------|
| 400  | Bad Request          | 不正なリクエスト構文、無効なパラメーター              |
| 401  | Unauthorized         | 認証が必要、または認証に失敗した                      |
| 403  | Forbidden            | 認証済みだが認可されていない                          |
| 404  | Not Found            | リソースが存在しない                                  |
| 405  | Method Not Allowed   | このリソースではHTTPメソッドがサポートされていない     |
| 409  | Conflict             | 状態の競合（例: メールアドレスの重複）               |
| 422  | Unprocessable Entity | バリデーションエラー（意味的に無効なリクエスト）      |
| 429  | Too Many Requests    | レート制限を超えた                                    |

### 5xx — サーバーエラー

| コード | 名称                  | 使用場面                                           |
|------|-----------------------|------------------------------------------------|
| 500  | Internal Server Error | 予期しないサーバー側のエラー                       |
| 502  | Bad Gateway           | 上流サービスから無効なレスポンスが返ってきた        |
| 503  | Service Unavailable   | サーバーが一時的に利用不可（メンテナンス中など）   |

```javascript
// よくあるケースの判断フロー
function respondToCreate(res, data, error) {
  if (!error)           return res.status(201).json({ success: true, data });
  if (error.isDuplicate) return res.status(409).json({ success: false, error: 'Already exists' });
  if (error.isValidation) return res.status(422).json({ success: false, errors: error.details });
                          return res.status(500).json({ success: false, error: 'Server error' });
}
```

---

## APIバージョニング

バージョニングにより、既存のクライアントを壊すことなくAPIを進化させることができます。

### 戦略1: URLパスによるバージョニング（最も一般的）

```
/api/v1/users
/api/v2/users
```

```javascript
// server.js
const v1Router = require('./routes/v1');
const v2Router = require('./routes/v2');

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);
```

```
routes/
├── v1/
│   ├── index.js
│   └── users.js
└── v2/
    ├── index.js
    └── users.js
```

### 戦略2: ヘッダーによるバージョニング

```javascript
function versionMiddleware(req, res, next) {
  const version = req.headers['api-version'] || '1';
  req.apiVersion = parseInt(version, 10);
  next();
}

app.use(versionMiddleware);

app.get('/users', (req, res) => {
  if (req.apiVersion >= 2) {
    return res.json({ data: [], links: {} }); // v2の形式
  }
  res.json([]); // v1の形式
});
```

### 戦略3: クエリ文字列によるバージョニング

```
GET /users?version=2
```

```javascript
app.get('/users', (req, res) => {
  const version = Number(req.query.version) || 1;
  // バージョンごとに処理
});
```

### 非推奨ヘッダー

バージョンが廃止予定であることをクライアントに通知します:

```javascript
router.use((req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
  res.set('Link', '</api/v2/users>; rel="successor-version"');
  next();
});
```

### バージョンのライフサイクル

```
v1 ──────────────────────────────────── 非推奨 ── 廃止
v2 ─────────────────────────────────────────────────────────
v3                        ── リリース ──────────────────────
     │                    │             │
  v2ベータ              v3安定版      v1廃止
  ローンチ              アナウンス
```

---

## FAQ

**Q: 更新にはPUTとPATCHのどちらを使うべきですか？**
リソース全体を置換する場合はPUT（クライアントがすべてのフィールドを送信）、部分的に更新する場合はPATCH（クライアントが変更フィールドのみ送信）を使います。実際にはPATCHの方が多く使われています。

**Q: 大規模なデータセットのページネーションはどうすればよいですか？**
大規模または頻繁に更新されるデータセットにはカーソルベースのページネーションを推奨します:
```javascript
// オフセットページネーション（シンプルだが大きなテーブルでは遅い）
GET /users?page=5&limit=20

// カーソルページネーション（効率的で一貫性がある）
GET /users?cursor=eyJpZCI6MTAwfQ&limit=20
// レスポンス例: { data: [...], nextCursor: "eyJpZCI6MTIwfQ" }
```

**Q: 400と422の違いは何ですか？**
不正な構文（例: 無効なJSON）には400を使います。構造的には正しいが意味的に無効なデータ（例: 整数が必要なフィールドに`"age": "not-a-number"`）には422を使います。

**Q: DELETEレスポンスで削除されたリソースを返すべきですか？**
通常は不要です。204 No Contentと空のボディを返してください。削除内容を確認するために200と削除されたオブジェクトを返すAPIもありますが、どちらも許容されます。

**Q: REST APIのドキュメントはどう作ればよいですか？**
OpenAPI（旧Swagger）を使いましょう。`swagger-jsdoc`と`swagger-ui-express`パッケージを使えば、Expressルートファイルのコメントからインタラクティブなドキュメントを自動生成できます。

---

**親ガイド**: [Node.js Development - SKILL.md](../../SKILL.md)
