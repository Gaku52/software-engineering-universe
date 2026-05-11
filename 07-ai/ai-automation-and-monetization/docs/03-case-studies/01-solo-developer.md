# Solo Developer — ¥1M/Month with a One-Person AI SaaS

> A concrete roadmap, tech stack, marketing strategy, and operational know-how for a solo developer to reach ¥1,000,000/month in revenue with an AI SaaS — illustrated with real-world examples.

---

## What You Will Learn

1. **Design principles for a one-person AI SaaS** — Designs optimized for solo development that generate maximum value with minimal resources
2. **Roadmap to ¥1M/month** — Actions to take at each phase of the 0 → ¥10K → ¥200K → ¥1M journey
3. **A sustainable operating model** — Automation, support, and growth systems that run with one person
4. **Practical code implementations** — Concrete implementation patterns for auth, billing, AI features, and monitoring
5. **Risk management and legal basics** — Legal and tax considerations you must know as a sole proprietor


## Prerequisites

The following background knowledge will help you get more out of this guide:

- Basic programming knowledge
- Understanding of relevant foundational concepts
- Familiarity with the content in [Successful AI Products — Jasper, Copy.ai, Notion AI](./00-successful-ai-products.md)

---

## 1. Overview of a Solo AI SaaS

### 1.1 The Successful Solo-Developer Model

```
┌──────────────────────────────────────────────────────────┐
│           Solo Developer AI SaaS Success Model           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ¥1M/month = 200 users × ¥5,000/month                   │
│                                                          │
│  ┌──────────────┐                                        │
│  │ Niche focus  │ ← Small market large companies ignore  │
│  │ Clear pain   │ ← A problem they "can't live without"  │
│  │ AI leverage  │ ← 10x productivity gain through AI     │
│  │ Self-serve   │ ← No sales; self-signup & self-resolve │
│  │ Automated    │ ← Maintained in under 5 hours/week     │
│  └──────────────┘                                        │
│                                                          │
│  Time allocation:                                        │
│  ┌──────────────────────────────────────────┐            │
│  │ Dev 40% | Marketing 30% | Support 15% | Admin 15% │   │
│  └──────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Analysis of Success Stories

| Case | Product | Niche | Monthly Revenue | Dev Time |
|------|---------|-------|----------------|----------|
| A | AI Resume Review | Job seekers | ¥1.2M | 3 weeks |
| B | AI Email Reply | Freelancers | ¥800K | 1 month |
| C | AI Contract Review | SMEs | ¥2M | 2 months |
| D | AI Background Removal | E-commerce sellers | ¥1.5M | 2 weeks |
| E | AI Recipe Generator | Home cooks | ¥600K | 1 month |
| F | AI Code Translator | Developers | ¥900K | 6 weeks |

### 1.3 Deep-Dive into Success Stories

#### Case A: AI Resume Review Service

```
Background:
  Developer: Former recruiting-industry engineer (5 years experience)
  Insight: Resume review by a human recruiter = 30 min/resume; AI = 10 seconds

Development timeline:
  Week 1: Prototype with Claude API + Next.js
  Week 2: Stripe billing + user auth
  Week 3: Landing page + Product Hunt prep

Business model:
  Free plan:    3 reviews/month (basic feedback)
  Pro plan:     ¥4,980/month (unlimited reviews + industry-specific optimization + ATS tips)
  Premium plan: ¥9,800/month (English reviews + LinkedIn optimization)

Growth trajectory:
  Month 1: 200 free users, 5 paid (MRR ¥25,000)
  Month 2: 800 free, 30 paid (MRR ¥150,000)
  Month 3: 2,000 free, 80 paid (MRR ¥400,000)
  Month 6: 5,000 free, 250 paid (MRR ¥1,200,000)

Key success factors:
  1. The job market has steady demand year-round
  2. Resumes trigger "anxiety" as the buying motive → high conversion rate
  3. SEO blog ("how to write a resume for job hunting") drives organic traffic
  4. Daily posts on Twitter/X with #jobhunting hashtag
```

#### Case C: AI Contract Review Service

```python
# Core logic of the AI contract review service (simplified)
contract_review_system = {
    "input": "Contract PDF / text",
    "processing_pipeline": [
        {
            "step": "Document structuring",
            "action": "OCR + section splitting",
            "tool": "pdf-parse + GPT-4o (image recognition)"
        },
        {
            "step": "Risk analysis",
            "action": "Risk scoring for each clause",
            "tool": "Claude (legal prompt)",
            "prompt_template": """
You are a legal AI assistant well-versed in Japanese contract law.
Analyze the following contract clause and evaluate the risk.

[Clause]
{clause_text}

[Evaluation criteria]
1. Are there any one-sidedly unfavorable clauses?
2. Is the cap on damages appropriate?
3. Are the termination conditions reasonable?
4. Is the ownership of intellectual property rights clear?
5. Is the scope of confidentiality obligations appropriate?

Reply in JSON format:
{
  "risk_level": "high/medium/low",
  "issues": ["list of issues"],
  "suggestions": ["list of improvement suggestions"],
  "explanation": "Plain-language explanation"
}
"""
        },
        {
            "step": "Report generation",
            "action": "Risk summary + recommended actions",
            "output": "PDF/HTML report"
        }
    ],
    "pricing_logic": "Value per contract: attorney fee ¥30,000-100,000",
    "competitive_advantage": "Results in 10 seconds at 1/10 the cost of an attorney"
}
```

### 1.4 Characteristics of AI SaaS Products Suited to Solo Development

```
Good fit:
  ✅ Text in → AI processing → text out (simple I/O)
  ✅ Well-defined target (filterable by job title or industry)
  ✅ Replaces an existing manual task (value is obvious)
  ✅ Even non-experts can judge output quality
  ✅ Repeat usage exists (monthly subscription is viable)
  ✅ Low-regulation domain (healthcare and finance are tough for individuals)

Poor fit:
  ❌ Requires real-time processing (high infrastructure cost)
  ❌ Requires large training datasets (fine-tuning assumed)
  ❌ Requires hardware integration (IoT, etc.)
  ❌ Heavily regulated (medical diagnosis, financial advice, etc.)
  ❌ Requires enterprise sales (not feasible solo)
  ❌ Two-sided marketplace (chicken-and-egg problem)
