# Model Comparison — Benchmark, Pricing, and Use-Case Selection Guide

> LLM selection cannot be decided by a single metric. You need to comprehensively evaluate benchmark performance, cost, latency, context length, multimodal support, and privacy requirements to choose the model best suited to your use case.

## What You Will Learn in This Chapter

1. **How to read major benchmarks** — The meaning and limitations of MMLU, HumanEval, MT-Bench, and others
2. **Cost-performance tradeoff analysis** — How to find the optimal price-to-quality point
3. **A use-case-driven model selection framework** — A practical method for reverse-engineering model choices from requirements
4. **Comparing and selecting reasoning models** — o1/o3, DeepSeek-R1, and Claude's Extended Thinking
5. **Multi-model routing** — Cost optimization by combining multiple models
6. **Building an evaluation pipeline** — Quantitative model evaluation on your own tasks


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Open-Source LLMs — Llama, Mistral, Qwen and the OSS Ecosystem](./03-open-source.md)

---

## 1. Major Benchmark Explanations

### 1.1 Benchmark Overview

```
┌──────────────────────────────────────────────────────────┐
│              LLM Major Benchmark Taxonomy                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Knowledge & Reasoning                                    │
│  ├── MMLU (57-subject multiple choice)                    │
│  ├── MMLU-Pro (harder improved version)                   │
│  ├── GPQA (graduate-level science questions)              │
│  ├── ARC-Challenge (scientific reasoning)                 │
│  ├── BIG-Bench Hard (hard reasoning collection)           │
│  └── SimpleQA (factuality evaluation)                     │
│                                                          │
│  Code                                                     │
│  ├── HumanEval (Python function generation, 164 problems) │
│  ├── HumanEval+ (extended test case version)              │
│  ├── MBPP (basic programming, 974 problems)               │
│  ├── SWE-bench (bug fixing in real repositories)          │
│  ├── SWE-bench Verified (human-verified subset)           │
│  └── LiveCodeBench (competitive programming)              │
│                                                          │
│  Math                                                     │
│  ├── GSM8K (elementary arithmetic)                        │
│  ├── MATH (high school to university math)                │
│  ├── AIME (math olympiad level)                           │
│  └── FrontierMath (research-level math)                   │
│                                                          │
│  Dialogue & Instruction Following                         │
│  ├── MT-Bench (multi-turn dialogue, GPT-4 judged)         │
│  ├── AlpacaEval 2.0 (instruction following, length-adj.)  │
│  ├── LMSYS Chatbot Arena (human blind evaluation)         │
│  └── WildBench (real user query evaluation)               │
│                                                          │
│  Multilingual                                             │
│  ├── MGSM (multilingual math)                             │
│  ├── JMMLU / JGLUE (Japanese-specific)                    │
│  └── MMMLU (large-scale multilingual MMLU)                │
│                                                          │
│  Safety                                                   │
│  ├── TruthfulQA (misinformation resistance)               │
│  ├── HarmBench (harmfulness evaluation)                   │
│  └── WMDP (dangerous knowledge evaluation)                │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Detailed Benchmark Explanations

#### MMLU (Massive Multitask Language Understanding)

```python
# MMLU evaluation example: 57-subject multiple choice questions
mmlu_example = {
    "subject": "abstract_algebra",
    "question": "Find the degree of the extension Q(sqrt(2), sqrt(3)) over Q.",
    "choices": ["2", "4", "6", "8"],
    "answer": "B",  # 4
}

# MMLU subject categories
mmlu_categories = {
    "STEM": [
        "abstract_algebra", "astronomy", "college_biology",
        "college_chemistry", "college_computer_science",
        "college_mathematics", "college_physics",
        "computer_security", "conceptual_physics",
        "electrical_engineering", "elementary_mathematics",
        "high_school_biology", "high_school_chemistry",
        "high_school_computer_science", "high_school_mathematics",
        "high_school_physics", "high_school_statistics",
        "machine_learning",
    ],
    "Humanities": [
        "formal_logic", "high_school_european_history",
        "high_school_us_history", "high_school_world_history",
        "international_law", "jurisprudence",
        "logical_fallacies", "moral_disputes",
        "moral_scenarios", "philosophy", "prehistory",
        "professional_law", "world_religions",
    ],
    "Social_Sciences": [
        "econometrics", "high_school_geography",
        "high_school_government_and_politics",
        "high_school_macroeconomics",
        "high_school_microeconomics", "high_school_psychology",
        "human_sexuality", "professional_psychology",
        "public_relations", "security_studies",
        "sociology", "us_foreign_policy",
    ],
    "Other": [
        "anatomy", "business_ethics", "clinical_knowledge",
        "college_medicine", "global_facts",
        "human_aging", "management", "marketing",
        "medical_genetics", "miscellaneous",
        "nutrition", "professional_accounting",
        "professional_medicine", "virology",
    ],
}

# MMLU-Pro improvements
mmlu_pro_improvements = {
    "Number of choices": "4 → 10 (harder to guess)",
    "Difficulty": "More specialized questions added",
    "Contamination countermeasure": "Includes newly created questions",
    "Reasoning emphasis": "Question design that cannot be solved by simple memorization",
}
```

#### SWE-bench (Software Engineering Benchmark)

```python
# SWE-bench evaluation structure
swe_bench_structure = {
    "Overview": "Task of resolving Issues from real GitHub repositories",
    "Evaluation method": {
        "Input": "Repository + Issue description",
        "Output": "Patch (diff)",
        "Judgment": "Test suite pass rate",
    },
    "Target repositories": [
        "django/django",
        "scikit-learn/scikit-learn",
        "matplotlib/matplotlib",
        "sympy/sympy",
        "sphinx-doc/sphinx",
        "astropy/astropy",
        "pytest-dev/pytest",
        "pallets/flask",
        "psf/requests",
    ],
    "Variations": {
        "SWE-bench Full": "2,294 problems (full set)",
        "SWE-bench Lite": "300 problems (uniform difficulty subset)",
        "SWE-bench Verified": "500 problems (human-verified)",
    },
}

# SWE-bench score trends (agent-based approach)
swe_bench_scores = {
    "Model/System": {
        "Claude 3.5 Sonnet (SWE-Agent)": 49.0,
        "GPT-4o (SWE-Agent)": 33.2,
        "DeepSeek-V3 (SWE-Agent)": 42.0,
        "Claude 3.5 Sonnet (Aider)": 45.3,
        "OpenHands (Claude)": 53.0,
        "Cognition Devin": 43.8,
    },
}
```

#### Chatbot Arena (LMSYS)

```
┌──────────────────────────────────────────────────────────┐
│        Chatbot Arena Evaluation Mechanism                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  User → Enters prompt                                     │
│     │                                                    │
│     ├─── Model A (anonymous) ──→ Answer A                 │
│     │                                                    │
│     ├─── Model B (anonymous) ──→ Answer B                 │
│     │                                                    │
│     └─── User judges which is better                      │
│           ├── A wins / B wins / Tie / Both bad            │
│           └─── Model names revealed after judgment        │
│                                                          │
│  Elo rating calculation:                                  │
│  ├── Same Elo method as chess                             │
│  ├── Rating updated based on win/loss                     │
│  ├── Beating a stronger model earns more points           │
│  └── Bootstrap used to compute confidence intervals       │
│                                                          │
│  Category rankings:                                       │
│  ├── Overall                                              │
│  ├── Hard Prompts                                         │
│  ├── Coding                                               │
│  ├── Math                                                 │
│  ├── Instruction Following                                │
│  ├── Longer Query                                         │
│  ├── Multi-Turn                                           │
│  └── Style Control (after style adjustment)               │
│                                                          │
│  Reliability:                                             │
│  ├── 1M+ votes (largest-scale human evaluation)           │
│  ├── Bias eliminated through anonymity                    │
│  └── Category-level comparison aligned with actual use    │
└──────────────────────────────────────────────────────────┘
```

### 1.3 Benchmark Score Comparison (Early 2025)

| Model | MMLU | HumanEval | MATH | MT-Bench | Arena Elo |
|--------|------|-----------|------|----------|-----------|
| GPT-4o | 88.7 | 90.2 | 76.6 | 9.3 | ~1280 |
| Claude 3.5 Sonnet | 88.7 | 92.0 | 78.3 | 9.2 | ~1270 |
| Gemini 1.5 Pro | 85.9 | 84.1 | 67.7 | 9.0 | ~1260 |
| Llama 3.1 405B | 87.3 | 89.0 | 73.8 | 8.8 | ~1200 |
| Qwen 2.5 72B | 86.1 | 86.4 | 71.9 | 8.7 | ~1190 |
| DeepSeek-V3 | 87.1 | 82.6 | 90.2 | 8.9 | ~1250 |
| Mixtral 8x22B | 77.8 | 75.0 | 49.8 | 8.1 | ~1140 |
| GPT-4o mini | 82.0 | 87.2 | 70.2 | 8.6 | ~1200 |
| Gemini 1.5 Flash | 78.9 | 74.3 | 54.9 | 8.2 | ~1170 |

*Note: Scores are approximations based on publicly available information and may vary depending on evaluation conditions.*

### 1.4 Reasoning Model Benchmark Comparison

| Model | AIME 2024 | GPQA Diamond | SWE-bench Verified | LiveCodeBench | FrontierMath |
|--------|-----------|-------------|-------------------|--------------|-------------|
| o1 | 83.3 | 78.0 | 48.9 | 63.4 | 25.2 |
| o3-mini (high) | 87.3 | 79.7 | 49.3 | 67.1 | 28.9 |
| DeepSeek-R1 | 79.8 | 71.5 | 49.2 | 65.9 | 23.5 |
| Claude 3.5 (ET) | 75.0 | 68.0 | 50.8 | 58.2 | 18.7 |
| Gemini 2.0 Flash Thinking | 73.3 | 65.4 | 42.1 | 55.3 | 15.8 |

*ET = Extended Thinking*

### 1.5 Benchmark Limitations and Caveats

```python
# Checker to detect pitfalls in benchmark evaluation
class BenchmarkReliabilityChecker:
    """Evaluates the reliability of benchmark scores"""

    def __init__(self):
        self.known_issues = {
            "data_contamination": {
                "description": "Benchmark questions mixed into training data",
                "affected": ["MMLU", "GSM8K", "HumanEval"],
                "severity": "High",
                "mitigation": "Check score trends over time, prioritize newer benchmarks",
            },
            "prompt_sensitivity": {
                "description": "Scores vary significantly based on prompt format",
                "affected": ["MMLU", "ARC", "HellaSwag"],
                "severity": "Medium",
                "mitigation": "Average across multiple prompt formats",
            },
            "saturation": {
                "description": "Top models near ceiling, hard to differentiate",
                "affected": ["GSM8K", "HellaSwag", "MMLU"],
                "severity": "Medium",
                "mitigation": "Refer to harder benchmarks (GPQA, AIME)",
            },
            "gaming": {
                "description": "Divergence between actual capability and benchmark-optimized score",
                "affected": ["General"],
                "severity": "High",
                "mitigation": "Cross-check with human evaluations like Arena",
            },
            "domain_mismatch": {
                "description": "Benchmark diverges from the target use case",
                "affected": ["General"],
                "severity": "High",
                "mitigation": "Run your own evaluation on your own tasks",
            },
        }

    def assess_reliability(self, benchmark: str) -> dict:
        """Evaluate the reliability of a specific benchmark"""
        issues = []
        for issue_name, details in self.known_issues.items():
            if benchmark in details["affected"] or "General" in details["affected"]:
                issues.append({
                    "issue": issue_name,
                    "description": details["description"],
                    "severity": details["severity"],
                    "mitigation": details["mitigation"],
                })

        reliability_score = max(0, 100 - len(issues) * 20)
        return {
            "benchmark": benchmark,
            "reliability_score": reliability_score,
            "issues": issues,
            "recommendation": self._get_recommendation(reliability_score),
        }

    def _get_recommendation(self, score: int) -> str:
        if score >= 80:
            return "High reliability as a reference metric"
        elif score >= 60:
            return "Use in combination with other metrics"
        elif score >= 40:
            return "Use only for screening; not suitable for final decisions"
        else:
            return "Not recommended for standalone use"

