# Startup Guide — Fundraising and Team Building

> A systematic guide covering everything from founding an AI startup to fundraising, team building, and organizational scaling, providing practical frameworks and checklists.

---

## What You Will Learn in This Chapter

1. **Launching an AI Startup** — Incorporating a company, choosing co-founders, and early decision-making frameworks
2. **Fundraising in Practice** — Fundraising strategies for Pre-Seed/Seed/Series A stages, pitch deck creation, and investor negotiation
3. **Team Building and Scaling** — Practical methods for hiring AI talent, organizational design, and culture building
4. **Organizational Scaling** — Organizational challenges and countermeasures at each phase: 10 → 30 → 100 people
5. **Legal and Governance** — Shareholder agreements, stock options, and compliance in practice


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Solo Developer — 1-Person AI SaaS, ¥1M/Month](./01-solo-developer.md)

---

## 1. Launching an AI Startup

### 1.1 Founding Checklist

```
┌──────────────────────────────────────────────────────────┐
│           AI Startup Founding Checklist                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ■ Phase 0: Preparation (1-2 months)                     │
│  □ Clarify the problem and estimate market size          │
│  □ Select co-founder(s) (or decide to go solo)           │
│  □ Build an initial prototype                            │
│  □ Interview 10+ potential customers                     │
│                                                          │
│  ■ Phase 1: Legal Foundation (2-4 weeks)                 │
│  □ Incorporate (joint-stock company or LLC)              │
│  □ Shareholder agreement (if there are co-founders)      │
│  □ Confirm intellectual property ownership               │
│  □ Open a bank account                                   │
│                                                          │
│  ■ Phase 2: MVP (1-2 months)                             │
│  □ Develop and launch MVP                                │
│  □ Acquire initial users (target: 100)                   │
│  □ Establish a feedback cycle                            │
│  □ Validate unit economics                               │
│                                                          │
│  ■ Phase 3: Fundraising Preparation (1 month)            │
│  □ Create pitch deck                                     │
│  □ Build financial model                                 │
│  □ List up investors                                     │
│  □ Prepare due diligence materials                       │
└──────────────────────────────────────────────────────────┘
```

### 1.2 How to Choose a Co-Founder

```
Ideal co-founder combinations:

  AI Startup = Business × Product × AI Technology

  Pattern 1: 2-person team (most common)
  ┌─────────────┐    ┌─────────────┐
  │ CEO/Business│    │ CTO/Tech    │
  │ Sales, Fund │    │ AI/ML, Dev  │
  │ Mktg, Strat │    │ Infra       │
  └─────────────┘    └─────────────┘

  Pattern 2: 3-person team
  ┌────────┐  ┌────────┐  ┌────────┐
  │CEO     │  │CTO     │  │CPO     │
  │Business│  │AI Tech │  │Product │
  └────────┘  └────────┘  └────────┘

  Pattern 3: Solo founder
  ┌──────────────────────────────────┐
  │ All skills in 1 person +         │
  │ outsourcing/AI to fill gaps      │
  │ Pros: fast decisions, no dilution│
  │ Cons: resource constraints,      │
  │       isolation                  │
  └──────────────────────────────────┘
```

### 1.3 Co-Founder Evaluation Framework

```python
# Co-founder candidate evaluation matrix
cofounder_evaluation = {
    "required": {
        "skill_complementarity": {
            "description": "Do they have skills you lack?",
            "weight": 5,
            "red_flag": "Completely overlapping skill sets"
        },
        "commitment": {
            "description": "Can they join full-time?",
            "weight": 5,
            "red_flag": "Side-project level commitment"
        },
        "value_alignment": {
            "description": "Do they share views on company direction and working style?",
            "weight": 5,
            "red_flag": "Significantly different risk tolerance"
        },
        "reliability": {
            "description": "Track record; do they keep their word?",
            "weight": 5,
            "red_flag": "No prior experience working together"
        },
    },
    "recommended": {
        "domain_knowledge": {
            "description": "Deep understanding of the target market?",
            "weight": 3,
        },
        "network": {
            "description": "Access to investors, customers, and hiring candidates?",
            "weight": 3,
        },
        "stress_tolerance": {
            "description": "Can they stay calm in difficult situations?",
            "weight": 4,
        },
        "communication": {
            "description": "Can they resolve disagreements constructively?",
            "weight": 4,
        },
    },
    "pre_checks": [
        "1. Allow at least 2-3 months of working together before founding (don't rush into it)",
        "2. Document and agree on the following:",
        "   - Each person's role and responsibilities",
        "   - Equity split and vesting schedule",
        "   - Share buyback terms upon departure",
        "   - Decision-making rules when opinions diverge",
        "   - When full-time commitment begins",
        "3. Discuss difficult scenarios:",
        "   - What to do if funding runs out",
        "   - How to decide when a pivot is needed",
        "   - Arrangements if one party wants to exit",
    ]
}
```

### 1.4 Incorporation in Practice

