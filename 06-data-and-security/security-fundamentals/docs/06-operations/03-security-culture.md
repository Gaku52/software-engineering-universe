# Security Culture

> A practical guide for integrating security into the development process through DevSecOps, operating bug bounty programs, and building organization-wide security awareness

## What You Will Learn in This Chapter

1. **DevSecOps** — Organizational structure and processes that integrate development, operations, and security
2. **Threat Modeling** — Techniques for systematically identifying risks from the design stage
3. **Bug Bounty** — How external researchers conduct security testing and how to operate such programs
4. **Security Education and Awareness** — Building a culture where security is everyone's responsibility across the organization
5. **Security Metrics and Governance** — Frameworks for understanding and improving security posture through quantitative measurement


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Compliance](./02-compliance.md)

---

## 1. DevSecOps

### From DevOps to DevSecOps

```
DevOps:
  Plan → Code → Build → Test → Release → Deploy → Operate → Monitor
                                                       |
                                                  セキュリティは
                                                  ここだけ (遅い)

DevSecOps:
  Plan → Code → Build → Test → Release → Deploy → Operate → Monitor
    |      |       |       |       |        |         |         |
   脅威   SAST   SCA    DAST    署名    IaC     ランタイム  SIEM
  モデリング コードレビュー Trivy  ZAP    検証    スキャン  保護    異常検知
```

In traditional development processes, security testing was conducted as a gate just before release. This pre-"Shift Left" approach had a fundamental problem: vulnerabilities discovered right before release are expensive to fix and have a significant impact on the schedule. DevSecOps embeds security into every stage of the development lifecycle, enabling early detection of vulnerabilities and dramatically reducing the cost of remediation.

### Implementing the DevSecOps Pipeline

```yaml
# .github/workflows/devsecops-pipeline.yml
name: DevSecOps Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # Phase 1: 静的解析 (SAST)
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep SAST Scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/javascript
            p/typescript
            p/react
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          languages: javascript, typescript

      - name: Upload SARIF results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep.sarif

  # Phase 2: ソフトウェア構成分析 (SCA)
  sca:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy Vulnerability Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: '.'
          severity: CRITICAL,HIGH
          exit-code: '1'
          format: sarif
          output: trivy-results.sarif

      - name: npm audit
        run: npm audit --audit-level=high

      - name: License Check
        run: npx license-checker --failOn "GPL-3.0;AGPL-3.0"

  # Phase 3: シークレット検出
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Gitleaks Secret Detection
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # Phase 4: コンテナスキャン
  container-scan:
    runs-on: ubuntu-latest
    needs: [sast, sca, secrets-scan]
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker Image
        run: docker build -t app:${{ github.sha }} .

      - name: Trivy Container Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: app:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: '1'

      - name: Dockle Lint
        uses: erzz/dockle-action@v1
        with:
          image: app:${{ github.sha }}
          exit-code: '1'

  # Phase 5: DAST (動的解析)
  dast:
    runs-on: ubuntu-latest
    needs: container-scan
    steps:
      - name: Deploy to staging
        run: ./deploy-staging.sh

      - name: OWASP ZAP Full Scan
        uses: zaproxy/action-full-scan@v0.8.0
        with:
          target: https://staging.example.com
          rules_file_name: zap-rules.tsv
          cmd_options: '-a -j'

      - name: Nuclei Scan
        run: |
          nuclei -u https://staging.example.com \
            -t cves/ -t vulnerabilities/ \
            -severity critical,high \
            -o nuclei-results.txt

  # Phase 6: IaC セキュリティ
  iac-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Checkov IaC Scan
        uses: bridgecrewio/checkov-action@master
        with:
          directory: infrastructure/
          framework: terraform,cloudformation
          soft_fail: false

      - name: tfsec Terraform Scan
        uses: aquasecurity/tfsec-action@v1.0.0
        with:
          working_directory: infrastructure/terraform/
```

### DevSecOps Maturity Model

```
+----------------------------------------------------------+
|          DevSecOps Maturity Model                        |
|----------------------------------------------------------|
|                                                          |
|  Level 1: Initial (Ad Hoc)                               |
|  +-- Security is the responsibility of a dedicated team  |
|  +-- Manual penetration testing (annual)                 |
|  +-- Gate-style review just before release               |
|  +-- No tooling in place, decisions are person-dependent |
|                                                          |
|  Level 2: Managed                                        |
|  +-- Security testing integrated into CI/CD             |
|  +-- Automated SAST/SCA execution                       |
|  +-- Security champions appointed                       |
|  +-- Vulnerability management process documented        |
|                                                          |
|  Level 3: Defined                                        |
|  +-- Threat modeling is part of the design process      |
|  +-- Security requirements included in User Stories     |
|  +-- All developers have completed secure coding training|
|  +-- Security gate criteria clearly defined             |
|                                                          |
|  Level 4: Measured                                       |
|  +-- Continuous measurement of security metrics         |
|  +-- Mean Time to Remediate (MTTR) tracked              |
|  +-- Security debt visualized and managed               |
|  +-- Real-time visibility via dashboards                |
|                                                          |
|  Level 5: Optimized                                      |
|  +-- Security is internalized as everyone's responsibility|
|  +-- Automated remediation and containment              |
|  +-- Continuous improvement cycle established           |
|  +-- Advanced threat detection using AI/ML              |
+----------------------------------------------------------+
```

### Maturity Assessment Checklist

```python
# DevSecOps 成熟度自動評価ツール
from dataclasses import dataclass
from enum import IntEnum
from typing import Optional


class MaturityLevel(IntEnum):
    AD_HOC = 1
    MANAGED = 2
    DEFINED = 3
    MEASURED = 4
    OPTIMIZED = 5


@dataclass
class MaturityAssessment:
    """DevSecOps 成熟度評価"""

    # Level 2 criteria
    ci_cd_sast_enabled: bool = False
    ci_cd_sca_enabled: bool = False
    security_champions_appointed: bool = False
    vulnerability_process_documented: bool = False

    # Level 3 criteria
    threat_modeling_in_design: bool = False
    security_in_user_stories: bool = False
    secure_coding_training_complete: bool = False
    security_gate_criteria_defined: bool = False

    # Level 4 criteria
    metrics_continuously_tracked: bool = False
    mttr_tracked: bool = False
    security_debt_visible: bool = False
    dashboard_exists: bool = False

    # Level 5 criteria
    auto_remediation: bool = False
    security_as_everyones_job: bool = False
    continuous_improvement_cycle: bool = False
    ai_ml_threat_detection: bool = False

    def calculate_level(self) -> MaturityLevel:
        """現在の成熟度レベルを計算"""
        level_2_criteria = [
            self.ci_cd_sast_enabled,
            self.ci_cd_sca_enabled,
            self.security_champions_appointed,
            self.vulnerability_process_documented,
        ]
        level_3_criteria = [
            self.threat_modeling_in_design,
            self.security_in_user_stories,
            self.secure_coding_training_complete,
            self.security_gate_criteria_defined,
        ]
        level_4_criteria = [
            self.metrics_continuously_tracked,
            self.mttr_tracked,
            self.security_debt_visible,
            self.dashboard_exists,
        ]
        level_5_criteria = [
            self.auto_remediation,
            self.security_as_everyones_job,
            self.continuous_improvement_cycle,
            self.ai_ml_threat_detection,
        ]

        def level_met(criteria: list[bool], threshold: float = 0.75) -> bool:
            return sum(criteria) / len(criteria) >= threshold

        if level_met(level_5_criteria):
            return MaturityLevel.OPTIMIZED
        if level_met(level_4_criteria):
            return MaturityLevel.MEASURED
        if level_met(level_3_criteria):
            return MaturityLevel.DEFINED
        if level_met(level_2_criteria):
            return MaturityLevel.MANAGED
        return MaturityLevel.AD_HOC

    def generate_roadmap(self) -> list[str]:
        """次のレベルへのロードマップを生成"""
        current = self.calculate_level()
        recommendations = []

        if current < MaturityLevel.MANAGED:
            if not self.ci_cd_sast_enabled:
                recommendations.append(
                    "CI/CD に Semgrep (SAST) を導入する"
                )
            if not self.ci_cd_sca_enabled:
                recommendations.append(
                    "CI/CD に Trivy (SCA) を導入する"
                )
            if not self.security_champions_appointed:
                recommendations.append(
                    "各チームからセキュリティチャンピオンを1名任命する"
                )
        elif current < MaturityLevel.DEFINED:
            if not self.threat_modeling_in_design:
                recommendations.append(
                    "設計フェーズで STRIDE 脅威モデリングを実施する"
                )
            if not self.secure_coding_training_complete:
                recommendations.append(
                    "全開発者にセキュアコーディング研修を受講させる"
                )
        elif current < MaturityLevel.MEASURED:
            if not self.metrics_continuously_tracked:
                recommendations.append(
                    "セキュリティメトリクスの自動収集を設定する"
                )
            if not self.dashboard_exists:
                recommendations.append(
                    "セキュリティダッシュボードを構築する"
                )

        return recommendations
```

