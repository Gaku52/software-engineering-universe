# Node.jsとExpressにおけるエラーハンドリング — 完全ガイド

## 目次

1. [Node.jsのエラーの種類](#nodejsのエラーの種類)
2. [同期・非同期のエラーハンドリング](#同期非同期のエラーハンドリング)
3. [グローバルエラーハンドリングMiddleware](#グローバルエラーハンドリングmiddleware)
4. [運用エラーとプログラマーエラー](#運用エラーとプログラマーエラー)
5. [エラーのロギング](#エラーのロギング)
6. [ベストプラクティス](#ベストプラクティス)
7. [FAQ](#faq)

---

## Node.jsのエラーの種類

Node.jsにはいくつかのエラーカテゴリがあります。それぞれを理解することが、適切なエラーハンドリングの第一歩です。

```
Error（基底クラス）
├── SyntaxError         — 不正なJavaScript構文
├── ReferenceError      — 未定義の変数へのアクセス
├── TypeError           — 操作に対して型が不正
├── RangeError          — 許可された範囲外の値
├── URIError            — URI関連関数への不正な引数
├── EvalError           — eval()に関する問題
└── SystemError         — OSレベルのエラー（ENOENT、ECONNREFUSED など）
```

### 組み込みエラーのプロパティ

```javascript
try {
  null.property; // TypeError
} catch (err) {
  console.log(err.name);    // "TypeError"
  console.log(err.message); // "Cannot read properties of null"
  console.log(err.stack);   // スタックトレースの全文字列
}
```

### システム（OS）エラー

```javascript
const fs = require('fs');

fs.readFile('/nonexistent', (err, data) => {
  if (err) {
    console.log(err.code);    // "ENOENT"
    console.log(err.errno);   // -2
    console.log(err.syscall); // "open"
    console.log(err.path);    // "/nonexistent"
  }
});
```

よく使われるシステムエラーコード:

| コード          | 意味                            |
|-----------------|------------------------------------|
| ENOENT          | ファイルまたはディレクトリが存在しない  |
| EACCES          | アクセス権限がない                    |
| ECONNREFUSED    | 接続が拒否された                      |
| ECONNRESET      | 接続がピアによってリセットされた       |
| ETIMEDOUT       | 接続またはオペレーションがタイムアウト  |
| EADDRINUSE      | アドレスがすでに使用中               |

### カスタムエラークラス

```javascript
class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isOperational = true; // 想定内のエラーとしてマーク

    // プロトタイプチェーンを正しく維持する
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}
```

---

## 同期・非同期のエラーハンドリング

### 同期エラー

```javascript
// throw — try/catchでキャッチ
function divide(a, b) {
  if (b === 0) throw new AppError('Division by zero', 400, 'BAD_INPUT');
  return a / b;
}

try {
  const result = divide(10, 0);
} catch (err) {
  console.error(err.message); // "Division by zero"
}

// Expressでは: 同期的なthrowは自動的にキャッチされる
app.get('/sync', (req, res) => {
  throw new NotFoundError('Item'); // Expressがキャッチする
});
```

### 非同期エラー — コールバック

```javascript
const fs = require('fs');

// 旧スタイル: エラーファーストコールバック（err, data）
fs.readFile('./config.json', 'utf8', (err, data) => {
  if (err) {
    // エラーを処理 — ここでthrowしてはいけない
    console.error('Failed to read config:', err.message);
    return;
  }
  console.log(data);
});
```

### 非同期エラー — Promise

```javascript
// Promiseが拒否された場合は .catch() で処理
fetch('https://api.example.com/data')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error('Fetch failed:', err.message));

// 未処理のPromise拒否はNode.js（v15以降）をクラッシュさせる
// 必ず .catch() をつけるか、try/awaitを使う
```

### 非同期エラー — async/await

```javascript
async function fetchUser(id) {
  try {
    const response = await fetch(`https://api.example.com/users/${id}`);
    if (!response.ok) {
      throw new AppError(`Upstream API error: ${response.status}`, 502);
    }
    return await response.json();
  } catch (err) {
    // 呼び出し元に伝播させるために再スロー
    throw err;
  }
}

// Express 4 — 非同期ハンドラーをラップする
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await fetchUser(req.params.id);
  res.json({ success: true, data: user });
}));

// Express 5 — ラップ不要
app.get('/users/:id', async (req, res) => {
  const user = await fetchUser(req.params.id); // 拒否されるとnext(err)に自動転送
  res.json({ success: true, data: user });
});
```

### 非同期エラー — EventEmitter

```javascript
const { EventEmitter } = require('events');
const emitter = new EventEmitter();

// 'error'イベントは必ずハンドルする — 未処理だとNode.jsがクラッシュする
emitter.on('error', (err) => {
  console.error('Emitter error:', err.message);
});

emitter.emit('error', new Error('Something went wrong'));
```

---

## グローバルエラーハンドリングMiddleware

Expressは専用のエラーハンドリングmiddlewareパターン（引数4つ）を提供しています。

### 基本構造

```javascript
// server.js — すべてのルートの後に登録

// 404 — ルートにマッチしなかった場合
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
  });
});

