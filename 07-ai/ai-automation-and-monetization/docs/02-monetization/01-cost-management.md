# Cost Management — API Cost Optimization and Caching Strategies

> A systematic guide to optimizing AI API costs through caching strategies, model selection, batch processing, and prompt optimization, achieving 50–80% cost reductions.

---

## What You Will Learn

1. **AI API Cost Structure and Visualization** — How token billing works, cost distribution analysis, budget management dashboards
2. **Cache Strategy Design and Implementation** — Semantic caching, layered caching, TTL optimization
3. **Prompt/Model Optimization** — Token reduction, model selection by task, cost savings through batch processing
4. **Budget Management and Monitoring** — Real-time monitoring, alert design, anomaly detection
5. **Self-Hosting Strategy** — Cost analysis and implementation for on-premises LLM operation


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Pricing Models — Pay-as-you-go, Subscriptions, Freemium](./00-pricing-models.md)

---

## 1. AI API Cost Structure

### 1.1 Major AI API Pricing Comparison

```
┌──────────────────────────────────────────────────────────┐
│         Major AI API Pricing Comparison (as of 2025)      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Model             Input (/1M tokens)  Output (/1M tokens)│
│  ─────────────────────────────────────────────────       │
│  GPT-4o            $2.50              $10.00              │
│  GPT-4o-mini       $0.15              $0.60               │
│  GPT-4 Turbo       $10.00             $30.00              │
│  Claude Sonnet     $3.00              $15.00              │
│  Claude Haiku      $0.25              $1.25               │
│  Claude Opus       $15.00             $75.00              │
│  Gemini 1.5 Pro    $1.25              $5.00               │
│  Gemini 1.5 Flash  $0.075             $0.30               │
│  Llama 3 70B*      $0.00              $0.00 (self-hosted) │
│                                                          │
│  * Self-hosted: GPU costs of $1–3/hour apply separately  │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Cost Analysis Dashboard

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict

@dataclass
class APIUsageRecord:
    timestamp: datetime
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    endpoint: str
    user_id: str

class CostAnalyzer:
    """API cost analysis engine"""

    PRICING = {
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "claude-sonnet": {"input": 3.00, "output": 15.00},
        "claude-haiku": {"input": 0.25, "output": 1.25},
    }

    def __init__(self):
        self.records: list[APIUsageRecord] = []

    def record(self, model: str, input_tokens: int,
               output_tokens: int, endpoint: str,
               user_id: str):
        """Record usage"""
        pricing = self.PRICING.get(model, {"input": 0, "output": 0})
        cost = (
            input_tokens / 1_000_000 * pricing["input"] +
            output_tokens / 1_000_000 * pricing["output"]
        )
        self.records.append(APIUsageRecord(
            timestamp=datetime.now(),
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            endpoint=endpoint,
            user_id=user_id
        ))

    def get_daily_report(self, date=None) -> dict:
        """Daily cost report"""
        date = date or datetime.now().date()
        day_records = [
            r for r in self.records
            if r.timestamp.date() == date
        ]

        by_model = defaultdict(lambda: {"count": 0, "cost": 0})
        by_endpoint = defaultdict(lambda: {"count": 0, "cost": 0})

        for r in day_records:
            by_model[r.model]["count"] += 1
            by_model[r.model]["cost"] += r.cost
            by_endpoint[r.endpoint]["count"] += 1
            by_endpoint[r.endpoint]["cost"] += r.cost

        total_cost = sum(r.cost for r in day_records)

        return {
            "date": str(date),
            "total_cost": round(total_cost, 4),
            "total_requests": len(day_records),
            "avg_cost_per_request": round(
                total_cost / len(day_records), 4
            ) if day_records else 0,
            "by_model": dict(by_model),
            "by_endpoint": dict(by_endpoint)
        }

    def get_user_cost_report(self, user_id: str,
                              days: int = 30) -> dict:
        """Per-user cost report"""
        cutoff = datetime.now() - timedelta(days=days)
        user_records = [
            r for r in self.records
            if r.user_id == user_id and r.timestamp >= cutoff
        ]

        total_cost = sum(r.cost for r in user_records)
        total_tokens = sum(
            r.input_tokens + r.output_tokens for r in user_records
        )
        total_requests = len(user_records)

        # Daily aggregation
        daily_costs = defaultdict(float)
        for r in user_records:
            daily_costs[str(r.timestamp.date())] += r.cost

        # Per-model aggregation
        model_usage = defaultdict(lambda: {"count": 0, "cost": 0, "tokens": 0})
        for r in user_records:
            model_usage[r.model]["count"] += 1
            model_usage[r.model]["cost"] += r.cost
            model_usage[r.model]["tokens"] += r.input_tokens + r.output_tokens

        return {
            "user_id": user_id,
            "period_days": days,
            "total_cost": round(total_cost, 4),
            "total_tokens": total_tokens,
            "total_requests": total_requests,
            "avg_daily_cost": round(total_cost / days, 4),
            "avg_cost_per_request": round(
                total_cost / total_requests, 4
            ) if total_requests > 0 else 0,
            "daily_costs": dict(daily_costs),
            "model_usage": dict(model_usage)
        }

    def detect_anomalies(self, threshold_multiplier: float = 3.0) -> list[dict]:
        """Cost anomaly detection"""
        # Calculate average daily cost over the past 7 days
        today = datetime.now().date()
        daily_totals = defaultdict(float)
        for r in self.records:
            daily_totals[str(r.timestamp.date())] += r.cost

        costs = list(daily_totals.values())
        if len(costs) < 3:
            return []

        avg_cost = sum(costs[:-1]) / len(costs[:-1])  # Exclude the most recent
        std_cost = (
            sum((c - avg_cost) ** 2 for c in costs[:-1])
            / len(costs[:-1])
        ) ** 0.5

        threshold = avg_cost + threshold_multiplier * std_cost
        today_cost = daily_totals.get(str(today), 0)

        anomalies = []
        if today_cost > threshold:
            anomalies.append({
                "type": "daily_cost_spike",
                "date": str(today),
                "actual_cost": round(today_cost, 4),
                "expected_cost": round(avg_cost, 4),
                "threshold": round(threshold, 4),
                "severity": "critical" if today_cost > threshold * 2 else "warning",
                "message": f"Today's cost ${today_cost:.2f} exceeded threshold ${threshold:.2f}"
            })

        return anomalies
```

### 1.3 Cost Breakdown Visualization

