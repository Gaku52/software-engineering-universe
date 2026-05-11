# AI Ethics and Development -- Engineering Practices for Responsible AI

> AI-generated code reflects human biases. This guide systematically explains the principles of AI ethics that developers should know, bias detection and mitigation, ensuring transparency, and practical methods for responsible AI development.

---

## What You Will Learn in This Chapter

1. **Overview of Ethical Challenges in AI Development** -- Understand the four domains of bias, fairness, transparency, and privacy
2. **Practical Bias Detection and Mitigation Techniques** -- Master bias countermeasures at the code, data, and model layers
3. **Governance Structure for Responsible AI Development** -- Build a framework for promoting ethical AI use as an organization


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [The Future of Software Development -- AI-Native Development and Next-Generation Engineering](./02-future-of-development.md)

---

## 1. Ethical Challenges in AI Development

### 1.1 Four Domains of Ethical Challenges

```
┌──────────────────────────────────────────────────────────┐
│         Four Domains of Ethical Challenges in AI          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────┐  ┌────────────────────┐        │
│  │    Bias            │  │    Fairness         │        │
│  │                    │  │                    │        │
│  │                    │  │                    │        │
│  │ - Training data    │  │ - Disadvantage to  │        │
│  │   imbalance        │  │   specific groups  │        │
│  │ - Algorithm bias   │  │ - Unequal          │        │
│  │ - Output bias      │  │   opportunities    │        │
│  │                    │  │ - Widening gaps     │        │
│  └────────────────────┘  └────────────────────┘        │
│                                                          │
│  ┌────────────────────┐  ┌────────────────────┐        │
│  │    Transparency     │  │    Privacy          │        │
│  │                    │  │                    │        │
│  │                    │  │                    │        │
│  │ - Explaining       │  │ - Personal data    │        │
│  │   decision basis   │  │   protection       │        │
│  │ - Disclosing       │  │ - Rights over      │        │
│  │   AI usage         │  │   training data    │        │
│  │ - Auditability     │  │ - Data             │        │
│  │                    │  │   minimization     │        │
│  └────────────────────┘  └────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Specific Ethical Issues Encountered in Development

```python
# Example 1: Bias in AI code generation
# When asking AI to implement a "user profile"...

# BAD: Biased code that AI tends to generate
class UserProfile:
    def __init__(self):
        self.gender = ""         # Assumes binary
        self.title = "Mr./Mrs."  # Gender-based honorifics
        self.maiden_name = ""    # Gender bias
        self.age = 0             # Breeding ground for age discrimination

    def calculate_insurance_rate(self):
        if self.gender == "female":
            return self.base_rate * 0.9  # Gender-based rate difference
        return self.base_rate

# GOOD: Design that considers bias
class UserProfile:
    def __init__(self):
        self.display_name = ""
        self.pronouns = ""           # Self-declared pronouns
        self.honorific = ""          # Optional honorific
        self.previous_names = []     # No gender assumption
        self.date_of_birth = None    # Only when necessary

    def calculate_insurance_rate(self):
        # Based on risk factors, not gender
        risk_factors = self.assess_risk_factors()
        return self.base_rate * risk_factors.multiplier
```

```python
# Example 2: Bias in AI recommendation systems
# The problem of recruitment AI reflecting training data bias

# BAD: Learning directly from historical hiring data
class BiasedRecruitmentAI:
    def rank_candidates(self, candidates):
        """Ranking based on past hiring records
        Problem: In departments where mostly men were hired,
        male candidates receive unfairly high scores"""
        return self.model.predict(candidates)

# GOOD: Incorporating bias auditing and mitigation
class FairRecruitmentAI:
    def rank_candidates(self, candidates):
        raw_scores = self.model.predict(candidates)

        # Bias audit
        audit = self.bias_auditor.check(
            scores=raw_scores,
            protected_attributes=["gender", "ethnicity", "age"],
            fairness_metric="demographic_parity",
        )

        if audit.has_bias:
            # Apply bias mitigation
            adjusted_scores = self.mitigator.adjust(
                scores=raw_scores,
                bias_report=audit,
            )
            self.log_bias_mitigation(audit, adjusted_scores)
            return adjusted_scores

        return raw_scores
