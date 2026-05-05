# Complete Guide to Deployment Platforms

> The choice of deployment platform directly impacts your app's performance, cost, and operations. Understand the characteristics and selection criteria of major platforms such as Vercel, Cloudflare, AWS, Docker, GCP, Azure, Railway, and Fly.io, and choose the deployment strategy best suited to your project.

## Prerequisites

To get the most out of this guide, it is recommended that you have prior knowledge of the following.

- **Performance optimization concepts**: Fundamentals of bundle size, CDN, and caching strategies
- **CI/CD fundamentals**: Concepts and workflows for continuous integration/deployment

## What You Will Learn

- [ ] Understand comparisons and selection criteria for major deployment platforms
- [ ] Learn the pricing models, limitations, and scaling characteristics of each platform
- [ ] Learn Dockerization and self-hosting patterns
- [ ] Understand how to integrate with CI/CD pipelines
- [ ] Learn design patterns for multi-region and edge deployments
- [ ] Acquire practical techniques for cost optimization and performance tuning
- [ ] Understand operational patterns such as incident response, rollback, and blue-green deployments

---

## 1. Comprehensive Platform Comparison

### 1.1 Major Platform List and Feature Matrix

```
                Vercel     Cloudflare   AWS         GCP         Azure       Docker/VPS   Railway     Fly.io
──────────────────────────────────────────────────────────────────────────────────────────────────────────
対象           Next.js     全般         全般        全般        全般        全般          全般        全般
サーバーレス    ○          ○(Workers)   ○(Lambda)   ○(Cloud Run) ○(Functions) ×           ○           △
エッジ         ○          ◎            ○           ○           △           ×            ×           ○
SSR            ○          △            ○           ○           ○           ○            ○           ○
コスト         中          安い         変動        変動        変動        インフラ次第   安い        中
スケーリング   自動        自動         自動/手動    自動        自動/手動    手動/K8s      自動        自動
カスタマイズ   低          中           高          高          高          最高          中          中
学習コスト     最低        低           高          中〜高      中〜高      中            低          低
DB統合         △          D1,KV等      RDS等       Cloud SQL   Azure DB    自由          PostgreSQL  PostgreSQL
SSL/TLS        自動        自動         ACM/手動    自動/手動   自動/手動   Let's Encrypt  自動        自動
カスタムドメイン ○          ○            ○           ○           ○           ○            ○           ○
ログ/監視      基本        基本         CloudWatch  Cloud Logging App Insights 自前構築   基本        基本
```

### 1.2 Cost Comparison (by Monthly Traffic)

```
月間100万PV想定のコスト比較:

                     月額コスト    帯域        リクエスト上限      備考
─────────────────────────────────────────────────────────────────────
Vercel Pro           $20          1TB         無制限             チーム機能含む
Cloudflare Pages     $0〜$5       無制限      無制限             Workers併用時$5
AWS Amplify          $15〜$50     変動        変動               転送量課金
AWS ECS Fargate      $50〜$200    変動        無制限             インスタンス課金
GCP Cloud Run        $10〜$100    変動        変動               リクエスト+CPU課金
Railway              $5〜$20      変動        無制限             リソース課金
Fly.io               $10〜$50     変動        無制限             VM課金
VPS (Hetzner等)      $5〜$20      固定        無制限             自己管理
```

### 1.3 Selection Flowchart

```
プロジェクト要件の確認
│
├─ Next.js プロジェクト？
│  ├─ Yes → 予算は？
│  │  ├─ 無料〜$20/月 → Vercel (Hobby / Pro)
│  │  ├─ AWS 環境必須 → AWS Amplify or ECS
│  │  └─ エッジ重視 → Cloudflare Pages + Workers
│  └─ No → フレームワークは？
│     ├─ React SPA / Vue / Svelte → Cloudflare Pages or Vercel
│     ├─ Express / Fastify API → Railway / Fly.io / ECS
│     └─ Full-stack (DB含む) → Railway / AWS / GCP
│
├─ エッジでの実行が必要？
│  ├─ Yes → Cloudflare Workers or Vercel Edge Functions
│  └─ No → 次の判断基準へ
│
├─ コンテナ化が必要？
│  ├─ Yes → AWS ECS / GCP Cloud Run / Fly.io / Docker + VPS
│  └─ No → マネージドサービスを検討
│
├─ データベースの要件は？
│  ├─ 軽量 (SQLite相当) → Cloudflare D1 / Turso
│  ├─ PostgreSQL → Railway / Supabase / AWS RDS / GCP Cloud SQL
│  ├─ NoSQL → DynamoDB / Firestore / MongoDB Atlas
│  └─ グローバル分散 → PlanetScale / CockroachDB / Cloudflare D1
│
└─ 予算制約は？
   ├─ 無料枠で運用 → Cloudflare Pages / Vercel Hobby / Railway Free
   ├─ $20以下 → Vercel Pro / Railway / VPS
   ├─ $20〜$100 → AWS / GCP / Fly.io
   └─ $100以上 → AWS / GCP / Azure（フルカスタム構成）
```

---

## 2. Vercel

### 2.1 Overview and Architecture

Vercel is a frontend-focused cloud platform provided by the creators of Next.js. It offers zero-config deployment via Git push, automatic preview environments per PR, and global delivery via an edge network。

```
Vercel アーキテクチャ:

  Git Push / PR
      │
      ▼
  ┌─────────────────┐
  │   Build System   │  ← フレームワーク自動検出
  │  (npm/pnpm/yarn) │     ビルドキャッシュ
  └────────┬─────────┘
           │
     ┌─────┴──────┐
     │            │
     ▼            ▼
  ┌──────┐   ┌──────────────┐
  │ CDN  │   │ Serverless   │
  │(静的) │   │  Functions   │
  │      │   │ (Node.js等)  │
  └──────┘   └──────────────┘
     │            │
     └─────┬──────┘
           ▼
  ┌─────────────────┐
  │  Edge Network   │  ← 世界中のエッジロケーション
  │  (グローバル配信) │
  └─────────────────┘
```

### 2.2 Setup and Deploy Flow

```bash
# Vercel CLI のインストール
npm install -g vercel

# プロジェクトの初期化とリンク
vercel link

# 開発サーバー（Vercel の環境変数を利用可能）
vercel dev

# プレビューデプロイ（ステージング）
vercel

# 本番デプロイ
vercel --prod

# Environment variablesの設定
vercel env add NEXT_PUBLIC_API_URL
vercel env add DATABASE_URL --sensitive

# Environment variablesの一覧表示
vercel env ls

# Environment variablesの削除
vercel env rm NEXT_PUBLIC_API_URL
```

