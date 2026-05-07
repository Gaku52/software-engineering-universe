# Observability

> Master the three pillars of observability — logs, metrics, and traces — and develop the ability to visualize and diagnose the internal state of systems using OpenTelemetry

## What You Will Learn

1. **The Three Pillars of Observability** — The roles of logs, metrics, and distributed traces, and how they relate to each other
2. **Instrumentation with OpenTelemetry** — How to implement vendor-agnostic, unified telemetry collection
3. **Structured Logging and Context Propagation** — Log design and Trace Context propagation that enables debugging in distributed systems
4. **Designing and Operating SLI/SLO/SLA** — Defining user-centric reliability indicators and managing error budgets
5. **Configuring and Operating the OpenTelemetry Collector** — Designing pipelines for collecting, processing, and forwarding telemetry data


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Overview of Observability

```
┌─────────────────────────────────────────────────────────┐
│            オブザーバビリティの3本柱                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │    ログ     │ │  メトリクス   │ │  分散トレース    │  │
│  │  (Logs)     │ │  (Metrics)   │ │  (Traces)       │  │
│  ├─────────────┤ ├──────────────┤ ├─────────────────┤  │
│  │ 何が起きた  │ │ 集計された   │ │ リクエストが    │  │
│  │ かの詳細な  │ │ 数値データ   │ │ どう流れたか    │  │
│  │ イベント記録│ │              │ │                 │  │
│  ├─────────────┤ ├──────────────┤ ├─────────────────┤  │
│  │ デバッグ    │ │ ダッシュボード│ │ ボトルネック    │  │
│  │ 監査証跡    │ │ アラート     │ │ 依存関係の把握  │  │
│  │ エラー追跡  │ │ SLO/SLI     │ │ レイテンシ分析  │  │
│  └─────────────┘ └──────────────┘ └─────────────────┘  │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          ▼                              │
│              ┌────────────────────┐                     │
│              │  OpenTelemetry     │                     │
│              │  (統一収集基盤)     │                     │
│              └────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### The Difference Between Monitoring and Observability

Observability is a concept that encompasses monitoring — which "detects known problems" — and adds the ability to "diagnose unknown problems."

```
モニタリング vs オブザーバビリティ:

  モニタリング (Monitoring)
  ┌──────────────────────────────────────────┐
  │ 「何が壊れたか」を検知する               │
  │                                          │
  │ - CPU使用率が80%を超えた                  │
  │ - エラーレートが閾値を超えた               │
  │ - ディスク容量が残り10%                    │
  │                                          │
  │ 既知の障害パターンに対するアラート         │
  │ 事前に「何を監視するか」を決める必要がある │
  └──────────────────────────────────────────┘

  オブザーバビリティ (Observability)
  ┌──────────────────────────────────────────┐
  │ 「なぜ壊れたか」を診断する               │
  │                                          │
  │ - このリクエストはどのサービスを通った？    │
  │ - なぜ特定ユーザーだけ遅い？              │
  │ - 昨日と今日で何が変わった？              │
  │                                          │
  │ 未知の障害パターンにも対応可能             │
  │ 高カーディナリティデータで自由に探索       │
  │                                          │
  │ ログ + メトリクス + トレースの相関分析     │
  └──────────────────────────────────────────┘
```

### Observability Maturity Model

```
成熟度レベル:

  Level 0: なし
  ┌──────────────────────────────────────┐
  │ - ログはコンソール出力のみ            │
  │ - 障害は「ユーザーからの報告」で検知   │
  │ - ssh してログファイルを grep          │
  └──────────────────────────────────────┘

  Level 1: 基本的なモニタリング
  ┌──────────────────────────────────────┐
  │ - CloudWatch/Datadog でメトリクス収集 │
  │ - 基本的なアラート (CPU, メモリ)      │
  │ - ログ集約 (CloudWatch Logs等)       │
  └──────────────────────────────────────┘

  Level 2: 構造化された可観測性
  ┌──────────────────────────────────────┐
  │ - 構造化ログ (JSON)                  │
  │ - カスタムメトリクス (ビジネスKPI)     │
  │ - 分散トレーシング                    │
  │ - ダッシュボード体系化                 │
  └──────────────────────────────────────┘

  Level 3: SLO ドリブン (目指すべき姿)
  ┌──────────────────────────────────────┐
  │ - SLI/SLO ベースのアラート            │
  │ - エラーバジェットによる意思決定       │
  │ - ログ↔メトリクス↔トレースの相関分析  │
  │ - OpenTelemetry で統一計装            │
  │ - ポストモーテム文化の定着            │
  └──────────────────────────────────────┘
