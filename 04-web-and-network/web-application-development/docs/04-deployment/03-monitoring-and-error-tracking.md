# Monitoring and Error Tracking

> Production monitoring is the lifeline of service quality. Build a monitoring system to stably operate web applications in production — from Sentry, Web Vitals measurement, and logging to alert design. This guide comprehensively explains the knowledge and implementation patterns needed to run the full incident cycle of "detect → notify → diagnose → recover."

## Prerequisites

To get the most out of this guide, it is recommended that you have prior knowledge of the following.


## What You Will Learn

- [ ] Understand Sentry error tracking configuration and operation
- [ ] Implement error boundaries to protect user experience
- [ ] Understand Real User Monitoring (RUM) for Web Vitals
- [ ] Learn structured logging strategy and log level design
- [ ] Build alert design and incident response flows
- [ ] Understand APM (Application Performance Monitoring) tool selection and adoption
- [ ] Learn when to use Synthetic Monitoring versus Real User Monitoring
- [ ] Practice custom metrics design and visualization

---

## 1. Monitoring Overview and Design Principles

### 1.1 The Three Pillars of Observability

To monitor production environments properly, you need to understand the three pillars of "Observability."

```
オブザーバビリティの三本柱:

  ┌──────────────────────────────────────────────────────────────┐
  │                     Observability                           │
  │                                                             │
  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
  │  │   Metrics    │  │    Logs     │  │      Traces         │ │
  │  │  (メトリクス) │  │  (ログ)     │  │  (分散トレーシング) │ │
  │  │             │  │             │  │                     │ │
  │  │ ・CPU使用率  │  │ ・構造化    │  │ ・リクエスト追跡    │ │
  │  │ ・メモリ     │  │ ・レベル別  │  │ ・サービス間連携    │ │
  │  │ ・リクエスト数│  │ ・検索可能  │  │ ・ボトルネック特定  │ │
  │  │ ・エラー率   │  │ ・集約可能  │  │ ・レイテンシ分析    │ │
  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │
  └──────────────────────────────────────────────────────────────┘

  Metrics: 「何が起きているか」を数値で把握
  Logs:    「なぜ起きたか」を詳細に調査
  Traces:  「どこで起きているか」をリクエスト単位で追跡
```

### 1.2 Basic Principles of Monitoring Design

```typescript
/**
 * 監視設計の5つの原則（SMART Monitoring）
 *
 * S - Specific（具体的）: 何を監視するか明確にする
 * M - Measurable（測定可能）: 数値化できるメトリクスを選ぶ
 * A - Actionable（行動可能）: アラートを受けて何をするか決めておく
 * R - Relevant（関連性）: ビジネスに影響する項目を優先する
 * T - Timely（適時性）: リアルタイムに検知・通知する
 */

// ✗ 悪い監視設計：何を監視しているかわからない
const BAD_MONITORING = {
  alert: 'Something went wrong',
  threshold: 'unknown',
  action: 'check logs',
};

// ✓ 良い監視設計：具体的で行動可能
const GOOD_MONITORING = {
  metric: 'payment_success_rate',
  threshold: '< 95% over 5 minutes',
  severity: 'P0',
  runbook: 'https://wiki.example.com/runbooks/payment-failure',
  escalation: ['on-call-engineer', 'payment-team-lead'],
  action: [
    '1. Stripe ダッシュボードを確認',
    '2. 最近のデプロイを確認',
    '3. 必要に応じてロールバック',
  ],
};
```

### 1.3 Monitoring Layer Architecture

```
フロントエンド監視体制の全体像:

  ユーザー
    │
    ▼
  ┌──────────────────────────────────────┐
  │  ブラウザ（クライアント側）           │
  │  ┌────────────┐  ┌───────────────┐  │
  │  │ Error      │  │ Performance   │  │
  │  │ Tracking   │  │ Monitoring    │  │
  │  │ (Sentry)   │  │ (Web Vitals)  │  │
  │  └──────┬─────┘  └──────┬────────┘  │
  │         │               │            │
  │  ┌──────┴───────────────┴────────┐  │
  │  │     Session Replay            │  │
  │  │     (Sentry Replay / LogRocket)│  │
  │  └──────────────┬────────────────┘  │
  └─────────────────┼────────────────────┘
                    │
                    ▼ (HTTPS)
  ┌──────────────────────────────────────┐
  │  バックエンド / Edge                  │
  │  ┌────────────┐  ┌───────────────┐  │
  │  │ Structured │  │ APM           │  │
  │  │ Logging    │  │ (Datadog/NR)  │  │
  │  └──────┬─────┘  └──────┬────────┘  │
  │         │               │            │
  │  ┌──────┴───────────────┴────────┐  │
  │  │     Alerting & Notification   │  │
  │  │     (PagerDuty / Slack)       │  │
  │  └──────────────┬────────────────┘  │
  └─────────────────┼────────────────────┘
                    │
                    ▼
  ┌──────────────────────────────────────┐
  │  ダッシュボード & レポート            │
  │  (Grafana / Datadog Dashboard)      │
  └──────────────────────────────────────┘
```

---

## 2. Sentry (Error Tracking)

### 2.1 Sentry Basic Concepts

Sentry is an open-source error monitoring platform that automatically captures, aggregates, and analyzes errors on both frontend and backend. It provides the following features.

| Feature | Description | Use Case |
|------|------|------|
| Error Tracking | Automatic capture of unhandled exceptions | Error detection and aggregation |
| Performance Monitoring | Transaction measurement | Identify performance bottlenecks |
| Session Replay | Video recording of user interactions | Efficient error reproduction |
| Release Tracking | Link deploys to errors | Regression detection |
| Source Maps | Stack traces via source maps | Debug production code |
| Breadcrumbs | Record of user actions | Track the sequence leading to errors |
| Cron Monitoring | Monitor scheduled jobs | Detect anomalies in batch processing |

### 2.2 Complete Setup for Next.js + Sentry

```bash
# Sentry SDK のインストール
npx @sentry/wizard@latest -i nextjs

# ウィザードが以下のファイルを自動生成:
# - sentry.client.config.ts
# - sentry.server.config.ts
# - sentry.edge.config.ts
# - next.config.ts（withSentryConfig でラップ）
# - .sentryclirc（認証トークン）
```

```typescript
// sentry.client.config.ts - クライアント側の設定
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 環境の識別
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  // リリースバージョン（デプロイとエラーを関連付ける）
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || `my-app@${process.env.npm_package_version}`,

  // パフォーマンスモニタリング
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // トレースサンプラー（より細かい制御）
  tracesSampler: (samplingContext) => {
    // Health checkは計測しない
    if (samplingContext.name?.includes('/api/health')) {
      return 0;
    }
    // 決済関連は必ず計測
    if (samplingContext.name?.includes('/api/payment')) {
      return 1.0;
    }
    // その他は10%
    return 0.1;
  },

  // Session Replay の設定
  replaysSessionSampleRate: 0.01,   // 通常セッション: 1%サンプリング
  replaysOnErrorSampleRate: 1.0,    // エラー発生時: 100%キャプチャ

  // インテグレーション
  integrations: [
    // Session Replay
    Sentry.replayIntegration({
      maskAllText: false,            // テキストのマスク（プライバシー考慮）
      maskAllInputs: true,           // 入力フィールドをマスク
      blockAllMedia: false,          // メディア要素のブロック
      networkDetailAllowUrls: [      // ネットワークリクエストの詳細を記録するURL
        /^https:\/\/api\.example\.com/,
      ],
      networkRequestHeaders: ['X-Request-Id'], // 記録するリクエストヘッダー
      networkResponseHeaders: ['X-Request-Id'],
    }),

    // ブラウザトレーシング
    Sentry.browserTracingIntegration({
      enableInp: true,               // INP（Interaction to Next Paint）の計測
    }),

    // HTTP クライアントエラーのキャプチャ
    Sentry.httpClientIntegration({
      failedRequestTargets: [/^https:\/\/api\.example\.com/],
    }),
  ],

  // Send error前にフィルタリング
  beforeSend(event, hint) {
    const error = hint.originalException;

    // 特定のエラーを無視
    if (error instanceof Error) {
      // ネットワークエラー（ユーザーがオフラインの場合など）
      if (error.message.includes('Failed to fetch')) {
        return null;
      }
      // ブラウザ拡張機能由来のエラー
      if (error.stack?.includes('chrome-extension://')) {
        return null;
      }
      // ResizeObserver のループエラー（無害）
      if (error.message.includes('ResizeObserver loop')) {
        return null;
      }
    }

    // PIIの除去
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }

    return event;
  },

  // ブレッドクラムの送信前にフィルタリング
  beforeBreadcrumb(breadcrumb) {
    // console.debug のブレッドクラムは除外
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }
    // 特定URLへのXHRは除外（アナリティクスなど）
    if (breadcrumb.category === 'xhr' && breadcrumb.data?.url?.includes('analytics')) {
      return null;
    }
    return breadcrumb;
  },

  // 送信レートの制限
  maxBreadcrumbs: 50,

  // デバッグモード（開発時のみ）
  debug: process.env.NODE_ENV === 'development',

  // 無視するエラーパターン
  ignoreErrors: [
    // ブラウザ拡張機能
    'top.GLOBALS',
    'originalCreateNotification',
    'canvas.contentDocument',
    // Facebook ブラウザ
    'fb_xd_fragment',
    // Chrome の既知のバグ
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // ネットワーク関連
    'Network request failed',
    'Load failed',
    'AbortError',
    'ChunkLoadError',
  ],

  // 無視するURLパターン
  denyUrls: [
    // Chrome 拡張機能
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // Firefox 拡張機能
    /^moz-extension:\/\//i,
    // Safari 拡張機能
    /^safari-extension:\/\//i,
  ],
});
```

```typescript
// sentry.server.config.ts - サーバー側の設定
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,

  tracesSampleRate: 0.1,

  // サーバーサイド固有のインテグレーション
  integrations: [
    // Prisma のクエリ計測
    Sentry.prismaIntegration(),
    // Node.js のプロファイリング
    Sentry.nodeProfilingIntegration(),
  ],

  // サーバーサイドのエラーフィルタリング
  beforeSend(event) {
    // 404 エラーはノイズになるので除外
    if (event.contexts?.response?.status_code === 404) {
      return null;
    }
    return event;
  },

  // プロファイリングのサンプルレート
  profilesSampleRate: 0.1,
});
```

```typescript
// sentry.edge.config.ts - Edge Runtime の設定
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### 2.3 Sentry Configuration in next.config.ts

```typescript
// next.config.ts
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // アプリの設定...
};

export default withSentryConfig(nextConfig, {
  // Sentry Webpack プラグインの設定
  org: 'my-org',
  project: 'my-project',
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // ソースマップの設定
  sourcemaps: {
    assets: '.next/**',              // アップロード対象
    deleteSourcemapsAfterUpload: true, // アップロード後にソースマップを削除
  },

  // リリース設定
  release: {
    name: process.env.SENTRY_RELEASE,
    create: true,
    finalize: true,
    deploy: {
      env: process.env.VERCEL_ENV || 'production',
    },
  },

  // バンドルサイズの最適化
  widenClientFileUpload: true,

  // Tree-shaking による未使用コードの除去
  disableLogger: true,

  // Turbopack 対応
  unstable_sentryWebpackPluginOptions: {
    // Turbopack 使用時の設定
  },

  // トンネリング（広告ブロッカー回避）
  tunnelRoute: '/monitoring-tunnel',

  // ビルド時にSentryが利用不可でもビルドを通す
  silent: !process.env.CI,
  hideSourceMaps: true,
});
```

### 2.4 Custom Error Reporting Patterns

```typescript
// === エラーの分類と送信パターン ===