| Optimization Item | Reduction Potential | Difficulty | Priority |
|-----------|----------|--------|--------|
| Introduce caching | 30–50% | Medium | Highest |
| Model differentiation | 40–70% | Low | Highest |
| Prompt optimization | 20–40% | Low | High |
| Batch processing | 10–30% | Medium | High |
| Response limits | 10–20% | Low | Medium |
| Migrate to self-hosting | 50–90% | High | Conditional |

### 1.4 Cost Allocation Analysis Framework

```python
class CostAllocationFramework:
    """Cost allocation analysis framework"""

    def analyze_cost_drivers(self, records: list[APIUsageRecord]) -> dict:
        """Cost driver analysis"""
        total_cost = sum(r.cost for r in records)
        if total_cost == 0:
            return {"error": "No cost data available"}

        # Cost ratio by endpoint
        endpoint_costs = defaultdict(float)
        for r in records:
            endpoint_costs[r.endpoint] += r.cost

        # Top 5 cost drivers
        sorted_endpoints = sorted(
            endpoint_costs.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]

        # Cost by user (Pareto analysis)
        user_costs = defaultdict(float)
        for r in records:
            user_costs[r.user_id] += r.cost

        sorted_users = sorted(
            user_costs.items(),
            key=lambda x: x[1],
            reverse=True
        )

        # What percentage of cost do the top 20% of users account for?
        top_20_pct = int(len(sorted_users) * 0.2) or 1
        top_20_cost = sum(c for _, c in sorted_users[:top_20_pct])
        pareto_ratio = top_20_cost / total_cost * 100

        # Cost by hour of day
        hourly_costs = defaultdict(float)
        for r in records:
            hourly_costs[r.timestamp.hour] += r.cost

        peak_hour = max(hourly_costs, key=hourly_costs.get)

        return {
            "total_cost": f"${total_cost:.2f}",
            "top_endpoints": [
                {
                    "endpoint": ep,
                    "cost": f"${cost:.2f}",
                    "percentage": f"{cost/total_cost*100:.1f}%"
                }
                for ep, cost in sorted_endpoints
            ],
            "pareto_analysis": {
                "top_20_pct_users": top_20_pct,
                "cost_share": f"{pareto_ratio:.1f}%",
                "insight": f"Top {top_20_pct} users consume "
                          f"{pareto_ratio:.0f}% of costs"
            },
            "peak_hour": {
                "hour": peak_hour,
                "cost": f"${hourly_costs[peak_hour]:.2f}",
                "suggestion": "Consider batching requests during peak hours"
            }
        }

    def calculate_unit_cost(self, records: list[APIUsageRecord],
                            revenue: float) -> dict:
        """Unit cost calculation"""
        total_cost = sum(r.cost for r in records)
        total_requests = len(records)

        cost_per_request = total_cost / total_requests if total_requests > 0 else 0
        cost_revenue_ratio = total_cost / revenue * 100 if revenue > 0 else 0
        gross_margin = (revenue - total_cost) / revenue * 100 if revenue > 0 else 0

        return {
            "total_api_cost": f"${total_cost:.2f}",
            "total_requests": total_requests,
            "cost_per_request": f"${cost_per_request:.4f}",
            "revenue": f"${revenue:.2f}",
            "cost_revenue_ratio": f"{cost_revenue_ratio:.1f}%",
            "gross_margin": f"{gross_margin:.1f}%",
            "health": "healthy" if gross_margin >= 70 else (
                "acceptable" if gross_margin >= 50 else "unhealthy"
            ),
            "targets": {
                "cost_revenue_ratio": "20–30% is ideal",
                "gross_margin": "Target 70% or above",
                "cost_per_request": f"Aim for ${cost_per_request * 0.5:.4f} or below"
            }
        }
```

---

## 2. Caching Strategies

### 2.1 Cache Architecture

```
3-Tier Cache Architecture:

  Request
      │
      ▼
  ┌──────────┐  Hit → Immediate response (0ms, $0)
  │ L1: Exact│
  │  Match   │  Redis / In-memory
  └────┬─────┘
       │ Miss
       ▼
  ┌──────────┐  Hit → Return similar result (10ms, $0)
  │ L2: Seman│
  │  -tic    │  Vector DB (Pinecone/pgvector)
  │  Cache   │  Hit when similarity > 0.95
  └────┬─────┘
       │ Miss
       ▼
  ┌──────────┐  API call (500ms, $0.01–$0.10)
  │ L3: AI   │
  │  API Call│  Save result to L1/L2
  └──────────┘
```

### 2.2 Exact Match Cache

```python
import hashlib
import json
import redis
from typing import Optional

class ExactMatchCache:
    """Exact match cache (Redis)"""

    def __init__(self, redis_url: str = "redis://localhost:6379",
                 default_ttl: int = 3600):
        self.redis = redis.from_url(redis_url)
        self.default_ttl = default_ttl
        self.stats = {"hits": 0, "misses": 0}

    def _make_key(self, model: str, messages: list,
                  params: dict) -> str:
        """Generate cache key"""
        content = json.dumps({
            "model": model,
            "messages": messages,
            "temperature": params.get("temperature", 1.0),
            "max_tokens": params.get("max_tokens")
        }, sort_keys=True)
        return f"ai_cache:{hashlib.sha256(content.encode()).hexdigest()}"

    def get(self, model: str, messages: list,
            params: dict) -> Optional[str]:
        """Retrieve from cache"""
        key = self._make_key(model, messages, params)
        result = self.redis.get(key)
        if result:
            self.stats["hits"] += 1
            return json.loads(result)
        self.stats["misses"] += 1
        return None

    def set(self, model: str, messages: list,
            params: dict, response: str,
            ttl: int = None):
        """Save to cache"""
        key = self._make_key(model, messages, params)
        self.redis.setex(
            key,
            ttl or self.default_ttl,
            json.dumps(response)
        )

    @property
    def hit_rate(self) -> float:
        total = self.stats["hits"] + self.stats["misses"]
        return self.stats["hits"] / total if total > 0 else 0

    def get_stats(self) -> dict:
        """Cache statistics"""
        total = self.stats["hits"] + self.stats["misses"]
        return {
            "total_requests": total,
            "hits": self.stats["hits"],
            "misses": self.stats["misses"],
            "hit_rate": f"{self.hit_rate * 100:.1f}%",
            "estimated_savings": f"${self.stats['hits'] * 0.01:.2f}"
        }
```

### 2.3 Semantic Cache

