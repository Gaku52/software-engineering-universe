# Performance Monitoring

> Measure performance from both backend and frontend perspectives using APM, RUM, and Core Web Vitals to continuously improve the user experience

## What You Will Learn

1. **APM (Application Performance Monitoring)** — Real-time monitoring of backend latency, throughput, and error rates
2. **RUM (Real User Monitoring)** — Measuring frontend performance as experienced by actual users
3. **Core Web Vitals** — Measuring and improving Google-defined UX metrics (LCP, INP, CLS)
4. **Synthetic Monitoring** — Continuous performance measurement through periodic scenario execution
5. **Performance Optimization** — A systematic approach from bottleneck identification to improvement


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Alerting Strategy](./02-alerting.md)

---

## 1. Overview of Performance Monitoring

```
┌──────────────────────────────────────────────────────────┐
│             Performance Monitoring Overview               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Client Side (Frontend)            Server Side (Backend) │
│  ┌─────────────────────┐        ┌─────────────────────┐ │
│  │  RUM                │        │  APM                │ │
│  │  ┌───────────────┐  │        │  ┌───────────────┐  │ │
│  │  │ Core Web      │  │        │  │ Latency       │  │ │
│  │  │ Vitals        │  │        │  │ (p50/p95/p99) │  │ │
│  │  │ - LCP         │  │  HTTP  │  │               │  │ │
│  │  │ - INP         │  │◄──────►│  │ Throughput    │  │ │
│  │  │ - CLS         │  │        │  │ (req/sec)     │  │ │
│  │  └───────────────┘  │        │  │               │  │ │
│  │  ┌───────────────┐  │        │  │ Error Rate    │  │ │
│  │  │ Navigation    │  │        │  │ (5xx/total)   │  │ │
│  │  │ Timing        │  │        │  └───────────────┘  │ │
│  │  │ Resource      │  │        │  ┌───────────────┐  │ │
│  │  │ Timing        │  │        │  │ DB Queries    │  │ │
│  │  └───────────────┘  │        │  │ External API  │  │ │
│  └─────────────────────┘        │  │ Cache Hit Rate│  │ │
│                                  │  └───────────────┘  │ │
│                                  └─────────────────────┘ │
│  Synthetic Monitoring                                     │
│  ┌──────────────────────────────────────────┐           │
│  │ Periodically execute scenarios to measure performance │
│  │ (Lighthouse CI, Checkly, Datadog Synthetics)│           │
│  └──────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────┘
```

### 1.1 The RED Method and USE Method

```
Two frameworks for performance monitoring:

RED Method (service-oriented — ideal for microservices):
┌──────────────────────────────────────────┐
│ R — Rate (request rate)                  │
│     Number of requests per second        │
│                                          │
│ E — Errors (error rate)                  │
│     Percentage of failed requests        │
│                                          │
│ D — Duration (latency)                   │
│     Request processing time (p50/p95/p99)│
└──────────────────────────────────────────┘

USE Method (resource-oriented — ideal for infrastructure monitoring):
┌──────────────────────────────────────────┐
│ U — Utilization                          │
│     Percentage of time a resource is busy│
│                                          │
│ S — Saturation                           │
│     Length of the resource's wait queue  │
│                                          │
│ E — Errors                               │
│     Number of error events               │
└──────────────────────────────────────────┘

USE Method example application:
┌──────────┬──────────────┬──────────────┬──────────────┐
│ Resource │ Utilization  │ Saturation   │ Errors       │
├──────────┼──────────────┼──────────────┼──────────────┤
│ CPU      │ CPU Usage    │ Run Queue    │ Machine Check│
│ Memory   │ Memory Usage │ Swap Usage   │ OOM Kill     │
│ Disk     │ Disk I/O     │ I/O Wait     │ I/O Errors   │
│ Network  │ Bandwidth    │ Drop/Overflow│ CRC Errors   │
└──────────┴──────────────┴──────────────┴──────────────┘
```

### 1.2 Designing a Performance Budget

```
Performance budget hierarchy:

  ┌─────────────────────────────────────────────┐
  │ Business Goal                                │
  │ "1 second delay in page load = 7% revenue loss" │
  └────────────────────┬────────────────────────┘
                       │
  ┌────────────────────▼────────────────────────┐
  │ User Experience Goal                         │
  │ LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1        │
  └────────────────────┬────────────────────────┘
                       │
  ┌────────────────────▼────────────────────────┐
  │ Technical Budget                             │
  │ JS Bundle ≤ 300KB, Total ≤ 500KB           │
  │ API Latency p95 ≤ 200ms                    │
  │ Total Images ≤ 200KB                        │
  │ Fonts ≤ 100KB                               │
  └────────────────────┬────────────────────────┘
                       │
  ┌────────────────────▼────────────────────────┐
  │ CI/CD Enforcement                            │
  │ Block or warn on PR when budget is exceeded  │
  └─────────────────────────────────────────────┘
```

---

## 2. APM — Backend Performance Monitoring

### 2.1 Express APM Middleware

```typescript
// apm-middleware.ts — Express 用 APM ミドルウェア
import { Request, Response, NextFunction } from 'express';
import { metrics } from '@opentelemetry/api';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const meter = metrics.getMeter('http-server');
const tracer = trace.getTracer('http-server');

// ヒストグラム: レイテンシ分布の計測
const httpDuration = meter.createHistogram('http.server.duration', {
  description: 'HTTP リクエストの処理時間',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  },
});

// カウンター: リクエスト数
const httpRequests = meter.createCounter('http.server.requests', {
  description: 'HTTP リクエストの総数',
});

// ゲージ: 同時接続数
const activeRequests = meter.createUpDownCounter('http.server.active_requests', {
  description: '処理中のリクエスト数',
});

export function apmMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = performance.now();
  activeRequests.add(1);

  // レスポンス完了時にメトリクスを記録
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    const labels = {
      method: req.method,
      route: req.route?.path ?? req.path,
      status: String(res.statusCode),
      status_class: `${Math.floor(res.statusCode / 100)}xx`,
    };

    httpDuration.record(duration, labels);
    httpRequests.add(1, labels);
    activeRequests.add(-1);
  });

  next();
}

// Slow Query 検出ミドルウェア
export function slowQueryDetector(thresholdMs: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();

    res.on('finish', () => {
      const duration = performance.now() - start;
      if (duration > thresholdMs) {
        console.warn({
          event: 'slow_request',
          method: req.method,
          path: req.path,
          duration: Math.round(duration),
          threshold: thresholdMs,
          statusCode: res.statusCode,
        });
      }
    });

    next();
  };
}
```

