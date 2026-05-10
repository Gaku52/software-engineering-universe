# Deployment

> Scaling, monitoring, and availability — architecture design and operational practices for deploying AI agents to production and running them reliably.

## What You Will Learn

1. Production architecture and scaling strategies for agents
2. Design and implementation patterns for monitoring, logging, and alerting
3. Operational practices for cost control, rate limiting, and failure recovery
4. Safe deployment flows using CI/CD pipelines
5. Environment management with Infrastructure as Code
6. Canary deployment and blue-green deployment in practice


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Production Architecture

### 1.1 Overall Structure

```
Agent Production Architecture

+-------------------------------------------------------------------+
|                         Client Layer                               |
|  [Web App] [Mobile App] [CLI] [API Client]                        |
+-------------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------------+
|                        API Gateway                                 |
|  [Rate Limiting] [Auth] [Load Balancer] [Request Routing]          |
+-------------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------------+
|                     Agent Service Layer                             |
|  +-------------------+  +-------------------+  +----------------+ |
|  | Agent Instance 1  |  | Agent Instance 2  |  | Agent Inst. N  | |
|  | [LLM Client]      |  | [LLM Client]      |  | [LLM Client]  | |
|  | [Tool Executor]   |  | [Tool Executor]   |  | [Tool Exec.]   | |
|  | [Memory Manager]  |  | [Memory Manager]  |  | [Memory Mgr.]  | |
|  +-------------------+  +-------------------+  +----------------+ |
+-------------------------------------------------------------------+
                    |              |              |
                    v              v              v
+-------------------------------------------------------------------+
|                     Infrastructure Layer                            |
|  +--------+  +----------+  +---------+  +----------+              |
|  | LLM    |  | Vector   |  | Cache   |  | Message  |              |
|  | APIs   |  | DB       |  | (Redis) |  | Queue    |              |
|  +--------+  +----------+  +---------+  +----------+              |
|  +--------+  +----------+  +---------+                             |
|  | SQL DB |  | Object   |  | MCP     |                             |
|  |        |  | Storage  |  | Servers |                             |
|  +--------+  +----------+  +---------+                             |
+-------------------------------------------------------------------+
```

### 1.2 Deployment Patterns

```
Deployment Pattern Options

1. Serverless (Lambda / Cloud Functions)
   [Request] → [API Gateway] → [Lambda] → [LLM API]
   + Auto-scaling, pay-per-use cost
   - Timeout limits (usually 15 min), cold starts

2. Container (ECS / Cloud Run / Kubernetes)
   [Request] → [ALB] → [ECS Fargate Container]
   + Flexible, supports long-running tasks
   - Requires infrastructure management

3. Queue-based (Asynchronous)
   [Request] → [API] → [SQS/Redis] → [Worker] → [Callback]
   + Suitable for long-running tasks, back-pressure control
   - Real-time responses are difficult
```

### 1.3 Container-Based Deployment Example

```python
# Dockerfile for Agent Service
"""
FROM python:3.12-slim

WORKDIR /app

# Install dependencies (leveraging cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY src/ ./src/
COPY configs/ ./configs/

# Security: non-root user
RUN useradd --create-home appuser
USER appuser

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
"""
```

```python
# docker-compose.yml (for local development + staging)
"""
version: '3.9'
services:
  agent-api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:pass@postgres:5432/agents
      - LOG_LEVEL=INFO
      - MAX_CONCURRENT_AGENTS=10
    depends_on:
      - redis
      - postgres
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
    restart: unless-stopped

  agent-worker:
    build: .
    command: ["python", "-m", "src.worker"]
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:pass@postgres:5432/agents
      - WORKER_CONCURRENCY=5
    depends_on:
      - redis
      - postgres
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: agents
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pg-data:/var/lib/postgresql/data

volumes:
  redis-data:
  pg-data:
"""
```

### 1.4 Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
  labels:
    app: agent-api
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-api
  template:
    metadata:
      labels:
        app: agent-api
        version: v1
    spec:
      containers:
        - name: agent-api
          image: your-registry/agent-api:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "2000m"
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: agent-secrets
                  key: anthropic-api-key
            - name: REDIS_URL
              value: "redis://redis-service:6379"
            - name: MAX_CONCURRENT_AGENTS
              value: "10"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            failureThreshold: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: agent-api-service
spec:
  selector:
    app: agent-api
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-api
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: agent_queue_depth
        target:
          type: AverageValue
          averageValue: "50"
```

---

## 2. Scaling

### 2.1 Scaling Strategies

```python
# Async queue-based scaling
import asyncio
from dataclasses import dataclass
import aiohttp

@dataclass
class AgentTask:
    task_id: str
    user_id: str
    input_message: str
    priority: int = 0

class AgentWorkerPool:
    def __init__(self, num_workers: int = 10, max_concurrent: int = 50):
        self.queue = asyncio.PriorityQueue()
        self.num_workers = num_workers
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.active_tasks = {}

    async def submit(self, task: AgentTask) -> str:
        """Submit a task to the queue"""
        await self.queue.put((task.priority, task))
        return task.task_id

    async def worker(self, worker_id: int):
        """Worker loop"""
        while True:
            _, task = await self.queue.get()
            async with self.semaphore:
                try:
                    self.active_tasks[task.task_id] = "running"
                    result = await self._process_task(task)
                    self.active_tasks[task.task_id] = "completed"
                    await self._notify_completion(task, result)
                except Exception as e:
                    self.active_tasks[task.task_id] = "failed"
                    await self._handle_failure(task, e)
                finally:
                    self.queue.task_done()

    async def start(self):
        """Start the worker pool"""
        workers = [
            asyncio.create_task(self.worker(i))
            for i in range(self.num_workers)
        ]
        await asyncio.gather(*workers)
```

### 2.2 Horizontal Scaling Design

```
Horizontal Scaling

                    +---> [Worker 1] --+
                    |                  |