```

---

## 2. Roadmap to ¥1M/Month

### 2.1 The Four-Phase Model

```
Phase 0 → Phase 1 → Phase 2 → Phase 3
Idea       MVP       PMF       Scale
(2 weeks)  (4 weeks) (2 months) (ongoing)

  ¥0       ¥10K     ¥200K      ¥1M+
  │         │        │          │
  ▼         ▼        ▼          ▼

  Problem   First 10  50 paid   Automate
  discovery users     users     growth
```

### 2.2 Phase 0: Idea Validation (2 Weeks)

```python
# Idea evaluation scorecard
idea_scorecard = {
    "criteria": [
        {
            "name": "Severity of the problem",
            "question": "Without this, how many hours/yen are lost?",
            "weight": 3,
            "score_guide": {
                5: "Loss of ¥100K+/month or 10+ hours/month wasted",
                3: "¥50K/month or 5 hours/month",
                1: "Nice to have, but not critical"
            }
        },
        {
            "name": "Market size",
            "question": "How many people have this problem?",
            "weight": 2,
            "score_guide": {
                5: "1M+ people (global)",
                3: "100K–1M people",
                1: "Under 10K people"
            }
        },
        {
            "name": "AI fit",
            "question": "Can AI deliver 10x improvement over existing solutions?",
            "weight": 3,
            "score_guide": {
                5: "Delivers an experience impossible without AI",
                3: "AI enables major efficiency gains",
                1: "Little reason to use AI"
            }
        },
        {
            "name": "Solo-dev feasibility",
            "question": "Can you build an MVP within 4 weeks?",
            "weight": 2,
            "score_guide": {
                5: "Working prototype possible in 2 weeks",
                3: "Possible in 4 weeks",
                1: "Requires 3+ months"
            }
        },
        {
            "name": "Monetization ease",
            "question": "Will users pay ¥3,000–¥10,000/month?",
            "weight": 3,
            "score_guide": {
                5: "An existing paid alternative already exists",
                3: "Willingness to pay confirmed",
                1: "Domain where free is the default"
            }
        }
    ],
    "threshold": 50,  # Execute if 50+ out of 65
    "max_score": 65
}
```

#### Concrete Idea Validation Methods

```python
# Validation steps
class IdeaValidator:
    """Framework for validating an idea in 2 weeks"""

    def __init__(self, idea_name: str, target_audience: str):
        self.idea_name = idea_name
        self.target_audience = target_audience
        self.validation_results = {}

    def week1_demand_validation(self):
        """Week 1: Validate demand"""
        steps = {
            "day_1_2": {
                "task": "Competitor research",
                "actions": [
                    "List 10 similar services via Google search",
                    "Record pricing, features, and reviews for each",
                    "Research traffic volume with SimilarWeb",
                    "Collect complaints from App Store reviews and G2"
                ],
                "output": "competitive_analysis.md"
            },
            "day_3_4": {
                "task": "Target audience interviews",
                "actions": [
                    "Send DMs to 20 people on Twitter/X",
                    "Post a question on relevant subreddits",
                    "Call 5+ people from personal/professional network",
                    "Always ask: 'How much would you pay to solve this?'"
                ],
                "output": "interview_notes.md"
            },
            "day_5_7": {
                "task": "Landing page test",
                "actions": [
                    "Build a one-page LP on Carrd.co (30 minutes)",
                    "'Coming soon' + email signup form",
                    "Run a ¥5,000 Twitter ad to drive traffic to LP",
                    "10%+ email signup rate = demand confirmed"
                ],
                "output": "lp_conversion_data.csv"
            }
        }
        return steps

    def week2_technical_validation(self):
        """Week 2: Validate technical feasibility"""
        steps = {
            "day_8_9": {
                "task": "AI accuracy test",
                "actions": [
                    "Process 10 sample inputs with Claude/GPT-4 API",
                    "Rate output quality on a 1–5 scale",
                    "Optimize prompts (3+ iterations)",
                    "Pass criteria: 80%+ rated 4 or above"
                ]
            },
            "day_10_11": {
                "task": "Cost estimation",
                "actions": [
                    "Measure token count per API call",
                    "Calculate API cost for 200 users × avg usage frequency",
                    "Confirm gross margin of 70%+",
                    "Simulate cost changes at scale"
                ]
            },
            "day_12_14": {
                "task": "Prototype",
                "actions": [
                    "Build a working demo with Streamlit/Gradio",
                    "Show it to Week 1 interviewees",
                    "Final check: 'Would you pay for this?'",
                    "Go/No-Go decision"
                ]
            }
        }
        return steps

    def go_nogo_decision(self, metrics: dict) -> str:
        """Go/No-Go decision"""
        criteria = {
            "lp_conversion_rate": (metrics.get("lp_signups", 0) /
                                   max(metrics.get("lp_visitors", 1), 1)),
            "interview_willingness": metrics.get("willing_to_pay_count", 0) /
                                     max(metrics.get("total_interviews", 1), 1),
            "ai_quality_score": metrics.get("avg_quality_score", 0),
            "gross_margin": metrics.get("estimated_gross_margin", 0),
        }

        go_conditions = [
            criteria["lp_conversion_rate"] >= 0.10,     # LP conversion rate 10%+
            criteria["interview_willingness"] >= 0.50,    # 50%+ willing to pay
            criteria["ai_quality_score"] >= 4.0,          # AI quality 4.0/5.0+
            criteria["gross_margin"] >= 0.70,             # Gross margin 70%+
        ]

        passed = sum(go_conditions)
        if passed >= 4:
            return "GO: All conditions met. Proceed to MVP development."
        elif passed >= 3:
            return "CONDITIONAL GO: Improve weak conditions while building MVP."
        else:
            return "NO-GO: Rethink the idea or move to a different one."
```

### 2.3 Phase 1: Build the MVP (4 Weeks)

```python
# Fastest MVP stack for solo developers
solo_dev_stack = {
    "week_1": {
        "tasks": [
            "Initialize Next.js project",
            "Set up Supabase (DB + Auth)",
            "Connect Stripe (test mode)",
            "Create landing page (single page)"
        ],
        "tools": "Next.js 14 + shadcn/ui + Supabase + Stripe"
    },
    "week_2": {
        "tasks": [
            "Implement core AI feature (one feature only)",
            "Integrate OpenAI/Claude API",
            "Input form → AI processing → result display",
            "Error handling"
        ],
        "tools": "Vercel AI SDK + OpenAI API"
    },
    "week_3": {
        "tasks": [
            "Usage limits (free: 10/month)",
            "Stripe Checkout integration",
            "User dashboard",
            "Basic usage tracking"
        ],
        "tools": "Stripe + Supabase Edge Functions"
    },
    "week_4": {
        "tasks": [
            "Deploy to Vercel",
            "Custom domain setup",
            "Basic SEO (title, meta, OGP)",
            "Product Hunt prep",
            "Testing and bug fixes"
        ],
        "tools": "Vercel + Google Search Console"
    }
}
```

#### Week 1 Detail: Project Initialization

```typescript
// Project initialization script
// npx create-next-app@latest my-ai-saas --typescript --tailwind --app

