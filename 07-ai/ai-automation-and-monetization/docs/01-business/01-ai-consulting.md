# AI Consulting — Proposals and ROI Calculation

> A practical guide covering the full process of launching and running an AI consulting business: proposal writing, ROI calculation, project delivery, and winning repeat business.

---

## What You Will Learn in This Chapter

1. **Designing an AI Consulting Business** — Strategy for service structure, positioning, and pricing
2. **Proposal and ROI Calculation Skills** — Proposal structure that convinces clients, and quantitative ROI calculation methods
3. **Project Delivery and Trust Building** — From ensuring delivery quality to winning repeat business and referrals
4. **Sales Process and Lead Generation** — A systematic approach from finding prospects to closing deals
5. **Scaling and Organizing** — Growth strategy from solo consultant to organization


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of [AI SaaS — Product Design, MVP, PMF](./00-ai-saas.md)

---

## 1. AI Consulting Business Design

### 1.1 Service Structure

```
┌──────────────────────────────────────────────────────────┐
│           AI Consulting Service Structure                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Tier 1: AI Assessment (Entry Service)                   │
│  ┌──────────────────────────────────────────────┐       │
│  │ Duration: 2-4 weeks  |  Price: 500K-1.5M JPY │       │
│  │ Content: Current state analysis, AI feasibility study, roadmap │
│  └──────────────────────────────────────────────┘       │
│           │                                              │
│           ▼                                              │
│  Tier 2: AI Implementation Support (Core Service)        │
│  ┌──────────────────────────────────────────────┐       │
│  │ Duration: 2-6 months  |  Price: 2M-10M JPY   │       │
│  │ Content: PoC development, system integration, employee training │
│  └──────────────────────────────────────────────┘       │
│           │                                              │
│           ▼                                              │
│  Tier 3: AI Operations & Optimization (Recurring Revenue)│
│  ┌──────────────────────────────────────────────┐       │
│  │ Duration: Monthly contract  |  Price: 300K-1M JPY/month │
│  │ Content: Performance monitoring, model improvement, new feature development │
│  └──────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Positioning Matrix

| Position | Target Company | Unit Price | Competition | Differentiation |
|----------|---------------|-----------|-------------|-----------------|
| Industry Specialist | Specific industry | High | Low | Industry knowledge |
| Technology Specialist | Tech companies | Mid–High | Medium | Technical expertise |
| SMB-Focused | SMB | Low–Mid | High | Price & speed |
| Enterprise | Large companies | Highest | Low | Track record & trust |
| Startup-Focused | VC-backed startups | Medium | Medium | Speed & flexibility |

### 1.3 Annual Revenue Simulation

```python
# AI consulting annual revenue model
revenue_model = {
    "year_1": {
        "tier1_assessments": {
            "count": 12, "avg_price": 1000000,
            "total": 12_000_000
        },
        "tier2_projects": {
            "count": 4, "avg_price": 5000000,
            "total": 20_000_000
        },
        "tier3_retainers": {
            "count": 3, "monthly": 500000, "months": 6,
            "total": 9_000_000
        },
        "annual_revenue": 41_000_000,  # 41M JPY
        "costs": {
            "tools_and_apis": 1_200_000,
            "subcontractors": 8_000_000,
            "marketing": 2_000_000,
            "overhead": 3_000_000,
            "total": 14_200_000
        },
        "profit": 26_800_000,  # 26.8M JPY
        "margin": 65.4  # 65.4%
    }
}
```

### 1.4 Detailed Revenue Growth Model

```python
class ConsultingRevenueModel:
    """Revenue model and growth forecast for AI consulting"""

    def __init__(self):
        self.service_tiers = {
            "assessment": {
                "price_range": (500_000, 1_500_000),
                "duration_weeks": (2, 4),
                "capacity_per_month": 2,
                "conversion_to_tier2": 0.4,
            },
            "implementation": {
                "price_range": (2_000_000, 10_000_000),
                "duration_months": (2, 6),
                "capacity_per_quarter": 2,
                "conversion_to_tier3": 0.6,
            },
            "retainer": {
                "monthly_range": (300_000, 1_000_000),
                "avg_duration_months": 12,
                "churn_rate_monthly": 0.05,
            },
        }

    def project_3_years(self) -> list:
        """3-year revenue forecast"""
        projections = []

        for year in range(1, 4):
            growth_factor = 1 + (year - 1) * 0.5

            assessments = int(12 * growth_factor)
            implementations = int(4 * growth_factor)
            retainers_new = int(3 * growth_factor)

            # Assessment revenue
            assessment_rev = assessments * 1_000_000

            # Implementation project revenue
            impl_avg_price = 5_000_000 * (1 + (year - 1) * 0.2)
            impl_rev = implementations * impl_avg_price

            # Retainer revenue (cumulative effect)
            retainer_monthly = 500_000
            retainer_months = min(12, 6 + year * 2)
            active_retainers = retainers_new + max(0,
                (year - 1) * 2)  # Continuing from previous year
            retainer_rev = active_retainers * retainer_monthly * retainer_months

            total = assessment_rev + impl_rev + retainer_rev

            projections.append({
                "year": year,
                "assessments": assessments,
                "implementations": implementations,
                "active_retainers": active_retainers,
                "assessment_revenue": assessment_rev,
                "implementation_revenue": int(impl_rev),
                "retainer_revenue": int(retainer_rev),
                "total_revenue": int(total),
                "team_size": 1 + year,
            })

        return projections

    def calculate_utilization(self, billable_hours: int,
                               total_hours: int = 2000) -> dict:
        """Calculate utilization rate"""
        utilization = billable_hours / total_hours
        non_billable = {
            "marketing": total_hours * 0.15,
            "admin": total_hours * 0.10,
            "learning": total_hours * 0.10,
            "sales": total_hours * 0.10,
        }

        return {
            "billable_hours": billable_hours,
            "total_hours": total_hours,
            "utilization_rate": round(utilization * 100, 1),
            "target": "65-75% is a healthy range",
            "non_billable_breakdown": non_billable,
        }