# Usage example
checker = BenchmarkReliabilityChecker()
for benchmark in ["MMLU", "SWE-bench Verified", "LMSYS Arena", "GPQA"]:
    result = checker.assess_reliability(benchmark)
    print(f"{benchmark}: Reliability {result['reliability_score']}% - {result['recommendation']}")
```

---

## 2. Cost Comparison

### 2.1 API Pricing Table (Early 2025)

```python
# Model cost calculator (extended version)
from dataclasses import dataclass
from typing import Optional

@dataclass
class ModelPricing:
    """Model pricing information"""
    name: str
    input_price: float    # $/1M tokens
    output_price: float   # $/1M tokens
    cached_input_price: Optional[float] = None  # On cache hit
    batch_discount: float = 1.0  # Batch API discount rate
    context_window: int = 128_000
    max_output: int = 4_096

# Pricing information as of early 2025
PRICING_TABLE = {
    "gpt-4o": ModelPricing(
        "GPT-4o", 2.50, 10.00,
        cached_input_price=1.25, batch_discount=0.5,
        context_window=128_000, max_output=16_384,
    ),
    "gpt-4o-mini": ModelPricing(
        "GPT-4o mini", 0.15, 0.60,
        cached_input_price=0.075, batch_discount=0.5,
        context_window=128_000, max_output=16_384,
    ),
    "o1": ModelPricing(
        "o1", 15.00, 60.00,
        cached_input_price=7.50, batch_discount=0.5,
        context_window=200_000, max_output=100_000,
    ),
    "o3-mini": ModelPricing(
        "o3-mini", 1.10, 4.40,
        cached_input_price=0.55, batch_discount=0.5,
        context_window=200_000, max_output=100_000,
    ),
    "claude-3.5-sonnet": ModelPricing(
        "Claude 3.5 Sonnet", 3.00, 15.00,
        cached_input_price=0.30, batch_discount=0.5,
        context_window=200_000, max_output=8_192,
    ),
    "claude-3.5-haiku": ModelPricing(
        "Claude 3.5 Haiku", 0.80, 4.00,
        cached_input_price=0.08, batch_discount=0.5,
        context_window=200_000, max_output=8_192,
    ),
    "gemini-1.5-pro": ModelPricing(
        "Gemini 1.5 Pro", 1.25, 5.00,
        context_window=2_000_000, max_output=8_192,
    ),
    "gemini-1.5-flash": ModelPricing(
        "Gemini 1.5 Flash", 0.075, 0.30,
        context_window=1_000_000, max_output=8_192,
    ),
    "gemini-2.0-flash": ModelPricing(
        "Gemini 2.0 Flash", 0.10, 0.40,
        context_window=1_000_000, max_output=8_192,
    ),
    "deepseek-v3": ModelPricing(
        "DeepSeek-V3", 0.27, 1.10,
        cached_input_price=0.07,
        context_window=128_000, max_output=8_192,
    ),
    "deepseek-r1": ModelPricing(
        "DeepSeek-R1", 0.55, 2.19,
        cached_input_price=0.14,
        context_window=128_000, max_output=8_192,
    ),
}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_hit_rate: float = 0.0,
    use_batch: bool = False,
) -> dict:
    """Detailed cost calculation"""
    if model not in PRICING_TABLE:
        return {"error": f"Unknown model: {model}"}

    pricing = PRICING_TABLE[model]

    # Calculate cached portion
    cached_tokens = int(input_tokens * cache_hit_rate)
    uncached_tokens = input_tokens - cached_tokens

    if pricing.cached_input_price and cache_hit_rate > 0:
        input_cost = (
            (uncached_tokens / 1_000_000) * pricing.input_price +
            (cached_tokens / 1_000_000) * pricing.cached_input_price
        )
    else:
        input_cost = (input_tokens / 1_000_000) * pricing.input_price

    output_cost = (output_tokens / 1_000_000) * pricing.output_price

    # Batch API discount
    if use_batch:
        input_cost *= pricing.batch_discount
        output_cost *= pricing.batch_discount

    total = input_cost + output_cost

    return {
        "model": pricing.name,
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total": total,
        "cache_savings": (
            (input_tokens / 1_000_000) * pricing.input_price - input_cost
            if cache_hit_rate > 0 else 0
        ),
    }


# Usage example: monthly cost comparison
print("=== Monthly Cost Comparison (1M req, 500 input tokens, 200 output tokens) ===")
for model_id in PRICING_TABLE:
    result = calculate_cost(model_id, 500_000_000, 200_000_000)
    if "error" not in result:
        print(f"{result['model']:25s}: ${result['total']:>10,.2f}/month")

print("\n=== With Caching (50% hit rate) ===")
for model_id in ["claude-3.5-sonnet", "gpt-4o", "deepseek-v3"]:
    normal = calculate_cost(model_id, 500_000_000, 200_000_000)
    cached = calculate_cost(model_id, 500_000_000, 200_000_000, cache_hit_rate=0.5)
    savings = normal["total"] - cached["total"]
    print(f"{cached['model']:25s}: ${cached['total']:>10,.2f}/month (savings: ${savings:,.2f})")

print("\n=== With Batch API ===")
for model_id in ["gpt-4o", "claude-3.5-sonnet", "o1"]:
    normal = calculate_cost(model_id, 500_000_000, 200_000_000)
    batch = calculate_cost(model_id, 500_000_000, 200_000_000, use_batch=True)
    savings = normal["total"] - batch["total"]
    print(f"{batch['model']:25s}: ${batch['total']:>10,.2f}/month (savings: ${savings:,.2f})")