### 2.3 Advanced Configuration with vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": ".next",
  "regions": ["hnd1", "sfo1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" },
        { "key": "Cache-Control", "value": "no-store, max-age=0" }
      ]
    },
    {
      "source": "/(.*)\\.(?:js|css|woff2?|png|jpg|svg|ico)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
        },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ],
  "redirects": [
    { "source": "/old-page", "destination": "/new-page", "permanent": true },
    { "source": "/blog/:slug", "destination": "/posts/:slug", "permanent": true }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.example.com/:path*" }
  ],
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    },
    "api/heavy-task.ts": {
      "memory": 3009,
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### 2.4 Vercel Edge Functions

```typescript
// app/api/edge-example/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// エッジで実行される API Route
export async function GET(request: NextRequest) {
  // リクエストのジオロケーション情報を取得
  const { geo, ip } = request;
  const country = geo?.country || 'Unknown';
  const city = geo?.city || 'Unknown';
  const region = geo?.region || 'Unknown';

  // ユーザーの地域に基づくコンテンツのパーソナライズ
  const greeting = getLocalizedGreeting(country);

  return NextResponse.json({
    greeting,
    location: { country, city, region },
    ip,
    timestamp: new Date().toISOString(),
    edge: true,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

function getLocalizedGreeting(country: string): string {
  const greetings: Record<string, string> = {
    JP: 'こんにちは！',
    US: 'Hello!',
    KR: '안녕하세요!',
    CN: '你好！',
    FR: 'Bonjour!',
    DE: 'Hallo!',
    ES: '¡Hola!',
  };
  return greetings[country] || 'Hello!';
}
```

```typescript
// middleware.ts（Vercel Edge Middleware）
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const country = request.geo?.country || 'US';

  // 1. 地域ベースのリダイレクト
  if (pathname === '/' && country === 'JP') {
    return NextResponse.redirect(new URL('/ja', request.url));
  }

  // 2. A/Bテスト（Cookie ベース）
  const abTestCookie = request.cookies.get('ab-test-variant');
  if (!abTestCookie && pathname.startsWith('/landing')) {
    const variant = Math.random() < 0.5 ? 'a' : 'b';
    const response = NextResponse.rewrite(
      new URL(`/landing/${variant}`, request.url)
    );
    response.cookies.set('ab-test-variant', variant, {
      maxAge: 60 * 60 * 24 * 7, // 1週間
      httpOnly: true,
    });
    return response;
  }

  // 3. Bot検出とブロック
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = /bot|crawl|spider|scrape/i.test(userAgent);
  if (isBot && pathname.startsWith('/api/')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 4. レート制限ヘッダーの付与
  const response = NextResponse.next();
  response.headers.set('X-Request-Country', country);
  response.headers.set('X-Request-Time', Date.now().toString());

  return response;
}

export const config = {
  matcher: ['/', '/landing/:path*', '/api/:path*'],
};
```

### 2.5 Vercel Plan Features and Limits

```
Hobby プラン（無料）:
  ├─ 個人プロジェクト専用（商用利用不可）
  ├─ Serverless Functions: 10秒タイムアウト
  ├─ Edge Functions: 実行時間制限あり
  ├─ 帯域: 100GB/月
  ├─ ビルド時間: 6,000分/月
  ├─ 同時ビルド: 1
  ├─ チームメンバー: 1名
  ├─ Analytics: 基本（Web Vitals）
  ├─ プレビューデプロイ: 制限あり
  └─ サポート: コミュニティのみ

Pro プラン（$20/月/メンバー）:
  ├─ 商用利用可
  ├─ Serverless Functions: 60秒タイムアウト（最大300秒に拡張可能）
  ├─ Edge Functions: 拡張された実行時間
  ├─ 帯域: 1TB/月（超過分 $40/100GB）
  ├─ ビルド時間: 24,000分/月
  ├─ 同時ビルド: 3
  ├─ チームメンバー: 無制限
  ├─ Analytics: 高度（カスタムイベント対応）
  ├─ プレビューデプロイ: 無制限
  ├─ パスワード保護: ○
  ├─ DDoS 軽減: 基本
  ├─ サポート: メール
  └─ SAML SSO: 追加料金

Enterprise プラン（カスタム料金）:
  ├─ SLA 99.99%
  ├─ Serverless Functions: 900秒タイムアウト
  ├─ 帯域: カスタム
  ├─ 同時ビルド: カスタム
  ├─ 専用サポート
  ├─ SOC 2 / HIPAA 対応
  ├─ IP アクセス制限
  ├─ ファイアウォール
  ├─ マルチリージョン
  └─ カスタム SLA
```

### 2.6 Vercel Best Practices

```typescript
// next.config.ts - Vercel 向け最適化設定
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // standalone 出力（Docker デプロイ時に有用）
  // output: 'standalone',

  // 画像最適化
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.example.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30日
  },

  // ヘッダー設定
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // 実験的機能
  experimental: {
    // PPR (Partial Prerendering) の有効化
    ppr: true,
    // Server Actions の最適化
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Log設定（Vercel でのデバッグ用）
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
```

### 2.7 Vercel Anti-Patterns

```
アンチパターン 1: 大量の Serverless Functions
  問題: 関数ごとにコールドスタートが発生、コスト増
  対策: Route Handler を適切にグルーピングし、共通処理を Middleware に移動

アンチパターン 2: 巨大な node_modules のバンドル
  問題: ビルド時間の増大、関数サイズの肥大化
  対策: 不要な依存関係の削除、tree-shaking の活用、外部パッケージの最適化

アンチパターン 3: 環境変数の直書き
  問題: セキュリティリスク、環境間の設定混乱
  対策: Vercel のEnvironment Variables機能を使用、.env.local はgitignore

アンチパターン 4: ISR の revalidate 値が短すぎる
  問題: オリジンへのリクエスト集中、コスト増
  対策: コンテンツの更新頻度に応じた適切な revalidate 値の設定

アンチパターン 5: Preview デプロイの放置
  問題: 古いデプロイメントがリソースを消費
  対策: GitHub Actions で古いデプロイメントを自動クリーンアップ

アンチパターン 6: Hobby プランでの商用運用
  問題: 利用規約違反、突然のサービス停止リスク
  対策: 商用プロジェクトは必ず Pro プラン以上を使用
```

---

## 3. Cloudflare Pages / Workers

### 3.1 Overview and Architecture

Cloudflare is a CDN/edge computing platform with over 300 edge locations worldwide. Workers based on V8 Isolates enable near-zero cold-start serverless execution. Combined with Pages for static site hosting, it enables full-stack web application delivery at the edge。

```
Cloudflare アーキテクチャ:

  ユーザーリクエスト
      │
      ▼
  ┌─────────────────────┐
  │   Cloudflare Edge   │  ← 最寄りのエッジロケーション
  │   (300+ locations)   │
  └────────┬────────────┘
           │
     ┌─────┴──────────┐
     │                │
     ▼                ▼
  ┌──────────┐   ┌──────────────┐
  │  Pages   │   │   Workers    │
  │ (静的    │   │ (V8 Isolates)│
  │  アセット) │   │              │
  └──────────┘   └──────┬───────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
              ▼         ▼         ▼
          ┌──────┐  ┌──────┐  ┌──────┐
          │  KV  │  │  D1  │  │  R2  │
          │      │  │(SQLite│  │(S3互  │
          │      │  │ 互換) │  │ 換)   │
          └──────┘  └──────┘  └──────┘
              │
              ▼
          ┌──────────────┐
          │ Durable      │
          │ Objects      │
          │ (ステート管理) │
          └──────────────┘
```

### 3.2 Cloudflare Pages Setup

```bash
# Wrangler CLI のインストール
npm install -g wrangler

# Authentication
wrangler login

# 新規プロジェクトの作成（フレームワーク選択）
npm create cloudflare@latest my-app

# 既存プロジェクトの Pages デプロイ
wrangler pages deploy ./dist

# Pages プロジェクトの作成（GitHub 連携）
wrangler pages project create my-project

# ローカル開発サーバー
wrangler pages dev ./dist --port 3000

# Environment variablesの設定
wrangler pages secret put API_KEY
```

### 3.3 Workers Implementation Patterns

```typescript
// src/worker.ts - 基本的な Worker
export interface Env {
  MY_KV: KVNamespace;
  MY_DB: D1Database;
  MY_BUCKET: R2Bucket;
  API_KEY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ルーティング
    switch (true) {
      case path === '/api/health':
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case path.startsWith('/api/users'):
        return handleUsers(request, env, ctx);

      case path.startsWith('/api/files'):
        return handleFiles(request, env, ctx);

      default:
        return new Response('Not Found', { status: 404 });
    }
  },

  // スケジュールされたタスク（Cron Triggers）
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(cleanupExpiredData(env));
  },

  // キューの処理
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    for (const message of batch.messages) {
      await processMessage(message, env);
      message.ack();
    }
  },
};

// ユーザー API のハンドラ
async function handleUsers(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const { method } = request;

  if (method === 'GET') {
    // D1 データベースからユーザー一覧を取得
    const { results } = await env.MY_DB.prepare(
      'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 50'
    ).all();

    return Response.json({ users: results });
  }

  if (method === 'POST') {
    const body = await request.json() as { name: string; email: string };
    const { name, email } = body;

    // バリデーション
    if (!name || !email) {
      return Response.json(
        { error: 'name and email are required' },
        { status: 400 }
      );
    }

    // D1 にユーザーを挿入
    const result = await env.MY_DB.prepare(
      'INSERT INTO users (name, email, created_at) VALUES (?, ?, datetime("now")) RETURNING *'
    ).bind(name, email).first();

    // KV にキャッシュ
    ctx.waitUntil(
      env.MY_KV.put(`user:${result?.id}`, JSON.stringify(result), {
        expirationTtl: 3600,
      })
    );

    return Response.json({ user: result }, { status: 201 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

// ファイル処理ハンドラ（R2 使用）
async function handleFiles(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const key = url.pathname.replace('/api/files/', '');

  if (request.method === 'PUT') {
    // R2 にファイルをアップロード
    const body = await request.arrayBuffer();
    const contentType = request.headers.get('content-type') || 'application/octet-stream';

    await env.MY_BUCKET.put(key, body, {
      httpMetadata: { contentType },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        size: body.byteLength.toString(),
      },
    });

    return Response.json({ key, size: body.byteLength });
  }

  if (request.method === 'GET') {
    const object = await env.MY_BUCKET.get(key);
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('ETag', object.httpEtag);

    return new Response(object.body, { headers });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

async function cleanupExpiredData(env: Env): Promise<void> {
  await env.MY_DB.prepare(
    'DELETE FROM sessions WHERE expires_at < datetime("now")'
  ).run();
}

async function processMessage(
  message: Message<unknown>,
  env: Env
): Promise<void> {
  console.log('Processing message:', message.body);
}
```

### 3.4 wrangler.toml Configuration

```toml
# wrangler.toml
name = "my-worker"
main = "src/worker.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# 環境設定
[vars]
ENVIRONMENT = "production"

# KV Namespace
binding = "MY_KV"
id = "xxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyy"

# D1 Database
binding = "MY_DB"
database_name = "my-database"
database_id = "zzzzzzzzzzzzzzzzzzzz"

# R2 Bucket
binding = "MY_BUCKET"
bucket_name = "my-bucket"

# Cron Triggers
[triggers]
crons = ["0 0 * * *", "*/30 * * * *"]

# Queue
queue = "my-queue"
binding = "MY_QUEUE"

queue = "my-queue"
max_batch_size = 10
max_batch_timeout = 30

# Routing
pattern = "api.example.com/*"
zone_name = "example.com"

# ステージング環境
[env.staging]
name = "my-worker-staging"
[env.staging.vars]
ENVIRONMENT = "staging"

# D1 のマイグレーション
tag = "v1"
new_classes = ["UserDurableObject"]
```

### 3.5 Database Management with Cloudflare D1

```bash
# D1 データベースの作成
wrangler d1 create my-database

# Migrationの作成
wrangler d1 migrations create my-database init

# Migration SQL の例
# migrations/0001_init.sql
```

```sql
-- migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  published BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_published ON posts(published);
```

```bash
# Migrationの実行（ローカル）
wrangler d1 migrations apply my-database --local

# Migrationの実行（本番）
wrangler d1 migrations apply my-database --remote

# Databaseへのクエリ実行
wrangler d1 execute my-database --command "SELECT * FROM users LIMIT 10"

# SQL ファイルの実行
wrangler d1 execute my-database --file ./seed.sql --remote
```

### 3.6 Cloudflare Plan Features and Limits

```
Free プラン:
  Workers:
  ├─ リクエスト: 100,000/日
  ├─ CPU 時間: 10ms/リクエスト
  ├─ メモリ: 128MB
  └─ スクリプトサイズ: 1MB (圧縮後)

  Pages:
  ├─ ビルド: 500回/月
  ├─ 同時ビルド: 1
  ├─ 帯域: 無制限
  └─ サイト数: 無制限

  D1:
  ├─ 読み取り: 500万行/日
  ├─ 書き込み: 100,000行/日
  └─ ストレージ: 5GB

  KV:
  ├─ 読み取り: 100,000/日
  ├─ 書き込み: 1,000/日
  └─ ストレージ: 1GB

  R2:
  ├─ ストレージ: 10GB
  ├─ Class A 操作: 100万/月
  └─ Class B 操作: 1000万/月

Paid プラン ($5/月):
  Workers:
  ├─ リクエスト: 1000万/月（超過 $0.50/100万）
  ├─ CPU 時間: 50ms/リクエスト（Bundled）/ 30秒（Unbound）
  ├─ メモリ: 128MB
  └─ スクリプトサイズ: 10MB (圧縮後)

  D1:
  ├─ 読み取り: 250億行/月
  ├─ 書き込み: 5000万行/月
  └─ ストレージ: 50GB

  KV:
  ├─ 読み取り: 1000万/月
  ├─ 書き込み: 100万/月
  └─ ストレージ: 無制限
```

### 3.7 Cloudflare Best Practices and Anti-Patterns

```
ベストプラクティス:
  1. KV はキャッシュとして使い、D1 を永続ストアにする
  2. waitUntil() で非同期処理をバックグラウンドに逃がす
  3. Workers の CPU 時間制限を意識した軽量な処理設計
  4. Durable Objects でステートフルな処理を実装
  5. Pages Functions で静的サイトに API を追加
  6. R2 でファイルストレージを S3 互換で構築

アンチパターン:
  1. Workers で重い計算処理を実行（CPU時間制限に抵触）
  2. KV に頻繁な書き込み（結果整合性のため不整合リスク）
  3. D1 で大量のJOINを含む複雑なクエリ（SQLite ベースのため制限あり）
  4. Node.js API への完全な依存（V8 Isolates は Node.js ランタイムではない）
  5. 単一の Worker に全ロジックを詰め込む（Service Bindings を活用）
```

---

## 4. Docker + Self-Hosting

### 4.1 Overview and Use Cases

Self-hosting with Docker containers avoids platform lock-in and enables full control of infrastructure. For VPS (Virtual Private Server) and on-premises servers, install Docker and run your application as a container. While this minimizes dependency on cloud providers, it also increases operational overhead。

```
Docker セルフホストの構成パターン:

パターン 1: シンプル（単一サーバー）
  VPS
  ├─ Docker
  │  ├─ App コンテナ（Next.js / Express）
  │  ├─ DB コンテナ（PostgreSQL）
  │  └─ Redis コンテナ（キャッシュ）
  ├─ Nginx（リバースプロキシ）
  └─ Let's Encrypt（SSL）

パターン 2: Docker Compose（複数サービス）
  VPS
  ├─ docker-compose.yml
  │  ├─ app（Next.js）
  │  ├─ api（Express/Fastify）
  │  ├─ db（PostgreSQL）
  │  ├─ redis（キャッシュ/セッション）
  │  ├─ nginx（リバースプロキシ）
  │  └─ certbot（SSL自動更新）
  └─ volumes/（永続データ）

パターン 3: Kubernetes（大規模）
  K8s クラスタ
  ├─ Deployments
  │  ├─ app（3 replicas）
  │  └─ api（3 replicas）
  ├─ Services
  ├─ Ingress（Nginx Ingress Controller）
  ├─ ConfigMaps / Secrets
  ├─ PersistentVolumeClaims
  └─ HPA（Horizontal Pod Autoscaler）
```

### 4.2 Next.js Production Dockerfile (Multi-Stage Build)

```dockerfile
# ============================================
# Next.js 本番用 Dockerfile（最適化版）
# ============================================

# ── Stage 1: 依存関係のインストール ──
FROM node:20-alpine AS deps
WORKDIR /app

# Security: 不要なパッケージを入れない
RUN apk add --no-cache libc6-compat

# Packageマネージャのファイルをコピー
COPY package.json pnpm-lock.yaml ./

# pnpm を有効化して依存関係をインストール
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod=false

# ── Stage 2: ビルド ──
FROM node:20-alpine AS builder
WORKDIR /app

# Environment variables（ビルド時に必要なもの）
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Dependenciesをコピー
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# テレメトリの無効化
ENV NEXT_TELEMETRY_DISABLED=1

# Build実行
RUN corepack enable pnpm && pnpm build

# ── Stage 3: 本番イメージ ──
FROM node:20-alpine AS runner
WORKDIR /app

# 本番モード
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: 非 root ユーザーで実行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 必要なファイルのみコピー（standalone 出力の場合）
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# ファイルの所有権を変更
RUN chown -R nextjs:nodejs /app

# 非 root ユーザーに切り替え
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Portの公開
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# サーバー起動
CMD ["node", "server.js"]
```

```javascript
// next.config.js（standalone 出力を有効化）
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  // Imageサイズ削減のため不要な機能を無効化
  poweredByHeader: false,
  compress: true,
};
```

### 4.3 Dockerfile for Express / Fastify API

```dockerfile
# ============================================
# Express/Fastify API 本番用 Dockerfile
# ============================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# 本番用依存関係のみコピー
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Security: 不要なファイルを削除
RUN rm -rf /app/node_modules/.cache

USER appuser
EXPOSE 8080
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/server.js"]
```

### 4.4 Production Configuration with Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.9'

services:
  # ── アプリケーション ──
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://api.example.com
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://app:secret@db:5432/myapp
      - REDIS_URL=redis://redis:6379
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ── データベース ──
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G

  # ── Redis ──
  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  # ── Nginx リバースプロキシ ──
  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot_data:/var/www/certbot:ro
      - certbot_certs:/etc/letsencrypt:ro
    depends_on:
      - app
    networks:
      - app-network

  # ── SSL 証明書の自動更新 ──
  certbot:
    image: certbot/certbot
    volumes:
      - certbot_data:/var/www/certbot
      - certbot_certs:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  postgres_data:
  redis_data:
  certbot_data:
  certbot_certs:

networks:
  app-network:
    driver: bridge
```

### 4.5 Nginx Reverse Proxy Configuration

```nginx
# nginx/conf.d/default.conf
upstream app_server {
    server app:3000;
    keepalive 64;
}

# HTTP → HTTPS リダイレクト
server {
    listen 80;
    server_name example.com www.example.com;

    # Let's Encrypt の認証用
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS サーバー
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # SSL 証明書
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # SSL 設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Securityヘッダー
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip 圧縮
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/xml+rss text/javascript image/svg+xml;

    # Static filesのキャッシュ
    location /_next/static/ {
        proxy_pass http://app_server;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 画像のキャッシュ
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp|avif)$ {
        proxy_pass http://app_server;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # API エンドポイント
    location /api/ {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # レート制限
        limit_req zone=api burst=20 nodelay;
    }

    # メインアプリケーション
    location / {
        proxy_pass http://app_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.6 Docker Image Optimization Techniques

```
Docker イメージサイズ最適化:

手法 1: マルチステージビルド
  効果: ビルドツールを最終イメージに含めない
  目安: 1GB → 150MB への削減が可能

手法 2: Alpine ベースイメージ
  node:20        → 約 1GB
  node:20-slim   → 約 200MB
  node:20-alpine → 約 130MB

手法 3: .dockerignore の活用
  除外すべきもの:
  ├─ node_modules/
  ├─ .git/
  ├─ .next/
  ├─ .env*
  ├─ *.md
  ├─ tests/
  ├─ coverage/
  └─ .vscode/

手法 4: レイヤーキャッシュの最適化
  変更頻度の低いもの → 上位レイヤー
  変更頻度の高いもの → 下位レイヤー
  例: package.json のコピー → npm install → ソースコードのコピー

手法 5: standalone 出力（Next.js）
  通常: node_modules 全体が必要 → 数百MB
  standalone: 必要な依存のみバンドル → 50-100MB
```

```
# .dockerignore
node_modules
.git
.gitignore
.next
.env*
*.md
README*
LICENSE
tests/
__tests__/
coverage/
.vscode/
.idea/
.husky/
.github/
docker-compose*.yml
Dockerfile*
```

### 4.7 Self-Hosting Best Practices and Anti-Patterns

```
ベストプラクティス:
  1. 非 root ユーザーでコンテナを実行する
  2. マルチステージビルドでイメージサイズを最小化
  3. HEALTHCHECK を必ず設定する
  4. ボリュームで永続データを管理する
  5. ログローテーションを設定する（max-size, max-file）
  6. リソース制限を設定する（CPU, メモリ）
  7. secrets はファイルマウントか環境変数で管理
  8. 定期的にベースイメージを更新する（セキュリティパッチ）

アンチパターン:
  1. root ユーザーでコンテナ実行 → 権限昇格のリスク
  2. latest タグの使用 → 再現性がない
  3. .env ファイルをイメージに含める → シークレットの漏洩
  4. ボリュームなしでDBを運用 → コンテナ削除でデータ消失
  5. ログをコンテナ内に保存 → ディスク圧迫
  6. リソース制限なし → OOM でホスト全体が影響
  7. ヘルスチェックなし → 障害検知の遅延
```

---

## 5. AWS Deployment Patterns

### 5.1 AWS Service Selection Matrix

```
AWS デプロイの4つのパターン:

                    Amplify      ECS Fargate    Lambda          S3+CloudFront
────────────────────────────────────────────────────────────────────────
対象              フルスタック    コンテナ       関数            静的サイト
SSR               ○            ○              △(Adapter必要)   ×
SSG               ○            ○              ○               ○
API               ○            ○              ○(API GW連携)    ×
コスト            低〜中        中〜高         最低〜低         最低
スケーリング      自動          自動(Fargate)   自動             自動
デプロイ速度      速い          やや遅い       速い             速い
カスタマイズ      低            高             中               低
学習コスト        低            中〜高         中               低
Docker必須        ×            ○              ×               ×
コールドスタート  なし          なし           あり             なし
最大実行時間      制限あり      無制限         15分             N/A
```

### 5.2 Deployment with AWS Amplify

```bash
# Amplify CLI のインストール
npm install -g @aws-amplify/cli

# Amplify の初期化
amplify init

# ホスティングの追加
amplify add hosting

# Deploy
amplify publish
```

```yaml
# amplify.yml - Amplify ビルド設定
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable pnpm
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*

  # Environment variables（Amplify コンソールで設定推奨）
  environmentVariables:
    NEXT_PUBLIC_API_URL: https://api.example.com
```

### 5.3 Container Deployment with AWS ECS Fargate

```json
// task-definition.json（ECS タスク定義）
{
  "family": "my-nextjs-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "nextjs-app",
      "image": "ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3000" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:ACCOUNT_ID:secret:myapp/database-url"
        },
        {
          "name": "SESSION_SECRET",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:ACCOUNT_ID:secret:myapp/session-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/my-nextjs-app",
          "awslogs-region": "ap-northeast-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "essential": true
    }
  ]
}
```

```bash
# ECR リポジトリの作成
aws ecr create-repository --repository-name my-app --region ap-northeast-1

# Docker イメージのビルドとプッシュ
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com

docker build -t my-app .
docker tag my-app:latest ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest
docker push ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:latest

# ECS サービスの作成（Fargate）
aws ecs create-service \
  --cluster my-cluster \
  --service-name my-nextjs-service \
  --task-definition my-nextjs-app \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-zzz],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:ap-northeast-1:ACCOUNT_ID:targetgroup/my-tg/xxx,containerName=nextjs-app,containerPort=3000"

# Serviceの更新（新しいイメージでデプロイ）
aws ecs update-service \
  --cluster my-cluster \
  --service my-nextjs-service \
  --force-new-deployment
```

### 5.4 AWS Lambda + API Gateway

```typescript
// lambda/handler.ts - Lambda 関数ハンドラ
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const { httpMethod, path, body, queryStringParameters, headers } = event;

  try {
    // ルーティング
    if (path === '/api/health') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
      };
    }

    if (path === '/api/users' && httpMethod === 'GET') {
      // DynamoDB からデータ取得（例）
      const users = await getUsers();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=60',
        },
        body: JSON.stringify({ users }),
      };
    }

    if (path === '/api/users' && httpMethod === 'POST') {
      const userData = JSON.parse(body || '{}');
      const user = await createUser(userData);
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
      };
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not Found' }),
    };
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

async function getUsers() {
  // DynamoDB / RDS からの取得ロジック
  return [];
}

async function createUser(data: Record<string, unknown>) {
  // ユーザー作成ロジック
  return { id: 'new-id', ...data };
}
```

### 5.5 Static Site Delivery with S3 + CloudFront

```bash
# S3 バケットの作成（静的ウェブサイトホスティング用）
aws s3 mb s3://my-static-site --region ap-northeast-1

# バケットポリシーの設定（CloudFront OAI 用）
aws s3api put-bucket-policy --bucket my-static-site --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity XXXXXX"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-static-site/*"
    }
  ]
}'

# Build成果物のアップロード
aws s3 sync ./dist s3://my-static-site \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html"

# HTML ファイルは短いキャッシュで
aws s3 sync ./dist s3://my-static-site \
  --include "*.html" \
  --cache-control "public, max-age=0, must-revalidate"

# CloudFront のキャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id EXXXXXX \
  --paths "/*"
```

### 5.6 AWS Deployment CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy-aws.yml
name: Deploy to AWS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: ap-northeast-1
  ECR_REPOSITORY: my-app
  ECS_SERVICE: my-nextjs-service
  ECS_CLUSTER: my-cluster
  CONTAINER_NAME: nextjs-app

permissions:
  id-token: write
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # AWS 認証（OIDC）
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/github-actions-role
          aws-region: ${{ env.AWS_REGION }}

      # ECR ログイン
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      # Docker ビルドとプッシュ
      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }} \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:latest \
            .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      # ECS タスク定義の更新
      - name: Fill in the new image ID in the Amazon ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      # ECS サービスのデプロイ
      - name: Deploy Amazon ECS task definition
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
```

---

## 6. GCP Cloud Run

### 6.1 Overview and Architecture

Google Cloud Run is a fully managed service that runs container images serverlessly. Simply deploy a Docker container for automatic scaling (scaling down to 0 instances), automatic HTTPS termination, custom domains, and load balancing. Containers start only when requests arrive, making it highly cost-efficient。

```
Cloud Run アーキテクチャ:

  ユーザーリクエスト
      │
      ▼
  ┌──────────────────┐
  │  Google Cloud    │
  │  Load Balancer   │  ← グローバル HTTPS LB
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │   Cloud Run      │  ← 自動スケーリング（0〜N）
  │   Service        │
  │  ┌─────────┐     │
  │  │Container│ x N │  ← リクエスト駆動
  │  └─────────┘     │
  └────────┬─────────┘
           │
     ┌─────┼──────────┐
     │     │          │
     ▼     ▼          ▼
  Cloud  Cloud     Firestore
  SQL    Storage   / Datastore
```

### 6.2 Cloud Run Deployment Steps

```bash
# Google Cloud SDK のインストール後

# プロジェクトの設定
gcloud config set project my-project-id
gcloud config set run/region asia-northeast1

# Artifact Registry にリポジトリを作成
gcloud artifacts repositories create my-repo \
  --repository-format=docker \
  --location=asia-northeast1

# Docker イメージのビルドとプッシュ（Cloud Build 使用）
gcloud builds submit --tag asia-northeast1-docker.pkg.dev/my-project-id/my-repo/my-app:latest

# Cloud Run へのデプロイ
gcloud run deploy my-app \
  --image asia-northeast1-docker.pkg.dev/my-project-id/my-repo/my-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=db-url:latest,SESSION_SECRET=session-secret:latest"

# カスタムドメインの設定
gcloud run domain-mappings create \
  --service my-app \
  --domain app.example.com \
  --region asia-northeast1

# トラフィック分割（カナリアデプロイ）
gcloud run services update-traffic my-app \
  --to-revisions my-app-00002-rev=10,my-app-00001-rev=90
```

### 6.3 Cloud Run Pricing

```
Cloud Run 料金（2024年時点）:

CPU:
  ├─ リクエスト処理中: $0.00002400/vCPU 秒
  ├─ 常時割り当て（always-on）: $0.00001800/vCPU 秒
  └─ 無料枠: 180,000 vCPU 秒/月

メモリ:
  ├─ リクエスト処理中: $0.00000250/GiB 秒
  ├─ 常時割り当て: $0.00000250/GiB 秒
  └─ 無料枠: 360,000 GiB 秒/月

リクエスト:
  ├─ $0.40/100万リクエスト
  └─ 無料枠: 200万リクエスト/月

ネットワーク:
  ├─ 北米宛: $0.12/GB
  ├─ アジア太平洋宛: $0.12/GB
  └─ 無料枠: 1GB/月

コスト試算例（月間100万リクエスト、平均応答100ms、256MB メモリ）:
  CPU: 1M × 0.1秒 × $0.000024 = $2.40
  メモリ: 1M × 0.1秒 × 0.25GB × $0.0000025 = $0.0625
  リクエスト: 1M × $0.40/1M = $0.40
  合計: 約 $2.86/月
```

---

## 7. Railway / Render / Fly.io

### 7.1 Railway

Railway is a simple infrastructure platform that deploys directly from GitHub repositories. You can add databases such as PostgreSQL, Redis, and MongoDB with one click, providing an excellent developer experience (DX).

```bash
# Railway CLI のインストール
npm install -g @railway/cli

# Logイン
railway login

# プロジェクトの初期化
railway init

# ローカル開発（Railway の環境変数を使用）
railway run npm run dev

# Deploy
railway up

# Environment variablesの設定
railway variables set DATABASE_URL="postgresql://..."
railway variables set SESSION_SECRET="..."

# PostgreSQL の追加
railway add --plugin postgresql

# Redis の追加
railway add --plugin redis

# Logの確認
railway logs

# Domainの設定
railway domain
```

```
Railway の料金体系:

Trial プラン（無料）:
  ├─ $5 分のクレジット
  ├─ 実行時間制限あり
  └─ 1プロジェクト

Hobby プラン（$5/月）:
  ├─ $5 のクレジット含む
  ├─ 超過分は従量課金
  ├─ vCPU: $0.000463/分
  ├─ メモリ: $0.000231/MB/分
  ├─ ディスク: $0.000309/GB/分
  └─ ネットワーク: $0.10/GB

Pro プラン（$20/月/シート）:
  ├─ チーム機能
  ├─ 高度なネットワーク
  ├─ SLA
  └─ 優先サポート

コスト試算例（常時稼働、1 vCPU、512MB メモリ）:
  CPU: 43,200分 × $0.000463 = $20.00
  メモリ: 43,200分 × 512MB × $0.000231 = $5.10（/1000で計算）
  合計: 約 $7〜10/月（$5クレジットで相殺）
```

### 7.2 Fly.io

Fly.io is a platform that runs applications in regions close to users. You can deploy Docker containers to edge locations around the world, making multi-region deployments easy to achieve.

```bash
# Fly CLI のインストール
curl -L https://fly.io/install.sh | sh

# Logイン
fly auth login

# アプリケーションの作成
fly launch

# Deploy
fly deploy

# スケーリング
fly scale count 3          # Instance数
fly scale vm shared-cpu-2x  # マシンタイプ
fly scale memory 512        # Memory

# Regionの追加
fly regions add nrt  # 東京
fly regions add sjc  # サンノゼ
fly regions add lhr  # ロンドン

# PostgreSQL の作成
fly postgres create

# シークレットの設定
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set SESSION_SECRET="..."

# Logの確認
fly logs

# SSH 接続
fly ssh console

# Status確認
fly status
```

```toml
# fly.toml - Fly.io 設定ファイル
app = "my-nextjs-app"
primary_region = "nrt"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512

# Health check
  interval = 10000
  grace_period = "5s"
  method = "get"
  path = "/api/health"
  protocol = "http"
  timeout = 2000
  tls_skip_verify = false

# Volume（永続ストレージ）
[mounts]
  source = "data"
  destination = "/data"
```

```
Fly.io の料金体系:

無料枠:
  ├─ 3 shared-cpu-1x VMs（256MB メモリ）
  ├─ 3GB 永続ストレージ
  └─ 160GB 転送量/月

従量課金:
  shared-cpu-1x: $1.94/月
  shared-cpu-2x: $3.88/月
  performance-1x: $29.30/月
  performance-2x: $58.59/月

メモリ: $0.00000476/MB/秒（約 $3.43/GB/月）
ストレージ: $0.15/GB/月
帯域: $0.02/GB（北米以外）
```

### 7.3 Render

```
Render の特徴:
  ├─ GitHub/GitLab からの自動デプロイ
  ├─ 無料の SSL、CDN、DDoS 保護
  ├─ マネージド PostgreSQL / Redis
  ├─ Cron ジョブサポート
  └─ Docker / ネイティブランタイム対応

料金:
  Free: 750時間/月、自動スリープあり
  Starter: $7/月（常時稼働）
  Standard: $25/月
  Pro: $85/月

向いているケース:
  ├─ Heroku からの移行
  ├─ バックエンド API + DB
  ├─ 小〜中規模プロジェクト
  └─ 学習用途
```

---

## 8. Deployment Strategies and Release Management

### 8.1 Comparison of Deployment Strategies

```
                  ダウンタイム  リスク    ロールバック  コスト    複雑度
──────────────────────────────────────────────────────────────
ローリング更新     なし        低〜中    やや遅い      低        低
ブルーグリーン     なし        低        即座          高(2倍)   中
カナリアリリース   なし        最低      即座          やや高    高
A/Bテスト         なし        低        即座          高        高
再作成(Recreate)  あり        高        遅い          低        最低
```

### 8.2 Blue-Green Deployment Implementation

```
ブルーグリーンデプロイの流れ:

  Step 1: 現在の本番環境（Blue）が稼働中
  ┌──────────┐     ┌──────────┐
  │   LB     │ ──→ │  Blue    │  ← 100% トラフィック
  └──────────┘     │  (v1.0)  │
                   └──────────┘

  Step 2: 新バージョン（Green）をデプロイ
  ┌──────────┐     ┌──────────┐
  │   LB     │ ──→ │  Blue    │  ← 100% トラフィック
  └──────────┘     │  (v1.0)  │
                   └──────────┘
                   ┌──────────┐
                   │  Green   │  ← テスト中
                   │  (v2.0)  │
                   └──────────┘

  Step 3: Green のテスト完了後、トラフィックを切り替え
  ┌──────────┐     ┌──────────┐
  │   LB     │     │  Blue    │  ← スタンバイ
  └──────────┘     │  (v1.0)  │
       │           └──────────┘
       │           ┌──────────┐
       └─────────→ │  Green   │  ← 100% トラフィック
                   │  (v2.0)  │
                   └──────────┘

  Step 4: 問題があれば Blue に即座にロールバック
```

```yaml
# .github/workflows/blue-green-deploy.yml
name: Blue-Green Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        run: |
          docker build -t my-app:${{ github.sha }} .
          docker push my-app:${{ github.sha }}

      - name: Deploy Green environment
        run: |
          # 新しいタスク定義を登録（Green）
          aws ecs register-task-definition \
            --cli-input-json file://task-definition.json

          # Green サービスを作成/更新
          aws ecs update-service \
            --cluster production \
            --service my-app-green \
            --task-definition my-app:latest \
            --desired-count 2

          # Green の安定化を待機
          aws ecs wait services-stable \
            --cluster production \
            --services my-app-green

      - name: Run smoke tests on Green
        run: |
          GREEN_URL=$(aws ecs describe-services --cluster production --services my-app-green --query 'services[0].loadBalancers[0].targetGroupArn' --output text)
          curl -f https://green.example.com/api/health || exit 1
          npm run test:e2e -- --base-url=https://green.example.com

      - name: Switch traffic to Green
        run: |
          # ALB のターゲットグループを切り替え
          aws elbv2 modify-listener \
            --listener-arn $LISTENER_ARN \
            --default-actions Type=forward,TargetGroupArn=$GREEN_TARGET_GROUP_ARN

      - name: Verify production
        run: |
          sleep 30
          curl -f https://example.com/api/health || exit 1

      - name: Scale down Blue (optional)
        if: success()
        run: |
          aws ecs update-service \
            --cluster production \
            --service my-app-blue \
            --desired-count 0
```

### 8.3 Canary Release Implementation

```typescript
// Vercel でのカナリアリリース（Edge Middleware）
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANARY_PERCENTAGE = 10; // 10% のユーザーにカナリア版を配信

export function middleware(request: NextRequest) {
  // カナリアフラグの確認
  const canaryFlag = request.cookies.get('canary');

  if (!canaryFlag) {
    // 新規ユーザーにランダムで割り当て
    const isCanary = Math.random() * 100 < CANARY_PERCENTAGE;
    const response = NextResponse.next();
    response.cookies.set('canary', isCanary ? 'true' : 'false', {
      maxAge: 60 * 60 * 24, // 24時間
      httpOnly: true,
      sameSite: 'lax',
    });

    if (isCanary) {
      // カナリア版の URL にリライト
      return NextResponse.rewrite(
        new URL(request.url.replace('example.com', 'canary.example.com'))
      );
    }
    return response;
  }

  if (canaryFlag.value === 'true') {
    return NextResponse.rewrite(
      new URL(request.url.replace('example.com', 'canary.example.com'))
    );
  }

  return NextResponse.next();
}
```

### 8.4 Rollback Procedures

```bash
# ---- Vercel のロールバック ----
# Deployメント一覧を確認
vercel ls

# 特定のデプロイメントを本番に昇格
vercel promote <deployment-url>

# ---- AWS ECS のロールバック ----
# 前のタスク定義に戻す
aws ecs update-service \
  --cluster my-cluster \
  --service my-service \
  --task-definition my-app:PREVIOUS_REVISION \
  --force-new-deployment

# ---- Docker / VPS のロールバック ----
# 前のイメージに戻す
docker pull my-app:previous-tag
docker stop my-app-current
docker run -d --name my-app --restart always my-app:previous-tag

# ---- Fly.io のロールバック ----
# リリース一覧
fly releases

# 特定のリリースにロールバック
fly deploy --image registry.fly.io/my-app:sha-xxxxxxx

# ---- Railway のロールバック ----
# Dashboardから Deployments → 前のデプロイを選択 → Rollback

# ---- Cloud Run のロールバック ----
# リビジョン一覧
gcloud run revisions list --service my-app

# 前のリビジョンにトラフィックを切り替え
gcloud run services update-traffic my-app \
  --to-revisions my-app-00001-rev=100
```

---

## 9. Troubleshooting

### 9.1 Common Causes and Remedies for Deployment Failures

```
問題 1: ビルドエラー
  症状: デプロイ時にビルドが失敗する
  原因:
    - Node.js バージョンの不一致
    - 依存関係の解決エラー
    - TypeScript の型エラー
    - 環境変数の未設定
  対策:
    - .nvmrc / .node-version でバージョンを固定
    - package-lock.json / pnpm-lock.yaml をコミット
    - CI で事前にビルドテストを実行
    - 環境変数のチェックリストを作成

問題 2: デプロイ後の 500 エラー
  症状: デプロイは成功するがアプリが動作しない
  原因:
    - 環境変数の不足（DATABASE_URL 等）
    - データベース接続の失敗
    - ポート設定の誤り
    - メモリ不足
  対策:
    - ヘルスチェックエンドポイントの実装
    - 構造化ログの導入
    - 環境変数の検証ロジックをアプリ起動時に実行
    - メモリ制限の適切な設定

問題 3: パフォーマンス劣化
  症状: デプロイ後にレスポンスタイムが悪化
  原因:
    - コールドスタート（サーバーレス）
    - キャッシュのパージ
    - データベースコネクションプールの設定不足
    - リソース不足（CPU/メモリ）
  対策:
    - Provisioned Concurrency（Lambda）/ min-instances（Cloud Run）
    - キャッシュのウォームアップ処理
    - コネクションプールの適切なサイズ設定
    - 水平スケーリングの設定

問題 4: SSL/TLS 証明書のエラー
  症状: HTTPS アクセスでエラーが発生
  原因:
    - DNS 設定の誤り
    - 証明書の期限切れ
    - 証明書の発行失敗
  対策:
    - DNS 設定の事前確認（dig / nslookup）
    - 証明書の自動更新設定（certbot / ACM）
    - DNS 伝播の待機（最大48時間）

問題 5: CORS エラー
  症状: フロントエンドからの API 呼び出しがブロックされる
  原因:
    - CORS ヘッダーの設定不足
    - プレフライトリクエスト（OPTIONS）の未処理
    - 本番環境と開発環境のドメイン差異
  対策:
    - Access-Control-Allow-Origin の適切な設定
    - OPTIONS リクエストへの応答
    - 環境ごとに許可オリジンを設定
```

### 9.2 Platform-Specific Troubleshooting

```
Vercel 固有:
  ├─ "Function Timeout": maxDuration を vercel.json で拡張
  ├─ "Deployment Failed": ビルドログを確認、キャッシュクリアを試行
  ├─ "Edge Function Error": Edge Runtime で使えない Node.js API を確認
  ├─ "Bandwidth Limit": Pro プランへのアップグレードを検討
  └─ "Preview環境が壊れている": vercel redeploy で再デプロイ

Cloudflare Workers 固有:
  ├─ "CPU time limit exceeded": 処理の最適化、Unbound に切り替え
  ├─ "Script too large": 不要な依存関係の削除、外部ストレージの活用
  ├─ "Durable Object stub error": 正しい namespace binding を確認
  ├─ "D1 query failed": SQLite の制約を確認、インデックスの追加
  └─ "KV consistency issue": 結果整合性を理解し、D1 併用を検討

AWS ECS 固有:
  ├─ "Task failed to start": タスク定義のログ設定、イメージの確認
  ├─ "Health check failed": ヘルスチェックパスとポートの確認
  ├─ "Out of memory": タスク定義のメモリ制限を引き上げ
  ├─ "Service unavailable": ALB のターゲットグループ設定を確認
  └─ "ECR authentication failed": IAM ロールのポリシーを確認

Docker セルフホスト固有:
  ├─ "Container keeps restarting": ログを確認（docker logs）
  ├─ "Disk full": 不要なイメージ/ボリュームの削除（docker system prune）
  ├─ "Network issues": docker network の設定を確認
  ├─ "Permission denied": ファイルの所有権とユーザー設定を確認
  └─ "SSL certificate expired": certbot renew の実行確認
```

### 9.3 Health Check Endpoint Implementation Example

```typescript
// app/api/health/route.ts - 包括的なヘルスチェック
import { NextResponse } from 'next/server';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    externalApi: CheckResult;
  };
}

