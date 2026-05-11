# Pricing Models — Pay-as-you-go, Subscriptions, and Freemium

> A systematic guide to pricing design for AI SaaS and AI services, covering the design principles, implementation methods, and optimization strategies for usage-based, subscription, and freemium models.

---

## What You Will Learn in This Chapter

1. **Pricing Design Principles Specific to AI** — A pricing framework that accounts for cost structure (API costs, GPU costs)
2. **Design and Implementation of the 3 Major Pricing Models** — Detailed design of usage-based, subscription, and freemium models
3. **Price Optimization and Experimentation** — Practical application of A/B testing, price sensitivity analysis, and LTV maximization
4. **Hybrid Pricing Models** — Maximizing revenue through combinations of multiple models
5. **Psychological Pricing Design** — Pricing techniques based on behavioral economics
6. **International Pricing Strategy** — Region-specific pricing and PPP (Purchasing Power Parity) support


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. AI Pricing Design Principles

### 1.1 AI SaaS Cost Structure

```
┌──────────────────────────────────────────────────────────┐
│              AI SaaS Cost Structure Breakdown             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Fixed Costs (Monthly)        Variable Costs (Usage-Based)│
│  ┌──────────────┐      ┌──────────────────┐            │
│  │ Server        │      │ AI API calls      │ ← Biggest variable│
│  │ ¥30,000      │      │ ¥0.5-50/request  │            │
│  ├──────────────┤      ├──────────────────┤            │
│  │ DB/Storage   │      │ GPU inference time│            │
│  │ ¥10,000      │      │ ¥0.1-5/sec       │            │
│  ├──────────────┤      ├──────────────────┤            │
│  │ Monitoring/  │      │ Storage increment │            │
│  │ Logging      │      │ ¥0.01/MB         │            │
│  │ ¥5,000       │      ├──────────────────┤            │
│  ├──────────────┤      │ Bandwidth/Transfer│            │
│  │ Domain/SSL   │      │ ¥0.001/MB        │            │
│  │ ¥2,000       │      └──────────────────┘            │
│  └──────────────┘                                        │
│  Total: ~¥47,000/mo     Total: ¥1-100/user/day          │
│                                                          │
│  ★ AI API costs accounting for 20-40% of revenue is     │
│    a defining characteristic of AI SaaS                  │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Pricing Framework

```python
# Three elements of pricing
pricing_framework = {
    "cost_based": {
        "description": "Determined by cost + margin",
        "formula": "Price = API cost / (1 - target gross margin)",
        "example": "API cost ¥200/call, 70% gross margin target → ¥667/call",
        "pros": "Avoids losses",
        "cons": "Does not reflect value"
    },
    "value_based": {
        "description": "Determined by the value the customer receives",
        "formula": "Price = Customer's time savings × 30-50%",
        "example": "3-hour task reduced to 10 minutes → ¥5,000/hr × 3h × 30% = ¥4,500",
        "pros": "Enables high unit prices",
        "cons": "Difficult to quantify value"
    },
    "competition_based": {
        "description": "Determined by reference to competitor pricing",
        "formula": "Price = Competitor average × differentiation coefficient",
        "example": "Competitor average $49/mo, 1.5x quality → $69/mo",
        "pros": "Market alignment",
        "cons": "Risk of being drawn into price wars"
    }
}
```

### 1.3 Pricing Principles Specific to AI SaaS

Pricing for AI SaaS differs fundamentally from traditional SaaS. The biggest difference is that **marginal cost is not zero**. In traditional SaaS, the cost of adding one new user is nearly zero, but in AI SaaS, every API call and GPU inference incurs a direct cost.

```python
class AIPricingPrinciples:
    """Principles of AI SaaS pricing design"""

    def __init__(self):
        self.principles = {
            "marginal_cost_awareness": {
                "description": "Visibility into marginal costs",
                "detail": "Track the cost of each API call in real time",
                "implementation": "Introduce cost-tracking middleware"
            },
            "value_metric_alignment": {
                "description": "Alignment with value metrics",
                "detail": "Match the billing unit to the value the customer perceives",
                "implementation": "Design billing based on output units"
            },
            "cost_floor_guarantee": {
                "description": "Guarantee of cost floor",
                "detail": "Pricing that never falls below variable costs on any plan",
                "implementation": "Set dynamic pricing floors"
            },
            "usage_predictability": {
                "description": "Predictability of usage",
                "detail": "A mechanism that lets customers predict their monthly bill",
                "implementation": "Usage dashboard and budget alerts"
            }
        }

    def calculate_minimum_price(
        self,
        api_cost_per_request: float,
        avg_requests_per_user: int,
        target_gross_margin: float = 0.70,
        fixed_cost_per_user: float = 500
    ) -> dict:
        """Calculate the minimum price"""
        variable_cost = api_cost_per_request * avg_requests_per_user
        total_cost = variable_cost + fixed_cost_per_user
        minimum_price = total_cost / (1 - target_gross_margin)

        return {
            "variable_cost": variable_cost,
            "fixed_cost": fixed_cost_per_user,
            "total_cost": total_cost,
            "minimum_price": round(minimum_price),
            "target_gross_margin": f"{target_gross_margin * 100}%",
            "recommendation": f"Set to ¥{round(minimum_price / 100) * 100} or above"
        }

    def model_cost_comparison(self) -> dict:
        """Cost comparison by model"""
        return {
            "gpt-4o": {
                "input_per_1k_tokens": 2.5,  # ¥
                "output_per_1k_tokens": 10.0,
                "avg_cost_per_request": 15.0,
                "recommended_for": "High-quality analysis and generation tasks"
            },
            "gpt-4o-mini": {
                "input_per_1k_tokens": 0.15,
                "output_per_1k_tokens": 0.6,
                "avg_cost_per_request": 1.0,
                "recommended_for": "High-volume processing and simple tasks"
            },
            "claude-3.5-sonnet": {
                "input_per_1k_tokens": 3.0,
                "output_per_1k_tokens": 15.0,
                "avg_cost_per_request": 20.0,
                "recommended_for": "Code generation and complex reasoning"
            },
            "claude-3.5-haiku": {
                "input_per_1k_tokens": 0.25,
                "output_per_1k_tokens": 1.25,
                "avg_cost_per_request": 2.0,
                "recommended_for": "Fast response and classification tasks"
            }
        }


# Usage example
principles = AIPricingPrinciples()
min_price = principles.calculate_minimum_price(
    api_cost_per_request=15.0,  # GPT-4o average
    avg_requests_per_user=200,  # 200 requests/month
    target_gross_margin=0.70
)
# → minimum_price: ¥10,500, recommendation: "Set to ¥10,500 or above"
```

### 1.4 Selecting Value Metrics

A value metric is the unit by which you charge customers. Choosing the right value metric determines the success of the entire pricing model.

```python
class ValueMetricSelector:
    """Tool for selecting value metrics"""

    VALUE_METRICS = {
        "api_calls": {
            "description": "Number of API calls",
            "pros": ["Easy to measure", "Familiar to developers"],
            "cons": ["May diverge from value", "Complex requests billed the same"],
            "best_for": "Developer-facing APIs (OpenAI, Anthropic)",
            "example": "$0.01/request"
        },
        "tokens": {
            "description": "Number of input/output tokens",
            "pros": ["Directly proportional to resource consumption", "High fairness"],
            "cons": ["Hard for customers to understand", "Difficult to predict budget"],
            "best_for": "LLM API providers",
            "example": "$0.003/1K tokens"
        },
        "outputs": {
            "description": "Number of outputs generated",
            "pros": ["Directly tied to value", "Easy for customers to understand"],
            "cons": ["Quality differences not reflected"],
            "best_for": "Content generation tools (Jasper, Copy.ai)",
            "example": "¥50/article generated"
        },
        "seats": {
            "description": "Number of users",
            "pros": ["Predictable", "Easy to sell"],
            "cons": ["Unrelated to usage volume", "Seat sharing issues"],
            "best_for": "Team-oriented SaaS (Notion AI)",
            "example": "¥1,500/user/month"
        },
        "outcomes": {
            "description": "Outcome-based",
            "pros": ["Best value alignment", "High customer satisfaction"],
            "cons": ["Difficult to measure", "Outcome definitions can be ambiguous"],
            "best_for": "Sales support AI (improving close probability)",
            "example": "5% of closed deal value"
        },
        "compute_time": {
            "description": "Compute time",
            "pros": ["Accurate resource consumption tracking", "Fair"],
            "cons": ["Poor customer experience", "Low optimization incentive"],
            "best_for": "ML training platforms",
            "example": "$0.50/GPU hour"
        }
    }

    def recommend_metric(self, target_audience: str,
                         product_type: str) -> dict:
        """Recommend the appropriate value metric for the target"""
        recommendations = {
            ("developer", "api"): ["tokens", "api_calls"],
            ("developer", "platform"): ["compute_time", "api_calls"],
            ("business", "tool"): ["outputs", "seats"],
            ("business", "platform"): ["seats", "outcomes"],
            ("consumer", "app"): ["outputs", "api_calls"],
            ("enterprise", "solution"): ["seats", "outcomes"]
        }

        key = (target_audience, product_type)
        if key in recommendations:
            metrics = recommendations[key]
            return {
                "primary": self.VALUE_METRICS[metrics[0]],
                "secondary": self.VALUE_METRICS[metrics[1]],
                "reasoning": f"{metrics[0]} is the best fit for "
                           f"{product_type} targeting {target_audience}"
            }
        return {"error": "No matching combination found"}
