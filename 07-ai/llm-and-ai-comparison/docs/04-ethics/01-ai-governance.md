# AI Governance — Regulations and Policies

> Systematically understand the laws and regulations, corporate policies, and international frameworks governing AI development and use, and acquire the knowledge needed to build a governance structure within your organization.

---

## What You Will Learn in This Chapter

1. **Regulatory Trends** — Key regulatory frameworks such as the EU AI Act, Japan's AI Guidelines, and the US Executive Order
2. **Organizational Governance Structure** — How to establish AI ethics committees, risk assessment processes, and incident response
3. **Compliance Implementation** — Concrete implementation methods for technical and organizational measures
4. **Data Governance** — Quality management of training data, privacy protection, and establishing data lineage
5. **Accountability and Transparency** — Technical implementation of model cards, Explainable AI (XAI), and audit readiness


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [AI Safety — Alignment and Red Teaming](./00-ai-safety.md)

---

## 1. Overview of AI Governance

### 1.1 Three-Layer Structure of Governance

```
+------------------------------------------------------------------+
|                    AI Governance Structure                         |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------------------------------------------------+  |
|  |  Layer 1: International / National Level                    |  |
|  |  - EU AI Act, Japan AI Business Guidelines, US Exec. Order  |  |
|  |  - G7 Hiroshima AI Process, OECD AI Principles              |  |
|  +------------------------------------------------------------+  |
|                                                                    |
|  +------------------------------------------------------------+  |
|  |  Layer 2: Organizational / Corporate Level                  |  |
|  |  - AI Ethics Policy, Risk Management Framework              |  |
|  |  - Governance Committee, Audit Processes                    |  |
|  +------------------------------------------------------------+  |
|                                                                    |
|  +------------------------------------------------------------+  |
|  |  Layer 3: Project / System Level                            |  |
|  |  - Impact Assessment (AIIA), Technical Safety Measures      |  |
|  |  - Model Cards, Monitoring Dashboards                       |  |
|  +------------------------------------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
```

### 1.2 Stakeholder Map

```
+----------+     +----------+     +----------+
| Regulators|     |Developers|     |  Users   |
|(Government)|    |(Companies)|    |(Citizens) |
+----------+     +----------+     +----------+
     |                |                |
     v                v                v
+--------------------------------------------------+
|              AI Governance Framework              |
|                                                    |
|  Regulations <-> Self-Regulation <-> Tech Standards|
|  (Enforceable)  (Industry bodies)   (IEEE, ISO)   |
+--------------------------------------------------+
     |                |                |
     v                v                v
+----------+     +----------+     +----------+
|  Auditors |     | Research  |     |  Civil   |
|           |     |Institutions|    |  Society  |
+----------+     +----------+     +----------+
```

### 1.3 AI Governance Maturity Model

```python
# Code example: AI governance maturity self-assessment tool
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Optional

class GovernanceMaturityLevel(IntEnum):
    """Governance maturity levels"""
    AD_HOC = 1       # Ad hoc
    DEVELOPING = 2    # Developing
    DEFINED = 3       # Defined
    MANAGED = 4       # Managed
    OPTIMIZING = 5    # Optimizing

@dataclass
class GovernanceMaturityAssessment:
    """AI governance maturity assessment"""

    DIMENSIONS = {
        "Policy and Strategy": {
            1: "No AI ethics policy exists",
            2: "Basic AI usage policy in place",
            3: "Comprehensive AI governance policy has been formulated",
            4: "Policy is regularly reviewed and updated",
            5: "Policy leads industry best practices",
        },
        "Organizational Structure": {
            1: "Governance responsibilities are unclear",
            2: "AI personnel exist informally",
            3: "An AI ethics committee is formally established",
            4: "A CxO-level AI officer is in place",
            5: "AI governance champions are deployed across all departments",
        },
        "Risk Management": {
            1: "No risk assessment process exists",
            2: "A basic risk checklist is in place",
            3: "A systematic impact assessment (AIIA) process exists",
            4: "Risks are quantitatively managed with KPIs defined",
            5: "Predictive risk management and automated detection are implemented",
        },
        "Technical Measures": {
            1: "Safety measures are ad hoc",
            2: "Basic filtering has been introduced",
            3: "Multi-layer guardrails and a test suite are in place",
            4: "Safety testing is integrated into CI/CD",
            5: "Automated red teaming and continuous monitoring are operational",
        },
        "Transparency and Accountability": {
            1: "No model documentation exists",
            2: "Basic model cards are available",
            3: "Explainability methods have been introduced",
            4: "Audit logs are comprehensively recorded",
            5: "A transparency posture capable of supporting external audits is in place",
        },
        "Training and Culture": {
            1: "No training on AI ethics exists",
            2: "Annual e-learning is available",
            3: "Regular hands-on training is conducted",
            4: "Case study sharing and a knowledge base are maintained",
            5: "AI ethics is deeply embedded in corporate culture",
        },
    }

    scores: dict = field(default_factory=dict)

    def evaluate(self, responses: dict[str, int]) -> GovernanceMaturityLevel:
        """Determine overall maturity level from scores across each dimension"""
        total = 0
        count = 0

        for dimension, score in responses.items():
            if dimension in self.DIMENSIONS:
                self.scores[dimension] = {
                    "score": score,
                    "description": self.DIMENSIONS[dimension].get(score, ""),
                    "max_score": 5,
                }
                total += score
                count += 1

        avg_score = total / count if count > 0 else 1
        return GovernanceMaturityLevel(min(round(avg_score), 5))

    def generate_roadmap(self, current_level: GovernanceMaturityLevel) -> list[dict]:
        """Generate an improvement roadmap based on the current level"""
        roadmaps = {
            GovernanceMaturityLevel.AD_HOC: [
                {
                    "phase": "Phase 1: Foundation Building (0–3 months)",
                    "actions": [
                        "Formulate and roll out an AI usage policy company-wide",
                        "Appoint an AI responsible officer",
                        "Introduce a basic risk checklist",
                        "Inventory existing AI systems",
                    ],
                },
            ],
            GovernanceMaturityLevel.DEVELOPING: [
                {
                    "phase": "Phase 2: Process Establishment (3–6 months)",
                    "actions": [
                        "Establish an AI ethics committee",
                        "Introduce an AIIA (AI Impact Assessment) process",
                        "Implement audit logging",
                        "Introduce basic safety testing",
                    ],
                },
            ],
            GovernanceMaturityLevel.DEFINED: [
                {
                    "phase": "Phase 3: Quantitative Management (6–12 months)",
                    "actions": [
                        "Define safety KPIs and SLOs",
                        "Integrate safety testing into CI/CD",
                        "Automate model card generation",
                        "Establish an incident response process",
                    ],
                },
            ],
            GovernanceMaturityLevel.MANAGED: [
                {
                    "phase": "Phase 4: Advancement (12–18 months)",
                    "actions": [
                        "Introduce automated red teaming",
                        "Implement predictive risk management",
                        "Build a posture for external audits",
                        "Promote industry collaboration and information sharing",
                    ],
                },
            ],
            GovernanceMaturityLevel.OPTIMIZING: [
                {
                    "phase": "Phase 5: Optimization (ongoing)",
                    "actions": [
                        "Publicly share best practices",
                        "Build collaborative relationships with regulators",
                        "Participate in the development of industry standards",
                        "Conduct research and development on AI governance",
                    ],
                },
            ],
        }

        return roadmaps.get(current_level, [])
```

---

## 2. Key Regulations

### 2.1 EU AI Act