# Usage example
model = ConsultingRevenueModel()
projections = model.project_3_years()
for p in projections:
    print(f"Year {p['year']}: Revenue {p['total_revenue']:,} JPY "
          f"(Team size: {p['team_size']})")
```

### 1.5 Sales Process and Lead Generation

```python
class SalesProcess:
    """Sales process for AI consulting"""

    PIPELINE_STAGES = {
        "lead": {
            "description": "Lead acquisition",
            "sources": [
                "Content marketing (blog, speaking engagements)",
                "Referrals and word of mouth",
                "LinkedIn DM",
                "Webinar attendees",
                "Contact form inquiries",
            ],
            "conversion_rate": 0.30,  # → meeting
            "avg_days": 7,
        },
        "discovery": {
            "description": "Listening and problem discovery",
            "activities": [
                "Initial meeting (30-60 minutes)",
                "Deep-dive and structuring of challenges",
                "AI utilization feasibility assessment",
                "Identifying key stakeholders and budget",
            ],
            "conversion_rate": 0.50,  # → proposal
            "avg_days": 14,
        },
        "proposal": {
            "description": "Proposal and estimate",
            "activities": [
                "Proposal document creation (1-2 weeks)",
                "Presentation",
                "Q&A and revisions",
                "Support for internal approval process",
            ],
            "conversion_rate": 0.60,  # → order
            "avg_days": 21,
        },
        "negotiation": {
            "description": "Negotiation and contract",
            "activities": [
                "Price and scope adjustment",
                "Contract review",
                "NDA signing",
                "Purchase order and contract execution",
            ],
            "conversion_rate": 0.80,  # → start
            "avg_days": 14,
        },
    }

    def calculate_pipeline_metrics(self, monthly_leads: int) -> dict:
        """Calculate pipeline metrics"""
        funnel = {"monthly_leads": monthly_leads}
        current = monthly_leads

        for stage, data in self.PIPELINE_STAGES.items():
            converted = int(current * data["conversion_rate"])
            funnel[stage] = {
                "input": current,
                "output": converted,
                "conversion": data["conversion_rate"],
            }
            current = converted

        funnel["monthly_deals"] = current
        funnel["overall_conversion"] = current / max(monthly_leads, 1)

        # Back-calculate required leads
        target_monthly_deals = 2
        required_leads = target_monthly_deals
        for stage in reversed(list(self.PIPELINE_STAGES.values())):
            required_leads = int(required_leads / stage["conversion_rate"])
        funnel["required_leads_for_target"] = required_leads

        return funnel

    @staticmethod
    def create_outreach_templates() -> dict:
        """Sales outreach templates"""
        return {
            "cold_linkedin": {
                "subject": None,
                "body": (
                    "Hi {name},\n\n"
                    "I saw {company}'s {recent_activity}.\n"
                    "Using AI for {use_case}, a similar company {reference_company} "
                    "achieved {result}.\n\n"
                    "Would you have 15 minutes to chat?\n"
                    "I'd love to hear about challenges in your {department} "
                    "and discuss how AI could help."
                ),
                "follow_up_days": [3, 7, 14],
            },
            "warm_introduction": {
                "subject": "Introduction from {introducer_name}",
                "body": (
                    "Hi {name},\n\n"
                    "I was introduced to you by {introducer_name}. "
                    "My name is {my_name}, and I specialize in AI implementation consulting "
                    "with a track record in the {industry} industry.\n\n"
                    "I believe I can propose an AI-based approach to address your {challenge}. "
                    "Would you have 30 minutes for a conversation?"
                ),
            },
            "post_webinar": {
                "subject": "Thank you for attending the webinar",
                "body": (
                    "Hi {name},\n\n"
                    "Thank you for attending our recent webinar \"{webinar_title}\".\n\n"
                    "Regarding the {topic} we introduced, I would be happy to "
                    "discuss AI utilization possibilities specific to your company individually.\n"
                    "We offer a free 30-minute assessment session — "
                    "please let us know if you're interested."
                ),
            },
        }