### Security Champion Program

```
+----------------------------------------------------------+
|           Security Champion Program                      |
|----------------------------------------------------------|
|                                                          |
|  Security Team (Central)                                 |
|  +-- Policy development                                  |
|  +-- Tool selection and operation                        |
|  +-- Advanced incident response                          |
|  +-- Training and supporting champions                   |
|       |                                                  |
|       v                                                  |
|  Security Champions (1 per team)                         |
|  +-- Development Team A: Champion A                      |
|  +-- Development Team B: Champion B                      |
|  +-- Development Team C: Champion C                      |
|  +-- Infrastructure Team: Champion D                     |
|                                                          |
|  Champion Responsibilities:                              |
|  +-- Drive security reviews within the team             |
|  +-- Facilitate threat modeling sessions                |
|  +-- Support adoption of security tooling               |
|  +-- Act as a liaison with the security team            |
|  +-- Raise security awareness within the team           |
+----------------------------------------------------------+
```

### Security Champion Development Program

```python
# セキュリティチャンピオン管理システム
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional


@dataclass
class SecurityChampion:
    """セキュリティチャンピオンの情報管理"""
    name: str
    team: str
    appointed_date: date
    skill_level: str = "beginner"  # beginner, intermediate, advanced
    certifications: list[str] = field(default_factory=list)
    completed_trainings: list[str] = field(default_factory=list)
    mentored_reviews: int = 0
    threat_models_led: int = 0

    @property
    def tenure_months(self) -> int:
        return (date.today() - self.appointed_date).days // 30

    def should_advance(self) -> bool:
        """昇格条件の判定"""
        if self.skill_level == "beginner":
            return (
                self.tenure_months >= 3
                and len(self.completed_trainings) >= 3
                and self.mentored_reviews >= 5
            )
        elif self.skill_level == "intermediate":
            return (
                self.tenure_months >= 9
                and self.threat_models_led >= 3
                and len(self.certifications) >= 1
            )
        return False


CHAMPION_CURRICULUM = {
    "month_1": {
        "title": "Foundations",
        "topics": [
            "OWASP Top 10 overview and real-world examples",
            "How to use the security review checklist",
            "How to read SAST/SCA tool results",
        ],
        "hands_on": "Identify 3 vulnerability patterns from recent PRs in your team",
    },
    "month_2": {
        "title": "Practice",
        "topics": [
            "How to conduct STRIDE threat modeling",
            "Secure coding patterns",
            "Authentication and authorization design reviews",
        ],
        "hands_on": "Conduct threat modeling for your team's service",
    },
    "month_3": {
        "title": "Application",
        "topics": [
            "Incident response procedures",
            "Practical vulnerability triage",
            "Security metrics analysis",
        ],
        "hands_on": "Create and present a monthly security report",
    },
    "month_4_6": {
        "title": "Deepening",
        "topics": [
            "Participating in CTF challenges",
            "Basics of penetration testing",
            "Cloud security design patterns",
        ],
        "hands_on": "Lead security reviews from the design stage for new features",
    },
}
```

### DevSecOps Toolchain Selection Guide

```
+--------------------------------------------------------------------+
|              DevSecOps Toolchain                                   |
|--------------------------------------------------------------------|
|                                                                    |
| [Plan]                                                             |
|   Threat Modeling: OWASP Threat Dragon, Microsoft TMT, IriusRisk  |
|   Security Requirements: OWASP ASVS checklist                     |
|                                                                    |
| [Code]                                                             |
|   SAST: Semgrep (OSS), SonarQube, Checkmarx                       |
|   Secret Detection: Gitleaks, TruffleHog, git-secrets              |
|   IDE Plugin: Snyk, SonarLint                                      |
|                                                                    |
| [Build]                                                            |
|   SCA: Trivy, Snyk, Dependabot                                    |
|   License: license-checker, FOSSA                                  |
|   SBOM: Syft, CycloneDX                                           |
|                                                                    |
| [Test]                                                             |
|   DAST: OWASP ZAP, Nuclei, Burp Suite                             |
|   API Security: Postman Security, 42Crunch                         |
|   Fuzzing: AFL++, Jazzer                                           |
|                                                                    |
| [Deploy]                                                           |
|   Container: Trivy, Grype, Dockle                                 |
|   IaC: Checkov, tfsec, KICS                                       |
|   Signing: Cosign, Notary                                         |
|                                                                    |
| [Operate]                                                          |
|   Runtime: Falco, Sysdig, Aqua                                    |
|   WAF: AWS WAF, Cloudflare, ModSecurity                           |
|   CSPM: Prowler, ScoutSuite                                       |
|                                                                    |
| [Monitor]                                                          |
|   SIEM: Elastic Security, Splunk, Wazuh                           |
|   Alerting: PagerDuty, Opsgenie                                   |
|   Audit: CloudTrail, Azure Monitor                                |
+--------------------------------------------------------------------+
```

---

## 2. Threat Modeling

### STRIDE Framework

| Threat Category | Description | Countermeasure Examples |
|----------------|-------------|------------------------|
| **S**poofing | Impersonating another identity | Authentication, MFA |
| **T**ampering | Unauthorized modification of data or communications | Integrity verification, signatures |
| **R**epudiation | Denying having performed an action | Audit logs, digital signatures |
| **I**nformation Disclosure | Unauthorized access to confidential information | Encryption, access control |
| **D**enial of Service | Degradation of service availability | Rate limiting, redundancy |
| **E**levation of Privilege | Unauthorized acquisition of privileges | Least privilege, input validation |

### Threat Modeling Procedure

```
Step 1: System Modeling (Data Flow Diagram)

  +--------+     HTTPS      +--------+     SQL      +--------+
  | User   | ------------> | Web    | -----------> | DB     |
  | (Ext)  |              | Server |              |        |
  +--------+     Auth      +--------+  Internal   +--------+
                Cookie           |        NW
                             +--------+
                             | Ext    |
                             | API    |
                             +--------+

Step 2: Enumerate threats using STRIDE
  - Spoofing: Session hijacking
  - Tampering: SQL injection
  - Information Disclosure: DB info leakage via error messages
  - ...

Step 3: Risk Assessment (DREAD or Impact x Likelihood)

Step 4: Determine and implement countermeasures
```

