# API Monitoring and Logging

> API monitoring is the foundation for visualizing service quality and enabling stable operations. This guide systematically explains the monitoring framework that supports the reliability of production APIs — from measuring error rates, latency, and throughput through structured logging, distributed tracing, Prometheus/Grafana-based metrics visualization, and OpenTelemetry-based observability integration.

## What You Will Learn

- [ ] Understand the key API metrics (RED/USE) and the relationship between SLI/SLO/SLA
- [ ] Master the design principles and implementation patterns for structured logging
- [ ] Understand the mechanisms of distributed tracing and its implementation with OpenTelemetry
- [ ] Build metrics collection and visualization with Prometheus + Grafana
- [ ] Learn best practices for alert design and incident response
- [ ] Understand how to select and build a log aggregation platform (ELK/Loki)

---

## Prerequisites

- Basics of API testing → See: [API Testing](./00-api-testing.md)
- Understanding of HTTP status codes → See: HTTP Fundamentals
- Basic concepts of logging (structured logging, log levels)

---

## 1. The Three Pillars of Observability

Modern API monitoring is centered on the concept of "Observability." Observability is the ability to infer the internal state of a system from its external outputs (logs, metrics, traces).

```
+===========================================================================+
|                     The Three Pillars of Observability                    |
+===========================================================================+
|                                                                           |
|   +-------------------+  +-------------------+  +-------------------+     |
|   |      Logs         |  |     Metrics       |  |     Traces        |     |
|   +-------------------+  +-------------------+  +-------------------+     |
|   | - Discrete events |  | - Numeric data    |  | - Request tracking|     |
|   | - Text/JSON       |  | - Time-series agg.|  | - Cross-service   |     |
|   | - Debug-oriented  |  | - Alert-oriented  |  | - Dep. analysis   |     |
|   | - High cardinality|  | - Low overhead    |  | - Bottleneck id.  |     |
|   +--------+----------+  +--------+----------+  +--------+----------+     |
|            |                       |                       |              |
|            +----------+------------+-----------+-----------+              |
|                       |                        |                         |
|              +--------v--------+     +---------v--------+                |
|              |   Correlation   |     |   Exemplars      |                |
|              +-----------------+     +------------------+                |
|                       |                        |                         |
|              +--------v------------------------v--------+                |
|              |     Integrated Observability Platform    |                |
|              |  (Grafana / Datadog / New Relic / Splunk) |                |
|              +------------------------------------------+                |
+===========================================================================+
```

### 1.1 Role and Use of Each Pillar

| Aspect | Logs | Metrics | Traces |
|------|-------------|---------------------|-------------------|
| Data format | Text / structured JSON | Numeric (counter/gauge/histogram) | Tree structure of spans |
| Granularity | Individual event | Aggregated statistics | Per-request flow |
| Storage cost | High (all events saved) | Low (aggregated values only) | Medium (sampling possible) |
| Primary use | Debugging, auditing | Alerting, capacity planning | Bottleneck identification, dependency analysis |
| Representative tools | Elasticsearch, Loki | Prometheus, InfluxDB | Jaeger, Zipkin, Tempo |
| Cardinality | Very high | Low–medium | Medium–high |
| Real-time nature | Seconds | Seconds–minutes | Seconds |
| Recommended retention | 30–90 days | 13 months (long-term trends) | 7–30 days |

### 1.2 Correlating the Three Pillars

The true value of observability is realized by correlating the three pillars. For example, when a latency anomaly is detected in metrics, the ideal troubleshooting flow is to check the traces from that time to identify the bottleneck service, then dig into that service's logs to find the root cause.

```
Troubleshooting Flow:

  [Grafana Dashboard]            [Jaeger / Tempo]           [Elasticsearch / Loki]
  Anomaly detected in metrics    Trace analysis              Detailed log investigation
        |                              |                          |
        v                              v                          v
  P99 latency exceeds            Identify slow span          Identify root cause
  threshold                      (DB Query: 3.2s)            from logs
        |                              |                          |
        +------> Link via trace_id ----+----> Link via request_id +
        |                              |                          |
        v                              v                          v
  Get the relevant              Identify service name      Review stack trace and
  trace_id from exemplar        and operation from span    context information
```

---

## 2. Designing Key Metrics

### 2.1 The RED Method (for Request-Driven Services)

The RED method, proposed by Tom Wilkie (Grafana Labs), is a monitoring methodology for request-driven services. It is widely adopted as the optimal methodology for monitoring API services.

```
RED Method (Key Metrics for APIs):

  R — Rate (Request Rate):
     Definition: Number of requests per unit time
     Indicators:
       -> Requests per second (RPS, QPS)
       -> Breakdown by endpoint
       -> Breakdown by status code
       -> Breakdown by HTTP method
     PromQL examples:
       rate(http_requests_total[5m])
       sum by (path) (rate(http_requests_total[5m]))

  E — Errors (Error Rate):
     Definition: Percentage of failed requests
     Indicators:
       -> 5xx error rate (server-side cause)
       -> 4xx error rate (client-side cause)
       -> Timeout rate
       -> Circuit breaker activation rate
     PromQL example:
       rate(http_requests_total{status_code=~"5.."}[5m])
       / rate(http_requests_total[5m])

  D — Duration (Latency):
     Definition: Time taken to process a request
     Indicators:
       -> P50 (median): Typical user experience
       -> P95: Majority of user experiences
       -> P99: Tail latency
       -> P99.9: Near-worst-case value
     PromQL example:
       histogram_quantile(0.99,
         rate(http_request_duration_seconds_bucket[5m]))
```

### 2.2 The USE Method (for Resources)

The USE method, proposed by Brendan Gregg, is suited for monitoring infrastructure resources such as CPU, memory, disk, and network. Used alongside RED to understand the resource status of API servers.

| Resource | Utilization | Saturation | Errors |
|---------|---------------------|---------------------|-----------------|
| CPU | CPU utilization (%) | Run queue length | Machine check exceptions |
| Memory | Memory utilization (%) | Swap usage | OOM kill count |
| Disk I/O | I/O utilization (%) | I/O queue length | Device errors |
| Network | Bandwidth utilization (%) | Packet drops | CRC errors |
| File descriptors | FD utilization (%) | Socket queue | Connection refusals |

### 2.3 Defining and Operating SLI / SLO / SLA

SLI (Service Level Indicator), SLO (Service Level Objective), and SLA (Service Level Agreement) are a framework for quantitatively managing service reliability.

```
The SLI / SLO / SLA Hierarchy:

  +-------------------------------------------------------------------+
  |  SLA (Service Level Agreement)                                     |
  |  Contractual agreement: "Guarantees 99.9% availability.           |
  |  Credit refund in case of violation."                              |
  |                                                                    |
  |  +--------------------------------------------------------------+  |
  |  |  SLO (Service Level Objective)                                |  |
  |  |  Internal target: "Target 99.95% availability"               |  |
  |  |  * Set stricter than SLA to maintain a buffer                |  |
  |  |                                                               |  |
  |  |  +----------------------------------------------------------+ |  |
  |  |  |  SLI (Service Level Indicator)                            | |  |
  |  |  |  Measurement: "Successful responses / All responses"      | |  |
  |  |  +----------------------------------------------------------+ |  |
  |  +--------------------------------------------------------------+  |
  +-------------------------------------------------------------------+

  Typical SLIs:
    Availability SLI:  Successful responses / All responses
    Latency SLI:       Percentage of requests where P99 < threshold
    Quality SLI:       Responses with correct data / All responses
    Freshness SLI:     Responses with up-to-date data / All responses

  SLO Design Guidelines:
    Availability:  99.9% (allows 43 minutes of downtime per month)
    Latency:       P99 < 500ms achieved for 99% of the time
    Error rate:    < 0.1%

  Error Budget Concept:
    SLO of 99.9% → Error budget = 0.1%
    1 million requests/month → up to 1,000 failed requests allowed
    Decision-making based on consumption rate:
      -> Budget remaining:   Push new feature releases
      -> Budget being used:  Adjust release pace
      -> Budget exhausted:   Halt new features, focus on reliability
```

### 2.4 Correspondence with Golden Signals

Mapping the relationship to the Four Golden Signals defined by Google SRE.

| Golden Signal | RED Mapping | Description | Specific Metrics |
|--------------|---------|------|----------------|
| Latency | Duration | Request processing time | http_request_duration_seconds |
| Traffic | Rate | Request volume | http_requests_total |
| Errors | Errors | Error rate | http_errors_total |
| Saturation | (USE) | Resource saturation | cpu_usage, memory_usage |