```

---

## 2. Proposal Writing

### 2.1 Proposal Structure Template

```
AI Implementation Proposal Standard Structure:

  1. Executive Summary          ←  For decision makers (1 page)
     └─ Challenge → Solution → Expected outcome → Investment amount

  2. Current State Analysis     ←  Basis for credibility
     └─ Interview findings → Business workflow → Pain points

  3. AI Utilization Proposal    ←  Technical feasibility
     └─ Solution overview → Architecture → Technology selection

  4. ROI Analysis               ←  Material for management decisions
     └─ Cost estimate → Impact forecast → Payback period

  5. Implementation Plan        ←  Feasibility
     └─ Phase breakdown → Schedule → Team structure

  6. Risks and Countermeasures  ←  Proactive handling of concerns
     └─ Technical risks → Operational risks → Legal risks

  7. Investment & Estimate      ←  Concrete figures
     └─ Initial cost → Running cost → Payment terms
```

### 2.2 Automated Proposal Generation Tool

```python
class ProposalGenerator:
    """AI proposal auto-generation engine"""

    def __init__(self, client):
        self.client = client

    def generate_proposal(self, assessment: dict) -> dict:
        """Auto-generate proposal from assessment results"""
        sections = {}

        # 1. Executive Summary
        sections["executive_summary"] = self._generate_section(
            f"""
Based on the following assessment results, create an executive summary for management:
- Company: {assessment['company']}
- Industry: {assessment['industry']}
- Challenges: {assessment['pain_points']}
- Proposal: {assessment['proposed_solutions']}
Format: Within 1 page following the flow of Challenge → Solution → Expected outcome → Investment amount.
"""
        )

        # 2. ROI Analysis
        roi = self.calculate_roi(assessment)
        sections["roi_analysis"] = roi

        # 3. Implementation Plan
        sections["implementation_plan"] = self._generate_section(
            f"""
Create an implementation plan for the following AI implementation project:
- Solution: {assessment['proposed_solutions']}
- Budget range: {assessment['budget_range']}
- Timeline: {assessment['timeline']}
Format: 3 phases — Phase 1 (PoC) → Phase 2 (Full development) → Phase 3 (Operations).
"""
        )

        return sections

    def calculate_roi(self, assessment: dict) -> dict:
        """ROI calculation"""
        costs = assessment["estimated_costs"]
        benefits = assessment["estimated_benefits"]

        initial_investment = costs["development"] + costs["infrastructure"]
        monthly_cost = costs["api"] + costs["maintenance"]
        monthly_benefit = benefits["time_saved"] + benefits["error_reduction"]

        payback_months = initial_investment / (monthly_benefit - monthly_cost)
        year1_roi = ((monthly_benefit - monthly_cost) * 12 - initial_investment
                     ) / initial_investment * 100

        return {
            "initial_investment": initial_investment,
            "monthly_cost": monthly_cost,
            "monthly_benefit": monthly_benefit,
            "monthly_net": monthly_benefit - monthly_cost,
            "payback_months": round(payback_months, 1),
            "year1_roi": round(year1_roi, 1),
            "year3_total_benefit": (monthly_benefit - monthly_cost) * 36
        }

    def _generate_section(self, prompt: str) -> str:
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
```

### 2.3 Detailed Section-by-Section Proposal Templates

```python
class ProposalTemplates:
    """Detailed templates for each section of a proposal"""

    @staticmethod
    def executive_summary_template(data: dict) -> str:
        """Executive summary template"""
        return f"""
# Executive Summary

## Background and Challenges
{data['company_name']} is facing the challenge of {data['main_challenge']}
in the context of {data['business_context']}.
Currently, {data['current_process']} incurs approximately {data['hours_spent']} hours per month
and approximately {data['annual_cost']:,} JPY annually.

## Proposed Solution
We propose implementing {data['solution_name']}
leveraging AI technology ({data['ai_technology']}).

## Expected Outcomes
- Processing time: {data['time_reduction']}% reduction
- Cost: {data['cost_saving']:,} JPY annual savings
- Quality: {data['quality_improvement']}

## Investment and Payback Period
- Initial investment: {data['initial_cost']:,} JPY
- Monthly operating cost: {data['monthly_cost']:,} JPY
- Payback period: {data['payback_months']} months
- Year 1 ROI: {data['year1_roi']}%
"""

    @staticmethod
    def risk_assessment_template() -> dict:
        """Risk assessment template"""
        return {
            "technical_risks": [
                {
                    "risk": "AI model accuracy does not reach target",
                    "probability": "Medium",
                    "impact": "High",
                    "mitigation": "Verify accuracy at the PoC stage. "
                                  "Consider alternative approaches if target is not met.",
                },
                {
                    "risk": "AI provider API outage",
                    "probability": "Low",
                    "impact": "High",
                    "mitigation": "Multi-provider configuration. "
                                  "Implement fallback functionality.",
                },
                {
                    "risk": "Difficulty integrating with existing systems",
                    "probability": "Medium",
                    "impact": "Medium",
                    "mitigation": "Design with loose coupling via API layer. "
                                  "Phased integration approach.",
                },
            ],
            "operational_risks": [
                {
                    "risk": "Employee resistance to AI",
                    "probability": "High",
                    "impact": "Medium",
                    "mitigation": "Early user involvement from the start. "
                                  "Thorough training program.",
                },
                {
                    "risk": "Insufficient skills of operations staff",
                    "probability": "Medium",
                    "impact": "Medium",
                    "mitigation": "Prepare operations manual. "
                                  "Set a handover period (1-2 months).",
                },
            ],
            "legal_risks": [
                {
                    "risk": "Entering personal information into AI",
                    "probability": "High",
                    "impact": "High",
                    "mitigation": "PII detection and masking. "
                                  "Execute a Data Processing Agreement (DPA).",
                },
                {
                    "risk": "Copyright issues with AI-generated content",
                    "probability": "Low",
                    "impact": "Medium",
                    "mitigation": "Clearly state in terms of use. "
                                  "Require human review of all AI-generated content.",
                },
            ],
        }

    @staticmethod
    def pricing_template() -> dict:
        """Estimate template"""
        return {
            "initial_costs": {
                "assessment": {
                    "description": "Current state analysis and requirements definition",
                    "hours": 40,
                    "rate": 25000,
                    "total": 1_000_000,
                },
                "poc_development": {
                    "description": "PoC development and validation",
                    "hours": 120,
                    "rate": 25000,
                    "total": 3_000_000,
                },
                "production_development": {
                    "description": "Production system development",
                    "hours": 200,
                    "rate": 25000,
                    "total": 5_000_000,
                },
                "integration_testing": {
                    "description": "Integration testing and quality assurance",
                    "hours": 60,
                    "rate": 25000,
                    "total": 1_500_000,
                },
                "training": {
                    "description": "Employee training",
                    "hours": 20,
                    "rate": 30000,
                    "total": 600_000,
                },
                "subtotal": 11_100_000,
            },
            "monthly_costs": {
                "ai_api": {
                    "description": "AI API usage fees",
                    "monthly": 200_000,
                },
                "infrastructure": {
                    "description": "Infrastructure operating costs",
                    "monthly": 50_000,
                },
                "support": {
                    "description": "Operations support",
                    "monthly": 300_000,
                },
                "subtotal": 550_000,
            },
            "payment_terms": {
                "schedule": [
                    "At contract signing: 30%",
                    "At PoC completion: 30%",
                    "At production release: 30%",
                    "At acceptance completion: 10%",
                ],
                "payment_method": "Bank transfer (within 30 days of invoice)",
            },
        }