### PASTA (Process for Attack Simulation and Threat Analysis)

```
+---------------------------------------------------------------+
|  PASTA Threat Modeling — 7-Stage Process                      |
|---------------------------------------------------------------|
|                                                               |
|  Stage 1: Define Business Objectives                          |
|    → Clarify the application's purpose, business impact,     |
|      and compliance requirements                              |
|    → Example: EC site — protecting payment data is top priority|
|                                                               |
|  Stage 2: Define Technical Scope                              |
|    → Document system architecture, data flows,               |
|      and technology stack                                     |
|    → Create DFD (Data Flow Diagram)                           |
|                                                               |
|  Stage 3: Application Decomposition                           |
|    → Identify trust boundaries between components            |
|    → Enumerate entry points, assets,                         |
|      and access control points                               |
|                                                               |
|  Stage 4: Threat Analysis                                     |
|    → Gather threat intelligence                               |
|    → Profile attackers (internal/external, skill level)      |
|    → Identify industry-specific threat patterns              |
|                                                               |
|  Stage 5: Vulnerability and Weakness Analysis                 |
|    → Analyze existing scan results                           |
|    → Identify design weaknesses                              |
|    → CVSS scoring                                            |
|                                                               |
|  Stage 6: Attack Modeling and Simulation                      |
|    → Build attack trees                                      |
|    → Simulate attack scenarios                               |
|    → Coordinate with penetration testing                     |
|                                                               |
|  Stage 7: Risk Analysis and Countermeasures                   |
|    → Quantitative assessment of business impact              |
|    → Prioritize countermeasures                              |
|    → Accept residual risk decisions                          |
+---------------------------------------------------------------+
```

### Attack Tree Analysis

```
Attack Goal: Unauthorized Access to User Accounts
│
├── 1. Credential Theft
│   ├── 1.1 Phishing Email [Likelihood: High, Cost: Low]
│   │   ├── 1.1.1 Redirect to fake login page
│   │   └── 1.1.2 Malware email attachment
│   ├── 1.2 Credential Stuffing [Likelihood: Medium, Cost: Low]
│   │   └── 1.2.1 Login attempts from past leaked databases
│   ├── 1.3 Keylogger [Likelihood: Low, Cost: Medium]
│   └── 1.4 Shoulder Surfing [Likelihood: Low, Cost: Low]
│
├── 2. Session Hijacking
│   ├── 2.1 Cookie theft via XSS [Likelihood: Medium, Cost: Medium]
│   ├── 2.2 Man-in-the-Middle (MitM) [Likelihood: Low, Cost: High]
│   └── 2.3 Session Fixation Attack [Likelihood: Low, Cost: Medium]
│
├── 3. Authentication Bypass
│   ├── 3.1 Abuse of password reset function [Likelihood: Medium, Cost: Low]
│   │   ├── 3.1.1 Predictable reset tokens
│   │   └── 3.1.2 Email interception
│   ├── 3.2 OAuth redirect manipulation [Likelihood: Low, Cost: Medium]
│   └── 3.3 JWT algorithm confusion attack [Likelihood: Low, Cost: High]
│
└── 4. Privilege Escalation
    ├── 4.1 IDOR (Insecure Direct Object Reference) [Likelihood: Medium, Cost: Low]
    ├── 4.2 Unauthorized role modification [Likelihood: Low, Cost: Medium]
    └── 4.3 API parameter tampering [Likelihood: Medium, Cost: Low]
```

### Threat Modeling Implementation Template

```yaml
# threat-model.yaml
system: "User Authentication Service"
date: "2025-03-15"
version: "2.0"
participants:
  - "Security Champion: 田中"
  - "Tech Lead: 鈴木"
  - "Backend Developer: 佐藤"
  - "QA Engineer: 高橋"

assets:
  - name: "ユーザ認証情報"
    sensitivity: "HIGH"
    data_classification: "Confidential"
  - name: "セッショントークン"
    sensitivity: "HIGH"
    data_classification: "Confidential"
  - name: "ユーザプロフィール"
    sensitivity: "MEDIUM"
    data_classification: "Internal"

trust_boundaries:
  - name: "インターネット ↔ WAF"
    type: "Network"
  - name: "WAF ↔ アプリケーション"
    type: "Network"
  - name: "アプリケーション ↔ データベース"
    type: "Network"
  - name: "ブラウザ ↔ API"
    type: "Process"

threats:
  - id: T001
    category: "Spoofing"
    description: "盗まれた認証情報による不正ログイン"
    attack_vector: "フィッシング、クレデンシャルスタッフィング"
    risk: "HIGH"
    cvss: 8.1
    mitigation:
      - "MFA の必須化"
      - "異常ログイン検知 (Impossible Travel)"
      - "Have I Been Pwned API によるパスワード漏洩チェック"
    status: "MITIGATED"
    residual_risk: "LOW"

  - id: T002
    category: "Information Disclosure"
    description: "ブルートフォースによるアカウント列挙"
    attack_vector: "ログインフォームのエラーメッセージの差異"
    risk: "MEDIUM"
    cvss: 5.3
    mitigation:
      - "ログイン失敗時の一律エラーメッセージ"
      - "レートリミット (5回/分)"
      - "CAPTCHA (3回失敗後)"
    status: "MITIGATED"
    residual_risk: "LOW"

  - id: T003
    category: "Elevation of Privilege"
    description: "JWT の改竄による権限昇格"
    attack_vector: "alg:none攻撃、鍵混同攻撃"
    risk: "HIGH"
    cvss: 9.1
    mitigation:
      - "RS256 署名の検証"
      - "alg ヘッダのホワイトリスト検証"
      - "JWK のローテーション (90日)"
    status: "MITIGATED"
    residual_risk: "LOW"

  - id: T004
    category: "Tampering"
    description: "セッショントークンの改竄"
    attack_vector: "XSS経由のCookie操作"
    risk: "HIGH"
    cvss: 7.5
    mitigation:
      - "HttpOnly, Secure, SameSite=Strict Cookie属性"
      - "CSP (Content Security Policy) の適用"
      - "サーバサイドでのセッション検証"
    status: "MITIGATED"
    residual_risk: "LOW"

review_schedule:
  next_review: "2025-06-15"
  trigger_events:
    - "新機能の追加"
    - "アーキテクチャの変更"
    - "重大なインシデントの発生"
    - "依存ライブラリの大規模アップデート"
```

### Threat Modeling Automation Tools