---

## 3. Designing and Implementing Structured Logging

### 3.1 Why Structured Logging Is Necessary

Traditional plain-text logs are intuitive for humans to read but are not suitable for machine-based analysis. By adopting structured logs (in JSON format), searching, aggregating, and alerting in a log aggregation platform becomes easier.

```
Traditional plain-text log:
  2024-01-15 10:30:00 INFO [UserService] GET /api/v1/users 200 45ms uid=user_123

Structured log (JSON):
  {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "level": "info",
    "service": "user-service",
    "requestId": "req_abc123",
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
    "spanId": "00f067aa0ba902b7",
    "method": "GET",
    "path": "/api/v1/users",
    "statusCode": 200,
    "duration": 45,
    "userId": "user_123",
    "userAgent": "Mozilla/5.0..."
  }

Advantages of structured logging:
  -> Searchable:   path="/api/v1/users" AND statusCode>=500
  -> Aggregatable: AVG(duration) GROUP BY path
  -> Correlatable: Link to distributed traces via traceId
  -> Type-safe:    Numbers treated as numbers, strings as strings
  -> Extensible:   Easy to add fields
```

### 3.2 Log Level Design Guidelines

The use of log levels must be standardized within the team. Guidelines are shown below.

| Level | Purpose | Production output | Example |
|--------|------|------------------|-----|
| FATAL | Fatal errors requiring process shutdown | Always output | DB unreachable, config file read failure |
| ERROR | Processing failure but process can continue | Always output | API call failure, data inconsistency |
| WARN | Potential problems, situations requiring attention | Always output | Approaching rate limit, use of deprecated API |
| INFO | Normal business events | Always output | Request completed, batch processing completed |
| DEBUG | Detailed information for debugging | Normally disabled | SQL query contents, cache hit/miss |
| TRACE | Most detailed trace information | Normally disabled | Function input/output, variable values |

### 3.3 Implementing Structured Logging (Node.js / pino)

```javascript
// ===== Structured logging foundation implementation =====
import pino from 'pino';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

// Manage request context with AsyncLocalStorage
const asyncLocalStorage = new AsyncLocalStorage();

// Initialize the logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      service: process.env.SERVICE_NAME || 'api-service',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      hostname: bindings.hostname,
      pid: bindings.pid,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Optimize serialization for production
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  // Redact sensitive information
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.creditCard',
      'body.ssn',
    ],
    censor: '[REDACTED]',
  },
});

// Get logger with context
function getLogger() {
  const store = asyncLocalStorage.getStore();
  if (store && store.logger) {
    return store.logger;
  }
  return logger;
}

// Request logging middleware
function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  const traceId = req.headers['x-trace-id'] || randomUUID().replace(/-/g, '');
  const startTime = performance.now();

  // Set request information
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Generate a child logger with context
  const childLogger = logger.child({
    requestId,
    traceId,
    method: req.method,
    path: req.originalUrl,
  });

  req.log = childLogger;

  // Log request start
  childLogger.info({
    event: 'request_started',
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
  }, 'Incoming request');

  // Set context in AsyncLocalStorage
  asyncLocalStorage.run({ logger: childLogger, requestId, traceId }, () => {
    // Log when response completes
    res.on('finish', () => {
      const duration = performance.now() - startTime;
      const logData = {
        event: 'request_completed',
        statusCode: res.statusCode,
        duration: Math.round(duration * 100) / 100,
        contentLength: res.getHeader('content-length'),
        userId: req.user?.sub,
      };

      if (res.statusCode >= 500) {
        childLogger.error(logData, 'Server error response');
      } else if (res.statusCode >= 400) {
        childLogger.warn(logData, 'Client error response');
      } else {
        childLogger.info(logData, 'Successful response');
      }
    });

    next();
  });
}

// Output example:
// {
//   "level": "info",
//   "time": "2024-01-15T10:30:00.000Z",
//   "service": "user-service",
//   "version": "2.1.0",
//   "environment": "production",
//   "requestId": "req_abc123",
//   "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
//   "method": "GET",
//   "path": "/api/v1/users?limit=20",
//   "event": "request_completed",
//   "statusCode": 200,
//   "duration": 45.23,
//   "userId": "user_123"
// }
```

### 3.4 Implementing Structured Logging (Python / structlog)

```python
# ===== Structured logging implementation in Python (structlog + FastAPI) =====
import structlog
import uuid
import time
from contextvars import ContextVar
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variables
request_id_var: ContextVar[str] = ContextVar('request_id', default='')
trace_id_var: ContextVar[str] = ContextVar('trace_id', default='')

# structlog configuration
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        # Use JSON renderer in production
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    wrapper_class=structlog.make_filtering_bound_logger(
        structlog.get_config()["wrapper_class"]
    ),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

app = FastAPI()

class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for request/response logging"""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get(
            'x-request-id', str(uuid.uuid4())
        )
        trace_id = request.headers.get(
            'x-trace-id', uuid.uuid4().hex
        )

        # Set context variables
        request_id_var.set(request_id)
        trace_id_var.set(trace_id)

        # Bind to structlog context
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            trace_id=trace_id,
            method=request.method,
            path=str(request.url.path),
            service="user-service",
        )

        start_time = time.perf_counter()

        log = logger.bind()
        log.info(
            "request_started",
            user_agent=request.headers.get("user-agent"),
            client_ip=request.client.host,
        )

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000

            log_method = log.info
            if response.status_code >= 500:
                log_method = log.error
            elif response.status_code >= 400:
                log_method = log.warning

            log_method(
                "request_completed",
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )

            response.headers['X-Request-Id'] = request_id
            return response

        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            log.exception(
                "request_failed",
                duration_ms=round(duration_ms, 2),
                error=str(exc),
            )
            raise
```

### 3.5 Log Security and Privacy

It is a mandatory requirement not to include sensitive information in logs. The following fields must always be masked or excluded.

```
Classification of sensitive information and masking policy:

  Never log:
    -> Passwords, API keys, tokens
    -> Credit card numbers
    -> Social security numbers / national ID numbers
    -> Encryption keys, secrets

  Log with masking:
    -> Email addresses: u***@example.com
    -> Phone numbers: ***-****-1234
    -> IP addresses: 192.168.xxx.xxx (as needed)

  Safe to log as-is:
    -> Request ID, trace ID
    -> HTTP method, path, status code
    -> Latency, timestamp
    -> User ID (internal identifier)
    -> User-Agent
```

---

## 4. Designing and Implementing Distributed Tracing

### 4.1 Basic Concepts of Distributed Tracing

In a microservices architecture, a single user request is processed across multiple services. Distributed tracing is a technique for tracking and visualizing this entire request flow.

```
Structure of Distributed Tracing:

  Trace: The overall picture of one request
  |
  +-- Span A: API Gateway (start 0ms, end 60ms)
  |   |
  |   +-- Span B: Auth Service (start 2ms, end 12ms)
  |   |   |
  |   |   +-- Span C: Redis Cache Lookup (start 3ms, end 5ms)
  |   |   +-- Span D: JWT Verify (start 5ms, end 11ms)
  |   |
  |   +-- Span E: User Service (start 13ms, end 55ms)
  |       |
  |       +-- Span F: PostgreSQL Query (start 15ms, end 35ms)
  |       +-- Span G: Response Serialization (start 36ms, end 42ms)
  |       +-- Span H: Cache Write (start 43ms, end 50ms)

  Timeline view:
  |--A (API Gateway)----------------------------------------------|
    |--B (Auth)---------|
      |-C-| |-D-------|
                        |--E (User Service)----------------------|
                          |--F (DB Query)--------|
                                                  |-G-| |--H--|

  Information held by each Span:
    -> trace_id:       Unique identifier for the entire request (128-bit)
    -> span_id:        Unique identifier for the individual operation (64-bit)
    -> parent_span_id: ID of the parent span
    -> operation:      Operation name (e.g., "GET /api/users")
    -> start_time:     Start time
    -> end_time:       End time
    -> status:         Success/Error
    -> attributes:     Arbitrary attributes (key-value)
    -> events:         Events within the span (log-like information)
```

### 4.2 W3C Trace Context Standard

W3C Trace Context is a specification that standardizes context propagation for distributed tracing. It enables consistent tracing across different vendors' tracing tools.