```

---

## 3. ROI Calculation Framework

### 3.1 The Four Pillars of ROI Calculation

```
┌──────────────────────────────────────────────────────────┐
│                ROI Calculation Framework                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ■ Direct Cost Reduction           ■ Productivity Gains  │
│  ┌────────────────────┐          ┌────────────────────┐ │
│  │ Labor cost savings  │          │ Processing speed    │ │
│  │ Outsourcing savings │          │ Throughput increase │ │
│  │ Error cost savings  │          │ Faster decisions    │ │
│  └────────────────────┘          └────────────────────┘ │
│                                                          │
│  ■ Revenue Growth                  ■ Strategic Value     │
│  ┌────────────────────┐          ┌────────────────────┐ │
│  │ Higher satisfaction │          │ Competitive edge    │ │
│  │ Upsell opportunities│          │ Scalability         │ │
│  │ New customer acq.   │          │ Data asset buildup  │ │
│  └────────────────────┘          └────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3.2 ROI Calculation Templates by Business Function

```python
# ROI calculation by business function
roi_templates = {
    "customer_support": {
        "current_state": {
            "agents": 10,
            "salary_per_agent": 4_000_000,  # annual
            "tickets_per_month": 5000,
            "avg_resolution_time_min": 15,
            "customer_satisfaction": 72  # %
        },
        "after_ai": {
            "agents_needed": 6,  # 40% reduction
            "ai_cost_annual": 3_600_000,
            "avg_resolution_time_min": 5,  # 67% reduction
            "customer_satisfaction": 85  # +13pt
        },
        "roi_calculation": {
            "salary_saved": 4 * 4_000_000,     # 16M JPY
            "ai_cost": 3_600_000,               # 3.6M JPY
            "net_benefit": 16_000_000 - 3_600_000,  # 12.4M JPY
            "satisfaction_impact": "2% churn reduction ≈ 5M JPY/year",
            "total_annual_benefit": 17_400_000,
            "implementation_cost": 8_000_000,
            "roi_year1": "117%",
            "payback": "5.5 months"
        }
    },
    "document_processing": {
        "current_state": {
            "staff": 5,
            "salary_per_staff": 5_000_000,
            "documents_per_month": 3000,
            "avg_processing_time_min": 20,
            "error_rate": 0.05,
        },
        "after_ai": {
            "staff_needed": 2,
            "ai_cost_annual": 2_400_000,
            "avg_processing_time_min": 3,
            "error_rate": 0.01,
        },
        "roi_calculation": {
            "salary_saved": 3 * 5_000_000,
            "ai_cost": 2_400_000,
            "error_cost_saved": 3000 * 12 * 0.04 * 5000,
            "net_annual_benefit": 20_200_000,
            "implementation_cost": 6_000_000,
            "roi_year1": "237%",
            "payback": "3.6 months",
        },
    },
    "sales_forecasting": {
        "current_state": {
            "forecast_accuracy": 0.65,
            "annual_revenue": 500_000_000,
            "inventory_waste_rate": 0.08,
        },
        "after_ai": {
            "forecast_accuracy": 0.85,
            "inventory_waste_rate": 0.03,
        },
        "roi_calculation": {
            "waste_reduction": 500_000_000 * 0.05,
            "ai_cost_annual": 5_000_000,
            "net_annual_benefit": 20_000_000,
            "implementation_cost": 10_000_000,
            "roi_year1": "100%",
            "payback": "6 months",
        },
    },
}
```