// 1. ビジネスロジックのエラー
class PaymentError extends Error {
  constructor(
    message: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly provider: string,
    public readonly errorCode: string,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

async function processPayment(order: Order) {
  try {
    const result = await stripe.charges.create({
      amount: order.total,
      currency: 'jpy',
      source: order.paymentToken,
    });
    return result;
  } catch (error) {
    const paymentError = new PaymentError(
      `Payment failed for order ${order.id}`,
      order.id,
      order.total,
      'stripe',
      (error as any).code || 'unknown',
    );

    Sentry.captureException(paymentError, {
      // タグ: フィルタリングとグルーピングに使用
      tags: {
        feature: 'payment',
        provider: 'stripe',
        errorCode: (error as any).code,
      },
      // 追加情報: 調査のためのコンテキスト
      extra: {
        orderId: order.id,
        orderTotal: order.total,
        userId: order.userId,
        stripeError: JSON.stringify(error),
      },
      // フィンガープリント: 同一エラーのグルーピングをカスタマイズ
      fingerprint: ['payment-error', (error as any).code || 'unknown'],
      // レベル: エラーの重要度
      level: 'fatal',
    });

    throw paymentError;
  }
}

// 2. API レスポンスエラー
async function fetchWithMonitoring<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const span = Sentry.startSpan(
    { name: `fetch ${url}`, op: 'http.client' },
    async (span) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          'x-sentry-trace': Sentry.spanToTraceHeader(span),
          'baggage': Sentry.spanToBaggageHeader(span) || '',
        },
      });

      span.setAttributes({
        'http.status_code': response.status,
        'http.url': url,
      });

      if (!response.ok) {
        const body = await response.text();

        Sentry.captureMessage(`API Error: ${response.status} ${url}`, {
          level: response.status >= 500 ? 'error' : 'warning',
          tags: {
            'http.status_code': response.status.toString(),
            'http.url': url,
          },
          extra: {
            responseBody: body.substring(0, 1000), // 最初の1000文字のみ
            requestHeaders: options?.headers,
          },
        });

        throw new ApiError(response.status, body, url);
      }

      return response.json();
    },
  );

  return span as T;
}

// 3. ユーザーコンテキストの管理
function setupSentryUser(user: AuthUser) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
    // ✓ カスタム属性
    ip_address: '{{auto}}', // Sentry が自動取得
    segment: user.plan,     // ユーザーセグメント
  });

  // スコープにタグを追加
  Sentry.setTag('user.plan', user.plan);
  Sentry.setTag('user.role', user.role);

  // ✗ 絶対に含めてはいけない情報
  // Sentry.setUser({ password: '...' });      // パスワード
  // Sentry.setUser({ creditCard: '...' });     // クレジットカード
  // Sentry.setUser({ socialSecurity: '...' }); // マイナンバー等
}

// ログアウト時にユーザーコンテキストをクリア
function clearSentryUser() {
  Sentry.setUser(null);
}

// 4. ブレッドクラム（ユーザー操作の記録）
function trackUserAction(action: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message: action,
    category: 'user-action',
    level: 'info',
    data: {
      ...data,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    },
  });
}

// 使用例
function CheckoutButton() {
  const handleClick = async () => {
    trackUserAction('checkout_started', {
      cartItems: cart.items.length,
      cartTotal: cart.total,
    });

    try {
      trackUserAction('payment_initiated', {
        method: selectedPaymentMethod,
      });
      await processPayment(order);
      trackUserAction('payment_completed', { orderId: order.id });
    } catch (error) {
      trackUserAction('payment_failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  };

  return <button onClick={handleClick}>購入する</button>;
}

// 5. カスタムトランザクションの計測
async function measureCriticalFlow(flowName: string, fn: () => Promise<void>) {
  return Sentry.startSpan(
    {
      name: flowName,
      op: 'function',
      attributes: {
        'flow.name': flowName,
        'flow.timestamp': Date.now(),
      },
    },
    async (span) => {
      try {
        await fn();
        span.setStatus({ code: 1, message: 'ok' });
      } catch (error) {
        span.setStatus({ code: 2, message: 'internal_error' });
        throw error;
      }
    },
  );
}

// 使用例: ユーザー登録フローの計測
await measureCriticalFlow('user-registration', async () => {
  await Sentry.startSpan({ name: 'validate-input', op: 'validation' }, async () => {
    await validateRegistrationForm(formData);
  });

  await Sentry.startSpan({ name: 'create-user', op: 'db.query' }, async () => {
    await createUser(formData);
  });

  await Sentry.startSpan({ name: 'send-welcome-email', op: 'email' }, async () => {
    await sendWelcomeEmail(formData.email);
  });
});
```

### 2.5 Sentry Best Practices and Anti-Patterns

```typescript
// ✓ ベストプラクティス

// 1. 環境ごとにサンプルレートを調整
const SAMPLE_RATES = {
  development: { traces: 1.0, replays: 0, errors: 1.0 },
  staging:     { traces: 0.5, replays: 0.1, errors: 1.0 },
  production:  { traces: 0.1, replays: 0.01, errors: 1.0 },
} as const;

// 2. リリースバージョンを必ず設定（デプロイとの関連付け）
// CI/CD で環境変数として渡す
// SENTRY_RELEASE=$(git rev-parse --short HEAD)

// 3. ソースマップは必ずアップロード＆削除
// デプロイ後にソースマップを公開しない（セキュリティ）

// 4. 有意味なフィンガープリントでグルーピング
Sentry.captureException(error, {
  fingerprint: ['{{ default }}', userId], // デフォルト + ユーザーID
});

// 5. コンテキスト情報を適切に付与
Sentry.setContext('shopping_cart', {
  itemCount: cart.items.length,
  totalAmount: cart.total,
  currency: 'JPY',
});


// ✗ アンチパターン

// 1. 全てのエラーをキャプチャしようとする
// → ノイズが増えて本当に重要なエラーが埋もれる
try {
  doSomething();
} catch (e) {
  Sentry.captureException(e); // ✗ 意図的なエラー（入力バリデーション等）まで送らない
}

// 2. 機密情報をそのまま送信
Sentry.captureException(error, {
  extra: {
    creditCardNumber: '4242...', // ✗ 絶対にNG
    password: 'secret',          // ✗ 絶対にNG
    apiKey: process.env.API_KEY, // ✗ 絶対にNG
  },
});

// 3. サンプルレートを100%にして本番運用
Sentry.init({
  tracesSampleRate: 1.0, // ✗ 本番では高すぎる。コストとパフォーマンスに影響
});

// 4. エラーを握りつぶす
try {
  await processOrder();
} catch (e) {
  Sentry.captureException(e);
  // ✗ ユーザーに何も表示しない
  // ✗ エラーをre-throwしない
}

// 5. ソースマップを本番環境で公開
// next.config.ts で productionBrowserSourceMaps: true は避ける
// → Sentry にアップロードして、公開サーバーからは削除する
```

---

## 3. Error Boundaries

### 3.1 Error Handling System in Next.js App Router

```
Next.js App Router のエラーハンドリング階層:

  layout.tsx
  ├── loading.tsx        ← Suspense のフォールバック
  ├── error.tsx          ← セグメント単位のエラーバウンダリ
  ├── not-found.tsx      ← 404 エラー
  └── page.tsx

  global-error.tsx       ← ルートレイアウトのエラー（最終防衛線）

  エラーのバブルアップ:
  page.tsx → error.tsx → 親の error.tsx → ... → global-error.tsx
```

### 3.2 Segment-Level Error Boundaries

```typescript
// app/dashboard/error.tsx - ダッシュボード専用のエラーバウンダリ
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorBoundaryProps) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    // Sentry にエラーを送信
    const id = Sentry.captureException(error, {
      tags: { section: 'dashboard' },
      extra: {
        digest: error.digest,
        componentStack: (error as any).componentStack,
      },
    });
    setEventId(id);
  }, [error]);

  const handleUserFeedback = async () => {
    if (!eventId) return;

    // Sentry のユーザーフィードバックダイアログを表示
    Sentry.showReportDialog({
      eventId,
      title: 'エラーが発生しました',
      subtitle: 'ご不便をおかけして申し訳ございません。',
      subtitle2: '何が起きたか教えていただけると、改善に役立ちます。',
      labelName: 'お名前',
      labelEmail: 'メールアドレス',
      labelComments: '何が起きましたか？',
      labelSubmit: '送信',
      labelClose: '閉じる',
      successMessage: 'フィードバックありがとうございます！',
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center mb-4">
          <svg className="w-6 h-6 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-lg font-bold text-red-800">
            ダッシュボードの読み込みに失敗しました
          </h2>
        </div>

        <p className="text-gray-600 mb-4">
          一時的なエラーが発生しました。再試行しても解決しない場合は、
          サポートまでお問い合わせください。
        </p>

        {/* エラーの種類に応じたメッセージ */}
        {error.message.includes('fetch') && (
          <p className="text-sm text-gray-500 mb-4">
            ネットワーク接続を確認してから再試行してください。
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md
                       hover:bg-blue-700 transition-colors"
          >
            再試行
          </button>
          <button
            onClick={handleUserFeedback}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md
                       hover:bg-gray-300 transition-colors"
          >
            問題を報告
          </button>
        </div>

        {/* デバッグ情報（開発環境のみ） */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="text-sm text-gray-500 cursor-pointer">
              デバッグ情報
            </summary>
            <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded overflow-auto max-h-48">
              {error.stack}
            </pre>
          </details>
        )}

        {eventId && (
          <p className="text-xs text-gray-400 mt-3">
            Error ID: {eventId}
          </p>
        )}
      </div>
    </div>
  );
}
```

### 3.3 Global Error Handler

```typescript
// app/global-error.tsx - アプリケーション全体の最終エラーハンドラー
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      level: 'fatal',
      tags: { boundary: 'global' },
    });
  }, [error]);

  return (
    <html lang="ja">
      <body className="bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8 max-w-lg">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              予期しないエラーが発生しました
            </h1>
            <p className="text-gray-600 mb-6">
              申し訳ございません。アプリケーションで問題が発生しました。
              ページを再読み込みしてください。
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="px-6 py-2 bg-blue-600 text-white rounded-md
                           hover:bg-blue-700 transition-colors"
              >
                再試行
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md
                           hover:bg-gray-300 transition-colors"
              >
                トップページへ
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
```

### 3.4 Custom React Error Boundary

```typescript
// components/ErrorBoundary.tsx - 再利用可能なエラーバウンダリ
'use client';

import * as Sentry from '@sentry/nextjs';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  section?: string;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Sentry に送信
    Sentry.withScope((scope) => {
      scope.setTag('section', this.props.section || 'unknown');
      scope.setExtra('componentStack', errorInfo.componentStack);
      Sentry.captureException(error);
    });

    // カスタムコールバック
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // カスタムフォールバックが関数の場合
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset);
      }

      // カスタムフォールバックが ReactNode の場合
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトのフォールバック
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <h3 className="font-bold text-red-800">コンポーネントエラー</h3>
          <p className="text-sm text-gray-600 mt-1">
            このセクションの読み込みに失敗しました。
          </p>
          <button
            onClick={this.reset}
            className="mt-2 px-3 py-1 text-sm bg-red-600 text-white rounded"
          >
            再試行
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 使用例
function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 各ウィジェットを個別のエラーバウンダリで囲む */}
      <ErrorBoundary section="sales-chart" fallback={<ChartSkeleton />}>
        <SalesChart />
      </ErrorBoundary>

      <ErrorBoundary section="user-table" fallback={<TableSkeleton />}>
        <UserTable />
      </ErrorBoundary>

      <ErrorBoundary
        section="notifications"
        fallback={(error, reset) => (
          <div className="p-4">
            <p>通知の読み込みに失敗しました</p>
            <button onClick={reset}>再試行</button>
          </div>
        )}
      >
        <NotificationList />
      </ErrorBoundary>
    </div>
  );
}
```

### 3.5 Error Handling in API Routes

```typescript
// lib/api-error-handler.ts - API ルート用のエラーハンドラー
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