[Queue] --dispatch--+---> [Worker 2] --+---> [Result Store]
                    |                  |
                    +---> [Worker N] --+

Scaling Policy:
- Queue depth > 100 → Add workers
- Queue depth < 10  → Remove workers
- CPU utilization > 70% → Add workers
- LLM API rate limit → Adjust request interval
```

### 2.3 Rate-Limit-Aware Scaling

```python
import asyncio
import time
from collections import deque

class AdaptiveRateLimiter:
    """Rate limiter that adapts to LLM API rate limits"""

    def __init__(
        self,
        requests_per_minute: int = 60,
        tokens_per_minute: int = 100_000,
        max_retries: int = 5
    ):
        self.rpm_limit = requests_per_minute
        self.tpm_limit = tokens_per_minute
        self.request_timestamps = deque()
        self.token_usage = deque()
        self.max_retries = max_retries
        self._lock = asyncio.Lock()
        self._backoff_until = 0.0

    async def acquire(self, estimated_tokens: int = 1000):
        """Acquire request permission respecting rate limits"""
        async with self._lock:
            now = time.time()

            # Check if in backoff period
            if now < self._backoff_until:
                wait_time = self._backoff_until - now
                await asyncio.sleep(wait_time)
                now = time.time()

            # Remove entries older than 1 minute
            cutoff = now - 60
            while self.request_timestamps and self.request_timestamps[0] < cutoff:
                self.request_timestamps.popleft()
            while self.token_usage and self.token_usage[0][0] < cutoff:
                self.token_usage.popleft()

            # RPM check
            if len(self.request_timestamps) >= self.rpm_limit:
                wait_time = 60 - (now - self.request_timestamps[0])
                if wait_time > 0:
                    await asyncio.sleep(wait_time)

            # TPM check
            current_tokens = sum(t[1] for t in self.token_usage)
            if current_tokens + estimated_tokens > self.tpm_limit:
                wait_time = 60 - (now - self.token_usage[0][0])
                if wait_time > 0:
                    await asyncio.sleep(wait_time)

            self.request_timestamps.append(time.time())
            self.token_usage.append((time.time(), estimated_tokens))

    def report_rate_limit(self, retry_after: float = 60.0):
        """Set backoff period on 429 error"""
        self._backoff_until = time.time() + retry_after

    async def call_with_retry(self, func, *args, **kwargs):
        """API call with retry"""
        for attempt in range(self.max_retries):
            try:
                await self.acquire()
                result = await func(*args, **kwargs)
                return result
            except RateLimitError as e:
                retry_after = getattr(e, "retry_after", 2 ** attempt)
                self.report_rate_limit(retry_after)
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(retry_after)
                else:
                    raise
            except Exception:
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
```

### 2.4 Multi-Provider Load Balancing

```python
import random
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class LLMProvider:
    name: str
    client: object
    model: str
    weight: float = 1.0
    is_healthy: bool = True
    error_count: int = 0
    max_errors: int = 5
    cooldown_until: float = 0.0

class MultiProviderBalancer:
    """Load balancing across multiple LLM providers"""

    def __init__(self):
        self.providers: list[LLMProvider] = []
        self.primary_index: int = 0

    def add_provider(self, provider: LLMProvider):
        self.providers.append(provider)

    def _get_available_providers(self) -> list[LLMProvider]:
        """Get available providers"""
        now = time.time()
        available = []
        for p in self.providers:
            if p.cooldown_until > 0 and now > p.cooldown_until:
                p.is_healthy = True
                p.error_count = 0
                p.cooldown_until = 0.0
            if p.is_healthy:
                available.append(p)
        return available

    def select_provider(self, strategy: str = "weighted") -> LLMProvider:
        """Select a provider"""
        available = self._get_available_providers()
        if not available:
            raise AllProvidersUnavailableError(
                "All LLM providers are unavailable"
            )

        if strategy == "weighted":
            weights = [p.weight for p in available]
            return random.choices(available, weights=weights, k=1)[0]
        elif strategy == "round_robin":
            provider = available[self.primary_index % len(available)]
            self.primary_index += 1
            return provider
        elif strategy == "failover":
            return available[0]
        else:
            return random.choice(available)

    def report_error(self, provider: LLMProvider):
        """Report an error and disable the provider if necessary"""
        provider.error_count += 1
        if provider.error_count >= provider.max_errors:
            provider.is_healthy = False
            provider.cooldown_until = time.time() + 300  # 5-minute cooldown

    def report_success(self, provider: LLMProvider):
        """Report success and reset error count"""
        provider.error_count = 0

    async def call(self, messages: list, **kwargs) -> str:
        """LLM call with fallback"""
        errors = []
        tried_providers = set()

        for _ in range(len(self.providers)):
            try:
                provider = self.select_provider()
                if provider.name in tried_providers:
                    continue
                tried_providers.add(provider.name)

                result = await provider.client.messages.create(
                    model=provider.model,
                    messages=messages,
                    **kwargs
                )
                self.report_success(provider)
                return result
            except Exception as e:
                self.report_error(provider)
                errors.append((provider.name, str(e)))

        raise AllProvidersFailedError(
            f"All providers failed: {errors}"
        )
```

---

## 3. Monitoring

### 3.1 Metrics Design

```python
# Collecting agent metrics
import time
from prometheus_client import Counter, Histogram, Gauge

# Metric definitions
AGENT_REQUESTS = Counter(
    "agent_requests_total",
    "Total agent requests",
    ["status", "intent"]
)
AGENT_LATENCY = Histogram(
    "agent_latency_seconds",
    "Agent response latency",
    buckets=[1, 5, 10, 30, 60, 120, 300]
)
AGENT_STEPS = Histogram(
    "agent_steps_count",
    "Number of agent steps per task",
    buckets=[1, 3, 5, 10, 15, 20, 30]
)
AGENT_COST = Counter(
    "agent_cost_usd",
    "Total API cost in USD"
)
ACTIVE_AGENTS = Gauge(
    "active_agents",
    "Currently running agent instances"
)
TOOL_CALLS = Counter(
    "agent_tool_calls_total",
    "Total tool calls",
    ["tool_name", "status"]
)