```
W3C Trace Context Headers:

  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
               |  |                                |                  |
               |  |                                |                  +-- flags
               |  |                                |                      01 = sampled
               |  |                                +-- span-id (64-bit, 16 hex chars)
               |  +-- trace-id (128-bit, 32 hex chars)
               +-- version (always "00")

  tracestate: rojo=00f067aa0ba902b7,congo=t61rcWkgMzE
              Propagates vendor-specific additional information

  baggage: userId=user_123,tenantId=tenant_456
           Propagates application-specific context
```

### 4.3 Implementing Distributed Tracing with OpenTelemetry

OpenTelemetry (OTel) is an observability framework hosted by the CNCF that enables vendor-agnostic collection of telemetry data (traces, metrics, logs).

```javascript
// ===== Full OpenTelemetry Setup =====
// tracing.js - Load before application startup
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

// Define resource information
const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: process.env.SERVICE_NAME || 'user-service',
  [SEMRESATTRS_SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

// Configure the trace exporter
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: {
    // When authentication is required:
    // 'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`,
  },
});

// Configure the metrics exporter
const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 30000, // Export every 30 seconds
});

// Initialize the SDK
const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [
    new HttpInstrumentation({
      // Exclude unnecessary traces like health checks
      ignoreIncomingRequestHook: (req) => {
        return req.url === '/health' || req.url === '/metrics';
      },
      // Add custom attributes from response headers
      responseHook: (span, response) => {
        span.setAttribute('http.response.content_length',
          response.headers['content-length'] || 0);
      },
    }),
    new ExpressInstrumentation(),
    new PgInstrumentation({
      enhancedDatabaseReporting: true,
    }),
    new RedisInstrumentation(),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.error('Error shutting down tracing', error))
    .finally(() => process.exit(0));
});
```

### 4.4 Creating Custom Spans

Record business logic processing that cannot be captured by auto-instrumentation alone as custom spans.

```javascript
// ===== Example of creating custom spans =====
import { trace, SpanStatusCode, context } from '@opentelemetry/api';

const tracer = trace.getTracer('user-service', '1.0.0');

// Basic custom span
async function getUser(id) {
  return tracer.startActiveSpan('getUser', async (span) => {
    // Set attributes
    span.setAttribute('user.id', id);
    span.setAttribute('db.system', 'postgresql');

    try {
      // Database query
      const user = await tracer.startActiveSpan('db.query.findUser',
        async (dbSpan) => {
          dbSpan.setAttribute('db.statement', 'SELECT * FROM users WHERE id = $1');
          dbSpan.setAttribute('db.sql.table', 'users');

          const result = await db.users.findOne({ id });

          dbSpan.setAttribute('db.rows_affected', result ? 1 : 0);
          dbSpan.end();
          return result;
        }
      );

      if (!user) {
        span.setAttribute('user.found', false);
        span.addEvent('user_not_found', { 'user.id': id });
        return null;
      }

      // Write to cache
      await tracer.startActiveSpan('cache.write', async (cacheSpan) => {
        cacheSpan.setAttribute('cache.type', 'redis');
        cacheSpan.setAttribute('cache.key', `user:${id}`);
        await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
        cacheSpan.end();
      });

      span.setAttribute('user.found', true);
      span.setStatus({ code: SpanStatusCode.OK });
      return user;

    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Sampling strategy configuration
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

const sampler = new ParentBasedSampler({
  // Sample 10% of root spans (those without a parent)
  root: new TraceIdRatioBasedSampler(0.1),
});
```

### 4.5 Sampling Strategies

Collecting traces for all requests results in massive storage costs, so an appropriate sampling strategy is required.

| Sampling Method | Description | Use Case | Trade-offs |
|----------------|------|---------|------------|
| Always-on sampling | Collect all traces | Development environment, low traffic | High storage cost |
| Probability sampling | Collect a fixed percentage (e.g., 10%) | General production environment | May miss rare events |
| Rate limiting | Collect N traces per second | High-traffic environments | Coverage decreases during traffic spikes |
| Tail-based sampling | Prioritize collection of errors and slow requests | Large-scale production environments | Increased complexity at the Collector |
| Rule-based | Set sampling rate per endpoint | Complex API groups | Configuration management overhead |

---

## 5. Collecting Metrics with Prometheus

### 5.1 Prometheus Architecture

Prometheus is an open-source monitoring system managed by the CNCF, featuring pull-based metrics collection, a time-series database, and a powerful query language (PromQL).

```
Prometheus Architecture:

  +------------------+     +------------------+     +------------------+
  |  API Server A    |     |  API Server B    |     |  API Server C    |
  |  /metrics        |     |  /metrics        |     |  /metrics        |
  +--------+---------+     +--------+---------+     +--------+---------+
           |                        |                        |
           |   Pull (HTTP GET)      |                        |
           +------------------------+------------------------+
                                    |
                          +---------v---------+
                          |    Prometheus      |
                          |  +-------------+  |
                          |  | TSDB        |  |
                          |  | (time-series|  |
                          |  |  DB)        |  |
                          |  +-------------+  |
                          |  | PromQL      |  |
                          |  | (queries)   |  |
                          |  +-------------+  |
                          |  | Alert Rules |  |
                          |  +-------------+  |
                          +---------+---------+
                                    |
                     +--------------+--------------+
                     |                             |
           +---------v---------+         +---------v---------+
           |   Alertmanager    |         |     Grafana       |
           |  (notification    |         |  (visualization)  |
           |   management)     |         +-------------------+
           +---------+---------+
                     |
          +----------+----------+
          |          |          |
       Slack     PagerDuty   Email
```

### 5.2 Metric Types and When to Use Each

Prometheus has 4 types of metrics. It is important to understand the characteristics of each and use them appropriately.

| Type | Description | Use | Notes |
|---|------|------|-------|
| Counter | Monotonically increasing cumulative value | Request count, error count | Resets only on restart. Use rate() to see the rate of change |
| Gauge | Current value that can increase or decrease | CPU utilization, connection count, queue size | Snapshot value. Can be displayed directly |
| Histogram | Observe distribution of values (buckets) | Latency, response size | Bucket boundary design is important |
| Summary | Calculates percentiles on the client side | Latency (when server-side aggregation is not needed) | Cannot be aggregated. Histogram is recommended |

### 5.3 Implementing API Metrics Instrumentation

```javascript
// ===== Prometheus metrics instrumentation (prom-client) =====
import {
  Registry, Counter, Histogram, Gauge, Summary,
  collectDefaultMetrics
} from 'prom-client';

const registry = new Registry();

// Collect default metrics for the Node.js runtime
collectDefaultMetrics({
  register: registry,
  prefix: 'api_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ----- Define custom metrics -----

// Request counter
const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
  registers: [registry],
});

// Latency histogram
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'],
  // Bucket design appropriate for latency distribution
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

// Active connections (gauge)
const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [registry],
});

// Response size histogram
const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'path'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
  registers: [registry],
});

// DB query counter
const dbQueryTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [registry],
});

// DB query latency
const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [registry],
});

// External API calls
const externalApiDuration = new Histogram({
  name: 'external_api_duration_seconds',
  help: 'External API call duration in seconds',
  labelNames: ['service', 'method', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

// Cache hit rate
const cacheOperations = new Counter({
  name: 'cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result'], // result: hit, miss, error
  registers: [registry],
});

// Business metrics example
const userRegistrations = new Counter({
  name: 'user_registrations_total',
  help: 'Total user registrations',
  labelNames: ['method'], // method: email, google, github
  registers: [registry],
});

// ----- Middleware -----
function metricsMiddleware(req, res, next) {
  activeConnections.inc();
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    // Normalize path (replace path params with :param)
    const normalizedPath = req.route?.path || normalizePath(req.path);
    const labels = {
      method: req.method,
      path: normalizedPath,
      status_code: res.statusCode,
    };

    httpRequestTotal.inc(labels);
    end(labels);
    activeConnections.dec();

    // Record response size
    const contentLength = parseInt(res.getHeader('content-length') || '0', 10);
    if (contentLength > 0) {
      httpResponseSize.observe(
        { method: req.method, path: normalizedPath },
        contentLength
      );
    }
  });

  next();
}

// Path normalization (prevent high cardinality)
function normalizePath(path) {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/:id')
    .replace(/\/\d+/g, '/:id');
}

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

### 5.4 PromQL Queries in Practice

PromQL is Prometheus's query language used to select, aggregate, and transform time-series data. The following shows frequently used query patterns.