```python
import numpy as np
from openai import OpenAI

class SemanticCache:
    """Semantic cache (reuse results for similar queries)"""

    def __init__(self, similarity_threshold: float = 0.95):
        self.client = OpenAI()
        self.threshold = similarity_threshold
        self.cache: list[dict] = []

    def _get_embedding(self, text: str) -> list[float]:
        """Get embedding vector for text"""
        response = self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding

    def _cosine_similarity(self, a: list[float],
                           b: list[float]) -> float:
        """Cosine similarity"""
        a, b = np.array(a), np.array(b)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    def get(self, query: str) -> Optional[str]:
        """Search cache for similar queries"""
        query_embedding = self._get_embedding(query)

        best_match = None
        best_score = 0

        for entry in self.cache:
            score = self._cosine_similarity(
                query_embedding, entry["embedding"]
            )
            if score > best_score:
                best_score = score
                best_match = entry

        if best_match and best_score >= self.threshold:
            return best_match["response"]
        return None

    def set(self, query: str, response: str):
        """Add to cache"""
        embedding = self._get_embedding(query)
        self.cache.append({
            "query": query,
            "embedding": embedding,
            "response": response,
            "created_at": datetime.now()
        })


class ProductionSemanticCache:
    """Production-grade semantic cache (using pgvector)"""

    def __init__(self, db_url: str,
                 similarity_threshold: float = 0.95):
        self.db_url = db_url
        self.threshold = similarity_threshold
        self.client = OpenAI()

    def setup_table(self):
        """Create table (first time only)"""
        # PostgreSQL + pgvector
        sql = """
        CREATE EXTENSION IF NOT EXISTS vector;

        CREATE TABLE IF NOT EXISTS semantic_cache (
            id SERIAL PRIMARY KEY,
            query_text TEXT NOT NULL,
            query_hash VARCHAR(64) NOT NULL,
            embedding vector(1536),
            response JSONB NOT NULL,
            model VARCHAR(50) NOT NULL,
            hit_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            last_accessed TIMESTAMP DEFAULT NOW(),
            ttl_seconds INTEGER DEFAULT 86400
        );

        CREATE INDEX IF NOT EXISTS idx_cache_embedding
            ON semantic_cache
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);

        CREATE INDEX IF NOT EXISTS idx_cache_hash
            ON semantic_cache (query_hash);
        """
        return sql

    def search_similar(self, query: str,
                       model: str) -> Optional[dict]:
        """Search for similar queries"""
        embedding = self._get_embedding(query)
        embedding_str = str(embedding)

        sql = """
        SELECT id, query_text, response, hit_count,
               1 - (embedding <=> %s::vector) AS similarity
        FROM semantic_cache
        WHERE model = %s
          AND created_at + (ttl_seconds * interval '1 second') > NOW()
        ORDER BY embedding <=> %s::vector
        LIMIT 1
        """

        # Return if result meets threshold
        # result = db.execute(sql, (embedding_str, model, embedding_str))
        # if result and result.similarity >= self.threshold:
        #     Update: hit_count += 1, last_accessed = NOW()
        #     return result.response

        return None

    def store(self, query: str, model: str,
              response: dict, ttl: int = 86400):
        """Save to cache"""
        embedding = self._get_embedding(query)
        query_hash = hashlib.sha256(query.encode()).hexdigest()

        sql = """
        INSERT INTO semantic_cache
            (query_text, query_hash, embedding, response, model, ttl_seconds)
        VALUES (%s, %s, %s::vector, %s, %s, %s)
        ON CONFLICT (query_hash)
        DO UPDATE SET
            response = EXCLUDED.response,
            last_accessed = NOW()
        """
        # db.execute(sql, (query, query_hash, str(embedding),
        #                   json.dumps(response), model, ttl))

    def _get_embedding(self, text: str) -> list[float]:
        response = self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding

    def cleanup_expired(self):
        """Delete expired cache entries"""
        sql = """
        DELETE FROM semantic_cache
        WHERE created_at + (ttl_seconds * interval '1 second') < NOW()
        """
        # db.execute(sql)

    def get_cache_analytics(self) -> dict:
        """Cache analytics"""
        sql = """
        SELECT
            model,
            COUNT(*) as total_entries,
            SUM(hit_count) as total_hits,
            AVG(hit_count) as avg_hits,
            MIN(created_at) as oldest_entry,
            MAX(last_accessed) as latest_access,
            pg_size_pretty(pg_total_relation_size('semantic_cache'))
                as table_size
        FROM semantic_cache
        GROUP BY model
        """
        # return db.execute(sql)
        return {}
```

### 2.4 TTL Optimization Strategy

```python
class TTLOptimizer:
    """TTL (Time-to-Live) optimization"""

    # TTL settings by task type
    TTL_CONFIGS = {
        "static_knowledge": {
            "ttl_seconds": 86400 * 30,  # 30 days
            "description": "Knowledge that does not change (history, science, etc.)",
            "examples": ["What is Python's basic syntax?", "What is Tokyo's population?"]
        },
        "semi_static": {
            "ttl_seconds": 86400 * 7,  # 7 days
            "description": "Information that does not change frequently",
            "examples": ["AI model comparison", "Programming best practices"]
        },
        "daily_update": {
            "ttl_seconds": 86400,  # 1 day
            "description": "Information updated daily",
            "examples": ["Weather forecast summary", "Stock price analysis"]
        },
        "real_time": {
            "ttl_seconds": 300,  # 5 minutes
            "description": "Requires real-time data",
            "examples": ["News summaries", "Real-time chat"]
        },
        "no_cache": {
            "ttl_seconds": 0,
            "description": "Cannot be cached",
            "examples": ["Personal data analysis", "Security-related tasks"]
        }
    }

    def determine_ttl(self, task_type: str,
                      query: str) -> int:
        """Determine appropriate TTL for a query"""
        # Task type based
        config = self.TTL_CONFIGS.get(task_type)
        if config:
            return config["ttl_seconds"]

        # Keyword-based heuristic
        real_time_keywords = ["today", "current", "latest", "real-time"]
        if any(kw in query for kw in real_time_keywords):
            return 300  # 5 minutes

        static_keywords = ["definition", "what is", "basics", "overview", "history"]
        if any(kw in query for kw in static_keywords):
            return 86400 * 30  # 30 days

        return 86400  # Default: 1 day

    def adaptive_ttl(self, cache_key: str,
                      hit_frequency: float) -> int:
        """Adjust TTL based on access frequency"""
        # Keys hit frequently get longer TTL
        if hit_frequency >= 10:  # 10+ times per hour
            return 86400 * 7  # 7 days
        elif hit_frequency >= 1:
            return 86400  # 1 day
        elif hit_frequency >= 0.1:
            return 3600  # 1 hour
        else:
            return 300  # 5 minutes
```

---

## 3. Model Selection Strategy