// Custom errorクラス
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` (${id})` : ''} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// API ルートのラッパー関数
type ApiHandler = (req: NextRequest, context?: any) => Promise<NextResponse>;

export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      // 既知のアプリケーションエラー
      if (error instanceof AppError) {
        if (!error.isOperational) {
          // プログラミングエラー（予期しないエラー）
          Sentry.captureException(error, {
            level: 'fatal',
            tags: {
              'api.path': req.nextUrl.pathname,
              'api.method': req.method,
              'error.code': error.code,
            },
          });
        }

        return NextResponse.json(
          {
            error: {
              message: error.message,
              code: error.code,
              ...(error instanceof ValidationError && { fields: error.fields }),
            },
          },
          { status: error.statusCode },
        );
      }

      // 未知のエラー
      Sentry.captureException(error, {
        level: 'error',
        tags: {
          'api.path': req.nextUrl.pathname,
          'api.method': req.method,
        },
        extra: {
          requestBody: await req.text().catch(() => 'Unable to read body'),
        },
      });

      return NextResponse.json(
        {
          error: {
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
          },
        },
        { status: 500 },
      );
    }
  };
}

// 使用例: app/api/orders/[id]/route.ts
export const GET = withErrorHandling(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  const order = await prisma.order.findUnique({ where: { id } });

  if (!order) {
    throw new NotFoundError('Order', id);
  }

  if (order.userId !== session.user.id) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  return NextResponse.json(order);
});
```

---

## 4. Web Vitals Measurement

### 4.1 Core Web Vitals Details

```
Core Web Vitals（2024年更新版）:

  ┌─────────────────────────────────────────────────────┐
  │                    Core Web Vitals                  │
  │                                                     │
  │  LCP (Largest Contentful Paint)                     │
  │  ├── 意味: 最大コンテンツの描画時間                  │
  │  ├── Good: ≤ 2.5秒                                 │
  │  ├── Needs Improvement: 2.5秒 〜 4.0秒             │
  │  └── Poor: > 4.0秒                                 │
  │                                                     │
  │  INP (Interaction to Next Paint) ← FIDの後継        │
  │  ├── 意味: ユーザー操作から次の描画までの時間        │
  │  ├── Good: ≤ 200ms                                 │
  │  ├── Needs Improvement: 200ms 〜 500ms             │
  │  └── Poor: > 500ms                                 │
  │                                                     │
  │  CLS (Cumulative Layout Shift)                      │
  │  ├── 意味: 予期しないレイアウトのずれの累積          │
  │  ├── Good: ≤ 0.1                                   │
  │  ├── Needs Improvement: 0.1 〜 0.25                │
  │  └── Poor: > 0.25                                  │
  └─────────────────────────────────────────────────────┘

  補助指標:
  ┌─────────────────────────────────────────────────────┐
  │  FCP (First Contentful Paint)                       │
  │  ├── 意味: 最初のコンテンツ描画時間                  │
  │  └── 目標: ≤ 1.8秒                                 │
  │                                                     │
  │  TTFB (Time to First Byte)                          │
  │  ├── 意味: 最初のバイト受信までの時間                │
  │  └── 目標: ≤ 800ms                                 │
  └─────────────────────────────────────────────────────┘
```

### 4.2 Web Vitals Measurement Implementation

```typescript
// lib/web-vitals.ts - 包括的なWeb Vitals計測

import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from 'web-vitals';

// メトリクスの型定義
interface WebVitalsPayload {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
  // カスタム属性
  connectionType?: string;
  deviceMemory?: number;
  userAgent: string;
  page: string;
}

// デバイス情報の取得
function getDeviceInfo(): Partial<WebVitalsPayload> {
  const nav = navigator as any;
  return {
    connectionType: nav.connection?.effectiveType || 'unknown',
    deviceMemory: nav.deviceMemory || 0,
    userAgent: navigator.userAgent,
  };
}

// メトリクスの送信
function sendMetric(metric: Metric) {
  const payload: WebVitalsPayload = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType || 'unknown',
    url: window.location.href,
    timestamp: Date.now(),
    page: window.location.pathname,
    ...getDeviceInfo(),
  };

  // Beacon API で送信（ページ離脱時も確実に送信）
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/web-vitals', JSON.stringify(payload));
  } else {
    // フォールバック
    fetch('/api/web-vitals', {
      method: 'POST',
      body: JSON.stringify(payload),
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // 送信失敗は無視（ユーザー体験に影響しない）
    });
  }

  // 開発環境ではコンソールにも出力
  if (process.env.NODE_ENV === 'development') {
    const color = metric.rating === 'good' ? 'green'
      : metric.rating === 'needs-improvement' ? 'orange' : 'red';

    console.log(
      `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      `color: ${color}; font-weight: bold;`,
    );
  }
}

// 計測の初期化
export function initWebVitals() {
  // Core Web Vitals
  onLCP(sendMetric);
  onINP(sendMetric);
  onCLS(sendMetric);

  // 補助指標
  onFCP(sendMetric);
  onTTFB(sendMetric);
}
```

### 4.3 Web Vitals Integration in Next.js App Router

```typescript
// app/components/WebVitalsReporter.tsx
'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { usePathname } from 'next/navigation';

export function WebVitalsReporter() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    // Google Analytics 4 に送信
    if (typeof window.gtag === 'function') {
      window.gtag('event', metric.name, {
        value: Math.round(
          metric.name === 'CLS' ? metric.value * 1000 : metric.value,
        ),
        event_label: metric.id,
        metric_rating: metric.rating,
        metric_delta: metric.delta,
        non_interaction: true,
      });
    }

    // Sentry にパフォーマンスデータとして送信
    if (metric.rating === 'poor') {
      // パフォーマンスが悪い場合のみ Sentry に通知
      Sentry.captureMessage(`Poor Web Vital: ${metric.name}`, {
        level: 'warning',
        tags: {
          'web_vital.name': metric.name,
          'web_vital.rating': metric.rating,
          page: pathname,
        },
        extra: {
          value: metric.value,
          delta: metric.delta,
          navigationType: metric.navigationType,
        },
      });
    }

    // Vercel Analytics
    if (typeof window.va === 'function') {
      window.va('event', {
        name: 'web-vitals',
        data: {
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
          path: pathname,
        },
      });
    }
  });

  return null;
}

// app/layout.tsx での使用
import { WebVitalsReporter } from './components/WebVitalsReporter';

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
```

### 4.4 Web Vitals API Endpoint

```typescript
// app/api/web-vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface WebVitalsData {
  name: string;
  value: number;
  rating: string;
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
  page: string;
  connectionType?: string;
  deviceMemory?: number;
  userAgent: string;
}

// インメモリバッファ（バッチ送信用）
let metricsBuffer: WebVitalsData[] = [];
const FLUSH_INTERVAL = 60_000; // 1分ごとにフラッシュ
const MAX_BUFFER_SIZE = 1000;

// 定期的なフラッシュ
setInterval(async () => {
  if (metricsBuffer.length > 0) {
    await flushMetrics([...metricsBuffer]);
    metricsBuffer = [];
  }
}, FLUSH_INTERVAL);

async function flushMetrics(metrics: WebVitalsData[]) {
  try {
    // BigQuery、ClickHouse、TimescaleDB 等に送信
    await fetch(process.env.METRICS_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics }),
    });
  } catch (error) {
    console.error('Failed to flush metrics:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const data: WebVitalsData = await req.json();

    // バリデーション
    if (!data.name || typeof data.value !== 'number') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // バッファに追加
    metricsBuffer.push(data);

    // バッファが満杯の場合は即座にフラッシュ
    if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
      const toFlush = [...metricsBuffer];
      metricsBuffer = [];
      await flushMetrics(toFlush);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 4.5 Web Vitals Improvement Guide

```typescript
/**
 * Web Vitals 改善チェックリスト
 */

// === LCP（Largest Contentful Paint）の改善 ===

// 1. 画像の最適化
// ✓ next/image を使用
import Image from 'next/image';
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority              // LCP対象画像には priority を設定
  sizes="100vw"
  placeholder="blur"    // ぼかしプレースホルダー
  blurDataURL="..."
/>

// 2. フォントの最適化
// ✓ next/font でフォントを事前読み込み
import { Inter } from 'next/font/google';
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',       // テキストをすぐ表示
  preload: true,
});

// 3. クリティカルCSSのインライン化
// Next.js は自動的にクリティカルCSSをインライン化する

// 4. サーバーサイドレンダリング
// App Router のデフォルトはサーバーコンポーネント
// → LCP に有利


// === INP（Interaction to Next Paint）の改善 ===

// 1. 重い処理を Web Worker に移動
// workers/heavy-computation.ts
self.onmessage = (event) => {
  const result = heavyComputation(event.data);
  self.postMessage(result);
};

// 使用側
const worker = new Worker(new URL('./workers/heavy-computation.ts', import.meta.url));
worker.onmessage = (event) => {
  setResult(event.data);
};
worker.postMessage(inputData);

// 2. startTransition でUIをブロックしない
import { startTransition } from 'react';

function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = (value: string) => {
    setQuery(value); // 高優先度: 入力フィールドの更新
    startTransition(() => {
      setResults(search(value)); // 低優先度: 検索結果の更新
    });
  };

  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} value={query} />
      <SearchResults results={results} />
    </div>
  );
}

// 3. useDeferredValue で描画を遅延
import { useDeferredValue } from 'react';

function List({ items }: { items: Item[] }) {
  const deferredItems = useDeferredValue(items);
  return (
    <ul>
      {deferredItems.map(item => <ListItem key={item.id} item={item} />)}
    </ul>
  );
}


// === CLS（Cumulative Layout Shift）の改善 ===

// 1. 画像・動画にサイズを明示
<Image src="/photo.jpg" width={800} height={600} alt="Photo" />

// 2. 動的コンテンツのスペースを事前確保
function AdSlot() {
  return (
    <div style={{ minHeight: '250px', minWidth: '300px' }}>
      {/* 広告が読み込まれるまでスペースを確保 */}
      <Ad />
    </div>
  );
}

// 3. フォントの FOUT/FOIT を回避
// next/font の display: 'swap' を使用

// 4. スケルトンスクリーンの活用
function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-48 bg-gray-200 rounded-lg" />
      <div className="mt-4 h-4 bg-gray-200 rounded w-3/4" />
      <div className="mt-2 h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );
}
```

---

## 5. Logging Strategy

### 5.1 Structured Logging Design Principles

Logs are the most important information source for incident investigation. Using structured logs (JSON format) instead of unstructured string logs makes searching, aggregation, and analysis much easier.

```
ログ設計の原則:

  ┌────────────────────────────────────────────────────────┐
  │  構造化ログの要素                                       │
  │                                                         │
  │  1. タイムスタンプ   → ISO 8601形式（UTC）              │
  │  2. ログレベル       → debug / info / warn / error      │
  │  3. メッセージ       → 何が起きたかの要約               │
  │  4. コンテキスト     → リクエストID、ユーザーID等       │
  │  5. メタデータ       → 追加の調査情報                   │
  │  6. ソース情報       → ファイル名、行番号、関数名       │
  └────────────────────────────────────────────────────────┘

  ログレベルの使い分け:
  ┌──────────┬──────────────────────────────────────────┐
  │ レベル   │ 用途                                      │
  ├──────────┼──────────────────────────────────────────┤
  │ debug    │ 開発時のデバッグ情報（本番では出力しない） │
  │ info     │ 正常な処理の記録（ユーザー登録、注文確定） │
  │ warn     │ 異常だが継続可能（リトライ成功、非推奨API）│
  │ error    │ エラーだが部分的に影響（API失敗、DB接続断） │
  │ fatal    │ アプリケーション全体に影響（起動失敗）     │
  └──────────┴──────────────────────────────────────────┘
```

### 5.2 Frontend Logger Implementation

```typescript
// lib/logger.ts - 本格的なフロントエンドロガー