```

---

## 2. Structured Logging

### 2.1 Basic Implementation of Structured Logging

```typescript
// structured-logger.ts — 構造化ログの実装
import { pino } from 'pino';

// 構造化ログの基本設定
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'user-service',
    version: process.env.APP_VERSION ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'development',
  },
  // 本番では JSON、開発では見やすい形式
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// リクエストコンテキスト付きの子ロガー
function createRequestLogger(req: {
  id: string;
  method: string;
  url: string;
  userId?: string;
}) {
  return logger.child({
    requestId: req.id,
    method: req.method,
    url: req.url,
    userId: req.userId,
  });
}

// 使用例
const reqLogger = createRequestLogger({
  id: 'req-abc123',
  method: 'POST',
  url: '/api/orders',
  userId: 'user-456',
});

reqLogger.info({ orderId: 'order-789' }, 'Order created successfully');
// 出力 (JSON):
// {
//   "level": "info",
//   "time": "2025-03-15T10:30:00.000Z",
//   "service": "user-service",
//   "version": "1.2.3",
//   "environment": "production",
//   "requestId": "req-abc123",
//   "method": "POST",
//   "url": "/api/orders",
//   "userId": "user-456",
//   "orderId": "order-789",
//   "msg": "Order created successfully"
// }

reqLogger.error(
  { err: new Error('Payment failed'), orderId: 'order-789' },
  'Failed to process payment'
);
```

### 2.2 Log Level Design Guidelines

```
Log Level Usage Guide:

  ┌─────────┬──────────────────────────────────────────┐
  │ FATAL   │ Process cannot continue. Fatal failure    │
  │         │ that causes immediate shutdown.           │
  │         │ Example: Startup failure due to DB        │
  │         │ connection error                          │
  ├─────────┼──────────────────────────────────────────┤
  │ ERROR   │ Processing failed. Human intervention     │
  │         │ required.                                 │
  │         │ Example: Payment API failure, data        │
  │         │ inconsistency                             │
  ├─────────┼──────────────────────────────────────────┤
  │ WARN    │ Unexpected state but processing can       │
  │         │ continue.                                 │
  │         │ Example: Retry succeeded, fallback used   │
  ├─────────┼──────────────────────────────────────────┤
  │ INFO    │ Normal business events.                   │
  │         │ Example: Order created, user registered,  │
  │         │ deploy completed                          │
  ├─────────┼──────────────────────────────────────────┤
  │ DEBUG   │ Detailed information for development.     │
  │         │ Example: Function calls, variable values, │
  │         │ SQL queries                               │
  ├─────────┼──────────────────────────────────────────┤
  │ TRACE   │ Most detailed debug information.          │
  │         │ Example: Each iteration within a loop     │
  └─────────┴──────────────────────────────────────────┘

  Production: INFO and above
  Staging: DEBUG and above
  Development: TRACE and above

  During incident investigation: Temporarily lower to DEBUG to collect detailed logs
```

### 2.3 Request Logging for Express/Fastify

```typescript
// request-logging-middleware.ts — リクエスト/レスポンスログ
import { Request, Response, NextFunction } from 'express';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'api-gateway' },
});

// センシティブデータのマスキング
function maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const masked = { ...headers };
  const sensitiveKeys = ['authorization', 'cookie', 'x-api-key'];

  for (const key of sensitiveKeys) {
    if (masked[key]) {
      masked[key] = '***REDACTED***';
    }
  }
  return masked;
}

// リクエストログミドルウェア
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // リクエストID の生成/伝播
  const requestId = req.headers['x-request-id'] as string ?? uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  const startTime = process.hrtime.bigint();

  // 子ロガーの作成
  const reqLogger = logger.child({
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  // リクエスト開始ログ
  reqLogger.info(
    { headers: maskSensitiveHeaders(req.headers as Record<string, string>) },
    'Request received'
  );

  // レスポンス完了時のログ
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1_000_000;

    const logData = {
      statusCode: res.statusCode,
      duration: Math.round(durationMs * 100) / 100,
      contentLength: res.getHeader('content-length'),
    };

    if (res.statusCode >= 500) {
      reqLogger.error(logData, 'Request failed (5xx)');
    } else if (res.statusCode >= 400) {
      reqLogger.warn(logData, 'Request failed (4xx)');
    } else {
      reqLogger.info(logData, 'Request completed');
    }
  });

  next();
}
```

### 2.4 Structured Logging in Python (FastAPI)

```python
# structured_logger.py — Python での構造化ログ
import logging
import json
import sys
import uuid
from datetime import datetime, timezone
from contextvars import ContextVar
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time