### 2.2 Database Query Monitoring

```typescript
// db-query-monitor.ts — データベースクエリの監視
import { trace } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('database');
const tracer = trace.getTracer('database');

const queryDuration = meter.createHistogram('db.query.duration', {
  description: 'データベースクエリの実行時間',
  unit: 'ms',
});

const queryCounter = meter.createCounter('db.query.count', {
  description: 'データベースクエリの実行回数',
});

const slowQueryCounter = meter.createCounter('db.query.slow', {
  description: 'スロークエリの数',
});

// N+1 クエリ検出
class QueryMonitor {
  private queryCounts = new Map<string, number>();
  private readonly threshold = 10; // 同一パターンが10回以上で警告
  private readonly slowQueryThresholdMs = 100; // 100ms以上でスロークエリ

  trackQuery(sql: string, duration: number): void {
    const pattern = this.normalizeQuery(sql);

    queryDuration.record(duration, { query_pattern: pattern });
    queryCounter.add(1, { query_pattern: pattern });

    // スロークエリの記録
    if (duration > this.slowQueryThresholdMs) {
      slowQueryCounter.add(1, { query_pattern: pattern });
      console.warn({
        event: 'slow_query',
        pattern,
        duration,
        threshold: this.slowQueryThresholdMs,
      });
    }

    // N+1 検出
    const count = (this.queryCounts.get(pattern) ?? 0) + 1;
    this.queryCounts.set(pattern, count);

    if (count === this.threshold) {
      console.warn({
        event: 'n_plus_one_detected',
        pattern,
        count,
        message: `同一パターンのクエリが${count}回実行されました (N+1の疑い)`,
      });
    }
  }

  private normalizeQuery(sql: string): string {
    return sql
      .replace(/\d+/g, '?')           // 数値をプレースホルダに
      .replace(/'[^']*'/g, "'?'")      // 文字列をプレースホルダに
      .replace(/\s+/g, ' ')           // 空白を正規化
      .trim();
  }

  reset(): void {
    this.queryCounts.clear();
  }
}

export const queryMonitor = new QueryMonitor();
```

### 2.3 External API Call Monitoring

```typescript
// external-api-monitor.ts — 外部 API 呼び出しの監視
import { trace, SpanStatusCode, context, propagation } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('external-api');
const tracer = trace.getTracer('external-api');

const apiDuration = meter.createHistogram('external_api.duration', {
  description: '外部 API 呼び出しのレイテンシ',
  unit: 'ms',
});

const apiErrors = meter.createCounter('external_api.errors', {
  description: '外部 API 呼び出しのエラー数',
});

const circuitBreakerState = meter.createObservableGauge(
  'external_api.circuit_breaker.state',
  { description: 'Circuit Breaker の状態 (0=closed, 1=open, 2=half-open)' }
);

// 計測付き HTTP クライアント
async function instrumentedFetch(
  url: string,
  options: RequestInit = {},
  provider: string = 'unknown'
): Promise<Response> {
  const parsedUrl = new URL(url);
  const labels = {
    provider,
    host: parsedUrl.host,
    method: options.method ?? 'GET',
    path: parsedUrl.pathname,
  };

  return tracer.startActiveSpan(
    `HTTP ${labels.method} ${labels.host}${labels.path}`,
    async (span) => {
      const startTime = performance.now();

      // トレースコンテキストの伝播
      const headers = new Headers(options.headers);
      propagation.inject(context.active(), headers, {
        set: (carrier, key, value) => carrier.set(key, value),
      });

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: AbortSignal.timeout(30000), // 30秒タイムアウト
        });

        const duration = performance.now() - startTime;
        apiDuration.record(duration, {
          ...labels,
          status: String(response.status),
        });

        span.setAttributes({
          'http.status_code': response.status,
          'http.url': url,
          'http.method': labels.method,
          'external_api.duration_ms': Math.round(duration),
        });

        if (!response.ok) {
          apiErrors.add(1, { ...labels, status: String(response.status) });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${response.status}`,
          });
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        apiDuration.record(duration, { ...labels, status: 'error' });
        apiErrors.add(1, { ...labels, status: 'error' });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.recordException(error as Error);

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

// Circuit Breaker パターン
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly name: string,
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 30000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker is open for ${this.name}`);
      }
    }

    try {
      const result = await fn();

      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
        console.warn({
          event: 'circuit_breaker_opened',
          name: this.name,
          failures: this.failures,
        });
      }

      throw error;
    }
  }

  getState(): number {
    switch (this.state) {
      case 'closed': return 0;
      case 'open': return 1;
      case 'half-open': return 2;
    }
  }
}
```

### 2.4 Cache Performance Monitoring