interface CheckResult {
  status: 'pass' | 'fail';
  responseTime: number;
  message?: string;
}

const startTime = Date.now();

export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalApi(),
  ]);

  const [dbResult, redisResult, apiResult] = checks;

  const health: HealthStatus = {
    status: 'healthy',
    version: process.env.APP_VERSION || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks: {
      database: dbResult.status === 'fulfilled'
        ? dbResult.value
        : { status: 'fail', responseTime: 0, message: 'Check failed' },
      redis: redisResult.status === 'fulfilled'
        ? redisResult.value
        : { status: 'fail', responseTime: 0, message: 'Check failed' },
      externalApi: apiResult.status === 'fulfilled'
        ? apiResult.value
        : { status: 'fail', responseTime: 0, message: 'Check failed' },
    },
  };

  // 全体のステータス判定
  const failedChecks = Object.values(health.checks).filter(c => c.status === 'fail');
  if (failedChecks.length > 0) {
    health.status = failedChecks.length === Object.keys(health.checks).length
      ? 'unhealthy'
      : 'degraded';
  }

  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  return NextResponse.json(health, { status: statusCode });
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Prisma / Drizzle などの ORM を使用
    // await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'pass',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Redis クライアントで PING
    // await redis.ping();
    return {
      status: 'pass',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkExternalApi(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.example.com/health', {
      signal: AbortSignal.timeout(5000),
    });
    return {
      status: response.ok ? 'pass' : 'fail',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Timeout or network error',
    };
  }
}
```

---

## 10. Monitoring and Observability

### 10.1 Monitoring Tools by Platform

```
                 組み込み監視    外部連携推奨             メトリクス