# コンテキスト変数でリクエストIDを伝播
request_id_var: ContextVar[str] = ContextVar('request_id', default='')

class JSONFormatter(logging.Formatter):
    """JSON 形式のログフォーマッター"""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname.lower(),
            'message': record.getMessage(),
            'service': 'order-service',
            'logger': record.name,
            'request_id': request_id_var.get(''),
        }

        # エラー情報の追加
        if record.exc_info:
            log_data['error'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
            }

        # 追加フィールド
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)

        return json.dumps(log_data, ensure_ascii=False)


def setup_logger(name: str = 'app') -> logging.Logger:
    """構造化ログのセットアップ"""
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)

    return logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """リクエストログミドルウェア"""

    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.logger = setup_logger('http')

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get('x-request-id', str(uuid.uuid4()))
        request_id_var.set(request_id)

        start_time = time.perf_counter()

        self.logger.info(
            'Request received',
            extra={'extra_fields': {
                'method': request.method,
                'url': str(request.url),
                'client_ip': request.client.host if request.client else None,
            }}
        )

        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        response.headers['x-request-id'] = request_id

        self.logger.info(
            'Request completed',
            extra={'extra_fields': {
                'method': request.method,
                'url': str(request.url),
                'status_code': response.status_code,
                'duration_ms': round(duration_ms, 2),
            }}
        )

        return response
```

---

## 3. OpenTelemetry Instrumentation

### 3.1 Initialization in Node.js

```typescript
// otel-setup.ts — OpenTelemetry の初期化
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'order-service',
    [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? '0.0.0',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
    'service.namespace': 'myapp',
    'host.name': process.env.HOSTNAME ?? 'unknown',
  }),

  // トレースのエクスポーター
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),

  // メトリクスのエクスポーター
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/metrics',
    }),
    exportIntervalMillis: 60000, // 60秒ごとにエクスポート
  }),

  // ログのエクスポーター
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/logs',
    })
  ),

  // 自動計装 (HTTP, Express, pg, redis 等)
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => {
          // ヘルスチェックはトレースしない
          return req.url === '/health' || req.url === '/readyz';
        },
      },
    }),
  ],
});

sdk.start();
console.log('OpenTelemetry SDK initialized');

// シャットダウン処理
process.on('SIGTERM', async () => {
  await sdk.shutdown();
  console.log('OpenTelemetry SDK shut down');
  process.exit(0);
});
```

### 3.2 Creating Custom Spans and Metrics

```typescript
// custom-spans.ts — カスタムスパンの作成
import { trace, SpanStatusCode, Span } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service');

// カスタムメトリクスの定義
const meter = metrics.getMeter('order-service');

const orderCounter = meter.createCounter('orders.created', {
  description: '作成された注文の総数',
  unit: '1',
});

const orderDuration = meter.createHistogram('orders.processing_duration', {
  description: '注文処理にかかった時間',
  unit: 'ms',
});

const activeOrders = meter.createUpDownCounter('orders.active', {
  description: '処理中の注文数',
  unit: '1',
});

const orderValue = meter.createHistogram('orders.value', {
  description: '注文金額の分布',
  unit: 'JPY',
});

// カスタムスパン付きのビジネスロジック
async function createOrder(input: OrderInput): Promise<Order> {
  return tracer.startActiveSpan('createOrder', async (span: Span) => {
    const startTime = Date.now();
    activeOrders.add(1);

    try {
      span.setAttribute('order.customer_id', input.customerId);
      span.setAttribute('order.item_count', input.items.length);
      span.setAttribute('order.payment_method', input.paymentMethod);

      // 在庫確認スパン
      const inventory = await tracer.startActiveSpan(
        'checkInventory',
        async (inventorySpan) => {
          const result = await inventoryService.check(input.items);
          inventorySpan.setAttribute('inventory.available', result.available);
          inventorySpan.setAttribute('inventory.items_checked', input.items.length);
          inventorySpan.end();
          return result;
        }
      );

      if (!inventory.available) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Out of stock' });
        throw new Error('在庫不足');
      }

      // 決済処理スパン
      const payment = await tracer.startActiveSpan(
        'processPayment',
        async (paymentSpan) => {
          paymentSpan.setAttribute('payment.method', input.paymentMethod);
          paymentSpan.setAttribute('payment.amount', input.totalAmount);
          const result = await paymentService.charge(input);
          paymentSpan.setAttribute('payment.transaction_id', result.transactionId);
          paymentSpan.end();
          return result;
        }
      );

      const order = await orderRepository.save({
        ...input,
        transactionId: payment.transactionId,
        status: 'confirmed',
      });

      // メトリクス記録
      orderCounter.add(1, {
        status: 'success',
        payment_method: input.paymentMethod,
      });
      orderDuration.record(Date.now() - startTime, { status: 'success' });
      orderValue.record(input.totalAmount, {
        payment_method: input.paymentMethod,
      });

      span.setAttribute('order.id', order.id);
      span.setStatus({ code: SpanStatusCode.OK });

      return order;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      span.recordException(error as Error);
      orderCounter.add(1, { status: 'failure' });
      orderDuration.record(Date.now() - startTime, { status: 'failure' });
      throw error;
    } finally {
      activeOrders.add(-1);
      span.end();
    }
  });
}
```

### 3.3 Context Propagation (W3C Trace Context)

```typescript
// context-propagation.ts — サービス間のコンテキスト伝播
import { context, propagation, trace } from '@opentelemetry/api';