```

---

## 2. Usage-Based Pricing Model

### 2.1 Designing Usage-Based Pricing

```python
class UsageBasedPricing:
    """Usage-based pricing engine"""

    def __init__(self):
        self.tiers = [
            {"name": "Tier 1", "up_to": 1000,   "price_per_unit": 5.0},
            {"name": "Tier 2", "up_to": 10000,  "price_per_unit": 3.0},
            {"name": "Tier 3", "up_to": 100000, "price_per_unit": 1.5},
            {"name": "Tier 4", "up_to": None,    "price_per_unit": 0.8}
        ]

    def calculate_cost(self, usage: int) -> dict:
        """Calculate cost using tiered usage-based pricing"""
        total = 0
        remaining = usage
        breakdown = []

        for tier in self.tiers:
            limit = tier["up_to"] or float("inf")
            if remaining <= 0:
                break

            units_in_tier = min(remaining, limit - (
                self.tiers[self.tiers.index(tier) - 1]["up_to"]
                if self.tiers.index(tier) > 0 else 0
            ))
            cost = units_in_tier * tier["price_per_unit"]
            total += cost
            remaining -= units_in_tier

            breakdown.append({
                "tier": tier["name"],
                "units": units_in_tier,
                "rate": tier["price_per_unit"],
                "cost": cost
            })

        return {
            "total_usage": usage,
            "total_cost": total,
            "average_cost_per_unit": total / usage if usage > 0 else 0,
            "breakdown": breakdown
        }

# Usage example
pricing = UsageBasedPricing()
result = pricing.calculate_cost(5000)
# → ¥19,000 (1000×¥5 + 4000×¥3.5)
```

### 2.2 Usage-Based Pricing Variations

| Pattern | Billing Unit | Use Case | Advantage |
|---------|-------------|----------|-----------|
| Per request | Number of API calls | OpenAI API | Intuitive |
| Per token | Input/output token count | Claude API | Fair |
| Credit system | Prepaid credits | Replicate | Prepaid |
| Per time unit | GPU usage in seconds | AWS SageMaker | Precise |
| Per outcome | Number of generated items | Jasper | Value-aligned |

### 2.3 Advanced Usage-Based Pricing Implementation

```python
from datetime import datetime, timedelta
from typing import Optional
import json
import redis


class AdvancedUsageTracker:
    """Advanced usage-based billing tracker"""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    def record_usage(self, user_id: str, usage_type: str,
                     quantity: int, metadata: dict = None) -> dict:
        """Record usage"""
        now = datetime.utcnow()
        month_key = now.strftime("%Y-%m")
        day_key = now.strftime("%Y-%m-%d")

        # Monthly cumulative
        monthly_key = f"usage:{user_id}:{usage_type}:{month_key}"
        self.redis.incrby(monthly_key, quantity)
        self.redis.expire(monthly_key, 90 * 86400)  # Retain for 90 days

        # Daily cumulative
        daily_key = f"usage:{user_id}:{usage_type}:{day_key}"
        self.redis.incrby(daily_key, quantity)
        self.redis.expire(daily_key, 35 * 86400)  # Retain for 35 days

        # Detailed log (billing evidence)
        log_entry = {
            "timestamp": now.isoformat(),
            "user_id": user_id,
            "type": usage_type,
            "quantity": quantity,
            "metadata": metadata or {}
        }
        log_key = f"usage_log:{user_id}:{month_key}"
        self.redis.rpush(log_key, json.dumps(log_entry))

        monthly_total = int(self.redis.get(monthly_key) or 0)

        return {
            "recorded": quantity,
            "monthly_total": monthly_total,
            "daily_total": int(self.redis.get(daily_key) or 0)
        }

    def get_usage_summary(self, user_id: str,
                          period: str = "month") -> dict:
        """Get usage summary"""
        now = datetime.utcnow()

        if period == "month":
            key_pattern = f"usage:{user_id}:*:{now.strftime('%Y-%m')}"
        elif period == "day":
            key_pattern = f"usage:{user_id}:*:{now.strftime('%Y-%m-%d')}"
        else:
            key_pattern = f"usage:{user_id}:*"

        keys = self.redis.keys(key_pattern)
        summary = {}
        for key in keys:
            parts = key.decode().split(":")
            usage_type = parts[2]
            count = int(self.redis.get(key) or 0)
            summary[usage_type] = summary.get(usage_type, 0) + count

        return summary

    def check_quota(self, user_id: str, usage_type: str,
                    limit: int) -> dict:
        """Check quota"""
        now = datetime.utcnow()
        month_key = f"usage:{user_id}:{usage_type}:{now.strftime('%Y-%m')}"
        current = int(self.redis.get(month_key) or 0)

        remaining = max(0, limit - current)
        usage_ratio = current / limit if limit > 0 else 0

        alert_level = "normal"
        if usage_ratio >= 1.0:
            alert_level = "exceeded"
        elif usage_ratio >= 0.9:
            alert_level = "critical"
        elif usage_ratio >= 0.75:
            alert_level = "warning"

        return {
            "current": current,
            "limit": limit,
            "remaining": remaining,
            "usage_ratio": round(usage_ratio, 3),
            "alert_level": alert_level,
            "should_notify": alert_level in ("warning", "critical")
        }


class CreditSystem:
    """Prepaid credit system implementation"""

    # Credit consumption per operation
    CREDIT_COSTS = {
        "text_generation_basic": 1,
        "text_generation_advanced": 5,
        "image_generation_sd": 3,
        "image_generation_dalle": 10,
        "code_generation": 3,
        "code_review": 2,
        "document_analysis": 4,
        "translation": 2,
        "summarization": 2,
        "voice_synthesis": 8
    }

    # Credit pack definitions
    CREDIT_PACKS = {
        "starter": {"credits": 100, "price": 980, "bonus": 0},
        "standard": {"credits": 500, "price": 3980, "bonus": 50},
        "pro": {"credits": 2000, "price": 12800, "bonus": 400},
        "enterprise": {"credits": 10000, "price": 49800, "bonus": 3000}
    }

    def __init__(self, db):
        self.db = db

    def purchase_credits(self, user_id: str,
                         pack_name: str) -> dict:
        """Purchase credits"""
        pack = self.CREDIT_PACKS[pack_name]
        total_credits = pack["credits"] + pack["bonus"]

        self.db.execute(
            "UPDATE users SET credits = credits + %s WHERE id = %s",
            (total_credits, user_id)
        )

        self.db.execute(
            """INSERT INTO credit_transactions
               (user_id, type, amount, pack, price, created_at)
               VALUES (%s, 'purchase', %s, %s, %s, NOW())""",
            (user_id, total_credits, pack_name, pack["price"])
        )

        return {
            "purchased": pack["credits"],
            "bonus": pack["bonus"],
            "total_added": total_credits,
            "price": pack["price"],
            "price_per_credit": round(pack["price"] / total_credits, 1)
        }

    def consume_credits(self, user_id: str,
                        operation: str) -> dict:
        """Consume credits"""
        cost = self.CREDIT_COSTS.get(operation)
        if cost is None:
            return {"error": f"Unknown operation: {operation}"}

        # Balance check
        balance = self.db.fetchone(
            "SELECT credits FROM users WHERE id = %s", (user_id,)
        )
        if balance["credits"] < cost:
            return {
                "error": "Insufficient credits",
                "required": cost,
                "balance": balance["credits"],
                "suggested_pack": self._suggest_pack(cost)
            }

        # Execute consumption
        self.db.execute(
            "UPDATE users SET credits = credits - %s WHERE id = %s",
            (cost, user_id)
        )

        new_balance = balance["credits"] - cost

        return {
            "consumed": cost,
            "operation": operation,
            "balance": new_balance,
            "low_balance_warning": new_balance < 10
        }

    def _suggest_pack(self, needed: int) -> dict:
        """Suggest a recommended pack"""
        for name, pack in self.CREDIT_PACKS.items():
            if pack["credits"] >= needed:
                return {"pack": name, "price": pack["price"]}
        return {"pack": "enterprise", "price": 49800}