```python
# Incorporating an AI startup in Japan
incorporation_guide = {
    "steps_for_joint_stock_company": {
        "step_1": {
            "name": "Draft Articles of Incorporation",
            "details": [
                "Decide on the company name",
                "State the business purpose (AI software development, SaaS provision, etc.)",
                "Decide on the registered address",
                "Set authorized shares (set high to allow future capital increases)",
                "Decide shares issued at incorporation",
            ],
            "tips": "Set the business purpose broadly, e.g., 'Development and sale of software related to artificial intelligence'",
            "cost": "Notary certification fee: approx. ¥32,000–¥52,000"
        },
        "step_2": {
            "name": "Notarize Articles of Incorporation",
            "details": [
                "Have articles certified at a notary office",
                "Electronic articles of incorporation waive ¥40,000 stamp duty",
            ],
            "cost": "Electronic articles: approx. ¥32,000"
        },
        "step_3": {
            "name": "Pay in Capital",
            "details": [
                "Transfer capital into the founder's personal account",
                "Prepare a payment certificate",
            ],
            "tips": "¥1M–¥3M is typical; too little can hurt credibility"
        },
        "step_4": {
            "name": "File for Registration",
            "details": [
                "File incorporation registration at the Legal Affairs Bureau",
                "Registration tax: ¥150,000 (0.7% of capital, minimum ¥150,000)",
            ],
            "cost": "Registration tax: ¥150,000"
        },
        "step_5": {
            "name": "Post-Incorporation Filings",
            "details": [
                "Tax office: Corporate establishment notification, blue-return application",
                "Prefectural tax office: Corporate establishment notification",
                "Pension office: Health insurance and employees' pension enrollment",
                "Bank: Open a corporate account",
            ]
        }
    },
    "total_cost": "Approx. ¥240,000–¥250,000 (with electronic articles of incorporation)",
    "timeline": "2–4 weeks from preparation to registration completion",
    "recommended_services": [
        "freee Company Incorporation (free articles of incorporation support)",
        "Money Forward Company Incorporation",
        "Bengo4.com (legal consultation)",
    ]
}
```

---

## 2. Fundraising

### 2.1 Funding Stage Overview

| Stage | Amount | Valuation | Key Investors | Requirements |
|-------|--------|-----------|---------------|--------------|
| Pre-Seed | ¥5M–¥30M | ~¥100M | Angels, Accelerators | Idea + Team |
| Seed | ¥30M–¥200M | ¥300M–¥1B | Seed-focused VCs | MVP + Initial Traction |
| Series A | ¥200M–¥1B | ¥2B–¥5B | VC (Lead investor) | PMF + Growth Metrics |
| Series B | ¥1B–¥5B | ¥10B–¥30B | Growth VCs | Scaling Track Record |

### 2.2 Pitch Deck Structure

```
AI Startup Pitch Deck (12-slide structure):

  Slide 1: Title
  ┌──────────────────────────────────────┐
  │ [Company Name] — [1-line mission]    │
  │ "Make XX 10x more efficient with AI" │
  └──────────────────────────────────────┘

  Slide 2: Problem
  ┌──────────────────────────────────────┐
  │ Express pain with concrete numbers   │
  │ "Companies waste ¥XXM/year on XX"    │
  └──────────────────────────────────────┘

  Slide 3: Solution
  ┌──────────────────────────────────────┐
  │ Demo screen or video                 │
  │ Visualize impact with Before/After   │
  └──────────────────────────────────────┘

  Slide 4: Why Now
  ┌──────────────────────────────────────┐
  │ Arrival of GPT-4/Claude, cost drops  │
  │ Regulatory changes, market maturity  │
  └──────────────────────────────────────┘

  Slide 5: Market
  ┌──────────────────────────────────────┐
  │ TAM → SAM → SOM funnel               │
  │ Bottom-up calculation is trusted     │
  └──────────────────────────────────────┘

  Slide 6: Product
  ┌──────────────────────────────────────┐
  │ Feature overview, technical moat     │
  │ Concrete AI utilization mechanism    │
  └──────────────────────────────────────┘

  Slide 7: Traction
  ┌──────────────────────────────────────┐
  │ MRR growth, user count, growth rate  │
  │ Customer testimonials (with numbers) │
  └──────────────────────────────────────┘

  Slide 8: Business Model
  ┌──────────────────────────────────────┐
  │ Pricing structure, unit economics    │
  │ LTV/CAC, gross margin                │
  └──────────────────────────────────────┘

  Slide 9: Competition
  ┌──────────────────────────────────────┐
  │ Positioning map                      │
  │ Visualize your unique position on    │
  │ 2 axes                               │
  └──────────────────────────────────────┘

  Slide 10: Team
  ┌──────────────────────────────────────┐
  │ Founder backgrounds, why this team   │
  │ Highlight AI/ML expertise            │
  └──────────────────────────────────────┘

  Slide 11: Financials
  ┌──────────────────────────────────────┐
  │ 3-year P&L forecast                  │
  │ Key KPI trajectory forecast          │
  └──────────────────────────────────────┘

  Slide 12: Ask
  ┌──────────────────────────────────────┐
  │ Amount, use of funds, next milestone │
  │ "Raise ¥XB → achieve XX → Series A" │
  └──────────────────────────────────────┘
```

### 2.3 Pitch Deck Creation Know-How

