# Environment Configuration

> Environment configuration is the foundation for safe application operation. Learn best practices for managing configuration safely in production, from environment variable management and Feature Flags to configuration layering and secret management.

## Prerequisites

To get the most out of this guide, it is recommended that you have prior knowledge of the following.

- **Environment variable concepts**: OS-level environment variables and how they are injected into processes
- **12-Factor App principles**: Particularly understanding the third factor, "Config"

## What You Will Learn

- [ ] Understand environment variable design and secure management
- [ ] Learn configuration isolation patterns per environment
- [ ] Understand Feature Flag implementation and operation
- [ ] Learn secret management best practices
- [ ] Understand configuration management based on 12-Factor App
- [ ] Learn how to pass environment variables in CI/CD pipelines
- [ ] Implement configuration validation and fail-fast strategies
- [ ] Develop troubleshooting techniques for multi-environment operations

---

## 1. Basic Concepts of Environment Configuration

### 1.1 Why Environment Configuration Matters

In application development, environment configuration (Configuration Management) is often overlooked, but it is an extremely important area that directly impacts security, operational stability, and development efficiency.

```
環境設定が引き起こすインシデントの例:

  ケース1: 本番 DB のクレデンシャルが GitHub に流出
    原因: .env ファイルを誤って Git にコミット
    影響: データベース全体が外部に露出、ユーザーデータ漏洩
    対策: .gitignore の徹底、pre-commit hook でのチェック

  ケース2: ステージング環境が本番 API を呼び出す
    原因: 環境変数の設定ミスで API_URL が本番を指していた
    影響: テストデータが本番に混入、顧客に影響
    対策: 環境別設定の厳密な分離、起動時バリデーション

  ケース3: Feature Flag の設定漏れで未完成機能が本番に露出
    原因: デプロイ時に Feature Flag の環境変数を設定し忘れた
    影響: 未完成の UI がユーザーに表示、バグ報告殺到
    対策: デフォルト値の適切な設定、デプロイチェックリスト

  ケース4: 本番環境でデバッグモードが有効のまま
    原因: NODE_ENV が development のままデプロイされた
    影響: スタックトレースが外部に露出、セキュリティリスク
    対策: 起動時の環境チェック、CI/CD での自動検証
```

### 1.2 12-Factor App and Configuration Management

In the 12-Factor App principles advocated by Heroku engineers, Config is defined as the third factor. These principles form the foundation of modern cloud-native applications.

```
12-Factor App における設定の原則:

  ① 設定はコードから厳密に分離する
     - 環境変数として外部から注入
     - 設定ファイルをコードリポジトリに含めない
     - 同じコードベースがすべての環境で動作する

  ② 環境間の差異は設定のみで表現する
     - development / staging / production の違いは設定だけ
     - コードの条件分岐で環境を判定しない
     - ビルド成果物は全環境で同一

  ③ 設定はデプロイごとに変わりうる
     - コードの変更なしに設定を変更できる
     - 再デプロイなしでの設定変更が可能
     - 設定の変更履歴を追跡できる

12-Factor App の 12 の要素:
  I.    コードベース（一つのコードベース、複数のデプロイ）
  II.   依存関係（明示的に宣言し分離する）
  III.  設定（環境変数に格納する）← ★本章のテーマ
  IV.   バックエンドサービス（アタッチされたリソースとして扱う）
  V.    ビルド・リリース・実行（3つのステージを厳密に分離する）
  VI.   プロセス（ステートレスなプロセスとして実行する）
  VII.  ポートバインディング（ポートバインディングでサービスを公開する）
  VIII. 並行性（プロセスモデルでスケールアウトする）
  IX.   廃棄容易性（高速な起動とグレースフルシャットダウン）
  X.    開発/本番一致（開発・ステージング・本番を可能な限り一致させる）
  XI.   ログ（ログをイベントストリームとして扱う）
  XII.  管理プロセス（管理タスクをワンオフプロセスとして実行する）
```

### 1.3 Environment Hierarchy and Types

```
典型的な環境の階層:

  ┌──────────────────────────────────────────────────┐
  │  local (開発者のマシン)                           │
  │  ├── 個人の .env.local で設定を上書き             │
  │  ├── ホットリロード有効                           │
  │  └── デバッグツール有効                           │
  ├──────────────────────────────────────────────────┤
  │  development (共有開発環境)                       │
  │  ├── 開発チーム全体で共有するサーバー              │
  │  ├── テスト用の外部サービスに接続                  │
  │  └── 本番に近い構成だがリソースは最小限            │
  ├──────────────────────────────────────────────────┤
  │  staging (ステージング環境)                       │
  │  ├── 本番とほぼ同一の構成                         │
  │  ├── 本番データのサブセットで動作                  │
  │  ├── QA テスト、受け入れテストを実施               │
  │  └── 本番デプロイ前の最終確認                     │
  ├──────────────────────────────────────────────────┤
  │  production (本番環境)                            │
  │  ├── 実際のユーザーがアクセスする環境              │
  │  ├── 最高レベルのセキュリティ設定                  │
  │  ├── 監視・アラート完備                           │
  │  └── パフォーマンス最適化済み                     │
  └──────────────────────────────────────────────────┘

  追加の環境（大規模プロジェクトの場合）:
  ├── preview / PR環境: PR ごとに自動生成される一時的な環境
  ├── canary: 本番の一部トラフィックのみ受ける環境
  ├── sandbox: 外部パートナー向けのテスト環境
  └── disaster-recovery: 災害時に切り替える予備環境

.env ファイルの優先順位（Next.js の場合）:
  .env                  ← デフォルト（全環境共通）
  .env.local            ← ローカルのオーバーライド（.gitignore）
  .env.development      ← 開発環境固有
  .env.development.local← 開発環境のローカルオーバーライド
  .env.staging          ← ステージング固有
  .env.production       ← 本番環境固有
  .env.production.local ← 本番のローカルオーバーライド（.gitignore）

  読み込み優先順位（後勝ち）:
  .env < .env.local < .env.[NODE_ENV] < .env.[NODE_ENV].local
```

---

## 2. Environment Variable Design

### 2.1 Naming Conventions and Prefixes

Consistency in environment variable naming is important. Defining clear naming conventions makes the purpose of each variable obvious at a glance and helps prevent configuration errors.

```
命名規則の基本原則:

  ✅ 推奨パターン:
    SCREAMING_SNAKE_CASE を使用
    ├── DATABASE_URL          → データベース接続先
    ├── REDIS_HOST            → Redis ホスト名
    ├── AWS_ACCESS_KEY_ID     → AWS アクセスキー
    ├── SMTP_PORT             → メールサーバーポート
    └── LOG_LEVEL             → ログレベル

  ✅ プレフィックスによる分類:
    サービス別:
    ├── DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    ├── REDIS_URL, REDIS_PASSWORD, REDIS_DB
    ├── AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    ├── STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
    ├── SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
    └── SENTRY_DSN, SENTRY_ENVIRONMENT

    機能別:
    ├── ENABLE_ANALYTICS      → 分析機能の有効/無効
    ├── ENABLE_RATE_LIMIT     → レート制限の有効/無効
    ├── IS_MAINTENANCE_MODE   → メンテナンスモード判定
    ├── HAS_PREMIUM_FEATURES  → プレミアム機能の有無
    └── MAX_UPLOAD_SIZE       → アップロード上限

    公開範囲別（Next.js）:
    ├── NEXT_PUBLIC_API_URL   → クライアントに公開
    ├── NEXT_PUBLIC_GA_ID     → Google Analytics ID
    ├── DATABASE_URL          → サーバーのみ（機密）
    └── JWT_SECRET            → サーバーのみ（機密）

  ❌ アンチパターン:
    ├── KEY           → 何のキーかわからない
    ├── SECRET        → 何のシークレットかわからない
    ├── URL           → 何の URL かわからない
    ├── password      → snake_case ではない
    ├── ApiKey        → camelCase は使わない
    └── my-config     → ハイフンは使えない（シェルで問題）

フレームワーク別の公開プレフィックス:
  ┌─────────────────┬──────────────────────┬───────────────────┐
  │ フレームワーク    │ 公開プレフィックス     │ 非公開（サーバー）  │
  ├─────────────────┼──────────────────────┼───────────────────┤
  │ Next.js         │ NEXT_PUBLIC_         │ プレフィックスなし  │
  │ Vite            │ VITE_                │ プレフィックスなし  │
  │ Create React App│ REACT_APP_           │ プレフィックスなし  │
  │ Nuxt.js         │ NUXT_PUBLIC_         │ NUXT_ or なし     │
  │ SvelteKit       │ PUBLIC_              │ プレフィックスなし  │
  │ Remix           │ なし（全てサーバー）   │ 全て              │
  │ Astro           │ PUBLIC_              │ プレフィックスなし  │
  └─────────────────┴──────────────────────┴───────────────────┘
```

### 2.2 Type-Safe Environment Variable Management (Zod)

In TypeScript projects, applying schema validation to environment variables with Zod ensures type safety and enables early detection of configuration errors at startup.

```typescript
// ============================================
// config/env.ts - 型安全な環境変数管理
// ============================================
import { z } from 'zod';

// ---- サーバーサイド環境変数スキーマ ----
const serverEnvSchema = z.object({
  // アプリケーション基本設定
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  // データベース
  DATABASE_URL: z.string().url()
    .refine(url => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string',
    }),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DATABASE_SSL: z.coerce.boolean().default(true),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),

  // 認証
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(32).optional(),

  // 外部サービス
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  SENDGRID_API_KEY: z.string().startsWith('SG.'),
  SENTRY_DSN: z.string().url().optional(),

  // AWS
  AWS_REGION: z.string().default('ap-northeast-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),

  // Feature flag
  ENABLE_RATE_LIMIT: z.coerce.boolean().default(true),
  ENABLE_CORS: z.coerce.boolean().default(true),
  ENABLE_SWAGGER: z.coerce.boolean().default(false),

  // ログ
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

// ---- クライアントサイド環境変数スキーマ ----
const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_GA_ID: z.string().startsWith('G-').optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_PUBLIC_KEY: z.string().startsWith('pk_'),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  NEXT_PUBLIC_APP_VERSION: z.string().default('0.0.0'),
});

// ---- バリデーションとエクスポート ----
function validateEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, string | undefined>,
  label: string
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${(msgs as string[]).join(', ')}`)
      .join('\n');

    console.error(`\n${label} の環境変数バリデーションエラー:\n${errorMessages}\n`);

    // 開発環境では詳細を表示、本番では最小限の情報で停止
    if (process.env.NODE_ENV === 'production') {
      console.error('本番環境の設定エラーにより起動を中止します。');
    } else {
      console.error('必要な環境変数を .env.local に設定してください。');
      console.error('参考: .env.example を確認してください。');
    }

    process.exit(1);
  }

  return result.data;
}