```typescript
// cache-monitor.ts — キャッシュパフォーマンスの監視
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('cache');

const cacheHits = meter.createCounter('cache.hits', {
  description: 'キャッシュヒット数',
});

const cacheMisses = meter.createCounter('cache.misses', {
  description: 'キャッシュミス数',
});

const cacheDuration = meter.createHistogram('cache.operation.duration', {
  description: 'キャッシュ操作のレイテンシ',
  unit: 'ms',
});

const cacheSize = meter.createObservableGauge('cache.size', {
  description: 'キャッシュのエントリ数',
});

class MonitoredCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();

  constructor(private readonly name: string) {
    // キャッシュサイズの定期報告
    cacheSize.addCallback((result) => {
      result.observe(this.cache.size, { cache: this.name });
    });
  }

  async get(key: string): Promise<T | undefined> {
    const start = performance.now();
    const entry = this.cache.get(key);
    const duration = performance.now() - start;

    if (entry && entry.expiry > Date.now()) {
      cacheHits.add(1, { cache: this.name });
      cacheDuration.record(duration, { cache: this.name, operation: 'get', result: 'hit' });
      return entry.value;
    }

    cacheMisses.add(1, { cache: this.name });
    cacheDuration.record(duration, { cache: this.name, operation: 'get', result: 'miss' });

    if (entry) {
      this.cache.delete(key); // 期限切れエントリの削除
    }

    return undefined;
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    const start = performance.now();
    this.cache.set(key, { value, expiry: Date.now() + ttlMs });
    const duration = performance.now() - start;

    cacheDuration.record(duration, { cache: this.name, operation: 'set' });
  }

  // キャッシュヒット率 (PromQL で計算)
  // rate(cache_hits{cache="products"}[5m])
  // / (rate(cache_hits{cache="products"}[5m]) + rate(cache_misses{cache="products"}[5m]))
}

// Grafana ダッシュボード用 PromQL クエリ集
/*
# キャッシュヒット率 (%)
sum(rate(cache_hits[5m])) by (cache)
/ (sum(rate(cache_hits[5m])) by (cache) + sum(rate(cache_misses[5m])) by (cache))
* 100

# キャッシュ操作のレイテンシ (p95)
histogram_quantile(0.95,
  sum(rate(cache_operation_duration_bucket[5m])) by (le, cache, operation)
)

# キャッシュサイズの推移
cache_size
*/
```

### 2.5 PromQL for Grafana Dashboard (APM)

```promql
# --- RED Metrics (per service) ---

# Rate: request rate
sum(rate(http_server_requests_total[5m])) by (service)

# Errors: error rate (%)
sum(rate(http_server_requests_total{status_class="5xx"}[5m])) by (service)
/
sum(rate(http_server_requests_total[5m])) by (service)
* 100

# Duration: p50/p95/p99 latency
histogram_quantile(0.5,
  sum(rate(http_server_duration_bucket[5m])) by (service, le)
)

histogram_quantile(0.95,
  sum(rate(http_server_duration_bucket[5m])) by (service, le)
)

histogram_quantile(0.99,
  sum(rate(http_server_duration_bucket[5m])) by (service, le)
)

# --- Per-endpoint details ---

# Top 10 slowest endpoints
topk(10,
  histogram_quantile(0.95,
    sum(rate(http_server_duration_bucket[5m])) by (route, le)
  )
)

# Top 10 endpoints by request count
topk(10,
  sum(rate(http_server_requests_total[5m])) by (route)
)

# Top 10 endpoints by error count
topk(10,
  sum(rate(http_server_requests_total{status_class="5xx"}[5m])) by (route)
)

# --- DB query performance ---

# Slow query occurrence rate
sum(rate(db_query_slow_total[5m])) by (query_pattern)

# Query latency p95
histogram_quantile(0.95,
  sum(rate(db_query_duration_bucket[5m])) by (le, query_pattern)
)

# N+1 query detection count
sum(increase(n_plus_one_detected_total[1h])) by (query_pattern)

# --- External API performance ---

# External API call latency (per provider)
histogram_quantile(0.95,
  sum(rate(external_api_duration_bucket[5m])) by (le, provider)
)

# External API error rate
sum(rate(external_api_errors_total[5m])) by (provider)
/
sum(rate(external_api_duration_count[5m])) by (provider)
* 100

# --- Cache performance ---

# Cache hit rate
sum(rate(cache_hits_total[5m])) by (cache)
/ (sum(rate(cache_hits_total[5m])) by (cache) + sum(rate(cache_misses_total[5m])) by (cache))
* 100

# Cache operation latency
histogram_quantile(0.95,
  sum(rate(cache_operation_duration_bucket[5m])) by (le, cache, operation)
)
```

---

## 3. RUM — Frontend Performance Monitoring

### 3.1 Implementing RUM Data Collection

```typescript
// rum-collector.ts — Real User Monitoring の実装
interface PerformanceData {
  // Navigation Timing
  dns: number;
  tcp: number;
  tls: number;
  ttfb: number;          // Time to First Byte
  domContentLoaded: number;
  load: number;

  // Core Web Vitals
  lcp: number | null;     // Largest Contentful Paint
  inp: number | null;     // Interaction to Next Paint
  cls: number | null;     // Cumulative Layout Shift

  // コンテキスト
  url: string;
  userAgent: string;
  connectionType: string;
  timestamp: number;
}

class RUMCollector {
  private data: Partial<PerformanceData> = {};

  constructor(private readonly endpoint: string) {
    this.collectNavigationTiming();
    this.collectWebVitals();

    // ページ離脱時に送信
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.send();
      }
    });
  }

  private collectNavigationTiming(): void {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (!nav) return;

        this.data.dns = nav.domainLookupEnd - nav.domainLookupStart;
        this.data.tcp = nav.connectEnd - nav.connectStart;
        this.data.tls = nav.secureConnectionStart > 0
          ? nav.connectEnd - nav.secureConnectionStart : 0;
        this.data.ttfb = nav.responseStart - nav.requestStart;
        this.data.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;
        this.data.load = nav.loadEventEnd - nav.startTime;
      }, 0);
    });
  }

  private collectWebVitals(): void {
    // LCP (Largest Contentful Paint)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.data.lcp = lastEntry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.data.cls = clsValue;
    }).observe({ type: 'layout-shift', buffered: true });

    // INP (Interaction to Next Paint)
    let maxINP = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.duration;
        if (duration > maxINP) {
          maxINP = duration;
          this.data.inp = duration;
        }
      }
    }).observe({ type: 'event', buffered: true });
  }

  private send(): void {
    const payload: PerformanceData = {
      ...this.data as PerformanceData,
      url: window.location.href,
      userAgent: navigator.userAgent,
      connectionType: (navigator as any).connection?.effectiveType ?? 'unknown',
      timestamp: Date.now(),
    };

    // Beacon API で確実に送信 (ページ離脱時も)
    navigator.sendBeacon(
      this.endpoint,
      JSON.stringify(payload)
    );
  }
}

// 使用
new RUMCollector('/api/rum/collect');
```