```python
# Code example 1: EU AI Act risk category classification tool
from enum import Enum
from dataclasses import dataclass

class RiskLevel(Enum):
    UNACCEPTABLE = "unacceptable"   # Prohibited
    HIGH = "high"                    # Strict regulation
    LIMITED = "limited"              # Transparency obligation
    MINIMAL = "minimal"              # Self-regulation

@dataclass
class AISystemClassification:
    name: str
    risk_level: RiskLevel
    obligations: list[str]
    examples: list[str]

# EU AI Act risk classifications
CLASSIFICATIONS = [
    AISystemClassification(
        name="Prohibited AI Systems",
        risk_level=RiskLevel.UNACCEPTABLE,
        obligations=["Prohibited from use"],
        examples=[
            "Social scoring (government evaluation of citizens' social credit)",
            "Real-time remote biometric identification (public spaces, except law enforcement)",
            "Emotion recognition (use in workplaces or educational institutions)",
            "Subliminal manipulation to influence behavior",
        ]
    ),
    AISystemClassification(
        name="High-Risk AI Systems",
        risk_level=RiskLevel.HIGH,
        obligations=[
            "Conduct conformity assessments",
            "Implement a risk management system",
            "Ensure data governance",
            "Prepare technical documentation",
            "Record and retain logs",
            "Ensure human oversight",
            "Ensure accuracy, robustness, and cybersecurity",
        ],
        examples=[
            "Recruitment and HR evaluation systems",
            "Credit scoring",
            "Academic assessment in education",
            "Predictive policing in law enforcement",
            "Biometric identity verification",
            "Safety management of critical infrastructure",
        ]
    ),
    AISystemClassification(
        name="Limited-Risk AI Systems",
        risk_level=RiskLevel.LIMITED,
        obligations=[
            "Disclose that the system is AI (transparency obligation)",
            "Obligation to label deepfakes",
        ],
        examples=[
            "Chatbots",
            "Emotion recognition systems (limited use)",
            "Deepfake generation",
        ]
    ),
    AISystemClassification(
        name="Minimal-Risk AI Systems",
        risk_level=RiskLevel.MINIMAL,
        obligations=["Voluntary adherence to codes of conduct"],
        examples=[
            "Spam filters",
            "Game AI",
            "Recommendations (non-high-risk)",
        ]
    ),
]

def classify_ai_system(system_description: str,
                        use_case: str) -> AISystemClassification:
    """Determine the risk level of an AI system (simplified version)"""
    high_risk_keywords = [
        "recruitment", "HR", "credit", "educational assessment", "law enforcement",
        "biometric", "critical infrastructure", "medical diagnosis"
    ]
    for keyword in high_risk_keywords:
        if keyword in use_case:
            return CLASSIFICATIONS[1]  # HIGH

    return CLASSIFICATIONS[3]  # MINIMAL
```

### 2.2 EU AI Act — General-Purpose AI (GPAI) Regulation

```python
# Code example: Compliance check for General-Purpose AI (GPAI) models under the EU AI Act
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class GPAICompliance:
    """Compliance check for General-Purpose AI (GPAI) models under the EU AI Act"""

    # GPAI model classification:
    # - General GPAI: basic obligations
    # - Systemic-risk GPAI: additional obligations (training compute >= 10^25 FLOPs)

    SYSTEMIC_RISK_THRESHOLD_FLOPS = 10**25  # 10^25 FLOPs

    GENERAL_GPAI_OBLIGATIONS = [
        "Prepare and maintain technical documentation",
        "Provide information to the AI Office",
        "Comply with EU copyright law",
        "Publish a summary of training data",
    ]

    SYSTEMIC_RISK_OBLIGATIONS = [
        "Conduct model evaluations",
        "Assess and mitigate systemic risks",
        "Track and report serious incidents",
        "Ensure adequate cybersecurity",
        "Report energy consumption",
    ]

    model_name: str
    training_flops: float
    is_open_source: bool = False
    training_data_summary: Optional[str] = None
    technical_documentation: Optional[str] = None

    @property
    def is_systemic_risk(self) -> bool:
        """Determine whether the model is classified as a systemic-risk model"""
        return self.training_flops >= self.SYSTEMIC_RISK_THRESHOLD_FLOPS

    def check_compliance(self) -> dict:
        """Check compliance status"""
        results = {
            "model_name": self.model_name,
            "is_systemic_risk": self.is_systemic_risk,
            "classification": (
                "Systemic-Risk GPAI" if self.is_systemic_risk
                else "General GPAI"
            ),
            "obligations": [],
            "compliance_status": [],
        }

        # Check general GPAI obligations
        for obligation in self.GENERAL_GPAI_OBLIGATIONS:
            status = self._check_obligation(obligation)
            results["obligations"].append({
                "obligation": obligation,
                "status": status,
                "category": "general",
            })

        # Additional obligations for systemic-risk GPAI
        if self.is_systemic_risk:
            for obligation in self.SYSTEMIC_RISK_OBLIGATIONS:
                status = self._check_obligation(obligation)
                results["obligations"].append({
                    "obligation": obligation,
                    "status": status,
                    "category": "systemic_risk",
                })

        # Exception for open-source models
        if self.is_open_source and not self.is_systemic_risk:
            results["note"] = (
                "Open-source models may be exempt from some obligations "
                "(however, systemic-risk models are not exempt)"
            )

        # Overall compliance determination
        non_compliant = [
            o for o in results["obligations"]
            if o["status"] == "non_compliant"
        ]
        results["overall_status"] = (
            "compliant" if not non_compliant else "non_compliant"
        )
        results["non_compliant_count"] = len(non_compliant)

        return results

    def _check_obligation(self, obligation: str) -> str:
        """Check compliance for an individual obligation"""
        if "technical documentation" in obligation.lower() or "技術文書" in obligation:
            return "compliant" if self.technical_documentation else "non_compliant"
        if "training data" in obligation.lower() or "学習データ" in obligation:
            return "compliant" if self.training_data_summary else "non_compliant"
        return "needs_review"  # Manual review required

    def generate_compliance_report(self) -> str:
        """Generate a compliance report"""
        results = self.check_compliance()

        report = f"# GPAI Compliance Report\n\n"
        report += f"## Model Information\n"
        report += f"- **Model Name**: {self.model_name}\n"
        report += f"- **Training Compute**: {self.training_flops:.2e} FLOPs\n"
        report += f"- **Classification**: {results['classification']}\n"
        report += f"- **Open Source**: {'Yes' if self.is_open_source else 'No'}\n\n"

        report += f"## Compliance Status\n"
        report += f"- **Overall Verdict**: {results['overall_status']}\n"
        report += f"- **Non-compliant Items**: {results['non_compliant_count']}\n\n"

        report += f"## Obligations and Status\n\n"
        for ob in results["obligations"]:
            status_icon = {
                "compliant": "[OK]",
                "non_compliant": "[NG]",
                "needs_review": "[Review Required]",
            }.get(ob["status"], "[?]")
            report += f"- {status_icon} {ob['obligation']} ({ob['category']})\n"

        return report
```

### 2.3 Comparison of Key National Regulations

| Item | EU AI Act | Japan AI Guidelines | US AI Executive Order (EO 14110) | China AI Regulations | UK AI Regulations |
|------|-----------|---------------------|----------------------------------|----------------------|-------------------|
| Legal Binding Force | Yes (with penalties) | No (guidelines) | Partial (for federal agencies) | Yes (phased) | No (principles-based) |
| Risk Classification | 4 tiers | Principles-based | Sector-based | Use-case-based | Sector-based |
| Scope | All AI used within the EU | Businesses in Japan | Federal government + large-scale AI | All services within China | AI systems in the UK |
| Penalties | Up to EUR 35M or 7% of revenue | None | Exclusion from federal procurement, etc. | Fines + suspension of operations | Existing sector-specific penalties |
| Enforcement Timeline | Phased from 2024 | Revised 2024 | October 2023 | Phased from 2023 | From 2024 |
| Characteristics | Comprehensive, cross-sector | Flexible, self-regulation focused | National security focused | Content regulation focused | Pro-innovation |
| GPAI Regulation | Yes (10^25 FLOPs) | No | Reporting obligations apply | Generative AI Administration Measures | Under consideration |
| Extraterritorial Application | Yes | No | Limited | Yes | Under consideration |

### 2.4 Japan AI Governance in Detail