import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  source?: {
    file?: string;
    function?: string;
  };
  // リクエストのトレーシング
  traceId?: string;
  spanId?: string;
  // ユーザー情報（匿名化済み）
  userId?: string;
  sessionId?: string;
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint: string;
  batchSize: number;
  flushInterval: number;
  sampleRate: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
      enableConsole: process.env.NODE_ENV !== 'production',
      enableRemote: process.env.NODE_ENV === 'production',
      remoteEndpoint: '/api/logs',
      batchSize: 50,
      flushInterval: 10_000, // 10秒ごとにフラッシュ
      sampleRate: 1.0,       // 100%（本番では下げる場合あり）
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      sessionId: this.sessionId,
    };

    if (context) {
      entry.context = this.sanitizeContext(context);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  // 機密情報の除去
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'apiKey', 'api_key',
      'authorization', 'cookie', 'creditCard', 'credit_card',
      'ssn', 'socialSecurity',
    ];

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(context)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private logToConsole(entry: LogEntry) {
    if (!this.config.enableConsole) return;

    const styles = {
      debug: 'color: gray',
      info: 'color: blue',
      warn: 'color: orange',
      error: 'color: red',
      fatal: 'color: red; font-weight: bold; background: yellow',
    };

    const prefix = `%c[${entry.level.toUpperCase()}]`;
    console.log(prefix, styles[entry.level], entry.message, entry.context || '');
  }

  private addToBuffer(entry: LogEntry) {
    if (!this.config.enableRemote) return;
    if (!this.shouldSample()) return;

    this.buffer.push(entry);

    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  private startFlushTimer() {
    if (typeof window === 'undefined') return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    // ページ離脱時にフラッシュ
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // ページ非表示時にフラッシュ
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          this.config.remoteEndpoint,
          JSON.stringify({ entries }),
        );
      } else {
        await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
          keepalive: true,
        });
      }
    } catch (error) {
      // ログ送信の失敗はコンソールに出力するのみ
      console.warn('Failed to send logs:', error);
      // バッファに戻す（最大サイズを超えない範囲で）
      if (this.buffer.length + entries.length <= this.config.batchSize * 2) {
        this.buffer.unshift(...entries);
      }
    }
  }

  // === 公開メソッド ===

  debug(message: string, context?: Record<string, any>) {
    if (!this.shouldLog('debug')) return;
    const entry = this.createEntry('debug', message, context);
    this.logToConsole(entry);
    // debug はリモートには送信しない
  }

  info(message: string, context?: Record<string, any>) {
    if (!this.shouldLog('info')) return;
    const entry = this.createEntry('info', message, context);
    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  warn(message: string, context?: Record<string, any>) {
    if (!this.shouldLog('warn')) return;
    const entry = this.createEntry('warn', message, context);
    this.logToConsole(entry);
    this.addToBuffer(entry);
    // Sentry にブレッドクラムとして記録
    Sentry.addBreadcrumb({
      message,
      category: 'logger',
      level: 'warning',
      data: context,
    });
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    if (!this.shouldLog('error')) return;
    const entry = this.createEntry('error', message, context, error);
    this.logToConsole(entry);
    this.addToBuffer(entry);
    // Sentry にエラーとして送信
    if (error) {
      Sentry.captureException(error, {
        extra: { logMessage: message, ...context },
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: context,
      });
    }
  }

  fatal(message: string, error?: Error, context?: Record<string, any>) {
    if (!this.shouldLog('fatal')) return;
    const entry = this.createEntry('fatal', message, context, error);
    this.logToConsole(entry);
    this.addToBuffer(entry);
    // 即座にフラッシュ
    this.flush();
    // Sentry に致命的エラーとして送信
    Sentry.captureException(error ?? new Error(message), {
      level: 'fatal',
      extra: { logMessage: message, ...context },
    });
  }

  // ユーザーIDの設定
  setUserId(userId: string) {
    this.buffer.forEach(entry => {
      entry.userId = userId;
    });
  }

  // クリーンアップ
  destroy() {
    this.flush();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }
}

// シングルトンインスタンス
export const logger = new Logger();

// 使用例
logger.info('User signed in', { userId: 'user_123', method: 'google' });
logger.warn('Rate limit approaching', { remaining: 10, limit: 100 });
logger.error('Failed to load dashboard', new Error('Network error'), {
  retryCount: 3,
  lastAttempt: new Date().toISOString(),
});
```

### 5.3 Server-Side Logger (Next.js API Routes / Server Actions)

```typescript
// lib/server-logger.ts - サーバーサイドの構造化ロガー

import { headers } from 'next/headers';
import * as Sentry from '@sentry/nextjs';

interface ServerLogEntry {
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userId?: string;
  ip?: string;
  userAgent?: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class ServerLogger {
  private formatEntry(entry: ServerLogEntry): string {
    // JSON Lines 形式で出力（1行1ログ）
    return JSON.stringify(entry);
  }

  private async getRequestContext(): Promise<Partial<ServerLogEntry>> {
    try {
      const headersList = await headers();
      return {
        requestId: headersList.get('x-request-id') || undefined,
        userAgent: headersList.get('user-agent') || undefined,
        ip: headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      };
    } catch {
      return {};
    }
  }

  async info(message: string, context?: Record<string, any>) {
    const requestContext = await this.getRequestContext();
    const entry: ServerLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...requestContext,
      context,
    };
    console.log(this.formatEntry(entry));
  }

  async warn(message: string, context?: Record<string, any>) {
    const requestContext = await this.getRequestContext();
    const entry: ServerLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      ...requestContext,
      context,
    };
    console.warn(this.formatEntry(entry));
  }

  async error(message: string, error?: Error, context?: Record<string, any>) {
    const requestContext = await this.getRequestContext();
    const entry: ServerLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      ...requestContext,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
    console.error(this.formatEntry(entry));
  }

  // リクエストのタイミング計測
  startTimer(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
  }
}

export const serverLogger = new ServerLogger();

// 使用例: API Route でのロギング
// app/api/orders/route.ts
import { serverLogger } from '@/lib/server-logger';

export async function POST(req: NextRequest) {
  const timer = serverLogger.startTimer();

  try {
    const body = await req.json();
    await serverLogger.info('Order creation started', {
      userId: body.userId,
      itemCount: body.items.length,
    });

    const order = await createOrder(body);

    const duration = timer();
    await serverLogger.info('Order created successfully', {
      orderId: order.id,
      duration,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    const duration = timer();
    await serverLogger.error('Order creation failed', error as Error, {
      duration,
    });
    throw error;
  }
}
```

### 5.4 Log Aggregation and Analysis Infrastructure

```typescript
// app/api/logs/route.ts - ログ収集エンドポイント

import { NextRequest, NextResponse } from 'next/server';

// ログの転送先の設定
const LOG_DESTINATIONS = {
  // Datadog Logs
  datadog: {
    enabled: !!process.env.DATADOG_API_KEY,
    endpoint: 'https://http-intake.logs.datadoghq.com/api/v2/logs',
    apiKey: process.env.DATADOG_API_KEY,
  },
  // Axiom（コスト効率の良い代替）
  axiom: {
    enabled: !!process.env.AXIOM_TOKEN,
    endpoint: `https://api.axiom.co/v1/datasets/${process.env.AXIOM_DATASET}/ingest`,
    token: process.env.AXIOM_TOKEN,
  },
  // Loki（Grafana スタック）
  loki: {
    enabled: !!process.env.LOKI_ENDPOINT,
    endpoint: process.env.LOKI_ENDPOINT,
  },
};

export async function POST(req: NextRequest) {
  try {
    const { entries } = await req.json();

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Invalid entries' }, { status: 400 });
    }

    // 並列で各転送先に送信
    const promises: Promise<void>[] = [];

    if (LOG_DESTINATIONS.datadog.enabled) {
      promises.push(sendToDatadog(entries));
    }

    if (LOG_DESTINATIONS.axiom.enabled) {
      promises.push(sendToAxiom(entries));
    }

    await Promise.allSettled(promises);

    return NextResponse.json({ status: 'ok', count: entries.length });
  } catch (error) {
    console.error('Log ingestion failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function sendToDatadog(entries: any[]) {
  const config = LOG_DESTINATIONS.datadog;
  const datadogLogs = entries.map(entry => ({
    ddsource: 'browser',
    ddtags: `env:${process.env.NODE_ENV},service:my-app`,
    hostname: 'browser',
    message: entry.message,
    status: entry.level,
    ...entry,
  }));

  await fetch(config.endpoint!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': config.apiKey!,
    },
    body: JSON.stringify(datadogLogs),
  });
}

async function sendToAxiom(entries: any[]) {
  const config = LOG_DESTINATIONS.axiom;

  await fetch(config.endpoint!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
    },
    body: JSON.stringify(entries),
  });
}
```

### 5.5 Logging Best Practices and Anti-Patterns

```typescript
// ✓ ログのベストプラクティス

// 1. コンテキスト情報を含める
logger.info('Order placed', {
  orderId: 'order_abc123',
  userId: 'user_456',
  total: 9800,
  itemCount: 3,
  paymentMethod: 'credit_card',
});

// 2. エラーにはスタックトレースを含める
logger.error('Database query failed', dbError, {
  query: 'SELECT * FROM users WHERE id = ?',
  params: ['user_123'],
  duration: 5230, // ms
});

// 3. 一貫した命名規則を使用
// 動詞_名詞 の形式
logger.info('user_signed_in', { method: 'google' });
logger.info('order_created', { orderId: 'abc' });
logger.info('payment_processed', { amount: 1000 });

// 4. 測定可能な値を含める
logger.info('cache_hit', { key: 'user_profile', ttl: 3600, hitRate: 0.85 });

// 5. リクエストIDでログを関連付ける
logger.info('request_started', { requestId: 'req_xyz' });
logger.info('db_query_executed', { requestId: 'req_xyz', duration: 45 });
logger.info('response_sent', { requestId: 'req_xyz', statusCode: 200, duration: 120 });


// ✗ ログのアンチパターン

// 1. 機密情報をログに出力
logger.info('User login', {
  email: 'user@example.com',
  password: 'secret123',     // ✗ 絶対NG
  creditCard: '4242...',      // ✗ 絶対NG
});

// 2. 非構造化なログ
console.log('User ' + userId + ' placed order ' + orderId); // ✗ 検索しにくい

// 3. ログレベルの誤用
logger.error('User not found');     // ✗ これは error ではなく info or warn
logger.info('Database connection failed'); // ✗ これは info ではなく error

// 4. 大量のデバッグログを本番で有効にする
// → パフォーマンスとコストに影響
// → debug レベルは開発環境のみに限定