```

---

## 2. Types of Bias and Detection Methods

### 2.1 Classification of Biases in AI Development

```
Where biases occur:

  Data Collection  Preprocessing  Model Training  Output Generation  Usage
  ┌─────┐      ┌─────┐      ┌─────┐      ┌─────┐      ┌─────┐
  │     │─────→│     │─────→│     │─────→│     │─────→│     │
  │  A  │      │  B  │      │  C  │      │  D  │      │  E  │
  │     │      │     │      │     │      │     │      │     │
  └─────┘      └─────┘      └─────┘      └─────┘      └─────┘
    ↑             ↑             ↑             ↑            ↑
  Selection     Label bias   Training     Generation   Confirmation
  bias                       bias         bias         bias
  Lack of       Annotator    Overfitting  Stereotypes  Biased
  representat.  bias                                   interpretation
  Historical    Category     Inter-group  Harmful      Feedback
  bias          design       disparity    content      loops
```

### 2.2 Code for Bias Detection

```python
# Bias detection framework
from dataclasses import dataclass
from typing import Any

@dataclass
class BiasMetric:
    name: str
    value: float
    threshold: float
    is_biased: bool
    affected_groups: list[str]
    recommendation: str

class BiasDetector:
    """Framework for detecting bias in AI systems"""

    def demographic_parity(
        self,
        predictions: list[int],
        protected_attribute: list[str],
    ) -> BiasMetric:
        """Demographic parity: Are positive rates equal across groups?"""
        groups = set(protected_attribute)
        positive_rates = {}

        for group in groups:
            group_mask = [
                a == group for a in protected_attribute
            ]
            group_preds = [
                p for p, m in zip(predictions, group_mask) if m
            ]
            positive_rates[group] = (
                sum(group_preds) / len(group_preds)
                if group_preds else 0
            )

        max_rate = max(positive_rates.values())
        min_rate = min(positive_rates.values())
        disparity = max_rate - min_rate

        return BiasMetric(
            name="demographic_parity",
            value=disparity,
            threshold=0.1,  # A difference of 10% or more requires attention
            is_biased=disparity > 0.1,
            affected_groups=[
                g for g, r in positive_rates.items()
                if r == min_rate
            ],
            recommendation=(
                "There is a significant difference in positive rates. "
                "Please review the distribution of training data."
            ),
        )

    def equalized_odds(
        self,
        predictions: list[int],
        labels: list[int],
        protected_attribute: list[str],
    ) -> BiasMetric:
        """Equalized odds: Are TPR/FPR equal across groups?"""
        groups = set(protected_attribute)
        tpr_by_group = {}

        for group in groups:
            group_indices = [
                i for i, a in enumerate(protected_attribute)
                if a == group
            ]
            true_positives = sum(
                1 for i in group_indices
                if predictions[i] == 1 and labels[i] == 1
            )
            actual_positives = sum(
                1 for i in group_indices if labels[i] == 1
            )
            tpr_by_group[group] = (
                true_positives / actual_positives
                if actual_positives > 0 else 0
            )

        max_tpr = max(tpr_by_group.values())
        min_tpr = min(tpr_by_group.values())
        disparity = max_tpr - min_tpr

        return BiasMetric(
            name="equalized_odds",
            value=disparity,
            threshold=0.1,
            is_biased=disparity > 0.1,
            affected_groups=[
                g for g, r in tpr_by_group.items()
                if r == min_tpr
            ],
            recommendation=(
                "There is a difference in true positive rates between groups. "
                "Please adjust the model's training parameters."
            ),
        )
```

### 2.3 Comparison of Bias Detection Metrics

| Metric | Definition | Use Case | Limitations |
|--------|-----------|----------|-------------|
| Demographic Parity | Positive prediction rates are equal across groups | Hiring, loan approval | Ignores differences in base rates |
| Equalized Odds | TPR/FPR are equal across groups | Medical diagnosis, crime prediction | Difficult to achieve perfectly |
| Predictive Parity | Accuracy is equal across groups | Credit scoring | May be incompatible with other fairness criteria |
| Individual Fairness | Similar individuals receive similar predictions | Insurance rate setting | Defining "similar" is difficult |
| Counterfactual Fairness | Predictions remain the same when protected attributes are changed | Discrimination detection | Requires causal inference |

### 2.4 Bias Checklist for AI Code Generation

| Check Item | What to Verify | Countermeasure |
|-----------|---------------|----------------|
| Variable/function names | Are there gender or cultural biases? | Establish inclusive naming conventions |
| Default values | Do they assume a specific culture or region? | Design with internationalization in mind |
| Validation | Do name/address formats assume a specific culture? | Multicultural validation |
| Test data | Are there test cases with diverse attributes? | Generate diverse test data |
| Error messages | Are there expressions that exclude specific groups? | Inclusive language review |
| Accessibility | Are users with disabilities considered? | WCAG compliance checks |

---

## 3. Transparency and Explainability

### 3.1 Transparency Levels of AI Usage

```
Four Levels of Transparency:

Level 1: Disclosure of Existence
┌─────────────────────────────────────┐
│ "This code was generated with AI    │
│  assistance"                        │
│  → Minimum information              │
└─────────────────────────────────────┘

Level 2: Disclosure of Process
┌─────────────────────────────────────┐
│ "Generated using Claude Code v4     │
│  with the following prompt"         │
│  → Specifying tools and methods     │
└─────────────────────────────────────┘

Level 3: Disclosure of Decision Basis
┌─────────────────────────────────────┐
│ "Considering performance            │
│  requirements and team skill set,   │
│  AI recommended this from 3 options"│
│  → Explaining why that decision     │
│    was reached                      │
└─────────────────────────────────────┘

Level 4: Complete Audit Trail
┌─────────────────────────────────────┐
│ "Input prompts, generation process, │
│  human review content, modified     │
│  sections — all records maintained  │
│  in an auditable format"            │
│  → Complete records meeting         │
│    regulatory requirements          │
└─────────────────────────────────────┘
```

### 3.2 Code for Implementing Transparency

```python
# Decorator for recording metadata of AI-generated code
import functools
import json
from datetime import datetime, timezone
from pathlib import Path

def ai_generated(
    model: str,
    prompt_summary: str,
    human_reviewed: bool = False,
    reviewer: str = "",
    modifications: str = "",
):
    """Decorator to attach transparency metadata to AI-generated code"""

    def decorator(func):
        func._ai_metadata = {
            "generated_by": model,
            "prompt_summary": prompt_summary,
            "generation_date": datetime.now(timezone.utc).isoformat(),
            "human_reviewed": human_reviewed,
            "reviewer": reviewer,
            "modifications": modifications,
            "transparency_level": (
                "L3" if human_reviewed else "L2"
            ),
        }

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        return wrapper
    return decorator

# Usage example
@ai_generated(
    model="Claude Opus 4",
    prompt_summary="Implement insurance rate calculation not based on age",
    human_reviewed=True,
    reviewer="tanaka@example.com",
    modifications="Manually adjusted risk factor weighting",
)
def calculate_insurance_rate(risk_factors: dict) -> float:
    """Insurance rate calculation based on risk factors (age discrimination excluded)"""
    base_rate = 10000
    multiplier = 1.0

    for factor, value in risk_factors.items():
        if factor in APPROVED_RISK_FACTORS:
            multiplier *= RISK_WEIGHTS[factor][value]

    return base_rate * multiplier
```

```typescript
// AI decision audit log system
interface AIDecisionLog {
  timestamp: string;
  component: string;
  decision: string;
  alternatives: {
    option: string;
    score: number;
    reason: string;
  }[];
  selectedOption: string;
  selectionReason: string;
  humanOverride: boolean;
  overrideReason?: string;
}

class AIAuditTrail {
  private logs: AIDecisionLog[] = [];
  private storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  logDecision(log: AIDecisionLog): void {
    this.logs.push(log);
    this.persistLog(log);
  }

  // Generate audit report for regulatory authorities
  generateAuditReport(
    startDate: string,
    endDate: string
  ): AuditReport {
    const filteredLogs = this.logs.filter(
      (log) => log.timestamp >= startDate && log.timestamp <= endDate
    );

    return {
      totalDecisions: filteredLogs.length,
      humanOverrides: filteredLogs.filter((l) => l.humanOverride).length,
      overrideRate:
        filteredLogs.filter((l) => l.humanOverride).length /
        filteredLogs.length,
      decisionBreakdown: this.categorizeDecisions(filteredLogs),
      recommendations: this.generateRecommendations(filteredLogs),
    };
  }