// src/app/layout.tsx - Base layout
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/components/auth-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'AI SaaS - Solve Your [Problem] 10x Faster',
  description: 'An AI-powered service that automates [problem] for [target audience]',
  openGraph: {
    title: 'AI SaaS - Solve Your [Problem] 10x Faster',
    description: 'An AI-powered service that automates [problem] for [target audience]',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
```

```typescript
// src/lib/supabase/client.ts - Supabase client setup
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// src/lib/supabase/server.ts - Server-side client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
```

#### Week 2 Detail: Implementing the AI Feature

```typescript
// src/app/api/generate/route.ts - AI generation API route
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Simple in-memory cache for rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string, maxRequests: number = 10): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60000 }) // 1 minute window
    return true
  }

  if (userLimit.count >= maxRequests) {
    return false
  }

  userLimit.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit check
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment.' },
        { status: 429 }
      )
    }

    // Usage check
    const currentMonth = new Date().toISOString().slice(0, 7) // "2026-02"
    const { data: usage } = await supabase
      .from('usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .single()

    const currentCount = usage?.count || 0

    // Plan-based limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    const limits: Record<string, number> = {
      free: 10,
      pro: 500,
      premium: 2000,
    }

    const userLimit = limits[profile?.plan || 'free']

    if (currentCount >= userLimit) {
      return NextResponse.json({
        error: 'Usage limit reached',
        upgrade_url: '/pricing',
        current: currentCount,
        limit: userLimit,
      }, { status: 403 })
    }

    // Get request body
    const { input, options } = await request.json()

    if (!input || typeof input !== 'string' || input.length > 10000) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    // AI generation
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: buildPrompt(input, options),
        },
      ],
    })

    const result = message.content[0].type === 'text'
      ? message.content[0].text
      : ''

    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens

    // Update usage
    await supabase.from('usage').upsert({
      user_id: user.id,
      month: currentMonth,
      count: currentCount + 1,
      tokens_total: (usage as any)?.tokens_total
        ? (usage as any).tokens_total + tokensUsed
        : tokensUsed,
    })

    // Save history
    await supabase.from('history').insert({
      user_id: user.id,
      input: input.slice(0, 1000), // Save only first 1000 chars
      output: result.slice(0, 2000),
      tokens_used: tokensUsed,
      model: 'claude-sonnet-4-20250514',
    })

    return NextResponse.json({
      result,
      remaining: userLimit - currentCount - 1,
      tokens_used: tokensUsed,
    })

  } catch (error: any) {
    console.error('Generate error:', error)

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'AI API rate limit. Please retry in a few seconds.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function buildPrompt(input: string, options?: Record<string, any>): string {
  // Product-specific prompt template
  const systemContext = `You are a professional in [domain].
Analyze the user's input and provide specific, actionable advice.

Rules:
- Reply in English
- Include specific numbers and examples
- Present executable action items
- Add plain-language explanations for technical terms`

  return `${systemContext}\n\n---\n\nUser input:\n${input}`
}
```

### 2.4 Phase 2: Achieving PMF (2 Months)

```
PMF-achieving activities:

  Week 1-2: Acquire initial users
  ┌──────────────────────────────────────┐
  │ ● Share development progress on Twitter/X  │
  │ ● Post to relevant Reddit/HN communities   │
  │ ● Product Hunt launch                      │
  │ Goal: 100 free users                       │
  └──────────────────────────────────────┘
           │
           ▼
  Week 3-4: Collect feedback
  ┌──────────────────────────────────────┐
  │ ● User interviews (10+ people)       │
  │ ● Analyze drop-off points            │
  │ ● Identify most-used features        │
  │ Goal: Identify the "can't live without it" feature │
  └──────────────────────────────────────┘
           │
           ▼
  Week 5-8: Improve and monetize
  ┌──────────────────────────────────────┐
  │ ● Improve core feature quality       │
  │ ● Test optimal pricing for paid plan │
  │ ● Launch referral program            │
  │ Goal: 50 paid users (MRR ¥250K)      │
  └──────────────────────────────────────┘
```

#### Implementation for Measuring PMF

```python
# PMF score measurement system
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class PMFMetrics:
    """Metrics for measuring PMF achievement"""

    # Sean Ellis test: "How would you feel if you could no longer use this product?"
    very_disappointed_pct: float  # % who answered "Very disappointed"

    # Engagement metrics
    dau_mau_ratio: float         # DAU/MAU ratio
    weekly_active_rate: float    # Weekly active rate

    # Retention metrics
    day7_retention: float        # Day-7 retention
    day30_retention: float       # Day-30 retention
    monthly_churn_rate: float    # Monthly churn rate

    # Growth metrics
    organic_signup_rate: float   # % of signups from organic sources
    nps_score: float             # Net Promoter Score

    def pmf_score(self) -> float:
        """Calculate PMF score 0–100"""
        scores = {
            "sean_ellis": min(self.very_disappointed_pct / 0.40 * 30, 30),
            "engagement": min(self.dau_mau_ratio / 0.20 * 20, 20),
            "retention": min(self.day30_retention / 0.30 * 25, 25),
            "growth": min(self.organic_signup_rate / 0.60 * 15, 15),
            "nps": min(max(self.nps_score / 50 * 10, 0), 10),
        }
        return sum(scores.values())

    def pmf_status(self) -> str:
        """Determine PMF status"""
        score = self.pmf_score()
        if score >= 80:
            return "Strong PMF - Ready to scale"
        elif score >= 60:
            return "Early PMF - Scale carefully while improving"
        elif score >= 40:
            return "Pre-PMF - Focus on feature improvement"
        else:
            return "No PMF - Consider pivoting"

    def improvement_priorities(self) -> list[str]:
        """Return improvement priorities"""
        priorities = []
        if self.very_disappointed_pct < 0.40:
            priorities.append("Sean Ellis score low: need to clarify core value")
        if self.day30_retention < 0.20:
            priorities.append("Day-30 retention low: improve onboarding")
        if self.monthly_churn_rate > 0.10:
            priorities.append("Churn rate high: investigate and address cancellation reasons")
        if self.organic_signup_rate < 0.30:
            priorities.append("Organic traffic low: SEO and viral tactics needed")
        return priorities