// 5. ループ内で大量のログを出力
for (const item of items) {
  logger.info('Processing item', { itemId: item.id }); // ✗ 10万件あったら10万行
}
// ✓ 代わりにバッチで記録
logger.info('Processing items batch', {
  count: items.length,
  firstId: items[0]?.id,
  lastId: items[items.length - 1]?.id,
});
```

---

## 6. Alert Design

### 6.1 Defining Alert Priority

```
アラートの優先度と対応フロー:

  ┌─────────────────────────────────────────────────────────────┐
  │  P0（Critical）- 即座に対応（5分以内）                      │
  │                                                             │
  │  条件:                                                      │
  │  → アプリが完全にダウン（5xx率 > 50%）                      │
  │  → 決済処理の失敗率 > 5%                                    │
  │  → 認証システムの障害                                       │
  │  → データ漏洩の可能性                                       │
  │                                                             │
  │  通知先: PagerDuty → Slack → 電話                          │
  │  対応者: オンコールエンジニア + テックリード                  │
  │  SLA: 5分以内に応答、30分以内に緩和策実施                   │
  ├─────────────────────────────────────────────────────────────┤
  │  P1（High）- 1時間以内に対応                                │
  │                                                             │
  │  条件:                                                      │
  │  → エラー率 > 1%（過去5分間）                               │
  │  → レスポンスタイム P99 > 5秒                               │
  │  → 特定機能の5xxエラー急増                                  │
  │  → 外部API連携の障害                                       │
  │                                                             │
  │  通知先: Slack（#alerts-high チャンネル）                    │
  │  対応者: オンコールエンジニア                                │
  │  SLA: 1時間以内に調査開始                                   │
  ├─────────────────────────────────────────────────────────────┤
  │  P2（Medium）- 営業時間内に対応                             │
  │                                                             │
  │  条件:                                                      │
  │  → Web Vitals の劣化（P75が閾値超え）                       │
  │  → 新しいエラーパターンの検出                               │
  │  → 404エラーの急増                                         │
  │  → ディスク使用率 > 80%                                    │
  │                                                             │
  │  通知先: Slack（#alerts-medium チャンネル）+ Email           │
  │  対応者: チームメンバー                                     │
  │  SLA: 次の営業日内に対応                                    │
  ├─────────────────────────────────────────────────────────────┤
  │  P3（Low）- 次回スプリントで検討                            │
  │                                                             │
  │  条件:                                                      │
  │  → 非推奨APIの使用検出                                     │
  │  → 軽微なUIバグ                                            │
  │  → パフォーマンスの緩やかな劣化傾向                         │
  │                                                             │
  │  通知先: Email + Jira チケット自動作成                      │
  │  対応者: チームメンバー（通常優先度）                       │
  └─────────────────────────────────────────────────────────────┘
```

### 6.2 Sentry Alert Rule Configuration

```typescript
// Sentry アラートルールの設定例（Sentry Web UI または API）

// === Issue Alerts（エラー発生時のアラート） ===

/**
 * ルール1: 新しいエラーの検出
 * - トリガー: 新しいイシューが作成されたとき
 * - フィルター: level = error or fatal
 * - アクション: Slack #sentry-alerts に通知
 */
const newIssueAlert = {
  name: 'New Error Detected',
  conditions: [
    { id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition' },
  ],
  filters: [
    {
      id: 'sentry.rules.filters.level.LevelFilter',
      match: 'gte',
      level: 'error',
    },
  ],
  actions: [
    {
      id: 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
      channel: '#sentry-alerts',
      workspace: 'my-workspace',
    },
  ],
};

/**
 * ルール2: 決済エラーの即時通知
 * - トリガー: PaymentError タグのイシュー
 * - アクション: PagerDuty + Slack #alerts-critical
 */
const paymentErrorAlert = {
  name: 'Payment Error - Critical',
  conditions: [
    { id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
      value: 1,
      interval: '5m',
    },
  ],
  filters: [
    {
      id: 'sentry.rules.filters.tagged_event.TaggedEventFilter',
      key: 'feature',
      match: 'eq',
      value: 'payment',
    },
  ],
  actions: [
    {
      id: 'sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction',
      service: 'critical-alerts',
    },
    {
      id: 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
      channel: '#alerts-critical',
    },
  ],
};


// === Metric Alerts（メトリクスベースのアラート） ===

/**
 * ルール3: エラー率の監視
 * - メトリクス: イベント数
 * - 条件: 5分間で100件を超えた場合
 * - アクション: Slack通知
 */
const errorRateAlert = {
  name: 'High Error Rate',
  dataset: 'events',
  aggregate: 'count()',
  query: 'is:unresolved',
  timeWindow: 5,    // 分
  threshold: 100,
  thresholdType: 'above',
  triggers: [
    {
      label: 'Critical',
      threshold: 500,
      actions: [{ type: 'slack', targetIdentifier: '#alerts-critical' }],
    },
    {
      label: 'Warning',
      threshold: 100,
      actions: [{ type: 'slack', targetIdentifier: '#alerts-high' }],
    },
  ],
};

/**
 * ルール4: パフォーマンス劣化の検知
 * - メトリクス: P75 レスポンスタイム
 * - 条件: 4秒を超えた場合
 */
const performanceAlert = {
  name: 'Performance Degradation',
  dataset: 'transactions',
  aggregate: 'p75(transaction.duration)',
  query: 'transaction.op:pageload',
  timeWindow: 10,
  threshold: 4000, // ms
  triggers: [
    {
      label: 'Warning',
      threshold: 4000,
      actions: [{ type: 'slack', targetIdentifier: '#performance-alerts' }],
    },
  ],
};
```

### 6.3 Automating Slack Notifications

```typescript
// lib/slack-notifier.ts - Slack Webhook による通知

interface SlackNotification {
  channel: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  fields?: { title: string; value: string; short?: boolean }[];
  actions?: { text: string; url: string }[];
}

const SEVERITY_COLORS = {
  critical: '#ff0000',
  high: '#ff6600',
  medium: '#ffaa00',
  low: '#36a64f',
};

const SEVERITY_EMOJI = {
  critical: ':rotating_light:',
  high: ':warning:',
  medium: ':large_yellow_circle:',
  low: ':information_source:',
};

async function sendSlackNotification(notification: SlackNotification) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    channel: notification.channel,
    attachments: [
      {
        color: SEVERITY_COLORS[notification.severity],
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${SEVERITY_EMOJI[notification.severity]} [${notification.severity.toUpperCase()}] ${notification.title}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: notification.description,
            },
          },
          ...(notification.fields ? [{
            type: 'section',
            fields: notification.fields.map(field => ({
              type: 'mrkdwn',
              text: `*${field.title}*\n${field.value}`,
            })),
          }] : []),
          ...(notification.actions ? [{
            type: 'actions',
            elements: notification.actions.map(action => ({
              type: 'button',
              text: { type: 'plain_text', text: action.text },
              url: action.url,
            })),
          }] : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time_secs}|${new Date().toISOString()}>`,
              },
            ],
          },
        ],
      },
    ],
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// 使用例: エラー率超過時の通知
await sendSlackNotification({
  channel: '#alerts-critical',
  severity: 'critical',
  title: 'Error Rate Exceeded Threshold',
  description: 'エラー率が閾値（5%）を超えました。直ちに調査が必要です。',
  fields: [
    { title: 'Current Error Rate', value: '8.5%', short: true },
    { title: 'Threshold', value: '5%', short: true },
    { title: 'Affected Service', value: 'Payment API', short: true },
    { title: 'Duration', value: '15 minutes', short: true },
  ],
  actions: [
    { text: 'View in Sentry', url: 'https://sentry.io/issues/' },
    { text: 'View Runbook', url: 'https://wiki.example.com/runbooks/error-rate' },
    { text: 'View Dashboard', url: 'https://grafana.example.com/d/errors' },
  ],
});
```

### 6.4 Incident Response Flow

```
インシデント対応の標準フロー:

  ┌──────────────────────────────────────────────────────────────┐
  │  Phase 1: 検知（Detection）                                  │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  自動検知:                                           │   │
  │  │  - Sentry アラート                                   │   │
  │  │  - メトリクスアラート（Datadog / Grafana）            │   │
  │  │  - 合成監視（Uptime チェック）                       │   │
  │  │                                                      │   │
  │  │  手動検知:                                           │   │
  │  │  - ユーザー報告                                      │   │
  │  │  - カスタマーサポートからの連絡                       │   │
  │  │  - 開発者が気づく                                    │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                         │                                    │
  │                         ▼                                    │
  │  Phase 2: トリアージ（Triage）                               │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  1. 影響範囲の確認                                    │   │
  │  │     - 影響ユーザー数                                  │   │
  │  │     - 影響機能                                        │   │
  │  │     - ビジネスインパクト                               │   │
  │  │                                                      │   │
  │  │  2. 優先度の決定（P0 〜 P3）                          │   │
  │  │                                                      │   │
  │  │  3. インシデントコマンダーの任命                       │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                         │                                    │
  │                         ▼                                    │
  │  Phase 3: 緩和（Mitigation）                                 │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  即座にできること:                                    │   │
  │  │  - ロールバック（前のバージョンに戻す）               │   │
  │  │  - Feature Flag で該当機能を無効化                   │   │
  │  │  - トラフィックの制限                                 │   │
  │  │  - メンテナンスページの表示                            │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                         │                                    │
  │                         ▼                                    │
  │  Phase 4: 修復（Resolution）                                 │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  1. 根本原因の特定                                    │   │
  │  │  2. 修正の実装とテスト                                │   │
  │  │  3. 修正のデプロイ                                    │   │
  │  │  4. 正常性の確認                                      │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                         │                                    │
  │                         ▼                                    │
  │  Phase 5: 振り返り（Post-mortem）                            │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  1. タイムラインの作成                                │   │
  │  │  2. 根本原因の文書化                                  │   │
  │  │  3. 改善アクションの策定                              │   │
  │  │  4. チームへの共有                                    │   │
  │  └──────────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────────────┘
```

### 6.5 Runbook Template

```typescript
/**
 * Runbook: 決済エラー率の急上昇
 *
 * アラート条件: 決済エラー率 > 5%（過去5分間）
 * 優先度: P0（Critical）
 * オンコール: payment-oncall@example.com
 *
 * === 初動対応 ===
 *
 * 1. Sentry でエラーの詳細を確認
 *    URL: https://sentry.io/organizations/my-org/issues/?query=feature:payment
 *    確認項目:
 *    - エラーメッセージとスタックトレース
 *    - 影響ユーザー数
 *    - 発生し始めた時刻
 *
 * 2. Stripe ダッシュボードを確認
 *    URL: https://dashboard.stripe.com/test/events
 *    確認項目:
 *    - Stripe 側で障害が発生していないか
 *    - Webhook の配信状態
 *
 * 3. 最近のデプロイを確認
 *    確認コマンド:
 *    $ git log --oneline -10
 *    $ vercel list --scope my-team
 *    確認項目:
 *    - 決済関連のコード変更があったか
 *    - 新しい依存パッケージの更新があったか
 *
 * === 緩和策 ===
 *
 * A. ロールバック（デプロイが原因の場合）
 *    $ vercel rollback --scope my-team
 *
 * B. Feature Flag で決済を一時停止（外部障害の場合）
 *    管理画面: https://admin.example.com/feature-flags
 *    フラグ名: enable_payment
 *    値: false
 *    ※ メンテナンスバナーを表示する
 *
 * C. 代替決済手段への切り替え
 *    フラグ名: payment_provider
 *    値: 'fallback' (PayPal等)
 *
 * === エスカレーション ===
 *
 * 30分以内に解決しない場合:
 * 1. テックリード: tech-lead@example.com
 * 2. CTO: cto@example.com
 * 3. Stripe サポート: support@stripe.com
 */
```

---

## 7. Synthetic Monitoring

### 7.1 Synthetic Monitoring vs Real User Monitoring

```
┌──────────────────────────────────────────────────────────────────┐
│  監視手法の比較                                                   │
│                                                                   │
│  合成監視（Synthetic Monitoring）                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  概要: 自動化されたスクリプトでサイトを定期的にチェック     │  │
│  │  利点:                                                     │  │
│  │  - 24/7 の可用性監視                                       │  │
│  │  - 一貫した条件での比較が可能                               │  │
│  │  - 問題の早期検知（ユーザーが気づく前に）                   │  │
│  │  - SLAの監視に最適                                         │  │
│  │  欠点:                                                     │  │
│  │  - 実際のユーザー環境を反映しない                           │  │
│  │  - 特定のシナリオしかカバーできない                         │  │
│  │  ツール: Checkly, Uptime Robot, Pingdom, Datadog Synthetics │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  リアルユーザー監視（RUM: Real User Monitoring）                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  概要: 実際のユーザーのブラウザからデータを収集              │  │
│  │  利点:                                                     │  │
│  │  - 実際のユーザー体験を反映                                 │  │
│  │  - デバイス/ネットワーク/地域の多様性をカバー               │  │
│  │  - トラフィックに応じた問題の重要度が分かる                 │  │
│  │  欠点:                                                     │  │
│  │  - トラフィックがないと検知できない                         │  │
│  │  - 深夜帯の問題を検知しにくい                               │  │
│  │  ツール: Sentry, Vercel Analytics, SpeedCurve, web-vitals   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  推奨: 両方を組み合わせて使用する                                │
│  - 合成監視: 可用性とSLAの監視                                   │
│  - RUM: ユーザー体験とパフォーマンスの最適化                     │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Synthetic Monitoring Implementation with Checkly

```typescript
// __checks__/homepage.check.ts - Checkly のブラウザチェック

import { test, expect } from '@playwright/test';

// ホームページの可用性チェック
test('Homepage loads successfully', async ({ page }) => {
  const response = await page.goto('https://www.example.com', {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });

  // ステータスコードの確認
  expect(response?.status()).toBeLessThan(400);

  // 重要な要素の表示確認
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();

  // パフォーマンスの確認
  const performanceTiming = await page.evaluate(() => {
    const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      ttfb: timing.responseStart - timing.requestStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.startTime,
      loadComplete: timing.loadEventEnd - timing.startTime,
    };
  });

  // TTFB は 800ms 以下
  expect(performanceTiming.ttfb).toBeLessThan(800);
  // ページ読み込みは 5秒以下
  expect(performanceTiming.loadComplete).toBeLessThan(5000);
});