```python
# Code example: Japan AI Business Guidelines compliance checker
class JapanAIGuidelineChecker:
    """Compliance check against Japan's AI Business Guidelines (Version 1.0)"""

    # 10 Core Principles
    PRINCIPLES = {
        "P1_human_centric": {
            "name": "Human-Centric Principle",
            "description": "AI should augment human capabilities, with humans remaining the decision-making subject",
            "checkpoints": [
                "A human override function for AI decisions exists",
                "Users can recognize they are interacting with an AI",
                "AI use does not violate human dignity",
            ],
        },
        "P2_safety": {
            "name": "Safety Principle",
            "description": "The AI system must not cause harm to society",
            "checkpoints": [
                "A risk assessment has been conducted",
                "Safety testing is performed regularly",
                "An emergency stop function is implemented",
            ],
        },
        "P3_fairness": {
            "name": "Fairness Principle",
            "description": "AI must not engage in unjust discrimination",
            "checkpoints": [
                "A bias assessment has been conducted",
                "Evaluation has been performed on diverse test data",
                "Fairness metrics are defined and monitored",
            ],
        },
        "P4_privacy": {
            "name": "Privacy Principle",
            "description": "Individual privacy must be appropriately protected",
            "checkpoints": [
                "Compliance with the Act on the Protection of Personal Information",
                "Data minimization principles are applied",
                "An appropriate consent mechanism is in place",
            ],
        },
        "P5_security": {
            "name": "Security Principle",
            "description": "The security of the AI system must be ensured",
            "checkpoints": [
                "Resilience against adversarial attacks has been evaluated",
                "Access control is properly configured",
                "An incident response process exists",
            ],
        },
        "P6_transparency": {
            "name": "Transparency Principle",
            "description": "The AI's decision-making process must be appropriately explainable",
            "checkpoints": [
                "A model card has been created",
                "A function for explaining decisions exists",
                "The use of AI is explicitly stated in the terms of service",
            ],
        },
        "P7_accountability": {
            "name": "Accountability Principle",
            "description": "Accountability for AI development and operation must be clearly defined",
            "checkpoints": [
                "The accountability structure is clearly defined",
                "Audit logs are properly recorded",
                "A complaint handling process exists",
            ],
        },
        "P8_education": {
            "name": "Education and Literacy Principle",
            "description": "Appropriate education and improved AI literacy",
            "checkpoints": [
                "AI ethics training for employees is conducted",
                "Guidelines for users are provided",
                "Initiatives to improve AI literacy are in place",
            ],
        },
        "P9_fair_competition": {
            "name": "Fair Competition Principle",
            "description": "AI use must not impede a fair competitive environment",
            "checkpoints": [
                "No actions are taken that lead to market monopolization",
                "Unjust data lock-in is not practiced",
                "Open standards are respected",
            ],
        },
        "P10_innovation": {
            "name": "Innovation Principle",
            "description": "Governance must not impede innovation",
            "checkpoints": [
                "A risk-based approach is adopted",
                "A flexible process for experimental initiatives exists",
                "Guidelines are updated in response to technological advances",
            ],
        },
    }

    def check_compliance(
        self, responses: dict[str, list[bool]]
    ) -> dict:
        """Check guideline compliance status"""
        results = {
            "principles": [],
            "overall_compliance": 0.0,
            "non_compliant_areas": [],
        }

        total_checks = 0
        passed_checks = 0

        for principle_id, answers in responses.items():
            principle = self.PRINCIPLES.get(principle_id)
            if not principle:
                continue

            checkpoints = principle["checkpoints"]
            principle_passed = sum(
                1 for a in answers[:len(checkpoints)] if a
            )
            principle_total = len(checkpoints)

            total_checks += principle_total
            passed_checks += principle_passed

            compliance_rate = (
                principle_passed / principle_total
                if principle_total > 0 else 0
            )

            result = {
                "id": principle_id,
                "name": principle["name"],
                "compliance_rate": compliance_rate,
                "passed": principle_passed,
                "total": principle_total,
                "status": "compliant" if compliance_rate >= 0.67 else "non_compliant",
            }

            results["principles"].append(result)

            if compliance_rate < 0.67:
                results["non_compliant_areas"].append(principle["name"])

        results["overall_compliance"] = (
            passed_checks / total_checks if total_checks > 0 else 0
        )

        return results
```

---

## 3. Organizational Governance Structure

### 3.1 Composition of the AI Ethics Committee

```python
# Code example: AI ethics committee composition and operations framework
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Optional

class CommitteeRole(Enum):
    CHAIR = "Chair"
    TECHNICAL = "Technical Member"
    LEGAL = "Legal Member"
    ETHICS = "Ethics Member"
    BUSINESS = "Business Member"
    EXTERNAL = "External Member"
    DATA_PROTECTION = "Data Protection Member"

@dataclass
class CommitteeMember:
    name: str
    role: CommitteeRole
    department: str
    expertise: list[str]
    is_external: bool = False

@dataclass
class ReviewRequest:
    """Review submission to the AI Ethics Committee"""
    id: str
    project_name: str
    requestor: str
    risk_level: str  # "high", "medium", "low"
    system_description: str
    intended_use: str
    affected_stakeholders: list[str]
    submitted_at: datetime = field(default_factory=datetime.now)
    status: str = "pending"  # "pending", "under_review", "approved", "rejected", "conditional"
    decision: Optional[str] = None
    conditions: list[str] = field(default_factory=list)

class AIEthicsCommittee:
    """Operations management of the AI Ethics Committee"""

    def __init__(self):
        self.members: list[CommitteeMember] = []
        self.reviews: list[ReviewRequest] = []
        self.policies: list[dict] = []

    def add_member(self, member: CommitteeMember) -> None:
        self.members.append(member)

    def submit_review(self, request: ReviewRequest) -> str:
        """Accept a review submission"""
        # Determine the review process based on risk level
        if request.risk_level == "high":
            request.status = "under_review"
            required_quorum = max(len(self.members) * 2 // 3, 3)
            review_type = "full_committee"
        elif request.risk_level == "medium":
            request.status = "under_review"
            required_quorum = 3
            review_type = "subcommittee"
        else:
            request.status = "under_review"
            required_quorum = 1
            review_type = "fast_track"

        self.reviews.append(request)

        return (
            f"Review submission {request.id} has been accepted.\n"
            f"Review type: {review_type}\n"
            f"Required quorum: {required_quorum} members\n"
            f"Estimated duration: {'2–4 weeks' if review_type == 'full_committee' else '1 week' if review_type == 'subcommittee' else '3 business days'}"
        )

    def make_decision(
        self, review_id: str, decision: str,
        conditions: list[str] = None, rationale: str = ""
    ) -> dict:
        """Determine the review outcome"""
        for review in self.reviews:
            if review.id == review_id:
                review.status = decision
                review.decision = rationale
                if conditions:
                    review.conditions = conditions

                return {
                    "review_id": review_id,
                    "project": review.project_name,
                    "decision": decision,
                    "conditions": conditions or [],
                    "rationale": rationale,
                    "decided_at": datetime.now().isoformat(),
                }

        return {"error": f"Review {review_id} not found"}

    def get_dashboard(self) -> dict:
        """Generate committee dashboard information"""
        return {
            "total_members": len(self.members),
            "external_members": sum(
                1 for m in self.members if m.is_external
            ),
            "pending_reviews": sum(
                1 for r in self.reviews if r.status == "pending"
            ),
            "under_review": sum(
                1 for r in self.reviews if r.status == "under_review"
            ),
            "total_reviews": len(self.reviews),
            "approval_rate": (
                sum(1 for r in self.reviews if r.status == "approved")
                / len(self.reviews)
                if self.reviews else 0
            ),
        }

# Usage example
committee = AIEthicsCommittee()

committee.add_member(CommitteeMember(
    name="Taro Tanaka",
    role=CommitteeRole.CHAIR,
    department="CTO Office",
    expertise=["AI Safety", "Machine Learning"],
))

committee.add_member(CommitteeMember(
    name="Hanako Yamada",
    role=CommitteeRole.LEGAL,
    department="Legal Department",
    expertise=["Personal Information Protection Act", "EU AI Act"],
))

committee.add_member(CommitteeMember(
    name="Professor Suzuki",
    role=CommitteeRole.EXTERNAL,
    department="University of Tokyo",
    expertise=["AI Ethics", "Sociology"],
    is_external=True,
))
```

