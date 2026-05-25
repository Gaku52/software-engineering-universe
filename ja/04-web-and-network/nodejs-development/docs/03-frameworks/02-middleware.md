# ExpressにおけるMiddleware — 完全ガイド

## 目次

1. [Middlewareとは？](#middlewareとは)
2. [組み込みMiddleware](#組み込みmiddleware)
3. [サードパーティMiddleware](#サードパーティmiddleware)
4. [カスタムMiddlewareの作成](#カスタムmiddlewareの作成)
5. [Middlewareの実行順序](#middlewareの実行順序)
6. [エラーハンドリングMiddleware](#エラーハンドリングmiddleware)
7. [FAQ](#faq)

---

## Middlewareとは？

Middleware関数とは、アプリケーションのリクエスト—レスポンスサイクルの中でrequestオブジェクト（`req`）、responseオブジェクト（`res`）、および`next`関数にアクセスできる関数です。

```
HTTP Request
     │
     ▼
┌────────────┐
│ Middleware │  → req と res を読み取り・変更できる
│     1      │  → サイクルを終了できる（res.send）
└─────┬──────┘  → または制御を渡せる（next()）
      │ next()
      ▼
┌────────────┐
│ Middleware │
│     2      │
└─────┬──────┘
      │ next()
      ▼
┌────────────┐
│   Route    │
│  Handler   │  → 最終的なレスポンスを送信
└────────────┘
     │
     ▼
HTTP Response
```

### Middlewareができること

- 任意のコードを実行する
- requestオブジェクトとresponseオブジェクトを変更する
- リクエスト—レスポンスサイクルを終了する
- スタック内の次のmiddlewareを呼び出す

### Middlewareのシグネチャ

```javascript
// 通常のmiddleware
function myMiddleware(req, res, next) {
  // 処理
  next(); // 次のmiddlewareに制御を渡す
}

// エラーハンドリングmiddleware（引数4つ — Expressが自動的に識別）
function errorMiddleware(err, req, res, next) {
  res.status(500).json({ error: err.message });
}
```

---

## 組み込みMiddleware

Expressはバージョン4.16以降、いくつかの組み込みmiddleware関数を同梱しています。

### `express.json()`

JSONペイロードを含むリクエストをパースします（旧`body-parser`パッケージの代替）。

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/data', (req, res) => {
  console.log(req.body); // パース済みのJSONオブジェクト
  res.json({ received: req.body });
});
```

オプション:

```javascript
app.use(express.json({
  limit: '10kb',    // リクエストボディの最大サイズ
  strict: true,     // 配列とオブジェクトのみ受け付ける
}));
```

### `express.urlencoded()`

URLエンコードされたペイロード（HTMLフォームの送信）をパースします。

```javascript
app.use(express.urlencoded({ extended: true }));

app.post('/form', (req, res) => {
  console.log(req.body); // { username: 'alice', password: '...' }
  res.redirect('/dashboard');
});
```

`extended: true`は`qs`ライブラリを使用（ネストされたオブジェクトに対応）。`extended: false`は組み込みの`querystring`モジュールを使用します。

### `express.static()`

ディレクトリから静的アセットを配信します。

```javascript
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

### `express.raw()` と `express.text()`

```javascript
// ボディをBuffer（バイナリデータ）としてパース
app.use(express.raw({ type: 'application/octet-stream' }));

// ボディをプレーンな文字列としてパース
app.use(express.text({ type: 'text/plain' }));
```

---

## サードパーティMiddleware

### morgan — HTTPリクエストロガー

```bash
npm install morgan
```

```javascript
const morgan = require('morgan');

// 定義済みフォーマット: combined, common, dev, short, tiny
app.use(morgan('dev'));
// GET /users 200 12.345 ms - 42

// combinedフォーマット（Apache標準形式のロギング）
app.use(morgan('combined'));

// カスタムフォーマット
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 本番環境ではエラー（4xx・5xx）のみログ出力
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
  }));
}
```

### cors — Cross-Origin Resource Sharing

```bash
npm install cors
```

```javascript
const cors = require('cors');

// すべてのオリジンを許可（開発環境のみ）
app.use(cors());

// 特定のオリジンのみ許可
app.use(cors({
  origin: ['https://myapp.com', 'https://staging.myapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Cookieと認証ヘッダーを許可
}));

// ルート単位でCORSを設定
app.get('/public-data', cors(), (req, res) => {
  res.json({ data: 'publicly accessible' });
});
```

### helmet — セキュリティHTTPヘッダー

```bash
npm install helmet
```

```javascript
const helmet = require('helmet');

// デフォルトのセキュリティヘッダーをすべて適用
app.use(helmet());

// 個別のヘッダーをカスタマイズ
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'cdn.jsdelivr.net'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1年
    includeSubDomains: true,
    preload: true,
  },
}));
```

helmetが設定するヘッダーの例:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `Content-Security-Policy`

### express-rate-limit — レート制限

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100,                  // IPごとに1ウィンドウあたり100リクエストまで
  standardHeaders: true,     // RateLimit-* ヘッダーでレート制限情報を返す
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api', limiter);

// 認証ルート用に厳しい制限を設定
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: 10,
  message: { error: 'Too many login attempts.' },
});
app.use('/api/auth', authLimiter);
```

### compression — Gzip圧縮

```bash
npm install compression
```

```javascript
const compression = require('compression');

app.use(compression({
  threshold: 1024, // 1KBを超えるレスポンスのみ圧縮
  level: 6,        // 圧縮レベル（1〜9）
}));
```

---

## カスタムMiddlewareの作成

### ロギングMiddleware

```javascript
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });

  next();
}