```

### 2.4 Metering Infrastructure for Usage-Based Pricing

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import asyncio
from collections import defaultdict


class MeteringEventType(Enum):
    API_CALL = "api_call"
    TOKEN_USAGE = "token_usage"
    GPU_SECONDS = "gpu_seconds"
    STORAGE_MB = "storage_mb"
    BANDWIDTH_MB = "bandwidth_mb"


@dataclass
class MeteringEvent:
    """Metering event"""
    user_id: str
    event_type: MeteringEventType
    quantity: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)


class MeteringPipeline:
    """Metering pipeline"""

    def __init__(self, batch_size: int = 100,
                 flush_interval: float = 5.0):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.buffer: list[MeteringEvent] = []
        self.aggregated: dict = defaultdict(float)

    async def record(self, event: MeteringEvent):
        """Record an event (with buffering)"""
        self.buffer.append(event)

        # Flush when batch size is reached
        if len(self.buffer) >= self.batch_size:
            await self.flush()

    async def flush(self):
        """Flush the buffer to the database"""
        if not self.buffer:
            return

        events = self.buffer.copy()
        self.buffer.clear()

        # Aggregate
        aggregated = defaultdict(lambda: defaultdict(float))
        for event in events:
            key = (event.user_id, event.event_type.value)
            month = event.timestamp.strftime("%Y-%m")
            aggregated[key][month] += event.quantity

        # DB write (batch)
        batch_inserts = []
        for (user_id, event_type), months in aggregated.items():
            for month, quantity in months.items():
                batch_inserts.append({
                    "user_id": user_id,
                    "event_type": event_type,
                    "month": month,
                    "quantity": quantity
                })

        await self._bulk_upsert(batch_inserts)
        return {"flushed": len(events), "aggregated": len(batch_inserts)}

    async def _bulk_upsert(self, records: list[dict]):
        """Bulk UPSERT (implementation depends on DB)"""
        # For PostgreSQL:
        # INSERT INTO metering (user_id, event_type, month, quantity)
        # VALUES ... ON CONFLICT (user_id, event_type, month)
        # DO UPDATE SET quantity = metering.quantity + EXCLUDED.quantity
        pass

    async def start_periodic_flush(self):
        """Periodic flush task"""
        while True:
            await asyncio.sleep(self.flush_interval)
            await self.flush()


class InvoiceGenerator:
    """Invoice generation"""

    def __init__(self, pricing_config: dict):
        self.pricing = pricing_config

    def generate_invoice(self, user_id: str,
                         usage: dict, month: str) -> dict:
        """Generate a monthly invoice"""
        line_items = []
        total = 0

        for event_type, quantity in usage.items():
            rate = self.pricing.get(event_type, {})
            if not rate:
                continue

            # Calculate tiered cost
            cost = self._calculate_tiered_cost(quantity, rate["tiers"])
            line_items.append({
                "description": rate["description"],
                "quantity": quantity,
                "unit": rate["unit"],
                "amount": cost
            })
            total += cost

        # Check minimum charge
        minimum = self.pricing.get("minimum_charge", 0)
        if total < minimum:
            line_items.append({
                "description": "Minimum charge adjustment",
                "quantity": 1,
                "unit": "flat",
                "amount": minimum - total
            })
            total = minimum

        return {
            "user_id": user_id,
            "month": month,
            "line_items": line_items,
            "subtotal": total,
            "tax": round(total * 0.10),  # 10% consumption tax
            "total": round(total * 1.10),
            "due_date": f"{month}-28",
            "status": "draft"
        }

    def _calculate_tiered_cost(self, quantity: float,
                                tiers: list[dict]) -> float:
        """Calculate tiered cost"""
        total = 0
        remaining = quantity

        for tier in tiers:
            if remaining <= 0:
                break
            tier_limit = tier.get("up_to", float("inf"))
            prev_limit = tier.get("from", 0)
            units = min(remaining, tier_limit - prev_limit)
            total += units * tier["rate"]
            remaining -= units

        return round(total)
```

---

## 3. Subscription Model

### 3.1 Plan Design

```
Subscription 3-Plan Design:

  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  Starter │    │   Pro    │    │Enterprise│
  │  ¥2,980  │    │  ¥9,800  │    │ ¥49,800  │
  │   /mo    │    │   /mo    │    │   /mo    │
  ├──────────┤    ├──────────┤    ├──────────┤
  │ 100/mo   │    │ 1000/mo  │    │Unlimited │
  │ Basic    │    │ All      │    │ All      │
  │ features │    │ features │    │ features │
  │ Email    │    │ Chat     │    │ Dedicated│
  │ support  │    │ support  │    │ manager  │
  │          │    │ API      │    │ SLA 99.9%│
  │          │    │ Team (3) │    │ Custom   │
  │          │    │          │    │ SSO/SAML │
  └──────────┘    └──────────┘    └──────────┘
       │               │               │
  Conversion      ★ Core Plan      Account
  from freemium   (60% of revenue)  manager
```

### 3.2 Stripe Implementation

```python
import stripe

class SubscriptionManager:
    """Stripe subscription management"""

    PLANS = {
        "starter": {
            "price_id": "price_starter_monthly",
            "amount": 2980,
            "credits": 100,
            "features": ["basic_generation", "email_support"]
        },
        "pro": {
            "price_id": "price_pro_monthly",
            "amount": 9800,
            "credits": 1000,
            "features": ["all_features", "api_access", "team_3"]
        },
        "enterprise": {
            "price_id": "price_enterprise_monthly",
            "amount": 49800,
            "credits": -1,  # Unlimited
            "features": ["all_features", "api_access",
                        "unlimited_team", "sso", "sla"]
        }
    }

    def __init__(self, api_key: str):
        stripe.api_key = api_key

    def create_subscription(self, customer_id: str,
                            plan: str) -> dict:
        """Create a subscription"""
        plan_config = self.PLANS[plan]
        subscription = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": plan_config["price_id"]}],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"]
        )
        return {
            "subscription_id": subscription.id,
            "client_secret": (
                subscription.latest_invoice
                .payment_intent.client_secret
            ),
            "status": subscription.status
        }

    def handle_usage_overage(self, user_id: str,
                              current_usage: int) -> dict:
        """Handle usage overage"""
        user = get_user(user_id)
        plan = self.PLANS[user.plan]
        limit = plan["credits"]

        if limit == -1:  # Unlimited plan
            return {"status": "ok"}

        if current_usage >= limit:
            return {
                "status": "limit_reached",
                "options": [
                    {"action": "upgrade", "plan": "pro",
                     "message": "Upgrade to Pro for 10x more usage"},
                    {"action": "addon", "amount": 980,
                     "credits": 100,
                     "message": "Add 100 more uses for ¥980"},
                    {"action": "wait",
                     "message": f"Next reset: {next_reset_date()}"}
                ]
            }
        return {"status": "ok", "remaining": limit - current_usage}
```

### 3.3 Annual Plans and Discount Design

```python
class AnnualPlanManager:
    """Annual plan management"""

    def __init__(self):
        self.discount_rate = 0.20  # 20% discount for annual plan
        self.plans = {
            "starter": {
                "monthly": 2980,
                "annual_monthly": 2384,  # 2980 * 0.8
                "annual_total": 28608   # 2384 * 12
            },
            "pro": {
                "monthly": 9800,
                "annual_monthly": 7840,
                "annual_total": 94080
            },
            "enterprise": {
                "monthly": 49800,
                "annual_monthly": 39840,
                "annual_total": 478080
            }
        }

    def calculate_savings(self, plan: str) -> dict:
        """Calculate savings on annual plan"""
        p = self.plans[plan]
        monthly_total = p["monthly"] * 12
        annual_total = p["annual_total"]
        savings = monthly_total - annual_total

        return {
            "plan": plan,
            "monthly_price": f"¥{p['monthly']:,}/mo",
            "annual_price": f"¥{p['annual_monthly']:,}/mo (annual billing)",
            "annual_total": f"¥{annual_total:,}/year",
            "savings": f"Save ¥{savings:,}/year",
            "savings_months": f"About {savings / p['monthly']:.1f} months free",
            "message": f"Save ¥{savings:,} ({self.discount_rate*100:.0f}%) "
                      f"with an annual plan!"
        }

    def offer_annual_upgrade(self, user_id: str,
                              current_plan: str,
                              months_on_monthly: int) -> dict:
        """Offer annual plan to monthly billing users"""
        if months_on_monthly < 3:
            return {"offer": False, "reason": "Usage period is too short"}

        savings = self.calculate_savings(current_plan)
        p = self.plans[current_plan]

        # Total past monthly payments
        past_spend = p["monthly"] * months_on_monthly

        return {
            "offer": True,
            "user_id": user_id,
            "current_monthly_spend": f"¥{p['monthly']:,}/mo",
            "annual_offer": savings,
            "pitch": f"You've paid ¥{past_spend:,} over the past "
                    f"{months_on_monthly} months. "
                    f"Switch to an annual plan and {savings['savings']}!",
            "urgency": "Switch this month and get the first month free"
        }


class TrialManager:
    """Trial management"""

    TRIAL_CONFIGS = {
        "standard": {
            "duration_days": 14,
            "plan": "pro",
            "requires_card": False,
            "conversion_target": 0.25  # 25%
        },
        "premium": {
            "duration_days": 7,
            "plan": "enterprise",
            "requires_card": True,
            "conversion_target": 0.40  # 40%
        },
        "extended": {
            "duration_days": 30,
            "plan": "pro",
            "requires_card": False,
            "conversion_target": 0.15
        }
    }

    def start_trial(self, user_id: str,
                    trial_type: str = "standard") -> dict:
        """Start a trial"""
        config = self.TRIAL_CONFIGS[trial_type]
        end_date = datetime.utcnow() + timedelta(
            days=config["duration_days"]
        )

        return {
            "user_id": user_id,
            "trial_type": trial_type,
            "plan": config["plan"],
            "end_date": end_date.isoformat(),
            "requires_card": config["requires_card"],
            "features_unlocked": "all",
            "reminder_schedule": [
                {"day": config["duration_days"] - 3,
                 "type": "email", "subject": "3 days left in your trial"},
                {"day": config["duration_days"] - 1,
                 "type": "email", "subject": "Your trial ends tomorrow"},
                {"day": config["duration_days"],
                 "type": "in_app", "subject": "Trial ended"}
            ]
        }

    def check_trial_engagement(self, user_id: str,
                                usage_data: dict) -> dict:
        """Analyze trial user engagement"""
        score = 0
        signals = []

        if usage_data.get("days_active", 0) >= 5:
            score += 30
            signals.append("Active for 5+ days")
        if usage_data.get("features_used", 0) >= 3:
            score += 25
            signals.append("Used 3+ features")
        if usage_data.get("api_connected", False):
            score += 20
            signals.append("API connected")
        if usage_data.get("team_invited", False):
            score += 15
            signals.append("Team member invited")
        if usage_data.get("export_used", False):
            score += 10
            signals.append("Export feature used")

        likelihood = "high" if score >= 60 else (
            "medium" if score >= 30 else "low"
        )

        return {
            "user_id": user_id,
            "engagement_score": score,
            "conversion_likelihood": likelihood,
            "positive_signals": signals,
            "recommended_action": self._get_action(likelihood)
        }

    def _get_action(self, likelihood: str) -> str:
        actions = {
            "high": "Send conversion email without discount",
            "medium": "Promote conversion with 10% discount offer",
            "low": "Offer trial extension (+7 days)"
        }
        return actions.get(likelihood, "Standard follow-up")
```