```python
# Pitch deck quality checklist
pitch_deck_quality_check = {
    "overall": {
        "total_slides": "10-15 slides (12 is ideal)",
        "presentation_time": "Explainable in under 10 minutes",
        "design": "Simple, one message per slide, minimal text",
        "font_size": "Minimum 24pt (readable when projected)",
    },
    "slide_by_slide_tips": {
        "problem": [
            "Include a real personal anecdote",
            "Show the scale of the problem with numbers (¥XXB in annual losses, etc.)",
            "Use statistics like 'XX% of companies face this problem'",
        ],
        "solution": [
            "Include product demo screens (most important)",
            "Show Before/After contrast",
            "Deep-dive on technical mechanisms in a separate slide",
        ],
        "market": [
            "Always include bottom-up calculations",
            "TAM: Total global potential market (reference figure)",
            "SAM: Market actually reachable",
            "SOM: Market you aim to capture within 3 years",
            "Bottom-up example: 4M Japanese SMBs × 10% addressable rate × ARPU ¥5,000 × 12 months = SAM ¥24B",
        ],
        "traction": [
            "An upward-trending graph is most persuasive",
            "SaaS metrics: MRR, user count, NRR, etc.",
            "Direct customer quotes (with specific effect numbers)",
            "Logo wall (notable customer deployments)",
        ],
        "team": [
            "Clearly articulate 'why this team can win'",
            "AI/ML expertise (papers, patents, prior work achievements)",
            "Entrepreneurship experience, industry experience",
            "Advisor names (if well-known)",
        ],
        "ask": [
            "State the raise amount specifically",
            "Breakdown of use of funds (e.g., 60% personnel, 20% marketing, 10% infra, 10% reserve)",
            "Post-raise milestones (hire XX people, reach MRR XX, etc.)",
            "Plan through to next round",
        ]
    },
    "common_mistakes": [
        "Too much text (more than 3 lines per slide)",
        "Writing 'no competitors' on the competition slide → interpreted as no market",
        "Showing only TAM without SOM → lacks realism",
        "Financial projections are too hockey-stick shaped → asked for justification",
        "No demo screens → raises doubts about product existence",
    ]
}
```

### 2.4 Financial Model

```python
class StartupFinancialModel:
    """AI Startup Financial Model"""

    def project_3_years(self, params: dict) -> list[dict]:
        """3-year financial forecast"""
        results = []
        mrr = params["initial_mrr"]
        users = params["initial_users"]
        team_size = params["initial_team"]

        for month in range(1, 37):
            year = (month - 1) // 12 + 1

            # Growth rate (declining year-over-year)
            growth_rates = {1: 0.20, 2: 0.12, 3: 0.08}
            monthly_growth = growth_rates[year]

            # Churn rate (improving trend)
            churn_rates = {1: 0.06, 2: 0.04, 3: 0.03}
            churn_rate = churn_rates[year]

            # User count calculation
            new_users = int(users * monthly_growth)
            churned = int(users * churn_rate)
            users = users + new_users - churned

            # MRR calculation
            arpu = params["arpu"] * (1 + 0.02 * (month - 1))  # Gradual ARPU increase
            mrr = users * arpu

            # Cost calculation
            # Team expansion (1-2 people per quarter)
            if month % 3 == 0 and month > 6:
                team_size += params.get("quarterly_hires", 1)

            personnel_cost = team_size * params["avg_salary"]
            api_cost = mrr * 0.25  # 25% of revenue
            infra_cost = 50000 + users * 200  # fixed + variable
            other_cost = 200000  # office, tools, etc.

            total_cost = personnel_cost + api_cost + infra_cost + other_cost

            results.append({
                "month": month,
                "year": year,
                "users": users,
                "mrr": int(mrr),
                "arr": int(mrr * 12),
                "team_size": team_size,
                "total_cost": int(total_cost),
                "profit": int(mrr - total_cost),
                "burn_rate": int(max(0, total_cost - mrr))
            })

        return results

# Usage example
model = StartupFinancialModel()
projection = model.project_3_years({
    "initial_mrr": 500000,
    "initial_users": 100,
    "initial_team": 3,
    "arpu": 5000,
    "avg_salary": 600000,
    "quarterly_hires": 2
})
# Year 3: ARR ~¥300M, team of 20, profitable
```

### 2.5 Unit Economics Calculation

```python
class UnitEconomics:
    """SaaS Unit Economics Calculator"""

    def __init__(
        self,
        arpu: float,          # Average monthly revenue per user
        monthly_churn: float,  # Monthly churn rate
        cac: float,           # Customer acquisition cost
        gross_margin: float,   # Gross margin
    ):
        self.arpu = arpu
        self.monthly_churn = monthly_churn
        self.cac = cac
        self.gross_margin = gross_margin

    @property
    def ltv(self) -> float:
        """Customer lifetime value"""
        if self.monthly_churn == 0:
            return float('inf')
        return (self.arpu * self.gross_margin) / self.monthly_churn

    @property
    def ltv_cac_ratio(self) -> float:
        """LTV/CAC ratio (healthy at 3 or above)"""
        if self.cac == 0:
            return float('inf')
        return self.ltv / self.cac

    @property
    def payback_months(self) -> float:
        """CAC payback period (months)"""
        monthly_contribution = self.arpu * self.gross_margin
        if monthly_contribution == 0:
            return float('inf')
        return self.cac / monthly_contribution

    @property
    def average_lifetime_months(self) -> float:
        """Average customer lifetime (months)"""
        if self.monthly_churn == 0:
            return float('inf')
        return 1 / self.monthly_churn

    def health_check(self) -> dict:
        """Unit economics health check"""
        checks = {
            "LTV/CAC Ratio": {
                "value": round(self.ltv_cac_ratio, 1),
                "threshold": 3.0,
                "status": "healthy" if self.ltv_cac_ratio >= 3.0 else "warning",
                "note": "Healthy at 3+, excellent at 5+"
            },
            "CAC Payback Period": {
                "value": round(self.payback_months, 1),
                "threshold": 12,
                "status": "healthy" if self.payback_months <= 12 else "warning",
                "note": "Ideal within 12 months"
            },
            "Gross Margin": {
                "value": round(self.gross_margin * 100, 1),
                "threshold": 70,
                "status": "healthy" if self.gross_margin >= 0.70 else "warning",
                "note": "70%+ for SaaS; 60-80% for AI SaaS due to API costs"
            },
            "Monthly Churn Rate": {
                "value": round(self.monthly_churn * 100, 2),
                "threshold": 5,
                "status": "healthy" if self.monthly_churn <= 0.05 else "warning",
                "note": "Below 5% for SMB, below 2% for enterprise"
            }
        }
        return checks

    def __repr__(self) -> str:
        return (
            f"UnitEconomics(\n"
            f"  ARPU=¥{self.arpu:,.0f}/month,\n"
            f"  LTV=¥{self.ltv:,.0f},\n"
            f"  CAC=¥{self.cac:,.0f},\n"
            f"  LTV/CAC={self.ltv_cac_ratio:.1f}x,\n"
            f"  Payback={self.payback_months:.1f} months,\n"
            f"  Avg Lifetime={self.average_lifetime_months:.0f} months\n"
            f")"
        )


# Typical unit economics for an AI SaaS
saas_economics = UnitEconomics(
    arpu=8000,           # Monthly ¥8,000
    monthly_churn=0.04,  # Monthly churn 4%
    cac=30000,           # Customer acquisition cost ¥30,000
    gross_margin=0.75,   # Gross margin 75%
)

print(saas_economics)
# ARPU=¥8,000/month, LTV=¥150,000, CAC=¥30,000, LTV/CAC=5.0x

health = saas_economics.health_check()
for metric, data in health.items():
    print(f"{metric}: {data['value']} ({'OK' if data['status'] == 'healthy' else 'WARN'})")
```