// エラーハンドラー — 必ず引数を4つ取る
app.use((err, req, res, next) => {
  handleError(err, req, res);
});
```

### 本番環境向けエラーハンドラー

```javascript
// middleware/errorHandler.js
const { AppError, ValidationError } = require('../errors');
const logger = require('../utils/logger');

function handleError(err, req, res, next) {
  // ステータスの正規化
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  let errors = undefined;

  // 既知のサードパーティエラー型を処理
  if (err.name === 'JsonWebTokenError') {
    status = 401; message = 'Invalid token'; code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    status = 401; message = 'Token expired'; code = 'TOKEN_EXPIRED';
  } else if (err.name === 'CastError') {
    // MongooseのObjectId不正
    status = 400; message = 'Invalid ID format'; code = 'INVALID_ID';
  } else if (err.name === 'ValidationError' && err.errors) {
    // Mongooseのバリデーション
    status = 422; code = 'VALIDATION_ERROR';
    errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
  }

  // 適切にログ出力
  if (status >= 500) {
    logger.error({ err, req: { method: req.method, url: req.url } });
  } else {
    logger.warn({ code, message, url: req.url });
  }

  // レスポンスを構築
  const body = { success: false, error: { code, message } };
  if (errors) body.error.details = errors;

  // スタックトレースは開発環境のみ含める
  if (process.env.NODE_ENV === 'development') {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = handleError;
```

### 未処理の例外と拒否の対処

```javascript
// server.js — サーバー起動前に登録

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  // サーバーをグレースフルにクローズしてから終了
  server.close(() => process.exit(1));
  // 10秒後に強制終了
  setTimeout(() => process.exit(1), 10_000).unref();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection — shutting down');
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 10_000).unref();
});

const server = app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
```

---

## 運用エラーとプログラマーエラー

この区別によって、エラーの処理と回復方法が決まります。

```
すべてのエラー
├── 運用エラー（想定内）
│   ├── 無効なユーザー入力（400, 422）
│   ├── リソースが見つからない（404）
│   ├── 認証の失敗（401, 403）
│   ├── ネットワークタイムアウト（503）
│   └── ディスク満杯、DB接続切断（503）
│
└── プログラマーエラー（バグ）
    ├── undefinedのプロパティの読み取り
    ├── 誤った引数で関数を呼び出す
    ├── エラーハンドリングのない非同期コード
    └── ロジックのバグ
```

### 運用エラーの判定

```javascript
// カスタムエラーを運用エラーとしてマーク
class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.isOperational = true; // 重要なフラグ
  }
}

function isOperationalError(err) {
  return err instanceof AppError && err.isOperational;
}
```

### 回復戦略

```javascript
// エラーハンドラー内:
function handleError(err, req, res, next) {
  if (isOperationalError(err)) {
    // レスポンスを返してサーバーの稼働を継続
    return res.status(err.status).json({
      success: false,
      error: err.message,
    });
  }

  // プログラマーエラー — ログを出力して再起動
  logger.fatal({ err }, 'Programmer error detected');
  process.exit(1); // プロセスマネージャー（PM2/Docker）が再起動する
}
```

```
運用エラー                     プログラマーエラー
      │                               │
      ▼                               ▼
  警告としてログ出力          fatalとしてログ出力
  HTTPレスポンスを送信        グレースフルシャットダウン
  サーバーを継続稼働          PM2/k8sで再起動
```

---

## エラーのロギング

### pino（本番環境推奨）

```bash
npm install pino pino-pretty
```

```javascript
// utils/logger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined, // 本番環境ではJSON出力
  redact: ['req.headers.authorization', 'body.password'], // シークレットを隠す
});

module.exports = logger;
```

```javascript
// 使用例
logger.info('Server started');
logger.warn({ userId: 42 }, 'Rate limit approached');
logger.error({ err }, 'Database query failed');
logger.fatal({ err }, 'Unrecoverable error');
```

### winstonを使う

```bash
npm install winston
```

```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'development'
      ? winston.format.prettyPrint()
      : winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = logger;
```

### ログレベルと使い分け

```
FATAL  — アプリをシャットダウンしなければならない（未処理の例外）
ERROR  — リクエスト失敗、要調査（5xx）
WARN   — 想定外だが処理済み（4xx、レート制限）
INFO   — 通常の運用イベント（サーバー起動、リクエスト）
DEBUG  — 詳細な診断情報
TRACE  — 非常に詳細、本番環境ではほとんど使わない
```

### 構造化ロギング

Datadog、CloudWatch、ELKでログを検索しやすくするためJSONでログを出力します:

```javascript
// 良い例 — 構造化されていて検索しやすい
logger.error({
  err,
  requestId: req.id,
  userId: req.user?.id,
  method: req.method,
  url: req.url,
  duration: Date.now() - req.startTime,
}, 'Request failed');