### 3.3 ROI Calculation Tool

```python
class ROICalculator:
    """Comprehensive ROI calculation tool"""

    def __init__(self):
        self.discount_rate = 0.08  # Discount rate 8%

    def calculate_simple_roi(self, investment: float,
                              annual_benefit: float,
                              annual_cost: float) -> dict:
        """Simple ROI calculation"""
        net_benefit = annual_benefit - annual_cost
        roi = (net_benefit - investment) / investment * 100
        payback = investment / max(net_benefit / 12, 1)

        return {
            "investment": investment,
            "annual_benefit": annual_benefit,
            "annual_cost": annual_cost,
            "net_annual_benefit": net_benefit,
            "roi_percentage": round(roi, 1),
            "payback_months": round(payback, 1),
        }

    def calculate_npv(self, investment: float,
                       cash_flows: list,
                       discount_rate: float = None) -> dict:
        """NPV (Net Present Value) calculation"""
        rate = discount_rate or self.discount_rate
        npv = -investment

        discounted_flows = []
        for year, cf in enumerate(cash_flows, 1):
            discounted = cf / (1 + rate) ** year
            discounted_flows.append({
                "year": year,
                "cash_flow": cf,
                "discounted": round(discounted),
            })
            npv += discounted

        return {
            "investment": investment,
            "discount_rate": rate,
            "npv": round(npv),
            "is_positive": npv > 0,
            "cash_flows": discounted_flows,
        }

    def calculate_irr(self, investment: float,
                       cash_flows: list) -> float:
        """IRR (Internal Rate of Return) calculation"""
        # Calculate using bisection method
        low, high = -0.5, 5.0

        for _ in range(100):
            mid = (low + high) / 2
            npv = -investment
            for year, cf in enumerate(cash_flows, 1):
                npv += cf / (1 + mid) ** year

            if abs(npv) < 1000:
                break
            elif npv > 0:
                low = mid
            else:
                high = mid

        return round(mid * 100, 1)

    def sensitivity_analysis(self, base_case: dict,
                              variables: dict) -> list:
        """Sensitivity analysis"""
        results = []

        for var_name, var_range in variables.items():
            for factor in var_range:
                case = base_case.copy()
                case[var_name] = base_case[var_name] * factor

                roi = self.calculate_simple_roi(
                    investment=case.get("investment", 0),
                    annual_benefit=case.get("annual_benefit", 0),
                    annual_cost=case.get("annual_cost", 0),
                )

                results.append({
                    "variable": var_name,
                    "factor": factor,
                    "value": case[var_name],
                    "roi": roi["roi_percentage"],
                    "payback_months": roi["payback_months"],
                })

        return results

    def generate_roi_report(self, assessment: dict) -> str:
        """Auto-generate ROI report"""
        simple = self.calculate_simple_roi(
            investment=assessment["investment"],
            annual_benefit=assessment["annual_benefit"],
            annual_cost=assessment["annual_cost"],
        )

        cash_flows = [
            assessment["annual_benefit"] - assessment["annual_cost"]
        ] * 3  # 3 years

        npv = self.calculate_npv(assessment["investment"], cash_flows)
        irr = self.calculate_irr(assessment["investment"], cash_flows)

        report = f"""
## ROI Analysis Report

### Investment Overview
- Initial investment: {assessment['investment']:,} JPY
- Annual expected benefit: {assessment['annual_benefit']:,} JPY
- Annual operating cost: {assessment['annual_cost']:,} JPY

### Key Metrics
- **ROI**: {simple['roi_percentage']}%
- **Payback period**: {simple['payback_months']} months
- **NPV (3 years, discount rate {self.discount_rate*100}%)**: {npv['npv']:,} JPY
- **IRR**: {irr}%

### Verdict
{'Recommended: ROI over 100%, payback within 12 months' if simple['roi_percentage'] > 100
 else 'Needs review: ROI or payback period improvement required'}
"""
        return report


# Usage example
calculator = ROICalculator()

# ROI for customer support AI implementation
result = calculator.calculate_simple_roi(
    investment=8_000_000,
    annual_benefit=17_400_000,
    annual_cost=3_600_000,
)
print(f"ROI: {result['roi_percentage']}%")
print(f"Payback period: {result['payback_months']} months")

# NPV calculation
npv = calculator.calculate_npv(
    investment=8_000_000,
    cash_flows=[13_800_000, 13_800_000, 13_800_000],
)
print(f"NPV: {npv['npv']:,} JPY")
```