```
PromQL Common Query Collection:

  ===== Rate / Throughput =====

  # Overall request rate (5-minute moving average)
  rate(http_requests_total[5m])

  # Request rate by endpoint
  sum by (path) (rate(http_requests_total[5m]))

  # Request rate by HTTP method
  sum by (method) (rate(http_requests_total[5m]))

  ===== Error Rate =====

  # 5xx error rate
  sum(rate(http_requests_total{status_code=~"5.."}[5m]))
  /
  sum(rate(http_requests_total[5m]))

  # Error rate by endpoint
  sum by (path) (rate(http_requests_total{status_code=~"5.."}[5m]))
  /
  sum by (path) (rate(http_requests_total[5m]))

  # Rate of specific error code (429: Rate Limit)
  sum(rate(http_requests_total{status_code="429"}[5m]))

  ===== Latency (Percentile) =====

  # P50 (median)
  histogram_quantile(0.50,
    sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

  # P95
  histogram_quantile(0.95,
    sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

  # P99
  histogram_quantile(0.99,
    sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

  # P99 by endpoint
  histogram_quantile(0.99,
    sum by (le, path) (rate(http_request_duration_seconds_bucket[5m])))

  ===== Saturation =====

  # Active connections
  http_active_connections

  # Node.js event loop lag
  api_nodejs_eventloop_lag_seconds

  # Memory usage
  api_process_resident_memory_bytes
  / on() group_left()
  machine_memory_bytes

  ===== SLO Related =====

  # Availability SLI (30-day rolling)
  1 - (
    sum(increase(http_requests_total{status_code=~"5.."}[30d]))
    /
    sum(increase(http_requests_total[30d]))
  )

  # Remaining error budget (SLO 99.9%)
  1 - (
    sum(increase(http_requests_total{status_code=~"5.."}[30d]))
    /
    sum(increase(http_requests_total[30d]))
  ) - 0.999

  # Error budget consumption rate (per hour)
  (
    sum(rate(http_requests_total{status_code=~"5.."}[1h]))
    /
    sum(rate(http_requests_total[1h]))
  ) / 0.001

  ===== Database =====

  # DB query rate
  sum by (operation) (rate(db_queries_total[5m]))

  # DB query P95 latency
  histogram_quantile(0.95,
    sum by (le, table) (rate(db_query_duration_seconds_bucket[5m])))

  # Proportion of slow queries (over 1 second)
  sum(rate(db_query_duration_seconds_bucket{le="1"}[5m]))
  /
  sum(rate(db_query_duration_seconds_count[5m]))

  ===== Cache =====

  # Cache hit rate
  sum(rate(cache_operations_total{result="hit"}[5m]))
  /
  sum(rate(cache_operations_total{result=~"hit|miss"}[5m]))
```

### 5.5 Prometheus Configuration

```yaml
# ===== prometheus.yml =====
global:
  scrape_interval: 15s        # Metrics collection interval
  evaluation_interval: 15s    # Rule evaluation interval
  scrape_timeout: 10s         # Scrape timeout

# Specify alert rule files
rule_files:
  - "rules/api_alerts.yml"
  - "rules/slo_alerts.yml"

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - "alertmanager:9093"

# Scrape target configuration
scrape_configs:
  # API servers
  - job_name: 'api-servers'
    metrics_path: '/metrics'
    scrape_interval: 10s
    static_configs:
      - targets:
          - 'api-server-1:3000'
          - 'api-server-2:3000'
          - 'api-server-3:3000'
        labels:
          cluster: 'production'
          region: 'ap-northeast-1'

    # For Kubernetes Service Discovery:
    # kubernetes_sd_configs:
    #   - role: pod
    # relabel_configs:
    #   - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    #     action: keep
    #     regex: true

  # Node Exporter (infrastructure metrics)
  - job_name: 'node-exporter'
    static_configs:
      - targets:
          - 'node-exporter:9100'

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets:
          - 'postgres-exporter:9187'

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets:
          - 'redis-exporter:9121'
```

---

## 6. Dashboard Design with Grafana

### 6.1 Principles for API Dashboard Structure

An effective dashboard has a structure that allows you to quickly identify the cause of a problem when one occurs. A hierarchical structure of "Overview → Detail → Root Cause" is recommended.

```
Hierarchical Structure of an API Dashboard:

  Level 1: Overview Dashboard
  +================================================================+
  |  [Availability]  [Requests/sec]   [P99 Latency]   [Error Rate] |
  |   99.95%           1,245 RPS         123ms           0.03%     |
  +================================================================+
  |                                                                 |
  |  [RPS Graph]                   [Latency Distribution Graph]     |
  |  ~~~~~~~~                      ~~P50~~~~                        |
  |  ~~~~~~~~~~                    ~~~~P95~~~~~                     |
  |  ~~~~~~~~~~~~                  ~~~~~~P99~~~~~~~                 |
  |                                                                 |
  |  [Error Rate Graph]            [Active Connections Graph]       |
  |  __/\___                       ~~~~~~~~~                        |
  |  _______/\_                    ~~~~~~~~~~~                      |
  +================================================================+

  Level 2: Endpoint Dashboard (by endpoint)
  +================================================================+
  |  RPS / Latency / Error Rate Table by Endpoint                   |
  |                                                                 |
  |  Path              RPS    P50    P99    Error%   Status         |
  |  GET /api/users    320    12ms   89ms   0.01%    OK             |
  |  POST /api/orders  180    45ms   230ms  0.05%    OK             |
  |  GET /api/products 450    8ms    45ms   0.02%    OK             |
  |  POST /api/auth    290    23ms   510ms  0.15%    WARN           |
  +================================================================+

  Level 3: Service Dependencies
  +================================================================+
  |  [DB Query P99]   [Redis Latency]   [External API Latency]      |
  |                                                                 |
  |  [DB Connection Pool Utilization]  [Cache Hit Rate]             |
  +================================================================+

  Level 4: Infrastructure
  +================================================================+
  |  [CPU Usage]  [Memory Usage]  [Disk I/O]  [Network Bandwidth]  |
  +================================================================+
```

### 6.2 Grafana Dashboard JSON Provisioning

```json
{
  "dashboard": {
    "title": "API Overview Dashboard",
    "tags": ["api", "production"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "Request Rate (RPS)",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m]))",
            "legendFormat": "Total RPS"
          },
          {
            "expr": "sum by (status_code) (rate(http_requests_total[5m]))",
            "legendFormat": "{{status_code}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "custom": {
              "drawStyle": "line",
              "lineInterpolation": "smooth",
              "fillOpacity": 10
            }
          }
        }
      },
      {
        "title": "Latency Percentiles",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
            "legendFormat": "P50"
          },
          {
            "expr": "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
            "legendFormat": "P95"
          },
          {
            "expr": "histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
            "legendFormat": "P99"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "custom": {
              "drawStyle": "line",
              "lineInterpolation": "smooth"
            }
          }
        }
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "gridPos": { "h": 4, "w": 6, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
            "legendFormat": "Error Rate %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 0.1 },
                { "color": "red", "value": 1 }
              ]
            }
          }
        }
      }
    ]
  }
}
```

---

## 7. Alert Design

### 7.1 Principles of Alert Design

Effective alerts must be "actionable." Alerts where the recipient does not know clearly what to do lead to alert fatigue, causing truly important alerts to be missed.

```
5 Principles of Alert Design:

  1. Be actionable
     -> Clear what the person receiving the alert should do
     -> Do not alert on things that auto-recover
     -> Link to a Runbook (response procedures)

  2. Be SLO-based
     -> Alert based on error budget consumption rate
     -> Do not fire on momentary spikes
     -> Detect sustained quality degradation

  3. Have appropriate severity
     -> Critical: Immediate action required (page notification)
     -> Warning: Handle during business hours
     -> Info: Record only (no notification needed)

  4. Eliminate duplicates
     -> Group alerts with the same root cause
     -> Higher-level alerts encompass lower-level ones
     -> Suppress cascading alert firing

  5. Review periodically
     -> Consider deleting alerts that never fire
     -> Adjust thresholds for frequently false-positive alerts
     -> Evaluate alert effectiveness in post-incident analysis
```

### 7.2 Implementing Alert Rules (Prometheus Alerting Rules)