### 3.4 Handling Plan Upgrades and Downgrades

```python
class PlanChangeManager:
    """Plan change management"""

    def __init__(self, stripe_key: str):
        stripe.api_key = stripe_key

    def upgrade_plan(self, user_id: str,
                     from_plan: str, to_plan: str) -> dict:
        """Handle upgrade"""
        user = get_user(user_id)
        sub = stripe.Subscription.retrieve(user.subscription_id)

        # Proration calculation
        current_period_end = datetime.fromtimestamp(
            sub.current_period_end
        )
        days_remaining = (current_period_end - datetime.utcnow()).days
        total_days = 30  # Approximation

        from_price = self.PLANS[from_plan]["amount"]
        to_price = self.PLANS[to_plan]["amount"]

        # Proration (prorated difference)
        proration = round(
            (to_price - from_price) * days_remaining / total_days
        )

        # Immediate upgrade via Stripe
        stripe.Subscription.modify(
            sub.id,
            items=[{
                "id": sub["items"]["data"][0].id,
                "price": self.PLANS[to_plan]["price_id"]
            }],
            proration_behavior="create_prorations"
        )

        return {
            "action": "upgrade",
            "from_plan": from_plan,
            "to_plan": to_plan,
            "proration_charge": proration,
            "effective": "Immediately",
            "new_limits": self.PLANS[to_plan]["credits"],
            "message": f"Upgrade to {to_plan} plan complete! "
                      f"A prorated charge of ¥{proration:,} will be billed."
        }

    def downgrade_plan(self, user_id: str,
                       from_plan: str, to_plan: str) -> dict:
        """Handle downgrade"""
        user = get_user(user_id)
        sub = stripe.Subscription.retrieve(user.subscription_id)

        # Downgrade takes effect at end of billing period
        stripe.Subscription.modify(
            sub.id,
            items=[{
                "id": sub["items"]["data"][0].id,
                "price": self.PLANS[to_plan]["price_id"]
            }],
            proration_behavior="none"  # No prorated refund
        )

        period_end = datetime.fromtimestamp(
            sub.current_period_end
        ).strftime("%Y-%m-%d")

        return {
            "action": "downgrade",
            "from_plan": from_plan,
            "to_plan": to_plan,
            "effective_date": period_end,
            "message": f"Your plan will change to {to_plan} after "
                      f"the current billing period ends ({period_end}). "
                      f"You can continue using {from_plan} features until then."
        }

    def handle_churn_prevention(self, user_id: str,
                                 cancel_reason: str) -> dict:
        """Churn prevention offers"""
        offers = {
            "too_expensive": {
                "offer": "50% off for 3 months",
                "discount_pct": 50,
                "duration_months": 3,
                "message": "Continue at a special price"
            },
            "not_using_enough": {
                "offer": "Suggest a lower plan",
                "action": "downgrade_suggestion",
                "message": "We'll recommend a better-fitting plan for you"
            },
            "missing_feature": {
                "offer": "Priority feature request handling",
                "action": "feature_request",
                "message": "We'll prioritize developing your requested feature"
            },
            "competitor": {
                "offer": "40% off for 6 months + priority support",
                "discount_pct": 40,
                "duration_months": 6,
                "message": "A special offer to keep you from switching"
            },
            "other": {
                "offer": "1 free month extension",
                "action": "free_month",
                "message": "Try one more month on us"
            }
        }

        reason_key = cancel_reason if cancel_reason in offers else "other"
        offer = offers[reason_key]

        return {
            "user_id": user_id,
            "cancel_reason": cancel_reason,
            "retention_offer": offer,
            "escalate_to_human": cancel_reason == "competitor"
        }
```

---

## 4. Freemium Model

### 4.1 The Golden Ratio of Freemium Design

```
Freemium Conversion Funnel:

  100% ┤ ■■■■■■■■■■ Free users
       │
   30% ┤ ■■■        Active users (use at least once/week)
       │
   10% ┤ ■          Power users (hit the limit)
       │
  3-5% ┤ ▪          Converted paid users
       │
  0.5% ┤ ·          Enterprise conversions
       └──────────────────────────────────────
                    Target conversion rate
```

### 4.2 Designing the Free/Paid Boundary

```python
# Freemium boundary design
freemium_design = {
    "free_tier": {
        "purpose": "Value experience + viral acquisition",
        "limits": {
            "generations_per_month": 10,
            "output_quality": "standard",  # GPT-3.5 equivalent
            "export_format": ["txt"],
            "history_retention": "7 days",
            "watermark": True,
            "api_access": False
        },
        "must_provide": [
            "Experience core features (with limits)",
            "Enough uses to feel the value",
            "Share features (viral)"
        ]
    },
    "paid_tier": {
        "purpose": "Monetizing heavy users",
        "unlocks": {
            "generations_per_month": 1000,
            "output_quality": "premium",  # GPT-4 equivalent
            "export_format": ["txt", "docx", "pdf", "html"],
            "history_retention": "Unlimited",
            "watermark": False,
            "api_access": True,
            "team_features": True
        },
        "trigger_points": [
            "Reaching the 10/month limit",
            "Accessing the high-quality model",
            "On export",
            "On team invitation"
        ]
    }
}
```

### 4.3 Freemium Conversion Rate Optimization