class MonitoredAgent:
    def run(self, task: str) -> str:
        ACTIVE_AGENTS.inc()
        start = time.time()

        try:
            result = self._agent_loop(task)
            AGENT_REQUESTS.labels(status="success", intent="general").inc()
            return result
        except Exception as e:
            AGENT_REQUESTS.labels(status="error", intent="general").inc()
            raise
        finally:
            AGENT_LATENCY.observe(time.time() - start)
            AGENT_STEPS.observe(self.step_count)
            AGENT_COST.inc(self.cost_tracker.total_cost)
            ACTIVE_AGENTS.dec()
```

### 3.2 Logging Design

```python
# Structured logging implementation
import structlog
import json

logger = structlog.get_logger()

class LoggedAgent:
    def run(self, task: str, request_id: str) -> str:
        log = logger.bind(request_id=request_id, task=task[:100])

        log.info("agent_started")

        for step in range(self.max_steps):
            # LLM call
            log.info("llm_call", step=step, model=self.model)
            response = self._call_llm()

            # Tool execution
            for tool_call in response.tool_calls:
                log.info("tool_call",
                    step=step,
                    tool=tool_call.name,
                    input_preview=str(tool_call.input)[:200]
                )
                result = self._execute_tool(tool_call)
                log.info("tool_result",
                    step=step,
                    tool=tool_call.name,
                    result_preview=str(result)[:200],
                    success=not result.startswith("Error")
                )

        log.info("agent_completed",
            total_steps=step,
            total_tokens=self.token_count,
            cost_usd=self.cost
        )
```

### 3.3 Distributed Tracing Implementation

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

# Tracer configuration
resource = Resource.create({"service.name": "agent-service"})
provider = TracerProvider(resource=resource)
exporter = OTLPSpanExporter(endpoint="http://jaeger:4317")
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("agent-service")

class TracedAgent:
    """OpenTelemetry-enabled agent"""

    async def run(self, task: str, request_id: str) -> str:
        with tracer.start_as_current_span(
            "agent_run",
            attributes={
                "agent.task": task[:200],
                "agent.request_id": request_id,
                "agent.model": self.model,
            }
        ) as root_span:
            try:
                result = await self._agent_loop(task, root_span)
                root_span.set_attribute("agent.status", "success")
                root_span.set_attribute("agent.total_steps", self.step_count)
                root_span.set_attribute("agent.total_cost", self.cost)
                return result
            except Exception as e:
                root_span.set_attribute("agent.status", "error")
                root_span.record_exception(e)
                raise

    async def _agent_loop(self, task: str, parent_span) -> str:
        messages = [{"role": "user", "content": task}]

        for step in range(self.max_steps):
            # Span for LLM call
            with tracer.start_as_current_span(
                "llm_call",
                attributes={
                    "llm.step": step,
                    "llm.model": self.model,
                    "llm.input_tokens": len(str(messages)),
                }
            ) as llm_span:
                response = await self._call_llm(messages)
                llm_span.set_attribute(
                    "llm.output_tokens",
                    response.usage.output_tokens
                )

            # Span for tool calls
            for tool_call in response.tool_calls:
                with tracer.start_as_current_span(
                    f"tool_{tool_call.name}",
                    attributes={
                        "tool.name": tool_call.name,
                        "tool.step": step,
                    }
                ) as tool_span:
                    start = time.time()
                    result = await self._execute_tool(tool_call)
                    tool_span.set_attribute(
                        "tool.duration_ms",
                        (time.time() - start) * 1000
                    )
                    tool_span.set_attribute(
                        "tool.success",
                        not str(result).startswith("Error")
                    )

            if response.stop_reason == "end_turn":
                return response.content

        return "Maximum number of steps reached"
```

### 3.4 Dashboard Design

```
Agent Operations Dashboard

+-------------------------------------------------------------------+
|  [Success Rate: 94.2%] [Avg Latency: 8.3s] [Today's Cost: $127.50] |
+-------------------------------------------------------------------+
|                                                                     |
|  Request Count (last 24h)      Latency Distribution                |
|  200|    *                     |   *                                |
|     |   * *     *              |  * *                               |
|  100|  *   *   * *    *        | *   *  *                           |
|     | *     * *   *  * *       |*     **  *                         |
|    0+--+--+--+--+--+--+--     +--+--+--+--+--                      |
|     0  4  8  12 16 20 24      0  5  10 30 60s                      |
|                                                                     |
+-------------------------------------------------------------------+
|  Error Rate        Tool Usage Frequency    Cost Trend              |
|  5%|               [search: 40%]       $150|  *                     |
|  3%|   *           [read:   30%]       $100|*  *                    |
|  1%| *   *         [write:  20%]        $50|     *  *               |
|  0%+------         [exec:   10%]         $0+--------                |
+-------------------------------------------------------------------+
```

### 3.5 Grafana Dashboard Definition

```json
{
  "dashboard": {
    "title": "AI Agent Operations",
    "panels": [
      {
        "title": "Request Rate",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(agent_requests_total[5m])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "P50/P95/P99 Latency",
        "type": "timeseries",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(agent_latency_seconds_bucket[5m]))",
            "legendFormat": "P50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(agent_latency_seconds_bucket[5m]))",
            "legendFormat": "P95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(agent_latency_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ]
      },
      {
        "title": "Active Agents",
        "type": "gauge",
        "targets": [
          {
            "expr": "active_agents",
            "legendFormat": "Active"
          }
        ]
      },
      {
        "title": "Hourly Cost",
        "type": "timeseries",
        "targets": [
          {
            "expr": "increase(agent_cost_usd[1h])",
            "legendFormat": "Cost USD"
          }
        ]
      },
      {
        "title": "Tool Call Distribution",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum by (tool_name) (agent_tool_calls_total)",
            "legendFormat": "{{tool_name}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(agent_requests_total{status='error'}[5m])) / sum(rate(agent_requests_total[5m])) * 100",
            "legendFormat": "Error %"
          }
        ]
      }
    ]
  }
}
```