# Usage example
metrics = PMFMetrics(
    very_disappointed_pct=0.45,
    dau_mau_ratio=0.15,
    weekly_active_rate=0.60,
    day7_retention=0.35,
    day30_retention=0.22,
    monthly_churn_rate=0.08,
    organic_signup_rate=0.40,
    nps_score=35.0,
)

print(f"PMF score: {metrics.pmf_score():.1f}/100")
print(f"Status: {metrics.pmf_status()}")
print(f"Top improvements: {metrics.improvement_priorities()}")
```

### 2.5 Phase 3: Scale (Toward ¥1M/Month)

```python
# Scaling strategy implementation
scaling_strategy = {
    "revenue_levers": {
        "increase_users": {
            "current": 50,
            "target": 200,
            "tactics": [
                "SEO blog: 2 articles/week → 10K PV/month → 50 signups/month",
                "Referral program: 20% of existing users refer 1 person",
                "Twitter/X: 5,000 followers → 30 signups/month",
                "Product Hunt re-launch: v2.0 after 6 months",
            ]
        },
        "increase_arpu": {
            "current": 5000,
            "target": 6000,
            "tactics": [
                "Add higher tier: ¥9,800/month Premium plan",
                "Annual discount: promote annual contracts at 80% of monthly",
                "Add-on feature: API access ¥3,000/month",
                "Usage-based overage billing above base quota",
            ]
        },
        "reduce_churn": {
            "current": 0.08,
            "target": 0.04,
            "tactics": [
                "Pre-cancellation survey + special offer",
                "Automatic re-engagement for users with declining usage",
                "Regular announcements of feature updates",
                "Build a user community",
            ]
        }
    },
    "100m_scenarios": [
        {"users": 200, "arpu": 5000, "mrr": 1000000},
        {"users": 130, "arpu": 7700, "mrr": 1001000},
        {"users": 100, "arpu": 10000, "mrr": 1000000},
    ]
}
```

---

## 3. Technical Implementation Details

### 3.1 Minimal Code Example

```python
# Minimal AI SaaS backend with FastAPI
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import anthropic
import stripe
from supabase import create_client

app = FastAPI()

# Environment variables
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
STRIPE_KEY = os.getenv("STRIPE_SECRET_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize clients
ai = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
stripe.api_key = STRIPE_KEY
db = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.post("/api/generate")
async def generate(request: dict, user=Depends(auth)):
    """Core AI feature"""
    # 1. Check usage
    usage = db.table("usage").select("count") \
        .eq("user_id", user.id) \
        .eq("month", current_month()).execute()

    current = usage.data[0]["count"] if usage.data else 0
    limit = 10 if user.plan == "free" else 1000

    if current >= limit:
        raise HTTPException(
            403,
            detail={"error": "limit_reached", "upgrade_url": "/pricing"}
        )

    # 2. AI generation
    response = ai.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": build_prompt(request["input"], user.preferences)
        }]
    )

    result = response.content[0].text

    # 3. Record usage
    db.table("usage").upsert({
        "user_id": user.id,
        "month": current_month(),
        "count": current + 1
    }).execute()

    # 4. Save history
    db.table("history").insert({
        "user_id": user.id,
        "input": request["input"],
        "output": result,
        "tokens": response.usage.input_tokens + response.usage.output_tokens
    }).execute()

    return {"result": result, "remaining": limit - current - 1}
```

### 3.2 Database Schema Design

```sql
-- Supabase table definitions
-- Minimal schema for a solo AI SaaS

-- User profiles
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'premium')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    month TEXT NOT NULL,  -- '2026-02' format
    count INTEGER DEFAULT 0,
    tokens_total BIGINT DEFAULT 0,
    api_cost_cents INTEGER DEFAULT 0,  -- API cost tracking (in cents)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month)
);