  private persistLog(log: AIDecisionLog): void {
    // Store with hash chain for tamper prevention
    const previousHash = this.getLastHash();
    const entry = { ...log, previousHash, hash: "" };
    entry.hash = this.computeHash(JSON.stringify(entry));
    // Write to storage
  }
}
```

---

## 4. Privacy and Data Protection

### 4.1 Privacy Risks in AI Development

```
┌──────────────────────────────────────────────────────────┐
│            Privacy Risk Map for AI Development             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Code Submission Risk      Training Data Risk             │
│  ┌──────────────┐        ┌──────────────┐              │
│  │ Sending       │        │ Personal data │              │
│  │ internal code │        │ memorized by  │              │
│  │ to external AI│        │ the model     │              │
│  │              │        │              │              │
│  │ - API key     │        │ - PII         │              │
│  │   leakage     │        │   contamination│             │
│  │ - Trade       │        │ - Medical data │              │
│  │   secrets     │        │ - Financial   │              │
│  │ - Customer    │        │   data        │              │
│  │   data        │        │              │              │
│  └──────────────┘        └──────────────┘              │
│                                                          │
│  Inference Risk            Secondary Use Risk             │
│  ┌──────────────┐        ┌──────────────┐              │
│  │ Recovering    │        │ License issues│              │
│  │ original data │        │ with generated│              │
│  │ from AI output│        │ code          │              │
│  │              │        │              │              │
│  │ - Membership  │        │ - GPL         │              │
│  │   inference   │        │   contamination│             │
│  │   attacks     │        │ - Copyright   │              │
│  │ - Model       │        │   infringement│              │
│  │   inversion   │        │ - Patent      │              │
│  │              │        │   conflicts   │              │
│  └──────────────┘        └──────────────┘              │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Implementation Patterns for Privacy Protection

```python
# PII (Personally Identifiable Information) removal before code submission
import re
from typing import NamedTuple

class PIIPattern(NamedTuple):
    name: str
    pattern: str
    replacement: str

class CodeSanitizer:
    """Remove PII from code before sending to AI"""

    PII_PATTERNS = [
        PIIPattern(
            "email",
            r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            "user@example.com",
        ),
        PIIPattern(
            "phone_jp",
            r'0\d{1,4}-\d{1,4}-\d{4}',
            "000-0000-0000",
        ),
        PIIPattern(
            "ip_address",
            r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
            "192.0.2.1",
        ),
        PIIPattern(
            "api_key",
            r'(?:api[_-]?key|token|secret)["\s]*[:=]["\s]*[a-zA-Z0-9_\-]{20,}',
            'API_KEY="REDACTED"',
        ),
        PIIPattern(
            "my_number",
            r'\b\d{4}\s?\d{4}\s?\d{4}\b',
            "0000 0000 0000",
        ),
    ]

    def sanitize(self, code: str) -> tuple[str, list[str]]:
        """Remove PII from code and return the list of removed items"""
        removed = []
        sanitized = code

        for pii in self.PII_PATTERNS:
            matches = re.findall(pii.pattern, sanitized)
            if matches:
                removed.append(
                    f"{pii.name}: {len(matches)} item(s) removed"
                )
                sanitized = re.sub(
                    pii.pattern, pii.replacement, sanitized
                )

        return sanitized, removed

# Usage example
sanitizer = CodeSanitizer()
clean_code, report = sanitizer.sanitize(original_code)
print(f"Removal report: {report}")
# Send clean_code to the AI API
```

---

## 5. Framework for Responsible AI Development

### 5.1 RAI (Responsible AI) Development Process

```
┌──────────────────────────────────────────────────────────────┐
│           Responsible AI Development Process (RAI-SDLC)       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Phase 1         Phase 2         Phase 3         Phase 4    │
│  Ethics Impact   Bias            Transparency    Continuous  │
│  Assessment      Verification    Implementation  Monitoring  │
│                                                              │
│  ┌──────┐       ┌──────┐       ┌──────┐       ┌──────┐    │
│  │ Plan │──────→│ Dev  │──────→│Deploy │──────→│ Ops  │    │
│  └──┬───┘       └──┬───┘       └──┬───┘       └──┬───┘    │
│     │              │              │              │          │
│  - Stakeholder   - Fairness     - Documentation - Drift     │
│    analysis       testing       - Terms of use   monitoring │
│  - Risk          - Bias audit   - Audit logs   - Incident   │
│    assessment    - Security     - Disclosure     response   │
│  - Impact scope   review         policy       - Periodic    │
│    identification- Accessibility- Complaint      audits     │
│  - Ethics         testing        intake       - Retraining  │
│    guideline                   - Contact        decisions   │
│    review                        point setup               │
│                                                              │
│  ←─────────── Feedback Loop ──────────────────→             │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Integrating Ethics Checks into CI/CD

```yaml
# .github/workflows/ethics-check.yml
# Integrating AI ethics checks into the CI pipeline