```yaml
# ===== rules/api_alerts.yml =====
groups:
  - name: api_availability
    rules:
      # ----- Critical Alerts -----

      # 5xx error rate exceeds 5% (sustained for 5 minutes)
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status_code=~"5.."}[5m]))
          /
          sum(rate(http_requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "High 5xx error rate detected"
          description: >
            Error rate is {{ $value | humanizePercentage }}
            (threshold: 5%). This indicates a significant service
            degradation affecting users.
          runbook_url: "https://wiki.example.com/runbooks/high-error-rate"
          dashboard_url: "https://grafana.example.com/d/api-overview"

      # P99 latency exceeds 5 seconds (sustained for 5 minutes)
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99,
            sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
          ) > 5
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "P99 latency exceeds 5 seconds"
          description: >
            P99 latency is {{ $value | humanizeDuration }}.
            Check database queries and external API calls.
          runbook_url: "https://wiki.example.com/runbooks/high-latency"

      # Service down (metrics unreachable)
      - alert: ServiceDown
        expr: up{job="api-servers"} == 0
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "API server is down"
          description: "Instance {{ $labels.instance }} is unreachable."

      # ----- Warning Alerts -----

      # Error budget consumption rate exceeds 2% per day
      - alert: ErrorBudgetBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status_code=~"5.."}[1h]))
            /
            sum(rate(http_requests_total[1h]))
          ) > 14.4 * 0.001
        for: 5m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "Error budget burn rate is high"
          description: >
            Current burn rate will exhaust the monthly error budget
            in less than 2 days.

      # P99 latency exceeds 1 second
      - alert: ElevatedLatency
        expr: |
          histogram_quantile(0.99,
            sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
          ) > 1
        for: 10m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "P99 latency exceeds 1 second"

      # Disk usage over 80%
      - alert: DiskSpaceWarning
        expr: |
          (node_filesystem_avail_bytes{mountpoint="/"}
          / node_filesystem_size_bytes{mountpoint="/"}) < 0.2
        for: 15m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Disk space is running low"

      # DB connection pool nearly exhausted
      - alert: DBConnectionPoolExhaustion
        expr: |
          pg_stat_activity_count / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "Database connection pool is nearly exhausted"

  - name: api_slo
    rules:
      # SLO availability (30-day rolling)
      - record: slo:availability:ratio30d
        expr: |
          1 - (
            sum(increase(http_requests_total{status_code=~"5.."}[30d]))
            /
            sum(increase(http_requests_total[30d]))
          )

      # SLO latency (P99 < 500ms achievement rate)
      - record: slo:latency:ratio30d
        expr: |
          sum(increase(http_request_duration_seconds_bucket{le="0.5"}[30d]))
          /
          sum(increase(http_request_duration_seconds_count[30d]))

      # Remaining error budget
      - record: slo:error_budget:remaining
        expr: |
          1 - (
            (1 - slo:availability:ratio30d) / (1 - 0.999)
          )
```

### 7.3 Alertmanager Configuration

```yaml
# ===== alertmanager.yml =====
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/xxx/yyy/zzz'

# Notification templates
templates:
  - '/etc/alertmanager/templates/*.tmpl'

# Routing configuration
route:
  # Default receiver
  receiver: 'slack-default'
  # Labels to group by
  group_by: ['alertname', 'team']
  # Wait time for grouping
  group_wait: 30s
  # Re-notification interval for the same group
  group_interval: 5m
  # Re-notification interval for the same alert
  repeat_interval: 4h

  routes:
    # Critical alerts → PagerDuty + Slack
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      group_wait: 10s
      repeat_interval: 1h
      continue: true  # Also evaluate subsequent routes

    - match:
        severity: critical
      receiver: 'slack-critical'

    # Warning alerts → Slack only
    - match:
        severity: warning
      receiver: 'slack-warning'
      repeat_interval: 8h

# Alert suppression rules
inhibit_rules:
  # While ServiceDown is firing, suppress other alerts for the same instance
  - source_match:
      alertname: 'ServiceDown'
    target_match_re:
      alertname: '.+'
    equal: ['instance']

# Receiver definitions
receivers:
  - name: 'slack-default'
    slack_configs:
      - channel: '#alerts-info'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.summary }}'

  - name: 'slack-critical'
    slack_configs:
      - channel: '#alerts-critical'
        title: '[CRITICAL] {{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
        color: 'danger'

  - name: 'slack-warning'
    slack_configs:
      - channel: '#alerts-warning'
        title: '[WARNING] {{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.summary }}'
        color: 'warning'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - routing_key: 'YOUR_PAGERDUTY_INTEGRATION_KEY'
        severity: 'critical'
        description: '{{ .CommonAnnotations.summary }}'
```

---

## 8. Building a Log Aggregation Platform

### 8.1 Comparison of Log Aggregation Architectures

| Item | ELK Stack | Grafana Loki | Datadog Logs |
|------|-----------|-------------|--------------|
| Composition | Elasticsearch + Logstash + Kibana | Loki + Promtail + Grafana | SaaS (managed) |
| Indexing method | Full-text search index | Labels only | Full-text search |
| Storage cost | High (all fields indexed) | Low (log content not indexed) | Usage-based billing |
| Query speed | Fast (indexed) | Label search is fast; content search is slightly slower | Fast |
| Operational burden | High (Elasticsearch cluster management) | Low (simple architecture) | None (SaaS) |
| Grafana integration | Possible via plugin | Native integration | Possible via plugin |
| Applicable scale | Medium–large | Small–large | All scales |

### 8.2 Log Aggregation with Grafana Loki

Loki is a log aggregation system developed by Grafana Labs, sometimes called "Prometheus for logs." By indexing only metadata (labels) and storing log content as-is, it can handle large amounts of logs at low cost.

```yaml
# ===== Loki + Promtail Docker Compose configuration =====
version: "3.8"

services:
  loki:
    image: grafana/loki:2.9.4
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/config.yml
      - loki-data:/loki
    command: -config.file=/etc/loki/config.yml

  promtail:
    image: grafana/promtail:2.9.4
    volumes:
      - ./promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:10.3.1
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin

volumes:
  loki-data:
  grafana-data:
```

```yaml
# ===== promtail-config.yml =====
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: api-logs
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_label_service']
        target_label: 'service'
    pipeline_stages:
      # Parse JSON logs
      - json:
          expressions:
            level: level
            requestId: requestId
            traceId: traceId
            method: method
            path: path
            statusCode: statusCode
            duration: duration
      # Extract as labels
      - labels:
          level:
          service:
          method:
          statusCode:
      # Set timestamp
      - timestamp:
          source: time
          format: RFC3339Nano
      # Generate metrics (derive metrics from logs)
      - metrics:
          log_lines_total:
            type: Counter
            description: "Total log lines"
            source: level
            config:
              match_all: true
              action: inc
          request_duration_from_logs:
            type: Histogram
            description: "Request duration from logs"
            source: duration
            config:
              buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000]
```

### 8.3 LogQL Queries in Practice

LogQL is Loki's query language, which uses a syntax similar to PromQL to search and aggregate logs.

```
LogQL Common Query Collection:

  ===== Selecting Log Streams =====

  # Filter by service name
  {service="user-service"}

  # Multiple conditions
  {service="user-service", level="error"}

  # Regex match
  {service=~"user-.*|order-.*"}

  ===== Filtering Log Lines =====

  # Text search (contains)
  {service="user-service"} |= "timeout"

  # Text search (does not contain)
  {service="user-service"} != "healthcheck"

  # Regex filter
  {service="user-service"} |~ "status_code=(5[0-9]{2})"

  ===== JSON Parse + Filter =====

  # Filter by JSON field
  {service="user-service"}
    | json
    | statusCode >= 500

  # Errors for a specific path
  {service="user-service"}
    | json
    | path="/api/v1/orders"
    | statusCode >= 500

  # Slow requests (500ms or more)
  {service="user-service"}
    | json
    | duration > 500

  ===== Metric Queries (Aggregation) =====

  # Error log occurrence rate
  rate({service="user-service", level="error"}[5m])

  # Request count by endpoint
  sum by (path) (
    count_over_time(
      {service="user-service"}
        | json
        | __error__=""
      [5m]
    )
  )

  # P99 latency (calculated from logs)
  quantile_over_time(0.99,
    {service="user-service"}
      | json
      | unwrap duration
    [5m]
  ) by (path)
```

---

## 9. OpenTelemetry Collector Configuration

The OpenTelemetry Collector is an agent that receives, processes, and exports telemetry data (traces, metrics, logs). By placing it between the application and the backend, you can build a vendor-agnostic data pipeline.