```python
class FreemiumOptimizer:
    """Freemium conversion rate optimization engine"""

    def __init__(self):
        self.conversion_triggers = []
        self.paywall_events = []

    def analyze_conversion_funnel(self, users: list[dict]) -> dict:
        """Analyze the conversion funnel"""
        total = len(users)
        if total == 0:
            return {"error": "No user data"}

        stages = {
            "registered": total,
            "activated": sum(1 for u in users if u.get("activated")),
            "engaged": sum(1 for u in users
                          if u.get("sessions", 0) >= 3),
            "power_user": sum(1 for u in users
                             if u.get("hit_limit", False)),
            "converted": sum(1 for u in users
                            if u.get("plan") != "free"),
            "retained": sum(1 for u in users
                           if u.get("months_paid", 0) >= 3)
        }

        funnel = {}
        prev_count = total
        for stage, count in stages.items():
            funnel[stage] = {
                "count": count,
                "rate_from_total": f"{count/total*100:.1f}%",
                "rate_from_prev": f"{count/prev_count*100:.1f}%"
                                  if prev_count > 0 else "N/A"
            }
            prev_count = count

        return funnel

    def identify_conversion_opportunities(
        self, user_id: str, behavior: dict
    ) -> list[dict]:
        """Identify conversion opportunities"""
        opportunities = []

        # When approaching the limit
        if behavior.get("usage_ratio", 0) >= 0.8:
            opportunities.append({
                "trigger": "usage_limit_approaching",
                "urgency": "high",
                "message": "You've used 80% of your free quota this month. "
                          "Upgrade to Pro for unlimited usage!",
                "cta": "View Pro Plan",
                "discount": None
            })

        # When a premium feature is tried
        if behavior.get("tried_premium_feature", False):
            opportunities.append({
                "trigger": "premium_feature_tease",
                "urgency": "medium",
                "message": "Try GPT-4 high-quality output. "
                          "Available anytime on the Pro plan.",
                "cta": "14-day free trial",
                "discount": None
            })

        # When team invitation is attempted
        if behavior.get("invite_attempted", False):
            opportunities.append({
                "trigger": "team_feature_gate",
                "urgency": "high",
                "message": "Team features are available on the Pro plan and above.",
                "cta": "View Team Plans",
                "discount": "50% off first month"
            })

        # Long-term free user
        if behavior.get("days_on_free", 0) >= 30:
            if behavior.get("sessions", 0) >= 10:
                opportunities.append({
                    "trigger": "engaged_free_user",
                    "urgency": "low",
                    "message": "Thank you for using us for over a month! "
                              "Try the Pro plan with a special discount.",
                    "cta": "View Special Offer",
                    "discount": "30% off first year"
                })

        return opportunities

    def design_paywall(self, context: str) -> dict:
        """Paywall design by context"""
        paywalls = {
            "soft": {
                "description": "Soft paywall",
                "behavior": "Features are usable but quality or speed is limited",
                "example": "Free version uses low-quality model, paid uses high-quality",
                "conversion_rate": "2-4%",
                "user_experience": "Good (low stress)"
            },
            "hard": {
                "description": "Hard paywall",
                "behavior": "Completely blocked when the limit is reached",
                "example": "Blocked after reaching the 10/month cap",
                "conversion_rate": "4-8%",
                "user_experience": "Somewhat poor (frustrating)"
            },
            "metered": {
                "description": "Metered paywall",
                "behavior": "A certain number of uses are free, overages are auto-charged",
                "example": "50/month free, ¥10/use from the 51st",
                "conversion_rate": "5-10%",
                "user_experience": "Moderate (predictable)"
            },
            "feature": {
                "description": "Feature paywall",
                "behavior": "Only advanced features are paid",
                "example": "Basic generation is free, API/export is paid",
                "conversion_rate": "3-6%",
                "user_experience": "Good (core features are free)"
            }
        }

        return paywalls.get(context, paywalls["soft"])
```

### 4.4 Freemium Economics

```python
class FreemiumEconomics:
    """Economic analysis of freemium"""

    def calculate_unit_economics(
        self,
        total_users: int,
        free_users: int,
        paid_users: int,
        arpu: float,  # Average Revenue Per User (paid)
        cost_per_free_user: float,
        cost_per_paid_user: float,
        cac: float  # Customer Acquisition Cost
    ) -> dict:
        """Calculate unit economics"""
        conversion_rate = paid_users / total_users if total_users > 0 else 0

        # Revenue
        monthly_revenue = paid_users * arpu
        annual_revenue = monthly_revenue * 12

        # Costs
        free_user_cost = free_users * cost_per_free_user
        paid_user_cost = paid_users * cost_per_paid_user
        total_cost = free_user_cost + paid_user_cost
        acquisition_cost = total_users * cac

        # Free user costs are borne by paid users
        effective_cost_per_paid_user = total_cost / paid_users if paid_users > 0 else 0

        # LTV calculation (assuming average contract duration of 18 months)
        avg_lifetime_months = 18
        ltv = arpu * avg_lifetime_months
        ltv_cac_ratio = ltv / cac if cac > 0 else 0

        return {
            "metrics": {
                "conversion_rate": f"{conversion_rate*100:.2f}%",
                "monthly_revenue": f"¥{monthly_revenue:,.0f}",
                "annual_revenue": f"¥{annual_revenue:,.0f}",
                "arpu": f"¥{arpu:,.0f}",
                "free_user_cost_monthly": f"¥{free_user_cost:,.0f}",
                "effective_cost_per_paid": f"¥{effective_cost_per_paid_user:,.0f}",
                "gross_margin": f"{(monthly_revenue - total_cost) / monthly_revenue * 100:.1f}%",
                "ltv": f"¥{ltv:,.0f}",
                "cac": f"¥{cac:,.0f}",
                "ltv_cac_ratio": f"{ltv_cac_ratio:.1f}x"
            },
            "health": {
                "conversion_rate_ok": conversion_rate >= 0.03,
                "ltv_cac_ok": ltv_cac_ratio >= 3.0,
                "margin_ok": (monthly_revenue - total_cost) / monthly_revenue >= 0.60
            },
            "recommendations": self._generate_recommendations(
                conversion_rate, ltv_cac_ratio, free_user_cost
            )
        }

    def _generate_recommendations(
        self, cvr: float, ltv_cac: float, free_cost: float
    ) -> list[str]:
        """Generate improvement recommendations"""
        recs = []
        if cvr < 0.02:
            recs.append("Low conversion rate: Tighten free plan limits or "
                       "improve value communication for paid plans")
        if cvr > 0.10:
            recs.append("Conversion rate too high: Free plan may be too restrictive. "
                       "Viral growth may be impaired")
        if ltv_cac < 3.0:
            recs.append("LTV/CAC ratio is low: Need to improve churn rate or increase ARPU")
        if free_cost > 100:
            recs.append("Free user cost is high: Consider introducing caching or "
                       "switching to a lighter model")
        return recs


# Usage example
economics = FreemiumEconomics()
result = economics.calculate_unit_economics(
    total_users=10000,
    free_users=9500,
    paid_users=500,
    arpu=9800,
    cost_per_free_user=50,      # ¥50/free user/month
    cost_per_paid_user=2500,    # ¥2,500/paid user/month
    cac=3000                    # Acquisition cost ¥3,000/person
)
```

---

## 5. Hybrid Pricing Model

### 5.1 Subscription + Usage-Based Hybrid

The model adopted by many of the most successful AI SaaS products. A base fee covers a fixed amount, and overages are charged on a per-use basis.

```python
class HybridPricingEngine:
    """Hybrid pricing engine"""

    PLANS = {
        "starter": {
            "base_price": 2980,
            "included_credits": 100,
            "overage_rate": 50,  # ¥50/use (overages)
            "features": ["basic"],
            "max_overage": 30000  # Monthly overage cap
        },
        "pro": {
            "base_price": 9800,
            "included_credits": 1000,
            "overage_rate": 30,
            "features": ["basic", "advanced", "api"],
            "max_overage": 100000
        },
        "enterprise": {
            "base_price": 49800,
            "included_credits": 10000,
            "overage_rate": 15,
            "features": ["basic", "advanced", "api",
                        "sso", "sla", "custom"],
            "max_overage": None  # No cap
        }
    }

    def calculate_monthly_bill(self, plan: str,
                                usage: int) -> dict:
        """Calculate monthly bill"""
        config = self.PLANS[plan]
        base = config["base_price"]
        included = config["included_credits"]
        overage_rate = config["overage_rate"]
        max_overage = config["max_overage"]

        overage_units = max(0, usage - included)
        overage_charge = overage_units * overage_rate

        if max_overage is not None:
            overage_charge = min(overage_charge, max_overage)

        total = base + overage_charge

        return {
            "plan": plan,
            "base_charge": base,
            "included_usage": included,
            "actual_usage": usage,
            "overage_units": overage_units,
            "overage_charge": overage_charge,
            "total": total,
            "effective_rate_per_unit": round(total / usage, 1)
                                       if usage > 0 else 0,
            "within_included": usage <= included,
            "recommendation": self._recommend_plan(plan, usage)
        }

    def _recommend_plan(self, current_plan: str,
                        usage: int) -> str:
        """Recommend a plan"""
        current = self.PLANS[current_plan]
        included = current["included_credits"]

        if usage > included * 1.5:
            # Next plan may be cheaper
            plans = list(self.PLANS.keys())
            idx = plans.index(current_plan)
            if idx < len(plans) - 1:
                next_plan = plans[idx + 1]
                next_config = self.PLANS[next_plan]
                current_cost = (current["base_price"] +
                               max(0, usage - included) *
                               current["overage_rate"])
                next_cost = next_config["base_price"]
                if next_cost < current_cost:
                    return (f"Recommend upgrading to {next_plan} plan "
                           f"(saves ¥{current_cost - next_cost:,})")
        elif usage < included * 0.3:
            plans = list(self.PLANS.keys())
            idx = plans.index(current_plan)
            if idx > 0:
                prev_plan = plans[idx - 1]
                return f"Low usage — consider the {prev_plan} plan"

        return "Your current plan is optimal"

    def simulate_plans(self, expected_usage: int) -> list[dict]:
        """Simulate costs across all plans"""
        results = []
        for plan_name, config in self.PLANS.items():
            result = self.calculate_monthly_bill(plan_name,
                                                  expected_usage)
            results.append({
                "plan": plan_name,
                "monthly_cost": result["total"],
                "effective_rate": result["effective_rate_per_unit"],
                "overage": result["overage_charge"]
            })

        # Sort by cost
        results.sort(key=lambda x: x["monthly_cost"])
        results[0]["best_value"] = True

        return results
```

### 5.2 Outcome-Based Hybrid