### 3.1 Optimal Model Selection by Task

```
Model Selection Matrix by Task:

  Quality
  High ┤ ● Contract analysis  ● Code generation
       │   → GPT-4/Opus          → GPT-4/Sonnet
       │
  Med  ┤ ● Article summary    ● Translation
       │   → Sonnet/Haiku         → Sonnet
       │
  Low  ┤ ● Email classification ● Text formatting
       │   → Haiku/Mini            → Mini/Flash
       └──┬────────────┬────────────┬──
         Slow OK     Medium       Fast required
                  Speed requirement
```

### 3.2 Intelligent Routing

```python
class ModelRouter:
    """Cost-optimized model routing"""

    MODELS = {
        "fast_cheap": {
            "name": "gpt-4o-mini",
            "cost_per_1k_tokens": 0.00015,
            "quality": 0.7,
            "speed": "fast"
        },
        "balanced": {
            "name": "claude-haiku",
            "cost_per_1k_tokens": 0.00025,
            "quality": 0.8,
            "speed": "fast"
        },
        "high_quality": {
            "name": "gpt-4o",
            "cost_per_1k_tokens": 0.0025,
            "quality": 0.95,
            "speed": "medium"
        },
        "best": {
            "name": "claude-sonnet",
            "cost_per_1k_tokens": 0.003,
            "quality": 0.98,
            "speed": "medium"
        }
    }

    def select_model(self, task_type: str,
                     quality_required: float = 0.8,
                     budget_sensitive: bool = False) -> str:
        """Select the optimal model for a task"""
        task_mapping = {
            "classification": "fast_cheap",
            "summarization": "balanced",
            "translation": "balanced",
            "content_generation": "high_quality",
            "code_generation": "high_quality",
            "contract_analysis": "best",
            "creative_writing": "best"
        }

        # Default selection by task type
        default = task_mapping.get(task_type, "balanced")
        model = self.MODELS[default]

        # Adjust for quality requirements
        if quality_required > 0.95 and model["quality"] < 0.95:
            model = self.MODELS["best"]
        elif budget_sensitive and model["quality"] > quality_required:
            # Select the cheapest model that meets quality requirements
            cheapest = min(
                (m for m in self.MODELS.values()
                 if m["quality"] >= quality_required),
                key=lambda m: m["cost_per_1k_tokens"]
            )
            model = cheapest

        return model["name"]

# Usage example
router = ModelRouter()
model = router.select_model("classification", budget_sensitive=True)
# → "gpt-4o-mini" (lightweight model is sufficient for classification)
```

### 3.3 Cascade Pattern

```python
class CascadeModelRouter:
    """Cascade model routing

    First process with lightweight model → escalate to higher model if quality is insufficient
    """

    def __init__(self):
        self.cascade_order = [
            {"model": "gpt-4o-mini", "cost": 0.00015, "quality_threshold": 0.8},
            {"model": "claude-haiku", "cost": 0.00025, "quality_threshold": 0.9},
            {"model": "gpt-4o", "cost": 0.0025, "quality_threshold": 0.95},
            {"model": "claude-sonnet", "cost": 0.003, "quality_threshold": 1.0}
        ]

    def process(self, prompt: str, required_quality: float = 0.8,
                quality_evaluator=None) -> dict:
        """Cascade processing"""
        for level, config in enumerate(self.cascade_order):
            response = call_ai(prompt, model=config["model"])

            # Quality evaluation
            if quality_evaluator:
                quality_score = quality_evaluator(response)
            else:
                quality_score = config["quality_threshold"]

            if quality_score >= required_quality:
                return {
                    "response": response,
                    "model_used": config["model"],
                    "cascade_level": level,
                    "quality_score": quality_score,
                    "cost": config["cost"],
                    "message": f"Quality requirement met at level {level}"
                }

        # Reached highest-quality model
        return {
            "response": response,
            "model_used": self.cascade_order[-1]["model"],
            "cascade_level": len(self.cascade_order) - 1,
            "quality_score": quality_score,
            "cost": self.cascade_order[-1]["cost"],
            "message": "Used highest-quality model"
        }

    def estimate_savings(self, task_distribution: dict) -> dict:
        """Estimate savings from cascade pattern"""
        # task_distribution: {"simple": 0.6, "medium": 0.25, "complex": 0.15}
        baseline_cost = 0.003  # All requests use Sonnet
        cascade_cost = (
            task_distribution.get("simple", 0) * 0.00015 +
            task_distribution.get("medium", 0) * 0.00025 +
            task_distribution.get("complex", 0) * 0.003
        )

        savings_pct = (1 - cascade_cost / baseline_cost) * 100

        return {
            "baseline_cost_per_1k": f"${baseline_cost * 1000:.2f}",
            "cascade_cost_per_1k": f"${cascade_cost * 1000:.2f}",
            "savings_percentage": f"{savings_pct:.1f}%",
            "monthly_savings_at_100k_requests": f"${(baseline_cost - cascade_cost) * 100000:.0f}"
        }
```

### 3.4 Fallback Strategy

```python
import time
from typing import Callable


class ModelFallback:
    """Model fallback (automatic switching on failure)"""

    def __init__(self):
        self.fallback_chains = {
            "primary": [
                {"model": "claude-sonnet", "provider": "anthropic"},
                {"model": "gpt-4o", "provider": "openai"},
                {"model": "gemini-1.5-pro", "provider": "google"}
            ],
            "fast": [
                {"model": "claude-haiku", "provider": "anthropic"},
                {"model": "gpt-4o-mini", "provider": "openai"},
                {"model": "gemini-1.5-flash", "provider": "google"}
            ]
        }
        self.provider_health = {
            "anthropic": {"healthy": True, "last_error": None},
            "openai": {"healthy": True, "last_error": None},
            "google": {"healthy": True, "last_error": None}
        }

    def call_with_fallback(self, prompt: str,
                           chain: str = "primary",
                           max_retries: int = 2) -> dict:
        """API call with fallback"""
        models = self.fallback_chains[chain]

        for attempt, config in enumerate(models):
            provider = config["provider"]
            model = config["model"]

            # Skip unhealthy providers
            if not self.provider_health[provider]["healthy"]:
                continue

            for retry in range(max_retries):
                try:
                    response = self._call_api(
                        prompt, model, provider
                    )
                    return {
                        "response": response,
                        "model": model,
                        "provider": provider,
                        "attempt": attempt,
                        "retry": retry,
                        "fallback_used": attempt > 0
                    }
                except RateLimitError:
                    time.sleep(2 ** retry)  # Exponential backoff
                except APIError as e:
                    self._mark_unhealthy(provider, str(e))
                    break  # Move to next provider

        return {"error": "All providers failed"}

    def _call_api(self, prompt: str, model: str,
                  provider: str) -> str:
        """API call (provider-dependent)"""
        # Implementation depends on the provider
        pass

    def _mark_unhealthy(self, provider: str, error: str):
        """Mark a provider as unhealthy"""
        self.provider_health[provider] = {
            "healthy": False,
            "last_error": error,
            "marked_at": datetime.now()
        }

    def health_check(self):
        """Periodic health check"""
        for provider, status in self.provider_health.items():
            if not status["healthy"]:
                # Retry after 5 minutes
                if status.get("marked_at"):
                    elapsed = (datetime.now() - status["marked_at"]).seconds
                    if elapsed > 300:
                        self.provider_health[provider]["healthy"] = True
```