```
OpenTelemetry Collector Architecture:

  +----------------+   +----------------+   +----------------+
  |  API Server A  |   |  API Server B  |   |  API Server C  |
  |  (OTLP gRPC)   |   |  (OTLP HTTP)   |   |  (OTLP gRPC)   |
  +-------+--------+   +-------+--------+   +-------+--------+
          |                     |                     |
          +---------------------+---------------------+
                                |
                 +--------------v--------------+
                 |    OTel Collector           |
                 |  +-----------------------+  |
                 |  | Receivers             |  |
                 |  | - OTLP (gRPC/HTTP)    |  |
                 |  | - Prometheus           |  |
                 |  | - Jaeger               |  |
                 |  +-----------+-----------+  |
                 |              |               |
                 |  +-----------v-----------+  |
                 |  | Processors            |  |
                 |  | - Batch               |  |
                 |  | - Memory Limiter      |  |
                 |  | - Attributes          |  |
                 |  | - Filter              |  |
                 |  | - Tail Sampling       |  |
                 |  +-----------+-----------+  |
                 |              |               |
                 |  +-----------v-----------+  |
                 |  | Exporters             |  |
                 |  | - OTLP                |  |
                 |  | - Prometheus          |  |
                 |  | - Jaeger              |  |
                 |  | - Loki                |  |
                 |  +-----------------------+  |
                 +-----------------------------+
                                |
              +-----------------+------------------+
              |                 |                  |
    +---------v------+  +------v-------+  +-------v------+
    |  Prometheus    |  |   Jaeger     |  |    Loki      |
    |  (Metrics)     |  |  (Traces)    |  |   (Logs)     |
    +----------------+  +--------------+  +--------------+
```

```yaml
# ===== otel-collector-config.yml =====
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "0.0.0.0:4317"
      http:
        endpoint: "0.0.0.0:4318"

  # Can also receive Prometheus metrics
  prometheus:
    config:
      scrape_configs:
        - job_name: 'otel-collector'
          scrape_interval: 10s
          static_configs:
            - targets: ['0.0.0.0:8888']

processors:
  # Batch processing (performance optimization)
  batch:
    timeout: 5s
    send_batch_size: 1024
    send_batch_max_size: 2048

  # Memory limit
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

  # Add and transform attributes
  attributes:
    actions:
      - key: environment
        value: production
        action: upsert
      - key: cluster
        value: ap-northeast-1
        action: upsert

  # Filter unnecessary data
  filter:
    error_mode: ignore
    traces:
      span:
        - 'attributes["http.target"] == "/health"'
        - 'attributes["http.target"] == "/metrics"'

  # Tail-based sampling
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    policies:
      # Collect all errors
      - name: errors
        type: status_code
        status_code:
          status_codes: [ERROR]
      # Collect all slow requests
      - name: slow-requests
        type: latency
        latency:
          threshold_ms: 1000
      # Sample 10% of everything else
      - name: probabilistic
        type: probabilistic
        probabilistic:
          sampling_percentage: 10

exporters:
  # Traces -> Jaeger
  otlp/jaeger:
    endpoint: "jaeger:4317"
    tls:
      insecure: true

  # Metrics -> Prometheus
  prometheusremotewrite:
    endpoint: "http://prometheus:9090/api/v1/write"

  # Logs -> Loki
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"

  # Debug log output
  logging:
    loglevel: info

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, filter, tail_sampling, attributes]
      exporters: [otlp/jaeger, logging]
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch, attributes]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [loki]

  telemetry:
    logs:
      level: info
    metrics:
      address: ":8888"
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Excessive Log Output and High Cardinality

**Symptoms**: Log storage grows rapidly and search performance degrades. Prometheus memory is exhausted due to label explosion in metrics.

```
Problematic log output:

  // Include the entire request body in logs
  logger.info({
    event: 'request',
    body: req.body,         // Massive amounts of data flow into logs
    headers: req.headers,   // May contain sensitive information
    query: req.query,
  });

  // Debug logs left enabled in production
  logger.debug({ cache: entireCacheContents }); // Huge object

Problematic metric labels:

  // Include user ID in labels (high cardinality)
  httpRequestTotal.inc({
    method: req.method,
    path: req.originalUrl,  // Including query params -> infinite label combinations
    userId: req.user.id,    // One label value per user
    requestId: req.id,      // Unique per request -> fatal
  });

  Result:
    -> Prometheus memory usage grows exponentially
    -> Query speed degrades significantly
    -> Cardinality explosion

Correct design:

  // Logs: Limit to the minimum necessary fields
  logger.info({
    event: 'request_completed',
    method: req.method,
    path: req.route?.path,  // Template path (/users/:id)
    statusCode: res.statusCode,
    duration: durationMs,
    userId: req.user?.id,   // OK for logs (not for metrics)
  });

  // Metrics: Only low-cardinality labels
  httpRequestTotal.inc({
    method: req.method,
    path: req.route?.path || normalizePath(req.path),
    status_code: res.statusCode,
  });
```

### Anti-Pattern 2: Alert Fatigue from Poor Alert Configuration

**Symptoms**: A flood of unnecessary alerts exhausts on-call engineers. Important alerts are buried in noise and missed.

```
Problematic alert configuration:

  1. Threshold too strict:
     alert: HighLatency
     expr: histogram_quantile(0.99, ...) > 0.1   # 100ms is too strict
     for: 1m                                       # 1 minute is too fast to fire
     -> Fires frequently on transient spikes

  2. Unclear action:
     annotations:
       summary: "Something went wrong"   # Unclear what is wrong
       # no runbook_url                  # Unclear how to respond
     -> Recipient doesn't know what to do

  3. Duplicate alerts:
     DB connection error -> All of the following fire simultaneously:
       - DBConnectionError
       - HighErrorRate
       - SlowQueries
       - ServiceDegraded
       - SLOViolation
     -> 5 alerts for a single root cause

  4. Alert on auto-recovering problems:
     Transient network disconnect -> Auto-retry recovers it
     -> Unnecessary alert firing

Correct alert design:

  1. Appropriate thresholds and duration:
     alert: HighLatency
     expr: histogram_quantile(0.99, ...) > 1     # 1 second is reasonable
     for: 10m                                      # 10 minutes to be certain

  2. Clear annotations:
     annotations:
       summary: "P99 latency exceeds 1s for 10 minutes"
       description: "Current P99: {{ $value }}s. Check DB and cache."
       runbook_url: "https://wiki.example.com/runbooks/high-latency"
       dashboard_url: "https://grafana.example.com/d/api"

  3. Suppression rules (Inhibition):
     While DBConnectionError is firing -> suppress derived alerts

  4. Only actionable items:
     Auto-recovering problems -> record as metrics, not alerts
```

---

## 11. Edge Case Analysis

### Edge Case 1: Timing Discrepancies in Metrics Collection and Sampling Pitfalls

Since Prometheus collects metrics via pull, short-duration spikes that occur between scrape intervals may not be captured. Also, if histogram bucket design is inappropriate, percentile values may have large errors.

```
Problem: Poor histogram bucket design

  Configuration:
    buckets: [0.1, 1, 10]  // Only 3 buckets

  Actual distribution:
    0-50ms:   80% of requests
    50-100ms: 15% of requests
    100-200ms: 4% of requests
    200ms+:    1% of requests

  P99 calculation result:
    -> 99% falls within the 0.1s (100ms) bucket
    -> P99 reported as approximately 100ms
    -> Actual P99 is approximately 180ms (large error)

  Remedy:
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    -> Design fine-grained buckets appropriate for the latency distribution
    -> The default buckets (above) are appropriate for most APIs

Problem: Error from scrape interval and rate calculation

  Scrape interval: 15 seconds
  Actual request pattern:
    0-5s:  100 req/s (spike)
    5-15s: 10 req/s (normal)

  Result of rate(http_requests_total[1m]):
    -> Approximately 40 req/s (averaged out)
    -> The 100 req/s spike cannot be observed

  Remedies:
    -> Use irate() to calculate the instantaneous rate
    -> Shorten the scrape interval (to 5 seconds, etc.; increases resource consumption)
    -> Also record metrics on the application side
```

### Edge Case 2: Context Loss in Distributed Tracing

In asynchronous processing or communication via message queues, trace context is easily lost. Especially in event-driven architectures, explicit context propagation is necessary.

```
Problem: Context loss via message queue

  [API Server] --HTTP--> [Order Service] --Kafka--> [Payment Service]
       |                       |                          |
    trace_id: abc123      trace_id: abc123           trace_id: ???
    span_id:  001         span_id:  002              (context lost)

  Cause:
    -> Trace context not included in Kafka messages
    -> Context not restored on the consumer side

  Remedy: Embed context in message headers

    // Producer side
    import { propagation, context } from '@opentelemetry/api';

    async function publishToKafka(topic, message) {
      return tracer.startActiveSpan('kafka.produce', async (span) => {
        span.setAttribute('messaging.system', 'kafka');
        span.setAttribute('messaging.destination', topic);

        // Inject current context into headers
        const headers = {};
        propagation.inject(context.active(), headers);

        await producer.send({
          topic,
          messages: [{
            value: JSON.stringify(message),
            headers,  // Headers containing trace context
          }],
        });

        span.end();
      });
    }

    // Consumer side
    async function consumeFromKafka(message) {
      // Restore context from headers
      const parentContext = propagation.extract(
        context.active(),
        message.headers
      );

      // Create a new span with the restored context as parent
      return context.with(parentContext, () => {
        return tracer.startActiveSpan('kafka.consume', async (span) => {
          span.setAttribute('messaging.system', 'kafka');

          // Business logic
          await processPayment(JSON.parse(message.value));

          span.end();
        });
      });
    }