```python
class OutcomeBasedPricing:
    """Outcome-based pricing model"""

    def __init__(self):
        self.outcome_definitions = {
            "lead_generated": {
                "description": "AI-generated lead acquired",
                "base_rate": 500,  # ¥500/lead
                "quality_multiplier": {
                    "hot": 3.0,    # Hot lead: ¥1,500
                    "warm": 1.5,   # Warm lead: ¥750
                    "cold": 1.0    # Cold lead: ¥500
                }
            },
            "document_processed": {
                "description": "AI document processing completed",
                "base_rate": 100,
                "complexity_multiplier": {
                    "simple": 1.0,   # 1-5 pages
                    "medium": 2.0,   # 6-20 pages
                    "complex": 5.0   # 21+ pages
                }
            },
            "customer_resolved": {
                "description": "AI customer support resolved",
                "base_rate": 200,
                "channel_multiplier": {
                    "chat": 1.0,
                    "email": 1.5,
                    "phone": 3.0
                }
            }
        }

    def calculate_outcome_charge(
        self, outcome_type: str, quantity: int,
        quality_or_complexity: str
    ) -> dict:
        """Calculate outcome-based charge"""
        definition = self.outcome_definitions[outcome_type]
        multiplier_key = list(definition.keys())[-1]  # Last multiplier
        multiplier_dict = definition[multiplier_key]
        multiplier = multiplier_dict.get(quality_or_complexity, 1.0)

        unit_price = definition["base_rate"] * multiplier
        total = unit_price * quantity

        return {
            "outcome_type": outcome_type,
            "quantity": quantity,
            "quality": quality_or_complexity,
            "unit_price": unit_price,
            "total": total,
            "breakdown": f"{quantity} × ¥{unit_price:,.0f} = ¥{total:,.0f}"
        }

    def design_hybrid_plan(self, base_monthly: float,
                           outcome_configs: list[dict]) -> dict:
        """Design a hybrid plan"""
        return {
            "base_fee": {
                "amount": base_monthly,
                "includes": "Platform usage fee + basic support",
                "billing": "Fixed billing at start of month"
            },
            "outcome_fees": [
                {
                    "type": config["type"],
                    "rate": config["rate"],
                    "cap": config.get("monthly_cap"),
                    "billing": "End-of-month billing based on actuals"
                }
                for config in outcome_configs
            ],
            "minimum_commitment": base_monthly,
            "estimated_monthly": base_monthly + sum(
                c["rate"] * c.get("expected_volume", 0)
                for c in outcome_configs
            )
        }
```

---

## 6. Psychological Pricing Design

### 6.1 Pricing Techniques Based on Behavioral Economics

```python
class PsychologicalPricing:
    """Psychological pricing design"""

    TECHNIQUES = {
        "charm_pricing": {
            "name": "Charm pricing",
            "description": "¥9,800 feels significantly cheaper than ¥10,000",
            "implementation": "End prices in 80 or 90",
            "effectiveness": "+8-15% conversion",
            "examples": ["¥2,980", "¥9,800", "¥49,800"]
        },
        "anchoring": {
            "name": "Anchoring effect",
            "description": "Showing a high price first makes the mid price seem cheaper",
            "implementation": "Show Enterprise plan first (on the left)",
            "effectiveness": "+20-30% Pro selection rate",
            "examples": ["Enterprise ¥49,800 → Pro ¥9,800 looks cheap"]
        },
        "decoy_effect": {
            "name": "Decoy effect",
            "description": "Make the middle option look attractive in a 3-plan setup",
            "implementation": "Design a middle plan that is close to the higher-end plan",
            "effectiveness": "+30-40% middle plan selection rate",
            "examples": [
                "Starter ¥2,980 (100 uses)",
                "Pro ¥9,800 (1000 uses) ★ Recommended",
                "Enterprise ¥49,800 (Unlimited)"
            ]
        },
        "loss_aversion": {
            "name": "Loss aversion",
            "description": "Emphasize missed opportunity with 'X% OFF today only'",
            "implementation": "Time-limited discount + countdown timer",
            "effectiveness": "+25-35% immediate conversion rate",
            "caution": "Excessive use risks brand damage"
        },
        "round_number_avoidance": {
            "name": "Round number effect",
            "description": "In B2B, round numbers actually convey trustworthiness",
            "implementation": "Use round numbers like ¥50,000/month for Enterprise",
            "effectiveness": "+5-10% B2B deal close rate",
            "examples": ["¥50,000/month", "¥500,000/year"]
        }
    }

    def apply_charm_pricing(self, base_price: float) -> dict:
        """Apply charm pricing"""
        options = []
        # Price ending in 80
        charm_80 = round(base_price / 100) * 100 - 20
        options.append({"price": charm_80, "ending": "80"})
        # Rounded-up price
        round_up = round(base_price / 1000) * 1000
        options.append({"price": round_up, "ending": "000"})
        # Price ending in 980
        charm_980 = round(base_price / 1000) * 1000 - 20
        if charm_980 < 1000:
            charm_980 = 980
        options.append({"price": charm_980, "ending": "980"})

        return {
            "original": base_price,
            "options": options,
            "recommendation": options[2],  # 980 is most effective
            "reasoning": "In the Japanese market, prices ending in 980 yen are most effective"
        }

    def design_pricing_page(self, plans: list[dict]) -> dict:
        """Design a psychologically optimized pricing page"""
        if len(plans) != 3:
            return {"error": "3-plan layout recommended"}

        return {
            "layout": {
                "order": "Right to left: Enterprise → Pro → Starter",
                "highlight": "Visually emphasize the middle plan (Pro)",
                "recommended_badge": "Add 'Most Popular' badge to Pro",
                "cta_color": "Pro uses primary color only, others use gray tones"
            },
            "copy_techniques": {
                "starter": {
                    "label": "For individuals",
                    "cta": "Get started here",
                    "emphasis": "No risk"
                },
                "pro": {
                    "label": "★ Most Popular",
                    "cta": "Start now",
                    "emphasis": "Best value"
                },
                "enterprise": {
                    "label": "For teams and businesses",
                    "cta": "Contact us",
                    "emphasis": "Full support"
                }
            },
            "social_proof": {
                "position": "Above the pricing table",
                "content": "Trusted by 10,000+ companies",
                "logos": "5-8 recognizable company logos"
            },
            "guarantee": {
                "position": "Below the pricing table",
                "content": "30-day money-back guarantee",
                "icon": "Shield/lock icon"
            }
        }
```

### 6.2 Price Display Optimization

```python
class PriceDisplayOptimizer:
    """Price display optimization"""

    def format_price_display(self, monthly_price: float,
                              annual_price: float) -> dict:
        """Optimal price display format"""
        monthly_if_annual = annual_price / 12
        savings = monthly_price - monthly_if_annual
        savings_pct = savings / monthly_price * 100

        return {
            "primary_display": {
                "format": f"¥{monthly_if_annual:,.0f}/mo",
                "subtext": f"Annual billing ¥{annual_price:,.0f}/year",
                "reasoning": "Emphasize the lowest monthly rate (when billed annually)"
            },
            "savings_display": {
                "format": f"Save ¥{savings:,.0f}/month",
                "percentage": f"{savings_pct:.0f}% OFF",
                "annual_savings": f"Save ¥{savings*12:,.0f}/year",
                "best_format": "2 months free"
                              if savings_pct >= 15 else
                              f"Save ¥{savings*12:,.0f}/year"
            },
            "toggle_design": {
                "default": "annual",  # Default to annual billing
                "monthly_label": "Monthly",
                "annual_label": "Annual (Best value)",
                "annual_badge": f"{savings_pct:.0f}% OFF"
            }
        }

    def price_localization(self, base_price_usd: float,
                           region: str) -> dict:
        """Region-specific price optimization"""
        # PPP (Purchasing Power Parity) multipliers
        ppp_multipliers = {
            "us": 1.0,
            "jp": 1.1,      # Japan: slightly higher
            "eu": 0.95,     # EU: roughly equivalent
            "uk": 0.90,
            "in": 0.25,     # India: significant discount
            "br": 0.35,     # Brazil: discount
            "sea": 0.30,    # Southeast Asia: discount
            "kr": 0.85,     # South Korea
            "cn": 0.40,     # China
            "au": 1.05      # Australia
        }

        multiplier = ppp_multipliers.get(region, 1.0)
        local_price_usd = base_price_usd * multiplier

        # Currency conversion rates (approximate)
        currency_rates = {
            "us": ("USD", 1.0), "jp": ("JPY", 150),
            "eu": ("EUR", 0.92), "uk": ("GBP", 0.79),
            "in": ("INR", 83), "br": ("BRL", 4.9),
            "sea": ("USD", 1.0), "kr": ("KRW", 1300),
            "cn": ("CNY", 7.1), "au": ("AUD", 1.5)
        }

        currency, rate = currency_rates.get(region, ("USD", 1.0))
        local_price = round(local_price_usd * rate)

        return {
            "region": region,
            "base_price_usd": base_price_usd,
            "ppp_adjusted_usd": round(local_price_usd, 2),
            "local_currency": currency,
            "local_price": local_price,
            "discount_from_base": f"{(1-multiplier)*100:.0f}%",
            "display": f"{currency} {local_price:,}"
        }
```