-- Generation history
CREATE TABLE history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    model TEXT NOT NULL,
    processing_time_ms INTEGER,
    feedback_score INTEGER CHECK (feedback_score BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback (for PMF measurement)
CREATE TABLE feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    type TEXT CHECK (type IN ('nps', 'sean_ellis', 'feature_request', 'bug_report')),
    score INTEGER,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can read own usage"
    ON usage FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own history"
    ON history FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_usage_user_month ON usage(user_id, month);
CREATE INDEX idx_history_user_created ON history(user_id, created_at DESC);
CREATE INDEX idx_feedback_type ON feedback(type, created_at DESC);
```

### 3.3 Stripe Webhook Implementation

```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Webhooks use service role key
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      await handleCheckoutCompleted(session)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionUpdated(subscription)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await handleSubscriptionCanceled(subscription)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await handlePaymentFailed(invoice)
      break
    }
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id
  if (!userId) return

  await supabase
    .from('profiles')
    .update({
      plan: 'pro',
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  console.log(`User ${userId} upgraded to pro`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const plan = subscription.status === 'active' ? 'pro' : 'free'

  await supabase
    .from('profiles')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscription.id)
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  await supabase
    .from('profiles')
    .update({
      plan: 'free',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  console.log(`Subscription ${subscription.id} canceled`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Notify on payment failure (e.g., send email via Resend)
  console.warn(`Payment failed for invoice ${invoice.id}`)
}
```

### 3.4 Monthly Cost Breakdown

```
Solo AI SaaS monthly cost breakdown (at 200 users):

  ┌──────────────────────────────────────┐
  │ Item                  │ Monthly Cost  │
  ├──────────────────────────────────────┤
  │ Vercel Pro            │ ¥3,000       │
  │ Supabase Pro          │ ¥4,000       │
  │ AI API (Claude)       │ ¥80,000      │ ← Largest cost
  │ Domain (prorated)     │ ¥200         │
  │ Sentry                │ ¥0 (free tier) │
  │ PostHog               │ ¥0 (free tier) │
  │ Stripe fees           │ ¥30,000      │ (3.6%)
  │ Email (Resend)        │ ¥0 (free tier) │
  ├──────────────────────────────────────┤
  │ Total                 │ ¥117,200     │
  │ Revenue (200×¥5,000)  │ ¥1,000,000   │
  │ Gross profit          │ ¥882,800     │
  │ Gross margin          │ 88.3%        │
  └──────────────────────────────────────┘
```

### 3.5 API Cost Optimization Techniques

```python
# Implementation patterns for reducing AI API costs

import hashlib
import json
from functools import lru_cache
from datetime import datetime, timedelta


class APICostOptimizer:
    """Utility for optimizing AI API costs"""

    def __init__(self, redis_client=None):
        self.redis = redis_client
        self.cost_per_1k_input = 0.003   # Claude Sonnet input: $3/MTok
        self.cost_per_1k_output = 0.015  # Claude Sonnet output: $15/MTok

    def cache_key(self, prompt: str, model: str) -> str:
        """Generate cache key"""
        content = f"{model}:{prompt}"
        return f"ai_cache:{hashlib.sha256(content.encode()).hexdigest()}"

    async def generate_with_cache(
        self,
        client,
        prompt: str,
        model: str = "claude-sonnet-4-20250514",
        cache_ttl: int = 3600
    ):
        """AI generation with caching"""
        # 1. Check cache
        if self.redis:
            key = self.cache_key(prompt, model)
            cached = await self.redis.get(key)
            if cached:
                return json.loads(cached), {"cached": True, "cost": 0}

        # 2. API call
        response = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )

        result = response.content[0].text
        cost = self._calculate_cost(response.usage)

        # 3. Save to cache
        if self.redis:
            await self.redis.setex(
                key,
                cache_ttl,
                json.dumps(result)
            )

        return result, {"cached": False, "cost": cost}

    def _calculate_cost(self, usage) -> float:
        """Calculate API cost (USD)"""
        input_cost = (usage.input_tokens / 1000) * self.cost_per_1k_input
        output_cost = (usage.output_tokens / 1000) * self.cost_per_1k_output
        return round(input_cost + output_cost, 6)

    def select_optimal_model(self, task_complexity: str) -> str:
        """Select the best model based on task complexity"""
        model_map = {
            "simple": "claude-haiku-4-20250514",      # Classification, extraction → cheap
            "moderate": "claude-sonnet-4-20250514",   # General generation
            "complex": "claude-sonnet-4-20250514",    # High-quality analysis
        }
        return model_map.get(task_complexity, "claude-sonnet-4-20250514")

    def estimate_monthly_cost(
        self,
        users: int,
        avg_requests_per_user: int,
        avg_input_tokens: int = 500,
        avg_output_tokens: int = 800
    ) -> dict:
        """Estimate monthly API cost"""
        total_requests = users * avg_requests_per_user
        total_input_tokens = total_requests * avg_input_tokens
        total_output_tokens = total_requests * avg_output_tokens

        input_cost = (total_input_tokens / 1_000_000) * 3.0    # $3/MTok
        output_cost = (total_output_tokens / 1_000_000) * 15.0  # $15/MTok
        total_usd = input_cost + output_cost
        total_jpy = total_usd * 150  # Assumed exchange rate

        return {
            "total_requests": total_requests,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "cost_usd": round(total_usd, 2),
            "cost_jpy": round(total_jpy, 0),
            "cost_per_request_jpy": round(total_jpy / total_requests, 1),
        }


# Cost estimation example
optimizer = APICostOptimizer()
estimate = optimizer.estimate_monthly_cost(
    users=200,
    avg_requests_per_user=30,  # 30 uses/month
    avg_input_tokens=500,
    avg_output_tokens=800
)
# → { "cost_jpy": ~81,000, "cost_per_request_jpy": 13.5 }
```

---

## 4. Marketing (Methods for One Person)

### 4.1 Channel Priorities

| Priority | Channel | Effort/week | Expected impact | Ramp-up time |
|----------|---------|-------------|----------------|--------------|
| 1 | Twitter/X (Build in Public) | 3h | High | Immediate |
| 2 | SEO blog | 4h | Highest | 3 months |
| 3 | Product Hunt | 8h (one-time) | Medium–High | Immediate |
| 4 | Reddit/HN | 2h | Medium | Immediate |
| 5 | YouTube | 5h | High | 2 months |
| 6 | IndieHackers | 1h | Medium | 1 month |

### 4.2 Build in Public Strategy

```python
build_in_public = {
    "daily_tweets": [
        "Development progress (with screenshots)",
        "Public user count / MRR",
        "Lessons learned",
        "Technical challenges and solutions"
    ],
    "weekly_posts": [
        "Weekly report (with numbers)",
        "Feature release announcements",
        "Sharing user feedback"
    ],
    "milestone_posts": [
        "First paid user acquired",
        "MRR $1,000 reached",
        "Product Hunt launch",
        "¥1M/month achieved"
    ],
    "effect": "Followers → early users → viral spread",
    "example_format": (
        "Day 47 of building [ProductName]:\n\n"
        "This week:\n"
        "- Added feature X\n"
        "- 23 new signups\n"
        "- MRR: $2,400 (+15%)\n\n"
        "Biggest learning: [insight]\n\n"
        "#buildinpublic #indiehackers"
    )
}
```

### 4.3 SEO Blog Strategy Details

```python
# SEO content strategy
seo_content_strategy = {
    "keyword_research": {
        "tools": ["Ubersuggest (free tier)", "Google Keyword Planner", "AnswerThePublic"],
        "target_keywords": {
            "transactional": [
                "[problem] tool",
                "[problem] automation",
                "[problem] how to streamline",
            ],
            "informational": [
                "what is [problem]",
                "how to [problem]",
                "tips for [problem]",
                "[problem] template",
            ],
            "comparison": [
                "[Competitor A] vs [Competitor B]",
                "[Competitor] alternative",
                "[Competitor] pricing",
            ]
        },
        "selection_criteria": {
            "monthly_search_volume": "100–5,000 (niche but with demand)",
            "keyword_difficulty": "30 or below (winnable keywords)",
            "commercial_intent": "Medium–High",
        }
    },
    "content_calendar": {
        "week_1": "How-to articles × 2",
        "week_2": "Comparison article × 1 + use-case article × 1",
        "week_3": "How-to articles × 2",
        "week_4": "Case study × 1 + roundup article × 1",
    },
    "article_template": {
        "structure": [
            "H1: The Complete Guide to [Keyword] [2026 Edition]",
            "Intro: Empathize with the problem + present solution",
            "H2: Current state and issues with [problem]",
            "H2: 3 solutions (include your product)",
            "H2: Step-by-step guide (with screenshots)",
            "H2: Frequently asked questions",
            "CTA: Drive to free trial",
        ],
        "word_count": "2,000–4,000 words",
        "images": "Minimum 5 (screenshots, diagrams)",
        "internal_links": "2–3 related articles + LP",
    },
    "expected_results": {
        "month_1_3": "500–1,000 PV/month",
        "month_4_6": "3,000–5,000 PV/month",
        "month_7_12": "10,000+ PV/month",
        "conversion_rate": "PV → signup: 2–5%",
    }
}
```

### 4.4 Product Hunt Launch Strategy

```python
# Product Hunt launch checklist
product_hunt_launch = {
    "pre_launch_2weeks": [
        "Find a Hunter (submitter) or become one yourself",
        "Build up Product Hunt account activity (comments, upvotes)",
        "Create launch assets:",
        "  - Logo (240x240px)",
        "  - Thumbnail images (1270x760px) × 5",
        "  - Intro video (under 60s; Loom recommended)",
        "  - Tagline (one sentence, under 60 chars)",
        "  - Description (benefit-focused, under 260 chars)",
        "Create an 'Upcoming' page to gather pre-launch followers",
    ],
    "pre_launch_3days": [
        "Notify friends and acquaintances of launch date",
        "Post a countdown on Twitter/X",
        "Build relationships in the Product Hunt community",
        "Schedule launch for Tuesday–Thursday (less competition)",
    ],
    "launch_day": {
        "time": "12:01 AM Pacific Time (5:01 PM JST)",
        "actions": [
            "Immediately post a self-introduction and origin story in the comments",
            "Announce on Twitter/X, LinkedIn, and all social channels",
            "Send notification email to mailing list",
            "Share in relevant Slack communities",
            "Reply to all comments within 15 minutes",
            "Post progress updates on social every hour",
        ]
    },
    "post_launch": [
        "Post additional social content if you make Top 5",
        "Add the Product Hunt badge to your site",
        "Write a launch retrospective blog post",
        "Send a welcome email to new users",
    ],
    "success_metrics": {
        "good": "100+ upvotes, Top 10",
        "great": "300+ upvotes, Top 5",
        "excellent": "500+ upvotes, Product of the Day",
    }
}
```

---

## 5. Operations Automation

### 5.1 Automation Map

```
Solo operations automation map:

  ■ Support automation
  ┌──────────────────────────────────────┐
  │ AI chatbot (80% auto-resolved)       │
  │ → Unresolved: email notification → reply within 1 day │
  │ FAQ auto-update (monthly)            │
  └──────────────────────────────────────┘

  ■ Monitoring automation
  ┌──────────────────────────────────────┐
  │ Sentry: error detection → Slack alert │
  │ UptimeRobot: downtime detection → SMS │
  │ PostHog: usage anomaly → alert       │
  └──────────────────────────────────────┘

  ■ Billing automation
  ┌──────────────────────────────────────┐
  │ Stripe: invoicing, collection, receipts fully automated │
  │ Webhook: plan change → DB auto-update │
  │ Dunning emails: automated (Stripe config) │
  └──────────────────────────────────────┘

  ■ Marketing automation
  ┌──────────────────────────────────────┐
  │ Onboarding emails: automated sequence │
  │ Churn prevention: detect low usage → auto email │
  │ NPS survey: auto-send monthly        │
  └──────────────────────────────────────┘
```

### 5.2 Onboarding Email Automation Implementation

```typescript
// src/lib/email/onboarding-sequence.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface OnboardingEmail {
  day: number
  subject: string
  template: string
  condition?: (user: any) => boolean
}

const ONBOARDING_SEQUENCE: OnboardingEmail[] = [
  {
    day: 0,
    subject: "Welcome! Experience [ProductName] in your first 3 minutes",
    template: "welcome",
  },
  {
    day: 1,
    subject: "Top 3 most popular features in [ProductName]",
    template: "top-features",
  },
  {
    day: 3,
    subject: "Have you tried these features yet?",
    template: "feature-discovery",
    condition: (user) => user.usage_count < 3,  // Only for low-usage users
  },
  {
    day: 7,
    subject: "Here's how other users are getting value",
    template: "use-cases",
  },
  {
    day: 14,
    subject: "Ready to 10x your results with the Pro plan?",
    template: "upgrade-offer",
    condition: (user) => user.plan === 'free' && user.usage_count >= 5,
  },
]

export async function processOnboardingEmails() {
  // Run daily via Supabase Edge Function or cron job
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .gte('created_at', new Date(Date.now() - 15 * 86400000).toISOString())

  for (const user of users || []) {
    const daysSinceSignup = Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) / 86400000
    )

    const emailToSend = ONBOARDING_SEQUENCE.find(
      (email) => email.day === daysSinceSignup
    )

    if (!emailToSend) continue
    if (emailToSend.condition && !emailToSend.condition(user)) continue

    // Check if already sent
    const { data: sent } = await supabase
      .from('email_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('template', emailToSend.template)
      .single()

    if (sent) continue

    // Send email
    await resend.emails.send({
      from: 'noreply@yourdomain.com',
      to: user.email,
      subject: emailToSend.subject,
      html: renderTemplate(emailToSend.template, user),
    })

    // Log the send
    await supabase.from('email_log').insert({
      user_id: user.id,
      template: emailToSend.template,
      sent_at: new Date().toISOString(),
    })
  }
}
```

### 5.3 Monitoring Dashboard

```python
# Monitoring dashboard for solo developers
# Daily report sent to Slack/email every morning

from datetime import datetime, timedelta
from dataclasses import dataclass


@dataclass
class DailyReport:
    date: str
    new_signups: int
    active_users: int
    total_generations: int
    api_cost_usd: float
    mrr_jpy: int
    churn_count: int
    error_count: int
    avg_response_time_ms: int
    top_feature_usage: dict


async def generate_daily_report(supabase) -> DailyReport:
    """Auto-generate daily report"""
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)

    # New signups
    signups = await supabase.from('profiles') \
        .select('id', count='exact') \
        .gte('created_at', yesterday.isoformat()) \
        .lt('created_at', today.isoformat()) \
        .execute()

    # Active users
    active = await supabase.from('history') \
        .select('user_id', count='exact') \
        .gte('created_at', yesterday.isoformat()) \
        .execute()

    # Total generations
    generations = await supabase.from('history') \
        .select('id', count='exact') \
        .gte('created_at', yesterday.isoformat()) \
        .execute()

    # API cost
    tokens = await supabase.from('history') \
        .select('tokens_used') \
        .gte('created_at', yesterday.isoformat()) \
        .execute()

    total_tokens = sum(r['tokens_used'] for r in (tokens.data or []))
    api_cost = (total_tokens / 1_000_000) * 18  # Approximate $18/MTok average

    # MRR calculation
    pro_users = await supabase.from('profiles') \
        .select('id', count='exact') \
        .eq('plan', 'pro') \
        .execute()
    mrr = (pro_users.count or 0) * 5000  # ¥5,000/month

    return DailyReport(
        date=yesterday.isoformat(),
        new_signups=signups.count or 0,
        active_users=active.count or 0,
        total_generations=generations.count or 0,
        api_cost_usd=round(api_cost, 2),
        mrr_jpy=mrr,
        churn_count=0,  # Calculated separately
        error_count=0,  # Pulled from Sentry
        avg_response_time_ms=0,  # Calculated from logs
        top_feature_usage={},
    )