──────────────────────────────────────────────────────────────
Vercel           Analytics     Datadog, Sentry          Web Vitals, Function Duration
Cloudflare       Analytics     Grafana, Sentry          Workers Analytics, D1 Metrics
AWS              CloudWatch    Datadog, New Relic       ALB/ECS/Lambda メトリクス
GCP              Cloud Monitor Datadog, Grafana         Cloud Run メトリクス
Railway          基本ログ      Datadog, Sentry          CPU, Memory, Network
Fly.io           Grafana       Prometheus, Datadog      VM メトリクス
Docker/VPS       なし          Prometheus + Grafana      全て自前
```

### 10.2 Key Metrics to Monitor

```
アプリケーション層:
  ├─ レスポンスタイム（p50, p95, p99）
  ├─ エラーレート（4xx, 5xx）
  ├─ リクエストスループット（RPS）
  ├─ アクティブコネクション数
  └─ Web Vitals（LCP, FID, CLS, TTFB, INP）

インフラ層:
  ├─ CPU 使用率
  ├─ メモリ使用率
  ├─ ディスク I/O
  ├─ ネットワーク帯域
  └─ コンテナ/インスタンス数

データベース層:
  ├─ クエリレスポンスタイム
  ├─ コネクションプール使用率
  ├─ スロークエリ数
  ├─ レプリケーション遅延
  └─ ディスク使用量