---

## 7. Price Experimentation and Optimization

### 7.1 Price Sensitivity Analysis

```
Van Westendorp Price Sensitivity Meter:

  Response rate
  100%┤
     │  \Too cheap     Too expensive/
     │    \           /
  50%┤     \ PMF    /
     │      \ Price/
     │       \   /
     │        \ /  ← Optimal price range
   0%┤─────────╳────────────────
     └──┬──┬──┬──┬──┬──┬──
      ¥1k ¥3k ¥5k ¥8k ¥10k ¥15k
              Price

  Intersection of "too cheap to trust" and "too expensive" = Optimal price
```

### 7.2 A/B Test Implementation

```python
class PricingExperiment:
    """Pricing A/B test"""

    def __init__(self):
        self.experiments = {}

    def create_experiment(self, name: str,
                          variants: list[dict]) -> str:
        """Create a pricing experiment"""
        experiment = {
            "name": name,
            "variants": variants,
            "results": {v["name"]: {"views": 0, "conversions": 0}
                       for v in variants},
            "status": "running"
        }
        self.experiments[name] = experiment
        return name

    def assign_variant(self, user_id: str,
                        experiment_name: str) -> dict:
        """Assign a user to a variant"""
        experiment = self.experiments[experiment_name]
        # Deterministic hash for consistent assignment
        variant_index = hash(f"{user_id}:{experiment_name}") % len(
            experiment["variants"]
        )
        variant = experiment["variants"][variant_index]
        experiment["results"][variant["name"]]["views"] += 1
        return variant

    def record_conversion(self, experiment_name: str,
                           variant_name: str):
        """Record a conversion"""
        self.experiments[experiment_name]["results"][variant_name][
            "conversions"
        ] += 1

    def get_results(self, experiment_name: str) -> dict:
        """Get results"""
        results = self.experiments[experiment_name]["results"]
        for name, data in results.items():
            data["cvr"] = (
                data["conversions"] / data["views"] * 100
                if data["views"] > 0 else 0
            )
        return results

# Usage example
exp = PricingExperiment()
exp.create_experiment("pro_pricing", [
    {"name": "A", "price": 7800, "label": "¥7,800/mo"},
    {"name": "B", "price": 9800, "label": "¥9,800/mo"},
    {"name": "C", "price": 12800, "label": "¥12,800/mo"}
])
```

### 7.3 Determining Statistical Significance

```python
import math
from typing import Tuple


class StatisticalSignificance:
    """Determining statistical significance for pricing tests"""

    @staticmethod
    def calculate_z_score(
        control_conversions: int, control_views: int,
        variant_conversions: int, variant_views: int
    ) -> Tuple[float, bool]:
        """Determine A/B test significance using Z-test"""
        p1 = control_conversions / control_views
        p2 = variant_conversions / variant_views

        # Pooled proportion
        p_pool = (control_conversions + variant_conversions) / \
                 (control_views + variant_views)

        # Standard error
        se = math.sqrt(
            p_pool * (1 - p_pool) *
            (1 / control_views + 1 / variant_views)
        )

        if se == 0:
            return 0, False

        z_score = (p2 - p1) / se
        # 95% confidence level (significant if Z > 1.96)
        is_significant = abs(z_score) > 1.96

        return round(z_score, 3), is_significant

    @staticmethod
    def calculate_sample_size(
        baseline_cvr: float,
        minimum_detectable_effect: float,
        significance_level: float = 0.05,
        power: float = 0.80
    ) -> int:
        """Calculate required sample size"""
        # Z values
        z_alpha = 1.96  # 95% confidence level
        z_beta = 0.84   # 80% power

        p1 = baseline_cvr
        p2 = baseline_cvr * (1 + minimum_detectable_effect)

        n = (
            (z_alpha * math.sqrt(2 * p1 * (1 - p1)) +
             z_beta * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
        ) / (p2 - p1) ** 2

        return math.ceil(n)

    def analyze_experiment(self, experiment_results: dict) -> dict:
        """Comprehensive analysis of experiment results"""
        variants = list(experiment_results.items())
        if len(variants) < 2:
            return {"error": "At least 2 variants are required"}

        # Control (first variant)
        control_name, control_data = variants[0]
        analyses = []

        for name, data in variants[1:]:
            z_score, significant = self.calculate_z_score(
                control_data["conversions"], control_data["views"],
                data["conversions"], data["views"]
            )

            control_cvr = control_data["conversions"] / control_data["views"] * 100
            variant_cvr = data["conversions"] / data["views"] * 100
            lift = (variant_cvr - control_cvr) / control_cvr * 100

            analyses.append({
                "variant": name,
                "control_cvr": f"{control_cvr:.2f}%",
                "variant_cvr": f"{variant_cvr:.2f}%",
                "lift": f"{lift:+.1f}%",
                "z_score": z_score,
                "significant": significant,
                "recommendation": (
                    f"Adopt {name} (significantly improved)"
                    if significant and lift > 0
                    else f"{name} shows no significant difference — continue testing"
                    if not significant
                    else f"{name} is worse than control"
                )
            })

        return {
            "control": control_name,
            "analyses": analyses,
            "conclusion": self._derive_conclusion(analyses)
        }

    def _derive_conclusion(self, analyses: list[dict]) -> str:
        significant_winners = [
            a for a in analyses
            if a["significant"] and float(a["lift"].rstrip("%")) > 0
        ]
        if significant_winners:
            best = max(significant_winners,
                      key=lambda x: float(x["lift"].rstrip("%")))
            return f"Recommendation: Adopt {best['variant']} ({best['lift']} improvement)"
        return "No significant winner. Continue testing or add new variants"
```

### 7.4 LTV Maximization and Price Optimization

```python
class LTVOptimizer:
    """LTV (Customer Lifetime Value) maximization"""

    def calculate_ltv(
        self,
        arpu: float,
        monthly_churn_rate: float,
        gross_margin: float = 0.70
    ) -> dict:
        """Calculate LTV"""
        avg_lifetime_months = 1 / monthly_churn_rate if monthly_churn_rate > 0 else 0
        ltv_gross = arpu * avg_lifetime_months
        ltv_net = ltv_gross * gross_margin

        return {
            "arpu": f"¥{arpu:,.0f}",
            "monthly_churn": f"{monthly_churn_rate*100:.1f}%",
            "avg_lifetime_months": round(avg_lifetime_months, 1),
            "ltv_gross": f"¥{ltv_gross:,.0f}",
            "ltv_net": f"¥{ltv_net:,.0f}",
            "max_cac": f"¥{ltv_net / 3:,.0f}",  # LTV/CAC >= 3
            "health": "Healthy" if avg_lifetime_months >= 12 else "Needs improvement"
        }

    def price_sensitivity_matrix(self, prices: list[float],
                                  churn_rates: list[float]) -> list[dict]:
        """Matrix analysis of price vs. churn rate"""
        results = []
        for price in prices:
            for churn in churn_rates:
                ltv = price / churn if churn > 0 else 0
                revenue_index = ltv * (1 - churn)  # Gross revenue indicator
                results.append({
                    "price": price,
                    "churn": f"{churn*100:.0f}%",
                    "ltv": round(ltv),
                    "revenue_index": round(revenue_index),
                })

        # Identify the optimal combination
        best = max(results, key=lambda x: x["revenue_index"])
        for r in results:
            r["optimal"] = (r["price"] == best["price"] and
                           r["churn"] == best["churn"])

        return results

    def cohort_analysis(self, cohorts: dict) -> dict:
        """LTV prediction via cohort analysis"""
        predictions = {}

        for cohort_month, data in cohorts.items():
            initial_users = data["initial_users"]
            monthly_retention = data["monthly_active"]

            retention_rates = [
                active / initial_users
                for active in monthly_retention
            ]

            # Cumulative revenue
            arpu = data.get("arpu", 9800)
            cumulative_revenue = [
                sum(monthly_retention[:i+1]) * arpu
                for i in range(len(monthly_retention))
            ]

            # LTV prediction (exponential decay fitting)
            if len(retention_rates) >= 3:
                avg_decay = sum(
                    retention_rates[i+1] / retention_rates[i]
                    for i in range(len(retention_rates) - 1)
                    if retention_rates[i] > 0
                ) / (len(retention_rates) - 1)

                predicted_ltv = arpu * retention_rates[-1] / (1 - avg_decay)
            else:
                predicted_ltv = arpu * 12  # Default estimate

            predictions[cohort_month] = {
                "initial_users": initial_users,
                "current_retention": f"{retention_rates[-1]*100:.1f}%",
                "cumulative_revenue": cumulative_revenue[-1],
                "predicted_ltv": round(predicted_ltv),
                "months_observed": len(monthly_retention)
            }

        return predictions
```

---

## 8. International Pricing Strategy

### 8.1 Region-Based Pricing