name: AI Ethics Check
on:
  pull_request:
    branches: [main]

jobs:
  bias-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for biased variable names
        run: |
          # Detect biased variable/function names
          python scripts/check_inclusive_naming.py \
            --config .ethics/naming-rules.yaml \
            --path src/

      - name: Check for hardcoded cultural assumptions
        run: |
          # Detect hardcoded cultural assumptions
          python scripts/check_cultural_assumptions.py \
            --rules .ethics/cultural-rules.yaml \
            --path src/

      - name: PII leak detection
        run: |
          # Detect PII (personal information) leaks in code
          python scripts/detect_pii.py \
            --patterns .ethics/pii-patterns.yaml \
            --path src/ --path tests/

      - name: AI transparency check
        run: |
          # Verify AI-generated code has proper metadata
          python scripts/check_ai_transparency.py \
            --require-metadata \
            --min-level L2 \
            --path src/

      - name: License compliance
        run: |
          # Verify license compatibility of AI-generated code
          python scripts/check_license_compliance.py \
            --policy .ethics/license-policy.yaml

  fairness-test:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.labels.*.name, 'ai-model')
    steps:
      - uses: actions/checkout@v4

      - name: Run fairness tests
        run: |
          python -m pytest tests/fairness/ \
            --fairness-threshold 0.1 \
            --protected-attributes gender,age,ethnicity
```

### 5.3 Comparison of Ethics Guidelines

| Framework | Proposed By | Key Principles | Characteristics |
|-----------|------------|----------------|-----------------|
| AI Safety Levels | Anthropic | Staged AI Safety Level (ASL) definitions | Safety measures aligned with model capabilities |
| Responsible AI | Microsoft | Fairness, reliability, safety, privacy, inclusiveness, transparency, accountability | 6 principles + practical guides |
| AI Ethics Principles | OECD | Inclusive growth, sustainable development, human-centered values, transparency, robustness, accountability | Adopted by 42 countries |
| Human-Centric AI Society Principles | Cabinet Office (Japan) | Human dignity, diversity, sustainability | Domestic Japanese guidelines |
| EU AI Act | European Union | Risk-based regulatory approach | Legally binding regulation |

### 5.4 Comparison of AI Regulations

| Regulation/Standard | Region | Scope | Impact on Developers |
|--------------------|--------|-------|---------------------|
| EU AI Act | EU | High-risk AI systems | Conformity assessments, technical documentation, transparency requirements |
| AI Basic Act (under discussion) | Japan | AI in general | Guideline compliance, risk assessment |
| Executive Order 14110 | USA | Government-used AI | Safety testing, red teaming |
| ISO/IEC 42001 | International | AI management systems | Certification acquisition, continuous improvement |
| NIST AI RMF | USA | AI in general (voluntary) | Application of risk management framework |

---

## 6. Copyright and Licensing Issues

### 6.1 Legal Risks of AI-Generated Code

```python
# Understanding copyright risks of AI-generated code

# Risk 1: Copyrighted works mixed into training data
# AI models are trained on large amounts of data including open source code
# Generated code may closely resemble existing GPL code

# Risk 2: Copyright ownership of AI-generated works
# Many jurisdictions tend toward "no copyright for AI-generated works"
# → Risk of relying solely on AI generation for core IP

# Risk 3: License contamination
# If AI-generated code contains copyleft-licensed code such as GPL,
# it may affect the entire project