app.use(requestLogger);
```

### 認証Middleware

```javascript
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // ユーザー情報をrequestに付加
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// 特定のルートに適用
app.get('/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// /api 以下のすべてのルートに適用
app.use('/api', authenticate);
```

### ロールベースの認可

```javascript
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

app.delete('/admin/users/:id', authenticate, authorize('admin'), (req, res) => {
  res.status(204).send();
});
```

### リクエストバリデーションMiddleware

```javascript
function validateUserBody(req, res, next) {
  const { name, email } = req.body;

  const errors = [];
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('valid email is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  req.body.name = name.trim();
  next();
}

app.post('/users', express.json(), validateUserBody, (req, res) => {
  res.status(201).json(req.body);
});
```

---

## Middlewareの実行順序

順序が重要です。Expressはmiddlewareを登録された順に実行します。

```javascript
const express = require('express');
const app = express();

// 1. すべてのルートに適用 — 最初に登録
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// 2. ルート固有のmiddleware — ルートハンドラーより前に登録
app.use('/api', authenticate);

// 3. ルートハンドラー
app.get('/api/users', (req, res) => res.json({ users: [] }));
app.post('/api/users', validateUserBody, (req, res) => res.status(201).json(req.body));

// 4. 404ハンドラー — すべてのルートの後
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// 5. エラーハンドラー — 常に最後、常に引数4つ
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message });
});
```

```
リクエスト受信
      │
      ▼
 helmet()          ← セキュリティヘッダー
      │
      ▼
 morgan()          ← ロギング
      │
      ▼
 express.json()    ← ボディパース
      │
      ▼
 authenticate()    ← /api/* ルートのみ
      │
      ▼
 Route Handler     ← ビジネスロジック
      │
      ▼ （next(err) が呼ばれた場合）
 Error Handler     ← 引数4つのmiddleware
```

### `next()`の呼び出しバリエーション

```javascript
function middleware(req, res, next) {
  next();           // 次のmiddlewareへ進む
  next('route');    // このルートの残りのハンドラーをスキップ
  next(new Error('Something went wrong')); // エラーハンドラーにエラーを渡す
}
```

---

## エラーハンドリングMiddleware

エラーハンドリングmiddlewareは**必ず4つの引数**を持ちます: `(err, req, res, next)`。

### 基本的なエラーハンドラー

```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});
```

### カスタムエラークラス

```javascript
class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

// ルートハンドラー内で使用
app.get('/items/:id', (req, res, next) => {
  const item = findItem(req.params.id);
  if (!item) {
    return next(new AppError('Item not found', 404));
  }
  res.json(item);
});

// エラーハンドラー内でカスタムエラーと予期しないエラーを区別
app.use((err, req, res, next) => {
  if (err.name === 'AppError') {
    return res.status(err.status).json({ error: err.message });
  }

  // 予期しないエラー — 本番環境では詳細を隠す
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### 非同期エラーの伝播（Express 5）

```javascript
// Express 5: 非同期エラーは自動的に next(err) に渡される
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id); // throwされると自動的にキャッチ
  res.json(user);
});
```

### 非同期エラーの伝播（Express 4）

```javascript
// Express 4: 非同期ハンドラーを手動でラップする
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.json(user);
}));
```

---

## FAQ

**Q: `next()`を呼び忘れるとどうなりますか？**
リクエストが無期限にハングします。クライアントは応答を待ち続けることになります。必ず`next()`、`next(err)`、またはレスポンス送信（`res.send`、`res.json`など）のいずれかを実行してください。

**Q: Middlewareを特定のHTTPメソッドにのみ適用できますか？**
はい。`app.METHOD(path, middleware, handler)`を使うか、そのメソッドのみを扱うルーターにマウントしてください。

**Q: Middleware関数間でデータを共有するにはどうすればよいですか？**
`req`にプロパティを付加します。例えば認証middlewareで`req.user = decoded`とし、次のハンドラーで`req.user`にアクセスします。テンプレートレンダリング以外では`res.locals`を変更しないようにしましょう。

**Q: `app.use`とルートハンドラーの順序は重要ですか？**
はい。あるルートより前に登録されたmiddlewareはそのルートに影響します。後に登録されたものは影響しません。404ハンドラーはすべてのルートの後、エラーハンドラーは最後に置く必要があります。

**Q: 特定のルートでmiddlewareをスキップするにはどうすればよいですか？**
middleware内で条件分岐を使います:
```javascript
function skipForPublic(req, res, next) {
  if (req.path.startsWith('/public')) return next();
  authenticate(req, res, next);
}
```
またはグローバルmiddlewareの代わりにルート固有のmiddlewareをマウントしてください。

---

**親ガイド**: [Node.js Development - SKILL.md](../../SKILL.md)