def format_slack_message(report: DailyReport) -> str:
    """Format for Slack notification"""
    mrr_emoji = ":chart_with_upwards_trend:" if report.mrr_jpy > 0 else ":chart:"

    return f"""
*Daily Report - {report.date}*

{mrr_emoji} *MRR:* ¥{report.mrr_jpy:,}
:busts_in_silhouette: *New signups:* {report.new_signups}
:zap: *Active users:* {report.active_users}
:robot_face: *AI generations:* {report.total_generations}
:money_with_wings: *API cost:* ${report.api_cost_usd}
:warning: *Errors:* {report.error_count}
"""
```

---

## 6. Anti-Patterns

### Anti-Pattern 1: Feature Bloat

```python
# BAD: Responding to every user request
def product_roadmap_bad():
    features = [
        "AI article generation",   # Core
        "AI image generation",     # Related but a different product
        "Team management",         # Too early
        "API access",              # Not yet
        "Mobile app",              # Not needed
        "Slack integration",       # Requested by only a few
    ]
    # → 6 months of development, nothing done well

# GOOD: Polish the core, add only what demand has proven
def product_roadmap_good():
    v1 = ["AI article generation"]  # Master one feature
    v2 = ["Article SEO optimization"]  # Extension of the core
    v3 = ["Template feature"]  # #1 user request
    # → Each version ships in 2–3 weeks