```python
# 脅威モデリングの自動化ヘルパー
import json
from pathlib import Path
from typing import Optional


class ThreatModelGenerator:
    """OpenAPI仕様から脅威モデルの雛形を自動生成"""

    STRIDE_PATTERNS = {
        "authentication": {
            "threats": [
                {
                    "category": "Spoofing",
                    "template": "認証エンドポイント {endpoint} に対するクレデンシャルスタッフィング",
                    "default_risk": "HIGH",
                },
                {
                    "category": "Repudiation",
                    "template": "認証イベントのログ不足による否認",
                    "default_risk": "MEDIUM",
                },
            ],
        },
        "data_retrieval": {
            "threats": [
                {
                    "category": "Information Disclosure",
                    "template": "エンドポイント {endpoint} での過剰なデータ露出",
                    "default_risk": "MEDIUM",
                },
                {
                    "category": "Elevation of Privilege",
                    "template": "エンドポイント {endpoint} での IDOR による他ユーザデータアクセス",
                    "default_risk": "HIGH",
                },
            ],
        },
        "data_modification": {
            "threats": [
                {
                    "category": "Tampering",
                    "template": "エンドポイント {endpoint} でのリクエストボディ改竄",
                    "default_risk": "HIGH",
                },
                {
                    "category": "Denial of Service",
                    "template": "エンドポイント {endpoint} への大量リクエストによるDoS",
                    "default_risk": "MEDIUM",
                },
            ],
        },
    }

    def generate_from_openapi(self, spec_path: str) -> dict:
        """OpenAPI仕様から脅威モデルを生成"""
        with open(spec_path) as f:
            spec = json.load(f)

        threats = []
        threat_id = 1

        for path, methods in spec.get("paths", {}).items():
            for method, details in methods.items():
                endpoint = f"{method.upper()} {path}"

                # エンドポイントの特性を判定
                if "auth" in path.lower() or "login" in path.lower():
                    pattern_key = "authentication"
                elif method in ("get", "head"):
                    pattern_key = "data_retrieval"
                else:
                    pattern_key = "data_modification"

                for threat_template in self.STRIDE_PATTERNS[pattern_key]["threats"]:
                    threats.append({
                        "id": f"T{threat_id:03d}",
                        "category": threat_template["category"],
                        "description": threat_template["template"].format(
                            endpoint=endpoint
                        ),
                        "risk": threat_template["default_risk"],
                        "status": "OPEN",
                        "mitigation": [],
                    })
                    threat_id += 1

        return {
            "system": spec.get("info", {}).get("title", "Unknown"),
            "version": spec.get("info", {}).get("version", "1.0"),
            "threats": threats,
            "total_threats": len(threats),
            "by_risk": {
                "HIGH": sum(1 for t in threats if t["risk"] == "HIGH"),
                "MEDIUM": sum(1 for t in threats if t["risk"] == "MEDIUM"),
                "LOW": sum(1 for t in threats if t["risk"] == "LOW"),
            },
        }
```

---

## 3. Bug Bounty

### Designing a Bug Bounty Program

```
+----------------------------------------------------------+
|           Bug Bounty Program                             |
|----------------------------------------------------------|
|                                                          |
|  [Scope Definition]                                      |
|  +-- In scope: app.example.com, api.example.com          |
|  +-- Out of scope: staging.example.com, internal tools   |
|  +-- Prohibited: DoS, social engineering                 |
|                                                          |
|  [Bounty Table]                                          |
|  +-- Critical (RCE, SQLi): $5,000 - $15,000             |
|  +-- High (XSS, IDOR): $1,000 - $5,000                  |
|  +-- Medium (Info Disclosure): $500 - $1,000             |
|  +-- Low (Misconfiguration): $100 - $500                 |
|                                                          |
|  [Response SLA]                                          |
|  +-- Initial response: within 1 business day            |
|  +-- Triage: within 3 business days                     |
|  +-- Fix: Critical 7 days, High 30 days, Medium 90 days |
|  +-- Bounty payment: within 30 days after fix confirmed  |
+----------------------------------------------------------+
```

### Bug Bounty Platform Comparison

| Item | HackerOne | Bugcrowd | Intigriti |
|------|-----------|----------|-----------|
| Researchers | 1M+ | 500K+ | 70K+ |
| Region | Global | Global | Europe-centric |
| Managed programs | Yes | Yes | Yes |
| Private programs | Yes | Yes | Yes |
| Triage support | Yes (paid) | Yes (paid) | Yes (paid) |
| Minimum budget | ~$1,000/month | ~$1,000/month | Inquiry required |
| GDPR compliance | Yes | Yes | Particularly strong |
| Japanese support | Limited | Limited | None |

### Bug Bounty Program Maturity Roadmap

```
Phase 1: Internal Preparation (1-2 months)
├── Establish VDP (Vulnerability Disclosure Policy)
├── Build security team response structure
├── Coordinate with incident response processes
├── Prepare bounty contract templates with legal team
└── Conduct internal penetration testing

Phase 2: Private Program (3-6 months)
├── Select 10-20 researchers by invitation
├── Limit scope to core applications
├── Validate and improve response workflow
├── Start measuring Mean Time to Remediate (MTTR)
└── Establish process for managing duplicate reports

Phase 3: Private Expansion (6-12 months)
├── Expand researchers to 50-100
├── Expand scope to APIs, mobile apps
├── Review bounty table
├── Start creating quarterly reports
└── Consider introducing automated triage tools

Phase 4: Public Program (12+ months)
├── Open to all researchers
├── Full scope (all public assets)
├── Set up Hall of Fame page
├── Publish annual reports
└── Consider bug bounty events (Live Hacking)
```

### Bug Report Processing Flow

```python
# バグバウンティ報告の処理自動化
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum


class ReportStatus(Enum):
    NEW = "new"
    TRIAGED = "triaged"
    DUPLICATE = "duplicate"
    INFORMATIVE = "informative"
    NOT_APPLICABLE = "not_applicable"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    BOUNTY_PAID = "bounty_paid"


@dataclass
class BugReport:
    """バグバウンティ報告"""
    id: str
    title: str
    description: str
    reporter_email: str
    severity: str
    submitted_at: datetime
    status: ReportStatus = ReportStatus.NEW
    assigned_to: str | None = None
    bounty_amount: float | None = None
    resolution_notes: str = ""
    sla_breach: bool = False


class BugBountyWorkflow:
    """バグバウンティ報告の処理ワークフロー"""

    SEVERITY_SLA = {
        'critical': {'triage_hours': 4, 'fix_days': 7, 'bounty_range': (5000, 15000)},
        'high': {'triage_hours': 24, 'fix_days': 30, 'bounty_range': (1000, 5000)},
        'medium': {'triage_hours': 72, 'fix_days': 90, 'bounty_range': (500, 1000)},
        'low': {'triage_hours': 168, 'fix_days': 180, 'bounty_range': (100, 500)},
    }

    def __init__(self):
        self.reports: list[BugReport] = []
        self.known_vulnerabilities: list[str] = []

    def receive_report(self, report: dict) -> BugReport:
        """報告の受領と初期対応"""
        bug_report = BugReport(
            id=f"BB-{len(self.reports) + 1:04d}",
            title=report['title'],
            description=report['description'],
            reporter_email=report['reporter_email'],
            severity="pending",
            submitted_at=datetime.now(),
        )
        self.reports.append(bug_report)

        # 1. 自動応答
        self.send_acknowledgment(bug_report)

        # 2. 重複チェック
        if self.is_duplicate(bug_report):
            bug_report.status = ReportStatus.DUPLICATE
            self.notify_reporter(
                "既知の脆弱性として報告済みです。ご報告ありがとうございます。",
                bug_report,
            )
            return bug_report

        # 3. 重大度評価とトリアージ
        severity = self.assess_severity(bug_report)
        bug_report.severity = severity
        sla = self.SEVERITY_SLA[severity]
        bug_report.status = ReportStatus.TRIAGED

        # 4. 内部チケット作成
        ticket = self.create_internal_ticket(bug_report, sla)

        # 5. セキュリティチームに通知
        self.notify_security_team(bug_report, severity)

        # 6. SLA モニタリング開始
        self.start_sla_monitoring(bug_report, sla)

        return bug_report

    def assess_severity(self, report: BugReport) -> str:
        """CVSS ベースの重大度評価"""
        title_lower = report.title.lower()
        desc_lower = report.description.lower()
        combined = f"{title_lower} {desc_lower}"

        critical_indicators = ['rce', 'remote code execution', 'sqli', 'sql injection',
                               'ssrf', 'authentication bypass', 'privilege escalation']
        high_indicators = ['xss', 'cross-site scripting', 'idor', 'insecure direct',
                          'csrf', 'path traversal', 'file upload']
        medium_indicators = ['information disclosure', 'sensitive data', 'misconfiguration',
                            'open redirect', 'clickjacking']

        if any(indicator in combined for indicator in critical_indicators):
            return 'critical'
        elif any(indicator in combined for indicator in high_indicators):
            return 'high'
        elif any(indicator in combined for indicator in medium_indicators):
            return 'medium'
        return 'low'

    def calculate_bounty(self, report: BugReport) -> float:
        """報奨金の算出"""
        sla = self.SEVERITY_SLA[report.severity]
        base_min, base_max = sla['bounty_range']

        # 影響範囲、再現性、報告品質で調整
        quality_multiplier = 1.0

        # 詳細な再現手順が含まれている場合
        if len(report.description) > 500:
            quality_multiplier += 0.1

        # PoC コードが含まれている場合
        if 'poc' in report.description.lower() or 'proof of concept' in report.description.lower():
            quality_multiplier += 0.15

        # 修正提案が含まれている場合
        if 'fix' in report.description.lower() or 'recommendation' in report.description.lower():
            quality_multiplier += 0.1

        base = (base_min + base_max) / 2
        return min(base * quality_multiplier, base_max)

    def generate_monthly_report(self) -> dict:
        """月次バグバウンティレポート"""
        now = datetime.now()
        month_start = now.replace(day=1)
        monthly_reports = [
            r for r in self.reports
            if r.submitted_at >= month_start
        ]

        return {
            'period': now.strftime('%Y-%m'),
            'total_reports': len(monthly_reports),
            'by_severity': {
                sev: sum(1 for r in monthly_reports if r.severity == sev)
                for sev in ['critical', 'high', 'medium', 'low']
            },
            'by_status': {
                status.value: sum(1 for r in monthly_reports if r.status == status)
                for status in ReportStatus
            },
            'total_bounty_paid': sum(
                r.bounty_amount or 0 for r in monthly_reports
                if r.status == ReportStatus.BOUNTY_PAID
            ),
            'avg_triage_hours': self._calc_avg_triage_time(monthly_reports),
            'sla_breach_count': sum(1 for r in monthly_reports if r.sla_breach),
        }

    def _calc_avg_triage_time(self, reports: list[BugReport]) -> float:
        triaged = [r for r in reports if r.status != ReportStatus.NEW]
        if not triaged:
            return 0.0
        return sum(4.0 for _ in triaged) / len(triaged)  # simplified

    def send_acknowledgment(self, report: BugReport):
        """自動応答の送信"""
        pass

    def is_duplicate(self, report: BugReport) -> bool:
        """重複チェック"""
        return report.title in self.known_vulnerabilities

    def notify_reporter(self, message: str, report: BugReport):
        """報告者への通知"""
        pass

    def create_internal_ticket(self, report: BugReport, sla: dict) -> str:
        """内部チケット作成"""
        return f"SEC-{report.id}"

    def notify_security_team(self, report: BugReport, severity: str):
        """セキュリティチームへの通知"""
        pass

    def start_sla_monitoring(self, report: BugReport, sla: dict):
        """SLAモニタリング開始"""
        pass
```