### 3.6 Alert Rule Design

```yaml
# prometheus-alerts.yaml
groups:
  - name: agent_alerts
    rules:
      # High error rate alert
      - alert: AgentHighErrorRate
        expr: |
          sum(rate(agent_requests_total{status="error"}[5m]))
          / sum(rate(agent_requests_total[5m])) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Agent error rate exceeds 10%"
          description: "Error rate over the last 5 minutes: {{ $value | humanizePercentage }}"

      # High latency alert
      - alert: AgentHighLatency
        expr: |
          histogram_quantile(0.95, rate(agent_latency_seconds_bucket[5m])) > 60
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency exceeds 60 seconds"

      # Cost overrun alert
      - alert: AgentCostExceeded
        expr: increase(agent_cost_usd[1h]) > 50
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Hourly cost exceeded $50"
          description: "Cost in the last hour: ${{ $value }}"

      # Queue depth alert
      - alert: AgentQueueDepthHigh
        expr: agent_queue_depth > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Agent task queue is growing deep"
          description: "Queue depth: {{ $value }}"

      # All providers down
      - alert: AllLLMProvidersDown
        expr: sum(llm_provider_healthy) == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "All LLM providers are unavailable"
```

---

## 4. Cost Management

### 4.1 Cost Control Implementation

```python
# Cost control implementation
class CostController:
    def __init__(self, daily_budget: float = 100.0,
                 per_task_limit: float = 5.0):
        self.daily_budget = daily_budget
        self.per_task_limit = per_task_limit
        self.daily_spend = 0.0
        self.task_spend = 0.0

    def check_budget(self) -> bool:
        """Check if within budget"""
        if self.daily_spend >= self.daily_budget:
            raise BudgetExceededError("Daily budget limit reached")
        if self.task_spend >= self.per_task_limit:
            raise BudgetExceededError("Per-task budget limit reached")
        return True

    def track_usage(self, input_tokens: int, output_tokens: int,
                     model: str):
        """Track usage"""
        cost = self._calculate_cost(input_tokens, output_tokens, model)
        self.daily_spend += cost
        self.task_spend += cost

    def _calculate_cost(self, input_tokens, output_tokens, model) -> float:
        rates = {
            "claude-sonnet-4-20250514": (3.0, 15.0),  # input, output per 1M
            "claude-haiku-4-20250514": (0.25, 1.25),
        }
        input_rate, output_rate = rates.get(model, (3.0, 15.0))
        return (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000
```

### 4.2 Advanced Cost Optimization Strategies

```python
import hashlib
import json
from datetime import datetime, timedelta

class CostOptimizer:
    """Comprehensive strategy implementation for cost optimization"""

    def __init__(self, redis_client, db_client):
        self.redis = redis_client
        self.db = db_client

    # --- Caching Strategy ---

    async def cached_llm_call(
        self,
        messages: list,
        model: str,
        ttl: int = 3600
    ) -> dict:
        """Cache LLM responses for identical inputs"""
        cache_key = self._make_cache_key(messages, model)
        cached = await self.redis.get(cache_key)

        if cached:
            return json.loads(cached)

        result = await self._call_llm(messages, model)
        await self.redis.setex(
            cache_key,
            ttl,
            json.dumps(result)
        )
        return result

    def _make_cache_key(self, messages: list, model: str) -> str:
        content = json.dumps({"messages": messages, "model": model},
                            sort_keys=True)
        return f"llm_cache:{hashlib.sha256(content.encode()).hexdigest()}"

    # --- Model Routing ---

    def select_model(self, task_complexity: str, budget_remaining: float) -> str:
        """Select model based on task complexity and remaining budget"""
        if budget_remaining < 1.0:
            return "claude-haiku-4-20250514"  # Cheapest model

        model_selection = {
            "simple": "claude-haiku-4-20250514",      # Classification, summarization
            "medium": "claude-sonnet-4-20250514",      # General tasks
            "complex": "claude-opus-4-20250514",       # Advanced reasoning
        }
        return model_selection.get(task_complexity, "claude-sonnet-4-20250514")

    # --- Prompt Optimization ---

    def optimize_prompt(self, messages: list, max_input_tokens: int = 4000) -> list:
        """Optimize prompts to reduce token usage"""
        optimized = []
        total_tokens_est = 0

        for msg in messages:
            token_est = len(msg["content"]) // 4  # Rough estimate
            if total_tokens_est + token_est > max_input_tokens:
                # Summarize older messages
                summary = self._summarize_message(msg["content"])
                optimized.append({
                    "role": msg["role"],
                    "content": summary
                })
                total_tokens_est += len(summary) // 4
            else:
                optimized.append(msg)
                total_tokens_est += token_est

        return optimized

    # --- Cost Reporting ---

    async def generate_cost_report(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> dict:
        """Generate a cost report for a specified period"""
        records = await self.db.fetch_usage(start_date, end_date)

        report = {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "total_cost": sum(r["cost"] for r in records),
            "total_requests": len(records),
            "by_model": {},
            "by_user": {},
            "by_hour": {},
            "top_expensive_tasks": [],
        }

        for record in records:
            # Aggregate by model
            model = record["model"]
            if model not in report["by_model"]:
                report["by_model"][model] = {
                    "cost": 0, "requests": 0, "tokens": 0
                }
            report["by_model"][model]["cost"] += record["cost"]
            report["by_model"][model]["requests"] += 1
            report["by_model"][model]["tokens"] += record["total_tokens"]

            # Aggregate by user
            user = record.get("user_id", "unknown")
            if user not in report["by_user"]:
                report["by_user"][user] = {"cost": 0, "requests": 0}
            report["by_user"][user]["cost"] += record["cost"]
            report["by_user"][user]["requests"] += 1

        # Top 10 most expensive tasks
        sorted_records = sorted(records, key=lambda r: r["cost"], reverse=True)
        report["top_expensive_tasks"] = [
            {
                "task_id": r["task_id"],
                "cost": r["cost"],
                "model": r["model"],
                "tokens": r["total_tokens"],
            }
            for r in sorted_records[:10]
        ]

        return report
```