Problem: Context loss with setTimeout / setInterval

  Remedy:
    import { context } from '@opentelemetry/api';

    // Explicitly propagate context
    const currentContext = context.active();
    setTimeout(() => {
      context.with(currentContext, () => {
        // Trace context is preserved here
        doSomething();
      });
    }, 5000);
```

---

## 12. Exercises

### Exercise 1: Basic — Implementing Structured Logging

Implement a logging middleware in Express.js that satisfies the following requirements.

```
Requirements:
  1. Output structured logs in JSON format
  2. Assign a unique requestId to each request
  3. Record the following information when a response completes:
     - method, path, statusCode, duration(ms)
     - userId (if authenticated)
  4. Change the log level based on status code:
     - 5xx -> error
     - 4xx -> warn
     - Other -> info
  5. Mask sensitive information such as passwords and tokens

Hints:
  - Use pino or winston
  - Detect response completion with res.on('finish', callback)
  - Exclude sensitive information with pino's redact option

Verification Points:
  -> Are logs output in JSON format?
  -> Is requestId included in all logs?
  -> Is sensitive information masked?
  -> Are log levels set appropriately?
```

### Exercise 2: Intermediate — Prometheus Metrics and Alert Design

Build an API monitoring infrastructure that satisfies the following requirements.

```
Requirements:
  1. Instrument the following metrics with prom-client:
     - http_requests_total (Counter)
     - http_request_duration_seconds (Histogram)
     - http_active_connections (Gauge)
     - db_query_duration_seconds (Histogram)
  2. Expose a /metrics endpoint
  3. Configure the following alert rules in Prometheus:
     - 5xx error rate > 5% for 5 minutes -> Critical
     - P99 latency > 2 seconds for 10 minutes -> Warning
     - Service down (up == 0) for 1 minute -> Critical
  4. Visualize RPS, latency, and error rate in a Grafana dashboard

Configuration:
  Start the following with docker-compose.yml:
    - API server (Node.js)
    - Prometheus
    - Grafana
    - Alertmanager

Verification Points:
  -> Can metrics be retrieved with curl http://localhost:3000/metrics?
  -> Is the API server UP in Prometheus Targets?
  -> Is the dashboard displayed in Grafana?
  -> When intentionally causing errors, does the alert fire?
```

### Exercise 3: Advanced — Distributed Tracing and Observability Integration

Implement end-to-end distributed tracing for the following microservices configuration.

```
Configuration:
  [Client] -> [API Gateway] -> [User Service] -> [PostgreSQL]
                             -> [Order Service] -> [Redis]
                                                -> [Payment API (external)]

Requirements:
  1. Instrument each service with the OpenTelemetry SDK
  2. Propagate context with W3C Trace Context headers
  3. Record processing time for business logic with custom spans
  4. Record error information with span.recordException() when an error occurs
  5. Visualize traces in Jaeger
  6. Cross-link metrics, traces, and logs in Grafana

Additional challenges:
  - Configure tail-based sampling in the OTel Collector
  - Collect 100% of error traces and high-latency traces
  - Include trace_id and span_id in logs to link to traces
  - Jump from traces to logs using Grafana's Explore view

Verification Points:
  -> Are cross-service traces displayed consistently in Jaeger?
  -> Can you identify the span that is a bottleneck?
  -> Are error spans correctly marked?
  -> Can you navigate from a log to the corresponding trace?
  -> Is the sampling policy operating as expected?
```

---

## 13. Best Practices for Production Environments

### 13.1 Log Rotation and Retention Policy

```
Log retention policy design guidelines:

  Tier 1 -- Hot storage (fast searchable):
    Period:   7-14 days
    Use:      Active debugging, incident response
    Storage:  SSD / Elasticsearch Hot Node

  Tier 2 -- Warm storage (searchable but slightly slower):
    Period:   30-90 days
    Use:      Trend analysis, past incident investigation
    Storage:  HDD / Elasticsearch Warm Node / S3

  Tier 3 -- Cold storage (archive):
    Period:   1 year or more (depending on compliance requirements)
    Use:      Auditing, legal requirements
    Storage:  S3 Glacier / GCS Coldline

  Retention period by log level:
    ERROR/FATAL: 90 days (hot 14 days + warm 76 days)
    WARN:        30 days (hot 7 days + warm 23 days)
    INFO:        14 days (all hot)
    DEBUG:       3 days (development environment only)
```

### 13.2 Minimizing Performance Impact

```
Principles for reducing monitoring overhead:

  1. Asynchronous log output:
     -> Buffer log writes and flush asynchronously
     -> pino supports asynchronous writing by default
     -> Synchronous writes directly impact latency

  2. Limit the number of metric labels:
     -> Keep the number of label combinations (cardinality) below 1,000
     -> Use template paths (/users/:id) for the path label
     -> Do not include user IDs or request IDs in labels

  3. Trace sampling:
     -> 1-10% sampling in production environments
     -> Collect 100% of errors and slow requests
     -> Use tail-based sampling to ensure important traces are captured

  4. Log filtering:
     -> Exclude logs from health check and metrics endpoints
     -> Disable DEBUG/TRACE levels in production
     -> Prepare a mechanism for dynamic log level changes

  5. Batch processing:
     -> Batch telemetry data exports
     -> Send in bulk rather than individually to reduce overhead
```

### 13.3 Monitoring Continuity During Failures

```
Ensuring availability of the monitoring infrastructure itself:

  Problem: Monitoring is most important during a failure,
           but failures can sometimes affect the monitoring infrastructure

  Remedies:
    1. Place the monitoring infrastructure on separate infrastructure from what is being monitored
    2. Use Prometheus Federation for hierarchical structure
    3. Use Thanos/Cortex for long-term storage and high availability
    4. Multiplex alert notification channels (Slack + PagerDuty + Email)
    5. Dead Man's Switch alert (detects monitoring infrastructure failure
       when a constantly-firing alert stops)

  Dead Man's Switch example:
    - alert: PrometheusAlive
      expr: vector(1)
      labels:
        severity: critical
      annotations:
        summary: "Dead man's switch - Prometheus is alive"
    -> Monitor receipt of this alert in Alertmanager
    -> If not received for a certain period, notify via external monitoring