---

## 4. Prompt Optimization

### 4.1 Token Reduction Techniques

```python
# Token reduction examples

# BAD: Verbose prompt (approx. 200 tokens)
prompt_verbose = """
You are a highly capable AI assistant.
Your job is to read the given text and
summarize its content concisely.
The summary should be within 3 lines.
Please include the most important information.
Please summarize the following text:

{text}

Write a summary of the above text in 3 lines or fewer.
"""

# GOOD: Concise prompt (approx. 50 tokens, 75% reduction)
prompt_concise = """
Summarize in 3 lines:
{text}
"""

# Token difference:
# verbose: ~200 tokens × 10,000 times/month = 2M tokens → $5.00
# concise: ~50 tokens × 10,000 times/month = 500K tokens → $1.25
# Monthly savings: $3.75 (75% reduction)
```

### 4.2 Prompt Compression Tool

```python
class PromptCompressor:
    """Prompt compression tool"""

    COMPRESSION_RULES = {
        "remove_filler": {
            "description": "Remove filler words",
            "before": "You are a highly capable AI assistant.",
            "after": "",
            "saving": "~15 tokens"
        },
        "simplify_instruction": {
            "description": "Simplify instructions",
            "before": "Please read the following text and summarize its content concisely.",
            "after": "Summary:",
            "saving": "~20 tokens"
        },
        "use_structured_format": {
            "description": "Use structured format",
            "before": "The name is {name}, age is {age}, occupation is {job}.",
            "after": "name:{name}|age:{age}|job:{job}",
            "saving": "~10 tokens"
        },
        "abbreviate_system_prompt": {
            "description": "Shorten system prompt",
            "before": "You are a helpful assistant that specializes in...",
            "after": "Role: {role}. Task: {task}. Format: {format}.",
            "saving": "~30 tokens"
        }
    }

    def compress(self, prompt: str) -> dict:
        """Compress a prompt"""
        original_length = len(prompt.split())
        compressed = prompt

        # Remove filler words
        fillers = [
            "highly capable", "very helpful",
            "as much as possible", "wherever possible",
            "the following", "the above",
            "please", "kindly"
        ]
        for filler in fillers:
            compressed = compressed.replace(filler, "")

        # Replace verbose expressions
        replacements = {
            "Please summarize the following text": "Summary:",
            "Please answer in English": "In English:",
            "Please list in bullet points": "Bullet points:",
            "Please explain in as much detail as possible": "Details:",
        }
        for old, new in replacements.items():
            compressed = compressed.replace(old, new)

        compressed = compressed.strip()
        compressed_length = len(compressed.split())

        reduction = (1 - compressed_length / original_length) * 100 if original_length > 0 else 0

        return {
            "original": prompt,
            "compressed": compressed,
            "original_words": original_length,
            "compressed_words": compressed_length,
            "reduction": f"{reduction:.1f}%",
            "estimated_token_savings": int(
                (original_length - compressed_length) * 1.3
            )  # Japanese: ~1.3 tokens per character
        }

    def optimize_system_prompt(self, system_prompt: str) -> dict:
        """Optimize system prompt"""
        # System prompts are sent with every request,
        # so optimization has a compounding effect
        compressed = self.compress(system_prompt)
        monthly_requests = 10000  # Assumed

        token_savings_per_request = compressed["estimated_token_savings"]
        monthly_token_savings = token_savings_per_request * monthly_requests

        # GPT-4o input cost: $2.50/1M tokens
        monthly_cost_savings = monthly_token_savings / 1_000_000 * 2.50

        return {
            **compressed,
            "monthly_requests": monthly_requests,
            "monthly_token_savings": monthly_token_savings,
            "monthly_cost_savings": f"${monthly_cost_savings:.2f}",
            "annual_cost_savings": f"${monthly_cost_savings * 12:.2f}"
        }
```

### 4.3 Batch Processing

```python
class BatchProcessor:
    """Optimize API calls through batch processing"""

    def __init__(self, batch_size: int = 10):
        self.batch_size = batch_size
        self.queue: list[dict] = []

    def add_task(self, task: dict):
        """Add a task to the queue"""
        self.queue.append(task)
        if len(self.queue) >= self.batch_size:
            return self.process_batch()
        return None

    def process_batch(self) -> list[dict]:
        """Execute batch processing"""
        if not self.queue:
            return []

        # Combine multiple tasks into a single API call
        combined_prompt = "Process each of the following items:\n\n"
        for i, task in enumerate(self.queue):
            combined_prompt += f"[{i+1}] {task['prompt']}\n"
        combined_prompt += "\nReturn results for each item as a JSON array."

        response = call_ai(combined_prompt)
        results = parse_json_array(response)

        self.queue.clear()
        return results

# Effect:
# Individual processing: 10 calls × (system prompt 100 tokens + input) = 1000 tokens overhead
# Batch processing: 1 call × (system prompt 100 tokens + all input) = 100 tokens overhead
# → 90% reduction in overhead
```

### 4.4 Response Length Optimization