---

## 5. CI/CD Pipeline

### 5.1 Automated Deployment with GitHub Actions

```yaml
# .github/workflows/deploy-agent.yaml
name: Deploy Agent Service

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: ap-northeast-1
  ECR_REPOSITORY: agent-service
  ECS_CLUSTER: agent-cluster
  ECS_SERVICE: agent-api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install -r requirements-dev.txt

      - name: Run unit tests
        run: pytest tests/unit/ -v --cov=src --cov-report=xml

      - name: Run integration tests
        run: pytest tests/integration/ -v
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_TEST }}

      - name: Run agent evaluation suite
        run: python -m src.eval.run_evaluation --suite=smoke
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_TEST }}

      - name: Check evaluation results
        run: |
          python -m src.eval.check_results \
            --min-accuracy=0.85 \
            --max-cost=2.0 \
            --max-latency=30

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.build.outputs.image }}
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2
        id: login-ecr

      - name: Build, tag, and push image
        id: build
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER-staging \
            --service $ECS_SERVICE \
            --force-new-deployment \
            --task-definition agent-api-staging

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER-staging \
            --services $ECS_SERVICE

      - name: Run smoke tests against staging
        run: |
          python -m src.eval.smoke_test \
            --endpoint=https://staging-agent.example.com

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy canary (10%)
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE-canary \
            --force-new-deployment

      - name: Monitor canary (5 minutes)
        run: |
          python -m src.deploy.monitor_canary \
            --duration=300 \
            --max-error-rate=0.05

      - name: Full rollout
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment
```

### 5.2 Infrastructure Management with Terraform

```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "agent-terraform-state"
    key    = "agent-service/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "agent" {
  name = "agent-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Task Definition
resource "aws_ecs_task_definition" "agent_api" {
  family                   = "agent-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "agent-api"
      image = "${aws_ecr_repository.agent.repository_url}:latest"
      portMappings = [{
        containerPort = 8080
        protocol      = "tcp"
      }]
      environment = [
        { name = "MAX_CONCURRENT_AGENTS", value = "10" },
        { name = "LOG_LEVEL", value = "INFO" },
      ]
      secrets = [
        {
          name      = "ANTHROPIC_API_KEY"
          valueFrom = aws_secretsmanager_secret.anthropic_key.arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/agent-api"
          "awslogs-region"        = "ap-northeast-1"
          "awslogs-stream-prefix" = "agent"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# Service
resource "aws_ecs_service" "agent_api" {
  name            = "agent-api"
  cluster         = aws_ecs_cluster.agent.id
  task_definition = aws_ecs_task_definition.agent_api.arn
  desired_count   = 3
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.agent_api.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.agent_api.arn
    container_name   = "agent-api"
    container_port   = 8080
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "agent_api" {
  max_capacity       = 20
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.agent.name}/${aws_ecs_service.agent_api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "agent_cpu" {
  name               = "agent-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.agent_api.resource_id
  scalable_dimension = aws_appautoscaling_target.agent_api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.agent_api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
```

---

## 6. Comparison Tables

### 6.1 Deployment Method Comparison

| Method | Scaling | Cost | Long-running Tasks | Operational Burden | Use Case |
|--------|---------|------|-------------------|-------------------|---------|
| Serverless | Automatic | Pay-per-use | Limited | Low | Infrequent, short-duration tasks |
| Container (Fargate) | Semi-automatic | Medium | Supported | Medium | Mid-scale production |
| Kubernetes | Manual/Automatic | Medium-High | Supported | High | Large-scale, complex workloads |
| VM | Manual | Fixed | Supported | Highest | GPU usage, special requirements |
| Managed Service | Automatic | High | Supported | Lowest | Prototypes, small scale |

### 6.2 Monitoring Tool Comparison

| Tool | Metrics | Logs | Traces | Cost | Agent Support |
|------|---------|------|--------|------|--------------|
| LangSmith | Agent-specific | Yes | Yes | Paid | Optimal |
| Datadog | General-purpose | Yes | Yes | Expensive | Custom configuration |
| Grafana + Prometheus | General-purpose | Loki | Tempo | Free/Paid | Custom configuration |
| CloudWatch | AWS-specific | Yes | X-Ray | Pay-per-use | Custom configuration |
| Helicone | LLM-specific | Yes | No | Freemium | Good |
| Langfuse | Agent-ready | Yes | Yes | Free/Paid | Good |

### 6.3 CI/CD Tool Comparison

| Tool | Environment | Agent Testing | Deployment Automation | Cost |
|------|-------------|--------------|----------------------|------|
| GitHub Actions | GitHub | pytest + eval | ECS/K8s support | Free tier available |
| GitLab CI | GitLab | pytest + eval | K8s integration | Free tier available |
| CircleCI | General | pytest + eval | General | Paid |
| AWS CodePipeline | AWS | CodeBuild | ECS/Lambda | Pay-per-use |
| ArgoCD | K8s | None | GitOps | Free |

---

## 7. Failure Recovery

### 7.1 Overview of Failure Recovery Strategies

```
Failure Recovery Strategies

1. Retry
   [Failure] → [Wait 1s] → [Retry] → [Wait 2s] → [Retry] → [Success or Give Up]
   Exponential backoff + jitter

2. Fallback
   [Claude API failure] → [Fallback to OpenAI API]
   [Sonnet failure] → [Downgrade to Haiku]

3. Circuit Breaker
   [Closed] → Error rate >50% → [Open (all rejected)] → After 30s → [Half-open (partial)] → Success → [Closed]
```