// サーバーサイドでのみ実行（クライアントバンドルに含めない）
export const serverEnv = typeof window === 'undefined'
  ? validateEnv(serverEnvSchema, process.env, 'サーバー')
  : ({} as z.infer<typeof serverEnvSchema>);

// クライアントサイドでも利用可能
export const clientEnv = validateEnv(clientEnvSchema, process.env, 'クライアント');

// 統合型のエクスポート
export const env = { ...serverEnv, ...clientEnv };

// 型のエクスポート
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
```

### 2.3 Testing Environment Variable Validation

```typescript
// ============================================
// config/__tests__/env.test.ts
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// テスト用のスキーマ（本番と同じ定義を使用）
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

describe('環境変数バリデーション', () => {
  const validEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb',
    JWT_SECRET: 'a-very-long-secret-key-that-is-at-least-32-characters',
    PORT: '8080',
  };

  it('有効な環境変数が正しくパースされること', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(8080); // 文字列から数値に変換
      expect(result.data.NODE_ENV).toBe('production');
    }
  });

  it('無効な NODE_ENV が拒否されること', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NODE_ENV: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('DATABASE_URL が URL 形式でない場合に拒否されること', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      DATABASE_URL: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('JWT_SECRET が短すぎる場合に拒否されること', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      JWT_SECRET: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('PORT のデフォルト値が適用されること', () => {
    const { PORT, ...envWithoutPort } = validEnv;
    const result = envSchema.safeParse(envWithoutPort);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
    }
  });

  it('PORT が範囲外の場合に拒否されること', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      PORT: '70000',
    });
    expect(result.success).toBe(false);
  });
});
```

### 2.4 Managing .env.example

Always include a `.env.example` in your project, listing all required environment variables with descriptions.

```bash
# ============================================
# .env.example
# このファイルを .env.local にコピーして値を設定してください
# cp .env.example .env.local
# ============================================

# ---- アプリケーション基本設定 ----
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# ---- データベース ----
# PostgreSQL の接続文字列
# ローカル: postgresql://postgres:password@localhost:5432/myapp_dev
# Docker: postgresql://postgres:password@db:5432/myapp_dev
DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=false

# ---- Redis ----
# ローカル: redis://localhost:6379
# Docker: redis://redis:6379
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# ---- 認証 ----
# 32文字以上のランダムな文字列を設定
# 生成コマンド: openssl rand -base64 48
JWT_SECRET=your-jwt-secret-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# ---- Stripe ----
# https://dashboard.stripe.com/test/apikeys からテストキーを取得
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxx

# ---- メール（SendGrid）----
# https://app.sendgrid.com/settings/api_keys から取得
SENDGRID_API_KEY=SG.xxxxxxxxxxxx

# ---- エラー監視（Sentry）----
# https://sentry.io から DSN を取得
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# ---- AWS ----
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET_NAME=myapp-dev-uploads

# ---- フロントエンド公開設定 ----
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_APP_VERSION=0.0.0

# ---- 機能フラグ ----
ENABLE_RATE_LIMIT=false
ENABLE_CORS=true
ENABLE_SWAGGER=true

# ---- ログ ----
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### 2.5 Automated Environment Variable Check Script

```typescript
// ============================================
// scripts/check-env.ts
// プロジェクト起動前に環境変数の整合性をチェックする
// ============================================
import fs from 'fs';
import path from 'path';

interface EnvCheckResult {
  missing: string[];
  empty: string[];
  warnings: string[];
}

function parseEnvFile(filePath: string): Map<string, string> {
  const envMap = new Map<string, string>();

  if (!fs.existsSync(filePath)) {
    return envMap;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // コメント行と空行をスキップ
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const key = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();
    envMap.set(key, value);
  }

  return envMap;
}

function checkEnv(): EnvCheckResult {
  const projectRoot = process.cwd();
  const exampleEnv = parseEnvFile(path.join(projectRoot, '.env.example'));
  const localEnv = parseEnvFile(path.join(projectRoot, '.env.local'));
  const envFile = parseEnvFile(path.join(projectRoot, '.env'));

  // 実効的な環境変数: .env → .env.local → process.env
  const effectiveEnv = new Map([...envFile, ...localEnv]);

  const result: EnvCheckResult = {
    missing: [],
    empty: [],
    warnings: [],
  };

  for (const [key, exampleValue] of exampleEnv) {
    const actualValue = effectiveEnv.get(key) || process.env[key];

    if (actualValue === undefined) {
      result.missing.push(key);
    } else if (actualValue === '' || actualValue === exampleValue) {
      // 値が空またはサンプル値のまま
      if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD')) {
        result.warnings.push(`${key}: サンプル値のまま or 空です（機密情報）`);
      } else if (actualValue === '') {
        result.empty.push(key);
      }
    }
  }

  // NEXT_PUBLIC_ でないのにクライアントで使おうとしている変数のチェック
  for (const [key] of effectiveEnv) {
    if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('PRIVATE')) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        result.warnings.push(
          `${key}: 機密情報が NEXT_PUBLIC_ プレフィックスで公開されています！`
        );
      }
    }
  }

  return result;
}

// 実行
const result = checkEnv();

if (result.missing.length > 0) {
  console.error('\n未設定の環境変数:');
  result.missing.forEach(key => console.error(`  - ${key}`));
}

if (result.empty.length > 0) {
  console.warn('\n空の環境変数:');
  result.empty.forEach(key => console.warn(`  - ${key}`));
}

if (result.warnings.length > 0) {
  console.warn('\n警告:');
  result.warnings.forEach(msg => console.warn(`  - ${msg}`));
}

if (result.missing.length === 0 && result.warnings.length === 0) {
  console.log('\nすべての環境変数が正しく設定されています。');
}

// 必須の環境変数が不足している場合は終了コード 1 で終了
if (result.missing.length > 0) {
  process.exit(1);
}
```

### 2.6 Using Environment Variables in Each Framework

```typescript
// ============================================
// Next.js での環境変数の使い方
// ============================================

// 1. サーバーコンポーネント（App Router）
// サーバーサイドの環境変数に直接アクセス可能
async function ServerComponent() {
  // サーバーサイドのみ: OK
  const dbUrl = process.env.DATABASE_URL;
  const apiKey = process.env.STRIPE_SECRET_KEY;

  // NEXT_PUBLIC_ もサーバーで利用可能
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  const data = await fetch(publicApiUrl + '/api/data', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return <div>{/* ... */}</div>;
}

// 2. クライアントコンポーネント
'use client';
function ClientComponent() {
  // クライアントサイドでは NEXT_PUBLIC_ のみアクセス可能
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;     // OK
  // const secret = process.env.DATABASE_URL;          // undefined（安全）

  return <div>API: {apiUrl}</div>;
}

// 3. API Route（App Router）
// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // サーバーサイドなので全環境変数にアクセス可能
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Webhook の署名検証
  const signature = request.headers.get('stripe-signature');
  // ...
  return NextResponse.json({ received: true });
}

// 4. next.config.js での環境変数
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // ビルド時に埋め込まれる（非推奨: NEXT_PUBLIC_ を使うべき）
    CUSTOM_VAR: process.env.CUSTOM_VAR,
  },
  // ランタイム設定（サーバーサイドのみ）
  serverRuntimeConfig: {
    apiSecret: process.env.API_SECRET,
  },
  // パブリックランタイム設定（クライアントからもアクセス可能）
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
```

```typescript
// ============================================
// Vite での環境変数の使い方
// ============================================

// vite.config.ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // mode に応じた .env ファイルを読み込む
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      // カスタム変数をグローバルに定義
      __APP_VERSION__: JSON.stringify(env.npm_package_version),
    },
    server: {
      port: parseInt(env.VITE_DEV_PORT || '5173'),
    },
  };
});

// コンポーネントでの使用
function App() {
  // VITE_ プレフィックスの変数のみアクセス可能
  const apiUrl = import.meta.env.VITE_API_URL;
  const mode = import.meta.env.MODE; // 'development' | 'production'
  const isDev = import.meta.env.DEV; // boolean
  const isProd = import.meta.env.PROD; // boolean

  return <div>API: {apiUrl}</div>;
}

// 型定義（env.d.ts）
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_GA_ID?: string;
  readonly VITE_ENABLE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## 3. Configuration Isolation Patterns

### 3.1 Per-Environment Configuration File Pattern

```typescript
// ============================================
// config/index.ts - 環境別設定の統合管理
// ============================================

// 基本設定の型定義
interface AppConfig {
  app: {
    name: string;
    version: string;
    url: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
    retryCount: number;
    retryDelay: number;
  };
  database: {
    poolMin: number;
    poolMax: number;
    ssl: boolean;
    logging: boolean;
  };
  cache: {
    ttl: number;
    maxItems: number;
    strategy: 'memory' | 'redis';
  };
  features: {
    analytics: boolean;
    debugMode: boolean;
    maintenanceMode: boolean;
    rateLimit: boolean;
  };
  security: {
    corsOrigins: string[];
    rateLimitWindow: number;
    rateLimitMax: number;
    csrfEnabled: boolean;
  };
  logging: {
    level: string;
    format: 'json' | 'pretty';
    destination: 'stdout' | 'file' | 'both';
  };
}