// HTTP クライアントでのコンテキスト伝播 (送信側)
async function callExternalService(url: string, body: object): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 現在のコンテキストからトレースヘッダーを注入
  // W3C Trace Context: traceparent, tracestate
  propagation.inject(context.active(), headers);

  // ヘッダーに以下が追加される:
  // traceparent: 00-<trace-id>-<span-id>-01
  // tracestate: vendor=value

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// HTTP サーバーでのコンテキスト抽出 (受信側)
function extractContext(req: Request): void {
  // リクエストヘッダーからトレースコンテキストを抽出
  const extractedContext = propagation.extract(context.active(), req.headers);

  // このコンテキスト内でスパンを作成すると
  // 親スパンと自動的にリンクされる
  const tracer = trace.getTracer('my-service');
  const span = tracer.startSpan('handleRequest', {}, extractedContext);

  // 処理...
  span.end();
}
```

```
W3C Trace Context によるサービス間のトレース伝播:

  Service A                    Service B                    Service C
  ┌────────────┐               ┌────────────┐               ┌────────────┐
  │ Span A     │               │ Span B     │               │ Span C     │
  │ trace: abc │── HTTP ──►    │ trace: abc │── HTTP ──►    │ trace: abc │
  │ span: 001  │  traceparent  │ span: 002  │  traceparent  │ span: 003  │
  │ parent: -  │  ヘッダー付与  │ parent: 001│  ヘッダー付与  │ parent: 002│
  └────────────┘               └────────────┘               └────────────┘

  traceparent ヘッダーの構造:
  00-<trace-id (32hex)>-<parent-span-id (16hex)>-<flags (2hex)>
  00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

  全スパンが同じ trace-id を共有 → 1つのリクエストフローとして可視化
```

---

## 4. OpenTelemetry Collector Configuration

### 4.1 Basic Configuration

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

  # ホストメトリクスの自動収集
  hostmetrics:
    collection_interval: 30s
    scrapers:
      cpu:
      memory:
      disk:
      network:

  # Prometheus メトリクスのスクレイプ
  prometheus:
    config:
      scrape_configs:
        - job_name: 'app-metrics'
          scrape_interval: 15s
          static_configs:
            - targets: ['app:3000']

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024

  memory_limiter:
    check_interval: 5s
    limit_mib: 512
    spike_limit_mib: 128

  attributes:
    actions:
      - key: environment
        value: production
        action: upsert

  # センシティブデータのフィルタリング
  attributes/remove-sensitive:
    actions:
      - key: http.request.header.authorization
        action: delete
      - key: http.request.header.cookie
        action: delete
      - key: db.statement
        action: hash  # SQL をハッシュ化

  # テールサンプリング (エラーと遅いリクエストを優先)
  tail_sampling:
    decision_wait: 10s
    num_traces: 100
    policies:
      - name: errors
        type: status_code
        status_code:
          status_codes: [ERROR]
      - name: slow-requests
        type: latency
        latency:
          threshold_ms: 1000
      - name: random-sample
        type: probabilistic
        probabilistic:
          sampling_percentage: 10

exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true

  prometheus:
    endpoint: 0.0.0.0:8889
    namespace: myapp

  loki:
    endpoint: http://loki:3100/loki/api/v1/push

  debug:
    verbosity: detailed

service:
  extensions: [health_check, pprof, zpages]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, tail_sampling, batch, attributes]
      exporters: [otlp/jaeger]
    metrics:
      receivers: [otlp, hostmetrics, prometheus]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, attributes/remove-sensitive, batch]
      exporters: [loki]

  telemetry:
    logs:
      level: info
    metrics:
      address: 0.0.0.0:8888
```

### 4.2 Observability Stack with Docker Compose