// ログインフローのチェック
test('Login flow works', async ({ page }) => {
  await page.goto('https://www.example.com/login');

  // ログインフォームの入力
  await page.fill('input[name="email"]', process.env.TEST_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD!);
  await page.click('button[type="submit"]');

  // ダッシュボードへのリダイレクトを確認
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
  await expect(page.locator('h1')).toContainText('Dashboard');
});

// API ヘルスチェック
test('API health check', async ({ request }) => {
  const response = await request.get('https://api.example.com/health');

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe('healthy');
  expect(body.database).toBe('connected');
  expect(body.cache).toBe('connected');
});
```

### 7.3 Uptime Monitoring Implementation

```typescript
// lib/health-check.ts - ヘルスチェックエンドポイント

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: ComponentHealth;
    cache: ComponentHealth;
    externalApis: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number; // ms
  message?: string;
}

async function checkDatabase(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latency: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Math.round(performance.now() - start),
      message: (error as Error).message,
    };
  }
}

async function checkCache(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    // Redis の場合
    // await redis.ping();
    return {
      status: 'up',
      latency: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Math.round(performance.now() - start),
      message: (error as Error).message,
    };
  }
}

async function checkExternalApis(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    const response = await fetch('https://api.stripe.com/v1', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    return {
      status: response.ok ? 'up' : 'degraded',
      latency: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Math.round(performance.now() - start),
      message: (error as Error).message,
    };
  }
}

// app/api/health/route.ts
export async function GET() {
  const [database, cache, externalApis] = await Promise.all([
    checkDatabase(),
    checkCache(),
    checkExternalApis(),
  ]);

  const checks = { database, cache, externalApis };

  // 全体のステータスを判定
  const allUp = Object.values(checks).every(c => c.status === 'up');
  const anyDown = Object.values(checks).some(c => c.status === 'down');

  const health: HealthStatus = {
    status: anyDown ? 'unhealthy' : allUp ? 'healthy' : 'degraded',
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusCode = health.status === 'healthy' ? 200
    : health.status === 'degraded' ? 200  // 200を返すが status で判断
    : 503;

  return NextResponse.json(health, { status: statusCode });
}
```

---

## 8. Custom Metrics Design and Visualization

### 8.1 Business Metrics Measurement

Measuring metrics that directly relate to business — not just technical metrics — gives you a more accurate picture of service health.

```typescript
// lib/metrics.ts - カスタムメトリクスの収集

interface MetricEvent {
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: number;
}

class MetricsCollector {
  private buffer: MetricEvent[] = [];
  private readonly flushInterval = 30_000; // 30秒
  private readonly maxBufferSize = 200;

  constructor() {
    if (typeof window !== 'undefined') {
      setInterval(() => this.flush(), this.flushInterval);
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  // カウンター: 累積値（増加のみ）
  increment(name: string, tags: Record<string, string> = {}, value: number = 1) {
    this.record({
      name,
      value,
      unit: 'count',
      tags,
      timestamp: Date.now(),
    });
  }

  // ゲージ: 現在値（増減あり）
  gauge(name: string, value: number, tags: Record<string, string> = {}) {
    this.record({
      name,
      value,
      unit: 'gauge',
      tags,
      timestamp: Date.now(),
    });
  }

  // ヒストグラム: 分布（レイテンシなど）
  histogram(name: string, value: number, unit: string, tags: Record<string, string> = {}) {
    this.record({
      name,
      value,
      unit,
      tags,
      timestamp: Date.now(),
    });
  }

  // タイミング計測
  startTimer(): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      return Math.round(duration);
    };
  }

  private record(event: MetricEvent) {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics', JSON.stringify({ events }));
      } else {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
          keepalive: true,
        });
      }
    } catch (error) {
      console.warn('Failed to send metrics:', error);
    }
  }
}

export const metrics = new MetricsCollector();

// === ビジネスメトリクスの使用例 ===

// ユーザー登録の計測
function onUserRegistration(user: User) {
  metrics.increment('user.registration', {
    method: user.signupMethod,  // 'google', 'email', 'github'
    plan: user.plan,            // 'free', 'pro', 'enterprise'
    referrer: user.referrer || 'direct',
  });
}

// 購入フローの計測
function onPurchaseStart() {
  const stopTimer = metrics.startTimer();
  return {
    complete: (order: Order) => {
      const duration = stopTimer();
      metrics.histogram('purchase.duration', duration, 'ms', {
        paymentMethod: order.paymentMethod,
      });
      metrics.increment('purchase.completed', {
        paymentMethod: order.paymentMethod,
      });
      metrics.histogram('purchase.amount', order.total, 'jpy', {
        currency: 'JPY',
      });
    },
    abandon: (step: string) => {
      const duration = stopTimer();
      metrics.increment('purchase.abandoned', { step });
      metrics.histogram('purchase.abandon_duration', duration, 'ms', { step });
    },
  };
}

// 検索の計測
function onSearch(query: string, resultCount: number, duration: number) {
  metrics.histogram('search.duration', duration, 'ms');
  metrics.histogram('search.result_count', resultCount, 'count');
  metrics.increment('search.executed', {
    hasResults: resultCount > 0 ? 'true' : 'false',
  });
}

// フィーチャー利用の計測
function onFeatureUsed(featureName: string, userId: string) {
  metrics.increment('feature.used', {
    feature: featureName,
    userSegment: getUserSegment(userId),
  });
}
```

### 8.2 Metrics Collection API Endpoint

```typescript
// app/api/metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';

interface MetricEvent {
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: number;
}

export async function POST(req: NextRequest) {
  try {
    const { events } = await req.json();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Invalid events' }, { status: 400 });
    }

    // Datadog Custom Metrics に送信
    if (process.env.DATADOG_API_KEY) {
      await sendToDatadogMetrics(events);
    }

    // InfluxDB / TimescaleDB に送信
    if (process.env.INFLUXDB_URL) {
      await sendToInfluxDB(events);
    }

    return NextResponse.json({ status: 'ok', count: events.length });
  } catch (error) {
    console.error('Metrics ingestion failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function sendToDatadogMetrics(events: MetricEvent[]) {
  const series = events.map(event => ({
    metric: `app.${event.name}`,
    type: event.unit === 'gauge' ? 1 : event.unit === 'count' ? 3 : 0,
    tags: Object.entries(event.tags).map(([k, v]) => `${k}:${v}`),
  }));

  await fetch('https://api.datadoghq.com/api/v1/series', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': process.env.DATADOG_API_KEY!,
    },
    body: JSON.stringify({ series }),
  });
}

async function sendToInfluxDB(events: MetricEvent[]) {
  // InfluxDB Line Protocol 形式に変換
  const lines = events.map(event => {
    const tags = Object.entries(event.tags)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    const tagStr = tags ? `,${tags}` : '';
    const timestamp = event.timestamp * 1_000_000; // nanoseconds
    return `${event.name}${tagStr} value=${event.value} ${timestamp}`;
  });

  await fetch(`${process.env.INFLUXDB_URL}/api/v2/write?org=${process.env.INFLUXDB_ORG}&bucket=${process.env.INFLUXDB_BUCKET}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.INFLUXDB_TOKEN}`,
      'Content-Type': 'text/plain',
    },
    body: lines.join('\n'),
  });
}
```

### 8.3 Dashboard Design Principles

```
ダッシュボード設計のベストプラクティス:

  ┌──────────────────────────────────────────────────────────────┐
  │  レベル1: エグゼクティブダッシュボード                        │
  │  対象: 経営陣、PM                                            │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  - サービス稼働率（Uptime %）                          │  │
  │  │  - アクティブユーザー数                                 │  │
  │  │  - コンバージョン率                                     │  │
  │  │  - 売上メトリクス                                       │  │
  │  │  - エラー影響ユーザー数                                 │  │
  │  │  更新頻度: リアルタイム ~ 1時間ごと                     │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                               │
  │  レベル2: エンジニアリングダッシュボード                      │
  │  対象: エンジニアチーム                                      │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  - エラー率とトレンド                                   │  │
  │  │  - レスポンスタイム（P50, P75, P95, P99）               │  │
  │  │  - Web Vitals スコア                                    │  │
  │  │  - デプロイ頻度と成功率                                 │  │
  │  │  - インフラメトリクス（CPU, メモリ, ディスク）          │  │
  │  │  更新頻度: リアルタイム ~ 5分ごと                       │  │
  │  └────────────────────────────────────────────────────────┘  │
  │                                                               │
  │  レベル3: オンコールダッシュボード                            │
  │  対象: オンコールエンジニア                                  │
  │  ┌────────────────────────────────────────────────────────┐  │
  │  │  - アクティブアラート一覧                               │  │
  │  │  - 直近のデプロイとロールバック状況                      │  │
  │  │  - 外部サービスのステータス                              │  │
  │  │  - エラーのリアルタイムフィード                          │  │
  │  │  - Runbook へのリンク                                   │  │
  │  │  更新頻度: リアルタイム                                  │  │
  │  └────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────┘