---

## 4. Security Education

### Designing an Education Program

```
+----------------------------------------------------------+
|          Security Education Program                      |
|----------------------------------------------------------|
|                                                          |
|  [All Employees (Annual)]                                |
|  +-- Anti-phishing training                             |
|  +-- Password management and the need for MFA           |
|  +-- Preventing information leaks on social media       |
|  +-- Incident reporting procedures                      |
|  +-- Physical security (clean desk policy, tailgating)  |
|                                                          |
|  [Developers (Quarterly)]                                |
|  +-- OWASP Top 10 hands-on                              |
|  +-- Secure coding exercises                            |
|  +-- Threat modeling workshops                          |
|  +-- CTF (Capture The Flag) events                      |
|  +-- Security review practice (PR-based)                |
|                                                          |
|  [Security Champions (Monthly)]                          |
|  +-- Briefing on latest vulnerabilities                 |
|  +-- Deep-dive on tool usage                            |
|  +-- Incident case studies                              |
|  +-- Penetration testing fundamentals                   |
|                                                          |
|  [Management (Semi-Annual)]                              |
|  +-- Security risk reports                              |
|  +-- Return on investment explanation                   |
|  +-- Compliance status reports                          |
|  +-- Cyber insurance assessment                         |
+----------------------------------------------------------+
```

### Secure Coding Training Curriculum

```
Day 1: Web Application Security Fundamentals (4 hours)
├── Lecture (1.5h)
│   ├── Overview of OWASP Top 10
│   ├── Real-world examples and impact of each vulnerability
│   └── Fundamental security principles (defense in depth, least privilege)
├── Hands-on (2h)
│   ├── Attack experience using OWASP WebGoat / Juice Shop
│   ├── Identifying and fixing SQL injection
│   └── Identifying and fixing XSS
└── Retrospective (0.5h)
    └── Discussion on patterns applicable to your own application

Day 2: Authentication, Authorization, and Data Protection (4 hours)
├── Lecture (1.5h)
│   ├── Secure implementation patterns for authentication
│   ├── JWT / session management best practices
│   └── Correct use of encryption and hashing
├── Hands-on (2h)
│   ├── Implementing secure password hashing
│   ├── Identifying and fixing IDOR vulnerabilities
│   └── Implementing CSRF protection
└── Retrospective (0.5h)

Day 3: Security Testing and Tools (4 hours)
├── Lecture (1h)
│   ├── Differences between SAST/DAST/SCA and when to use each
│   └── How to integrate into CI/CD pipelines
├── Hands-on (2.5h)
│   ├── Creating custom Semgrep rules
│   ├── Running scans with OWASP ZAP
│   └── Dependency scanning with Trivy
└── Completion Test (0.5h)
    └── Identifying and fixing vulnerabilities in code (practical)
```

### Phishing Simulation