// 全環境共通のデフォルト設定
const defaultConfig: AppConfig = {
  app: {
    name: 'MyApp',
    version: process.env.npm_package_version || '0.0.0',
    url: 'http://localhost:3000',
  },
  api: {
    baseUrl: 'http://localhost:3001',
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
  },
  database: {
    poolMin: 2,
    poolMax: 10,
    ssl: false,
    logging: false,
  },
  cache: {
    ttl: 300,
    maxItems: 1000,
    strategy: 'memory',
  },
  features: {
    analytics: false,
    debugMode: false,
    maintenanceMode: false,
    rateLimit: true,
  },
  security: {
    corsOrigins: ['http://localhost:3000'],
    rateLimitWindow: 15 * 60 * 1000, // 15分
    rateLimitMax: 100,
    csrfEnabled: true,
  },
  logging: {
    level: 'info',
    format: 'json',
    destination: 'stdout',
  },
};

// 環境別のオーバーライド設定
const envOverrides: Record<string, Partial<AppConfig>> = {
  development: {
    api: {
      ...defaultConfig.api,
      timeout: 60000, // 開発時は長めのタイムアウト
    },
    database: {
      ...defaultConfig.database,
      logging: true, // SQL ログ出力
    },
    cache: {
      ...defaultConfig.cache,
      ttl: 0, // 開発時はキャッシュ無効
    },
    features: {
      ...defaultConfig.features,
      debugMode: true,
      rateLimit: false, // 開発時はレート制限なし
    },
    logging: {
      level: 'debug',
      format: 'pretty',
      destination: 'stdout',
    },
  },
  staging: {
    app: {
      ...defaultConfig.app,
      url: 'https://staging.example.com',
    },
    api: {
      ...defaultConfig.api,
      baseUrl: 'https://staging-api.example.com',
      timeout: 15000,
    },
    database: {
      ...defaultConfig.database,
      ssl: true,
    },
    cache: {
      ...defaultConfig.cache,
      ttl: 60,
      strategy: 'redis',
    },
    features: {
      ...defaultConfig.features,
      analytics: true,
      debugMode: true,
    },
    security: {
      ...defaultConfig.security,
      corsOrigins: ['https://staging.example.com'],
    },
  },
  production: {
    app: {
      ...defaultConfig.app,
      url: 'https://www.example.com',
    },
    api: {
      ...defaultConfig.api,
      baseUrl: 'https://api.example.com',
      timeout: 10000,
      retryCount: 5,
    },
    database: {
      ...defaultConfig.database,
      poolMin: 5,
      poolMax: 20,
      ssl: true,
    },
    cache: {
      ...defaultConfig.cache,
      ttl: 600,
      maxItems: 10000,
      strategy: 'redis',
    },
    features: {
      ...defaultConfig.features,
      analytics: true,
    },
    security: {
      ...defaultConfig.security,
      corsOrigins: ['https://www.example.com', 'https://admin.example.com'],
      rateLimitMax: 50,
    },
    logging: {
      level: 'warn',
      format: 'json',
      destination: 'stdout',
    },
  },
};

// 設定のマージとエクスポート
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, any>,
        source[key] as Record<string, any>
      ) as T[Extract<keyof T, string>];
    } else if (source[key] !== undefined) {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }
  return result;
}

const currentEnv = process.env.NODE_ENV || 'development';
const override = envOverrides[currentEnv] || {};

export const config: AppConfig = deepMerge(defaultConfig, override);

// 設定の凍結（実行時の書き換え防止）
Object.freeze(config);
Object.keys(config).forEach(key => {
  if (typeof (config as any)[key] === 'object') {
    Object.freeze((config as any)[key]);
  }
});
```

### 3.2 Configuration Dependency Injection (DI) Pattern

```typescript
// ============================================
// 設定をDIコンテナで管理するパターン
// ============================================

// config/types.ts
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
}

export interface CacheConfig {
  driver: 'memory' | 'redis' | 'memcached';
  ttl: number;
  prefix: string;
  redis?: {
    url: string;
    password?: string;
  };
}

export interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp';
  from: string;
  replyTo?: string;
  apiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
  };
}

// config/container.ts
import { DatabaseConfig, CacheConfig, EmailConfig } from './types';

class ConfigContainer {
  private configs = new Map<string, unknown>();

  register<T>(key: string, config: T): void {
    this.configs.set(key, Object.freeze(config));
  }

  get<T>(key: string): T {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`設定 "${key}" が登録されていません`);
    }
    return config as T;
  }

  has(key: string): boolean {
    return this.configs.has(key);
  }
}

// シングルトンインスタンス
export const configContainer = new ConfigContainer();