### 2.6 How to Approach Investors

```python
# Practical guide to approaching investors
investor_approach = {
    "preparation": {
        "target_list": {
            "description": "Build an investor list (50+ firms)",
            "sources": [
                "Research past investment history on INITIAL (Japan startup DB)",
                "Search Crunchbase for VCs with AI/SaaS investment track records",
                "Check individual investor profiles on LinkedIn",
                "Introductions from other founders (most effective)",
            ],
            "prioritization": [
                "Tier 1: AI/SaaS-focused VC + warm introduction",
                "Tier 2: Generalist VC + warm introduction",
                "Tier 3: AI/SaaS-focused VC + cold approach",
                "Tier 4: Other",
            ]
        },
        "warm_intro": {
            "description": "How to get warm introductions",
            "tactics": [
                "Ask existing founder networks for referrals",
                "Get introduced via founders of portfolio companies",
                "Through accelerators (Y Combinator, Plug and Play, etc.)",
                "Build relationships directly at events and conferences",
                "Find mutual connections on LinkedIn and request introductions",
            ]
        }
    },
    "meetings": {
        "first_meeting": {
            "duration": "30-45 minutes",
            "structure": [
                "Introductions (2 min)",
                "Pitch (10-15 min)",
                "Q&A (15-20 min)",
                "Confirm next steps (5 min)",
            ],
            "tips": [
                "Hook the investor in the first 5 minutes",
                "Speak in numbers (MRR, growth rate, NPS, etc.)",
                "Say 'I don't know' honestly (lies get caught)",
                "Answer questions concisely (don't ramble)",
            ]
        },
        "common_questions": [
            "Why did you start this business now? (motivation)",
            "What is the biggest risk? (self-awareness)",
            "How dependent are you on AI models? What is your unique advantage?",
            "Why do existing customers churn?",
            "How are you differentiated from competitors?",
            "What is your exit scenario in 3 years?",
            "How do you prove the team's technical ability?",
            "What will you achieve with this round's capital?",
        ]
    },
    "timeline": {
        "description": "Typical fundraising process timeline",
        "phases": {
            "Preparation": "2-4 weeks (pitch deck, financial model, DD materials)",
            "Outreach": "2-4 weeks (contact 50+ firms)",
            "Meetings": "4-8 weeks (1st meeting → 2nd meeting → partner meeting)",
            "DD & Negotiation": "2-4 weeks (due diligence, term sheet negotiation)",
            "Closing": "2-4 weeks (contracts, funds received)",
        },
        "total": "3-5 months (Seed), 4-6 months (Series A)"
    }
}
```

---

## 3. Team Building

### 3.1 AI Startup Organizational Structure

```
AI Startup Organization (30-person scale):

  ┌──────────────┐
  │    CEO       │
  └──────┬───────┘
    ┌────┼──────────────────┐
    ▼    ▼                  ▼
  ┌────┐ ┌──────┐       ┌────┐
  │CTO │ │VP Eng│       │COO │
  └─┬──┘ └──┬───┘       └─┬──┘
    │       │              │
  AI/ML   Engineering    Business
  (5)     (10)           (10)
  ┌────┐  ┌──────┐      ┌──────┐
  │ML  │  │Frontend│    │Sales │
  │Eng │  │(3)    │    │(3)   │
  │(2) │  ├──────┤    ├──────┤
  ├────┤  │Backend│    │Mktg  │
  │Data│  │(3)    │    │(3)   │
  │Eng │  ├──────┤    ├──────┤
  │(2) │  │DevOps │    │CS    │
  ├────┤  │(2)    │    │(2)   │
  │Rsch│  ├──────┤    ├──────┤
  │(1) │  │QA     │    │Ops   │
  └────┘  │(2)    │    │(2)   │
          └──────┘    └──────┘
```

### 3.2 Hiring Priority