```

### 2.2 Cost Comparison Table

| Model | Input ($/1M) | Output ($/1M) | Est. 1M req/month | Cost Efficiency |
|--------|-----------|-----------|-------------|----------|
| Gemini 1.5 Flash | $0.075 | $0.30 | $97 | Cheapest class |
| Gemini 2.0 Flash | $0.10 | $0.40 | $130 | Cheapest class |
| GPT-4o mini | $0.15 | $0.60 | $195 | Extremely high |
| DeepSeek-V3 | $0.27 | $1.10 | $355 | High |
| DeepSeek-R1 | $0.55 | $2.19 | $713 | High (reasoning-specialized) |
| Claude 3.5 Haiku | $0.80 | $4.00 | $1,200 | High |
| o3-mini | $1.10 | $4.40 | $1,430 | High (reasoning-specialized) |
| Gemini 1.5 Pro | $1.25 | $5.00 | $1,625 | Medium |
| GPT-4o | $2.50 | $10.00 | $3,250 | Medium |
| Claude 3.5 Sonnet | $3.00 | $15.00 | $4,500 | Medium |
| o1 | $15.00 | $60.00 | $19,500 | Low (for high-precision use) |

*1M req/month estimated at avg. 500 input tokens + 200 output tokens*

### 2.3 Cost Optimization Techniques

```python
class CostOptimizer:
    """LLM API cost optimization engine"""

    def __init__(self):
        self.strategies = []

    def analyze_and_recommend(
        self,
        current_model: str,
        monthly_requests: int,
        avg_input_tokens: int,
        avg_output_tokens: int,
        current_monthly_cost: float,
        quality_threshold: float = 0.9,  # What % of current quality to maintain
    ) -> list[dict]:
        """Analyze and recommend cost optimization measures"""
        recommendations = []

        # Strategy 1: Leverage prompt caching
        if current_model in ["claude-3.5-sonnet", "gpt-4o", "deepseek-v3"]:
            pricing = PRICING_TABLE.get(current_model.replace(".", "-").replace(" ", "-").lower())
            if pricing and pricing.cached_input_price:
                cache_savings_rate = 1 - (pricing.cached_input_price / pricing.input_price)
                potential_savings = current_monthly_cost * 0.3 * cache_savings_rate
                recommendations.append({
                    "strategy": "Prompt Caching",
                    "description": "Cache system prompts and few-shot examples",
                    "potential_savings": f"${potential_savings:,.0f}/month",
                    "effort": "Low",
                    "risk": "None",
                })

        # Strategy 2: Leverage Batch API
        if monthly_requests > 100_000:
            batch_savings = current_monthly_cost * 0.5
            recommendations.append({
                "strategy": "Batch API",
                "description": "Move non-real-time processing to batch",
                "potential_savings": f"${batch_savings:,.0f}/month (50% reduction on eligible requests)",
                "effort": "Medium",
                "risk": "Increased latency (processed within 24h)",
            })

        # Strategy 3: Model downgrade (with quality check)
        downgrade_map = {
            "gpt-4o": "gpt-4o-mini",
            "claude-3.5-sonnet": "claude-3.5-haiku",
            "gemini-1.5-pro": "gemini-2.0-flash",
            "o1": "o3-mini",
        }
        if current_model in downgrade_map:
            smaller = downgrade_map[current_model]
            small_pricing = PRICING_TABLE.get(smaller)
            current_pricing = PRICING_TABLE.get(current_model)
            if small_pricing and current_pricing:
                cost_ratio = (
                    (small_pricing.input_price + small_pricing.output_price) /
                    (current_pricing.input_price + current_pricing.output_price)
                )
                savings = current_monthly_cost * (1 - cost_ratio)
                recommendations.append({
                    "strategy": f"Model Downgrade ({current_pricing.name} → {small_pricing.name})",
                    "description": "Use a smaller model for simpler tasks",
                    "potential_savings": f"${savings:,.0f}/month",
                    "effort": "Medium (quality evaluation required)",
                    "risk": "Possible quality degradation",
                })

        # Strategy 4: Smart routing
        if monthly_requests > 50_000:
            recommendations.append({
                "strategy": "Smart Routing",
                "description": "Automatically select model based on task difficulty",
                "potential_savings": f"${current_monthly_cost * 0.4:,.0f}/month",
                "effort": "High",
                "risk": "Depends on routing accuracy",
            })

        # Strategy 5: Prompt optimization
        if avg_input_tokens > 500:
            token_reduction = 0.3  # Expect 30% token reduction
            savings = current_monthly_cost * token_reduction * 0.6  # Input cost ratio
            recommendations.append({
                "strategy": "Prompt Optimization",
                "description": "Compress verbose prompts, remove unnecessary instructions",
                "potential_savings": f"${savings:,.0f}/month",
                "effort": "Low",
                "risk": "Possible quality degradation",
            })

        return sorted(recommendations, key=lambda x: x["effort"])

# Usage example
optimizer = CostOptimizer()
recs = optimizer.analyze_and_recommend(
    current_model="gpt-4o",
    monthly_requests=1_000_000,
    avg_input_tokens=800,
    avg_output_tokens=300,
    current_monthly_cost=5000,
)
for i, rec in enumerate(recs, 1):
    print(f"\n{i}. {rec['strategy']}")
    print(f"   {rec['description']}")
    print(f"   Estimated savings: {rec['potential_savings']}")
    print(f"   Implementation effort: {rec['effort']}")
```

### 2.4 Self-Hosted vs. API Cost

```
┌──────────────────────────────────────────────────────────┐
│        Self-Hosted vs. API Service Cost Analysis          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Cost                                                     │
│  ^                                                       │
│  │                                                       │
│  │  API                                                  │
│  │  ╱                                                    │
│  │ ╱        Self-hosted                                   │
│  │╱         ┌──────────────────────                      │
│  ├─────────┘                                             │
│  │  Initial investment                                    │
│  │  (GPU purchase/rental)                                │
│  │                                                       │
│  └──────────────────────────────────▶ Request volume     │
│          ↑                                               │
│     Break-even point                                      │
│     (~500K-1M req/month)                                  │
│                                                          │
│  Decision criteria:                                       │
│  - < 100K req/month → API only                           │
│  - 100K-1M req/month → Calculate case by case            │
│  - > 1M req/month → Consider self-hosting                │
│  - Data confidentiality requirements → Recommend self-host│
│  - GPU cloud → ~$2-4/GPU-hour (A100)                     │
│  - GPU purchase → $10-15K/GPU initial, recoup in 1-2 yrs │
└──────────────────────────────────────────────────────────┘
```

```python
# Self-hosted deployment cost estimation
class SelfHostCostCalculator:
    """Total Cost of Ownership (TCO) calculation for self-hosted deployments"""

    # GPU specs and pricing
    GPU_SPECS = {
        "A100-80GB": {
            "cloud_hourly": 3.50,  # $/hour (AWS p4d)
            "purchase_price": 15000,
            "vram_gb": 80,
            "fp16_tflops": 312,
        },
        "H100-80GB": {
            "cloud_hourly": 5.50,  # $/hour (AWS p5)
            "purchase_price": 30000,
            "vram_gb": 80,
            "fp16_tflops": 989,
        },
        "L40S-48GB": {
            "cloud_hourly": 1.80,
            "purchase_price": 8000,
            "vram_gb": 48,
            "fp16_tflops": 362,
        },
        "RTX4090-24GB": {
            "cloud_hourly": 0.80,
            "purchase_price": 2000,
            "vram_gb": 24,
            "fp16_tflops": 165,
        },
    }

    # Required GPU count per model
    MODEL_REQUIREMENTS = {
        "Llama-3.1-70B (FP16)": {"vram_needed": 140, "min_gpu": "A100-80GB", "gpu_count": 2},
        "Llama-3.1-70B (INT8)": {"vram_needed": 70, "min_gpu": "A100-80GB", "gpu_count": 1},
        "Llama-3.1-70B (INT4)": {"vram_needed": 35, "min_gpu": "L40S-48GB", "gpu_count": 1},
        "Llama-3.1-8B (FP16)": {"vram_needed": 16, "min_gpu": "RTX4090-24GB", "gpu_count": 1},
        "Qwen-2.5-72B (INT4)": {"vram_needed": 40, "min_gpu": "L40S-48GB", "gpu_count": 1},
        "DeepSeek-V3 (FP8)": {"vram_needed": 640, "min_gpu": "H100-80GB", "gpu_count": 8},
    }

    def calculate_tco(
        self,
        model: str,
        monthly_requests: int,
        deployment_type: str = "cloud",  # "cloud" or "on-premise"
        months: int = 12,
    ) -> dict:
        """TCO calculation"""
        if model not in self.MODEL_REQUIREMENTS:
            return {"error": f"Unknown model: {model}"}

        req = self.MODEL_REQUIREMENTS[model]
        gpu_spec = self.GPU_SPECS[req["min_gpu"]]
        gpu_count = req["gpu_count"]

        if deployment_type == "cloud":
            monthly_gpu_cost = gpu_spec["cloud_hourly"] * 24 * 30 * gpu_count
            initial_cost = 0
            monthly_ops = monthly_gpu_cost * 0.1  # 10% operations cost
        else:
            initial_cost = gpu_spec["purchase_price"] * gpu_count
            monthly_gpu_cost = 0
            # Electricity + cooling + network
            power_cost = 0.5 * gpu_count * 24 * 30 * 0.15  # kW * hours * $/kWh
            monthly_ops = power_cost + 500  # Fixed operations cost

        total_cost = initial_cost + (monthly_gpu_cost + monthly_ops) * months
        cost_per_request = total_cost / (monthly_requests * months) if monthly_requests > 0 else 0

        return {
            "model": model,
            "deployment": deployment_type,
            "gpu": f"{gpu_count}x {req['min_gpu']}",
            "initial_cost": f"${initial_cost:,.0f}",
            "monthly_cost": f"${monthly_gpu_cost + monthly_ops:,.0f}",
            "total_cost_12m": f"${total_cost:,.0f}",
            "cost_per_request": f"${cost_per_request:.6f}",
        }

# Usage example
calc = SelfHostCostCalculator()
for model in ["Llama-3.1-70B (INT4)", "Llama-3.1-8B (FP16)", "Qwen-2.5-72B (INT4)"]:
    result = calc.calculate_tco(model, monthly_requests=500_000, deployment_type="cloud")
    print(f"{model}: Monthly {result['monthly_cost']} / per-request {result['cost_per_request']}")