### 3.2 AI Impact Assessment (AIIA)

```python
# Code example 2: AI Impact Assessment (AIIA) template
@dataclass
class AIImpactAssessment:
    """AI Impact Assessment (AIIA)"""

    # Basic information
    project_name: str
    system_description: str
    intended_use: str
    developer_team: str

    # Risk assessment
    risk_categories: dict  # Category -> Risk level

    # Fairness assessment
    affected_groups: list[str]
    fairness_metrics: dict
    bias_mitigation: str

    # Privacy assessment
    personal_data_used: bool
    data_minimization: str
    consent_mechanism: str

    # Transparency
    explainability_method: str
    user_notification: str

    # Human oversight
    human_oversight_level: str  # "full", "partial", "minimal"
    override_mechanism: str

    # Environmental impact
    estimated_carbon_footprint: Optional[str] = None
    energy_efficiency_measures: Optional[str] = None

    # Approval
    approved_by: str = ""
    approval_date: str = ""
    review_schedule: str = ""  # "quarterly", "annually"

def generate_aiia_report(assessment: AIImpactAssessment) -> str:
    """Generate an AIIA report"""
    report = f"""
========================================
AI Impact Assessment Report
========================================
Project: {assessment.project_name}
Description: {assessment.system_description}
Intended Use: {assessment.intended_use}
Development Team: {assessment.developer_team}

--- Risk Assessment ---
"""
    for category, level in assessment.risk_categories.items():
        report += f"  {category}: {level}\n"

    report += f"""
--- Fairness ---
Affected Groups: {', '.join(assessment.affected_groups)}
Bias Mitigation: {assessment.bias_mitigation}
Fairness Metrics: {assessment.fairness_metrics}

--- Privacy ---
Personal Data Used: {'Yes' if assessment.personal_data_used else 'No'}
Data Minimization: {assessment.data_minimization}
Consent Mechanism: {assessment.consent_mechanism}

--- Transparency ---
Explainability Method: {assessment.explainability_method}
User Notification: {assessment.user_notification}

--- Human Oversight ---
Oversight Level: {assessment.human_oversight_level}
Override: {assessment.override_mechanism}

--- Environmental Impact ---
Estimated CO2 Emissions: {assessment.estimated_carbon_footprint or 'Not assessed'}
Energy Efficiency Measures: {assessment.energy_efficiency_measures or 'Not implemented'}

--- Approval ---
Approved By: {assessment.approved_by}
Approval Date: {assessment.approval_date}
Next Review: {assessment.review_schedule}
"""
    return report
```

### 3.3 Governance Process Flow

```
+------------------------------------------------------------------+
|                AI Project Governance Flow                         |
+------------------------------------------------------------------+
|                                                                    |
|  Planning Phase                                                    |
|  +------------------+                                              |
|  | 1. Impact        | → Risk level determination                  |
|  |    Assessment    |   (High/Medium/Low)                         |
|  |    (AIIA)        |                                             |
|  +------------------+                                              |
|          |                                                         |
|     [High Risk]                [Low Risk]                          |
|          |                         |                               |
|          v                         v                               |
|  +------------------+     +------------------+                     |
|  | 2. Ethics        |     | 2. Self          |                     |
|  |    Committee     |     |    Checklist     |                     |
|  |    Review        |     |                  |                     |
|  +------------------+     +------------------+                     |
|          |                         |                               |
|          v                         v                               |
|  Development Phase                                                 |
|  +------------------+                                              |
|  | 3. Safety Testing| → Red teaming, bias testing                 |
|  +------------------+                                              |
|          |                                                         |
|          v                                                         |
|  +------------------+                                              |
|  | 4. Approval Gate | → Sent back if criteria not met             |
|  +------------------+                                              |
|          |                                                         |
|          v                                                         |
|  Operations Phase                                                  |
|  +------------------+                                              |
|  | 5. Continuous    | → Drift detection, incident response        |
|  |    Monitoring    |                                             |
|  +------------------+                                              |
|          |                                                         |
|          v                                                         |
|  +------------------+                                              |
|  | 6. Periodic      | → Quarterly / Annual                        |
|  |    Review        |                                             |
|  +------------------+                                              |
+------------------------------------------------------------------+
```

---

## 4. Compliance Implementation

### 4.1 Implementing Audit Logs

```python
# Code example 3: Comprehensive audit logging for AI systems
import json
import hashlib
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Optional, Any

@dataclass
class AuditLogEntry:
    timestamp: str
    system_id: str
    model_version: str
    action: str          # "prediction", "decision", "override", "error"
    input_hash: str      # Hash of input data (does not contain personal information)
    output: str
    confidence: float
    explanation: str
    user_id: str | None  # Operator ID
    decision_type: str   # "automated", "human_reviewed", "human_overridden"
    metadata: dict = field(default_factory=dict)
    trace_id: Optional[str] = None  # For distributed tracing

class AIAuditLogger:
    """Records audit logs of AI decision-making"""

    def __init__(self, storage_backend, retention_days: int = 2555):
        """
        Args:
            storage_backend: Log storage destination
            retention_days: Retention period (default 7 years = EU AI Act requirement)
        """
        self.storage = storage_backend
        self.retention_days = retention_days

    async def log_prediction(
        self, system_id: str, model_version: str,
        input_data: dict, output: str,
        confidence: float, explanation: str,
        operator_id: str = None,
        decision_type: str = "automated",
        trace_id: str = None,
        extra_metadata: dict = None
    ) -> str:
        """Record a prediction result log"""
        entry = AuditLogEntry(
            timestamp=datetime.utcnow().isoformat() + "Z",
            system_id=system_id,
            model_version=model_version,
            action="prediction",
            input_hash=self._hash_input(input_data),
            output=output,
            confidence=confidence,
            explanation=explanation,
            user_id=operator_id,
            decision_type=decision_type,
            trace_id=trace_id,
            metadata={
                "input_features": list(input_data.keys()),
                "output_length": len(output),
                "retention_until": self._calculate_retention(),
                **(extra_metadata or {}),
            }
        )

        log_id = await self.storage.write(asdict(entry))
        return log_id

    async def log_human_override(
        self, system_id: str, original_prediction: str,
        override_value: str, operator_id: str,
        reason: str, trace_id: str = None
    ) -> str:
        """Record a human override in the log"""
        entry = AuditLogEntry(
            timestamp=datetime.utcnow().isoformat() + "Z",
            system_id=system_id,
            model_version="N/A",
            action="override",
            input_hash="",
            output=override_value,
            confidence=1.0,
            explanation=reason,
            user_id=operator_id,
            decision_type="human_overridden",
            trace_id=trace_id,
            metadata={
                "original_prediction": original_prediction,
                "override_reason": reason,
                "retention_until": self._calculate_retention(),
            }
        )

        return await self.storage.write(asdict(entry))

    async def log_error(
        self, system_id: str, model_version: str,
        error_type: str, error_message: str,
        input_hash: str = "", trace_id: str = None
    ) -> str:
        """Record an error event in the log"""
        entry = AuditLogEntry(
            timestamp=datetime.utcnow().isoformat() + "Z",
            system_id=system_id,
            model_version=model_version,
            action="error",
            input_hash=input_hash,
            output="",
            confidence=0.0,
            explanation=error_message,
            user_id=None,
            decision_type="automated",
            trace_id=trace_id,
            metadata={
                "error_type": error_type,
                "retention_until": self._calculate_retention(),
            }
        )

        return await self.storage.write(asdict(entry))

    async def query_audit_trail(
        self, system_id: str,
        start_time: datetime, end_time: datetime,
        action_filter: str = None
    ) -> list[dict]:
        """Query the audit trail"""
        query = {
            "system_id": system_id,
            "timestamp_range": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
            },
        }
        if action_filter:
            query["action"] = action_filter

        return await self.storage.query(query)

    def _hash_input(self, data: dict) -> str:
        """Generate a hash that does not contain personal information"""
        return hashlib.sha256(
            json.dumps(data, sort_keys=True).encode()
        ).hexdigest()[:16]

    def _calculate_retention(self) -> str:
        """Calculate the retention deadline"""
        from datetime import timedelta
        retention_date = datetime.utcnow() + timedelta(days=self.retention_days)
        return retention_date.isoformat() + "Z"
```