```python
class ResponseOptimizer:
    """Response length optimization"""

    # Recommended max_tokens settings by task
    RECOMMENDED_MAX_TOKENS = {
        "classification": 10,       # "positive" or "negative"
        "sentiment": 5,            # Score of 1–5
        "yes_no": 3,               # "yes" or "no"
        "short_answer": 50,        # 1–2 sentences
        "summary": 200,            # Short summary
        "long_summary": 500,       # Detailed summary
        "article": 1000,           # Article generation
        "code_snippet": 300,       # Code snippet
        "full_code": 2000,         # Complete code
        "analysis": 800            # Analysis report
    }

    def get_optimal_max_tokens(self, task_type: str) -> int:
        """Return optimal max_tokens for a given task"""
        return self.RECOMMENDED_MAX_TOKENS.get(task_type, 500)

    def calculate_output_cost_savings(
        self,
        current_avg_output_tokens: int,
        optimized_output_tokens: int,
        monthly_requests: int,
        model: str = "gpt-4o"
    ) -> dict:
        """Savings from output token optimization"""
        output_price = {"gpt-4o": 10.0, "claude-sonnet": 15.0,
                       "gpt-4o-mini": 0.6, "claude-haiku": 1.25}
        price = output_price.get(model, 10.0)

        current_monthly_cost = (
            current_avg_output_tokens * monthly_requests / 1_000_000 * price
        )
        optimized_monthly_cost = (
            optimized_output_tokens * monthly_requests / 1_000_000 * price
        )
        savings = current_monthly_cost - optimized_monthly_cost

        return {
            "current_avg_tokens": current_avg_output_tokens,
            "optimized_avg_tokens": optimized_output_tokens,
            "token_reduction": f"{(1-optimized_output_tokens/current_avg_output_tokens)*100:.0f}%",
            "current_monthly_cost": f"${current_monthly_cost:.2f}",
            "optimized_monthly_cost": f"${optimized_monthly_cost:.2f}",
            "monthly_savings": f"${savings:.2f}",
            "annual_savings": f"${savings*12:.2f}"
        }
```

---

## 5. Budget Management and Monitoring

### 5.1 Budget Alert System

```python
class BudgetManager:
    """AI API budget management"""

    def __init__(self, monthly_budget: float):
        self.monthly_budget = monthly_budget
        self.alerts = []

    def check_budget(self, current_spend: float,
                      day_of_month: int) -> dict:
        """Budget check"""
        # Calculate linear consumption pace
        expected_spend = self.monthly_budget * (day_of_month / 30)
        pace = current_spend / expected_spend if expected_spend > 0 else 0
        projected_monthly = current_spend * (30 / day_of_month)

        status = "on_track"
        if pace > 1.5:
            status = "critical"
        elif pace > 1.2:
            status = "warning"
        elif pace < 0.5:
            status = "under_utilized"

        alert = {
            "monthly_budget": f"${self.monthly_budget:.2f}",
            "current_spend": f"${current_spend:.2f}",
            "day_of_month": day_of_month,
            "expected_spend": f"${expected_spend:.2f}",
            "pace": f"{pace:.2f}x",
            "projected_monthly": f"${projected_monthly:.2f}",
            "remaining_budget": f"${self.monthly_budget - current_spend:.2f}",
            "remaining_days": 30 - day_of_month,
            "daily_budget_remaining": f"${(self.monthly_budget - current_spend) / (30 - day_of_month):.2f}" if day_of_month < 30 else "$0",
            "status": status,
            "actions": self._recommend_actions(status, pace)
        }

        return alert

    def _recommend_actions(self, status: str,
                            pace: float) -> list[str]:
        """Recommended actions"""
        if status == "critical":
            return [
                "Immediately switch to a lower-cost model",
                "Relax cache threshold (to similarity 0.90)",
                "Temporarily suspend API calls for non-essential features",
                "Reduce daily per-user limit by 50%"
            ]
        elif status == "warning":
            return [
                "Review models used by the highest-cost endpoints",
                "Make more active use of batch processing",
                "Reduce unnecessary retries"
            ]
        elif status == "under_utilized":
            return [
                "Consider reallocating budget",
                "Shorten cache expiration to improve freshness",
                "Consider using higher-tier models for quality improvement"
            ]
        return ["Maintain current pace"]

    def set_user_limits(self, plan: str) -> dict:
        """Per-plan user limits"""
        limits = {
            "free": {
                "daily_requests": 10,
                "daily_tokens": 50000,
                "max_input_tokens": 2000,
                "max_output_tokens": 500,
                "models_allowed": ["gpt-4o-mini"],
                "rate_limit_rpm": 5  # Requests per minute
            },
            "starter": {
                "daily_requests": 100,
                "daily_tokens": 500000,
                "max_input_tokens": 4000,
                "max_output_tokens": 2000,
                "models_allowed": ["gpt-4o-mini", "claude-haiku"],
                "rate_limit_rpm": 20
            },
            "pro": {
                "daily_requests": 1000,
                "daily_tokens": 5000000,
                "max_input_tokens": 8000,
                "max_output_tokens": 4000,
                "models_allowed": ["gpt-4o-mini", "claude-haiku",
                                  "gpt-4o", "claude-sonnet"],
                "rate_limit_rpm": 60
            },
            "enterprise": {
                "daily_requests": -1,  # Unlimited
                "daily_tokens": -1,
                "max_input_tokens": 128000,
                "max_output_tokens": 8000,
                "models_allowed": ["all"],
                "rate_limit_rpm": 300
            }
        }
        return limits.get(plan, limits["free"])


class CostCircuitBreaker:
    """Cost circuit breaker"""

    def __init__(self, daily_limit: float,
                 hourly_limit: float):
        self.daily_limit = daily_limit
        self.hourly_limit = hourly_limit
        self.daily_spend = 0
        self.hourly_spend = 0
        self.is_open = False

    def check_and_record(self, cost: float) -> dict:
        """Check and record cost"""
        if self.is_open:
            return {
                "allowed": False,
                "reason": "Circuit breaker is open",
                "message": "Request rejected because cost limit has been reached"
            }

        self.daily_spend += cost
        self.hourly_spend += cost

        if self.hourly_spend >= self.hourly_limit:
            self.is_open = True
            return {
                "allowed": False,
                "reason": "Hourly limit exceeded",
                "hourly_spend": f"${self.hourly_spend:.2f}",
                "hourly_limit": f"${self.hourly_limit:.2f}"
            }

        if self.daily_spend >= self.daily_limit:
            self.is_open = True
            return {
                "allowed": False,
                "reason": "Daily limit exceeded",
                "daily_spend": f"${self.daily_spend:.2f}",
                "daily_limit": f"${self.daily_limit:.2f}"
            }

        return {"allowed": True, "remaining_daily": self.daily_limit - self.daily_spend}
```

---

## 6. Self-Hosting Strategy

### 6.1 Self-Hosting vs. API Cost Comparison