ビジネス層:
  ├─ ユーザー登録数/アクティブユーザー数
  ├─ コンバージョン率
  ├─ ページビュー
  └─ API 利用量
```

### 10.3 Alert Design

```
アラートの優先度設計:

P1（即時対応）:
  ├─ サービスダウン（ヘルスチェック失敗）
  ├─ エラーレート > 5%
  ├─ レスポンスタイム p99 > 10秒
  └─ データベース接続不可
  通知先: PagerDuty / 電話 / Slack（即時）

P2（1時間以内に対応）:
  ├─ エラーレート > 1%
  ├─ レスポンスタイム p95 > 3秒
  ├─ CPU > 80% が5分以上
  └─ メモリ > 85%
  通知先: Slack / メール

P3（営業時間内に対応）:
  ├─ ディスク使用率 > 70%
  ├─ SSL 証明書期限 < 30日
  ├─ 依存サービスの劣化
  └─ 異常なトラフィックパターン
  通知先: Slack（低優先度チャンネル）

P4（週次レビュー）:
  ├─ コスト異常（予算の80%超過）
  ├─ パフォーマンストレンドの変化
  ├─ セキュリティパッチの未適用
  └─ ログボリュームの異常増加
  通知先: 週次レポート
```

---

## 11. Cost Optimization

### 11.1 Cost Reduction Techniques by Platform

```
Vercel:
  ├─ ISR の revalidate 値を適切に設定し、オリジンリクエストを削減
  ├─ Edge Functions で軽量な処理をエッジに移動
  ├─ 画像最適化の minimumCacheTTL を長く設定
  ├─ 不要なプレビューデプロイメントの削除
  └─ Analytics はサードパーティ（Plausible等）で代替