// 初期化
export function initializeConfig(): void {
  configContainer.register<DatabaseConfig>('database', {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'myapp',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
  });

  configContainer.register<CacheConfig>('cache', {
    driver: (process.env.CACHE_DRIVER as CacheConfig['driver']) || 'memory',
    ttl: parseInt(process.env.CACHE_TTL || '300'),
    prefix: process.env.CACHE_PREFIX || 'myapp:',
    redis: process.env.REDIS_URL
      ? { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
      : undefined,
  });

  configContainer.register<EmailConfig>('email', {
    provider: (process.env.EMAIL_PROVIDER as EmailConfig['provider']) || 'sendgrid',
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    replyTo: process.env.EMAIL_REPLY_TO,
    apiKey: process.env.SENDGRID_API_KEY,
  });
}

// 使用例
// import { configContainer, initializeConfig } from './config/container';
// initializeConfig();
// const dbConfig = configContainer.get<DatabaseConfig>('database');
```

---

## 4. Feature Flags

### 4.1 Feature Flags Overview and Types

Feature Flags are a mechanism for toggling features on/off without code changes. They separate deployment from release, enabling gradual rollouts and A/B testing.

```
Feature Flags の種類:

  ┌───────────────────┬──────────────────────────────────────────────┐
  │ 種類               │ 説明                                        │
  ├───────────────────┼──────────────────────────────────────────────┤
  │ Release Flag      │ 未完成の機能を隠すためのフラグ                │
  │                   │ 開発完了後に削除する（短命）                   │
  │                   │ 例: 新しいダッシュボード UI                    │
  ├───────────────────┼──────────────────────────────────────────────┤
  │ Experiment Flag   │ A/Bテストやパーセンテージロールアウト用         │
  │                   │ 実験完了後に削除する（中期）                   │
  │                   │ 例: 新しいチェックアウトフロー                 │
  ├───────────────────┼──────────────────────────────────────────────┤
  │ Ops Flag          │ 運用上のトグル（メンテナンスモードなど）        │
  │                   │ 長期的に維持する                              │
  │                   │ 例: 書き込み操作の一時停止                    │
  ├───────────────────┼──────────────────────────────────────────────┤
  │ Permission Flag   │ ユーザーの権限やプランに基づく機能制御          │
  │                   │ 永続的に維持する                              │
  │                   │ 例: プレミアムプラン限定機能                   │
  └───────────────────┴──────────────────────────────────────────────┘

Feature Flags のライフサイクル:
  作成 → テスト → 段階的有効化 → 全体有効化 → フラグ削除

  注意: 不要になったフラグは必ず削除する（技術的負債の温床）
```

### 4.2 Environment-Variable-Based Feature Flag Implementation

```typescript
// ============================================
// lib/feature-flags.ts
// 環境変数ベースのシンプルな Feature Flags
// ============================================

// Feature Flag の定義
const FEATURE_FLAGS = {
  // Release Flags
  newDashboard: {
    envVar: 'NEXT_PUBLIC_FF_NEW_DASHBOARD',
    description: '新しいダッシュボード UI',
    defaultValue: false,
  },
  newCheckout: {
    envVar: 'NEXT_PUBLIC_FF_NEW_CHECKOUT',
    description: '新しいチェックアウトフロー',
    defaultValue: false,
  },

  // Ops Flags
  maintenanceMode: {
    envVar: 'NEXT_PUBLIC_FF_MAINTENANCE',
    description: 'メンテナンスモード',
    defaultValue: false,
  },
  readOnlyMode: {
    envVar: 'NEXT_PUBLIC_FF_READ_ONLY',
    description: '読み取り専用モード',
    defaultValue: false,
  },

  // Experiment Flags
  darkMode: {
    envVar: 'NEXT_PUBLIC_FF_DARK_MODE',
    description: 'ダークモード',
    defaultValue: false,
  },

  // Permission Flags
  betaFeatures: {
    envVar: 'NEXT_PUBLIC_FF_BETA',
    description: 'ベータ機能の表示',
    defaultValue: false,
  },
  premiumFeatures: {
    envVar: 'NEXT_PUBLIC_FF_PREMIUM',
    description: 'プレミアム機能',
    defaultValue: false,
  },
} as const;

type FeatureFlagName = keyof typeof FEATURE_FLAGS;

// Feature Flag の状態を取得
export function isFeatureEnabled(name: FeatureFlagName): boolean {
  const flag = FEATURE_FLAGS[name];
  const envValue = process.env[flag.envVar];

  if (envValue === undefined || envValue === '') {
    return flag.defaultValue;
  }

  return envValue === 'true' || envValue === '1';
}

// 全 Feature Flags の状態を取得
export function getAllFeatureFlags(): Record<FeatureFlagName, boolean> {
  const flags = {} as Record<FeatureFlagName, boolean>;

  for (const name of Object.keys(FEATURE_FLAGS) as FeatureFlagName[]) {
    flags[name] = isFeatureEnabled(name);
  }

  return flags;
}

// Feature Flag の説明を取得（管理画面用）
export function getFeatureFlagDescriptions(): Array<{
  name: string;
  description: string;
  enabled: boolean;
  envVar: string;
}> {
  return (Object.entries(FEATURE_FLAGS) as [FeatureFlagName, typeof FEATURE_FLAGS[FeatureFlagName]][])
    .map(([name, flag]) => ({
      name,
      description: flag.description,
      enabled: isFeatureEnabled(name as FeatureFlagName),
      envVar: flag.envVar,
    }));
}
```

### 4.3 Feature Flag as a React Component

```tsx
// ============================================
// components/FeatureFlag.tsx
// React コンポーネントとして Feature Flag を使う
// ============================================
import React, { createContext, useContext, ReactNode } from 'react';
import { getAllFeatureFlags, isFeatureEnabled } from '@/lib/feature-flags';

type FeatureFlagName = Parameters<typeof isFeatureEnabled>[0];

// ---- Context API による Feature Flags の提供 ----
interface FeatureFlagContextType {
  flags: Record<string, boolean>;
  isEnabled: (name: FeatureFlagName) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flags: {},
  isEnabled: () => false,
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const flags = getAllFeatureFlags();

  const contextValue: FeatureFlagContextType = {
    flags,
    isEnabled: (name: FeatureFlagName) => flags[name] ?? false,
  };

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// ---- Hook ----
export function useFeatureFlag(name: FeatureFlagName): boolean {
  const context = useContext(FeatureFlagContext);
  return context.isEnabled(name);
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

// ---- 宣言的コンポーネント ----
interface FeatureFlagProps {
  name: FeatureFlagName;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureFlag({ name, children, fallback = null }: FeatureFlagProps) {
  const isEnabled = useFeatureFlag(name);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

// ---- 使用例 ----
// function App() {
//   return (
//     <FeatureFlagProvider>
//       <Layout>
//         <FeatureFlag
//           name="newDashboard"
//           fallback={<OldDashboard />}
//         >
//           <NewDashboard />
//         </FeatureFlag>
//
//         <FeatureFlag name="darkMode">
//           <DarkModeToggle />
//         </FeatureFlag>
//       </Layout>
//     </FeatureFlagProvider>
//   );
// }

// ---- Hook の使用例 ----
// function NavigationMenu() {
//   const showBeta = useFeatureFlag('betaFeatures');
//   const showPremium = useFeatureFlag('premiumFeatures');
//
//   return (
//     <nav>
//       <Link href="/">Home</Link>
//       <Link href="/dashboard">Dashboard</Link>
//       {showBeta && <Link href="/beta">Beta Features</Link>}
//       {showPremium && <Link href="/premium">Premium</Link>}
//     </nav>
//   );
// }
```

### 4.4 Service-Based Feature Flags (Gradual Rollout)

```typescript
// ============================================
// lib/feature-flags-service.ts
// 外部サービスを利用した高度な Feature Flags
// ============================================

// Feature Flag サービスの抽象インターフェース
interface FeatureFlagService {
  isEnabled(flagName: string, context?: EvaluationContext): Promise<boolean>;
  getVariant(flagName: string, context?: EvaluationContext): Promise<string | null>;
  getAllFlags(context?: EvaluationContext): Promise<Record<string, boolean>>;
}

interface EvaluationContext {
  userId?: string;
  email?: string;
  country?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  percentile?: number; // 0-100 のハッシュ値
  attributes?: Record<string, string | number | boolean>;
}

// Percentageベースのロールアウト実装
class PercentageRollout {
  // User IDからハッシュ値を計算（0-100）
  static calculatePercentile(userId: string, flagName: string): number {
    const input = `${userId}:${flagName}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer に変換
    }
    return Math.abs(hash) % 100;
  }

  // Percentageでの有効判定
  static isEnabledForUser(
    userId: string,
    flagName: string,
    percentage: number
  ): boolean {
    const userPercentile = this.calculatePercentile(userId, flagName);
    return userPercentile < percentage;
  }
}

// ローカル実装（外部サービスなし）
class LocalFeatureFlagService implements FeatureFlagService {
  private flags: Map<string, FlagConfig> = new Map();

  constructor(config: Record<string, FlagConfig>) {
    for (const [name, flagConfig] of Object.entries(config)) {
      this.flags.set(name, flagConfig);
    }
  }

  async isEnabled(
    flagName: string,
    context?: EvaluationContext
  ): Promise<boolean> {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    // グローバルに無効の場合
    if (!flag.enabled) return false;

    // コンテキストなしの場合はグローバル設定を返す
    if (!context) return flag.enabled;

    // ユーザーセグメントのチェック
    if (flag.allowedUsers?.includes(context.userId || '')) return true;
    if (flag.allowedEmails?.includes(context.email || '')) return true;
    if (flag.blockedUsers?.includes(context.userId || '')) return false;

    // プラン制限のチェック
    if (flag.requiredPlans && context.plan) {
      if (!flag.requiredPlans.includes(context.plan)) return false;
    }

    // Percentageロールアウト
    if (flag.rolloutPercentage !== undefined && context.userId) {
      return PercentageRollout.isEnabledForUser(
        context.userId,
        flagName,
        flag.rolloutPercentage
      );
    }

    return flag.enabled;
  }

  async getVariant(
    flagName: string,
    context?: EvaluationContext
  ): Promise<string | null> {
    const flag = this.flags.get(flagName);
    if (!flag?.variants || !context?.userId) return null;

    const percentile = PercentageRollout.calculatePercentile(
      context.userId,
      flagName
    );

    let cumulative = 0;
    for (const variant of flag.variants) {
      cumulative += variant.weight;
      if (percentile < cumulative) return variant.name;
    }

    return null;
  }

  async getAllFlags(
    context?: EvaluationContext
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    for (const [name] of this.flags) {
      result[name] = await this.isEnabled(name, context);
    }
    return result;
  }
}

interface FlagConfig {
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number; // 0-100
  allowedUsers?: string[];
  allowedEmails?: string[];
  blockedUsers?: string[];
  requiredPlans?: Array<'free' | 'pro' | 'enterprise'>;
  variants?: Array<{ name: string; weight: number }>;
}

// サービスのインスタンス作成
export const featureFlagService = new LocalFeatureFlagService({
  'new-checkout': {
    enabled: true,
    description: '新しいチェックアウトフロー',
    rolloutPercentage: 25, // 25% のユーザーに有効
  },
  'premium-analytics': {
    enabled: true,
    description: 'プレミアム分析ダッシュボード',
    requiredPlans: ['pro', 'enterprise'],
  },
  'ab-test-pricing': {
    enabled: true,
    description: '料金ページの A/B テスト',
    variants: [
      { name: 'control', weight: 50 },
      { name: 'variant-a', weight: 25 },
      { name: 'variant-b', weight: 25 },
    ],
  },
  'beta-ai-features': {
    enabled: true,
    description: 'AI 機能のベータテスト',
    allowedEmails: ['beta-tester@example.com'],
    rolloutPercentage: 5,
  },
});

// 使用例
// const isNewCheckout = await featureFlagService.isEnabled('new-checkout', {
//   userId: currentUser.id,
//   plan: currentUser.plan,
// });
```

### 4.5 Feature Flag Service Comparison

```
主要な Feature Flags サービスの比較:

  ┌───────────────┬─────────┬──────────────┬──────────────┬───────────┐
  │ サービス       │ 料金     │ セグメント    │ A/Bテスト    │ OSS       │
  ├───────────────┼─────────┼──────────────┼──────────────┼───────────┤
  │ LaunchDarkly  │ 有料     │ 高度         │ 対応         │ ×         │
  │ Unleash       │ 無料+有料│ 中程度       │ 対応         │ ○         │
  │ Flagsmith     │ 無料+有料│ 中程度       │ 対応         │ ○         │
  │ PostHog       │ 無料+有料│ 高度         │ 対応         │ ○         │
  │ ConfigCat     │ 無料+有料│ 中程度       │ 限定的       │ ×         │
  │ Split.io      │ 有料     │ 高度         │ 対応         │ ×         │
  │ 環境変数ベース │ 無料     │ なし         │ なし         │ -         │
  │ Vercel Edge   │ 無料+有料│ 地理・デバイス│ 対応         │ ×         │
  │ Config        │          │              │              │           │
  └───────────────┴─────────┴──────────────┴──────────────┴───────────┘

選択の指針:
  - 小規模プロジェクト → 環境変数ベース or Unleash（セルフホスト）
  - 中規模プロジェクト → Flagsmith or PostHog
  - 大規模プロジェクト → LaunchDarkly or Split.io
  - A/Bテスト重視     → PostHog or LaunchDarkly
  - OSS 重視          → Unleash or Flagsmith
```

---

## 5. Secret Management

### 5.1 Secret Classification and Management Policy

```
シークレットの分類:

  ┌─────────────────────┬───────────────────────┬──────────────────┐
  │ 分類                 │ 例                     │ 管理方法          │
  ├─────────────────────┼───────────────────────┼──────────────────┤
  │ API キー             │ Stripe Secret Key     │ 環境変数 or Vault │
  │ データベース認証情報   │ DB パスワード、接続URI │ Secrets Manager  │
  │ 暗号化キー           │ JWT Secret, AES Key   │ KMS or Vault     │
  │ OAuth クレデンシャル  │ Client Secret         │ Secrets Manager  │
  │ SSH キー             │ デプロイキー            │ CI/CD シークレット│
  │ TLS 証明書           │ SSL 証明書・秘密鍵     │ Certificate Mgr  │
  │ Webhook シークレット  │ Stripe Webhook Secret │ 環境変数          │
  └─────────────────────┴───────────────────────┴──────────────────┘

シークレット管理の原則:
  ① 最小権限の原則: 必要な最小限のアクセス権のみ付与
  ② ローテーション: 定期的にシークレットを更新する
  ③ 暗号化: 保存時も転送時も暗号化する
  ④ 監査: シークレットへのアクセスを記録・監視する
  ⑤ 分離: 環境ごとに異なるシークレットを使用する
```

### 5.2 Secret Management on Each Platform

```
シークレットの管理方法:

  ① 環境変数（基本）:
     → Vercel: Project Settings > Environment Variables
        - Preview / Production / Development で分離可能
        - Sensitive フラグでログ出力を防止
     → AWS: Systems Manager Parameter Store
        - SecureString 型で暗号化保存
        - IAM ポリシーでアクセス制御
     → .env.local（ローカル開発のみ）
        - 絶対に Git にコミットしない

  ② シークレットマネージャー:
     → AWS Secrets Manager
        - 自動ローテーション対応
        - バージョン管理
        - クロスリージョンレプリケーション
     → Google Cloud Secret Manager
        - IAM による細かいアクセス制御
        - 自動レプリケーション
     → HashiCorp Vault
        - 動的シークレット生成
        - リース（有効期限）管理
        - 詳細な監査ログ
     → Azure Key Vault
        - HSM（ハードウェアセキュリティモジュール）対応
        - 証明書管理も統合

  ③ .env ファイルの暗号化:
     → dotenv-vault
        - .env ファイルを暗号化してコミット可能
        - チーム間で安全に共有
     → sops（Mozilla）
        - AWS KMS / GCP KMS / Azure Key Vault と統合
        - 部分暗号化（キーは平文、値のみ暗号化）
     → git-crypt
        - Git リポジトリ内のファイルを透過的に暗号化
        - GPG キーベースのアクセス制御
```

### 5.3 AWS Secrets Manager Implementation Example

```typescript
// ============================================
// lib/secrets.ts
// AWS Secrets Manager を使ったシークレット取得
// ============================================
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// シークレットのキャッシュ（メモリ内）
const secretCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分

export async function getSecret(secretName: string): Promise<string> {
  // キャッシュを確認
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await client.send(command);
    const secretValue = response.SecretString;

    if (!secretValue) {
      throw new Error(`Secret "${secretName}" has no value`);
    }

    // キャッシュに保存
    secretCache.set(secretName, {
      value: secretValue,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return secretValue;
  } catch (error) {
    console.error(`Failed to retrieve secret "${secretName}":`, error);
    throw error;
  }
}

// JSON 形式のシークレットをパース
export async function getSecretJson<T>(secretName: string): Promise<T> {
  const secretString = await getSecret(secretName);
  return JSON.parse(secretString) as T;
}

// 使用例: データベース接続情報をシークレットから取得
interface DbCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export async function getDatabaseCredentials(): Promise<DbCredentials> {
  // 開発環境では環境変数から、本番ではシークレットマネージャーから取得
  if (process.env.NODE_ENV === 'development') {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'myapp_dev',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    };
  }

  return getSecretJson<DbCredentials>('myapp/production/database');
}
```

### 5.4 Preventing Secret Leakage

```
やってはいけないこと:
  ✗ シークレットをコードにハードコード
  ✗ .env.local を Git にコミット
  ✗ NEXT_PUBLIC_ にシークレットを入れる
  ✗ ログにシークレットを出力
  ✗ エラーメッセージにシークレットを含める
  ✗ シークレットをURL のクエリパラメータに含める
  ✗ フロントエンドの JavaScript にシークレットを埋め込む
  ✗ コメントやドキュメントに実際のシークレットを記載

.gitignore の設定:
  .env.local
  .env.*.local
  .env.development.local
  .env.production.local
  *.pem
  *.key
  *.p12
  credentials.json
  service-account.json
```

```typescript
// ============================================
// pre-commit hook でシークレット漏洩を検出
// .husky/pre-commit
// ============================================

// package.json に追加するスクリプト
// {
//   "scripts": {
//     "check-secrets": "ts-node scripts/check-secrets.ts"
//   },
//   "lint-staged": {
//     "**/*": "ts-node scripts/check-secrets.ts"
//   }
// }

// scripts/check-secrets.ts
import { execSync } from 'child_process';

// 危険なパターンの定義
const SECRET_PATTERNS = [
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g, description: 'AWS Access Key ID' },
  { pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*=\s*[\w/+=]{40}/g,
    description: 'AWS Secret Access Key' },

  // Stripe
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, description: 'Stripe Live Secret Key' },
  { pattern: /rk_live_[a-zA-Z0-9]{24,}/g, description: 'Stripe Live Restricted Key' },

  // GitHub
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, description: 'GitHub Personal Access Token' },
  { pattern: /ghs_[a-zA-Z0-9]{36}/g, description: 'GitHub App Installation Token' },

  // Google
  { pattern: /AIza[0-9A-Za-z\-_]{35}/g, description: 'Google API Key' },

  // 汎用
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, description: 'Private Key' },
  { pattern: /password\s*=\s*['"][^'"]{8,}['"]/gi, description: 'Hardcoded Password' },
];

function checkForSecrets(filePaths: string[]): void {
  const violations: Array<{ file: string; line: number; description: string }> = [];

  for (const filePath of filePaths) {
    // バイナリファイルはスキップ
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(filePath)) {
      continue;
    }

    try {
      const content = require('fs').readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        for (const { pattern, description } of SECRET_PATTERNS) {
          // パターンをリセット（global フラグのため）
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            violations.push({
              file: filePath,
              line: lineNum + 1,
              description,
            });
          }
        }
      }
    } catch (error) {
      // ファイル読み込みエラーは無視
    }
  }

  if (violations.length > 0) {
    console.error('\nシークレット漏洩の可能性を検出しました:');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} - ${v.description}`);
    }
    console.error('\nシークレットを削除してから再度コミットしてください。');
    process.exit(1);
  }

  console.log('シークレットチェック: 問題は検出されませんでした。');
}

// ステージングされたファイルを取得
const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM')
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

checkForSecrets(stagedFiles);
```

---

## 6. Environment Variable Management in CI/CD Pipelines

### 6.1 Environment Variable Configuration in GitHub Actions

```yaml
# ============================================
# .github/workflows/deploy.yml
# GitHub Actions での環境変数管理
# ============================================
name: Deploy

on:
  push:
    branches: [main, staging]

# 環境変数の設定方法:
# 1. Repository secrets: Settings > Secrets and variables > Actions
# 2. Environment secrets: Settings > Environments > [env] > Secrets
# 3. Organization secrets: Organization Settings > Secrets

jobs:
  deploy:
    runs-on: ubuntu-latest

    # 環境を指定（GitHub Environments）
    environment:
      name: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
      url: ${{ steps.deploy.outputs.url }}

    # ジョブレベルの環境変数
    env:
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: 1

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run environment check
        run: npm run check-env
        env:
          # Repository secrets から注入
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
          SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
          # Environment secrets から注入（環境ごとに異なる値）
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_APP_URL: ${{ vars.NEXT_PUBLIC_APP_URL }}

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_APP_URL: ${{ vars.NEXT_PUBLIC_APP_URL }}
          NEXT_PUBLIC_GA_ID: ${{ vars.NEXT_PUBLIC_GA_ID }}
          NEXT_PUBLIC_SENTRY_DSN: ${{ vars.NEXT_PUBLIC_SENTRY_DSN }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}

      - name: Deploy to Vercel
        id: deploy
        run: |
          npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Run smoke tests
        run: npm run test:smoke
        env:
          TEST_URL: ${{ steps.deploy.outputs.url }}

  # 環境変数の設定確認ジョブ
  verify-config:
    runs-on: ubuntu-latest
    needs: deploy
    steps:
      - name: Verify deployment config
        run: |
          RESPONSE=$(curl -s ${{ needs.deploy.outputs.url }}/api/health)
          echo "Health check response: $RESPONSE"
          if echo "$RESPONSE" | jq -e '.status == "ok"' > /dev/null 2>&1; then
            echo "Deployment verification passed"
          else
            echo "Deployment verification failed"
            exit 1
          fi
```

### 6.2 Environment Variable Configuration in Vercel

```typescript
// ============================================
// vercel.json - Vercel プロジェクト設定
// ============================================
// {
//   "env": {
//     "CUSTOM_VAR": "value"
//   },
//   "build": {
//     "env": {
//       "BUILD_VAR": "build-value"
//     }
//   }
// }

// Vercel CLI での環境変数設定
// vercel env add DATABASE_URL production
// vercel env add DATABASE_URL preview
// vercel env add DATABASE_URL development

// 環境変数の一覧取得
// vercel env ls

// 環境変数の削除
// vercel env rm DATABASE_URL production

// ============================================
// Vercel の環境変数のスコープ
// ============================================
// Production:   本番デプロイ時のみ使用
// Preview:      プレビューデプロイ（PR ブランチ）で使用
// Development:  vercel dev 実行時に使用
//
// Sensitive:    ログやビルド出力に表示されない
// Plain:        通常の環境変数

// ============================================
// vercel.json で Preview 環境のブランチ固有設定
// ============================================
// {
//   "git": {
//     "deploymentEnabled": {
//       "feature/*": true,
//       "fix/*": true,
//       "main": true
//     }
//   }
// }
```

### 6.3 Environment Variable Management in Docker

```dockerfile
# ============================================
# Dockerfile - マルチステージビルドでの環境変数
# ============================================

# ---- ビルドステージ ----
FROM node:20-alpine AS builder

WORKDIR /app

# ビルド時の環境変数（ARG）
# docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GA_ID

# ARG を ENV に変換（ビルドプロセスで使用）
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- 実行ステージ ----
FROM node:20-alpine AS runner

WORKDIR /app

# 実行時の環境変数はここでは設定しない
# docker run -e DATABASE_URL=... で注入する
ENV NODE_ENV=production

# セキュリティ: 非 root ユーザーで実行
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

```yaml
# ============================================
# docker-compose.yml - 開発環境の構成
# ============================================
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
      args:
        - NEXT_PUBLIC_API_URL=http://localhost:3001
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp_dev
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env                    # 共通設定
      - .env.development        # 開発環境設定
      - .env.local              # ローカルオーバーライド（.gitignore）
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 7. Configuration Management in Kubernetes

### 7.1 ConfigMap and Secret

In Kubernetes, configuration data is managed with two resources: ConfigMap and Secret. ConfigMap stores non-sensitive data, while Secret stores sensitive data.

```yaml
# ============================================
# k8s/configmap.yaml - 非機密設定
# ============================================
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
  namespace: production
  labels:
    app: myapp
    environment: production
data:
  # 個別のキーバリュー
  NODE_ENV: "production"
  LOG_LEVEL: "warn"
  LOG_FORMAT: "json"
  CACHE_TTL: "600"
  ENABLE_ANALYTICS: "true"
  ENABLE_RATE_LIMIT: "true"

  # Config fileとしてマウントすることも可能
  app-config.json: |
    {
      "api": {
        "baseUrl": "https://api.example.com",
        "timeout": 10000,
        "retryCount": 5
      },
      "cache": {
        "ttl": 600,
        "maxItems": 10000,
        "strategy": "redis"
      },
      "security": {
        "corsOrigins": [
          "https://www.example.com",
          "https://admin.example.com"
        ],
        "rateLimitMax": 50
      }
    }
```

```yaml
# ============================================
# k8s/secret.yaml - 機密設定
# ============================================
apiVersion: v1
kind: Secret
metadata:
  name: myapp-secrets
  namespace: production
  labels:
    app: myapp
    environment: production
type: Opaque
# 値は Base64 エンコードが必要
# echo -n 'value' | base64
data:
  DATABASE_URL: cG9zdGdyZXNxbDovL3VzZXI6cGFzc0Bob3N0OjU0MzIvbXlkYg==
  JWT_SECRET: c3VwZXItc2VjcmV0LWtleS10aGF0LWlzLWF0LWxlYXN0LTMyLWNoYXJz
  STRIPE_SECRET_KEY: c2tfdGVzdF94eHh4eHh4eHh4eHg=
  REDIS_PASSWORD: cmVkaXMtcGFzc3dvcmQ=

# stringData を使えば Base64 エンコード不要（推奨）
# stringData:
#   DATABASE_URL: "postgresql://user:pass@host:5432/mydb"
#   JWT_SECRET: "super-secret-key-that-is-at-least-32-chars"
```

```yaml
# ============================================
# k8s/deployment.yaml - Pod での環境変数注入
# ============================================
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          ports:
            - containerPort: 3000

          # 方法1: ConfigMap から個別の環境変数を注入
          env:
            - name: NODE_ENV
              valueFrom:
                configMapKeyRef:
                  name: myapp-config
                  key: NODE_ENV
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: DATABASE_URL
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: JWT_SECRET

          # 方法2: ConfigMap / Secret の全キーを一括注入
          envFrom:
            - configMapRef:
                name: myapp-config
            - secretRef:
                name: myapp-secrets

          # 方法3: 設定ファイルとしてマウント
          volumeMounts:
            - name: config-volume
              mountPath: /app/config
              readOnly: true

      volumes:
        - name: config-volume
          configMap:
            name: myapp-config
            items:
              - key: app-config.json
                path: app-config.json
```

### 7.2 External Secrets Operator

```yaml
# ============================================
# External Secrets Operator で AWS Secrets Manager と連携
# ============================================

# SecretStore: AWS Secrets Manager への接続設定
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secret-store
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-1
      auth:
        jwt:
          serviceAccountRef:
            name: myapp-sa

---
# ExternalSecret: AWS Secrets Manager から Kubernetes Secret を自動生成
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: myapp-external-secrets
  namespace: production
spec:
  refreshInterval: 1h        # 1時間ごとに同期
  secretStoreRef:
    name: aws-secret-store
    kind: SecretStore
  target:
    name: myapp-secrets       # 生成される Secret の名前
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: myapp/production/database
        property: url
    - secretKey: JWT_SECRET
      remoteRef:
        key: myapp/production/auth
        property: jwt_secret
    - secretKey: STRIPE_SECRET_KEY
      remoteRef:
        key: myapp/production/stripe
        property: secret_key
```

### 7.3 Sealed Secrets (Git-managed Encrypted Secrets)

```
Sealed Secrets の仕組み:

  開発者のマシン                    Kubernetes クラスタ
  ┌─────────────────┐              ┌─────────────────────┐
  │ kubeseal CLI    │              │ Sealed Secrets      │
  │                 │              │ Controller          │
  │ Secret          │   暗号化     │                     │
  │ (平文)     ─────┼──────────>   │ SealedSecret        │
  │                 │              │ (暗号化済み)    ─────┤
  │                 │              │                     │ 復号化
  │                 │              │ Secret              │
  │                 │              │ (平文 - Pod に注入) │
  └─────────────────┘              └─────────────────────┘

  メリット:
  - 暗号化された SealedSecret を Git にコミットできる
  - GitOps ワークフローと相性が良い
  - クラスタの公開鍵でのみ復号可能
```

```bash
# Sealed Secrets の使い方

# 1. 通常の Secret を作成（ファイルとして）
kubectl create secret generic myapp-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/mydb' \
  --from-literal=JWT_SECRET='super-secret-key-that-is-at-least-32-chars' \
  --dry-run=client -o yaml > secret.yaml

# 2. kubeseal で暗号化
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# 3. 暗号化された SealedSecret を Git にコミット（安全）
git add sealed-secret.yaml
git commit -m "Add sealed secrets for production"

# 4. クラスタにデプロイ（Controller が自動で復号して Secret を作成）
kubectl apply -f sealed-secret.yaml
```

---

## 8. Configuration Management Anti-Patterns and Countermeasures

### 8.1 Common Anti-Patterns

```
アンチパターン一覧と対策:

  ┌──────────────────────────────────┬──────────────────────────────────┐
  │ アンチパターン                    │ 対策                             │
  ├──────────────────────────────────┼──────────────────────────────────┤
  │ シークレットのハードコード         │ 環境変数 or Secrets Manager      │
  │ if (env === 'prod') 分岐         │ 環境別設定ファイルで分離           │
  │ 環境変数の型変換忘れ              │ Zod でスキーマバリデーション       │
  │ デフォルト値に本番値を使用         │ 安全なデフォルト値を設定           │
  │ .env をコミット                  │ .gitignore + pre-commit hook     │
  │ NEXT_PUBLIC_ に機密情報          │ プレフィックスの意味を理解する      │
  │ 設定のグローバル変数管理           │ DI パターンまたはモジュール化      │
  │ 環境変数の過剰な使用              │ 設定ファイルとの適切な使い分け      │
  │ テスト環境で本番シークレットを使用  │ テスト用のモック/ダミー値を使用    │
  │ 設定の変更ログを残さない           │ 設定変更の監査ログを実装           │
  │ Feature Flag の放置              │ 定期的なクリーンアップを実施       │
  │ 全環境で同一のシークレットを使用    │ 環境ごとにシークレットをローテート  │
  └──────────────────────────────────┴──────────────────────────────────┘
```

### 8.2 Details on Conditional-Branching Anti-Patterns

```typescript
// ============================================
// アンチパターン: コード内での環境分岐
// ============================================

// BAD: コードの中で環境を判定して分岐する
function getApiUrlBad(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://api.example.com';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'https://staging-api.example.com';
  } else {
    return 'http://localhost:3001';
  }
}

// BAD: 環境ごとに異なるサービスを直接切り替え
function createEmailServiceBad() {
  if (process.env.NODE_ENV === 'production') {
    return new SendGridEmailService(process.env.SENDGRID_API_KEY!);
  } else {
    return new ConsoleEmailService(); // コンソールに出力するだけ
  }
}

// GOOD: 環境変数から設定を読み取る
function getApiUrlGood(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_URL is not defined');
  }
  return url;
}

// GOOD: DIパターンで環境に依存しない設計
interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

function createEmailServiceGood(config: EmailConfig): EmailService {
  switch (config.provider) {
    case 'sendgrid':
      return new SendGridEmailService(config.apiKey!);
    case 'ses':
      return new SESEmailService(config);
    case 'smtp':
      return new SMTPEmailService(config.smtp!);
    default:
      throw new Error(`Unknown email provider: ${config.provider}`);
  }
}
```

### 8.3 Designing Safe Default Values

```typescript
// ============================================
// Default valuesの設計原則
// ============================================

// BAD: 危険なデフォルト値
const configBad = {
  debugMode: true,              // 本番で有効になる危険
  corsOrigin: '*',              // 全オリジン許可の危険
  rateLimit: false,             // Rate limitingなしの危険
  logLevel: 'debug',            // 本番で詳細ログが出る
  sessionSecret: 'default',     // 既知のシークレット
  ssl: false,                   // SSL なしの危険
};

// GOOD: 安全なデフォルト値（Secure by Default）
const configGood = {
  debugMode: false,             // デフォルトで無効
  corsOrigin: undefined,        // 明示的な設定が必要
  rateLimit: true,              // デフォルトで有効
  logLevel: 'warn',             // 本番向けのレベル
  sessionSecret: undefined,     // 必須（起動時エラー）
  ssl: true,                    // デフォルトで有効
};

// GOOD: 環境に応じたデフォルト値
function getDefaultConfig(env: string) {
  const isProduction = env === 'production';

  return {
    debugMode: !isProduction,
    logLevel: isProduction ? 'warn' : 'debug',
    ssl: isProduction, // 本番では必ず SSL
    cache: {
      ttl: isProduction ? 600 : 0,
      strategy: isProduction ? 'redis' : 'memory',
    },
  };
}
```

---

## 9. Troubleshooting

### 9.1 Common Problems and Solutions

```
問題1: 環境変数が undefined になる

  症状: process.env.MY_VAR が undefined
  原因と対策:

  チェックリスト:
  □ .env ファイルに変数が定義されているか
  □ .env ファイルの書式が正しいか（= の前後にスペースがないか）
  □ .env ファイルの文字コードが UTF-8 か
  □ 変数名にタイポがないか（大文字小文字の区別あり）
  □ クライアントサイドでアクセスする場合 NEXT_PUBLIC_ プレフィックスがあるか
  □ dotenv パッケージが正しく読み込まれているか
  □ Docker 環境の場合 env_file が正しく指定されているか

  デバッグコマンド:
  $ node -e "console.log(process.env.MY_VAR)"
  $ printenv | grep MY_VAR
  $ docker exec container_name printenv | grep MY_VAR


問題2: ビルド時と実行時で環境変数が異なる

  症状: ビルドしたアプリケーションが意図しない API を呼ぶ
  原因: NEXT_PUBLIC_ はビルド時にインライン化されるため、
        実行時に環境変数を変更しても反映されない

  対策:
  (1) ビルド時に正しい環境変数を設定する
     NEXT_PUBLIC_API_URL=https://api.example.com npm run build
  (2) Runtime Configuration を使う（Next.js）
     → serverRuntimeConfig / publicRuntimeConfig
  (3) __NEXT_DATA__ を使ったランタイム環境変数注入
     → getServerSideProps で環境変数を props として渡す


問題3: Docker コンテナ内で .env が読まれない

  症状: ローカルでは動くが Docker コンテナ内で環境変数が空
  原因: .env ファイルが .dockerignore に含まれている

  対策:
  (1) docker-compose の env_file を使う
  (2) docker run -e で個別に渡す
  (3) docker run --env-file .env で一括渡し
  (4) .env を .dockerignore に入れたまま、
     外部から注入する（推奨）


問題4: CI/CD で環境変数が設定されていない

  症状: CI パイプラインでビルドが失敗する
  原因: Repository secrets / Environment secrets が未設定

  対策:
  (1) GitHub Actions: Settings > Secrets に変数を追加
  (2) secrets コンテキストが正しく参照されているか確認
     ${{ secrets.MY_SECRET }}（$ を忘れがち）
  (3) Environment protection rules が設定されていないか確認
  (4) Organization secrets の場合はリポジトリへのアクセスを許可


問題5: 環境変数の値に特殊文字が含まれる

  症状: パスワードに ! や $ が含まれると正しく読み取れない
  原因: シェルの文字列展開が干渉する

  対策:
  (1) .env ファイルではシングルクォートで囲む
     DATABASE_PASSWORD='p@ss!w0rd$123'
  (2) Docker では環境変数をシングルクォートで渡す
     docker run -e "DATABASE_PASSWORD='p@ss!w0rd\$123'"
  (3) Base64 エンコードして格納し、アプリ側でデコードする


問題6: Feature Flag が反映されない

  症状: 環境変数を変更したのに Feature Flag の状態が変わらない
  原因:
  (1) NEXT_PUBLIC_ の場合はビルドの再実行が必要
  (2) サーバーサイドの場合はサーバーの再起動が必要
  (3) CDN やブラウザのキャッシュが残っている

  対策:
  (1) サービスベースの Feature Flags を使う（再デプロイ不要）
  (2) サーバーサイドのみの Feature Flags はランタイムで評価
  (3) キャッシュのパージを実行
```

### 9.2 Environment Variable Debug Tools

```typescript
// ============================================
// lib/debug-env.ts
// 環境変数のデバッグヘルパー（開発環境のみ使用）
// ============================================

export function debugEnv(): void {
  if (process.env.NODE_ENV === 'production') {
    console.warn('debugEnv() は本番環境では使用しないでください');
    return;
  }

  console.log('\n========== 環境変数デバッグ情報 ==========');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`実行環境: ${typeof window === 'undefined' ? 'サーバー' : 'クライアント'}`);

  // 設定されている NEXT_PUBLIC_ 変数の一覧
  const publicVars = Object.entries(process.env)
    .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
    .map(([key, value]) => `  ${key}: ${value}`);

  console.log(`\nNEXT_PUBLIC_ 変数 (${publicVars.length}個):`);
  publicVars.forEach(v => console.log(v));

  // サーバーサイドの場合は機密変数の存在チェック（値は表示しない）
  if (typeof window === 'undefined') {
    const serverVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SENDGRID_API_KEY',
      'REDIS_URL',
      'SENTRY_DSN',
    ];

    console.log('\nサーバー変数の設定状況:');
    serverVars.forEach(key => {
      const value = process.env[key];
      const status = value
        ? `設定済み (${value.length}文字)`
        : '未設定';
      console.log(`  ${key}: ${status}`);
    });
  }

  console.log('==========================================\n');
}