```

### Anti-Pattern 2: Underpricing

```python
# BAD: Believing cheaper means more sales
pricing_bad = {
    "price": 500,  # ¥500/month
    "target_users": 2000,  # Need 2,000 users
    "difficulty": "Getting 2,000 users is 10x harder than getting 200",
    "support_load": "Supporting 2,000 users = impossible for 1 person"
}

# GOOD: Price to reflect value
pricing_good = {
    "price": 5000,  # ¥5,000/month
    "target_users": 200,  # 200 users is enough
    "value_basis": "Saves 5 hours/month = ¥25,000 of value; charge 20% of that",
    "support_load": "200 users = fully manageable solo"
}
```

### Anti-Pattern 3: Over-engineering

```python
# BAD: Making cutting-edge technology the goal
tech_focused_bad = {
    "stack": [
        "Kubernetes",          # Not needed for solo dev
        "Microservices",       # Monolith is fine
        "Custom ML model",     # API is sufficient
        "GraphQL",             # REST is fine
        "Redis Cluster",       # Single instance is fine
    ],
    "result": "2 months building infra, product still unfinished"
}

# GOOD: Ship fast with boring technology
tech_focused_good = {
    "stack": [
        "Next.js + Vercel",    # Zero-config deploy
        "Supabase",            # DB + Auth in one
        "Claude API",          # AI via API call
        "Stripe",              # Billing fully handled",
    ],
    "result": "MVP done in 4 weeks, value delivered to users"
}
```

### Anti-Pattern 4: Perfectionism

```python
# BAD: Not releasing until everything is perfect
perfectionism_bad = {
    "blockers": [
        "The design isn't perfect yet",
        "Not all edge cases are handled",
        "Test coverage hasn't reached 90%",
        "Documentation isn't complete",
        "I don't like the logo",
    ],
    "result": "3 months pass with no release, motivation lost"
}

# GOOD: Ship at 80%, improve with user feedback
shipping_mindset_good = {
    "mvp_criteria": [
        "One core feature works",
        "Can accept payment",
        "No critical bugs",
    ],
    "deferred": [
        "Design improvements → after user feedback",
        "Additional features → after confirming demand",
        "More tests → after confirming stable operation",
    ],
    "result": "Released in 4 weeks, real feedback obtained, improvement cycle begins"
}
```

---

## 7. Legal and Tax Considerations

### 7.1 Required Steps as a Sole Proprietor

```
Business registration checklist:

  □ File a business commencement notification (at the tax office, within 1 month of starting)
  □ File a blue-return tax approval application (within 2 months of starting)
  □ Open a dedicated business bank account
  □ Adopt accounting software (freee, Money Forward, etc.)
  □ Prepare disclosures required by the Specified Commercial Transactions Act
  □ Draft a Privacy Policy
  □ Draft Terms of Service

Additional steps upon reaching ¥1M/month:
  □ Register as a consumption tax taxable entity (annual revenue over ¥10M)
  □ Consider registering as an invoice-issuing business
  □ Consider incorporation (may be advantageous if annual profit exceeds ¥5M)
  □ Engage a tax accountant on a retainer basis