### 7.2 Circuit Breaker Implementation

```python
# Circuit breaker implementation
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"      # Normal
    OPEN = "open"          # All rejected
    HALF_OPEN = "half_open" # Partial allowed

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.last_failure_time = 0

    def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
            else:
                raise CircuitOpenError("Circuit breaker is open")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
```

### 7.3 Graceful Degradation

```python
class GracefulDegradationAgent:
    """Agent that gracefully degrades functionality on failure"""

    def __init__(self):
        self.degradation_level = 0  # 0=normal, 1=mild, 2=moderate, 3=severe
        self.circuit_breakers = {
            "llm_primary": CircuitBreaker(failure_threshold=3),
            "llm_secondary": CircuitBreaker(failure_threshold=5),
            "vector_db": CircuitBreaker(failure_threshold=3),
            "tools": CircuitBreaker(failure_threshold=5),
        }

    async def run(self, task: str) -> str:
        """Process based on degradation level"""
        if self.degradation_level == 0:
            return await self._full_capability(task)
        elif self.degradation_level == 1:
            return await self._reduced_tools(task)
        elif self.degradation_level == 2:
            return await self._llm_only(task)
        else:
            return self._static_response(task)

    async def _full_capability(self, task: str) -> str:
        """All features available"""
        try:
            context = await self._retrieve_context(task)
            return await self._call_llm_with_tools(task, context)
        except VectorDBError:
            self.degradation_level = 1
            return await self._reduced_tools(task)

    async def _reduced_tools(self, task: str) -> str:
        """No RAG, basic tools only"""
        try:
            return await self._call_llm_with_basic_tools(task)
        except LLMError:
            self.degradation_level = 2
            return await self._llm_only(task)

    async def _llm_only(self, task: str) -> str:
        """LLM only (no tools, fallback model)"""
        try:
            return await self._call_fallback_llm(task)
        except Exception:
            self.degradation_level = 3
            return self._static_response(task)

    def _static_response(self, task: str) -> str:
        """Static response on complete failure"""
        return (
            "The system is currently experiencing issues. "
            "Please try again later. "
            "For urgent matters, please contact support."
        )
```

### 7.4 Data Persistence and Recovery

```python
import json
from datetime import datetime

class AgentCheckpointer:
    """Checkpoint management for agent execution state"""

    def __init__(self, storage_client):
        self.storage = storage_client

    async def save_checkpoint(
        self,
        task_id: str,
        step: int,
        messages: list,
        tool_results: list,
        metadata: dict
    ):
        """Save execution state as a checkpoint"""
        checkpoint = {
            "task_id": task_id,
            "step": step,
            "messages": messages,
            "tool_results": tool_results,
            "metadata": metadata,
            "timestamp": datetime.utcnow().isoformat(),
        }
        key = f"checkpoint:{task_id}:{step}"
        await self.storage.put(key, json.dumps(checkpoint))
        # Also update the pointer to the latest checkpoint
        await self.storage.put(
            f"checkpoint:{task_id}:latest",
            json.dumps({"step": step, "key": key})
        )

    async def restore_checkpoint(self, task_id: str) -> dict | None:
        """Restore from the latest checkpoint"""
        latest_ref = await self.storage.get(
            f"checkpoint:{task_id}:latest"
        )
        if not latest_ref:
            return None

        ref = json.loads(latest_ref)
        checkpoint_data = await self.storage.get(ref["key"])
        if not checkpoint_data:
            return None

        return json.loads(checkpoint_data)

    async def resume_agent(self, task_id: str) -> str:
        """Resume agent from a checkpoint"""
        checkpoint = await self.restore_checkpoint(task_id)
        if not checkpoint:
            raise ValueError(f"Checkpoint not found: {task_id}")

        agent = Agent()
        agent.messages = checkpoint["messages"]
        agent.step_count = checkpoint["step"]
        agent.tool_results = checkpoint["tool_results"]

        # Resume from the interrupted step
        return await agent.continue_from_step(checkpoint["step"])

    async def cleanup_checkpoints(
        self,
        task_id: str,
        keep_latest: int = 3
    ):
        """Delete old checkpoints"""
        latest_ref = await self.storage.get(
            f"checkpoint:{task_id}:latest"
        )
        if not latest_ref:
            return

        ref = json.loads(latest_ref)
        current_step = ref["step"]

        # Delete all but the latest N checkpoints
        for step in range(current_step - keep_latest):
            key = f"checkpoint:{task_id}:{step}"
            await self.storage.delete(key)
```

---

## 8. Canary Deployment and Blue-Green Deployment

### 8.1 Canary Deployment Implementation