```

---

## 3. Feature Comparison

### 3.1 Feature Matrix (Detailed)

| Feature | GPT-4o | Claude 3.5 | Gemini 1.5 | Llama 3.1 | Qwen 2.5 | DeepSeek-V3 |
|------|--------|-----------|-----------|----------|----------|------------|
| Text generation | S | S | S | A | A | S |
| Code generation | S | S | A | A | A | S |
| Image input | S | S | S | N/A | A (VL) | N/A |
| Audio input | S | N/A | S | N/A | A (Audio) | N/A |
| Video input | N/A | N/A | S | N/A | N/A | N/A |
| Image generation | S | N/A | S | N/A | N/A | N/A |
| Function Calling | S | S | S | A | A | A |
| JSON Mode | S | S | S | A | A | S |
| Structured Output | S | S | A | A | A | A |
| System Prompt | S | S | S | S | S | S |
| Streaming | S | S | S | S | S | S |
| Fine-tuning | A | N/A | A | S | S | S |
| Prompt caching | S | S | N/A | N/A | N/A | S |
| Batch API | S | S | N/A | N/A | N/A | N/A |
| Reasoning mode | S (o1) | S (ET) | A (Thinking) | N/A | A (QwQ) | S (R1) |

*S=Excellent, A=Supported, N/A=Not supported*

### 3.2 Context Length Comparison

| Model | Max Context | Practical Accuracy Range | Needle-in-Haystack |
|--------|----------------|-------------------|--------------------|
| Gemini 1.5 Pro | 2,000K | ~1,000K | 99.7% (1M) |
| Gemini 2.0 Flash | 1,000K | ~500K | 99.2% (500K) |
| Claude 3.5 Sonnet | 200K | ~150K | 99.5% (200K) |
| GPT-4o | 128K | ~64K | 98.8% (128K) |
| o1 | 200K | ~128K | 99.0% (128K) |
| Llama 3.1 | 128K | ~64K | 97.5% (128K) |
| Qwen 2.5 | 128K | ~32K | 96.8% (64K) |
| DeepSeek-V3 | 128K | ~64K | 98.2% (128K) |
| Mixtral 8x22B | 64K | ~32K | 95.3% (32K) |

### 3.3 Latency Comparison

```python
# Latency measurement and comparison tool
import asyncio
import time
import statistics
from dataclasses import dataclass

@dataclass
class LatencyResult:
    model: str
    ttft_ms: float      # Time to First Token
    tps: float           # Tokens per Second
    total_ms: float      # Total Response Time
    output_tokens: int

class LatencyBenchmark:
    """Cross-model latency comparison benchmark"""

    # Approximate values from public benchmarks (Artificial Analysis)
    LATENCY_DATA = {
        "gpt-4o": {
            "ttft_ms": 450,
            "tps": 95,
            "p50_total_ms": 2200,
            "p99_total_ms": 5500,
        },
        "gpt-4o-mini": {
            "ttft_ms": 280,
            "tps": 140,
            "p50_total_ms": 1200,
            "p99_total_ms": 3000,
        },
        "claude-3.5-sonnet": {
            "ttft_ms": 500,
            "tps": 80,
            "p50_total_ms": 2800,
            "p99_total_ms": 6000,
        },
        "claude-3.5-haiku": {
            "ttft_ms": 320,
            "tps": 120,
            "p50_total_ms": 1500,
            "p99_total_ms": 3500,
        },
        "gemini-1.5-flash": {
            "ttft_ms": 200,
            "tps": 160,
            "p50_total_ms": 900,
            "p99_total_ms": 2200,
        },
        "gemini-2.0-flash": {
            "ttft_ms": 180,
            "tps": 180,
            "p50_total_ms": 800,
            "p99_total_ms": 2000,
        },
        "deepseek-v3": {
            "ttft_ms": 600,
            "tps": 60,
            "p50_total_ms": 3500,
            "p99_total_ms": 8000,
        },
        "o1": {
            "ttft_ms": 5000,   # Includes reasoning time
            "tps": 70,
            "p50_total_ms": 15000,
            "p99_total_ms": 45000,
        },
    }

    def compare(self, use_case: str) -> list[dict]:
        """Evaluate latency suitability by use case"""
        latency_requirements = {
            "Real-time chat": {"max_ttft": 500, "min_tps": 80},
            "Streaming UI": {"max_ttft": 1000, "min_tps": 50},
            "Backend processing": {"max_ttft": 5000, "min_tps": 30},
            "Batch processing": {"max_ttft": 60000, "min_tps": 10},
        }

        if use_case not in latency_requirements:
            return [{"error": f"Unknown use case: {use_case}"}]

        req = latency_requirements[use_case]
        results = []

        for model, data in self.LATENCY_DATA.items():
            fits = (
                data["ttft_ms"] <= req["max_ttft"] and
                data["tps"] >= req["min_tps"]
            )
            results.append({
                "model": model,
                "ttft_ms": data["ttft_ms"],
                "tps": data["tps"],
                "fits_requirement": fits,
                "verdict": "Suitable" if fits else "Not suitable",
            })

        return sorted(results, key=lambda x: x["ttft_ms"])

# Usage example
bench = LatencyBenchmark()
for use_case in ["Real-time chat", "Streaming UI", "Batch processing"]:
    print(f"\n=== {use_case} ===")
    results = bench.compare(use_case)
    for r in results:
        mark = "OK" if r["fits_requirement"] else "NG"
        print(f"  [{mark}] {r['model']:25s} TTFT:{r['ttft_ms']:>6}ms  TPS:{r['tps']:>4}")
```

---

## 4. Reasoning Model Comparison

### 4.1 Classification of Reasoning Models

```
┌──────────────────────────────────────────────────────────┐
│          Reasoning Models Classification                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Test-Time Compute (increased computation at inference)   │
│  ├── OpenAI o-series                                     │
│  │   ├── o1: High-precision reasoning (high price)        │
│  │   ├── o1-mini: Lightweight reasoning (STEM-focused)    │
│  │   ├── o3: Highest-performance reasoning                │
│  │   └── o3-mini: Best cost-efficiency reasoning          │
│  │                                                       │
│  ├── DeepSeek R-series                                   │
│  │   ├── R1: OSS reasoning model (MIT license)            │
│  │   ├── R1-Lite: Lightweight version                     │
│  │   └── R1 distilled models:                            │
│  │       ├── R1-Distill-Qwen-32B                         │
│  │       ├── R1-Distill-Llama-70B                        │
│  │       └── R1-Distill-Qwen-7B                          │
│  │                                                       │
│  ├── Claude Extended Thinking                            │
│  │   └── Claude 3.5 Sonnet (with Extended Thinking)       │
│  │                                                       │
│  └── Gemini Thinking                                     │
│      └── Gemini 2.0 Flash Thinking                       │
│                                                          │
│  Characteristics:                                         │
│  ├── Automatically executes Chain-of-Thought internally   │
│  ├── Cost and latency increase with reasoning steps       │
│  ├── Significant accuracy gains in math, code, logic      │
│  └── Overkill for simple tasks (wasted cost)             │
└──────────────────────────────────────────────────────────┘
```

### 4.2 When to Use Each Reasoning Model

```python
# Reasoning model selection guide
reasoning_model_guide = {
    "Math problems (university level and above)": {
        "Recommended": "o3-mini (high) or DeepSeek-R1",
        "Reason": "Top performance on AIME/MATH",
        "Cost note": "o1 is expensive; R1 has good cost efficiency",
    },
    "Complex coding (architecture design)": {
        "Recommended": "Claude 3.5 Sonnet (Extended Thinking)",
        "Reason": "Highest SWE-bench performance + code comprehension",
        "Cost note": "Higher token consumption than standard Sonnet",
    },
    "Scientific analysis (reading papers, etc.)": {
        "Recommended": "o1 or DeepSeek-R1",
        "Reason": "High scores on GPQA Diamond",
        "Cost note": "Long reasoning required; consider Batch API",
    },
    "Multi-step logical reasoning": {
        "Recommended": "o3-mini (high)",
        "Reason": "Best balance of reasoning power and cost",
        "Cost note": "Controllable via reasoning_effort parameter",
    },
    "Simple Q&A and summarization": {
        "Recommended": "No reasoning model needed → GPT-4o mini / Gemini Flash",
        "Reason": "Reasoning models are overkill",
        "Cost note": "Would waste 10-100x the cost",
    },
}

# Judgment function for whether to use a reasoning model
def should_use_reasoning_model(task_description: str, complexity: int) -> dict:
    """Determine necessity of reasoning model based on task complexity

    Args:
        task_description: Description of the task
        complexity: Complexity scale from 1-10
    """
    if complexity <= 3:
        return {
            "use_reasoning": False,
            "recommended": "GPT-4o mini / Gemini Flash",
            "reason": "Reasoning model not needed for simple tasks",
        }
    elif complexity <= 6:
        return {
            "use_reasoning": False,
            "recommended": "GPT-4o / Claude 3.5 Sonnet",
            "reason": "Standard model sufficient for this complexity",
        }
    elif complexity <= 8:
        return {
            "use_reasoning": True,
            "recommended": "o3-mini (medium) / DeepSeek-R1",
            "reason": "Complexity where reasoning is beneficial",
        }
    else:
        return {
            "use_reasoning": True,
            "recommended": "o1 / o3-mini (high)",
            "reason": "Highest-precision reasoning required",
        }
```

---

## 5. Use-Case-Driven Model Selection Framework

### 5.1 Selection Flowchart

```
┌─────────────────────────────────────────────────────────┐
│          LLM Selection Flowchart (Extended)               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  START: Define requirements                              │
│    │                                                    │
│    ├─ Can't send data to cloud?                          │
│    │   YES → OSS model self-hosted                       │
│    │          ├─ Reasoning-focused → DeepSeek-R1 distill │
│    │          ├─ Japanese-focused → Qwen 2.5             │
│    │          ├─ Code-focused → DeepSeek-Coder/Qwen-Coder│
│    │          └─ General-purpose → Llama 3.1             │
│    │                                                    │
│    NO ↓                                                 │
│    ├─ Tight budget constraints?                          │
│    │   YES → Low-cost models                             │
│    │          ├─ Gemini 2.0 Flash (cheapest + fastest)   │
│    │          ├─ Gemini 1.5 Flash                        │
│    │          ├─ GPT-4o mini                             │
│    │          └─ DeepSeek-V3                             │
│    │                                                    │
│    NO ↓                                                 │
│    ├─ Complex reasoning needed? (math/science/code design)│
│    │   YES → Reasoning models                            │
│    │          ├─ Highest accuracy → o1 / o3              │
│    │          ├─ Cost-efficient → o3-mini / DeepSeek-R1  │
│    │          └─ Code → Claude 3.5 (Extended Thinking)   │
│    │                                                    │
│    NO ↓                                                 │
│    ├─ Very long document processing? (>128K tokens)       │
│    │   YES → Gemini 1.5 Pro (2M tokens)                 │
│    │                                                    │
│    NO ↓                                                 │
│    ├─ Multimodal (image/audio/video)?                    │
│    │   YES ├─ Includes video → Gemini 1.5 Pro            │
│    │       ├─ Image + audio → GPT-4o                     │
│    │       └─ Image only → Claude 3.5 / GPT-4o          │
│    │                                                    │
│    NO ↓                                                 │
│    └─ Highest-accuracy text processing                   │
│         ├─ Code → Claude 3.5 Sonnet                     │
│         ├─ Japanese → GPT-4o / Qwen 2.5                 │
│         └─ General → GPT-4o / Claude 3.5                │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Per-Use-Case Recommendations (Detailed)