# Example countermeasure
class LicenseComplianceChecker:
    """Check license compatibility of AI-generated code"""

    def check_similarity(
        self,
        generated_code: str,
        threshold: float = 0.85,
    ) -> list[dict]:
        """Inspect similarity between generated code and known OSS code"""
        results = []
        for oss_project in self.oss_database:
            similarity = self.compute_similarity(
                generated_code, oss_project.code
            )
            if similarity > threshold:
                results.append({
                    "project": oss_project.name,
                    "license": oss_project.license,
                    "similarity": similarity,
                    "risk": self.assess_risk(oss_project.license),
                    "recommendation": self.recommend_action(
                        oss_project.license
                    ),
                })
        return results

    def assess_risk(self, license_type: str) -> str:
        risk_map = {
            "MIT": "Low - Attribution only",
            "Apache-2.0": "Low - Attribution + patent clause",
            "BSD-2-Clause": "Low - Attribution only",
            "GPL-3.0": "High - Possible copyleft contamination",
            "AGPL-3.0": "Highest - Applies to SaaS as well",
            "SSPL": "Highest - Restrictions on service provision",
        }
        return risk_map.get(license_type, "Unknown - Legal review required")
```

---

## 7. Practice: Ethical AI Development Checklist

### 7.1 Checklist by Development Phase

```
┌─────────────────────────────────────────────────────────────┐
│            Ethical AI Development Checklist                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Design Phase]                                             │
│  □ Have you assessed the impact on stakeholders?            │
│  □ Have you identified protected attributes                 │
│    (gender, age, ethnicity, etc.)?                          │
│  □ Have you agreed on a definition of fairness              │
│    with stakeholders?                                       │
│  □ Does your data collection policy comply                  │
│    with privacy laws?                                       │
│  □ Have you determined the AI usage                         │
│    disclosure policy?                                       │
│                                                             │
│  [Development Phase]                                        │
│  □ Have you analyzed training data for bias?                │
│  □ Are you following inclusive naming conventions?           │
│  □ Have you implemented bias detection tests?               │
│  □ Are you attaching metadata to AI-generated code?         │
│  □ Have you removed/anonymized PII?                         │
│                                                             │
│  [Deployment Phase]                                         │
│  □ Have you conducted a bias audit and                      │
│    documented the results?                                  │
│  □ Do you meet explainability requirements?                 │
│  □ Have you set up a complaint/feedback                     │
│    intake channel?                                          │
│  □ Have you prepared a rollback plan?                       │
│  □ Are audit logs being properly recorded?                  │
│                                                             │
│  [Operations Phase]                                         │
│  □ Are you conducting regular bias monitoring?              │
│  □ Is the incident response process functioning?            │
│  □ Are you monitoring for model drift?                      │
│  □ Are you regularly updating ethics guidelines?            │
│  □ Are you tracking changes in relevant regulations?        │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Ethics Washing

```
❌ Ethics washing pattern:

  "We take AI ethics seriously" — but in reality...

  ┌────────────────────────────────────┐
  │  ✗ Ethics committee exists but     │
  │    has never convened              │
  │  ✗ Guidelines were drafted but     │
  │    nobody uses them in reviews     │
  │  ✗ Bias testing in CI is           │
  │    always being skipped            │
  │  ✗ Problems are dismissed as       │
  │    "unexpected"                    │
  └────────────────────────────────────┘

✅ Effective ethics governance:

  1. Define specific metrics and thresholds
     - Quantitative criteria such as "fairness score > 0.9"
  2. Embed automated checks in the CI pipeline
     - Block merges when bias detection fails
  3. Conduct quarterly ethics audits
     - Include external auditors
  4. Establish an incident reporting and improvement cycle
     - Foster a culture of not hiding problems
  5. Document executive commitment
     - Ethics requirements have equal priority with functional requirements
```

### Anti-Pattern 2: Bias Afterthought

```python
# BAD: Scrambling to fix bias discovered after release
class AfterThoughtApproach:
    def develop(self):
        model = self.train_model(data)
        self.deploy_to_production(model)
        # ... months later ...
        # News: "Your AI is discriminatory!"
        self.panic_fix(model)  # ← Too late

# GOOD: Building in fairness from the design stage (Fairness by Design)
class FairnessByDesign:
    def develop(self):
        # Phase 1: Data audit
        data = self.collect_data()
        bias_report = self.audit_data_bias(data)
        data = self.mitigate_data_bias(data, bias_report)

        # Phase 2: Model training (with fairness constraints)
        model = self.train_model(
            data,
            fairness_constraints={
                "demographic_parity_gap": 0.05,
                "equalized_odds_gap": 0.05,
            },
        )

        # Phase 3: Fairness testing
        fairness_result = self.test_fairness(model)
        if not fairness_result.passes_all_criteria:
            raise FairnessViolation(fairness_result)

        # Phase 4: Staged deployment
        self.canary_deploy(model, monitor_fairness=True)
```