```yaml
# docker-compose.observability.yml
version: "3.8"

services:
  # OpenTelemetry Collector
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.96.0
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "8889:8889"   # Prometheus exporter
    depends_on:
      - jaeger
      - loki

  # Jaeger (分散トレーシング)
  jaeger:
    image: jaegertracing/all-in-one:1.54
    ports:
      - "16686:16686"  # UI
      - "14250:14250"  # gRPC
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  # Prometheus (メトリクス)
  prometheus:
    image: prom/prometheus:v2.50.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  # Loki (ログ集約)
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"

  # Grafana (可視化)
  grafana:
    image: grafana/grafana:10.3.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_AUTH_ANONYMOUS_ENABLED=true
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
      - jaeger
      - loki
```

```
OpenTelemetry Data Flow:

  Application Group               OTel Collector         Backends
  ┌──────────────┐                ┌─────────────┐
  │ Service A    │── traces ────► │             │───► Jaeger (Traces)
  │ (Node.js)    │── metrics ───► │  Receiver   │
  └──────────────┘── logs ──────► │      │      │───► Prometheus (Metrics)
  ┌──────────────┐                │  Processor  │
  │ Service B    │── traces ────► │      │      │───► Loki (Logs)
  │ (Python)     │── metrics ───► │  Exporter   │
  └──────────────┘── logs ──────► │             │───► Grafana (Visualization)
  ┌──────────────┐                └─────────────┘
  │ Service C    │── traces ────►
  │ (Go)         │── metrics ───►
  └──────────────┘
```

---

## 5. Defining SLI/SLO

### 5.1 The Relationship Between SLI/SLO/SLA

```
SLI/SLO/SLA Hierarchy:

  ┌─────────────────────────────────────────┐
  │  SLA (Service Level Agreement)           │
  │  Business contract. Penalties apply      │
  │  on violation.                           │
  │  Example: Guarantee 99.95% monthly       │
  │  availability; refund on violation       │
  ├─────────────────────────────────────────┤
  │  SLO (Service Level Objective)           │
  │  Internal target. Set stricter than SLA. │
  │  Example: Target 99.99% monthly          │
  │  availability (stricter than SLA,        │
  │  providing a buffer)                     │
  ├─────────────────────────────────────────┤
  │  SLI (Service Level Indicator)           │
  │  Measurement metric. Tracks SLO          │
  │  achievement.                            │
  │  Example: Successful requests /          │
  │  total requests                          │
  └─────────────────────────────────────────┘

  Allowable Downtime (30-day period):
  ┌──────────┬─────────────────┬──────────────────┐
  │ SLO      │ Error Budget    │ Downtime         │
  ├──────────┼─────────────────┼──────────────────┤
  │ 99%      │ 1%              │ 7h 12m           │
  │ 99.9%    │ 0.1%            │ 43m 12s          │
  │ 99.95%   │ 0.05%           │ 21m 36s          │
  │ 99.99%   │ 0.01%           │ 4m 19s           │
  │ 99.999%  │ 0.001%          │ 26s              │
  └──────────┴─────────────────┴──────────────────┘
```

### 5.2 SLI/SLO Definition Examples

```typescript
// slo-definitions.ts — SLI/SLO の定義例
interface SLI {
  name: string;
  description: string;
  query: string;        // PromQL クエリ
  unit: string;
}

interface BurnRateAlert {
  severity: string;
  shortWindow: string;
  longWindow: string;
  factor: number;
}

interface SLO {
  name: string;
  sli: SLI;
  target: number;       // 例: 0.999 = 99.9%
  window: string;       // 例: '30d'
  burnRateAlerts: BurnRateAlert[];
}

// 可用性 SLI
const availabilitySLI: SLI = {
  name: 'availability',
  description: 'HTTP リクエストの成功率',
  query: `
    sum(rate(http_requests_total{status!~"5.."}[5m]))
    /
    sum(rate(http_requests_total[5m]))
  `,
  unit: 'ratio',
};

// レイテンシ SLI
const latencySLI: SLI = {
  name: 'latency',
  description: 'p99 レイテンシが 500ms 以内のリクエスト割合',
  query: `
    sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))
    /
    sum(rate(http_request_duration_seconds_count[5m]))
  `,
  unit: 'ratio',
};

// スループット SLI
const throughputSLI: SLI = {
  name: 'throughput',
  description: '1秒あたりの処理リクエスト数',
  query: `sum(rate(http_requests_total[5m]))`,
  unit: 'requests/sec',
};

// SLO 定義
const apiAvailabilitySLO: SLO = {
  name: 'API Availability',
  sli: availabilitySLI,
  target: 0.999,  // 99.9%
  window: '30d',  // 30日間のローリングウィンドウ
  burnRateAlerts: [
    { severity: 'critical', shortWindow: '5m', longWindow: '1h', factor: 14.4 },
    { severity: 'warning',  shortWindow: '30m', longWindow: '6h', factor: 6 },
    { severity: 'ticket',   shortWindow: '6h', longWindow: '3d', factor: 1 },
  ],
};

const apiLatencySLO: SLO = {
  name: 'API Latency',
  sli: latencySLI,
  target: 0.99,  // 99%
  window: '30d',
  burnRateAlerts: [
    { severity: 'critical', shortWindow: '5m', longWindow: '1h', factor: 14.4 },
    { severity: 'warning',  shortWindow: '30m', longWindow: '6h', factor: 6 },
  ],
};
```