| Order | Position | Reason | When to Hire |
|-------|----------|---------|--------------|
| 1 | Full-stack Engineer | Rapid MVP development | Immediately after founding |
| 2 | AI/ML Engineer | Improve AI feature quality | Around PMF |
| 3 | Designer (UI/UX) | UX improvement → conversion uplift | After PMF |
| 4 | Marketer | Accelerate growth | After PMF |
| 5 | Customer Success | Reduce churn | After 50 customers |
| 6 | Sales | Enterprise expansion | Around Series A |
| 7 | Data Engineer | Build data infrastructure | Growth phase |
| 8 | HR | Recruiting and org management | After 15 people |

### 3.3 Hiring Strategy

```python
class AITalentStrategy:
    """AI Talent Hiring Strategy"""

    def create_hiring_plan(self, stage: str) -> dict:
        """Stage-based hiring plan"""
        plans = {
            "pre_seed": {
                "team_size": "2-3 people (founding team)",
                "hiring_channels": [
                    "Co-founder networks",
                    "Former colleagues from previous jobs",
                    "Connections from hackathons"
                ],
                "compensation": {
                    "cash": "60-70% of market rate",
                    "equity": "5-15% (co-founders), 1-3% (early employees)",
                    "note": "Supplement with equity"
                }
            },
            "seed": {
                "team_size": "5-10 people",
                "hiring_channels": [
                    "AngelList / LAPRAS / Findy",
                    "Tech conferences",
                    "OSS contributors",
                    "Referrals (most effective)"
                ],
                "compensation": {
                    "cash": "80-90% of market rate",
                    "equity": "0.5-2%",
                    "note": "Hire through mission alignment"
                }
            },
            "series_a": {
                "team_size": "15-30 people",
                "hiring_channels": [
                    "Recruiting agencies",
                    "Direct LinkedIn outreach",
                    "Tech blog / conference talks",
                    "Referral bonus program"
                ],
                "compensation": {
                    "cash": "90-110% of market rate",
                    "equity": "0.1-0.5%",
                    "note": "Competitive compensation"
                }
            }
        }
        return plans.get(stage, plans["seed"])

    def interview_process(self) -> dict:
        """Interview process for AI talent"""
        return {
            "stage_1_screening": {
                "duration": "30 minutes",
                "interviewer": "HR or hiring engineer",
                "focus": [
                    "Overview of experience and skills",
                    "Motivation and culture fit",
                    "Expected salary and start date",
                ],
                "pass_rate": "40-50%"
            },
            "stage_2_technical": {
                "duration": "60-90 minutes",
                "interviewer": "CTO or senior engineer",
                "focus": [
                    "In-depth technical questions",
                    "Details of past projects",
                    "Live coding or take-home assignment",
                ],
                "ai_specific_questions": [
                    "Experience designing RAG systems",
                    "Prompt engineering methods",
                    "LLM evaluation and improvement approaches",
                    "Experience optimizing AI API costs",
                ],
                "pass_rate": "30-40%"
            },
            "stage_3_culture": {
                "duration": "45 minutes",
                "interviewer": "CEO or team member",
                "focus": [
                    "Value alignment",
                    "Team chemistry",
                    "Growth mindset and learning attitude",
                ],
                "pass_rate": "60-70%"
            },
            "stage_4_offer": {
                "timeline": "Send offer within 3 business days of final interview",
                "contents": [
                    "Annual salary (base + bonus)",
                    "Stock option grant size and exercise price",
                    "Vesting schedule",
                    "Start date",
                    "Other benefits",
                ],
            }
        }
```

### 3.4 Stock Option Design

```python
# Stock option (SO) design guide
stock_option_guide = {
    "pool_design": {
        "total_pool": "Reserve 10-15% of issued shares for SOs",
        "allocation_guideline": {
            "CxO (post-founding joiner)": "1-3%",
            "VP/Director": "0.5-1%",
            "Senior Engineer": "0.3-0.5%",
            "Mid-level": "0.1-0.3%",
            "Junior": "0.05-0.1%",
        },
        "note": "More for early members, less for later joiners"
    },
    "vesting": {
        "standard": "4-year vesting, 1-year cliff",
        "example": {
            "total_shares": 10000,
            "vesting_period": "48 months",
            "cliff": "12 months (25% becomes exercisable at 1 year)",
            "monthly_vesting": "After cliff, 2.08% becomes exercisable each month",
            "acceleration": "Consider single/double trigger clauses upon M&A",
        }
    },
    "taxation": {
        "qualified_SO": {
            "conditions": [
                "Exercise price ≥ fair market value at time of grant",
                "Exercised between 2 and 10 years from grant resolution date",
                "Annual exercise limit ¥12M",
                "Specific issuance procedures followed",
            ],
            "tax_rate": "Approx. 20% upon share sale (capital gains)",
        },
        "non_qualified_SO": {
            "conditions": "Does not meet qualified SO requirements",
            "tax_rate": "Up to 55% upon exercise (taxed as employment income)",
        },
        "tip": "Always consult a tax accountant and attorney to design qualified SOs"
    }
}
```

---

## 4. Negotiating with Investors

### 4.1 How Valuations Are Determined