```python
class SelfHostAnalyzer:
    """Self-hosting vs. API cost analysis"""

    GPU_COSTS = {
        "a100_80gb": {
            "cloud_hourly": 3.00,  # AWS/GCP per hour
            "on_premise": 15000,   # Purchase cost
            "power_monthly": 200,  # Electricity per month
            "throughput_tokens_per_second": 50000,
            "models_supported": ["llama-3-70b", "mixtral-8x7b"]
        },
        "a10g": {
            "cloud_hourly": 1.00,
            "on_premise": 3000,
            "power_monthly": 80,
            "throughput_tokens_per_second": 20000,
            "models_supported": ["llama-3-8b", "mistral-7b"]
        },
        "t4": {
            "cloud_hourly": 0.50,
            "on_premise": 2000,
            "power_monthly": 50,
            "throughput_tokens_per_second": 8000,
            "models_supported": ["mistral-7b"]
        }
    }

    def compare_costs(
        self,
        monthly_tokens: int,
        api_model: str = "gpt-4o",
        self_host_gpu: str = "a100_80gb",
        utilization: float = 0.70
    ) -> dict:
        """Compare costs between API and self-hosting"""
        # API cost
        api_pricing = {
            "gpt-4o": {"input": 2.50, "output": 10.00, "avg": 6.25},
            "claude-sonnet": {"input": 3.00, "output": 15.00, "avg": 9.00},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60, "avg": 0.375}
        }
        api_cost_per_1m = api_pricing.get(api_model, {}).get("avg", 5.0)
        monthly_api_cost = monthly_tokens / 1_000_000 * api_cost_per_1m

        # Self-hosting cost
        gpu = self.GPU_COSTS[self_host_gpu]
        tokens_per_month = gpu["throughput_tokens_per_second"] * 3600 * 24 * 30
        gpus_needed = max(1, int(
            monthly_tokens / (tokens_per_month * utilization)
        ))

        monthly_gpu_cost = gpu["cloud_hourly"] * 24 * 30 * gpus_needed
        monthly_infra_cost = 500  # Management tools, monitoring, etc.
        monthly_self_host_cost = monthly_gpu_cost + monthly_infra_cost

        breakeven_tokens = monthly_self_host_cost / api_cost_per_1m * 1_000_000

        return {
            "monthly_tokens": f"{monthly_tokens:,}",
            "api_cost": {
                "model": api_model,
                "monthly": f"${monthly_api_cost:,.2f}",
                "per_1m_tokens": f"${api_cost_per_1m:.2f}"
            },
            "self_host_cost": {
                "gpu": self_host_gpu,
                "gpus_needed": gpus_needed,
                "monthly_gpu": f"${monthly_gpu_cost:,.2f}",
                "monthly_infra": f"${monthly_infra_cost:,.2f}",
                "monthly_total": f"${monthly_self_host_cost:,.2f}"
            },
            "comparison": {
                "cheaper_option": "self_host" if monthly_self_host_cost < monthly_api_cost else "api",
                "savings": f"${abs(monthly_api_cost - monthly_self_host_cost):,.2f}/month",
                "savings_pct": f"{abs(1 - monthly_self_host_cost/monthly_api_cost)*100:.0f}%"
                              if monthly_api_cost > 0 else "N/A",
                "breakeven_tokens": f"{breakeven_tokens:,.0f} tokens/month"
            },
            "recommendation": (
                f"Self-hosting is more cost-effective above "
                f"{breakeven_tokens/1_000_000:.0f}M tokens/month"
            )
        }
```

---

## 7. Comprehensive Cost Optimization Strategy

### 7.1 Optimization Roadmap

```python
class CostOptimizationRoadmap:
    """Cost optimization roadmap"""

    PHASES = {
        "phase_1_quick_wins": {
            "timeline": "1–2 weeks",
            "expected_savings": "20–30%",
            "actions": [
                {
                    "action": "Set appropriate max_tokens values",
                    "effort": "Low",
                    "impact": "10–15% reduction",
                    "detail": "Limit max_tokens by task type"
                },
                {
                    "action": "Simplify prompts",
                    "effort": "Low",
                    "impact": "10–20% reduction",
                    "detail": "Remove redundant instructions"
                },
                {
                    "action": "Basic model differentiation",
                    "effort": "Low",
                    "impact": "20–40% reduction",
                    "detail": "Switch simple tasks to mini/haiku"
                }
            ]
        },
        "phase_2_caching": {
            "timeline": "2–4 weeks",
            "expected_savings": "30–50% (cumulative)",
            "actions": [
                {
                    "action": "Exact match cache (Redis)",
                    "effort": "Medium",
                    "impact": "15–25% reduction",
                    "detail": "Cache identical requests"
                },
                {
                    "action": "Semantic cache",
                    "effort": "Medium–High",
                    "impact": "10–20% additional reduction",
                    "detail": "Cache similar requests"
                }
            ]
        },
        "phase_3_advanced": {
            "timeline": "1–3 months",
            "expected_savings": "50–70% (cumulative)",
            "actions": [
                {
                    "action": "Cascade model routing",
                    "effort": "High",
                    "impact": "15–25% additional reduction",
                    "detail": "Quality evaluation + staged model selection"
                },
                {
                    "action": "Full adoption of batch processing",
                    "effort": "Medium",
                    "impact": "10–15% additional reduction",
                    "detail": "Asynchronous batch processing pipeline"
                },
                {
                    "action": "Budget management automation",
                    "effort": "Medium",
                    "impact": "Prevent budget overruns",
                    "detail": "Alerts + circuit breaker"
                }
            ]
        },
        "phase_4_self_host": {
            "timeline": "3–6 months",
            "expected_savings": "70–90% (cumulative)",
            "prerequisite": "Monthly API cost of $5,000 or more",
            "actions": [
                {
                    "action": "Deploy self-hosted LLM",
                    "effort": "High",
                    "impact": "50–80% reduction",
                    "detail": "Operate Llama 3 / Mistral"
                },
                {
                    "action": "Fine-tuning",
                    "effort": "High",
                    "impact": "Maintain quality + reduce cost",
                    "detail": "Build domain-specific models"
                }
            ]
        }
    }

    def create_plan(self, current_monthly_cost: float,
                    target_reduction: float = 0.50) -> dict:
        """Create an optimization plan"""
        plan = []
        cumulative_savings = 0

        for phase_name, phase in self.PHASES.items():
            if cumulative_savings >= target_reduction:
                break

            # Estimate savings for this phase
            phase_savings = float(
                phase["expected_savings"].split("-")[0].rstrip("%")
            ) / 100

            remaining_cost = current_monthly_cost * (1 - cumulative_savings)
            phase_dollar_savings = remaining_cost * phase_savings

            plan.append({
                "phase": phase_name,
                "timeline": phase["timeline"],
                "actions": [a["action"] for a in phase["actions"]],
                "estimated_savings": f"${phase_dollar_savings:,.0f}/month",
                "cumulative_savings": f"{(cumulative_savings + phase_savings)*100:.0f}%"
            })

            cumulative_savings += phase_savings

        return {
            "current_cost": f"${current_monthly_cost:,.0f}/month",
            "target_reduction": f"{target_reduction*100:.0f}%",
            "target_cost": f"${current_monthly_cost * (1-target_reduction):,.0f}/month",
            "plan": plan
        }
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Sending All Requests to the API Without Caching

```python
# BAD: Send every request to the API each time
def summarize(text):
    return call_api(text)  # Billed even for identical input