// 使用方法（開発環境のみ）:
// import { debugEnv } from '@/lib/debug-env';
// if (process.env.NODE_ENV === 'development') debugEnv();
```

```typescript
// ============================================
// app/api/debug/env/route.ts
// 環境変数のデバッグ API（開発環境のみ）
// ============================================
import { NextResponse } from 'next/server';

export async function GET() {
  // 本番環境では絶対にアクセスさせない
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  // デバッグ用の情報を返す（値は隠す）
  const envInfo = {
    nodeEnv: process.env.NODE_ENV,
    platform: process.platform,
    nodeVersion: process.version,
    variables: Object.keys(process.env)
      .sort()
      .reduce((acc, key) => {
        // 値は長さのみ表示（セキュリティ）
        const value = process.env[key] || '';
        acc[key] = {
          set: value.length > 0,
          length: value.length,
          // NEXT_PUBLIC_ は値も表示（クライアントに公開済みのため）
          value: key.startsWith('NEXT_PUBLIC_') ? value : '[hidden]',
        };
        return acc;
      }, {} as Record<string, any>),
  };

  return NextResponse.json(envInfo);
}
```

### 9.3 Verifying Configuration via Health Check Endpoint

```typescript
// ============================================
// app/api/health/route.ts
// ヘルスチェック API（設定の検証含む）
// ============================================
import { NextResponse } from 'next/server';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
  }[];
}