### 4.2 Automatic Model Card Generation

```python
# Code example 4: Automatic model card generation compliant with the EU AI Act / Japan Guidelines
class ModelCardGenerator:
    """Generate model cards compliant with the EU AI Act"""

    def generate(self, model_info: dict, eval_results: dict,
                 safety_results: dict) -> str:
        return f"""
# Model Card: {model_info['name']}

## Basic Information
- **Model Name**: {model_info['name']}
- **Version**: {model_info['version']}
- **Developer**: {model_info['developer']}
- **Release Date**: {model_info['release_date']}
- **Model Type**: {model_info['type']}
- **License**: {model_info['license']}

## Intended Use
{model_info['intended_use']}

## Out-of-Scope Use
{model_info['out_of_scope_use']}

## Training Data
- **Data Source**: {model_info['training_data']['source']}
- **Data Size**: {model_info['training_data']['size']}
- **Preprocessing**: {model_info['training_data']['preprocessing']}

## Performance Metrics
| Metric | Overall | Group A | Group B |
|--------|---------|---------|---------|
| Accuracy | {eval_results['accuracy']:.3f} | {eval_results['accuracy_a']:.3f} | {eval_results['accuracy_b']:.3f} |
| F1 | {eval_results['f1']:.3f} | {eval_results['f1_a']:.3f} | {eval_results['f1_b']:.3f} |

## Safety Evaluation
- **Harmful Content Refusal Rate**: {safety_results['refusal_rate']:.1%}
- **Jailbreak Resistance**: {safety_results['jailbreak_resistance']:.1%}
- **Bias Score**: {safety_results['bias_score']:.3f}

## Limitations
{model_info['limitations']}

## Ethical Considerations
{model_info['ethical_considerations']}
"""

    def generate_technical_documentation(
        self, model_info: dict,
        training_details: dict,
        evaluation_details: dict
    ) -> str:
        """Generate technical documentation compliant with the EU AI Act"""
        return f"""
# Technical Documentation: {model_info['name']}
## Compliant with EU AI Act Article 11

### 1. General Description of the System
{model_info.get('general_description', 'N/A')}

### 2. Design Specifications
- **Architecture**: {training_details.get('architecture', 'N/A')}
- **Number of Parameters**: {training_details.get('parameters', 'N/A')}
- **Training Compute**: {training_details.get('training_compute', 'N/A')} FLOPs

### 3. Development Process
- **Training Method**: {training_details.get('training_method', 'N/A')}
- **Alignment Method**: {training_details.get('alignment_method', 'N/A')}
- **Safety Measures**: {training_details.get('safety_measures', 'N/A')}

### 4. Training Data
- **Data Source**: {training_details.get('data_source', 'N/A')}
- **Data Volume**: {training_details.get('data_size', 'N/A')}
- **Data Quality Management**: {training_details.get('data_quality', 'N/A')}
- **Bias Mitigation**: {training_details.get('bias_mitigation', 'N/A')}

### 5. Evaluation Results
- **Benchmark Results**: {evaluation_details.get('benchmark_results', 'N/A')}
- **Safety Test Results**: {evaluation_details.get('safety_results', 'N/A')}
- **Bias Test Results**: {evaluation_details.get('bias_results', 'N/A')}

### 6. Risk Management
- **Identified Risks**: {evaluation_details.get('identified_risks', 'N/A')}
- **Mitigations**: {evaluation_details.get('mitigations', 'N/A')}
- **Residual Risks**: {evaluation_details.get('residual_risks', 'N/A')}

### 7. Human Oversight
- **Oversight Mechanism**: {model_info.get('human_oversight', 'N/A')}
- **Override Procedure**: {model_info.get('override_procedure', 'N/A')}

### 8. Cybersecurity
- **Threat Model**: {model_info.get('threat_model', 'N/A')}
- **Security Measures**: {model_info.get('security_measures', 'N/A')}
"""
```

### 4.3 Implementing Data Governance

```python
# Code example: Training data governance framework
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class DataSource:
    """Definition of a training data source"""
    id: str
    name: str
    source_type: str  # "public", "licensed", "proprietary", "user_generated"
    license: str
    contains_pii: bool
    consent_obtained: bool
    collection_date: str
    geography: str  # Geographic scope of the data
    language: str
    volume: str
    quality_score: float  # 0.0–1.0
    bias_assessment: Optional[str] = None

@dataclass
class DataLineageRecord:
    """Record of data lineage"""
    step: int
    operation: str
    input_sources: list[str]
    output_id: str
    timestamp: str
    operator: str
    description: str
    metadata: dict = field(default_factory=dict)

class TrainingDataGovernance:
    """Training data governance management"""

    def __init__(self):
        self.data_sources: list[DataSource] = []
        self.lineage: list[DataLineageRecord] = []
        self.audit_trail: list[dict] = []

    def register_data_source(self, source: DataSource) -> dict:
        """Register a data source"""
        # Validation
        issues = []

        if source.contains_pii and not source.consent_obtained:
            issues.append(
                "Consent is required for data sources containing PII"
            )

        if source.source_type == "licensed" and not source.license:
            issues.append(
                "License information is missing"
            )

        if source.quality_score < 0.5:
            issues.append(
                f"Data quality score is low ({source.quality_score:.2f})"
            )

        self.data_sources.append(source)

        self.audit_trail.append({
            "timestamp": datetime.now().isoformat(),
            "action": "register_data_source",
            "source_id": source.id,
            "issues": issues,
        })

        return {
            "source_id": source.id,
            "registered": True,
            "issues": issues,
            "is_compliant": len(issues) == 0,
        }

    def record_lineage(self, record: DataLineageRecord) -> None:
        """Record data lineage"""
        self.lineage.append(record)

    def check_eu_ai_act_data_compliance(self) -> dict:
        """Check compliance with EU AI Act data governance requirements"""
        results = {
            "timestamp": datetime.now().isoformat(),
            "total_sources": len(self.data_sources),
            "checks": [],
        }

        # Article 10: Data and Data Governance
        checks = [
            {
                "requirement": "A training data quality management process exists",
                "status": all(
                    s.quality_score >= 0.5 for s in self.data_sources
                ),
            },
            {
                "requirement": "The origin of the data is recorded",
                "status": all(
                    s.source_type != "" for s in self.data_sources
                ),
            },
            {
                "requirement": "A bias assessment has been conducted",
                "status": all(
                    s.bias_assessment is not None
                    for s in self.data_sources
                ),
            },
            {
                "requirement": "Appropriate consent exists for PII data",
                "status": all(
                    not s.contains_pii or s.consent_obtained
                    for s in self.data_sources
                ),
            },
            {
                "requirement": "Data lineage is recorded",
                "status": len(self.lineage) > 0,
            },
        ]

        results["checks"] = checks
        results["compliant_count"] = sum(
            1 for c in checks if c["status"]
        )
        results["overall_compliant"] = all(c["status"] for c in checks)

        return results

    def generate_data_summary(self) -> str:
        """Generate the data summary required by the EU AI Act"""
        summary = "# Training Data Summary\n\n"
        summary += f"## Overview\n"
        summary += f"- Number of data sources: {len(self.data_sources)}\n"

        # Aggregate by source type
        type_counts = {}
        for source in self.data_sources:
            type_counts[source.source_type] = (
                type_counts.get(source.source_type, 0) + 1
            )

        summary += f"- Source type distribution:\n"
        for stype, count in type_counts.items():
            summary += f"  - {stype}: {count}\n"

        # PII information
        pii_sources = [s for s in self.data_sources if s.contains_pii]
        summary += f"\n## Personal Information\n"
        summary += f"- Number of data sources containing PII: {len(pii_sources)}\n"
        summary += f"- Consent obtained for all: {'Yes' if all(s.consent_obtained for s in pii_sources) else 'No'}\n"

        # Language distribution
        languages = set(s.language for s in self.data_sources)
        summary += f"\n## Languages\n"
        summary += f"- Target languages: {', '.join(languages)}\n"

        return summary
```