```

### 7.2 Terms of Service and Privacy Policy

```python
# Minimum required legal documents
legal_documents = {
    "Terms of Service": {
        "Required items": [
            "Definition and scope of the service",
            "Pricing and payment terms",
            "Prohibited activities (fraud, reverse engineering, etc.)",
            "Intellectual property ownership (rights to AI-generated content)",
            "Disclaimer (regarding accuracy of AI output)",
            "Right to modify or suspend the service",
            "Cancellation and refund policy",
            "Governing law and jurisdiction",
        ],
        "AI-specific considerations": [
            "AI output is for reference only and does not constitute professional advice",
            "How input data is handled (e.g., not used for training)",
            "Copyright treatment of AI-generated output",
        ]
    },
    "Privacy Policy": {
        "Required items": [
            "Types of personal information collected",
            "Purpose for using personal information",
            "Whether data is shared with third parties (Stripe, Supabase, AI APIs, etc.)",
            "Data retention period",
            "User rights (deletion requests, disclosure requests, etc.)",
            "Cookie usage",
            "Contact information",
        ],
        "GDPR compliance (if you have EU users)": [
            "Legal basis for data processing",
            "Data Protection Officer contact information",
            "Data transfers outside the EEA",
            "Right to erasure (right to be forgotten)",
        ]
    },
    "Specified Commercial Transactions Act disclosures": {
        "Required items": [
            "Business operator name (or company name)",
            "Address",
            "Phone number",
            "Email address",
            "Sales price",
            "Payment methods",
            "Return and cancellation policy",
        ]
    }
}
```

---

## 8. Mental Health and Sustainability

### 8.1 Preventing Burnout as a Solo Developer

```
Solo developer sustainability checklist:

  ■ Time management
  ┌──────────────────────────────────────┐
  │ Weekdays: max 6 hours/day (3h if side project) │
  │ Weekends: off in principle (emergency only)     │
  │ Paid time off: schedule at least 1 fully-off day/month │
  │ Late-night work: prohibited (judgment deteriorates)     │
  └──────────────────────────────────────┘

  ■ Mental hygiene
  ┌──────────────────────────────────────┐
  │ Don't compare: stop comparing MRR with other devs │
  │ Celebrate small wins: record weekly progress      │
  │ Community: find peers on IndieHackers             │
  │ Exercise: build a habit of 3+ workouts/week       │
  └──────────────────────────────────────┘

  ■ Risk diversification
  ┌──────────────────────────────────────┐
  │ Maintain 6 months of living expenses in savings   │
  │ Start as a side project while keeping your day job │
  │ Don't depend on a single product for all income   │
  │ Automate to minimize operational time             │
  └──────────────────────────────────────┘
```

### 8.2 Weekly Retrospective Template

```python
# Retrospective to run every Friday
weekly_review_template = {
    "metrics": {
        "new_signups": "___ users",
        "active_users": "___ users",
        "mrr": "¥___",
        "churn": "___ users",
        "nps_score": "___",
        "support_tickets": "___ tickets",
        "hours_worked": "___ hours",
    },
    "reflection": {
        "wins": [
            "What was the biggest win this week?",
            "Was there any positive feedback from users?",
        ],
        "learnings": [
            "What was the most important thing learned this week?",
            "What did you learn from failures?",
        ],
        "next_week": [
            "What are the top 3 priorities for next week?",
            "What have you decided NOT to do? (low-priority items)",
        ],
        "wellbeing": [
            "Stress level (1–10): ___",
            "Motivation (1–10): ___",
            "Are you getting enough sleep?",
        ]
    }
}
```

---

## 9. FAQ

### Q1: How much programming skill is required?

**A:** Being able to write Next.js + API calls is enough. Specifically: (1) React/Next.js basics, (2) calling REST APIs (fetch/axios), (3) basic Stripe integration. Advanced ML knowledge is not needed — AI features are implemented via API calls. Even a beginner can get up to speed in 2–3 months. Using AI coding assistants like Cursor can reduce that even further.

### Q2: When should I quit my day job?

**A:** Don't quit until three conditions are met: (1) MRR is at least 1.5× your living expenses (e.g., if you spend ¥500K/month, MRR must be ¥750K), (2) month-over-month growth is stable (positive growth for 3 consecutive months), (3) monthly churn rate is stable below 5%. Many successful solo developers start as a side project and transition over 12–18 months. Quitting in a hurry leads to poor decisions.

### Q3: What do I do when a competitor appears?

**A:** Three responses: (1) Focus on customer voices — improve based on user feedback, not competitor watching; (2) Double down on niche — narrow your focus even further (e.g., "AI articles" → "AI real-estate articles"); (3) Workflow integration — evolve from a single feature to a workflow to increase switching costs. A solo developer's biggest advantage is speed. Changes that take a large company months can be executed in days.

### Q4: How do I keep up with AI model updates?

**A:** The key is designing to minimize model dependency: (1) separate prompts from business logic; (2) make model swaps a one-line change; (3) add validation for output format. When a new model arrives, be ready to switch with a few hours of testing. For worst-case scenarios, build a multi-provider fallback (Claude + GPT-4) for peace of mind.

### Q5: When should I incorporate?

**A:** Consider incorporating when annual profit exceeds ¥5M. Individual income tax is progressive (up to 45% + 10% residential tax), while corporate tax caps out around 23%, making incorporation increasingly advantageous as profit grows. However, incorporation has setup costs (~¥250K), annual accounting costs (¥300K–500K/year), and social insurance obligations, so consult a tax accountant for a concrete simulation.

### Q6: When and how do I expand internationally?

**A:** After achieving PMF in the Japanese market. Concrete steps: (1) Localize UI/UX into English (i18n); (2) Set pricing in USD (often possible to price higher than Japan); (3) Launch on the English-language Product Hunt; (4) Start an English SEO blog. The market size is 10–50× larger, putting ¥10M/month within reach. Factor in the cost of supporting additional languages and time zones.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend solidly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Revenue target | 200 users × ¥5,000 = ¥1M/month |
| MVP timeline | 4 weeks (1 feature, LP, billing, deploy) |
| Tech stack | Next.js + Supabase + Claude API + Stripe + Vercel |
| Marketing | Build in Public + SEO blog + Product Hunt |
| Operating cost | ~¥120K/month (88% gross margin) |
| Most important principle | Focus on 1 feature, price to value, automate for lean ops |
| Risk management | Start as side project, keep 6-month savings buffer, handle legal |
| Sustainability | Under 30 hours/week, prevent burnout, weekly retrospectives |

---

## What to Read Next

- [02-startup-guide.md](./02-startup-guide.md) — Scaling to a team
- [../02-monetization/00-pricing-models.md](../02-monetization/00-pricing-models.md) — Pricing model design
- [../01-business/00-ai-saas.md](../01-business/00-ai-saas.md) — AI SaaS product design

---

## References

1. **"The Minimalist Entrepreneur" — Sahil Lavingia** — Philosophy and practice of solo-developer businesses
2. **IndieHackers** — https://indiehackers.com — Solo-developer community and success story collection
3. **"Zero to Sold" — Arvid Kahl** — From bootstrapping a SaaS to an exit
4. **Pieter Levels (levelsio)** — https://twitter.com/levelsio — Real example of a solo developer earning $200K+/month
5. **"Deploy Empathy" — Michele Hansen** — Practical guide to customer interviews
6. **Stripe Atlas** — https://stripe.com/atlas — Support for setting up a global SaaS business entity