async function checkDatabase(): Promise<{
  status: 'pass' | 'fail';
  message: string;
  duration: number;
}> {
  const start = Date.now();
  try {
    // Prisma の場合
    // await prisma.$queryRaw`SELECT 1`;
    // Drizzle の場合
    // await db.execute(sql`SELECT 1`);
    return {
      status: 'pass',
      message: 'Database connection OK',
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Database connection failed: ${(error as Error).message}`,
      duration: Date.now() - start,
    };
  }
}

async function checkRedis(): Promise<{
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration: number;
}> {
  if (!process.env.REDIS_URL) {
    return { status: 'warn', message: 'Redis not configured', duration: 0 };
  }

  const start = Date.now();
  try {
    // Redis クライアントの PING
    // await redis.ping();
    return {
      status: 'pass',
      message: 'Redis connection OK',
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Redis connection failed: ${(error as Error).message}`,
      duration: Date.now() - start,
    };
  }
}

function checkRequiredEnvVars(): {
  status: 'pass' | 'fail';
  message: string;
} {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    return {
      status: 'fail',
      message: `Missing required env vars: ${missing.join(', ')}`,
    };
  }

  return { status: 'pass', message: 'All required env vars are set' };
}

export async function GET() {
  const [dbCheck, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);
  const envCheck = checkRequiredEnvVars();

  const checks = [
    { name: 'database', ...dbCheck },
    { name: 'redis', ...redisCheck },
    { name: 'env_vars', ...envCheck },
  ];

  const hasError = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');

  const health: HealthStatus = {
    status: hasError ? 'error' : hasWarn ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
    environment: process.env.NODE_ENV || 'unknown',
    checks,
  };

  return NextResponse.json(health, {
    status: hasError ? 503 : 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
```

---

## 10. Configuration Management Best Practices Checklist

### 10.1 Project Initial Setup

```
プロジェクト立ち上げ時のチェックリスト:

  □ .env.example を作成し、全環境変数を記載する
  □ .gitignore に .env.local, .env.*.local を追加する
  □ Zod による環境変数バリデーションを実装する
  □ pre-commit hook でシークレット漏洩チェックを設定する
  □ README.md に環境変数のセットアップ手順を記載する
  □ 環境変数の命名規則をチーム内で合意する
  □ Feature Flags の管理方針を決める
  □ シークレットの管理方法（Secrets Manager / Vault）を決める
  □ CI/CD パイプラインでの環境変数の設定方法を確認する
  □ ヘルスチェックエンドポイントを実装する
```

### 10.2 Code Review Checklist

```
環境設定に関するコードレビュー観点:

  □ 新しい環境変数が追加された場合:
    ├── .env.example が更新されているか
    ├── Zod スキーマが更新されているか
    ├── 適切なデフォルト値が設定されているか
    ├── NEXT_PUBLIC_ の要否が正しいか
    └── CI/CD のシークレット設定手順が明記されているか

  □ セキュリティ:
    ├── 機密情報がクライアントに露出していないか
    ├── ハードコードされたシークレットがないか
    ├── ログ出力にシークレットが含まれていないか
    └── エラーメッセージにシークレットが含まれていないか

  □ 設定の分離:
    ├── 環境固有の値がコードにハードコードされていないか
    ├── if (env === 'production') のような分岐がないか
    └── 設定の変更にコード変更が不要か

  □ Feature Flags:
    ├── 不要になったフラグの削除 PR が計画されているか
    ├── デフォルト値が安全か（OFF がデフォルト）
    └── フラグの説明がコードやドキュメントにあるか
```

### 10.3 Security Policy for Environment Configuration

```
セキュリティポリシーテンプレート:

  1. シークレットの分類と管理
     - Level 1（最高機密）: データベースパスワード、暗号化キー
       → AWS Secrets Manager / HashiCorp Vault で管理
       → 90日ごとにローテーション
     - Level 2（機密）: API キー、Webhook シークレット
       → 環境変数として CI/CD シークレットに格納
       → 180日ごとにローテーション
     - Level 3（内部利用）: 内部サービスの URL、ポート番号
       → ConfigMap / 環境変数で管理
       → ローテーション不要

  2. アクセス制御
     - 本番環境のシークレットへのアクセスは、
       SRE チームと Tech Lead のみに限定
     - シークレットの変更は必ず2人以上の承認が必要
     - アクセスログを定期的に監査する

  3. インシデント対応
     - シークレット漏洩が疑われる場合:
       (1) 直ちに該当シークレットをローテーション
       (2) 影響範囲の調査（アクセスログの確認）
       (3) インシデントレポートの作成
       (4) 再発防止策の策定と実施

  4. 定期レビュー
     - 四半期ごとに環境変数の棚卸しを実施
     - 不要な環境変数の削除
     - シークレットのローテーション状況の確認
     - Feature Flags のクリーンアップ
```

### 10.4 Secret Rotation Implementation

```typescript
// ============================================
// lib/secret-rotation.ts
// シークレットのローテーション支援ツール
// ============================================

interface RotationPolicy {
  secretName: string;
  maxAgeDays: number;
  lastRotated: Date;
  owners: string[];
}

const rotationPolicies: RotationPolicy[] = [
  {
    secretName: 'DATABASE_PASSWORD',
    maxAgeDays: 90,
    lastRotated: new Date('2025-12-01'),
    owners: ['sre-team@example.com'],
  },
  {
    secretName: 'JWT_SECRET',
    maxAgeDays: 90,
    lastRotated: new Date('2025-11-15'),
    owners: ['sre-team@example.com'],
  },
  {
    secretName: 'STRIPE_SECRET_KEY',
    maxAgeDays: 180,
    lastRotated: new Date('2025-10-01'),
    owners: ['payment-team@example.com'],
  },
  {
    secretName: 'SENDGRID_API_KEY',
    maxAgeDays: 180,
    lastRotated: new Date('2025-09-01'),
    owners: ['platform-team@example.com'],
  },
];

interface RotationCheckResult {
  secretName: string;
  daysSinceRotation: number;
  maxAgeDays: number;
  status: 'ok' | 'warning' | 'expired';
  owners: string[];
  message: string;
}

export function checkRotationStatus(): RotationCheckResult[] {
  const now = new Date();

  return rotationPolicies.map(policy => {
    const daysSince = Math.floor(
      (now.getTime() - policy.lastRotated.getTime()) / (1000 * 60 * 60 * 24)
    );

    const warningThreshold = policy.maxAgeDays * 0.8; // 80% で警告

    let status: 'ok' | 'warning' | 'expired';
    let message: string;

    if (daysSince > policy.maxAgeDays) {
      status = 'expired';
      message = `${daysSince - policy.maxAgeDays}日超過しています。直ちにローテーションしてください。`;
    } else if (daysSince > warningThreshold) {
      status = 'warning';
      message = `残り${policy.maxAgeDays - daysSince}日でローテーション期限です。`;
    } else {
      status = 'ok';
      message = `次のローテーションまで${policy.maxAgeDays - daysSince}日です。`;
    }

    return {
      secretName: policy.secretName,
      daysSinceRotation: daysSince,
      maxAgeDays: policy.maxAgeDays,
      status,
      owners: policy.owners,
      message,
    };
  });
}

// ローテーション状況のレポート出力
export function printRotationReport(): void {
  const results = checkRotationStatus();

  console.log('\n===== シークレットローテーション状況 =====\n');

  for (const result of results) {
    const icon =
      result.status === 'ok' ? '[OK]' :
      result.status === 'warning' ? '[WARN]' : '[EXPIRED]';

    console.log(`${icon} ${result.secretName}`);
    console.log(`  最終ローテーション: ${result.daysSinceRotation}日前`);
    console.log(`  有効期限: ${result.maxAgeDays}日`);
    console.log(`  状態: ${result.message}`);
    console.log(`  担当: ${result.owners.join(', ')}`);
    console.log('');
  }

  const expired = results.filter(r => r.status === 'expired');
  if (expired.length > 0) {
    console.log(`\n[ALERT] ${expired.length}件のシークレットが期限切れです！`);
  }
}
```

---

## Summary

| Concept | Key Points | Recommended Tools |
|------|---------|-----------|
| Environment variable design | SCREAMING_SNAKE_CASE, classify with prefixes | - |
| Type safety | Startup-time validation with Zod, fail-fast | Zod, @t3-oss/env-nextjs |
| Environment isolation | Override with config files, avoid env branching in code | dotenv, direnv |
| Feature Flags | Gradual rollout, A/B testing, delete unused flags | LaunchDarkly, Unleash |
| Secret management | .env.local outside Git, encrypted storage with Secrets Manager | AWS Secrets Manager, Vault |
| CI/CD | Scope isolation with GitHub Environments, sensitive data with Secrets | GitHub Actions, Vercel |
| Kubernetes | Separate ConfigMap and Secret, External Secrets Operator | Sealed Secrets, ESO |
| Security | pre-commit hook, Secure by Default, regular rotation | husky, gitleaks |
| Debugging | Health check API, environment variable check script | - |

```
設定管理の成熟度モデル:

  Level 1（基本）:
    ├── .env ファイルで管理
    ├── .gitignore で機密ファイルを除外
    └── .env.example の作成

  Level 2（標準）:
    ├── 環境変数のバリデーション（Zod）
    ├── 環境別設定ファイル
    ├── pre-commit hook でのシークレットチェック
    └── CI/CD でのシークレット管理

  Level 3（高度）:
    ├── Secrets Manager / Vault の導入
    ├── Feature Flags サービスの導入
    ├── 自動ローテーション
    ├── 監査ログの実装
    └── Sealed Secrets / External Secrets Operator

  Level 4（エンタープライズ）:
    ├── ゼロトラストの設定管理
    ├── HSM（ハードウェアセキュリティモジュール）
    ├── コンプライアンス対応（SOC2, ISO27001）
    ├── 自動化されたポリシーチェック
    └── 設定の変更管理プロセス（ITIL ベース）
```

---

## Frequently Asked Questions (FAQ)

### Q1: How do I securely manage environment variables?

**Basic principles:**

1. **Never commit them**: Always add files containing actual values such as `.env`, `.env.local`, and `.env.production` to `.gitignore`
2. **Share the template**: List variable names and dummy values in `.env.example` and share it with the team
3. **Manage in layers**: Introduce a secret management system for production separate from development

**Recommended tools:**

```bash
# ローカル開発
.env.local         # gitignore対象、ローカル固有の値
.env.example       # Git管理、変数名とダミー値のみ

# 本番環境
AWS Secrets Manager    # AWS環境
Vercel Environment Variables  # Vercel
GitHub Secrets        # GitHub Actions
HashiCorp Vault       # オンプレミス/マルチクラウド
```

**Implementation example:**

```typescript
// env.ts - 起動時バリデーション
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

// 起動時にバリデーション、失敗したら即座にエラー
export const env = envSchema.parse(process.env);
```

### Q2: What are the best practices for managing .env files and .gitignore?

**Recommended file structure pattern:**

```
プロジェクトルート/
├── .env.example          # ✓ Git管理する（変数名のみ）
├── .env                  # ✗ gitignore（共通のデフォルト値）
├── .env.local            # ✗ gitignore（ローカル固有の値）
├── .env.development      # ✗ gitignore（開発環境用）
├── .env.production       # ✗ gitignore（本番環境用、通常は使わない）
└── .gitignore
```

**.gitignore configuration:**

```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.development
.env.production
.env.test

# ただし .env.example は除外しない（!で例外指定）
!.env.example
```

**How to write .env.example:**

```bash
# .env.example - チームで共有するテンプレート
# データベース
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# 外部API
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxx

# サービス設定
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development

# 認証
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=http://localhost:3000
```

**Security check:**

```bash
# pre-commit hookで機密情報の混入を防ぐ
npm install --save-dev husky @commitlint/cli
npx husky add .husky/pre-commit "npx gitleaks protect --staged"

# gitleaksで過去のコミット履歴もスキャン
docker run -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" -v
```

### Q3: What is the difference between build-time and runtime variables?

**Build-time Variables:**

```javascript
// Next.js の例
// next.config.js
module.exports = {
  env: {
    BUILD_TIME: new Date().toISOString(),
    COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
  },
};

// コンポーネントで使用
export default function Footer() {
  return <p>Built at: {process.env.BUILD_TIME}</p>;
  // ビルド時に値が埋め込まれ、クライアント側でも利用可能
}
```

**Characteristics:**
- Values are determined at build time and embedded in the bundle
- Changing them requires a rebuild
- Available on the client side (publicly exposed)
- Variables with the `NEXT_PUBLIC_*` prefix

**Runtime Variables:**

```javascript
// サーバーサイドでのみ利用（Server Components / API Routes）
export async function GET() {
  const dbUrl = process.env.DATABASE_URL; // 実行時に読み込まれる
  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  // ...
}
```

**Characteristics:**
- Loaded at server startup or request time
- Changing environment variables requires an app restart (no rebuild needed)
- Available server-side only (not exposed to clients)
- Secret information is managed here

**When to use each:**

| Use case | Type | Example |
|------|------|-----|
| API base URL | Build-time | `NEXT_PUBLIC_API_URL` |
| Google Analytics ID | Build-time | `NEXT_PUBLIC_GA_ID` |
| Database connection string | Runtime | `DATABASE_URL` |
| API secret key | Runtime | `STRIPE_SECRET_KEY` |
| Build version info | Build-time | `BUILD_ID`, `COMMIT_SHA` |

**Behavior in Vercel environment:**

```bash
# ビルド時変数: Vercel UI で「Exposed to Client」をチェック
NEXT_PUBLIC_API_URL=https://api.example.com

# 実行時変数: デフォルト（チェックなし）
DATABASE_URL=postgresql://...
```

---

## Next Guides to Read

---

## References
1. The Twelve-Factor App. "III. Config - Store config in the environment." 12factor.net, 2017.
2. Next.js. "Environment Variables." nextjs.org/docs, 2024.
3. Vercel. "Environment Variables." vercel.com/docs, 2024.
4. Vite. "Env Variables and Modes." vitejs.dev/guide, 2024.
5. AWS. "AWS Secrets Manager User Guide." docs.aws.amazon.com, 2024.
6. HashiCorp. "Vault Documentation." developer.hashicorp.com/vault, 2024.
7. Bitnami. "Sealed Secrets." github.com/bitnami-labs/sealed-secrets, 2024.
8. External Secrets Operator. "Getting Started." external-secrets.io, 2024.
9. LaunchDarkly. "Feature Flags Best Practices." launchdarkly.com/blog, 2024.
10. Martin Fowler. "Feature Toggles (aka Feature Flags)." martinfowler.com, 2023.