```python
# フィッシング訓練の管理と分析
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class PhishingCampaign:
    """フィッシング訓練キャンペーン"""
    name: str
    template: str
    targets: list[str]
    launched_at: Optional[datetime] = None
    results: dict = field(default_factory=dict)


class PhishingSimulator:
    """フィッシング訓練の管理"""

    TEMPLATES = {
        "password_reset": {
            "subject": "[Important] Password Reset Required",
            "difficulty": "easy",
            "indicators": [
                "Sender domain differs from the official domain",
                "URL domain differs from the official domain",
                "Language creating a sense of urgency",
            ],
        },
        "invoice_payment": {
            "subject": "Please Confirm Your Invoice",
            "difficulty": "medium",
            "indicators": [
                "Attachment file extension (.xlsm)",
                "Sender name is correct but email address differs",
                "Language prompting macro enablement",
            ],
        },
        "ceo_urgent": {
            "subject": "Urgent Action Required (from CEO)",
            "difficulty": "hard",
            "indicators": [
                "Format resembling internal company email",
                "Uses name of an executive",
                "Reply-to is an external address",
            ],
        },
        "shared_document": {
            "subject": "Shared document has been updated",
            "difficulty": "medium",
            "indicators": [
                "Google/Microsoft-style phishing page",
                "Mimics OAuth authorization screen",
                "URL appears legitimate but is subtly different",
            ],
        },
    }

    def create_campaign(
        self,
        name: str,
        template_key: str,
        department: str,
        targets: list[str],
    ) -> PhishingCampaign:
        """フィッシング訓練キャンペーンの作成"""
        template = self.TEMPLATES[template_key]
        campaign = PhishingCampaign(
            name=name,
            template=template_key,
            targets=targets,
        )
        return campaign

    def analyze_results(self, campaign: PhishingCampaign) -> dict:
        """キャンペーン結果の分析"""
        total = len(campaign.targets)
        results = campaign.results

        stats = {
            'total_targets': total,
            'emails_sent': results.get('sent', total),
            'emails_opened': results.get('opened', 0),
            'links_clicked': results.get('clicked', 0),
            'credentials_submitted': results.get('submitted', 0),
            'reported_phishing': results.get('reported', 0),
        }

        # 各率の計算
        stats['open_rate'] = f"{stats['emails_opened'] / total * 100:.1f}%"
        stats['click_rate'] = f"{stats['links_clicked'] / total * 100:.1f}%"
        stats['submit_rate'] = f"{stats['credentials_submitted'] / total * 100:.1f}%"
        stats['report_rate'] = f"{stats['reported_phishing'] / total * 100:.1f}%"

        # リスクスコア
        click_pct = stats['links_clicked'] / total * 100
        if click_pct > 30:
            stats['risk_level'] = "CRITICAL"
            stats['recommendation'] = "Conduct company-wide phishing training immediately"
        elif click_pct > 15:
            stats['risk_level'] = "HIGH"
            stats['recommendation'] = "Conduct additional training for the affected department"
        elif click_pct > 5:
            stats['risk_level'] = "MEDIUM"
            stats['recommendation'] = "Individual follow-up for those who clicked"
        else:
            stats['risk_level'] = "LOW"
            stats['recommendation'] = "Continue the current training program"

        return stats

    def generate_trend_report(self, campaigns: list[PhishingCampaign]) -> dict:
        """経時トレンドレポート"""
        trend = []
        for campaign in sorted(campaigns, key=lambda c: c.launched_at or datetime.min):
            stats = self.analyze_results(campaign)
            trend.append({
                'campaign': campaign.name,
                'date': campaign.launched_at,
                'click_rate': stats['click_rate'],
                'report_rate': stats['report_rate'],
                'risk_level': stats['risk_level'],
            })

        # 改善率の計算
        if len(trend) >= 2:
            first_click = float(trend[0]['click_rate'].rstrip('%'))
            last_click = float(trend[-1]['click_rate'].rstrip('%'))
            improvement = first_click - last_click
            return {
                'trend': trend,
                'improvement': f"{improvement:.1f}%",
                'direction': 'improving' if improvement > 0 else 'degrading',
            }

        return {'trend': trend, 'improvement': 'N/A', 'direction': 'insufficient_data'}
```

### Running an Internal CTF (Capture The Flag) Event

```
+----------------------------------------------------------+
|          Internal CTF Event Design                       |
|----------------------------------------------------------|
|                                                          |
|  [Categories and Points]                                 |
|  Web (50-500pt)                                          |
|  +-- SQL Injection (Beginner: 50pt)                      |
|  +-- XSS + CSP Bypass (Intermediate: 200pt)              |
|  +-- SSRF to Cloud Metadata (Advanced: 500pt)            |
|                                                          |
|  Crypto (50-400pt)                                       |
|  +-- Base64 Decode (Beginner: 50pt)                      |
|  +-- JWT Tampering (Intermediate: 200pt)                 |
|  +-- RSA Padding Oracle (Advanced: 400pt)                |
|                                                          |
|  Forensics (100-300pt)                                   |
|  +-- Access Log Analysis (Beginner: 100pt)               |
|  +-- Memory Dump Analysis (Intermediate: 200pt)          |
|  +-- Malware Behavior Analysis (Advanced: 300pt)         |
|                                                          |
|  Miscellaneous (50-200pt)                                |
|  +-- OSINT (50-100pt)                                    |
|  +-- Recognizing Social Engineering (100pt)              |
|  +-- Security Policy Knowledge (50pt)                    |
|                                                          |
|  [Operations]                                            |
|  +-- CTFd platform                                       |
|  +-- 4-hour time box                                     |
|  +-- Team competition (3-4 members/team)                 |
|  +-- Top teams receive security conference tickets       |
+----------------------------------------------------------+
```

---

## 5. Security Metrics

### KPIs to Measure

```
+----------------------------------------------------------+
|          Security KPI Dashboard                          |
|----------------------------------------------------------|
|                                                          |
|  [Detection]                                             |
|  +-- MTTD (Mean Time to Detect)                         |
|  +-- Detection rate: alert trigger rate per attack      |
|  +-- False positive rate: percentage of false alerts    |
|                                                          |
|  [Response]                                              |
|  +-- MTTR (Mean Time to Respond)                        |
|  +-- MTTC (Mean Time to Contain)                        |
|  +-- MTTF (Mean Time to Fix)                            |
|                                                          |
|  [Vulnerabilities]                                       |
|  +-- Open vulnerability count (Critical/High/Medium/Low)|
|  +-- Average days to fix vulnerabilities                |
|  +-- SLA compliance rate (%)                            |
|  +-- Recurrence rate (same type of vulnerability)       |
|                                                          |
|  [Process]                                               |
|  +-- Security review completion rate                    |
|  +-- Threat modeling completion rate                    |
|  +-- Patch application rate (within SLA)                |
|  +-- Code coverage (security tests)                     |
|                                                          |
|  [People]                                                |
|  +-- Security training completion rate                  |
|  +-- Phishing simulation click rate                     |
|  +-- Security champion coverage rate                    |
|  +-- Security certification holding rate                |
+----------------------------------------------------------+
```

### Security Dashboard Implementation