```python
class CanaryDeployer:
    """Automation for canary deployments"""

    def __init__(self, ecs_client, cloudwatch_client):
        self.ecs = ecs_client
        self.cw = cloudwatch_client

    async def deploy_canary(
        self,
        cluster: str,
        service: str,
        new_task_def: str,
        canary_percentage: int = 10,
        monitoring_duration: int = 300,
        max_error_rate: float = 0.05
    ) -> bool:
        """Execute canary deployment"""
        # 1. Deploy canary instances
        await self._deploy_canary_instances(
            cluster, service, new_task_def, canary_percentage
        )

        # 2. Monitor metrics during the monitoring period
        start_time = time.time()
        while time.time() - start_time < monitoring_duration:
            metrics = await self._get_canary_metrics(cluster, service)

            if metrics["error_rate"] > max_error_rate:
                # Roll back if error rate exceeds threshold
                await self._rollback(cluster, service)
                return False

            if metrics["p95_latency"] > 60:
                # Also roll back if latency is high
                await self._rollback(cluster, service)
                return False

            await asyncio.sleep(30)  # Check every 30 seconds

        # 3. Promote to all instances on success
        await self._promote_canary(cluster, service, new_task_def)
        return True

    async def _get_canary_metrics(
        self, cluster: str, service: str
    ) -> dict:
        """Retrieve metrics for canary instances"""
        response = await self.cw.get_metric_data(
            MetricDataQueries=[
                {
                    "Id": "error_rate",
                    "MetricStat": {
                        "Metric": {
                            "Namespace": "AgentService",
                            "MetricName": "ErrorRate",
                            "Dimensions": [
                                {"Name": "Version", "Value": "canary"}
                            ]
                        },
                        "Period": 60,
                        "Stat": "Average"
                    }
                },
                {
                    "Id": "p95_latency",
                    "MetricStat": {
                        "Metric": {
                            "Namespace": "AgentService",
                            "MetricName": "Latency",
                            "Dimensions": [
                                {"Name": "Version", "Value": "canary"}
                            ]
                        },
                        "Period": 60,
                        "Stat": "p95"
                    }
                }
            ]
        )

        return {
            "error_rate": response["MetricDataResults"][0]["Values"][-1]
                if response["MetricDataResults"][0]["Values"] else 0,
            "p95_latency": response["MetricDataResults"][1]["Values"][-1]
                if response["MetricDataResults"][1]["Values"] else 0,
        }
```

### 8.2 Blue-Green Deployment

```
Blue-Green Deployment Flow

Phase 1: Preparation
  [Blue (current)] <- ALB <- Traffic
  [Green (new)]    <- Deploying

Phase 2: Testing
  [Blue (current)] <- ALB <- Traffic
  [Green (new)]    <- Running smoke tests

Phase 3: Switchover
  [Blue (old)]
  [Green (new)] <- ALB <- Traffic

Phase 4: Cleanup
  [Blue on standby (kept 30 min for rollback)]
  [Green (production)] <- ALB <- Traffic
```

---

## 9. Security Considerations

### 9.1 Secret Management

```python
import boto3
from functools import lru_cache

class SecretManager:
    """Secret management for API keys and other credentials"""

    def __init__(self, region: str = "ap-northeast-1"):
        self.client = boto3.client(
            "secretsmanager", region_name=region
        )
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes

    @lru_cache(maxsize=32)
    def get_secret(self, secret_name: str) -> str:
        """Retrieve a secret (with caching)"""
        response = self.client.get_secret_value(SecretId=secret_name)
        return response["SecretString"]

    def rotate_api_key(self, secret_name: str, new_key: str):
        """Rotate an API key"""
        self.client.update_secret(
            SecretId=secret_name,
            SecretString=new_key
        )
        # Clear cache
        self.get_secret.cache_clear()
```

### 9.2 Network Security

```yaml
# Security group configuration
# agent-api-sg: port 8080 only, access from ALB only
# agent-worker-sg: outbound only (LLM API, Redis, DB)
# redis-sg: port 6379, from agent service only
# db-sg: port 5432, from agent service only

# WAF rules
# - Rate limiting: 100 req/min per IP
# - Body size limit: 1MB
# - SQL injection protection
# - Geographic restrictions (if needed)
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Synchronous Long-running Processing

```python
# NG: Running agent synchronously in an HTTP request
@app.post("/agent/run")
def run_agent(request):
    result = agent.run(request.task)  # Takes 5 min → timeout
    return {"result": result}

# OK: Async queue-based
@app.post("/agent/run")
async def run_agent(request):
    task_id = await queue.submit(request.task)
    return {"task_id": task_id, "status_url": f"/agent/status/{task_id}"}

@app.get("/agent/status/{task_id}")
async def get_status(task_id: str):
    status = await queue.get_status(task_id)
    return status  # {"status": "running", "progress": 60}
```

### Anti-Pattern 2: Running Production Without Logs

```python
# NG: Debugging with print statements
print(f"Processing: {task}")
print(f"Result: {result}")

# OK: Structured logs + metrics + traces
logger.info("agent_step", extra={
    "request_id": request_id,
    "step": step_num,
    "tool": tool_name,
    "latency_ms": latency,
    "tokens": token_count
})
metrics.record_step(step_num, latency, token_count)
```

### Anti-Pattern 3: Hardcoded Secrets

```python
# NG: API key hardcoded in code
client = anthropic.Anthropic(api_key="sk-ant-xxxxx")

# OK: Environment variables + Secret Manager
import os
client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
    or SecretManager().get_secret("anthropic-api-key")
)
```

### Anti-Pattern 4: Running Without Cost Limits

```python
# NG: Unlimited agent execution
async def run_agent(task: str) -> str:
    while not done:
        response = await llm.call(messages)  # Unlimited token consumption
        ...

# OK: With budget guard
async def run_agent(task: str) -> str:
    cost_ctrl = CostController(per_task_limit=5.0)
    while not done:
        cost_ctrl.check_budget()  # Raises exception on budget overrun
        response = await llm.call(messages)
        cost_ctrl.track_usage(
            response.usage.input_tokens,
            response.usage.output_tokens,
            model
        )
```

### Anti-Pattern 5: Leaving Single Points of Failure

```python
# NG: Fully dependent on a single LLM provider
client = anthropic.Anthropic()
response = client.messages.create(model="claude-sonnet-4-20250514", ...)

# OK: Multi-provider + circuit breaker
balancer = MultiProviderBalancer()
balancer.add_provider(LLMProvider(
    name="anthropic",
    client=anthropic.Anthropic(),
    model="claude-sonnet-4-20250514",
    weight=0.8
))
balancer.add_provider(LLMProvider(
    name="openai",
    client=openai.OpenAI(),
    model="gpt-4o",
    weight=0.2
))
response = await balancer.call(messages)
```

---

## 11. Operations Checklist

### 11.1 Pre-Deployment Checklist

```
Production Deployment Checklist