---

## 5. Comparison of International AI Principles

| Principle | OECD (2019) | EU AI Act (2024) | Japan (2024) | IEEE Ethically Aligned Design | G7 Hiroshima AI Process |
|-----------|-------------|------------------|--------------|-------------------------------|-------------------------|
| Human-Centric | Yes | Yes | Yes | Yes | Yes |
| Transparency | Yes | Yes (mandatory) | Yes | Yes | Yes |
| Fairness | Yes | Yes (mandatory) | Yes | Yes | Yes |
| Safety | Yes | Yes (mandatory) | Yes | Yes | Yes |
| Privacy | Yes | Linked with GDPR | Yes | Yes | Yes |
| Accountability | Yes | Yes (with penalties) | Yes | Yes | Yes |
| Innovation | Yes | Sandbox system | Yes (emphasized) | Partial | Yes |
| Environmental Consideration | Partial | Yes (energy reporting) | Partial | Partial | Yes |
| Security | Yes | Yes (mandatory) | Yes | Yes | Yes |
| International Cooperation | Yes | Mutual recognition | Yes | Partial | Yes (leading) |

### 5.1 G7 Hiroshima AI Process in Detail

```python
# Code example: G7 Hiroshima AI Process — Compliance check for the International Code of Conduct for generative AI developers
class HiroshimaAIProcessChecker:
    """Compliance check against the G7 Hiroshima AI Process International Code of Conduct"""

    # 11 Guiding Principles
    GUIDING_PRINCIPLES = [
        {
            "id": "GP1",
            "title": "Risk Management Across the AI Lifecycle",
            "checkpoints": [
                "Risk assessments are conducted during the development phase",
                "Continuous monitoring is in place during the operations phase",
                "Risk mitigation measures are documented",
            ],
        },
        {
            "id": "GP2",
            "title": "Identification and Mitigation of Misuse and Abuse",
            "checkpoints": [
                "Abuse scenarios are systematically analyzed",
                "Red teaming is conducted regularly",
                "Prohibited activities are clearly stated in the terms of service",
            ],
        },
        {
            "id": "GP3",
            "title": "Transparency and Public Reporting",
            "checkpoints": [
                "Model cards are publicly available",
                "Safety evaluation results are reported",
                "A system for reporting serious incidents is in place",
            ],
        },
        {
            "id": "GP4",
            "title": "Responsible Information Sharing",
            "checkpoints": [
                "Vulnerability information is appropriately shared",
                "Safety best practices are shared",
                "A cooperative framework with industry groups and regulators exists",
            ],
        },
        {
            "id": "GP5",
            "title": "Formulation of AI Governance Policies",
            "checkpoints": [
                "A comprehensive AI usage policy has been formulated",
                "A privacy policy is established",
                "Regular policy reviews are conducted",
            ],
        },
        {
            "id": "GP6",
            "title": "Ensuring Security",
            "checkpoints": [
                "Cybersecurity measures are implemented",
                "Measures to prevent unauthorized access to the model exist",
                "A vulnerability management process is in place",
            ],
        },
        {
            "id": "GP7",
            "title": "Content Watermarking",
            "checkpoints": [
                "A means of identifying AI-generated content exists",
                "Watermarks or metadata are embedded",
                "Standards such as C2PA are adopted",
            ],
        },
        {
            "id": "GP8",
            "title": "Investment in Safety Research",
            "checkpoints": [
                "Research and development on safety is conducted",
                "Collaboration with academic institutions exists",
                "Safety research results are publicly shared",
            ],
        },
        {
            "id": "GP9",
            "title": "Addressing Societal Challenges",
            "checkpoints": [
                "Application to societal challenges such as climate change is being considered",
                "Efforts to reduce the digital divide are being made",
                "The opinions of diverse stakeholders are reflected",
            ],
        },
        {
            "id": "GP10",
            "title": "Supporting the Development of International Standards",
            "checkpoints": [
                "Participation in international standardization activities",
                "Efforts to ensure interoperability",
                "Support for international regulatory harmonization",
            ],
        },
        {
            "id": "GP11",
            "title": "Ensuring Appropriateness of Data Inputs",
            "checkpoints": [
                "Training data quality management is conducted",
                "Copyright considerations are addressed",
                "Personal information protection is thoroughly enforced",
            ],
        },
    ]

    def check_all_principles(
        self, responses: dict[str, list[bool]]
    ) -> dict:
        """Check compliance with all guiding principles"""
        results = {
            "principles": [],
            "overall_score": 0.0,
            "total_checkpoints": 0,
            "passed_checkpoints": 0,
        }

        for principle in self.GUIDING_PRINCIPLES:
            answers = responses.get(principle["id"], [])
            checkpoints = principle["checkpoints"]

            passed = sum(
                1 for i, a in enumerate(answers)
                if i < len(checkpoints) and a
            )
            total = len(checkpoints)

            results["total_checkpoints"] += total
            results["passed_checkpoints"] += passed

            results["principles"].append({
                "id": principle["id"],
                "title": principle["title"],
                "compliance_rate": passed / total if total > 0 else 0,
                "passed": passed,
                "total": total,
            })

        results["overall_score"] = (
            results["passed_checkpoints"] / results["total_checkpoints"]
            if results["total_checkpoints"] > 0 else 0
        )

        return results
```

---

## 6. Explainable AI (XAI) Implementation

### 6.1 Explainability Methods

```python
# Code example: Implementing explainability for LLM outputs
class LLMExplainability:
    """Provides explainability for LLM outputs"""

    def __init__(self, model, explanation_model=None):
        self.model = model
        self.explanation_model = explanation_model or model

    async def generate_with_explanation(
        self, prompt: str, system_prompt: str = ""
    ) -> dict:
        """Generate a response with an explanation"""
        # 1. Generate the standard response
        response = await self.model.generate(
            prompt, system_prompt=system_prompt
        )

        # 2. Generate the rationale for the response
        explanation_prompt = f"""Please explain the rationale for the following question and response.

Question: {prompt}
Response: {response}

Please explain the rationale in the following format:
1. What is the main basis for this response?
2. What information is it based on?
3. How confident is this response?
4. Are there any alternative responses?
5. What are the limitations of this response?"""

        explanation = await self.explanation_model.generate(
            explanation_prompt
        )

        # 3. Estimate confidence
        confidence_prompt = f"""Please evaluate the confidence of the following response on a scale of 0.0–1.0.
Response: {response}
Evaluation criteria:
- Is it based on facts?
- Is there any ambiguity?
- Is it generally agreed upon content?

Confidence (number only):"""

        confidence_str = await self.explanation_model.generate(
            confidence_prompt
        )
        try:
            confidence = float(confidence_str.strip())
        except ValueError:
            confidence = 0.5

        return {
            "response": response,
            "explanation": explanation,
            "confidence": confidence,
            "metadata": {
                "model": self.model.__class__.__name__,
                "timestamp": datetime.now().isoformat(),
                "prompt_length": len(prompt),
                "response_length": len(response),
            },
        }

    async def generate_counterfactual_explanation(
        self, prompt: str, response: str
    ) -> dict:
        """Generate a counterfactual explanation — how would changing the input change the result?"""
        cf_prompt = f"""Please provide a counterfactual explanation for the following question and response.
That is, explain how changing the question would lead to a different response.

Question: {prompt}
Response: {response}

Please explain the following:
1. Which part of the question, if changed, would lead to a different conclusion?
2. What specific changes are needed?
3. What response would be expected after the change?"""

        counterfactual = await self.explanation_model.generate(cf_prompt)

        return {
            "original_prompt": prompt,
            "original_response": response,
            "counterfactual_explanation": counterfactual,
        }
```