### Anti-Pattern 3: Privacy Theater

```
❌ Patterns of "thinking" privacy is being protected:

  1. Claiming "anonymized" but only removing names
     → Email addresses, physical addresses, phone numbers remain
     → Individuals can be identified through combinations

  2. "It's an internal AI so privacy isn't an issue"
     → Access control between departments is still necessary
     → Data of former employees, performance reviews, etc.

  3. "Consent has been obtained"
     → Blanket consent with vague purposes of use
     → Usage for AI training is not explicitly stated

✅ Effective privacy protection:

  1. k-Anonymity: At least k individuals share the same attributes
  2. Differential privacy: Addition/removal of individuals doesn't affect results
  3. Purpose limitation: Consent stating specific purposes for AI use
  4. Data minimization: Collect and use only the minimum necessary data
  5. Access control: Strict role-based access management
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Perform input data validation
- Implement proper error handling
- Also create test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

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

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

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
    print(f"Speedup factor: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm computational complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|---------|
| Initialization error | Configuration file issues | Verify configuration file path and format |
| Timeout | Network latency / Insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, transaction management |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify the location
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Verify step by step**: Use logging or a debugger to validate hypotheses
5. **Fix and regression test**: After fixing, also run tests on related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function input/output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception: {func.__name__}: {e}")
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

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Review disk and network I/O conditions
4. **Check concurrent connections**: Review connection pool status

| Issue Type | Diagnostic Tool | Solution |
|-----------|----------------|----------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology selections.

| Criterion | When to Prioritize | When It Can Be Compromised |
|-----------|-------------------|---------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow              │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                  │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to 2.                    │
│                                                 │
│  2. Deployment frequency?                       │
│    ├─ Once a week or less → Monolith             │
│    │  + Module separation                       │
│    └─ Daily/multiple times → Go to 3.            │
│                                                 │
│  3. Independence between teams?                  │
│    ├─ High → Microservices                       │
│    └─ Medium → Modular monolith                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A method that is fast in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction offers high reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and challenges"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Practical Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring from early on

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually modernize a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If no existing tests, create Characterization Tests first
- Use an API gateway to coexist old and new systems
- Perform data migration in stages

| Phase | Work Content | Estimated Duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Sequential migration starting with peripheral features | 3-6 months | Medium |
| 4. Core migration | Migration of core functionality | 6-12 months | High |
| 5. Completion | Decommission legacy system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** More than 50 engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Set ownership per team
- Manage shared libraries using Inner Source approach
- Design API-first to minimize inter-team dependencies

```python
# Inter-team API contract definition
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """Inter-team API contract"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Verify SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical System

**Situation:** A system requiring millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: In-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Impact | Implementation Cost | Application |
|--------------------|--------|-------------------|-------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Asynchronous processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Team Development Practices

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any impact on performance?
- [ ] Are there any security concerns?
- [ ] Is documentation updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (Decision Records) | As needed | Future members | Decision transparency |
| Retrospectives | Biweekly | Entire team | Continuous improvement |
| Mob programming | Monthly | Important design | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        Impact High
          │
    ┌─────┼─────┐
    │ Plan │ Act  │
    │ and  │ imme-│
    │ sche-│ dia- │
    │ dule │ tely │
    ├─────┼─────┤
    │Record│ Next │
    │ only │Sprint│
    │      │      │
    └─────┼─────┘
          │
        Impact Low
    Frequency Low  Frequency High
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------------|-----------|----------------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor authentication, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audits |
| Configuration issues | Medium | Security headers, principle of least privilege | Configuration scans |
| Insufficient logging | Medium | Structured logging, audit trails | Log analysis |

### Secure Coding Best Practices

```python
# Secure coding example
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """Security utilities"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate cryptographically secure token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """Hash a password"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """Verify a password"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input value"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage example
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not output to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is properly configured
- [ ] Vulnerability scanning of dependencies is performed
- [ ] Error messages do not contain internal information
---

## FAQ

### Q1: Does copyright arise for AI-generated code?