[ ] Infrastructure
  [ ] Container image built and tested
  [ ] Environment variables and secrets configured correctly
  [ ] Health check endpoint implemented
  [ ] Resource limits (CPU/memory) set appropriately
  [ ] Auto-scaling policy configured

[ ] Security
  [ ] API keys managed via Secret Manager
  [ ] Network security groups set with least privilege
  [ ] WAF rules applied
  [ ] Container runs as non-root user

[ ] Monitoring and Logging
  [ ] Structured logging implemented
  [ ] Metrics collection configured
  [ ] Dashboard created
  [ ] Alert rules configured
  [ ] Distributed tracing enabled

[ ] Failure Handling
  [ ] Circuit breaker implemented
  [ ] Fallback strategy defined
  [ ] Checkpoint/recovery implemented
  [ ] Rollback procedure documented

[ ] Cost
  [ ] Budget limits configured
  [ ] Cost alerts configured
  [ ] Model selection strategy implemented
  [ ] Caching strategy implemented

[ ] Testing
  [ ] Unit tests passing
  [ ] Integration tests passing
  [ ] Agent evaluation suite meets criteria
  [ ] Load testing completed
```

### 11.2 Incident Response Flow

```
Incident Response Flow

1. Detection
   Alert fires → PagerDuty notification → On-call engineer notified

2. Triage (within 5 minutes)
   - Identify scope of impact (all users or partial)
   - Determine severity (P1-P4)
   - Decide on escalation

3. Response
   P1 (Full outage):
     → Immediate rollback
     → Stop all traffic
     → Return static response

   P2 (Partial outage):
     → Degrade affected service scope
     → Enable fallback
     → Begin root cause investigation

   P3 (Minor issue):
     → Continue monitoring
     → Fix on next business day

4. Recovery Confirmation
   - Confirm metrics are back to normal
   - Confirm user impact has been resolved
   - Create post-mortem
```

---

## 12. FAQ

### Q1: How do you handle LLM API availability?

- **Multi-provider**: Fallback configuration with Claude + OpenAI
- **Retry**: Exponential backoff (1s, 2s, 4s, 8s)
- **Circuit Breaker**: Pause API calls temporarily on consecutive failures
- **Cache**: Cache responses for identical inputs

### Q2: How do you manage agent versioning?

- **Prompt version control**: Git-managed + A/B testing
- **Tool version control**: Semantic versioning
- **Model version**: Pin model ID (use snapshots)
- **Rollback**: Instantly switch to the previous version on issues

### Q3: Is multi-region deployment necessary?

Depends on latency requirements:
- **<1 second**: Region proximity matters (choose LLM API region accordingly)
- **<10 seconds**: Single region is sufficient
- **Long-running tasks**: Availability matters more than region

### Q4: How do you A/B test agents?

```python
class AgentABTester:
    """A/B testing implementation for agents"""

    def __init__(self):
        self.variants = {}
        self.results = {}

    def add_variant(self, name: str, agent_config: dict, weight: float):
        """Add a variant"""
        self.variants[name] = {
            "config": agent_config,
            "weight": weight,
        }

    def select_variant(self, user_id: str) -> str:
        """Select variant based on user ID (consistent assignment)"""
        hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
        normalized = hash_val / (2**128)

        cumulative = 0
        for name, variant in self.variants.items():
            cumulative += variant["weight"]
            if normalized < cumulative:
                return name

        return list(self.variants.keys())[-1]

    async def run_with_ab(self, user_id: str, task: str) -> dict:
        """Agent execution with A/B testing"""
        variant = self.select_variant(user_id)
        config = self.variants[variant]["config"]

        agent = Agent(**config)
        start = time.time()
        result = await agent.run(task)
        latency = time.time() - start

        # Record results
        await self._record_result(variant, {
            "user_id": user_id,
            "latency": latency,
            "cost": agent.total_cost,
            "steps": agent.step_count,
            "success": True,
        })

        return {"variant": variant, "result": result}
```

### Q5: How do you manage prompt updates in production?

- **GitOps**: Manage prompt files in Git, update via PR + review
- **Feature Flag**: Gradual rollout of new prompts using LaunchDarkly etc.
- **Evaluation Gate**: Only allow deployment if automated evaluation suite passes
- **Instant Rollback**: Revert to the previous prompt version on issue detection

### Q6: How do you persist state for stateful agents?

- **Redis**: Short-term conversation state (with TTL)
- **PostgreSQL**: Long-term task history and user context
- **S3/GCS**: Checkpoint data and large outputs
- **Vector DB**: Agent knowledge base

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Details |
|------|---------|
| Architecture | API Gateway + Agent Service + Infrastructure |
| Scaling | Queue-based horizontal scaling + rate limit adaptation |
| Monitoring | Metrics + structured logs + distributed tracing |
| Cost Management | Daily/per-task budget limits + model routing |
| Failure Recovery | Retry + fallback + circuit breaker + checkpoints |
| CI/CD | Automated testing + canary deployment + auto rollback |
| Security | Secret management + network isolation + WAF |
| Principles | Async-first, logging mandatory, gradual rollout |

## Further Reading

- [01-safety.md](./01-safety.md) -- Ensuring safety in production environments
- [../02-implementation/04-evaluation.md](../02-implementation/04-evaluation.md) -- Evaluating production metrics
- [../02-implementation/02-mcp-agents.md](../02-implementation/02-mcp-agents.md) -- Deploying MCP servers

## References

1. Anthropic, "API rate limits" -- https://docs.anthropic.com/en/api/rate-limits
2. LangSmith Documentation -- https://docs.smith.langchain.com/
3. AWS, "Serverless patterns for AI/ML workloads" -- https://aws.amazon.com/serverless/
4. OpenTelemetry Documentation -- https://opentelemetry.io/docs/
5. Prometheus Monitoring -- https://prometheus.io/docs/
6. Terraform AWS Provider -- https://registry.terraform.io/providers/hashicorp/aws/