### 5.3 Operating with Error Budgets

```
Error Budget Concept:

  SLO: 99.9% (30-day period)
  Error Budget: 0.1% = 43.2 minutes of downtime

  Start of Month:
  ┌──────────────────────────────────────────┐
  │ ████████████████████████████████ 100%     │
  │ Error budget remaining: 43.2 min          │
  └──────────────────────────────────────────┘

  Day 15 (Incident: 20 minutes of downtime):
  ┌──────────────────────────────────────────┐
  │ █████████████████░░░░░░░░░░░░░░ 54%      │
  │ Error budget remaining: 23.2 min          │
  └──────────────────────────────────────────┘

  Day 20 (Budget exhausted):
  ┌──────────────────────────────────────────┐
  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%       │
  │ Error budget remaining: 0 min             │
  └──────────────────────────────────────────┘
  → Pause feature development and focus on reliability improvements

  Error Budget Policy:
  ┌──────────────────────────────────────────┐
  │ Budget > 50%: Continue normal development │
  │ Budget 25-50%: Restrict high-risk changes │
  │ Budget < 25%: Prioritize reliability work │
  │ Budget = 0%: Freeze feature development   │
  └──────────────────────────────────────────┘
```

### 5.4 SLO Dashboard in Grafana

```yaml
# grafana/dashboards/slo-dashboard.json (概要)
# SLO ダッシュボードに含めるべきパネル:
#
# 1. 現在の SLI 値 (Stat パネル)
#    - 可用性: 99.95% (目標: 99.9%)
#    - レイテンシ p99: 350ms (目標: 500ms)
#
# 2. エラーバジェット残量 (Gauge パネル)
#    - 残り: 65% (28分)
#
# 3. エラーバジェットの推移 (Time series パネル)
#    - 30日間のバーンダウンチャート
#
# 4. バーンレート (Time series パネル)
#    - 1h, 6h, 3d のウィンドウでのバーンレート
#
# 5. SLI の時系列推移 (Time series パネル)
#    - 可用性とレイテンシの推移グラフ
```

```promql
# SLO ダッシュボード用 PromQL クエリ

# 1. 現在の可用性 (30日ローリング)
1 - (
  sum(increase(http_requests_total{status=~"5.."}[30d]))
  /
  sum(increase(http_requests_total[30d]))
)

# 2. エラーバジェット残量 (%)
(
  1 - (
    sum(increase(http_requests_total{status=~"5.."}[30d]))
    /
    sum(increase(http_requests_total[30d]))
  )
  - 0.999
) / 0.001 * 100

# 3. バーンレート (1時間ウィンドウ)
(
  sum(rate(http_requests_total{status=~"5.."}[1h]))
  /
  sum(rate(http_requests_total[1h]))
) / 0.001

# 4. p99 レイテンシ
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

---

## 6. Comparison Tables

| Pillar | Logs | Metrics | Traces |
|----|------|----------|---------|
| Data Format | Text/JSON events | Numeric time series | Tree structure of spans |
| Cardinality | High | Low | Medium |
| Storage Cost | High | Low | Medium |
| Real-time | High | Medium (aggregation interval) | High |
| Use Cases | Debugging, auditing | Alerting, dashboards | Performance analysis |
| Query Speed | Slow (full-text search) | Fast (time-series DB) | Medium |
| Retention Period | Short (7-30 days) | Long (1-2 years) | Medium (7-30 days) |
| Sampling | Usually none | Always 100% | Recommended (1-10%) |

| OTel Backend | Jaeger | Zipkin | Tempo | Datadog |
|-------------------|--------|--------|-------|---------|
| Traces | Supported | Supported | Supported | Supported |
| Metrics | Not supported | Not supported | Not supported | Supported |
| Logs | Not supported | Not supported | Not supported | Supported |
| Storage | Elasticsearch/Cassandra | MySQL/Elasticsearch | Object storage | SaaS |
| Operational Burden | Medium | Low | Low | Lowest (SaaS) |
| Cost | Free (OSS) | Free (OSS) | Free (OSS) | Paid |

| Log Aggregation Tool | Loki | Elasticsearch | CloudWatch Logs | Datadog Logs |
|---------------|------|--------------|-----------------|-------------|
| Indexing Method | Labels only | Full-text search | Full-text search | Full-text search |
| Storage Efficiency | High | Low | Medium | Medium |
| Query Speed | Medium | High | Medium | High |
| Operational Burden | Low | High | Lowest | Lowest |
| Cost | Low | High | Pay-as-you-go | Pay-as-you-go |
| Grafana Integration | Native | Supported | Not supported | Not supported |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Overuse of Unstructured Logging

```typescript
// 悪い例: 非構造化ログ
console.log('User ' + userId + ' created order ' + orderId + ' at ' + new Date());
console.log('Error: ' + err.message);