# GOOD: Drastically reduce cost with 3-tier cache
def summarize(text):
    # L1: Exact match
    cached = exact_cache.get(text)
    if cached:
        return cached  # $0

    # L2: Semantic
    similar = semantic_cache.get(text)
    if similar:
        return similar  # $0.0001 (embedding cost only)

    # L3: API call
    result = call_api(text)  # $0.01–$0.10
    exact_cache.set(text, result)
    semantic_cache.set(text, result)
    return result
```

### Anti-Pattern 2: Using the Highest-Performance Model for Everything

```python
# BAD: Use GPT-4 for all tasks
def process_all(tasks):
    for task in tasks:
        result = call_ai(task, model="gpt-4")  # GPT-4 for everything

# GOOD: Select model based on task complexity
def process_all(tasks):
    for task in tasks:
        complexity = estimate_complexity(task)
        if complexity == "simple":
            result = call_ai(task, model="gpt-4o-mini")  # 1/17 the cost
        elif complexity == "medium":
            result = call_ai(task, model="claude-haiku")  # 1/12 the cost
        else:
            result = call_ai(task, model="gpt-4o")  # Only when high quality is needed
```

### Anti-Pattern 3: Sending Unbounded Input Text

```python
# BAD: Send the entire document
def analyze_document(document):
    # Send the entire 100-page document → 100K tokens
    return call_ai(f"Please analyze: {document}")

# GOOD: Extract only the necessary parts through preprocessing
def analyze_document(document):
    # 1. Split into chunks
    chunks = split_into_chunks(document, max_tokens=2000)
    # 2. Extract only relevant chunks
    relevant = find_relevant_chunks(chunks, query, top_k=3)
    # 3. Send only necessary parts → 6K tokens (94% reduction)
    return call_ai(f"Analysis: {' '.join(relevant)}")
```

### Anti-Pattern 4: Operating Without Budget Monitoring

```python
# BAD: No budget management
def run_ai_service():
    while True:
        process_request()  # No limit; surprised by bill at end of month

# GOOD: Multi-layer budget management
def run_ai_service():
    budget = BudgetManager(monthly_budget=5000)
    breaker = CostCircuitBreaker(daily_limit=200, hourly_limit=30)

    while True:
        # Circuit breaker check
        check = breaker.check_and_record(estimated_cost)
        if not check["allowed"]:
            return {"error": check["reason"]}

        # Budget check
        status = budget.check_budget(current_spend, day_of_month)
        if status["status"] == "critical":
            switch_to_cheap_model()

        process_request()
```

---

## 9. FAQ

### Q1: What is a good cache hit rate to aim for?

**A:** It varies significantly by use case. (1) Customer support (FAQ-based): 40–60% (the same questions repeat); (2) Content generation: 10–20% (input differs each time); (3) Classification tasks: 30–50%. Introducing semantic caching achieves 2–3× the hit rate of exact-match caching. A reasonable overall target is 30% or above.

### Q2: When should you migrate to a self-hosted LLM?

**A:** When three conditions are met: (1) monthly API costs exceed $5,000; (2) strict latency requirements (<100ms); (3) data sovereignty requirements. Given GPU costs (A100: $2–3/hour), using the API is cheaper if you spend under $3,000/month. Using a fine-tuned version of Llama 3 or Mistral can achieve 80–90% of GPT-4 quality at 1/10 the cost.

### Q3: How do you prevent budget overruns?

**A:** A 4-layer defense is recommended. (1) Hard limit — set API usage caps in the OpenAI/Anthropic dashboard; (2) Alerts — Slack notifications at 50%/80%/100% of budget; (3) Soft limits — per-user daily/monthly caps; (4) Circuit breaker — automatically stop when abnormal increases are detected. Limiting user input length (max_tokens setting) is especially important.

### Q4: How much can you save with prompt optimization alone?

**A:** Typically 20–40% reduction is achievable. (1) Simplifying system prompts: 15–25% (affects every request); (2) Setting appropriate max_tokens: 10–15% (suppresses unnecessary output); (3) Specifying output format: 5–10% (structured output like JSON). System prompts in particular are included in every request, so they should be optimized first.

### Q5: How do you optimize across multiple providers?

**A:** Three approaches. (1) Cost-based routing — select the cheapest provider for each task type; (2) Fallback — automatic switching on failure (prevents latency degradation); (3) A/B testing — continuously validate the balance between quality and cost. Using a multi-provider library like LiteLLM makes implementation easier.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| Cost structure | API costs account for 20–40% of total; billed per input/output token |
| Caching | 3-tier (exact match → semantic → API) achieves 30–50% reduction |
| Model selection | Route by task complexity; 40–70% reduction possible |
| Cascade | Staged processing (lightweight → high-quality) reduces costs by an additional 15–25% |
| Prompts | Conciseness reduces costs 20–40%; further savings with batch processing |
| Budget management | Multi-layer defense: alerts + circuit breaker + user limits |
| Self-hosting | Consider when API costs exceed $5,000/month; 50–80% reduction possible |
| Monitoring | Daily reports + anomaly detection + automatic shutdown |
| Target | Maintain gross margin of 70% or above; continuous improvement |

---

## Guides to Read Next

- [02-scaling-strategy.md](./02-scaling-strategy.md) — Scaling strategy
- [00-pricing-models.md](./00-pricing-models.md) — Pricing model design
- [../00-automation/00-automation-overview.md](../00-automation/00-automation-overview.md) — AI automation overview

---

## References

1. **OpenAI API Pricing** — https://openai.com/pricing — Latest token pricing table
2. **Anthropic API Pricing** — https://docs.anthropic.com — Claude API pricing and best practices
3. **"Reducing LLM Costs" — Martian (2024)** — Comprehensive guide to LLM cost optimization
4. **Redis Documentation** — https://redis.io/docs — Best practices for cache implementation
5. **pgvector Documentation** — https://github.com/pgvector/pgvector — PostgreSQL vector search
6. **LiteLLM** — https://github.com/BerriAI/litellm — Multi-provider LLM library
7. **vLLM** — https://github.com/vllm-project/vllm — High-efficiency LLM inference engine