Cloudflare:
  ├─ Free プランの範囲で運用できるよう設計
  ├─ KV よりも D1 を優先（読み取りコストが安い）
  ├─ R2 で S3 代替（転送料金なし）
  ├─ Bundled モードで CPU 時間制限内に収める
  └─ Cache API でレスポンスをキャッシュ

AWS:
  ├─ Reserved Instances / Savings Plans で長期コスト削減
  ├─ Spot Instances を非クリティカルなワークロードに活用
  ├─ S3 Intelligent-Tiering でストレージコスト最適化
  ├─ CloudFront キャッシュヒット率の改善
  ├─ Lambda の Provisioned Concurrency を最小限に
  └─ RDS の適切なインスタンスサイズ選定

Docker / VPS:
  ├─ Hetzner / Contabo など低価格 VPS プロバイダの活用
  ├─ ARM ベースのインスタンスでコスト削減（Hetzner CAX）
  ├─ 複数のアプリを1台のサーバーに集約
  ├─ 不要なコンテナ/イメージの定期的なクリーンアップ
  └─ CDN（Cloudflare無料プラン）をフロントに配置
```

### 11.2 Cost Estimation Template

```
月間コスト見積もりシート:

プロジェクト名: _________________
想定トラフィック: ___________ PV/月
想定 API コール: ___________ リクエスト/月
データベースサイズ: ___________ GB
ファイルストレージ: ___________ GB
チームメンバー数: ___________