// → 検索困難、パース不能、コンテキスト不足

// 良い例: 構造化ログ
logger.info({
  event: 'order_created',
  userId,
  orderId,
  timestamp: new Date().toISOString(),
}, 'Order created successfully');

logger.error({
  event: 'order_failed',
  err,
  userId,
  orderId,
}, 'Failed to create order');

// → JSON で構造化、フィールドで検索・フィルタ可能
```

### Anti-Pattern 2: Running in Production Without Instrumentation

```
[Bad Practice]
- Responding to incidents using only logs
- "Which service is slow?" → SSH into each server and grep logs
- "What is the request count?" → wc -l on access.log
- Hours or days to identify root cause of incidents

[Good Practice]
- Collect all three pillars uniformly with OpenTelemetry
- Understand the situation in real time via dashboards
- Visualize request flows with traces
- Automatically detect SLO violations with metrics
- Identify root cause of incidents within minutes
```

### Anti-Pattern 3: Excessive Log Output

```
[Bad Practice]
- Log all parameters for every request
- Enable DEBUG level logging in production
- Log storage costs exceed 100,000 JPY/month
- Too many logs make important information hard to find

[Good Practice]
- Production: INFO and above only
- Use sampling to capture detailed logs only for important requests
- Set appropriate log retention periods (7-30 days)
- Monitor costs and set alerts on log volume
- Mask sensitive information (passwords, tokens)
```

### Anti-Pattern 4: Not Defining SLOs

```
[Bad Practice]
- "Aim for 100% availability" → Unrealistic, leads to team burnout
- Too many alerts to act on
- Unclear prioritization between incident response and feature development
- No clear answer to "how much should we invest in reliability?"

[Good Practice]
- Define SLOs clearly (e.g., 99.9% availability)
- Balance development and reliability using error budgets
- Adjust release pace based on budget consumption
- Review and adjust SLOs quarterly
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# 演習1: 基本実装のテンプレート
class Exercise1:
    """基本的な実装パターンの演習"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """入力値の検証"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """データ処理のメインロジック"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """処理結果の取得"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# テスト
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# 演習2: 応用パターン
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """応用パターンの演習"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """アイテムの追加（サイズ制限付き）"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """キーによる検索"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """キーによる削除"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """統計情報"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# テスト
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # サイズ制限
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# 演習3: パフォーマンス最適化
import time
from functools import lru_cache

# 最適化前（O(n^2)）
def slow_search(data: list, target: int) -> int:
    """非効率な検索"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# 最適化後（O(n)）
def fast_search(data: list, target: int) -> tuple:
    """ハッシュマップを使った効率的な検索"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# ベンチマーク
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check the path and format of the config file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the execution user's permissions and review settings |
| Data inconsistency | Concurrency conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Validate incrementally**: Use log output or a debugger to verify hypotheses
5. **Fix and run regression tests**: After fixing, also run tests for related areas

```python
# デバッグ用ユーティリティ
import logging
import traceback
from functools import wraps

# ロガーの設定
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """関数の入出力をログ出力するデコレータ"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """データ処理（デバッグ対象）"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues when they occur:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Review disk and network I/O status
4. **Check concurrent connections**: Review connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes criteria for making technology choices.

| Criterion | When to prioritize | When to deprioritize |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin UIs, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flowchart          │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② How frequently do you deploy?                │
│    ├─ Once a week or less → Monolith +          │
│    │  modular decomposition                     │
│    └─ Daily/multiple times → Go to ③            │
│                                                 │
│  ③ How independent are teams?                   │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but can lead to code duplication

```python
# 設計判断の記録テンプレート
class ArchitectureDecisionRecord:
    """ADR (Architecture Decision Record) の作成"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """背景と課題の記述"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """決定内容の記述"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """結果の追加"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """却下した代替案の追加"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Markdown形式で出力"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## 背景\n{self.context}\n\n"
        md += f"## 決定\n{self.decision}\n\n"
        md += "## 結果\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## 却下した代替案\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 8. FAQ