```
Valuation methods:

  Method 1: Comparable company analysis (most common)
  ┌──────────────────────────────────────┐
  │ Valuation = ARR × Multiple           │
  │                                      │
  │ AI SaaS Seed: ARR × 30-50x           │
  │ AI SaaS Series A: ARR × 20-40x       │
  │                                      │
  │ Example: ARR ¥50M × 30 = Valuation ¥1.5B │
  └──────────────────────────────────────┘

  Method 2: Back-calculation from next round
  ┌──────────────────────────────────────┐
  │ Target Series A valuation: ¥3B       │
  │ → Appropriate Seed valuation: ¥500M–¥1B │
  │ → Raise ¥100M–¥200M (15-20% dilution)│
  └──────────────────────────────────────┘

  Method 3: VC expected return method
  ┌──────────────────────────────────────┐
  │ VCs expect 10x returns               │
  │ → Business with ¥10B exit potential  │
  │ → Seed valuation = ¥10B / 10 = ¥1B  │
  └──────────────────────────────────────┘
```

### 4.2 Key Term Sheet Provisions

```python
# Key provisions in a term sheet (investment conditions document)
term_sheet_key_terms = {
    "valuation_related": {
        "pre_money_valuation": {
            "description": "Company valuation before investment",
            "negotiation_tip": "Negotiate pre-money higher. Always calculate dilution percentage"
        },
        "investment_amount": {
            "description": "Investment amount",
            "negotiation_tip": "Target an amount that secures 18 months of runway"
        },
    },
    "investor_rights": {
        "liquidation_preference": {
            "description": "Liquidation preference (distribution rules upon exit)",
            "types": {
                "non_participating_1x": "Greater of investment amount or pro-rata share (standard)",
                "participating_1x": "Recover investment first + remaining pro-rata (investor-favorable)",
                "participating_2x": "Recover 2x investment first + remaining (very investor-favorable)",
            },
            "negotiation_tip": "Non-participating 1x is most fair to founders"
        },
        "anti_dilution": {
            "description": "Anti-dilution provision (protection in down rounds)",
            "types": {
                "weighted_average": "Weighted average method (standard)",
                "full_ratchet": "Full ratchet (very investor-favorable, avoid)",
            }
        },
        "board_seats": {
            "description": "Board of directors seats",
            "typical": "Seed: 1 investor seat, 2 founder seats (3-person board)",
            "negotiation_tip": "Important for founders to maintain majority"
        },
    },
    "founder_protections": {
        "founder_vesting": {
            "description": "Founder share vesting",
            "typical": "4-year vesting, 1-year cliff, credit for time already elapsed",
            "negotiation_tip": "Negotiate to receive credit for time since founding"
        },
        "drag_along": {
            "description": "Drag-along right (forced sale right)",
            "negotiation_tip": "Set triggering conditions (e.g., minimum valuation threshold)"
        },
        "protective_provisions": {
            "description": "Investor veto rights (consent rights on major matters)",
            "typical_items": [
                "New share issuance",
                "Articles of incorporation amendments",
                "M&A and liquidation",
                "Major changes to officer compensation",
                "Borrowings above a certain amount",
            ]
        }
    }
}
```

### 4.3 Responding to Due Diligence

```python
# Documents required for due diligence (DD)
dd_documents = {
    "legal": [
        "Articles of incorporation (latest version)",
        "Corporate registration certificate",
        "Shareholder register",
        "Shareholder agreement",
        "Stock option grant resolutions and allocation table",
        "Key contracts (customers, partners, employees)",
        "List of intellectual property (patents, trademarks, etc.)",
        "Status of any litigation or disputes",
    ],
    "financial": [
        "Past financial statements (BS, PL, CF)",
        "Monthly trial balance (last 12 months)",
        "Bank balance certificates",
        "List of outstanding loans",
        "3-year financial forecast model",
        "Key KPI trend data",
    ],
    "business": [
        "Business plan",
        "Customer list (company names and contract details)",
        "MRR/ARR trend data",
        "Churn rate trends",
        "Customer acquisition cost (CAC) data",
        "Competitive analysis materials",
    ],
    "technical": [
        "Technical architecture overview diagram",
        "AI/ML model overview and accuracy metrics",
        "Data collection and management policy",
        "Security measures overview",
        "Explanation of external API dependencies",
        "Technology roadmap",
    ],
    "hr": [
        "Organizational chart",
        "Employee list (name, title, start date, compensation)",
        "Hiring plan",
        "Work rules",
        "Status of any labor disputes",
    ],
    "preparation_tips": [
        "Organize DD materials in a data room (Google Drive, etc.) in advance",
        "Allow access to confidential information only after NDA execution",
        "Target responding to questions within 48 hours",
        "Say 'I'll confirm' honestly when unsure",
        "Secure support from attorneys and tax accountants in advance",
    ]
}
```

---

## 5. Organizational Scaling

### 5.1 Organizational Challenges by Phase

```
Typical organizational scaling challenges:

  ■ 5→15 people: From "generalists" to "specialized teams"
  ┌──────────────────────────────────────┐
  │ Challenges:                          │
  │ ● Clarifying role boundaries         │
  │ ● Rising communication costs         │
  │ ● Changing roles of founding members │
  │                                      │
  │ Solutions:                           │
  │ ● Introduce clear team structure     │
  │ ● Weekly all-hands meetings          │
  │ ● Regular 1-on-1s                    │
  │ ● Establish documentation culture    │
  └──────────────────────────────────────┘

  ■ 15→30 people: From "unspoken understanding" to "process"
  ┌──────────────────────────────────────┐
  │ Challenges:                          │
  │ ● Sharing tacit knowledge becomes    │
  │   difficult                          │
  │ ● Hiring and onboarding burden       │
  │ ● Shortage of management layer       │
  │                                      │
  │ Solutions:                           │
  │ ● Hire/develop middle management     │
  │ ● Build onboarding program           │
  │ ● Introduce OKRs or similar goal     │
  │   management framework               │
  │ ● Enrich internal wiki               │
  └──────────────────────────────────────┘

  ■ 30→100 people: From "startup" to "organization"
  ┌──────────────────────────────────────┐
  │ Challenges:                          │
  │ ● Siloing between departments        │
  │ ● Culture dilution                   │
  │ ● Decision-making delays             │
  │                                      │
  │ Solutions:                           │
  │ ● Build out VP/Director layer        │
  │ ● Articulate and embed values        │
  │ ● Encourage cross-functional teams   │
  │ ● Clarify delegation and             │
  │   accountability                     │
  └──────────────────────────────────────┘
```