| Metric | Formula | Benchmark |
|--------|---------|-----------|
| Simple ROI | (Profit - Investment) / Investment x 100 | 100%+ |
| Payback Period | Initial investment / Monthly net profit | Within 6 months |
| NPV | Sum of discounted future CFs - Investment | Positive value |
| IRR | Discount rate where NPV = 0 | 20%+ |
| LTV/CAC | Customer lifetime value / Acquisition cost | 3x+ |

---

## 4. Project Delivery

### 4.1 Standard Project Flow

```python
# AI consulting project management
project_phases = {
    "Phase 0: Discovery (1-2 weeks)": {
        "activities": [
            "Stakeholder interviews",
            "Current business workflow analysis",
            "Data quality assessment",
            "Technical environment survey"
        ],
        "deliverables": ["Assessment report", "Proposal"],
        "success_criteria": "Management approval"
    },
    "Phase 1: PoC (2-4 weeks)": {
        "activities": [
            "Prototype development",
            "AI validation with limited data",
            "Accuracy and performance measurement",
            "User testing"
        ],
        "deliverables": ["PoC report", "Demo", "Go/No-Go decision"],
        "success_criteria": "Accuracy target achieved + business value confirmed"
    },
    "Phase 2: Build (1-3 months)": {
        "activities": [
            "Production system development",
            "Integration with existing systems",
            "Security measures",
            "Load testing"
        ],
        "deliverables": ["Production system", "Operations manual"],
        "success_criteria": "SLA requirements met"
    },
    "Phase 3: Launch & Optimize (ongoing)": {
        "activities": [
            "Staged rollout",
            "Monitoring setup",
            "Model improvement",
            "Employee training"
        ],
        "deliverables": ["Monthly report", "Improvement proposals"],
        "success_criteria": "ROI target achieved"
    }
}
```

### 4.2 Project Management Toolkit

```python
class ProjectManagement:
    """AI consulting project management"""

    def __init__(self, project_name: str, client: str):
        self.project_name = project_name
        self.client = client
        self.status = "initiated"
        self.risks = []
        self.milestones = []

    def create_project_charter(self) -> dict:
        """Create project charter"""
        return {
            "project_name": self.project_name,
            "client": self.client,
            "objective": "",
            "scope": {
                "in_scope": [],
                "out_of_scope": [],
            },
            "stakeholders": {
                "executive_sponsor": "",
                "project_owner": "",
                "technical_lead": "",
                "end_users": [],
            },
            "timeline": {
                "start_date": "",
                "target_end_date": "",
                "key_milestones": [],
            },
            "budget": {
                "total": 0,
                "breakdown": {},
            },
            "success_criteria": [],
            "assumptions": [],
            "constraints": [],
        }

    def create_status_report(self, week: int, data: dict) -> str:
        """Generate weekly status report"""
        report = f"""
# Weekly Status Report - Week {week}

## Project: {self.project_name}
## Client: {self.client}

### Progress Summary
- Overall progress: {data.get('overall_progress', 0)}%
- Completed tasks this week: {', '.join(data.get('completed_tasks', []))}
- Planned tasks next week: {', '.join(data.get('planned_tasks', []))}

### Highlights
{chr(10).join(f'- {h}' for h in data.get('highlights', []))}

### Risks and Issues
{chr(10).join(f'- [{r["severity"]}] {r["description"]}: {r["action"]}'
              for r in data.get('risks', []))}

### KPIs
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
"""
        for kpi in data.get('kpis', []):
            status = "Achieved" if kpi['current'] >= kpi['target'] else "Not met"
            report += (f"| {kpi['name']} | {kpi['target']} | "
                      f"{kpi['current']} | {status} |\n")

        return report

    def create_handover_document(self, system_info: dict) -> dict:
        """Handover document template"""
        return {
            "system_overview": {
                "architecture": system_info.get("architecture", ""),
                "components": system_info.get("components", []),
                "data_flow": system_info.get("data_flow", ""),
            },
            "operational_guide": {
                "daily_tasks": [
                    "Sample check of AI output quality (10 items/day)",
                    "Review error logs",
                    "Check usage and costs",
                ],
                "weekly_tasks": [
                    "Compile and report accuracy metrics",
                    "Review user feedback",
                    "Consider cost optimization",
                ],
                "monthly_tasks": [
                    "Create monthly report",
                    "Review model/prompt improvements",
                    "Organize new feature requests",
                ],
            },
            "troubleshooting": {
                "common_issues": [
                    {
                        "issue": "Slow AI API response",
                        "cause": "Load on the API provider side",
                        "solution": "Switch to fallback model. "
                                    "Check cache hit rate.",
                    },
                    {
                        "issue": "Degraded AI output quality",
                        "cause": "Changes in input data, prompt degradation",
                        "solution": "Check distribution of input data. "
                                    "Run A/B test on prompts.",
                    },
                ],
            },
            "escalation": {
                "l1_support": "In-house operations team",
                "l2_support": "Consultant (within monthly contract)",
                "emergency": "Emergency contact: xxx-xxxx-xxxx",
            },
        }
```

### 4.3 PoC Success Framework