```python
# Per-use-case model recommendation dictionary (extended)
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ModelRecommendation:
    model: str
    reason: str
    monthly_cost_estimate: str  # Monthly cost estimate
    latency: str
    quality_score: float  # 0-1

@dataclass
class UseCaseRecommendation:
    use_case: str
    primary: ModelRecommendation
    secondary: ModelRecommendation
    budget_option: Optional[ModelRecommendation] = None
    key_requirements: list[str] = field(default_factory=list)
    anti_patterns: list[str] = field(default_factory=list)

recommendations = {
    "Customer Support Bot": UseCaseRecommendation(
        use_case="Customer Support Bot",
        primary=ModelRecommendation(
            "GPT-4o mini", "Best cost efficiency, high instruction-following",
            "$195/month (1M req)", "TTFT: 280ms", 0.85,
        ),
        secondary=ModelRecommendation(
            "Gemini 2.0 Flash", "Even cheaper and faster",
            "$130/month (1M req)", "TTFT: 180ms", 0.82,
        ),
        budget_option=ModelRecommendation(
            "Claude 3.5 Haiku", "When high-quality answers are needed",
            "$1,200/month (1M req)", "TTFT: 320ms", 0.88,
        ),
        key_requirements=["Low latency", "High request volume", "Stable response quality"],
        anti_patterns=["Using o1 (100x cost, 10x latency)"],
    ),
    "Code Review & Generation": UseCaseRecommendation(
        use_case="Code Review & Generation",
        primary=ModelRecommendation(
            "Claude 3.5 Sonnet", "Top SWE-bench performance, best code comprehension",
            "$4,500/month (1M req)", "TTFT: 500ms", 0.95,
        ),
        secondary=ModelRecommendation(
            "GPT-4o", "Broad language support, stable quality",
            "$3,250/month (1M req)", "TTFT: 450ms", 0.90,
        ),
        budget_option=ModelRecommendation(
            "DeepSeek-V3", "High code quality with good cost efficiency",
            "$355/month (1M req)", "TTFT: 600ms", 0.87,
        ),
        key_requirements=["Code comprehension", "Long context", "Accurate diff output"],
        anti_patterns=["Code review with Gemini Flash (insufficient accuracy)"],
    ),
    "Legal Document Analysis": UseCaseRecommendation(
        use_case="Legal Document Analysis",
        primary=ModelRecommendation(
            "Gemini 1.5 Pro", "2M token support, process documents in bulk",
            "$1,625/month (1M req)", "TTFT: 800ms", 0.88,
        ),
        secondary=ModelRecommendation(
            "Claude 3.5 Sonnet", "200K token + high-precision analysis",
            "$4,500/month (1M req)", "TTFT: 500ms", 0.92,
        ),
        key_requirements=["Long document processing", "Accurate citations", "Legal terminology understanding"],
        anti_patterns=["Trying to batch-process multiple documents with a 128K-limited model"],
    ),
    "Internal Confidential Data Processing": UseCaseRecommendation(
        use_case="Internal Confidential Data Processing",
        primary=ModelRecommendation(
            "Qwen 2.5 72B (self-hosted)", "Data never leaves your environment",
            "$2,500/month (GPU)", "Environment-dependent", 0.85,
        ),
        secondary=ModelRecommendation(
            "Llama 3.1 70B (self-hosted)", "Meta-built, broad language support",
            "$2,500/month (GPU)", "Environment-dependent", 0.83,
        ),
        budget_option=ModelRecommendation(
            "DeepSeek-R1 distilled Qwen-32B (self-hosted)", "Reasoning capable, lightweight",
            "$1,200/month (GPU)", "Environment-dependent", 0.80,
        ),
        key_requirements=["Data privacy", "On-premises operation", "Audit compliance"],
        anti_patterns=["Sending confidential data to cloud APIs"],
    ),
    "Math & Scientific Reasoning": UseCaseRecommendation(
        use_case="Math & Scientific Reasoning",
        primary=ModelRecommendation(
            "o3-mini (high)", "Top-class reasoning, good cost efficiency",
            "$1,430/month (1M req)", "TTFT: 3000ms", 0.95,
        ),
        secondary=ModelRecommendation(
            "DeepSeek-R1", "OSS reasoning model, MIT license",
            "$713/month (1M req)", "TTFT: 2000ms", 0.92,
        ),
        key_requirements=["Step-by-step reasoning", "Formula comprehension", "Logical consistency"],
        anti_patterns=["Using Flash/mini models for university-level math"],
    ),
    "Real-Time Translation": UseCaseRecommendation(
        use_case="Real-Time Translation",
        primary=ModelRecommendation(
            "Gemini 2.0 Flash", "Lowest latency, multilingual support",
            "$130/month (1M req)", "TTFT: 180ms", 0.83,
        ),
        secondary=ModelRecommendation(
            "GPT-4o mini", "Low latency, high-quality translation",
            "$195/month (1M req)", "TTFT: 280ms", 0.85,
        ),
        key_requirements=["Low latency", "Multilingual support", "Streaming"],
        anti_patterns=["Using reasoning models for translation (high latency)"],
    ),
    "Data Extraction & Structuring": UseCaseRecommendation(
        use_case="Data Extraction & Structuring",
        primary=ModelRecommendation(
            "GPT-4o", "Structured Output support, stable JSON output",
            "$3,250/month (1M req)", "TTFT: 450ms", 0.92,
        ),
        secondary=ModelRecommendation(
            "Claude 3.5 Sonnet", "High-precision extraction, long document support",
            "$4,500/month (1M req)", "TTFT: 500ms", 0.90,
        ),
        budget_option=ModelRecommendation(
            "GPT-4o mini", "Sufficient extraction accuracy at low cost",
            "$195/month (1M req)", "TTFT: 280ms", 0.82,
        ),
        key_requirements=["JSON output stability", "Schema compliance", "Error handling"],
        anti_patterns=["Expecting JSON generation without structured output mode"],
    ),
    "Creative Writing": UseCaseRecommendation(
        use_case="Creative Writing",
        primary=ModelRecommendation(
            "Claude 3.5 Sonnet", "Natural writing style, high creativity",
            "$4,500/month (1M req)", "TTFT: 500ms", 0.93,
        ),
        secondary=ModelRecommendation(
            "GPT-4o", "Diverse style support",
            "$3,250/month (1M req)", "TTFT: 450ms", 0.90,
        ),
        key_requirements=["Style diversity", "Consistent narrative structure", "Emotional expression"],
        anti_patterns=["Using reasoning models for creative work (becomes overly logical)"],
    ),
}

# Display recommendation results
def print_recommendation(use_case: str):
    if use_case not in recommendations:
        print(f"Unknown use case: {use_case}")
        return
    rec = recommendations[use_case]
    print(f"\n{'='*60}")
    print(f"Use case: {rec.use_case}")
    print(f"{'='*60}")
    print(f"\n[Primary] {rec.primary.model}")
    print(f"  Reason: {rec.primary.reason}")
    print(f"  Cost: {rec.primary.monthly_cost_estimate}")
    print(f"  Latency: {rec.primary.latency}")
    print(f"\n[Secondary] {rec.secondary.model}")
    print(f"  Reason: {rec.secondary.reason}")
    if rec.budget_option:
        print(f"\n[Budget] {rec.budget_option.model}")
        print(f"  Reason: {rec.budget_option.reason}")
    print(f"\nKey requirements: {', '.join(rec.key_requirements)}")
    print(f"Anti-patterns: {', '.join(rec.anti_patterns)}")
```

---

## 6. Practical Model Selection Code

### 6.1 A/B Test Comparison Tool