### 5.2 Engineering Organization Design

```python
# Engineering organization design patterns
engineering_org = {
    "under_10": {
        "structure": "Flat (everyone at the same level)",
        "communication": "Everyone knows everything",
        "sprint": "One team, 1-2 week sprints",
        "code_review": "Everyone reviews everyone else",
    },
    "10-25": {
        "structure": "Functional teams (Frontend, Backend, AI/ML)",
        "communication": "Regular cross-team meetings",
        "sprint": "Team-level sprints, shared release cycle",
        "code_review": "In-team review + cross-team review",
        "key_hires": ["Tech lead × 2-3", "Engineering Manager (EM) × 1"],
    },
    "25-50": {
        "structure": "Squad model (cross-functional teams)",
        "model": [
            "Squad: per product feature (5-7 people)",
            "Chapter: per technical domain (Frontend, Backend, AI)",
            "Tribe: group of related squads",
        ],
        "communication": "Autonomous squads + weekly cross-tribe sync",
        "key_hires": ["VP of Engineering", "EM × 3-5", "Staff Engineer"],
    }
}
```

### 5.3 Building Culture and Values

```python
# Sample values design for an AI startup
company_values = {
    "values": [
        {
            "name": "Ship Fast, Learn Fast",
            "description": "Ship quickly and learn, rather than chasing perfection",
            "behaviors": [
                "Release at 80% completion",
                "Share failures as learnings, not criticisms",
                "Run many small experiments",
            ]
        },
        {
            "name": "User Obsession",
            "description": "Make every decision from the user's perspective",
            "behaviors": [
                "Conduct regular user interviews",
                "Have everyone read support tickets",
                "Start feature development from user problems",
            ]
        },
        {
            "name": "Radical Transparency",
            "description": "Default to sharing information openly",
            "behaviors": [
                "Share MRR, churn rate, and other numbers with all employees",
                "Document and share the reasons behind decisions",
                "Give feedback directly and candidly",
            ]
        },
        {
            "name": "AI-First Thinking",
            "description": "Always ask: 'Can AI automate this?'",
            "behaviors": [
                "Actively automate repetitive tasks with AI",
                "Consider AI utilization first when planning new features",
                "Keep up with the latest AI technology trends",
            ]
        },
    ],
    "implementation": [
        "Confirm value alignment during hiring interviews",
        "Include value embodiment in performance reviews",
        "Share examples of values in action at all-hands meetings",
        "Distribute value cards to all employees",
    ]
}
```

---

## 6. Anti-Patterns

### Anti-Pattern 1: Fundraising Becomes the Goal

```python
# BAD: Believing bigger raises mean more success
bad_fundraising = {
    "goal": "Raise as much as possible",
    "raised": "¥1B (valuation ¥5B)",
    "problem": "Raised a massive amount before PMF → expectations too high to pivot",
    "burn_rate": "¥50M/month → runway exhausted in 20 months",
    "result": "Down round or shutdown without achieving PMF"
}

# GOOD: Raise only what's needed at the right time
good_fundraising = {
    "goal": "Raise only what the next milestone requires",
    "raised": "¥50M (valuation ¥300M)",
    "milestone": "Achieve PMF + MRR ¥5M",
    "burn_rate": "¥3M/month → 16 months of runway",
    "result": "Achieve PMF → raise Series A on favorable terms"
}
```

### Anti-Pattern 2: Over-Weighting Technical Talent

```python
# BAD: Hiring only engineers
bad_team = {
    "composition": "CEO (technical) + 8 engineers",
    "problem": "Great product but nobody knows about it",
    "result": "Zero users, out of money"
}

# GOOD: Balanced team
good_team = {
    "composition": "CEO + CTO + 3 engineers + 1 marketer + 1 CS",
    "balance": "5 dev : 2 business ratio",
    "result": "Both product and growth achieved"
}
```

### Anti-Pattern 3: Rapid Organizational Expansion

```python
# BAD: Hiring aggressively before PMF
bad_scaling = {
    "trigger": "Series A close",
    "action": "Expand from 5 to 30 people in 3 months",
    "problems": [
        "Personnel costs spike without PMF",
        "Onboarding of new members can't keep up",
        "Founding members overwhelmed with management tasks",
        "Culture dilutes and team cohesion is lost",
    ],
    "result": "Burn rate spikes, organizational chaos, risk of layoffs"
}

# GOOD: Gradual expansion tied to PMF
good_scaling = {
    "trigger": "PMF achieved + stable growth rate confirmed",
    "action": "Planned hiring of 3-5 people per quarter",
    "practices": [
        "Standardize hiring process (including interviewer training)",
        "Develop onboarding program",
        "Set 30-60-90 day goals",
        "Introduce mentorship program",
    ],
    "result": "Organization grows stably with culture maintained"
}
```

### Anti-Pattern 4: Excessive Dependency on AI Models