```python
# セキュリティメトリクスの自動収集と可視化
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class SecurityMetrics:
    """月次セキュリティメトリクス"""
    period: str

    # 脆弱性メトリクス
    open_critical: int = 0
    open_high: int = 0
    open_medium: int = 0
    open_low: int = 0
    vulnerabilities_found: int = 0
    vulnerabilities_fixed: int = 0
    avg_fix_days_critical: float = 0.0
    avg_fix_days_high: float = 0.0
    sla_compliance_rate: float = 0.0

    # 検知・対応メトリクス
    mttd_hours: float = 0.0
    mttr_hours: float = 0.0
    incidents_total: int = 0
    incidents_critical: int = 0
    false_positive_rate: float = 0.0

    # プロセスメトリクス
    security_review_rate: float = 0.0
    threat_model_coverage: float = 0.0
    patch_compliance_rate: float = 0.0

    # 人材メトリクス
    training_completion_rate: float = 0.0
    phishing_click_rate: float = 0.0
    champion_coverage: float = 0.0


class SecurityDashboard:
    """セキュリティダッシュボードのデータ収集"""

    def __init__(self):
        self.metrics_history: list[SecurityMetrics] = []

    def collect_vulnerability_metrics(self) -> dict:
        """脆弱性メトリクスの収集"""
        # 各ソースからデータを収集
        sast_findings = self._collect_sast_findings()
        sca_findings = self._collect_sca_findings()
        dast_findings = self._collect_dast_findings()
        pentest_findings = self._collect_pentest_findings()

        total = {
            'sast': sast_findings,
            'sca': sca_findings,
            'dast': dast_findings,
            'pentest': pentest_findings,
        }

        # 重複排除と統合
        return self._deduplicate_and_merge(total)

    def calculate_risk_score(self, metrics: SecurityMetrics) -> dict:
        """組織のセキュリティリスクスコアを計算"""
        # 重み付きスコアリング (0-100, 低いほど良い)
        vuln_score = (
            metrics.open_critical * 40
            + metrics.open_high * 20
            + metrics.open_medium * 5
            + metrics.open_low * 1
        )
        vuln_score = min(vuln_score, 100)

        process_score = 100 - (
            metrics.security_review_rate * 30
            + metrics.threat_model_coverage * 30
            + metrics.patch_compliance_rate * 40
        )

        people_score = 100 - (
            metrics.training_completion_rate * 40
            + (100 - metrics.phishing_click_rate) * 30
            + metrics.champion_coverage * 30
        )

        response_score = min(
            (metrics.mttr_hours / 24) * 20  # 24時間以内が理想
            + metrics.false_positive_rate * 30
            + (100 - metrics.sla_compliance_rate),
            100,
        )

        overall = (
            vuln_score * 0.35
            + process_score * 0.25
            + people_score * 0.20
            + response_score * 0.20
        )

        return {
            'overall_risk_score': round(overall, 1),
            'vulnerability_risk': round(vuln_score, 1),
            'process_risk': round(process_score, 1),
            'people_risk': round(people_score, 1),
            'response_risk': round(response_score, 1),
            'rating': self._score_to_rating(overall),
        }

    def _score_to_rating(self, score: float) -> str:
        if score <= 20:
            return "A (Excellent)"
        elif score <= 40:
            return "B (Good)"
        elif score <= 60:
            return "C (Acceptable)"
        elif score <= 80:
            return "D (Needs Improvement)"
        return "F (Critical)"

    def generate_executive_report(self, metrics: SecurityMetrics) -> dict:
        """経営層向けサマリーレポート"""
        risk = self.calculate_risk_score(metrics)

        # 前月との比較
        trend = {}
        if len(self.metrics_history) >= 2:
            prev = self.metrics_history[-2]
            trend = {
                'open_critical_change': metrics.open_critical - prev.open_critical,
                'mttr_change_hours': metrics.mttr_hours - prev.mttr_hours,
                'sla_compliance_change': (
                    metrics.sla_compliance_rate - prev.sla_compliance_rate
                ),
                'phishing_click_change': (
                    metrics.phishing_click_rate - prev.phishing_click_rate
                ),
            }

        return {
            'period': metrics.period,
            'risk_score': risk,
            'trend': trend,
            'key_highlights': self._generate_highlights(metrics),
            'action_items': self._generate_action_items(metrics),
        }

    def _generate_highlights(self, m: SecurityMetrics) -> list[str]:
        highlights = []
        if m.open_critical == 0:
            highlights.append("Zero critical vulnerabilities maintained")
        if m.sla_compliance_rate >= 95:
            highlights.append(f"SLA compliance rate {m.sla_compliance_rate}% (target achieved)")
        if m.phishing_click_rate < 5:
            highlights.append(f"Phishing click rate {m.phishing_click_rate}% (below industry average)")
        return highlights

    def _generate_action_items(self, m: SecurityMetrics) -> list[str]:
        items = []
        if m.open_critical > 0:
            items.append(f"Immediate action required for {m.open_critical} critical vulnerabilities")
        if m.training_completion_rate < 90:
            items.append(f"Follow up with staff who have not completed security training (completion rate: {m.training_completion_rate}%)")
        if m.patch_compliance_rate < 95:
            items.append(f"Improve patch application rate (current: {m.patch_compliance_rate}%)")
        return items

    def _collect_sast_findings(self) -> list:
        return []

    def _collect_sca_findings(self) -> list:
        return []

    def _collect_dast_findings(self) -> list:
        return []

    def _collect_pentest_findings(self) -> list:
        return []

    def _deduplicate_and_merge(self, findings: dict) -> dict:
        return findings
```

### Automating Metrics Collection (AWS)

```python
# AWS 環境でのセキュリティメトリクス自動収集
import boto3
from datetime import datetime, timedelta


def collect_aws_security_metrics() -> dict:
    """月次セキュリティメトリクスの収集 (AWS)"""
    metrics = {}

    # 脆弱性メトリクス (Security Hub)
    securityhub = boto3.client('securityhub')
    findings = securityhub.get_findings(
        Filters={
            'RecordState': [{'Value': 'ACTIVE', 'Comparison': 'EQUALS'}],
            'WorkflowStatus': [{'Value': 'NEW', 'Comparison': 'EQUALS'}],
        },
    )
    severity_counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
    for finding in findings['Findings']:
        label = finding['Severity']['Label']
        if label in severity_counts:
            severity_counts[label] += 1

    metrics['open_vulnerabilities'] = severity_counts

    # パッチ適用率 (SSM)
    ssm = boto3.client('ssm')
    compliance = ssm.list_compliance_summaries(
        Filters=[{'Key': 'ComplianceType', 'Values': ['Patch'], 'Type': 'EQUAL'}]
    )
    metrics['patch_compliance'] = compliance

    # GuardDuty 検知数
    guardduty = boto3.client('guardduty')
    metrics['threat_detections'] = {
        'period': 'last_30_days',
        'count': len(guardduty.list_findings(
            DetectorId='detector-id',
            FindingCriteria={
                'Criterion': {
                    'updatedAt': {
                        'GreaterThanOrEqual': int(
                            (datetime.now() - timedelta(days=30)).timestamp() * 1000
                        )
                    }
                }
            },
        ).get('FindingIds', [])),
    }

    # IAM Access Analyzer
    analyzer = boto3.client('accessanalyzer')
    findings_resp = analyzer.list_findings(
        analyzerArn='arn:aws:access-analyzer:ap-northeast-1:123456789012:analyzer/my-analyzer',
        filter={'status': {'eq': ['ACTIVE']}},
    )
    metrics['iam_findings'] = len(findings_resp.get('findings', []))

    # Config ルール準拠率
    config = boto3.client('config')
    compliance_summary = config.get_compliance_summary_by_config_rule()
    metrics['config_compliance'] = {
        'compliant': compliance_summary['ComplianceSummary']['CompliantResourceCount']['CappedCount'],
        'non_compliant': compliance_summary['ComplianceSummary']['NonCompliantResourceCount']['CappedCount'],
    }

    return metrics
```

---

## 6. Security Governance

### Security Policy Framework

```
+--------------------------------------------------------------------+
|              Security Policy Structure                             |
|--------------------------------------------------------------------|
|                                                                    |
|  Level 1: Security Policy (Executive approval)                     |
|  +-- Information Security Basic Policy                            |
|  +-- Scope, responsibilities, and penalty provisions              |
|  +-- Annual review                                                |
|                                                                    |
|  Level 2: Security Standards (CISO approval)                      |
|  +-- Access control standard                                      |
|  +-- Data classification standard                                 |
|  +-- Encryption standard                                          |
|  +-- Incident response standard                                   |
|  +-- Quarterly review                                             |
|                                                                    |
|  Level 3: Procedures (Team lead approval)                          |
|  +-- Password management procedures                               |
|  +-- Security review procedures                                   |
|  +-- Vulnerability management procedures                          |
|  +-- Change management procedures                                 |
|  +-- Monthly review                                               |
|                                                                    |
|  Level 4: Guidelines (Recommendations)                             |
|  +-- Secure coding guidelines                                     |
|  +-- Cloud security guidelines                                    |
|  +-- Remote work security guidelines                              |
|  +-- Updated as needed                                            |
+--------------------------------------------------------------------+
```

### Security Review Gate Design