```python
import asyncio
import time
import json
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from dataclasses import dataclass

@dataclass
class ComparisonResult:
    model: str
    text: str
    input_tokens: int
    output_tokens: int
    latency: float
    ttft: float
    cost: float

async def compare_models(
    prompt: str,
    models: list[str] = None,
    max_tokens: int = 1024,
) -> dict[str, ComparisonResult]:
    """Concurrently compare outputs across multiple models"""

    if models is None:
        models = ["gpt-4o", "claude-3.5-sonnet"]

    async def call_openai(model: str):
        client = AsyncOpenAI()
        start = time.time()
        ttft = None
        full_text = ""

        stream = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True},
        )

        usage = None
        async for chunk in stream:
            if ttft is None and chunk.choices and chunk.choices[0].delta.content:
                ttft = time.time() - start
            if chunk.choices and chunk.choices[0].delta.content:
                full_text += chunk.choices[0].delta.content
            if chunk.usage:
                usage = chunk.usage

        latency = time.time() - start
        pricing = PRICING_TABLE.get(model, PRICING_TABLE["gpt-4o"])
        cost = (
            (usage.prompt_tokens / 1_000_000) * pricing.input_price +
            (usage.completion_tokens / 1_000_000) * pricing.output_price
        ) if usage else 0

        return ComparisonResult(
            model=model,
            text=full_text,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            latency=latency,
            ttft=ttft or latency,
            cost=cost,
        )

    async def call_anthropic(model: str):
        client = AsyncAnthropic()
        start = time.time()
        ttft = None
        full_text = ""

        model_id = "claude-3-5-sonnet-20241022" if "sonnet" in model else "claude-3-5-haiku-20241022"

        async with client.messages.stream(
            model=model_id,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                if ttft is None:
                    ttft = time.time() - start
                full_text += text

        message = await stream.get_final_message()
        latency = time.time() - start
        pricing = PRICING_TABLE.get(model, PRICING_TABLE["claude-3.5-sonnet"])
        cost = (
            (message.usage.input_tokens / 1_000_000) * pricing.input_price +
            (message.usage.output_tokens / 1_000_000) * pricing.output_price
        )

        return ComparisonResult(
            model=model,
            text=full_text,
            input_tokens=message.usage.input_tokens,
            output_tokens=message.usage.output_tokens,
            latency=latency,
            ttft=ttft or latency,
            cost=cost,
        )

    tasks = []
    for model in models:
        if "claude" in model:
            tasks.append(call_anthropic(model))
        else:
            tasks.append(call_openai(model))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    output = {}
    for model, result in zip(models, results):
        if isinstance(result, Exception):
            print(f"Error with {model}: {result}")
        else:
            output[model] = result

    return output


# Display A/B test results
async def run_ab_test(prompt: str, models: list[str], num_trials: int = 5):
    """Run multiple A/B test trials and collect statistics"""
    all_results = {model: [] for model in models}

    for trial in range(num_trials):
        print(f"\nTrial {trial + 1}/{num_trials}...")
        results = await compare_models(prompt, models)
        for model, result in results.items():
            all_results[model].append(result)

    # Statistics output
    print(f"\n{'='*70}")
    print(f"A/B Test Results ({num_trials} trials)")
    print(f"{'='*70}")
    print(f"{'Model':25s} {'Avg Latency':>12s} {'Avg TTFT':>10s} {'Avg Cost':>10s}")
    print(f"{'-'*70}")

    for model in models:
        results = all_results[model]
        if not results:
            continue
        avg_latency = sum(r.latency for r in results) / len(results)
        avg_ttft = sum(r.ttft for r in results) / len(results)
        avg_cost = sum(r.cost for r in results) / len(results)
        print(f"{model:25s} {avg_latency:>10.2f}s {avg_ttft:>8.2f}s ${avg_cost:>8.6f}")

# Usage example
# asyncio.run(run_ab_test(
#     "Explain Python generators in 500 characters or less",
#     ["gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet"],
#     num_trials=5,
# ))
```

### 6.2 Multi-Model Routing

```python
import re
from enum import Enum

class TaskDifficulty(Enum):
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    REASONING = "reasoning"

class ModelRouter:
    """Routes to the optimal model based on task difficulty"""

    def __init__(self, config: dict = None):
        self.config = config or {
            TaskDifficulty.SIMPLE: "gpt-4o-mini",
            TaskDifficulty.MODERATE: "gpt-4o",
            TaskDifficulty.COMPLEX: "claude-3.5-sonnet",
            TaskDifficulty.REASONING: "o3-mini",
        }
        self.routing_history = []

    def classify_task(self, prompt: str) -> TaskDifficulty:
        """Classify task difficulty from the prompt"""

        # Simple keyword-based classification (use an LLM classifier in production)
        reasoning_keywords = [
            "prove", "math", "theorem", "why", "logically",
            "step by step", "analyze", "compare and contrast",
            "optimize", "algorithm",
        ]
        complex_keywords = [
            "code review", "refactoring", "architecture",
            "design", "implement", "debug", "test cases",
            "long text", "in detail", "comprehensively",
        ]
        moderate_keywords = [
            "summarize", "translate", "explain", "list", "classify",
            "rewrite", "fix",
        ]

        prompt_lower = prompt.lower()

        # Determine reasoning tasks
        reasoning_score = sum(1 for kw in reasoning_keywords if kw in prompt_lower)
        if reasoning_score >= 2:
            return TaskDifficulty.REASONING

        # Determine complex tasks
        complex_score = sum(1 for kw in complex_keywords if kw in prompt_lower)
        if complex_score >= 2 or len(prompt) > 2000:
            return TaskDifficulty.COMPLEX

        # Determine moderate tasks
        moderate_score = sum(1 for kw in moderate_keywords if kw in prompt_lower)
        if moderate_score >= 1 or len(prompt) > 500:
            return TaskDifficulty.MODERATE

        return TaskDifficulty.SIMPLE

    def route(self, prompt: str) -> dict:
        """Route the prompt to the optimal model"""
        difficulty = self.classify_task(prompt)
        model = self.config[difficulty]

        routing_info = {
            "prompt_length": len(prompt),
            "difficulty": difficulty.value,
            "selected_model": model,
            "estimated_cost_ratio": {
                TaskDifficulty.SIMPLE: 1.0,
                TaskDifficulty.MODERATE: 16.7,
                TaskDifficulty.COMPLEX: 20.0,
                TaskDifficulty.REASONING: 7.3,
            }[difficulty],
        }

        self.routing_history.append(routing_info)
        return routing_info

    def get_routing_stats(self) -> dict:
        """Retrieve routing statistics"""
        if not self.routing_history:
            return {"total": 0}

        total = len(self.routing_history)
        distribution = {}
        for entry in self.routing_history:
            d = entry["difficulty"]
            distribution[d] = distribution.get(d, 0) + 1

        # Estimate cost savings rate
        # Compared to using complex model for all requests
        baseline_cost = total * 20.0
        actual_cost = sum(entry["estimated_cost_ratio"] for entry in self.routing_history)
        savings_rate = 1 - (actual_cost / baseline_cost)

        return {
            "total_requests": total,
            "distribution": distribution,
            "estimated_cost_savings": f"{savings_rate:.1%}",
        }


# Usage example
router = ModelRouter()

test_prompts = [
    "Hello",  # SIMPLE
    "Please translate this text to English: ...",  # MODERATE
    "Refactor this Python code and write test cases",  # COMPLEX
    "Prove this theorem step by step and explain logically why it holds",  # REASONING
    "What's the weather?",  # SIMPLE
    "Please summarize this long text",  # MODERATE
]

for prompt in test_prompts:
    result = router.route(prompt)
    print(f"[{result['difficulty']:10s}] → {result['selected_model']:25s} | {prompt[:40]}...")

stats = router.get_routing_stats()
print(f"\n=== Routing Statistics ===")
print(f"Total requests: {stats['total_requests']}")
print(f"Distribution: {stats['distribution']}")
print(f"Estimated cost savings: {stats['estimated_cost_savings']}")
```

### 6.3 Automated Quality Evaluation with LLM-as-a-Judge

```python
from anthropic import Anthropic

class LLMJudge:
    """Automated answer quality evaluation using LLM-as-a-Judge"""

    JUDGE_PROMPT = """You are a fair AI answer quality evaluator.
Please evaluate two answers to the following question and score each on the criteria below.

## Question
{question}

## Answer A ({model_a})
{answer_a}

## Answer B ({model_b})
{answer_b}

## Evaluation Criteria (each out of 10 points)
1. Accuracy: Factual correctness, absence of misinformation
2. Completeness: Comprehensive coverage of the question
3. Clarity: Readability and logical organization
4. Usefulness: Practical, concrete information
5. Conciseness: Necessary and sufficient length, not verbose

## Output Format (JSON)
{{
  "model_a_scores": {{"accuracy": X, "completeness": X, "clarity": X, "usefulness": X, "conciseness": X}},
  "model_b_scores": {{"accuracy": X, "completeness": X, "clarity": X, "usefulness": X, "conciseness": X}},
  "model_a_total": X,
  "model_b_total": X,
  "winner": "A" or "B" or "tie",
  "reasoning": "Judgment rationale in 1-2 sentences"
}}"""

    def __init__(self, judge_model: str = "claude-3-5-sonnet-20241022"):
        self.client = Anthropic()
        self.judge_model = judge_model
        self.results = []

    def evaluate(
        self,
        question: str,
        answer_a: str,
        answer_b: str,
        model_a: str,
        model_b: str,
    ) -> dict:
        """Comparatively evaluate two answers"""
        prompt = self.JUDGE_PROMPT.format(
            question=question,
            model_a=model_a,
            answer_a=answer_a,
            model_b=model_b,
            answer_b=answer_b,
        )

        response = self.client.messages.create(
            model=self.judge_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        result = json.loads(response.content[0].text)
        self.results.append(result)
        return result

    def evaluate_batch(
        self,
        test_cases: list[dict],
    ) -> dict:
        """Run batch evaluation"""
        wins = {"A": 0, "B": 0, "tie": 0}
        total_scores = {"A": 0, "B": 0}

        for case in test_cases:
            result = self.evaluate(
                question=case["question"],
                answer_a=case["answer_a"],
                answer_b=case["answer_b"],
                model_a=case["model_a"],
                model_b=case["model_b"],
            )
            wins[result["winner"]] += 1
            total_scores["A"] += result["model_a_total"]
            total_scores["B"] += result["model_b_total"]

        n = len(test_cases)
        return {
            "total_cases": n,
            "wins": wins,
            "win_rate_a": f"{wins['A']/n:.1%}",
            "win_rate_b": f"{wins['B']/n:.1%}",
            "avg_score_a": total_scores["A"] / n,
            "avg_score_b": total_scores["B"] / n,
        }

    def position_debiased_evaluate(
        self,
        question: str,
        answer_a: str,
        answer_b: str,
        model_a: str,
        model_b: str,
    ) -> dict:
        """Position-bias-free evaluation (evaluate twice with A and B swapped)"""
        # Evaluate in normal order
        result1 = self.evaluate(question, answer_a, answer_b, model_a, model_b)

        # Evaluate with order swapped
        result2 = self.evaluate(question, answer_b, answer_a, model_b, model_a)

        # Integrate results (high reliability if they agree)
        winner1 = result1["winner"]
        # Since order is reversed in result2, map winner accordingly
        winner2_mapped = {"A": "B", "B": "A", "tie": "tie"}[result2["winner"]]

        if winner1 == winner2_mapped:
            consensus = winner1
            confidence = "High"
        else:
            consensus = "tie"
            confidence = "Low (position bias may have affected result)"

        return {
            "consensus_winner": consensus,
            "confidence": confidence,
            "round1": result1,
            "round2": result2,
        }
```