### Q1: Should I use OpenTelemetry auto-instrumentation or manual instrumentation?

Start with auto-instrumentation. It automatically generates basic spans for HTTP requests, database queries, and external API calls. On top of that, add custom spans manually for business logic-specific information (order processing, payment processing, etc.). Since auto-instrumentation alone doesn't capture "what is being processed," combining both approaches is the best practice. Specifically, use auto-instrumentation to understand the overall request flow, and manual instrumentation to attach business-relevant attributes (order ID, customer ID, amount, etc.).

### Q2: How should I choose which log level to use?

**ERROR**: Failures where the system cannot continue processing (DB connection failure, external API failure). **WARN**: Unexpected state but processing can continue (retry succeeded, fallback used). **INFO**: Normal business events (order created, user registered). **DEBUG**: Detailed information for development (function calls, variable values). INFO and above is recommended for production; temporarily lower to DEBUG during incident investigation. It is convenient to have a mechanism to dynamically change log levels (via environment variables or an API endpoint).

### Q3: How should I determine SLO targets?

First, collect current metrics for 2-4 weeks to understand the baseline. Then set targets balancing "what is acceptable to users" with "what is achievable." For a typical web API, 99.9% (approximately 43 minutes of downtime per month) is a good starting point. Aiming for 100% causes costs to increase exponentially, so introduce the concept of error budgets (the amount of error you can tolerate). SLOs are not fixed — it is good practice to review and adjust them quarterly.

### Q4: What is an appropriate trace sampling rate?

It depends on traffic volume, but the following are general guidelines:
- **Low traffic** (< 100 req/s): 100% (all requests)
- **Medium traffic** (100-1000 req/s): 10-50%
- **High traffic** (> 1000 req/s): 1-10%

However, "tail sampling" — where requests with errors are always captured at 100% — is recommended. Using the `tail_sampling` processor in the OpenTelemetry Collector, you can retain error and slow requests preferentially while lowering the sampling rate for normal requests.

### Q5: Is the OpenTelemetry Collector required?

It is not required, but it is strongly recommended for production environments. Benefits of using the Collector:
1. **Decoupling**: Applications are unaware of the backend
2. **Batching**: Improved network efficiency
3. **Processing and filtering**: Remove sensitive data, perform sampling
4. **Retry**: Buffering during backend failures
5. **Multi-backend**: Send the same data to multiple destinations

In development environments, it is fine to send data directly to a backend without the Collector.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|------|
| Logs | Structured JSON format. Make requests trackable with requestId |
| Metrics | Numeric time-series data. Foundation of SLI/SLO |
| Traces | Visualize request flows in distributed systems |
| OpenTelemetry | Vendor-agnostic instrumentation standard. Combine auto + manual instrumentation |
| OTel Collector | Central hub for collecting, processing, and forwarding telemetry data |
| SLI/SLO | User-centric reliability indicators. Managed with error budgets |
| Context Propagation | Achieve distributed tracing with W3C Trace Context |
| Sampling | Balance cost and quality with tail sampling |
| Log Levels | INFO and above in production. Prepare a mechanism for dynamic changes |
| Error Budget | Allowable amount of SLO violation. A balance indicator between development speed and reliability |

---

## What to Read Next

- [01-monitoring-tools.md](./01-monitoring-tools.md) — Using Datadog, Grafana, and CloudWatch
- [02-alerting.md](./02-alerting.md) — Alert design and escalation
- [03-performance-monitoring.md](./03-performance-monitoring.md) — APM, RUM, Core Web Vitals

---

## References

1. **Observability Engineering** — Charity Majors, Liz Fong-Jones, George Miranda (O'Reilly, 2022) — A practical guide to observability
2. **OpenTelemetry Documentation** — https://opentelemetry.io/docs/ — Official OTel documentation
3. **Google SRE Book - Monitoring Distributed Systems** — https://sre.google/sre-book/monitoring-distributed-systems/ — Google's monitoring approach
4. **Site Reliability Engineering** — Betsy Beyer et al. (O'Reilly, 2016) — The foundational SRE text
5. **Implementing Service Level Objectives** — Alex Hidalgo (O'Reilly, 2020) — A guide to implementing SLOs
6. **W3C Trace Context** — https://www.w3.org/TR/trace-context/ — The distributed tracing standard specification
7. **OpenTelemetry Collector Documentation** — https://opentelemetry.io/docs/collector/ — Official Collector documentation