---

## 7. Environmental Impact and Sustainability

### 7.1 Environmental Impact Assessment of AI

```python
# Code example: Environmental impact assessment of AI models
@dataclass
class CarbonFootprintEstimate:
    """Carbon emission estimate for an AI model"""
    training_kwh: float
    training_co2_kg: float
    inference_kwh_per_1k_requests: float
    inference_co2_kg_per_1k_requests: float
    total_annual_co2_kg: float
    equivalent_car_km: float
    equivalent_trees_needed: int

class AIEnvironmentalImpact:
    """Assess the environmental impact of AI models"""

    # Carbon intensity by region (gCO2/kWh)
    CARBON_INTENSITY = {
        "us_average": 390,
        "eu_average": 230,
        "japan": 470,
        "france": 56,   # High proportion of nuclear power
        "norway": 17,   # High proportion of hydroelectric power
        "india": 720,
        "china": 550,
    }

    # Estimated GPU power consumption (W)
    GPU_POWER = {
        "A100_80GB": 300,
        "H100": 700,
        "A10G": 150,
        "V100": 250,
    }

    def estimate_training_footprint(
        self,
        gpu_type: str,
        num_gpus: int,
        training_hours: float,
        region: str = "us_average",
        pue: float = 1.1,  # Power Usage Effectiveness
    ) -> CarbonFootprintEstimate:
        """Estimate carbon emissions during training"""
        gpu_power_w = self.GPU_POWER.get(gpu_type, 300)
        carbon_intensity = self.CARBON_INTENSITY.get(region, 390)

        # Power consumption during training (kWh)
        training_kwh = (
            gpu_power_w * num_gpus * training_hours * pue / 1000
        )

        # CO2 emissions (kg)
        training_co2_kg = training_kwh * carbon_intensity / 1000

        # Inference estimate (per 1,000 requests)
        inference_kwh = gpu_power_w * 0.001 * pue / 1000  # Assuming ~1 second per request
        inference_co2_kg = inference_kwh * carbon_intensity / 1000

        # Annual estimate (assuming 100,000 requests per day)
        annual_requests = 100_000 * 365
        annual_inference_co2 = (
            inference_co2_kg * annual_requests / 1000
        )
        total_annual_co2 = training_co2_kg + annual_inference_co2

        return CarbonFootprintEstimate(
            training_kwh=training_kwh,
            training_co2_kg=training_co2_kg,
            inference_kwh_per_1k_requests=inference_kwh * 1000,
            inference_co2_kg_per_1k_requests=inference_co2_kg * 1000,
            total_annual_co2_kg=total_annual_co2,
            equivalent_car_km=total_annual_co2 / 0.12,  # 120g/km
            equivalent_trees_needed=int(total_annual_co2 / 22),  # 22kg/year/tree
        )

    def generate_environmental_report(
        self, estimate: CarbonFootprintEstimate, model_name: str
    ) -> str:
        """Generate an environmental impact report"""
        return f"""
# Environmental Impact Report: {model_name}

## Training Phase
- Power Consumption: {estimate.training_kwh:,.1f} kWh
- CO2 Emissions: {estimate.training_co2_kg:,.1f} kg

## Inference Phase (per 1,000 requests)
- Power Consumption: {estimate.inference_kwh_per_1k_requests:.4f} kWh
- CO2 Emissions: {estimate.inference_co2_kg_per_1k_requests:.4f} kg

## Annual Estimate
- Total CO2 Emissions: {estimate.total_annual_co2_kg:,.1f} kg
- Equivalent Car Travel Distance: {estimate.equivalent_car_km:,.0f} km
- Trees Required (absorption equivalent): {estimate.equivalent_trees_needed:,}

## Recommended Emission Reduction Measures
1. Host in regions with a high proportion of renewable energy
2. Improve inference efficiency through model distillation
3. Optimize GPU utilization through batch inference
4. Participate in carbon offset programs
"""
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: "Ethics Washing"

```
[Wrong] Formulate an AI ethics policy but fail to reflect it in the actual development process

  "Our company values AI ethics" (posted on the website)
   → Development teams are unaware of the policy's existence
   → No risk assessment process exists
   → The policy is read for the first time when an incident occurs

[Right] Embed governance into the development process
  1. Make AIIA (impact assessment) mandatory for all projects
  2. Integrate safety testing into the CI/CD pipeline
  3. Regular training and case study sharing
  4. Publish incident reports and implement improvement loops
```

### Anti-Pattern 2: "Innovation Suppression Through Over-Regulation"

```
[Wrong] Apply the highest level of regulation to all AI projects out of fear of risk

Problems:
  - Even low-risk projects wait months for ethics committee approval
  - Catastrophic slowdown of innovation speed
  - Decline in team motivation
  - Loss of competitive advantage against competitors

[Right] Risk-based approach
  - Low Risk: Self-checklist (1 day)
  - Medium Risk: Team leader approval (1 week)
  - High Risk: Ethics committee review (2–4 weeks)
  - Unacceptable Risk: Discontinuation decision

  Adjust process rigor according to the risk level
```

### Anti-Pattern 3: "Checklist Formalism"

```
[Wrong] Mechanically fill in all "Yes" on a compliance checklist

Problems:
  - No substantive risk assessment is conducted
  - Unable to demonstrate a basis during an audit
  - Real risks are overlooked
  - Deemed insufficient if legal liability arises

[Right] Evidence-based compliance
  - Link each checklist item to concrete evidence
  - Conduct reviews by a third party (a different internal team or external party)
  - Document risk acceptance decisions for "No" items
  - Periodically review and update the checklist itself
```

### Anti-Pattern 4: "Regulatory Compliance-Only Attitude"

```
[Wrong] Only take the minimum actions required by law and make no proactive efforts

Problems:
  - Regulations cannot keep up with the pace of technological advancement
  - New risks are not addressed until they are regulated
  - Reputational risk is not managed
  - User trust is lost

[Right] Proactive governance
  - Actively adopt industry best practices
  - Prepare for anticipated future regulations
  - Engage with AI ethics as a form of social responsibility
  - Voluntarily publish transparency reports
```

### Anti-Pattern 5: "Personalization of Governance"

```
[Wrong] AI governance depends on a specific individual (e.g., the AI ethics officer)

Problems:
  - The structure collapses when that person leaves
  - Knowledge bias creates blind spots
  - No scalability
  - Bus factor of 1

[Right] Organizational and institutional governance structure
  - Document and standardize governance processes
  - Adopt a committee structure with multiple members
  - Deploy safety champions in each team
  - Maintain a knowledge base and training program
  - Develop a succession plan