### 3.2 Using the web-vitals Library

```typescript
// web-vitals-reporter.ts — web-vitals ライブラリを使った計測
import { onLCP, onINP, onCLS, onFCP, onTTFB, Metric } from 'web-vitals';

interface VitalsReport {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
}

class WebVitalsReporter {
  private reports: VitalsReport[] = [];
  private readonly batchSize = 10;
  private readonly flushIntervalMs = 5000;

  constructor(private readonly endpoint: string) {
    this.startAutoFlush();
    this.registerMetrics();
  }

  private registerMetrics(): void {
    const reportCallback = (metric: Metric) => {
      const report: VitalsReport = {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
        url: window.location.href,
        timestamp: Date.now(),
      };

      this.reports.push(report);

      // コンソールにも出力 (開発用)
      if (process.env.NODE_ENV === 'development') {
        const color = metric.rating === 'good'
          ? 'green'
          : metric.rating === 'needs-improvement'
            ? 'orange'
            : 'red';
        console.log(
          `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(1)} (${metric.rating})`,
          `color: ${color}; font-weight: bold;`
        );
      }

      if (this.reports.length >= this.batchSize) {
        this.flush();
      }
    };

    onLCP(reportCallback);
    onINP(reportCallback);
    onCLS(reportCallback);
    onFCP(reportCallback);
    onTTFB(reportCallback);
  }

  private flush(): void {
    if (this.reports.length === 0) return;

    const payload = [...this.reports];
    this.reports = [];

    // Beacon API で送信
    navigator.sendBeacon(
      this.endpoint,
      JSON.stringify(payload)
    );
  }

  private startAutoFlush(): void {
    setInterval(() => this.flush(), this.flushIntervalMs);

    // ページ離脱時にフラッシュ
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}

// 使用
new WebVitalsReporter('/api/vitals/report');
```

### 3.3 RUM Data Aggregation API

```typescript
// rum-api.ts — RUM データの受信と集約
import express from 'express';
import { metrics } from '@opentelemetry/api';

const app = express();
const meter = metrics.getMeter('rum');

// Web Vitals メトリクスの定義
const lcpHistogram = meter.createHistogram('web_vitals.lcp', {
  description: 'Largest Contentful Paint',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 8000],
  },
});

const inpHistogram = meter.createHistogram('web_vitals.inp', {
  description: 'Interaction to Next Paint',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [50, 100, 150, 200, 300, 400, 500, 750, 1000],
  },
});

const clsHistogram = meter.createHistogram('web_vitals.cls', {
  description: 'Cumulative Layout Shift',
  advice: {
    explicitBucketBoundaries: [0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.5],
  },
});

const fcpHistogram = meter.createHistogram('web_vitals.fcp', {
  description: 'First Contentful Paint',
  unit: 'ms',
});

const ttfbHistogram = meter.createHistogram('web_vitals.ttfb', {
  description: 'Time to First Byte',
  unit: 'ms',
});

// RUM データ受信エンドポイント
app.post('/api/vitals/report', express.json(), (req, res) => {
  const reports = Array.isArray(req.body) ? req.body : [req.body];

  for (const report of reports) {
    const labels = {
      page: new URL(report.url).pathname,
      connection: report.connectionType ?? 'unknown',
      navigation_type: report.navigationType ?? 'navigate',
      rating: report.rating,
    };

    switch (report.name) {
      case 'LCP':
        lcpHistogram.record(report.value, labels);
        break;
      case 'INP':
        inpHistogram.record(report.value, labels);
        break;
      case 'CLS':
        clsHistogram.record(report.value, labels);
        break;
      case 'FCP':
        fcpHistogram.record(report.value, labels);
        break;
      case 'TTFB':
        ttfbHistogram.record(report.value, labels);
        break;
    }
  }

  res.status(204).end();
});

// Navigation Timing データ受信
app.post('/api/rum/collect', express.json(), (req, res) => {
  const data = req.body;
  const page = new URL(data.url).pathname;

  // TTFB
  if (data.ttfb) {
    ttfbHistogram.record(data.ttfb, { page });
  }

  // LCP
  if (data.lcp) {
    lcpHistogram.record(data.lcp, { page });
  }

  // CLS
  if (data.cls != null) {
    clsHistogram.record(data.cls, { page });
  }

  // INP
  if (data.inp) {
    inpHistogram.record(data.inp, { page });
  }

  res.status(204).end();
});
```

---

## 4. Core Web Vitals: Thresholds and Improvement

### 4.1 Thresholds

```
Core Web Vitals evaluation criteria (updated 2024):

  LCP (Largest Contentful Paint) — Loading speed
  ┌─────────────┬──────────────┬──────────────┐
  │  Good       │ Needs Work   │  Poor        │
  │  ≤ 2.5s     │ ≤ 4.0s       │ > 4.0s       │
  │  ████████   │ ████████     │ ████████     │
  │  (green)    │ (yellow)     │ (red)        │
  └─────────────┴──────────────┴──────────────┘

  INP (Interaction to Next Paint) — Responsiveness
  ┌─────────────┬──────────────┬──────────────┐
  │  Good       │ Needs Work   │  Poor        │
  │  ≤ 200ms    │ ≤ 500ms      │ > 500ms      │
  │  ████████   │ ████████     │ ████████     │
  │  (green)    │ (yellow)     │ (red)        │
  └─────────────┴──────────────┴──────────────┘

  CLS (Cumulative Layout Shift) — Visual stability
  ┌─────────────┬──────────────┬──────────────┐
  │  Good       │ Needs Work   │  Poor        │
  │  ≤ 0.1      │ ≤ 0.25       │ > 0.25       │
  │  ████████   │ ████████     │ ████████     │
  │  (green)    │ (yellow)     │ (red)        │
  └─────────────┴──────────────┴──────────────┘
```