// 悪い例 — パースしにくい
console.log(`ERROR: ${err.message} for user ${req.user?.id} on ${req.url}`);
```

---

## ベストプラクティス

### 1. async/awaitはtry/catchまたはasyncHandlerとセットで使う

```javascript
// 未処理のPromise拒否を残してはいけない
app.get('/bad', async (req, res) => {
  const data = await riskyOperation(); // ❌ Express 4ではエラーハンドリングなし
});

// Express 4ではasyncHandlerでラップする
app.get('/good', asyncHandler(async (req, res) => {
  const data = await riskyOperation(); // ✅ エラーはエラーハンドラーに転送される
  res.json(data);
}));
```

### 2. 内部エラーをクライアントに公開しない

```javascript
// ❌ 実装の詳細が漏れる
res.status(500).json({ error: err.stack });

// ✅ 本番環境では安全
res.status(500).json({ error: 'Internal server error' });

// ✅ 詳細は開発環境のみ
if (process.env.NODE_ENV === 'development') {
  res.status(500).json({ error: err.message, stack: err.stack });
} else {
  res.status(500).json({ error: 'Internal server error' });
}
```

### 3. 入力は早めにバリデーションする

```javascript
// 境界でバリデーション — ビジネスロジックより前に
router.post('/users',
  validate(createUserRules), // 無効なら422
  asyncHandler(createUser)   // ビジネスロジック
);
```

### 4. 集中エラーハンドラーを使う

```javascript
// ❌ エラーハンドリングがルートに散在
app.get('/a', (req, res) => { try { ... } catch (e) { res.status(500)... } });
app.get('/b', (req, res) => { try { ... } catch (e) { res.status(500)... } });

// ✅ 1つのエラーハンドラーがすべてのルートを担当
app.get('/a', asyncHandler(handlerA));
app.get('/b', asyncHandler(handlerB));
app.use(centralErrorHandler); // すべてを処理
```

### 5. タイムアウトを設定する

```javascript
// リクエストタイムアウトmiddleware
app.use((req, res, next) => {
  req.setTimeout(30_000, () => {
    const err = new AppError('Request timeout', 408, 'TIMEOUT');
    next(err);
  });
  next();
});

// タイムアウト付きの上流フェッチ
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new AppError('Upstream timeout', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

### 6. グレースフルシャットダウン

```javascript
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
    // DBコネクションを閉じ、ログをフラッシュするなど
    logger.info('Shutdown complete');
    process.exit(0);
  });

  // 30秒後に強制終了
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 30_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker/k8s
process.on('SIGINT',  () => shutdown('SIGINT'));  // Ctrl+C
```

### チェックリストまとめ

```
✅ 非同期ルートにはasyncHandlerラッピングまたはExpress 5を使用
✅ 引数4つの集中エラーハンドラー
✅ ルートエントリポイントで入力バリデーション
✅ isOperationalフラグ付きのカスタムエラークラス
✅ 適切なログレベルでの構造化ロギング（JSON）
✅ レスポンスやログに機密データを含めない
✅ 未処理の拒否と未キャッチ例外のリスナー設定
✅ SIGTERM/SIGINTでのグレースフルシャットダウン
✅ すべての外部呼び出しにタイムアウト設定
✅ 開発環境と本番環境で挙動を分ける
```

---

## FAQ

**Q: Express 4で非同期middlewareの中でthrowするとどうなりますか？**
エラーは自動的にキャッチされず、未処理の拒否になります。すべての非同期middlewareは`asyncHandler`でラップするか、Express 5に移行してください。

**Q: ルートハンドラーでは`next(err)`と`throw err`のどちらを使うべきですか？**
Express 4の同期コードではどちらも機能します。ただし非同期関数（Express 5なし）では、`next(err)`のみがエラーを確実に転送できます。明確さと互換性のために`next(err)`を推奨します。

**Q: エラーハンドリングのテストはどうすればよいですか？**
supertestを使ってエラーを発生させるリクエストを行い、レスポンスの形式を検証します:
```javascript
const request = require('supertest');
const app = require('../server');

test('returns 404 for unknown user', async () => {
  const res = await request(app).get('/api/v1/users/99999');
  expect(res.status).toBe(404);
  expect(res.body.success).toBe(false);
});
```

**Q: プログラマーエラー発生時にプロセスを終了すべきですか？**
はい。プログラマーエラーはアプリケーションを未知の状態にします。プロセスを終了し、プロセスマネージャー（PM2、Docker、Kubernetes）にクリーンな状態で再起動させましょう。

**Q: `console.log`と本格的なロガーの違いは何ですか？**
`console.log`にはログレベル、構造化フィールド、トランスポートオプションがありません。最初から`pino`や`winston`をインストールしましょう — 後から移行するのは面倒です。最低でも、エラーには`console.error`、情報には`console.info`を使ってください。

---

**親ガイド**: [Node.js Development - SKILL.md](../../SKILL.md)