As of 2026, precedents are still accumulating in many jurisdictions and no clear conclusion has been reached. The U.S. Copyright Office has indicated that "copyright does not arise for portions autonomously generated by AI," while also stating that "copyright may be recognized when a human has made sufficient creative contribution." In Japan, Article 30-4 of the Copyright Act broadly permits data use at the training stage, while the ownership of copyright in generated works remains under discussion. For developers, three points are important: (1) do not overly rely on AI-generated code and have humans design core IP, (2) do not neglect to verify license compatibility, and (3) continuously monitor legal developments.

### Q2: How can we raise AI ethics awareness within the team?

Three approaches are effective: (1) Hold regular workshops using concrete case studies (real examples work better than abstract principles), (2) Add ethics items to code review checklists and embed them into daily workflows, (3) Appoint an AI ethics "champion" within the team to regularly share the latest findings and incident case studies. Embedding ethics checks into the actual development process is more effective at achieving adoption than formal training.

### Q3: Is it possible to completely eliminate bias?

It is theoretically impossible. The mathematical impossibility of simultaneously eliminating all biases has been proven (Impossibility Theorem). For example, demographic parity and predictive parity cannot be perfectly satisfied at the same time (between groups with different base rates). What is important is to clearly define "which biases to prioritize mitigating" in agreement with stakeholders, transparently disclose remaining biases, and continuously improve. Rather than aiming for perfection, the realistic goal is to maintain a state that is explainable and improvable.

### Q4: Do Japanese companies also need to comply with the EU AI Act?

Companies that operate in the EU or provide services to EU residents need to comply. Like the GDPR, it has extraterritorial application, so even if development takes place solely within Japan, the regulation applies to services targeting the EU. AI systems classified as high-risk (hiring, credit assessment, healthcare, etc.) are subject to particularly strict requirements. Key points for compliance are: (1) classify the risk of your AI systems, (2) prepare technical documentation and conformity assessments, (3) implement transparency requirements (disclosure of AI usage), and (4) establish human oversight mechanisms.

### Q5: Can using open-source AI models avoid copyright risks?

The fact that a model itself is open source and the copyright risks of the code it generates are separate issues. Even with an open-source model, if the training data contains copyrighted code, the risk of generated output closely resembling existing code remains. In fact, open-source models may sometimes have greater transparency regarding training data, offering an advantage for risk assessment. In any case, similarity checks and license compatibility verification of generated code are essential regardless of the type of model used.

---

## Summary

| Item | Key Point |
|------|-----------|
| Four Ethics Domains | Address bias, fairness, transparency, and privacy comprehensively |
| Bias Countermeasures | Implement detection and mitigation across all phases from data collection to operations |
| Transparency | Define four levels of disclosure and maintain audit trails |
| Privacy | Practice PII removal, differential privacy, and data minimization |
| Governance | Embed ethics checks in CI/CD and conduct periodic audits |
| Copyright | Verify license compatibility and maintain human design of core IP |
| Regulatory Compliance | Be aware of extraterritorial application of the EU AI Act, etc., and classify risks |
| Continuous Improvement | Rather than aiming for perfection, maintain an explainable and improvable state |

---

## Recommended Next Guides

- [02-future-of-development.md](./02-future-of-development.md) -- The future of software development and AI-native development
- [00-ai-team-practices.md](./00-ai-team-practices.md) -- Team development practices for AI utilization
- [../02-workflow/01-ai-code-review.md](../02-workflow/01-ai-code-review.md) -- Quality and ethics checks in AI code review

---

## References

1. Anthropic, "Core Views on AI Safety," 2023. https://www.anthropic.com/research/core-views-on-ai-safety
2. European Commission, "AI Act: Regulation on Artificial Intelligence," 2024. https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
3. OECD, "OECD AI Principles," 2024. https://oecd.ai/en/ai-principles
4. NIST, "AI Risk Management Framework (AI RMF 1.0)," 2023. https://www.nist.gov/artificial-intelligence/ai-risk-management-framework
5. Cabinet Office (Japan), "Human-Centric AI Society Principles," 2019. https://www8.cao.go.jp/cstp/ai/humancentricai.pdf
6. Mehrabi, N. et al., "A Survey on Bias and Fairness in Machine Learning," ACM Computing Surveys, 2021. https://dl.acm.org/doi/10.1145/3457607