### 4.2 Improvement Guide

```
Improvement checklist for each metric:

LCP Improvements:
┌────────────────────────────────────────────────────────┐
│ □ Identify the LCP element (usually hero image or large text) │
│ □ Improve server response time (TTFB < 800ms)           │
│ □ Eliminate render-blocking resources                   │
│   - CSS: inline critical CSS                            │
│   - JS: defer / async attributes                        │
│ □ Optimize images                                       │
│   - Use appropriate formats (WebP/AVIF)                 │
│   - Serve appropriate sizes with srcset                 │
│   - Prioritize LCP image with fetchpriority="high"      │
│   - Preload: <link rel="preload" as="image">            │
│ □ Use a CDN                                             │
│ □ Server-side rendering with SSR / SSG                  │
└────────────────────────────────────────────────────────┘

INP Improvements:
┌────────────────────────────────────────────────────────┐
│ □ Break up heavy JavaScript processing                  │
│   - Identify and split Long Tasks (50ms+)               │
│   - requestIdleCallback / scheduler.yield()             │
│ □ Avoid blocking the main thread                        │
│   - Offload processing to Web Workers                   │
│   - Use requestAnimationFrame                           │
│ □ Optimize event handlers                               │
│   - Debounce / throttle                                 │
│   - Passive event listeners                             │
│ □ Prevent unnecessary re-renders (React)                │
│   - React.memo, useMemo, useCallback                    │
│   - Virtualization (react-window, react-virtuoso)       │
│ □ Evaluate the impact of third-party scripts            │
└────────────────────────────────────────────────────────┘

CLS Improvements:
┌────────────────────────────────────────────────────────┐
│ □ Specify explicit sizes for images and videos          │
│   - width/height attributes or aspect-ratio CSS         │
│ □ Prevent web font flash                                │
│   - font-display: swap + preload                        │
│   - Adjust fallback with size-adjust                    │
│ □ Placement of dynamic content                          │
│   - Pre-reserve space for ads and banners               │
│   - Use contain-intrinsic-size                          │
│ □ Use transform for animations                          │
│   - width/height animation → transform: scale()         │
│   - top/left animation → transform: translate()         │
│ □ Identify layout shift sources                         │
│   - DevTools Performance panel                          │
│   - Layout Shift debugger                               │
└────────────────────────────────────────────────────────┘
```

---

## 5. Continuous Measurement with Lighthouse CI

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci && npm run build

      - name: Start server
        run: npm run preview &
        env:
          PORT: 3000

      - name: Wait for server
        run: npx wait-on http://localhost:3000

      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:3000/
            http://localhost:3000/products
            http://localhost:3000/checkout
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
          temporaryPublicStorage: true

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('.lighthouseci/manifest.json'));

            let comment = '## Lighthouse CI Results\n\n';
            comment += '| URL | Performance | Accessibility | Best Practices | SEO |\n';
            comment += '|-----|-----------|---------------|---------------|-----|\n';

            for (const result of results) {
              const summary = JSON.parse(fs.readFileSync(result.jsonPath));
              const scores = summary.categories;

              const getEmoji = (score) => score >= 0.9 ? '🟢' : score >= 0.5 ? '🟡' : '🔴';

              comment += `| ${result.url} `;
              comment += `| ${getEmoji(scores.performance.score)} ${Math.round(scores.performance.score * 100)} `;
              comment += `| ${getEmoji(scores.accessibility.score)} ${Math.round(scores.accessibility.score * 100)} `;
              comment += `| ${getEmoji(scores['best-practices'].score)} ${Math.round(scores['best-practices'].score * 100)} `;
              comment += `| ${getEmoji(scores.seo.score)} ${Math.round(scores.seo.score * 100)} |\n`;
            }

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment,
            });