```python
class PoCFramework:
    """Design and evaluation framework for PoC (Proof of Concept)"""

    @staticmethod
    def design_poc(requirements: dict) -> dict:
        """PoC design"""
        return {
            "objective": requirements.get("objective", ""),
            "hypothesis": requirements.get("hypothesis", ""),
            "scope": {
                "data": "10-20% sample of production data",
                "users": "3-5 test users",
                "duration": "2-4 weeks",
                "features": "Core feature only (one)",
            },
            "success_criteria": {
                "accuracy": {
                    "metric": requirements.get("accuracy_metric", "F1"),
                    "threshold": requirements.get("accuracy_threshold", 0.85),
                    "measurement": "Evaluation on test dataset",
                },
                "performance": {
                    "latency_p50": "Within 1 second",
                    "latency_p95": "Within 3 seconds",
                    "throughput": "10 req/sec or more",
                },
                "user_acceptance": {
                    "satisfaction": "70% of test users say 'I want to use this'",
                    "usability": "SUS 70 or above",
                },
                "cost": {
                    "api_cost_per_request": "Within 50 JPY",
                    "monthly_projection": "Within 120% of budget",
                },
            },
            "go_no_go_criteria": {
                "go": "3 or more out of 4 criteria met",
                "conditional_go": "2 criteria met + improvement plan in place",
                "no_go": "1 or fewer criteria met → pivot or cancel",
            },
        }

    @staticmethod
    def evaluate_poc(results: dict, criteria: dict) -> dict:
        """Evaluate PoC results"""
        scores = {}
        passed = 0
        total = 0

        for category, threshold in criteria.items():
            if category in results:
                actual = results[category]
                target = threshold.get("threshold", 0)
                is_passed = actual >= target
                scores[category] = {
                    "actual": actual,
                    "target": target,
                    "passed": is_passed,
                }
                if is_passed:
                    passed += 1
                total += 1

        recommendation = (
            "GO" if passed >= total * 0.75 else
            "CONDITIONAL GO" if passed >= total * 0.5 else
            "NO GO"
        )

        return {
            "scores": scores,
            "passed": passed,
            "total": total,
            "recommendation": recommendation,
        }
```

---

## 5. Anti-Patterns

### Anti-Pattern 1: Technology-First Proposals

```python
# BAD: Technically interesting but business value is unclear
proposal_bad = {
    "title": "Proposal to Introduce Latest GPT-4o + RAG + Vector DB",
    "focus": "Cutting-edge nature of technical architecture",
    "roi": "Not calculated",
    "result": "Management: 'So, how much money will we make?' → Rejected"
}

# GOOD: Starting from the business challenge; technology is explained as the means
proposal_good = {
    "title": "AI Implementation Proposal: 40% Reduction in Customer Support Costs",
    "focus": "Cost reduction amount and improved customer satisfaction",
    "roi": "Year 1 ROI 117%, payback in 5.5 months",
    "technology": "Listed in supplementary materials (for interested parties)",
    "result": "Management: 'Let's start right away' → Order won"
}
```

### Anti-Pattern 2: Getting Stuck at PoC

```python
# BAD: PoC succeeds but never moves to production
poc_trap = {
    "poc_success_rate": "80%",
    "production_rate": "20%",  # Only 25% of successful PoCs reach production
    "reason": "Vague PoC goals, production requirements not considered"
}

# GOOD: Build production transition criteria into PoC from the start
poc_with_exit_criteria = {
    "go_criteria": [
        "Accuracy: Achieve 90% or more of target value",
        "Speed: Response time within 2 seconds",
        "Cost: API fees within 100K JPY/month",
        "Users: 70% or more of test users say 'I want to use this'"
    ],
    "no_go_action": "Pivot or cancel (no additional investment)",
    "go_action": "Simultaneously obtain Phase 2 budget approval"
}
```

### Anti-Pattern 3: Scope Creep

```python
# BAD: Requirements expand without limit during the project
scope_creep = {
    "original_scope": "Customer support chatbot",
    "week_2": "+ Add email handling too",
    "week_4": "+ Also transcribe phone calls",
    "week_6": "+ Handle sales department FAQs too",
    "result": "Budget doubled, timeline tripled, quality degraded"
}

# GOOD: Introduce a change management process
change_management = {
    "process": [
        "1. Receive change request in writing",
        "2. Impact analysis (cost, timeline, quality)",
        "3. Submit estimate",
        "4. Implement only after client approval",
    ],
    "template": {
        "change_request_id": "CR-001",
        "description": "Adding email handling functionality",
        "impact_cost": "+1,500,000 JPY",
        "impact_timeline": "+3 weeks",
        "priority": "medium",
        "approval_required": True,
    },
}
```

### Anti-Pattern 4: Underpricing