```python
# セキュリティレビューゲートの自動化
from dataclasses import dataclass
from enum import Enum


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ReviewDecision(Enum):
    APPROVED = "approved"
    CONDITIONAL = "conditional"
    BLOCKED = "blocked"


@dataclass
class ChangeRequest:
    """変更リクエスト"""
    id: str
    title: str
    description: str
    changes_auth: bool = False
    changes_data_handling: bool = False
    changes_api_surface: bool = False
    changes_infrastructure: bool = False
    new_dependency_count: int = 0
    sast_findings_critical: int = 0
    sast_findings_high: int = 0
    sca_vulnerabilities_critical: int = 0
    sca_vulnerabilities_high: int = 0
    has_threat_model: bool = False
    security_review_completed: bool = False


class SecurityGate:
    """セキュリティレビューゲートの判定"""

    def assess_risk(self, change: ChangeRequest) -> RiskLevel:
        """変更リクエストのリスクレベルを評価"""
        risk_score = 0

        if change.changes_auth:
            risk_score += 40
        if change.changes_data_handling:
            risk_score += 30
        if change.changes_api_surface:
            risk_score += 20
        if change.changes_infrastructure:
            risk_score += 25
        if change.new_dependency_count > 5:
            risk_score += 15

        if risk_score >= 60:
            return RiskLevel.CRITICAL
        elif risk_score >= 40:
            return RiskLevel.HIGH
        elif risk_score >= 20:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def evaluate(self, change: ChangeRequest) -> tuple[ReviewDecision, list[str]]:
        """ゲート評価の実行"""
        risk = self.assess_risk(change)
        blockers = []
        conditions = []

        # 絶対ブロッカー
        if change.sast_findings_critical > 0:
            blockers.append(
                f"SAST Critical findings: {change.sast_findings_critical}件を修正してください"
            )
        if change.sca_vulnerabilities_critical > 0:
            blockers.append(
                f"SCA Critical vulnerabilities: {change.sca_vulnerabilities_critical}件を修正してください"
            )

        # リスクレベル別の要件
        if risk in (RiskLevel.CRITICAL, RiskLevel.HIGH):
            if not change.has_threat_model:
                blockers.append("Threat modeling is required")
            if not change.security_review_completed:
                blockers.append("Security team review is required")

        if risk == RiskLevel.MEDIUM:
            if not change.security_review_completed:
                conditions.append("Security champion review is recommended")

        if change.sast_findings_high > 0:
            conditions.append(
                f"SAST High findings: {change.sast_findings_high}件の確認を推奨"
            )

        # 判定
        if blockers:
            return ReviewDecision.BLOCKED, blockers
        elif conditions:
            return ReviewDecision.CONDITIONAL, conditions
        return ReviewDecision.APPROVED, []
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Security Is Only the Security Team's Job

```
Bad:
  → Security team reviews every PR (creating a bottleneck)
  → Developers are indifferent to security
  → Security is seen as an obstacle
  → Late-stage gate reviews cause frequent rework

Good:
  → Security champions are present in every team
  → Automated tools allow developers to perform basic checks
  → Security team focuses on design reviews and advanced analysis
  → Culture of "security is part of quality"
  → Security consideration from early in development (Shift Left)
```

### Anti-Pattern 2: Motivation Through Fear

```
Bad:
  → "There will be penalties for security violations"
  → Blame-seeking after incidents
  → Culture of hiding failures
  → Suppression of security reporting

Good:
  → Praise those who discover vulnerabilities
  → Blameless postmortems
  → Share incidents as learning opportunities
  → Recognize contributions to security improvement
  → Ensure psychological safety
```

### Anti-Pattern 3: Over-Reliance on Tools

```
Bad:
  → Feeling secure just by purchasing expensive tools
  → Flood of alerts causes real threats to be missed
  → Nobody reviews tool output
  → Misconception that tool adoption = security done

Good:
  → Tools assist human judgment
  → Tune alerts and prioritize
  → Regularly review and improve based on tool results
  → Process and culture improvement precedes tooling
```

### Anti-Pattern 4: Compliance Equals Security

```
Bad:
  → The goal becomes filling out checklists
  → Security measures exist only for audits
  → Mountains of ineffective policy documents
  → Security only considered during annual audits

Good:
  → Compliance is the baseline for security
  → Risk-based approach for prioritization
  → Continuous security improvement cycle
  → Countermeasures tailored to your organization's risk profile
```

---

## 8. FAQ

### Q1. What is the first step to adopt DevSecOps?

Start by adding a SAST tool (Semgrep) and SCA tool (Trivy) to the CI/CD pipeline, making only Critical/High findings build blockers. At the same time, appoint one security champion from each development team and start meeting monthly. Making tool results actionable for developers is key to adoption. Rather than trying to introduce everything at once, an incremental approach of adding one tool every three months is more effective.

### Q2. When should you start a bug bounty program?

You should start after internal security testing (SAST/DAST/penetration testing) has matured. Starting when many known vulnerabilities remain will overwhelm your response capacity and put pressure on the bounty budget. Begin with a private program (by invitation) with a small number of researchers, and move to public once the response process has stabilized. A good benchmark is to wait until your internal penetration tests return zero Critical/High vulnerabilities.

### Q3. How do you measure the effectiveness of security culture?

Track quantitative metrics such as trends in phishing simulation click rates, mean time to remediate (MTTR) vulnerabilities, and security review completion rates. Qualitatively, observe whether security questions are being raised spontaneously by development teams and whether incidents are being reported quickly. Measuring changes in security awareness through a company-wide survey every six months is also effective.

### Q4. How do you maintain the motivation of security champions?

Officially recognize that 10-20% of their regular work can be devoted to security activities. Provide support for attending security conferences. Create a community among champions and establish a regular knowledge-sharing forum. Explicitly include security contributions in performance evaluations. Supporting certification acquisition (cost subsidies, study time) is also effective.

### Q5. Can small teams practice DevSecOps?

Yes. The smaller the team, the easier it is to build a culture where everyone is aware of security. Start by introducing GitHub's Dependabot (free) for SCA and Semgrep (OSS) for SAST. Even without a dedicated security team, aim for a culture where everyone functions as a security champion. What matters is not the number of tools, but the mindset of embedding security as part of the development process.

### Q6. What should you do if security training isn't producing results?

Lecture-focused training has low effectiveness. Switch to hands-on formats (OWASP Juice Shop, TryHackMe, internal CTF). Using actual (already-fixed) vulnerabilities from your own codebase as training material increases developers' sense of ownership. Training should not be a one-time event — quarterly repetition is important. Providing opportunities to immediately apply what was learned during code reviews significantly improves retention.

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory but by actually writing code and confirming how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend fully understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|-----------|
| DevSecOps | Integrate security into every stage of the development process |
| Security Champions | One per team, acting as a bridge for security |
| Threat Modeling | Identify risks from the design stage using STRIDE/PASTA |
| Bug Bounty | Start private, gradually move to public |
| Security Education | Role-specific programs, phishing simulations conducted regularly |
| Metrics | Continuously measure MTTD/MTTR, vulnerability counts, training completion rates |
| Governance | Hierarchical structure: Policy → Standard → Procedure |
| Culture | Motivate through recognition, not fear; blameless postmortems |

---

## Further Reading

- [Incident Response](./00-incident-response.md) — Where security culture is put to the test
- [Compliance](./02-compliance.md) — Organizational security governance
- [Secure Coding](../04-application-security/00-secure-coding.md) — Skills every developer should have

---

## References

1. **NIST Cybersecurity Framework** — https://www.nist.gov/cyberframework
2. **OWASP DevSecOps Guideline** — https://owasp.org/www-project-devsecops-guideline/
3. **OWASP Threat Modeling** — https://owasp.org/www-community/Threat_Modeling
4. **HackerOne — Bug Bounty Program Guide** — https://www.hackerone.com/resources
5. **Google — Building Security Culture** — https://sre.google/sre-book/culture/
6. **SANS Security Awareness Report** — https://www.sans.org/security-awareness-training/reports/
7. **Microsoft SDL (Security Development Lifecycle)** — https://www.microsoft.com/en-us/securityengineering/sdl
8. **BSIMM (Building Security In Maturity Model)** — https://www.bsimm.com/