```

### 5.2 Performance Budget

```json
[
  {
    "path": "/*",
    "timings": [
      { "metric": "interactive", "budget": 3000 },
      { "metric": "first-contentful-paint", "budget": 1500 },
      { "metric": "largest-contentful-paint", "budget": 2500 },
      { "metric": "total-blocking-time", "budget": 300 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 300 },
      { "resourceType": "total", "budget": 500 },
      { "resourceType": "image", "budget": 200 },
      { "resourceType": "stylesheet", "budget": 100 },
      { "resourceType": "font", "budget": 100 },
      { "resourceType": "third-party", "budget": 150 }
    ],
    "resourceCounts": [
      { "resourceType": "script", "budget": 10 },
      { "resourceType": "total", "budget": 50 },
      { "resourceType": "third-party", "budget": 5 }
    ]
  }
]
```

### 5.3 Lighthouse CI Configuration File

```javascript
// lighthouserc.js — Lighthouse CI の詳細設定
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/products',
        'http://localhost:3000/products/1',
        'http://localhost:3000/checkout',
      ],
      numberOfRuns: 3,  // 各 URL を 3 回実行して中央値を取得
      settings: {
        preset: 'desktop',  // 'desktop' or 'mobile'
        throttling: {
          // Fast 3G シミュレーション
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
        // Chrome フラグ
        chromeFlags: '--no-sandbox --headless',
        // 特定の監査のみ実行
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      assertions: {
        // パフォーマンスカテゴリ
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // その他の重要な監査
        'first-contentful-paint': ['warn', { maxNumericValue: 1500 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],
        'interactive': ['warn', { maxNumericValue: 3000 }],

        // リソースサイズ
        'resource-summary:script:size': ['error', { maxNumericValue: 307200 }],  // 300KB
        'resource-summary:total:size': ['error', { maxNumericValue: 512000 }],    // 500KB
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

---

## 6. Synthetic Monitoring

### 6.1 Synthetic Monitoring with Checkly

```typescript
// checkly.config.ts — Checkly の設定
import { defineConfig } from 'checkly';

export default defineConfig({
  projectName: 'MyApp Monitoring',
  logicalId: 'myapp-monitoring',
  repoUrl: 'https://github.com/example/myapp',
  checks: {
    activated: true,
    muted: false,
    runtimeId: '2024.02',
    frequency: 5,  // 5分ごと
    locations: ['ap-northeast-1', 'us-east-1', 'eu-west-1'],
    tags: ['production'],
    checkMatch: '**/*.check.ts',
    browserChecks: {
      frequency: 10,  // 10分ごと
      testMatch: '**/*.spec.ts',
    },
  },
});
```

```typescript
// checks/api-health.check.ts — API ヘルスチェック
import { ApiCheck, AssertionBuilder } from 'checkly/constructs';

new ApiCheck('api-health-check', {
  name: 'API Health Check',
  activated: true,
  frequency: 1,  // 1分ごと
  locations: ['ap-northeast-1'],
  request: {
    method: 'GET',
    url: 'https://api.example.com/health',
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.responseTime().lessThan(500),
      AssertionBuilder.jsonBody('$.status').equals('healthy'),
    ],
  },
  alertChannels: [
    { id: 'slack-alerts' },
    { id: 'pagerduty-critical' },
  ],
});

// checks/order-flow.spec.ts — E2E シナリオテスト
import { test, expect } from '@playwright/test';

test('注文フロー E2E', async ({ page }) => {
  // 1. 商品一覧ページにアクセス
  const startTime = Date.now();
  await page.goto('https://www.example.com/products');
  expect(Date.now() - startTime).toBeLessThan(3000);

  // 2. 商品を選択
  await page.click('[data-testid="product-card"]:first-child');
  await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();

  // 3. カートに追加
  await page.click('[data-testid="add-to-cart"]');
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');

  // 4. チェックアウトへ
  await page.click('[data-testid="checkout-button"]');
  await expect(page).toHaveURL(/\/checkout/);

  // 5. フォーム入力
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="card-number"]', '4242424242424242');

  // 6. 注文確定 (テスト環境のみ)
  if (process.env.CHECKLY_TEST_ENVIRONMENT === 'staging') {
    await page.click('[data-testid="place-order"]');
    await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible({ timeout: 10000 });
  }
});
```

### 6.2 Datadog Synthetics

```yaml
# datadog-synthetics.tf — Terraform で Datadog Synthetics 管理
resource "datadog_synthetics_test" "api_health" {
  name      = "API Health Check"
  type      = "api"
  subtype   = "http"
  status    = "live"
  message   = "API health check failed @pagerduty-critical"
  tags      = ["env:production", "service:api"]

  locations = ["aws:ap-northeast-1"]

  request_definition {
    method = "GET"
    url    = "https://api.example.com/health"
  }

  request_headers = {
    Accept = "application/json"
  }

  assertion {
    type     = "statusCode"
    operator = "is"
    target   = "200"
  }

  assertion {
    type     = "responseTime"
    operator = "lessThan"
    target   = "500"
  }

  assertion {
    type     = "body"
    operator = "validatesJSONPath"
    targetjsonpath {
      jsonpath    = "$.status"
      operator    = "is"
      targetvalue = "healthy"
    }
  }

  options_list {
    tick_every = 60  # every 1 minute
    retry {
      count    = 2
      interval = 300
    }
    monitor_options {
      renotify_interval = 120
    }
  }
}

resource "datadog_synthetics_test" "browser_checkout" {
  name      = "Checkout Flow Browser Test"
  type      = "browser"
  status    = "live"
  message   = "Checkout flow test failed @slack-alerts-warning"
  tags      = ["env:production", "service:frontend"]

  locations = ["aws:ap-northeast-1"]

  request_definition {
    method = "GET"
    url    = "https://www.example.com/products"
  }

  options_list {
    tick_every = 600  # every 10 minutes
  }

  browser_step {
    name = "Click product"
    type = "click"
    params {
      element = ".product-card:first-child"
    }
  }

  browser_step {
    name = "Add to cart"
    type = "click"
    params {
      element = "[data-testid='add-to-cart']"
    }
  }

  browser_step {
    name = "Verify cart count"
    type = "assertElementContent"
    params {
      element = "[data-testid='cart-count']"
      value   = "1"
    }
  }
}
```

---

## 7. Bundle Size Monitoring

### 7.1 webpack-bundle-analyzer + CI

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on:
  pull_request:
    branches: [main]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build and analyze
        run: npm run build -- --stats
        env:
          ANALYZE: true

      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          skip_step: build
```

```javascript
// .size-limit.js — バンドルサイズの上限設定
module.exports = [
  {
    name: 'Full Bundle',
    path: 'dist/**/*.js',
    limit: '300 KB',
    gzip: true,
  },
  {
    name: 'Initial JS',
    path: 'dist/assets/index-*.js',
    limit: '150 KB',
    gzip: true,
  },
  {
    name: 'Vendor Bundle',
    path: 'dist/assets/vendor-*.js',
    limit: '200 KB',
    gzip: true,
  },
  {
    name: 'CSS Bundle',
    path: 'dist/assets/*.css',
    limit: '50 KB',
    gzip: true,
  },
];
```

### 7.2 Visualizing Import Cost

```typescript
// scripts/analyze-imports.ts — インポートコストの分析
import { build } from 'esbuild';
import { gzipSync } from 'zlib';

interface ImportCost {
  package: string;
  size: number;
  gzipSize: number;
}

async function analyzeImport(packageName: string): Promise<ImportCost> {
  const result = await build({
    stdin: {
      contents: `export * from '${packageName}'`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'browser',
    external: ['react', 'react-dom'],
  });

  const code = result.outputFiles[0].contents;
  const gzipped = gzipSync(code);

  return {
    package: packageName,
    size: code.length,
    gzipSize: gzipped.length,
  };
}

// 分析対象のパッケージ
const packages = [
  'lodash',
  'lodash-es',
  'date-fns',
  'moment',
  'dayjs',
  'axios',
  '@tanstack/react-query',
  'zod',
];

async function main() {
  console.log('Package Import Cost Analysis\n');
  console.log('Package              | Raw Size  | Gzip Size');
  console.log('---------------------|-----------|----------');

  for (const pkg of packages) {
    try {
      const cost = await analyzeImport(pkg);
      const rawKB = (cost.size / 1024).toFixed(1);
      const gzipKB = (cost.gzipSize / 1024).toFixed(1);
      console.log(`${pkg.padEnd(21)}| ${rawKB.padStart(7)} KB | ${gzipKB.padStart(7)} KB`);
    } catch {
      console.log(`${pkg.padEnd(21)}| (error)    | (error)`);
    }
  }
}

main();
```

---

## 8. Comparison Tables

| Metric | APM (Backend) | RUM (Frontend) | Synthetic |
|--------|---------------|----------------|-----------|
| What is measured | Server processing | Real user experience | Script execution |
| Data volume | Medium | High | Low |
| Real-time capability | High | Medium (after aggregation) | Periodic execution |
| Environment variability | None | Depends on device/network | Controlled environment |
| Cost | Medium | Proportional to traffic | Proportional to executions |
| Use case | API latency / DB issues | UX degradation detection | Regression detection |

| RUM Tool Comparison | web-vitals (OSS) | Datadog RUM | New Relic Browser | Sentry |
|---------------------|-----------------|-------------|-------------------|--------|
| Core Web Vitals | Supported | Supported | Supported | Supported |
| Session Replay | No | Yes | Yes | Yes |
| Error Tracking | No | Yes | Yes | Rich |
| Pricing | Free | Paid | Paid | Free tier available |
| Bundle Size | Very small (1.5KB) | Medium (~30KB) | Medium (~30KB) | Medium (~20KB) |

| Synthetic Tool Comparison | Checkly | Datadog Synthetics | Grafana k6 | Playwright Test |
|--------------------------|---------|-------------------|-----------|----------------|
| API Testing | Supported | Supported | Supported | Limited |
| Browser Testing | Supported (Playwright) | Supported | Limited | Supported |
| Load Testing | Limited | Limited | Rich | No |
| Multi-region | Supported | Supported | Cloud only | No |
| CI/CD Integration | Rich | Supported | Rich | Native |
| Pricing | From $30/mo | Included | OSS (Cloud paid) | Free |

| Bundle Analysis Tool | size-limit | bundlesize | webpack-bundle-analyzer | source-map-explorer |
|---------------------|-----------|------------|------------------------|-------------------|
| CI Integration | GitHub Action | GitHub Action | Report generation | Report generation |
| Diff display | Yes | Yes | No | No |
| Visualization | No | No | Treemap | Treemap |
| Configuration flexibility | High | Medium | High | Low |

---

## 9. Anti-Patterns

### Anti-Pattern 1: Looking Only at Averages

```
[Bad Example]
- "Average response time is 200ms, no problem"
- But p99 exceeds 5 seconds (1 in 100 requests takes 5 seconds)
- High-value customers tend to make more requests and are more likely to experience slow responses

[Good Example]
- Monitor with percentiles:
  p50 (median):  Typical user experience
  p95:           Worst case for most users
  p99:           Tail latency (target for SLOs)
  p99.9:         Extreme cases (for debugging)

- Calculate percentiles with PromQL:
  histogram_quantile(0.99,
    sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
  )
```

### Anti-Pattern 2: Developing Without a Performance Budget

```
[Bad Example]
- "We can measure after release"
- Not noticing until the bundle size exceeds 2MB
- Nobody detects when LCP exceeds 5 seconds
- Cannot flag in PRs that "adding this library increased bundle size by 500KB"

[Good Example]
- Incorporate performance budgets into CI:
  - JS bundle: 300KB or less
  - Total images: 200KB or less
  - LCP: 2.5 seconds or less
  - INP: 200ms or less
- Block PRs (or add warning comments) when budget is exceeded
- Track scores continuously with Lighthouse CI
```

### Anti-Pattern 3: Measuring Only in Production

```
[Bad Example]
- In development, only manually check DevTools
- No performance testing in staging environment
- First notice of issues after production release
- Repeated rollbacks

[Good Example]
- Three stages of measurement:
  1. Development: Lighthouse DevTools + web-vitals logs
  2. CI/CD: Lighthouse CI + bundle size checks
  3. Production: RUM + Synthetic Monitoring + APM
- Load testing on staging environment (k6, Artillery)
- Early detection of performance regressions
```

### Anti-Pattern 4: Adding Third-Party Scripts Without a Plan

```
[Bad Example]
- Loading Google Analytics, GTM, Intercom, Hotjar, Facebook Pixel...
  on every page
- Each script is 50-200KB, totaling over 1MB
- Blocking the main thread and worsening INP
- "The marketing team added it" — no ownership

[Good Example]
- Audit third-party scripts (quarterly)
- Measure the impact of each script:
  - Effect on bundle size
  - Main thread blocking time
  - Impact on LCP/INP
- Use lazy loading:
  - Partytown (run in Web Worker)
  - Lazy initialization with IntersectionObserver
  - Async loading with requestIdleCallback
- Set a third-party allocation within your performance budget
```

---

## 10. Performance Testing (Load Testing)

### 10.1 Load Testing with k6

```javascript
// k6-load-test.js — k6 負荷テストスクリプト
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// カスタムメトリクス
const errorRate = new Rate('errors');
const orderLatency = new Trend('order_latency');

// テストシナリオ
export const options = {
  scenarios: {
    // 段階的な負荷増加
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // 2分で50 VU まで増加
        { duration: '5m', target: 50 },   // 5分間維持
        { duration: '2m', target: 100 },  // 2分で100 VU まで増加
        { duration: '5m', target: 100 },  // 5分間維持
        { duration: '2m', target: 200 },  // 2分で200 VU まで増加
        { duration: '5m', target: 200 },  // 5分間維持
        { duration: '3m', target: 0 },    // 3分で 0 に
      ],
    },
    // スパイクテスト
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '30s', target: 500 },  // 急激なスパイク
        { duration: '1m', target: 500 },
        { duration: '30s', target: 10 },   // 急激な減少
        { duration: '1m', target: 0 },
      ],
      startTime: '25m',  // ramp_up 完了後に開始
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // p95 < 500ms, p99 < 1s
    http_req_failed: ['rate<0.01'],  // エラーレート < 1%
    errors: ['rate<0.05'],  // カスタムエラーレート < 5%
    order_latency: ['p(95)<2000'],  // 注文レイテンシ p95 < 2s
  },
};

export default function () {
  // 1. 商品一覧の取得
  const productsRes = http.get('https://api.example.com/products', {
    headers: { 'Accept': 'application/json' },
  });
  check(productsRes, {
    'products: status 200': (r) => r.status === 200,
    'products: response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(productsRes.status !== 200);

  sleep(1);

  // 2. 商品詳細の取得
  const productId = Math.floor(Math.random() * 100) + 1;
  const productRes = http.get(`https://api.example.com/products/${productId}`);
  check(productRes, {
    'product: status 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 3. 注文の作成 (10% のユーザーのみ)
  if (Math.random() < 0.1) {
    const orderStart = Date.now();
    const orderRes = http.post(
      'https://api.example.com/orders',
      JSON.stringify({
        productId,
        quantity: 1,
        paymentMethod: 'credit_card',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    orderLatency.add(Date.now() - orderStart);

    check(orderRes, {
      'order: status 201': (r) => r.status === 201,
      'order: response time < 2s': (r) => r.timings.duration < 2000,
    });
    errorRate.add(orderRes.status !== 201);
  }

  sleep(Math.random() * 3);
}

// テスト結果の出力設定
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'k6-results.json': JSON.stringify(data),
  };
}
```

### 10.2 k6 CI Integration

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  schedule:
    - cron: '0 3 * * 1'  # Every Monday at 3:00 AM (12:00 JST)
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run k6 load test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/load/k6-load-test.js
        env:
          K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: k6-results.json

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Load test failed: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 11. FAQ

### Q1: Do I need both APM and RUM?

Yes, it is strongly recommended to implement both. APM identifies server-side problems (slow queries, external API timeouts), while RUM identifies client-side problems (slow networks, heavy JS execution). Because the reasons users perceive slowness exist on both sides, identifying the root cause is difficult with only one of them.

### Q2: How much do Core Web Vitals impact SEO?

Google uses Core Web Vitals as one of its ranking signals. However, they are not as important as content relevance. They play a "tiebreaker" role when competing pages have similar relevance. That said, improving CWV from a UX perspective directly leads to higher conversion rates and engagement, making it worth pursuing regardless of SEO.

### Q3: Is Synthetic Monitoring unnecessary if I already have RUM?

It is not unnecessary. Synthetic monitoring is excellent for detecting regressions because it "measures periodically in a controlled environment." RUM does not accumulate data for pages with little or no traffic (new pages, low-traffic pages). Synthetic monitoring also provides a "baseline" that can be compared against RUM data to isolate the effects of network and device differences in your analysis.

### Q4: What are appropriate values for a performance budget?

This depends on the industry and service characteristics, but general guidelines are: (1) LCP: 2.5 seconds or less (Google-recommended "Good" threshold), (2) INP: 200ms or less, (3) CLS: 0.1 or less, (4) JS bundle: 300KB or less (gzip), (5) total transfer size: 500KB or less. A practical approach is to first measure the current state and then set the budget to a value that is 10-20% better than the baseline.

### Q5: How often should load testing be performed?

It is recommended to perform regular load tests weekly or biweekly. When integrating into CI/CD, run tests on a staging environment that closely mirrors production. Always run additional tests before major releases, infrastructure changes, or anticipated traffic surges (sales, campaigns). It is important to compare results against the previous run.

### Q6: What is the most effective measure for improving frontend performance?

In most cases, the most effective approach is "eliminating unnecessary resources." Specifically, tackle these in order: (1) remove unused JavaScript (tree shaking, code splitting), (2) optimize images (WebP/AVIF, appropriate sizes), (3) reduce third-party scripts, (4) eliminate render-blocking resources. The key is to iterate through the measure → improve → measure cycle.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping straight to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| APM | Monitor backend p50/p95/p99 latency, throughput, and error rates |
| RUM | Collect Core Web Vitals and Navigation Timing from real users |
| Core Web Vitals | Target LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 |
| Lighthouse CI | Automatically measure performance scores per PR |
| Synthetic Monitoring | Detect regressions through periodic external monitoring |
| Performance Budget | Detect budget overruns in CI. Prevent regressions |
| Percentiles | Monitor p95/p99, not averages. Focus on tail latency |
| Load Testing | Regularly verify scalability with tools like k6 |
| Bundle Size | Integrate size-limit into CI. Target 300KB (gzip) |

---

## Further Reading

- [00-observability.md](./00-observability.md) — The three pillars of observability
- [01-monitoring-tools.md](./01-monitoring-tools.md) — Selecting and setting up monitoring tools
- [02-alerting.md](./02-alerting.md) — Alerting strategy and postmortems

---

## References

1. **Web Vitals** — https://web.dev/vitals/ — Google's official guide to Core Web Vitals
2. **High Performance Browser Networking** — Ilya Grigorik (O'Reilly, 2013) — Principles of browser networking
3. **web-vitals JavaScript Library** — https://github.com/GoogleChrome/web-vitals — CWV measurement library
4. **Lighthouse CI** — https://github.com/GoogleChrome/lighthouse-ci — Performance measurement tool for CI/CD
5. **k6 Documentation** — https://k6.io/docs/ — Official guide to the k6 load testing tool
6. **Checkly** — https://www.checklyhq.com/ — Synthetic Monitoring platform
7. **size-limit** — https://github.com/ai/size-limit — Bundle size limiting tool
8. **The RED Method** — https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/ — The RED method for microservices monitoring