```

---

## 9. Practical Use Cases

### Use Case 1: Building an AI Governance Structure for a Financial Institution

```python
# Code example: AI governance framework template for financial institutions
class FinancialAIGovernance:
    """AI governance framework for financial institutions"""

    # Alignment with the Financial Services Agency's "Principles on the Use of AI"
    FSA_PRINCIPLES = {
        "governance": "Building an AI governance framework under management responsibility",
        "fairness": "Ensuring fair treatment of customers",
        "transparency": "Providing appropriate explanations regarding AI usage",
        "data_quality": "Data quality and appropriate management",
        "risk_management": "Appropriate management of AI-specific risks",
    }

    def generate_governance_framework(self, org_info: dict) -> dict:
        """Generate a governance framework"""
        framework = {
            "organization": org_info["name"],
            "effective_date": datetime.now().isoformat(),
            "layers": {
                "board_level": {
                    "responsibilities": [
                        "Approval of AI strategy",
                        "Setting AI risk appetite",
                        "Approval of AI ethics policy",
                        "Receiving reports on serious incidents",
                    ],
                    "frequency": "Quarterly",
                },
                "management_level": {
                    "responsibilities": [
                        "Operating the AI ethics committee",
                        "Approving high-risk AI systems",
                        "Overseeing the risk management framework",
                        "Directing incident response",
                    ],
                    "frequency": "Monthly",
                },
                "operational_level": {
                    "responsibilities": [
                        "Conducting AIIAs",
                        "Executing safety tests",
                        "Monitoring and surveillance",
                        "Initial incident response",
                    ],
                    "frequency": "Daily",
                },
            },
            "three_lines_of_defense": {
                "first_line": {
                    "name": "AI Development and Operations Team",
                    "role": "Risk ownership, day-to-day risk management",
                },
                "second_line": {
                    "name": "Risk Management and Compliance Departments",
                    "role": "Formulating the risk framework, independent monitoring",
                },
                "third_line": {
                    "name": "Internal Audit Department",
                    "role": "Independent evaluation of the governance structure",
                },
            },
        }

        return framework

    def generate_model_risk_management(self, model_info: dict) -> dict:
        """Model Risk Management (MRM) framework"""
        return {
            "model_inventory": {
                "model_id": model_info.get("id"),
                "model_name": model_info.get("name"),
                "risk_tier": model_info.get("risk_tier", "medium"),
                "owner": model_info.get("owner"),
                "validation_date": model_info.get("validation_date"),
            },
            "validation_requirements": {
                "tier_1_critical": {
                    "independent_validation": True,
                    "frequency": "Annual",
                    "backtesting": True,
                    "stress_testing": True,
                    "bias_testing": True,
                },
                "tier_2_significant": {
                    "independent_validation": True,
                    "frequency": "Every 18 months",
                    "backtesting": True,
                    "stress_testing": False,
                    "bias_testing": True,
                },
                "tier_3_low": {
                    "independent_validation": False,
                    "frequency": "Every 2 years",
                    "backtesting": False,
                    "stress_testing": False,
                    "bias_testing": True,
                },
            },
            "ongoing_monitoring": {
                "performance_metrics": ["accuracy", "f1", "auc"],
                "drift_detection": True,
                "threshold_alerts": True,
                "reporting_frequency": "Monthly",
            },
        }
```

---

## 10. FAQ

### Q1: Is AI governance necessary even for small startups?

**A:** Yes. However, a lightweight approach scaled to your organization's size is sufficient.

- **Minimum**: Formulate an AI usage policy (1 page), risk checklist (10 items)
- **Moderate**: Introduce impact assessment templates, conduct regular reviews (quarterly)
- **Preparing for the future**: Building processes early, in preparation for regulations such as the EU AI Act potentially applying to SMEs, can become a competitive advantage

From the perspective of building trust with investors and customers, establishing a governance structure early is also effective.

### Q2: How should AI incident response be designed?

**A:** The following framework is recommended.

1. **Detection**: Automatic detection via monitoring systems + user reporting channels
2. **Triage**: Immediate assessment of impact scope and severity (within 30 minutes)
3. **Containment**: Shutdown of the affected function or fallback (human alternative processing)
4. **Root Cause Analysis**: Identifying whether the cause is data, model, or system-related
5. **Remediation**: Model retraining, adding guardrails, data correction
6. **Post-Incident Review**: Creating an incident report and implementing recurrence prevention measures

Under the EU AI Act, incident reporting for high-risk AI is mandatory, so a reporting framework must also be established.

### Q3: What is the relationship between GDPR and AI regulations?

**A:** GDPR and the EU AI Act are complementary.

- **GDPR**: Regulations on the processing of personal data. Applies to AI training data and inference data
- **EU AI Act**: Regulations on the development and operation of AI systems. In addition to data, it regulates model safety and transparency
- **Overlap**: Profiling, automated decision-making (GDPR Article 22 + AI Act high-risk AI)
- **In practice**: An integrated compliance framework satisfying both requirements is necessary

### Q4: How do you demonstrate the ROI of AI governance?

**A:** It can be quantified from the following perspectives.

- **Risk reduction**: Loss avoidance through incident prevention (fines, litigation, reputational damage)
- **Efficiency gains**: Improved development speed through standardized processes
- **Competitive advantage**: Customer acquisition through building a trusted AI brand
- **Regulatory compliance costs**: Cost advantage of proactive over reactive compliance
- **Concrete example**: EU AI Act penalties reach up to EUR 35 million. Compared to the cost of building a governance structure, the return on investment is clear

### Q5: What governance is required when using open-source AI models?

**A:** Appropriate governance is also required for open-source models.

- **License verification**: Is commercial use permitted? Are there restrictions on derivatives?
- **Safety assessment**: Conduct your own red team testing (do not rely solely on the developer's assessments)
- **Vulnerability management**: Continuously monitor vulnerabilities reported by the community
- **Adding guardrails**: Do not rely on the model's built-in safety; implement additional guardrails
- **EU AI Act**: Open-source GPAI models are also subject to certain obligations (systemic-risk models are not exempt)

### Q6: What is the relationship between AI governance and existing IT governance?

**A:** AI governance is an extension of existing IT governance.

- **Common ground**: Risk management, security, audit, change management
- **AI-specific**: Bias management, explainability, human oversight, model lifecycle management
- **Integrated approach**: It is most efficient to add AI-specific elements to existing ITSM/ITIL frameworks
- **What to avoid**: Running AI governance in a completely separate organization risks creating silos

---


## FAQ

### Q1: What is the most important point when studying this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## 11. Summary

| Area | Action Items | Tools / Methods | Frequency |
|------|--------------|-----------------|-----------|
| Regulatory Compliance | Understand risk classification and obligations | AI Act checklist | At project start |
| GPAI Compliance | Prepare technical documentation and data summary | Compliance checker | At model release |
| Impact Assessment | Conduct AIIA | Template + review | Per project |
| Ethics Committee | Review and approval | Committee operations framework | Per submission |
| Transparency | Create model cards | Auto-generation tool | At model update |
| Audit | Record and retain logs | Audit log system | Continuously |
| Data Governance | Data lineage and PII management | Data governance tools | Continuously |
| Environmental Impact | Estimate and report carbon emissions | Environmental impact assessment tool | Annually |
| Monitoring | Bias and drift detection | Dashboard | Continuously |
| Review | Review of governance structure | Regular review meetings | Quarterly |
| Incidents | Establish a response process | Runbook | When an incident occurs |
| Training | Improve AI ethics literacy | E-learning + hands-on training | At least annually |

---

## Further Reading

- [AI Safety](./00-ai-safety.md) — Technical methods for alignment and red teaming
- [Responsible AI](../../../ai-analysis-guide/docs/03-applied/03-responsible-ai.md) — Implementation of fairness, explainability, and privacy
- [Agent Safety](../../../custom-ai-agents/docs/04-production/01-safety.md) — AI agent-specific governance challenges

---

## References

1. European Parliament. (2024). "Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence (Artificial Intelligence Act)." *Official Journal of the European Union*. https://eur-lex.europa.eu/eli/reg/2024/1689/oj
2. Ministry of Economy, Trade and Industry (Japan). (2024). "AI Business Guidelines (Version 1.0)." https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/
3. OECD. (2019). "Recommendation of the Council on Artificial Intelligence." *OECD Legal Instruments*. https://legalinstruments.oecd.org/en/instruments/OECD-LEGAL-0449
4. The White House. (2023). "Executive Order on the Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence." https://www.whitehouse.gov/briefing-room/presidential-actions/2023/10/30/executive-order-on-the-safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence/
5. G7. (2023). "Hiroshima Process International Code of Conduct for Organizations Developing Advanced AI Systems." https://www.mofa.go.jp/ecm/ec/page5e_000076.html
6. Financial Services Agency (Japan). (2024). "Principles on the Use of AI." https://www.fsa.go.jp/
7. NIST. (2023). "AI Risk Management Framework (AI RMF 1.0)." https://airc.nist.gov/AI_RMF_Pub