---

## 7. OSS Model Comparison and Selection

### 7.1 Major OSS Model Overview

```
┌──────────────────────────────────────────────────────────┐
│          Major OSS LLM Model Overview                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Meta Llama 3.1 Series                                    │
│  ├── 405B: Highest-performance OSS, needs 8xA100/H100     │
│  ├── 70B: Balanced, runs on 2xA100                        │
│  └── 8B: Edge-focused, runs on 1xRTX4090                  │
│  License: Llama 3.1 Community License                    │
│                                                          │
│  Alibaba Qwen 2.5 Series                                  │
│  ├── 72B: Strong in CJK languages, good Japanese          │
│  ├── 32B: Mid-size model, good cost efficiency            │
│  ├── 14B / 7B / 3B / 1.5B / 0.5B                         │
│  └── Variants: Qwen-Coder, Qwen-VL, Qwen-Audio           │
│  License: Apache 2.0 (some Qwen License)                  │
│                                                          │
│  DeepSeek Series                                          │
│  ├── V3: MoE 671B (37B active), high efficiency           │
│  ├── R1: Reasoning-specialized, MIT License               │
│  └── Coder V2: Code-specialized                           │
│  License: MIT                                             │
│                                                          │
│  Mistral Series                                           │
│  ├── Large 2 (123B): EU regulation compliant              │
│  ├── Mixtral 8x22B: MoE, high efficiency                  │
│  └── Mistral 7B / Mistral NeMo                           │
│  License: Apache 2.0                                      │
│                                                          │
│  Google Gemma Series                                      │
│  ├── Gemma 2 27B: Lightweight, high performance           │
│  └── Gemma 2 9B / 2B                                      │
│  License: Gemma Terms of Use                              │
│                                                          │
│  Microsoft Phi Series                                     │
│  ├── Phi-3.5-MoE-instruct (42B, 6.6B active)              │
│  ├── Phi-3.5-mini (3.8B): Ultra-lightweight               │
│  └── Phi-3.5-vision: Multimodal support                   │
│  License: MIT                                             │
└──────────────────────────────────────────────────────────┘
```

### 7.2 OSS Model Selection Criteria

```python
# OSS model selection matrix
oss_selection_matrix = {
    "Japanese text generation": {
        "Recommended": ["Qwen-2.5-72B", "Llama-3.1-70B"],
        "Reason": "Qwen has abundant CJK training data",
        "GPU requirements": "2x A100-80GB (FP16) or 1x A100 (INT8)",
    },
    "Code generation & completion": {
        "Recommended": ["DeepSeek-Coder-V2", "Qwen-2.5-Coder-32B"],
        "Reason": "Code-specialized training, multilingual support",
        "GPU requirements": "1-2x A100-80GB",
    },
    "Reasoning tasks": {
        "Recommended": ["DeepSeek-R1", "R1-Distill-Qwen-32B"],
        "Reason": "Built-in reasoning CoT, MIT License",
        "GPU requirements": "R1: 8xH100 / distilled: 1x A100",
    },
    "Edge deployment": {
        "Recommended": ["Phi-3.5-mini", "Gemma-2-2B", "Qwen-2.5-3B"],
        "Reason": "Practical quality in 3B or less",
        "GPU requirements": "RTX3060 or higher / CPU inference possible",
    },
    "Multimodal (image)": {
        "Recommended": ["Qwen-VL-72B", "Llava-1.6-34B", "Phi-3.5-vision"],
        "Reason": "Integrated image + text understanding",
        "GPU requirements": "Varies by model size",
    },
    "RAG / Embeddings": {
        "Recommended": ["BGE-M3", "E5-Mistral-7B", "GTE-Qwen2"],
        "Reason": "Multilingual embeddings, high recall",
        "GPU requirements": "1x RTX4090 or higher",
    },
}
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Selecting solely based on benchmark scores

```
# BAD: Unconditionally adopting the model with the highest MMLU score
"This model has an MMLU of 88 so let's go with it"
→ The actual task (Japanese summarization) has low correlation with MMLU
→ Scores may be inflated due to data contamination

# GOOD: Evaluate on your actual tasks
1. Create an evaluation dataset of your own tasks (100+ questions)
2. Run inference with 3-5 candidate models
3. Compare quality using human evaluation or LLM-as-a-Judge
4. Make a holistic decision factoring in cost and latency
5. Verify production performance with A/B testing
```

### Anti-Pattern 2: Vendor lock-in to a single model

```python
# BAD: Code tightly coupled to OpenAI-specific API features
response = client.chat.completions.create(
    model="gpt-4o",
    response_format={"type": "json_schema", "json_schema": {...}},
    # Heavily dependent on OpenAI-specific features
)

# GOOD: Add an abstraction layer to enable model switching
from litellm import completion  # Multi-provider library

response = completion(
    model="gpt-4o",  # Easy to change to "claude-3.5-sonnet" etc.
    messages=[{"role": "user", "content": prompt}],
)

# Even better: your own abstraction layer
class LLMClient:
    """Provider-agnostic LLM client"""

    def __init__(self, provider: str, model: str):
        self.provider = provider
        self.model = model
        self._init_client()

    def _init_client(self):
        if self.provider == "openai":
            from openai import OpenAI
            self.client = OpenAI()
        elif self.provider == "anthropic":
            from anthropic import Anthropic
            self.client = Anthropic()
        elif self.provider == "google":
            import google.generativeai as genai
            self.client = genai

    def generate(self, prompt: str, **kwargs) -> str:
        if self.provider == "openai":
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                **kwargs,
            )
            return resp.choices[0].message.content
        elif self.provider == "anthropic":
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=kwargs.get("max_tokens", 1024),
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text
```

### Anti-Pattern 3: Ignoring latency in model selection

```
# BAD: High-performance but slow model for real-time chat
User experience: "..." (10 seconds of silence) → Higher abandonment rate

# GOOD: Set latency requirements based on the use case
- Real-time chat → TTFT < 500ms → Flash/mini models
- Batch processing → Latency irrelevant → Highest-accuracy models
- Streaming display → TTFT < 1s → Mid-tier models acceptable
- Reasoning tasks → Latency tolerance → o1/R1 series (but consider UX)
```

### Anti-Pattern 4: Using the same model for all tasks

```python
# BAD: Using GPT-4o for all tasks
# → Paying premium model prices even for simple tasks, 10x+ cost

# GOOD: Select model based on task complexity
class SmartLLMService:
    """Service that automatically selects model based on task complexity"""

    TIER_CONFIG = {
        "tier1_simple": {
            "model": "gpt-4o-mini",
            "max_tokens": 512,
            "examples": ["Greetings", "FAQ answers", "Simple translation"],
        },
        "tier2_moderate": {
            "model": "gpt-4o",
            "max_tokens": 2048,
            "examples": ["Summarization", "Document classification", "Data extraction"],
        },
        "tier3_complex": {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 4096,
            "examples": ["Code review", "Long-form analysis", "Report generation"],
        },
        "tier4_reasoning": {
            "model": "o3-mini",
            "max_tokens": 8192,
            "examples": ["Math proofs", "Complex analysis", "Architecture design"],
        },
    }

    # Cost comparison: all tier3 vs smart routing
    # Assuming 1M req/month:
    #   All tier3: $4,500/month
    #   Smart routing (60% tier1, 25% tier2, 12% tier3, 3% tier4):
    #     0.6*$195 + 0.25*$3,250 + 0.12*$4,500 + 0.03*$1,430
    #     = $117 + $812 + $540 + $43 = $1,512/month
    #   → 66% cost reduction
```

### Anti-Pattern 5: Overusing reasoning models

```
# BAD: Using o1 for all tasks
Cost: $19,500/month (1M req)
Latency: TTFT 5-30 seconds
→ Overkill for 99% of tasks

# GOOD: Use reasoning models only when reasoning is truly needed
Decision criteria:
1. Mathematical proof or complex logical reasoning required → o3-mini
2. Stepwise analysis directly impacts quality → DeepSeek-R1
3. Code design requires considering multiple options → Claude ET
4. Otherwise → Standard models are sufficient
```

---

## 9. Building a Model Evaluation Pipeline

### 9.1 Evaluation Pipeline Overview

```
┌──────────────────────────────────────────────────────────┐
│        Model Evaluation Pipeline                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Create evaluation dataset                             │
│  ├── Extract 100-500 representative cases from your tasks │
│  ├── Categorize (difficulty, domain, task type)           │
│  ├── Create ground-truth labels (human or expert)         │
│  └── Split into test/validation sets                      │
│       │                                                   │
│  2. Run inference with candidate models                   │
│  ├── All candidate models × all test cases                │
│  ├── Use the same prompt template                         │
│  ├── Temperature=0 for reproducibility                    │
│  └── Record latency and token counts                      │
│       │                                                   │
│  3. Quality evaluation                                    │
│  ├── Automatic metrics: BLEU, ROUGE, Exact Match          │
│  ├── LLM-as-a-Judge (position-bias-free version)          │
│  ├── Human evaluation (sampling of important cases)       │
│  └── Domain expert review                                 │
│       │                                                   │
│  4. Composite scoring                                     │
│  ├── Quality score (40%)                                  │
│  ├── Cost (25%)                                           │
│  ├── Latency (20%)                                        │
│  └── Operational ease (15%)                               │
│       │                                                   │
│  5. Decision making                                       │
│  ├── Create scorecard                                     │
│  ├── Stakeholder review                                   │
│  └── Phased rollout plan                                  │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Evaluation Pipeline Implementation