```python
class InternationalPricingStrategy:
    """International pricing strategy"""

    REGIONAL_CONFIGS = {
        "tier1": {
            "regions": ["us", "uk", "eu", "au", "jp"],
            "pricing_approach": "Standard pricing",
            "discount_pct": 0,
            "payment_methods": ["card", "paypal"]
        },
        "tier2": {
            "regions": ["kr", "tw", "sg", "hk"],
            "pricing_approach": "Slight discount",
            "discount_pct": 15,
            "payment_methods": ["card", "paypal", "local"]
        },
        "tier3": {
            "regions": ["br", "mx", "th", "my", "ph"],
            "pricing_approach": "Significant discount",
            "discount_pct": 40,
            "payment_methods": ["card", "pix", "local"]
        },
        "tier4": {
            "regions": ["in", "id", "vn", "ng", "pk"],
            "pricing_approach": "PPP discount",
            "discount_pct": 65,
            "payment_methods": ["upi", "local", "card"]
        }
    }

    def get_regional_price(self, base_price_usd: float,
                           country_code: str) -> dict:
        """Get region-specific price"""
        for tier_name, config in self.REGIONAL_CONFIGS.items():
            if country_code in config["regions"]:
                discount = config["discount_pct"] / 100
                adjusted_price = base_price_usd * (1 - discount)

                return {
                    "country": country_code,
                    "tier": tier_name,
                    "base_price_usd": base_price_usd,
                    "adjusted_price_usd": round(adjusted_price, 2),
                    "discount": f"{config['discount_pct']}%",
                    "payment_methods": config["payment_methods"],
                    "approach": config["pricing_approach"]
                }

        # Default (treated as Tier 1)
        return {
            "country": country_code,
            "tier": "tier1",
            "base_price_usd": base_price_usd,
            "adjusted_price_usd": base_price_usd,
            "discount": "0%",
            "payment_methods": ["card", "paypal"],
            "approach": "Standard pricing"
        }

    def prevent_arbitrage(self, user_data: dict) -> dict:
        """Prevent arbitrage on region-based pricing"""
        checks = {
            "ip_geolocation": user_data.get("ip_country"),
            "payment_country": user_data.get("card_country"),
            "billing_address": user_data.get("billing_country")
        }

        countries = set(v for v in checks.values() if v)

        if len(countries) > 1:
            return {
                "risk": "high",
                "action": "verify",
                "reason": "Multiple countries detected",
                "detected": checks,
                "recommendation": "Apply the highest pricing tier"
            }

        return {
            "risk": "low",
            "action": "approve",
            "country": countries.pop() if countries else "unknown"
        }
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Pricing That Ignores Costs

```python
# BAD: Set low to match competitors, losing money on API costs
pricing_bad = {
    "plan": "Pro",
    "price": 1980,   # ¥1,980/month
    "api_cost_per_user": 2500,  # API cost ¥2,500/month
    "result": "Losses grow the more it is used"
}

# GOOD: Set pricing after understanding the cost structure
pricing_good = {
    "plan": "Pro",
    "api_cost_per_user": 2500,
    "target_gross_margin": 0.70,
    "minimum_price": 2500 / (1 - 0.70),  # ¥8,333
    "set_price": 9800,  # ¥9,800 with margin
    "actual_margin": (9800 - 2500) / 9800  # 74.5%
}
```

### Anti-Pattern 2: An Overly Generous Free Plan

```python
# BAD: Free plan provides too much value
free_plan_bad = {
    "generations": 100,  # 100/month is enough
    "quality": "premium",  # Best quality
    "result": "Nobody upgrades to paid (conversion rate < 0.5%)"
}

# GOOD: Designed so free is valuable but leaves users wanting more
free_plan_good = {
    "generations": 10,  # Enough to generate "I want more"
    "quality": "standard",  # Users feel the quality difference vs. paid
    "result": "Conversion rate 3-5%, high NPS"
}
```

### Anti-Pattern 3: Overly Complex Pricing Structure

```python
# BAD: Incomprehensible pricing structure
pricing_complex_bad = {
    "plans": 7,  # Too many plans
    "add_ons": 12,  # Too many add-ons
    "pricing_page": "Requires scrolling",
    "result": "Customers confused and bounce (bounce rate 60%+)"
}

# GOOD: Simple, intuitive pricing structure
pricing_simple_good = {
    "plans": 3,  # Starter / Pro / Enterprise
    "add_ons": 2,  # Extra credits / Extra members
    "pricing_page": "All plans comparable on one screen",
    "result": "Easy to understand, fast decision-making"
}
```

### Anti-Pattern 4: Failed Price Increase Patterns

```python
# BAD: Sudden large price increase
price_increase_bad = {
    "old_price": 4980,
    "new_price": 9800,
    "increase_pct": "96.8%",
    "notice_period": "2 weeks",
    "grandfathering": False,
    "result": "Mass cancellations (churn rate up 35%), social media backlash"
}

# GOOD: Gradual and transparent price increase
price_increase_good = {
    "old_price": 4980,
    "new_price": 6980,  # Round 1: 40% increase
    "future_price": 9800,  # Round 2 (6 months later): further increase
    "notice_period": "60 days in advance",
    "grandfathering": True,  # Existing users keep old price for 12 months
    "communication": [
        "Price adjustment due to new feature additions",
        "Existing users keep old price for 12 months",
        "Annual plan extends old price for another 12 months"
    ],
    "result": "Churn rate up 5% (acceptable), ARPU up 40%"
}
```

---

## 10. FAQ

### Q1: Which is better, usage-based or subscription?

**A:** Decide based on the use case. (1) If usage is unpredictable → usage-based (developer APIs, etc.), (2) If usage is stable → subscription (business users, etc.), (3) The strongest option is a "subscription + usage-based hybrid." A base fee includes a fixed amount, and overages are charged per use. Successful examples include Slack, Twilio, and AWS.

### Q2: When and how should I raise prices?

**A:** Three principles. (1) Timing — after achieving PMF, when adding features, during an annual review, (2) Method — grandfather existing users at the old price + charge new users the new price, (3) Magnitude — avoid raising more than 20% at once; increase gradually in 10-15% increments. Give at least 30 days' notice, and communicate the reason for the increase (e.g., new features added) clearly.

### Q3: What is the appropriate gross margin for AI SaaS?

**A:** The industry benchmark is 70-80%. However, because AI SaaS has high API costs, 60% is acceptable in the early stage. Ways to improve: (1) Introduce caching to reduce API calls for the same request (30-50% reduction possible), (2) Use lightweight models (GPT-3.5 is sufficient for simple tasks), (3) Batch processing for API efficiency. API costs also tend to decrease over time, so gross margins naturally improve.

### Q4: What should I do if a competitor is significantly cheaper?

**A:** Don't compete on price. (1) Clarify differentiating factors (accuracy, speed, support quality), (2) Target a different segment (focus on Enterprise rather than SMB), (3) Let customers experience quality through a free trial. Everyone loses in a price war. Stick to value-based pricing.

### Q5: How can I improve a low freemium conversion rate?

**A:** Improve iteratively. (1) Revisit free plan limits (reduce usage count or restrict features), (2) Improve UI to emphasize paid plan value (upgrade prompts when limits are reached), (3) Improve onboarding to help users realize value early (reduce Time to Value), (4) Design triggered emails with time-limited discounts. However, be careful not to restrict the free plan too much, as this diminishes viral growth.

### Q6: How does pricing strategy differ between B2B and B2C?

**A:** It differs significantly. For B2B: (1) Annual contracts recommended, (2) Seat-based billing, (3) Custom price negotiation available, (4) ROI messaging is key, (5) Round numbers preferred over charm pricing. For B2C: (1) Monthly billing is standard, (2) Usage-based billing, (3) Fixed pricing, (4) Emotional and convenience appeal, (5) Charm pricing (¥980) is effective.

---


## FAQ

### Q1: What is the most important point in learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Cost structure | AI API accounts for 20-40% of revenue; target 70%+ gross margin |
| Usage-based | Best for developer-facing products and high usage variability |
| Subscription | For business users; delivers predictable revenue |
| Freemium | Target 3-5% conversion; design free tier to leave users wanting more |
| Hybrid | Subscription base fee + usage-based overage is the strongest option |
| Psychological pricing | Leverage anchoring, decoy effect, and charm pricing |
| International expansion | Region-specific pricing based on PPP |
| Optimization | A/B testing + Van Westendorp + LTV analysis |
| Price increases | Grandfathering + gradual + transparency |

---

## Further Reading

- [01-cost-management.md](./01-cost-management.md) — API cost optimization
- [02-scaling-strategy.md](./02-scaling-strategy.md) — Scaling strategy
- [../01-business/00-ai-saas.md](../01-business/00-ai-saas.md) — AI SaaS product design

---

## References

1. **"Monetizing Innovation" — Madhavan Ramanujam** — Systematic approach to pricing design; essential reading for SaaS pricing
2. **OpenView Partners "SaaS Pricing" (2024)** — https://openviewpartners.com — SaaS pricing benchmarks
3. **"The Psychology of Price" — Leigh Caldwell** — Pricing design based on behavioral economics