```

---

## 9. Monitoring Tool Comparison and Selection

### 9.1 Comparison Table by Tool Category

| Category | Tool | Features | Est. Price (monthly) | Recommendation |
|---------|--------|------|----------------|-----------|
| **Error Tracking** | Sentry | OSS, source maps, Session Replay | Free–$26/mo | ★★★★★ |
| | Bugsnag | Strong mobile support, stability monitoring | $59+ | ★★★★ |
| | LogRocket | Session replay focused | $99+ | ★★★ |
| | Rollbar | Excellent auto-grouping | $15+ | ★★★ |
| **Performance** | Vercel Analytics | Web Vitals, for Vercel users | Free+ | ★★★★★ |
| | SpeedCurve | Synthetic + RUM, competitor comparison | $10+ | ★★★★ |
| | web-vitals | OSS, self-measured | Free | ★★★★ |
| | Calibre | Performance budget support | $29+ | ★★★ |
| **Log Management** | Datadog | Full-stack monitoring | Usage-based | ★★★★★ |
| | Axiom | Cost-efficient, Vercel integration | Free–$25/mo | ★★★★ |
| | Grafana Loki | OSS, Grafana integration | Free (self-hosted) | ★★★★ |
| | LogDNA (Mezmo) | Simple and easy to use | $1.50/GB | ★★★ |
| **Uptime Monitoring** | Better Uptime | Free tier, status page included | Free–$25/mo | ★★★★★ |
| | Checkly | Playwright-based synthetic monitoring | Free–$30/mo | ★★★★★ |
| | Uptime Robot | Simple, 50 monitors free | Free–$7/mo | ★★★★ |
| | Pingdom | Proven, owned by SolarWinds | $10+ | ★★★ |
| **APM** | Datadog APM | Distributed tracing, rich integrations | Usage-based | ★★★★★ |
| | New Relic | Full-stack, 100GB/mo free | Free–usage-based | ★★★★ |
| | Grafana Tempo | OSS, Grafana integration | Free (self-hosted) | ★★★★ |
| **Status Page** | Statuspage | By Atlassian, industry standard | $29+ | ★★★★ |
| | Instatus | Modern UI, lightweight | Free–$20/mo | ★★★★ |
| | Cachet | OSS, self-hosted | Free | ★★★ |

### 9.2 Recommended Configuration by Project Scale

```
プロジェクト規模別の推奨監視スタック:

  ┌─────────────────────────────────────────────────────────────┐
  │  個人プロジェクト / MVP                                      │
  │  予算: 無料 ~ $20/月                                        │
  │                                                              │
  │  エラー:      Sentry (Free tier: 5,000 events/月)           │
  │  パフォ:      web-vitals + Google Analytics 4               │
  │  Uptime:      Uptime Robot (Free: 50 monitors)              │
  │  ログ:        Vercel ログ or console.log                    │
  │  ステータス:  なし or Instatus (Free)                        │
  ├─────────────────────────────────────────────────────────────┤
  │  スタートアップ / 中規模（~月間100万PV）                     │
  │  予算: $50 ~ $200/月                                        │
  │                                                              │
  │  エラー:      Sentry Team ($26/月)                          │
  │  パフォ:      Vercel Analytics + web-vitals                 │
  │  Uptime:      Checkly or Better Uptime                      │
  │  ログ:        Axiom ($25/月) or Datadog Free                │
  │  アラート:    Sentry Alerts + Slack                         │
  │  ステータス:  Instatus or Better Uptime                     │
  ├─────────────────────────────────────────────────────────────┤
  │  エンタープライズ / 大規模（月間1000万PV~）                  │
  │  予算: $500 ~ $5,000+/月                                    │
  │                                                              │
  │  エラー:      Sentry Business ($80/月~)                     │
  │  パフォ:      Sentry Performance + SpeedCurve               │
  │  Uptime:      Checkly + Datadog Synthetics                  │
  │  ログ:        Datadog Logs or Grafana Loki                  │
  │  APM:         Datadog APM or New Relic                       │
  │  アラート:    PagerDuty + Slack + Sentry                    │
  │  ステータス:  Statuspage (Atlassian)                        │
  │  ダッシュボード: Grafana or Datadog Dashboard               │
  └─────────────────────────────────────────────────────────────┘
```

### 9.3 Standardization with OpenTelemetry

```typescript
// lib/otel.ts - OpenTelemetry の導入

/**
 * OpenTelemetry は、テレメトリデータ（トレース、メトリクス、ログ）の
 * 収集と送信を標準化するオープンソースプロジェクト。
 *
 * 利点:
 * - ベンダーロックインの回避
 * - 統一されたAPIでトレース・メトリクス・ログを扱える
 * - 多数のバックエンド（Datadog, Grafana, Jaeger等）に送信可能
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'my-nextjs-app',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
    'deployment.environment': process.env.NODE_ENV,
  }),

  // トレースのエクスポーター
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces',
    headers: {
      'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`,
    },
  }),

  // メトリクスのエクスポーター
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/metrics',
      headers: {
        'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`,
      },
    }),
    exportIntervalMillis: 60_000, // 1分ごとにエクスポート
  }),

  // 自動インストルメンテーション
  instrumentations: [
    getNodeAutoInstrumentations({
      // HTTP リクエストの自動トレース
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingPaths: ['/api/health', '/favicon.ico'],
      },
      // fetch の自動トレース
      '@opentelemetry/instrumentation-fetch': {
        enabled: true,
      },
    }),
  ],
});

sdk.start();

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry SDK shut down'))
    .catch((error) => console.error('Error shutting down SDK', error))
    .finally(() => process.exit(0));
});

export { sdk };
```

### 9.4 OpenTelemetry Configuration in Next.js instrumentation.ts

```typescript
// instrumentation.ts（Next.js のインストルメンテーションフック）

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // サーバーサイドの OpenTelemetry を初期化
    await import('./lib/otel');
  }
}
```

---

## 10. Troubleshooting Guide

### 10.1 Common Problems and Solutions

```typescript
/**
 * === Sentry 関連のトラブルシューティング ===
 */

// 問題1: ソースマップが正しくマッピングされない
// 原因: ソースマップのアップロードに失敗している
// 解決策:
// 1. SENTRY_AUTH_TOKEN が正しいか確認
// 2. release バージョンが一致しているか確認
// 3. ソースマップのパスが正しいか確認
//
// デバッグコマンド:
// $ npx @sentry/cli sourcemaps explain --org my-org --project my-project --release 1.0.0

// 問題2: Sentry にイベントが送信されない
// チェックリスト:
// 1. DSN が正しく設定されているか
//    console.log(process.env.NEXT_PUBLIC_SENTRY_DSN);
// 2. beforeSend でフィルタされていないか
// 3. ignoreErrors に該当していないか
// 4. allowUrls / denyUrls の設定が正しいか
// 5. ネットワーク上の問題（広告ブロッカー等）

// 問題3: 広告ブロッカーが Sentry をブロックする
// 解決策: tunnelRoute を設定
// next.config.ts
// export default withSentryConfig(nextConfig, {
//   tunnelRoute: '/monitoring-tunnel',
//   // -> /monitoring-tunnel を経由して Sentry に送信
//   // -> 広告ブロッカーにブロックされない
// });

// 問題4: Sentry の初期化でビルドエラーが発生する
// 原因: Edge Runtime で Node.js API を使用している
// 解決策:
// sentry.edge.config.ts でサーバー専用の設定を使わない
// integrations から Node.js 固有のものを除外


/**
 * === Web Vitals 関連のトラブルシューティング ===
 */

// 問題5: LCP が遅い
// 診断手順:
// 1. Chrome DevTools > Performance > Record
// 2. LCP 要素を特定（要素にマーカーが表示される）
// 3. 原因の切り分け:
//    - TTFB が遅い -> サーバーサイドの問題
//    - リソースの読み込みが遅い -> 画像最適化、CDN
//    - レンダリングブロック -> CSS/JS の最適化

// 問題6: CLS が悪い（スコアが 0.1 を超える）
// 診断手順:
// 1. Chrome DevTools > Performance > Record
// 2. Layout Shift をクリックして原因要素を特定
// 3. よくある原因:
//    - 画像にサイズ属性がない
//    - Web フォントの読み込みでテキストがずれる
//    - 動的コンテンツの挿入
//    - 広告やiframeの遅延読み込み

// 問題7: INP が悪い（200ms 以上）
// 診断手順:
// 1. Chrome DevTools > Performance > Record
// 2. ユーザー操作の Interaction を確認
// 3. Long Task がないか確認
// 4. よくある原因:
//    - メインスレッドの長時間ブロック
//    - 大きなリストの再レンダリング
//    - 同期的なstate更新


/**
 * === ロギング関連のトラブルシューティング ===
 */

// 問題8: ログが大量に発生してコストが増大
// 解決策:
// 1. ログレベルを適切に設定（本番は warn 以上）
// 2. サンプリングを導入
// 3. ログのローテーションと保持期間を設定
// 4. 不要なログ（ヘルスチェック等）をフィルタリング

// 問題9: ログからエラーの原因が特定できない
// 解決策:
// 1. 構造化ログを導入（JSON形式）
// 2. リクエストIDを全ログに付与
// 3. コンテキスト情報（userId, orderId等）を含める
// 4. エラーにはスタックトレースを必ず含める


/**
 * === アラート関連のトラブルシューティング ===
 */

// 問題10: アラート疲れ（Alert Fatigue）
// 症状: アラートが多すぎて重要なものが見落とされる
// 解決策:
// 1. アラートの優先度を見直す（P0~P3）
// 2. 重複するアラートを統合
// 3. 自動解決（Auto-resolve）を設定
// 4. アラートのサイレント期間を設定
// 5. 定期的にアラートルールをレビュー

// 問題11: 誤検知（False Positive）が多い
// 解決策:
// 1. 閾値を調整（静的閾値 -> 動的閾値）
// 2. 時間窓を広げる（1分 -> 5分）
// 3. 連続N回超えた場合のみ発報
// 4. 時間帯別の閾値設定（深夜はトラフィックが少ない）
```

### 10.2 Monitoring Maturity Model

```
監視の成熟度モデル（Monitoring Maturity Model）:

  Level 0: 監視なし
  ┌─────────────────────────────────────────┐
  │  - ユーザーからの報告で障害に気づく      │
  │  - ログは console.log のみ               │
  │  - 「動いてるからOK」の精神              │
  └─────────────────────────────────────────┘
      ↓ まずここから
  Level 1: 基本的な監視
  ┌─────────────────────────────────────────┐
  │  - エラートラッキング導入（Sentry）      │
  │  - Uptime 監視の導入                     │
  │  - 基本的なアラート設定                   │
  │  - エラー発生時のSlack通知               │
  └─────────────────────────────────────────┘
      ↓
  Level 2: 構造化された監視
  ┌─────────────────────────────────────────┐
  │  - 構造化ログの導入                      │
  │  - Web Vitals の計測                     │
  │  - アラート優先度の定義                   │
  │  - ダッシュボードの作成                   │
  │  - オンコール体制の確立                   │
  └─────────────────────────────────────────┘
      ↓
  Level 3: プロアクティブな監視
  ┌─────────────────────────────────────────┐
  │  - 合成監視の導入                        │
  │  - カスタムメトリクスの計測               │
  │  - 分散トレーシングの導入                 │
  │  - Runbook の整備                        │
  │  - Post-mortem の文化                    │
  │  - SLO/SLI の定義                        │
  └─────────────────────────────────────────┘
      ↓
  Level 4: オブザーバビリティの完成
  ┌─────────────────────────────────────────┐
  │  - OpenTelemetry による標準化            │
  │  - 異常検知（Anomaly Detection）         │
  │  - 自動修復（Self-healing）              │
  │  - ビジネスメトリクスとの連携             │
  │  - カオスエンジニアリングの実践           │
  │  - フルスタックオブザーバビリティ         │
  └─────────────────────────────────────────┘
```

---

## 11. SLO/SLI Design

### 11.1 Basic Concepts of SLO/SLI/SLA

```
SLA / SLO / SLI の関係:

  SLI (Service Level Indicator):
  -> サービスの品質を測定する指標
  -> 例: 「リクエストの成功率」「レスポンスタイムの P99」

  SLO (Service Level Objective):
  -> SLI に対する目標値
  -> 例: 「成功率 99.9%」「P99 < 500ms」

  SLA (Service Level Agreement):
  -> SLO に基づく顧客との契約
  -> 例: 「月間稼働率 99.9%、違反時は10%のクレジット」

  関係:
  SLI（何を測るか） -> SLO（目標は何か） -> SLA（約束は何か）
```

### 11.2 SLO Configuration Examples

```typescript
// lib/slo.ts - SLO の定義と計測

interface SLO {
  name: string;
  description: string;
  sli: string;
  target: number;        // 例: 0.999 (99.9%)
  window: '7d' | '28d' | '30d' | '90d';
  errorBudget: number;   // 例: 0.001 (0.1%)
}

const SLO_DEFINITIONS: SLO[] = [
  {
    name: 'Availability',
    description: 'サービスの可用性（5xx 以外のレスポンス率）',
    sli: 'successful_requests / total_requests',
    target: 0.999,       // 99.9%
    window: '30d',
    errorBudget: 0.001,  // 0.1%（月間約43分のダウンタイム許容）
  },
  {
    name: 'Latency',
    description: 'レスポンスタイムが500ms以内のリクエスト率',
    sli: 'requests_under_500ms / total_requests',
    target: 0.99,        // 99%
    window: '30d',
    errorBudget: 0.01,   // 1%
  },
  {
    name: 'Error Rate',
    description: 'エラーが発生しないリクエストの率',
    sli: '1 - (error_requests / total_requests)',
    target: 0.995,       // 99.5%
    window: '7d',
    errorBudget: 0.005,  // 0.5%
  },
];