```

---

## 14. FAQ (Frequently Asked Questions)

### Q1: Should I choose Prometheus or Datadog?

Prometheus is open-source and highly flexible, keeping running costs low, but has high operational burden. Datadog is SaaS, so operational burden is low, but usage-based billing can be costly. Selection criteria are as follows.

| Decision axis | Prometheus recommended | Datadog recommended |
|--------|----------------|-------------|
| Team operational capability | Strong in Kubernetes/infrastructure operations | Want to focus on application development |
| Budget | Have budget for infrastructure costs | Personnel costs > SaaS costs |
| Scale | Medium scale (tens of billions of data points per month) | Large scale, multi-region |
| Customization | Need custom metrics design | Standard monitoring is sufficient |
| Integration | Utilizing the Grafana ecosystem | Centrally managing APM + logs + infrastructure |

For small to medium-scale teams, the rational approach is to start with Prometheus + Grafana and consider migrating to SaaS when operational burden becomes a problem.

### Q2: What is the criterion for choosing between logs and metrics?

Briefly, use logs when you want to know "what happened," and metrics when you want to know "how often it happened."

- Metrics: Answer aggregate questions. "What is the error rate?" "What is the P99 latency in ms?" "Is the number of requests trending upward?"
- Logs: Answer individual questions. "Why did this request fail?" "What is the operation history for user X?" "Which SQL query resulted in an error?"

The typical flow is to set alerts based on metrics and refer to logs when investigating an incident. Detect anomalies with metrics and identify the root cause with logs.

### Q3: What sampling rate should be used for distributed tracing?

The sampling rate depends on traffic volume and storage capacity. General guidelines are as follows.

- Development/staging environments: 100% (collect all traces)
- Production with low traffic (< 100 RPS): 50-100%
- Production with medium traffic (100-1000 RPS): 10-50%
- Production with high traffic (> 1000 RPS): 1-10%

However, with tail-based sampling, you can collect 100% of error and high-latency traces while only sampling normal traces. This ensures that the traces most valuable for debugging are always retained.

### Q4: Should I use OpenTelemetry or vendor-specific SDKs?

OpenTelemetry is recommended. Since OpenTelemetry is vendor-agnostic, you can change the backend (Jaeger, Zipkin, Datadog, New Relic, etc.) later. Avoiding vendor lock-in ensures freedom in future cost optimization and technology choices. Major APM vendors are also progressing their native support for OpenTelemetry, and compatibility issues are decreasing.

### Q5: What are the criteria for selecting monitoring tools?

When selecting monitoring tools, the following aspects need to be evaluated comprehensively.

| Aspect | Evaluation Points |
|------|------------|
| Feature coverage | Degree of integration of metrics/logs/traces, dashboard features, richness of alert features |
| Scalability | Can it handle the expected data volume (data points/second, log volume/day)? |
| Cost | Initial cost, operational cost, data retention cost, transparency of usage-based billing |
| Operational burden | Self-hosted vs. SaaS, required expertise, maintenance difficulty |
| Ecosystem | Integration with existing tools, OpenTelemetry support, richness of plugins |
| Vendor lock-in | Whether data can be exported, support for standard protocols |

For startups and small teams, selecting a SaaS with low operational burden (Datadog, New Relic) and considering migration to open-source options like Prometheus + Grafana as a cost optimization after growth is realistic. On the other hand, for organizations handling large-scale traffic, building an open-source-based foundation from the start and accumulating operational know-how is an effective strategy.

### Q6: What are the best practices for alert design?

Apply the following principles to effective alert design.

1. **SLO-based alerts**: Set alerts based on user impact, such as "error budget consumption rate > 5%/hour," rather than "CPU usage > 80%"
2. **Actionability**: Make the content such that the person receiving the alert can take clear action. Prepare a Runbook for "what to check and what to do"
3. **Appropriate threshold setting**: Analyze P95/P99 from historical data to balance false positives and misses. Also consider using anomaly detection algorithms rather than static thresholds
4. **Deduplication and grouping**: Consolidate multiple related alerts into a single notification to prevent alert fatigue
5. **Gradual escalation**: Clearly define the notification target and response time for each Severity (Critical/Warning/Info)
6. **Setting silence periods**: Prepare a mechanism to automatically suppress alerts during deployments or maintenance

Alerts should only fire when "users are being impacted" or "there is a high likelihood that users will be impacted." Simple informational notifications are sufficient with dashboards or reports, not alerts.

### Q7: How should log retention periods and management be handled?

Log retention periods are determined by balancing legal requirements, cost, and practicality.

| Log Type | Recommended Retention | Reason |
|---------|------------|------|
| Application logs (errors, warnings) | 30–90 days (hot storage)<br>1 year (cold storage) | Period required for troubleshooting<br>Long-term trend analysis / auditing |
| Access logs | 7–30 days (hot storage)<br>6 months–1 year (cold storage) | Recent traffic analysis<br>Security incident investigation |
| Audit logs (financial/medical) | 7 years or more (archive storage) | Legal requirements (SOX, GDPR, etc.) |
| Debug logs | 1–7 days | Enable only in development environments; disable in production is preferred |

Best practices for reducing storage costs:
- **Tiered storage migration**: Tiering like Elasticsearch → S3 → Glacier
- **Sampling**: Record only 1-10% of normal requests
- **Compress structured logs**: Compress JSON logs with gzip (70-90% size reduction)
- **Aggregate old logs**: Convert detailed logs to daily aggregate data for retention

Also, due to privacy regulations such as GDPR, a mechanism to handle deletion requests for logs containing personal information is necessary. Consider encrypting or masking PII (Personally Identifiable Information) included in logs.

---

## 15. Monitoring Maturity Model

The following is a roadmap for gradually improving an organization's monitoring maturity.

```
Monitoring Maturity Levels:

  Level 0: No monitoring
    -> Logging is console.log only
    -> Failures are noticed via user reports
    -> Action: Start by introducing a log platform and health checks

  Level 1: Basic monitoring
    -> Structured logging introduced
    -> Uptime monitoring (ping/healthcheck)
    -> Basic metrics (CPU, memory, disk)
    -> Action: Introduce RED metrics

  Level 2: Application monitoring
    -> RED metrics (Rate, Errors, Duration)
    -> Per-endpoint metrics
    -> Grafana dashboards
    -> Basic alert configuration
    -> Action: Define SLI/SLO and distributed tracing

  Level 3: Observability
    -> SLI/SLO-based alerts
    -> Distributed tracing (OpenTelemetry)
    -> Correlation of logs, metrics, and traces
    -> Release management with error budget
    -> Action: Automation and proactive monitoring

  Level 4: Proactive monitoring
    -> Anomaly detection (ML-based)
    -> Integration with auto-scaling
    -> Chaos engineering integration
    -> Business visualization via SLO dashboards
    -> Continuous improvement cycle
```

---

## Summary

| Concept | Key Points |
|------|---------|
| Observability | Composed of the three pillars: logs, metrics, traces |
| RED method | Monitor APIs with Rate, Errors, Duration |
| SLI/SLO | 99.9% availability, P99 < 500ms, decision-making with error budget |
| Structured logging | JSON format + requestId + traceId for correlation |
| Distributed tracing | Standardized with OpenTelemetry + W3C Trace Context |
| Prometheus | Pull-based metrics collection, flexible queries with PromQL |
| Grafana | Hierarchical dashboard design, integration of metrics/logs/traces |
| Alert design | SLO-based, actionable, deduplicated |
| Log aggregation | Centralized management with Loki (low cost) or ELK (full-text search) |
| OTel Collector | Vendor-agnostic telemetry pipeline |

---

## FAQ

### Q1: Where should a small team start with observability?
It is recommended to start with introducing structured logging (JSON format) and implementing a health check endpoint. Next, visualize the 3 indicators of the RED method (Rate, Errors, Duration) with Prometheus + Grafana. Setting alerts for error rate and P99 latency at this stage enables early detection of failures. Consider introducing distributed tracing when you have 3 or more microservices.

### Q2: What is the criterion for using log levels (INFO/WARN/ERROR, etc.)?
ERROR indicates that the system is not operating normally and should be used for things that require immediate investigation (DB connection failure, external API failure, etc.). WARN is for things that are not a problem now but could become errors in the future (approaching disk capacity, approaching rate limit, etc.). INFO is for business-critical events (user registration, payment completion, etc.). DEBUG is troubleshooting information for development time and should be disabled by default in production environments. If enabling DEBUG logs in production, it is good to have a mechanism for dynamic log level changes.

### Q3: What should the initial SLO (Service Level Objective) values be set to?
It is recommended to start with conservative targets and gradually raise them as data accumulates. Common starting points as initial settings are 99.9% availability (approximately 43 minutes of monthly downtime), P99 latency < 1 second, and error rate < 0.5%. Monitor the consumption rate of the error budget (100% - SLO) and use it for release decisions. Review SLOs quarterly and adjust based on actual data. Since availability above 99.99% causes operational costs to increase exponentially, verify appropriateness by cross-referencing with business requirements.

---

## What to Read Next

→ [API Gateway](./02-api-gateway.md) — API gateway design and monitoring integration
→ [Rate Limiting](../03-api-security/01-rate-limiting.md) — Rate limiting and its relationship to metrics

---

## References

1. Google. "Site Reliability Engineering: How Google Runs Production Systems." O'Reilly Media, 2016. https://sre.google/sre-book/table-of-contents/
2. OpenTelemetry Authors. "OpenTelemetry Documentation." Cloud Native Computing Foundation, 2024. https://opentelemetry.io/docs/
3. Prometheus Authors. "Prometheus: Monitoring and Alerting Toolkit." Cloud Native Computing Foundation, 2024. https://prometheus.io/docs/introduction/overview/
4. Sridharan, Cindy. "Distributed Systems Observability." O'Reilly Media, 2018. https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/
5. Grafana Labs. "Grafana Loki Documentation." Grafana Labs, 2024. https://grafana.com/docs/loki/latest/
6. Beyer, Betsy et al. "The Site Reliability Workbook." O'Reilly Media, 2018. https://sre.google/workbook/table-of-contents/