```python
# BAD: Complete dependence on a single AI model
bad_ai_dependency = {
    "architecture": "All features directly depend on GPT-4 API",
    "risks": [
        "Large API price increase → gross margin disappears overnight",
        "API outage → entire service goes down",
        "Model update → prompts need complete redesign",
        "Terms of service changes → business model no longer viable",
    ]
}

# GOOD: AI provider-agnostic architecture
good_ai_architecture = {
    "design_principles": [
        "Wrap AI calls in an abstraction layer",
        "Multi-provider fallback configuration",
        "Externalize prompt management (do not hardcode)",
        "Output quality evaluation and monitoring pipeline",
    ],
    "implementation": {
        "abstraction_layer": "AIServiceInterface → Claude / GPT-4 / Gemini",
        "fallback": "Primary → Secondary → Cached Response",
        "cost_control": "Model routing (Haiku for simple tasks, Sonnet for complex tasks)",
    }
}
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Write test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Missing or invalid config file | Verify config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Review error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use log output and debuggers to verify hypotheses
5. **Fix and regression test**: After fixing, run tests for related areas as well

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger setup
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps to diagnose performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O waits**: Examine disk and network I/O conditions
4. **Check concurrent connections**: Check connection pool status

| Problem Type | Diagnostic Tool | Solution |
|--------------|----------------|----------|
| High CPU | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |
---

## 7. FAQ

### Q1: What is the optimal legal entity type for an AI startup?

**A:** If you plan to raise outside funding, a joint-stock company (Kabushiki Kaisha) is the clear choice. (1) LLCs (Godo Kaisha) have difficulty accepting VC investment (cannot issue shares); (2) In Japan, the cost to incorporate a joint-stock company is about ¥250,000 (vs. about ¥100,000 for an LLC); (3) For early stages, services like freee Company Incorporation can simplify the process. Some founders incorporate a US entity (Delaware C-Corp), but this is only recommended if you are planning global expansion from the outset.

### Q2: How should equity be split with co-founders?

**A:** Common split examples: (1) 2-person team: 55:45 or 60:40 (more to the lead); (2) 3-person team: 40:30:30 or 35:35:30. Vesting (4 years, 1-year cliff) is mandatory. Avoid equal splits (50:50) due to the risk of deadlock in decision-making. Y Combinator recommends near-equal splits while advising that there should be a single final decision-maker.

### Q3: Which VCs in Japan focus on AI?

**A:** Key investors: (1) VCs: Coral Capital, DCM Ventures, Globis Capital, DNX Ventures, JAFCO (has AI-focused funds); (2) CVCs: NVIDIA Inception, Google for Startups, Microsoft for Startups; (3) Accelerators: Y Combinator (open to Japanese applicants), Plug and Play Japan. Angel investors are also important at the seed stage.

### Q4: How do I keep the business running while fundraising?

**A:** Fundraising consumes more than 50% of a founder's time. Solutions: (1) Delegate product development authority to the CTO or VP of Engineering; (2) Set a hard deadline for the fundraising process (target closing within 3 months); (3) Batch investor meetings to 2-3 days per week, reserving the rest for business; (4) Templatize pitch deck updates for efficiency.

### Q5: How do I find angel investors?

**A:** Effective approaches: (1) Attend founder events (IVS, B Dash Camp, etc.); (2) Use platforms like AngelList Japan and ANGEL PORT; (3) Introductions from existing founders (highest success rate); (4) Direct messages via LinkedIn/Twitter/X; (5) Participate in accelerator programs. Angel investors make decisions faster than VCs and typically invest ¥5M–¥30M. Choosing investors with domain expertise in your space gives you mentoring support beyond just capital.

### Q6: Is it possible to raise from overseas VCs?

**A:** Yes, but additional preparation is required: (1) English pitch deck and financial model; (2) A global expansion story (Japan market → Asia → global); (3) You will often be asked to incorporate as a Delaware C-Corp (possible via Stripe Atlas); (4) Applying to US accelerators like Y Combinator is also effective. Overseas VCs may not understand Japan-specific market risks, so you need to make an especially strong case for market growth potential and your team's execution ability.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Rather than theory alone, your understanding deepens by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Founding preparation | Co-founder selection + incorporation + MVP development |
| Fundraising | Raise only the minimum needed at the right time |
| Pitch deck | 12-slide structure; traction and team are most critical |
| Team building | 5 dev : 2 business balance; referrals are top priority |
| Hiring order | Full-stack → AI/ML → Designer → Marketer |
| Valuation | AI SaaS Seed: ARR × 30-50x as a benchmark |
| Org scaling | Gradual expansion tied to PMF; maintaining culture is key |
| Legal | Shareholder agreements, SO design, term sheet negotiation — always with an attorney |

---

## Guides to Read Next

- [03-future-opportunities.md](./03-future-opportunities.md) — Future opportunities
- [01-solo-developer.md](./01-solo-developer.md) — Starting from solo development
- [../02-monetization/02-scaling-strategy.md](../02-monetization/02-scaling-strategy.md) — Scaling strategy

---

## References

1. **"The Hard Thing About Hard Things" — Ben Horowitz** — The challenges of running a startup and how to handle them
2. **"Venture Deals" — Brad Feld** — The definitive book on VC fundraising structure and negotiation
3. **Y Combinator Startup School** — https://www.startupschool.org — Free startup course
4. **INITIAL (formerly entrepedia)** — https://initial.inc — Japan startup fundraising database
5. **"High Growth Handbook" — Elad Gil** — Organizational management guide for the scaling phase
6. **"An Elegant Puzzle" — Will Larson** — Engineering organization management