┌─────────────────────────────────────────────────┐
│ コスト項目          │ 月額     │ 年額        │
├─────────────────────┼──────────┼─────────────┤
│ コンピュート        │ $___     │ $___        │
│ データベース        │ $___     │ $___        │
│ ストレージ          │ $___     │ $___        │
│ 帯域/転送           │ $___     │ $___        │
│ SSL/ドメイン        │ $___     │ $___        │
│ 監視/ログ           │ $___     │ $___        │
│ CI/CD               │ $___     │ $___        │
│ その他              │ $___     │ $___        │
├─────────────────────┼──────────┼─────────────┤
│ 合計                │ $___     │ $___        │
└─────────────────────┴──────────┴─────────────┘
```

---

## Summary

### Platform Selection Quick Reference

| Platform | Best Use Case | Cost | Learning Curve | Scaling |
|--------------|---------|--------|---------|----------|
| Vercel | Next.js, frontend-centric | Medium | Lowest | Automatic |
| Cloudflare | Edge, low cost, global delivery | Low | Low | Automatic |
| AWS Amplify | Git-based deploy in AWS environment | Medium | Low | Automatic |
| AWS ECS | Full custom container-based setup | High | High | Auto/Manual |
| GCP Cloud Run | Serverless container execution | Low–Medium | Medium | Automatic |
| Railway | Rapid backend deployment | Low | Lowest | Automatic |
| Fly.io | Multi-region, edge-oriented | Medium | Low | Automatic |
| Render | Heroku alternative, simple deploy | Low–Medium | Low | Automatic |
| Docker + VPS | Full control, low cost | Lowest | Medium | Manual |

### Recommended Configurations by Project Scale

```
個人プロジェクト / プロトタイプ:
  推奨: Vercel Hobby + Cloudflare (CDN) + Supabase (DB)
  コスト: 無料〜$5/月
  理由: ゼロコンフィグ、高速イテレーション