// エラーバジェットの計算
function calculateErrorBudget(slo: SLO, currentSLI: number): {
  budgetTotal: number;
  budgetConsumed: number;
  budgetRemaining: number;
  isHealthy: boolean;
} {
  const budgetTotal = 1 - slo.target;   // 許容されるエラーの割合
  const budgetConsumed = 1 - currentSLI; // 実際のエラーの割合
  const budgetRemaining = budgetTotal - budgetConsumed;

  return {
    budgetTotal,
    budgetConsumed,
    budgetRemaining,
    isHealthy: budgetRemaining > 0,
  };
}

// 使用例
const availabilitySLO = SLO_DEFINITIONS[0];
const currentAvailability = 0.9985; // 99.85%

const budget = calculateErrorBudget(availabilitySLO, currentAvailability);
// budget = {
//   budgetTotal: 0.001,      // 0.1% の余裕
//   budgetConsumed: 0.0015,  // 0.15% 消費済み
//   budgetRemaining: -0.0005, // 超過！
//   isHealthy: false,         // SLO 違反
// }

// エラーバジェットが枯渇したら:
// -> 新機能のリリースを停止
// -> 信頼性向上の作業を優先
// -> インシデントの根本原因を調査
```

---

## Summary

| Monitoring Item | Tool | Importance | Implementation Priority |
|---------|--------|--------|-----------|
| Error tracking | Sentry | Critical | Top priority |
| Error boundaries | Next.js error.tsx | Critical | Top priority |
| Web Vitals (RUM) | web-vitals + Vercel Analytics | Important | High |
| Structured logging | Custom logger + Datadog/Axiom | Important | High |
| Alerts | Sentry Alerts + Slack | Important | High |
| Uptime monitoring | Checkly / Better Uptime | Important | High |
| Synthetic monitoring | Checkly (Playwright) | Medium | Medium |
| Custom metrics | Datadog / InfluxDB | Medium | Medium |
| APM / Tracing | Datadog APM / OpenTelemetry | Medium | Medium |
| Status page | Instatus / Statuspage | Low | Low |
| SLO/SLI | Custom implementation | Medium | Medium |

### Monitoring Adoption Roadmap

```
Week 1: 基盤構築
  □ Sentry のセットアップ（クライアント + サーバー）
  □ error.tsx / global-error.tsx の実装
  □ ソースマップのアップロード設定
  □ 基本的な Slack 通知の設定

Week 2: パフォーマンス監視
  □ Web Vitals の計測実装
  □ Vercel Analytics の導入
  □ LCP/INP/CLS の初期ベースラインを記録

Week 3: ログ・アラート
  □ 構造化ロガーの実装
  □ アラート優先度の定義
  □ Runbook のテンプレート作成
  □ オンコール体制の確立

Week 4: 応用
  □ 合成監視の導入
  □ カスタムメトリクスの計測
  □ ダッシュボードの作成
  □ SLO/SLI の定義

継続的改善:
  □ 定期的なアラートルールのレビュー
  □ Post-mortem の実施と改善
  □ 監視カバレッジの拡大
  □ OpenTelemetry への移行検討
```

---

## Frequently Asked Questions (FAQ)

### Q1: Sentry vs Datadog — which should I choose?

**Comparison table:**

| Item | Sentry | Datadog |
|------|--------|---------|
| **Primary use** | Error tracking focused | Full APM and infrastructure monitoring |
| **Price** | $26/mo+ (5k errors) | $15/mo+ (APM) + infrastructure |
| **Error management** | Excellent | Sufficient |
| **Performance monitoring** | Basic tracing | Detailed APM |
| **Infrastructure monitoring** | None | CPU/memory/network |
| **Session Replay** | Feature-rich | Available as RUM |
| **Log management** | None (requires separate service) | Built-in Log Management |
| **Setup** | Easy (SDK only) | Somewhat complex (Agent required) |
| **Learning curve** | Low | Medium–High |

**Selection criteria:**

```
Sentryを選ぶべきケース:
  □ エラートラッキングとSession Replayが最優先
  □ フロントエンド中心のアプリケーション
  □ 低予算でスタート（無料枠が寛容）
  □ すぐに導入したい（SDK追加だけ）

  推奨構成:
  - Sentry（エラー + Session Replay）
  - Vercel Analytics（Web Vitals）
  - Axiom/Better Stack（ログ）

Datadogを選ぶべきケース:
  □ バックエンド含む全体の可観測性が必要
  □ インフラレベルの監視も一元管理したい
  □ カスタムメトリクス・ダッシュボードを多用
  □ エンタープライズレベルのSLA・サポート

  推奨構成:
  - Datadog（APM + Infrastructure + Logs + RUM）
  - 全てを一つのプラットフォームで統合
```

**Combined usage pattern:**

```typescript
// SentryとDatadogの併用例
// Sentry: エラートラッキング
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,  // Performance trace10%
});

// Datadog: APM・メトリクス
import { datadogRum } from '@datadog/browser-rum';
datadogRum.init({
  applicationId: process.env.DD_APP_ID,
  clientToken: process.env.DD_CLIENT_TOKEN,
  site: 'datadoghq.com',
  service: 'my-app',
  env: process.env.NODE_ENV,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
});

// 役割分担: Sentryでエラー詳細、Datadogで全体パフォーマンス
```

### Q2: How should error boundaries be designed?

**Hierarchical error boundary design:**

```
app/
├── global-error.tsx          # 最上位（アプリ全体のクラッシュ）
├── error.tsx                 # ルート直下（予期しないエラー）
├── (dashboard)/
│   ├── error.tsx             # Dashboard全体
│   └── analytics/
│       └── error.tsx         # 分析画面固有のエラー
└── (auth)/
    ├── error.tsx             # 認証関連エラー
    └── login/
        └── error.tsx         # ログイン固有のエラー
```

**Implementation example (Next.js App Router):**

```typescript
// app/error.tsx - 標準的なエラーバウンダリ
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentryにエラーを送信
    Sentry.captureException(error, {
      tags: {
        boundary: 'root-error',
      },
      contexts: {
        react: {
          componentStack: error.stack,
        },
      },
    });
  }, [error]);

  return (
    <div className="error-container">
      <h2>問題が発生しました</h2>
      <p>エラーが記録されました。しばらく待ってからもう一度お試しください。</p>
      <button onClick={reset}>再試行</button>
      {process.env.NODE_ENV === 'development' && (
        <details>
          <summary>エラー詳細（開発環境のみ）</summary>
          <pre>{error.message}</pre>
          <pre>{error.stack}</pre>
        </details>
      )}
    </div>
  );
}
```

**Component-level error boundary:**

```typescript
// components/ErrorBoundary.tsx - 再利用可能なエラーバウンダリ
import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } },
    });
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <p>このコンポーネントの読み込みに失敗しました。</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// 使い方
<ErrorBoundary fallback={<ChartErrorFallback />}>
  <HeavyChart data={data} />
</ErrorBoundary>
```

**Error boundary best practices:**

```
1. 粒度を適切に設計する
   ✓ ページレベル: ページ全体のクラッシュを防ぐ
   ✓ セクションレベル: 重要でない部分の障害を局所化
   ✗ 全コンポーネント: 過剰な粒度は管理が複雑

2. ユーザー体験を優先する
   ✓ わかりやすいエラーメッセージ
   ✓ 「再試行」ボタンの提供
   ✓ 代替コンテンツの表示（Graceful Degradation）

3. エラー情報を確実に収集する
   ✓ Sentryにコンテキスト情報を送信
   ✓ ユーザーID、ページURL、エラー発生時刻を記録
   ✓ 本番環境ではスタックトレースを表示しない
```

### Q3: How do I decide between RUM (Real User Monitoring) and Synthetic Monitoring?

**Differences between the two monitoring approaches:**

| Item | RUM (Real User Monitoring) | Synthetic Monitoring |
|------|--------------------------|-------------------------------|
| **Data source** | Actual user access | Periodic automated tests |
| **Advantages** | Accurate real-environment data | Early incident detection, stable data |
| **Disadvantages** | Traffic-dependent, may have bias | May diverge from real user experience |
| **Main uses** | Performance optimization, A/B testing | Alerts, SLA monitoring, regression detection |
| **Tool examples** | Vercel Analytics, Datadog RUM | Checkly, Pingdom, UptimeRobot |

**RUM (Real User Monitoring) implementation:**

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />        {/* ページビュー、イベント */}
        <SpeedInsights />    {/* Core Web Vitals */}
      </body>
    </html>
  );
}

// カスタムイベントの計測
import { track } from '@vercel/analytics';

function handleCheckout() {
  track('checkout', {
    amount: cart.total,
    items: cart.items.length
  });
  // ...
}
```

**Synthetic Monitoring implementation (Checkly):**

```typescript
// __checks__/home.check.ts
import { test, expect } from '@playwright/test';

test('Homepage loads successfully', async ({ page }) => {
  const response = await page.goto('https://example.com');
  expect(response?.status()).toBe(200);

  // Core Web Vitalsをチェック
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'LCP') {
            resolve({ lcp: entry.startTime });
          }
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
  });

  expect(metrics.lcp).toBeLessThan(2500); // LCP < 2.5s
});

// 重要なユーザーフローの監視
test('User can complete checkout', async ({ page }) => {
  await page.goto('https://example.com/products');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout-button"]');
  await expect(page).toHaveURL(/.*checkout/);
});
```

**Guidelines for choosing between them:**

```
RUMを優先すべきケース:
  □ パフォーマンス最適化の効果を検証したい
  □ 地域別・デバイス別の実データが必要
  □ A/Bテストの影響を分析したい
  □ 実際のユーザー体験を把握したい

  実装: Vercel Analytics + web-vitals ライブラリ

Synthetic Monitoringを優先すべきケース:
  □ サービスの死活監視（Uptime）
  □ デプロイ後のリグレッション検知
  □ API・バックエンドの監視
  □ SLA準拠の証明が必要

  実装: Checkly + Playwright or Pingdom

理想的な構成（両方を組み合わせる）:
  RUM: ユーザー体験の最適化
    → Vercel Analytics（Core Web Vitals）
    → Datadog RUM（詳細分析）

  Synthetic: 障害の早期検知
    → Checkly（重要なユーザーフロー監視）
    → Better Uptime（死活監視・ステータスページ）
```

---

## Next Guides to Read


---

## References

1. Sentry. "Next.js SDK Documentation." docs.sentry.io, 2024.
2. web.dev. "Measure and optimize performance with web-vitals." web.dev, 2024.
3. Vercel. "Analytics - Web Vitals." vercel.com/docs/analytics, 2024.
4. Google. "Core Web Vitals - Web Vitals." web.dev/articles/vitals, 2024.
5. OpenTelemetry. "Getting Started with OpenTelemetry for JavaScript." opentelemetry.io/docs/languages/js, 2024.
6. Charity Majors, Liz Fong-Jones, George Miranda. "Observability Engineering." O'Reilly Media, 2022.
7. Betsy Beyer et al. "Site Reliability Engineering." O'Reilly Media, 2016.
8. Datadog. "Monitoring 101: Collecting the right data." datadoghq.com/blog, 2024.
9. Checkly. "Monitoring as Code." checklyhq.com/docs, 2024.
10. Google. "Interaction to Next Paint (INP)." web.dev/articles/inp, 2024.
11. Next.js. "Instrumentation." nextjs.org/docs/app/building-your-application/optimizing/instrumentation, 2024.
12. Sentry. "Session Replay." docs.sentry.io/product/session-replay, 2024.