```python
import json
from dataclasses import dataclass, field
from typing import Callable, Optional

@dataclass
class EvalCase:
    """Evaluation case"""
    id: str
    prompt: str
    expected: str
    category: str
    difficulty: str  # easy, medium, hard
    metadata: dict = field(default_factory=dict)

@dataclass
class EvalResult:
    """Evaluation result"""
    case_id: str
    model: str
    output: str
    latency: float
    input_tokens: int
    output_tokens: int
    cost: float
    scores: dict = field(default_factory=dict)

class ModelEvaluationPipeline:
    """Model evaluation pipeline"""

    def __init__(self, eval_cases: list[EvalCase]):
        self.eval_cases = eval_cases
        self.results: list[EvalResult] = []
        self.scorers: list[Callable] = []

    def add_scorer(self, scorer: Callable):
        """Add a scorer"""
        self.scorers.append(scorer)

    async def run_evaluation(self, models: list[str]) -> dict:
        """Run evaluation on all cases with all models"""
        for model in models:
            for case in self.eval_cases:
                result = await self._evaluate_single(model, case)
                # Scoring
                for scorer in self.scorers:
                    score = scorer(case, result)
                    result.scores.update(score)
                self.results.append(result)

        return self._compile_report()

    async def _evaluate_single(self, model: str, case: EvalCase) -> EvalResult:
        """Evaluate a single case"""
        start = time.time()

        # Model call (simplified)
        output = await self._call_model(model, case.prompt)

        latency = time.time() - start

        return EvalResult(
            case_id=case.id,
            model=model,
            output=output["text"],
            latency=latency,
            input_tokens=output["input_tokens"],
            output_tokens=output["output_tokens"],
            cost=output["cost"],
        )

    async def _call_model(self, model: str, prompt: str) -> dict:
        """Call the model API (abstracted)"""
        # Implementation omitted - use LiteLLM etc.
        pass

    def _compile_report(self) -> dict:
        """Compile evaluation report"""
        models = set(r.model for r in self.results)
        report = {}

        for model in models:
            model_results = [r for r in self.results if r.model == model]

            # Quality scores
            quality_scores = [
                sum(r.scores.values()) / len(r.scores)
                for r in model_results if r.scores
            ]

            # Cost and latency
            total_cost = sum(r.cost for r in model_results)
            avg_latency = sum(r.latency for r in model_results) / len(model_results)

            # Per-category scores
            categories = set(
                case.category for case in self.eval_cases
            )
            category_scores = {}
            for cat in categories:
                cat_results = [
                    r for r in model_results
                    if any(c.id == r.case_id and c.category == cat for c in self.eval_cases)
                ]
                if cat_results and cat_results[0].scores:
                    category_scores[cat] = sum(
                        sum(r.scores.values()) / len(r.scores)
                        for r in cat_results
                    ) / len(cat_results)

            report[model] = {
                "avg_quality": sum(quality_scores) / len(quality_scores) if quality_scores else 0,
                "total_cost": total_cost,
                "avg_latency": avg_latency,
                "category_scores": category_scores,
                "total_cases": len(model_results),
            }

        return report


# Scorer examples
def exact_match_scorer(case: EvalCase, result: EvalResult) -> dict:
    """Exact match scorer"""
    return {"exact_match": 1.0 if result.output.strip() == case.expected.strip() else 0.0}

def contains_scorer(case: EvalCase, result: EvalResult) -> dict:
    """Partial match scorer"""
    return {"contains": 1.0 if case.expected.lower() in result.output.lower() else 0.0}

def length_penalty_scorer(case: EvalCase, result: EvalResult) -> dict:
    """Length penalty scorer"""
    expected_len = len(case.expected)
    actual_len = len(result.output)
    ratio = actual_len / expected_len if expected_len > 0 else 0
    # Ideal range is 0.5-2.0
    if 0.5 <= ratio <= 2.0:
        score = 1.0
    elif ratio < 0.5:
        score = ratio * 2  # Penalty for too short
    else:
        score = max(0, 1.0 - (ratio - 2.0) * 0.2)  # Penalty for too long
    return {"length_score": score}
```

---

## 10. FAQ

### Q1: Should I switch to a new model every time one is released?

Frequent switching has high costs (validation effort, code changes, prompt re-tuning).
A practical approach is to run a comparative evaluation of major models every 3-6 months and only migrate when a significant improvement is confirmed.
Introducing an abstraction layer (e.g., LiteLLM) reduces the cost of switching.

**Concrete decision criteria:**
- Quality on your tasks improves by 10% or more
- Cost reduced by 30% or more
- Latency improved by 50% or more
- New features (multimodal, etc.) become a required need
- Deprecation announcement for the current model

### Q2: What are the benefits of combining multiple models?

Using a router pattern to distribute tasks based on difficulty can reduce costs by 60-80%.
Example: Simple questions → Flash/mini, complex questions → Pro/Sonnet, code generation → specialized model.
Using OpenRouter or LiteLLM makes routing easy to implement.

**Implementation patterns:**
1. **Static routing**: Assign models to fixed task types
2. **Dynamic routing**: Analyze input complexity and select dynamically
3. **Cascade**: Try a smaller model first → fall back to a larger model if quality is insufficient
4. **Ensemble**: Integrate answers from multiple models (high cost but high quality)

### Q3: How large is the gap between benchmark and production performance?

Benchmark contamination (benchmark questions mixed into training data) is a known problem, and for MMLU in particular, divergence from actual capabilities has been reported.
Human evaluations like LMSYS Chatbot Arena are closest to reality, but your own evaluation on your own tasks is the most reliable.
"Use benchmarks for screening, and use actual task evaluation for final decisions" is the recommended approach.

### Q4: What are the criteria for choosing between reasoning models (o1/R1) and standard models?

Reasoning models improve accuracy by increasing "thinking time," making them effective in the following cases:
- Mathematical proofs or complex logical reasoning
- Problems requiring multi-step analysis
- When accuracy is top priority and latency is tolerable

On the other hand, standard models are sufficient for:
- Template tasks such as FAQ answering, translation, and summarization
- Real-time chat where latency is critical
- Large-scale batch processing (cost-prohibitive for reasoning models)

### Q5: What is the optimal model for Japanese tasks?

Japanese performance depends heavily on the amount and quality of training data. Japanese performance ranking as of early 2025 (approximate):

1. **GPT-4o** — Abundant Japanese training data, natural expression
2. **Claude 3.5 Sonnet** — High Japanese comprehension, strong with long text
3. **Gemini 1.5 Pro** — Improved Japanese performance, overwhelming for long documents
4. **Qwen 2.5 72B** — CJK-specialized, best Japanese performance among OSS
5. **DeepSeek-V3** — Chinese-based but also good at Japanese

Testing with Japanese-specific evaluation datasets (JCommonsenseQA, JNLI, JSQuAD, etc.) is recommended.

### Q6: Should I fine-tune, or is prompt engineering sufficient?

```
Decision flowchart:

Achieved target quality with prompt engineering?
├── YES → Fine-tuning not needed
└── NO → Improved with Few-shot / RAG?
    ├── YES → Fine-tuning not needed
    └── NO → Can you prepare 1,000+ training examples?
        ├── YES → Consider fine-tuning
        │   ├── API FT (GPT-4o mini, Gemini) → Convenient
        │   └── OSS FT (Llama, Qwen) → More flexibility
        └── NO → Start collecting data, or consider a different model
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in actual practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Evaluation Axis | Top Recommended Model | Notes |
|--------|------------|------|
| Overall performance | GPT-4o / Claude 3.5 Sonnet | Close race, task-dependent |
| Cost efficiency | Gemini 2.0 Flash / GPT-4o mini | 10-50x cheaper |
| Long document processing | Gemini 1.5 Pro (2M) | Far ahead of others |
| Code generation | Claude 3.5 Sonnet | Highest SWE-bench |
| Math & reasoning | o3-mini / DeepSeek-R1 | CoT-specialized |
| Japanese | Qwen 2.5 / GPT-4o | Strong in CJK |
| Privacy | OSS self-hosted | Qwen/Llama |
| Multimodal | GPT-4o / Gemini 1.5 | Video: Gemini only |
| Ultra-low cost | Gemini 2.0 Flash | $0.10/$0.40 per 1M |
| Reasoning tasks | o3-mini (high) | reasoning_effort adjustable |

---

## Recommended Next Reads

- [../02-applications/00-prompt-engineering.md](../02-applications/00-prompt-engineering.md) — Prompt techniques to maximize the performance of your chosen model
- [../03-infrastructure/00-api-integration.md](../03-infrastructure/00-api-integration.md) — Practical API integration
- [../03-infrastructure/03-evaluation.md](../03-infrastructure/03-evaluation.md) — Evaluation methods on your own tasks

---

## References

1. LMSYS, "Chatbot Arena Leaderboard," https://chat.lmsys.org/
2. Hugging Face, "Open LLM Leaderboard," https://huggingface.co/spaces/open-llm-leaderboard
3. Artificial Analysis, "LLM Performance Leaderboard," https://artificialanalysis.ai/
4. Chiang et al., "Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference," arXiv:2403.04132, 2024
5. DeepSeek, "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning," 2025
6. OpenAI, "Learning to Reason with LLMs," https://openai.com/index/learning-to-reason-with-llms/
7. Jimenez et al., "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?" arXiv:2310.06770, 2023
8. Wang et al., "MMLU-Pro: A More Robust and Challenging Multi-Task Language Understanding Benchmark," 2024