スタートアップ / 小規模チーム:
  推奨: Vercel Pro + Railway (DB/Redis) or Supabase
  コスト: $20〜$50/月
  理由: 開発速度優先、運用負荷最小

中規模サービス:
  推奨: AWS ECS Fargate + RDS + CloudFront or GCP Cloud Run + Cloud SQL
  コスト: $100〜$500/月
  理由: カスタマイズ性、SLA、コンプライアンス

大規模サービス:
  推奨: AWS / GCP / Azure のフルマネージド構成 + Kubernetes
  コスト: $500〜$5,000+/月
  理由: マルチリージョン、高可用性、フルカスタム

コスト最重視:
  推奨: Cloudflare Pages + Workers + D1 or Hetzner VPS + Docker
  コスト: $0〜$20/月
  理由: 無料枠の最大活用、低価格 VPS
```

---

## Frequently Asked Questions (FAQ)

### Q1: Which should I choose between Vercel, Netlify, and Cloudflare Pages?

**Decision criteria:**

- **Vercel**: Best for Next.js projects. Full support for Server Components and Edge Runtime. Recommended when a budget of $20/month or more is available.
- **Netlify**: Strong with diverse SSGs (Gatsby, Hugo, Eleventy, etc.). Best when you want to use Netlify's plugin ecosystem or Forms features.
- **Cloudflare Pages**: Most generous free tier and powerful global edge network. Top candidate when you want fast delivery at low cost or when Workers integration is a given.

**Selection flowchart:**
```
Next.js App Router + Server Components?
  → Yes: Vercel（最適化済み）
  → No: ↓

月間100万PV以上のトラフィック?
  → Yes: Cloudflare Pages（無制限帯域）
  → No: ↓

プラグインや統合サービスが必要?
  → Yes: Netlify（エコシステム豊富）
  → No: Cloudflare Pages（コスト最優先）
```

### Q2: What are the advantages and limitations of Edge Runtime?

**Advantages:**

- **Reduced latency**: Runs at the edge location closest to the user, dramatically reducing response time (TTFB can be under 50ms)
- **Global scale**: Automatically scales at edges worldwide, no per-region configuration needed
- **Reduced cold starts**: V8 Isolate-based, fast startup (10–100× faster than Lambda)

**Limitations:**

- **Node.js compatibility limitations**: Not all Node.js APIs are available (`fs`, `child_process`, etc.). Web standard APIs only.
- **Execution time limits**: Short limits such as 50ms CPU time for Cloudflare Workers and 25 seconds for Vercel Edge Functions
- **Package size**: Bundle size limits of 1MB–4MB (varies by platform)
- **Stateless required**: No filesystem or in-memory persistence; all state must be stored in external KV or DB

**Recommended use cases:**
- API routing (authentication, redirects, A/B testing)
- Dynamic HTML rewriting (headers, meta tags, personalization)
- Lightweight computation (validation, token verification)

### Q3: How should I decide between self-hosting (VPS/Docker) and PaaS (Vercel/Railway)?

**When to choose PaaS (Vercel/Railway):**

- Startups or small teams where development speed is the top priority
- No dedicated infrastructure manager
- Highly variable traffic requiring automatic scaling
- Want zero-config deployment with Git integration

**When to choose self-hosting:**

- Want to keep monthly cost under $50 (Hetzner VPS from $5)
- Need full customizability (special middleware, kernel configuration, etc.)
- Data sovereignty or compliance requirements mandate deployment in a specific region
- Long-running batch processing or large-capacity storage is required

**Hybrid configuration example:**
```
フロントエンド: Vercel（Next.js）
API・バックエンド: Railway（Node.js + PostgreSQL）
バッチ処理: VPS（Dockerコンテナ）
静的アセット: Cloudflare R2（オブジェクトストレージ）
```

This configuration lets you maximize the strengths of each platform.

---

## Next Guides to Read


---

## References

1. Vercel. "Documentation." vercel.com/docs, 2024.
2. Cloudflare. "Workers Documentation." developers.cloudflare.com/workers, 2024.
3. Cloudflare. "Pages Documentation." developers.cloudflare.com/pages, 2024.
4. Cloudflare. "D1 Documentation." developers.cloudflare.com/d1, 2024.
5. AWS. "Amplify Documentation." docs.aws.amazon.com/amplify, 2024.
6. AWS. "ECS Documentation." docs.aws.amazon.com/ecs, 2024.
7. AWS. "Lambda Documentation." docs.aws.amazon.com/lambda, 2024.
8. Google Cloud. "Cloud Run Documentation." cloud.google.com/run/docs, 2024.
9. Docker. "Dockerfile best practices." docs.docker.com, 2024.
10. Fly.io. "Documentation." fly.io/docs, 2024.
11. Railway. "Documentation." docs.railway.app, 2024.
12. Render. "Documentation." render.com/docs, 2024.
13. Next.js. "Deployment Documentation." nextjs.org/docs/deployment, 2024.
14. Martin Fowler. "BlueGreenDeployment." martinfowler.com, 2010.
15. Google. "Site Reliability Engineering." sre.google/sre-book, 2016.