```python
# BAD: Taking work at a low price to build a track record
underpricing = {
    "quote": 500_000,  # 1/3 of market rate
    "actual_hours": 200,  # 3x the estimate
    "effective_rate": 2500,  # 2,500 JPY per hour
    "result": "Burnout, quality degradation, and distorted client expectations"
}

# GOOD: Value-based pricing
value_pricing = {
    "client_current_cost": 20_000_000,  # 20M JPY annual problem
    "expected_saving": 12_000_000,  # 60% reduction
    "fee": 3_000_000,  # 25% of savings
    "value_ratio": 4.0,  # 4x return for the client
    "message": "A 3M JPY investment yields 12M JPY in savings. ROI: 300%."
}
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

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
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Test
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add item (with size limit)"""
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

# Test
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

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## 6. FAQ

### Q1: What are the typical rates for AI consulting?

**A:** In the Japanese market: (1) Assessment: 500K–2M JPY (2-4 weeks), (2) PoC: 1M–5M JPY (1-2 months), (3) Full implementation: 3M–20M JPY (3-6 months), (4) Operations and maintenance: 300K–1M JPY/month. Independent consultants charge 50K–150K JPY/day; through a firm, 200K–500K JPY/day is the norm. Rates vary significantly based on track record and industry knowledge.

### Q2: Which is more important — technical skills or business skills?

**A:** The ratio is "70% business : 30% technology." AI technical implementation increasingly comes down to API calls, so the differentiating factors are (1) understanding the client's business, (2) ability to structure problems, (3) skills to quantify ROI, and (4) stakeholder management. Technical work can be outsourced; trust and business understanding cannot.

### Q3: How do you handle internal resistance at the client?

**A:** Address it in three stages. (1) Early involvement — bring frontline staff into the PoC stage so they feel ownership, (2) Small wins — start with the task that has the most impact and least resistance, (3) Data-driven persuasion — visualize quantitative data such as "processing time reduced 70% after AI implementation." For the specific fear of "AI will take our jobs," demonstrate with concrete examples that "AI is a support tool, freeing you to focus on higher-value work."

### Q4: How do you acquire your first client?

**A:** Five approaches are effective for initial client acquisition. (1) Free assessment: Offer a 30-minute free AI utilization diagnosis to surface challenges and convert to a proposal. (2) Content publishing: Publish industry-specific AI use cases on blogs, speaking engagements, and social media to establish yourself as an expert. (3) Past network: Contact former colleagues and business partners, letting them know "I'm available to consult on AI implementation." (4) Partnerships: Partner with web development firms and SIers to receive AI project referrals. (5) Community participation: Build relationships at AI-related study groups and conferences. For the first three clients, it is important to get case studies and recommendations even if it means a slight discount.

### Q5: What contract structure should I use?

**A:** The optimal contract type depends on the nature of the project. (1) Quasi-mandate contract (time-based): Best for exploratory phases where requirements are unclear. Billed at hourly rate × hours worked. Requires trust with the client. (2) Contract for work (deliverable-based): Appropriate for PoC and development phases where requirements are clear. Clearly define deliverables and acceptance criteria. (3) Performance-based: Fee is a percentage of the cost savings achieved. Low risk for the client and easier to win, but requires agreement on how results are measured. It is common to start with a quasi-mandate contract, and once trust is established, combine it with contracts for work or performance-based arrangements.

### Q6: What do you do when a project looks like it might fail?

**A:** Three steps for project crisis management. (1) Early warning: Share "yellow flags" proactively in weekly status reports. Hiding problems is the worst response. (2) Root cause analysis and replanning: Identify whether the issue is technical or a misalignment on requirements, and present options for adjusting scope, schedule, or budget. (3) Escalation: If necessary, involve the client's executive sponsor and seek a Go/No-Go decision. The key to maintaining trust is to frame it not as a "failure" but as a "learning," with a stance of "this approach was found to be ineffective; here is the next approach we propose."

---


## FAQ

### Q1: What is the most important point when learning this topic?

Accumulating hands-on experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Service design | Three tiers: Assessment → Implementation support → Operations & maintenance |
| Key to proposals | Start from business challenges, quantify ROI, proactively address risks |
| ROI calculation | Four axes: Cost reduction + productivity gains + revenue growth + strategic value |
| Project | Four phases: Discovery → PoC → Build → Launch |
| Sales process | Systematize: Lead → Discovery → Proposal → Contract |
| Revenue model | Year 1: ~40M JPY+ (solo to small team) |
| Key to success | 70% business understanding + 30% technical ability |
| Scope management | Introducing a change management process is essential |
| Pricing | Value-based (20-30% of realized benefit) is optimal |

---

## What to Read Next

- [02-content-creation.md](./02-content-creation.md) — Content creation business
- [../02-monetization/00-pricing-models.md](../02-monetization/00-pricing-models.md) — Pricing model design
- [../03-case-studies/02-startup-guide.md](../03-case-studies/02-startup-guide.md) — Startup guide

---

## References

1. **"The Trusted Advisor" — David Maister** — Classic work on building trust as a consultant
2. **"Value-Based Fees" — Alan Weiss** — Methods for value-based fee setting rather than hourly rates
3. **McKinsey & Company "The State of AI" (2024)** — Data on AI implementation success rates and ROI results
4. **"Flawless Consulting" — Peter Block** — Practical guide to the consulting process
5. **"Million Dollar Consulting" — Alan Weiss** — Growth strategy for the consulting business
6. **Harvard Business Review: AI Implementation** — Analysis of success factors in AI implementation projects
